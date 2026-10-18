import { resolveNs, resolve4, resolve6 } from 'node:dns/promises';
import { writeFile, mkdir } from 'node:fs/promises';
const origin = new URL(process.env.VALOPRAC_VERIFY_URL || 'https://valoprac.global');
const checks = [];
const record = (name, passed, details) => { checks.push({ name, passed, details }); console.log(JSON.stringify(checks.at(-1))); };
const request = async (url, options = {}) => {
  const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(15000), ...options });
  return response;
};
async function check(name, fn) { try { await fn(); } catch (error) { record(name, false, error.message); } }
await check('dns', async () => {
  const values = await Promise.allSettled([resolveNs(origin.hostname), resolve4(origin.hostname), resolve6(origin.hostname)]);
  const addresses = values.slice(1).filter(value => value.status === 'fulfilled').flatMap(value => value.value);
  if (!addresses.length) throw new Error('No resolvable production address. DNS errors: ' + values.filter(v => v.status === 'rejected').map(v => v.reason.code).join(', '));
  record('dns', true, { nameservers: values[0].status === 'fulfilled' ? values[0].value : [], addresses });
});
const dnsReady = checks.find(check => check.name === 'dns')?.passed;
let html = '';
if (!dnsReady) {
  for (const name of ['public-https','static-assets','spa-refresh','http-to-https','www-canonical','release-metadata']) record(name, false, 'Blocked: production DNS is not resolvable; no successful TLS or gameplay verification claimed');
  await mkdir('artifacts', { recursive: true });
  await writeFile('artifacts/production-verification.json', JSON.stringify({ checkedAt: new Date().toISOString(), requestedOrigin: origin.origin, passed: false, browserGameplayTested: false, measuredDisplayFps: null, checks }, null, 2));
  process.exit(1);
}
await check('public-https', async () => {
  const response = await request(origin);
  html = await response.text();
  if (response.status !== 200 || !html.includes('VALOPRAC') || !html.includes('lang="ko"')) throw new Error(`Expected public Korean VALOPRAC HTML, got ${response.status}`);
  if (/signin-with-chatgpt|login\.cloudflareaccess\.com/.test(html)) throw new Error('An authentication gate blocks public gameplay');
  for (const header of ['strict-transport-security', 'content-security-policy', 'x-content-type-options']) if (!response.headers.has(header)) throw new Error(`Missing ${header}`);
  record('public-https', true, { status: response.status, tlsValidation: 'platform-default-enabled', contentType: response.headers.get('content-type') });
});
await check('static-assets', async () => {
  if (!html) throw new Error('Production HTML was unavailable');
  const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"?#]+\.(?:js|css))"/g)].map(match => match[1]);
  if (!assets.length) throw new Error('No production assets found');
  for (const asset of assets) {
    const response = await request(new URL(asset, origin));
    if (response.status !== 200) throw new Error(`Asset failed: ${asset}, ${response.status}`);
    if (!response.headers.get('cache-control')?.includes('immutable')) throw new Error(`Immutable hashed-asset caching missing: ${asset}`);
    await response.arrayBuffer();
  }
  record('static-assets', true, { checked: assets.length });
});
await check('spa-refresh', async () => {
  for (const path of ['/training', '/settings', '/statistics']) {
    const response = await request(new URL(path, origin));
    const text = await response.text();
    if (response.status !== 200 || !text.includes('VALOPRAC')) throw new Error(`SPA route refresh failed: ${path}`);
  }
  record('spa-refresh', true, { routes: ['/training', '/settings', '/statistics'] });
});
await check('http-to-https', async () => {
  const source = new URL(origin); source.protocol = 'http:';
  const response = await request(source);
  if (![301, 302, 307, 308].includes(response.status) || !response.headers.get('location')?.startsWith(origin.origin)) throw new Error('HTTP does not redirect to canonical HTTPS');
  record('http-to-https', true, { status: response.status, location: response.headers.get('location') });
});
await check('www-canonical', async () => {
  const source = new URL('/settings?check=1', origin); source.hostname = `www.${origin.hostname}`;
  const response = await request(source);
  const expected = new URL('/settings?check=1', origin).href;
  if (![301, 308].includes(response.status) || new URL(response.headers.get('location') || '/', source).href !== expected) throw new Error('www redirect does not preserve the canonical path and query');
  record('www-canonical', true, { status: response.status, location: response.headers.get('location') });
});
await check('release-metadata', async () => {
  const response = await request(new URL('/version.json', origin));
  const metadata = await response.json();
  if (response.status !== 200 || metadata.app !== 'VALOPRAC' || !metadata.commit) throw new Error('Invalid release metadata');
  if (!response.headers.get('cache-control')?.includes('no-store')) throw new Error('Release metadata may be stale');
  record('release-metadata', true, metadata);
});
const report = { checkedAt: new Date().toISOString(), requestedOrigin: origin.origin, passed: checks.every(check => check.passed), browserGameplayTested: false, measuredDisplayFps: null, checks };
await mkdir('artifacts', { recursive: true });
await writeFile('artifacts/production-verification.json', JSON.stringify(report, null, 2));
if (!report.passed) process.exitCode = 1;

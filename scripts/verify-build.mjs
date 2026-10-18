import { readFile, readdir, stat, access } from 'node:fs/promises';
import { resolve, relative, extname } from 'node:path';
import { createHash } from 'node:crypto';
const root = resolve('dist');
const fail = message => { throw new Error(`Production artifact validation failed: ${message}`); };
const read = name => readFile(resolve(root, name), 'utf8');
const html = await read('index.html');
if (!html.includes('<html lang="ko">') || !html.includes('VALOPRAC')) fail('Missing Korean language or VALOPRAC branding');
if (!html.includes('https://valoprac.global/')) fail('Missing canonical production domain');
if (!html.includes('noscript')) fail('Missing JavaScript fallback');
const headers = await read('_headers');
for (const required of ['script-src \'self\'', 'frame-ancestors \'none\'', 'Strict-Transport-Security', '/assets/*', 'max-age=31536000, immutable']) if (!headers.includes(required)) fail(`Missing header policy: ${required}`);
const redirects = await read('_redirects');
if (!redirects.includes('https://www.valoprac.global/* https://valoprac.global/:splat 301')) fail('Missing canonical www redirect');
try { await access(resolve(root, '404.html')); fail('A top-level 404.html disables the intended native Pages SPA fallback'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const manifest = JSON.parse(await read('.vite/manifest.json'));
for (const entry of Object.values(manifest)) {
  for (const file of [entry.file, ...(entry.css || []), ...(entry.assets || [])]) {
    if (!file || file.startsWith('/') || file.includes('..')) fail('Invalid manifest asset path');
    await access(resolve(root, file));
  }
}
const metadata = JSON.parse(await read('version.json'));
if (metadata.app !== 'VALOPRAC' || !metadata.version || !metadata.commit) fail('Missing release identity');
const forbidden = /sk-proj-[A-Za-z0-9_-]{20,}|AKIA[A-Z0-9]{16}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/;
let fileCount = 0, totalBytes = 0;
const hashes = [];
async function walk(directory) {
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const file = resolve(directory, item.name);
    if (item.isDirectory()) { await walk(file); continue; }
    if (item.name.startsWith('.env') || file.endsWith('.map')) fail('Environment files or source maps present in browser artifact');
    const buffer = await readFile(file);
    if (['.js', '.json', '.html', '.css'].includes(extname(file)) && forbidden.test(buffer.toString('utf8'))) fail(`Potential secret found in ${relative(root, file)}`);
    fileCount++; totalBytes += (await stat(file)).size;
    hashes.push(`${createHash('sha256').update(buffer).digest('hex')}  ${relative(root, file)}`);
  }
}
await walk(root);
console.log(JSON.stringify({ status: 'passed', app: metadata.app, version: metadata.version, commit: metadata.commit, files: fileCount, totalBytes, secretScan: 'passed', manifest: 'passed', spaFallback: 'native-pages' }));

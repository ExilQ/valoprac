import assert from 'node:assert/strict';
import {readFileSync,readdirSync,existsSync} from 'node:fs';
import {join,relative} from 'node:path';
import {pathToFileURL} from 'node:url';
const source=readFileSync('dist/server/index.js','utf8'),moduleURL='data:text/javascript;base64,'+Buffer.from(source).toString('base64');
let worker;try{worker=(await import(moduleURL)).default;}catch{throw Error('Response worker must be valid self-contained ESM');}
assert.equal(typeof worker.fetch,'function');const req=(path,headers={},method='GET')=>worker.fetch(new Request('https://valoprac.trade'+path,{method,headers}));
const checks=[];async function visit(dir){for(const item of readdirSync(dir,{withFileTypes:true})){if(item.name.startsWith('.')||['_headers','_redirects'].includes(item.name))continue;const file=join(dir,item.name);if(item.isDirectory()){await visit(file);continue;}const path='/'+relative('dist-client',file).replaceAll('\\','/'),response=await req(path),actual=new Uint8Array(await response.arrayBuffer());assert.equal(response.status,200,path);assert.deepEqual(Buffer.from(actual),readFileSync(file),path);assert.equal(response.headers.get('x-frame-options'),'DENY');assert.match(response.headers.get('content-security-policy'),/frame-ancestors 'none'/);if(path.startsWith('/assets/'))assert.equal(response.headers.get('cache-control'),'public, max-age=31536000, immutable');if(path.endsWith('.html')){assert.match(response.headers.get('cache-control'),/no-transform/,path);assert.match(response.headers.get('x-robots-tag'),/noindex/,path);}checks.push(path);}}
await visit('dist-client');
for(const path of ['/not-a-real-page','/not-a-real-page/','/not-a-real-page.html']){const missing=await req(path,{accept:'text/html'});assert.equal(missing.status,404);assert.doesNotMatch(await missing.text(),/id="root"/);assert.match(missing.headers.get('cache-control'),/no-transform/);}assert.equal((await req('/assets/missing.js',{accept:'text/html'})).status,404);assert.equal((await req('/_headers')).status,404);
for(const route of ['training','settings','statistics','results','weapons','unreal','aim','guide','footsteps','tactical-guide','aim-methodology','migration'])for(const path of [`/${route}`,`/${route}/`]){const response=await req(path,{accept:'text/html'});assert.equal(response.status,200,path);assert.match(response.headers.get('cache-control'),/no-transform/,path);assert.match(response.headers.get('x-robots-tag'),/noindex/,path);}
const first=await req('/');assert.doesNotMatch(first.headers.get('x-robots-tag'),/noindex/);assert.doesNotMatch((await req('/?utm_source=chatgpt.com')).headers.get('x-robots-tag'),/noindex/);const cached=await req('/',{'If-None-Match':first.headers.get('etag')});assert.equal(cached.status,304);assert.match(cached.headers.get('cache-control'),/no-transform/);
assert.equal((await req('/',{}, 'HEAD')).status,200);assert(!JSON.parse(readFileSync('dist/.openai/hosting.json','utf8')).static);
console.log(JSON.stringify({responseWorkerVerified:true,assetResponses:checks.length,headers:true,htmlNoTransform:true,immutableAssets:true,knownRoutes:true,unknownDocument404:true,asset404:true}));

// Verify admission at the packaged Worker boundary, not only imported source helpers.
let dbCalls=0;
const env={VALOPRAC_USAGE_SECRET:'build-check-non-production-usage-key-0001',DB:{prepare(){dbCalls++;throw Error('Unsigned requests must not access D1');}}};
const unsigned=new Request('https://valoprac.trade/api/usage',{method:'POST',headers:{origin:'https://valoprac.trade','sec-fetch-site':'same-origin','cf-connecting-ip':'203.0.113.1','content-type':'application/json'},body:JSON.stringify({id:crypto.randomUUID(),test:true,type:'view',path:'/',source:'unknown',seq:1})});
assert.equal((await worker.fetch(unsigned,env)).status,401);assert.equal(dbCalls,0);
assert.equal((await worker.fetch(new Request('https://valoprac.trade/api/gpu/grant',{method:'POST',headers:{origin:'https://valoprac.trade','sec-fetch-site':'same-origin'}}),{})).status,401);
assert(existsSync('dist/drizzle/0001_usage_admission.sql'));assert(existsSync('dist/drizzle/meta/_journal.json'));
assert(readFileSync('dist-client/index.html','utf8').includes('/usage.js?v=admission-1'));
console.log(JSON.stringify({packagedAdmissionVerified:true,unsignedMetricsRejected:true,anonymousGPURejected:true,migrationsIncluded:true,usageScriptCacheBusted:true}));

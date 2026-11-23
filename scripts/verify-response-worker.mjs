import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {join,relative} from 'node:path';
import {pathToFileURL} from 'node:url';
const source=readFileSync('dist/server/index.js','utf8'),moduleURL='data:text/javascript;base64,'+Buffer.from(source).toString('base64');
let worker;try{worker=(await import(moduleURL)).default;}catch{throw Error('Response worker must be valid self-contained ESM');}
assert.equal(typeof worker.fetch,'function');const req=(path,headers={},method='GET')=>worker.fetch(new Request('https://valoprac.trade'+path,{method,headers}));
const checks=[];async function visit(dir){for(const item of readdirSync(dir,{withFileTypes:true})){if(item.name.startsWith('.')||['_headers','_redirects'].includes(item.name))continue;const file=join(dir,item.name);if(item.isDirectory()){await visit(file);continue;}const path='/'+relative('dist-client',file).replaceAll('\\','/'),response=await req(path),actual=new Uint8Array(await response.arrayBuffer());assert.equal(response.status,200,path);assert.deepEqual(Buffer.from(actual),readFileSync(file),path);assert.equal(response.headers.get('x-frame-options'),'DENY');assert.match(response.headers.get('content-security-policy'),/frame-ancestors 'none'/);if(path.startsWith('/assets/'))assert.equal(response.headers.get('cache-control'),'public, max-age=31536000, immutable');checks.push(path);}}
await visit('dist-client');
const fallback=await req('/not-a-real-page',{accept:'text/html'});assert.equal(fallback.status,200);assert.match(await fallback.text(),/id="root"/);assert.equal((await req('/assets/missing.js',{accept:'text/html'})).status,404);assert.equal((await req('/_headers')).status,404);
const first=await req('/');assert.equal((await req('/',{'If-None-Match':first.headers.get('etag')})).status,304);
assert.equal((await req('/',{}, 'HEAD')).status,200);assert(!JSON.parse(readFileSync('dist/.openai/hosting.json','utf8')).static);
console.log(JSON.stringify({responseWorkerVerified:true,assetResponses:checks.length,headers:true,immutableAssets:true,spaFallback:true,asset404:true}));

import {test} from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import worker,{inlineScriptHashes} from './cloudflare.js';
// Fake ASSETS binding with auto-trailing-slash style resolution and ETags.
const theme='(function(){document.documentElement.dataset.theme="light"})();';
const files={
 '/index.html':{body:`<!doctype html><html><head><script>${theme}</script><script type="application/ld+json">{"@type":"WebSite"}</script><script type="module" src="/assets/app-abcd1234.js"></script></head><body><div id="root"></div></body></html>`,type:'text/html; charset=utf-8'},
 '/training/index.html':{body:`<!doctype html><script>${theme}</script><div id="root"></div>`,type:'text/html; charset=utf-8'},
 '/assets/app-abcd1234.js':{body:'console.log(1)',type:'application/javascript'},
 '/release.json':{body:'{"version":"12.0.26"}',type:'application/json'},
 '/downloads/valoprac-unreal-source.zip':{body:'PK',type:'application/zip'},
};
const resolve=p=>files[p]?p:files[p+'.html']?p+'.html':files[(p.endsWith('/')?p:p+'/')+'index.html']?(p.endsWith('/')?p:p+'/')+'index.html':null;
const env={ASSETS:{async fetch(request){const p=new URL(request.url).pathname,key=resolve(p);if(!key)return new Response('not found',{status:404});const etag=`"${key}"`;
 if(request.headers.get('if-none-match')===etag)return new Response(null,{status:304,headers:{etag}});
 return new Response(request.method==='HEAD'?null:files[key].body,{headers:{'content-type':files[key].type,etag,'cache-control':'public, max-age=0, must-revalidate'}});}}};
const request=(path,options={})=>worker.fetch(new Request('https://valoprac.trade'+path,options),env);
const hash=text=>createHash('sha256').update(text).digest('base64');

test('inline executable and data scripts are hashed, external scripts are not',async()=>{
 assert.deepEqual(await inlineScriptHashes(files['/index.html'].body),[hash(theme),hash('{"@type":"WebSite"}')]);
});
test('documents authorise exactly their inline scripts under the strict policy',async()=>{
 for(const method of ['GET','HEAD'])for(const path of ['/','/training','/training/']){const r=await request(path,{method});assert.equal(r.status,200);
  const csp=r.headers.get('content-security-policy');assert.match(csp,new RegExp(`script-src 'self' 'sha256-${hash(theme).replace(/[+/]/g,'\\$&')}'`));assert.doesNotMatch(csp,/script-src[^;]*unsafe-inline/);
  assert.equal(r.headers.get('x-frame-options'),'DENY');assert.equal(r.headers.get('cache-control'),'no-cache, max-age=0, must-revalidate, no-transform');if(method==='HEAD')assert.equal(await r.text(),'');}
 const cached=await request('/',{headers:{'if-none-match':'"/index.html"'}});assert.equal(cached.status,304);assert.match(cached.headers.get('content-security-policy'),/sha256-/);
});
test('only the homepage is indexable; hashed assets are immutable and crawlable',async()=>{
 assert.match((await request('/')).headers.get('x-robots-tag'),/^index/);
 for(const p of ['/training','/release.json'])assert.match((await request(p)).headers.get('x-robots-tag'),/noindex/);
 const js=await request('/assets/app-abcd1234.js');assert.equal(js.headers.get('cache-control'),'public, max-age=31536000, immutable');assert.equal(js.headers.get('x-robots-tag'),null);
 assert.equal((await request('/release.json')).headers.get('cache-control'),'no-store');
 assert.match((await request('/downloads/valoprac-unreal-source.zip')).headers.get('content-disposition'),/attachment/);
});
test('unknown documents get a real 404 page, not the application shell',async()=>{
 const r=await request('/new/path',{headers:{accept:'text/html'}});assert.equal(r.status,404);const body=await r.text();assert.match(body,/주소를 찾을 수 없습니다/);assert.doesNotMatch(body,/id="root"/);
 const head=await request('/absent',{method:'HEAD',headers:{'sec-fetch-dest':'document'}});assert.equal(head.status,404);assert.equal(await head.text(),'');
 const asset=await request('/assets/missing.js',{headers:{accept:'text/html'}});assert.equal(asset.status,404);assert.match(asset.headers.get('content-type'),/text\/plain/);
});
test('configuration files, bad paths and other methods are refused with security headers',async()=>{
 for(const p of ['/_headers','/_redirects','/.openai/hosting.json'])assert.equal((await request(p,{headers:{accept:'text/html'}})).status,404);
 const bad=await request('/%FF');assert.equal(bad.status,400);assert.equal(bad.headers.get('x-content-type-options'),'nosniff');
 const post=await request('/',{method:'POST'});assert.equal(post.status,405);assert.equal(post.headers.get('allow'),'GET, HEAD');
});
test('usage and GPU admission APIs are routed to their handlers, not to static assets',async()=>{
 for(const p of ['/api/usage','/api/gpu/grant']){const r=await request(p,{method:'POST',body:'{}',headers:{'content-type':'application/json'}});assert.notEqual(r.status,405);assert.notEqual(await r.clone().text(),'not found');}
});

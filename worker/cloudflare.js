// Cloudflare Workers entry: serves the static Vite build through the ASSETS
// binding with the same response policy as the packaged response worker
// (worker/index.js). `run_worker_first` is on in wrangler.jsonc, so the
// `_headers` file is NOT applied by Cloudflare: every header is set here.
// - Inline scripts (theme bootstrap, guide scripts) are authorised by their
//   SHA-256 hashes, computed from the served document, under a strict CSP.
// - Unknown documents get a real 404 page instead of the SPA shell.
// - Only the homepage is indexable; the usage API keeps its route.
// - The GPU admission API is NOT served here: it trusts the
//   oai-authenticated-user-id header, which only ChatGPT Sites sets and
//   overwrites. On Cloudflare any client could send it and mint grants.
import {handleUsage} from './usage.js';

export const SECURITY_HEADERS={
 'X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'strict-origin-when-cross-origin',
 'Permissions-Policy':'camera=(), microphone=(), geolocation=()',
 'Strict-Transport-Security':'max-age=31536000',
 'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'; font-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"
};
const HTML_CACHE='no-cache, max-age=0, must-revalidate, no-transform';
const NOT_FOUND_PAGE='<!doctype html><html lang="ko" data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>404 · VALOPRAC</title><script src="/interface-theme.js"></script><link rel="stylesheet" href="/precision-docs.css"></head><body class="not-found"><main><h1>주소를 찾을 수 없습니다.</h1><p>요청한 페이지가 없거나 이동했습니다.</p><a href="/">훈련장으로 돌아가기</a></main></body></html>';

async function sha256Base64(text){
 const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)));
 let binary='';for(const byte of digest)binary+=String.fromCharCode(byte);return btoa(binary);
}
/** Same selection as scripts/build-response-worker.mjs: non-empty scripts without src. */
export async function inlineScriptHashes(html){
 const hashes=[];
 for(const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi))if(!/\bsrc\s*=/.test(match[1])&&match[2].trim())hashes.push(await sha256Base64(match[2]));
 return [...new Set(hashes)];
}
function plain(status,body,method,extra={}){
 const headers=new Headers({...SECURITY_HEADERS,'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store','X-Robots-Tag':'noindex, follow',...extra});
 return new Response(method==='HEAD'?null:body,{status,headers});
}

export default {
 async fetch(request,env){
  const url=new URL(request.url);
  if(url.pathname==='/api/usage'||url.pathname==='/api/usage/session')return handleUsage(request,env);
  if(url.pathname==='/api/gpu/grant')return plain(404,'이 주소에서는 제공하지 않는 기능입니다.',request.method);
  let path;try{path=decodeURIComponent(url.pathname);}catch{return plain(400,'잘못된 주소입니다.',request.method);}
  if(!['GET','HEAD'].includes(request.method))return plain(405,'허용하지 않는 요청입니다.',request.method,{Allow:'GET, HEAD'});
  const documentRequest=(request.headers.get('accept')??'').includes('text/html')||request.headers.get('sec-fetch-dest')==='document';
  const hidden=path.split('/').some(part=>part.startsWith('.')||part==='_headers'||part==='_redirects');
  const asset=hidden?null:await env.ASSETS.fetch(request);
  if(!asset||asset.status===404){
   if(documentRequest&&!path.startsWith('/assets/'))return new Response(request.method==='HEAD'?null:NOT_FOUND_PAGE,{status:404,headers:{...SECURITY_HEADERS,'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store, no-transform','X-Robots-Tag':'noindex, follow'}});
   return plain(404,'주소를 찾지 못했습니다. 훈련장으로 돌아가 주세요.',request.method);
  }
  const headers=new Headers(asset.headers);
  for(const [name,value] of Object.entries(SECURITY_HEADERS))headers.set(name,value);
  if(asset.status>=300&&asset.status<400&&asset.status!==304)return new Response(null,{status:asset.status,headers});
  // A 304 or HEAD reply has no body (and a 304 may lack Content-Type): read
  // the current document once so the stored policy matches what executes.
  let full=null;const current=async()=>full??=await env.ASSETS.fetch(new Request(url.href,{method:'GET'}));
  if(asset.status===304&&!headers.get('content-type')){const type=(await current()).headers.get('content-type');if(type)headers.set('Content-Type',type);}
  const type=(headers.get('content-type')??'').toLowerCase(),html=type.startsWith('text/html');
  headers.set('Cache-Control',path.startsWith('/assets/')?'public, max-age=31536000, immutable':html?HTML_CACHE:type.includes('json')?'no-store':'public, max-age=86400');
  if(html||/^(?:text\/plain|application\/(?:json|xml|pdf|zip))/.test(type))headers.set('X-Robots-Tag',html&&path==='/'?'index, follow, max-image-preview:large':'noindex, follow');
  if(path.endsWith('.zip'))headers.set('Content-Disposition','attachment; filename="valoprac-source.zip"');
  if(html){
   const document=asset.status===200&&request.method==='GET'?await asset.text():await (await current()).text();
   const hashes=await inlineScriptHashes(document);
   if(hashes.length)headers.set('Content-Security-Policy',SECURITY_HEADERS['Content-Security-Policy'].replace("script-src 'self'",`script-src 'self' ${hashes.map(hash=>`'sha256-${hash}'`).join(' ')}`));
   if(asset.status===200&&request.method==='GET')return new Response(document,{status:200,headers});
  }
  return new Response(request.method==='HEAD'||asset.status===304?null:asset.body,{status:asset.status,headers});
 },
};

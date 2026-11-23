// Generated builds replace this marker with same-origin asset data; no runtime network dependencies.
const EMBEDDED = /*__ASSETS__*/{};
const SECURITY_HEADERS={
   'X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'strict-origin-when-cross-origin',
   'Permissions-Policy':'camera=(), microphone=(), geolocation=()',
   'Strict-Transport-Security':'max-age=31536000',
   'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'; font-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"
};
function decode(entry){if(entry.text!==undefined)return entry.text;const raw=atob(entry.base64),bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);return bytes;}
export function createAssetHandler(assets,rules=[],aliases={}){
 const decoded=new Map();
 const match=(pattern,path)=>pattern.endsWith('*')?path.startsWith(pattern.slice(0,-1)):path===pattern;
 const handler={async fetch(request){
  const url=new URL(request.url);let path;try{path=decodeURIComponent(url.pathname);}catch{return new Response(request.method==='HEAD'?null:'잘못된 주소입니다.',{status:400,headers:{...SECURITY_HEADERS,'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store','X-Robots-Tag':'noindex, follow'}});}
  const original=path,documentRequest=(request.headers.get('accept')??'').includes('text/html')||request.headers.get('sec-fetch-dest')==='document';
  const hidden=path.split('/').some(p=>p.startsWith('.')||p==='_headers'||p==='_redirects');
  if(aliases[path])path=aliases[path];
  else if(path.endsWith('/'))path+='index.html';
  if(!assets[path]&&!path.split('/').at(-1).includes('.')){if(assets[path+'.html'])path+='.html';else if(assets[path+'/index.html'])path+='/index.html';}
  const entry=hidden?undefined:assets[path],missingDocument=!entry&&documentRequest&&!hidden&&!original.startsWith('/assets/');
  const headers=new Headers({
   'Content-Type':entry?.type??(missingDocument?'text/html; charset=utf-8':'text/plain; charset=utf-8'),
   'Cache-Control':entry?.immutable?'public, max-age=31536000, immutable':entry?.type.startsWith('text/html')?'no-cache, max-age=0, must-revalidate':entry?.type.includes('json')?'no-store':'public, max-age=86400',
   ...SECURITY_HEADERS
  });
  for(const rule of rules)if(match(rule.path,original))for(const [name,value] of Object.entries(rule.headers))headers.set(name,value);
  // Cloudflare documents no-transform as an opt-out from injected JavaScript
  // Detections. Apply after header rules so aliases, HEAD and 304 responses keep
  // the same strict script policy without untrusted inline CDN scripts.
  const html=headers.get('Content-Type')?.toLowerCase().startsWith('text/html');
  // Keep only the actual homepage searchable, including on HEAD and 304 replies.
  // Crawling stays allowed so engines can discover noindex on existing results.
  if(html||/^(?:text\/plain|application\/(?:json|xml|pdf|zip))/.test(headers.get('Content-Type')??''))headers.set('X-Robots-Tag',html&&entry&&original==='/'?'index, follow, max-image-preview:large':'noindex, follow');
  if(html&&!/(?:^|,)\s*no-transform\s*(?:,|$)/i.test(headers.get('Cache-Control')??''))headers.set('Cache-Control',`${headers.get('Cache-Control')??'no-cache'}, no-transform`);
  if(entry?.scripts?.length)headers.set('Content-Security-Policy',headers.get('Content-Security-Policy').replace("script-src 'self'",`script-src 'self' ${entry.scripts.map(hash=>`'sha256-${hash}'`).join(' ')}`));
  if(!['GET','HEAD'].includes(request.method)){headers.set('Allow','GET, HEAD');return new Response('허용하지 않는 요청입니다.',{status:405,headers});}
  if(!entry){headers.set('Cache-Control',html?'no-store, no-transform':'no-store');const body=missingDocument?'<!doctype html><html lang="ko" data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>404 · VALOPRAC</title><script src="/interface-theme.js"></script><link rel="stylesheet" href="/precision-docs.css"></head><body class="not-found"><main><h1>주소를 찾을 수 없습니다.</h1><p>요청한 페이지가 없거나 이동했습니다.</p><a href="/">훈련장으로 돌아가기</a></main></body></html>':'주소를 찾지 못했습니다. 훈련장으로 돌아가 주세요.';return new Response(request.method==='HEAD'?null:body,{status:404,headers});}
  if(entry.etag)headers.set('ETag',entry.etag);
  if(path.endsWith('.zip'))headers.set('Content-Disposition','attachment; filename="valoprac-source.zip"');
  if(entry.etag&&request.headers.get('if-none-match')?.split(',').map(x=>x.trim()).some(x=>x==='*'||x===entry.etag||x===`W/${entry.etag}`))return new Response(null,{status:304,headers});
  if(request.method==='HEAD')return new Response(null,{headers});
  if(!decoded.has(path))decoded.set(path,decode(entry));
  return new Response(decoded.get(path),{headers});
 }};return handler;
}
export default createAssetHandler(EMBEDDED.assets??{},EMBEDDED.rules??[],EMBEDDED.aliases??{});

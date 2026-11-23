import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {origin,contentPages} from './search-metadata.mjs';

if(process.argv.length!==3||process.argv[2]!=='--submit')throw Error('Run with --submit only after the corresponding Site deployment succeeds.');
const config=JSON.parse(readFileSync('deployment/search-discovery.json','utf8'));
assert.equal(config.origin,origin);
const key=readFileSync('public/'+config.indexNowKeyFile,'utf8').trim();
assert(/^[a-f0-9]{32}$/.test(key));
const get=url=>fetch(url,{headers:{'User-Agent':'VALOPRAC-Search-Verification/1.0','Cache-Control':'no-cache'},signal:AbortSignal.timeout(30000),redirect:'error'});
const keyLocation=origin+'/'+config.indexNowKeyFile;
const keyResponse=await get(keyLocation);
assert.equal(keyResponse.status,200,'Verification file must be deployed');
assert.equal((await keyResponse.text()).trim(),key,'Public verification file must match');
// Notify exclusions as changes too, so previously submitted pages are recrawled.
const results=await Promise.allSettled(contentPages.map(async page=>{
 const response=await get(origin+page.path);
 assert.equal(response.status,200,page.path+' must be live before submission');
 const html=await response.text();
 assert(html.includes(`<link rel="canonical" href="${origin+page.path}">`),page.path+' canonical mismatch');
 assert.equal((response.headers.get('x-robots-tag')??'').includes('noindex'),page.path!=='/',page.path+' live homepage-only search policy');
 return origin+page.path;
}));
const failed=results.filter(result=>result.status==='rejected');
if(failed.length)throw new AggregateError(failed.map(result=>result.reason),'Live page verification failed; nothing was submitted');
const payload={host:'valoprac.trade',key,keyLocation,urlList:results.map(result=>result.value)};
// This protocol deliberately verifies domain control using a public text file.
// The token is not a provider credential, account password, or runtime secret.
for(const endpoint of ['https://api.indexnow.org/indexnow','https://searchadvisor.naver.com/indexnow']){
 try{
  const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json; charset=utf-8'},body:JSON.stringify(payload),signal:AbortSignal.timeout(30000),redirect:'error'});
  const detail=(await response.text()).slice(0,800);
  console.log(JSON.stringify({endpoint,status:response.status,received:response.status===200||response.status===202,urlCount:payload.urlList.length,indexingGuaranteed:false,detail}));
 }catch(error){console.log(JSON.stringify({endpoint,received:false,error:String(error),urlCount:payload.urlList.length}));process.exitCode=1;}
}

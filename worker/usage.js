import {signToken,verifyToken,privateDigest,bearer,validLifetime} from '../security/tokens.mjs';
import {admissionReply,validAdmissionRequest} from './admission.js';
const publicOrigin='https://valoprac.trade';
const knownPages = new Set([
  '/', '/training', '/maps', '/weapons', '/aim', '/statistics', '/settings',
  '/tools', '/results', '/unreal', '/guide', '/valorant-aim-trainer',
  '/aim-methodology', '/footsteps', '/tactical-guide'
]);
const channels = new Set(['google', 'bing', 'naver', 'daum', 'other-search', 'chatgpt', 'youtube', 'discord', 'social', 'external', 'unknown']);
const sessionId = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const maxBodyBytes = 512;


function network(request){
 const ip=request.headers.get('cf-connecting-ip');if(!ip)return null;
 const v4=ip.split('.');if(v4.length===4&&v4.every(x=>/^\d{1,3}$/.test(x)&&+x<=255))return v4.map(Number).join('.');
 try{if(!ip.includes(':'))return null;const canonical=new URL('http://['+ip+']/').hostname.slice(1,-1),parts=canonical.split('::');if(parts.length>2)return null;const left=parts[0]?parts[0].split(':'):[],right=parts[1]?parts[1].split(':'):[];const groups=parts.length===2?[...left,...Array(8-left.length-right.length).fill('0'),...right]:left;return groups.slice(0,4).map(x=>parseInt(x,16).toString(16)).join(':')+'/64';}catch{return null;}
}
async function decodeUsageEvent(request){
 if(Number(request.headers.get('content-length'))>maxBodyBytes)return null;
 const reader=request.body?.getReader();if(!reader)return null;let bytes=0,text='';const decoder=new TextDecoder('utf-8',{fatal:true});
 try{for(;;){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>maxBodyBytes){await reader.cancel();return null;}text+=decoder.decode(value,{stream:true});}return JSON.parse(text+decoder.decode());}finally{reader.releaseLock();}
}
function guard(db,claims,kind,seq,now,nonce){
 const at=Math.floor(now/1000),day=Math.floor((at+9*3600)/86400),id=kind+':'+claims.id+':'+seq;
 return db.prepare(`INSERT OR IGNORE INTO vp_usage_guard
   (id,nonce,kind,network,session,at,minute,hour,day,expires_at)
   SELECT ?,?,?,?,?,?,?,?,?,? WHERE ? != 'start' OR EXISTS
   (SELECT 1 FROM vp_usage_session WHERE id=? AND test=?)`).bind(id,nonce,kind,claims.net,claims.id,at,Math.floor(at/60),Math.floor(at/3600),day,at+7200,kind,claims.id,Number(claims.test));
}
export function createUsageHandler(){
 const attempts=new Map();
 function permit(key,limit,now){
  const bucket=Math.floor(now/60000);let value=attempts.get(key);
  if(!value||value.bucket!==bucket){
   if(attempts.size>=4096){for(const [k,v]of attempts)if(v.bucket!==bucket)attempts.delete(k);if(!attempts.has(key)&&attempts.size>=4096)return false;}
   value={bucket,total:0};attempts.set(key,value);
  }
  return ++value.total<=limit;
 }
 return async function handleUsage(request,env={},now=Date.now()){
 if(request.method!=='POST')return admissionReply(405);
 if(!validAdmissionRequest(request))return admissionReply(403);
 if(request.headers.get('sec-gpc')==='1'||request.headers.get('dnt')==='1')return admissionReply(204);
 if(request.headers.get('content-type')?.split(';',1)[0]!=='application/json')return admissionReply(415);
 const secret=env.VALOPRAC_USAGE_SECRET,db=env.DB;
 if(typeof secret!=='string'||secret.length<32||!db)return admissionReply(503);
 const peer=network(request);if(!peer)return admissionReply(503);
 const seconds=Math.floor(now/1000),mint=new URL(request.url).pathname==='/api/usage/session';
 let claims;
 if(!mint){
  claims=await verifyToken(secret,bearer(request));
  if(!claims||claims.v!==1||claims.typ!=='usage'||claims.aud!==publicOrigin||!validLifetime(claims,seconds,1800)||typeof claims.id!=='string'||!sessionId.test(claims.id)||typeof claims.test!=='boolean'||claims.day!==Math.floor((claims.iat+9*3600)/86400))return admissionReply(401);
  if(claims.net!==await privateDigest(secret,'usage-network:'+claims.day+':'+peer))return admissionReply(401);
 }
 let event;try{event=await decodeUsageEvent(request);}catch{return admissionReply(400);}
 if(!event||typeof event!=='object'||Array.isArray(event))return admissionReply(400);
 if(mint){
  if(typeof event.test!=='boolean')return admissionReply(400);
  const day=Math.floor((seconds+9*3600)/86400);
  claims={v:1,typ:'usage',aud:publicOrigin,id:crypto.randomUUID(),test:event.test,day,net:await privateDigest(secret,'usage-network:'+day+':'+peer),iat:seconds,exp:seconds+1800};
  if(!permit('mint:'+claims.net,12,now))return admissionReply(429);
  try{await db.batch([guard(db,claims,'mint',0,now,crypto.randomUUID())]);}catch(error){return admissionReply(/usage_quota/.test(String(error))?429:503);}
  return admissionReply(200,{id:claims.id,test:claims.test,token:await signToken(secret,claims),expiresAt:claims.exp*1000});
 }
 if(event.id!==claims.id||event.test!==claims.test)return admissionReply(400);
 if(event.type!=='view'&&event.type!=='start')return admissionReply(400);
 if(event.type==='view'&&(!knownPages.has(event.path)||!channels.has(event.source)||!Number.isSafeInteger(event.seq)||event.seq<1||event.seq>500))return admissionReply(400);
 if(!permit('event-network:'+claims.net,240,now)||!permit('event-session:'+claims.id,60,now))return admissionReply(429);
 const day=new Date(now+9*3600_000).toISOString().slice(0,10),test=Number(claims.test),nonce=crypto.randomUUID(),gate=event.type+':'+claims.id+':'+(event.type==='view'?event.seq:0);
 try{
  const allowed=`EXISTS(SELECT 1 FROM vp_usage_guard WHERE id=? AND nonce=?)`;
  const operations=[guard(db,claims,event.type,event.type==='view'?event.seq:0,now,nonce)];
  if(event.type==='view'){
   operations.push(db.prepare(`INSERT OR IGNORE INTO vp_usage_session (id,test,landing_day,landing_path,source,seen_day,path)
     SELECT ?,?,?,?,?,?,? WHERE ${allowed}`).bind(claims.id,test,day,event.path,event.source,day,event.path,gate,nonce));
   operations.push(db.prepare(`UPDATE vp_usage_session SET view_seq=?,seen_day=?,path=? WHERE id=? AND test=? AND view_seq<? AND ${allowed}`).bind(event.seq,day,event.path,claims.id,test,event.seq,gate,nonce));
  }else operations.push(db.prepare(`UPDATE vp_usage_session SET started=1 WHERE id=? AND test=? AND started=0 AND ${allowed}`).bind(claims.id,test,gate,nonce));
  // Guard admission, quota updates and metrics commit atomically, including across isolates.
  await db.batch(operations);
 }catch(error){return admissionReply(/usage_quota/.test(String(error))?429:503);}
 return admissionReply(204);
}
}
export const handleUsage=createUsageHandler();

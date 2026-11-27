import {createServer} from 'node:http';
import net from 'node:net';
import {fileURLToPath} from 'node:url';
import {LeasePool} from './lease-pool.mjs';
import {createWorker} from './worker.mjs';
const uuid='[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}';
const sessionPath=new RegExp(`^/sessions/(${uuid})(/heartbeat)?$`);
const signalPath=new RegExp(`^/signal/(${uuid})/([A-Za-z0-9_-]{43})$`);
function httpsOrigin(value){const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||u.pathname!=='/'||u.search||u.hash)throw new Error('An HTTPS origin without a path or credentials is required');return u.origin;}
function pathname(req){try{return new URL(req.url,'http://localhost').pathname;}catch{return null;}}
export function createBroker({pool,origin,publicOrigin,trustProxy=false,now=Date.now}){
 origin=httpsOrigin(origin);publicOrigin=httpsOrigin(publicOrigin);
 const reply=(res,status,body={})=>{if(res.destroyed)return;res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'POST, DELETE, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization','Vary':'Origin'});res.end(JSON.stringify(body));};
 const requests=new Map();
 function clientAddress(req){
  const peer=req.socket.remoteAddress;
  // The shipped proxy connects over loopback and overwrites this header.
  // Never trust forwarding headers from other peers or guess an address in a chain.
  if(!trustProxy||!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(peer))return peer;
  const forwarded=req.headers['x-forwarded-for'];
  return typeof forwarded==='string'&&net.isIP(forwarded)?forwarded:null;
 }
 function permit(address){
  const time=now();let rate=requests.get(address);
  if(!rate||time-rate.at>=60000){
   if(requests.size>=4096){for(const [key,value] of requests)if(time-value.at>=60000)requests.delete(key);if(!requests.has(address)&&requests.size>=4096)return false;}
   rate={at:time,n:0};requests.set(address,rate);
  }
  return ++rate.n<=6;
 }
 const server=createServer({maxHeaderSize:8192},async(req,res)=>{
  req.resume();const path=pathname(req);if(path===null)return reply(res,400,{error:'path'});
  if(path==='/health'&&req.method==='GET')return reply(res,200,{status:pool.closing?'closing':'ready',capacity:pool.capacity,allocated:pool.leases.size});
  if(req.headers.origin!==origin)return reply(res,403,{error:'origin'});if(req.method==='OPTIONS')return reply(res,204);
  try{
   if(req.method==='POST'&&path==='/sessions'){
    const address=clientAddress(req);if(!address)return reply(res,400,{error:'client-address'});
    if(!permit(address))return reply(res,429,{error:'rate'});
    const abort=new AbortController(),closed=()=>{if(!res.writableFinished)abort.abort();};res.once('close',closed);
    try{
     const l=await pool.allocate({signal:abort.signal});
     if(abort.signal.aborted||res.destroyed){await pool.release(l.id);return;}
     return reply(res,201,{id:l.id,token:l.token,signallingUrl:`${publicOrigin.replace('https:','wss:')}/signal/${l.id}/${l.signalToken}`});
    }finally{res.removeListener('close',closed);}
   }
   const match=path.match(sessionPath),authorization=req.headers.authorization;
   const token=typeof authorization==='string'&&authorization.startsWith('Bearer ')?authorization.slice(7):'';
   const l=match&&pool.authenticate(match[1],token);if(!l)return reply(res,404,{error:'session'});
   if(req.method==='POST'&&match[2]){pool.heartbeat(l);return reply(res,200,{expiresInMs:pool.ttl});}
   if(req.method==='DELETE'&&!match[2]){await pool.release(l.id);return reply(res,204);}
   reply(res,405,{error:'method'});
  }catch(error){reply(res,error.status===503?503:502,{error:error.status===503?'capacity':'worker-unavailable'});}
 });
 server.on('upgrade',(req,socket,head)=>{
  // Tokens are private. Do not enable access logs containing /signal paths.
  const match=pathname(req)?.match(signalPath),key=req.headers['sec-websocket-key'];
  const validKey=typeof key==='string'&&/^[A-Za-z0-9+/]{22}==$/.test(key)&&Buffer.from(key,'base64').length===16;
  const connection=String(req.headers.connection||'').toLowerCase().split(',').map(x=>x.trim());
  const l=match&&req.headers.origin===origin&&pool.signal(match[1],match[2]);
  if(!l||req.headers.upgrade?.toLowerCase()!=='websocket'||!connection.includes('upgrade')||req.headers['sec-websocket-version']!=='13'||!validKey){socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');return;}
  l.socket=socket;const upstream=net.connect({host:'127.0.0.1',port:l.worker.playerPort});upstream.setTimeout(10000,()=>upstream.destroy());
  const cleanup=()=>{upstream.destroy();socket.destroy();if(l.socket===socket)l.socket=null;};
  socket.on('error',cleanup);upstream.on('error',cleanup);socket.on('close',cleanup);upstream.on('close',cleanup);
  upstream.once('connect',()=>{
   if(socket.destroyed||l.state!=='ready'){cleanup();return;}upstream.setTimeout(0);
   let headers=`GET / HTTP/1.1\r\nHost: 127.0.0.1:${l.worker.playerPort}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nOrigin: ${origin}\r\n`;
   for(const name of ['sec-websocket-key','sec-websocket-version','sec-websocket-protocol','sec-websocket-extensions'])if(req.headers[name])headers+=`${name}: ${req.headers[name]}\r\n`;
   upstream.write(headers+'\r\n');if(head.length)upstream.write(head);socket.pipe(upstream);upstream.pipe(socket);
  });
 });
 server.on('clientError',(_error,socket)=>socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n'));
 return server;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const origin=process.env.VALOPRAC_SITE_ORIGIN,publicOrigin=process.env.VALOPRAC_GPU_ORIGIN;
 if(!origin||!publicOrigin)throw new Error('Site and GPU origins must be explicitly configured');
 const worker=createWorker({engineLauncher:process.env.VALOPRAC_ENGINE_LAUNCHER||'',infraRoot:process.env.VALOPRAC_INFRA_ROOT||''});
 const onError=()=>console.error('GPU worker cleanup failed; capacity remains reserved');
 const pool=new LeasePool({worker,capacity:Number(process.env.VALOPRAC_CAPACITY||1),onError});
 const server=createBroker({pool,origin,publicOrigin,trustProxy:true});server.listen(4242,'127.0.0.1');
 const timer=setInterval(()=>void pool.reap().catch(onError),10000);timer.unref();let closing=false;
 const shutdown=async()=>{if(closing)return;closing=true;clearInterval(timer);const closed=new Promise(resolve=>server.close(resolve));server.closeIdleConnections();try{await pool.close();await closed;process.exitCode=0;}catch{onError();process.exitCode=1;}};
 process.on('SIGINT',()=>void shutdown());process.on('SIGTERM',()=>void shutdown());
}

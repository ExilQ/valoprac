import test from 'node:test';
import assert from 'node:assert/strict';
import {LeasePool} from './lease-pool.mjs';
import {createBroker} from './server.mjs';
const origin='https://valoprac.trade';
function setup(capacity=1){let stopped=0,time=0;const pool=new LeasePool({capacity,worker:{start:async()=>({playerPort:18080,stop:async()=>{stopped++;}})},now:()=>time});return {pool,stopped:()=>stopped,time:v=>{time=v;}};}
test('one lease per isolated slot and no second user controlling it',async()=>{const {pool}=setup();const l=await pool.allocate();assert.equal(l.slot,0);await assert.rejects(pool.allocate(),{status:503});assert.equal(pool.authenticate(l.id,'wrong'),null);assert.equal(pool.authenticate(l.id,l.token),l);assert.equal(pool.signal(l.id,l.signalToken),l);l.socket={destroy(){}};assert.equal(pool.signal(l.id,l.signalToken),null);await pool.close();});
test('simultaneous allocations reserve slots atomically',async()=>{let resolve;const pool=new LeasePool({worker:{start:()=>new Promise(r=>{resolve=r;})}});const first=pool.allocate();await assert.rejects(pool.allocate(),{status:503});resolve({stop:async()=>{}});await first;await pool.close();});
test('long free practice leases stay alive through heartbeat, without a hard duration cap',async()=>{const {pool,time}=setup();const l=await pool.allocate();for(let i=1;i<=10000;i++){time(i*20000);pool.heartbeat(l);await pool.reap();}assert.equal(pool.leases.size,1);await pool.close();});
test('expired and explicitly ended sessions release all workers',async()=>{const {pool,time,stopped}=setup();const l=await pool.allocate();time(90001);await pool.reap();assert.equal(stopped(),1);assert.equal(pool.leases.size,0);await pool.release(l.id);assert.equal(stopped(),1);});
test('failed worker startup does not poison capacity',async()=>{const pool=new LeasePool({worker:{start:async()=>{throw new Error('GPU missing');}}});await assert.rejects(pool.allocate());assert.equal(pool.leases.size,0);});
test('shutdown stops every independent worker',async()=>{const {pool,stopped}=setup(2);await pool.allocate();await pool.allocate();await pool.close();assert.equal(stopped(),2);await assert.rejects(pool.allocate(),{status:503});});
test('HTTP broker enforces origin, private tokens, heartbeat and deletion',async()=>{
 const {pool}=setup();const server=createBroker({pool,origin,publicOrigin:'https://gpu-staging.valoprac.trade'});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
 try{assert.equal((await fetch(base+'/sessions',{method:'POST'})).status,403);const response=await fetch(base+'/sessions',{method:'POST',headers:{Origin:origin}});assert.equal(response.status,201);const l=await response.json();assert(l.signallingUrl.startsWith('wss://gpu-staging.valoprac.trade/signal/'));assert.equal((await fetch(base+`/sessions/${l.id}/heartbeat`,{method:'POST',headers:{Origin:origin,Authorization:'Bearer wrong'}})).status,404);const headers={Origin:origin,Authorization:`Bearer ${l.token}`};assert.equal((await fetch(base+`/sessions/${l.id}/heartbeat`,{method:'POST',headers})).status,200);assert.equal((await fetch(base+`/sessions/${l.id}`,{method:'DELETE',headers})).status,204);assert.equal(pool.leases.size,0);}finally{await pool.close();await new Promise(r=>server.close(r));}
});

// Lifecycle fixtures exercise concurrency without pretending to run Unreal or WebRTC.
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
test('token comparison handles unequal UTF-8 byte lengths without throwing',async()=>{
 const {equal}=await import('./lease-pool.mjs');assert.equal(equal('é','a'),false);assert.equal(equal(null,''),false);assert.equal(equal('valid','valid'),true);
});
test('a cancelled startup keeps its slot until the late worker has actually stopped',async()=>{
 const started=deferred(),spawned=deferred(),stopped=deferred();let signal;
 const pool=new LeasePool({worker:{start:(_id,_slot,options)=>{signal=options.signal;started.resolve();return spawned.promise;}}});
 const first=pool.allocate(),rejected=assert.rejects(first,{name:'AbortError'});await started.promise;
 const id=[...pool.leases.keys()][0],release=pool.release(id);assert.equal(release,pool.release(id));assert(signal.aborted);
 await assert.rejects(pool.allocate(),{status:503});spawned.resolve({stop:()=>stopped.promise});await Promise.resolve();
 assert.equal(pool.leases.size,1);await assert.rejects(pool.allocate(),{status:503});
 stopped.resolve();await release;await rejected;assert.equal(pool.leases.size,0);
});
test('shutdown awaits a startup already in flight and never publishes it as ready',async()=>{
 const begun=deferred(),spawned=deferred(),stop=deferred();let n=0;
 const pool=new LeasePool({worker:{start:()=>{begun.resolve();return spawned.promise;}}});
 const allocating=pool.allocate(),rejected=assert.rejects(allocating);await begun.promise;
 let closed=false;const closing=pool.close().then(()=>{closed=true;});spawned.resolve({stop:()=>{n++;return stop.promise;}});
 await Promise.resolve();assert.equal(closed,false);assert.equal(pool.leases.size,1);stop.resolve();await closing;await rejected;assert.equal(n,1);
});
test('startup failure cleans its reservation and a failed stop quarantines the slot',async()=>{
 const pool=new LeasePool({worker:{start:async()=>({stop:async()=>{throw new Error('Cannot verify termination');}})}});
 const lease=await pool.allocate();await assert.rejects(pool.release(lease.id));assert.equal(pool.authenticate(lease.id,lease.token),null);
 assert.equal(pool.leases.size,1);await assert.rejects(pool.allocate(),{status:503});assert.equal(pool.heartbeat(lease),false);
});
test('a worker exit immediately revokes control and runs the same cleanup promise',async()=>{
 let exit,stops=0;const pool=new LeasePool({worker:{start:async(_id,_slot,o)=>{exit=o.onExit;return {stop:async()=>{stops++;}};}}});
 const l=await pool.allocate();exit();assert.equal(pool.authenticate(l.id,l.token),null);await pool.release(l.id);assert.equal(stops,1);assert.equal(pool.leases.size,0);
});
test('HTTP cancellation aborts startup and releases its reserved worker',async()=>{
 const {request}=await import('node:http');const begun=deferred(),cancelled=deferred();let aborted=false;
 const pool=new LeasePool({worker:{start:async(_id,_slot,{signal})=>{begun.resolve();await new Promise((_ok,fail)=>signal.addEventListener('abort',()=>{aborted=true;cancelled.resolve();fail(new Error('cancelled'));},{once:true}));}}});
 const server=createBroker({pool,origin,publicOrigin:'https://gpu-staging.valoprac.trade'});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{const req=request({hostname:'127.0.0.1',port:server.address().port,path:'/sessions',method:'POST',headers:{Origin:origin}});req.on('error',()=>{});req.end();await begun.promise;req.destroy();await cancelled.promise;await pool.close();assert(aborted);assert.equal(pool.leases.size,0);}finally{await pool.close();await new Promise(r=>server.close(r));}
});
test('direct clients cannot bypass allocation rate limits using forwarded headers',async()=>{
 const {pool}=setup();const server=createBroker({pool,origin,publicOrigin:'https://gpu-staging.valoprac.trade'});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
 try{for(let i=0;i<6;i++){const response=await fetch(base+'/sessions',{method:'POST',headers:{Origin:origin,'X-Forwarded-For':String(i)}});assert.equal(response.status,201);const l=await response.json();await pool.release(l.id);}assert.equal((await fetch(base+'/sessions',{method:'POST',headers:{Origin:origin,'X-Forwarded-For':'new-address'}})).status,429);}finally{await pool.close();await new Promise(r=>server.close(r));}
});
test('signalling upgrade validates tokens, proxies bytes and excludes private path tokens upstream',async()=>{
 const net=await import('node:net');const {createServer}=await import('node:http');const {createHash}=await import('node:crypto');const upgraded=deferred();let requestPath;
 const upstream=createServer();upstream.on('upgrade',(req,socket,head)=>{requestPath=req.url;const accept=createHash('sha1').update(req.headers['sec-websocket-key']+'258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);if(head.length)socket.write(head);socket.on('data',data=>socket.write(data));socket.on('end',()=>socket.destroy());socket.on('error',()=>{});upgraded.resolve();});await new Promise(r=>upstream.listen(0,'127.0.0.1',r));
 const pool=new LeasePool({worker:{start:async()=>({playerPort:upstream.address().port,stop:async()=>{}})}}),lease=await pool.allocate();
 const server=createBroker({pool,origin,publicOrigin:'https://gpu-staging.valoprac.trade'});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const connect=path=>new Promise((resolve,reject)=>{const client=net.connect(server.address().port,'127.0.0.1',()=>client.write(`GET ${path} HTTP/1.1\r\nHost: localhost\r\nOrigin: ${origin}\r\nConnection: Upgrade\r\nUpgrade: websocket\r\nSec-WebSocket-Version: 13\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n\r\n`));client.once('data',data=>resolve({client,data}));client.once('error',reject);});
 let client;
 try{
  const denied=await connect(`/signal/${lease.id}/${'a'.repeat(43)}`);assert.match(denied.data.toString(),/403/);denied.client.destroy();
  const allowed=await connect(`/signal/${lease.id}/${lease.signalToken}`);client=allowed.client;await upgraded.promise;assert.match(allowed.data.toString(),/101/);assert.equal(requestPath,'/');
  const second=await connect(`/signal/${lease.id}/${lease.signalToken}`);assert.match(second.data.toString(),/403/);second.client.destroy();
  const echo=new Promise(resolve=>client.once('data',resolve));const frame=Buffer.from([0x82,0x82,1,2,3,4,0x69,0x6b]);client.write(frame);assert.deepEqual(await echo,frame);
  await pool.release(lease.id);assert.equal(pool.leases.size,0);
 }finally{client?.destroy();await pool.close();await new Promise(r=>server.close(r));await new Promise(r=>upstream.close(r));}
});

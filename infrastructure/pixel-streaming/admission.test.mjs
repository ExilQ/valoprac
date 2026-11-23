import test from 'node:test';
import assert from 'node:assert/strict';
import {createBroker} from './server.mjs';
import {LeasePool} from './lease-pool.mjs';
import {createAllocationAdmission} from './admission.mjs';
import {signToken,privateDigest} from '../../security/tokens.mjs';
const origin='https://valoprac.trade',audience='https://gpu-staging.valoprac.trade',secret='test-only-gpu-grant-not-a-live-secret-1234567890';
async function setup(admitted=true){
 let starts=0,now=Date.UTC(2026,10,17,12);
 const pool=new LeasePool({capacity:2,now:()=>now,worker:{start:async()=>{starts++;return{playerPort:18080,stop:async()=>{}};}}});
 const admission=admitted?createAllocationAdmission({secret,audience,now:()=>now}):undefined;
 const server=createBroker({pool,origin,publicOrigin:audience,admission,now:()=>now});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const allocate=token=>fetch('http://127.0.0.1:'+server.address().port+'/sessions',{method:'POST',headers:{Origin:origin,...(token?{Authorization:'Bearer '+token}:{})}});
 const claims=async(subject='fixture',patch={})=>{const at=Math.floor(now/1000);return{v:1,typ:'gpu-allocation',aud:audience,sub:await privateDigest(secret,subject),jti:crypto.randomUUID(),iat:at,exp:at+60,...patch};};
 const token=async(subject,patch)=>signToken(secret,await claims(subject,patch));
 const heartbeat=(id,leaseToken,grant)=>fetch('http://127.0.0.1:'+server.address().port+'/sessions/'+id+'/heartbeat',{method:'POST',headers:{Origin:origin,Authorization:'Bearer '+leaseToken,...(grant?{'X-Valoprac-Grant':grant}:{})}});
 return{pool,allocate,token,claims,heartbeat,get starts(){return starts;},advance(ms){now+=ms;},close:async()=>{await pool.close();await new Promise(r=>server.close(r));}};
}
test('forging Origin alone cannot spawn a GPU, including when admission is unconfigured',async()=>{
 const closed=await setup(false);try{assert.equal((await closed.allocate()).status,503);assert.equal(closed.starts,0);}finally{await closed.close();}
 const f=await setup();try{assert.equal((await f.allocate()).status,401);assert.equal((await f.allocate('forged.token')).status,401);assert.equal(f.starts,0);}finally{await f.close();}
});
test('wrong audience, purpose, MAC and expired grants fail before starting a worker',async()=>{
 const f=await setup();try{
  const good=await f.token();const bad=good.slice(0,-4)+'AAAA';
  for(const token of [bad,await f.token('fixture',{aud:'https://evil.example'}),await f.token('fixture',{typ:'usage'}),await f.token('fixture',{exp:1})])assert.equal((await f.allocate(token)).status,401);
  f.advance(61000);assert.equal((await f.allocate(good)).status,401);assert.equal(f.starts,0);
 }finally{await f.close();}
});
test('a signed grant is one-use even for concurrent requests and after a lease is released',async()=>{
 const f=await setup();try{
  const token=await f.token(),responses=await Promise.all([f.allocate(token),f.allocate(token)]);assert.deepEqual(responses.map(r=>r.status).sort(),[201,401]);assert.equal(f.starts,1);
  const lease=await responses.find(r=>r.status===201).json();await f.pool.release(lease.id);assert.equal((await f.allocate(token)).status,401);
  assert.equal((await f.allocate(await f.token())).status,201);
 }finally{await f.close();}
});
test('one approved subject cannot occupy multiple slots while another approved subject can connect',async()=>{
 const f=await setup();try{
  const first=await f.allocate(await f.token('one'));assert.equal(first.status,201);
  assert.equal((await f.allocate(await f.token('one'))).status,429);
  assert.equal((await f.allocate(await f.token('two'))).status,201);assert.equal(f.starts,2);
  await f.pool.release((await first.json()).id);assert.equal((await f.allocate(await f.token('one'))).status,201);
 }finally{await f.close();}
});

test('bearer-only heartbeats cannot extend authorization, while a fresh same-subject grant can renew it',async()=>{
 const f=await setup();try{
  const lease=await (await f.allocate(await f.token('one'))).json();
  for(let i=0;i<14;i++){f.advance(60000);assert.equal((await f.heartbeat(lease.id,lease.token)).status,200);}
  assert.equal((await f.heartbeat(lease.id,lease.token,await f.token('two'))).status,401);
  assert.equal((await f.heartbeat(lease.id,lease.token,await f.token('one'))).status,200);
  for(let i=0;i<14;i++){f.advance(60000);assert.equal((await f.heartbeat(lease.id,lease.token)).status,200);}
  f.advance(60000);assert.equal((await f.heartbeat(lease.id,lease.token)).status,404);await f.pool.reap();assert.equal(f.pool.leases.size,0);
 }finally{await f.close();}
});

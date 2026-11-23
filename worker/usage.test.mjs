import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {handleUsage,createUsageHandler} from './usage.js';
import {signToken} from '../security/tokens.mjs';
const origin='https://valoprac.trade',secret='test-only-not-a-live-admission-key-1234567890';
function setup(){
 const sql=new DatabaseSync(':memory:');for(const name of ['0000_visitor_metrics','0001_usage_admission'])sql.exec(readFileSync(new URL('../drizzle/'+name+'.sql',import.meta.url),'utf8'));
 let handler=createUsageHandler();
 let now=Date.UTC(2026,10,17,10),calls=0,fail=false;
 const db={
  prepare(query){return {bind(...args){return {run(){calls++;if(fail&&query.includes('UPDATE vp_usage_session'))throw Error('fixture write failure');return sql.prepare(query).run(...args);}};}};},
  async batch(ops){sql.exec('BEGIN');try{const results=ops.map(op=>op.run());sql.exec('COMMIT');return results;}catch(error){sql.exec('ROLLBACK');throw error;}}
 };
 const env={DB:db,VALOPRAC_USAGE_SECRET:secret};
 const request=(path,event,token,headers={})=>new Request(origin+path,{method:'POST',headers:{origin,'content-type':'application/json','sec-fetch-site':'same-origin','cf-connecting-ip':'203.0.113.1',...(token?{authorization:'Bearer '+token}:{}),...headers},body:JSON.stringify(event)});
 const raw=(path,event,token,headers={})=>handler(request(path,event,token,headers),env,now);
 const mint=async(test=true,headers={})=>{const res=await raw('/api/usage/session',{test},null,headers);return{status:res.status,...(res.ok?await res.json():{})};};
 const send=(grant,event,headers={})=>raw('/api/usage',{id:grant.id,test:grant.test,...event},grant.token,headers);
 return{sql,env,raw,mint,send,request,resetHandler(){handler=createUsageHandler();},get calls(){return calls;},reset(){calls=0;},advance(ms){now+=ms;},failWrites(value){fail=value;},day:()=>Math.floor((now/1000+9*3600)/86400)};
}
const view=(seq=1,path='/')=>({type:'view',path,source:'unknown',seq});
test('ten admitted visits yield five starts, retaining reload/retry deduplication',async()=>{
 const f=setup();for(let i=0;i<10;i++){const grant=await f.mint();assert.equal(grant.status,200);const first={...view(),source:i===0?'google':'unknown'};assert.equal((await f.send(grant,first)).status,204);await f.send(grant,first);if(i<5){await f.send(grant,view(2,'/training'));await f.send(grant,{type:'start'});await f.send(grant,{type:'start'});await f.send(grant,first);}}
 assert.deepEqual(f.sql.prepare('SELECT metric,item,total FROM vp_usage_day WHERE test=1 ORDER BY metric,item').all().map(Object.values),[['landing','/',10],['pageview','/',10],['pageview','/training',5],['source','google',1],['source','unknown',9],['training_start','/',5],['visit','*',10]]);
 assert.equal(f.sql.prepare('SELECT count(*) n FROM vp_usage_day WHERE test=0').get().n,0);
});
test('the original unsigned UUID attack, forged token and privacy opt-out never access D1',async()=>{
 const f=setup(),event={id:crypto.randomUUID(),test:false,...view()};
 assert.equal((await f.raw('/api/usage',event)).status,401);
 assert.equal((await f.raw('/api/usage',event,'forged.token')).status,401);
 assert.equal((await f.raw('/api/usage',event,null,{origin:'https://evil.example'})).status,403);
 assert.equal((await f.raw('/api/usage',event,null,{'sec-fetch-site':''})).status,403);
 assert.equal((await f.raw('/api/usage',event,null,{'sec-gpc':'1'})).status,204);
 assert.equal((await f.raw('/api/usage',event,null,{dnt:'1'})).status,204);assert.equal(f.calls,0);
});
test('signed sessions bind the ID, test partition, network, purpose and absolute expiry',async()=>{
 const f=setup(),g=await f.mint();f.reset();
 assert.equal((await f.send(g,{...view(),id:crypto.randomUUID()})).status,400);
 assert.equal((await f.send(g,{...view(),test:false})).status,400);
 assert.equal((await f.send(g,view(),{'cf-connecting-ip':'198.51.100.2'})).status,401);
 const bad={...g,token:g.token.slice(0,-4)+'AAAA'};assert.equal((await f.send(bad,view())).status,401);
 const payload=JSON.parse(Buffer.from(g.token.split('.')[0],'base64url').toString());
 const wrong={...g,token:await signToken(secret,{...payload,typ:'gpu-allocation'})};assert.equal((await f.send(wrong,view())).status,401);
 f.advance(1800001);assert.equal((await f.send(g,view())).status,401);assert.equal(f.calls,0);
});
test('session mint quotas persist across requests, and IPv6 /64 aliases cannot reset them',async()=>{
 const f=setup();for(let i=0;i<12;i++)assert.equal((await f.mint()).status,200);
 f.resetHandler();assert.equal((await f.mint()).status,429);assert.equal((await f.mint(true,{'cf-connecting-ip':'198.51.100.2'})).status,200);
 const v6=setup();for(let i=1;i<=12;i++)assert.equal((await v6.mint(true,{'cf-connecting-ip':'2001:db8:0:1::'+i.toString(16)})).status,200);
 assert.equal((await v6.mint(true,{'cf-connecting-ip':'2001:0db8:0000:0001:0:0:0:ff'})).status,429);
});
test('per-session and per-network event quotas bound writes even with valid grants',async()=>{
 const f=setup(),grants=[];for(let i=0;i<5;i++)grants.push(await f.mint());
 for(let j=0;j<4;j++)for(let seq=1;seq<=60;seq++)assert.equal((await f.send(grants[j],view(seq))).status,204);
 f.resetHandler();assert.equal((await f.send(grants[0],view(61))).status,429);
 f.resetHandler();assert.equal((await f.send(grants[4],view())).status,429);
 assert.equal(f.sql.prepare('SELECT count(*) n FROM vp_usage_session').get().n,4);
 assert.equal(f.sql.prepare("SELECT count(*) n FROM vp_usage_guard WHERE kind!='mint'").get().n,240);
});
test('global daily guard fails closed without creating attacker-selected rows',async()=>{
 const f=setup(),g=await f.mint();f.sql.prepare("UPDATE vp_usage_budget SET total=20000 WHERE kind='all'").run();
 assert.equal((await f.send(g,view())).status,429);
 assert.equal((await f.mint(true,{'cf-connecting-ip':'198.51.100.22'})).status,429);
 assert.equal(f.sql.prepare('SELECT count(*) n FROM vp_usage_guard').get().n,1);
 assert.equal(f.sql.prepare('SELECT count(*) n FROM vp_usage_session').get().n,0);
});
test('a duplicate sequence cannot change its path and a failed metrics write rolls back admission',async()=>{
 const f=setup(),g=await f.mint();f.failWrites(true);assert.equal((await f.send(g,view())).status,503);
 assert.equal(f.sql.prepare("SELECT count(*) n FROM vp_usage_guard WHERE kind='view'").get().n,0);
 assert.equal(f.sql.prepare('SELECT count(*) n FROM vp_usage_session').get().n,0);
 f.failWrites(false);assert.equal((await f.send(g,view())).status,204);assert.equal((await f.send(g,view(1,'/training'))).status,204);
 assert.equal(f.sql.prepare("SELECT count(*) n FROM vp_usage_day WHERE metric='pageview' AND item='/training'").get().n,0);
});
test('payload bounds, enumeration checks and missing secrets fail before metric writes',async()=>{
 const f=setup(),g=await f.mint();f.reset();
 assert.equal((await f.send(g,{...view(),source:'https://evil.example/sql'})).status,400);
 assert.equal((await f.send(g,view(1,'/private'))).status,400);
 assert.equal((await f.send(g,{...view(),extra:'x'.repeat(600)})).status,400);assert.equal(f.calls,0);
 assert.equal((await handleUsage(f.request('/api/usage',view()),{DB:f.env.DB})).status,503);
 const empty=setup(),other=await empty.mint();assert.equal((await empty.send(other,{type:'start'})).status,204);
 assert.equal(empty.sql.prepare('SELECT count(*) n FROM vp_usage_day').get().n,0);
});

test('replaying an admitted event is throttled before D1 access without duplicating its metrics',async()=>{
 const f=setup(),g=await f.mint();for(let i=0;i<60;i++)assert.equal((await f.send(g,view())).status,204);
 f.reset();assert.equal((await f.send(g,view())).status,429);assert.equal(f.calls,0);
 assert.equal(f.sql.prepare("SELECT total FROM vp_usage_day WHERE metric='pageview'").get().total,1);
});

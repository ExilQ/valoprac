import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,chmodSync,readFileSync,existsSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {createWorker} from './worker.mjs';
async function until(check){for(let i=0;i<200;i++){if(check())return;await delay(10);}throw new Error('Fixture deadline exceeded');}
function fixture(kind='ready'){
 const root=mkdtempSync(resolve(tmpdir(),'valoprac-process-fixture-')),pids=resolve(root,'pids');mkdirSync(resolve(root,'SignallingWebServer/dist'),{recursive:true});
 const header="const fs=require('node:fs');fs.appendFileSync(process.env.FIXTURE_PIDS,process.pid+'\\n');";
 writeFileSync(resolve(root,'SignallingWebServer/dist/index.js'),header+"fs.writeFileSync(process.env.FIXTURE_PEER_PATH,process.argv.at(-1));setInterval(()=>{},1000);");
 const engine=resolve(root,'engine'),ready=resolve(root,'ready');writeFileSync(engine,'#!/usr/bin/env node\n'+header+"setInterval(()=>{},1000);");chmodSync(engine,0o755);
 const body=kind==='ready'?"setTimeout(()=>process.exit(0),150);":kind==='fail'?"setTimeout(()=>process.exit(1),150);":"setInterval(()=>{},1000);";
 writeFileSync(ready,'#!/usr/bin/env node\n'+header+body);chmodSync(ready,0o755);
 const peerPath=resolve(root,'peer-path'),env={...process.env,FIXTURE_PIDS:pids,FIXTURE_PEER_PATH:peerPath,VALOPRAC_PEER_OPTIONS:'{"iceServers":[]}',VALOPRAC_READY_CHECK:ready};
 const worker=createWorker({engineLauncher:engine,infraRoot:root,env,terminateGraceMs:30,readinessTimeoutMs:kind==='timeout'?500:3000});
 const ids=()=>existsSync(pids)?readFileSync(pids,'utf8').trim().split('\n').map(Number):[];
 const alive=id=>{try{process.kill(id,0);return true;}catch{return false;}};
 return {root,worker,ids,alive,peerPath,cleanup:()=>rmSync(root,{recursive:true,force:true})};
}
// Actual Node child processes exercise Linux process-group teardown; these are not UE binaries.
test('worker stop is awaitable and idempotent, removing children and private ICE files',async()=>{
 const f=fixture();try{const worker=await f.worker.start('fixture',0);assert.equal(worker.playerPort,18080);const peer=readFileSync(f.peerPath,'utf8');assert(existsSync(peer));const first=worker.stop();assert.equal(first,worker.stop());await first;assert.equal(existsSync(peer),false);for(const pid of f.ids())assert.equal(f.alive(pid),false);}finally{f.cleanup();}
});
test('cancellation terminates the pending readiness probe and both application processes',async()=>{
 const f=fixture('pending'),abort=new AbortController();try{const starting=f.worker.start('fixture',0,{signal:abort.signal});const rejected=assert.rejects(starting,{name:'AbortError'});await until(()=>f.ids().length===3);abort.abort();await rejected;for(const pid of f.ids())assert.equal(f.alive(pid),false);assert.equal(existsSync(readFileSync(f.peerPath,'utf8')),false);}finally{f.cleanup();}
});
test('failed readiness releases every partially started process',async()=>{
 const f=fixture('fail');try{await assert.rejects(f.worker.start('fixture',0),/did not become ready/);for(const pid of f.ids())assert.equal(f.alive(pid),false);}finally{f.cleanup();}
});
test('readiness timeout terminates the probe instead of leaving an unmanaged child',async()=>{
 const f=fixture('timeout');try{await assert.rejects(f.worker.start('fixture',0),/timed out/);for(const pid of f.ids())assert.equal(f.alive(pid),false);}finally{f.cleanup();}
});
test('post-readiness worker death notifies the pool and stops remaining processes',async()=>{
 const f=fixture();let exits=0,worker;try{worker=await f.worker.start('fixture',1,{onExit:()=>{exits++;}});const pids=f.ids();
  // Append order is not launch order: the already-finished readiness probe may be first.
  const victim=pids.find(f.alive);assert(victim,'A live application process must exist');process.kill(victim,'SIGTERM');await until(()=>exits===1);await worker.stop();for(const pid of pids)assert.equal(f.alive(pid),false);assert.equal(exits,1);
 }finally{await worker?.stop();f.cleanup();}
});

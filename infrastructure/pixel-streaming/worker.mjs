import {spawn} from 'node:child_process';
import {existsSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
const aborted=()=>Object.assign(new Error('GPU startup cancelled'),{name:'AbortError'});
// Linux process groups include the packaged launcher, its Unreal child, and readiness probes.
export function createWorker({engineLauncher,infraRoot,width=1920,height=1080,env=process.env,terminateGraceMs=250,readinessTimeoutMs=60000}){
 const signalling=resolve(infraRoot,'SignallingWebServer/dist/index.js');
 if(!existsSync(engineLauncher)||!existsSync(signalling))throw new Error('Built UE launcher and built official signalling server are required');
 return {async start(id,slot,{signal,onExit=()=>{}}={}){
  if(signal?.aborted)throw aborted();
  const playerPort=18080+slot,streamerPort=18880+slot,sfuPort=19880+slot;
  const temp=mkdtempSync(resolve(tmpdir(),'valoprac-ice-')),processes=[];
  let stopping=false,stopPromise=null,failed=null,cancelReady=()=>{},readyTimer;
  const kill=kind=>{for(const {child} of processes)if(child.pid)try{process.kill(-child.pid,kind);}catch{/* An already empty group needs no signal. */}};
  const stop=()=>{
   if(stopPromise)return stopPromise;
   stopping=true;cancelReady(aborted());clearTimeout(readyTimer);signal?.removeEventListener('abort',cancel);
   stopPromise=(async()=>{
    kill('SIGTERM');await new Promise(r=>setTimeout(r,terminateGraceMs));
    // Kill groups even if their launcher exited before a descendant did.
    kill('SIGKILL');await Promise.all(processes.map(p=>p.closed));
    rmSync(temp,{recursive:true,force:true});
   })();
   return stopPromise;
  };
  const cancel=()=>{void stop();};
  const invalidate=error=>{if(stopping)return;failed=error;cancelReady(error);onExit(error);void stop();};
  const launch=(cmd,args,required=true)=>{
   const child=spawn(cmd,args,{env:{...env,VALOPRAC_SESSION_ID:id},stdio:required?['ignore','inherit','inherit']:'ignore',detached:true});
   const closed=new Promise(resolve=>child.once('close',resolve));processes.push({child,closed});
   child.once('error',error=>invalidate(error));
   if(required)child.once('exit',()=>invalidate(new Error('GPU worker process exited')));
   return child;
  };
  signal?.addEventListener('abort',cancel,{once:true});
  try{
   const peerOptions=env.VALOPRAC_PEER_OPTIONS,readiness=env.VALOPRAC_READY_CHECK;
   if(!peerOptions)throw new Error('Explicit STUN/TURN peer options required');JSON.parse(peerOptions);
   if(!readiness||!existsSync(readiness))throw new Error('A tested streamer readiness executable is required');
   const peerFile=resolve(temp,'peer-options.json');writeFileSync(peerFile,peerOptions,{mode:0o600});
   launch(process.execPath,[signalling,'--player_port',String(playerPort),'--streamer_port',String(streamerPort),'--sfu_port',String(sfuPort),'--max_players','1','--peer_options_file',peerFile]);
   launch(engineLauncher,['-RenderOffscreen','-AudioMixer','-Unattended',`-ResX=${width}`,`-ResY=${height}`,'-ForceRes','-NoVSync',`-PixelStreaming2URL=ws://127.0.0.1:${streamerPort}`,`-PixelStreaming2ID=${id}`]);
   // A successful probe must verify a registered Unreal streamer, not just an open port.
   await new Promise((ok,fail)=>{
    let settled=false;const finish=error=>{if(settled)return;settled=true;clearTimeout(readyTimer);error?fail(error):ok();};
    cancelReady=finish;const probe=launch(readiness,[String(playerPort),id],false);
    probe.once('error',finish);probe.once('exit',code=>finish(code===0?null:new Error('Unreal streamer did not become ready')));
    readyTimer=setTimeout(()=>{finish(new Error('Unreal streamer readiness timed out'));void stop();},readinessTimeoutMs);
    if(stopping)finish(failed||aborted());
   });
   if(stopping||signal?.aborted||failed)throw failed||aborted();
   return {playerPort,stop};
  }catch(error){await stop();throw error;}
 }};
}

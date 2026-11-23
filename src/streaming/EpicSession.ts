import {Config,Flags,NumericParameters,PixelStreaming,TextParameters} from '@epicgames-ps/lib-pixelstreamingfrontend-ue5.7';
import type {Settings,Mode,WeaponId,SessionData} from '../engine/types';
import type {EngineState,CommandKind} from './protocol';
import {StreamingController} from './StreamingController';
import {StreamDiagnostics,type StreamMetrics} from './diagnostics';
import {validateSignalUrl,type StreamingConfig} from './config';
interface Lease {id:string;token:string;signallingUrl:string;}
interface Initial {settings:Settings;mode:Mode;weapon:WeaponId;}
interface Callbacks {state:(s:EngineState)=>void;status:(s:string)=>void;ready:(ready:boolean)=>void;metrics:(s:StreamMetrics)=>void;error:(s:string)=>void;finished:(s:SessionData)=>void;}
class ManagedPixelStreaming extends PixelStreaming {
 inputs(enabled:boolean){this.config.setFlagEnabled(Flags.KeyboardInput,enabled);this.config.setFlagEnabled(Flags.MouseInput,enabled);}
 dispose(){this.inputs(false);try{this.disconnect();}finally{this._webRtcController.videoPlayer.destroy();}}
}
export class EpicSession {
 readonly controller:StreamingController;private stream:ManagedPixelStreaming;private diagnostics=new StreamDiagnostics();private heartbeat=0;private watchdog=0;private disposed=false;
 private constructor(private config:StreamingConfig,private lease:Lease,host:HTMLElement,initial:Initial,private callbacks:Callbacks){
  const c=new Config({useUrlParams:false,initialSettings:{[TextParameters.SignallingServerUrl]:validateSignalUrl(lease.signallingUrl,config),[Flags.AutoConnect]:false,[Flags.AutoPlayVideo]:true,[Flags.StartVideoMuted]:false,[Flags.HoveringMouseMode]:false,[Flags.MouseInput]:false,[Flags.KeyboardInput]:false,[Flags.TouchInput]:false,[Flags.GamepadInput]:false,[Flags.UseMic]:false,[Flags.UseCamera]:false,[Flags.WaitForStreamer]:true,[Flags.MatchViewportResolution]:false,[Flags.AFKDetection]:false,[NumericParameters.MaxReconnectAttempts]:0}});
  this.stream=new ManagedPixelStreaming(c,{videoElementParent:host});
  this.controller=new StreamingController(lease.id,initial.settings,initial.mode,initial.weapon,command=>this.stream.emitUIInteraction(command),{
   state:callbacks.state,input:enabled=>this.stream.inputs(enabled),ready:callbacks.ready,error:callbacks.error,finished:callbacks.finished
  });
  this.stream.addResponseEventListener('valoprac',raw=>{if(!this.disposed)this.controller.receive(raw);});
  this.stream.addEventListener('videoInitialized',()=>{if(!this.disposed){callbacks.status('영상 연결됨 · 엔진 응답 확인 중');this.controller.videoReady();}});
  this.stream.addEventListener('dataChannelOpen',e=>{if(!this.disposed&&e.data.label!=='recv-datachannel')this.controller.channelReady();});
  this.stream.addEventListener('webRtcConnected',()=>{if(!this.disposed)callbacks.status('GPU 스트림 연결됨');});
  this.stream.addEventListener('webRtcFailed',()=>{if(!this.disposed){this.controller.transportLost();callbacks.error('GPU 영상 연결에 실패했습니다. 브라우저 훈련은 계속 사용할 수 있습니다.');}});
  this.stream.addEventListener('webRtcDisconnected',()=>{if(!this.disposed){this.controller.transportLost();callbacks.status('연결 중단 · 다시 연결할 수 있습니다');}});
  this.stream.addEventListener('dataChannelClose',()=>{if(!this.disposed)this.controller.transportLost();});
  this.stream.addEventListener('statsReceived',e=>{if(!this.disposed)callbacks.metrics(this.diagnostics.ingest({inboundVideoStats:e.data.aggregatedStats.inboundVideoStats as unknown as Record<string,unknown>,getActiveCandidatePair:()=>e.data.aggregatedStats.getActiveCandidatePair()}));});
  this.stream.addEventListener('latencyTestResult',e=>{if(!this.disposed)callbacks.metrics(this.diagnostics.encode(e.data.latencyTimings.EncodeMs));});
  this.heartbeat=window.setInterval(()=>{void this.request('POST',`/sessions/${lease.id}/heartbeat`).catch(()=>{if(!this.disposed){this.controller.transportLost();callbacks.error('GPU 세션 유지에 실패했습니다. 연결을 확인하세요.');}});},20000);
  this.watchdog=window.setInterval(()=>this.controller.tick(),250);
  try{this.stream.connect();}catch(error){this.dispose();throw error;}
 }
 static async connect(config:StreamingConfig,host:HTMLElement,initial:Initial,callbacks:Callbacks,signal:AbortSignal){
  if(!config.enabled||!config.allocatorUrl)throw new Error('GPU 실행 환경이 아직 연결되지 않았습니다.');
  const base=config.allocatorUrl.replace(/\/$/,'');
  const res=await fetch(`${base}/sessions`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}',signal,credentials:'omit'});
  if(!res.ok)throw new Error(res.status===503?'사용 가능한 독립 GPU 세션이 없습니다.':'GPU 세션을 시작하지 못했습니다.');
  const lease=await res.json() as Lease;
  if(!lease||typeof lease.id!=='string'||!/^[a-f0-9-]{36}$/.test(lease.id)||typeof lease.token!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(lease.token))throw new Error('GPU 세션 응답이 올바르지 않습니다.');
  const release=()=>fetch(`${base}/sessions/${lease.id}`,{method:'DELETE',headers:{Authorization:`Bearer ${lease.token}`},keepalive:true}).catch(()=>{});
  if(signal.aborted){void release();throw new DOMException('Cancelled','AbortError');}
  try{return new EpicSession({...config,allocatorUrl:base},lease,host,initial,callbacks);}catch(error){void release();throw error;}
 }
 private async request(method:string,path:string){const r=await fetch(`${this.config.allocatorUrl}${path}`,{method,headers:{Authorization:`Bearer ${this.lease.token}`},keepalive:method==='DELETE',signal:AbortSignal.timeout(10000),credentials:'omit'});if(!r.ok)throw new Error('GPU 세션 응답 오류');}
 configure(settings:Settings,mode:Mode){this.controller.configure(settings,mode);}
 selectWeapon(weapon:WeaponId){this.controller.selectWeapon(weapon);}
 command(type:CommandKind,payload:Record<string,unknown>={}){return this.controller.command(type,payload);}
 resume(captured:boolean){if(!this.controller.resume(captured))return false;this.stream.play();return true;}
 pause(){this.controller.pause();}
 finish(){return this.controller.finish();}
 partial(){return this.controller.partial();}
 reconnect(){this.controller.pause();this.controller.transportLost();this.stream.reconnect();}
 latencyTest(){if(this.controller.isReady)this.stream.requestLatencyTest();}
 dispose(){if(this.disposed)return;this.disposed=true;this.controller.dispose();window.clearInterval(this.heartbeat);window.clearInterval(this.watchdog);this.stream.removeResponseEventListener('valoprac');try{this.stream.dispose();}finally{void this.request('DELETE',`/sessions/${this.lease.id}`).catch(()=>{});}}
}

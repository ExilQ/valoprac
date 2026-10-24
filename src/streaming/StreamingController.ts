import type {Settings,Mode,WeaponId,SessionData} from '../engine/types';
import {ProtocolClient,settingsPayload,type Command,type EngineState,type CommandKind} from './protocol';
import {SessionRecorder} from './SessionRecorder';
export interface ControllerCallbacks {state:(s:EngineState)=>void;input:(enabled:boolean)=>void;ready:(ready:boolean)=>void;error:(message:string)=>void;finished:(session:SessionData)=>void;}
// The controller owns readiness, command coalescing and input admission. It never fires a weapon.
export class StreamingController {
 readonly protocol:ProtocolClient;readonly recorder:SessionRecorder;
 private video=false;private channel=false;private ready=false;private captured=false;private wantsRunning=false;private closed=false;private helloSeq:number|null=null;private pingAt=0;private lastState:EngineState|null=null;private savedEpoch=-1;
 private desiredSettings:Settings;private desiredMode:Mode;private desiredWeapon:WeaponId;private appliedConfig='';private appliedWeapon:WeaponId|null=null;
 constructor(session:string,settings:Settings,mode:Mode,weapon:WeaponId,send:(c:Command)=>void,private cb:ControllerCallbacks,private now=()=>performance.now()){
  this.desiredSettings=structuredClone(settings);this.desiredMode=mode;this.desiredWeapon=weapon;this.recorder=new SessionRecorder(session,mode,weapon,settings);
  this.protocol=new ProtocolClient(session,send,now,(c,s)=>this.acknowledged(c,s));
 }
 private acknowledgeEvents(through:number){if(this.ready&&!this.protocol.hasPending('ackEvents'))this.command('ackEvents',{through});}
 receive(raw:string){if(this.closed)return;const s=this.protocol.receive(raw);if(!s)return;this.lastState=s;
  if(!this.protocol.hasPending('weapon')){this.appliedWeapon=s.weapon;this.desiredWeapon=s.weapon;}
  const through=this.recorder.accept(s);if(through!==null)this.acknowledgeEvents(through);
  if(s.error){this.fail('엔진이 설정을 적용하지 못했습니다. 연결 상태를 확인하세요.');return;}
  if(s.paused||s.finished)this.cb.input(false);
  if(s.finished)this.wantsRunning=false;
  this.cb.state(s);
  if(this.recorder.readyToSave&&this.savedEpoch!==s.analytics!.epoch){const data=this.recorder.snapshot();if(data){this.savedEpoch=s.analytics!.epoch;this.cb.finished(data);}}
 }
 private acknowledged(c:Command,s:EngineState){if(this.closed||s.error)return;
  if(c.type==='hello'&&c.seq===this.helloSeq){this.helloSeq=null;this.ready=true;this.cb.ready(true);this.appliedConfig='';this.appliedWeapon=null;this.flush();}
  else if(c.type==='configure'){this.appliedConfig=JSON.stringify(c.payload);this.flush();}
  else if(c.type==='weapon'){this.appliedWeapon=c.payload.weapon as WeaponId;this.flush();}
  else if(c.type==='resume'&&this.ready&&this.captured&&this.wantsRunning&&!s.paused&&!s.finished)this.cb.input(true);
  else if(c.type==='ackEvents'&&this.recorder.processedThrough>Number(c.payload.through))this.acknowledgeEvents(this.recorder.processedThrough);
 }
 private hello(){if(!this.closed&&this.video&&this.channel&&!this.ready&&this.helloSeq===null)this.helloSeq=this.command('hello');}
 videoReady(){this.video=true;this.hello();}
 channelReady(){this.channel=true;this.hello();}
 transportLost(){this.ready=false;this.video=false;this.channel=false;this.helloSeq=null;this.wantsRunning=false;this.captured=false;this.protocol.clear();this.cb.input(false);this.cb.ready(false);}
 private flush(){if(!this.ready||this.closed)return;const payload=settingsPayload(this.desiredSettings,this.desiredMode);
  if(JSON.stringify(payload)!==this.appliedConfig&&!this.protocol.hasPending('configure'))this.command('configure',payload);
  if(this.desiredWeapon!==this.appliedWeapon&&!this.protocol.hasPending('weapon'))this.command('weapon',{weapon:this.desiredWeapon});
 }
 configure(settings:Settings,mode:Mode){this.desiredSettings=structuredClone(settings);this.desiredMode=mode;this.recorder.configure(settings);this.flush();}
 selectWeapon(weapon:WeaponId){this.desiredWeapon=weapon;this.flush();}
 resume(captured:boolean){if(!this.ready||!captured||this.lastState?.finished)return false;this.captured=true;this.wantsRunning=true;this.cb.input(false);return this.command('resume')!==null;}
 pause(){this.captured=false;this.wantsRunning=false;this.cb.input(false);if(this.ready&&!this.closed&&!this.protocol.hasPending('pause'))this.command('pause');}
 command(type:CommandKind,payload:Record<string,unknown>={}){if(this.closed||(!this.ready&&type!=='hello'))return null;try{return this.protocol.command(type,payload);}catch(e){this.fail(e instanceof Error?e.message:'엔진 응답 오류');return null;}}
 tick(){if(this.closed)return;try{this.protocol.retry();if(this.ready&&this.now()-this.pingAt>=1000&&!this.protocol.hasPending('ping')){this.pingAt=this.now();this.command('ping');}}catch(e){this.fail(e instanceof Error?e.message:'엔진 응답 오류');}}
 private fail(message:string){this.transportLost();this.cb.error(message);}
 finish(){this.pause();return this.command('finish');}
 partial(){return this.recorder.snapshot(false);}
 get isReady(){return this.ready;}
 dispose(){if(this.closed)return;this.pause();this.closed=true;this.protocol.clear();this.cb.input(false);this.cb.ready(false);}
}

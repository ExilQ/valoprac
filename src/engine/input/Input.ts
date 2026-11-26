import {movementActionForKey,type MovementAction,type MovementActionResult} from '../../training/movementTools/types';
import { emptyInput, type WeaponId } from '../types';
const SLOT_KEYS=['Digit1','Digit2','Digit3'];
import type { Settings } from '../types';
import {InputDiagnostics} from './InputDiagnostics';
import {monotonicEventTime} from './sensitivity';
import {InputCommandBuffer} from './InputCommandBuffer';
export interface InputTarget {readonly time?:number;readonly yaw?:number;readonly weaponId?:WeaponId;settings:Settings;running:boolean;look:(dx:number,dy:number)=>void;readonly viewYaw:number;readonly viewPitch:number;captureFireView?:(stamp:number)=>void;clearFireView?:()=>void;clearMovementInput?:()=>void;trainingAction?:(action:MovementAction)=>MovementActionResult;}
export interface InputObserver {sample:(kind:0|1,dx:number,dy:number,stamp:number,received:number,beforeYaw:number,beforePitch:number)=>void;}
export class BrowserInput {
  readonly movementCommands=new InputCommandBuffer();private movementWall=0;private movementSimulation=0;private movementClock=false;private lastWheelAt=-Infinity;
  state=emptyInput();private keys=new Set<string>();private destroyed=false;private fallbackAttempted=false;private lockAttempt=0;private lockPending=false;private legacyLock=false;private deferredLockError:ReturnType<typeof setTimeout>|null=null;
  readonly diagnostics=new InputDiagnostics();rawConfirmation:'unverified'|'accepted'|'fallback'|'denied'='unverified';keyboardStatus:'unsupported'|'idle'|'locked'|'denied'='idle';private rightDown=false;private crouchToggle=false;private captureElement:HTMLElement|null=null;
  rawMode:'requested'|'fallback'|'unknown'='unknown';observer:InputObserver|null=null;
  constructor(private canvas:HTMLCanvasElement,private simulation:InputTarget,private onLock:(locked:boolean)=>void,private onError:(message:string)=>void,private onWeapons:()=>void=()=>{},private onSlot:(slot:1|2|3)=>void=()=>{},private onTrainingAction?:(action:MovementAction)=>void){
    document.addEventListener('fullscreenchange',this.fullscreenChange);document.addEventListener('keydown',this.keyDown);document.addEventListener('keyup',this.keyUp);
    document.addEventListener('wheel',this.wheel,{passive:false});document.addEventListener('mousemove',this.move);document.addEventListener('mousedown',this.mouseDown);document.addEventListener('mouseup',this.mouseUp);
    document.addEventListener('pointerlockchange',this.lockChange);document.addEventListener('pointerlockerror',this.lockError);
    window.addEventListener('blur',this.blur);document.addEventListener('visibilitychange',this.visibility);canvas.addEventListener('contextmenu',this.contextMenu);this.movementCommands.reset(performance.now()/1000,this.simulation.yaw??this.simulation.viewYaw);
  }
  get locked(){return document.pointerLockElement===this.canvas;}
  async lock(){
    if(this.destroyed||this.lockPending||this.locked)return;
    const attempt=++this.lockAttempt;this.lockPending=true;
    if(!this.canvas.requestPointerLock){this.lockPending=false;this.onError('이 브라우저는 마우스 잠금을 지원하지 않습니다. 데스크톱 브라우저에서 열어주세요.');return;}
    this.fallbackAttempted=false;this.legacyLock=false;this.rawMode='requested';this.rawConfirmation='unverified';
    try{const request=(this.canvas.requestPointerLock as (options?:{unadjustedMovement:boolean})=>Promise<void>|void)({unadjustedMovement:true});if(request&&typeof request.then==='function'){await request;if(this.destroyed||attempt!==this.lockAttempt){if(this.locked)document.exitPointerLock();return;}if(this.locked)this.rawConfirmation='accepted';}else{this.legacyLock=true;this.lockPending=false;}}
    catch(error){if(this.destroyed||attempt!==this.lockAttempt||this.locked)return;if(error instanceof DOMException&&error.name==='NotSupportedError'){await this.fallbackLock(attempt);}else this.reportLockFailure(attempt);}
    finally{if(attempt===this.lockAttempt)this.lockPending=false;}
  }
  private async fallbackLock(attempt=this.lockAttempt){if(this.fallbackAttempted||this.destroyed||this.locked||attempt!==this.lockAttempt)return;this.fallbackAttempted=true;this.rawMode='fallback';this.rawConfirmation='fallback';
    try{const request=this.canvas.requestPointerLock();this.legacyLock=!request||typeof request.then!=='function';await request;if(this.destroyed&&this.locked)document.exitPointerLock();}
    catch{if(attempt===this.lockAttempt)this.reportLockFailure(attempt);}}
  private reportLockFailure(attempt:number){if(this.destroyed||this.locked||attempt!==this.lockAttempt)return;this.lockPending=false;this.releaseKeyboard();this.rawConfirmation='denied';this.onError('마우스를 잠그지 못했습니다. 화면을 다시 클릭해 시작하세요.');}
  startMovementClock(simulationTime:number,wallStamp=performance.now()){this.movementSimulation=Number.isFinite(simulationTime)?simulationTime:0;this.movementWall=wallStamp/1000;this.movementClock=true;if(this.movementCommands.snapshot().queued===0)this.movementCommands.setYaw(wallStamp/1000,this.simulation.yaw??this.simulation.viewYaw);}
  consumeMovementTick(dt:number,simulationTime:number){
    if(!this.movementClock)this.startMovementClock(simulationTime);
    const start=this.movementWall+(simulationTime-this.movementSimulation),sample=this.movementCommands.consume(start,start+dt);
    this.state.movementYaw=sample.yaw;this.state.forward=sample.forward;this.state.strafe=sample.strafe;this.state.walk=sample.walk;this.state.crouch=sample.crouch;this.state.jumpHeld=sample.jumpHeld;this.state.jumpPresses=sample.jumpTimes.length;this.state.jump=sample.jumpTimes.length>0;
    if(sample.jumpTimes.length)this.state.jumpRequestedAt=this.movementSimulation+sample.jumpTimes[sample.jumpTimes.length-1]-this.movementWall;else delete this.state.jumpRequestedAt;
    return this.state;
  }
  private recordAxes(event:Event){const now=performance.now();this.movementCommands.setAxes(monotonicEventTime(event.timeStamp,now)/1000,{forward:this.state.forward,strafe:this.state.strafe,walk:this.state.walk,crouch:this.state.crouch,jumpHeld:!!this.state.jumpHeld,yaw:this.simulation.yaw??this.simulation.viewYaw});}
  reset(){this.movementCommands.reset(performance.now()/1000,this.simulation.yaw??this.simulation.viewYaw);this.movementClock=false;this.lastWheelAt=-Infinity;this.simulation.clearFireView?.();this.simulation.clearMovementInput?.();this.rightDown=false;this.crouchToggle=false;this.keys.clear();Object.assign(this.state,emptyInput());this.state.jumpHeld=false;this.state.jumpPresses=0;delete this.state.jumpRequestedAt;delete this.state.movementYaw;}
  /** A weapon swap drops trigger, aim and scope intent but keeps held movement
   * keys: browsers stop auto-repeating a held key once another key is pressed,
   * so clearing them would leave the player standing still while W is down. */
  releaseCombat(){this.simulation.clearFireView?.();Object.assign(this.state,{fire:false,ads:false,firePresses:0,scopePresses:0,zoomPresses:0,scopeHeld:false,reload:false});this.rightDown=false;}
  private keyDown=(event:KeyboardEvent)=>{
    if(!this.locked)return;const b=this.simulation.settings.bindings;
    if(event.code==='Escape'){this.reset();document.exitPointerLock();return;}
    const tool=movementActionForKey(this.simulation.settings,event.code);if(tool){event.preventDefault();if(!event.repeat&&!this.keys.has(event.code)){this.keys.add(event.code);if(this.onTrainingAction)this.onTrainingAction(tool);else this.simulation.trainingAction?.(tool);}return;}
    if(Object.values(b).includes(event.code)||['KeyC','ControlLeft','ControlRight','ShiftRight'].includes(event.code)||SLOT_KEYS.includes(event.code))event.preventDefault();
    if(event.code===b.weapons&&!event.repeat){this.reset();document.exitPointerLock();this.onWeapons();return;}
    if(SLOT_KEYS.includes(event.code)){if(!event.repeat){this.releaseCombat();this.onSlot(Number(event.code.slice(-1)) as 1|2|3);}return;}
    if(this.simulation.weaponId==='operator'&&event.code===this.simulation.settings.operatorZoomBinding&&!event.repeat){event.preventDefault();this.state.zoomPresses=(this.state.zoomPresses??0)+1;}
    const newPress=!event.repeat&&!this.keys.has(event.code);
    if(this.isCrouch(event.code)&&newPress&&this.simulation.settings.crouchMode==='toggle')this.crouchToggle=!this.crouchToggle;this.keys.add(event.code);if(event.code===b.jump&&newPress){this.state.jump=true;this.state.jumpPresses=(this.state.jumpPresses??0)+1;const now=performance.now();this.movementCommands.jump(monotonicEventTime(event.timeStamp,now)/1000);}if(event.code===b.reload&&newPress)this.state.reload=true;this.updateAxes();this.recordAxes(event);
  };
  private keyUp=(event:KeyboardEvent)=>{this.keys.delete(event.code);this.updateAxes();if(this.locked)this.recordAxes(event);};
  private wheel=(event:WheelEvent)=>{
    if(!this.locked)return;const binding=this.simulation.settings.wheelJump;if(binding!=='up'&&binding!=='down'||!Number.isFinite(event.deltaY)||event.deltaY===0||(binding==='up'&&event.deltaY>=0)||(binding==='down'&&event.deltaY<=0))return;
    event.preventDefault();const now=performance.now(),stamp=monotonicEventTime(event.timeStamp,now);if(stamp-this.lastWheelAt<20)return;this.lastWheelAt=stamp;this.movementCommands.jump(stamp/1000,'wheel');this.state.jump=true;this.state.jumpPresses=(this.state.jumpPresses??0)+1;
  };
  private isCrouch(code:string){const b=this.simulation.settings.bindings;return code===b.crouch||code==='ControlLeft'||code==='ControlRight'||code==='KeyC'&&!Object.entries(b).some(([a,c])=>a!=='crouch'&&c==='KeyC');}
  private held(code:string){return this.keys.has(code)||code.endsWith('Left')&&this.keys.has(code.replace('Left','Right'))||code.endsWith('Right')&&this.keys.has(code.replace('Right','Left'));}
  private updateAxes(){const b=this.simulation.settings.bindings;this.state.forward=Number(this.keys.has(b.forward))-Number(this.keys.has(b.backward));this.state.strafe=Number(this.keys.has(b.right))-Number(this.keys.has(b.left));this.state.walk=this.held(b.walk);this.state.crouch=this.simulation.settings.crouchMode==='toggle'?this.crouchToggle:[...this.keys].some(k=>this.isCrouch(k));this.state.jumpHeld=this.keys.has(b.jump);}
  private move=(event:MouseEvent)=>{if(this.locked&&this.simulation.running&&Number.isFinite(event.movementX)&&Number.isFinite(event.movementY)){const now=performance.now(),stamp=monotonicEventTime(event.timeStamp,now),y=this.simulation.viewYaw,p=this.simulation.viewPitch;this.simulation.look(event.movementX,event.movementY);this.movementCommands.setYaw(stamp/1000,this.simulation.yaw??this.simulation.viewYaw);this.observer?.sample(0,event.movementX,event.movementY,stamp,now,y,p);this.diagnostics.record(stamp,now,performance.now()-now,event.movementX,event.movementY);}};
  private mouseDown=(event:MouseEvent)=>{if(!this.locked)return;if(event.button===0){const now=performance.now(),stamp=monotonicEventTime(event.timeStamp,now);if(this.simulation.running)this.simulation.captureFireView?.(stamp);if(this.observer&&this.simulation.running){this.observer.sample(1,0,0,stamp,now,this.simulation.viewYaw,this.simulation.viewPitch);}this.state.fire=true;this.state.firePresses=(this.state.firePresses??0)+1;}if(event.button===2&&!this.rightDown){this.rightDown=true;event.preventDefault();if(this.simulation.weaponId==='operator'||this.simulation.weaponId==='knife'){this.state.scopeHeld=true;this.state.scopePresses=(this.state.scopePresses??0)+1;}else this.state.ads=this.simulation.settings.adsMode==='toggle'?!this.state.ads:true;}};
  private mouseUp=(event:MouseEvent)=>{if(event.button===0)this.state.fire=false;if(event.button===2){this.rightDown=false;this.state.scopeHeld=false;if(this.simulation.settings.adsMode==='hold')this.state.ads=false;}};
  private lockChange=()=>{if(this.deferredLockError!==null){clearTimeout(this.deferredLockError);this.deferredLockError=null;}this.lockPending=false;this.reset();if(!this.locked)this.releaseKeyboard();else this.onError('');this.onLock(this.locked);};
  private lockError=()=>{if(this.destroyed||this.locked)return;const attempt=this.lockAttempt;
    // Promise-based attempts own their failures. A late error event has no request identity.
    if(this.lockPending||!this.legacyLock)return;if(this.deferredLockError!==null)clearTimeout(this.deferredLockError);
    this.deferredLockError=setTimeout(()=>{this.deferredLockError=null;if(this.destroyed||this.locked||attempt!==this.lockAttempt)return;if(!this.fallbackAttempted)void this.fallbackLock(attempt);else this.reportLockFailure(attempt);},0);};
  async captureKeyboard(element:HTMLElement){this.captureElement=element;const keyboard=(navigator as Navigator&{keyboard?:{lock:(keys:string[])=>Promise<void>;unlock:()=>void}}).keyboard;if(!keyboard?.lock||!element.requestFullscreen){this.keyboardStatus='unsupported';return;}try{if(document.fullscreenElement!==element)await element.requestFullscreen();if(this.destroyed){if(document.fullscreenElement===element)await document.exitFullscreen();return;}await keyboard.lock([...new Set([...Object.values(this.simulation.settings.bindings),'KeyW','KeyC','ControlLeft','ControlRight','ShiftLeft','ShiftRight'])]);if(this.destroyed||document.fullscreenElement!==element){keyboard.unlock();return;}this.keyboardStatus='locked';}catch{this.keyboardStatus='denied';}}
  private releaseKeyboard(){const keyboard=typeof navigator!=='undefined'?(navigator as Navigator&{keyboard?:{unlock?:()=>void}}).keyboard:undefined;if(this.keyboardStatus==='locked')keyboard?.unlock?.();if(this.keyboardStatus==='locked')this.keyboardStatus='idle';}
  private fullscreenChange=()=>{if(this.captureElement&&document.fullscreenElement!==this.captureElement){this.releaseKeyboard();this.blur();}};
  private blur=()=>{this.reset();if(this.locked)document.exitPointerLock();this.onLock(false);};
  private visibility=()=>{if(document.hidden)this.blur();};
  private contextMenu=(event:Event)=>event.preventDefault();
  dispose(){this.destroyed=true;++this.lockAttempt;if(this.deferredLockError!==null)clearTimeout(this.deferredLockError);this.deferredLockError=null;this.releaseKeyboard();if(this.captureElement&&document.fullscreenElement===this.captureElement)void document.exitFullscreen?.().catch(()=>{});this.observer=null;if(this.locked)document.exitPointerLock();this.reset();
    document.removeEventListener('fullscreenchange',this.fullscreenChange);document.removeEventListener('keydown',this.keyDown);document.removeEventListener('keyup',this.keyUp);document.removeEventListener('wheel',this.wheel);document.removeEventListener('mousemove',this.move);document.removeEventListener('mousedown',this.mouseDown);document.removeEventListener('mouseup',this.mouseUp);document.removeEventListener('pointerlockchange',this.lockChange);document.removeEventListener('pointerlockerror',this.lockError);window.removeEventListener('blur',this.blur);document.removeEventListener('visibilitychange',this.visibility);this.canvas.removeEventListener('contextmenu',this.contextMenu);
  }
}

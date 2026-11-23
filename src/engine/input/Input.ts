import { emptyInput, type WeaponId } from '../types';
import type { Settings } from '../types';
import {InputDiagnostics} from './InputDiagnostics';
import {monotonicEventTime} from './sensitivity';
export interface InputTarget {readonly weaponId?:WeaponId;settings:Settings;running:boolean;look:(dx:number,dy:number)=>void;readonly viewYaw:number;readonly viewPitch:number;}
export interface InputObserver {sample:(kind:0|1,dx:number,dy:number,stamp:number,received:number,beforeYaw:number,beforePitch:number)=>void;}
export class BrowserInput {
  state=emptyInput();private keys=new Set<string>();private destroyed=false;private fallbackAttempted=false;private lockAttempt=0;private lockPending=false;private legacyLock=false;private deferredLockError:ReturnType<typeof setTimeout>|null=null;
  readonly diagnostics=new InputDiagnostics();rawConfirmation:'unverified'|'accepted'|'fallback'|'denied'='unverified';keyboardStatus:'unsupported'|'idle'|'locked'|'denied'='idle';private rightDown=false;private crouchToggle=false;private captureElement:HTMLElement|null=null;
  rawMode:'requested'|'fallback'|'unknown'='unknown';observer:InputObserver|null=null;
  constructor(private canvas:HTMLCanvasElement,private simulation:InputTarget,private onLock:(locked:boolean)=>void,private onError:(message:string)=>void,private onWeapons:()=>void=()=>{},private onWeapon:(id:WeaponId)=>void=()=>{}){
    document.addEventListener('fullscreenchange',this.fullscreenChange);document.addEventListener('keydown',this.keyDown);document.addEventListener('keyup',this.keyUp);
    document.addEventListener('mousemove',this.move);document.addEventListener('mousedown',this.mouseDown);document.addEventListener('mouseup',this.mouseUp);
    document.addEventListener('pointerlockchange',this.lockChange);document.addEventListener('pointerlockerror',this.lockError);
    window.addEventListener('blur',this.blur);document.addEventListener('visibilitychange',this.visibility);canvas.addEventListener('contextmenu',this.contextMenu);
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
  reset(){this.rightDown=false;this.crouchToggle=false;this.keys.clear();Object.assign(this.state,emptyInput());}
  private keyDown=(event:KeyboardEvent)=>{
    if(!this.locked)return;const b=this.simulation.settings.bindings;
    if(Object.values(b).includes(event.code)||['KeyC','ControlLeft','ControlRight','ShiftRight'].includes(event.code)||['Digit1','Digit2','Digit3','Digit4'].includes(event.code))event.preventDefault();
    if(event.code===b.weapons&&!event.repeat){this.reset();document.exitPointerLock();this.onWeapons();return;}
    if(!event.repeat&&['Digit1','Digit2','Digit3','Digit4'].includes(event.code)){this.reset();this.onWeapon((['rifleA','rifleB','sheriff','operator'] as const)[Number(event.code.slice(-1))-1]);return;}
    if(this.simulation.weaponId==='operator'&&event.code===this.simulation.settings.operatorZoomBinding&&!event.repeat){event.preventDefault();this.state.zoomPresses=(this.state.zoomPresses??0)+1;}
    if(this.isCrouch(event.code)&&!event.repeat&&!this.keys.has(event.code)&&this.simulation.settings.crouchMode==='toggle')this.crouchToggle=!this.crouchToggle;this.keys.add(event.code);if(event.code===b.jump&&!event.repeat)this.state.jump=true;if(event.code===b.reload&&!event.repeat)this.state.reload=true;this.updateAxes();
  };
  private keyUp=(event:KeyboardEvent)=>{this.keys.delete(event.code);this.updateAxes();};
  private isCrouch(code:string){const b=this.simulation.settings.bindings;return code===b.crouch||code==='ControlLeft'||code==='ControlRight'||code==='KeyC'&&!Object.entries(b).some(([a,c])=>a!=='crouch'&&c==='KeyC');}
  private held(code:string){return this.keys.has(code)||code.endsWith('Left')&&this.keys.has(code.replace('Left','Right'))||code.endsWith('Right')&&this.keys.has(code.replace('Right','Left'));}
  private updateAxes(){const b=this.simulation.settings.bindings;this.state.forward=Number(this.keys.has(b.forward))-Number(this.keys.has(b.backward));this.state.strafe=Number(this.keys.has(b.right))-Number(this.keys.has(b.left));this.state.walk=this.held(b.walk);this.state.crouch=this.simulation.settings.crouchMode==='toggle'?this.crouchToggle:[...this.keys].some(k=>this.isCrouch(k));}
  private move=(event:MouseEvent)=>{if(this.locked&&this.simulation.running){const now=performance.now(),stamp=monotonicEventTime(event.timeStamp,now),y=this.simulation.viewYaw,p=this.simulation.viewPitch;this.simulation.look(event.movementX,event.movementY);this.observer?.sample(0,event.movementX,event.movementY,stamp,now,y,p);this.diagnostics.record(stamp,now,performance.now()-now,event.movementX,event.movementY);}};
  private mouseDown=(event:MouseEvent)=>{if(!this.locked)return;if(event.button===0){if(this.observer&&this.simulation.running){const now=performance.now();this.observer.sample(1,0,0,monotonicEventTime(event.timeStamp,now),now,this.simulation.viewYaw,this.simulation.viewPitch);}this.state.fire=true;this.state.firePresses=(this.state.firePresses??0)+1;}if(event.button===2&&!this.rightDown){this.rightDown=true;event.preventDefault();if(this.simulation.weaponId==='operator'){this.state.scopeHeld=true;this.state.scopePresses=(this.state.scopePresses??0)+1;}else this.state.ads=this.simulation.settings.adsMode==='toggle'?!this.state.ads:true;}};
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
    document.removeEventListener('fullscreenchange',this.fullscreenChange);document.removeEventListener('keydown',this.keyDown);document.removeEventListener('keyup',this.keyUp);document.removeEventListener('mousemove',this.move);document.removeEventListener('mousedown',this.mouseDown);document.removeEventListener('mouseup',this.mouseUp);document.removeEventListener('pointerlockchange',this.lockChange);document.removeEventListener('pointerlockerror',this.lockError);window.removeEventListener('blur',this.blur);document.removeEventListener('visibilitychange',this.visibility);this.canvas.removeEventListener('contextmenu',this.contextMenu);
  }
}

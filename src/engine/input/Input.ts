import { emptyInput } from '../types';
import type { Simulation } from '../simulation/Simulation';
export class BrowserInput {
  state=emptyInput();private keys=new Set<string>();private destroyed=false;private fallbackAttempted=false;
  constructor(private canvas:HTMLCanvasElement,private simulation:Simulation,private onLock:(locked:boolean)=>void,private onError:(message:string)=>void){
    document.addEventListener('keydown',this.keyDown);document.addEventListener('keyup',this.keyUp);
    document.addEventListener('mousemove',this.move);document.addEventListener('mousedown',this.mouseDown);document.addEventListener('mouseup',this.mouseUp);
    document.addEventListener('pointerlockchange',this.lockChange);document.addEventListener('pointerlockerror',this.lockError);
    window.addEventListener('blur',this.blur);document.addEventListener('visibilitychange',this.visibility);canvas.addEventListener('contextmenu',this.contextMenu);
  }
  get locked(){return document.pointerLockElement===this.canvas;}
  async lock(){
    if(this.destroyed)return;
    if(!this.canvas.requestPointerLock){this.onError('이 브라우저는 마우스 잠금을 지원하지 않습니다. 데스크톱 브라우저에서 열어주세요.');return;}
    this.fallbackAttempted=false;
    try{await (this.canvas.requestPointerLock as (options?:{unadjustedMovement:boolean})=>Promise<void>|void)({unadjustedMovement:true});}
    catch(error){if(error instanceof DOMException&&error.name==='NotSupportedError'){await this.fallbackLock();}else this.onError('마우스를 잠그지 못했습니다. 새 창에서 열고 다시 시작하세요.');}
  }
  private async fallbackLock(){if(this.fallbackAttempted||this.destroyed)return;this.fallbackAttempted=true;
    try{await this.canvas.requestPointerLock();}catch{this.onError('마우스 잠금이 차단되었습니다. 새 창에서 열고 다시 클릭하세요.');}}
  reset(){this.keys.clear();Object.assign(this.state,emptyInput());}
  private keyDown=(event:KeyboardEvent)=>{
    if(!this.locked)return;if(['KeyW','KeyA','KeyS','KeyD','ShiftLeft','ShiftRight','ControlLeft','ControlRight','Space','KeyR'].includes(event.code))event.preventDefault();
    this.keys.add(event.code);if(event.code==='Space'&&!event.repeat)this.state.jump=true;if(event.code==='KeyR'&&!event.repeat)this.state.reload=true;this.updateAxes();
  };
  private keyUp=(event:KeyboardEvent)=>{this.keys.delete(event.code);this.updateAxes();};
  private updateAxes(){this.state.forward=Number(this.keys.has('KeyW'))-Number(this.keys.has('KeyS'));this.state.strafe=Number(this.keys.has('KeyD'))-Number(this.keys.has('KeyA'));this.state.walk=this.keys.has('ShiftLeft')||this.keys.has('ShiftRight');this.state.crouch=this.keys.has('ControlLeft')||this.keys.has('ControlRight');}
  private move=(event:MouseEvent)=>{if(this.locked&&this.simulation.running)this.simulation.look(event.movementX,event.movementY);};
  private mouseDown=(event:MouseEvent)=>{if(!this.locked)return;if(event.button===0)this.state.fire=true;if(event.button===2){event.preventDefault();this.state.ads=true;}};
  private mouseUp=(event:MouseEvent)=>{if(event.button===0)this.state.fire=false;if(event.button===2)this.state.ads=false;};
  private lockChange=()=>{this.reset();this.onLock(this.locked);};
  private lockError=()=>{if(!this.fallbackAttempted){void this.fallbackLock();}else this.onError('마우스 잠금을 허용하지 않았습니다. 브라우저 권한과 새 창 실행을 확인하세요.');};
  private blur=()=>{this.reset();if(this.locked)document.exitPointerLock();this.onLock(false);};
  private visibility=()=>{if(document.hidden)this.blur();};
  private contextMenu=(event:Event)=>event.preventDefault();
  dispose(){this.destroyed=true;if(this.locked)document.exitPointerLock();this.reset();
    document.removeEventListener('keydown',this.keyDown);document.removeEventListener('keyup',this.keyUp);document.removeEventListener('mousemove',this.move);document.removeEventListener('mousedown',this.mouseDown);document.removeEventListener('mouseup',this.mouseUp);document.removeEventListener('pointerlockchange',this.lockChange);document.removeEventListener('pointerlockerror',this.lockError);window.removeEventListener('blur',this.blur);document.removeEventListener('visibilitychange',this.visibility);this.canvas.removeEventListener('contextmenu',this.contextMenu);
  }
}

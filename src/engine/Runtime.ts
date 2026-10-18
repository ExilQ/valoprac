import { Simulation } from './simulation/Simulation';
import { FixedClock } from './simulation/FixedClock';
import { RangeRenderer } from './rendering/RangeRenderer';
import { BrowserInput } from './input/Input';
import { TrainingAudio } from './audio/Audio';
import type { Mode, Settings, WeaponId, SessionData } from './types';
export interface Telemetry {time:number;ammo:number;reloading:number|null;score:number;shots:number;speed:number;accurate:boolean;release:number|null;ready:number|null;thresholdDelta:number|null;early:boolean;hit:string;hitAge:number;fps:number;p95:number;calls:number;debt:number;spread:number;recoil:number;grounded:boolean}
export const INITIAL_TELEMETRY:Telemetry={time:0,ammo:25,reloading:null,score:0,shots:0,speed:0,accurate:true,release:null,ready:0,thresholdDelta:null,early:false,hit:'miss',hitAge:100,fps:0,p95:0,calls:0,debt:0,spread:0,recoil:0,grounded:true};
export class Runtime {
  simulation:Simulation;renderer:RangeRenderer;input:BrowserInput;audio=new TrainingAudio();clock=new FixedClock();
  private frame=0;private previousTime=0;private hudAt=0;private frameTimes=new Float64Array(180);private sampleIndex=0;private sampleCount=0;private preview:boolean;private disposed=false;private failed=false;
  constructor(host:HTMLElement,mode:Mode,weapon:WeaponId,settings:Settings,preview:boolean,
    private onTelemetry:(t:Telemetry)=>void,private onLock:(locked:boolean)=>void,private onError:(message:string)=>void,private onFinish:(data:SessionData)=>void){
    this.preview=preview;this.simulation=new Simulation(mode,weapon,settings);this.renderer=new RangeRenderer(host,this.simulation,settings);
    this.input=new BrowserInput(this.renderer.canvas,this.simulation,this.handleLock,onError);
    this.simulation.onShot=s=>{this.renderer.addShot(s);this.audio.shot(settings.volume);if(s.hit==='head')this.audio.head(settings.volume);else if(['torso','arm','leg'].includes(s.hit))this.audio.hit(settings.volume);};
    this.simulation.onFinish=()=>{const data=this.simulation.snapshot();if(document.pointerLockElement===this.renderer.canvas)document.exitPointerLock();this.onFinish(data);};
    this.renderer.canvas.addEventListener('webglcontextlost',this.contextLost);
    this.frame=requestAnimationFrame(this.animate);
  }
  private handleLock=(locked:boolean)=>{if(this.preview)return;this.simulation.running=locked&&!this.simulation.completed;this.previousTime=0;this.onLock(locked);};
  async resume(){if(this.failed){this.onError('그래픽 환경이 중단되었습니다. 화면을 다시 불러와 주세요.');return;}if(this.disposed||this.preview)return;void this.audio.unlock().catch(()=>this.onError('소리를 활성화하지 못했습니다. 소리 없이 훈련을 진행합니다.'));await this.input.lock();}
  finish(){if(this.simulation.completed)return;this.simulation.completed=true;this.simulation.running=false;if(this.input.locked)document.exitPointerLock();this.onFinish(this.simulation.snapshot());}
  private contextLost=(event:Event)=>{event.preventDefault();this.fail();};
  private fail(){
    if(this.failed||this.disposed)return;
    this.failed=true;cancelAnimationFrame(this.frame);this.simulation.running=false;this.input.reset();
    if(this.input.locked)document.exitPointerLock();this.onLock(false);
    this.onError('그래픽 환경이 중단되었습니다. 화면을 다시 불러와 주세요.');
  }
  private animate=(now:number)=>{
    if(this.failed||this.disposed)return;
    try{this.renderFrame(now);}catch(error){console.error('VALOPRAC runtime failure',error);this.fail();}
  };
  private renderFrame=(now:number)=>{
    if(this.disposed)return;
    const elapsed=this.previousTime?(now-this.previousTime)/1000:0;this.previousTime=now;
    this.frameTimes[this.sampleIndex++%this.frameTimes.length]=elapsed*1000;this.sampleCount=Math.min(this.sampleCount+1,this.frameTimes.length);
    if(this.simulation.running&&elapsed>0.5){this.simulation.running=false;this.input.reset();if(this.input.locked)document.exitPointerLock();this.onLock(false);this.onError('긴 화면 정지를 감지해 일시정지했습니다. 클릭하면 이어서 훈련합니다.');}
    let alpha=1;if(this.simulation.running)alpha=this.clock.advance(elapsed,this.step);
    this.renderer.render(alpha,elapsed,this.preview,this.input.state.ads);
    const root=this.renderer.canvas.parentElement;
    if(root){const w=this.simulation.weapon,m=this.simulation.movement;const error=(m.accurate?0:Math.min(22,m.speed*3))+(this.simulation.settings.dynamicCrosshair?w.bloom*10:0);root.style.setProperty('--movement-gap',`${this.simulation.settings.dynamicCrosshair?error:0}px`);}
    if(!this.preview&&now-this.hudAt>=90){this.hudAt=now;this.publishTelemetry();}
    this.frame=requestAnimationFrame(this.animate);
  };
  private step=(dt:number)=>this.simulation.step(dt,this.input.state);
  private publishTelemetry(){
    const s=this.simulation,w=s.weapon,b=s.braking;const times=Array.from(this.frameTimes.subarray(0,this.sampleCount)).filter(t=>t>0).sort((a,b)=>a-b);const average=times.length?times.reduce((a,b)=>a+b,0)/times.length:0;
    const last=s.shots[s.shots.length-1];this.onTelemetry({time:s.time,ammo:w.ammo,reloading:w.reloadingUntil===null?null:Math.max(0,w.reloadingUntil-s.time),score:s.kills.length,shots:s.shots.length,speed:s.movement.speed,accurate:s.movement.accurate,release:b.releaseTime===null?null:s.time-b.releaseTime,ready:s.movement.estimateReadyTime(this.input.state,s.yaw),thresholdDelta:last?.thresholdDelta??null,early:s.time-s.lastEarlyAt<0.3,hit:s.lastHit,hitAge:s.time-s.lastHitAt,fps:average?1000/average:0,p95:times[Math.floor(times.length*0.95)]??0,calls:this.renderer.calls,debt:this.clock.deferredTicks,spread:w.spread.total,recoil:w.recoil.pitch,grounded:s.movement.grounded});
  }
  dispose(){this.disposed=true;cancelAnimationFrame(this.frame);this.renderer.canvas.removeEventListener('webglcontextlost',this.contextLost);this.input.dispose();this.audio.dispose();this.renderer.dispose();this.simulation.onShot=null;this.simulation.onFinish=null;this.simulation.onKill=null;}
}

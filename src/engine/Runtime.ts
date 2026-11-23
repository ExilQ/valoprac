import {CombatCapture,type CombatAssessmentContext} from '../aim/CombatCapture';
import { InputLatencyProbe } from '../benchmarks/InputLatencyProbe';
import { RenderCadence } from './rendering/RenderCadence';
import { Simulation } from './simulation/Simulation';
import { FixedClock } from './simulation/FixedClock';
import { RangeRenderer } from './rendering/RangeRenderer';
import { BrowserInput } from './input/Input';
import { TrainingAudio } from './audio/Audio';
import type { Mode, Settings, WeaponId, SessionData, SessionSummary } from './types';
export interface Telemetry {scopeZoom?:number;scopeLevel?:number;scopeAmount?:number;operatorState?:string;peeking?:import('./tactical/DefenderAI').PeekReport;health?:number;weapon:WeaponId;reserve:number;ads:boolean;summary:SessionSummary|null;time:number;ammo:number;reloading:number|null;score:number;shots:number;speed:number;accurate:boolean;release:number|null;ready:number|null;thresholdDelta:number|null;early:boolean;hit:string;hitAge:number;fps:number;p95:number;calls:number;debt:number;spread:number;recoil:number;grounded:boolean}
export const INITIAL_TELEMETRY:Telemetry={weapon:'rifleA',reserve:75,ads:false,summary:null,time:0,ammo:25,reloading:null,score:0,shots:0,speed:0,accurate:true,release:null,ready:0,thresholdDelta:null,early:false,hit:'miss',hitAge:100,fps:0,p95:0,calls:0,debt:0,spread:0,recoil:0,grounded:true};
export class Runtime {
  private aimCapture:CombatCapture|null=null;
  readonly latency=new InputLatencyProbe();
  simulation:Simulation;renderer:RangeRenderer;input:BrowserInput;audio=new TrainingAudio();clock=new FixedClock();
  private cadence=new RenderCadence();private lastDraw=0;private frame=0;private previousTime=0;private hudAt=0;private frameTimes=new Float64Array(180);private sampleIndex=0;private sampleCount=0;private preview:boolean;private disposed=false;
  constructor(host:HTMLElement,mode:Mode,weapon:WeaponId,settings:Settings,preview:boolean,
    private onTelemetry:(t:Telemetry)=>void,private onLock:(locked:boolean)=>void,private onError:(message:string)=>void,private onFinish:(data:SessionData)=>void,private onWeapon:(id:WeaponId)=>void=()=>{},assessment?:CombatAssessmentContext){
    this.preview=preview;this.simulation=new Simulation(mode,weapon,settings);this.renderer=new RangeRenderer(host,this.simulation,settings);
    this.input=new BrowserInput(this.renderer.canvas,this.simulation,this.handleLock,onError,()=>this.publishTelemetry(),id=>{this.switchWeapon(id);this.onWeapon(id);});
    if(!preview){this.aimCapture=new CombatCapture(this.simulation,()=>this.input.rawMode,assessment,()=>this.input.rawConfirmation);this.input.observer=this.aimCapture;}
    if(this.simulation.defenders)this.simulation.defenders.onShot=e=>{if(e.observed)this.audio.enemyShot(e.weapon,Math.hypot(e.origin.x-this.simulation.movement.position.x,e.origin.z-this.simulation.movement.position.z));};
    this.simulation.onFootstep=e=>this.audio.footstep(e);
    this.simulation.onShot=s=>{this.renderer.addShot(s);this.audio.shot(s);this.aimCapture?.shot(s);};
    for(const w of Object.values(this.simulation.weapons))w.onAction=action=>this.audio.action(w.profile.id,action);
    this.simulation.onFinish=()=>{const data=this.simulation.snapshot();if(document.pointerLockElement===this.renderer.canvas)document.exitPointerLock();this.onFinish(data);};
    this.renderer.canvas.addEventListener('webglcontextlost',this.contextLost);
    this.renderer.canvas.addEventListener('mousemove',this.probeMouse,{passive:true});this.renderer.canvas.addEventListener('mousedown',this.probeClick,{passive:true});
    this.frame=requestAnimationFrame(this.animate);
  }
  private probeMouse=(e:MouseEvent)=>{if(this.input.locked)this.latency.mark('look',e.timeStamp,performance.now());};
  private probeClick=(e:MouseEvent)=>{if(this.input.locked&&e.button===0)this.latency.mark('click',e.timeStamp,performance.now());};
  private handleLock=(locked:boolean)=>{if(this.preview)return;this.simulation.running=locked&&!this.simulation.completed;this.previousTime=0;if(!locked){this.audio.stop();this.latency.clearPending();}else this.audio.sync(this.simulation.time);this.onLock(locked);};
  async resume(capture=false){if(this.disposed||this.preview)return;void this.audio.unlock().then(()=>{this.audio.levels(this.simulation.settings);this.audio.sync(this.simulation.time);}).catch(()=>this.onError('소리를 활성화하지 못했습니다. 소리 없이 훈련을 진행합니다.'));this.audio.levels(this.simulation.settings);if(capture)await this.input.captureKeyboard(this.renderer.canvas.closest('.game-stage') as HTMLElement??this.renderer.canvas);await this.input.lock();}
  flushAimAssessment(){return this.aimCapture?.flush()??Promise.resolve([]);}
  finish(){if(this.simulation.completed)return;this.simulation.completed=true;this.simulation.running=false;if(this.input.locked)document.exitPointerLock();this.onFinish(this.simulation.snapshot());}
  private contextLost=(event:Event)=>{event.preventDefault();this.simulation.running=false;this.input.reset();this.audio.stop();if(this.input.locked)document.exitPointerLock();this.onError('그래픽 연결이 중단되었습니다. 결과를 저장한 뒤 새로고침하세요.');};
  private animate=(now:number)=>{
    try{this.renderFrame(now);}catch(error){console.error(error);this.simulation.running=false;this.input.reset();this.audio.stop();if(this.input.locked)document.exitPointerLock();this.onError('훈련 화면에 오류가 발생했습니다. 결과를 저장한 뒤 새로고침하세요.');}
  };
  private renderFrame=(now:number)=>{
    if(this.disposed)return;
    const elapsed=this.previousTime?(now-this.previousTime)/1000:0;this.previousTime=now;

    if(this.simulation.exposure.death&&this.input.locked){this.input.reset();document.exitPointerLock();this.audio.stop();this.onLock(false);}
    if(this.simulation.running&&elapsed>0.5){this.audio.stop();this.simulation.running=false;this.input.reset();if(this.input.locked)document.exitPointerLock();this.onLock(false);this.onError('긴 화면 정지를 감지해 일시정지했습니다. 클릭하면 이어서 훈련합니다.');}
    let alpha=1;if(this.simulation.running)alpha=this.clock.advance(elapsed,this.step);
    if(this.cadence.shouldDraw(now,this.preview?30:this.simulation.settings.frameLimit)){
      const drawElapsed=this.lastDraw?(now-this.lastDraw)/1000:elapsed;this.lastDraw=now;
      this.frameTimes[this.sampleIndex++%this.frameTimes.length]=drawElapsed*1000;this.sampleCount=Math.min(this.sampleCount+1,this.frameTimes.length);
      this.renderer.render(alpha,drawElapsed,this.preview,this.simulation.ads);this.aimCapture?.frame(performance.now());this.latency.submitted(performance.now());
    }
    const root=this.renderer.canvas.parentElement;
    if(root){const w=this.simulation.weapon,m=this.simulation.movement;const error=(m.accurate?0:Math.min(22,m.speed*3))+(this.simulation.settings.dynamicCrosshair?w.bloom*10:0);root.style.setProperty('--movement-gap',`${this.simulation.settings.dynamicCrosshair?error:0}px`);}
    if(!this.preview&&now-this.hudAt>=90){this.hudAt=now;this.publishTelemetry();}
    this.frame=requestAnimationFrame(this.animate);
  };
  private step=(dt:number)=>this.simulation.step(dt,this.input.state);
  private publishTelemetry(){
    const s=this.simulation,w=s.weapon,b=s.braking;const times=Array.from(this.frameTimes.subarray(0,this.sampleCount)).filter(t=>t>0).sort((a,b)=>a-b);const average=times.length?times.reduce((a,b)=>a+b,0)/times.length:0;
    const movementReady=s.movement.estimateReadyTime(this.input.state,s.yaw,1/120,s.weaponId==='operator'?5.13*.72*.15:s.movement.profile.accuracyVelocityThreshold);const ready=s.weaponId==='operator'?(!s.ads||movementReady===null?null:Math.max(movementReady,w.scopeReadyAt-s.time,.225-(s.time-s.movement.landedAt),0)):movementReady;
    const last=s.shots[s.shots.length-1];this.onTelemetry({scopeZoom:s.scopeZoom,scopeLevel:s.scopeLevel,scopeAmount:s.weaponId==='operator'?w.scopeAmount:0,operatorState:s.weaponId==='operator'?w.operatorState:undefined,peeking:s.defenders?.snapshot(),health:s.defenders?.health,weapon:s.weaponId,reserve:w.reserve,ads:s.ads,summary:s.hudSummary(),time:s.time,ammo:w.ammo,reloading:w.reloadingUntil===null?null:Math.max(0,w.reloadingUntil-s.time),score:s.stats.eliminations,shots:s.stats.shots,speed:s.movement.speed,accurate:s.weaponId==='operator'?s.ads&&w.scopeAmount>.98&&s.time>=w.scopeReadyAt&&s.movement.grounded&&s.movement.speed<=5.13*.72*.15&&s.time-s.movement.landedAt>=.225:s.movement.accurate,release:b.releaseTime===null?null:s.time-b.releaseTime,ready,thresholdDelta:last?.thresholdDelta??null,early:s.time-s.lastEarlyAt<0.3,hit:s.lastHit,hitAge:s.time-s.lastHitAt,fps:average?1000/average:0,p95:times[Math.floor(times.length*0.95)]??0,calls:this.renderer.calls,debt:this.clock.deferredTicks,spread:w.spread.total,recoil:w.recoil.pitch,grounded:s.movement.grounded});
  }
  switchWeapon(id:WeaponId){this.input.reset();this.audio.selectWeapon(id);this.simulation.switchWeapon(id);this.publishTelemetry();}
  configure(settings:Settings){this.simulation.configure(settings);this.renderer.applySettings(settings);this.audio.levels(settings);this.publishTelemetry();}
  retryTactical(){this.input.reset();this.audio.stop();this.simulation.retryTactical();this.clock=new FixedClock();this.publishTelemetry();}
  resetTargets(){this.simulation.resetTargets();this.publishTelemetry();}
  resetStatistics(){this.simulation.resetStatistics();this.renderer.clearImpacts();this.publishTelemetry();}
  dispose(){this.disposed=true;this.aimCapture?.dispose();cancelAnimationFrame(this.frame);this.renderer.canvas.removeEventListener('webglcontextlost',this.contextLost);this.renderer.canvas.removeEventListener('mousemove',this.probeMouse);this.renderer.canvas.removeEventListener('mousedown',this.probeClick);this.input.dispose();this.audio.dispose();this.renderer.dispose();this.simulation.onFootstep=null;this.simulation.footsteps.onStep=null;this.simulation.onShot=null;this.simulation.onFinish=null;this.simulation.onKill=null;for(const w of Object.values(this.simulation.weapons))w.onAction=null;}
}

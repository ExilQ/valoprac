import {floorImpactSurface,floorImpactSurfaceAt} from './collision/floorImpact';
import {CombatCapture,type CombatAssessmentContext} from '../aim/CombatCapture';
import { InputLatencyProbe } from '../benchmarks/InputLatencyProbe';
import { RenderCadence } from './rendering/RenderCadence';
import {visibleBetween} from './tactical/levels';
import { Simulation } from './simulation/Simulation';
import { FixedClock } from './simulation/FixedClock';
import { RangeRenderer } from './rendering/RangeRenderer';
import { BrowserInput } from './input/Input';
import { TrainingAudio } from './audio/Audio';
import {spaceForMap} from './audio/soundBank';
import {ReplayRecorder} from './replay/recording';
import type {ReplayRecording} from './replay/types';
import {MovementReview} from './rendering/MovementReview';
import {buildMovementGhost,sampleMovementGhost,type MovementGhost} from '../training/movementTools/GhostFromReplay';
import type {SimulationOptions} from '../training/platform/SessionOptions';
import type {MovementAction,MovementActionResult,MovementPracticeSnapshot} from '../training/movementTools/types';
import type {ExerciseReport} from '../training/exercises/types';
import type { Mode, Settings, WeaponId, GunId, SessionData, SessionSummary } from './types';
import {isPrimary,weaponForSlot} from '../config/weapons';
export interface Telemetry {ghostStatus?:'idle'|'preparing'|'ready'|'failed';ghostError?:string;exercise?:ExerciseReport;movementPractice?:MovementPracticeSnapshot;replayStatus?:'recording'|'complete'|'unavailable'|'preview';replayIssue?:string;graphicsPreparation?:RangeRenderer['preparationStatus'];graphicsReady?:boolean;scopeZoom?:number;scopeLevel?:number;scopeAmount?:number;operatorState?:string;peeking?:import('./tactical/DefenderAI').PeekReport;health?:number;weapon:WeaponId;reserve:number;ads:boolean;summary:SessionSummary|null;time:number;ammo:number;reloading:number|null;score:number;shots:number;speed:number;accurate:boolean;release:number|null;ready:number|null;thresholdDelta:number|null;early:boolean;hit:string;hitAge:number;fps:number;p95:number;calls:number;debt:number;spread:number;recoil:number;grounded:boolean}
export const INITIAL_TELEMETRY:Telemetry={graphicsReady:false,weapon:'rifleA',reserve:50,ads:false,summary:null,time:0,ammo:25,reloading:null,score:0,shots:0,speed:0,accurate:true,release:null,ready:0,thresholdDelta:null,early:false,hit:'miss',hitAge:100,fps:0,p95:0,calls:0,debt:0,spread:0,recoil:0,grounded:true};
export class Runtime {
  graphicsReady=false;private preparationEpoch=0;
  private aimCapture:CombatCapture|null=null;
  private replayRecorder:ReplayRecorder|null=null;private replayState:'recording'|'complete'|'unavailable'|'preview'='preview';private replayIssue:string|undefined;private finishNotified=false;
  private lastExerciseCue=0;private completedReplay:ReplayRecording|null=null;
  private movementReview:MovementReview|null=null;private movementVisual:MovementPracticeSnapshot|null=null;
  private movementGhost:MovementGhost|null=null;private ghostState:'idle'|'preparing'|'ready'|'failed'='idle';private ghostError:string|undefined;private ghostAbort:AbortController|null=null;private ghostStartTime=0;
  private ghostCandidate:{recording:ReplayRecording;startTick:number;endTick:number}|null=null;private ghostCandidateId=-1;
  readonly latency=new InputLatencyProbe();
  /** Weapon that number key 1 returns to: the last primary the player held. */
  private primary:GunId='rifleA';
  simulation:Simulation;renderer:RangeRenderer;input!:BrowserInput;audio=new TrainingAudio();clock=new FixedClock();
  private cadence=new RenderCadence();
  /** Last written crosshair gap: writing a custom property every frame forces style recalculation of the whole HUD subtree. */
  private movementGap=Number.NaN;private lastDraw=0;private frame=0;private previousTime=0;private hudAt=0;private frameTimes=new Float64Array(180);private sampleIndex=0;private sampleCount=0;private preview:boolean;private disposed=false;
  constructor(host:HTMLElement,mode:Mode,weapon:WeaponId,settings:Settings,preview:boolean,
    private onTelemetry:(t:Telemetry)=>void,private onLock:(locked:boolean)=>void,private onError:(message:string)=>void,private onFinish:(data:SessionData)=>void,private onWeapon:(id:WeaponId)=>void=()=>{},private assessment?:CombatAssessmentContext,options:SimulationOptions={}){
    this.preview=preview;if(isPrimary(weapon))this.primary=weapon;this.simulation=new Simulation(mode,weapon,settings,options);this.renderer=new RangeRenderer(host,this.simulation,settings);
    this.audio.setOcclusionResolver((source,listener)=>!visibleBetween(this.simulation.obstacles,listener,source));
    // Sounds render in a worker while the briefing is open; the map picks the room.
    if(!preview)this.audio.prefetch(weapon,spaceForMap(this.simulation.practiceMap));this.audio.setSpace(spaceForMap(this.simulation.practiceMap));
    if(!preview){this.movementReview=new MovementReview();this.renderer.scene.add(this.movementReview.root);}
    this.bindSimulation();
    this.renderer.canvas.addEventListener('webglcontextlost',this.contextLost);
    this.renderer.canvas.addEventListener('mousemove',this.probeMouse,{passive:true});this.renderer.canvas.addEventListener('mousedown',this.probeClick,{passive:true});
    this.prepareGraphics();this.frame=requestAnimationFrame(this.animate);
  }
  /** Bind callbacks to a fresh authority while retaining renderer resources. */
  private bindSimulation(){
    // The renderer attaches displayed-target history before recording begins.
    // Preview navigation never creates a training recording.
    if(!this.preview){try{this.replayRecorder=new ReplayRecorder(this.simulation);this.replayState='recording';}catch(error){this.recordingUnavailable(error);}}
    this.input=new BrowserInput(this.renderer.canvas,this.simulation,this.handleLock,this.onError,()=>this.publishTelemetry(),slot=>{const id=weaponForSlot(slot,this.primary);if(!id||this.disposed||this.preview||id===this.simulation.weaponId)return;this.switchWeapon(id);this.onWeapon(id);},action=>{this.performMovementAction(action);});
    if(!this.preview){this.aimCapture=new CombatCapture(this.simulation,()=>this.input.rawMode,this.assessment,()=>this.input.rawConfirmation);this.input.observer=this.aimCapture;}
    if(this.simulation.defenders){this.simulation.defenders.onShot=e=>{if(this.simulation.defenders?.memories[e.bot]?.lastShot!==e)return;if(e.observed){this.audio.enemyShot(e.weapon,e.origin,e.time,e.bot);this.audio.impacts(e.penetration??[],e.time,.55);const floor=floorImpactSurfaceAt(this.simulation.practiceMap,e.impact,this.simulation.rules);if(floor)this.audio.surfaceImpact(floor,e.impact,e.time,.55,`enemy-floor:${e.bot}`);}this.renderer.addDefenderShot({...e,segments:e.penetration});};this.simulation.defenders.onFootstep=event=>this.audio.botFootstep(event.bot,event);}
    this.simulation.onFootstep=e=>this.audio.footstep(e);
    this.simulation.onLanding=e=>this.audio.landing(e);
    this.simulation.onJump=e=>this.audio.jump(e);
    this.simulation.onShot=s=>{if(s.lifeGeneration!==undefined&&s.lifeGeneration!==this.simulation.lifeGeneration)return;this.renderer.addShot(s);this.audio.shot(s);const floor=floorImpactSurface(this.simulation.practiceMap,s,this.simulation.rules);if(floor)this.audio.surfaceImpact(floor,s.impact,s.timestamp);this.aimCapture?.shot(s);};
    for(const w of Object.values(this.simulation.weapons))w.onAction=action=>this.audio.action(w.profile.id,action);
    this.simulation.onFinish=()=>this.deliverSession();
    this.simulation.onKill=()=>this.audio.kill(this.simulation.time);
    this.simulation.onMelee=e=>{if(e.lifeGeneration!==this.simulation.lifeGeneration)return;this.renderer.addMelee(e);this.audio.melee(e);};
  }
  private unbindSimulation(){
    this.input?.dispose();this.aimCapture?.dispose();this.aimCapture=null;this.replayRecorder?.dispose();this.replayRecorder=null;
    const s=this.simulation;if(s.defenders){s.defenders.onShot=null;s.defenders.onFootstep=null;}s.onFootstep=null;s.onLanding=null;s.landings.onLanding=null;s.footsteps.onStep=null;s.onShot=null;s.onMelee=null;s.onFinish=null;s.onKill=null;for(const w of Object.values(s.weapons))w.onAction=null;
  }
  private probeMouse=(e:MouseEvent)=>{if(this.input.locked)this.latency.mark('look',e.timeStamp,performance.now());};
  private probeClick=(e:MouseEvent)=>{if(this.input.locked&&e.button===0)this.latency.mark('click',e.timeStamp,performance.now());};
  private handleLock=(locked:boolean)=>{if(this.preview)return;this.simulation.running=locked&&!this.simulation.completed;this.previousTime=0;if(!locked){this.audio.stop();this.latency.clearPending();}else this.audio.sync(this.simulation.time);this.onLock(locked);};
  prepareGraphics(){if(this.renderer.preparationReady)return;const epoch=++this.preparationEpoch;this.graphicsReady=false;void this.renderer.prepare().then(()=>{if(this.disposed||epoch!==this.preparationEpoch)return;this.graphicsReady=false;this.previousTime=0;this.publishTelemetry();}).catch(error=>{if(this.disposed||epoch!==this.preparationEpoch)return;console.error(error);this.onError('훈련 그래픽을 준비하지 못했습니다. 다시 준비하거나 하드웨어 가속 설정을 확인하세요.');this.publishTelemetry();});}
  async resume(capture=false){if(this.disposed||this.preview)return;if(!this.graphicsReady){this.onError('훈련 그래픽을 준비하고 있습니다. 준비가 끝나면 시작하세요.');this.prepareGraphics();return;}void this.audio.unlock().then(()=>{this.audio.levels(this.simulation.settings);this.audio.sync(this.simulation.time);}).catch(()=>this.onError('소리를 활성화하지 못했습니다. 소리 없이 훈련을 진행합니다.'));this.audio.levels(this.simulation.settings);if(capture)await this.input.captureKeyboard(this.renderer.canvas.closest('.game-stage') as HTMLElement??this.renderer.canvas);await this.input.lock();}
  flushAimAssessment(){return this.aimCapture?.flush()??Promise.resolve([]);}
  replaySnapshot(){return this.completedReplay??this.replayRecorder?.snapshot()??null;}
  getMovementGhost(){return this.movementGhost;}
  private clearMovementReview(){this.ghostAbort?.abort();this.ghostAbort=null;this.ghostCandidate=null;this.ghostCandidateId=-1;this.movementGhost=null;this.movementVisual=null;this.ghostState='idle';this.ghostError=undefined;}
  async prepareMovementGhost():Promise<boolean>{
    const candidate=this.ghostCandidate;if(this.disposed||!candidate){this.ghostState='failed';this.ghostError='완료한 점프·착지 시도가 필요합니다. 기록이 너무 길면 새 훈련에서 시도하세요.';this.publishTelemetry();return false;}
    this.ghostAbort?.abort();const controller=this.ghostAbort=new AbortController(),source=this.simulation;this.ghostState='preparing';this.ghostError=undefined;this.publishTelemetry();
    try{const ghost=await buildMovementGhost(candidate.recording,{startTick:candidate.startTick,endTick:candidate.endTick},{signal:controller.signal});if(this.disposed||controller.signal.aborted||source!==this.simulation)return false;this.movementGhost=ghost;this.ghostStartTime=source.time;this.ghostState='ready';return true;}
    catch(error){if(!controller.signal.aborted&&!this.disposed){this.ghostState='failed';this.ghostError=error instanceof Error?error.message:'고스트를 준비하지 못했습니다.';}return false;}
    finally{if(this.ghostAbort===controller)this.ghostAbort=null;if(!this.disposed&&source===this.simulation)this.publishTelemetry();}
  }
  /** Keep elapsed simulation time monotonic when a practice action teleports. */
  performMovementAction(action:MovementAction):MovementActionResult {
    if(this.disposed||this.preview||this.simulation.completed)return{ok:false,message:'진행 중인 훈련에서 이동 도구를 사용하세요.'};
    const result=this.simulation.trainingAction(action);
    if(result.ok&&result.restored){this.ghostStartTime=this.simulation.time;this.input.reset();this.clock=new FixedClock();this.previousTime=0;this.latency.clearPending();this.renderer.clearImpacts();}
    this.onError(result.ok?'':result.message);this.publishTelemetry();return result;
  }
  /** A retry starts a new authority/recording, retaining the prepared map and
   * viewmodel resources. It never rewinds a continuing replay's clock. */
  restartExercise():boolean {
    const old=this.simulation;
    if(this.disposed||this.preview||!old.options.exercise||!old.completed||!this.finishNotified)return false;
    let next:Simulation;
    try{next=new Simulation(old.mode,old.weaponId,old.settings,old.options);}catch(error){this.onError(error instanceof Error?error.message:'훈련을 다시 준비하지 못했습니다.');return false;}
    if(next.practiceMap!==old.practiceMap||next.targets.length!==old.targets.length||next.targets.some((target,i)=>target.parts.length!==old.targets[i].parts.length))return false;
    this.audio.resetSession(next.time);this.unbindSimulation();this.simulation=next;this.renderer.simulation=next;next.renderedTargets.attach();
    this.finishNotified=false;this.replayState='preview';this.replayIssue=undefined;this.completedReplay=null;this.lastExerciseCue=0;this.clearMovementReview();
    this.clock=new FixedClock();this.cadence.reset();this.previousTime=0;this.lastDraw=0;this.hudAt=0;this.sampleIndex=0;this.sampleCount=0;this.frameTimes.fill(0);this.latency.clearPending();
    this.bindSimulation();this.renderer.clearImpacts();this.renderer.applySettings(next.settings);this.graphicsReady=this.renderer.preparationReady;
    this.audio.levels(next.settings);this.onError('');this.onLock(false);this.prepareGraphics();this.publishTelemetry();return true;
  }
  finish(){if(this.finishNotified)return;this.simulation.completed=true;this.simulation.running=false;this.deliverSession();}
  private recordingUnavailable(reason:unknown){
    if(this.preview)return;const detail=typeof reason==='string'?reason:reason instanceof Error?reason.message:'';
    this.replayState='unavailable';const message='리플레이를 기록하지 못했습니다. 훈련과 결과 저장은 계속됩니다.'+(detail?' '+detail.slice(0,200):'');
    if(this.replayIssue===message)return;this.replayIssue=message;this.onError(message);
  }
  private pollRecording(){if(this.replayState!=='recording'||!this.replayRecorder)return;const status=this.replayRecorder.status;if(status.state==='failed')this.recordingUnavailable(status.reason??'기록 제한을 초과했습니다.');}
  private deliverSession(){
    if(this.finishNotified||this.disposed)return;this.finishNotified=true;const data=this.simulation.snapshot();
    if(this.replayRecorder){try{const replay=this.replayRecorder.finish();if(replay){data.replay=replay;this.completedReplay=replay;this.replayState='complete';}else this.recordingUnavailable(this.replayRecorder.status.reason??'완전한 기록을 만들지 못했습니다.');}catch(error){this.recordingUnavailable(error);try{this.replayRecorder.dispose();}catch{/* Recording failure must not interrupt result delivery. */}}}
    if(this.replayIssue)data.replayIssue=this.replayIssue;
    if(document.pointerLockElement===this.renderer.canvas)document.exitPointerLock();this.onFinish(data);
  }
  private contextLost=(event:Event)=>{event.preventDefault();this.simulation.running=false;this.input.reset();this.audio.stop();if(this.input.locked)document.exitPointerLock();this.onError('그래픽 연결이 중단되었습니다. 결과를 저장한 뒤 새로고침하세요.');};
  private animate=(now:number)=>{
    try{this.renderFrame(now);}catch(error){console.error(error);this.simulation.running=false;this.input.reset();this.audio.stop();if(this.input.locked)document.exitPointerLock();this.onError('훈련 화면에 오류가 발생했습니다. 결과를 저장한 뒤 새로고침하세요.');}
  };
  private renderFrame=(now:number)=>{
    if(this.disposed)return;
    const movement=this.simulation.movement;
    this.audio.listener({x:movement.position.x,y:movement.position.y+movement.eyeHeight,z:movement.position.z},this.simulation.viewYaw,this.simulation.viewPitch);
    if(!this.previousTime&&this.simulation.running)this.input.startMovementClock(this.simulation.time,now);
    const elapsed=this.previousTime?(now-this.previousTime)/1000:0;this.previousTime=now;

    if(this.simulation.exposure.death&&this.input.locked){this.input.reset();document.exitPointerLock();this.audio.stop();this.onLock(false);}
    if(this.simulation.running&&elapsed>0.5){this.audio.stop();this.simulation.running=false;this.input.reset();if(this.input.locked)document.exitPointerLock();this.onLock(false);this.onError('긴 화면 정지를 감지해 일시정지했습니다. 클릭하면 이어서 훈련합니다.');}
    let alpha=1;if(this.simulation.running)alpha=this.clock.advance(elapsed,this.step);
    if(this.renderer.preparationReady&&this.cadence.shouldDraw(now,this.preview?30:this.renderer.effectiveFrameLimit??this.simulation.settings.frameLimit)){
      const drawElapsed=this.lastDraw?(now-this.lastDraw)/1000:elapsed;this.lastDraw=now;
      this.frameTimes[this.sampleIndex++%this.frameTimes.length]=drawElapsed*1000;this.sampleCount=Math.min(this.sampleCount+1,this.frameTimes.length);
      const tools=this.simulation.settings.movementTools;if(this.movementReview&&tools){const start=this.movementVisual?.current?.startTime??this.ghostStartTime;this.movementReview.update(tools,this.movementVisual,this.movementGhost,this.movementGhost?sampleMovementGhost(this.movementGhost,this.simulation.time-start):null);}
      this.renderer.render(alpha,drawElapsed,this.preview,this.simulation.ads);if(!this.graphicsReady){this.graphicsReady=true;this.publishTelemetry();}this.aimCapture?.frame(performance.now());this.latency.submitted(performance.now());
    }
    const root=this.renderer.canvas.parentElement;
    if(root){const w=this.simulation.weapon,m=this.simulation.movement;const error=(m.accurate?0:Math.min(22,m.speed*3))+(this.simulation.settings.dynamicCrosshair?w.bloom*10:0);const gap=this.simulation.settings.dynamicCrosshair?Math.round(error*4)/4:0;if(gap!==this.movementGap){this.movementGap=gap;root.style.setProperty('--movement-gap',`${gap}px`);}}
    if(!this.preview&&now-this.hudAt>=90){this.hudAt=now;this.publishTelemetry();}
    this.frame=requestAnimationFrame(this.animate);
  };
  private step=(dt:number)=>{const s=this.simulation,landing=s.movement.landingSerial,jump=s.movement.jumpSerial;s.step(dt,this.input.consumeMovementTick(dt,s.time));if(s.movement.jumpSerial!==jump)this.ghostStartTime=s.time;const cue=s.exercise?.currentCue;if(cue&&cue.id!==this.lastExerciseCue){this.lastExerciseCue=cue.id;this.audio.trainingCue(cue.source,cue.cueTime);}
    if(s.settings.movementTools?.enabled&&s.movement.landingSerial!==landing){const attempt=s.movementPractice.snapshot().last;if(attempt&&attempt.id!==this.ghostCandidateId&&attempt.endTick>attempt.startTick){this.ghostCandidateId=attempt.id;this.ghostCandidate=null;const count=this.replayRecorder?.status.commands??Infinity;if(count<=120000){const recording=this.replaySnapshot();if(recording)this.ghostCandidate={recording,startTick:attempt.startTick,endTick:attempt.endTick};}else{this.ghostError='고스트 복원용 입력 한도에 도달했습니다. 새 훈련에서 시도하세요.';if(!this.movementGhost)this.ghostState='failed';}}}
  };
  private publishTelemetry(){
    this.pollRecording();const s=this.simulation,w=s.weapon,b=s.braking;const times=Array.from(this.frameTimes.subarray(0,this.sampleCount)).filter(t=>t>0).sort((a,b)=>a-b);const average=times.length?times.reduce((a,b)=>a+b,0)/times.length:0;
    const movementReady=s.movement.estimateReadyTime(this.input.state,this.input.state.movementYaw??s.yaw,1/120,s.weaponId==='operator'?5.13*.72*.15:s.movement.profile.accuracyVelocityThreshold);const ready=s.weaponId==='operator'?(!s.ads||movementReady===null?null:Math.max(movementReady,w.scopeReadyAt-s.time,.225-(s.time-s.movement.landedAt),0)):movementReady;
    const last=s.shots[s.shots.length-1];this.movementVisual=s.settings.movementTools?.enabled?s.movementPractice.snapshot():null;this.onTelemetry({ghostStatus:this.ghostState,ghostError:this.ghostError,exercise:s.exercise?.snapshot(),movementPractice:this.movementVisual??undefined,replayStatus:this.replayState,replayIssue:this.replayIssue,graphicsPreparation:this.renderer.preparationStatus,graphicsReady:this.graphicsReady,scopeZoom:s.scopeZoom,scopeLevel:s.scopeLevel,scopeAmount:s.weaponId==='operator'?w.scopeAmount:0,operatorState:s.weaponId==='operator'?w.operatorState:undefined,peeking:s.defenders?.snapshot(),health:s.defenders?.health,weapon:s.weaponId,reserve:w.reserve,ads:s.ads,summary:s.hudSummary(),time:s.time,ammo:w.ammo,reloading:w.reloadingUntil===null?null:Math.max(0,w.reloadingUntil-s.time),score:s.stats.eliminations,shots:s.stats.shots,speed:s.movement.speed,accurate:s.weaponId==='operator'?s.ads&&w.scopeAmount>.98&&s.time>=w.scopeReadyAt&&s.movement.grounded&&s.movement.speed<=5.13*.72*.15&&s.time-s.movement.landedAt>=.225:s.movement.accurate,release:b.releaseTime===null?null:s.time-b.releaseTime,ready,thresholdDelta:last?.thresholdDelta??null,early:s.time-s.lastEarlyAt<0.3,hit:s.lastHit,hitAge:s.time-s.lastHitAt,fps:average?1000/average:0,p95:times[Math.floor(times.length*0.95)]??0,calls:this.renderer.calls,debt:this.clock.deferredTicks,spread:w.spread.total,recoil:w.recoil.pitch,grounded:s.movement.grounded});
  }
  /** Weapon swaps keep held movement keys; only trigger/aim intent is released. */
  switchWeapon(id:WeaponId){if(isPrimary(id))this.primary=id;if(id===this.simulation.weaponId){this.publishTelemetry();return;}this.input.releaseCombat();this.audio.selectWeapon(id);this.simulation.switchWeapon(id);this.renderer.refreshKnifeSkin();this.publishTelemetry();}
  setPrimary(id:GunId){if(isPrimary(id))this.primary=id;}
  get primaryWeapon(){return this.primary;}
  configure(settings:Settings){
    const before=this.simulation.settings;
    const movementChanged=before.movementPhysics!==settings.movementPhysics||before.csMovementPreset!==settings.csMovementPreset||before.jumpBufferMs!==settings.jumpBufferMs||before.wheelJump!==settings.wheelJump;
    if(movementChanged){this.clearMovementReview();this.input.reset();this.clock=new FixedClock();this.previousTime=0;this.latency.clearPending();}
    this.simulation.configure(settings);this.renderer.applySettings(settings);this.prepareGraphics();this.audio.levels(settings);this.publishTelemetry();
  }
  retryTactical(){this.input.reset();this.audio.stop();this.simulation.retryTactical();this.clock=new FixedClock();this.previousTime=0;this.renderer.clearImpacts();this.latency.clearPending();this.publishTelemetry();}
  resetTargets(){this.simulation.resetTargets();this.publishTelemetry();}
  resetStatistics(){this.simulation.resetStatistics();this.renderer.clearImpacts();this.publishTelemetry();}
  dispose(){this.disposed=true;this.clearMovementReview();this.movementReview?.dispose();this.movementReview=null;cancelAnimationFrame(this.frame);this.renderer.canvas.removeEventListener('webglcontextlost',this.contextLost);this.renderer.canvas.removeEventListener('mousemove',this.probeMouse);this.renderer.canvas.removeEventListener('mousedown',this.probeClick);this.unbindSimulation();this.audio.dispose();this.renderer.dispose();}
}

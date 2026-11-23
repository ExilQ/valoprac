import {BrowserInput,type InputObserver} from '../engine/input/Input';
import {angularGain,adsFov,DEG} from '../engine/input/sensitivity';
import type {Settings} from '../engine/types';
import {MouseTelemetry} from './Telemetry';
import {AimTargetPath} from './tasks';
import {aimAnalysis} from './AnalysisService';
import {saveAimRecord,aimDataEpoch} from './storage';
import {conditionKey} from './experiments';
import {projectAngularTarget} from './projection';
import {calibrationFromSettings,calibrationFingerprint} from './precision/calibration';
import {AIM_VERSION,GAME_VERSION,trackingTask,type AimPlan,type AimRecord,type AimMeta} from './types';
export interface AimHud {status:'ready'|'warmup'|'measuring'|'paused'|'break'|'finished';block:number;trial:number;remaining:number;events:number;error:string;lastHit:boolean|null;processing:number;invalidBlock?:boolean;}
interface DrawnTarget {at:number;x:number;y:number;visible:boolean;}
/** A controlled assessment, using the exact ordinary BrowserInput gain path.
 * Model fitting/segmentation/storage happen after a trial, never in look(). */
export class AimRuntime implements InputObserver {
 private appearanceAt:number|null=null;
 private projected={x:0,y:0,radius:0,visible:false};
 readonly canvas:HTMLCanvasElement;readonly input:BrowserInput;readonly telemetry=new MouseTelemetry();readonly settings:Settings;
 running=false;yaw=0;pitch=0;blockIndex=0;trialIndex=0;
 private ctx:CanvasRenderingContext2D;private raf=0;private lastFrame=0;private hudAt=0;private startAt=0;private warmupAt=0;private warmupComplete=false;private path:AimTargetPath;private disposed=false;private phase:AimHud['status']='ready';private attempt=0;private anchorX=0;private anchorY=0;private target={x:0,y:0};private frames:number[]=[];private issues:string[]=[];private error='';private inputError='';private lastHit:boolean|null=null;private processing=0;
 private shown:DrawnTarget[]=Array.from({length:32},()=>({at:0,x:0,y:0,visible:false}));private shownCount=0;private shownCursor=-1;private shotVisible:boolean|undefined;
 private trialViewport:[number,number]=[0,0];
 private blockFailure=false;private reportedBlock=-1;
 constructor(host:HTMLElement,readonly plan:AimPlan,settings:Settings,private publish:(h:AimHud)=>void,private onRecord:(r:AimRecord)=>void,private onProgress?:(nextBlock:number)=>void){
  if(!plan.blocks.length)throw new Error('측정할 과제가 없습니다.');
  this.blockIndex=Math.min(plan.blocks.length-1,Math.max(0,Math.floor(plan.resumeBlock??0)));
  this.settings={...settings,bindings:{...settings.bindings},sensitivity:this.block.sensitivity,degreesPerCount:plan.coefficient,fov:plan.fov,adsSensitivity:plan.adsMultiplier??settings.adsSensitivity,...(plan.adsMultiplier!==undefined&&this.scopeZoom>=1.75?this.scopeZoom>=3.75?{scopeSensitivity5:plan.adsMultiplier}:{scopeSensitivity25:plan.adsMultiplier}:{})};
  this.path=new AimTargetPath(this.block);this.canvas=document.createElement('canvas');this.canvas.className='aim-canvas';this.canvas.setAttribute('aria-label','중립 각도 측정 훈련 화면');host.appendChild(this.canvas);
  const ctx=this.canvas.getContext('2d',{alpha:false});if(!ctx){this.canvas.remove();throw new Error('이 브라우저에서 측정 화면을 시작하지 못했습니다.');}this.ctx=ctx;
  this.input=new BrowserInput(this.canvas,this,this.lockChange,message=>{if(message&&this.input?.locked)return;this.inputError=message;this.emit();});this.input.observer=this;
  document.addEventListener('visibilitychange',this.visibilityChanged);document.addEventListener('fullscreenchange',this.fullscreenChanged);window.addEventListener('blur',this.focusLost);
  this.raf=requestAnimationFrame(this.animate);this.emit();
 }
 get block(){return this.plan.blocks[this.blockIndex];}
 get viewYaw(){return this.yaw;}get viewPitch(){return this.pitch;}
 get heading(){return -this.yaw/DEG;}get elevation(){return this.pitch/DEG;}
 get scopeZoom(){return this.plan.scopeZoom??(this.plan.evaluationMode==='rifle-ads'?1.25:this.plan.evaluationMode==='operator-2.5'?2.5:this.plan.evaluationMode==='operator-5'?5:1);}
 get scoped(){return this.scopeZoom>1;}
 get displayFov(){return adsFov(this.plan.fov,this.scopeZoom);}
 look(dx:number,dy:number){const gain=angularGain(this.settings,this.scoped,this.scopeZoom);this.yaw-=dx*gain*DEG;this.pitch=Math.max(-1.48,Math.min(1.48,this.pitch-dy*gain*DEG));}
 async resume(){if(this.disposed||this.processing)return;this.inputError='';await this.input.lock();}
 private lockChange=(locked:boolean)=>{if(this.disposed)return;if(locked){if(this.phase==='break'||this.phase==='finished'){document.exitPointerLock();return;}this.running=true;this.lastFrame=0;if(!this.warmupComplete){this.phase='warmup';this.warmupAt=performance.now();this.beginTrial();}else if(this.phase==='paused'){this.beginTrial();this.phase='measuring';}}else{if(this.running&&this.phase==='measuring')this.complete('interrupted',false);this.running=false;if(this.phase!=='break'&&this.phase!=='finished')this.phase='paused';}this.emit();};
 private pause(issue:string){if(!this.running)return;if(this.phase==='measuring')this.complete(issue,false);this.running=false;this.phase='paused';this.inputError=issue==='frame-gap'?'화면 갱신이 250ms 이상 중단되어 현재 시도를 제외했습니다.':issue==='viewport-changed'||issue==='fullscreen-changed'?'화면 조건이 바뀌어 현재 시도를 제외했습니다.':issue==='pre-display-click'?'표적이 처음 그려지기 전 클릭은 제외했습니다.':'초점이나 화면 표시가 중단되어 현재 시도를 제외했습니다.';if(this.input.locked)document.exitPointerLock();this.emit();}
 private focusLost=()=>this.pause('focus-loss');
 private visibilityChanged=()=>{if(document.hidden)this.pause('visibility-loss');};
 private fullscreenChanged=()=>{if(this.phase==='measuring')this.pause('fullscreen-changed');};
 private beginTrial(){
  this.startAt=performance.now();this.appearanceAt=null;this.telemetry.clear();this.issues=[];this.frames=[];this.attempt++;this.shownCount=0;this.shownCursor=-1;this.shotVisible=undefined;this.anchorX=this.heading;this.anchorY=this.elevation;this.trialViewport=[this.canvas.clientWidth,this.canvas.clientHeight];
  if(trackingTask(this.block.task)){this.path=new AimTargetPath(this.block);this.path.update(0);}else{if(this.block.task==='switch'&&this.trialIndex===0)this.path.setSwitchAnchor(this.heading,this.elevation);this.path.point(this.trialIndex,this.heading,this.elevation);}
  this.record(2,0,0,this.startAt,this.startAt,this.yaw,this.pitch);
 }
 private targetAt(t:number){if(trackingTask(this.block.task)){this.path.sample(t,this.target);this.target.x+=this.anchorX;this.target.y+=this.anchorY;}else if(this.block.task==='dynamic')this.path.sample(t,this.target);else{this.target.x=this.path.x;this.target.y=this.path.y;}return this.target;}
 private shownAt(stamp:number){for(let n=0;n<this.shownCount;n++){const frame=this.shown[(this.shownCursor-n+this.shown.length)%this.shown.length];if(frame.at<=stamp)return frame;}return undefined;}
 private record(kind:number,dx:number,dy:number,stamp:number,received:number,beforeYaw:number,beforePitch:number){
  // Rows preserve callback delivery order. The original monotonic event time is
  // exactly recoverable as row[0] - row[9]/1000; it selects the displayed target.
  const t=Math.max(0,(received-this.startAt)/1000),shown=this.shownAt(stamp),target=shown??this.targetAt(t),tx=target.x*DEG,ty=target.y*DEG;
  if(kind===1)this.shotVisible=shown?.visible??false;
  this.telemetry.push(t,dx,dy,this.heading,this.elevation,target.x,target.y,this.block.radius,kind,Math.max(0,received-stamp),-(this.yaw-beforeYaw)/DEG,(this.pitch-beforePitch)/DEG,0,1.64,0,20*Math.sin(tx)*Math.cos(ty),1.64+20*Math.sin(ty),-20*Math.cos(tx)*Math.cos(ty),0,0,this.scoped?1:0);
 }
 sample(kind:0|1,dx:number,dy:number,stamp:number,received:number,beforeYaw:number,beforePitch:number){
  if(!this.running||this.phase==='break')return;this.record(kind,dx,dy,stamp,received,beforeYaw,beforePitch);
  if(kind===1&&!trackingTask(this.block.task)){
   if(this.phase==='warmup'){this.path.point(++this.trialIndex,this.heading,this.elevation);this.startAt=received;this.shownCount=0;this.shownCursor=-1;}
   else if(this.phase==='measuring'){
    if(this.appearanceAt===null){this.pause('pre-display-click');return;}
    this.complete();
   }
  }
 }
 private complete(issue?:string,advance=true){
  if(this.phase==='warmup')return;
  const block=this.block,t=(performance.now()-this.startAt)/1000,buffer=this.telemetry.snapshot(),orderedFrames=this.frames.slice().sort((a,b)=>a-b),percentile=(q:number)=>orderedFrames[Math.min(orderedFrames.length-1,Math.floor(orderedFrames.length*q))];
  const issues=[...this.issues,...(this.appearanceAt===null?['pre-display-click']:[]),...(issue?[issue]:[]),...(this.telemetry.overflow?['buffer-overflow']:[]),...(this.telemetry.reordered?['timestamp-reordered']:[])];
  const calibration=calibrationFromSettings(this.settings,{dpi:this.plan.dpi,viewport:[this.canvas.clientWidth,this.canvas.clientHeight],inputMode:this.input.rawMode,rawRequest:this.input.rawConfirmation,ads:this.scoped,weapon:this.plan.weapon,scopeZoom:this.scopeZoom});
  const meta:AimMeta={schema:1,id:`${block.id}-${this.trialIndex}-${this.attempt}`,experiment:this.plan.id,session:block.session,createdAt:Date.now(),algorithm:AIM_VERSION,game:GAME_VERSION,task:block.task,phase:block.phase,sensitivity:block.sensitivity,dpi:this.plan.dpi,dpiSource:'user-declared',coefficient:this.plan.coefficient,fov:this.plan.fov,ads:this.scoped,adsMultiplier:calibration.adsMultiplier,projectionModel:calibration.projectionModel,rawMode:this.input.rawMode,rawRequest:this.input.rawConfirmation,pointerLocked:this.input.locked,renderer:'angular-canvas',seed:block.seed,round:block.round,pair:block.pair,order:block.order,radius:block.radius,amplitude:block.amplitude,duration:t,warmup:block.warmup,condition:conditionKey(block,this.plan),valid:!issues.length,issues,appearanceKnown:this.appearanceAt!==null,monotonicStartMs:this.startAt,timeOriginMs:performance.timeOrigin,appearanceTime:this.appearanceAt===null?undefined:(this.appearanceAt-this.startAt)/1000,distance:20,targetDiameter:2*Math.tan(block.radius*DEG)*20,viewport:[this.canvas.clientWidth,this.canvas.clientHeight],renderScale:Math.min(2,devicePixelRatio||1),eventTimestampClock:'receipt-with-original-delay',inputFingerprint:calibrationFingerprint(calibration),calibration,protocol:this.plan.protocol,protocolId:this.plan.protocolId,stage:this.plan.stage,evaluationMode:this.plan.evaluationMode??'hip',scopeZoom:this.scopeZoom,weapon:this.plan.weapon,expectedTrials:block.trials,expectedTasks:[...new Set(this.plan.blocks.map(b=>b.task))],blockId:block.id,trialIndex:this.trialIndex,inputEventHz:t>0?this.telemetry.inputEvents/t:0,targetVisibleAtShot:this.shotVisible,...(Number.isFinite(this.path.exposureSeconds)?{targetExposureSeconds:this.path.exposureSeconds}:{}),...(orderedFrames.length?{frameP95:percentile(.95),frameMedian:percentile(.5),frameP99:percentile(.99),frameSamples:orderedFrames.length}:{})};
  const epoch=aimDataEpoch();this.processing++;
  void aimAnalysis.run(buffer,meta).then(async r=>{this.lastHit=r.metrics.hit;if(advance&&(!r.meta.valid||!r.metrics.valid))this.blockFailure=true;await saveAimRecord(r,epoch);if(!this.disposed&&epoch===aimDataEpoch())this.onRecord(r);}).catch(()=>{if(advance)this.blockFailure=true;this.error='일부 측정의 분석·저장에 실패했습니다. 실패한 데이터로 감도를 추천하지 않습니다.';}).finally(()=>{this.processing--;if(!this.disposed){if(!this.processing&&!this.blockFailure&&(this.phase==='break'||this.phase==='finished')&&this.reportedBlock!==this.blockIndex){this.reportedBlock=this.blockIndex;this.onProgress?.(this.blockIndex+1);}this.emit();}});
  if(!advance)return;
  this.trialIndex++;
  if(this.trialIndex>=block.trials){this.phase=this.blockIndex+1>=this.plan.blocks.length?'finished':'break';this.running=false;if(this.input.locked)document.exitPointerLock();this.emit();}else this.beginTrial();
 }
 next(){if(this.phase!=='break'||this.processing||this.blockFailure)return;this.blockIndex++;this.trialIndex=0;this.warmupComplete=false;this.settings.sensitivity=this.block.sensitivity;this.path=new AimTargetPath(this.block);this.phase='ready';this.lastHit=null;this.blockFailure=false;this.emit();}
 retryBlock(){if(this.running||this.processing)return;this.trialIndex=0;this.warmupComplete=false;this.phase='ready';this.lastHit=null;this.blockFailure=false;this.error='';this.path=new AimTargetPath(this.block);this.emit();}
 private step=(now:number)=>{
  if(!this.running)return;
  if(this.phase==='warmup'){if(now-this.warmupAt>=this.block.warmup*1000){this.phase='measuring';this.warmupComplete=true;this.trialIndex=0;this.beginTrial();}return;}
  if(this.phase!=='measuring')return;
  const time=(now-this.startAt)/1000;
  if(trackingTask(this.block.task)||this.block.task==='dynamic'){this.path.update(time);if(this.path.changed)this.record(3,0,0,now,now,this.yaw,this.pitch);}
  this.record(2,0,0,now,now,this.yaw,this.pitch);
  if(time>=this.block.duration)this.complete();
 };
 private animate=(_frame:number)=>{
  if(this.disposed)return;const now=performance.now(),dt=this.lastFrame?(now-this.lastFrame)/1000:0;this.lastFrame=now;
  if(this.running){
   if(dt>.25)this.pause('frame-gap');
   else if(this.phase==='measuring'&&(this.trialViewport[0]!==this.canvas.clientWidth||this.trialViewport[1]!==this.canvas.clientHeight))this.pause('viewport-changed');
   else{if(dt>0&&this.frames.length<2400)this.frames.push(dt*1000);this.step(now);}
  }
  this.draw(now);if(now-this.hudAt>100){this.hudAt=now;this.emit();}this.raf=requestAnimationFrame(this.animate);
 };
 private emit(){this.publish({status:this.phase,block:this.blockIndex,trial:this.trialIndex,remaining:this.phase==='warmup'?Math.max(0,this.block.warmup-(performance.now()-this.warmupAt)/1000):Math.max(0,this.block.duration-(performance.now()-this.startAt)/1000),events:this.telemetry.count,error:this.error||this.inputError,lastHit:this.lastHit,processing:this.processing,invalidBlock:this.blockFailure});}
 private draw(now:number){
  const c=this.canvas,ctx=this.ctx,w=c.clientWidth,h=c.clientHeight,dpr=Math.min(2,devicePixelRatio||1);
  if(c.width!==Math.round(w*dpr)||c.height!==Math.round(h*dpr)){c.width=Math.round(w*dpr);c.height=Math.round(h*dpr);}
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='#111c23';ctx.fillRect(0,0,w,h);ctx.strokeStyle='#20313b';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(w/2,0);ctx.lineTo(w/2,h);ctx.moveTo(0,h/2);ctx.lineTo(w,h/2);ctx.stroke();
  if(this.running){
   const t=Math.max(0,(now-this.startAt)/1000),p=this.targetAt(t);
   if(this.block.task==='switch'){ctx.fillStyle='#4c626b';for(let i=0;i<4;i++){const q=projectAngularTarget(this.projected,this.heading,this.elevation,this.path.switchX[i],this.path.switchY[i],this.block.radius,this.displayFov,w,h);if(q.visible){ctx.beginPath();ctx.arc(q.x,q.y,q.radius,0,Math.PI*2);ctx.fill();}}}
   const q=projectAngularTarget(this.projected,this.heading,this.elevation,p.x,p.y,this.block.radius,this.displayFov,w,h),visible=q.visible&&q.x+q.radius>=0&&q.x-q.radius<=w&&q.y+q.radius>=0&&q.y-q.radius<=h&&this.path.visible(t);
   if(visible){ctx.fillStyle=this.phase==='warmup'?'#80939c':'#ef726a';ctx.beginPath();ctx.arc(q.x,q.y,q.radius,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#ffd5bc';ctx.lineWidth=1.5;ctx.stroke();}
   const submittedAt=performance.now();this.shownCursor=(this.shownCursor+1)%this.shown.length;const frame=this.shown[this.shownCursor];frame.at=submittedAt;frame.x=p.x;frame.y=p.y;frame.visible=visible;this.shownCount=Math.min(this.shown.length,this.shownCount+1);
   if(visible&&this.phase==='measuring'&&this.appearanceAt===null)this.appearanceAt=submittedAt;
  }
  ctx.strokeStyle=this.settings.crosshairColor;ctx.lineWidth=this.settings.crosshairThickness;const gap=this.settings.crosshairGap,length=this.settings.crosshairLength;ctx.beginPath();ctx.moveTo(w/2-gap-length,h/2);ctx.lineTo(w/2-gap,h/2);ctx.moveTo(w/2+gap,h/2);ctx.lineTo(w/2+gap+length,h/2);ctx.moveTo(w/2,h/2-gap-length);ctx.lineTo(w/2,h/2-gap);ctx.moveTo(w/2,h/2+gap);ctx.lineTo(w/2,h/2+gap+length);ctx.stroke();
 }
 dispose(){if(this.disposed)return;if(this.running&&this.phase==='measuring')this.complete('interrupted',false);this.disposed=true;this.running=false;cancelAnimationFrame(this.raf);document.removeEventListener('visibilitychange',this.visibilityChanged);document.removeEventListener('fullscreenchange',this.fullscreenChanged);window.removeEventListener('blur',this.focusLost);this.input.dispose();this.canvas.remove();}
}

import {BrowserInput,type InputObserver} from '../engine/input/Input';
import {angularGain,DEG} from '../engine/input/sensitivity';
import type {Settings} from '../engine/types';
import {MouseTelemetry} from './Telemetry';
import {AimTargetPath} from './tasks';
import {aimAnalysis} from './AnalysisService';
import {saveAimRecord,aimDataEpoch} from './storage';
import {conditionKey} from './experiments';
import {projectAngularTarget} from './projection';
import {AIM_VERSION,GAME_VERSION,trackingTask,type AimPlan,type AimRecord,type AimMeta} from './types';
export interface AimHud {status:'ready'|'warmup'|'measuring'|'paused'|'break'|'finished';block:number;trial:number;remaining:number;events:number;error:string;lastHit:boolean|null;processing:number;}
export class AimRuntime implements InputObserver {
 private appearanceAt:number|null=null;
 private projected={x:0,y:0,radius:0,visible:false};
 readonly canvas:HTMLCanvasElement;readonly input:BrowserInput;readonly telemetry=new MouseTelemetry();readonly settings:Settings;running=false;yaw=0;pitch=0;blockIndex=0;trialIndex=0;
 private ctx:CanvasRenderingContext2D;private raf=0;private lastFrame=0;private hudAt=0;private startAt=0;private warmupAt=0;private warmupComplete=false;private path:AimTargetPath;private disposed=false;private phase:AimHud['status']='ready';private attempt=0;private anchorX=0;private anchorY=0;private target={x:0,y:0};private frames:number[]=[];private issues:string[]=[];private error='';private inputError='';private lastHit:boolean|null=null;private processing=0;
 constructor(host:HTMLElement,readonly plan:AimPlan,settings:Settings,private publish:(h:AimHud)=>void,private onRecord:(r:AimRecord)=>void){
  this.settings={...settings,bindings:{...settings.bindings},sensitivity:plan.blocks[0].sensitivity,degreesPerCount:plan.coefficient,fov:plan.fov};this.path=new AimTargetPath(this.block);this.canvas=document.createElement('canvas');this.canvas.className='aim-canvas';this.canvas.setAttribute('aria-label','중립 각도 측정 훈련 화면');host.appendChild(this.canvas);const ctx=this.canvas.getContext('2d',{alpha:false});if(!ctx){this.canvas.remove();throw new Error('이 브라우저에서 측정 화면을 시작하지 못했습니다.');}this.ctx=ctx;
  this.input=new BrowserInput(this.canvas,this,this.lockChange,message=>{if(message&&this.input?.locked)return;this.inputError=message;this.emit();});this.input.observer=this;this.raf=requestAnimationFrame(this.animate);this.emit();
 }
 get block(){return this.plan.blocks[this.blockIndex];}
 get viewYaw(){return this.yaw;}get viewPitch(){return this.pitch;}
 get heading(){return -this.yaw/DEG;}get elevation(){return this.pitch/DEG;}
 look(dx:number,dy:number){const gain=angularGain(this.settings);this.yaw-=dx*gain*DEG;this.pitch=Math.max(-1.48,Math.min(1.48,this.pitch-dy*gain*DEG));}
 async resume(){if(this.disposed||this.processing)return;await this.input.lock();}
 private lockChange=(locked:boolean)=>{if(this.disposed)return;if(locked){if(this.phase==='break'||this.phase==='finished'){document.exitPointerLock();return;}this.running=true;this.lastFrame=0;if(!this.warmupComplete){this.phase='warmup';this.warmupAt=performance.now();this.beginTrial();}else if(this.phase==='paused'){this.beginTrial();this.phase='measuring';}}else{if(this.running&&this.phase==='measuring')this.complete('interrupted',false);this.running=false;if(this.phase!=='break'&&this.phase!=='finished')this.phase='paused';}this.emit();};
 private beginTrial(){this.startAt=performance.now();this.appearanceAt=null;this.telemetry.clear();this.issues=[];this.frames=[];this.attempt++;this.anchorX=this.heading;this.anchorY=this.elevation;
  if(trackingTask(this.block.task)){this.path=new AimTargetPath(this.block);this.path.update(0);}else {if(this.block.task==='switch'&&this.trialIndex===0)this.path.setSwitchAnchor(this.heading,this.elevation);this.path.point(this.trialIndex,this.heading,this.elevation);}
  this.record(2,0,0,this.startAt,this.startAt,this.yaw,this.pitch);
 }
 private targetAt(t:number){if(trackingTask(this.block.task)){this.path.sample(t,this.target);this.target.x+=this.anchorX;this.target.y+=this.anchorY;}else{this.target.x=this.path.x;this.target.y=this.path.y;}return this.target;}
 private record(kind:number,dx:number,dy:number,stamp:number,received:number,beforeYaw:number,beforePitch:number){const t=Math.max(0,(received-this.startAt)/1000),target=this.targetAt(t),tx=target.x*DEG,ty=target.y*DEG;this.telemetry.push(t,dx,dy,this.heading,this.elevation,target.x,target.y,this.block.radius,kind,Math.max(0,received-stamp),-(this.yaw-beforeYaw)/DEG,(this.pitch-beforePitch)/DEG,0,1.64,0,20*Math.sin(tx)*Math.cos(ty),1.64+20*Math.sin(ty),-20*Math.cos(tx)*Math.cos(ty));}
 sample(kind:0|1,dx:number,dy:number,stamp:number,received:number,beforeYaw:number,beforePitch:number){if(!this.running||this.phase==='break')return;this.record(kind,dx,dy,stamp,received,beforeYaw,beforePitch);if(kind===1&&!trackingTask(this.block.task)){if(this.phase==='warmup'){this.path.point(++this.trialIndex,this.heading,this.elevation);}else if(this.phase==='measuring')this.complete();}}
 private complete(issue?:string,advance=true){if(this.phase==='warmup')return;const block=this.block,t=(performance.now()-this.startAt)/1000,buffer=this.telemetry.snapshot(),p95=this.frames.length?this.frames.slice().sort((a,b)=>a-b)[Math.floor(this.frames.length*.95)]:null;
  const issues=[...this.issues,...(this.appearanceAt===null?['pre-display-click']:[]),...(issue?[issue]:[]),...(this.telemetry.overflow?['buffer-overflow']:[]),...(this.telemetry.reordered?['timestamp-reordered']:[])];
  const meta:AimMeta={schema:1,id:`${block.id}-${this.trialIndex}-${this.attempt}`,experiment:this.plan.id,session:block.session,createdAt:Date.now(),algorithm:AIM_VERSION,game:GAME_VERSION,task:block.task,phase:block.phase,sensitivity:block.sensitivity,dpi:this.plan.dpi,dpiSource:'user-declared',coefficient:this.plan.coefficient,fov:this.plan.fov,ads:false,adsMultiplier:this.settings.adsSensitivity,rawMode:this.input.rawMode,renderer:'angular-canvas',seed:block.seed,round:block.round,pair:block.pair,order:block.order,radius:block.radius,amplitude:block.amplitude,duration:t,warmup:block.warmup,condition:conditionKey(block,this.plan),valid:!issues.length,issues,appearanceKnown:this.appearanceAt!==null,monotonicStartMs:this.startAt,timeOriginMs:performance.timeOrigin,appearanceTime:this.appearanceAt===null?undefined:(this.appearanceAt-this.startAt)/1000,distance:20,targetDiameter:2*Math.tan(block.radius*DEG)*20,viewport:[this.canvas.clientWidth,this.canvas.clientHeight],renderScale:Math.min(2,devicePixelRatio||1),...(p95!==null?{frameP95:p95}:{})};
  const epoch=aimDataEpoch();this.processing++;void aimAnalysis.run(buffer,meta).then(async r=>{this.lastHit=r.metrics.hit;await saveAimRecord(r,epoch);if(!this.disposed&&epoch===aimDataEpoch())this.onRecord(r);}).catch(()=>{this.error='일부 측정의 분석·저장에 실패했습니다. 실패한 데이터로 감도를 추천하지 않습니다.';}).finally(()=>{this.processing--;if(!this.disposed)this.emit();});
  if(!advance)return;this.trialIndex++;if(this.trialIndex>=block.trials){this.phase=this.blockIndex+1>=this.plan.blocks.length?'finished':'break';this.running=false;if(this.input.locked)document.exitPointerLock();this.emit();}else this.beginTrial();
 }
 next(){if(this.phase!=='break'||this.processing)return;this.blockIndex++;this.trialIndex=0;this.warmupComplete=false;this.settings.sensitivity=this.block.sensitivity;this.path=new AimTargetPath(this.block);this.phase='ready';this.lastHit=null;this.emit();}
 private step=(now:number)=>{if(!this.running)return;if(this.phase==='warmup'){if(now-this.warmupAt>=this.block.warmup*1000){this.phase='measuring';this.warmupComplete=true;this.trialIndex=0;this.beginTrial();}return;}
  if(this.phase!=='measuring')return;const time=(now-this.startAt)/1000;
  if(trackingTask(this.block.task)){this.path.update(time);if(this.path.changed)this.record(3,0,0,now,now,this.yaw,this.pitch);}
  this.record(2,0,0,now,now,this.yaw,this.pitch);
  if(time>=this.block.duration)this.complete();
 };
 private animate=(_frame:number)=>{if(this.disposed)return;const now=performance.now();const dt=this.lastFrame?(now-this.lastFrame)/1000:0;this.lastFrame=now;if(this.running){if(dt>.25){if(this.phase==='measuring')this.complete('frame-gap',false);this.running=false;if(this.input.locked)document.exitPointerLock();this.phase='paused';}else{if(this.frames.length<2400)this.frames.push(dt*1000);this.step(now);}}this.draw(now);if(now-this.hudAt>100){this.hudAt=now;this.emit();}this.raf=requestAnimationFrame(this.animate);};
 private emit(){this.publish({status:this.phase,block:this.blockIndex,trial:this.trialIndex,remaining:this.phase==='warmup'?Math.max(0,this.block.warmup-(performance.now()-this.warmupAt)/1000):Math.max(0,this.block.duration-(performance.now()-this.startAt)/1000),events:this.telemetry.count,error:this.error||this.inputError,lastHit:this.lastHit,processing:this.processing});}
 private draw(now:number){const c=this.canvas,ctx=this.ctx,w=c.clientWidth,h=c.clientHeight,dpr=Math.min(2,devicePixelRatio||1);if(c.width!==Math.round(w*dpr)||c.height!==Math.round(h*dpr)){c.width=Math.round(w*dpr);c.height=Math.round(h*dpr);}ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='#111c23';ctx.fillRect(0,0,w,h);ctx.strokeStyle='#20313b';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(w/2,0);ctx.lineTo(w/2,h);ctx.moveTo(0,h/2);ctx.lineTo(w,h/2);ctx.stroke();
  if(this.running){const t=Math.max(0,(now-this.startAt)/1000),p=this.targetAt(t);
   if(this.block.task==='switch'){ctx.fillStyle='#4c626b';for(let i=0;i<4;i++){const q=projectAngularTarget(this.projected,this.heading,this.elevation,this.path.switchX[i],this.path.switchY[i],this.block.radius,this.plan.fov,w,h);if(q.visible){ctx.beginPath();ctx.arc(q.x,q.y,q.radius,0,Math.PI*2);ctx.fill();}}}
   const q=projectAngularTarget(this.projected,this.heading,this.elevation,p.x,p.y,this.block.radius,this.plan.fov,w,h);if(q.visible){if(this.phase==='measuring'&&this.appearanceAt===null)this.appearanceAt=performance.now();ctx.fillStyle=this.phase==='warmup'?'#80939c':'#ef726a';ctx.beginPath();ctx.arc(q.x,q.y,q.radius,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#ffd5bc';ctx.lineWidth=1.5;ctx.stroke();}
  }
  ctx.strokeStyle=this.settings.crosshairColor;ctx.lineWidth=this.settings.crosshairThickness;const gap=this.settings.crosshairGap,length=this.settings.crosshairLength;ctx.beginPath();ctx.moveTo(w/2-gap-length,h/2);ctx.lineTo(w/2-gap,h/2);ctx.moveTo(w/2+gap,h/2);ctx.lineTo(w/2+gap+length,h/2);ctx.moveTo(w/2,h/2-gap-length);ctx.lineTo(w/2,h/2-gap);ctx.moveTo(w/2,h/2+gap);ctx.lineTo(w/2,h/2+gap+length);ctx.stroke();
 }
 dispose(){if(this.disposed)return;if(this.running&&this.phase==='measuring')this.complete('interrupted',false);this.disposed=true;this.running=false;cancelAnimationFrame(this.raf);this.input.dispose();this.canvas.remove();}
}

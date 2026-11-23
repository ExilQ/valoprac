import {AIM_VERSION,COLS,trackingTask,type AimMeta,type AimMetrics} from './types';
import {angularDistance,localDelta,median,clamp,sd} from './math';
export const SEGMENTATION={version:AIM_VERSION,hz:120,onsetSpeed:2.5,onsetDistance:.04,primaryStopFraction:.22,correctionDistance:.08,stabilizationSpeed:4,stabilizationSeconds:.06,lateClickSeconds:.18,accelerationMaxGap:.05,accelerationMinimumSeconds:.2};
interface Point {t:number;x:number;y:number;tx:number;ty:number;r:number;}
function resample(trace:ArrayLike<number>){const rows:Point[]=[];for(let i=0;i+COLS<=trace.length;i+=COLS){const p={t:trace[i],x:trace[i+3],y:trace[i+4],tx:trace[i+5],ty:trace[i+6],r:trace[i+7]};if(Object.values(p).every(Number.isFinite)&&(!rows.length||p.t>=rows[rows.length-1].t))rows.push(p);}
 if(rows.length<2)return rows;const out:Point[]=[];let j=1;for(let t=rows[0].t;t<=rows[rows.length-1].t+1e-8;t+=1/120){while(j<rows.length-1&&rows[j].t<t)j++;const a=rows[j-1],b=rows[j],f=clamp((t-a.t)/(b.t-a.t||1),0,1);out.push({t,x:a.x+(b.x-a.x)*f,y:a.y+(b.y-a.y)*f,tx:a.tx+(b.tx-a.tx)*f,ty:a.ty+(b.ty-a.ty)*f,r:b.r});}if(rows[rows.length-1].t-out[out.length-1].t>1e-6)out.push({...rows[rows.length-1]});return out;
}
export function analyzeAim(trace:ArrayLike<number>,meta:AimMeta):AimMetrics{
 const tracking=trackingTask(meta.task);let limit=trace.length;if(!tracking)for(let i=0;i+COLS<=trace.length;i+=COLS)if(trace[i+8]===1){limit=i+COLS;break;}
 const used=limit===trace.length?trace:trace instanceof Float64Array?trace.subarray(0,limit):Array.from(trace).slice(0,limit),a=resample(used),issues=meta.issues.slice(),n=a.length;
 const result:AimMetrics={valid:false,issues,samples:trace.length/COLS,inputEvents:0,duration:0,hit:null,reaction:null,primaryDuration:null,primaryEnd:null,initialError:null,signedError:null,perpendicular:null,extent:'unknown',corrections:null,correctionDistance:null,correctionTime:null,reversals:null,stabilization:null,entry:null,dwell:null,clickTime:null,clickError:null,clickClass:'none',path:0,direct:0,efficiency:null,sector:null,trackingRms:null,onTarget:null,velocityMismatch:null,lag:null,recovery:null,changeOvershoot:null,speedVariation:null,score:null,phases:[],initialDistance:null,initialDirectionError:null,peakVelocity:null,decelerationTime:null,correctionFraction:null,oscillation:null,trackingMedian:null,angularAccelerationRms:null,accelerationReliable:false,aimHit:null,sensitivityEligible:false,missAttribution:[],segmentationQuality:'insufficient'};
 let click=-1;const changes:number[]=[];for(let i=0;i+COLS<=limit;i+=COLS){if(trace[i+8]===0)result.inputEvents++;if(trace[i+8]===1)click=i;if(trace[i+8]===3)changes.push(trace[i]);}
 if(n<6||!meta.valid){issues.push(n<6?'insufficient-samples':'invalid-trial');return result;}
 const start=a[0],end=a[n-1],appearance=meta.appearanceTime??start.t;result.duration=Math.max(0,end.t-appearance);
 const errors=a.map(p=>angularDistance(p.x,p.y,p.tx,p.ty)),speed=new Array<number>(n).fill(0),vx=new Array<number>(n).fill(0),vy=new Array<number>(n).fill(0),tvx=new Array<number>(n).fill(0),tvy=new Array<number>(n).fill(0);
 for(let i=1;i<n;i++){const dt=a[i].t-a[i-1].t,[dx,dy]=localDelta(a[i-1].x,a[i-1].y,a[i].x,a[i].y),[tx,ty]=localDelta(a[i-1].tx,a[i-1].ty,a[i].tx,a[i].ty);speed[i]=Math.hypot(dx,dy)/dt;vx[i]=dx/dt;vy[i]=dy/dt;tvx[i]=tx/dt;tvy[i]=ty/dt;result.path+=angularDistance(a[i-1].x,a[i-1].y,a[i].x,a[i].y);}
 const smooth=speed.map((v,i)=>median(speed.slice(Math.max(0,i-1),Math.min(n,i+2)))??v);
 result.segmentationQuality='continuous';result.peakVelocity=Math.max(...smooth);
 let maximumGap=0;for(let i=COLS;i<used.length;i+=COLS)maximumGap=Math.max(maximumGap,used[i]-used[i-COLS]);
 // This is a derivative of the delivered angular trajectory, never physical
 // mouse acceleration. Do not report it across sparse/gapped observations.
 if(maximumGap<=SEGMENTATION.accelerationMaxGap&&result.duration>=SEGMENTATION.accelerationMinimumSeconds&&n>=25){const acceleration:number[]=[];for(let i=2;i<n-2;i++)acceleration.push((smooth[i+1]-smooth[i-1])/(a[i+1].t-a[i-1].t));result.angularAccelerationRms=Math.sqrt(acceleration.reduce((s,v)=>s+v*v,0)/(acceleration.length||1));result.accelerationReliable=true;}
 result.direct=angularDistance(start.x,start.y,start.tx,start.ty);result.efficiency=tracking||result.direct<.01?null:result.path>1e-8?clamp(result.direct/result.path,0,1):0;
 const [directX,directY]=localDelta(start.x,start.y,start.tx,start.ty),length=Math.hypot(directX,directY),ux=length?directX/length:0,uy=length?directY/length:0;
 if(length>.05&&!tracking)result.sector=Math.floor(((Math.atan2(directY,directX)+Math.PI*2+Math.PI/8)%(Math.PI*2))/(Math.PI/4));
 const onset=a.findIndex((p,i)=>smooth[i]>SEGMENTATION.onsetSpeed&&angularDistance(start.x,start.y,p.x,p.y)>SEGMENTATION.onsetDistance);
 if(onset>=0&&meta.appearanceKnown){if(a[onset].t>=appearance)result.reaction=a[onset].t-appearance;else issues.push('pre-display-motion');}
 const phase=(name:NonNullable<AimMetrics['phases']>[number]['phase'],from:number,to:number)=>{if(Number.isFinite(from)&&Number.isFinite(to)&&to>=from)result.phases!.push({phase:name,start:Math.max(start.t,from),end:Math.min(end.t,to)});};
 if(onset>=0){if(result.reaction!==null)phase('reaction',appearance,a[onset].t);phase('initiation',a[onset].t,a[onset].t);}
 let entry=-1,stable=-1,stableStart=-1;
 for(let i=0;i<n;i++){if(errors[i]<=a[i].r){if(entry<0)entry=i;if(smooth[i]<SEGMENTATION.stabilizationSpeed){if(stableStart<0)stableStart=i;if(stable<0&&a[i].t-a[stableStart].t>=SEGMENTATION.stabilizationSeconds)stable=stableStart;}else stableStart=-1;}else stableStart=-1;}
 if(entry>=0){result.entry=Math.max(0,a[entry].t-appearance);phase('approach',a[entry].t,a[entry].t);}if(stable>=0){result.stabilization=Math.max(0,a[stable].t-appearance);phase('stabilization',a[stable].t,end.t);}
 if(click>=0){result.clickTime=Math.max(0,trace[click]-appearance);if(trace[click]<appearance)issues.push('pre-display-click');result.clickError=angularDistance(trace[click+3],trace[click+4],trace[click+5],trace[click+6]);result.hit=result.clickError<=trace[click+7]&&meta.targetVisibleAtShot!==false;
  let clickEntry=-1,passed=false;for(let i=0;i<n&&a[i].t<=trace[click]+1e-6;i++)if(errors[i]<=a[i].r){if(clickEntry<0)clickEntry=i;}else if(clickEntry>=0)passed=true;
  if(result.hit){let j=Math.min(n-1,Math.floor((trace[click]-start.t)*120));while(j>0&&errors[j-1]<=a[j-1].r)j--;result.dwell=Math.max(0,trace[click]-a[j].t);result.clickClass=result.dwell>SEGMENTATION.lateClickSeconds?'late':'aligned';}
  else {const idx=Math.min(n-1,Math.max(1,Math.floor((trace[click]-start.t)*120))),relativeX=trace[click+5]-trace[click+3],relativeY=trace[click+6]-trace[click+4],relativeLength=Math.hypot(relativeX,relativeY),approaching=meta.task==='dynamic'?(vx[idx]*relativeX+vy[idx]*relativeY)/(relativeLength||1):vx[idx]*ux+vy[idx]*uy;result.clickClass=passed?'passed':approaching>2&&result.clickTime<.7?'early':'movement';}
  result.aimHit=result.hit;phase('shot',trace[click],trace[click]);
 }else if(!tracking)result.hit=false;
 if(!tracking&&onset>=0){let peak=smooth[onset],primary=-1,peakIndex=onset;
  for(let i=onset+1;i<n;i++){if(smooth[i]>peak){peak=smooth[i];peakIndex=i;}const reverse=(vx[i]*ux+vy[i]*uy)<-SEGMENTATION.onsetSpeed&&(vx[i-1]*ux+vy[i-1]*uy)>=0;
   if(i>peakIndex+1&&a[i].t-a[onset].t>.035&&(smooth[i]<peak*SEGMENTATION.primaryStopFraction||reverse)){primary=reverse?i-1:i;break;}}
  if(primary>=0){const p=a[primary],[ex,ey]=localDelta(p.tx,p.ty,p.x,p.y);result.primaryEnd=p.t-start.t;result.primaryDuration=p.t-a[onset].t;result.initialError=errors[primary];result.signedError=ex*ux+ey*uy;result.perpendicular=ex*(-uy)+ey*ux;result.extent=result.signedError>p.r?'over':result.signedError< -p.r?'under':'center';result.segmentationQuality='segmented';
   const [initialX,initialY]=localDelta(start.x,start.y,p.x,p.y);result.initialDistance=angularDistance(start.x,start.y,p.x,p.y);result.initialDirectionError=result.initialDistance>.04&&length>.04?Math.atan2(initialX*uy-initialY*ux,initialX*ux+initialY*uy)*180/Math.PI:null;result.decelerationTime=Math.max(0,p.t-a[peakIndex].t);phase('ballistic',a[onset].t,a[peakIndex].t);phase('deceleration',a[peakIndex].t,p.t);
   let path=0,count=0,reversals=0,lastX=0,lastY=0,segment=0,lastMotion=primary;
   for(let i=primary+1;i<n;i++){const dt=a[i].t-a[i-1].t,dx=vx[i]*dt,dy=vy[i]*dt,d=Math.hypot(dx,dy);if(smooth[i]<SEGMENTATION.onsetSpeed)continue;lastMotion=i;path+=d;segment+=d;if(segment>=SEGMENTATION.correctionDistance){if(!count){count=1;lastX=dx;lastY=dy;}else if(dx*lastX+dy*lastY<0){reversals++;count++;lastX=dx;lastY=dy;}segment=0;}}
   result.corrections=count;result.reversals=reversals;result.correctionDistance=path;result.correctionTime=Math.max(0,a[lastMotion].t-p.t);result.correctionFraction=result.duration>0?clamp(result.correctionTime/result.duration,0,1):null;result.oscillation=reversals;if(path>=SEGMENTATION.correctionDistance)phase('correction',p.t,a[lastMotion].t);
  }
 }
 if(tracking){if(result.duration<2)issues.push('tracking-too-short');const rms=Math.sqrt(errors.reduce((s,e)=>s+e*e,0)/n);result.trackingRms=rms;result.trackingMedian=median(errors);result.onTarget=errors.filter((e,i)=>e<=a[i].r).length/n;result.velocityMismatch=Math.sqrt(vx.reduce((s,v,i)=>s+(v-tvx[i])**2+(vy[i]-tvy[i])**2,0)/n);result.speedVariation=sd(smooth);
  const motion=tvx.map((v,i)=>Math.hypot(v,tvy[i]));if(result.duration>=4&&(sd(motion)??0)>.3){let best=-Infinity,bestLag=0;for(let lag=-24;lag<=60;lag++){let xy=0,xx=0,yy=0;for(let i=25;i<n-60;i++){const j=i+lag;xy+=tvx[i]*vx[j]+tvy[i]*vy[j];xx+=tvx[i]**2+tvy[i]**2;yy+=vx[j]**2+vy[j]**2;}const c=xy/Math.sqrt(xx*yy||1);if(c>best){best=c;bestLag=lag;}}if(best>.25)result.lag=bestLag/120;}
  const recovery:number[]=[],overshoot:number[]=[];for(const t of changes){const i=a.findIndex(p=>p.t>=t),last=a.findIndex(p=>p.t>=t+.75);if(i<0||last<0)continue;let recovered=-1;for(let j=i;j<last-5;j++)if(errors.slice(j,j+6).every((e,k)=>e<=a[j+k].r)){recovered=a[j].t-t;break;}if(recovered>=0)recovery.push(recovered);overshoot.push(Math.max(...errors.slice(i,last)));}result.recovery=median(recovery);result.changeOvershoot=median(overshoot);
 }
 if(meta.moving)issues.push('movement-interference');if((meta.recoil??0)>.1)issues.push('recoil-interference');if((meta.spread??0)>.3)issues.push('spread-interference');
 result.valid=!issues.some(i=>['buffer-overflow','timestamp-reordered','interrupted','frame-gap','target-changed','tracking-too-short','pre-display-click','focus-loss','visibility-loss','viewport-changed','fullscreen-changed','configuration-changed','analysis-incomplete'].includes(i));
 if(meta.phase==='combat')result.hit=meta.hit??result.hit;
 const attribution=result.missAttribution!;
 if(result.clickClass==='early')attribution.push('early-click');if(result.clickClass==='late')attribution.push('late-click');if(result.clickClass==='passed')attribution.push('passed-target');
 if(meta.moving)attribution.push('movement-accuracy');if((meta.recoil??0)>.1)attribution.push('recoil');if((meta.spread??0)>.3)attribution.push('spread');
 if(result.hit===false&&meta.task==='dynamic')attribution.push('target-motion');
 if(meta.targetVisibleAtShot===false)attribution.push('target-unavailable');
 if(result.aimHit===false&&!attribution.length){if(result.initialError!==null&&result.initialError>meta.radius)attribution.push((result.corrections??0)>0?'correction':'initial-movement');else attribution.push('unresolved');}
 result.sensitivityEligible=result.valid&&meta.phase!=='combat'&&meta.task!=='tactical'&&!meta.moving&&(meta.recoil??0)<=.1&&(meta.spread??0)<=.3;
 result.phases!.sort((x,y)=>x.start-y.start||x.end-y.end);
 if(result.valid){if(tracking)result.score=.5*(result.onTarget??0)+.5*Math.exp(-(result.trackingRms??100)/meta.radius);else {const features:[[number|null,number],[number|null,number],[number|null,number],[number|null,number]]=[[result.hit===null?null:Number(result.hit),.55],[result.clickTime===null?0:Math.exp(-result.clickTime),.2],[result.initialError===null?null:Math.exp(-result.initialError/meta.radius),.15],[result.correctionTime===null?null:Math.exp(-result.correctionTime/.5),.1]];let s=0,w=0;for(const [v,weight] of features)if(v!==null){s+=v*weight;w+=weight;}result.score=w?s/w:null;}}
 return result;
}
export function compactTrace(trace:ArrayLike<number>,maxPoints=600){const n=Math.floor(trace.length/COLS),stride=Math.max(1,Math.ceil(n/maxPoints)),out:number[]=[];let markers=0;for(let i=0;i<n;i++){const event=(trace[i*COLS+8]===1||trace[i*COLS+8]===3)&&markers<64;if(event)markers++;if(i%stride===0||event||i===n-1)for(let j=0;j<COLS;j++)out.push(trace[i*COLS+j]);}return out;}

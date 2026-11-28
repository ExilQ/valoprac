import {Ray,Vector3} from 'three';
import {nearestEnvironmentHit,type Obstacle} from '../engine/collision/environment';
import type {Vec3} from '../engine/types';
import type {ReplayEvent,ReplayProgress} from '../engine/replay/types';

export const REPLAY_SPEEDS=[.25,.5,1,2] as const;
export type ReplaySpeed=typeof REPLAY_SPEEDS[number];
export type ReplayCamera='first-person'|'top-down'|'third-person'|'bot';
export interface SeekableReplay {
 readonly time:number;readonly ended:boolean;
 advanceToTick(tick:number):ReplayProgress;
 seek(seconds:number,options?:{signal?:AbortSignal;chunkSize?:number}):Promise<ReplayProgress>;
}

/** Presentation clock only. All outcomes still come from the replay player's
 * original120Hz command execution; speed never changes its simulation dt. */
export class ReplayTransport {
 playing=false;seeking=false;speed:ReplaySpeed=1;
 private cursor=0;private seekEpoch=0;private pending:AbortController|null=null;
 constructor(readonly player:SeekableReplay,readonly duration:number,readonly ticks:number){
  if(!Number.isFinite(duration)||duration<0||!Number.isSafeInteger(ticks)||ticks<0)throw new Error('리플레이 길이가 유효하지 않습니다.');
  this.cursor=this.clamp(player.time);
 }
 get time(){return this.cursor;}
 get alpha(){return Math.max(0,Math.min(1,(this.cursor-this.player.time)*120));}
 private clamp(seconds:number){return Math.min(this.duration,Math.max(0,Number.isFinite(seconds)?seconds:0));}
 setSpeed(speed:number){if((REPLAY_SPEEDS as readonly number[]).includes(speed))this.speed=speed as ReplaySpeed;}
 play(){if(!this.seeking&&this.duration>0&&this.cursor<this.duration)this.playing=true;}
 pause(){this.playing=false;}
 advance(elapsed:number){
  if(!this.playing||this.seeking)return;
  // A background tab may return seconds later. Do not block the interface with
  // an unbounded catch-up loop; presentation resumes from its visible position.
  const delta=Math.max(0,Math.min(.25,Number.isFinite(elapsed)?elapsed:0));
  this.cursor=this.clamp(this.cursor+delta*this.speed);
  const atEnd=this.cursor>=this.duration-1e-10;
  this.player.advanceToTick(atEnd?this.ticks:Math.min(this.ticks,Math.floor(this.cursor*120+1e-8)));
  if(atEnd||this.player.ended){this.cursor=this.duration;this.playing=false;}
 }
 async seek(seconds:number){
  const epoch=++this.seekEpoch;this.pending?.abort();const controller=this.pending=new AbortController();
  this.playing=false;this.seeking=true;
  const target=this.clamp(seconds);
  try{const result=await this.player.seek(target,{signal:controller.signal,chunkSize:1200});if(epoch!==this.seekEpoch)return false;this.cursor=this.clamp(result.time);return true;}
  catch(error){if(controller.signal.aborted||epoch!==this.seekEpoch)return false;throw error;}
  finally{if(epoch===this.seekEpoch){this.seeking=false;this.pending=null;}}
 }
 dispose(){this.pause();++this.seekEpoch;this.pending?.abort();this.pending=null;this.seeking=false;}
}

export function replayTime(seconds:number){const tenths=Math.round((Number.isFinite(seconds)?Math.max(0,seconds):0)*10);return`${Math.floor(tenths/600).toString().padStart(2,'0')}:${((tenths%600)/10).toFixed(1).padStart(4,'0')}`;}

/** The timeline has a fixed DOM budget. Keep significant state events first,
 * then distribute shot markers through the remaining capacity. */
export function timelineMarkers(events:readonly ReplayEvent[],duration:number,limit=120){
 const budget=Math.max(0,Math.min(200,Math.floor(Number.isFinite(limit)?limit:120)));
 const valid=events.map((event,index)=>({event,index})).filter(({event})=>Number.isFinite(event.time)&&event.time>=0&&event.time<=duration);
 const important=valid.filter(({event})=>event.kind!=='shot'),shots=valid.filter(({event})=>event.kind==='shot');
 const sample=<T,>(rows:readonly T[],count:number)=>count<=0?[]:rows.length<=count?rows.slice():Array.from({length:count},(_,i)=>rows[Math.floor(i*rows.length/count)]);
 const selected=sample(important,budget);selected.push(...sample(shots,budget-selected.length));
 return selected.sort((a,b)=>a.event.time-b.event.time||a.index-b.index).map(({event,index})=>({...event,id:`${event.kind}-${index}`,percent:duration>0?event.time/duration*100:0}));
}

export function inspectionCamera(position:Vec3,mode:ReplayCamera,framing?:{targets:readonly Vec3[];aspect:number;yaw?:number;obstacles?:Obstacle[]}){
 if(mode==='first-person'||mode==='bot')return null;
 if(mode==='third-person'){
  const yaw=Number.isFinite(framing?.yaw)?framing!.yaw!:0,target={x:position.x,y:position.y+1.3,z:position.z},desired={x:position.x+Math.sin(yaw)*4,y:position.y+2.4,z:position.z+Math.cos(yaw)*4};
  // Inspect from behind the recorded view, keeping the display camera inside
  // actual walls/ceilings. This ray changes no player or collision state.
  if(framing?.obstacles){
   const origin=new Vector3(target.x,target.y,target.z),delta=new Vector3(desired.x-target.x,desired.y-target.y,desired.z-target.z),length=delta.length(),hit=nearestEnvironmentHit(new Ray(origin,delta.clone().multiplyScalar(1/length)),length,new Vector3(),framing.obstacles);
   if(hit<length){const safe=Math.max(.05,hit-.15)/length;desired.x=target.x+delta.x*safe;desired.y=target.y+delta.y*safe;desired.z=target.z+delta.z*safe;}
  }
  return{position:desired,target,fov:65};
 }
 if(framing){
  const points=[position,...framing.targets],minX=Math.min(...points.map(p=>p.x)),maxX=Math.max(...points.map(p=>p.x)),minZ=Math.min(...points.map(p=>p.z)),maxZ=Math.max(...points.map(p=>p.z)),minY=Math.min(...points.map(p=>p.y)),maxY=Math.max(...points.map(p=>p.y));
  const aspect=Number.isFinite(framing.aspect)&&framing.aspect>0?framing.aspect:16/9,tan=Math.tan(55*Math.PI/360),height=Math.max(24,(maxX-minX+8)/(2*tan),(maxZ-minZ+8)*aspect/(2*tan)),target={x:(minX+maxX)/2,y:minY,z:(minZ+maxZ)/2};
  return{position:{x:target.x,y:maxY+height,z:target.z+.001},target,fov:55};
 }
 return{position:{x:position.x,y:position.y+24,z:position.z+.001},target:{...position},fov:55};
}

/** Display-only view from a recorded bot's eyes. `direction` is the bot's
 * aim (its aim motor with recoil) when it has one; otherwise the camera faces
 * the player's eyes, which is where static course bots hold. The camera sits
 * just in front of the head so the bot's own model never fills the frame. */
export function botViewCamera(head:Vec3,player:Vec3,direction?:Vec3|null){
 let d=direction&&[direction.x,direction.y,direction.z].every(Number.isFinite)&&Math.hypot(direction.x,direction.y,direction.z)>1e-6?direction:{x:player.x-head.x,y:player.y-head.y,z:player.z-head.z};
 const length=Math.hypot(d.x,d.y,d.z);d=length>1e-6?{x:d.x/length,y:d.y/length,z:d.z/length}:{x:0,y:0,z:-1};
 const position={x:head.x+d.x*BOT_VIEW_OFFSET,y:head.y+d.y*BOT_VIEW_OFFSET,z:head.z+d.z*BOT_VIEW_OFFSET};
 return{position,target:{x:position.x+d.x*10,y:position.y+d.y*10,z:position.z+d.z*10},fov:BOT_VIEW_FOV};
}
export const BOT_VIEW_OFFSET=.22,BOT_VIEW_FOV=103;
export const BOT_STATE_LABELS:Record<string,string>={holding:'각 유지',listening:'소리 확인',alert:'경계',tracking:'추적',firing:'사격',recovering:'반동 회복',repositioning:'자리 이동','re-peeking':'다시 피킹',returning:'제자리 복귀',eliminated:'쓰러짐'};

/** Show active human silhouettes in a cutaway view, including scaled targets
 * and elevated sectors. This is a render plane, never a collision boundary. */
export function inspectionCutawayHeight(position:Vec3,targets:readonly {enabled:boolean;active:boolean;position:Vec3;scale:number}[]){
 return Math.max(position.y+2.6,...targets.filter(target=>target.enabled&&target.active).map(target=>target.position.y+2.05*target.scale));
}

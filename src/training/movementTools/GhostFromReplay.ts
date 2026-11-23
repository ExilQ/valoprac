import {ReplayPlayer} from '../../engine/replay/playback';
import {replayOutcome} from '../../engine/replay/integrity';
import {ReplayError,type ReplayRecording} from '../../engine/replay/types';
import type {Vec3} from '../../engine/types';
import type {MovementTracePoint} from './types';

export const MAX_GHOST_SECONDS=20;
export const MAX_GHOST_SAMPLES=600;
const HZ=120;
export interface MovementGhostSegment {startTick:number;endTick:number;}
export interface MovementGhost {
 readonly source:{gameVersion:string;simulationVersion:string;map:string;physics:string;seed:number};
 readonly segment:MovementGhostSegment;readonly duration:number;
 readonly samples:readonly MovementTracePoint[];
 readonly distance:number;readonly peakSpeed:number;readonly peakHeight:number;
 readonly origin:Vec3;readonly landing:Vec3|null;readonly landings:number;
 /** Segment reconstruction checks every available prefix checkpoint. A score
  * is never certified by this visual cache. */
 readonly sourceFinalVerified:boolean;
}
export interface MovementGhostPose {
 time:number;position:Vec3;speed:number;grounded:boolean;yaw:number;crouch:number;finished:boolean;
}
const copy=(v:Vec3):Vec3=>({x:v.x,y:v.y,z:v.z});
function checkAbort(signal?:AbortSignal){if(signal?.aborted)throw new DOMException('고스트 준비를 취소했습니다.','AbortError');}
const yieldTask=()=>new Promise<void>(resolve=>setTimeout(resolve,0));
function point(player:ReplayPlayer,startTick:number):MovementTracePoint {
 const s=player.simulation,m=s.movement,p=m.position,speed=Math.hypot(m.velocity.x,m.velocity.z);
 if(![p.x,p.y,p.z,speed,s.viewYaw,m.crouch].every(Number.isFinite))throw new ReplayError('고스트 이동 상태가 유효하지 않습니다.');
 return[(s.ticks-startTick)/HZ,p.x,p.y,p.z,speed,m.grounded,s.viewYaw,m.crouch];
}

/** Builds a small display cache by re-executing the common replay authority.
 * No live simulation, collision object or random stream is reused or mutated.
 * Statistics integrate every120Hz tick; only display points are reduced to
 * approximately30Hz, capped at600 including both segment endpoints. */
export async function buildMovementGhost(recording:ReplayRecording,segment:MovementGhostSegment,options:{signal?:AbortSignal}={}):Promise<MovementGhost>{
 const {startTick,endTick}=segment;
 if(!Number.isSafeInteger(startTick)||!Number.isSafeInteger(endTick)||startTick<0||endTick<=startTick||endTick>recording.ticks||endTick-startTick>MAX_GHOST_SECONDS*HZ)throw new ReplayError('고스트 구간은 기록 안의20초 이내 구간이어야 합니다.');
 checkAbort(options.signal);const player=new ReplayPlayer(recording);
 await player.seek(startTick/HZ,{signal:options.signal,chunkSize:1200});checkAbort(options.signal);
 const count=Math.min(MAX_GHOST_SAMPLES,Math.max(2,Math.floor((endTick-startTick)/4)+1));
 const sampleTicks=new Set(Array.from({length:count},(_,i)=>startTick+Math.round(i*(endTick-startTick)/(count-1))));
 const first=point(player,startTick),samples:MovementTracePoint[]=[first],origin={x:first[1],y:first[2],z:first[3]};
 let previous={...origin},lastLandingSerial=player.simulation.movement.landingSerial,distance=0,peakSpeed=first[4],peakY=first[2],landing:Vec3|null=null,landings=0;
 for(let tick=startTick+1;tick<=endTick;tick++){
  checkAbort(options.signal);player.advanceToTick(tick);const sample=point(player,startTick),p={x:sample[1],y:sample[2],z:sample[3]};
  distance+=Math.hypot(p.x-previous.x,p.z-previous.z);peakSpeed=Math.max(peakSpeed,sample[4]);peakY=Math.max(peakY,p.y);
  const serial=player.simulation.movement.landingSerial;if(serial>lastLandingSerial){landing={...p,y:player.simulation.movement.supportHeight};landings+=serial-lastLandingSerial;}lastLandingSerial=serial;previous=p;
  if(sampleTicks.has(tick))samples.push(sample);
  if((tick-startTick)%32===0)await yieldTask();
 }
 checkAbort(options.signal);
 const actual=endTick===recording.ticks?replayOutcome(player.simulation):null;
 const sourceFinalVerified=!!actual&&player.ended&&player.mismatches.length===0&&(['checksum','score','shots','hits','deaths','tick','time'] as const).every(key=>actual[key]===recording.final[key]);
 const ghost:MovementGhost={source:{gameVersion:recording.header.gameVersion,simulationVersion:recording.header.simulationVersion,map:recording.header.map,physics:recording.header.physics,seed:recording.header.seed},segment:{startTick,endTick},duration:(endTick-startTick)/HZ,samples,distance,peakSpeed,peakHeight:Math.max(0,peakY-origin.y),origin,landing,landings,sourceFinalVerified};
 for(const sample of samples)Object.freeze(sample);Object.freeze(samples);Object.freeze(ghost.source);Object.freeze(ghost.segment);Object.freeze(ghost.origin);if(ghost.landing)Object.freeze(ghost.landing);return Object.freeze(ghost);
}

/** Interpolation changes only the translucent inspection marker, never physics. */
export function sampleMovementGhost(ghost:MovementGhost,elapsedSeconds:number):MovementGhostPose|null {
 if(!Number.isFinite(elapsedSeconds)||!ghost.samples.length)return null;
 const time=Math.max(0,Math.min(ghost.duration,elapsedSeconds)),rows=ghost.samples;
 let lo=0,hi=rows.length-1;while(lo<hi){const mid=Math.floor((lo+hi)/2);if(rows[mid][0]<time)lo=mid+1;else hi=mid;}
 const b=rows[lo],a=rows[Math.max(0,lo-1)],f=b[0]>a[0]?Math.max(0,Math.min(1,(time-a[0])/(b[0]-a[0]))):0;
 const lerp=(index:number)=>Number(a[index])+(Number(b[index])-Number(a[index]))*f;
 const delta=Math.atan2(Math.sin(b[6]-a[6]),Math.cos(b[6]-a[6]));
 return{time,position:{x:lerp(1),y:lerp(2),z:lerp(3)},speed:lerp(4),grounded:f<.5?a[5]:b[5],yaw:a[6]+delta*f,crouch:lerp(7),finished:elapsedSeconds>=ghost.duration};
}

export function compareMovementGhost(ghost:MovementGhost,current:{duration:number;distance:number;peakSpeed:number;peakHeight:number;landing:Vec3|null}){
 const finite=(n:number)=>Number.isFinite(n)?n:null;
 return{elapsedDelta:finite(current.duration-ghost.duration),distanceDelta:finite(current.distance-ghost.distance),peakSpeedDelta:finite(current.peakSpeed-ghost.peakSpeed),peakHeightDelta:finite(current.peakHeight-ghost.peakHeight),landingDistance:current.landing&&ghost.landing?finite(Math.hypot(current.landing.x-ghost.landing.x,current.landing.y-ghost.landing.y,current.landing.z-ghost.landing.z)):null};
}

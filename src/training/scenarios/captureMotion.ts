import {ReplayPlayer} from '../../engine/replay/playback';
import {REPLAY_FIXED_DT,type ReplayRecording} from '../../engine/replay/types';
import {MOTION_HZ,MOTION_MAX_SECONDS,MOTION_MIN_SECONDS,type MotionPoint,type RecordedMotion} from './recordedMotion';

const centimetres=(value:number)=>Math.round(value*100)||0;

/** Reconstruct collision-resolved motion from the existing deterministic replay.
 * Include every fixed tick in the grounding and restart checks, even though
 * the shareable trajectory is deliberately sampled at a lower rate. */
export async function captureMotion(recording:ReplayRecording,startSeconds:number,lengthSeconds:number,signal?:AbortSignal):Promise<RecordedMotion> {
 const interval=Math.round(1/(REPLAY_FIXED_DT*MOTION_HZ));
 const first=Math.round(startSeconds/REPLAY_FIXED_DT),steps=Math.round(lengthSeconds*MOTION_HZ);
 if(!Number.isSafeInteger(first)||!Number.isSafeInteger(steps)||first<0||steps<MOTION_MIN_SECONDS*MOTION_HZ||steps>MOTION_MAX_SECONDS*MOTION_HZ||first+steps*interval>recording.ticks)
  throw new Error('리플레이 안에서 1–4초 구간을 선택하세요.');
 if(recording.header.initial.options.exercise)throw new Error('일반 훈련이나 전술 시나리오에서 기록한 이동 구간을 선택하세요.');
 const player=new ReplayPlayer(recording);
 await player.seek(first*REPLAY_FIXED_DT,{signal});
 const {simulation}=player,origin=simulation.movement.position.clone(),generation=simulation.lifeGeneration,previous=origin.clone();
 const points:MotionPoint[]=[];
 for(let tick=first;tick<=first+steps*interval;tick++){
  signal?.throwIfAborted();
  player.advanceToTick(tick);
  const movement=simulation.movement;
  if(simulation.ticks!==tick||simulation.lifeGeneration!==generation||!movement.grounded||
     Math.hypot(movement.position.x-previous.x,movement.position.z-previous.z)>.115||Math.abs(movement.position.y-previous.y)>.33)
   throw new Error('점프·낙하·위치 복원·재시작이 없는 지면 이동 구간을 선택하세요.');
  previous.copy(movement.position);
  if((tick-first)%interval===0){
   const {x,y,z}=movement.position;
   points.push([centimetres(x-origin.x),centimetres(y-origin.y),centimetres(z-origin.z),Math.round(movement.crouch*100)]);
  }
 }
 if(!points.some(point=>Math.hypot(point[0],point[2])>=20||Math.abs(point[3]-points[0][3])>=20))
  throw new Error('위치나 앉기 자세가 바뀌는 구간을 선택하세요.');
 return {source:'replay',turns:0,mirror:false,points};
}

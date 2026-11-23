import {Matrix4,Vector3} from 'three';
import {Simulation} from '../simulation/Simulation';
import {replayRulesFor,replayCharacterGeometry,replayOutcome,simulationChecksum} from './integrity';
import type {SimulationRulesId} from '../simulation/rules';
import {validateReplay} from './validation';
import {REPLAY_FIXED_DT,ReplayError,unpackInput,type ReplayCommand,type ReplayProgress,type ReplayRecording,type ReplayVerification} from './types';

/** Rebuild the same matrix arithmetic submitted by RangeRenderer. This creates
 * hit-registration history, not a second motion or outcome simulation. */
export function captureReplayFrame(s:Simulation,id:number,stamp:number,alpha:number,tick:number){
 if(tick!==s.ticks)throw new ReplayError('화면 표적의 연산 시점이 리플레이와 다릅니다.');
 const matrices:Matrix4[][]=[],positions:Vector3[]=[];
 for(const t of s.targets){
  const dx=(t.previous.x+(t.position.x-t.previous.x)*alpha)-t.position.x,dz=(t.previous.z+(t.position.z-t.previous.z)*alpha)-t.position.z;
  matrices.push(t.parts.map(p=>{const m=p.node.matrixWorld.clone();m.elements[12]+=dx;m.elements[14]+=dz;return m.scale(p.size);}));
  positions.push(new Vector3(t.position.x+dx,t.position.y,t.position.z+dz));
 }
 const frame=s.renderedTargets.capture(s.targets,matrices,stamp,positions,{tick,alpha});if(frame?.id!==id)throw new ReplayError('리플레이 화면 순서가 일치하지 않습니다.');
}
function abort(signal?:AbortSignal){if(signal?.aborted)throw new DOMException('리플레이 탐색을 취소했습니다.','AbortError');}
const yieldTask=()=>new Promise<void>(resolve=>setTimeout(resolve,0));
export class ReplayPlayer {
 simulation:Simulation;private cursor=0;private checkpointCursor=0;private generation=0;
 readonly mismatches:ReplayVerification['mismatches']=[];
 readonly rules:SimulationRulesId;
 constructor(readonly recording:ReplayRecording){validateReplay(recording);this.rules=replayRulesFor(recording.header);this.simulation=this.create();}
 private create(){const i=this.recording.header.initial,s=new Simulation(i.mode,i.weapon,structuredClone(i.settings),structuredClone(i.options),this.rules,replayCharacterGeometry(this.recording.header));if(i.attached)s.renderedTargets.attach();return s;}
 get time(){return this.simulation.time;}
 get ended(){return this.cursor>=this.recording.commands.length;}
 get events(){return this.recording.events;}
 private progress():ReplayProgress{return{tick:this.simulation.ticks,time:this.time,ended:this.ended,commands:this.cursor};}
 private execute(c:ReplayCommand){const s=this.simulation;switch(c[0]){
  case 0:s.running=true;s.step(REPLAY_FIXED_DT,unpackInput(c[1]));break;
  case 1:s.look(c[1],c[2]);break;
  case 2:captureReplayFrame(s,c[1],c[2],c[3],c[4]);break;
  case 3:s.captureFireView(c[1]);break;case 4:s.clearFireView();break;case 5:s.configure(structuredClone(c[1]));break;case 6:s.switchWeapon(c[1]);break;
  case 7:s.retryTactical();break;case 8:s.resetTargets();break;case 9:s.resetStatistics();break;case 10:s.clearMovementInput();break;
  case 11:s.running=c[1];s.completed=c[2];break;
  case 12:s.trainingAction(structuredClone(c[1]));break;
 }}
 private one(){const c=this.recording.commands[this.cursor];this.execute(c);this.cursor++;
  while(this.checkpointCursor<this.recording.checkpoints.length&&this.recording.checkpoints[this.checkpointCursor].command===this.cursor){const expected=this.recording.checkpoints[this.checkpointCursor++],actual=simulationChecksum(this.simulation);if(actual!==expected.checksum||expected.tick!==this.simulation.ticks){this.mismatches.push({command:this.cursor,tick:this.simulation.ticks,expected:expected.checksum,actual});throw new ReplayError(`리플레이 무결성 검사가 ${this.simulation.time.toFixed(2)}초에서 일치하지 않습니다.`);}}
 }
 advanceToTick(tick:number):ReplayProgress{
  if(!Number.isFinite(tick))throw new ReplayError('유효한 리플레이 시점이 아닙니다.');const target=Math.max(0,Math.min(this.recording.ticks,Math.floor(tick)));
  if(target<this.simulation.ticks)throw new ReplayError('이전 시점은 seek로 탐색하세요.');
  while(!this.ended){const c=this.recording.commands[this.cursor];if(c[0]===0&&this.simulation.ticks>=target)break;this.one();}return this.progress();
 }
 async seek(seconds:number,options:{signal?:AbortSignal;chunkSize?:number}={}):Promise<ReplayProgress>{
  if(!Number.isFinite(seconds))throw new ReplayError('유효한 리플레이 시점이 아닙니다.');
  // An already-cancelled request must not replace the displayed authority or
  // supersede another seek. A non-finite chunk budget must still make progress.
  abort(options.signal);
  const requestedChunk=options.chunkSize??2000,chunk=Number.isFinite(requestedChunk)?Math.max(100,Math.min(20_000,Math.floor(requestedChunk))):2000;
  const generation=++this.generation,target=Math.max(0,Math.min(this.recording.ticks,Math.floor(seconds/REPLAY_FIXED_DT+1e-8)));
  this.simulation=this.create();this.cursor=0;this.checkpointCursor=0;this.mismatches.length=0;
  while(!this.ended){abort(options.signal);if(generation!==this.generation)throw new DOMException('새 탐색으로 대체됐습니다.','AbortError');let n=0;
   while(!this.ended&&n++<chunk){const c=this.recording.commands[this.cursor];if(c[0]===0&&this.simulation.ticks>=target)return this.progress();this.one();}
   if(!this.ended)await yieldTask();
  }return this.progress();
 }
 async verify(options:{signal?:AbortSignal}={}):Promise<ReplayVerification>{
  const player=new ReplayPlayer(this.recording);try{await player.seek(this.recording.duration,options);}catch(error){if((error as Error).name==='AbortError')throw error;if(!player.mismatches.length)throw error;}
  const actual=replayOutcome(player.simulation),expected=this.recording.final;if(actual.checksum!==expected.checksum&&!player.mismatches.length)player.mismatches.push({command:player.cursor,tick:actual.tick,expected:expected.checksum,actual:actual.checksum});
  return{passed:player.ended&&!player.mismatches.length&&actual.score===expected.score&&actual.shots===expected.shots&&actual.hits===expected.hits&&actual.deaths===expected.deaths,mismatches:player.mismatches.slice(),checksum:actual.checksum,score:actual.score,shots:actual.shots,hits:actual.hits,deaths:actual.deaths};
 }
 cancel(){this.generation++;}
}

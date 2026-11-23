import {REPLAY_FIXED_DT,type ReplayRecording} from '../../engine/replay/types';

export const DEFENDER_STYLES=['head-line','crouch-counter'] as const;
export type DefenderStyle=typeof DEFENDER_STYLES[number];
export interface PlayerTempo {
 encounters:number;
 crouchRate:number;
 crouchHoldMs:number;
 burstPauseMs:number;
}
export interface DefenderPolicy {
 style:DefenderStyle;
 playerTempo?:PlayerTempo;
}
export const DEFENDER_STYLE_LABELS:Record<DefenderStyle,string>={
 'head-line':'헤드라인 조준',
 'crouch-counter':'헤드라인 조준 · 앉아서 교전',
};

const MIN_BURST_INTERVAL=.28;
const MAX_ENCOUNTER_INTERVAL=2;
const MIN_ENCOUNTERS=8;
const MAX_ENCOUNTERS=4000;
const SAMPLE_SECONDS_PER_REPLAY=120;
const clamp=(value:number,min:number,max:number)=>Math.min(max,Math.max(min,value));
const median=(values:number[],fallback:number)=>values.length?values.sort((a,b)=>a-b)[Math.floor(values.length/2)]:fallback;

/** Summarize real player input recorded by the fixed-tick trainer. Only bounded
 * aggregate values are shared in a scenario. Pauses and restarts split samples. */
export function playerTempoFromReplays(replays:readonly ReplayRecording[]):PlayerTempo|null {
 let encounters=0,crouched=0;
 const holds:number[]=[],pauses:number[]=[];
 for(const replay of replays){
  let time=0,lastFire=-Infinity,crouchStart:number|null=null,crouchInBurst=false;
  for(const command of replay.commands){
   if(encounters>=MAX_ENCOUNTERS)break;
   if(command[0]!==0){
    if(command[0]===7||command[0]===8||command[0]===10||command[0]===11&&!command[1]){
     lastFire=-Infinity;crouchStart=null;crouchInBurst=false;
    }
    continue;
   }
   time+=REPLAY_FIXED_DT;
   if(time>SAMPLE_SECONDS_PER_REPLAY)break;
   const input=command[1],crouch=!!(input[2]&2),fire=!!(input[2]&8)||input[6]>0;
   if(crouch&&crouchStart===null)crouchStart=time;
   if(!crouch&&crouchStart!==null){
    if(crouchInBurst)holds.push(Math.round((time-crouchStart)*1000));
    crouchStart=null;crouchInBurst=false;
   }
   if(!fire)continue;
   const gap=time-lastFire;
   if(gap>=MIN_BURST_INTERVAL){
    encounters++;
    if(crouch){crouched++;crouchInBurst=true;}
    if(gap<=MAX_ENCOUNTER_INTERVAL)pauses.push(Math.round(gap*1000));
   }
   lastFire=time;
  }
  if(encounters>=MAX_ENCOUNTERS)break;
 }
 if(encounters<MIN_ENCOUNTERS)return null;
 return {
  encounters,crouchRate:Math.round(crouched/encounters*100),
  crouchHoldMs:clamp(median(holds,440),200,900),
  burstPauseMs:clamp(median(pauses,430),280,850),
 };
}

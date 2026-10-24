import type { Settings,Mode,WeaponId,SessionData,ShotEvent,KillEvent,DirectionResponse,SessionSummary } from '../engine/types';
import { summarize } from '../training/analytics/statistics';
import type { AnalyticsSnapshot,EngineTotals,MomentSnapshot } from './analyticsSchema';
import type { EngineState } from './protocol';
class BoundedList<T>{
 private items:(T|undefined)[];private head=0;size=0;
 constructor(readonly limit:number){this.items=new Array(limit);}
 push(item:T){let evicted:T|undefined;if(this.size===this.limit){evicted=this.items[this.head];this.items[this.head]=item;this.head=(this.head+1)%this.limit;}else this.items[(this.head+this.size++)%this.limit]=item;return evicted;}
 array(){const result:T[]=[];for(let i=0;i<this.size;i++)result.push(this.items[(this.head+i)%this.limit]!);return result;}
}
const mean=(m:MomentSnapshot)=>m.n?m.sum/m.n:0;
const rate=(n:number,d:number)=>d?n/d*100:0;
export function authoritativeSummary(detail:SessionSummary,t:EngineTotals):SessionSummary {
 const comparison=(kind:'neutral'|'opposite')=>{const c=t.comparison[kind];return {count:c.duration.n,duration:mean(c.duration),delta:mean(c.timing),headshotRate:rate(c.heads,c.duration.n)};};
 const hits=t.heads+t.bodies+t.limbs,misses=t.shots-hits;
 return {...detail,shots:t.shots,heads:t.heads,bodies:t.bodies,limbs:t.limbs,misses,eliminations:t.eliminations,headshotAccuracy:rate(t.heads,t.shots),hitAccuracy:rate(hits,t.shots),missRate:rate(misses,t.shots),firstShotAccuracy:rate(t.firstHits,t.first),firstShotHeadshot:rate(t.firstHeads,t.first),averageEliminationTime:mean(t.elimination),earlyShots:t.early,brakingSamples:t.brakes,averageBrakeDuration:mean(t.brake),averageDecelerationDuration:mean(t.deceleration),brakingMeasuredSamples:t.brake.n,brakingTimingSamples:t.timing.n,decelerationSamples:t.deceleration.n,averageShotSpeed:mean(t.speed),averageThresholdDelta:mean(t.timing),brakingConsistency:t.timing.n?Math.sqrt(Math.max(0,t.timing.squares/t.timing.n-mean(t.timing)**2)):0,neutral:comparison('neutral'),opposite:comparison('opposite'),spray:{...detail.spray,angularRms:t.angular.n?Math.sqrt(t.angular.squares/t.angular.n):0},trackingAccuracy:rate(t.tracking.onHead,t.tracking.samples),trackingRms:t.tracking.samples?Math.sqrt(t.tracking.errorSquared/t.tracking.samples):0};
}
export class SessionRecorder {
 private shots=new BoundedList<{seq:number;shot:ShotEvent}>(2048);private kills=new BoundedList<KillEvent>(256);private reactions=new BoundedList<DirectionResponse>(256);private shotMap=new Map<number,ShotEvent>();
 private epoch=-1;private cursor=0;private lost=0;private totals:EngineTotals|null=null;private finalSequence:number|null=null;private latest:EngineState|null=null;private dirty=true;private detail=summarize([],[],[],{samples:0,onHead:0,errorSquared:0});private settings:Settings;
 constructor(readonly session:string,private mode:Mode,private weapon:WeaponId,settings:Settings,private createdAt=Date.now()){this.settings=structuredClone(settings);}
 configure(settings:Settings){this.settings=structuredClone(settings);}
 accept(state:EngineState):number|null {
  const a=state.analytics;if(!a||state.session!==this.session||a.epoch<this.epoch)return null;
  if(a.epoch!==this.epoch){this.epoch=a.epoch;this.cursor=a.startSequence-1;this.lost=0;this.shots=new BoundedList(2048);this.kills=new BoundedList(256);this.reactions=new BoundedList(256);this.shotMap.clear();this.finalSequence=null;this.dirty=true;}
  if(a.lastSequence<this.cursor)return null;
  this.latest=state;this.mode=state.mode;this.weapon=state.weapon;this.totals=a.totals;
  // Detail eviction is explicit. Lifetime counters always come from UE aggregates.
  if(a.firstSequence>this.cursor+1){this.lost+=a.firstSequence-this.cursor-1;this.cursor=a.firstSequence-1;}
  const before=this.cursor;
  for(const e of a.events){if(e.seq<=this.cursor)continue;if(e.seq!==this.cursor+1)break;
   if(e.type==='shot'){const shot=structuredClone(e.data),old=this.shots.push({seq:e.seq,shot});if(old)this.shotMap.delete(old.seq);this.shotMap.set(e.seq,shot);}
   else if(e.type==='kill')this.kills.push(structuredClone(e.data));
   else if(e.type==='reaction')this.reactions.push(structuredClone(e.data));
   else{const shot=this.shotMap.get(e.data.shotSeq);if(shot){shot.brakingKind=e.data.brakingKind;shot.brakingDuration=e.data.brakingDuration;shot.thresholdDelta=e.data.thresholdDelta;shot.decelerationDuration=e.data.decelerationDuration;}}
   this.cursor=e.seq;this.dirty=true;
  }
  if(state.type==='finished'||state.finished)this.finalSequence=a.lastSequence;
  return this.cursor>before?this.cursor:null;
 }
 get readyToSave(){return this.finalSequence!==null&&this.cursor>=this.finalSequence&&this.totals!==null;}
 get canSavePartial(){return this.latest!==null&&this.totals!==null;}
 get processedThrough(){return this.cursor;}
 recentShots(){return this.shots.array().slice(-36).map(s=>s.shot);}
 snapshot(endedNormally=this.readyToSave):SessionData|null {
  if(!this.latest||!this.totals)return null;const shots=this.shots.array().map(s=>s.shot),kills=this.kills.array(),reactions=this.reactions.array();
  if(this.dirty){this.detail=summarize(shots,kills,reactions,this.totals.tracking);this.dirty=false;}
  return {id:`unreal-${this.session}-${this.epoch}`,createdAt:this.createdAt,runtime:'unreal',mode:this.mode,weapon:this.weapon,duration:this.latest.time,seed:this.settings.seed,settings:structuredClone(this.settings),shots:structuredClone(shots),kills:structuredClone(kills),reactions:structuredClone(reactions),tracking:{...this.totals.tracking},summary:authoritativeSummary(this.detail,this.totals),weaponTotals:structuredClone(this.totals.weapons),detailLimit:2048,streamEvidence:{schema:1,session:this.session,epoch:this.epoch,processedThrough:this.cursor,lastSequence:this.latest.analytics!.lastSequence,lostEvents:this.lost,detailsComplete:this.lost===0&&this.cursor>=this.latest.analytics!.lastSequence,endedNormally}};
 }
}

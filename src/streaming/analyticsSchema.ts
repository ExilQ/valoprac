import type { ShotEvent,KillEvent,DirectionResponse,WeaponTotals,WeaponId } from '../engine/types';
export interface MomentSnapshot {n:number;sum:number;squares:number;}
export interface EngineTotals {
 shots:number;heads:number;bodies:number;limbs:number;eliminations:number;first:number;firstHits:number;firstHeads:number;early:number;brakes:number;
 elimination:MomentSnapshot;brake:MomentSnapshot;deceleration:MomentSnapshot;speed:MomentSnapshot;timing:MomentSnapshot;angular:MomentSnapshot;
 comparison:Record<'neutral'|'opposite',{duration:MomentSnapshot;timing:MomentSnapshot;heads:number}>;
 weapons:Record<'rifleA'|'rifleB'|'sheriff',WeaponTotals>&{operator?:WeaponTotals};tracking:{samples:number;onHead:number;errorSquared:number};
}
export type EngineEvent={seq:number;type:'shot';data:ShotEvent}|{seq:number;type:'kill';data:KillEvent}|{seq:number;type:'reaction';data:DirectionResponse}|{seq:number;type:'brake';data:{shotSeq:number;brakingKind:ShotEvent['brakingKind'];brakingDuration:number|null;thresholdDelta:number|null;decelerationDuration:number|null}};
export interface AnalyticsSnapshot {schema:1;epoch:number;startSequence:number;firstSequence:number;lastSequence:number;acknowledged:number;totals:EngineTotals;events:EngineEvent[];}
type Obj=Record<string,unknown>;
const object=(v:unknown):v is Obj=>!!v&&typeof v==='object'&&!Array.isArray(v);
export const finite=(n:unknown):n is number=>typeof n==='number'&&Number.isFinite(n);
const count=(n:unknown):n is number=>Number.isSafeInteger(n)&&(n as number)>=0;
const numberKeys=(o:Obj,keys:string[])=>keys.every(k=>finite(o[k]));
const optional=(n:unknown)=>n===null||finite(n);
const vec=(o:unknown)=>object(o)&&numberKeys(o,['x','y','z']);
const pair=(o:unknown)=>object(o)&&numberKeys(o,['pitch','yaw']);
const moment=(m:unknown)=>object(m)&&count(m.n)&&finite(m.sum)&&finite(m.squares)&&m.squares>=0&&(m.n!==0||m.sum===0&&m.squares===0);
const kind=(v:unknown)=>v===null||v==='neutral'||v==='opposite';
export function validShot(o:unknown):o is ShotEvent {
 if(!object(o)||!numberKeys(o,['timestamp','shotIndex','magazineShot'])||!['rifleA','rifleB','sheriff','operator'].includes(String(o.weapon))||!['head','torso','arm','leg','wall','miss'].includes(String(o.hit)))return false;
 if(o.damage!==undefined&&(!finite(o.damage)||o.damage<0)||o.ads!==undefined&&typeof o.ads!=='boolean'||o.horizontalDirection!==undefined&&o.horizontalDirection!==-1&&o.horizontalDirection!==1)return false;
 if(!count(o.shotIndex)||!count(o.magazineShot)||(o.timestamp as number)<0||typeof o.firstShot!=='boolean'||typeof o.accurate!=='boolean')return false;
 if(!vec(o.position)||!vec(o.velocity)||!vec(o.direction)||!vec(o.impact)||!pair(o.aim)||!pair(o.recoil)||!pair(o.playerCompensation)||!object(o.movementDirection)||!numberKeys(o.movementDirection,['x','z']))return false;
 if(!object(o.spread)||!numberKeys(o.spread,['base','movement','bloom','air','total','x','y'])||['base','movement','bloom','air','total'].some(k=>((o.spread as Obj)[k] as number)<0))return false;
 if(!['releaseTime','thresholdDelta','initialSpeed','brakingDuration','decelerationDuration','angularError'].every(k=>optional(o[k]))||!kind(o.brakingKind))return false;
 if(o.targetId===null)return o.targetPosition===null&&o.targetGeneration===null&&o.targetState===null;
 return count(o.targetId)&&count(o.targetGeneration)&&vec(o.targetPosition)&&['stationary','strafe','random','stopGo','crouch','peek','appearing'].includes(String(o.targetState));
}
function validTotals(t:unknown):t is EngineTotals {
 if(!object(t)||!['shots','heads','bodies','limbs','eliminations','first','firstHits','firstHeads','early','brakes'].every(k=>count(t[k])))return false;
 if((t.heads as number)+(t.bodies as number)+(t.limbs as number)>(t.shots as number)||(t.firstHits as number)>(t.first as number)||(t.firstHeads as number)>(t.firstHits as number)||(t.first as number)>(t.shots as number)||(t.early as number)>(t.brakes as number))return false;
 if(!['elimination','brake','deceleration','speed','timing','angular'].every(k=>moment(t[k]))||!object(t.comparison)||!object(t.weapons)||!object(t.tracking))return false;
 for(const key of ['neutral','opposite']){const c=t.comparison[key];if(!object(c)||!moment(c.duration)||!moment(c.timing)||!count(c.heads))return false;}
 let totalShots=0,totalHits=0,totalHeads=0;
 for(const key of ['rifleA','rifleB','sheriff',...(t.weapons.operator!==undefined?['operator']:[])]){const w=t.weapons[key];if(!object(w)||!['shots','hits','heads'].every(k=>count(w[k]))||!numberKeys(w,['recoilSquared','spreadSum'])||(w.recoilSquared as number)<0||(w.spreadSum as number)<0||(w.heads as number)>(w.hits as number)||(w.hits as number)>(w.shots as number))return false;totalShots+=w.shots as number;totalHits+=w.hits as number;totalHeads+=w.heads as number;}
 return totalShots===t.shots&&totalHeads===t.heads&&totalHits===(t.heads as number)+(t.bodies as number)+(t.limbs as number)&&count(t.tracking.samples)&&count(t.tracking.onHead)&&t.tracking.onHead<=t.tracking.samples&&finite(t.tracking.errorSquared)&&t.tracking.errorSquared>=0;
}
export function parseAnalytics(raw:unknown):AnalyticsSnapshot|null {
 if(!object(raw)||raw.schema!==1||!count(raw.epoch)||!count(raw.startSequence)||raw.startSequence<1||!count(raw.firstSequence)||raw.firstSequence<raw.startSequence||!count(raw.lastSequence)||!count(raw.acknowledged)||raw.acknowledged>raw.lastSequence||raw.firstSequence>raw.lastSequence+1||!validTotals(raw.totals)||!Array.isArray(raw.events)||raw.events.length>16)return null;
 let previous=0;
 for(const e of raw.events){if(!object(e)||!count(e.seq)||e.seq<raw.firstSequence||e.seq>raw.lastSequence||e.seq<=previous||!object(e.data))return null;previous=e.seq;const d=e.data;
  if(e.type==='shot'){if(!validShot(d))return null;}
  else if(e.type==='kill'){if(!count(d.targetId)||!count(d.generation)||!numberKeys(d,['timestamp','elapsed'])||(d.elapsed as number)<0||typeof d.firstShot!=='boolean')return null;}
  else if(e.type==='reaction'){if(!count(d.targetId)||!numberKeys(d,['changeTime','latency'])||(d.latency as number)<0)return null;}
  else if(e.type==='brake'){if(!count(d.shotSeq)||d.shotSeq>=e.seq||!kind(d.brakingKind)||!['brakingDuration','thresholdDelta','decelerationDuration'].every(k=>optional(d[k])))return null;}
  else return null;
 }
 return raw as unknown as AnalyticsSnapshot;
}

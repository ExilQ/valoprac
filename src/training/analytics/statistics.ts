import type { KillEvent, ShotEvent, SessionSummary, DirectionResponse } from '../../engine/types';
const mean=(values:number[])=>values.length?values.reduce((a,b)=>a+b,0)/values.length:0;
const deviation=(v:number[])=>{const m=mean(v);return Math.sqrt(mean(v.map(x=>(x-m)**2)));};
const rate=(n:number,d:number)=>d?n/d*100:0;
export function summarize(shots:ShotEvent[],kills:KillEvent[],reactions:DirectionResponse[],tracking:{samples:number;onHead:number;errorSquared:number}):SessionSummary{
  const heads=shots.filter(s=>s.hit==='head').length,bodies=shots.filter(s=>s.hit==='torso').length,limbs=shots.filter(s=>s.hit==='arm'||s.hit==='leg').length;
  const first=shots.filter(s=>s.firstShot),braking=shots.filter(s=>s.releaseTime!==null),measured=braking.filter(s=>s.brakingDuration!==null),timed=braking.filter(s=>s.thresholdDelta!==null);
  const comparison=(kind:'neutral'|'opposite')=>{const list=measured.filter(s=>s.brakingKind===kind);return {count:list.length,duration:mean(list.map(s=>s.brakingDuration!)),delta:mean(list.filter(s=>s.thresholdDelta!==null).map(s=>s.thresholdDelta!)),headshotRate:rate(list.filter(s=>s.hit==='head').length,list.length)};};
  const wall=shots.filter(s=>s.hit==='wall'&&s.impact.z<=-29.9&&Math.abs(s.impact.x)<12);
  const xs=wall.map(s=>s.impact.x),ys=wall.map(s=>s.impact.y),centerX=mean(xs),centerY=mean(ys);
  const angular=shots.filter(s=>s.angularError!==null).map(s=>s.angularError!);
  // Compare repeated bursts by ordinal, after translating each burst's first impact.
  const bursts:ShotEvent[][]=[];for(const s of wall){if(s.firstShot||!bursts.length)bursts.push([]);bursts[bursts.length-1].push(s);}
  const valid=bursts.filter(b=>b.length>=3);const residuals:number[]=[];
  for(let i=1;i<30;i++){const pts=valid.filter(b=>b.length>i).map(b=>[b[i].impact.x-b[0].impact.x,b[i].impact.y-b[0].impact.y]);if(pts.length>1){const mx=mean(pts.map(p=>p[0])),my=mean(pts.map(p=>p[1]));for(const p of pts)residuals.push(Math.hypot(p[0]-mx,p[1]-my));}}
  return {shots:shots.length,heads,bodies,limbs,misses:shots.length-heads-bodies-limbs,eliminations:kills.length,
    headshotAccuracy:rate(heads,shots.length),hitAccuracy:rate(heads+bodies+limbs,shots.length),missRate:rate(shots.length-heads-bodies-limbs,shots.length),
    firstShotAccuracy:rate(first.filter(s=>['head','torso','arm','leg'].includes(s.hit)).length,first.length),firstShotHeadshot:rate(first.filter(s=>s.hit==='head').length,first.length),averageEliminationTime:mean(kills.map(k=>k.elapsed)),
    earlyShots:braking.filter(s=>!s.accurate).length,brakingSamples:braking.length,averageBrakeDuration:mean(measured.map(s=>s.brakingDuration!)),averageDecelerationDuration:mean(braking.filter(s=>s.decelerationDuration!==null).map(s=>s.decelerationDuration!)),brakingMeasuredSamples:measured.length,brakingTimingSamples:timed.length,decelerationSamples:braking.filter(s=>s.decelerationDuration!==null).length,averageShotSpeed:mean(braking.map(s=>Math.hypot(s.velocity.x,s.velocity.z))),averageThresholdDelta:mean(timed.map(s=>s.thresholdDelta!)),brakingConsistency:deviation(timed.map(s=>s.thresholdDelta!)),
    neutral:comparison('neutral'),opposite:comparison('opposite'),
    spray:{count:wall.length,centerX,centerY,width:xs.length?Math.max(...xs)-Math.min(...xs):0,height:ys.length?Math.max(...ys)-Math.min(...ys):0,meanRadius:mean(wall.map(s=>Math.hypot(s.impact.x-centerX,s.impact.y-centerY))),stability:deviation(wall.map(s=>Math.hypot(s.impact.x-centerX,s.impact.y-centerY))),angularRms:Math.sqrt(mean(angular.map(x=>x*x))),consistency:residuals.length?mean(residuals):null},
    reactionTimes:reactions.map(r=>r.latency),trackingAccuracy:rate(tracking.onHead,tracking.samples),trackingRms:tracking.samples?Math.sqrt(tracking.errorSquared/tracking.samples):0};
}

import {gpPredict,proposeSensitivity,type Observation} from '../optimizer';
import {mean,median,quantile,random,sd,shuffled} from '../math';
import {pairedEvidence,repeatedSummary} from './statistics';

/** Software stress cases, never records attributed to a player. Response values
 * are arbitrary normalized benchmark units, not a human performance estimate. */
export const BENCHMARK_METHODS=['grid','random','coarse','bayesian'] as const;
export type BenchmarkMethod=typeof BENCHMARK_METHODS[number];
export interface SyntheticProfile {
 id:string;noise:number;drift:number;pairs:number;response:(ratio:number)=>number;
}
const bump=(ratio:number,center:number,width:number)=>Math.exp(-.5*(Math.log(ratio/center)/width)**2);
export const SYNTHETIC_PROFILES:readonly SyntheticProfile[]=[
 {id:'low-sensitivity-precision',noise:.025,drift:0,pairs:24,response:x=>.42+.42*bump(x,.8,.15)},
 {id:'high-sensitivity-tracking',noise:.025,drift:0,pairs:24,response:x=>.43+.4*bump(x,1.2,.13)},
 {id:'broad-plateau',noise:.035,drift:0,pairs:24,response:x=>.8-.8*Math.max(0,.9-x,x-1.15)**2},
 {id:'narrow-optimum',noise:.025,drift:0,pairs:24,response:x=>.4+.44*bump(x,.93,.035)},
 {id:'multiple-equivalent-regions',noise:.025,drift:0,pairs:24,response:x=>.4+.4*Math.max(bump(x,.78,.065),bump(x,1.23,.065))},
 {id:'high-noise',noise:.18,drift:0,pairs:24,response:x=>.58+.13*bump(x,.91,.16)},
 {id:'learning',noise:.035,drift:.18,pairs:24,response:x=>.42+.4*bump(x,.92,.14)},
 {id:'fatigue',noise:.035,drift:-.18,pairs:24,response:x=>.43+.4*bump(x,1.08,.14)},
 {id:'insufficient-data',noise:.1,drift:0,pairs:4,response:x=>.45+.35*bump(x,.85,.14)}
];
const BASE=.35,LOW=.65,HIGH=1.35,MARGIN=.02;
const denseGrid=Array.from({length:1001},(_,i)=>LOW+(HIGH-LOW)*i/1000);
function normal(rng:()=>number){return Math.sqrt(-2*Math.log(Math.max(1e-12,rng())))*Math.cos(2*Math.PI*rng());}
interface Pair {ratio:number;difference:number;baseline:number;candidate:number;stage:'selection'|'heldout';order:'AB'|'BA';seed:number;}
export interface BenchmarkRun {
 profile:string;method:BenchmarkMethod;seed:number;measurementBudget:number;actualMeasurements:number;selectionPairs:number;heldoutPairs:number;
 pairedOrders:{AB:number;BA:number};recommendedRatio:number;regret:number;withinPracticalRegion:boolean;
 conclusion:string;falseImprovement:boolean;intervalCovered:number;intervalTotal:number;gpCovered:number;gpTotal:number;
 heldoutCandidates:number[];selectionSeeds:number[];heldoutSeeds:number[];failed:boolean;cpuMilliseconds:number;
}

/** Selection receives half the paired budget. The two leaders are frozen before
 * independent held-out measurements. Every candidate observation costs a real
 * synthetic baseline retest as well; none are supplied without budget charge. */
export function runOptimizerCase(profile:SyntheticProfile,method:BenchmarkMethod,seed:number):BenchmarkRun {
 const started=performance.now(),rng=random(seed),pairs:Pair[]=[],observations:Observation[]=[],byRatio=new Map<number,number[]>();
 const selectionPairs=Math.floor(profile.pairs/2),heldoutPairs=profile.pairs-selectionPairs;
 const grid=shuffled(Array.from({length:Math.max(1,selectionPairs-3)},(_,i)=>LOW+(HIGH-LOW)*i/Math.max(1,selectionPairs-4)),random(seed^0x6ac690c5));
 const anchors=shuffled([1,LOW,HIGH],random(seed^0x3c6ef372));
 function measure(ratio:number,stage:Pair['stage']):Pair {
  const index=pairs.length,noiseSeed=(seed+index*104729+(stage==='heldout'?1000000007:0))>>>0,r=random(noiseSeed),order=((index+(seed&1))%2?'BA':'AB') as Pair['order'];
  const common=.035*normal(r),baseTime=index*2+(order==='AB'?0:1),candidateTime=index*2+(order==='AB'?1:0),denominator=Math.max(1,profile.pairs*2-1);
  const baseline=profile.response(1)+common+profile.drift*baseTime/denominator+profile.noise*normal(r);
  const candidate=profile.response(ratio)+common+profile.drift*candidateTime/denominator+profile.noise*normal(r);
  const pair={ratio,difference:candidate-baseline,baseline,candidate,stage,order,seed:noiseSeed};pairs.push(pair);return pair;
 }
 for(let i=0;i<selectionPairs;i++){
  let ratio:number;
  if(i<anchors.length)ratio=anchors[i];
  else if(method==='grid')ratio=grid[i-3];
  else if(method==='random')ratio=Math.exp(Math.log(LOW)+rng()*(Math.log(HIGH)-Math.log(LOW)));
  else ratio=(proposeSensitivity(observations,BASE,.35,method)??BASE)/BASE;
  ratio=Math.min(HIGH,Math.max(LOW,ratio));
  const pair=measure(ratio,'selection'),a=byRatio.get(ratio)??[];a.push(pair.difference);byRatio.set(ratio,a);
  // Shared conservative prior, not the simulation's hidden noise parameter.
  // The optimizer sees measured paired differences around a fixed reference,
  // never the artificial surface's hidden true baseline or optimum.
  observations.push({x:ratio*BASE,y:.5+pair.difference,variance:.01});
 }
 const leaders=[...byRatio].sort((a,b)=>(mean(b[1])??-Infinity)-(mean(a[1])??-Infinity)||Math.abs(Math.log(a[0]))-Math.abs(Math.log(b[0]))).slice(0,2).map(([ratio])=>ratio);
 // At most two candidates. Reverse order every round to balance both time and
 // the AB/BA position for each candidate, including the learning/fatigue cases.
 for(let i=0;i<heldoutPairs;i++){
  const round=Math.floor(i/Math.max(1,leaders.length)),index=i%Math.max(1,leaders.length),order=round%2?leaders.slice().reverse():leaders;
  measure(order[index]??1,'heldout');
 }
 const held=leaders.map(ratio=>({ratio,a:pairs.filter(p=>p.stage==='heldout'&&p.ratio===ratio)}));
 held.sort((a,b)=>(mean(b.a.map(p=>p.difference))??-Infinity)-(mean(a.a.map(p=>p.difference))??-Infinity)||Math.abs(Math.log(a.ratio))-Math.abs(Math.log(b.ratio)));
 const winner=held[0],recommendedRatio=winner?.ratio??1,values=winner?.a.map(p=>p.difference)??[];
 // Bonferroni across the two frozen validation candidates. These CIs are
 // conditional on this synthetic design; they do not validate a GP posterior.
 const evidence=pairedEvidence(values,MARGIN,6,.05/Math.max(1,leaders.length));
 let intervalCovered=0,intervalTotal=0;
 for(const h of held){const interval=repeatedSummary(h.a.map(p=>p.difference),.05/Math.max(1,leaders.length)).interval;if(interval){intervalTotal++;const truth=profile.response(h.ratio)-profile.response(1);if(interval[0]<=truth&&truth<=interval[1])intervalCovered++;}}
 let gpCovered=0,gpTotal=0;
 if(method==='bayesian')for(const ratio of denseGrid.filter((_,i)=>i%50===0)){const prediction=gpPredict(observations,ratio*BASE),truth=.5+profile.response(ratio)-profile.response(1);gpTotal++;if(prediction.mean-1.96*prediction.sd<=truth&&truth<=prediction.mean+1.96*prediction.sd)gpCovered++;}
 const best=Math.max(...denseGrid.map(profile.response)),regret=Math.max(0,best-profile.response(recommendedRatio)),truthDelta=profile.response(recommendedRatio)-profile.response(1);
 return {profile:profile.id,method,seed,measurementBudget:profile.pairs*2,actualMeasurements:pairs.length*2,selectionPairs,heldoutPairs,pairedOrders:{AB:pairs.filter(p=>p.order==='AB').length,BA:pairs.filter(p=>p.order==='BA').length},recommendedRatio,regret,withinPracticalRegion:regret<=MARGIN,conclusion:evidence.conclusion,falseImprovement:evidence.conclusion==='improved'&&truthDelta<=MARGIN,intervalCovered,intervalTotal,gpCovered,gpTotal,heldoutCandidates:leaders,selectionSeeds:pairs.filter(p=>p.stage==='selection').map(p=>p.seed),heldoutSeeds:pairs.filter(p=>p.stage==='heldout').map(p=>p.seed),failed:!Number.isFinite(regret)||recommendedRatio<LOW||recommendedRatio>HIGH,cpuMilliseconds:performance.now()-started};
}

export function runPrecisionBenchmark(seeds=Array.from({length:12},(_,i)=>1049+i*1723)){
 const runs:BenchmarkRun[]=[];
 for(const profile of SYNTHETIC_PROFILES)for(const method of BENCHMARK_METHODS)for(const seed of seeds)runs.push(runOptimizerCase(profile,method,seed));
 const results=SYNTHETIC_PROFILES.flatMap(profile=>BENCHMARK_METHODS.map(method=>{
  const a=runs.filter(r=>r.profile===profile.id&&r.method===method),intervalTotal=a.reduce((s,r)=>s+r.intervalTotal,0),gpTotal=a.reduce((s,r)=>s+r.gpTotal,0);
  return {profile:profile.id,method,runs:a.length,measurementBudget:profile.pairs*2,observationsPerRun:[...new Set(a.map(r=>r.actualMeasurements))],meanRegret:mean(a.map(r=>r.regret)),p90Regret:quantile(a.map(r=>r.regret),.9),medianRecommendedRatio:median(a.map(r=>r.recommendedRatio)),recommendationLogSD:sd(a.map(r=>Math.log(r.recommendedRatio))),withinPracticalRegionRate:mean(a.map(r=>+r.withinPracticalRegion)),inconclusiveRate:mean(a.map(r=>+(r.conclusion==='inconclusive'))),falseImprovementRate:mean(a.map(r=>+r.falseImprovement)),failureRate:mean(a.map(r=>+r.failed)),heldoutIntervalCoverage:intervalTotal?a.reduce((s,r)=>s+r.intervalCovered,0)/intervalTotal:null,heldoutIntervals:intervalTotal,gpLatentIntervalCoverage:gpTotal?a.reduce((s,r)=>s+r.gpCovered,0)/gpTotal:null,cpuMilliseconds:a.reduce((s,r)=>s+r.cpuMilliseconds,0)};
 }));
 return {benchmark:'precision-optimizer-comparison',schema:1,synthetic:true,humanParticipants:0,seedRuns:seeds.length,profiles:SYNTHETIC_PROFILES.length,methods:[...BENCHMARK_METHODS],baseSensitivity:BASE,ratioDomain:[LOW,HIGH],practicalMargin:MARGIN,budgetUnit:'One baseline or candidate synthetic block observation; each AB/BA pair costs two',selectionFraction:.5,heldout:'Two frozen leaders; fresh noise seeds, reversed candidate order by round, paired baseline retest',interval:'Student-t paired-difference CI; Bonferroni across two frozen candidates; at least six validation pairs',gp:'Existing fixed-kernel GP-UCB proposal; default simple coarse search remains unchanged',limits:['Analytic surfaces and Gaussian errors are software stress tests, not measured people.','Confidence coverage is empirical for this simulation, not a universal confidence guarantee.','GP latent intervals are model-based; observed coverage is reported even when poor.','An untested continuous region is not inferred from two tested endpoints.'],results,runs};
}

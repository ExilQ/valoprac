import {describe,it,expect} from 'vitest';
import {studentTCritical,repeatedSummary,pairedEvidence,clusteredSummary} from '../aim/precision/statistics';
import {precisionReport,pairedComparison,summarizeBlocks,aimCompatibilityKey,sequentialObservations} from '../aim/statistics';
import {selectNextSensitivity,sensitivityPredictionCurve} from '../aim/optimizer';
import {random} from '../aim/math';
import {AIM_VERSION,type AimMeta,type AimMetrics,type AimRecord,type AimTask} from '../aim/types';
const TASKS:AimTask[]=['small','micro','reactive'];
function record(score:number,task:AimTask,sensitivity:number,round:number,trial:number,patch:Partial<AimMeta>={}):AimRecord{
 const meta:AimMeta={schema:1,id:`${round}-${task}-${sensitivity}-${trial}`,algorithm:AIM_VERSION,game:'test',experiment:'e',session:'s',createdAt:1000+round,task,phase:'exploration',sensitivity,dpi:800,dpiSource:'user-declared',coefficient:.07,fov:103,ads:false,adsMultiplier:1,rawMode:'requested',renderer:'angular-canvas',seed:round,round,pair:`${round}-${task}`,order:round,radius:.3,amplitude:8,duration:3,warmup:1,condition:`${round}-${task}`,valid:true,issues:[],appearanceKnown:true,expectedTasks:TASKS,expectedTrials:task==='reactive'?1:4,trialIndex:trial,blockId:`${round}-${task}-${sensitivity}`,inputFingerprint:'configuration-a',...patch};
 // Synthetic block-score fixture: movement fields are irrelevant to aggregation.
 const metrics={valid:true,issues:[],score,hit:true} as unknown as AimMetrics;return{meta,metrics,trace:[]};
}
function dataset(delta=.08,rounds=6){const rows:AimRecord[]=[];for(let round=0;round<rounds;round++)for(const task of TASKS)for(const sensitivity of[.35,.42])for(let trial=0;trial<(task==='reactive'?1:4);trial++)rows.push(record(.65+(round%2?.01:-.01)+(sensitivity===.42?delta:0),task,sensitivity,round,trial));return rows;}

describe('Repeated-block uncertainty uses stated sampling units',()=>{
 it('feeds complete repeated rounds to sequential acquisition instead of pooling every candidate into one observation',()=>{const observations=sequentialObservations(dataset(),.35,'tactical');expect(observations).toHaveLength(12);expect(observations.filter(o=>o.x===.42)).toHaveLength(6);expect(selectNextSensitivity(observations,.35,{budget:12}).stop).toBe('budget');});
 it('keeps the original control for normalization while excluding physically disallowed recommendations',()=>{const records=dataset();expect(precisionReport(records,.35,'tactical',{allowedSensitivities:[.42]}).recommended).toBe(.42);const none=precisionReport(records,.35,'tactical',{allowedSensitivities:[]});expect(none.recommended).toBeNull();expect(none.results.some(r=>r.sensitivity===.35)).toBe(true);});
 it('does not pool different protocol lengths or expected task batteries with the same input fingerprint',()=>{const quick=dataset().map(r=>({...r,meta:{...r.meta,protocol:'quick' as const}})),precision=dataset().map(r=>({...r,meta:{...r.meta,id:r.meta.id+'p',session:'p',experiment:'p',createdAt:r.meta.createdAt+10000,protocol:'precision' as const}})),report=precisionReport([...quick,...precision],.35,'tactical');expect(report.measurement.incompatible).toBe(quick.length);expect(aimCompatibilityKey(quick[0].meta)).not.toBe(aimCompatibilityKey(precision[0].meta));});

 it('matches published Student-t critical values at small and large sample sizes',()=>{
  expect(studentTCritical(.05,1)).toBeCloseTo(12.706204736,7);expect(studentTCritical(.05,3)).toBeCloseTo(3.182446305,7);expect(studentTCritical(.05,30)).toBeCloseTo(2.042272456,7);expect(studentTCritical(.01,9)).toBeCloseTo(3.249835542,7);
 });
 it('withholds intervals and decisions for insufficient independent blocks',()=>{expect(repeatedSummary([.1,.2,.3]).interval).toBeNull();expect(pairedEvidence([.1,.1,.1,.1]).conclusion).toBe('inconclusive');expect(clusteredSummary([Array(80).fill(.1)]).interval).toBeNull();});
 it('requires an entire interval within practical bounds for equivalence',()=>{
  expect(pairedEvidence([-.005,.005,0,-.002,.002,0]).conclusion).toBe('equivalent');expect(pairedEvidence([-.15,.15,-.12,.12,-.1,.1]).conclusion).toBe('inconclusive');expect(pairedEvidence([.09,.1,.11,.1,.09,.11]).conclusion).toBe('improved');expect(pairedEvidence([-.09,-.1,-.11,-.1,-.09,-.11]).conclusion).toBe('worse');
 });
 it('retains honest nominal mean-interval coverage on independent Gaussian block simulations',()=>{
  const rng=random(1217),normal=()=>Math.sqrt(-2*Math.log(Math.max(1e-12,rng())))*Math.cos(2*Math.PI*rng());let covered=0;
  for(let run=0;run<400;run++){const a=Array.from({length:12},()=>.08+.12*normal()),interval=repeatedSummary(a).interval!;if(interval[0]<=.08&&interval[1]>=.08)covered++;}
  expect(covered/400).toBeGreaterThan(.91);expect(covered/400).toBeLessThan(.99);console.info(JSON.stringify({benchmark:'precision-ci-coverage',distribution:'independent Gaussian repeated block means',simulations:400,nominal:.95,observed:covered/400,humanParticipants:0}));
 });
 it('does not turn conflicting days into precision through many trials per day',()=>{const result=clusteredSummary([Array(50).fill(.1),Array(50).fill(-.1)]);expect(result.interval![0]).toBeLessThan(-.1);expect(result.interval![1]).toBeGreaterThan(.1);});
});

describe('Measured recommendation separates compatibility and experimental evidence',()=>{
 it('does not rank one completed task as a completed multi-task calibration',()=>{
  const onlySmall=dataset().filter(r=>r.meta.task==='small');const r=precisionReport(onlySmall,.35,'tactical');expect(r.recommended).toBeNull();expect(r.status).toBe('insufficient');expect(r.results.every(x=>x.rounds===0)).toBe(true);
 });
 it('uses requested four-trial blocks, discards partials and deduplicates resumed trial indices',()=>{
  const a=dataset(0,2),single=a.filter(r=>r.meta.task==='small'&&r.meta.round===0&&r.meta.sensitivity===.35);expect(summarizeBlocks(single.slice(0,3))).toHaveLength(0);expect(summarizeBlocks([...single,...single.map(r=>({...r,meta:{...r.meta,id:'retry-'+r.meta.id,createdAt:2000}}))])).toHaveLength(1);expect(summarizeBlocks(single)[0].count).toBe(4);
 });
 it('normalizes within task against the paired baseline and exposes contradictory tradeoffs',()=>{
  const rows=dataset(0);for(const row of rows)if(row.meta.sensitivity===.42)row.metrics.score=row.meta.task==='reactive'?.95:.55;const r=precisionReport(rows,.35,'tactical'),baseline=r.results.find(x=>x.sensitivity===.35)!,candidate=r.results.find(x=>x.sensitivity===.42)!;expect(baseline.score).toBeCloseTo(.5);expect(candidate.taskResults.find(t=>t.task==='reactive')!.difference).toBeGreaterThan(0);expect(candidate.taskResults.find(t=>t.task==='small')!.difference).toBeLessThan(0);expect(candidate.score).toBeLessThan(baseline.score);
 });
 it('does not call overlapping, underpowered candidate results equivalent',()=>{const r=precisionReport(dataset(0,2),.35);expect(r.range).toEqual([.35,.42]);expect(r.equivalentRange).toBeNull();expect(r.rangeKind).toBe('unresolved');expect(r.recommended).toBe(.35);});
 it('identifies a sampled equivalent region only after repeated matched evidence',()=>{const r=precisionReport(dataset(0,6),.35);expect(r.equivalentRange).toEqual([.35,.42]);expect(r.rangeKind).toBe('equivalent');expect(r.explanations.join(' ')).toContain('시험하지 않은 중간');});
 it('never pools changed fingerprints, ADS/zoom, raw mode or algorithm version',()=>{
  for(const patch of[{inputFingerprint:'configuration-b'},{ads:true,scopeZoom:2.5},{rawMode:'fallback'},{algorithm:'another-algorithm'}]){const rows=dataset();for(const row of rows)if(row.meta.sensitivity===.42)Object.assign(row.meta,patch);const r=precisionReport(rows,.35);expect(r.results).toHaveLength(1);expect(r.measurement.incompatible).toBeGreaterThan(0);}
  const a=dataset()[0].meta;expect(aimCompatibilityKey(a)).not.toBe(aimCompatibilityKey({...a,ads:true,scopeZoom:5}));
 });
 it('does not interpret discovery records or one session as held-out proof',()=>{const a=dataset();expect(pairedComparison(a,.35,.42).conclusion).toBe('inconclusive');for(const row of a)row.meta.phase='verification';const held=pairedComparison(a,.35,.42);expect(held.independentRounds).toBe(6);expect(held.conclusion).toBe('inconclusive');expect(held.interval).toBeNull();});
 it('requires matched random sequences and complete tasks across separate sessions for held-out evidence',()=>{
  const a=dataset(.08,3).map(r=>({...r,meta:{...r.meta,phase:'verification' as const}})),b=a.map(r=>({...r,meta:{...r.meta,id:'s2'+r.meta.id,session:'s2',experiment:'e2'}}));expect(pairedComparison([...a,...b],.35,.42).conclusion).toBe('improved');for(const row of b)if(row.meta.sensitivity===.42)row.meta.condition+='unmatched';expect(pairedComparison([...a,...b],.35,.42).conclusion).toBe('inconclusive');
 });
});

describe('Finite sequential candidate acquisition',()=>{
 it('begins at baseline and includes baseline and leading-arm retests in its budget',()=>{
  const options={budget:12};expect(selectNextSensitivity([],.35,options).candidate).toBe(.35);const a=[{x:.35,y:.6,variance:.01},{x:.28,y:.55,variance:.01},{x:.42,y:.7,variance:.01}];expect(selectNextSensitivity(a,.35,options).candidate).toBe(.42);expect(selectNextSensitivity(Array.from({length:12},()=>a[0]),.35,options).stop).toBe('budget');
 });
 it('offers a fatigue break only after actual baseline decline with sufficient duration',()=>{
  const a=[.8,.82,.81,.6,.58,.59].map(y=>({x:.35,y,variance:.01}));expect(selectNextSensitivity(a,.35,{elapsedMinutes:36}).stop).toBe('fatigue');expect(selectNextSensitivity(a,.35,{elapsedMinutes:5}).stop).not.toBe('fatigue');
 });
 it('draws no posterior curve from sparse observations and never extrapolates beyond tested coverage',()=>{
  const a=[.28,.32,.35,.4].map(x=>({x,y:.7,variance:.005}));expect(sensitivityPredictionCurve(a)).toEqual([]);const curve=sensitivityPredictionCurve([...a,...a]);expect(curve).toHaveLength(41);expect(curve[0].x).toBeCloseTo(.28);expect(curve.at(-1)!.x).toBeCloseTo(.4);expect(curve.every(p=>p.interval[0]<=p.mean&&p.interval[1]>=p.mean&&p.modelDependent)).toBe(true);
 });
});

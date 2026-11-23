import {describe,it,expect} from 'vitest';
import {BENCHMARK_METHODS,SYNTHETIC_PROFILES,runOptimizerCase,runPrecisionBenchmark} from '../aim/precision/benchmarks';
import {pairedEvidence,repeatedSummary} from '../aim/precision/statistics';
import {random} from '../aim/math';

describe('Precision optimizer equal-budget stress cases, not human performance evidence',()=>{
 it('charges identical baseline/candidate measurements, counterbalances order and never leaks held-out noise seeds',()=>{
  for(const profile of SYNTHETIC_PROFILES)for(const method of BENCHMARK_METHODS){
   const run=runOptimizerCase(profile,method,1947);expect(run.actualMeasurements).toBe(run.measurementBudget);expect(run.actualMeasurements).toBe(profile.pairs*2);expect(run.pairedOrders.AB).toBe(run.pairedOrders.BA);expect(run.heldoutCandidates.length).toBeLessThanOrEqual(2);expect(run.heldoutSeeds.every(seed=>!run.selectionSeeds.includes(seed))).toBe(true);expect(run.failed).toBe(false);
  }
 });
 it('keeps sparse validation inconclusive instead of promoting a planted optimum',()=>{
  const sparse=SYNTHETIC_PROFILES.find(p=>p.id==='insufficient-data')!;
  for(const method of BENCHMARK_METHODS)for(const seed of[101,937,1947,9173])expect(runOptimizerCase(sparse,method,seed).conclusion).toBe('inconclusive');
  expect(pairedEvidence([.3,.31,.29],.02,6).conclusion).toBe('inconclusive');
 });
 it('does not mistake a broad performance plateau or large uncertainty for proof of improvement',()=>{
  expect(pairedEvidence([-.01,0,.01,-.005,.005,0,.002,-.002],.02,6).conclusion).toBe('equivalent');
  expect(pairedEvidence([-.4,.4,-.35,.35,-.3,.3],.02,6).conclusion).toBe('inconclusive');
  expect(repeatedSummary([1,1,1]).interval).toBeNull();
 });
 it('checks nominal paired-mean interval coverage under a declared Gaussian model',()=>{
  const rng=random(49771),normal=()=>Math.sqrt(-2*Math.log(Math.max(1e-12,rng())))*Math.cos(2*Math.PI*rng());let covered=0;
  for(let run=0;run<800;run++){const values=Array.from({length:12},()=>.04+.15*normal()),interval=repeatedSummary(values).interval!;if(interval[0]<=.04&&.04<=interval[1])covered++;}
  const empirical=covered/800;expect(empirical).toBeGreaterThan(.91);expect(empirical).toBeLessThan(.99);
  console.info(JSON.stringify({benchmark:'precision-interval-coverage',synthetic:true,humanParticipants:0,model:'iid Gaussian paired differences',replications:800,pairsPerReplication:12,nominal:.95,covered,empirical}));
 });
 it('executes nine profiles with equal budgets and reports failures, uncertainty and measured cost without choosing GP by name',()=>{
  const report=runPrecisionBenchmark();
  expect(report.results).toHaveLength(36);expect(report.runs).toHaveLength(432);expect(report.humanParticipants).toBe(0);
  for(const row of report.results){expect(row.observationsPerRun).toEqual([row.measurementBudget]);expect(row.failureRate).toBe(0);expect(Number.isFinite(row.meanRegret)).toBe(true);expect(row.cpuMilliseconds).toBeGreaterThanOrEqual(0);if(row.profile==='insufficient-data')expect(row.inconclusiveRate).toBe(1);}
  const low=report.results.filter(r=>r.profile==='low-sensitivity-precision'),high=report.results.filter(r=>r.profile==='high-sensitivity-tracking');
  expect(low.every(r=>r.medianRecommendedRatio!<1)).toBe(true);expect(high.every(r=>r.medianRecommendedRatio!>1)).toBe(true);
  const {runs:_,...summary}=report;console.info(JSON.stringify(summary));
 },30000);
});

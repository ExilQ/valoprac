import {clamp} from './math';
export interface Observation {x:number;y:number;variance:number;}
// Small one-dimensional GP. Fixed prior/hyperparameters; uncertainty is model-dependent.
export function gpPredict(observations:Observation[],x:number){const a=observations.filter(o=>Number.isFinite(o.x)&&o.x>0&&Number.isFinite(o.y)&&Number.isFinite(o.variance)&&o.variance>=0).slice(-32),n=a.length;if(!n||!Number.isFinite(x)||x<=0)return {mean:.5,sd:.3};
 const kernel=(u:number,v:number)=>.09*Math.exp(-.5*((Math.log(u)-Math.log(v))/.22)**2),l=Array.from({length:n},()=>new Float64Array(n));
 for(let i=0;i<n;i++)for(let j=0;j<=i;j++){let sum=kernel(a[i].x,a[j].x)+(i===j?Math.max(.0025,a[i].variance||0):0);for(let k=0;k<j;k++)sum-=l[i][k]*l[j][k];l[i][j]=i===j?Math.sqrt(Math.max(sum,1e-10)):sum/l[j][j];}
 const solve=(b:number[])=>{const v=new Float64Array(n),z=new Float64Array(n);for(let i=0;i<n;i++){let s=b[i];for(let j=0;j<i;j++)s-=l[i][j]*v[j];v[i]=s/l[i][i];}for(let i=n-1;i>=0;i--){let s=v[i];for(let j=i+1;j<n;j++)s-=l[j][i]*z[j];z[i]=s/l[i][i];}return z;},alpha=solve(a.map(o=>o.y-.5)),k=a.map(o=>kernel(o.x,x)),v=solve(k);let m=.5,variance=kernel(x,x);for(let i=0;i<n;i++){m+=k[i]*alpha[i];variance-=k[i]*v[i];}return {mean:clamp(m,0,1),sd:Math.sqrt(Math.max(variance,.000001))};
}
export function proposeSensitivity(a:Observation[],base:number,range=.2,method:'coarse'|'bayesian'='coarse'){
 base=clamp(Number.isFinite(base)&&base>0?base:.35,.01,5);range=clamp(Number.isFinite(range)?range:.2,.05,.5);a=a.filter(o=>Number.isFinite(o.x)&&o.x>0&&Number.isFinite(o.y)&&Number.isFinite(o.variance)&&o.variance>=0);
 const low=Math.max(.01,base*(1-range)),high=Math.min(5,base*(1+range)),grid=Array.from({length:41},(_,i)=>Math.exp(Math.log(low)+(Math.log(high)-Math.log(low))*i/40));
 const available=grid.filter(x=>!a.some(o=>Math.abs(Math.log(o.x/x))<.015));if(!available.length)return null;
 if(method==='bayesian')return available.reduce((best,x)=>{const p=gpPredict(a,x),b=gpPredict(a,best);return p.mean+1.5*p.sd>b.mean+1.5*b.sd?x:best;},available[0]);
 if(!a.length)return base;const best=a.reduce((b,o)=>o.y>b.y?o:b);return available.reduce((b,x)=>Math.abs(Math.log(x/best.x))<Math.abs(Math.log(b/best.x))?x:b,available[0]);
}

export interface SequentialOptions {range?:number;budget?:number;method?:'coarse'|'bayesian';practicalMargin?:number;elapsedMinutes?:number;}
export interface SequentialDecision {candidate:number|null;reason:string;stop:'budget'|'stable'|'fatigue'|null;method:'coarse'|'bayesian';tested:number;distinct:number;}
/** Called after a completed block, never from the mouse callback. Baseline
 * retests and leading-arm repeats are part of the same finite test budget. */
export function selectNextSensitivity(observations:Observation[],base:number,options:SequentialOptions={}):SequentialDecision {
 const a=observations.filter(o=>Number.isFinite(o.x)&&o.x>0&&Number.isFinite(o.y)&&Number.isFinite(o.variance)&&o.variance>=0),range=options.range??.2,budget=Math.max(3,Math.floor(options.budget??18)),method=options.method??'coarse',margin=options.practicalMargin??.02;
 base=clamp(Number.isFinite(base)&&base>0?base:.35,.01,5);const values=[...new Set(a.map(o=>o.x))],answer=(candidate:number|null,reason:string,stop:SequentialDecision['stop']=null):SequentialDecision=>({candidate,reason,stop,method,tested:a.length,distinct:values.length});
 if(a.length>=budget)return answer(null,'정해진 측정 예산을 모두 사용했습니다. 새 보류 과제에서 후보를 확인하세요.','budget');
 const baseline=a.filter(o=>Math.abs(Math.log(o.x/base))<1e-6);
 if((options.elapsedMinutes??0)>=35&&baseline.length>=3){const half=Math.floor(baseline.length/2),first=baseline.slice(0,half).reduce((s,o)=>s+o.y,0)/half,last=baseline.slice(-half).reduce((s,o)=>s+o.y,0)/half;if(last<first-.08)return answer(null,'기준 재시험의 성능이 낮아졌습니다. 피로와 순서 효과를 분리하려면 쉬고 다시 측정하세요.','fatigue');}
 if(!baseline.length)return answer(base,'현재 감도의 기준 블록을 먼저 측정합니다.');
 const low=Math.max(.01,base*(1-range)),high=Math.min(5,base*(1+range)),initial=[low,high].filter(x=>!values.some(v=>Math.abs(Math.log(x/v))<.015));
 if(initial.length)return answer(initial[0],'경계 후보를 같은 과제에서 비교하는 넓은 탐색입니다.');
 const sinceBaseline=a.length-1-a.map(o=>Math.abs(Math.log(o.x/base))<1e-6).lastIndexOf(true);if(sinceBaseline>=4)return answer(base,'워밍업·학습·피로를 관찰하기 위한 기준 감도 재시험입니다.');
 const arms=values.map(x=>{const rows=a.filter(o=>o.x===x),y=rows.reduce((s,o)=>s+o.y,0)/rows.length,variance=rows.reduce((s,o)=>s+o.variance,0)/(rows.length*rows.length);return{x,y,variance,count:rows.length};}).sort((a,b)=>b.y-a.y);
 const leading=arms[0];if(leading.count<2)return answer(leading.x,'단일 최고 점수가 우연인지 구분하도록 선두 후보를 반복합니다.');
 const runner=arms[1];if(runner&&runner.count<2&&runner.y+2*Math.sqrt(runner.variance)>=leading.y-margin)return answer(runner.x,'불확실성이 큰 경쟁 후보를 반복합니다.');
 if(arms.length>=3&&arms.every(arm=>arm.count>=3)&&a.length>=12){const lower=Math.min(...arms.map(arm=>arm.y-2*Math.sqrt(arm.variance))),upper=Math.max(...arms.map(arm=>arm.y+2*Math.sqrt(arm.variance)));if(upper-lower<=margin)return answer(null,'관측 후보 사이의 차이가 실용적 기준보다 작습니다. 더 세밀한 숫자 대신 잠정 범위를 유지하세요.','stable');}
 const next=proposeSensitivity(arms,base,range,method);return next===null?answer(null,'이 범위의 추가 후보가 소진됐습니다. 보류 비교로 전환하세요.','budget'):answer(next,method==='bayesian'?'실험적 GP 상한으로 유망도와 모형 불확실성을 함께 탐색합니다.':'반복 측정된 선두 주변을 좁게 나누는 단순 탐색입니다.');
}
/** A posterior curve is optional and visibly model-dependent. With sparse
 * coverage return no curve, rather than drawing a smooth invented response. */
export function sensitivityPredictionCurve(observations:Observation[],points=41){
 const a=observations.filter(o=>Number.isFinite(o.x)&&o.x>0&&Number.isFinite(o.y)&&Number.isFinite(o.variance)&&o.variance>=0),values=[...new Set(a.map(o=>o.x))].sort((a,b)=>a-b);if(a.length<8||values.length<4)return [];
 const low=values[0],high=values.at(-1)!;return Array.from({length:Math.max(2,Math.min(101,Math.round(points)))},(_,i)=>{const x=Math.exp(Math.log(low)+(Math.log(high)-Math.log(low))*i/(Math.max(2,Math.min(101,Math.round(points)))-1)),p=gpPredict(a,x);return {x,mean:p.mean,interval:[Math.max(0,p.mean-1.96*p.sd),Math.min(1,p.mean+1.96*p.sd)] as [number,number],modelDependent:true as const};});
}

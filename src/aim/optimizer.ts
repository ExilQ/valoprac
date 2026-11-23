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

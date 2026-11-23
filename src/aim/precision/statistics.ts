import {mean,median,sd} from '../math';

/** Numerical Student-t quantiles, rather than a normal approximation at small n.
 * The mean interval assumes independent repeated blocks and finite variance.
 * It is not a posterior probability that a sensitivity is optimal. */
function logGamma(z:number):number {
 const c=[676.5203681218851,-1259.1392167224028,771.32342877765313,-176.61502916214059,12.507343278686905,-.13857109526572012,9.9843695780195716e-6,1.5056327351493116e-7];
 if(z<.5)return Math.log(Math.PI)-Math.log(Math.sin(Math.PI*z))-logGamma(1-z);
 z--;let x=.99999999999980993;for(let i=0;i<c.length;i++)x+=c[i]/(z+i+1);const t=z+c.length-.5;return .5*Math.log(2*Math.PI)+(z+.5)*Math.log(t)-t+Math.log(x);
}
function betaFraction(a:number,b:number,x:number){
 const tiny=1e-300;let c=1,d=1-(a+b)*x/(a+1);if(Math.abs(d)<tiny)d=tiny;d=1/d;let h=d;
 for(let m=1;m<=200;m++){const m2=2*m;let v=m*(b-m)*x/((a+m2-1)*(a+m2));d=1+v*d;if(Math.abs(d)<tiny)d=tiny;c=1+v/c;if(Math.abs(c)<tiny)c=tiny;d=1/d;h*=d*c;v=-(a+m)*(a+b+m)*x/((a+m2)*(a+m2+1));d=1+v*d;if(Math.abs(d)<tiny)d=tiny;c=1+v/c;if(Math.abs(c)<tiny)c=tiny;d=1/d;const step=d*c;h*=step;if(Math.abs(step-1)<3e-14)break;}return h;
}
function regularizedBeta(x:number,a:number,b:number){if(x<=0)return 0;if(x>=1)return 1;const front=Math.exp(logGamma(a+b)-logGamma(a)-logGamma(b)+a*Math.log(x)+b*Math.log1p(-x));return x<(a+1)/(a+b+2)?front*betaFraction(a,b,x)/a:1-front*betaFraction(b,a,1-x)/b;}
const criticalCache=new Map<string,number>();
export function studentTCritical(alpha:number,df:number){
 if(!(alpha>0&&alpha<1)||!Number.isFinite(df)||df<1)throw new Error('Invalid Student-t interval parameters');
 const key=`${alpha}|${df}`,cached=criticalCache.get(key);if(cached!==undefined)return cached;
 const tail=alpha/2,cdf=(x:number)=>1-.5*regularizedBeta(df/(df+x*x),df/2,.5);let low=0,high=1;while(cdf(high)<1-tail&&high<1e12)high*=2;for(let i=0;i<80;i++){const mid=(low+high)/2;if(cdf(mid)<1-tail)low=mid;else high=mid;}const value=(low+high)/2;if(criticalCache.size>=512)criticalCache.delete(criticalCache.keys().next().value!);criticalCache.set(key,value);return value;
}
export interface RepeatedSummary {count:number;mean:number|null;median:number|null;sd:number|null;mad:number|null;interval:[number,number]|null;}
export function repeatedSummary(values:readonly number[],alpha=.05):RepeatedSummary {
 const a=values.filter(Number.isFinite),m=mean(a),center=median(a),spread=sd(a),mad=center===null?null:median(a.map(x=>Math.abs(x-center)));let interval:[number,number]|null=null;
 if(a.length>=4&&m!==null&&spread!==null){const radius=studentTCritical(alpha,a.length-1)*spread/Math.sqrt(a.length);interval=[m-radius,m+radius];}
 return {count:a.length,mean:m,median:center,sd:spread,mad,interval};
}
export function pairedEvidence(values:readonly number[],margin=.02,minRounds=6,alpha=.05){
 const summary=repeatedSummary(values,alpha),interval=summary.interval,valid=summary.count>=minRounds&&interval!==null;
 const conclusion=!valid?'inconclusive':interval![0]>margin?'improved':interval![1]<-margin?'worse':interval![0]>=-margin&&interval![1]<=margin?'equivalent':'inconclusive';
 return {...summary,difference:summary.mean,margin,effectSize:summary.sd&&summary.mean!==null?summary.mean/summary.sd:null,conclusion:conclusion as 'improved'|'worse'|'equivalent'|'inconclusive'};
}
/** Session-aware interval. Adds between-session and within-session uncertainty
 * and uses session degrees of freedom. More trials in one session cannot
 * manufacture more independent sessions. With <2 sessions no interval exists. */
export function clusteredSummary(groups:readonly (readonly number[])[],alpha=.05):RepeatedSummary {
 const a=groups.map(g=>g.filter(Number.isFinite)).filter(g=>g.length),flat=a.flat(),summary=repeatedSummary(flat,alpha);if(a.length<2)return {...summary,interval:null};
 const centers=a.map(g=>mean(g)!),m=mean(centers)!,between=sd(centers)??0;
 const within=a.reduce((s,g)=>s+(sd(g)??0)**2/g.length,0)/(a.length*a.length),variance=between*between/a.length+within,radius=studentTCritical(alpha,a.length-1)*Math.sqrt(variance);
 return {...summary,mean:m,interval:[m-radius,m+radius]};
}
export function aggregateTaskDeltas(rows:readonly {task:string;delta:number}[],weights:Readonly<Record<string,number>>){
 const groups=new Map<string,number[]>();for(const r of rows){if(!Number.isFinite(r.delta))continue;const a=groups.get(r.task)??[];a.push(r.delta);groups.set(r.task,a);}let sum=0,total=0;for(const[task,a]of groups){const weight=weights[task]??1;if(weight<=0)continue;sum+=mean(a)!*weight;total+=weight;}return total?sum/total:null;
}
export function rankCorrelation(x:readonly number[],y:readonly number[]){
 if(x.length!==y.length||x.length<8)return null;
 const ranks=(a:readonly number[])=>a.map(v=>{let below=0,same=0;for(const other of a){if(other<v)below++;else if(other===v)same++;}return below+(same+1)/2;});const a=ranks(x),b=ranks(y),ma=mean(a)!,mb=mean(b)!;let cross=0,aa=0,bb=0;for(let i=0;i<a.length;i++){cross+=(a[i]-ma)*(b[i]-mb);aa+=(a[i]-ma)**2;bb+=(b[i]-mb)**2;}return aa&&bb?cross/Math.sqrt(aa*bb):null;
}

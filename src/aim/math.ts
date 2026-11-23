export const clamp=(x:number,a:number,b:number)=>Math.max(a,Math.min(b,x));
export const mean=(a:number[])=>a.length?a.reduce((s,v)=>s+v,0)/a.length:null;
export function quantile(a:number[],q:number){if(!a.length)return null;const b=a.slice().sort((x,y)=>x-y),p=(b.length-1)*q,l=Math.floor(p);return b[l]+(b[Math.min(b.length-1,l+1)]-b[l])*(p-l);}
export const median=(a:number[])=>quantile(a,.5);
export function sd(a:number[]){const m=mean(a);return m!==null&&a.length>1?Math.sqrt(a.reduce((s,v)=>s+(v-m)**2,0)/(a.length-1)):null;}
export function random(seed:number){let x=seed>>>0;return ()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return (x>>>0)/4294967296;};}
export function shuffled<T>(a:T[],rng:()=>number){const b=a.slice();for(let i=b.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[b[i],b[j]]=[b[j],b[i]];}return b;}
export function ci(a:number[],seed=1234,iterations=1200):[number,number]|null{if(a.length<4)return null;const r=random(seed),values=new Array<number>(iterations);for(let b=0;b<iterations;b++){let s=0;for(let j=0;j<a.length;j++)s+=a[Math.floor(r()*a.length)];values[b]=s/a.length;}return [quantile(values,.025)!,quantile(values,.975)!];}
export function angularDistance(y:number,p:number,ty:number,tp:number){const d=Math.PI/180,c=Math.sin(p*d)*Math.sin(tp*d)+Math.cos(p*d)*Math.cos(tp*d)*Math.cos((y-ty)*d);return Math.acos(clamp(c,-1,1))/d;}
export function localDelta(y:number,p:number,ty:number,tp:number){let dx=(ty-y)%360;if(dx>180)dx-=360;if(dx< -180)dx+=360;return [dx*Math.cos((p+tp)*Math.PI/360),tp-p];}

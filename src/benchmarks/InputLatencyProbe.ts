// CPU event-to-render-submit proxy. This does NOT measure input-to-photon latency.
export class InputLatencyProbe {
 private pending=new Float64Array(128);private kinds=new Uint8Array(128);private count=0;
 private look=new Float64Array(512);private click=new Float64Array(512);private lookCount=0;private clickCount=0;
 mark(kind:'look'|'click',eventTime:number,now:number){if(this.count>=128)return;this.pending[this.count]=Number.isFinite(eventTime)&&eventTime>0&&Math.abs(now-eventTime)<60000?eventTime:now;this.kinds[this.count++]=kind==='look'?0:1;}
 submitted(now:number){for(let i=0;i<this.count;i++){const d=Math.max(0,now-this.pending[i]);if(this.kinds[i]===0)this.look[this.lookCount++%512]=d;else this.click[this.clickCount++%512]=d;}this.count=0;}
 clearPending(){this.count=0;}
 snapshot(){const stats=(data:Float64Array,total:number)=>{const n=Math.min(total,data.length),s=Array.from(data.subarray(0,n)).sort((a,b)=>a-b);return {total,samples:n,medianMs:n?s[Math.floor(n*.5)]:null,p95Ms:n?s[Math.floor(n*.95)]:null};};return {metric:'DOM-event-to-render-submit CPU proxy',mouse:stats(this.look,this.lookCount),click:stats(this.click,this.clickCount),inputToPhotonMs:null,shotToPhotonMs:null,limitations:['Excludes GPU completion, scanout, peripheral latency and unsampled events.','Averages do not represent externally measured end-to-end latency.']};}
}

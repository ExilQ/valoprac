// Bounded delivery/callback metrics. These are not sensor polling or input-to-photon latency.
export class InputDiagnostics {
 private stamps=new Float64Array(2048);private delays=new Float64Array(2048);private costs=new Float64Array(2048);private cursor=0;
 events=0;sumX=0;sumY=0;
 record(stamp:number,received:number,cost:number,dx:number,dy:number){const i=this.cursor++%2048;this.stamps[i]=received;this.delays[i]=Math.max(0,received-stamp);this.costs[i]=cost;this.events++;this.sumX+=dx;this.sumY+=dy;}
 snapshot(now=performance.now()){const n=Math.min(this.cursor,2048),costs:number[]=[],delays:number[]=[];let recent=0,first=now;for(let i=0;i<n;i++){costs.push(this.costs[i]);delays.push(this.delays[i]);if(now-this.stamps[i]<=1000){recent++;first=Math.min(first,this.stamps[i]);}}costs.sort((a,b)=>a-b);delays.sort((a,b)=>a-b);return {events:this.events,deliveredHz:recent>1?(recent-1)*1000/Math.max(1,now-first):0,callbackP95:costs[Math.floor(n*.95)]??0,deliveryP95:delays[Math.floor(n*.95)]??0,sumX:this.sumX,sumY:this.sumY,capacity:2048};}
}

export interface StreamMetrics {rttMs:number|null;jitterMs:number|null;packetLossPercent:number|null;decodeMs:number|null;encodeMs:number|null;fps:number|null;displayLatencyMs:number|null;}
export const EMPTY_METRICS:StreamMetrics={rttMs:null,jitterMs:null,packetLossPercent:null,decodeMs:null,encodeMs:null,fps:null,displayLatencyMs:null};
const finite=(n:unknown):n is number=>typeof n==='number'&&Number.isFinite(n)&&n>=0;
// Counters use deltas; no unsynchronized server/browser timestamp subtraction.
export class StreamDiagnostics {
 metrics={...EMPTY_METRICS};private previous:{decoded:number;decodeTime:number;lost:number;received:number}|null=null;
 ingest(s:{inboundVideoStats:Record<string,unknown>;getActiveCandidatePair:()=>{currentRoundTripTime?:number}|null}){
  const v=s.inboundVideoStats,p=s.getActiveCandidatePair();if(finite(p?.currentRoundTripTime))this.metrics.rttMs=p.currentRoundTripTime*1000;
  if(finite(v.jitter))this.metrics.jitterMs=v.jitter*1000;if(finite(v.framesPerSecond))this.metrics.fps=v.framesPerSecond;
  if(finite(v.framesDecoded)&&finite(v.totalDecodeTime)&&finite(v.packetsLost)&&finite(v.packetsReceived)){
   const next={decoded:v.framesDecoded,decodeTime:v.totalDecodeTime,lost:v.packetsLost,received:v.packetsReceived},prev=this.previous;
   if(prev){const frames=next.decoded-prev.decoded,time=next.decodeTime-prev.decodeTime,lost=Math.max(0,next.lost-prev.lost),received=next.received-prev.received;if(frames>0&&time>=0)this.metrics.decodeMs=time/frames*1000;if(received>=0&&lost+received>0)this.metrics.packetLossPercent=lost/(lost+received)*100;}
   this.previous=next;
  }
  return {...this.metrics};
 }
 encode(ms:unknown){if(finite(ms))this.metrics.encodeMs=ms;return {...this.metrics};}
}

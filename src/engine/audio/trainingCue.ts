/** Original short reaction cue, authored mathematically for this trainer. */
export function synthesizeTrainingCue(sampleRate:number):Float32Array {
 const rate=Number.isFinite(sampleRate)&&sampleRate>=8000?sampleRate:48000;
 const samples=new Float32Array(Math.round(rate*.14));
 for(let i=0;i<samples.length;i++){
  const t=i/rate,x=i/Math.max(1,samples.length-1),envelope=Math.sin(Math.PI*x)**2;
  samples[i]=envelope*(.24*Math.sin(2*Math.PI*(600*t+750*t*t))+.06*Math.sin(2*Math.PI*1800*t)*Math.exp(-35*t));
 }
 return samples;
}

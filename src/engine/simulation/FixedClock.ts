export const FIXED_DT=1/120;
export class FixedClock {
  accumulator=0; ticks=0; deferredTicks=0;
  // Preserve debt after ordinary frame drops; never silently throw away elapsed time.
  advance(elapsed:number,step:(dt:number)=>void){
    this.accumulator+=Math.max(0,elapsed);let count=0;
    while(this.accumulator+1e-10>=FIXED_DT&&count<120){step(FIXED_DT);this.accumulator-=FIXED_DT;this.ticks++;count++;}
    if(this.accumulator<0)this.accumulator=0;
    this.deferredTicks=Math.floor(this.accumulator/FIXED_DT);
    return Math.min(1,this.accumulator/FIXED_DT);
  }
  reset(){this.accumulator=0;this.ticks=0;this.deferredTicks=0;}
}

/** Bounded playout repair, not a gameplay clock. Stale events are discarded by
 * TrainingAudio before entering this timeline. A retained burst keeps its
 * simulation intervals after a stall instead of starting every sound at once.
 * At most 150 ms of extra playout delay is permitted; idle gaps reset it. */
export class FiringTimeline {
  private emitters=new Map<string,{timestamp:number;startsAt:number}>();
  schedule(emitter:string,timestamp:number,target:number,now:number){
    const late=target<now-.008,earliest=late?now+.012:Math.max(now,target);
    const previous=this.emitters.get(emitter),gap=previous?timestamp-previous.timestamp:Infinity;
    const startsAt=previous&&gap>0&&gap<=.45?Math.max(earliest,previous.startsAt+gap):earliest;
    if(startsAt>Math.max(now,target)+.15)return null;
    this.emitters.set(emitter,{timestamp,startsAt});
    return{startsAt,repaired:startsAt>Math.max(now,target)+.001};
  }
  clear(){this.emitters.clear();}
}

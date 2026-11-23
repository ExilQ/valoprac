// Rendering may skip a RAF; simulation and input still run on every RAF.
export class RenderCadence {
 private next=0;
 private limit=0;
 reset(){this.next=0;}
 shouldDraw(now:number,limit:number){
  if(limit!==this.limit){this.limit=limit;this.next=0;}
  if(!limit)return true;
  if(now+0.05<this.next)return false;
  const interval=1000/limit;
  this.next=this.next&&now-this.next<interval?this.next+interval:now+interval;
  return true;
 }
}

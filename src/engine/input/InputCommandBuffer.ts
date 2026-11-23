/** Timestamped movement intent in monotonic seconds. This preserves the area of
 * short directional pulses inside a fixed tick; it is not native CS2 sub-tick
 * simulation. Opposite pulses in one tick can average to zero. */
export interface MovementAxes {forward:number;strafe:number;walk:boolean;crouch:boolean;jumpHeld:boolean;yaw?:number;}
type AxisCommand={time:number;sequence:number;kind:'axes';axes:MovementAxes};
type JumpCommand={time:number;sequence:number;kind:'jump';requestedAt:number;source:'keyboard'|'wheel'};
type YawCommand={time:number;sequence:number;kind:'yaw';yaw:number};
type Command=AxisCommand|JumpCommand|YawCommand;
export interface MovementInputSample extends MovementAxes {yaw:number;jumpTimes:number[];}
const EPS=1e-10;
const axes=(value:Partial<MovementAxes>={}):MovementAxes&{yaw:number}=>({forward:Number.isFinite(value.forward)?Math.max(-1,Math.min(1,value.forward!)):0,strafe:Number.isFinite(value.strafe)?Math.max(-1,Math.min(1,value.strafe!)):0,walk:!!value.walk,crouch:!!value.crouch,jumpHeld:!!value.jumpHeld,yaw:Number.isFinite(value.yaw)?value.yaw!:0});
export class InputCommandBuffer {
 readonly capacity=512;private commands:Command[]=[];private current:MovementAxes&{yaw:number}=axes();private cursor=0;private sequence=0;overflow=0;processed=0;
 reset(time=0,yaw=0){this.commands=[];this.current=axes({yaw});this.cursor=Number.isFinite(time)?time:0;this.sequence=0;this.overflow=0;this.processed=0;}
 private add(command:Command){
  command.time=Math.max(this.cursor,Number.isFinite(command.time)?command.time:this.cursor);
  // Fail closed on overload. Applying a discarded future command to current
  // state would manufacture movement before its timestamp. Drop the pending
  // horizon, clear held axes, retain the already-consumed yaw, then accept the
  // newest command at its actual time. Diagnostics expose the command loss.
  if(this.commands.length>=this.capacity){this.overflow+=this.commands.length;this.commands=[];this.current=axes({yaw:this.current.yaw});}
  const previous=this.commands.at(-1);this.commands.push(command);if(previous&&command.time<previous.time)this.commands.sort((a,b)=>a.time-b.time||a.sequence-b.sequence);
 }
 setAxes(time:number,value:MovementAxes){this.add({time,sequence:++this.sequence,kind:'axes',axes:axes(value)});}
 setYaw(time:number,yaw:number){if(Number.isFinite(yaw))this.add({time,sequence:++this.sequence,kind:'yaw',yaw});}
 jump(time:number,source:'keyboard'|'wheel'='keyboard'){this.add({time,sequence:++this.sequence,kind:'jump',requestedAt:Number.isFinite(time)?time:this.cursor,source});}
 consume(start:number,end:number):MovementInputSample{
  const dt=end-start;if(!Number.isFinite(start)||!Number.isFinite(end)||dt<=0)return{...this.current,jumpTimes:[]};
  if(end<=this.cursor+EPS)return{...this.current,jumpTimes:[]};
  let forward=0,strafe=0;const jumps:number[]=[];
  const integrate=(until:number)=>{const length=Math.max(0,until-this.cursor);forward+=this.current.forward*length;strafe+=this.current.strafe*length;this.cursor=until;};
  // If the first render begins after lock acquisition, include queued pre-frame
  // pulse area once. Clamping below prevents a delayed frame magnifying intent.
  while(this.commands.length&&this.commands[0].time<=end+EPS){const command=this.commands.shift()!;integrate(Math.max(this.cursor,Math.min(end,command.time)));if(command.kind==='axes')this.current=axes(command.axes);else if(command.kind==='yaw')this.current.yaw=command.yaw;else if(jumps.length<64)jumps.push(command.requestedAt);this.processed++;}
  integrate(end);
  return{...this.current,forward:Math.max(-1,Math.min(1,forward/dt)),strafe:Math.max(-1,Math.min(1,strafe/dt)),jumpTimes:jumps};
 }
 snapshot(){return{queued:this.commands.length,capacity:this.capacity,overflow:this.overflow,processed:this.processed,cursor:this.cursor};}
}

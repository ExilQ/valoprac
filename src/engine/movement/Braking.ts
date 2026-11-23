import type { InputState } from '../types';
import type { Movement } from './Movement';
export class Braking {
  releaseTime:number|null=null;thresholdTime:number|null=null;initialSpeed:number|null=null;
  stopTime:number|null=null;initialVX=0;private initialVZ=0;windowEnd:number|null=null;
  kind:'neutral'|'opposite'|null=null;private previousInputX=0;private previousInputZ=0;active=false;shotRecorded=false;
  update(input:InputState,yaw:number,movement:Movement,time:number){
    const x=input.strafe*Math.cos(yaw)-input.forward*Math.sin(yaw),z=-input.forward*Math.cos(yaw)-input.strafe*Math.sin(yaw);
    const had=this.previousInputX!==0||this.previousInputZ!==0;
    const neutral=input.strafe===0&&input.forward===0;
    const reversed=input.strafe*this.previousInputX+input.forward*this.previousInputZ<0;
    if(movement.grounded&&had&&(neutral||reversed)&&movement.speed>movement.profile.accuracyVelocityThreshold){
      this.releaseTime=time;this.thresholdTime=null;this.windowEnd=null;this.stopTime=null;this.initialVX=movement.velocity.x;this.initialVZ=movement.velocity.z;this.initialSpeed=movement.speed;this.kind=reversed?'opposite':'neutral';this.active=true;this.shotRecorded=false;
    }
    if(this.active&&this.thresholdTime===null&&!neutral&&x*movement.velocity.x+z*movement.velocity.z<0)this.kind='opposite';
    if(this.active&&this.thresholdTime===null&&movement.accurate)this.thresholdTime=time;
    if(this.active&&this.releaseTime!==null&&time-this.releaseTime>1.5)this.active=false;
    this.previousInputX=input.strafe;this.previousInputZ=input.forward;
  }
  observe(movement:Movement,time:number){
    if(!this.active)return;
    if(this.thresholdTime===null&&movement.accurate)this.thresholdTime=time;
    if(this.thresholdTime!==null&&this.windowEnd===null&&!movement.accurate)this.windowEnd=time;
    if(this.stopTime===null&&(movement.speed<0.02||movement.velocity.x*this.initialVX+movement.velocity.z*this.initialVZ<=0))this.stopTime=time;
  }
  get fullDuration(){return this.stopTime!==null&&this.releaseTime!==null?this.stopTime-this.releaseTime:null;}
  get duration(){return this.thresholdTime!==null&&this.releaseTime!==null?this.thresholdTime-this.releaseTime:null;}
}

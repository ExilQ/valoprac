import { Vector3 } from 'three';
import { MOVEMENT, type MovementProfile } from '../../config/movement';
import type { InputState } from '../types';
import { ENVIRONMENT,surfaceHeight,type Obstacle } from '../collision/environment';
export class Movement {
  position=new Vector3(0,0,5);previous=new Vector3(0,0,5);velocity=new Vector3();
  speedModifier=1;grounded=true;crouch=0;eyeHeight=1.64;previousEyeHeight=1.64;speed=0;landedAt=-100;
  constructor(public profile:MovementProfile={...MOVEMENT},public obstacles:Obstacle[]=ENVIRONMENT){}
  get accurate(){return this.grounded&&this.speed<=this.profile.accuracyVelocityThreshold;}
  private support(x:number,z:number,maxY:number){let y=0;for(const o of this.obstacles){const b=o.box;if(x>=b.min.x&&x<=b.max.x&&z>=b.min.z&&z<=b.max.z){const h=surfaceHeight(o,x,z);if(h<=maxY+1e-6&&h>y)y=h;}}return y;}
  step(input:InputState,yaw:number,dt:number,time:number){
    const p=this.profile;this.previous.copy(this.position);this.previousEyeHeight=this.eyeHeight;
    const crouchTarget=input.crouch?1:0;this.crouch+=Math.sign(crouchTarget-this.crouch)*Math.min(Math.abs(crouchTarget-this.crouch),dt*8);
    this.eyeHeight=p.standingEyeHeight+(p.crouchingEyeHeight-p.standingEyeHeight)*this.crouch;
    let forward=input.forward,side=input.strafe;const len=Math.hypot(forward,side);if(len>1){forward/=len;side/=len;}
    const sin=Math.sin(yaw),cos=Math.cos(yaw);const dx=(side*cos-forward*sin),dz=(-forward*cos-side*sin);
    const modifier=(input.walk?p.walkModifier:1)*(1+(p.crouchModifier-1)*this.crouch)*(forward<0?p.backwardModifier:1)*(Math.abs(side)>0?p.lateralModifier:1);
    const targetSpeed=p.maxSpeed*modifier*this.speedModifier;
    if(this.grounded){
      if(len>0){
        const dot=dx*this.velocity.x+dz*this.velocity.z;
        const acceleration=dot<0?p.reverseAcceleration:p.groundAcceleration;
        const tx=dx*targetSpeed-this.velocity.x,tz=dz*targetSpeed-this.velocity.z,delta=Math.hypot(tx,tz),amount=Math.min(delta,acceleration*dt);
        if(delta>1e-9){this.velocity.x+=tx/delta*amount;this.velocity.z+=tz/delta*amount;}
      }else{
        const s=Math.hypot(this.velocity.x,this.velocity.z);
        const next=Math.max(0,s-(p.groundDeceleration+p.friction*s)*dt);
        if(s>0){this.velocity.x*=next/s;this.velocity.z*=next/s;}
      }
      if(input.jump){this.velocity.y=p.jumpImpulse;this.grounded=false;}
    }else if(len>0){
      const along=this.velocity.x*dx+this.velocity.z*dz;const add=Math.min(p.airAcceleration*dt,Math.max(0,p.airMaxSpeed-along));
      this.velocity.x+=dx*add;this.velocity.z+=dz*add;
      const s=Math.hypot(this.velocity.x,this.velocity.z);if(s>p.airMaxSpeed){this.velocity.x*=p.airMaxSpeed/s;this.velocity.z*=p.airMaxSpeed/s;}
    }
    const supportBefore=this.support(this.position.x,this.position.z,this.position.y+.01);if(this.grounded&&this.position.y-supportBefore>.08)this.grounded=false;
    if(!this.grounded)this.velocity.y-=p.gravity*dt;
    // Axis-separated circle/AABB resolution is sufficient for this flat, box-only arena.
    // Fixed-step displacement is < 5 cm; split further for edited high-speed profiles.
    const steps=Math.max(1,Math.ceil(Math.max(Math.abs(this.velocity.x),Math.abs(this.velocity.z))*dt/(p.radius*0.5)));
    for(let i=0;i<steps;i++){
      this.position.x+=this.velocity.x*dt/steps;this.resolve('x');
      this.position.z+=this.velocity.z*dt/steps;this.resolve('z');
    }
    const oldY=this.position.y;this.position.y+=this.velocity.y*dt;
    const floor=this.support(this.position.x,this.position.z,this.grounded?oldY+.3:oldY+.01);
    if(this.velocity.y<=0&&this.position.y<=floor+1e-6){if(!this.grounded)this.landedAt=time;this.position.y=floor;this.velocity.y=0;this.grounded=true;}
    else if(this.grounded){if(floor>=oldY-.3&&floor<=oldY+.3)this.position.y=floor;else this.grounded=false;}
    if(this.velocity.y>0){for(const o of this.obstacles){if(o.ramp)continue;const b=o.box,top=this.position.y+(this.crouch>.5?1.35:1.85);if(this.position.x+p.radius>b.min.x&&this.position.x-p.radius<b.max.x&&this.position.z+p.radius>b.min.z&&this.position.z-p.radius<b.max.z&&oldY+1.85<=b.min.y&&top>=b.min.y){this.position.y=b.min.y-1.85;this.velocity.y=0;}}}
    this.speed=Math.hypot(this.velocity.x,this.velocity.z);
  }
  private resolve(axis:'x'|'z'){
    const other=axis==='x'?'z':'x',p=this.profile,bodyTop=this.position.y+(this.crouch>0.5?1.35:1.85);
    for(const o of this.obstacles){const {box}=o;
      const stepTop=surfaceHeight(o,this.position.x,this.position.z);if(this.grounded&&stepTop<=this.position.y+.3)continue;
      if(o.ramp&&this.position.y>=stepTop-.3)continue;
      if(bodyTop<=box.min.y||this.position.y>=box.max.y)continue;
      if(this.position[other]+p.radius>box.min[other]&&this.position[other]-p.radius<box.max[other]&&this.position[axis]+p.radius>box.min[axis]&&this.position[axis]-p.radius<box.max[axis]){
        if(this.velocity[axis]>0)this.position[axis]=box.min[axis]-p.radius;
        else if(this.velocity[axis]<0)this.position[axis]=box.max[axis]+p.radius;
        this.velocity[axis]=0;
      }
    }
  }
  estimateReadyTime(input:InputState,yaw:number,dt=1/120,threshold=this.profile.accuracyVelocityThreshold){
    if(!this.grounded)return null;
    let x=this.velocity.x,z=this.velocity.z;
    const l=Math.hypot(input.forward,input.strafe);let dx=0,dz=0;
    if(l){const f=input.forward/Math.max(1,l),s=input.strafe/Math.max(1,l);dx=s*Math.cos(yaw)-f*Math.sin(yaw);dz=-f*Math.cos(yaw)-s*Math.sin(yaw);}
    if(l&&dx*x+dz*z>=0&&this.speed>threshold)return null;
    for(let n=0;n<240;n++){
      const speed=Math.hypot(x,z);if(speed<=threshold)return n*dt;
      if(!l){const next=Math.max(0,speed-(this.profile.groundDeceleration+this.profile.friction*speed)*dt);x*=next/speed;z*=next/speed;}
      else{x+=dx*this.profile.reverseAcceleration*dt;z+=dz*this.profile.reverseAcceleration*dt;}
    }return null;
  }
}

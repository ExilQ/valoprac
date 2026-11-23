import { Box3, Matrix4, Object3D, Ray, Sphere, Vector3 } from 'three';
import type { Behavior, HitZone } from '../types';
import { SeededRandom } from '../simulation/random';
export interface HitPart {zone:HitZone;node:Object3D;shape:'sphere'|'box';size:Vector3;inverse:Matrix4;box:Box3;sphere:Sphere}
const localRay=new Ray(),localHit=new Vector3(),worldHit=new Vector3();
export class Target {
  root=new Object3D();parts:HitPart[]=[];head!:HitPart;previous=new Vector3();anchor=new Vector3();
  upper=new Object3D();leftHip=new Object3D();rightHip=new Object3D();leftKnee=new Object3D();rightKnee=new Object3D();
  leftArm=new Object3D();rightArm=new Object3D();
  private hitResult:{zone:HitZone;distance:number}={zone:'miss',distance:Infinity};
  enabled=true;scale=1;speedMultiplier=1;health=150;position=new Vector3();velocity=new Vector3();active=true;deadAt=-100;spawnAt=0;generation=0;shotsReceived=0;
  direction=1;nextChange=0;changeAt=-100;reactionRecorded=true;crouch=0;phase=0;
  constructor(public id:number,public behavior:Behavior,public rng:SeededRandom){
    this.root.add(this.upper,this.leftHip,this.rightHip);
    this.head=this.part('head',this.upper,0,1.68,0,0.34,0.34,0.34,'sphere');
    this.part('torso',this.upper,0,1.13,0,0.48,0.58,0.28);
    this.part('torso',this.upper,0,0.735,0,0.43,0.21,0.27);
    this.upper.add(this.leftArm,this.rightArm);this.leftArm.position.set(-0.34,1.36,0);this.rightArm.position.set(0.34,1.36,0);
    this.part('arm',this.leftArm,0,-0.2,0,0.17,0.4,0.18);this.part('arm',this.leftArm,0,-0.51,0.025,0.15,0.22,0.16);
    this.part('arm',this.rightArm,0,-0.2,0,0.17,0.4,0.18);this.part('arm',this.rightArm,0,-0.51,0.025,0.15,0.22,0.16);
    for(const [hip,knee,x] of [[this.leftHip,this.leftKnee,-0.13],[this.rightHip,this.rightKnee,0.13]] as const){
      hip.position.set(x,0.63,0);hip.add(knee);knee.position.y=-0.29;
      this.part('leg',hip,0,-0.145,0,0.18,0.29,0.2);this.part('leg',knee,0,-0.17,0.01,0.16,0.34,0.18);
    }
  }
  private part(zone:HitZone,parent:Object3D,x:number,y:number,z:number,w:number,h:number,d:number,shape:'sphere'|'box'='box'){
    const node=new Object3D();node.position.set(x,y,z);parent.add(node);const size=new Vector3(w,h,d);
    const p:HitPart={zone,node,shape,size,inverse:new Matrix4(),box:new Box3(new Vector3(-w/2,-h/2,-d/2),new Vector3(w/2,h/2,d/2)),sphere:new Sphere(new Vector3(),w/2)};
    this.parts.push(p);return p;
  }
  spawn(x:number,z:number,time:number){this.position.set(x,0,z);this.previous.copy(this.position);this.anchor.copy(this.position);this.active=true;this.spawnAt=time;this.generation++;this.shotsReceived=0;this.health=150;this.phase=this.rng.range(0,6.28);this.nextChange=time+this.rng.range(0.65,1.5);this.direction=this.rng.next()>0.5?1:-1;this.velocity.set(0,0,0);this.crouch=0;this.changeAt=this.behavior==='appearing'?time:-100;this.reactionRecorded=this.behavior!=='appearing';this.updatePose(time);}
  eliminate(time:number){this.active=false;this.deadAt=time;}
  step(time:number,dt:number){
    this.previous.copy(this.position);if(!this.active)return;
    let desired=0;
    if(this.behavior==='strafe')desired=this.direction*2.1;
    if(this.behavior==='random'||this.behavior==='crouch')desired=this.direction*2.3;
    if(this.behavior==='stopGo')desired=Math.sin((time-this.spawnAt)*2.3)>0.15?this.direction*2.4:0;
    if(this.behavior==='peek')desired=this.direction*1.8;
    if(this.behavior!=='stationary'&&(time>=this.nextChange||Math.abs(this.position.x-this.anchor.x)>2.4)){
      this.direction*=-1;this.nextChange=time+this.rng.range(0.65,1.8);this.changeAt=time;this.reactionRecorded=false;
    }
    desired*=this.speedMultiplier;
    this.velocity.x+=Math.sign(desired-this.velocity.x)*Math.min(Math.abs(desired-this.velocity.x),dt*12);
    this.position.x+=this.velocity.x*dt;
    const targetCrouch=this.behavior==='crouch'&&Math.sin(time*1.4+this.phase)>0.15?1:0;
    this.crouch+=Math.sign(targetCrouch-this.crouch)*Math.min(Math.abs(targetCrouch-this.crouch),dt*4);
    this.updatePose(time);
  }
  updatePose(time:number){
    this.root.position.copy(this.position);this.root.scale.setScalar(this.scale);this.root.rotation.y=0;
    const stride=Math.sin(time*9+this.phase)*Math.min(0.32,Math.abs(this.velocity.x)*0.13);
    this.upper.position.y=-0.43*this.crouch+Math.abs(stride)*0.025;this.upper.rotation.z=stride*0.04;
    this.leftHip.position.y=this.rightHip.position.y=0.63-0.2*this.crouch;
    this.leftHip.rotation.x=stride-0.7*this.crouch;this.rightHip.rotation.x=-stride-0.7*this.crouch;
    this.leftKnee.rotation.x=Math.max(0,-stride)+1.25*this.crouch;this.rightKnee.rotation.x=Math.max(0,stride)+1.25*this.crouch;
    this.leftArm.rotation.x=-stride*0.6;this.rightArm.rotation.x=stride*0.6;
    this.root.updateMatrixWorld(true);for(const p of this.parts)p.inverse.copy(p.node.matrixWorld).invert();
  }
  headPosition(out:Vector3){return out.setFromMatrixPosition(this.head.node.matrixWorld);}
  intersect(ray:Ray,out:Vector3):{zone:HitZone;distance:number}|null{
    if(!this.active)return null;let distance=Infinity;let zone:HitZone='miss';
    for(const p of this.parts){
      localRay.copy(ray).applyMatrix4(p.inverse);
      const hit=p.shape==='sphere'?localRay.intersectSphere(p.sphere,localHit):localRay.intersectBox(p.box,localHit);
      if(hit){worldHit.copy(localHit).applyMatrix4(p.node.matrixWorld);const d=ray.origin.distanceTo(worldHit);if(d<distance-1e-6||(Math.abs(d-distance)<1e-6&&p.zone==='head')){distance=d;zone=p.zone;out.copy(worldHit);}}
    }this.hitResult.zone=zone;this.hitResult.distance=distance;return Number.isFinite(distance)?this.hitResult:null;
  }
}

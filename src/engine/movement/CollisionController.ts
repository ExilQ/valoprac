import {Vector3} from 'three';
import {surfaceHeight,type Obstacle} from '../collision/environment';

const EPS=1e-8;
export interface GroundContact {
 height:number;normal:Vector3;obstacle:Obstacle|null;walkable:boolean;
}
export interface HorizontalCollisionOptions {
 radius:number;bodyHeight:number;grounded:boolean;stepHeight:number;maxSlopeCos:number;
}
/** A shared deterministic contact solver for the original static tactical geometry.
 * Collision never depends on the selected movement acceleration model or rendering.
 * The player footprint retains the existing axis-aligned radius convention. */
export class CollisionController {
 private contact:GroundContact={height:0,normal:new Vector3(0,1,0),obstacle:null,walkable:true};
 private normal=new Vector3();
 constructor(public obstacles:readonly Obstacle[]){}
 /** The exact outward normal of a ramp's authored top plane. */
 surfaceNormal(obstacle:Obstacle,out:Vector3=this.normal):Vector3{
  if(!obstacle.ramp)return out.set(0,1,0);
  const r=obstacle.ramp,span=obstacle.box.max[r.axis]-obstacle.box.min[r.axis];
  const slope=span>EPS?(r.high-r.low)*r.ascending/span:0;
  return out.set(r.axis==='x'?-slope:0,1,r.axis==='z'?-slope:0).normalize();
 }
 /** Returns a reused contact object unless an output object is supplied. A steep
  * physical surface is returned with walkable=false: callers must still stop at
  * its solid surface without treating it as a valid grounded landing. */
 support(position:Vector3,maxY:number,maxSlopeCos=Math.SQRT1_2,out:GroundContact=this.contact):GroundContact{
  out.height=0;out.normal.set(0,1,0);out.obstacle=null;out.walkable=true;
  const slopeLimit=Math.min(1,Math.max(0,maxSlopeCos));
  for(const obstacle of this.obstacles){
   const b=obstacle.box;
   if(position.x<b.min.x-EPS||position.x>b.max.x+EPS||position.z<b.min.z-EPS||position.z>b.max.z+EPS)continue;
   const height=surfaceHeight(obstacle,position.x,position.z);
   if(height>maxY+EPS||height<=out.height+EPS)continue;
   out.height=height;out.obstacle=obstacle;this.surfaceNormal(obstacle,out.normal);out.walkable=out.normal.y+EPS>=slopeLimit;
  }
  return out;
 }
 canStand(position:Vector3,crouchHeight:number,standingHeight:number,radius:number):boolean{
  for(const obstacle of this.obstacles){const b=obstacle.box;
   if(position.x+radius<=b.min.x||position.x-radius>=b.max.x||position.z+radius<=b.min.z||position.z-radius>=b.max.z)continue;
   if(position.y+crouchHeight<=b.min.y+EPS&&position.y+standingHeight>b.min.y+EPS)return false;
  }
  return true;
 }
 private clearAtHeight(position:Vector3,footHeight:number,bodyHeight:number,radius:number):boolean{
  for(const obstacle of this.obstacles){const b=obstacle.box;
   if(position.x+radius<=b.min.x||position.x-radius>=b.max.x||position.z+radius<=b.min.z||position.z-radius>=b.max.z)continue;
   const top=obstacle.ramp?surfaceHeight(obstacle,position.x,position.z):b.max.y;
   if(footHeight>=top-EPS||footHeight+bodyHeight<=b.min.y+EPS)continue;
   return false;
  }
  return true;
 }
 /** Practice restores use the same ramp-aware occupied volume as normal
  * traversal, rather than accepting an arbitrary saved coordinate. */
 canOccupy(position:Vector3,bodyHeight:number,radius:number):boolean{
  return[position.x,position.y,position.z,bodyHeight,radius].every(Number.isFinite)&&bodyHeight>0&&radius>0&&this.clearAtHeight(position,position.y,bodyHeight,radius);
 }
 private stepClear(position:Vector3,top:number,o:HorizontalCollisionOptions):boolean{
  // Adjacent ramp/platform volumes can overlap the footprint. Test headroom
  // above their combined reachable step, rather than treating the higher
  // landing as a wall inside the ramp's bounding box.
  let height=top;
  for(const obstacle of this.obstacles){const b=obstacle.box;
   if(position.x+o.radius<=b.min.x||position.x-o.radius>=b.max.x||position.z+o.radius<=b.min.z||position.z-o.radius>=b.max.z)continue;
   const candidate=obstacle.ramp?surfaceHeight(obstacle,position.x,position.z):b.max.y;
   if(candidate>height&&candidate<=position.y+o.stepHeight+EPS&&(!obstacle.ramp||this.surfaceNormal(obstacle).y+EPS>=o.maxSlopeCos))height=candidate;
  }
  return this.clearAtHeight(position,height,o.bodyHeight,o.radius);
 }
 /** Mutates collision-resolved displacement and velocity, retaining the velocity
  * tangent to a hit wall. Each axis also sweeps its entire substep, so even a thin
  * obstacle cannot be skipped by a high-speed classic-preset input. */
 moveHorizontal(position:Vector3,velocity:Vector3,dt:number,options:HorizontalCollisionOptions):number{
  if(!(dt>0)||!Number.isFinite(dt))return 0;
  const travel=Math.max(Math.abs(velocity.x),Math.abs(velocity.z))*dt;
  // Subdivision resolves ramps and adjacent corners; swept axes provide the
  // tunnelling guarantee even if an externally edited speed reaches this bound.
  const steps=Math.max(1,Math.min(512,Math.ceil(travel/Math.max(.01,options.radius*.5))));
  let blocked=0;
  for(let i=0;i<steps;i++){
   const oldX=position.x;position.x+=velocity.x*dt/steps;
   if(this.resolveAxis('x',oldX,position,velocity,options))blocked|=1;
   const oldZ=position.z;position.z+=velocity.z*dt/steps;
   if(this.resolveAxis('z',oldZ,position,velocity,options))blocked|=2;
  }
  return blocked;
 }
 private resolveAxis(axis:'x'|'z',old:number,position:Vector3,velocity:Vector3,o:HorizontalCollisionOptions):boolean{
  const other=axis==='x'?'z':'x',sign=Math.sign(position[axis]-old);let blocked=false;
  if(!sign)return false;
  for(const obstacle of this.obstacles){const b=obstacle.box;
   if(position[other]+o.radius<=b.min[other]||position[other]-o.radius>=b.max[other])continue;
   const walkable=!obstacle.ramp||this.surfaceNormal(obstacle).y+EPS>=o.maxSlopeCos;
   const r=obstacle.ramp;
   // For a non-walkable wedge the high side under the footprint is solid,
   // even before the centre crosses its thin lower edge.
   const top=r?surfaceHeight(obstacle,position.x+(!walkable&&r.axis==='x'?r.ascending*o.radius:0),position.z+(!walkable&&r.axis==='z'?r.ascending*o.radius:0)):b.max.y;
   if(position.y+o.bodyHeight<=b.min.y+EPS||position.y>=top-EPS)continue;
   // Step-up is available only while actually grounded. Airborne bodies may
   // cross a ramp only above its real surface, never 30 cm inside its wedge.
   if(walkable&&o.grounded&&top<=position.y+o.stepHeight+EPS&&this.stepClear(position,top,o))continue;
   const from=old+sign*o.radius,to=position[axis]+sign*o.radius;
   const crossing=sign>0?from<=b.min[axis]+EPS&&to>b.min[axis]:from>=b.max[axis]-EPS&&to<b.max[axis];
   const overlapping=position[axis]+o.radius>b.min[axis]&&position[axis]-o.radius<b.max[axis];
   if(!crossing&&!overlapping)continue;
   // Already outside and travelling away is not a collision. This also avoids
   // pushing a tangential slider back into a solid after its first axis resolves.
   if(sign>0&&old-o.radius>=b.max[axis]-EPS||sign<0&&old+o.radius<=b.min[axis]+EPS)continue;
   const alreadyInside=old+o.radius>b.min[axis]+EPS&&old-o.radius<b.max[axis]-EPS;
   position[axis]=alreadyInside?old:sign>0?b.min[axis]-o.radius:b.max[axis]+o.radius;velocity[axis]=0;blocked=true;
  }
  return blocked;
 }
 /** Clip only a crossed underside plane; approaching an already-overlapped wall
  * is handled by horizontal collision rather than an arbitrary vertical snap. */
 resolveCeiling(position:Vector3,velocity:Vector3,oldY:number,bodyHeight:number,radius:number):boolean{
  if(velocity.y<=0)return false;let collided=false;
  for(const obstacle of this.obstacles){const b=obstacle.box;
   if(position.x+radius<=b.min.x||position.x-radius>=b.max.x||position.z+radius<=b.min.z||position.z-radius>=b.max.z)continue;
   if(oldY+bodyHeight<=b.min.y+EPS&&position.y+bodyHeight>=b.min.y-EPS){position.y=b.min.y-bodyHeight;velocity.y=0;collided=true;}
  }
  return collided;
 }
}

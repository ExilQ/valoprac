import {Vector3} from 'three';
import {surfaceHeight,type Obstacle} from '../collision/environment';
import {CURRENT_SIMULATION_RULES,type SimulationRulesId} from '../simulation/rules';
import {staticBroadphaseFor} from '../collision/StaticBroadphase';

const EPS=1e-8;
export interface GroundContact {
 height:number;normal:Vector3;obstacle:Obstacle|null;walkable:boolean;
}
export interface HorizontalCollisionOptions {
 radius:number;bodyHeight:number;grounded:boolean;stepHeight:number;maxSlopeCos:number;minLandingWidth?:number;
}
/** A shared deterministic contact solver for the original static tactical geometry.
 * Collision never depends on the selected movement acceleration model or rendering.
 * The player footprint retains the existing axis-aligned radius convention. */
export class CollisionController {
 private contact:GroundContact={height:0,normal:new Vector3(0,1,0),obstacle:null,walkable:true};
 private normal=new Vector3();
 private rules:SimulationRulesId=CURRENT_SIMULATION_RULES;
 private candidates:number[]=[];
 private sample=new Vector3();
 setSimulationRules(rules:SimulationRulesId){this.rules=rules;}
 private nearby(minX:number,minY:number,minZ:number,maxX:number,maxY:number,maxZ:number):readonly number[]{
  const broadphase=staticBroadphaseFor(this.obstacles);
  if(broadphase)return broadphase.queryAabb(minX,minY,minZ,maxX,maxY,maxZ,this.candidates);
  this.candidates.length=this.obstacles.length;for(let i=0;i<this.obstacles.length;i++)this.candidates[i]=i;return this.candidates;
 }
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
  // The authored-order broadphase only restricts the X/Z footprint.
  // Exact ramp planes, height tolerances and tie ordering stay in the narrow phase.
  const indices=this.nearby(position.x-EPS,-Infinity,position.z-EPS,position.x+EPS,Infinity,position.z+EPS);
  for(const index of indices){
   const obstacle=this.obstacles[index],b=obstacle.box;
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
 private clearAtHeight(position:Vector3,footHeight:number,bodyHeight:number,radius:number,maxSlopeCos=Math.SQRT1_2):boolean{
  for(const obstacle of this.obstacles){const b=obstacle.box;
   if(position.x+radius<=b.min.x||position.x-radius>=b.max.x||position.z+radius<=b.min.z||position.z-radius>=b.max.z)continue;
   const r=obstacle.ramp,steep=this.rules!=='legacy-v2'&&r&&this.surfaceNormal(obstacle).y+EPS<maxSlopeCos;
   // The occupied volume must agree with the airborne sweep. A steep wedge's
   // high edge can enter the footprint even when its centre plane is below it.
   const top=r?surfaceHeight(obstacle,position.x+(steep&&r.axis==='x'?r.ascending*radius:0),position.z+(steep&&r.axis==='z'?r.ascending*radius:0)):b.max.y;
   if(footHeight>=top-EPS||footHeight+bodyHeight<=b.min.y+EPS)continue;
   return false;
  }
  return true;
 }
 /** Practice restores use the same ramp-aware occupied volume as normal
  * traversal, rather than accepting an arbitrary saved coordinate. */
 canOccupy(position:Vector3,bodyHeight:number,radius:number,maxSlopeCos=Math.SQRT1_2):boolean{
  return[position.x,position.y,position.z,bodyHeight,radius,maxSlopeCos].every(Number.isFinite)&&bodyHeight>0&&radius>0&&this.clearAtHeight(position,position.y,bodyHeight,radius,maxSlopeCos);
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
  return this.clearAtHeight(position,height,o.bodyHeight,o.radius,o.maxSlopeCos);
 }
 /** Mutates collision-resolved displacement and velocity, retaining wall tangents.
  * Historical rules keep independent axis sweeps; current rules sweep the entire
  * square path and update support between accepted stair rises. */
 moveHorizontal(position:Vector3,velocity:Vector3,dt:number,options:HorizontalCollisionOptions):number{
  return this.rules==='legacy-v2'?this.moveHorizontalLegacy(position,velocity,dt,options):this.moveHorizontalSwept(position,velocity,dt,options);
 }
 private moveHorizontalLegacy(position:Vector3,velocity:Vector3,dt:number,options:HorizontalCollisionOptions):number{
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

 /** Coplanar ramp/platform joins retain the ramp's centre-plane anchor
  * until the centre reaches the shared edge, avoiding a radius-sized stair. */
 private rampBridge(platform:Obstacle,position:Vector3,maxSlopeCos:number):Obstacle|null{
  if(platform.ramp)return null;
  const b=platform.box;
  for(const ramp of this.obstacles){if(!ramp.ramp||this.surfaceNormal(ramp).y+EPS<maxSlopeCos)continue;const r=ramp.box;
   if(position.x<r.min.x-EPS||position.x>r.max.x+EPS||position.z<r.min.z-EPS||position.z>r.max.z+EPS)continue;
   for(const axis of ['x','z'] as const){const other=axis==='x'?'z':'x';if(Math.min(r.max[other],b.max[other])-Math.max(r.min[other],b.min[other])<=EPS)continue;
    for(const edge of [r.min[axis],r.max[axis]]){if(Math.abs(edge-b.min[axis])>EPS&&Math.abs(edge-b.max[axis])>EPS)continue;
     const top=surfaceHeight(ramp,axis==='x'?edge:position.x,axis==='z'?edge:position.z);
     if(Math.abs(top-b.max.y)<=EPS)return ramp;
    }
   }
  }
  return null;
 }
 /** Square-footprint support uses actual horizontal overlap. Flat ledges can
  * support an overhanging body. Walkable ramp height remains the authored centre
  * plane; steep contacts use the high footprint edge to match their solid sweep. */
 supportFootprint(position:Vector3,maxY:number,radius:number,maxSlopeCos=Math.SQRT1_2,_minLandingWidth=.1,out:GroundContact=this.contact):GroundContact{
  out.height=0;out.normal.set(0,1,0);out.obstacle=null;out.walkable=true;
  const indices=this.nearby(position.x-radius,0,position.z-radius,position.x+radius,maxY+EPS,position.z+radius);
  for(const index of indices){const obstacle=this.obstacles[index],b=obstacle.box;
   if(position.x+radius<=b.min.x+EPS||position.x-radius>=b.max.x-EPS||position.z+radius<=b.min.z+EPS||position.z-radius>=b.max.z-EPS)continue;
   const walkable=!obstacle.ramp||this.surfaceNormal(obstacle).y+EPS>=maxSlopeCos;
   const r=obstacle.ramp,height=r?surfaceHeight(obstacle,position.x+(!walkable&&r.axis==='x'?r.ascending*radius:0),position.z+(!walkable&&r.axis==='z'?r.ascending*radius:0)):b.max.y;
   if(height>maxY+EPS||height<=out.height+EPS||this.rampBridge(obstacle,position,maxSlopeCos))continue;
   out.height=height;out.obstacle=obstacle;this.surfaceNormal(obstacle,out.normal);out.walkable=walkable;
  }
  return out;
 }
 /** A continuous rectangle sweep closes the diagonal holes left by independent
  * axis sweeps. Ramp solidity is clipped along the full crossed interval, so an
  * endpoint beyond the low end can never erase an earlier high wedge contact. */
 private sweepObstacle(position:Vector3,dx:number,dz:number,o:HorizontalCollisionOptions,obstacle:Obstacle):{time:number;nx:number;nz:number}|null{
  const b=obstacle.box;if(position.y+o.bodyHeight<=b.min.y+EPS)return null;
  let enter=0,leave=1,nx=0,nz=0;
  for(const axis of ['x','z'] as const){const delta=axis==='x'?dx:dz,low=b.min[axis]-o.radius,high=b.max[axis]+o.radius,value=position[axis];
   if(Math.abs(delta)<=EPS){if(value<=low+EPS||value>=high-EPS)return null;continue;}
   const near=(delta>0?low:high)-value,far=(delta>0?high:low)-value,t0=near/delta,t1=far/delta;
   if(t0>enter+EPS){enter=t0;nx=axis==='x'?-Math.sign(delta):0;nz=axis==='z'?-Math.sign(delta):0;}
   else if(t0>=-EPS&&Math.abs(t0-enter)<=EPS){if(axis==='x')nx=-Math.sign(delta);else nz=-Math.sign(delta);}
   leave=Math.min(leave,t1);if(enter>leave+EPS)return null;
  }
  if(leave<=EPS||enter>1+EPS)return null;
  enter=Math.max(0,enter);
  if(obstacle.ramp){const r=obstacle.ramp,walkable=this.surfaceNormal(obstacle).y+EPS>=o.maxSlopeCos,offset=walkable?0:r.ascending*o.radius;
   const at=(t:number)=>surfaceHeight(obstacle,position.x+dx*t+(r.axis==='x'?offset:0),position.z+dz*t+(r.axis==='z'?offset:0));
   const entryTop=at(enter),exitTop=at(leave);
   if(Math.max(entryTop,exitTop)<=position.y+EPS)return null;
   if(entryTop<=position.y+EPS){const span=b.max[r.axis]-b.min[r.axis],slope=span>EPS?(r.high-r.low)*r.ascending/span:0,delta=r.axis==='x'?dx:dz;
    if(slope*delta<=EPS)return null;
    const origin=r.ascending===1?r.low:r.high,axisAt=b.min[r.axis]+(position.y-origin)/slope;
    const crossing=(axisAt-position[r.axis]-offset)/delta;
    enter=Math.max(enter,crossing);nx=r.axis==='x'?-Math.sign(delta):0;nz=r.axis==='z'?-Math.sign(delta):0;
   }
  }else if(position.y>=b.max.y-EPS)return null;
  // A pre-existing overlap may move out of a wall. Choose the nearest exit face
  // only when motion heads further into it; never pull an escaping body back.
  if(nx===0&&nz===0){
   const distances=[position.x-(b.min.x-o.radius),b.max.x+o.radius-position.x,position.z-(b.min.z-o.radius),b.max.z+o.radius-position.z];
   const nearest=Math.min(...distances),side=distances.indexOf(nearest);
   nx=side===0?-1:side===1?1:0;nz=side===2?-1:side===3?1:0;
   if(dx*nx+dz*nz>=-EPS)return null;
  }
  if(dx*nx+dz*nz>=-EPS)return null;
  return{time:Math.min(1,Math.max(0,enter)),nx,nz};
 }
 private stepLanding(position:Vector3,dx:number,dz:number,time:number,obstacle:Obstacle,o:HorizontalCollisionOptions):number|null{
  if(!o.grounded||obstacle.ramp&&this.surfaceNormal(obstacle).y+EPS<o.maxSlopeCos)return null;
  const b=obstacle.box,minWidth=Math.max(0,Number.isFinite(o.minLandingWidth)?o.minLandingWidth!:.1);
  if(b.max.x-b.min.x+EPS<minWidth||b.max.z-b.min.z+EPS<minWidth)return null;
  // Headroom is checked at the first face and the reached centre. As with the
  // authored ramp support, a walkable wedge uses its centre-plane foot anchor.
  const x=position.x+dx,z=position.z+dz;
  this.sample.set(x,position.y,z);
  const top=obstacle.ramp?surfaceHeight(obstacle,x,z):b.max.y;
  if(top>position.y+o.stepHeight+EPS||top<position.y-EPS)return null;
  const check=(px:number,pz:number)=>{this.sample.set(px,position.y,pz);return this.stepClear(this.sample,top,o);};
  if(!check(position.x+dx*time,position.z+dz*time)||!check(x,z))return null;
  return this.rampBridge(obstacle,position,o.maxSlopeCos)?position.y:top;
 }
 private moveHorizontalSwept(position:Vector3,velocity:Vector3,dt:number,o:HorizontalCollisionOptions):number{
  if(!(dt>0)||!Number.isFinite(dt)||![velocity.x,velocity.z,o.radius,o.bodyHeight].every(Number.isFinite)||o.radius<=0||o.bodyHeight<=0)return 0;
  const travel=Math.max(Math.abs(velocity.x),Math.abs(velocity.z))*dt;
  const steps=Math.max(1,Math.min(512,Math.ceil(travel/Math.max(.01,o.radius*.5))));
  let blocked=0;
  for(let step=0;step<steps;step++){
   let dx=velocity.x*dt/steps,dz=velocity.z*dt/steps;
   for(let slide=0;slide<8&&Math.abs(dx)+Math.abs(dz)>EPS;slide++){
    let earliest=1,nx=0,nz=0,landingTime=Infinity,landing:number|null=null;
    const indices=this.nearby(Math.min(position.x,position.x+dx)-o.radius,position.y,Math.min(position.z,position.z+dz)-o.radius,Math.max(position.x,position.x+dx)+o.radius,position.y+o.bodyHeight+o.stepHeight,Math.max(position.z,position.z+dz)+o.radius);
    // Step checks use their own geometry loops and cannot invalidate candidates.
    for(const index of indices){const obstacle=this.obstacles[index],hit=this.sweepObstacle(position,dx,dz,o,obstacle);if(!hit||hit.time>earliest+EPS)continue;
     const top=this.stepLanding(position,dx,dz,hit.time,obstacle,o);
     if(top!==null){if(hit.time<landingTime-EPS){landingTime=hit.time;landing=top;}else if(Math.abs(hit.time-landingTime)<=EPS)landing=landing===null?top:Math.max(landing,top);continue;}
     if(hit.time<earliest-EPS){earliest=hit.time;nx=hit.nx;nz=hit.nz;}else{nx=nx||hit.nx;nz=nz||hit.nz;}
    }
    if(landing!==null&&landingTime<=earliest+EPS&&landing>position.y+EPS){
     // An accepted rise is a real pose update before the next sweep. Recheck
     // every obstacle at that height instead of reusing a stale lower contact.
     position.x+=dx*landingTime;position.z+=dz*landingTime;dx*=1-landingTime;dz*=1-landingTime;position.y=landing;continue;
    }
    position.x+=dx*earliest;position.z+=dz*earliest;
    if(nx===0&&nz===0)break;
    if(nx){velocity.x=0;blocked|=1;}if(nz){velocity.z=0;blocked|=2;}
    dx=nx?0:dx*(1-earliest);dz=nz?0:dz*(1-earliest);
   }
   if(o.grounded){const oldY=position.y,contact=this.supportFootprint(position,oldY+o.stepHeight,o.radius,o.maxSlopeCos);
    if(contact.walkable&&contact.height>=oldY-o.stepHeight-EPS&&contact.height<=oldY+o.stepHeight+EPS){
     this.sample.copy(position);if(this.clearAtHeight(this.sample,contact.height,o.bodyHeight,o.radius,o.maxSlopeCos))position.y=contact.height;
    }
   }
  }
  return blocked;
 }
 /** Sweeps the airborne body through XYZ together. Horizontal-then-vertical
  * endpoint checks alone can miss a thin elevated wall or ceiling in between. */
 moveAirborne(position:Vector3,velocity:Vector3,dt:number,verticalTravel:number,o:HorizontalCollisionOptions):void{
  if(!(dt>0)||![dt,verticalTravel,velocity.x,velocity.y,velocity.z,o.radius,o.bodyHeight].every(Number.isFinite)||o.radius<=0||o.bodyHeight<=0)return;
  let dx=velocity.x*dt,dy=verticalTravel,dz=velocity.z*dt;
  for(let iteration=0;iteration<12&&Math.abs(dx)+Math.abs(dy)+Math.abs(dz)>EPS;iteration++){
   let earliest=1,nx=0,ny=0,nz=0;
   if(dy<0&&position.y>=-EPS&&position.y+dy<=0){earliest=Math.max(0,-position.y/dy);ny=1;}
   const indices=this.nearby(Math.min(position.x,position.x+dx)-o.radius,Math.min(position.y,position.y+dy),Math.min(position.z,position.z+dz)-o.radius,Math.max(position.x,position.x+dx)+o.radius,Math.max(position.y,position.y+dy)+o.bodyHeight,Math.max(position.z,position.z+dz)+o.radius);
   for(const index of indices){const obstacle=this.obstacles[index],b=obstacle.box;
    let enter=0,leave=1,hx=0,hy=0,hz=0,valid=true;
    const clip=(px:number,py:number,pz:number,offset:number)=>{
     if(!valid)return;const distance=px*position.x+py*position.y+pz*position.z-offset,rate=px*dx+py*dy+pz*dz;
     if(Math.abs(rate)<=EPS){if(distance>=-EPS)valid=false;return;}
     const t=-distance/rate;
     if(rate<0){if(t>enter+EPS){enter=t;hx=px;hy=py;hz=pz;}else if(t>=-EPS&&Math.abs(t-enter)<=EPS){hx+=px;hy+=py;hz+=pz;}}
     else leave=Math.min(leave,t);
     if(enter>leave+EPS)valid=false;
    };
    clip(-1,0,0,-b.min.x+o.radius);clip(1,0,0,b.max.x+o.radius);
    clip(0,0,-1,-b.min.z+o.radius);clip(0,0,1,b.max.z+o.radius);
    clip(0,-1,0,-b.min.y+o.bodyHeight);clip(0,1,0,b.max.y);
    if(obstacle.ramp){const r=obstacle.ramp,span=b.max[r.axis]-b.min[r.axis],slope=span>EPS?(r.high-r.low)*r.ascending/span:0,intercept=(r.ascending===1?r.low:r.high)-slope*b.min[r.axis],steep=this.surfaceNormal(obstacle).y+EPS<o.maxSlopeCos;
     clip(r.axis==='x'?-slope:0,1,r.axis==='z'?-slope:0,intercept+(steep?Math.abs(slope)*o.radius:0));
    }
    if(!valid||leave<=EPS||enter< -EPS||enter>earliest+EPS||hx*dx+hy*dy+hz*dz>=-EPS)continue;
    if(enter<earliest-EPS){earliest=Math.max(0,enter);nx=hx;ny=hy;nz=hz;}else{nx+=hx;ny+=hy;nz+=hz;}
   }
   position.x+=dx*earliest;position.y+=dy*earliest;position.z+=dz*earliest;
   if(nx===0&&ny===0&&nz===0)break;
   dx*=1-earliest;dy*=1-earliest;dz*=1-earliest;
   const normalLength=nx*nx+ny*ny+nz*nz,into=dx*nx+dy*ny+dz*nz;
   if(into<0){dx-=nx*into/normalLength;dy-=ny*into/normalLength;dz-=nz*into/normalLength;}
   // Downward impact speed is consumed by Movement's shared landing event.
   // Walls and undersides clip real velocity immediately, retaining tangents.
   if(ny<=0){const speed=velocity.x*nx+velocity.y*ny+velocity.z*nz;if(speed<0){velocity.x-=nx*speed/normalLength;velocity.y-=ny*speed/normalLength;velocity.z-=nz*speed/normalLength;}}
  }
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

import {describe,expect,it} from 'vitest';
import {Box3,Ray,Vector3} from 'three';
import {StaticBroadphase,registerStaticObstacles,staticBroadphaseFor} from '../engine/collision/StaticBroadphase';
import {nearestEnvironmentHit,environmentOccluded,type Obstacle} from '../engine/collision/environment';
import {obstacleRayInterval,traceBallisticRay} from '../engine/collision/Ballistics';
import {obstaclesFor} from '../engine/tactical/map';
import {LEVEL_IDS,levelFor,standingSpace,visibleBetween} from '../engine/tactical/levels';
import {playerVisibilitySamples,type PlayerBody} from '../engine/tactical/DefenderAI';
import {WEAPONS} from '../config/weapons';
import {SeededRandom} from '../engine/simulation/random';
import * as reference from './fixtures/physics12-query-reference';

const maps=['range','tactical',...LEVEL_IDS,'complex','bunny','wallbang'];
const clone=(obstacles:Obstacle[])=>obstacles.map(o=>({...o,box:o.box.clone(),ramp:o.ramp?{...o.ramp}:undefined}));
function rays(obstacles:Obstacle[],seed=721){
 const rng=new SeededRandom(seed),bounds=new Box3();for(const o of obstacles)bounds.union(o.box);
 const result:Ray[]=[];for(let i=0;i<128;i++){const a=new Vector3(rng.range(bounds.min.x,bounds.max.x),rng.range(.15,4.2),rng.range(bounds.min.z,bounds.max.z)),b=new Vector3(rng.range(bounds.min.x,bounds.max.x),rng.range(.15,4.2),rng.range(bounds.min.z,bounds.max.z));result.push(new Ray(a,b.sub(a).normalize()));}
 // Starts inside, face grazing, nearly parallel, downward, and both ramp axes
 // are tested against every authored obstacle, not synthetic replacement maps.
 for(const o of obstacles){const b=o.box,c=b.getCenter(new Vector3());result.push(new Ray(c,new Vector3(0,0,-1)),new Ray(new Vector3(b.min.x-5e-8,c.y,b.max.z+1),new Vector3(1e-13,0,-1)),new Ray(new Vector3(c.x,b.max.y+1,c.z),new Vector3(0,-1,0)));}
 return result;
}

describe('Static broadphase exact query parity',()=>{
 for(const map of maps)it(`${map}: retains frozen hit points, clipping, materials, thickness and author order`,()=>{
  const obstacles=clone(obstaclesFor(map)),linear=clone(obstacles),index=registerStaticObstacles(obstacles),candidates:number[]=[],out=new Vector3(),expected=new Vector3();
  for(const ray of rays(obstacles)){
   out.set(987,654,321);expected.copy(out);
   const nearest=reference.nearestEnvironmentHit(ray,150,expected,linear);expect(nearestEnvironmentHit(ray,150,out,obstacles)).toBe(nearest);expect(out).toEqual(expected);expect(environmentOccluded(ray,150,obstacles)).toBe(nearest<150);
   const target={zone:'torso' as const,distance:100,point:ray.at(100,new Vector3())};
   expect(traceBallisticRay(ray,WEAPONS.rifleA,target,obstacles,150,'legacy-v2')).toEqual(reference.traceBallisticRay(ray,WEAPONS.rifleA,target,linear));
   // New material semantics use the same broadphase and exact narrow phase.
   expect(traceBallisticRay(ray,WEAPONS.operator,target,obstacles,150,'materials-v3')).toEqual(traceBallisticRay(ray,WEAPONS.operator,target,linear,150,'materials-v3'));
   index.queryRay(ray,150,candidates);expect(candidates).toEqual([...new Set(candidates)].sort((a,b)=>a-b));expect(candidates.length).toBeLessThanOrEqual(obstacles.length);
   for(let i=0;i<obstacles.length;i++){const hit=reference.obstacleRayInterval(ray,obstacles[i],i);expect(obstacleRayInterval(ray,obstacles[i],i,'legacy-v2')).toEqual(hit);if(hit&&hit.start<150-1e-7)expect(candidates).toContain(i);}
  }
 });
 it('preserves legacy material defaults for direct ballistic helper calls',()=>{
  const obstacle:Obstacle={box:new Box3(new Vector3(-1,0,-4),new Vector3(1,3,-3)),kind:'cover',color:0,surfaceId:'paintedMetal'},ray=new Ray(new Vector3(0,1,0),new Vector3(0,0,-1)),target={zone:'torso' as const,distance:10,point:{x:0,y:1,z:-10}};
  expect(obstacleRayInterval(ray,obstacle)).toEqual(reference.obstacleRayInterval(ray,obstacle));
  expect(traceBallisticRay(ray,WEAPONS.operator,target,[obstacle])).toEqual(reference.traceBallisticRay(ray,WEAPONS.operator,target,[obstacle]));
  expect(obstacleRayInterval(ray,obstacle,0,'materials-v3')?.material).toBe('paintedMetal');
  expect(obstacleRayInterval(ray,obstacle)?.material).toBe('thickWood');
 });
 it('keeps mutable arrays linear until registered and rejects stale length caches',()=>{
  const obstacle:Obstacle={box:new Box3(new Vector3(-1,0,-4),new Vector3(1,3,-3)),kind:'wall',color:0},obstacles=Array.from({length:20},()=>({...obstacle,box:obstacle.box.clone()})),ray=new Ray(new Vector3(0,1,0),new Vector3(0,0,-1)),out=new Vector3();
  expect(staticBroadphaseFor(obstacles)).toBeNull();expect(nearestEnvironmentHit(ray,20,out,obstacles)).toBe(3);
  for(const o of obstacles)o.box.translate(new Vector3(10,0,0));expect(nearestEnvironmentHit(ray,20,out,obstacles)).toBe(Infinity);
  registerStaticObstacles(obstacles);obstacles.push(obstacle);expect(staticBroadphaseFor(obstacles)).toBeNull();expect(nearestEnvironmentHit(ray,20,out,obstacles)).toBe(3);
 });
 it('returns conservative bounded AABB candidates and standing-space parity on all maps',()=>{
  for(const map of maps){const obstacles=clone(obstaclesFor(map)),linear=clone(obstacles),index=registerStaticObstacles(obstacles),candidates:number[]=[];const level=levelFor(map),points=level?[...level.route,...level.angles.map(a=>a.position)]:[{x:0,y:0,z:0}];
   for(const p of points){index.queryAabb(p.x-.4,p.y,p.z-.4,p.x+.4,p.y+1.85,p.z+.4,candidates);expect(candidates.length).toBeLessThanOrEqual(obstacles.length);for(let i=0;i<obstacles.length;i++){const b=obstacles[i].box;if(b.max.x>=p.x-.4&&b.min.x<=p.x+.4&&b.max.y>=p.y&&b.min.y<=p.y+1.85&&b.max.z>=p.z-.4&&b.min.z<=p.z+.4)expect(candidates).toContain(i);}expect(standingSpace(obstacles,p,.4)).toBe(standingSpace(linear,p,.4));}
  }
 });
 it('passes nonfinite/invalid geometry through to the reference narrow phase',()=>{
  const obstacles:Obstacle[]=Array.from({length:20},(_,i)=>({box:new Box3(new Vector3(i*3,0,-4),new Vector3(i*3+1,3,-3)),kind:'wall',color:0}));obstacles[3].box.min.x=NaN;obstacles[8].box.max.z=Infinity;obstacles[11].box.min.y=5;const linear=clone(obstacles),index=registerStaticObstacles(obstacles),out:number[]=[];
  expect(index.queryRay(new Ray(new Vector3(NaN,1,0),new Vector3(0,0,-1)),150,out)).toEqual(obstacles.map((_,i)=>i));
  expect(index.queryRay(new Ray(new Vector3(0,1,0),new Vector3(0,0,-1)),150,out)).toEqual(expect.arrayContaining([3,8,11]));
  for(const d of [new Vector3(0,0,-1),new Vector3(0,0,-2),new Vector3(0,0,0)]){const ray=new Ray(new Vector3(0,1,0),d),a=new Vector3(),b=new Vector3();expect(nearestEnvironmentHit(ray,150,a,obstacles)).toBe(reference.nearestEnvironmentHit(ray,150,b,linear));expect(a).toEqual(b);}
 });
 it('keeps boolean visibility exact at floor, ramp, box and range boundaries',()=>{
  const out=new Vector3();
  for(const map of ['range','tower','complex']){const obstacles=clone(obstaclesFor(map));
   for(const ray of rays(obstacles).filter((_,i)=>i<8||i>=128)){
    const hit=reference.nearestEnvironmentHit(ray,Infinity,out,obstacles);
    for(const max of [-1,0,1e-7,150,Infinity,NaN,...(Number.isFinite(hit)?[hit-1e-7,hit,hit+1e-7]:[])])expect(environmentOccluded(ray,max,obstacles)).toBe(reference.nearestEnvironmentHit(ray,max,out,obstacles)<max);
   }
  }
  const floorRay=new Ray(new Vector3(0,1.5,0),new Vector3(0,-1,0));for(const max of [1.5-1e-7,1.5,1.5+1e-7])expect(environmentOccluded(floorRay,max,[])).toBe(reference.nearestEnvironmentHit(floorRay,max,out,[])<max);
 });
 it('preserves visibleBetween degenerate and nonfinite endpoint behavior',()=>{
  const obstacles=clone(obstaclesFor('tower')),out=new Vector3(),a={x:0,y:1.6,z:2};
  for(const b of [a,{x:0,y:1.6,z:2+1e-8},{x:0,y:1.6,z:-10},{x:NaN,y:1.6,z:0},{x:0,y:NaN,z:0},{x:Infinity,y:1.6,z:0}]){
   const from=new Vector3(a.x,a.y,a.z),delta=new Vector3(b.x,b.y,b.z).sub(from),d=delta.length(),expected=d<1e-6||reference.nearestEnvironmentHit(new Ray(from,delta.multiplyScalar(1/d)),d-1e-5,out,obstacles)>=d-1e-5;
   expect(visibleBetween(obstacles,a,b)).toBe(expected);
  }
 });
 it('reuses perception sample storage with exact frozen yaw/crouch coordinates',()=>{
  const output=Array.from({length:9},()=>({x:0,y:0,z:0})),identities=[...output],rng=new SeededRandom(723);
  for(let i=0;i<300;i++){const p:PlayerBody={position:{x:rng.range(-50,50),y:rng.range(0,3),z:rng.range(-50,50)},velocity:{x:0,y:0,z:0},eyeHeight:rng.range(1,1.64),crouch:rng.range(0,1),grounded:true,yaw:rng.range(-Math.PI,Math.PI),pitch:0};expect(playerVisibilitySamples(p,output)).toBe(output);expect(output).toEqual(reference.playerVisibilitySamples(p));for(let j=0;j<9;j++)expect(output[j]).toBe(identities[j]);}
 });
});

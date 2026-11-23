import {describe,it,expect} from 'vitest';
import {Ray,Vector3,BufferGeometry,Material,Texture,Mesh} from 'three';
import {BUNNY_LEVEL,BUNNY_RETURN_ROUTE,BUNNY_STAIR_ROUTE,WALLBANG_LEVEL,WALLBANG_SAMPLES,WALLBANG_APPROACH_ROUTES} from '../engine/tactical/mechanics';
import {levelFor,standingSpace,visibleBetween} from '../engine/tactical/levels';
import {obstaclesFor} from '../engine/tactical/map';
import {Movement} from '../engine/movement/Movement';
import {emptyInput} from '../engine/types';
import {WEAPONS} from '../config/weapons';
import {traceBallisticRay} from '../engine/collision/Ballistics';
import {Target} from '../engine/targets/Target';
import {SeededRandom} from '../engine/simulation/random';
import {AngleTraining} from '../engine/tactical/AngleTraining';
import {DEFAULT_SETTINGS} from '../config/settings';
import {tacticalArchitecture} from '../engine/rendering/TacticalArchitecture';

const dt=1/120;
describe('Original mechanics training maps',()=>{
 it('routes both maps through the existing collision architecture',()=>{
  for(const level of[BUNNY_LEVEL,WALLBANG_LEVEL]){
   expect(levelFor(level.id)).toBe(level);expect(obstaclesFor(level.id)).toBe(level.obstacles);
   expect(standingSpace(level.obstacles,level.spawn)).toBe(true);
   expect(level.obstacles.every(o=>o.box.min.x<=o.box.max.x&&o.box.min.y<o.box.max.y&&o.box.min.z<=o.box.max.z&&!!o.material)).toBe(true);
  }
 });
 it('provides a connected unobstructed return circuit and grounded stair checkpoints',()=>{
  for(let i=0;i<BUNNY_RETURN_ROUTE.length;i++){
   const a=BUNNY_RETURN_ROUTE[i],b=BUNNY_RETURN_ROUTE[(i+1)%BUNNY_RETURN_ROUTE.length];
   for(let j=0;j<=80;j++)expect(standingSpace(BUNNY_LEVEL.obstacles,{x:a.x+(b.x-a.x)*j/80,y:0,z:a.z+(b.z-a.z)*j/80})).toBe(true);
  }
  for(const point of BUNNY_STAIR_ROUTE)expect(standingSpace(BUNNY_LEVEL.obstacles,point)).toBe(true);
  expect(BUNNY_LEVEL.angles).toHaveLength(0);
 });
 it('traverses the real entry ramp and staircase without teleporting height',()=>{
  const ramp=new Movement(undefined,BUNNY_LEVEL.obstacles);ramp.position.set(0,0,-6);
  for(let i=0;i<450;i++)ramp.step({...emptyInput(),forward:1,walk:true},0,dt,i*dt);
  expect(ramp.position.z).toBeLessThan(-14);expect(ramp.position.z).toBeGreaterThan(-20);expect(ramp.position.y).toBeCloseTo(.8);expect(ramp.grounded).toBe(true);
  const stairs=new Movement(undefined,BUNNY_LEVEL.obstacles);stairs.position.set(7.5,0,-4);
  for(let i=0;i<500;i++)stairs.step({...emptyInput(),forward:1,walk:true},0,dt,i*dt);
  expect(stairs.position.z).toBeLessThan(-14);expect(stairs.position.z).toBeGreaterThan(-22);expect(stairs.position.y).toBeCloseTo(1.2);expect(stairs.grounded).toBe(true);
 });
 it('makes the two-metre platform gap jumpable with manual timing and ordinary capped velocity',()=>{
  const move=new Movement(undefined,BUNNY_LEVEL.obstacles);move.position.set(0,.8,-17);
  for(let i=0;i<60;i++)move.step({...emptyInput(),forward:1},0,dt,i*dt);
  expect(move.position.z).toBeLessThan(-19);expect(move.position.z).toBeGreaterThan(-20);
  move.step({...emptyInput(),forward:1,jump:true,jumpPresses:1},0,dt,.5);
  expect(move.grounded).toBe(false);
  for(let i=1;i<=68;i++)move.step({...emptyInput(),forward:1},0,dt,.5+i*dt);
  expect(move.position.z).toBeLessThan(-22);expect(move.position.z).toBeGreaterThan(-26);expect(move.position.y).toBeCloseTo(.8);expect(move.grounded).toBe(true);
  expect(move.hopSnapshot().jumps).toBe(1);expect(move.speed).toBeLessThanOrEqual(5.5+1e-8);
 });
 it('uses physical low headroom and a jump-revealed parapet',()=>{
  const standing=new Movement(undefined,BUNNY_LEVEL.obstacles);standing.position.set(7.5,0,1);
  for(let i=0;i<180;i++)standing.step({...emptyInput(),forward:1},0,dt,i*dt);
  expect(standing.position.z).toBeGreaterThan(-.9);
  const crouched=new Movement(undefined,BUNNY_LEVEL.obstacles);crouched.position.set(7.5,0,1);
  for(let i=0;i<400;i++)crouched.step({...emptyInput(),forward:1,crouch:true},0,dt,i*dt);
  expect(crouched.position.z).toBeLessThan(-1.6);
  expect(visibleBetween(BUNNY_LEVEL.obstacles,{x:-8.5,y:1.64,z:-24},{x:-8.5,y:1.64,z:-30})).toBe(false);
  expect(visibleBetween(BUNNY_LEVEL.obstacles,{x:-8.5,y:2.3,z:-24},{x:-8.5,y:1.64,z:-30})).toBe(true);
 });
 it('spawns genuine hidden defenders that can be confirmed through side peeks',()=>{
  const targets=WALLBANG_LEVEL.angles.map((_,i)=>new Target(i,'stationary',new SeededRandom(91+i)));
  const trainer=new AngleTraining(WALLBANG_LEVEL,targets,new SeededRandom(19),{...DEFAULT_SETTINGS,practiceMap:'wallbang'});
  for(let repeat=0;repeat<30;repeat++)for(const target of targets){
   trainer.spawn(target,repeat);expect(target.active&&target.enabled).toBe(true);expect(standingSpace(WALLBANG_LEVEL.obstacles,target.position,.4)).toBe(true);
   const x=WALLBANG_SAMPLES[target.id].centerX,head={x:target.position.x,y:target.position.y+1.68,z:target.position.z};
   expect(visibleBetween(WALLBANG_LEVEL.obstacles,{x,y:1.64,z:2},head)).toBe(false);
   expect(visibleBetween(WALLBANG_LEVEL.obstacles,{x:x+3,y:1.64,z:-5},head)).toBe(true);
  }
 });
 it('physically walks every material bay approach through its doorway and around its sample',()=>{
  for(const route of WALLBANG_APPROACH_ROUTES){
   const move=new Movement(undefined,WALLBANG_LEVEL.obstacles);move.position.set(route[0].x,0,route[0].z);let time=0;
   for(const goal of route.slice(1)){
    let count=0;while(Math.hypot(goal.x-move.position.x,goal.z-move.position.z)>.055&&count++<1200){
     const dx=goal.x-move.position.x,dz=goal.z-move.position.z;move.step({...emptyInput(),forward:1,walk:true},Math.atan2(-dx,-dz),dt,time+=dt);
    }
    expect(count).toBeLessThan(1200);expect(Math.hypot(goal.x-move.position.x,goal.z-move.position.z)).toBeLessThan(.055);expect(move.position.y).toBe(0);
   }
  }
 });
 it('teaches distinct actual penetration outcomes while all samples block perception',()=>{
  const traces=WALLBANG_SAMPLES.map(sample=>{
   const origin=new Vector3(sample.centerX,1.68,2),ray=new Ray(origin,new Vector3(0,0,-1));
   return traceBallisticRay(ray,WEAPONS.rifleA,{zone:'head',distance:18,point:{x:sample.centerX,y:1.68,z:-16}},WALLBANG_LEVEL.obstacles);
  });
  expect(traces[0].zone).toBe('head');expect(traces[1].zone).toBe('head');expect(traces[2].zone).toBe('wall');
  expect(traces[0].damageScale).toBeGreaterThan(traces[1].damageScale);expect(traces[0].damageScale).toBeLessThan(1);
  expect(traces[2].stopReason).toBe('material');expect(traces[2].segments[0].material).toBe('reinforced');
 });
 it('adds original batched architecture with finite metre-scaled UVs and unchanged collision',()=>{
  for(const level of[BUNNY_LEVEL,WALLBANG_LEVEL]){
   const geometries:BufferGeometry[]=[],materials:Material[]=[],textures:Texture[]=[],before=level.obstacles.map(o=>[...o.box.min.toArray(),...o.box.max.toArray()]);
   try{
    const art=tacticalArchitecture(level.id,level.obstacles,g=>(geometries.push(g),g),m=>(materials.push(m),m),t=>(textures.push(t),t));
    expect(art.userData.mechanicLayout).toBeTruthy();expect(art.userData.collisionUnchanged).toBe(true);expect(art.children.length).toBeGreaterThan(4);expect(art.children.length).toBeLessThan(110);
    for(const mesh of art.children){if(!(mesh instanceof Mesh))continue;const positions=mesh.geometry.getAttribute('position'),uv=mesh.geometry.getAttribute('uv');expect(positions.count).toBeGreaterThan(0);expect(Array.from(positions.array).every(Number.isFinite)).toBe(true);expect(uv.count).toBe(positions.count);expect(Array.from(uv.array).every(Number.isFinite)).toBe(true);}
    expect(level.obstacles.map(o=>[...o.box.min.toArray(),...o.box.max.toArray()])).toEqual(before);
   }finally{geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());}
  }
 });
});

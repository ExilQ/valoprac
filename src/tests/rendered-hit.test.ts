import {afterEach,describe,expect,it,vi} from 'vitest';
import {Box3,Matrix4,Mesh,MeshBasicMaterial,Ray,Raycaster,Vector3} from 'three';
import {RenderedTargets} from '../engine/collision/RenderedTargets';
import {castOperatorShot,castShot,type HitResult} from '../engine/collision/shoot';
import type {Obstacle} from '../engine/collision/environment';
import {characterPartGeometry} from '../engine/rendering/CharacterGeometry';
import {Target} from '../engine/targets/Target';
import {SeededRandom} from '../engine/simulation/random';
import {FixedClock,FIXED_DT as dt} from '../engine/simulation/FixedClock';
import {Simulation} from '../engine/simulation/Simulation';
import {BrowserInput} from '../engine/input/Input';
import {DEFAULT_SETTINGS} from '../config/settings';
import {emptyInput} from '../engine/types';
import {PENETRATION_MATERIALS,PENETRATION_WEAPONS} from '../config/penetration';

const result=():HitResult=>({zone:'miss',target:null,point:new Vector3(),distance:150});
function target(id=0){const t=new Target(id,'stationary',new SeededRandom(7));t.spawn(0,-10,0);return t;}
function matrices(t:Target,dx=0,dz=0){return t.parts.map(p=>{const m=p.node.matrixWorld.clone().scale(p.size);m.elements[12]+=dx;m.elements[14]+=dz;return m;});}
function frame(history:RenderedTargets,t:Target,stamp:number,dx=0){return history.capture([t],[matrices(t,dx)],stamp,[new Vector3(t.position.x+dx,t.position.y,t.position.z)])!;}
function rayAtHead(matrix:Matrix4,x=-.125,y=.035){return new Ray(new Vector3(matrix.elements[12]+x,matrix.elements[13]+y,5),new Vector3(0,0,-1));}
/** Independent Three.Mesh raycasting uses the actual authored renderer geometry,
 * rather than another copy of the custom BVH or its historical sphere. */
function visibleHead(ray:Ray,matrix:Matrix4){
 const geometry=characterPartGeometry(0),material=new MeshBasicMaterial(),mesh=new Mesh(geometry,material),caster=new Raycaster();
 try{mesh.matrixAutoUpdate=false;mesh.matrix.copy(matrix);mesh.updateMatrixWorld(true);caster.ray.copy(ray);return caster.intersectObject(mesh).map(h=>h.distance);}
 finally{geometry.dispose();material.dispose();}
}
function simulation(){const s=new Simulation('free','rifleA',{...DEFAULT_SETTINGS,behavior:'stationary',targetCount:1,autoReload:false,analysisWall:false});s.running=true;s.yaw=Math.PI;
 s.weapon.profile={...s.weapon.profile,firstSpread:0,bloomPerShot:0,randomness:0,fireRate:10,adsFireRate:10,recoil:[[0,0]]};return s;}
function submit(s:Simulation,stamp:number){return s.renderedTargets.capture(s.targets,s.targets.map(t=>matrices(t)),stamp)!;}
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});

describe('Shot collision follows submitted target poses, independently of the next physics tick',()=>{
 for(const fps of[30,60,144,240])it(`5.4 m/s target at ${fps} render Hz needs no forward lead to hit the visible head edge`,()=>{
  const leads:number[]=[];
  for(const phase of[0,dt*.25,dt*.5,dt*.75,dt*.99]){
   const t=target(),history=new RenderedTargets(),clock=new FixedClock();t.behavior='strafe';t.direction=1;t.velocity.x=5.4;t.nextChange=100;let time=0,submitted=0;
   clock.advance(phase,step=>{time+=step;t.step(time,step);});
   for(let i=1;i<=Math.ceil(fps*.2);i++){
    const alpha=clock.advance(1/fps,step=>{time+=step;t.step(time,step);});
    const dx=t.previous.x+(t.position.x-t.previous.x)*alpha-t.position.x;
    frame(history,t,phase*1000+i*1000/fps,dx);submitted=phase*1000+i*1000/fps;
   }
   const shown=history.copyForShot(submitted+.1)!,shownHead=shown.targets[0]!.matrices[0],ray=rayAtHead(shownHead);
   const visible=visibleHead(ray,shownHead);expect(visible.length).toBeGreaterThan(0);
   t.step(time+dt,dt);leads.push(t.position.x-shown.targets[0]!.position.x);const advanced=castShot(ray,[t],result(),[]);
   expect(advanced.zone).toBe('miss');
   const hit=castShot(ray,[t],result(),[],shown);expect(hit.zone).toBe('head');expect(hit.distance).toBeCloseTo(visible[0],6);
   const empty=rayAtHead(shownHead,.18,.035);expect(visibleHead(empty,shownHead)).toHaveLength(0);expect(castShot(empty,[t],result(),[],shown).zone).toBe('miss');
  }
  console.info(JSON.stringify({benchmark:'rendered-target-alignment',renderHz:fps,physicsHz:120,speed:5.4,phaseCases:leads.length,oldLeadMetersMin:Math.min(...leads),oldLeadMetersMax:Math.max(...leads),oldLeadMetersMean:leads.reduce((a,b)=>a+b,0)/leads.length,visibleEdgeMisses:0,blankSpaceHits:0,reference:'Independent Three.Mesh.raycast; submitted CPU transforms, not physical scanout'}));
 });
 it('uses captured articulated crouch/yaw/scale transforms after the simulation has moved and stood up',()=>{
  const t=target(),history=new RenderedTargets();t.scale=1.4;t.crouch=1;t.updatePose(.3);t.root.rotation.y=.65;t.root.updateMatrixWorld(true);
  const shown=frame(history,t,100),shownHead=shown.targets[0]!.matrices[0],ray=rayAtHead(shownHead,-.07,.04),visible=visibleHead(ray,shownHead);expect(visible.length).toBeGreaterThan(0);
  t.crouch=0;t.position.x=2;t.updatePose(.4);
  expect(castShot(ray,[t],result(),[]).zone).toBe('miss');const hit=castShot(ray,[t],result(),[],shown);expect(hit.zone).toBe('head');expect(hit.distance).toBeCloseTo(visible[0],6);
 });
 it('keeps captured targets behind physical cover and applies Operator penetration to that same pose',()=>{
  const t=target(),history=new RenderedTargets(),shown=frame(history,t,100),ray=rayAtHead(shown.targets[0]!.matrices[0],0,0),thin:Obstacle={box:new Box3(new Vector3(-2,0,-5.2),new Vector3(2,3,-5)),kind:'cover',color:0};
  t.position.x=2;t.updatePose(1);
  expect(castShot(ray,[t],result(),[thin],shown).zone).toBe('wall');
  const through=castOperatorShot(ray,[t],result(),[thin],shown);expect(through.zone).toBe('head');expect(through.penetrationScale).toBeCloseTo(PENETRATION_MATERIALS.thickWood.retention*Math.exp(-.2*PENETRATION_MATERIALS.thickWood.resistance/PENETRATION_WEAPONS.high.power*PENETRATION_WEAPONS.high.loss));expect(through.penetratedLayers).toBe(1);
  const thick={...thin,box:thin.box.clone()};thick.box.min.z=-8;
  expect(castOperatorShot(ray,[t],result(),[thick],shown).zone).toBe('wall');
 });
 for(const invalid of['disabled','eliminated','new-generation','not-drawn'] as const)it(`does not award a hit to a ${invalid} target from an earlier frame`,()=>{
  const t=target(5),history=new RenderedTargets();if(invalid==='not-drawn')t.enabled=false;const shown=frame(history,t,100);const ray=new Ray(new Vector3(0,1.68,0),new Vector3(0,0,-1));
  if(invalid==='disabled')t.enabled=false;else if(invalid==='eliminated')t.eliminate(1);else if(invalid==='new-generation')t.spawn(0,-10,1);else t.enabled=true;
  expect(castShot(ray,[t],result(),[],shown).zone).toBe('miss');
 });
});

describe('Bounded presentation history and click admission',()=>{
 it('keeps only its fixed capacity and makes the selected click frame immune to ring reuse or source mutation',()=>{
  const t=target(),history=new RenderedTargets(2),source=matrices(t);history.capture([t],[source],10);const copy=history.copyForShot(10)!;
  source[0].elements[12]=99;t.position.x=1;t.updatePose(1);frame(history,t,20);t.position.x=2;t.updatePose(2);frame(history,t,30);
  expect(history.size).toBe(2);expect(history.at(10)).toBeUndefined();expect(history.forShot(10)?.targets).toEqual([]);expect(copy.targets[0]!.matrices[0].elements[12]).toBe(0);expect(copy.targets[0]!.position.x).toBe(0);
  expect(history.forShot(25)?.submittedAt).toBe(20);expect(history.forShot()?.submittedAt).toBe(30);expect(()=>frame(history,t,29)).toThrow('monotonic');
 });
 it('does not silently fall back to current physics after a renderer attaches or a reset clears its first visible pose',()=>{
  const t=target(),history=new RenderedTargets();expect(history.forShot()).toBeUndefined();history.attach();expect(history.forShot()?.targets).toEqual([]);frame(history,t,10);history.clear();expect(history.size).toBe(0);expect(history.forShot()?.targets).toEqual([]);
  expect(castShot(new Ray(new Vector3(0,1.68,0),new Vector3(0,0,-1)),[t],result(),[],history.forShot()).zone).toBe('miss');
 });
 it('honors the input event timestamp even if a newer frame is submitted before the firing tick',()=>{
  const s=simulation();submit(s,100);s.captureFireView(105);submit(s,110);s.step(dt,{...emptyInput(),fire:true,firePresses:1});
  expect(s.shots).toHaveLength(1);expect(s.shots[0].targetPoseSource).toBe('rendered-frame');expect(s.shots[0].renderedFrameTime).toBe(100);expect(s.shots[0].inputTime).toBe(105);
 });
 it('uses the latest submitted pose for continued automatic fire rather than rewinding the whole burst to the first click',()=>{
  const s=simulation();submit(s,100);s.captureFireView(105);s.step(dt,{...emptyInput(),fire:true,firePresses:1});submit(s,200);
  for(let i=0;i<13;i++)s.step(dt,{...emptyInput(),fire:true});
  expect(s.shots.length).toBeGreaterThanOrEqual(2);expect(s.shots[0].renderedFrameTime).toBe(100);expect(s.shots[1].renderedFrameTime).toBe(200);expect(s.shots[1].inputTime).toBeUndefined();
 });
 it('discards a press rejected during equip instead of applying that old click pose when automatic fire becomes available',()=>{
  const s=simulation();s.weapon.equipUntil=dt*2.5;submit(s,100);s.captureFireView(105);s.step(dt,{...emptyInput(),fire:true,firePresses:1});expect(s.shots).toHaveLength(0);submit(s,200);
  for(let i=0;i<4;i++)s.step(dt,{...emptyInput(),fire:true});
  expect(s.shots).toHaveLength(1);expect(s.shots[0].renderedFrameTime).toBe(200);expect(s.shots[0].inputTime).toBeUndefined();
 });
 it('retains deterministic current-pose shooting for engine-only simulation with no renderer',()=>{
  const s=simulation();s.step(dt,{...emptyInput(),fire:true,firePresses:1});expect(s.shots[0].targetPoseSource).toBe('simulation');expect(s.shots[0].renderedFrameTime).toBeUndefined();
 });
 it('passes a real DOM mouse timestamp through BrowserInput even without an aim observer',()=>{
  class DocumentMock extends EventTarget{pointerLockElement:unknown=null;hidden=false;exitPointerLock(){this.pointerLockElement=null;this.dispatchEvent(new Event('pointerlockchange'));}}
  const doc=new DocumentMock(),win=new EventTarget(),canvas=new EventTarget();vi.stubGlobal('document',doc);vi.stubGlobal('window',win);vi.spyOn(performance,'now').mockReturnValue(2000);
  const s=simulation();submit(s,1000);submit(s,1800);const input=new BrowserInput(canvas as HTMLCanvasElement,s,()=>{},()=>{});doc.pointerLockElement=canvas;
  try{const click=new Event('mousedown');Object.defineProperty(click,'button',{value:0});Object.defineProperty(click,'timeStamp',{value:1500});doc.dispatchEvent(click);s.step(dt,input.state);expect(s.shots[0].inputTime).toBe(1500);expect(s.shots[0].renderedFrameTime).toBe(1000);}
  finally{input.dispose();}
 });
});

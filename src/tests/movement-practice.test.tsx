import {describe,it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {Box3,Vector3} from 'three';
import {Movement} from '../engine/movement/Movement';
import {MOVEMENT,CS2_PHYSICS} from '../config/movement';
import {surfaceHeight} from '../engine/collision/environment';
import {obstaclesFor} from '../engine/tactical/map';
import {emptyInput,type InputState} from '../engine/types';
import {DEFAULT_SETTINGS,sanitizeSettings} from '../config/settings';
import {MovementPractice} from '../training/movementTools/MovementPractice';
import {defaultMovementTools,isMovementAction,movementActionForKey,sanitizeMovementTools,type MovementPracticeContext} from '../training/movementTools/types';
import {MovementPracticePanel} from '../ui/MovementPracticePanel';

const dt=1/120,bounds=[-12,-30,24,40];
const context=(m:Movement,n:number,map='range',mapBounds:readonly number[]=bounds):MovementPracticeContext=>({movement:m,map,bounds:mapBounds,yaw:.1,pitch:.05,time:n*dt,ticks:n});
function tick(m:Movement,p:MovementPractice,n:number,input:InputState){p.beforeStep(context(m,n-1));m.step(input,0,dt,n*dt);p.afterStep(context(m,n));}

describe('A3 validated position tools on the existing movement authority',()=>{
 it('saves and restores a real floor pose with orientation and velocity, without awarding jumps',()=>{
  const m=new Movement(),p=new MovementPractice();for(let n=1;n<=60;n++)tick(m,p,n,{...emptyInput(),forward:1});
  const c=context(m,60);expect(p.action({kind:'movement-save'},c).ok).toBe(true);const saved=m.position.clone(),v=m.velocity.clone(),jumps=m.jumpSerial;
  for(let n=61;n<=100;n++)tick(m,p,n,{...emptyInput(),strafe:1});
  const result=p.action({kind:'movement-restore'},context(m,100));expect(result).toMatchObject({ok:true,restored:{yaw:.1,pitch:.05}});expect(m.position.toArray()).toEqual(saved.toArray());expect(m.velocity.toArray()).toEqual(v.toArray());expect(m.jumpSerial).toBe(jumps);expect(p.snapshot().restores).toBe(1);
  const copy=p.snapshot();copy.savedPose!.position.x=999;expect(p.snapshot().savedPose!.position.x).not.toBe(999);
 });
 it('records actual takeoff, apex and landing, then returns to the pre-jump ground pose',()=>{
  const m=new Movement(),p=new MovementPractice();for(let n=1;n<=60;n++)tick(m,p,n,{...emptyInput(),forward:1});const takeoff=m.position.clone();
  tick(m,p,61,{...emptyInput(),forward:1,jump:true,jumpHeld:true});for(let n=62;n<=145;n++)tick(m,p,n,{...emptyInput(),forward:1});
  const s=p.snapshot();expect(s.last).not.toBeNull();expect(s.last!.peakHeight).toBeCloseTo(1.15,2);expect(s.last!.landing).not.toBeNull();expect(s.last!.distance).toBeGreaterThan(3);expect(s.last!.duration).toBeGreaterThan(.6);expect(s.last!.samples.length).toBeLessThanOrEqual(600);
  expect(p.action({kind:'movement-takeoff'},context(m,145)).ok).toBe(true);expect(m.position.toArray()).toEqual(takeoff.toArray());expect(m.grounded).toBe(true);expect(m.velocity.y).toBe(0);
 });
 it('resets the current physical attempt without overwriting the separately saved position',()=>{
  const m=new Movement(),p=new MovementPractice();for(let n=1;n<=60;n++)tick(m,p,n,{...emptyInput(),forward:1});
  expect(p.action({kind:'movement-save'},context(m,60)).ok).toBe(true);const saved=m.position.clone();
  for(let n=61;n<=120;n++)tick(m,p,n,{...emptyInput(),forward:1});const takeoff=m.position.clone();
  tick(m,p,121,{...emptyInput(),forward:1,jump:true,jumpHeld:true});for(let n=122;n<=205;n++)tick(m,p,n,{...emptyInput(),forward:1});
  expect(saved.distanceTo(takeoff)).toBeGreaterThan(2);expect(p.action({kind:'movement-reset'},context(m,205)).ok).toBe(true);expect(m.position.toArray()).toEqual(takeoff.toArray());
  expect(p.snapshot().savedPose!.position).toEqual({x:saved.x,y:saved.y,z:saved.z});expect(p.action({kind:'movement-restore'},context(m,205)).ok).toBe(true);expect(m.position.toArray()).toEqual(saved.toArray());
 });
 it('restores an airborne state and its original speed budget without a second jump',()=>{
  const m=new Movement();for(let n=1;n<=60;n++)m.step({...emptyInput(),forward:1},0,dt,n*dt);m.step({...emptyInput(),forward:1,jump:true,jumpHeld:true},0,dt,61*dt);
  for(let n=62;n<=72;n++)m.step({...emptyInput(),forward:1},0,dt,n*dt);const pose=m.capturePracticePose('range',0,0,72*dt),velocity=m.velocity.clone(),jumpCount=m.jumpSerial;
  for(let n=73;n<=82;n++)m.step(emptyInput(),0,dt,n*dt);expect(m.restorePracticePose(pose,'range',82*dt,bounds).ok).toBe(true);expect(m.grounded).toBe(false);expect(m.velocity.toArray()).toEqual(velocity.toArray());expect(m.physicsSnapshot().takeoff?.speedCap).toBe(pose.takeoff?.speedCap);
  m.step({...emptyInput(),jump:true,jumpHeld:true},0,dt,83*dt);expect(m.jumpSerial).toBe(jumpCount);
 });
 it('accepts real ramp support and crouched headroom while rejecting walls, unsupported feet and incompatible physics',()=>{
  const map=obstaclesFor('bunny'),ramp=map.find(o=>o.ramp)!,x=(ramp.box.min.x+ramp.box.max.x)/2,z=(ramp.box.min.z+ramp.box.max.z)/2,y=surfaceHeight(ramp,x,z),m=new Movement({...MOVEMENT},map);
  m.reset({x,y,z});const rampPose=m.capturePracticePose('bunny',0,0,1);expect(m.restorePracticePose(rampPose,'bunny',2,[-40,-80,80,120]).ok).toBe(true);
  const invalid=structuredClone(rampPose);invalid.position.y+=.5;expect(m.restorePracticePose(invalid,'bunny',2,[-40,-80,80,120]).ok).toBe(false);expect(m.restorePracticePose(rampPose,'range',2).ok).toBe(false);
  const cs=new Movement({...CS2_PHYSICS},map);expect(cs.restorePracticePose(rampPose,'bunny',2).ok).toBe(false);
  const ceiling={box:new Box3(new Vector3(-1,1.5,3),new Vector3(1,2,7)),kind:'wall' as const,color:0};const low=new Movement({...MOVEMENT},[ceiling]);low.crouch=1;
  const crouched=low.capturePracticePose('range',0,0,1);expect(low.restorePracticePose(crouched,'range',2,bounds).ok).toBe(true);crouched.crouch=0;expect(low.restorePracticePose(crouched,'range',2,bounds).ok).toBe(false);
  const wall=new Movement(),inside=wall.capturePracticePose('range',0,0,1);inside.position.x=-12.4;expect(wall.restorePracticePose(inside,'range',2,[-13,-31,26,42]).ok).toBe(false);
 });
 it('reports missing bookmarks and bounds traces after prolonged airborne movement',()=>{
  const m=new Movement(),p=new MovementPractice();expect(p.action({kind:'movement-restore'},context(m,0)).ok).toBe(false);expect(p.action({kind:'movement-takeoff'},context(m,0)).ok).toBe(false);
  p.beforeStep(context(m,0));m.grounded=false;m.position.y=100;p.afterStep(context(m,1));
  for(let n=2;n<=2500;n++){p.beforeStep(context(m,n-1));m.position.x+=.0001;p.afterStep(context(m,n));}
  const last=p.snapshot().last;expect(last).not.toBeNull();expect(last!.samples.length).toBeLessThanOrEqual(600);expect(last!.truncated).toBe(true);
 });
});

describe('A3 opt-in settings and accessible paused controls',()=>{
 it('keeps disabled defaults independent and assigns only conflict-free letter bindings',()=>{
  const a=sanitizeSettings(null),b=sanitizeSettings(null);expect(a.movementTools.enabled).toBe(false);a.movementTools.bindings.save='KeyZ';expect(b.movementTools.bindings.save).toBe('KeyK');expect(DEFAULT_SETTINGS.movementTools.bindings.save).toBe('KeyK');
  const occupied=[...Object.values(DEFAULT_SETTINGS.bindings),DEFAULT_SETTINGS.operatorZoomBinding,'KeyK'];const t=sanitizeMovementTools({enabled:true,bindings:{save:'KeyK',restore:'KeyK',takeoff:'Escape',reset:'Digit1'}},occupied);
  expect(new Set(Object.values(t.bindings)).size).toBe(4);expect(Object.values(t.bindings).some(k=>occupied.includes(k))).toBe(false);expect(sanitizeMovementTools({enabled:true},Array.from('ABCDEFGHIJKLMNOPQRSTUVWXYZ',c=>'Key'+c)).enabled).toBe(false);
 });
 it('matches only the explicit action union and enabled, unreserved key presses',()=>{
  const s=sanitizeSettings({...DEFAULT_SETTINGS,movementTools:{...defaultMovementTools(),enabled:true}});expect(movementActionForKey(s,'KeyK')).toEqual({kind:'movement-save'});expect(movementActionForKey({...s,movementTools:defaultMovementTools()},'KeyK')).toBeNull();expect(movementActionForKey(s,s.bindings.forward)).toBeNull();
  expect(isMovementAction({kind:'movement-save'})).toBe(true);expect(isMovementAction({kind:'movement-save',x:4})).toBe(false);expect(isMovementAction({kind:'eval'})).toBe(false);
 });
 it('renders readable missing-state controls and real attempt metrics without invented data',()=>{
  const settings=sanitizeSettings({...DEFAULT_SETTINGS,movementTools:{...defaultMovementTools(),enabled:true}}),m=new Movement(),p=new MovementPractice();for(let n=1;n<=120;n++)tick(m,p,n,{...emptyInput(),jump:n===1,jumpHeld:n===1,forward:1});
  const html=renderToStaticMarkup(<MovementPracticePanel settings={settings} snapshot={p.snapshot()} onAction={()=>{}} onSettings={()=>{}} onBuildGhost={()=>{}}/>);
  expect(html).toContain('이동 연습 도구');expect(html).toContain('최고 높이');expect(html).toContain('이동 시도의 시간별 수평 속도');expect(html).toContain('최근 시도 고스트 만들기');expect(html).not.toContain('NaN');
 });
});

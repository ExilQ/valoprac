import {describe,expect,it} from 'vitest';
import * as T from 'three';
import {createKnifeView,KNIFE_CONTACT_PHASE,KNIFE_GRIPS,KNIFE_GRIP_POSES,KNIFE_SWING_SECONDS,nextKnifeCombo,type KnifeAttackPose} from '../engine/rendering/KnifeView';
import {VIEWMODEL_HFOV,poseViewmodel} from '../engine/rendering/viewmodel';
import {KNIFE_ATTACKS} from '../config/weapons';
import type {KnifeSkinId} from '../engine/types';

const SKINS=Object.keys(KNIFE_GRIPS) as KnifeSkinId[];
const knife=createKnifeView(g=>g,m=>m);
const camera=(aspect:number)=>{const c=new T.PerspectiveCamera(55,aspect,.03,4);c.fov=2*Math.atan(Math.tan(VIEWMODEL_HFOV*Math.PI/360)/aspect)*180/Math.PI;c.updateProjectionMatrix();return c;};
const wide=camera(16/9);
/** Blade tip in normalized device coordinates for a skin and pose. */
const tip=(skin:KnifeSkinId,attack:KnifeAttackPose|null,draw=0,cam=wide)=>{knife.setSkin(skin);poseViewmodel('knife',0,0,0,0,1,0,0,0,knife.root);knife.animate(1,0,attack,draw);return knife.tip(new T.Vector3()).project(cam);};

describe('12.33 knife grips',()=>{
 it('holds each design in the grip that suits it',()=>{
  expect(KNIFE_GRIPS).toEqual({field:'forward',tanto:'saber',karambit:'ring',kunai:'reverse',aether:'forward',obsidian:'forward'});
  for(const skin of SKINS){knife.setSkin(skin);expect(knife.grip).toBe(KNIFE_GRIPS[skin]);}
 });
 it('puts the index finger through the karambit ring and the blade out of the little-finger side in reverse grips',()=>{
  knife.setSkin('karambit');knife.animate(1,0,null);
  const hand=knife.root.getObjectByName('knife hand')!,mount=knife.root.getObjectByName('knife grip mount')!;
  // Ring centre (knife-local z .107) in the hand frame, against the index finger capsule through it.
  const ring=new T.Vector3(0,-.002,.107).applyQuaternion(mount.quaternion).add(mount.position);
  const finger=hand.children.find(o=>o.visible&&(o as T.Mesh).geometry instanceof T.CapsuleGeometry&&Math.abs(o.position.z-ring.z)<.01)!;
  expect(finger).toBeDefined();expect(Math.hypot(finger.position.y-ring.y,finger.position.z-ring.z)).toBeLessThan(.019-.0048);
  for(const skin of ['karambit','kunai'] as const){const g=KNIFE_GRIP_POSES[KNIFE_GRIPS[skin]];expect(g.mount.flip).toBe(true);expect(g.mount.p[2]).toBeGreaterThan(.066);}
 });
});

describe('12.33 aiming the knife',()=>{
 for(const aspect of [4/3,16/9,21/9])it(`keeps the blade on screen and clear of the crosshair at rest (${aspect.toFixed(2)})`,()=>{
  for(const skin of SKINS){const p=tip(skin,null,0,camera(aspect));expect(Math.abs(p.x),skin).toBeLessThan(1);expect(Math.abs(p.y),skin).toBeLessThan(1);expect(Math.hypot(p.x,p.y/aspect),skin).toBeGreaterThan(.2);/* half screen widths */}
 });
 it('brings the tip onto the crosshair at the contact frame of every slash and stab',()=>{
  for(const skin of SKINS){
   for(const combo of [0,1,2]){const p=tip(skin,{kind:'slash',phase:KNIFE_CONTACT_PHASE.slash,combo});expect(Math.hypot(p.x,p.y),`${skin} slash ${combo}`).toBeLessThan(.005);}
   const p=tip(skin,{kind:'stab',phase:KNIFE_CONTACT_PHASE.stab});expect(Math.hypot(p.x,p.y),`${skin} stab`).toBeLessThan(.005);
  }
  // The hit is resolved on the press tick: contact comes within 50 ms (slash) / 80 ms (stab).
  expect(KNIFE_CONTACT_PHASE.slash*KNIFE_SWING_SECONDS.slash).toBeLessThan(.05);expect(KNIFE_CONTACT_PHASE.stab*KNIFE_SWING_SECONDS.stab).toBeLessThan(.08);
  // Each swing finishes before the next attack is allowed.
  expect(KNIFE_SWING_SECONDS.slash).toBeLessThanOrEqual(KNIFE_ATTACKS.slash.recovery);expect(KNIFE_SWING_SECONDS.stab).toBeLessThanOrEqual(KNIFE_ATTACKS.stab.recovery);
 });
 it('sweeps every slash from right to left through the crosshair, in three directions',()=>{
  for(const skin of SKINS)for(const combo of [0,1,2]){
   const before=tip(skin,{kind:'slash',phase:0,combo}),after=tip(skin,{kind:'slash',phase:.3,combo});
   expect(before.x,`${skin} ${combo}`).toBeGreaterThan(.15);expect(after.x,`${skin} ${combo}`).toBeLessThan(-.15);
  }
  const slope=(skin:KnifeSkinId,combo:number)=>{const a=tip(skin,{kind:'slash',phase:0,combo}),b=tip(skin,{kind:'slash',phase:.3,combo});return (b.y-a.y)/(a.x-b.x);};
  // Forward grips: down-left, rising, flat. Reverse grips: flat, down-left, rising.
  expect(slope('field',0)).toBeLessThan(-.5);expect(slope('field',1)).toBeGreaterThan(.5);expect(Math.abs(slope('field',2))).toBeLessThan(.25);
  expect(Math.abs(slope('kunai',0))).toBeLessThan(.25);expect(slope('kunai',1)).toBeLessThan(-.5);expect(slope('kunai',2)).toBeGreaterThan(.5);
 });
 it('drives the stab point deeper along the line of sight, then returns exactly to rest',()=>{
  for(const skin of SKINS){
   knife.setSkin(skin);knife.animate(1,0,null);const rest=knife.tip(new T.Vector3());
   knife.animate(1,0,{kind:'stab',phase:KNIFE_CONTACT_PHASE.stab});const contact=knife.tip(new T.Vector3());// Thrusts (forward grips) drive the point well forward; the reverse-grip overhand drive mostly travels down onto the crosshair.
   expect(contact.z,skin).toBeLessThan(rest.z-(['forward','saber'].includes(KNIFE_GRIPS[skin])?.04:.01));
   for(const kind of ['slash','stab'] as const){knife.animate(1,0,{kind,phase:1,combo:2});expect(knife.tip(new T.Vector3()).distanceTo(rest),`${skin} ${kind}`).toBeLessThan(1e-9);}
  }
 });
 it('draws the knife up from below the screen into the rest pose',()=>{
  for(const skin of ['field','tanto','aether','obsidian'] as const){const p=tip(skin,null,1);expect(p.y,skin).toBeLessThan(-.85);}
  for(const skin of SKINS){knife.setSkin(skin);knife.animate(1,0,null,0);const a=knife.tip(new T.Vector3());knife.animate(1,0,null);expect(knife.tip(new T.Vector3()).distanceTo(a)).toBe(0);}
 });
 it('cycles slashes 1-2-3 and restarts after a pause or a stab',()=>{
  let last:{kind:'slash'|'stab';start:number;combo:number}|null=null;const seq:number[]=[];
  for(const [kind,start] of [['slash',0],['slash',.5],['slash',1],['slash',1.5],['slash',3],['stab',3.5],['slash',4.5],['slash',5]] as const){const combo=nextKnifeCombo(last,kind,start);seq.push(combo);last={kind,start,combo};}
  expect(seq).toEqual([0,1,2,0,0,0,0,1]);
 });
});

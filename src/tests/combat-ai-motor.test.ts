import {describe,it,expect,vi} from 'vitest';
import {Box3,Ray,Vector3} from 'three';
import {DEFAULT_SETTINGS} from '../config/settings';
import {WEAPONS} from '../config/weapons';
import {FixedClock} from '../engine/simulation/FixedClock';
import {SeededRandom} from '../engine/simulation/random';
import {BotAimMotor,resolveBotProfile,wrapAngle} from '../engine/tactical/BotAimMotor';
import {DefenderAI,intersectPlayerBody,type PlayerBody,type DefenderSector} from '../engine/tactical/DefenderAI';
import {spreadDirection} from '../engine/weapons/trajectory';
import {Target} from '../engine/targets/Target';
import type {Obstacle} from '../engine/collision/environment';
import type {Settings,WeaponId} from '../engine/types';

const dt=1/120;
const body=(x=0,vx=0):PlayerBody=>({position:{x,y:0,z:0},velocity:{x:vx,y:0,z:0},eyeHeight:1.64,crouch:0,grounded:true,yaw:0,pitch:0});
function fixture(weapon:WeaponId='rifleA',settings:Partial<Settings>={},seed=1974,sectors:DefenderSector[]=[{facingYaw:0}]){
 const target=new Target(0,'stationary',new SeededRandom(seed));target.spawn(0,-20,0);
 const obstacles:Obstacle[]=[];const ai=new DefenderAI([target],obstacles,{...DEFAULT_SETTINGS,defenderWeapon:weapon,defenderReposition:0,exposureEnabled:false,...settings},{x:0,y:0,z:0},seed,sectors);
 return{target,obstacles,ai};
}
function advance(ai:DefenderAI,seconds:number,start=0,p=(time:number)=>body()){
 for(let i=0;i<Math.round(seconds/dt);i++){const time=start+i*dt;ai.step(dt,time,p(time));}
}
const barrier=(material:Obstacle['material']='concrete'):Obstacle=>({box:new Box3(new Vector3(-10,0,-10.1),new Vector3(10,4,-9.9)),kind:'wall',color:0,material});

describe('continuous bot motor',()=>{
 it('bounds angular speed and acceleration through reversals and never snaps to a head',()=>{
  const p=resolveBotProfile(DEFAULT_SETTINGS,'rifleA'),m=new BotAimMotor(0,new SeededRandom(31));m.begin(0,p);
  for(let i=0;i<1200;i++){const goal=i<400?1.4:i<800?-1.3:.8,before=m.yaw;m.step(dt,i*dt,goal,.25,p,i/200);expect(Math.abs(wrapAngle(m.yaw-before))).toBeLessThanOrEqual(p.maxSpeed*dt+1e-9);expect(m.angularSpeed).toBeLessThanOrEqual(p.maxSpeed+1e-9);expect(m.angularAcceleration).toBeLessThanOrEqual(p.maxAcceleration+1e-9);if(i===0)expect(m.yaw).toBeLessThan(.01);}
  expect(m.peakSpeed).toBeGreaterThan(1);expect(m.peakAcceleration).toBeGreaterThan(5);
 });
 it('has bounded delayed imperfect compensation instead of clearing true recoil',()=>{
  const p=resolveBotProfile(DEFAULT_SETTINGS,'rifleA'),m=new BotAimMotor(0,new SeededRandom(3));m.compensate(dt,5,2,p);expect(Math.hypot(m.compensationPitch,m.compensationYaw)).toBeLessThanOrEqual(p.compensationSpeed*dt+1e-9);
  for(let i=0;i<200;i++)m.compensate(dt,5,2,p);
  expect(m.compensationPitch*180/Math.PI).toBeCloseTo(-5*p.compensationGain);expect(Math.abs(m.compensationPitch*180/Math.PI)).toBeLessThan(5);
 });
 it('orders four provisional skills without granting an instant expert reaction',()=>{
  const profiles=(['beginner','normal','advanced','expert'] as const).map(defenderSkill=>resolveBotProfile({...DEFAULT_SETTINGS,defenderSkill},'rifleA'));
  expect(profiles.map(p=>p.reaction)).toEqual([...profiles.map(p=>p.reaction)].sort((a,b)=>b-a));
  expect(profiles[3].reaction).toBeGreaterThan(.25);expect(profiles[3].compensationGain).toBeLessThan(1);expect(profiles[0].initialError).toBeGreaterThan(profiles[3].initialError);
 });
});

describe('combat controller and shared physical weapon simulation',()=>{
 it('processes detection, recognition, reaction, motor acquisition and trigger separately',()=>{
  const {ai}=fixture();ai.health=1e6;const phases=new Set<string>();
  for(let i=0;i<180;i++){ai.step(dt,i*dt,body());phases.add(ai.memories[0].perceptionPhase);if(i<45)expect(ai.shots).toHaveLength(0);}
  expect([...phases]).toEqual(expect.arrayContaining(['detected','recognized','reacting','aiming','tracking']));
  const s=ai.shots[0];expect(s).toBeDefined();expect(s.time).toBeGreaterThan(.55);expect(s.reactionTime).toBeGreaterThan(.3);expect(s.aimAcquisitionTime).toBeGreaterThanOrEqual(.15);expect(s.time).toBeGreaterThan(ai.memories[0].acquisitionUntil);
 });
 it('retains a fresh-contact firing floor even with manually minimized expert reaction',()=>{
  const {ai}=fixture('rifleA',{defenderSkill:'expert',defenderReaction:.15,defenderFirstShotError:.05});ai.health=1e6;advance(ai,1);expect(ai.shots.length).toBeGreaterThan(0);expect(ai.shots[0].time).toBeGreaterThanOrEqual(.45);
 });
 it.each(['rifleA','rifleB','sheriff','operator'] as const)('%s rays contain real spread, recoil, magazine and mechanical cadence',weapon=>{
  const {ai}=fixture(weapon);ai.health=1e6;advance(ai,8);
  const shots=ai.shots;expect(shots.length).toBeGreaterThan(2);
  for(let i=0;i<shots.length;i++){const s=shots[i];expect(s.spread).toBeDefined();expect(s.recoilAfter!.pitch).toBeGreaterThan(s.recoilBefore!.pitch);expect(s.ammoBefore).toBeGreaterThan(0);expect(s.recoilAfter!.pitch).toBeGreaterThan(0);expect(s.direction).toBeDefined();if(i)expect(s.time-shots[i-1].time).toBeGreaterThanOrEqual(1/WEAPONS[weapon].fireRate-1e-9);}
  expect(ai.memories[0].gun.ammo).toBe(shots.at(-1)!.ammoBefore!-1);
  if(weapon==='operator')expect(shots.every(s=>s.spread!.base===.02)).toBe(true);
 });
 it('uses actual pre-shot recoil and measured motor compensation in every trajectory',()=>{
  const {ai}=fixture('rifleA');ai.health=1e6;advance(ai,3);const shots=ai.shots;expect(shots.some(s=>s.recoilBefore!.pitch>.2)).toBe(true);
  // Reconstruct each ray from its own control state, avoiding any statistical hit roll.
  const reconstructed=new Vector3();for(const s of shots){const m=s.direction!,length=Math.hypot(m.x,m.y,m.z);expect(length).toBeCloseTo(1,10);expect(s.recoilAfter!.pitch-s.recoilBefore!.pitch).toBeGreaterThan(.1);}
  const m=ai.memories[0],spy=vi.spyOn(m.gun,'calculateSpread');advance(ai,1,3);expect(spy).toHaveBeenCalled();expect(spy.mock.calls.every(call=>call[0]===m.movement)).toBe(true);
  // Final simulated motor+recoil ray matches the shared basis and preserves residual kick.
  const raw=m.motor.direction(new Vector3(),m.gun.recoil.pitch,m.gun.recoil.yaw);spreadDirection(m.motor.yaw+m.motor.compensationYaw+m.gun.recoil.yaw*Math.PI/180,m.motor.pitch+m.motor.compensationPitch+m.gun.recoil.pitch*Math.PI/180,0,0,reconstructed);expect(raw.distanceTo(reconstructed)).toBeLessThan(1e-9);
 });
 it('actually reloads an empty magazine and cannot fire during the reload interval',()=>{
  const {ai}=fixture('sheriff');ai.health=1e6;advance(ai,14);const shots=ai.shots;expect(shots.length).toBeGreaterThan(6);
  const empty=shots.findIndex(s=>s.ammoBefore===1);expect(empty).toBeGreaterThanOrEqual(0);expect(shots[empty+1].ammoBefore).toBe(6);expect(shots[empty+1].time-shots[empty].time).toBeGreaterThanOrEqual(WEAPONS.sheriff.reloadTime);expect(ai.memories[0].gun.magazineShot).toBeLessThanOrEqual(6);
 });
 it('uses tap, short burst and close spray decisions with recoil recovery pauses',()=>{
  const close=fixture('rifleA'),deep=fixture('rifleA');close.target.spawn(0,-6,0);deep.target.spawn(0,-40,0);close.ai.retry();deep.ai.retry();close.ai.health=deep.ai.health=1e6;advance(close.ai,7);advance(deep.ai,7);
  expect(Math.max(...close.ai.shots.map(s=>s.burstIndex!))).toBeGreaterThanOrEqual(6);expect(deep.ai.shots.every(s=>s.burstIndex===1)).toBe(true);
  const gaps=close.ai.shots.slice(1).map((s,i)=>s.time-close.ai.shots[i].time);expect(gaps.some(g=>g>.4)).toBe(true);expect(gaps.some(g=>g<.15)).toBe(true);expect(Math.max(...close.ai.shots.map(s=>s.recoilBefore!.pitch))).toBeGreaterThan(2);
 });
 it('preserves last visible or heard positions and never follows hidden movement',()=>{
  const {ai,obstacles}=fixture();ai.health=1e6;advance(ai,.8);const before={...ai.memories[0].known!},oldAim={...ai.memories[0].aim!};obstacles.push(barrier());advance(ai,.7,.8,()=>body(6));const m=ai.memories[0];expect(m.visible).toBe(0);expect(m.known).toEqual(before);expect(m.aim).toEqual(oldAim);expect(Math.hypot(m.uncertainty.x,m.uncertainty.y,m.uncertainty.z)).toBeGreaterThan(0);expect(m.observations.at(-1)!.position.x).toBe(0);expect(ai.shots.every(s=>s.time<.8)).toBe(true);
  advance(ai,1,.8+.7,()=>body(-7));expect(m.known).toBeNull();expect(m.aim).toBeNull();
 });
 it('can make a limited sound-based thin-cover decision but never gains wall vision',()=>{
  let speculative=0;for(let seed=1;seed<=24;seed++){const {ai,obstacles}=fixture('rifleA',{defenderTactics:1,defenderReaction:.3},seed);obstacles.push(barrier('thinWood'));ai.hear({id:1,timestamp:0,position:{x:0,y:0,z:0},radius:40,speed:5});ai.health=1e6;advance(ai,1.2);expect(ai.memories[0].visible).toBe(0);expect(ai.memories[0].observations).toHaveLength(0);expect(ai.shots.length).toBeLessThanOrEqual(2);expect(ai.shots.every(s=>s.information==='sound'&&s.penetratedLayers!>0)).toBe(true);speculative+=ai.shots.length;}
  expect(speculative).toBeGreaterThan(0);
 });
 it('separates gunfight damage from optional learning and mandatory exposure timers',()=>{
  for(const mode of ['learning','exposure','gunfight'] as const){const {ai}=fixture('operator',{combatMode:mode,exposureEnabled:mode!=='exposure',exposureLimit:.5});advance(ai,.55);if(mode==='gunfight'){expect(ai.death).toBeNull();expect(ai.health).toBe(150);}else{expect(ai.death?.cause).toBe('exposure');expect(ai.shots).toHaveLength(0);}}
  const {ai}=fixture('rifleA',{combatMode:'learning',exposureEnabled:false});advance(ai,6);expect(ai.health).toBe(150);expect(ai.shots).toHaveLength(0);expect(ai.death).toBeNull();
 });
 it('resets weapons, motor, perception and stale callback effects on retry',()=>{
  const {ai}=fixture('rifleA');ai.health=1e6;advance(ai,2);const previous=ai.memories[0];expect(previous.engagementShots).toBeGreaterThan(0);previous.gun.requestReload(2);ai.retry();const current=ai.memories[0];expect(current).not.toBe(previous);expect(current.gun.ammo).toBe(25);expect(current.gun.recoil.pitch).toBe(0);expect(current.motor.compensationPitch).toBe(0);expect(current.detectedAt).toBe(-100);expect(current.known).toBeNull();
  ai.onShot=()=>ai.retry();advance(ai,1,2);expect(ai.health).toBe(150);expect(ai.shots).toHaveLength(0);expect(ai.memories[0].gun.ammo).toBe(25);expect(ai.memories[0].engagementShots).toBe(0);
 });
 it('tracks a new visible displacement through history lag and finite motor correction',()=>{
  const {ai}=fixture();ai.health=1e6;advance(ai,1);const before=ai.memories[0].motor.yaw;
  advance(ai,.1,1,()=>body(4));const delayed=ai.memories[0].motor.yaw;expect(Math.abs(wrapAngle(delayed-before))).toBeLessThan(.02);
  advance(ai,.5,1.1,()=>body(4));expect(Math.abs(wrapAngle(ai.memories[0].motor.yaw-before))).toBeGreaterThan(.1);
 });
 it('preserves finite reserve ammunition instead of inventing bullets after reloads',()=>{
  const {ai}=fixture('sheriff',{infiniteReserve:false});ai.health=1e6;advance(ai,45);const m=ai.memories[0];expect(ai.report.enemyShots).toBe(WEAPONS.sheriff.magazine+WEAPONS.sheriff.reserve);expect(m.gun.ammo).toBe(0);expect(m.gun.reserve).toBe(0);const shots=ai.report.enemyShots;advance(ai,3,45);expect(ai.report.enemyShots).toBe(shots);
 });
 it('keeps identical actual rays across 60, 144 and 240 Hz render delivery',()=>{
  const run=(hz:number)=>{const {ai}=fixture('rifleB');ai.health=1e6;const clock=new FixedClock();let tick=0;for(let frame=0;frame<hz*5;frame++)clock.advance(1/hz,step=>{const time=tick++*step;ai.step(step,time,body(Math.sin(time*1.8)*1.4,Math.cos(time*1.8)*2.52));});return{ticks:clock.ticks,shots:ai.shots,motor:ai.memories[0].motor.snapshot()};};
  const sixty=run(60);expect(sixty.ticks).toBe(600);expect(run(144)).toEqual(sixty);expect(run(240)).toEqual(sixty);
 });
 it('persists actual session combat totals and clones them across retries',()=>{
  const {ai}=fixture();ai.health=1e6;advance(ai,3);const report=ai.snapshot(),c=report.combatSummary!;expect(c.shots).toBe(ai.report.enemyShots);expect(c.firstShots+c.followupShots).toBe(c.shots);expect(c.firstHits+c.followupHits).toBe(c.hits);expect(c.meanFirstShotDelay).toBeGreaterThan(.55);expect(c.residualRecoilRms).toBeGreaterThan(0);
  c.shots=999;const total=ai.report.enemyShots;ai.retry();expect(ai.snapshot().combatSummary!.shots).toBe(total);expect(ai.memories[0].gun.ammo).toBe(25);
 });
 it('diagnostics clone concealed memory and report actual ballistic hit regions',()=>{
  const {ai}=fixture();ai.health=1e6;advance(ai,2);const d=ai.diagnostics()[0];d.known!.x=999;expect(ai.memories[0].known!.x).toBe(0);
  for(const s of ai.shots){const hit=intersectPlayerBody(new Ray(new Vector3(s.origin.x,s.origin.y,s.origin.z),new Vector3(s.direction!.x,s.direction!.y,s.direction!.z)),body(),new Vector3());expect(s.hitRegion??null).toBe(hit?.region??null);expect(s.damage!>0).toBe(s.hit!=='miss');}
 });
});

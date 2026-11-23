import {describe,it,expect,vi,afterEach} from 'vitest';
import {DEFAULT_SETTINGS,sanitizeSettings} from '../config/settings';
import {WEAPONS,damageAt,adsFov} from '../config/weapons';
import {Weapon} from '../engine/weapons/Weapon';
import {Movement} from '../engine/movement/Movement';
import {Simulation} from '../engine/simulation/Simulation';
import {BrowserInput} from '../engine/input/Input';
import {emptyInput,type InputState,type Settings} from '../engine/types';

const dt=1/120;
function gun(settings:Partial<Settings>={},magazine=5){
 const w=new Weapon({...WEAPONS.operator,magazine},731);w.configureScope({...DEFAULT_SETTINGS,...settings});w.autoReload=false;
 let ticks=0;const shots:number[]=[],actions:string[]=[];w.onAction=a=>actions.push(a);
 const tick=(patch:Partial<InputState>={})=>{const input={...emptyInput(),...patch};const time=++ticks*dt;w.updateScope(time,dt,input);w.step(time,dt,input,()=>shots.push(time));};
 const run=(count:number,patch:Partial<InputState>={})=>{for(let i=0;i<count;i++)tick(patch);};
 return {w,shots,actions,tick,run,get time(){return ticks*dt;}};
}
function sim(settings:Partial<Settings>={}){const s=new Simulation('free','operator',{...DEFAULT_SETTINGS,analysisWall:true,autoReload:false,...settings});s.running=true;return s;}
function advance(s:Simulation,count:number,patch:Partial<InputState>={}){for(let i=0;i<count;i++)s.step(dt,{...emptyInput(),...patch});}
afterEach(()=>vi.unstubAllGlobals());

describe('Operator reference contract and actual bolt-action admission',()=>{
 it('keeps the requested version-calibrated ammunition, timing, movement and damage values',()=>{
  const p=WEAPONS.operator;expect(p.fireMode).toBe('bolt');expect(p.fireRate).toBe(.6);expect(p.adsFireRate).toBe(.6);
  expect(p.magazine).toBe(5);expect(p.reserve).toBe(10);expect(p.reloadTime).toBe(3.7);expect(p.equipTime).toBe(1.5);
  expect(p.movementSpeed).toBe(5.13);expect(p.adsMoveModifier).toBe(.72);expect(p.penetration).toBe('high');
  for(const distance of [1,30,70,140]){expect(damageAt(p,'head',distance)).toBe(255);expect(damageAt(p,'torso',distance)).toBe(150);expect(damageAt(p,'leg',distance)).toBe(120);}
 });
 it('does not turn a held trigger into automatic fire after repeated complete bolt cycles',()=>{
  const g=gun();g.run(1200,{fire:true});expect(g.shots).toHaveLength(1);expect(g.w.ammo).toBe(4);expect(g.actions.filter(a=>a==='bolt')).toHaveLength(1);
 });
 it('admits a fast press released before the simulation tick exactly once',()=>{
  const g=gun();g.tick({fire:false,firePresses:1});g.run(240);expect(g.shots).toHaveLength(1);expect(g.w.ammo).toBe(4);
 });
 it('rejects early new clicks, does not queue them, and permits a new click only after real recovery',()=>{
  const g=gun();g.tick({firePresses:1});const due=g.w.boltUntil;g.run(80);g.tick({firePresses:1});g.run(80);expect(g.shots).toHaveLength(1);
  while(g.time<due+dt)g.tick();expect(g.shots).toHaveLength(1);g.tick({firePresses:1});expect(g.shots).toHaveLength(2);expect(g.shots[1]-g.shots[0]).toBeGreaterThanOrEqual(1/.6);
 });
 it('preserves the 0.6 Hz lattice under click spam without multiple firing events per tick',()=>{
  const g=gun({},100);g.run(1200,{firePresses:2});expect(g.shots).toHaveLength(6);expect(g.w.ammo).toBe(94);
  for(let i=1;i<g.shots.length;i++)expect(g.shots[i]-g.shots[i-1]).toBeGreaterThanOrEqual(1/.6-dt-1e-9);
  expect(g.actions.filter(a=>a==='bolt')).toHaveLength(g.shots.length);
 });
 it('blocks equip/reload fire and transfers only the finite reserve actually available',()=>{
  const g=gun();g.w.infiniteReserve=false;g.w.equip(0);g.run(179,{firePresses:1});expect(g.shots).toHaveLength(0);g.tick({firePresses:1});expect(g.shots).toHaveLength(1);
  g.w.ammo=1;g.w.reserve=2;g.w.requestReload(g.time);const until=g.w.reloadingUntil!;expect(until-g.time).toBeCloseTo(3.7);
  while(g.time+dt<until-1e-9)g.tick({firePresses:1});expect(g.shots).toHaveLength(1);g.tick();expect(g.w.ammo).toBe(3);expect(g.w.reserve).toBe(0);expect(g.w.reloadingUntil).toBeNull();
  g.w.ammo=0;g.w.requestReload(g.time);expect(g.w.reloadingUntil).toBeNull();
 });
 it('does not erase the live bolt gate by switching away and equipping again',()=>{
  const g=gun();g.tick({firePresses:1});const bolt=g.w.boltUntil;g.w.equip(g.time);expect(g.w.boltUntil).toBe(bolt);g.run(185,{firePresses:1});expect(g.shots).toHaveLength(1);
 });
});

describe('Dedicated sniper scope and recovery state',()=>{
 it('cycles 2.5× → 5× → exit with persistent toggle, smooth optics and the exact FOV ratio',()=>{
  const s=sim({adsMode:'hold',operatorScopeMode:'toggle'});advance(s,1,{scopePresses:1});expect(s.scopeLevel).toBe(1);expect(s.scopeZoom).toBeGreaterThan(1);expect(s.scopeZoom).toBeLessThan(2.5);
  advance(s,180);expect(s.ads).toBe(true);expect(s.scopeZoom).toBeCloseTo(2.5,8);
  expect(adsFov(103,s.scopeZoom)).toBeCloseTo(41.2,8);
  advance(s,1,{scopePresses:1});expect(s.scopeLevel).toBe(2);expect(s.scopeZoom).toBeGreaterThan(2.5);expect(s.scopeZoom).toBeLessThan(5);advance(s,180);
  expect(s.scopeZoom).toBeCloseTo(5,8);expect(adsFov(103,s.scopeZoom)).toBeCloseTo(20.6,8);
  const yaw=s.yaw;s.look(10,0);expect(Math.abs(s.yaw-yaw)).toBeCloseTo(10*s.settings.degreesPerCount*s.settings.sensitivity/5*Math.PI/180,10);
  advance(s,1,{scopePresses:1});expect(s.scopeLevel).toBe(0);expect(s.ads).toBe(false);expect(s.scopeZoom).toBeGreaterThan(1);advance(s,180);expect(s.scopeZoom).toBeCloseTo(1,8);
 });
 it('blocks intentional scope-in and zoom-transition shots rather than silently treating them as scoped hits',()=>{
  const g=gun();g.tick({scopePresses:1,firePresses:1});expect(g.shots).toHaveLength(0);g.run(12,{firePresses:1});expect(g.shots).toHaveLength(0);g.run(25);g.tick({firePresses:1});expect(g.shots).toHaveLength(1);
  const h=gun();h.tick({scopePresses:1});h.run(120);h.tick({zoomPresses:1,firePresses:1});expect(h.w.scopeLevel).toBe(2);expect(h.shots).toHaveLength(0);
 });
 it('starts queued scope readiness when the real bolt gate opens, not when the early request arrived',()=>{
  const g=gun();g.tick({firePresses:1});const bolt=g.w.boltUntil;g.run(10);g.tick({scopePresses:1});expect(g.w.ads).toBe(false);
  while(g.time<bolt)g.tick();expect(g.w.ads).toBe(true);expect(g.w.scopeReadyAt).toBeGreaterThanOrEqual(bolt+.3-dt-1e-8);
  g.tick({firePresses:1});expect(g.shots).toHaveLength(1);g.run(40);g.tick({firePresses:1});expect(g.shots).toHaveLength(2);
 });
 it('exits after a shot, optionally restores the prior magnification, and cancels automatic restoration on reload',()=>{
  const g=gun({operatorAutoRescope:true});g.tick({scopePresses:1});g.run(120);g.tick({zoomPresses:1});g.run(120);g.tick({firePresses:1});expect(g.w.scopeLevel).toBe(0);expect(g.w.scopeZoom).toBeGreaterThan(4.9);
  while(g.time<g.w.boltUntil+dt)g.tick();expect(g.w.scopeLevel).toBe(2);expect(g.w.operatorState).toBe('scoping');g.run(90);expect(g.w.scopeZoom).toBeCloseTo(5,4);
  g.tick({firePresses:1});g.tick({reload:true});expect(g.w.scopeLevel).toBe(0);g.run(500);expect(g.w.scopeLevel).toBe(0);expect(g.w.reloadingUntil).toBeNull();
 });
 it('supports Hold plus a separate zoom binding and requires a fresh hold after a non-auto-rescoped shot',()=>{
  const g=gun({operatorScopeMode:'hold',operatorAutoRescope:false});g.tick({scopeHeld:true});g.run(120,{scopeHeld:true});g.tick({scopeHeld:true,zoomPresses:1});g.run(120,{scopeHeld:true});expect(g.w.scopeLevel).toBe(2);
  g.tick({scopeHeld:true,firePresses:1});g.run(240,{scopeHeld:true});expect(g.w.scopeLevel).toBe(0);g.tick();g.tick({scopeHeld:true});expect(g.w.scopeLevel).toBe(1);g.tick();expect(g.w.scopeLevel).toBe(0);
 });
 it('clears a persistent toggle scope when changing to Hold without a held right button',()=>{
  const g=gun();g.tick({scopePresses:1});g.run(100);g.w.configureScope({...DEFAULT_SETTINGS,operatorScopeMode:'hold'});g.tick();expect(g.w.scopeLevel).toBe(0);expect(g.w.ads).toBe(false);
 });
});

describe('Sniper precision follows physical movement and landing',()=>{
 it('has a large hip-fire penalty and requires settled optics for precision',()=>{
  const g=gun(),m=new Movement();expect(g.w.calculateSpread(m,false,false).total).toBeGreaterThanOrEqual(5);g.tick({scopePresses:1});expect(g.w.calculateSpread(m,true,false).total).toBeGreaterThanOrEqual(5);
  g.run(120);expect(g.w.calculateSpread(m,true,false).total).toBeLessThan(.03);
 });
 it('uses actual velocity and the stricter 15% scoped deadzone, including crouch, air and landing penalties',()=>{
  const g=gun(),m=new Movement();g.tick({scopePresses:1});g.run(120);const still=g.w.calculateSpread(m,true,false).total;
  m.speed=.6;expect(m.accurate).toBe(true);expect(g.w.calculateSpread(m,true,false).movement).toBeGreaterThan(0);m.speed=5.13*.72;const running=g.w.calculateSpread(m,true,false).total;expect(running).toBeGreaterThan(still*100);
  m.speed=0;m.crouch=1;expect(g.w.calculateSpread(m,true,false).total).toBeLessThan(still);m.crouch=0;m.grounded=false;expect(g.w.calculateSpread(m,true,false).air).toBe(12);m.grounded=true;expect(g.w.calculateSpread(m,true,true).landing).toBe(7);
 });
 it('moves at 5.13 m/s and 72% scoped speed, retaining velocity/inaccuracy after key release',()=>{
  const unscoped=sim();advance(unscoped,180,{strafe:1});expect(unscoped.movement.speed).toBeCloseTo(5.13,8);
  const scoped=sim();advance(scoped,1,{scopePresses:1});advance(scoped,120);advance(scoped,90,{forward:1});expect(scoped.movement.speed).toBeCloseTo(5.13*.72,8);
  advance(scoped,1,{firePresses:1});expect(scoped.shots).toHaveLength(1);expect(scoped.shots[0].accurate).toBe(false);expect(scoped.shots[0].velocity.z).not.toBe(0);expect(scoped.shots[0].spread.movement).toBeGreaterThan(0);
 });
 it('records physical airborne and the longer Operator landing recovery independently of the animation',()=>{
  const airborne=sim();advance(airborne,1,{scopePresses:1});advance(airborne,120);advance(airborne,1,{jump:true});advance(airborne,3);advance(airborne,1,{firePresses:1});expect(airborne.shots[0].accurate).toBe(false);expect(airborne.shots[0].accuracyState).toBe('airborne');expect(airborne.shots[0].spread.air).toBe(12);
  const landing=sim();advance(landing,1,{scopePresses:1});advance(landing,120);landing.movement.landedAt=landing.time-.15;advance(landing,1,{firePresses:1});expect(landing.shots[0].accurate).toBe(false);expect(landing.shots[0].accuracyState).toBe('landing');expect(landing.shots[0].spread.air).toBe(0);expect(landing.shots[0].spread.total).toBeGreaterThanOrEqual(7);
 });
 it('preserves rifle toggle ADS and Sheriff exclusion independently of sniper input commands',()=>{
  for(const id of ['rifleA','rifleB','sheriff'] as const){const s=new Simulation('free',id,{...DEFAULT_SETTINGS,analysisWall:true});s.running=true;advance(s,120,{ads:true,scopePresses:1,zoomPresses:1});expect(s.ads).toBe(id!=='sheriff');expect(s.scopeZoom).toBeCloseTo(id==='sheriff'?1:1.25,6);}
 });
});

describe('Operator input and persisted controls',()=>{
 it('resolves zoom collisions after custom movement bindings and reserves Digit4 for the fourth weapon',()=>{
  const s=sanitizeSettings({...DEFAULT_SETTINGS,operatorScopeMode:'hold',adsMode:'toggle',operatorZoomBinding:'KeyT',bindings:{...DEFAULT_SETTINGS.bindings,reload:'KeyT',jump:'KeyV'}});
  expect(s.operatorScopeMode).toBe('hold');expect(s.adsMode).toBe('toggle');expect(s.bindings.reload).toBe('KeyT');expect(Object.values(s.bindings)).not.toContain(s.operatorZoomBinding);expect(s.operatorZoomBinding).not.toBe('KeyT');expect(s.operatorZoomBinding).not.toBe('KeyV');
  expect(sanitizeSettings({...DEFAULT_SETTINGS,bindings:{...DEFAULT_SETTINGS.bindings,reload:'Digit4'}}).bindings.reload).toBe('KeyR');
 });
 it('delivers one scope command per physical right press, V only for Operator, and resets held input on pause',()=>{
  const doc=Object.assign(new EventTarget(),{pointerLockElement:null as unknown,hidden:false,exitPointerLock(){doc.pointerLockElement=null;doc.dispatchEvent(new Event('pointerlockchange'));}}),win=new EventTarget(),canvas=Object.assign(new EventTarget(),{requestPointerLock:vi.fn(async()=>{})});
  vi.stubGlobal('document',doc);vi.stubGlobal('window',win);const target={settings:DEFAULT_SETTINGS,weaponId:'operator' as 'operator'|'rifleA',running:true,viewYaw:0,viewPitch:0,look:vi.fn()},choose=vi.fn();
  const input=new BrowserInput(canvas as unknown as HTMLCanvasElement,target,vi.fn(),vi.fn(),vi.fn(),choose);doc.pointerLockElement=canvas;
  const mouse=(type:string,button:number)=>doc.dispatchEvent(Object.assign(new Event(type),{button}));const key=(code:string)=>doc.dispatchEvent(Object.assign(new Event('keydown'),{code,repeat:false}));
  mouse('mousedown',2);mouse('mousedown',2);expect(input.state.scopePresses).toBe(1);expect(input.state.scopeHeld).toBe(true);expect(input.state.ads).toBe(false);mouse('mouseup',2);mouse('mousedown',2);expect(input.state.scopePresses).toBe(2);
  key('KeyV');expect(input.state.zoomPresses).toBe(1);input.reset();expect(input.state.scopeHeld).toBe(false);expect(input.state.scopePresses).toBe(0);expect(input.state.zoomPresses).toBe(0);
  target.weaponId='rifleA';key('KeyV');expect(input.state.zoomPresses).toBe(0);mouse('mousedown',2);expect(input.state.ads).toBe(true);key('Digit4');expect(choose).toHaveBeenCalledWith('operator');input.dispose();
 });
});

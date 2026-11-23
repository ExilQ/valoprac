import {describe,it,expect} from 'vitest';
import {Ray,Vector3} from 'three';
import {COMPLEX_LEVEL,PEEK_ZONES,COMPLEX_CIRCULATION,activeAngles,zoneForScenario} from '../engine/tactical/complex';
import {auditPeekingGeometry,defenderPlacements,exposedAngles,potentiallyExposedAngles,routeSpace,sampleRoute,supportHeight} from '../engine/tactical/complexValidation';
import {LEVEL_IDS,LEVELS,standingSpace,visibleBetween} from '../engine/tactical/levels';
import {nearestEnvironmentHit,surfaceHeight} from '../engine/collision/environment';
import {Movement} from '../engine/movement/Movement';
import {playerVisibilitySamples} from '../engine/tactical/DefenderAI';
import {LEVEL_SPECS} from '../config/tactical';
import {emptyInput} from '../engine/types';
const level=COMPLEX_LEVEL,dt=1/120;
function walkZ(x:number,z:number,to:number,height=0,arena=level){const m=new Movement(undefined,arena.obstacles);m.position.set(x,height,z);m.previous.copy(m.position);const direction=Math.sign(to-z);let ticks=0;while(direction*(to-m.position.z)>.04&&ticks<2400){m.step({...emptyInput(),forward:-direction,walk:true},0,dt,ticks*dt);ticks++;}expect(ticks).toBeLessThan(2400);return m;}
function walkRoute(route:readonly {x:number;y:number;z:number}[]){
 const m=new Movement(undefined,level.obstacles);m.position.set(route[0].x,route[0].y,route[0].z);m.previous.copy(m.position);let ticks=0;
 for(const p of route.slice(1)){
  let leg=0;
  while(Math.hypot(p.x-m.position.x,p.z-m.position.z)>.055&&leg<6000){
   const yaw=Math.atan2(m.position.x-p.x,m.position.z-p.z);
   m.step({...emptyInput(),forward:1,walk:true},yaw,dt,ticks*dt);ticks++;leg++;
  }
  expect(leg,`movement blocked before ${JSON.stringify(p)} at ${JSON.stringify(m.position)}`).toBeLessThan(6000);
  expect(Math.abs(m.position.y-p.y),`route support at ${JSON.stringify(p)}`).toBeLessThanOrEqual(.300001);
 }
 return m;
}

describe('Connected Tactical Peeking Complex — real collision and visibility validation',()=>{
 it('provides eight purposeful zones, eleven sectors, and keeps free exploration separate from single-scenario selection',()=>{
  expect(PEEK_ZONES.map(z=>z.id)).toEqual(['A','B','C','D','E','F','G','H']);expect(level.angles).toHaveLength(11);
  expect(activeAngles('free')).toHaveLength(11);expect(activeAngles('slicing')).toHaveLength(3);expect(zoneForScenario('operator')?.id).toBe('B');
  for(const zone of PEEK_ZONES){expect(zone.focus.length).toBeGreaterThan(10);expect(zone.routes!.length).toBeGreaterThanOrEqual(2);}
 });
 for(const zone of PEEK_ZONES)it(`${zone.id}: protected spawn, grounded primary/alternate defenders, collision-valid approaches and retreat routes`,()=>{
  const defenders=level.angles.filter(a=>zone.angles.includes(a.id));expect(standingSpace(level.obstacles,zone.entry,.4)).toBe(true);expect(exposedAngles(level,zone.entry,defenders)).toEqual([]);
  for(const a of defenders)for(const p of defenderPlacements(a)){expect(standingSpace(level.obstacles,p,.4),`${a.id} valid body`).toBe(true);expect(supportHeight(level,p),`${a.id} grounded`).toBeCloseTo(p.y,5);}
  for(const [r,route]of zone.routes!.entries())for(const p of sampleRoute(route,.15))expect(routeSpace(level,p),`${zone.id} route ${r} ${JSON.stringify(p)}`).toBe(true);
  const seen=new Set(sampleRoute(zone.route,.15).flatMap(p=>exposedAngles(level,p,defenders)));for(const a of defenders)expect(seen.has(a.id),`${zone.id} reveal ${a.id}`).toBe(true);
 });
 it('connects the central gallery, both rear galleries, outer return paths, and every protected entry',()=>{
  for(const route of COMPLEX_CIRCULATION)for(const p of sampleRoute(route,.15))expect(routeSpace(level,p),JSON.stringify(p)).toBe(true);
  for(const p of sampleRoute(level.route,.2))expect(routeSpace(level,p),`continuous overall tour ${JSON.stringify(p)}`).toBe(true);
 });
 it('walks every intended front, rear and elevated route with the actual controller and no assisted movement',()=>{
  for(const zone of PEEK_ZONES)for(const route of zone.routes!)walkRoute(route);
  for(const route of COMPLEX_CIRCULATION)walkRoute(route);
 });
 it('keeps all G slicing route samples at one primary threat or fewer for every randomized spawn boundary',()=>{
  const g=zoneForScenario('slicing')!,defenders=activeAngles('slicing'),samples=sampleRoute(g.route,.05);
  for(const dx of [-.18,0,.18])for(const dz of [-.18,0,.18]){const seen=new Set<string>();for(const p of samples){const visible=exposedAngles(level,p,defenders,dx,dz);expect(visible.length,JSON.stringify({p,dx,dz,visible})).toBeLessThanOrEqual(1);visible.forEach(id=>seen.add(id));}expect(seen.size).toBe(3);}
 });
 it('keeps G progressive even when different defenders independently choose any bounded randomized spawn or local navigation position',()=>{
  const g=zoneForScenario('slicing')!,defenders=activeAngles('slicing');
  for(const p of sampleRoute(g.route,.05))expect(potentiallyExposedAngles(level,p,defenders).length,JSON.stringify(p)).toBeLessThanOrEqual(1);
  // Alternative coordinates and x jitter combine; checking only ±jitter around
  // the primary anchor would understate the actual randomization envelope.
  expect(Math.max(...defenderPlacements(defenders[0]).map(p=>Math.abs(p.x-defenders[0].position.x)))).toBeGreaterThanOrEqual(.36-1e-8);
 });
 it('protects the whole sampled player silhouette at each entry, and preserves sequential G body exposure while standing or crouching',()=>{
  const visible=(p:{x:number;y:number;z:number},angles:typeof level.angles,crouch:number,yaw:number)=>{
   const samples=playerVisibilitySamples({position:p,velocity:{x:0,y:0,z:0},eyeHeight:crouch?1.12:1.64,crouch,grounded:true,yaw,pitch:0});
   return angles.filter(a=>defenderPlacements(a).some(q=>samples.some(s=>visibleBetween(level.obstacles,{x:q.x,y:q.y+1.68,z:q.z},s))));
  };
  for(const zone of PEEK_ZONES)for(const yaw of[0,Math.PI/2])for(const crouch of[0,1])expect(visible(zone.entry,level.angles.filter(a=>zone.angles.includes(a.id)),crouch,yaw),`${zone.id} body-safe spawn`).toHaveLength(0);
  const g=zoneForScenario('slicing')!,angles=activeAngles('slicing');
  for(const p of sampleRoute(g.route,.15))for(const yaw of[0,Math.PI/2])for(const crouch of[0,1])expect(visible(p,angles,crouch,yaw).length,JSON.stringify({p,crouch,yaw})).toBeLessThanOrEqual(1);
 });
 it('uses actual cover heights for crouch and jumping information peeks',()=>{
  const d=zoneForScenario('crouch')!,defender=activeAngles('crouch')[0].position;
  const stand={x:d.center.x+1,y:1.64,z:-16},crouch={...stand,y:1.12},head={...defender,y:defender.y+1.68};
  expect(visibleBetween(level.obstacles,stand,head)).toBe(true);expect(visibleBetween(level.obstacles,crouch,head)).toBe(false);
  const e=zoneForScenario('jump')!,sniper=activeAngles('jump')[0].position,ground={x:e.center.x,y:1.64,z:21.5},air={...ground,y:2.3};
  expect(visibleBetween(level.obstacles,ground,{...sniper,y:1.68})).toBe(false);expect(visibleBetween(level.obstacles,air,{...sniper,y:1.68})).toBe(true);
  const m=new Movement(undefined,level.obstacles);m.position.set(e.center.x,0,21.5);m.previous.copy(m.position);m.step({...emptyInput(),jump:true},0,dt,0);let peak=0;for(let i=0;i<120;i++){m.step(emptyInput(),0,dt,i*dt);peak=Math.max(peak,m.position.y);}expect(peak).toBeGreaterThan(.65);expect(m.grounded).toBe(true);expect(m.position.y).toBe(0);
 });
 it('climbs the complete F staircase onto its balcony without a jump or a gap',()=>{const f=zoneForScenario('vertical')!,m=walkZ(f.center.x+.1,12,30);expect(m.position.y).toBeCloseTo(2.4,5);expect(m.grounded).toBe(true);});
 it('traverses both F ramps and the H upper/lower alternatives with the actual movement controller',()=>{
  const f=zoneForScenario('vertical')!,h=zoneForScenario('mixed')!;
  for(const m of [walkZ(f.center.x+7.2,12,30),walkZ(f.center.x+7,44,35)]){expect(m.position.y).toBeCloseTo(2.4,5);expect(m.grounded).toBe(true);}
  for(const m of [walkZ(h.center.x+8,14,30),walkZ(h.center.x+7,44,34)]){expect(m.position.y).toBeCloseTo(1.2,5);expect(m.grounded).toBe(true);}
  const down=walkZ(f.center.x+7,35,44,2.4);expect(down.position.y).toBeCloseTo(0,5);expect(down.grounded).toBe(true);
 });
 it('raycasts actual ramp surfaces and keeps the geometry audit free of invalid sectors/routes',()=>{
  const ramp=level.obstacles.find(o=>o.ramp&&o.ramp.high===2.4&&o.ramp.ascending===-1)!;const x=(ramp.box.min.x+ramp.box.max.x)/2,z=40,point=new Vector3();nearestEnvironmentHit(new Ray(new Vector3(x,9,z),new Vector3(0,-1,0)),20,point,[ramp]);expect(point.y).toBeCloseTo(surfaceHeight(ramp,x,z),6);
  const audit=auditPeekingGeometry();expect(audit.invalidDefenders).toEqual([]);expect(audit.circulationFailures).toEqual([]);expect(audit.passed).toBe(true);console.info(JSON.stringify({benchmark:'peeking-geometry',sectors:audit.sectors,zones:audit.zones.map(z=>({id:z.id,samples:z.routeSamples,maxThreats:z.maxSimultaneousThreats,invalidRoutes:z.routeFailures.length})),passed:audit.passed}));
 });
});

describe('Existing tactical environments retain their three-sector routes with distinct additional cover',()=>{
 for(const id of LEVEL_IDS)it(`${id}: all original entries, ramps/steps, alternate spawns and reposition choices remain valid`,()=>{
  const l=LEVELS[id];expect(l.angles).toHaveLength(3);
  for(const [index,a]of l.angles.entries()){
   for(const p of defenderPlacements(a)){expect(standingSpace(l.obstacles,p,.4),`${id} ${a.id}`).toBe(true);expect(supportHeight(l,p)).toBeCloseTo(p.y,5);}
   const m=walkZ(index*LEVEL_SPECS[id].width,5,a.position.z,0,l);expect(m.position.y).toBeCloseTo(a.position.y,5);expect(m.grounded).toBe(true);
  }
  expect(l.obstacles.filter(o=>o.kind==='cover').length).toBeGreaterThanOrEqual(6);
 });
});

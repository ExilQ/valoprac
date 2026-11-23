import {describe,it,expect} from 'vitest';
import {Box3,Vector3} from 'three';
import {SURFACES,SURFACE_IDS,SURFACE_FOOTSTEP_SOUND_PROFILES,SURFACE_PARTICLE_PROFILES,surfaceForObstacle,type SurfaceId} from '../config/surfaces';
import {VISUAL_MATERIAL_IDS} from '../config/materials';
import {PENETRATION_MATERIALS,materialFor} from '../config/penetration';
import {ENVIRONMENT,surfaceHeight,type Obstacle} from '../engine/collision/environment';
import {TACTICAL_OBSTACLES} from '../engine/tactical/map';
import {LEVELS} from '../engine/tactical/levels';
import {COMPLEX_LEVEL,PEEK_ZONES} from '../engine/tactical/complex';
import {BUNNY_LEVEL,WALLBANG_LEVEL,WALLBANG_SAMPLES} from '../engine/tactical/mechanics';
import {baseGroundSurface,resolveGroundSurface,footstepMaterialAt} from '../engine/footsteps/surfaceSelection';
import {Footsteps,type FootstepEvent} from '../engine/footsteps/Footsteps';
import {synthesizeFootstep} from '../engine/audio/footstepSynthesis';
import {synthesizeLanding} from '../engine/audio/landingSynthesis';
import {synthesizeMaterialImpact} from '../engine/audio/materialImpact';

const original={thinWood:[.8,.96],thickWood:[1.5,.94],drywall:[1.1,.95],thinMetal:[4,.89],thickMetal:[7,.85],concrete:[9,.86],stone:[11,.84],reinforced:[Infinity,0],glass:[.25,.98],breakable:[.6,.95]} as const;
const maps=[ENVIRONMENT,TACTICAL_OBSTACLES,...Object.values(LEVELS).map(l=>l.obstacles),COMPLEX_LEVEL.obstacles,BUNNY_LEVEL.obstacles,WALLBANG_LEVEL.obstacles];
function support(x=0,y=1,z=0,surfaceId:SurfaceId='concrete'):Obstacle{return{box:new Box3(new Vector3(x-1,0,z-1),new Vector3(x+1,y,z+1)),kind:'cover',color:0xffffff,surfaceId};}

describe('Independent physical surface calibration',()=>{
 it('covers all fifteen visual families without importing PBR parameters into physical rules',()=>{
  expect([...new Set(SURFACE_IDS.map(id=>SURFACES[id].visualMaterialId))].sort()).toEqual([...VISUAL_MATERIAL_IDS].sort());
  for(const id of SURFACE_IDS){const s=SURFACES[id];expect(Object.isFrozen(s)).toBe(true);expect(s.collisionFriction).toBe(1);expect(s).not.toHaveProperty('roughness');expect(s).not.toHaveProperty('metalness');expect(s).not.toHaveProperty('normalStrength');expect(s.penetrationResistance).toBeGreaterThan(0);expect(s.penetrationRetention).toBeGreaterThanOrEqual(0);expect(s.penetrationRetention).toBeLessThanOrEqual(1);expect(SURFACE_FOOTSTEP_SOUND_PROFILES).toContain(s.footstepSoundProfile);expect(SURFACE_PARTICLE_PROFILES[s.particleProfile]).toBeDefined();}
 });
 it('preserves every original resistance, retention, opacity and default resolver',()=>{
  for(const [id,[resistance,retention]] of Object.entries(original)){const d=PENETRATION_MATERIALS[id as SurfaceId];expect(d.resistance).toBe(resistance);expect(d.retention).toBe(retention);expect(d.opaque===true).toBe(id==='reinforced');}
  for(const obstacles of maps)for(const o of obstacles){expect(materialFor(o)).toBe(o.material??(o.ramp?'reinforced':o.kind==='cover'?'thickWood':'concrete'));}
 });
 it('keeps explicit author/editor material overrides authoritative over surface metadata',()=>{
  const obstacle=support(0,1,0,'paintedMetal');obstacle.material='thinWood';
  for(const rules of ['legacy-v2','materials-v3'] as const){expect(surfaceForObstacle(obstacle,rules)).toBe('thinWood');expect(materialFor(obstacle,rules)).toBe('thinWood');}
  expect(resolveGroundSurface('range',[obstacle],{x:0,y:1,z:0})).toBe('thinWood');
  delete obstacle.material;expect(surfaceForObstacle(obstacle)).toBe('paintedMetal');
 });
 it('authors sight transmission independently from penetration and appearance',()=>{
  for(const id of SURFACE_IDS)expect(SURFACES[id].blocksSight,id).toBe(id!=='glass');
  expect(SURFACES.glass.penetrationResistance).toBe(.25);expect(SURFACES.glass.penetrationRetention).toBe(.98);
 });
 it('authors a valid surface on every built map obstacle, preserving explicit wallbang samples',()=>{
  for(const obstacles of maps){expect(obstacles.length).toBeGreaterThan(0);for(const o of obstacles){expect(o.surfaceId).toBeDefined();expect(SURFACE_IDS).toContain(o.surfaceId);if(o.material)expect(surfaceForObstacle(o)).toBe(o.material);}}
  for(const sample of WALLBANG_SAMPLES)expect(WALLBANG_LEVEL.obstacles.some(o=>o.material===sample.material&&o.surfaceId===sample.material)).toBe(true);
 });
 it('corrects the ramp versus platform core mismatch only under versioned rules',()=>{
  const level=COMPLEX_LEVEL,ramp=level.obstacles.find(o=>o.ramp&&o.ramp.high===2.4)!,platform=level.obstacles.find(o=>!o.ramp&&o.box.max.y===2.4&&o.box.max.z===37)!;
  expect(materialFor(ramp,'legacy-v2')).toBe('reinforced');expect(materialFor(platform,'legacy-v2')).toBe('thickWood');
  expect(materialFor(ramp,'materials-v3')).toBe('concrete');expect(materialFor(platform,'materials-v3')).toBe('concrete');
  expect(PENETRATION_MATERIALS[materialFor(ramp,'materials-v3')].resistance).toBe(9);
 });
});

describe('Foot and landing contact surface selection',()=>{
 it('matches visible base floor finishes, including the range rubber mat boundary',()=>{
  expect(baseGroundSurface('range',{x:0,y:0,z:5})).toBe('rubber');expect(baseGroundSurface('range',{x:0,y:0,z:.29})).toBe('rawConcrete');expect(baseGroundSurface('range',{x:11.91,y:0,z:5})).toBe('rawConcrete');
  for(const zone of PEEK_ZONES){expect(footstepMaterialAt('complex',[],zone.center)).toBe(zone.material);}
  const tileBay=PEEK_ZONES[1],approach={x:tileBay.center.x,y:0,z:-7.5};
  expect(baseGroundSurface('complex',approach)).toBe('rawConcrete');expect(footstepMaterialAt('complex',[],approach,'legacy-v2')).toBe('tile');
 });
 it('uses the actual raised ramp/platform support rather than the surrounding themed floor',()=>{
  const zone=PEEK_ZONES[5],ramp=COMPLEX_LEVEL.obstacles.find(o=>o.ramp&&o.ramp.high===2.4)!,b=ramp.box,position={x:(b.min.x+b.max.x)/2,y:0,z:(b.min.z+b.max.z)/2};position.y=surfaceHeight(ramp,position.x,position.z);
  expect(zone.material).toBe('tile');expect(footstepMaterialAt('complex',COMPLEX_LEVEL.obstacles,position,'legacy-v2')).toBe('tile');expect(resolveGroundSurface('complex',COMPLEX_LEVEL.obstacles,position)).toBe('concrete');expect(footstepMaterialAt('complex',COMPLEX_LEVEL.obstacles,position)).toBe('concrete');
  const woodZone=PEEK_ZONES[7],platform={x:woodZone.center.x+4,y:1.2,z:30};expect(footstepMaterialAt('complex',COMPLEX_LEVEL.obstacles,platform,'legacy-v2')).toBe('wood');expect(footstepMaterialAt('complex',COMPLEX_LEVEL.obstacles,platform)).toBe('concrete');
 });
 it('respects top cladding and never chooses overhead solids or a different floor',()=>{
  const lower=support(0,1,0,'concrete'),upper=support(0,3,0,'steel');lower.groundSurfaceId='thinWood';
  expect(resolveGroundSurface('range',[lower,upper],{x:0,y:1,z:0})).toBe('thinWood');expect(resolveGroundSurface('range',[lower,upper],{x:0,y:3,z:0})).toBe('steel');expect(resolveGroundSurface('range',[lower,upper],{x:0,y:0,z:0})).toBe('rawConcrete');
 });
 it('keeps the physical support sound while the foot centre overhangs a ledge',()=>{
  const ledge=support(0,1,0,'steel'),position={x:1.15,y:1,z:0};
  expect(resolveGroundSurface('range',[ledge],position,'materials-v3',{radius:.28})).toBe('steel');
  expect(resolveGroundSurface('range',[ledge],position,'materials-v3',{radius:.1})).toBe('rawConcrete');
  expect(footstepMaterialAt('range',[ledge],position,'materials-v3',{radius:.28})).toBe('steel');
 });
 it('selects each step at collision-resolved travelled positions across a material boundary',()=>{
  const steps=new Footsteps();steps.graceRemaining=0;steps.profile={...steps.profile,accumulationPerMeter:2.5};const events:FootstepEvent[]=[];
  steps.onStep=e=>{e.surfaceId=resolveGroundSurface('range',[],e.position);e.material=SURFACES[e.surfaceId].footstepSoundProfile;events.push({...e,position:{...e.position}});};
  steps.step({previous:{x:0,y:0,z:1},position:{x:0,y:0,z:-.6},grounded:true,crouch:0},false,.1,.1);
  expect(events.map(e=>e.material)).toEqual(['rubber','concrete','concrete','concrete']);
  const count=events.length;steps.step({previous:{x:0,y:0,z:-.6},position:{x:0,y:0,z:-.6},grounded:true,crouch:0},false,.1,.2);expect(events).toHaveLength(count);
 });
});

describe('Original material audio and particle families',()=>{
 it('produces a distinct finite step and landing waveform for every registered acoustic profile',()=>{
  const steps=new Set<string>(),landings=new Set<string>();
  for(const profile of SURFACE_FOOTSTEP_SOUND_PROFILES){const step=synthesizeFootstep(8000,0,profile),landing=synthesizeLanding(8000,profile);expect(step.every(Number.isFinite)).toBe(true);expect(landing.every(Number.isFinite)).toBe(true);expect(Math.max(...step.map(Math.abs))).toBeLessThan(1);expect(Math.max(...landing.map(Math.abs))).toBeLessThan(1);steps.add(Array.from(step.slice(0,120)).join(','));landings.add(Array.from(landing.slice(0,120)).join(','));}
  expect(steps.size).toBe(SURFACE_FOOTSTEP_SOUND_PROFILES.length);expect(landings.size).toBe(SURFACE_FOOTSTEP_SOUND_PROFILES.length);
 });
 it('shares impact synthesis by calibrated physical family while keeping particles material specific',()=>{
  expect(synthesizeMaterialImpact('paintedMetal',8000)).toEqual(synthesizeMaterialImpact('thickMetal',8000));expect(synthesizeMaterialImpact('plasteredConcrete',8000)).toEqual(synthesizeMaterialImpact('concrete',8000));
  const profiles=['thinWood','thinMetal','concrete','glass'] as const;expect(new Set(profiles.map(id=>SURFACES[id].particleProfile)).size).toBe(4);
  for(const id of profiles){const p=SURFACE_PARTICLE_PROFILES[SURFACES[id].particleProfile];expect(p.count).toBeGreaterThan(0);expect(p.lifetime).toBeGreaterThan(0);expect(p.lifetime).toBeLessThan(.5);}
 });
});

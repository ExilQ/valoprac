import {describe,it,expect,vi} from 'vitest';
import {SurfaceMaterialLibrary} from '../engine/rendering/SurfaceMaterials';
import {useMultiDrawCharacters} from '../engine/rendering/CharacterBatches';
import {automaticGraphicsPatch} from '../config/graphicsPolicy';
import {DEFAULT_SETTINGS,sanitizeSettings} from '../config/settings';
import {Simulation} from '../engine/simulation/Simulation';
import {emptyInput} from '../engine/types';
import {deterministicState} from '../engine/replay/integrity';

describe('Measured software-renderer fallback',()=>{
 it('retains compact instancing on software, integrated and unknown devices',()=>{
  for(const kind of ['software','integrated','unknown'] as const)expect(useMultiDrawCharacters({kind},true)).toBe(false);
  expect(useMultiDrawCharacters({kind:'hardware'},false)).toBe(false);expect(useMultiDrawCharacters({kind:'hardware'},true)).toBe(true);
 });
 it('keeps scalar PBR finishes on software Low and restores the same objects at High',()=>{
  const library=new SurfaceMaterialLibrary({quality:'low',scalarLow:true}),metal=library.material('steel'),cloth=library.material('fabric');
  try{
   const values=[metal.color.getHex(),metal.roughness,metal.metalness,cloth.roughness];
   expect(library.stats()).toMatchObject({textureCount:0,estimatedTextureBytes:0,scalarLowFallback:true});expect(metal.map).toBeNull();expect(cloth.map).toBeNull();
   library.setQuality('high');expect(library.material('steel')).toBe(metal);expect(metal.map!.image.width).toBe(256);expect(metal.normalMap).not.toBeNull();
   const oldMap=metal.map!,dispose=vi.fn();oldMap.addEventListener('dispose',dispose);library.setQuality('low');expect(dispose).toHaveBeenCalledTimes(1);
   expect(metal.map).toBeNull();expect([metal.color.getHex(),metal.roughness,metal.metalness,cloth.roughness]).toEqual(values);expect(library.stats().textureCount).toBe(0);
  }finally{library.dispose();}
 });
 it('retains mapped Low finishes on normal devices',()=>{const library=new SurfaceMaterialLibrary({quality:'low'});try{expect(library.material('wood').map!.image.width).toBe(32);expect(library.stats().scalarLowFallback).toBe(false);}finally{library.dispose();}});
 it('caps software pixel cost without changing manual preferences or ordinary integrated recommendations',()=>{
  const s={...structuredClone(DEFAULT_SETTINGS),frameLimit:144 as const};expect(automaticGraphicsPatch(s,true,'software')).toMatchObject({graphicsPreset:'low',renderScale:.5,frameLimit:60});
  expect(s.renderScale).toBe(1);expect(s.frameLimit).toBe(144);expect(automaticGraphicsPatch({...s,autoGraphics:false},true,'software')).toEqual({});
  expect(automaticGraphicsPatch(s,true,'integrated')).toMatchObject({renderScale:.8});expect(automaticGraphicsPatch(s,true,'integrated').frameLimit).toBeUndefined();
 });
 it('preserves authoritative movement and shot outcomes under automatic graphics fallback',()=>{
  const original=sanitizeSettings(structuredClone(DEFAULT_SETTINGS)),fallback=sanitizeSettings({...original,...automaticGraphicsPatch(original,true,'software')});
  const a=new Simulation('free','rifleA',original),b=new Simulation('free','rifleA',fallback);a.running=b.running=true;
  // Fixed ticks consume one-shot input edges; each engine gets its own copy.
  for(let i=0;i<360;i++){const input={...emptyInput(),strafe:i<120?1:i<180?-1:0,jump:i===80,jumpHeld:i===80,jumpPresses:i===80?1:0,fire:i%30===0,firePresses:i%30===0?1:0};a.step(1/120,{...input});b.step(1/120,{...input});}
  const {settings:leftSettings,...left}=deterministicState(a),{settings:rightSettings,...right}=deterministicState(b);
  // Replay checksums deliberately include configuration. Only these explicitly
  // visual preferences may differ; every gameplay field and event must match.
  const visual=new Set(['graphicsPreset','shadowQuality','textureQuality','postProcessing','ambientOcclusion','antialias','effectsQuality','renderScale','frameLimit']);
  const mechanical=(settings:typeof original)=>Object.fromEntries(Object.entries(settings).filter(([key])=>!visual.has(key)));
  expect(mechanical(leftSettings)).toEqual(mechanical(rightSettings));expect(left).toEqual(right);expect(a.shots.length).toBeGreaterThan(0);expect(a.shots).toEqual(b.shots);
 });
});

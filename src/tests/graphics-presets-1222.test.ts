import {describe,expect,it} from 'vitest';
import {DEFAULT_SETTINGS,GRAPHICS_PRESETS,LEGACY_GRAPHICS_PRESETS,SETTINGS_KEY,loadSettingsForApplication,upgradeGraphicsPreset} from '../config/settings';
import {MAX_RENDER_PIXELS,renderPixelRatio} from '../config/graphicsPolicy';
import type {Settings} from '../engine/types';

function memory(initial:Record<string,string>={}){
 const data=new Map(Object.entries(initial));
 return {data,getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>{data.set(k,v);}};
}

describe('12.22 graphics presets and pixel budget',()=>{
 it('never supersamples and keeps full-screen effects out of every preset',()=>{
  for(const preset of Object.values(GRAPHICS_PRESETS))expect(preset.renderScale).toBeLessThanOrEqual(1);
  // 12.23: no preset enables full-screen effects; they are optional toggles.
  for(const q of ['low','medium','high','ultra'] as const){expect(GRAPHICS_PRESETS[q].ambientOcclusion).toBe(false);expect(GRAPHICS_PRESETS[q].postProcessing).toBe(false);}
  expect(GRAPHICS_PRESETS.ultra).toMatchObject({antialias:true});
 });
 it('caps the drawing buffer at 3840×2160 while keeping native sharpness below it',()=>{
  expect(renderPixelRatio(1,1,1920,1080)).toBe(1);
  expect(renderPixelRatio(1.5,1,1707,960)).toBeCloseTo(1.5);
  const capped=renderPixelRatio(2,1.25,2560,1440);
  expect(2560*1440*capped**2).toBeLessThanOrEqual(MAX_RENDER_PIXELS+1);
  expect(renderPixelRatio(4,1,800,600)).toBe(2);
  expect(renderPixelRatio(1,.8,1920,1080)).toBeCloseTo(.8);
 });
 it('upgrades untouched old bundles once and keeps customised profiles',()=>{
  const oldUltra={...structuredClone(DEFAULT_SETTINGS),...LEGACY_GRAPHICS_PRESETS.ultra} as Settings;
  expect(upgradeGraphicsPreset(oldUltra)).toMatchObject(GRAPHICS_PRESETS.ultra);
  const custom={...oldUltra,renderScale:1.1};
  expect(upgradeGraphicsPreset(custom)).toBe(custom);
  const store=memory({[SETTINGS_KEY]:JSON.stringify(oldUltra)});
  expect(loadSettingsForApplication(store).renderScale).toBe(1);
  expect(JSON.parse(store.data.get(SETTINGS_KEY)!).renderScale).toBe(1);
  store.setItem(SETTINGS_KEY,JSON.stringify(oldUltra));
  expect(loadSettingsForApplication(store).renderScale).toBe(1.25);
 });
 it('starts a new profile on the current Medium bundle without changing frozen defaults',()=>{
  const store=memory();
  expect(loadSettingsForApplication(store)).toMatchObject(GRAPHICS_PRESETS.medium);
  expect(store.data.has(SETTINGS_KEY)).toBe(false);
  expect(DEFAULT_SETTINGS.postProcessing).toBe(true);
 });
});

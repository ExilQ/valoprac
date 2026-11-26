import {describe,expect,it} from 'vitest';
import {DEFAULT_SETTINGS,GRAPHICS_PRESETS,GRAPHICS_PRESETS_1222,LEGACY_GRAPHICS_PRESETS,SETTINGS_KEY,loadSettingsForApplication,upgradeGraphicsPreset} from '../config/settings';
import {recommendPreset,type PresetMeasurement} from '../engine/rendering/graphicsBenchmark';
import {matchingPreset,presetRows} from '../ui/GraphicsQuality';
import {SURFACE_QUALITY} from '../config/surfaceQuality';
import type {Quality,Settings} from '../engine/types';

const memory=(initial:Record<string,string>={})=>{const data=new Map(Object.entries(initial));return {data,getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>{data.set(k,v);}};};
const profile=(patch:Partial<Settings>)=>({...structuredClone(DEFAULT_SETTINGS),...patch}) as Settings;
const QUALITIES:Quality[]=['low','medium','high','ultra'];

describe('12.23 graphics tiers',()=>{
 it('renders every preset as one forward pass and raises cost only through shadows, materials and effects',()=>{
  for(const q of QUALITIES){const p=GRAPHICS_PRESETS[q];expect(p.postProcessing).toBe(false);expect(p.ambientOcclusion).toBe(false);expect(p.renderScale).toBeLessThanOrEqual(1);}
  const order=(key:'shadowQuality'|'textureQuality'|'effectsQuality')=>QUALITIES.map(q=>['off','low','medium','high','ultra'].indexOf(GRAPHICS_PRESETS[q][key] as string));
  for(const key of ['shadowQuality','textureQuality','effectsQuality'] as const){const values=order(key);expect(values).toEqual([...values].sort((a,b)=>a-b));}
  expect(QUALITIES.map(q=>SURFACE_QUALITY[GRAPHICS_PRESETS[q].textureQuality as Quality].anisotropy)).toEqual([1,2,8,16]);
 });
 it('moves untouched 12.21 and 12.22 bundles to the current bundle once and keeps customised profiles',()=>{
  const old1222=profile(GRAPHICS_PRESETS_1222.ultra);expect(old1222.ambientOcclusion).toBe(true);
  expect(upgradeGraphicsPreset(old1222)).toMatchObject(GRAPHICS_PRESETS.ultra);
  expect(upgradeGraphicsPreset(profile(LEGACY_GRAPHICS_PRESETS.ultra))).toMatchObject(GRAPHICS_PRESETS.ultra);
  const custom=profile({...GRAPHICS_PRESETS_1222.ultra,shadowQuality:'medium'});expect(upgradeGraphicsPreset(custom)).toBe(custom);
  const current=profile(GRAPHICS_PRESETS.high);expect(upgradeGraphicsPreset(current)).toBe(current);
  const store=memory({[SETTINGS_KEY]:JSON.stringify(old1222),'valoprac-graphics-presets-v2':'1'});
  expect(loadSettingsForApplication(store)).toMatchObject({ambientOcclusion:false,postProcessing:false});
  expect(JSON.parse(store.data.get(SETTINGS_KEY)!).ambientOcclusion).toBe(false);
  store.setItem(SETTINGS_KEY,JSON.stringify(old1222));expect(loadSettingsForApplication(store).ambientOcclusion).toBe(true);
 });
 it('recommends the highest preset whose 90th-percentile frame fits the display budget',()=>{
  const m=(preset:Quality,p90Ms:number,completed=true):PresetMeasurement=>({preset,medianMs:p90Ms*.9,p90Ms,fps:Math.round(1000/(p90Ms*.9)),completed});
  expect(recommendPreset([m('low',2),m('medium',3),m('high',4),m('ultra',5)],1000/144)).toBe('ultra');
  expect(recommendPreset([m('low',2),m('medium',5),m('high',7.5),m('ultra',9)],1000/144)).toBe('medium');
  expect(recommendPreset([m('low',40),m('medium',90,false),m('high',Infinity,false),m('ultra',Infinity,false)],1000/60)).toBe('low');
  expect(recommendPreset([m('low',3),m('medium',4),m('high',4.5,false),m('ultra',5)],1000/144)).toBe('ultra');
 });
 it('describes each preset in a fixed table and recognises custom settings',()=>{
  const rows=presetRows();expect(rows.map(r=>r.label)).toContain('그림자');for(const row of rows)expect(row.cells).toHaveLength(4);
  for(const q of QUALITIES)expect(matchingPreset(profile(GRAPHICS_PRESETS[q]))).toBe(q);
  expect(matchingPreset(profile({...GRAPHICS_PRESETS.high,ambientOcclusion:true}))).toBeNull();
 });
});

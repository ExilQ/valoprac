import {describe,it,expect} from 'vitest';
import {CURRENT_SETTINGS_REVISION,DEFAULT_SETTINGS,SETTINGS_KEY,loadSettings,persistSettings,sanitizeSettings} from '../config/settings';

const oldProfile=()=>({sensitivity:.47,dpi:1200,fov:99,adsSensitivity:.8,volume:.23,graphicsPreset:'high',crosshairColor:'#abcdef',targetCount:8,stepStationaryDecay:1.4,adsMode:'hold',bindings:{...DEFAULT_SETTINGS.bindings,crouch:'ControlLeft',reload:'KeyT'}});
function memory(raw:unknown){let value=JSON.stringify(raw),writes=0;return{getItem:(key:string)=>key===SETTINGS_KEY?value:null,setItem:(key:string,next:string)=>{expect(key).toBe(SETTINGS_KEY);writes++;value=next;},read:()=>JSON.parse(value),writes:()=>writes};}

describe('One-time legacy control migration with retained preference ownership',()=>{
 for(const revision of [undefined,0])it(`migrates 3.x Ctrl/Hold defaults at revision ${revision??'missing'} and retains unrelated preferences`,()=>{
  const raw={...oldProfile(),...(revision===undefined?{}:{gameplayRevision:revision})},s=sanitizeSettings(raw);
  expect(s.gameplayRevision).toBe(CURRENT_SETTINGS_REVISION);expect(s.bindings.crouch).toBe('KeyC');expect(s.adsMode).toBe('toggle');expect(s.stepStationaryDecay).toBe(3.5);
  for(const key of ['sensitivity','dpi','fov','adsSensitivity','volume','graphicsPreset','crosshairColor','targetCount'] as const)expect(s[key]).toBe(raw[key]);
  expect(s.bindings.reload).toBe('KeyT');expect(raw.bindings.crouch).toBe('ControlLeft');expect(raw.adsMode).toBe('hold');
 });
 it('recognizes a legacy pair accidentally stamped revision 1 without treating its calibrated decay as an old default',()=>{
  const s=sanitizeSettings({...oldProfile(),gameplayRevision:1});expect(s.bindings.crouch).toBe('KeyC');expect(s.adsMode).toBe('toggle');expect(s.stepStationaryDecay).toBe(1.4);
 });
 it('preserves separately customized revision-1 controls instead of resetting the profile',()=>{
  const hold=sanitizeSettings({...oldProfile(),gameplayRevision:1,bindings:{...DEFAULT_SETTINGS.bindings,reload:'KeyT'}});
  expect(hold.adsMode).toBe('hold');expect(hold.bindings.crouch).toBe('KeyC');expect(hold.bindings.reload).toBe('KeyT');
  const ctrl=sanitizeSettings({...oldProfile(),gameplayRevision:1,adsMode:'toggle'});expect(ctrl.bindings.crouch).toBe('ControlLeft');expect(ctrl.adsMode).toBe('toggle');
 });
 it('keeps deliberate current-revision Ctrl/Hold and current calibrated footstep values',()=>{
  const current={...oldProfile(),gameplayRevision:CURRENT_SETTINGS_REVISION};const s=sanitizeSettings(current);
  expect(s.bindings.crouch).toBe('ControlLeft');expect(s.adsMode).toBe('hold');expect(s.stepStationaryDecay).toBe(1.4);
  expect(sanitizeSettings(s)).toEqual(s);
 });
 it('retains a custom crouch key and all other existing custom actions in an old profile',()=>{
  const s=sanitizeSettings({...oldProfile(),adsMode:'toggle',bindings:{...oldProfile().bindings,crouch:'KeyZ',forward:'ArrowUp'}});
  expect(s.bindings.crouch).toBe('KeyZ');expect(s.bindings.forward).toBe('ArrowUp');expect(s.bindings.reload).toBe('KeyT');expect(s.adsMode).toBe('toggle');
 });
 it('does not overwrite an existing custom C action or reset the rest of its bindings',()=>{
  const s=sanitizeSettings({...oldProfile(),bindings:{...oldProfile().bindings,reload:'KeyC',jump:'KeyX'}});
  expect(s.bindings.reload).toBe('KeyC');expect(s.bindings.jump).toBe('KeyX');expect(s.bindings.crouch).toBe('KeyZ');expect(s.bindings.forward).toBe('KeyW');expect(new Set(Object.values(s.bindings)).size).toBe(Object.keys(s.bindings).length);
 });
 it('does not steal a customized Operator zoom key when moving legacy crouch to a safe key',()=>{
  const s=sanitizeSettings({...oldProfile(),gameplayRevision:1,operatorZoomBinding:'KeyC'});expect(s.operatorZoomBinding).toBe('KeyC');expect(s.bindings.crouch).toBe('KeyX');expect(s.bindings.reload).toBe('KeyT');
 });
 it('writes a migrated boundary exactly once on load and preserves later explicit Ctrl/Hold choices',()=>{
  const storage=memory(oldProfile()),first=loadSettings(storage);expect(storage.writes()).toBe(1);expect(storage.read().gameplayRevision).toBe(CURRENT_SETTINGS_REVISION);expect(loadSettings(storage)).toEqual(first);expect(storage.writes()).toBe(1);
  const chosen={...first,adsMode:'hold' as const,bindings:{...first.bindings,crouch:'ControlLeft'}};expect(persistSettings(chosen,storage)).toBe(true);expect(storage.writes()).toBe(2);expect(loadSettings(storage)).toEqual(chosen);expect(storage.writes()).toBe(2);
 });
 it('marks customized revision-1 profiles current once without changing their custom controls',()=>{
  const storage=memory({...oldProfile(),gameplayRevision:1,bindings:{...oldProfile().bindings,crouch:'KeyZ'}});const s=loadSettings(storage);expect(s.bindings.crouch).toBe('KeyZ');expect(s.adsMode).toBe('hold');expect(storage.writes()).toBe(1);expect(loadSettings(storage)).toEqual(s);expect(storage.writes()).toBe(1);
 });
 it('uses the migrated profile with read-only or quota-limited storage',()=>{
  const text=JSON.stringify(oldProfile()),readOnly=loadSettings({getItem:()=>text}),quota=loadSettings({getItem:()=>text,setItem:()=>{throw new Error('quota');}});
  expect(quota).toEqual(readOnly);expect(quota.sensitivity).toBe(.47);expect(quota.bindings.crouch).toBe('KeyC');expect(quota.adsMode).toBe('toggle');
 });
 it('does not downgrade future revision provenance or rewrite its explicit controls',()=>{
  const storage=memory({...oldProfile(),gameplayRevision:CURRENT_SETTINGS_REVISION+1}),s=loadSettings(storage);expect(s.gameplayRevision).toBe(CURRENT_SETTINGS_REVISION+1);expect(s.bindings.crouch).toBe('ControlLeft');expect(s.adsMode).toBe('hold');expect(storage.writes()).toBe(0);
 });
 it('recovers safely without shared binding state or writes for invalid/missing profiles',()=>{
  for(const raw of [null,[],undefined]){const storage=memory(raw),s=loadSettings(storage);expect(s).toEqual(DEFAULT_SETTINGS);expect(storage.writes()).toBe(0);s.bindings.crouch='KeyZ';expect(DEFAULT_SETTINGS.bindings.crouch).toBe('KeyC');}
  expect(loadSettings({getItem:()=>'{broken'})).toEqual(DEFAULT_SETTINGS);expect(loadSettings({getItem:()=>{throw new Error('blocked');}})).toEqual(DEFAULT_SETTINGS);
 });
});

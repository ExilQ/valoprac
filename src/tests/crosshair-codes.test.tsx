import {afterAll,describe,it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {writeFileSync} from 'node:fs';
import {Crosshair} from '../components/Crosshair';
import {DEFAULT_SETTINGS,sanitizeSettings,persistSettings,loadSettings} from '../config/settings';
import {activeCrosshair,crosshairConfiguration,crosshairSettings,CROSSHAIR_PRESETS,defaultCrosshairAdvanced} from '../config/crosshair';
import {CROSSHAIR_CODE_LIMIT,CROSSHAIR_PROFILE_KEY,importCrosshairCode,exportCrosshairCode,loadCrosshairProfiles,saveCrosshairProfiles,MAX_CROSSHAIR_PROFILES} from '../config/crosshairCodes';
import {sensitivityUnits} from '../engine/input/sensitivity';
import {rotationCounts} from '../engine/input/zoomSensitivity';

export const REPRESENTATIVE_CROSSHAIR_CODES=[
 '0;P;c;5;h;0;d;1;z;2;0b;0;1b;0',
 '0;P;c;1;h;0;d;0;0b;1;0l;4;0t;1;0o;2;0a;1;0m;0;0f;0;1b;0',
 '0;P;c;8;u;EF5261FF;h;1;t;1;o;0.8;d;0;0b;1;0a;0.75;0l;5;0t;2;0o;3;1b;0',
 '0;P;c;0;h;1;t;1;o;0.5;d;1;z;1;a;0.8;0b;1;0l;3;0t;1;0o;2;0a;1;1b;1;1l;2;1t;1;1o;9;1a;0.4',
 '0;s;1;P;c;7;h;0;d;0;0b;1;0l;4;0t;1;0o;2;1b;0;A;c;5;h;1;t;1;o;0.7;d;1;z;2;a;1;0b;0;1b;0',
];
const results:unknown[]=[];
afterAll(()=>{if(process.env.VALOPRAC_CROSSHAIR_REPORT)writeFileSync(process.env.VALOPRAC_CROSSHAIR_REPORT,JSON.stringify({schema:1,issues:['I7','I8'],format:'Version0 symmetric static P and optional s=1/A subset; unsupported fields rejected',nativeVALORANTClientVerified:false,representativeRoundTrips:results},null,2)+'\n');});
describe('I8 bounded supported crosshair-code round trips',()=>{
 for(const[caseId,code]of REPRESENTATIVE_CROSSHAIR_CODES.entries())it(`representative ${caseId+1} preserves static primary and ADS design`,()=>{
  const decoded=importCrosshairCode(code),encoded=exportCrosshairCode(decoded),again=importCrosshairCode(encoded);
  expect(again.primary).toEqual(decoded.primary);expect(again.ads).toEqual(decoded.adsMode==='primary'?decoded.primary:decoded.ads);expect(exportCrosshairCode(again)).toBe(encoded);
  const applied=sanitizeSettings({...DEFAULT_SETTINGS,...crosshairSettings(again)});expect(activeCrosshair(applied)).toEqual(decoded.primary);expect(activeCrosshair(applied,true)).toEqual(again.ads);
  results.push({case:caseId+1,input:code,canonicalCode:encoded,canonicalBytes:new TextEncoder().encode(encoded).length,primary:decoded.primary,ads:again.ads,passed:true});
 });
 it.each([
  '',null,'1;P;c;1','0;P;c','0;P;c;1;c;5','0;P;h;2','0;P;0l;100','0;P;c;NaN','0;P;z;Infinity','0;P;c;1;','0;P;c;8;u;<script>','0;P;c;8;u;ABCDEFAA','0;P;0m;1','0;P;0f;1','0;P;0v;2','0;P;0s;1','0;S;d;1','0;P;c;1;P;c;5','0;P;c;1;A;c;5','0;P;c;1;u;FFFFFF','0;s;2;P;c;1','0;P;__proto__;1','0;P;c;-1','0;P;c;1.5',
 ])('rejects malformed or unsupported data without silently dropping it: %s',raw=>{expect(()=>importCrosshairCode(raw)).toThrow();});
 it('rejects excessive byte/token lengths and has a stable explicit bound',()=>{expect(CROSSHAIR_CODE_LIMIT).toBe(4096);expect(()=>importCrosshairCode('0;P;'+('c;1;'.repeat(1024)))).toThrow();expect(()=>importCrosshairCode('0;P;c;'+'1'.repeat(100))).toThrow();});
 it('every built-in preset produces a safely importable code',()=>{for(const p of CROSSHAIR_PRESETS){const code=exportCrosshairCode(p.configuration);expect(()=>importCrosshairCode(code)).not.toThrow();}});
});
describe('I8 local preferences, rendering policy and profiles',()=>{
 it('retains legacy shape fields and adds independent nested defaults without sharing mutable state',()=>{const a=sanitizeSettings({crosshairColor:'#abcdef',crosshairThickness:3,crosshairGap:2,crosshairLength:9}),b=sanitizeSettings(null);expect(a.crosshairColor).toBe('#abcdef');expect(activeCrosshair(a).inner).toMatchObject({length:9,thickness:3,gap:2});a.crosshairAdvanced.primary.outer.length=19;expect(b.crosshairAdvanced.primary.outer.length).toBe(3);expect(DEFAULT_SETTINGS.crosshairAdvanced.primary.outer.length).toBe(3);});
 it('sanitizes nested nonfinite/color/resource values and cannot inject arbitrary SVG styles',()=>{const s=sanitizeSettings({crosshairAdvanced:{primary:{centerSize:Infinity,outlineOpacity:-1,outer:{length:100000,gap:100,opacity:NaN}},ads:{color:'url(javascript:alert(1))',inner:{thickness:0}},weaponVisibility:{rifleA:'false'}}});expect(s.crosshairAdvanced.primary.centerSize).toBe(1);expect(s.crosshairAdvanced.primary.outlineOpacity).toBe(0);expect(s.crosshairAdvanced.primary.outer.length).toBe(20);expect(s.crosshairAdvanced.ads.color).toMatch(/^#[a-f0-9]{6}$/);expect(renderToStaticMarkup(<Crosshair settings={s} ads/>)).not.toContain('javascript');expect(s.crosshairAdvanced.weaponVisibility.rifleA).toBe(true);});
 it('persists nested design and old shape/sensitivity settings together',()=>{const data=new Map<string,string>(),storage={getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>{data.set(k,v);}},s=sanitizeSettings({...DEFAULT_SETTINGS,sensitivity:.72,...crosshairSettings(importCrosshairCode(REPRESENTATIVE_CROSSHAIR_CODES[4]))});expect(persistSettings(s,storage)).toBe(true);expect(loadSettings(storage)).toEqual(s);});
 it('renders optional outlines, dots, inner and outer lines without shifting the aiming center',()=>{const s=sanitizeSettings({...DEFAULT_SETTINGS,...crosshairSettings(CROSSHAIR_PRESETS[2].configuration)}),html=renderToStaticMarkup(<Crosshair settings={s}/>);expect(html).toContain('viewBox="-60 -60 120 120"');expect(html).toContain('reticle-inner');expect(html).toContain('reticle-outer');expect(html).toContain('stroke-opacity="0.75"');expect(html).not.toContain('reticle-dot');});
 it('keeps rifle ADS compact by default and applies per-weapon display only to its corresponding weapon',()=>{const s=sanitizeSettings(DEFAULT_SETTINGS),a=activeCrosshair(s,true);expect(a.inner.enabled).toBe(false);expect(a.outer.enabled).toBe(false);expect(a.centerSize).toBe(2);s.crosshairAdvanced.weaponVisibility.sheriff=false;expect(renderToStaticMarkup(<Crosshair settings={s} weapon="sheriff"/>)).toBe('');expect(renderToStaticMarkup(<Crosshair settings={s} weapon="rifleA"/>)).toContain('reticle-svg');expect(renderToStaticMarkup(<Crosshair settings={s} weapon="sheriff" preview/>)).toContain('reticle-svg');});
 it('stores at most 12 validated local profiles and handles denied storage',()=>{const m=new Map<string,string>(),storage={getItem:(k:string)=>m.get(k)??null,setItem:(k:string,v:string)=>{m.set(k,v);}},profiles=Array.from({length:MAX_CROSSHAIR_PROFILES},(_,i)=>({id:`profile-${i}`,name:`개인 ${i}`,configuration:crosshairConfiguration(DEFAULT_SETTINGS)}));expect(saveCrosshairProfiles(profiles,storage)).toBe(true);expect(loadCrosshairProfiles(storage)).toEqual(profiles);expect(saveCrosshairProfiles([...profiles,{...profiles[0],id:'extra'}],storage)).toBe(false);expect(saveCrosshairProfiles(profiles,{setItem:()=>{throw Error('quota');}})).toBe(false);m.set(CROSSHAIR_PROFILE_KEY,'{"__proto__":{"polluted":true}}');expect(loadCrosshairProfiles(storage)).toEqual([]);});
 it('rejects malformed/future/oversized profiles, duplicate IDs and names beyond 32 characters',()=>{const p={id:'valid',name:'연습',configuration:crosshairConfiguration(DEFAULT_SETTINGS)};for(const raw of [[{...p,configuration:{...p.configuration,version:99}}],[p,p],[{...p,name:'x'.repeat(33)}],[{...p,configuration:{}}]]){const json=JSON.stringify(raw);expect(loadCrosshairProfiles({getItem:()=>json})).toEqual([]);}expect(loadCrosshairProfiles({getItem:()=>'*'.repeat(64001)})).toEqual([]);});
});
describe('I7 displayed derived sensitivity units',()=>{
 it('0.5 sensitivity at800DPI yields10285.714 counts and32.657cm under the0.07 model',()=>{const s={...DEFAULT_SETTINGS,sensitivity:.5,dpi:800,degreesPerCount:.07};expect(rotationCounts(s)).toBeCloseTo(10285.7142857143,8);expect(sensitivityUnits(.5,800).edpi).toBe(400);expect(sensitivityUnits(.5,800).cm360).toBeCloseTo(32.6571428571,8);});
});

import {DEFAULT_CROSSHAIR_DESIGN,defaultCrosshairAdvanced,sanitizeCrosshairDesign,type CrosshairConfiguration,type CrosshairDesign} from './crosshair';

const COLORS=['#ffffff','#00ff00','#7fff00','#dfff00','#ffff00','#00ffff','#ff00ff','#ff0000'];
const KEYS=new Set(['c','u','h','t','o','d','z','a','0b','0a','0l','0t','0o','0m','0f','1b','1a','1l','1t','1o','1m','1f']);
export const CROSSHAIR_CODE_LIMIT=4096;
export class CrosshairCodeError extends Error {constructor(message:string){super(message);this.name='CrosshairCodeError';}}
function fail(message:string):never{throw new CrosshairCodeError(message);}
function numeric(value:string,key:string,min:number,max:number){if(!/^(0|[1-9]\d*)(\.\d{1,4})?$/.test(value))fail(`${key}: 유효한 숫자가 아닙니다.`);const n=Number(value);if(!Number.isFinite(n)||n<min||n>max)fail(`${key}: 지원 범위는 ${min}–${max}입니다.`);return n;}
function flag(value:string,key:string){if(value!=='0'&&value!=='1')fail(`${key}: 0 또는 1만 사용할 수 있습니다.`);return value==='1';}
function defaults():CrosshairDesign{return{...DEFAULT_CROSSHAIR_DESIGN,color:'#ffffff',outlineOpacity:.5,centerDot:false,centerSize:2,inner:{enabled:true,length:6,thickness:2,gap:3,opacity:1},outer:{enabled:true,length:2,thickness:2,gap:10,opacity:.35}};}
function shape(fields:Map<string,string>):CrosshairDesign{
 const out=defaults(),get=(key:string)=>fields.get(key);
 const c=get('c')===undefined?0:numeric(get('c')!,'c',0,8);if(!Number.isInteger(c))fail('c: 정수 색상 번호를 사용하세요.');
 if(c===8){const u=get('u');if(!u||!/^[0-9a-f]{6}(ff)?$/i.test(u))fail('사용자 색상은 6자리 RGB 또는 불투명한 RRGGBBFF만 지원합니다.');out.color='#'+u.slice(0,6).toLowerCase();}else{if(get('u')!==undefined)fail('사용자 색상 u는 c=8과 함께 사용하세요.');out.color=COLORS[c];}
 for(const[k,p]of[['h','outline'],['d','centerDot']]as const)if(get(k)!==undefined)out[p]=flag(get(k)!,k);
 for(const[k,p,min,max]of[['t','outlineThickness',0,3],['o','outlineOpacity',0,1],['z','centerSize',1,10],['a','centerOpacity',0,1]]as const)if(get(k)!==undefined)out[p]=numeric(get(k)!,k,min,max);
 for(const[prefix,p]of[['0','inner'],['1','outer']]as const){const line=out[p];if(get(prefix+'b')!==undefined)line.enabled=flag(get(prefix+'b')!,prefix+'b');for(const[k,key,min,max]of[['a','opacity',0,1],['l','length',0,20],['t','thickness',1,6],['o','gap',0,20]]as const)if(get(prefix+k)!==undefined)line[key]=numeric(get(prefix+k)!,prefix+k,min,max);
  for(const k of ['m','f'])if(get(prefix+k)!==undefined&&flag(get(prefix+k)!,prefix+k))fail('이동·발사 오차가 켜진 코드는 개별 오차 의미를 보장할 수 없습니다. 0m·0f·1m·1f를 0으로 설정하세요.');
 }
 return out;
}
/** Deliberately bounded interoperable subset: symmetric static primary and ADS
 * sections. Unsupported sniper/asymmetric/error-multiplier keys are rejected,
 * never silently discarded. This parser does not execute imported content. */
export function importCrosshairCode(raw:unknown):CrosshairConfiguration{
 if(typeof raw!=='string'||!raw.trim()||raw.length>CROSSHAIR_CODE_LIMIT)fail('조준선 코드는 1–4096자여야 합니다.');
 const tokens=raw.trim().split(';');if(tokens.length>256||tokens.some(t=>!t||t.length>32)||tokens[0]!=='0')fail('지원하는 코드는 0;P;… 형식입니다.');
 const sections=new Map<string,Map<string,string>>(),global=new Map<string,string>();let current=global;
 for(let i=1;i<tokens.length;){const key=tokens[i++];if(key==='P'||key==='A'){if(sections.has(key))fail('같은 조준선 구역이 중복되었습니다.');current=new Map();sections.set(key,current);continue;}
  if(/^[A-Z]$/.test(key))fail(`${key}: 지원하지 않는 조준선 구역입니다. 기본 P와 정조준 A만 지원합니다.`);
  if(i>=tokens.length)fail('키에 대응하는 값이 없습니다.');if(current.has(key))fail(`${key}: 중복 키는 허용하지 않습니다.`);if(current===global?key!=='s':!KEYS.has(key))fail(`${key}: 지원하지 않는 조준선 항목입니다.`);current.set(key,tokens[i++]);
 }
 if(!sections.has('P'))fail('기본 조준선 P 구역이 필요합니다.');
 const separate=global.has('s')?flag(global.get('s')!,'s'):false;
 if(sections.has('A')&&!separate)fail('정조준 A 구역은 s=1과 함께 사용하세요.');
 const primary=shape(sections.get('P')!),ads=sections.has('A')?shape(sections.get('A')!):primary;
 return{version:1,primary,adsMode:sections.has('A')?'custom':'primary',ads,weaponVisibility:defaultCrosshairAdvanced().weaponVisibility};
}
const val=(n:number)=>String(Math.round(n*10000)/10000);
function encodeShape(d:CrosshairDesign){
 const p=sanitizeCrosshairDesign(d),index=COLORS.indexOf(p.color.toLowerCase()),a=['c',String(index<0?8:index)];if(index<0)a.push('u',p.color.slice(1).toUpperCase()+'FF');
 a.push('h',String(+p.outline),'t',val(p.outlineThickness),'o',val(p.outlineOpacity),'d',String(+p.centerDot),'z',val(p.centerSize),'a',val(p.centerOpacity));
 for(const[k,l]of[['0',p.inner],['1',p.outer]]as const)a.push(k+'b',String(+l.enabled),k+'a',val(l.opacity),k+'l',val(l.length),k+'t',val(l.thickness),k+'o',val(l.gap),k+'m','0',k+'f','0');return a;
}
export function exportCrosshairCode(c:CrosshairConfiguration,adsDotSize=2){
 const p=c.primary,ads=c.adsMode==='primary'?p:c.adsMode==='custom'?c.ads:{...p,centerDot:true,centerSize:adsDotSize,centerOpacity:1,inner:{...p.inner,enabled:false},outer:{...p.outer,enabled:false}};
 return['0','s','1','P',...encodeShape(p),'A',...encodeShape(ads)].join(';');
}
export interface LocalCrosshairProfile {id:string;name:string;configuration:CrosshairConfiguration;}
export const CROSSHAIR_PROFILE_KEY='valoprac-crosshair-profiles-v1';
export const MAX_CROSSHAIR_PROFILES=12;
function validDesign(raw:unknown):raw is CrosshairDesign{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return false;const p=raw as Record<string,unknown>;
 if(typeof p.color!=='string'||!/^#[0-9a-f]{6}$/i.test(p.color))return false;
 for(const k of ['outline','centerDot'])if(typeof p[k]!=='boolean')return false;
 for(const[k,min,max]of[['outlineThickness',0,3],['outlineOpacity',0,1],['centerSize',1,10],['centerOpacity',0,1]]as const)if(typeof p[k]!=='number'||!Number.isFinite(p[k])||p[k]<min||p[k]>max)return false;
 for(const key of ['inner','outer']){const line=p[key] as Record<string,unknown>|undefined;if(!line||typeof line!=='object'||typeof line.enabled!=='boolean')return false;for(const[k,min,max]of[['opacity',0,1],['length',0,20],['thickness',1,6],['gap',0,20]]as const)if(typeof line[k]!=='number'||!Number.isFinite(line[k])||line[k]<min||line[k]>max)return false;}return true;
}
function validConfiguration(raw:unknown):raw is CrosshairConfiguration{if(!raw||typeof raw!=='object'||Array.isArray(raw))return false;const o=raw as CrosshairConfiguration;return o.version===1&&['dot','primary','custom'].includes(o.adsMode)&&validDesign(o.primary)&&validDesign(o.ads)&&!!o.weaponVisibility&&['rifleA','rifleB','sheriff','operator'].every(k=>typeof o.weaponVisibility[k as keyof typeof o.weaponVisibility]==='boolean');}
export function loadCrosshairProfiles(storage?:Pick<Storage,'getItem'>):LocalCrosshairProfile[]{try{const text=(storage??localStorage).getItem(CROSSHAIR_PROFILE_KEY);if(!text||text.length>64000)return[];const raw=JSON.parse(text);if(!Array.isArray(raw)||raw.length>MAX_CROSSHAIR_PROFILES)return[];const profiles:LocalCrosshairProfile[]=[],ids=new Set();for(const p of raw){if(!p||typeof p.id!=='string'||!/^[a-z0-9-]{1,64}$/i.test(p.id)||ids.has(p.id)||typeof p.name!=='string'||!p.name.trim()||p.name.length>32||!validConfiguration(p.configuration))return[];ids.add(p.id);profiles.push({id:p.id,name:p.name,configuration:structuredClone(p.configuration)});}return profiles;}catch{return[];}}
export function saveCrosshairProfiles(profiles:LocalCrosshairProfile[],storage?:Pick<Storage,'setItem'>){try{const json=JSON.stringify(profiles);const check=loadCrosshairProfiles({getItem:()=>json});if(check.length!==profiles.length||json.length>64000)return false;(storage??localStorage).setItem(CROSSHAIR_PROFILE_KEY,json);return true;}catch{return false;}}

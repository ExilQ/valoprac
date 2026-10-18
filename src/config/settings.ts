import type { Settings } from '../engine/types';
export const DEFAULT_SETTINGS: Settings = {
  sensitivity:0.35,degreesPerCount:0.07,dpi:800,fov:103,duration:60,seed:1947,
  crosshairColor:'#72f5b7',crosshairThickness:2,crosshairGap:5,crosshairLength:7,
  dynamicCrosshair:true,brakingHud:true,idealCompensation:false,volume:0.35,
  renderScale:1,antialias:true,showPerformance:true,behavior:'random'
};
export function sanitizeSettings(raw: unknown): Settings {
  const s={...DEFAULT_SETTINGS}; if(!raw || typeof raw!=='object')return s;
  const o=raw as Record<string,unknown>;
  const ranges:Partial<Record<keyof Settings,[number,number]>>={sensitivity:[0.01,5],degreesPerCount:[0.005,0.3],dpi:[100,32000],fov:[60,120],duration:[15,600],seed:[1,2147483647],crosshairThickness:[1,6],crosshairGap:[0,20],crosshairLength:[1,20],volume:[0,1],renderScale:[0.5,1.5]};
  for(const [k,range] of Object.entries(ranges)){const v=o[k];if(typeof v==='number'&&Number.isFinite(v))(s as unknown as Record<string,unknown>)[k]=Math.min(range[1],Math.max(range[0],v));}
  for(const k of ['dynamicCrosshair','brakingHud','idealCompensation','antialias','showPerformance'] as const)if(typeof o[k]==='boolean')s[k]=o[k];
  if(typeof o.crosshairColor==='string'&&/^#[0-9a-f]{6}$/i.test(o.crosshairColor))s.crosshairColor=o.crosshairColor;
  if(['stationary','strafe','random','stopGo','crouch','peek'].includes(String(o.behavior)))s.behavior=o.behavior as Settings['behavior'];
  s.seed=Math.round(s.seed);s.duration=Math.round(s.duration);return s;
}
export const SETTINGS_KEY='tactical-aim-settings-v1';
export function loadSettings(storage?:Pick<Storage,'getItem'>):Settings {try{return sanitizeSettings(JSON.parse((storage??localStorage).getItem(SETTINGS_KEY)??'null'));}catch{return {...DEFAULT_SETTINGS};}}
export function persistSettings(settings:Settings,storage?:Pick<Storage,'setItem'>):boolean{try{(storage??localStorage).setItem(SETTINGS_KEY,JSON.stringify(sanitizeSettings(settings)));return true;}catch{return false;}}

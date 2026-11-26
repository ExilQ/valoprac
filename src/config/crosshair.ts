import type {Settings,GunId} from '../engine/types';
export interface CrosshairLine {enabled:boolean;opacity:number;length:number;thickness:number;gap:number;}
export interface CrosshairDesign {color:string;outline:boolean;outlineThickness:number;outlineOpacity:number;centerDot:boolean;centerSize:number;centerOpacity:number;inner:CrosshairLine;outer:CrosshairLine;}
export interface CrosshairExtras {outline:boolean;outlineThickness:number;outlineOpacity:number;centerDot:boolean;centerSize:number;centerOpacity:number;innerEnabled:boolean;innerOpacity:number;outer:CrosshairLine;}
export interface CrosshairAdvanced {version:1;primary:CrosshairExtras;adsMode:'dot'|'primary'|'custom';ads:CrosshairDesign;weaponVisibility:Record<GunId,boolean>;}
export interface CrosshairConfiguration {version:1;primary:CrosshairDesign;adsMode:CrosshairAdvanced['adsMode'];ads:CrosshairDesign;weaponVisibility:Record<GunId,boolean>;}
const line=(enabled=true):CrosshairLine=>({enabled,opacity:1,length:7,thickness:2,gap:5});
export const DEFAULT_CROSSHAIR_DESIGN:CrosshairDesign={color:'#e8fcf3',outline:true,outlineThickness:1,outlineOpacity:.75,centerDot:true,centerSize:1,centerOpacity:1,inner:line(),outer:{...line(false),length:3,thickness:2,gap:12,opacity:.5}};
export function defaultCrosshairAdvanced():CrosshairAdvanced{return{version:1,primary:{outline:true,outlineThickness:1,outlineOpacity:.75,centerDot:true,centerSize:1,centerOpacity:1,innerEnabled:true,innerOpacity:1,outer:{...DEFAULT_CROSSHAIR_DESIGN.outer}},adsMode:'dot',ads:{...DEFAULT_CROSSHAIR_DESIGN,centerSize:2,inner:line(false),outer:line(false)},weaponVisibility:{rifleA:true,rifleB:true,sheriff:true,operator:true}};}
const object=(v:unknown):Record<string,unknown>=>v!==null&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
const number=(v:unknown,fallback:number,min:number,max:number)=>typeof v==='number'&&Number.isFinite(v)?Math.min(max,Math.max(min,v)):fallback;
const bool=(v:unknown,fallback:boolean)=>typeof v==='boolean'?v:fallback;
const color=(v:unknown,fallback:string)=>typeof v==='string'&&/^#[0-9a-f]{6}$/i.test(v)?v.toLowerCase():fallback;
function sanitizeLine(raw:unknown,base:CrosshairLine):CrosshairLine{const o=object(raw);return{enabled:bool(o.enabled,base.enabled),opacity:number(o.opacity,base.opacity,0,1),length:number(o.length,base.length,0,20),thickness:number(o.thickness,base.thickness,1,6),gap:number(o.gap,base.gap,0,20)};}
export function sanitizeCrosshairDesign(raw:unknown,base=DEFAULT_CROSSHAIR_DESIGN):CrosshairDesign{const o=object(raw);return{color:color(o.color,base.color),outline:bool(o.outline,base.outline),outlineThickness:number(o.outlineThickness,base.outlineThickness,0,3),outlineOpacity:number(o.outlineOpacity,base.outlineOpacity,0,1),centerDot:bool(o.centerDot,base.centerDot),centerSize:number(o.centerSize,base.centerSize,1,10),centerOpacity:number(o.centerOpacity,base.centerOpacity,0,1),inner:sanitizeLine(o.inner,base.inner),outer:sanitizeLine(o.outer,base.outer)};}
export function sanitizeCrosshairAdvanced(raw:unknown):CrosshairAdvanced{
 const o=object(raw),d=defaultCrosshairAdvanced(),p=object(o.primary),v=object(o.weaponVisibility);
 return{version:1,primary:{outline:bool(p.outline,d.primary.outline),outlineThickness:number(p.outlineThickness,1,0,3),outlineOpacity:number(p.outlineOpacity,.75,0,1),centerDot:bool(p.centerDot,true),centerSize:number(p.centerSize,1,1,10),centerOpacity:number(p.centerOpacity,1,0,1),innerEnabled:bool(p.innerEnabled,true),innerOpacity:number(p.innerOpacity,1,0,1),outer:sanitizeLine(p.outer,d.primary.outer)},adsMode:['dot','primary','custom'].includes(String(o.adsMode))?o.adsMode as CrosshairAdvanced['adsMode']:'dot',ads:sanitizeCrosshairDesign(o.ads,d.ads),weaponVisibility:{rifleA:bool(v.rifleA,true),rifleB:bool(v.rifleB,true),sheriff:bool(v.sheriff,true),operator:bool(v.operator,true)}};
}
export function crosshairConfiguration(s:Pick<Settings,'crosshairColor'|'crosshairThickness'|'crosshairGap'|'crosshairLength'|'crosshairAdvanced'>):CrosshairConfiguration{
 const a=sanitizeCrosshairAdvanced(s.crosshairAdvanced),p=a.primary;
 return{version:1,primary:{color:s.crosshairColor,outline:p.outline,outlineThickness:p.outlineThickness,outlineOpacity:p.outlineOpacity,centerDot:p.centerDot,centerSize:p.centerSize,centerOpacity:p.centerOpacity,inner:{enabled:p.innerEnabled,opacity:p.innerOpacity,length:s.crosshairLength,thickness:s.crosshairThickness,gap:s.crosshairGap},outer:{...p.outer}},adsMode:a.adsMode,ads:a.ads,weaponVisibility:a.weaponVisibility};
}
export function crosshairSettings(configuration:CrosshairConfiguration):Partial<Settings>{
 const p=sanitizeCrosshairDesign(configuration.primary),a=sanitizeCrosshairAdvanced({version:1,adsMode:configuration.adsMode,ads:configuration.ads,weaponVisibility:configuration.weaponVisibility,primary:{...p,innerEnabled:p.inner.enabled,innerOpacity:p.inner.opacity,outer:p.outer}});
 return{crosshairColor:p.color,crosshairLength:p.inner.length,crosshairThickness:p.inner.thickness,crosshairGap:p.inner.gap,crosshairAdvanced:a};
}
export function activeCrosshair(s:Settings,ads=false):CrosshairDesign{
 const c=crosshairConfiguration(s);if(!ads||c.adsMode==='primary')return c.primary;if(c.adsMode==='custom')return c.ads;
 return{...c.primary,centerDot:true,centerSize:s.adsDotSize,centerOpacity:1,inner:{...c.primary.inner,enabled:false},outer:{...c.primary.outer,enabled:false}};
}
export const CROSSHAIR_PRESETS=[
 {id:'precise',name:'정밀 십자',configuration:{version:1,primary:{...DEFAULT_CROSSHAIR_DESIGN,centerDot:false,inner:{...line(),length:4,gap:2}},adsMode:'dot',ads:defaultCrosshairAdvanced().ads,weaponVisibility:defaultCrosshairAdvanced().weaponVisibility} as CrosshairConfiguration},
 {id:'dot',name:'작은 중앙점',configuration:{version:1,primary:{...DEFAULT_CROSSHAIR_DESIGN,color:'#00ffff',centerSize:2,inner:line(false)},adsMode:'dot',ads:defaultCrosshairAdvanced().ads,weaponVisibility:defaultCrosshairAdvanced().weaponVisibility} as CrosshairConfiguration},
 {id:'framed',name:'안·바깥선',configuration:{version:1,primary:{...DEFAULT_CROSSHAIR_DESIGN,color:'#00ff00',centerDot:false,inner:{...line(),length:4,gap:2},outer:{...line(),opacity:.4,length:2,gap:10}},adsMode:'primary',ads:defaultCrosshairAdvanced().ads,weaponVisibility:defaultCrosshairAdvanced().weaponVisibility} as CrosshairConfiguration},
] as const;

import {REFERENCE_YAW,sensitivityUnits} from '../../engine/input/sensitivity';
import {zoomSensitivityMultiplier} from '../../engine/input/zoomSensitivity';
import type {Settings} from '../../engine/types';
import type {AimMeta} from '../types';

export const CALIBRATION_SCHEMA=1;
/** The scoped camera changed from tangent-space zoom to horizontal FOV/zoom.
 * Unscoped input identity deliberately stays byte-compatible with older data. */
export const SCOPED_PROJECTION_MODEL='horizontal-division-1.0.0';
declare module '../types' {interface AimMeta {projectionModel?:string;}}
export const CALIBRATION_LIMITATIONS=[
 'DPI는 사용자가 입력한 값이며 브라우저가 센서 DPI를 측정하지 않습니다.',
 '전달 델타는 물리 센서 카운트나 하드웨어 폴링 빈도를 보장하지 않습니다.',
 '원시 입력은 요청·승인 상태를 기록하며 운영체제 가속을 변경하지 않습니다.',
 'cm/360°와 패드 이동 거리는 입력한 DPI와 회전 계수로 계산한 추정값입니다.'
] as const;
export const CALIBRATION_REFERENCE={coefficient:REFERENCE_YAW,convention:'degrees per delivered count × sensitivity',source:'KovaaK developer announcement: Added Valorant sensitivity scale that matches Valorant’s 0.07 yaw',sourceURL:'https://steamcommunity.com/games/824270/announcements/detail/2201641989738342680',riotCertified:false,nativeHardwareVerified:false} as const;
export type RawRequest='unverified'|'accepted'|'fallback'|'denied';
export interface CalibrationConfig {
 schema:1;dpi:number;dpiSource:'user-declared';coefficient:number;fov:number;aspectRatio:number;
 inputMode:string;rawRequest:RawRequest;ads:boolean;adsMultiplier:number;weapon:string;scopeZoom:number;projectionModel?:string;
}
export interface CalibrationContext {
 dpi?:number;fov?:number;viewport?:[number,number];aspectRatio?:number;inputMode?:string;rawRequest?:RawRequest;
 ads?:boolean;weapon?:string;scopeZoom?:number;
}
const finite=(value:unknown,min:number,max:number):value is number=>typeof value==='number'&&Number.isFinite(value)&&value>=min&&value<=max;
const bounded=(n:unknown,fallback:number,min:number,max:number)=>finite(n,min,max)?n:fallback;
const canonical=(n:number)=>Number(n.toFixed(8));
export function calibrationFromSettings(settings:Pick<Settings,'dpi'|'degreesPerCount'|'fov'|'adsSensitivity'>&Partial<Pick<Settings,'scopeSensitivity25'|'scopeSensitivity5'>>,context:CalibrationContext={}):CalibrationConfig {
 const viewport=context.viewport,aspect=viewport&&finite(viewport[0],1,20000)&&finite(viewport[1],1,20000)?viewport[0]/viewport[1]:16/9;
 const scopeZoom=context.ads?bounded(context.scopeZoom,1,1,20):1;
 return {schema:1,dpi:bounded(context.dpi,bounded(settings.dpi,800,100,32000),100,32000),dpiSource:'user-declared',coefficient:bounded(settings.degreesPerCount,REFERENCE_YAW,.001,1),fov:bounded(context.fov,bounded(settings.fov,103,1,179),1,179),aspectRatio:bounded(context.aspectRatio,aspect,.1,10),inputMode:typeof context.inputMode==='string'?context.inputMode.slice(0,64):'unknown',rawRequest:['unverified','accepted','fallback','denied'].includes(context.rawRequest??'')?context.rawRequest!:'unverified',ads:context.ads===true,adsMultiplier:bounded(zoomSensitivityMultiplier(settings,scopeZoom),1,.01,10),weapon:typeof context.weapon==='string'?context.weapon.slice(0,64):'neutral',scopeZoom,...(context.ads&&scopeZoom>1?{projectionModel:SCOPED_PROJECTION_MODEL}:{})};
}
/** Deliberately stores the full canonical input tuple, rather than a short hash
 * which could silently collide. Sensitivity is absent: it is the tested factor. */
export function calibrationFingerprint(config:CalibrationConfig):string {
 const tuple:unknown[]=[config.dpi,canonical(config.coefficient),canonical(config.fov),canonical(config.aspectRatio),config.inputMode,config.rawRequest,config.ads,canonical(config.adsMultiplier),config.weapon,canonical(config.scopeZoom)];
 if(config.ads&&config.scopeZoom>1&&config.projectionModel)tuple.push(config.projectionModel);
 return `input-v1:${JSON.stringify(tuple)}`;
}
export function validateCalibrationConfig(raw:unknown):CalibrationConfig|null {
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return null;const c=raw as Record<string,unknown>;
 if(c.schema!==1||c.dpiSource!=='user-declared'||!finite(c.dpi,100,32000)||!finite(c.coefficient,.001,1)||!finite(c.fov,1,179)||!finite(c.aspectRatio,.1,10)||typeof c.inputMode!=='string'||c.inputMode.length>64||!['unverified','accepted','fallback','denied'].includes(String(c.rawRequest))||typeof c.ads!=='boolean'||!finite(c.adsMultiplier,.01,10)||typeof c.weapon!=='string'||c.weapon.length>64||!finite(c.scopeZoom,1,20))return null;
 if(c.projectionModel!==undefined&&(typeof c.projectionModel!=='string'||!c.projectionModel.length||c.projectionModel.length>64||!/^[a-zA-Z0-9._-]+$/.test(c.projectionModel)))return null;
 return {schema:1,dpi:c.dpi,dpiSource:'user-declared',coefficient:c.coefficient,fov:c.fov,aspectRatio:c.aspectRatio,inputMode:c.inputMode,rawRequest:c.rawRequest as RawRequest,ads:c.ads,adsMultiplier:c.adsMultiplier,weapon:c.weapon,scopeZoom:c.ads?c.scopeZoom:1,...(c.ads&&c.scopeZoom>1&&c.projectionModel?{projectionModel:c.projectionModel as string}:{})};
}
export function compareCalibration(meta:Pick<AimMeta,'dpi'|'coefficient'|'fov'|'ads'|'adsMultiplier'|'rawMode'> & {inputFingerprint?:string;calibration?:unknown;viewport?:[number,number];weapon?:string;scopeZoom?:number},config:CalibrationConfig,options:{aspectKnown?:boolean}={}) {
 const reasons:string[]=[],unverified:string[]=[],stored=validateCalibrationConfig(meta.calibration);
 if(meta.inputFingerprint){
  let effective=config;
  if(options.aspectKnown===false&&stored){effective={...effective,aspectRatio:stored.aspectRatio};unverified.push('current-measurement-aspect-unknown');}
  // A settings screen cannot know the next pointer-lock grant. Unknown current
  // input status should flag that limitation, not reject every captured trial.
  if(config.inputMode==='unknown'||config.rawRequest==='unverified'){
   let captured=stored;
   if(!captured&&meta.inputFingerprint.startsWith('input-v1:')){try{const v=JSON.parse(meta.inputFingerprint.slice(9));captured=validateCalibrationConfig({schema:1,dpi:v[0],dpiSource:'user-declared',coefficient:v[1],fov:v[2],aspectRatio:v[3],inputMode:v[4],rawRequest:v[5],ads:v[6],adsMultiplier:v[7],weapon:v[8],scopeZoom:v[9],projectionModel:v[10]});}catch{/* Malformed identity is incompatible below. */}}
   if(captured){effective={...effective,inputMode:config.inputMode==='unknown'?captured.inputMode:config.inputMode,rawRequest:config.rawRequest==='unverified'?captured.rawRequest:config.rawRequest};if(config.inputMode==='unknown')unverified.push('current-input-mode-unknown');if(config.rawRequest==='unverified')unverified.push('current-raw-request-unverified');}
  }
  if(meta.inputFingerprint!==calibrationFingerprint(effective))reasons.push('input-configuration-changed');
  if(stored&&meta.inputFingerprint!==calibrationFingerprint(stored))reasons.push('stored-fingerprint-inconsistent');
  return {compatible:!reasons.length,legacy:false,reasons,unverified};
 }
 if(meta.dpi!==config.dpi)reasons.push('dpi-changed');if(Math.abs(meta.coefficient-config.coefficient)>1e-8)reasons.push('coefficient-changed');if(Math.abs(meta.fov-config.fov)>1e-6)reasons.push('fov-changed');
 if(meta.ads!==config.ads||meta.adsMultiplier!==config.adsMultiplier)reasons.push('ads-configuration-changed');if(meta.rawMode!==config.inputMode)reasons.push('input-mode-changed');
 // A legacy profile did not capture raw confirmation and often lacks aspect
 // and scope information. Matching known fields is not sufficient evidence of
 // full configuration compatibility; preserve it for historical viewing only.
 reasons.push('legacy-fingerprint-missing');return {compatible:false,legacy:true,reasons,unverified};
}
export function sensitivityTravel(sensitivity:number,config:Pick<CalibrationConfig,'dpi'|'coefficient'>,angle=180){
 const units=sensitivityUnits(sensitivity,config.dpi,config.coefficient),validAngle=Number.isFinite(angle)&&angle>0&&angle<=360?angle:null;
 return {...units,angle:validAngle,travelCm:units.cm360!==null&&validAngle!==null?units.cm360*validAngle/360:null};
}
export interface PadConstraint {mousepadCm:number;comfortAngle?:number;}
export function constrainSensitivityCandidates(values:readonly number[],config:Pick<CalibrationConfig,'dpi'|'coefficient'>,constraint:PadConstraint){
 const accepted:number[]=[],rejected:{sensitivity:number;requiredCm:number|null;reason:'invalid-sensitivity'|'mousepad-travel'}[]=[];
 const pad=finite(constraint.mousepadCm,.01,300)?constraint.mousepadCm:null,angle=bounded(constraint.comfortAngle,180,1,360);
 const denominator=config.dpi*config.coefficient;
 const minimumSensitivity=pad!==null&&Number.isFinite(denominator)&&denominator>0?angle*2.54/(pad*denominator):null;
 for(const sensitivity of [...new Set(values)]){if(!finite(sensitivity,.01,5)){rejected.push({sensitivity,requiredCm:null,reason:'invalid-sensitivity'});continue;}const requiredCm=sensitivityTravel(sensitivity,config,angle).travelCm;if(pad!==null&&(requiredCm===null||requiredCm>pad+1e-9))rejected.push({sensitivity,requiredCm,reason:'mousepad-travel'});else accepted.push(sensitivity);}
 return {accepted,rejected,minimumSensitivity};
}

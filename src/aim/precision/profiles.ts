import {calibrationFingerprint,validateCalibrationConfig,type CalibrationConfig} from './calibration';
export const CALIBRATION_PROFILES_KEY='valoprac-calibration-profiles-v1',CALIBRATION_PROFILE_LIMIT=20;
export interface CalibrationProfile {id:string;name:string;createdAt:number;updatedAt:number;config:CalibrationConfig;fingerprint:string;sensitivity:number;mousepadCm:number;comfortAngle:number;}
export interface CalibrationProfiles {profiles:CalibrationProfile[];selectedId:string|null;issues:string[];}
type StorageLike=Pick<Storage,'getItem'|'setItem'>;
const finite=(n:unknown,min:number,max:number):n is number=>typeof n==='number'&&Number.isFinite(n)&&n>=min&&n<=max;
const fallbackStorage=()=>typeof localStorage==='undefined'?null:localStorage;
function validProfile(raw:unknown):CalibrationProfile|null {
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return null;const p=raw as Record<string,unknown>,config=validateCalibrationConfig(p.config);
 if(!config||typeof p.id!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(p.id)||typeof p.name!=='string'||!p.name.trim()||p.name.length>80||!finite(p.createdAt,0,8640000000000000)||!finite(p.updatedAt,p.createdAt,8640000000000000)||!finite(p.sensitivity,.01,5)||!finite(p.mousepadCm,0,300)||!finite(p.comfortAngle,1,360))return null;
 return {id:p.id,name:p.name.trim(),createdAt:p.createdAt,updatedAt:p.updatedAt,config,fingerprint:calibrationFingerprint(config),sensitivity:p.sensitivity,mousepadCm:p.mousepadCm,comfortAngle:p.comfortAngle};
}
export function createCalibrationProfile(name:string,config:CalibrationConfig,sensitivity:number,preferences:{mousepadCm?:number;comfortAngle?:number}={},now=Date.now()):CalibrationProfile {
 const value=validProfile({id:globalThis.crypto?.randomUUID?.()??`profile-${now}-${Math.floor(Math.random()*1e9)}`,name:name.trim().slice(0,80)||'입력 프로필',createdAt:now,updatedAt:now,config,sensitivity,mousepadCm:preferences.mousepadCm??0,comfortAngle:preferences.comfortAngle??180});if(!value)throw new Error('입력 프로필의 감도·DPI·시야·패드 값을 확인하세요.');return value;
}
export function loadCalibrationProfiles(storage:StorageLike|null=fallbackStorage()):CalibrationProfiles {
 try{if(!storage)return{profiles:[],selectedId:null,issues:['storage-unavailable']};const text=storage.getItem(CALIBRATION_PROFILES_KEY);if(!text)return{profiles:[],selectedId:null,issues:[]};if(text.length>200000)return{profiles:[],selectedId:null,issues:['profile-data-too-large']};const raw=JSON.parse(text);if(raw?.schema!==1||!Array.isArray(raw.profiles))return{profiles:[],selectedId:null,issues:['invalid-profile-storage']};const ids=new Set<string>(),profiles:CalibrationProfile[]=[],issues:string[]=[];for(const item of raw.profiles.slice(0,CALIBRATION_PROFILE_LIMIT)){const p=validProfile(item);if(p&&!ids.has(p.id)){ids.add(p.id);profiles.push(p);}else issues.push('invalid-profile-skipped');}return{profiles,selectedId:typeof raw.selectedId==='string'&&ids.has(raw.selectedId)?raw.selectedId:null,issues};}catch{return{profiles:[],selectedId:null,issues:['profile-storage-unreadable']};}
}
function write(collection:Pick<CalibrationProfiles,'profiles'|'selectedId'>,storage:StorageLike|null){try{if(!storage)return false;storage.setItem(CALIBRATION_PROFILES_KEY,JSON.stringify({schema:1,profiles:collection.profiles,selectedId:collection.selectedId}));return true;}catch{return false;}}
/** Profile selection is local metadata only. This module never imports the
 * gameplay store or changes camera/settings values. */
export function saveCalibrationProfile(profile:CalibrationProfile,storage:StorageLike|null=fallbackStorage()):boolean {const valid=validProfile(profile);if(!valid)return false;const existing=loadCalibrationProfiles(storage);return write({profiles:[valid,...existing.profiles.filter(p=>p.id!==valid.id)].slice(0,CALIBRATION_PROFILE_LIMIT),selectedId:existing.selectedId},storage);}
export function selectCalibrationProfile(id:string|null,storage:StorageLike|null=fallbackStorage()):boolean {const existing=loadCalibrationProfiles(storage);if(id!==null&&!existing.profiles.some(p=>p.id===id))return false;return write({...existing,selectedId:id},storage);}
export function deleteCalibrationProfile(id:string,storage:StorageLike|null=fallbackStorage()):boolean {const existing=loadCalibrationProfiles(storage);return write({profiles:existing.profiles.filter(p=>p.id!==id),selectedId:existing.selectedId===id?null:existing.selectedId},storage);}
export function exportCalibrationProfiles(storage:StorageLike|null=fallbackStorage()){return {schema:1 as const,exportedAt:new Date().toISOString(),profiles:loadCalibrationProfiles(storage).profiles};}
export function importCalibrationProfiles(input:unknown,storage:StorageLike|null=fallbackStorage()) {
 const issues:string[]=[],existing=loadCalibrationProfiles(storage);let raw:unknown=input;
 if(typeof raw==='string'){if(raw.length>200000)return{imported:0,skipped:0,persisted:false,issues:['profile-data-too-large']};try{raw=JSON.parse(raw);}catch{return{imported:0,skipped:0,persisted:false,issues:['invalid-json']};}}
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||(raw as {schema?:unknown}).schema!==1||!Array.isArray((raw as {profiles?:unknown}).profiles))return{imported:0,skipped:0,persisted:false,issues:['invalid-profile-document']};
 const rows=(raw as {profiles:unknown[]}).profiles;if(rows.length>CALIBRATION_PROFILE_LIMIT)issues.push('profile-limit-applied');const imported:CalibrationProfile[]=[];let skipped=0;const seen=new Set<string>();for(const row of rows.slice(0,CALIBRATION_PROFILE_LIMIT)){const p=validProfile(row);if(p&&!seen.has(p.id)){seen.add(p.id);imported.push(p);}else skipped++;}skipped+=Math.max(0,rows.length-CALIBRATION_PROFILE_LIMIT);if(!imported.length)return{imported:0,skipped,persisted:false,issues:[...issues,'no-valid-profiles']};
 const profiles=[...imported,...existing.profiles.filter(p=>!seen.has(p.id))].slice(0,CALIBRATION_PROFILE_LIMIT),persisted=write({profiles,selectedId:existing.selectedId&&profiles.some(p=>p.id===existing.selectedId)?existing.selectedId:null},storage);if(!persisted)issues.push('profile-storage-write-failed');return{imported:imported.length,skipped,persisted,issues};
}

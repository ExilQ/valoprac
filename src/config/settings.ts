import type { Settings, Quality } from '../engine/types';
export const DEFAULT_SETTINGS: Settings = {
  gameplayRevision:1,aimTelemetry:true,
  practiceMap:'range',drill:'none',crouchMode:'hold',inputDiagnostics:false,adsDotSize:2,botDifficulty:'normal',exposureEnabled:true,exposureLimit:2,exposureMode:'continuous',footstepHud:true,soundMinimap:true,footstepVolume:.7,
  stepPerMeter:.625,stepWalkingGain:0,stepWalkingDecay:.02,stepStationaryDecay:3.5,stepStationaryVelocity:.035,stepStationaryDelay:.12,stepAudibleVelocity:2.7,stepThreshold:1,stepGraceDistance:.2,stepHearingRadius:20,

  frameLimit:0,hudScale:1,showHeadshotConfirmation:true,showControlHints:true,interfaceVolume:0.2,
  adsSensitivity:1,adsMode:'toggle',bindings:{forward:'KeyW',backward:'KeyS',left:'KeyA',right:'KeyD',walk:'ShiftLeft',crouch:'KeyC',jump:'Space',reload:'KeyR',weapons:'KeyB'},
  graphicsPreset:'medium',shadowQuality:'medium',textureQuality:'medium',postProcessing:true,ambientOcclusion:false,effectsQuality:'medium',premiumTheme:true,
  firingVolume:0.85,handlingVolume:0.65,feedbackVolume:0.7,
  targetCount:5,targetSize:1,targetSpeed:1,targetDistance:20,spawnInterval:0.6,eliminationRule:'head',infiniteReserve:true,autoReload:true,practiceHud:true,recoilAnalysis:false,analysisWall:false,
  sensitivity:0.35,degreesPerCount:0.07,dpi:800,fov:103,duration:60,seed:1947,
  crosshairColor:'#e8fcf3',crosshairThickness:2,crosshairGap:5,crosshairLength:7,
  dynamicCrosshair:true,brakingHud:true,idealCompensation:false,volume:0.35,
  renderScale:1,antialias:true,showPerformance:true,behavior:'random'
};
export function sanitizeSettings(raw: unknown): Settings {
  const s={...DEFAULT_SETTINGS,bindings:{...DEFAULT_SETTINGS.bindings}}; if(!raw || typeof raw!=='object')return s;
  const o=raw as Record<string,unknown>;
  if(typeof o.frameLimit==='number'&&[0,60,120,144,165,240].includes(o.frameLimit))s.frameLimit=o.frameLimit;
  if(typeof o.hudScale==='number'&&Number.isFinite(o.hudScale))s.hudScale=Math.max(0.75,Math.min(1.25,o.hudScale));
  if(typeof o.interfaceVolume==='number'&&Number.isFinite(o.interfaceVolume))s.interfaceVolume=Math.max(0,Math.min(1,o.interfaceVolume));
  for(const k of ['showHeadshotConfirmation','showControlHints'] as const)if(typeof o[k]==='boolean')s[k]=o[k];
  const ranges:Partial<Record<keyof Settings,[number,number]>>={adsDotSize:[1,4],exposureLimit:[.5,5],footstepVolume:[0,1],stepPerMeter:[.1,4],stepWalkingGain:[0,.5],stepWalkingDecay:[0,.1],stepStationaryDecay:[.2,4],stepStationaryVelocity:[.001,.1],stepStationaryDelay:[0,.5],stepAudibleVelocity:[2.6,4],stepThreshold:[.5,1],stepGraceDistance:[0,1],stepHearingRadius:[5,40],sensitivity:[0.01,5],degreesPerCount:[0.005,0.3],dpi:[100,32000],fov:[60,120],duration:[15,600],seed:[1,2147483647],crosshairThickness:[1,6],crosshairGap:[0,20],crosshairLength:[1,20],volume:[0,1],renderScale:[0.5,1.5],adsSensitivity:[0.1,2],firingVolume:[0,1],handlingVolume:[0,1],feedbackVolume:[0,1],targetCount:[1,12],targetSize:[0.5,2],targetSpeed:[0,1],targetDistance:[5,32],spawnInterval:[0.1,10]};
  for(const [k,range] of Object.entries(ranges)){const v=o[k];if(typeof v==='number'&&Number.isFinite(v))(s as unknown as Record<string,unknown>)[k]=Math.min(range[1],Math.max(range[0],v));}
  if(['range','tactical','long','garage','site','mid','tower','multi'].includes(String(o.practiceMap)))s.practiceMap=o.practiceMap as Settings['practiceMap'];
  for(const k of ['inputDiagnostics','exposureEnabled','aimTelemetry','footstepHud','soundMinimap','dynamicCrosshair','brakingHud','idealCompensation','antialias','showPerformance','postProcessing','ambientOcclusion','premiumTheme','infiniteReserve','autoReload','practiceHud','recoilAnalysis','analysisWall'] as const)if(typeof o[k]==='boolean')s[k]=o[k];
  if(typeof o.crosshairColor==='string'&&/^#[0-9a-f]{6}$/i.test(o.crosshairColor))s.crosshairColor=o.crosshairColor;
  if(['stationary','strafe','random','stopGo','crouch','peek','appearing','short','long','reactive','wide','mixed'].includes(String(o.behavior)))s.behavior=o.behavior as Settings['behavior'];
  for(const key of ['graphicsPreset','textureQuality','effectsQuality'] as const)if(['low','medium','high','ultra'].includes(String(o[key])))s[key]=o[key] as Quality;
  if(['off','low','medium','high','ultra'].includes(String(o.shadowQuality)))s.shadowQuality=o.shadowQuality as Settings['shadowQuality'];
  if(['none','tapAD','tapDA','release','wide','repeat','stopMoving','corner','vertical','mixed','moving'].includes(String(o.drill)))s.drill=o.drill as Settings['drill'];
  if(['easy','normal','hard'].includes(String(o.botDifficulty)))s.botDifficulty=o.botDifficulty as Settings['botDifficulty'];
  if(o.exposureMode==='continuous'||o.exposureMode==='persistent')s.exposureMode=o.exposureMode;
  if(o.crouchMode==='hold'||o.crouchMode==='toggle')s.crouchMode=o.crouchMode;
  if(o.adsMode==='hold'||o.adsMode==='toggle')s.adsMode=o.adsMode;
  if(['head','any','damage'].includes(String(o.eliminationRule)))s.eliminationRule=o.eliminationRule as Settings['eliminationRule'];
  s.bindings={...DEFAULT_SETTINGS.bindings};
  if(o.bindings&&typeof o.bindings==='object'){
    const b=o.bindings as Record<string,unknown>;const proposed={...s.bindings};
    for(const k of Object.keys(proposed) as (keyof Settings['bindings'])[]){const v=b[k];if(typeof v==='string'&&/^(Key[A-Z]|Digit[04-9]|Space|ShiftLeft|ShiftRight|ControlLeft|ControlRight|AltLeft|AltRight|ArrowUp|ArrowDown|ArrowLeft|ArrowRight)$/.test(v))proposed[k]=v;}
    if(new Set(Object.values(proposed)).size===Object.keys(proposed).length)s.bindings=proposed;
  }
  if(o.gameplayRevision!==1&&o.stepStationaryDecay===1.4)s.stepStationaryDecay=3.5;
  s.targetCount=Math.round(s.targetCount);s.seed=Math.round(s.seed);s.duration=Math.round(s.duration);return s;
}
export const SETTINGS_KEY='tactical-aim-settings-v1';
export function loadSettings(storage?:Pick<Storage,'getItem'>):Settings {try{return sanitizeSettings(JSON.parse((storage??localStorage).getItem(SETTINGS_KEY)??'null'));}catch{return {...DEFAULT_SETTINGS};}}
export function persistSettings(settings:Settings,storage?:Pick<Storage,'setItem'>):boolean{try{(storage??localStorage).setItem(SETTINGS_KEY,JSON.stringify(sanitizeSettings(settings)));return true;}catch{return false;}}

export const GRAPHICS_PRESETS:Record<Quality,Partial<Settings>>={
  low:{graphicsPreset:'low',shadowQuality:'off',textureQuality:'low',postProcessing:false,ambientOcclusion:false,antialias:false,effectsQuality:'low',renderScale:0.8},
  medium:{graphicsPreset:'medium',shadowQuality:'medium',textureQuality:'medium',postProcessing:true,ambientOcclusion:false,antialias:true,effectsQuality:'medium',renderScale:1},
  high:{graphicsPreset:'high',shadowQuality:'high',textureQuality:'high',postProcessing:true,ambientOcclusion:true,antialias:true,effectsQuality:'high',renderScale:1},
  ultra:{graphicsPreset:'ultra',shadowQuality:'ultra',textureQuality:'ultra',postProcessing:true,ambientOcclusion:true,antialias:true,effectsQuality:'ultra',renderScale:1.25}
};

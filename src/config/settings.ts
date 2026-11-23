import {defaultMovementTools,sanitizeMovementTools} from '../training/movementTools/types';
import type { Settings, Quality } from '../engine/types';
import {defaultCrosshairAdvanced,sanitizeCrosshairAdvanced} from './crosshair';
export const CURRENT_SETTINGS_REVISION=2;
export const DEFAULT_SETTINGS: Settings = {
  movementTools:defaultMovementTools(),
  movementPhysics:'valorant',csMovementPreset:'cs2',physicsDiagnostics:false,wheelJump:'off',
  combatMode:'gunfight',defenderSkill:'normal',defenderAimSpeed:180,defenderAimAcceleration:1200,defenderStability:.7,defenderFirstShotError:.8,defenderRecoilControl:.6,defenderTactics:.55,botDiagnostics:false,jumpBufferMs:80,penetrationDiagnostics:false,
  gameplayRevision:CURRENT_SETTINGS_REVISION,aimTelemetry:true,peekingTimed:false,operatorScopeMode:'toggle',operatorAutoRescope:false,operatorZoomBinding:'KeyV',peekScenario:'free',defenderWeapon:'mixed',defenderReaction:.42,defenderAccuracy:.75,defenderReposition:.45,randomDefenders:true,
  practiceMap:'range',drill:'none',crouchMode:'hold',inputDiagnostics:false,adsDotSize:2,botDifficulty:'normal',exposureEnabled:true,exposureLimit:3,exposureMode:'continuous',footstepHud:true,soundMinimap:true,footstepVolume:.7,
  stepPerMeter:.625,stepWalkingGain:0,stepWalkingDecay:.02,stepStationaryDecay:3.5,stepStationaryVelocity:.035,stepStationaryDelay:.12,stepAudibleVelocity:2.7,stepThreshold:1,stepGraceDistance:.2,stepHearingRadius:20,

  frameLimit:0,hudScale:1,showHeadshotConfirmation:true,showControlHints:true,interfaceVolume:0.2,
  adsSensitivity:1,scopeSensitivity25:1,scopeSensitivity5:1,autoGraphics:true,adsMode:'toggle',bindings:{forward:'KeyW',backward:'KeyS',left:'KeyA',right:'KeyD',walk:'ShiftLeft',crouch:'KeyC',jump:'Space',reload:'KeyR',weapons:'KeyB'},
  graphicsPreset:'medium',shadowQuality:'medium',textureQuality:'medium',postProcessing:true,ambientOcclusion:false,effectsQuality:'medium',premiumTheme:true,
  firingVolume:0.85,handlingVolume:0.65,feedbackVolume:0.7,
  targetCount:5,targetSize:1,targetSpeed:1,targetDistance:20,spawnInterval:0.6,eliminationRule:'head',infiniteReserve:true,autoReload:true,practiceHud:true,recoilAnalysis:false,analysisWall:false,
  sensitivity:0.35,degreesPerCount:0.07,dpi:800,fov:103,duration:60,seed:1947,
  crosshairColor:'#e8fcf3',crosshairThickness:2,crosshairGap:5,crosshairLength:7,
  crosshairAdvanced:defaultCrosshairAdvanced(),
  dynamicCrosshair:true,brakingHud:true,idealCompensation:false,volume:0.35,
  renderScale:1,antialias:true,showPerformance:true,behavior:'random'
};
const storedRevision=(o:Record<string,unknown>)=>typeof o.gameplayRevision==='number'&&Number.isSafeInteger(o.gameplayRevision)&&o.gameplayRevision>=0?o.gameplayRevision:0;
export function sanitizeSettings(raw: unknown): Settings {
  const s={...DEFAULT_SETTINGS,bindings:{...DEFAULT_SETTINGS.bindings},crosshairAdvanced:defaultCrosshairAdvanced(),movementTools:defaultMovementTools()}; if(!raw || typeof raw!=='object')return s;
  const o=raw as Record<string,unknown>,revision=storedRevision(o);
  // A future client may already have written a newer revision. Never turn that
  // profile back into an old migration candidate when saving supported fields.
  s.gameplayRevision=Math.max(CURRENT_SETTINGS_REVISION,revision);
  if(typeof o.frameLimit==='number'&&[0,60,120,144,165,240].includes(o.frameLimit))s.frameLimit=o.frameLimit;
  if(typeof o.hudScale==='number'&&Number.isFinite(o.hudScale))s.hudScale=Math.max(0.75,Math.min(1.25,o.hudScale));
  if(typeof o.interfaceVolume==='number'&&Number.isFinite(o.interfaceVolume))s.interfaceVolume=Math.max(0,Math.min(1,o.interfaceVolume));
  for(const k of ['showHeadshotConfirmation','showControlHints'] as const)if(typeof o[k]==='boolean')s[k]=o[k];
  const ranges:Partial<Record<keyof Settings,[number,number]>>={defenderAimSpeed:[30,480],defenderAimAcceleration:[100,4000],defenderStability:[.1,.98],defenderFirstShotError:[.05,4],defenderRecoilControl:[0,.98],defenderTactics:[0,1],jumpBufferMs:[0,140],defenderReaction:[.15,1.5],defenderAccuracy:[.1,.98],defenderReposition:[0,1],adsDotSize:[1,4],exposureLimit:[.5,5],footstepVolume:[0,1],stepPerMeter:[.1,4],stepWalkingGain:[0,.5],stepWalkingDecay:[0,.1],stepStationaryDecay:[.2,4],stepStationaryVelocity:[.001,.1],stepStationaryDelay:[0,.5],stepAudibleVelocity:[2.6,4],stepThreshold:[.5,1],stepGraceDistance:[0,1],stepHearingRadius:[5,40],sensitivity:[0.01,5],degreesPerCount:[0.005,0.3],dpi:[100,32000],fov:[60,120],duration:[15,600],seed:[1,2147483647],crosshairThickness:[1,6],crosshairGap:[0,20],crosshairLength:[0,20],volume:[0,1],renderScale:[0.5,1.5],adsSensitivity:[0.1,2],scopeSensitivity25:[0.1,2],scopeSensitivity5:[0.1,2],firingVolume:[0,1],handlingVolume:[0,1],feedbackVolume:[0,1],targetCount:[1,12],targetSize:[0.5,2],targetSpeed:[0,1],targetDistance:[5,32],spawnInterval:[0.1,10]};
  for(const [k,range] of Object.entries(ranges)){const v=o[k];if(typeof v==='number'&&Number.isFinite(v))(s as unknown as Record<string,unknown>)[k]=Math.min(range[1],Math.max(range[0],v));}
  // Preserve the former shared scoped preference when new independent fields
  // were absent; explicit new per-zoom values always win.
  if(typeof o.scopeSensitivity25!=='number'||!Number.isFinite(o.scopeSensitivity25))s.scopeSensitivity25=s.adsSensitivity;
  if(typeof o.scopeSensitivity5!=='number'||!Number.isFinite(o.scopeSensitivity5))s.scopeSensitivity5=s.adsSensitivity;
  if(['range','tactical','long','garage','site','mid','tower','multi','complex','bunny','wallbang'].includes(String(o.practiceMap)))s.practiceMap=o.practiceMap as Settings['practiceMap'];
  for(const k of ['autoGraphics','physicsDiagnostics','botDiagnostics','penetrationDiagnostics','peekingTimed','operatorAutoRescope','randomDefenders','inputDiagnostics','exposureEnabled','aimTelemetry','footstepHud','soundMinimap','dynamicCrosshair','brakingHud','idealCompensation','antialias','showPerformance','postProcessing','ambientOcclusion','premiumTheme','infiniteReserve','autoReload','practiceHud','recoilAnalysis','analysisWall'] as const)if(typeof o[k]==='boolean')s[k]=o[k];
  if(o.movementPhysics==='valorant'||o.movementPhysics==='counterStrike')s.movementPhysics=o.movementPhysics;
  if(o.csMovementPreset==='cs2'||o.csMovementPreset==='sourceClassic')s.csMovementPreset=o.csMovementPreset;
  if(['off','up','down'].includes(String(o.wheelJump)))s.wheelJump=o.wheelJump as Settings['wheelJump'];
  if(typeof o.crosshairColor==='string'&&/^#[0-9a-f]{6}$/i.test(o.crosshairColor))s.crosshairColor=o.crosshairColor;
  s.crosshairAdvanced=sanitizeCrosshairAdvanced(o.crosshairAdvanced);
  if(['learning','gunfight','exposure'].includes(String(o.combatMode)))s.combatMode=o.combatMode as Settings['combatMode'];
  if(['beginner','normal','advanced','expert'].includes(String(o.defenderSkill)))s.defenderSkill=o.defenderSkill as Settings['defenderSkill'];
  else if(o.botDifficulty==='easy')s.defenderSkill='beginner';else if(o.botDifficulty==='hard')s.defenderSkill='advanced';
  if(['stationary','strafe','random','stopGo','crouch','peek','appearing','short','long','reactive','wide','mixed'].includes(String(o.behavior)))s.behavior=o.behavior as Settings['behavior'];
  for(const key of ['graphicsPreset','textureQuality','effectsQuality'] as const)if(['low','medium','high','ultra'].includes(String(o[key])))s[key]=o[key] as Quality;
  if(['off','low','medium','high','ultra'].includes(String(o.shadowQuality)))s.shadowQuality=o.shadowQuality as Settings['shadowQuality'];
  if(['none','tapAD','tapDA','release','wide','repeat','stopMoving','corner','vertical','mixed','moving','bunny','wallbang'].includes(String(o.drill)))s.drill=o.drill as Settings['drill'];
  if(['easy','normal','hard'].includes(String(o.botDifficulty)))s.botDifficulty=o.botDifficulty as Settings['botDifficulty'];
  if(o.exposureMode==='continuous'||o.exposureMode==='persistent')s.exposureMode=o.exposureMode;
  if(o.crouchMode==='hold'||o.crouchMode==='toggle')s.crouchMode=o.crouchMode;
  if(o.operatorScopeMode==='hold'||o.operatorScopeMode==='toggle')s.operatorScopeMode=o.operatorScopeMode;
  if(['free','wide','shoulder','jiggle','crouch','jump','vertical','slicing','operator','mixed'].includes(String(o.peekScenario)))s.peekScenario=o.peekScenario as Settings['peekScenario'];
  if(['mixed','operator','rifleA','rifleB','sheriff'].includes(String(o.defenderWeapon)))s.defenderWeapon=o.defenderWeapon as Settings['defenderWeapon'];
  if(o.adsMode==='hold'||o.adsMode==='toggle')s.adsMode=o.adsMode;
  if(['head','any','damage'].includes(String(o.eliminationRule)))s.eliminationRule=o.eliminationRule as Settings['eliminationRule'];
  s.bindings={...DEFAULT_SETTINGS.bindings};
  if(o.bindings&&typeof o.bindings==='object'){
    const b=o.bindings as Record<string,unknown>;const proposed={...s.bindings};
    for(const k of Object.keys(proposed) as (keyof Settings['bindings'])[]){const v=b[k];if(typeof v==='string'&&/^(Key[A-Z]|Digit[05-9]|Space|ShiftLeft|ShiftRight|ControlLeft|ControlRight|AltLeft|AltRight|ArrowUp|ArrowDown|ArrowLeft|ArrowRight)$/.test(v))proposed[k]=v;}
    if(new Set(Object.values(proposed)).size===Object.keys(proposed).length)s.bindings=proposed;
  }
  // 3.x stored no revision and used CtrlLeft + Hold as its defaults. Revision 1
  // unfortunately stamped legacy profiles without updating those controls.
  // Only its exact legacy pair is migrated; C/custom crouch + Hold and
  // CtrlLeft + Toggle may represent deliberate revision-1 choices and stay.
  // The old data cannot distinguish an intentional CtrlLeft/Hold pair from a
  // carried-over default. Revision 2 is the one-time boundary: every explicit
  // choice made after it (including CtrlLeft and Hold) is preserved unchanged.
  const legacyBindings=o.bindings&&typeof o.bindings==='object'?o.bindings as Record<string,unknown>:null;
  const migrateControls=revision<1||(revision===1&&legacyBindings?.crouch==='ControlLeft'&&o.adsMode==='hold');
  if(migrateControls){
    if(legacyBindings?.crouch==='ControlLeft'&&s.bindings.crouch==='ControlLeft'){
      const occupied=new Set(Object.entries(s.bindings).filter(([action])=>action!=='crouch').map(([,key])=>key));
      occupied.add(typeof o.operatorZoomBinding==='string'&&/^Key[A-Z]$/.test(o.operatorZoomBinding)?o.operatorZoomBinding:'KeyV');
      // Respect an existing custom action on C rather than resetting all keys.
      s.bindings.crouch=['KeyC','KeyX','KeyZ',...Array.from('ABCDEFGHIJKLMNOPQRSTUVWXYZ',c=>`Key${c}`)].find(key=>!occupied.has(key))!;
    }
    if(o.adsMode==='hold')s.adsMode='toggle';
  }
  // Resolve the optional sniper key after user movement/reload bindings. The
  // fallback must also remain available when an older profile already uses V.
  const used=new Set(Object.values(s.bindings));
  const desired=typeof o.operatorZoomBinding==='string'&&/^Key[A-Z]$/.test(o.operatorZoomBinding)?o.operatorZoomBinding:'KeyV';
  s.operatorZoomBinding=!used.has(desired)?desired:['KeyV','KeyN','KeyM',...Array.from('ABCDEFGHIJKLMNOPQRSTUVWXYZ',c=>`Key${c}`)].find(key=>!used.has(key))!;
  if(revision<1&&o.stepStationaryDecay===1.4)s.stepStationaryDecay=3.5;
  s.movementTools=sanitizeMovementTools(o.movementTools,[...Object.values(s.bindings),s.operatorZoomBinding]);
  s.targetCount=Math.round(s.targetCount);s.seed=Math.round(s.seed);s.duration=Math.round(s.duration);return s;
}
export const SETTINGS_KEY='tactical-aim-settings-v1';
export function loadSettings(storage?:Pick<Storage,'getItem'>&Partial<Pick<Storage,'setItem'>>):Settings {
  try{
    const target=storage??localStorage,raw=JSON.parse(target.getItem(SETTINGS_KEY)??'null'),settings=sanitizeSettings(raw);
    if(raw&&typeof raw==='object'&&!Array.isArray(raw)&&storedRevision(raw)<CURRENT_SETTINGS_REVISION&&typeof target.setItem==='function'){
      // Persist the boundary once. A blocked/quota-limited store must not discard
      // the successfully migrated sensitivity, bindings or other preferences.
      try{target.setItem(SETTINGS_KEY,JSON.stringify(settings));}catch{/* Use the migrated in-memory profile. */}
    }
    return settings;
  }catch{return sanitizeSettings(null);}
}
export function persistSettings(settings:Settings,storage?:Pick<Storage,'setItem'>):boolean{try{(storage??localStorage).setItem(SETTINGS_KEY,JSON.stringify(sanitizeSettings(settings)));return true;}catch{return false;}}

export const GRAPHICS_PRESETS:Record<Quality,Partial<Settings>>={
  low:{graphicsPreset:'low',shadowQuality:'off',textureQuality:'low',postProcessing:false,ambientOcclusion:false,antialias:false,effectsQuality:'low',renderScale:0.8},
  medium:{graphicsPreset:'medium',shadowQuality:'medium',textureQuality:'medium',postProcessing:true,ambientOcclusion:false,antialias:true,effectsQuality:'medium',renderScale:1},
  high:{graphicsPreset:'high',shadowQuality:'high',textureQuality:'high',postProcessing:true,ambientOcclusion:true,antialias:true,effectsQuality:'high',renderScale:1},
  ultra:{graphicsPreset:'ultra',shadowQuality:'ultra',textureQuality:'ultra',postProcessing:true,ambientOcclusion:true,antialias:true,effectsQuality:'ultra',renderScale:1.25}
};

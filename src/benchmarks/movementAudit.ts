import {Simulation} from '../engine/simulation/Simulation';
import {DEFAULT_SETTINGS} from '../config/settings';
import {emptyInput,type InputState,type WeaponId} from '../engine/types';
import type {SimulationRulesId} from '../engine/simulation/rules';

/** Deterministic measurement of the shipped simulation: every number is read
 * from the 120 Hz authority (positions after collision), never from formulas. */
export const AUDIT_DT=1/120;
export type AuditState='run'|'walk'|'crouch'|'crouchWalk'|'backward'|'strafe'|'diagonal'|'ads'|'adsWalk';
export const AUDIT_STATES:readonly AuditState[]=['run','walk','crouch','crouchWalk','backward','strafe','diagonal','ads','adsWalk'];
export const AUDIT_WEAPONS:readonly WeaponId[]=['rifleA','rifleB','sheriff','operator','knife'];
const inputFor=(state:AuditState):Partial<InputState>=>({
 forward:state==='backward'?-1:state==='strafe'?0:1,strafe:state==='strafe'||state==='diagonal'?1:0,
 walk:state==='walk'||state==='crouchWalk'||state==='adsWalk',crouch:state==='crouch'||state==='crouchWalk',ads:state==='ads'||state==='adsWalk'}) as Partial<InputState>;
/** View yaw that makes each input travel along -z, the range's 38 m clear lane. */
const LANE_YAW:Record<AuditState,number>={run:0,walk:0,crouch:0,crouchWalk:0,ads:0,adsWalk:0,backward:Math.PI,strafe:Math.PI/2,diagonal:Math.PI/4};
function arena(weapon:WeaponId,rules?:SimulationRulesId,yaw=0){
 // The practice range's centre lane (x=0, z 9 → -29.7) has no cover in it.
 const s=new Simulation('free',weapon,{...structuredClone(DEFAULT_SETTINGS),practiceMap:'range' as never,behavior:'stationary',targetCount:1,footstepHud:true},{},rules);
 s.running=true;s.yaw=yaw;s.movement.position.set(0,0,9);s.movement.previous.copy(s.movement.position);
 for(let n=0;n<Math.round(2/AUDIT_DT);n++)s.step(AUDIT_DT,emptyInput());
 s.footsteps.resetEncounter();return s;
}
const r=(v:number,d=3)=>Number.isFinite(v)?Math.round(v*10**d)/10**d:null;
export interface SpeedRow {weapon:WeaponId;state:AuditState;steadySpeed:number|null;timeTo90:number|null;timeTo99:number|null;stopToAccurate:number|null;stopToRest:number|null;footsteps:{audible:boolean;audibleAbove:number|null;firstStepSeconds:number|null;firstStepMeters:number|null;intervalMeters:number|null;intervalSeconds:number|null;stepsPerSecond:number|null;maxGauge:number|null};}
export function measureState(weapon:WeaponId,state:AuditState,rules?:SimulationRulesId):SpeedRow{
 const s=arena(weapon,rules,LANE_YAW[state]),input={...emptyInput(),...inputFor(state)};
 if(state==='crouch'||state==='crouchWalk')for(let n=0;n<60;n++)s.step(AUDIT_DT,{...emptyInput(),crouch:true});
 // The Operator scopes with a press (toggle mode); the others aim while held.
 if(state==='ads'||state==='adsWalk')for(let n=0;n<Math.round(1.6/AUDIT_DT);n++)s.step(AUDIT_DT,{...emptyInput(),ads:true,scopePresses:n===0?1:0});
 s.footsteps.resetEncounter();
 const t0=s.time,start={x:s.movement.position.x,z:s.movement.position.z},speeds:number[]=[],events:{t:number;d:number}[]=[];let maxGauge=0;
 s.onFootstep=e=>events.push({t:e.timestamp,d:Math.hypot(e.position.x-start.x,e.position.z-start.z)});
 const seconds=3;for(let n=0;n<Math.round(seconds/AUDIT_DT);n++){s.step(AUDIT_DT,input);speeds.push(s.footsteps.actualSpeed);maxGauge=Math.max(maxGauge,s.footsteps.footstepAccumulation);}
 const steady=speeds.slice(-60).reduce((a,b)=>a+b,0)/60,first=(f:number)=>{const i=speeds.findIndex(v=>v>=steady*f);return i<0?NaN:(i+1)*AUDIT_DT;};
 const later=events.filter(e=>e.t-t0>1.2),interval=later.length>1?(later.at(-1)!.d-later[0].d)/(later.length-1):NaN,intervalT=later.length>1?(later.at(-1)!.t-later[0].t)/(later.length-1):NaN;
 const release={...input,forward:0,strafe:0};let accurate=NaN,rest=NaN;
 for(let n=0;n<240;n++){s.step(AUDIT_DT,release);const v=s.footsteps.actualSpeed;if(Number.isNaN(accurate)&&v<=s.movement.profile.accuracyVelocityThreshold)accurate=(n+1)*AUDIT_DT;if(v<=.035){rest=(n+1)*AUDIT_DT;break;}}
 return{weapon,state,steadySpeed:r(steady),timeTo90:r(first(.9)),timeTo99:r(first(.99)),stopToAccurate:r(accurate),stopToRest:r(rest),
  footsteps:{audible:events.length>0,audibleAbove:r(s.footstepAudibleVelocity),firstStepSeconds:events.length?r(events[0].t-t0):null,firstStepMeters:events.length?r(events[0].d):null,intervalMeters:r(interval),intervalSeconds:r(intervalT),stepsPerSecond:Number.isFinite(intervalT)?r(1/intervalT,2):null,maxGauge:r(maxGauge)}};
}
export interface JumpRow {weapon:WeaponId;variant:string;apexFeet:number|null;apexEyes:number|null;airtime:number|null;landingImpact:number|null;landingSounds:number;takeoffSounds:number;horizontalSpeedAtLanding:number|null;}
/** Jump variants: `crouchLeadMs` is how long crouch is held before Space (negative: crouch after Space). */
export function measureJump(weapon:WeaponId,variant:{name:string;forward:boolean;crouchLeadMs:number|null;crouchHold:boolean},rules?:SimulationRulesId):JumpRow{
 const s=arena(weapon,rules),lands:number[]=[],takeoffs:number[]=[];s.onLanding=e=>lands.push(e.impactSpeed);s.onJump=()=>takeoffs.push(1);
 const lead=variant.crouchLeadMs===null?null:Math.round(variant.crouchLeadMs/1000/AUDIT_DT);
 if(variant.forward)for(let n=0;n<120;n++)s.step(AUDIT_DT,{...emptyInput(),forward:1});
 const pre=lead!==null&&lead>0?lead:0;for(let n=0;n<pre;n++)s.step(AUDIT_DT,{...emptyInput(),forward:variant.forward?1:0,crouch:true});
 const y0=s.movement.position.y,eye0=y0+s.movement.eyeHeight;let air=false,landed=NaN,apex=0,apexEye=0,t0=s.time,speed=NaN;
 for(let n=0;n<240;n++){const crouch=lead===null?false:lead>=0?(variant.crouchHold||n<2):n>=-lead&&(variant.crouchHold||n< -lead+2);
  s.step(AUDIT_DT,{...emptyInput(),forward:variant.forward?1:0,jump:n===0,jumpHeld:n<3,jumpPresses:n===0?1:0,crouch});
  if(!s.movement.grounded)air=true;apex=Math.max(apex,s.movement.position.y-y0);apexEye=Math.max(apexEye,s.movement.position.y+s.movement.eyeHeight-eye0);
  if(air&&s.movement.grounded){landed=s.movement.lastLandingTime-t0;speed=s.movement.speed;break;}}
 return{weapon,variant:variant.name,apexFeet:r(apex),apexEyes:r(apexEye),airtime:r(landed),landingImpact:lands.length?r(lands[0],2):null,landingSounds:lands.length,takeoffSounds:takeoffs.length,horizontalSpeedAtLanding:r(speed)};
}
export const JUMP_VARIANTS=[
 {name:'standing',forward:false,crouchLeadMs:null,crouchHold:false},
 {name:'running',forward:true,crouchLeadMs:null,crouchHold:false},
 {name:'crouch-same-tick',forward:false,crouchLeadMs:0,crouchHold:true},
 {name:'crouch-94ms-before',forward:false,crouchLeadMs:94,crouchHold:true},
 {name:'crouch-102ms-before',forward:false,crouchLeadMs:102,crouchHold:true},
 {name:'crouched-before',forward:false,crouchLeadMs:500,crouchHold:true},
 {name:'crouch-in-air-100ms',forward:false,crouchLeadMs:-100,crouchHold:true},
] as const;

export interface GaugeRow {weapon:WeaponId;scenario:string;value:number|null;unit:string;}
/** Footstep gauge dynamics: fill rate, retention and recovery, read from the
 * same Footsteps state the HUD shows. */
export function measureGauge(weapon:WeaponId,rules?:SimulationRulesId):GaugeRow[]{
 const rows:GaugeRow[]=[],run={...emptyInput(),forward:1},walk={...run,walk:true},idle=emptyInput();
 const fill=(s:ReturnType<typeof arena>,target:number)=>{for(let n=0;n<600&&s.footsteps.footstepAccumulation<target;n++)s.step(AUDIT_DT,run);};
 // Gauge per metre of fast movement and the grace before it starts.
 {const s=arena(weapon,rules),x=s.movement.position.z;let started=NaN;for(let n=0;n<600;n++){s.step(AUDIT_DT,run);if(Number.isNaN(started)&&s.footsteps.footstepAccumulation>0)started=Math.abs(s.movement.position.z-x);if(s.footsteps.footstepAccumulation>=.5)break;}
  rows.push({weapon,scenario:'distance before the gauge moves',value:r(started),unit:'m'});}
 // Stop at 90 %: time until the gauge is empty again.
 {const s=arena(weapon,rules);fill(s,.9);const t0=s.time;let empty=NaN;for(let n=0;n<240;n++){s.step(AUDIT_DT,idle);if(s.footsteps.footstepAccumulation<=1e-9){empty=s.time-t0;break;}}
  rows.push({weapon,scenario:'stop at 90 % → gauge empty',value:r(empty),unit:'s'});}
 // Switch to walking at 90 %: gauge retained after 2 s of walking, and steps during the slowdown.
 {const s=arena(weapon,rules);fill(s,.9);const before=s.footsteps.totalEvents;for(let n=0;n<240;n++)s.step(AUDIT_DT,walk);
  rows.push({weapon,scenario:'run → walk at 90 %: gauge after 2 s walking',value:r(s.footsteps.footstepAccumulation),unit:'gauge'});
  rows.push({weapon,scenario:'run → walk at 90 %: steps while slowing down',value:s.footsteps.totalEvents-before,unit:'steps'});}
 // Shortest tap from rest that makes a sound (whole ticks of forward input, then stop).
 {let shortest=NaN;for(let ticks=1;ticks<120&&Number.isNaN(shortest);ticks++){const s=arena(weapon,rules);for(let n=0;n<ticks;n++)s.step(AUDIT_DT,run);for(let n=0;n<60;n++)s.step(AUDIT_DT,idle);if(s.footsteps.totalEvents>0)shortest=ticks*AUDIT_DT;}
  rows.push({weapon,scenario:'shortest forward tap from rest that is heard',value:r(shortest),unit:'s'});}
 return rows;
}

import {Simulation} from '../engine/simulation/Simulation';
import {DEFAULT_SETTINGS} from '../config/settings';
import {emptyInput,type InputState,type WeaponId} from '../engine/types';
import type {SimulationRulesId} from '../engine/simulation/rules';

/** Exhaustive jump scenarios on flat ground, read from the 120 Hz authority. */
export const PHYSICS_DT=1/120;
export type Takeoff='still'|'run'|'strafe'|'diagonal'|'backward'|'walk'|'crouchRun'|'crouchSame'|'ads'|'adsWalk';
export type AirAction='none'|'crouch'|'crouchThenStand'|'stand'|'walk'|'ads'|'release'|'switch'|'scope';
export const TAKEOFFS:readonly Takeoff[]=['still','run','strafe','diagonal','backward','walk','crouchRun','crouchSame','ads','adsWalk'];
export const AIR_ACTIONS:readonly AirAction[]=['none','crouch','crouchThenStand','stand','walk','ads','release','switch','scope'];
export const PHYSICS_WEAPONS:readonly WeaponId[]=['rifleA','sheriff','operator','knife'];
const LANE_YAW:Record<string,number>={strafe:Math.PI/2,diagonal:Math.PI/4,backward:Math.PI};
export interface JumpCase {weapon:WeaponId;takeoff:Takeoff;air:AirAction;groundSpeed:number;takeoffSpeed:number;minAir:number;maxAir:number;landingSpeed:number;impact:number|null;landingSounds:number;jumpSounds:number;airtime:number;}
const r=(v:number)=>Math.round(v*1e4)/1e4;
export function jumpCase(weapon:WeaponId,takeoff:Takeoff,air:AirAction,rules?:SimulationRulesId):JumpCase{
 const s=new Simulation('free',weapon,{...structuredClone(DEFAULT_SETTINGS),practiceMap:'range' as never,behavior:'stationary',targetCount:1},{},rules);
 s.running=true;s.yaw=LANE_YAW[takeoff]??0;s.movement.position.set(0,0,9);s.movement.previous.copy(s.movement.position);
 const lands:number[]=[];let jumps=0;s.onLanding=e=>lands.push(e.impactSpeed);s.onJump=()=>jumps++;
 const moving=takeoff!=='still';
 const base=():Partial<InputState>=>({forward:!moving?0:takeoff==='backward'?-1:takeoff==='strafe'?0:1,strafe:takeoff==='strafe'||takeoff==='diagonal'?1:0,
  walk:takeoff==='walk'||takeoff==='adsWalk',crouch:takeoff==='crouchRun',ads:takeoff==='ads'||takeoff==='adsWalk'});
 const step=(i:Partial<InputState>)=>s.step(PHYSICS_DT,{...emptyInput(),...i});
 // Equip, then (for the Operator) scope with a press; then reach steady speed.
 for(let n=0;n<90;n++)step({});
 if(weapon==='operator'&&(takeoff==='ads'||takeoff==='adsWalk'))step({scopePresses:1});
 for(let n=0;n<150;n++)step(base());
 const groundSpeed=s.movement.speed,t0=s.time;let takeoffSpeed=NaN,minAir=Infinity,maxAir=0,landed=false,landingSpeed=NaN,n=0,airborne=false;
 for(;n<200&&!landed;n++){
  const i:Partial<InputState>={...base(),jump:n===0,jumpHeld:n<2,jumpPresses:n===0?1:0};
  if(takeoff==='crouchSame'&&n===0)i.crouch=true;
  const t=n*PHYSICS_DT,inAir=airborne;
  if(inAir){
   if(air==='crouch'&&t>=.1)i.crouch=true;
   if(air==='crouchThenStand'){i.crouch=t<.3;}
   if(air==='stand')i.crouch=false;
   if(air==='walk'&&t>=.1)i.walk=true;
   if(air==='ads'&&t>=.1){i.ads=true;if(weapon==='operator'&&Math.abs(t-.1)<PHYSICS_DT/2)i.scopePresses=1;}
   if(air==='release'&&t>=.1){i.forward=0;i.strafe=0;}
   if(air==='scope'&&Math.abs(t-.1)<PHYSICS_DT/2)i.scopePresses=1;
  }
  if(takeoff==='crouchSame'||takeoff==='crouchRun')if(air==='none'||air==='crouch')i.crouch=true;
  if(air==='switch'&&inAir&&Math.abs(t-.1)<PHYSICS_DT/2)s.switchWeapon(weapon==='knife'?'rifleA':'knife');
  step(i);
  if(!s.movement.grounded&&!airborne){airborne=true;takeoffSpeed=s.movement.speed;}
  if(airborne&&!s.movement.grounded){minAir=Math.min(minAir,s.movement.speed);maxAir=Math.max(maxAir,s.movement.speed);}
  if(airborne&&s.movement.grounded){landed=true;landingSpeed=s.movement.speed;}
 }
 return{weapon,takeoff,air,groundSpeed:r(groundSpeed),takeoffSpeed:r(takeoffSpeed),minAir:r(minAir),maxAir:r(maxAir),landingSpeed:r(landingSpeed),impact:lands.length?r(lands[0]):null,landingSounds:lands.length,jumpSounds:jumps,airtime:r(s.time-t0)};
}

export type GroundState='run'|'walk'|'crouch'|'crouchWalk'|'ads'|'adsWalk'|'still';
export const GROUND_STATES:readonly GroundState[]=['still','run','walk','crouch','crouchWalk','ads','adsWalk'];
const groundInput=(g:GroundState):Partial<InputState>=>({forward:g==='still'?0:1,walk:g==='walk'||g==='crouchWalk'||g==='adsWalk',crouch:g==='crouch'||g==='crouchWalk',ads:g==='ads'||g==='adsWalk'});
/** Steady ground speed after `from` then `to`: it must not depend on `from`. */
export function groundPath(weapon:WeaponId,from:GroundState,to:GroundState,rules?:SimulationRulesId,switchTo?:WeaponId){
 const s=new Simulation('free',weapon,{...structuredClone(DEFAULT_SETTINGS),practiceMap:'range' as never,behavior:'stationary',targetCount:1},{},rules);
 s.running=true;s.movement.position.set(0,0,9);s.movement.previous.copy(s.movement.position);
 const step=(i:Partial<InputState>)=>s.step(PHYSICS_DT,{...emptyInput(),...i});
 for(let n=0;n<90;n++)step({});
 const scoped=weapon==='operator';
 // The Operator scope cycles 2.5x, 5x, off with each press: press until the state matches.
 const go=(g:GroundState,ticks:number)=>{const wantScope=scoped&&(g==='ads'||g==='adsWalk');for(let n=0;n<ticks;n++){const i=groundInput(g);if(scoped&&n%12===0&&n<48&&s.ads!==wantScope)i.scopePresses=1;step(i);}};
 go(from,120);if(switchTo){s.switchWeapon(switchTo);for(let n=0;n<90;n++)step(groundInput(from));}go(to,150);
 return r(s.movement.speed);
}
/** Perfectly timed chained hops while holding forward: speeds after each landing. */
export function hopChain(weapon:WeaponId,hops:number,rules?:SimulationRulesId){
 const s=new Simulation('free',weapon,{...structuredClone(DEFAULT_SETTINGS),practiceMap:'range' as never,behavior:'stationary',targetCount:1},{},rules);
 s.running=true;s.movement.position.set(0,0,9);s.movement.previous.copy(s.movement.position);
 const step=(i:Partial<InputState>)=>s.step(PHYSICS_DT,{...emptyInput(),...i});
 for(let n=0;n<90;n++)step({});for(let n=0;n<60;n++)step({forward:1});
 const speeds:number[]=[];let pending=true;
 for(let n=0;n<240*hops&&speeds.length<hops;n++){
  const before=s.movement.grounded;step({forward:1,jump:pending,jumpHeld:pending,jumpPresses:pending?1:0});pending=false;
  // Land, then press jump on the next tick (8 ms, inside the chain window).
  if(!before&&s.movement.grounded){speeds.push(r(s.movement.speed));pending=true;}
 }
 return speeds;
}

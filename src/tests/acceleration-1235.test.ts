import {describe,expect,it} from 'vitest';
import {Simulation} from '../engine/simulation/Simulation';
import {DEFAULT_SETTINGS} from '../config/settings';
import {emptyInput,type InputState,type WeaponId} from '../engine/types';
import {RECOVERY_GROUND_ACCELERATION} from '../engine/simulation/consistencyRules';
import {MOVEMENT} from '../config/movement';
import {ReplayRecorder} from '../engine/replay/recording';
import {ReplayPlayer} from '../engine/replay/playback';
import type {SimulationRulesId} from '../engine/simulation/rules';

const DT=1/120;
const make=(weapon:WeaponId='rifleA',rules?:SimulationRulesId)=>{const s=new Simulation('free',weapon,{...structuredClone(DEFAULT_SETTINGS),practiceMap:'range' as never},{},rules);s.running=true;s.movement.position.set(0,0,9);s.movement.previous.copy(s.movement.position);for(let n=0;n<90;n++)s.step(DT,emptyInput());return s;};
/** Milliseconds until speed reaches `fraction` of `target` while holding `input`. */
const reach=(s:Simulation,input:Partial<InputState>,target:number,fraction:number)=>{for(let n=1;n<=240;n++){s.step(DT,{...emptyInput(),...input});if(s.movement.speed>=target*fraction-1e-9)return n*DT*1000;}return Infinity;};
/** Milliseconds until speed drops to `limit` after releasing (or counter-strafing) a full-speed strafe. */
const stop=(rules:SimulationRulesId|undefined,counter:boolean,limit:number)=>{const s=make('rifleB',rules);for(let n=0;n<120;n++)s.step(DT,{...emptyInput(),strafe:1});for(let n=1;n<=60;n++){s.step(DT,{...emptyInput(),strafe:counter&&s.movement.speed>.05?-1:0});if(s.movement.speed<=limit)return n*DT*1000;}return Infinity;};

describe('12.35 acceleration-v10: speed recovers with a delay',()=>{
 it('uses the Unreal character acceleration under the new rules only',()=>{
  expect(make().movement.profile.groundAcceleration).toBe(RECOVERY_GROUND_ACCELERATION);
  for(const rules of ['consistency-v9','audio-v8','bunny-hop-v5'] as const)expect(make('rifleA',rules).movement.profile.groundAcceleration).toBe(MOVEMENT.groundAcceleration);
 });
 it('takes about a quarter second from a standstill to 95 % of run speed',()=>{
  const now=reach(make(),{forward:1},5.4,.95),before=reach(make('rifleA','consistency-v9'),{forward:1},5.4,.95);
  expect(now).toBeGreaterThanOrEqual(240);expect(now).toBeLessThanOrEqual(275);expect(before).toBeLessThan(150);
  expect(reach(make('knife'),{forward:1},6.75,.95)).toBeCloseTo(now*6.75/5.4,-2);
 });
 it('also eases back from walking, crouching and aiming instead of snapping',()=>{
  for(const [state,input] of [['walk',{walk:true}],['crouch',{crouch:true}],['ads',{ads:true}]] as const){
   const after=(rules?:SimulationRulesId)=>{const s=make('rifleA',rules);for(let n=0;n<120;n++)s.step(DT,{...emptyInput(),forward:1,...input});return reach(s,{forward:1},5.4,.95);};
   expect(after(),state).toBeGreaterThan(after('consistency-v9')*1.3);/* crouch is also bounded by the 0.125 s stand-up */
  }
 });
 it('keeps the stop and counter-strafe timings (Riot: 25 % in 0.11 s, stop in 0.17 s)',()=>{
  // 12.36 (reference-v11) refits braking to Riot's timings; acceleration-v10 kept the 12.34 braking.
  for(const [counter,limit] of [[false,1.35],[false,.035],[true,1.35],[true,.65]] as const)expect(stop('acceleration-v10',counter,limit)).toBe(stop('consistency-v9',counter,limit));
  expect(stop('acceleration-v10',false,1.35)).toBeLessThan(150);expect(stop('acceleration-v10',false,.035)).toBeLessThan(200);
 });
 it('replays the new acceleration exactly',async()=>{
  const s=new Simulation('free','rifleA',{...structuredClone(DEFAULT_SETTINGS),practiceMap:'range' as never},{},'acceleration-v10'),recorder=new ReplayRecorder(s);s.running=true;for(let n=0;n<240;n++)s.step(DT,{...emptyInput(),forward:n<120?1:0,strafe:n>=150?1:0,walk:n>=200});
  const record=recorder.finish()!;expect(record.header.simulationRules).toBe('acceleration-v10');expect((await new ReplayPlayer(record).verify()).passed).toBe(true);
 });
});

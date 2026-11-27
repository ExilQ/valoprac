import {describe,expect,it,vi} from 'vitest';
import {readFileSync,writeFileSync} from 'node:fs';
import {Simulation} from '../engine/simulation/Simulation';
import {DEFAULT_SETTINGS} from '../config/settings';
import {emptyInput,type InputState,type Settings} from '../engine/types';
import {ReplayRecorder} from '../engine/replay/recording';
import {ReplayPlayer} from '../engine/replay/playback';
import {AUDIO_RULES} from '../engine/simulation/audioRules';
import type {SimulationRulesId} from '../engine/simulation/rules';
import {AUDIT_STATES,AUDIT_WEAPONS,JUMP_VARIANTS,measureGauge,measureJump,measureState} from '../benchmarks/movementAudit';

const DT=1/120;
const make=(patch:Partial<Settings>={},rules?:SimulationRulesId,weapon:'rifleA'|'knife'|'operator'='rifleA')=>{const s=new Simulation('free',weapon,{...structuredClone(DEFAULT_SETTINGS),...patch},{},rules);s.running=true;return s;};
const run=(s:Simulation,ticks:number,input:Partial<InputState>|((n:number)=>Partial<InputState>)={})=>{for(let n=0;n<ticks;n++)s.step(DT,{...emptyInput(),...(typeof input==='function'?input(n):input)});};

describe('12.32 audio-v8: walking is silent with every weapon',()=>{
 it('keeps knife walking silent now, while the earlier rules let it be heard',()=>{
  expect(measureState('knife','walk').footsteps.audible).toBe(false);
  expect(measureState('knife','walk','training-v7').footsteps.audible).toBe(true);
  for(const weapon of AUDIT_WEAPONS){
   for(const state of ['walk','crouch','crouchWalk','adsWalk'] as const)expect(measureState(weapon,state).footsteps.audible,`${weapon} ${state}`).toBe(false);
   for(const state of ['run','strafe','diagonal','backward'] as const)expect(measureState(weapon,state).footsteps.audible,`${weapon} ${state}`).toBe(true);
  }
 });
 it('scales the audible speed with the held weapon',()=>{
  const knife=make({},undefined,'knife'),rifle=make(),operator=make({},undefined,'operator'),old=make({},'training-v7','knife');
  expect(rifle.footstepAudibleVelocity).toBeCloseTo(2.7,9);expect(knife.footstepAudibleVelocity).toBeCloseTo(2.7*6.75/5.4,9);expect(operator.footstepAudibleVelocity).toBeCloseTo(2.7*5.13/5.4,9);expect(old.footstepAudibleVelocity).toBe(2.7);
 });
});

describe('12.32 audio-v8: jumps push off audibly unless already crouched',()=>{
 const jump=(leadTicks:number|null,rules?:SimulationRulesId)=>{const s=make({},rules),sounds:unknown[]=[];s.onJump=e=>sounds.push(e);run(s,60);
  if(leadTicks!==null)run(s,leadTicks,{crouch:true});run(s,120,n=>({jump:n===0,jumpHeld:n<3,jumpPresses:n===0?1:0,crouch:leadTicks!==null}));return{sounds:sounds.length,silent:s.silentJumps,landings:s.landings.totalEvents};};
 it('sounds on a normal jump and on crouch pressed with the jump, but not after 100 ms of crouch',()=>{
  expect(jump(null)).toEqual({sounds:1,silent:0,landings:1});
  expect(jump(0).sounds).toBe(1);
  expect(jump(11).sounds).toBe(1);// crouch 92 ms before: the study's 94 ms jumps were heard
  expect(jump(12)).toEqual({sounds:0,silent:1,landings:1});// 100 ms: the study's 101-102 ms jumps were silent
  expect(jump(60).sounds).toBe(0);
  expect(AUDIO_RULES.silentTakeoffCrouch).toBeGreaterThan(11/15);expect(AUDIO_RULES.silentTakeoffCrouch).toBeLessThanOrEqual(13/15);
 });
 it('keeps landing sounds, and makes no push-off sound under earlier rules',()=>{expect(jump(null,'training-v7')).toEqual({sounds:0,silent:0,landings:1});expect(jump(60).landings).toBe(1);});
 it('lets bots hear the push-off like a footstep',()=>{
  const s=make({practiceMap:'bind' as never});run(s,30);const hear=vi.spyOn(s.defenders!,'hear');run(s,2,n=>({jump:n===0,jumpHeld:true,jumpPresses:n===0?1:0}));
  const event=hear.mock.calls.map(c=>c[0] as {kind?:string;radius:number}).find(e=>e.kind==='jump');expect(event).toBeDefined();expect(event!.radius).toBe(s.settings.stepHearingRadius);
 });
});

describe('12.32 audio-v8: knife jumps keep the knife speed',()=>{
 it('lands a running knife jump at 6.75 m/s instead of the rifle cap',()=>{
  expect(measureJump('knife',JUMP_VARIANTS[1]).horizontalSpeedAtLanding).toBeCloseTo(6.75,2);
  expect(measureJump('knife',JUMP_VARIANTS[1],'training-v7').horizontalSpeedAtLanding).toBeCloseTo(5.67,2);
  expect(measureJump('rifleA',JUMP_VARIANTS[1]).horizontalSpeedAtLanding).toBeCloseTo(5.4,2);
 });
 it('replays jump sounds, knife jumps and knife walking exactly',async()=>{
  // Recorded under the 12.32 rules (still accepted) and under the current rules.
  for(const rules of ['audio-v8','consistency-v9'] as const){
  const s=make({practiceMap:'bind' as never},rules,'knife'),recorder=new ReplayRecorder(s);
  run(s,360,n=>({forward:1,walk:n>=200,crouch:n>=260&&n<300,jump:n===100||n===320,jumpHeld:n===100||n===320,jumpPresses:n===100||n===320?1:0}));
  expect(s.jumpSoundEvents+s.silentJumps).toBe(2);
  const record=recorder.finish()!;expect(record.header.simulationRules).toBe(rules);expect((await new ReplayPlayer(record).verify()).passed).toBe(true);
  }
 });
});

describe('12.32 movement and footstep audit',()=>{
 // The published measurement (docs/movement-audit-12.32.json) is regenerated
 // from the simulation and must match it exactly.
 it('matches the published measurement',()=>{
  const audit={schema:1,rules:'audio-v8',tickHz:120,
   speeds:AUDIT_WEAPONS.flatMap(w=>AUDIT_STATES.map(st=>measureState(w,st))),
   jumps:AUDIT_WEAPONS.flatMap(w=>JUMP_VARIANTS.map(v=>measureJump(w,v))),
   gauge:AUDIT_WEAPONS.flatMap(w=>measureGauge(w)),
   before:{knifeWalk:measureState('knife','walk','training-v7'),knifeRunningJump:measureJump('knife',JUMP_VARIANTS[1],'training-v7')}};
  const path='docs/movement-audit-12.32.json';
  if(process.env.VALOPRAC_UPDATE_AUDIT)writeFileSync(path,JSON.stringify(audit,null,1)+'\n');
  expect(JSON.parse(readFileSync(path,'utf8'))).toEqual(JSON.parse(JSON.stringify(audit)));
 },120000);
});

import {describe,expect,it} from 'vitest';
import {Ray,Vector3} from 'three';
import {DEFAULT_SETTINGS} from '../config/settings';
import {ReplayPlayer} from '../engine/replay/playback';
import {ReplayRecorder} from '../engine/replay/recording';
import {packInput,type ReplayCommand,type ReplayRecording} from '../engine/replay/types';
import {SeededRandom} from '../engine/simulation/random';
import {Simulation} from '../engine/simulation/Simulation';
import {DefenderAI,intersectPlayerBody,type PlayerBody} from '../engine/tactical/DefenderAI';
import {Target} from '../engine/targets/Target';
import {emptyInput} from '../engine/types';
import {decodeScenario,encodeScenario} from '../training/scenarios/codec';
import {playerTempoFromReplays,type DefenderPolicy} from '../training/scenarios/defenderPolicy';
import {createHeadlineScenario} from '../training/scenarios/templates';
import {validateScenario} from '../training/scenarios/validation';

const dt=1/120;
const standing:PlayerBody={position:{x:0,y:0,z:0},velocity:{x:0,y:0,z:0},eyeHeight:1.64,crouch:0,grounded:true,yaw:0,pitch:0};
const crouched={...standing,crouch:1,eyeHeight:1.12};
const tempo={encounters:12,crouchRate:100,crouchHoldMs:420,burstPauseMs:450};

function duel(policy:DefenderPolicy) {
 const target=new Target(0,'stationary',new SeededRandom(1));
 target.spawn(0,-8,0);
 const ai=new DefenderAI([target],[],{...DEFAULT_SETTINGS,defenderWeapon:'rifleA',defenderReposition:0},standing.position,1947,[{facingYaw:0}],policy);
 return {ai,target};
}

describe('Scenario defender posture and player tempo',()=>{
 it('keeps the first head-line shot on the delayed standing sample when the player ducks just before firing',()=>{
  const {ai}=duel({style:'head-line'});
  for(let tick=1;tick<400&&ai.shots.length===0;tick++)ai.step(dt,tick*dt,standing);
  const first=ai.shots[0];
  expect(first?.hitRegion).toBe('head');
  const retry=duel({style:'head-line'}).ai;
  for(let tick=1;tick<400&&retry.shots.length===0;tick++)retry.step(dt,tick*dt,tick*dt>=first.time-.065?crouched:standing);
  expect(retry.shots[0]).toMatchObject({time:first.time,hit:'miss'});
  const ray=new Ray(new Vector3(0,1.68,-8),new Vector3(0,0,1));
  expect(intersectPlayerBody(ray,standing,new Vector3())?.region).toBe('head');
  expect(intersectPlayerBody(ray,crouched,new Vector3())).toBeNull();
 });
 it('crouches a modeled defender in a visible engagement with the head surface following the rig',()=>{
  const {ai,target}=duel({style:'crouch-counter',playerTempo:tempo});
  const start=target.headPosition(new Vector3()).y;
  for(let tick=1;tick<300&&target.crouch<.99;tick++){
   ai.health=300;
   ai.step(dt,tick*dt,standing);
  }
  expect(target.crouch).toBeGreaterThan(.98);
  const lowered=target.headPosition(new Vector3());
  expect(start-lowered.y).toBeCloseTo(.43,1);
  const old=new Ray(new Vector3(0,start,0),new Vector3(0,0,-1));
  const current=new Ray(new Vector3(lowered.x,lowered.y,0),new Vector3(0,0,-1));
  expect(target.intersect(old,new Vector3())?.zone).not.toBe('head');
  expect(target.intersect(current,new Vector3())?.zone).toBe('head');
 });
 it('derives bounded profile values from recorded trigger input and rejects too few samples',()=>{
  const commands:ReplayCommand[]=Array.from({length:600},(_,tick)=>{
   const phase=tick%60;
   return [0,packInput({...emptyInput(),fire:phase===12,crouch:tick<300&&phase<48})];
  });
  const example={commands} as ReplayRecording;
  expect(playerTempoFromReplays([])).toBeNull();
  expect(playerTempoFromReplays([example])).toEqual({encounters:10,crouchRate:50,crouchHoldMs:400,burstPauseMs:500});
 });
 it('shares only validated profile values and replays the new policy deterministically',async()=>{
  const definition=createHeadlineScenario();
  definition.rules.defenderPolicy={style:'crouch-counter',playerTempo:tempo};
  const scenario=decodeScenario(encodeScenario(definition));
  expect(scenario.rules.defenderPolicy).toEqual(definition.rules.defenderPolicy);
  expect(()=>validateScenario({...definition,rules:{...definition.rules,defenderPolicy:{style:'head-line',playerTempo:tempo}}})).toThrow();
  const simulation=new Simulation('free','rifleA',DEFAULT_SETTINGS,{scenario});
  const recorder=new ReplayRecorder(simulation);
  simulation.running=true;for(let i=0;i<180;i++)simulation.step(dt,emptyInput());
  expect(await new ReplayPlayer(recorder.finish()!).verify()).toMatchObject({passed:true});
 });
});

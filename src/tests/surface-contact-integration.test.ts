import {describe,it,expect} from 'vitest';
import {Simulation} from '../engine/simulation/Simulation';
import {DEFAULT_SETTINGS} from '../config/settings';
import {emptyInput} from '../engine/types';
import type {FootstepEvent} from '../engine/footsteps/Footsteps';
import type {LandingSoundEvent} from '../engine/footsteps/Landings';
import type {SimulationRulesId} from '../engine/simulation/rules';

function range(rules:SimulationRulesId){return new Simulation('free','rifleA',{...structuredClone(DEFAULT_SETTINGS),practiceMap:'range',targetCount:1,behavior:'stationary'},{},rules);}

describe('Actual contact events carry versioned physical surfaces',()=>{
 it('emits rubber steps from resolved movement across the visible mat, retaining legacy event fields',()=>{
  for(const rules of ['legacy-v2','materials-v3'] as const){const s=range(rules),heard:FootstepEvent[]=[];s.onFootstep=e=>heard.push({...e,position:{...e.position}});s.running=true;
   for(let tick=0;tick<100;tick++)s.step(1/120,{...emptyInput(),strafe:1});
   expect(heard.length).toBeGreaterThan(0);expect(heard.every(e=>e.radius===s.settings.stepHearingRadius)).toBe(true);
   if(rules==='materials-v3')for(const e of heard){expect(e.surfaceId).toBe('rubber');expect(e.material).toBe('rubber');}
   else for(const e of heard){expect(e).not.toHaveProperty('surfaceId');expect(e.material).toBeUndefined();}
  }
 });
 it('uses the actual landing contact once without manufacturing steps from the jump input',()=>{
  for(const rules of ['legacy-v2','materials-v3'] as const){const s=range(rules),landings:LandingSoundEvent[]=[];s.onLanding=e=>landings.push({...e,position:{...e.position}});s.running=true;
   for(let tick=0;tick<180;tick++)s.step(1/120,{...emptyInput(),jump:tick===0});
   expect(s.footsteps.totalEvents).toBe(0);expect(landings).toHaveLength(1);expect(landings[0].position).toEqual({x:0,y:0,z:5});
   if(rules==='materials-v3'){expect(landings[0].surfaceId).toBe('rubber');expect(landings[0].material).toBe('rubber');}
   else{expect(landings[0]).not.toHaveProperty('surfaceId');expect(landings[0].material).toBe('concrete');}
  }
 });
});

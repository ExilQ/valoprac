import {compareFootstepRecovery} from '../benchmarks/footstepComparison';
import {describe,it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {Simulation} from '../engine/simulation/Simulation';
import {FixedClock} from '../engine/simulation/FixedClock';
import {emptyInput,type InputState} from '../engine/types';
import {DEFAULT_SETTINGS,sanitizeSettings,persistSettings,loadSettings} from '../config/settings';
import {FOOTSTEP_BASELINE,footstepProfile} from '../config/footsteps';
import {Footsteps} from '../engine/footsteps/Footsteps';
import {FootstepHUD} from '../ui/FootstepHUD';
import {FootstepSettings} from '../ui/FootstepSettings';
import {PatchNotes} from '../ui/PatchNotes';
import {canOccupy,TACTICAL_ZONES} from '../engine/tactical/map';
const settings={...DEFAULT_SETTINGS,behavior:'stationary' as const,targetCount:1};
function replay(fps:number,ticks:number,action:(s:Simulation,tick:number)=>Partial<InputState>,s=new Simulation('free','rifleA',settings)){
 const clock=new FixedClock();s.running=true;const trace:number[]=[];let tick=0;
 for(let frame=0;tick<ticks&&frame<fps*(ticks/120+2);frame++)clock.advance(1/fps,dt=>{if(tick>=ticks)return;const input={...emptyInput(),...action(s,tick)};s.step(dt,input);trace.push(s.footsteps.footstepAccumulation);tick++;});
 expect(tick).toBe(ticks);return {s,trace};
}
function after85(fps:number,treatment:'walk'|'stop'|'toggle'){
 let phase=0,at=0,entryX=0,baselineEvents=0,allowance:number|null=null,retained=0;
 const result=replay(fps,480,(s,tick)=>{
  const f=s.footsteps;
  if(phase===0&&f.footstepAccumulation>=.85){phase=1;at=tick;retained=f.footstepAccumulation;}
  if(phase===1&&tick-at>=(treatment==='stop'?150:treatment==='toggle'?1:1)){phase=2;entryX=s.movement.position.x;baselineEvents=f.totalEvents;retained=f.footstepAccumulation;}
  if(phase===2&&f.totalEvents>baselineEvents&&allowance===null)allowance=s.movement.position.x-entryX;
  if(phase===0)return {strafe:1};
  if(phase===1)return treatment==='stop'?{}:{strafe:1,walk:true};
  if(allowance!==null)return {};
  return {strafe:1,walk:treatment==='toggle'?tick%2===0:false};
 });return {...result,allowance:allowance!,retained};
}
describe('Required A–G footstep regressions under independent render schedules',()=>{
 for(const fps of [60,144,240]){
  it(`A: 85% → walking → running retains phase at ${fps} FPS`,()=>{const a=after85(fps,'walk');expect(a.retained).toBeGreaterThan(.85);expect(a.allowance).toBeGreaterThan(0);expect(a.allowance).toBeLessThan(.35);});
  it(`B: actual stop and recovery restore a larger silent allowance at ${fps} FPS`,()=>{const a=after85(fps,'walk'),b=after85(fps,'stop');expect(b.retained).toBe(0);expect(b.allowance).toBeGreaterThan(1.8);expect(b.allowance).toBeGreaterThan(a.allowance+1);});
  it(`C: repeated Shift toggles cannot erase accumulated movement at ${fps} FPS`,()=>{const c=after85(fps,'toggle');expect(c.retained).toBeGreaterThan(.85);expect(c.allowance).toBeLessThan(.4);expect(c.s.footsteps.totalEvents).toBeGreaterThan(0);});
  it(`D: sufficiently short run-stop bursts recover silently at ${fps} FPS`,()=>{const {s}=replay(fps,1680,(_s,t)=>({strafe:t%168<12?1:0}));expect(s.footsteps.totalEvents).toBe(0);expect(s.footsteps.footstepAccumulation).toBe(0);});
  it(`E: holding W into a wall produces no stationary footsteps at ${fps} FPS`,()=>{const s=new Simulation('free','rifleA',settings);s.movement.position.set(0,0,-29.72);s.movement.previous.copy(s.movement.position);s.footsteps.footstepAccumulation=.85;replay(fps,600,()=>({forward:1}),s);expect(s.footsteps.totalEvents).toBe(0);expect(s.footsteps.actualSpeed).toBeLessThan(1e-9);expect(s.footsteps.footstepAccumulation).toBe(0);});
  it(`F: accumulator and actual event times reproduce the 120 Hz trajectory at ${fps} FPS`,()=>{const inputs=(_s:Simulation,t:number)=>({strafe:t%240<100?1:t%240<200?-1:0,walk:t%240>=130&&t%240<160});const a=replay(120,1200,inputs),b=replay(fps,1200,inputs);expect(b.trace).toEqual(a.trace);expect(b.s.footsteps.recent()).toEqual(a.s.footsteps.recent());expect(b.s.footsteps.totalEvents).toBeGreaterThan(0);});
  it(`G: a nearby bot reacts only to an emitted step at ${fps} FPS`,()=>{const s=new Simulation('free','rifleA',{...settings,practiceMap:'tactical'}),t=s.targets[0],memory=s.hearing!.memories[0];t.spawn(-6,13,0);let quietObserved=false,heardObserved=false;
   replay(fps,160,(sim)=>{if(sim.footsteps.footstepAccumulation>.3&&sim.footsteps.totalEvents===0){quietObserved=true;expect(memory.events).toBe(0);expect(memory.alertUntil).toBe(-100);}if(memory.events>0){heardObserved=true;expect(sim.footsteps.totalEvents).toBeGreaterThan(0);expect(memory.heardAt).toBeGreaterThan(0);}return {forward:1};},s);
   expect(quietObserved).toBe(true);expect(heardObserved).toBe(true);expect(memory.events).toBeGreaterThan(0);expect(t.position.distanceTo(t.anchor)).toBeGreaterThan(.05);
  });
 }
});
describe('Independent footstep state, collision and visualization contracts',()=>{
 it('consumes thresholds with distance remainder and sub-tick position/time, using a bounded journal',()=>{const f=new Footsteps({...FOOTSTEP_BASELINE,firstStepGraceDistance:0,accumulationPerMeter:1});const m={previous:{x:0,y:0,z:0},position:{x:3.4,y:0,z:0},grounded:true,crouch:0};f.step(m,false,.5,.5);expect(f.totalEvents).toBe(3);expect(f.footstepAccumulation).toBeCloseTo(.4,12);expect(f.recent().map(e=>e.position.x)).toEqual([1,2,3]);expect(f.recent()[0].timestamp).toBeCloseTo(.5/3.4,12);for(let i=0;i<100;i++)f.step(m,false,.5,i+1);expect(f.recent()).toHaveLength(64);expect(f.journal).toHaveLength(64);});
 it('walking recovery variants preserve phase for an immediate re-run and differ over a long walk',()=>{const results=[];for(const walkingDecay of [0,.02,.08]){const f=new Footsteps({...FOOTSTEP_BASELINE,walkingDecay});f.footstepAccumulation=.85;f.graceRemaining=0;const m={previous:{x:0,y:0,z:0},position:{x:.02,y:0,z:0},grounded:true,crouch:0};f.step(m,true,1/120,1/120);expect(f.footstepAccumulation).toBeGreaterThan(.849);for(let i=1;i<360;i++)f.step(m,true,1/120,(i+1)/120);results.push(f.footstepAccumulation);expect(f.totalEvents).toBe(0);}expect(results[0]).toBeCloseTo(.85);expect(results[1]).toBeCloseTo(.79);expect(results[2]).toBeCloseTo(.61);});
 it('released keys do not immediately reset phase while residual motion decelerates',()=>{let prior=0,release=0;const {s}=replay(120,125,(sim,tick)=>{if(tick===65)prior=sim.footsteps.footstepAccumulation;if(tick===66)release=sim.footsteps.footstepAccumulation;return {strafe:tick<65?1:0};});expect(prior).toBeGreaterThan(0);expect(release).toBeGreaterThanOrEqual(prior);expect(s.footsteps.actualSpeed).toBe(0);});
 it('preserves progress through weapons, pause, statistics reset and unrelated preferences',()=>{const s=new Simulation('free','rifleA',settings);replay(120,55,()=>({strafe:1}),s);const a=s.footsteps.footstepAccumulation;s.switchWeapon('sheriff');s.resetStatistics();s.running=false;s.step(1/120,emptyInput());s.footsteps.configure(footstepProfile({...s.settings,footstepHud:false,volume:0}));expect(s.footsteps.footstepAccumulation).toBe(a);});
 it('suspends footsteps during airborne motion and preserves the unfinished ground cycle',()=>{const f=new Footsteps(),m={previous:{x:0,y:0,z:0},position:{x:.1,y:1,z:0},grounded:false,crouch:0};f.footstepAccumulation=.85;for(let i=0;i<120;i++)f.step(m,false,1/120,(i+1)/120);expect(f.totalEvents).toBe(0);expect(f.footstepAccumulation).toBe(.85);m.grounded=true;f.step(m,false,1/120,2);expect(f.totalEvents).toBe(0);expect(f.footstepAccumulation).toBe(.85);});
 it('does not alert an out-of-range, inactive or disabled bot',()=>{const s=new Simulation('free','rifleA',{...settings,practiceMap:'tactical'});const event={id:1,timestamp:1,position:{x:100,y:0,z:100},radius:5,speed:5};s.hearing!.hear(event);expect(s.hearing!.heardEvents).toBe(0);s.targets[0].active=false;event.position.x=s.targets[0].position.x;event.position.z=s.targets[0].position.z;s.hearing!.hear(event);expect(s.hearing!.heardEvents).toBe(0);});
 it('keeps all zone spawn choices collision-free and bounds bot travel without teleporting',()=>{for(const zone of TACTICAL_ZONES)for(const p of zone)expect(canOccupy(p.x,p.z)).toBe(true);const s=new Simulation('free','rifleA',{...settings,practiceMap:'tactical',targetCount:12});expect(s.targets.filter(t=>t.enabled)).toHaveLength(5);replay(144,2400,()=>({strafe:1}),s);for(const t of s.targets.filter(t=>t.enabled))expect(canOccupy(t.position.x,t.position.z)).toBe(true);});
 it('renders no hearing ring for a partial meter, but a fixed actual event radius after a step',()=>{const s=new Simulation('free','rifleA',settings);s.footsteps.footstepAccumulation=.85;const quiet=renderToStaticMarkup(<FootstepHUD simulation={s} settings={settings}/>);expect(quiet).toContain('85%');expect(quiet).not.toContain('data-sound-event');s.footsteps.graceRemaining=0;s.movement.previous.set(0,0,5);s.movement.position.set(.3,0,5);s.time=.05;s.footsteps.step(s.movement,false,.05,.05);const heard=renderToStaticMarkup(<FootstepHUD simulation={s} settings={settings}/>);expect(heard).toContain('data-sound-event');expect(heard).toContain('r="20"');expect(heard).toContain('발소리 발생');expect(renderToStaticMarkup(<FootstepHUD simulation={s} settings={{...settings,footstepHud:false,soundMinimap:false}}/>)).toBe('');});
 it('persists calibrated settings and restores old settings with safe new defaults',()=>{const map=new Map<string,string>(),storage={getItem:(k:string)=>map.get(k)??null,setItem:(k:string,v:string)=>{map.set(k,v);}};const s=sanitizeSettings({...settings,practiceMap:'tactical',stepWalkingDecay:.08,stepStationaryDecay:2,stepGraceDistance:.4});persistSettings(s,storage);expect(loadSettings(storage)).toEqual(s);expect(sanitizeSettings({sensitivity:.5}).stepPerMeter).toBe(.625);expect(sanitizeSettings({stepPerMeter:0,stepThreshold:NaN,footstepVolume:Infinity}).stepPerMeter).toBe(.1);});
 it('renders Korean calibration controls and preserves the footstep update history',()=>{expect(renderToStaticMarkup(<FootstepSettings/>)).toContain('걷기 회복 비교');const html=renderToStaticMarkup(<PatchNotes/>);expect(html).toContain('패치노트 열기');expect(html).toContain('발소리 시뮬레이션');expect(html).toContain('발소리 누적과 코너 피킹');});
});

describe('Interactive calibration comparison uses the real movement/accumulation core',()=>{
 it('reports comparable walking and stopping distances at each required render rate',()=>{const data=[60,144,240].map(fps=>compareFootstepRecovery(settings,fps));for(const d of data){expect(d.walk.retained).toBeGreaterThan(.85);expect(d.stop.retained).toBe(0);expect(d.walk.distance).toBeLessThan(.35);expect(d.stop.distance).toBeGreaterThan(1.8);}expect(data.map(d=>d.walk.distance)).toEqual(Array(3).fill(data[0].walk.distance));expect(data.map(d=>d.stop.distance)).toEqual(Array(3).fill(data[0].stop.distance));console.info(JSON.stringify({benchmark:'footstep-comparison',calibration:'provisional-v1',actualValorantMeasured:false,data}));});
});

describe('Tactical map preserves actual weapons and head/body/environment classification',()=>{
 for(const weapon of ['rifleA','rifleB','sheriff'] as const)for(const zone of ['head','torso'] as const)it(`${weapon} ${zone} uses the original 3D hitscan and head-only default`,()=>{
  const s=new Simulation('free',weapon,{...settings,practiceMap:'tactical'}),target=s.targets[0];target.spawn(-7,10,0);s.pitch=Math.atan2((zone==='head'?1.68:1.13)-1.64,3);s.running=true;s.step(1/120,{...emptyInput(),fire:true,firePresses:1});expect(s.shots[0].hit).toBe(zone);expect(target.active).toBe(zone!=='head');expect(s.stats.eliminations).toBe(zone==='head'?1:0);
 });
 it('uses tactical walls for bullet occlusion and preserves the range for timed modes',()=>{const s=new Simulation('free','rifleA',{...settings,practiceMap:'tactical'});s.movement.position.set(-5,0,13);s.movement.previous.copy(s.movement.position);const t=s.targets[0];t.spawn(-5,5,0);s.pitch=Math.atan2(.04,8);s.running=true;s.step(1/120,{...emptyInput(),fire:true});expect(s.shots[0].hit).toBe('wall');expect(t.active).toBe(true);expect(new Simulation('precision','rifleA',{...settings,practiceMap:'tactical'}).practiceMap).toBe('range');});
});

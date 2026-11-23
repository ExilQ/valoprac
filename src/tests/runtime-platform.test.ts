import {afterEach,describe,expect,it,vi} from 'vitest';
import {Runtime} from '../engine/Runtime';
import {DEFAULT_SETTINGS} from '../config/settings';
import {ReplayPlayer} from '../engine/replay/playback';
import {synthesizeTrainingCue} from '../engine/audio/trainingCue';

const tracked=vi.hoisted(()=>({renderers:[] as any[],audios:[] as any[]}));
vi.mock('../engine/rendering/RangeRenderer',async()=>{
 const {Group}=await import('three');
 return{RangeRenderer:class{
  canvas=new EventTarget();scene=new Group();preparationReady=true;calls=0;disposed=0;clears=0;
  preparationStatus={stage:'ready',revision:0,requestedRevision:0,elapsedMs:0,completedPrograms:1,totalPrograms:1};
  constructor(_host:unknown,public simulation:any,_settings:unknown){simulation.renderedTargets.attach();tracked.renderers.push(this);}
  prepare(){return Promise.resolve({revision:0,milliseconds:0,programs:1,method:'synchronous',disposed:false});}
  clearImpacts(){this.clears++;}applySettings(){}addShot(){}addDefenderShot(){}render(){}dispose(){this.disposed++;}
 }};
});
vi.mock('../engine/audio/Audio',()=>({TrainingAudio:class{
 stop=vi.fn();dispose=vi.fn();trainingCue=vi.fn();levels=vi.fn();sync=vi.fn();setOcclusionResolver=vi.fn();listener=vi.fn();shot=vi.fn();action=vi.fn();landing=vi.fn();footstep=vi.fn();enemyShot=vi.fn();impacts=vi.fn();botFootstep=vi.fn();
 constructor(){tracked.audios.push(this);}unlock(){return Promise.resolve();}
}}));
vi.mock('../aim/CombatCapture',()=>({CombatCapture:class{sample(){}shot(){}frame(){}dispose(){}flush(){return Promise.resolve([]);}}}));

class Surface extends EventTarget{added=0;removed=0;override addEventListener(...a:Parameters<EventTarget['addEventListener']>){this.added++;super.addEventListener(...a);}override removeEventListener(...a:Parameters<EventTarget['removeEventListener']>){this.removed++;super.removeEventListener(...a);}}
class DocumentMock extends Surface{pointerLockElement:unknown=null;fullscreenElement:unknown=null;hidden=false;exitPointerLock(){this.pointerLockElement=null;this.dispatchEvent(new Event('pointerlockchange'));}}
function setup(kind:'warmup'|'flash'='warmup',tools=false){
 const document=new DocumentMock(),window=new Surface();vi.stubGlobal('document',document);vi.stubGlobal('window',window);vi.stubGlobal('navigator',{});vi.stubGlobal('requestAnimationFrame',vi.fn(()=>1));vi.stubGlobal('cancelAnimationFrame',vi.fn());
 const finished=vi.fn(),telemetry=vi.fn(),error=vi.fn(),s=structuredClone(DEFAULT_SETTINGS);s.movementTools.enabled=tools;
 const exercise=kind==='warmup'?{schema:1 as const,kind,durationSeconds:60 as const}:{schema:1 as const,kind,durationSeconds:60 as const,responseWindowSeconds:.8,turnThresholdDegrees:100};
 const runtime=new Runtime({} as HTMLElement,'free','rifleA',s,false,telemetry,vi.fn(),error,finished,undefined,undefined,{exercise});
 return{runtime,document,window,finished,telemetry,error};
}
afterEach(()=>{vi.unstubAllGlobals();tracked.renderers.length=0;tracked.audios.length=0;});

describe('Platform runtime retains rendering resources and replaces authoritative attempts',()=>{
 it('restarts with a fresh seeded simulation and replay while preserving one prepared renderer',async()=>{
  const {runtime:r,document:doc,window,finished}=setup(),old=r.simulation,renderer=r.renderer;
  const initial=old.targets[0].position.clone(),listeners=doc.added-doc.removed,windowListeners=window.added-window.removed;
  r.finish();expect(finished).toHaveBeenCalledOnce();const first=finished.mock.calls[0][0];expect(first.replay).toBeTruthy();expect((await new ReplayPlayer(first.replay).verify()).passed).toBe(true);
  expect(r.replaySnapshot()).toBe(first.replay);expect(r.restartExercise()).toBe(true);
  expect(r.renderer).toBe(renderer);expect(tracked.renderers).toHaveLength(1);expect((renderer as any).disposed).toBe(0);
  expect(r.simulation).not.toBe(old);expect(r.simulation.time).toBe(0);expect(r.simulation.completed).toBe(false);expect(r.simulation.targets[0].position.toArray()).toEqual(initial.toArray());
  expect(old.onFinish).toBeNull();expect(old.onShot).toBeNull();expect(doc.added-doc.removed).toBe(listeners);expect(window.added-window.removed).toBe(windowListeners);
  r.finish();expect(finished).toHaveBeenCalledTimes(2);expect((await new ReplayPlayer(finished.mock.calls[1][0].replay).verify()).passed).toBe(true);
  r.dispose();expect((renderer as any).disposed).toBe(1);expect(doc.added).toBe(doc.removed);expect(window.added).toBe(window.removed);
 });
 it('preserves held input on save and clears stale input/debt after an actual validated restore',()=>{
  const {runtime:r}=setup('warmup',true);r.input.state.forward=1;r.clock.accumulator=.03;
  expect(r.performMovementAction({kind:'movement-save'}).ok).toBe(true);expect(r.input.state.forward).toBe(1);expect(r.clock.accumulator).toBe(.03);
  const time=r.simulation.time,result=r.performMovementAction({kind:'movement-restore'});
  expect(result.ok).toBe(true);expect(result.restored).toBeTruthy();expect(r.input.state.forward).toBe(0);expect(r.clock.accumulator).toBe(0);expect(r.simulation.time).toBe(time);
  expect(r.replaySnapshot()?.commands.some(c=>c[0]===12)).toBe(true);r.dispose();
 });
 it('plays each real flash cue once and resets presentation cue identity for a fresh attempt',()=>{
  const {runtime:r}=setup('flash'),audio=tracked.audios[0];r.simulation.running=true;
  const step=(r as unknown as {step:(dt:number)=>void}).step;
  for(let n=0;n<180&&!audio.trainingCue.mock.calls.length;n++)step(1/120);
  expect(audio.trainingCue).toHaveBeenCalledOnce();const [source,time]=audio.trainingCue.mock.calls[0];expect([source.x,source.y,source.z,time].every(Number.isFinite)).toBe(true);
  for(let n=0;n<5;n++)step(1/120);expect(audio.trainingCue).toHaveBeenCalledOnce();
  r.finish();expect(r.restartExercise()).toBe(true);r.simulation.running=true;
  for(let n=0;n<180&&audio.trainingCue.mock.calls.length<2;n++)step(1/120);expect(audio.trainingCue).toHaveBeenCalledTimes(2);r.dispose();
 });
 it('keeps the authored reaction cue finite, short and below clipping',()=>{
  const a=synthesizeTrainingCue(48000),b=synthesizeTrainingCue(48000);expect(a).toEqual(b);expect(a.length).toBe(6720);expect(a.every(Number.isFinite)).toBe(true);expect(Math.max(...a.map(Math.abs))).toBeLessThan(.31);
 });
});

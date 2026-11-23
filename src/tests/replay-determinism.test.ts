import {describe,it,expect} from 'vitest';
import {Matrix4,Vector3} from 'three';
import {Simulation} from '../engine/simulation/Simulation';
import {DEFAULT_SETTINGS} from '../config/settings';
import {ReplayRecorder} from '../engine/replay/recording';
import {ReplayPlayer} from '../engine/replay/playback';
import {simulationChecksum} from '../engine/replay/integrity';
import {validateReplay} from '../engine/replay/validation';
import {encodeReplay,decodeReplay} from '../engine/replay/codec';
import {emptyInput,type Settings,type WeaponId} from '../engine/types';
import {SeededRandom} from '../engine/simulation/random';

const DT=1/120;
function settings(patch:Partial<Settings>={}):Settings{return structuredClone({...DEFAULT_SETTINGS,...patch});}
/** Same public matrices submitted by the renderer, without a WebGL dependency. */
function frame(s:Simulation,alpha:number,stamp:number){
 const positions:Vector3[]=[],matrices:Matrix4[][]=[];
 for(const t of s.targets){const dx=t.previous.x+(t.position.x-t.previous.x)*alpha-t.position.x,dz=t.previous.z+(t.position.z-t.previous.z)*alpha-t.position.z;
  positions.push(new Vector3(t.position.x+dx,t.position.y,t.position.z+dz));matrices.push(t.parts.map(p=>{const m=p.node.matrixWorld.clone();m.elements[12]+=dx;m.elements[14]+=dz;return m.scale(p.size);}));}
 s.renderedTargets.capture(s.targets,matrices,stamp,positions,{tick:s.ticks,alpha});
}
function exercise(s:Simulation,ticks=480,rendered=false){
 s.running=true;
 for(let tick=0;tick<ticks;tick++){
  if(tick%3===0)s.look(tick%13-6,tick%7-3);
  if(rendered&&tick%2===0)frame(s,.375,1000+tick*DT*1000);
  if(tick%47===0)s.captureFireView(1000+Math.max(0,tick-2)*DT*1000);
  const i={...emptyInput(),forward:tick<180?1:tick<300?-1:0,strafe:tick%160<80?1:-1,walk:tick%240<80,crouch:tick%240>=160,jump:tick%95===0,jumpHeld:tick%95<4,fire:tick%37<12,firePresses:tick%37===0?1:0,ads:tick%200>=100,scopePresses:tick%150===80?1:0};
  s.step(DT,i);
 }
}
describe('Versioned input replays reproduce the real simulation',()=>{
 for(const profile of ['valorant','counterStrike'] as const)for(const weapon of ['rifleA','rifleB','sheriff','operator'] as WeaponId[]){
  it(`${profile}/${weapon}: reproduces movement, shots and RNG state twice`,async()=>{
   const s=new Simulation('free',weapon,settings({movementPhysics:profile,behavior:'mixed',targetCount:5})),recorder=new ReplayRecorder(s);exercise(s);
   const recording=recorder.finish()!;expect(recording).not.toBeNull();validateReplay(recording);
   const a=await new ReplayPlayer(recording).verify(),b=await new ReplayPlayer(recording).verify();
   expect(a.passed).toBe(true);expect(a).toEqual(b);expect(a.checksum).toBe(simulationChecksum(s));expect(a.shots).toBeGreaterThan(0);
  });
 }
 for(const mode of ['precision','braking','spray','tracking'] as const)for(const profile of ['valorant','counterStrike'] as const){
  it(`${mode}/${profile}: reconstructs existing timed training outcomes`,async()=>{
   const s=new Simulation(mode,'rifleA',settings({movementPhysics:profile,behavior:'mixed'})),r=new ReplayRecorder(s);exercise(s,240);const record=r.finish()!;
   expect((await new ReplayPlayer(record).verify()).passed).toBe(true);
  });
 }
 it('recreates interpolated displayed poses and older click-selected frames',async()=>{
  const s=new Simulation('free','rifleA',settings({behavior:'long',targetCount:5}));s.renderedTargets.attach();const r=new ReplayRecorder(s);exercise(s,480,true);
  const recording=r.finish()!;const v=await new ReplayPlayer(recording).verify();expect(v.passed).toBe(true);expect(recording.commands.some(c=>c[0]===3)).toBe(true);expect(s.shots.every(x=>x.targetPoseSource==='rendered-frame')).toBe(true);
  const p=new ReplayPlayer(recording);await p.seek(1.5);const at=simulationChecksum(p.simulation);await p.seek(3);await p.seek(1.5);expect(simulationChecksum(p.simulation)).toBe(at);
 });
 it('replays configuration, weapon changes, input clearing and resets in original order',async()=>{
  const s=new Simulation('free','rifleA',settings()),r=new ReplayRecorder(s);exercise(s,180);s.configure({behavior:'strafe',targetCount:3});s.switchWeapon('operator');s.clearMovementInput();s.clearFireView();s.resetTargets();exercise(s,180);s.resetStatistics();s.configure({movementPhysics:'counterStrike',csMovementPreset:'sourceClassic'});s.switchWeapon('sheriff');exercise(s,180);
  const recording=r.finish()!;expect((await new ReplayPlayer(recording).verify()).passed).toBe(true);
 });
 it('keeps paused no-op fixed-clock calls out of the authoritative tick count',async()=>{
  const s=new Simulation('free','rifleA',settings()),r=new ReplayRecorder(s);exercise(s,60);s.running=false;for(let n=0;n<100;n++)s.step(DT,emptyInput());exercise(s,60);
  const recording=r.finish()!;expect(recording.commands.filter(c=>c[0]===0)).toHaveLength(120);validateReplay(recording);expect((await new ReplayPlayer(recording).verify()).passed).toBe(true);
 });
 it('finishes inside a timed tick without losing the final shot marker',async()=>{
  const s=new Simulation('precision','rifleA',settings({duration:15})),r=new ReplayRecorder(s);let recording:ReturnType<ReplayRecorder['finish']>=null;s.onFinish=()=>{recording=r.finish();};s.running=true;
  for(let n=0;n<1800;n++)s.step(DT,{...emptyInput(),fire:n===1799,firePresses:n===1799?1:0});
  expect(recording).not.toBeNull();expect(s.stats.shots).toBe(1);expect(recording!.events.some(e=>e.kind==='shot'&&e.time===15)).toBe(true);expect((await new ReplayPlayer(recording!).verify()).passed).toBe(true);
 });
 it('rejects incompatible or altered outcomes rather than trusting a result card',async()=>{
  const s=new Simulation('free','rifleA',settings()),r=new ReplayRecorder(s);exercise(s,240);const recording=r.finish()!;
  const wrong=structuredClone(recording);wrong.header.movementVersion='unknown';expect(()=>new ReplayPlayer(wrong)).toThrow(/호환/);
  const changed=structuredClone(recording);changed.commands.splice(0,0,[1,500,0]);for(const c of changed.checkpoints)c.command++;expect((await new ReplayPlayer(changed).verify()).passed).toBe(false);
 });
 it('stores a one-minute 1000Hz look/60Hz rendered-frame fixture within200kB',async()=>{
  const s=new Simulation('free','rifleA',settings({behavior:'mixed',targetCount:5}));s.renderedTargets.attach();const r=new ReplayRecorder(s),rng=new SeededRandom(909);s.running=true;
  let looks=0;
  for(let tick=0;tick<7200;tick++){
   for(let j=0;j<8+(tick%3===0?1:0);j++){s.look(Math.floor(rng.range(-4,5)),Math.floor(rng.range(-3,4)));looks++;}
   if(tick%2===0)frame(s,.5,1000+tick*DT*1000);
   s.step(DT,{...emptyInput(),strafe:tick%240<120?1:-1,fire:tick%120<40,ads:tick%360>=180,jump:tick%120===0,jumpHeld:tick%120<3});
  }
  const recording=r.finish()!,bytes=await encodeReplay(recording),decoded=await decodeReplay(bytes),verification=await new ReplayPlayer(decoded).verify();
  expect(looks).toBe(60000);expect(bytes.length).toBeLessThanOrEqual(200000);expect(verification.passed).toBe(true);
  console.log(JSON.stringify({benchmark:'deterministic-replay-one-minute',schema:1,ticks:s.ticks,lookEvents:looks,renderedFrames:recording.commands.filter(c=>c[0]===2).length,commands:recording.commands.length,rawBytes:new TextEncoder().encode(JSON.stringify(recording)).length,gzipBytes:bytes.length,verification,environment:'Node JavaScript120Hz; shared realSimulation, no GPU or physicalmouse'}));
 },30000);
});

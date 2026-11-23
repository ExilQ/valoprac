import {afterEach,describe,expect,it,vi} from 'vitest';
import {indexedDB} from 'fake-indexeddb';
import {createHash} from 'node:crypto';
import {Movement} from '../engine/movement/Movement';
import {Landings,type LandingSoundEvent} from '../engine/footsteps/Landings';
import {Footsteps,FOOTSTEP_MATERIALS} from '../engine/footsteps/Footsteps';
import {synthesizeLanding} from '../engine/audio/landingSynthesis';
import {synthesizeFootstep} from '../engine/audio/footstepSynthesis';
import {TrainingAudio} from '../engine/audio/Audio';
import {emptyInput} from '../engine/types';

const dt=1/120;
function fresh(){const m=new Movement(undefined,[]);m.reset({x:0,y:0,z:0});return m;}
afterEach(()=>vi.unstubAllGlobals());
describe('Actual landing transitions have a separate audible stream',()=>{
 for(const movementPhysics of ['valorant','counterStrike'] as const)it(`${movementPhysics}: emits one landing after a jump and no walking step while airborne`,()=>{
  const m=fresh();m.configurePhysics({movementPhysics,csMovementPreset:'cs2',jumpBufferMs:80});
  const landings=new Landings(m),footsteps=new Footsteps();footsteps.footstepAccumulation=.7;footsteps.graceRemaining=0;
  const sounds:LandingSoundEvent[]=[];landings.onLanding=e=>sounds.push(e);
  for(let tick=1;tick<180;tick++){
   const input={...emptyInput(),jump:tick===1,forward:1},time=tick*dt;m.step(input,0,dt,time);
   const before=footsteps.totalEvents;footsteps.step(m,false,dt,time);
   if(!m.grounded)expect(footsteps.totalEvents).toBe(before);
   landings.step(m,time,dt,()=> 'steel',20);
  }
  expect(sounds).toHaveLength(1);expect(sounds[0].impactSpeed).toBeGreaterThan(4);
  expect(sounds[0].material).toBe('steel');expect(sounds[0].position.y).toBe(0);
  expect(sounds[0].timestamp).toBe(m.lastLandingTime);expect(landings.totalEvents).toBe(1);
  const before=footsteps.footstepAccumulation;landings.step(m,2,dt);expect(footsteps.footstepAccumulation).toBe(before);
 });
 it('detects real contact even when a buffered jump takes off in the same tick',()=>{
  const probe=fresh();let contact=0;for(let tick=1;tick<180;tick++){probe.step({...emptyInput(),jump:tick===1},0,dt,tick*dt);if(probe.landingSerial){contact=tick;break;}}
  expect(contact).toBeGreaterThan(10);const m=fresh(),l=new Landings(m);let soundWhileAirborne=false;
  for(let tick=1;tick<=contact+2;tick++){m.step({...emptyInput(),jump:tick===1||tick===contact-4},0,dt,tick*dt);const e=l.step(m,tick*dt,dt);if(e)soundWhileAirborne=!m.grounded;}
  expect(m.hopSnapshot().chainedJumps).toBe(1);expect(l.totalEvents).toBe(1);expect(soundWhileAirborne).toBe(true);
 });
 it('consumes tiny contacts silently and reset prevents stale replay while preserving bounded session history',()=>{
  const m=fresh(),l=new Landings(m);expect(l.step(m,0,dt)).toBeNull();
  m.landingSerial++;m.lastLandingTime=1;m.lastLandingImpactSpeed=.1;expect(l.step(m,1,dt)).toBeNull();
  m.lastLandingImpactSpeed=6;expect(l.step(m,1.1,dt)).toBeNull();
  for(let i=0;i<40;i++){m.landingSerial++;m.lastLandingTime=2+i;l.step(m,2+i,dt);}
  expect(l.totalEvents).toBe(40);expect(l.recent()).toHaveLength(32);const copied=l.historyRecent();copied[0].position.x=999;expect(l.historyRecent()[0].position.x).toBe(0);
  l.resetEncounter(m);expect(l.recent()).toEqual([]);expect(l.historyRecent()).toHaveLength(32);expect(l.step(m,50,dt)).toBeNull();
  m.reset({x:2,y:0,z:3},50);l.resetEncounter(m);expect(l.step(m,50,dt)).toBeNull();m.landingSerial++;m.lastLandingTime=51;m.lastLandingImpactSpeed=5;
  const event=l.step(m,51,dt)!;expect(event.id).toBe(41);expect(l.recent()).toHaveLength(1);expect(event.position).toEqual({x:2,y:0,z:3});
 });
 it('interpolates horizontal contact position and scales hearing with impact rather than movement keys',()=>{
  const m=fresh(),l=new Landings(m);m.previous.set(0,1,0);m.position.set(2,.1,4);m.supportHeight=0;m.lastLandingTime=.995;m.lastLandingImpactSpeed=2;m.landingSerial++;
  const quiet=l.step(m,1,.01,p=>p.x<1.5?'wood':'steel')!;expect(quiet.position.x).toBeCloseTo(1);expect(quiet.position.z).toBeCloseTo(2);expect(quiet.material).toBe('wood');
  m.landingSerial++;m.lastLandingTime=1.1;m.lastLandingImpactSpeed=9;const loud=l.step(m,1.1,dt)!;expect(loud.radius).toBeGreaterThan(quiet.radius);
 });
});

describe('Original landing audio is independent from footstep playback',()=>{
 it('synthesizes finite distinct restrained material thuds, separate from walking PCM',()=>{
  for(const rate of [8000,44100,48000]){const hashes=new Set<string>();for(const material of FOOTSTEP_MATERIALS){const pcm=synthesizeLanding(rate,material);expect(pcm.length).toBe(Math.round(rate*.23));expect([...pcm].every(Number.isFinite)).toBe(true);expect(Math.max(...pcm.map(Math.abs))).toBeLessThan(.75);hashes.add(createHash('sha256').update(new Uint8Array(pcm.buffer)).digest('hex'));expect(pcm).not.toEqual(synthesizeFootstep(rate,0,material));}expect(hashes.size).toBe(4);}
 });
 it('plays landing and footstep id 1 independently once, with separately cached material buffers',async()=>{
  class Node {gain={value:1};threshold={value:0};ratio={value:1};buffer:unknown;onended:(()=>void)|null=null;connect(n:Node){return n;}disconnect(){}start(){}stop(){this.onended?.();}}
  const sources:Node[]=[];let bufferId=0;
  class Context {sampleRate=8000;currentTime=0;state='running';destination=new Node();createGain(){return new Node();}createDynamicsCompressor(){return new Node();}createBufferSource(){const n=new Node();sources.push(n);return n;}createBuffer(_c:number,n:number,r:number){return{id:++bufferId,duration:n/r,copyToChannel(){}};}resume(){return Promise.resolve();}close(){return Promise.resolve();}}
  vi.stubGlobal('AudioContext',Context);vi.stubGlobal('indexedDB',indexedDB);const audio=new TrainingAudio();await audio.unlock();
  const e:LandingSoundEvent={kind:'landing',id:1,timestamp:0,position:{x:0,y:0,z:0},radius:20,speed:5,impactSpeed:6};
  audio.footstep(e);const step=sources.at(-1)!.buffer;audio.landing(e);const landing=sources.at(-1)!.buffer;expect(landing).not.toBe(step);
  audio.landing(e);audio.footstep(e);expect(sources).toHaveLength(2);expect(audio.landingEvents).toBe(1);expect(audio.footstepEvents).toBe(1);
  const materialBuffers=new Set([landing]);for(const [i,material] of FOOTSTEP_MATERIALS.entries()){audio.landing({...e,id:2+i,material});materialBuffers.add(sources.at(-1)!.buffer);}expect(materialBuffers.size).toBe(4);
  expect(audio.events).toBe(0);audio.dispose();expect(audio.activeVoiceCount).toBe(0);
 });
});

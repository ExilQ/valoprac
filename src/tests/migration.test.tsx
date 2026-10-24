import { afterAll,beforeAll,describe,it,expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync,rmSync,readFileSync } from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Movement} from '../engine/movement/Movement';
import {Weapon} from '../engine/weapons/Weapon';
import {emptyInput} from '../engine/types';
import {WEAPONS,WEAPON_ORDER} from '../config/weapons';
import {RenderCadence} from '../engine/rendering/RenderCadence';
import {ProtocolClient,parseEngineState} from '../streaming/protocol';
import {StreamDiagnostics} from '../streaming/diagnostics';
import {validateStreamingConfig,validateSignalUrl} from '../streaming/config';
import {DEFAULT_SETTINGS,loadSettings,persistSettings,sanitizeSettings} from '../config/settings';
import {parseRoute} from '../app/navigation';
import {renderToStaticMarkup} from 'react-dom/server';
import {WeaponSelection} from '../ui/WeaponSelection';
import {SettingsPanel} from '../ui/SettingsPanel';
const state={v:1,session:'session',type:'ack',ack:1,revision:1,weapon:'rifleA',mode:'free',ammo:25,reserve:-1,reloading:false,paused:true,time:0,shots:0,hits:0,heads:0,eliminations:0,speed:0,accurate:true,recoilPitch:0,recoilYaw:0};
describe('Authoritative streaming state protocol',()=>{
 it('rejects foreign sessions, malformed and non-finite telemetry',()=>{expect(parseEngineState(JSON.stringify(state),'foreign')).toBeNull();expect(parseEngineState('{','session')).toBeNull();expect(parseEngineState(JSON.stringify({...state,ammo:'25'}),'session')).toBeNull();expect(parseEngineState(JSON.stringify({...state,revision:-1}),'session')).toBeNull();});
 it('retries identical sequences without duplicating a gameplay fire command',()=>{let time=0;const sent:unknown[]=[];const p=new ProtocolClient('session',c=>sent.push(c),()=>time);p.command('weapon',{weapon:'sheriff'});time=1600;p.retry();expect(sent[0]).toEqual(sent[1]);expect(JSON.stringify(sent)).not.toContain('fire');expect(p.receive(JSON.stringify(state))?.ammo).toBe(25);expect(p.pendingCount).toBe(0);});
 it('ignores stale revisions and caps unacknowledged commands',()=>{const p=new ProtocolClient('session',()=>{});p.receive(JSON.stringify({...state,revision:8}));expect(p.receive(JSON.stringify(state))).toBeNull();for(let i=0;i<32;i++)p.command('ping');expect(()=>p.command('ping')).toThrow();p.clear();expect(p.pendingCount).toBe(0);});
 it('fails bounded retries instead of queuing forever',()=>{let time=0;const p=new ProtocolClient('session',()=>{},()=>time);p.command('ping');time=1501;p.retry();time=3002;p.retry();time=4503;expect(()=>p.retry()).toThrow();});
 it('accepts explicit unsupported-settings errors without hiding authoritative ammo',()=>{expect(parseEngineState(JSON.stringify({...state,error:'unverified-settings'}),'session')?.ammo).toBe(25);});
});
describe('Stream safety and meaningful metrics',()=>{
 const config={schema:1,enabled:true,allocatorUrl:'https://gpu-staging.valoprac.trade',signallingHosts:['gpu-staging.valoprac.trade'],engineVersion:'5.7',infrastructureCommit:'pin'};
 it('blocks insecure or unapproved stream hosts',()=>{const c=validateStreamingConfig(config);expect(validateSignalUrl('wss://gpu-staging.valoprac.trade/signal/test',c)).toContain('wss:');expect(()=>validateSignalUrl('wss://unapproved.invalid',c)).toThrow();expect(()=>validateStreamingConfig({...config,allocatorUrl:'http://gpu-staging.valoprac.trade'})).toThrow();expect(()=>validateStreamingConfig({...config,signallingHosts:[]})).toThrow();});
 it('keeps input-to-photon unknown and calculates interval decode and packet loss',()=>{const d=new StreamDiagnostics();const read=(frames:number,time:number,lost:number,received:number)=>d.ingest({inboundVideoStats:{framesDecoded:frames,totalDecodeTime:time,packetsLost:lost,packetsReceived:received,jitter:.002,framesPerSecond:60},getActiveCandidatePair:()=>({currentRoundTripTime:.018})});read(100,1,2,1000);const m=read(160,1.12,5,1097);expect(m.decodeMs).toBeCloseTo(2);expect(m.packetLossPercent).toBe(3);expect(m.rttMs).toBe(18);expect(m.displayLatencyMs).toBeNull();expect(d.encode(undefined).encodeMs).toBeNull();});
 it('leaves production UE streaming disabled until the migration gates pass',()=>{const c=JSON.parse(readFileSync('public/streaming-config.json','utf8'));const g=JSON.parse(readFileSync('infrastructure/pixel-streaming/migration-gates.json','utf8'));if(!Object.values(g.gates).every(v=>v===true)){expect(c.enabled).toBe(false);expect(c.allocatorUrl).toBeNull();}});
});
describe('Tactical interface and persisted display controls',()=>{
 it('renders real weapon characteristics and honest substitute-audio labels',()=>{const html=renderToStaticMarkup(<WeaponSelection/>);for(const name of ['밴달','팬텀','셰리프','자체 제작 대체음','피해','장착 선택','9.75'])expect(html).toContain(name);expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);});
 it('renders five accessible settings tabs and no disconnected save button',()=>{const html=renderToStaticMarkup(<SettingsPanel/>);for(const label of ['일반','조작','그래픽','오디오','훈련'])expect(html).toContain(label);expect(html.match(/role="tab"/g)).toHaveLength(5);expect(html).toContain('자동 저장');});
 it('restores weapon and engine-status deep links',()=>{expect(parseRoute('/weapons.html').activeTab).toBe('weapons');expect(parseRoute('/unreal.html').activeTab).toBe('stream');});
 it('persists new options and rejects unreasonable limits',()=>{let value='';const s=sanitizeSettings({...DEFAULT_SETTINGS,frameLimit:144,hudScale:1.15,showHeadshotConfirmation:false,showControlHints:false,interfaceVolume:.4});persistSettings(s,{setItem:(_k,v)=>{value=v;}});expect(loadSettings({getItem:()=>value})).toEqual(s);expect(sanitizeSettings({frameLimit:-100,hudScale:100,interfaceVolume:10}).frameLimit).toBe(0);expect(sanitizeSettings({hudScale:100}).hudScale).toBe(1.25);});
 it('caps drawing independently from simulation opportunities at 240Hz',()=>{const g=new RenderCadence();let draws=0;for(let i=0;i<240;i++)draws+=Number(g.shouldDraw(i*1000/240,60));expect(draws).toBe(60);expect(g.shouldDraw(1000,0)).toBe(true);});
 it('uses stable pacing across supported frame limits',()=>{for(const limit of [60,120,144,165,240]){const g=new RenderCadence();let n=0;for(let i=0;i<960;i++)n+=Number(g.shouldDraw(i*1000/240,limit));expect(Math.abs(n-4*limit)).toBeLessThanOrEqual(1);}});
});
describe('Portable C++ core compared with the browser simulation',()=>{
 const dir=mkdtempSync(join(tmpdir(),'valoprac-cross-')),exe=join(dir,'core');
 beforeAll(()=>{const r=spawnSync('g++',['-std=c++20','-O2','-Wall','-Wextra','-Werror','-Iunreal/VALOPRAC/Source/VALOPRAC/Core','unreal/tests/core_probe.cpp','-o',exe],{encoding:'utf8'});expect(r.stderr).toBe('');expect(r.status).toBe(0);},15000);
 afterAll(()=>rmSync(dir,{recursive:true,force:true}));
 for(const fps of [30,60,144,240])for(const [id,weapon] of WEAPON_ORDER.entries())it(`${WEAPONS[weapon].kind} produces equivalent results at ${fps} rendering FPS`,()=>{
  const native=spawnSync(exe,[String(fps),String(id)],{encoding:'utf8'});expect(native.status).toBe(0);const out=JSON.parse(native.stdout);
  const m=new Movement(),w=new Weapon(WEAPONS[weapon],1947),inState=emptyInput();w.autoReload=false;let time=0,count=0,sx=0,sy=0;const shots:number[]=[];
  for(let tick=0;tick<600;tick++){inState.forward=0;inState.strafe=0;if(tick<120)inState.strafe=-1;else if(tick>=160&&tick<200)inState.strafe=1;else if(tick>=220&&tick<300){inState.forward=1;inState.strafe=1;}inState.fire=tick>=320&&tick<560;inState.firePresses=tick===320?1:0;inState.ads=tick>=400;time+=1/120;m.step(inState,0,1/120,time);w.step(time,1/120,inState,()=>{const s=w.calculateSpread(m,inState.ads,false);sx+=s.x;sy+=s.y;w.recoil.kick(w.shotIndex,w.profile,w.recoilRng,m.crouch,time);count++;shots.push(w.firedAt);});}
  expect(out.ticks).toBe(600);expect(out.position[0]).toBeCloseTo(m.position.x,10);expect(out.position[1]).toBeCloseTo(m.position.z,10);expect(out.speed).toBeCloseTo(m.speed,10);expect(out.shots).toBe(count);expect(out.ammo).toBe(w.ammo);expect(out.pitch).toBeCloseTo(w.recoil.pitch,10);expect(out.yaw).toBeCloseTo(w.recoil.yaw,10);expect(out.spread[0]).toBeCloseTo(sx,10);expect(out.spread[1]).toBeCloseTo(sy,10);shots.forEach((s,i)=>expect(out.timestamps[i]).toBeCloseTo(s,10));
 });
});

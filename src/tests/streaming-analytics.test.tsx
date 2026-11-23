import {describe,it,expect,beforeAll,vi} from 'vitest';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {renderToStaticMarkup} from 'react-dom/server';
import {parseAnalytics,type AnalyticsSnapshot} from '../streaming/analyticsSchema';
import {parseEngineState,type EngineState,type Command} from '../streaming/protocol';
import {SessionRecorder} from '../streaming/SessionRecorder';
import {StreamingController} from '../streaming/StreamingController';
import {CaptureGate,requestStreamPointerLock} from '../streaming/PointerCapture';
import {DEFAULT_SETTINGS} from '../config/settings';
import {ResultDetails} from '../ui/Results';
import {RecoilReadout} from '../ui/LiveRecoil';
import {LifetimeStats} from '../training/analytics/LifetimeStats';
import {indexedDB as fakeIndexedDB} from 'fake-indexeddb';
import {saveSession,loadHistory,clearHistory} from '../storage/history';
import {summarize} from '../training/analytics/statistics';
import type {ShotEvent} from '../engine/types';
let pages:AnalyticsSnapshot[]=[];
const session='session';
const state=(a?:AnalyticsSnapshot,revision=1,finished=false):EngineState=>({v:1,session,revision,type:finished?'finished':'state',weapon:'rifleA',mode:'free',ammo:25,reserve:-1,reloading:false,paused:true,finished,time:10,shots:a?.totals.shots??0,hits:a?(a.totals.heads+a.totals.bodies+a.totals.limbs):0,heads:a?.totals.heads??0,eliminations:a?.totals.eliminations??0,speed:0,accurate:true,recoilPitch:0,recoilYaw:0,...(a?{analytics:a}:{})});
beforeAll(()=>{const dir=mkdtempSync(join(tmpdir(),'valoprac-analytics-'));try{const binary=join(dir,'probe');const c=spawnSync('g++',['-std=c++20','-O2','-Wall','-Wextra','-Werror','-Iunreal/VALOPRAC/Source/VALOPRAC/Core','unreal/tests/analytics_probe.cpp','-o',binary],{encoding:'utf8'});expect(c.stderr).toBe('');expect(c.status).toBe(0);const r=spawnSync(binary,[],{encoding:'utf8'});expect(r.status).toBe(0);pages=r.stdout.trim().split('\n').map(s=>{const value=JSON.parse(s);expect(parseAnalytics(value)).not.toBeNull();return value;});}finally{rmSync(dir,{recursive:true,force:true});}},15000);
describe('Actual portable C++ analytics output into the browser history adapter',()=>{
 it('serializes bounded, valid event pages with explicit lifetime counters',()=>{expect(pages.length).toBeGreaterThan(30);for(const p of pages){expect(p.events.length).toBeLessThanOrEqual(16);expect(JSON.stringify(p).length).toBeLessThan(62000);}expect(pages[1].totals.shots).toBe(601);});
 it('records first shots, recoil, spread and late opposite-input braking corrections once',()=>{const p=pages[0],recorder=new SessionRecorder(session,'free','rifleA',DEFAULT_SETTINGS);expect(recorder.accept(state(p))).toBe(p.lastSequence);recorder.accept(state(p,2));const data=recorder.snapshot()!;expect(data.shots).toHaveLength(1);expect(data.kills).toHaveLength(1);expect(data.reactions).toHaveLength(1);expect(data.summary.firstShotHeadshot).toBe(100);expect(data.shots[0].brakingKind).toBe('opposite');expect(data.shots[0].thresholdDelta).toBeLessThan(0);expect(data.summary.opposite.count).toBe(1);expect(data.summary.averageBrakeDuration).toBeGreaterThan(0);expect(data.summary.trackingAccuracy).toBe(100);});
 it('matches the existing TypeScript lifetime-statistics algorithm',()=>{const recorder=new SessionRecorder(session,'free','rifleA',DEFAULT_SETTINGS);recorder.accept(state(pages[0]));const data=recorder.snapshot()!,stats=new LifetimeStats();for(const shot of data.shots){stats.shot(shot);stats.settleBrake(shot);}for(const kill of data.kills)stats.kill(kill);const reference=stats.apply(summarize(data.shots,data.kills,data.reactions,data.tracking),null);for(const key of ['shots','heads','brakingSamples','averageBrakeDuration','averageDecelerationDuration','averageThresholdDelta','brakingConsistency','firstShotAccuracy','firstShotHeadshot','trackingAccuracy'] as const)expect(data.summary[key]).toBeCloseTo(reference[key],10);});
 it('detects evicted transport details without inventing missing shots or changing authoritative totals',()=>{const r=new SessionRecorder(session,'free','rifleA',DEFAULT_SETTINGS);r.accept(state(pages[1]));const d=r.snapshot()!;expect(d.summary.shots).toBe(601);expect(d.shots).toHaveLength(16);expect(d.streamEvidence!.lostEvents).toBeGreaterThan(0);expect(d.streamEvidence!.detailsComplete).toBe(false);expect(d.streamEvidence!.endedNormally).toBe(false);});
 it('waits for all final event pages, tolerates duplicate pages, then saves once',()=>{const commands:Command[]=[],saved:unknown[]=[];const c=new StreamingController(session,DEFAULT_SETTINGS,'free','rifleA',s=>commands.push(s),{state:()=>{},input:()=>{},ready:()=>{},error:()=>{},finished:s=>saved.push(s)});c.videoReady();c.channelReady();let rev=1;const hello=commands[0];c.receive(JSON.stringify({...state(undefined,rev++),type:'ack',ack:hello.seq}));for(const p of pages.slice(1,-1)){const pending=commands.filter(s=>s.type==='ackEvents').at(-1);const packet={...state(p,rev++,true),...(pending?{ack:pending.seq}:{})};c.receive(JSON.stringify(packet));c.receive(JSON.stringify(packet));}expect(saved).toHaveLength(1);expect((saved[0] as {summary:{shots:number}}).summary.shots).toBe(601);c.dispose();});
 it('resets the epoch without replaying old events or accepting old totals',()=>{const r=new SessionRecorder(session,'free','rifleA',DEFAULT_SETTINGS);r.accept(state(pages[0]));const reset=pages.at(-1)!;r.accept(state(reset,2));r.accept(state(pages[0],3));expect(r.snapshot()!.summary.shots).toBe(0);expect(r.snapshot()!.shots).toHaveLength(0);expect(r.snapshot()!.streamEvidence!.epoch).toBe(2);});
 it('renders real captured recoil and provenance, including interrupted-capture notices',()=>{const r=new SessionRecorder(session,'free','rifleA',DEFAULT_SETTINGS);r.accept(state(pages[0]));const data=r.snapshot()!,html=renderToStaticMarkup(<ResultDetails session={data}/>);expect(html).toContain('언리얼 스트림 기록');expect(html).toContain('중단 기록');expect(html).not.toContain('NaN');expect(renderToStaticMarkup(<RecoilReadout shots={data.shots} spread={.25} recoil={2}/>)).toContain('최근 36발');});
 it('does not synthesize records for a legacy engine without detailed analytics',()=>{const r=new SessionRecorder(session,'free','rifleA',DEFAULT_SETTINGS);r.accept(state());expect(r.snapshot()).toBeNull();expect(r.readyToSave).toBe(false);});
 it('rejects malformed, inconsistent and oversized event data',()=>{const bad=structuredClone(pages[0]);bad.totals.heads=10;expect(parseAnalytics(bad)).toBeNull();const b=structuredClone(pages[0]);(b.events[0].data as ShotEvent).position.x=NaN;expect(parseAnalytics(b)).toBeNull();const e=structuredClone(pages[0]);e.events=Array.from({length:17},()=>e.events[0]);expect(parseAnalytics(e)).toBeNull();expect(parseEngineState(JSON.stringify({...state(pages[0]),shots:100}),session)).toBeNull();});
 it('keeps a long received session bounded at 2048 shots while preserving lifetime totals',()=>{const r=new SessionRecorder(session,'free','sheriff',DEFAULT_SETTINGS);const raw=structuredClone(pages.at(-1)!);raw.epoch=3;raw.startSequence=1;raw.firstSequence=1;raw.acknowledged=0;let seq=0;const sample=pages[0].events.find(e=>e.type==='shot')!.data as ShotEvent;
 for(let batch=0;batch<160;batch++){raw.events=[];for(let i=0;i<16;i++){seq++;const data={...structuredClone(sample),weapon:'sheriff' as const,timestamp:seq/4,hit:'wall' as const,releaseTime:null,brakingKind:null,brakingDuration:null,thresholdDelta:null,decelerationDuration:null,initialSpeed:null,targetId:null,targetGeneration:null,targetPosition:null,targetState:null,impact:{x:seq%9/100,y:1.6+seq%7/100,z:-40}};raw.events.push({seq,type:'shot',data});}raw.lastSequence=seq;raw.totals.shots=seq;raw.totals.weapons.sheriff.shots=seq;const packet=state(raw,batch+1);packet.weapon='sheriff';expect(parseEngineState(JSON.stringify(packet),session)).not.toBeNull();r.accept(packet);}
 const data=r.snapshot()!;expect(data.summary.shots).toBe(2560);expect(data.shots).toHaveLength(2048);expect(data.summary.spray.count).toBe(2048);expect(data.streamEvidence!.lostEvents).toBe(0);expect(data.weaponTotals!.sheriff.shots).toBe(2560);
 });
});
describe('Stream handshake, coalescing and input ownership without a WebRTC mock claim',()=>{
 function setup(){const sent:Command[]=[],input:boolean[]=[],errors:string[]=[];let time=0,rev=1;const c=new StreamingController(session,DEFAULT_SETTINGS,'free','rifleA',s=>sent.push(s),{state:()=>{},input:s=>input.push(s),ready:()=>{},error:s=>errors.push(s),finished:()=>{}},()=>time);const reply=(command:Command,paused=true)=>c.receive(JSON.stringify({...state(undefined,rev++),type:'ack',ack:command.seq,weapon:command.type==='weapon'?command.payload.weapon:'rifleA',paused}));const ready=()=>{c.videoReady();c.channelReady();reply(sent.find(s=>s.type==='hello')!);for(const type of ['configure','weapon']){const cmd=sent.find(s=>s.type===type);if(cmd)reply(cmd);}};return {c,sent,input,errors,reply,ready,time:(t:number)=>{time=t;}};}
 it('does not send pre-video pings or assume hello has sequence number one',()=>{const x=setup();x.time(2000);x.c.tick();expect(x.sent).toHaveLength(0);x.c.protocol.command('ping');x.ready();expect(x.sent.find(s=>s.type==='hello')!.seq).toBe(2);expect(x.c.isReady).toBe(true);});
 it('requires capture and an engine resume acknowledgement before admitting input',()=>{const x=setup();x.ready();expect(x.c.resume(false)).toBe(false);x.c.resume(true);expect(x.input.at(-1)).toBe(false);x.reply(x.sent.find(s=>s.type==='resume')!,false);expect(x.input.at(-1)).toBe(true);});
 it('cannot re-enable input on a late resume acknowledgement after menu opening',()=>{const x=setup();x.ready();x.c.resume(true);const resume=x.sent.find(s=>s.type==='resume')!;x.c.pause();x.reply(resume,false);expect(x.input.at(-1)).toBe(false);});
 it('coalesces rapid configuration changes into the latest setting',()=>{const x=setup();x.ready();for(let i=0;i<50;i++)x.c.configure({...DEFAULT_SETTINGS,sensitivity:.5+i/100},'free');expect(x.c.protocol.pendingCount).toBeLessThanOrEqual(2);let next=x.sent.filter(s=>s.type==='configure').at(-1)!;x.reply(next);next=x.sent.filter(s=>s.type==='configure').at(-1)!;expect((next.payload.settings as typeof DEFAULT_SETTINGS).sensitivity).toBe(.99);x.reply(next);expect(x.c.protocol.hasPending('configure')).toBe(false);});
 it('reconnects through a new hello and keeps input disabled during interruption',()=>{const x=setup();x.ready();x.c.transportLost();expect(x.input.at(-1)).toBe(false);expect(x.c.isReady).toBe(false);x.c.videoReady();x.c.channelReady();const hello=x.sent.filter(s=>s.type==='hello').at(-1)!;expect(hello.seq).toBeGreaterThan(1);x.reply(hello);expect(x.c.isReady).toBe(true);expect(x.input.at(-1)).toBe(false);});
 it('stops admission and retries on timeout without growing the command queue',()=>{const x=setup();x.ready();x.c.resume(true);for(const t of [1600,3200,4800,6400]){x.time(t);x.c.tick();}expect(x.errors.length).toBeGreaterThan(0);expect(x.c.protocol.pendingCount).toBe(0);expect(x.input.at(-1)).toBe(false);});
 it('acknowledges an older command response without applying stale HUD state',()=>{const x=setup();const seq=x.c.protocol.command('ping');x.c.receive(JSON.stringify({...state(undefined,100)}));expect(x.c.protocol.receive(JSON.stringify({...state(undefined,1),type:'ack',ack:seq}))).toBeNull();expect(x.c.protocol.pendingCount).toBe(0);});
});
describe('Asynchronous pointer-lock admission',()=>{
 it('does not admit a cancelled late capture',async()=>{let resolve!:()=>void,owned=false,releases=0;const gate=new CaptureGate(()=>new Promise<void>(r=>{resolve=r;}),()=>owned,()=>{releases++;owned=false;});const p=gate.acquire();gate.cancel();owned=true;resolve();expect(await p).toBe(false);expect(releases).toBe(1);});
 it('admits a successful owned lock and releases it on disposal',async()=>{let owned=false;const gate=new CaptureGate(async()=>{owned=true;},()=>owned,()=>{owned=false;});expect(await gate.acquire()).toBe(true);gate.dispose();expect(owned).toBe(false);});
 it('propagates denied capture without declaring success',async()=>{const gate=new CaptureGate(async()=>{throw new Error('denied');},()=>false,()=>{});await expect(gate.acquire()).rejects.toThrow('denied');});
});

describe('Stream records in the existing IndexedDB history',()=>{
 it('persists authoritative totals, detail provenance and late corrections without duplicate sessions',async()=>{
  vi.stubGlobal('indexedDB',fakeIndexedDB);
  try{await clearHistory();const r=new SessionRecorder(session,'free','rifleA',DEFAULT_SETTINGS);r.accept(state(pages[0],1,true));const data=r.snapshot()!;await saveSession(data);await saveSession(data);const list=await loadHistory();expect(list).toHaveLength(1);expect(list[0]).toEqual(data);expect(list[0].shots[0].brakingKind).toBe('opposite');expect(list[0].streamEvidence!.endedNormally).toBe(true);await clearHistory();}finally{vi.unstubAllGlobals();}
 });
});
describe('Pointer Lock API event cleanup with a document adapter',()=>{
 function setup(){
  vi.useFakeTimers();class FakeDocument extends EventTarget{pointerLockElement:HTMLElement|null=null;releases=0;added=0;removed=0;
   override addEventListener(...args:Parameters<EventTarget['addEventListener']>){this.added++;super.addEventListener(...args);}
   override removeEventListener(...args:Parameters<EventTarget['removeEventListener']>){this.removed++;super.removeEventListener(...args);}
   exitPointerLock(){this.releases++;this.pointerLockElement=null;this.dispatchEvent(new Event('pointerlockchange'));}
  }
  const doc=new FakeDocument();vi.stubGlobal('document',doc);const host={requestPointerLock:()=>undefined} as unknown as HTMLElement;return {doc,host,clean:()=>{vi.unstubAllGlobals();vi.useRealTimers();}};
 }
 it('releases a cancelled late lock from the void-returning browser API and removes observers',async()=>{
  const x=setup();try{const abort=new AbortController(),p=requestStreamPointerLock(x.host,abort.signal),rejected=expect(p).rejects.toThrow('Cancelled');abort.abort();await rejected;await Promise.resolve();x.doc.pointerLockElement=x.host;x.doc.dispatchEvent(new Event('pointerlockchange'));expect(x.doc.pointerLockElement).toBeNull();expect(x.doc.releases).toBe(1);expect(x.doc.added).toBe(x.doc.removed);expect(vi.getTimerCount()).toBe(0);}finally{x.clean();}
 });
 it('does not release a newer lock when the cancelled older request completes',async()=>{
  const x=setup();try{const firstAbort=new AbortController(),first=requestStreamPointerLock(x.host,firstAbort.signal),rejected=expect(first).rejects.toThrow('Cancelled');firstAbort.abort();await rejected;const second=requestStreamPointerLock(x.host,new AbortController().signal);x.doc.pointerLockElement=x.host;x.doc.dispatchEvent(new Event('pointerlockchange'));await second;expect(x.doc.releases).toBe(0);expect(x.doc.pointerLockElement).toBe(x.host);expect(x.doc.added).toBe(x.doc.removed);expect(vi.getTimerCount()).toBe(0);}finally{x.clean();}
 });
 it('falls back only for unsupported raw movement and cleans up on denied capture',async()=>{
  const x=setup();try{let calls=0;x.host.requestPointerLock=(()=>{calls++;if(calls===1)return Promise.reject(new DOMException('raw','NotSupportedError'));}) as HTMLElement['requestPointerLock'];const p=requestStreamPointerLock(x.host,new AbortController().signal);await Promise.resolve();await Promise.resolve();x.doc.pointerLockElement=x.host;x.doc.dispatchEvent(new Event('pointerlockchange'));await p;expect(calls).toBe(2);expect(x.doc.added).toBe(x.doc.removed);
   x.doc.pointerLockElement=null;x.host.requestPointerLock=(()=>Promise.reject(new DOMException('denied','SecurityError'))) as HTMLElement['requestPointerLock'];await expect(requestStreamPointerLock(x.host,new AbortController().signal)).rejects.toThrow('denied');expect(vi.getTimerCount()).toBe(0);expect(x.doc.added).toBe(x.doc.removed);
  }finally{x.clean();}
 });
});

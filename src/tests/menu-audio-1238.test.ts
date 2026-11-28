import {afterEach,describe,expect,it} from 'vitest';
import {createElement as h} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {BEATS_PER_BAR,MUSIC_TRACK_IDS,SCALES,barEvents,loopBars,sectionAt,swingBeat,type Instrument} from '../engine/audio/music/composition';
import {MUSIC_TRACKS} from '../engine/audio/music/tracks';
import {shuffleBars} from '../engine/audio/music/MusicEngine';
import {INTERFACE_SOUND_SECONDS,createInterfaceSamples,interfaceSoundFor,type InterfaceSound} from '../ui/interfaceClick';
import {DEFAULT_SETTINGS,sanitizeSettings} from '../config/settings';
import {bandPower} from './helpers/spectrum';
import {setLocale,missingTranslations,clearMissingTranslations} from '../i18n/locale';
import {MusicOptions} from '../ui/music/MusicControl';
import {useApp} from '../app/store';

const PITCHED=new Set<Instrument>(['pad','keys','stab','arp','lead','bass','sub']);
const harmonicMinor=(track:string)=>track==='pressure'?[...SCALES['A minor'],8]:SCALES[MUSIC_TRACKS[track as keyof typeof MUSIC_TRACKS].key];
afterEach(async()=>{await setLocale('ko');clearMissingTranslations();});

describe('12.38 menu music composition',()=>{
 it('has five original tracks with distinct genres and tempos, each in a key that contains the interface tones A and E',()=>{
  expect(MUSIC_TRACK_IDS).toHaveLength(5);
  expect(new Set(MUSIC_TRACK_IDS.map(id=>MUSIC_TRACKS[id].bpm)).size).toBe(5);
  for(const id of MUSIC_TRACK_IDS){const scale=SCALES[MUSIC_TRACKS[id].key];expect(scale,id).toBeDefined();expect(scale).toContain(9);expect(scale).toContain(4);}
 });
 it('is deterministic, stays inside the bar and plays only notes of the key (lo-fi bass approach notes excepted)',()=>{
  for(const id of MUSIC_TRACK_IDS){const track=MUSIC_TRACKS[id],scale=harmonicMinor(id);
   for(let bar=0;bar<track.introBars+loopBars(track)*2;bar++){
    const events=barEvents(track,bar);expect(barEvents(track,bar)).toEqual(events);
    for(const e of events){expect(e.beat,`${id} ${bar}`).toBeGreaterThanOrEqual(0);expect(e.beat).toBeLessThan(BEATS_PER_BAR);expect(e.vel).toBeGreaterThan(0);expect(e.vel).toBeLessThanOrEqual(1);expect(e.dur).toBeGreaterThan(0);
     if(PITCHED.has(e.inst)&&!(id==='lofiFocus'&&e.inst==='bass'&&e.beat>=3.4))for(const n of e.notes)expect(scale,`${id} bar ${bar} ${e.inst} ${n}`).toContain(((n%12)+12)%12);}
   }}
 });
 it('plays the intro once, then loops A, B and a break; every section changes the arrangement',()=>{
  for(const id of MUSIC_TRACK_IDS){const t=MUSIC_TRACKS[id],L=loopBars(t);
   expect(sectionAt(t,0).name).toBe('intro');expect(sectionAt(t,t.introBars).name).toBe('a');expect(sectionAt(t,t.introBars+L).name).toBe('a');expect(sectionAt(t,t.introBars+L).pass).toBe(1);
   const kinds=(bar:number)=>new Set(barEvents(t,bar).map(e=>e.inst));
   const intro=kinds(1),a=kinds(t.introBars+1),b=kinds(t.introBars+t.form[0].bars+1);
   expect(a.size).toBeGreaterThan(intro.size);expect([...b].some(i=>!a.has(i))||b.size!==a.size).toBe(true);
   const seconds=shuffleBars(t)*4*60/t.bpm;expect(seconds).toBeGreaterThanOrEqual(150);expect(seconds).toBeLessThan(155);
  }
 });
 it('swings off-beats only for the lo-fi track',()=>{
  expect(swingBeat(1.5,.62)).toBeCloseTo(1.62);expect(swingBeat(1.75,.62)).toBeCloseTo(1.81);expect(swingBeat(2,.62)).toBe(2);expect(swingBeat(1.5,.5)).toBe(1.5);
  for(const id of MUSIC_TRACK_IDS)expect(MUSIC_TRACKS[id].swing).toBe(id==='lofiFocus'?.62:.5);
 });
});

describe('12.38 interface sounds',()=>{
 const kinds=Object.keys(INTERFACE_SOUND_SECONDS) as InterfaceSound[];
 it('renders every sound quietly with silent ends, no clicks and nothing harsh above 4 kHz',()=>{
  for(const rate of [44100,48000])for(const kind of kinds){
   const pcm=createInterfaceSamples(kind,rate),power=bandPower(pcm,rate);
   expect(pcm.length/rate,kind).toBeCloseTo(INTERFACE_SOUND_SECONDS[kind],3);
   expect(Math.abs(pcm[0])).toBeLessThan(1e-4);expect(Math.abs(pcm.at(-1)!),kind).toBeLessThan(1e-3);
   expect(power.peak,kind).toBeLessThan(.12);expect(power.above4000,kind).toBeLessThan(.00002);
   expect(Math.max(...Array.from(pcm,(v,i)=>i?Math.abs(v-pcm[i-1]):0)),kind).toBeLessThan(.02);
  }
 });
 it('keeps a hierarchy: hover and slider ticks are the quietest and shortest, starting a session the fullest',()=>{
  const energy=(k:InterfaceSound)=>createInterfaceSamples(k,48000).reduce((a,v)=>a+v*v,0);
  for(const k of kinds)if(k!=='hover'&&k!=='tick')expect(energy('hover'),k).toBeLessThan(energy(k)/4);
  for(const k of kinds)if(k!=='start')expect(energy('start'),k).toBeGreaterThan(energy(k));
  expect(INTERFACE_SOUND_SECONDS.hover).toBeLessThan(.05);
 });
 it('chooses the sound from the element: data-sound, toggles, tabs, start, back, disabled and plain buttons',()=>{
  const el=(o:{tag?:string;attrs?:Record<string,string>;classes?:string[];checked?:boolean;type?:string;tagged?:string}={})=>({
   closest(sel:string){if(sel==='[data-sound]')return o.tagged?{getAttribute:()=>o.tagged}:null;if(sel==='input')return o.tag==='input'?{type:o.type,checked:o.checked}:null;return o.tag==='input'?null:this;},
   getAttribute(name:string){return o.attrs?.[name]??null;},
   matches(sel:string){return (o.classes??[]).some(c=>sel.includes(`.${c}`))||(sel.includes('[role="tab"]')&&o.attrs?.role==='tab')||(sel.includes('summary')&&o.tag==='summary');},
   parentElement:{open:false},
  }) as unknown as Element;
  expect(interfaceSoundFor(el())).toBe('click');
  expect(interfaceSoundFor(el({tagged:'nav'}))).toBe('nav');
  expect(interfaceSoundFor(el({tagged:'none'}))).toBeNull();
  expect(interfaceSoundFor(el({tag:'input',type:'checkbox',checked:true}))).toBe('toggleOn');
  expect(interfaceSoundFor(el({tag:'input',type:'checkbox',checked:false}))).toBe('toggleOff');
  expect(interfaceSoundFor(el({tag:'input',type:'range'}))).toBeNull();
  expect(interfaceSoundFor(el({classes:['start-button']}))).toBe('start');
  expect(interfaceSoundFor(el({attrs:{role:'tab'}}))).toBe('nav');
  expect(interfaceSoundFor(el({attrs:{'aria-label':'패치노트 닫기'}}))).toBe('back');
  expect(interfaceSoundFor(el({attrs:{'aria-disabled':'true'}}))).toBe('denied');
  expect(interfaceSoundFor(el({tag:'summary'}))).toBe('toggleOn');
 });
});

describe('12.38 music settings',()=>{
 it('defaults to the ambient track at its own volume, off in training, and sanitises stored values',()=>{
  expect(DEFAULT_SETTINGS.musicTrack).toBe('nightRange');expect(DEFAULT_SETTINGS.musicInTraining).toBe(false);expect(DEFAULT_SETTINGS.musicVolume).toBeGreaterThan(0);
  expect(sanitizeSettings({musicTrack:'pressure',musicVolume:3,musicInTraining:true})).toMatchObject({musicTrack:'pressure',musicVolume:1,musicInTraining:true});
  expect(sanitizeSettings({musicTrack:'shuffle'}).musicTrack).toBe('shuffle');expect(sanitizeSettings({musicTrack:'off'}).musicTrack).toBe('off');
  expect(sanitizeSettings({musicTrack:'someone-elses-song',musicVolume:-1}).musicTrack).toBe('nightRange');expect(sanitizeSettings({musicVolume:-1}).musicVolume).toBe(0);
  expect(sanitizeSettings({}).musicVolume).toBe(DEFAULT_SETTINGS.musicVolume);
 });
 it('renders the music options fully in English',async()=>{
  await setLocale('en');clearMissingTranslations();
  for(const musicTrack of ['nightRange','shuffle','off'] as const){useApp.setState(s=>({settings:{...s.settings,musicTrack}}));const html=renderToStaticMarkup(h(MusicOptions));expect(html).toContain('Night Range');expect(html).toContain('Music volume');}
  expect(missingTranslations()).toEqual([]);
 });
});

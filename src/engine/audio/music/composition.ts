/** Pure, deterministic description of the menu music (12.38). A track turns a
 * bar number into note events; the Web Audio engine only plays them. Every
 * melody, progression and pattern here is original. */
export type Instrument='pad'|'keys'|'stab'|'arp'|'lead'|'bass'|'sub'|'kick'|'snare'|'clap'|'hat'|'openHat'|'rim'|'tom'|'shaker'|'riser'|'crackle';
export interface NoteEvent{inst:Instrument;/** Beat within the bar (0..4). */beat:number;/** Length in beats. */dur:number;notes:number[];/** 0..1 */vel:number}
export type SectionName='intro'|'a'|'b'|'break';
export interface Section{name:SectionName;bars:number}
export interface SectionInfo{name:SectionName;bar:number;bars:number;/** How many times the loop has repeated. */pass:number;last:boolean}
export interface Tone{wave:OscillatorType;cutoff:number;attack:number;release:number;detune?:number;q?:number;/** Bass only: per-note filter sweep (false = static bus filter, cheaper). */sweep?:boolean}
export interface TrackSound{pad:Tone;keys:Tone;stab:Tone;arp:Tone;lead:Tone;bass:Tone;
  /** Reverb and echo send per instrument (0..1). */reverb:Partial<Record<Instrument,number>>;delay:Partial<Record<Instrument,number>>;
  /** Continuous vinyl hiss level (0 = none). */hiss:number}
export interface MusicTrack{
  id:MusicTrackId;name:string;mood:string;bpm:number;key:string;
  /** 8th-note swing: the off-beat lands at this fraction of the beat (0.5 = straight). */swing:number;
  introBars:number;form:Section[];sound:TrackSound;mix:Partial<Record<Instrument,number>>;
  /** Overall loudness trim, calibrated by rendering (docs/MENU_AUDIO_12.38.md). */gain:number;
  compose(bar:number,section:SectionInfo,rand:()=>number):NoteEvent[];
}
export const MUSIC_TRACK_IDS=['nightRange','neonRun','lofiFocus','pressure','dawnPatrol'] as const;
export type MusicTrackId=typeof MUSIC_TRACK_IDS[number];
export type MusicChoice=MusicTrackId|'shuffle'|'off';
export const BEATS_PER_BAR=4;

export function mulberry32(seed:number){let a=seed>>>0;return()=>{a=(a+0x6d2b79f5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
export const loopBars=(track:MusicTrack)=>track.form.reduce((sum,s)=>sum+s.bars,0);
export const barSeconds=(track:MusicTrack)=>BEATS_PER_BAR*60/track.bpm;

export function sectionAt(track:MusicTrack,bar:number):SectionInfo{
  if(bar<track.introBars)return{name:'intro',bar,bars:track.introBars,pass:0,last:bar===track.introBars-1};
  const length=loopBars(track),offset=bar-track.introBars,pass=Math.floor(offset/length);let inLoop=offset%length;
  for(const section of track.form){if(inLoop<section.bars)return{name:section.name,bar:inLoop,bars:section.bars,pass,last:inLoop===section.bars-1};inLoop-=section.bars;}
  throw new Error('unreachable');
}
/** Swing straight 8th/16th off-beats toward `swing` of the beat. */
export function swingBeat(beat:number,swing:number){
  const whole=Math.floor(beat),frac=beat-whole,shift=swing-.5;
  if(Math.abs(frac-.5)<1e-9)return whole+.5+shift;
  if(Math.abs(frac-.25)<1e-9||Math.abs(frac-.75)<1e-9)return beat+shift/2;
  return beat;
}
const DRUMS=new Set<Instrument>(['kick','snare','clap','hat','openHat','rim','tom','shaker']);
/** The events of one bar, swung, humanised and sorted. Same bar, same result. */
export function barEvents(track:MusicTrack,bar:number):NoteEvent[]{
  const rand=mulberry32(hashId(track.id)*31+bar*7919),section=sectionAt(track,bar);
  return track.compose(bar,section,rand).map(e=>{
    let beat=DRUMS.has(e.inst)||e.inst==='keys'||e.inst==='bass'?swingBeat(e.beat,track.swing):e.beat;
    if(DRUMS.has(e.inst)&&beat>0)beat+=(rand()-.5)*.012;
    return{...e,beat:Math.min(BEATS_PER_BAR-1e-6,Math.max(0,beat)),vel:Math.min(1,Math.max(0,e.vel))};
  }).sort((a,b)=>a.beat-b.beat);
}
export function hashId(id:string){let h=2166136261;for(let i=0;i<id.length;i++)h=Math.imul(h^id.charCodeAt(i),16777619);return h>>>0;}

/** "x" = hit, "o" = accent, "." = rest; 16 steps per bar. */
export function steps(pattern:string,inst:Instrument,vel:number,dur=.25,notes:number[]=[0]):NoteEvent[]{
  const out:NoteEvent[]=[];[...pattern.replace(/\s/g,'')].forEach((c,i)=>{if(c==='x'||c==='o')out.push({inst,beat:i/4,dur,notes,vel:c==='o'?Math.min(1,vel*1.25):vel});});return out;
}
/** Melody list [beat-in-phrase, midi, length] sliced to one bar. */
export function phraseBar(phrase:[number,number,number][],barInPhrase:number,inst:Instrument,vel:number):NoteEvent[]{
  const from=barInPhrase*BEATS_PER_BAR;return phrase.filter(([b])=>b>=from&&b<from+BEATS_PER_BAR).map(([b,m,d])=>({inst,beat:b-from,dur:d,notes:[m],vel}));
}
/** Scale membership for tests and the comparison report. */
export const SCALES:Record<string,number[]>={'A minor':[9,11,0,2,4,5,7],'D minor':[2,4,5,7,9,10,0],'C major':[0,2,4,5,7,9,11],'F major':[5,7,9,10,0,2,4]};

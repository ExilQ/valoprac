import {phraseBar,steps,type MusicTrack,type MusicTrackId,type NoteEvent,type TrackSound} from './composition';

/* Five original pieces (12.38). Genres follow what menu and lobby music in
 * competitive shooters and aim trainers usually is: an ambient lobby theme, a
 * driving synth theme, a low-key focus beat, a tension cue and a bright one.
 * All keys keep A and E in the scale so the interface tones (A/E) never clash. */
const chordBar=(progression:number[][],barsPerChord:number,bar:number)=>progression[Math.floor(bar/barsPerChord)%progression.length];
const fill=(rand:()=>number,pattern:string)=>rand()<.5?pattern:pattern.replace(/x(?=[^x]*$)/,'.');
const sound=(overrides:Partial<TrackSound>):TrackSound=>({
  pad:{wave:'sawtooth',cutoff:2200,attack:.8,release:1.6,detune:9},keys:{wave:'sine',cutoff:3600,attack:.004,release:.5},
  stab:{wave:'sawtooth',cutoff:2600,attack:.004,release:.12},arp:{wave:'triangle',cutoff:3200,attack:.003,release:.18},
  lead:{wave:'sawtooth',cutoff:2400,attack:.02,release:.25,detune:6},bass:{wave:'sawtooth',cutoff:700,attack:.005,release:.08},
  reverb:{pad:.5,keys:.3,arp:.35,lead:.4,snare:.35,clap:.35,rim:.3,stab:.25,tom:.3},delay:{arp:.25,lead:.25},hiss:0,...overrides});

/** A minor, 84 BPM: a calm lobby theme. i - VI - III - v, two bars each. */
const NIGHT=[[57,60,64,67,71],[53,57,60,64],[55,59,60,64],[52,55,59,62]],NIGHT_BASS=[33,29,36,28];
const NIGHT_LEAD:[number,number,number][]=[[0,76,2],[2,74,1],[3,72,1],[4,71,3],[7,72,1],[8,69,2],[10,72,1],[11,76,1],[12,74,4],[16,72,2],[18,71,1],[19,67,1],[20,72,3],[23,74,1],[24,71,3],[27,67,1],[28,69,4]];
const nightRange:MusicTrack={id:'nightRange',name:'야간 사격장',mood:'잔잔한 앰비언트',bpm:84,key:'A minor',swing:.5,introBars:8,
  form:[{name:'a',bars:16},{name:'b',bars:16},{name:'break',bars:8}],gain:1,
  sound:sound({arp:{wave:'triangle',cutoff:2600,attack:.004,release:.35},lead:{wave:'triangle',cutoff:3000,attack:.03,release:.5,detune:4}}),
  mix:{pad:.5,arp:.32,lead:.38,bass:.55,kick:.6,rim:.25,hat:.12,shaker:.14},
  compose(bar,s,rand){
    const chord=chordBar(NIGHT,2,bar),bass=NIGHT_BASS[Math.floor(bar/2)%4],out:NoteEvent[]=[];
    if(bar%2===0)out.push({inst:'pad',beat:0,dur:8,notes:chord,vel:.8});
    const order=[0,2,1,3,2,4,3,1];const tones=[...chord.slice(0,4).map(n=>n+12),chord[1]+24];
    for(let i=0;i<8;i++)if(s.name!=='intro'||i%2===0)if(rand()>.12)out.push({inst:'arp',beat:i/2,dur:.5,notes:[tones[order[i]%tones.length]],vel:.55+.25*rand()});
    if(s.name==='intro')return out;
    out.push({inst:'bass',beat:0,dur:2.5,notes:[bass],vel:.8},{inst:'bass',beat:3,dur:1,notes:[bass+(bar%2?7:12)],vel:.55});
    if(s.name!=='break'){out.push(...steps('x.........x.....','kick',.8),...steps('............x...','rim',.6),...steps('..x...x...x...x.','hat',.5));
      if(s.name==='b')out.push(...steps('.x.x.x.x.x.x.x.x','shaker',.5),...phraseBar(NIGHT_LEAD,bar%8,'lead',.7));}
    else out.push(...phraseBar(NIGHT_LEAD,bar%8,'lead',.45));
    return out;
  }};

/** D minor, 104 BPM: driving synthwave. i - VI - III - VII. */
const NEON=[[50,53,57,62],[46,50,53,58],[45,48,53,57],[48,52,55,60]],NEON_BASS=[38,34,41,36];
const NEON_LEAD:[number,number,number][]=[[0,69,1.5],[1.5,72,.5],[2,74,1],[3,72,1],[4,70,2],[6,69,1],[7,67,1],[8,69,1.5],[9.5,65,.5],[10,69,1],[11,72,1],[12,67,3],[15,64,1],
  [16,69,1.5],[17.5,72,.5],[18,74,1],[19,77,1],[20,77,1],[21,76,1],[22,74,2],[24,72,1.5],[25.5,74,.5],[26,72,1],[27,69,1],[28,67,2],[30,64,1],[31,67,1]];
const neonRun:MusicTrack={id:'neonRun',name:'네온 질주',mood:'신스웨이브',bpm:104,key:'D minor',swing:.5,introBars:8,
  form:[{name:'a',bars:16},{name:'b',bars:16},{name:'break',bars:8}],gain:1,
  sound:sound({arp:{wave:'square',cutoff:2400,attack:.002,release:.12},pad:{wave:'sawtooth',cutoff:1700,attack:.35,release:1.2,detune:12},
    reverb:{pad:.45,arp:.3,lead:.45,snare:.6,tom:.4,stab:.3},delay:{arp:.3,lead:.35}}),
  mix:{pad:.4,arp:.26,lead:.36,bass:.55,kick:.75,snare:.55,hat:.18,tom:.45,riser:.3},
  compose(bar,s,rand){
    const chord=chordBar(NEON,1,bar),b=NEON_BASS[bar%4],out:NoteEvent[]=[{inst:'pad',beat:0,dur:4,notes:chord,vel:.75}];
    const up=[0,1,2,3,2,1,2,3];for(let i=0;i<16;i++)if(s.name!=='intro'||i%4===0)out.push({inst:'arp',beat:i/4,dur:.25,notes:[chord[up[i%8]]+12],vel:i%4===0?.8:.5+.2*rand()});
    if(s.name==='intro'){if(bar>=6)out.push({inst:'riser',beat:0,dur:4,notes:[0],vel:bar===7?.9:.5});return out;}
    if(s.name!=='break')for(let i=0;i<8;i++)out.push({inst:'bass',beat:i/2,dur:.45,notes:[b+(i%2?12:0)],vel:i%2?.6:.85});
    else out.push({inst:'bass',beat:0,dur:4,notes:[b],vel:.6});
    if(s.name==='a'||s.name==='b'){out.push(...steps('x.......x.......','kick',.9),...steps('....x.......x...','snare',.8),...steps('x.x.x.x.x.x.x.x.','hat',.45));
      if(s.name==='b')out.push(...phraseBar(NEON_LEAD,bar%8,'lead',.75));
      if(s.last)out.push(...steps(fill(rand,'........x.x.xxxx'),'tom',.7,.25,[45]));}
    else{out.push(...phraseBar(NEON_LEAD,bar%8,'lead',.5));if(s.bar>=6)out.push({inst:'riser',beat:0,dur:4,notes:[0],vel:s.last?.9:.5});}
    return out;
  }};

/** C major, 76 BPM, swung: a lo-fi focus beat. IV - iii - ii - I. */
const LOFI=[[53,57,60,64],[52,55,59,62],[50,53,57,60,64],[48,52,55,59]],LOFI_BASS=[41,40,38,36];
const LOFI_MELODY:[number,number,number][]=[[.5,72,1],[1.5,76,1.5],[4.5,74,.5],[5,71,2],[8.5,69,1],[9.5,72,1],[10.5,74,1],[12,67,3],
  [16.5,72,1],[17.5,76,1],[18.5,79,1],[20.5,74,.5],[21,71,2],[24.5,69,1],[25.5,72,1],[26.5,71,1],[28,72,2],[30,71,1],[31,67,1]];
const lofiFocus:MusicTrack={id:'lofiFocus',name:'로파이 집중',mood:'로파이 비트',bpm:76,key:'C major',swing:.62,introBars:4,
  form:[{name:'a',bars:16},{name:'b',bars:16},{name:'break',bars:4}],gain:1.33,
  sound:sound({bass:{wave:'triangle',cutoff:520,attack:.012,release:.12},lead:{wave:'sine',cutoff:2600,attack:.006,release:.6},hiss:.012,
    reverb:{keys:.35,lead:.35,snare:.3,rim:.25},delay:{lead:.2}}),
  mix:{keys:.5,bass:.62,kick:.7,snare:.42,rim:.3,hat:.16,lead:.4,crackle:.35},
  compose(bar,s,rand){
    const chord=chordBar(LOFI,1,bar),b=LOFI_BASS[bar%4],next=LOFI_BASS[(bar+1)%4],out:NoteEvent[]=[];
    const strum=(beat:number,dur:number,vel:number)=>chord.forEach((n,i)=>out.push({inst:'keys',beat:beat+i*.03,dur,notes:[n+12],vel:vel*(1-.05*i)}));
    strum(0,1.4,.75);strum(2.5,1.2,.6);if(rand()<.4)strum(3.5,.4,.4);
    if(rand()<.6)out.push({inst:'crackle',beat:rand()*4,dur:.05,notes:[0],vel:.3+.5*rand()});
    if(s.name==='intro'||s.name==='break')return out;
    out.push({inst:'bass',beat:0,dur:1.4,notes:[b],vel:.85},{inst:'bass',beat:2.5,dur:.9,notes:[b+7],vel:.6},{inst:'bass',beat:3.5,dur:.45,notes:[next+(next>b?-1:1)],vel:.5});
    out.push(...steps('x.....x...x.....','kick',.85),...steps('....x.......x...','snare',.7));
    for(let i=0;i<8;i++)if(rand()>.15)out.push({inst:'hat',beat:i/2,dur:.1,notes:[0],vel:(i%2?.35:.55)+.15*rand()});
    if(s.name==='b')out.push(...phraseBar(LOFI_MELODY,bar%8,'lead',.65));else if(s.bar%4===3)out.push(...steps('..............x.','rim',.5));
    return out;
  }};

/** A (harmonic) minor, 128 BPM: a tension cue. i - VI - iv - V, two bars each. */
const PRESSURE=[[57,60,64],[53,57,60],[50,53,57],[52,56,59]],PRESSURE_BASS=[33,29,38,28];
const pressure:MusicTrack={id:'pressure',name:'압박',mood:'긴장감 있는 전자음',bpm:128,key:'A minor',swing:.5,introBars:8,
  form:[{name:'a',bars:16},{name:'b',bars:16},{name:'break',bars:8}],gain:1.13,
  sound:sound({bass:{wave:'sawtooth',cutoff:900,attack:.003,release:.05,sweep:false},stab:{wave:'sawtooth',cutoff:3000,attack:.002,release:.09},
    pad:{wave:'sawtooth',cutoff:800,attack:1.5,release:2,detune:14},arp:{wave:'square',cutoff:3400,attack:.002,release:.1},
    reverb:{pad:.5,stab:.35,clap:.4,tom:.45,arp:.3},delay:{stab:.2,arp:.3}}),
  mix:{pad:.36,bass:.5,sub:.45,stab:.32,arp:.2,kick:.85,clap:.5,hat:.3,openHat:.26,tom:.5,riser:.32},
  compose(bar,s,rand){
    const chord=chordBar(PRESSURE,2,bar),b=PRESSURE_BASS[Math.floor(bar/2)%4],out:NoteEvent[]=[];
    if(bar%2===0)out.push({inst:'pad',beat:0,dur:8,notes:[45,52],vel:.7},{inst:'sub',beat:0,dur:8,notes:[b],vel:.8});
    const ost=[0,0,12,0,0,12,0,7,0,0,12,0,0,12,7,0];
    for(let i=0;i<16;i++)if(s.name!=='intro'||i%2===0)out.push({inst:'bass',beat:i/4,dur:.2,notes:[b+ost[i]],vel:i%4===0?.85:.55});
    out.push(...steps('..x.x.x.x.x.x.x.','hat',s.name==='intro'?.3:.45));
    if(s.name==='intro'){if(bar>=6)out.push({inst:'riser',beat:0,dur:4,notes:[0],vel:bar===7?1:.55});return out;}
    out.push(...steps(s.name==='b'?'x..x..x...x..x..':'x.....x.........','stab',.75,.2,chord.map(n=>n+12)));
    if(s.name==='a')out.push(...steps('x.......x.......','kick',.9));
    if(s.name==='b'){out.push(...steps('x...x...x...x...','kick',.95),...steps('....x.......x...','clap',.75),...steps('..x...x...x...x.','openHat',.4));
      const tones=chord.map(n=>n+24);for(let i=0;i<8;i++)out.push({inst:'arp',beat:i/2,dur:.4,notes:[tones[[2,0,1,0][i%4]]],vel:.6});
      if(s.bar%8>=6)out.push({inst:'riser',beat:0,dur:4,notes:[0],vel:s.bar%8===7?1:.5});}
    if(s.last&&s.name!=='break')out.push(...steps(fill(rand,'........x.x.x.xx'),'tom',.8,.25,[40]));
    if(s.name==='break'&&s.bar>=4)out.push({inst:'riser',beat:0,dur:4,notes:[0],vel:.35+.15*(s.bar-4)});
    return out;
  }};

/** F major, 98 BPM: bright house. I - iii - vi - V. */
const DAWN=[[53,57,60,64],[52,55,57,60],[50,53,57,60],[48,52,55,60]],DAWN_BASS=[41,45,38,36];
const DAWN_LEAD:[number,number,number][]=[[0,72,1],[1,74,.5],[1.5,76,1.5],[3,72,1],[4,76,1],[5,79,1],[6,76,1],[7,74,1],[8,74,1],[9,72,1],[10,69,2],[12,72,1],[13,67,1],[14,72,2],
  [16,72,1],[17,74,.5],[17.5,76,1.5],[19,79,1],[20,81,1.5],[21.5,79,.5],[22,76,2],[24,74,1],[25,76,1],[26,72,2],[28,74,1],[29,72,1],[30,69,2]];
const dawnPatrol:MusicTrack={id:'dawnPatrol',name:'새벽 순찰',mood:'밝은 하우스',bpm:98,key:'F major',swing:.5,introBars:8,
  form:[{name:'a',bars:16},{name:'b',bars:16},{name:'break',bars:8}],gain:1,
  sound:sound({stab:{wave:'square',cutoff:2200,attack:.003,release:.1},lead:{wave:'square',cutoff:2800,attack:.01,release:.2,detune:5},
    pad:{wave:'sawtooth',cutoff:1500,attack:.6,release:1.4,detune:10},reverb:{pad:.45,stab:.3,lead:.35,clap:.35},delay:{stab:.2,lead:.3}}),
  mix:{pad:.36,stab:.32,bass:.55,lead:.32,kick:.8,clap:.5,hat:.3,openHat:.3},
  compose(bar,s,rand){
    const chord=chordBar(DAWN,1,bar),b=DAWN_BASS[bar%4],out:NoteEvent[]=[{inst:'pad',beat:0,dur:4,notes:chord,vel:.7}];
    out.push(...steps('..x...x...x...x.','stab',.7,.3,chord.map(n=>n+12)));
    if(s.name==='intro')return out;
    if(s.name!=='break'){for(let i=0;i<4;i++)out.push({inst:'bass',beat:i+.5,dur:.4,notes:[b+(i===3&&rand()<.5?12:0)],vel:.8});
      out.push(...steps('x...x...x...x...','kick',.9),...steps('.x.x.x.x.x.x.x.x','hat',.4));
      if(s.name==='b')out.push(...steps('....x.......x...','clap',.75),...steps('..x...x...x...x.','openHat',.45),...phraseBar(DAWN_LEAD,bar%8,'lead',.7));}
    else out.push({inst:'bass',beat:0,dur:4,notes:[b],vel:.5},...phraseBar(DAWN_LEAD,bar%8,'lead',.55));
    return out;
  }};

export const MUSIC_TRACKS:Record<MusicTrackId,MusicTrack>={nightRange,neonRun,lofiFocus,pressure,dawnPatrol};

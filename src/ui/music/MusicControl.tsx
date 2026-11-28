import {useEffect,useId,useRef,useState,useSyncExternalStore} from 'react';
import {Music,Shuffle,VolumeX} from 'lucide-react';
import {useApp} from '../../app/store';
import {MUSIC_TRACK_IDS,type MusicChoice} from '../../engine/audio/music/composition';
import {MUSIC_TRACKS} from '../../engine/audio/music/tracks';
import {musicStatus} from './menuMusic';
import './music.css';

const label=(choice:MusicChoice)=>choice==='off'?'음악 끔':choice==='shuffle'?'무작위 재생':MUSIC_TRACKS[choice].name;
/** Track list, music volume and the in-training option. */
export function MusicOptions(){
  const s=useApp(x=>x.settings),update=useApp(x=>x.updateSettings),id=useId();
  const status=useSyncExternalStore(musicStatus.subscribe,musicStatus.get,musicStatus.get),current=useSyncExternalStore(musicStatus.subscribe,musicStatus.current,()=>null);
  const option=(choice:MusicChoice,title:string,detail:string,icon?:React.ReactNode)=><label key={choice} className={`music-option${s.musicTrack===choice?' selected':''}`}>
    <input type="radio" name={`${id}-track`} checked={s.musicTrack===choice} onChange={()=>update({musicTrack:choice})}/>
    <span className="music-option-text"><strong>{icon}{title}</strong><small>{detail}</small></span>
    {current===choice&&status==='playing'&&<span className="music-playing" aria-label="재생 중"><i/><i/><i/></span>}
  </label>;
  return <div className="music-options">
    <fieldset><legend>곡 선택</legend>
      {MUSIC_TRACK_IDS.map(t=>option(t,MUSIC_TRACKS[t].name,`${MUSIC_TRACKS[t].mood} · ${MUSIC_TRACKS[t].bpm} BPM`))}
      {option('shuffle','무작위 재생','곡마다 약 2~3분씩 이어서 재생',<Shuffle size={13} aria-hidden="true"/>)}
      {option('off','끄기','메뉴 음악을 재생하지 않음',<VolumeX size={13} aria-hidden="true"/>)}
    </fieldset>
    <div className="range-field music-volume"><label htmlFor={`${id}-volume`}>음악 음량 <b>{Math.round(s.musicVolume*100)}%</b></label>
      <input id={`${id}-volume`} type="range" min={0} max={1} step={.05} value={s.musicVolume} onChange={e=>update({musicVolume:Number(e.target.value)})}/></div>
    <label className="toggle-field"><span>훈련 중에도 재생 (발소리를 위해 작게)</span><input type="checkbox" checked={s.musicInTraining} onChange={e=>update({musicInTraining:e.target.checked})}/><i aria-hidden="true"/></label>
    <p className="field-note">{status==='waiting'?'화면을 한 번 누르면 재생됩니다. ':''}모든 곡은 VALOPRAC가 직접 만든 곡이며, 브라우저에서 실시간으로 연주됩니다. 전체 음량과 음악 음량을 곱한 크기로 재생됩니다.</p>
  </div>;
}
/** Top-bar button that opens the music options. */
export function MusicControl(){
  const choice=useApp(x=>x.settings.musicTrack),[open,setOpen]=useState(false),root=useRef<HTMLDivElement>(null),id=useId();
  const status=useSyncExternalStore(musicStatus.subscribe,musicStatus.get,musicStatus.get);
  useEffect(()=>{if(!open)return;
    const close=(e:PointerEvent)=>{if(root.current&&!root.current.contains(e.target as Node))setOpen(false);};
    const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){setOpen(false);root.current?.querySelector('button')?.focus();}};
    document.addEventListener('pointerdown',close);document.addEventListener('keydown',key);return()=>{document.removeEventListener('pointerdown',close);document.removeEventListener('keydown',key);};},[open]);
  return <div className="music-control" ref={root}>
    <button className="music-button" aria-expanded={open} aria-controls={`${id}-panel`} title="메뉴 음악" onClick={()=>setOpen(v=>!v)} data-sound={open?'back':'nav'}>
      {choice==='off'?<VolumeX size={16} aria-hidden="true"/>:<Music size={16} aria-hidden="true"/>}<span className="music-button-label">{label(choice)}</span>
      {status==='playing'&&<span className="music-playing" aria-hidden="true"><i/><i/><i/></span>}
    </button>
    {open&&<div className="music-panel" id={`${id}-panel`} role="dialog" aria-label="메뉴 음악"><h2>메뉴 음악</h2><MusicOptions/></div>}
  </div>;
}

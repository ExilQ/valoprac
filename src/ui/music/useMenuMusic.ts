import {useEffect} from 'react';
import {useApp} from '../../app/store';
import {installMusicLifecycle,setMusic,TRAINING_MUSIC_DUCK} from './menuMusic';

/** Plays the chosen menu track; in training only if the player asked for it. */
export function useMenuMusic(){
  const screen=useApp(s=>s.screen),track=useApp(s=>s.settings.musicTrack),volume=useApp(s=>s.settings.volume),music=useApp(s=>s.settings.musicVolume),inTraining=useApp(s=>s.settings.musicInTraining);
  useEffect(()=>installMusicLifecycle(document),[]);
  useEffect(()=>{
    const training=screen==='training';
    setMusic(training&&!inTraining?'off':track,volume*music*(training?TRAINING_MUSIC_DUCK:1));
  },[screen,track,volume,music,inTraining]);
}

import {MusicEngine} from '../../engine/audio/music/MusicEngine';
import type {MusicChoice} from '../../engine/audio/music/composition';

/** One menu-music player for the page (12.38). Browsers only allow audio after
 * a user gesture, so the first click or key press starts it. */
export type MusicStatus='off'|'waiting'|'playing';
let engine:MusicEngine|null=null,context:AudioContext|null=null,status:MusicStatus='off',choice:MusicChoice='off',level=0,offTimer:ReturnType<typeof setTimeout>|null=null;
const listeners=new Set<()=>void>();
function publish(next:MusicStatus){if(next===status)return;status=next;for(const l of listeners)l();}
export const musicStatus={subscribe(l:()=>void){listeners.add(l);return()=>{listeners.delete(l);};},get:()=>status,current:()=>engine?.current??null};

function apply(){
  if(!engine||!context){publish(choice==='off'?'off':'waiting');return;}
  if(offTimer){clearTimeout(offTimer);offTimer=null;}
  engine.setLevel(level);engine.select(choice);
  if(choice==='off'){publish('off');
    // Let the fade finish, then stop the audio thread.
    offTimer=setTimeout(()=>{if(choice==='off'&&context?.state==='running')void context.suspend();},2500);return;}
  if(typeof document!=='undefined'&&document.hidden)return;
  if(context.state!=='running')void context.resume().then(()=>publish(context?.state==='running'?'playing':'waiting')).catch(()=>publish('waiting'));
  else publish('playing');
}
/** Desired track and level (master x music x ducking). */
export function setMusic(nextChoice:MusicChoice,nextLevel:number){choice=nextChoice;level=nextLevel;apply();}
/** Call from a user gesture: creates the audio context the first time. */
export function unlockMusic(){
  if(choice==='off'||engine)return;
  if(typeof AudioContext==='undefined')return;
  try{context=new AudioContext({latencyHint:'playback'});engine=new MusicEngine(context,context.destination);}catch{context=null;engine=null;return;}
  apply();
}
export function installMusicLifecycle(target:Document){
  const gesture=()=>{unlockMusic();if(engine){target.removeEventListener('pointerdown',gesture,true);target.removeEventListener('keydown',gesture,true);}};
  const visibility=()=>{if(!context)return;if(target.hidden)void context.suspend();else if(choice!=='off')void context.resume();};
  target.addEventListener('pointerdown',gesture,true);target.addEventListener('keydown',gesture,true);target.addEventListener('visibilitychange',visibility);
  return()=>{target.removeEventListener('pointerdown',gesture,true);target.removeEventListener('keydown',gesture,true);target.removeEventListener('visibilitychange',visibility);
    engine?.dispose();engine=null;if(context)void context.close().catch(()=>{});context=null;publish(choice==='off'?'off':'waiting');};
}
/** Music under training is lowered so footsteps stay clear. */
export const TRAINING_MUSIC_DUCK=.45;

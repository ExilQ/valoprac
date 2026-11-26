import type {GunId,WeaponId} from '../types';
import {WEAPON_ORDER} from '../../config/weapons';
import {AUDIO_ACTIONS,type AudioAction} from '../../config/audio';
import {SURFACE_FOOTSTEP_SOUND_PROFILES,type BulletImpactProfile} from '../../config/surfaces';
import type {FootstepMaterial} from '../footsteps/Footsteps';
import {FIRE_VARIANTS,synthesizeAction,synthesizeFeedback,synthesizeShot} from './synthesis';
import {synthesizeFootstep} from './footstepSynthesis';
import {synthesizeLanding} from './landingSynthesis';
import {synthesizeImpactProfile} from './materialImpact';
import {synthesizeKnife,type KnifeSound} from './knifeSynthesis';
import {synthesizeTrainingCue} from './trainingCue';
import {impulseResponse,type Pcm,type SpaceSpec} from './dsp';

/* Every procedural sound has a string key; renderSound(key) builds it. The
 * sound worker renders keys ahead of time off the main thread; without a
 * worker (tests, old browsers) the runtime renders a key on first use. */

export const THIRD_PERSON_VARIANTS=2;
export const STEP_VARIANTS=4;
export const KILL_STEPS=5;
export type AcousticSpace='range'|'courtyard'|'indoor';
/** Synthesised room responses (convolution reverb). Early reflections are
 * the nearby walls; the decay is the space's size. Not measured rooms. */
export const SPACES:Readonly<Record<AcousticSpace,SpaceSpec>>={
  range:{seconds:1.6,rt60:1.15,predelay:.012,damping:9000,seed:4101,early:[[.031,.32],[.058,.26],[.12,.2],[.19,.13]]},
  courtyard:{seconds:1.2,rt60:.8,predelay:.008,damping:10000,seed:4202,early:[[.018,.38],[.041,.28],[.077,.18]]},
  indoor:{seconds:.8,rt60:.52,predelay:.004,damping:12000,seed:4303,early:[[.007,.42],[.013,.35],[.021,.28],[.034,.2],[.05,.14]]},
};
export function spaceForMap(map:string):AcousticSpace{return map==='range'||map==='bunny'?'range':map==='complex'||map==='garage'?'indoor':'courtyard';}

const GUNS=new Set<string>(WEAPON_ORDER),ACTIONS=new Set<string>(AUDIO_ACTIONS),FLOORS=new Set<string>(SURFACE_FOOTSTEP_SOUND_PROFILES);
export function renderSound(key:string,rate:number):Pcm[]|null{
  const [a,b,c]=key.split(':');
  if(GUNS.has(a)){
    const gun=a as GunId;
    if(b==='fire'&&c!==undefined)return synthesizeShot(gun,rate,+c||0,'first');
    if(b==='fire3p')return synthesizeShot(gun,rate,+(c??0)||0,'third');
    if(ACTIONS.has(b))return synthesizeAction(gun,b as AudioAction,rate);
    return null;
  }
  switch(a){
    case 'feedback':return b==='headshot'||b==='body'?[synthesizeFeedback(b,rate)]:b==='kill'?[synthesizeFeedback('kill',rate,+(c??0)||0)]:null;
    case 'step':return FLOORS.has(b)?[synthesizeFootstep(rate,+(c??0)||0,b as FootstepMaterial)]:null;
    case 'land':return FLOORS.has(b)?[synthesizeLanding(rate,b as FootstepMaterial)]:null;
    case 'impact':return ['wood','metal','masonry','glass'].includes(b)?[synthesizeImpactProfile(b as BulletImpactProfile,rate,c==='true')]:null;
    case 'knife':return [synthesizeKnife(b as KnifeSound,rate) as Pcm];
    case 'training':return b==='cue'?[synthesizeTrainingCue(rate) as Pcm]:null;
    case 'ir':return b in SPACES?impulseResponse(rate,SPACES[b as AcousticSpace]):null;
  }
  return null;
}

/** Keys in the order they are needed: the equipped weapon and the room
 * first, then feedback and footsteps, then everything else. */
export function prefetchOrder(weapon:WeaponId,space:AcousticSpace):string[]{
  const gunKeys=(gun:GunId)=>[...Array.from({length:FIRE_VARIANTS},(_,v)=>`${gun}:fire:${v}`),...Array.from({length:THIRD_PERSON_VARIANTS},(_,v)=>`${gun}:fire3p:${v}`),`${gun}:equip`,`${gun}:reload`,...(gun==='operator'?[`${gun}:bolt`,`${gun}:scope`]:[])];
  const first=weapon!=='knife'?weapon:'rifleA';
  const keys=[`ir:${space}`,...gunKeys(first),'feedback:headshot','feedback:body','feedback:kill:0',
    ...SURFACE_FOOTSTEP_SOUND_PROFILES.flatMap(m=>[...Array.from({length:STEP_VARIANTS},(_,v)=>`step:${m}:${v}`),`land:${m}`]),
    ...['masonry','metal','wood','glass'].flatMap(k=>[`impact:${k}:false`,`impact:${k}:true`]),
    ...WEAPON_ORDER.filter(g=>g!==first).flatMap(gunKeys),
    ...Array.from({length:KILL_STEPS-1},(_,k)=>`feedback:kill:${k+1}`),
    ...['slash','stab','hit','wall','equip'].map(k=>`knife:${k}`),'training:cue'];
  return [...new Set(keys)];
}

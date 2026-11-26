// Every synthesized sound the browser game can play, rendered offline for
// listening and measurement (scripts/audio/render.mjs). Not shipped.
import {synthesize,synthesizeAction,synthesizeShot,synthesizeFeedback,FIRE_VARIANTS} from '../../src/engine/audio/synthesis';
import {synthesizeFootstep} from '../../src/engine/audio/footstepSynthesis';
import {synthesizeLanding} from '../../src/engine/audio/landingSynthesis';
import {synthesizeImpactProfile} from '../../src/engine/audio/materialImpact';
import {synthesizeKnife} from '../../src/engine/audio/knifeSynthesis';
import {synthesizeTrainingCue} from '../../src/engine/audio/trainingCue';
import {createInterfaceClickSamples} from '../../src/ui/interfaceClick';
import {WEAPON_ORDER} from '../../src/config/weapons';
import {AUDIO_ACTIONS} from '../../src/config/audio';
import {SURFACE_FOOTSTEP_SOUND_PROFILES} from '../../src/config/surfaces';
import * as bank from '../../src/engine/audio/soundBank';

export type Rendered={name:string;group:string;channels:Float32Array[]};
const mono=(name:string,group:string,pcm:Float32Array):Rendered=>({name,group,channels:[pcm]});
export function catalog(rate=48000):Rendered[]{
  const out:Rendered[]=[];
  const v2=typeof synthesizeAction==='function';
  for(const id of WEAPON_ORDER)for(const action of AUDIO_ACTIONS){if(v2&&action==='elimination')continue;out.push(v2?{name:`${id}-${action}`,group:action==='fire'?'gunshot':'handling',channels:synthesizeAction(id,action,rate)}:mono(`${id}-${action}`,action==='fire'?'gunshot':action==='elimination'?'feedback':'handling',synthesize(id,action,rate)));}
  if(v2){for(const id of WEAPON_ORDER){for(let v=1;v<FIRE_VARIANTS;v++)out.push({name:`${id}-fire-v${v}`,group:'variants',channels:synthesizeShot(id,rate,v,'first')});out.push({name:`${id}-fire-3p`,group:'thirdperson',channels:synthesizeShot(id,rate,0,'third')});}
   out.push(mono('feedback-headshot','feedback',synthesizeFeedback('headshot',rate)),mono('feedback-body','feedback',synthesizeFeedback('body',rate)),mono('feedback-kill','feedback',synthesizeFeedback('kill',rate)),mono('feedback-kill-x3','feedback',synthesizeFeedback('kill',rate,2)));
   for(const m of SURFACE_FOOTSTEP_SOUND_PROFILES.slice(0,2))for(const side of [1,2,3])out.push(mono(`step-${m}-v${side}`,'variants',synthesizeFootstep(rate,side,m)));}
  for(const m of SURFACE_FOOTSTEP_SOUND_PROFILES){out.push(mono(`step-${m}`,'footstep',synthesizeFootstep(rate,0,m)));out.push(mono(`land-${m}`,'landing',synthesizeLanding(rate,m)));}
  for(const k of ['wood','metal','masonry','glass'] as const)out.push(mono(`impact-${k}`,'impact',synthesizeImpactProfile(k,rate)));
  for(const k of ['slash','stab','hit','wall','equip'] as const)out.push(mono(`knife-${k}`,'knife',synthesizeKnife(k,rate)));
  out.push(mono('training-cue','ui',synthesizeTrainingCue(rate)),mono('ui-click','ui',createInterfaceClickSamples(rate)));
  const b=bank as Record<string,unknown>;if(typeof b.renderSound==='function'){const render=b.renderSound as (k:string,r:number)=>Float32Array[];for(const space of ['range','courtyard','indoor'])out.push({name:`ir-${space}`,group:'reverb',channels:render(`ir:${space}`,rate)});}
  return out;
}

import {describe,it,expect} from 'vitest';
import {synthesizeFootstep} from '../engine/audio/footstepSynthesis';
import {FOOTSTEP_MATERIALS} from '../engine/footsteps/Footsteps';
import {bandPower} from './helpers/spectrum';
describe('Original footstep spectrum is readable beyond sub-bass',()=>{
 for(const material of FOOTSTEP_MATERIALS)for(const side of[0,1])it(`${material}/${side}: balances impact and shoe bands without clipping`,()=>{const pcm=synthesizeFootstep(48000,side,material),p=bandPower(pcm,48000);expect(p.below250).toBeLessThan(.5);expect(p.from250To4000).toBeGreaterThan(.35);expect(p.rms).toBeGreaterThan(.015);expect(p.peak).toBeLessThan(.65);expect(pcm).toEqual(synthesizeFootstep(48000,side,material));});
 it('reports measured PCM bands separately from hearing or native-game equivalence',()=>{const rows=FOOTSTEP_MATERIALS.flatMap(material=>[0,1].map(side=>({material,side,...bandPower(synthesizeFootstep(48000,side,material),48000)})));console.info(JSON.stringify({benchmark:'original-footstep-spectrum',sampleRate:48000,rows,physicalListeningTested:false,nativeAudioMatched:false}));});
});

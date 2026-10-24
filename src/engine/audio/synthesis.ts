import type { WeaponId } from '../types';
import type { AudioAction } from '../../config/audio';
import { SeededRandom } from '../simulation/random';
// Independently synthesized signals. They are not sampled, copied, or matched Riot recordings.
export function synthesize(weapon:WeaponId,action:AudioAction,sampleRate:number){
  const duration=action==='fire'?(weapon==='sheriff'?0.65:weapon==='rifleA'?0.42:0.3):action==='reload'?(weapon==='sheriff'?2.25:2.5):action==='equip'?0.3:0.5;
  const data=new Float32Array(Math.ceil(sampleRate*duration)),rng=new SeededRandom(weapon==='rifleA'?2303:weapon==='rifleB'?2606:101);
  const cues=weapon==='sheriff'?[0.12,0.55,1.25,1.9]:[0.15,0.65,1.5,2.1];
  let low=0;for(let i=0;i<data.length;i++){const t=i/sampleRate,n=rng.range(-1,1);low+=0.18*(n-low);let v=0;
    if(action==='fire'){
      if(weapon==='rifleA')v=(n-low)*Math.exp(-t*65)*0.55+Math.sin(2*Math.PI*(95*t+24*(1-Math.exp(-t*45))))*Math.exp(-t*20)*0.42+(Math.sin(t*2630)+Math.sin(t*4070)*0.4)*Math.exp(-t*12)*0.12;
      if(weapon==='rifleB')v=low*Math.exp(-t*38)*0.85+Math.sin(t*720+6*(1-Math.exp(-t*60)))*Math.exp(-t*28)*0.38+Math.sin(t*5900)*Math.exp(-t*18)*0.09;
      if(weapon==='sheriff')v=(n-low)*Math.exp(-t*100)*0.32+Math.sin(2*Math.PI*(240*t+8*(1-Math.exp(-t*12))))*Math.exp(-t*9)*0.31+Math.sin(t*7600+Math.sin(t*47)*2)*Math.exp(-t*13)*0.12;
    }else if(action==='reload'){
      let envelope=0;for(const cue of cues)if(t>=cue)envelope+=Math.exp(-(t-cue)*80);v=(n*0.32+Math.sin(t*6200)*0.13)*envelope;
    }else if(action==='equip')v=n*Math.exp(-t*50)*0.15+Math.sin(t*(weapon==='sheriff'?4200:2100))*Math.exp(-t*22)*0.18;
    else v=(Math.sin(t*6600)+Math.sin(t*8800)*0.5)*Math.exp(-t*12)*0.15;
    data[i]=Math.tanh(v)*Math.min(1,t*2500)*Math.min(1,(duration-t)*100);
  }return data;
}

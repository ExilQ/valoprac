export class TrainingAudio {
  private context:AudioContext|null=null;private noise:AudioBuffer|null=null;private master:GainNode|null=null;
  async unlock(){if(!this.context){this.context=new AudioContext({latencyHint:'interactive'});this.master=this.context.createGain();this.master.connect(this.context.destination);
    this.noise=this.context.createBuffer(1,this.context.sampleRate*0.08,this.context.sampleRate);const a=this.noise.getChannelData(0);for(let i=0;i<a.length;i++)a[i]=(Math.random()*2-1)*(1-i/a.length)**2;
  }await this.context.resume();}
  shot(volume:number){const c=this.context;if(!c||c.state!=='running'||!this.master)return;const now=c.currentTime;
    const source=c.createBufferSource(),filter=c.createBiquadFilter(),gain=c.createGain();source.buffer=this.noise;filter.type='highpass';filter.frequency.value=550;
    gain.gain.setValueAtTime(volume*0.6,now);gain.gain.exponentialRampToValueAtTime(0.001,now+0.08);source.connect(filter).connect(gain).connect(this.master);source.start();source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();};
    this.tone(110,volume*0.45,0.06);
  }
  head(volume:number){this.tone(1050,volume*0.2,0.1);this.tone(1550,volume*0.1,0.12);}
  hit(volume:number){this.tone(420,volume*0.14,0.04);}
  private tone(frequency:number,volume:number,duration:number){const c=this.context;if(!c||!this.master)return;const o=c.createOscillator(),g=c.createGain();o.type='triangle';o.frequency.setValueAtTime(frequency,c.currentTime);o.frequency.exponentialRampToValueAtTime(frequency*0.55,c.currentTime+duration);g.gain.setValueAtTime(Math.max(0.001,volume),c.currentTime);g.gain.exponentialRampToValueAtTime(0.001,c.currentTime+duration);o.connect(g).connect(this.master);o.start();o.stop(c.currentTime+duration);o.onended=()=>{o.disconnect();g.disconnect();};}
  dispose(){void this.context?.close();this.context=null;this.noise=null;this.master=null;}
}

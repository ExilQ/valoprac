/** Independent radix-2 DFT power check of authored PCM, without perceptual claims. */
export function bandPower(pcm:Float32Array,sampleRate:number){
 let n=1;while(n<pcm.length)n*=2;const real=new Float64Array(n),imag=new Float64Array(n);real.set(pcm);
 for(let i=1,j=0;i<n;i++){let bit=n>>1;for(;j&bit;bit>>=1)j^=bit;j^=bit;if(i<j){const tmp=real[i];real[i]=real[j];real[j]=tmp;}}
 for(let length=2;length<=n;length<<=1){const angle=-2*Math.PI/length,cr=Math.cos(angle),ci=Math.sin(angle);for(let base=0;base<n;base+=length){let wr=1,wi=0;for(let j=0;j<length/2;j++){const a=base+j,b=a+length/2,tr=wr*real[b]-wi*imag[b],ti=wr*imag[b]+wi*real[b];real[b]=real[a]-tr;imag[b]=imag[a]-ti;real[a]+=tr;imag[a]+=ti;const next=wr*cr-wi*ci;wi=wr*ci+wi*cr;wr=next;}}}
 let total=0,bass=0,mid=0,high=0;for(let k=0;k<=n/2;k++){const power=(real[k]**2+imag[k]**2)*(k===0||k===n/2?1:2),hz=k*sampleRate/n;total+=power;if(hz<250)bass+=power;else if(hz<4000)mid+=power;else high+=power;}
 let sum=0,peak=0;for(const s of pcm){sum+=s*s;peak=Math.max(peak,Math.abs(s));}
 return{below250:bass/total,from250To4000:mid/total,above4000:high/total,rms:Math.sqrt(sum/pcm.length),peak,fftSize:n};
}

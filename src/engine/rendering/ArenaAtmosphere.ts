import { Color, DataTexture, EquirectangularReflectionMapping, LinearFilter, RGBAFormat, SRGBColorSpace } from 'three';

export function arenaSky(zenith:number,horizon:number) {
 const width=128,height=64,bytes=new Uint8Array(width*height*4);
 const top=new Color(zenith),edge=new Color(horizon),sample=new Color(),channels=new Color();
 for(let row=0;row<height;row++){
  const elevation=Math.max(0,(row/(height-1)-.5)*2);
  for(let column=0;column<width;column++){
   const azimuth=column/width*2*Math.PI;
   const haze=Math.max(0,Math.cos(azimuth*2+.6)*.7+Math.sin(azimuth*3+.35)*.3);
   const cloud=haze*Math.max(0,1-Math.abs(elevation-.24)*12)*.12;
   sample.copy(edge).lerp(top,Math.min(1,elevation*1.18-cloud));
   channels.copy(sample).convertLinearToSRGB();
   const offset=(row*width+column)*4;
   bytes.set([Math.round(channels.r*255),Math.round(channels.g*255),Math.round(channels.b*255),255],offset);
  }
 }
 const texture=new DataTexture(bytes,width,height,RGBAFormat);
 texture.name='VALOPRAC painted sky';
 texture.mapping=EquirectangularReflectionMapping;
 texture.colorSpace=SRGBColorSpace;
 texture.minFilter=texture.magFilter=LinearFilter;
 texture.needsUpdate=true;
 return texture;
}

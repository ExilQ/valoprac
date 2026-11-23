import {VISUAL_MATERIALS,type VisualMaterialId} from '../../config/materials';

export interface SurfacePixels {
  readonly size:number;
  readonly base:Uint8Array;
  readonly roughness:Uint8Array;
  readonly normal:Uint8Array;
}
const TAU=Math.PI*2;
const fract=(v:number)=>v-Math.floor(v);
const mix=(a:number,b:number,t:number)=>a+(b-a)*t;
const smooth=(v:number)=>v*v*(3-2*v);
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
function hash(x:number,y:number,seed:number){
  let h=Math.imul(x,374761393)^Math.imul(y,668265263)^Math.imul(seed,1442695041);
  h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967295;
}
/** Periodic value noise, sampled in material space. Integer lattice periods make
 * all maps tile cleanly. No network, image decoder, canvas or Math.random. */
function noise(u:number,v:number,cells:number,seed:number){
  const x=u*cells,y=v*cells,ix=Math.floor(x),iy=Math.floor(y),sx=smooth(fract(x)),sy=smooth(fract(y));
  const wrap=(n:number)=>(n%cells+cells)%cells;
  return mix(mix(hash(wrap(ix),wrap(iy),seed),hash(wrap(ix+1),wrap(iy),seed),sx),mix(hash(wrap(ix),wrap(iy+1),seed),hash(wrap(ix+1),wrap(iy+1),seed),sx),sy)*2-1;
}
function sample(id:VisualMaterialId,u:number,v:number){
  const d=VISUAL_MATERIALS[id],s=d.seed;
  const broad=noise(u,v,4,s),middle=noise(u,v,16,s+3),fine=noise(u,v,48,s+7);
  let height=middle*.16+fine*.09,shade=broad*.012+middle*.008,rough=middle*.035+fine*.025;
  switch(d.grain){
    case 'mineral': height=middle*.3+fine*.19;shade=broad*.025+middle*.021+fine*.009;rough+=broad*.025;break;
    case 'plaster': height=middle*.2+fine*.11;shade=broad*.013+middle*.008;break;
    case 'stone': {const vein=Math.sin(TAU*(u*3+v*2)+noise(u,v,8,s+11)*1.2);height=middle*.26+fine*.15+vein*.05;shade=broad*.035+vein*.012;break;}
    case 'brick': {
      const row=Math.floor(v*6),x=fract(u*3+(row%2)*.5),y=fract(v*6),joint=Math.min(x*3,(1-x)*3,y,(1-y));
      const edge=smooth(clamp(joint/.08)),unit=hash(Math.floor(u*3+(row%2)*.5)%3,row%6,s);
      height=(edge-1)*.8+middle*.14+fine*.09;shade=(1-edge)*.12+(unit-.5)*.045+middle*.012;rough=(1-edge)*.025+fine*.03;break;
    }
    case 'brush': {const line=Math.sin(TAU*v*48)+Math.sin(TAU*v*23)*.35;height=line*.055+fine*.018;shade=line*.009+middle*.004;rough=line*.065;break;}
    case 'metal': height=fine*.045;shade=middle*.004;rough=fine*.022;break;
    case 'paint': height=middle*.1+fine*.06;shade=broad*.009+fine*.004;rough=middle*.025+fine*.018;break;
    case 'wood': {const grain=Math.sin(TAU*(u*14+Math.sin(TAU*v)*.18)+middle*.35);height=grain*.12+fine*.05;shade=grain*.035+broad*.025;rough=grain*.035+middle*.025;break;}
    case 'rubber': height=fine*.19+middle*.04;shade=fine*.009;rough=fine*.022;break;
    case 'glass': height=fine*.005;shade=0;rough=middle*.005;break;
    case 'plastic': height=fine*.09;shade=middle*.005;rough=fine*.03;break;
    case 'weave': {const a=Math.sin(TAU*u*16),b=Math.sin(TAU*v*16),thread=(a*b)*.5+(a+b)*.25;height=thread*.24+fine*.025;shade=thread*.022;rough=thread*.035;break;}
    case 'composite': {const weave=Math.sin(TAU*(u+v)*16)*Math.sin(TAU*(u-v)*16);height=weave*.11+fine*.035;shade=weave*.014+middle*.008;rough=weave*.04;break;}
  }
  return {height,shade,rough};
}

/** Original neutral albedo modulation, dedicated linear roughness and tangent
 * normal maps. Restrained signal amplitude preserves distant target readability. */
export function generateSurfacePixels(id:VisualMaterialId,size:number):SurfacePixels{
  if(!Number.isInteger(size)||size<16||size>256||(size&(size-1))!==0)throw new RangeError('Surface size must be a power of two from 16 to 256');
  const base=new Uint8Array(size*size*4),roughness=new Uint8Array(base.length),normal=new Uint8Array(base.length),heights=new Float32Array(size*size);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const a=sample(id,x/size,y/size),i=(y*size+x)*4;
    const c=Math.round(clamp(.955+a.shade)*255),r=Math.round(clamp(.95+a.rough)*255);
    base[i]=base[i+1]=base[i+2]=c;base[i+3]=255;
    roughness[i]=roughness[i+1]=roughness[i+2]=r;roughness[i+3]=255;heights[y*size+x]=a.height;
  }
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    // Reuse the height field. Scaling the finite difference by texel density
    // keeps apparent relief stable without regenerating four full noise fields.
    const at=(px:number,py:number)=>heights[((py+size)%size)*size+(px+size)%size],strength=size/128*1.8;
    const dx=(at(x+1,y)-at(x-1,y))*strength;
    const dy=(at(x,y+1)-at(x,y-1))*strength;
    const inv=1/Math.hypot(dx,dy,1),i=(y*size+x)*4;
    normal[i]=Math.round((-dx*inv*.5+.5)*255);normal[i+1]=Math.round((-dy*inv*.5+.5)*255);normal[i+2]=Math.round((inv*.5+.5)*255);normal[i+3]=255;
  }
  return {size,base,roughness,normal};
}

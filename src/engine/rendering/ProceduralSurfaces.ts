import type {SurfacePatternStyle} from '../../config/arenaPatterns';
import {VISUAL_MATERIALS,type VisualMaterialId} from '../../config/materials';

export interface SurfacePixels {
  readonly size:number;
  readonly base:Uint8Array;
  readonly roughness:Uint8Array|null;
  readonly normal:Uint8Array|null;
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
    case 'mineral': {
      const aggregate=smooth(clamp((fine-.19)/.72));
      const expansion=1-smooth(clamp(Math.min(u,1-u,v,1-v)/.018));
      height=middle*.18+fine*.10-aggregate*.07-expansion*.15;
      shade=broad*.023+middle*.027-aggregate*.025-expansion*.085;
      rough=broad*.035+middle*.04+fine*.035+expansion*.025;
      break;
    }
    case 'plaster': {
      const brush=1-smooth(clamp((Math.min(u,1-u)+.012)/.034));
      height=middle*.072+fine*.025-brush*.048;
      shade=broad*.027+middle*.01-brush*.037;
      rough=broad*.018+middle*.03;
      break;
    }
    case 'stone': {
      const row=Math.floor(v*2),blockU=fract(u+(row%2)*.5),blockV=fract(v*2);
      const joint=1-smooth(clamp(Math.min(blockU,1-blockU,blockV*.5,(1-blockV)*.5)/.024));
      const strata=Math.sin(TAU*(v*2+.14*broad));
      const slabTone=(hash(row,2,s)-.5)*.048;
      height=middle*.13+fine*.045-joint*.17;
      shade=broad*.025+strata*.017+slabTone-joint*.075;
      rough=middle*.04+joint*.033;
      break;
    }
    case 'brick': {
      const row=Math.floor(v*6),x=fract(u*3+(row%2)*.5),y=fract(v*6),joint=Math.min(x*3,(1-x)*3,y,(1-y));
      const edge=smooth(clamp(joint/.08)),unit=hash(Math.floor(u*3+(row%2)*.5)%3,row%6,s);
      height=(edge-1)*.8+middle*.14+fine*.09;shade=(1-edge)*.12+(unit-.5)*.045+middle*.012;rough=(1-edge)*.025+fine*.03;break;
    }
    case 'brush': {
      const line=Math.sin(TAU*v*17+middle*.17)+.3*Math.sin(TAU*v*27);
      height=line*.031+fine*.013;
      shade=line*.018+middle*.008;
      rough=line*.078+broad*.025;
      break;
    }
    case 'metal': height=fine*.045;shade=middle*.004;rough=fine*.022;break;
    case 'paint': {
      const coated=id==='painted-metal';
      const coat=coated?smooth(clamp((fine+.24)*.85)):0;
      const panel=coated?1-smooth(clamp(Math.min(u,1-u)/.028)):0;
      height=middle*.09+fine*.05+coat*.105-panel*.14;
      shade=broad*.021+middle*.011+fine*.004-coat*.025-panel*.066;
      rough=middle*.035+fine*.025-coat*.086+panel*.023;
      break;
    }
    case 'wood': {
      const rings=TAU*(u*9+.26*Math.sin(TAU*v)+.08*Math.sin(TAU*(v*2+u)));
      const band=Math.sin(rings+broad*.85);
      const vessel=smooth(clamp((band-.38)/.62));
      height=band*.095-vessel*.05+fine*.025;
      shade=band*.037-vessel*.054+broad*.034+middle*.01;
      rough=band*.045+middle*.035;
      break;
    }
    case 'rubber': height=fine*.19+middle*.04;shade=fine*.009;rough=fine*.022;break;
    case 'glass': height=fine*.005;shade=0;rough=middle*.005;break;
    case 'plastic': height=fine*.09;shade=middle*.005;rough=fine*.03;break;
    case 'weave': {const a=Math.sin(TAU*u*16),b=Math.sin(TAU*v*16),thread=(a*b)*.5+(a+b)*.25;height=thread*.24+fine*.025;shade=thread*.022;rough=thread*.035;break;}
    case 'composite': {const weave=Math.sin(TAU*(u+v)*16)*Math.sin(TAU*(u-v)*16);height=weave*.11+fine*.035;shade=weave*.014+middle*.008;rough=weave*.04;break;}
  }
  return {height,shade,rough};
}

/** Original textures for the three Studio-style pattern choices.
 * Use the same periodic sampling for the color, relief, and roughness seam. */
function surfaceJoint(u:number,v:number,pattern:SurfacePatternStyle){
 const x=Math.min(u,1-u),y=Math.min(v,1-v);
 const joint=pattern==='industrial'
  ? Math.min(x,Math.min(v,1-v)*1.7)
  : Math.min(x,y);
 const width=pattern==='squares'?.016:pattern==='industrial-grid'?.025:.032;
 const bevel=1-smooth(clamp(joint/width));
 const inset=pattern==='squares'?0:1-smooth(clamp(Math.abs(joint-width*2.0)/(width*.75)));
 return {height:-bevel*.32+inset*.08,shade:-bevel*.18+inset*.035,rough:bevel*.06};
}

/**
 * Generate only the channels used by the preset. RG8 stores linear roughness
 * in green, which is the channel Three's standard roughness shader reads.
 */
export function generateSurfacePixels(
  id:VisualMaterialId,
  size:number,
  channels:{roughness:boolean;normal:boolean}={roughness:true,normal:true},
  pattern?:SurfacePatternStyle
):SurfacePixels {
  if(!Number.isInteger(size)||size<16||size>256||(size&(size-1))!==0)throw new RangeError('Surface size must be a power of two from 16 to 256');
  const count=size*size;
  const base=new Uint8Array(count*4);
  const roughness=channels.roughness?new Uint8Array(count*2):null;
  const heights=channels.normal?new Float32Array(count):null;
  const normal=heights?new Uint8Array(count*4):null;
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const sampleIndex=y*size+x;
    const u=x/size,v=y/size,surface=sample(id,u,v);
    if(pattern){
      const joint=surfaceJoint(u,v,pattern);
      surface.height+=joint.height;surface.shade+=joint.shade;surface.rough+=joint.rough;
    }
    const rgba=sampleIndex*4;
    const color=Math.round(clamp(.955+surface.shade)*255);
    base[rgba]=base[rgba+1]=base[rgba+2]=color;
    base[rgba+3]=255;
    if(roughness)roughness[sampleIndex*2+1]=Math.round(clamp(.95+surface.rough)*255);
    if(heights)heights[sampleIndex]=surface.height;
  }
  if(heights&&normal){
    // Power-of-two textures can wrap the finite difference with a bit mask.
    const mask=size-1;
    const strength=size/128*1.8;
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){
      const row=y*size;
      const dx=(heights[row+((x+1)&mask)]-heights[row+((x-1)&mask)])*strength;
      const dy=(heights[((y+1)&mask)*size+x]-heights[((y-1)&mask)*size+x])*strength;
      const inv=1/Math.hypot(dx,dy,1);
      const rgba=(row+x)*4;
      normal[rgba]=Math.round((-dx*inv*.5+.5)*255);
      normal[rgba+1]=Math.round((-dy*inv*.5+.5)*255);
      normal[rgba+2]=Math.round((inv*.5+.5)*255);
      normal[rgba+3]=255;
    }
  }
  return {size,base,roughness,normal};
}

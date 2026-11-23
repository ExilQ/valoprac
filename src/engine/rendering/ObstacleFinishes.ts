import {BufferGeometry,Color,Float32BufferAttribute} from 'three';
import {surfaceForObstacle} from '../../config/surfaces';
import type {Obstacle} from '../collision/environment';

type Axis='x'|'y'|'z';

const REVEAL=new Color(0x596c6d);
const CLADDING=new Color(0x849995);
const EDGE=new Color(0x9dad9f);
const CASING=new Color(0x4d6468);
const LOUVER=new Color(0x637c7c);

// Keep the cladding on the flat part of the chamfered solid. The small offset
// avoids coplanar depth fighting without visibly extending the cover.
const INSET=.06;
const OFFSET=.002;

export function obstacleFinishes(obstacles:readonly Obstacle[]):BufferGeometry|null {
  const positions:number[]=[],colors:number[]=[],indices:number[]=[];
  function quad(axis:Axis,positive:boolean,plane:number,u0:number,v0:number,u1:number,v1:number,color:Color){
    const base=positions.length/3;
    for(const [u,v] of [[u0,v0],[u1,v0],[u1,v1],[u0,v1]]){
      if(axis==='x')positions.push(plane,v,u);
      else if(axis==='y')positions.push(u,plane,v);
      else positions.push(u,v,plane);
      colors.push(color.r,color.g,color.b);
    }
    if(positive===(axis==='z'))indices.push(base,base+1,base+2,base,base+2,base+3);
    else indices.push(base,base+2,base+1,base,base+3,base+2);
  }

  for(const obstacle of obstacles){
    if(obstacle.ramp||obstacle.material||surfaceForObstacle(obstacle)==='glass')continue;
    const {min,max}=obstacle.box;
    const width=max.x-min.x,depth=max.z-min.z,height=max.y-min.y;
    if(obstacle.kind==='cover'){
      if(width<=.35||depth<=.35||height<.45)continue;
      const top=max.y+OFFSET;
      const band=.045;
      quad('y',true,top,min.x+INSET,min.z+INSET,max.x-INSET,min.z+INSET+band,EDGE);
      quad('y',true,top,min.x+INSET,min.z+INSET+band,max.x-INSET,max.z-INSET-band,CASING);
      quad('y',true,top,min.x+INSET,max.z-INSET-band,max.x-INSET,max.z-INSET,EDGE);

      // Inset steel face with a narrow top reveal and a protected lower rail.
      const bottom=min.y+height*.19,upper=max.y-height*.19;
      for(const axis of ['x','z'] as const){
        const spanAxis=axis==='x'?'z':'x',span=max[spanAxis]-min[spanAxis];
        if(span<=.8)continue;
        const left=min[spanAxis]+span*.09,right=max[spanAxis]-span*.09;
        for(const positive of [false,true]){
          const plane=positive?max[axis]+OFFSET:min[axis]-OFFSET;
          quad(axis,positive,plane,left,bottom,right,bottom+band,CASING);
          quad(axis,positive,plane,left,bottom+band,right,upper-band,CLADDING);
          quad(axis,positive,plane,left,upper-band,right,upper,REVEAL);
        }
      }
      continue;
    }

    const span=Math.max(width,depth);
    if(height<2.5||span<=2||width===depth)continue;
    const normalAxis=width>depth?'z':'x',spanAxis=normalAxis==='z'?'x':'z';
    const count=Math.max(1,Math.floor(span/4)),pitch=span/count;
    const rail=max.y-Math.min(1.65,height*.17);
    for(const positive of [false,true]){
      const plane=positive?max[normalAxis]+OFFSET:min[normalAxis]-OFFSET;
      quad(normalAxis,positive,plane,min[spanAxis]+INSET,rail,max[spanAxis]-INSET,rail+.045,REVEAL);
      if(height<=4)continue;
      const ventWidth=Math.min(1.88,pitch-.3),ventTop=max.y-.29,ventBottom=rail+.18;
      for(let panel=0;panel<count;panel++){
        const center=min[spanAxis]+(panel+.5)*pitch,left=center-ventWidth/2,right=center+ventWidth/2;
        const row=(ventTop-ventBottom)/5;
        for(let slat=0;slat<5;slat++){
          quad(normalAxis,positive,plane,left,ventBottom+slat*row,right,ventBottom+(slat+1)*row,slat%2===0?CASING:LOUVER);
        }
      }
    }
  }

  if(!indices.length)return null;
  const geometry=new BufferGeometry();
  geometry.setAttribute('position',new Float32BufferAttribute(positions,3));
  geometry.setAttribute('color',new Float32BufferAttribute(colors,3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

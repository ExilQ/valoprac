import * as T from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type {WeaponId} from '../types';
/** Shared original third-person silhouettes, forward +Z in the defender's rig.
 * One colored geometry per weapon keeps an entire defender class to one draw. */
export function defenderWeaponGeometry(id:WeaponId){
 const parts:T.BufferGeometry[]=[];
 const add=(source:T.BufferGeometry,color:number,x=0,y=0,z=0,rx=0)=>{source.rotateX(rx);source.translate(x,y,z);const g=source.index?source.toNonIndexed():source;const c=new T.Color(color),colors=new Float32Array(g.getAttribute('position').count*3);for(let i=0;i<colors.length;i+=3){colors[i]=c.r;colors[i+1]=c.g;colors[i+2]=c.b;}g.setAttribute('color',new T.BufferAttribute(colors,3));parts.push(g);if(g!==source)source.dispose();};
 const profile=(points:[number,number][],width:number,color:number)=>{const shape=new T.Shape();points.forEach(([z,y],i)=>i?shape.lineTo(z,y):shape.moveTo(z,y));shape.closePath();const geo=new T.ExtrudeGeometry(shape,{depth:width-.003,bevelEnabled:true,bevelSize:.0015,bevelThickness:.0015,bevelSegments:1,steps:1,curveSegments:1});geo.translate(0,0,-(width-.003)/2);geo.rotateY(-Math.PI/2);add(geo,color);};
 const tube=(r:number,length:number,y:number,z:number,color:number)=>add(new T.CylinderGeometry(r,r,length,10),color,0,y,z,Math.PI/2);
 const steel=0x536168,polymer=0x26383f,edge=0x98a4a6;
 if(id==='sheriff'){
  profile([[-.035,.025],[.11,.025],[.13,.002],[.08,-.035],[-.03,-.03]],.034,steel);
  profile([[-.032,-.02],[.006,-.025],[.021,-.107],[-.025,-.12],[-.052,-.08]],.031,polymer);tube(.011,.15,.01,.19,steel);tube(.029,.062,-.004,.045,edge);
 }else{
  const operator=id==='operator';
  profile([[-.105,.035],[.17,.035],[.2,.01],[.17,-.037],[-.09,-.038]],.044,steel);
  profile([[-.29,.02],[-.10,.028],[-.1,-.033],[-.23,-.052],[-.28,-.085],[-.3,-.078]],.034,polymer);
  profile([[-.04,-.032],[.003,-.037],[-.013,-.125],[-.055,-.119]],.03,polymer);
  profile([[.065,-.03],[.116,-.03],[.13,-.13],[.087,-.139]],.03,polymer);
  profile([[.17,.02],[.34,.017],[.35,-.02],[.18,-.025]],.038,polymer);
  tube(.009,operator?.48:.3,.008,operator?.56:.48,steel);tube(.012,.023,.008,operator?.805:.64,edge);
  if(id==='rifleB')tube(.019,.14,.008,.59,polymer);
  if(operator){tube(.021,.22,.095,.055,steel);tube(.028,.065,.095,.195,polymer);tube(.023,.035,.095,-.075,polymer);add(new T.BoxGeometry(.026,.04,.11),polymer,0,.053,.065);}
  else add(new T.BoxGeometry(.023,.009,.31),edge,0,.041,.04);
 }
 const merged=mergeGeometries(parts,false);for(const p of parts)p.dispose();if(!merged)throw Error('Defender silhouette attributes must merge');merged.computeBoundingBox();merged.computeBoundingSphere();return merged;
}

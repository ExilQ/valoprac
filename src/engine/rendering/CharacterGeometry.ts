import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type {HitZone} from '../types';

/** Original VALOPRAC uniform in normalized articulated-part space. Rendering and
 * shooting use this canonical surface; no separate generous sphere/box hit shape.
 * Vertex-colour layering lets all eleven articulated parts share four materials. */
export interface CharacterHitRegion {start:number;count:number;zone:HitZone;}
const SOURCES:THREE.BufferGeometry[]=[];
const COLORS={cloth:0x596979,vest:0x334653,trim:0x94a7ac,boot:0x293941,skin:0xeab69b,mask:0x566b76,visor:0x273d49,head:0xda8c72};
function tint(g:THREE.BufferGeometry,color:number){const c=new THREE.Color(color),a=new Float32Array(g.getAttribute('position').count*3);for(let i=0;i<a.length;i+=3){a[i]=c.r;a[i+1]=c.g;a[i+2]=c.b;}g.setAttribute('color',new THREE.BufferAttribute(a,3));return g;}
function torso(top:number,bottom:number,depth:number){
  const outline=[[-.34,-.5],[-.5,-.3],[-.5,.3],[-.34,.5],[.34,.5],[.5,.3],[.5,-.3],[.34,-.5]];
  const v:number[]=[],indices:number[]=[];
  for(const [y,w] of [[-.5,bottom],[.5,top]])for(const [x,z] of outline)v.push(x*w,y,z*depth);
  for(let i=0;i<8;i++){const j=(i+1)%8;indices.push(i,j,j+8,i,j+8,i+8);}
  for(let i=1;i<7;i++)indices.push(0,i+1,i,8,8+i,8+i+1);
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(v,3));g.setIndex(indices);g.computeVertexNormals();return g;
}
function buildCharacterPartGeometry(index:number){
  const parts:THREE.BufferGeometry[]=[],regions:CharacterHitRegion[]=[];let offset=0;
  const defaultZone:HitZone=index===0?'head':index<3?'torso':index<7?'arm':'leg';
  const add=(g:THREE.BufferGeometry,c:number,x=0,y=0,z=0,zone:HitZone=defaultZone)=>{g.translate(x,y,z);const p=g.toNonIndexed();p.deleteAttribute('uv');const count=p.getAttribute('position').count;regions.push({start:offset,count,zone});offset+=count;parts.push(tint(p,c));g.dispose();};
  const box=(w:number,h:number,d:number,c:number,x=0,y=0,z=0)=>add(new THREE.BoxGeometry(w,h,d),c,x,y,z);
  if(index===0){
    const g=new THREE.SphereGeometry(.5,16,12);g.scale(.83,1,.9);add(g,COLORS.head);
    // Slim brow and face covering, rather than a spherical target ball.
    const mask=torso(.73,.6,.47);mask.scale(1,.42,1);add(mask,COLORS.mask,0,-.18,.22);
    box(.56,.14,.065,COLORS.visor,0,.08,.405);
    const neck=new THREE.CylinderGeometry(.22,.25,.25,10);add(neck,COLORS.skin,0,-.51,0,'torso');
  }else if(index===1){
    add(torso(.98,.73,.9),COLORS.cloth);
    const vest=torso(.78,.65,.16);vest.scale(1,.74,1);add(vest,COLORS.vest,0,-.015,.46);
    // Narrow shoulder straps and central fastening are visible at training range.
    for(const x of [-.28,.28])box(.09,.76,.045,COLORS.trim,x,.04,.55);
    box(.54,.045,.03,COLORS.trim,0,-.21,.565);
    box(.17,.13,.05,COLORS.vest,-.13,.04,.57);box(.17,.13,.05,COLORS.vest,.13,.04,.57);
  }else if(index===2){
    add(torso(.86,.84,.9),COLORS.cloth);box(.92,.17,.96,COLORS.boot,0,.35,0);box(.17,.2,.08,COLORS.trim,0,.33,.51);
  }else if(index===3||index===5){
    add(torso(.84,.72,.88),COLORS.cloth);
    const patch=torso(.65,.56,.1);patch.scale(1,.3,1);add(patch,COLORS.vest,0,.2,.45);
  }else if(index===4||index===6){
    add(torso(.77,.85,.82),COLORS.cloth);
    const hand=new THREE.SphereGeometry(.5,10,8);hand.scale(.83,.44,.86);add(hand,COLORS.boot,0,-.43,.015);
    box(.7,.13,.84,COLORS.trim,0,-.27,0);
  }else if(index===7||index===9){
    add(torso(.95,.79,.92),COLORS.cloth);
    box(.58,.48,.08,COLORS.vest,index===7?-.22:.22,.02,.43);
  }else{
    add(torso(.8,.7,.86),COLORS.cloth);
    const knee=new THREE.SphereGeometry(.5,10,8);knee.scale(.74,.28,.21);add(knee,COLORS.vest,0,.33,.4);
    // Shoes end at the same ground plane as the original rig, with a shaped toe.
    const shoe=torso(.78,.91,1.43);shoe.scale(1,.29,1);add(shoe,COLORS.boot,0,-.35,.15);
    box(.83,.06,1.3,COLORS.trim,0,-.485,.14);
  }
  const merged=mergeGeometries(parts)!;for(const g of parts)g.dispose();
  // The authored sleeve placement is part of the canonical geometry, so the
  // same inward offset applies to rendered triangles and collision triangles.
  if(index===3||index===5)merged.translate(index===3?.3:-.3,0,0);
  if(index===4||index===6)merged.translate(index===4?.34:-.34,0,0);
  merged.userData.hitRegions=regions;merged.computeBoundingBox();merged.computeBoundingSphere();return merged;
}

/** Immutable CPU source. Callers must not mutate or dispose this canonical mesh. */
export function characterPartSourceGeometry(index:number){
 if(!Number.isInteger(index)||index<0||index>=11)throw new RangeError('Invalid character part');
 return SOURCES[index]??(SOURCES[index]=buildCharacterPartGeometry(index));
}
/** A renderer-owned clone, exactly matching the shared shooting surface. */
export function characterPartGeometry(index:number){return characterPartSourceGeometry(index).clone();}

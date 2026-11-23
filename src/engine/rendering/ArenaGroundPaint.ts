import { BufferGeometry, Color, Float32BufferAttribute } from 'three';
import { arenaPalette } from '../../config/arenaAppearance';
import { LEVEL_SPECS } from '../../config/tactical';
import { PEEK_ZONES } from '../tactical/complex';

/** Authored route markings are a single opaque paint batch, elevated only by
 * millimeters so they never imply a step or affect movement or ray casts. */
export function arenaGroundPaint(map:string):BufferGeometry|null {
 const positions:number[]=[],colors:number[]=[],indices:number[]=[];
 const triangle=(a:number[],b:number[],c:number[],color:Color)=>{
  const first=positions.length/3;
  for(const [x,z] of [a,b,c]){positions.push(x,.029,z);colors.push(color.r,color.g,color.b);}
  const up=(b[1]-a[1])*(c[0]-a[0])-(b[0]-a[0])*(c[1]-a[1]);
  indices.push(first,first+(up>0?1:2),first+(up>0?2:1));
 };
 const quad=(x0:number,z0:number,x1:number,z1:number,color:Color)=>{
  triangle([x0,z0],[x0,z1],[x1,z1],color);
  triangle([x0,z0],[x1,z1],[x1,z0],color);
 };
 const chevron=(x:number,z:number,direction:number,color:Color)=>{
  const tail=z-direction*.21,innerTail=z-direction*.28;
  const tip=[x,z+direction*.42],notch=[x,z+direction*.16];
  const left=[x-.52,tail],innerLeft=[x-.39,innerTail],right=[x+.52,tail],innerRight=[x+.39,innerTail];
  triangle(left,tip,innerLeft,color);
  triangle(tip,notch,innerLeft,color);
  triangle(tip,right,innerRight,color);
  triangle(tip,innerRight,notch,color);
 };
 const style=arenaPalette(map),accent=new Color(style.accent),muted=new Color(style.skirt);
 if(map==='range'){
  for(const x of [-7.5,-2.5,2.5,7.5]){
   for(const z of [-7,-12,-17,-22])chevron(x,z,-1,muted);
   quad(x-.58,2.2,x+.58,2.34,accent);
  }
  for(const x of [-10.4,10.4])quad(x-.05,-27.5,x+.05,5.6,accent);
 }else if(map==='complex'){
  for(const zone of PEEK_ZONES){
   const color=new Color(arenaPalette(map,zone.theme).accent),direction=Math.sign(zone.center.z),x=zone.center.x-6;
   chevron(x,direction*6.25,direction,color);
   quad(x-1.12,direction*6.68-.06,x+1.12,direction*6.68+.06,color);
  }
 }else{
  const spec=LEVEL_SPECS[map as keyof typeof LEVEL_SPECS];
  if(spec)for(let index=0;index<3;index++){
   const x=index*spec.width;
   for(const side of [-1,1])quad(x+side*1.1-.04,1.75,x+side*1.1+.04,4.4,accent);
   chevron(x,3.6,-1,accent);
  }
 }
 if(!indices.length)return null;
 const geometry=new BufferGeometry();
 geometry.setAttribute('position',new Float32BufferAttribute(positions,3));
 geometry.setAttribute('color',new Float32BufferAttribute(colors,3));
 geometry.setIndex(indices);
 geometry.computeVertexNormals();
 return geometry;
}

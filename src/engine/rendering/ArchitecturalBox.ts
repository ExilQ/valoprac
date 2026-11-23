import {BoxGeometry,BufferGeometry,Float32BufferAttribute,Vector3,type Color} from 'three';

export interface BoxFinish {
 below:number;
 color:Color;
}

function splitAtHeight(vertices:Vector3[],height:number):[Vector3[],Vector3[]] {
 if(vertices.every(vertex=>vertex.y<=height))return [vertices,[]];
 if(vertices.every(vertex=>vertex.y>=height))return [[],vertices];
 const lower:Vector3[]=[],upper:Vector3[]=[];
 let previous=vertices[vertices.length-1];
 for(const vertex of vertices){
  if((previous.y<height&&vertex.y>height)||(previous.y>height&&vertex.y<height)){
   const edge=previous.clone().lerp(vertex,(height-previous.y)/(vertex.y-previous.y));
   edge.y=height;
   lower.push(edge);
   upper.push(edge);
  }
  if(vertex.y<=height)lower.push(vertex);
  if(vertex.y>=height)upper.push(vertex);
  previous=vertex;
 }
 return [lower,upper];
}

/** Original 44-triangle chamfered solid. Six planar faces, twelve bevel strips
 * and eight corner caps retain the authored dimensions and restrained edge
 * highlights without tessellating every flat wall into a rounded-box grid. */
export function architecturalBox(width:number,height:number,depth:number,bevel=.035,finishes?:readonly BoxFinish[]):BufferGeometry {
 const dimensions=[width,height,depth],half=dimensions.map(n=>n/2),r=Math.max(0,Math.min(bevel,Math.min(...dimensions)*.49));
 if(r<1e-7)return new BoxGeometry(width,height,depth);
 const positions:number[]=[],normals:number[]=[],uv:number[]=[],colors:number[]=[];
 const polygon=(input:number[][])=>{
  const vertices=input.map(p=>new Vector3(...p as [number,number,number])),center=vertices.reduce((c,p)=>c.add(p),new Vector3()).multiplyScalar(1/vertices.length);
  let normal=vertices[1].clone().sub(vertices[0]).cross(vertices[2].clone().sub(vertices[0])).normalize();
  if(normal.dot(center)<0){vertices.reverse();normal=normal.negate();}
  const dominant=Math.abs(normal.x)>=Math.abs(normal.y)&&Math.abs(normal.x)>=Math.abs(normal.z)?0:Math.abs(normal.y)>=Math.abs(normal.z)?1:2;
  const triangulate=(face:Vector3[],color?:Color)=>{
   for(let i=1;i<face.length-1;i++)for(const p of [face[0],face[i],face[i+1]]){
    positions.push(p.x,p.y,p.z);normals.push(normal.x,normal.y,normal.z);
    if(dominant===0)uv.push(p.z/depth+.5,p.y/height+.5);else if(dominant===1)uv.push(p.x/width+.5,p.z/depth+.5);else uv.push(p.x/width+.5,p.y/height+.5);
    if(color)colors.push(color.r,color.g,color.b);
   }
  };
  if(!finishes){triangulate(vertices);return;}
  // Split the existing face at each finish boundary so each color owns its area.
  let remaining=vertices;
  for(const finish of finishes){
   const [face,rest]=splitAtHeight(remaining,finish.below);
   triangulate(face,finish.color);
   if(rest.length===0)break;
   remaining=rest;
  }
 };
 for(let axis=0;axis<3;axis++)for(const sign of [-1,1]){
  const a=(axis+1)%3,b=(axis+2)%3;
  polygon([[-1,-1],[1,-1],[1,1],[-1,1]].map(([sa,sb])=>{const p=[0,0,0];p[axis]=sign*half[axis];p[a]=sa*(half[a]-r);p[b]=sb*(half[b]-r);return p;}));
 }
 for(const [a,b,c] of [[0,1,2],[0,2,1],[1,2,0]])for(const sa of [-1,1])for(const sb of [-1,1]){
  polygon([[-1,0],[-1,1],[1,1],[1,0]].map(([sc,edge])=>{const p=[0,0,0];p[a]=sa*(half[a]-(edge?r:0));p[b]=sb*(half[b]-(edge?0:r));p[c]=sc*(half[c]-r);return p;}));
 }
 for(const sx of [-1,1])for(const sy of [-1,1])for(const sz of [-1,1])polygon([
  [sx*half[0],sy*(half[1]-r),sz*(half[2]-r)],
  [sx*(half[0]-r),sy*half[1],sz*(half[2]-r)],
  [sx*(half[0]-r),sy*(half[1]-r),sz*half[2]]
 ]);
 const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new Float32BufferAttribute(normals,3));geometry.setAttribute('uv',new Float32BufferAttribute(uv,2));
 if(finishes)geometry.setAttribute('color',new Float32BufferAttribute(colors,3));
 return geometry;
}

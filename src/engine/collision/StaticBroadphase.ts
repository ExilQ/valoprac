import type {Ray} from 'three';
import type {Obstacle} from './environment';

interface Node {minX:number;minY:number;minZ:number;maxX:number;maxY:number;maxZ:number;left:number;right:number;start:number;end:number;}
const ORDER=(a:number,b:number)=>a-b;
// Convex clipping tolerates 1e-7 outside a face. The broadphase must retain it.
const PAD=1e-7;
const registered=new WeakMap<readonly Obstacle[],StaticBroadphase>();

/** Static geometry only. The BVH never replaces the existing exact collision
 * tests. Results are original author indices, sorted before narrow-phase tests
 * so equal-distance hits and overlapping materials retain their original order.
 * Storage is bounded by the obstacle count and reused for each query. */
export class StaticBroadphase {
 private nodes:Node[]=[];private order:number[]=[];private unbounded:number[]=[];private stack:number[]=[];
 readonly count:number;nodeTests=0;candidateCount=0;
 constructor(readonly obstacles:readonly Obstacle[]){
  this.count=obstacles.length;
  for(let i=0;i<this.count;i++){const b=obstacles[i].box;if(Number.isFinite(b.min.x)&&Number.isFinite(b.min.y)&&Number.isFinite(b.min.z)&&Number.isFinite(b.max.x)&&Number.isFinite(b.max.y)&&Number.isFinite(b.max.z)&&b.min.x<=b.max.x&&b.min.y<=b.max.y&&b.min.z<=b.max.z)this.order.push(i);else this.unbounded.push(i);}
  if(this.order.length)this.build(0,this.order.length);
 }
 private build(start:number,end:number):number{
  const node:Node={minX:Infinity,minY:Infinity,minZ:Infinity,maxX:-Infinity,maxY:-Infinity,maxZ:-Infinity,left:-1,right:-1,start,end};
  for(let i=start;i<end;i++){const b=this.obstacles[this.order[i]].box;node.minX=Math.min(node.minX,b.min.x);node.minY=Math.min(node.minY,b.min.y);node.minZ=Math.min(node.minZ,b.min.z);node.maxX=Math.max(node.maxX,b.max.x);node.maxY=Math.max(node.maxY,b.max.y);node.maxZ=Math.max(node.maxZ,b.max.z);}
  const at=this.nodes.length;this.nodes.push(node);
  if(end-start>4){const x=node.maxX-node.minX,y=node.maxY-node.minY,z=node.maxZ-node.minZ,axis=x>=y&&x>=z?'x':y>=z?'y':'z';const sorted=this.order.slice(start,end).sort((a,b)=>{const aa=this.obstacles[a].box,bb=this.obstacles[b].box;return(aa.min[axis]+aa.max[axis])-(bb.min[axis]+bb.max[axis])||a-b;});for(let i=0;i<sorted.length;i++)this.order[start+i]=sorted[i];const mid=(start+end)>>>1;node.left=this.build(start,mid);node.right=this.build(mid,end);}
  return at;
 }
 private begin(out:number[]){out.length=0;this.nodeTests=0;this.stack.length=0;for(const i of this.unbounded)out.push(i);if(this.nodes.length)this.stack.push(0);}
 private finish(out:number[]){out.sort(ORDER);this.candidateCount=out.length;return out;}
 /** maxParameter is the ray parameter, not Euclidean distance for a non-unit ray. */
 queryRay(ray:Ray,maxParameter:number,out:number[]):number[]{
  this.begin(out);const o=ray.origin,d=ray.direction;
  if(!Number.isFinite(o.x)||!Number.isFinite(o.y)||!Number.isFinite(o.z)||!Number.isFinite(d.x)||!Number.isFinite(d.y)||!Number.isFinite(d.z)||Number.isNaN(maxParameter)){out.length=0;for(let i=0;i<this.count;i++)out.push(i);return this.finish(out);}
  const inverseX=1/d.x,inverseY=1/d.y,inverseZ=1/d.z;
  const padX=PAD*(1+Math.abs(d.x))+(Math.abs(d.x)<1e-12?Math.abs(d.x*maxParameter)||0:0),padY=PAD*(1+Math.abs(d.y))+(Math.abs(d.y)<1e-12?Math.abs(d.y*maxParameter)||0:0),padZ=PAD*(1+Math.abs(d.z))+(Math.abs(d.z)<1e-12?Math.abs(d.z*maxParameter)||0:0);
  while(this.stack.length){const n=this.nodes[this.stack.pop()!];this.nodeTests++;let lo=0,hi=maxParameter;
   if(d.x===0){if(o.x<n.minX-padX||o.x>n.maxX+padX)continue;}else{let a=(n.minX-padX-o.x)*inverseX,b=(n.maxX+padX-o.x)*inverseX;if(a>b){const t=a;a=b;b=t;}lo=Math.max(lo,a);hi=Math.min(hi,b);if(lo>hi)continue;}
   if(d.y===0){if(o.y<n.minY-padY||o.y>n.maxY+padY)continue;}else{let a=(n.minY-padY-o.y)*inverseY,b=(n.maxY+padY-o.y)*inverseY;if(a>b){const t=a;a=b;b=t;}lo=Math.max(lo,a);hi=Math.min(hi,b);if(lo>hi)continue;}
   if(d.z===0){if(o.z<n.minZ-padZ||o.z>n.maxZ+padZ)continue;}else{let a=(n.minZ-padZ-o.z)*inverseZ,b=(n.maxZ+padZ-o.z)*inverseZ;if(a>b){const t=a;a=b;b=t;}lo=Math.max(lo,a);hi=Math.min(hi,b);if(lo>hi)continue;}
   if(n.left<0){for(let i=n.start;i<n.end;i++)out.push(this.order[i]);}else{this.stack.push(n.right,n.left);}
  }
  return this.finish(out);
 }
 queryAabb(minX:number,minY:number,minZ:number,maxX:number,maxY:number,maxZ:number,out:number[]):number[]{
  this.begin(out);
  if(Number.isNaN(minX)||Number.isNaN(minY)||Number.isNaN(minZ)||Number.isNaN(maxX)||Number.isNaN(maxY)||Number.isNaN(maxZ)){out.length=0;for(let i=0;i<this.count;i++)out.push(i);return this.finish(out);}
  while(this.stack.length){const n=this.nodes[this.stack.pop()!];this.nodeTests++;if(maxX<n.minX-PAD||minX>n.maxX+PAD||maxY<n.minY-PAD||minY>n.maxY+PAD||maxZ<n.minZ-PAD||minZ>n.maxZ+PAD)continue;if(n.left<0){for(let i=n.start;i<n.end;i++)out.push(this.order[i]);}else this.stack.push(n.right,n.left);}
  return this.finish(out);
 }
}

/** Register only after authoring is complete. Dynamic/custom obstacle arrays
 * keep their original linear semantics until explicitly registered. Re-register
 * after editing any box; changing material metadata does not require a rebuild. */
export function registerStaticObstacles(obstacles:readonly Obstacle[]):StaticBroadphase{const index=new StaticBroadphase(obstacles);registered.set(obstacles,index);return index;}
export function staticBroadphaseFor(obstacles:readonly Obstacle[]):StaticBroadphase|null{const index=registered.get(obstacles);return index&&index.count===obstacles.length?index:null;}

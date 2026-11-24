import {Box3,Vector3} from 'three';
import {type CourseId,type MapCourse} from '../../config/mapCourses';
import type {SurfaceId} from '../../config/surfaces';
import type {Obstacle} from '../collision/environment';
import type {Vec3} from '../types';
import type {AngleSector,TacticalLevel} from './levels';

const raised=(tile:string)=>'Habc'.includes(tile);
const walkable=(tile:string)=>'.SABCabcH^pt'.includes(tile);
export function buildCourse(spec:MapCourse & {id:CourseId}):TacticalLevel {
 const {rows,cell,height}=spec, width=rows[0].length, depth=rows.length, tiles=rows.join('');
 const point=(i:number):Vec3=>({x:(i%width-(width-1)/2)*cell,y:raised(tiles[i])?height:tiles[i]==='^'?height/2:0,z:5+(Math.floor(i/width)-depth+1)*cell});
 const obstacles:Obstacle[]=[], angles:AngleSector[]=[];
 const add=(x:number,z:number,w:number,d:number,h:number,kind:Obstacle['kind'],surfaceId:SurfaceId)=>{
  const o:Obstacle={box:new Box3(new Vector3(x-w/2,0,z-d/2),new Vector3(x+w/2,h,z+d/2)),kind,surfaceId,color:spec.palette[kind==='wall'?0:1]};
  obstacles.push(o);return o;
 };
 const northwest=point(0), southeast=point(tiles.length-1);
 const left=northwest.x-cell/2,top=northwest.z-cell/2,right=southeast.x+cell/2,bottom=southeast.z+cell/2;
 for(const z of [top-.35,bottom+.35])add(0,z,width*cell+1.4,.7,6,'wall',spec.wall);
 for(const x of [left-.35,right+.35])add(x,(top+bottom)/2,.7,depth*cell,6,'wall',spec.wall);
 const destinations:number[]=[];
 for(let i=0;i<tiles.length;i++){
  const tile=tiles[i],p=point(i);
  if(tile==='#'){
   // Merge horizontal masonry runs without losing cells at a row boundary.
   let count=1;while((i+count)%width!==0&&tiles[i+count]==='#')count++;
   add(p.x+(count-1)*cell/2,p.z,count*cell,cell,4.8,'wall',spec.wall);i+=count-1;continue;
  }
  if(tile==='*')add(p.x,p.z,cell,cell,6,'wall',spec.wall);
  if(tile==='+')add(p.x,p.z,cell*.56,cell*.42,1.28,'cover',spec.style==='courtyard'?'thickWood':'paintedMetal');
  if(raised(tile))add(p.x,p.z,cell,cell,height,'cover',spec.floor);
  if(tile==='^')add(p.x,p.z,cell,cell,height,'cover',spec.floor).ramp={axis:'z',low:0,high:height,ascending:-1};
  if(/[ABCabc]/.test(tile)){
   const label=tile.toUpperCase();
   destinations.push(i);angles.push({id:spec.id+'-'+label,label,position:p,jitter:.14,radius:.65,
    alternatives:[{...p,x:p.x-.45},{...p,x:p.x+.45}],navigation:[{...p,x:p.x-.65},p,{...p,x:p.x+.65}]});
  }
 }
 const start=tiles.indexOf('S'),route=[point(start)];
 // Walk to each sector through contiguous cells. Enter ramps at the foot or crest.
 const neighbours=(from:number)=>{
  const row=Math.floor(from/width);
  return [from-width,from+1,from+width,from-1].filter(to=>{
   if(to<0||to>=tiles.length||Math.abs(from-to)===1&&Math.floor(to/width)!==row||!walkable(tiles[to]))return false;
   const a=tiles[from],b=tiles[to];
   if(a==='^')return to===from-width&&raised(b)||to===from+width&&!raised(b);
   if(b==='^')return from===to-width&&raised(a)||from===to+width&&!raised(a);
   return raised(a)===raised(b);
  });
 };
 let from=start;
 for(const to of destinations){
  const queue=[from],parent=new Map([[from,from]]);
  for(let k=0;k<queue.length&&!parent.has(to);k++)for(const next of neighbours(queue[k]))if(!parent.has(next)){parent.set(next,queue[k]);queue.push(next);}
  if(!parent.has(to))throw new Error('Unreachable sector in '+spec.id+': '+tiles[to]);
  const segment:number[]=[];for(let at=to;at!==from;at=parent.get(at)!)segment.push(at);
  route.push(...segment.reverse().map(point));from=to;
 }
 const entrance=tiles.indexOf('p'),exit=tiles.indexOf('t');
 return {id:spec.id,title:spec.title,family:'맵별 전술 훈련',description:spec.description,obstacles,angles,spawn:point(start),route,
  bounds:[left-.7,top-.7,right-left+1.4,bottom-top+1.4],entryYaw:spec.entryYaw*Math.PI/180,landmark:point(tiles.indexOf('*')),
  ...(entrance>=0&&exit>=0?{transfer:{entry:point(entrance),exit:point(exit)}}:{})};
}

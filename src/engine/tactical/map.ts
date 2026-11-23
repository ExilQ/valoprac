import {levelFor} from './levels';
import {Box3,Vector3} from 'three';
import {ENVIRONMENT,type Obstacle} from '../collision/environment';
export const TACTICAL_GRID=Array.from({length:24},(_,z)=>Array.from({length:24},(_,x)=>x===0||z===0||x===23||z===23?1:0));
function wall(x1:number,z1:number,x2:number,z2:number){for(let z=z1;z<=z2;z++)for(let x=x1;x<=x2;x++)TACTICAL_GRID[z][x]=1;}
// Original offset-corner layout retained from the separate VALOPRAC prototype, 2 m/cell.
wall(7,2,7,9);TACTICAL_GRID[5][7]=0;wall(16,14,16,21);TACTICAL_GRID[18][16]=0;
wall(10,7,21,7);TACTICAL_GRID[7][14]=0;wall(2,16,13,16);TACTICAL_GRID[16][8]=0;
for(const b of [[11,10,12,12],[3,10,4,11],[18,10,20,11],[3,3,4,4],[19,3,20,4],[4,20,5,21],[19,19,20,20],[9,3,10,4],[14,18,15,19],[9,20,10,21]])wall(b[0],b[1],b[2],b[3]);
export const TACTICAL_OBSTACLES:Obstacle[]=[];
// Merge each contiguous row for collision and original Three geometry batching.
for(let z=0;z<24;z++)for(let x=0;x<24;){if(!TACTICAL_GRID[z][x]){x++;continue;}const start=x;while(x<24&&TACTICAL_GRID[z][x])x++;TACTICAL_OBSTACLES.push({box:new Box3(new Vector3((start-12)*2,0,(z-12)*2),new Vector3((x-12)*2,3.6,(z-11)*2)),color:0x52636a,kind:'wall'});}
export const TACTICAL_ZONES=[[[5.5,5.5],[6.5,6.5],[5.5,8.5],[3.5,7.5],[9.5,5.5]],[[18.5,5.5],[21.5,5.5],[18.5,8.5],[15.5,6.5],[21.5,9.5]],[[5.5,12.5],[7.5,13.5],[2.5,13.5],[6.5,17.5],[10.5,15.5]],[[17.5,12.5],[21.5,13.5],[17.5,17.5],[20.5,16.5],[14.5,12.5]],[[10.5,9.5],[13.5,13.5],[10.5,13.5],[15.5,10.5],[13.5,9.5]]].map(zone=>zone.map(([x,z])=>({x:(x-12)*2,z:(z-12)*2})));
export const obstaclesFor=(map:string)=>levelFor(map)?.obstacles??(map==='tactical'?TACTICAL_OBSTACLES:ENVIRONMENT);
export function canOccupy(x:number,z:number,radius=.4){for(const o of TACTICAL_OBSTACLES)if(x+radius>o.box.min.x&&x-radius<o.box.max.x&&z+radius>o.box.min.z&&z-radius<o.box.max.z)return false;return true;}
export function lineClear(x:number,z:number,toX:number,toZ:number){const distance=Math.hypot(toX-x,toZ-z),steps=Math.ceil(distance/.2);for(let i=1;i<steps;i++)if(!canOccupy(x+(toX-x)*i/steps,z+(toZ-z)*i/steps,0))return false;return true;}

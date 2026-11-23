import type {ShotEvent} from '../../engine/types';
const hit=(s:ShotEvent)=>['head','torso','arm','leg'].includes(s.hit);
export function gameplayMetrics(shots:ShotEvent[]){const groups={stationary:shots.filter(s=>s.accurate),moving:shots.filter(s=>!s.accurate),ads:shots.filter(s=>s.ads),high:shots.filter(s=>(s.targetElevation??0)>.4),low:shots.filter(s=>(s.targetElevation??0)<-.4)};
 return Object.entries(groups).map(([id,rows])=>({id,count:rows.length,accuracy:rows.length?rows.filter(hit).length/rows.length*100:null,meanSpeed:rows.reduce((a,s)=>a+Math.hypot(s.velocity.x,s.velocity.z),0)/Math.max(1,rows.length)}));}
export function grouping(shots:ShotEvent[]){const rows=shots.filter(s=>s.hit==='wall'&&s.impact.z<-29.9);if(!rows.length)return null;let x=0,y=0,minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity,diameter=0,angular=0,speed=0,stop=0;
 for(const s of rows){x+=s.impact.x;y+=s.impact.y;minX=Math.min(minX,s.impact.x);maxX=Math.max(maxX,s.impact.x);minY=Math.min(minY,s.impact.y);maxY=Math.max(maxY,s.impact.y);angular+=s.spread.x**2+s.spread.y**2;speed+=Math.hypot(s.velocity.x,s.velocity.z);stop+=s.stoppedFor??0;}
 for(let i=0;i<rows.length;i++)for(let j=i+1;j<rows.length;j++)diameter=Math.max(diameter,Math.hypot(rows[i].impact.x-rows[j].impact.x,rows[i].impact.y-rows[j].impact.y));
 return {count:rows.length,centerX:x/rows.length,centerY:y/rows.length,width:maxX-minX,height:maxY-minY,diameter,angularRms:Math.sqrt(angular/rows.length),meanSpeed:speed/rows.length,stoppedFor:stop/rows.length};}

import type {Settings,Vec3} from '../types';
import type {Target} from '../targets/Target';
import type {Obstacle} from '../collision/environment';
import {visibleBetween} from './levels';
import {Vector3} from 'three';
import {LEGACY_SIMULATION_RULES,type SimulationRulesId} from '../simulation/rules';
export interface ExposureDeath {bot:number;angle:string;duration:number;time:number;player:Vec3;defender:Vec3;}
export class Exposure {
 readonly values:Float64Array;death:ExposureDeath|null=null;max=0;deaths=0;private head=new Vector3();private body={x:0,y:0,z:0};
 constructor(count:number){this.values=new Float64Array(count);}
 step(targets:Target[],player:Vec3,eyeHeight:number,obstacles:Obstacle[],settings:Settings,dt:number,time:number,labels:string[],readyAt:(id:number)=>number=()=>0,rules:SimulationRulesId=LEGACY_SIMULATION_RULES){
  if(this.death||!settings.exposureEnabled)return;
  for(const t of targets){
   let sees=false;
   if(t.active&&t.enabled&&time>=readyAt(t.id)){
    t.headPosition(this.head);const dx=player.x-this.head.x,dz=player.z-this.head.z,d=Math.hypot(dx,dz);this.body.x=player.x;this.body.z=player.z;this.body.y=player.y+eyeHeight;
    // New range defenders face the approach corridor (+Z), in a 140 degree detection cone.
    if(d<42&&dz/Math.max(.001,d)>Math.cos(70*Math.PI/180)){
     sees=visibleBetween(obstacles,this.head,this.body,rules);if(!sees){this.body.y=player.y+eyeHeight*.55;sees=visibleBetween(obstacles,this.head,this.body,rules);}
    }
   }
   this.values[t.id]=sees?this.values[t.id]+dt:settings.exposureMode==='continuous'?0:Math.max(0,this.values[t.id]-dt*.65);
   this.max=Math.max(this.max,this.values[t.id]);
   if(this.values[t.id]+1e-9>=settings.exposureLimit){this.deaths++;this.death={bot:t.id,angle:labels[t.id]??`${t.id+1}번 수비각`,duration:this.values[t.id],time,player:{...player},defender:{x:t.position.x,y:t.position.y,z:t.position.z}};return;}
  }
 }
 reset(){this.values.fill(0);this.death=null;}
}

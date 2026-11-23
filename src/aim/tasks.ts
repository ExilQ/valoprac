import {random,shuffled} from './math';
import type {AimBlock} from './types';
export class AimTargetPath {
 private rng:()=>number;private directions:number[];private segment=-1;private points:Float64Array;private switchOrder:number[];
 x=0;y=0;changed=false;switchX=new Float64Array(4);switchY=new Float64Array(4);
 constructor(readonly block:AimBlock){this.rng=random(block.seed);this.directions=shuffled([0,1,2,3,4,5,6,7],this.rng);const first=shuffled([0,1,2,3],this.rng),second=shuffled([0,1,2,3],this.rng);if(first[3]===second[0])second.push(second.shift()!);this.switchOrder=[...first,...second];this.points=new Float64Array(64);for(let i=2;i<64;i+=2){this.points[i]=(this.rng()*2-1)*block.amplitude;this.points[i+1]=(this.rng()*2-1)*block.amplitude*.55;}}
 setSwitchAnchor(x:number,y:number){for(let i=0;i<4;i++){this.switchX[i]=x+Math.cos(i*Math.PI/2+Math.PI/4)*this.block.amplitude;this.switchY[i]=y+Math.sin(i*Math.PI/2+Math.PI/4)*this.block.amplitude*.65;}}
 point(index:number,originX:number,originY:number){if(this.block.task==='switch'){const i=this.switchOrder[index%8];this.x=this.switchX[i];this.y=this.switchY[i];return this;}const angle=this.directions[index%8]*Math.PI/4,amp=this.block.amplitude*[.7,1,1.3][index%3];this.x=originX+Math.cos(angle)*amp;this.y=originY+Math.sin(angle)*amp;return this;}
 sample(t:number,out:{x:number;y:number}){const b=this.block;if(b.task==='smooth'){out.x=b.amplitude*Math.sin(t*.8);out.y=b.amplitude*.35*Math.sin(t*.47);}else if(b.task==='reactive'){const segment=Math.min(30,Math.max(0,Math.floor(t/.9))),u=Math.min(1,Math.max(0,(t-segment*.9)/.9)),f=u*u*(3-2*u),i=segment*2;out.x=this.points[i]+(this.points[i+2]-this.points[i])*f;out.y=this.points[i+1]+(this.points[i+3]-this.points[i+1])*f;}else{out.x=this.x;out.y=this.y;}return out;}
 update(t:number){this.changed=this.block.task==='reactive'&&Math.floor(t/.9)!==this.segment&&this.segment>=0;this.segment=Math.floor(t/.9);this.sample(t,this);}
}

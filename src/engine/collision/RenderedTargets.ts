import {Matrix4,Vector3} from 'three';
import type {Target} from '../targets/Target';
import type {Vec3} from '../types';

export interface RenderedTargetPose {
  generation:number;active:boolean;position:Vector3;matrices:Matrix4[];
}
export interface RenderedTargetFrame {
  id:number;submittedAt:number;targets:(RenderedTargetPose|undefined)[];
}
export interface RenderedFrameProvenance {tick:number;alpha:number;}
const EMPTY_FRAME:RenderedTargetFrame={id:0,submittedAt:0,targets:[]};

/** Bounded history of the exact instance transforms submitted for drawing.
 * Time is the DOM monotonic clock, not simulation time or a physical scanout
 * timestamp. Copy a click's frame so later rendering cannot overwrite it. */
export class RenderedTargets {
  onCapture:((frame:RenderedTargetFrame,provenance?:RenderedFrameProvenance)=>void)|null=null;
  private frames:RenderedTargetFrame[]=[];private cursor=-1;private count=0;private sequence=0;private attached=false;
  constructor(readonly capacity=32){if(!Number.isInteger(capacity)||capacity<2)throw new Error('Render history capacity must be at least two');}
  attach(){this.attached=true;}
  get isAttached(){return this.attached;}
  clear(){this.cursor=-1;this.count=0;}
  get size(){return this.count;}
  get latest():RenderedTargetFrame|undefined{return this.count?this.frames[this.cursor]:undefined;}
  capture(targets:readonly Target[],matrices:readonly (readonly Matrix4[])[],submittedAt:number,positions?:readonly Vec3[],provenance?:RenderedFrameProvenance){
    if(!Number.isFinite(submittedAt))return;
    const previous=this.latest;if(previous&&submittedAt<previous.submittedAt)throw new Error('Render timestamps must be monotonic');
    this.attached=true;this.cursor=(this.cursor+1)%this.capacity;
    const frame=this.frames[this.cursor]??(this.frames[this.cursor]={id:0,submittedAt:0,targets:[]});
    frame.id=++this.sequence;frame.submittedAt=submittedAt;
    for(const pose of frame.targets)if(pose)pose.active=false;
    for(let i=0;i<targets.length;i++){
      const target=targets[i],source=matrices[i];
      const pose=frame.targets[target.id]??(frame.targets[target.id]={generation:0,active:false,position:new Vector3(),matrices:[]});
      pose.generation=target.generation;pose.active=target.enabled&&target.active&&source?.length===target.parts.length;
      const position=positions?.[i]??target.position;pose.position.set(position.x,position.y,position.z);
      if(!pose.active)continue;
      for(let j=0;j<source.length;j++)(pose.matrices[j]??(pose.matrices[j]=new Matrix4())).copy(source[j]);
      pose.matrices.length=source.length;
    }
    this.count=Math.min(this.capacity,this.count+1);this.onCapture?.(frame,provenance);return frame;
  }
  at(stamp:number):RenderedTargetFrame|undefined{
    if(!Number.isFinite(stamp))return undefined;
    for(let n=0;n<this.count;n++){const frame=this.frames[(this.cursor-n+this.capacity)%this.capacity];if(frame.submittedAt<=stamp)return frame;}
    return undefined;
  }
  forShot(stamp?:number):RenderedTargetFrame|undefined{return (stamp===undefined?this.latest:this.at(stamp))??(this.attached?EMPTY_FRAME:undefined);}
  copyForShot(stamp:number){
    const frame=this.forShot(stamp);if(!frame)return undefined;
    return {id:frame.id,submittedAt:frame.submittedAt,targets:frame.targets.map(p=>p?{generation:p.generation,active:p.active,position:p.position.clone(),matrices:p.active?p.matrices.map(m=>m.clone()):[]}:undefined)};
  }
}
export function poseForTarget(target:Target,frame:RenderedTargetFrame){
  const pose=frame.targets[target.id];return target.enabled&&target.active&&pose?.active&&pose.generation===target.generation?pose:undefined;
}
export function headPositionInFrame(target:Target,frame:RenderedTargetFrame|undefined,out:Vector3){
  if(!target.enabled||!target.active)return false;
  if(!frame){target.headPosition(out);return true;}
  const pose=poseForTarget(target,frame);if(!pose?.matrices[0])return false;out.setFromMatrixPosition(pose.matrices[0]);return true;
}

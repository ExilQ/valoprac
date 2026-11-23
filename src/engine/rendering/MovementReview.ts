import {BufferAttribute,BufferGeometry,CapsuleGeometry,Group,Line,LineBasicMaterial,Mesh,MeshBasicMaterial,SphereGeometry} from 'three';
import type {MovementPracticeSnapshot,MovementToolsSettings,MovementTracePoint} from '../../training/movementTools/types';
import type {MovementGhost,MovementGhostPose} from '../../training/movementTools/GhostFromReplay';

/** Display-only practice path and translucent player marker. These objects are
 * never registered with movement collision, targets or weapon raycasts. */
export class MovementReview {
 readonly root=new Group();private pathGeometry=new BufferGeometry();private ghostGeometry=new BufferGeometry();
 private pathMaterial=new LineBasicMaterial({color:0x8ac9c5,transparent:true,opacity:.7,depthWrite:false});
 private ghostMaterial=new MeshBasicMaterial({color:0x80c9da,transparent:true,opacity:.22,depthWrite:false});
 private ghostLineMaterial=new LineBasicMaterial({color:0x80c9da,transparent:true,opacity:.34,depthWrite:false});
 private bodyGeometry=new CapsuleGeometry(.18,.9,3,8);private headGeometry=new SphereGeometry(.13,8,6);
 private path=new Line(this.pathGeometry,this.pathMaterial);private ghostPath=new Line(this.ghostGeometry,this.ghostLineMaterial);private marker=new Group();
 private previousSnapshot:MovementPracticeSnapshot|null=null;private previousGhost:MovementGhost|null=null;
 constructor(){
  this.root.name='movement review visuals · no gameplay collision';this.root.visible=false;
  this.path.name='resolved movement trajectory';this.ghostPath.name='verified replay movement path';
  const body=new Mesh(this.bodyGeometry,this.ghostMaterial),head=new Mesh(this.headGeometry,this.ghostMaterial);body.position.y=.87;head.position.y=1.57;
  this.marker.add(body,head);this.marker.name='non-interactive movement ghost';this.root.add(this.path,this.ghostPath,this.marker);
  this.root.traverse(node=>{node.castShadow=false;node.receiveShadow=false;});
 }
 private setPath(geometry:BufferGeometry,samples:readonly MovementTracePoint[]){
  const values=new Float32Array(Math.min(600,samples.length)*3);
  for(let i=0;i<values.length/3;i++){values[i*3]=samples[i][1];values[i*3+1]=samples[i][2]+.035;values[i*3+2]=samples[i][3];}
  geometry.setAttribute('position',new BufferAttribute(values,3));geometry.setDrawRange(0,values.length/3);if(values.length)geometry.computeBoundingSphere();else geometry.boundingSphere=null;
 }
 update(settings:MovementToolsSettings,snapshot:MovementPracticeSnapshot|null,ghost:MovementGhost|null,pose:MovementGhostPose|null){
  this.root.visible=settings.enabled&&(settings.showTrajectory||settings.showGhost);
  if(snapshot!==this.previousSnapshot){this.previousSnapshot=snapshot;this.setPath(this.pathGeometry,(snapshot?.current??snapshot?.last)?.samples??[]);}
  if(ghost!==this.previousGhost){this.previousGhost=ghost;this.setPath(this.ghostGeometry,ghost?.samples??[]);}
  this.path.visible=settings.enabled&&settings.showTrajectory&&!!snapshot&&(snapshot.current?.samples.length??snapshot.last?.samples.length??0)>1;
  this.ghostPath.visible=settings.enabled&&settings.showGhost&&!!ghost;this.marker.visible=settings.enabled&&settings.showGhost&&!!pose;
  if(pose){this.marker.position.set(pose.position.x,pose.position.y,pose.position.z);this.marker.rotation.y=pose.yaw;this.marker.scale.y=1-.3*pose.crouch;}
 }
 dispose(){this.root.removeFromParent();this.pathGeometry.dispose();this.ghostGeometry.dispose();this.pathMaterial.dispose();this.ghostLineMaterial.dispose();this.ghostMaterial.dispose();this.bodyGeometry.dispose();this.headGeometry.dispose();this.root.clear();}
}

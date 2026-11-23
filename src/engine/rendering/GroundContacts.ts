import {DataTexture,DoubleSide,DynamicDrawUsage,Frustum,InstancedMesh,Matrix4,MeshBasicMaterial,Object3D,PlaneGeometry,RingGeometry,Sphere,type BufferGeometry,type Material,type PerspectiveCamera,type Texture} from 'three';

interface ContactTarget {position:{x:number;y:number;z:number};previous:{x:number;y:number;z:number};scale:number;active:boolean;enabled:boolean;}

/** The original flat rings and radial contact shadows, submitted in two draws.
 * Per-instance frustum tests preserve the old mesh visibility and triangle cost;
 * these visual helpers never enter player/bot collision or bullet registration. */
export class GroundContacts {
 readonly rings:InstancedMesh;readonly shadows:InstancedMesh;
 private pose=new Object3D();private frustum=new Frustum();private projection=new Matrix4();private sphere=new Sphere();
 constructor(capacity:number,geometry:(g:BufferGeometry)=>void,material:(m:Material)=>void,texture:(t:Texture)=>void){
  const ringGeometry=new RingGeometry(.45,.46,32),ringMaterial=new MeshBasicMaterial({color:0x9aa8a5,transparent:true,opacity:.2,side:DoubleSide,depthWrite:false});
  // A zero-thickness floor ring has no back layer: avoid its redundant back-face
  // pass. Both faces still display when the inspection camera goes below it.
  ringMaterial.forceSinglePass=true;
  const n=32,data=new Uint8Array(n*n*4);for(let y=0;y<n;y++)for(let x=0;x<n;x++){const i=(y*n+x)*4,r=Math.hypot(x/(n-1)*2-1,y/(n-1)*2-1);data[i]=data[i+1]=data[i+2]=0;data[i+3]=Math.round(Math.max(0,1-r)**2*125);}
  const tex=new DataTexture(data,n,n);tex.needsUpdate=true;texture(tex);
  const shadowGeometry=new PlaneGeometry(1.5,1.1),shadowMaterial=new MeshBasicMaterial({map:tex,transparent:true,depthWrite:false});
  geometry(ringGeometry);geometry(shadowGeometry);material(ringMaterial);material(shadowMaterial);ringGeometry.computeBoundingSphere();shadowGeometry.computeBoundingSphere();
  this.rings=new InstancedMesh(ringGeometry,ringMaterial,capacity);this.shadows=new InstancedMesh(shadowGeometry,shadowMaterial,capacity);
  this.rings.name='instanced target floor rings';this.shadows.name='instanced target contact shadows';
  for(const mesh of [this.rings,this.shadows]){mesh.instanceMatrix.setUsage(DynamicDrawUsage);mesh.frustumCulled=false;mesh.castShadow=false;mesh.receiveShadow=false;}
  this.pose.rotation.x=-Math.PI/2;
 }
 update(targets:readonly ContactTarget[],alpha:number,camera:PerspectiveCamera){
  camera.updateMatrixWorld(true);this.projection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);this.frustum.setFromProjectionMatrix(this.projection);
  let rings=0,shadows=0;
  for(const target of targets){
   if(!target.active||!target.enabled)continue;
   const {position:p,previous:b}=target;this.pose.position.set(b.x+(p.x-b.x)*alpha,b.y+(p.y-b.y)*alpha+.016,b.z+(p.z-b.z)*alpha);
   this.pose.scale.setScalar(1);this.pose.updateMatrix();
   if(this.frustum.intersectsSphere(this.sphere.copy(this.rings.geometry.boundingSphere!).applyMatrix4(this.pose.matrix)))this.rings.setMatrixAt(rings++,this.pose.matrix);
   this.pose.scale.setScalar(target.scale);this.pose.updateMatrix();
   if(this.frustum.intersectsSphere(this.sphere.copy(this.shadows.geometry.boundingSphere!).applyMatrix4(this.pose.matrix)))this.shadows.setMatrixAt(shadows++,this.pose.matrix);
  }
  this.rings.count=rings;this.shadows.count=shadows;this.rings.visible=rings>0;this.shadows.visible=shadows>0;
  this.rings.instanceMatrix.needsUpdate=true;this.shadows.instanceMatrix.needsUpdate=true;
 }
 dispose(){this.rings.dispose();this.shadows.dispose();}
}

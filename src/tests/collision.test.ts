import { describe,it,expect } from 'vitest';
import { Vector3,Ray,Mesh,MeshBasicMaterial,Raycaster } from 'three';
import {characterPartGeometry} from '../engine/rendering/CharacterGeometry';
import { Target } from '../engine/targets/Target';
import { SeededRandom } from '../engine/simulation/random';
import { castShot,type HitResult } from '../engine/collision/shoot';
const makeTarget=(x=0,z=-15)=>{const t=new Target(0,'stationary',new SeededRandom(1));t.spawn(x,z,0);return t;};
const cast=(ray:Ray,targets:Target[])=>castShot(ray,targets,{zone:'miss',target:null,point:new Vector3(),distance:150} satisfies HitResult);
describe('Exact 3D head, torso, limb and environment hit detection',()=>{
  it('classifies the visible head surface before the torso below it',()=>{
    const t=makeTarget(),ray=new Ray(new Vector3(0,1.68,0),new Vector3(0,0,-1)),hit=cast(ray,[t]);
    const geometry=characterPartGeometry(0),material=new MeshBasicMaterial(),visibleHead=new Mesh(geometry,material);
    visibleHead.matrixAutoUpdate=false;visibleHead.matrixWorld.copy(t.head.node.matrixWorld).scale(t.head.size);
    try{const surface=new Raycaster(ray.origin,ray.direction).intersectObject(visibleHead)[0];expect(surface).toBeDefined();expect(hit.zone).toBe('head');expect(hit.target).toBe(t);expect(hit.point.distanceTo(surface.point)).toBeLessThan(1e-6);}finally{geometry.dispose();material.dispose();}
  });
  it('classifies torso and leg shots without labeling them as heads',()=>{const t=makeTarget();expect(cast(new Ray(new Vector3(0,1.1,0),new Vector3(0,0,-1)),[t]).zone).toBe('torso');expect(cast(new Ray(new Vector3(0.13,0.2,0),new Vector3(0,0,-1)),[t]).zone).toBe('leg');});
  it('classifies an arm independently',()=>{const t=makeTarget();expect(cast(new Ray(new Vector3(0.34,1.16,0),new Vector3(0,0,-1)),[t]).zone).toBe('arm');});
  it('does not count the empty corners of a head bounding square',()=>{const t=makeTarget();expect(cast(new Ray(new Vector3(0.16,1.84,0),new Vector3(0,0,-1)),[t]).zone).not.toBe('head');});
  it('keeps the head collider attached during crouch and strafe animations',()=>{const t=makeTarget();t.behavior='crouch';for(let i=0;i<160;i++)t.step(i/120,1/120);t.crouch=1;t.updatePose(2);const center=t.headPosition(new Vector3());expect(center.y).toBeLessThan(1.4);const ray=new Ray(new Vector3(center.x,center.y,0),new Vector3(0,0,-1));expect(cast(ray,[t]).zone).toBe('head');expect(cast(new Ray(new Vector3(0,1.68,0),new Vector3(0,0,-1)),[t]).zone).not.toBe('head');});
  it('matches an arm after a joint rotation in world space',()=>{const t=makeTarget();t.leftArm.rotation.z=-0.7;t.root.updateMatrixWorld(true);for(const p of t.parts)p.inverse.copy(p.node.matrixWorld).invert();const part=t.parts.find(p=>p.zone==='arm')!,center=new Vector3().setFromMatrixPosition(part.node.matrixWorld);const ray=new Ray(new Vector3(center.x,center.y,0),new Vector3(0,0,-1));expect(t.intersect(ray,new Vector3())?.zone).toBe('arm');});
  it('blocks a target behind real cover and allows a lateral peek',()=>{const t=makeTarget(6.4,-19);expect(cast(new Ray(new Vector3(6.4,1.68,0),new Vector3(0,0,-1)),[t]).zone).toBe('wall');t.spawn(8,-19,0);const ray=new Ray(new Vector3(8,1.68,0),new Vector3(0,0,-1));expect(cast(ray,[t]).zone).toBe('head');});
  it('selects the nearest target and ignores eliminated targets',()=>{const front=makeTarget(0,-10),rear=makeTarget(0,-20);const ray=new Ray(new Vector3(0,1.68,0),new Vector3(0,0,-1));expect(cast(ray,[rear,front]).target).toBe(front);front.eliminate(1);expect(cast(ray,[rear,front]).target).toBe(rear);});
  it('does not confuse horizontal view position with a headshot',()=>{const t=makeTarget(3,-17);const center=t.headPosition(new Vector3()),origin=new Vector3(-2,2.2,5),ray=new Ray(origin,center.sub(origin).normalize());expect(cast(ray,[t]).zone).toBe('head');});
});

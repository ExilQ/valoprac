import {describe,it,expect} from 'vitest';
import {Box3,Ray,Vector3} from 'three';
import {Target} from '../engine/targets/Target';
import {SeededRandom} from '../engine/simulation/random';
import {castShot,castOperatorShot,type HitResult} from '../engine/collision/shoot';
import type {Obstacle} from '../engine/collision/environment';
const target=()=>{const t=new Target(0,'stationary',new SeededRandom(7));t.spawn(0,-8,0);return t;};
const output=():HitResult=>({zone:'miss',target:null,point:new Vector3(),distance:150});
const cover=(z:number,thickness:number,kind:'wall'|'cover'='cover'):Obstacle=>({box:new Box3(new Vector3(-2,0,z-thickness),new Vector3(2,3,z)),kind,color:0});
describe('Versioned high penetration changes Operator rays only',()=>{
 it('blocks ordinary rifle rays while attenuating a real Operator hit through thin cover',()=>{const t=target(),ray=new Ray(new Vector3(0,1.68,0),new Vector3(0,0,-1)),walls=[cover(-3,.2)];expect(castShot(ray,[t],output(),walls).zone).toBe('wall');const hit=castOperatorShot(ray,[t],output(),walls);expect(hit.zone).toBe('head');expect(hit.target).toBe(t);expect(hit.penetratedLayers).toBe(1);expect(hit.penetrationScale).toBeCloseTo(.65);});
 it('keeps thick tactical walls and ramps authoritative',()=>{const t=target(),ray=new Ray(new Vector3(0,1.68,0),new Vector3(0,0,-1));expect(castOperatorShot(ray,[t],output(),[cover(-3,1)]).zone).toBe('wall');expect(castOperatorShot(ray,[t],output(),[cover(-3,.5,'wall')]).zone).toBe('wall');});
 it('applies separate layer attenuation without altering an unobstructed target',()=>{const t=target(),ray=new Ray(new Vector3(0,1.68,0),new Vector3(0,0,-1));const through=castOperatorShot(ray,[t],output(),[cover(-2,.15),cover(-4,.15)]);expect(through.penetratedLayers).toBe(2);expect(through.penetrationScale).toBeCloseTo(.65*.65);expect(castOperatorShot(ray,[t],output(),[]).penetrationScale).toBe(1);});
});

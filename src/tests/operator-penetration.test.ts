import {describe,it,expect} from 'vitest';
import {Box3,Ray,Vector3} from 'three';
import {Target} from '../engine/targets/Target';
import {SeededRandom} from '../engine/simulation/random';
import {castShot,castOperatorShot,castWeaponShot,type HitResult} from '../engine/collision/shoot';
import {WEAPONS} from '../config/weapons';
import {PENETRATION_MATERIALS,PENETRATION_WEAPONS} from '../config/penetration';
import type {Obstacle} from '../engine/collision/environment';
const target=()=>{const t=new Target(0,'stationary',new SeededRandom(7));t.spawn(0,-8,0);return t;};
const output=():HitResult=>({zone:'miss',target:null,point:new Vector3(),distance:150});
const cover=(z:number,thickness:number,kind:'wall'|'cover'='cover'):Obstacle=>({box:new Box3(new Vector3(-2,0,z-thickness),new Vector3(2,3,z)),kind,color:0});
const attenuation=(thickness:number,layers=1)=>PENETRATION_MATERIALS.thickWood.retention**layers*Math.exp(-PENETRATION_MATERIALS.thickWood.resistance*thickness/PENETRATION_WEAPONS.high.power*PENETRATION_WEAPONS.high.loss);
describe('Shared, material-aware weapon penetration',()=>{
 it('keeps perception opaque while both rifles and Operator can reach a real target through thin wood',()=>{const t=target(),ray=new Ray(new Vector3(0,1.68,0),new Vector3(0,0,-1)),walls=[cover(-3,.2)];expect(castShot(ray,[t],output(),walls).zone).toBe('wall');const hit=castOperatorShot(ray,[t],output(),walls),rifle=castWeaponShot(ray,[t],output(),WEAPONS.rifleA,walls);expect(hit.zone).toBe('head');expect(hit.target).toBe(t);expect(hit.penetratedLayers).toBe(1);expect(hit.penetrationScale).toBeCloseTo(attenuation(.2));expect(rifle.zone).toBe('head');expect(rifle.penetrationScale).toBeLessThan(hit.penetrationScale!);});
 it('keeps impenetrable structures, over-budget wood and concrete authoritative',()=>{const t=target(),ray=new Ray(new Vector3(0,1.68,0),new Vector3(0,0,-1));expect(castOperatorShot(ray,[t],output(),[cover(-3,3)]).zone).toBe('wall');expect(castOperatorShot(ray,[t],output(),[cover(-3,.5,'wall')]).zone).toBe('wall');expect(castOperatorShot(ray,[t],output(),[{...cover(-3,.01),material:'reinforced'}]).zone).toBe('wall');});
 it('applies separate layer attenuation without altering an unobstructed target',()=>{const t=target(),ray=new Ray(new Vector3(0,1.68,0),new Vector3(0,0,-1));const through=castOperatorShot(ray,[t],output(),[cover(-2,.15),cover(-4,.15)]);expect(through.penetratedLayers).toBe(2);expect(through.penetrationScale).toBeCloseTo(attenuation(.3,2));expect(castOperatorShot(ray,[t],output(),[]).penetrationScale).toBe(1);});
});

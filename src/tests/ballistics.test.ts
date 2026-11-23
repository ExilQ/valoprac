import {describe,expect,it} from 'vitest';
import {Box3,Ray,Vector3} from 'three';
import {obstacleRayInterval,traceBallisticRay,type BallisticTarget} from '../engine/collision/Ballistics';
import {castWeaponShot,type HitResult} from '../engine/collision/shoot';
import {nearestEnvironmentHit,type Obstacle} from '../engine/collision/environment';
import {PENETRATION_MATERIALS as MATERIALS,PENETRATION_WEAPONS,materialFor,type SurfaceMaterial} from '../config/penetration';
import {WEAPONS,damageAt,type WeaponProfile} from '../config/weapons';
import {Target} from '../engine/targets/Target';
import {SeededRandom} from '../engine/simulation/random';

const forward=()=>new Ray(new Vector3(0,1.68,0),new Vector3(0,0,-1));
const wall=(front:number,thickness:number,material:SurfaceMaterial='thinWood'):Obstacle=>({box:new Box3(new Vector3(-20,0,-front-thickness),new Vector3(20,4,-front)),kind:'cover',color:0,material});
const candidate=(distance=12,zone:BallisticTarget['zone']='torso'):BallisticTarget=>({distance,zone,point:{x:0,y:1.68,z:-distance}});
const trace=(obstacles:Obstacle[],profile:WeaponProfile=WEAPONS.rifleA,target:BallisticTarget|null=candidate())=>traceBallisticRay(forward(),profile,target,obstacles);
const attenuation=(material:SurfaceMaterial,thickness:number,category:keyof typeof PENETRATION_WEAPONS='medium')=>MATERIALS[material].retention*Math.exp(-MATERIALS[material].resistance*thickness/PENETRATION_WEAPONS[category].power*PENETRATION_WEAPONS[category].loss);

describe('Exact wall intersection and traversal',()=>{
 it('measures actual normal entry, exit and thickness instead of box depth guesses',()=>{
  const interval=obstacleRayInterval(forward(),wall(3,.2),9)!;
  expect(interval.index).toBe(9);expect(interval.start).toBeCloseTo(3);expect(interval.end).toBeCloseTo(3.2);expect(interval.inside).toBe(false);
  expect(interval.normalIn.toArray()).toEqual([0,0,1]);expect(interval.normalOut.toArray()).toEqual([0,0,-1]);
  const shot=trace([wall(3,.2)]),segment=shot.segments[0];
  expect(segment.entry).toEqual({x:0,y:1.68,z:-3});expect(segment.exit.z).toBeCloseTo(-3.2);expect(segment.thickness).toBeCloseTo(.2);expect(segment.cost).toBeCloseTo(.16);
 });
 it('charges a longer path at an oblique angle and correspondingly lowers damage',()=>{
  const normal=trace([wall(3,.2)]),ray=new Ray(new Vector3(0,1.68,0),new Vector3(1,0,-1).normalize()),oblique=traceBallisticRay(ray,WEAPONS.rifleA,candidate(),[wall(3,.2)]);
  expect(oblique.segments[0].thickness).toBeCloseTo(.2*Math.SQRT2);expect(oblique.segments[0].cost/normal.segments[0].cost).toBeCloseTo(Math.SQRT2);expect(oblique.damageScale).toBeLessThan(normal.damageScale);
 });
 it('only traverses the portion remaining when the ray starts inside a material',()=>{
  const ray=new Ray(new Vector3(0,1.68,-3.1),new Vector3(0,0,-1)),shot=traceBallisticRay(ray,WEAPONS.rifleA,candidate(),[wall(3,.3)]);
  expect(shot.segments[0].inside).toBe(true);expect(shot.segments[0].entry.z).toBeCloseTo(-3.1);expect(shot.segments[0].thickness).toBeCloseTo(.2);expect(shot.damageScale).toBeCloseTo(attenuation('thinWood',.2));
 });
 it('ignores obstacles behind the ray and a parallel ray outside the volume',()=>{
  expect(obstacleRayInterval(forward(),wall(-4,.2))).toBeNull();
  expect(obstacleRayInterval(new Ray(new Vector3(30,1.68,0),new Vector3(0,0,-1)),wall(3,.2))).toBeNull();
  expect(trace([wall(-4,.2)]).segments).toHaveLength(0);
 });
 it('ignores zero-length corner tangency rather than charging an extra layer',()=>{
  const obstacle:Obstacle={box:new Box3(new Vector3(0,0,-2),new Vector3(1,3,-1)),kind:'cover',color:0,material:'thinWood'};
  const tangent=new Ray(new Vector3(-1,1,-1),new Vector3(1,0,-1).normalize()),grazing=traceBallisticRay(tangent,WEAPONS.rifleA,candidate(),[obstacle]);
  expect(grazing.penetratedLayers).toBe(0);expect(grazing.segments).toEqual([]);
 });
 for(const ascending of [1,-1] as const)it(`clips a ${ascending===1?'rising':'falling'} ramp to its occupied wedge`,()=>{
  const ramp:Obstacle={box:new Box3(new Vector3(-2,0,-4),new Vector3(2,2,-2)),kind:'cover',color:0,material:'thinWood',ramp:{axis:'z',low:0,high:2,ascending}};
  const ray=new Ray(new Vector3(0,1,0),new Vector3(0,0,-1)),interval=obstacleRayInterval(ray,ramp)!;
  expect(interval.end-interval.start).toBeCloseTo(1);
  expect(interval.start).toBeCloseTo(ascending===1?2:3);expect(interval.end).toBeCloseTo(ascending===1?3:4);
  expect(obstacleRayInterval(new Ray(new Vector3(0,2.1,0),new Vector3(0,0,-1)),ramp)).toBeNull();
 });
 it('clips an x-axis ramp and uses the sloped face normal',()=>{
  const ramp:Obstacle={box:new Box3(new Vector3(-2,0,-4),new Vector3(2,2,-2)),kind:'cover',color:0,material:'thinWood',ramp:{axis:'x',low:0,high:2,ascending:1}};
  const ray=new Ray(new Vector3(0,3,-3),new Vector3(0,-1,0)),interval=obstacleRayInterval(ray,ramp)!;
  expect(interval.start).toBeCloseTo(2);expect(interval.end).toBeCloseTo(3);expect(interval.normalIn.x).toBeCloseTo(-1/Math.sqrt(5));expect(interval.normalIn.y).toBeCloseTo(2/Math.sqrt(5));
 });
});

describe('Bounded material and weapon penetration',()=>{
 for(const material of Object.keys(MATERIALS) as SurfaceMaterial[])it(`applies the authored ${material} resistance and retention`,()=>{
  const shot=trace([wall(3,.02,material)]),segment=shot.segments[0];expect(segment.material).toBe(material);expect(segment.resistance).toBe(MATERIALS[material].resistance);
  if(material==='reinforced'){expect(shot.zone).toBe('wall');expect(shot.stopReason).toBe('material');expect(segment.penetrated).toBe(false);}
  else{expect(shot.zone).toBe('torso');expect(shot.damageScale).toBeCloseTo(attenuation(material,.02),9);expect(segment.penetrated).toBe(true);expect(shot.damageScale).toBeLessThan(1);}
 });
 for(const id of ['rifleA','rifleB','sheriff','operator'] as const)it(`uses the actual ${id} profile category without an Operator-only path`,()=>{
  const profile=WEAPONS[id],category=id==='rifleA'||id==='rifleB'?'medium':'high';expect(profile.penetration).toBe(category);
  expect(trace([wall(3,.2)],profile).damageScale).toBeCloseTo(attenuation('thinWood',.2,category));
 });
 it('keeps a low-power profile less capable than medium and high profiles',()=>{
  const low={...WEAPONS.rifleA,penetration:'low' as const},surface=wall(3,.1,'concrete');
  expect(trace([surface],low).stopReason).toBe('capacity');expect(trace([surface],WEAPONS.rifleA).zone).toBe('torso');
  expect(trace([surface],WEAPONS.sheriff).damageScale).toBeGreaterThan(trace([surface],WEAPONS.rifleA).damageScale);
 });
 it('uses total remaining resistance budget across separated surfaces',()=>{
  const first=wall(2,.5,'thinWood'),second=wall(4,.2,'concrete'),shot=trace([first,second]);
  expect(shot.stopReason).toBe('capacity');expect(shot.segments).toHaveLength(2);expect(shot.segments[0].penetrated).toBe(true);expect(shot.segments[1].penetrated).toBe(false);expect(shot.remainingPower).toBeCloseTo(1.2);
 });
 it('accepts an exactly affordable surface but blocks a thicker one',()=>{
  const exact=PENETRATION_WEAPONS.medium.power/MATERIALS.thinWood.resistance;
  expect(trace([wall(3,exact)]).zone).toBe('torso');expect(trace([wall(3,exact+.001)]).stopReason).toBe('capacity');
 });
 it('limits separated material layers independently of a large remaining budget',()=>{
  const surfaces=Array.from({length:4},(_,i)=>wall(2+i,.005,'glass')),medium=trace(surfaces),high=trace(surfaces,WEAPONS.operator);
  expect(medium.stopReason).toBe('layers');expect(medium.penetratedLayers).toBe(3);expect(medium.remainingPower).toBeGreaterThan(1.5);expect(high.zone).toBe('torso');expect(high.penetratedLayers).toBe(4);
 });
 it('does not double-charge duplicated or overlapping boxes of the same material',()=>{
  const once=trace([wall(3,.4)]),duplicate=trace([wall(3,.4),wall(3,.4)]),overlap=trace([wall(3,.3),wall(3.2,.2)]);
  for(const shot of [duplicate,overlap]){expect(shot.penetratedLayers).toBe(1);expect(shot.damageScale).toBeCloseTo(once.damageScale,10);expect(shot.remainingPower).toBeCloseTo(once.remainingPower,10);}
 });
 it('treats touching same-material boxes as one layer, while air gaps create two',()=>{
  const single=trace([wall(3,.4)]),touching=trace([wall(3,.2),wall(3.2,.2)]),separated=trace([wall(3,.2),wall(3.3,.2)]);
  expect(touching.penetratedLayers).toBe(1);expect(touching.damageScale).toBeCloseTo(single.damageScale,10);expect(separated.penetratedLayers).toBe(2);expect(separated.damageScale).toBeCloseTo(single.damageScale*MATERIALS.thinWood.retention,10);
 });
 it('applies the strongest overlapping material and never hides an opaque insert',()=>{
  const surfaces=[wall(3,.4,'thinWood'),wall(3.1,.1,'reinforced')];
  for(const obstacles of [surfaces,surfaces.slice().reverse()]){const shot=trace(obstacles);expect(shot.zone).toBe('wall');expect(shot.stopReason).toBe('material');expect(shot.distance).toBeCloseTo(3.1);expect(shot.segments.at(-1)?.material).toBe('reinforced');}
 });
 it('attenuates by both material changes and path length in overlapping composites',()=>{
  const shot=trace([wall(3,.4,'thinWood'),wall(3.1,.1,'thinMetal')]);
  expect(shot.segments.map(s=>s.material)).toEqual(['thinWood','thinMetal','thinWood']);
  expect(shot.penetratedLayers).toBe(3);expect(shot.remainingPower).toBeCloseTo(1.6-(.3*.8+.1*4));
  expect(shot.damageScale).toBeCloseTo(MATERIALS.thinWood.retention**2*MATERIALS.thinMetal.retention*Math.exp(-(.3*.8+.1*4)/1.6*.8));
 });
 it('preserves deterministic results irrespective of obstacle array order',()=>{
  const surfaces=[wall(2,.04,'drywall'),wall(4,.03,'thinMetal'),wall(6,.08,'thinWood')],a=trace(surfaces),b=trace(surfaces.slice().reverse());
  expect(a.zone).toBe(b.zone);expect(a.damageScale).toBe(b.damageScale);expect(a.distance).toBe(b.distance);expect(a.segments.map(s=>s.material)).toEqual(b.segments.map(s=>s.material));
 });
 it('uses explicit materials and conservative defaults for legacy geometry',()=>{
  const base=wall(3,.1);delete base.material;expect(materialFor(base)).toBe('thickWood');expect(materialFor({...base,kind:'wall'})).toBe('concrete');expect(materialFor({...base,ramp:{axis:'z',ascending:1,low:0,high:2}})).toBe('reinforced');expect(materialFor({...base,material:'glass'})).toBe('glass');
 });
});

describe('Physical stop order and common player/bot bullet traversal',()=>{
 it('leaves an unobstructed target unchanged and ignores walls behind it',()=>{
  for(const surfaces of [[],[wall(15,2,'reinforced')]]){const shot=trace(surfaces);expect(shot.zone).toBe('torso');expect(shot.stopReason).toBe('target');expect(shot.damageScale).toBe(1);expect(shot.distance).toBe(12);expect(shot.segments).toHaveLength(0);}
 });
 it('reports a range miss rather than awarding a target beyond maximum distance',()=>{
  const shot=traceBallisticRay(forward(),WEAPONS.rifleA,candidate(200),[],150);expect(shot.zone).toBe('miss');expect(shot.stopReason).toBe('range');expect(shot.distance).toBe(150);
 });
 it('retains entry/exit information when a penetrating ray misses a body',()=>{
  const shot=trace([wall(3,.1)],WEAPONS.rifleA,null);expect(shot.zone).toBe('miss');expect(shot.stopReason).toBe('range');expect(shot.penetratedLayers).toBe(1);expect(shot.segments[0].penetrated).toBe(true);
 });
 it('stops at the floor before any surface or target behind it',()=>{
  const ray=new Ray(new Vector3(0,1,0),new Vector3(0,-1,-1).normalize()),surface=wall(3,.2,'reinforced'),shot=traceBallisticRay(ray,WEAPONS.rifleA,candidate(12),[surface]);
  expect(shot.stopReason).toBe('floor');expect(shot.zone).toBe('wall');expect(shot.distance).toBeCloseTo(Math.SQRT2);expect(shot.point.y).toBeCloseTo(0);expect(shot.segments).toHaveLength(0);
 });
 it('clips traversed thickness at the floor when the floor lies inside a volume',()=>{
  const ray=new Ray(new Vector3(0,1,0),new Vector3(0,-1,-1).normalize()),surface:Obstacle={box:new Box3(new Vector3(-2,-2,-4),new Vector3(2,2,-.5)),kind:'cover',color:0,material:'glass'},shot=traceBallisticRay(ray,WEAPONS.rifleA,candidate(12),[surface]);
  expect(shot.stopReason).toBe('floor');expect(shot.point.y).toBeCloseTo(0);expect(shot.segments).toHaveLength(1);expect(shot.segments[0].exit.y).toBeCloseTo(0);expect(shot.segments[0].thickness).toBeCloseTo(Math.SQRT1_2);
 });
 it('awards a closer target before the floor',()=>{
  const ray=new Ray(new Vector3(0,1,0),new Vector3(0,-1,-1).normalize()),shot=traceBallisticRay(ray,WEAPONS.rifleA,candidate(.5),[]);expect(shot.stopReason).toBe('target');expect(shot.distance).toBe(.5);
 });
 for(const id of ['rifleA','rifleB','sheriff','operator'] as const)it(`uses identical ${id} wall damage for the visible-target adapter and shared physical tracer`,()=>{
  const target=new Target(0,'stationary',new SeededRandom(71));target.spawn(0,-8,0);const surfaces=[wall(3,.12,'drywall'),wall(5,.03,'thinMetal')],ray=forward(),out:HitResult={zone:'miss',target:null,point:new Vector3(),distance:150};
  const player=castWeaponShot(ray,[target],out,WEAPONS[id],surfaces);expect(player.target).toBe(target);expect(player.zone).toBe('head');
  const common=traceBallisticRay(ray,WEAPONS[id],{zone:player.zone,distance:player.distance,point:player.point},surfaces);
  expect(common.damageScale).toBe(player.penetrationScale);expect(common.segments).toEqual(player.segments);expect(common.penetratedLayers).toBe(player.penetratedLayers);expect(damageAt(WEAPONS[id],player.zone,player.distance)*player.penetrationScale!).toBeCloseTo(damageAt(WEAPONS[id],common.zone,common.distance)*common.damageScale);
  // The same thin cover still blocks perception. Ballistic reach never grants sight.
  expect(nearestEnvironmentHit(ray,150,new Vector3(),surfaces)).toBeCloseTo(3);
 });
 it('clears old penetration metadata when reusing the player hit result',()=>{
  const target=new Target(0,'stationary',new SeededRandom(71));target.spawn(0,-8,0);const out:HitResult={zone:'miss',target:null,point:new Vector3(),distance:150};
  castWeaponShot(forward(),[target],out,WEAPONS.rifleA,[wall(3,.1)]);expect(out.penetratedLayers).toBe(1);
  castWeaponShot(forward(),[target],out,WEAPONS.rifleA,[]);expect(out.penetratedLayers).toBe(0);expect(out.penetrationScale).toBe(1);expect(out.segments).toEqual([]);
 });
});

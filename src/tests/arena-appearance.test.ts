import {describe,expect,it,vi,afterEach} from 'vitest';
import {Box3,Vector3} from 'three';
import {arenaLight,arenaPalette} from '../config/arenaAppearance';
import {arenaPattern,loadArenaPatterns,storeArenaPatterns} from '../config/arenaPatterns';
import type {Obstacle} from '../engine/collision/environment';
import {surfaceForObstacle} from '../config/surfaces';
import {arenaSky} from '../engine/rendering/ArenaAtmosphere';
import {arenaGroundPaint} from '../engine/rendering/ArenaGroundPaint';
import {architecturalBox} from '../engine/rendering/ArchitecturalBox';
import {SurfaceMaterialLibrary} from '../engine/rendering/SurfaceMaterials';
import {tacticalBands,tacticalSurfaceStyle} from '../engine/rendering/TacticalSurface';

afterEach(()=>vi.unstubAllGlobals());

describe('arena rendering art direction',()=>{
 it('changes the render material and bands across map palettes while keeping the underlying solid',()=>{
  const wall:Obstacle={kind:'wall',surfaceId:'plasteredConcrete',color:0xffffff,box:new Box3(new Vector3(-2,0,-.4),new Vector3(2,4,.4))};
  const original=wall.box.clone();
  const garage=tacticalSurfaceStyle(wall,'garage'),corridor=tacticalSurfaceStyle(wall,'long');
  expect(garage.family).toBe('painted-concrete');
  expect(corridor.family).toBe('stone');
  expect(garage.tint).not.toBe(corridor.tint);
  const geometry=architecturalBox(4,4,.8,.035,tacticalBands(wall,'long'));
  expect(geometry.getAttribute('color').count).toBeGreaterThan(0);
  geometry.computeBoundingBox();
  expect(geometry.boundingBox?.getSize(new Vector3()).toArray()).toEqual([4,4,expect.closeTo(.8)]);
  expect(wall.box.equals(original)).toBe(true);
  expect(surfaceForObstacle(wall)).toBe('plasteredConcrete');
  expect(arenaPalette('complex','research').wall).not.toBe(arenaPalette('complex','courtyard').wall);
  geometry.dispose();
 });
 it('renders distinct tile choices with world-scale preferences and shared textures',()=>{
  let stored:string|null=null;
  vi.stubGlobal('localStorage',{getItem:()=>stored,setItem:(_key:string,value:string)=>{stored=value;}});
  const preferences=loadArenaPatterns();
  expect(arenaPattern('complex',true,preferences)).toEqual({surfacePattern:'industrial-grid',metersPerTile:2.4});
  storeArenaPatterns({floor:'tile',walls:'plain',floorScale:.75,wallScale:1.2});
  const chosen=loadArenaPatterns(),pattern=arenaPattern('complex',true,chosen);
  expect(arenaPattern('complex',false,chosen)).toEqual({});
  const library=new SurfaceMaterialLibrary({quality:'low',scalarLow:true});
  const floor=library.material('stone',pattern),otherTint=library.material('stone',{...pattern,tint:0x668888});
  expect(floor.userData.surfaceMetersPerTile).toBe(.75);
  expect(floor.map).toBeTruthy();
  expect(floor.map).toBe(otherTint.map);
  expect(library.material('stone').map).toBeNull();
  library.dispose();
 });
 it('paints upward-facing lane graphics and builds a graded sky texture',()=>{
  const paint=arenaGroundPaint('complex')!;
  const normal=paint.getAttribute('normal');
  for(let i=0;i<normal.count;i++)expect(normal.getY(i)).toBeCloseTo(1);
  const positions=paint.getAttribute('position');
  for(let i=0;i<positions.count;i++)expect(positions.getY(i)).toBeCloseTo(.029);
  paint.dispose();
  const lighting=arenaLight('site'),sky=arenaSky(lighting.zenith,lighting.horizon);
  expect(sky.image.data.length).toBe(128*64*4);
  expect(sky.image.data.slice(0,3)).not.toEqual(sky.image.data.slice(-4,-1));
  sky.dispose();
 });
});

import {describe,it,expect} from 'vitest';
import {visibleBetween} from '../engine/tactical/levels';
import {obstaclesFor} from '../engine/tactical/map';
import {surfaceHeight} from '../engine/collision/environment';

describe('Audible map occlusion uses actual tactical collision segments',()=>{
 it('attenuates a cue behind cover while preserving an open adjacent lane',()=>{
  const map=obstaclesFor('range');
  expect(visibleBetween(map,{x:-6.4,y:1.64,z:-10},{x:-6.4,y:1,z:-14})).toBe(false);
  expect(visibleBetween(map,{x:0,y:1.64,z:-10},{x:0,y:1,z:-14})).toBe(true);
 });
 it('does not classify an ordinary landing endpoint as a wall',()=>{
  expect(visibleBetween(obstaclesFor('range'),{x:0,y:1.64,z:5},{x:0,y:0,z:5})).toBe(true);
 });
 it('excludes the actual ramp contact endpoint without treating its whole bounding box as solid',()=>{
  const map=obstaclesFor('bunny'),ramp=map.find(o=>o.ramp)!;
  expect(ramp).toBeDefined();const x=(ramp.box.min.x+ramp.box.max.x)/2,z=(ramp.box.min.z+ramp.box.max.z)/2,y=surfaceHeight(ramp,x,z);
  expect(visibleBetween(map,{x,y:y+1.64,z},{x,y,z})).toBe(true);
 });
});

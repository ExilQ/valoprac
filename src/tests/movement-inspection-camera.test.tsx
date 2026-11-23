import {describe,it,expect} from 'vitest';
import {Box3,PerspectiveCamera,Vector3} from 'three';
import {renderToStaticMarkup} from 'react-dom/server';
import {inspectionCamera} from '../ui/replayTransport';
import {ReplayViewer} from '../ui/ReplayViewer';
import {Simulation} from '../engine/simulation/Simulation';
import {ReplayRecorder} from '../engine/replay/recording';
import {simulationChecksum} from '../engine/replay/integrity';
import {DEFAULT_SETTINGS} from '../config/settings';
import {emptyInput} from '../engine/types';
import {cameraVerticalFov} from '../engine/rendering/projection';

describe('A3 third-person inspection is a separate collision-aware display camera',()=>{
 it('follows the recorded yaw from behind and frames the player stance without changing its pose',()=>{
  const position={x:3,y:1.2,z:-7},before={...position};
  const back=inspectionCamera(position,'third-person',{targets:[],aspect:16/9,yaw:0})!;
  expect(back.position).toEqual({x:3,y:3.5999999999999996,z:-3});expect(back.target).toEqual({x:3,y:2.5,z:-7});expect(back.fov).toBe(65);
  const side=inspectionCamera(position,'third-person',{targets:[],aspect:16/9,yaw:Math.PI/2})!;
  expect(side.position.x).toBeCloseTo(7);expect(side.position.z).toBeCloseTo(-7);expect(position).toEqual(before);
  const camera=new PerspectiveCamera(cameraVerticalFov(back.fov,1,16/9),16/9,.05,500);camera.position.set(back.position.x,back.position.y,back.position.z);camera.lookAt(back.target.x,back.target.y,back.target.z);camera.updateMatrixWorld(true);
  const head=new Vector3(position.x,position.y+1.7,position.z).project(camera);expect(Math.abs(head.x)).toBeLessThan(1);expect(Math.abs(head.y)).toBeLessThan(1);expect(head.z).toBeLessThan(1);
 });
 it('shortens only the review camera boom before an actual wall or ceiling',()=>{
  const position={x:0,y:0,z:5},wall={box:new Box3(new Vector3(-5,0,7),new Vector3(5,4,7.4)),kind:'wall' as const,color:0};
  const camera=inspectionCamera(position,'third-person',{targets:[],aspect:16/9,yaw:0,obstacles:[wall]})!;
  expect(camera.position.z).toBeGreaterThan(5);expect(camera.position.z).toBeLessThan(7);expect(camera.target).toEqual({x:0,y:1.3,z:5});
  const ceiling={box:new Box3(new Vector3(-5,1.8,-5),new Vector3(5,2,10)),kind:'wall' as const,color:0};
  const under=inspectionCamera(position,'third-person',{targets:[],aspect:16/9,yaw:0,obstacles:[ceiling]})!;
  expect(under.position.y).toBeLessThan(1.8);expect(position).toEqual({x:0,y:0,z:5});
 });
 it('accepts initial third-person review and leaves full authoritative state unchanged',()=>{
  const simulation=new Simulation('free','rifleA',structuredClone(DEFAULT_SETTINGS)),recorder=new ReplayRecorder(simulation);simulation.running=true;simulation.step(1/120,emptyInput());simulation.running=false;const recording=recorder.finish()!,before=simulationChecksum(simulation);
  for(const mode of ['first-person','third-person','top-down'] as const)inspectionCamera(simulation.movement.position,mode,{targets:simulation.targets.map(t=>t.position),aspect:16/9,yaw:simulation.viewYaw,obstacles:simulation.obstacles});
  expect(simulationChecksum(simulation)).toBe(before);const html=renderToStaticMarkup(<ReplayViewer recording={recording} initialCamera="third-person"/>);
  expect(html).toContain('3인칭 검토');expect(html).toContain('aria-pressed="true">3인칭 검토');expect(html).not.toContain('pointerlock');
 });
});

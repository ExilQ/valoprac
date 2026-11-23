import {afterEach,describe,expect,it,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {ReplayLibrary,ReplayViewer,readReplayFile,replayDisplaySettings} from '../ui/ReplayViewer';
import {Simulation} from '../engine/simulation/Simulation';
import {ReplayRecorder} from '../engine/replay/recording';
import {encodeReplay} from '../engine/replay/codec';
import {MAX_REPLAY_COMPRESSED_BYTES,type ReplayRecording} from '../engine/replay/types';
import {DEFAULT_SETTINGS} from '../config/settings';
import {emptyInput} from '../engine/types';
import {inspectionCamera,inspectionCutawayHeight,replayTime} from '../ui/replayTransport';
import {PerspectiveCamera,Vector3} from 'three';
import {cameraVerticalFov} from '../engine/rendering/projection';

function fixture(){const sim=new Simulation('free','rifleA',structuredClone(DEFAULT_SETTINGS)),recorder=new ReplayRecorder(sim);sim.running=true;for(let i=0;i<12;i++)sim.step(1/120,emptyInput());sim.running=false;const recording=recorder.finish()!;recorder.dispose();return{sim,recording};}

describe('A2 lazy replay viewer boundaries',()=>{
 afterEach(()=>vi.restoreAllMocks());
 it('renders unsupported or corrupted local data as an error without reading arbitrary weapon fields',()=>{
  const bad={schema:1,header:{gameVersion:'x',initial:{weapon:'not-a-weapon'}},duration:1,ticks:120,commands:[],events:[],final:{}} as unknown as ReplayRecording;
  const html=renderToStaticMarkup(<ReplayViewer recording={bad}/>);expect(html).toContain('role="alert"');expect(html).toContain('재생할 수 있는');expect(html).not.toContain('replay-viewport');
 });
 it('keeps old training history usable and describes local import without inventing recordings',()=>{
  const html=renderToStaticMarkup(<ReplayLibrary sessions={[]}/>);expect(html).toContain('파일 가져오기');expect(html).toContain('서버로 보내지 않습니다');expect(html).toContain('저장된 리플레이가 없습니다');expect(html).not.toContain('replay-viewport');
 });
 it('exposes first-person, top-down, fixed-time seeking and verification for an actual recorded simulation',()=>{
  const{recording}=fixture(),before=JSON.stringify(recording);const html=renderToStaticMarkup(<ReplayViewer recording={recording} initialTime={.05}/>);
  for(const label of ['리플레이 시간 탐색','리플레이 재생 속도','1인칭','위에서 보기','무결성 다시 검사','리플레이 파일 저장'])expect(html).toContain(label);
  expect(html).toContain('입력과 판정을 재실행');expect(JSON.stringify(recording)).toBe(before);
 });
 it('lists only local sessions carrying a supported recording envelope',()=>{
  const{sim,recording}=fixture(),s=sim.snapshot();const html=renderToStaticMarkup(<ReplayLibrary sessions={[s,{...s,id:'recorded',replay:recording}]}/>);expect((html.match(/>다시 보기</g)??[]).length).toBe(1);
 });
 it('applies Low only to viewer display policy while keeping recorded controls and physics untouched',()=>{
  const original={...structuredClone(DEFAULT_SETTINGS),graphicsPreset:'ultra' as const,renderScale:.5,autoGraphics:false},before=JSON.stringify(original),low=replayDisplaySettings(original,true),normal=replayDisplaySettings(original,false);
  expect(low.graphicsPreset).toBe('low');expect(low.renderScale).toBe(.5);expect(low.sensitivity).toBe(original.sensitivity);expect(low.movementPhysics).toBe(original.movementPhysics);expect(normal.graphicsPreset).toBe('ultra');expect(JSON.stringify(original)).toBe(before);
 });
 it('opens the roof cutaway above every active scaled or elevated target without using hidden targets',()=>{
  const position={x:0,y:0,z:0},targets=[{enabled:true,active:true,position:{x:0,y:1.2,z:-10},scale:2},{enabled:true,active:false,position:{x:0,y:100,z:0},scale:1}];const before=JSON.stringify({position,targets});
  expect(inspectionCutawayHeight(position,targets)).toBeCloseTo(5.3);expect(inspectionCutawayHeight(position,[])).toBe(2.6);expect(JSON.stringify({position,targets})).toBe(before);
 });
 it('frames the player and distant elevated defenders at narrow and ultrawide aspect ratios',()=>{
  const position={x:-4,y:0,z:5},targets=[{x:7,y:1.2,z:-23},{x:-6,y:0,z:-15}];
  for(const aspect of[390/844,16/9,3440/1440]){const view=inspectionCamera(position,'top-down',{targets,aspect})!,camera=new PerspectiveCamera(cameraVerticalFov(view.fov,1,aspect),aspect,.05,500);camera.position.set(view.position.x,view.position.y,view.position.z);camera.lookAt(view.target.x,view.target.y,view.target.z);camera.updateMatrixWorld(true);for(const p of[position,...targets]){const screen=new Vector3(p.x,p.y+1.7,p.z).project(camera);expect(Math.abs(screen.x)).toBeLessThan(1);expect(Math.abs(screen.y)).toBeLessThan(1);expect(screen.z).toBeLessThan(1);}}
 });
 it('rejects an oversized file before attempting to allocate its buffer',async()=>{
  const arrayBuffer=vi.fn();await expect(readReplayFile({size:MAX_REPLAY_COMPRESSED_BYTES+1,arrayBuffer})).rejects.toThrow('이하여야');expect(arrayBuffer).not.toHaveBeenCalled();
 });
 it('imports actual encoded data locally and refuses malformed bytes',async()=>{
  const{recording}=fixture(),bytes=await encodeReplay(recording),arrayBuffer=vi.fn(async()=>Uint8Array.from(bytes).buffer);const decoded=await readReplayFile({size:bytes.length,arrayBuffer});expect(decoded.final).toEqual(recording.final);expect(arrayBuffer).toHaveBeenCalledOnce();
  await expect(readReplayFile({size:3,arrayBuffer:async()=>new Uint8Array([1,2,3]).buffer})).rejects.toThrow('gzip');
 });
 it('rejects incompatible versions before replacing the current library selection',async()=>{
  const{recording}=fixture();recording.header.gameVersion='incompatible-test-version';const bytes=await encodeReplay(recording);await expect(readReplayFile({size:bytes.length,arrayBuffer:async()=>Uint8Array.from(bytes).buffer})).rejects.toThrow('호환되지 않는');
 });
 it('rounds timeline minute boundaries once without rendering a sixty-second remainder',()=>{
  expect(replayTime(59.96)).toBe('01:00.0');expect(replayTime(59.94)).toBe('00:59.9');expect(replayTime(-1)).toBe('00:00.0');expect(replayTime(NaN)).toBe('00:00.0');
 });
});

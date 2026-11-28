import {afterAll,afterEach,describe,expect,it,vi} from 'vitest';
import {writeFileSync} from 'node:fs';
import {renderToStaticMarkup} from 'react-dom/server';
import {PerspectiveCamera,Vector3} from 'three';
import {DEFAULT_SETTINGS} from '../config/settings';
import {WEAPONS} from '../config/weapons';
import {Simulation} from '../engine/simulation/Simulation';
import {FIXED_DT} from '../engine/simulation/FixedClock';
import {emptyInput,type Settings} from '../engine/types';
import {cameraVerticalFov,PROJECTION_CALIBRATION} from '../engine/rendering/projection';
import {useApp} from '../app/store';
import {trainingChoice,type TrainingNavigation} from '../app/trainingNavigation';
import {trainingTitle,trainingDescription,trainingMapTitle} from '../ui/trainingPresentation';
import {MainMenu} from '../ui/MainMenu';
import {GameHUD} from '../ui/GameHUD';
import {Results} from '../ui/Results';
import {History} from '../ui/History';
import {GameStage} from '../components/GameStage';
import {INITIAL_TELEMETRY} from '../engine/Runtime';
// These tests verify the calibration evidence recorded for the 12.35 rules
// (acceleration-v10); reference-v11 behaviour is covered by its own tests.
vi.mock('../engine/simulation/rules',async original=>({...await original<typeof import('../engine/simulation/rules')>(),CURRENT_SIMULATION_RULES:'acceleration-v10'}));

const initial={...useApp.getInitialState()};
const measurements:{projection:unknown[];spread:unknown[];labels:unknown[]}={projection:[],spread:[],labels:[]};
afterEach(()=>{Object.assign(useApp.getInitialState(),initial);useApp.setState(initial);});
afterAll(()=>{if(process.env.VALOPRAC_STAGE1_UI_REPORT)writeFileSync(process.env.VALOPRAC_STAGE1_UI_REPORT,JSON.stringify({schema:1,issues:['F3','F5','F6','F7'],environment:{engine:'Three.js PerspectiveCamera and actual fixed-step Simulation',stepSeconds:FIXED_DT,physicalDeviceTest:false},projectionModel:PROJECTION_CALIBRATION,...measurements},null,2)+'\n');});

describe('F3 camera projection and target size, independent of optical zoom terminology',()=>{
 for(const[width,height]of[[1366,768],[1920,1080],[3440,1440]])for(const[zoom,target]of[[1.25,82.4],[2.5,41.2],[5,20.6]])it(`${width}x${height} ${zoom}x measures camera FOV and projected 30cm target at 20m`,()=>{
  const c=new PerspectiveCamera(cameraVerticalFov(103,zoom,width/height),width/height,.01,500);c.updateMatrixWorld(true);
  const left=new Vector3(-.15,0,-20).project(c),right=new Vector3(.15,0,-20).project(c),top=new Vector3(0,.15,-20).project(c),bottom=new Vector3(0,-.15,-20).project(c),center=new Vector3(0,0,-20).project(c);
  const projectedWidth=(right.x-left.x)*width/2,projectedHeight=(top.y-bottom.y)*height/2;
  const expectedPixels=width*.3/(2*20*Math.tan(target*Math.PI/360));
  const measuredHorizontal=2*Math.atan(1/c.projectionMatrix.elements[0])*180/Math.PI;
  expect(Math.abs(measuredHorizontal-target)).toBeLessThan(.1);expect(projectedWidth).toBeCloseTo(expectedPixels,9);expect(projectedHeight).toBeCloseTo(expectedPixels,9);expect(center.x).toBe(0);expect(center.y).toBe(0);
  const optical=2*Math.atan(Math.tan(103*Math.PI/360)/zoom)*180/Math.PI;expect(Math.abs(measuredHorizontal-optical)).toBeGreaterThan(7);
  measurements.projection.push({width,height,zoom,measuredHorizontalDegrees:measuredHorizontal,targetHorizontalDegrees:target,toleranceDegrees:.1,targetWidthMeters:.3,targetDistanceMeters:20,projectedWidthPixels:projectedWidth,projectedHeightPixels:projectedHeight,expectedPixels,centerNdc:[center.x,center.y],passed:true});
 });
 it('records provisional provenance instead of claiming an official or optical formula',()=>{expect(PROJECTION_CALIBRATION.classification).toBe('provisional-calibration');expect(PROJECTION_CALIBRATION.nativeReferenceMeasured).toBe(false);});
});

function sampleFirstShots(id:'rifleA'|'rifleB',seed:number,count:number){
 const s=new Simulation('free',id,{...DEFAULT_SETTINGS,seed,analysisWall:true,targetCount:1});s.running=true;s.movement.landedAt=-100;
 const axis=new Vector3(0,0,-1),angles:number[]=[],directions:{x:number;y:number;z:number}[]=[];
 let maxComponentDifference=0;
 for(let i=0;i<count;i++){
  // Reset chamber/recoil/bloom but deliberately retain this session's seeded
  // spread RNG; every sample is an independently rested first shot through
  // Simulation.step/fireShot, not a copied or synthetic direction generator.
  s.weapon.resetForEncounter(s.time,true);s.step(FIXED_DT,{...emptyInput(),ads:true,firePresses:1});
  const shot=s.shots.at(-1)!;expect(shot.firstShot).toBe(true);expect(shot.ads).toBe(true);expect(shot.spread.movement).toBe(0);expect(shot.spread.air).toBe(0);expect(shot.spread.bloom).toBe(0);
  maxComponentDifference=Math.max(maxComponentDifference,Math.abs(shot.spread.total-WEAPONS[id].firstSpread*WEAPONS[id].adsSpread));
  const direction=new Vector3(shot.direction.x,shot.direction.y,shot.direction.z);angles.push(direction.angleTo(axis)*180/Math.PI);if(i<8)directions.push({...shot.direction});
 }
 const squared=angles.reduce((n,a)=>n+a*a,0),sorted=angles.slice().sort((a,b)=>a-b);
 return{count,seed,maxComponentDifference,maximumDegrees:Math.max(...angles),rmsDegrees:Math.sqrt(squared/count),p95Degrees:sorted[Math.floor((count-1)*.95)],firstDirections:directions};
}
describe('F5 actual seeded stationary ADS first-shot directions',()=>{
 for(const[id,cone]of[['rifleA',.1575],['rifleB',.11]]as const)it(`${id} samples its ${cone} degree half-cone through real Simulation shots`,()=>{
  const report=sampleFirstShots(id,76123,4096),repeat=sampleFirstShots(id,76123,8);
  expect(report.firstDirections).toEqual(repeat.firstDirections);expect(report.maxComponentDifference).toBeLessThan(1e-12);
  expect(report.maximumDegrees).toBeLessThanOrEqual(cone+1e-6);expect(report.maximumDegrees).toBeGreaterThan(cone*.995);
  expect(Math.abs(report.rmsDegrees-cone/Math.sqrt(2))).toBeLessThan(cone*.02);expect(Math.abs(report.p95Degrees-cone*Math.sqrt(.95))).toBeLessThan(cone*.015);
  measurements.spread.push({weapon:id,classification:'provisional-calibration',source:'2026-10-29 improvement report; 09.01 adopted ADS multipliers',standingHalfConeDegrees:cone,expectedUniformDiscRmsDegrees:cone/Math.sqrt(2),rmsToleranceDegrees:cone*.02,...report,passed:true});
 });
 it('keeps recoil, repeated-fire bloom and airborne penalties separate from the standing first-shot cone',()=>{
  const s=new Simulation('free','rifleA',{...DEFAULT_SETTINGS,analysisWall:true});s.running=true;s.movement.landedAt=-100;
  for(let i=0;i<30;i++)s.step(FIXED_DT,{...emptyInput(),ads:true,fire:true});
  expect(s.shots.length).toBeGreaterThan(1);expect(s.shots[0].spread.total).toBeCloseTo(.1575,12);expect(s.shots[1].recoil.pitch).toBeGreaterThan(0);
  s.movement.grounded=false;expect(s.weapon.calculateSpread(s.movement,true,false).air).toBe(WEAPONS.rifleA.airSpread);
  s.weapon.bloom=.5;s.movement.grounded=true;expect(s.weapon.calculateSpread(s.movement,true,false).bloom).toBeCloseTo(.5*.63,12);
 });
});

describe('F7 all eight navigation tasks retain their name across menu, preparation, HUD, result and history',()=>{
 const labels:Record<TrainingNavigation,string>={free:'자유 훈련장',timed:'헤드샷 정밀도',braking:'톡브레이킹 훈련',spray:'반동 연습',tactical:'각체크·피킹',vertical:'수직 각체크 훈련',bunny:'버니합 훈련',wallbang:'월샷 훈련'};
 for(const[id,title]of Object.entries(labels)as[TrainingNavigation,string][])it(`${id}: accurate task identity survives a free-mode-backed session`,()=>{
  const choice=trainingChoice(id),settings={...DEFAULT_SETTINGS,...choice.settings} as Settings,s=new Simulation(choice.mode,'rifleA',settings),session=s.snapshot();
  const state={...initial,mode:choice.mode,settings,history:[session],result:session};Object.assign(useApp.getInitialState(),state);useApp.setState(state);
  const menu=renderToStaticMarkup(<MainMenu/>),preparation=renderToStaticMarkup(<GameStage/>),hud=renderToStaticMarkup(<GameHUD runtime={null} settings={settings} telemetry={INITIAL_TELEMETRY} mode={choice.mode} weapon="rifleA"/>),result=renderToStaticMarkup(<Results/>),history=renderToStaticMarkup(<History/>);
  expect(trainingTitle(choice.mode,settings)).toBe(title);
  const launch=menu.match(/<button class="start-button"[^>]*>(.*?)<\/button>/)?.[1];expect(launch).toContain(title);
  expect(preparation).toContain('훈련 준비 완료');expect(preparation).toContain('>'+title+'</h2>');expect(preparation).toContain(trainingDescription(choice.mode,settings));
  expect(hud).toContain(title);expect(result).toContain(title);expect(history).toContain(title);
  if(!['free','timed'].includes(id)){expect(preparation).not.toContain('무기를 바꾸고 표적을 조정하며 자유롭게 연습하세요.');expect(hud).not.toContain('자유 훈련');}
  measurements.labels.push({task:id,title,screens:['main-menu-launch','preparation','HUD','results','history'],passed:true});
 });
 it('preserves tracking and mixed task details and identifies the actual map in result audio feedback',()=>{
  expect(trainingTitle('tracking',DEFAULT_SETTINGS)).toBe('이동 표적 추적');expect(trainingTitle('free',{...DEFAULT_SETTINGS,practiceMap:'complex',drill:'mixed'})).toBe('복합 전술 훈련');
  expect(trainingMapTitle({practiceMap:'complex'})).toBe('전술 피킹 연구실');expect(trainingMapTitle({practiceMap:'tower'})).toBe('타워 진입');
 });
});

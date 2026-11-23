import {afterEach,describe,expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {DEFAULT_SETTINGS} from '../config/settings';
import {useApp} from '../app/store';
import {Simulation} from '../engine/simulation/Simulation';
import {ReplayRecorder} from '../engine/replay/recording';
import {ReplayPlayer} from '../engine/replay/playback';
import {simulationChecksum} from '../engine/replay/integrity';
import {emptyInput} from '../engine/types';
import {ExerciseSetup,ExerciseHUD,ExerciseResults} from '../ui/ExerciseTraining';
import {TrainingPlatform} from '../ui/TrainingPlatform';
import {MovementPracticePanel} from '../ui/MovementPracticePanel';
import {ScenarioEditor} from '../ui/ScenarioEditor';
import {ScenarioRoutes} from '../ui/ScenarioRoutes';
import {createScenario} from '../training/scenarios/templates';
import {GameHUD} from '../ui/GameHUD';
import {INITIAL_TELEMETRY} from '../engine/Runtime';
import {InputDiagnostics} from '../engine/input/InputDiagnostics';
import {setLocale,getLocale,initializeKoreanInterface,clearMissingTranslations} from '../i18n/locale';

const hangul=/[가-힣ㄱ-ㅎㅏ-ㅣ]/;
const noop=()=>{};
const text=(html:string)=>html.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
const initialServerSnapshot={...useApp.getInitialState()},initialLiveSnapshot=useApp.getState();
afterEach(async()=>{Object.assign(useApp.getInitialState(),initialServerSnapshot);useApp.setState(initialLiveSnapshot);await setLocale('ko');clearMissingTranslations();});

describe('Korean product presentation covers the integrated training platform',()=>{
 it('restores Korean platform interfaces after legacy English without altering task or movement state',async()=>{
  const settings=structuredClone(DEFAULT_SETTINGS);settings.movementTools.enabled=true;
  const move=new Simulation('free','rifleA',settings);move.trainingAction({kind:'movement-save'});move.running=true;
  for(let n=0;n<100;n++)move.step(1/120,{...emptyInput(),jump:n===0,jumpHeld:n<3,forward:1});
  const warm=new Simulation('free','rifleA',structuredClone(DEFAULT_SETTINGS),{exercise:{schema:1,kind:'warmup',durationSeconds:60}});warm.running=true;for(let n=0;n<120;n++)warm.step(1/120,emptyInput());
  const flash=new Simulation('free','rifleA',structuredClone(DEFAULT_SETTINGS),{exercise:{schema:1,kind:'flash',durationSeconds:60,responseWindowSeconds:.8,turnThresholdDegrees:100}});flash.running=true;for(let n=0;n<180&&!flash.exercise?.currentCue;n++)flash.step(1/120,emptyInput());
  const movementBefore=simulationChecksum(move),warmupBefore=simulationChecksum(warm),flashBefore=simulationChecksum(flash),settingsBefore=JSON.stringify(settings);
  await setLocale('en');initializeKoreanInterface();expect(getLocale()).toBe('ko');const presentationState={settings,sessionOptions:{},mode:'free' as const,screen:'menu' as const,activeTab:'tools' as const,history:[],result:null,notice:''};Object.assign(useApp.getInitialState(),presentationState);useApp.setState(presentationState);
  const runtime={simulation:flash,input:{diagnostics:new InputDiagnostics(),locked:true,rawConfirmation:'accepted',keyboardStatus:'locked'}} as Parameters<typeof GameHUD>[0]['runtime'];
  const views=[
   ['platform',<TrainingPlatform/>],['warmup setup',<ExerciseSetup kind="warmup" onStart={noop}/>],['flash setup',<ExerciseSetup kind="flash" onStart={noop}/>],
   ['warmup result',<ExerciseResults session={warm.snapshot()} onRetry={noop} onExit={noop}/>],['flash result',<ExerciseResults session={flash.snapshot()} onRetry={noop} onExit={noop}/>],
   ['flash cue',<ExerciseHUD report={flash.exercise?.snapshot()}/>],['flash HUD',<GameHUD runtime={runtime} settings={flash.settings} telemetry={{...INITIAL_TELEMETRY,exercise:flash.exercise?.snapshot(),time:flash.time}} mode="free" weapon="rifleA"/>],
   ['movement',<MovementPracticePanel settings={settings} snapshot={move.movementPractice.snapshot()} onAction={noop} onSettings={noop} onBuildGhost={noop} onReview={noop} ghostStatus="ready"/>],
   ['routes',<ScenarioRoutes onStart={noop} history={[]}/>],['editor',<ScenarioEditor initialScenario={createScenario('long-lane')} onStart={noop}/>],
  ] as const;
  const rendered=views.map(([name,element])=>({name,html:renderToStaticMarkup(element)}));
  for(const {name,html} of rendered){const visible=text(html);expect(hangul.test(visible),name+' has Korean presentation').toBe(true);expect(visible).not.toContain('PRACTICE / REVIEW / CREATE');expect(visible).not.toContain('60 SECONDS / ORIGINAL TRAINING');}
  expect(rendered[0].html).toContain('훈련 도구와 시나리오');expect(rendered[1].html).toContain('1분 워밍업');expect(rendered[2].html).toContain('플래시 회피');expect(rendered[6].html).toContain('회피 성공');expect(rendered[7].html).toContain('이동 연습 도구');expect(rendered[9].html).toContain('시나리오');
  expect(useApp.getState().settings).toBe(settings);expect(JSON.stringify(settings)).toBe(settingsBefore);expect(simulationChecksum(move)).toBe(movementBefore);expect(simulationChecksum(warm)).toBe(warmupBefore);expect(simulationChecksum(flash)).toBe(flashBefore);
  console.log(JSON.stringify({benchmark:'korean-platform-coverage',screens:views.length,taskAndMovementStateUnchanged:true}));
 });
 it('leaves exercise and scenario replay authority unchanged across English presentation',async()=>{
  for(const options of [{exercise:{schema:1 as const,kind:'flash' as const,durationSeconds:60 as const,responseWindowSeconds:.8,turnThresholdDegrees:100}},{scenario:createScenario('close-corner')}]){
   const s=new Simulation('free','rifleA',structuredClone(DEFAULT_SETTINGS),options),r=new ReplayRecorder(s);s.running=true;for(let n=0;n<180;n++)s.step(1/120,emptyInput());
   const checksum=simulationChecksum(s);await setLocale('en');expect(simulationChecksum(s)).toBe(checksum);const recording=r.finish()!;expect((await new ReplayPlayer(recording).verify()).passed).toBe(true);await setLocale('ko');expect((await new ReplayPlayer(recording).verify()).passed).toBe(true);
  }
 });
});

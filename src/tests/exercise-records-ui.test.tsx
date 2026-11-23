import {afterEach,beforeAll,describe,it,expect,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {Simulation} from '../engine/simulation/Simulation';
import {DEFAULT_SETTINGS} from '../config/settings';
import {emptyInput,type SessionData} from '../engine/types';
import {DEFAULT_FLASH_OPTIONS,DEFAULT_WARMUP_OPTIONS} from '../training/exercises/types';
import {clearExerciseBests,exerciseBestKey,loadExerciseBests,recordExerciseBest} from '../training/exercises/personalBest';
import {ExerciseHUD,ExerciseResults,ExerciseSetup} from '../ui/ExerciseTraining';

const KEY='valoprac-exercise-records-v1';
class MemoryStorage {values=new Map<string,string>();getItem(k:string){return this.values.get(k)??null;}setItem(k:string,v:string){this.values.set(k,v);}removeItem(k:string){this.values.delete(k);}}
let baseline:SessionData;
beforeAll(()=>{const s=new Simulation('free','rifleA',structuredClone(DEFAULT_SETTINGS),{exercise:DEFAULT_WARMUP_OPTIONS});s.running=true;for(let n=0;n<7200;n++)s.step(1/120,emptyInput());baseline=s.snapshot();});
afterEach(()=>vi.unstubAllGlobals());
/** Synthetic scores isolate local storage policy; real scoring has separate3D tests. */
function policySession(score=10){const s=structuredClone(baseline);s.exercise!.score=score;s.exercise!.warmup!.eliminations=score;s.summary.eliminations=score;return s;}
describe('Completed comparable exercise records stay local and bounded',()=>{
 it('keeps the maximum completed score and reports improvement only when it occurs',()=>{vi.stubGlobal('localStorage',new MemoryStorage());expect(recordExerciseBest(policySession(10))).toMatchObject({score:10,improved:true,saved:true});expect(recordExerciseBest(policySession(7))).toMatchObject({score:10,improved:false});expect(recordExerciseBest(policySession(12))).toMatchObject({score:12,improved:true});expect(loadExerciseBests()).toHaveLength(1);});
 it('does not award a best for early exits, incomplete or mismatched protocol data',()=>{
  vi.stubGlobal('localStorage',new MemoryStorage());for(const mutate of [(s:SessionData)=>s.exercise!.completed=false,(s:SessionData)=>s.exercise!.elapsedSeconds=30,(s:SessionData)=>s.exercise!.version='future',(s:SessionData)=>s.sessionOptions={exercise:DEFAULT_FLASH_OPTIONS},(s:SessionData)=>s.exercise!.score=Infinity,(s:SessionData)=>s.exercise!.score=100001]){const s=policySession();mutate(s);expect(recordExerciseBest(s).improved).toBe(false);}expect(loadExerciseBests()).toEqual([]);
 });
 it('separates weapon, seed, movement physics, timing, elimination and ammunition rules',()=>{
  const initial=policySession(),key=exerciseBestKey(initial);
  for(const mutate of [(s:SessionData)=>s.weapon='operator',(s:SessionData)=>s.settings.seed++,(s:SessionData)=>s.settings.movementPhysics='counterStrike',(s:SessionData)=>s.settings.jumpBufferMs=0,(s:SessionData)=>s.settings.eliminationRule='any',(s:SessionData)=>s.settings.autoReload=false,(s:SessionData)=>s.settings.infiniteReserve=false]){const s=structuredClone(initial);mutate(s);expect(exerciseBestKey(s)).not.toBe(key);}
  const input=structuredClone(initial);input.settings.sensitivity=.5;input.settings.dpi=1600;expect(exerciseBestKey(input)).toBe(key);
 });
 it('caps retained local records without losing the newest comparable score',()=>{
  vi.stubGlobal('localStorage',new MemoryStorage());for(let n=0;n<80;n++){const s=policySession(n);s.settings.seed=n+1;expect(recordExerciseBest(s).saved).toBe(true);}const rows=loadExerciseBests();expect(rows).toHaveLength(64);expect(rows[0].score).toBe(79);expect(rows.at(-1)!.score).toBe(16);
 });
 it('recovers from malformed/oversized storage and handles quota, denied access and deletion',()=>{
  const storage=new MemoryStorage();vi.stubGlobal('localStorage',storage);for(const bad of ['{','"wrong"',' '.repeat(64001),JSON.stringify(Array(65).fill({}))]){storage.setItem(KEY,bad);expect(loadExerciseBests()).toEqual([]);}
  storage.setItem(KEY,JSON.stringify([{key:'ok',score:2,recordedAt:1},{key:'bad',score:-1,recordedAt:1}]));expect(loadExerciseBests()).toHaveLength(1);expect(clearExerciseBests()).toBe(true);expect(loadExerciseBests()).toEqual([]);
  vi.stubGlobal('localStorage',{getItem:()=>null,setItem:()=>{throw new Error('quota');},removeItem:()=>{throw new Error('denied');}});expect(recordExerciseBest(policySession()).saved).toBe(false);expect(clearExerciseBests()).toBe(false);
 });
 it('never exceeds its byte budget when old but valid near-limit keys exist',()=>{
  const storage=new MemoryStorage();vi.stubGlobal('localStorage',storage);storage.setItem(KEY,JSON.stringify(Array.from({length:63},(_,n)=>({key:'x'.repeat(940)+n,score:n,recordedAt:n}))));expect(loadExerciseBests()).toHaveLength(63);expect(recordExerciseBest(policySession()).saved).toBe(true);expect(storage.getItem(KEY)!.length).toBeLessThanOrEqual(64000);expect(loadExerciseBests()[0].score).toBe(10);
 });
});
describe('Korean exercise controls and results expose real task meaning',()=>{
 it('renders minimal one-minute setup and separate flash conditions',()=>{
  const start=()=>{},warm=renderToStaticMarkup(<ExerciseSetup kind="warmup" onStart={start}/>),flash=renderToStaticMarkup(<ExerciseSetup kind="flash" onStart={start}/>);
  expect(warm).toContain('1분 워밍업');expect(warm).toContain('1분 훈련 시작');expect(warm).not.toContain('플래시 반응 창');expect(flash).toContain('플래시 반응 창');expect(flash).toContain('플래시 회전 기준');expect(flash).toContain('실제 회전 시작');
 });
 it('shows only actual cue state and never invents an inactive flash warning',()=>{
  expect(renderToStaticMarkup(<ExerciseHUD report={baseline.exercise}/>)).toBe('');const s=new Simulation('free','rifleA',structuredClone(DEFAULT_SETTINGS),{exercise:DEFAULT_FLASH_OPTIONS});s.running=true;for(let n=0;n<240&&!s.exercise!.currentCue;n++)s.step(1/120,emptyInput());const report=s.exercise!.snapshot(),html=renderToStaticMarkup(<ExerciseHUD report={report}/>);expect(report.flash!.active).not.toBeNull();expect(html).toContain('회피 신호');expect(html).toContain('0°');expect(html).not.toContain('NaN');
 });
 it('offers one clear retry and details/exit actions without fabricating an SSR best',()=>{
  const html=renderToStaticMarkup(<ExerciseResults session={policySession(12)} onRetry={()=>{}} onDetails={()=>{}} onExit={()=>{}}/>);expect(html).toContain('같은 설정으로 즉시 재시작');expect(html).toContain('상세 결과');expect(html).toContain('훈련장으로');expect(html).toContain('60초 훈련 완료');expect(html).not.toContain('새 기록');expect(html).not.toContain('NaN');
 });
});

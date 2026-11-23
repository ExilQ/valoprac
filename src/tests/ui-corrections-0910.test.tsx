import {afterEach,describe,expect,it} from 'vitest';
import {writeFileSync} from 'node:fs';
import {renderToStaticMarkup} from 'react-dom/server';
import {useApp} from '../app/store';
import {DEFAULT_SETTINGS} from '../config/settings';
import {MainMenu,trainingStartLabel} from '../ui/MainMenu';
import {MovementPhysicsDiagnostics,MovementPhysicsDetails} from '../ui/MovementPhysicsFeedback';
import {GameHUD} from '../ui/GameHUD';
import {Simulation} from '../engine/simulation/Simulation';
import {INITIAL_TELEMETRY} from '../engine/Runtime';
import {InputDiagnostics} from '../engine/input/InputDiagnostics';
import {trainingChoice} from '../app/trainingNavigation';
import type {Settings} from '../engine/types';
const original={...useApp.getInitialState()};
afterEach(()=>{Object.assign(useApp.getInitialState(),original);useApp.setState(original);});
function select(mode:typeof original.mode,patch:Partial<Settings>={}){const state={...original,mode,settings:{...DEFAULT_SETTINGS,...patch}};Object.assign(useApp.getInitialState(),state);useApp.setState(state);}
function launchCopy(html:string){return html.match(/<button class="start-button"[^>]*>(.*?)<\/button>/)?.[1]??'';}
describe('Accurate selected training launch copy',()=>{
 for(const [id,label] of [['tactical','각체크·피킹'],['vertical','수직 각체크 훈련'],['bunny','버니합 훈련'],['wallbang','월샷 훈련'],['braking','톡브레이킹 훈련']] as const)it(`${id}: start button identifies actual selected training`,()=>{const choice=trainingChoice(id);select(choice.mode,choice.settings);const copy=launchCopy(renderToStaticMarkup(<MainMenu/>));expect(copy).toContain(label);expect(copy).not.toContain('자유 훈련장');expect(copy).toContain(choice.mode==='free'?'시간 무제한':'60초');});
 it('distinguishes timed peeking and time-limited precision from unlimited free practice',()=>{select('free',{practiceMap:'complex',peekingTimed:true,duration:120});let copy=launchCopy(renderToStaticMarkup(<MainMenu/>));expect(copy).toContain('각체크·피킹 · 120초');expect(copy).not.toContain('시간 무제한');select('precision',{practiceMap:'range',duration:30});copy=launchCopy(renderToStaticMarkup(<MainMenu/>));expect(copy).toContain('헤드샷');expect(copy).toContain('30초');select('free',{practiceMap:'range',drill:'none'});expect(launchCopy(renderToStaticMarkup(<MainMenu/>))).toContain('자유 훈련장 · 시간 무제한');});
 it('identifies an explicitly selected free-practice movement drill',()=>{expect(trainingStartLabel('free',{practiceMap:'range',drill:'tapDA'})).toBe('오른쪽 이동 → 왼쪽 톡 → 사격');});
});
describe('Pointer-lock-readable movement essentials',()=>{
 it('keeps jump and landing timing outside collapsed vector details',()=>{const s=new Simulation('free','rifleA',{...DEFAULT_SETTINGS,physicsDiagnostics:true});s.movement.velocity.set(1,2,3);const core=renderToStaticMarkup(<MovementPhysicsDiagnostics simulation={s}/>),details=renderToStaticMarkup(<MovementPhysicsDetails simulation={s}/>);expect(core).toContain('class="physics-jump-times"');expect(core).toContain('최근 점프 · 착지');expect(core).toContain('class="physics-chain-timing"');expect(core).toContain('연속 점프 · 입력');expect(core).not.toContain('<details');expect(core).not.toContain('tabindex');expect(details).toContain('이동 벡터 · 세부 정보');expect(details).not.toContain(' open=');expect(details).toContain('1.00, 2.00, 3.00');expect(details).not.toContain('physics-jump-times');});
 it('pins essential diagnostics before the optional scrollable stack, preserving ammunition after it',()=>{const s=new Simulation('free','operator',{...DEFAULT_SETTINGS,practiceMap:'complex',physicsDiagnostics:true,inputDiagnostics:true,recoilAnalysis:true,botDiagnostics:true,penetrationDiagnostics:true});const input={diagnostics:new InputDiagnostics(),locked:true,rawConfirmation:'accepted',keyboardStatus:'locked'};if(process.env.VALOPRAC_UI_FIXTURE){const p=s.movement.physicsSnapshot(),h=s.movement.hopSnapshot();s.time=12.34;s.movement.physicsSnapshot=()=>({...p,horizontalSpeed:12.34,verticalSpeed:-12.34,chainedJumps:12,lastJumpAt:0,lastLandingAt:0,effectiveJumpBufferMs:140});s.movement.hopSnapshot=()=>({...h,lastInputTimingMs:-140});}const runtime={simulation:s,input} as Parameters<typeof GameHUD>[0]['runtime'];const html=renderToStaticMarkup(<GameHUD runtime={runtime} settings={s.settings} telemetry={{...INITIAL_TELEMETRY,weapon:'operator',ammo:s.weapon.ammo,reserve:s.weapon.reserve,time:s.time,peeking:s.defenders?.snapshot()}} mode="free" weapon="operator"/>);if(process.env.VALOPRAC_UI_FIXTURE)writeFileSync(process.env.VALOPRAC_UI_FIXTURE,html);const core=html.indexOf('class="movement-physics-diagnostics"'),stack=html.indexOf('class="hud-right-stack"'),vectors=html.indexOf('class="physics-vector-details"'),ammo=html.indexOf('class="ammo-hud"');expect(core).toBeGreaterThan(0);expect(core).toBeLessThan(stack);expect(vectors).toBeGreaterThan(stack);expect(ammo).toBeGreaterThan(vectors);});
});

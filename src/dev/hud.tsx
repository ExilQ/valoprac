// Development-only entry. Renders the production HUD without GPU, pointer capture, or saved records.
import {createRoot} from 'react-dom/client';
import {ExerciseHUD} from '../ui/ExerciseTraining';
import {createScenario} from '../training/scenarios/templates';
import {DEFAULT_FLASH_OPTIONS} from '../training/exercises/types';
import {GameHUD} from '../ui/GameHUD';
import {Crosshair} from '../components/Crosshair';
import {DEFAULT_SETTINGS} from '../config/settings';
import {emptyInput} from '../engine/types';
import {Simulation} from '../engine/simulation/Simulation';
import {BrowserInput} from '../engine/input/Input';
import {INITIAL_TELEMETRY} from '../engine/Runtime';
import '../ui/styles.css';import '../ui/tokens.css';import '../ui/tactical.css';
import '../ui/premium.css';import '../ui/operator.css';
const query=new URLSearchParams(location.search);
if(query.has('suite')){
 createRoot(document.getElementById('root')!).render(<main style={{background:'#eee',color:'#111',padding:20}}><h1>실제 HUD 레이아웃 개발 검사</h1>{[[1920,1080],[1536,864],[1366,768]].flatMap(([w,h])=>[.75,1,1.25].map(scale=><section key={`${w}-${scale}`} style={{height:h*.5+60}}><h2>{w} × {h} · {scale}배</h2><iframe title={`${w}-${h}-${scale}`} width={w} height={h} src={`/dev/hud.html?scale=${scale}`} style={{border:0,transform:'scale(.5)',transformOrigin:'top left'}}/></section>))}</main>);
}else{
 const settings={...DEFAULT_SETTINGS,hudScale:Number(query.get('scale')??1),recoilAnalysis:true,brakingHud:true,practiceHud:true,footstepHud:true,soundMinimap:true,inputDiagnostics:true,physicsDiagnostics:true,drill:'tapAD' as const};
 const task=query.get('task'),scenario=task==='scenario'?{...createScenario('sequential'),title:'사용자가 직접 정한 아주 긴 전술 훈련 시나리오 제목 '.repeat(3).slice(0,64)}:null;
 const options=scenario?{scenario}:task==='flash'?{exercise:{...DEFAULT_FLASH_OPTIONS}}:{};
 const simulation=new Simulation('free','rifleA',{...settings,analysisWall:true},options);simulation.running=true;for(let i=0;i<300;i++){simulation.step(1/120,{...emptyInput(),fire:true,jump:i===0,jumpHeld:i<3});if(task==='flash'&&simulation.exercise?.currentCue)break;}simulation.running=false;const canvas=document.createElement('canvas'),input=new BrowserInput(canvas,simulation,()=>{},()=>{}),runtime={simulation,input};
 window.addEventListener('pagehide',()=>input.dispose(),{once:true});const telemetry={...INITIAL_TELEMETRY,time:simulation.time,summary:simulation.summary(),exercise:simulation.exercise?.snapshot()};
 createRoot(document.getElementById('root')!).render(<div className="game-stage" style={{'--hud-scale':settings.hudScale} as React.CSSProperties}><GameHUD runtime={runtime} settings={settings} telemetry={telemetry} mode="free" weapon="rifleA"/><Crosshair settings={settings}/><ExerciseHUD report={simulation.exercise?.snapshot()}/><span style={{position:'absolute',bottom:0,left:0,color:'#fff'}}>개발용 고정 상태 · 실제 경기 기록 아님</span></div>);
}

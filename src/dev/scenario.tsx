// Development-only production-component fixture. No network upload or GPU stub.
import {createRoot} from 'react-dom/client';
import {useState} from 'react';
import {ScenarioEditor} from '../ui/ScenarioEditor';
import {ScenarioRoutes} from '../ui/ScenarioRoutes';
import type {ScenarioDefinition} from '../training/scenarios/types';
import {Simulation} from '../engine/simulation/Simulation';
import {ReplayRecorder} from '../engine/replay/recording';
import {ReplayPlayer} from '../engine/replay/playback';
import {DEFAULT_SETTINGS} from '../config/settings';
import {emptyInput} from '../engine/types';
import '../ui/styles.css';import '../ui/tokens.css';import '../ui/tactical.css';
function Fixture(){const[definition,setDefinition]=useState<ScenarioDefinition|undefined>(undefined),[message,setMessage]=useState('');
 const start=async(def:ScenarioDefinition)=>{try{const sim=new Simulation('free','rifleA',structuredClone(DEFAULT_SETTINGS),{scenario:def}),record=new ReplayRecorder(sim);sim.running=true;for(let n=0;n<120;n++)sim.step(1/120,emptyInput());const v=await new ReplayPlayer(record.finish()!).verify();setMessage(JSON.stringify({passed:v.passed,seed:sim.settings.seed,map:sim.practiceMap,weapon:sim.weaponId,bots:sim.targets.filter(t=>t.enabled).length}));}catch(error){setMessage((error as Error).message);}};
 return <main style={{maxWidth:1240,margin:'0 auto',padding:24}}><ScenarioRoutes onStart={def=>{void start(def);}} onEdit={setDefinition}/><ScenarioEditor initialScenario={definition} onStart={def=>{void start(def);}}/><output aria-label="실제 시뮬레이션 실행 결과">{message}</output></main>;
}
createRoot(document.getElementById('root')!).render(<Fixture/>);

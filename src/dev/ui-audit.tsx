// Development-only, deterministic visual fixture. Never a user's training record.
import {initializeTheme,setThemePreference} from '../ui/theme/theme';
import {createRoot} from 'react-dom/client';
import {Vector3} from 'three';
import {App} from '../app/App';
import {useApp} from '../app/store';
import {RangeRenderer} from '../engine/rendering/RangeRenderer';
import {Simulation} from '../engine/simulation/Simulation';
import {emptyInput} from '../engine/types';
import {DEFAULT_SETTINGS} from '../config/settings';
import '../ui/styles.css';import '../ui/tokens.css';import '../ui/tactical.css';import '../ui/premium.css';import '../ui/operator.css';import '../ui/precisionUtility.css';
initializeTheme();
const originalRangeRender=RangeRenderer.prototype.render;
RangeRenderer.prototype.render=function(...args){const result=originalRangeRender.apply(this,args);if(this.preparationReady&&this.renderer.info.render.calls>0){(window as any).precisionRangeDrawReady=true;(window as any).precisionRangeRenderer=this;}return result;};
const query=new URLSearchParams(location.search),kind=query.get('case')??'main';
if(query.get('theme')==='dark')setThemePreference('dark');
const simulation=new Simulation('free','rifleA',{...structuredClone(DEFAULT_SETTINGS),seed:1947,targetCount:1,targetSpeed:.5});simulation.running=true;
for(let tick=0;tick<1440;tick++){const t=simulation.targets[0];if(t.active){const head=t.headPosition(new Vector3()),d=head.sub(simulation.movement.position).sub(new Vector3(0,simulation.movement.eyeHeight,0)),gain=simulation.settings.sensitivity*simulation.settings.degreesPerCount;simulation.look(-(Math.atan2(-d.x,-d.z)-simulation.viewYaw)*180/Math.PI/gain,-(Math.atan2(d.y,Math.hypot(d.x,d.z))-simulation.viewPitch)*180/Math.PI/gain);}simulation.step(1/120,{...emptyInput(),fire:tick%20===0,firePresses:tick%20===0?1:0});}
simulation.running=false;const session={...simulation.snapshot(),id:'precision-utility-visual-fixture',createdAt:Date.UTC(2026,10,4,12)};
const tab=kind==='settings'?'settings':kind==='weapons'?'weapons':kind==='lab'?'aim':kind==='history'?'history':kind==='tools'?'tools':'training';
history.replaceState(null,'',tab==='training'?'/':tab==='history'?'/statistics.html':tab==='weapons'?'/weapons.html':tab==='aim'?'/aim.html':tab==='settings'?'/settings.html':'/tools.html');
useApp.setState({activeTab:tab,screen:'menu',mode:kind==='training'?'braking':'free',settings:{...structuredClone(DEFAULT_SETTINGS),...(kind==='training'?{drill:'tapAD' as const}:{}),graphicsPreset:'low',autoGraphics:false,renderScale:.5,shadowQuality:'off',postProcessing:false,ambientOcclusion:false,antialias:false},history:[session],result:session,refreshHistory:async()=>{}});
createRoot(document.getElementById('root')!).render(<App/>);
if(kind==='results')setTimeout(()=>useApp.setState({screen:'results',result:session}),50);
if(kind==='patch')setTimeout(()=>document.querySelector<HTMLButtonElement>('.patch-button')?.click(),300);
(window as any).precisionVisualFixture={kind,seed:1947,duration:session.duration,summary:session.summary};

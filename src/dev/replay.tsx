import {createRoot} from 'react-dom/client';
import {Vector3} from 'three';
import {ReplayLibrary,ReplayViewer} from '../ui/ReplayViewer';
import {Simulation} from '../engine/simulation/Simulation';
import {ReplayRecorder} from '../engine/replay/recording';
import {ReplayPlayer,captureReplayFrame} from '../engine/replay/playback';
import {encodeReplay} from '../engine/replay/codec';
import {simulationChecksum} from '../engine/replay/integrity';
import {RangeRenderer} from '../engine/rendering/RangeRenderer';
import {DEFAULT_SETTINGS} from '../config/settings';
import {emptyInput,type WeaponId} from '../engine/types';
import '../ui/styles.css';import '../ui/tokens.css';import '../ui/tactical.css';import '../ui/premium.css';import '../ui/operator.css';

/** Local development fixture only. It is not a production route or entrypoint. */
function makeRecording(attached=true,weapon:WeaponId='rifleA'){
 const settings={...structuredClone(DEFAULT_SETTINGS),seed:72091,targetCount:1,targetSpeed:0,behavior:'stationary' as const,graphicsPreset:'medium' as const,autoGraphics:false,renderScale:.5};
 const sim=new Simulation('free',weapon,settings);if(attached)sim.renderedTargets.attach();const recorder=new ReplayRecorder(sim);let frameId=0;
 if(attached)captureReplayFrame(sim,++frameId,10000,.5,0);
 for(let tick=0;tick<480;tick++){
  const input=emptyInput();input.strafe=tick<120?.4:tick<240?-.4:0;input.movementYaw=0;input.fire=weapon==='operator'?tick===240:tick%48===0;input.firePresses=Number(input.fire);
  if(weapon==='operator'){input.scopeHeld=true;input.scopePresses=tick===0?1:0;}
  const target=sim.targets.find(t=>t.enabled&&t.active);if(target){const point=target.headPosition(new Vector3()).sub(sim.movement.position);point.y-=sim.movement.eyeHeight;const yaw=Math.atan2(-point.x,-point.z),pitch=Math.atan2(point.y,Math.hypot(point.x,point.z)),gain=sim.settings.degreesPerCount*sim.settings.sensitivity/(weapon==='operator'&&sim.ads?sim.scopeZoom:1);sim.look((sim.yaw-yaw)*180/Math.PI/gain,(sim.pitch-pitch)*180/Math.PI/gain);}
  if(input.fire&&attached)sim.captureFireView(10000+tick*1000/120);
  sim.running=true;sim.step(1/120,input);if(attached&&tick%2===0)captureReplayFrame(sim,++frameId,10000+(tick+1)*1000/120,.5,sim.ticks);
 }
 sim.running=false;sim.completed=true;const recording=recorder.finish();recorder.dispose();if(!recording)throw Error('Replay fixture recording failed');const session={...sim.snapshot(),replay:recording};return{recording,session};
}
const root=createRoot(document.getElementById('root')!),source=makeRecording();document.body.style.margin='0';document.body.style.background='#111820';document.getElementById('root')!.style.cssText='max-width:1160px;margin:0 auto;padding:16px;min-width:0';
const observations:{unchanged:boolean;attached:boolean;frames:number;preset:string;camera:string}[]=[];let current:RangeRenderer|null=null;
const render=RangeRenderer.prototype.render;RangeRenderer.prototype.render=function(...args){const before=simulationChecksum(this.simulation);render.apply(this,args);current=this;if(observations.length<300)observations.push({unchanged:before===simulationChecksum(this.simulation),attached:this.simulation.renderedTargets.isAttached,frames:this.simulation.renderedTargets.size,preset:(this as unknown as{settings:{graphicsPreset:string}}).settings.graphicsPreset,camera:this.inspectionCamera?'top-down':'first-person'});};
const qa={source,observations,get current(){return current;},openUnattached(){const{recording}=makeRecording(false);root.render(<ReplayViewer recording={recording}/>);},openOperator(){const{recording}=makeRecording(true,'operator');root.render(<ReplayViewer recording={recording} initialTime={.8}/>);},unmount(){root.unmount();},checksum(){return current?simulationChecksum(current.simulation):null;},expected:async(time:number)=>{const p=new ReplayPlayer(source.recording);await p.seek(time);return{time:p.time,score:p.simulation.stats.eliminations,shots:p.simulation.stats.shots};},bytes:async(mismatch=false,foreign=false)=>{const record=structuredClone(source.recording);if(mismatch)record.final.score++;if(foreign)record.header.gameVersion='incompatible-test-version';return [...await encodeReplay(record)];}};
Object.assign(window,{replayQA:qa});root.render(<ReplayLibrary sessions={[source.session]}/>);

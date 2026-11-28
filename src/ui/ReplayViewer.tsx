import {localeTag} from '../i18n/locale';
import {useEffect,useMemo,useRef,useState} from 'react';
import {CapsuleGeometry,ConeGeometry,Group,Mesh,MeshBasicMaterial,Plane,SphereGeometry,Vector3} from 'three';
import {Crosshair} from '../components/Crosshair';
import {ScopeOverlay} from '../components/ScopeOverlay';
import {RangeRenderer} from '../engine/rendering/RangeRenderer';
import {ReplayPlayer} from '../engine/replay/playback';
import {decodeReplay,encodeReplay} from '../engine/replay/codec';
import {MAX_REPLAY_COMPRESSED_BYTES,type ReplayRecording,type ReplayVerification} from '../engine/replay/types';
import type {SessionData,Settings,WeaponId} from '../engine/types';
import {WEAPONS} from '../config/weapons';
import {sanitizeSettings} from '../config/settings';
import {automaticGraphicsPatch} from '../config/graphicsPolicy';
import {validateReplay} from '../engine/replay/validation';
import {replayRulesFor} from '../engine/replay/integrity';
import type {Simulation} from '../engine/simulation/Simulation';
import {SessionHighlights} from './SessionHighlights';
import {trainingTitle} from './trainingPresentation';
import {BOT_STATE_LABELS,botViewCamera,inspectionCamera,inspectionCutawayHeight,ReplayTransport,REPLAY_SPEEDS,replayTime,timelineMarkers,type ReplayCamera} from './replayTransport';
import './replayViewer.css';

export interface ReplayViewerProps {recording:ReplayRecording;initialTime?:number;initialCamera?:ReplayCamera;session?:SessionData;onClose?:()=>void;}
interface ViewerState {time:number;playing:boolean;seeking:boolean;ready:boolean;preparation:string;score:number;shots:number;weapon:WeaponId;ads:boolean;scopeAmount:number;scopeZoom:number;scopeState:string;settings:Settings;bots:ReplayBot[];}
interface ReplayBot {id:number;active:boolean;state?:string;}
/** Course and scenario bots whose eyes a replay can be watched through. */
export function replayBots(s:Pick<Simulation,'targets'|'defenders'|'angles'>):ReplayBot[]{
 if(!s.defenders&&!s.angles)return[];
 return s.targets.filter(t=>t.enabled).map(t=>({id:t.id,active:t.active,state:s.defenders?.memories[t.id]?.state}));
}
const botView=new Vector3(),botAim=new Vector3();
/** Display-only camera at a bot's eyes for the replay viewer; null when that bot is not in the recording. */
export function replayBotCamera(s:Pick<Simulation,'targets'|'defenders'|'movement'>,id:number){
 const t=s.targets.find(target=>target.id===id&&target.enabled);if(!t)return null;
 t.headPosition(botView);const m=s.defenders?.memories[t.id],p=s.movement.position;
 const direction=m&&m.generation===t.generation?m.motor.direction(botAim,m.gun.recoil.pitch,m.gun.recoil.yaw):null;
 return{index:s.targets.indexOf(t),camera:botViewCamera(botView,{x:p.x,y:p.y+s.movement.eyeHeight,z:p.z},direction)};
}
const PHASES:Record<string,string>={idle:'그래픽 준비 대기',compiling:'셰이더 준비',warming:'렌더링 경로 예열',gpu:'그래픽 처리 완료 대기',ready:'준비 완료',failed:'그래픽 준비 실패',disposed:'종료'};

function envelope(recording:unknown):recording is ReplayRecording {
 if(!recording||typeof recording!=='object')return false;
 const r=recording as ReplayRecording;return r.schema===1&&!!r.header?.initial&&typeof r.header.gameVersion==='string'&&Number.isFinite(r.duration)&&r.duration>=0&&Number.isSafeInteger(r.ticks)&&r.ticks>=0&&Array.isArray(r.commands)&&Array.isArray(r.events)&&!!r.final;
}
function errorMessage(error:unknown){return(error instanceof Error?error.message:'알 수 없는 오류').slice(0,300);}
/** Viewer quality may be reduced for this device, without rewriting recorded
 * settings or changing the authority that is checked by ReplayPlayer. */
export function replayDisplaySettings(settings:Settings,recommendLow:boolean):Settings {
 const display={...sanitizeSettings(settings),autoGraphics:true};
 return{...display,...automaticGraphicsPatch(display,recommendLow)};
}
export async function readReplayFile(file:Pick<File,'size'|'arrayBuffer'>){
 if(!Number.isFinite(file.size)||file.size<=0||file.size>MAX_REPLAY_COMPRESSED_BYTES)throw new Error(`리플레이 파일은 ${Math.round(MAX_REPLAY_COMPRESSED_BYTES/1000)}KB 이하여야 합니다.`);
 const recording=await decodeReplay(new Uint8Array(await file.arrayBuffer()));
 // Import and playback must use the same registered compatibility identities.
 // Historical simulation-2 files stay on their retained rules, never upgraded.
 replayRulesFor(recording.header);
 return recording;
}
export async function downloadReplay(recording:ReplayRecording){
 const bytes=await encodeReplay(recording),url=URL.createObjectURL(new Blob([new Uint8Array(bytes).buffer],{type:'application/gzip'}));
 const link=document.createElement('a');link.href=url;link.download='valoprac-replay.vpr';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

/** Lazy viewer: it constructs no BrowserInput and never requests PointerLock.
 * The renderer is a consumer of the re-executed simulation, not its authority. */
export function ReplayViewer(props:ReplayViewerProps){
 const invalid=useMemo(()=>{try{validateReplay(props.recording);return'';}catch(error){return errorMessage(error);}},[props.recording]);
 if(invalid)return <section className="replay-viewer"><p className="replay-error" role="alert">이 기록에는 재생할 수 있는 리플레이 자료가 없습니다. {invalid}</p>{props.onClose&&<button className="secondary-button" onClick={props.onClose}>닫기</button>}</section>;
 return <ReplayViewerContent {...props}/>;
}
function ReplayViewerContent({recording,initialTime=0,initialCamera='first-person',session,onClose}:ReplayViewerProps){
 const host=useRef<HTMLDivElement>(null),transport=useRef<ReplayTransport|null>(null),renderer=useRef<RangeRenderer|null>(null);
 const cameraRef=useRef<ReplayCamera>(initialCamera),botRef=useRef(0),initialTimeRef=useRef(initialTime),seenInitialTime=useRef(initialTime),verifyEpoch=useRef(0),verificationAbort=useRef<AbortController|null>(null);
 initialTimeRef.current=initialTime;
 const [camera,setCamera]=useState<ReplayCamera>(initialCamera),[botId,setBotId]=useState(0),[speed,setSpeed]=useState<number>(1),[message,setMessage]=useState(''),[verification,setVerification]=useState<ReplayVerification|null>(null),[verifying,setVerifying]=useState(true),[exporting,setExporting]=useState(false);
 const [ui,setUi]=useState<ViewerState>(()=>({time:0,playing:false,seeking:false,ready:false,preparation:'그래픽 준비 대기',score:0,shots:0,weapon:recording.header.initial.weapon,ads:false,scopeAmount:0,scopeZoom:1,scopeState:'unscoped',settings:sanitizeSettings(recording.header.initial.settings),bots:[]}));
 const update=()=>{const t=transport.current,r=renderer.current;if(!t||!r)return;const s=(t.player as ReplayPlayer).simulation;setUi({time:t.time,playing:t.playing,seeking:t.seeking,ready:r.preparationReady,preparation:PHASES[r.preparationStatus.stage]??'그래픽 준비 중',score:s.exercise?.snapshot().score??s.stats.eliminations,shots:s.stats.shots,weapon:s.weaponId,ads:s.ads,scopeAmount:s.weapon.scopeAmount,scopeZoom:s.scopeZoom,scopeState:s.weapon.operatorState,settings:s.settings,bots:replayBots(s)});};
 const seek=async(seconds:number)=>{const t=transport.current;if(!t)return;setMessage('');const pending=t.seek(seconds);update();try{if(await pending){const r=renderer.current;if(r){r.simulation=(t.player as ReplayPlayer).simulation;r.clearImpacts();}update();}}catch(error){setMessage(`탐색을 중단했습니다. ${errorMessage(error)}`);update();}};
 const verify=async()=>{const t=transport.current;if(!t)return;const epoch=++verifyEpoch.current;verificationAbort.current?.abort();const controller=verificationAbort.current=new AbortController();t.pause();setVerifying(true);setMessage('');update();try{const result=await(t.player as ReplayPlayer).verify({signal:controller.signal});if(epoch!==verifyEpoch.current)return;setVerification(result);if(!result.passed)setMessage('기록된 체크포인트와 재실행 결과가 다릅니다. 이 점수를 검증된 기록으로 사용할 수 없습니다.');}catch(error){if(epoch===verifyEpoch.current&&!controller.signal.aborted)setMessage(`기록을 검증하지 못했습니다. ${errorMessage(error)}`);}finally{if(epoch===verifyEpoch.current){verificationAbort.current=null;setVerifying(false);}}};
 useEffect(()=>{
  if(!host.current)return;let disposed=false,frame=0,lastFrame=0,lastPublish=0,preparing=false,configuration='';
  setMessage('');setVerification(null);setVerifying(true);setUi(previous=>({...previous,time:0,playing:false,seeking:false,ready:false,preparation:'그래픽 준비 대기'}));
  let r:RangeRenderer|null=null,t:ReplayTransport|null=null;const marker=new Group(),geometry=new ConeGeometry(.23,.6,3),material=new MeshBasicMaterial({color:0xef5261,depthTest:false,transparent:true,opacity:.9}),cutaway=new Plane(new Vector3(0,-1,0),1e6);
  const arrow=new Mesh(geometry,material);arrow.rotation.x=-Math.PI/2;arrow.renderOrder=1000;
  const bodyGeometry=new CapsuleGeometry(.18,.9,3,8),headGeometry=new SphereGeometry(.13,8,6),bodyMaterial=new MeshBasicMaterial({color:0x8ac9c5,transparent:true,opacity:.55,depthWrite:false}),bodyMarker=new Group(),body=new Mesh(bodyGeometry,bodyMaterial),head=new Mesh(headGeometry,bodyMaterial);
  body.position.y=.87;head.position.y=1.57;bodyMarker.add(body,head);bodyMarker.name='display-only player stance marker';marker.add(arrow,bodyMarker);marker.name='replay inspection player marker';
  try{
   const player=new ReplayPlayer(recording);t=new ReplayTransport(player,recording.duration,recording.ticks);t.setSpeed(speed);transport.current=t;
   // Display-only automatic hardware policy; the recording's authoritative
   // settings remain untouched and are used by ReplayPlayer.
   r=new RangeRenderer(host.current,player.simulation,{...player.simulation.settings,autoGraphics:true},{recordFrames:false});renderer.current=r;r.scene.add(marker);
   // Keep the display-only clipping variant present during preparation. Moving
   // this plane for top-down review removes roofs without editing map geometry,
   // target hitboxes, or the simulation's collision/visibility authority.
   r.renderer.clippingPlanes=[cutaway];
   // A high inspection camera needs the whole original level rather than the
   // gameplay camera's distance fog. This is a display-only review scene.
   r.scene.fog=null;r.camera.far=500;r.camera.updateProjectionMatrix();
  }catch(error){setMessage(`리플레이를 열지 못했습니다. ${errorMessage(error)}`);setUi(previous=>({...previous,ready:false,preparation:'재생할 수 없는 리플레이입니다. 호환 버전과 파일을 확인하세요.'}));setVerifying(false);geometry.dispose();material.dispose();bodyGeometry.dispose();headGeometry.dispose();bodyMaterial.dispose();return()=>{disposed=true;};}
  const localRenderer=r,localTransport=t;let bound:Simulation|null=null;
  const bindSimulation=(simulation:Simulation)=>{if(bound===simulation)return;if(bound)bound.onShot=null;bound=simulation;localRenderer.simulation=simulation;localRenderer.clearImpacts();simulation.onShot=shot=>{if(!disposed&&localRenderer.simulation===simulation)localRenderer.addShot(shot);};};
  bindSimulation((localTransport.player as ReplayPlayer).simulation);
  const prepare=async()=>{if(preparing||disposed)return;preparing=true;try{await localRenderer.prepare();if(!disposed){lastFrame=0;update();}}catch(error){if(!disposed){localTransport.pause();setMessage(`그래픽을 준비하지 못했습니다. ${errorMessage(error)}`);}}finally{preparing=false;}};
  let stillSignature='',stillDrawnAt=0;
  const render=(now:number)=>{
   if(disposed)return;const elapsed=lastFrame?(now-lastFrame)/1000:0;lastFrame=now;
   try{
    if(!localTransport.seeking)bindSimulation((localTransport.player as ReplayPlayer).simulation);
    if(localRenderer.preparationReady&&!localTransport.seeking)localTransport.advance(elapsed);
    const s=(localTransport.player as ReplayPlayer).simulation;
    if(!localTransport.seeking)bindSimulation(s);
    const key=[s.settings.fov,s.settings.graphicsPreset,s.settings.shadowQuality,s.settings.textureQuality,s.settings.postProcessing,s.settings.ambientOcclusion,s.settings.antialias,s.settings.effectsQuality,s.settings.renderScale].join(':');
    if(!localTransport.seeking&&key!==configuration){configuration=key;localRenderer.applySettings(replayDisplaySettings(s.settings,localRenderer.capabilities.recommendLow));}
    if(!localRenderer.preparationReady)void prepare();
    else if(!localTransport.seeking&&!(()=>{
     // 12.39: a paused replay redraws only when its frame, camera or view changes.
     const signature=`${s.ticks}|${localTransport.alpha}|${cameraRef.current}|${botRef.current}|${configuration}|${localRenderer.camera.aspect}`;
     const still=!localTransport.playing&&signature===stillSignature&&!localRenderer.drawRequested&&now-stillDrawnAt<1000;
     if(!still){stillSignature=signature;stillDrawnAt=now;}return still;})()){
     const view=cameraRef.current,bot=view==='bot'?replayBotCamera(s,botRef.current):null;localRenderer.inspectionCamera=bot?bot.camera:inspectionCamera(s.movement.position,view,{targets:s.targets.filter(target=>target.enabled).map(target=>target.position),aspect:localRenderer.camera.aspect,yaw:s.viewYaw,obstacles:s.obstacles});localRenderer.hiddenTarget=bot?bot.index:null;cutaway.constant=view==='top-down'?inspectionCutawayHeight(s.movement.position,s.targets):1e6;marker.visible=view!=='first-person';arrow.visible=view==='top-down';bodyMarker.visible=view==='third-person'||view==='bot';bodyMarker.scale.y=1-.3*s.movement.crouch;marker.position.copy(s.movement.position);marker.position.y+=.035;marker.rotation.y=s.viewYaw;
     localRenderer.render(localTransport.alpha,elapsed,false,s.ads);
    }
    if(now-lastPublish>=100){lastPublish=now;update();}
   }catch(error){localTransport.pause();setMessage(`재생을 중단했습니다. ${errorMessage(error)}`);update();}
   frame=requestAnimationFrame(render);
  };
  frame=requestAnimationFrame(render);
  void(async()=>{try{if(initialTimeRef.current>0)await localTransport.seek(initialTimeRef.current);if(disposed)return;await verify();}catch(error){if(!disposed){setMessage(`리플레이를 준비하지 못했습니다. ${errorMessage(error)}`);setVerifying(false);}}})();
  const visibility=()=>{if(document.hidden){localTransport.pause();lastFrame=0;update();}};document.addEventListener('visibilitychange',visibility);
  return()=>{disposed=true;++verifyEpoch.current;verificationAbort.current?.abort();verificationAbort.current=null;cancelAnimationFrame(frame);document.removeEventListener('visibilitychange',visibility);localTransport.dispose();if(bound)bound.onShot=null;transport.current=null;renderer.current=null;marker.removeFromParent();geometry.dispose();material.dispose();bodyGeometry.dispose();headGeometry.dispose();bodyMaterial.dispose();localRenderer.dispose();};
 },[recording]);
 useEffect(()=>{if(initialTime===seenInitialTime.current)return;seenInitialTime.current=initialTime;void seek(initialTime);},[initialTime]);
 const togglePlay=async()=>{const t=transport.current;if(!t)return;if(t.playing)t.pause();else{if(t.time>=recording.duration)await seek(0);t.play();}update();};
 const changeCamera=(mode:ReplayCamera)=>{cameraRef.current=mode;setCamera(mode);};
 const changeBot=(id:number)=>{botRef.current=id;setBotId(id);};
 const watchedBot=ui.bots.find(bot=>bot.id===botId),botNumber=ui.bots.findIndex(bot=>bot.id===botId)+1;
 useEffect(()=>{if(ui.bots.length&&!watchedBot)changeBot(ui.bots[0].id);},[ui.bots.length,watchedBot]);
 const save=async()=>{setExporting(true);try{await downloadReplay(recording);}catch(error){setMessage(`파일을 저장하지 못했습니다. ${errorMessage(error)}`);}finally{setExporting(false);}};
 const markers=timelineMarkers(recording.events,recording.duration),failed=!!verification&&!verification.passed;
 return <section className="replay-viewer" aria-label="훈련 리플레이">
  <header className="replay-heading"><div><h2>훈련 리플레이</h2><p>{trainingTitle(recording.header.initial.mode,recording.header.initial.settings,recording.header.initial.options)} · {recording.header.gameVersion} · 시드 {recording.header.seed}</p></div>{onClose&&<button type="button" onClick={onClose}>닫기</button>}</header>
  <div className="replay-viewport"><div className="replay-canvas-host" ref={host}/><span className="replay-viewport-label">{camera==='bot'?`봇 ${botNumber} 시점 · ${watchedBot?.active===false?'쓰러짐 · 다시 나타날 때까지 대기':BOT_STATE_LABELS[watchedBot?.state??'']??'표적'}`:camera==='first-person'?'1인칭':camera==='third-person'?'3인칭 검토':'위에서 보기'} · 재실행 화면</span>
   {camera==='first-person'&&ui.weapon==='operator'&&<ScopeOverlay amount={ui.scopeAmount} zoom={ui.scopeZoom} state={ui.scopeState} zoomBinding={ui.settings.operatorZoomBinding}/>}
   {camera==='first-person'&&(ui.weapon!=='operator'||ui.scopeAmount<.1)&&<Crosshair settings={ui.settings} ads={ui.ads} weapon={ui.weapon}/>}
   {!ui.ready&&<div className="replay-preparing" role="status">{ui.preparation}</div>}
  </div>
  <div className="replay-controls">
   <button type="button" disabled={!ui.ready||ui.seeking||verifying||!verification?.passed||recording.duration===0} onClick={()=>{void togglePlay();}}>{ui.playing?'일시정지':ui.time>=recording.duration?'처음부터 재생':'재생'}</button>
   <button type="button" disabled={ui.seeking} onClick={()=>{void seek(0);}}>처음으로</button>
   <label>재생 속도<select aria-label="리플레이 재생 속도" value={speed} onChange={e=>{const value=+e.target.value;transport.current?.setSpeed(value);setSpeed(value);}}>{REPLAY_SPEEDS.map(n=><option key={n} value={n}>{n}배</option>)}</select></label>
   <button type="button" aria-pressed={camera==='first-person'} onClick={()=>changeCamera('first-person')}>1인칭</button><button type="button" aria-pressed={camera==='top-down'} onClick={()=>changeCamera('top-down')}>위에서 보기</button><button type="button" aria-pressed={camera==='third-person'} onClick={()=>changeCamera('third-person')}>3인칭 검토</button>{ui.bots.length>0&&<button type="button" aria-pressed={camera==='bot'} onClick={()=>changeCamera('bot')}>봇 시점</button>}{camera==='bot'&&ui.bots.length>1&&<label>봇<select aria-label="시점을 볼 봇" value={botId} onChange={e=>changeBot(+e.target.value)}>{ui.bots.map((bot,index)=><option key={bot.id} value={bot.id}>봇 {index+1}</option>)}</select></label>}
   <span className="replay-clock"><strong>{replayTime(ui.time)}</strong> / {replayTime(recording.duration)}{ui.seeking?' · 탐색 중':''}</span>
  </div>
  <div className="replay-timeline"><input type="range" aria-label="리플레이 시간 탐색" min={0} max={Math.max(recording.duration,1/120)} step={1/120} value={ui.time} onChange={e=>{void seek(+e.target.value);}}/><div className="replay-marker-track">{markers.map(event=><button type="button" key={event.id} className="replay-marker" data-kind={event.kind} style={{left:`${event.percent}%`}} title={`${event.label} · ${replayTime(event.time)}`} aria-label={`${event.label} ${replayTime(event.time)}로 이동`} onClick={()=>{void seek(event.time);}}/>)}</div></div>
  <div className="replay-summary"><span>현재 제거<strong>{ui.score}</strong></span><span>현재 발사<strong>{ui.shots}</strong></span><span>무기<strong>{WEAPONS[ui.weapon].name}</strong></span><span>기록 점수<strong>{recording.final.score}</strong></span></div>
  <p className="replay-verification" data-state={verifying?'pending':verification?.passed?'passed':failed?'failed':'pending'} role="status">{verifying?'입력과 판정을 재실행해 기록을 검사하고 있습니다.':verification?.passed?`재실행 일치 · 체크포인트와 최종 점수 ${verification.score} 확인`:failed?'무결성 검사 불일치 · 검증된 점수로 사용할 수 없음':'검사 결과 없음'}</p>
  <div className="replay-controls"><button type="button" disabled={verifying} onClick={()=>{void verify();}}>무결성 다시 검사</button><button type="button" disabled={exporting} onClick={()=>{void save();}}>{exporting?'파일 준비 중…':'리플레이 파일 저장'}</button></div>
  {message&&<p className="replay-error" role="alert">{message}</p>}
  <p className="replay-note">카메라와 재생 속도는 보기만 바꿉니다. 입력·사격·판정은 기록과 호환되는 고정 시간 간격으로 다시 계산합니다. 다른 버전이나 다른 플랫폼의 완전한 일치는 보장하지 않습니다.</p>
  {session&&<SessionHighlights session={session} onSeek={time=>{void seek(time);}}/>}
 </section>;
}

export function ReplayLibrary({sessions}:{sessions:SessionData[]}){
 const [selected,setSelected]=useState<{recording:ReplayRecording;session?:SessionData}|null>(null),[message,setMessage]=useState(''),[importing,setImporting]=useState(false);
 const available=sessions.filter(s=>envelope(s.replay)).slice(0,40);
 const load=async(file:File|undefined)=>{if(!file)return;setImporting(true);setMessage('');try{const recording=await readReplayFile(file);setSelected({recording});}catch(error){setMessage(`파일을 열지 못했습니다. ${errorMessage(error)}`);}finally{setImporting(false);}};
 return <>
  <section className="replay-library"><header className="replay-library-heading"><div><h3>리플레이 보관함</h3><p>호환되는 훈련 기록을 다시 실행하거나 파일을 가져오세요. 파일은 서버로 보내지 않습니다.</p></div></header>
   <div className="replay-library-actions"><label className="replay-file-input">리플레이 파일 가져오기<input type="file" accept=".vpr,.gz,application/gzip,application/octet-stream" disabled={importing} onChange={e=>{void load(e.target.files?.[0]);e.currentTarget.value='';}}/></label>{importing&&<span role="status">파일 검사 중…</span>}</div>
   {message&&<p className="replay-error" role="alert">{message}</p>}
   {available.length?<ul className="replay-library-list">{available.map(s=><li key={s.id}><div><strong>{trainingTitle(s.mode,s.settings,s.sessionOptions)}</strong><small>{new Date(s.createdAt).toLocaleDateString(localeTag())} · {replayTime(s.duration)} · {s.summary.eliminations}개 제거</small></div><button type="button" onClick={()=>{setMessage('');setSelected({recording:s.replay!,session:s});}}>다시 보기</button></li>)}</ul>:<p className="replay-note">저장된 리플레이가 없습니다. 리플레이 기록을 지원하는 다음 훈련부터 여기에 표시됩니다. 이전 훈련 통계는 그대로 확인할 수 있습니다.</p>}
   <p className="replay-note">훈련 기록을 삭제하면 함께 보관된 리플레이도 삭제됩니다. 가져온 파일은 이 화면에서만 열리며 자동 저장되지 않습니다.</p>
  </section>
  {selected&&<ReplayViewer recording={selected.recording} session={selected.session} onClose={()=>setSelected(null)}/>}
 </>;
}

import {useEffect,useRef,useState} from 'react';
import type {SessionData} from '../engine/types';
import {MOTION_MAX_SECONDS,MOTION_MIN_SECONDS,motionDuration,type RecordedMotion} from '../training/scenarios/recordedMotion';
import type {ScenarioBot,ScenarioTemplate} from '../training/scenarios/types';
import {trainingTitle} from './trainingPresentation';

interface Props {
 bot:ScenarioBot;
 map:ScenarioTemplate;
 history:SessionData[];
 preview:number;
 onPreview:(seconds:number)=>void;
 onChange:(motion:RecordedMotion|undefined)=>void;
}

export function ScenarioMotionEditor({bot,map,history,preview,onPreview,onChange}:Props){
 const recordings=history.filter(session=>session.replay?.header.map===map&&!session.replay.header.initial.options.exercise&&session.replay.duration>=MOTION_MIN_SECONDS).slice(0,12);
 const [id,setId]=useState(''),[start,setStart]=useState(0),[length,setLength]=useState(2),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 const request=useRef<AbortController|null>(null);
 useEffect(()=>()=>request.current?.abort(),[]);
 const session=recordings.find(row=>row.id===id)??recordings[0],recording=session?.replay;
 const duration=recording?Math.floor(recording.duration*10)/10:0;
 const seconds=Math.min(length,Math.max(MOTION_MIN_SECONDS,duration)),startLimit=Math.max(0,Math.floor((duration-seconds+1e-8)*10)/10),from=Math.min(start,startLimit);
 const motion=bot.motion;
 const previewTime=motion?Math.min(preview,motionDuration(motion)):0;

 async function attach(){
  if(!recording)return;
  const controller=new AbortController();
  request.current?.abort();request.current=controller;setBusy(true);setMessage('');
  try{
   const module=await import('../training/scenarios/captureMotion');
   const next=await module.captureMotion(recording,from,seconds,controller.signal);
   if(!controller.signal.aborted){onChange(next);onPreview(0);setMessage('이동 구간을 연결했습니다. 평면도와 배치 검증 결과를 확인하세요.');}
  }catch(error){
   if(!controller.signal.aborted)setMessage(error instanceof Error?error.message:'이동 구간을 읽을 수 없습니다.');
  }finally{
   if(request.current===controller&&!controller.signal.aborted){request.current=null;setBusy(false);}
  }
 }

 return <section className="scenario-motion-editor" aria-label="수비수 이동 재현">
  <h3>리플레이 경로 재현</h3>
  <p className="field-note">같은 맵에서 기록한 지면 이동과 앉기 자세를 1–4초 구간으로 잘라 이 수비수에게 연결합니다.</p>
  {recording?<fieldset disabled={busy}>
   <label>이동을 가져올 리플레이<select value={session.id} onChange={event=>{setId(event.target.value);setStart(0);setMessage('');}}>
    {recordings.map(row=><option key={row.id} value={row.id}>{new Date(row.createdAt).toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})} · {trainingTitle(row.mode,row.settings,row.sessionOptions)}</option>)}
   </select></label>
   <div className="scenario-editor-fields">
    <label>시작 시점 · {from.toFixed(1)}초<input type="range" min={0} max={startLimit} step=".1" value={from} onChange={event=>setStart(+event.target.value)}/></label>
    <label>길이 · 초<input type="number" min={MOTION_MIN_SECONDS} max={Math.min(MOTION_MAX_SECONDS,duration)} step=".1" value={seconds} onChange={event=>setLength(Math.min(MOTION_MAX_SECONDS,Math.max(MOTION_MIN_SECONDS,Math.round(+event.target.value*10)/10)))}/></label>
   </div>
   <button type="button" className="secondary-button" onClick={()=>{void attach();}}>{busy?'리플레이 확인 중…':'선택한 구간 연결'}</button>
  </fieldset>:<p className="field-note">이 맵에서 이동하고 훈련을 기록으로 저장하면 여기에서 구간을 고를 수 있습니다.</p>}
  {motion&&<div className="scenario-motion-preview">
   <p className="field-note">{motion.source==='replay'?'플레이 리플레이에서 재현':'예제 경로'} · {motionDuration(motion).toFixed(1)}초</p>
   <label>미리보기 시점 · {previewTime.toFixed(1)}초<input type="range" min={0} max={motionDuration(motion)} step=".1" value={previewTime} onChange={event=>onPreview(+event.target.value)}/></label>
   <div className="scenario-editor-fields">
    <label>경로 회전<select value={motion.turns} onChange={event=>onChange({...motion,turns:+event.target.value as RecordedMotion['turns']})}>
     {[0,1,2,3].map(turn=><option key={turn} value={turn}>{turn*90}°</option>)}
    </select></label>
    <label className="scenario-checkbox"><input type="checkbox" checked={motion.mirror} onChange={event=>onChange({...motion,mirror:event.target.checked})}/>좌우 반전</label>
   </div>
   <button type="button" className="secondary-button" onClick={()=>{onChange(undefined);onPreview(0);}}>경로 연결 해제</button>
  </div>}
  {message&&<p className="field-note" role="status">{message}</p>}
 </section>;
}

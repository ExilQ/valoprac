import {zoomSensitivityMultiplier} from '../../engine/input/zoomSensitivity';
import type {Settings,WeaponId} from '../../engine/types';
import {AIM_VERSION,TASKS,trackingTask,type AimPlan,type AimRecord,type AimSetup,type AimTask,type PrecisionMode,type PrecisionStage,type EvaluationMode} from '../types';
import {candidates,makePlan} from '../experiments';
import {summarizeBlocks,precisionReport} from '../statistics';
import {calibrationFromSettings,constrainSensitivityCandidates,SCOPED_PROJECTION_MODEL} from './calibration';

export interface PrecisionPlanOptions {mode:PrecisionMode;stage:PrecisionStage;records:AimRecord[];seed?:number;protocolId?:string;evaluationMode?:EvaluationMode;adsMultiplier?:number;weapon?:WeaponId;}
export const PRECISION_TASKS:Record<PrecisionMode,readonly AimTask[]>={quick:['small','micro','reactive'],precision:TASKS,longitudinal:TASKS};
const STAGE_SEEDS:Record<PrecisionStage,number>={baseline:0,coarse:104729,fine:209759,heldout:314159,retention:419431};
export const estimatePrecisionMinutes=(mode:PrecisionMode)=>mode==='quick'?{min:5,max:8}:mode==='precision'?{min:20,max:40}:{min:20,max:40};
export function protocolEligibility(records:AimRecord[],base:number,mode:PrecisionMode,protocolId?:string,evaluationMode:EvaluationMode='hip'){
 const tasks=PRECISION_TASKS[mode],required=mode==='quick'?2:3;
 const relevant=records.filter(r=>r.meta.algorithm===AIM_VERSION&&r.meta.renderer==='angular-canvas'&&r.meta.protocol===mode&&!!protocolId&&r.meta.protocolId===protocolId&&(r.meta.evaluationMode??'hip')===evaluationMode);
 const complete=(stage:PrecisionStage)=>{
  const source=relevant.filter(r=>r.meta.stage===stage),blocks=summarizeBlocks(source),rounds=new Map<string,Set<AimTask>>();
  for(const b of blocks.filter(b=>Math.abs(b.sensitivity-base)<1e-7)){const key=`${b.session}|${b.round}|${b.compatibility}`,set=rounds.get(key)??new Set<AimTask>();set.add(b.task);rounds.set(key,set);}
  return [...rounds.values()].filter(set=>tasks.every(t=>set.has(t))).length>=required;
 };
 const baseline=complete('baseline'),coarse=complete('coarse'),fine=complete('fine'),heldout=complete('heldout');
 const old=relevant.some(r=>r.meta.stage==='heldout'&&r.metrics.valid&&Date.now()-r.meta.createdAt>=86400000);
 return {
  baseline:{allowed:true,reason:'현재 감도의 기준선부터 측정합니다.'},
  coarse:{allowed:baseline,reason:baseline?'기준선 반복 완료 · 후보를 교차 비교합니다.':'먼저 기준선의 모든 과제와 반복을 완료하세요.'},
  fine:{allowed:baseline&&coarse,reason:baseline&&coarse?'기준선을 포함해 유망 구간을 더 촘촘히 비교합니다.':'넓은 탐색의 모든 반복을 먼저 완료하세요.'},
  heldout:{allowed:baseline&&coarse&&(mode==='quick'||fine),reason:baseline&&coarse&&(mode==='quick'||fine)?'탐색에 쓰지 않은 크기·시드로 A/B를 검증합니다.':'기준선과 탐색을 먼저 완료하세요.'},
  retention:{allowed:heldout&&old,reason:heldout&&old?'24시간이 지난 보류 검증을 새 세션에서 재측정합니다.':'보류 검증을 완료하고 최소 24시간 뒤에 측정하세요.'}
 };
}

function matchingRecords(records:AimRecord[],setup:AimSetup,settings:Settings,options:PrecisionPlanOptions){
 const ads=(options.evaluationMode??'hip')!=='hip',multiplier=options.adsMultiplier??settings.adsSensitivity;
 return records.filter(r=>r.meta.algorithm===AIM_VERSION&&r.meta.dpi===setup.dpi&&Math.abs(r.meta.fov-settings.fov)<1e-6&&r.meta.coefficient===settings.degreesPerCount&&r.meta.ads===ads&&(!ads||r.meta.adsMultiplier===multiplier)&&(!options.weapon||r.meta.weapon===options.weapon)&&(!options.protocolId||r.meta.protocolId===options.protocolId)&&(r.meta.evaluationMode??'hip')===(options.evaluationMode??'hip'));
}
/** A protocol is a sequence of bounded, independently saved stage plans. No
 * setting is changed by planning or by accepting an experimental candidate. */
export function createPrecisionPlan(setup:AimSetup,settings:Settings,options:PrecisionPlanOptions):AimPlan{
 if(!Number.isFinite(setup.base)||setup.base<.01||setup.base>5)throw new Error('기준 감도를 0.01–5 범위로 입력하세요.');
 const source=matchingRecords(options.records,setup,settings,options),eligibility=protocolEligibility(source,setup.base,options.mode,options.protocolId,options.evaluationMode);
 if(!eligibility[options.stage].allowed)throw new Error(eligibility[options.stage].reason);
 const allowed=constrainSensitivityCandidates([...new Set(source.map(r=>r.meta.sensitivity))],calibrationFromSettings({...settings,dpi:setup.dpi}),{mousepadCm:setup.mousepad,comfortAngle:setup.comfortAngle??180}).accepted;
 const report=precisionReport(source.filter(r=>r.meta.stage==='coarse'||r.meta.stage==='fine'),setup.base,setup.goal,{allowedSensitivities:allowed});
 const best=report.recommended??report.results.find(r=>allowed.some(v=>Math.abs(v-r.sensitivity)<1e-7))?.sensitivity;
 const strongestAlternative=report.results.find(r=>Math.abs(r.sensitivity-setup.base)>1e-7&&allowed.some(v=>Math.abs(v-r.sensitivity)<1e-7))?.sensitivity;
 const priorHeldout=source.filter(r=>r.meta.stage==='heldout'&&Math.abs(r.meta.sensitivity-setup.base)>1e-7).sort((a,b)=>b.meta.createdAt-a.meta.createdAt)[0]?.meta.sensitivity;
 const comparison=options.stage==='retention'?priorHeldout:strongestAlternative;
 if(['fine','heldout','retention'].includes(options.stage)&&best===undefined)throw new Error('유효한 탐색 후보가 없어 다음 단계로 진행할 수 없습니다.');
 const base=setup.base,range=Math.max(.05,Math.min(.5,setup.range));
 let values=options.stage==='baseline'?[base]:options.stage==='coarse'?candidates(base,range,3):options.stage==='fine'?[base,best!,best!/Math.sqrt(1+range),best!*Math.sqrt(1+range)]:[base,comparison??best!];
 if(options.stage==='fine')values=values.map(v=>Math.max(base*(1-range),Math.min(base*(1+range),v)));
 values=[...new Set(values.map(v=>Number(Math.max(.01,Math.min(5,v)).toFixed(5))))];
 // The baseline must be measured even if it exceeds the declared travel
 // budget. It remains a control, not an implicitly accepted recommendation.
 const config=calibrationFromSettings({...settings,dpi:setup.dpi}),constraint=constrainSensitivityCandidates(values.filter(v=>Math.abs(v-base)>1e-7),config,{mousepadCm:setup.mousepad,comfortAngle:setup.comfortAngle??180});
 values=[base,...constraint.accepted];
 if(options.stage!=='baseline'&&values.length<2)throw new Error('입력한 패드 거리 안에서 비교할 다른 후보가 없습니다. 거리 또는 탐색 범위를 확인하세요.');
 const rounds=options.mode==='quick'?2:3,tasks=PRECISION_TASKS[options.mode].slice(),phase=options.stage==='baseline'?'baseline':options.stage==='heldout'?'verification':options.stage==='retention'?'retention':'exploration';
 const stageSeed=((options.seed??settings.seed)+STAGE_SEEDS[options.stage==='retention'?'baseline':options.stage])>>>0;
 const next=makePlan({...setup,rounds,alternative:best??base,schedule:'mixed'},phase,settings.fov,settings.degreesPerCount,stageSeed,tasks,1,values);
 // makePlan's old baseline/verification APIs choose their own candidate set;
 // protocol stages always use the explicitly bounded, paired list above.
 if(phase!=='exploration'){
  const template=makePlan({...setup,rounds,schedule:'mixed'},'exploration',settings.fov,settings.degreesPerCount,stageSeed,tasks,1,values);
  next.blocks=template.blocks.map((b,i)=>({...b,id:`${next.id}-${i}`,experiment:next.id,session:next.id,phase,
   radius:b.radius*(options.stage==='heldout'?.85:1),amplitude:b.amplitude*(options.stage==='heldout'?1.12:1)}));
 }
 if(options.mode==='quick')for(const block of next.blocks)if(!trackingTask(block.task))block.trials=4;
 next.protocol=options.mode;next.protocolId=options.protocolId??globalThis.crypto.randomUUID();next.stage=options.stage;next.evaluationMode=options.evaluationMode??'hip';next.weapon=options.weapon;next.scopeZoom=next.evaluationMode==='operator-5'?5:next.evaluationMode==='operator-2.5'?2.5:next.evaluationMode==='rifle-ads'?1.25:1;next.adsMultiplier=options.adsMultiplier??zoomSensitivityMultiplier(settings,next.scopeZoom);
 if(options.stage==='heldout'||options.stage==='retention')next.alternative=values.find(v=>Math.abs(v-base)>1e-7)??base;
 return next;
}

export function protocolProgress(plan:AimPlan,records:AimRecord[]){
 let completedBlocks=0,nextBlock=0;
 const zoom=plan.scopeZoom??(plan.evaluationMode==='operator-5'?5:plan.evaluationMode==='operator-2.5'?2.5:plan.evaluationMode==='rifle-ads'?1.25:1);
 // A saved scoped plan can be repeated under the corrected camera, but old
 // trials must not complete a partly collected current-camera block.
 const currentCondition=(r:AimRecord)=>zoom<=1||r.meta.ads&&(r.meta.projectionModel??r.meta.calibration?.projectionModel)===SCOPED_PROJECTION_MODEL&&Math.abs((r.meta.scopeZoom??r.meta.calibration?.scopeZoom??1)-zoom)<.04&&(plan.adsMultiplier===undefined||Math.abs(r.meta.adsMultiplier-plan.adsMultiplier)<1e-8);
 const done=plan.blocks.map(block=>{
  const trials=new Set(records.filter(r=>r.metrics.valid&&r.meta.blockId===block.id&&r.meta.algorithm===AIM_VERSION&&currentCondition(r)).map(r=>r.meta.trialIndex??r.meta.id));
  return trials.size>=block.trials;
 });
 for(const complete of done)if(complete)completedBlocks++;
 while(nextBlock<done.length&&done[nextBlock])nextBlock++;
 return {completedBlocks,totalBlocks:plan.blocks.length,nextBlock,complete:completedBlocks===plan.blocks.length};
}
export function resumePrecisionPlan(plan:AimPlan,records:AimRecord[]):AimPlan{
 const progress=protocolProgress(plan,records);if(progress.complete)throw new Error('이미 완료한 계획입니다. 다음 단계 또는 새 반복을 선택하세요.');
 return {...plan,resumeBlock:progress.nextBlock};
}

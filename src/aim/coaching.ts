import {median,mean,clamp} from './math';
import type {AimRecord,AimTask} from './types';
export interface Coaching {id:string;title:string;evidence:string;tasks:AimTask[];combat?:boolean;}
export function diagnose(records:AimRecord[]):Coaching[]{const a=records.filter(r=>r.metrics.valid&&r.meta.phase!=='combat'),click=a.filter(r=>r.metrics.hit!==null),result:Coaching[]=[],combat=records.filter(r=>r.meta.phase==='combat');
 if(combat.length>=20){const moving=combat.filter(r=>r.meta.moving&&!r.meta.hit).length;if(moving/combat.length>.25)result.push({id:'braking',title:'제동 후 첫 발 연습',evidence:`실제 무기 표본 ${combat.length}회 중 이동 중 빗나간 사격 ${moving}회. 감도 원인으로 분류하지 않습니다.`,tasks:['small'],combat:true});}
 if(click.length<20)return result;
 const late=click.filter(r=>r.metrics.clickClass==='late').length,early=click.filter(r=>r.metrics.clickClass==='early').length,over=click.filter(r=>r.metrics.extent==='over').length,under=click.filter(r=>r.metrics.extent==='under').length,correction=median(click.flatMap(r=>r.metrics.correctionTime===null?[]:[r.metrics.correctionTime]));
 if(late/click.length>.3)result.push({id:'late',title:'진입 후 클릭 실행',evidence:`${click.length}회 중 ${late}회에서 표적 안 대기가 180밀리초를 넘었습니다. 감도 변경보다 클릭 실행 과제를 권합니다.`,tasks:['large','switch']});
 if(early/click.length>.2)result.push({id:'early',title:'표적 진입 확인 후 클릭',evidence:`${click.length}회 중 ${early}회가 표적에 접근하는 도중 경계 밖에서 발사됐습니다. 조기 클릭 분류는 궤적 기반 가설입니다.`,tasks:['small','micro']});
 if(over/click.length>.35)result.push({id:'over',title:'초기 플릭 착지 조절',evidence:`${click.length}회 중 초기 이동이 표적 너머에서 끝난 표본 ${over}회. 감도가 원인이라고 확정하지 않습니다.`,tasks:['large','small','micro']});
 if(under/click.length>.35)result.push({id:'under',title:'첫 이동 거리와 후속 보정',evidence:`${click.length}회 중 초기 이동 부족 ${under}회. 이동 크기와 방향 오차를 함께 확인하세요.`,tasks:['large','switch']});
 if(correction!==null&&correction>.3)result.push({id:'correction',title:'미세 보정 효율',evidence:`보정 시간 중앙값 ${(correction*1000).toFixed(0)}밀리초. 반복 왕복보다 작은 단일 보정을 연습합니다.`,tasks:['micro','small']});
 const tracking=a.filter(r=>r.metrics.trackingRms!==null),recovery=median(tracking.flatMap(r=>r.metrics.recovery===null?[]:[r.metrics.recovery]));if(tracking.length>=6&&(recovery??0)>.25)result.push({id:'tracking',title:'방향 전환 후 트래킹 복귀',evidence:`트래킹 ${tracking.length}회, 복귀 중앙값 ${((recovery??0)*1000).toFixed(0)}밀리초. 예측형과 반응형 결과를 분리해 비교합니다.`,tasks:['smooth','reactive']});
 return result;
}
export function adaptDifficulty(previous:number,records:AimRecord[]){const a=records.filter(r=>r.metrics.valid).slice(-24);if(a.length<16)return previous;const hit=mean(a.flatMap(r=>r.metrics.hit===null?[]:[+r.metrics.hit])),on=mean(a.flatMap(r=>r.metrics.onTarget===null?[]:[r.metrics.onTarget])),performance=hit??on;if(performance===null)return previous;const correction=median(a.flatMap(r=>r.metrics.correctionTime===null?[]:[r.metrics.correctionTime]));return clamp(previous*(performance>.88&&(correction??0)<.25?1.08:performance<.6?.92:1),.6,1.8);}

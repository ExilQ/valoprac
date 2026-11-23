import type {InputDiagnostics} from './InputDiagnostics';
import type {InputLatencyProbe} from '../../benchmarks/InputLatencyProbe';
import type {GraphicsCapabilities} from '../rendering/GraphicsCapabilities';

export type EnvironmentState='pass'|'notice'|'warning'|'unknown';
export interface EnvironmentItem {
 id:'pointerLock'|'rawMouse'|'relativeInput'|'inputConsistency'|'refresh'|'frames'|'fullscreen'|'graphics'|'power';
 label:string;state:EnvironmentState;detail:string;action:string;
}
export interface FrameDelivery {
 samples:number;medianMs:number|null;p95Ms:number|null;maximumMs:number|null;estimatedHz:number|null;
}
export interface BrowserEnvironmentSupport {
 pointerLock:boolean|null;fullscreen:boolean|null;fullscreenActive:boolean;
 battery:{status:'unsupported'|'pending'|'available'|'unavailable';charging:boolean|null;level:number|null};
}
export interface EnvironmentObservation {
 support:BrowserEnvironmentSupport;locked:boolean;rawRequest:'unverified'|'accepted'|'fallback'|'denied';
 delivery:ReturnType<InputDiagnostics['snapshot']>|null;
 cpuLatency:ReturnType<InputLatencyProbe['snapshot']>|null;
 refresh:FrameDelivery;graphics:GraphicsCapabilities|null;graphicsAPI:'WebGL2'|'WebGL'|'unavailable'|'unknown';
 render:{fps:number;p95:number;frameLimit:number;ready:boolean}|null;
}
export interface EnvironmentReport {items:EnvironmentItem[];warnings:number;unknown:number;passed:number;limitations:string;}
export const UNKNOWN_ENVIRONMENT_SUPPORT:BrowserEnvironmentSupport={pointerLock:null,fullscreen:null,fullscreenActive:false,battery:{status:'unsupported',charging:null,level:null}};
export const EMPTY_FRAME_DELIVERY:FrameDelivery={samples:0,medianMs:null,p95Ms:null,maximumMs:null,estimatedHz:null};
const finite=(n:unknown):n is number=>typeof n==='number'&&Number.isFinite(n);
const ms=(n:number)=>n.toFixed(n<1?3:2)+' ms';
/** Pure local policy: caller supplies observations. The thresholds below are
 * advisory trainer budgets, not official game/device measurements. */
export function evaluateEnvironment(o:EnvironmentObservation):EnvironmentReport {
 const items:EnvironmentItem[]=[],add=(id:EnvironmentItem['id'],label:string,state:EnvironmentState,detail:string,action:string)=>items.push({id,label,state,detail,action});
 if(o.support.pointerLock===false)add('pointerLock','마우스 잠금','warning','이 환경에서 Pointer Lock API를 사용할 수 없습니다.','Pointer Lock을 지원하는 데스크톱 브라우저에서 여세요.');
 else if(o.locked)add('pointerLock','마우스 잠금','pass','이 훈련 화면에 마우스가 잠겼습니다.','Esc를 누르면 잠금을 해제할 수 있습니다.');
 else add('pointerLock','마우스 잠금',o.support.pointerLock===null?'unknown':'notice',o.support.pointerLock===null?'API 지원 여부를 아직 확인하지 못했습니다.':'API 지원 · 현재는 잠금 해제 상태입니다.','훈련 시작 버튼을 직접 눌러 잠금을 확인하세요.');
 const raw={accepted:['pass','브라우저가 원시 상대 입력 요청을 수락했습니다. 센서 경로는 미검증입니다.','입력 느낌이 다르면 운영체제의 포인터 가속 설정을 직접 확인하세요.'],fallback:['notice','원시 요청 대신 일반 상대 입력을 사용합니다.','원시 입력을 지원하는 브라우저에서 다시 확인하세요.'],denied:['warning','브라우저가 원시 입력 또는 잠금 요청을 거부했습니다.','훈련 시작 버튼을 다시 직접 눌러 요청하세요.'],unverified:['unknown','원시 입력 수락 여부를 아직 확인하지 못했습니다.','훈련을 한 번 시작한 뒤 이 패널에서 결과를 확인하세요.']} as const;
 const rawItem=raw[o.rawRequest];add('rawMouse','원시 입력 요청',rawItem[0],rawItem[1],rawItem[2]);
 const d=o.delivery,events=d&&finite(d.events)?Math.max(0,Math.floor(d.events)):0;
 if(d&&events>0&&finite(d.sumX)&&finite(d.sumY))add('relativeInput','상대 이동 전달','pass',`이동 이벤트 ${events}개 · 누적 X ${d.sumX.toFixed(0)} / Y ${d.sumY.toFixed(0)} 카운트`,'조준이 끊기면 훈련을 잠시 멈추고 입력 전달 기록을 확인하세요.');
 else add('relativeInput','상대 이동 전달','unknown','이 훈련에서 수신한 마우스 이동 기록이 아직 없습니다.','훈련에서 마우스를 움직인 뒤 Esc로 돌아오세요.');
 if(d&&events>=32&&finite(d.deliveryP95)&&finite(d.callbackP95)){
  const slow=d.deliveryP95>16||d.callbackP95>2,hz=finite(d.deliveredHz)?Math.max(0,d.deliveredHz):0,cpu=o.cpuLatency?.mouse.p95Ms;
  add('inputConsistency','이벤트 처리 일관성',slow?'warning':'pass',`수신 지연 p95 ${ms(Math.max(0,d.deliveryP95))} · 콜백 p95 ${ms(Math.max(0,d.callbackP95))} · 최근 ${hz.toFixed(0)}회/초${finite(cpu)?` · 렌더 제출 CPU p95 ${ms(cpu)}`:''}`,slow?'다른 무거운 작업을 줄인 뒤 같은 마우스 동작으로 다시 측정하세요.':'입력 설정을 바꿀 때 같은 동작으로 기록을 비교하세요.');
 }else add('inputConsistency','이벤트 처리 일관성','unknown','32개 이상의 이동 이벤트가 필요합니다. 장치 보고율과 센서 주파수는 측정하지 않습니다.','훈련 중 마우스를 1초 이상 움직인 뒤 다시 확인하세요.');
 const r=o.refresh;
 if(r.samples>=8&&finite(r.estimatedHz)&&finite(r.p95Ms))add('refresh','rAF 전달 주기','notice',`${r.samples}개 간격 · 추정 ${r.estimatedHz.toFixed(1)}회/초 · p95 ${ms(r.p95Ms)} · 모니터 주사율이 아닙니다.`,'실제 주사율은 운영체제의 디스플레이 설정에서 확인하세요.');
 else add('refresh','rAF 전달 주기','unknown','화면 콜백 간격을 수집하고 있습니다. 물리 주사율은 브라우저에서 확정할 수 없습니다.','이 탭을 보이게 둔 뒤 다시 측정을 누르세요.');
 const f=o.render;
 if(f&&!f.ready)add('frames','렌더 프레임 간격','notice','훈련에 필요한 그래픽을 준비하고 있습니다.','그래픽 준비가 끝난 뒤 훈련을 시작하세요.');
 else if(f&&finite(f.fps)&&f.fps>0&&finite(f.p95)&&f.p95>0){
  const selectedBudget=finite(f.frameLimit)&&f.frameLimit>0?1000/f.frameLimit:1000/60,slow=f.p95>Math.max(50,selectedBudget*2.5);
  add('frames','렌더 프레임 간격',slow?'warning':'pass',`평균 ${f.fps.toFixed(1)}프레임/초 · p95 ${ms(f.p95)} · 브라우저 렌더 제출 간격`,slow?'그래픽 설정을 낮음으로 바꾼 뒤 같은 장면을 확인하세요.':'그래픽 설정을 바꾸면 같은 장면에서 간격을 다시 확인하세요.');
 }else add('frames','렌더 프레임 간격','unknown','현재 훈련 화면의 프레임 표본이 아직 없습니다.','훈련 화면이 표시된 뒤 다시 확인하세요.');
 if(o.support.fullscreen===false)add('fullscreen','전체화면','notice','Fullscreen API가 제공되지 않습니다.','브라우저 창을 넓혀 훈련 화면을 사용하세요.');
 else if(o.support.fullscreen===null)add('fullscreen','전체화면','unknown','전체화면 지원 여부를 아직 확인하지 못했습니다.','데스크톱 브라우저에서 전체화면 지원을 확인하세요.');
 else add('fullscreen','전체화면',o.support.fullscreenActive?'pass':'notice',o.support.fullscreenActive?'브라우저 전체화면을 사용하고 있습니다.':'전체화면 API 지원 · 현재는 창 모드입니다.','필요하면 전체화면·키 잠금으로 시작 버튼을 사용하세요.');
 const g=o.graphics;
 if(o.graphicsAPI==='unavailable')add('graphics','그래픽 가속','warning','이 훈련 화면에 사용 가능한 WebGL 컨텍스트가 없습니다.','브라우저의 하드웨어 가속 설정을 확인한 뒤 다시 여세요.');
 else if(g){const names={software:'소프트웨어 렌더러',integrated:'내장·모바일 그래픽 추정',hardware:'하드웨어 이름 보고',unknown:'장치 정보 비공개'};
  add('graphics','그래픽 가속',g.kind==='software'?'warning':g.kind==='unknown'?'unknown':g.kind==='integrated'?'notice':'pass',`${o.graphicsAPI} · ${names[g.kind]} · ${g.renderer||'상세 정보 없음'}${g.heuristic?' · 이름에 따른 분류이며 성능 측정이 아닙니다.':''}`,g.recommendLow?'그래픽 품질을 낮음으로 선택하세요.':'실제 성능은 위의 렌더 프레임 간격에서 확인하세요.');
 }else add('graphics','그래픽 가속','unknown','그래픽 렌더러 관측값이 아직 없습니다.','훈련 그래픽이 준비된 뒤 다시 확인하세요.');
 const b=o.support.battery;
 if(b.status==='available'&&finite(b.level)&&b.level>=0&&b.level<=1&&typeof b.charging==='boolean')add('power','전원·절전 상태',!b.charging&&b.level<.2?'notice':'pass',`배터리 ${(b.level*100).toFixed(0)}% · ${b.charging?'충전 중':'배터리 사용 중'} · 운영체제 절전 모드는 확인 불가`,'전원 설정에서 절전 모드 여부를 직접 확인하세요.');
 else add('power','전원·절전 상태','unknown',b.status==='pending'?'브라우저 배터리 API 응답을 기다리고 있습니다.':'브라우저가 배터리 정보를 제공하지 않습니다. 운영체제 절전 모드는 확인 불가합니다.','전원 설정에서 절전 모드 여부를 직접 확인하세요.');
 return{items,warnings:items.filter(i=>i.state==='warning').length,unknown:items.filter(i=>i.state==='unknown').length,passed:items.filter(i=>i.state==='pass').length,limitations:'이벤트 전달과 CPU 렌더 제출 기록입니다. 물리 마우스 보고율, 운영체제 가속, 모니터 주사율, GPU 완료 및 입력부터 화면 반응까지의 지연은 확정하지 않습니다. 점검값은 이 브라우저에서만 사용하며 업로드하지 않습니다.'};
}
/** Bounded rAF callback sampler. This is delivery cadence, not display EDID. */
export class EnvironmentFrameSampler {
 private intervals:number[]=[];private last:number|null=null;
 record(timestamp:number,visible=true){
  if(!visible||!finite(timestamp)){this.last=null;return;}
  if(this.last!==null){const gap=timestamp-this.last;if(gap>0&&gap<60000){this.intervals.push(gap);if(this.intervals.length>120)this.intervals.shift();}}
  this.last=timestamp;
 }
 get samples(){return this.intervals.length;}
 reset(){this.last=null;this.intervals=[];}
 snapshot():FrameDelivery {const a=this.intervals.slice().sort((a,b)=>a-b),n=a.length,median=n?a[Math.floor(n*.5)]:null;return{samples:n,medianMs:median,p95Ms:n?a[Math.floor(n*.95)]:null,maximumMs:n?a[n-1]:null,estimatedHz:median!==null&&median>0?1000/median:null};}
}

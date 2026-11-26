import {useApp,type GraphicsObservation} from '../app/store';
import {GRAPHICS_PRESETS} from '../config/settings';
import type {Settings} from '../engine/types';
export function GraphicsNoticeView({info,settings,onToggle,onDismiss}:{info:GraphicsObservation;settings:Settings;onToggle:()=>void;onDismiss:()=>void}){
 return <div className="graphics-notice" role="status" aria-label="그래픽 실행 환경 안내"><div><strong>{info.kind==='software'?'소프트웨어 그래픽이 감지되었습니다.':'내장 그래픽으로 추정되는 환경입니다.'}</strong><p>{settings.autoGraphics?'안정적인 훈련을 위해 낮음 품질을 자동 적용했습니다.':'그래픽 품질은 직접 선택한 설정을 사용합니다.'} 하드웨어 가속과 그래픽 설정을 확인하면 도움이 될 수 있습니다.</p><details><summary>감지 근거</summary><small>{info.reason} · {info.renderer||'그래픽 이름 비공개'}</small><p>이름을 바탕으로 한 추정이며 실제 성능 측정은 아닙니다.</p></details></div><div className="graphics-notice-actions"><button onClick={onToggle}>{settings.autoGraphics?'자동 적용 끄기':'낮음 자동 적용'}</button><button aria-label="그래픽 안내 닫기" onClick={onDismiss}>닫기</button></div></div>;
}
export function GraphicsNotice(){
 const info=useApp(s=>s.graphics),settings=useApp(s=>s.settings),dismissed=useApp(s=>s.graphicsDismissed),update=useApp(s=>s.updateSettings);
 if(!info?.recommendLow||dismissed)return null;
 return <GraphicsNoticeView info={info} settings={settings} onToggle={()=>settings.autoGraphics?update({autoGraphics:false}):update({...GRAPHICS_PRESETS.low,autoGraphics:true})} onDismiss={()=>useApp.setState({graphicsDismissed:true})}/>;
}

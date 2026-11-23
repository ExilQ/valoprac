import {bindingLabel} from '../ui/OperatorScopeControls';
export function ScopeOverlay({amount,zoom,state,zoomBinding='KeyV'}:{amount:number;zoom:number;state?:string;zoomBinding?:string}){
 if(!Number.isFinite(amount)||amount<.015)return null;
 const magnification=Number.isFinite(zoom)?zoom:1;
 return <div className="sniper-scope" style={{opacity:Math.min(1,amount*1.4)}} role="img" aria-label={`오퍼레이터 스코프 ${magnification.toFixed(1)}배`}>
  <div className="scope-aperture"/><div className="scope-reticle"><i className="scope-center"/><small>{magnification.toFixed(1)}×</small></div>
  <span className="scope-status">{state==='bolt-cycling'?'볼트 회복 중':state==='scoping'?'조준 전환 중':`${bindingLabel(zoomBinding)} · 배율 전환`} / 2.5× · 5×</span>
 </div>;
}

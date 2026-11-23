import {useState} from 'react';
import {useApp} from '../app/store';
import {DEFAULT_SETTINGS} from '../config/settings';
import type {Settings} from '../engine/types';

export function bindingLabel(code:string){return code.replace(/^Key/,'').replace(/^Digit/,'').replace('Left',' 왼쪽').replace('Right',' 오른쪽').replace('Space','공백');}
export function scopeBindingError(code:string,settings:Pick<Settings,'bindings'>):string|null{
 if(!/^Key[A-Z]$/.test(code))return '배율 전환에는 영문 문자 키 하나를 지정하세요.';
 if(Object.values(settings.bindings).includes(code))return '이동·조작에 이미 사용 중인 키입니다.';
 return null;
}
export function OperatorScopeControls({compact=false}:{compact?:boolean}){
 const s=useApp(x=>x.settings),update=useApp(x=>x.updateSettings),[message,setMessage]=useState('');
 const assign=(code:string)=>{const error=scopeBindingError(code,s);if(error){setMessage(error);return;}update({operatorZoomBinding:code});setMessage('');};
 return <section className={`operator-scope-controls ${compact?'compact':''}`} aria-label="오퍼레이터 스코프 설정">
  <h4>오퍼레이터 스코프</h4>
  <div className="operator-scope-fields"><label className="practice-select">스코프 조작<select value={s.operatorScopeMode} onChange={e=>update({operatorScopeMode:e.target.value as Settings['operatorScopeMode']})}><option value="toggle">토글 · 2.5 → 5 → 해제</option><option value="hold">누르는 동안 유지</option></select></label>
   <label className="scope-key-field">배율 전환 키<input aria-label="오퍼레이터 배율 전환 키" readOnly value={bindingLabel(s.operatorZoomBinding)} onKeyDown={e=>{if(e.key==='Tab')return;if(e.key==='Escape'){e.currentTarget.blur();return;}e.preventDefault();if(e.ctrlKey||e.altKey||e.metaKey){setMessage('조합 키 없이 영문 문자 키 하나를 누르세요.');return;}assign(e.code);}}/><button type="button" onClick={()=>assign(DEFAULT_SETTINGS.operatorZoomBinding)}>키 초기화</button></label>
   <label className="practice-toggle"><span>볼트 회복 후 자동 재조준</span><input type="checkbox" checked={s.operatorAutoRescope} onChange={e=>update({operatorAutoRescope:e.target.checked})}/></label>
  </div>
  <p className="field-note">{s.operatorScopeMode==='toggle'?'우클릭할 때마다 2.5배 → 5배 → 해제됩니다.':'우클릭을 누르는 동안 조준하고, 놓으면 해제됩니다.'} <kbd>{bindingLabel(s.operatorZoomBinding)}</kbd>로 조준 중 배율을 바꿉니다. 자동 재조준은 사격 전 배율로 볼트 회복 후 복귀하며, 재장전·무기 교체는 취소합니다. 소총 ADS 설정은 그대로 유지됩니다.</p>
  {message&&<p className="inline-notice" role="status">{message}</p>}
 </section>;
}

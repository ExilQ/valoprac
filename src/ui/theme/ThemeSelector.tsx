import {Monitor,Moon,Sun} from 'lucide-react';
import {setThemePreference,useTheme,type ThemePreference} from './theme';

const OPTIONS=[
 {value:'light',label:'밝은 테마',Icon:Sun},
 {value:'dark',label:'어두운 테마',Icon:Moon},
 {value:'system',label:'시스템 설정',Icon:Monitor}
] as const;

export function ThemeSelector({compact=false}:{compact?:boolean}){
 const theme=useTheme();
 return <div className={`theme-selector${compact?' theme-selector-compact':''}`}>
  <div className="theme-options" role="group" aria-label="화면 테마">
   {OPTIONS.map(({value,label,Icon})=><button className="theme-option" type="button" key={value} aria-pressed={theme.preference===value} onClick={()=>setThemePreference(value as ThemePreference)}><Icon size={16} aria-hidden="true"/><span>{label}</span></button>)}
  </div>
  {!compact&&<p className="field-note">{theme.preference==='system'?(theme.systemAvailable?`시스템 설정을 따릅니다. 현재 ${theme.resolved==='dark'?'어두운':'밝은'} 테마입니다.`:'시스템 설정을 확인할 수 없어 밝은 테마를 사용합니다.'):'화면의 색만 바뀝니다. 진행 중인 훈련과 설정은 유지됩니다.'}</p>}
 </div>;
}

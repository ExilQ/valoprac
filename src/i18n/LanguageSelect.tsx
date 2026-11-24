import {setLocale,useLocaleState,type Locale} from './locale';

export function LanguageSelect(){
 const {locale,loading,error}=useLocaleState();
 return <label className="app-language">
  <span>Language</span>
  <select aria-label="Language" value={loading?'en':locale} aria-busy={loading} onChange={event=>void setLocale(event.target.value as Locale)}>
   <option value="en" lang="en">English</option>
   <option value="ko" lang="ko" data-locale="literal">한국어</option>
  </select>
  {error&&<small role="status">{error}</small>}
 </label>;
}

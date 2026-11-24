import {useSyncExternalStore} from 'react';

export type Locale='ko'|'en';
export const LOCALE_STORAGE_KEY='valoprac-locale-v1';
export interface LocaleState {locale:Locale;loading:boolean;error:string|null;revision:number;}
type Entry={id:string;source:string;en:string};
type Trie={next:Map<string,Trie>;text?:string};
let locale:Locale='ko',loading=false,error:string|null=null;
let patchTranslations:Record<string,{title:string;description:string;changes:string[]}>={};
export function englishPatch(version:string){return locale==='en'?patchTranslations[version]:undefined;}
let catalog:Map<string,string>|null=null,entries:Entry[]=[],trie:Trie={next:new Map()};
let request:Promise<void>|null=null,epoch=0,revision=0;
const listeners=new Set<()=>void>(),missing=new Set<string>();
let snapshot:LocaleState={locale,loading,error,revision};
function publish(){snapshot={locale,loading,error,revision:++revision};for(const listener of listeners)listener();}
export function subscribeLocale(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener);};}
export function getLocale(){return locale;}
export function localeTag(){return locale==='en'?'en-US':'ko-KR';}
export function getLocaleState(){return snapshot;}
export function useLocale(){return useSyncExternalStore(subscribeLocale,getLocale,()=> 'ko' as Locale);}
export function useLocaleState(){return useSyncExternalStore(subscribeLocale,getLocaleState,getLocaleState);}
function remember(next:Locale){try{localStorage.setItem(LOCALE_STORAGE_KEY,next);}catch{/* Selection still works without writable storage. */}}
function documentLanguage(){if(typeof document!=='undefined')document.documentElement.lang=locale;}
async function loadEnglish(){
 if(catalog)return;if(!request)request=Promise.all([import('./catalog.en.json'),import('./patches.en.json')]).then(([module,patches])=>{
  patchTranslations=patches.default;entries=module.default.entries;catalog=new Map();trie={next:new Map()};
  for(const entry of entries){catalog.set(entry.source,entry.en);let node=trie;for(const c of entry.source){let child=node.next.get(c);if(!child){child={next:new Map()};node.next.set(c,child);}node=child;}node.text=entry.en;}
 }).finally(()=>{request=null;});await request;
}
/** Language changes affect presentation only; no game settings or state reset. */
export async function setLocale(next:Locale){
 if(next!=='ko'&&next!=='en')throw new Error('Unsupported interface language');
 const current=++epoch;error=null;
 if(next==='ko'){loading=false;locale='ko';remember(locale);documentLanguage();publish();return;}
 loading=true;publish();try{await loadEnglish();if(current!==epoch)return;locale='en';loading=false;remember(locale);documentLanguage();publish();}
 catch{if(current!==epoch)return;loading=false;error='언어 파일을 불러오지 못했습니다. 다시 선택하세요.';publish();}
}
const HANGUL=/[가-힣ㄱ-ㅎㅏ-ㅣ]/;
/** Longest known source fragments handle legacy composed labels. Unknown text
 * remains visible and is retained locally for coverage checks, never uploaded. */
export function translateText(value:string):string{
 if(locale==='ko'||!catalog||!HANGUL.test(value))return value;
 const match=value.match(/^(\s*)([\s\S]*?)(\s*)$/)!;
 const exact=catalog.get(match[2]);if(exact!==undefined)return match[1]+exact+match[3];
 let output='';for(let index=0;index<value.length;){let node=trie,last:string|undefined,end=index;
  for(let cursor=index;cursor<value.length;cursor++){const next=node.next.get(value[cursor]);if(!next)break;node=next;const embeddedSingle=cursor===index&&(HANGUL.test(value[index-1]??'')||HANGUL.test(value[cursor+1]??''));if(node.text!==undefined&&!embeddedSingle){last=node.text;end=cursor+1;}}
  if(last!==undefined){output+=last;index=end;}else output+=value[index++];
 }
 if(HANGUL.test(output)&&missing.size<2000)missing.add(value.slice(0,1000));
 return output.replace(/([A-Za-z])(?=\d)/g,'$1 ').replace(/(\d)(?=[A-CE-Za-ce-z])/g,'$1 ');
}
const MESSAGES={
 'rotation.counts':{ko:'{count} 카운트',en:'{count} counts'},
 'rotation.distance':{ko:'{distance} 센티미터',en:'{distance} cm'},
 'score.eliminations':{ko:'{count}개 제거',en:'{count} eliminations'},
 'time.seconds':{ko:'{seconds}초',en:'{seconds} s'},
 'session.duration':{ko:'{title} · {seconds}초',en:'{title} · {seconds} s'},
 'locale.loading':{ko:'영어 화면을 불러옵니다…',en:'Loading the English interface…'},
} as const;
export function message(id:keyof typeof MESSAGES,values:Record<string,string|number>={}){
 return MESSAGES[id][locale].replace(/\{([a-z]+)\}/gi,(_,key:string)=>values[key]===undefined?`{${key}}`:String(values[key]));
}
export function missingTranslations(){return [...missing];}
export function clearMissingTranslations(){missing.clear();}
export function localeCatalogInfo(){return{locale,loaded:!!catalog,entries:entries.length,missing:missing.size};}
export function initializeKoreanInterface(){void setLocale('ko');}

/** Reuse the same presentation preference on training, reviews and guides. */
export async function initializeLocale(){
 let saved:Locale='ko';
 try{if(localStorage.getItem(LOCALE_STORAGE_KEY)==='en')saved='en';}catch{/* Korean remains the default. */}
 await setLocale(saved);
}

if(typeof window!=='undefined'){
 documentLanguage();
 window.addEventListener('storage',event=>{
  if(event.key===LOCALE_STORAGE_KEY&&(event.newValue==='ko'||event.newValue==='en')&&event.newValue!==locale)void setLocale(event.newValue);
 });
}

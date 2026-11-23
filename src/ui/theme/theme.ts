import {useSyncExternalStore} from 'react';

export type ThemePreference='light'|'dark'|'system';
export type ResolvedTheme='light'|'dark';
export interface ThemeState {
 readonly preference:ThemePreference;
 readonly resolved:ResolvedTheme;
 readonly systemAvailable:boolean;
}
export const THEME_STORAGE_KEY='valoprac-interface-theme-v1';
const SYSTEM_QUERY='(prefers-color-scheme: dark)';
const SERVER_STATE:ThemeState=Object.freeze({preference:'light',resolved:'light',systemAvailable:false});
let state:ThemeState=SERVER_STATE;
let started=false,media:MediaQueryList|null=null,systemDark=false,paletteEpoch=0;
let removeMedia:(()=>void)|null=null,removeStorage:(()=>void)|null=null;
const listeners=new Set<()=>void>();

export function isThemePreference(value:unknown):value is ThemePreference {
 return value==='light'||value==='dark'||value==='system';
}
function storedPreference():ThemePreference {
 try{const value=window.localStorage.getItem(THEME_STORAGE_KEY);return isThemePreference(value)?value:'light';}
 catch{return 'light';}
}
function applyDocument(next:ThemeState){
 if(typeof document==='undefined')return;
 const root=document.documentElement;
 // Apply theme colors atomically; hover transitions must not interpolate ink
 // against a background from a different palette during the switch.
 if(root.getAttribute?.('data-theme')!==next.resolved){
  const epoch=++paletteEpoch;root.setAttribute('data-theme-switching','true');
  if(typeof requestAnimationFrame==='function')requestAnimationFrame(()=>requestAnimationFrame(()=>{if(epoch===paletteEpoch)root.setAttribute('data-theme-switching','false');}));
  else root.setAttribute('data-theme-switching','false');
 }
 root.setAttribute('data-theme',next.resolved);
 document.documentElement.setAttribute('data-theme-preference',next.preference);
 document.querySelector?.('meta[name="theme-color"]')?.setAttribute('content',next.resolved==='light'?'#ffffff':'#202a2d');
}
function update(preference:ThemePreference){
 const resolved:ResolvedTheme=preference==='dark'||preference==='system'&&systemDark?'dark':'light';
 const next:ThemeState=Object.freeze({preference,resolved,systemAvailable:media!==null});
 applyDocument(next);
 if(state.preference===next.preference&&state.resolved===next.resolved&&state.systemAvailable===next.systemAvailable)return;
 state=next;
 for(const listener of listeners)listener();
}

/** Run before mounting React. This store never imports or writes game settings. */
export function initializeTheme(){
 if(started||typeof window==='undefined'||typeof document==='undefined')return;
 started=true;
 try{media=typeof window.matchMedia==='function'?window.matchMedia(SYSTEM_QUERY):null;systemDark=!!media?.matches;}
 catch{media=null;systemDark=false;}
 if(media){
  const query=media,change=(event:MediaQueryListEvent)=>{systemDark=event.matches;update(state.preference);};
  try{
   if(typeof query.addEventListener==='function'){
    query.addEventListener('change',change);removeMedia=()=>query.removeEventListener('change',change);
   }else if(typeof query.addListener==='function'){
    query.addListener(change);removeMedia=()=>query.removeListener(change);
   }
  }catch{/* An initial system preference still works if live observation is denied. */}
 }
 const storage=(event:StorageEvent)=>{
  if(event.key!==THEME_STORAGE_KEY&&event.key!==null)return;
  // A sibling tab can change the presentation preference or clear local data.
  const value=event.key===null?null:event.newValue;
  update(isThemePreference(value)?value:'light');
 };
 window.addEventListener('storage',storage);removeStorage=()=>window.removeEventListener('storage',storage);
 update(storedPreference());
}

/** Choosing a theme changes DOM tokens only; mounted training remains intact. */
export function setThemePreference(preference:ThemePreference){
 if(!isThemePreference(preference))throw new Error('Unsupported interface theme');
 initializeTheme();
 try{if(typeof window!=='undefined')window.localStorage.setItem(THEME_STORAGE_KEY,preference);}
 catch{/* The current choice works when persistent storage is unavailable. */}
 update(preference);
}
export function getThemeState(){return state;}
export function subscribeTheme(listener:()=>void){
 initializeTheme();listeners.add(listener);return()=>{listeners.delete(listener);};
}
export function useTheme(){return useSyncExternalStore(subscribeTheme,getThemeState,()=>SERVER_STATE);}

/** Presentation shell teardown, also used by isolated browser-environment tests. */
export function disposeTheme(){
 removeMedia?.();removeStorage?.();removeMedia=null;removeStorage=null;
 media=null;systemDark=false;started=false;++paletteEpoch;
}

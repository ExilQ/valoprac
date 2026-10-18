import { create } from 'zustand';
import { navigate,TAB_PATHS } from './navigation';
import { loadSettings, persistSettings, sanitizeSettings } from '../config/settings';
import type { Settings, Mode, WeaponId, SessionData } from '../engine/types';
import { loadHistory, saveSession } from '../storage/history';
export type Screen='menu'|'training'|'results';
interface AppState {
  screen:Screen;mode:Mode;weapon:WeaponId;settings:Settings;locked:boolean;paused:boolean;
  history:SessionData[];result:SessionData|null;notice:string;activeTab:'training'|'settings'|'history';
  updateSettings:(patch:Partial<Settings>)=>void;setMode:(mode:Mode)=>void;setWeapon:(weapon:WeaponId)=>void;
  setTab:(tab:AppState['activeTab'])=>void;start:()=>void;finish:(session:SessionData)=>Promise<void>;menu:()=>void;refreshHistory:()=>Promise<void>;
}
export const useApp=create<AppState>((set,get)=>({
  screen:'menu',mode:'precision',weapon:'rifleA',settings:loadSettings(),locked:false,paused:true,history:[],result:null,notice:'',activeTab:'training',
  updateSettings:patch=>{const settings=sanitizeSettings({...get().settings,...patch});const saved=persistSettings(settings);set({settings,...(!saved?{notice:'설정을 저장할 수 없습니다. 브라우저 저장 공간을 확인하세요.'}:{})});},
  setMode:mode=>set({mode}),setWeapon:weapon=>set({weapon}),setTab:activeTab=>{navigate(TAB_PATHS[activeTab]);set({activeTab,screen:'menu',locked:false,paused:true});},
  start:()=>{navigate('/training');set({screen:'training',paused:true,result:null,notice:''});},
  finish:async session=>{navigate('/results');set({screen:'results',result:session,locked:false,paused:true});try{await saveSession(session);await get().refreshHistory();}catch{set({notice:'이번 결과를 저장하지 못했습니다. 현재 결과는 화면에서 확인할 수 있습니다.'});}},
  menu:()=>{navigate('/');set({screen:'menu',activeTab:'training',locked:false,paused:true});},
  refreshHistory:async()=>{try{set({history:await loadHistory()});}catch{set({notice:'훈련 기록을 불러오지 못했습니다. 브라우저의 로컬 저장 허용을 확인하세요.'});}}
}));

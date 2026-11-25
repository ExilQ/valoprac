import {afterEach,describe,expect,it,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {runInNewContext} from 'node:vm';
import {ThemeSelector} from '../ui/theme/ThemeSelector';
import {THEME_BOOTSTRAP_SCRIPT} from '../ui/theme/bootstrap';
import {disposeTheme,getThemeState,initializeTheme,setThemePreference,subscribeTheme,THEME_STORAGE_KEY} from '../ui/theme/theme';
import {DEFAULT_SETTINGS} from '../config/settings';
import {Simulation} from '../engine/simulation/Simulation';
import {simulationChecksum} from '../engine/replay/integrity';
import {ReplayRecorder} from '../engine/replay/recording';
import {ReplayPlayer} from '../engine/replay/playback';
import {emptyInput} from '../engine/types';

class MemoryStorage {
 readonly values=new Map<string,string>();writes:{key:string;value:string}[]=[];blocked=false;
 getItem(key:string){if(this.blocked)throw new Error('Storage unavailable');return this.values.get(key)??null;}
 setItem(key:string,value:string){if(this.blocked)throw new Error('Storage unavailable');this.writes.push({key,value});this.values.set(key,value);}
}
class SystemMedia extends EventTarget {
 matches=false;media='(prefers-color-scheme: dark)';
 change(matches:boolean){this.matches=matches;const event=new Event('change');Object.defineProperty(event,'matches',{value:matches});this.dispatchEvent(event);}
}
function environment({preference,dark=false,blocked=false,supported=true}:{preference?:string;dark?:boolean;blocked?:boolean;supported?:boolean}={}){
 const storage=new MemoryStorage();if(preference!==undefined)storage.values.set(THEME_STORAGE_KEY,preference);storage.blocked=blocked;
 const media=new SystemMedia();media.matches=dark;const win=new EventTarget() as EventTarget&{localStorage:MemoryStorage;matchMedia?:(query:string)=>MediaQueryList};
 win.localStorage=storage;if(supported)win.matchMedia=()=>media as unknown as MediaQueryList;
 const attrs=new Map<string,string>(),document={documentElement:{setAttribute:(key:string,value:string)=>attrs.set(key,value)}};
 vi.stubGlobal('window',win);vi.stubGlobal('document',document);return{storage,media,win,attrs};
}
afterEach(()=>{disposeTheme();vi.unstubAllGlobals();});

describe('Independent Precision Utility presentation themes',()=>{
 it('defaults to light even for a dark operating system, without creating a settings write',()=>{
  const e=environment({dark:true});initializeTheme();
  expect(getThemeState()).toEqual({preference:'light',resolved:'light',systemAvailable:true});
  expect(e.attrs.get('data-theme')).toBe('light');expect(e.attrs.get('data-theme-preference')).toBe('light');expect(e.storage.writes).toEqual([]);
 });
 it('restores a bounded saved choice before mounting and retains one stable subscription',()=>{
  const e=environment({preference:'dark'});initializeTheme();const before=getThemeState();expect(e.attrs.get('data-theme')).toBe('dark');
  let changes=0;const unsubscribe=subscribeTheme(()=>changes++);initializeTheme();expect(getThemeState()).toBe(before);e.media.change(true);expect(changes).toBe(0);
  setThemePreference('light');expect(changes).toBe(1);expect(e.storage.values.get(THEME_STORAGE_KEY)).toBe('light');unsubscribe();setThemePreference('dark');expect(changes).toBe(1);
 });
 it('matches the browser toolbar to the chosen theme without changing gameplay preferences',()=>{
  const e=environment(),values=new Map<string,string>();
  Object.assign(document,{querySelector:()=>({setAttribute:(key:string,value:string)=>values.set(key,value)})});
  initializeTheme();expect(values.get('content')).toBe('#ffffff');
  setThemePreference('dark');expect(values.get('content')).toBe('#111417');
  setThemePreference('light');expect(values.get('content')).toBe('#ffffff');
  expect(e.storage.writes.every(write=>write.key===THEME_STORAGE_KEY)).toBe(true);
 });
 it('follows live system changes only in system mode and keeps explicit dark independent',()=>{
  const e=environment({preference:'system'});initializeTheme();let changes=0;const unsubscribe=subscribeTheme(()=>changes++);
  e.media.change(true);expect(getThemeState().resolved).toBe('dark');expect(e.attrs.get('data-theme-preference')).toBe('system');expect(changes).toBe(1);
  setThemePreference('dark');const before=getThemeState();e.media.change(false);expect(getThemeState()).toBe(before);expect(e.attrs.get('data-theme')).toBe('dark');unsubscribe();
 });
 it('works with denied storage, absent system API and malformed saved data',()=>{
  const e=environment({preference:'<script>dark</script>',blocked:true,supported:false});initializeTheme();
  expect(getThemeState()).toEqual({preference:'light',resolved:'light',systemAvailable:false});setThemePreference('dark');expect(e.attrs.get('data-theme')).toBe('dark');
  setThemePreference('system');expect(getThemeState().resolved).toBe('light');expect(e.attrs.get('data-theme-preference')).toBe('system');
  const state=getThemeState();expect(()=>setThemePreference('unsafe' as never)).toThrow('Unsupported interface theme');expect(getThemeState()).toBe(state);
 });
 it('applies sibling-tab changes and clears without writing back or touching other keys',()=>{
  const e=environment();e.storage.values.set('tactical-aim-settings-v1','retained');initializeTheme();
  const send=(key:string|null,newValue:string|null)=>{const event=new Event('storage');Object.defineProperties(event,{key:{value:key},newValue:{value:newValue}});e.win.dispatchEvent(event);};
  send('tactical-aim-settings-v1','dark');expect(getThemeState().resolved).toBe('light');send(THEME_STORAGE_KEY,'dark');expect(getThemeState().resolved).toBe('dark');
  send(null,null);expect(getThemeState().preference).toBe('light');expect(e.storage.writes).toEqual([]);expect(e.storage.values.get('tactical-aim-settings-v1')).toBe('retained');
 });
 it('releases system/storage event listeners when the presentation shell is disposed',()=>{
  const e=environment({preference:'system'});initializeTheme();const before=getThemeState();disposeTheme();e.media.change(true);
  const event=new Event('storage');Object.defineProperties(event,{key:{value:THEME_STORAGE_KEY},newValue:{value:'dark'}});e.win.dispatchEvent(event);expect(getThemeState()).toBe(before);
 });
 it('supports legacy media listeners and denied live observation without blocking theme selection',()=>{
  const e=environment({preference:'system'});let handler:((event:{matches:boolean})=>void)|null=null,removed=false;
  e.win.matchMedia=()=>({matches:false,addListener:(listener:typeof handler)=>{handler=listener;},removeListener:()=>{removed=true;}} as unknown as MediaQueryList);
  initializeTheme();expect(handler).not.toBeNull();(handler as unknown as (event:{matches:boolean})=>void)({matches:true});expect(getThemeState().resolved).toBe('dark');disposeTheme();expect(removed).toBe(true);
  e.win.matchMedia=()=>({matches:true,addEventListener:()=>{throw new Error('Observer denied');}} as unknown as MediaQueryList);
  expect(()=>initializeTheme()).not.toThrow();expect(getThemeState().resolved).toBe('dark');setThemePreference('light');expect(getThemeState().resolved).toBe('light');
 });
 it('renders Korean accessible controls safely without a browser document',()=>{
  const html=renderToStaticMarkup(<ThemeSelector/>);expect(html).toContain('aria-label="화면 테마"');expect(html).toContain('밝은 테마');expect(html).toContain('어두운 테마');expect(html).toContain('시스템 설정');
  expect((html.match(/aria-pressed="true"/g)??[]).length).toBe(1);expect((html.match(/type="button"/g)??[]).length).toBe(3);
 });
 it('keeps actual training state, settings identity and replay outcome unchanged across theme choices',async()=>{
  const e=environment(),settings=structuredClone(DEFAULT_SETTINGS),s=new Simulation('free','rifleA',settings),recorder=new ReplayRecorder(s);initializeTheme();s.running=true;
  for(let n=0;n<180;n++)s.step(1/120,{...emptyInput(),forward:n<60?1:0,fire:n===160,firePresses:n===160?1:0});
  const before=simulationChecksum(s),identity=s.settings;
  for(const preference of ['dark','system','light'] as const){setThemePreference(preference);e.media.change(true);expect(simulationChecksum(s)).toBe(before);expect(s.settings).toBe(identity);}
  expect(e.storage.writes.every(write=>write.key===THEME_STORAGE_KEY)).toBe(true);const replay=recorder.finish()!;expect((await new ReplayPlayer(replay).verify()).passed).toBe(true);
 });
 it('executes the exact head bootstrap before React with the same light/dark/system resolution',()=>{
  for(const [preference,dark,expected] of [[null,true,'light'],['dark',false,'dark'],['system',true,'dark'],['system',false,'light'],['invalid',true,'light']] as const){
   const attrs=new Map<string,string>();runInNewContext(THEME_BOOTSTRAP_SCRIPT,{localStorage:{getItem:()=>preference},window:{matchMedia:()=>({matches:dark})},document:{documentElement:{setAttribute:(key:string,value:string)=>attrs.set(key,value)}}});
   expect(attrs.get('data-theme')).toBe(expected);expect(attrs.get('data-theme-preference')).toBe(preference==='dark'||preference==='system'?preference:'light');
  }
 });
});

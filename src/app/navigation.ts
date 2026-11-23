import type { Screen } from './store';
export const TAB_PATHS = { training: '/', maps:'/maps.html', settings: '/settings.html', history: '/statistics.html', weapons:'/weapons.html',stream:'/unreal.html',aim:'/aim.html',tools:'/tools.html' } as const;
export function parseRoute(pathname: string): { screen: Screen; activeTab: keyof typeof TAB_PATHS } {
  const path = pathname.replace(/\/+$/, '').replace(/\.html$/, '') || '/';
  if (path === '/training') return { screen: 'training', activeTab: 'training' };
  if (path === '/maps') return { screen: 'menu', activeTab: 'maps' };
  if (path === '/tools') return { screen: 'menu', activeTab: 'tools' };
  if (path === '/aim') return { screen: 'menu', activeTab: 'aim' };
  if (path === '/settings') return { screen: 'menu', activeTab: 'settings' };
  if (path === '/statistics') return { screen: 'menu', activeTab: 'history' };
  if (path === '/weapons') return { screen: 'menu', activeTab: 'weapons' };
  if (path === '/unreal') return { screen: 'menu', activeTab: 'stream' };
  return { screen: 'menu', activeTab: 'training' };
}
export const LOCATION_CHANGED = 'valoprac:location-change';

export function navigate(path: string, replace = false) {
  if (typeof window === 'undefined') return;
  const {pathname, search, hash} = window.location;
  if (pathname + search + hash === path) return;
  try {
    if (replace) window.history.replaceState(window.history.state, '', path);
    else window.history.pushState(null, '', path);
  } catch {
    return;
  }
  window.dispatchEvent(new Event(LOCATION_CHANGED));
}

/** Preserve browser link behaviors for modified, auxiliary and external clicks. */
export function shouldNavigateLocally(event:{button:number;metaKey:boolean;ctrlKey:boolean;shiftKey:boolean;altKey:boolean;defaultPrevented:boolean}){
 return event.button===0&&!event.metaKey&&!event.ctrlKey&&!event.shiftKey&&!event.altKey&&!event.defaultPrevented;
}

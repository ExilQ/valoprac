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
export function navigate(path: string) {
  if (typeof window === 'undefined') return;
  try { if (window.location.pathname !== path) window.history.pushState(null, '', path); }
  catch { /* Navigation remains usable when browser history access is denied. */ }
}

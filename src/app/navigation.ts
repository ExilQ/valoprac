import type { Screen } from './store';
export const TAB_PATHS = { training: '/', settings: '/settings', history: '/statistics' } as const;
export function parseRoute(pathname: string): { screen: Screen; activeTab: 'training' | 'settings' | 'history' } {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (path === '/training') return { screen: 'training', activeTab: 'training' };
  if (path === '/settings') return { screen: 'menu', activeTab: 'settings' };
  if (path === '/statistics') return { screen: 'menu', activeTab: 'history' };
  return { screen: 'menu', activeTab: 'training' };
}
export function navigate(path: string) {
  if (typeof window === 'undefined') return;
  try { if (window.location.pathname !== path) window.history.pushState(null, '', path); }
  catch { /* Navigation remains usable when browser history access is denied. */ }
}

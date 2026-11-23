import { useEffect } from 'react';
import { parseRoute } from './navigation';
import { useApp } from './store';
export function useNavigation() {
  useEffect(() => {
    const sync = () => {
      if (document.pointerLockElement) document.exitPointerLock();
      useApp.setState({ ...parseRoute(window.location.pathname), locked: false, paused: true });
    };
    sync();
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);
}

const KEY = 'valoprac-chunk-reload';
export function installDeploymentRecovery() {
  const onPreloadError = (event: Event) => {
    // A new deployment can remove an old lazy-chunk URL. Retry at most once per minute.
    try {
      const previous = Number(sessionStorage.getItem(KEY) || 0);
      if (Date.now() - previous < 60_000) return;
      sessionStorage.setItem(KEY, String(Date.now()));
      event.preventDefault();
      window.location.reload();
    } catch { /* React's error boundary remains available when storage is blocked. */ }
  };
  window.addEventListener('vite:preloadError', onPreloadError);
  return () => window.removeEventListener('vite:preloadError', onPreloadError);
}

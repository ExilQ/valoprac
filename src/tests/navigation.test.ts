import { describe, it, expect } from 'vitest';
import { parseRoute } from '../app/navigation';
describe('Production SPA route restoration', () => {
  it('restores the training start screen from a direct training URL', () => { expect(parseRoute('/training')).toEqual({ screen: 'training', activeTab: 'training' }); });
  it('restores settings and statistics after refresh', () => {
    expect(parseRoute('/settings/')).toEqual({ screen: 'menu', activeTab: 'settings' });
    expect(parseRoute('/statistics')).toEqual({ screen: 'menu', activeTab: 'history' });
  });
  it('returns to a usable menu when a result has no in-memory session', () => { expect(parseRoute('/results').screen).toBe('menu'); expect(parseRoute('/unknown').activeTab).toBe('training'); });
});

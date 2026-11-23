import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../config/settings';
import { summarize } from '../training/analytics/statistics';
import type { SessionData, ShotEvent } from '../engine/types';
import { reviewLabPayload, reviewLabSession, reviewLabSessionURL } from '../ui/reviewLabTransfer';

function session(shots: ShotEvent[] = []): SessionData {
  const tracking = { samples: 0, onHead: 0, errorSquared: 0 };
  const reactions = [{ targetId: 0, changeTime: 0, latency: .3 }];
  return { id: 'some-session', createdAt: Date.UTC(2026, 10, 22), duration: 10, seed: 1,
    settings: { ...DEFAULT_SETTINGS, practiceMap: 'range' }, weapon: 'rifleA', mode: 'braking',
    shots, kills: [], reactions, tracking, summary: summarize(shots, [], reactions, tracking) };
}

describe('Review Lab transfer', () => {
  it('sends only summary fields and puts the transfer in the address fragment', () => {
    const row = session();
    const url = new URL(reviewLabSessionURL(row));
    expect(url.origin).toBe('https://valoprac-review-lab.thatglezoa.chatgpt.site');
    expect(url.search).toBe('');
    const payload = JSON.parse(decodeURIComponent(url.hash.slice('#import='.length)));
    expect(payload).toMatchObject({ schema: 1, source: 'valoprac.trade', sessions: [{ id: row.id, mode: 'movement' }] });
    expect(payload.sessions[0]).not.toHaveProperty('settings');
    expect(payload.sessions[0]).not.toHaveProperty('shots');
    expect(reviewLabPayload([row])).not.toContain('reactions');
  });
  it('uses headshots per hit and retains null for measurements with no observations', () => {
    const row = session();
    Object.assign(row.summary, { shots: 20, heads: 4, bodies: 5, limbs: 1 });
    row.drill = { attempts: 10, successes: 7, early: 3, wrongDirection: 0, lastSpeed: 0, lastWindow: null };
    expect(reviewLabSession(row).metrics).toEqual({
      accuracy: 50, headshot: 40, reaction: 300, exposure: null, first: null, moving: null, brake: 70, rotation: null,
    });
  });
});

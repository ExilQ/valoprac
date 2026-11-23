import type { SessionData } from '../engine/types';
import { selectedTraining } from '../app/trainingNavigation';
import { WEAPONS } from '../config/weapons';
import { trainingMapTitle, trainingTitle } from './trainingPresentation';

export const REVIEW_LAB_URL = 'https://valoprac.trade/review/';

const hit = (zone: string) => ['head', 'torso', 'arm', 'leg'].includes(zone);
const rate = (count: number, total: number) => total > 0 ? 100 * count / total : null;
const average = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
const milliseconds = (seconds: number[]) => average(seconds.map(value => value * 1000));

export function reviewLabSession(session: SessionData) {
  const { summary, shots } = session;
  const first = shots.filter(shot => shot.firstShot);
  const moving = shots.filter(shot => Math.hypot(shot.velocity.x, shot.velocity.z) > .1)
    .map(shot => shot.angularError).filter((value): value is number => value != null && Number.isFinite(value));
  const combat = session.peeking?.combatSummary;
  const task = selectedTraining(session.mode, session.settings);
  const mode = session.sessionOptions?.scenario || task === 'tactical' || task === 'vertical' ? 'peeking' :
    task === 'braking' || task === 'bunny' ? 'movement' :
    task === 'free' || task === 'wallbang' ? (session.sessionOptions?.exercise ? 'timed' : 'free') : 'timed';
  return {
    id: session.id,
    createdAt: session.createdAt,
    title: trainingTitle(session.mode, session.settings, session.sessionOptions),
    mode,
    map: trainingMapTitle(session.settings),
    weapon: WEAPONS[session.weapon].name,
    metrics: {
      accuracy: rate(summary.heads + summary.bodies + summary.limbs, summary.shots),
      headshot: rate(summary.heads, summary.heads + summary.bodies + summary.limbs),
      reaction: milliseconds(summary.reactionTimes),
      exposure: milliseconds(session.peeking?.episodes.map(episode => episode.duration) ?? []),
      first: combat?.firstShots ? rate(combat.firstHits, combat.firstShots) : rate(first.filter(shot => hit(shot.hit)).length, first.length),
      moving: average(moving),
      brake: session.drill ? rate(session.drill.successes, session.drill.attempts) : null,
      rotation: null,
    },
  };
}

export function reviewLabPayload(sessions: readonly SessionData[]) {
  return JSON.stringify({ schema: 1, source: 'valoprac.trade', sessions: sessions.map(reviewLabSession) });
}

export function reviewLabSessionURL(session: SessionData) {
  return REVIEW_LAB_URL + '#import=' + encodeURIComponent(reviewLabPayload([session]));
}

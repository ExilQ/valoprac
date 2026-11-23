import { METRICS, MODES, localDate } from './model.js';

export const MAX_IMPORT_BYTES = 180_000;
const modes = new Map([['free', MODES[0]], ['timed', MODES[1]], ['peeking', MODES[2]], ['movement', MODES[3]]]);
const asText = (input, length) => typeof input === 'string' && input.trim() && input.length <= length;
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);

export function parseTransfer(text) {
  if (typeof text !== 'string' || new TextEncoder().encode(text).length > MAX_IMPORT_BYTES) {
    throw new Error('가져올 파일이 너무 큽니다.');
  }
  let parsed;
  try { parsed = JSON.parse(text); }
  catch { throw new Error('JSON 파일을 읽을 수 없습니다.'); }
  if (parsed?.schema !== 1 || parsed.source !== 'valoprac.trade' ||
      !Array.isArray(parsed.sessions) || parsed.sessions.length < 1 || parsed.sessions.length > 40) {
    throw new Error('VALOPRAC의 복기 연구실용 파일을 선택하세요.');
  }
  const seen = new Set();
  return parsed.sessions.flatMap(session => {
    if (!object(session) || !asText(session.id, 160) || !asText(session.title, 100) || !modes.has(session.mode) ||
        !asText(session.map, 50) || !asText(session.weapon, 50) || !object(session.metrics) ||
        !Number.isInteger(session.createdAt) || session.createdAt < Date.UTC(2000, 0, 2) || session.createdAt >= Date.UTC(2100, 11, 30)) {
      throw new Error('가져올 훈련 기록의 형식이 올바르지 않습니다.');
    }
    const id = 'valoprac:' + session.id;
    if (seen.has(id)) return [];
    seen.add(id);
    const metrics = Object.fromEntries(METRICS.map(metric => {
      const value = session.metrics[metric.key];
      const limit = metric.unit === '%' ? 100 : metric.unit === '°' ? 180 : 600000;
      if (value == null) return [metric.key, null];
      if (!Number.isFinite(value) || value < 0 || value > limit) throw new Error('측정값의 범위를 확인해 주세요.');
      return [metric.key, value];
    }));
    const date = new Date(session.createdAt);
    const utcWithLocalTime = new Date(+date - date.getTimezoneOffset() * 60_000);
    return [{
      id, source: 'valoprac.trade', when: localDate(date) + 'T' + utcWithLocalTime.toISOString().slice(11, 16),
      mode: modes.get(session.mode), title: session.title, map: session.map, weapon: session.weapon,
      agent: '', distance: null, scene: [], issues: [], followUp: [], metrics, notes: ''
    }];
  });
}

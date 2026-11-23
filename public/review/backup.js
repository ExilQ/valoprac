import { METRICS, MODES } from './model.js';

export const MAX_BACKUP_BYTES = 5 * 1024 * 1024;
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = (value, max) => typeof value === 'string' && value.length <= max;
const number = (value, min, max) => Number.isFinite(value) && value >= min && value <= max;
const date = (value, timed = false) => {
  if (!text(value, 16)) return false;
  const match = /^(\d{4}-\d{2}-\d{2})(?:T(?:[01]\d|2[0-3]):[0-5]\d)?$/.exec(value);
  if (!match || timed !== (value.length === 16) || !Number.isFinite(Date.parse(match[1]))) return false;
  return new Date(match[1]).toISOString().slice(0, 10) === match[1] && match[1] >= '2000-01-01' && match[1] <= '2100-12-31';
};
const tags = value => Array.isArray(value) && value.length <= 20 && value.every(tag => text(tag, 500) && tag.trim());
const requireValue = (condition, message = '백업 파일에 올바르지 않은 기록이 있습니다.') => {
  if (!condition) throw new Error(message);
};

// Parse only exports made by the Review Lab. Never insert unchecked backup objects into storage.
export function readBackup(value) {
  requireValue(plain(value) && value.schema === 1 && value.demo === false && Array.isArray(value.records),
    '복기 연구실의 내 기록에서 내보낸 JSON을 선택하세요.');
  const records = [];
  const ids = new Set();
  for (const row of value.records) {
    requireValue(plain(row) && text(row.id, 170) && row.id.trim() && date(row.when, true) &&
      MODES.includes(row.mode) && text(row.title, 100) && row.title.trim() &&
      [row.map, row.agent, row.weapon].every(value => text(value, 50)) &&
      (row.distance === null || number(row.distance, 0, 1000)) && tags(row.scene) && tags(row.issues) &&
      tags(row.followUp ?? []) && text(row.notes, 4000) && plain(row.metrics));
    if (ids.has(row.id)) continue;
    ids.add(row.id);
    const metrics = Object.fromEntries(METRICS.map(metric => {
      const limit = metric.unit === '%' ? 100 : metric.unit === '°' ? 180 : 600000;
      const n = row.metrics[metric.key] ?? null;
      requireValue(n === null || number(n, 0, limit));
      return [metric.key, n];
    }));
    records.push({
      id: row.id, when: row.when, mode: row.mode, title: row.title,
      map: row.map, agent: row.agent, weapon: row.weapon, distance: row.distance,
      scene: row.scene, issues: row.issues, followUp: row.followUp ?? [], notes: row.notes, metrics,
      ...(row.source === 'valoprac.trade' ? { source: row.source } : {})
    });
  }
  const { profile } = value;
  requireValue(plain(profile) && Number.isInteger(profile.dpi) && number(profile.dpi, 1, 100000) &&
    number(profile.sensitivity, .0001, 100) && text(profile.style, 200) && profile.style.trim(), '백업의 플레이 프로필을 확인해 주세요.');
  const rules = {};
  for (const [tagName, rule] of Object.entries(plain(value.rules) ? value.rules : {})) {
    requireValue(text(tagName, 500) && plain(rule) && METRICS.some(metric => metric.key === rule.metric) && MODES.slice(0, 4).includes(rule.mode),
      '백업의 문제별 훈련 설정을 확인해 주세요.');
    Object.defineProperty(rules, tagName, { value: { metric: rule.metric, mode: rule.mode }, enumerable: true });
  }
  const goals = Object.create(null);
  for (const [key, target] of Object.entries(plain(value.goals) ? value.goals : {})) {
    let pair;
    try { pair = JSON.parse(key); } catch { pair = null; }
    requireValue(Array.isArray(pair) && pair.length === 2 && date(pair[0]) && text(pair[1], 500) &&
      Number.isInteger(target) && number(target, 1, 99), '백업의 주간 목표를 확인해 주세요.');
    goals[JSON.stringify(pair)] = target;
  }
  return { records, profile: { dpi: profile.dpi, sensitivity: profile.sensitivity, style: profile.style }, rules, goals };
}

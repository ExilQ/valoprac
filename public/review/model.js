export const MODES = ['자유 훈련', '시간제 훈련', '각체크·피킹', '무빙', '실전 복기'];
export const REVIEW = MODES[4];
export const PROFILE = { dpi: 800, sensitivity: .36, style: '빠른 템포의 좌우 스트레이핑 · 한 발씩 끊어 쏘기' };

export const METRICS = [
  { key: 'accuracy', name: '명중률', unit: '%', up: true, step: 3 },
  { key: 'headshot', name: '헤드샷 비율', unit: '%', up: true, step: 3 },
  { key: 'reaction', name: '반응시간', unit: 'ms', up: false, step: 20 },
  { key: 'exposure', name: '노출시간', unit: 'ms', up: false, step: 40 },
  { key: 'first', name: '첫발 정확도', unit: '%', up: true, step: 3 },
  { key: 'moving', name: '이동 중 사격 오차', unit: '°', up: false, step: .1 },
  { key: 'brake', name: '톡브레이킹 성공률', unit: '%', up: true, step: 3 },
  { key: 'rotation', name: '회전·맵 운영 판단', unit: '%', up: true, step: 5 }
];
export const PRESETS = {
  '과다 노출': ['exposure', MODES[2], '같은 각에서 짧게 정보만 확인하고 엄폐로 복귀하세요.'],
  '첫발 빗나감': ['first', MODES[1], '같은 거리에서 정지 후 한 발씩 쏘고 첫발 명중 여부를 기록하세요.'],
  '조준선 낮음': ['headshot', MODES[2], '모서리에 들어가기 전 서 있는 표적의 머리 높이에 조준선을 두세요.'],
  '이동 중 사격': ['moving', MODES[3], '좌우로 이동한 뒤 정지와 사격을 한 번씩 연결하세요.'],
  '톡브레이킹 실패': ['brake', MODES[3], '좌우 방향별로 브레이킹 후 첫발을 기록하세요.'],
  '늦은 반응': ['reaction', MODES[1], '같은 거리의 등장 표적에 한 발씩 반응하세요.'],
  '명중률 저하': ['accuracy', MODES[0], '대상과 거리를 고정해 한 발씩 쏘고 명중률을 기록하세요.'],
  '회전 판단 지연': ['rotation', MODES[2], '각체크 동선을 두 가지로 나눠 연습하고, 회전 결정을 바꿀 정보와 대안을 기록하세요.']
};
export const STATUS = { recurring: '반복되는 실수', stalled: '미개선', improved: '개선됨', pending: '추가 관측' };
export const MAPS = ['어센트', '헤이븐', '바인드', '스플릿', '로터스', '선셋', '아이스박스', '어비스', '프랙처', '브리즈', '펄', '코로드', '훈련장'];
export const AGENTS = ['제트', '레이나', '피닉스', '레이즈', '네온', '요루', '아이소', '웨이레이', '사이퍼', '킬조이', '세이지', '체임버', '데드록', '소바', '스카이', '케이/오', '페이드', '게코', '브리치', '오멘', '아스트라', '브림스톤', '클로브', '바이퍼', '하버'];
export const WEAPONS = ['밴달', '팬텀', '셰리프', '오퍼레이터', '고스트', '가디언', '스펙터', '클래식', '아웃로', '마샬'];
export const cleanTags = (value) => [...new Set(value.split(/[,，\n]/).map(tag => tag.trim().replace(/^#/, '')).filter(Boolean))].slice(0, 20);
export function localDate(date = new Date()) {
  return new Date(+date - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}
export function day(date, offset) {
  const value = new Date(date + 'T12:00');
  value.setDate(value.getDate() + offset);
  return localDate(value);
}
export const datePart = row => row.when.slice(0, 10);
export const ordered = rows => [...rows].sort((a, b) => a.when.localeCompare(b.when) || a.id.localeCompare(b.id));
export const between = (rows, from, to) => rows.filter(row => (!from || datePart(row) >= from) && (!to || datePart(row) <= to));
export const isReview = row => row.mode === REVIEW;
export const follows = row => row.followUp ?? [];
export const mean = (rows, key) => {
  const values = rows.map(row => row.metrics[key]).filter(Number.isFinite);
  return { value: values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null, count: values.length };
};
export const number = (n, digits = 1) => n?.toLocaleString('ko-KR', { maximumFractionDigits: digits }) ?? '—';
export const valueText = (n, metric) => n == null ? '—' : number(n, 2) + (metric.unit === '%' || metric.unit === '°' ? '' : ' ') + metric.unit;
export const deltaText = (n, m) => n == null ? '—' : (n > 0 ? '+' : '') + number(n, 2) + (m.unit === '%' ? '%p' : ' ' + m.unit);
export const weekStart = (date) => day(date, -((new Date(date + 'T12:00').getDay() + 6) % 7));
export function goalKey(week, tag) { return JSON.stringify([week, tag]); }

export function filterRows(rows, filters, includeIssue = true) {
  const query = (filters.query ?? '').trim().toLocaleLowerCase('ko-KR');
  return rows.filter(row => (!filters.mode || row.mode === filters.mode) &&
    (!filters.map || row.map === filters.map) && (!filters.agent || row.agent === filters.agent) &&
    (!filters.weapon || row.weapon === filters.weapon) && (!filters.scene || row.scene.includes(filters.scene)) &&
    (!filters.distance || (row.distance !== null && (filters.distance === 'close' ? row.distance < 15 : filters.distance === 'mid' ? row.distance >= 15 && row.distance < 30 : row.distance >= 30))) &&
    (!includeIssue || !filters.issue || (row.issues.includes(filters.issue) || follows(row).includes(filters.issue))) &&
    (!query || [row.title, row.notes, row.mode, row.map, row.agent, row.weapon, ...row.scene, ...row.issues, ...follows(row)].join(' ').toLocaleLowerCase('ko-KR').includes(query)));
}

// The comparison uses untagged follow-up reviews with comparable recorded context.
// Missing context requires an explicit link to avoid counting unrelated matches.
function sameContext(a, b) {
  const sameFields = ['map', 'weapon', 'agent'].filter(key => a[key] && b[key]);
  if (sameFields.some(key => a[key] !== b[key])) return false;
  if (a.distance != null && b.distance != null && Math.abs(a.distance - b.distance) > 5) return false;
  if (a.scene.length && b.scene.length && !a.scene.some(tag => b.scene.includes(tag))) return false;
  return sameFields.length >= 2 || (sameFields.length >= 1 && a.scene.some(tag => b.scene.includes(tag)));
}
export function issueStats(allRows, scopeRows, rules, observationStart = '', anchorEligible = () => true) {
  const chronological = ordered(allRows);
  const reviews = chronological.filter(isReview);
  const scope = ordered(scopeRows);
  const tags = [...new Set(reviews.flatMap(row => row.issues))];
  return tags.flatMap(tag => {
    const related = reviews.filter(row => row.issues.includes(tag));
    const anchor = related[0];
    const relevant = row => row.issues.includes(tag) || follows(row).includes(tag) || sameContext(anchor, row);
    const scopedTagged = scope.filter(row => row.issues.includes(tag));
    const scopedReviews = scope.filter(row => isReview(row) && relevant(row) && row.when >= anchor.when);
    if (!scopedTagged.length && !scopedReviews.length) return [];
    const [defaultMetric, mode, advice] = Object.hasOwn(PRESETS, tag) ? PRESETS[tag] : ['first', MODES[0], '실전에서 문제를 기록한 거리와 상황을 재현해 연습하세요.'];
    const rule = Object.hasOwn(rules, tag) ? rules[tag] : null;
    const metric = METRICS.find(m => m.key === rule?.metric) ?? METRICS.find(m => m.key === defaultMetric);
    const training = chronological.filter(row => !isReview(row) && row.issues.includes(tag) && row.when > anchor.when);
    const first = training[0]?.when;
    const repeats = scopedTagged.filter(isReview).length;
    const baseline = first ? scopedReviews.filter(row => row.when < first) : [];
    // Keep the discovery itself visible even when it predates the selected window.
    if (first && anchor.when < first && datePart(anchor) < observationStart && anchorEligible(anchor) && !baseline.some(row => row.id === anchor.id)) baseline.unshift(anchor);
    const after = first ? scopedReviews.filter(row => row.when > first) : [];
    const beforeMean = mean(baseline, metric.key), afterMean = mean(after, metric.key);
    const change = beforeMean.count && afterMean.count ? afterMean.value - beforeMean.value : null;
    const enough = beforeMean.count >= 2 && afterMean.count >= 2;
    const improved = enough && (metric.up ? change : -change) >= metric.step;
    const afterDesc = [...after].reverse();
    const reappears = afterDesc.slice(0, 2).filter(row => row.issues.includes(tag)).length >= 2;
    const status = improved && !reappears ? 'improved' : repeats >= 2 && (!enough || reappears) ? 'recurring' : enough ? 'stalled' : 'pending';
    const rank = { recurring: 4, stalled: 3, pending: 2, improved: 1 }[status] * 100 + Math.min(50, repeats * 5) + Number(reappears) * 10;
    return [{ tag, anchor, repeats, training, scopedTraining: scopedTagged.filter(row => !isReview(row) && row.when > anchor.when),
      before: beforeMean, after: afterMean, afterRows: after, baseline, change, metric, mode: rule?.mode ?? mode,
      advice: status === 'improved' ? '다음 실전에서 같은 상황을 한 번 더 복기해 개선이 유지되는지 확인하세요.' :
        rule?.mode && rule.mode !== mode ? '선택한 훈련에서 문제를 발견한 교전 거리와 상황을 재현해 보세요.' : advice,
      status, rank, enough, reappears }];
  }).sort((a, b) => b.rank - a.rank || b.anchor.when.localeCompare(a.anchor.when));
}

export function demoData(today) {
  const ago = n => day(today, -n);
  const make = (id, days, mode, title, issues, values) => ({
    id: 'demo-' + id, when: ago(days) + 'T20:00', mode, title, map: '어센트', agent: '제트', weapon: '밴달',
    distance: 20, scene: ['중거리', '첫 교전'], issues, notes: '', metrics: Object.fromEntries(METRICS.map(({ key }, i) => [key, values[i]]))
  });
  return [
    make(13, 42, REVIEW, '지난 기간 미드 교전 복기', [], [31, 16, 420, 1050, 38, 1.82, 51, 41]),
    make(14, 35, REVIEW, '지난 기간 A 메인 복기', [], [34, 21, 390, 960, 44, 1.71, 53, 49]),
    make(1, 21, REVIEW, '미드 첫 교전 복기', ['과다 노출', '첫발 빗나감', '이동 중 사격'], [32, 18, 385, 980, 39, 1.7, 53, 45]),
    make(2, 19, REVIEW, '수비 미드 재교전', ['과다 노출'], [37, 24, 367, 910, 40, 1.6, 55, 50]),
    make(3, 17, MODES[2], '미드 숄더 피킹 반복', ['과다 노출'], [52, 33, 315, 595, 56, 1.1, 70, 64]),
    make(4, 15, MODES[1], '중거리 첫발 세트', ['첫발 빗나감'], [54, 37, 302, 590, 60, 1.0, 70, 62]),
    make(5, 13, REVIEW, 'A 진입 첫 교전', ['첫발 빗나감'], [41, 29, 355, 754, 50, 1.4, 62, 56]),
    make(6, 11, MODES[0], '정지 후 한 발씩 사격', ['첫발 빗나감'], [57, 43, 292, 555, 65, .9, 71, 67]),
    make(7, 8, MODES[2], '미드 각쪼개기 세트', ['과다 노출'], [60, 45, 281, 505, 69, .8, 76, 72]),
    make(8, 6, REVIEW, '미드 노출 깊이 점검', ['과다 노출', '이동 중 사격'], [48, 33, 333, 748, 54, 1.6, 65, 61]),
    make(9, 4, MODES[3], '좌우 톡브레이킹', ['이동 중 사격'], [65, 49, 270, 485, 72, .77, 80, 74]),
    make(10, 2, REVIEW, 'A 메인 첫발 점검', ['과다 노출'], [51, 38, 318, 735, 64, 1.55, 67, 64]),
    make(11, 1, MODES[2], '미드 짧은 각체크', ['과다 노출'], [67, 52, 260, 450, 77, .67, 84, 77]),
    make(12, 0, REVIEW, '어센트 실전 복기', ['과다 노출', '이동 중 사격'], [57, 44, 301, 721, 69, 1.57, 69, 71])
  ];
}

export function toCSV(rows) {
  const csv = value => {
    const raw = String(value ?? '');
    const safe = typeof value === 'string' && /^[\s]*[=+\-@]/.test(raw) ? "'" + raw : raw;
    return '"' + safe.replace(/"/g, '""') + '"';
  };
  const headers = ['일시', '유형', '제목', '맵', '요원', '무기', '거리(m)', '상황 태그', '문제 태그', '후속 비교 태그', ...METRICS.map(m => m.name + '(' + m.unit + ')'), '메모'];
  return '\ufeff' + [headers, ...rows.map(row => [row.when, row.mode, row.title, row.map, row.agent, row.weapon, row.distance, row.scene.join(', '), row.issues.join(', '), follows(row).join(', '), ...METRICS.map(m => row.metrics[m.key]), row.notes])].map(fields => fields.map(csv).join(',')).join('\r\n');
}

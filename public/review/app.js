import { parseTransfer } from './transfer.js';
import { readBackup, MAX_BACKUP_BYTES } from './backup.js';
import { MODES, REVIEW, PROFILE, METRICS, PRESETS, STATUS, MAPS, AGENTS, WEAPONS, cleanTags, localDate, day,
  datePart, ordered, between, isReview, follows, mean, number, valueText, deltaText, weekStart, goalKey, filterRows, issueStats, demoData, toCSV } from './model.js';

const STORE = 'valoprac-review-lab-v1';
const emptyState = () => ({ schema: 1, profile: { ...PROFILE }, records: [], goals: {}, rules: {}, started: false });
function load() {
  try {
    const contents = localStorage.getItem(STORE);
    const saved = contents ? JSON.parse(contents) : null;
    return saved?.schema === 1 && Array.isArray(saved.records) ? { ...emptyState(), ...saved } : emptyState();
  } catch { return emptyState(); }
}
let candidates = [], backup = null;
let data = load(), demo = !data.started, filter = {}, today = localDate(), range = '30', customFrom = day(today, -29), customTo = today;
let metricKey = 'first', issueTag = '', chartObserver, toastTimer, sort = 'newest', page = 1;
const names = { overview: '대시보드', records: '세션 기록', issues: '문제 분석', weekly: '주간 계획' };
const $ = id => document.getElementById(id);
const view = $('view'), modal = $('modal');
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const attr = esc;
const fmtDate = s => s ? s.replaceAll('-', '.') : '';
const dateTime = s => fmtDate(s.slice(0, 10)) + ' ' + s.slice(11, 16);
const options = (values, current, empty = '') =>
  (empty ? '<option value="">' + esc(empty) + '</option>' : '') + values.map(item => {
    const [value, label] = Array.isArray(item) ? item : [item, item];
    return '<option value="' + attr(value) + '"' + (value === current ? ' selected' : '') + '>' + esc(label) + '</option>';
  }).join('');
const help = text => '<p class="footnote">' + esc(text) + '</p>';
const pill = (text, kind = '') => '<span class="pill ' + kind + '">' + esc(text) + '</span>';
const button = (label, action, cls = 'secondary', value = '') =>
  '<button type="button" class="button ' + cls + '" data-action="' + action + '" data-value="' + attr(value) + '">' + esc(label) + '</button>';
const empty = (text, action = '') => '<div class="empty"><p>' + esc(text) + '</p>' + (action ? button('기록 추가', action, 'primary') : '') + '</div>';
const currentRoute = () => Object.hasOwn(names, location.hash.slice(1)) ? location.hash.slice(1) : 'overview';
const metricOptions = METRICS.map(m => [m.key, m.name + ' (' + m.unit + ')']);
const records = () => demo ? demoData(today) : data.records;
const rules = () => demo ? {} : data.rules;

function notify(message) {
  const toast = $('toast');
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add('show');
  toastTimer = setTimeout(() => toast.classList.remove('show'), 4200);
}
function write(patch, start = true) {
  const next = { ...data, ...patch, started: start || data.started };
  try { localStorage.setItem(STORE, JSON.stringify(next)); }
  catch { notify('브라우저 저장에 실패했습니다. 저장 권한이나 남은 용량을 확인해 주세요.'); return false; }
  data = next;
  if (start) demo = false;
  return true;
}
function bounds() {
  return range === 'all' ? ['', ''] : range === 'custom' ? [customFrom, customTo] : [day(today, 1 - Number(range)), today];
}
function priorBounds(from, to) {
  if (!from || !to) return [];
  const days = Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1;
  return [day(from, -days), day(from, -1)];
}
function rangeControls() {
  return '<div class="range" aria-label="조회 기간">' + [['7', '최근 7일'], ['30', '최근 30일'], ['all', '전체'], ['custom', '기간 지정']].map(([key, title]) =>
    '<button type="button" data-action="range" data-value="' + key + '" aria-pressed="' + (key === range) + '">' + title + '</button>').join('') + '</div>';
}
function header(title, desc, withRange = true) {
  return '<div class="title-row"><div><h1>' + title + '</h1><p class="lead">' + desc + '</p></div>' + (withRange ? rangeControls() : '') + '</div>' +
    (withRange && range === 'custom' ? '<form id="date-form" class="dates"><label>시작일<input type="date" name="from" required value="' + customFrom + '"></label><label>종료일<input type="date" name="to" required value="' + customTo + '"></label><button class="button secondary">기간 적용</button></form>' : '');
}
function panelHead(title, desc = '', extra = '') {
  return '<div class="panel-head"><div><h2>' + title + '</h2>' + (desc ? '<p class="panel-description">' + desc + '</p>' : '') + '</div>' + extra + '</div>';
}
function unique(rows, key, array = false) {
  return [...new Set(rows.flatMap(row => array ? row[key] : [row[key]]).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ko-KR'));
}
function filterForm(rows, forRecords) {
  const active = Object.values(filter).some(Boolean);
  const select = (key, label, values) => '<label>' + label + '<select name="' + key + '">' + options(values, filter[key], '전체') + '</select></label>';
  return '<form id="filters"><div class="filters"><label class="search">검색<input type="search" name="query" placeholder="제목, 메모, 태그 검색" value="' + attr(filter.query) + '"></label>' +
    (forRecords ? select('mode', '유형', MODES) : '') + select('map', '맵', unique(rows, 'map')) +
    select('agent', '요원', unique(rows, 'agent')) + select('weapon', '무기', unique(rows, 'weapon')) +
    select('distance', '교전 거리', [['close', '근거리 · 15 m 미만'], ['mid', '중거리 · 15–29 m'], ['long', '장거리 · 30 m 이상']]) +
    select('scene', '상황 태그', unique(rows, 'scene', true)) + select('issue', '문제 태그', unique(rows, 'issues', true)) +
    '</div><div class="row-actions"><button class="button secondary" type="submit">필터 적용</button>' +
    (active ? button('초기화', 'reset-filter', 'text') : '') + '</div></form>';
}
function contextFilters(rows) {
  return '<details class="panel context-filters" ' + (Object.entries(filter).some(([k, v]) => k !== 'mode' && v) ? 'open' : '') +
    '><summary>교전 조건으로 비교</summary><div class="details-inner">' + filterForm(rows, false) + '</div></details>';
}
function issueList(issues, current = '') {
  return issues.length ? '<div class="issue-list">' + issues.map((row, i) =>
    '<button class="issue-row" type="button" data-action="issue" data-value="' + attr(row.tag) + '"' + (current === row.tag ? ' aria-current="true"' : '') + '>' +
    '<span class="rank">' + String(i + 1).padStart(2, '0') + '</span><span><strong>' + esc(row.tag) + '</strong><small>발견 ' + row.repeats + '회 · 연결 훈련 ' + row.training.length +
    '회</small></span>' + pill(STATUS[row.status], row.status) + '</button>').join('') + '</div>'
    : empty('문제 태그를 붙인 실전 복기를 추가하면 분석이 시작됩니다.');
}
function table(rows, compact = false) {
  if (!rows.length) return empty('이 조건에 해당하는 기록이 없습니다.', 'add');
  return '<div class="scroll-table" tabindex="0" role="region" aria-label="세션 기록 표"><table><thead><tr>' +
    ['일시', '유형', '세션', '문제 태그', ...(compact ? [] : ['맵 · 요원 · 무기', '교전 거리', '상황 태그', ...METRICS.map(m => m.name)]), ...(demo ? [] : ['관리'])]
      .map(h => '<th scope="col">' + h + '</th>').join('') + '</tr></thead><tbody>' +
    rows.map(row => '<tr><td>' + dateTime(row.when) + '</td><td>' + pill(row.mode, isReview(row) ? 'review' : '') + '</td><td>' +
      '<button type="button" class="table-link" data-action="detail" data-value="' + attr(row.id) + '">' + esc(row.title) + '</button>' +
      (compact && row.map ? '<small>' + esc(row.map) + '</small>' : '') + (row.source ? '<small>VALOPRAC에서 가져옴</small>' : '') + '</td><td>' + esc(row.issues.join(' · ') || '—') + (follows(row).length ? '<small>비교 · ' + esc(follows(row).join(' · ')) + '</small>' : '') + '</td>' +
      (compact ? '' : '<td>' + esc([row.map, row.agent, row.weapon].filter(Boolean).join(' · ') || '—') + '</td><td>' + (row.distance == null ? '—' : number(row.distance) + ' m') +
        '</td><td>' + esc(row.scene.join(' · ') || '—') + '</td>' + METRICS.map(m => '<td>' + valueText(row.metrics[m.key], m) + '</td>').join('')) +
      (demo ? '' : '<td><div class="row-actions">' + button('수정', 'edit', 'text', row.id) + button('삭제', 'delete', 'text', row.id) + '</div></td>') + '</tr>'
    ).join('') + '</tbody></table></div>';
}
function metricTable(inRange, prev, periodLabel) {
  const train = inRange.filter(r => !isReview(r)), review = inRange.filter(isReview), previousTrain = prev.filter(r => !isReview(r)), previousReview = prev.filter(isReview);
  return '<div class="scroll-table" tabindex="0" role="region" aria-label="전체 지표 비교"><table><thead><tr>' +
    ['지표', '훈련 평균', '실전 평균', '훈련 기간 변화', '실전 기간 변화'].map(x => '<th scope="col">' + x + '</th>').join('') +
    '</tr></thead><tbody>' + METRICS.map(m => {
      const t = mean(train, m.key), r = mean(review, m.key), pt = mean(previousTrain, m.key), pr = mean(previousReview, m.key);
      const dt = t.count && pt.count ? t.value - pt.value : null, dr = r.count && pr.count ? r.value - pr.value : null;
      return '<tr><th scope="row">' + m.name + '</th><td>' + valueText(t.value, m) + ' <small>' + t.count + '건</small></td><td>' +
        valueText(r.value, m) + ' <small>' + r.count + '건</small></td><td>' + deltaText(dt, m) + '</td><td>' + deltaText(dr, m) + '</td></tr>';
    }).join('') + '</tbody></table></div>' + help(periodLabel + ' 입력된 값의 세션 평균을 사용합니다.');
}
function overview(rows, inRange, previous, issues, [from, to]) {
  const review = inRange.filter(isReview), train = inRange.filter(r => !isReview(r));
  const prevReview = previous.filter(isReview);
  const cards = METRICS.filter(m => ['first', 'headshot', 'reaction', 'exposure'].includes(m.key)).sort((a, b) => ['first', 'headshot', 'reaction', 'exposure'].indexOf(a.key) - ['first', 'headshot', 'reaction', 'exposure'].indexOf(b.key)).map(m => {
    const current = mean(review, m.key), before = mean(prevReview, m.key);
    const change = current.count && before.count ? current.value - before.value : null;
    const color = change == null || change === 0 ? '' : (m.up ? change > 0 : change < 0) ? 'card-good' : 'card-bad';
    return '<div class="metric-card"><p>실전 ' + m.name + '</p><strong>' + valueText(current.value, m) + '</strong><small class="' + color + '">' +
      (change == null ? current.count + '건 기록' : '이전 기간 대비 ' + deltaText(change, m)) + '</small></div>';
  }).join('');
  const metric = METRICS.find(m => m.key === metricKey), havePoints = inRange.some(row => Number.isFinite(row.metrics[metric.key]));
  const [pf, pt] = priorBounds(from, to);
  const periodLabel = pf ? '비교 기간 ' + fmtDate(pf) + ' ~ ' + fmtDate(pt) + ' (선택 기간과 같은 길이).' : '기간을 선택하면 직전 같은 길이의 기간과 비교합니다.';
  view.innerHTML = header('훈련 효과 대시보드', '훈련에서 바꾼 행동이 실전 지표에 이어졌는지 확인하세요.') + '<div class="metrics">' + cards + '</div>' +
    '<div class="overview-grid"><section class="panel">' + panelHead('훈련 · 실전 지표 추이', from ? fmtDate(from) + ' ~ ' + fmtDate(to) : '전체 기간',
      '<label>표시 지표<select id="chart-metric">' + options(metricOptions, metricKey) + '</select></label>') +
      (havePoints ? '<div class="legend"><span class="key">훈련</span><span class="key review">실전 복기</span></div><div class="chart"><canvas id="trend" role="img" aria-label="' + metric.name + ' 날짜별 훈련과 실전 추이. 데이터는 아래 표에서 확인할 수 있습니다."></canvas><span class="chart-tip" id="chart-tip" hidden></span></div>' : '<div class="inline-empty">선택한 지표 값이 있는 기록이 없습니다.</div>') +
      '<div class="overview-summary"><div><p>훈련 기록</p><strong>' + train.length + '건</strong></div><div><p>실전 복기</p><strong>' + review.length +
      '건</strong></div><div><p>개선된 항목</p><strong>' + issues.filter(issue => issue.status === 'improved').length + '개</strong></div></div>' +
      (havePoints ? '<details><summary>차트 데이터 보기</summary><div class="details-inner scroll-table" tabindex="0"><table><thead><tr><th>일시</th><th>유형</th><th>' +
        metric.name + '</th></tr></thead><tbody>' + ordered(inRange).filter(row => Number.isFinite(row.metrics[metric.key])).map(row => '<tr><td>' + dateTime(row.when) +
          '</td><td>' + esc(row.mode) + '</td><td>' + valueText(row.metrics[metric.key], metric) + '</td></tr>').join('') + '</tbody></table></div></details>' : '') +
      '</section><section class="panel">' + panelHead('약점 우선순위', '반복과 실전 변화에 따라 정렬합니다.', '<a class="button text" href="#issues">전체 보기</a>') +
      issueList(issues.slice(0, 4)) + '</section></div><section class="panel">' + panelHead('최근 세션', '', '<a class="button text" href="#records">기록 보기</a>') +
      table(ordered(inRange).reverse().slice(0, 4), true) + '</section><section class="panel full">' +
      panelHead('기간별 지표 비교', '실전과 훈련은 각각 같은 유형의 직전 기간과 비교합니다.') + metricTable(inRange, previous, periodLabel) +
      '</section>' + contextFilters(rows);
  if (havePoints) drawTrend(inRange, metric);
}

function drawTrend(rows, metric) {
  const canvas = $('trend'), context = canvas.getContext('2d'), tip = $('chart-tip');
  const data = ordered(rows).filter(row => Number.isFinite(row.metrics[metric.key]));
  let plotted = [];
  const dateTicks = [...new Set(data.map(datePart))];
  const start = Date.parse(dateTicks[0]), end = Date.parse(dateTicks.at(-1));
  const values = data.map(row => row.metrics[metric.key]);
  const low = Math.min(...values), high = Math.max(...values);
  const span = Math.max(high - low, metric.step * 2);
  const ymin = Math.max(0, low - span * .12), ymax = metric.unit === '%' ? Math.min(100, Math.max(high + span * .12, ymin + 1)) : Math.max(high + span * .12, ymin + span);
  const colors = ['#156254', '#825574'];
  function draw() {
    const { width, height } = canvas.getBoundingClientRect();
    if (width < 20 || height < 20 || !context) return;
    const pixel = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * pixel); canvas.height = Math.round(height * pixel);
    context.setTransform(pixel, 0, 0, pixel, 0, 0);
    context.font = '12px sans-serif';
    const L = 55, R = width - 16, T = 14, B = height - 24;
    const x = date => start === end ? (L + R) / 2 : L + (Date.parse(date) - start) / (end - start) * (R - L);
    const y = val => B - (val - ymin) / (ymax - ymin) * (B - T);
    for (let i = 0; i <= 4; i++) {
      const val = ymin + (ymax - ymin) * i / 4, h = y(val);
      context.strokeStyle = '#dce5da'; context.lineWidth = 1; context.beginPath(); context.moveTo(L, h); context.lineTo(R, h); context.stroke();
      context.textAlign = 'right'; context.fillStyle = '#4b6257'; context.fillText(valueText(val, metric), L - 7, h + 4);
    }
    const every = Math.ceil(dateTicks.length / (width > 425 ? 6 : 3));
    dateTicks.filter((_, i) => i % every === 0).forEach(date => {
      context.textAlign = 'center'; context.fillText(date.slice(5).replace('-', '.'), x(date), height - 4);
    });
    plotted = [];
    for (const type of [0, 1]) {
      const series = data.filter(row => Number(isReview(row)) === type);
      const pts = series.map(row => ({ row, x: x(datePart(row)), y: y(row.metrics[metric.key]) }));
      plotted.push(...pts);
      context.beginPath(); context.strokeStyle = colors[type]; context.lineWidth = 2.25;
      pts.forEach((pt, i) => i ? context.lineTo(pt.x, pt.y) : context.moveTo(pt.x, pt.y));
      context.stroke();
      for (const pt of pts) {
        context.beginPath(); context.arc(pt.x, pt.y, 3.5, 0, 2 * Math.PI);
        context.fillStyle = colors[type]; context.fill();
      }
    }
  }
  canvas.addEventListener('pointermove', event => {
    const box = canvas.getBoundingClientRect();
    const x = event.clientX - box.left, y = event.clientY - box.top;
    const closest = plotted.map(pt => [pt, Math.hypot(x - pt.x, y - pt.y)]).sort((a, b) => a[1] - b[1])[0];
    tip.hidden = !closest || closest[1] > 24;
    if (!tip.hidden) {
      const row = closest[0].row;
      tip.textContent = fmtDate(datePart(row)) + ' · ' + row.mode + ' ' + valueText(row.metrics[metric.key], metric);
    }
  });
  canvas.addEventListener('pointerleave', () => { tip.hidden = true; });
  chartObserver = new ResizeObserver(draw);
  chartObserver.observe(canvas);
  draw();
}

function recordsPage(rows, inRange) {
  const list = ordered(inRange);
  if (sort === 'newest') list.reverse();
  const limit = 16, pageCount = Math.max(1, Math.ceil(list.length / limit));
  page = Math.min(pageCount, page);
  view.innerHTML = header('세션 기록', '훈련과 실전 복기를 날짜순으로 살펴보고 교전 조건과 문제 태그로 좁혀 보세요.') +
    '<section class="panel">' + filterForm(rows, true) + '</section><section class="panel full">' +
    panelHead('기록 ' + list.length + '건', '', '<label>정렬<select id="sort">' + options([['newest', '최신순'], ['oldest', '오래된순']], sort) + '</select></label>') +
    table(list.slice((page - 1) * limit, page * limit)) +
    (pageCount > 1 ? '<div class="row-actions pagination">' + button('이전', 'page', 'secondary', String(Math.max(1, page - 1))) +
      '<span>' + page + ' / ' + pageCount + '</span>' + button('다음', 'page', 'secondary', String(Math.min(pageCount, page + 1))) + '</div>' : '') + '</section>';
}
function issuesPage(rows, issues) {
  const chosen = issues.find(i => i.tag === issueTag) ?? issues[0];
  if (chosen) issueTag = chosen.tag;
  view.innerHTML = header('문제 분석', '실수의 발견, 연결 훈련, 실전 변화까지 한 흐름으로 확인하세요.') +
    '<div class="issue-layout"><section class="panel">' + panelHead('문제 태그', '반복되는 실수부터 표시합니다.') + issueList(issues, issueTag) +
    '</section>' + (chosen ? issueDetail(chosen) : '<section class="panel">' + empty('실전 복기에 문제 태그를 추가해 보세요.', 'add-review') + '</section>') +
    '</div>' + contextFilters(rows);
}
function issueDetail(i) {
  const counts = (n, suffix = '건') => n + suffix;
  const baselineValue = valueText(i.before.value, i.metric), afterValue = valueText(i.after.value, i.metric), delta = deltaText(i.change, i.metric);
  const stage = i.enough ? (i.reappears ? '최근 비교 복기 두 건에서 같은 문제가 다시 기록됐습니다.' :
    '전후 표본 기준을 충족했습니다. 표시한 수치는 관측된 변화입니다.') : '문제 판정에는 같은 지표가 입력된 훈련 전·후 복기가 각각 2건 이상 필요합니다.';
  const trainButton = button('추천 훈련 기록', 'train-issue', 'primary', i.tag);
  const reviewButton = button('후속 복기 기록', 'review-issue', 'secondary', i.tag);
  return '<section class="panel">' + panelHead(esc(i.tag), '첫 발견 ' + fmtDate(datePart(i.anchor)) + ' · 비교 지표 ' + i.metric.name,
    pill(STATUS[i.status], i.status)) +
    '<div class="compare"><div><p>훈련 전 실전 평균</p><strong>' + baselineValue + '</strong><small>' + counts(i.before.count) + '</small></div>' +
    '<div><p>훈련 후 실전 평균</p><strong>' + afterValue + '</strong><small>' + counts(i.after.count) + '</small></div>' +
    '<div><p>실전 지표 변화</p><strong>' + delta + '</strong><small>개선 기준 ' + deltaText(i.metric.step, i.metric).replace(/^\+/, '') + '</small></div></div>' +
    help(stage) + help('훈련 효과의 단서는 전후 지표 변화에서 찾을 수 있습니다. 교전 조건과 표본 수를 함께 보세요.') +
    '<div class="overview-summary"><div><p>발견 이후 연결 훈련</p><strong>' + i.training.length + '회</strong></div>' +
    '<div><p>선택 기간 내 연결 훈련</p><strong>' + i.scopedTraining.length + '회</strong></div>' +
    '<div><p>선택 기간 내 문제 발생</p><strong>' + i.repeats + '회</strong></div></div>' +
    '<div class="callout"><b>다음 훈련 · ' + esc(i.mode) + '</b><p>' + esc(i.advice) + '</p></div>' +
    '<div class="row-actions">' + trainButton + reviewButton + (demo ? '' : button('비교 지표 변경', 'issue-rule', 'text', i.tag)) +
    '</div><details><summary>포함된 기록과 계산 기준</summary><div class="details-inner">' +
    help('첫 관련 훈련 시점을 기준으로 전후를 나눕니다. 선택 기간에 포함된 같은 태그, 후속 비교 태그 또는 교전 조건이 비슷한 실전 복기를 사용합니다. 최초 발견 기록은 비교 기준으로 유지할 수 있습니다.') +
    '<h3 class="subhead">훈련 전 복기</h3>' + table([...i.baseline].reverse(), true) + '<h3 class="subhead">발견 이후 연결 훈련</h3>' + table([...i.training].reverse(), true) +
    '<h3 class="subhead">훈련 후 복기</h3>' + table([...i.afterRows].reverse(), true) + '</div></details></section>';
}
function weekly(rows, issues) {
  const start = weekStart(today), end = day(start, 6), current = between(rows, start, today).filter(row => !isReview(row));
  const saved = demo ? {} : data.goals;
  // A goal stays visible after moving down the priority list within the week.
  const candidate = [...issues.filter(i => i.status !== 'improved').slice(0, 3), ...issues.filter(i => Object.hasOwn(saved, goalKey(start, i.tag)))];
  const goals = [...new Map(candidate.map(i => [i.tag, i])).values()].map(i => {
    const target = saved[goalKey(start, i.tag)] ?? (i.status === 'recurring' ? 3 : i.status === 'stalled' ? 2 : 1);
    const done = current.filter(row => row.when > i.anchor.when && row.issues.includes(i.tag)).length;
    return { ...i, target, done, credited: Math.min(done, target) };
  });
  const total = goals.reduce((sum, i) => sum + i.target, 0), done = goals.reduce((sum, i) => sum + i.credited, 0);
  const progress = total ? Math.round(done / total * 100) : 0;
  view.innerHTML = header('주간 계획', fmtDate(start) + ' ~ ' + fmtDate(end) + ' · 지금 우선순위가 높은 약점을 이번 주 훈련으로 연결하세요.', false) +
    '<section class="panel">' + panelHead('이번 주 훈련 목표', total ? '전체 달성률 ' + progress + '% · ' + done + ' / ' + total + '회' : '연결할 약점 기록이 필요합니다.') +
    (total ? '<progress aria-label="주간 전체 달성률" max="' + total + '" value="' + done + '"></progress><div class="goal-lines">' +
      goals.map(i => '<div class="goal-line"><div><h3>' + esc(i.tag) + ' ' + pill(STATUS[i.status], i.status) + '</h3><p>' + esc(i.mode) +
      '</p></div><div class="progress-cell"><progress aria-label="' + attr(i.tag) + ' 목표 달성률" max="' + i.target + '" value="' + i.credited +
      '"></progress><small>' + i.done + ' / ' + i.target + '회 · ' + Math.round(i.credited / i.target * 100) +
      '%</small></div><div class="row-actions">' + button('기록 추가', 'train-issue', 'secondary', i.tag) +
      (demo ? '' : button('목표 수정', 'goal', 'text', i.tag)) + '</div></div>').join('') +
      '</div>' + help('월요일부터 오늘까지 기록한 태그 연결 훈련만 집계합니다. 한 훈련이 여러 약점과 연결되면 각 목표에 반영됩니다.') :
      empty('실전 복기에서 문제를 발견하고 태그를 붙이면 주간 훈련 목표가 생깁니다.', 'add-review')) + '</section>';
}
function render() {
  chartObserver?.disconnect();
  today = localDate();
  const route = currentRoute(), rows = records(), [from, to] = bounds(), previousBounds = priorBounds(from, to);
  const conditional = route === 'records' ? filter : { ...filter, mode: '' };
  const inRange = between(filterRows(rows, conditional), from, to);
  const matchingContext = filterRows(rows, { ...conditional, mode: '' }, false);
  const context = between(matchingContext, from, to);
  const contextIds = new Set(matchingContext.map(row => row.id));
  const throughEnd = between(rows, '', to);
  const issues = issueStats(throughEnd, context, rules(), from, row => contextIds.has(row.id)).filter(i => !filter.issue || i.tag === filter.issue);
  const throughToday = between(rows, '', today);
  const allIssues = route === 'weekly' ? issueStats(throughToday, throughToday, rules()) : [];
  $('crumb').textContent = names[route];
  document.querySelectorAll('#nav a').forEach(link => {
    if (link.hash === '#' + route) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  const p = data.profile;
  $('profile-button').innerHTML = '<span>플레이 프로필</span><span aria-hidden="true">✎</span><strong>' + number(p.dpi, 0) + ' DPI · ' +
    number(p.sensitivity, 4) + '</strong><small>' + esc(p.style) + '</small>';
  $('demo-banner').innerHTML = demo ?
    '<div class="banner"><p><b>예시 데이터</b> 분석 흐름을 보여주는 가상 기록입니다.</p>' + button(data.started ? '내 기록으로 돌아가기' : '내 기록 시작', 'personal', 'text') + '</div>' :
    !data.records.length && route === 'overview' ? '<div class="banner"><p>저장한 세션이 없습니다. 직접 기록하거나 예시로 분석 흐름을 확인하세요.</p>' +
      button('예시 보기', 'demo', 'text') + '</div>' : '';
  if (route === 'overview') overview(rows, inRange, previousBounds.length ? between(filterRows(rows, conditional), ...previousBounds) : [], issues, [from, to]);
  else if (route === 'records') recordsPage(rows, inRange);
  else if (route === 'issues') issuesPage(rows, issues);
  else weekly(rows, allIssues);
}
function open(title, body, foot, form = '') {
  modal.innerHTML = (form ? '<form id="' + form + '">' : '') + '<div class="modal-head"><h2 id="modal-title">' + title +
    '</h2><button type="button" class="close" data-action="close" aria-label="닫기">×</button></div><div class="modal-body">' + body + '</div><div class="modal-foot">' +
    foot + '</div>' + (form ? '</form>' : '');
  if (!modal.open) modal.showModal();
  modal.scrollTop = 0;
}
function fields(label, name, value, attributes = '', type = 'text') {
  return '<label>' + label + '<input type="' + type + '" name="' + name + '" value="' + attr(value) + '" ' + attributes + '></label>';
}
const primary = text => '<button type="submit" class="button primary">' + text + '</button>';
const back = () => button('닫기', 'close');
function nowInput() {
  const date = new Date();
  return new Date(+date - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}
function addForm(record = null, mode = '', tag = '') {
  const edit = Boolean(record?.id), row = record ?? { title: '', when: nowInput(), mode: mode || MODES[0], map: '', agent: '', weapon: '', distance: null, scene: [],
    issues: mode === REVIEW ? [] : tag ? [tag] : [], notes: '', metrics: {} };
  const datalist = (title, key, values) => fields(title, key, row[key], 'maxlength="50" list="list-' + key + '"') + '<datalist id="list-' +
    key + '">' + [...new Set([...values, ...unique(data.records, key)])].map(v => '<option value="' + attr(v) + '"></option>').join('') + '</datalist>';
  const tagList = [...new Set([...unique(records(), 'issues', true), ...Object.keys(PRESETS)])];
  const issueHint = tag && mode === REVIEW ? help('후속 비교 대상 · ' + tag + '. 같은 문제가 반복됐을 때만 문제 태그도 함께 붙이세요.') : '';
  open(edit ? '기록 수정' : mode === REVIEW ? '실전 복기 추가' : '기록 추가', issueHint + '<input type="hidden" name="id" value="' + attr(row.id) +
    '"><div class="fields">' + fields('세션 제목', 'title', row.title, 'required maxlength="100" placeholder="예 · 어센트 미드 첫 교전"') +
    fields('일시', 'when', row.when, 'required min="2000-01-01T00:00" max="2100-12-31T23:59"', 'datetime-local') +
    '<label>유형<select name="mode" required>' + options(MODES, row.mode) + '</select></label>' +
    fields('교전 거리 (m)', 'distance', row.distance, 'min="0" max="1000" step="any"', 'number') +
    datalist('맵', 'map', MAPS) + datalist('요원', 'agent', AGENTS) + datalist('무기', 'weapon', WEAPONS) +
    fields('상황 태그', 'scene', row.scene.join(', '), 'maxlength="500" placeholder="예 · 미드, 첫 교전"') +
    '<div class="wide">' + fields('문제 태그', 'issues', row.issues.join(', '), 'id="issue-input" maxlength="500" placeholder="여러 태그는 쉼표로 구분"') +
    '<div class="chips">' + tagList.slice(0, 14).map(t => '<button class="chip-button" type="button" data-action="toggle-tag" data-value="' +
      attr(t) + '" aria-pressed="' + row.issues.includes(t) + '">' + esc(t) + '</button>').join('') + '</div></div><div class="wide"><label>후속 비교 태그<input name="followUp" maxlength="500" value="' + attr(tag && mode === REVIEW ? tag : follows(row).join(', ')) +
    '" placeholder="해결 여부를 점검할 기존 문제 태그"></label>' + help('이전 문제를 다시 확인한 실전 복기에 사용합니다.') + '</div></div>' +
    '<fieldset><legend>세션 지표</legend>' + help('측정한 값만 입력하세요. 헤드샷 비율은 명중 중 헤드샷 비중, 첫발 정확도는 첫발 시도 중 명중 비중, 회전·맵 운영 판단은 검토한 판단 중 적절한 판단의 비중입니다.') +
    '<div class="fields metric-fields">' + METRICS.map(m => fields(m.name + ' (' + m.unit + ')', m.key, row.metrics[m.key],
      'min="0" max="' + (m.unit === '%' ? 100 : m.unit === '°' ? 180 : 600000) + '" step="any"', 'number')).join('') +
    '</div></fieldset><label class="memo">메모<textarea name="notes" rows="3" maxlength="4000" placeholder="문제가 발생한 상황과 다음에 바꿀 행동">' + esc(row.notes) +
    '</textarea></label>', back() + primary('저장'), 'record-form');
}
function detail(row) {
  open(esc(row.title), '<p class="lead">' + esc(row.mode) + ' · ' + dateTime(row.when) + (row.source ? ' · VALOPRAC에서 가져옴' : '') + '</p><dl class="record-detail"><dt>교전 조건</dt><dd>' +
    esc([row.map, row.agent, row.weapon, row.distance == null ? '' : number(row.distance) + ' m'].filter(Boolean).join(' · ') || '—') +
    '</dd><dt>상황 태그</dt><dd>' + esc(row.scene.join(' · ') || '—') + '</dd><dt>문제 태그</dt><dd>' + esc(row.issues.join(' · ') || '—') +
    '</dd><dt>후속 비교 태그</dt><dd>' + esc(follows(row).join(' · ') || '—') + '</dd>' + METRICS.map(m => '<dt>' + m.name + '</dt><dd>' + valueText(row.metrics[m.key], m) + '</dd>').join('') +
    '</dl>' + (row.notes ? '<p class="note">' + esc(row.notes) + '</p>' : ''), back() + (demo ? '' : button('수정', 'edit', 'primary', row.id)));
}
function exportDialog() {
  open('기록 내보내기', '<div class="fields"><label>범위<select name="scope"><option value="all">전체 기록</option><option value="filtered">현재 기간과 필터</option></select></label>' +
    '<label>파일 형식<select name="format"><option value="json">JSON · 프로필·목표 포함</option><option value="csv">CSV · 기록 표</option></select></label></div>' +
    help(demo ? '내보낸 파일에 현재 표시된 가상 기록이 포함됩니다.' : '파일은 이 브라우저에서 생성됩니다.'), back() + primary('파일 다운로드'), 'export-form');
}
function fileImportDialog() {
  open('기록 가져오기',
    '<p class="lead"><a href="/statistics.html">VALOPRAC 훈련 기록</a>에서 ‘복기 연구실용 파일 저장’을 선택하세요.</p>' +
    '<p class="lead">이전 연구실에서 쓰던 기록은 <a href="https://valoprac-review-lab.thatglezoa.chatgpt.site/#records" target="_blank" rel="noopener noreferrer">이전 주소</a>에서 ‘내보내기 → 전체 기록 → JSON’을 선택해 옮길 수 있습니다.</p>' +
    '<label class="memo">연구실용 JSON 또는 이전 기록 백업<input id="transfer-file" type="file" accept="application/json,.json"></label>' +
    '<p id="transfer-error" class="footnote" role="alert"></p>', back());
}
function confirmTransfer(rows, settings = null) {
  candidates = rows;
  backup = settings;
  const existing = new Set(data.records.map(row => row.id));
  const newCount = rows.filter(row => !existing.has(row.id)).length;
  open(backup ? '이전 기록 복원' : '가져올 훈련 기록 확인',
    help('선택한 기록을 이 브라우저에 저장합니다. 중복된 기록의 수정 내용은 유지됩니다.') +
    '<div class="transfer-list">' + ordered(rows).reverse().map(row => {
      const duplicate = existing.has(row.id);
      const first = row.metrics.first, accuracy = row.metrics.accuracy;
      return '<label class="transfer-item"><input type="checkbox" name="selected" value="' + attr(row.id) + '" ' + (duplicate ? 'disabled' : 'checked') +
        '><span><b>' + esc(row.title) + '</b><small>' + dateTime(row.when) + ' · ' + esc(row.map) + ' · ' + esc(row.weapon) +
        (duplicate ? ' · 이미 저장됨' : '') + '</small><small>명중률 ' + (accuracy == null ? '—' : number(accuracy) + '%') +
        ' · 첫발 정확도 ' + (first == null ? '—' : number(first) + '%') + '</small></span></label>';
    }).join('') + '</div>' + (backup
      ? '<label class="restore-preferences"><input type="checkbox" name="preferences" checked>이전 프로필, 주간 목표, 문제별 설정도 가져오기</label>'
      : (newCount ? fields('선택 기록에 붙일 문제 태그', 'issues', '', 'maxlength="500" placeholder="예 · 과다 노출, 첫발 빗나감"') : '') +
        help('반응시간은 표적 방향 변화 대응, 노출시간은 피킹 구간의 평균입니다. 무빙 오차·첫발·제동 값은 해당 측정값이 있는 경우에 표시합니다.')),
    back() + (newCount || backup ? primary('선택 기록 저장') : ''), 'transfer-confirm');
}
async function readTransferFile(input) {
  const file = input.files?.[0];
  const error = $('transfer-error');
  if (!file || !error) return;
  try {
    if (file.size > MAX_BACKUP_BYTES) throw new Error('가져올 파일이 너무 큽니다.');
    const contents = await file.text();
    const parsed = JSON.parse(contents);
    if (!input.isConnected || !modal.open || input.files?.[0] !== file) return;
    if (parsed?.source === 'valoprac.trade') {
      confirmTransfer(parseTransfer(contents));
    } else {
      const { records, ...settings } = readBackup(parsed);
      confirmTransfer(records, settings);
    }
  } catch (err) {
    if (error.isConnected && input.files?.[0] === file) error.textContent = err instanceof SyntaxError ? 'JSON 파일을 읽을 수 없습니다.' : err.message;
  }
}
function readTransferHash() {
  if (!location.hash.startsWith('#import=')) return false;
  const encoded = location.hash.slice(8);
  history.replaceState(null, '', '#records');
  render();
  try {
    if (encoded.length > 8000) throw new Error('가져올 링크가 너무 깁니다.');
    confirmTransfer(parseTransfer(decodeURIComponent(encoded)));
  } catch { notify('가져오기 링크를 읽을 수 없습니다. VALOPRAC에서 다시 열어 주세요.'); }
  return true;
}
function download(state, format) {
  const payload = format === 'csv' ? toCSV(state.records) : JSON.stringify(state, null, 2);
  const blob = new Blob([payload], { type: format === 'csv' ? 'text/csv;charset=utf-8' : 'application/json' });
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = 'valoprac-' + (demo ? 'demo-' : '') + today + '.' + format;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function go(route) {
  if (currentRoute() !== route) location.hash = route;
  else render();
}
function action(key, value, element) {
  const row = records().find(r => r.id === value);
  const [presetMetric, suggestedMode] = Object.hasOwn(PRESETS, value) ? PRESETS[value] : ['first', MODES[0]];
  switch (key) {
    case 'close': modal.close(); break;
    case 'add': addForm(); break;
    case 'add-review': addForm(null, REVIEW); break;
    case 'personal':
      if (write({})) { filter = {}; render(); }
      break;
    case 'demo': demo = true; filter = {}; render(); break;
    case 'profile':
      open('플레이 프로필', '<div class="fields">' + fields('마우스 DPI', 'dpi', data.profile.dpi, 'required min="1" max="100000" step="1"', 'number') +
        fields('인게임 감도', 'sensitivity', data.profile.sensitivity, 'required min="0.0001" max="100" step="any"', 'number') +
        '<label class="wide">교전 스타일<textarea name="style" required maxlength="200" rows="2">' + esc(data.profile.style) +
        '</textarea></label></div>' + help('현재 eDPI ' + number(data.profile.dpi * data.profile.sensitivity, 2)), back() + primary('저장'), 'profile-form');
      break;
    case 'range': range = value; page = 1; render(); break;
    case 'page': page = Number(value); render(); break;
    case 'reset-filter': filter = {}; page = 1; render(); break;
    case 'issue': issueTag = value; go('issues'); break;
    case 'train-issue': addForm(null, (demo ? null : data.rules[value]?.mode) ?? suggestedMode, value); break;
    case 'review-issue': {
      const latest = (demo ? [] : ordered(data.records)).find(r => isReview(r) && r.issues.includes(value));
      addForm(latest ? { ...latest, id: '', title: '', when: nowInput(), issues: [], metrics: {}, notes: '' } : null, REVIEW, value);
      break;
    }
    case 'issue-rule':
      open('문제 태그 설정', '<p class="lead">' + esc(value) + '</p><input type="hidden" name="tag" value="' + attr(value) +
        '"><div class="fields"><label>비교할 지표<select name="metric">' + options(metricOptions, data.rules[value]?.metric ?? presetMetric) +
        '</select></label><label>추천 훈련<select name="mode">' + options(MODES.slice(0, 4), data.rules[value]?.mode ?? suggestedMode) +
        '</select></label></div>', back() + primary('저장'), 'rule-form');
      break;
    case 'goal': {
      const i = issueStats(data.records, data.records, data.rules).find(i => i.tag === value);
      if (!i) break;
      const count = data.goals[goalKey(weekStart(today), value)] ?? (i.status === 'recurring' ? 3 : i.status === 'stalled' ? 2 : 1);
      open('주간 목표 수정', '<p class="lead">' + esc(value) + '</p><input type="hidden" name="tag" value="' + attr(value) + '">' +
        fields('연결 훈련 목표 횟수', 'target', count, 'required min="1" max="99" step="1"', 'number'), back() + primary('저장'), 'goal-form');
      break;
    }
    case 'detail': if (row) detail(row); break;
    case 'edit': if (!demo && row) addForm(row); break;
    case 'delete':
      if (!demo && row) open('기록 삭제', '<p>‘' + esc(row.title) + '’ 기록을 삭제할까요?</p>' + help('관련 비교 지표와 주간 달성률도 다시 계산합니다.'),
        back() + button('삭제', 'confirm-delete', 'danger', row.id));
      break;
    case 'confirm-delete':
      if (!demo && write({ records: data.records.filter(r => r.id !== value) })) { modal.close(); render(); notify('기록을 삭제했습니다.'); }
      break;
    case 'toggle-tag': {
      const input = $('issue-input'), tags = cleanTags(input.value);
      if (tags.includes(value)) input.value = tags.filter(tag => tag !== value).join(', ');
      else if (tags.length < 20) input.value = [...tags, value].join(', ');
      updateChips(); element.focus();
      break;
    }
    case 'import': fileImportDialog(); break;
    case 'export': exportDialog(); break;
  }
}
function updateChips() {
  const tags = cleanTags($('issue-input')?.value ?? '');
  modal.querySelectorAll('[data-action="toggle-tag"]').forEach(chip => chip.setAttribute('aria-pressed', String(tags.includes(chip.dataset.value))));
}
document.addEventListener('click', event => {
  const hit = event.target.closest('[data-action]');
  if (hit) action(hit.dataset.action, hit.dataset.value ?? '', hit);
});
document.addEventListener('input', event => {
  if (event.target.id === 'issue-input') updateChips();
});
document.addEventListener('change', event => {
  if (event.target.id === 'transfer-file') void readTransferFile(event.target);
  if (event.target.id === 'chart-metric') { metricKey = event.target.value; render(); $('chart-metric')?.focus(); }
  if (event.target.id === 'sort') { sort = event.target.value; render(); $('sort')?.focus(); }
});
document.addEventListener('submit', event => {
  const form = event.target, formId = form.getAttribute('id'), f = Object.fromEntries(new FormData(form));
  event.preventDefault();
  if (formId === 'filters') { filter = f; page = 1; render(); return; }
  if (formId === 'date-form') {
    if (f.from > f.to) { notify('종료일은 시작일보다 빠를 수 없습니다.'); return; }
    customFrom = f.from; customTo = f.to; page = 1; render(); return;
  }
  if (formId === 'record-form') {
    if (!f.title.trim()) { notify('세션 제목을 입력해 주세요.'); return; }
    const row = {
      id: f.id || crypto.randomUUID(), source: data.records.find(item => item.id === f.id)?.source, mode: f.mode, title: f.title.trim(), when: f.when,
      map: f.map.trim(), agent: f.agent.trim(), weapon: f.weapon.trim(), distance: f.distance === '' ? null : Number(f.distance),
      scene: cleanTags(f.scene), issues: cleanTags(f.issues), followUp: f.mode === REVIEW ? cleanTags(f.followUp) : [], notes: f.notes.trim(),
      metrics: Object.fromEntries(METRICS.map(m => [m.key, f[m.key] === '' ? null : Number(f[m.key])]))
    };
    const next = data.records.filter(r => r.id !== row.id);
    next.push(row);
    const wasDemo = demo;
    if (write({ records: ordered(next) })) {
      modal.close();
      if (wasDemo || !f.id) { filter = {}; range = 'all'; page = 1; go('records'); }
      else render();
      notify('기록을 저장했습니다.');
    }
    return;
  }
  if (formId === 'transfer-confirm') {
    const checked = new Set(new FormData(form).getAll('selected'));
    const existing = new Set(data.records.map(row => row.id));
    const selected = candidates.filter(row => checked.has(row.id) && !existing.has(row.id));
    const restoreSettings = backup && Boolean(f.preferences);
    if (!selected.length && !restoreSettings) { notify('추가할 기록이나 설정을 선택해 주세요.'); return; }
    const restored = backup ? selected : selected.map(row => ({ ...row, issues: cleanTags(f.issues) }));
    const settings = restoreSettings
      ? { profile: backup.profile, rules: { ...backup.rules, ...data.rules }, goals: { ...backup.goals, ...data.goals } } : {};
    if (write({ ...settings, records: ordered([...data.records, ...restored]) })) {
      candidates = []; backup = null; modal.close(); filter = {}; range = 'all'; page = 1; go('records');
      notify(selected.length ? selected.length + '건을 가져왔습니다.' : '이전 연구실의 설정을 가져왔습니다.');
    }
    return;
  }
  if (formId === 'export-form') {
    const scope = f.scope === 'all' ? records() : between(filterRows(records(), currentRoute() === 'records' ? filter : { ...filter, mode: '' }), ...bounds());
    download({ schema: 1, exportedAt: new Date().toISOString(), demo, profile: data.profile, records: ordered(scope), goals: demo ? {} : data.goals, rules: rules() }, f.format);
    modal.close(); notify('다운로드 파일을 생성했습니다.'); return;
  }
  let patch, start = true;
  if (formId === 'profile-form') {
    if (!f.style.trim()) { notify('교전 스타일을 입력해 주세요.'); return; }
    patch = { profile: { dpi: Number(f.dpi), sensitivity: Number(f.sensitivity), style: f.style.trim() } };
    start = false;
  } else if (formId === 'rule-form') {
    patch = { rules: { ...data.rules, [f.tag]: { metric: f.metric, mode: f.mode } } };
  } else if (formId === 'goal-form') {
    patch = { goals: { ...data.goals, [goalKey(weekStart(today), f.tag)]: Number(f.target) } };
  }
  if (patch && write(patch, start)) { modal.close(); render(); notify('변경 사항을 저장했습니다.'); }
});
window.addEventListener('hashchange', () => { if (!readTransferHash()) render(); window.scrollTo(0, 0); });
window.addEventListener('storage', event => {
  if (event.key !== STORE) return;
  data = load(); demo = !data.started;
  if (!modal.open) render();
});
if (!readTransferHash()) render();

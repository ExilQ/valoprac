const key = 'valoprac-locale-v1';
export const hasKorean = /[가-힣ㄱ-ㅎㅏ-ㅣ]/;
export function preferredLanguage() {
  try { return localStorage.getItem(key) === 'en' ? 'en' : 'ko'; }
  catch { return 'ko'; }
}

export function createLanguage({ catalog, onChange }) {
  let language = 'ko', english, request, revision = 0;
  function text(value) {
    if (language !== 'en' || !hasKorean.test(value)) return value;
    const trimmed = value.trim();
    return english?.[trimmed] === undefined ? value : value.replace(trimmed, () => english[trimmed]);
  }
  async function select(next, save = true) {
    if (next !== 'ko' && next !== 'en') return;
    const current = ++revision;
    if (next === 'en' && !english) {
      request ??= fetch(catalog).then(response => {
        if (!response.ok) throw new Error('Language download failed');
        return response.json();
      }).finally(() => { request = undefined; });
      english = await request;
    }
    if (current !== revision) return;
    language = next;
    document.documentElement.lang = next;
    if (save) try { localStorage.setItem(key, next); } catch { /* Selection still works in memory. */ }
    onChange(next);
  }
  return { text, select, get language() { return language; } };
}

export function mountLanguageSelect(container, controller) {
  const label = document.createElement('label');
  label.className = 'site-language';
  const description = document.createElement('span');
  description.textContent = 'Language';
  const select = document.createElement('select');
  select.setAttribute('aria-label', 'Language');
  for (const [code, name] of [['en', 'English'], ['ko', '한국어']]) {
    const option = new Option(name, code);
    option.lang = code;
    select.add(option);
  }
  select.value = controller.language;
  const status = document.createElement('small');
  status.setAttribute('role', 'status');
  label.append(description, select, status);
  container.append(label);
  function sync() { select.value = controller.language; }
  function update(next, save) {
    status.textContent = '';
    void controller.select(next, save).catch(() => {
      sync();
      status.textContent = controller.language === 'en' ? 'Could not load the language.' : '언어 파일을 불러오지 못했습니다.';
    });
  }
  select.addEventListener('change', () => update(select.value, true));
  window.addEventListener('storage', event => {
    if (event.key === key && (event.newValue === 'en' || event.newValue === 'ko')) update(event.newValue, false);
  });
  return sync;
}

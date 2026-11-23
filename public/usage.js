(() => {
  if (location.origin !== 'https://valoprac.trade' || navigator.globalPrivacyControl ||
      navigator.doNotTrack === '1' || (navigator.webdriver && new URLSearchParams(location.search).get('analytics-check') !== '1')) return;
  const pages = new Set([
    '/', '/training', '/maps', '/weapons', '/aim', '/statistics', '/settings',
    '/tools', '/results', '/unreal', '/guide', '/valorant-aim-trainer',
    '/aim-methodology', '/footsteps', '/tactical-guide'
  ]);
  const storeKey = 'valoprac-usage-v2';
  let session;
  let lastPath;
  let pending = Promise.resolve();

  function channel() {
    if (!document.referrer) return 'unknown';
    let host;
    try { host = new URL(document.referrer).hostname; } catch { return 'unknown'; }
    if (host === location.hostname) return 'unknown';
    const is = domain => host === domain || host.endsWith('.' + domain);
    if (['google.com','google.co.kr','google.co.jp','google.co.uk'].some(is)) return 'google';
    if (is('bing.com')) return 'bing';
    if (is('naver.com')) return 'naver';
    if (is('daum.net')) return 'daum';
    if (['duckduckgo.com','search.yahoo.com','search.brave.com','yandex.com'].some(is)) return 'other-search';
    if (is('chatgpt.com')) return 'chatgpt';
    if (is('youtube.com') || is('youtu.be')) return 'youtube';
    if (is('discord.com') || is('discord.gg')) return 'discord';
    if (['reddit.com','t.co','x.com','instagram.com','tiktok.com','facebook.com'].some(is)) return 'social';
    return 'external';
  }

  function save() {
    try { sessionStorage.setItem(storeKey, JSON.stringify(session)); } catch { /* Keep tab-local state. */ }
  }

  function init() {
    try { session = JSON.parse(sessionStorage.getItem(storeKey) ?? 'null'); } catch { /* Optional storage. */ }
  }

  async function ensureSession(test) {
    if(session?.token && session.expiresAt > Date.now()+1000 && session.seq < 500 && session.test === test) return;
    const response=await fetch('/api/usage/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({test}),credentials:'omit'});
    if(!response.ok)throw Error('Usage admission unavailable');
    session={...await response.json(),seq:0,last:Date.now(),started:false,registered:false};save();
  }

  async function send(type,extra={}) {
    const response=await fetch('/api/usage',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.token},body:JSON.stringify({type,id:session.id,test:session.test,...extra}),keepalive:true,credentials:'omit'});
    if(response.status===401){session=null;try{sessionStorage.removeItem(storeKey);}catch{}}
    if(!response.ok)throw Error('Usage event rejected');
  }

  function queue(operation) {
    pending=pending.then(operation).catch(()=>{lastPath=undefined; /* Analytics never interrupts play. */});
  }

  async function sendView(path) {
    const source=session.seq===0?channel():'unknown';session.seq++;session.last=Date.now();save();
    await send('view',{seq:session.seq,path,source});session.registered=true;save();
  }

  function recordView() {
    const path=location.pathname.replace(/\/+$/, '').replace(/\.html$/, '')||'/';
    const normalized=path==='/index'?'/':path;
    if(!pages.has(normalized)||normalized===lastPath)return;
    lastPath=normalized;
    const test=new URLSearchParams(location.search).get('analytics-check')==='1';
    queue(async()=>{await ensureSession(test);await sendView(normalized);});
  }

  function startTraining() {
    recordView();
    const test=new URLSearchParams(location.search).get('analytics-check')==='1';
    queue(async()=>{await ensureSession(test);if(!session.registered){const path=location.pathname.replace(/\/+$/, '').replace(/\.html$/, '')||'/';await sendView(pages.has(path)?path:'/training');}if(session.started)return;await send('start');session.started=true;session.last=Date.now();save();});
  }

  init();
  recordView();
  addEventListener('popstate', recordView);
  if (window.navigation) {
    window.navigation.addEventListener('currententrychange', recordView);
  } else {
    for (const method of ['pushState', 'replaceState']) {
      const original = history[method];
      history[method] = function (...args) {
        const result = original.apply(this, args);
        recordView();
        return result;
      };
    }
  }
  addEventListener('valoprac:training-started', startTraining);
})();

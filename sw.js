/* 한대장 서비스워커 — 오프라인 캐시(PWA) + 알림 전달
   원칙: **설치된 앱은 지우고 다시 깔지 않아도 항상 최신이어야 한다.**
   - 앱 코드(html/js/css)와 데이터(data/*.json)는 '네트워크 우선' — 배포하면 다음 실행에 바로 반영된다.
     (예전엔 코드가 '캐시 우선'이라 아래 CACHE 버전을 손으로 올리는 걸 잊으면 설치된 앱에 영영 반영되지
      않았다. 사람 기억에 의존하던 이 구멍을 2026-07-31에 막았다.)
   - 그림·아이콘은 자주 바뀌지 않으므로 캐시 우선(빠른 실행).
   - 네트워크가 느리거나 끊기면 캐시로 즉시 폴백 — 오프라인 실행은 그대로 보장된다.
   - 아래쪽 '알림' 절: 앱이 닫혀 있을 때의 확인, 알림 클릭 처리, (미래) 서버 푸시 수신구. */
/* v16: 알림 시스템(선주)과 원문 링크 정직 표기(Josehyeon)가 각각 v15로 올라와 겹쳤다.
   설치된 앱에서 '내용이 다른 같은 v15'가 생기지 않도록 합치면서 v16으로 올린다. */
const CACHE = 'handaejang-v16';
const ASSETS = ['.', 'index.html', 'style.css', 'app.js', 'data.js', 'forms.js',
  'match-engine.js', 'notify-rules.js', 'notify.js',
  'manifest.json', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png'];
const NET_TIMEOUT = 3500; /* 이 시간 안에 응답이 없으면 캐시부터 보여주고, 받아온 최신본은 다음 실행에 쓴다 */

/* 알림 규칙은 앱 화면과 똑같은 파일을 쓴다 — 판단 기준이 두 벌로 갈라지지 않게 */
try { importScripts('match-engine.js', 'notify-rules.js'); } catch (e) { /* 못 읽으면 알림만 비활성 */ }

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* 서버에 '바뀐 것 있나요?'를 반드시 물어보는 요청을 만든다.
   그냥 fetch만 하면 브라우저가 자기 캐시(GitHub Pages는 10분)를 그대로 내주기 때문에
   배포한 내용이 최대 10분, 상황에 따라 더 오래 안 보인다. no-cache는 매번 서버에 확인하고
   안 바뀌었으면 304(내용 없음)로 끝나므로 데이터도 거의 쓰지 않는다. */
function freshRequest(request) {
  try {
    return request.mode === 'navigate'
      ? new Request(request.url, { cache: 'no-cache', credentials: 'same-origin' })
      : new Request(request, { cache: 'no-cache' });
  } catch { return request; }
}

/* 네트워크 우선 + 캐시 폴백(시간초과 포함) */
function networkFirst(request, fallbackTo) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (res) => { if (!settled && res) { settled = true; resolve(res); } };
    const fromCache = () => caches.match(request).then((c) => c || (fallbackTo ? caches.match(fallbackTo) : null));

    const timer = setTimeout(() => { fromCache().then(finish); }, NET_TIMEOUT);

    fetch(freshRequest(request))
      .then((res) => {
        clearTimeout(timer);
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {});
        }
        finish(res);
      })
      .catch(() => {
        clearTimeout(timer);
        fromCache().then((c) => finish(c || Response.error()));
      });
  });
}

/* 캐시 우선(그림 등 잘 안 바뀌는 것) */
function cacheFirst(request) {
  return caches.match(request).then((cached) => cached || fetch(request).then((res) => {
    if (res && res.ok) {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {});
    }
    return res;
  }));
}

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  let url;
  try { url = new URL(e.request.url); } catch { return; }
  if (url.origin !== self.location.origin) return; /* 외부(폰트 CDN 등)는 브라우저에 맡긴다 */

  /* 화면 자체 */
  if (e.request.mode === 'navigate') {
    e.respondWith(networkFirst(e.request, 'index.html'));
    return;
  }

  /* 그림·아이콘 — 캐시 우선 */
  if (/\.(?:png|jpg|jpeg|gif|svg|webp|ico|woff2?)$/i.test(url.pathname)) {
    e.respondWith(cacheFirst(e.request));
    return;
  }

  /* 앱 코드(js·css·html)와 데이터(data/*.json) — 네트워크 우선(항상 최신) */
  e.respondWith(networkFirst(e.request));
});

/* ============================================================
   알림 — 앱이 닫혀 있을 때의 확인 · 알림 클릭 처리 · (미래) 서버 푸시 수신구
   ============================================================ */
const NF_DB = 'handaejang-notify';
const NF_STORE = 'state';

function nfOpen() {
  return new Promise((res, rej) => {
    const rq = indexedDB.open(NF_DB, 1);
    rq.onupgradeneeded = () => {
      if (!rq.result.objectStoreNames.contains(NF_STORE)) rq.result.createObjectStore(NF_STORE, { keyPath: 'k' });
    };
    rq.onsuccess = () => res(rq.result);
    rq.onerror = () => rej(rq.error);
  });
}
function nfTx(mode, fn) {
  return nfOpen().then((db) => new Promise((res, rej) => {
    const tx = db.transaction(NF_STORE, mode);
    const out = fn(tx.objectStore(NF_STORE));
    tx.oncomplete = () => res(out && out.result);
    tx.onerror = () => rej(tx.error);
  }));
}
const nfGet = (k) => nfTx('readonly', (st) => st.get(k));
const nfPut = (k, v) => nfTx('readwrite', (st) => st.put(Object.assign({ k }, v)));

/* 앱 화면이 열려 있지 않을 때의 확인.
   프로필·신청내역은 앱이 IndexedDB에 남겨 둔 사본(ctx)을 읽는다(서비스워커는 localStorage를 못 읽음).
   실제로 불리는 건 백그라운드 확인을 지원하는 기기뿐이라 '선택 기능'이다. */
async function backgroundCheck() {
  if (typeof NOTIFY_RULES === 'undefined' || typeof evaluate !== 'function') return 0;

  const ctx = await nfGet('ctx').catch(() => null);
  const profile = ctx && ctx.profile;
  if (!profile || !profile.school) return 0;

  const ledger = NOTIFY_RULES.normalizeLedger(await nfGet('ledger').catch(() => null));
  if (!ledger.enabled) return 0; // 사용자가 끈 상태면 아무것도 하지 않는다

  const readJson = (url) => fetch(url, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const [reg, notices] = await Promise.all([readJson('data/registered.json'), readJson('data/notices.json')]);

  const out = NOTIFY_RULES.evaluate({
    now: Date.now(),
    profile,
    applications: (ctx && ctx.applications) || [],
    scholarships: scopedToProfile((reg && reg.items) || [], profile),
    notices: (notices && notices.items) || [],
    ledger,
    matchStatus: (sch) => evaluate(sch, profile).status,
    notStale: (sch) => notStale(sch),
  });

  if (out.events.length) {
    NOTIFY_RULES.pushToInbox(out.ledger, out.events, Date.now());
    const show = out.events.length > 3
      ? [{ key: 'sum:' + Date.now(), title: `🔔 한대장 새 알림 ${out.events.length}건`, body: out.events[0].title, url: './?screen=notifications' }]
      : out.events;
    for (const ev of show) {
      await self.registration.showNotification(ev.title, {
        body: ev.body || '',
        tag: ev.key || 'handaejang',
        icon: 'icons/icon-192.png',
        badge: 'icons/icon-192.png',
        lang: 'ko',
        data: { url: ev.url || './', schId: ev.schId || null, type: ev.type || null },
      });
    }
  }
  await nfPut('ledger', out.ledger);
  return out.events.length;
}

self.addEventListener('periodicsync', (e) => {
  if (e.tag !== 'handaejang-check') return;
  e.waitUntil(backgroundCheck().catch(() => {}));
});
self.addEventListener('sync', (e) => {
  if (e.tag !== 'handaejang-check') return;
  e.waitUntil(backgroundCheck().catch(() => {}));
});

/* 서버 푸시 수신구 — 발송 서버(VAPID)가 붙는 날 그대로 동작하도록 미리 열어 둔다.
   지금은 서버가 없어 실제로 호출되지 않는다(화면 문구도 그렇게 정직하게 안내). */
self.addEventListener('push', (e) => {
  let p = {};
  try { p = e.data ? e.data.json() : {}; } catch (err) { p = { title: '한대장', body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(p.title || '한대장', {
    body: p.body || '',
    tag: p.tag || 'handaejang-push',
    icon: 'icons/icon-192.png',
    badge: 'icons/icon-192.png',
    lang: 'ko',
    data: { url: p.url || './', schId: p.schId || null, type: p.type || null },
  }));
});

/* 알림을 누르면: 이미 열려 있는 앱이 있으면 그 화면으로, 없으면 앱을 새로 연다 */
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const data = e.notification.data || {};
  const target = new URL(data.url || './', self.registration.scope).href;
  e.waitUntil((async () => {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of clients) {
      if (c.url.startsWith(self.registration.scope)) {
        try { await c.focus(); } catch (err) { /* 포커스 불가 브라우저 */ }
        c.postMessage({ type: 'notify-click', data });
        return;
      }
    }
    await self.clients.openWindow(target);
  })());
});

self.addEventListener('message', (e) => {
  const msg = e.data || {};
  if (msg.type === 'notify-check') e.waitUntil(backgroundCheck().catch(() => {}));
  if (msg.type === 'skip-waiting') self.skipWaiting();
});

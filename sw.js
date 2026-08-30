/* 한대장 서비스워커 — 오프라인 캐시(PWA) + 알림 전달
   원칙: **설치된 앱은 지우고 다시 깔지 않아도 항상 최신이어야 한다.**
   - 앱 코드(html/js/css)와 데이터(data/*.json)는 '네트워크 우선' — 배포하면 다음 실행에 바로 반영된다.
     (예전엔 코드가 '캐시 우선'이라 아래 CACHE 버전을 손으로 올리는 걸 잊으면 설치된 앱에 영영 반영되지
      않았다. 사람 기억에 의존하던 이 구멍을 2026-07-31에 막았다.)
   - 그림·아이콘은 자주 바뀌지 않으므로 캐시 우선(빠른 실행).
   - 네트워크가 느리거나 끊기면 캐시로 즉시 폴백 — 오프라인 실행은 그대로 보장된다.
   - 아래쪽 '알림' 절: 앱이 닫혀 있을 때의 확인, 알림 클릭 처리, (미래) 서버 푸시 수신구. */
/* 버전 올릴 때 주의 (2026-07-31·08-01 두 번 겪음): 두 개발자가 각자 다른 작업을 하면서
   같은 번호로 올리는 일이 반복된다. v15도 v16도 양쪽이 따로 올려 '내용이 다른 같은 버전'이
   됐다. 합칠 때는 **둘 다보다 큰 번호로** 올려야 설치된 앱의 옛 캐시가 확실히 청소된다.
   v17 = 알림·진짜 푸시(선주) + 원문 링크 정직 표기(Josehyeon)를 합친 판. */
/* v59 = 자격 요건 발췌 수리(Josehyeon) + 신청서 질문 방식 최적화(선주)를 합친 판.
   양쪽이 각자 v58로 올려 또 부딪혔다 — 위 주석의 규칙대로 **둘 다보다 큰 번호**로 올린다. */
/* 🔴 v105 — style.css 를 고쳤으면 **여기도 올려야 한다** (2026-08-30에 두 번 빠뜨렸다).
   349f731·bd3f660 에서 CSS 를 고치고 이 번호를 안 올렸더니, 배포는 성공했는데
   설치된 앱은 옛 CSS 를 계속 내주고 있었다("아직도 각져 있어").
   네트워크 우선이라 결국은 반영되지만, 응답이 3.5초를 넘으면 캐시로 떨어지고
   그 캐시가 옛 판이면 그대로 옛 화면이 보인다. 번호를 올려야 확실히 청소된다. */
const CACHE = 'handaejang-v105';  /* v105 — 모서리 토큰 선언 복구(35곳) + 장학금 검색 */
const ASSETS = ['.', 'index.html', 'style.css', 'app.js', 'data.js', 'forms.js', 'form-plan.js', 'essay.js', 'essay-config.js', 'essay-ask.js', 'essay-quality.js', 'essay-submit-check.js',
  'section-head.js', 'parse-requirements.js', 'parse-amount.js', 'match-engine.js', 'notify-rules.js', 'notify.js', 'push-config.js',
  'chat-config.js', 'chat.js',
  /* 로그인 — 목록에서 빠지면 **오프라인에서** 이 파일만 없어 앱이 죽는다.
     ⚠️ importScripts 에는 넣지 않는다: 서비스워커는 로그인을 모른다(푸시는 지금처럼
        기기 안에서 판단한다). 넣으면 서버에 붙는 경로가 하나 더 생겨 경계가 흐려진다. */
  'supabase-config.js', 'supabase-client.js', 'terms.html',
  'manifest.json', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png'];
const NET_TIMEOUT = 3500; /* 이 시간 안에 응답이 없으면 캐시부터 보여주고, 받아온 최신본은 다음 실행에 쓴다 */

/* 알림 규칙은 앱 화면과 똑같은 파일을 쓴다 — 판단 기준이 두 벌로 갈라지지 않게 */
try { importScripts('section-head.js', 'parse-requirements.js', 'parse-amount.js', 'match-engine.js', 'notify-rules.js'); } catch (e) { /* 못 읽으면 알림만 비활성 */ }

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
  /* 공고는 **학교별 파일**에서 읽는다 (2026-08-17) — 화면(app.js loadNotices)과 같은 규칙.
     여기만 옛 파일을 보면, 화면에는 있는 공고를 알림이 모르거나 그 반대가 된다
     (이 저장소가 match-engine.js를 화면·알림이 함께 쓰는 것과 같은 이유). */
  const noticeFiles = typeof noticeFilesForProfile === 'function' ? noticeFilesForProfile(profile) : [];
  const [reg, ...noticeDocs] = await Promise.all([
    readJson('data/registered.json'),
    ...(noticeFiles.length ? noticeFiles : ['data/notices.json']).map(readJson),
  ]);
  const gotAny = noticeDocs.some(Boolean);
  const notices = gotAny
    ? { items: noticeDocs.filter(Boolean).flatMap((d) => d.items || []) }
    : await readJson('data/notices.json');   // 학교별 파일이 아직 없는 학교

  const out = NOTIFY_RULES.evaluate({
    now: Date.now(),
    profile,
    applications: (ctx && ctx.applications) || [],
    scholarships: scopedToProfile((reg && reg.items) || [], profile),
    notices: (notices && notices.items) || [],
    ledger,
    matchStatus: (sch) => evaluate(sch, profile).status,
    noticeForProfile,
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

/* ── 서버 푸시 수신구 ─────────────────────────────────────────
   앱을 켜지 않아도, 화면이 꺼져 있어도 여기가 깨어난다.
   발송 서버(server/push/)는 **내용 없는 '깨우기' 푸시**만 보낸다. 무엇을 알릴지는
   여기서 **기기 안 프로필**로 판단한다 — 그래서 개인정보가 서버로 나가지 않는다.
   브라우저 규칙상 푸시를 받으면 반드시 눈에 보이는 알림을 하나는 띄워야 하므로,
   규칙상 알릴 것이 없으면 조용한 안내 1건으로 대신한다. */
self.addEventListener('push', (e) => {
  e.waitUntil((async () => {
    let p = {};
    try { p = e.data ? e.data.json() : {}; } catch (err) { p = {}; }

    // 서버가 문구까지 실어 보낸 경우 (지금 발송 서버는 쓰지 않지만, 나중을 위해 남겨 둔다)
    if (p && p.title) {
      await self.registration.showNotification(p.title, {
        body: p.body || '',
        tag: p.tag || 'handaejang-push',
        icon: 'icons/icon-192.png',
        badge: 'icons/icon-192.png',
        lang: 'ko',
        data: { url: p.url || './', schId: p.schId || null, type: p.type || null },
      });
      return;
    }

    // 사용자가 알림을 꺼 뒀는데도 깨워졌다면(해지 요청이 서버에 안 닿은 경우 등)
    // 구독을 스스로 정리하고 조용히 끝낸다 — 끈 사람에게 알림을 띄우지 않는다.
    // ⚠️ 단, **'껐다'와 '못 읽었다'는 다르다.** 예전에는 장부 읽기에 실패해도 기본 장부
    //    (enabled:false)를 만들어 "껐다"로 단정하고 구독을 끊어, 알림을 켜 둔 폰이 발송
    //    서버에서 조용히 사라졌다. 판정은 notify-rules.js 한 곳에 있다(화면·검사와 공유).
    let rawLedger = null;
    let ledgerRead = true;
    try { rawLedger = await nfGet('ledger'); } catch (err) { ledgerRead = false; }
    if (NOTIFY_RULES && NOTIFY_RULES.shouldSelfUnsubscribe(rawLedger, ledgerRead)) {
      try {
        const sub = await self.registration.pushManager.getSubscription();
        if (sub) await sub.unsubscribe();
      } catch (err) { /* 무시 */ }
      return;
    }

    // 내용 없는 깨우기 푸시 — 기기 안에서 판단해 정확한 알림을 만든다
    let shown = 0;
    try { shown = await backgroundCheck(); } catch (err) { shown = 0; }
    if (shown > 0) return;

    await self.registration.showNotification('한대장 · 새 장학 소식', {
      body: '우리 학교와 내 조건에 맞는 공고를 확인해 보세요.',
      tag: 'handaejang-wake',
      icon: 'icons/icon-192.png',
      badge: 'icons/icon-192.png',
      lang: 'ko',
      data: { url: './?screen=explore', schId: null, type: 'wake' },
    });
  })());
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

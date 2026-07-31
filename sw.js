/* 한대장 서비스워커 — 오프라인 캐시 (PWA)
   원칙: **설치된 앱은 지우고 다시 깔지 않아도 항상 최신이어야 한다.**
   - 앱 코드(html/js/css)와 데이터(data/*.json)는 '네트워크 우선' — 배포하면 다음 실행에 바로 반영된다.
     (예전엔 코드가 '캐시 우선'이라 아래 CACHE 버전을 손으로 올리는 걸 잊으면 설치된 앱에 영영 반영되지
      않았다. 사람 기억에 의존하던 이 구멍을 2026-07-31에 막았다.)
   - 그림·아이콘은 자주 바뀌지 않으므로 캐시 우선(빠른 실행).
   - 네트워크가 느리거나 끊기면 캐시로 즉시 폴백 — 오프라인 실행은 그대로 보장된다. */
const CACHE = 'handaejang-v15';
const ASSETS = ['.', 'index.html', 'style.css', 'app.js', 'data.js', 'forms.js', 'manifest.json', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png'];
const NET_TIMEOUT = 3500; /* 이 시간 안에 응답이 없으면 캐시부터 보여주고, 받아온 최신본은 다음 실행에 쓴다 */

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

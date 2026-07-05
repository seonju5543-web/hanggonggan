/* 한대장 서비스워커 — 오프라인 캐시 (PWA) */
const CACHE = 'handaejang-v5';
const ASSETS = ['.', 'index.html', 'style.css', 'app.js', 'data.js', 'forms.js', 'manifest.json', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png'];

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

/* HTML은 네트워크 우선(항상 최신), 정적 자산은 캐시 우선 */
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  /* 실시간 데이터(공고 피드·정식 등록 목록)는 네트워크 우선 — 캐시에 굳으면 매일 갱신이 멈춘다 */
  if (/\/data\/[^/]+\.json$/.test(new URL(e.request.url).pathname)) {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
          return res;
        })
        .catch(() => caches.match(e.request).then((r) => r || caches.match('index.html')))
    );
    return;
  }
  e.respondWith(
    caches.match(e.request).then((cached) => cached || fetch(e.request).then((res) => {
      if (res.ok && e.request.url.startsWith(self.location.origin)) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
      }
      return res;
    }))
  );
});

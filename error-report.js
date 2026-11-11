/* ============================================================
   한대장 — 학생 폰에서 난 앱 오류를 우리가 알게 하는 창구 (2026-11-10 · 은서 · 출시 전 백엔드 7번)
   ------------------------------------------------------------
   왜: 출시 뒤 학생 폰에서 화면이 깨져도 우리는 알 방법이 없었다(아무도 신고하지 않으면 영영 모른다).
   무엇을: 오류 문구 · 오류가 난 파일 이름과 줄 · 그때 보던 화면 이름 · 앱 판 · 거친 기기 이름(예: 아이폰 · Safari).
   🔴 **누구인지 알 수 있는 것은 담지 않는다** — 계정·프로필·이름·연락처·주소창 전체를 보내지 않고,
      오류 문구 안의 주소는 '어느 파일인가'만 남기고(물음표·# 뒤를 지운다 — 로그인 토큰이 거기 붙어 돌아온다),
      메일 주소·전화번호·긴 숫자(주민등록번호·계좌번호·학번)는 지운다. 규칙은 cleanError 한 곳.
   🔴 오류 보고가 앱을 망가뜨리면 안 된다 — 무엇이 실패해도 조용히 지나가고, 한 번 띄운 페이지당 5건까지만,
      같은 오류는 한 번만 보낸다. 보고 중에 난 오류는 다시 보고하지 않는다.
   켜는 곳: supabase-config.js 의 `errorReport` (기본 false). `supabase/migrations/0005_client_errors.sql` 을
      Supabase SQL Editor 에서 실행해 표를 만든 **뒤에** true 로 바꾼다. 표가 없을 때 켜도 앱은 멀쩡하다(요청이 404 로 끝날 뿐).
   보는 곳: Supabase 대시보드 → Table Editor → client_errors (앱으로는 아무도 못 읽는다 — 넣기만 열었다).
   관문: verify/verify-error-report.js (가짜 서버로 나가는 본문을 전부 모아 센다) · test-collector 「앱 오류 수집 창구」.
   ⚠️ 담는 것이 늘었으므로 terms.html 수집 항목 표에도 한 줄 적었다 — 한 세트다.
   ============================================================ */
(function (root) {
  'use strict';
  const MAX_PER_PAGE = 5;
  const LIMITS = { message: 300, source: 80, screen: 40, version: 40, device: 40 };

  /* 오류 문구를 담아도 되는 꼴로 — 순수 함수(브라우저·Node 겸용 · 검사가 그대로 부른다) */
  function cleanText(s, max) {
    let t = String(s == null ? '' : s);
    /* 주소: 어느 파일인가만 남긴다 — 물음표·# 뒤(토큰·검색어)와 사용자 정보(아이디:비번@)를 지운다 */
    t = t.replace(/\b(https?|blob|file):\/\/[^\s'"()<>]+/gi, (u) => {
      try {
        const x = new URL(u.replace(/[),.;]+$/, ''));
        return `${x.protocol}//${x.host}${x.pathname}`;
      } catch (e) { return '[주소]'; }
    });
    t = t.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[메일]');
    t = t.replace(/(access_token|refresh_token|token|apikey|key|code|password)=[^\s&'"]+/gi, '$1=[지움]');
    t = t.replace(/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[토큰]');
    t = t.replace(/\b01[016789][-.\s]?\d{3,4}[-.\s]?\d{4}\b/g, '[전화]');
    t = t.replace(/\d[\d-]{5,}\d/g, (d) => (d.replace(/\D/g, '').length >= 6 ? '[숫자]' : d));
    t = t.replace(/\s+/g, ' ').trim();
    return t.length > max ? t.slice(0, max - 1) + '…' : t;
  }
  /* 오류가 난 파일 — 우리 사이트 파일이면 파일 이름만, 남의 것이면 '바깥' */
  function cleanSource(src, origin) {
    const s = String(src || '');
    if (!s) return '';
    try {
      const u = new URL(s, origin || undefined);
      if (origin && u.origin !== new URL(origin).origin) return '바깥';
      return cleanText(u.pathname.split('/').pop() || '/', LIMITS.source);
    } catch (e) { return ''; }
  }
  const int = (n) => (Number.isFinite(Number(n)) && Number(n) >= 0 ? Math.min(Math.floor(Number(n)), 1e7) : null);

  function cleanError(e, ctx) {
    const c = ctx || {};
    return {
      message: cleanText(e && e.message, LIMITS.message) || '(문구 없음)',
      source: cleanSource(e && e.source, c.origin),
      line: int(e && e.line),
      col: int(e && e.col),
      screen: cleanText(c.screen, LIMITS.screen).replace(/[^A-Za-z0-9_-]/g, ''),
      version: cleanText(c.version, LIMITS.version),
      device: cleanText(c.device, LIMITS.device),
    };
  }
  /* 보내지 않는 것 — 문구가 없는 남의 스크립트 오류('Script error.')와 브라우저가 늘 내는 잡음 */
  const NOISE = /^(Script error\.?|ResizeObserver loop|Non-Error promise rejection captured)/i;
  function worthReporting(msg) { return !!msg && !NOISE.test(String(msg)); }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { cleanError, cleanText, cleanSource, worthReporting, MAX_PER_PAGE, LIMITS };
  }
  if (typeof window === 'undefined') return;

  /* ── 브라우저 ─────────────────────────────────────────── */
  const cfg = () => (typeof SUPABASE_CONFIG !== 'undefined' ? SUPABASE_CONFIG : null);
  /* 🔴 배포된 주소에서만 보낸다 — 검사(CI·로컬)는 localhost 에서 앱을 띄우므로, 막지 않으면 검사 중 난 오류가
     **진짜 표**에 학생 오류와 섞여 쌓인다. 오류 창구 검사만 errorReportLocal 로 연다(검사 복사본에서만 켠다). */
  const local = () => /^(localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0)$/.test(location.hostname);
  const on = () => { const c = cfg(); return !!(c && c.errorReport === true && c.url && c.anonKey && (!local() || c.errorReportLocal === true)); };
  const sent = new Set();
  let count = 0;
  let busy = false;

  function visibleScreen() {
    try {
      const el = Array.from(document.querySelectorAll('.screen')).find((s) => !s.hidden && s.offsetParent !== null);
      return el ? el.id : '';
    } catch (e) { return ''; }
  }
  function report(raw) {
    if (busy || !on() || count >= MAX_PER_PAGE || !worthReporting(raw && raw.message)) return;
    busy = true;
    try {
      const row = cleanError(raw, {
        origin: location.origin,
        screen: visibleScreen(),
        version: typeof APP_VERSION !== 'undefined' ? APP_VERSION : '',
        device: typeof deviceLabel === 'function' ? deviceLabel() : '',
      });
      const key = `${row.message}|${row.source}|${row.line}`;
      if (sent.has(key)) return;
      sent.add(key);
      count += 1;
      const c = cfg();
      fetch(String(c.url).replace(/\/+$/, '') + '/rest/v1/client_errors', {
        method: 'POST',
        keepalive: true,
        headers: { apikey: c.anonKey, Authorization: 'Bearer ' + c.anonKey, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify(row),
      }).catch(() => {});
    } catch (e) { /* 보고가 앱을 망가뜨리지 않는다 */ } finally { busy = false; }
  }
  window.addEventListener('error', (ev) => {
    if (!ev || ev.target !== window && ev.target && ev.target.tagName) return;   // 그림·스크립트 못 받음(자원 오류)은 오류 문구가 없다
    report({ message: ev.message || (ev.error && ev.error.message), source: ev.filename, line: ev.lineno, col: ev.colno });
  });
  window.addEventListener('unhandledrejection', (ev) => {
    const r = ev && ev.reason;
    report({ message: r && (r.message || (typeof r === 'string' ? r : '')), source: '', line: null, col: null });
  });
  root.reportAppError = report;   // 검사·수동 보고용
})(typeof window !== 'undefined' ? window : globalThis);

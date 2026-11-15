/* ============================================================
   한대장 — 이용 횟수 세기 (2026-11-15 · 은서 · 사용자 트랙션 — 선주 요청)
   ------------------------------------------------------------
   왜: 어떤 공고를 얼마나 보고, 어떤 기능을 얼마나 쓰는지 몰랐다(공고별 클릭 수·신청서 작성 수).
   🔴 **누가 했는지는 담지 않는다** — 계정·이름·기기 번호를 보내지 않는다. 보내는 것은
      행동 이름 · 공고 번호 · 그 학생의 학년·계열·지역·학교 **카테고리**뿐이고,
      서버는 낱낱의 기록을 남기지 않고 **하루 단위 합계**에 1을 더할 뿐이다(supabase/migrations/0007_usage_counts.sql).
      학교는 학년·계열과 섞지 않고 따로 센다 · 특별자격·소득·성적은 카테고리로 쓰지 않는다(민감정보).
   🔴 세기가 앱을 망가뜨리면 안 된다 — 실패해도 조용히 지나가고, 한 페이지에서 같은 행동·같은 공고는 한 번만 센다.
   켜는 곳: supabase-config.js 의 `usageReport` (0007 SQL 을 실행한 뒤 true) · 검사 환경(localhost)에서는 보내지 않는다.
   보는 곳: 관리자 사이트의 「아침 지표」(_admin/morning.html) — 5건 미만 칸은 가려서 보인다.
   ⚠️ terms.html 수집 항목 표와 한 세트다.
   관문: verify/health-gates/ops.mjs 「⑬ 이용 횟수 세기」
   ============================================================ */
(function (root) {
  'use strict';
  /* 세는 행동 — 서버(0007 track_usage)의 목록과 같아야 한다(관문이 대조) */
  const USAGE_EVENTS = ['open', 'onboard', 'detail', 'save', 'source', 'prep', 'form_open', 'form_edit', 'submitted'];
  /* 프로필 → 카테고리. 특별자격·소득·성적은 넣지 않는다 */
  function usageCategory(p) {
    const prof = p || {};
    const y = Number(prof.year);
    const grade = Number.isFinite(y) && y >= 1 ? (y >= 5 ? '5+' : String(Math.floor(y))) : '?';
    const track = /^[a-z_]{2,20}$/.test(String(prof.track || '')) ? String(prof.track) : '?';
    const region = String(prof.region || '').trim().slice(0, 12) || '?';
    const school = String(prof.school || '').trim().slice(0, 40) || '?';
    return { grade, track, region, school };
  }
  /* 공고 번호 — 정식 등록·층2 는 id 그대로, 대외활동은 주소 대신 짧은 지문(주소를 보내지 않는다) */
  function usageItem(raw) {
    const s = String(raw == null ? '' : raw);
    if (!/^https?:\/\//.test(s)) return s.slice(0, 80);
    let h = 2166136261;
    for (let i = 0; i < s.length; i += 1) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return 'a:' + (h >>> 0).toString(36);
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { USAGE_EVENTS, usageCategory, usageItem };
  }
  if (typeof window === 'undefined') return;
  root.usageItem = usageItem;          // 관리자 「아침 지표」가 활동 지문을 같은 규칙으로 되짚는다(베끼지 않는다)
  root.USAGE_EVENTS = USAGE_EVENTS;
  /* 관리자 사이트는 세지 않는다 — 그 페이지를 여는 우리 클릭이 학생 횟수에 섞이면 안 된다 */
  if (root.__usageOff === true) return;
  /* ── 브라우저 ─────────────────────────────────────────── */
  const cfg = () => (typeof SUPABASE_CONFIG !== 'undefined' ? SUPABASE_CONFIG : null);
  const local = () => /^(localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0)$/.test(location.hostname);
  const on = () => { const c = cfg(); return !!(c && c.usageReport === true && c.url && c.anonKey && (!local() || c.usageReportLocal === true)); };
  const seen = new Set();
  function trackUse(event, item) {
    try {
      if (!on() || USAGE_EVENTS.indexOf(event) < 0) return;
      const it = usageItem(item);
      const key = event + '|' + it;
      if (seen.has(key)) return;
      seen.add(key);
      const prof = (typeof state !== 'undefined' && state && state.profile) || null;
      const cat = usageCategory(prof);
      const c = cfg();
      fetch(String(c.url).replace(/\/+$/, '') + '/rest/v1/rpc/track_usage', {
        method: 'POST',
        keepalive: true,
        headers: { apikey: c.anonKey, Authorization: 'Bearer ' + c.anonKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_event: event, p_item: it, p_grade: cat.grade, p_track: cat.track, p_region: cat.region, p_school: cat.school }),
      }).catch(() => {});
    } catch (e) { /* 세기가 앱을 망가뜨리지 않는다 */ }
  }
  /* 하루 한 번 '앱을 열었다' — 기기 번호 없이 날짜 표시만 기기에 둔다(같은 날 두 번 세지 않게) */
  function trackDailyOpen() {
    try {
      const day = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
      if (localStorage.getItem('handaejang.usage.open') === day) return;
      if (typeof state === 'undefined' || !state || !state.profile) return;   // 온보딩 전에는 카테고리가 없다
      localStorage.setItem('handaejang.usage.open', day);
      trackUse('open', '');
    } catch (e) { /* 무시 */ }
  }
  /* 원문 열기 — 상세 시트·카드의 바깥 링크를 한 곳에서 듣는다(그리는 함수마다 달지 않는다) */
  document.addEventListener('click', (ev) => {
    try {
      const a = ev.target && ev.target.closest && ev.target.closest('a[target="_blank"][href^="http"]');
      if (!a) return;
      const sheet = a.closest('#detail-sheet');
      const card = a.closest('[data-detail]');
      const raw = sheet ? (sheet.dataset.useItem || '') : (card ? card.dataset.detail : '');
      const item = String(raw).replace(/^act:/, '');   // 활동은 주소 → 지문(usageItem)으로 같은 번호
      if (sheet || a.classList.contains('card-src-link')) trackUse('source', item);
    } catch (e) { /* 무시 */ }
  }, true);
  root.trackUse = trackUse;
  root.trackDailyOpen = trackDailyOpen;
  window.addEventListener('load', () => setTimeout(trackDailyOpen, 3000));
})(typeof window !== 'undefined' ? window : globalThis);

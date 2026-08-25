/* ============================================================
   한대장 — 회원가입·로그인·기기 간 이어쓰기 (2026-08-25)
   ------------------------------------------------------------
   해결하는 문제(개발자 말 그대로):
     *"핸드폰으로 로그인했을 때 정보가 저장되지 않아 다른 기기와 연결이 되지 않는다."*
   프로필·신청내역이 폰 안(localStorage)에만 있어서 기기를 바꾸면 온보딩부터 다시 해야 했다.

   🔴 이 파일이 지키는 세 가지 (되돌리지 말 것)
   ─────────────────────────────────────────────────────────────
   ① **SDK를 쓰지 않는다.** index.html 의 보안 설정(CSP)이 `script-src 'self'` 라
      외부 스크립트를 차단한다. 그 차단은 "수집 데이터가 오염돼도 코드 실행 불가"라는
      이 앱의 보안 근거 그 자체다 — CDN 을 허용하면 그 방어가 통째로 깨진다.
      필요한 것은 주소 4개뿐이라 fetch 로 직접 부른다(의존성 0). 푸시·도우미 서버와 같은 방식.
   ② **기기 우선.** 화면은 항상 폰 안 데이터로 즉시 뜬다. 서버는 뒤에서 맞출 뿐이다.
      서버 우선으로 바꾸면 지하철·비행기모드에서 화면이 비거나 온보딩이 다시 뜬다
      (이 앱은 오프라인 실행을 보장한다 — sw.js 첫머리 주석).
   ③ **주민등록번호·계좌번호·서류 스캔은 나가지 않는다.** MY 화면에 "이 기기에만
      저장돼요"라고 적혀 있고, terms.html 에도 그렇게 적었다. 말이 아니라 코드로 지킨다 —
      `syncSafeProfile()` 한 곳에서 떼어내고, verify/verify-supabase.js 가 나가는 요청
      본문을 전부 모아 그것이 사실인지 센다.
   ─────────────────────────────────────────────────────────────
   ============================================================ */

/* 로그인 표 — 토큰은 폰 안에만 둔다. 서비스워커는 이 값을 안 쓴다(로그인을 모른다). */
const AUTH_KEY = 'handaejang.auth';

/* 🔴 서버로 내보내지 않을 것 — 이 목록이 약속의 전부다.
   `rrn`(주민등록번호)·`account`(계좌번호)는 신청서를 채우다 앱이 배운 값이라
   학생이 서버에 올리겠다고 한 적이 없다. */
const SYNC_OMIT_COMMON = ['rrn', 'account'];

/* 특별자격(기초생활수급·장애·국가유공자 등)은 **민감정보**라 별도 동의가 필요하다.
   동의하지 않으면 서버로 올리지 않는다 — 기기에는 그대로 남으므로 매칭은 지금과 똑같다. */
const SYNC_SENSITIVE_KEYS = ['flags'];

/* ---------------- 로그인 상태 ---------------- */
function authLoad() {
  try { return JSON.parse(localStorage.getItem(AUTH_KEY)) || null; } catch { return null; }
}
function authSave(t) { localStorage.setItem(AUTH_KEY, JSON.stringify(t)); }
function authClear() { localStorage.removeItem(AUTH_KEY); }

function authUser() {
  const t = authLoad();
  return t && t.userId ? { userId: t.userId, email: t.email || '' } : null;
}
function signedIn() { return !!(supabaseConfigured() && authUser()); }

/* 서버 응답(토큰 묶음)을 우리 표 모양으로 바꾼다 */
function authStore(json) {
  if (!json || !json.access_token) return null;
  const t = {
    accessToken: json.access_token,
    refreshToken: json.refresh_token || '',
    /* expires_in 은 초 단위. 만료 1분 전에 미리 갱신한다. */
    expiresAt: Date.now() + Math.max(0, (json.expires_in || 3600) - 60) * 1000,
    userId: (json.user && json.user.id) || (authLoad() || {}).userId || '',
    email: (json.user && json.user.email) || (authLoad() || {}).email || '',
  };
  authSave(t);
  return t;
}

/* ---------------- 서버와 말하기 ---------------- */
function sbUrl(path) { return String(SUPABASE_CONFIG.url).replace(/\/+$/, '') + path; }

/* 시간이 지나도 답이 없으면 포기한다 — 안 그러면 화면이 영영 '보내는 중'에 머문다 */
function sbFetch(path, opts) {
  const o = opts || {};
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), SUPABASE_CONFIG.timeoutMs || 8000) : null;
  const headers = Object.assign({
    apikey: SUPABASE_CONFIG.anonKey,
    'Content-Type': 'application/json',
  }, o.headers || {});
  return fetch(sbUrl(path), {
    method: o.method || 'GET',
    headers,
    body: o.body ? JSON.stringify(o.body) : undefined,
    signal: ctrl ? ctrl.signal : undefined,
  }).then(async (res) => {
    if (timer) clearTimeout(timer);
    const text = await res.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch { /* 본문이 JSON이 아닐 수 있다 */ }
    return { ok: res.ok, status: res.status, json, text };
  }).catch((e) => {
    if (timer) clearTimeout(timer);
    return { ok: false, status: 0, json: null, text: String(e && e.message || e) };
  });
}

/* 로그인한 사람 자격으로 부르기. 토큰이 만료됐으면 조용히 한 번 갱신하고 다시 시도한다. */
async function sbAuthed(path, opts, retried) {
  let t = authLoad();
  if (!t) return { ok: false, status: 401, json: null, text: '로그인 필요' };
  if (t.expiresAt && Date.now() > t.expiresAt && t.refreshToken && !retried) {
    await authRefresh();
    t = authLoad();
    if (!t) return { ok: false, status: 401, json: null, text: '로그인 필요' };
  }
  const o = Object.assign({}, opts);
  o.headers = Object.assign({ Authorization: 'Bearer ' + t.accessToken }, o.headers || {});
  const res = await sbFetch(path, o);
  if (res.status === 401 && !retried) {
    const ok = await authRefresh();
    if (ok) return sbAuthed(path, opts, true);
    authClear();          // 갱신도 안 되면 로그인이 끝난 것이다
  }
  return res;
}

/* 서버가 준 오류 문구는 영어라 그대로 보여 주면 학생이 못 읽는다 */
function authErrorText(res) {
  const m = String((res.json && (res.json.msg || res.json.error_description || res.json.message)) || res.text || '');
  if (res.status === 0) return '인터넷 연결을 확인해 주세요';
  if (/already registered|already been registered/i.test(m)) return '이미 가입된 이메일이에요. 로그인해 주세요';
  if (/Invalid login credentials/i.test(m)) return '이메일 또는 비밀번호가 맞지 않아요';
  if (/Password should be at least/i.test(m)) return '비밀번호는 6자 이상이어야 해요';
  if (/valid email/i.test(m)) return '이메일 주소를 다시 확인해 주세요';
  if (/Email not confirmed/i.test(m)) return '가입 확인 메일의 링크를 먼저 눌러 주세요';
  return m ? `문제가 생겼어요 (${m})` : '문제가 생겼어요. 잠시 후 다시 시도해 주세요';
}

/* ---------------- 가입 · 로그인 · 로그아웃 ---------------- */
async function authSignUp(email, password) {
  const res = await sbFetch('/auth/v1/signup', { method: 'POST', body: { email, password } });
  if (!res.ok) return { ok: false, error: authErrorText(res) };
  /* 이메일 확인을 켜 두면 토큰 없이 사용자 정보만 온다 — 그때는 '메일을 확인하세요'로 안내한다 */
  if (!res.json || !res.json.access_token) return { ok: true, needsEmailConfirm: true };
  authStore(res.json);
  return { ok: true, needsEmailConfirm: false };
}

async function authSignIn(email, password) {
  const res = await sbFetch('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password } });
  if (!res.ok) return { ok: false, error: authErrorText(res) };
  authStore(res.json);
  return { ok: true };
}

async function authRefresh() {
  const t = authLoad();
  if (!t || !t.refreshToken) return false;
  const res = await sbFetch('/auth/v1/token?grant_type=refresh_token', {
    method: 'POST', body: { refresh_token: t.refreshToken },
  });
  if (!res.ok || !res.json || !res.json.access_token) return false;
  authStore(res.json);
  return true;
}

async function authSignOut() {
  const t = authLoad();
  if (t) await sbAuthed('/auth/v1/logout', { method: 'POST' });
  authClear();
}

/* 탈퇴 — 방침에 "탈퇴하면 지웁니다"라고 적는 이상 실제로 지울 수 있어야 한다.
   회원 계정 자체를 지우는 것은 만능 열쇠가 있어야 하므로(앱에 두면 안 된다) 여기서는
   **서버에 저장된 내 프로필 행을 지우고 로그아웃**한다. 계정 껍데기는 남지만 개인정보는 없다.
   ⚠️ 계정까지 완전히 없애려면 Supabase Edge Function 이 필요하다 — 다음 단계. */
async function authDeleteData() {
  const u = authUser();
  if (!u) return { ok: false, error: '로그인 상태가 아니에요' };
  const res = await sbAuthed(`/rest/v1/profiles?user_id=eq.${encodeURIComponent(u.userId)}`, { method: 'DELETE' });
  if (!res.ok) return { ok: false, error: authErrorText(res) };
  authClear();
  return { ok: true };
}

/* ---------------- 🔴 나가도 되는 것만 남기기 ---------------- */
/* 순수 함수 — 브라우저 없이 검사할 수 있다. 이 파일에서 서버로 나가는 프로필은
   **반드시** 이 함수를 거친다. 다른 데서 profile 을 직접 보내는 코드를 만들지 말 것. */
function syncSafeProfile(profile, sensitiveOk) {
  if (!profile) return null;
  const p = JSON.parse(JSON.stringify(profile));
  if (p.common) {
    for (const k of SYNC_OMIT_COMMON) delete p.common[k];
  }
  if (!sensitiveOk) {
    for (const k of SYNC_SENSITIVE_KEYS) delete p[k];
  }
  return p;
}

/* ---------------- 올리기 · 내려받기 ---------------- */
/* 서버에 올린다. 실패해도 앱은 아무 일 없이 계속 돈다 — 폰 안 저장이 원본이다. */
async function syncPush(state) {
  if (!signedIn() || !state) return { ok: false, skipped: true };
  const u = authUser();
  const sensitiveOk = !!(state.consent && state.consent.sensitive);
  const row = {
    user_id: u.userId,
    profile: syncSafeProfile(state.profile, sensitiveOk),
    applications: state.applications || [],
    sensitive_ok: sensitiveOk,
    updated_at: new Date().toISOString(),
  };
  const res = await sbAuthed('/rest/v1/profiles', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: [row],
  });
  return { ok: res.ok, error: res.ok ? null : authErrorText(res) };
}

/* 서버에서 내려받는다. 없으면(첫 로그인 전) null. */
async function syncPull() {
  if (!signedIn()) return null;
  const u = authUser();
  const res = await sbAuthed(
    `/rest/v1/profiles?user_id=eq.${encodeURIComponent(u.userId)}&select=profile,applications,sensitive_ok,updated_at`);
  if (!res.ok || !Array.isArray(res.json) || !res.json.length) return null;
  const row = res.json[0];
  return {
    profile: row.profile || null,
    applications: row.applications || [],
    sensitiveOk: !!row.sensitive_ok,
    updatedAt: row.updated_at || null,
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    syncSafeProfile, SYNC_OMIT_COMMON, SYNC_SENSITIVE_KEYS, authErrorText,
  };
}

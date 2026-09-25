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
/* '아이디 저장' — 이메일 한 줄뿐이고 비밀번호는 절대 저장하지 않는다.
   비밀번호를 저장하면 폰을 잃어버렸을 때 그대로 남의 것이 된다. */
const REMEMBER_KEY = 'handaejang.remember';

/* 🔴 서버로 내보내지 않을 것 — 이 목록이 약속의 전부다.
   `rrn`(주민등록번호)·`account`(계좌번호)는 신청서를 채우다 앱이 배운 값이라
   학생이 서버에 올리겠다고 한 적이 없다. */
const SYNC_OMIT_COMMON = ['rrn', 'account'];

/* 특별자격(기초생활수급·장애·국가유공자 등)은 **민감정보**라 별도 동의가 필요하다.
   동의하지 않으면 서버로 올리지 않는다 — 기기에는 그대로 남으므로 매칭은 지금과 똑같다.
   🔴 **`traits`(처지) 도 같은 칸이다** (2026-09-18 코드 리뷰에서 잡았다). 그 묶음에는
      `religion`(해당 종교)·`married`(혼인 여부)·`military`(군 복무)·`farm`(농어촌 가정)이
      들어간다 — 종교는 개인정보 보호법 제23조가 이름을 적어 둔 민감정보다. 새로 생긴 칸이
      이 목록에 안 들어와서 **동의와 무관하게 서버로 나가고 있었다**(Supabase 는 켜져 있다).
   ⚠️ 프로필에 민감한 칸을 새로 만들면 **여기에 이름을 더하는 것까지가 한 세트**다.
      관문 `verify/verify-supabase.js` 가 나가는 요청 본문을 모아 실제로 안 나가는지 센다. */
const SYNC_SENSITIVE_KEYS = ['flags', 'traits'];

/* ---------------- 로그인 상태 ---------------- */
function authLoad() {
  try { return JSON.parse(localStorage.getItem(AUTH_KEY)) || null; } catch { return null; }
}
function authSave(t) { localStorage.setItem(AUTH_KEY, JSON.stringify(t)); }
/* ⚠️ 로그인이 끝나면 '서버에서 본 판' 기억도 같이 버린다 — 다음 사람이 남의 판을
   물려받아 조건부 수정이 엉뚱하게 맞거나 빗나가면 안 된다(syncVerLoad 가 사람도 대조하지만
   같은 사람이 다시 로그인할 때 옛 판이 남아 있으면 첫 push 가 헛돈다). */
function authClear() { localStorage.removeItem(AUTH_KEY); syncVerClear(); }

function rememberedEmail() {
  try { return localStorage.getItem(REMEMBER_KEY) || ''; } catch { return ''; }
}
function setRememberedEmail(email) {
  try {
    if (email) localStorage.setItem(REMEMBER_KEY, email);
    else localStorage.removeItem(REMEMBER_KEY);
  } catch { /* 저장 공간이 막혀 있어도 로그인은 되어야 한다 */ }
}

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
    /* 공식 라이브러리와 같은 모양으로 보낸다 — 새 publishable 열쇠는 이 조합을 전제로 한다.
       로그인한 자격으로 부를 때는 sbAuthed 가 이 줄을 사용자 토큰으로 덮어쓴다. */
    Authorization: 'Bearer ' + SUPABASE_CONFIG.anonKey,
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
  authLogLogin();           // 가입하자마자 토큰이 오면 그것도 로그인이다
  return { ok: true, needsEmailConfirm: false };
}

async function authSignIn(email, password) {
  const res = await sbFetch('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password } });
  if (!res.ok) return { ok: false, error: authErrorText(res) };
  authStore(res.json);
  authLogLogin();           // 기다리지 않는다 — 기록이 로그인을 붙잡으면 안 된다
  return { ok: true };
}

/* 🔴 **갱신은 한 번에 하나만 나간다** (2026-09-21 — 기술 고문 요청서 Q8 이 의심한 결함이 사실이었다).

   Supabase 는 갱신 토큰을 **한 번 쓰면 새것으로 바꾼다(회전)**. 그런데 이 함수를 부를 수 있는
   자리가 11곳이라, 프로필 읽기와 쓰기가 같은 순간에 만료를 맞으면 둘이 각자 갱신을 시도한다.
   먼저 도착한 쪽이 토큰을 써 버리므로 **뒤쪽은 이미 죽은 토큰을 내밀어 실패하고**,
   `sbAuthed` 가 그걸 "갱신도 안 된다"로 읽어 `authClear()` — 즉 **멀쩡한 로그인이 풀린다.**

   처방 이름은 single-flight 다: 진행 중인 갱신이 있으면 **새로 부르지 않고 그 하나를 같이 기다린다.**
   ⚠️ `finally` 로 반드시 비운다 — 안 비우면 첫 실패가 영원히 캐시돼 다시는 갱신하지 못한다.
   ⚠️ 이건 **한 탭 안**을 막는다. 탭을 여러 개 띄우면 각 탭이 제 장부를 갖고 있어 여전히 부딪힐
      수 있다(표준 해법은 Web Locks API). → **2026-09-23 에 막았다. 아래를 볼 것.** */

/* 🔴 **탭 사이도 막는다** (2026-09-23 — 위 ⚠️ 가 "켜기 전에 결정할 일"로 남겨 둔 그 숙제).
   로그인이 실제로 켜져 앱에 배포된 뒤라 더 미룰 수 없었다. 실측한 피해는 이렇다:
   탭 A 가 갱신에 성공하면 탭 B 가 든 갱신 토큰은 **그 순간 죽는다**. 탭 B 의 이 함수가
   false 를 돌려주고, `sbAuthed` 가 그것을 "로그인이 끝났다"로 읽어 `authClear()` —
   탭 A 가 방금 받아 온 **멀쩡한 토큰까지** 지운다. 두 탭이 같이 로그아웃된다.

   ① 줄을 세운다(Web Locks) — 탭 B 는 탭 A 가 끝날 때까지 기다린다.
   ② 🔴 **기다린 뒤에는 서버를 다시 부르지 않는다.** 줄만 세우면 탭 B 는 제 차례에
      여전히 죽은 토큰을 내민다(순서만 바뀌고 결과는 같다). 그래서 잠금을 잡은 **직후에
      저장소를 다시 읽어**, 토큰이 바뀌어 있으면 '이미 누가 해 놨다'로 보고 성공을 돌려준다.
      ①만으로는 안 고쳐진다 — 실제로 고치는 것은 ②다.
   ⚠️ 잠금을 못 쓰는 환경이면 **지금 동작 그대로** 둔다(한 탭 안 보호는 남는다).
      기능이 없다고 로그인이 깨지면 안 된다.
   관문: verify/verify-supabase.js [9] 절 — 탭 두 개를 **같은 context** 에 띄우고
        가짜 서버가 실제로 토큰을 회전시킨다(안 그러면 이 사고가 재현되지 않는다). */
const AUTH_LOCK = 'handaejang-auth-refresh';

/* 잠금을 잡고 부른다. ⚠️ **fn 이 시작됐는지 기억한다** — 안 그러면 fn 이 던진 오류를
   '잠금을 못 잡았다'로 잘못 읽고 fn 을 두 번 부른다(갱신을 두 번 하는 셈이라 사고가 되돌아온다). */
function withAuthLock(fn) {
  const locks = typeof navigator !== 'undefined' && navigator.locks;
  if (!locks || typeof locks.request !== 'function') return fn();
  let started = false;
  const wrapped = () => { started = true; return fn(); };
  return Promise.resolve()
    .then(() => locks.request(AUTH_LOCK, wrapped))
    .catch((e) => { if (started) throw e; return fn(); });
}

let authRefreshing = null;

async function authRefresh() {
  if (authRefreshing) return authRefreshing;          // 이미 돌고 있으면 그것을 같이 기다린다
  /* 🔴 기다리기 **전에** 적어 둔다 — 기다린 뒤에 읽으면 무엇이 바뀌었는지 알 수 없다. */
  const had = (authLoad() || {}).refreshToken || '';
  authRefreshing = withAuthLock(() => authRefreshLocked(had));
  try { return await authRefreshing; } finally { authRefreshing = null; }
}

async function authRefreshLocked(had) {
  const t = authLoad();
  if (!t || !t.refreshToken) return false;
  /* 기다리는 동안 다른 탭이 이미 갱신했다 — 여기서 서버를 부르면 **죽은 토큰**을 내밀게 된다. */
  if (had && t.refreshToken !== had) return true;

  const res = await sbFetch('/auth/v1/token?grant_type=refresh_token', {
    method: 'POST', body: { refresh_token: t.refreshToken },
  });
  if (res.ok && res.json && res.json.access_token) { authStore(res.json); return true; }

  /* 🔴 **실패했다고 곧바로 '로그인이 끝났다'가 아니다** (2026-09-23 · 실측으로 드러났다).
     잠금이 순서를 지켜 줘도, 앞 탭이 저장소에 적은 새 토큰이 **이 탭에 아직 안 보일 수
     있다** — localStorage 는 탭 사이에서 즉시 보이지 않는다(검사 5번 중 2번 실패로 재현).
     그래서 위 한 줄짜리 비교만으로는 못 막는다. 짧게 지켜보다 토큰이 바뀌면 성공이다.
     ⚠️ 이 기다림은 **실패했을 때만** 치른다 — 흔한 경우(탭 하나)는 조금도 안 느려진다. */
  return waitForOtherTabRefresh(t.refreshToken);
}

/* 다른 탭이 갱신한 결과가 이 탭에 보일 때까지 짧게 지켜본다.
   ⚠️ 못 보고 끝나면 **진짜로 실패한 것**이라 false 를 돌려준다 — 그때는 로그인을 정리하는 게 맞다.
   ⚠️ 시한을 없애지 말 것: 없으면 정말 만료된 로그인이 영영 안 끝난다. */
const AUTH_PROPAGATE_MS = 600;
function waitForOtherTabRefresh(oldToken) {
  const until = Date.now() + AUTH_PROPAGATE_MS;
  return new Promise((resolve) => {
    const look = () => {
      const now = (authLoad() || {}).refreshToken || '';
      if (now && now !== oldToken) return resolve(true);
      if (Date.now() >= until) return resolve(false);
      setTimeout(look, 25);
    };
    look();
  });
}

/* 이 앱이 열려 있는 주소 — 메일 링크와 소셜 로그인이 **여기로 되돌아온다**.
   ⚠️ 이 주소가 Supabase 대시보드의 Redirect URLs 에 등록돼 있어야 한다. 아니면
      "requested path is invalid" 로 튕긴다. */
function authRedirectTo() {
  return location.origin + location.pathname;
}

/* 비밀번호 재설정 메일 보내기.
   🔴 기본 메일 발송기는 시간당 2통이고 **팀원이 아닌 주소로는 거부**한다(supabase-config.js 주석).
      그래서 실패해도 "메일을 보냈다"고 단정하지 않는다 — 서버가 성공을 주면 그대로 전한다. */
async function authResetRequest(email) {
  /* 🔴 돌아올 주소는 **주소 뒤에 붙인다**(redirect_to=). 헤더로 보내면 브라우저가
     CORS 사전 확인 단계에서 막아 요청 자체가 안 나간다 — 실제로 그렇게 막혔다. */
  const res = await sbFetch('/auth/v1/recover?redirect_to=' + encodeURIComponent(authRedirectTo()), {
    method: 'POST',
    body: { email },
  });
  if (!res.ok) return { ok: false, error: authErrorText(res) };
  return { ok: true };
}

/* 메일 링크로 돌아온 뒤 새 비밀번호를 정한다 (그 링크가 준 토큰으로 부른다) */
async function authUpdatePassword(password) {
  const res = await sbAuthed('/auth/v1/user', { method: 'PUT', body: { password } });
  if (!res.ok) return { ok: false, error: authErrorText(res) };
  return { ok: true };
}

/* 소셜 로그인 — 이 주소로 **화면을 통째로 옮긴다**(리디렉션). SDK 가 필요 없고,
   CSP 는 화면 이동을 막지 않는다(connect-src 는 데이터 요청에만 걸린다). */
function authOAuthUrl(provider) {
  return sbUrl('/auth/v1/authorize?provider=' + encodeURIComponent(provider)
    + '&redirect_to=' + encodeURIComponent(authRedirectTo()));
}
function authOAuthGo(provider) { location.href = authOAuthUrl(provider); }

/* 토큰만 있고 누구인지 모를 때(소셜·메일 링크로 돌아온 직후) 사람 정보를 받아 온다 */
async function authFetchUser() {
  const res = await sbAuthed('/auth/v1/user');
  if (!res.ok || !res.json) return null;
  const t = authLoad();
  if (t) { t.userId = res.json.id || t.userId; t.email = res.json.email || t.email; authSave(t); }
  return res.json;
}

/* 🔴 소셜 로그인·메일 링크는 **주소 뒤에 토큰을 붙여** 돌아온다
   (…/#access_token=…&type=recovery). 그걸 주워 담고 주소창을 깨끗이 지운다 —
   안 지우면 학생이 그 주소를 복사해 남에게 보내는 순간 계정이 넘어간다.
   돌려주는 값: null | 'signin' | 'recovery' */
async function authCaptureFromUrl() {
  if (!supabaseConfigured()) return null;
  const hash = String(location.hash || '').replace(/^#/, '');
  if (!hash || hash.indexOf('access_token=') < 0) return null;
  const q = new URLSearchParams(hash);
  const kind = q.get('type') === 'recovery' ? 'recovery' : 'signin';
  authStore({
    access_token: q.get('access_token'),
    refresh_token: q.get('refresh_token') || '',
    expires_in: Number(q.get('expires_in') || 3600),
  });
  /* 주소창에서 토큰을 지운다 — 뒤로 가기 기록에도 안 남게 replaceState 를 쓴다 */
  try { history.replaceState(null, '', location.pathname + location.search); } catch { location.hash = ''; }
  await authFetchUser();
  const u = authUser();
  if (u && u.email) setRememberedEmail(u.email);
  /* 🔴 소셜·메일 링크로 들어온 것도 로그인이다. 여기서 안 남기면 구글로만 쓰는 계정은
     '로그인 활동'이 늘 비어 있고, 낯선 기기를 찾으라고 만든 화면이 오히려 안심시킨다.
     ⚠️ 비밀번호 재설정(recovery)은 아직 로그인이 아니라 그 자리는 빼고 센다. */
  if (kind === 'signin') authLogLogin();
  return kind;
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
  /* 🔴 로그인 기록도 같이 지운다 — 약관이 '탈퇴 시 지체 없이 파기'라고 적고 있다.
     계정 껍데기가 남아 cascade 가 안 돌고, 로그아웃하고 나면 학생이 스스로 지울 길도 없다.
     ⚠️ 프로필을 지운 **뒤**에 지운다. 여기서 실패해도 탈퇴 자체는 성공으로 둔다 —
        프로필(진짜 개인정보)은 이미 지워졌고, 여기서 막으면 탈퇴가 통째로 안 된다. */
  try {
    await sbAuthed(`/rest/v1/login_events?user_id=eq.${encodeURIComponent(u.userId)}`, { method: 'DELETE' });
  } catch (e) { /* 표가 아직 없을 수 있다(마이그레이션 전) */ }
  authClear();
  return { ok: true };
}

/* ---------------- 로그인 활동 (2026-09-11) ----------------
   "내 계정에 언제 어디서 로그인됐나"를 학생이 직접 본다. 낯선 기기가 보이면 비밀번호를
   바꾸라고 알려 주는 것이 목적이다.

   🔴 **적게 담는다.** 시각과 **거친 기기 이름** 둘뿐이다.
      · IP·위치는 담지 않는다 — 브라우저에서 알 수도 없고, 담으면 훨씬 민감해진다.
      · UA 원문을 통째로 담지 않는다 — 그건 기기를 특정하는 지문이 된다. 낱말 몇 개만 뽑는다.
   🔴 기록 남기기가 **로그인을 막으면 안 된다** — 표가 아직 없거나(마이그레이션 전) 인터넷이
      끊겨도 로그인 자체는 그대로 되어야 한다. 그래서 실패해도 조용히 지나간다.
   ⚠️ 담는 것이 늘었으므로 `terms.html` 수집 항목에도 적었다. 한 세트다. */

/* 거친 기기 이름 — '아이폰 · Safari' 정도. 못 알아보면 지어내지 않고 빈 값을 둔다. */
function deviceLabel(ua) {
  const s = String(ua || (typeof navigator !== 'undefined' ? navigator.userAgent : ''));
  if (!s) return '';
  let os = '';
  if (/iPhone/i.test(s)) os = '아이폰';
  else if (/iPad/i.test(s)) os = '아이패드';
  else if (/Android/i.test(s)) os = '안드로이드';
  else if (/Mac OS X|Macintosh/i.test(s)) os = '맥';
  else if (/Windows/i.test(s)) os = '윈도우';
  /* 🔴 순서가 중요하다 — 엣지·삼성인터넷·크롬은 UA 에 전부 'Chrome' 을 달고 다니고,
     iOS 의 크롬·엣지는 'Safari' 까지 단다. 좁은 것부터 본다. */
  let br = '';
  if (/Edg\//i.test(s)) br = 'Edge';
  else if (/SamsungBrowser/i.test(s)) br = '삼성 인터넷';
  else if (/CriOS|Chrome\//i.test(s)) br = 'Chrome';
  else if (/FxiOS|Firefox\//i.test(s)) br = 'Firefox';
  else if (/Safari\//i.test(s)) br = 'Safari';
  return [os, br].filter(Boolean).join(' · ');
}

/* 이 설치본을 가리키는 **뜻 없는 임의 문자열**. '현재 기기' 배지를 정확히 붙이려고 둔다 —
   기기 이름만으로 견주면 같은 기종을 쓰는 남의 로그인에 '현재 기기'가 붙어, 낯선 기기를
   찾으라고 만든 화면이 오히려 안심시킨다. 지우면 새로 만들어지는 난수일 뿐이다. */
const CLIENT_KEY = 'handaejang.client';
function clientId() {
  try {
    let v = localStorage.getItem(CLIENT_KEY);
    if (!v) {
      v = (crypto && crypto.randomUUID) ? crypto.randomUUID()
        : String(Date.now()) + '-' + Math.random().toString(36).slice(2);
      localStorage.setItem(CLIENT_KEY, v);
    }
    return v;
  } catch (e) { return ''; }
}

/* 로그인 직후 한 줄 남긴다. 🔴 실패해도 로그인은 성공으로 둔다. */
async function authLogLogin() {
  try {
    const u = authUser();
    if (!u || !supabaseConfigured()) return;
    await sbAuthed('/rest/v1/login_events', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: { user_id: u.userId, device: deviceLabel(), client: clientId() },
    });
  } catch (e) { /* 표가 아직 없거나 인터넷이 끊겼다 — 로그인은 그대로 된다 */ }
}

/* 최근 기록을 읽는다. 돌려주는 것은 { ok, items } — 🔴 '없다'와 '못 읽었다'를 가른다.
   못 읽은 것을 '없다'로 보여 주면 낯선 기기를 놓치게 된다(원칙 8-1과 같은 계열). */
async function authLoginEvents(limit) {
  const u = authUser();
  if (!u || !supabaseConfigured()) return { ok: false, items: [], reason: 'signedout' };
  const n = Math.min(50, Math.max(1, limit || 20));
  try {
    const res = await sbAuthed(
      `/rest/v1/login_events?user_id=eq.${encodeURIComponent(u.userId)}&select=at,device,client&order=at.desc&limit=${n}`);
    if (!res.ok) return { ok: false, items: [], reason: 'error' };
    return { ok: true, items: Array.isArray(res.json) ? res.json : [] };
  } catch (e) { return { ok: false, items: [], reason: 'error' }; }
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

/* 🔴 **신청내역도 청소해야 한다** (2026-09-09 코드 리뷰에서 잡았다).
   주민등록번호를 떼어내는 장치(syncSafeProfile)는 **프로필 칸만** 청소하고 있었다.
   그런데 서버로 나가는 짐에는 신청내역이 하나 더 실려 있고, 그 안의 `formAns` 에는
   학생이 신청서에 채운 답이 통째로 들어 있다 — **주민등록번호·계좌번호·자기소개서 초안까지.**
   프로필에서 애써 떼어낸 그 값이 옆문으로 그대로 나가고 있었다.
   실측: 등록된 양식 48종 중 **17종에 주민등록번호·계좌 칸이 27개** 있고, 그 답은
   `state.applications[].formAns` 에 저장된 뒤 로그인한 학생에게서 곧바로 올라간다.
   🔴 `terms.html` 의 「③ 서버로 보내지 않는 정보」 절은 정반대를 약속한다 — *"주민등록번호는
      신청서를 채우며 입력한 경우에도 기기에만 남습니다"* · *"작성 중인 자기소개서·신청서 내용"*.
      ⚠️ 줄 번호로 가리키지 말 것 — 약관을 고칠 때마다 밀려 엉뚱한 조항을 가리킨다(실제로 그랬다).
      약관에 적어 둔 말과 코드가 어긋나는 것은 법적 책임이 따른다.
   ⚠️ 기기 간 이어쓰기에 필요한 것은 **어느 공고를 언제 어디까지 했는가**뿐이다 —
      id·신청일·단계·제출기록·결과. 학생이 쓴 글은 폰에 그대로 남으므로 쓰던 신청서는 그대로다.
   🔴 이 함수와 syncApplyRemote 의 되살리기는 **한 세트**다. 보내지 않은 칸을 내려받기가
      덮어쓰면 학생의 신청서가 기기에서 지워진다(프로필의 rrn·account 를 되살리는 것과 같은 이유). */
const SYNC_OMIT_APP = ['formAns', 'docs'];
function syncSafeApplications(apps) {
  if (!Array.isArray(apps)) return [];
  return apps.map((a) => {
    const o = Object.assign({}, a);
    for (const k of SYNC_OMIT_APP) delete o[k];
    return o;
  });
}

/* ---------------- 올리기 · 내려받기 ---------------- */

/* 🔴 **서버 행이 내가 본 그대로일 때만 덮어쓴다** (2026-09-25 · 기술 고문 보고서 Q6)

   그전까지 `syncPush` 는 저장할 때마다 **아무 확인 없이 행 전체를 upsert** 했다.
   시각 비교(`theirs > mine`)는 **앱을 열 때 한 번**뿐이라(app.js syncAfterLoad), 그 뒤의
   저장은 전부 무조건 덮어썼다. 실측으로 재현된 사고는 이렇다 —
   폰 A 가 신청서를 올려 둔 뒤 폰 B 가 프로필 한 칸을 고치면, **A 가 올린 신청서가
   서버에서 통째로 사라진다.** 학생이 쓴 글은 다시 쓸 수 없다.

   🔴 **칸을 쪼개는 것으로는 안 고쳐진다.** 보고서는 JSONB 를 개별 컬럼으로 나누라고 했지만,
      옛 기기는 쪼갠 칸들을 **제 옛 값으로 똑같이** 덮는다. 고쳐야 하는 것은 모양이 아니라
      '내가 본 뒤로 서버가 움직였는가'를 **안 보는 것**이다. (0001_profiles.sql 이 칸을
      안 쪼갠 데에는 따로 적어 둔 이유가 있다 — 앱 구조가 바뀔 때마다 DB 도 같이 고쳐야 한다.)

   방법: 우리가 마지막으로 **본** `updated_at` 을 기억해 두고, 그 값이 아직 서버에 있을 때만
   고친다(조건부 PATCH). 0행이 돌아오면 다른 기기가 먼저 쓴 것이므로 **덮지 않고**
   `conflict` 로 알린다 — 합치는 일은 `app.js` 의 `syncApplyRemote` 한 곳이 맡는다
   (합치는 규칙을 여기 한 벌 더 두면 두 곳이 갈라진다).
   관문: verify/verify-supabase.js [9] 절. */
const SYNC_VER_KEY = 'handaejang.syncver';

/** 우리가 마지막으로 본 서버 행의 `updated_at`. 사람이 바뀌면 안 쓴다. */
function syncVerLoad(userId) {
  try {
    const v = JSON.parse(localStorage.getItem(SYNC_VER_KEY) || 'null');
    return v && v.userId === userId ? String(v.updatedAt || '') : '';
  } catch { return ''; }
}
function syncVerSave(userId, updatedAt) {
  try { localStorage.setItem(SYNC_VER_KEY, JSON.stringify({ userId, updatedAt })); } catch { /* 저장이 막혀도 동작은 해야 한다 */ }
}
function syncVerClear() {
  try { localStorage.removeItem(SYNC_VER_KEY); } catch { /* 위와 같다 */ }
}

/* 서버에 올린다. 실패해도 앱은 아무 일 없이 계속 돈다 — 폰 안 저장이 원본이다. */
async function syncPush(state) {
  if (!signedIn() || !state) return { ok: false, skipped: true };
  const u = authUser();
  const sensitiveOk = !!(state.consent && state.consent.sensitive);
  const stamp = new Date().toISOString();
  const row = {
    user_id: u.userId,
    profile: syncSafeProfile(state.profile, sensitiveOk),
    applications: syncSafeApplications(state.applications),
    sensitive_ok: sensitiveOk,
    updated_at: stamp,
  };
  const seen = syncVerLoad(u.userId);

  /* ⚠️ 본 적이 없으면 **넣기 전에 먼저 본다** — 서버에 이미 행이 있는데 그냥 올리면
     그게 바로 덮어쓰기다(다른 기기에서 갓 로그인한 경우가 정확히 이 꼴이다). */
  if (!seen) {
    const remote = await syncPull();
    /* ⚠️ **빠져나갈 구멍을 남긴다** — 서버 행에 `updated_at` 이 비어 있으면(표의 기본값 때문에
       거의 없지만) 걸 조건이 없다. 그때도 conflict 만 돌려주면 `syncPull` 이 또 빈 값을 적어
       **다시는 못 올리는 상태**가 된다. 그런 행은 막지 않고 그냥 올린다 — 못 올리는 것보다 낫다. */
    if (remote && remote.updatedAt) return { ok: false, conflict: true, remote };
    const ins = await sbAuthed('/rest/v1/profiles', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: [row],
    });
    if (ins.ok) syncVerSave(u.userId, stamp);
    return { ok: ins.ok, error: ins.ok ? null : authErrorText(ins) };
  }

  const res = await sbAuthed(
    `/rest/v1/profiles?user_id=eq.${encodeURIComponent(u.userId)}&updated_at=eq.${encodeURIComponent(seen)}`,
    { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: row });
  if (res.ok && Array.isArray(res.json) && res.json.length) {
    syncVerSave(u.userId, stamp);
    return { ok: true, error: null };
  }
  if (res.ok) {
    /* 0행 = 내가 본 뒤로 다른 기기가 먼저 썼다. **덮지 않는다.** */
    const remote = await syncPull();
    return { ok: false, conflict: true, remote };
  }
  return { ok: false, error: authErrorText(res) };
}

/* 서버에서 내려받는다. 없으면(첫 로그인 전) null. */
async function syncPull() {
  if (!signedIn()) return null;
  const u = authUser();
  const res = await sbAuthed(
    `/rest/v1/profiles?user_id=eq.${encodeURIComponent(u.userId)}&select=profile,applications,sensitive_ok,updated_at`);
  if (!res.ok || !Array.isArray(res.json) || !res.json.length) return null;
  const row = res.json[0];
  /* 🔴 본 값을 적어 둔다 — 다음 push 가 '그 사이 서버가 움직였는가'를 이걸로 판단한다. */
  syncVerSave(u.userId, row.updated_at || '');
  return {
    profile: row.profile || null,
    applications: row.applications || [],
    sensitiveOk: !!row.sensitive_ok,
    updatedAt: row.updated_at || null,
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    syncSafeProfile, syncSafeApplications, SYNC_OMIT_COMMON, SYNC_OMIT_APP,
    SYNC_SENSITIVE_KEYS, authErrorText, REMEMBER_KEY,
  };
}

/* app-account.js — 로그인·이어쓰기(기기 사이 동기화·MY 계정 카드·로그인 시트) (2026-11-19 app.js 에서 글자 그대로 떼어 냄)
   🔴 **app.js 보다 먼저 싣는다**(index.html · sw.js) — app.js 의 시작 코드·다른 화면이 이 파일의 함수를 부른다.
   🔴 맨 윗단에는 **함수 선언과 리터럴 값만** — app.js 의 상수·함수는 함수 안에서만 쓴다(먼저 실려서 그 자리엔 아직 없다).
   🔴 검사는 verify/app-source.cjs 가 app.js 의 표시 자리에 이 파일을 끼운 **나누기 전과 같은 글자**로 읽는다.
      관문 「app.js 나누기 — 떼어 낸 화면이 제자리에 실린다」. */
/* ══════════════════════════════════════════════════════════════════════════
   회원가입·로그인 — 기기를 바꿔도 이어쓰기 (2026-08-25)

   개발자가 겪던 문제: *"핸드폰으로 로그인했을 때 정보가 저장되지 않아 다른 기기와
   연결이 되지 않는다."* 프로필·신청내역이 폰 안에만 있어서 기기를 바꾸면 온보딩부터
   다시 해야 했다.

   🔴 **기기 우선**이다. 화면은 언제나 폰 안 데이터로 즉시 뜨고, 서버는 뒤에서 맞출 뿐이다.
      서버 우선으로 바꾸면 지하철·비행기모드에서 화면이 비거나 온보딩이 다시 뜬다.
   🔴 서버로 나가는 값은 **반드시** supabase-client.js 의 syncSafeProfile 을 거친다 —
      주민등록번호·계좌번호는 거기서 떨어져 나간다. 여기서 profile 을 직접 보내지 말 것.
   ══════════════════════════════════════════════════════════════════════════ */
let syncTimer = null;
let syncBusy = false;

/* 저장할 때마다 서버를 두들기지 않는다 — 온보딩에서 한 칸 고칠 때마다 보내면
   무료 등급이 금방 닳는다. 묶어서 한 번만 올린다. */
function syncSchedulePush() {
  if (typeof signedIn !== 'function' || !signedIn()) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    syncPushMerging(state).then(syncTellIfRejected)
      .catch(() => { /* 실패해도 앱은 그대로 — 폰 안 저장이 원본이다 */ });
  }, (typeof SUPABASE_CONFIG !== 'undefined' && SUPABASE_CONFIG.pushDelayMs) || 2000);
}

/* 🔴 **DB 가 값을 거절한 것은 학생에게 알린다** (2026-09-26 · 고문 보고서 Q6)

   0004_profile_columns.sql 부터 있을 수 없는 값(성적 999 · 1만 자 학교 이름)은 DB 가 쓰기를
   거절한다. 그런데 올리기 실패는 여기서 `.catch(() => {})` 로 **통째로 삼켜지고 있었다** —
   그러면 프로필이 **영영 서버에 안 올라가고** 학생은 다른 기기에서 이어쓰기가 안 되는 이유를
   모른다. '인터넷이 없다'는 지나가도 되지만 '값이 틀렸다'는 지나가면 안 된다.

   ⚠️ **한 번만 알린다.** 값을 고치지 않으면 저장할 때마다 같은 자리에서 거절되므로,
      매번 띄우면 토스트가 화면을 덮어 앱을 못 쓴다.
   🔴 **성공하면 그 기억을 푼다** (2026-09-26 코드 리뷰에서 잡았다). 안 풀면, 값을 고쳐
      한 번 올라간 뒤 **다른 칸**이 거절될 때 다시 조용해진다 — 이 장치가 없애려던 상태로
      그대로 돌아간다. 푸는 자리는 '실제로 올라간 순간' 하나뿐이다.
   ⚠️ 문구는 supabase-client.js 가 만든다(어느 칸이 문제인지 아는 곳이 거기다). 여기서
      따로 만들지 말 것 — 두 곳이 갈라진다. */
let syncRejectTold = false;
function syncTellIfRejected(r) {
  if (r && r.ok) { syncRejectTold = false; return r; }
  if (!r || !r.rejected || syncRejectTold) return r;
  syncRejectTold = true;
  if (typeof toast === 'function') toast(r.error);
  return r;
}

/* 🔴 **다른 기기가 먼저 썼으면 덮지 않고 합친 뒤 올린다** (2026-09-25 · 고문 보고서 Q6)

   `syncPush` 는 이제 '내가 본 판이 아직 서버에 있을 때만' 고친다(supabase-client.js).
   다른 기기가 먼저 썼으면 `conflict` 를 돌려주는데, 그때 **그냥 포기하면 이 기기가 고친 것이
   영영 안 올라간다.** 그래서 받아서 합치고(`syncApplyRemote` — 합치는 규칙은 거기 한 곳뿐이다)
   **한 번만** 다시 올린다.
   ⚠️ 다시 올리는 것은 한 번뿐이다 — 계속 밀면 두 기기가 서로를 밀어내며 돌 수 있다.
      한 번 더 부딪히면 다음 저장이나 다음 실행이 가져간다(기기 안 저장이 원본이라 안 잃는다). */
async function syncPushMerging(st) {
  const r = await syncPush(st);
  if (!r || !r.conflict || !r.remote) return r;
  syncApplyRemote(r.remote, { quiet: true });   // 합치기만 한다 — 방금 고친 값을 되돌리지 않는다
  /* ⚠️ 다시 올릴 때는 **전역 `state`** 다 — `syncApplyRemote` 가 고치는 것이 그것이라,
     넘겨받은 `st` 를 그대로 쓰면 합친 결과가 아니라 합치기 전 것을 올리게 된다. */
  return syncPush(state);
}

/* 서버에서 받은 것을 이 기기에 적는다.
   🔴 **서버에 일부러 안 올린 것**(주민번호·계좌·미동의 민감자격)은 서버에 없다.
      그대로 덮어쓰면 이 기기의 값이 사라지므로, 빈자리만 기기 것으로 채운다. */
function syncApplyRemote(remote, opts) {
  const o = opts || {};
  const wasOnboarding = !state.profile;
  /* 🔴 `quiet` — **덮어쓰기 충돌을 풀 때** 쓴다(syncPushMerging). 방향이 반대이기 때문이다:
     여기 기본값은 '앱을 열었는데 서버가 더 새것' 이라 서버 프로필이 이긴다. 그런데 충돌은
     **학생이 방금 이 기기에서 고쳐서** 올리려던 참에 난 것이라, 서버 것으로 갈아치우면
     방금 고친 값이 눈앞에서 되돌아간다(실측: 성적 4.1 → 3.6).
     그래서 quiet 일 때는 ①프로필·동의는 **이 기기 것을 둔다** ②신청내역은 **합친다**
     ③화면을 다시 그리지 않는다(글을 쓰는 중일 수 있다 — 포커스가 날아간다).
     ⚠️ 잃는 쪽을 막는 기준은 아래 신청내역 주석과 같다 — **글은 다시 못 쓰고, 프로필 한 칸은
        다시 고치면 된다.** 그래서 합치는 것은 글이 든 신청내역 쪽이다. */
  if (remote.profile && !o.quiet) {
    const localP = state.profile || {};
    const localCommon = localP.common || {};
    const p = JSON.parse(JSON.stringify(remote.profile));
    p.common = Object.assign({}, p.common || {});
    for (const k of ['rrn', 'account']) if (localCommon[k] && !p.common[k]) p.common[k] = localCommon[k];
    if (!p.flags) p.flags = localP.flags || [];
    migrateBranchCampus(p);
    migrateFitFields(p);
    state.profile = p;
    /* 🔴 다른 기기에서 학교를 바꿨을 수도 있다 — 받아 둔 공고가 남의 학교 것이면 다시 받는다.
       ⚠️ `quiet` 일 때는 프로필을 안 바꾸므로 이 안(바꾼 경우)에만 둔다. */
    loadNoticesIfSchoolChanged();
    loadNewsIfSchoolChanged();   // 교내 소식도 같은 조건으로 (2026-09-30)
  }
  /* 🔴 **학생이 쓴 글은 서버에 없다** — syncSafeApplications 가 `formAns`·`docs` 를 떼고 보낸다
     (주민등록번호·계좌·자기소개서가 들어 있어서다). 그래서 받은 것으로 통째로 갈아치우면
     **이 기기에 있던 신청서 답이 지워진다.** 프로필의 rrn·account 를 되살리는 것과 같은 이유로
     여기서도 기기 것을 되살린다. ⚠️ 서버가 가진 칸(단계·제출기록)은 서버 것이 이긴다. */
  if (Array.isArray(remote.applications)) {
    const mineByIdx = new Map((state.applications || []).map((a) => [a.id, a]));
    state.applications = remote.applications.map((a) => {
      const local = mineByIdx.get(a.id);
      if (!local) return a;
      const merged = Object.assign({}, a);
      for (const k of ['formAns', 'docs', 'snap']) if (merged[k] == null && local[k] != null) merged[k] = local[k];   // snap: 기기 안 공고 사본(서버로 안 감 · SYNC_OMIT_APP)
      return merged;
    });
    /* 🔴 **서버가 아직 모르는 신청서도 살린다** (2026-09-11 코드 리뷰에서 잡았다).
       위 `map` 은 서버 목록을 기준으로 삼으므로, 아직 못 올린 신청서는 **통째로 사라진다.**
       올리기는 2초 미룬 뒤 조용히 실패할 수 있어서(`syncSchedulePush`) 드문 일이 아니다 —
       폰 A 에서 신청서를 쓰다 지하철에 들어가고, 폰 B 에서 프로필만 고쳐 `updated_at` 이
       올라가면, 폰 A 가 다음에 열릴 때 그 글이 지워진다. 위에서 애써 되살린 바로 그 값이다.
       ⚠️ **학생이 쓴 것이 든 건만** 되살린다 — 빈 건까지 되살리면 다른 기기에서 지운 신청이
          되살아난다. 글은 다시 쓸 수 없고 빈 건은 다시 지우면 되므로, 잃는 쪽을 막는다. */
    const remoteIds = new Set(remote.applications.map((a) => a.id));
    for (const a of mineByIdx.values()) {
      if (remoteIds.has(a.id)) continue;
      if (a.formAns || a.docs) state.applications.push(a);
    }
  }
  if (!o.quiet) {
    state.consent = Object.assign({}, state.consent, { sensitive: !!remote.sensitiveOk });
    state.updatedAt = remote.updatedAt || state.updatedAt;
  }
  saveState({ fromServer: true });

  if (o.quiet) return;                 // 화면은 건드리지 않는다 (위 주석 ③)
  if (wasOnboarding && state.profile) { initOnboarding(); showScreen('home'); return; }
  const cur = $$('.screen').find((sc) => !sc.hidden);
  if (cur) showScreen(cur.id.replace('screen-', ''));
}

/* 앱을 열 때 / 로그인 직후 한 번. **최신이 이긴다**(last-write-wins). */
async function syncAfterLoad() {
  if (typeof signedIn !== 'function' || !signedIn() || syncBusy) return;
  syncBusy = true;
  try {
    const remote = await syncPull();
    if (!remote) { syncTellIfRejected(await syncPushMerging(state)); return; }   // 서버가 비었으면 내 것을 올린다
    const mine = state.updatedAt || '';
    const theirs = remote.updatedAt || '';
    /* 새 기기(프로필이 아예 없음)면 무조건 받는다 — 이게 개발자가 겪던 바로 그 상황이다 */
    if (!state.profile || theirs > mine) syncApplyRemote(remote);
    else if (mine > theirs) syncTellIfRejected(await syncPushMerging(state));
  } catch (e) {
    /* 인터넷이 없거나 서버가 자고 있으면 그냥 지나간다 — 앱은 폰 안 데이터로 계속 돈다 */
  } finally { syncBusy = false; }
}

/* 온보딩 Step 3 — 특별자격을 **하나라도 켰을 때만** 동의 줄을 보여 준다.
   아무것도 안 켠 학생은 민감정보를 주지 않으므로 동의를 물을 이유가 없다. */
function syncConsentRow() {
  const row = $('#in-sensitive-row');
  if (!row) return;
  const anyFlag = $$('#in-flags input:checked').length > 0;
  row.hidden = !(anyFlag && typeof supabaseConfigured === 'function' && supabaseConfigured());
}

/* ---------------- MY 화면 계정 카드 ---------------- */
function renderAccountCard() {
  const el = $('#my-account');
  if (!el) return;
  /* 설정이 비어 있으면 로그인 기능이 아예 없는 앱처럼 보인다 (push-config·chat-config와 같은 규칙) */
  if (typeof supabaseConfigured !== 'function' || !supabaseConfigured()) { el.hidden = true; return; }
  el.hidden = false;
  const u = authUser();
  el.innerHTML = u
    /* 로그인한 판 (2026-11-21 개발자 지시) — 계정 · 그 아래 메일 · 그 아래 작은 빨간 글자 「로그아웃」(테두리·바탕 없음).
       🔴 탈퇴는 여기 두지 않는다 — 설정 화면(알림 · 설정)의 「탈퇴」 한 곳(#btn-withdraw · 약관이 '설정 화면에서 탈퇴'라고 적는다) */
    ? `<p class="acc-head">계정</p>
       <p class="acc-mail">${esc(u.email || '로그인됨')}</p>
       <button type="button" class="acc-out" id="btn-acc-out">로그아웃</button>`
    : `<p class="acc-head">로그인</p>
       <p class="acc-note">다른 폰에서도 내 정보와 신청 내역을 그대로 볼 수 있어요.</p>
       <div class="acc-actions">
         <button class="btn btn-primary" id="btn-acc-in">로그인</button>
         <button class="btn btn-outline" id="btn-acc-up">회원가입</button>
       </div>`;

  const btnIn = $('#btn-acc-in'); if (btnIn) btnIn.addEventListener('click', () => openAuthSheet('in'));
  const btnUp = $('#btn-acc-up'); if (btnUp) btnUp.addEventListener('click', () => openAuthSheet('up'));
  const btnOut = $('#btn-acc-out');
  /* 🔴 서버 답을 기다리지 않고 바로 다시 그린다 — authSignOut 은 부르는 순간 이 기기 로그인을 지운다(서버 알림은 뒤에서) */
  if (btnOut) btnOut.addEventListener('click', () => {
    authSignOut();
    toast('로그아웃 · 이 기기의 정보는 그대로 유지');
    renderMy();
  });
}

/* ---------------- 로그인 · 가입 시트 ---------------- */
/* 🔴 새 시트를 만들지 않고 #detail-sheet 를 그대로 쓴다 —
   쓸어 내려 닫기·배경 눌러 닫기·ESC 가 이미 배선돼 있다(2026-08-21 개발자 지시). */
/* 화면 넷 — 'in' 로그인 · 'up' 가입 · 'reset' 비밀번호 재설정 요청 · 'newpw' 새 비밀번호 */
let authMode = 'in';

function openAuthSheet(mode) {
  authMode = mode || 'in';
  openSheetShell();
  renderAuthSheet();
}

/* 소셜 로그인 — supabase-config.js 의 providers 에 적은 것만 **동그란 아이콘**으로 나온다.
   🔴 여기에 적는 것만으로는 안 되고, 대시보드에서 그 제공자를 켜야 실제로 동작한다.
   🔴 로고는 **그림 파일이 아니라 코드 안의 도형**이다 — 앱의 보안 설정(CSP)이 바깥 그림을
      막기도 하고, 파일이 없어도 아이콘이 깨지지 않아서다. */
const AUTH_PROVIDERS = {
  google: { label: '구글', svg: '<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.7-.4-3.9z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.7-.4-3.9z"/></svg>' },
  kakao: { label: '카카오', svg: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#191600" d="M12 3.5C6.8 3.5 2.6 6.9 2.6 11c0 2.6 1.7 4.9 4.3 6.2-.2.7-.7 2.6-.8 3-.1.5.2.5.4.4.2-.1 2.7-1.9 3.8-2.6.6.1 1.2.1 1.7.1 5.2 0 9.4-3.4 9.4-7.5S17.2 3.5 12 3.5z"/></svg>' },
  /* Apple — 애플 디자인 규칙: 검은 바탕에 흰 사과 로고(로고만 쓰는 둥근 버튼 허용) · 앱스토어 심사 4.8(구글 로그인이 있으면 개인정보 보호형 로그인도 함께) · 2026-11-21 */
  apple: { label: 'Apple', svg: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#fff" d="M16.37 12.76c-.02-2.27 1.86-3.36 1.94-3.41-1.06-1.55-2.7-1.76-3.28-1.78-1.4-.14-2.73.82-3.44.82-.71 0-1.8-.8-2.96-.78-1.52.02-2.93.89-3.71 2.25-1.58 2.74-.4 6.8 1.14 9.02.75 1.09 1.65 2.31 2.82 2.27 1.13-.05 1.56-.73 2.93-.73 1.37 0 1.75.73 2.95.71 1.22-.02 1.99-1.11 2.73-2.2.86-1.26 1.21-2.48 1.23-2.55-.03-.01-2.36-.9-2.38-3.6zM14.12 6.1c.62-.76 1.04-1.81.93-2.86-.9.04-1.99.6-2.63 1.35-.58.67-1.08 1.74-.95 2.77 1 .08 2.03-.51 2.65-1.26z"/></svg>' },
  naver: { label: '네이버', svg: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#fff" d="M16.3 12.9L7.5 0H0v24h7.7V11.1L16.5 24H24V0h-7.7v12.9z"/></svg>' },
};
function authProvidersHtml() {
  const list = (typeof SUPABASE_CONFIG !== 'undefined' && SUPABASE_CONFIG.providers) || [];
  const known = list.filter((p) => AUTH_PROVIDERS[p]);
  if (!known.length) return '';
  return `<div class="auth-or"><span>또는 간편하게</span></div>
    <div class="auth-social">${known.map((p) => {
      const m = AUTH_PROVIDERS[p];
      return `<button type="button" class="auth-social-btn auth-${esc(p)}" data-oauth="${esc(p)}"
        aria-label="${esc(m.label)}로 계속하기" title="${esc(m.label)}로 계속하기">${m.svg}</button>`;
    }).join('')}</div>`;
}

function renderAuthSheet(errText, okText) {
  const mode = authMode;
  const title = { in: '로그인', up: '회원가입', reset: '비밀번호 재설정', newpw: '새 비밀번호 정하기' }[mode];
  const emailVal = mode === 'up' ? '' : (typeof rememberedEmail === 'function' ? rememberedEmail() : '');
  const remembered = !!emailVal;

  const emailField = `
      <label class="field">
        <span class="field-label">이메일</span>
        <input type="email" id="in-auth-email" placeholder="name@example.com" value="${esc(emailVal)}"
          autocomplete="email" inputmode="email" autocapitalize="none" spellcheck="false" />
      </label>`;
  const pwField = (label, auto) => `
      <label class="field">
        <span class="field-label">${label}</span>
        <input type="password" id="in-auth-pw" placeholder="비밀번호" autocomplete="${auto}" />
      </label>`;

  let mid = '';
  if (mode === 'in') {
    mid = emailField + pwField('비밀번호', 'current-password') + `
      <div class="auth-row">
        <label class="auth-remember"><input type="checkbox" id="in-auth-remember" ${remembered ? 'checked' : ''} /> 아이디 저장</label>
        <button type="button" class="btn-link" id="btn-auth-forgot">비밀번호 찾기</button>
      </div>`;
  } else if (mode === 'up') {
    mid = emailField + pwField('비밀번호 (6자 이상)', 'new-password') + `
      <label class="check-item consent-item">
        <input type="checkbox" id="in-auth-agree" />
        <span>(필수) <a href="terms.html" target="_blank" rel="noopener">이용약관 · 개인정보처리방침</a>에 동의합니다</span>
      </label>`;
  } else if (mode === 'reset') {
    mid = `<p class="auth-lead">가입할 때 쓴 이메일로 비밀번호 재설정 링크를 보냅니다.</p>`
      + emailField;
  } else {
    mid = `<p class="auth-lead">새로 쓸 비밀번호를 정해 주세요.</p>`
      + pwField('새 비밀번호 (6자 이상)', 'new-password');
  }

  const goLabel = { in: '로그인', up: '가입하기', reset: '재설정 메일 보내기', newpw: '비밀번호 바꾸기' }[mode];
  const swap = mode === 'in'
    ? '<button class="btn btn-outline" id="btn-auth-swap" style="width:100%">회원가입</button>'
    : mode === 'up'
      ? '<button class="btn btn-outline" id="btn-auth-swap" style="width:100%">로그인</button>'
      : '<button class="btn btn-outline" id="btn-auth-swap" style="width:100%">← 로그인으로 돌아가기</button>';

  $('#detail-sheet').innerHTML = `
    <div class="sheet-handle"></div>
    <div class="sheet-body auth-sheet">
      <h3 class="sheet-title">${title}</h3>
      ${mid}
      <p class="auth-err" id="auth-err" ${errText ? '' : 'hidden'}>${esc(errText || '')}</p>
      <p class="auth-ok" id="auth-ok" ${okText ? '' : 'hidden'}>${esc(okText || '')}</p>
      <button class="btn btn-primary btn-lg" id="btn-auth-go">${goLabel}</button>
      ${swap}
      ${mode === 'in' || mode === 'up' ? authProvidersHtml() : ''}
    </div>`;

  $('#btn-auth-go').addEventListener('click', authSubmit);
  $('#btn-auth-swap').addEventListener('click', () => {
    authMode = mode === 'up' ? 'in' : (mode === 'in' ? 'up' : 'in');
    renderAuthSheet();
  });
  const forgot = $('#btn-auth-forgot');
  if (forgot) forgot.addEventListener('click', () => { authMode = 'reset'; renderAuthSheet(); });
  const pw = $('#in-auth-pw');
  if (pw) pw.addEventListener('keydown', (e) => { if (e.key === 'Enter') authSubmit(); });
  const mail = $('#in-auth-email');
  if (mail) mail.addEventListener('keydown', (e) => { if (e.key === 'Enter' && mode === 'reset') authSubmit(); });
  $$('#detail-sheet [data-oauth]').forEach((b) =>
    b.addEventListener('click', () => authOAuthGo(b.dataset.oauth)));
  $('#detail-sheet').scrollTop = 0;
}

function authShowError(msg) {
  const el = $('#auth-err');
  if (!el) return;
  el.textContent = msg;
  el.hidden = false;
  const okEl = $('#auth-ok');
  if (okEl) okEl.hidden = true;
}

async function authSubmit() {
  const mode = authMode;
  const emailEl = $('#in-auth-email');
  const pwEl = $('#in-auth-pw');
  const email = emailEl ? emailEl.value.trim() : '';
  const pw = pwEl ? pwEl.value : '';

  if ((mode === 'in' || mode === 'up') && (!email || !pw)) {
    authShowError('이메일과 비밀번호 입력 필요'); return;
  }
  if (mode === 'reset' && !email) { authShowError('이메일 입력 필요'); return; }
  if (mode === 'newpw' && !pw) { authShowError('새 비밀번호 입력 필요'); return; }
  if (mode === 'up' && !$('#in-auth-agree').checked) {
    authShowError('약관·개인정보처리방침 동의 필요'); return;
  }

  const btn = $('#btn-auth-go');
  const label = btn.textContent;
  btn.disabled = true;
  btn.textContent = '잠시만요…';
  let r;
  if (mode === 'up') r = await authSignUp(email, pw);
  else if (mode === 'in') r = await authSignIn(email, pw);
  else if (mode === 'reset') r = await authResetRequest(email);
  else r = await authUpdatePassword(pw);
  btn.disabled = false;
  btn.textContent = label;

  if (!r.ok) { authShowError(r.error); return; }

  /* 🔴 재설정 메일은 **정말 갔는지 앱이 알 수 없다.** Supabase 기본 발송기는 시간당 2통이고
     팀원이 아닌 주소로는 거부하는데, 그 거부가 앱에는 성공으로 보인다. 그래서
     "보냈습니다"라고 단정하지 않고 안 왔을 때 무엇을 하면 되는지까지 적는다. */
  if (mode === 'reset') {
    renderAuthSheet(null, '재설정 링크 요청 완료. 메일함(스팸함도)을 확인해 주세요.\n'
      + '몇 분 안에 안 오면 아직 메일 발송이 준비되지 않은 것이니 관리자에게 알려 주세요.');
    return;
  }
  if (mode === 'newpw') {
    closeSheet();
    toast('비밀번호 변경 완료');
    renderMy();
    return;
  }
  if (r.needsEmailConfirm) {
    renderAuthSheet(null, '가입 확인 메일 발송 — 메일의 링크를 누른 뒤 로그인해 주세요.');
    return;
  }

  /* '아이디 저장' — 이메일 한 줄만. 비밀번호는 절대 저장하지 않는다. */
  const rememberEl = $('#in-auth-remember');
  if (mode === 'in') setRememberedEmail(rememberEl && rememberEl.checked ? email : '');
  else setRememberedEmail(email);          // 가입한 사람은 그 주소를 기억해 둔다

  closeSheet();
  toast('로그인 완료 · 기기를 바꿔도 이어짐');
  /* 🔴 순서가 중요하다 — **먼저** 서버와 맞춘다. 새 기기에서는 이 줄에서 프로필이
     처음 생기므로, 화면 그리기를 앞에 두면 아직 프로필이 없는 상태로 그리게 된다. */
  await syncAfterLoad();
  renderMy();
}

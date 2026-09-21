/* ============================================================
   한대장 — 과팅 탭 (2026-09-21 개발자 지시 "앱에 과팅 탭이라는 완전히 새로운 기능")
   ------------------------------------------------------------
   이 앱에서 **처음으로 학생끼리 서로를 보는 화면**이다. 그래서 다른 화면과 다른 원칙 셋:
     ① 문턱 — 로그인 + **학교 이메일(ac.kr) 인증**을 통과해야 읽고 쓴다. 인증은 서버
        (server/gating/)가 하고, 이 파일은 번호를 보내고 확인해 달라고 부탁만 한다.
     ② 남의 글·채팅을 보는 규칙은 **여기가 아니라 Supabase RLS** 다
        (supabase/migrations/0003_gating.sql). 이 파일이 아무리 잘못돼도 남의 방은 안 열린다.
     ③ 앱이 보내는 것은 **과팅 프로필(닉네임·학과·성별)·글·요청·메시지**뿐이다. 학생의 이름·
        학번·전화·성적은 이 파일이 만지지 않는다 — 관문 verify/verify-gating.js 가 요청
        본문을 전부 모아 센다.

   되돌리지 말 것
   · `gating-config.js` 의 endpoint 가 비면 **요청 0건** — 탭은 '준비 중' 카드만 그린다.
     verify-supabase.js 가 이 조건 위에서 돈다.
   · 글·요청의 학교·학과·성별·닉네임은 **보내지 않는다** — DB 트리거가 프로필에서 채운다.
     보내 봤자 버려지고, 보내는 코드가 생기는 순간 사칭 경로가 생긴다.
   · 채팅은 폴링이다(4초 → 8 → 16 → 30초 · 숨으면 정지). 웹소켓(Realtime)은 SDK 없이는
     프로토콜을 손으로 짜야 하고 CSP 에 wss: 를 열어야 해서 안 쓴다.
   · 알림은 앱이 열려 있을 때 30초 폴링 + 탭 점(.nav-dot) 뿐이다. 푸시 워커는 '내용 없는
     깨우기' 라 방을 못 본다.
   · 화면 규칙은 `app.js` 것을 그대로 쓴다 — `$`·`esc`·`toast`·`openSheetShell`·
     `closeSheet`·`openAuthSheet`. `sbAuthed` 는 supabase-client.js 것.

   설계·경위: docs/designs/gating.md
   ============================================================ */

const GATING_KEY = 'handaejang.gating';        // 과팅 프로필 사본 — 프로필(handaejang.v1)과 **다른 열쇠**
const GT_ROOM_POLL_MS = [4000, 8000, 16000, 30000];
const GT_ROOM_IDLE_STEP_MS = 60000;            // 이만큼 새 말이 없으면 한 단계 느리게
const GT_INBOX_POLL_MS = 30000;
const GT_HEADCOUNTS = [2, 3, 4, 5, 6, 7, 8];
/* 공개 글에는 연락처를 못 적는다 (DB CHECK 도 전화번호를 막는다). 채팅에서는 **경고만** 한다. */
const GT_CONTACT_RE = /01[016789][-.\s]?\d{3,4}[-.\s]?\d{4}|카톡|카카오|인스타|텔레그램|@[a-z0-9_.]{3,}/i;
const GT_NICK_RE = /^[가-힣a-zA-Z0-9]{2,10}$/;
const GT_REPORT_REASONS = ['욕설', '광고', '연락처강요', '사칭', '기타'];

const gt = {
  armed: false,          // 탭을 한 번이라도 열었는가 — 그전에는 서버에 아무것도 묻지 않는다
  me: null,              // gating_profiles 의 내 행 (없으면 null)
  meLoaded: false,
  tab: 'board',
  posts: null,
  filter: { school: '', dept: '' },
  requests: null,
  rooms: null,
  sent: null,            // 인증 번호를 보낸 이메일
  err: '',
  room: null,            // { id, partner, lastId, timer, idleSince, step }
  inboxTimer: null,
  busy: false,
};

/* ---------------- 저장 ---------------- */
function gtCacheLoad() {
  try {
    const c = JSON.parse(localStorage.getItem(GATING_KEY) || 'null');
    const u = typeof authUser === 'function' ? authUser() : null;
    return c && u && c.userId === u.userId ? c : null;
  } catch { return null; }
}
function gtCacheSave(me) {
  const u = typeof authUser === 'function' ? authUser() : null;
  if (!u) return;
  try { localStorage.setItem(GATING_KEY, JSON.stringify({ userId: u.userId, me: me || null, at: Date.now() })); } catch { /* 저장 공간이 막혀도 화면은 돈다 */ }
}

/* ---------------- 서버와 말하기 ---------------- */
function gtMyId() { const u = typeof authUser === 'function' ? authUser() : null; return u ? u.userId : ''; }
function gtOn() { return typeof gatingConfigured === 'function' && gatingConfigured() && typeof signedIn === 'function' && signedIn(); }
function gtVerified() { return !!(gt.me && gt.me.verified_at); }
function gtReady() { return gtVerified() && !!gt.me.nickname; }

/* 과팅 서버(워커) — 학생 토큰을 붙여 부른다. 만료됐으면 sbAuthed 와 같은 방식으로 한 번 갱신한다 */
async function gtWorker(path, body) {
  let t = typeof authLoad === 'function' ? authLoad() : null;
  if (t && t.expiresAt && Date.now() > t.expiresAt && typeof authRefresh === 'function') { await authRefresh(); t = authLoad(); }
  if (!t) return { ok: false, status: 401, json: { error: 'login' } };
  try {
    const res = await fetch(String(GATING_CONFIG.endpoint).replace(/\/+$/, '') + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t.accessToken },
      body: JSON.stringify(body || {}),
    });
    const json = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, json };
  } catch (e) {
    return { ok: false, status: 0, json: { error: 'network' } };
  }
}

/* 서버 오류를 학생이 읽을 수 있는 말로 */
function gtErrText(res) {
  const code = (res && res.json && (res.json.error || res.json.message || res.json.code)) || '';
  const m = String((res && (res.text || (res.json && res.json.message))) || '') + ' ' + code;
  if (res && res.status === 0) return '인터넷 연결을 확인해 주세요';
  if (res && res.status === 401) return '로그인이 풀렸어요. 다시 로그인해 주세요';
  if (/not_school/.test(m)) return '학교 이메일(ac.kr)만 인증할 수 있어요';
  if (/bad_email/.test(m)) return '이메일 주소를 다시 확인해 주세요';
  if (/wrong_code/.test(m)) return `번호가 맞지 않아요${res.json && res.json.left >= 0 ? ` (남은 횟수 ${res.json.left})` : ''}`;
  if (/expired/.test(m)) return '번호가 만료됐어요. 다시 받아 주세요';
  if (/too_many/.test(m)) return '여러 번 틀렸어요. 번호를 다시 받아 주세요';
  if (/no_code/.test(m)) return '먼저 인증 번호를 받아 주세요';
  if (/email_taken/.test(m)) return '이미 다른 계정에서 인증한 이메일이에요';
  if (/mail/.test(m)) return '메일을 보내지 못했어요. 잠시 후 다시 시도해 주세요';
  if (/rate:posts/.test(m)) return '글은 하루에 3건까지 올릴 수 있어요';
  if (/rate:requests/.test(m)) return '이미 짝을 찾는 중인 요청이 있어요';
  if (/rate:messages/.test(m)) return '너무 빨리 보내고 있어요. 잠시 후 다시';
  if (/rate:rooms/.test(m)) return '오늘은 새 대화를 더 열 수 없어요';
  if (/rate/.test(m)) return '잠시 후 다시 시도해 주세요';
  if (/not_verified/.test(m)) return '학교 인증을 먼저 마쳐 주세요';
  if (/post_closed/.test(m)) return '마감된 글이에요';
  if (/own_post/.test(m)) return '내 글에는 말을 걸 수 없어요';
  if (/blocked/.test(m)) return '차단한 사이라 대화를 열 수 없어요';
  if (/room_closed|not_member/.test(m)) return '닫힌 대화방이에요';
  if (/23505|duplicate/.test(m)) return '이미 쓰는 닉네임이에요';
  if (/23514|violates check/.test(m)) return '입력한 값이 규칙에 맞지 않아요';
  return '문제가 생겼어요. 잠시 후 다시 시도해 주세요';
}

async function gtLoadMe() {
  if (!gtOn()) { gt.me = null; gt.meLoaded = true; return null; }
  const res = await sbAuthed(`/rest/v1/gating_profiles?user_id=eq.${encodeURIComponent(gtMyId())}&select=user_id,nickname,school,dept,gender,verified_domain,verified_at`);
  if (res.ok) {
    gt.me = Array.isArray(res.json) && res.json[0] ? res.json[0] : null;
    gt.meLoaded = true;
    gtCacheSave(gt.me);
  } else if (!gt.meLoaded) {
    gt.me = (gtCacheLoad() || {}).me || null;
    gt.meLoaded = true;
  }
  return gt.me;
}

/* ---------------- 화면 ---------------- */
function gtSchoolLabel(row) {
  /* 학교 이름은 인증한 도메인이 표에 있을 때만 있다. 없으면 도메인을 그대로 — 지어내지 않는다 */
  return (row && (row.school || row.verified_domain)) || '학교 미표시';
}
function gtWhen(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const diff = Date.now() - d.getTime();
  if (diff < 60000) return '방금';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}분 전`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}시간 전`;
  return `${d.getMonth() + 1}.${d.getDate()}`;
}

function renderGating() {
  const box = $('#gating-body');
  if (!box) return;
  gt.armed = true;
  if (typeof gatingConfigured !== 'function' || !gatingConfigured()) {
    box.innerHTML = `
      <div class="gt-gate empty">
        <p class="gt-gate-title">과팅은 준비 중이에요</p>
        <p>학교 이메일 인증과 대화방이 열리면 여기서 바로 쓸 수 있어요.</p>
      </div>`;
    return;
  }
  /* 로그아웃했거나 다른 계정으로 바뀌었으면 앞사람의 사본을 잊는다 */
  if (!signedIn() || gt.meUser !== gtMyId()) {
    gt.me = null; gt.meLoaded = false; gt.posts = null; gt.requests = null; gt.rooms = null; gt.sent = null; gt.err = '';
    gt.meUser = gtMyId();
  }
  if (!signedIn()) {
    box.innerHTML = `
      <div class="gt-gate empty">
        <p class="gt-gate-title">로그인하면 과팅을 볼 수 있어요</p>
        <p>학교 이메일로 인증한 학생끼리만 글을 보고 대화합니다.</p>
        <button class="btn btn-primary" data-gt="login">로그인</button>
      </div>`;
    return;
  }
  if (!gt.meLoaded) {
    const c = gtCacheLoad();
    if (c) { gt.me = c.me; gt.meLoaded = true; }
  }
  if (!gt.meLoaded) {
    box.innerHTML = '<div class="gt-gate empty"><p>불러오는 중</p></div>';
    gtLoadMe().then(() => renderGating());
    return;
  }
  if (!gtVerified()) { box.innerHTML = gtVerifyHtml(); gtLoadMe().then((m) => { if (m && m.verified_at) renderGating(); }); return; }
  if (!gtReady()) { box.innerHTML = gtProfileHtml(); return; }
  box.innerHTML = gtMainHtml();
  gtRenderTab();
  gtInboxStart();
}

function gtVerifyHtml() {
  const sent = gt.sent;
  return `
    <div class="gt-gate">
      <p class="gt-gate-title">학교 이메일로 인증해 주세요</p>
      <p class="gt-gate-text">학교 이메일(ac.kr)로 6자리 번호를 보냅니다. 이메일 주소는 저장하지 않고
        인증 기록(해시)만 남깁니다.</p>
      <label class="field">
        <span class="field-label">학교 이메일</span>
        <input type="email" id="gt-email" placeholder="name@school.ac.kr" value="${esc(sent || '')}"
          autocomplete="email" inputmode="email" autocapitalize="none" spellcheck="false" ${sent ? 'readonly' : ''} />
      </label>
      ${sent ? `
      <label class="field">
        <span class="field-label">인증 번호 6자리</span>
        <input type="text" id="gt-code" placeholder="000000" inputmode="numeric" maxlength="6" autocomplete="one-time-code" />
        <span class="field-hint">메일이 안 오면 스팸함을 확인해 주세요. 번호는 10분 동안 유효합니다.</span>
      </label>` : ''}
      <p class="auth-err" id="gt-err" ${gt.err ? '' : 'hidden'}>${esc(gt.err)}</p>
      ${sent
        ? `<button class="btn btn-primary btn-lg" data-gt="check">확인</button>
           <button class="btn btn-outline" data-gt="resend">다른 이메일로 다시 받기</button>`
        : `<button class="btn btn-primary btn-lg" data-gt="send">인증 번호 받기</button>`}
    </div>`;
}

function gtProfileHtml() {
  const me = gt.me || {};
  const major = (typeof state !== 'undefined' && state.profile && state.profile.major) || '';
  const g = gt.gender || me.gender || '';
  return `
    <div class="gt-gate">
      <p class="gt-gate-title">과팅 프로필</p>
      <p class="gt-gate-text">인증한 학교: <strong>${esc(gtSchoolLabel(me))}</strong>. 아래 셋은 글과 대화방에서
        다른 학생에게 보입니다. 실명·학번은 쓰지 않습니다.</p>
      <label class="field">
        <span class="field-label">닉네임 (2~10자 · 한글·영문·숫자)</span>
        <input type="text" id="gt-nick" maxlength="10" value="${esc(me.nickname || '')}" autocomplete="off" />
      </label>
      <label class="field">
        <span class="field-label">학과</span>
        <input type="text" id="gt-dept" maxlength="40" value="${esc(me.dept || major)}" placeholder="예: 국어국문학과" />
      </label>
      <div class="field">
        <span class="field-label">성별</span>
        <div class="chip-group">
          <button type="button" class="chip ${g === '남' ? 'active' : ''}" data-gt="gender" data-v="남">남</button>
          <button type="button" class="chip ${g === '여' ? 'active' : ''}" data-gt="gender" data-v="여">여</button>
        </div>
        <span class="field-hint">자동 매칭은 성별이 다른 팀끼리만 짝을 맺습니다.</span>
      </div>
      <p class="auth-err" id="gt-err" ${gt.err ? '' : 'hidden'}>${esc(gt.err)}</p>
      <button class="btn btn-primary btn-lg" data-gt="save-profile">저장하고 시작</button>
    </div>`;
}

function gtMainHtml() {
  const me = gt.me;
  const tabs = [['board', '게시판'], ['match', '매칭'], ['chat', '대화']];
  return `
    <p class="gt-me">${esc(me.nickname)} · ${esc(gtSchoolLabel(me))}${me.dept ? ' · ' + esc(me.dept) : ''}
      <button type="button" class="btn-link gt-me-edit" data-gt="edit-profile">수정</button></p>
    <div class="chip-group gt-tabs">
      ${tabs.map(([k, l]) => `<button type="button" class="chip ${gt.tab === k ? 'active' : ''}" data-gt="tab" data-v="${k}">${l}</button>`).join('')}
    </div>
    <div id="gt-pane"></div>`;
}

function gtRenderTab() {
  const pane = $('#gt-pane');
  if (!pane) return;
  if (gt.tab === 'board') gtRenderBoard();
  else if (gt.tab === 'match') gtRenderMatch();
  else gtRenderInbox();
}

/* ---------------- 게시판 ---------------- */
async function gtLoadPosts() {
  const res = await sbAuthed('/rest/v1/gating_posts?status=eq.open&order=created_at.desc&limit=100&select=id,author,nickname,school,dept,gender,headcount,want_school,body,created_at,expires_at');
  gt.posts = res.ok && Array.isArray(res.json) ? res.json : (gt.posts || []);
  if (!res.ok) gt.err = gtErrText(res);
  return gt.posts;
}

function gtRenderBoard() {
  const pane = $('#gt-pane');
  if (!pane) return;
  if (gt.posts === null) {
    pane.innerHTML = '<div class="empty">글을 불러오는 중</div>';
    gtLoadPosts().then(() => { if (gt.tab === 'board') gtRenderBoard(); });
    return;
  }
  const me = gtMyId();
  const schools = [...new Set(gt.posts.map((p) => p.school || p.verified_domain).filter(Boolean))];
  const f = gt.filter;
  const list = gt.posts.filter((p) => (!f.school || (p.school || '') === f.school)
    && (!f.dept || String(p.dept || '').includes(f.dept)));
  const card = (p) => {
    const mine = p.author === me;
    return `
      <article class="gt-post" data-post="${p.id}">
        <div class="gt-post-head">
          <span class="gt-post-who">${esc(p.nickname || '')} · ${esc(p.school || '학교 미표시')}${p.dept ? ' · ' + esc(p.dept) : ''}</span>
          <span class="badge gt-post-badge">${esc(p.gender || '')} ${p.headcount}명</span>
        </div>
        <p class="gt-post-body">${esc(p.body)}</p>
        <div class="gt-post-foot">
          <span class="gt-post-meta">${p.want_school === 'same' ? '같은 학교만' : '학교 무관'} · ${esc(gtWhen(p.created_at))}</span>
          <span class="gt-post-actions">
            ${mine
              ? '<button type="button" class="btn-link" data-gt="close-post" data-id="' + p.id + '">마감</button>'
              : `<button type="button" class="btn-link" data-gt="report" data-kind="post" data-id="${p.id}" data-user="${esc(p.author)}">신고</button>
                 <button type="button" class="btn-link" data-gt="block" data-user="${esc(p.author)}">차단</button>
                 <button type="button" class="btn btn-primary gt-post-chat" data-gt="open-room" data-id="${p.id}">대화하기</button>`}
          </span>
        </div>
      </article>`;
  };
  pane.innerHTML = `
    <div class="gt-filter">
      <div class="chip-group gt-schools">
        <button type="button" class="chip ${!f.school ? 'active' : ''}" data-gt="school" data-v="">전체</button>
        ${schools.map((s) => `<button type="button" class="chip ${f.school === s ? 'active' : ''}" data-gt="school" data-v="${esc(s)}">${esc(s)}</button>`).join('')}
      </div>
      <input type="search" id="gt-dept-filter" class="gt-dept-filter" placeholder="학과로 찾기" value="${esc(f.dept)}" />
    </div>
    <button class="btn btn-primary btn-lg gt-write" data-gt="compose">글 올리기</button>
    ${gt.err ? `<p class="auth-err">${esc(gt.err)}</p>` : ''}
    ${list.length ? `<div class="card-list">${list.map(card).join('')}</div>`
      : '<div class="empty">아직 올라온 글이 없어요. 첫 글을 올려 보세요.</div>'}`;
  gt.err = '';
  const dept = $('#gt-dept-filter');
  if (dept) {
    let t;
    dept.addEventListener('input', () => {
      clearTimeout(t);
      t = setTimeout(() => { gt.filter.dept = dept.value.trim(); gtRenderBoard(); const d = $('#gt-dept-filter'); if (d) { d.focus(); d.setSelectionRange(d.value.length, d.value.length); } }, 250);
    });
  }
}

function gtComposeOpen() {
  openSheetShell();
  $('#detail-sheet').innerHTML = `
    <div class="sheet-handle"></div>
    <div class="sheet-body" id="gt-compose">
      <h3 class="sheet-title">과팅 글 올리기</h3>
      <p class="auth-lead">${esc(gt.me.nickname)} · ${esc(gtSchoolLabel(gt.me))}${gt.me.dept ? ' · ' + esc(gt.me.dept) : ''} · ${esc(gt.me.gender || '')} 으로 올라갑니다.</p>
      <div class="field">
        <span class="field-label">우리 쪽 인원</span>
        <div class="chip-group" id="gt-hc">
          ${GT_HEADCOUNTS.map((n) => `<button type="button" class="chip ${n === 3 ? 'active' : ''}" data-gt="pick" data-group="gt-hc" data-v="${n}">${n}명</button>`).join('')}
        </div>
      </div>
      <div class="field">
        <span class="field-label">상대 학교</span>
        <div class="chip-group" id="gt-ws">
          <button type="button" class="chip active" data-gt="pick" data-group="gt-ws" data-v="any">학교 무관</button>
          <button type="button" class="chip" data-gt="pick" data-group="gt-ws" data-v="same">같은 학교만</button>
        </div>
      </div>
      <label class="field">
        <span class="field-label">내용 (300자까지)</span>
        <textarea id="gt-body" rows="4" maxlength="300" placeholder="예: 3:3 과팅 구해요. 이번 주말 저녁 선호합니다."></textarea>
        <span class="field-hint">전화번호·카톡 아이디는 공개 글에 적을 수 없어요. 대화방에서 나누세요.</span>
      </label>
      <p class="auth-err" id="gt-err" hidden></p>
      <button class="btn btn-primary btn-lg" data-gt="post">올리기</button>
    </div>`;
}

async function gtPostCreate() {
  const body = String(($('#gt-body') || {}).value || '').trim();
  const headcount = Number((document.querySelector('#gt-hc .chip.active') || {}).dataset ? document.querySelector('#gt-hc .chip.active').dataset.v : 3);
  const want = (document.querySelector('#gt-ws .chip.active') || { dataset: { v: 'any' } }).dataset.v;
  const err = $('#gt-err');
  const say = (m) => { if (err) { err.textContent = m; err.hidden = !m; } };
  if (!body) return say('내용을 적어 주세요');
  if (GT_CONTACT_RE.test(body)) return say('전화번호·메신저 아이디는 공개 글에 적을 수 없어요');
  if (gt.busy) return;
  gt.busy = true;
  /* 🔴 보내는 칸은 셋뿐 — 학교·학과·성별·닉네임은 서버 트리거가 프로필에서 채운다 */
  const res = await sbAuthed('/rest/v1/gating_posts', {
    method: 'POST', headers: { Prefer: 'return=representation' },
    body: { headcount, want_school: want, body },
  });
  gt.busy = false;
  if (!res.ok) return say(gtErrText(res));
  closeSheet();
  toast('글을 올렸어요');
  gt.posts = null;
  gtRenderBoard();
}

async function gtPostClose(id) {
  const res = await sbAuthed(`/rest/v1/gating_posts?id=eq.${Number(id)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: { status: 'closed' } });
  if (!res.ok) { toast(gtErrText(res)); return; }
  toast('글을 마감했어요');
  gt.posts = null;
  gtRenderBoard();
}

/* ---------------- 매칭 ---------------- */
async function gtLoadRequests() {
  const res = await sbAuthed(`/rest/v1/gating_requests?user_id=eq.${encodeURIComponent(gtMyId())}&order=created_at.desc&limit=5&select=id,headcount,want_school,status,created_at,expires_at`);
  gt.requests = res.ok && Array.isArray(res.json) ? res.json : (gt.requests || []);
  if (!res.ok) gt.err = gtErrText(res);
  /* 매칭된 요청은 방 번호까지 */
  const matched = gt.requests.filter((r) => r.status === 'matched');
  if (matched.length) {
    const ids = matched.map((r) => r.id).join(',');
    const m = await sbAuthed(`/rest/v1/gating_matches?or=(req_a.in.(${ids}),req_b.in.(${ids}))&select=req_a,req_b,room_id,created_at`);
    if (m.ok && Array.isArray(m.json)) {
      for (const r of matched) {
        const hit = m.json.find((x) => x.req_a === r.id || x.req_b === r.id);
        if (hit) r.room_id = hit.room_id;
      }
    }
  }
  return gt.requests;
}

function gtRenderMatch() {
  const pane = $('#gt-pane');
  if (!pane) return;
  if (gt.requests === null) {
    pane.innerHTML = '<div class="empty">불러오는 중</div>';
    gtLoadRequests().then(() => { if (gt.tab === 'match') gtRenderMatch(); });
    return;
  }
  const waiting = gt.requests.find((r) => r.status === 'waiting');
  const matched = gt.requests.filter((r) => r.status === 'matched' && r.room_id);
  const me = gt.me;
  let html = `<p class="gt-lead">인원·학교 범위를 적어 두면 5분마다 조건이 맞는 다른 과 팀과 짝을 맺고, 대화방이 열립니다.
    성별이 다른 팀끼리만 맺습니다. 짝이 되면 여기와 아래 탭에 점이 뜹니다.</p>`;
  if (matched.length) {
    html += matched.map((r) => `
      <div class="gt-matched">
        <p class="gt-matched-title">짝이 맺어졌어요</p>
        <p class="gt-post-meta">${r.headcount}명 · ${r.want_school === 'same' ? '같은 학교만' : '학교 무관'} · ${esc(gtWhen(r.created_at))}</p>
        <button class="btn btn-primary" data-gt="open-room-id" data-room="${r.room_id}">대화방 열기</button>
      </div>`).join('');
  }
  if (waiting) {
    html += `
      <div class="gt-waiting">
        <p class="gt-matched-title">짝을 찾는 중</p>
        <p class="gt-post-meta">${waiting.headcount}명 · ${waiting.want_school === 'same' ? '같은 학교만' : '학교 무관'} · ${esc(gtWhen(waiting.created_at))} 신청 · 7일 뒤 자동 만료</p>
        <button class="btn btn-outline" data-gt="cancel-request" data-id="${waiting.id}">취소</button>
      </div>`;
  } else {
    html += `
      <div class="gt-form">
        <p class="gt-post-meta">${esc(me.nickname)} · ${esc(gtSchoolLabel(me))}${me.dept ? ' · ' + esc(me.dept) : ''} · ${esc(me.gender || '')}</p>
        <div class="field">
          <span class="field-label">우리 쪽 인원</span>
          <div class="chip-group" id="gt-rhc">
            ${GT_HEADCOUNTS.map((n) => `<button type="button" class="chip ${n === 3 ? 'active' : ''}" data-gt="pick" data-group="gt-rhc" data-v="${n}">${n}명</button>`).join('')}
          </div>
        </div>
        <div class="field">
          <span class="field-label">상대 학교</span>
          <div class="chip-group" id="gt-rws">
            <button type="button" class="chip active" data-gt="pick" data-group="gt-rws" data-v="any">학교 무관</button>
            <button type="button" class="chip" data-gt="pick" data-group="gt-rws" data-v="same">같은 학교만</button>
          </div>
        </div>
        <p class="auth-err" id="gt-err" ${gt.err ? '' : 'hidden'}>${esc(gt.err)}</p>
        <button class="btn btn-primary btn-lg" data-gt="request">짝 찾기 신청</button>
      </div>`;
  }
  gt.err = '';
  pane.innerHTML = html;
}

async function gtRequestCreate() {
  if (gt.busy) return;
  const headcount = Number((document.querySelector('#gt-rhc .chip.active') || { dataset: { v: 3 } }).dataset.v);
  const want = (document.querySelector('#gt-rws .chip.active') || { dataset: { v: 'any' } }).dataset.v;
  gt.busy = true;
  const res = await sbAuthed('/rest/v1/gating_requests', { method: 'POST', headers: { Prefer: 'return=representation' }, body: { headcount, want_school: want } });
  gt.busy = false;
  if (!res.ok) { gt.err = gtErrText(res); gtRenderMatch(); return; }
  toast('신청했어요. 짝이 맺어지면 알려 드립니다');
  gt.requests = null;
  gtRenderMatch();
}

async function gtRequestCancel(id) {
  const res = await sbAuthed(`/rest/v1/gating_requests?id=eq.${Number(id)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: { status: 'cancelled' } });
  if (!res.ok) { toast(gtErrText(res)); return; }
  toast('신청을 취소했어요');
  gt.requests = null;
  gtRenderMatch();
}

/* ---------------- 대화 목록 ---------------- */
async function gtLoadRooms() {
  const me = gtMyId();
  const mem = await sbAuthed(`/rest/v1/gating_room_members?user_id=eq.${encodeURIComponent(me)}&left_at=is.null&select=room_id,last_read_at`);
  if (!mem.ok || !Array.isArray(mem.json)) { gt.rooms = gt.rooms || []; gt.err = gtErrText(mem); return gt.rooms; }
  const mine = mem.json;
  if (!mine.length) { gt.rooms = []; return gt.rooms; }
  const ids = mine.map((m) => m.room_id).join(',');
  const [last, others] = await Promise.all([
    sbAuthed(`/rest/v1/gating_room_last?room_id=in.(${ids})&select=room_id,kind,closed_at,created_at,last_body,last_at,last_id`),
    sbAuthed(`/rest/v1/gating_room_members?room_id=in.(${ids})&user_id=neq.${encodeURIComponent(me)}&select=room_id,user_id,nickname,left_at`),
  ]);
  const lastBy = {}; (last.ok && Array.isArray(last.json) ? last.json : []).forEach((r) => { lastBy[r.room_id] = r; });
  const otherBy = {}; (others.ok && Array.isArray(others.json) ? others.json : []).forEach((r) => { otherBy[r.room_id] = r; });
  gt.rooms = mine.map((m) => {
    const l = lastBy[m.room_id] || {};
    const o = otherBy[m.room_id] || {};
    return {
      id: m.room_id, kind: l.kind || 'post', closedAt: l.closed_at || null, createdAt: l.created_at || '',
      partner: o.nickname || '상대', partnerId: o.user_id || '', partnerLeft: !!o.left_at,
      lastBody: l.last_body || '', lastAt: l.last_at || '', lastId: l.last_id || 0,
      unread: !!(l.last_at && new Date(l.last_at).getTime() > new Date(m.last_read_at).getTime()),
    };
  }).sort((a, b) => String(b.lastAt || b.createdAt).localeCompare(String(a.lastAt || a.createdAt)));
  return gt.rooms;
}

function gtRenderInbox() {
  const pane = $('#gt-pane');
  if (!pane) return;
  if (gt.rooms === null) {
    pane.innerHTML = '<div class="empty">불러오는 중</div>';
    gtLoadRooms().then(() => { if (gt.tab === 'chat') gtRenderInbox(); });
    return;
  }
  pane.innerHTML = gt.rooms.length ? `<div class="gt-rooms">${gt.rooms.map((r) => `
    <button type="button" class="gt-room-row ${r.unread ? 'unread' : ''}" data-gt="open-room-id" data-room="${r.id}">
      <span class="gt-room-name">${esc(r.partner)}${r.kind === 'match' ? ' · 매칭' : ''}${r.partnerLeft ? ' · 나감' : ''}</span>
      <span class="gt-room-last">${esc(r.lastBody || '대화를 시작해 보세요')}</span>
      <span class="gt-room-when">${esc(gtWhen(r.lastAt || r.createdAt))}</span>
    </button>`).join('')}</div>`
    : '<div class="empty">아직 대화가 없어요. 게시판에서 글에 말을 걸거나 매칭을 신청해 보세요.</div>';
}

/* ---------------- 대화방 ---------------- */
async function gtOpenRoomFromPost(postId) {
  if (gt.busy) return;
  gt.busy = true;
  const res = await sbAuthed('/rest/v1/rpc/gating_open_room', { method: 'POST', body: { p_post: Number(postId) } });
  gt.busy = false;
  if (!res.ok) { toast(gtErrText(res)); return; }
  const roomId = Number(res.json);
  gt.rooms = null;
  gtOpenRoom(roomId);
}

async function gtOpenRoom(roomId) {
  const id = Number(roomId);
  let info = (gt.rooms || []).find((r) => r.id === id);
  if (!info) { await gtLoadRooms(); info = (gt.rooms || []).find((r) => r.id === id) || { id, partner: '상대', partnerId: '' }; }
  gtRoomStop();
  gt.room = { id, partner: info.partner, partnerId: info.partnerId, lastId: 0, step: 0, idleSince: Date.now(), timer: null, msgs: [] };
  openSheetShell();
  $('#detail-sheet').innerHTML = `
    <div class="sheet-handle"></div>
    <div class="sheet-body gt-room" id="gt-room" data-room="${id}">
      <div class="gt-room-head">
        <h3 class="sheet-title">${esc(info.partner)}</h3>
        <span class="gt-room-actions">
          ${info.partnerId ? `<button type="button" class="btn-link" data-gt="report" data-kind="room" data-id="${id}" data-user="${esc(info.partnerId)}">신고</button>
          <button type="button" class="btn-link" data-gt="block" data-user="${esc(info.partnerId)}">차단</button>` : ''}
          <button type="button" class="btn-link" data-gt="leave" data-room="${id}">나가기</button>
        </span>
      </div>
      <p class="gt-room-note">연락처는 충분히 이야기한 뒤에 나누세요. 불편하면 신고·차단할 수 있습니다.</p>
      <div class="gt-msgs" id="gt-msgs" aria-live="polite"><div class="empty">불러오는 중</div></div>
      <form class="gt-room-input" id="gt-room-form" autocomplete="off">
        <input type="text" id="gt-msg-in" maxlength="500" placeholder="메시지" aria-label="메시지 입력" />
        <button type="submit" class="btn btn-primary">보내기</button>
      </form>
    </div>`;
  $('#gt-room-form').addEventListener('submit', (e) => { e.preventDefault(); gtSend(); });
  await gtRoomPollOnce(true);
  gtRoomSchedule();
}

function gtRoomAlive() {
  const el = document.getElementById('gt-room');
  const sheet = $('#detail-sheet');
  return !!(gt.room && el && Number(el.dataset.room) === gt.room.id && sheet && sheet.classList.contains('show'));
}

function gtRoomStop() {
  if (gt.room && gt.room.timer) clearTimeout(gt.room.timer);
  if (gt.room) gt.room.timer = null;
  gt.room = null;
}

function gtRoomSchedule() {
  if (!gt.room || !gtRoomAlive()) { gtRoomStop(); return; }
  if (document.visibilityState === 'hidden') return;   // 숨으면 멈춘다 — 보이면 visibilitychange 가 다시 돈다
  const r = gt.room;
  if (Date.now() - r.idleSince > GT_ROOM_IDLE_STEP_MS * (r.step + 1)) r.step = Math.min(r.step + 1, GT_ROOM_POLL_MS.length - 1);
  clearTimeout(r.timer);
  r.timer = setTimeout(async () => {
    if (!gtRoomAlive()) { gtRoomStop(); return; }
    await gtRoomPollOnce(false);
    gtRoomSchedule();
  }, GT_ROOM_POLL_MS[r.step]);
}

let gtPollBusy = false;
async function gtRoomPollOnce(first) {
  if (!gt.room || gtPollBusy) return;
  gtPollBusy = true;
  const r = gt.room;
  try {
    const res = await sbAuthed(`/rest/v1/gating_messages?room_id=eq.${r.id}&id=gt.${r.lastId}&order=id.asc&limit=100&select=id,sender,body,created_at`);
    if (!gt.room || gt.room !== r) return;
    if (res.ok && Array.isArray(res.json)) {
      if (res.json.length) {
        r.msgs.push(...res.json);
        r.lastId = res.json[res.json.length - 1].id;
        r.idleSince = Date.now();
        r.step = 0;
        gtMarkRead(r.id);
      }
      if (first || res.json.length) gtRenderMsgs();
    } else if (first) {
      const box = $('#gt-msgs');
      if (box) box.innerHTML = `<div class="empty">${esc(gtErrText(res))}</div>`;
    }
    if (first && res.ok) gtMarkRead(r.id);
  } finally { gtPollBusy = false; }
}

function gtRenderMsgs() {
  const box = $('#gt-msgs');
  if (!box || !gt.room) return;
  const me = gtMyId();
  const list = gt.room.msgs;
  box.innerHTML = list.length ? list.map((m) => `
    <div class="gt-msg ${m.sender === me ? 'me' : ''}${m.pending ? ' pending' : ''}">
      <span class="gt-msg-body">${esc(m.body)}</span>
      <span class="gt-msg-when">${esc(gtWhen(m.created_at))}</span>
    </div>`).join('') : '<div class="empty">첫 인사를 건네 보세요.</div>';
  box.scrollTop = box.scrollHeight;
}

async function gtMarkRead(roomId) {
  await sbAuthed(`/rest/v1/gating_room_members?room_id=eq.${Number(roomId)}&user_id=eq.${encodeURIComponent(gtMyId())}`, {
    method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: { last_read_at: new Date().toISOString() },
  });
  const room = (gt.rooms || []).find((x) => x.id === Number(roomId));
  if (room) room.unread = false;
  gtSetDot(gtHasUnread());
}

async function gtSend() {
  if (!gt.room) return;
  const input = $('#gt-msg-in');
  const body = String((input && input.value) || '').trim();
  if (!body) return;
  if (GT_CONTACT_RE.test(body) && !gt.room.warned) {
    gt.room.warned = true;
    toast('연락처를 나누기 전에 상대를 충분히 알아보세요. 한 번 더 누르면 보냅니다');
    return;
  }
  const r = gt.room;
  const temp = { id: 'tmp-' + Date.now(), sender: gtMyId(), body, created_at: new Date().toISOString(), pending: true };
  r.msgs.push(temp);
  gtRenderMsgs();
  input.value = '';
  const res = await sbAuthed('/rest/v1/gating_messages', { method: 'POST', headers: { Prefer: 'return=representation' }, body: { room_id: r.id, body } });
  if (gt.room !== r) return;
  const i = r.msgs.indexOf(temp);
  if (!res.ok) {
    if (i >= 0) r.msgs.splice(i, 1);
    input.value = body;
    toast(gtErrText(res));
  } else {
    const saved = Array.isArray(res.json) ? res.json[0] : null;
    if (saved && i >= 0) { r.msgs[i] = saved; r.lastId = Math.max(r.lastId, saved.id); }
    else if (i >= 0) r.msgs[i].pending = false;
    r.idleSince = Date.now();
    r.step = 0;
    gtRoomSchedule();
  }
  gtRenderMsgs();
}

async function gtLeave(roomId) {
  const res = await sbAuthed(`/rest/v1/gating_room_members?room_id=eq.${Number(roomId)}&user_id=eq.${encodeURIComponent(gtMyId())}`, {
    method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: { left_at: new Date().toISOString() },
  });
  if (!res.ok) { toast(gtErrText(res)); return; }
  gtRoomStop();
  closeSheet();
  toast('대화방을 나갔어요');
  gt.rooms = null;
  if (gt.tab === 'chat') gtRenderInbox();
}

/* ---------------- 신고 · 차단 ---------------- */
function gtReportOpen(kind, id, userId) {
  const restore = gt.room ? { id: gt.room.id } : null;
  gtRoomStop();
  openSheetShell();
  $('#detail-sheet').innerHTML = `
    <div class="sheet-handle"></div>
    <div class="sheet-body" id="gt-report" data-kind="${esc(kind)}" data-id="${esc(id)}" data-user="${esc(userId)}" ${restore ? `data-back="${restore.id}"` : ''}>
      <h3 class="sheet-title">신고</h3>
      <p class="auth-lead">신고 내용은 운영자가 확인합니다. 같은 글에 3명이 신고하면 글이 자동으로 감춰집니다.</p>
      <div class="field">
        <span class="field-label">사유</span>
        <div class="chip-group" id="gt-reason">
          ${GT_REPORT_REASONS.map((r, i) => `<button type="button" class="chip ${i === 0 ? 'active' : ''}" data-gt="pick" data-group="gt-reason" data-v="${r}">${r}</button>`).join('')}
        </div>
      </div>
      <label class="field">
        <span class="field-label">자세히 (선택 · 200자)</span>
        <textarea id="gt-report-detail" rows="3" maxlength="200"></textarea>
      </label>
      <p class="auth-err" id="gt-err" hidden></p>
      <button class="btn btn-primary btn-lg" data-gt="report-send">신고 보내기</button>
    </div>`;
}

async function gtReportSend() {
  const box = $('#gt-report');
  if (!box || gt.busy) return;
  const reason = (document.querySelector('#gt-reason .chip.active') || { dataset: { v: '기타' } }).dataset.v;
  const detail = String(($('#gt-report-detail') || {}).value || '').trim();
  const body = { reason, detail: detail || null, target_user: box.dataset.user || null };
  if (box.dataset.kind === 'post') body.post_id = Number(box.dataset.id);
  gt.busy = true;
  const res = await sbAuthed('/rest/v1/gating_reports', { method: 'POST', headers: { Prefer: 'return=minimal' }, body });
  gt.busy = false;
  const err = $('#gt-err');
  if (!res.ok) { if (err) { err.textContent = gtErrText(res); err.hidden = false; } return; }
  closeSheet();
  toast('신고를 보냈어요');
}

async function gtBlock(userId) {
  if (!userId || userId === gtMyId()) return;
  const res = await sbAuthed('/rest/v1/gating_blocks', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: { blocked: userId } });
  if (!res.ok && res.status !== 409) { toast(gtErrText(res)); return; }
  gtRoomStop();
  closeSheet();
  gt.posts = null; gt.rooms = null;
  gtRenderTab();
  toast('차단했어요. 이 학생의 글과 대화가 보이지 않습니다', {
    label: '되돌리기',
    run: async () => {
      await sbAuthed(`/rest/v1/gating_blocks?blocked=eq.${encodeURIComponent(userId)}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
      gt.posts = null; gt.rooms = null;
      gtRenderTab();
    },
  });
}

/* ---------------- 인증 · 프로필 동작 ---------------- */
async function gtVerifySend() {
  const input = $('#gt-email');
  const email = String((input && input.value) || '').trim();
  gt.err = '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { gt.err = '이메일 주소를 다시 확인해 주세요'; renderGating(); return; }
  if (gt.busy) return;
  gt.busy = true;
  const res = await gtWorker('/verify/send', { email });
  gt.busy = false;
  if (!res.ok) { gt.err = gtErrText(res); renderGating(); return; }
  gt.sent = email;
  renderGating();
  const code = $('#gt-code');
  if (code) code.focus();
}

async function gtVerifyCheck() {
  const code = String((($('#gt-code') || {}).value) || '').replace(/\D/g, '');
  gt.err = '';
  if (code.length !== 6) { gt.err = '6자리 번호를 적어 주세요'; renderGating(); return; }
  if (gt.busy) return;
  gt.busy = true;
  const res = await gtWorker('/verify/check', { code });
  gt.busy = false;
  if (!res.ok) { gt.err = gtErrText(res); renderGating(); return; }
  gt.sent = null;
  gt.meLoaded = false;
  await gtLoadMe();
  toast('학교 인증이 끝났어요');
  renderGating();
}

async function gtProfileSave() {
  const nick = String((($('#gt-nick') || {}).value) || '').trim();
  const dept = String((($('#gt-dept') || {}).value) || '').trim();
  const gender = (document.querySelector('#gating-body .chip.active[data-gt="gender"]') || { dataset: {} }).dataset.v || '';
  gt.err = '';
  if (!GT_NICK_RE.test(nick)) gt.err = '닉네임은 2~10자의 한글·영문·숫자로 적어 주세요';
  else if (/(운영자|관리자|한대장)/i.test(nick)) gt.err = '그 닉네임은 쓸 수 없어요';
  else if (!dept) gt.err = '학과를 적어 주세요';
  else if (!gender) gt.err = '성별을 골라 주세요';
  if (gt.err) { gt.gender = gender; renderGating(); return; }
  if (gt.busy) return;
  gt.busy = true;
  /* 🔴 고칠 수 있는 칸은 셋뿐 — DB 가 컬럼 단위로 막는다(verified_at 은 절대 여기서 안 보낸다) */
  const res = await sbAuthed(`/rest/v1/gating_profiles?user_id=eq.${encodeURIComponent(gtMyId())}`, {
    method: 'PATCH', headers: { Prefer: 'return=representation' }, body: { nickname: nick, dept, gender },
  });
  gt.busy = false;
  if (!res.ok) { gt.err = gtErrText(res); gt.gender = gender; renderGating(); return; }
  gt.me = Array.isArray(res.json) && res.json[0] ? res.json[0] : Object.assign({}, gt.me, { nickname: nick, dept, gender });
  gtCacheSave(gt.me);
  gt.editing = false;
  toast('저장했어요');
  renderGating();
}

/* ---------------- 알림 점 (30초 폴링 · 탭을 한 번 연 뒤에만) ---------------- */
function gtHasUnread() {
  return (gt.rooms || []).some((r) => r.unread) || (gt.requests || []).some((r) => r.status === 'matched' && !gt.seenMatch);
}
function gtSetDot(on) {
  const btn = document.querySelector('.nav-item[data-nav="gating"]');
  if (!btn) return;
  let dot = btn.querySelector('.nav-dot');
  if (on && !dot) { dot = document.createElement('span'); dot.className = 'nav-dot'; dot.setAttribute('aria-label', '새 소식'); btn.appendChild(dot); }
  if (!on && dot) dot.remove();
}
function gtInboxStart() {
  if (gt.inboxTimer || !gt.armed) return;
  const tick = async () => {
    gt.inboxTimer = null;
    if (!gtOn() || !gtReady()) return;
    if (document.visibilityState !== 'hidden') {
      await gtLoadRooms();
      if (gt.tab !== 'match') await gtLoadRequests();
      gtSetDot(gtHasUnread());
      if (gt.tab === 'chat' && !gt.room) gtRenderInbox();
    }
    gt.inboxTimer = setTimeout(tick, GT_INBOX_POLL_MS);
  };
  gt.inboxTimer = setTimeout(tick, GT_INBOX_POLL_MS);
}

/* ---------------- 배선 — 앱 전체에 한 번 ---------------- */
if (typeof document !== 'undefined' && typeof window !== 'undefined' && !window.__gatingBound) {
  window.__gatingBound = true;
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-gt]');
    if (!b) return;
    const k = b.dataset.gt;
    if (k === 'login') openAuthSheet('in');
    else if (k === 'send' || k === 'resend') { if (k === 'resend') { gt.sent = null; gt.err = ''; renderGating(); } else gtVerifySend(); }
    else if (k === 'check') gtVerifyCheck();
    else if (k === 'gender') { b.parentElement.querySelectorAll('.chip').forEach((c) => c.classList.toggle('active', c === b)); }
    else if (k === 'pick') { const g = document.getElementById(b.dataset.group); if (g) g.querySelectorAll('.chip').forEach((c) => c.classList.toggle('active', c === b)); }
    else if (k === 'save-profile') gtProfileSave();
    else if (k === 'edit-profile') { gt.editing = true; const box = $('#gating-body'); if (box) box.innerHTML = gtProfileHtml(); }
    else if (k === 'tab') { gt.tab = b.dataset.v; document.querySelectorAll('.gt-tabs .chip').forEach((c) => c.classList.toggle('active', c === b)); gtRenderTab(); }
    else if (k === 'school') { gt.filter.school = b.dataset.v; gtRenderBoard(); }
    else if (k === 'compose') gtComposeOpen();
    else if (k === 'post') gtPostCreate();
    else if (k === 'close-post') gtPostClose(b.dataset.id);
    else if (k === 'open-room') gtOpenRoomFromPost(b.dataset.id);
    else if (k === 'open-room-id') { gt.seenMatch = true; gtOpenRoom(b.dataset.room); }
    else if (k === 'request') gtRequestCreate();
    else if (k === 'cancel-request') gtRequestCancel(b.dataset.id);
    else if (k === 'leave') gtLeave(b.dataset.room);
    else if (k === 'report') gtReportOpen(b.dataset.kind, b.dataset.id, b.dataset.user);
    else if (k === 'report-send') gtReportSend();
    else if (k === 'block') gtBlock(b.dataset.user);
  });
  /* 숨으면 폴링이 멈추고, 돌아오면 바로 한 번 본다 */
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    if (gt.room && gtRoomAlive()) { gtRoomPollOnce(false).then(() => gtRoomSchedule()); }
  });
  /* 로그아웃하면 사본을 잊는다 — 다음 사람이 앞사람 프로필을 보면 안 된다 */
  window.addEventListener('storage', (e) => { if (e.key === 'handaejang.auth' && !e.newValue) { gt.me = null; gt.meLoaded = false; } });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { GT_CONTACT_RE, GT_NICK_RE, GT_ROOM_POLL_MS, GT_INBOX_POLL_MS };
}

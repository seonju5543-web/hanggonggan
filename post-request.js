/* ============================================================
   게시 요청 — 기관 담당자 전용 화면 (2026-11-21 개발자 지시)
   ------------------------------------------------------------
   *"게시 요청 탭에는 게시물 관리(게시 요청 현황, 정보 수정, 댓글 작성 등 관리 기능을 이용할 수 있는 탭)이
     존재해야 하고 담당자 로그인이 따로 존재해야 해."*

   화면 — 홈 그림 칸 「게시 요청」 → #screen-postreq.
     · 로그인 전: 담당자 로그인 / 담당자 가입(이메일·비밀번호)
     · 처음 들어온 담당자: 기관명·이름·연락처(post_staff 한 줄)
     · 그 뒤: 위 칸 둘 — [게시 요청하기] [게시물 관리]
       게시물 관리 = 요청 현황(상태 알약) → 한 건을 누르면 내용 · 정보 수정(게시 전만) · 요청 거두기 · 댓글

   🔴 담당자 로그인은 학생 로그인과 **다른 세션**이다 — 열쇠 `handaejang.staff.auth` 하나에만 둔다.
      학생 로그인 표(`handaejang.auth`, supabase-client.js)를 건드리지 않는다: 같은 폰에서 학생으로 로그인해 둔 채
      담당자로 들어와도 학생 쪽 이어쓰기·동기화는 그대로다. 그래서 sbAuthed 가 아니라 아래 staffFetch 로 부른다.
   🔴 권한은 서버가 지킨다(supabase/migrations/0008_post_requests.sql) — 상태(게시됨 등)는 운영자만 바꾸고,
      담당자는 자기 요청만 본다. 이 파일이 버튼을 숨기는 것은 편의일 뿐 보안이 아니다.
   🔴 게시 요청이 '게시됨'이어도 앱 목록에 저절로 실리지 않는다 — 운영자가 정식 등록한다(운영 원칙 2).
   의존 — supabase-client.js(sbFetch·authErrorText) · supabase-config.js(supabaseConfigured) · app.js($·esc·toast·showScreen).
   ============================================================ */
const STAFF_AUTH_KEY = 'handaejang.staff.auth';
const PR_STATUS = {
  submitted: { label: '접수', tone: 'gray' },
  reviewing: { label: '검토 중', tone: 'blue' },
  needs_info: { label: '보완 요청', tone: 'orange' },
  published: { label: '게시됨', tone: 'green' },
  rejected: { label: '반려', tone: 'red' },
};
const PR_EDITABLE = ['submitted', 'needs_info'];
const PR_KINDS = ['장학금', '대외활동', '공모전'];

/* 화면 상태 — tab: 'new' | 'manage' · open: 펼친 요청 id · edit: 고치는 중인가 · mode: 로그인/가입 */
const pr = { tab: 'manage', open: null, edit: false, mode: 'in', staff: undefined, list: null, comments: {}, err: '', busy: false };

/* ── 담당자 세션 (학생 로그인과 따로) ─────────────────────── */
function staffLoad() { try { return JSON.parse(localStorage.getItem(STAFF_AUTH_KEY)) || null; } catch (e) { return null; } }
function staffClear() { try { localStorage.removeItem(STAFF_AUTH_KEY); } catch (e) { /* 무시 */ } }
function staffStore(json) {
  if (!json || !json.access_token) return null;
  const t = {
    accessToken: json.access_token,
    refreshToken: json.refresh_token || '',
    expiresAt: Date.now() + Math.max(0, (json.expires_in || 3600) - 60) * 1000,
    userId: (json.user && json.user.id) || (staffLoad() || {}).userId || '',
    email: (json.user && json.user.email) || (staffLoad() || {}).email || '',
  };
  try { localStorage.setItem(STAFF_AUTH_KEY, JSON.stringify(t)); } catch (e) { /* 저장 공간이 막혀도 이번 화면은 돈다 */ }
  return t;
}
function staffSignedIn() { const t = staffLoad(); return !!(t && t.userId && typeof supabaseConfigured === 'function' && supabaseConfigured()); }

async function staffRefresh() {
  const t = staffLoad();
  if (!t || !t.refreshToken) return false;
  const res = await sbFetch('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: t.refreshToken } });
  if (!res.ok) return false;
  return !!staffStore(res.json);
}
/* 담당자 자격으로 부르기 — 만료면 한 번 갱신 · 갱신도 안 되면 담당자 세션만 끝낸다(학생 로그인은 그대로) */
async function staffFetch(path, opts, retried) {
  let t = staffLoad();
  if (!t) return { ok: false, status: 401, json: null, text: '' };
  if (t.expiresAt && Date.now() > t.expiresAt && !retried) { await staffRefresh(); t = staffLoad(); if (!t) return { ok: false, status: 401, json: null, text: '' }; }
  const o = Object.assign({}, opts);
  o.headers = Object.assign({ Authorization: 'Bearer ' + t.accessToken }, o.headers || {});
  const res = await sbFetch(path, o);
  if (res.status === 401 && !retried) {
    if (await staffRefresh()) return staffFetch(path, opts, true);
    staffClear();
  }
  return res;
}

async function staffSignIn(email, password) {
  const res = await sbFetch('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password } });
  if (!res.ok) return { ok: false, error: authErrorText(res) };
  staffStore(res.json);
  return { ok: true };
}
/* 가입 확인 메일의 링크는 앱으로 돌아오며 주소 뒤에 토큰을 붙인다 — 표시(?staff=1)를 달아 보내야 학생 로그인 쪽(authCaptureFromUrl)이 그 토큰을
   학생 세션으로 주워 담지 않고 아래 staffCaptureFromUrl 이 담당자 세션으로 받는다(리뷰 2026-11-21).
   ⚠️ Supabase 의 Redirect URLs 에 이 주소(앱 주소 + ?staff=1)가 허용돼 있어야 표시가 살아 돌아온다 — 없으면 Supabase 가 기본 주소로 돌려보내 학생 세션으로 들어간다 */
function staffRedirectTo() { return (typeof authRedirectTo === 'function' ? authRedirectTo() : location.origin + location.pathname) + '?staff=1'; }
async function staffSignUp(email, password) {
  const res = await sbFetch('/auth/v1/signup?redirect_to=' + encodeURIComponent(staffRedirectTo()), { method: 'POST', body: { email, password } });
  if (!res.ok) return { ok: false, error: authErrorText(res) };
  if (!res.json || !res.json.access_token) return { ok: true, needsEmailConfirm: true };
  staffStore(res.json);
  return { ok: true };
}
/* 가입 확인 링크로 돌아왔다(?staff=1 + 주소 뒤 토큰) — 담당자 세션으로 담고 주소창에서 지운다. 담았으면 true */
function staffCaptureFromUrl() {
  let staffMark = false;
  try { staffMark = new URLSearchParams(location.search).get('staff') === '1'; } catch (e) { return false; }
  if (!staffMark) return false;
  const hash = String(location.hash || '').replace(/^#/, '');
  const q = new URLSearchParams(hash);
  const ok = !!q.get('access_token') && !!staffStore({ access_token: q.get('access_token'), refresh_token: q.get('refresh_token') || '', expires_in: Number(q.get('expires_in') || 3600) });
  try { history.replaceState(null, '', location.pathname); } catch (e) { /* 무시 */ }
  return ok;
}
async function staffSignOut() {
  const t = staffLoad();
  staffClear();
  /* scope=local — 이 담당자 세션만 끝낸다. 기본값(global)이면 같은 계정으로 이 폰에 학생 로그인도 해 둔 사람의 학생 세션까지 끊긴다 */
  if (t) sbFetch('/auth/v1/logout?scope=local', { method: 'POST', headers: { Authorization: 'Bearer ' + t.accessToken } });   // 기다리지 않는다
}

/* 계정이 바뀌거나 세션이 끝나면 지난 계정의 목록·댓글을 버린다 — 남기면 다음 사람에게 앞사람 요청이 보인다 */
function prResetAccount() { Object.assign(pr, { staff: undefined, list: null, comments: {}, open: null, edit: false, err: '' }); }

/* ── 서버 읽기·쓰기 (PostgREST) ─────────────────────────── */
const prEnc = encodeURIComponent;
async function prLoadStaff() {
  const t = staffLoad();
  const res = await staffFetch(`/rest/v1/post_staff?user_id=eq.${prEnc(t.userId)}&select=*`);
  if (!res.ok) return res.status === 401 ? null : undefined;   // undefined = 못 읽음(다시 시도)
  return (res.json && res.json[0]) || null;
}
async function prLoadList() {
  const res = await staffFetch('/rest/v1/post_requests?select=*&order=created_at.desc');
  return res.ok && Array.isArray(res.json) ? res.json : null;
}
async function prLoadComments(id) {
  const res = await staffFetch(`/rest/v1/post_comments?request_id=eq.${prEnc(id)}&select=*&order=created_at.asc`);
  return res.ok && Array.isArray(res.json) ? res.json : null;
}
const PR_RET = { Prefer: 'return=representation' };

/* 서버가 준 오류는 화면에 옮기지 않는다(행이 통째로 들어 있을 수 있다 — CLAUDE.md 원칙 10) — 사람 말 한 줄로 */
function prErrText(res, formId) {
  if (!res || res.status === 0) return '인터넷 연결을 확인해 주세요';
  if (res.status === 401) return '담당자 로그인이 끝났어요. 다시 로그인해 주세요';
  if (res.status === 403 || res.status === 404) return '이 요청은 지금 고칠 수 없어요';
  if (res.status === 400 || res.status === 409 || res.status === 422) return formId === 'pr-form' ? '적은 내용을 다시 확인해 주세요(링크는 http 로 시작해야 해요)' : '적은 내용을 다시 확인해 주세요';
  return '저장하지 못했어요. 잠시 후 다시 시도해 주세요';
}

/* 폼 → 서버로 보낼 칸. 빈 칸은 null(지어내지 않는다) · 링크는 http(s) 만 */
function prCollect(root) {
  const v = (n) => { const el = root.querySelector(`[name="${n}"]`); return el ? String(el.value || '').trim() : ''; };
  /* 🔴 종류는 **눌린** 단추에서 읽는다 — 이름만으로 찾으면 늘 첫 단추(장학금)가 읽혀 고른 종류가 저장되지 않는다(리뷰 2026-11-21) */
  const ck = root.querySelector('input[name="kind"]:checked');
  const kindV = ck ? ck.value : '';
  const row = {
    kind: PR_KINDS.includes(kindV) ? kindV : '장학금',
    org: v('org'), title: v('title'), url: v('url'),
    deadline: /^\d{4}-\d{2}-\d{2}$/.test(v('deadline')) ? v('deadline') : null,
    target: v('target') || null, amount: v('amount') || null, memo: v('memo') || null,
  };
  if (!row.org) return { error: '기관명을 적어 주세요' };
  if (row.title.length < 2) return { error: '공고 제목을 적어 주세요' };
  if (!/^https?:\/\/\S+$/i.test(row.url)) return { error: '공고 원문 링크를 http 로 시작하게 적어 주세요' };
  return { row };
}

/* ── 그리기 ─────────────────────────────────────────────── */
function prStatusPill(s) {
  const st = PR_STATUS[s] || PR_STATUS.submitted;
  return `<span class="pr-pill pr-${st.tone}">${esc(st.label)}</span>`;
}
function prDate(iso) {
  const d = new Date(iso);
  return isNaN(d) ? '' : `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;
}
function prFormHtml(r, staff) {
  const x = r || {};
  const kind = x.kind || '장학금';
  return `<form class="pr-form" id="pr-form" novalidate>
    <div class="field"><span class="field-label">종류</span>
      <div class="chip-group">${PR_KINDS.map((k) => `<label class="chip pr-kind${k === kind ? ' active' : ''}"><input type="radio" name="kind" value="${esc(k)}" ${k === kind ? 'checked' : ''} hidden>${esc(k)}</label>`).join('')}</div></div>
    <label class="field"><span class="field-label">주최·주관 기관</span><input name="org" maxlength="100" value="${esc(x.org || (staff && staff.org) || '')}"></label>
    <label class="field"><span class="field-label">공고 제목</span><input name="title" maxlength="200" value="${esc(x.title || '')}"></label>
    <label class="field"><span class="field-label">공고 원문 링크</span><input name="url" type="url" inputmode="url" autocapitalize="none" spellcheck="false" maxlength="1000" placeholder="https://" value="${esc(x.url || '')}"></label>
    <label class="field"><span class="field-label">마감일 (선택)</span><input name="deadline" type="date" value="${esc(x.deadline || '')}"></label>
    <label class="field"><span class="field-label">지원 대상 (선택)</span><textarea name="target" rows="3" maxlength="1000">${esc(x.target || '')}</textarea></label>
    <label class="field"><span class="field-label">지원 금액·혜택 (선택)</span><input name="amount" maxlength="300" value="${esc(x.amount || '')}"></label>
    <label class="field"><span class="field-label">운영자에게 남길 말 (선택)</span><textarea name="memo" rows="3" maxlength="2000">${esc(x.memo || '')}</textarea></label>
    <p class="auth-err" id="pr-err" ${pr.err ? '' : 'hidden'}>${esc(pr.err)}</p>
    <button type="submit" class="btn btn-primary btn-lg pr-wide" ${pr.busy ? 'disabled' : ''}>${r ? '수정 저장' : '게시 요청 보내기'}</button>
    ${r ? '<button type="button" class="btn btn-outline pr-wide" data-pr="cancel-edit">취소</button>' : ''}
  </form>`;
}
function prLoginHtml() {
  const up = pr.mode === 'up';
  return `<div class="my-card">
      <p class="wallet-title">기관 담당자 전용</p>
      <p class="sup-desc">장학금·대외활동·공모전 공고를 한대장에 올리고 싶은 학교·재단·기관 담당자가 게시를 요청하고, 요청 현황과 운영자 답변을 보는 곳이에요. 학생 로그인과는 따로인 <strong>담당자 계정</strong>으로 들어와요.</p>
    </div>
    <form class="my-card pr-login" id="pr-login" novalidate>
      <p class="wallet-title">${up ? '담당자 가입' : '담당자 로그인'}</p>
      <label class="field"><span class="field-label">이메일</span><input type="email" name="email" autocomplete="username" inputmode="email" autocapitalize="none" spellcheck="false"></label>
      <label class="field"><span class="field-label">${up ? '비밀번호 (6자 이상)' : '비밀번호'}</span><input type="password" name="pw" autocomplete="${up ? 'new-password' : 'current-password'}"></label>
      ${up ? `<label class="check-item consent-item"><input type="checkbox" name="agree"><span>(필수) <a href="terms.html" target="_blank" rel="noopener">이용약관 · 개인정보처리방침</a>에 동의합니다</span></label>` : ''}
      <p class="auth-err" id="pr-err" ${pr.err ? '' : 'hidden'}>${esc(pr.err)}</p>
      <button type="submit" class="btn btn-primary btn-lg pr-wide" ${pr.busy ? 'disabled' : ''}>${up ? '가입하기' : '로그인'}</button>
      <button type="button" class="btn btn-outline pr-wide" data-pr="swap">${up ? '담당자 로그인으로' : '담당자 가입'}</button>
    </form>`;
}
function prStaffFormHtml() {
  return `<form class="my-card" id="pr-staff" novalidate>
      <p class="wallet-title">담당자 정보</p>
      <p class="sup-desc">처음 한 번만 적어요. 운영자가 요청을 확인할 때 연락드리는 데만 써요.</p>
      <label class="field"><span class="field-label">기관명</span><input name="org" maxlength="100"></label>
      <label class="field"><span class="field-label">담당자 이름</span><input name="name" maxlength="50" autocomplete="name"></label>
      <label class="field"><span class="field-label">연락처 (전화 또는 이메일)</span><input name="contact" maxlength="100"></label>
      <p class="auth-err" id="pr-err" ${pr.err ? '' : 'hidden'}>${esc(pr.err)}</p>
      <button type="submit" class="btn btn-primary btn-lg pr-wide" ${pr.busy ? 'disabled' : ''}>저장하고 시작하기</button>
      <button type="button" class="link-btn" data-pr="logout">담당자 로그아웃</button>
    </form>`;
}
function prDetailHtml(r) {
  const editable = PR_EDITABLE.includes(r.status);
  if (pr.edit && editable) return `<div class="my-card"><p class="wallet-title">정보 수정</p>${r.status === 'needs_info' ? '<p class="sup-desc">고쳐서 저장하면 다시 접수돼요.</p>' : ''}${prFormHtml(r)}</div>`;
  const rows = [['종류', r.kind], ['기관', r.org], ['마감일', r.deadline], ['지원 대상', r.target], ['지원 금액·혜택', r.amount], ['남긴 말', r.memo]]
    .filter(([, v]) => v).map(([k, v]) => `<div class="pr-row"><span>${esc(k)}</span><p>${esc(v)}</p></div>`).join('');
  const cm = pr.comments[r.id];
  const cmHtml = cm == null ? '<p class="sup-desc">댓글을 불러오는 중이에요</p>'
    : cm === false ? '<p class="sup-desc">댓글을 불러오지 못했어요.</p><button type="button" class="link-btn" data-pr="reload-cm">다시 불러오기</button>'
    : cm.length ? cm.map((c) => `<div class="pr-cm ${c.author === 'admin' ? 'pr-cm-admin' : ''}"><b>${c.author === 'admin' ? '한대장 운영자' : '나'}</b><span>${esc(prDate(c.created_at))}</span><p>${esc(c.body)}</p></div>`).join('')
      : '<p class="sup-desc">아직 댓글이 없어요. 운영자에게 물을 것이 있으면 남겨 주세요.</p>';
  return `<div class="my-card">
      <button type="button" class="link-btn" data-pr="close">‹ 게시물 목록</button>
      <div class="pr-head">${prStatusPill(r.status)}<span class="pr-when">${esc(prDate(r.created_at))} 요청</span></div>
      <p class="pr-title">${esc(r.title)}</p>
      <a class="pr-link" href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">${esc(r.url)}</a>
      ${rows}
      ${editable ? `<button type="button" class="btn btn-outline pr-wide" data-pr="edit">정보 수정</button>` : ''}
      ${editable && Array.isArray(cm) && !cm.some((c) => c.author === 'admin') ? `<button type="button" class="link-btn pr-danger" data-pr="withdraw">요청 거두기</button>` : ''}
    </div>
    <div class="my-card">
      <p class="wallet-title">댓글</p>
      <div class="pr-cms">${cmHtml}</div>
      <form id="pr-comment" class="pr-cm-form" novalidate>
        <textarea name="body" rows="3" maxlength="2000" placeholder="운영자에게 남길 말"></textarea>
        <p class="auth-err" id="pr-err" ${pr.err ? '' : 'hidden'}>${esc(pr.err)}</p>
        <button type="submit" class="btn btn-primary btn-lg pr-wide" ${pr.busy ? 'disabled' : ''}>댓글 달기</button>
      </form>
    </div>`;
}
function prManageHtml() {
  if (pr.list == null) return '<div class="my-card"><p class="sup-desc">게시 요청을 불러오는 중이에요</p></div>';
  const open = pr.open != null && pr.list.find((r) => r.id === pr.open);
  if (open) return prDetailHtml(open);
  if (!pr.list.length) return '<div class="my-card"><p class="sup-desc">아직 보낸 게시 요청이 없어요.</p><button type="button" class="btn btn-primary btn-lg pr-wide" data-pr-tab="new">게시 요청하기</button></div>';
  const count = (s) => pr.list.filter((r) => r.status === s).length;
  const sum = Object.keys(PR_STATUS).filter((s) => count(s)).map((s) => `${PR_STATUS[s].label} ${count(s)}`).join(' · ');
  return `<div class="my-card">
      <p class="wallet-title">게시 요청 현황</p>
      <p class="sup-desc">${esc(sum)}</p>
      <div class="pr-list">${pr.list.map((r) => `<button type="button" class="pr-item" data-pr-open="${esc(r.id)}">
        <span class="pr-head">${prStatusPill(r.status)}<span class="pr-when">${esc(r.kind)} · ${esc(prDate(r.created_at))}</span></span>
        <span class="pr-item-t">${esc(r.title)}</span>
        <span class="pr-item-o">${esc(r.org)}${r.deadline ? ` · 마감 ${esc(r.deadline)}` : ''}</span>
      </button>`).join('')}</div>
    </div>`;
}
function renderPostReq() {
  const el = $('#postreq-body');
  if (!el) return;
  if (typeof supabaseConfigured !== 'function' || !supabaseConfigured()) {
    el.innerHTML = '<div class="my-card"><p class="sup-desc">게시 요청은 지금 준비 중이에요.</p></div>';
    return;
  }
  if (!staffSignedIn()) { el.innerHTML = prLoginHtml(); return; }
  if (pr.staff === undefined) { el.innerHTML = '<div class="my-card"><p class="sup-desc">담당자 정보를 불러오는 중이에요</p></div>'; prRefresh(); return; }
  if (pr.staff === null) { el.innerHTML = prStaffFormHtml(); return; }
  el.innerHTML = `<div class="pr-who"><span>${esc(pr.staff.org)} · ${esc(pr.staff.name)}</span><button type="button" class="link-btn" data-pr="logout">담당자 로그아웃</button></div>
    <div class="pr-tabs" role="tablist">
      <button type="button" role="tab" class="pr-tab${pr.tab === 'new' ? ' active' : ''}" data-pr-tab="new" aria-selected="${pr.tab === 'new'}">게시 요청하기</button>
      <button type="button" role="tab" class="pr-tab${pr.tab === 'manage' ? ' active' : ''}" data-pr-tab="manage" aria-selected="${pr.tab === 'manage'}">게시물 관리</button>
    </div>
    ${pr.tab === 'new' ? `<div class="my-card"><p class="sup-desc">보내 주신 공고는 운영자가 원문을 확인한 뒤 게시해요. 진행 상황과 답변은 「게시물 관리」에서 볼 수 있어요.</p>${prFormHtml(null, pr.staff)}</div>` : prManageHtml()}`;
}

/* 서버에서 담당자 정보·목록을 다시 받는다 */
async function prRefresh() {
  if (!staffSignedIn()) { renderPostReq(); return; }
  const staff = await prLoadStaff();
  if (!staffSignedIn()) { pr.staff = undefined; renderPostReq(); return; }   // 갱신 실패로 세션이 끝났다
  if (staff === undefined) { prLoadFail('담당자 정보를 불러오지 못했어요'); return; }
  /* 🔴 목록을 못 받으면 '요청 없음'으로 그리지 않는다 — 빈 목록과 못 읽음은 다른 말이다(리뷰 2026-11-21) */
  const list = staff ? await prLoadList() : [];
  if (staff && !list) { pr.staff = staff; prLoadFail('게시 요청을 불러오지 못했어요'); return; }
  pr.staff = staff;
  pr.list = list;
  renderPostReq();
  if (pr.open != null && pr.comments[pr.open] == null) prOpenComments(pr.open);
}
function prLoadFail(what) {
  pr.err = '';
  $('#postreq-body').innerHTML = `<div class="my-card"><p class="sup-desc">${esc(what)}. 잠시 후 다시 시도해 주세요.</p>
    <button type="button" class="btn btn-outline pr-wide" data-pr="retry">다시 시도</button>
    <button type="button" class="link-btn" data-pr="logout">담당자 로그아웃</button></div>`;
}
async function prOpenComments(id) {
  const cm = await prLoadComments(id);
  pr.comments[id] = cm || false;   // false = 못 받음(빈 목록 [] 과 다르다 — 화면이 '다시 불러오기'를 단다)
  if (pr.open === id && currentScreen === 'postreq') renderPostReq();
}
function prShowErr(msg) {
  pr.err = msg || '';
  const e = $('#pr-err');
  if (e) { e.textContent = pr.err; e.hidden = !pr.err; }
}
/* ── 한 화면 두 칸 (2026-11-22 개발자 지시 "게시요청과 광고문의를 하나로 합치고") ──
   [게시 요청] = 이 파일 · [광고 문의] = ad-inquiry.js. 어느 칸인가는 inqTab 하나 — 그리는 함수는 각 파일 그대로다 */
let inqTab = 'post';
function renderInquiry() {
  const ad = inqTab === 'ad';
  for (const b of document.querySelectorAll('#inq-tabs .inq-tab')) {
    const on = b.dataset.inq === inqTab;
    b.classList.toggle('active', on);
    b.setAttribute('aria-selected', String(on));
  }
  const post = $('#postreq-body'), adb = $('#adinq-body');
  if (post) post.hidden = ad;
  if (adb) adb.hidden = !ad;
  if (ad) { if (typeof renderAdInquiry === 'function') renderAdInquiry(); }
  else renderPostReq();
}
function openPostReq() {
  pr.err = ''; pr.edit = false;
  if (staffSignedIn()) pr.staff = undefined;   // 들어올 때마다 서버에서 새로 받는다(운영자가 바꾼 상태·댓글)
  inqTab = 'post';
  showScreen('postreq');
}

/* ── 손짓 ───────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  const root = $('#postreq-body');
  if (!root) return;
  const back = $('#btn-postreq-back');
  if (back) back.addEventListener('click', () => showScreen('home', { back: true }));
  const tabs = $('#inq-tabs');
  if (tabs) tabs.addEventListener('click', (ev) => {
    const t = ev.target.closest('.inq-tab');
    if (!t || t.dataset.inq === inqTab) return;
    inqTab = t.dataset.inq === 'ad' ? 'ad' : 'post';
    renderInquiry();
    appScrollTo(0);
  });
  /* 가입 확인 링크로 돌아왔으면 담당자로 들어온 채 게시 요청 화면을 연다(첫 화면이 다 그려진 뒤) */
  if (staffCaptureFromUrl()) setTimeout(() => { prResetAccount(); openPostReq(); toast('담당자 가입을 확인했어요'); }, 1200);

  root.addEventListener('click', async (ev) => {
    const kind = ev.target.closest('.pr-kind');
    if (kind) { for (const c of root.querySelectorAll('.pr-kind')) c.classList.toggle('active', c === kind); return; }
    const tab = ev.target.closest('[data-pr-tab]');
    if (tab) { pr.tab = tab.dataset.prTab; pr.open = null; pr.edit = false; pr.err = ''; renderPostReq(); if (pr.tab === 'manage') prRefresh(); return; }
    const item = ev.target.closest('[data-pr-open]');
    if (item) { pr.open = Number(item.dataset.prOpen); pr.edit = false; pr.err = ''; renderPostReq(); prOpenComments(pr.open); appScrollTo(0); return; }
    const b = ev.target.closest('[data-pr]');
    if (!b) return;
    const act = b.dataset.pr;
    if (act === 'swap') { pr.mode = pr.mode === 'up' ? 'in' : 'up'; pr.err = ''; renderPostReq(); return; }
    if (act === 'retry') { prRefresh(); return; }
    if (act === 'reload-cm') { delete pr.comments[pr.open]; renderPostReq(); prOpenComments(pr.open); return; }
    if (act === 'logout') { await staffSignOut(); prResetAccount(); renderPostReq(); toast('담당자 로그아웃했어요'); return; }
    if (act === 'close') { pr.open = null; pr.edit = false; pr.err = ''; renderPostReq(); return; }
    if (act === 'edit') { pr.edit = true; pr.err = ''; renderPostReq(); return; }
    if (act === 'cancel-edit') { pr.edit = false; pr.err = ''; renderPostReq(); return; }
    if (act === 'withdraw') {
      if (!confirm('이 게시 요청을 거둘까요? 댓글도 함께 지워져요.')) return;
      const res = await staffFetch(`/rest/v1/post_requests?id=eq.${prEnc(pr.open)}`, { method: 'DELETE', headers: PR_RET });
      if (!res.ok || !Array.isArray(res.json) || !res.json.length) { prShowErr(res.ok ? '이 요청은 지금 거둘 수 없어요' : prErrText(res)); return; }
      pr.list = pr.list.filter((r) => r.id !== pr.open); pr.open = null; renderPostReq(); toast('게시 요청을 거뒀어요');
    }
  });

  root.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const f = ev.target;
    if (pr.busy) return;
    const done = () => { pr.busy = false; };
    pr.busy = true;
    try {
      if (f.id === 'pr-login') {
        const email = f.email.value.trim(), pw = f.pw.value;
        if (!email || !pw) { prShowErr('이메일과 비밀번호를 적어 주세요'); return; }
        if (pr.mode === 'up' && !f.agree.checked) { prShowErr('약관에 동의해 주세요'); return; }
        const r = pr.mode === 'up' ? await staffSignUp(email, pw) : await staffSignIn(email, pw);
        if (!r.ok) { prShowErr(r.error); return; }
        if (r.needsEmailConfirm) { pr.mode = 'in'; pr.err = ''; renderPostReq(); toast('가입 확인 메일의 링크를 누른 뒤 로그인해 주세요'); return; }
        prResetAccount(); pr.tab = 'manage'; done(); renderPostReq();
        return;
      }
      if (f.id === 'pr-staff') {
        const row = { user_id: (staffLoad() || {}).userId, org: f.org.value.trim(), name: f.name.value.trim(), contact: f.contact.value.trim() };
        if (!row.org || !row.name || row.contact.length < 3) { prShowErr('기관명·이름·연락처를 모두 적어 주세요'); return; }
        const res = await staffFetch('/rest/v1/post_staff', { method: 'POST', body: row, headers: PR_RET });
        if (res.status === 409) { done(); pr.staff = undefined; prRefresh(); return; }   // 이미 적어 둔 계정 — 다시 받아 다음 화면으로
        if (!res.ok) { prShowErr(prErrText(res, 'pr-staff')); return; }
        pr.staff = (res.json && res.json[0]) || row; pr.list = []; pr.tab = 'new'; pr.err = ''; done(); renderPostReq();
        return;
      }
      if (f.id === 'pr-form') {
        const c = prCollect(f);
        if (c.error) { prShowErr(c.error); return; }
        const editing = pr.edit && pr.open != null;
        const res = editing
          ? await staffFetch(`/rest/v1/post_requests?id=eq.${prEnc(pr.open)}`, { method: 'PATCH', body: c.row, headers: PR_RET })
          : await staffFetch('/rest/v1/post_requests', { method: 'POST', body: Object.assign({ user_id: (staffLoad() || {}).userId }, c.row), headers: PR_RET });
        /* PATCH 는 정책이 막으면 오류가 아니라 0행이다 — 그것도 실패로 본다(게시 뒤에는 못 고친다) */
        if (!res.ok || !Array.isArray(res.json) || !res.json.length) { prShowErr(res.ok ? '이 요청은 지금 고칠 수 없어요' : prErrText(res, 'pr-form')); return; }
        const saved = res.json[0];
        pr.list = [saved].concat((pr.list || []).filter((r) => r.id !== saved.id)).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
        pr.tab = 'manage'; pr.open = saved.id; pr.edit = false; pr.err = ''; done(); renderPostReq(); appScrollTo(0);
        if (pr.comments[saved.id] == null) prOpenComments(saved.id);
        toast(editing ? '수정했어요' : '게시 요청을 보냈어요');
        return;
      }
      if (f.id === 'pr-comment') {
        const body = f.body.value.trim();
        if (!body) { prShowErr('댓글 내용을 적어 주세요'); return; }
        const res = await staffFetch('/rest/v1/post_comments', { method: 'POST', body: { request_id: pr.open, user_id: (staffLoad() || {}).userId, author: 'staff', body }, headers: PR_RET });
        if (!res.ok || !Array.isArray(res.json)) { prShowErr(prErrText(res, 'pr-comment')); return; }
        pr.comments[pr.open] = (Array.isArray(pr.comments[pr.open]) ? pr.comments[pr.open] : []).concat(res.json);
        pr.err = ''; done(); renderPostReq();
      }
    } finally { done(); }
  });
});

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { STAFF_AUTH_KEY, PR_STATUS, PR_EDITABLE, prCollect };
}

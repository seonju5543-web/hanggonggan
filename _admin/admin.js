/* ============================================================
   한대장 관리자 — 화면 본체
   ------------------------------------------------------------
   설계 원칙 세 가지
   ① 규칙을 두 벌로 만들지 않는다 — 등록 규칙(entry-rules)·주소 정규화(url-key)·
      채널 판정(data.js)·양식 렌더(forms.js)는 전부 앱1/로봇의 원본을 그대로 가져다 쓴다.
      build.sh가 빌드 때 vendor/로 복사한다.
   ② 버튼이 저장소를 직접 고치지 않는다 — 정해진 워크플로를 깨우고, 그 워크플로가
      기존 감사(verify/audit-data.js)를 통과할 때만 저장한다.
   ③ 열쇠가 없으면 아무것도 그리지 않는다 — 열쇠는 GitHub에 실제로 확인한다.
   ============================================================ */

import { urlKey } from './vendor/url-key.mjs';

/* ---------------- 설정 ---------------- */
const OWNER = 'seonju5543-web';
const REPO = 'hanggonggan';
const BRANCH = 'claude/nice-heisenberg-WESq5';   // 로봇·사람이 먼저 쓰는 기본 브랜치
const DEPLOY_BRANCH = 'main';                    // 앱1이 배포되는 브랜치
const API = 'https://api.github.com';
const WF_ADMIN = 'admin-apply.yml';
const WF_COLLECT = 'collect-scholarships.yml';
const WF_BROWSER = 'browser-collect.yml';
const KEY_NAME = 'handaejang.admin.key';

const raw = (path, branch = BRANCH) =>
  `https://raw.githubusercontent.com/${OWNER}/${REPO}/${branch}/${path}?t=${Date.now()}`;

/* 오늘 (한국 시간 기준 — 마감 판정이 하루 어긋나지 않게) */
const today = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const TODAY = today();

/* ---------------- 유틸 ---------------- */
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
/* 앱1과 같은 링크 안전화 — 오염된 데이터가 javascript: 같은 주소를 넣지 못하게 */
function safeUrl(u) {
  if (!u) return '';
  try {
    const p = new URL(String(u), location.origin);
    if (p.protocol === 'http:' || p.protocol === 'https:' || p.protocol === 'mailto:') return p.href;
  } catch (e) { /* 잘못된 주소 */ }
  return '';
}
window.esc = esc;          // vendor/forms.js·data.js가 쓰는 전역
window.safeUrl = safeUrl;

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const byId = (id) => document.getElementById(id);

let toastTimer = null;
function toast(msg) {
  const t = byId('toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 2800);
}

function dday(deadline) {
  if (!deadline) return null;
  const a = new Date(`${TODAY}T00:00:00Z`), b = new Date(`${deadline}T00:00:00Z`);
  return Math.round((b - a) / 86400000);
}
function ddayHtml(it) {
  const d = dday(it.deadline);
  if (d == null) return '<span class="dd none">마감일 없음</span>';
  if (d < 0) return `<span class="dd none">마감 ${-d}일 지남</span>`;
  const cls = d <= 3 ? 'near' : d <= 7 ? 'soon' : '';
  return `<span class="dd ${cls}">${d === 0 ? 'D-DAY' : `D-${d}`}</span>`;
}

/* ---------------- 열쇠 ---------------- */
let TOKEN = '';
const ghHeaders = (tk = TOKEN) => ({
  Authorization: `Bearer ${tk}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
});
function readStoredKey() {
  return sessionStorage.getItem(KEY_NAME) || localStorage.getItem(KEY_NAME) || '';
}
function storeKey(k, remember) {
  clearStoredKey();
  (remember ? localStorage : sessionStorage).setItem(KEY_NAME, k);
}
function clearStoredKey() {
  sessionStorage.removeItem(KEY_NAME);
  localStorage.removeItem(KEY_NAME);
}
/* 열쇠가 진짜인지 GitHub에 물어본다 — 화면 잠금이 흉내가 아니라 실제가 되는 지점 */
async function verifyKey(k) {
  try {
    const r = await fetch(`${API}/repos/${OWNER}/${REPO}`, { headers: ghHeaders(k) });
    if (r.ok) return { ok: true };
    if (r.status === 401) return { ok: false, why: '열쇠가 올바르지 않거나 만료됐습니다.' };
    if (r.status === 403) return { ok: false, why: '이 열쇠에는 저장소 접근 권한이 없습니다.' };
    if (r.status === 404) return { ok: false, why: '열쇠에 이 저장소가 선택돼 있지 않습니다.' };
    return { ok: false, why: `GitHub 응답 ${r.status}` };
  } catch (e) {
    return { ok: false, why: '네트워크에 연결하지 못했습니다.' };
  }
}

/* ---------------- 데이터 ---------------- */
const D = {
  reg: [], notices: [], forms: {}, health: {}, schools: [], targets: [],
  linkHunt: {}, pending: [], autoCfg: { enabled: true, blockIds: [] }, log: [],
  updatedAt: '', deployAhead: null,
  failed: [],   // 읽지 못한 파일 — 비어 있지 않으면 화면 숫자를 믿으면 안 된다
};

/* 로봇 리포트 원문 캐시 — loadAll()에서 비운다(로봇을 돌린 뒤 옛 리포트가 보이면 안 된다) */
let reportCache = {};

/* 읽기에 실패해도 화면은 계속 그려야 한다(한 파일 때문에 전부 못 보면 더 나쁘다).
   다만 **조용히 빈 값으로 바꾸면 안 된다** — 그러면 인터넷이 끊겨도 '검수 전 0건 ·
   모든 게시판 정상'으로 보인다. 실패한 경로를 모아 화면 맨 위에 경고로 띄운다. */
async function readJson(path, fallback) {
  try {
    const r = await fetch(raw(path), { cache: 'no-store' });
    if (!r.ok) { D.failed.push({ path, why: `응답 ${r.status}` }); return fallback; }
    return await r.json();
  } catch (e) {
    D.failed.push({ path, why: '읽지 못함(네트워크 또는 형식 오류)' });
    return fallback;
  }
}
async function readText(path) {
  try {
    const r = await fetch(raw(path), { cache: 'no-store' });
    return r.ok ? await r.text() : '';
  } catch (e) { return ''; }
}

async function loadAll() {
  D.failed = [];        // 매번 새로 센다 — 지난번 실패가 남아 있으면 안 된다
  reportCache = {};     // 로봇을 돌린 뒤 옛 리포트가 보이던 문제(A5)
  const [reg, notices, forms, health, schools, targets, linkHunt, pending, autoCfg, log] =
    await Promise.all([
      readJson('data/registered.json', { items: [] }),
      readJson('data/notices.json', { items: [] }),
      readJson('data/forms.json', { templates: {} }),
      readJson('collector/health.json', {}),
      readJson('collector/schools.json', { schools: [] }),
      readJson('collector/browser-targets.json', { targets: [] }),
      readJson('collector/link-hunt.json', { items: {} }),
      readJson('collector/pending-forms.json', { items: [] }),
      readJson('collector/auto-register-config.json', { enabled: true, blockIds: [] }),
      readJson('data/admin-log.json', { items: [] }),
    ]);

  D.reg = reg.items || [];
  D.updatedAt = reg.updatedAt || '';
  D.notices = notices.items || [];
  D.forms = forms.templates || {};
  D.health = health || {};
  D.schools = schools.schools || [];
  D.targets = targets.targets || [];
  D.linkHunt = linkHunt.items || {};
  D.pending = pending.items || [];
  D.autoCfg = autoCfg || { enabled: true, blockIds: [] };
  D.log = (log.items || []).slice().reverse();   // 최신이 위로

  /* 앱1(main)까지 반영됐는지 — 기본 브랜치가 앞서 있으면 배포 대기 */
  try {
    const r = await fetch(`${API}/repos/${OWNER}/${REPO}/compare/${DEPLOY_BRANCH}...${BRANCH}`, { headers: ghHeaders() });
    if (r.ok) { const c = await r.json(); D.deployAhead = c.ahead_by ?? null; }
  } catch (e) { D.deployAhead = null; }

  /* 앱1과 같은 방식으로 양식 원본을 병합한다 (forms.js의 내장 2종은 오프라인 폴백일 뿐) */
  if (typeof FORM_TEMPLATES !== 'undefined') Object.assign(FORM_TEMPLATES, D.forms);
}

/* ---------------- 분류 ----------------
   1차 = 처리 상태, 2차 = 소속(학교/전국), 3차 = 성격, 4차 = 접수 방법.
   여기에 '처리 배지'(축이 아니라 경고등)를 얹는다. */

function statusOf(it) {
  if (it.deadline && it.deadline < TODAY) return 'closed';
  return it.auto ? 'unreviewed' : 'official';
}
const STATUS_LABEL = { unreviewed: '검수 전', official: '정식 등록', closed: '마감·종료' };

function schoolOf(it) {
  const e = it.eligibility || {};
  return e.schoolOnly || '전국·교외';
}

const NATURE_RULES = [
  ['성적우수', /성적|우수|학업|모범|면학|수석|장려/],
  ['생활지원', /생활|저소득|기초|차상위|가계|형편|복지|긴급|생계/],
  ['특별자격', /장애|보훈|유공|다문화|탈북|새터민|한부모|다자녀|국가유공/],
  ['근로·인턴', /근로|인턴|조교|현장실습/],
  ['기숙사·주거', /기숙|생활관|주거|장학관|하숙/],
  ['지역연고', /출신|거주|시민|도민|군민|향우|지역인재/],
  ['종교·단체', /교회|성당|사찰|불자|종단|동문|총동문/],
];
function naturesOf(it) {
  const hay = `${it.name || ''} ${it.summary || ''} ${(it.documents || []).join(' ')}`;
  const out = NATURE_RULES.filter(([, re]) => re.test(hay)).map(([k]) => k);
  if ((it.eligibility || {}).tracks) out.push('학과한정');
  return out.length ? out : ['기타'];
}

/* 접수 방법 — 앱1(data.js submitChannelLabel)과 같은 순서로 판정한다 */
function channelOf(it) {
  if (it.applyEmail) return 'email';
  if (it.program || /한국장학재단/.test(it.provider || '')) return 'kosaf';
  if (it.formId) return 'form';
  if (typeof hasFormAttachment === 'function' && hasFormAttachment(it)) return 'download';
  return 'portal';
}
const CHANNEL_LABEL = {
  email: '이메일 접수', kosaf: '한국장학재단', form: '앱에서 양식 작성',
  download: '원본 양식 다운로드형', portal: '포털 입력',
};

const RULES = (window.ENTRY_RULES && window.ENTRY_RULES.RULES) || {};
const checkEntry = (window.ENTRY_RULES && window.ENTRY_RULES.checkEntry) || (() => []);
const isDuplicatePair = (window.ENTRY_RULES && window.ENTRY_RULES.isDuplicatePair) || (() => false);

function formIdSet() { return new Set(Object.keys(D.forms)); }

/* 스키마화 대기 — **한 곳에서만** 센다.
   예전엔 '오늘 할 일'이 `fetched && !schematized`, '양식' 화면이 `!schematized`로 세어
   같은 화면 안에서 건수가 달랐다. `retired`(6회 실패로 자동 재시도를 멈춘 것)도 뺀다 —
   사람이 지금 할 수 있는 일이 아니므로 '할 일' 숫자에 섞이면 안 된다. */
function pendingForms() {
  return D.pending.filter((q) => q.fetched && !q.schematized && !q.retired);
}
function pendingFetchWait() { return D.pending.filter((q) => !q.fetched && !q.retired); }
function pendingRetired() { return D.pending.filter((q) => q.retired && !q.schematized); }

function badgesOf(it, formIds) {
  const b = [];
  if (!it.amountValue) b.push('금액 미확인');
  if (!it.deadline) b.push('마감일 없음');
  if (typeof hasFormAttachment === 'function' && hasFormAttachment(it) && !it.formId) b.push('양식 미등록');
  const u = it.sourceUrl || '';
  if ((RULES.DOWNLOAD_URL && RULES.DOWNLOAD_URL.test(u)) || u.includes('#n-')) b.push('원문 링크 이상');
  if (it.formId && !formIds.has(it.formId)) b.push('없는 양식 연결');
  return b;
}
function problemsOf(it, formIds) {
  return checkEntry(it, { formIds }) || [];
}

/* 경고등의 무게 — 예전엔 전부 `pill bad`(빨강)라 **무엇이 문제인지 구별이 안 됐다.**
   빨강은 '앱1에 잘못 나갈 수 있는 것'에만 쓴다. */
const BADGE_TONE = {
  '금액 미확인': '', '마감일 없음': '',
  '양식 미등록': 'warn',
  '원문 링크 이상': 'bad', '없는 양식 연결': 'bad',
};
const badgeTone = (b) => BADGE_TONE[b] ?? 'warn';

/* 미등록 피드 — 수집됐지만 등록되지 않은 공고 (주소·제목 두 열쇠로 대조).
   수집기와 **같은 주소 정규화**(url-key.mjs)를 쓴다 — 규칙이 갈라지면 이미 등록한 공고가
   '미등록'으로 다시 올라와 같은 것을 두 번 등록하게 된다. */
function unregisteredNotices() {
  const keys = new Set();
  D.reg.forEach((it) => { if (it.sourceUrl) keys.add(`u:${urlKey(it.sourceUrl)}`); });
  return D.notices.filter((n) => {
    if (keys.has(`u:${urlKey(n.url)}`)) return false;
    return !D.reg.some((it) => (it.name || '').trim() && (n.title || '').includes((it.name || '').slice(0, 12)));
  });
}

/* 등록 대상이 아닌 것 — 로봇이 거르는 규칙과 같은 기준으로 흐리게 표시해 눈이 덜 가게 한다.
   (지우지는 않는다. 규칙이 틀렸을 때 사람이 발견할 수 있어야 하므로) */
function skipReason(n) {
  const t = n.title || '';
  if (RULES.LOAN && RULES.LOAN.test(t) && !(RULES.LOAN_EXCEPT && RULES.LOAN_EXCEPT.test(t))) return '학자금 대출';
  if (RULES.GRAD_ONLY && RULES.GRAD_ONLY.test(t)) return '대학원 전용';
  if (RULES.FILENAME_TITLE && RULES.FILENAME_TITLE.test(t)) return '첨부 파일명';
  if (RULES.DOWNLOAD_URL && RULES.DOWNLOAD_URL.test(n.url || '')) return '첨부 내려받기 주소';
  if (t.replace(/\s/g, '').length < 8) return '제목이 너무 짧음';
  return '';
}

/* 중복 의심 쌍 */
function duplicatePairs() {
  const out = [];
  for (let i = 0; i < D.reg.length; i += 1) {
    for (let j = i + 1; j < D.reg.length; j += 1) {
      if (isDuplicatePair(D.reg[i], D.reg[j])) out.push([D.reg[i], D.reg[j]]);
    }
  }
  return out;
}

/* 죽은 링크 — 링크 사냥꾼이 남긴 실패 기록 */
function deadLinks() {
  return Object.entries(D.linkHunt)
    .filter(([, v]) => v && v.lastWhy && /HTTP (4|5)\d\d|실패|없음/.test(v.lastWhy))
    .map(([k, v]) => ({ key: k, ...v }));
}

/* 수집 실패 학교 */
function failingSchools() {
  return Object.entries(D.health).filter(([, v]) => (v.fails || 0) > 0)
    .map(([school, v]) => ({ school, ...v }))
    .sort((a, b) => b.fails - a.fails);
}

/* ---------------- 쓰기 ---------------- */
let jobBusy = false;

function jobShow(text, cls = '', link = '') {
  const j = byId('job');
  j.hidden = false;
  j.className = `job ${cls}`;
  byId('job-text').textContent = text;
  const a = byId('job-link');
  if (link) { a.href = link; a.hidden = false; } else { a.hidden = true; }
}

async function dispatchWorkflow(file, inputs) {
  const r = await fetch(`${API}/repos/${OWNER}/${REPO}/actions/workflows/${file}/dispatches`, {
    method: 'POST',
    headers: { ...ghHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ ref: BRANCH, inputs }),
  });
  if (!r.ok) {
    const t = await r.text().catch(() => '');
    throw new Error(`실행 요청이 거부됐습니다 (${r.status}). ${t.slice(0, 180)}`);
  }
}

/* 방금 띄운 실행을 찾아 끝날 때까지 지켜본다 */
async function waitForRun(file, sinceISO) {
  const url = `${API}/repos/${OWNER}/${REPO}/actions/workflows/${file}/runs?per_page=5`;
  for (let i = 0; i < 90; i += 1) {                 // 최대 약 6분
    await new Promise((res) => setTimeout(res, i < 5 ? 2000 : 4000));
    try {
      const r = await fetch(url, { headers: ghHeaders() });
      if (!r.ok) continue;
      const d = await r.json();
      const run = (d.workflow_runs || []).find((x) => new Date(x.created_at) >= new Date(sinceISO));
      if (!run) continue;
      if (run.status === 'completed') return run;
      jobShow('반영 중… 검사와 저장이 진행되고 있어요', '', run.html_url);
    } catch (e) { /* 잠깐 실패는 넘어간다 */ }
  }
  return null;
}

/* 관리자 조정 1건 — 요청 → 검사 → 반영까지 지켜보고 화면을 다시 읽는다 */
async function applyAction(action, payload, label) {
  if (jobBusy) { toast('앞선 작업이 아직 끝나지 않았어요'); return false; }
  jobBusy = true;
  const since = new Date(Date.now() - 15000).toISOString();
  try {
    jobShow(`${label} — 요청을 보냈어요`);
    await dispatchWorkflow(WF_ADMIN, { action, payload: JSON.stringify(payload) });
    const run = await waitForRun(WF_ADMIN, since);
    if (!run) {
      jobShow('아직 끝나지 않았어요. 실행 기록에서 결과를 확인해 주세요', '',
        `https://github.com/${OWNER}/${REPO}/actions/workflows/${WF_ADMIN}`);
      return false;
    }
    if (run.conclusion === 'success') {
      jobShow(`${label} — 반영 완료. 앱1에는 배포 로봇이 이어서 올립니다`, 'ok', run.html_url);
      await loadAll(); renderAll();
      return true;
    }
    jobShow(`${label} — 검사를 통과하지 못해 되돌렸습니다. 실행 기록에서 사유를 확인하세요`, 'bad', run.html_url);
    return false;
  } catch (e) {
    jobShow(e.message || '요청에 실패했습니다', 'bad');
    return false;
  } finally {
    jobBusy = false;
  }
}

/* ---------------- 화면 전환 ---------------- */
const SCREENS = ['todo', 'list', 'review', 'forms', 'network', 'quality'];
let current = 'todo';

function show(name) {
  current = name;
  SCREENS.forEach((n) => { byId(`screen-${n}`).hidden = n !== name; });
  $$('.tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
  window.scrollTo(0, 0);
  renderScreen(name);
}

function renderScreen(name) {
  ({ todo: renderTodo, list: renderList, review: renderReview,
    forms: renderForms, network: renderNetwork, quality: renderQuality }[name] || (() => {}))();
}

/* 읽지 못한 데이터가 있으면 화면 맨 위에 붙인다.
   "아래 숫자를 믿지 마세요"까지 적는 이유: 실패한 파일은 빈 값으로 대체돼
   '검수 전 0건'·'모든 게시판 정상'처럼 **안심되는 쪽으로** 틀리기 때문이다. */
function renderDataFail() {
  const box = byId('datafail');
  if (!box) return;
  if (!D.failed.length) { box.hidden = true; box.innerHTML = ''; return; }
  box.hidden = false;
  box.innerHTML = `
    <b>데이터 ${D.failed.length}종을 읽지 못했습니다 — 아래 숫자를 믿지 마세요.</b>
    <ul>${D.failed.map((f) => `<li><code class="mono">${esc(f.path)}</code> — ${esc(f.why)}</li>`).join('')}</ul>
    <button class="btn btn-sm" id="datafail-retry">다시 읽기</button>`;
  byId('datafail-retry').addEventListener('click', () => byId('btn-reload').click());
}

function renderAll() {
  renderDataFail();
  renderCounts();
  renderScreen(current);
  const dep = byId('deploy-state');
  if (D.deployAhead == null) { dep.textContent = ''; dep.className = 'deploy-state'; }
  else if (D.deployAhead === 0) { dep.textContent = '앱1 반영 완료'; dep.className = 'deploy-state synced'; }
  else { dep.textContent = `앱1 반영 대기 ${D.deployAhead}건`; dep.className = 'deploy-state pending'; }
  byId('foot-info').textContent =
    `정식 등록 ${D.reg.length}건 · 양식 ${Object.keys(D.forms).length}종 · 실시간 공고 ${D.notices.length}건 · 데이터 기준일 ${D.updatedAt || '알 수 없음'}`;
}

function renderCounts() {
  const fi = formIdSet();
  const unrevItems = D.reg.filter((it) => statusOf(it) === 'unreviewed');
  const probItems = D.reg.filter((it) => problemsOf(it, fi).length);
  const unrev = unrevItems.length;
  const probs = probItems.length;
  /* '오늘 할 일' 배지는 **합집합**이다 — 예전엔 unrev + probs로 더해서
     검수도 안 됐고 규칙도 어긴 공고를 두 번 셌다(실제 숫자가 부풀려져 있었다). */
  const todo = new Set([...unrevItems, ...probItems].map((it) => it.id)).size;
  const set = (id, n, hot) => {
    const el = byId(id);
    el.textContent = n;
    el.className = `tab-n${hot && n > 0 ? ' hot' : ''}`;
  };
  set('n-todo', todo, true);
  set('n-list', D.reg.length);
  set('n-review', unrev, true);
  set('n-forms', Object.keys(D.forms).length);
  set('n-network', failingSchools().length, true);
  set('n-quality', probs, true);
}

/* ---------------- ① 오늘 할 일 ---------------- */
function renderTodo() {
  const fi = formIdSet();
  const unrev = D.reg.filter((it) => statusOf(it) === 'unreviewed');
  const urgent = unrev.filter((it) => { const d = dday(it.deadline); return d != null && d >= 0 && d <= 7; });
  const probs = D.reg.filter((it) => problemsOf(it, fi).some((p) => p.level === 'error'));
  const warns = D.reg.filter((it) => problemsOf(it, fi).some((p) => p.level === 'warn'));
  const dead = deadLinks();
  const fails = failingSchools();
  const queue = pendingForms();
  const noBoard = D.schools.filter((s) => !s.boardUrl);

  const card = (c) => `
    <div class="card ${c.cls}">
      <div class="v">${c.v}</div>
      <div class="k">${esc(c.k)}</div>
      <div class="d">${c.d}</div>
      ${c.btn ? `<div class="btn-row">${c.btn}</div>` : ''}
    </div>`;

  /* 카드 9장이 전부 같은 크기·같은 무게라 급한 것과 참고가 구별되지 않았고,
     **0건인 초록 카드가 첫 화면의 2/3를 먹었다.** 이제 할 일이 있는 것만 카드로 올리고
     0건은 아래 한 줄 띠로 접는다 — '오늘 할 일' 화면이 실제로 할 일만 보여준다. */
  const all = [
    { n: urgent.length, tone: 'is-bad', k: '마감 임박한데 검수 전',
      d: '오늘 처리하지 않으면 학생이 놓칩니다 (7일 이내 마감)',
      btn: '<button class="btn btn-primary btn-sm" data-go="review">컨펌 작업대로</button>' },
    { n: unrev.length, tone: 'is-warn', k: '검수 전 (학생 앱에 이미 노출)',
      d: '로봇이 자동 등록했고 아직 사람이 확인하지 않았습니다',
      btn: '<button class="btn btn-sm" data-go="review">확인하기</button>' },
    { n: probs.length, tone: 'is-bad', k: '규칙 위반 (오류)',
      d: '앱1에 잘못 표시될 수 있는 항목입니다',
      btn: '<button class="btn btn-sm" data-go="quality">품질 화면으로</button>' },
    { n: warns.length, tone: 'is-warn', k: '규칙 경고',
      d: '치명적이지는 않지만 손봐야 할 항목입니다',
      btn: '<button class="btn btn-sm" data-go="quality">보기</button>' },
    { n: dead.length, tone: 'is-warn', k: '원문 링크 실패 기록',
      d: '학생이 원문 보기를 눌렀을 때 안 열리는 주소입니다',
      btn: '<button class="btn btn-sm" data-go="quality">보기</button>' },
    { n: fails.length, tone: 'is-bad', k: '수집 실패 중인 학교',
      d: '이 학교 공고가 앱1에 들어오지 않고 있습니다',
      btn: '<button class="btn btn-sm" data-go="network">수집망 보기</button>' },
    { n: queue.length, tone: 'is-warn', k: '양식 스키마화 대기',
      d: '원본은 확보됐고 앱에서 작성 가능하게 만드는 일이 남았습니다',
      btn: '<button class="btn btn-sm" data-go="forms">양식 화면으로</button>' },
    { n: noBoard.length, tone: 'is-warn', k: '게시판 주소 없는 학교',
      d: '주소를 넣으면 그 학교 학생에게 공고가 보이기 시작합니다',
      btn: '<button class="btn btn-sm" data-go="network">주소 넣기</button>' },
    { n: D.deployAhead || 0, tone: 'is-warn', k: '앱1 반영 대기',
      d: '배포 로봇이 아직 올리지 않은 변경입니다', btn: '',
      okD: '학생 앱이 최신입니다', v: D.deployAhead == null ? '—' : D.deployAhead },
  ];
  const todo = all.filter((c) => c.n > 0);
  const clear = all.filter((c) => c.n === 0);

  byId('screen-todo').innerHTML = `
    <div class="sec-head">
      <h2>오늘 할 일</h2>
      <p>눌러야 할 것만 모았습니다. 숫자를 구경하는 화면이 아닙니다.</p>
    </div>

    ${todo.length ? `<div class="cards">
      ${todo.map((c) => card({ cls: c.tone, v: c.v ?? c.n, k: c.k, d: c.d, btn: c.btn })).join('')}
    </div>` : '<p class="empty">지금 처리할 일이 없습니다. 모든 항목이 정상입니다.</p>'}

    ${clear.length ? `<div class="allclear">
      <span class="allclear-mark">✓</span>
      <span>정상 ${clear.length}항목</span>
      <span class="allclear-list">${clear.map((c) => esc(c.k)).join(' · ')}</span>
    </div>` : ''}

    ${urgent.length ? `
      <div class="sec-head" style="margin-top:8px">
        <h2>지금 처리할 것 — 마감 임박 + 검수 전</h2>
      </div>
      <div class="rows">${urgent.map(rowHtml).join('')}</div>` : ''}
  `;
}

/* ---------------- 다중 선택 ----------------
   저장소 쪽은 이미 여러 건을 받는다(`admin-apply.mjs`의 confirm·revert·remove가
   `payload.ids` 배열을 순회한다). 화면이 한 건씩만 보내고 있었을 뿐이다. */
const SEL = new Set();

function selClear() { SEL.clear(); }
function selRows() { return D.reg.filter((it) => SEL.has(it.id)); }

/* 선택은 '지금 화면에 보이는 것'만 유지한다 — 필터를 바꾼 뒤
   보이지도 않는 공고가 선택된 채 남아 있으면 '선택 12건'이 무엇인지 알 수 없다. */
function selKeepOnly(visibleIds) {
  const keep = new Set(visibleIds);
  [...SEL].forEach((id) => { if (!keep.has(id)) SEL.delete(id); });
}

/* ---------------- 잘린 목록 '더 보기' (B1) ----------------
   예전엔 목록마다 앞의 N건에서 **말없이 잘렸다** — 등록 후보 268건 중 80건,
   죽은 링크 256건 중 60건은 화면에서 도달할 방법이 아예 없었다.
   지금은 얼마나 남았는지 밝히고 눌러서 더 볼 수 있다. */
const MORE = {};                       // 목록별로 지금 몇 건까지 보여 주는가
const STEP = 50;
function shown(key, base = STEP) { return MORE[key] || base; }
function moreBtn(key, total, base = STEP) {
  const now = shown(key, base);
  if (total <= now) return '';
  const rest = total - now;
  return `<p class="more"><button class="btn btn-sm" data-more="${esc(key)}" data-base="${base}">
    ${Math.min(STEP, rest)}건 더 보기</button>
    <span class="muted">${now}/${total}건 표시 중 · ${rest}건 남음</span></p>`;
}

/* 경고등도 규칙 위반도 없는 검수 전 공고 — '한꺼번에 컨펌'의 안전한 대상 */
function cleanIds() {
  const fi = formIdSet();
  return D.reg.filter((it) => statusOf(it) === 'unreviewed'
    && !badgesOf(it, fi).length && !problemsOf(it, fi).length).map((it) => it.id);
}

/* ---------------- 목록 한 줄 ---------------- */
function rowHtml(it, opt = {}) {
  const fi = formIdSet();
  const st = statusOf(it);
  const badges = badgesOf(it, fi);
  const pick = opt.pick
    ? `<label class="pick" title="선택"><input type="checkbox" data-pick="${esc(it.id)}"${SEL.has(it.id) ? ' checked' : ''} /></label>`
    : '';
  return `
    <div class="row${opt.pick ? ' has-pick' : ''}" data-id="${esc(it.id)}">
      ${pick}
      <div>
        <div class="t">${esc(it.name)}</div>
        <div class="m">
          <span>${esc(schoolOf(it))}</span>
          <span>${esc(it.provider || '')}</span>
          <span>${esc(CHANNEL_LABEL[channelOf(it)])}</span>
        </div>
        ${badges.length ? `<div class="badges">${badges.map((b) => `<span class="pill ${badgeTone(b)}">${esc(b)}</span>`).join('')}</div>` : ''}
      </div>
      <div><span class="pill ${st}">${STATUS_LABEL[st]}</span></div>
      <div>${ddayHtml(it)}</div>
      ${opt.act ? `<div class="row-act"><button class="btn btn-sm btn-primary" data-quick-confirm="${esc(it.id)}">컨펌</button></div>` : ''}
    </div>`;
}

/* 여러 건 처리 — **무엇을 처리하는지 목록으로 보여 준 뒤** 확인받는다.
   삭제·되돌리기는 git 말고는 되돌릴 방법이 없으므로 "N건 처리할까요?"만 묻는 것으로는 부족하다.
   예전 '문제 없는 것 한꺼번에 컨펌'이 딱 그 방식이었다 — 몇 건인지만 알려 주고 무엇인지는 안 보여 줬다. */
const BULK = {
  confirm: { label: '검수 완료로', verb: '검수 완료로 표시', danger: false,
    note: "'검수 전' 배지가 사라지고 학생 앱에 정식 등록으로 보입니다." },
  revert: { label: '되돌리기', verb: '등록에서 빼고 재등록 차단', danger: true,
    note: '등록에서 빠지고, 수집 로봇이 다시 등록하지 않도록 차단 목록에 올라갑니다.' },
  remove: { label: '등록 삭제', verb: '등록에서 삭제', danger: true,
    note: '등록에서 지웁니다. 차단은 하지 않으므로 로봇이 다시 등록할 수 있습니다.' },
};

async function bulkAction(kind) {
  const meta = BULK[kind];
  if (!meta) return;
  const items = selRows();
  if (!items.length) { toast('선택된 공고가 없습니다'); return; }

  openSheet(`
    <div class="sheet-head">
      <h3>${esc(items.length)}건을 ${esc(meta.verb)}</h3>
      <button class="sheet-close" data-close aria-label="닫기">×</button>
    </div>
    <p class="muted">${esc(meta.note)}</p>
    <div class="rows">${items.map((it) => rowHtml(it)).join('')}</div>
    <div class="btn-row" style="margin-top:6px">
      <button class="btn ${meta.danger ? 'danger' : 'btn-primary'}" data-bulk-go="${esc(kind)}">
        ${esc(items.length)}건 ${esc(meta.label)}
      </button>
      <button class="btn" data-close>취소</button>
    </div>`);
}

/* 선택 바만 갈아 끼운다 — 체크할 때마다 목록 전체를 다시 그리면
   스크롤이 맨 위로 튀어 87건을 훑으며 고를 수가 없다 */
function refreshSelBar() {
  const scr = byId('screen-review');
  if (!scr) return;
  const cur = scr.querySelector('.selbar');
  const html = selBarHtml();
  if (cur && html) cur.outerHTML = html;
  else if (cur) cur.remove();
  else if (html) scr.insertAdjacentHTML('afterbegin', html);
}

/* 화면 아래 선택 바 — 몇 건 골랐는지와 할 수 있는 일을 항상 보이게 둔다 */
function selBarHtml() {
  if (!SEL.size) return '';
  return `
    <div class="selbar" role="region" aria-label="선택한 공고 처리">
      <span class="selbar-n">선택 ${SEL.size}건</span>
      <button class="btn btn-sm" data-sel="none">선택 해제</button>
      <span class="selbar-sp"></span>
      <button class="btn btn-sm btn-primary" data-sel="confirm">검수 완료로</button>
      <button class="btn btn-sm danger" data-sel="revert">되돌리기(재등록 차단)</button>
      <button class="btn btn-sm danger" data-sel="remove">등록 삭제</button>
    </div>`;
}

/* ---------------- ② 공고 전체 ---------------- */
const F = { status: 'all', school: 'all', nature: 'all', channel: 'all', badge: 'all', q: '', open: false };

/* 접어 둔 필터가 걸려 있는지 한눈에 — 안 그러면 "왜 몇 건밖에 안 보이지?"가 된다.
   태그를 누르면 그 필터만 풀린다. */
const FILTER_LABEL = { school: '소속', nature: '성격', channel: '접수', badge: '경고등' };
function activeFilterTags() {
  const on = Object.keys(FILTER_LABEL).filter((k) => F[k] !== 'all');
  if (!on.length) return '';
  return `<div class="ftags">${on.map((k) => {
    const v = k === 'channel' ? (CHANNEL_LABEL[F[k]] || F[k]) : F[k];
    return `<button class="ftag" data-clear="${k}">${esc(FILTER_LABEL[k])}: ${esc(v)} <span aria-hidden="true">×</span></button>`;
  }).join('')}<button class="ftag ftag-all" data-clear="*">모두 지우기</button></div>`;
}

function filteredList() {
  const fi = formIdSet();
  return D.reg.filter((it) => {
    if (F.status !== 'all' && statusOf(it) !== F.status) return false;
    if (F.school !== 'all' && schoolOf(it) !== F.school) return false;
    if (F.nature !== 'all' && !naturesOf(it).includes(F.nature)) return false;
    if (F.channel !== 'all' && channelOf(it) !== F.channel) return false;
    if (F.badge !== 'all' && !badgesOf(it, fi).includes(F.badge)) return false;
    if (F.q) {
      /* 널 가드 필수 — 예전엔 summary 없는 공고가 문자열 "undefined"로 검색됐다 */
      const hay = [it.name, it.provider, it.summary, it.id].filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(F.q.toLowerCase())) return false;
    }
    return true;
  });
}

function renderList() {
  const fi = formIdSet();
  const counts = (fn) => {
    const m = {};
    D.reg.forEach((it) => { [].concat(fn(it)).forEach((k) => { m[k] = (m[k] || 0) + 1; }); });
    return m;
  };
  const stC = counts(statusOf);
  const schoolC = counts(schoolOf);
  const natC = counts(naturesOf);
  const chC = counts(channelOf);
  const bgC = counts((it) => badgesOf(it, fi));

  const chip = (group, val, label, n) =>
    `<button class="chip ${group === 'status' ? `st-${val} ` : ''}${F[group] === val ? 'on' : ''}"
       data-f="${group}" data-v="${esc(val)}">${esc(label)}${n != null ? `<span class="c">${n}</span>` : ''}</button>`;

  const schoolOpts = Object.entries(schoolC).sort((a, b) => b[1] - a[1])
    .map(([s, n]) => `<option value="${esc(s)}"${F.school === s ? ' selected' : ''}>${esc(s)} (${n})</option>`).join('');

  const items = filteredList();

  byId('screen-list').innerHTML = `
    <div class="sec-head">
      <h2>공고 전체</h2>
      <p>학생 조건과 상관없이 등록된 ${D.reg.length}건을 모두 봅니다. 줄을 누르면 상세·수정이 열립니다.</p>
    </div>

    <div class="filters">
      <div class="filter-row">
        <span class="lb">상태</span>
        ${chip('status', 'all', '전체', D.reg.length)}
        ${chip('status', 'unreviewed', '검수 전', stC.unreviewed || 0)}
        ${chip('status', 'official', '정식 등록', stC.official || 0)}
        ${chip('status', 'closed', '마감·종료', stC.closed || 0)}
      </div>
      <div class="filter-row">
        <span class="lb">검색</span>
        <input type="search" id="f-q" placeholder="제목·재단·id로 찾기" value="${esc(F.q)}" />
        <span class="muted">${items.length}건</span>
      </div>
    </div>

    ${activeFilterTags()}

    <!-- 나머지 필터는 접어 둔다 — 5줄이 늘 펼쳐져 있으면 목록이 화면 밖으로 밀려난다 -->
    <details class="filters-more"${F.open ? ' open' : ''}>
      <summary>필터 더보기 — 소속 · 성격 · 접수 · 경고등</summary>
      <div class="filter-row">
        <span class="lb">소속</span>
        <select id="f-school">
          <option value="all"${F.school === 'all' ? ' selected' : ''}>학교 전체</option>
          ${schoolOpts}
        </select>
        <span class="lb">성격</span>
        <select id="f-nature">
          <option value="all">성격 전체</option>
          ${Object.entries(natC).sort((a, b) => b[1] - a[1])
    .map(([k, n]) => `<option value="${esc(k)}"${F.nature === k ? ' selected' : ''}>${esc(k)} (${n})</option>`).join('')}
        </select>
      </div>
      <div class="filter-row">
        <span class="lb">접수</span>
        ${chip('channel', 'all', '전체')}
        ${Object.keys(CHANNEL_LABEL).map((k) => chip('channel', k, CHANNEL_LABEL[k], chC[k] || 0)).join('')}
      </div>
      <div class="filter-row">
        <span class="lb">경고등</span>
        ${chip('badge', 'all', '전체')}
        ${Object.entries(bgC).map(([k, n]) => chip('badge', k, k, n)).join('')}
      </div>
    </details>

    ${items.length ? `<div class="rows">${items.map(rowHtml).join('')}</div>`
    : '<p class="empty">조건에 맞는 공고가 없습니다.</p>'}
  `;
}

/* 수집됐지만 아직 등록하지 않은 공고 — '앞으로 무엇이 남아 있나'를 보는 곳.
   등록 버튼은 아직 없다(2단계). 지금은 원문을 열어 눈으로 확인하는 데까지. */
function unregHtml() {
  const all = unregisteredNotices()
    .map((n) => ({ n, why: skipReason(n) }))
    .sort((a, b) => (b.n.foundAt || '').localeCompare(a.n.foundAt || ''));
  const cand = all.filter((x) => !x.why);
  const skipped = all.filter((x) => x.why);

  const row = (x) => {
    const u = safeUrl(x.n.url);
    return `<div class="row" data-noclick style="cursor:default${x.why ? ';opacity:.55' : ''}">
      <div>
        <div class="t">${esc(x.n.title)}</div>
        <div class="m">
          <span>${esc(x.n.school || '')}${x.n.campus ? ` ${esc(x.n.campus)}` : ''}</span>
          ${x.n.deadlineHint ? `<span>${esc(String(x.n.deadlineHint).slice(0, 40))}</span>` : ''}
          ${(x.n.attachments || []).length ? `<span>첨부 ${x.n.attachments.length}건</span>` : ''}
        </div>
        ${x.why ? `<div class="badges"><span class="pill">${esc(x.why)}</span></div>` : ''}
      </div>
      <div>${u ? `<a class="btn btn-sm" href="${esc(u)}" target="_blank" rel="noreferrer noopener">원문 ↗</a>` : ''}</div>
      <div><span class="dd none">${esc(x.n.foundAt || '')}</span></div>
    </div>`;
  };

  return `
    <div class="sec-head" style="margin-top:12px">
      <h2>수집됐지만 아직 등록 안 한 공고 ${cand.length}건</h2>
      <p>로봇이 게시판에서 가져왔지만 정식 등록에는 들어가지 않은 것들입니다.
         원문을 열어 보고 등록할 만한 것이 있으면 알려 주세요 — 등록 버튼은 다음 단계에 붙습니다.</p>
    </div>
    ${cand.length ? `<div class="rows">${cand.slice(0, shown('cand', 80)).map(row).join('')}</div>`
    : '<p class="empty">등록 후보가 없습니다.</p>'}
    ${moreBtn('cand', cand.length, 80)}

    ${skipped.length ? `<details style="margin-top:8px">
      <summary class="muted" style="cursor:pointer">등록 대상이 아닌 것 ${skipped.length}건 — 대출·대학원·파일명 등 (펼쳐 보기)</summary>
      <div class="rows" style="margin-top:8px">${skipped.slice(0, shown('skip', 60)).map(row).join('')}</div>
      ${moreBtn('skip', skipped.length, 60)}
      <p class="muted">규칙이 잘못 걸렀다고 보이면 알려 주세요 — 규칙은 <code class="mono">verify/entry-rules.cjs</code> 한 곳에 있습니다.</p>
    </details>` : ''}
  `;
}

/* ---------------- ③ 컨펌 작업대 ---------------- */
function renderReview() {
  const unrev = D.reg.filter((it) => statusOf(it) === 'unreviewed')
    .sort((a, b) => {
      const da = dday(a.deadline), db = dday(b.deadline);
      if (da == null && db == null) return 0;
      if (da == null) return 1;
      if (db == null) return -1;
      return da - db;
    });
  const dups = duplicatePairs();
  selKeepOnly(unrev.map((it) => it.id));   // 처리된 공고가 선택에 남아 있지 않게

  byId('screen-review').innerHTML = `
    ${selBarHtml()}
    <div class="sec-head">
      <h2>컨펌 작업대</h2>
      <p>왼쪽에 앱1에 나갈 내용, 오른쪽에 공고 원문을 나란히 놓고 확인합니다.
         마감이 급한 것부터 위에 옵니다.</p>
    </div>

    <div class="filters">
      <div class="filter-row">
        <span class="lb">선택</span>
        <button class="btn btn-sm" data-sel="all">전체 선택 (${unrev.length}건)</button>
        <button class="btn btn-sm" data-sel="urgent">마감 임박만 (${unrev.filter((it) => { const d = dday(it.deadline); return d != null && d >= 0 && d <= 7; }).length}건)</button>
        <button class="btn btn-sm" data-sel="clean">경고등 없는 것만 (${cleanIds().length}건)</button>
        <button class="btn btn-sm" data-sel="none">해제</button>
        <span class="muted">고른 뒤 화면 아래 바에서 한 번에 처리합니다</span>
      </div>
      <div class="filter-row">
        <span class="lb">자동등록</span>
        <button class="btn btn-sm ${D.autoCfg.enabled ? 'danger' : 'good'}" id="btn-auto-toggle">
          ${D.autoCfg.enabled ? '자동 등록 로봇 끄기' : '자동 등록 로봇 켜기'}
        </button>
        <span class="muted">현재 ${D.autoCfg.enabled ? '켜짐 — 로봇이 스스로 등록합니다' : '꺼짐 — 로봇은 리포트만 올립니다'}</span>
      </div>
    </div>

    ${unrev.length ? `<div class="rows">${unrev.map((it) => rowHtml(it, { pick: true, act: true })).join('')}</div>`
    : '<p class="empty">검수 전 공고가 없습니다. 모두 확인되었습니다.</p>'}

    ${unregHtml()}

    <div class="sec-head" style="margin-top:12px">
      <h2>중복 의심 ${dups.length}쌍</h2>
      <p>같은 장학금이 여러 학교 게시판에 올라온 경우입니다. 따로 두면 학생에게 같은 것이 여러 번 보입니다.</p>
    </div>
    ${dups.length ? `<div class="rows">${dups.map(([a, b]) => `
      <div class="row" data-noclick style="cursor:default">
        <div>
          <div class="t">${esc(a.name)}</div>
          <div class="m"><span>${esc(a.id)}</span><span>${esc(schoolOf(a))}</span></div>
          <div class="t" style="margin-top:6px">${esc(b.name)}</div>
          <div class="m"><span>${esc(b.id)}</span><span>${esc(schoolOf(b))}</span></div>
        </div>
        <div class="btn-row">
          <button class="btn btn-sm" data-merge="${esc(a.id)}|${esc(b.id)}">앞을 남기고 합치기</button>
          <button class="btn btn-sm" data-merge="${esc(b.id)}|${esc(a.id)}">뒤를 남기고 합치기</button>
        </div>
        <div></div>
      </div>`).join('')}</div>`
    : '<p class="empty">중복 의심 항목이 없습니다.</p>'}
  `;
}

/* ---------------- ④ 양식 ---------------- */
function renderForms() {
  const ids = Object.keys(D.forms).sort();
  const used = {};
  D.reg.forEach((it) => { if (it.formId) used[it.formId] = (used[it.formId] || 0) + 1; });
  const queue = pendingForms();               // '오늘 할 일'과 같은 함수 — 건수가 갈라지지 않는다
  const fetchWait = pendingFetchWait();       // 원본을 아직 못 받은 것
  const retired = pendingRetired();           // 6회 실패로 자동 재시도를 멈춘 것
  const orphan = ids.filter((id) => !used[id]);
  const broken = D.reg.filter((it) => it.formId && !D.forms[it.formId]);

  byId('screen-forms').innerHTML = `
    <div class="sec-head">
      <h2>양식 (신청서) ${ids.length}종</h2>
      <p>줄을 누르면 스키마와 <b>실제로 생성되는 문서</b>를 미리 볼 수 있습니다.
         미리 보고 컨펌해야 의미가 있습니다.</p>
    </div>

    ${broken.length ? `<p class="empty" style="border-color:var(--bad);color:var(--bad)">
      없는 양식을 가리키는 공고 ${broken.length}건: ${broken.map((b) => esc(b.id)).join(', ')}</p>` : ''}

    <div class="scroller">
      <table>
        <thead><tr><th>양식 id</th><th>제목</th><th>기관</th><th class="n">항목</th><th class="n">연결된 공고</th></tr></thead>
        <tbody>
          ${ids.map((id) => {
    const t = D.forms[id];
    const nf = (t.sections || []).reduce((s, sec) => s + ((sec.fields || []).length), 0);
    return `<tr data-form="${esc(id)}" style="cursor:pointer">
              <td class="mono">${esc(id)}</td>
              <td>${esc(t.title || '')}</td>
              <td>${esc(t.org || '')}</td>
              <td class="n">${nf}</td>
              <td class="n">${used[id] ? used[id] : '<span class="pill">미연결</span>'}</td>
            </tr>`;
  }).join('')}
        </tbody>
      </table>
    </div>

    <div class="sec-head" style="margin-top:12px">
      <h2>스키마화 대기 ${queue.length}건</h2>
      <p>원본 신청서는 확보됐고, 앱에서 작성할 수 있게 만드는 일이 남은 것들입니다.</p>
    </div>
    ${queue.length ? `<div class="scroller"><table>
        <thead><tr><th>공고</th><th>연결 id</th><th class="n">등록일</th></tr></thead>
        <tbody>${queue.map((q) => `<tr>
          <td>${esc(q.name || '')}</td>
          <td class="mono">${esc(q.id || '')}</td>
          <td class="n">${esc(q.added || '')}</td></tr>`).join('')}</tbody>
      </table></div>`
    : '<p class="empty">대기 중인 양식이 없습니다.</p>'}

    ${fetchWait.length ? `<details style="margin-top:8px">
      <summary class="muted" style="cursor:pointer">원본을 아직 못 받은 것 ${fetchWait.length}건 — 로봇이 다음 수집에서 다시 시도합니다 (펼쳐 보기)</summary>
      <div class="scroller" style="margin-top:8px"><table>
        <thead><tr><th>공고</th><th>연결 id</th><th class="n">등록일</th></tr></thead>
        <tbody>${fetchWait.map((q) => `<tr>
          <td>${esc(q.name || '')}</td><td class="mono">${esc(q.id || '')}</td>
          <td class="n">${esc(q.added || '')}</td></tr>`).join('')}</tbody>
      </table></div>
    </details>` : ''}

    ${retired.length ? `<details style="margin-top:8px">
      <summary class="muted" style="cursor:pointer">자동 재시도를 멈춘 것 ${retired.length}건 — 6회 실패해 표적에서 내렸습니다 (펼쳐 보기)</summary>
      <div class="scroller" style="margin-top:8px"><table>
        <thead><tr><th>공고</th><th>연결 id</th><th class="n">등록일</th></tr></thead>
        <tbody>${retired.map((q) => `<tr>
          <td>${esc(q.name || '')}</td><td class="mono">${esc(q.id || '')}</td>
          <td class="n">${esc(q.added || '')}</td></tr>`).join('')}</tbody>
      </table></div>
      <p class="muted">다시 받게 하려면 <code class="mono">collector/pending-forms.json</code>에서 그 항목의
        <code class="mono">retired</code>만 지우면 됩니다.</p>
    </details>` : ''}

    ${orphan.length ? `<p class="muted">아직 어떤 공고에도 연결되지 않은 양식 ${orphan.length}종:
      ${orphan.map((o) => `<code class="mono">${esc(o)}</code>`).join(' · ')}</p>` : ''}
  `;
}

/* ---------------- ⑤ 수집망 ---------------- */
function renderNetwork() {
  const fails = failingSchools();
  const noBoard = D.schools.filter((s) => !s.boardUrl);
  const withBoard = D.schools.filter((s) => s.boardUrl);
  /* 건강 기록은 '학교 캠퍼스'로도 '학교'로도 적혀 있다.
     예전엔 `hEntry()`가 없을 때 `{}`(참)를 돌려줘서 `|| hEntry(s.school)` 폴백이
     **한 번도 실행되지 않았고**, 캠퍼스가 '공통'인 학교 4곳이 언제나 '—/0'으로 보였다. */
  const hEntry = (school, campus) =>
    D.health[campus ? `${school} ${campus}` : school] ?? D.health[school] ?? {};

  byId('screen-network').innerHTML = `
    <div class="sec-head">
      <h2>수집망</h2>
      <p>학교 ${D.schools.length}곳 (일반 수집) · 브라우저형 ${D.targets.length}곳.
         어제부터 공고가 안 들어오는 학교를 여기서 발견합니다.</p>
    </div>

    <div class="filter-row">
      <button class="btn btn-sm" id="btn-run-collect">일반 수집 로봇 지금 실행</button>
      <button class="btn btn-sm" id="btn-run-browser">브라우저형 수집 로봇 지금 실행</button>
    </div>

    ${fails.length ? `
    <div class="sec-head"><h2>실패 중인 게시판 ${fails.length}곳</h2></div>
    <div class="scroller"><table>
      <thead><tr><th>학교</th><th class="n">연속 실패</th><th class="n">마지막 성공</th></tr></thead>
      <tbody>${fails.map((f) => `<tr>
        <td>${esc(f.school)}</td>
        <td class="n" style="color:var(--bad);font-weight:700">${f.fails}회</td>
        <td class="n">${esc(f.lastOk || '기록 없음')}</td></tr>`).join('')}</tbody>
    </table></div>` : '<p class="empty">모든 게시판이 정상입니다.</p>'}

    <div class="sec-head" style="margin-top:12px">
      <h2>게시판 주소가 없는 학교 ${noBoard.length}곳</h2>
      <p>주소를 넣으면 다음 수집부터 그 학교 학생에게 공고가 보이기 시작합니다.</p>
    </div>
    ${noBoard.length ? `<div class="scroller"><table>
      <thead><tr><th>학교</th><th>캠퍼스</th><th>장학공지 목록 주소</th><th></th></tr></thead>
      <tbody>${noBoard.map((s, i) => `<tr>
        <td>${esc(s.school)}</td>
        <td>${esc(s.campus || '')}</td>
        <td><input type="url" id="board-${i}" placeholder="https://…" style="width:100%" /></td>
        <td><button class="btn btn-sm" data-board="${i}"
             data-school="${esc(s.school)}" data-campus="${esc(s.campus || '')}">저장</button></td>
      </tr>`).join('')}</tbody></table></div>`
    : '<p class="empty">모든 학교에 주소가 들어 있습니다.</p>'}

    <div class="sec-head" style="margin-top:12px"><h2>연결된 게시판 ${withBoard.length}곳</h2></div>
    <div class="scroller"><table>
      <thead><tr><th>학교</th><th>캠퍼스</th><th class="n">마지막 성공</th><th class="n">실패</th></tr></thead>
      <tbody>${withBoard.map((s) => {
    const h = hEntry(s.school, s.campus);
    return `<tr>
          <td>${esc(s.school)}</td><td>${esc(s.campus || '')}</td>
          <td class="n">${esc(h.lastOk || '—')}</td>
          <td class="n">${h.fails ? `<span style="color:var(--bad)">${h.fails}</span>` : '0'}</td>
        </tr>`;
  }).join('')}</tbody>
    </table></div>

    <div class="sec-head" style="margin-top:12px"><h2>로봇 리포트 전문</h2></div>
    <div class="filter-row">
      <button class="btn btn-sm" data-report="collector/browser-report.md">브라우저 수집 리포트</button>
      <button class="btn btn-sm" data-report="collector/link-hunt-report.md">링크 사냥꾼 리포트</button>
      <button class="btn btn-sm" data-report="collector/resolve-report.md">원문 링크 복구 리포트</button>
    </div>
    <div id="report-box"></div>
  `;
}

/* ---------------- ⑥ 데이터 품질 ---------------- */
function renderQuality() {
  const fi = formIdSet();
  const withProb = D.reg.map((it) => ({ it, ps: problemsOf(it, fi) })).filter((x) => x.ps.length);
  const errors = withProb.filter((x) => x.ps.some((p) => p.level === 'error'));
  const warns = withProb.filter((x) => !x.ps.some((p) => p.level === 'error'));
  const dead = deadLinks();
  const noAmount = D.reg.filter((it) => !it.amountValue).length;
  const noDeadline = D.reg.filter((it) => !it.deadline).length;
  const noForm = D.reg.filter((it) => typeof hasFormAttachment === 'function'
    && hasFormAttachment(it) && !it.formId).length;

  const probRow = (x) => `
    <div class="row" data-id="${esc(x.it.id)}">
      <div>
        <div class="t">${esc(x.it.name)}</div>
        <div class="m"><span class="mono">${esc(x.it.id)}</span><span>${esc(schoolOf(x.it))}</span></div>
        <div class="badges">${x.ps.map((p) =>
    `<span class="pill ${p.level === 'error' ? 'bad' : ''}">${esc(p.msg)}</span>`).join('')}</div>
      </div>
      <div><span class="pill ${statusOf(x.it)}">${STATUS_LABEL[statusOf(x.it)]}</span></div>
      <div>${ddayHtml(x.it)}</div>
    </div>`;

  byId('screen-quality').innerHTML = `
    <div class="sec-head">
      <h2>데이터 품질</h2>
      <p>로봇이 매일 쓰는 등록 규칙을 이 화면에서 그대로 돌린 결과입니다. 줄을 누르면 바로 고칠 수 있습니다.</p>
    </div>

    <div class="cards">
      <div class="card ${errors.length ? 'is-bad' : 'is-ok'}"><div class="v">${errors.length}</div>
        <div class="k">규칙 위반 (오류)</div><div class="d">앱1에 잘못 나갈 수 있는 항목</div></div>
      <div class="card ${warns.length ? 'is-warn' : 'is-ok'}"><div class="v">${warns.length}</div>
        <div class="k">규칙 경고</div><div class="d">손봐야 하지만 치명적이지는 않음</div></div>
      <div class="card is-warn"><div class="v">${noAmount}</div>
        <div class="k">금액 미확인</div><div class="d">학생이 얼마인지 모르는 공고</div></div>
      <div class="card is-warn"><div class="v">${noDeadline}</div>
        <div class="k">마감일 없음</div><div class="d">언제까지인지 모르는 공고</div></div>
      <div class="card ${noForm ? 'is-warn' : 'is-ok'}"><div class="v">${noForm}</div>
        <div class="k">신청서 첨부는 있는데 양식 미등록</div><div class="d">앱에서 작성하게 만들 수 있는 후보</div></div>
      <div class="card ${dead.length ? 'is-warn' : 'is-ok'}"><div class="v">${dead.length}</div>
        <div class="k">원문 링크 실패 기록</div><div class="d">링크 사냥꾼이 못 연 주소</div></div>
    </div>

    ${errors.length ? `<div class="sec-head"><h2>오류 ${errors.length}건</h2></div>
      <div class="rows">${errors.map(probRow).join('')}</div>` : ''}
    ${warns.length ? `<div class="sec-head"><h2>경고 ${warns.length}건</h2></div>
      <div class="rows">${warns.map(probRow).join('')}</div>` : ''}
    ${!withProb.length ? '<p class="empty">규칙 위반이 없습니다.</p>' : ''}

    ${dead.length ? `
      <div class="sec-head" style="margin-top:12px"><h2>원문 링크 실패 ${dead.length}건</h2></div>
      <div class="scroller"><table>
        <thead><tr><th>공고</th><th>사유</th><th class="n">시도</th><th class="n">마지막 시도</th></tr></thead>
        <tbody>${dead.slice(0, shown('dead', 60)).map((d) => `<tr>
          <td>${esc(d.title || d.key.slice(0, 70))}</td>
          <td>${esc(d.lastWhy || '')}</td>
          <td class="n">${d.attempts || 0}</td>
          <td class="n">${esc(d.lastTried || '')}</td></tr>`).join('')}</tbody>
      </table></div>
      ${moreBtn('dead', dead.length, 60)}` : ''}

    <div class="sec-head" style="margin-top:12px">
      <h2>변경 이력</h2>
      <p>관리자 화면에서 이루어진 모든 변경입니다 — 누가, 언제, 무엇을.</p>
    </div>
    ${D.log.length ? `<div class="scroller"><table>
      <thead><tr><th class="n">시각 (KST)</th><th>사람</th><th>한 일</th><th>대상</th></tr></thead>
      <tbody>${D.log.slice(0, shown('log', 100)).map((l) => `<tr>
        <td class="n">${esc(l.at || '')}</td>
        <td>${esc(l.by || '')}</td>
        <td>${esc(l.action || '')}</td>
        <td>${esc(l.detail || '')}</td></tr>`).join('')}</tbody>
    </table></div>
    ${moreBtn('log', D.log.length, 100)}` : '<p class="empty">아직 변경 이력이 없습니다.</p>'}
  `;
}

/* ---------------- 상세·편집 시트 ---------------- */
function openSheet(html) {
  byId('sheet').innerHTML = html;
  byId('sheet').hidden = false;
  byId('sheet-back').hidden = false;
  document.body.style.overflow = 'hidden';
}
function closeSheet() {
  byId('sheet').hidden = true;
  byId('sheet-back').hidden = true;
  document.body.style.overflow = '';
}

const EDIT_FIELDS = [
  ['name', '공고 제목', 'text'],
  ['provider', '주관 기관', 'text'],
  ['type', '구분', 'select', ['교내', '교외']],
  ['amount', '금액 (원문 문구 그대로)', 'text'],
  ['amountValue', '금액 숫자 (확인 못 했으면 0)', 'text'],
  ['deadline', '마감일 (YYYY-MM-DD, 없으면 비움)', 'text'],
  ['period', '신청 기간 문구', 'text'],
  ['summary', '요약', 'textarea'],
  ['note', '안내 문구', 'textarea'],
  ['sourceUrl', '원문 공고 주소', 'text'],
  ['formId', '연결된 양식 id (없으면 비움)', 'text'],
  ['noForm', '양식이 없는 사유', 'textarea'],
  ['applyEmail', '이메일 접수 주소', 'text'],
];

function detailSheet(it) {
  const fi = formIdSet();
  const ps = problemsOf(it, fi);
  const st = statusOf(it);
  const url = safeUrl(it.sourceUrl);
  const e = it.eligibility || {};

  const field = ([k, label, type, opts]) => {
    const v = it[k] == null ? '' : it[k];
    if (type === 'select') {
      return `<div class="field"><label for="ed-${k}">${esc(label)}</label>
        <select id="ed-${k}" data-ed="${k}">${opts.map((o) =>
        `<option value="${esc(o)}"${v === o ? ' selected' : ''}>${esc(o)}</option>`).join('')}</select></div>`;
    }
    if (type === 'textarea') {
      return `<div class="field"><label for="ed-${k}">${esc(label)}</label>
        <textarea id="ed-${k}" data-ed="${k}" rows="3">${esc(v)}</textarea></div>`;
    }
    return `<div class="field"><label for="ed-${k}">${esc(label)}</label>
      <input type="text" id="ed-${k}" data-ed="${k}" value="${esc(v)}" /></div>`;
  };

  return `
    <div class="sheet-head">
      <h3>${esc(it.name)}</h3>
      <button class="sheet-close" data-close aria-label="닫기">×</button>
    </div>

    <div class="filter-row">
      <span class="pill ${st}">${STATUS_LABEL[st]}</span>
      ${ddayHtml(it)}
      <span class="pill info">${esc(CHANNEL_LABEL[channelOf(it)])}</span>
      <span class="mono muted">${esc(it.id)}</span>
    </div>

    ${ps.length ? `<div>${ps.map((p) =>
    `<div class="pill ${p.level === 'error' ? 'bad' : ''}" style="display:block;margin-bottom:4px">${esc(p.msg)}</div>`).join('')}</div>` : ''}

    <div class="compare">
      <div class="pane">
        <h4>앱1에 나가는 내용 (고칠 수 있습니다)</h4>
        <div class="pane-body">
          ${EDIT_FIELDS.map(field).join('')}
          <div class="field">
            <label>자격 (읽기 전용)</label>
            <dl class="kv">
              <dt>학교 한정</dt><dd>${esc(e.schoolOnly || '전국')}</dd>
              <dt>캠퍼스</dt><dd>${esc(e.campusOnly || '—')}</dd>
              <dt>학년</dt><dd>${esc((e.years || []).join(', ') || '—')}</dd>
              <dt>최저 성적</dt><dd>${esc(e.minGpa != null ? e.minGpa : '—')}</dd>
              <dt>소득 구간</dt><dd>${esc(e.maxBracket != null ? `${e.maxBracket}구간 이하` : '—')}</dd>
            </dl>
          </div>
        </div>
      </div>

      <div class="pane">
        <h4>공고 원문 — 지어내지 않고 그대로</h4>
        <div class="pane-body">
          ${url ? `<a class="btn btn-sm" href="${esc(url)}" target="_blank" rel="noreferrer noopener">원문 공고 열기 ↗</a>`
    : '<p class="muted">원문 주소가 없습니다.</p>'}
          ${(it.excerpts || []).length
    ? (it.excerpts || []).map((x) => `<div class="excerpt">${esc(x)}</div>`).join('')
    : '<p class="muted">확보된 원문 발췌가 없습니다. 없는 내용을 지어내지 말고 원문 링크로 확인하세요.</p>'}
          ${(it.attachments || []).length ? `<div class="field"><label>첨부</label>
            ${(it.attachments || []).map((a) => {
    const au = safeUrl(a.url);
    return au ? `<div><a href="${esc(au)}" target="_blank" rel="noreferrer noopener">${esc(a.name)} ↗</a></div>`
      : `<div>${esc(a.name)}</div>`;
  }).join('')}</div>` : ''}
          ${(it.documents || []).length ? `<div class="field"><label>요구 서류</label>
            <div class="muted">${(it.documents || []).map(esc).join(' · ')}</div></div>` : ''}
        </div>
      </div>
    </div>

    <div class="btn-row">
      <button class="btn btn-primary" data-act="save" data-id="${esc(it.id)}">수정 내용 저장</button>
      ${st === 'unreviewed'
    ? `<button class="btn good" data-act="confirm" data-id="${esc(it.id)}">검수 완료로 컨펌</button>
         <button class="btn danger" data-act="revert" data-id="${esc(it.id)}">잘못 등록됨 — 되돌리기</button>`
    : ''}
      <button class="btn danger" data-act="remove" data-id="${esc(it.id)}">등록 삭제</button>
    </div>
    <p class="muted">저장을 누르면 검사를 거쳐 반영됩니다. 검사를 통과하지 못하면 아무것도 바뀌지 않습니다.</p>
  `;
}

/* 아무것도 안 쓴 상태의 답변 묶음 — forms.js의 renderFormDoc은 항목마다 답변이
   있다고 가정하므로(체크·시간표는 객체), 빈 문서를 그리려면 이 모양을 맞춰 줘야 한다. */
function blankAnswers(tpl) {
  const ans = {};
  (tpl.sections || []).forEach((sec) => {
    (sec.fields || []).forEach((f) => {
      if (f.type === 'checks' || f.type === 'checks+text') ans[f.id] = { checks: [], text: '' };
      else if (f.type === 'schedule') ans[f.id] = { days: [], time: '' };
      else ans[f.id] = '';
    });
  });
  return ans;
}

/* 예시 인적사항 — 미리보기에만 쓰는 가짜 값 */
const SAMPLE_PROFILE = {
  name: '홍길동', school: '한국대학교', major: '○○학과',
  common: { studentId: '20241234', phone: '010-0000-0000', email: 'student@example.ac.kr' },
};

/* 이 양식으로 실제로 만들어지는 문서 — 앱1의 renderFormDoc을 그대로 쓴다 */
function previewDoc(id) {
  const tpl = D.forms[id];
  if (!tpl) throw new Error(`없는 양식: ${id}`);
  if (typeof renderFormDoc !== 'function') throw new Error('양식 엔진이 로드되지 않았습니다');
  return renderFormDoc(tpl, SAMPLE_PROFILE, blankAnswers(tpl), { editable: false });
}

function formSheet(id) {
  const tpl = D.forms[id];
  if (!tpl) return '<p class="empty">양식을 찾을 수 없습니다.</p>';
  let doc = '';
  try {
    doc = previewDoc(id);
  } catch (err) {
    doc = `<p style="color:#a8402a">미리보기를 그리지 못했습니다: ${esc(err.message)}</p>`;
  }
  const used = D.reg.filter((it) => it.formId === id);

  return `
    <div class="sheet-head">
      <h3>${esc(tpl.title || id)}</h3>
      <button class="sheet-close" data-close aria-label="닫기">×</button>
    </div>
    <div class="filter-row">
      <span class="mono muted">${esc(id)}</span>
      <span class="pill info">${esc(tpl.org || '')}</span>
      <span class="muted">연결된 공고 ${used.length}건</span>
    </div>

    <div class="sec-head"><h2>실제로 생성되는 문서</h2>
      <p>학생이 이 양식을 작성하면 아래 모양의 문서가 만들어집니다. (예시 인적사항으로 채운 미리보기)</p></div>
    <style>${typeof FORM_DOC_CSS === 'string' ? FORM_DOC_CSS : ''}</style>
    <div class="doc-preview">${doc}</div>

    <div class="sec-head"><h2>질문 항목</h2></div>
    <div class="scroller"><table>
      <thead><tr><th>구역</th><th>항목</th><th>질문</th><th>형식</th></tr></thead>
      <tbody>${(tpl.sections || []).map((sec) => (sec.fields || []).map((f) => `<tr>
        <td>${esc(sec.heading || '')}</td>
        <td>${esc(f.label || '')}</td>
        <td>${esc(f.q || '')}</td>
        <td class="mono">${esc(f.type || '')}</td></tr>`).join('')).join('')}</tbody>
    </table></div>

    ${used.length ? `<div class="sec-head"><h2>이 양식을 쓰는 공고</h2></div>
      <div class="rows">${used.map(rowHtml).join('')}</div>` : ''}
  `;
}

/* ---------------- 동작 연결 ---------------- */
function collectEdits() {
  const patch = {};
  $$('#sheet [data-ed]').forEach((el) => {
    const k = el.dataset.ed;
    let v = el.value;
    if (k === 'amountValue') v = Number(v) || 0;
    if (v === '' && k !== 'note' && k !== 'summary') v = null;
    patch[k] = v;
  });
  return patch;
}

function bindGlobal() {
  /* 탭 */
  byId('tabs').addEventListener('click', (e) => {
    const b = e.target.closest('.tab');
    if (b) show(b.dataset.tab);
  });

  /* 화면 안 위임 */
  byId('app').addEventListener('click', async (e) => {
    const go = e.target.closest('[data-go]');
    if (go) { show(go.dataset.go); return; }

    /* 체크박스는 상세를 열지 않는다 — 줄을 누르면 상세, 네모를 누르면 선택 */
    const pick = e.target.closest('[data-pick]');
    if (pick) {
      e.stopPropagation();
      if (pick.checked) SEL.add(pick.dataset.pick); else SEL.delete(pick.dataset.pick);
      refreshSelBar();          // 목록 전체를 다시 그리지 않는다(스크롤 위치가 날아간다)
      return;
    }

    const row = e.target.closest('.row[data-id]');
    if (row) {
      const it = D.reg.find((x) => x.id === row.dataset.id);
      if (it) openSheet(detailSheet(it));
      return;
    }

    const frow = e.target.closest('tr[data-form]');
    if (frow) { openSheet(formSheet(frow.dataset.form)); return; }

    const f = e.target.closest('[data-f]');
    if (f) { F[f.dataset.f] = f.dataset.v; renderList(); return; }

    const clr = e.target.closest('[data-clear]');
    if (clr) {
      const k = clr.dataset.clear;
      if (k === '*') Object.keys(FILTER_LABEL).forEach((x) => { F[x] = 'all'; });
      else F[k] = 'all';
      renderList();
      return;
    }

    const mg = e.target.closest('[data-merge]');
    if (mg) {
      const [keepId, dropId] = mg.dataset.merge.split('|');
      if (!confirm(`${dropId} 를 지우고 ${keepId} 하나로 합칩니다. 계속할까요?`)) return;
      await applyAction('merge', { keepId, dropId }, '중복 합치기');
      return;
    }

    const rp = e.target.closest('[data-report]');
    if (rp) {
      const path = rp.dataset.report;
      const box = byId('report-box');
      box.innerHTML = '<p class="muted">불러오는 중…</p>';
      if (!reportCache[path]) reportCache[path] = await readText(path);
      box.innerHTML = reportCache[path]
        ? `<div class="report">${esc(reportCache[path])}</div>`
        : '<p class="empty">리포트 파일이 아직 없습니다.</p>';
      return;
    }

    const bd = e.target.closest('[data-board]');
    if (bd) {
      const input = byId(`board-${bd.dataset.board}`);
      const u = safeUrl(input.value.trim());
      if (!u) { toast('http(s) 주소를 넣어 주세요'); return; }
      await applyAction('addBoard',
        { school: bd.dataset.school, campus: bd.dataset.campus, boardUrl: u },
        '게시판 주소 추가');
      return;
    }

    if (e.target.closest('#btn-run-collect')) {
      await runCollector(WF_COLLECT, '일반 수집 로봇'); return;
    }
    if (e.target.closest('#btn-run-browser')) {
      await runCollector(WF_BROWSER, '브라우저형 수집 로봇'); return;
    }
    if (e.target.closest('#btn-auto-toggle')) {
      const next = !D.autoCfg.enabled;
      if (!confirm(next ? '자동 등록 로봇을 켤까요?' : '자동 등록 로봇을 끌까요? 로봇은 리포트만 올리게 됩니다.')) return;
      await applyAction('autoRegister', { enabled: next }, next ? '자동 등록 켜기' : '자동 등록 끄기');
      return;
    }
    /* 행에서 바로 컨펌 — 문제 없는 공고까지 시트를 열었다 닫을 이유가 없다 */
    const qc = e.target.closest('[data-quick-confirm]');
    if (qc) {
      e.stopPropagation();
      await applyAction('confirm', { ids: [qc.dataset.quickConfirm] }, '컨펌');
      return;
    }

    /* 잘린 목록 더 보기 */
    const mr = e.target.closest('[data-more]');
    if (mr) {
      const k = mr.dataset.more;
      MORE[k] = shown(k, Number(mr.dataset.base) || STEP) + STEP;
      renderScreen(current);
      return;
    }

    /* 선택 묶음 만들기 */
    const sel = e.target.closest('[data-sel]');
    if (sel) {
      const k = sel.dataset.sel;
      const unrev = D.reg.filter((it) => statusOf(it) === 'unreviewed');
      if (k === 'none') selClear();
      else if (k === 'all') unrev.forEach((it) => SEL.add(it.id));
      else if (k === 'urgent') {
        unrev.forEach((it) => { const d = dday(it.deadline); if (d != null && d >= 0 && d <= 7) SEL.add(it.id); });
      } else if (k === 'clean') cleanIds().forEach((id) => SEL.add(id));
      else { await bulkAction(k); return; }
      renderReview();
      return;
    }
  });

  /* 필터 입력 */
  /* '필터 더보기'를 펼친 상태를 기억한다. 안 그러면 필터를 하나 고를 때마다
     다시 그려지면서 접혀 버려 연달아 고를 수가 없다.
     (toggle 이벤트는 버블링하지 않으므로 캡처 단계로 받는다) */
  byId('app').addEventListener('toggle', (e) => {
    if (e.target.classList && e.target.classList.contains('filters-more')) F.open = e.target.open;
  }, true);

  byId('app').addEventListener('change', (e) => {
    if (e.target.id === 'f-school') { F.school = e.target.value; renderList(); }
    if (e.target.id === 'f-nature') { F.nature = e.target.value; renderList(); }
  });
  let qTimer = null;
  byId('app').addEventListener('input', (e) => {
    if (e.target.id !== 'f-q') return;
    clearTimeout(qTimer);
    const v = e.target.value;
    qTimer = setTimeout(() => {
      F.q = v; renderList();
      const el = byId('f-q'); if (el) { el.focus(); el.setSelectionRange(v.length, v.length); }
    }, 250);
  });

  /* 시트 */
  byId('sheet').addEventListener('click', async (e) => {
    if (e.target.closest('[data-close]')) { closeSheet(); return; }

    /* 확인 화면에서 실제로 실행 — 여기까지 와야 데이터가 바뀐다 */
    const bg = e.target.closest('[data-bulk-go]');
    if (bg) {
      const kind = bg.dataset.bulkGo;
      const ids = [...SEL];
      closeSheet();
      selClear();
      await applyAction(kind, { ids }, `${BULK[kind].label} ${ids.length}건`);
      return;
    }

    const row = e.target.closest('.row[data-id]');
    if (row) {
      const it = D.reg.find((x) => x.id === row.dataset.id);
      if (it) openSheet(detailSheet(it));
      return;
    }

    const act = e.target.closest('[data-act]');
    if (!act) return;
    const id = act.dataset.id;
    const kind = act.dataset.act;

    if (kind === 'save') {
      const patch = collectEdits();
      closeSheet();
      await applyAction('edit', { id, patch }, '공고 수정');
    } else if (kind === 'confirm') {
      closeSheet();
      await applyAction('confirm', { ids: [id] }, '컨펌');
    } else if (kind === 'revert') {
      if (!confirm('이 공고를 등록에서 빼고, 로봇이 다시 등록하지 않도록 차단 목록에 넣습니다. 계속할까요?')) return;
      closeSheet();
      await applyAction('revert', { ids: [id] }, '되돌리기');
    } else if (kind === 'remove') {
      if (!confirm('이 공고를 등록에서 삭제합니다. 계속할까요?')) return;
      closeSheet();
      await applyAction('remove', { ids: [id] }, '등록 삭제');
    }
  });
  byId('sheet-back').addEventListener('click', closeSheet);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheet(); });

  /* 상단 */
  byId('btn-reload').addEventListener('click', async () => {
    toast('다시 읽는 중…');
    await loadAll(); renderAll(); toast('최신 상태로 갱신했어요');
  });
  byId('btn-logout').addEventListener('click', () => {
    clearStoredKey();
    location.reload();
  });
  byId('job-close').addEventListener('click', () => { byId('job').hidden = true; });
}

async function runCollector(file, label) {
  if (!confirm(`${label}을(를) 지금 실행할까요? 몇 분 걸립니다.`)) return;
  try {
    jobShow(`${label} 실행을 요청했어요`);
    await dispatchWorkflow(file, {});
    jobShow(`${label}을 실행했습니다. 끝나면 새로고침으로 결과를 확인하세요`, 'ok',
      `https://github.com/${OWNER}/${REPO}/actions/workflows/${file}`);
  } catch (err) {
    jobShow(err.message, 'bad');
  }
}

/* ---------------- 입장 ---------------- */
async function enter(key, remember) {
  const msg = byId('gate-msg');
  const btn = byId('gate-enter');
  btn.disabled = true;
  msg.hidden = false; msg.className = 'gate-msg ok'; msg.textContent = 'GitHub에 열쇠를 확인하는 중…';

  const v = await verifyKey(key);
  if (!v.ok) {
    msg.className = 'gate-msg'; msg.textContent = v.why;
    btn.disabled = false;
    return;
  }
  TOKEN = key;
  if (remember !== null) storeKey(key, remember);

  msg.textContent = '데이터를 읽는 중…';
  try {
    await loadAll();
  } catch (e) {
    msg.className = 'gate-msg'; msg.textContent = '데이터를 읽지 못했습니다. 잠시 후 다시 시도해 주세요.';
    btn.disabled = false;
    return;
  }
  /* 전부 실패했으면 안으로 들여보내지 않는다 — 텅 빈 화면이 '이상 없음'으로 보이는 것보다
     문 앞에서 사유를 말해 주는 편이 낫다. 일부만 실패한 경우는 들어가되 빨간 배너로 알린다. */
  if (!D.reg.length && D.failed.length) {
    msg.className = 'gate-msg';
    msg.textContent = `데이터를 읽지 못했습니다 (${D.failed[0].path} — ${D.failed[0].why}). 잠시 후 다시 시도해 주세요.`;
    btn.disabled = false;
    return;
  }

  byId('gate').hidden = true;
  byId('app').hidden = false;
  bindGlobal();
  renderAll();

  /* 읽어들인 데이터와 미리보기 함수를 한 곳에 노출한다 —
     검증 드라이버(verify/verify-admin.js)와 브라우저 콘솔에서 상태를 들여다볼 때 쓴다.
     열쇠를 통과한 뒤에만 만들어지므로 이것으로 잠금이 느슨해지지는 않는다. */
  window.__admin = { D, previewDoc, blankAnswers, statusOf, badgesOf, channelOf, naturesOf,
    renderDataFail, pendingForms };
}

function boot() {
  byId('gate-enter').addEventListener('click', () => {
    const k = byId('gate-key').value.trim();
    if (!k) { const m = byId('gate-msg'); m.hidden = false; m.className = 'gate-msg'; m.textContent = '열쇠를 넣어 주세요.'; return; }
    enter(k, byId('gate-remember').checked);
  });
  byId('gate-key').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') byId('gate-enter').click();
  });

  const stored = readStoredKey();
  if (stored) enter(stored, null);   // 이미 저장된 열쇠 — 저장 위치는 그대로 둔다
}

boot();

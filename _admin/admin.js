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
/* 저장된 공고 원문을 등록 공고와 잇는 규칙 — 🔴 베끼지 않는다.
   로봇·발췌기·감사가 같은 파일을 쓴다(collector/notice-source.mjs). */
import { indexTexts, sourceFor, hasText, isCut, looksLikeErrorPage } from './vendor/notice-source.mjs';
/* 학교 홈페이지 메뉴를 걷어내는 규칙 — '같은 학교의 여러 공고에 똑같이 나오는 줄 = 메뉴'.
   🔴 베끼지 않는다. 발췌기·본문 분량 판정이 쓰는 것과 같은 파일이다. */
import { makeStripper } from './vendor/page-boilerplate.mjs';
/* 관리자 수정 한 건이 '무엇을 바꾸는가' 를 정하는 규칙 — 🔴 베끼지 않는다.
   저장소(tools/admin-apply.mjs)가 실제로 넣는 값과 **같은 파일**로 계산해야
   '반영 전 전후 대조' 가 거짓말을 하지 않는다(화면은 '1,2' 를 보내고 저장소는 [1,2] 로 넣는다). */
import { diffPatch, showValue } from './vendor/edit-diff.mjs';

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

/* 🔴 **건수를 박아 쓰지 않는다** (2026-09-14). '전수 약 2,229원' 은 2026-08-23 에
   등록이 169건일 때 잰 값인데, 지금은 48건이고 그 버튼이 읽는 것은 7건뿐이다.
   화면이 지금 데이터에서 나오지 않은 숫자를 현재 값처럼 말하고 있었다
   (CLAUDE.md 「현황 숫자는 여기 적지 않는다 — 반드시 낡는다」).
   단가만 남기고 곱한다: 2,229원 / 169건 ≈ 건당 13원. */
const AI_WON_PER_ITEM = 13;
const aiCost = (n) => (n * AI_WON_PER_ITEM).toLocaleString('ko-KR');
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
  /* 인스타(2026-09-12) — 장부·판형·통계·댓글·토큰 지문·견본. 전부 파일이다(인스타에 직접 안 묻는다) */
  insta: { seen: { posted: [], prepared: [] }, templates: [], stats: { history: [], posts: [] }, comments: { items: [] }, token: null, samples: { templates: [] } },
  failed: [],   // 읽지 못한 파일 — 비어 있지 않으면 화면 숫자를 믿으면 안 된다
};

/* 로봇 리포트 원문 캐시 — loadAll()에서 비운다(로봇을 돌린 뒤 옛 리포트가 보이면 안 된다) */
let reportCache = {};

/* 🔴 밝게/어둡게는 **없앴다** (2026-09-13 개발자 지시 — 앱1과 같은 체계).
   앱1은 밝은 화면 한 벌뿐이고, 그건 우연이 아니라 지시다(style.css 2067 — "다크모드 규칙을
   넣지 말 것. 이 앱은 전체가 밝은 화면 한 벌뿐"). 관리자만 어두운 화면을 두니 실제로
   어긋남이 있었다 — `--shadow` 가 어두운 정의 두 벌 중 한 벌에만 있어, 밝은 OS 에서
   어둡게 바꾸면 어두운 바탕에 밝은 화면용 그림자가 남았다.
   ⚠️ 되살리려면 앱1과 **함께** 해야 한다. 여기만 되살리면 같은 어긋남이 돌아온다. */
/* 밀도 (B0-7) — 훑을 때와 검수할 때 필요한 밀도가 다르다 */
const DENSITY_KEY = 'handaejang.admin.density';
function currentDensity() {
  try { return localStorage.getItem(DENSITY_KEY) === 'compact' ? 'compact' : 'cozy'; } catch { return 'cozy'; }
}
function applyDensity(v) {
  document.documentElement.setAttribute('data-density', v);
  const b = byId('btn-density');
  if (b) { b.textContent = v === 'compact' ? '☰' : '≡'; b.title = `목록 밀도: ${v === 'compact' ? '촘촘하게' : '편안하게'} (눌러서 전환)`; }
}
function cycleDensity() {
  const next = currentDensity() === 'compact' ? 'cozy' : 'compact';
  try { localStorage.setItem(DENSITY_KEY, next); } catch { /* 저장 못 해도 이번 화면엔 적용된다 */ }
  applyDensity(next);
  toast(`목록 밀도: ${next === 'compact' ? '촘촘하게' : '편안하게'}`);
}

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

  /* 인스타 — stats·comments·token-seen·samples 는 **아직 없을 수 있는** 파일이라(계정 연결 전·견본 전)
     404 를 '못 읽음' 경고로 세지 않는다. seen·templates 는 저장소에 늘 있으니 실패하면 경고에 든다. */
  const quiet = async (path, fallback) => {
    try { const r = await fetch(raw(path), { cache: 'no-store' }); return r.ok ? await r.json() : fallback; }
    catch (e) { return fallback; }
  };
  const [igSeen, igTpl, igStats, igCmts, igTok, igSamples] = await Promise.all([
    readJson('insta/seen.json', { posted: [], prepared: [] }),
    readJson('insta/templates.json', { templates: [] }),
    quiet('insta/stats.json', { history: [], posts: [] }),
    quiet('insta/comments.json', { items: [] }),
    quiet('insta/token-seen.json', null),
    quiet('insta/samples/index.json', { templates: [] }),
  ]);
  D.insta = { seen: { posted: igSeen.posted || [], prepared: igSeen.prepared || [] }, templates: igTpl.templates || [],
    stats: igStats || { history: [], posts: [] }, comments: igCmts || { items: [] }, token: igTok, samples: igSamples || { templates: [] } };

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
/* 경고를 고칠 로봇을 **어떤 모양으로** 부르는가 — 원본은 verify/entry-rules.cjs 하나다.
   🔴 여기 베껴 두면 로봇 규칙과 갈라진다(값이 곧 돈이라 갈라지면 전수가 돈다). */
const FIX_PLAN = (window.ENTRY_RULES && window.ENTRY_RULES.FIX_PLAN) || {};

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
/* 🔴 화면 다섯 (2026-09-13 개발자 결정 — 8개에서 줄였다).
   · 데이터 품질 → **할 일** ('지금 뭐가 잘못됐나' 는 곧 '오늘 할 일' 이다)
   · 양식       → **목록** 의 보기 전환 (양식은 '어느 공고에 붙는가' 를 보는 것이다)
   · 수집망     → **로봇** (학교가 둘로 줄어 표 두 줄이 탭 하나를 차지하고 있었다)
   넷을 '같은 48건을 네 번 다르게 자른 화면' 으로 두던 것을 끝냈다.
   ⚠️ 화면을 지운 것이 아니라 **품은 것**이다 — 그 내용을 그리는 함수는 그대로 살아 있고
      renderQuality('todo-quality-slot') 처럼 그릴 자리만 받는다(베끼지 않는다). */
const SCREENS = ['todo', 'review', 'list', 'robots', 'insta'];
let current = 'todo';

function show(name) {
  /* 🔴 **모르는 화면 이름으로 오면 갇힌다** — 모든 화면을 숨기고 아무것도 안 그리게 된다.
     2026-09-13 에 화면을 다섯으로 줄이면서 `data-go="quality"` 같은 옛 버튼이 남아
     누르면 **빈 화면**이 됐다(오류도 안 난다 — 코드 리뷰가 잡았다).
     주소(`screenFromHash`)에는 방어선이 있었는데 버튼 경로에는 없었다. 여기서 막는다. */
  if (!SCREENS.includes(name)) name = SCREENS[0];
  current = name;
  SCREENS.forEach((n) => { byId(`screen-${n}`).hidden = n !== name; });
  $$('.tab').forEach((b) => {
    const on = b.dataset.tab === name;
    b.classList.toggle('active', on);
    b.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  window.scrollTo(0, 0);
  /* 주소에 화면 이름을 남긴다 — 새로고침해도 보던 화면으로 돌아오고,
     "로봇 탭 보세요"를 링크 하나로 전할 수 있다. pushState가 아니라 replaceState인 이유는
     탭을 옮길 때마다 뒤로가기 기록이 쌓이면 화면을 빠져나가기 어려워지기 때문이다. */
  if (location.hash.slice(1) !== name) {
    try { history.replaceState(null, '', `#${name}`); } catch { /* 파일로 열었을 때 */ }
  }
  renderScreen(name);
}

/* 주소의 #이름이 진짜 화면일 때만 받아들인다 (없는 이름이면 기본 화면) */
const screenFromHash = () => {
  const h = decodeURIComponent(location.hash.slice(1));
  return SCREENS.includes(h) ? h : null;
};

function renderScreen(name) {
  ({ todo: renderTodo, list: renderList, review: renderReview,
    robots: renderRobots, insta: renderInsta }[name] || (() => {}))();
  markScrollers(byId(`screen-${name}`));
}

/* 헤더 높이를 재서 CSS에 알려 준다 (B0-6).
   구획 제목이 화면 위에 붙을 때 **헤더 아래**에 멈춰야 하는데, 헤더 높이는
   글자 크기·화면 폭에 따라 달라져 CSS에 숫자로 박아 둘 수 없다. */
function measureHead() {
  const h = document.querySelector('.topbar');
  if (h) document.documentElement.style.setProperty('--head-h', `${h.offsetHeight}px`);
}

/* 옆으로 밀어야 나머지 칸이 보이는 표에만 안내를 붙인다 (B0-10).
   **실제로 넘칠 때만** 붙인다 — 안 넘치는데 "밀어 보세요"라고 하면 없는 칸을 찾게 된다. */
function markScrollers(root) {
  if (!root) return;
  root.querySelectorAll('.scroll-hint').forEach((el) => el.remove());
  root.querySelectorAll('.scroller').forEach((sc) => {
    if (sc.scrollWidth <= sc.clientWidth + 4) return;
    const p = document.createElement('p');
    p.className = 'scroll-hint';
    p.textContent = '↔ 표를 옆으로 밀면 나머지 칸이 보입니다';
    sc.insertAdjacentElement('afterend', p);
  });
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

/* ---------------- 다시 그릴 때 잃는 것 (B7) ----------------
   필터를 한 번 누를 때마다 화면 전체를 새로 만들어 **스크롤 위치·초점·입력 중이던 글자**가
   날아갔다. 166줄을 훑다가 칩 하나 눌렀는데 맨 위로 튀면 훑던 자리를 다시 찾아야 한다.
   예전엔 검색칸만 손으로 초점·커서를 되살리고 있었는데(그 자체가 증상이었다),
   여기서 한 번에 지킨다 — 새로 만드는 방식은 그대로 두고 '잃는 것'만 되돌린다. */
function rerender(name = current) {
  /* 🔴 **'필터 더보기'가 펼쳐져 있었는지는 살아 있는 DOM 에서 읽는다** (2026-09-13).
     아래 toggle 이벤트만으로 F.open 을 기억했더니, <details> 의 toggle 이 **비동기**라
     펼치자마자 필터를 고르면 change → rerender 가 그 이벤트를 앞질렀다. 그때 F.open 은
     아직 false 라 새로 그린 패널이 접혔고, 연달아 고를 수가 없었다.
     🔴 로컬에서는 거의 안 나고 **CI 에서만** 났다 — verify-admin 이 8회 연속 빨간불이었는데
        (runs 273~282 · 2026-09-12~13) 아무도 안 읽었다. 관문: verify-admin
        '펼치자마자 골라도 접히지 않는다' — 이 두 줄을 지우면 빨간불이다(확인함).
     ⚠️ 아래 toggle 리스너를 지우지 말 것 — 이 화면에 .filters-more 가 없을 때
        (다른 탭에서 돌아오는 길)의 값은 그쪽이 지킨다. */
  const moreEl = document.querySelector('.filters-more');
  if (moreEl) F.open = moreEl.open;

  const y = window.scrollY;
  const a = document.activeElement;
  const keep = a && a.id ? { id: a.id, start: a.selectionStart, end: a.selectionEnd } : null;

  renderScreen(name);

  window.scrollTo(0, y);
  if (keep) {
    const el = byId(keep.id);
    if (el) {
      el.focus({ preventScroll: true });
      if (keep.start != null && el.setSelectionRange) {
        try { el.setSelectionRange(keep.start, keep.end); } catch { /* 형식상 못 하는 칸도 있다 */ }
      }
    }
  }
}

function renderAll() {
  renderDataFail();
  pendingPrune();          // 데이터를 다시 읽었으면 사라진 공고의 수정을 먼저 뺀다
  renderPendingBar();
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

  /* 로봇 탭 배지는 열린 경보 수 — loadRobotIssues가 읽어 채운다.
     읽기 전에는 '—'로 둔다. 0으로 두면 **못 읽은 것이 '이상 없음'으로 보인다.** */
  const rb = byId('n-robots');
  if (rb && !rb.dataset.filled) { rb.textContent = '—'; rb.className = 'tab-n'; }
  set('n-insta', instaGroups().prepared.length + instaNewComments().length, true);   // 눌러야 할 것 = 게시 대기 + 답 안 한 댓글
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
      btn: '<button class="btn btn-sm" data-go="todo">아래에서 보기</button>' },
    { n: warns.length, tone: 'is-warn', k: '규칙 경고',
      d: '치명적이지는 않지만 손봐야 할 항목입니다',
      btn: '<button class="btn btn-sm" data-go="todo">아래에서 보기</button>' },
    { n: dead.length, tone: 'is-warn', k: '원문 링크 실패 기록',
      d: '학생이 원문 보기를 눌렀을 때 안 열리는 주소입니다',
      btn: '<button class="btn btn-sm" data-go="todo">아래에서 보기</button>' },
    { n: fails.length, tone: 'is-bad', k: '수집 실패 중인 학교',
      d: '이 학교 공고가 앱1에 들어오지 않고 있습니다',
      btn: '<button class="btn btn-sm" data-go="robots">수집망 보기</button>' },
    { n: queue.length, tone: 'is-warn', k: '양식 스키마화 대기',
      d: '원본은 확보됐고 앱에서 작성 가능하게 만드는 일이 남았습니다',
      btn: '<button class="btn btn-sm" data-go="list" data-go-view="forms">양식 보기</button>' },
    { n: noBoard.length, tone: 'is-warn', k: '게시판 주소 없는 학교',
      d: '주소를 넣으면 그 학교 학생에게 공고가 보이기 시작합니다',
      btn: '<button class="btn btn-sm" data-go="robots">주소 넣기</button>' },
    { n: D.deployAhead || 0, tone: 'is-warn', k: '앱1 반영 대기',
      d: '배포 로봇이 아직 올리지 않은 변경입니다', btn: '',
      okD: '학생 앱이 최신입니다', v: D.deployAhead == null ? '—' : D.deployAhead },
  ];
  const todo = all.filter((c) => c.n > 0);
  const clear = all.filter((c) => c.n === 0);

  /* 🔴 `<details>` 가 펼쳐져 있었는지는 **살아 있는 DOM 에서** 읽는다 — 이벤트로만 기억하면
     다시 그릴 때 접힌다(`.filters-more` 에서 이미 겪은 유형). innerHTML 을 덮기 전에 읽는다. */
  const scanWasOpen = !!(byId('todo-src-scan') && byId('todo-src-scan').open);

  byId('screen-todo').innerHTML = `
    <div class="sec-head" data-screen-title>
      <h2>오늘 할 일</h2>
      <p>눌러야 할 것만 모았습니다. 숫자를 구경하는 화면이 아닙니다.</p>
    </div>

    ${todo.length ? statCardsHtml(all) : '<p class="empty">지금 처리할 일이 없습니다. 모든 항목이 정상입니다.</p>'}

    ${urgent.length ? (() => {
    const cm = commonMeta(urgent);
    return `
      <div class="sec-head" style="margin-top:var(--space-8)">
        <h2>지금 처리할 것 — 마감 임박 + 검수 전</h2>
      </div>
      ${commonMetaHtml(cm)}
      <div class="rows" data-rows>${urgent.map((it) => rowHtml(it, { common: cm })).join('')}</div>`;
  })() : ''}

    <!-- 공고 원문을 열어 봐야 아는 것 — 펼칠 때만 800KB 원문을 받는다 -->
    <details id="todo-src-scan" data-src-scan${scanWasOpen ? ' open' : ''}>
      <summary>공고 원문을 열어 봐야 아는 것 — 자격 미확보 ${noEligItems().length}건 ·
        교외인데 한 학교에만 보이는 ${scopeWideItems().length}건</summary>
      <div id="src-scan-slot"><p class="muted">펼치면 저장된 공고 원문을 읽어 옵니다.</p></div>
    </details>

    <!-- 데이터 품질을 여기로 흡수한다 — '지금 뭐가 잘못됐나' 는 곧 '오늘 할 일' 이다.
         🔴 베끼지 않고 renderQuality 를 그대로 부른다(같은 숫자·같은 묶음). -->
    <div id="todo-quality-slot"></div>
  `;
  renderQuality('todo-quality-slot');
  const det = byId('todo-src-scan');
  if (det) {
    det.addEventListener('toggle', () => { if (det.open) openSrcScan(); });
    if (det.open) openSrcScan();
  }
}

/* ============================================================
   공고 원문을 열어 봐야 아는 것 (2026-09-14 · 개발자 컨펌 C2 + 「지금 바로 ④」)
   ------------------------------------------------------------
   🔴 **이 구획은 판정하지 않는다.** 원문에서 학교 이름이 몇 번 나오는지 **센 결과**와
      그 문장을 원문 그대로 인용할 뿐이고, '전국이다/아니다'는 사람이 정한다(운영 원칙 8-1).
   🔴 **날것 원문에서 세면 안 된다** — 학교 게시판 페이지는 메뉴·머리말에 학교 이름이 늘
      들어 있어 17건 중 16건이 걸린다(실측). 반드시 `SRC_STRIP`(메뉴 걷어내기) 뒤에 센다.
   ============================================================ */

/** 교외인데 한 학교에만 보이는 공고 */
function scopeWideItems() {
  return D.reg.filter((it) => it.type === '교외' && (it.eligibility || {}).schoolOnly);
}
/** 지원 자격을 아직 못 읽은 공고 — 판정 기준은 학생 앱과 같은 칸이다 */
function noEligItems() {
  return D.reg.filter((it) => !(it.eligibilityLines || []).length && !it.eligibilityVerified);
}

/** 이 학교의 별칭들 — 🔴 지어내지 않고 앱1의 `UNIV_ALIASES` 를 뒤집어 쓴다 */
function aliasesOf(school) {
  const map = (typeof UNIV_ALIASES !== 'undefined' && UNIV_ALIASES) || {};
  return Object.keys(map).filter((k) => map[k] === school);
}

/** 그 낱말이 나온 자리를 원문 그대로 앞뒤 40자 */
function quoteLine(body, word) {
  const i = body.indexOf(word);
  if (i < 0) return '';
  return body.slice(Math.max(0, i - 40), i + word.length + 40).replace(/\s+/g, ' ').trim();
}

/** 메뉴를 걷어낸 본문에서 학교 이름이 몇 번 나오는가.
 *  🔴 긴 낱말부터 지워 가며 센다 — '경희대' 를 '경희' 로 두 번 세지 않는다. */
function scopeCount(it) {
  if (SRC_STATE === 'failed') return { state: 'failed' };
  const src = storedSource(it);
  if (!src) return { state: 'nosrc' };
  const body = SRC_STRIP ? SRC_STRIP(src.url || '', src.text) : src.text;
  const school = (it.eligibility || {}).schoolOnly || '';
  const words = [school, ...aliasesOf(school)].filter(Boolean).sort((a, b) => b.length - a.length);
  const hits = [];
  let rest = body;
  for (const w of words) {
    const n = rest.split(w).length - 1;
    if (n) { hits.push({ w, n, short: w.length <= 2 }); rest = rest.split(w).join('\u0000'); }
  }
  return {
    state: hits.length ? 'hit' : 'zero',
    chars: body.replace(/\s/g, '').length,
    hits,
    line: hits.length ? quoteLine(body, hits[0].w) : '',
  };
}

/** 지금 화면에서 모아 둔 수정까지 반영한 모습 — 상세에서 고친 값 위에 겹쳐 읽는다 */
function stagedOf(id) {
  const rawItem = D.reg.find((x) => x.id === id) || {};
  return { ...rawItem, ...(PENDING_EDITS.get(id) || {}) };
}

/** 고른 공고를 '전국'으로 — 학교·캠퍼스 한정만 빼고 **나머지 자격은 그대로 둔다**.
 *  🔴 `PENDING_EDITS.set` 이 아니라 **덮어쓰기 병합**이다 — 상세에서 마감일을 고쳐 둔 것이
 *     여기서 통째로 날아가면 안 된다. */
function goNationwide(ids) {
  ids.forEach((id) => {
    const cur = stagedOf(id).eligibility || {};
    const keep = { ...cur };
    delete keep.schoolOnly; delete keep.campusOnly;
    PENDING_EDITS.set(id, { ...(PENDING_EDITS.get(id) || {}), eligibility: keep });
  });
  renderPendingBar();
  toast(`${ids.length}건을 모아 뒀습니다 — '한꺼번에 반영' 을 누르면 저장됩니다`);
}

async function openSrcScan() {
  const slot = byId('src-scan-slot');
  if (!slot) return;
  slot.innerHTML = '<p class="muted">저장된 공고 원문을 읽는 중…</p>';
  await ensureSources();
  renderSrcScan();
}

function renderSrcScan() {
  const slot = byId('src-scan-slot');
  if (!slot) return;
  /* 🔴 못 받아 왔으면 **실패를 실패라고 적는다** — 빈 목록으로 두면 '전부 0회' 로 보인다 */
  if (SRC_STATE !== 'ready') {
    slot.innerHTML = `<p class="empty" data-src-fail>저장된 공고 원문을 읽지 못했습니다 —
      셀 수 없습니다. <button class="btn btn-sm" data-src-rescan>다시 읽기</button></p>`;
    return;
  }

  /* ── ① 자격 미확보를 '원문이 있는가'로 가른다 ────────────────────────
     🔴 AI 자격 읽기 로봇은 원문이 없는 공고를 **조용히** 건너뛴다
        (collector/eligibility-ai.mjs 의 `.filter((t) => t.lines.length)`).
        화면이 9건이라고 말하고 로봇이 7건만 읽으면 다음 사람이 없는 버그를 쫓는다. */
  const elig = noEligItems();
  const have = elig.filter((it) => storedSource(it));
  const none = elig.filter((it) => !storedSource(it));
  const eligHtml = `
    <div class="sec-head"><h2>지원 자격을 아직 못 읽은 ${elig.length}건</h2>
      <p>원문이 저장된 ${have.length}건만 AI 자격 읽기가 읽습니다 ·
         원문이 없는 ${none.length}건은 먼저 「공고 본문 재수집」이 필요합니다.</p></div>
    <div class="pgroup" data-pgroup data-elig-split>
      <div class="pgroup-head">
        <span class="pill">원문 있음 ${have.length}건</span>
        <span class="pgroup-msg">AI 자격 읽기가 읽을 수 있습니다</span>
        <button class="btn btn-sm btn-primary" data-fixrun="eligibility-fill.yml" data-fixplan="main"
          data-fixn="${have.length}">시범 3건만 읽기 — AI 자격 읽기 · 약 50원</button>
        <button class="btn btn-sm" data-fixrun="eligibility-fill.yml" data-fixplan="all"
          data-fixn="${have.length}">전부 읽기 — AI 자격 읽기 · ${have.length}건 약 ${aiCost(have.length)}원</button>
      </div>
      ${none.length ? `
      <div class="pgroup-head">
        <span class="pill warn">원문 없음 ${none.length}건</span>
        <span class="pgroup-msg">먼저 본문을 받아 와야 합니다</span>
        <button class="btn btn-sm" data-run="rescue-bodies.yml" data-run-name="공고 본문 재수집">
          공고 본문 재수집 — 지금 실행</button>
      </div>
      <div class="rows" data-rows>${none.slice(0, 20).map((it) => rowHtml(it)).join('')}</div>` : ''}
    </div>`;

  /* ── ② 교외인데 한 학교에만 보이는 공고 ─────────────────────────── */
  const wide = scopeWideItems();
  const counted = wide.map((it) => ({ it, c: scopeCount(it) }));
  const zero = counted.filter((x) => x.c.state === 'zero').length;
  const nosrc = counted.filter((x) => x.c.state === 'nosrc').length;

  const countLine = (c, school) => {
    if (c.state === 'nosrc') return '저장된 원문이 없습니다 — 셀 수 없습니다';
    if (c.state === 'failed') return '원문을 읽지 못했습니다 — 셀 수 없습니다';
    if (c.state === 'zero') {
      return `메뉴·머리말을 걷어낸 본문 ${c.chars}자에서 「${school}」 계열 낱말을 한 번도 찾지 못했습니다`;
    }
    return `메뉴·머리말을 걷어낸 본문 ${c.chars}자에서 ${c.hits.map((h) => `「${h.w}」 ${h.n}회${
      h.short ? ' (짧은 줄임말 — 다른 낱말과 겹칠 수 있습니다)' : ''}`).join(' · ')}`;
  };

  const wideRow = ({ it, c }) => {
    const school = (it.eligibility || {}).schoolOnly || '';
    return `
    <div class="row" data-row data-noclick data-scope-row style="cursor:default">
      <div>
        <div class="t" data-row-title>${esc(it.name || it.id)}</div>
        <div class="m"><span class="mono">${esc(it.id)}</span><span>${esc(school)}</span></div>
        <div class="scope-count" data-scope-count>${esc(countLine(c, school))}</div>
        ${c.line ? `<div class="excerpt">${esc(c.line)}</div>` : ''}
        ${c.state === 'nosrc' ? `<div class="btn-row">
          <button class="btn btn-sm" data-run="rescue-bodies.yml" data-run-name="공고 본문 재수집">
            공고 본문 재수집 — 지금 실행</button>
          <button class="btn btn-sm" data-run="link-hunter.yml" data-run-name="링크 사냥꾼">
            링크 사냥꾼 — 지금 실행</button></div>` : ''}
      </div>
      <div><label class="pickbox"><input type="checkbox" data-scope-pick="${esc(it.id)}" />
        <span>고르기</span></label></div>
      <div></div>
    </div>`;
  };

  slot.innerHTML = `
    ${eligHtml}
    <div class="sec-head" style="margin-top:var(--space-12)">
      <h2>교외인데 한 학교에만 보이는 공고 ${wide.length}건</h2>
      <p data-scope-note><b>센 결과만 적었습니다. 전국인지 아닌지는 원문을 읽고 사람이 정합니다.</b>
        한 번도 안 나온 것 ${zero}건 · 원문이 없어 못 센 것 ${nosrc}건.</p>
    </div>
    <div class="pgroup" data-scope-wide>
      <div class="rows" data-rows>${counted.map(wideRow).join('')}</div>
      <div class="btn-row" style="margin-top:var(--space-8)">
        <button class="btn btn-sm btn-primary" data-scope-go>고른 것을 전국으로 (모아 두기)</button>
      </div>
    </div>`;
}

/* ---------------- 저장된 공고 원문 (2026-09-13) ----------------
   🔴 **집에 있는 원문을 두고 새 탭으로 학교 게시판을 다시 찾아가고 있었다.**
   실측: 검수 대기 14건 중 10건은 화면에 보여 줄 발췌가 없는데, 그 10건 **전부** 공고
   원문이 이미 저장소에 있다(`collector/extracted/notices-text.json` 86건·546KB +
   `browser-bodies.json` 273KB). 등록 48건으로 넓히면 42건이 원문을 갖고 있다.

   ⚠️ 두 파일이 합쳐 800KB 라 **화면을 열 때마다 받지 않는다** — 상세를 처음 열 때 한 번만
      받아 두고 그 뒤로는 그대로 쓴다.
   🔴 **못 받아 왔을 때 '비어 있음'으로 두지 말 것** — 화면이 '아직 오는 중' 으로 읽어
      기다림 표시가 영영 굳는다(앱1이 실제로 겪은 일). 실패는 실패라고 적는다. */
let SRC_IDX = null;          // indexTexts 결과 (byUrl · byTitle)
let SRC_STRIP = null;        // 메뉴를 걷어내는 함수
let SRC_STATE = 'idle';      // idle · loading · ready · failed
/* 🔴 받아 오는 중일 때 **그 약속을 돌려준다.** 예전에는 'loading' 이라는 글자만 돌려줘서,
   받아 오는 동안 다른 공고를 열면(= '다음 공고 ▸') 그 시트가 영영 '읽는 중' 에 멈췄다
   — 두 번째 호출은 기다리지 않고 끝나고, 첫 호출의 뒷정리는 '지금 보는 공고가 다르다' 며
   그리지 않기 때문이다(코드 리뷰가 잡았다). 약속을 같이 기다리면 둘 다 제대로 그려진다. */
let SRC_PROMISE = null;

async function ensureSources() {
  if (SRC_STATE === 'ready') return SRC_STATE;
  if (SRC_PROMISE) return SRC_PROMISE;
  SRC_STATE = 'loading';
  SRC_PROMISE = (async () => {
  try {
    const [texts, bodies] = await Promise.all([
      readJson('collector/extracted/notices-text.json', null),
      readJson('collector/extracted/browser-bodies.json', {}),
    ]);
    if (!texts) throw new Error('원문 파일을 받지 못했습니다');
    SRC_IDX = indexTexts(texts, bodies || {});
    SRC_STRIP = makeStripper(texts);
    SRC_STATE = 'ready';
  } catch (e) {
    SRC_IDX = null;
    SRC_STATE = 'failed';
  }
  SRC_PROMISE = null;
  return SRC_STATE;
  })();
  return SRC_PROMISE;
}

/** 이 공고의 저장된 원문. 없거나 못 읽었으면 null.
 *  🔴 오류·점검 화면은 원문이 아니다 — notice-source 의 판정을 그대로 쓴다
 *     (서울대 점검 날 '장애 조치 안내' 16건이 공고 원문으로 저장된 적이 있다). */
function storedSource(it) {
  if (SRC_STATE !== 'ready' || !SRC_IDX) return null;
  const src = sourceFor(it, SRC_IDX);
  if (!hasText(src)) return null;
  if (looksLikeErrorPage(src.text)) return null;
  return src;
}

/* ---------------- 모아 두는 수정 (2026-09-13) ----------------
   🔴 **왜 모으는가** — 저장은 GitHub 작업을 깨워 그것이 끝날 때까지 기다린다
   (`applyAction` → `waitForRun`, 최대 6분). 게다가 `jobBusy` 가 화면 전체를 잠근다.
   그래서 검수하며 마감·금액을 채우면 **공고 수만큼 차례로 기다려야** 했다 —
   실측으로 한 번이 21초이고 큐·폴링까지 건당 30~60초라, 13건이면 순수 대기만 7~13분이다.
   이제 저장 버튼은 장부에 적기만 하고, '한꺼번에 반영'이 한 번에 보낸다(저장소 쪽
   `admin-apply.mjs` 의 edit 가 `payload.edits` 배열을 받는다).
   ⚠️ 장부는 **기기에 남기지 않는다** — 새로고침하면 사라지는 게 맞다. 남겨 두면
      '반영한 줄 알았는데 안 된' 상태가 조용히 이어진다. */
const PENDING_EDITS = new Map();   // id → patch (같은 공고를 또 고치면 덮어쓴다)

function pendingCount() { return PENDING_EDITS.size; }
function pendingClear() { PENDING_EDITS.clear(); }

/** 모아 둔 수정이 몇 건인지 화면에 알린다. 0건이면 줄 자체를 감춘다. */
function renderPendingBar() {
  const bar = byId('pending-bar');
  if (!bar) return;
  const n = pendingCount();
  bar.hidden = n === 0;
  if (n) byId('pending-text').textContent = `수정 ${n}건을 모아 뒀습니다 — 아직 저장되지 않았습니다`;
  /* 줄이 나타나고 사라지면 머리 높이가 달라진다 — 구획 제목이 머리 아래에 멈추게 다시 잰다 */
  measureHead();
}

/** 모아 둔 수정을 한 번에 보낸다. 보낼 게 없으면 아무 일도 하지 않는다. */
/** 지금 없는 공고의 수정은 장부에서 뺀다.
 *  🔴 저장소 쪽(`admin-apply.mjs`)은 모르는 id 를 만나면 **묶음 전체를 멈춘다**(그게 맞다 —
 *  반만 반영되면 안 된다). 그래서 되돌리기·삭제·새로고침으로 사라진 공고의 수정이 장부에
 *  남아 있으면 **멀쩡한 다른 수정까지 하나도 안 나간다**(코드 리뷰가 잡았다). */
function pendingPrune() {
  const live = new Set(D.reg.map((x) => x.id));
  let dropped = 0;
  [...PENDING_EDITS.keys()].forEach((id) => { if (!live.has(id)) { PENDING_EDITS.delete(id); dropped += 1; } });
  return dropped;
}

/** 지금 모아 둔 수정이 **실제로** 무엇을 바꾸는가.
 *  🔴 `diffPatch` 로 센다 — 화면이 보낸 날것(`years:'1,2'`)과 저장소가 넣는 값(`[1,2]`)이
 *     다르므로 키 개수를 세면 '안 바뀐 칸' 이 바뀜으로 뜬다.
 *  🔴 없어진 공고의 수정은 **보여 주기 전에** 뺀다 — 보여 준 뒤 빼면 숫자가 어긋난다. */
function flushPlan() {
  const dropped = pendingPrune();
  const rows = [];
  for (const [id, patch] of PENDING_EDITS) {
    const it = D.reg.find((x) => x.id === id);
    if (!it) continue;                         // pendingPrune 이 이미 뺐다 (방어)
    rows.push({ id, name: it.name || id, diff: diffPatch(it, patch) });
  }
  return { dropped, rows };
}

/** 모아 둔 수정을 보내기 **전에** 무엇이 바뀌는지 보여 주고 묻는다. */
async function flushEdits() {
  const { dropped, rows } = flushPlan();
  if (dropped) toast(`없어진 공고 ${dropped}건의 수정은 뺐습니다`);
  if (!rows.length) { toast('모아 둔 수정이 없습니다'); return false; }

  /* 바뀌는 칸이 하나도 없는 건은 안 보낸다 — 저장소도 어차피 건너뛰지만,
     전부 그런 경우 저장소가 '바뀐 내용이 없습니다' 로 실패해 한 번 헛왕복한다. */
  const live = rows.filter((r) => r.diff.length);
  if (!live.length) { toast('바뀌는 내용이 없습니다'); return false; }
  const blocked = live.filter((r) => r.diff.some((d) => d.block));
  const fields = live.reduce((a, r) => a + r.diff.length, 0);

  askSheet({
    title: `공고 ${live.length}건 · 칸 ${fields}개를 바꿉니다`,
    note: blocked.length
      ? `${blocked.length}건은 저장 때 막히는 값이 있어 지금은 보낼 수 없습니다. 빨간 줄을 고쳐 주세요.`
      : '아래가 실제로 바뀌는 전부입니다. 여기 없는 칸은 그대로 둡니다.',
    lines: live.map((r) => ({ t: r.name, m: r.id, diff: r.diff })),
    goLabel: `${live.length}건 반영`,
    blocked: blocked.length > 0,
    run: () => flushSend(live.map((r) => ({ id: r.id, patch: PENDING_EDITS.get(r.id) }))),
  });
  return true;
}

/** 실제로 보낸다 — 성공하면 장부를 비운다. */
async function flushSend(edits) {
  const okDone = await applyAction('edit', { edits }, `공고 수정 ${edits.length}건`);
  if (okDone) pendingClear();
  renderPendingBar();
  return okDone;
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
/** 이 목록의 **모든 줄이 같은 값**인 칸을 찾는다.
 *  🔴 실측: 「컨펌 작업대」 14줄이 전부 '검수 전' 이었고, 거의 전부 '금액 미확인' 이었으며,
 *  10줄이 '마감일 없음' 을 배지와 오른쪽 칸에 **두 번** 달고 있었다. 학교도 거의 전부 같았다.
 *  줄마다 다른 것은 제목뿐인데 같은 말이 줄 수만큼 반복돼 정작 제목이 묻혔다.
 *  전부 같은 값은 줄에서 빼고 **머리줄에 한 번** 적는다. */
function commonMeta(items) {
  const out = {};
  if (items.length < 3) return out;              // 몇 줄 안 되면 묶는 이득이 없다
  const same = (get) => {
    const first = get(items[0]);
    return items.every((x) => get(x) === first) ? first : null;
  };
  const st = same((x) => statusOf(x));
  if (st) out.status = STATUS_LABEL[st];
  const sc = same((x) => schoolOf(x));
  if (sc) out.school = sc;
  const ch = same((x) => channelOf(x));
  if (ch) out.channel = CHANNEL_LABEL[ch];
  return out;
}

/** 머리줄에 '이 목록은 전부 …' 라고 한 번 적는다 */
function commonMetaHtml(common) {
  const parts = [];
  if (common.status) parts.push(common.status);
  if (common.school) parts.push(common.school);
  if (common.channel) parts.push(common.channel);
  return parts.length
    ? `<p class="muted">이 목록은 전부 <b>${parts.map(esc).join(' · ')}</b> 입니다 — 줄마다 되풀이하지 않습니다.</p>`
    : '';
}

function rowHtml(it, opt = {}) {
  const cm = opt.common || {};
  const fi = formIdSet();
  const st = statusOf(it);
  const badges = badgesOf(it, fi);
  const pick = opt.pick
    ? `<label class="pick" title="선택"><input type="checkbox" data-pick="${esc(it.id)}"${SEL.has(it.id) ? ' checked' : ''} /></label>`
    : '';
  /* 키보드로도 열려야 한다 — 예전엔 **마우스로만** 상세를 열 수 있었다.
     읽어 주기에도 '버튼'으로 잡히도록 role을 준다. */
  return `
    <div class="row${opt.pick ? ' has-pick' : ''}" data-row data-id="${esc(it.id)}"
         tabindex="0" role="button" aria-label="${esc(it.name)} 상세 열기">
      ${pick}
      <div>
        <div class="t" data-row-title>${esc(it.name)}</div>
        <div class="m">
          ${cm.school ? '' : `<span>${esc(schoolOf(it))}</span>`}
          <span>${esc(it.provider || '')}</span>
          ${cm.channel ? '' : `<span>${esc(CHANNEL_LABEL[channelOf(it)])}</span>`}
        </div>
        ${(() => {
    /* 🔴 **같은 말을 한 줄에 두 번 하지 않는다** — '마감일 없음' 은 바로 오른쪽 칸(ddayHtml)이
       이미 말한다. 배지로 또 달면 한 줄에서 같은 사실이 두 번 읽힌다(실측으로 10줄이 그랬다). */
    const shownB = badges.filter((b) => b !== '마감일 없음');
    return shownB.length
      ? `<div class="badges">${shownB.map((b) => `<span class="pill ${badgeTone(b)}">${esc(b)}</span>`).join('')}</div>`
      : '';
  })()}
      </div>
      <div>${cm.status ? '' : `<span class="pill ${st}">${STATUS_LABEL[st]}</span>`}</div>
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
    <div class="rows" data-rows>${items.map((it) => rowHtml(it)).join('')}</div>
    <div class="btn-row sheet-foot">
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

/* ---------------- 확인 시트 (B5) ----------------
   `window.confirm`은 ⓐ 무엇을 처리하는지 못 보여 주고 ⓑ 브라우저마다 생김새가 달라
   중요한 경고가 '그냥 눌러 넘기는 창'으로 읽힌다. 되돌릴 수 없는 동작은
   **무엇에 대해 하는 일인지 눈으로 보여 준 뒤** 확인받는다.
   실행할 일은 여기 담아 두고, 확인 버튼이 눌리면 그때 꺼내 돌린다. */
let pendingGo = null;

/** 한 줄이 '무엇을 무엇으로' 바꾸는지 — 전후를 나란히 (2026-09-14).
 *  🔴 `esc()` 를 반드시 거친다 — 수집한 공고 제목에 `<`·`&` 가 들어 있다. */
function diffRowsHtml(diff) {
  if (!diff || !diff.length) return '';
  return `<div class="diffs">${diff.map((d) => `
    <div class="diffrow${d.block ? ' is-bad' : ''}" data-diff-row data-diff-key="${esc(d.key)}">
      <span class="diff-k">${esc(d.label)}</span>
      <span class="diff-a">${esc(showValue(d.before))}</span>
      <span class="diff-arrow" aria-hidden="true">→</span>
      <span class="diff-b">${esc(showValue(d.after))}</span>
      ${d.block ? `<span class="pill bad">${esc(d.block)}</span>` : ''}
    </div>`).join('')}</div>`;
}

/* `lines[].diff` 를 주면 그 줄 밑에 전후 표가 붙는다. `blocked` 면 실행 버튼이 잠긴다.
   ⚠️ 되돌릴 수 없는 6종(merge·autoRegister·formQueue·unlinkForm·revert·remove)의 문구는
      그대로다 — 이 변경은 줄에 칸 하나를 **더하는 것**이지 기존 모양을 바꾸는 게 아니다. */
function askSheet({ title, note, lines = [], goLabel, danger = false, blocked = false, run }) {
  pendingGo = blocked ? null : run;
  openSheet(`
    <div class="sheet-head">
      <h3>${esc(title)}</h3>
      <button class="sheet-close" data-close aria-label="닫기">×</button>
    </div>
    ${note ? `<p class="muted">${esc(note)}</p>` : ''}
    ${lines.length ? `<div class="rows" data-rows>${lines.map((l) => `
      <div class="row" data-row data-noclick style="cursor:default">
        <div><div class="t" data-row-title>${esc(l.t)}</div>
          ${l.m ? `<div class="m"><span>${esc(l.m)}</span></div>` : ''}
          ${diffRowsHtml(l.diff)}</div>
        <div></div><div></div>
      </div>`).join('')}</div>` : ''}
    <div class="btn-row sheet-foot">
      <button class="btn ${danger ? 'danger' : 'btn-primary'}" data-ask-go
        ${blocked ? 'disabled aria-disabled="true"' : ''}>${esc(goLabel)}</button>
      <button class="btn" data-close>취소</button>
    </div>`);
}

/* 화면 아래 선택 바 — 몇 건 골랐는지와 할 수 있는 일을 항상 보이게 둔다 */
function selBarHtml() {
  if (!SEL.size) return '';
  return `
    <div class="selbar" data-selbar role="region" aria-label="선택한 공고 처리">
      <span class="selbar-n" data-selbar-n>선택 ${SEL.size}건</span>
      <button class="btn btn-sm" data-sel="none">선택 해제</button>
      <span class="selbar-sp"></span>
      <button class="btn btn-sm btn-primary" data-sel="confirm">검수 완료로</button>
      <button class="btn btn-sm danger" data-sel="revert">되돌리기(재등록 차단)</button>
      <button class="btn btn-sm danger" data-sel="remove">등록 삭제</button>
    </div>`;
}

/* ---------------- ② 공고 전체 ---------------- */
const F = { status: 'all', school: 'all', nature: 'all', channel: 'all', badge: 'all', q: '', open: false,
  sort: 'deadline', dir: 'asc' };

/* ---------------- 정렬 (B2) ----------------
   예전엔 **어디에도 사용자 정렬이 없었다.** 166건이 늘 같은 순서로만 나왔다.
   마감 없는 공고는 어느 방향으로 정렬하든 **항상 뒤로** 보낸다 —
   '기한 미확인'이 맨 위를 차지하면 급한 것이 안 보인다. */
/* 「공고 전체」의 보기 — 공고 목록 / 양식 목록 (2026-09-13).
   양식은 결국 '어느 공고에 붙는가' 를 보는 것이라 같은 화면에 있는 것이 맞다. */
let LIST_VIEW = 'notices';

const SORTS = {
  deadline: { label: '마감 임박순', get: (it) => it.deadline || '' },
  listed: { label: '등록 최신순', get: (it) => it.listedAt || it.deadline || '', dir: 'desc' },
  school: { label: '학교순', get: (it) => schoolOf(it) },
  name: { label: '제목순', get: (it) => it.name || '' },
};

function sortItems(items) {
  const s = SORTS[F.sort] || SORTS.deadline;
  const sign = F.dir === 'desc' ? -1 : 1;
  /* 🔴 **마감이 지난 것은 '임박'이 아니다** (2026-09-13).
     예전에는 기본 화면(마감 임박순)의 첫 구획이 「마감 지남 28건」이었다 —
     48건 중 28건이 이미 끝난 공고인데 그게 맨 위를 차지하고, 정작 봐야 할 검수 전 14건은
     한참 스크롤해야 나왔다. 끝난 것은 '값이 없는 것' 과 같이 **뒤로** 보낸다.
     ⚠️ 숨기지는 않는다 — 필터로 '마감·종료' 를 고르면 그대로 보인다. 자리만 옮긴다. */
  const past = (it) => { const d = dday(it.deadline); return d != null && d < 0; };
  return items.slice().sort((a, b) => {
    if (F.sort === 'deadline') {
      const pa = past(a), pb = past(b);
      if (pa !== pb) return pa ? 1 : -1;
    }
    const va = s.get(a), vb = s.get(b);
    if (!va && !vb) return 0;
    if (!va) return 1;          // 값이 없는 것은 방향과 무관하게 뒤로
    if (!vb) return -1;
    return va < vb ? -sign : va > vb ? sign : 0;
  });
}

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

  const items = sortItems(filteredList());

  /* 보기 전환 — 공고 / 양식. 🔴 양식 화면을 베끼지 않고 renderForms 를 그대로 부른다. */
  const viewTabs = `
    <div class="filter-row" style="margin-bottom:var(--space-8)">
      <span class="lb">보기</span>
      <button class="chip ${LIST_VIEW === 'notices' ? 'on' : ''}" data-lview="notices">공고<span class="c">${D.reg.length}</span></button>
      <button class="chip ${LIST_VIEW === 'forms' ? 'on' : ''}" data-lview="forms">양식<span class="c">${Object.keys(D.forms).length}</span></button>
    </div>`;

  if (LIST_VIEW === 'forms') {
    byId('screen-list').innerHTML = `
      <div class="sec-head">
        <h2>양식 (신청서) ${Object.keys(D.forms).length}종</h2>
        <p>줄을 누르면 스키마와 <b>실제로 생성되는 문서</b>를 미리 볼 수 있습니다.</p>
      </div>
      ${viewTabs}
      <div id="list-forms-slot"></div>`;
    renderForms('list-forms-slot');
    markScrollers(byId('screen-list'));
    return;
  }

  byId('screen-list').innerHTML = `
    <div class="sec-head" data-screen-title>
      <h2>공고 전체</h2>
      <p>학생 조건과 상관없이 등록된 ${D.reg.length}건을 모두 봅니다. 줄을 누르면 상세·수정이 열립니다.</p>
    </div>
    ${viewTabs}

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
      <div class="filter-row">
        <span class="lb">정렬</span>
        ${Object.entries(SORTS).map(([k, v]) =>
    `<button class="chip ${F.sort === k ? 'on' : ''}" data-sort="${esc(k)}">${esc(v.label)}${
      F.sort === k ? `<span class="c">${F.dir === 'asc' ? '↑' : '↓'}</span>` : ''}</button>`).join('')}
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

    ${items.length ? groupedRows(items)
    : '<p class="empty">조건에 맞는 공고가 없습니다.</p>'}
  `;
}

/* ---------------- 스캔 지점 (B0-6) ----------------
   166줄이 똑같은 높이·색으로 이어지면 눈이 멈출 자리가 없어 '어디까지 봤는지'를 잃는다.
   마감 임박순으로 볼 때만 기한 구획으로 나눈다 — 다른 정렬에서는 구획이 뜻을 잃는다. */
/* 🔴 순서가 곧 화면의 첫인상이다. '마감 지남' 은 **맨 아래**다 —
   위 sortItems 가 끝난 공고를 뒤로 보내므로 구획도 그 순서로 나온다.
   ⚠️ test 는 위에서부터 처음 맞는 것을 쓰므로 좁은 것이 먼저 와야 한다(오늘·내일 → 이번 주 → …).
      'over' 를 아래로 내리면서 다른 칸의 `d != null && d <= n` 이 음수도 잡게 되므로
      **'지나지 않았다'(d >= 0)를 함께 본다.** 안 그러면 마감 지난 것이 '오늘·내일' 로 들어간다. */
const BUCKETS = [
  { k: 'now', label: '오늘·내일', test: (d) => d != null && d >= 0 && d <= 1 },
  { k: 'week', label: '이번 주 (7일 이내)', test: (d) => d != null && d >= 0 && d <= 7 },
  { k: 'month', label: '이번 달 (30일 이내)', test: (d) => d != null && d >= 0 && d <= 30 },
  { k: 'later', label: '그 뒤', test: (d) => d != null && d >= 0 },
  { k: 'over', label: '마감 지남', test: (d) => d != null && d < 0 },
  { k: 'none', label: '기한 미확인', test: () => true },
];

function groupedRows(items) {
  const cm = commonMeta(items);
  const row = (it) => rowHtml(it, { common: cm });
  if (F.sort !== 'deadline') return `${commonMetaHtml(cm)}<div class="rows" data-rows>${items.map(row).join('')}</div>`;
  const groups = new Map();
  items.forEach((it) => {
    const d = dday(it.deadline);
    const b = BUCKETS.find((x) => x.test(d));
    if (!groups.has(b.k)) groups.set(b.k, { label: b.label, list: [] });
    groups.get(b.k).list.push(it);
  });
  return commonMetaHtml(cm) + [...groups.values()].map((g) => `
    <div class="group" data-group>
      <h3 class="group-head" data-group-head>${esc(g.label)} <span class="group-n" data-group-n>${g.list.length}</span></h3>
      <div class="rows" data-rows>${g.list.map(row).join('')}</div>
    </div>`).join('');
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
      <div class="btn-row">
        ${u ? `<a class="btn btn-sm" href="${esc(u)}" target="_blank" rel="noreferrer noopener">원문 ↗</a>` : ''}
        ${x.why ? '' : `<button class="btn btn-sm btn-primary" data-reg-open="${esc(x.n.url)}">등록하기</button>`}
      </div>
      <div><span class="dd none">${esc(x.n.foundAt || '')}</span></div>
    </div>`;
  };

  return `
    <div class="sec-head" style="margin-top:12px">
      <h2>수집됐지만 아직 등록 안 한 공고 ${cand.length}건</h2>
      <p>로봇이 게시판에서 가져왔지만 정식 등록에는 들어가지 않은 것들입니다.
         <b>원문 ↗</b>으로 확인한 뒤 <b>등록하기</b>를 누르면 학생 앱에 카드로 나갑니다.</p>
    </div>
    ${cand.length ? `<div class="rows" data-rows>${cand.slice(0, shown('cand', 80)).map(row).join('')}</div>`
    : '<p class="empty">등록 후보가 없습니다.</p>'}
    ${moreBtn('cand', cand.length, 80)}

    ${skipped.length ? `<details style="margin-top:8px">
      <summary class="muted" style="cursor:pointer">등록 대상이 아닌 것 ${skipped.length}건 — 대출·대학원·파일명 등 (펼쳐 보기)</summary>
      <div class="rows" data-rows style="margin-top:8px">${skipped.slice(0, shown('skip', 60)).map(row).join('')}</div>
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
    <div class="sec-head" data-screen-title>
      <h2>컨펌 작업대</h2>
      <p>줄을 누르면 <b>왼쪽에 앱1에 나갈 내용, 오른쪽에 저장해 둔 공고 원문</b>을 나란히 놓고 확인합니다.
         마감이 급한 것부터 위에 옵니다.</p>
    </div>

    <div class="filters">
      <div class="filter-row">
        <span class="lb">선택</span>
        <button class="btn btn-sm" data-sel="all">전체 선택 (${unrev.length}건)</button>
        <button class="btn btn-sm" data-sel="urgent">마감 임박만 (${unrev.filter((it) => { const d = dday(it.deadline); return d != null && d >= 0 && d <= 7; }).length}건)</button>
        <button class="btn btn-sm" data-sel="clean">경고등 없는 것만 (${cleanIds().length}건)</button>
        <button class="btn btn-sm" data-sel="none">해제</button>
        <span class="muted">고른 뒤 <b>화면 아래에 뜨는 바</b>에서 한 번에 처리합니다</span>
      </div>
      <div class="filter-row">
        <span class="lb">자동등록</span>
        <button class="btn btn-sm ${D.autoCfg.enabled ? 'danger' : 'good'}" data-auto-toggle>
          ${D.autoCfg.enabled ? '자동 등록 로봇 끄기' : '자동 등록 로봇 켜기'}
        </button>
        <span class="muted">현재 ${D.autoCfg.enabled ? '켜짐 — 로봇이 스스로 등록합니다' : '꺼짐 — 로봇은 리포트만 올립니다'}</span>
      </div>
    </div>

    ${unrev.length ? (() => {
    const cm = commonMeta(unrev);
    return `${commonMetaHtml(cm)}
      <div class="rows" data-rows>${unrev.map((it) => rowHtml(it, { pick: true, act: true, common: cm })).join('')}</div>`;
  })()
    : '<p class="empty">검수 전 공고가 없습니다. 모두 확인되었습니다.</p>'}

    ${unregHtml()}

    <div class="sec-head" style="margin-top:12px">
      <h2>중복 의심 ${dups.length}쌍</h2>
      <p>같은 장학금이 여러 학교 게시판에 올라온 경우입니다. 따로 두면 학생에게 같은 것이 여러 번 보입니다.</p>
    </div>
    ${dups.length ? `<div class="rows" data-rows>${dups.map(([a, b]) => `
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
/* 🔴 target 을 받는 이유: 「공고 전체」의 '양식' 보기가 **같은 함수**를 불러 그린다.
   조각을 떼어 내려다 중첩 템플릿에서 잘못 잘린 적이 있어(만들면서 겪었다),
   함수를 나누지 않고 **그릴 자리만** 받는다. 베끼는 것보다 안전하다. */
function renderForms(target) {
  const ids = Object.keys(D.forms).sort();
  const used = {};
  D.reg.forEach((it) => { if (it.formId) used[it.formId] = (used[it.formId] || 0) + 1; });
  const queue = pendingForms();               // '오늘 할 일'과 같은 함수 — 건수가 갈라지지 않는다
  const fetchWait = pendingFetchWait();       // 원본을 아직 못 받은 것
  const retired = pendingRetired();           // 6회 실패로 자동 재시도를 멈춘 것
  const orphan = ids.filter((id) => !used[id]);
  const broken = D.reg.filter((it) => it.formId && !D.forms[it.formId]);

  byId(target).innerHTML = `
    <div class="sec-head">
      <h2>양식 (신청서) ${ids.length}종</h2>
      <p>줄을 누르면 스키마와 <b>실제로 생성되는 문서</b>를 미리 볼 수 있습니다.
         미리 보고 컨펌해야 의미가 있습니다.</p>
    </div>

    ${broken.length ? `<div class="empty" style="border-color:var(--red);color:var(--red);text-align:left">
      <p><b>없는 양식을 가리키는 공고 ${broken.length}건</b> — 학생이 '앱에서 작성'을 눌러도 아무것도 안 뜹니다.</p>
      <p class="mono" style="margin:6px 0">${broken.map((b) => `${esc(b.id)} → ${esc(b.formId)}`).join(' · ')}</p>
      <button class="btn btn-sm danger" data-unlink="${esc(broken.map((b) => b.id).join(','))}">연결 끊기</button>
    </div>` : ''}

    <div class="scroller">
      <table>
        <thead><tr><th>양식</th><th>기관</th><th class="n">항목</th><th class="n">공고</th>
          <th>원본과 비교</th></tr></thead>
        <tbody>
          ${ids.map((id) => {
    const t = D.forms[id];
    const nf = (t.sections || []).reduce((s, sec) => s + ((sec.fields || []).length), 0);
    /* 원본 대조는 **원본이 한 번에 열려야** 할 수 있는 일이다. 예전엔 이 표에 링크가 하나도
       없어서, 첨부 원본을 보려면 공고 화면으로 건너가 id로 다시 찾아야 했다. */
    const owner = D.reg.find((it) => it.formId === id);
    const atts = (owner && owner.attachments) || [];
    return `<tr data-form="${esc(id)}" style="cursor:pointer" tabindex="0" role="button" aria-label="${esc(t.title || id)} 미리 보기">
              <td>${esc(t.title || id)}
                ${/^auto-/.test(id) ? '<span class="pill warn">로봇 생성</span>' : ''}
                <div class="m mono">${esc(id)}</div></td>
              <td>${esc(t.org || '')}</td>
              <td class="n">${nf}</td>
              <td class="n">${used[id] ? used[id] : '<span class="pill">미연결</span>'}</td>
              <td class="btn-row">
                <button class="btn btn-sm" data-form-preview="${esc(id)}">미리보기</button>
                ${owner && safeUrl(owner.sourceUrl)
    ? `<a class="btn btn-sm" href="${esc(safeUrl(owner.sourceUrl))}" target="_blank" rel="noreferrer noopener">원문 ↗</a>` : ''}
                ${atts.filter((a) => safeUrl(a.url)).slice(0, 2).map((a, i) => `<a class="btn btn-sm"
                    href="${esc(safeUrl(a.url))}" target="_blank" rel="noreferrer noopener"
                    title="${esc(a.name || '')}">첨부${atts.length > 1 ? i + 1 : ''} ↗</a>`).join('')}
              </td>
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
        <thead><tr><th>공고</th><th>연결 id</th><th class="n">등록일</th><th></th></tr></thead>
        <tbody>${queue.map((q) => `<tr>
          <td>${esc(q.name || '')}</td>
          <td class="mono">${esc(q.id || '')}</td>
          <td class="n">${esc(q.added || '')}</td>
          <td><button class="btn btn-sm" data-fq="retire" data-fq-id="${esc(q.id)}"
                title="자동 재시도를 멈춥니다">그만 시도</button></td></tr>`).join('')}</tbody>
      </table></div>
      <p class="muted">스키마 자체는 화면에서 만들지 않습니다 — 원본과 <b>같은 구조</b>여야 해서
        원본을 눈으로 보고 옮겨야 합니다(운영 원칙 4). 여기서는 큐만 정리합니다.</p>`
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
        <thead><tr><th>공고</th><th>연결 id</th><th class="n">등록일</th><th></th></tr></thead>
        <tbody>${retired.map((q) => `<tr>
          <td>${esc(q.name || '')}</td><td class="mono">${esc(q.id || '')}</td>
          <td class="n">${esc(q.added || '')}</td>
          <td><button class="btn btn-sm" data-fq="retry" data-fq-id="${esc(q.id)}"
                title="다음 수집 때 다시 받아 봅니다">다시 받기</button></td></tr>`).join('')}</tbody>
      </table></div>
    </details>` : ''}

    ${orphan.length ? `<p class="muted">아직 어떤 공고에도 연결되지 않은 양식 ${orphan.length}종:
      ${orphan.map((o) => `<code class="mono">${esc(o)}</code>`).join(' · ')}</p>` : ''}
  `;
}

/* ---------------- ⑤ 수집망 ---------------- */
/* 수집망 내용 — 🔴 **베끼지 않는다.** 로봇 화면이 이 조각을 그대로 가져다 쓴다.
   학교가 경희대·한국외대 둘로 줄어 표 두 줄이 탭 하나를 차지하고 있었다(실측). */
/* 🔴 리포트 전문 블록은 여기 두지 않는다 — 로봇 화면이 이미 갖고 있어서 id="report-box" 가
   **둘**이 되고, byId 는 첫 번째만 집는다. 그러면 누른 버튼 아래 상자는 빈 채로 두고
   저 위 상자에 글이 뜬다(코드 리뷰가 잡았다).
   ⚠️ 설명을 템플릿 문자열 **안**에 두지 말 것 — 주석 속 백틱이 그 문자열을 닫아 버려
      모듈이 통째로 죽는다(방금 그렇게 만들었다가 잡았다). */
function networkSectionHtml() {
  const fails = failingSchools();
  const noBoard = D.schools.filter((s) => !s.boardUrl);
  const withBoard = D.schools.filter((s) => s.boardUrl);
  /* 건강 기록은 '학교 캠퍼스'로도 '학교'로도 적혀 있다.
     예전엔 `hEntry()`가 없을 때 `{}`(참)를 돌려줘서 `|| hEntry(s.school)` 폴백이
     **한 번도 실행되지 않았고**, 캠퍼스가 '공통'인 학교 4곳이 언제나 '—/0'으로 보였다. */
  const hEntry = (school, campus) =>
    D.health[campus ? `${school} ${campus}` : school] ?? D.health[school] ?? {};

  return `
    ${fails.length ? `
    <div class="sec-head"><h2>실패 중인 게시판 ${fails.length}곳</h2></div>
    <div class="scroller"><table>
      <thead><tr><th>학교</th><th class="n">연속 실패</th><th class="n">마지막 성공</th></tr></thead>
      <tbody>${fails.map((f) => `<tr>
        <td>${esc(f.school)}</td>
        <td class="n" style="color:var(--red);font-weight:700">${f.fails}회</td>
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
          <td class="n">${h.fails ? `<span style="color:var(--red)">${h.fails}</span>` : '0'}</td>
        </tr>`;
  }).join('')}</tbody>
    </table></div>

  `;
}


/* ---------------- ⑥ 로봇 통제판 (E단계, 2026-08-09) ----------------
   왜 만들었나: 로봇이 13종인데 화면에서 돌릴 수 있는 건 3종뿐이었고, 로봇이 뭐라고
   말하는지(리포트 이슈)는 화면에 아예 없었다. 그래서 로봇이 멈춰도 이 화면은 조용했다.
   같은 날 실제로 겪은 일: 건강 기록의 고아 키를 보고 **멀쩡한 학교 4곳을 '멈췄다'고
   오진**했다. 화면이 진짜 신호(열린 경보·마지막 실행)를 보여 줬으면 바로 알았을 것이다. */

/* 🔴 **로봇 목록은 화면이 부를 수 있는 전부다.** 여기 없으면 그 로봇은 화면에서 존재하지 않는다.
   관문(test-collector '관리자 화면 로봇 목록')이 `.github/workflows/` 와 대조해
   ⓐ 여기 적힌 파일이 실재하고 수동 실행을 받는지 ⓑ 입력 이름·선택지가 yml 과 같은지
   ⓒ **화면이 못 부르는 워크플로가 몇 개인지**를 센다(새 로봇이 생기면 넣으라고 말해 준다).

   입력 칸(`inputs`)의 뜻 — 🔴 옛 이름 `input`(객체 하나)에서 **배열로 바뀌었다.**
     kind:'url'    http(s) 주소만 받는다      kind:'num'    숫자만 받는다
     kind:'choice' yml 의 options 를 그대로   kind:'text'   자유 입력
     def           화면에 미리 골라 두는 값
   🔴 **`def` 는 가장 싼 쪽·가장 안전한 쪽으로 둔다.** yml 의 기본값을 그대로 베끼면
      `eligibility-fill` 이 '전부'(전수 약 2,229원)로 **선택된 채** 뜬다.
   🔴 설명에 건수를 박아 쓰지 않는다 — '게시판 37곳' 이라고 적혀 있었는데 실제는 2곳이었다.
      숫자가 필요하면 함수로 적어 **셀 때 센다**(현황 숫자를 사본으로 두지 않는다). */
const ROBOTS = [
  { f: 'collect-scholarships.yml', n: '일반 수집 로봇', d: () => `게시판 ${D.schools.length}곳을 훑어 새 공고를 담습니다`, when: '매일 07:41·11:41' },
  { f: 'browser-collect.yml', n: '브라우저형 수집 로봇', d: () => `봇차단·동적 게시판 ${D.targets.length}곳을 진짜 브라우저로 봅니다`, when: '매일 08:07·12:07' },
  { f: 'link-hunter.yml', n: '링크 사냥꾼', d: '원문 주소를 못 찾은 공고를 계속 다시 찾습니다', when: '매일 06:37' },
  { f: 'resolve-detail-urls.yml', n: '원문 링크 복구', d: '목록 주소로 남은 공고를 게시판에서 찾아 고칩니다', when: '주 1회' },
  /* 🔴 **지금 보는 공고가 아니라 `form_targets` 에 적힌 공고**의 첨부를 받아 온다.
     값을 안 보내면 워크플로 기본값('조병두')이 이겨 엉뚱한 공고를 받아 온다(실측). */
  {
    f: 'deep-fetch.yml',
    n: '심층 수집',
    d: '공고 본문 전문과 첨부 원본을 받아 옵니다',
    when: '수동',
    inputs: [{ name: 'form_targets', kind: 'text', label: '첨부 원본까지 받을 공고 (쉼표로 여러 개 · 제목 일부)', ph: '조병두' }],
  },
  {
    f: 'rescue-bodies.yml',
    n: '공고 본문 재수집',
    d: '원문을 못 받은 공고의 본문을 진짜 브라우저로 다시 받습니다',
    when: '매일 05:23',
    inputs: [{ name: 'cap', kind: 'num', label: '이번에 최대 몇 건', def: '25', min: 1, max: 200 }],
  },
  /* 돈이 나가는 로봇 — `def` 는 가장 싼 쪽이다 */
  {
    f: 'eligibility-fill.yml',
    n: 'AI 자격 읽기',
    d: '공고 원문에서 지원 자격을 구조로 읽습니다 (돈이 나갑니다)',
    when: '수동',
    inputs: [
      { name: 'mode', kind: 'choice', label: '무엇을 할까요', def: '미리보기만',
        options: ['전부', '미리보기만', '시범 3건만', '공고 하나만', '첨부만'] },
      { name: 'only', kind: 'text', label: "'공고 하나만' 일 때 그 공고 id", ph: 'reg-hufs-gasong' },
    ],
  },
  {
    f: 'kosaf-fetch.yml',
    n: '한국장학재단 수확 로봇',
    d: '층2(재단 장학금) 목록·상세·선발공고문 사본을 받아 옵니다',
    when: '월·목 05:53',
    inputs: [{ name: 'mode', kind: 'choice', label: '무엇을 할까요', def: 'full',
      options: ['full', 'attach', 'probe'],
      hint: { full: '수확 → 공고문 사본 → 저장 (예약과 같음)', attach: '공고문 사본만',
        probe: '첨부 칸이 어떻게 생겼는지 보기만 (저장 없음)' } }],
  },
  { f: 'search-index.yml', n: '검색용 요약 만들기', d: '도우미가 읽을 공고별 낱말 요약을 다시 만듭니다', when: '매일 07:37' },
  { f: 'audit-coverage.yml', n: '공고 누락 감사', d: '게시판에 있는데 못 담은 공고가 있는지 대조합니다', when: '매주 월 06:23' },
  { f: 'refresh-tuition.yml', n: '등록금 갱신', d: '학교별·계열별 등록금을 다시 받습니다 (25분쯤 걸립니다)', when: '수동' },
  { f: 'refresh-majors.yml', n: '학과 목록 갱신', d: '커리어넷에서 학교별 개설 학과를 다시 받습니다', when: '수동' },
  { f: 'deploy-sync.yml', n: '배포 동기화', d: '지금 내용을 학생 앱으로 내보냅니다', when: '수집 후 자동' },
  { f: 'check-live.yml', n: '실제 앱 반영 확인', d: '학생 앱이 저장소와 같은지 대조합니다', when: '매일 13:11' },
  { f: 'verify-ui.yml', n: '앱 화면 검사', d: '학생 앱과 이 관리자 화면을 브라우저로 열어 검사합니다 (25분쯤)', when: '수동' },
  { f: 'push-check.yml', n: '푸시 알림 검사', d: '등록된 모든 폰에 시험 알림을 보냅니다', when: '수동' },
  { f: 'push-health.yml', n: '푸시 서버 상태 확인', d: '발송하지 않고 서버가 살아 있는지만 봅니다', when: '매일 06:17' },
  { f: 'robot-heartbeat.yml', n: '로봇 하트비트', d: '예약 로봇이 제때 돌고 있는지 확인합니다', when: '매일 17:29' },
  { f: 'admin-lock-check.yml', n: '관리자 화면 잠금 확인', d: '이 화면이 정말 잠겨 있는지 밖에서 열어 봅니다', when: '매일 14:23' },
  { f: 'close-old-reports.yml', n: '오래된 리포트 닫기', d: '지난 수집 리포트를 닫아 경보가 묻히지 않게 합니다', when: '매주 월' },
  { f: 'probe-links.yml', n: '링크 정찰', d: '이 주소가 학생 눈에 어떻게 보이는지 확인합니다', when: '수동' },
  { f: 'probe-boards.yml', n: '게시판 후보 정찰', d: '새 학교의 장학 게시판 주소 후보를 찾아 리포트로 올립니다', when: '수동' },
  { f: 'insta-token-check.yml', n: '인스타 토큰 수명 확인', d: '인스타 열쇠가 며칠 남았는지 봅니다', when: '매일 03:17' },
  { f: 'insta-samples.yml', n: '인스타 판형 견본', d: '판형별 견본 그림을 다시 그립니다', when: '수동' },
  /* 돈이 나가는 로봇 둘 — `def` 는 가장 싼 쪽이다 */
  {
    f: 'essay-smoke.yml',
    n: '초안 서버 실물 확인',
    d: 'AI 초안 서버가 실제로 답하는지 한 번 불러 봅니다 (돈이 나갑니다)',
    when: '수동',
    inputs: [
      { name: 'mode', kind: 'choice', label: '어디까지 할까요', def: '요청 모양만 확인 (호출 1회 · 약 50원)',
        options: ['요청 모양만 확인 (호출 1회 · 약 50원)', '실제 사용 시연 (호출 2회 · 약 100원)'] },
      { name: 'model', kind: 'choice', label: '어느 모델로', def: 'claude-sonnet-5',
        options: ['claude-sonnet-5', 'claude-opus-5'] },
    ],
  },
  {
    f: 'essay-playbook.yml',
    n: '작성 규칙 학습',
    d: '공고 원문에서 작성 규정을 읽어 초안 규칙을 갱신합니다',
    when: '매주 화 05:37',
    inputs: [{ name: 'mode', kind: 'choice', label: '무엇을 할까요', def: '미리보기만',
      options: ['읽고 저장', '미리보기만'] }],
  },
  /* 아래 둘은 '데이터를 고치는 로봇'이 아니라 **브랜치를 맞추는 로봇**이다.
     평소엔 자동으로 돌지만, 손으로 올린 변경이 반대쪽에 안 넘어간 것 같을 때 여기서 한 번
     돌릴 수 있어야 한다 — 2026-08-12에 관리자 화면 수리분을 세 브랜치에 손으로 밀어야 했다. */
  { f: 'main-guard.yml', n: 'main 직접 수정 되가져오기', d: 'main에만 올라간 변경을 로봇 브랜치로 가져옵니다', when: '자동 + 하루 2회' },
  { f: 'update-progress.yml', n: '노션 작업 현황 갱신', d: '노션 「작업 현황」에 지금 하는 일·최근 커밋을 씁니다', when: 'push 때마다' },
  /* 이 워크플로는 `url` 을 **필수 입력**으로 받는다 — 빈 값으로 던지면 GitHub 이 422 로 거부한다 */
  {
    f: 'fetch-page.yml',
    n: '페이지 원격 열람',
    d: '막힌 주소를 대신 열어 본문·첨부를 받아 옵니다 (결과는 실행 기록의 artifact)',
    when: '수동',
    inputs: [{ name: 'url', kind: 'url', label: '가져올 페이지 주소', ph: 'https://…', required: true }],
  },
];

/* 🔴 **여기 넣지 않은 것 둘 — 되돌리지 말 것.**
   · `device-deploy.yml`('이 기기에서 배포') — 브랜치 안전장치가 `if [ "$EVENT" = "push" ]` 라
     화면이 부르는 수동 실행에서는 통째로 건너뛴다(실측). 버튼을 달면 '눌렀는데 아무 일도
     안 일어나는' 버튼이 된다.
   · `two-school-scan.yml` — 일회용이고 push 트리거가 남의 브랜치를 본다.
   관문(test-collector)이 이 둘이 목록에 **없는지** 확인한다. */
const ROBOT_NOT_LISTED = ['device-deploy.yml', 'two-school-scan.yml'];

/** 설명은 함수일 수 있다 — 건수를 사본으로 두지 않고 셀 때 센다 */
const robotDesc = (r) => (typeof r.d === 'function' ? r.d() : r.d);

/* ⚠️ **로봇이 실제로 저장하는 리포트만 넣는다.**
   2026-08-12까지 여기 '심층 수집'(collector/deepfetch-report.md)이 있었는데
   deepfetch.mjs는 리포트 파일을 아예 만들지 않아 **영원히 빈 화면**이었다.
   '일반 수집'(collector/report.md)도 같은 증상이었지만 그쪽은 원인이 달랐다 —
   파일은 만들어지는데 워크플로 `git add` 목록에 없어 커밋되지 않았다(같은 날 수리). */
const REPORTS = [
  ['collector/report.md', '일반 수집'],
  ['collector/browser-report.md', '브라우저 수집'],
  ['collector/link-hunt-report.md', '링크 사냥꾼'],
  ['collector/resolve-report.md', '원문 링크 복구'],
];

/* 로봇이 남긴 열린 이슈 — 🚨 경보를 맨 위로, 리포트는 접어 둔다 */
function issueKind(t) {
  if (/^🚨/.test(t)) return { k: 'alarm', label: '경보', tone: 'bad' };
  if (/^🔧/.test(t)) return { k: 'todo', label: '조치 필요', tone: 'warn' };
  if (/^(🤖|🖥)/.test(t)) return { k: 'report', label: '리포트', tone: '' };
  return { k: 'other', label: '기타', tone: '' };
}

/* ================= 인스타 (2026-09-12 개발자 지시 ⑥) =================
   "채팅 말고도 게시물 관리·업로드 관리·트랙션·댓글까지 관리자 페이지에서."
   원칙은 다른 화면과 같다 —
   ① 화면은 **파일만 읽는다**(insta/seen.json · stats.json · comments.json · templates.json).
      인스타에 직접 묻지 않는다: 토큰은 워크플로(서버)에만 있고, 화면에 주면 여는 사람 전부가 계정에 글을 쓸 수 있다.
   ② 버튼은 **워크플로를 깨운다**(insta.yml · insta-stats.yml · insta-comments.yml). 게시·답글·삭제는
      되돌릴 수 없어 askSheet 로 한 번 더 묻는다.
   ③ 그림은 기본 브랜치의 raw 주소로 본다 — Pages 배포(약 2분) 전에도 보이고, 이 화면이 읽는 장부와 같은 판이다. */
const WF_INSTA = 'insta.yml';
const WF_INSTA_STATS = 'insta-stats.yml';
const WF_INSTA_COMMENTS = 'insta-comments.yml';
/* 🔴 이 글자들은 insta.yml 의 step 선택지와 **한 글자도** 다르면 안 된다 — 다르면 GitHub 이 422 로 거부한다.
   관문: verify-insta.js C11 이 워크플로 파일과 대조한다. */
const INSTA_STEP = {
  prepare: '준비 (새 공고를 그리고 알린다)',
  publish: '게시 (준비된 것을 올린다)',
  notify: '알림 (준비된 카드를 다시 보낸다)',
  skip: '건너뛰기 (이 공고는 안 올린다)',
};
const IG_LIFE_DAYS = 60;   // insta/token-days.mjs 의 LIFE_DAYS 와 같은 뜻 — 화면은 '우리가 아는 한' 만 말한다

function instaTplName(no) {
  const t = (D.insta.templates || []).find((x) => x.no === no);
  return t ? `${t.no}번 ${t.name}` : (no ? `${no}번` : '판형 ?');
}
function instaDday(due) {
  if (!due) return { cls: '', label: '마감 원문 확인' };
  const d = Math.round((Date.parse(`${due}T23:59:59+09:00`) - Date.now()) / 864e5);
  if (Number.isNaN(d)) return { cls: '', label: '마감 원문 확인' };
  if (d < 0) return { cls: 'past', label: '마감 지남' };
  return { cls: d <= 3 ? 'near' : d <= 7 ? 'soon' : '', label: d === 0 ? '오늘 마감' : `D-${d}` };
}
function instaGroups() {
  const seen = D.insta.seen || { posted: [], prepared: [] };
  const postedCodes = new Set((seen.posted || []).map((p) => p.code));
  const prepared = (seen.prepared || []).filter((p) => p.status === 'prepared' && !postedCodes.has(p.code));
  const skipped = (seen.prepared || []).filter((p) => p.status === 'skipped' && !postedCodes.has(p.code));
  const posted = (seen.posted || []).slice().reverse();
  return { prepared, skipped, posted };
}
function instaNewComments() {
  return (D.insta.comments.items || []).filter((c) => !c.error && !c.handledAt && !c.hidden);
}

function instaPostRow(p, kind) {
  const dd = instaDday(p.due);
  const stat = kind === 'posted' ? (D.insta.stats.posts || []).find((s) => s.code === p.code || s.id === String(p.media)) : null;
  const tpls = D.insta.templates || [];
  const meta = [
    `<span>${esc(p.org || '')}</span>`,
    p.school ? `<span>${esc(p.school)} 교내</span>` : '',
    `<span>${esc(instaTplName(p.tplNo))}</span>`,
    kind === 'posted' ? `<span>올림 ${esc(p.at || '')}</span>` : `<span>준비 ${esc(p.at || '')}${p.revisedAt && p.revisedAt !== p.at ? ` · 고침 ${esc(p.revisedAt)}` : ''}</span>`,
    kind === 'skipped' ? `<span>건너뜀 ${esc(p.skippedAt || '')}${p.skippedBy ? ` · ${esc(p.skippedBy)}` : ''}</span>` : '',
    stat ? `<span>좋아요 ${stat.likes ?? '—'} · 댓글 ${stat.comments ?? '—'} · 저장 ${stat.saved ?? '—'} · 도달 ${stat.reach ?? '—'}</span>` : '',
  ].filter(Boolean).join('');
  const thumb = `<img class="ig-thumb" src="${raw(`insta/pub/${p.code}/1.jpg`)}" alt="" loading="lazy" width="54" height="68">`;
  const acts = kind === 'prepared' ? `
      <button class="btn btn-sm btn-primary" data-ig-publish="${esc(p.code)}">게시</button>
      <button class="btn btn-sm" data-ig-view="${esc(p.code)}">카드 보기</button>
      <select class="ig-tpl" data-ig-tpl-for="${esc(p.code)}" aria-label="판형 바꾸기">
        ${tpls.map((t) => `<option value="${t.no}"${t.no === p.tplNo ? ' selected' : ''}>${t.no}번 ${esc(t.name)}</option>`).join('')}
      </select>
      <button class="btn btn-sm" data-ig-redraw="${esc(p.code)}">이 판형으로 다시 그리기</button>
      <button class="btn btn-sm danger" data-ig-skip="${esc(p.code)}">건너뛰기</button>`
    : kind === 'skipped' ? `
      <button class="btn btn-sm" data-ig-view="${esc(p.code)}">카드 보기</button>
      <button class="btn btn-sm" data-ig-redraw="${esc(p.code)}">다시 그려서 되살리기</button>`
    : `${p.permalink ? `<a class="btn btn-sm" href="${safeUrl(p.permalink)}" target="_blank" rel="noreferrer noopener">인스타에서 보기 ↗</a>` : ''}
      <button class="btn btn-sm" data-ig-view="${esc(p.code)}">카드 보기</button>`;
  return `
    <div class="row ig-row" data-noclick style="cursor:default" data-ig-code="${esc(p.code)}">
      <div class="ig-main">${thumb}<div>
        <div class="t">${esc(p.name || p.code)}</div>
        <div class="m">${meta}</div>
        <div class="btn-row ig-acts">${acts}</div>
      </div></div>
      <div class="dd ${dd.cls}">${esc(dd.label)}</div>
      <div></div>
    </div>`;
}

/* 트랙션 — 단일 계열 선 그래프(팔로워) + 게시물별 막대(저장). 축은 하나, 색은 남색 하나. */
function instaLine(hist, key, label) {
  const pts = (hist || []).filter((h) => typeof h[key] === 'number');
  if (pts.length < 2) return `<p class="muted">${esc(label)} — 이틀 이상 쌓이면 선이 그려집니다 (지금 ${pts.length}일치).</p>`;
  const W = 640, H = 160, L = 36, R = 12, T = 14, B = 26;
  const xs = (i) => L + (i * (W - L - R)) / (pts.length - 1);
  const vals = pts.map((p) => p[key]);
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const ys = (v) => hi === lo ? T + (H - T - B) / 2 : T + ((hi - v) * (H - T - B)) / (hi - lo);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${xs(i).toFixed(1)},${ys(p[key]).toFixed(1)}`).join(' ');
  const last = pts[pts.length - 1];
  return `<svg class="ig-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)} 추이">
    <line x1="${L}" y1="${H - B}" x2="${W - R}" y2="${H - B}" class="axis"/>
    <text x="${L - 6}" y="${T + 4}" class="tick" text-anchor="end">${hi}</text>
    <text x="${L - 6}" y="${H - B}" class="tick" text-anchor="end">${lo}</text>
    <text x="${L}" y="${H - 8}" class="tick">${esc(pts[0].at)}</text>
    <text x="${W - R}" y="${H - 8}" class="tick" text-anchor="end">${esc(last.at)}</text>
    <path d="${d}" class="line"/>
    ${pts.map((p, i) => `<circle cx="${xs(i).toFixed(1)}" cy="${ys(p[key]).toFixed(1)}" r="4" class="dot"><title>${esc(p.at)} · ${esc(label)} ${p[key]}</title></circle>`).join('')}
  </svg>`;
}
function instaBars(posts, key, label) {
  const rows = (posts || []).filter((p) => typeof p[key] === 'number').slice(0, 12);
  if (!rows.length) return `<p class="muted">${esc(label)} — 올린 게시물의 반응이 들어오면 막대가 그려집니다.</p>`;
  const hi = Math.max(...rows.map((p) => p[key]), 1);
  return `<div class="ig-bars" role="img" aria-label="게시물별 ${esc(label)}">${rows.map((p) => `
    <div class="ig-bar"><span class="ig-bar-l" title="${esc(p.name || p.id)}">${esc((p.name || p.org || p.id).slice(0, 18))}</span>
      <span class="ig-bar-t"><i style="width:${Math.max(2, Math.round((p[key] / hi) * 100))}%"></i></span>
      <span class="ig-bar-v">${p[key]}</span></div>`).join('')}</div>`;
}

function renderInsta() {
  const box = byId('screen-insta');
  const { prepared, skipped, posted } = instaGroups();
  const tk = D.insta.token;
  const st = D.insta.stats;
  const newC = instaNewComments();
  const tokenCard = !tk || !tk.firstSeen
    ? `<div class="card is-warn" data-stat><div class="v">연결 전</div><div class="k">인스타 계정</div>
        <div class="d">시크릿 IG_USER_ID·IG_ACCESS_TOKEN 이 아직 없습니다. 카드 준비·메일은 되지만 <b>게시는 안 됩니다.</b> 절차는 insta/README.md 「처음 한 번」.</div></div>`
    : (() => {
      const days = IG_LIFE_DAYS - Math.round((Date.now() - Date.parse(`${tk.firstSeen}T00:00:00+09:00`)) / 864e5);
      return `<div class="card ${days <= 0 ? 'is-bad' : days <= 14 ? 'is-warn' : 'is-ok'}" data-stat><div class="v">${days <= 0 ? '만료' : `${days}일`}</div>
        <div class="k">토큰 남은 수명 (우리가 아는 한)</div>
        <div class="d">처음 본 날 ${esc(tk.firstSeen)} 에서 60일을 셉니다 — 인스타는 만료일을 안 알려 줍니다. 매일 03:17 「인스타 토큰 수명 확인」이 살아 있는지 묻습니다.</div></div>`;
    })();
  const nf = (v) => (v == null ? '—' : String(v));

  box.innerHTML = `
    <div class="sec-head" data-screen-title>
      <h2>인스타</h2>
      <p>새 공고가 수집되면 로봇이 카드를 그려 개발자 셋에게 이슈·메일로 보냅니다. 여기서 보고 <b>게시</b>를 누르면 올라갑니다 —
         자동으로는 안 올립니다. 고치고 싶으면 Claude Code 채팅에 말하면 됩니다(수정본 그림을 보여 주고, 다시 보낼지 물어본 뒤 보냅니다).</p>
    </div>

    <div class="cards">
      <div class="card ${prepared.length ? 'is-warn' : 'is-ok'}" data-stat><div class="v">${prepared.length}</div><div class="k">게시 대기</div><div class="d">개발자가 보고 올릴 차례인 카드</div></div>
      <div class="card" data-stat><div class="v">${posted.length}</div><div class="k">올린 게시물</div><div class="d">건너뜀 ${skipped.length}건</div></div>
      <div class="card ${newC.length ? 'is-warn' : ''}" data-stat><div class="v">${newC.length}</div><div class="k">답 안 한 댓글</div><div class="d">${D.insta.comments.updatedAt ? `받아 온 시각 ${esc(String(D.insta.comments.updatedAt).slice(0, 16).replace('T', ' '))} UTC` : '아직 받아 온 적 없음'}</div></div>
      <div class="card" data-stat><div class="v">${nf(st.account && st.account.followers)}</div><div class="k">팔로워${st.account && st.account.username ? ` · @${esc(st.account.username)}` : ''}</div><div class="d">${st.updatedAt ? `수확 ${esc(String(st.updatedAt).slice(0, 10))}` : '트랙션 수확 전'}</div></div>
      ${tokenCard}
    </div>

    <div class="filter-row" style="margin-top:12px">
      <button class="btn btn-sm" data-ig-run="prepare">새 공고 카드 지금 그리기</button>
      <button class="btn btn-sm" data-ig-run="stats">트랙션 지금 수확</button>
      <button class="btn btn-sm" data-ig-run="comments">댓글 지금 받아오기</button>
      <a class="btn btn-sm" href="https://github.com/${OWNER}/${REPO}/actions/workflows/${WF_INSTA}" target="_blank" rel="noreferrer noopener">실행 기록 ↗</a>
    </div>

    <div class="sec-head" style="margin-top:14px"><h2>게시 대기 ${prepared.length}건</h2>
      <p>판형을 바꿔 다시 그리면 로봇이 새 카드를 그려 이슈·메일로 다시 보냅니다(약 3분). 건너뛰기는 폴더를 지우지 않아 나중에 되살릴 수 있습니다.</p></div>
    ${prepared.length ? `<div class="rows" data-rows>${prepared.map((p) => instaPostRow(p, 'prepared')).join('')}</div>`
    : '<div class="allclear"><span class="allclear-mark">✓</span> 기다리는 카드가 없습니다 — 새 공고가 수집되면 로봇이 그립니다.</div>'}

    <div class="sec-head" style="margin-top:14px"><h2>올린 게시물 ${posted.length}건</h2></div>
    ${posted.length ? `<div class="rows" data-rows>${posted.map((p) => instaPostRow(p, 'posted')).join('')}</div>` : '<p class="muted">아직 올린 게시물이 없습니다.</p>'}

    ${skipped.length ? `<details style="margin-top:14px"><summary class="muted">건너뛴 게시물 ${skipped.length}건</summary>
      <div class="rows" data-rows style="margin-top:8px">${skipped.map((p) => instaPostRow(p, 'skipped')).join('')}</div></details>` : ''}

    <div class="sec-head" style="margin-top:14px"><h2>판형 ${(D.insta.templates || []).length}벌 — 번호는 고정</h2>
      <p>"3번으로" 라고 말하면 늘 같은 판형입니다. 새 판형은 좋은 예시를 채팅에 붙여 넣고 "번호에 추가해 줘" 라고 하면 다음 번호로 더해집니다(insta/templates.json).</p></div>
    <div class="ig-tpls">${(D.insta.templates || []).map((t) => {
      const s = (D.insta.samples.templates || []).find((x) => x.no === t.no);
      return `<figure class="ig-tpl-card">
        ${s && s.cards ? `<img src="${raw(`insta/samples/${t.no}-1.jpg`)}" alt="${esc(t.name)} 표지 견본" loading="lazy">` : '<div class="ig-tpl-none">견본 없음<br><small>「인스타 판형 견본」 실행</small></div>'}
        <figcaption><b>${t.no}번 ${esc(t.name)}</b><span>${esc(t.ref || '')}</span></figcaption></figure>`;
    }).join('')}</div>

    <div class="sec-head" style="margin-top:14px"><h2>트랙션</h2>
      <p>매일 06:37 「인스타 트랙션 수확」이 팔로워·게시물 반응을 insta/stats.json 에 적습니다. 못 받은 것은 0이 아니라 '—' 로 둡니다.</p></div>
    <div class="grid2">
      <div><h3 class="ig-h3">팔로워</h3>${instaLine(st.history, 'followers', '팔로워')}</div>
      <div><h3 class="ig-h3">게시물별 저장 수</h3>${instaBars(st.posts, 'saved', '저장')}</div>
    </div>
    ${(st.posts || []).length ? `<div class="scroller" style="margin-top:10px"><table>
      <thead><tr><th>게시물</th><th>올린 날</th><th class="n">좋아요</th><th class="n">댓글</th><th class="n">저장</th><th class="n">도달</th><th class="n">공유</th></tr></thead>
      <tbody>${st.posts.map((p) => `<tr><td>${p.permalink ? `<a href="${safeUrl(p.permalink)}" target="_blank" rel="noreferrer noopener">${esc(p.name || p.org || p.id)}</a>` : esc(p.name || p.org || p.id)}${p.error ? ` <span class="pill warn" title="${esc(p.error)}">반응 못 받음</span>` : ''}</td>
        <td>${esc(p.at || '')}</td><td class="n">${nf(p.likes)}</td><td class="n">${nf(p.comments)}</td><td class="n">${nf(p.saved)}</td><td class="n">${nf(p.reach)}</td><td class="n">${nf(p.shares)}</td></tr>`).join('')}</tbody>
    </table></div>` : ''}

    <div class="sec-head" style="margin-top:14px"><h2>댓글 ${(D.insta.comments.items || []).filter((c) => !c.error).length}건</h2>
      <p>3시간마다 받아 옵니다. 답글·숨기기·삭제는 워크플로가 대신 합니다(토큰은 서버에만). 답한 댓글은 '처리됨' 으로 접힙니다.</p></div>
    ${instaCommentsHtml()}
  `;
}

function instaCommentsHtml() {
  const items = (D.insta.comments.items || []);
  if (!items.length) return '<p class="muted">받아 온 댓글이 없습니다 — 올린 게시물이 없거나 아직 받아 오기 전입니다.</p>';
  const errs = items.filter((c) => c.error);
  const fresh = items.filter((c) => !c.error && !c.handledAt);
  const done = items.filter((c) => !c.error && c.handledAt);
  const row = (c) => `
    <div class="row ig-cmt" data-noclick style="cursor:default">
      <div>
        <div class="t"><b>@${esc(c.username || '?')}</b> <span class="muted">${esc(c.at || '')}${c.hidden ? ' · 숨김' : ''}</span></div>
        <div class="ig-cmt-text">${esc(c.text)}</div>
        <div class="m"><span>${esc(c.org || '')} ${esc(c.name || '')}</span><span>좋아요 ${c.likes ?? 0}</span>${c.handledAt ? `<span>처리 ${esc(c.handledAt)}</span>` : ''}</div>
        ${(c.replies || []).length ? `<div class="ig-replies">${c.replies.map((r) => `<div>↳ <b>@${esc(r.username || '')}</b> ${esc(r.text)} <span class="muted">${esc(r.at || '')}</span></div>`).join('')}</div>` : ''}
        <div class="ig-reply-box">
          <input type="text" data-ig-reply-text="${esc(c.id)}" placeholder="답글 쓰기 (원문에 없는 사실은 적지 않습니다)" aria-label="답글">
          <button class="btn btn-sm btn-primary" data-ig-reply="${esc(c.id)}">답글</button>
          <button class="btn btn-sm" data-ig-hide="${esc(c.id)}" data-ig-hidden="${c.hidden ? '1' : ''}">${c.hidden ? '다시 보이기' : '숨기기'}</button>
          <button class="btn btn-sm danger" data-ig-delete="${esc(c.id)}">삭제</button>
        </div>
      </div>
      <div></div><div></div>
    </div>`;
  return `
    ${errs.length ? `<p class="muted">⚠️ 게시물 ${errs.length}건의 댓글을 못 받았습니다 — ${esc(errs[0].error || '')}</p>` : ''}
    ${fresh.length ? `<div class="rows" data-rows>${fresh.map(row).join('')}</div>` : '<div class="allclear"><span class="allclear-mark">✓</span> 답 안 한 댓글이 없습니다.</div>'}
    ${done.length ? `<details style="margin-top:10px"><summary class="muted">처리한 댓글 ${done.length}건</summary><div class="rows" data-rows style="margin-top:8px">${done.map(row).join('')}</div></details>` : ''}`;
}

function instaCardSheet(code) {
  const seen = D.insta.seen;
  const p = (seen.prepared || []).find((x) => x.code === code) || (seen.posted || []).find((x) => x.code === code) || { code };
  const n = Math.max(2, Math.min(10, Number(p.cards) || 5));
  openSheet(`
    <div class="sheet-head"><h3>${esc(p.org || '')} · ${esc(p.name || code)}</h3><button class="sheet-close" data-close aria-label="닫기">×</button></div>
    <p class="muted">${esc(instaTplName(p.tplNo))} · 코드 <code class="mono">${esc(code)}</code> · 그림은 기본 브랜치 기준(없는 장은 빈 칸으로 보입니다)</p>
    <div class="ig-strip">${Array.from({ length: n }, (_, i) => `<img src="${raw(`insta/pub/${code}/${i + 1}.jpg`)}" alt="${i + 1}장" loading="lazy">`).join('')}</div>
    <h4 style="margin:14px 0 6px">캡션</h4>
    <pre class="ig-caption" id="ig-caption">불러오는 중…</pre>
    <div class="sheet-foot"><button class="btn" data-close>닫기</button></div>`);
  readText(`insta/pub/${code}/caption.txt`).then((t) => { const el = byId('ig-caption'); if (el) el.textContent = t || '(캡션을 읽지 못했습니다)'; });
  /* 없는 장(4장짜리 공고의 5장)은 조용히 뺀다 — 🔴 인라인 onerror= 는 CSP(script-src 'self')가 막는다(CLAUDE.md) */
  byId('sheet').querySelectorAll('.ig-strip img').forEach((img) => img.addEventListener('error', () => img.remove()));
}

/* 버튼 → 워크플로. 되돌릴 수 없는 것(게시·삭제)은 danger 로 한 번 더 묻는다. */
async function instaDispatch(file, inputs, label, note, danger = false, lines = []) {
  askSheet({
    title: label, goLabel: '실행', danger, note, lines,
    run: async () => {
      try {
        jobShow(`${label} — 요청을 보냈어요`);
        await dispatchWorkflow(file, inputs);
        jobShow(`${label} — 로봇이 돌기 시작했습니다. 끝나면 새로고침으로 확인하세요`, 'ok',
          `https://github.com/${OWNER}/${REPO}/actions/workflows/${file}`);
      } catch (err) { jobShow(err.message, 'bad'); }
    },
  });
}

/* 화면 안 위임 — bindGlobal 의 클릭 처리 맨 앞에서 부른다. 처리했으면 true. */
async function handleInstaClick(e) {
  const t = e.target;
  const q = (attr) => { const el = t.closest(`[${attr}]`); return el ? el.getAttribute(attr) : null; };
  const nameOf = (code) => { const { prepared, skipped, posted } = instaGroups(); const p = [...prepared, ...skipped, ...posted].find((x) => x.code === code); return p ? `${p.org} · ${p.name}` : code; };
  let v;
  if ((v = q('data-ig-view')) !== null) { instaCardSheet(v); return true; }
  if ((v = q('data-ig-publish')) !== null) {
    await instaDispatch(WF_INSTA, { step: INSTA_STEP.publish, code: v }, '인스타에 게시',
      '되돌릴 수 없습니다. 준비된 그 카드를 그대로 올립니다(다시 그리지 않습니다). 시크릿이 없으면 실패 이슈가 옵니다.', true, [{ t: nameOf(v), m: v }]);
    return true;
  }
  if ((v = q('data-ig-skip')) !== null) {
    await instaDispatch(WF_INSTA, { step: INSTA_STEP.skip, code: v }, '이 공고 건너뛰기',
      '올리지 않는다고 장부에 적습니다. 카드 파일은 남아서 나중에 다시 그리면 되살아납니다.', false, [{ t: nameOf(v), m: v }]);
    return true;
  }
  if ((v = q('data-ig-redraw')) !== null) {
    const sel = document.querySelector(`[data-ig-tpl-for="${CSS.escape(v)}"]`);
    const tpl = sel ? sel.value : '';
    await instaDispatch(WF_INSTA, { step: INSTA_STEP.prepare, code: v, tpl }, `${tpl ? `${tpl}번 판형으로 ` : ''}다시 그리기`,
      '로봇이 이 공고만 다시 그려 커밋하고 개발자 셋에게 이슈·메일로 보냅니다(약 3분).', false, [{ t: nameOf(v), m: tpl ? instaTplName(Number(tpl)) : '판형은 씨앗이 정함' }]);
    return true;
  }
  if ((v = q('data-ig-run')) !== null) {
    if (v === 'prepare') await instaDispatch(WF_INSTA, { step: INSTA_STEP.prepare }, '새 공고 카드 그리기', '아직 준비 안 한 새 공고를 점수순으로 최대 6건 그려 개발자 셋에게 보냅니다.');
    else if (v === 'stats') await instaDispatch(WF_INSTA_STATS, {}, '트랙션 수확', '팔로워·게시물 반응을 받아 insta/stats.json 에 적습니다. 토큰이 없으면 조용히 끝납니다.');
    else if (v === 'comments') await instaDispatch(WF_INSTA_COMMENTS, { action: 'fetch' }, '댓글 받아오기', '올린 게시물 전부의 댓글을 받아 insta/comments.json 에 적습니다.');
    return true;
  }
  if ((v = q('data-ig-reply')) !== null) {
    const inp = document.querySelector(`[data-ig-reply-text="${CSS.escape(v)}"]`);
    const text = inp ? inp.value.trim() : '';
    if (!text) { jobShow('답글 글을 먼저 적어 주세요', 'bad'); if (inp) inp.focus(); return true; }
    await instaDispatch(WF_INSTA_COMMENTS, { action: 'reply', comment: v, text }, '댓글에 답글', '브랜드 계정 이름으로 올라갑니다. 되돌릴 수 없습니다.', true, [{ t: text, m: `댓글 ${v}` }]);
    return true;
  }
  if ((v = q('data-ig-hide')) !== null) {
    const hidden = t.closest('[data-ig-hide]').getAttribute('data-ig-hidden') === '1';
    await instaDispatch(WF_INSTA_COMMENTS, { action: hidden ? 'unhide' : 'hide', comment: v }, hidden ? '댓글 다시 보이기' : '댓글 숨기기', '숨긴 댓글은 쓴 사람에게만 보입니다.', false, [{ t: `댓글 ${v}` }]);
    return true;
  }
  if ((v = q('data-ig-delete')) !== null) {
    await instaDispatch(WF_INSTA_COMMENTS, { action: 'delete', comment: v }, '댓글 삭제', '되돌릴 수 없습니다.', true, [{ t: `댓글 ${v}` }]);
    return true;
  }
  return false;
}

/* ---------------- 로봇이 마지막에 언제 돌았나 (2026-09-13) ----------------
   🔴 예전에는 로봇 줄에 '지금 실행'과 '기록 ↗' 두 버튼뿐이라,
   **"어제 수집 잘 됐나"를 알려면 GitHub 으로 나가야 했다.** 화면에는 성공·실패·시각이 없었다.
   ⚠️ 로봇마다 한 번씩 물으면 20번을 부른다 — 저장소 전체의 최근 실행을 **한 번에** 받아
      파일 이름으로 가른다(GitHub 이 주는 것은 `.github/workflows/<파일>` 경로다).
   🔴 못 읽었을 때 '정상'으로 보이게 하지 않는다 — 못 읽었다고 적는다(푸시 상태와 같은 규칙). */
let RUNS = null;          // 파일이름 → 마지막 실행
let RUNS_STATE = 'idle';  // idle · loading · ready · failed

async function loadRuns() {
  RUNS_STATE = 'loading';
  try {
    const r = await fetch(`${API}/repos/${OWNER}/${REPO}/actions/runs?per_page=100`, { headers: ghHeaders() });
    if (!r.ok) throw new Error(String(r.status));
    const d = await r.json();
    const m = new Map();
    (d.workflow_runs || []).forEach((run) => {
      const file = String(run.path || '').split('/').pop();
      if (!file || m.has(file)) return;          // 목록이 최신순이라 처음 만난 것이 마지막 실행
      m.set(file, {
        status: run.status, conclusion: run.conclusion,
        at: run.updated_at || run.created_at, url: run.html_url,
      });
    });
    RUNS = m;
    RUNS_STATE = 'ready';
  } catch (e) {
    RUNS = null;
    RUNS_STATE = 'failed';
  }
  if (current === 'robots') renderRobots();
}

/** 언제였는지 사람 말로. 날짜만 안다고 시간 단위를 지어내지 않는다. */
function agoText(iso) {
  const t = Date.parse(iso || '');
  if (!Number.isFinite(t)) return '';
  const mins = Math.floor((Date.now() - t) / 60000);
  if (mins < 1) return '방금';
  if (mins < 60) return `${mins}분 전`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.floor(h / 24);
  return d === 1 ? '어제' : `${d}일 전`;
}

/** 로봇 한 종의 마지막 실행 표시.
 *  🔴 색만으로 말하지 않는다 — '성공'·'실패' 라는 **글자**로 적는다(색을 못 가리는 사람도 읽는다). */
function runStateHtml(file) {
  if (RUNS_STATE === 'loading') return '<span class="hint">마지막 실행을 읽는 중…</span>';
  if (RUNS_STATE === 'failed') return '<span class="pill">마지막 실행을 읽지 못했습니다</span>';
  const v = RUNS && RUNS.get(file);
  if (!v) return '<span class="pill">최근 100번 안에 실행 기록 없음</span>';
  if (v.status !== 'completed') return `<span class="pill">지금 도는 중 · ${esc(agoText(v.at))} 시작</span>`;
  const okRun = v.conclusion === 'success';
  const word = okRun ? '성공' : (v.conclusion === 'cancelled' ? '취소됨' : '실패');
  return `<span class="pill ${okRun ? 'good' : 'bad'}">마지막 실행 ${esc(word)} · ${esc(agoText(v.at))}</span>`;
}

function renderRobots() {
  const box = byId('screen-robots');
  /* 입력 칸 하나. 고르는 상자는 yml 의 선택지를 **그대로** 쓰고, 뜻풀이는 옆에 덧붙인다
     (보내는 값은 선택지 글자 그대로다 — 한 글자만 달라도 GitHub 이 422 로 거부한다). */
  const runInput = (r, i) => `
    <label class="runin" data-run-in>
      <span>${esc(i.label)}${i.required ? ' (필수)' : ''}</span>
      ${i.kind === 'choice'
    ? `<select data-run-input="${esc(r.f)}" data-run-key="${esc(i.name)}">${i.options.map((o) => `
          <option value="${esc(o)}"${o === i.def ? ' selected' : ''}>${esc(o)}${
  i.hint && i.hint[o] ? ` — ${esc(i.hint[o])}` : ''}</option>`).join('')}</select>`
    : `<input type="${i.kind === 'num' ? 'number' : i.kind === 'url' ? 'url' : 'text'}"
          data-run-input="${esc(r.f)}" data-run-key="${esc(i.name)}"
          ${i.kind === 'num' ? `min="${esc(i.min)}" max="${esc(i.max)}"` : ''}
          value="${esc(i.def || '')}" placeholder="${esc(i.ph || '')}" />`}
    </label>`;

  const runRow = (r) => `
    <div class="row" data-row data-noclick data-robot="${esc(r.f)}" style="cursor:default">
      <div>
        <div class="t">${esc(r.n)}</div>
        <div class="m"><span>${esc(robotDesc(r))}</span><span>${esc(r.when)}</span></div>
        <div class="badges">${runStateHtml(r.f)}</div>
        ${(r.inputs || []).map((i) => runInput(r, i)).join('')}
      </div>
      <div class="btn-row">
        <button class="btn btn-sm" data-run="${esc(r.f)}" data-run-name="${esc(r.n)}">지금 실행</button>
        <a class="btn btn-sm" href="https://github.com/${OWNER}/${REPO}/actions/workflows/${esc(r.f)}"
           target="_blank" rel="noreferrer noopener">기록 ↗</a>
      </div>
      <div></div>
    </div>`;

  box.innerHTML = `
    <div class="sec-head" data-screen-title>
      <h2>로봇</h2>
      <p>로봇이 무슨 말을 하고 있는지 먼저 보고, 필요하면 여기서 바로 돌립니다.</p>
    </div>

    <div class="sec-head"><h2>로봇이 남긴 것</h2></div>
    <div id="robot-issues"><p class="muted">불러오는 중…</p></div>

    <div class="sec-head" style="margin-top:12px"><h2>푸시 발송 서버</h2></div>
    <div id="push-health"><p class="muted">확인하는 중…</p></div>

    <div class="sec-head" style="margin-top:12px"><h2>양식 변환 API</h2></div>
    <div id="api-health"><p class="muted">확인하는 중…</p></div>

    <div class="sec-head" style="margin-top:12px"><h2>로봇 ${ROBOTS.length}종 — 지금 실행</h2>
      <p>예약 시간과 무관하게 한 번 더 돌립니다. <b>같은 학교를 하루에 여러 번 두드리면</b>
         학교 서버가 막아 멀쩡한 주소까지 실패로 뜰 수 있으니, 수집 계열은 필요할 때만 누르세요.</p>
    </div>
    <div class="rows" data-rows>${ROBOTS.map(runRow).join('')}</div>
    <p class="hint" data-robot-skip>여기서 부르지 않는 것: ${ROBOT_NOT_LISTED.map(esc).join(' · ')}
       — 화면에서 누르면 아무 일도 일어나지 않거나(브랜치 안전장치) 일회용 로봇이라 일부러 뺐습니다.</p>

    <!-- 수집망 — 학교가 둘로 줄어 탭 하나를 차지할 이유가 없어졌다. 여기로 들어온다.
         🔴 베끼지 않고 networkSectionHtml() 한 곳을 쓴다(수집망 탭과 같은 내용). -->
    <div class="sec-head" style="margin-top:var(--space-20)">
      <h2>수집망 — 게시판 ${D.schools.length}곳</h2>
      <p>어제부터 공고가 안 들어오는 학교를 여기서 발견합니다.</p>
    </div>
    ${networkSectionHtml()}

    <div class="sec-head" style="margin-top:12px"><h2>로봇 리포트 전문</h2></div>
    <div class="filter-row">
      ${REPORTS.map(([p, n]) => `<button class="btn btn-sm" data-report="${esc(p)}">${esc(n)}</button>`).join('')}
    </div>
    <div id="report-box"></div>

    <div class="sec-head" style="margin-top:12px"><h2>로봇 설정</h2></div>
    <div class="rows" data-rows>
      <div class="row" data-noclick style="cursor:default">
        <div>
          <div class="t">자동 등록 로봇</div>
          <div class="m"><span>${D.autoCfg.enabled ? '켜짐 — 로봇이 스스로 등록합니다' : '꺼짐 — 리포트만 올립니다'}</span>
            <span>한 번에 최대 ${esc(String(D.autoCfg.maxPerRun ?? 8))}건</span>
            <span>재등록 차단 ${(D.autoCfg.blockIds || []).length}건</span></div>
        </div>
        <div class="btn-row">
          <button class="btn btn-sm ${D.autoCfg.enabled ? 'danger' : 'good'}" data-auto-toggle>
            ${D.autoCfg.enabled ? '끄기' : '켜기'}</button>
        </div>
        <div></div>
      </div>
      ${/* 🔴 **막은 것을 풀 자리** (2026-09-14 신설). 저장소 쪽에 unblock 이 있는데 화면에
           버튼이 없어서, 잘못 막은 공고를 개발자가 영영 되살릴 수 없었다 — 파일을 직접
           못 고치는 구조라 GitHub Actions 에서 손으로 payload 를 적는 수밖에 없었다.
           차단은 '이 공고를 다시는 담지 마라'는 뜻이라, 실수로 막으면 로봇이 매일 다시
           가져와도 영영 등록되지 않고 그 사실조차 화면에 안 뜬다. */''}
      ${(D.autoCfg.blockIds || []).length ? `
      <details class="row" data-noclick data-blocklist style="cursor:default;display:block">
        <summary class="t">막아 둔 공고 ${(D.autoCfg.blockIds || []).length}건 — 펼쳐서 풀기</summary>
        <p class="hint">로봇이 이 공고들을 다시 담지 않습니다. 잘못 막은 것이 있으면 푸세요 —
          푼 뒤에는 다음 수집 때 다시 후보로 올라옵니다.</p>
        <div class="rows">
          ${(D.autoCfg.blockIds || []).map((bid) => `
            <div class="row" data-noclick style="cursor:default">
              <div><div class="m"><code>${esc(bid)}</code></div></div>
              <div class="btn-row">
                <button class="btn btn-sm" data-unblock="${esc(bid)}">차단 풀기</button>
              </div>
              <div></div>
            </div>`).join('')}
        </div>
      </details>` : ''}
    </div>`;

  loadRobotIssues();
  loadPushHealth();
  loadApiHealth();
  /* 마지막 실행은 한 번만 받아 둔다 — 다시 그릴 때마다 부르면 화면을 열 때마다 API 를 쓴다.
     🔴 loadRuns 가 끝나면 스스로 renderRobots 를 다시 부르므로 여기서 또 부르면 무한이 된다.
        (그래서 'idle 일 때만' 부른다 — 만들면서 실제로 그렇게 만들 뻔했다) */
  if (RUNS_STATE === 'idle') loadRuns();
}

/* 양식 변환 API가 살아 있는지 (2026-08-12 신설).
   왜 만들었나: 잔액이 떨어져 8/11부터 유료 변환이 멈췄는데, 실패가 리포트의 '건너뜀'
   목록에 한 줄로 섞여 있어서 **화면은 아무 말도 하지 않았다.** 다음 날 사람이 물어서야
   알았다. 푸시 서버엔 lastError 카드가 있는데 이쪽만 없던 비대칭을 메운다.
   ⚠️ '실패가 없다'와 '리포트를 못 읽었다'를 구분한다 — 못 읽은 것을 정상으로 보이면 안 된다. */
async function loadApiHealth() {
  const box = byId('api-health');
  if (!box) return;
  /* 브라우저 수집 리포트만 **먼저 읽는다.** 일반 수집 리포트는 2026-08-12에야 커밋되기
     시작해서(그 전 실행분은 파일이 없다) 무조건 부르면 404가 콘솔 오류로 남는다 —
     검사의 '콘솔 오류 없음' 항목이 이걸 잡는다. 이미 읽어 둔 것이 있으면 같이 본다.
     양쪽 수집 로봇이 **같은 스키마화 단계**를 돌기 때문에, API 실패는 어느 쪽 리포트에도
     똑같이 남는다 — 한쪽만 봐도 놓치지 않는다. */
  const found = [];
  let readAny = false;
  const primary = 'collector/browser-report.md';
  if (reportCache[primary] == null) reportCache[primary] = await readText(primary);
  for (const p of [primary, 'collector/report.md']) {
    const t = reportCache[p];
    if (!t) continue;
    readAny = true;
    (t.match(/API 호출 실패[^\n]*/g) || []).forEach((m) => found.push(m));
  }
  if (!readAny) {
    box.innerHTML = '<p class="muted">리포트를 읽지 못했습니다 — 정상이라는 뜻은 아닙니다.</p>';
    return;
  }
  if (!found.length) {
    box.innerHTML = '<div class="cards"><div class="card is-ok" data-stat><div class="v">정상</div>'
      + '<div class="k">양식 변환 API</div>'
      + '<div class="d">최근 리포트에 호출 실패가 없습니다</div></div></div>';
    return;
  }
  const credit = found.some((m) => /cred/i.test(m));
  box.innerHTML = `<div class="cards"><div class="card is-bad" data-stat><div class="v">${found.length}</div>
      <div class="k">API 호출 실패</div>
      <div class="d">${credit ? '<b>잔액 부족으로 보입니다</b> — 충전 전까지 유료 변환(스캔 PDF·표 서식)이 멈춥니다.'
    : '최근 리포트에 실패가 기록돼 있습니다.'}
        무료 변환기는 그대로 돌고 있어 앱은 정상입니다.</div>
      <div class="btn-row">
        <a class="btn btn-sm" href="https://console.anthropic.com/settings/billing"
           target="_blank" rel="noreferrer noopener">잔액 확인 ↗</a>
      </div></div></div>
    <p class="muted mono">${esc(found[0]).slice(0, 200)}</p>`;
}

/* 열린 이슈를 읽어 온다. 실패하면 **조용히 비우지 않는다** — 이 화면의 존재 이유가
   '로봇이 뭐라고 하는지'인데, 못 읽은 것을 '아무 말 없음'으로 보이면 안 된다. */
async function loadRobotIssues() {
  const box = byId('robot-issues');
  if (!box) return;
  try {
    const r = await fetch(`${API}/repos/${OWNER}/${REPO}/issues?state=open&per_page=100`, { headers: ghHeaders() });
    if (!r.ok) throw new Error(`GitHub 응답 ${r.status}`);
    const all = (await r.json()).filter((x) => !x.pull_request);
    const g = { alarm: [], todo: [], report: [], other: [] };
    all.forEach((x) => { g[issueKind(x.title).k].push(x); });

    const row = (x) => {
      const kind = issueKind(x.title);
      return `<div class="row" data-noclick style="cursor:default">
        <div>
          <div class="t">${esc(x.title)}</div>
          <div class="m"><span>#${x.number}</span><span>${esc((x.created_at || '').slice(0, 10))}</span>
            ${x.comments ? `<span>코멘트 ${x.comments}</span>` : ''}</div>
        </div>
        <div><span class="pill ${kind.tone}">${esc(kind.label)}</span></div>
        <div class="btn-row"><a class="btn btn-sm" href="${esc(x.html_url)}"
           target="_blank" rel="noreferrer noopener">열기 ↗</a></div>
        <div></div>
      </div>`;
    };
    const urgent = [...g.alarm, ...g.todo];
    const rb = byId('n-robots');
    if (rb) { rb.textContent = urgent.length; rb.className = `tab-n${urgent.length ? ' hot' : ''}`; rb.dataset.filled = '1'; }
    box.innerHTML = `
      ${urgent.length
    ? `<div class="rows" data-rows>${urgent.map(row).join('')}</div>`
    : '<p class="empty">🚨 경보도 조치 요청도 없습니다 — 로봇이 조용합니다.</p>'}
      ${g.report.length ? `<details style="margin-top:8px">
        <summary class="muted" style="cursor:pointer">수집 리포트 ${g.report.length}건 (펼쳐 보기)</summary>
        <div class="rows" data-rows style="margin-top:8px">${g.report.slice(0, 20).map(row).join('')}</div>
      </details>` : ''}
      ${g.other.length ? `<p class="muted">그 밖의 열린 이슈 ${g.other.length}건</p>` : ''}`;
  } catch (e) {
    box.innerHTML = `<p class="empty" style="border-color:var(--red);color:var(--red)">
      로봇이 남긴 것을 읽지 못했습니다 (${esc(e.message)}) — <b>'아무 말 없음'이 아닙니다.</b>
      잠시 후 새로고침해 주세요.</p>`;
  }
}

/* 푸시 서버는 `lastError`가 **조용히 멈춘 것을 알 수 있는 유일한 신호**다 */
async function loadPushHealth() {
  const box = byId('push-health');
  if (!box) return;
  const url = 'https://handaejang-push.seonju5543.workers.dev/health';
  try {
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) throw new Error(`응답 ${r.status}`);
    const h = await r.json();
    const bad = !!h.lastError;
    box.innerHTML = `<div class="cards"><div class="card ${bad ? 'is-bad' : 'is-ok'}" data-stat>
      <div class="v">${h.subs == null ? '—' : esc(String(h.subs))}</div>
      <div class="k">등록된 폰</div>
      <div class="d">${bad ? `마지막 오류: ${esc(JSON.stringify(h.lastError)).slice(0, 90)}`
    : `정상 · 지금 단계 ${esc(String(h.step || 'idle'))}`}</div>
      <div class="btn-row">
        <button class="btn btn-sm" data-run="push-check.yml" data-run-name="푸시 알림 검사">시험 발송</button>
      </div></div></div>
      <p class="muted">등록 수는 <b>'살아 있는 폰 수'가 아닙니다</b> — 실제로 받는지는 시험 발송만이 증명합니다.</p>`;
  } catch (e) {
    box.innerHTML = `<p class="muted">푸시 서버 상태를 읽지 못했습니다 (${esc(e.message)}).
      서버가 멈춘 것일 수도, 이 브라우저가 못 닿는 것일 수도 있습니다 —
      <b>둘을 구분할 수 없으니 '정상'으로 보지 마세요.</b>
      <a href="${esc(url)}" target="_blank" rel="noreferrer noopener">직접 열어 보기 ↗</a></p>`;
  }
}

/* ---------------- ⑦ 데이터 품질 ---------------- */
/** 숫자 카드 묶음. 🔴 **0건은 카드로 자리를 먹지 않는다** — 손봐야 할 것만 카드로 올리고
 *  0건은 아래 한 줄 띠로 접는다.
 *  예전에는 이 규칙이 「오늘 할 일」에만 있었고 「데이터 품질」은 '0 규칙 위반' 카드를 그대로
 *  띄웠다 — 같은 규칙이 화면마다 다르면 읽는 사람이 규칙을 배울 수 없다. */
function statCardsHtml(list) {
  const card = (c) => `
    <div class="card ${c.tone || ''}" data-stat>
      <div class="v">${c.v ?? c.n}</div>
      <div class="k">${esc(c.k)}</div>
      ${c.d ? `<div class="d">${c.d}</div>` : ''}
      ${c.btn ? `<div class="btn-row">${c.btn}</div>` : ''}
    </div>`;
  const todo = list.filter((c) => c.n > 0);
  const clear = list.filter((c) => c.n === 0);
  return `${todo.length ? `<div class="cards">${todo.map(card).join('')}</div>` : ''}
    ${clear.length ? `<div class="allclear">
      <span class="allclear-mark">✓</span>
      <span>정상 ${clear.length}항목</span>
      <span class="allclear-list">${clear.map((c) => esc(c.k)).join(' · ')}</span>
    </div>` : ''}`;
}

/* ---------------- 원인별로 묶기 (2026-09-13) ----------------
   🔴 **같은 원인 10건을 10줄로 늘어놓지 않는다.**
   실측: 경고 11건 = 서로 다른 원인 **2개**이고, 그중 하나가 10건이다. 예전에는 그 10건이
   한 글자도 안 다른 같은 문장으로 열 줄을 채웠고, 문구가 시키는 일은 '파일을 고쳐서 push'라
   **코드 지식 없는 개발자가 할 수 없는 말**이었으며, 그 로봇 버튼은 다른 탭에 있었다.
   이제 규칙이 `fix`(고칠 수 있는 로봇 이름)를 같이 내주고, 여기서 원인 한 줄 + 그 자리 버튼으로 그린다. */
function problemGroups(items, formIds) {
  const g = new Map();
  items.forEach((it) => {
    (problemsOf(it, formIds) || []).forEach((p) => {
      const k = `${p.level}|${p.msg}`;
      if (!g.has(k)) g.set(k, { level: p.level, msg: p.msg, fix: p.fix || null, items: [] });
      g.get(k).items.push(it);
    });
  });
  /* 오류를 먼저, 그다음 건수가 많은 것부터 — 손대면 가장 많이 줄어드는 것이 위로 온다 */
  return [...g.values()].sort((a, b) => (a.level === b.level
    ? b.items.length - a.items.length
    : (a.level === 'error' ? -1 : 1)));
}

/** 원인 한 줄. 펼치면 그 원인에 걸린 공고들이 나온다. */
function problemGroupHtml(grp, key) {
  const n = grp.items.length;
  const tone = grp.level === 'error' ? 'bad' : '';
  /* 🔴 로봇 이름을 베끼지 않는다 — 로봇 화면(ROBOTS)이 원본이다. 베끼면 이름이 갈라진다. */
  const robot = ROBOTS.find((r) => r.f === grp.fix);
  const label = robot ? robot.n : grp.fix;
  /* 🔴 **입력 없이 부르지 않는다** — eligibility-fill 의 기본값은 '전부'(전수 약 2,229원)이고
     deep-fetch 의 기본값은 엉뚱한 공고('조병두')다. 부르는 모양은 규칙 파일(FIX_PLAN)에 있다. */
  const plan = FIX_PLAN[grp.fix] || {};
  /* 공고 제목을 넘겨야 하는 로봇(deep-fetch)은 **이 원인에 걸린 공고들의 제목**을 보낸다.
     길이 상한을 넘으면 앞에서 끊고 **버튼 글자에 몇 건인지 적는다**(말없이 자르지 않는다). */
  const argOf = (p) => {
    if (!p || p.argFrom !== 'names') return null;
    const picked = [];
    let len = 0;
    for (const it of grp.items) {
      const nm = String(it.name || '').trim();
      if (!nm) continue;
      if (len + nm.length + 1 > 900) break;
      picked.push(nm); len += nm.length + 1;
    }
    return { value: picked.join(','), k: picked.length };
  };
  const fixBtn = (which) => {
    const p = plan[which];
    if (which === 'all' && !p) return '';
    const arg = argOf(p);
    const text = (p && p.label) ? `${p.label}${arg && arg.k < n ? ` (먼저 ${arg.k}건)` : ''}` : `이 ${n}건 고치기`;
    const cls = which === 'main' ? 'btn-primary' : '';
    return `<button class="btn btn-sm ${cls}" data-fixrun="${esc(grp.fix)}" data-fixplan="${which}"
        data-fixn="${n}"${arg ? ` data-fixarg="${esc(arg.value)}"` : ''}>${esc(text)} — ${esc(label)}${
  p && p.cost ? ` · ${esc(p.cost)}` : ''}</button>`;
  };
  return `
    <div class="pgroup" data-pgroup>
      <div class="pgroup-head">
        <span class="pill ${tone}">${grp.level === 'error' ? '오류' : '경고'} ${n}건</span>
        <span class="pgroup-msg">${esc(grp.msg)}</span>
        ${grp.fix
    ? `${fixBtn('main')}${fixBtn('all')}`
    : '<span class="hint">한 건씩 보고 고쳐야 합니다</span>'}
      </div>
      ${grp.fix && plan.note ? `<p class="hint">${esc(plan.note)}</p>` : ''}
      <details>
        <summary class="hint">어떤 공고인지 보기 (${n}건)</summary>
        <div class="rows" data-rows>${grp.items.slice(0, shown(`pg-${key}`, 20))
    .map((it) => rowHtml(it)).join('')}</div>
        ${moreBtn(`pg-${key}`, n, 20)}
      </details>
    </div>`;
}

/* 🔴 target 을 받는 이유는 renderForms 와 같다 — 「할 일」 화면이 이 함수를 그대로 부른다.
   '지금 뭐가 잘못됐나' 는 곧 '오늘 할 일' 이라 두 화면으로 나눌 이유가 없었다. */
function renderQuality(target) {
  const fi = formIdSet();
  const withProb = D.reg.map((it) => ({ it, ps: problemsOf(it, fi) })).filter((x) => x.ps.length);
  const errors = withProb.filter((x) => x.ps.some((p) => p.level === 'error'));
  const warns = withProb.filter((x) => !x.ps.some((p) => p.level === 'error'));
  const dead = deadLinks();
  const noAmount = D.reg.filter((it) => !it.amountValue).length;
  const noDeadline = D.reg.filter((it) => !it.deadline).length;
  const noForm = D.reg.filter((it) => typeof hasFormAttachment === 'function'
    && hasFormAttachment(it) && !it.formId).length;
  /* 지원 자격 미확보 — 학생 화면에 "지원 자격을 아직 읽지 못했어요"로 나가는 공고.
     판정 기준은 **학생 앱과 같은 칸**(eligibilityLines)이다. 고치는 자리는 상세 시트에
     있었는데 '몇 건인지'를 세는 자리가 어디에도 없어서, 76건이 밀려 있어도 화면이 조용했다. */
  const noElig = D.reg.filter((it) => !(it.eligibilityLines || []).length && !it.eligibilityVerified).length;

  const probRow = (x) => `
    <div class="row" data-id="${esc(x.it.id)}" tabindex="0" role="button" aria-label="${esc(x.it.name)} 상세 열기">
      <div>
        <div class="t">${esc(x.it.name)}</div>
        <div class="m"><span class="mono">${esc(x.it.id)}</span><span>${esc(schoolOf(x.it))}</span></div>
        <div class="badges">${x.ps.map((p) =>
    `<span class="pill ${p.level === 'error' ? 'bad' : ''}">${esc(p.msg)}</span>`).join('')}</div>
      </div>
      <div><span class="pill ${statusOf(x.it)}">${STATUS_LABEL[statusOf(x.it)]}</span></div>
      <div>${ddayHtml(x.it)}</div>
    </div>`;

  byId(target).innerHTML = `
    <div class="sec-head">
      <h2>데이터 품질</h2>
      <p>로봇이 매일 쓰는 등록 규칙을 이 화면에서 그대로 돌린 결과입니다. 줄을 누르면 바로 고칠 수 있습니다.</p>
    </div>

    ${statCardsHtml([
    { n: errors.length, tone: 'is-bad', k: '규칙 위반 (오류)', d: '앱1에 잘못 나갈 수 있는 항목' },
    { n: warns.length, tone: 'is-warn', k: '규칙 경고', d: '손봐야 하지만 치명적이지는 않음' },
    { n: noAmount, tone: 'is-warn', k: '금액 미확인', d: '학생이 얼마인지 모르는 공고' },
    { n: noDeadline, tone: 'is-warn', k: '마감일 없음', d: '언제까지인지 모르는 공고' },
    { n: noForm, tone: 'is-warn', k: '신청서 첨부는 있는데 양식 미등록', d: '앱에서 작성하게 만들 수 있는 후보' },
    { n: noElig, tone: 'is-warn', k: '지원 자격 미확보',
      d: '학생에게 "자격을 아직 읽지 못했어요"로 나가는 공고 — 상세에서 원문 문장을 골라 주면 사라집니다' },
    { n: dead.length, tone: 'is-warn', k: '원문 링크 실패 기록', d: '링크 사냥꾼이 못 연 주소' },
  ])}

    ${(() => {
    const groups = problemGroups(D.reg, fi);
    if (!groups.length) return '<p class="empty">규칙 위반이 없습니다.</p>';
    return `<div class="sec-head"><h2>손봐야 할 것 — 원인 ${groups.length}가지</h2>
        <p>같은 원인은 한 줄로 묶었습니다. 로봇이 고칠 수 있는 것은 그 자리에서 누르면 됩니다.</p></div>
      ${groups.map((g, i) => problemGroupHtml(g, i)).join('')}`;
  })()}

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
/* 시트를 열기 직전에 어디에 있었는지 기억한다 — 닫을 때 그 자리로 돌려보내야
   키보드 사용자가 목록의 제자리를 잃지 않는다. */
let sheetReturn = null;

function openSheet(html) {
  const sheet = byId('sheet');
  if (sheet.hidden) sheetReturn = document.activeElement;   // 시트 안에서 시트를 또 열 때는 덮어쓰지 않는다
  sheet.innerHTML = html;
  sheet.hidden = false;
  byId('sheet-back').hidden = false;
  document.body.style.overflow = 'hidden';
  /* 초점을 시트 안으로 옮긴다. 안 그러면 읽어 주기가 뒤 화면을 계속 읽는다. */
  const first = sheet.querySelector('input, select, textarea, button, [href]');
  (first || sheet).focus({ preventScroll: true });
  markScrollers(sheet);
}

function closeSheet() {
  byId('sheet').hidden = true;
  byId('sheet-back').hidden = true;
  document.body.style.overflow = '';
  if (sheetReturn && document.contains(sheetReturn)) sheetReturn.focus({ preventScroll: true });
  sheetReturn = null;
}

/* 초점 가두기 — 시트가 열려 있는 동안 Tab이 뒤 화면으로 새 나가지 않게 한다.
   (`aria-modal`은 읽어 주기에만 알리는 표시이고, 키보드 이동까지 막지는 않는다) */
function trapFocus(e) {
  if (e.key !== 'Tab') return;
  const sheet = byId('sheet');
  if (!sheet || sheet.hidden) return;
  const f = [...sheet.querySelectorAll('input, select, textarea, button, [href], [tabindex]:not([tabindex="-1"])')]
    .filter((el) => !el.disabled && el.offsetParent !== null);
  if (!f.length) return;
  const first = f[0], last = f[f.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
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
  /* 🔴 아래 넷은 **앱1이 이미 읽는 칸**인데 화면에 입력할 자리가 없었다 (2026-09-14 신설).
     비어 있던 건수(실측): 발표일 44/48 · 제외 대상 41 · 우선 기준 46.
     달력의 발표 점이 4건뿐이던 이유가 이것이다.
     ⚠️ 지어내지 말 것 — 오른쪽 원문에서 찾은 것만 적는다(원칙 8-1). */
  ['documents', '준비할 서류 (한 줄에 하나씩)', 'lines'],
  ['announceDate', '발표일 (YYYY-MM-DD, 모르면 비움)', 'text'],
  ['eligibilityExcludes', '이런 학생은 못 받아요 — 제외 대상 (한 줄에 하나씩)', 'lines'],
  ['eligibilityPriority', '먼저 뽑는 기준 — 우선 선발 (한 줄에 하나씩)', 'lines'],
];

/* 등록 시트 (C2) — 왼쪽에 앱1로 나갈 내용, 오른쪽에 공고 원문.
   상세 시트의 두 칸 대조 구조를 그대로 쓴다(따로 만들면 서로 달라진다).
   **아는 것만 미리 채운다** — 제목·주소·학교는 수집된 값이라 확실하고,
   금액·마감은 비워 둔 채 '원문 확인'으로 나간다(운영 원칙 8-1 추론 금지). */
function registerSheet(n) {
  const u = safeUrl(n.url);
  const atts = (n.attachments || []).slice(0, 8);
  const f = (k, label, ph = '', hint = '') => `
    <div class="field">
      <label for="rg-${k}">${esc(label)}</label>
      <input type="text" id="rg-${k}" data-rg="${k}" placeholder="${esc(ph)}" />
      ${hint ? `<span class="hint">${esc(hint)}</span>` : ''}
    </div>`;

  return `
    <div class="sheet-head">
      <h3>정식 등록</h3>
      <button class="sheet-close" data-close aria-label="닫기">×</button>
    </div>

    <p class="muted">비워 두면 <b>'원문 확인'</b>으로 표시됩니다. <b>확인하지 못한 값을 지어내지 마세요</b> —
      비어 있는 편이 틀린 숫자보다 낫습니다.</p>

    <div class="compare">
      <div class="pane" data-pane="app">
        <h4>앱1에 나갈 내용</h4>
        <div class="pane-body">
          <div class="field">
            <label for="rg-name">제목</label>
            <input type="text" id="rg-name" data-rg="name" value="${esc(n.title || '')}" />
          </div>
          <div class="field">
            <label for="rg-type">구분</label>
            <select id="rg-type" data-rg="type">
              <option value="교내">교내</option>
              <option value="교외">교외 (재단·지자체 등)</option>
            </select>
          </div>
          ${f('deadline', '마감일', 'YYYY-MM-DD', '모르면 비워 두세요 — 등록 60일 뒤 자동으로 숨겨집니다')}
          ${f('amount', '금액 문구', '예: 등록금 전액')}
          ${f('amountValue', '금액(숫자)', '예: 3000000', '확인한 금액만 넣으세요. 비우면 합계에서 제외됩니다')}
          ${f('provider', '주관', `${esc(n.school || '')}${n.campus ? ` ${esc(n.campus)}` : ''} 게시 공고`)}
          <div class="field">
            <label for="rg-summary">요약</label>
            <textarea id="rg-summary" data-rg="summary" rows="3"
              placeholder="비우면 '관리자 화면에서 사람이 확인해 등록한 공고예요'로 나갑니다"></textarea>
          </div>
          <p class="muted">학교 한정: <b>${esc(n.school || '(없음)')}${n.campus ? ` ${esc(n.campus)}` : ''}</b>
            — 이 학교 학생에게만 보입니다. 전국 사업이면 등록 뒤 상세에서 고치세요.</p>
        </div>
      </div>

      <div class="pane" data-pane="source">
        <h4>공고 원문</h4>
        <div class="pane-body">
          <p><b>${esc(n.title || '')}</b></p>
          <p class="muted">${esc(n.school || '')}${n.campus ? ` ${esc(n.campus)}` : ''}
            ${n.foundAt ? ` · 수집 ${esc(n.foundAt)}` : ''}</p>
          ${n.deadlineHint ? `<p class="muted">게시판 기한 단서: ${esc(String(n.deadlineHint).slice(0, 80))}</p>` : ''}
          ${u ? `<p><a class="btn btn-sm" href="${esc(u)}" target="_blank" rel="noreferrer noopener">원문 공고 열기 ↗</a></p>` : ''}
          ${atts.length ? `<p class="muted">첨부 ${atts.length}건 — 등록하면 그대로 따라갑니다</p>
            <ul>${atts.map((a) => `<li>${esc(a.name || a.url || '')}</li>`).join('')}</ul>` : '<p class="muted">첨부 없음</p>'}
        </div>
      </div>
    </div>

    <p class="muted">등록하면 검사를 통과해야만 저장됩니다 — 대출·대학원 전용·행사 같은 것은
      <b>사람이 눌러도</b> 규칙이 막습니다.</p>
    <div class="btn-row sheet-foot">
      <button class="btn btn-primary" data-reg-go="${esc(n.url)}">등록하기</button>
      <button class="btn" data-close>취소</button>
    </div>`;
}

let currentSheetItem = null;

/* ---------------- 이어서 처리하기 (2026-09-13) ----------------
   🔴 예전에는 한 건을 끝낼 때마다 **시트가 닫히고 목록에서 같은 줄을 다시 찾아야** 했다.
   14건을 처리하면 그 찾기가 14번이다. 이제 시트 안에서 '다음 공고 ▸' 로 바로 넘어간다.
   ⚠️ 줄 목록은 **시트를 열 때의 순서를 그대로** 쓴다 — 처리하는 동안 목록이 다시 정렬되면
      방금 본 것으로 되돌아가거나 건너뛴다. */
let SHEET_QUEUE = [];

function sheetQueueSet(ids) { SHEET_QUEUE = ids.slice(); }

/** 지금 보는 공고의 다음 것. 마지막이면 null. */
function sheetNext(id) {
  const i = SHEET_QUEUE.indexOf(id);
  if (i < 0 || i + 1 >= SHEET_QUEUE.length) return null;
  return D.reg.find((x) => x.id === SHEET_QUEUE[i + 1]) || null;
}
function sheetPos(id) {
  const i = SHEET_QUEUE.indexOf(id);
  return i < 0 ? null : { n: i + 1, of: SHEET_QUEUE.length };
}

/** 상세를 연다. 저장된 원문이 아직 없으면 뒤에서 받아 오고, 오면 그 칸만 다시 그린다.
 *  🔴 여는 것을 기다리게 하지 않는다 — 800KB 를 받는 동안 화면이 멈추면 더 나쁘다. */
function openDetail(it) {
  currentSheetItem = it;
  openSheet(detailSheet(it));
  if (SRC_STATE === 'ready') return;
  ensureSources().then(() => {
    /* 그새 시트를 닫았거나 다른 공고를 열었으면 그리지 않는다 */
    if (byId('sheet').hidden || currentSheetItem !== it) return;
    /* 🔴 **시트 전체를 다시 그리지 않는다** — 원문이 오는 동안 '먼저 채울 것' 칸에
       치고 있던 글이 통째로 날아가고 초점도 맨 앞으로 튄다(코드 리뷰가 잡았다).
       원문 칸 하나만 갈아 끼운다. */
    const slot = byId('src-slot');
    if (slot) slot.innerHTML = sourceBlock(it);
    else openSheet(detailSheet(it));
  });
}

/** 저장된 공고 원문을 보여 주는 칸.
 *  🔴 여기 적는 것은 **원문 그대로**이고, 옳다·그르다를 말하지 않는다(운영 원칙 8-1).
 *  🔴 못 읽었을 때 조용히 비우지 않는다 — '아직 오는 중' 으로 읽히면 기다림이 영영 굳는다. */
function sourceBlock(it) {
  if (SRC_STATE === 'loading') {
    return '<p class="muted">저장해 둔 공고 원문을 읽는 중입니다…</p>';
  }
  if (SRC_STATE === 'failed') {
    return `<p class="muted">저장해 둔 원문을 읽지 못했습니다.
      <button class="btn btn-sm" data-act="src-retry" data-id="${esc(it.id)}">다시 읽기</button></p>`;
  }
  const src = storedSource(it);
  if (!src) {
    return `<p class="muted">저장소에 이 공고의 원문이 없습니다.
      ${(it.excerpts || []).length ? '' : '없는 내용을 지어내지 말고 위 원문 링크로 확인하세요.'}</p>`;
  }
  const raw = String(src.text || '');
  /* 🔴 학교 홈페이지 메뉴를 걷어낸다 — 안 걷으면 맨 위가 '바로가기 메뉴 · 설립자 · 상징 · UI …'
     라 정작 공고를 읽으려면 한참 내려야 한다(실측으로 그랬다).
     ⚠️ 너무 많이 걷혔으면(본문이 거의 안 남으면) 걷지 않은 것을 보여 준다 —
        걷는 규칙이 헛돌아 공고를 통째로 지우는 것보다 메뉴가 좀 섞이는 편이 낫다. */
  let body = raw;
  let stripped = false;
  try {
    const cut = SRC_STRIP ? SRC_STRIP(src.url || '', raw) : raw;
    if (cut && cut.length >= 200) { body = cut; stripped = cut.length < raw.length; }
  } catch { /* 못 걷으면 원문 그대로 */ }
  /* 🔴 숫자를 **둘 다** 적는다. 많이 줄었다는 것은 뜻이 있는 신호다 —
     저장된 쪽이 상세가 아니라 **게시판 목록 페이지**일 때 이렇게 된다(실측으로 3,068 → 207자).
     한쪽 숫자만 보이면 '원문을 다 받았다'고 잘못 읽는다. 걷기 전 원문도 열어 볼 수 있게 둔다. */
  const thin = stripped && raw.length > 1200 && body.length < raw.length * 0.2;
  return `<div class="field">
      <label>저장해 둔 공고 원문 — 원문 그대로 (${body.length.toLocaleString()}자${
  stripped ? ` · 학교 홈페이지 메뉴 걷어내기 전 ${raw.length.toLocaleString()}자` : ''}${
  isCut(src) ? ' · 뒷부분이 잘려 있습니다' : ''})</label>
      <div class="src-body" tabindex="0" role="region" aria-label="저장해 둔 공고 원문">${esc(body)}</div>
      ${thin ? `<p class="hint">🔴 걷어내고 남은 글자가 많이 줄었습니다. 저장된 쪽이 공고 상세가 아니라
        <b>게시판 목록</b>일 수 있습니다 — 위 '원문 공고 열기'로 확인하세요.</p>` : ''}
      ${stripped ? `<details><summary class="hint">걷어내기 전 원문 보기</summary>
        <div class="src-body" tabindex="0">${esc(raw)}</div></details>` : ''}
      <p class="hint">여기 글자는 로봇이 받아 둔 원문입니다. 이 화면이 옳다·그르다를 판단하지 않습니다.</p>
    </div>`;
}

function detailSheet(itRaw) {
  /* 🔴 **모아 둔 수정을 얹어서 보여 준다.** 안 그러면 다시 열었을 때 칸이 옛 값으로 보이고,
     거기서 다시 저장하면 모아 둔 것을 **조용히 덮어쓴다**(코드 리뷰가 잡았다 —
     2026-12-31 로 모아 둔 뒤 다시 열면 2026-09-15 가 보였고, 저장하면 그 값이 나갔다).
     ⚠️ 얹는 것은 화면에 보여 줄 때뿐이다 — `D.reg` 는 건드리지 않는다(저장소가 진짜다). */
  const staged = PENDING_EDITS.get(itRaw.id);
  const it = staged ? { ...itRaw, ...staged } : itRaw;
  currentSheetItem = itRaw;
  const fi = formIdSet();
  const ps = problemsOf(it, fi);
  const st = statusOf(it);
  const url = safeUrl(it.sourceUrl);
  const e = it.eligibility || {};
  const exc = it.exclusivity || {};   // 이중수혜 — 없으면 빈 객체(칸이 비어 뜬다)

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
    /* 여러 줄 칸 — 앱이 배열로 읽는 것(서류·제외 대상·우선 기준)을 한 줄에 하나씩 보여 준다.
       🔴 쉼표로 잇지 말 것 — 서류 이름에 쉼표가 들어간다(`성적증명서(1,2학기)`).
          저장소 쪽 cleanLines 도 줄바꿈으로 가른다. */
    if (type === 'lines') {
      const text = Array.isArray(v) ? v.join('\n') : String(v || '');
      return `<div class="field"><label for="ed-${k}">${esc(label)}</label>
        <textarea id="ed-${k}" data-ed="${k}" data-lines rows="4"
          placeholder="한 줄에 하나씩">${esc(text)}</textarea></div>`;
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
      <div class="pane" data-pane="app">
        <h4>앱1에 나가는 내용 (고칠 수 있습니다)</h4>
        <div class="pane-body">
          ${(() => {
    /* 🔴 **모르는 것이 곧 입력칸으로 선다** (2026-09-13).
       실측: 검수 대기 14건 중 10건이 마감일·금액을 **둘 다** 모르고, 경고등 없이 그냥
       눌러 넘길 수 있는 것은 1건뿐이었다. 예전에는 '금액 미확인'·'마감일 없음' 이라는
       배지를 줄마다 읽은 뒤, 시트를 열어 21칸 중에서 그 칸을 찾아야 했다.
       이제 **비어 있는 칸을 맨 위로** 올린다 — 무엇을 하면 되는지가 곧 화면이 된다.
       ⚠️ 값을 지어내지 않는다. 빈 칸을 보여 줄 뿐이고, 채우는 것은 사람이다(원칙 8-1). */
    const KEY = new Set(['deadline', 'amount', 'amountValue']);
    const missing = EDIT_FIELDS.filter(([k]) => KEY.has(k)
      && (it[k] == null || it[k] === '' || (k === 'amountValue' && !it[k])));
    const rest = EDIT_FIELDS.filter((f) => !missing.includes(f));
    return `${missing.length ? `<div class="field-first">
        <label class="field-first-h">먼저 채울 것 ${missing.length}칸 — 지금 비어 있습니다</label>
        ${missing.map(field).join('')}
        <p class="hint">오른쪽 공고 원문에서 찾아 적으세요. <b>확인하지 못한 값을 짐작해 넣지 마세요.</b></p>
      </div>` : ''}${rest.map(field).join('')}`;
  })()}
          <div class="field">
            <label>자격 — 기계 판정용 (매칭·알림이 이 값을 봅니다)</label>
            <div class="grid2">
              <div class="field"><label for="eg-schoolOnly">학교 한정</label>
                <input type="text" id="eg-schoolOnly" data-eg="schoolOnly" value="${esc(e.schoolOnly || '')}"
                  placeholder="비우면 전국" /></div>
              <div class="field"><label for="eg-campusOnly">캠퍼스</label>
                <input type="text" id="eg-campusOnly" data-eg="campusOnly" value="${esc(e.campusOnly || '')}" /></div>
              <div class="field"><label for="eg-years">학년</label>
                <input type="text" id="eg-years" data-eg="years" value="${esc((e.years || []).join(','))}"
                  placeholder="예: 1,2" /></div>
              <div class="field"><label for="eg-tracks">계열</label>
                <input type="text" id="eg-tracks" data-eg="tracks" value="${esc((e.tracks || []).join(','))}"
                  placeholder="쉼표로 구분" /></div>
              <div class="field"><label for="eg-minGpa">최저 성적</label>
                <input type="text" id="eg-minGpa" data-eg="minGpa" value="${esc(e.minGpa != null ? e.minGpa : '')}"
                  placeholder="예: 3.5" /></div>
              <div class="field"><label for="eg-maxBracket">소득 구간(이하)</label>
                <input type="text" id="eg-maxBracket" data-eg="maxBracket" value="${esc(e.maxBracket != null ? e.maxBracket : '')}"
                  placeholder="예: 8" /></div>
            </div>
            <p class="hint">비우면 그 조건은 없는 것으로 봅니다. <b>확인하지 못한 값을 짐작해 넣지 마세요</b> —
              틀린 자격 판정은 '모른다'보다 나쁩니다(자격도 안 되는 학생이 서류를 준비하게 됩니다).</p>


            <!-- 🔴 이중수혜·자유 형식 — 둘 다 **원문 문장을 근거로 적어야** 저장된다 (2026-09-14).
                 저장소 쪽(admin-apply.mjs)이 그 문장을 저장된 공고 원문에서 그대로 찾아 확인하고,
                 못 찾으면 거부한다. 화면이 지어낸 값으로 학생 판정을 바꾸지 못하게 하는 자리다. -->
            <label style="margin-top:10px">함께 못 받는 범위 — 이중수혜</label>
            <div class="field">
              <select id="ex-scope" data-ex-scope>
                <option value="">정하지 않음 (칸을 비움)</option>
                <option value="external"${exc.scope === 'external' ? ' selected' : ''}>교외 민간 장학금 전부와 중복 불가</option>
                <option value="narrow"${exc.scope === 'narrow' ? ' selected' : ''}>좁은 범위만 중복 불가 (특정 사업 등)</option>
              </select>
              <textarea id="ex-raw" data-ex-raw rows="2"
                placeholder="근거가 된 원문 문장을 그대로 복사해 주세요">${esc(exc.raw || '')}</textarea>
              <p class="hint">원문에 <b>한정어가 없으면</b>(예: “타 대외 장학금과 중복 수혜 불가”) 교외 전부이고,
                “타 인재양성사업” 처럼 <b>대상을 좁히면</b> 좁은 범위입니다.
                넓게 잘못 고르면 학생 화면의 받을 수 있는 금액이 줄어듭니다.</p>
            </div>

            <label style="margin-top:10px">앱에서 준비문서를 만들어 줄까요 — 자유 형식 제출</label>
            <div class="field">
              <label class="row-check"><input type="checkbox" id="pd-on" data-pd${it.prepDoc ? ' checked' : ''} />
                <span>이 공고는 <b>지정 양식이 없고 자유 형식으로 낸다</b>고 원문에서 확인했습니다</span></label>
              <textarea id="pd-basis" data-pd-basis rows="2"
                placeholder="자유 형식 제출이라고 적힌 원문 문장을 그대로 복사해 주세요">${esc(it.prepDocBasis || '')}</textarea>
              <p class="hint">체크하면 학생 화면에 ‘준비용 문서 만들기’가 생깁니다.
                <b>제출할 수 없는 공고에 붙이면 학생이 헛일을 합니다</b> — 원문에서 확인한 것만 켜세요.</p>
            </div>
            <label style="margin-top:10px">학생에게 보여 줄 자격 문장</label>
            ${(() => {
    /* 후보 = 공고 원문에서 뽑아 둔 조각(excerpts, 문자열 배열) + 이미 담아 둔 문장.
       excerpts에는 첨부 파일명 같은 것도 섞여 있으므로 **사람이 골라야 한다** —
       기계가 알아서 고르면 그게 곧 '추론'이다(운영 원칙 8-1). */
    const cand = [...new Set([...(it.eligibilityLines || []), ...(it.excerpts || [])])]
      .map((l) => String(l).trim()).filter((l) => l.length > 3).slice(0, 24);
    if (!cand.length) return '<p class="hint">이 공고는 원문 발췌가 없습니다. 아래에 직접 적으면 <b>사람이 입력</b>으로 남습니다.</p>';
    return `<div class="pick-lines">
        <p class="hint">공고 원문에서 뽑아 둔 조각입니다. 첨부 파일명 같은 것도 섞여 있으니
          <b>진짜 자격 문장만 체크</b>하세요. 체크한 것만 학생 화면에 그대로 나갑니다.</p>
        ${cand.map((l, i) => `<label class="pick-line">
          <input type="checkbox" data-eline="${i}" value="${esc(l)}"
            ${(it.eligibilityLines || []).includes(l) ? 'checked' : ''} />
          <span>${esc(l)}</span></label>`).join('')}
      </div>`;
  })()}
            <div class="field">
              <label for="eg-lines">직접 입력 (한 줄에 하나)</label>
              <textarea id="eg-lines" data-eg-lines rows="3"
                placeholder="원문에 있는 문장을 그대로 옮겨 적으세요">${esc((it.eligibilityLines || []).join('\n'))}</textarea>
            </div>
            <label class="gate-check" style="margin-top:6px">
              <input type="checkbox" id="eg-verified" data-eg-verified ${it.eligibilityVerified ? 'checked' : ''} />
              <span>원문에서 <b>'자격 제한 없음'을 실제로 확인했다</b>
                <em>— 체크해야 앱이 "별도 자격 제한이 없는 공고예요"라고 확신해서 말합니다.
                  확인하지 않았으면 비워 두세요(그러면 "원문에서 확인하세요"로 정직하게 나갑니다).</em></span>
            </label>
          </div>
        </div>
      </div>

      <div class="pane" data-pane="source">
        <h4>공고 원문 — 지어내지 않고 그대로</h4>
        <div class="pane-body">
          ${url ? `<a class="btn btn-sm" href="${esc(url)}" target="_blank" rel="noreferrer noopener">원문 공고 열기 ↗</a>`
    : '<p class="muted">원문 주소가 없습니다.</p>'}
          ${(it.excerpts || []).length
    ? `<div class="field"><label>뽑아 둔 발췌</label>
        ${(it.excerpts || []).map((x) => `<div class="excerpt">${esc(x)}</div>`).join('')}</div>`
    : ''}
          <div id="src-slot">${sourceBlock(it)}</div>
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

    <p class="muted">저장을 누르면 검사를 거쳐 반영됩니다. 검사를 통과하지 못하면 아무것도 바뀌지 않습니다.</p>
    <div class="btn-row sheet-foot">
      <button class="btn btn-primary" data-act="save" data-id="${esc(it.id)}">수정 내용 저장</button>
      ${(() => {
    const pos = sheetPos(it.id);
    const nx = sheetNext(it.id);
    if (!pos) return '';
    return nx
      ? `<button class="btn" data-act="next" data-id="${esc(it.id)}">다음 공고 ▸</button>
         <span class="hint" style="align-self:center">${pos.n} / ${pos.of}</span>`
      : `<span class="hint" style="align-self:center">${pos.n} / ${pos.of} — 마지막입니다</span>`;
  })()}
      ${st === 'unreviewed'
    ? `<button class="btn good" data-act="confirm" data-id="${esc(it.id)}">검수 완료로 컨펌</button>
         <button class="btn danger" data-act="revert" data-id="${esc(it.id)}">잘못 등록됨 — 되돌리기</button>`
    : ''}
      <button class="btn danger" data-act="remove" data-id="${esc(it.id)}">등록 삭제</button>
    </div>
  `;
}

/* 아무것도 안 쓴 상태의 답변 묶음 — forms.js의 renderFormDoc은 항목마다 답변이
   있다고 가정하므로(체크·시간표는 객체), 빈 문서를 그리려면 이 모양을 맞춰 줘야 한다. */
function blankAnswers(tpl) {
  const ans = {};
  (tpl.sections || []).forEach((sec) => {
    (sec.fields || []).forEach((f) => {
      /* 🔴 새 필드 타입이 생기면 여기도 같이 늘려야 한다 — 안 그러면 모양이 안 맞아
         미리보기가 빈 칸을 찍거나 터진다. 판정은 forms.js와 같은 규칙(formAnswerFor)을 쓴다 */
      if (typeof formAnswerFor === 'function') { ans[f.id] = formAnswerFor(f, undefined); return; }
      if (f.type === 'checks' || f.type === 'checks+text' || f.type === 'choice') ans[f.id] = { checks: [], text: '' };
      else if (f.type === 'schedule') ans[f.id] = { days: [], time: '' };
      else if (f.type === 'group') { ans[f.id] = {}; (f.sub || []).forEach((sf) => { ans[f.id][sf.id] = ''; }); }
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
      ${/^auto-/.test(id) ? '<span class="pill warn">로봇이 만든 양식 — 원본 대조 필요</span>' : ''}
    </div>

    ${/* 원본을 열 수 있어야 대조가 된다. 이 링크가 없던 동안은 "원본과 같은지 확인해 주세요"라는
        리포트 문구만 있고 **원본으로 가는 길이 화면에 없었다**(2026-08-14 개발자 지적). */ ''}
    ${used.length ? `<div class="filter-row">
      ${safeUrl(used[0].sourceUrl) ? `<a class="btn btn-sm" href="${esc(safeUrl(used[0].sourceUrl))}"
          target="_blank" rel="noreferrer noopener">공고 원문 ↗</a>` : ''}
      ${(used[0].attachments || []).filter((a) => safeUrl(a.url)).map((a) => `<a class="btn btn-sm"
          href="${esc(safeUrl(a.url))}" target="_blank" rel="noreferrer noopener"
          title="${esc(a.name || '')}">📎 ${esc((a.name || '첨부').slice(0, 28))}</a>`).join('')}
    </div>
    <p class="muted">위 원본과 아래 미리보기를 나란히 놓고 <b>항목이 빠지지 않았는지</b> 보세요 —
      로봇이 만든 양식에서 인적사항 블록이 통째로 빠지는 경우가 실제로 있었습니다.</p>` : ''}

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
      <div class="rows" data-rows>${used.map(rowHtml).join('')}</div>` : ''}
  `;
}

/* ---------------- 동작 연결 ---------------- */
function collectEdits() {
  const patch = {};

  /* ── 자격 (D단계) ──────────────────────────────────────────
     🔴 **기계 판정용(eligibility)과 사람이 읽는 문장(eligibilityLines)을 섞지 않는다.**
     매칭·알림·홈 합계는 전부 eligibility를 본다. 여기에 자유 문장이 들어가면
     판정이 조용히 망가진다. 저장소 쪽(admin-apply.mjs)에서도 한 번 더 걸러낸다. */
  const eg = {};
  let egTouched = false;
  $$('#sheet [data-eg]').forEach((el) => {
    egTouched = true;
    const v = (el.value || '').trim();
    if (v) eg[el.dataset.eg] = v;
  });
  if (egTouched) {
    /* selective는 화면에서 고치는 값이 아니다 — 원래 값을 그대로 지킨다 */
    const cur = (currentSheetItem && currentSheetItem.eligibility) || {};
    if (cur.selective) eg.selective = true;
    patch.eligibility = eg;
  }

  const lines = [];
  $$('#sheet [data-eline]:checked').forEach((el) => lines.push(el.value));
  const typed = byId('eg-lines');
  if (typed) String(typed.value || '').split('\n').forEach((l) => { if (l.trim()) lines.push(l.trim()); });
  if (typed || $$('#sheet [data-eline]').length) patch.eligibilityLines = [...new Set(lines)];

  const ver = byId('eg-verified');
  if (ver) patch.eligibilityVerified = ver.checked;

  $$('#sheet [data-ed]').forEach((el) => {
    const k = el.dataset.ed;
    let v = el.value;
    if (k === 'amountValue') v = Number(v) || 0;
    /* 🔴 여러 줄 칸은 **배열로 보낸다** (2026-09-14). 글자 그대로 보내면 모아 둔 수정을
       시트에 다시 얹을 때 `it.documents` 가 문자열이 되어, 그 칸을 배열로 읽는 다른 자리가
       `(it.documents || []).map is not a function` 으로 죽는다 — 시트가 아예 안 열렸다.
       저장소 쪽 cleanLines 는 둘 다 받지만, **화면 안에서도 모양이 같아야** 한다. */
    if (el.dataset.lines !== undefined) {
      const arr = String(v || '').split('\n').map((x) => x.trim()).filter(Boolean);
      patch[k] = arr.length ? arr : null;
      return;
    }
    if (v === '' && k !== 'note' && k !== 'summary') v = null;
    patch[k] = v;
  });

  /* ── 이중수혜 · 자유 형식 제출 (2026-09-14) ──────────────────────────
     🔴 둘 다 **근거 문장을 같이 보낸다** — 저장소 쪽이 저장된 공고 원문에서 그대로 찾아
        확인하고 못 찾으면 거부한다. 화면이 지어낸 값으로 학생 판정을 바꾸지 못하게 하는 자리다.
     🔴 범위를 비우면 `null` 을 보내 **칸을 지운다**(로봇에게 돌려준다 — 다음 수집 때 원문에서 다시 읽는다). */
  const exScope = $('#sheet [data-ex-scope]');
  if (exScope) {
    const raw = (($('#sheet [data-ex-raw]') || {}).value || '').trim();
    patch.exclusivity = exScope.value ? { kind: 'forbidden', scope: exScope.value, raw } : null;
  }
  const pd = $('#sheet [data-pd]');
  if (pd) {
    patch.prepDoc = pd.checked ? true : null;
    if (pd.checked) patch.prepDocBasis = (($('#sheet [data-pd-basis]') || {}).value || '').trim();
  }
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
    if (await handleInstaClick(e)) return;   // 인스타 화면의 버튼 (2026-09-12)

    /* 모아 둔 수정 — 이 버튼은 **머리줄에 있어 시트 밖**이다.
       🔴 시트 핸들러(#sheet)에 두면 영영 안 눌린다(만들면서 실제로 그렇게 만들었다가 잡았다). */
    const fl = e.target.closest('[data-act="flush"], [data-act="flush-drop"]');
    if (fl) {
      if (fl.dataset.act === 'flush') await flushEdits();
      else { pendingClear(); toast('모아 둔 수정을 버렸습니다'); }
      renderPendingBar();
      return;
    }

    /* 저장된 공고 원문을 못 받았을 때 다시 읽기 */
    if (e.target.closest('[data-src-rescan]')) {
      SRC_STATE = 'idle'; SRC_PROMISE = null;
      await openSrcScan();
      return;
    }

    /* 교외 · 학교 한정 — 고른 것을 전국으로 (🔴 누르는 것은 사람이다) */
    const pickScope = e.target.closest('[data-scope-pick]');
    if (pickScope) { e.stopPropagation(); return; }     // 체크만 한다 — 다시 그리지 않는다
    if (e.target.closest('[data-scope-go]')) {
      const ids = $$('[data-scope-pick]:checked').map((el) => el.dataset.scopePick);
      if (!ids.length) { toast('먼저 공고를 고르세요'); return; }
      goNationwide(ids);
      return;
    }

    const lv = e.target.closest('[data-lview]');
    if (lv) { LIST_VIEW = lv.dataset.lview; rerender('list'); return; }

    const go = e.target.closest('[data-go]');
    if (go) {
      if (go.dataset.goView) LIST_VIEW = go.dataset.goView;   // '양식 보기' 처럼 보기까지 정해 주는 버튼
      show(go.dataset.go);
      return;
    }

    /* 체크박스는 상세를 열지 않는다 — 줄을 누르면 상세, 네모를 누르면 선택 */
    const pick = e.target.closest('[data-pick]');
    if (pick) {
      e.stopPropagation();
      if (pick.checked) SEL.add(pick.dataset.pick); else SEL.delete(pick.dataset.pick);
      refreshSelBar();          // 목록 전체를 다시 그리지 않는다(스크롤 위치가 날아간다)
      return;
    }

    const row = e.target.closest('[data-row][data-id]');
    if (row) {
      const it = D.reg.find((x) => x.id === row.dataset.id);
      /* 🔴 지금 **보이는 줄 순서**를 그대로 큐로 삼는다 — 접힌 것은 빼야
         '다음 공고' 가 안 보이던 줄로 건너뛰지 않는다. */
      const screen = row.closest('section.screen') || document;
      sheetQueueSet([...screen.querySelectorAll('[data-row][data-id]')]
        .filter((el) => el.offsetParent !== null)
        .map((el) => el.dataset.id));
      if (it) openDetail(it);
      return;
    }

    /* 미리보기 버튼이 먼저다 — 같은 줄에 링크(원문·첨부)가 들어오면서, 링크를 누른 것까지
       줄 클릭으로 잡아 시트가 함께 열리는 일이 생긴다. 링크는 그냥 통과시킨다. */
    const fbtn = e.target.closest('[data-form-preview]');
    if (fbtn) { openSheet(formSheet(fbtn.dataset.formPreview)); return; }
    if (e.target.closest('tr[data-form] a')) return;
    const frow = e.target.closest('tr[data-form]');
    if (frow) { openSheet(formSheet(frow.dataset.form)); return; }

    const f = e.target.closest('[data-f]');
    if (f) { F[f.dataset.f] = f.dataset.v; rerender('list'); return; }

    const so = e.target.closest('[data-sort]');
    if (so) {
      const k = so.dataset.sort;
      if (F.sort === k) F.dir = F.dir === 'asc' ? 'desc' : 'asc';
      else { F.sort = k; F.dir = SORTS[k].dir || 'asc'; }
      rerender('list');
      return;
    }

    const clr = e.target.closest('[data-clear]');
    if (clr) {
      const k = clr.dataset.clear;
      if (k === '*') Object.keys(FILTER_LABEL).forEach((x) => { F[x] = 'all'; });
      else F[k] = 'all';
      rerender('list');
      return;
    }

    const mg = e.target.closest('[data-merge]');
    if (mg) {
      const [keepId, dropId] = mg.dataset.merge.split('|');
      const keep = D.reg.find((x) => x.id === keepId), drop = D.reg.find((x) => x.id === dropId);
      askSheet({
        title: '중복 공고 합치기', danger: true, goLabel: '합치기',
        note: '아래 두 번째 공고를 등록에서 지웁니다. 되돌리려면 git 기록을 봐야 합니다.',
        lines: [
          { t: `남길 것 — ${keep ? keep.name : keepId}`, m: keepId },
          { t: `지울 것 — ${drop ? drop.name : dropId}`, m: dropId },
        ],
        run: () => applyAction('merge', { keepId, dropId }, '중복 합치기'),
      });
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

    /* 로봇 통제판의 '지금 실행' — 어떤 로봇이든 같은 경로로 돈다 */
    /* 원인 한 줄에 붙은 '이 N건 고치기' — 로봇을 그 자리에서 깨운다.
       🔴 '파일을 고쳐서 push 하세요' 라는 말을 화면에서 없애기 위한 자리다. */
    const fix = e.target.closest('[data-fixrun]');
    if (fix) {
      const file = fix.dataset.fixrun;
      const plan = (FIX_PLAN[file] || {})[fix.dataset.fixplan || 'main'] || null;
      const robot = ROBOTS.find((r) => r.f === file);
      const inputs = { ...((plan && plan.inputs) || {}) };
      if (plan && plan.arg && fix.dataset.fixarg) inputs[plan.arg] = fix.dataset.fixarg;
      /* 돈이 나가는 로봇은 **금액을 글자로** 한 줄 더 보여 준다 — 되돌릴 수 없다 */
      const extra = (plan && plan.cost)
        ? [{ t: `이 로봇은 돈이 나갑니다 — ${plan.cost}`, m: '실행하면 취소할 수 없습니다' }]
        : [];
      await runCollector(file, robot ? robot.n : file, inputs, extra);
      return;
    }

    const run = e.target.closest('[data-run]');
    if (run) {
      const file = run.dataset.run;
      const spec = ROBOTS.find((x) => x.f === file) || {};
      const inputs = {};
      /* ⚠️ `CSS.escape` 를 빼지 말 것 — 파일 이름의 `-`·`.` 때문에 선택자가 어긋난다 */
      for (const el of $$(`[data-run-input="${CSS.escape(file)}"]`)) {
        const key = el.dataset.runKey;
        const spec1 = (spec.inputs || []).find((i) => i.name === key) || {};
        const v = String(el.value || '').trim();
        if (spec1.kind === 'url' && v && !/^https?:\/\//i.test(v)) {
          jobShow('http 로 시작하는 주소를 넣어 주세요', 'bad'); el.focus(); return;
        }
        if (spec1.kind === 'num' && v && !/^\d+$/.test(v)) {
          jobShow('숫자만 넣어 주세요', 'bad'); el.focus(); return;
        }
        /* 🔴 빈 값은 **보내지 않는다** — `mode:''` 를 던지면 고르는 상자가 거부당한다.
           키 자체를 빼야 워크플로의 기본값이 이긴다. */
        if (v) inputs[key] = v;
      }
      const need = (spec.inputs || []).filter((i) => i.required && !inputs[i.name]);
      if (need.length) { jobShow(`${need[0].label} 를 먼저 채우세요`, 'bad'); return; }
      await runCollector(file, run.dataset.runName || '로봇', inputs);
      return;
    }

    if (e.target.closest('#btn-run-collect')) {
      await runCollector(WF_COLLECT, '일반 수집 로봇'); return;
    }
    if (e.target.closest('#btn-run-browser')) {
      await runCollector(WF_BROWSER, '브라우저형 수집 로봇'); return;
    }
    /* 🔴 막아 둔 공고를 푼다 (2026-09-14). 저장소 쪽 unblock 은 id 로 풀면서
       **막을 때 적어 둔 짝(blockPairs)으로 주소까지** 같이 푼다 — 한쪽만 풀면
       로봇이 주소로 계속 막아 그 공고가 영영 다시 등록되지 않는다. */
    const unb = e.target.closest('[data-unblock]');
    if (unb) {
      const bid = unb.dataset.unblock;
      askSheet({
        title: '재등록 차단 풀기', goLabel: '풀기',
        lines: [bid],
        note: '이 공고를 로봇이 다시 담을 수 있게 됩니다. 다음 수집 때 후보로 올라옵니다.',
        run: () => applyAction('unblock', { ids: [bid] }, '차단 풀기'),
      });
      return;
    }
    if (e.target.closest('[data-auto-toggle]')) {
      const next = !D.autoCfg.enabled;
      askSheet({
        title: next ? '자동 등록 로봇 켜기' : '자동 등록 로봇 끄기',
        goLabel: next ? '켜기' : '끄기', danger: !next,
        note: next
          ? '로봇이 보수적 규칙을 통과한 공고를 스스로 등록합니다. 앱에는 "검수 전" 배지가 붙습니다.'
          : '로봇이 등록을 멈추고 리포트만 올립니다. 새 공고가 학생 앱에 자동으로 나가지 않게 됩니다.',
        run: () => applyAction('autoRegister', { enabled: next }, next ? '자동 등록 켜기' : '자동 등록 끄기'),
      });
      return;
    }
    /* 행에서 바로 컨펌 — 문제 없는 공고까지 시트를 열었다 닫을 이유가 없다 */
    const qc = e.target.closest('[data-quick-confirm]');
    if (qc) {
      e.stopPropagation();
      await applyAction('confirm', { ids: [qc.dataset.quickConfirm] }, '컨펌');
      return;
    }

    /* 양식 큐 조작 (D2) */
    const fq = e.target.closest('[data-fq]');
    if (fq) {
      const op = fq.dataset.fq, id = fq.dataset.fqId;
      const q = D.pending.find((x) => x.id === id);
      askSheet({
        title: op === 'retire' ? '자동 재시도 멈추기' : '다시 받기',
        goLabel: op === 'retire' ? '멈추기' : '다시 받기', danger: op === 'retire',
        note: op === 'retire'
          ? '로봇이 이 공고의 양식 원본을 더 이상 받으려 하지 않습니다. 리포트에는 계속 표시됩니다.'
          : '다음 수집 때 원본을 다시 받아 봅니다.',
        lines: [{ t: (q && q.name) || id, m: id }],
        run: () => applyAction('formQueue', { ids: [id], op },
          op === 'retire' ? '자동 재시도 중단' : '다시 받기'),
      });
      return;
    }

    const ul = e.target.closest('[data-unlink]');
    if (ul) {
      const list = ul.dataset.unlink.split(',').filter(Boolean);
      askSheet({
        title: '없는 양식 연결 끊기', goLabel: '연결 끊기', danger: true,
        note: '가리키던 양식이 실제로 없는 공고들입니다. 연결을 끊으면 학생 화면에서 '
          + "'앱에서 작성' 대신 원문 안내로 바뀝니다. 양식이 실제로 있으면 저장 단계에서 막힙니다.",
        lines: list.map((id) => {
          const it = D.reg.find((x) => x.id === id);
          return { t: (it && it.name) || id, m: `${id} → ${(it && it.formId) || ''}` };
        }),
        run: () => applyAction('unlinkForm', { ids: list }, '양식 연결 끊기'),
      });
      return;
    }

    /* 등록 시트 열기 */
    const ro = e.target.closest('[data-reg-open]');
    if (ro) {
      e.stopPropagation();
      const n = D.notices.find((x) => x.url === ro.dataset.regOpen);
      if (n) openSheet(registerSheet(n));
      return;
    }

    /* 잘린 목록 더 보기 */
    const mr = e.target.closest('[data-more]');
    if (mr) {
      const k = mr.dataset.more;
      MORE[k] = shown(k, Number(mr.dataset.base) || STEP) + STEP;
      rerender();
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
      rerender('review');
      return;
    }
  });

  /* 필터 입력 */
  /* 키보드로 목록·표를 여는 길 — Enter와 Space 둘 다 받는다(버튼의 표준 동작).
     Space는 기본 동작이 '스크롤'이라 막아야 한다. */
  byId('app').addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
    const t = e.target;
    if (!t || !t.matches || !t.matches('[role="button"][tabindex="0"]')) return;
    e.preventDefault();
    t.click();
  });

  /* 탭 줄을 좌우 화살표로 넘긴다 (읽어 주기 사용자의 표준 조작) */
  byId('tabs').addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const tabs = $$('.tab');
    const i = tabs.indexOf(document.activeElement);
    if (i < 0) return;
    e.preventDefault();
    const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
    next.focus(); next.click();
  });

  /* '필터 더보기'를 펼친 상태를 기억한다. 안 그러면 필터를 하나 고를 때마다
     다시 그려지면서 접혀 버려 연달아 고를 수가 없다.
     (toggle 이벤트는 버블링하지 않으므로 캡처 단계로 받는다) */
  byId('app').addEventListener('toggle', (e) => {
    if (e.target.classList && e.target.classList.contains('filters-more')) F.open = e.target.open;
  }, true);

  byId('app').addEventListener('change', (e) => {
    if (e.target.id === 'f-school') { F.school = e.target.value; rerender('list'); }
    if (e.target.id === 'f-nature') { F.nature = e.target.value; rerender('list'); }
  });
  let qTimer = null;
  byId('app').addEventListener('input', (e) => {
    if (e.target.id !== 'f-q') return;
    clearTimeout(qTimer);
    const v = e.target.value;
    /* 초점·커서 복구는 rerender가 한다 — 예전엔 이 칸만 손으로 되살리고 있었다 */
    qTimer = setTimeout(() => { F.q = v; rerender('list'); }, 250);
  });

  /* 시트 */
  byId('sheet').addEventListener('click', async (e) => {
    if (e.target.closest('[data-close]')) { closeSheet(); return; }

    /* 확인 시트의 '실행' — 담아 둔 일을 여기서 꺼내 돌린다 */
    if (e.target.closest('[data-ask-go]')) {
      const go = pendingGo;
      pendingGo = null;
      closeSheet();
      if (go) await go();
      return;
    }

    /* 등록 실행 */
    const rg = e.target.closest('[data-reg-go]');
    if (rg) {
      const n = D.notices.find((x) => x.url === rg.dataset.regGo);
      if (!n) { toast('공고를 찾지 못했습니다'); return; }
      const patch = {};
      $$('#sheet [data-rg]').forEach((el) => {
        const v = (el.value || '').trim();
        if (v) patch[el.dataset.rg] = v;
      });
      if (!patch.name || patch.name.length < 8) { toast('제목이 너무 짧습니다'); return; }
      closeSheet();
      await applyAction('register', { notice: n, patch }, '정식 등록');
      return;
    }

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

    const row = e.target.closest('[data-row][data-id]');
    if (row) {
      const it = D.reg.find((x) => x.id === row.dataset.id);
      if (it) openDetail(it);
      return;
    }

    const act = e.target.closest('[data-act]');
    if (!act) return;
    const id = act.dataset.id;
    const kind = act.dataset.act;

    if (kind === 'next') {
      const nx = sheetNext(id);
      if (nx) openDetail(nx);
      else toast('마지막 공고입니다');
      return;
    }

    if (kind === 'src-retry') {
      SRC_STATE = 'idle';
      const cur = D.reg.find((x) => x.id === id);
      if (cur) openDetail(cur);
      return;
    }

    if (kind === 'save') {
      const patch = collectEdits();
      closeSheet();
      /* 🔴 바로 보내지 않는다 — 위 '모아 두는 수정' 주석 참조. 한 건만 고칠 때도
         '한꺼번에 반영'을 누르면 되므로 조작은 한 번 더 늘지 않는다(바로 옆에 뜬다). */
      PENDING_EDITS.set(id, patch);
      renderPendingBar();
      toast(`수정을 모아 뒀습니다 (${pendingCount()}건) — '한꺼번에 반영'을 누르면 한 번에 저장됩니다`);
      return;
    }

    if (kind === 'confirm') {
      closeSheet();
      await applyAction('confirm', { ids: [id] }, '컨펌');
    } else if (kind === 'revert') {
      const it = D.reg.find((x) => x.id === id);
      askSheet({
        title: '등록에서 빼고 재등록 차단', danger: true, goLabel: '되돌리기',
        note: '등록에서 빠지고, 수집 로봇이 다시 등록하지 않도록 차단 목록에 올라갑니다.',
        lines: [{ t: it ? it.name : id, m: id }],
        run: () => applyAction('revert', { ids: [id] }, '되돌리기'),
      });
    } else if (kind === 'remove') {
      const it = D.reg.find((x) => x.id === id);
      askSheet({
        title: '등록 삭제', danger: true, goLabel: '삭제',
        note: '등록에서 지웁니다. 차단은 하지 않으므로 로봇이 다시 등록할 수 있습니다.',
        lines: [{ t: it ? it.name : id, m: id }],
        run: () => applyAction('remove', { ids: [id] }, '등록 삭제'),
      });
    }
  });
  byId('sheet-back').addEventListener('click', closeSheet);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheet(); });
  document.addEventListener('keydown', trapFocus);

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
  byId('btn-density').addEventListener('click', cycleDensity);

  /* 화면 폭이 바뀌면 헤더 높이도 표가 넘치는지 여부도 달라진다 —
     가로로 돌리거나 창을 줄였을 때 구획 제목이 헤더에 가리거나
     안내가 남아 있는 일을 막는다. */
  window.addEventListener('resize', () => {
    measureHead();
    markScrollers(byId(`screen-${current}`));
    const sheet = byId('sheet');
    if (sheet && !sheet.hidden) markScrollers(sheet);
  });

  /* 🔴 모아 둔 수정을 **기기에 저장하지 않는다**(위 PENDING_EDITS 주석) — 남겨 두면
     '반영한 줄 알았는데 안 된' 상태가 조용히 이어진다. 그래서 지키는 방법은 이 경고 하나뿐이다.
     ⚠️ 문구는 브라우저가 정한다(우리 글자는 안 뜬다) — `returnValue` 는 '물어봐 달라'는 신호일 뿐. */
  window.addEventListener('beforeunload', (e) => {
    if (!pendingCount()) return;
    e.preventDefault();
    e.returnValue = '';
  });
}

async function runCollector(file, label, inputs = {}, extraLines = []) {
  const extra = Object.entries(inputs).map(([k, v]) => ({ t: k, m: v }));
  askSheet({
    title: `${label} 지금 실행`, goLabel: '실행',
    note: '몇 분 걸립니다. 수집 계열은 같은 학교를 짧은 시간에 여러 번 두드리면 '
      + '학교 서버가 막아 멀쩡한 주소까지 실패로 뜰 수 있습니다.',
    lines: [...extraLines, { t: label, m: file }, ...extra],
    run: () => reallyRun(file, label, inputs),
  });
}

async function reallyRun(file, label, inputs = {}) {
  try {
    jobShow(`${label} 실행을 요청했어요`);
    await dispatchWorkflow(file, inputs);
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
  measureHead();

  /* 읽어들인 데이터와 미리보기 함수를 한 곳에 노출한다 —
     검증 드라이버(verify/verify-admin.js)와 브라우저 콘솔에서 상태를 들여다볼 때 쓴다.
     열쇠를 통과한 뒤에만 만들어지므로 이것으로 잠금이 느슨해지지는 않는다. */
  window.__admin = { D, previewDoc, blankAnswers, statusOf, badgesOf, channelOf, naturesOf,
    renderDataFail, pendingForms, loadRobotIssues, loadPushHealth,
    /* 저장해 둔 공고 원문 (2026-09-13) — 검사가 '몇 건에 원문이 뜨는가'를 셀 수 있어야
       빈 목록을 상대로 조용히 통과하는 일이 없다. */
    ensureSources, storedSource, srcState: () => SRC_STATE,
    /* 모아 둔 수정 — 검사가 '보내기 전에는 안 보낸다'를 확인한다 */
    pendingCount,
    /* 반영 전 전후 대조·C2 (2026-09-14) — 검사가 **화면이 센 것**과 저장소 계산을 대 볼 수 있게.
       🔴 검사용 창구일 뿐 화면 동작은 여기 없다(규칙을 두 벌로 만들지 않는다). */
    pendingMap: () => PENDING_EDITS, flushPlan, goNationwide, scopeWideItems, noEligItems, scopeCount,
    robots: () => ROBOTS, jobBusy: () => jobBusy };
}

function boot() {
  applyDensity(currentDensity());
  current = screenFromHash() || current;   // 주소로 들어온 화면을 첫 화면으로
  window.addEventListener('hashchange', () => {
    const n = screenFromHash();
    if (n && n !== current) show(n);
  });
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

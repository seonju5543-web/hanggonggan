/* 원문 링크 확인 로봇 — 앱이 보여 주는 원문 링크를 **학생처럼** 새 탭으로 열어, 그 공고가 실제로 뜨는지 본다
   (2026-10-03 신설 · 개발자 보고 P0)
   ─────────────────────────────────────────────────────────────────────────────
   왜 생겼나:
     *"공고 내 원문공고를 클릭했을 때 해당 공고의 페이지로 이동하지 않고 재단이나 장학금 페이지 전체가
      표시되는 상황이 발생하여 사용자들이 신청에 어려움이 있다"* — 장학금·대외활동·공모전·소식 전반.
     조사해 보니 링크를 만든 로봇은 많아도 **학생처럼 열어 보고 그 공고가 뜨는지 적어 둔 곳이 없었다.**
     목록 주소에 글 번호만 붙인 것(가천·고려·서울교대 — 서버가 번호를 무시하고 목록을 준다), 재단·기관
     홈페이지, `&#038;` 이 박혀 글 번호가 잘린 주소(서울대)가 전부 '원문 공고 ↗' 로 나가고 있었다.

   하는 일:
     ① 앱이 받는 파일 전부에서 링크를 모은다(collector/link-check-plan.mjs gatherTargets)
     ② 로그인도 리퍼러도 없는 새 탭(쿠키를 매번 지운 한 브라우저)으로 연다 — 학생이 누르는 조건 그대로
     ③ 무엇이 열렸는지 판정한다(collector/link-landing.mjs judgeLanding — 판정 규칙은 그 한 곳)
     ④ **다른 날 두 번** 같은 문제를 봐야 확정한다(nextState) — 한 번 막혀 껍데기를 받은 것으로 멀쩡한 링크를
        '문제'라고 부르지 않는다(2026-08-01 동국대 12건 오판). 한 사이트에서 제목 없는 문제가 절반을 넘으면
        우리가 막힌 것으로 보고 이번 결과를 '판정 못 함'으로 돌린다(hostGuard).
     ⑤ 확정된 문제만 data/link-check.json 에 적는다 → 앱(source-link.js)이 그 링크 이름을 '게시판 목록에서 보기'·
        '원문 공고(확인 필요)' 등으로 바꿔 정직하게 보여 준다.
     ⓪ (2026-10-04 · 개발자 지시 *"원문 공고 링크를 최대한 어떻게든 찾을 방법"*) 위 일보다 먼저 **원문 후보**를 연다 —
        사람·세션이 collector/link-candidates.json 에 적은 주소(또는 게시판) + 우리 기록에 이미 있는 같은 제목의 글 주소(둘째 짝)
        + 층2 재단 장학금과 짝지은 재단 게시판 글. 학생처럼 열어 collector/link-candidates.mjs acceptCandidate 의 잣대
        (사이트·제목 자리·회차·사업·기관·겹침)를 다 넘은 것만 data/link-check.json `fix` 에 싣는다 → 앱이 그 링크를 원문으로 연다
        (계약: source-link.js ⑥ · 지금 링크가 이미 원문이면 쓰지 않는다). 이튿날부터 그 주소도 위 ①~⑤가 날마다 연다.
        예산은 LINK_CHECK_CAND_BUDGET_MS(기본 5분 — 전체 20분에서 쓴다) · 한 사이트 한 실행 3번 · 오늘 연 주소는 다시 안 연다.

   🔴 이 로봇은 **데이터 파일의 주소를 고치지 않는다.** 쓰는 파일은 넷뿐이다 — data/link-check.json(앱이 받는 것 · bad 와 fix) ·
      collector/link-check-state.json(로봇 장부 — 앱에 안 나간다) · collector/link-candidates-state.json(후보 장부) ·
      collector/link-check-report.md. 원문 후보 파일(collector/link-candidates.json)은 **읽기만** 한다(사람·세션이 쓴다).
      (2026-10-03 사고: 링크 사냥꾼 순찰이 잡티 섞인 제목으로 멀쩡한 원문 주소를 목록 표식으로 덮어써
       그날 정식 등록 8건이 목록이 됐다. 판정하는 쪽이 고치기까지 하면 오판 한 번이 곧 데이터 손상이다.)
      아래 save() 가 그 넷 말고는 쓰기를 **거절한다**(관문 「원문 링크 정직성」 robot·candidates 갈래가 잰다).

   실행: node collector/link-check.mjs [--dry] [--only=<사이트 주소 조각>] [--max=N]
         (워크플로 link-check.yml · collector/run-link-check.txt 를 고쳐 push 해도 실행 · 거기 `mode: candidates` 면 후보만)
         LINK_CHECK_MODE=candidates — ⓪ 후보 확인만(후보 파일을 고쳐 push 한 실행 · 모든 학교를 하루에 두 번 두드리지 않게)
   환경: LINK_CHECK_BUDGET_MS(기본 20분) · LINK_CHECK_PER_HOST(사이트마다 상한 · 기본 8) · LINK_CHECK_SPACING_MS(같은 사이트 간격 · 기본 1.5초)
         LINK_CHECK_ROOT=<폴더>(data/·collector/ 를 그 폴더에서 읽고 쓴다 — 관문용)
         LINK_CHECK_FAKE=<json>(주소 → 관측 — 인터넷 없이 전 과정을 돌린다 · 관문용 · 게시판은 { status, html } ·
           `robots:<origin>` 이 false 면 그 사이트 robots.txt 가 막은 것으로) · LINK_CHECK_TODAY=YYYY-MM-DD
         LINK_CHECK_CAND_BUDGET_MS(⓪ 예산 · 기본 5분)
   ───────────────────────────────────────────────────────────────────────────── */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { judgeLanding, hostGuard, nextState, publishBad, decodeUrlEntities, linkShape, BAD } from './link-landing.mjs';
import { observeLanding } from './detail-url.mjs';
import { rowMatchesTitle } from './detail-url.mjs';
import { gatherTargets, otherTitlesFor, planQueue, pickNext, summarize, kstToday, DATASETS, DS_LABEL, STATUS_COLS } from './link-check-plan.mjs';
import { makeBudget, withDeadline, TIMED_OUT } from './harvest-budget.mjs';
import {
  loadCandidates, readIndexData, buildIndex, twinCandidates, kosafMatches, pickKosafPost, acceptCandidate, collisionOf, judgeTitles,
  shouldOpen, nextCandState, publishFix, roundOf, hostOf, hostAllowed, normCandUrl, MAX_TRIES, PER_HOST_CAND, FINAL,
} from './link-candidates.mjs';
import { extractDatedRows } from './board-links.mjs';
import { robotsAllows } from './robots.mjs';
import { urlKey } from './url-key.mjs';

/* ── 설정 — 맨 위에 둔다(아래 '넘어져도 저장' 장치가 언제 불려도 읽을 수 있게 · link-hunter 2026-08-01 TDZ 사고) ── */
const ROOT = process.env.LINK_CHECK_ROOT ? path.resolve(process.env.LINK_CHECK_ROOT) : fileURLToPath(new URL('..', import.meta.url));
const STATE_FILE = path.join(ROOT, 'collector', 'link-check-state.json');
const LEDGER_FILE = path.join(ROOT, 'data', 'link-check.json');
const REPORT_FILE = path.join(ROOT, 'collector', 'link-check-report.md');
const CAND_STATE_FILE = path.join(ROOT, 'collector', 'link-candidates-state.json');
const CAND_FILE = path.join(ROOT, 'collector', 'link-candidates.json');   // 읽기만 — 사람·세션이 쓴다
const TXT_FILE = path.join(ROOT, 'collector', 'run-link-check.txt');

const argv = process.argv.slice(2);
const flag = (name) => {
  const a = argv.find((x) => x === `--${name}` || x.startsWith(`--${name}=`));
  if (!a) return null;
  return a.includes('=') ? a.slice(a.indexOf('=') + 1) : true;
};
/* push-to-run 파일의 설정은 **그 파일을 고쳐 push 한 실행에만** 쓴다(워크플로가 LINK_CHECK_TXT=1 을 준다).
   링크 사냥꾼은 늘 읽어서, 누가 `onlyBoard:` 를 남겨 두면 매일 예약 실행까지 한 학교에 묶였다. */
function runSetting(key) {
  if (process.env.LINK_CHECK_TXT !== '1') return '';
  try {
    const m = fs.readFileSync(TXT_FILE, 'utf8').match(new RegExp(`^\\s*${key}:\\s*(.+)$`, 'm'));
    return m ? m[1].trim() : '';
  } catch { return ''; }
}
const DRY = !!flag('dry');
const ONLY = String(flag('only') || process.env.LINK_CHECK_ONLY || runSetting('only') || '').trim();
const MAX = Number(flag('max') || process.env.LINK_CHECK_MAX || runSetting('max') || 400);
const PER_HOST = Number(process.env.LINK_CHECK_PER_HOST || runSetting('perHost') || 8);
const BUDGET_MS = Number(process.env.LINK_CHECK_BUDGET_MS || 20 * 60000);
const CAND_BUDGET_MS = Math.min(BUDGET_MS, Number(process.env.LINK_CHECK_CAND_BUDGET_MS || 5 * 60000));
const MODE = String(process.env.LINK_CHECK_MODE || runSetting('mode') || '').trim();
const CAND_ONLY = MODE === 'candidates';
const FAKE_FILE = process.env.LINK_CHECK_FAKE || '';
/* 같은 사이트를 몰아치지 않는다 — 동국대는 짧은 간격에 응답을 막고 껍데기 화면을 줬다(2026-08-01) */
const SPACING_MS = Number(process.env.LINK_CHECK_SPACING_MS || (FAKE_FILE ? 0 : 1500));
const TODAY = process.env.LINK_CHECK_TODAY || kstToday();
const URL_HARD_MS = 45000;          // 한 주소 절대 시한(열기 20초 + 제목 기다림 6초 + 읽기) — 답이 안 오는 사이트에 멈춰 서지 않는다
const GOTO_MS = 20000;
const TITLE_WAIT_MS = 6000;
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

const readJson = (f, fb) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return fb; } };

/* 🔴 쓰기는 이 한 곳 — 네 파일 말고는 거절한다. 데이터 파일의 주소를 고치는 일은 이 로봇의 일이 아니다. */
const OUTPUTS = new Set([STATE_FILE, LEDGER_FILE, REPORT_FILE, CAND_STATE_FILE]);
function save(file, text) {
  if (!OUTPUTS.has(file)) throw new Error(`원문 링크 확인 로봇은 ${file} 을 쓰지 않습니다 (쓰는 파일은 넷뿐)`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
}

/* ── 대상 · 장부 · 순서 ───────────────────────────────────────────── */
const { targets, skipped, siteTitles } = gatherTargets(ROOT, { today: TODAY });
let state = readJson(STATE_FILE, {});
if (!state || typeof state !== 'object' || Array.isArray(state)) state = {};
const wasConfirmed = new Set(Object.entries(state).filter(([, s]) => s && s.confirmed && BAD.includes(s.v)).map(([u, s]) => `${u}\n${s.v}`));
const pool = ONLY ? targets.filter((t) => t.host.includes(ONLY) || t.url.includes(ONLY)) : targets;
let queue = [];                 // 원문 후보 확인(⓪)이 끝난 뒤 짠다 — 후보가 연 사이트 수를 사이트 상한에 함께 센다
const results = [];             // 이번 실행에 연 것 — { url, host, v, why, final }
let stopNote = '';
let candStopNote = '';          // 후보 확인(⓪)이 예산 등으로 멈춘 까닭 — 넘어졌을 때의 저장(finalize)도 읽으므로 여기 둔다

/* ── ⓪ 원문 후보 — 후보 파일 · 둘째 짝 · 층2 짝 · 장부 ─────────────────────── */
const idxData = readIndexData(ROOT);
const index = buildIndex(idxData);
let candFileBad = [];
let inputCands = [];
{
  let raw = null; let readErr = '';
  if (fs.existsSync(CAND_FILE)) { try { raw = JSON.parse(fs.readFileSync(CAND_FILE, 'utf8')); } catch (e) { readErr = `JSON 으로 읽지 못함(${String(e.message).slice(0, 60)})`; } }
  if (readErr) candFileBad = [{ i: -1, why: readErr }];
  else {
    const got = loadCandidates(raw || { v: 1, items: [] }, { today: TODAY });
    inputCands = got.ok; candFileBad = got.bad;
  }
}
let candState = readJson(CAND_STATE_FILE, {});
if (!candState || typeof candState !== 'object' || Array.isArray(candState)) candState = {};
const candResults = [];         // 이번 실행에 판정한 후보 — { cand, target, res, final }
const candMissing = [];         // 후보 파일의 줄인데 바로잡을 공고를 못 찾은 것
const openedToday = new Set([
  ...Object.entries(state).filter(([, s]) => s && s.lastAt === TODAY).map(([u]) => u),
  ...Object.values(candState).filter((e) => e && e.lastAt === TODAY).flatMap((e) => [e.url, e.board].filter(Boolean)),
]);
const candHostUsed = new Map();   // 후보 확인이 연 사이트별 수(게시판 열기 포함) — 일반 차례의 사이트 상한에 함께 센다

/* ── 넘어져도 · 예산을 넘겨도 그때까지 본 것은 저장한다 (link-hunter 2026-08-01·09-05 와 같은 장치) ── */
let finished = false;
const onCrash = (err) => {
  if (finished) return;
  console.error('\n🚨 확인 도중 넘어졌습니다 — 그때까지 본 것은 저장합니다:\n', err);
  try { finalize(`🚨 **로봇이 도중에 넘어졌습니다** — 여기까지 본 것은 저장했습니다. 넘어진 자리: \`${String((err && err.stack) || err).split('\n').slice(0, 3).join(' · ')}\``); } catch (e) { console.error('저장까지 실패했습니다:', e); }
  process.exit(1);
};
process.on('uncaughtException', onCrash);
process.on('unhandledRejection', onCrash);
/* 예산 검사가 못 끊는 자리(브라우저가 답을 안 주는 등)에서도 반드시 저장되는 바깥 시계 — 설계된 멈춤이라 0 으로 끝낸다 */
const watchdog = setTimeout(() => {
  if (finished) return;
  try { finalize(`⏰ **예산(${Math.round(BUDGET_MS / 60000)}분)을 넘겨 스스로 멈췄습니다** — 여기까지 본 것은 저장했고, 남은 것은 다음 실행이 이어서 봅니다.`); } catch (e) { console.error('저장까지 실패했습니다:', e); }
  process.exit(0);
}, BUDGET_MS + Number(process.env.LINK_CHECK_WATCHDOG_GRACE_MS || 90 * 1000));
watchdog.unref();

/* ── 한 주소 열어 보기 ──────────────────────────────────────────── */
let browser = null; let ctx = null;
let fake = null;
if (FAKE_FILE) fake = readJson(path.resolve(FAKE_FILE), {});

/* 화면에 제목이 그려질 때까지 기다릴 조각 — 말머리·앞 번호를 떼야 본문과 맞는다(link-hunter 와 같은 꼴) */
function probeOf(title) {
  return String(title || '')
    .replace(/^\s*\d{1,5}\s+/, '')
    .replace(/\[[^\]]{0,20}\]/g, '')
    .replace(/^\s*(공통|서울|글로벌|국제|공지|홍보|일반)\s+/g, '')
    .trim().slice(0, 12).trim();
}

async function openBrowser() {
  const { chromium } = await import('playwright');
  browser = await chromium.launch({ args: ['--no-sandbox'], ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  /* 한 브라우저·한 맥락 + 주소마다 쿠키 지우기 = 로그인도 리퍼러도 없는 새 탭. 리퍼러 머리글을 붙이지 않는다. */
  ctx = await browser.newContext({ userAgent: UA, locale: 'ko-KR' });
}

/* 본 것 그대로 — 판정 재료는 detail-url.mjs observeLanding **한 벌**(하나뿐인 제목 자리만 · 틀 안 포함 · 2만 자 · 비밀번호 칸).
   🔴 (2026-10-03 리뷰 LC-3) 여기 따로 두었던 사본은 h1~h3 를 **전부** 제목 자리로 세어, 행마다 h3 를 다는 목록을 'post' 로 판정했다. */
async function observeLive(t, holder) {
  await ctx.clearCookies().catch(() => {});
  const page = await ctx.newPage();
  holder.page = page;
  /* 알림창(「삭제된 게시물입니다」 등) — 닫고 글자만 적어 둔다(판정 재료가 아니라 리포트에 보일 것) */
  const dialogs = [];
  page.on('dialog', (d) => { dialogs.push(String(d.message() || '').slice(0, 120)); d.dismiss().catch(() => {}); });
  try {
    let res = null;
    try { res = await page.goto(t.url, { waitUntil: 'domcontentloaded', timeout: GOTO_MS }); } catch (e) { return { error: String((e && e.message) || e), ...(dialogs.length ? { dialog: dialogs.join(' / ') } : {}) }; }
    const probes = t.titles.map(probeOf).filter((p) => p.length >= 4);
    if (probes.length) {
      await page.waitForFunction((ps) => { const s = (document.body && document.body.innerText) || ''; return ps.some((p) => s.includes(p)); }, probes, { timeout: TITLE_WAIT_MS }).catch(() => {});
    }
    await page.waitForTimeout(600).catch(() => {});
    const o = await observeLanding(page, res);
    return dialogs.length ? { ...o, dialog: dialogs.join(' / ') } : o;
  } finally {
    await page.close().catch(() => {});
  }
}

async function observe(t) {
  if (fake) {
    const o = fake[t.url] || fake[t.raw];
    return o ? { ...o } : { error: '가짜 관측 없음' };
  }
  const holder = {};
  /* 🔴 실패를 여기서 받아 둔다 — 시한에 걸려 버려진 작업이 **나중에** 실패하면 받을 사람이 없어
     unhandledRejection 으로 로봇 전체가 넘어진다(주소 하나 때문에 그날 실행이 빨간불). */
  const work = observeLive(t, holder).catch((e) => ({ error: String((e && e.message) || e) }));
  const got = await withDeadline(work, URL_HARD_MS);
  if (got === TIMED_OUT) {
    if (holder.page) holder.page.close().catch(() => {});
    return { error: `시한 ${URL_HARD_MS / 1000}초 초과` };
  }
  return got;
}

/* 게시판 목록 한 장 — 후보가 글 주소가 아니라 게시판(board)일 때. 줄은 board-links.mjs extractDatedRows(날짜 붙은 줄만) */
async function observeBoardLive(url, holder) {
  await ctx.clearCookies().catch(() => {});
  const page = await ctx.newPage();
  holder.page = page;
  try {
    let res = null;
    try { res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: GOTO_MS }); } catch (e) { return { error: String((e && e.message) || e) }; }
    await page.waitForTimeout(1500).catch(() => {});
    return { status: res ? res.status() : 0, finalUrl: page.url(), html: await page.content() };
  } finally {
    await page.close().catch(() => {});
  }
}
async function observeBoard(url) {
  if (fake) { const o = fake[url]; return o ? { ...o } : { error: '가짜 관측 없음' }; }
  const holder = {};
  const got = await withDeadline(observeBoardLive(url, holder).catch((e) => ({ error: String((e && e.message) || e) })), URL_HARD_MS);
  if (got === TIMED_OUT) { if (holder.page) holder.page.close().catch(() => {}); return { error: `시한 ${URL_HARD_MS / 1000}초 초과` }; }
  return got;
}
/* 게시판을 훑기 전에 robots.txt 를 묻는다 — 학교 게시판은 묻지 않는다(장학 수집기와 같은 정책 · 글 하나를 여는 것은 지금처럼 묻지 않는다) */
async function robotsOk(url) {
  if (/\.ac\.kr$/.test(hostOf(url))) return true;
  if (fake) { try { return fake[`robots:${new URL(url).origin}`] !== false; } catch { return true; } }
  return robotsAllows(url);
}

/* ── 저장 · 리포트 (정상 종료도 넘어졌을 때도 같은 길) ───────────────── */
const V_WORD = { post: '그 공고가 열림', list: '게시판 목록이 열림', home: '사이트 첫 화면이 열림', login: '로그인을 요구함', gone: '열리지 않음(없는 주소)', other: '다른 화면이 열림', unread: '판정 못 함' };
const COL_WORD = { unchecked: '아직 안 봄', post: '공고 확인', unread: '판정 못 함', pending: '한 번 봄', list: '목록', home: '첫 화면', login: '로그인', gone: '안 열림', other: '다른 화면' };
const short = (s, n) => { const x = String(s || '').replace(/\s+/g, ' ').trim(); return x.length > n ? `${x.slice(0, n - 1)}…` : x; };
const dsWords = (t) => t.ds.map((d) => DS_LABEL[d] || d).join('·');
const LIST_CAP = 60;

function lineFor(t, s) {
  const who = t.id ? `${t.id} · ` : '';
  const final = s && s.final ? ` → 실제로 간 곳 ${short(s.final, 90)}` : '';
  return `- [${dsWords(t)}] ${who}${short(t.title, 48)} — **${V_WORD[s.v] || s.v}** (${short(s.why, 60)})\n  ${t.url}${final}`;
}

/* ⓪ 원문 후보 확인 — 리포트 절(이번 판정 + 사람 확인을 기다리는 후보 전부 · 관리자가 이 리포트·이슈에서 본다) */
const CHECK_WORD = { H: '사이트', L: '착지', T: '제목', R: '회차', P: '사업', X: '기관', C: '겹침', A: '관리자' };
function candReport({ fix, dropped }) {
  const L = [];
  const by = (st) => candResults.filter((r) => r.res.status === st);
  const where = (ds) => DS_LABEL[ds] || ds;
  const line = (ds, label, e, why, who) => `- [${where(ds)}] ${short(label, 44)} — ${short(why, 90)}\n  ${e.url || e.board || ''}${e.final ? ` → 실제로 간 곳 ${short(e.final, 90)}` : ''}${who ? ` · 후보: ${short(who, 60)}` : ''}`;
  const cap = 30;
  const list = (rows) => { if (!rows.length) L.push('- 없음'); rows.slice(0, cap).forEach((x) => L.push(x)); if (rows.length > cap) L.push(`- …외 ${rows.length - cap}건 (collector/link-candidates-state.json)`); };
  const fixN = Object.keys(fix || {}).length;
  L.push('### 원문 후보 확인 — 찾아 온 주소가 그 공고·그 회차인지 학생처럼 열어 봤습니다');
  L.push(`이번에 판정한 후보 **${candResults.length}건** · ✅ 원문으로 올림 ${by('verified').length} · 🟡 사람 확인 ${by('suggest').length} · ❌ 맞지 않음 ${by('rejected').length} · ⏳ 못 엶(다시 봄) ${by('pending').length}${candStopNote ? ` — ${candStopNote}` : ''}`);
  L.push(`앱에 실린 로봇 바로잡기(\`data/link-check.json\` fix): **${fixN}건** — 앱은 그 링크를 원문으로 엽니다(지금 링크가 이미 원문이면 바꾸지 않습니다).`);
  L.push('_후보는 `collector/link-candidates.json` 에 적거나(사람·세션), 로봇이 우리 기록에서 찾습니다(같은 사이트·같은 제목의 글 주소 · 층2 재단 장학금과 짝지은 재단 게시판 글)._');
  L.push('');
  L.push('#### ✅ 원문으로 올린 것 (이번 실행)');
  list(by('verified').map((r) => line(r.target.ds, r.target.label, r.entry, r.res.why, r.cand.by)));
  L.push('');
  const waiting = Object.values(candState).filter((e) => e && e.status === 'suggest')
    .map((e) => ({ e, t: index.find({ ds: e.ds, key: e.key }) })).filter((x) => x.t);
  L.push(`#### 🟡 사람 확인을 기다리는 후보 (전체 ${waiting.length}건) — 열어 보고 맞으면 관리자 화면 「원문 링크」에 넣어 주세요`);
  list(waiting.map(({ e, t }) => `${line(t.ds, t.label, e, e.why, e.by)}${Object.entries(e.checks || {}).length ? `\n  잣대: ${Object.entries(e.checks).map(([k, v]) => `${CHECK_WORD[k] || k} ${v === 'ok' ? '✓' : v === 'fail' ? '✕' : v === 'n/a' ? '-' : '?'}`).join(' · ')}` : ''}`));
  L.push('');
  L.push('#### ❌ 맞지 않은 후보 (이번 실행)');
  list(by('rejected').map((r) => line(r.target.ds, r.target.label, r.entry, r.res.why, r.cand.by)));
  L.push('');
  if (by('pending').length) {
    L.push('#### ⏳ 못 엶 — 며칠 뒤 다시 봅니다 (이번 실행 · 거절이 아닙니다)');
    list(by('pending').map((r) => line(r.target.ds, r.target.label, r.entry, `${r.res.why}${r.entry.nextAt ? ` · 다음 ${r.entry.nextAt}` : ''}`, r.cand.by)));
    L.push('');
  }
  if (candFileBad.length || candMissing.length) {
    L.push('#### ⚠️ 후보 파일(collector/link-candidates.json)에서 쓰지 못한 줄');
    candFileBad.forEach((b) => L.push(`- ${b.i >= 0 ? `${b.i + 1}번째 줄` : '파일'}: ${b.why}`));
    candMissing.forEach((c) => L.push(`- ${where(c.target.ds)} \`${short(c.target.key, 70)}\`: 앱에서 그 공고를 못 찾음(지금 보이는 주소·id·층2 코드인지 확인)`));
    L.push('');
  }
  if ((dropped || []).length) {
    L.push('#### 확인했지만 지금은 앱에 싣지 않는 바로잡기');
    list(dropped.map((d) => `- [${where(d.ds)}] \`${short(d.key, 50)}\` — ${d.why}\n  ${d.url}`));
    L.push('');
  }
  return L;
}

function buildReport({ sum, newBad, blocked, ledgerBad, note, fix, dropped }) {
  const ran = { post: 0, unread: 0, bad: 0 };
  for (const r of results) { if (r.v === 'post') ran.post += 1; else if (r.v === 'unread') ran.unread += 1; else ran.bad += 1; }
  const L = [];
  L.push(`## 🔗 원문 링크 확인 리포트 (${new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 16).replace('T', ' ')} KST · 기준일 ${TODAY})`);
  L.push('');
  L.push('앱이 보여 주는 원문 링크를 **학생처럼**(로그인·리퍼러 없는 새 탭) 열어, 그 공고가 실제로 뜨는지 봤습니다.');
  L.push('🔴 이 로봇은 주소를 고치지 않습니다 — 확정된 문제만 `data/link-check.json` 에 적고, 앱은 그 링크의 이름을 바꿔 정직하게 보여 줍니다(예: "게시판 목록에서 보기", "원문 공고(확인 필요)").');
  L.push('');
  if (note) { L.push(note); L.push(''); }
  if (CAND_ONLY) { L.push('_이번 실행은 **원문 후보만** 확인했습니다(후보 파일을 고쳐 push 한 실행 · 앱의 링크는 매일 저녁 실행이 봅니다)._'); L.push(''); }
  L.push(`이번 실행: **${results.length}건** 열어 봄 · 공고 확인 ${ran.post} · 문제로 보임 ${ran.bad} · 판정 못 함 ${ran.unread}${ONLY ? ` · 사이트 한정 \`${ONLY}\`` : ''}${DRY ? ' — 모의 실행(저장 안 함)' : ''}`);
  L.push(`앱에 알린 확정 문제(지금 실린 링크): **${Object.keys(ledgerBad).length}건** · 이번에 새로 확정: **${newBad.length}건**`);
  L.push('');

  L.push(`### 새로 확정된 문제 링크 (다른 날 두 번 같은 것을 봤습니다) — ${newBad.length}건`);
  if (!newBad.length) L.push('- 없음');
  newBad.slice(0, LIST_CAP).forEach(({ t, s }) => L.push(lineFor(t, s)));
  if (newBad.length > LIST_CAP) L.push(`- …외 ${newBad.length - LIST_CAP}건 (collector/link-check-state.json)`);
  L.push('');

  L.push(`### 한 번 본 문제 (다른 날 한 번 더 보고 확정합니다 — 아직 앱 글자를 바꾸지 않습니다) — ${sum.pending.length}건`);
  if (!sum.pending.length) L.push('- 없음');
  sum.pending.slice(0, LIST_CAP).forEach(({ t, s }) => L.push(lineFor(t, s)));
  if (sum.pending.length > LIST_CAP) L.push(`- …외 ${sum.pending.length - LIST_CAP}건`);
  L.push('');

  L.push(...candReport({ fix, dropped }));

  L.push('### 우리를 막는 것으로 보이는 사이트 (이번 결과를 "판정 못 함"으로 돌렸습니다)');
  if (!blocked.length) L.push('- 없음');
  blocked.forEach(([host, n]) => L.push(`- ${host} — ${n}건 (제목 없는 화면이 절반을 넘음 · 학교 서버가 우리를 막았을 수 있어 문제로 세지 않습니다)`));
  L.push('');

  /* 판정 못 한 이유를 사이트별로 — 인증서·막힘·시한이 한 사이트에 몰리면 그 사이트는 이 로봇이 못 보는 곳이다(문제로 세지 않는다) */
  const unread = new Map();
  for (const r of results) {
    if (r.v !== 'unread') continue;
    const u = unread.get(r.host) || { n: 0, why: new Map() };
    u.n += 1;
    const w = short(String(r.why || '').replace(/^막힘 의심\([^)]*\) · /, '막힘 의심 · '), 50);
    u.why.set(w, (u.why.get(w) || 0) + 1);
    unread.set(r.host, u);
  }
  if (unread.size) {
    L.push('### 판정 못 한 링크 (이번 실행 · 사이트별 · 문제로 세지 않습니다)');
    [...unread].sort((a, b) => b[1].n - a[1].n).slice(0, 15).forEach(([host, u]) => {
      const top = [...u.why].sort((a, b) => b[1] - a[1])[0];
      L.push(`- ${host} — ${u.n}건 · 가장 많은 이유: ${top[0]}${top[1] > 1 ? ` (${top[1]}건)` : ''}`);
    });
    if (unread.size > 15) L.push(`- …외 ${unread.size - 15}곳`);
    L.push('');
  }

  L.push('### 전체 현황 (앱에 실린 링크 × 지금까지 본 결과)');
  L.push(`| 묶음 | ${STATUS_COLS.map((c) => COL_WORD[c]).join(' | ')} |`);
  L.push(`|---|${STATUS_COLS.map(() => '---:').join('|')}|`);
  for (const d of DATASETS) L.push(`| ${DS_LABEL[d]} | ${STATUS_COLS.map((c) => sum.byDs[d][c]).join(' | ')} |`);
  L.push('');
  L.push('_한 링크가 두 묶음에 함께 실려 있으면 양쪽에 셉니다. 「한 번 봄」은 다른 날 한 번 더 같은 것을 보면 확정됩니다._');
  L.push('');

  L.push(`### 확정된 문제 전체 (앱이 받는 파일에 적힌 것) — ${sum.confirmed.length}건`);
  if (!sum.confirmed.length) L.push('- 없음');
  sum.confirmed.slice(0, LIST_CAP).forEach(({ t, s }) => L.push(lineFor(t, s)));
  if (sum.confirmed.length > LIST_CAP) L.push(`- …외 ${sum.confirmed.length - LIST_CAP}건`);
  L.push('');

  const mk = Object.entries(skipped.marker).map(([d, n]) => `${DS_LABEL[d] || d} ${n}`).join(' · ') || '없음';
  L.push('### 열어 보지 않은 것 (세기만 했습니다)');
  L.push(`- 게시판 목록 표식(#n-): ${mk} — 원문 주소를 아직 못 찾은 글이라 앱이 이미 "게시판 목록"이라고 부릅니다`);
  L.push(`- 층2(한국장학재단에 등록된 재단 장학금): ${skipped.kosaf.items}건 — 재단 홈페이지 주소뿐이라 앱이 "재단 홈페이지"라고 부릅니다(그중 공고문 사본이 있는 것 ${skipped.kosaf.withFiles}건)${skipped.kosaf.fixed ? ` · 바로잡은 원문이 있어 연 것 ${skipped.kosaf.fixed}건은 따로` : ''}`);
  const closed = Object.values(skipped.closed || {}).reduce((a, b) => a + b, 0);
  if (closed) L.push(`- 마감이 지나 앱이 더는 보여 주지 않는 대외활동: ${closed}건`);
  const quiet = [['noUrl', '주소 없음'], ['noTitle', '제목 없음(판정 재료가 없어 열지 않음)'], ['hidden', '숨긴 글']]
    .map(([k, w]) => [w, Object.values(skipped[k]).reduce((a, b) => a + b, 0)]).filter(([, n]) => n);
  quiet.forEach(([w, n]) => L.push(`- ${w}: ${n}건`));
  const notYet = queue.length - results.length;
  if (notYet > 0) L.push(`- 이번 순서에 들었지만 시간이 모자라 못 본 것: ${notYet}건 (다음 실행이 이어서 봅니다)`);
  L.push(`- 앱에 실린 링크 ${targets.length}건 중 이번 순서에 든 것 ${queue.length}건 (사이트마다 최대 ${PER_HOST}건 · 학교 서버를 몰아치지 않으려고)`);
  L.push('');
  return L.join('\n');
}

function finalize(note) {
  if (finished) return null;
  finished = true;
  hostGuard(results);
  const blockedMap = new Map();
  for (const r of results) {
    if (/^막힘 의심/.test(r.why || '')) blockedMap.set(r.host, (blockedMap.get(r.host) || 0) + 1);
    state[r.url] = nextState(state[r.url], { v: r.v, why: r.why }, TODAY, { final: r.final });
  }
  /* 앱에서 내려간 링크의 장부는 지운다 — 남겨 두면 장부만 자란다 */
  const live = new Set(targets.map((t) => t.url));
  const tidy = {};
  for (const k of Object.keys(state).sort()) if (live.has(k)) tidy[k] = state[k];
  state = tidy;
  const ledgerBad = publishBad(state, live);
  const byUrl = new Map(targets.map((t) => [t.url, t]));
  const ranUrls = new Set(results.map((r) => r.url));
  const newBad = Object.keys(ledgerBad)
    .filter((u) => ranUrls.has(u) && !wasConfirmed.has(`${u}\n${state[u].v}`))
    .map((u) => ({ t: byUrl.get(u), s: state[u] }));
  const sum = summarize(state, targets);
  /* ⓪ 후보 장부 — 원문으로 올린 주소를 확인 로봇이 문제로 확정했으면 내린다(그대로 두면 앱에서 빠졌다 들어오기를 되풀이한다) ·
     공고가 앱에서 내려간 지 30일 지난 줄은 지운다(장부만 자라지 않게) */
  const tidyCand = {};
  for (const cid of Object.keys(candState).sort()) {
    const e = candState[cid];
    if (!e || typeof e !== 'object') continue;
    const u = e.url ? decodeUrlEntities(e.url) : '';
    if (e.status === 'verified' && u && ledgerBad[u]) { tidyCand[cid] = { ...e, status: 'rejected', why: `원문으로 올린 뒤 원문 링크 확인이 문제로 확정(${ledgerBad[u].v} · ${ledgerBad[u].at})`, decidedAt: TODAY }; continue; }
    if (!index.find({ ds: e.ds, key: e.key }) && e.lastAt && (Date.parse(TODAY) - Date.parse(e.lastAt)) / 86400000 > 30) continue;
    tidyCand[cid] = e;
  }
  candState = tidyCand;
  const { fix, dropped } = publishFix(candState, index, { bad: ledgerBad });
  const report = buildReport({ sum, newBad, blocked: [...blockedMap], ledgerBad, note: note || stopNote, fix, dropped });
  if (!DRY) {
    save(STATE_FILE, JSON.stringify(state, null, 1));
    save(LEDGER_FILE, JSON.stringify({ updatedAt: new Date().toISOString(), v: 1, bad: ledgerBad, fix }, null, 1));
    save(CAND_STATE_FILE, JSON.stringify(candState, null, 1));
    save(REPORT_FILE, report);
  }
  console.log(report);
  if (process.env.GITHUB_OUTPUT) {
    const cn = (st) => candResults.filter((r) => r.res.status === st).length;
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `checked=${results.length}\nnew_bad=${newBad.length}\nconfirmed=${Object.keys(ledgerBad).length}\npending=${sum.pending.length}\n`
      + `cand_checked=${candResults.length}\ncand_verified=${cn('verified')}\ncand_suggest=${cn('suggest')}\ncand_rejected=${cn('rejected')}\nfixes=${Object.keys(fix).length}\n`);
  }
  return { newBad, ledgerBad, sum, fix };
}

/* ── 돌리기 ─────────────────────────────────────────────────────── */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const budget = makeBudget(BUDGET_MS);
const lastHit = new Map();
async function ensureBrowser() { if (!fake && !browser) await openBrowser(); }
const bumpHost = (h) => candHostUsed.set(h, (candHostUsed.get(h) || 0) + 1);

/* ── ⓪ 원문 후보 확인 ───────────────────────────────────────────────
   순서: 관리자 후보 → 사람·세션 후보 → 둘째 짝 → 층2 짝 · 같은 무리 안에서는 정식 등록·층2(학생이 신청하러 누르는 곳) 먼저 */
const SRC_ORDER = { admin: 0, search: 1, board: 1, data: 1, twin: 2, match: 3 };
const DS_ORDER = { registered: 0, kosaf: 1, notices: 2, news: 3, external: 4, activities: 5 };
function candQueue() {
  const all = [...inputCands, ...twinCandidates(index, { today: TODAY }), ...kosafMatches(index, idxData.external, { today: TODAY })];
  const seen = new Set(); const out = [];
  for (const c of all) {
    if (seen.has(c.cid)) continue;
    seen.add(c.cid);
    const target = index.find(c.target);
    if (!target) { if (c.source !== 'twin' && c.source !== 'match') candMissing.push(c); continue; }
    const at = c.url || c.board;
    if (ONLY && !at.includes(ONLY)) continue;
    const round = roundOf(target);
    if (!shouldOpen(candState[c.cid], c, TODAY, round)) continue;
    let host = '';
    try { host = new URL(at).host; } catch { continue; }
    out.push({ cand: c, target, host, round });
  }
  return out.sort((a, b) => ((b.cand.trusted ? 1 : 0) - (a.cand.trusted ? 1 : 0)) || ((SRC_ORDER[a.cand.source] ?? 1) - (SRC_ORDER[b.cand.source] ?? 1)) || ((DS_ORDER[a.target.ds] ?? 9) - (DS_ORDER[b.target.ds] ?? 9)));
}
function recordCand(q, res, extra = {}) {
  const e = nextCandState(candState[q.cand.cid], q.cand, res, TODAY, { ...extra, ...(q.target.ds === 'kosaf' ? { round: q.round } : {}) });
  candState[q.cand.cid] = e;
  candResults.push({ cand: q.cand, target: q.target, res, entry: e });
  console.log(`  후보 ${res.status.padEnd(8)} ${q.host} · ${short(q.target.label, 36)} (${short(res.why, 60)})`);
}
const prevTries = (cid) => { const p = candState[cid]; return p && p.status === 'pending' ? (p.tries || 0) : 0; };
/* 후보 주소 하나를 학생처럼 열고 판정 — 여는 눈(observe)·판정(judgeLanding)은 일반 차례와 같은 한 벌 */
async function checkCandUrl(q, url, cand) {
  const titles = judgeTitles(q.target, cand);
  const t = { url, raw: url, titles, host: new URL(url).host, origin: new URL(url).origin };
  const obs = await observe(t);
  openedToday.add(url);
  lastHit.set(t.host, Date.now());
  bumpHost(t.host);
  const verdict = judgeLanding({ ...obs, requestedUrl: url, titles, titlesFromNameOnly: !!q.target.nameOnly, otherTitles: otherTitlesFor(t, targets, siteTitles) });
  const alsoTargets = Object.fromEntries((cand.also || []).map((code) => [code, index.find({ ds: 'kosaf', key: code })]).filter(([, v]) => v));
  const res = acceptCandidate({ target: q.target, cand, obs, verdict, ctx: { tries: prevTries(q.cand.cid), owners: index.ownersOf(url), alsoTargets } });
  if (obs.dialog && res.status !== 'verified' && !res.why.includes('알림창')) res.why = `${res.why} · 알림창 「${short(obs.dialog, 60)}」`;
  return { res, final: obs.finalUrl && obs.finalUrl !== url ? obs.finalUrl : undefined };
}
/* 게시판 후보 — robots.txt 를 묻고 목록을 열어 날짜 붙은 줄에서 그 글을 **하나만** 고른 뒤 그 글을 연다 */
async function checkCandBoard(q) {
  const c = q.cand;
  if (!(await robotsOk(c.board))) return { res: { status: 'rejected', why: '그 사이트 robots.txt 가 게시판 훑기를 막음 — 글 주소로 다시 적어 주세요', checks: {} } };
  const host = new URL(c.board).host;
  const b = await observeBoard(c.board);
  openedToday.add(c.board);
  lastHit.set(host, Date.now());
  bumpHost(host);
  const tries = prevTries(c.cid) + 1;
  const retry = (why) => (tries >= MAX_TRIES ? { status: 'rejected', why: `${why} — ${tries}번째라 그만 봅니다`, checks: {} } : { status: 'pending', why, checks: {} });
  if (b.error || !b.html || Number(b.status || 0) >= 400) return { res: retry(`게시판을 못 엶(${b.error ? short(b.error, 60) : `HTTP ${b.status}`})`) };
  const rows = extractDatedRows(b.html, b.finalUrl || c.board).map((r) => ({ ...r, url: normCandUrl(r.url) }))
    .filter((r) => hostAllowed(r.url, q.target.allowed) && linkShape(r.url) === 'page');
  let pick = null;
  if (q.target.ds === 'kosaf') { const got = pickKosafPost(q.target, rows); pick = got ? got.p : null; } else {
    const hits = rows.filter((r) => q.target.titles.some((w) => rowMatchesTitle(w, r.title)));
    const uniq = [...new Map(hits.map((r) => [urlKey(r.url), r])).values()];
    pick = uniq.length === 1 ? uniq[0] : null;
  }
  if (!pick) return { res: retry(`게시판 목록(${rows.length}줄)에서 그 글을 하나로 못 고름`) };
  if (openedToday.has(pick.url) || (candHostUsed.get(host) || 0) >= PER_HOST_CAND) return { res: { status: 'pending', why: '고른 글은 내일 엽니다(오늘 이미 열었거나 이 사이트 몫을 다 씀)', checks: {} }, picked: pick.url };
  const clash = collisionOf(q.target, index.ownersOf(pick.url));
  if (clash) return { res: { status: 'rejected', why: clash, checks: { C: 'fail' } }, picked: pick.url };
  const r = await checkCandUrl(q, pick.url, { ...c, url: pick.url, title: pick.title, picked: true });
  return { ...r, picked: pick.url };
}
const candBudget = makeBudget(CAND_BUDGET_MS);
const candRemaining = candQueue();
while (candRemaining.length) {
  if (!candBudget.hasRoom(URL_HARD_MS) || !budget.hasRoom(URL_HARD_MS)) { candStopNote = `후보 확인 예산(${Math.round(CAND_BUDGET_MS / 60000)}분)이 다 돼 ${candRemaining.length}건은 다음 실행이 봅니다`; break; }
  for (let i = candRemaining.length - 1; i >= 0; i -= 1) if ((candHostUsed.get(candRemaining[i].host) || 0) >= PER_HOST_CAND) candRemaining.splice(i, 1);   // 이 사이트 몫(3번)을 다 씀 — 다음 실행에
  if (!candRemaining.length) break;
  const pick = pickNext(candRemaining, lastHit, Date.now(), SPACING_MS);
  if (pick.index < 0) { await sleep(Math.min(Math.max(pick.wait, 50), 5000)); continue; }
  if (browser && !browser.isConnected()) { candStopNote = '브라우저가 도중에 꺼져 후보 확인을 멈췄습니다'; break; }
  const q = candRemaining.splice(pick.index, 1)[0];
  const c = q.cand;
  if (openedToday.has(c.url || c.board)) continue;                    // 오늘 이미 연 주소 — 같은 날 두 번 두드리지 않는다(내일 본다)
  if (c.url) {
    const clash = !c.trusted && collisionOf(q.target, index.ownersOf(c.url));
    if (clash) { recordCand(q, { status: 'rejected', why: clash, checks: { C: 'fail' } }); continue; }
    await ensureBrowser();
    const r = await checkCandUrl(q, c.url, c);
    recordCand(q, r.res, r.final ? { final: r.final } : {});
  } else {
    await ensureBrowser();
    const r = await checkCandBoard(q);
    recordCand(q, r.res, { ...(r.picked ? { url: r.picked } : {}), ...(r.final ? { final: r.final } : {}) });
  }
}

/* ── ①~⑤ 앱에 실린 링크 — 후보 확인이 연 사이트 수를 사이트 상한에 함께 센다 · 후보만 보는 실행이면 건너뛴다 ── */
if (!CAND_ONLY) queue = planQueue(pool, state, TODAY, { perHost: PER_HOST, max: MAX, used: candHostUsed, skip: openedToday });
console.log(`원문 링크 확인 — 앱에 실린 링크 ${targets.length}건 · 이번 순서 ${queue.length}건 · 원문 후보 ${candResults.length}건 판정 · 기준일 ${TODAY}${CAND_ONLY ? ' · 후보만' : ''}${fake ? ' · 가짜 관측(인터넷 없이)' : ''}${DRY ? ' · 모의 실행' : ''}`);
if (queue.length) await ensureBrowser();
const remaining = [...queue];
while (remaining.length) {
  if (!budget.hasRoom(URL_HARD_MS)) { stopNote = `⏰ 예산(${Math.round(BUDGET_MS / 60000)}분)이 다 돼 여기서 멈췄습니다 — 남은 ${remaining.length}건은 다음 실행이 이어서 봅니다.`; break; }
  const pick = pickNext(remaining, lastHit, Date.now(), SPACING_MS);
  if (pick.index < 0) { await sleep(Math.min(Math.max(pick.wait, 50), 5000)); continue; }
  /* 브라우저가 죽었으면 남은 것을 '판정 못 함'으로 채우지 않고 멈춘다 — 다음 실행이 이어서 본다 */
  if (browser && !browser.isConnected()) { stopNote = `🚨 브라우저가 도중에 꺼져 여기서 멈췄습니다 — 남은 ${remaining.length}건은 다음 실행이 이어서 봅니다.`; break; }
  const t = remaining.splice(pick.index, 1)[0];
  const obs = await observe(t);
  lastHit.set(t.host, Date.now());
  const verdict = judgeLanding({ ...obs, requestedUrl: t.url, titles: t.titles, titlesFromNameOnly: !!t.nameOnly, otherTitles: otherTitlesFor(t, targets, siteTitles) });
  const final = obs.finalUrl && obs.finalUrl !== t.url ? obs.finalUrl : undefined;
  /* decisive(404·401·첫 화면으로 돌려보냄)·wasBad(앞선 날 이미 문제)는 hostGuard 가 막힘을 잴 때 쓴다(리뷰 LC-1) */
  const wasBad = !!(state[t.url] && BAD.includes(state[t.url].v));
  results.push({ url: t.url, host: t.host, v: verdict.v, why: verdict.why, final, decisive: !!verdict.decisive, wasBad });
  console.log(`  ${verdict.v.padEnd(6)} ${t.host} · ${short(t.title, 40)} (${short(verdict.why, 50)})`);
}
finalize(null);
if (browser) await withDeadline(browser.close().catch(() => {}), 10000);
process.exit(0);

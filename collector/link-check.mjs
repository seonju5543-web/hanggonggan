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

   🔴 이 로봇은 **주소를 고치지 않는다.** 쓰는 파일은 셋뿐이다 — data/link-check.json(앱이 받는 것) ·
      collector/link-check-state.json(로봇 장부 — 앱에 안 나간다) · collector/link-check-report.md.
      (2026-10-03 사고: 링크 사냥꾼 순찰이 잡티 섞인 제목으로 멀쩡한 원문 주소를 목록 표식으로 덮어써
       그날 정식 등록 8건이 목록이 됐다. 판정하는 쪽이 고치기까지 하면 오판 한 번이 곧 데이터 손상이다.)
      아래 save() 가 그 셋 말고는 쓰기를 **거절한다**(관문 「원문 링크 정직성」 robot 갈래가 잰다).

   실행: node collector/link-check.mjs [--dry] [--only=<사이트 주소 조각>] [--max=N]
         (워크플로 link-check.yml · collector/run-link-check.txt 를 고쳐 push 해도 실행)
   환경: LINK_CHECK_BUDGET_MS(기본 20분) · LINK_CHECK_PER_HOST(사이트마다 상한 · 기본 8) · LINK_CHECK_SPACING_MS(같은 사이트 간격 · 기본 1.5초)
         LINK_CHECK_ROOT=<폴더>(data/·collector/ 를 그 폴더에서 읽고 쓴다 — 관문용)
         LINK_CHECK_FAKE=<json>(주소 → 관측 — 인터넷 없이 전 과정을 돌린다 · 관문용) · LINK_CHECK_TODAY=YYYY-MM-DD
   ───────────────────────────────────────────────────────────────────────────── */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { judgeLanding, hostGuard, nextState, publishBad, BAD } from './link-landing.mjs';
import { gatherTargets, otherTitlesFor, planQueue, pickNext, summarize, kstToday, DATASETS, DS_LABEL, STATUS_COLS } from './link-check-plan.mjs';
import { makeBudget, withDeadline, TIMED_OUT } from './harvest-budget.mjs';

/* ── 설정 — 맨 위에 둔다(아래 '넘어져도 저장' 장치가 언제 불려도 읽을 수 있게 · link-hunter 2026-08-01 TDZ 사고) ── */
const ROOT = process.env.LINK_CHECK_ROOT ? path.resolve(process.env.LINK_CHECK_ROOT) : fileURLToPath(new URL('..', import.meta.url));
const STATE_FILE = path.join(ROOT, 'collector', 'link-check-state.json');
const LEDGER_FILE = path.join(ROOT, 'data', 'link-check.json');
const REPORT_FILE = path.join(ROOT, 'collector', 'link-check-report.md');
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
const FAKE_FILE = process.env.LINK_CHECK_FAKE || '';
/* 같은 사이트를 몰아치지 않는다 — 동국대는 짧은 간격에 응답을 막고 껍데기 화면을 줬다(2026-08-01) */
const SPACING_MS = Number(process.env.LINK_CHECK_SPACING_MS || (FAKE_FILE ? 0 : 1500));
const TODAY = process.env.LINK_CHECK_TODAY || kstToday();
const URL_HARD_MS = 45000;          // 한 주소 절대 시한(열기 20초 + 제목 기다림 6초 + 읽기) — 답이 안 오는 사이트에 멈춰 서지 않는다
const GOTO_MS = 20000;
const TITLE_WAIT_MS = 6000;
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

const readJson = (f, fb) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return fb; } };

/* 🔴 쓰기는 이 한 곳 — 세 파일 말고는 거절한다. 데이터 파일의 주소를 고치는 일은 이 로봇의 일이 아니다. */
const OUTPUTS = new Set([STATE_FILE, LEDGER_FILE, REPORT_FILE]);
function save(file, text) {
  if (!OUTPUTS.has(file)) throw new Error(`원문 링크 확인 로봇은 ${file} 을 쓰지 않습니다 (쓰는 파일은 셋뿐)`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
}

/* ── 대상 · 장부 · 순서 ───────────────────────────────────────────── */
const { targets, skipped, siteTitles } = gatherTargets(ROOT);
let state = readJson(STATE_FILE, {});
if (!state || typeof state !== 'object' || Array.isArray(state)) state = {};
const wasConfirmed = new Set(Object.entries(state).filter(([, s]) => s && s.confirmed && BAD.includes(s.v)).map(([u, s]) => `${u}\n${s.v}`));
const pool = ONLY ? targets.filter((t) => t.host.includes(ONLY) || t.url.includes(ONLY)) : targets;
const queue = planQueue(pool, state, TODAY, { perHost: PER_HOST, max: MAX });
const results = [];             // 이번 실행에 연 것 — { url, host, v, why, final }
let stopNote = '';

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

/* 본 것 그대로 — 창 제목 · 머리글(h1~h3·og:title) · 본문 글자(틀 안 포함 · 2만 자) · 비밀번호 칸 */
async function readPage(page) {
  const docTitle = await page.title().catch(() => '');
  const headings = []; let text = ''; let hasPassword = false;
  for (const fr of page.frames().slice(0, 6)) {
    const one = await fr.evaluate(() => {
      const clip = (s) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, 200);
      const heads = [...document.querySelectorAll('h1,h2,h3')].map((e) => clip(e.innerText || e.textContent)).filter(Boolean).slice(0, 30);
      const og = document.querySelector('meta[property="og:title"]');
      if (og && og.getAttribute('content')) heads.push(clip(og.getAttribute('content')));
      return { heads, text: (document.body && document.body.innerText) || '', pw: !!document.querySelector('input[type=password]') };
    }).catch(() => null);
    if (!one) continue;
    headings.push(...one.heads);
    if (text.length < 20000) text += (text ? '\n' : '') + one.text;
    hasPassword = hasPassword || one.pw;
  }
  return { docTitle, headings: headings.slice(0, 60), text: text.slice(0, 20000), hasPassword };
}

async function observeLive(t, holder) {
  await ctx.clearCookies().catch(() => {});
  const page = await ctx.newPage();
  holder.page = page;
  try {
    let res = null;
    try { res = await page.goto(t.url, { waitUntil: 'domcontentloaded', timeout: GOTO_MS }); } catch (e) { return { error: String((e && e.message) || e) }; }
    const probes = t.titles.map(probeOf).filter((p) => p.length >= 4);
    if (probes.length) {
      await page.waitForFunction((ps) => { const s = (document.body && document.body.innerText) || ''; return ps.some((p) => s.includes(p)); }, probes, { timeout: TITLE_WAIT_MS }).catch(() => {});
    }
    await page.waitForTimeout(600).catch(() => {});
    const seen = await readPage(page);
    return { status: res ? res.status() : 0, finalUrl: page.url(), ...seen };
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

function buildReport({ sum, newBad, blocked, ledgerBad, note }) {
  const ran = { post: 0, unread: 0, bad: 0 };
  for (const r of results) { if (r.v === 'post') ran.post += 1; else if (r.v === 'unread') ran.unread += 1; else ran.bad += 1; }
  const L = [];
  L.push(`## 🔗 원문 링크 확인 리포트 (${new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 16).replace('T', ' ')} KST · 기준일 ${TODAY})`);
  L.push('');
  L.push('앱이 보여 주는 원문 링크를 **학생처럼**(로그인·리퍼러 없는 새 탭) 열어, 그 공고가 실제로 뜨는지 봤습니다.');
  L.push('🔴 이 로봇은 주소를 고치지 않습니다 — 확정된 문제만 `data/link-check.json` 에 적고, 앱은 그 링크의 이름을 바꿔 정직하게 보여 줍니다(예: "게시판 목록에서 보기", "원문 공고(확인 필요)").');
  L.push('');
  if (note) { L.push(note); L.push(''); }
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
  L.push(`- 층2(한국장학재단에 등록된 재단 장학금): ${skipped.kosaf.items}건 — 재단 홈페이지 주소뿐이라 앱이 늘 "재단 홈페이지"라고 부릅니다(그중 공고문 사본이 있는 것 ${skipped.kosaf.withFiles}건)`);
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
  const report = buildReport({ sum, newBad, blocked: [...blockedMap], ledgerBad, note: note || stopNote });
  if (!DRY) {
    save(STATE_FILE, JSON.stringify(state, null, 1));
    save(LEDGER_FILE, JSON.stringify({ updatedAt: new Date().toISOString(), v: 1, bad: ledgerBad }, null, 1));
    save(REPORT_FILE, report);
  }
  console.log(report);
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `checked=${results.length}\nnew_bad=${newBad.length}\nconfirmed=${Object.keys(ledgerBad).length}\npending=${sum.pending.length}\n`);
  }
  return { newBad, ledgerBad, sum };
}

/* ── 돌리기 ─────────────────────────────────────────────────────── */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const budget = makeBudget(BUDGET_MS);
console.log(`원문 링크 확인 — 앱에 실린 링크 ${targets.length}건 · 이번 순서 ${queue.length}건 · 기준일 ${TODAY}${fake ? ' · 가짜 관측(인터넷 없이)' : ''}${DRY ? ' · 모의 실행' : ''}`);
if (!fake && queue.length) await openBrowser();
const remaining = [...queue];
const lastHit = new Map();
while (remaining.length) {
  if (!budget.hasRoom(URL_HARD_MS)) { stopNote = `⏰ 예산(${Math.round(BUDGET_MS / 60000)}분)이 다 돼 여기서 멈췄습니다 — 남은 ${remaining.length}건은 다음 실행이 이어서 봅니다.`; break; }
  const pick = pickNext(remaining, lastHit, Date.now(), SPACING_MS);
  if (pick.index < 0) { await sleep(Math.min(Math.max(pick.wait, 50), 5000)); continue; }
  /* 브라우저가 죽었으면 남은 것을 '판정 못 함'으로 채우지 않고 멈춘다 — 다음 실행이 이어서 본다 */
  if (browser && !browser.isConnected()) { stopNote = `🚨 브라우저가 도중에 꺼져 여기서 멈췄습니다 — 남은 ${remaining.length}건은 다음 실행이 이어서 봅니다.`; break; }
  const t = remaining.splice(pick.index, 1)[0];
  const obs = await observe(t);
  lastHit.set(t.host, Date.now());
  const verdict = judgeLanding({ ...obs, requestedUrl: t.url, titles: t.titles, otherTitles: otherTitlesFor(t, targets, siteTitles) });
  const final = obs.finalUrl && obs.finalUrl !== t.url ? obs.finalUrl : undefined;
  results.push({ url: t.url, host: t.host, v: verdict.v, why: verdict.why, final });
  console.log(`  ${verdict.v.padEnd(6)} ${t.host} · ${short(t.title, 40)} (${short(verdict.why, 50)})`);
}
finalize(null);
if (browser) await withDeadline(browser.close().catch(() => {}), 10000);
process.exit(0);

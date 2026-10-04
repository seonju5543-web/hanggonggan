/* ============================================================
   등록 공고의 '본문 없는 원문'을 브라우저로 다시 받는다 (2026-08-23 신설)

   왜 만들었나 — 개발자 지적: "요건을 못 읽었다고 뜨는 공고를 API로도 못 읽는다는 건
   말이 안 되잖아." 맞다. **AI가 못 읽은 게 아니라 읽을 본문이 저장돼 있지 않았다.**
   빈칸 70건을 원인별로 세어 보니:
     ① 원문 없음·오류화면          21건
     ② 원문은 있는데 게시판 메뉴뿐  29건   ← 이 로봇의 대상
     ③ 본문은 있는데 자격 절 못 찾음 20건   ← 이건 AI(eligibility-ai)의 몫
   ②의 실제 모습: 세종이도 5,439자를 받아 놓고 공고 본문은 한글 191자,
   나머지는 로그인·사이트맵·학사일정. 일반 fetch로는 몇 번을 받아도 똑같다 —
   서강·부산·건국·명지처럼 **본문을 자바스크립트로 그리는** 게시판이기 때문이다.

   브라우저는 이 페이지들을 이미 그릴 수 있다. 브라우저 수집기(browser-collect)가
   **새로 발견한 공고**에 대해서는 하고 있다 — 등록된 옛 공고를 다시 안 볼 뿐이다.
   그 빈자리를 메운다.

   🔴 **브라우저 수집기를 고치지 않았다.** 그 파일은 686줄에 시간 예산·회전 커서 등
   어렵게 얻은 로직이 얽혀 있고, 이 저장소는 수집 로봇이 시간초과로 죽어 그날 수집분을
   통째로 잃은 적이 세 번 있다. 별도 로봇이면 무슨 일이 있어도 일일 수집을 못 죽인다.
   판정 규칙(무엇이 '본문 있는 원문'인가)은 notice-source.mjs 하나를 그대로 쓰므로
   두 로봇이 갈라지지 않는다.

   실행: node collector/rescue-bodies.mjs           (미리보기 — 브라우저 안 켠다)
         node collector/rescue-bodies.mjs --write   (실제로 받아서 저장)
   ============================================================ */
import fs from 'node:fs';
import { htmlToLines } from './html-text.mjs';
import { chromium } from 'playwright';
import { createRequire } from 'node:module';
import { indexTexts, hasText, canonUrl, MIN_BODY } from './notice-source.mjs';
import { makeStripper } from './page-boilerplate.mjs';
import { withDeadline, TIMED_OUT, makeBudget } from './harvest-budget.mjs';
import { readLinkFixes, humanFixUrlBy } from './link-fixes-read.mjs';
/* 대상 거르기·차례·장부 한 칸·첨부 합치기는 순수 함수 파일 하나에 — 이 파일은 불러오는 순간 돌아 관문이 못 부른다 */
import { restingAfterOk, closedForStudents, orderTargets, ledgerEntry, newAttachments } from './rescue-plan.mjs';

const { requirementLines } = createRequire(import.meta.url)('../match-engine.js');
const HERE = new URL('.', import.meta.url);
const bodiesPath = new URL('extracted/browser-bodies.json', HERE);
const ledgerPath = new URL('rescue-ledger.json', HERE);
const reportPath = new URL('rescue-report.md', HERE);

const WRITE = process.argv.includes('--write');
const BUDGET_MS = Number(process.env.RESCUE_BUDGET_MS || 12 * 60 * 1000);
const PAGE_MS = Number(process.env.RESCUE_NOTICE_MS || 60000);   // 한 공고 절대 시한 — 아래 목록 돌기 참고 (관문은 짧게 줄여 돌린다)
const GAP_MS = Number(process.env.RESCUE_GAP_MS || 2500);        // 공고 사이 쉼 — 같은 학교를 몰아치지 않는다
const CAP = Number(process.env.RESCUE_CAP || 25);
const CTX_OPTS = {
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
  locale: 'ko-KR',
};
/* 한 공고를 이만큼 시도해도 본문이 안 나오면 잠시 쉰다. 영구 포기는 없다 —
   게시판이 고쳐지거나 우리 판정이 나아질 수 있다(링크 사냥꾼과 같은 원칙). */
const REST_AFTER = 3;
const REST_DAYS = 7;
/* 봇 차단 화면 표지 — 홍익대가 쓰는 STCLab 봇매니저가 대표적이다 */
const BOT_WALL = /botmanager|stclab|Security Verification|자동입력\s*방지/i;
const UA = { 'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36' };

const log = (m) => console.log(`[rescue] ${m}`);
let regDirty = false;
const today = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);

const regPath = new URL('../data/registered.json', HERE);
const reg = JSON.parse(fs.readFileSync(regPath, 'utf8'));
let texts = [];
try { texts = JSON.parse(fs.readFileSync(new URL('extracted/notices-text.json', HERE), 'utf8')); } catch { /* 없으면 0건 */ }
let bodies = {};
try { bodies = JSON.parse(fs.readFileSync(bodiesPath, 'utf8')); } catch { /* 첫 실행 */ }
let ledger = {};
try { ledger = JSON.parse(fs.readFileSync(ledgerPath, 'utf8')); } catch { /* 첫 실행 */ }

const strip = makeStripper(texts);
const report = ['# 자격요건 매칭 · 공고 본문 재수집 리포트', '', `실행: ${today}`, ''];

/* ── 대상 고르기 ──
   '#n-' 표식은 게시판 목록 주소라 그 공고 본문이 아니다(detail-url.mjs 참조) — 링크 사냥꾼의 몫. */
export function pickTargets(items) {
  const out = [];
  for (const it of items) {
    if (it.program) continue;
    const url = it.sourceUrl || '';
    if (!/^https?:\/\//.test(url) || url.includes('#n-')) continue;
    /* 🔴 **기준은 '본문이 없나'가 아니라 '아직 자격을 못 읽었나'다** (2026-08-23 수정).
       처음엔 `!hasText()` 로 골랐다. 그런데 본문 문턱을 300 → 100 으로 내리자
       메뉴만 있는 페이지들이 '본문 있음'으로 보이게 돼 **이 로봇이 아예 안 갔고**,
       그래서 포스터 그림도 못 찾고 첨부 목록도 안 고쳐졌다 — 43건이 그 상태였다.
       읽을 재료를 찾으러 가는 로봇이므로, **아직 못 읽은 공고면 다시 가 본다.**
       이미 읽은 공고는 건드리지 않는다(요건이 있으면 재료를 더 찾을 이유가 없다). */
    if (requirementLines(it).length) continue;
    /* 통짜 한 줄로 저장된 본문도 다시 받는다 — 줄바꿈이 없으면 AI가 줄 번호를 못 매기고
       표 구조도 사라져 있으나 마나다(위 주석 참조). */
    const led = ledger[canonUrl(url)];
    /* 🔴 **판정이 느슨해졌으면 쉬는 중이라도 다시 해 본다** (2026-08-23).
       실패 횟수는 '그때의 코드와 그때의 문턱'으로 센 값이다. 문턱을 300 → 100으로
       내리자 42건 전부가 '3회 실패, 7일 휴식' 상태였는데, 그 셋 중 마지막 판은
       **100~299자 본문을 받아 놓고 버린 것일 수 있다.**
       고장 났던 코드로 센 실패 때문에 멀쩡한 공고가 쉬면 안 된다.
       notice-source의 `needsFetch`가 '지금보다 짧은 한도로 잘렸으면 다시 받는다'로
       같은 문제를 푸는 것과 같은 규칙이다. */
    const staleJudgment = led && led.minBody !== undefined && led.minBody > MIN_BODY;
    if (!staleJudgment && led && led.tries >= REST_AFTER && led.at && daysBetween(led.at, today) < REST_DAYS) continue;
    /* 🔴 본문을 이레 안에 확보한 공고는 다시 안 연다 (2026-10-04 · run #53~#55 실측: 같은 세 건이 매 실행 맨 앞 세 자리를 차지했다).
       대상 기준(자격 줄 없음)과 성공 기준(본문 있음)이 달라, 본문은 받았는데 자격 절만 없는 공고가 계속 대상에 남는다 —
       그건 발췌기·AI 의 몫이다. 학생 화면에서 내려간 공고(마감 지남 · 오래됨)도 열지 않는다. 규칙은 rescue-plan.mjs 한 곳. */
    if (restingAfterOk(led, today) || closedForStudents(it, today)) continue;
    out.push({ it, url, tries: (led && led.tries) || 0, everOk: !!(led && led.ok) });
  }
  /* 안 해 본 것부터 — 안 그러면 한도(25건)가 매번 앞쪽 같은 것만 다시 붙든다
     (eligibility-ai에서 실제로 겪은 함정) · 같으면 한 번도 본문을 못 받은 것 먼저 */
  return orderTargets(out);
}

/* ── 저장은 한 곳에서 ──
   오래 걸리는 로봇은 '넘어져도 저장'이 필수다. 링크 사냥꾼이 리포트 마지막 줄의
   낱말 하나 때문에 넘어져 4분간 찾은 13건을 통째로 버린 적이 있다.
   🔴 **공고 하나가 끝날 때마다** 부른다(아래 목록 돌기 finally) — 2026-10-04 run #53 은 넷째 공고에서 멈춰 단계 시한(11분)에
      잘렸고, 끝에서 한 번만 저장하던 탓에 이미 받은 3건까지 잃었다. 단계 시한은 '넘어짐'이 아니라 강제 종료라
      신호 처리기로는 못 살린다(그날 node 는 시한 뒤에도 고아로 남아 있었다). progress 는 리포트 끝 '(진행 중 …)' 꼬리. */
function saveAll(crashNote, progress = '') {
  if (!WRITE) return;
  const cutoff = new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10);
  const keep = {};
  for (const [u, v] of Object.entries(bodies)) if (!v.at || v.at >= cutoff) keep[u] = v;
  fs.writeFileSync(bodiesPath, JSON.stringify(keep, null, 1));
  fs.writeFileSync(ledgerPath, JSON.stringify(ledger, null, 1));
  if (regDirty) fs.writeFileSync(regPath, JSON.stringify(reg, null, 1) + '\n');
  if (crashNote) report.push('', `🚨 도중에 넘어졌습니다: ${crashNote}`);
  fs.writeFileSync(reportPath, [...report, ...(progress && !crashNote ? ['', progress] : [])].join('\n') + '\n');
}
const onCrash = (e) => { try { saveAll(String((e && e.message) || e).slice(0, 200)); } catch { /* 저장도 실패하면 어쩔 수 없다 */ } process.exit(1); };
process.on('uncaughtException', onCrash);
process.on('unhandledRejection', onCrash);

/* ── 본편 ── */
const targets = pickTargets(reg.items);
log(`대상 ${targets.length}건 (아직 자격을 못 읽은 공고 — 읽을 재료를 찾으러 간다)`);
if (targets.length) log(`차례: ${targets.slice(0, 10).map((t) => t.it.id).join(' · ')}${targets.length > 10 ? ' …' : ''}`);
report.push(`대상 **${targets.length}건** · 이번 실행 한도 ${CAP}건`, '');
if (!WRITE) { log('미리보기 — --write 를 붙여야 실제로 받는다'); process.exit(0); }
if (!targets.length) { saveAll(); process.exit(0); }

let browser = await chromium.launch({ args: ['--no-sandbox'] });
let ctx = await browser.newContext(CTX_OPTS);
const settle = (p, ms) => withDeadline(Promise.resolve(p).catch(() => TIMED_OUT), ms);

/* 멈춘 공고를 버린 뒤에는 **새 창(context)** 으로 — 시한에 걸린 페이지의 렌더러가 남아 다음 공고까지 붙들 수 있다.
   브라우저가 끊겼거나 새 창조차 못 열면 다시 띄운다(activity-docs.mjs openBrowser 와 같은 꼴). 닫기·띄우기도 전부 시한 안에서
   — 시한 없는 브라우저 호출 하나가 단계 시한까지 서 있게 만든 것이 이번 사고였다. 끝내 못 열면 거짓(여기까지 저장하고 멈춘다). */
async function freshContext() {
  await settle(ctx.close(), 5000);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (attempt || !browser.isConnected()) {
      await settle(browser.close(), 5000);
      const b = await settle(chromium.launch({ args: ['--no-sandbox'] }), 30000);
      if (b === TIMED_OUT) return false;
      browser = b;
    }
    const c = await settle(browser.newContext(CTX_OPTS), 15000);
    if (c !== TIMED_OUT) { ctx = c; log('새 창으로 이어 간다'); return true; }
  }
  return false;
}

const fixUrl = humanFixUrlBy(readLinkFixes(new URL('../data/link-fixes.json', HERE)));
const budget = makeBudget(BUDGET_MS);
const total = Math.min(CAP, targets.length);
let got = 0, miss = 0, done = 0, gone = 0, hung = 0;
const progress = () => `(진행 중 ${done}/${total} — 확보 ${got} · 본문 없음 ${miss} · 시한 초과 ${hung} · 삭제 ${gone})`;
for (const t of targets) {
  if (done >= CAP) { log(`이번 실행 한도(${CAP}건) 도달`); break; }
  /* 시간 예산은 **시작 전에** 본다 — 예산을 넘긴 채 시작하면 강제 종료로 저장까지 죽는다
     (2026-08-17 사고: 학교 하나가 멈춰 그날 수집분 전량 유실). 공고 하나 최악(시한 PAGE_MS + 봇 차단 물러서기 20초 + 여유 5초)이
     들어갈 자리가 남았을 때만 시작한다 — 예산 9분 + 그 1분 25초 + 저장 < 단계 시한 11분. */
  if (!budget.hasRoom(PAGE_MS + 25000)) { log('시간 예산 도달 — 나머지는 다음 실행'); break; }
  done += 1;
  const key = canonUrl(t.url);
  const name = t.it.name.slice(0, 60);
  log(`▶ ${done}/${total} ${t.it.name.slice(0, 40)}`);
  try {
    /* 관리자가 원문을 바로잡은 공고는 **그 주소**를 연다(앱이 학생에게 여는 주소와 같다) — 본문은 그대로 원래 주소 열쇠(t.url)에 둔다(발췌기가 그 열쇠로 찾는다) */
    const openUrl = fixUrl(t.it) || t.url;
    const page = await settle(ctx.newPage(), 15000);
    if (page === TIMED_OUT) {
      report.push(`- ⏱ ${t.it.name.slice(0, 40)} — 브라우저가 새 탭을 열지 못해 건너뜀(공고 탓이 아니라 장부에 안 적음)`);
      if (!(await freshContext())) { log('브라우저를 다시 띄우지 못함 — 여기까지 저장하고 멈춘다'); break; }
      continue;
    }
    /* 🔴 **한 공고에 절대 시한** (2026-10-04 · 자격요건 로봇 첫 클라우드 실행): 예산은 '시작 전'에만 봤다 —
       넷째 공고에서 브라우저 호출 하나가 돌아오지 않아 10분을 서 있다가 단계 시한(11분)에 잘렸고,
       saveAll 까지 못 가 **이미 받은 3건도 잃었다.** 시한이 지나면 그 페이지를 버리고 다음으로 간다
       (harvest-budget withDeadline — 수집기와 같은 규칙).
       🔴 아래 읽기는 **등록 항목(t.it)·리포트를 직접 고치지 않는다** — 결과를 돌려주기만 한다. 시한 뒤 늦게 끝난 읽기가
          다음 공고를 도는 사이 첨부를 몰래 덧붙이면 그 공고는 '시한 초과'인데 registered.json 이 바뀐다(점검 bodies-1). */
    const read = (async () => { try {
      await page.goto(openUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(6000);           // 자바스크립트가 본문을 그릴 시간 (4초로는 모자란 학교가 있었다)
      const finalUrl = page.url();      // 봇 차단은 최종 주소가 challenge 로 바뀌는 것으로 드러난다
      /* 🔴 **줄바꿈을 없애면 안 된다** (2026-08-23 실측으로 배웠다).
         처음엔 태그를 정규식으로 벗기고 `\s+ → ' '`로 눌렀는데, 그러면 본문이
         **통짜 한 줄**이 된다. 그 한 줄은 ① AI가 줄 번호를 못 매겨 대상에서 빠지고
         ② 표의 칸 구분(공통 / 재학생 / 신규자)이 통째로 사라진다 —
         이 작업의 핵심이 바로 그 구조를 살리는 것인데 받아 오는 자리에서 죽이고 있었다.
         `innerText`는 브라우저가 화면에 그린 그대로의 줄바꿈을 준다. */
      /* ① 화면을 덮은 팝업을 먼저 치운다. 동국대는 '오늘 하루 보지 않기' 팝업이
         본문을 가려서, 받아 온 글자가 `불교동아리 소식 · 공양기도문 · POPUP`뿐이었다
         (CLAUDE.md에 이미 적혀 있던 함정인데 이 로봇을 만들 때 빠뜨렸다).
         보통 클릭이 막히므로 evaluate로 직접 누른다 — 같은 이유로 목록 클릭도 그렇게 한다. */
      for (const label of ['오늘 하루 보지 않기', '오늘하루 열지 않기', '오늘 하루 열지 않기', '팝업 닫기', '닫기']) {
        try {
          const el = page.locator(`text=${label}`).first();
          if (await el.count()) await el.evaluate((e) => e.click());
        } catch { /* 없으면 그만 */ }
      }
      /* ② **프레임 안까지 읽는다.** 일부 학교는 본문을 iframe에 그린다 —
         주 프레임만 보면 메뉴와 팝업만 손에 남는다(브라우저 수집기는 이미 frames()를 본다).
         메뉴가 섞여도 괜찮다 — 걷어내는 일은 page-boilerplate가 한다. */
      const parts = [];
      for (const f of page.frames()) {
        try { parts.push(await f.locator('body').innerText({ timeout: 3000 })); } catch { /* 죽은 프레임은 건너뛴다 */ }
      }
      const text = parts.join('\n')
        .replace(/[ \t\u00a0]+/g, ' ')
        .split('\n').map((l) => l.trim()).filter(Boolean).join('\n');

      /* 🔴 **첨부 목록도 같이 받아 적는다** (2026-08-23).
         페이지를 이미 열어 놓고 첨부 이름을 눈앞에 두고도 기록을 안 고치고 있었다.
         그 사이 우리가 가진 목록은 낡아서, 게시판에는 공고문이 붙어 있는데
         우리 기록엔 서식·동의서만 있어 무료 경로가 못 읽는 일이 생겼다:
           건국대 의암 손병희 — 게시판 `…우수 논문 장학생 선발.hwp` / 기록 `서식 및 작성요령.hwp`
           조선대 교내장학금 — 게시판 `…교내장학금 신청 안내.pdf` / 기록 `개인정보수집이용제공동의서.pdf`
         추가 페이지 열기가 0회라 시간 예산에 아무 영향이 없다. 여기서는 모으기만 하고, 적는 것은 시한 안에 끝났을 때 아래에서. */
      const found = [];
      try {
        for (const f of page.frames()) {
          const links = await f.$$eval('a[href]', (as) => as.map((a) => ({
            name: (a.textContent || '').replace(/\s+/g, ' ').trim(), url: a.href,
          }))).catch(() => []);
          for (const l of links) {
            if (!/\.(hwp|hwpx|pdf|docx?|xlsx?|zip)(\?|$)/i.test(l.name) && !/download|file|attach/i.test(l.url)) continue;
            const nm = l.name.replace(/\s*미리보기\s*$/, '').replace(/^\d+\.\s*/, '').trim();
            if (nm.length >= 5 && nm.length <= 120 && !found.some((x) => x.name === nm)) found.push({ name: nm, url: l.url });
          }
        }
        /* 🔴 **본문이 이미지인 공고가 있다** (2026-08-23). `[홍보]`가 붙은 공고들은
           글자 없이 포스터 그림만 올려 둔다 — innerText 로는 한 글자도 안 잡히니
           '본문이 없다'로 보이지만 실제로는 **눈으로 읽을 내용이 있다.**
           큰 그림만 담는다(가로·세로 300px 이상) — 아이콘·로고·버튼을 담으면
           자격을 읽으라고 로고를 보내는 꼴이 된다. */
        for (const f of page.frames()) {
          const imgs = await f.$$eval('img', (els) => els
            .filter((e) => e.naturalWidth >= 300 && e.naturalHeight >= 300)
            .map((e) => ({ url: e.currentSrc || e.src, w: e.naturalWidth, h: e.naturalHeight }))).catch(() => []);
          for (const im of imgs) {
            if (!im.url || /^data:/.test(im.url)) continue;
            const nm = `본문이미지-${im.w}x${im.h}.${(im.url.match(/\.(png|jpe?g|gif|webp)(\?|$)/i) || [, 'jpg'])[1]}`;
            if (!found.some((x) => x.url === im.url)) found.push({ name: nm, url: im.url, bodyImage: true });
          }
        }
      } catch { /* 첨부를 못 걷어도 본문 저장은 계속한다 */ }
      return { text, finalUrl, found };
    } catch (e) {
      return { text: '', finalUrl: '', found: [], error: String(e.message) };
    } })();
    const timedOut = await withDeadline(read, PAGE_MS) === TIMED_OUT;
  page.close().catch(() => {});   // 기다리지 않는다 — 멈춘 페이지는 닫기도 멈출 수 있다 (들여쓰기 두 칸은 test-collector 「자격요건 로봇」 글자 검사가 찾는 꼴)
    if (timedOut) {
      hung += 1;
      ledger[key] = ledgerEntry(ledger[key], 'hung', { today, minBody: MIN_BODY, name });
      report.push(`- ⏱ ${t.it.name.slice(0, 40)} — ${PAGE_MS / 1000}초 안에 끝나지 않아 건너뜀 (${ledger[key].tries}회째)`);
      log(`⏱ ${t.it.name.slice(0, 30)} — 시한 초과`);
      if (!(await freshContext())) { log('브라우저를 다시 띄우지 못함 — 여기까지 저장하고 멈춘다'); break; }
      continue;
    }
    const r = await read;
    let { text, finalUrl } = r;
    if (r.error) report.push(`- ✕ ${t.it.name.slice(0, 40)} — 열지 못함: ${r.error.slice(0, 60)}`);
    const add = newAttachments(t.it.attachments, r.found);
    if (add.length) {
      t.it.attachments = [...(t.it.attachments || []), ...add];
      regDirty = true;
      const pic = add.filter((a) => a.bodyImage).length;
      report.push(`- 📎 ${t.it.name.slice(0, 36)} — 첨부 ${add.length}개를 새로 받아 적음${pic ? ` (그중 **본문 그림 ${pic}장**)` : ''}: ${add.map((a) => a.name).join(' , ').slice(0, 90)}`);
    }

    /* 🔴 **봇 차단은 브라우저만 막는다 — 그럴 땐 일반 fetch로 물러선다** (2026-08-23 실측).
       홍익대는 브라우저로 열면 `cdn-botmanager.stclab.com/…/challenge`(제목 `Security
       Verification`)로 튕기는데, **일반 fetch로 받아 둔 원문 13건에는 봇 차단 화면이 0건**이다.
       STCLab 봇매니저가 헤드리스 브라우저만 잡는 것이다.
       그래서 대안은 '브라우저를 더 잘 위장한다'가 아니라 '막히면 다른 길로 간다'이다 —
       브라우저가 필요했던 이유(본문을 JS로 그린다)와 봇 차단은 서로 다른 문제이고,
       봇 차단이 걸린 게시판은 대개 서버가 완성된 HTML을 준다. */
    if (BOT_WALL.test(text) || BOT_WALL.test(String(finalUrl))) {
      report.push(`- 🤖 ${t.it.name.slice(0, 36)} — 브라우저가 봇 차단에 걸려 일반 내려받기로 물러섬`);
      try {
        const res = await fetch(openUrl, { redirect: 'follow', headers: UA, signal: AbortSignal.timeout(20000) });
        if (res.ok) {
          const html = await res.text();
          text = htmlToLines(html);   // HTML → 줄 글자는 html-text.mjs 한 곳 (2026-09-30)
        }
      } catch { /* 이쪽도 안 되면 그냥 실패로 둔다 */ }
    }

    /* 받아 온 글자가 **본문인지**는 notice-source의 규칙 하나로만 판단한다.
       여기에 규칙을 한 벌 더 두면 "재수집기는 됐다는데 발췌기는 못 읽는" 어긋남이 생긴다. */
    /* 게시판에서 내려간 공고는 '못 받은 것'이 아니라 '없어진 것'이다 — 섞으면
       영영 다시 받으려 애쓴다. 건국대 총동문회 장학생이 실제로 이 상태였다. */
    if (/게시물이?\s*\(?가?\)?\s*존재\s*하지\s*않|삭제된?\s*게시물|없는 게시물/.test(text)) {
      gone += 1;
      ledger[key] = { tries: REST_AFTER, at: today, minBody: MIN_BODY, gone: true, name };
      report.push(`- 🗑 **${t.it.name.slice(0, 40)}** — 게시판에서 내려갔습니다(삭제된 공고). 등록 목록에서 뺄지 검토가 필요합니다.`);
      log(`🗑 ${t.it.name.slice(0, 30)} — 삭제된 공고`);
      continue;
    }
    const entry = { title: t.it.name, text: text.slice(0, 15000), at: today, via: 'rescue' };
    /* 🔴 **빈 말뭉치로 재면 안 된다** (2026-08-23 실측). 메뉴를 걷어내는 규칙은
       '같은 학교의 여러 공고에 똑같이 나오는 줄'을 찾는 것이라 **원문 전체가 필요하다.**
       처음엔 `indexTexts([], …)`로 재서 걷어낼 게 없었고, 그래서 메뉴 글자가 본문으로
       세어져 정읍시민장학재단(한글 387자가 전부 메뉴)이 '확보 ✅'로 통과했다.
       같은 말뭉치를 써야 재수집기·발췌기·AI가 같은 판정을 한다 — 갈라지면
       "재수집기는 됐다는데 발췌기는 못 읽는" 일이 생긴다. */
    /* 🔴 지금까지 받아 둔 브라우저 본문도 같이 넣는다 (2026-09-15 코드 리뷰). 메뉴 목록은 브라우저가
       그린 판에서도 따로 배우는데(page-boilerplate `makeStripperMulti`), 이 한 건만 넣으면 표본이
       한 쪽뿐이라 아무것도 못 배워 **여기서는 '본문 확보', 발췌기에서는 '껍데기'** 로 갈린다
       (의암 손병희: 163자 vs 85자 실측). 같은 말뭉치여야 같은 판정이다. */
    const probe = indexTexts(texts, { ...bodies, [t.url]: entry });
    const ok = text && hasText(probe.byUrl.get(key) || entry);

    if (ok) {
      bodies[t.url] = entry;
      /* 지우지 않고 '확보한 날'을 적는다 — 지우면 tries 가 0 이 되어 다음 실행에 또 맨 앞에 온다(rescue-plan.mjs 머리말) */
      ledger[key] = ledgerEntry(ledger[key], 'ok', { today, minBody: MIN_BODY, name });
      got += 1;
      report.push(`- ✅ ${t.it.name.slice(0, 40)} — 본문 확보 (${text.replace(/[^가-힣]/g, '').length}자)`);
      log(`✅ ${t.it.name.slice(0, 30)}`);
    } else {
      /* 어떤 문턱으로 판정했는지 함께 남긴다 — 나중에 문턱이 내려가면 이 값을 보고 다시 해 본다 */
      ledger[key] = ledgerEntry(ledger[key], 'miss', { today, minBody: MIN_BODY, name });
      miss += 1;
      if (text) {
        /* 🔴 **실패할 때 무엇을 받았는지 남긴다** (2026-08-23 추가).
           예전엔 실패하면 받아 온 글자를 통째로 버려서, 왜 안 되는지 보려면 학교마다
           정찰을 따로 돌려야 했다. 원인이 학교마다 다르므로(팝업·JS 렌더·봇 차단·
           로그인 벽·PDF 첨부) 이 한 줄이 진단 한 판을 대신한다. */
        const left = strip(t.url, text).split('\n').filter(Boolean);
        report.push(`- · **${t.it.name.slice(0, 40)}** — 본문 없음 (${ledger[key].tries}회째)`);
        report.push(`    - 받아 온 줄 ${text.split('\n').length} · 메뉴 걷어낸 뒤 ${left.length}줄 · 한글 ${strip(t.url, text).replace(/[^가-힣]/g, '').length}자`);
        /* 표본을 넉넉히 남긴다 — 6줄만 봤을 때 동국대가 '본문이 없는' 것인지
           '팝업 글자가 앞을 채워 본문이 뒤로 밀린' 것인지 가릴 수 없었다. */
        report.push('```');
        left.slice(0, 20).forEach((l) => report.push(l.slice(0, 110)));
        report.push('```');
      }
      log(`· ${t.it.name.slice(0, 30)} — 본문 없음 (${ledger[key].tries}회째)`);
    }
    await new Promise((r2) => setTimeout(r2, GAP_MS));   // 같은 학교를 몰아치지 않는다
  } finally {
    saveAll('', progress());   // 🔴 공고마다 저장 — 위 saveAll 머리말
  }
}

await settle(browser.close(), 10000);   // 닫기도 시한 안에서 — 멈춘 브라우저의 닫기는 돌아오지 않을 수 있다
report.push('', `---`, `확보 **${got}건** · 본문 없음 ${miss}건 · 시한 초과 ${hung}건 · 삭제된 공고 ${gone}건 · 처리 ${done}/${targets.length}건`,
  `본문 판정 기준: 메뉴를 걷어낸 뒤 한글 ${MIN_BODY}자 이상 (notice-source.mjs) · 한 공고 시한 ${PAGE_MS / 1000}초`);
saveAll();
log(`끝 — 확보 ${got}건 · 본문 없음 ${miss}건 · 시한 초과 ${hung}건 · 삭제된 공고 ${gone}건`);
process.exit(0);

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
import { chromium } from 'playwright';
import { indexTexts, sourceFor, hasText, canonUrl, MIN_BODY } from './notice-source.mjs';
import { makeStripper } from './page-boilerplate.mjs';

const HERE = new URL('.', import.meta.url);
const bodiesPath = new URL('extracted/browser-bodies.json', HERE);
const ledgerPath = new URL('rescue-ledger.json', HERE);
const reportPath = new URL('rescue-report.md', HERE);

const WRITE = process.argv.includes('--write');
const BUDGET_MS = Number(process.env.RESCUE_BUDGET_MS || 12 * 60 * 1000);
const CAP = Number(process.env.RESCUE_CAP || 25);
/* 한 공고를 이만큼 시도해도 본문이 안 나오면 잠시 쉰다. 영구 포기는 없다 —
   게시판이 고쳐지거나 우리 판정이 나아질 수 있다(링크 사냥꾼과 같은 원칙). */
const REST_AFTER = 3;
const REST_DAYS = 7;

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

const idx = indexTexts(texts, bodies);
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
    /* 이미 본문이 있어도 **통짜 한 줄이면 다시 받는다** — 줄바꿈이 없는 본문은
       AI가 줄 번호를 못 매기고 표 구조도 못 읽어, 있으나 마나다(위 주석 참조). */
    const cur = sourceFor(it, idx);
    if (hasText(cur) && /\n/.test(String(cur.text || ''))) continue;
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
    out.push({ it, url, tries: (led && led.tries) || 0 });
  }
  /* 안 해 본 것부터 — 안 그러면 한도(25건)가 매번 앞쪽 같은 것만 다시 붙든다
     (eligibility-ai에서 실제로 겪은 함정) */
  out.sort((a, b) => a.tries - b.tries);
  return out;
}

/* ── 저장은 한 곳에서 ──
   오래 걸리는 로봇은 '넘어져도 저장'이 필수다. 링크 사냥꾼이 리포트 마지막 줄의
   낱말 하나 때문에 넘어져 4분간 찾은 13건을 통째로 버린 적이 있다. */
function saveAll(crashNote) {
  if (!WRITE) return;
  const cutoff = new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10);
  const keep = {};
  for (const [u, v] of Object.entries(bodies)) if (!v.at || v.at >= cutoff) keep[u] = v;
  fs.writeFileSync(bodiesPath, JSON.stringify(keep, null, 1));
  fs.writeFileSync(ledgerPath, JSON.stringify(ledger, null, 1));
  if (regDirty) fs.writeFileSync(regPath, JSON.stringify(reg, null, 1) + '\n');
  if (crashNote) report.push('', `🚨 도중에 넘어졌습니다: ${crashNote}`);
  fs.writeFileSync(reportPath, report.join('\n') + '\n');
}
const onCrash = (e) => { try { saveAll(String((e && e.message) || e).slice(0, 200)); } catch { /* 저장도 실패하면 어쩔 수 없다 */ } process.exit(1); };
process.on('uncaughtException', onCrash);
process.on('unhandledRejection', onCrash);

/* ── 본편 ── */
const targets = pickTargets(reg.items);
log(`대상 ${targets.length}건 (등록 공고 중 본문이 안 온 것)`);
report.push(`대상 **${targets.length}건** · 이번 실행 한도 ${CAP}건`, '');
if (!WRITE) { log('미리보기 — --write 를 붙여야 실제로 받는다'); process.exit(0); }
if (!targets.length) { saveAll(); process.exit(0); }

const browser = await chromium.launch({ args: ['--no-sandbox'] });
const ctx = await browser.newContext({
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
  locale: 'ko-KR',
});

const startedAt = Date.now();
let got = 0, miss = 0, done = 0, gone = 0;
for (const t of targets) {
  if (done >= CAP) { log(`이번 실행 한도(${CAP}건) 도달`); break; }
  /* 시간 예산은 **시작 전에** 본다 — 예산을 넘긴 채 시작하면 강제 종료로 저장까지 죽는다
     (2026-08-17 사고: 학교 하나가 멈춰 그날 수집분 전량 유실) */
  if (Date.now() - startedAt > BUDGET_MS) { log('시간 예산 도달 — 나머지는 다음 실행'); break; }
  done += 1;
  const key = canonUrl(t.url);
  const page = await ctx.newPage();
  let text = '';
  try {
    await page.goto(t.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(6000);           // 자바스크립트가 본문을 그릴 시간 (4초로는 모자란 학교가 있었다)
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
    text = parts.join('\n')
      .replace(/[ \t\u00a0]+/g, ' ')
      .split('\n').map((l) => l.trim()).filter(Boolean).join('\n');

    /* 🔴 **첨부 목록도 같이 받아 적는다** (2026-08-23).
       페이지를 이미 열어 놓고 첨부 이름을 눈앞에 두고도 기록을 안 고치고 있었다.
       그 사이 우리가 가진 목록은 낡아서, 게시판에는 공고문이 붙어 있는데
       우리 기록엔 서식·동의서만 있어 무료 경로가 못 읽는 일이 생겼다:
         건국대 의암 손병희 — 게시판 `…우수 논문 장학생 선발.hwp` / 기록 `서식 및 작성요령.hwp`
         조선대 교내장학금 — 게시판 `…교내장학금 신청 안내.pdf` / 기록 `개인정보수집이용제공동의서.pdf`
       추가 페이지 열기가 0회라 시간 예산에 아무 영향이 없다. */
    try {
      const found = [];
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
      const had = new Set((t.it.attachments || []).map((a) => a.name));
      const add = found.filter((a) => !had.has(a.name));
      if (add.length) {
        t.it.attachments = [...(t.it.attachments || []), ...add];
        regDirty = true;
        report.push(`- 📎 ${t.it.name.slice(0, 36)} — 첨부 ${add.length}개를 새로 받아 적음: ${add.map((a) => a.name).join(' , ').slice(0, 90)}`);
      }
    } catch { /* 첨부를 못 걷어도 본문 저장은 계속한다 */ }
  } catch (e) {
    report.push(`- ✕ ${t.it.name.slice(0, 40)} — 열지 못함: ${String(e.message).slice(0, 60)}`);
  } finally {
    await page.close().catch(() => {});
  }

  /* 받아 온 글자가 **본문인지**는 notice-source의 규칙 하나로만 판단한다.
     여기에 규칙을 한 벌 더 두면 "재수집기는 됐다는데 발췌기는 못 읽는" 어긋남이 생긴다. */
  /* 게시판에서 내려간 공고는 '못 받은 것'이 아니라 '없어진 것'이다 — 섞으면
     영영 다시 받으려 애쓴다. 건국대 총동문회 장학생이 실제로 이 상태였다. */
  if (/게시물이?\s*\(?가?\)?\s*존재\s*하지\s*않|삭제된?\s*게시물|없는 게시물/.test(text)) {
    gone += 1;
    ledger[key] = { tries: REST_AFTER, at: today, minBody: MIN_BODY, gone: true, name: t.it.name.slice(0, 60) };
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
  const probe = indexTexts(texts, { [t.url]: entry });
  const ok = text && hasText(probe.byUrl.get(key) || entry);

  if (ok) {
    bodies[t.url] = entry;
    delete ledger[key];
    got += 1;
    report.push(`- ✅ ${t.it.name.slice(0, 40)} — 본문 확보 (${text.replace(/[^가-힣]/g, '').length}자)`);
    log(`✅ ${t.it.name.slice(0, 30)}`);
  } else {
    /* 어떤 문턱으로 판정했는지 함께 남긴다 — 나중에 문턱이 내려가면 이 값을 보고 다시 해 본다 */
    ledger[key] = { tries: t.tries + 1, at: today, minBody: MIN_BODY, name: t.it.name.slice(0, 60) };
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
  await new Promise((r) => setTimeout(r, 2500));   // 같은 학교를 몰아치지 않는다
}

await browser.close().catch(() => {});
report.push('', `---`, `확보 **${got}건** · 본문 없음 ${miss}건 · 삭제된 공고 ${gone}건 · 처리 ${done}/${targets.length}건`,
  `본문 판정 기준: 메뉴를 걷어낸 뒤 한글 ${MIN_BODY}자 이상 (notice-source.mjs)`);
saveAll();
log(`끝 — 확보 ${got}건 · 본문 없음 ${miss}건 · 삭제된 공고 ${gone}건`);
process.exit(0);

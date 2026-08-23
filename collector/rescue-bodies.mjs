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
const today = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);

const reg = JSON.parse(fs.readFileSync(new URL('../data/registered.json', HERE), 'utf8'));
let texts = [];
try { texts = JSON.parse(fs.readFileSync(new URL('extracted/notices-text.json', HERE), 'utf8')); } catch { /* 없으면 0건 */ }
let bodies = {};
try { bodies = JSON.parse(fs.readFileSync(bodiesPath, 'utf8')); } catch { /* 첫 실행 */ }
let ledger = {};
try { ledger = JSON.parse(fs.readFileSync(ledgerPath, 'utf8')); } catch { /* 첫 실행 */ }

const idx = indexTexts(texts, bodies);
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
    if (led && led.tries >= REST_AFTER && led.at && daysBetween(led.at, today) < REST_DAYS) continue;
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
let got = 0, miss = 0, done = 0;
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
    await page.waitForTimeout(4000);           // 자바스크립트가 본문을 그릴 시간
    /* 🔴 **줄바꿈을 없애면 안 된다** (2026-08-23 실측으로 배웠다).
       처음엔 태그를 정규식으로 벗기고 `\s+ → ' '`로 눌렀는데, 그러면 본문이
       **통짜 한 줄**이 된다. 그 한 줄은 ① AI가 줄 번호를 못 매겨 대상에서 빠지고
       ② 표의 칸 구분(공통 / 재학생 / 신규자)이 통째로 사라진다 —
       이 작업의 핵심이 바로 그 구조를 살리는 것인데 받아 오는 자리에서 죽이고 있었다.
       `innerText`는 브라우저가 화면에 그린 그대로의 줄바꿈을 준다. */
    text = (await page.innerText('body'))
      .replace(/[ \t\u00a0]+/g, ' ')
      .split('\n').map((l) => l.trim()).filter(Boolean).join('\n');
  } catch (e) {
    report.push(`- ✕ ${t.it.name.slice(0, 40)} — 열지 못함: ${String(e.message).slice(0, 60)}`);
  } finally {
    await page.close().catch(() => {});
  }

  /* 받아 온 글자가 **본문인지**는 notice-source의 규칙 하나로만 판단한다.
     여기에 규칙을 한 벌 더 두면 "재수집기는 됐다는데 발췌기는 못 읽는" 어긋남이 생긴다. */
  const entry = { title: t.it.name, text: text.slice(0, 15000), at: today, via: 'rescue' };
  const probe = indexTexts([], { [t.url]: entry });
  const ok = text && hasText(probe.byUrl.get(key) || entry);

  if (ok) {
    bodies[t.url] = entry;
    delete ledger[key];
    got += 1;
    report.push(`- ✅ ${t.it.name.slice(0, 40)} — 본문 확보 (${text.replace(/[^가-힣]/g, '').length}자)`);
    log(`✅ ${t.it.name.slice(0, 30)}`);
  } else {
    ledger[key] = { tries: t.tries + 1, at: today, name: t.it.name.slice(0, 60) };
    miss += 1;
    if (text) report.push(`- · ${t.it.name.slice(0, 40)} — 열리긴 했지만 본문이 없다(메뉴뿐, ${ledger[key].tries}회째)`);
    log(`· ${t.it.name.slice(0, 30)} — 본문 없음 (${ledger[key].tries}회째)`);
  }
  await new Promise((r) => setTimeout(r, 2500));   // 같은 학교를 몰아치지 않는다
}

await browser.close().catch(() => {});
report.push('', `---`, `확보 **${got}건** · 본문 없음 ${miss}건 · 처리 ${done}/${targets.length}건`,
  `본문 판정 기준: 메뉴를 걷어낸 뒤 한글 ${MIN_BODY}자 이상 (notice-source.mjs)`);
saveAll();
log(`끝 — 확보 ${got}건 · 본문 없음 ${miss}건`);
process.exit(0);

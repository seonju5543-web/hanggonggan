/* 원문 링크 복구 로봇 (2026-07-31)

   앱에 이미 담겨 있는 공고 중 주소가 '게시판 목록 + 제목 표식'(#n-…)인 것들을 찾아,
   진짜 공고 원문 주소로 바꿔 놓는다. 사용자가 '원문 공고 ↗'를 눌렀을 때 학교 장학
   공지 목록 전체가 아니라 **그 장학금 공고 하나**가 열리게 하는 것이 목적이다.

   방법 (추측하지 않는다 — 열어서 확인한다):
   ① 표식이 가리키는 게시판 목록을 브라우저로 연다.
   ② 목록의 각 행을 실제로 눌러 상세 화면을 띄운다.
   ③ 상세 화면에서 'GET으로도 열리는 주소' 후보를 모은다
      (이동한 주소 · canonical · og:url · 숨은 입력칸의 글 번호로 조립한 view 주소).
   ④ 후보를 **새 탭에서 다시 열어** 제목이 일치하는지 확인한다. 통과한 것만 채택한다.
      (세션·리퍼러가 있어야만 열리는 주소를 앱에 넣으면 사용자에겐 안 열린다.)
   ⑤ 확인된 주소로 data/notices.json · data/registered.json을 고친다.
      끝내 못 찾은 공고는 표식을 그대로 두고 리포트에 남긴다 — 지어내지 않는다.

   실행: node collector/resolve-detail-urls.mjs [--dry]  (워크플로 resolve-detail-urls.yml) */
import fs from 'node:fs';
import { chromium } from 'playwright';
import { isMarkerUrl, markerTitle, listUrlOf, isDetailUrl, sameTitle, detailCandidates, idsFromSource } from './detail-url.mjs';

const HERE = new URL('.', import.meta.url);
const DRY = process.argv.includes('--dry');

const LIMIT_BOARDS = Number(process.env.RESOLVE_MAX_BOARDS || 20);
/* 실행 시간 상한 — 2차 실행이 40분을 넘겼다. 매주 도는 로봇이므로 한 번에 다 못 고쳐도
   다음 주에 이어서 고치면 된다. 시간을 넘기면 그때까지 고친 것만 저장하고 끝낸다. */
const BUDGET_MS = Number(process.env.RESOLVE_BUDGET_MS || 25 * 60000);
const startedAt = Date.now();
const outOfTime = () => Date.now() - startedAt > BUDGET_MS;

const noticesPath = new URL('../data/notices.json', HERE);
const registeredPath = new URL('../data/registered.json', HERE);
const notices = JSON.parse(fs.readFileSync(noticesPath, 'utf8'));
const registered = JSON.parse(fs.readFileSync(registeredPath, 'utf8'));

/* 고쳐야 할 항목 모으기 — 두 파일을 같은 방식으로 다룬다 */
const targets = [];
for (const n of notices.items || []) {
  if (isMarkerUrl(n.url)) targets.push({ kind: 'notice', ref: n, urlField: 'url', title: n.title, url: n.url });
}
for (const r of registered.items || []) {
  if (isMarkerUrl(r.sourceUrl)) targets.push({ kind: 'registered', ref: r, urlField: 'sourceUrl', title: r.name, url: r.sourceUrl, id: r.id });
}

/* 게시판별로 묶는다 — 게시판 하나를 한 번만 열기 위해 */
/* 게시판 하나만 돌리기 — 같은 학교를 하루에 여러 번 두드리면 서버가 막으므로
   (2026-07-31 동국대: 7번 돌린 뒤 멀쩡한 주소가 전부 404), 고칠 게 남은 학교만 골라 돈다.
   지정 방법 두 가지: 저장소 변수 RESOLVE_ONLY_BOARD, 또는 실행 트리거 파일의 `onlyBoard:` 줄
   (GitHub 설정에 손댈 수 없는 세션도 push만으로 지정할 수 있게 — deepfetch의 `targets:`와 같은 방식). */
function runFileSetting(key) {
  try {
    const txt = fs.readFileSync(new URL('run-resolve-urls.txt', HERE), 'utf8');
    const m = txt.match(new RegExp('^\\s*' + key + ':\\s*(.+)$', 'm'));
    return m ? m[1].trim() : '';
  } catch { return ''; }
}
const ONLY = process.env.RESOLVE_ONLY_BOARD || runFileSetting('onlyBoard');
// 이미 고친 주소 점검만 (게시판을 덜 두드린다) — 트리거 파일 `recheckOnly: true` 로도 지정 가능
const RECHECK_ONLY = process.argv.includes('--recheck-only') || runFileSetting('recheckOnly') === 'true';
const boards = new Map();
for (const t of targets) {
  const list = listUrlOf(t.url);
  if (ONLY && !list.includes(ONLY)) continue;
  if (!boards.has(list)) boards.set(list, []);
  boards.get(list).push(t);
}

const report = [`## 🔗 원문 링크 복구 리포트 (${new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 16).replace('T', ' ')} KST)`, ''];
report.push(`판: 7차(게시판 폼으로 원문 주소 조립) · 커밋 ${process.env.GITHUB_SHA ? process.env.GITHUB_SHA.slice(0, 7) : 'local'}`);
report.push(`고칠 대상: **${targets.length}건** (실시간 공고 ${targets.filter((t) => t.kind === 'notice').length} · 정식 등록 ${targets.filter((t) => t.kind === 'registered').length}) · 게시판 ${boards.size}곳`);
report.push('');

if (!targets.length) {
  fs.writeFileSync(new URL('resolve-report.md', HERE), report.concat(['', '✅ 목록 주소로 남아 있는 공고가 없습니다.']).join('\n'));
  console.log('resolve-detail-urls: nothing to do');
  process.exit(0);
}

const browser = await chromium.launch({ args: ['--no-sandbox'] });
const ctx = await browser.newContext({
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
  locale: 'ko-KR',
});

/* 상세 화면에서 후보 주소 만들 재료 걷기 */
async function readDom(page, listUrl) {
  const info = await page.evaluate(() => {
    const hidden = {};
    document.querySelectorAll('input[type=hidden], input[name]').forEach((i) => {
      if (i.name && i.value) hidden[i.name] = i.value;
    });
    const can = document.querySelector('link[rel=canonical]');
    const og = document.querySelector('meta[property="og:url"]');
    return {
      canonical: can ? can.getAttribute('href') : null,
      ogUrl: og ? og.getAttribute('content') : null,
      hiddenInputs: hidden,
      heading: (document.querySelector('h1,h2,h3,.title,.subject,.bbs-title,.view-title') || {}).textContent || '',
      bodyText: (document.body.innerText || '').slice(0, 4000),
    };
  }).catch(() => ({ hiddenInputs: {}, bodyText: '', heading: '' }));
  return { ...info, url: page.url(), listUrl };
}

/* 후보 주소를 '깨끗한 탭'에서 열어 정말 그 공고가 나오는지 확인한다.
   앱 사용자는 세션도 리퍼러도 없이 링크를 누르므로, 그 조건 그대로 확인해야 한다.

   1차 실행에서 배운 것 (2026-07-31):
   · 후보마다 새 브라우저 컨텍스트를 만들었더니 학교 서버가 연결을 끊었다(ERR_CONNECTION_CLOSED).
     → 확인용 컨텍스트를 하나만 만들어 재사용하고, 쿠키만 비워 '처음 온 사람' 상태를 유지한다.
   · 동국대 상세 화면은 자바스크립트로 나중에 그려져, 1.5초 뒤에 읽으면 제목이 아직 없었다.
     → 제목이 보일 때까지 기다렸다가 판정하고, 네트워크 오류는 '틀린 주소'가 아니라 '다시 시도'로 다룬다. */
let verifyCtx = null;
async function verifyContext() {
  if (!verifyCtx) {
    verifyCtx = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
      locale: 'ko-KR',
    });
  }
  await verifyCtx.clearCookies().catch(() => {});
  return verifyCtx;
}

function titleMatches(title, docTitle, text) {
  if (sameTitle(title, docTitle)) return true;
  const fp = (s) => String(s).replace(/[\s .,·ㆍ~〜'"“”‘’!?()[\]{}<>:;|/\\_+\-*&#%]/g, '').toLowerCase();
  const t = fp(String(title).replace(/^\s*\d{1,5}\s+/, '').replace(/^\s*(공통|서울|글로벌|국제|공지|홍보)\s+/, '').replace(/\[[^\]]{0,20}\]/g, ''));
  if (t.length < 8) return false;
  const body = fp(text);
  if (body.includes(t)) return true;
  // 제목이 길면 앞부분만으로도 판정 (상세 화면에서 제목이 줄바꿈·말줄임되는 경우)
  return t.length >= 24 && body.includes(t.slice(0, 24));
}

/* '이 화면이 목록인가 상세인가'를 가른다.
   제목이 화면에 있다는 것만으로는 부족하다 — **게시판 목록에도 그 제목이 있다**.
   실제로 3차 실행이 동국 진담거사 공고에 `view?nttId=533`(안내 페이지 번호)을 붙였고,
   그 화면에 제목이 보였다는 이유로 통과시켰다. 상세 화면에는 그 글 하나만 있고
   목록에는 다른 글 제목이 잔뜩 있으므로, 다른 글 제목이 여럿 보이면 목록으로 본다. */
function looksLikeList(text, otherTitles) {
  const fp = (s) => String(s).replace(/[\s .,·ㆍ~〜'"“”‘’!?()[\]{}<>:;|/\\_+\-*&#%]/g, '').toLowerCase();
  const body = fp(text);
  let hits = 0;
  for (const t of otherTitles) {
    const k = fp(String(t).replace(/^\s*\d{1,5}\s+/, '').replace(/^\s*(공통|서울|글로벌|국제|공지|홍보)\s+/, '').replace(/\[[^\]]{0,20}\]/g, ''));
    if (k.length >= 10 && body.includes(k)) hits += 1;
    if (hits >= 3) return true;
  }
  return false;
}

async function verifyCandidate(url, title, attempt = 0, otherTitles = []) {
  const c = await verifyContext();
  const p = await c.newPage();
  try {
    const res = await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    if (res && res.status() >= 400) {
      // 404도 한 번은 쉬었다 다시 본다 — 많이 두드리면 학교 서버가 404를 돌려주기도 한다
      if (attempt < 1) {
        await p.close().catch(() => {});
        await new Promise((r) => setTimeout(r, 5000));
        return verifyCandidate(url, title, attempt + 1, otherTitles);
      }
      return { ok: false, why: `HTTP ${res.status()}` };
    }
    // 제목이 화면에 나타날 때까지 기다린다 (동적으로 그리는 상세 화면 대응)
    const probe = String(title).replace(/^\s*\d{1,5}\s+/, '').replace(/^\s*(공통|서울|글로벌|국제|공지|홍보)\s+/, '').slice(0, 12).trim();
    if (probe.length >= 4) {
      await p.waitForFunction((needle) => (document.body && document.body.innerText || '').includes(needle),
        probe, { timeout: 6000 }).catch(() => {});
    }
    await p.waitForTimeout(800);
    const text = await p.evaluate(() => (document.body.innerText || '').slice(0, 12000)).catch(() => '');
    const docTitle = await p.title().catch(() => '');
    if (!titleMatches(title, docTitle, text)) return { ok: false, why: '제목 불일치(다른 글이 열림)' };
    // 제목이 보여도 다른 글 제목이 여럿 같이 보이면 그건 상세가 아니라 목록이다
    if (looksLikeList(text, otherTitles)) return { ok: false, why: '목록 화면(다른 공고 제목이 여럿 보임)' };
    return { ok: true };
  } catch (e) {
    const msg = (e.message || String(e)).split('\n')[0].slice(0, 60);
    // 학교 서버가 잠깐 연결을 끊은 것은 '주소가 틀렸다'는 뜻이 아니다 — 쉬었다 한 번 더
    if (attempt < 1 && /ERR_CONNECTION|ERR_NETWORK|Timeout|ERR_EMPTY/i.test(msg)) {
      await p.close().catch(() => {});
      await new Promise((r) => setTimeout(r, 4000));
      return verifyCandidate(url, title, attempt + 1, otherTitles);
    }
    return { ok: false, why: msg };
  } finally {
    await p.close().catch(() => {});
  }
}

/* 목록 한 페이지의 '누를 수 있는 행'을 걷는다.
   행마다 클릭 스크립트가 넘기는 글 번호까지 뽑아 둔다 — 경희처럼 클릭이 form POST라
   주소창이 안 바뀌는 게시판은 이 번호가 원문 주소를 만드는 유일한 재료다. */
const ROW_SEL = 'a[href], [onclick]';
async function scrapeRows(page) {
  return page.$$eval('a[href], [onclick]', (els) => els.map((e, i) => {
    const src = [e.getAttribute('onclick') || '', e.getAttribute('href') || '',
      e.getAttribute('data-id') || '', e.getAttribute('data-seq') || ''].join('|');
    return {
      i,
      t: (e.textContent || '').replace(/\s+/g, ' ').trim(),
      abs: e.tagName === 'A' ? (e.href || '') : '',
      src,
      html: (e.outerHTML || '').slice(0, 300),
    };
  }).filter((x) => x.t.length >= 6 && x.t.length <= 160)).catch(() => []);
}

/* 게시판을 여러 페이지 훑는다 — 앱에 담긴 공고 중에는 이미 1페이지에서 밀려난 것이 많다
   (1차 실행에서 '목록에서 못 찾음'이 68건 중 다수였던 이유). */
async function scrapeForms(page) {
  return page.evaluate(() => [...document.querySelectorAll('form')].slice(0, 4).map((f) => ({
    action: f.getAttribute('action') || '',
    fields: [...f.querySelectorAll('input,select')].map((i) => `${i.name}=${i.value}`).filter((x) => !x.startsWith('=')).slice(0, 16).join('&'),
  }))).catch(() => []);
}

async function scanBoard(page, listUrl, maxPages) {
  const seenTitles = new Set();
  const all = [];
  const addRows = (rows, pageNo) => {
    for (const r of rows) {
      const k = r.t + '|' + r.abs;
      if (seenTitles.has(k)) continue;
      seenTitles.add(k);
      all.push({ ...r, pageNo });
    }
  };
  addRows(await scrapeRows(page), 1);
  for (let p = 2; p <= maxPages; p += 1) {
    // 페이지 번호 링크를 찾아 누른다 (주소로 넘기는 게시판·스크립트로 넘기는 게시판 모두 대응)
    const clicked = await page.evaluate((n) => {
      const cands = [...document.querySelectorAll('a, button, [onclick]')]
        .filter((e) => (e.textContent || '').trim() === String(n));
      const el = cands.find((e) => /pag|page|num/i.test(e.className + ' ' + (e.parentElement || {}).className)) || cands[0];
      if (!el) return false;
      el.click();
      return true;
    }, p).catch(() => false);
    if (!clicked) break;
    await page.waitForTimeout(3000);
    const rows = await scrapeRows(page);
    if (!rows.length) break;
    addRows(rows, p);
  }
  return all;
}

let fixed = 0; let failed = 0;
const resolvedMap = {}; // 표식 주소 → 진짜 원문 주소 (기록용)

let boardCount = 0;
for (const [listUrl, group] of boards) {
  boardCount += 1;
  if (boardCount > LIMIT_BOARDS) { report.push(`- (게시판 상한 ${LIMIT_BOARDS} 초과 — 나머지는 다음 실행)`); break; }
  report.push(`### ${listUrl}`);
  report.push(`- 대상 ${group.length}건`);
  const page = await ctx.newPage();
  let opened = false;
  for (let attempt = 0; attempt < 3 && !opened; attempt += 1) {
    try {
      await page.goto(listUrl, { waitUntil: attempt >= 2 ? 'commit' : 'domcontentloaded', timeout: attempt ? 45000 : 30000 });
      opened = true;
    } catch (e) {
      if (attempt === 2) report.push(`- ❌ 게시판 열기 실패: ${(e.message || '').split('\n')[0].slice(0, 80)}`);
      else await page.waitForTimeout(3000 * (attempt + 1));
    }
  }
  if (!opened) { await page.close().catch(() => {}); report.push(''); continue; }
  await page.waitForTimeout(4000);

  /* 목록을 여러 페이지 훑어 '누를 수 있는 행'을 모은다 */
  const rows = await scanBoard(page, listUrl, Number(process.env.RESOLVE_MAX_PAGES || 6));
  const boardForms = await scrapeForms(page);   // 게시판이 스스로 쓰는 폼 — 원문 주소의 정답지
  const pagesSeen = Math.max(...rows.map((r) => r.pageNo), 1);
  report.push(`- 목록 ${pagesSeen}페이지에서 행 ${rows.length}개`);

  /* 이 게시판에서 '어떤 후보가 통했는지'를 기억해 둔다. 같은 게시판 안에서는 주소를 만드는
     규칙이 같으므로, 두 번 확인에 성공하면 그 뒤로는 확인 없이 믿는다 — 2차 실행이 40분을
     넘긴 주된 이유가 공고마다 매번 열어 본 것이었다. (규칙이 통한다는 근거는 이미 두 번 있다.) */
  let boardProven = 0;
  const provenKind = (c, row) => (c === row.abs ? 'row' : 'built');
  let provenAs = null;

  /* 같은 게시판의 다른 공고 제목 — '이 화면이 목록인가' 판정에 쓴다 */
  const otherTitlesOf = (want) => rows.map((r) => r.t).filter((x) => !sameTitle(want, x)).slice(0, 40);

  let boardCandidateTotal = 0;
  for (const t of (RECHECK_ONLY ? [] : group)) {
    if (outOfTime()) { report.push('  - (시간 상한 도달 — 나머지는 다음 실행에서 이어서 고칩니다)'); break; }
    const want = markerTitle(t.url);
    const row = rows.find((r) => sameTitle(want, r.t));
    if (!row) { report.push(`  - ⚠️ 목록에서 못 찾음(내려갔거나 제목 변경): ${want.slice(0, 50)}`); failed += 1; continue; }

    /* 후보 주소 만들기 — 대부분은 클릭 없이 목록 정보만으로 만들어진다.
       ① 행의 링크가 이미 상세 주소인 경우 (동국 …/detail/26765595)
       ② 행의 클릭 스크립트가 넘기는 글 번호로 조립 (경희 view.do?nttId=…) */
    const cands = [];
    if (isDetailUrl(row.abs, listUrl)) cands.push(row.abs);
    for (const c of detailCandidates({ listUrl, url: listUrl, rowIds: idsFromSource(row.src), hiddenInputs: {}, forms: boardForms })) {
      if (isDetailUrl(c, listUrl) && !cands.includes(c)) cands.push(c);
    }

    let found = null;
    // 규칙이 이미 두 번 통한 게시판이면 같은 종류의 후보를 확인 없이 채택한다
    if (boardProven >= 2 && provenAs) {
      found = cands.find((c) => provenKind(c, row) === provenAs) || null;
    }
    for (const c of (found ? [] : cands)) {
      const v = await verifyCandidate(c, want, 0, otherTitlesOf(want));
      if (v.ok) { found = c; boardProven += 1; provenAs = provenKind(c, row); break; }
      report.push(`    · 탈락(${v.why}) ${c.slice(0, 100)}`);
    }

    /* ③ 그래도 못 찾으면 행을 실제로 눌러 상세 화면 안에서 재료를 더 찾는다 (마지막 수단) */
    if (!found && row.pageNo === 1) {
      try {
        const els = await page.$$(ROW_SEL);
        const el = els[row.i];
        if (!el) throw new Error('행 사라짐');
        const popupP = ctx.waitForEvent('page', { timeout: 4000 }).catch(() => null);
        const navP = page.waitForNavigation({ timeout: 6000 }).catch(() => null);
        await el.click({ timeout: 5000 });
        const popup = await popupP;
        const detail = popup || page;
        if (popup) await popup.waitForLoadState('domcontentloaded').catch(() => {});
        else { await navP; await page.waitForTimeout(2500); }
        const dom = await readDom(detail, listUrl);
        const more = detailCandidates({ ...dom, rowIds: idsFromSource(row.src), forms: boardForms })
          .filter((c) => isDetailUrl(c, listUrl) && !cands.includes(c));
        for (const c of more) {
          cands.push(c);
          const v = await verifyCandidate(c, want, 0, otherTitlesOf(want));
          if (v.ok) { found = c; break; }
          report.push(`    · 탈락(${v.why}) ${c.slice(0, 100)}`);
        }
        if (popup) await popup.close().catch(() => {});
        if (page.url() !== listUrl) await page.goto(listUrl, { waitUntil: 'domcontentloaded', timeout: 25000 }).catch(() => {});
        await page.waitForTimeout(1500);
      } catch (e) {
        report.push(`  - ❌ 클릭 실패: ${(e.message || '').split('\n')[0].slice(0, 60)}`);
        await page.goto(listUrl, { waitUntil: 'domcontentloaded', timeout: 25000 }).catch(() => {});
        await page.waitForTimeout(1500);
      }
    }
    boardCandidateTotal += cands.length;

    if (found) {
      resolvedMap[t.url] = found;
      if (!DRY) t.ref[t.urlField] = found;
      fixed += 1;
      report.push(`  - ✅ ${want.slice(0, 44)} → ${found.slice(0, 110)}`);
    } else {
      failed += 1;
      report.push(`  - ⚠️ 원문 주소 확인 실패(표식 유지): ${want.slice(0, 50)}`);
    }
  }
  /* 진단: 게시판마다 목록 행이 실제로 어떻게 생겼는지 남긴다.
     다음 세션이 '왜 안 되나'를 추측하지 않고 진짜 HTML을 보고 규칙을 더할 수 있게 —
     경희대가 두 번 연속 '후보 0개'로 끝난 원인을 눈으로 확인하지 못한 것이 이 진단을 늘 남기게 된 이유다. */
  report.push(`  - (진단) 후보 주소 ${boardCandidateTotal}개 생성 · 목록 행 생김새:`);
  rows.filter((r) => /장학/.test(r.t)).slice(0, 3)
    .forEach((r) => report.push(`      ${r.html.replace(/\s+/g, ' ').slice(0, 260)}`));
  /* 클릭 함수가 '실제로 무엇을 어디로 보내는지'를 그대로 뜬다.
     경희대는 행이 `javascript:view('322635','')`인데, 글 번호만 알고 조립한
     `view.do?menuNo=…&nttId=…`는 그 글이 아닌 화면을 돌려줬다. 이름을 짐작하지 말고
     함수 본문과 폼(주소·필드)을 봐야 어떤 파라미터가 필요한지 알 수 있다. */
  const clickFn = await page.evaluate(() => {
    const out = {};
    for (const name of ['view', 'fn_view', 'goView', 'doView', 'fnView', 'go_view']) {
      try { if (typeof window[name] === 'function') out[name] = String(window[name]).replace(/\s+/g, ' ').slice(0, 400); } catch { /* 접근 불가 */ }
    }
    const forms = [...document.querySelectorAll('form')].slice(0, 2).map((f) => ({
      action: f.getAttribute('action') || '', method: f.getAttribute('method') || '',
      fields: [...f.querySelectorAll('input,select')].map((i) => `${i.name}=${i.value}`).slice(0, 14).join('&'),
    }));
    return { fns: out, forms };
  }).catch(() => null);
  if (clickFn) {
    for (const [k, v] of Object.entries(clickFn.fns || {})) report.push(`      (클릭 함수) ${k} = ${v}`);
    (clickFn.forms || []).forEach((f) => report.push(`      (폼) action=${f.action} method=${f.method} · ${f.fields.slice(0, 220)}`));
  }
  await page.close().catch(() => {});
  report.push('');
}

/* ── 소급 재검사 (운영 원칙 7) ────────────────────────────────
   이미 원문 주소로 바꿔 둔 항목도 다시 열어 본다. 3차 실행까지의 확인 방법은
   '제목이 화면에 보이면 통과'였는데, **게시판 목록에도 그 제목이 있어서** 목록 주소를
   원문으로 오인할 수 있었다(동국 진담거사에 안내 페이지 번호가 붙은 사례).
   지금 규칙으로 다시 재서, 목록이거나 다른 글이면 표식으로 되돌린다 —
   그러면 앱이 '게시판 목록 ↗'으로 정직하게 알리고 다음 실행이 다시 고친다. */
let rechecked = 0; let reverted = 0;
if (!outOfTime()) {
  report.push('### 소급 재검사 (이미 고쳐 둔 주소가 정말 그 공고로 가는가)');
  const boardKeys = [...boards.keys()].map((l) => { try { const u = new URL(l); return u.origin + '/' + (u.pathname.split('/').filter(Boolean)[0] || ''); } catch { return null; } }).filter(Boolean);
  const done = [];
  for (const n of notices.items || []) {
    if (!isMarkerUrl(n.url) && boardKeys.some((k) => (n.url || '').startsWith(k))) {
      done.push({ ref: n, urlField: 'url', title: n.title, board: listUrlOf(n.url) });
    }
  }
  for (const r of registered.items || []) {
    if (!isMarkerUrl(r.sourceUrl) && boardKeys.some((k) => (r.sourceUrl || '').startsWith(k))) {
      done.push({ ref: r, urlField: 'sourceUrl', title: r.name, id: r.id });
    }
  }
  const otherAll = (want) => done.map((d) => d.title).filter((x) => !sameTitle(want, x)).slice(0, 40);
  /* 먼저 판정을 모으기만 하고, 되돌리기는 맨 마지막에 한꺼번에 결정한다.
     그래야 '학교 서버가 우리를 막고 있는 상황'을 알아보고 통째로 취소할 수 있다.

     왜 필요한가 (2026-07-31 실제로 당했다): 동국대 주소 17건이 40분 전 확인에 통과했는데
     재검사에서 전부 HTTP 404가 났다. 주소가 틀린 게 아니라 많이 두드려서 막힌 것이었고,
     그대로 뒀으면 멀쩡한 원문 링크 17건을 목록 주소로 되돌릴 뻔했다.
     그래서 ① 카나리아(게시판 목록이 아직 열리나) ② 실패 비율(너무 많으면 우리 쪽 문제)
     두 가지로 막는다. 되돌리기는 '확신할 때만' 한다 — 애매하면 그대로 둔다. */
  const verdicts = [];
  for (const d of done) {
    if (outOfTime()) { report.push('- (시간 상한 — 나머지 재검사는 다음 실행에서)'); break; }
    rechecked += 1;
    const v = await verifyCandidate(d.ref[d.urlField], d.title, 0, otherAll(d.title));
    verdicts.push({ d, v });
    await new Promise((r) => setTimeout(r, 700));  // 학교 서버를 몰아치지 않는다
  }
  const failures = verdicts.filter((x) => !x.v.ok);
  /* 실패 사유를 **되돌리든 말든 전부** 남긴다.
     예전에는 되돌린 항목만 적어서, 되돌리기가 취소되면 '무엇이 왜 실패했는지'가 통째로
     사라졌다. 그러면 '학교가 우리를 막은 것'인지 '앱에 넣어둔 링크가 진짜 깨진 것'인지
     구분할 수 없다 — 후자라면 사용자가 '원문 공고 ↗'를 눌러 404를 보게 되므로 훨씬 나쁘다. */
  const byWhy = {};
  for (const f of failures) byWhy[f.v.why] = (byWhy[f.v.why] || 0) + 1;
  report.push(`- 실패 사유 분포: ${Object.entries(byWhy).map(([k, v]) => `${k} ${v}건`).join(' · ') || '없음'}`);
  failures.slice(0, 12).forEach((f) => report.push(`    · ${f.v.why} — ${String(f.d.title).slice(0, 34)} → ${String(f.d.ref[f.d.urlField]).slice(0, 76)}`));
  const passed = verdicts.filter((x) => x.v.ok);
  passed.slice(0, 5).forEach((x) => report.push(`    · ✅ 통과 — ${String(x.d.title).slice(0, 34)} → ${String(x.d.ref[x.d.urlField]).slice(0, 76)}`));
  // 카나리아: 게시판 목록 자체가 아직 열리는가 (안 열리면 학교 서버가 우리를 막은 것)
  let canaryOk = true;
  for (const list of boards.keys()) {
    const c = await verifyContext();
    const p = await c.newPage();
    try {
      const res = await p.goto(list, { waitUntil: 'domcontentloaded', timeout: 20000 });
      if (!res || res.status() >= 400) canaryOk = false;
    } catch { canaryOk = false; } finally { await p.close().catch(() => {}); }
  }
  const tooMany = verdicts.length >= 5 && failures.length / verdicts.length > 0.3;
  if (!canaryOk || tooMany) {
    report.push(`- ⏸ 되돌리기 취소 — ${!canaryOk ? '게시판 목록조차 안 열립니다' : `실패 비율이 너무 높습니다(${failures.length}/${verdicts.length})`}. 주소가 틀린 게 아니라 학교 서버가 우리를 막고 있는 상황으로 보고 아무것도 되돌리지 않습니다.`);
  } else {
    for (const { d, v } of failures) {
      const list = [...boards.keys()].find((l) => { try { return d.ref[d.urlField].startsWith(new URL(l).origin); } catch { return false; } });
      if (!list) { report.push(`- ⚠️ ${d.id || d.title.slice(0, 30)} 확인 실패(${v.why})이지만 되돌릴 목록 주소를 몰라 그대로 둡니다`); continue; }
      if (!DRY) d.ref[d.urlField] = `${list}#n-${encodeURIComponent(String(d.title).slice(0, 40))}`;
      reverted += 1;
      report.push(`- ↩️ 되돌림(${v.why}): ${d.id || ''} ${String(d.title).slice(0, 40)}`);
    }
  }
  report.push(`- 재검사 ${rechecked}건 · 확인 실패 ${failures.length}건 · 실제 되돌림 ${reverted}건`);
  report.push('');
}

await verifyCtx?.close().catch(() => {});
await browser.close();

if (!DRY && (fixed || reverted)) {
  fs.writeFileSync(noticesPath, JSON.stringify(notices, null, 1));
  fs.writeFileSync(registeredPath, JSON.stringify(registered, null, 1));
}
fs.writeFileSync(new URL('resolved-urls.json', HERE), JSON.stringify({ updatedAt: new Date().toISOString().slice(0, 10), map: resolvedMap }, null, 1));

report.push('---');
report.push(`복구 **${fixed}건** · 실패 ${failed}건 · 소급 재검사 ${rechecked}건 중 되돌림 ${reverted}건${DRY ? ' (모의 실행 — 저장 안 함)' : ''}`);
if (failed) report.push('실패분은 목록 주소를 그대로 두었습니다 — 앱은 이 경우 "게시판 목록이 열려요"라고 정직하게 알립니다.');
fs.writeFileSync(new URL('resolve-report.md', HERE), report.join('\n'));
console.log(report.join('\n'));
if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `fixed=${fixed}\nfailed=${failed}\nreverted=${reverted}\n`);

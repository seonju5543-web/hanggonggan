/* 링크 사냥꾼 — 까다로운 원문 주소 읽기만 맡는 전담 로봇 (2026-08-01)

   왜 따로 두나
   ─────────────────────────────────────────────────────────────────
   수집 로봇(browser-collect)은 매일 12개 캠퍼스를 훑어야 해서 **빨라야 한다**.
   그래서 공고마다 행을 눌러 보는 대신, 목록에서 글 번호를 긁어 주소를 '조립'한다.
   빠르지만 틀릴 수 있다 — 실제로 동국대에서 조립한 `view?nttId=…`가 33건 전부 404였고
   (그 주소 형태가 동국대엔 아예 없었다), 다른 17건은 열리긴 했는데 그 공고가 아니었다.

   이 로봇은 반대로 **느려도 정확한 방법**만 쓴다. 대상이 '남은 어려운 것들'뿐이라
   느려도 괜찮다. 핵심 원칙은 하나다:

       ⭐ 짐작하지 않는다. 행을 실제로 눌러서 브라우저가 간 주소를 받아 적는다.

   조립은 게시판이 폼을 안 내주고 클릭도 실패했을 때의 마지막 수단이다.

   무엇을 하나
   ─────────────────────────────────────────────────────────────────
   ① 앱 데이터에서 아직 '게시판 목록 + 제목 표식(#n-…)'인 공고를 전부 모은다
      (학교를 가리지 않는다 — 동국대뿐 아니라 앞으로 어느 학교에서 같은 문제가 생겨도
       이 로봇이 자동으로 집어 든다).
   ② 게시판을 페이지별로 넘기며 그 제목의 행을 찾는다.
   ③ 행을 **클릭**해 브라우저가 실제로 이동한 주소를 받는다.
      주소가 안 바뀌는 게시판(form POST)이면 상세 화면과 목록 폼에서 재료를 모아 조립한다.
   ④ 만든 주소를 **로그인도 리퍼러도 없는 새 탭**에서 다시 열어 그 공고가 맞는지 확인한다.
      (사용자는 그 조건으로 링크를 누르므로 그 조건으로 확인해야 한다.)
   ⑤ 통과한 것만 데이터에 반영한다. 못 찾은 것은 지어내지 않고 표식을 그대로 둔다.

   같은 것을 영원히 다시 두드리지 않기
   ─────────────────────────────────────────────────────────────────
   `collector/link-hunt.json`에 공고별로 시도 횟수와 마지막 사유를 남긴다.
   · '목록에서 못 찾음'이 3회 쌓이면 → 게시판에서 내려간 공고로 보고 `gone` 처리.
     더는 시도하지 않고, 리포트에 '내려간 공고'로 분류한다.
   · '읽었는데 다른 화면'이 3회 쌓이면 → 사람이 봐야 하는 건으로 `stuck` 처리하고
     리포트에 올린다(추측으로 아무 주소나 붙이지 않는다).
   · 네트워크로 못 읽은 것은 횟수에 세지 않는다 — 학교 서버 사정이지 공고 잘못이 아니다.

   실행: node collector/link-hunter.mjs [--dry]
         (워크플로 link-hunter.yml · collector/run-link-hunt.txt 를 고쳐 push해도 실행) */
import fs from 'node:fs';
import { chromium } from 'playwright';
import { isMarkerUrl, markerTitle, listUrlOf, isDetailUrl, sameTitle, detailCandidates, idsFromSource } from './detail-url.mjs';

const HERE = new URL('.', import.meta.url);
const DRY = process.argv.includes('--dry');

function runSetting(key) {
  try {
    const txt = fs.readFileSync(new URL('run-link-hunt.txt', HERE), 'utf8');
    const m = txt.match(new RegExp('^\\s*' + key + ':\\s*(.+)$', 'm'));
    return m ? m[1].trim() : '';
  } catch { return ''; }
}
const ONLY = process.env.HUNT_ONLY_BOARD || runSetting('onlyBoard');
const MAX_PAGES = Number(process.env.HUNT_MAX_PAGES || runSetting('maxPages') || 10);
const BUDGET_MS = Number(process.env.HUNT_BUDGET_MS || 25 * 60000);
const GIVE_UP_AFTER = 3;           // 같은 사유로 이만큼 실패하면 더 두드리지 않는다
const startedAt = Date.now();
const outOfTime = () => Date.now() - startedAt > BUDGET_MS;

const noticesPath = new URL('../data/notices.json', HERE);
const registeredPath = new URL('../data/registered.json', HERE);
const statePath = new URL('link-hunt.json', HERE);
const notices = JSON.parse(fs.readFileSync(noticesPath, 'utf8'));
const registered = JSON.parse(fs.readFileSync(registeredPath, 'utf8'));
let state = { updatedAt: null, items: {} };
try { state = JSON.parse(fs.readFileSync(statePath, 'utf8')); } catch { /* 첫 실행 */ }
state.items = state.items || {};

/* 사냥 대상 모으기 — 학교를 가리지 않는다 */
const targets = [];
for (const n of notices.items || []) {
  if (isMarkerUrl(n.url)) targets.push({ ref: n, field: 'url', title: n.title, key: `n:${n.url}`, school: n.school });
}
for (const r of registered.items || []) {
  if (isMarkerUrl(r.sourceUrl)) targets.push({ ref: r, field: 'sourceUrl', title: r.name, key: `r:${r.id}`, id: r.id, school: (r.eligibility || {}).schoolOnly });
}
/* 게시판에서 행을 찾을 때 쓰는 제목은 **게시판에 적힌 원래 제목**이어야 한다.
   앱에 보여주는 이름(r.name)은 사람이 다듬은 것이라("전문자격장학 (2026-2학기)")
   게시판 행("공지 공지 2026-2학기 전문자격장학 신청안내 …")과 안 맞아 못 찾는다.
   표식(#n-)에 든 제목이 원래 제목이고, boardTitle 필드가 있으면 그게 더 정확하다. */
function huntTitle(t) {
  return (t.ref.boardTitle || '').trim() || markerTitle(t.ref[t.field]) || String(t.title);
}

/* 이미 포기한 건은 건너뛴다 (하지만 리포트에는 남긴다) */
const skipped = [];
const active = targets.filter((t) => {
  const st = state.items[t.key];
  if (st && (st.status === 'gone' || st.status === 'stuck')) { skipped.push({ t, st }); return false; }
  return true;
});

const boards = new Map();
for (const t of active) {
  const list = listUrlOf(t.ref[t.field]);
  if (ONLY && !list.includes(ONLY)) continue;
  if (!boards.has(list)) boards.set(list, []);
  boards.get(list).push(t);
}

const report = [`## 🎯 링크 사냥꾼 리포트 (${new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 16).replace('T', ' ')} KST)`, ''];
report.push(`사냥 대상 **${active.length}건** (게시판 ${boards.size}곳) · 포기 처리된 건 ${skipped.length}건`);
report.push('');

const browser = await chromium.launch({ args: ['--no-sandbox'] });
const ctx = await browser.newContext({
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
  locale: 'ko-KR',
});

/* ── 확인: 로그인도 리퍼러도 없는 새 탭에서 진짜 그 공고가 열리는가 ── */
let verifyCtx = null;
async function freshPage() {
  if (!verifyCtx) {
    verifyCtx = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
      locale: 'ko-KR',
    });
  }
  await verifyCtx.clearCookies().catch(() => {});
  return verifyCtx.newPage();
}

const fp = (s) => String(s || '').replace(/[\s .,·ㆍ~〜'"“”‘’!?()[\]{}<>:;|/\\_+\-*&#%]/g, '').toLowerCase();
const coreTitle = (t) => fp(String(t).replace(/^\s*\d{1,5}\s+/, '').replace(/^\s*(공통|서울|글로벌|국제|공지|홍보|일반)\s+/, '').replace(/\[[^\]]{0,20}\]/g, ''));

function looksLikeList(text, others) {
  const body = fp(text);
  let hits = 0;
  for (const o of others) {
    const k = coreTitle(o);
    if (k.length >= 10 && body.includes(k)) hits += 1;
    if (hits >= 3) return true;
  }
  return false;
}

async function verify(url, title, others) {
  const p = await freshPage();
  try {
    const res = await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    if (res && res.status() >= 400) return { ok: false, why: `HTTP ${res.status()}`, net: true };
    const probe = String(title).replace(/^\s*\d{1,5}\s+/, '').replace(/^\s*(공통|서울|국제|공지|홍보)\s+/, '').slice(0, 12).trim();
    if (probe.length >= 4) {
      await p.waitForFunction((n) => (document.body && document.body.innerText || '').includes(n), probe, { timeout: 7000 }).catch(() => {});
    }
    await p.waitForTimeout(700);
    const text = await p.evaluate(() => (document.body.innerText || '').slice(0, 14000)).catch(() => '');
    const docTitle = await p.title().catch(() => '');
    const t = coreTitle(title);
    const hit = sameTitle(title, docTitle) || (t.length >= 8 && (fp(text).includes(t) || (t.length >= 24 && fp(text).includes(t.slice(0, 24)))));
    if (!hit) return { ok: false, why: '제목 불일치(다른 글이 열림)' };
    if (looksLikeList(text, others)) return { ok: false, why: '목록 화면(다른 공고 제목이 여럿 보임)' };
    return { ok: true };
  } catch (e) {
    return { ok: false, why: (e.message || String(e)).split('\n')[0].slice(0, 56), net: true };
  } finally {
    await p.close().catch(() => {});
  }
}

/* ── 목록 훑기 ── */
const ROW_SEL = 'a[href], [onclick]';
async function scrapeRows(page) {
  return page.$$eval(ROW_SEL, (els) => els.map((e, i) => ({
    i,
    t: (e.textContent || '').replace(/\s+/g, ' ').trim(),
    abs: e.tagName === 'A' ? (e.href || '') : '',
    src: [e.getAttribute('onclick') || '', e.getAttribute('href') || '', e.getAttribute('data-id') || ''].join('|'),
  })).filter((x) => x.t.length >= 6 && x.t.length <= 160)).catch(() => []);
}
async function scrapeForms(page) {
  return page.evaluate(() => [...document.querySelectorAll('form')].slice(0, 4).map((f) => ({
    action: f.getAttribute('action') || '',
    fields: [...f.querySelectorAll('input,select')].map((i) => `${i.name}=${i.value}`).filter((x) => !x.startsWith('=')).slice(0, 16).join('&'),
  }))).catch(() => []);
}
async function gotoPage(page, n) {
  return page.evaluate((num) => {
    const cands = [...document.querySelectorAll('a, button, [onclick]')].filter((e) => (e.textContent || '').trim() === String(num));
    const el = cands.find((e) => /pag|page|num/i.test(e.className + ' ' + ((e.parentElement || {}).className || ''))) || cands[0];
    if (!el) return false;
    el.click();
    return true;
  }, n).catch(() => false);
}

let found = 0; let failed = 0; let gone = 0; let stuck = 0;
const today = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);

function record(t, outcome, why) {
  const st = state.items[t.key] || { attempts: 0, title: String(t.title).slice(0, 80) };
  st.lastTried = today;
  st.lastWhy = why || '';
  if (outcome === 'ok') { st.status = 'resolved'; st.resolvedUrl = t.ref[t.field]; st.attempts = 0; }
  else if (outcome === 'net') { st.lastWhy = why; }          // 못 읽음은 횟수에 안 센다
  else {
    st.attempts = (st.attempts || 0) + 1;
    if (st.attempts >= GIVE_UP_AFTER) {
      st.status = why === '목록에서 못 찾음' ? 'gone' : 'stuck';
      if (st.status === 'gone') gone += 1; else stuck += 1;
    }
  }
  state.items[t.key] = st;
}

for (const [listUrl, group] of boards) {
  if (outOfTime()) { report.push('_(시간 상한 — 나머지 게시판은 다음 실행)_'); break; }
  report.push(`### ${listUrl}`);
  const page = await ctx.newPage();
  let opened = false;
  for (let a = 0; a < 3 && !opened; a += 1) {
    try { await page.goto(listUrl, { waitUntil: a >= 2 ? 'commit' : 'domcontentloaded', timeout: a ? 45000 : 30000 }); opened = true; }
    catch (e) { if (a === 2) report.push(`- ❌ 게시판 열기 실패: ${(e.message || '').split('\n')[0].slice(0, 70)}`); else await page.waitForTimeout(3000 * (a + 1)); }
  }
  if (!opened) { await page.close().catch(() => {}); report.push(''); continue; }
  await page.waitForTimeout(3500);
  const forms = await scrapeForms(page);

  /* 페이지를 넘기며, 각 페이지에서 '이 페이지에 있는 대상'을 그 자리에서 처리한다.
     (행 번호는 페이지를 넘기면 달라지므로, 찾은 페이지에서 바로 눌러야 한다) */
  const remaining = new Map(group.map((t) => [t.key, t]));
  for (let pageNo = 1; pageNo <= MAX_PAGES && remaining.size; pageNo += 1) {
    if (pageNo > 1) {
      const moved = await gotoPage(page, pageNo);
      if (!moved) break;
      await page.waitForTimeout(3000);
    }
    let rows = await scrapeRows(page);
    if (!rows.length) break;

    for (const t of [...remaining.values()]) {
      if (outOfTime()) break;
      const want = huntTitle(t);
      const others = rows.map((r) => r.t).filter((x) => !sameTitle(want, x)).slice(0, 40);
      const idx = rows.findIndex((r) => sameTitle(want, r.t));
      if (idx < 0) continue;                       // 이 페이지엔 없다 — 다음 페이지에서 찾는다
      remaining.delete(t.key);

      let url = null; let lastWhy = '';
      /* ⭐ 1순위: 행을 실제로 눌러 브라우저가 간 주소를 받아 적는다 (짐작하지 않는다) */
      try {
        const els = await page.$$(ROW_SEL);
        const el = els[rows[idx].i];
        if (el) {
          const popupP = ctx.waitForEvent('page', { timeout: 4000 }).catch(() => null);
          const navP = page.waitForNavigation({ timeout: 8000 }).catch(() => null);
          await el.click({ timeout: 5000 });
          const popup = await popupP;
          const detail = popup || page;
          if (popup) await popup.waitForLoadState('domcontentloaded').catch(() => {});
          else { await navP; await page.waitForTimeout(2500); }

          const landed = detail.url();
          const cands = [];
          if (isDetailUrl(landed, listUrl)) cands.push(landed);       // 눌러서 간 진짜 주소
          const dom = await detail.evaluate(() => {
            const hidden = {};
            document.querySelectorAll('input[name]').forEach((i) => { if (i.name && i.value) hidden[i.name] = i.value; });
            const can = document.querySelector('link[rel=canonical]');
            const og = document.querySelector('meta[property="og:url"]');
            return { canonical: can ? can.getAttribute('href') : null, ogUrl: og ? og.getAttribute('content') : null, hiddenInputs: hidden };
          }).catch(() => ({ hiddenInputs: {} }));
          for (const c of detailCandidates({ ...dom, url: landed, listUrl, forms, rowIds: idsFromSource(rows[idx].src) })) {
            if (isDetailUrl(c, listUrl) && !cands.includes(c)) cands.push(c);
          }
          for (const c of cands) {
            const v = await verify(c, want, others);
            if (v.ok) { url = c; break; }
            lastWhy = v.why;
            report.push(`    · 탈락(${v.why}) ${c.slice(0, 96)}`);
            if (v.net) break;                       // 못 읽는 상황이면 더 두드리지 않는다
          }
          if (popup) await popup.close().catch(() => {});
        }
      } catch (e) {
        lastWhy = `클릭 실패: ${(e.message || '').split('\n')[0].slice(0, 40)}`;
      }
      // 목록으로 복귀 (다음 대상을 같은 페이지에서 계속 찾기 위해)
      if (page.url() !== listUrl) { await page.goto(listUrl, { waitUntil: 'domcontentloaded', timeout: 25000 }).catch(() => {}); await page.waitForTimeout(2000); }
      if (pageNo > 1) { for (let k = 2; k <= pageNo; k += 1) { if (!(await gotoPage(page, k))) break; await page.waitForTimeout(2500); } }
      rows = await scrapeRows(page);

      if (url) {
        if (!DRY) { t.ref[t.field] = url; if (!t.ref.boardTitle) t.ref.boardTitle = want; }
        found += 1;
        record(t, 'ok');
        report.push(`  - ✅ ${want.slice(0, 42)} → ${url.slice(0, 104)}`);
      } else {
        failed += 1;
        record(t, /HTTP|Timeout|ERR_|net::/i.test(lastWhy) ? 'net' : 'bad', lastWhy || '주소를 못 만듦');
        report.push(`  - ⚠️ 실패(${lastWhy || '주소를 못 만듦'}): ${want.slice(0, 42)}`);
      }
      await new Promise((r) => setTimeout(r, 900));   // 학교 서버를 몰아치지 않는다
    }
  }
  // 모든 페이지를 봐도 못 찾은 것 = 게시판에서 내려갔을 가능성
  for (const t of remaining.values()) {
    failed += 1;
    record(t, 'bad', '목록에서 못 찾음');
    const st = state.items[t.key];
    report.push(`  - ⚠️ 목록에서 못 찾음 (${st.attempts}/${GIVE_UP_AFTER}회): ${huntTitle(t).slice(0, 46)}`);
  }
  await page.close().catch(() => {});
  report.push('');
}

await verifyCtx?.close().catch(() => {});
await browser.close();

state.updatedAt = today;
if (!DRY) {
  if (found) {
    fs.writeFileSync(noticesPath, JSON.stringify(notices, null, 1));
    fs.writeFileSync(registeredPath, JSON.stringify(registered, null, 1));
  }
  fs.writeFileSync(statePath, JSON.stringify(state, null, 1));
}

if (skipped.length) {
  report.push('### 더는 두드리지 않는 건 (포기 처리)');
  skipped.forEach(({ t, st }) => report.push(`- ${st.status === 'gone' ? '🗑 내려간 공고' : '🔧 사람 확인 필요'} — ${String(t.title).slice(0, 46)} (${st.lastWhy || ''})`));
  report.push('');
}
report.push('---');
report.push(`원문 주소 확보 **${found}건** · 실패 ${failed}건 · 이번에 포기 처리 ${gone + stuck}건(내려감 ${gone} · 사람 확인 ${stuck})${DRY ? ' — 모의 실행' : ''}`);
report.push('');
report.push('실패해도 앱은 지어내지 않습니다 — 원문 주소를 못 찾은 공고는 "게시판 목록 ↗"으로 정직하게 안내합니다.');
fs.writeFileSync(new URL('link-hunt-report.md', HERE), report.join('\n'));
console.log(report.join('\n'));
if (process.env.GITHUB_OUTPUT) {
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `found=${found}\nfailed=${failed}\nstuck=${stuck}\n`);
}

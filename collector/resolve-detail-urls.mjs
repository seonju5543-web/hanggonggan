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
import { isMarkerUrl, markerTitle, listUrlOf, isDetailUrl, sameTitle, detailCandidates } from './detail-url.mjs';

const HERE = new URL('.', import.meta.url);
const DRY = process.argv.includes('--dry');
const LIMIT_BOARDS = Number(process.env.RESOLVE_MAX_BOARDS || 20);

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
const boards = new Map();
for (const t of targets) {
  const list = listUrlOf(t.url);
  if (!boards.has(list)) boards.set(list, []);
  boards.get(list).push(t);
}

const report = [`## 🔗 원문 링크 복구 리포트 (${new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 16).replace('T', ' ')} KST)`, ''];
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

/* 후보 주소를 '깨끗한 새 탭'에서 열어 정말 그 공고가 나오는지 확인한다.
   앱 사용자는 세션도 리퍼러도 없이 링크를 누르므로, 그 조건 그대로 확인해야 한다. */
async function verifyCandidate(url, title) {
  const fresh = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
    locale: 'ko-KR',
  });
  const p = await fresh.newPage();
  try {
    const res = await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    if (res && res.status() >= 400) return { ok: false, why: `HTTP ${res.status()}` };
    await p.waitForTimeout(1500);
    const text = await p.evaluate(() => (document.body.innerText || '').slice(0, 6000)).catch(() => '');
    const docTitle = await p.title().catch(() => '');
    // 제목이 화면 안에 있어야 그 공고 원문이다
    const hit = sameTitle(title, docTitle) || (() => {
      // 본문 어딘가에 제목이 통째로 들어 있는지 (지문 비교)
      const fp = (s) => String(s).replace(/[\s .,·ㆍ~〜'"“”‘’!?()[\]{}<>:;|/\\_+\-*&#%]/g, '').toLowerCase();
      const t = fp(title.replace(/^\s*\d{1,5}\s+/, '').replace(/^\s*(공통|서울|글로벌|국제|공지)\s+/, ''));
      return t.length >= 8 && fp(text).includes(t);
    })();
    if (!hit) return { ok: false, why: '제목 불일치(목록이나 다른 글이 열림)' };
    return { ok: true };
  } catch (e) {
    return { ok: false, why: (e.message || String(e)).split('\n')[0].slice(0, 60) };
  } finally {
    await p.close().catch(() => {});
    await fresh.close().catch(() => {});
  }
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

  /* 목록의 '누를 수 있는 행'을 모은다 — 진짜 링크 · onclick 행 · javascript: 링크 모두 */
  const ROW_SEL = 'a[href], [onclick]';
  const rows = await page.$$eval(ROW_SEL, (els) => els.map((e, i) => ({
    i,
    t: (e.textContent || '').replace(/\s+/g, ' ').trim(),
    href: e.tagName === 'A' ? (e.getAttribute('href') || '') : '',
    abs: e.tagName === 'A' ? (e.href || '') : '',
  })).filter((x) => x.t.length >= 6 && x.t.length <= 160)).catch(() => []);
  report.push(`- 목록에서 본 행 ${rows.length}개`);

  for (const t of group) {
    const want = markerTitle(t.url);
    // 1) 목록 안에 이미 진짜 상세 링크가 있으면 클릭 없이 채택 (동국대 경로형 상세 등)
    const direct = rows.find((r) => sameTitle(want, r.t) && isDetailUrl(r.abs, listUrl));
    let found = null;
    if (direct) {
      const v = await verifyCandidate(direct.abs, want);
      if (v.ok) found = direct.abs;
      else report.push(`  - (링크 후보 탈락: ${v.why}) ${direct.abs.slice(0, 90)}`);
    }
    // 2) 행을 실제로 눌러 상세를 열고, GET으로 열리는 주소 후보를 확인한다
    if (!found) {
      const row = rows.find((r) => sameTitle(want, r.t));
      if (!row) { report.push(`  - ⚠️ 목록에서 못 찾음(내려갔거나 제목 변경): ${want.slice(0, 50)}`); failed += 1; continue; }
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
        else { await navP; await page.waitForTimeout(2000); }
        const dom = await readDom(detail, listUrl);
        const cands = detailCandidates(dom);
        report.push(`  - 후보 ${cands.length}개 · ${want.slice(0, 40)}`);
        for (const c of cands) {
          const v = await verifyCandidate(c, want);
          if (v.ok) { found = c; break; }
          report.push(`    · 탈락(${v.why}) ${c.slice(0, 100)}`);
        }
        if (popup) await popup.close().catch(() => {});
        // 목록으로 복귀
        if (page.url() !== listUrl) await page.goto(listUrl, { waitUntil: 'domcontentloaded', timeout: 25000 }).catch(() => {});
        await page.waitForTimeout(1500);
      } catch (e) {
        report.push(`  - ❌ 클릭 실패: ${(e.message || '').split('\n')[0].slice(0, 60)}`);
        await page.goto(listUrl, { waitUntil: 'domcontentloaded', timeout: 25000 }).catch(() => {});
        await page.waitForTimeout(1500);
      }
    }

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
  await page.close().catch(() => {});
  report.push('');
}

await browser.close();

if (!DRY && fixed) {
  fs.writeFileSync(noticesPath, JSON.stringify(notices, null, 1));
  fs.writeFileSync(registeredPath, JSON.stringify(registered, null, 1));
}
fs.writeFileSync(new URL('resolved-urls.json', HERE), JSON.stringify({ updatedAt: new Date().toISOString().slice(0, 10), map: resolvedMap }, null, 1));

report.push('---');
report.push(`복구 **${fixed}건** · 실패 ${failed}건${DRY ? ' (모의 실행 — 저장 안 함)' : ''}`);
if (failed) report.push('실패분은 목록 주소를 그대로 두었습니다 — 앱은 이 경우 "게시판 목록이 열려요"라고 정직하게 알립니다.');
fs.writeFileSync(new URL('resolve-report.md', HERE), report.join('\n'));
console.log(report.join('\n'));
if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `fixed=${fixed}\nfailed=${failed}\n`);

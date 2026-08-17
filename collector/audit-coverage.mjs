/* ============================================================
   누락 감사 로봇 (2026-08-17 신설 — 개발자 지시: '독립 재집계 대조')
   ------------------------------------------------------------
   하는 일: 게시판을 **수집기와 별도로 다시 읽어**, 게시판에 있는 장학 공고와
   우리가 가진 공고를 제목 단위로 맞춰 **어떤 공고가 빠졌는지** 목록으로 낸다.

   왜 필요한가: 로봇은 자기가 읽은 것만 안다. "12건 수집"이 게시판에 12건이 있어서인지
   30건 중 12건만 알아본 것인지 스스로는 구분하지 못한다.

   🔴 이 로봇이 지켜야 할 것 세 가지
     ① **읽는 방법이 수집기와 달라야 한다.** 같은 그물을 쓰면 같은 맹점을 공유해
        언제나 '누락 0건'이 나온다. 그래서 넓은 그물(coverage-rules.mjs LOOSE)로
        일부러 멍청하게 다 집는다.
     ② **아무것도 고치지 않는다.** seen.json·notices.json·registered.json에 손대지 않는다.
        감사가 데이터를 만지면, 감사가 만든 변화를 감사가 다시 재는 순환이 생긴다.
        이 로봇이 쓰는 파일은 자기 리포트 둘뿐이다.
     ③ **못 읽은 것을 누락이라고 말하지 않는다.** 접속 실패는 '판정 불가'다
        (동국대 '못 읽음 ≠ 다른 글' 교훈과 같은 계열).

   실행: node collector/audit-coverage.mjs
   설정: AUDIT_BUDGET_MS(기본 20분) · AUDIT_PAGES(기본 3) · AUDIT_ONLY=학교이름
   ============================================================ */
import fs from 'node:fs';
import { chromium } from 'playwright';
import { createRequire } from 'node:module';
import { looseCandidate, findMissing, classifyMiss, coverageOf, fingerprint, dedupeNear } from './coverage-rules.mjs';
import { makeBudget, withDeadline, TIMED_OUT, rotateOrder, nextCursor } from './harvest-budget.mjs';
import { pageCandidates, samePage } from './paginate.mjs';
import { isMenuEntry } from './clean-title.mjs';
import { isAttachmentEntry } from './attachment-link.mjs';
import { urlKey } from './url-key.mjs';

const HERE = new URL('.', import.meta.url);
const require = createRequire(import.meta.url);

/* 첫 실행(2026-08-17)은 20분 예산으로 학교 **16곳만** 보고 23곳을 건너뛰었다.
   학교당 75초쯤 드니 41곳을 한 번에 보려면 35분이 필요하다. 그래서 예산을 늘리고,
   그래도 남으면 **다음 실행이 건너뛴 학교부터** 시작하도록 회전시킨다(수집 로봇과 같은 방식) —
   회전이 없으면 설정 파일 뒤쪽 학교는 영영 감사되지 않는다. */
const BUDGET_MS = Number(process.env.AUDIT_BUDGET_MS || 35 * 60000);
const PER_SCHOOL_MS = Number(process.env.AUDIT_PER_SCHOOL_MS || 150000);   // 학교 하나 절대 시한
const PAGES = Number(process.env.AUDIT_PAGES || 3);
const ONLY = process.env.AUDIT_ONLY || '';
const budget = makeBudget(BUDGET_MS);

/* 수집기가 쓰는 그물 — 원인을 가를 때만 쓴다(감사 자체는 넓은 그물로 읽는다).
   ⚠️ 이 정규식은 collect.mjs·browser-collect.mjs의 KEYWORDS와 같아야 한다.
   갈라지면 '키워드 밖'이라는 진단이 거짓이 된다. 검사에서 세 곳이 같은지 확인한다. */
const HARVEST_KEYWORDS = /장학|학자금|등록금 감면|학업장려|근로장학/;

/* ── 감사 대상: 두 수집기 설정의 합집합에서 **주소가 있는 곳만** ──────────────
   주소를 못 받은 학교(연세 미래·고려 세종·동국 WISE 등)는 로봇이 접근할 길이 없다.
   그걸 '누락'으로 세면 매일 같은 경고가 떠서 진짜 문제가 묻힌다(개발자 확인, 2026-08-17). */
const schools = JSON.parse(fs.readFileSync(new URL('schools.json', HERE), 'utf8')).schools || [];
const bTargets = JSON.parse(fs.readFileSync(new URL('browser-targets.json', HERE), 'utf8')).targets || [];
const targets = new Map();
const add = (school, campus, urls) => {
  if (!school || !urls || !urls.length) return;
  const key = school;                        // 파일·데이터가 학교 단위이므로 감사도 학교 단위
  const cur = targets.get(key) || { school, campus, urls: [] };
  for (const u of urls) if (u && !cur.urls.includes(u)) cur.urls.push(u);
  targets.set(key, cur);
};
for (const s of schools) add(s.school, s.campus, s.boardUrl ? [s.boardUrl] : null);
for (const t of bTargets) add(t.school, t.campus, t.candidates);
const all = [...targets.values()].filter((t) => !ONLY || t.school.includes(ONLY));
/* 회전 — 지난 실행이 건너뛴 학교부터 본다 */
const curPath = new URL('coverage-cursor.json', HERE);
let cur = { next: 0 };
try { cur = JSON.parse(fs.readFileSync(curPath, 'utf8')); } catch { /* 첫 실행 */ }
const order = rotateOrder(all.length, cur.next || 0);
const list = order.map((i) => all[i]);

/* ── 우리가 가진 공고 (읽기만 한다) ─────────────────────────────────────── */
const notices = JSON.parse(fs.readFileSync(new URL('../data/notices.json', HERE), 'utf8')).items || [];
let candidates = [];
try { candidates = JSON.parse(fs.readFileSync(new URL('candidates.json', HERE), 'utf8')).items || []; } catch { /* 없어도 된다 */ }
const registered = JSON.parse(fs.readFileSync(new URL('../data/registered.json', HERE), 'utf8')).items || [];
const oursBySchool = new Map();
for (const n of [...notices, ...candidates]) {
  if (!n || !n.school) continue;
  if (!oursBySchool.has(n.school)) oursBySchool.set(n.school, []);
  oursBySchool.get(n.school).push(n.title);
}
/* 정식 등록 공고도 '우리가 가진 것'이다 — 피드에서 중복 제거로 빠져 있어도 누락이 아니다 */
const regTitles = registered.map((r) => r.name || r.title).filter(Boolean);

const browser = await chromium.launch({ args: ['--no-sandbox'] });
const ctx = await browser.newContext({
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
  locale: 'ko-KR',
});

/* 게시판 한 페이지의 **모든 행 제목**을 긁는다. 수집기와 달리 필터를 걸지 않는다 —
   링크든 클릭형이든 표 안의 글자든 다 집는다. 감사는 상한을 재는 일이므로 넓어야 한다. */
async function readBoard(url) {
  const page = await ctx.newPage();
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3500);
    const rows = [];
    for (const f of page.frames()) {
      /* 🔴 **잎 노드만** 읽는다 (2026-08-17 첫 실행 결과로 수정).
         처음엔 td·li를 그대로 읽었더니 옆 메뉴를 감싼 컨테이너가 통째로 한 줄이 되어
         '장학 장학금안내 교내장학금 한국장학재단 …' 같은 덩어리가 60건 중 32건을 채웠다.
         자식 요소가 없는 칸만 읽으면 그 덩어리가 애초에 안 생긴다. */
      const got = await f.$$eval('a, [onclick], td, li', (els) => els
        .filter((e) => e.tagName === 'A' || e.hasAttribute('onclick') || e.children.length === 0)
        .map((e) => ({
          t: (e.textContent || '').replace(/\s+/g, ' ').trim(),
          u: e.tagName === 'A' ? (e.href || '') : '',
        }))).catch(() => []);
      rows.push(...got);
    }
    return { rows, error: null };
  } catch (e) {
    return { rows: [], error: (e.message || String(e)).split('\n')[0].slice(0, 90) };
  } finally {
    await page.close().catch(() => {});
  }
}

const results = [];
for (const t of list) {
  if (!budget.hasRoom(PER_SCHOOL_MS)) {
    results.push({ ...t, verdict: 'skip', note: '시간 예산 부족 — 이번 감사에서 건너뜀' });
    continue;
  }
  const r = await withDeadline((async () => {
    /* 후보 주소 중 **가장 많이 읽힌 것 하나**를 쓴다. 여러 주소를 합치면 같은 공고가
       두 번 세어져 비율이 부풀려진다. */
    let best = { rows: [], error: '읽지 못했습니다', url: t.urls[0] };
    for (const u of t.urls) {
      const got = await readBoard(u);
      if (got.rows.length > best.rows.length) best = { ...got, url: u };
      if (best.rows.length > 40) break;                    // 충분히 읽혔으면 더 두드리지 않는다
    }
    if (!best.rows.length) return { verdict: 'unreadable', error: best.error, url: best.url };

    /* 2페이지 이후도 본다 — 1페이지만 보면 '2페이지 이후' 원인을 아예 셀 수 없다 */
    const pageOf = new Map();
    const urlOf = new Map();          // 첨부 링크 판정에 주소가 필요하다
    const seenFp = new Set();
    const collect = (rows, pageNo) => {
      for (const row of rows) {
        if (!looseCandidate(row.t)) continue;
        const f = fingerprint(row.t);
        if (!f || seenFp.has(f)) continue;
        seenFp.add(f);
        pageOf.set(row.t, pageNo);
        if (row.u) urlOf.set(row.t, row.u);
      }
    };
    collect(best.rows, 1);
    const firstKeys = best.rows.filter((r2) => r2.u).map((r2) => urlKey(r2.u));
    for (let p = 2; p <= PAGES && budget.hasRoom(30000); p += 1) {
      let advanced = false;
      for (const c of pageCandidates(best.url, p)) {
        const got = await readBoard(c.url);
        if (!got.rows.length) continue;
        const keys = got.rows.filter((r2) => r2.u).map((r2) => urlKey(r2.u));
        if (keys.length && samePage(firstKeys, keys)) continue;
        collect(got.rows, p);
        firstKeys.push(...keys);
        advanced = true;
        break;
      }
      if (!advanced) break;
    }

    /* 같은 공고가 '제목만'과 '제목+조회수·작성일'로 두 번 세어지던 것을 합친다 */
    const boardTitles = dedupeNear([...pageOf.keys()]);
    const ours = (oursBySchool.get(t.school) || []).concat(regTitles);
    const missing = findMissing(boardTitles, ours);
    const byCause = {};
    for (const m of missing) {
      const cause = classifyMiss(m, {
        keywords: HARVEST_KEYWORDS, isMenuEntry, isAttachmentEntry,
        page: pageOf.get(m), url: urlOf.get(m) || '',
      });
      (byCause[cause] = byCause[cause] || []).push(m);
    }
    return {
      verdict: 'ok', url: best.url, boardCount: boardTitles.length,
      missing: missing.length, byCause, coverage: coverageOf(boardTitles.length, missing.length),
    };
  })(), PER_SCHOOL_MS);

  if (r === TIMED_OUT) results.push({ ...t, verdict: 'unreadable', error: '시한 초과(게시판이 응답하지 않음)' });
  else results.push({ ...t, ...r });
}
await withDeadline(browser.close(), 20000);

/* ── 리포트 ────────────────────────────────────────────────────────────── */
const today = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 16).replace('T', ' ');
const ok = results.filter((r) => r.verdict === 'ok');
const unreadable = results.filter((r) => r.verdict === 'unreadable');
const skipped = results.filter((r) => r.verdict === 'skip');
const causeTotal = {};
for (const r of ok) for (const [c, arr] of Object.entries(r.byCause || {})) causeTotal[c] = (causeTotal[c] || 0) + arr.length;
const unknown = causeTotal['원인 미상'] || 0;

const L = [`## 🔍 공고 누락 감사 (${today} KST)`, ''];
L.push('게시판을 **수집기와 별도로 다시 읽어** 대조한 결과입니다. 감사는 일부러 넓은 그물로 읽으므로');
L.push('장학금이 아닌 것도 후보에 섞입니다 — 사람이 볼 것은 **원인 미상**뿐입니다.', '');
L.push(`- 감사한 학교: **${ok.length}곳** · 게시판을 못 읽은 곳 ${unreadable.length} · 예산으로 건너뜀 ${skipped.length}`);
const totalBoard = ok.reduce((a, r) => a + r.boardCount, 0);
const totalMiss = ok.reduce((a, r) => a + r.missing, 0);
L.push(`- 게시판에서 본 장학 후보 **${totalBoard}건** · 우리 데이터에 없는 것 **${totalMiss}건**`);
if (totalBoard) L.push(`- 전체 인식 비율 **${Math.round(((totalBoard - totalMiss) / totalBoard) * 100)}%**`);
L.push('');
L.push('### 누락 원인별 (많은 순)');
Object.entries(causeTotal).sort((a, b) => b[1] - a[1]).forEach(([c, n]) => {
  const mark = c === '원인 미상' ? '🚨' : '·';
  L.push(`- ${mark} **${c}** ${n}건`);
});
if (!Object.keys(causeTotal).length) L.push('- 누락 없음');
L.push('');
if (unknown) {
  L.push(`### 🚨 원인 미상 ${unknown}건 — 이것만 보세요`);
  L.push('수집기 규칙을 전부 통과하는데도 우리 데이터에 없습니다. 게시판을 그날 못 읽었거나,');
  L.push('클릭 채집이 못 닿았거나, 상한에 밀렸다는 뜻입니다.', '');
  for (const r of ok) {
    const arr = (r.byCause || {})['원인 미상'] || [];
    if (!arr.length) continue;
    L.push(`**${r.school}** (${arr.length}건)`);
    arr.slice(0, 12).forEach((m) => L.push(`- ${m.slice(0, 90)}`));
    if (arr.length > 12) L.push(`- …그리고 ${arr.length - 12}건 더`);
    L.push('');
  }
}
L.push('### 학교별');
L.push('| 학교 | 게시판 후보 | 누락 | 인식 비율 | 원인 미상 |');
L.push('|---|---:|---:|---:|---:|');
ok.sort((a, b) => (a.coverage ?? 100) - (b.coverage ?? 100)).forEach((r) => {
  L.push(`| ${r.school} | ${r.boardCount} | ${r.missing} | ${r.coverage}% | ${((r.byCause || {})['원인 미상'] || []).length} |`);
});
L.push('');
if (unreadable.length) {
  L.push('### ⚠️ 게시판을 못 읽은 학교 — 누락 여부를 **판정할 수 없습니다**');
  L.push("('못 읽음'을 '괜찮음'으로도, '누락'으로도 단정하지 않습니다)", '');
  unreadable.forEach((r) => L.push(`- ${r.school} — ${r.error}`));
  L.push('');
}
if (skipped.length) L.push(`### ⏱ 예산으로 건너뛴 학교 ${skipped.length}곳: ${skipped.map((s) => s.school).join(' · ')}`, '');
L.push('---');
L.push(`⏱ 소요 ${Math.round(budget.elapsed() / 60000)}분 / 예산 ${Math.round(BUDGET_MS / 60000)}분`);
L.push('규칙: `collector/coverage-rules.mjs` · 로봇: `collector/audit-coverage.mjs`');
L.push('이 로봇은 **아무 데이터도 고치지 않습니다** — 자기 리포트만 씁니다.');

fs.writeFileSync(new URL('coverage-report.md', HERE), L.join('\n'));

/* 비율 이력 — 오늘 숫자만으로는 '나아지고 있나'를 알 수 없다 */
const histPath = new URL('coverage-history.json', HERE);
let hist = {};
try { hist = JSON.parse(fs.readFileSync(histPath, 'utf8')); } catch { /* 첫 실행 */ }
hist[today.slice(0, 10)] = {
  schools: ok.length, boardCount: totalBoard, missing: totalMiss, unknown,
  coverage: totalBoard ? Math.round(((totalBoard - totalMiss) / totalBoard) * 100) : null,
  bySchool: Object.fromEntries(ok.map((r) => [r.school, r.coverage])),
};
fs.writeFileSync(histPath, JSON.stringify(hist, null, 1));

/* 다음 실행 시작 자리 — 이번에 감사한 학교 수만큼 앞으로 옮긴다.
   ⚠️ 워크플로 저장 목록에 이 파일을 넣는 것까지가 한 세트다(빠뜨리면 회전이 무의미). */
cur.next = nextCursor(all.length, cur.next || 0, ok.length + unreadable.length);
cur.updatedAt = today;
fs.writeFileSync(curPath, JSON.stringify(cur, null, 1));

console.log(`audit-coverage: 학교 ${ok.length}곳 · 후보 ${totalBoard} · 누락 ${totalMiss} · 원인 미상 ${unknown}`);
if (process.env.GITHUB_OUTPUT) {
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `unknown=${unknown}\nmissing=${totalMiss}\nschools=${ok.length}\n`);
}
process.exit(0);

/* 브라우저형 수집기 — 진짜 브라우저(Chromium)를 띄워, 일반 로봇을 막거나
   화면을 나중에 그리는 학교 게시판에서 장학 공고를 수집한다.
   결과는 일반 수집기와 같은 data/notices.json에 합쳐진다. */
import fs from 'node:fs';
import { chromium } from 'playwright';

const HERE = new URL('.', import.meta.url);
const cfg = JSON.parse(fs.readFileSync(new URL('browser-targets.json', HERE), 'utf8'));

const seenPath = new URL('seen.json', HERE);
let seen = {};
try { seen = JSON.parse(fs.readFileSync(seenPath, 'utf8')); } catch { /* 첫 실행 */ }

const noticesPath = new URL('../data/notices.json', HERE);
let notices = { updatedAt: null, items: [] };
try { notices = JSON.parse(fs.readFileSync(noticesPath, 'utf8')); } catch { /* 첫 실행 */ }

const KEYWORDS = /장학|학자금|등록금 감면|학업장려|근로장학/;
const MENU_NOISE = /안내$|규정$|제도|구분$|바로가기|메뉴|홈페이지$|가이드북|증명서$|융자|^학사\/|장학안내|예우|로그인|사이트맵|^장학\/|장학금·학자금|^학자금 ?대출$|경력개발|비교과|DONATION|기탁/;
const DEADLINE_RE = /(마감|까지|기한|접수기간|신청기간)[^\n<]{0,60}/;

const browser = await chromium.launch({
  args: ['--no-sandbox'],
});
const ctx = await browser.newContext({
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
  locale: 'ko-KR',
});

async function loadPage(url) {
  const page = await ctx.newPage();
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2500); // 동적 목록이 그려질 시간
    const links = await page.$$eval('a[href]', (as) => as.map((a) => ({
      title: (a.textContent || '').replace(/\s+/g, ' ').trim(),
      url: a.href,
    })));
    const html = await page.content();
    await page.close();
    return { links, html };
  } catch (e) {
    await page.close().catch(() => {});
    return { error: e.message ? e.message.slice(0, 80) : String(e) };
  }
}

const report = [`## 🖥 브라우저형 수집 리포트 (${new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 16).replace('T', ' ')} KST)`, ''];
const freshAll = [];

for (const t of cfg.targets) {
  const name = t.campus && t.campus !== '공통' ? `${t.school} ${t.campus}` : t.school;
  report.push(`### ${name}`);
  let harvested = false;
  for (const url of t.candidates) {
    const r = await loadPage(url);
    if (r.error) { report.push(`- ❌ 오류(${r.error}) · ${url}`); continue; }
    const items = r.links
      .filter((l) => l.title.length >= 6 && l.title.length <= 140 && /^https?:/.test(l.url))
      .filter((l) => KEYWORDS.test(l.title) && !MENU_NOISE.test(l.title));
    const uniq = [...new Map(items.map((i) => [i.url, i])).values()];
    report.push(`- ${uniq.length ? '✅' : '⚪'} 링크 ${r.links.length} · 장학 공고 ${uniq.length} · ${url}`);
    // 진단: 공고를 거의 못 알아본 게시판은 실제로 본 링크 제목을 남겨 원인 파악을 돕는다
    if (uniq.length <= 1 && r.links.length > 5) {
      const sample = [...new Map(r.links
        .filter((l) => l.title.length >= 8 && l.title.length <= 90)
        .map((l) => [l.title, l])).values()].slice(0, 14);
      sample.forEach((s) => report.push(`  - (본 링크) ${s.title.slice(0, 66)}`));
    }
    if (!uniq.length || harvested) continue;

    harvested = true;
    const fresh = uniq.filter((i) => !seen[i.url]).slice(0, 10);
    for (const it of fresh) {
      // 상세 페이지도 브라우저로 방문해 마감 단서·첨부 수집
      const d = await loadPage(it.url);
      let deadlineHint = null;
      let attachments = [];
      if (!d.error) {
        const text = d.html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
          .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
        const dm = text.match(DEADLINE_RE);
        deadlineHint = dm ? dm[0].trim().slice(0, 80) : null;
        attachments = d.links
          .filter((l) => /\.(hwp|hwpx|doc|docx|pdf|xls|xlsx)(\?|$)/i.test(l.url) || /download|fileDown/i.test(l.url))
          .filter((l) => l.title.length >= 4 && l.title.length <= 120)
          .slice(0, 6)
          .map((l) => ({ name: l.title.slice(0, 100), url: l.url }));
      }
      const rec = {
        title: it.title, url: it.url, attachments, deadlineHint,
        school: t.school, campus: t.campus === '공통' ? '' : t.campus,
        foundAt: new Date().toISOString().slice(0, 10),
      };
      seen[it.url] = rec.foundAt;
      freshAll.push(rec);
      report.push(`  - [수집] ${it.title.slice(0, 70)}`);
    }
  }
  report.push('');
}
await browser.close();

/* 발행 병합 (일반 수집기와 동일 규칙) */
notices.items = freshAll.concat(notices.items || []);
const cutoff = new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10);
notices.items = notices.items.filter((n) => (n.foundAt || '9999') >= cutoff);
const perSchool = {};
notices.items = notices.items.filter((n) => {
  const k = n.school + '|' + (n.campus || '');
  perSchool[k] = (perSchool[k] || 0) + 1;
  return perSchool[k] <= 15;
}).slice(0, 200);
notices.updatedAt = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
fs.writeFileSync(seenPath, JSON.stringify(seen, null, 1));
fs.writeFileSync(noticesPath, JSON.stringify(notices, null, 1));

report.push('---');
report.push(`이번 실행 신규 수집: **${freshAll.length}건** · 브라우저로도 수집 실패한 학교는 게시판 주소 확인이 필요합니다.`);
fs.writeFileSync(new URL('browser-report.md', HERE), report.join('\n'));
console.log(`browser-collect: ${freshAll.length} new items`);
if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `new_count=${freshAll.length}\n`);

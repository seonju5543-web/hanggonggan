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
/* 실공고 신호 — 연도·날짜·물결(~)·모집/선발/마감이 있으면 제목이 '안내'로 끝나도 공고로 본다
   (예: 경희대 "2026년도 ○○장학금 신청 안내" — 메뉴가 아니라 실공고) */
const NOTICE_SIGNAL = /\d{4}|\d{1,2}[./]\d{1,2}|~|모집|선발|마감/;
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
  const clickDetails = {}; // 클릭 수집 시 상세 화면에서 미리 채집한 마감·첨부
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(4000); // 동적 목록이 그려질 시간 (XHR 목록 포함)
    // 본문 프레임(iframe) 안까지 포함해 링크를 모은다 — 일부 학교는 목록을 프레임에 그림
    let links = [];
    for (const f of page.frames()) {
      const ls = await f.$$eval('a[href]', (as) => as.map((a) => ({
        title: (a.textContent || '').replace(/\s+/g, ' ').trim(),
        url: a.href,
      }))).catch(() => []);
      links = links.concat(ls);
      // 링크가 아닌 클릭형 목록(onclick)도 수집 — location.href='...' / view.do 패턴에서 주소 복원
      const clicks = await f.$$eval('[onclick]', (els) => els.map((e) => ({
        title: (e.textContent || '').replace(/\s+/g, ' ').trim(),
        onclick: e.getAttribute('onclick') || '',
      }))).catch(() => []);
      for (const c of clicks) {
        const m = c.onclick.match(/['"]((?:https?:\/\/|\/)[^'"]*(?:view|View|artcl|nttId)[^'"]*)['"]/);
        if (m && c.title) {
          try { links.push({ title: c.title, url: new URL(m[1], url).href }); } catch { /* skip */ }
        }
      }
    }
    /* 클릭형 게시판(행에 onclick만 있는 목록): 장학 키워드가 든 행을 실제로 클릭해
       이동한 상세 주소를 기록한다 — 스크립트 인자를 추측하지 않는 확실한 방법 */
    // 진짜(https) 상세 주소가 3개 미만이면 클릭 수집 가동 — javascript: 가짜 주소는 세지 않는다
    const kwAnchors = new Set(links
      .filter((l) => /^https?:/.test(l.url) && /장학|학자금/.test(l.title) && /view|View|artcl|ntt/.test(l.url))
      .map((l) => l.url)).size;
    let clickTried = 0;
    if (kwAnchors < 3) {
      // 클릭 대상: onclick 속성 행 + javascript: 가짜 주소 링크 (학교 게시판 양대 유형)
      const CLICKABLE = '[onclick], a[href^="javascript"]';
      const clickRows = await page.$$eval(CLICKABLE, (els) => els
        .map((e, i) => ({ i, t: (e.textContent || '').replace(/\s+/g, ' ').trim() }))
        .filter((x) => /장학|학자금/.test(x.t) && x.t.length >= 10 && x.t.length <= 120)
        .slice(0, 40).map((x) => [x.i, x.t])).catch(() => []);
      let ci = 0;
      clickTried = clickRows.length;
      const usedUrls = new Set(); // 상세 주소가 전부 같은 게시판(내부 전송형) 대응
      // 선조치: 클릭 수집은 행마다 클릭·대기가 있어 40건이면 오래 걸릴 수 있다.
      // 게시판당 클릭 예산(180초)을 두어 초과하면 그때까지 채집분만 남기고 넘어간다(런 전체 지연 방지).
      const clickBudgetMs = 180000; const clickStart = Date.now();
      for (const [idx, title] of clickRows) {
        if (Date.now() - clickStart > clickBudgetMs) { report.push(`  - (클릭 예산 초과 — ${ci}/${clickRows.length}건까지 채집)`); break; }
        ci += 1;
        try {
          const els = await page.$$(CLICKABLE);
          if (!els[idx]) continue;
          const popupP = ctx.waitForEvent('page', { timeout: 3500 }).catch(() => null);
          const navP = page.waitForNavigation({ timeout: 5000 }).catch(() => null);
          await els[idx].click({ timeout: 4000 });
          const popup = await popupP;
          const detailPage = popup || page;
          if (popup) await popup.waitForLoadState('domcontentloaded').catch(() => {});
          else { await navP; await page.waitForTimeout(1800); }
          // 클릭으로 열린 상세 화면에서 마감 단서·첨부를 즉시 채집
          //  (주소가 안 바뀌는 내부 전송형 게시판 대응 — 이때 링크는 목록 주소로 연결)
          const dHtml = await detailPage.content().catch(() => '');
          const dText = dHtml.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
            .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
          const dm = dText.match(DEADLINE_RE);
          const atts = (await detailPage.$$eval('a[href]', (as) => as.map((a) => ({
            title: (a.textContent || '').replace(/\s+/g, ' ').trim(), url: a.href,
          }))).catch(() => []))
            .filter((l) => /\.(hwp|hwpx|doc|docx|pdf|xls|xlsx)(\?|$)/i.test(l.url) || /download|fileDown/i.test(l.url))
            .filter((l) => l.title.length >= 4 && l.title.length <= 120)
            .slice(0, 6).map((l) => ({ name: l.title.slice(0, 100), url: l.url }));
          const navigated = detailPage.url() !== url && detailPage.url() !== 'about:blank';
          let recUrl = navigated ? detailPage.url() : url;
          // 상세 주소에 공고 구분자가 없거나(물음표 없는 view.do 등) 이미 쓴 주소면
          // 목록 주소 + 고유 표식으로 기록 — 사용자는 목록에서 해당 공고를 볼 수 있다
          if (!/\?.+/.test(recUrl) || usedUrls.has(recUrl)) {
            recUrl = `${url}#n-${encodeURIComponent(title.slice(0, 40))}`; // 제목 기반 — 재실행 시 중복 방지
          }
          usedUrls.add(recUrl);
          links.push({ title, url: recUrl });
          clickDetails[title] = { deadlineHint: dm ? dm[0].trim().slice(0, 80) : null, attachments: atts };
          if (popup) await popup.close().catch(() => {});
          else if (page.url() !== url) await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
          else { await page.goBack({ waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {}); }
          await page.waitForTimeout(1800);
          // 목록으로 못 돌아왔으면 강제로 다시 연다
          if (page.url() !== url) { await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {}); await page.waitForTimeout(1800); }
        } catch { /* 행 하나 실패는 건너뜀 */ }
      }
    }
    const html = await page.content();
    // 진단용: 화면 글자 중 장학 키워드가 든 줄 (링크로 안 잡히는 목록 탐지)
    const textLines = await page.evaluate(() =>
      (document.body.innerText || '').split('\n').map((s) => s.trim())
        .filter((s) => /장학|학자금/.test(s) && s.length >= 8 && s.length <= 90).slice(0, 10)
    ).catch(() => []);
    const frameCount = page.frames().length;
    await page.close();
    return { links, html, textLines, frameCount, clickDetails, clickTried };
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
      .filter((l) => KEYWORDS.test(l.title) && (NOTICE_SIGNAL.test(l.title) || !MENU_NOISE.test(l.title)));
    const uniq = [...new Map(items.map((i) => [i.url, i])).values()];
    report.push(`- ${uniq.length ? '✅' : '⚪'} 링크 ${r.links.length} · 장학 공고 ${uniq.length} · ${url}`);
    // 진단: 공고를 거의 못 알아본 게시판은 화면에서 본 것을 남겨 원인 파악을 돕는다
    if (uniq.length <= 1 && r.links.length > 5) {
      report.push(`  - (프레임 ${r.frameCount || 1}개 · 클릭 시도 ${r.clickTried || 0}건)`);
      (r.textLines || []).forEach((s) => report.push(`  - (본 글자) ${s.slice(0, 66)}`));
      const sample = [...new Map(r.links
        .filter((l) => l.title.length >= 10 && l.title.length <= 90 && /장학|학자금|\d{4}/.test(l.title))
        .map((l) => [l.title, l])).values()].slice(0, 10);
      sample.forEach((s) => report.push(`  - (본 링크) ${s.title.slice(0, 66)}`));
    }
    if (!uniq.length || harvested) continue;

    harvested = true;
    const fresh = uniq.filter((i) => !seen[i.url]).slice(0, 40);
    for (const it of fresh) {
      let deadlineHint = null;
      let attachments = [];
      // 클릭 수집 때 상세 화면에서 이미 채집했으면 재방문 없이 그대로 사용
      const cd = r.clickDetails && r.clickDetails[it.title];
      if (cd) {
        deadlineHint = cd.deadlineHint;
        attachments = cd.attachments || [];
      } else {
      // 상세 페이지도 브라우저로 방문해 마감 단서·첨부 수집
      const d = await loadPage(it.url);
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
  return perSchool[k] <= 40;
}).slice(0, 200);
notices.updatedAt = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
fs.writeFileSync(seenPath, JSON.stringify(seen, null, 1));
fs.writeFileSync(noticesPath, JSON.stringify(notices, null, 1));

report.push('---');
report.push(`이번 실행 신규 수집: **${freshAll.length}건** · 브라우저로도 수집 실패한 학교는 게시판 주소 확인이 필요합니다.`);
fs.writeFileSync(new URL('browser-report.md', HERE), report.join('\n'));
console.log(`browser-collect: ${freshAll.length} new items`);
if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `new_count=${freshAll.length}\n`);

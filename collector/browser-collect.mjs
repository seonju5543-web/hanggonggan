/* 브라우저형 수집기 — 진짜 브라우저(Chromium)를 띄워, 일반 로봇을 막거나
   화면을 나중에 그리는 학교 게시판에서 장학 공고를 수집한다.
   결과는 일반 수집기와 같은 data/notices.json에 합쳐진다. */
import fs from 'node:fs';
import { chromium } from 'playwright';
import { urlKey, dedupeNotices, capNotices } from './url-key.mjs';
import { isAttachmentEntry } from './attachment-link.mjs';
import { isMenuEntry } from './clean-title.mjs';
import { isDetailUrl, detailCandidates, sameTitle, idsFromSource } from './detail-url.mjs';

const HERE = new URL('.', import.meta.url);
const cfg = JSON.parse(fs.readFileSync(new URL('browser-targets.json', HERE), 'utf8'));

const seenPath = new URL('seen.json', HERE);
let seen = {};
try { seen = JSON.parse(fs.readFileSync(seenPath, 'utf8')); } catch { /* 첫 실행 */ }

const noticesPath = new URL('../data/notices.json', HERE);
let notices = { updatedAt: null, items: [] };
try { notices = JSON.parse(fs.readFileSync(noticesPath, 'utf8')); } catch { /* 첫 실행 */ }

const KEYWORDS = /장학|학자금|등록금 감면|학업장려|근로장학/;
/* 메뉴/공고 판정은 clean-title.mjs의 isMenuEntry 한 곳에만 둔다 — 여기 있던 MENU_NOISE·NOTICE_SIGNAL을
   그 모듈로 옮겼다. 일반 수집기와 갈라져 있어서 사고가 났다(2026-08-02 '…안내' 공고 대량 유실) */
const DEADLINE_RE = /(마감|까지|기한|접수기간|신청기간)[^\n<]{0,60}/;

const browser = await chromium.launch({
  args: ['--no-sandbox'],
});
const ctx = await browser.newContext({
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
  locale: 'ko-KR',
});

/* 페이지가 살아 있든 죽었든 그냥 쉬는 대기 — page.waitForTimeout과 달리 페이지에 의존하지 않는다 */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* 게시판 열기 — 학교 서버가 잠깐 느릴 때 한 번의 시간초과로 그 학교를 통째로
   놓치지 않도록 단계적으로 재시도한다 (2026-07-30 시립대 유실 사례로 도입).
   1차: 기본 30초 → 2차: 45초 → 3차: 45초 + '응답이 오면 통과'(commit) 완화 조건.
   상세 화면 방문은 attempts:1 — 실패해도 마감·첨부만 비고 목록은 남기 때문. */
async function gotoWithRetry(page, url, attempts) {
  let lastErr;
  for (let i = 0; i < attempts; i += 1) {
    // 페이지가 죽었으면 이 페이지로는 더 해 볼 수 없다 — 진짜 원인을 들고 나간다
    if (page.isClosed()) break;
    try {
      const waitUntil = i >= 2 ? 'commit' : 'domcontentloaded';
      await page.goto(url, { waitUntil, timeout: i === 0 ? 30000 : 45000 });
      return;
    } catch (e) {
      lastErr = e;
      // 쉬는 데 page.waitForTimeout을 쓰면 안 된다 (2026-08-02 이슈 #89):
      // 페이지가 닫혀서 goto가 실패한 경우 이 대기가 스스로 예외를 던져
      // **진짜 실패 원인을 덮어쓰고 남은 재시도까지 통째로 건너뛴다.**
      // 서울대·가천대·외대·상명대가 전부 이 경로로 '재시도 없이' 죽고 있었다.
      if (i < attempts - 1) await sleep(3000 * (i + 1)); // 페이지와 무관한 대기
    }
  }
  throw lastErr || new Error('페이지를 열지 못했습니다');
}

/* 공고 원문 주소가 '세션 없이도 열리는지' 한 번 확인한다.
   앱 사용자는 로그인도 리퍼러도 없이 링크를 누르므로, 그 조건 그대로 열어 봐야 한다.
   게시판마다 처음 한 번만 확인하고(주소 만드는 규칙은 게시판 안에서 같다) 결과를 재사용해,
   매일 수집이 느려지지 않게 한다. */
const patternOk = new Map(); // 게시판 목록 주소 → true/false
async function verifyDetailUrl(candidate, title) {
  const fresh = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
    locale: 'ko-KR',
  });
  const p = await fresh.newPage();
  try {
    const res = await p.goto(candidate, { waitUntil: 'domcontentloaded', timeout: 25000 });
    if (res && res.status() >= 400) return false;
    await p.waitForTimeout(1200);
    const docTitle = await p.title().catch(() => '');
    const text = await p.evaluate(() => (document.body.innerText || '').slice(0, 6000)).catch(() => '');
    if (sameTitle(title, docTitle)) return true;
    const fp = (s) => String(s).replace(/[\s .,·ㆍ~〜'"“”‘’!?()[\]{}<>:;|/\\_+\-*&#%]/g, '').toLowerCase();
    const t = fp(String(title).replace(/^\s*\d{1,5}\s+/, '').replace(/^\s*(공통|서울|글로벌|국제|공지)\s+/, ''));
    return t.length >= 8 && fp(text).includes(t);
  } catch {
    return false;
  } finally {
    await p.close().catch(() => {});
    await fresh.close().catch(() => {});
  }
}

async function loadPage(url, { attempts = 3, lines = report, retryClosed = 1 } = {}) {
  const page = await ctx.newPage();
  const clickDetails = {}; // 클릭 수집 시 상세 화면에서 미리 채집한 마감·첨부
  try {
    await gotoWithRetry(page, url, attempts);
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
      // 클릭 스크립트가 넘기는 글 번호(src)도 함께 받아 둔다 — 경희처럼 클릭이 form POST라
      // 주소창이 안 바뀌는 게시판은 이 번호가 원문 주소를 만드는 유일한 재료다 (2026-07-31)
      const clickRows = await page.$$eval(CLICKABLE, (els) => els
        .map((e, i) => ({
          i,
          t: (e.textContent || '').replace(/\s+/g, ' ').trim(),
          src: [e.getAttribute('onclick') || '', e.getAttribute('href') || '', e.getAttribute('data-id') || ''].join('|'),
        }))
        .filter((x) => /장학|학자금/.test(x.t) && x.t.length >= 10 && x.t.length <= 120)
        .slice(0, 40).map((x) => [x.i, x.t, x.src])).catch(() => []);
      let ci = 0;
      clickTried = clickRows.length;
      const usedUrls = new Set(); // 상세 주소가 전부 같은 게시판(내부 전송형) 대응
      // 선조치: 클릭 수집은 행마다 클릭·대기가 있어 40건이면 오래 걸릴 수 있다.
      // 게시판당 클릭 예산(180초)을 두어 초과하면 그때까지 채집분만 남기고 넘어간다(런 전체 지연 방지).
      const clickBudgetMs = 180000; const clickStart = Date.now();
      for (const [idx, title, rowSrc] of clickRows) {
        if (Date.now() - clickStart > clickBudgetMs) { lines.push(`  - (클릭 예산 초과 — ${ci}/${clickRows.length}건까지 채집)`); break; }
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
          /* 공고 원문 주소 정하기 (2026-07-31 전면 수정 — detail-url.mjs 규칙 사용).
             예전에는 '물음표가 있는가'로만 판정해서 두 가지를 놓쳤다:
               · 동국대처럼 주소가 `/article/JANGHAKNOTICE/detail/2666`(경로형)인 게시판 →
                 물음표가 없어 멀쩡한 상세 주소를 버리고 목록 주소로 대체했다.
               · 경희대처럼 클릭이 form POST라 주소창이 안 바뀌는 게시판 → 상세 화면 안에
                 GET으로도 열리는 주소(canonical·og:url·숨은 글 번호)가 있는데 안 찾아봤다.
             그 결과 앱에서 '원문 공고 ↗'를 누르면 학교 장학 공지 목록 전체가 열렸다. */
          const dom = await detailPage.evaluate(() => {
            const hidden = {};
            document.querySelectorAll('input[name]').forEach((i) => { if (i.name && i.value) hidden[i.name] = i.value; });
            const can = document.querySelector('link[rel=canonical]');
            const og = document.querySelector('meta[property="og:url"]');
            return {
              canonical: can ? can.getAttribute('href') : null,
              ogUrl: og ? og.getAttribute('content') : null,
              hiddenInputs: hidden,
            };
          }).catch(() => ({ hiddenInputs: {} }));
          const cands = detailCandidates({ ...dom, url: detailPage.url(), listUrl: url, rowIds: idsFromSource(rowSrc) })
            .filter((c) => isDetailUrl(c, url) && !usedUrls.has(c));
          let recUrl = null;
          if (cands.length) {
            if (!patternOk.has(url)) {
              // 이 게시판에서 처음 만든 주소 — 실제로 열어 그 공고가 맞는지 확인한다.
              // 통과하면 같은 게시판의 나머지 공고는 같은 규칙으로 만들어지므로 다시 확인하지 않는다.
              for (const c of cands.slice(0, 2)) {
                if (await verifyDetailUrl(c, title)) { patternOk.set(url, true); recUrl = c; break; }
              }
              if (!patternOk.has(url)) patternOk.set(url, false);
            } else if (patternOk.get(url)) {
              [recUrl] = cands;
            }
          }
          if (!recUrl) {
            // 원문으로 바로 가는 주소를 못 찾았을 때만 목록 주소 + 표식 (앱이 정직하게 안내한다)
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
    // 오류 문구는 한 줄로 (Playwright의 'Call log:' 여러 줄이 리포트를 깨뜨리던 것 정리)
    const msg = (e.message || String(e)).split('\n')[0].trim();
    // 페이지가 닫히거나 렌더러가 죽은 것은 '이 주소가 나쁘다'는 뜻이 아니라 '못 읽었다'는 뜻이다.
    // 죽은 페이지로는 재시도해도 소용없으니 **새 페이지로** 한 번 더 열어 본다 (이슈 #89).
    if (retryClosed > 0 && /has been closed|Target crashed|Session closed/i.test(msg)) {
      await sleep(2000);
      return loadPage(url, { attempts, lines, retryClosed: retryClosed - 1 });
    }
    return { error: msg.slice(0, 100) };
  }
}

const report = [`## 🖥 브라우저형 수집 리포트 (${new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 16).replace('T', ' ')} KST)`, ''];
const freshAll = [];

async function harvestTarget(t, report) {
  let harvested = false;
  let loadedAny = false; // 후보 주소 중 하나라도 열렸는지 (전부 실패 = 그 학교 이번 실행 누락)
  for (const url of t.candidates) {
    const r = await loadPage(url, { lines: report });
    if (r.error) { report.push(`- ❌ 오류(${r.error}) · ${url}`); continue; }
    loadedAny = true;
    const items = r.links
      .filter((l) => l.title.length >= 6 && l.title.length <= 140 && /^https?:/.test(l.url))
      // 메뉴 제외 — 일반 수집기와 같은 모듈을 써서 판정이 갈라지지 않게 한다
      .filter((l) => KEYWORDS.test(l.title) && !isMenuEntry(l.title))
      // 첨부파일 내려받기 링크 제외 — 안 막으면 '…포스터.png' 같은 파일 이름이 공고로 뜬다
      .filter((l) => !isAttachmentEntry(l));
    // 중복 판정은 정규화 주소로 — 시립대처럼 정렬 순번(sort=)이 주소에 붙는 게시판 대응
    const uniq = [...new Map(items.map((i) => [urlKey(i.url), i])).values()];
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
    const fresh = uniq.filter((i) => !seen[i.url] && !seen[urlKey(i.url)]).slice(0, 40);
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
      const d = await loadPage(it.url, { attempts: 1, lines: report }); // 실패해도 목록은 남으므로 재시도 없음
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
      seen[urlKey(it.url)] = rec.foundAt;
      freshAll.push(rec);
      report.push(`  - [수집] ${it.title.slice(0, 70)}`);
    }
  }
  return loadedAny;
}

/* 학교를 몇 곳씩 **동시에** 본다 (2026-08-01).
   예전엔 한 곳씩 차례로 봐서, 학교가 늘수록 뒤쪽 학교는 한참 뒤에나 차례가 왔고
   그 사이 장애가 나면 그 학교만 계속 빠졌다(11곳에 8분 — 30곳이면 20분).
   동시에 보는 건 **서로 다른 학교**뿐이라 한 학교를 몰아치는 일은 없다
   (같은 학교를 연달아 두드리면 서버가 막는다 — 2026-07-31 동국대).
   BROWSER_PARALLEL로 조절, 기본 3. 1로 두면 예전처럼 한 곳씩. */
const PARALLEL = Math.max(1, Number(process.env.BROWSER_PARALLEL || 3));

async function runPool(list, worker, size) {
  const queue = list.map((item, i) => ({ item, i }));
  const runners = Array.from({ length: Math.min(size, queue.length) }, async () => {
    for (;;) {
      const job = queue.shift();
      if (!job) return;
      await worker(job.item, job.i);
    }
  });
  await Promise.all(runners);
}

const failedTargets = [];
const targetLines = cfg.targets.map(() => []);   // 학교별 리포트 줄 (원래 순서대로 되돌리려고)
await runPool(cfg.targets, async (t, i) => {
  const name = t.campus && t.campus !== '공통' ? `${t.school} ${t.campus}` : t.school;
  const lines = targetLines[i];
  lines.push(`### ${name}`);
  const ok = await harvestTarget(t, lines);
  if (!ok) failedTargets.push({ t, name });
  lines.push('');
}, PARALLEL);
// 동시에 돌았어도 리포트는 **설정 파일 순서 그대로** 보이게 되돌린다
targetLines.forEach((lines) => lines.forEach((l) => report.push(l)));

/* 후보 주소가 전부 실패한 학교(= 학교 서버 일시 장애)는 다른 학교를 다 돈 뒤 한 번 더 시도한다.
   몇 분 뒤면 대개 회복되므로, 그날 그 학교 공고를 통째로 놓치는 일을 줄인다. */
const stillFailed = failedTargets.map((f) => f.name);
/* 단, 절반 넘는 학교가 실패했다면 로봇 쪽 네트워크 장애이므로 재시도해도 소용없다 — 실행만 길어진다 */
if (failedTargets.length && failedTargets.length <= Math.max(1, Math.floor(cfg.targets.length / 2))) {
  stillFailed.length = 0;
  report.push('### 🔁 실패 학교 재시도 (몇 분 뒤 재접속)');
  for (const f of failedTargets) {
    report.push(`**${f.name}**`);
    const ok = await harvestTarget(f.t, report);
    if (!ok) stillFailed.push(f.name);
    report.push('');
  }
}
await browser.close();

/* 발행 병합 (일반 수집기와 동일 규칙) */
notices.items = freshAll.concat(notices.items || []);
const cutoff = new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10);
notices.items = notices.items.filter((n) => (n.foundAt || '9999') >= cutoff);
/* 예전에 담긴 첨부파일 링크도 매 실행 걷어낸다 (소급 적용 — 운영 원칙 7) */
notices.items = notices.items.filter((n) => !isAttachmentEntry(n));
/* 같은 공고가 다른 주소(정렬 순번·클릭형 표식)로 여러 번 들어와 있으면 하나로 합친다 */
notices.items = dedupeNotices(notices.items);
/* 학교당 40건 · 전체는 학교 수에 비례 (학교 수 × 15건, 최소 200건).
   상한이 200건 고정이던 시절엔 학교를 더 붙이면 오래된 공고가 조용히 잘려 나갔다. */
notices.items = capNotices(notices.items);
notices.updatedAt = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
fs.writeFileSync(seenPath, JSON.stringify(seen, null, 1));
fs.writeFileSync(noticesPath, JSON.stringify(notices, null, 1));

report.push('---');
report.push(`이번 실행 신규 수집: **${freshAll.length}건** · 브라우저로도 수집 실패한 학교는 게시판 주소 확인이 필요합니다.`);
/* 접속 자체가 안 된 학교는 요약에 따로 적는다 — 리포트 중간의 ❌ 한 줄은 놓치기 쉬웠다.
   (재시도까지 실패해도 다음 실행에서 다시 수집되므로 공고가 영구히 사라지지는 않는다)

   그리고 '몇 번 연속 실패했는지'를 기록해 둔다. 한 번 실패는 학교 서버가 잠깐 느린 것이라
   다음 실행에서 저절로 복구되지만, 연속으로 실패하면 게시판 주소가 바뀐 것이므로
   사람이 손을 대야 한다. 이 구분이 없어서 시립대가 며칠씩 조용히 빠져 있었다 (2026-07-30). */
const healthPath = new URL('health.json', HERE);
let health = {};
try { health = JSON.parse(fs.readFileSync(healthPath, 'utf8')); } catch { /* 첫 실행 */ }
const runDate = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
const chronic = [];
for (const t of cfg.targets) {
  const name = t.campus && t.campus !== '공통' ? `${t.school} ${t.campus}` : t.school;
  const h = health[name] || { fails: 0, lastOk: null };
  if (stillFailed.includes(name)) {
    h.fails += 1;
    if (h.fails >= 3) chronic.push(`${name}(${h.fails}회 연속)`);
  } else {
    h.fails = 0; h.lastOk = runDate;
  }
  health[name] = h;
}
fs.writeFileSync(healthPath, JSON.stringify(health, null, 1));

if (stillFailed.length) {
  report.push('');
  report.push(`⚠️ **이번 실행에 접속 실패한 학교: ${stillFailed.join(', ')}** — 학교 서버가 응답하지 않아 이번 회차만 건너뛰었어요. 다음 실행(약 12시간 뒤)에 자동으로 다시 수집합니다.`);
}
if (chronic.length) {
  report.push('');
  report.push(`🚨 **여러 번 연속 실패한 학교: ${chronic.join(', ')}** — 일시 장애가 아니라 게시판 주소가 바뀌었을 가능성이 큽니다. 해당 학교 학생에게 새 공고가 나가지 않고 있으니 주소 확인이 필요해요(Claude 세션에 "○○대 게시판 주소 확인해줘"라고 지시하면 정찰 도구로 후보를 찾아드려요).`);
}
fs.writeFileSync(new URL('browser-report.md', HERE), report.join('\n'));
console.log(`browser-collect: ${freshAll.length} new items`);
if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `new_count=${freshAll.length}\n`);

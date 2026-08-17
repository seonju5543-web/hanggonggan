/* 브라우저형 수집기 — 진짜 브라우저(Chromium)를 띄워, 일반 로봇을 막거나
   화면을 나중에 그리는 학교 게시판에서 장학 공고를 수집한다.
   결과는 일반 수집기와 같은 data/notices.json에 합쳐진다. */
import fs from 'node:fs';
import { chromium } from 'playwright';
import { urlKey, dedupeNotices, capNotices, clickRowKey } from './url-key.mjs';
import { loadCandidates, mergeCandidates, saveCandidates } from './candidates.mjs';
import { isAttachmentEntry } from './attachment-link.mjs';
import { isMenuEntry } from './clean-title.mjs';
import { isDetailUrl, detailCandidates, sameTitle, idsFromSource } from './detail-url.mjs';
import { makeBudget, rotateOrder, nextCursor, withDeadline, TIMED_OUT } from './harvest-budget.mjs';

const HERE = new URL('.', import.meta.url);
const cfg = JSON.parse(fs.readFileSync(new URL('browser-targets.json', HERE), 'utf8'));

/* ── 시간 예산 (2026-08-03 시간초과 사고로 도입) ────────────────────────────
   워크플로의 timeout-minutes에 걸려 **취소**되면 그 아래 저장 단계가 통째로 죽어서
   그때까지 모은 공고가 전부 버려진다. 크래시와 달리 자바스크립트가 손쓸 틈이 없으므로
   (프로세스 강제 종료) 해법은 저장이 아니라 **스스로 예산 안에 끝내기**다.
   워크플로 상한(30분)보다 넉넉히 앞서 끝내 저장·감사·리포트 단계가 돌 시간을 남긴다. */
const BUDGET_MS = Number(process.env.HARVEST_BUDGET_MS || 22 * 60000);        // 기본 22분
/* 학교 하나를 새로 시작할 최소 여유 — 45초 → 2분 30초(2026-08-05) → **7분 30초(2026-08-07)**.
   45초는 '학교 한 곳에 드는 실제 시간'과 너무 동떨어진 값이었다. 후보 주소를 여는 데만
   최대 30+45+45초가 들고, 클릭 채집이 붙으면 몇 분이다. 그래서 예산이 45초 남았을 때
   학교를 새로 집어 들고는 한참을 더 썼다. 못 돈 학교는 커서 회전으로 다음 실행이
   먼저 도니 **건너뛰는 편이 언제나 이득**이다 — 넘기면 그날 수집분 전체를 잃는다.

   ⚠️ 2분 30초도 여전히 동떨어져 있었다 (2026-08-07 실제로 취소됨). 학교 하나의 **최악치는
   클릭 채집 180초 + 상세 방문 240초 = 7분**인데 2분 30초만 남아도 새로 집어 들었다.
   그날 실행은 학교 17곳을 9분 40초에 다 돌고도, 그 뒤 **실패 학교 재시도**(동국대·외대)가
   예산이 12분이나 남은 줄 알고 시작해 16분 30초를 썼다 → 22분 예산을 넘기고 26분 단계
   상한에 걸려 **취소**, 그날 수집분이 통째로 버려졌다.
   그래서 이 값은 **한 학교의 최악치보다 커야 한다** — 아래 두 예산의 합 + 여유.
   (재시도 패스도 같은 값을 쓰므로, 예산이 모자라면 재시도가 통째로 생략된다. 재시도는
    '덤'이라 생략해도 다음 실행이 커서 회전으로 다시 집는다.) */
const MIN_PER_TARGET_MS = Number(process.env.MIN_PER_TARGET_MS || 450000);
/* 한 학교에 허용하는 **절대 시한** (2026-08-17 신설 — 경위는 harvest-budget.mjs 참조).
   위 MIN_PER_TARGET_MS는 "이만큼 남았으면 학교를 하나 더 집어도 된다"는 **약속**이고,
   이 값은 그 약속을 **지키게 만드는 장치**다. 그래서 둘은 같은 값이어야 한다 —
   시한이 더 길면 '남은 시간 안에 끝난다'던 계산이 거짓이 되고, 더 짧으면 정상적으로
   오래 걸리는 학교(클릭 채집 180초 + 상세 방문 240초)를 멀쩡히 자른다.
   verify/test-collector.mjs가 이 대소관계를 지킨다. */
const TARGET_HARD_MS = Number(process.env.TARGET_HARD_MS || MIN_PER_TARGET_MS);
const budget = makeBudget(BUDGET_MS);

/* 이번 실행이 어느 학교부터 돌지 — 예산에 걸려 잘리는 학교가 매번 같지 않게 회전시킨다 */
const cursorPath = new URL('browser-cursor.json', HERE);
let cursor = { next: 0 };
try { cursor = JSON.parse(fs.readFileSync(cursorPath, 'utf8')); } catch { /* 첫 실행 */ }

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
    /* 진짜(https) 상세 주소가 3개 미만이면 클릭 수집 가동 — javascript: 가짜 주소는 세지 않는다.
       ⚠️ 메뉴 링크를 세면 안 된다 (2026-08-07 서울교대에서 실제로 샜다): 옆 메뉴의
       '장학제도'·'장학'·'학자금대출' 세 링크가 조건을 통과해 "이 게시판은 이미 잘 읽히는군"으로
       판정됐고, 그래서 클릭 수집이 아예 안 돌아 **공고 0건**이었다. 공고 제목인지 메뉴인지는
       수집 본체와 **같은 모듈**(isMenuEntry)로 판정해야 판정이 갈라지지 않는다. */
    const kwAnchors = new Set(links
      .filter((l) => /^https?:/.test(l.url) && /장학|학자금/.test(l.title) && /view|View|artcl|ntt/.test(l.url))
      .filter((l) => !isMenuEntry(l.title))
      .map((l) => l.url)).size;
    let clickTried = 0;
    let clickSkipped = 0;   // 이미 아는 공고라 다시 누르지 않은 행 수 (2026-08-17)
    if (kwAnchors < 3) {
      /* 클릭 대상: onclick 속성 행 + javascript: 가짜 주소 링크 + 해시(#) 가짜 주소 링크.
         셋째는 2026-08-07 추가 — 부산대 onestop은 행이 `<a href="#popup">`이고 클릭 처리는
         스크립트로 붙어 있어(onclick 속성 없음) 앞의 둘에 하나도 안 걸렸다. 그래서 46개 링크가
         전부 목록 주소로 접혀 **장학 공고 1건**(그마저 목록 주소)이었다. 눌러 보면
         `?mode=DETAIL&seq=685`로 제대로 넘어간다 — 로그인 없이 열리는 것까지 확인.
         '#'만으로는 '본문 바로가기' 같은 앵커도 걸리지만, 아래 제목 조건(장학 키워드 + 10~120자)이 거른다. */
      const CLICKABLE = '[onclick], a[href^="javascript"], a[href^="#"]';
      // 클릭 스크립트가 넘기는 글 번호(src)도 함께 받아 둔다 — 경희처럼 클릭이 form POST라
      // 주소창이 안 바뀌는 게시판은 이 번호가 원문 주소를 만드는 유일한 재료다 (2026-07-31)
      /* 화면에서는 넉넉히(80행) 받아 두고, **이미 아는 공고를 걸러낸 뒤에** 40건을 고른다.
         순서가 중요하다 — 예전처럼 화면에서 40행을 먼저 자르면, 위쪽 40행이 전부 아는
         공고인 게시판에서는 41번째의 새 공고에 영영 닿지 못한다. */
      const rawRows = await page.$$eval(CLICKABLE, (els) => els
        .map((e, i) => ({
          i,
          t: (e.textContent || '').replace(/\s+/g, ' ').trim(),
          src: [e.getAttribute('onclick') || '', e.getAttribute('href') || '', e.getAttribute('data-id') || ''].join('|'),
        }))
        .filter((x) => /장학|학자금/.test(x.t) && x.t.length >= 10 && x.t.length <= 120)
        .slice(0, 80).map((x) => [x.i, x.t, x.src])).catch(() => []);
      /* 🔴 이미 채집한 행은 다시 누르지 않는다 (2026-08-17).
         클릭형 게시판은 눌러 봐야 주소를 알 수 있어서, 예전엔 **장부를 보지 않고** 매 실행
         40행을 전부 다시 눌렀다. 클릭 한 번에 상세 열기·읽기·되돌아오기로 몇 초씩 들고
         게시판 예산은 180초라, **아는 공고를 다시 누르는 데 예산을 다 쓰고 목록 아래쪽의
         새 공고에는 닿지 못한 채 끊겼다.** 2026-08-17 실행에서 중앙대가 정확히 그랬다
         ("클릭 예산 초과 — 11/15건까지 채집" — 나머지 4건은 열어 보지도 못함).
         행에는 주소가 없으므로 **게시판+제목**으로 장부를 만든다(clickRowKey). */
      const clickRows = rawRows.filter(([, t]) => !seen[clickRowKey(url, t)]).slice(0, 40);
      clickSkipped = rawRows.length - clickRows.length;
      let ci = 0;
      clickTried = clickRows.length;
      const usedUrls = new Set(); // 상세 주소가 전부 같은 게시판(내부 전송형) 대응
      // 선조치: 클릭 수집은 행마다 클릭·대기가 있어 40건이면 오래 걸릴 수 있다.
      // 게시판당 클릭 예산(180초)을 두어 초과하면 그때까지 채집분만 남기고 넘어간다(런 전체 지연 방지).
      const clickBudgetMs = 180000; const clickStart = Date.now();
      for (const [idx, title, rowSrc] of clickRows) {
        if (Date.now() - clickStart > clickBudgetMs) { lines.push(`  - (클릭 예산 초과 — ${ci}/${clickRows.length}건까지 채집)`); break; }
        /* 전역 예산도 함께 본다 (2026-08-05 추가 — 여기가 마지막으로 남아 있던 구멍).
           이 루프는 자기 예산(180초)만 보고 있어서, 전역 예산이 끝난 뒤에 들어온 학교가
           3분을 더 쓸 수 있었다. 후보 주소 루프·상세 방문에는 이미 전역 확인이 있는데
           여기만 없었고, 그래서 8/5 05:52 실행이 22분 예산을 쓰고도 33분 42초까지 가
           작업 상한(34분)에 걸려 취소됐다 — 그날 수집분이 통째로 버려졌다. */
        if (budget.expired()) { lines.push(`  - (⏱ 시간 예산 초과 — ${ci}/${clickRows.length}건까지 채집)`); break; }
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
          /* 이 행이 '이미 수집한 공고'로 밝혀졌으면 지금 장부에 적어 둔다 — 안 적으면
             아래 상세 루프가 (이미 seen이라) 건드리지 않아 다음 실행에 또 누르게 된다.
             새로 수집되는 행은 상세 루프가 적는다(그쪽이 '진짜 저장됐다'는 확증). */
          const known = seen[urlKey(recUrl)] || seen[recUrl];
          if (known) seen[clickRowKey(url, title)] = known;
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
    return { links, html, textLines, frameCount, clickDetails, clickTried, clickSkipped };
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
    // 전역 예산이 다 됐으면 남은 후보 주소는 포기 — 여기서 멈춰야 저장 단계까지 갈 수 있다
    if (budget.expired()) { report.push('- ⏱ 시간 예산 초과 — 남은 후보 주소 건너뜀'); break; }
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
    /* 이미 아는 행을 건너뛰면 '장학 공고 N'이 줄어드는 게 정상이다. 그 사실을 적지 않으면
       리포트만 보고 "공고가 줄었다 = 로봇이 고장났다"로 읽게 된다 (2026-08-17). */
    const skipNote = r.clickSkipped ? ` · 이미 아는 공고 ${r.clickSkipped}건은 다시 열지 않음` : '';
    report.push(`- ${uniq.length ? '✅' : '⚪'} 링크 ${r.links.length} · 장학 공고 ${uniq.length}${skipNote} · ${url}`);
    /* 진단: 공고를 거의 못 알아본 게시판은 화면에서 본 것을 남겨 원인 파악을 돕는다.
       단 '아는 공고를 건너뛰어서 0건'인 경우는 고장이 아니므로 진단을 쏟아내지 않는다 —
       매일 정상 게시판마다 (본 링크) 열 줄씩 쌓이면 리포트가 이슈 한도를 넘긴다. */
    if (uniq.length <= 1 && r.links.length > 5 && !r.clickSkipped) {
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
    /* 상세 방문은 학교당 최대 40건 × 최대 30초라 **한 학교가 20분을 먹을 수 있었다**
       (2026-08-03 시간초과의 가장 큰 원인 — 클릭 채집에만 예산이 있고 여기엔 없었다).
       잘려도 공고 자체는 목록에서 이미 확보돼 저장되고, 마감·첨부만 다음 실행에서 채워진다. */
    const detailBudgetMs = Number(process.env.DETAIL_BUDGET_MS || 240000);   // 학교당 4분
    const detailStart = Date.now();
    let di = 0;
    let detailSkipped = false;
    for (const it of fresh) {
      di += 1;
      let deadlineHint = null;
      let attachments = [];
      // 클릭 수집 때 상세 화면에서 이미 채집했으면 재방문 없이 그대로 사용
      const cd = r.clickDetails && r.clickDetails[it.title];
      if (cd) {
        deadlineHint = cd.deadlineHint;
        attachments = cd.attachments || [];
      } else if (Date.now() - detailStart > detailBudgetMs || budget.expired()) {
      // 예산 초과 — 마감·첨부 없이 목록 정보만으로 담는다 (공고를 놓치는 것보다 낫다)
      if (di === 1 || !detailSkipped) report.push(`  - (상세 방문 예산 초과 — ${di}/${fresh.length}건부터 목록 정보만)`);
      detailSkipped = true;
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
      /* 클릭형 게시판이면 '이 행은 처리했다'도 함께 적는다 — 다음 실행이 다시 누르지 않게.
         클릭이 아닌 게시판에도 적히지만 해가 없고, 나중에 그 게시판이 클릭형으로 바뀌면 그대로 쓰인다. */
      seen[clickRowKey(url, it.title)] = rec.foundAt;
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
const skipped = [];
const hung = [];                                 // 절대 시한에 걸려 강제로 끊은 학교 (2026-08-17)
/* 시간을 사람 말로 — 450,000을 '8분'으로 반올림하면 리포트가 사실과 어긋난다(실제 7분 30초) */
const humanMs = (ms) => {
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}초` : (s % 60 ? `${Math.floor(s / 60)}분 ${s % 60}초` : `${s / 60}분`);
};

/* 학교 한 곳을 보되, 절대 시한을 넘기면 **기다리기를 그만두고** 돌아온다 (2026-08-17).
   여기서 끊지 않으면 로봇이 그 자리에 멈춰 서고, 강제 종료되면 저장 단계까지 죽어
   그날 수집분 전체가 버려진다 — 8/15~17에 3회 연속 그렇게 됐다.
   끊어도 손해가 작은 이유: 공고는 harvestTarget 안에서 **한 건씩 바로** freshAll·seen에
   담기므로, 끊긴 시점까지 모은 것은 그대로 저장된다. */
async function harvestWithDeadline(t, lines, name, label = '') {
  const t0 = Date.now();
  const tag = label ? `${label} ${name}` : name;
  console.log(`[${Math.round(budget.elapsed() / 1000)}s] ▶ ${tag}`);
  let ok = false;
  let stalled = false;
  try {
    const r = await withDeadline(harvestTarget(t, lines), TARGET_HARD_MS);
    if (r === TIMED_OUT) {
      stalled = true;
      lines.push(`- ⛔ 응답이 멈춰 ${humanMs(TARGET_HARD_MS)}에서 강제 중단 — 여기까지 채집한 공고만 저장합니다`);
    } else {
      ok = r;
    }
  } catch (e) {
    /* 학교 하나가 예기치 못하게 터져도 실행 전체를 끌고 가면 안 된다 —
       runPool은 Promise.all이라, 여기서 안 잡으면 저장 단계에 닿지 못한다. */
    lines.push(`- ❌ 예기치 못한 오류(${(e && e.message ? e.message : String(e)).split('\n')[0].slice(0, 80)})`);
  }
  const took = Math.round((Date.now() - t0) / 1000);
  const verdict = stalled ? '⛔ 응답 멈춤(강제 중단)' : (ok ? '수집' : '실패');
  console.log(`[${Math.round(budget.elapsed() / 1000)}s] ◀ ${tag} — ${verdict} (${took}초)`);
  return { ok, stalled };
}

/* 이번 실행은 커서 자리부터 시작한다 — 예산에 걸려 잘리는 학교가 매번 같지 않도록 */
const order = rotateOrder(cfg.targets.length, cursor.next || 0);
let doneCount = 0;

await runPool(order, async (idx) => {
  const t = cfg.targets[idx];
  const name = t.campus && t.campus !== '공통' ? `${t.school} ${t.campus}` : t.school;
  const lines = targetLines[idx];
  /* 한 학교를 새로 시작하려면 최소한의 여유가 있어야 한다 —
     30초 남았는데 시작하면 어차피 중간에 잘리고 저장 단계도 못 간다 */
  if (!budget.hasRoom(MIN_PER_TARGET_MS)) {
    skipped.push(name);
    lines.push(`### ${name}`, '- ⏱ 시간 예산 초과 — 이번 실행은 건너뜀 (다음 실행이 여기서부터 시작)', '');
    return;
  }
  lines.push(`### ${name}`);
  /* 학교마다 시작·끝을 실행 로그에 남긴다 (2026-08-05 추가 — harvestWithDeadline 안).
     리포트는 저장 단계에서야 커밋되므로, 작업이 취소되면 **아무 흔적도 안 남는다**.
     8/5 05:52 실행이 33분을 쓰고 취소됐을 때 로그가 통째로 비어 있어서 어느 학교가
     시간을 먹었는지 알 수 없었다. 실행 로그는 취소돼도 남으므로 여기에 찍어 둔다. */
  const { ok, stalled } = await harvestWithDeadline(t, lines, name);
  /* 멈춘 학교는 **재시도하지 않는다** — 답을 안 주는 서버를 한 번 더 두드려 봐야 시한을
     또 한 번 통째로 쓸 뿐이다. 8/16 08:29 실행이 정확히 그 재시도에서 하루치를 잃었다. */
  if (stalled) hung.push(name);
  else if (!ok) failedTargets.push({ t, name });
  doneCount += 1;
  lines.push('');
}, PARALLEL);
// 동시에 돌았어도 리포트는 **설정 파일 순서 그대로** 보이게 되돌린다
targetLines.forEach((lines) => lines.forEach((l) => report.push(l)));

/* 후보 주소가 전부 실패한 학교(= 학교 서버 일시 장애)는 다른 학교를 다 돈 뒤 한 번 더 시도한다.
   몇 분 뒤면 대개 회복되므로, 그날 그 학교 공고를 통째로 놓치는 일을 줄인다. */
const stillFailed = failedTargets.map((f) => f.name);
/* 단, 절반 넘는 학교가 실패했다면 로봇 쪽 네트워크 장애이므로 재시도해도 소용없다 — 실행만 길어진다 */
if (failedTargets.length && failedTargets.length <= Math.max(1, Math.floor(cfg.targets.length / 2))
    && budget.hasRoom(MIN_PER_TARGET_MS)) {
  stillFailed.length = 0;
  report.push('### 🔁 실패 학교 재시도 (몇 분 뒤 재접속)');
  /* 예전엔 순차(for)라 8곳이 실패하면 학교 하나씩 처음부터 다시 돌아 실행이 통째로 길어졌다
     — 2026-08-03 시간초과의 두 번째 원인. 본 수집과 같은 병렬 풀을 쓴다. */
  const retryLines = failedTargets.map(() => []);
  await runPool(failedTargets.map((_, i) => i), async (i) => {
    const f = failedTargets[i];
    const lines = retryLines[i];
    lines.push(`**${f.name}**`);
    if (!budget.hasRoom(MIN_PER_TARGET_MS)) {
      lines.push('- ⏱ 시간 예산 초과 — 재시도 생략', '');
      stillFailed.push(f.name);
      return;
    }
    /* 재시도에도 시작·끝을 실행 로그에 남긴다 (2026-08-07 추가 — 여기가 비어 있어서
       16분 30초가 어디로 갔는지 아무도 못 봤다). 본 수집에는 8/5에 넣었는데 짝인
       이쪽을 빠뜨렸고, 리포트는 취소되면 커밋 자체가 안 되므로 실행 로그가 유일한 단서다.
       절대 시한도 본 수집과 **같은 장치**를 쓴다 — 2026-08-16 08:29 실행은 학교 17곳을
       7분 50초에 다 돌고도 이 재시도(가천대)가 멈춰 18분을 서 있다 강제 종료됐고,
       다 모아 둔 하루치가 통째로 버려졌다. 덤으로 붙는 일이 본 수집을 죽이면 안 된다. */
    const { ok, stalled } = await harvestWithDeadline(f.t, lines, f.name, '(재시도)');
    if (stalled) hung.push(f.name);
    else if (!ok) stillFailed.push(f.name);
    lines.push('');
  }, PARALLEL);
  retryLines.forEach((lines) => lines.forEach((l) => report.push(l)));
} else if (failedTargets.length && !budget.hasRoom(MIN_PER_TARGET_MS)) {
  report.push('### 🔁 실패 학교 재시도 — ⏱ 시간 예산이 없어 생략 (다음 실행에서 다시 시도)', '');
}
/* 멈춘 학교도 '이번 실행에 못 받아온 학교'다 — health.json에 실패로 기록해야
   연속 3회부터 "주소가 바뀐 것 같다"는 경고가 뜬다. 재시도 분기가 stillFailed를
   비우고 다시 채우므로, 합치는 것은 그 분기가 끝난 **뒤**여야 한다. */
stillFailed.push(...hung);

/* 브라우저 닫기에도 시한을 둔다 — 멈춘 페이지를 안고 있으면 여기서 또 멈출 수 있고,
   그러면 바로 아래 저장을 못 해 지금까지 모은 것이 다시 전부 버려진다. */
await withDeadline(browser.close(), 30000);

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
/* 검수 후보 장부에도 남긴다 (2026-08-17) — 아래 capNotices가 잘라내도 여기에는 남는다.
   상한은 **폰이 받는 파일**을 작게 유지하려는 것이지 '이 공고는 볼 필요 없다'는 뜻이 아닌데,
   예전엔 잘린 공고가 seen.json에만 '봤다'로 남아 다시 수집되지도, 검수되지도 않았다
   (2026-08-17 실측 747건 유실). 경위는 collector/candidates.mjs 첫머리. */
saveCandidates(mergeCandidates(loadCandidates().items, freshAll));

notices.items = capNotices(notices.items);
notices.updatedAt = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
fs.writeFileSync(seenPath, JSON.stringify(seen, null, 1));
fs.writeFileSync(noticesPath, JSON.stringify(notices, null, 1));

/* 다음 실행 시작 자리 저장 — 이번에 못 돈 학교가 다음 실행의 맨 앞이 된다 */
cursor.next = nextCursor(cfg.targets.length, cursor.next || 0, doneCount);
cursor.updatedAt = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 16).replace('T', ' ');
fs.writeFileSync(cursorPath, JSON.stringify(cursor, null, 1));

report.push('---');
report.push(`이번 실행 신규 수집: **${freshAll.length}건** · 브라우저로도 수집 실패한 학교는 게시판 주소 확인이 필요합니다.`);
report.push(`⏱ 소요 ${Math.round(budget.elapsed() / 60000)}분 / 예산 ${Math.round(BUDGET_MS / 60000)}분 · 학교 ${doneCount}/${cfg.targets.length}곳 처리`);
if (skipped.length) {
  report.push(`⏱ **시간 예산으로 건너뛴 학교 ${skipped.length}곳**: ${skipped.join(' · ')}`);
  report.push(`  → 다음 실행은 **${cfg.targets[cursor.next] ? (cfg.targets[cursor.next].school) : '처음'}**부터 시작합니다(하루 2회 실행이라 모든 학교가 하루 안에 한 번은 돕니다).`);
}
if (hung.length) {
  report.push(`⛔ **응답이 멈춰 강제로 끊은 학교 ${hung.length}곳**: ${hung.join(' · ')} — 학교 서버가 연결만 열어 두고 답을 주지 않아 ${humanMs(TARGET_HARD_MS)}에서 끊었어요. 끊지 않으면 로봇이 그 자리에 멈춰 서고, 강제 종료되면서 **그날 수집분 전체가 버려집니다**(2026-08-15~17에 3회 연속 그렇게 됐어요). 다음 실행(약 12시간 뒤)에 다시 시도합니다.`);
}
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

/* 여기서 명시적으로 끝낸다 (2026-08-17).
   강제로 끊은 학교의 브라우저 작업은 **버렸을 뿐 아직 돌고 있을 수 있다**. 그것이 붙잡고
   있는 타이머·소켓 때문에 노드가 저 혼자 안 죽으면, 저장은 다 끝났는데도 단계 상한에 걸려
   '실패'로 끝난다 — 그러면 워크플로가 이번 수집을 실패로 알리고 리포트 이슈도 안 만든다.
   위 저장은 전부 동기(writeFileSync/appendFileSync)라 이미 디스크에 내려갔으므로 안전하다. */
process.exit(0);

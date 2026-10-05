/* 링크 정찰 — '이 주소가 학생에게 실제로 어떻게 보이는가'를 눈으로 확인하는 도구 (2026-08-01)

   왜 만들었나
   ─────────────────────────────────────────────────────────────
   경희대 원문 링크가 앱에서는 통과했는데 실제로는 '로그인하세요'가 떴다.
   확인 기준에 로그인 벽이 없었기 때문인데, 더 근본적으로는
   **'우리가 보고 있는 게시판이 학생이 보는 그 게시판이 맞는가'**를 한 번도 확인하지 않았다.
   (경희대는 news.khu.ac.kr을 수집하고 있었는데, 개발자는 대학생활→장학 탭에서 공고를 본다.)

   무엇을 하나
   ─────────────────────────────────────────────────────────────
   ① checkUrl: 주어진 주소를 **로그인 없는 새 탭**에서 열어 그대로 보고한다
      (최종 주소·상태·화면 제목·로그인 벽인지·화면 앞부분 글자).
   ② findBoard: 학교 홈에서 메뉴 글자(예: '대학생활', '장학')를 따라 들어가
      **학생이 실제로 보는 게시판 주소**와 그 안의 공고 링크 몇 개를 찾아 보고한다.

   설정은 collector/run-probe.txt 에 적는다 (push하면 probe-links.yml이 실행):
      checkUrl: https://…
      findBoard: https://www.khu.ac.kr/ | 대학생활 > 장학
   결과: collector/probe-report.md */
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';
import { looksLikeLoginWall, isDetailUrl } from './detail-url.mjs';
import { directives, addedDirectives } from './probe-lines.mjs';

const HERE = new URL('.', import.meta.url);
let cfg = '';
try { cfg = fs.readFileSync(new URL('run-probe.txt', HERE), 'utf8'); } catch { /* 없으면 빈 실행 */ }

/* 🔴 push 로 깼으면 **이번 push 가 새로 넣은 줄만** 연다 (2026-10-05 로봇·도구 점검 · gaps-05 · collector/probe-lines.mjs 머리말).
   PROBE_BEFORE = push 직전 커밋(github.event.before). 셸을 거치지 않고, 40자리 16진수일 때만 git 에 넘긴다(notion-status 와 같은 검사).
   옛 판을 못 읽으면 전부 열고 리포트 첫머리에 그렇다고 적는다(정직). 손으로 돌리면(PROBE_BEFORE 없음) 지금처럼 전부 연다. */
const probeBefore = String(process.env.PROBE_BEFORE || '').trim();
let only = null;          // null = 전부 · 아니면 { checkUrl: [...], findBoard: [...] }
let scopeNote = '';
if (probeBefore) {
  if (/^[0-9a-f]{40}$/.test(probeBefore) && !/^0+$/.test(probeBefore)) {
    try {
      const old = execFileSync('git', ['show', `${probeBefore}:collector/run-probe.txt`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
      only = addedDirectives(old, cfg);
      scopeNote = `_이번 push 가 새로 넣은 줄만 열었다 — checkUrl ${only.checkUrl.length} · findBoard ${only.findBoard.length} (그대로인 옛 줄은 다시 두드리지 않는다 · 전부 보려면 Actions 에서 수동 실행)_`;
    } catch { /* 옛 판을 못 읽음 — 아래에서 전부 연다 */ }
  }
  if (!only) scopeNote = '⚠️ 이번엔 바뀐 줄을 못 가려 전부 열었다 (push 직전 판의 run-probe.txt 를 못 읽음)';
}
const lines = (key) => (only ? only[key] || [] : directives(cfg, key));

const report = [`## 🔎 링크 정찰 리포트 (${new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 16).replace('T', ' ')} KST)`, ''];
if (scopeNote) report.push(scopeNote, '');
const browser = await chromium.launch({ args: ['--no-sandbox'] });
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

/* 확인용 브라우저는 **하나만 만들어 재사용**하고 쿠키만 비운다.
   주소마다 새로 만들면 학교 서버가 연결을 끊는다(ERR_CONNECTION_CLOSED) —
   저장소에 이미 적혀 있던 규칙인데 이 도구만 지키지 않고 있었다. 실제로 2026-08-01
   정찰에서 주소 3개를 연달아 열자 4번째가 그대로 끊겼다. */
let sharedCtx = null;
async function freshPage() {
  if (!sharedCtx) sharedCtx = await browser.newContext({ userAgent: UA, locale: 'ko-KR' });
  await sharedCtx.clearCookies().catch(() => {});
  return { page: await sharedCtx.newPage(), ctx: null };
}

/* JSON 응답 요약 — 글처럼 생긴 객체 배열(깊이 4까지)을 찾아 칸 이름과 앞 30개 글의 번호·제목·날짜·고정 표시 칸만 적는다.
   서강(정찰 2차: 화면 글자 300자에서 잘려 1번 글만 보였다)·중앙(응답 칸 이름 미확인)의 규칙 재료. 값은 응답 그대로다. */
function summarizeJson(j) {
  const find = (o, d = 0) => {
    if (Array.isArray(o)) return o.length && typeof o[0] === 'object' && o[0] ? o : null;
    if (!o || typeof o !== 'object' || d > 4) return null;
    for (const v of Object.values(o)) { const hit = find(v, d + 1); if (hit) return hit; }
    return null;
  };
  const arr = find(j);
  if (!arr) return `JSON (글 배열 없음) · 칸: ${Object.keys(j || {}).slice(0, 12).join(',')}`;
  const keys = Object.keys(arr[0]);
  const pickKeys = keys.filter((k) => /title|subject|id$|seq|^no$|date|_dt$|top|notice|fix/i.test(k)).slice(0, 8);
  const items = arr.slice(0, 30).map((x) => '{' + pickKeys.map((k) => `${k}:${String(x[k] ?? '').replace(/\s+/g, ' ').slice(0, 28)}`).join(',') + '}');
  return `JSON 글 배열 ${arr.length}개 · 칸 ${keys.length}개: ${keys.slice(0, 24).join(',')} · 앞 ${items.length}개: ${items.join(' ')}`.slice(0, 3200);
}

/* ── ① 주소 하나를 학생 눈으로 열어 본다 ── */
/* 시한 (2026-10-02 · 4차 정찰이 15분 작업 시한에 잘려 리포트가 하나도 안 남았다 — 어느 화면에서 멈췄는지도 몰랐다).
   측정 하나하나에 시한을 걸고(넘으면 fallback), 주소 하나에도 절대 시한을 건다. 리포트는 주소를 끝낼 때마다 파일·로그에 바로 쓴다. */
const within = (p, ms, fallback) => Promise.race([Promise.resolve(p).catch(() => fallback), new Promise((r) => setTimeout(() => r(fallback), ms))]);
const URL_HARD_MS = 100000;
function flushReport() { try { fs.writeFileSync(new URL('probe-report.md', HERE), report.join('\n')); } catch { /* 쓰기 실패는 다음 주소에서 다시 */ } }

/* 리포트는 **부른 쪽이 준 그릇(out)** 에만 쓴다 (재검증 2026-10-02) — 시한에 끊긴 측정은 뒤에서 계속 돌며 전역 리포트에 써서,
   다음 주소의 절 한가운데에 앞 주소의 줄이 끼어들었다. 끊긴 뒤의 줄은 버려진 그릇에 쌓여 리포트에 안 나온다. */
async function checkUrl(url, out) {
  const { page, ctx } = await freshPage();
  /* 화면이 부르는 요청을 적는다 (2026-10-01) — SPA(서강)·스크립트 목록(고려·중앙·시립)은 목록을 **별도 요청**으로 받아 그린다.
     그 주소(bbsConfigFk 같은 열쇠)와 폼 전송의 본문(경희 view.do)이 규칙의 재료다. 그림·글꼴·스크립트 파일은 뺀다. */
  const reqs = [];
  const NOISE = /google-analytics|googletagmanager|analytics\.google|doubleclick|facebook|vstLog|getSearchKeywords|imageSlide/i;   // 목록과 무관한 추적·장식 요청
  page.on('request', (r) => {
    try {
      const u = r.url(); const t = r.resourceType();
      if (!/^(xhr|fetch|document)$/.test(t)) return;
      if (NOISE.test(u)) return;
      if (/\.(css|js|png|jpe?g|gif|svg|webp|ico|woff2?|ttf|map)(\?|$)/i.test(u)) return;
      const pd = r.postData();
      const line = `${r.method()} ${u.slice(0, 220)}${pd ? ` · 본문: ${String(pd).slice(0, 220)}` : ''}`;
      if (!reqs.includes(line) && reqs.length < 14) reqs.push(line);
    } catch { /* 요청 객체가 이미 닫힘 */ }
  });
  /* 스크립트 요청(xhr·fetch)의 **응답 앞부분**도 적는다 (2026-10-02) — 중앙 POST 목록 API 가 HTML 조각인지 JSON 인지, 서강 API 의 칸 이름이 무엇인지는
     요청만으로는 모른다(9차: 중앙을 HTML 로 가정했다가 0행). 규칙은 이 응답을 보고 적는다. */
  const resps = [];
  page.on('response', async (r) => {
    try {
      const q = r.request(); const t = q.resourceType(); const u = r.url();
      if (!/^(xhr|fetch)$/.test(t) || NOISE.test(u) || resps.length >= 8) return;
      const head = `${q.method()} ${u.slice(0, 160)} → ${r.status()} · ${r.headers()['content-type'] || '?'}`;
      const raw = await r.text().catch(() => null);
      if (raw === null) { resps.push(`${head} · 본문 못 읽음 (빈 응답과 다르다)`); return; }   // 리뷰 2026-10-02: 못 읽은 것을 '0자'로 적으면 0KB 응답과 헷갈린다
      let sum = '';
      try { sum = summarizeJson(JSON.parse(raw)); } catch { sum = ''; }
      resps.push(`${head} · ${raw.length}자 · ${sum || `앞 360자: ${raw.replace(/\s+/g, ' ').slice(0, 360)}`}`);
    } catch { /* 응답이 이미 닫힘 */ }
  });
  try {
    const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});   // 스크립트가 목록을 다 그릴 때까지 (시립 7차: 2.5초로는 빈 화면)
    await page.waitForTimeout(2500);
    const info = await within(page.evaluate(() => ({
      title: document.title || '',
      text: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 700),
      pw: !!document.querySelector('input[type=password]'),
      h: (document.querySelector('h1,h2,h3,.title,.subject,.view-title') || {}).textContent || '',
    })), 8000, { title: '', text: '', pw: false, h: '' });
    const wall = looksLikeLoginWall(info.text, info.pw);
    out.push(`### 🔗 ${url}`);
    out.push(`- 상태 ${res ? res.status() : '?'} · 최종 주소: ${page.url()}`);
    out.push(`- 화면 제목: ${info.title.trim().slice(0, 90)}`);
    out.push(`- 큰 제목: ${String(info.h).replace(/\s+/g, ' ').trim().slice(0, 90)}`);
    out.push(`- **로그인 요구: ${wall ? '⛔ 예 — 학생이 못 봅니다' : '✅ 아니오'}**${info.pw ? ' (비밀번호 입력칸 있음)' : ''}`);
    out.push(`- 화면 글자: ${info.text.slice(0, 300)}`);
    /* 서버가 보낸 HTML 과 그린 화면을 견준다 (2026-10-02 · 고려·상명: 화면엔 목록 줄이 있는데 로봇이 받은 HTML 엔 없었다) — 줄이 서버 HTML 에 없으면 스크립트가 그린 것이다 */
    {
      const DATE_G = /(20\d{2})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})(?!\d)/g;
      const server = res ? await within(res.text(), 8000, null) : null;
      const shown = await within(page.evaluate(() => document.body.innerText || ''), 8000, '');
      const n = (t) => ((t || '').match(DATE_G) || []).length;
      out.push(server == null ? '- 서버가 보낸 HTML: 못 읽음' : `- 서버가 보낸 HTML ${server.length}자 · 날짜 ${n(server.replace(/<[^>]+>/g, ' '))}개 / 그린 화면 날짜 ${n(shown)}개 · <tr> ${(server.match(/<tr\b/gi) || []).length}개 · <script> ${(server.match(/<script\b/gi) || []).length}개`);
      /* 서버 HTML 의 첫 글 줄 근처 (상명 4차: 서버 HTML 에 날짜 43개인데 그린 화면의 표와 생김새가 달랐다) — 본문(<body>) 안 첫 날짜 앞 900자 */
      if (server) { const b = server.slice(Math.max(0, server.search(/<body\b/i))); const k = b.search(/(20\d{2})\s*[.\-/]\s*\d{1,2}\s*[.\-/]\s*\d{1,2}/); if (k > 0) out.push(`- 서버 HTML 의 첫 날짜 앞 900자: \`${b.slice(Math.max(0, k - 900), k + 40).replace(/\s+/g, ' ').replace(/`/g, "'")}\``); }
    }
    /* ③ 목록 요소의 HTML — **누르기 전에** 뜬다 (리뷰 2026-10-02: 누른 뒤에 뜨면 상세·바닥글 화면의 것이 적혔다 · 계명 2차 정찰).
       날짜가 가장 많이 든 목록 요소(머리·메뉴·바닥 제외)를 고르고, 같은 수면 더 안쪽 것. <script>·<style> 은 빼고 적는다(상명 2차: 조각이 스크립트뿐이었다). */
    const frag = await within(page.evaluate(() => {
      const DATE = /(20\d{2})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})(?!\d)|(?<!\d)\d{2}\.\d{2}\.\d{2}(?!\d)/g;
      const els = [...document.querySelectorAll('table, tbody, ul, ol, dl, [class*="board"], [class*="bbs"], [class*="list"], [id*="board"], [id*="list"]')]
        .filter((e) => !e.closest('header, nav, footer, #footer, .footer'));
      let best = null; let bestN = 0;
      for (const e of els) {
        const n = ((e.innerText || '').match(DATE) || []).length;
        if (n > bestN || (n === bestN && n > 0 && best && best.contains(e))) { best = e; bestN = n; }
      }
      /* 날짜가 든 목록이 없으면(계명 3차: 날짜 칸 없는 목록) 제목 칸이 있는 표 → 링크가 가장 많은 목록 순으로 고른다 */
      if (!best) {
        best = els.find((e) => e.tagName.toLowerCase() === 'table' && /제목/.test((e.querySelector('caption, thead, th') || {}).textContent || ''))
          || els.filter((e) => /^(table|ul|ol|tbody)$/i.test(e.tagName)).sort((a, b) => b.querySelectorAll('a').length - a.querySelectorAll('a').length)[0] || null;
        if (!best || best.querySelectorAll('a').length < 3) return '';
      }
      const c = best.cloneNode(true);
      c.querySelectorAll('script, style, noscript').forEach((x) => x.remove());
      return `(날짜 ${bestN}개 · 링크 ${best.querySelectorAll('a').length}개 든 <${best.tagName.toLowerCase()}${best.className ? ` class="${String(best.className).slice(0, 60)}"` : ''}>) ` + c.outerHTML.replace(/\s+/g, ' ').slice(0, 2400);
    }), 15000, '');
    if (frag) out.push(`- 목록 요소의 HTML (누르기 전 · 앞 2400자): \`${frag.replace(/`/g, "'")}\``);
    /* ④ 날짜 줄 (2026-10-01 · 교내 소식 클릭형 게시판) — 글 줄(날짜가 든 줄)에서 제목 링크가 **무엇으로** 상세를 여는지(href · onclick · data-*)
       그대로 받아 적고, 첫 줄을 실제로 눌러 **어디로 가는지**(최종 주소·제목)를 적는다. 링크가 없는 줄(서강 <tr class="cursor-pointer">)은 줄 자체를 누른다.
       수집 로봇의 규칙(news-board-rules.mjs)은 여기 적힌 것만으로 쓴다 — 주소를 유추하지 않는다(동국대 선례). */
    const rows = await within(page.evaluate(() => {
      const DATE = /(20\d{2})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})(?!\d)|(?<!\d)\d{2}\.\d{2}\.\d{2}(?!\d)/;
      const cands = [...document.querySelectorAll('tr, li, dd, article, div')].filter((el) => {
        if (el.closest('header, nav, footer, #footer, .footer')) return false;
        const text = (el.innerText || '').replace(/\s+/g, ' ').trim();
        return text && text.length <= 400 && DATE.test(text);
      });
      const set = new Set(cands);
      /* 가장 안쪽 줄만 — 날짜 든 다른 후보(div 포함)를 품은 것은 뺀다 (리뷰 2026-10-02: div 를 빼고 보면 한 글의 제목과 다른 글의 날짜가 짝지어졌다) */
      const inner = cands.filter((el) => ![...el.querySelectorAll('*')].some((d) => set.has(d)));
      const out = []; const seen = new Set();
      for (const el of inner) {
        if (out.length >= 6) break;
        const text = (el.innerText || '').replace(/\s+/g, ' ').trim();
        const a = [...el.querySelectorAll('a')].sort((x, y) => (y.textContent || '').trim().length - (x.textContent || '').trim().length)[0];
        const title = ((a ? a.textContent : text.replace(DATE, ' ')) || '').replace(/\s+/g, ' ').trim().slice(0, 60);
        if (title.length < 6 || seen.has(title)) continue;
        seen.add(title);
        const fmt = (node) => [...node.attributes].filter((x) => /^(href|onclick|data-[\w-]+|class|id)$/i.test(x.name)).map((x) => `${x.name}="${String(x.value).slice(0, 160)}"`).join(' ');
        el.setAttribute('data-probe-row', String(out.length));
        out.push({ title, attrs: a ? fmt(a) : '', rowTag: el.tagName.toLowerCase(), rowAttrs: fmt(el).replace(/\s*data-probe-row="\d+"/, ''), date: (text.match(DATE) || [''])[0], hasLink: !!a });
      }
      return out;
    }), 15000, []);
    if (rows.length) {
      out.push(`- 날짜 줄 ${rows.length}개 (상세를 여는 방식):`);
      rows.forEach((r) => out.push(`    · 「${r.title}」 ${r.date} → ${r.hasLink ? `<a ${r.attrs}>` : '(링크 없음)'} · 줄: <${r.rowTag} ${r.rowAttrs}>`));
      /* 첫 줄을 실제로 눌러 본다 — 새 탭으로 열리면 그 탭, 아니면 같은 탭의 최종 주소 */
      try {
        const before = page.url();
        const popup = page.waitForEvent('popup', { timeout: 6000 }).catch(() => null);
        /* 폼 전송·같은 탭 이동(전북 pf_DetailMove 꼴)은 evaluate 가 "Execution context was destroyed" 로 거절된다 —
           그건 실패가 아니라 **이동이 일어난 것**이므로 이동 대기와 함께 걸고 거절은 삼킨다 (리뷰 2026-10-01). */
        const nav = page.waitForNavigation({ timeout: 8000, waitUntil: 'domcontentloaded' }).catch(() => null);
        await within(page.evaluate(() => { const row = document.querySelector('[data-probe-row="0"]'); if (!row) return; const a = [...row.querySelectorAll('a')].sort((x, y) => (y.textContent || '').trim().length - (x.textContent || '').trim().length)[0]; (a || row).click(); }), 8000, null);
        const pop = await popup;
        const navd = pop ? null : await nav;
        const target = pop || page;
        await target.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
        await target.waitForTimeout(2000);
        const landed = await within(target.evaluate(() => ({ title: document.title || '', h: ((document.querySelector('h1,h2,h3,.title,.subject,.view-title') || {}).textContent || '').replace(/\s+/g, ' ').trim().slice(0, 90), text: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 200) })), 8000, { title: '', h: '', text: '' });
        const url = target.url();
        /* 주소가 그대로면 둘 중 하나다 — 같은 주소로 다시 열렸거나(POST 이동) 스크립트가 같은 화면에 그렸거나/아무 일도 없었다 (단정하지 않는다 · 리뷰 2026-10-02) */
        const verdict = url !== before ? url : (navd ? '(주소 그대로 — 같은 주소로 다시 열림 · POST 이동일 수 있음)' : '(주소 그대로 — 이동 없음 · 스크립트가 같은 화면에 그렸거나 아무 일도 없었음)');
        out.push(`- 첫 줄 「${rows[0].title.slice(0, 30)}」 을 ${rows[0].hasLink ? '링크로' : '줄째'} 눌렀더니 → ${verdict}${pop ? ' (새 탭)' : ''}`);
        out.push(`    · 그 화면 제목: ${landed.title.trim().slice(0, 80)} · 큰 제목: ${landed.h} · 글자: ${landed.text.slice(0, 160)}`);
        if (pop) await pop.close().catch(() => {});
      } catch (e) {
        out.push(`- 첫 줄 누르기 실패: ${(e.message || '').split('\n')[0].slice(0, 90)}`);
      }
    } else {
      out.push('- 날짜 줄: 없음 (머리·메뉴·바닥 밖에 날짜가 든 줄이 없거나 목록이 안 그려짐)');
    }
    /* 화면이 적어 둔 '목록' 링크 (2026-10-02 · 경북: 검색에 잡힌 상세 주소만 있어 그 화면의 목록 버튼이 목록 주소의 유일한 근거다) */
    const listLinks = await within(page.evaluate(() => [...document.querySelectorAll('a, button')]
      .filter((a) => /^(목록|목록보기|목록으로|리스트|list)$/i.test((a.textContent || '').replace(/\s+/g, '').trim()))
      .slice(0, 4).map((a) => [...a.attributes].filter((x) => /^(href|onclick|data-[\w-]+)$/i.test(x.name)).map((x) => `${x.name}="${String(x.value).slice(0, 200)}"`).join(' '))), 8000, []);
    if (listLinks.length) out.push(`- 화면의 '목록' 링크: ${listLinks.map((l) => `<a ${l}>`).join(' · ')}`);
    if (reqs.length) { out.push(`- 화면이 부른 요청 ${reqs.length}개 (목록 API·폼 전송 후보):`); reqs.forEach((l) => out.push(`    · ${l}`)); }
    if (resps.length) { out.push(`- 스크립트 요청의 응답 ${resps.length}개 (규칙의 재료 — 칸 이름·HTML/JSON):`); resps.forEach((l) => out.push(`    · ${l.replace(/`/g, "'")}`)); }
    out.push('');
  } catch (e) {
    out.push(`### 🔗 ${url}`);
    out.push(`- ❌ 열기 실패: ${(e.message || '').split('\n')[0].slice(0, 90)}`);
    out.push('');
  } finally { await page.close().catch(() => {}); await ctx?.close().catch(() => {}); }
}

/* ── ② 학교 홈에서 메뉴를 따라 들어가 '학생이 보는 게시판'을 찾는다 ── */
async function findBoard(spec, out) {
  const [home, path] = spec.split('|').map((x) => x.trim());
  const steps = (path || '').split('>').map((x) => x.trim()).filter(Boolean);
  out.push(`### 🧭 ${home} → ${steps.join(' > ')}`);
  const { page, ctx } = await freshPage();
  try {
    await page.goto(home, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2500);
    for (const step of steps) {
      // 메뉴 글자가 정확히 일치하는 링크를 우선 누른다 (부분일치는 엉뚱한 데로 간다)
      const moved = await within(page.evaluate((label) => {
        const all = [...document.querySelectorAll('a, button, [onclick]')];
        const exact = all.find((e) => (e.textContent || '').trim() === label);
        const partial = all.find((e) => (e.textContent || '').trim().includes(label));
        const el = exact || partial;
        if (!el) return null;
        const href = el.getAttribute('href') || '';
        if (href && !href.startsWith('javascript') && !href.startsWith('#')) return el.href;
        el.click();
        return 'clicked';
      }, step).catch(() => 'clicked'), 8000, '__timeout__');   // 눌러서 화면이 바뀌면 evaluate 가 거절된다 — 그건 이동이 일어난 것(아래 줄이 실제 주소를 적는다)
      /* 시한에 걸린 것은 '못 찾음'이 아니다 (리뷰 12차) — 화면이 바빠 답을 못 받은 것이고, 뒤늦게 눌려 화면이 바뀔 수 있어 여기서 멈춘다 */
      if (moved === '__timeout__') { out.push(`- ⏳ '${step}' 메뉴 찾기가 8초 안에 끝나지 않음(화면이 바쁨) — 못 찾은 것과 다름 · 여기서 멈춤 (현재: ${page.url()})`); break; }
      if (!moved) { out.push(`- ⚠️ '${step}' 메뉴를 못 찾음 — 여기서 멈춤 (현재: ${page.url()})`); break; }
      if (moved !== 'clicked') await page.goto(moved, { waitUntil: 'domcontentloaded', timeout: 25000 }).catch(() => {});
      await page.waitForTimeout(3000);
      out.push(`- '${step}' 이동 → ${page.url()}`);
    }
    /* 🔴 눌러 들어간 **그 화면의 글자**를 그대로 찍는다 (2026-08-29).
       이 도구의 목적이 '학생 눈에 어떻게 보이는가'인데 여태 링크만 세고 있었다.
       KOSAF 상세처럼 **클릭으로만 닿는 화면**은 checkUrl(GET)로는 영영 못 본다. */
    const seen = await within(page.evaluate(() => ({
      title: document.title || '',
      text: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 1600),
      labels: [...document.querySelectorAll('th, dt, .tit, .label, caption')]
        .map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim())
        .filter((t) => t && t.length <= 24).slice(0, 40),
    })), 8000, { title: '', text: '', labels: [] });
    out.push(`- 화면 제목: ${seen.title.slice(0, 90)}`);
    if (seen.labels.length) out.push(`- **이 화면의 항목 이름들**: ${seen.labels.join(' · ')}`);
    out.push(`- 화면 글자: ${seen.text.slice(0, 900)}`);

    const listUrl = page.url();
    // 이 화면의 공고 링크들을 보고한다 — 진짜 게시판이면 상세 주소가 보인다
    const rows = await within(page.$$eval('a[href], [onclick]', (els) => els.map((e) => ({
      t: (e.textContent || '').replace(/\s+/g, ' ').trim(),
      abs: e.tagName === 'A' ? (e.href || '') : '',
      src: (e.getAttribute('onclick') || '') + '|' + (e.getAttribute('href') || ''),
    })).filter((x) => x.t.length >= 8 && x.t.length <= 140)), 8000, []);
    const scholar = rows.filter((r) => /장학|학자금/.test(r.t));
    out.push(`- 이 화면의 장학 관련 줄: ${scholar.length}개`);
    scholar.slice(0, 8).forEach((r) => out.push(`    · ${r.t.slice(0, 56)}  →  ${(r.abs || r.src).slice(0, 110)}`));
    const detail = scholar.filter((r) => isDetailUrl(r.abs, listUrl));
    out.push(`- 그중 **공고 원문으로 바로 가는 주소**: ${detail.length}개`);
    detail.slice(0, 5).forEach((r) => out.push(`    ✅ ${r.t.slice(0, 46)} → ${r.abs}`));
    if (detail.length) {
      out.push('- 이 주소들이 로그인 없이 열리는지 바로 확인합니다:');
      for (const d of detail.slice(0, 2)) { await checkUrl(d.abs, out); }
    }
    out.push('');
  } catch (e) {
    out.push(`- ❌ 실패: ${(e.message || '').split('\n')[0].slice(0, 90)}`);
    out.push('');
  } finally { await page.close().catch(() => {}); await ctx?.close().catch(() => {}); }
}

// 같은 학교를 몰아치지 않는다 — 사이를 두고 하나씩 연다
/* 전체 예산 — 작업 시한(probe-links.yml 15분)에서 브라우저 설치·뒷정리 몫을 뺀 11분. 넘으면 남은 주소는 '못 봄'으로 적고 끝낸다(시한을 늘려 때우지 않는다). */
const PROBE_BUDGET_MS = 11 * 60000;
const probeStart = Date.now();
for (const u of lines('checkUrl')) {
  if (Date.now() - probeStart > PROBE_BUDGET_MS - URL_HARD_MS) { report.push(`### 🔗 ${u}`, `- ⏰ 정찰 예산(${PROBE_BUDGET_MS / 60000}분)이 모자라 이번엔 못 봄 — 다시 보려면 그 줄을 지웠다 다시 넣어 push 하거나 Actions 에서 수동 실행`, ''); flushReport(); continue; }
  console.log(`▶ ${u}`);
  const before = report.length;
  const buf = [];
  const done = await within(checkUrl(u, buf).then(() => true), URL_HARD_MS, false);
  const got = buf.splice(0);   // 지금까지 적힌 것만 옮긴다 — 끊긴 측정이 뒤늦게 쓰는 줄은 이 그릇에 남아 버려진다
  report.push(...got);
  if (!done) {
    report.push(...(got.length ? [] : [`### 🔗 ${u}`]), `- ⛔ ${URL_HARD_MS / 1000}초 안에 끝나지 않아 건너뜀 (화면·측정이 멈춤) — 여기까지 적힌 것만 남긴다`, '');
    try { if (sharedCtx) await within(sharedCtx.close(), 5000, null); } catch { /* 닫기 실패 */ }
    sharedCtx = null;   // 멈춘 화면을 버리고 다음 주소는 새 브라우저 칸에서
  }
  console.log(report.slice(before).join('\n'));
  flushReport();
  await new Promise((r) => setTimeout(r, 2500));
}
for (const s of lines('findBoard')) {
  if (Date.now() - probeStart > PROBE_BUDGET_MS - URL_HARD_MS) { report.push(`### 🧭 ${s}`, '- ⏰ 정찰 예산이 모자라 이번엔 못 봄 — 다시 보려면 그 줄을 지웠다 다시 넣어 push 하거나 Actions 에서 수동 실행', ''); continue; }
  const buf = [];
  const done = await within(findBoard(s, buf).then(() => true), URL_HARD_MS, false);
  const got = buf.splice(0);   // checkUrl 과 같다 — 끊긴 뒤의 줄은 버려진 그릇에만 쌓인다
  report.push(...got);
  if (!done) {
    report.push(...(got.length ? [] : [`### 🧭 ${s}`]), `- ⛔ ${URL_HARD_MS / 1000}초 안에 끝나지 않아 건너뜀 — 여기까지 적힌 것만 남긴다`, '');
    try { if (sharedCtx) await within(sharedCtx.close(), 5000, null); } catch { /* 닫기 실패 */ }
    sharedCtx = null;
  }
  flushReport();
}

await browser.close();
if (!lines('checkUrl').length && !lines('findBoard').length) {
  report.push(only ? '_(이번 push 에 새 checkUrl / findBoard 줄이 없어 할 일이 없었습니다)_' : '_(run-probe.txt에 checkUrl / findBoard 줄이 없어 할 일이 없었습니다)_');
}
fs.writeFileSync(new URL('probe-report.md', HERE), report.join('\n'));
console.log(report.join('\n'));

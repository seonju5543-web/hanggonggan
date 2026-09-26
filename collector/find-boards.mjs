/* ============================================================
   재단·지자체 장학 게시판 찾기 로봇 (2026-09-26 · 노션 F-13)
   개발자 지시: "교외 공고 또한 늘릴 방안이 있다면 해당 방안 또한 추진해."

   무엇을 하나 — collector/external-sources.json 에서 boardUrl 이 비어 있는 곳(재단 홈페이지만 아는 곳)을
   골라 홈페이지를 열고, 메뉴 가운데 '공지·소식·장학·모집' 같은 글자의 링크를 최대 6개 따라가 본다.
   그 페이지에 **장학 공고처럼 보이는 글**(장학 낱말 + 연도·날짜·모집 표시)이 3건 이상이면 그곳을
   장학 게시판으로 적는다(autoFound · 증거 제목과 함께). 다음 07:41 수집부터 collect.mjs 가 읽는다.
   못 찾으면 probe 에 날짜를 적고 14일 뒤 다시 본다. 사람이 boardUrl 을 직접 적으면 로봇은 건드리지 않는다.

   왜 이렇게 — 출처 64곳은 한국장학재단 공개 데이터(kosaf-open.json)의 재단 홈페이지다. 홈페이지는
   알지만 게시판 주소는 모른다. 사람이 64곳을 눌러 보는 대신 로봇이 찾고, **찾은 근거를 리포트에**
   남겨 사람이 되돌릴 수 있게 한다(선조치후보고 · 운영 원칙 3). 잘못 찾은 곳은 parked 로 옮기면 된다.

   🔴 안전장치 — 같은 호스트(또는 그 하위)만 따라간다 · 한 곳에 최대 7번 요청 · 실행 전체 시간 예산 ·
      한 실행에 최대 FIND_BOARDS_MAX 곳 · 판정 규칙은 scoreBoardPage/pickMenuLinks 두 순수 함수
      (관문 「재단·지자체 게시판」이 잰다). 링크를 읽는 눈은 board-links.mjs (collect.mjs 와 같은 것).
   실행: node collector/find-boards.mjs   (FIND_BOARDS_MAX=8 FIND_BOARDS_MS=150000)
   ============================================================ */
import fs from 'node:fs';
import { FETCH_HEADERS } from './http-headers.mjs';
import { extractLinks } from './board-links.mjs';
import { isMenuEntry } from './clean-title.mjs';
import { isAttachmentEntry } from './attachment-link.mjs';

const HERE = new URL('.', import.meta.url);
const SRC = new URL('external-sources.json', HERE);
const REPORT = new URL('find-boards-report.md', HERE);
const MAX = Number(process.env.FIND_BOARDS_MAX || 8);
const BUDGET_MS = Number(process.env.FIND_BOARDS_MS || 150000);
const RETRY_DAYS = 14;
const MIN_SIGNALS = 3;

/* 장학 공고처럼 보이는 글 — collect.mjs 의 KEYWORDS 와 같은 낱말에 '공고 신호'(연도·날짜·모집…)를 더한다.
   낱말만 보면 '장학금 안내' 같은 옆 메뉴가 글로 센다(clean-title 의 NOTICE_SIGNAL 과 같은 이유). */
const SCHOLAR = /장학|학자금|등록금 감면|학업장려|근로장학/;
const SIGNAL = /20\d{2}|\d{1,2}[./]\d{1,2}|~|제\d+회|\d+기|모집|선발|공고|신청|접수/;
export function isNoticeLike(link) {
  const t = (link && link.title) || '';
  return SCHOLAR.test(t) && SIGNAL.test(t) && !isMenuEntry(t) && !isAttachmentEntry(link);
}

/* 페이지 하나가 '장학 게시판'인가 — 공고처럼 보이는 글 수와 그 제목 표본 */
export function scoreBoardPage(links) {
  const hits = (links || []).filter(isNoticeLike);
  return { signals: hits.length, sample: hits.slice(0, 3).map((l) => l.title) };
}

/* 홈페이지 메뉴 가운데 게시판일 법한 링크 — 같은 호스트(하위 포함)만, 파일·외부·SNS 제외 */
const MENU = /공지|알림|소식|뉴스|장학|모집|공고|게시판|안내|사업|notice|news|board|bbs|scholar/i;
const NOT_MENU = /로그인|회원|사이트맵|개인정보|이용약관|오시는|인사말|조직도|연혁|기부|후원|donation|facebook|instagram|youtube|blog\.naver|kakao|\.(pdf|hwp|hwpx|jpg|png|zip)(\?|$)/i;
export function pickMenuLinks(links, home, max = 6) {
  let h; try { h = new URL(home).hostname.replace(/^www\./, ''); } catch { return []; }
  const same = (u) => { try { const x = new URL(u).hostname.replace(/^www\./, ''); return x === h || x.endsWith('.' + h); } catch { return false; } };
  const seen = new Set();
  const out = [];
  for (const l of links || []) {
    if (!same(l.url) || !MENU.test(l.title + ' ' + l.url) || NOT_MENU.test(l.title + ' ' + l.url)) continue;
    const key = l.url.replace(/[?#].*$/, '');
    if (seen.has(key)) continue;
    seen.add(key);
    /* 장학 낱말이 있는 메뉴를 앞에 — 재단은 대개 '장학사업 > 공지' 처럼 제 이름을 단다 */
    out.push({ ...l, rank: (/장학|scholar/i.test(l.title + l.url) ? 0 : 1) + (/공지|notice|소식|news|board|bbs/i.test(l.title + l.url) ? 0 : 0.5) });
  }
  return out.sort((a, b) => a.rank - b.rank).slice(0, max);
}

async function get(url, ms = 15000) {
  const res = await fetch(url, { redirect: 'follow', headers: FETCH_HEADERS, signal: AbortSignal.timeout(ms) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return { html: await res.text(), url: res.url || url };
}

const today = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
const daysAgo = (d) => (d ? Math.floor((Date.now() - new Date(d).getTime()) / 86400000) : Infinity);

async function main() {
  const cfg = JSON.parse(fs.readFileSync(SRC, 'utf8'));
  const due = (cfg.sources || []).filter((s) => !s.boardUrl && s.home && daysAgo(s.probe && s.probe.checkedAt) >= RETRY_DAYS);
  const todo = due.slice(0, MAX);
  const start = Date.now();
  const lines = [`## 🔎 재단·지자체 장학 게시판 찾기 (${today})`, '', `대상 ${due.length}곳 중 이번에 ${todo.length}곳 · 게시판 아는 곳 ${(cfg.sources || []).filter((s) => s.boardUrl).length}곳 / 전체 ${(cfg.sources || []).length}곳`, ''];
  let found = 0;
  for (const s of todo) {
    if (Date.now() - start > BUDGET_MS) { lines.push(`⏱ 시간 예산(${Math.round(BUDGET_MS / 1000)}초)이 다 되어 나머지는 다음 실행에`); break; }
    let best = null; let why = '';
    try {
      const home = await get(s.home);
      const homeLinks = extractLinks(home.html, home.url);
      const cands = [{ title: '(홈)', url: home.url, links: homeLinks }];
      for (const m of pickMenuLinks(homeLinks, s.home)) {
        if (Date.now() - start > BUDGET_MS) break;
        try { const pg = await get(m.url); cands.push({ title: m.title, url: pg.url, links: extractLinks(pg.html, pg.url) }); }
        catch (e) { /* 메뉴 하나가 안 열리는 것은 흔하다 — 다음 후보로 */ }
      }
      for (const c of cands) {
        const sc = scoreBoardPage(c.links);
        if (!best || sc.signals > best.signals) best = { url: c.url, menu: c.title, ...sc };
      }
      why = best ? `최고 ${best.signals}건 (${best.menu})` : '후보 없음';
    } catch (e) {
      why = `홈페이지 못 엶 (${e.message || e.name})`;
    }
    if (best && best.signals >= MIN_SIGNALS) {
      s.boardUrl = best.url;
      s.autoFound = { date: today, signals: best.signals, menu: best.menu, sample: best.sample };
      delete s.probe;
      found += 1;
      lines.push(`- ✅ **${s.host}** — ${best.url} (${best.menu} · 공고 ${best.signals}건 · 예: ${best.sample.join(' / ')})`);
    } else {
      s.probe = { checkedAt: today, why, best: best ? { url: best.url, signals: best.signals } : null };
      lines.push(`- 🟡 ${s.host} — ${why} (${RETRY_DAYS}일 뒤 다시)`);
    }
  }
  lines.push('', found ? `새로 찾은 게시판 ${found}곳 — 다음 수집(07:41)부터 읽습니다. 잘못 찾았으면 \`collector/external-sources.json\` 에서 그 항목을 \`parked\` 로 옮겨 주세요.` : '이번에는 새로 찾은 게시판이 없습니다.', '');
  fs.writeFileSync(SRC, JSON.stringify(cfg, null, 1));
  fs.writeFileSync(REPORT, lines.join('\n'));
  console.log(`find-boards: ${todo.length} checked, ${found} found`);
}

/* 관문이 순수 함수만 가져다 쓸 수 있게 — 직접 실행할 때만 돈다 */
if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main().catch((e) => { console.error(e); process.exit(1); });
}

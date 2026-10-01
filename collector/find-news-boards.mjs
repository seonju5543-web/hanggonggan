/* ============================================================
   교내 소식 게시판 찾기 로봇 (2026-09-30 · 개발자 지시 "등록된 학교들의 홈페이지에 접속 후 페이지들을
   브라우즈하면 찾을 수 있을 것 · 직접 방법을 찾아 출처를 확보하고, 확보가 안 되는 학교만 개발자에게 요청")

   무엇을 하나 — collector/news-sources.json 에서 boardUrl 이 비어 있는 학교를 골라
     ① 웹 검색으로 적어 둔 후보(candidates)를 차례로 열어 본다. 학교 도메인 안의 글 링크가 MIN_ROWS 건 이상이면
        그 후보를 boardUrl 로 올린다(autoFound 에 날짜·행 수·표본 제목 · 근거는 후보의 evidence 그대로).
     ② 후보가 다 실패하면 학교 홈페이지를 열어 메뉴 가운데 '공지·소식·학사' 글자의 링크를 최대 6개 따라가 본다.
     ③ 그래도 없으면 probe 에 날짜·시도한 주소를 적고 RETRY_DAYS 뒤 다시 본다. 리포트에 **개발자에게 요청할 학교**로 적는다.
   사람이 boardUrl 을 직접 적으면 로봇은 건드리지 않는다.

   왜 이렇게 — 세션 샌드박스는 학교 사이트 접속이 막혀 있어(네트워크 정책) 주소를 열어 볼 수 없다. 검색으로 후보를 모으고,
   실제로 열어 확인하는 일은 GitHub Actions 의 이 로봇이 한다(find-boards.mjs 가 재단 게시판을 찾는 것과 같은 길).
   🔴 안전장치 — 같은 사이트(siteKey)만 따라간다 · 한 학교에 최대 후보 + 메뉴 6 요청 · 학교마다 절대 시한 · 실행 전체 예산 ·
      판정은 scoreNewsPage/pickNewsMenuLinks 두 순수 함수(관문 「교내 소식」이 잰다) · 링크 읽는 눈은 board-links.mjs (수집기와 같은 것).
   실행: node collector/find-news-boards.mjs   (FIND_NEWS_MAX=50 FIND_NEWS_MS=360000)
   ============================================================ */
import fs from 'node:fs';
import { extractLinks, sameSite } from './board-links.mjs';
import { NEWS_BOARD_RULES, datedRowsFor, verifyRuleDetail, needsDetailCheck } from './news-board-rules.mjs';   // 클릭형 게시판 규칙 한 곳 (수집 로봇과 같은 것)
import { isAttachmentEntry } from './attachment-link.mjs';
import { isNewsRow } from './news-kind.mjs';
import { fetchBoard, netReason } from './fetch-board.mjs';
import { makeBudget, withDeadline, TIMED_OUT } from './harvest-budget.mjs';

const HERE = new URL('.', import.meta.url);
const SRC = new URL('news-sources.json', HERE);
const REPORT = new URL('find-news-boards-report.md', HERE);
const MAX = Number(process.env.FIND_NEWS_MAX || 50);
const BUDGET_MS = Number(process.env.FIND_NEWS_MS || 360000);
const PER_SCHOOL_MS = Number(process.env.FIND_NEWS_SCHOOL_MS || 75000);
const RETRY_DAYS = Number(process.env.FIND_NEWS_RETRY_DAYS || 3);   // 후보는 싸고 게시판은 바뀐다 — 사흘마다 다시 본다 (14 → 3 · 2026-10-01)
export const MIN_ROWS = 5;

/* 공지 글처럼 보이는 행 — 학교 사이트 안의 링크이고, 수집기와 **같은 눈**(news-kind.mjs isNewsRow · 옆 메뉴·파일·잡음 제외)으로 글이다.
   ⚠️ 장학·활동 낱말은 여기서 빼지 않는다 — '게시판인가'를 재는 자리라 글이면 다 센다(무엇을 실을지는 수집기가 가른다). */
export function isNewsLike(link, boardUrl) {
  if (boardUrl && !sameSite(link.url, boardUrl)) return false;
  return isNewsRow(link, { isAttachmentEntry });
}

/* 페이지 하나가 '공지 게시판'인가 — **날짜가 붙은 글 줄**(extractDatedRows) 가운데 글처럼 보이는 것의 수와 표본.
   🔴 페이지의 링크 전부로 세면 사이트 메뉴 수십 개가 '글'로 세어져 아무 페이지나 게시판이 된다(첫 실행 42/44 '찾음' 사고 · 2026-10-01). */
export function scoreNewsPage(rows, boardUrl) {
  const hits = (rows || []).filter((l) => l.postedAt && isNewsLike(l, boardUrl));
  return { rows: hits.length, sample: hits.slice(0, 3).map((l) => l.title) };
}

/* 홈페이지 메뉴 가운데 공지 게시판일 법한 링크 — 같은 사이트만, 파일·외부·SNS·장학(다른 로봇 몫)·입찰 제외 */
const MENU = /공지|알림|소식|뉴스|학사|notice|news|board|bbs/i;
const NOT_MENU = /로그인|회원|사이트맵|개인정보|이용약관|오시는|인사말|조직도|연혁|기부|후원|donation|facebook|instagram|youtube|blog\.naver|kakao|입찰|장학|scholar|채용|대학원|graduate|입학|admission|\.(pdf|hwp|hwpx|jpg|png|zip)(\?|$)/i;
export function pickNewsMenuLinks(links, home, max = 6) {
  if (!sameSite(home, home)) return [];
  const seen = new Set();
  const out = [];
  for (const l of links || []) {
    /* 같은 **호스트**만 — 하위 도메인(job.·fund.·coss.)으로 건너가면 취업·발전기금·사업단 게시판을 학교 공지로 올린다(4차 실행 실측 · 부산·전북·충북) */
    let sameHost = false; try { sameHost = new URL(l.url).hostname === new URL(home).hostname; } catch { /* 깨진 주소 */ }
    if (!sameHost || !MENU.test(l.title + ' ' + l.url) || NOT_MENU.test(l.title + ' ' + l.url)) continue;
    const key = l.url.replace(/[?#].*$/, '');
    if (seen.has(key)) continue;
    seen.add(key);
    /* '공지사항'·'학사공지' 글자가 제목에 있는 메뉴를 앞에 — 대개 그것이 학생 공지다 */
    out.push({ ...l, rank: (/공지사항|학사\s*공지|일반\s*공지|전체\s*공지/.test(l.title) ? 0 : 1) + (/notice|공지/i.test(l.url) ? 0 : 0.5) });
  }
  return out.sort((a, b) => a.rank - b.rank).slice(0, max);
}

/* 받기 — 못 받으면 **이유 글자**를 돌려준다(HTTP 403 · ENOTFOUND …). 'Error' 한 낱말로 뭉개면 주소가 틀린 건지 학교가 막은 건지 모른다. */
/* 열리는데 글 줄이 없는 페이지의 생김새 — 링크·줄 블록·날짜 토큰 수와, 날짜가 든 블록 표본. 리포트에 적어 사람이 규칙을 정한다. */
export function pageDiag(html) {
  const text = (s) => String(s).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const dates = (String(html).match(/20\d{2}\s*[.\-/년]\s*\d{1,2}\s*[.\-/월]\s*\d{1,2}/g) || []).length;
  const blocks = [...String(html).matchAll(/<(tr|li|dd|article)\b[^>]*>((?:(?!<\1\b)[\s\S])*?)<\/\1>/gi)];
  const dated = blocks.filter((b) => /20\d{2}\s*[.\-/년]\s*\d{1,2}\s*[.\-/월]\s*\d{1,2}/.test(b[2]));
  const links = (String(html).match(/<a\b[^>]*href=/gi) || []).length;
  /* 날짜 바로 앞 토막의 <a> 태그 둘 — href 가 javascript: 인지, onclick 으로 여는지 보려고 (규칙 json·onclick·dataId 를 정하는 재료) */
  const dm = /20\d{2}\s*[.\-/년]\s*\d{1,2}\s*[.\-/월]\s*\d{1,2}/g; let dmm; const anchors = [];
  while ((dmm = dm.exec(String(html))) !== null && anchors.length < 2) {
    const seg = String(html).slice(Math.max(0, dmm.index - 600), dmm.index);
    const a = [...seg.matchAll(/<a\b[^>]*>/gi)].pop();
    if (a) anchors.push(a[0].replace(/\s+/g, ' ').slice(0, 160));
  }
  const scripts = (String(html).match(/<script\b/gi) || []).length;
  return { bytes: String(html).length, links, scripts, dates, blocks: blocks.length, datedBlocks: dated.length,
    sample: dated.slice(0, 2).map((b) => `<${b[1]}> ${text(b[2]).slice(0, 120)}`), anchors };
}

async function get(url, ms = 15000) {
  const res = await fetchBoard(url, { firstMs: ms, retryMs: ms, tries: 2 });
  if (!res.ok) return { error: `HTTP ${res.status}` };
  return { html: await res.text(), url: res.url || url };
}

const today = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
const daysAgo = (d) => (d ? Math.floor((Date.now() - new Date(d).getTime()) / 86400000) : Infinity);

/* 학교 하나 — 후보부터, 그다음 홈 메뉴. 결과는 {found, tried[]} */
async function findOne(s) {
  const tried = [];
  const tryUrl = async (url, label, via, evidence) => {
    try {
      const page = await get(url);
      if (page.error) { tried.push({ url, label, rows: 0, status: page.error }); return null; }
      const rows = datedRowsFor(s.school, page.html, page.url);   // 클릭형(동국·서울교대·전북…)은 규칙의 링크 풀이를 얹은 같은 눈
      const score = scoreNewsPage(rows, page.url);
      const t = { url, label, rows: score.rows, status: 'ok' };
      if (score.rows < MIN_ROWS) t.diag = pageDiag(page.html);   // 왜 0행인가 — 다음 수리의 재료 (짐작하지 않는다)
      /* 🔴 규칙 학교는 첫 글의 상세를 실제로 열어 제목이 있는지 본 뒤에만 '찾음' — 규칙이 이 게시판에 안 맞으면 못 찾은 것이다 */
      if (score.rows >= MIN_ROWS && needsDetailCheck(NEWS_BOARD_RULES[s.school])) {
        const first = rows.find((r) => sameSite(r.url, page.url)) || rows[0];
        const v = await verifyRuleDetail(first, { boardUrl: page.url, others: rows.map((r) => r.title) });
        if (!v.ok) { t.status = `규칙 상세 확인 실패 — ${v.reason}`; tried.push(t); return null; }
        evidence = `${evidence} · ${v.reason}`;
      }
      tried.push(t);
      if (score.rows >= MIN_ROWS) return { url: page.url, label, via, evidence, rows: score.rows, sample: score.sample };
    } catch (e) {
      tried.push({ url, label, rows: 0, status: netReason(e) });
    }
    return null;
  };
  for (const c of s.candidates || []) {
    const hit = await tryUrl(c.url, c.label, 'candidate', c.evidence);
    if (hit) return { found: hit, tried };
  }
  if (s.home) {
    try {
      const home = await get(s.home);
      if (home.error) throw new Error(home.error);
      const menu = pickNewsMenuLinks(extractLinks(home.html, home.url), home.url);
      for (const m of menu) {
        const hit = await tryUrl(m.url, m.title, 'home-menu', `홈페이지 메뉴 「${m.title}」 을 따라 들어가 확인 (${today})`);
        if (hit) return { found: hit, tried };
      }
    } catch (e) {
      tried.push({ url: s.home, label: '홈', rows: 0, status: netReason(e) });
    }
  }
  return { found: null, tried };
}

async function main() {
  const cfg = JSON.parse(fs.readFileSync(SRC, 'utf8'));
  const due = (cfg.sources || []).filter((s) => !s.boardUrl && ((s.candidates || []).length || s.home) && daysAgo(s.probe && s.probe.checkedAt) >= RETRY_DAYS);
  const todo = due.slice(0, MAX);
  const budget = makeBudget(BUDGET_MS);
  const found = []; const missed = []; const skipped = [];
  for (const s of todo) {
    if (!budget.hasRoom(PER_SCHOOL_MS / 3)) { skipped.push(s.school); continue; }
    const r = await withDeadline(findOne(s), PER_SCHOOL_MS);
    if (r === TIMED_OUT) {
      s.probe = { checkedAt: today, tried: [{ url: ((s.candidates || [])[0] || {}).url || s.home, status: `⛔ ${Math.round(PER_SCHOOL_MS / 1000)}초 시한 초과` }] };
      missed.push(s); continue;
    }
    if (r.found) {
      s.boardUrl = r.found.url;
      s.autoFound = { date: today, via: r.found.via, label: r.found.label, rows: r.found.rows, sample: r.found.sample, evidence: r.found.evidence };
      delete s.probe;
      found.push(s);
    } else {
      s.probe = { checkedAt: today, tried: r.tried };
      missed.push(s);
    }
  }
  fs.writeFileSync(SRC, JSON.stringify(cfg, null, 1) + '\n');

  const known = (cfg.sources || []).filter((x) => x.boardUrl).length;
  const lines = [`## 🗞 교내 소식 게시판 찾기 (${today}) — 게시판 아는 학교 ${known}/${(cfg.sources || []).length}`, ''];
  if (found.length) {
    lines.push(`### ✅ 이번에 찾은 게시판 ${found.length}곳`);
    for (const s of found) lines.push(`- **${s.school}** → ${s.boardUrl} (${s.autoFound.label} · ${s.autoFound.via === 'candidate' ? '검색 후보' : '홈 메뉴'} · 글 ${s.autoFound.rows}행 · 예: ${s.autoFound.sample.map((t) => `「${t}」`).join(' ')})`);
    lines.push('');
  }
  if (missed.length) {
    lines.push(`### 🙋 개발자에게 출처를 요청할 학교 ${missed.length}곳 — 후보와 홈 메뉴를 다 열어 봤지만 날짜가 붙은 공지 글 줄(${MIN_ROWS}행 이상)을 못 찾았습니다`);
    for (const s of missed) {
      lines.push(`- **${s.school}**`);
      for (const t of (s.probe.tried || []).slice(0, 8)) {
        lines.push(`  - ${t.url} — ${t.status === 'ok' ? `열림 · 글처럼 보이는 행 ${t.rows}` : t.status}`);
        if (t.diag) lines.push(`    - 생김새: ${Math.round(t.diag.bytes / 1024)}KB · 링크 ${t.diag.links} · 스크립트 ${t.diag.scripts} · 날짜 토큰 ${t.diag.dates} · 줄 블록 ${t.diag.blocks}(날짜 든 것 ${t.diag.datedBlocks})${t.diag.sample.length ? ' · 표본: ' + t.diag.sample.map((x) => `「${x}」`).join(' ') : ''}${(t.diag.anchors || []).length ? ' · 날짜 앞 링크: ' + t.diag.anchors.map((x) => '`' + x + '`').join(' ') : ''}`);
      }
    }
    lines.push('', `> 목록이 스크립트로만 그려지는 게시판(SPA·클릭형)은 이 로봇이 못 읽습니다 — 그런 학교는 \`collector/collect-news.mjs\` 의 \`NEWS_BOARD_RULES\` 에 규칙(json·dataId·onclick)이 필요합니다. 학생이 보는 공지 목록 주소를 알려 주시면 그 자리에 적습니다.`, '');
  }
  if (skipped.length) lines.push(`⏰ 예산(${Math.round(BUDGET_MS / 60000)}분)에 걸려 못 본 학교 ${skipped.length}곳: ${skipped.join(' · ')} — 다음 실행이 봅니다`, '');
  if (!todo.length) lines.push('_(찾을 학교가 없습니다 — 모두 boardUrl 이 있거나 14일 안에 이미 본 곳입니다)_', '');
  fs.writeFileSync(REPORT, lines.join('\n'));
  console.log(lines.join('\n'));
}

if (process.argv[1] && /find-news-boards\.mjs$/.test(process.argv[1])) {
  main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
}

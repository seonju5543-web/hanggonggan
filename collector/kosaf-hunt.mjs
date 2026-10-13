/* ============================================================
   층2 재단 글 사냥꾼 — 한국장학재단이 아는 재단 장학금을 **그 재단 홈페이지 안의 개별 공고 글**로 (2026-10-12 개발자 지시)
   ------------------------------------------------------------
   지시: *"KOSAF 원문 링크는 한국장학재단이 아니라 해당 재단의 홈페이지 내에 있는 개별 공고로 이동되어야 해 …
          현재와 앞으로 앱에 올라오는 모든 공고가 개별 공고로 이동할 수 있게."*
   실측(10-12): 마감 전 층2 110건 중 107건이 재단 **홈페이지**로 간다. 재단 76곳 중 게시판을 아는 곳은 19곳뿐이고,
   게시판 찾기 로봇(find-boards.mjs)은 메뉴 한 단계·공고 3건 문턱이라 22곳 중 2곳만 찾았다. 그래서 층2 짝짓기(kosafMatches)가
   재료(재단 피드 글)를 못 받아 멈춰 있었다.

   무엇을 하나 — 마감 전 층2 공고 가운데 아직 개별 글 바로잡기(fix)가 없는 것을 재단(홈페이지 호스트)별로 묶고, 재단마다
     ① 홈페이지를 연다(보통 받기 → 안 되면 진짜 브라우저) ② 메뉴에서 공지·장학·모집 같은 링크를 **두 단계**까지 따라간다(한 곳 10쪽 상한)
     ③ 쪽마다 날짜 붙은 글 줄(board-links.mjs extractDatedRows · 없으면 공고처럼 보이는 링크)을 모아 ④ 그 재단의 층2 공고마다
        **같은 점수 규칙**(link-candidates.mjs pickKosafPost — 사업 이름·재단 이름·마감·학기·공고문 파일 제목)으로 글 하나를 고른다.
   어디에 — 고른 글은 **후보**로만 적는다(collector/kosaf-hunt.json · 사람 후보 파일과 같은 줄 꼴). 🔴 앱에 싣는 것은 원문 링크 확인 로봇
     (link-check.mjs)이 학생처럼 열어 그 공고·그 회차임을 확인한 뒤다(acceptCandidate — 회차·기관·사업 이름·착지 검사). 이 로봇은 주소를
     확정하지도, 데이터 파일을 고치지도 않는다. 글을 못 고르고 게시판처럼 보이는 쪽만 찾으면 `board:` 후보로 적어 확인 로봇이 브라우저로
     목록을 다시 읽어 고른다.
   앞으로 — 글을 찾은 쪽(또는 공고가 3건 이상인 쪽)은 재단 게시판으로 external-sources.json 에 적는다(autoFound · find-boards 와 같은 자리).
     그러면 재단·지자체 수집 로봇이 날마다 그 게시판을 읽고(data/external.json), 층2 짝짓기(kosafMatches)가 새 회차 글을 스스로 짝짓는다.
     층2 공고가 새로 들어오면(월·목 kosaf-fetch) 다음 날 이 로봇이 그 재단을 다시 본다.
   ⑤ 검색 길 (2026-10-13 · 은서 — 사장님 "네이버 검색 API 발급받아서 넣어 줄 수 있음?") — 홈페이지 길로 글을 못 고른 공고(홈페이지를 못 연 재단 포함)만
     네이버 웹문서 검색에 「재단 이름 + 사업 이름 + 공고」를 묻는다. 결과 중 **그 재단 사이트의 글 주소**(hostAllowed · looksLikePost)만 남겨 같은 점수 규칙
     (pickKosafPost)으로 고르고, 후보 줄 source 'search'(검색 결과 제목은 증거로만 — 확인 로봇이 학생처럼 열어 본 뒤에야 앱에 실린다).
     🔴 열쇠(GitHub Secrets NAVER_CLIENT_ID · NAVER_CLIENT_SECRET)가 없으면 이 길은 조용히 꺼진다 — 리포트에 '꺼짐(열쇠 없음)'으로 적는다.
     🔴 한 실행 검색 상한 SEARCH_MAX(기본 60 — 무료 한도 하루 25,000번에 한참 못 미친다) · 검색 사이 틈 · 실패가 연달아 3번이면 그 실행은 검색을 멈춘다.
   🔴 같은 재단은 3일에 한 번(KOSAF_HUNT_RETRY_DAYS) · 한 재단 요청 10번 상한 · 전체 예산(KOSAF_HUNT_MS · 9분) 안에 스스로 끝낸다.
   실행: node collector/kosaf-hunt.mjs [--dry] [--all] [--only=호스트조각] [--no-browser]
   관문: verify/test-collector.mjs 「층2 재단 글 사냥꾼」 (순수 함수 — KOSAF_HUNT_AS_LIB=1 이면 본편을 건너뛴다)
   ============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { FETCH_HEADERS } from './http-headers.mjs';
import { extractLinks, extractDatedRows } from './board-links.mjs';
import { pickMenuLinks, scoreBoardPage, metaRefreshTarget, isNoticeLike } from './find-boards.mjs';
import { netReason } from './fetch-board.mjs';
import { makeBudget, withDeadline, TIMED_OUT } from './harvest-budget.mjs';
import { readIndexData, buildIndex, pickKosafPost, hostAllowed, hostOf, normCandUrl, looksLikePost, candId, loadCandidates } from './link-candidates.mjs';
import { urlKey } from './url-key.mjs';

const require = createRequire(import.meta.url);
const SL = require('../source-link.js');
const HERE = fileURLToPath(new URL('.', import.meta.url));
export const RETRY_DAYS = Number(process.env.KOSAF_HUNT_RETRY_DAYS || 3);
export const MAX_PAGES_PER_HOST = 10;
export const BOARD_MIN_SIGNALS = 3;        // find-boards 와 같은 문턱 — 글을 고른 쪽도 이 문턱을 넘어야 게시판으로 적는다(2026-10-13: 공고 2건뿐인 소식 쪽이 재단 게시판으로 적혀 관문 「자동으로 찾은 게시판에는 증거」가 빨개졌다)
const BUDGET_MS = Number(process.env.KOSAF_HUNT_MS || 9 * 60 * 1000);
const PAGE_MS = 20000;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
export const BY = '로봇(층2 글 사냥꾼)';
export const SEARCH_MAX = Number(process.env.KOSAF_HUNT_SEARCH_MAX || 60);
const SEARCH_URL = 'https://openapi.naver.com/v1/search/webkr.json';
const NOTE = '층2 재단 장학금의 개별 공고 후보 — 로봇(collector/kosaf-hunt.mjs)이 재단 홈페이지를 뒤져 적는다. 사람 후보 파일(link-candidates.json)과 같은 줄 꼴. 원문 링크 확인 로봇이 학생처럼 열어 확인한 것만 앱(data/link-check.json fix)에 실린다. 손으로 고치지 말 것 — 다음 실행이 다시 쓴다.';

/* ── 순수 함수 ──────────────────────────────────────────────────────── */
/** 바로잡기(fix)가 이미 그 회차를 가리키는가 — 앱(source-link.js ⑥)과 같은 열쇠·회차 규칙 */
export function hasUsableFix(t, fixes) {
  const f = (fixes || {})[`id:kosaf-${t.key}`];
  return !!(f && f.url && SL.fixUrlUsable(f.url) && (!f.round || f.round === (t.deadline || '')));
}
/** 사냥할 층2 대상 — 마감 전 · 회차 있음 · 아직 개별 글이 없음 → 재단 호스트별 묶음 */
export function huntTargets(index, { today = '', fixes = {}, only = '' } = {}) {
  const groups = new Map();
  for (const t of (index && index.targets) || []) {
    if (t.ds !== 'kosaf' || !t.round || !t.raw) continue;
    if (t.deadline && today && t.deadline < today) continue;
    if (hasUsableFix(t, fixes)) continue;
    const host = hostOf(t.raw);
    if (!host || (only && !host.includes(String(only).toLowerCase()))) continue;
    if (!groups.has(host)) groups.set(host, { host, home: t.raw, org: t.org || '', targets: [] });
    groups.get(host).targets.push(t);
  }
  return [...groups.values()].sort((a, b) => b.targets.length - a.targets.length || a.host.localeCompare(b.host));
}
/** 한 쪽에서 글 줄 — 날짜 붙은 줄이 먼저 · 없으면 공고처럼 보이는 링크 · 그 재단 사이트의 글 주소 꼴만 */
export function postRows(html, base, allowed) {
  let rows = [];
  try { rows = extractDatedRows(html, base); } catch { rows = []; }
  if (!rows.length) { try { rows = extractLinks(html, base).filter(isNoticeLike); } catch { rows = []; } }
  const seen = new Set(); const out = [];
  for (const r of rows) {
    if (!r || !r.url || !r.title) continue;
    const u = normCandUrl(SL.decodeUrlEntities(r.url));
    if (!/^https?:/i.test(u) || !hostAllowed(u, allowed) || SL.linkShape(u) !== 'page' || !looksLikePost(u)) continue;
    const k = urlKey(u);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ ...r, url: u });
  }
  return out;
}
/** 재단 하나의 쪽들 → 후보 줄 — 글을 고르면 url 줄 · 못 고르면 게시판 같은 쪽을 board 줄. 🔴 같은 주소는 줄 하나(첫 사업 + also 에 나머지 —
    확인 로봇은 같은 주소를 하루에 한 번만 열어 둘째 줄부터는 조용히 건너뛴다 · 리뷰 2026-10-12) · 글 줄은 쪽을 합쳐 재단 전체에서 고른다(쪽마다 고르면
    홈의 3점 글이 안쪽 목록의 더 좋은 글을 이긴다) · 첫 화면(level 0)은 게시판으로 치지 않는다(앱이 이미 보여 주는 곳이다) */
export function huntLines(group, pages, { today = '' } = {}) {
  const allowed = group.targets[0].allowed;
  const scored = pages.map((p) => ({ ...p, rows: postRows(p.html, p.url, allowed), board: scoreBoardPage(p.links || []) }));
  const rowsAll = []; const seenRow = new Set();
  for (const p of scored) for (const r of p.rows) { const k = urlKey(r.url); if (seenRow.has(k)) continue; seenRow.add(k); rowsAll.push({ ...r, page: p }); }
  const boardLike = scored.filter((p) => (p.level || 0) > 0 && (p.board.signals >= BOARD_MIN_SIGNALS || p.rows.length >= 5))
    .sort((a, b) => b.board.signals - a.board.signals || b.rows.length - a.rows.length);
  const found = []; const byUrl = new Map(); const noPick = [];
  for (const t of group.targets) {
    const got = pickKosafPost(t, rowsAll);
    if (got) { found.push({ t, page: got.p.page, pick: got.p, why: got.why }); if (!byUrl.has(got.p.url)) byUrl.set(got.p.url, []); byUrl.get(got.p.url).push({ t, got }); }
    else noPick.push(t);
  }
  const lines = [];
  const alsoOf = (first, rest) => { const codes = [...new Set([...(first.alsoCodes || []), ...rest.map((x) => x.key)])].filter((c) => c !== first.key); return codes.length ? { also: codes } : {}; };
  for (const [url, hits] of byUrl) {
    const first = hits[0].t; const rest = hits.slice(1).map((h) => h.t);
    lines.push({ target: { ds: 'kosaf', key: first.key }, url, title: hits[0].got.p.title, source: 'board', by: BY, addedAt: today,
      note: `${hits[0].got.p.page.url} 목록에서 고름 — ${hits[0].got.why.join(' · ')}`, ...alsoOf(first, rest) });
  }
  if (noPick.length && boardLike.length) {
    const p = boardLike[0];
    lines.push({ target: { ds: 'kosaf', key: noPick[0].key }, board: p.url, source: 'board', by: BY, addedAt: today,
      note: `게시판처럼 보이는 쪽(공고 ${p.board.signals}건 · 글 줄 ${p.rows.length}) — 확인 로봇이 목록을 다시 읽어 고른다`, ...alsoOf(noPick[0], noPick.slice(1)) });
  }
  /* 게시판으로 적을 쪽 — 글을 고른 **안쪽** 쪽이 먼저, 없으면 공고가 문턱 이상인 안쪽 쪽. 홈은 적지 않는다(수집 로봇이 홈 메뉴를 글로 읽는다) */
  const boards = [];
  const pickedInner = found.map((f) => f.page).find((p) => (p.level || 0) > 0 && p.board.signals >= BOARD_MIN_SIGNALS);
  const boardPage = pickedInner || boardLike.find((p) => p.board.signals >= BOARD_MIN_SIGNALS) || null;
  if (boardPage) boards.push({ url: boardPage.url, menu: boardPage.title || '', signals: boardPage.board.signals, sample: boardPage.board.sample, byPick: !!pickedInner });
  return { lines, found, boards };
}
/** ⑤ 검색 길 — 열쇠 두 칸이 다 있어야 켜진다(하나라도 비면 null · 꺼짐) */
export function searchKeys(env = process.env) {
  const id = String((env && env.NAVER_CLIENT_ID) || '').trim(); const secret = String((env && env.NAVER_CLIENT_SECRET) || '').trim();
  return id && secret ? { id, secret } : null;
}
/** 물을 말 — 재단 이름 + 사업 이름 + 공고 (재단 이름이 사업 이름에 이미 들어 있으면 한 번만) */
export function searchQuery(t) {
  const org = String((t && t.org) || '').trim(); const prog = String((t && t.program) || '').trim();
  return [org, prog && org && prog.includes(org) ? '' : prog, '공고'].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
}
/** 네이버 검색 응답 → 글 줄 — 그 재단 사이트의 글 주소만 · 제목의 <b> 강조·기호를 걷는다 */
export function searchRows(json, allowed) {
  const items = json && Array.isArray(json.items) ? json.items : [];
  const clean = (x) => SL.decodeUrlEntities(String(x || '').replace(/<[^>]*>/g, '')).replace(/&(quot|#39|apos|amp|lt|gt);/g, (m, k) => ({ quot: '"', '#39': "'", apos: "'", amp: '&', lt: '<', gt: '>' })[k]).replace(/\s+/g, ' ').trim();
  const seen = new Set(); const out = [];
  for (const it of items) {
    const u = normCandUrl(SL.decodeUrlEntities(String((it && it.link) || '')));
    const title = clean(it && it.title);
    if (!title || !/^https?:/i.test(u) || !hostAllowed(u, allowed) || SL.linkShape(u) !== 'page' || !looksLikePost(u)) continue;
    const k = urlKey(u);
    if (seen.has(k)) continue;
    seen.add(k); out.push({ url: u, title });
  }
  return out;
}
/** 공고 하나의 검색 결과 → 후보 줄 하나(못 고르면 null) */
export function searchLine(t, rows, query, { today = '' } = {}) {
  const got = pickKosafPost(t, rows);
  if (!got) return null;
  return { target: { ds: 'kosaf', key: t.key }, url: got.p.url, title: got.p.title, source: 'search', query, by: BY, addedAt: today,
    note: `네이버 검색에서 고름 — ${got.why.join(' · ')}`, ...((t.alsoCodes || []).length ? { also: t.alsoCodes.filter((c) => c !== t.key) } : {}) };
}

/** 찾은 게시판을 external-sources 에 — 있던 줄(홈 호스트 같음 또는 host 이름 같음)의 빈 boardUrl 을 채우거나 새 줄을 더한다. 사람이 적은 boardUrl 은 건드리지 않는다 */
export function recordBoard(cfg, group, board, { today = '' } = {}) {
  const sources = (cfg.sources = cfg.sources || []);
  const parked = cfg.parked || [];
  const homeHost = hostOf(group.home);
  if (parked.some((s) => s && ((s.boardUrl && urlKey(s.boardUrl) === urlKey(board.url)) || (s.home && hostOf(s.home) === homeHost)))) return { action: 'parked' };
  const auto = { date: today, signals: board.signals, menu: `층2 글 사냥꾼 · ${board.byPick ? '층2 공고 글을 고른 쪽' : '공고 3건 이상'}${board.menu ? ` · ${board.menu}` : ''}`, sample: board.sample || [] };
  let row = sources.find((s) => s && s.home && hostOf(s.home) === homeHost) || sources.find((s) => s && s.host === group.org);
  if (row) {
    if (row.boardUrl) return { action: 'kept', row };
    row.boardUrl = board.url; row.autoFound = auto; delete row.probe;
    return { action: 'filled', row };
  }
  row = { host: group.org || homeHost, home: group.home, boardUrl: board.url, seed: 'kosaf-open', autoFound: auto };
  sources.push(row);
  return { action: 'added', row };
}
/** 후보 파일 합치기 — 오늘 본 재단(그 대상 코드들)의 줄은 새로, 안 본 재단의 줄은 그대로 · 같은 후보(cid)는 처음 적은 날(addedAt)을 지킨다(확인 로봇이 날마다
    '새 후보'로 다시 열지 않게) · 다만 60일 벼랑(loadCandidates 가 60일 지난 줄을 버린다)에 닿기 전엔 날짜를 새로 적는다(리뷰 2026-10-12) */
export const REFRESH_AFTER_DAYS = 50;
export function mergeLines(prevItems, newLines, huntedKeys, { today = '', keep = () => true } = {}) {
  const cidOf = (l) => candId('kosaf', String(l.target.key).replace(/^kosaf-/, ''), l.url ? normCandUrl(l.url) : '', l.board ? normCandUrl(l.board) : '');
  const keyOf = (l) => String(l.target.key).replace(/^kosaf-/, '');
  const prevBy = new Map((prevItems || []).map((l) => [cidOf(l), l]));
  const days = (a, b) => (a && b ? Math.floor((Date.parse(b) - Date.parse(a)) / 86400000) : 0);
  const out = [];
  for (const l of prevItems || []) {
    if (huntedKeys.has(keyOf(l)) || (l.also || []).some((c) => huntedKeys.has(String(c)))) continue;
    if (!keep(l)) continue;
    out.push(l);
  }
  for (const l of newLines) {
    const p = prevBy.get(cidOf(l));
    out.push(p && p.addedAt && days(p.addedAt, today) < REFRESH_AFTER_DAYS ? { ...l, addedAt: p.addedAt } : l);
  }
  return out;
}

/* ── 받기 (보통 → 브라우저) ────────────────────────────────────────── */
async function plainGet(url, hop = 0) {
  const res = await fetch(url, { redirect: 'follow', headers: FETCH_HEADERS, signal: AbortSignal.timeout(PAGE_MS) });
  if (!res.ok) throw new Error(`응답 ${res.status}`);
  const html = await res.text();
  const next = hop === 0 && html.length < 3000 ? metaRefreshTarget(html, res.url || url) : null;
  return next ? plainGet(next, 1) : { html, url: res.url || url, how: 'fetch' };
}
let browser = null; let ctx = null; let browserTried = false;
async function browserGet(url) {
  if (!browser) {
    if (browserTried) throw new Error('브라우저 없음');
    browserTried = true;
    /* playwright 는 워크플로가 npm 으로 깔아 준다 · 로컬(샌드박스)에선 PLAYWRIGHT_PATH 로 가리킨다(ESM import 는 NODE_PATH 를 안 본다) */
    const pw = await import('playwright').catch(async (e) => { if (process.env.PLAYWRIGHT_PATH) return import(process.env.PLAYWRIGHT_PATH); throw e; });
    const chromium = pw.chromium || (pw.default && pw.default.chromium);
    browser = await chromium.launch({ args: ['--no-sandbox'], ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
    ctx = await browser.newContext({ userAgent: UA, locale: 'ko-KR' });
  }
  const page = await ctx.newPage();
  try {
    const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: PAGE_MS });
    await page.waitForTimeout(1200).catch(() => {});
    const st = res ? res.status() : 0;
    if (st >= 400) throw new Error(`응답 ${st}`);
    return { html: await page.content(), url: page.url(), how: 'browser' };
  } finally { await page.close().catch(() => {}); }
}
const BROWSER_FIRST = process.env.KOSAF_HUNT_BROWSER_FIRST === '1';   // 샌드박스처럼 보통 받기가 막힌 곳 — 처음부터 브라우저로
async function getPage(url, useBrowser) {
  try { if (BROWSER_FIRST && useBrowser) throw new Error('browser-first'); return await plainGet(url); } catch (e) {
    if (!useBrowser) throw e;
    const got = await withDeadline(browserGet(url).catch((e2) => ({ error: `${netReason(e)} → 브라우저도 실패(${String((e2 && e2.message) || e2).slice(0, 60)})` })), PAGE_MS + 10000);
    if (got === TIMED_OUT) throw new Error(`${netReason(e)} → 브라우저 시한`);
    if (got.error) throw new Error(got.error);
    return got;
  }
}
/** 재단 하나를 뒤진다 — 홈 + 메뉴 두 단계 · 쪽 10개 상한 */
async function crawlSite(group, { useBrowser, budget, log }) {
  const pages = []; const seen = new Set(); let why = '';
  const add = async (url, title, level) => {
    const k = url.replace(/[?#].*$/, '');
    if (seen.has(k)) return null;
    if (seen.size >= MAX_PAGES_PER_HOST || !budget.hasRoom(PAGE_MS)) return null;   // 시도 수로 센다(실패한 요청도 요청이다 · 리뷰)
    seen.add(k);
    try {
      const got = await getPage(url, useBrowser);
      const links = extractLinks(got.html, got.url);
      const p = { url: got.url, title, html: got.html, links, level, how: got.how };
      pages.push(p);
      return p;
    } catch (e) { if (level === 0) why = `홈페이지 못 엶 (${String((e && e.message) || e).slice(0, 80)})`; return null; }
  };
  const home = await add(group.home, '(홈)', 0);
  if (!home) return { pages, why: why || '홈페이지 못 엶' };
  const level1 = pickMenuLinks(home.links, group.home, 8);
  for (const m of level1) {
    const p = await add(m.url, m.title, 1);
    if (!p) continue;
    for (const m2 of pickMenuLinks(p.links, group.home, 3)) await add(m2.url, `${m.title} › ${m2.title}`, 2);
  }
  log(`  ${group.host}: 쪽 ${pages.length}개 (브라우저 ${pages.filter((p) => p.how === 'browser').length})`);
  return { pages, why: '' };
}

async function naverSearch(keys, query) {
  const res = await fetch(`${SEARCH_URL}?query=${encodeURIComponent(query)}&display=10`, {
    headers: { 'X-Naver-Client-Id': keys.id, 'X-Naver-Client-Secret': keys.secret }, signal: AbortSignal.timeout(PAGE_MS) });
  if (!res.ok) throw new Error(`검색 응답 ${res.status}`);
  return res.json();
}

/* ── 본편 ──────────────────────────────────────────────────────────── */
export async function runHunt({ root, today, dry = false, all = false, only = '', useBrowser = true, log = console.log } = {}) {
  const P = (rel) => path.join(root, rel);
  const readJ = (rel, fb) => { try { return JSON.parse(fs.readFileSync(P(rel), 'utf8')); } catch { return fb; } };
  const idxData = readIndexData(root);
  const index = buildIndex(idxData);
  const fixes = (readJ('data/link-check.json', {}).fix) || {};
  const groups = huntTargets(index, { today, fixes, only });
  const liveKeys = new Set(huntTargets(index, { today, fixes }).flatMap((g) => g.targets.map((t) => t.key)));   // 🔴 only 로 좁혀도 다른 재단의 줄은 지우지 않는다
  const state = readJ('collector/kosaf-hunt-state.json', { v: 1, hosts: {} });
  const prevFile = readJ('collector/kosaf-hunt.json', { v: 1, note: NOTE, items: [] });
  const cfg = readJ('collector/external-sources.json', { sources: [], parked: [] });
  const budget = makeBudget(BUDGET_MS);
  const daysAgo = (d) => (d ? Math.floor((Date.parse(today) - Date.parse(d)) / 86400000) : Infinity);
  const due = groups.filter((g) => all || daysAgo((state.hosts[g.host] || {}).checkedAt) >= RETRY_DAYS);
  const huntedKeys = new Set(); const newLines = []; const report = [];
  const stats = { groups: groups.length, due: due.length, hunted: 0, found: 0, boardLines: 0, boardsAdded: 0, boardsFilled: 0, noPage: 0, nothing: 0 };
  const keys = searchKeys(); const leftover = [];   // 홈페이지 길로 글을 못 고른 공고 — ⑤ 검색 길이 받는다
  const sstat = { asked: 0, found: 0, failed: 0, why: '' };
  const R = (s) => report.push(s);
  let stopNote = '';
  try {
  for (const g of due) {
    if (!budget.hasRoom(PAGE_MS * 2)) { stopNote = `⏰ 예산(${Math.round(BUDGET_MS / 60000)}분)이 다 돼 ${due.length - stats.hunted}곳은 다음 실행이 봅니다`; break; }
    stats.hunted += 1;
    const { pages, why } = await crawlSite(g, { useBrowser, budget, log });
    for (const t of g.targets) huntedKeys.add(t.key);
    const names = g.targets.map((t) => `${t.program || t.key}`).join(' · ');
    if (!pages.length) {
      stats.noPage += 1;
      state.hosts[g.host] = { checkedAt: today, why, targets: g.targets.length };
      R(`- 🔴 **${g.org || g.host}** (${g.targets.length}건: ${names}) — ${why}`);
      leftover.push(...g.targets);
      continue;
    }
    const { lines, found, boards } = huntLines(g, pages, { today });
    newLines.push(...lines);
    const picked = new Set(found.map((f) => f.t.key));
    leftover.push(...g.targets.filter((t) => !picked.has(t.key)));
    stats.found += found.length; stats.boardLines += lines.filter((l) => l.board).length;
    let boardNote = '';
    for (const b of boards) {
      const r = recordBoard(cfg, g, b, { today });
      if (r.action === 'added') stats.boardsAdded += 1; if (r.action === 'filled') stats.boardsFilled += 1;
      boardNote = ` · 게시판 ${r.action === 'kept' ? '이미 앎' : r.action === 'parked' ? '보관됨(안 씀)' : `${r.action === 'added' ? '새로 적음' : '채움'}: ${b.url}`}`;
    }
    state.hosts[g.host] = { checkedAt: today, pages: pages.length, found: found.length, lines: lines.length, targets: g.targets.length, why: found.length ? '' : (lines.length ? '글은 못 고르고 게시판만' : '게시판도 글도 못 찾음') };
    if (found.length) R(`- ✅ **${g.org || g.host}** — ${found.length}/${g.targets.length}건 글을 고름${boardNote}\n${found.map((f) => `  - ${f.t.program || f.t.key} → ${f.pick.title} (${f.why.join(' · ')})\n    ${f.pick.url}`).join('\n')}`);
    else if (lines.length) R(`- 🟡 **${g.org || g.host}** (${g.targets.length}건: ${names}) — 글은 못 고르고 게시판처럼 보이는 쪽만: ${lines[0].board}${boardNote}`);
    else { stats.nothing += 1; R(`- ⚪ ${g.org || g.host} (${g.targets.length}건: ${names}) — 쪽 ${pages.length}개를 봤지만 공고 글 줄이 없음(메뉴 두 단계 안에 게시판이 없거나 스크립트로만 그림)`); }
  }
  /* ⑤ 검색 길 — 열쇠가 있을 때만 · 홈페이지 길로 못 고른 공고만 · 상한·예산 안에서 */
  if (!keys) sstat.why = '꺼짐(열쇠 없음 — GitHub Secrets NAVER_CLIENT_ID · NAVER_CLIENT_SECRET)';
  else {
    const searched = [];
    for (const t of leftover) {
      if (sstat.asked >= SEARCH_MAX) { sstat.why = `상한 ${SEARCH_MAX}번 — 나머지는 다음 실행`; break; }
      if (!budget.hasRoom(PAGE_MS)) { sstat.why = '예산이 다 됨 — 나머지는 다음 실행'; break; }
      if (sstat.failed >= 3) { sstat.why = '검색 실패가 3번 — 이번 실행은 멈춤(열쇠·한도를 확인)'; break; }
      const q = searchQuery(t);
      sstat.asked += 1;
      let json = null;
      try { json = await naverSearch(keys, q); } catch (e) { sstat.failed += 1; log(`  검색 실패: ${q} — ${String((e && e.message) || e).slice(0, 60)}`); continue; }
      const line = searchLine(t, searchRows(json, t.allowed), q, { today });
      if (line) { newLines.push(line); sstat.found += 1; searched.push(`  - ${t.program || t.key} → ${line.title} (${line.note.replace(/^네이버 검색에서 고름 — /, '')})\n    ${line.url}`); }
      await new Promise((r) => setTimeout(r, 300));
    }
    if (searched.length) R(`- 🔎 **네이버 검색으로 고른 글** ${searched.length}건\n${searched.join('\n')}`);
  }
  } catch (e) { stopNote = `⚠️ 도중에 넘어짐(${String((e && e.message) || e).slice(0, 80)}) — 그때까지 본 것은 저장`; log(stopNote); }
  finally { if (browser) { await withDeadline(browser.close().catch(() => {}), 8000); browser = null; } }
  /* 합치기 — 마감 지났거나 fix 가 생긴 대상의 줄은 버린다(only 와 무관하게 살아 있는 대상 전체로 잰다) */
  const items = mergeLines(prevFile.items || [], newLines, huntedKeys, { today, keep: (l) => liveKeys.has(String(l.target.key).replace(/^kosaf-/, '')) });
  const check = loadCandidates({ v: 1, items }, { today });
  const md = [
    `## 🧭 층2 재단 글 사냥꾼 리포트 (${today})`, '',
    '한국장학재단이 아는 재단 장학금을 **그 재단 홈페이지의 개별 공고 글**로 보내기 위해 재단 홈페이지를 뒤져 후보를 적었습니다. 앱에 싣는 것은 원문 링크 확인 로봇이 학생처럼 열어 확인한 뒤입니다.',
    `대상 재단 ${stats.groups}곳(마감 전 층2 공고 ${groups.reduce((n, g) => n + g.targets.length, 0)}건) · 이번에 본 곳 ${stats.hunted}/${stats.due} · 글을 고름 ${stats.found}건 · 게시판만 ${stats.boardLines}건 · 홈페이지 못 엶 ${stats.noPage}곳 · 아무것도 못 찾음 ${stats.nothing}곳 · 재단 게시판 새로 ${stats.boardsAdded} / 채움 ${stats.boardsFilled}${stopNote ? ` — ${stopNote}` : ''}`,
    `검색 길: ${keys ? `${sstat.asked}번 물어 글 ${sstat.found}건${sstat.failed ? ` · 실패 ${sstat.failed}` : ''}${sstat.why ? ` — ${sstat.why}` : ''}` : sstat.why}`,
    `후보 파일 줄 ${check.ok.length}개(쓰지 못한 줄 ${check.bad.length}) — 확인 로봇(link-check · 후보 모드)이 엽니다.`, '',
    ...report, '',
  ].join('\n');
  if (!dry) {
    fs.writeFileSync(P('collector/kosaf-hunt.json'), JSON.stringify({ v: 1, note: NOTE, updatedAt: today, items }, null, 1) + '\n');
    fs.writeFileSync(P('collector/kosaf-hunt-state.json'), JSON.stringify({ v: 1, updatedAt: today, hosts: state.hosts }, null, 1) + '\n');
    fs.writeFileSync(P('collector/external-sources.json'), JSON.stringify(cfg, null, 1));
    fs.writeFileSync(P('collector/kosaf-hunt-report.md'), md);
  }
  log(md);
  return { stats, items, report: md, bad: check.bad };
}

if (!process.env.KOSAF_HUNT_AS_LIB) {
  const argv = process.argv.slice(2);
  const flag = (k) => { const a = argv.find((x) => x === `--${k}` || x.startsWith(`--${k}=`)); return a ? (a.includes('=') ? a.slice(a.indexOf('=') + 1) : true) : null; };
  const root = process.env.KOSAF_HUNT_ROOT ? path.resolve(process.env.KOSAF_HUNT_ROOT) : path.resolve(HERE, '..');
  const kst = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
  runHunt({ root, today: String(flag('today') || kst), dry: flag('dry') === true, all: flag('all') === true, only: String(flag('only') || ''), useBrowser: flag('no-browser') !== true })
    .catch((e) => { console.error(e); process.exit(1); });
}

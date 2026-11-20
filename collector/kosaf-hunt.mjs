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
   ⑤ 검색 길 (2026-10-13 · 은서 — 사장님 "네이버 검색 API 발급받아서 넣어 줄 수 있음?") — 홈페이지 길로 글을 못 고른 공고(홈페이지를 못 연 재단 포함)
     + 오늘 홈페이지를 안 연 공고 중 글 후보가 없는 것(2026-11-18 · searchQueue — 예전엔 '오늘 연 재단'만 물어 하루 몇 곳뿐이었다)을
     네이버 웹문서 검색(NAVER API HUB — 네이버클라우드 콘솔 → NAVER API HUB 에서 앱을 만들고 '검색 - 웹문서'를 고른다)에 「재단 이름 + 사업 이름 + 공고」를 묻는다. 결과 중 **그 재단 사이트의 글 주소**(hostAllowed · looksLikePost)만 남겨 같은 점수 규칙
     (pickKosafPost)으로 고르고, 후보 줄 source 'search'(검색 결과 제목은 증거로만 — 확인 로봇이 학생처럼 열어 본 뒤에야 앱에 실린다).
     🔴 열쇠(GitHub Secrets NAVER_CLIENT_ID · NAVER_CLIENT_SECRET)가 없으면 이 길은 조용히 꺼진다 — 리포트에 '꺼짐(열쇠 없음)'으로 적는다.
     🔴 한 실행 검색 상한 SEARCH_MAX(기본 60 · 하루 한 번 → 한 달 약 1,800번 — NCP 안내(2026-11-18 확인): 「한시적으로 무료 · 유료 전환 시 사전 공지」 ·
        한도는 월 775,000건). 🔴 유료로 바뀐다는 공지가 오면 CLAUDE.md 8번(돈이 나가는 호출) 대상이다 — 개발자에게 묻기 전엔 상한을 올리지 말 것.
        검색 사이 틈 · 실패가 연달아 3번이면 그 실행은 검색을 멈춘다.
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
import { readIndexData, buildIndex, pickKosafPost, scoreKosafPost, hostAllowed, hostOf, normCandUrl, looksLikePost, looksLikePostLoose, candId, loadCandidates } from './link-candidates.mjs';
import { titleFingerprint } from './detail-url.mjs';
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
/* 🔴 네이버 개발자센터(openapi.naver.com)는 2026-07-31 신규 신청을 닫고 검색 API 를 네이버클라우드 NAVER API HUB 로 옮겼다(2026-10-13 확인 —
   개발자센터 '사용 API' 목록에 검색이 없다). 새 키는 HUB 에서만 나오고, 주소와 머리말 이름이 다르다. 옛 개발자센터 키는 HUB 에 안 통한다. */
const SEARCH_URL = 'https://naverapihub.apigw.ntruss.com/search/v1/webkr';
const NOTE = '층2 재단 장학금의 개별 공고 후보 — 로봇(collector/kosaf-hunt.mjs)이 재단 홈페이지를 뒤져 적는다. 사람 후보 파일(link-candidates.json)과 같은 줄 꼴. 원문 링크 확인 로봇이 학생처럼 열어 확인한 것만 앱(data/link-check.json fix)에 실린다. 손으로 고치지 말 것 — 다음 실행이 다시 쓴다.';

/* ── 순수 함수 ──────────────────────────────────────────────────────── */
/** 앱이 이미 그 회차의 개별 글로 보내는가 — **앱의 규칙 그대로**(source-link.js ⑥ linkFixFor: 사람 바로잡기 data/link-fixes.json 이 먼저 ·
    로봇 바로잡기 data/link-check.json · 층2는 회차(round)가 마감과 같을 때만).
    🔴 2026-11-20 실측: 예전엔 로봇 장부(link-check.json)만 봐서, 사람이 이미 원문을 넣은 공고 43/46건에 날마다 검색 상한(40번)을 다 썼다
       ('40번 물어 글 0건' 사흘). KOSAF 마감이 바뀌면(새 회차) 옛 바로잡기는 안 맞아 저절로 다시 대상이 된다.
    fixes = 로봇 fix · human = 사람 fix — 모듈 상태를 쓰고 되돌린다(publishFix 와 같은 버릇) */
export function hasUsableFix(t, fixes, human = {}) {
  if (!t || !t.appItem) return false;
  SL.setLinkChecks({ fix: fixes || {} });
  SL.setLinkFixes({ fix: human || {} });
  try { return !!SL.linkFixFor(t.appItem); } finally { SL.setLinkChecks(null); SL.setLinkFixes(null); }
}
/** 한국장학재단 자체 사업(isKosafOwnOrg · 데이터의 org 로만) — 회차 글이 따로 없고 원문은 재단 누리집의 그 사업 안내 쪽이다.
    KOSAF 가 적은 주소가 kosaf.go.kr 의 **글 꼴**(사업 안내 쪽)이면 검색하지 않고 그 주소를 후보(source data)로 바로 적는다 —
    확인 로봇이 같은 날 학생처럼 열어 사업 이름·사업 기간을 보고 판정한다(등록되자마자 원문 · 2026-11-20). 첫 화면 꼴은 적지 않는다 */
export function kosafOwnLine(t, { today = '' } = {}) {
  if (!t || !t.kosafOwn || !t.raw) return null;
  const u = normCandUrl(SL.decodeUrlEntities(t.raw));
  if (!/(^|\.)kosaf\.go\.kr$/i.test(hostOf(u)) || SL.linkShape(u) !== 'page' || !SL.fixUrlUsable(u)) return null;
  return { target: { ds: 'kosaf', key: t.key }, url: u, title: t.program || '', source: 'data', by: BY, addedAt: today,
    note: 'KOSAF 가 적은 한국장학재단 사업 안내 쪽 — 자체 사업이라 그 쪽이 원문 후보' };
}
/** 사냥할 층2 대상 — 마감 전 · 회차 있음 · 아직 개별 글이 없음 → 재단 호스트별 묶음 */
export function huntTargets(index, { today = '', fixes = {}, human = {}, only = '' } = {}) {
  const groups = new Map();
  for (const t of (index && index.targets) || []) {
    if (t.ds !== 'kosaf' || !t.round || !t.raw) continue;
    if (t.deadline && today && t.deadline < today) continue;
    if (hasUsableFix(t, fixes, human)) continue;
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
/** 둘째 물을 말 — KOSAF 에 올라온 공고문 파일 이름(확장자·끝 꼬리 「(15)」·「ver-1.5」·날짜 도장·「공고문」을 뗀 것).
    2026-11-20 실측: 정답 글 55건 중 첫 말로 6건, 파일 이름으로 7건, 둘 중 하나로 12건이 검색 결과에 있었다(「재단+해+장학생 선발」은 더한 것이 없고
    남의 사업 보도자료만 끌어와 쓰지 않는다). 첫 말과 같으면 한 번만 묻는다 */
export function searchQueries(t) {
  const first = searchQuery(t);
  const a = String(((t && t.attachTitles) || [])[0] || '')
    .replace(/\.[a-z0-9]{2,5}$/i, '')
    .replace(/\(\s*\d{1,3}\s*\)|ver[-_ .]?\d+(?:\.\d+)*/gi, ' ')
    .replace(/(?<![\d년.])\d{4,8}\s*$/, ' ')
    .replace(/\s*공고문\s*$/, ' ')
    .replace(/\s+/g, ' ').trim();
  const out = [first];
  if (a.length >= 8 && titleFingerprint(a) !== titleFingerprint(first)) out.push(a);
  return out.filter(Boolean);
}
/** 네이버 검색 응답 → 글 줄 — 그 재단 사이트의 글 주소만 · 제목의 <b> 강조·기호를 걷는다 ·
    요약(description)은 snippet 으로 남긴다 — 검색 제목은 대개 그 쪽의 뭉뚱그린 창 제목(「공지사항 - 일신문화재단」)이고 진짜 글 제목·첨부 이름은
    요약에 있다(2026-11-20 실측). 🔴 snippet 은 글을 **고르는** 데만 쓴다(scoreKosafPost) — 확인 로봇에 넘기는 제목은 검색 제목 그대로다 */
export function searchRows(json, allowed, t = null) {
  const items = json && Array.isArray(json.items) ? json.items : [];
  const clean = (x) => SL.decodeUrlEntities(String(x || '').replace(/<[^>]*>/g, '')).replace(/&(quot|#39|apos|amp|lt|gt);/g, (m, k) => ({ quot: '"', '#39': "'", apos: "'", amp: '&', lt: '<', gt: '>' })[k]).replace(/\s+/g, ' ').trim();
  const seen = new Set(); const out = [];
  for (const it of items) {
    const u = normCandUrl(SL.decodeUrlEntities(String((it && it.link) || '')));
    const title = clean(it && it.title);
    const snippet = clean(it && it.description);
    if (!title || !/^https?:/i.test(u) || !hostAllowed(u, allowed) || SL.linkShape(u) !== 'page') continue;
    /* 경로만으로 된 글 꼴은 그 사업·재단 이름으로 3점 이상 받은 검색 줄만(looksLikePostLoose · 2026-11-20) */
    if (!looksLikePost(u) && !(t && looksLikePostLoose(u) && looseHitOk(t, { url: u, title, snippet }))) continue;
    const k = urlKey(u);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(snippet ? { url: u, title, snippet } : { url: u, title });
  }
  return out;
}
function looseHitOk(t, row) {
  const r = scoreKosafPost(t, row);
  return r.score >= 3 && r.why.some((w) => /^(?:사업 이름|재단 이름)/.test(w));
}
/** 검색할 공고 — 오늘 홈페이지 길로 못 고른 것(leftover) + **오늘 홈페이지를 안 연** 공고 가운데 글 후보(url 줄)가 아직 없는 것.
    🔴 2026-11-18: 검색이 '오늘 홈페이지를 다시 본 재단'(3일에 한 번)에만 붙어 있어, 열쇠가 들어온 뒤에도 하루 몇 곳만 물었다 —
       재단 홈페이지 꼴(여는 날)과 검색(묻는 날)은 따로다. 이미 글 후보가 있는 공고는 다시 묻지 않는다(그 재단을 다시 보는 날 새로 묻는다).
    · 오늘 연 공고(crawledKeys)만 뺀다 — 예산에 잘려 못 연 재단의 공고는 검색이 받는다.
    · 뒤쪽은 **오래 안 물은 것부터**(searchedAt · 장부 searched) — 대상이 상한(SEARCH_MAX)보다 많으면 늘 같은 꼬리가 밀린다(리뷰 11-18: 63건 vs 60).
    · 같은 공고 묶음(alsoCodes)은 하나만 묻는다 — 둘 다 물으면 한 주소에 줄이 둘 생긴다(한 주소 한 줄 · huntLines 와 같은 규칙). */
/*  · (2026-11-20) 확인 로봇이 이번 회차에 이미 **거절한** url 줄(rejected · 「마감이 다름」 말고)은 글 후보로 치지 않는다 — 그 줄이 남아 있는 한
      공고가 검색에서 빠져 재단을 다시 보는 날(3일 넘게)까지 기다렸다(ikef wr_id=102 「다른 글이 열림」). rejected = Set('<코드>|<주소 열쇠>') */
export function searchQueue(groups, crawledKeys, leftover, prevItems, searchedAt = {}, rejected = new Set()) {
  const crawled = crawledKeys instanceof Set ? crawledKeys : new Set(crawledKeys || []);
  const hasUrl = new Set();
  for (const l of prevItems || []) {
    if (!l || !l.url) continue;
    const key = String((l.target && l.target.key) || '').replace(/^kosaf-/, '');
    if (rejected.has(`${key}|${urlKey(normCandUrl(l.url))}`)) continue;
    for (const k of [key, ...(l.also || [])]) hasUrl.add(String(k || '').replace(/^kosaf-/, ''));
  }
  const rest = [];
  for (const g of groups || []) for (const t of g.targets) if (!crawled.has(t.key) && !hasUrl.has(String(t.key))) rest.push(t);
  const when = (t) => String((searchedAt || {})[t.key] || '');
  rest.sort((a, b) => when(a).localeCompare(when(b)));   // 안 물은 것('') → 오래전에 물은 것 · 같으면 원래 순서(안정 정렬)
  const out = []; const covered = new Set();
  for (const t of [...(leftover || []), ...rest]) {
    if (covered.has(String(t.key))) continue;
    for (const k of [t.key, ...(t.alsoCodes || [])]) covered.add(String(k));
    out.push(t);
  }
  return out;
}
/** 확인 로봇이 이번 회차에 거절로 끝낸 층2 후보 — Set('<코드>|<주소 열쇠>') · 「마감이 다름」은 뺀다(KOSAF 마감이 고쳐지면 다시 맞을 수 있다) */
export function rejectedCandKeys(candState, index) {
  const out = new Set();
  for (const e of Object.values(candState || {})) {
    if (!e || e.ds !== 'kosaf' || e.status !== 'rejected' || !e.url || /마감이 다름/.test(String(e.why || ''))) continue;
    const t = index && index.find ? index.find({ ds: 'kosaf', key: String(e.key) }) : null;
    if (!t || !e.round || e.round !== (t.deadline || '')) continue;
    out.add(`${e.key}|${urlKey(normCandUrl(e.url))}`);
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
    headers: { 'X-NCP-APIGW-API-KEY-ID': keys.id, 'X-NCP-APIGW-API-KEY': keys.secret }, signal: AbortSignal.timeout(PAGE_MS) });
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
  const human = (readJ('data/link-fixes.json', {}).fix) || {};   // 사람이 넣은 원문(앱이 늘 먼저 쓴다) — 이미 원문이 있는 공고에 검색을 쓰지 않는다
  const allGroups = huntTargets(index, { today, fixes, human, only });
  const liveKeys = new Set(huntTargets(index, { today, fixes, human }).flatMap((g) => g.targets.map((t) => t.key)));   // 🔴 only 로 좁혀도 다른 재단의 줄은 지우지 않는다
  /* 한국장학재단 자체 사업 — 사업 안내 쪽 주소를 바로 후보로(검색·홈페이지 뒤지기 없이) */
  const ownLines = [];
  for (const g of allGroups) for (const t of g.targets) { const l = kosafOwnLine(t, { today }); if (l) ownLines.push(l); }
  const ownKeys = new Set(ownLines.map((l) => l.target.key));
  const groups = allGroups.map((g) => ({ ...g, targets: g.targets.filter((t) => !ownKeys.has(t.key)) })).filter((g) => g.targets.length);
  const rejected = rejectedCandKeys(readJ('collector/link-candidates-state.json', {}), index);
  const state = readJ('collector/kosaf-hunt-state.json', { v: 1, hosts: {} });
  const prevFile = readJ('collector/kosaf-hunt.json', { v: 1, note: NOTE, items: [] });
  const cfg = readJ('collector/external-sources.json', { sources: [], parked: [] });
  const budget = makeBudget(BUDGET_MS);
  const daysAgo = (d) => (d ? Math.floor((Date.parse(today) - Date.parse(d)) / 86400000) : Infinity);
  const due = groups.filter((g) => all || daysAgo((state.hosts[g.host] || {}).checkedAt) >= RETRY_DAYS);
  const huntedKeys = new Set(ownKeys); const newLines = [...ownLines]; const report = [];
  if (ownLines.length) report.push(`- 🏛️ **한국장학재단 자체 사업** ${ownLines.length}건 — KOSAF 가 적은 사업 안내 쪽을 바로 후보로(확인 로봇이 학생처럼 열어 사업 기간을 본다)`);
  const stats = { groups: groups.length, due: due.length, hunted: 0, found: 0, boardLines: 0, boardsAdded: 0, boardsFilled: 0, noPage: 0, nothing: 0 };
  const keys = searchKeys(); const leftover = [];   // 홈페이지 길로 글을 못 고른 공고 — ⑤ 검색 길이 받는다
  const searchedAt = { ...(state.searched || {}) };   // 공고마다 마지막으로 검색에 물은 날 — 상한에 걸리면 오래 안 물은 것부터(searchQueue)
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
  /* ⑤ 검색 길 — 열쇠가 있을 때만 · 홈페이지 길로 못 고른 공고 + 오늘 홈페이지를 안 연 공고 중 글 후보가 없는 것(searchQueue) · 상한·예산 안에서 */
  if (!keys) sstat.why = '꺼짐(열쇠 없음 — GitHub Secrets NAVER_CLIENT_ID · NAVER_CLIENT_SECRET)';
  else {
    const searched = [];
    let stop = false;
    for (const t of searchQueue(groups, huntedKeys, leftover, prevFile.items, searchedAt, rejected)) {
      if (stop) break;
      /* 첫 말로 못 고르면 공고문 파일 이름으로 한 번 더(searchQueries) — 둘째 말도 상한(SEARCH_MAX)에 센다 */
      for (const q of searchQueries(t)) {
        if (sstat.asked >= SEARCH_MAX) { sstat.why = `상한 ${SEARCH_MAX}번 — 나머지는 다음 실행(오래 안 물은 것부터)`; stop = true; break; }
        if (!budget.hasRoom(PAGE_MS)) { sstat.why = '예산이 다 됨 — 나머지는 다음 실행'; stop = true; break; }
        if (sstat.failed >= 3) { sstat.why = '검색 실패가 3번 — 이번 실행은 멈춤(열쇠·한도를 확인)'; stop = true; break; }
        sstat.asked += 1;
        for (const k of [t.key, ...(t.alsoCodes || [])]) searchedAt[k] = today;   // 묶음은 한 번 물으면 다 물은 것(실제로 물었을 때만 적는다)
        let json = null;
        try { json = await naverSearch(keys, q); } catch (e) { sstat.failed += 1; log(`  검색 실패: ${q} — ${String((e && e.message) || e).slice(0, 60)}`); continue; }
        await new Promise((r) => setTimeout(r, 300));
        const line = searchLine(t, searchRows(json, t.allowed, t), q, { today });
        if (!line || rejected.has(`${t.key}|${urlKey(line.url)}`)) continue;   // 이번 회차에 이미 거절된 주소는 다시 적지 않는다
        newLines.push(line); sstat.found += 1; searched.push(`  - ${t.program || t.key} → ${line.title} (${line.note.replace(/^네이버 검색에서 고름 — /, '')})\n    ${line.url}`);
        break;
      }
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
    const searchedLive = Object.fromEntries(Object.entries(searchedAt).filter(([k]) => liveKeys.has(k)));   // 마감 지난 공고의 날짜는 버린다(장부가 자라지 않게)
    fs.writeFileSync(P('collector/kosaf-hunt-state.json'), JSON.stringify({ v: 1, updatedAt: today, hosts: state.hosts, searched: searchedLive }, null, 1) + '\n');
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

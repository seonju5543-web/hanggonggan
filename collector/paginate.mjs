/* ============================================================
   목록 페이지 넘기기 (2026-08-17 신설)
   ------------------------------------------------------------
   왜 필요한가: 두 수집 로봇은 **게시판 1페이지만** 읽었다. 상단 고정 공지가 많은
   게시판(경희대는 10건이 넘는다)은 실공고가 1페이지 밖으로 밀리는 순간 영영 안 잡힌다.
   장부(seen.json)를 비워도 안 잡힌다 — 게시판에 그 순간 떠 있는 것만 읽으므로.

   ⚠️ 이 저장소의 규칙은 "주소를 유추하지 말 것"이다(경희대에서 세 번 틀린 뒤 세운 규칙).
   그런데 페이지 주소는 사정이 다르다: 상세 주소를 잘못 만들면 **학생에게 엉뚱한 링크**가
   가지만, 페이지 주소를 잘못 만들면 **그냥 1페이지가 한 번 더 오는 것**뿐이다. 그래서
   여기서는 후보를 만들어 보되 **결과로 검증한다** — 받아 온 목록이 1페이지와 같으면
   "이 게시판은 그 파라미터를 무시한다"로 보고 그 후보를 버린다(samePage).
   그리고 알아낸 것은 collector/pagination.json에 적어 두어 **매일 다시 헤매지 않는다.**

   순수 함수만 두는 이유: 학교에 접속하지 않고 검사할 수 있어야 한다
   (harvest-budget.mjs와 같은 이유 — verify/test-collector.mjs가 인터넷 없이 돈다).
   ============================================================ */

/* 페이지 번호를 그대로 받는 파라미터들. 한국 대학 게시판에서 실제로 쓰이는 이름만 모았다.
   순서 = 흔한 순. 첫 후보가 맞으면 나머지는 시도하지 않는다. */
export const PAGE_PARAMS = [
  'page', 'pageIndex', 'pageNo', 'currentPageNo', 'pageNum',
  'nowPage', 'startPage', 'cpage', 'curPage', 'bbsPage', 'p_pageno',
];

/* 페이지 번호가 아니라 '몇 번째 글부터'를 받는 형식 — 국내 대학 CMS의 artclList.do 계열.
   연세·외대·가천이 이 계열이다. 한 페이지 크기는 주소에 적혀 있으면 그것을 쓴다. */
export const OFFSET_PARAM = 'article.offset';
export const LIMIT_PARAMS = ['articleLimit', 'pageUnit', 'pageSize', 'rows'];
export const DEFAULT_LIMIT = 10;

function limitOf(u) {
  for (const k of LIMIT_PARAMS) {
    const v = Number(u.searchParams.get(k));
    if (Number.isFinite(v) && v > 0) return v;
  }
  return DEFAULT_LIMIT;
}

/* 이 주소가 이미 페이지 파라미터를 갖고 있나 — 있으면 그것만 바꾸면 되므로 확실하다 */
export function existingPageParam(url) {
  try {
    const u = new URL(url);
    if (u.searchParams.has(OFFSET_PARAM)) return { kind: 'offset', param: OFFSET_PARAM, limit: limitOf(u) };
    for (const p of PAGE_PARAMS) if (u.searchParams.has(p)) return { kind: 'page', param: p };
    return null;
  } catch { return null; }
}

/* 주소 모양으로 '이 게시판은 어느 계열인가'를 짐작해 후보 순서를 정한다.
   짐작이 틀려도 손해는 1페이지를 한 번 더 받는 것뿐이고, samePage가 걸러 낸다. */
function guessOrder(url) {
  const s = String(url);
  if (/artclList\.do|\/subview\.do/.test(s)) return [{ kind: 'offset', param: OFFSET_PARAM, limit: DEFAULT_LIMIT }, ...PAGE_PARAMS.map((param) => ({ kind: 'page', param }))];
  // 전자정부 표준프레임워크 계열(list.do?menuNo=…)은 pageIndex를 쓴다
  if (/list\.do/.test(s)) return [{ kind: 'page', param: 'pageIndex' }, { kind: 'page', param: 'page' }, ...PAGE_PARAMS.filter((p) => p !== 'pageIndex' && p !== 'page').map((param) => ({ kind: 'page', param }))];
  return PAGE_PARAMS.map((param) => ({ kind: 'page', param }));
}

/* 한 페이지 주소를 만든다. pageNo는 1부터. */
export function pageUrl(url, pageNo, way) {
  try {
    const u = new URL(url);
    if (way.kind === 'offset') {
      const limit = way.limit || limitOf(u) || DEFAULT_LIMIT;
      u.searchParams.set(OFFSET_PARAM, String((pageNo - 1) * limit));
      return u.href;
    }
    u.searchParams.set(way.param, String(pageNo));
    return u.href;
  } catch { return null; }
}

/* 시도할 후보들. 이미 아는 방식(learned)이 있으면 그것만 쓴다 — 매일 헤매지 않으려는 것. */
export function pageCandidates(url, pageNo, learned) {
  if (learned && learned.ok === false) return [];                 // 이 게시판은 페이지가 안 넘어간다
  if (learned && learned.way) return [{ way: learned.way, url: pageUrl(url, pageNo, learned.way) }].filter((c) => c.url);
  const found = existingPageParam(url);
  const ways = found ? [found] : guessOrder(url);
  return ways.map((way) => ({ way, url: pageUrl(url, pageNo, way) })).filter((c) => c.url && c.url !== url);
}

/* 받아 온 목록이 1페이지와 사실상 같은가 — 같으면 게시판이 그 파라미터를 무시한 것이다.
   완전히 같을 때만 보지 않는 이유: 고정 공지는 모든 페이지에 그대로 얹혀 오는 게시판이
   있어서, 겹침이 조금 있는 것은 정상이다. 그래서 **새 항목이 거의 없을 때**만 같다고 본다. */
export function samePage(firstKeys, nextKeys, threshold = 0.2) {
  const a = new Set(firstKeys || []);
  const b = [...new Set(nextKeys || [])];
  if (!b.length) return true;                        // 아무것도 안 왔으면 다음 페이지가 없는 것
  const fresh = b.filter((k) => !a.has(k)).length;
  return fresh / b.length < threshold;               // 새 항목이 20% 미만이면 '같은 페이지'
}

/* 페이지 넘기기 기록 — 알아낸 방식과 '안 되는 게시판'을 적어 둔다.
   안 되는 게시판도 영구 포기는 아니다: 게시판은 개편되므로 RETRY_DAYS 뒤에 한 번 더 본다
   (링크 사냥꾼의 '영구 포기는 없다'와 같은 태도). */
export const RETRY_DAYS = 14;

export function shouldRetry(learned, today = new Date()) {
  if (!learned || learned.ok !== false) return true;
  if (!learned.checkedAt) return true;
  const days = (today - new Date(learned.checkedAt)) / 86400000;
  return days >= RETRY_DAYS;
}

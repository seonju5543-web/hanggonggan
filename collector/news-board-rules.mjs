/* ============================================================
   교내 소식 — 목록 행이 진짜 링크가 아닌 게시판의 규칙 **한 곳** (2026-10-01)
   수집 로봇(collect-news.mjs)·찾기 로봇(find-news-boards.mjs)·관문(verify/test-collector.mjs 「교내 소식」)이 같이 쓴다.

   왜 있나 — 6차 실행까지 11개교가 '날짜 붙은 글 줄 0행'이었다. 진단(find-news-boards-report.md 「생김새」)을 보니 넷은
   줄에 날짜도 제목도 있는데 **제목이 <a href> 가 아니라 onclick / data-id 로 상세를 연다**(동국·WISE·서울교대·전북).
   장학 수집기(collect.mjs BOARD_RULES)가 같은 학교를 같은 꼴로 이미 읽고 있어 그 규칙을 소식 게시판에 옮겼다.

   🔴 상세 주소를 **유추하지 않는다** — 여기 적힌 꼴은 전부 (a) 사이트가 제 페이지에 그대로 적어 둔 주소이거나
      (b) 장학 수집기가 2026-08-02 실제로 눌러 받아 적은 것이다(근거는 각 규칙의 evidence). 그래도 게시판마다 bbsId 가 다르므로
      **로봇이 쓰기 전에 첫 글의 상세를 실제로 열어 제목이 그 화면에 있는지 본다**(verifyRuleDetail · 안 맞으면 그 게시판은 싣지 않는다).
      규칙이 맞는지는 사람이 믿는 게 아니라 로봇이 매번 확인한다.

   꼴
     kind 'onclick' — <a onclick="goDetail(123)"> 에서 fn 으로 번호를 꺼내 detail(번호, 게시판 주소)로 상세 주소를 만든다.
     kind 'dataId'  — <a data-id="123"> 의 번호로 같은 일을 한다.
     kind 'listOnly' — 글 하나의 GET 주소가 **없는** 게시판(경희: 누르면 POST 로 view.do · 정찰 2026-10-01). 제목+게시일은 싣되 링크는
                       목록 주소 + `#n-제목` 표식으로 둔다 — 앱이 「게시판 목록 ↗」 로 정직하게 적는다(app.js isBoardListLink · 장학 공고와 같은 관례).
                       상세가 없으니 verifyRuleDetail 은 건너뛴다(목록 자체를 방금 읽었다).
   글 줄 뽑기는 board-links.mjs extractDatedRows 그대로(날짜 붙은 줄 · 되풀이되는 주소 꼴)이고, 링크를 푸는 눈만 바꾼다(resolve).
   그래서 게시일(postedAt)·메뉴 거르기·첨부 제외가 href 게시판과 똑같이 적용된다.
   ============================================================ */
import { extractDatedRows } from './board-links.mjs';
import { fetchBoard } from './fetch-board.mjs';

/* 동국대 두 캠퍼스: 목록 주소 …/article/<게시판>/list → 상세 …/article/<게시판>/detail/<번호>.
   근거: 찾기 로봇(2026-10-01)이 사이트 안 링크를 따라 /article/GENERALNOTICES/detail/26766449 · wise …/generalnotice/detail/520707 을
   실제로 열었다(보고서 「생김새」) — 사이트가 제 페이지에 적어 둔 주소다. 장학 게시판(JANGHAKNOTICE)도 같은 꼴이다. */
const dongguk = {
  kind: 'onclick',
  fn: /goDetail\(\s*['"]?(\d+)['"]?\s*\)/,
  detail: (id, boardUrl) => String(boardUrl).replace(/\/list(?:[?#].*)?$/, '') + `/detail/${id}`,
  evidence: '찾기 로봇이 2026-10-01 사이트 안 링크로 /article/<게시판>/detail/<번호> 를 실제로 열었다 (find-news-boards-report.md) · 장학 수집기 browser-targets 와 같은 꼴',
};

export const NEWS_BOARD_RULES = {
  /* 경희대: 행이 <a href="javascript:view('323229','')">. 정찰(2026-10-01 probe-links)에서 눌러 보니 POST 로 …/BMSR00040/view.do 가 열리고
     주소에 번호가 없다 — 글 하나로 가는 GET 주소를 만들 수 없다(짐작하지 않는다). 목록 주소 + #n-제목 표식만 둔다. */
  '경희대학교': {
    kind: 'listOnly',
    fn: /\bview\(\s*['"](\d+)['"]/,
    detail: (id, boardUrl, title) => `${String(boardUrl).split('#')[0]}#n-${encodeURIComponent(String(title || '').slice(0, 80))}`,
    evidence: '정찰 2026-10-01: 행은 href="javascript:view(번호)" · 첫 줄을 누르면 POST 로 /kor/user/bbs/BMSR00040/view.do (주소에 번호 없음) → 글 하나의 주소가 없어 목록 표식(#n-)으로만',
  },
  '동국대학교': dongguk,
  '동국대학교 WISE캠퍼스': dongguk,
  /* 서울교대: 행이 <a href="javascript:" data-id="55101" class="nttInfoBtn">. 상세는 selectNttInfo.do?mi=…&bbsId=…&nttSn=<data-id>
     (장학 게시판 mi=3004&bbsId=1083 에서 2026-08-02 실제로 열어 확인 — nttSn 이 맞고 nttNo 는 안 된다 · schools.json 메모).
     mi·bbsId 는 **그 게시판의 목록 주소에서 그대로** 가져온다(짐작하지 않는다). */
  '서울교육대학교': {
    kind: 'dataId',
    detail: (id, boardUrl) => {
      const u = new URL(boardUrl);
      const mi = u.searchParams.get('mi'); const bbsId = u.searchParams.get('bbsId');
      if (!mi || !bbsId) return null;
      return `https://www.snue.ac.kr/snue/na/ntt/selectNttInfo.do?mi=${mi}&bbsId=${bbsId}&nttSn=${id}`;
    },
    evidence: '장학 수집기 BOARD_RULES(collect.mjs)와 같은 시스템 — 2026-08-02 실제로 열어 확인한 selectNttInfo.do?…&nttSn=<번호> · mi/bbsId 는 목록 주소에서',
  },
  /* 전북대: 행이 <a href="javascript:;" onclick="pf_DetailMove('217819')">. 페이지의 pf_DetailMove 함수가 action 을
     /web/Board/<번호>/detailView.do 로 놓고 폼을 보낸다(2026-08-02 함수를 그대로 읽음 · collect.mjs BOARD_RULES). 확인된 것은 장학 목록(?category=6)뿐이라
     공지 목록에 맞는지는 아래 verifyRuleDetail 이 매번 실제로 열어 본다. */
  '전북대학교': {
    kind: 'onclick',
    fn: /pf_DetailMove\(\s*['"](\d+)['"]/,
    detail: (id, boardUrl) => { let q = ''; try { q = new URL(boardUrl).search || ''; } catch { /* 목록 주소가 없으면 꼬리 없음 */ } return `https://www.jbnu.ac.kr/web/Board/${id}/detailView.do${q}`; },
    evidence: '길 /web/Board/<번호>/detailView.do 는 페이지의 pf_DetailMove 함수(폼 action)를 그대로 읽은 것(2026-08-02 · collect.mjs BOARD_RULES). 그날 실제로 연 주소는 장학 목록의 꼬리 ?category=6 이 붙은 것이라, 꼬리는 **그 목록 주소의 것**을 그대로 옮긴다(공지 전체 sub01 은 꼬리 없음). 이 꼴이 공지 게시판에도 맞는지는 로봇이 매번 verifyRuleDetail 로 연다',
  },
};

/* 규칙 하나 → <a …> 의 속성 글자를 받아 상세 주소를 돌려주는 함수(못 풀면 null). extractDatedRows 의 resolve 옵션에 넘긴다. */
export function ruleResolver(rule, boardUrl) {
  if (!rule) return null;
  return (attrs, title) => {
    let id = null;
    if (rule.kind === 'onclick' || rule.kind === 'listOnly') {
      /* onclick="goDetail(1)" 도, href="javascript:view('1','')" 도 — 두 속성의 값을 모두 본다 */
      for (const m of attrs.matchAll(/\b(?:onclick|href)\s*=\s*(["'])((?:(?!\1)[\s\S])*)\1/gi)) {
        id = (m[2].match(rule.fn) || [])[1];
        if (id) break;
      }
    } else if (rule.kind === 'dataId') {
      id = (attrs.match(/data-id\s*=\s*["'](\d+)["']/i) || [])[1];
    }
    if (!id) return null;
    try { return rule.detail(id, boardUrl, title) || null; } catch { return null; }
  };
}

/* 이 규칙의 글에 상세 확인이 필요한가 — 목록 표식(listOnly)은 상세가 없다 */
export const needsDetailCheck = (rule) => !!rule && rule.kind !== 'listOnly';

/* 학교 이름으로 규칙을 골라 글 줄을 뽑는다 — 규칙 없는 학교는 보통 눈(href) 그대로. 두 로봇이 이 함수 하나를 부른다. */
export function datedRowsFor(school, html, boardUrl) {
  const rule = NEWS_BOARD_RULES[school];
  return extractDatedRows(html, boardUrl, rule ? { resolve: ruleResolver(rule, boardUrl) } : undefined);
}

/* 🔴 규칙으로 만든 상세 주소가 진짜인가 — 첫 글 하나를 실제로 열어 **그 글의 화면**인지 본다.
   ① 열린다 ② 최종 주소가 목록(boardUrl)으로 되돌아오지 않았다(틀린 주소를 목록으로 돌려보내는 사이트가 있다)
   ③ 화면에 그 글의 제목이 있다 ④ 목록의 **다른** 글 제목이 절반 넘게 같이 있지 않다(그건 목록 화면이다 · 이전글/다음글 한둘은 괜찮다).
   어느 하나라도 아니면 규칙이 그 게시판에 안 맞는 것이므로 **싣지 않는다**(틀린 링크 40건보다 0건이 낫다).
   비교는 공백·기호를 뺀 제목 앞 12자로(게시판 제목은 「…」 말줄임·공백 차이가 흔하다).
   @param row   확인할 글 { title, url }
   @param opts  { fetch: fetchBoard 대신 쓸 함수(관문용), boardUrl: 목록 주소, others: 목록의 다른 글 제목들 } */
export async function verifyRuleDetail(row, opts = {}) {
  const fetchFn = opts.fetch || fetchBoard;
  if (!row || !row.url) return { ok: false, reason: '확인할 글이 없음' };
  let res;
  /* 같은 학교를 방금 두드린 뒤라 한 번은 끊길 수 있다(전북 7차 실측 fetch failed) → 두 번 시도 */
  try { res = await fetchFn(row.url, { tries: 2, firstMs: 15000, retryMs: 20000 }); } catch (e) { return { ok: false, reason: `상세 열기 실패 (${(e && e.message) || e})` }; }
  if (!res || !res.ok) return { ok: false, reason: `상세 HTTP ${res ? res.status : '?'}` };
  const sameUrl = (a, b) => { try { const x = new URL(a); const y = new URL(b); return x.origin + x.pathname === y.origin + y.pathname; } catch { return false; } };
  if (opts.boardUrl && res.url && sameUrl(res.url, opts.boardUrl)) return { ok: false, reason: '상세 주소가 목록으로 되돌아옴 (규칙이 이 게시판에 안 맞음)' };
  const text = (await res.text()).replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ');
  const norm = (s) => String(s || '').replace(/&[a-z#0-9]+;/gi, ' ').replace(/[\s\p{P}\p{S}]+/gu, '');
  const page = norm(text);
  const head = norm(row.title).slice(0, 12);
  if (head.length < 4) return { ok: false, reason: '제목이 너무 짧아 대조 불가' };
  if (!page.includes(head)) return { ok: false, reason: '상세 화면에 제목이 없음 (규칙이 이 게시판에 안 맞음)' };
  const others = (opts.others || []).map((t) => norm(t).slice(0, 12)).filter((h) => h.length >= 4 && h !== head);
  if (others.length >= 3) {
    const hit = others.filter((h) => page.includes(h)).length;
    if (hit > others.length / 2) return { ok: false, reason: `상세가 아니라 목록 화면 (다른 글 제목 ${hit}/${others.length} 이 함께 보임)` };
  }
  return { ok: true, reason: `상세를 열어 제목 확인 (${row.url})` };
}

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
     kind 'json'    — 목록을 화면이 아니라 API 로 받는 게시판(서강 SPA · 정찰 2026-10-01 이 화면이 부른 요청에서 열쇠를 읽었다). link:'list' 면 글 주소 대신 목록 표식.
     kind 'post'    — 목록을 POST API 로 받는 게시판(중앙 · 정찰이 본문까지 적었다). 응답 HTML 을 같은 눈(날짜 줄)으로 읽고 onclick 번호로 상세를 만든다.
                      상세 본문도 스크립트가 API 로 받는 곳(중앙·서강)은 확인(verifyApi)도 그 API 로 한다.
     kind 'listOnly' — 글 하나의 GET 주소가 **없는** 게시판(경희: 누르면 POST 로 view.do · 정찰 2026-10-01). 제목+게시일은 싣되 링크는
                       목록 주소 + `#n-제목` 표식으로 둔다 — 앱이 「게시판 목록 ↗」 로 정직하게 적는다(source-link.js — 앱의 링크 이름 규칙 한 곳 · 장학 공고와 같은 관례).
                       상세가 없으니 verifyRuleDetail 은 건너뛴다(목록 자체를 방금 읽었다).
   글 줄 뽑기는 board-links.mjs extractDatedRows 그대로(날짜 붙은 줄 · 되풀이되는 주소 꼴)이고, 링크를 푸는 눈만 바꾼다(resolve).
   그래서 게시일(postedAt)·메뉴 거르기·첨부 제외가 href 게시판과 똑같이 적용된다.
   ============================================================ */
import { extractDatedRows } from './board-links.mjs';
import { fetchBoard } from './fetch-board.mjs';
import { canonUrl } from './canon-url.mjs';

/* 동국대 두 캠퍼스: 목록 주소 …/article/<게시판>/list → 상세 …/article/<게시판>/detail/<번호>.
   근거: 찾기 로봇(2026-10-01)이 사이트 안 링크를 따라 /article/GENERALNOTICES/detail/26766449 · wise …/generalnotice/detail/520707 을
   실제로 열었다(보고서 「생김새」) — 사이트가 제 페이지에 적어 둔 주소다. 장학 게시판(JANGHAKNOTICE)도 같은 꼴이다. */
const dongguk = {
  kind: 'onclick',
  fn: /goDetail\(\s*['"]?(\d+)['"]?\s*\)/,
  detail: (id, boardUrl) => String(boardUrl).replace(/\/list(?:[?#].*)?$/, '') + `/detail/${id}`,
  evidence: '찾기 로봇이 2026-10-01 사이트 안 링크로 /article/<게시판>/detail/<번호> 를 실제로 열었다 (find-news-boards-report.md) · 장학 수집기 browser-targets 와 같은 꼴',
};

/* 목록 표식 주소(#n-제목) — 글 하나의 GET 주소가 없는 게시판의 링크. 앱이 「게시판 목록 ↗」 로 정직하게 적는다(source-link.js linkShape 'marker').
   제목은 글자 단위로 80자까지(🔴 UTF-16 으로 자르면 이모지 짝이 갈라져 encodeURIComponent 가 던지고 글이 조용히 사라진다 · 리뷰 2026-10-02).
   이 주소는 **글의 열쇠가 아니다** — 같은 글인지는 게시판의 글 번호(postId)로 가린다(제목을 다듬는 규칙이 바뀌면 주소도 바뀐다). */
export function markerUrl(boardUrl, title) {
  return `${String(boardUrl).split('#')[0]}#n-${encodeURIComponent(Array.from(String(title || '')).slice(0, 80).join(''))}`;
}

export const NEWS_BOARD_RULES = {
  /* 경희대: 행이 <a href="javascript:view('323229','')">. 정찰(2026-10-01 probe-links)에서 눌러 보니 POST 로 …/BMSR00040/view.do 가 열리고
     주소에 번호가 없다 — 글 하나로 가는 GET 주소를 만들 수 없다(짐작하지 않는다). 목록 주소 + #n-제목 표식만 둔다. */
  '경희대학교': {
    kind: 'listOnly',
    fn: /\bview\(\s*['"](\d+)['"]/,
    detail: (id, boardUrl, title) => markerUrl(boardUrl, title),
    evidence: '정찰 2026-10-01: 행은 href="javascript:view(번호)" · 첫 줄을 누르면 POST 로 /kor/user/bbs/BMSR00040/view.do (주소에 번호 없음) → 글 하나의 주소가 없어 목록 표식(#n-)으로만',
  },
  /* 서울시립대: 목록은 SSO 익명 확인을 거쳐야 글이 온다(정찰 2026-10-01: list.do → sso_index → … → list.do?…&identified=anonymous& 가 최종 주소 · 로봇은 그 최종 주소를 후보로 둔다).
     행은 <a href="javascript:fnView('1', '31583')"> 이고 첫 줄을 누르면 아래 주소(seq 만 다름)가 열렸다 — 그 주소를 그대로 옮긴다. */
  '서울시립대학교': {
    kind: 'onclick',
    fn: /fnView\(\s*['"]\d+['"]\s*,\s*['"](\d+)['"]/,
    detail: (id, boardUrl) => {
      let lid = 'FA1'; try { lid = new URL(boardUrl).searchParams.get('list_id') || lid; } catch { /* 목록 주소가 없으면 일반공지 */ }
      return `https://www.uos.ac.kr/korNotice/view.do?list_id=${lid}&seq=${id}&sort=1&pageIndex=1&searchCnd=&searchWrd=&cate_id=&viewAuth=Y&writeAuth=Y&board_list_num=10&lpageCount=12&menuid=2000005009002000000&identified=anonymous&`;
    },
    evidence: '정찰 2026-10-01 2차: 행 href="javascript:fnView(\'1\', \'31583\')" · 첫 줄 클릭 → korNotice/view.do?list_id=FA1&seq=31583&…&identified=anonymous& (seq 만 바뀜) · 목록은 identified=anonymous 가 붙은 최종 주소',
  },
  /* 서강대: SPA 라 목록 HTML 에 글이 없고 화면이 API 를 부른다 — 정찰 2차: GET /api/api/v1/mainKo/BbsData/boardList?pageNum=1&pageSize=16&bbsConfigFk=3&… (3 = 공지사항 · 장학은 141).
     정찰 3차(2026-10-02): 줄(<tr class="cursor-pointer"> · 링크 없음)을 누르니 /ko/detail/550598?bbsConfigFk=3&namepage=announcement&text=…&redirect=/ko/announcement 로 갔다
     (550598 = API 의 pkId) — 그 주소를 번호만 바꿔 쓴다. 그 화면은 SPA 라 본문을 GET …/BbsData?pkId=<번호> 로 받는다 → 상세 확인도 그 API 로 한다. */
  '서강대학교': {
    kind: 'json',
    page: 'https://www.sogang.ac.kr/ko/announcement',   // 정찰 2차: 이 화면이 아래 API 를 불렀다 (찾기 로봇은 이 화면만 받는다)
    api: 'https://www.sogang.ac.kr/api/api/v1/mainKo/BbsData/boardList?pageNum=1&pageSize=30&bbsConfigFk=3',
    detail: (id) => `https://www.sogang.ac.kr/ko/detail/${id}?bbsConfigFk=3&namepage=announcement&text=%ED%95%99%EC%82%AC+%EC%A7%80%EC%9B%90&data=%255B%255D&title=%EA%B3%B5%EC%A7%80%EC%82%AC%ED%95%AD&redirect=/ko/announcement`,
    verifyApi: { idFrom: (url) => (String(url).match(/\/ko\/detail\/(\d+)/) || [])[1], api: (id) => `https://www.sogang.ac.kr/api/api/v1/mainKo/BbsData?pkId=${id}` },
    evidence: '정찰 3차 2026-10-02: 공지 줄을 누르니 /ko/detail/550598?bbsConfigFk=3&namepage=announcement&text=%ED%95%99%EC%82%AC+%EC%A7%80%EC%9B%90&data=%255B%255D&title=%EA%B3%B5%EC%A7%80%EC%82%AC%ED%95%AD&redirect=/ko/announcement (550598 = 목록 API 의 pkId) · 그 화면이 GET …/BbsData?pkId=550598 로 본문을 받았다',
  },
  /* 고려대: 행은 <a href="#1" onclick="jf_view('000060000000061451','1','ko');">. 정찰 3차(2026-10-02)에서 누르니
     /ko/566/subview.do?enc=<base64("fnct1|@@|" + encodeURIComponent("/portalBoard/ko/1/<번호>/portalBoardView.do?siteId=ko&type=&…&findWord=&"))> 로 갔다 —
     그 주소를 번호만 바꿔 똑같이 만든다(관문이 정찰이 받아 온 주소와 글자 하나까지 대조한다). 목록 566(일반공지 · fnctNo=1)에서 본 꼴이라 다른 목록 주소면 만들지 않는다.
     ⚠️ 로봇이 받는 HTML 에 목록 줄이 없었던 이유(화면은 줄이 있다)는 아직 모른다 — 정찰 4차가 '서버가 보낸 HTML' 을 잰다. 줄이 없으면 이 규칙은 아무것도 만들지 않는다. */
  '고려대학교': {
    kind: 'onclick',
    fn: /jf_view\(\s*['"](\d+)['"]\s*,\s*['"]1['"]/,
    detail: (id, boardUrl) => {
      if (!/^https:\/\/www\.korea\.ac\.kr\/ko\/566\/subview\.do/.test(String(boardUrl))) return null;
      const inner = `/portalBoard/ko/1/${id}/portalBoardView.do?siteId=ko&type=&id=&articleId=&page=&startDate=&endDate=&findType=&findWord=&`;
      return `https://www.korea.ac.kr/ko/566/subview.do?enc=${encodeURIComponent(Buffer.from(`fnct1|@@|${encodeURIComponent(inner)}`).toString('base64'))}`;
    },
    /* 상세 본문은 화면이 POST /portalBoard/ko/1/<번호>/portalBoardView.do 로 받는다(정찰 3·4차가 본문까지 적었다) — 확인도 그 요청 그대로 */
    verifyApi: {
      idFrom: (url) => { try { return (decodeURIComponent(Buffer.from(decodeURIComponent(new URL(url).searchParams.get('enc') || ''), 'base64').toString()).match(/\/portalBoard\/ko\/1\/(\d+)\//) || [])[1]; } catch { return undefined; } },
      api: (id) => `https://www.korea.ac.kr/portalBoard/ko/1/${id}/portalBoardView.do`,
      body: () => 'siteId=ko&type=&id=&articleId=&page=&layout=6b6f40403536364040666e637431&startDate=&endDate=&findType=&findWord=',
    },
    evidence: '정찰 3차 2026-10-02: 첫 줄 jf_view(\'000060000000061451\',\'1\',\'ko\') 을 누르니 /ko/566/subview.do?enc=Zm5jdDF8QEB8JTJGcG9ydGFsQm9hcmQlMkZrbyUyRjElMkYwMDAwNjAwMDAwMDAwNjE0NTElMkZwb3J0YWxCb2FyZFZpZXcuZG8lM0Z…%3D%3D (번호만 바뀌는 꼴)',
  },
  /* 중앙대: 목록·상세 모두 스크립트가 POST 로 받는다(정찰 2차가 본문까지 적었다). 행은 href="javascript:fn_goDetail('30220','N','','N')" ·
     첫 줄 클릭 → BoardView.do?MENU_ID=100&CONTENTS_NO=1&SITE_NO=2&P_TAB_NO=&TAB_NO=&BOARD_SEQ=4&BOARD_CATEGORY_NO=&BBS_SEQ=30220&pageNo=1 (BBS_SEQ 만 바뀜).
     그 화면의 본문은 POST ajax/FR_SVC/BoardViewData.do 가 채우므로 제목 확인도 그 API 로 한다. */
  '중앙대학교': {
    kind: 'post',
    page: 'https://www.cau.ac.kr/cms/FR_CON/index.do?MENU_ID=100',   // 정찰 2차: 이 화면이 아래 API 를 불렀다 (찾기 로봇은 이 화면만 받는다)
    api: 'https://www.cau.ac.kr/ajax/FR_SVC/BBSViewList2.do',
    /* 응답은 JSON(`BBS_SEQ`·`SUBJECT`) — SESSIONS.md 「중앙대 게시판 사실(재조사 금지)」. 9차는 HTML 로 읽어 0행이었다(리뷰 2026-10-02).
       날짜 칸 이름은 기록에 없다 — 아래 DATE_KEYS 중 있는 것을 쓰고 없으면 게시일을 비운다(지어내지 않는다 · 정찰이 응답을 적게 해 두었다). */
    jsonFields: { id: ['BBS_SEQ'], title: ['SUBJECT'] },
    body: 'pageNo=1&pagePerCnt=15&MENU_ID=100&SITE_NO=2&BOARD_SEQ=4&S_CATE_SEQ=&BOARD_TYPE=C0301&BOARD_CATEGORY_NO=&P_TAB_NO=&TAB_NO=&P_CATE_SEQ=&CATE_SEQ=&SEARCH_FLD=SUBJECT&SEARCH=',
    fn: /fn_goDetail\(\s*['"](\d+)['"]/,
    detail: (id) => `https://www.cau.ac.kr/cms/FR_CON/BoardView.do?MENU_ID=100&CONTENTS_NO=1&SITE_NO=2&P_TAB_NO=&TAB_NO=&BOARD_SEQ=4&BOARD_CATEGORY_NO=&BBS_SEQ=${id}&pageNo=1`,
    verifyApi: { idFrom: (url) => (String(url).match(/BBS_SEQ=(\d+)/) || [])[1], api: () => 'https://www.cau.ac.kr/ajax/FR_SVC/BoardViewData.do', body: (id) => `MENU_ID=100&SITE_NO=2&BOARD_SEQ=4&BBS_SEQ=${id}&P_TAB_NO=&CONTENTS_NO=1&BOARD_CATEGORY_NO=&P_TAB_NO=&TAB_NO=&pageNo=1` },
    evidence: '정찰 2026-10-01 2차: 화면이 부른 요청 POST ajax/FR_SVC/BBSViewList2.do(본문 기록) · 첫 줄 클릭 → BoardView.do?…&BBS_SEQ=30220&pageNo=1 · 상세 본문은 POST BoardViewData.do',
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
  /* 경북대 학사공지: 행이 <a href="javascript:doRead('stu_812', 'top', '11790921912463');">. 정찰 6차(2026-10-03)에서 첫 줄을 링크로 누르니
     stdViewBtin.action?search_type=&search_text=&popupDeco=&note_div=top&bltn_no=11790921912463&menu_idx=42&bbs_cde=stu_812 이 열렸다 —
     doRead 의 세 값(게시판·구분·글 번호)이 그 주소의 bbs_cde·note_div·bltn_no 로 **그대로** 갔다. 그 꼴을 값만 바꿔 쓴다(menu_idx 는 목록 주소의 것).
     ⚠️ 정찰이 누른 첫 줄은 상단 고정(note_div=top)이었다 — 보통 줄의 구분 값으로도 열리는지는 아직 아무도 안 눌러 봤다 →
        verifyLast: 로봇이 첫 글과 **마지막 글**(보통 줄)을 둘 다 열어 본다. 하나라도 그 글 화면이 아니면 이 게시판은 싣지 않는다. */
  '경북대학교': {
    kind: 'onclick',
    fn: /doRead\(\s*['"](?<bbs>[\w-]+)['"]\s*,\s*['"](?<note>\w*)['"]\s*,\s*['"](?<id>\d+)['"]\s*\)/,
    detail: (id, boardUrl, title, g = {}) => {
      let menu = null; try { const u = new URL(boardUrl); if (u.origin + u.pathname === 'https://www.knu.ac.kr/wbbs/wbbs/bbs/btin/stdList.action') menu = u.searchParams.get('menu_idx'); } catch { /* 목록 주소가 아니면 만들지 않는다 */ }
      if (!menu || !g.bbs) return null;
      return `https://www.knu.ac.kr/wbbs/wbbs/bbs/btin/stdViewBtin.action?search_type=&search_text=&popupDeco=&note_div=${encodeURIComponent(g.note || '')}&bltn_no=${id}&menu_idx=${encodeURIComponent(menu)}&bbs_cde=${encodeURIComponent(g.bbs)}`;
    },
    verifyLast: true,
    evidence: '정찰 6차 2026-10-03: 행 href="javascript:doRead(\'stu_812\', \'top\', \'11790921912463\');" · 첫 줄을 링크로 누르니 → https://www.knu.ac.kr/wbbs/wbbs/bbs/btin/stdViewBtin.action?search_type=&search_text=&popupDeco=&note_div=top&bltn_no=11790921912463&menu_idx=42&bbs_cde=stu_812 (그 글 화면 · 로그인 요구 없음)',
  },
  /* 서강대 둘째 게시판 「서강 Story > 행사특강」(열쇠 '학교#이름' — collect-news.mjs 의 extraBoards). 첫 게시판(공지사항 · 열쇠 3)은 6월 30일 뒤 새 글이 드물다.
     정찰 6차(2026-10-03): 화면이 GET …/BbsData/boardList?pageNum=1&pageSize=16&bbsConfigFk=142&… 를 불렀고(글 1,378개 · 10월 1일 글까지),
     첫 줄을 누르니 /ko/detail/551482?bbsConfigFk=142&namepage=StoryNotificationEvent&text=…&title=…&redirect=/ko/story/notification-event 로 갔다(551482 = API 의 pkId).
     본문은 첫 게시판과 같은 GET …/BbsData?pkId=<번호> 가 받았다 — 번호는 사이트 전체 번호라 첫 게시판 글과 겹치지 않는다(같은 열쇠 BbsData 하나). */
  '서강대학교#행사특강': {
    kind: 'json',
    page: 'https://www.sogang.ac.kr/ko/story/notification-event',
    api: 'https://www.sogang.ac.kr/api/api/v1/mainKo/BbsData/boardList?pageNum=1&pageSize=30&bbsConfigFk=142',
    detail: (id) => `https://www.sogang.ac.kr/ko/detail/${id}?bbsConfigFk=142&namepage=StoryNotificationEvent&text=%EC%84%9C%EA%B0%95+Story&title=%ED%96%89%EC%82%AC%ED%8A%B9%EA%B0%95&redirect=/ko/story/notification-event`,
    verifyApi: { idFrom: (url) => (String(url).match(/\/ko\/detail\/(\d+)/) || [])[1], api: (id) => `https://www.sogang.ac.kr/api/api/v1/mainKo/BbsData?pkId=${id}` },
    /* 🔴 둘째 게시판 규칙은 글 번호가 **첫 게시판과 같은 번호 공간**일 때만 둔다 — 같은 글 알아보기·숨김·썸네일 열쇠가 모두 「학교 + 글 번호」라서
       번호가 게시판마다 따로 매겨지면 다른 글이 한 글로 합쳐지고 새 글이 '이미 본 글'로 빠진다(리뷰 10-04). 서강 pkId 는 사이트 전체 번호(BbsData?pkId= 하나로 어느 게시판 글이든 열린다) */
    sharedIds: true,
    evidence: '정찰 6차 2026-10-03: /ko/story/notification-event 화면이 GET /api/api/v1/mainKo/BbsData/boardList?…&bbsConfigFk=142 (JSON 글 배열 · pkId·title·regDate) 를 불렀다 · 첫 줄을 누르니 /ko/detail/551482?bbsConfigFk=142&namepage=StoryNotificationEvent&text=%EC%84%9C%EA%B0%95+Story&title=%ED%96%89%EC%82%AC%ED%8A%B9%EA%B0%95&redirect=/ko/story/notification-event · 그 화면이 GET …/BbsData?pkId=551482 로 본문을 받았다',
  },
};

/* 규칙 열쇠 — 첫 게시판은 학교 이름, 둘째 게시판(news-sources.json extraBoards)은 '학교#게시판 이름'.
   수집 로봇의 게시판 줄({ school, board })과 실린 글({ school, board })이 같은 함수로 열쇠를 만든다(썸네일 로봇이 글의 본문 API 를 찾을 때). */
export const newsRuleKey = (x) => (x && x.board ? `${x.school}#${x.board}` : (x && x.school) || '');

/* 규칙 하나 → <a …> 의 속성 글자를 받아 { url, id }(못 풀면 null)를 돌려주는 함수. extractDatedRows 의 resolve 옵션에 넘긴다. */
export function ruleResolver(rule, boardUrl) {
  if (!rule) return null;
  return (attrs, title) => {
    let id = null; let groups = {};
    if (rule.kind === 'onclick' || rule.kind === 'listOnly' || rule.kind === 'post') {
      /* onclick="goDetail(1)" 도, href="javascript:view('1','')" 도 — 두 속성의 값을 모두 본다 */
      for (const m of attrs.matchAll(/\b(?:onclick|href)\s*=\s*(["'])((?:(?!\1)[\s\S])*)\1/gi)) {
        const hit = m[2].match(rule.fn);
        /* 값이 여럿인 함수(경북 doRead(게시판, 구분, 번호))는 이름 붙은 묶음으로 — 글 번호는 (?<id>…), 나머지는 detail 의 넷째 인자로 */
        id = hit ? ((hit.groups && hit.groups.id) || hit[1]) : null;
        if (id) { groups = (hit && hit.groups) || {}; break; }
      }
    } else if (rule.kind === 'dataId') {
      id = (attrs.match(/data-id\s*=\s*["'](\d+)["']/i) || [])[1];
    }
    if (!id) return null;
    let url = null;
    try { url = rule.detail(id, boardUrl, title, groups) || null; } catch { url = null; }
    return url ? { url, id } : null;   // id = 게시판의 글 번호 (postId — 같은 글 알아보기)
  };
}

/* 이 규칙의 글에 상세 확인이 필요한가 — 목록 표식(listOnly · link:'list')은 상세가 없다 */
export const needsDetailCheck = (rule) => !!rule && rule.kind !== 'listOnly' && rule.link !== 'list';

/* API 로 받는 목록(json·post) 인가 — 두 로봇이 이때는 목록 HTML 대신 이 모듈에 글 줄을 묻는다 */
export const fetchesOwnList = (rule) => !!rule && (rule.kind === 'json' || rule.kind === 'post');

const ymd = (v) => {
  const m = String(v || '').match(/^(20\d{2})[-./]?\s*(\d{1,2})[-./]?\s*(\d{1,2})/);
  if (!m) return '';
  const d = `${m[1]}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}`;
  return d <= new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10) ? d : '';   // 앞날은 게시일이 아니다
};
const DATE_KEYS = ['regDate', 'regDt', 'createdAt', 'date', 'REG_DATE', 'REGDATE', 'WRITE_DATE', 'WRITEDATE', 'INS_DATE', 'INSERT_DATE', 'REG_DT', 'WRITE_DT'];
const ID_KEYS = ['pkId', 'id', 'seq'];
const TITLE_KEYS = ['title', 'subject'];
const pick = (x, keys) => { for (const k of keys) if (x && x[k] != null && x[k] !== '') return x[k]; return undefined; };
/* 날짜 칸 — 흔한 이름 다음엔 이름에 date·_DT·DTTM 이 든 칸 가운데 날짜로 읽히는 첫 값 (중앙 응답의 날짜 칸 이름은 아직 정찰 기록에 없다) */
const pickDate = (x) => { const v = pick(x, DATE_KEYS); if (v != null && ymd(v)) return v; for (const [k, val] of Object.entries(x || {})) if (/date|_dt$|dttm/i.test(k) && ymd(val)) return val; return undefined; };
/* 응답 안에서 글 목록 배열을 찾는다 — 칸 이름(list·data·…)이 학교마다 달라 **글처럼 생긴 객체의 배열**(번호·제목 칸이 있는 것)을 깊이 3까지 찾는다. */
function findRows(j, idKeys, titleKeys, d = 0) {
  if (Array.isArray(j)) return j.some((x) => pick(x, idKeys) != null && pick(x, titleKeys) != null) ? j : null;
  if (!j || typeof j !== 'object' || d > 3) return null;
  for (const v of Object.values(j)) { const hit = findRows(v, idKeys, titleKeys, d + 1); if (hit) return hit; }
  return null;
}
function rowsFromJson(j, rule, boardUrl) {
  const idKeys = (rule.jsonFields && rule.jsonFields.id) || ID_KEYS;
  const titleKeys = (rule.jsonFields && rule.jsonFields.title) || TITLE_KEYS;
  const out = []; const seen = new Set();
  for (const x of findRows(j, idKeys, titleKeys) || []) {
    const title = String(pick(x, titleKeys) || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const id = pick(x, idKeys);
    if (!title || title.length < 6 || id == null) continue;
    let url; try { url = rule.detail(String(id), boardUrl, title); } catch { url = null; }
    if (!url || seen.has(String(id))) continue;
    seen.add(String(id));
    const postedAt = ymd(pickDate(x));
    out.push({ title, url, postId: String(id), ...(postedAt ? { postedAt } : {}) });
  }
  return out;
}

/* 🔴 두 로봇이 부르는 한 곳 — 학교의 규칙에 따라 글 줄을 돌려준다.
   html 게시판(규칙 없음·onclick·dataId·listOnly)은 넘겨받은 목록 HTML 을 읽고, json·post 는 API 를 직접 받는다.
   post 응답은 JSON 이면 칸으로, 아니면 HTML 조각으로(같은 눈) 읽는다.
   @returns Promise<Array<{title,url,postedAt?,postId?}>> */
export async function rowsForBoard(school, boardUrl, html, fetchFn = fetchBoard) {
  const rule = NEWS_BOARD_RULES[school];
  if (!fetchesOwnList(rule)) return datedRowsFor(school, html, boardUrl);
  const r = await fetchFn(rule.api, rule.kind === 'post' ? { body: rule.body, tries: 2, firstMs: 15000, retryMs: 20000 } : { tries: 2, firstMs: 15000, retryMs: 20000 });
  if (!r || !r.ok) throw new Error(`API HTTP ${r ? r.status : '?'}`);
  const text = await r.text();
  let j = null;
  try { j = JSON.parse(text); } catch { j = null; }
  if (j) return rowsFromJson(j, rule, boardUrl);
  if (rule.kind === 'json') throw new Error(`API 응답이 JSON 이 아님 (${text.length}자 · 앞 120자: ${text.replace(/\s+/g, ' ').slice(0, 120)})`);
  return extractDatedRows(text, boardUrl, { resolve: ruleResolver(rule, boardUrl) });
}

/* API 규칙이 받는 화면 — 찾기 로봇은 이 화면만 게시판으로 올린다(아무 화면이나 열리면 「게시판 목록 ↗」 이 엉뚱한 곳을 가리킨다 · 리뷰 2026-10-02) */
export function rulePageMatches(rule, url) {
  if (!rule || !rule.page) return true;
  try {
    const want = new URL(rule.page); const got = new URL(url);
    if (want.origin + want.pathname !== got.origin + got.pathname) return false;
    for (const [k, v] of want.searchParams) if (got.searchParams.get(k) !== v) return false;
    return true;
  } catch { return false; }
}

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
   ⑤ 만든 상세 주소와 다른 화면으로 넘어가지 않았다 ⑥ 다른 글 제목이 셋 이상 보이면 그 글 제목이 제목 자리에 있다(최근 글 띠가 붙은 다른 글 화면 배제).
   @param row   확인할 글 { title, url }
   @param opts  { fetch: fetchBoard 대신 쓸 함수(관문용), boardUrl: 목록 주소, others: 목록의 다른 글 제목들 } */
export async function verifyRuleDetail(row, opts = {}) {
  const fetchFn = opts.fetch || fetchBoard;
  if (!row || !row.url) return { ok: false, reason: '확인할 글이 없음' };
  let res;
  /* 상세 본문을 스크립트가 API 로 받는 사이트(중앙 POST BoardViewData.do · 서강 GET BbsData?pkId=)는 그 API 에 묻는다 — 화면 주소를 GET 하면 껍데기뿐이다 */
  const vp = opts.rule && opts.rule.verifyApi;
  const id = vp ? vp.idFrom(row.url) : null;   // 번호를 꺼내는 법도 규칙의 것 (공용 함수에 학교 이름표를 박지 않는다)
  if (vp && !id) return { ok: false, reason: '상세 주소에 번호가 없음' };
  /* 같은 학교를 방금 두드린 뒤라 한 번은 끊길 수 있다(전북 7차 실측 fetch failed) → 두 번 시도.
     시한은 게시판 하나의 절대 시한(45초) 안에 들도록 짧게 — 10초 + 쉼 3초 + 12초 (리뷰 2026-10-02) */
  try { res = vp ? await fetchFn(vp.api(id), { ...(vp.body ? { body: vp.body(id) } : {}), tries: 2, firstMs: 10000, retryMs: 12000 }) : await fetchFn(row.url, { tries: 2, firstMs: 10000, retryMs: 12000 }); } catch (e) { return { ok: false, reason: `상세 열기 실패 (${(e && e.message) || e})` }; }
  if (!res || !res.ok) return { ok: false, reason: `상세 HTTP ${res ? res.status : '?'}` };
  const samePath = (a, b) => { try { const x = new URL(a); const y = new URL(b); return x.origin + x.pathname === y.origin + y.pathname; } catch { return false; } };
  /* '목록으로 되돌아옴' = 요청한 주소에서 **다른 주소로 넘어갔고** 그곳이 목록 길이다. 고려처럼 상세와 목록이 같은 길(subview.do)이고 뒤 조건(?enc=)만 다른 사이트는
     넘어가지 않았으면 되돌아온 것이 아니다 (11차 실측: 고려가 이 판정에 잘못 걸려 0건 · 2026-10-03) */
  const noHash = (u) => String(u || '').split('#')[0];
  if (!vp && opts.boardUrl && res.url && noHash(res.url) !== noHash(row.url) && samePath(res.url, opts.boardUrl)) return { ok: false, reason: '상세 주소가 목록으로 되돌아옴 (규칙이 이 게시판에 안 맞음)' };
  /* 만든 상세 주소와 다른 곳(첫 화면·다른 메뉴)으로 넘어가면 그 글의 화면이 아니다 — 같은 길로 돌아오는 SSO 왕복(시립)은 괜찮다 */
  if (!vp && res.url && !samePath(res.url, row.url)) return { ok: false, reason: `상세 주소가 다른 화면으로 넘어감 (${String(res.url).slice(0, 120)})` };
  const raw = await res.text();
  const text = raw.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ');
  const norm = (s) => String(s || '').replace(/&[a-z#0-9]+;/gi, ' ').replace(/[\s\p{P}\p{S}]+/gu, '');
  const page = norm(text);
  const head = norm(row.title).slice(0, 12);
  if (head.length < 4) return { ok: false, reason: '제목이 너무 짧아 대조 불가' };
  if (!page.includes(head)) return { ok: false, reason: '상세 화면에 제목이 없음 (규칙이 이 게시판에 안 맞음)' };
  const others = (opts.others || []).map((t) => norm(t).slice(0, 12)).filter((h) => h.length >= 4 && h !== head);
  const hit = others.filter((h) => page.includes(h)).length;
  if (others.length >= 3 && hit > others.length / 2) return { ok: false, reason: `상세가 아니라 목록 화면 (다른 글 제목 ${hit}/${others.length} 이 함께 보임)` };
  /* '최근 글' 띠·옆 목록이 붙은 **다른 글**의 화면이면 제목이 본문 제목 자리에 없다 — 다른 글 제목이 셋 이상 보이면
     그 글의 제목이 제목 자리(<title>·h1~h6·og:title·tit/subject 칸)에 있을 때만 통과 (이전글/다음글 둘은 괜찮다 · 리뷰 2026-10-02) */
  if (hit >= 3 && !titleZone(raw).some((z) => norm(z).includes(head))) return { ok: false, reason: `제목이 제목 자리에 없고 다른 글 제목 ${hit}개가 함께 보임 (최근 글 띠가 붙은 다른 화면으로 보임)` };
  return { ok: true, reason: `상세를 열어 제목 확인 (${row.url})` };
}

/* 글 본문을 받을 요청 — 썸네일 로봇(collect-news-thumbs.mjs)이 쓴다 (2026-10-03).
   규칙이 본문 API 를 적어 두었으면(verifyApi — 고려 POST 조각 · 서강 BbsData · 중앙 BoardViewData) 그것, 아니면 글 주소 그대로.
   목록 표식(#n-제목 · 경희)은 글 화면이 없어 null — 주소를 지어 만들지 않는다. base 는 그림의 상대 주소를 펼 기준(글 주소). */
export function postContentRequest(rule, row) {
  if (!row || !row.url || /#n-/.test(String(row.url))) return null;
  const vp = rule && rule.verifyApi;
  if (vp) {
    const id = vp.idFrom(row.url);
    if (!id) return null;
    return { url: vp.api(id), opts: vp.body ? { body: vp.body(id) } : {}, base: row.url };
  }
  return { url: row.url, opts: {}, base: row.url };
}

/* 화면의 '제목 자리' 글자들 — <title> · h1~h6 · og:title · class/id 에 tit·subject·view_tit 가 든 칸 */
function titleZone(html) {
  const src = String(html || '');
  const out = [];
  for (const m of src.matchAll(/<title\b[^>]*>([\s\S]*?)<\/title>/gi)) out.push(m[1]);
  for (const m of src.matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi)) out.push(m[2].replace(/<[^>]+>/g, ' '));
  for (const m of src.matchAll(/<meta\b[^>]*property=["']og:title["'][^>]*content=["']([^"']*)["']/gi)) out.push(m[1]);
  for (const m of src.matchAll(/<(div|p|span|strong|td|th|dt|dd|em|li)\b[^>]*(?:class|id)=["'][^"']*(?:tit|subject|view_?head|artcl)[^"']*["'][^>]*>([\s\S]{0,600}?)<\/\1>/gi)) out.push(m[2].replace(/<[^>]+>/g, ' '));
  return out;
}

/* API 규칙의 응답 앞부분(진단용) — 0행일 때 찾기 로봇이 리포트에 적는다. 글을 만들지 않는다. */
export async function apiSample(school, fetchFn = fetchBoard) {
  const rule = NEWS_BOARD_RULES[school];
  if (!fetchesOwnList(rule)) return '';
  const r = await fetchFn(rule.api, rule.kind === 'post' ? { body: rule.body, tries: 1, firstMs: 15000 } : { tries: 1, firstMs: 15000 });
  const text = await r.text();
  return `HTTP ${r.status} · ${r.headers && r.headers.get ? (r.headers.get('content-type') || '?') : '?'} · ${text.length}자 · 앞 400자: ${text.replace(/\s+/g, ' ').slice(0, 400)}`;
}

/* 같은 글 합치기 (2026-10-02 · 리뷰: 경희 6건이 두 번씩 실렸다) — dedupeNotices(주소·제목 열쇠) 앞에 둔다.
   ① 게시판의 글 번호(postId)가 같으면 같은 글. ② 목록 표식(#n-) 글은 「목록 주소 + 제목」이 같으면 같은 글.
   ③ 옛 중복 정리(소급): 9차가 분류 꼬리표를 떼고 실은 「[X]」 는, 같은 목록에 꼬리표 붙은 「공통 [X]」·「국제 [X]」 가 **딱 하나**일 때만 그 글이다
      (둘 이상이면 서울·국제 캠퍼스의 다른 글일 수 있어 합치지 않는다 — 다른 글을 지우는 것보다 겹쳐 보이는 것이 낫다).
   남기는 모습은 가장 최근 수집분(③은 꼬리표 붙은 쪽), 수집일은 처음 본 날, 관리자 숨김은 지킨다. */
const merge2 = (a, n, keep) => {
  const first = [a.foundAt, n.foundAt].filter(Boolean).sort()[0];
  const hid = [a, n].find((x) => x.hidden);
  const pid = keep.postId || a.postId || n.postId;
  return { ...keep, ...(first ? { foundAt: first } : {}), ...(pid ? { postId: pid } : {}), ...(hid ? { hidden: hid.hidden, ...(hid.hiddenBy ? { hiddenBy: hid.hiddenBy } : {}) } : {}) };
};
export function collapseSamePost(items) {
  const out = []; const idx = new Map();
  const listOf = (n) => String(n.url || '').split('#')[0];
  for (const n of items) {
    const keys = [];
    if (n.postId) keys.push(`p|${n.school}|${n.postId}`);
    if (/#n-/.test(String(n.url || ''))) keys.push(`t|${n.school}|${listOf(n)}|${String(n.title || '').replace(/\s+/g, ' ').trim()}`);
    /* 글 번호가 둘 다 있고 다르면 제목·주소가 같아도 다른 글이다 (재검증 2026-10-02 — 같은 제목의 새 글이 옛 글에 먹혔다) */
    const hit = keys.map((k) => idx.get(k)).find((v) => v !== undefined && !(n.postId && out[v].postId && n.postId !== out[v].postId));
    if (hit === undefined) { const pos = out.push(n) - 1; keys.forEach((k) => { if (!idx.has(k)) idx.set(k, pos); }); continue; }
    const a = out[hit];
    const newer = String(n.foundAt || '') > String(a.foundAt || '') || (String(n.foundAt || '') === String(a.foundAt || '') && n.postId && !a.postId) ? n : a;
    out[hit] = merge2(a, n, newer);
    keys.forEach((k) => { if (!idx.has(k)) idx.set(k, hit); });
  }
  /* ③ 꼬리표를 뗀 옛 사본 */
  const badged = new Map();
  out.forEach((n, i) => {
    if (!/#n-/.test(String(n.url || ''))) return;
    const m = String(n.title || '').match(/^([가-힣]{2,4})\s+(\[[\s\S]*)$/);
    if (!m) return;
    const k = `${n.school}|${listOf(n)}|${m[2].trim()}`;
    badged.set(k, (badged.get(k) || []).concat(i));
  });
  const drop = new Set();
  out.forEach((n, i) => {
    if (!/#n-/.test(String(n.url || '')) || !/^\[/.test(String(n.title || ''))) return;
    const c = badged.get(`${n.school}|${listOf(n)}|${String(n.title).trim()}`) || [];
    if (c.length !== 1) return;
    if (n.postId && out[c[0]].postId && n.postId !== out[c[0]].postId) return;   // 글 번호가 둘 다 있고 다르면 다른 글이다 (검증 2026-10-02)
    out[c[0]] = merge2(out[c[0]], n, out[c[0]]);
    drop.add(i);
  });
  return out.filter((_, i) => !drop.has(i));
}

/* 관리자가 숨긴 소식인가 — 수집 로봇(발행)과 관리자 저장 경로(tools/admin-apply.mjs)가 같이 쓴다 (리뷰 12차).
   글 번호가 있으면 **학교|글 번호**(cfg.hidePosts)로 본다. 목록 표식(#n-제목) 주소는 같은 제목의 다른 글과 같아 주소로는 가리지 않는다
   (주소로 숨기면 내년에 다시 올라온 같은 제목의 글까지 숨었다). 그 밖은 주소(cfg.hideUrls). */
export const newsPostKey = (n) => `${n.school}|${n.postId}`;
/* 열쇠(주소·제목)가 같아도 다른 글인가 — 글 번호가 둘 다 있고 다르면 다른 글 (dedupeNotices 의 distinct · 발행과 git 병합기가 같이 쓴다) */
export const newsDistinct = (a, b) => !!(a.postId && b.postId && a.postId !== b.postId);
export function newsHidden(n, cfg = {}) {
  if (n.postId && (cfg.hidePosts || []).includes(newsPostKey(n))) return true;
  if (n.postId && /#n-/.test(String(n.url || ''))) return false;
  const u = canonUrl(n.url);
  return (cfg.hideUrls || []).some((x) => canonUrl(x) === u);
}

/* ============================================================
   교내 소식 판정 — **한 곳** (2026-09-30 · 개발자 지시 "사용자들 학교에 맞춘 교내 뉴스를 앱 내에 추가")
   뉴스 수집 로봇(collect-news.mjs)·관리자(admin-apply.mjs)·관문(verify/test-collector.mjs 「교내 소식」)이 같이 쓴다.
   규칙을 여기 밖에 다시 적지 말 것 — 두 벌이 갈라지면 같은 글이 로봇과 검사에서 다른 말을 한다
   (activity-kind.mjs 와 같은 이유).

   무엇을 가르나 — 학교 공지 게시판의 글 **제목만** 보고 둘을 정한다.
     ① 이 글이 '교내 소식'으로 실릴 글인가 (`isNewsRow`) — 장학·대외활동·공모전 글은 **다른 피드가 맡는다**
        (장학 피드·대외활동 탭). 옆 메뉴·첨부 파일 링크·결과 발표 잡음도 뺀다.
     ② 실린다면 어느 갈래인가 (`newsKind`) — 학사 · 행사 · 채용 · 생활 · null(못 가른다).
        갈래는 카드 윗줄의 **꼬리표**일 뿐 거르기 축이 아니다. 못 가르면 null — 억지로 '기타'라고 적지 않는다.

   🔴 원칙 8-1(추론 금지)을 여기서도 지킨다 — 제목이 말하지 않는 것(마감·대상·날짜)은 만들지 않는다.
      뉴스 글은 **제목 + 링크 + 수집일**만 싣는다. 상세를 읽지 않으므로 발췌·마감이 없다.
   ⚠️ 낱말을 넓힐 때는 관문의 「아니다」 예시부터 늘리고 red-green 으로 잰다.
   ============================================================ */

export const NEWS_KINDS = ['학사', '행사', '채용', '생활'];

/* 장학 낱말 — collect.mjs 의 KEYWORDS 와 같은 그물을 **넘겨받는다**(opts.scholarship). 여기 베끼지 않는다. */
/* 대외활동·공모전 판정 — activity-kind.mjs 의 함수를 **넘겨받는다**(opts.activityKind). */

/* 옆 메뉴 — **clean-title 의 isMenuEntry 를 쓰지 않는다** (2026-09-30). 그 규칙은 장학 공고용이라 '연도·날짜·번호가 없는 …안내/…공지'를
   옆 메뉴로 본다. 공지 게시판 글은 「도서관 열람실 운영시간 변경 안내」처럼 날짜 없는 제목이 흔해 그 규칙이면 소식이 통째로 빠진다
   (관문 「교내 소식」이 실측 예시로 잰다). 여기서는 **길잡이 낱말 그 자체**만 메뉴로 본다. */
const NAV_ONLY = /^(?:공지사항|일반\s*공지|학사\s*공지|전체\s*공지|주요\s*공지|공지|소식|뉴스|더\s*보기|더보기|목록|목록\s*보기|이전|다음|처음|마지막|홈|home|list|more|prev|next|notice|news)$/i;
/* 게시판 둘레의 길잡이 글귀 — 글이 아니다. 낱말을 늘릴 때는 관문의 「싣는다」 예시(「총장 담화문」)가 살아 있는지 같이 본다. */
const NAV_PHRASE = /오시는\s*길|찾아오시는|사이트맵|캠퍼스\s*맵|개인정보|이용약관|로그인|회원\s*가입|바로가기|홈페이지$|학사일정$|조직도|연혁|인사말|총장실$|대학소개|전화번호|이메일\s*무단|저작권|모바일\s*(?:버전|앱)|영문\s*(?:홈|사이트)|english$/i;

/* 실을 글이 아니다 — 게시판 껍데기·결과 발표·정정 같은 잡음. '결과'는 학생에게 뉴스가 아니라 이미 뽑힌 사람의 안내다.
   2026-10-05 점검 news-12 — 「최종 합격자 알림/안내」·「선발 결과 안내」·「선정 결과」(뒤 동사 없이)·「최종 결과 발표」가 빠져 6건이 실렸다.
   🔴 '결과 안내' 전반은 넣지 않는다 — 「경기 일정 및 결과 안내」·「인성검사(1차) 결과 안내」는 학생 소식이다(관문 health-gates/qfeeds.mjs ⑥). */
const NOT_NEWS = /^RSS\b|RSS\s*2\.0|메인으로\s*이동|개인정보\s*처리\s*방침|\[제\d+-\d+호\]|(?:물품|기자재|컴퓨터|장비|태블릿|소모품)[^\n]{0,30}(?:구입|구매)|구매\s*(?:공고|입찰)|합격자\s*(?:발표|명단|공지|공고|알림|안내)|(?:선발|선정)\s*결과|선정\s*자\s*(?:발표|안내|공지)|최종\s*(?:합격|선정|결과)\s*발표|정정\s*공고|재공고|입찰|낙찰|계약\s*(?:공고|체결)|견적|사업자\s*선정|용역\s*(?:공고|입찰)|개찰|수의계약/;

/* 갈래 — 순서가 규칙이다. 학사가 먼저(‘수강신청 설명회’는 행사보다 학사다), 채용은 행사보다 뒤(‘채용 설명회’는 행사). */
const KIND_RE = [
  ['학사', /수강\s*신청|수강\s*정정|수강\s*철회|성적|학점|등록금\s*(?:납부|고지|분납|납입)|등록\s*(?:기간|안내)|휴학|복학|자퇴|제적|졸업\s*(?:요건|사정|유예|신청|예정)|학위|전과|복수\s*전공|부전공|융합\s*전공|연계\s*전공|계절\s*학기|계절\s*수업|기말\s*(?:고사|시험)|중간\s*(?:고사|시험)|시험\s*(?:일정|시간표)|학사\s*(?:일정|안내|공지|제도)|강의\s*(?:평가|시간표|계획서)|교양\s*(?:과목|교과)|전공\s*(?:과목|교과)|폐강|분반|재수강|학기\s*개시|개강|종강|학사\s*경고|입학식|졸업식|학생증|증명서\s*발급/],
  ['행사', /설명회|특강|세미나|심포지엄|포럼|축제|대동제|콘서트|공연|전시(?:회)?|박람회|페어|페스티벌|워크숍|워크샵|강연|초청\s*강의|토크\s*콘서트|체육\s*대회|경기\s*안내|개최\s*안내|행사\s*(?:안내|개최|참여)|기념식|간담회|오리엔테이션|OT\b|개관\s*기념/i],
  ['채용', /채용|구인|모집\s*공고.*(?:직원|조교|연구원|교수|강사|교원)|(?:직원|조교|연구원|교수|강사|교원|계약직|기간제|근로\s*학생|근로장학생|학생\s*조교|아르바이트).*(?:모집|채용|공고)|임용|초빙/],
  ['생활', /도서관|열람실|기숙사|생활관|학생\s*식당|학식|셔틀|통학\s*버스|주차|건물\s*(?:공사|폐쇄|출입)|공사\s*안내|정전|단수|휴관|개관|운영\s*(?:시간|안내)|보건|건강\s*검진|예방\s*접종|보험|학생증\s*발급|와이파이|Wi-?Fi|무선랜|네트워크\s*(?:점검|장애)|시스템\s*점검|서비스\s*중단|포털\s*점검|분실물|안전\s*(?:안내|교육)|재난|폭염|한파|태풍|미세먼지|흡연|캠퍼스\s*(?:환경|안내)/i],
];

/* @param title  게시판 글 제목(정리된 것)
   @returns '학사' | '행사' | '채용' | '생활' | null */
export function newsKind(title) {
  const t = String(title || '').trim();
  if (!t) return null;
  for (const [kind, re] of KIND_RE) if (re.test(t)) return kind;
  return null;
}

/* 이 행을 '교내 소식'으로 실을 것인가.
   @param row  { title, url }
   @param opts.scholarship   collect.mjs 의 KEYWORDS (장학 글은 장학 피드가 맡는다 — 여기 안 싣는다)
   @param opts.activityKind  activity-kind.mjs 의 activityKind (공모전·대외활동은 그 탭이 맡는다)
   @param opts.isAttachmentEntry  attachment-link.mjs (파일 링크 제외) */
export function isNewsRow(row, opts = {}) {
  const t = String((row && row.title) || '').trim();
  if (t.length < 4) return false;
  /* 길잡이 글귀는 **짧은 제목**에만 — 「개인정보보호 교육 이수 안내」 같은 진짜 글을 먹지 않게 (리뷰 2026-10-01) */
  if (NAV_ONLY.test(t) || (t.length <= 12 && NAV_PHRASE.test(t))) return false;
  if (opts.isAttachmentEntry && opts.isAttachmentEntry(row)) return false;
  if (NOT_NEWS.test(t)) return false;
  if (opts.scholarship && opts.scholarship.test(t)) return false;
  if (opts.activityKind && opts.activityKind(t, { scholarship: opts.scholarship })) return false;
  return true;
}

/* 오늘보다 뒤인 게시일은 게시일이 아니다 — 칸을 지운다 (2026-10-05 점검 news-1).
   아주대 「어학졸업인증 …(~2027.1.22)」·방송대 2027-01-01 이 게시일로 실려, 앱이 게시일 순으로 그리는 홈 소식 띠 맨 앞에 몇 달씩 붙어 있었다
   (newsFloor 가 최근 4건을 기한과 상관없이 남기므로 30일 기한으로도 안 빠진다). board-links.mjs 는 **새로 읽는 줄**에만 '앞날은 비운다'를 걸어
   규칙형 게시판·옛 글에는 소급되지 않았다 → 발행이 새 글·실린 글 구분 없이 한 곳에서 거른다(newsFloor 앞).
   글자·제목은 바꾸지 않는다(지어내지 않는다 — 비운다). 같은 날은 남긴다. today 는 로봇의 KST 날짜(YYYY-MM-DD) · 돌려주는 것은 지운 개수 */
export function clearFuturePosted(items, today) {
  let n = 0;
  for (const it of items || []) {
    if (it && it.postedAt && String(it.postedAt) > String(today)) { delete it.postedAt; n++; }
  }
  return n;
}

/* 소식 장부(seen-news.json) 정리 (2026-10-05 점검 news-13) — 지우는 코드가 없어 하루 70~80 열쇠씩 자랐다(한 해면 약 3만 · 3MB · 하루 두 번 커밋·병합).
   수집일(값 · KST)이 today − keepDays 보다 앞이고 keep 에 없는 열쇠만 지운다. 지운 개수를 돌려준다.
   🔴 keepDays 는 게시일 상한(소식 로봇 NEWS_POSTED_MAX_DAYS 60)보다 길게 — 짧으면 아직 목록 첫 쪽에 있는 옛 글이 '새 글'로 다시 실린다.
   keep: 지금 실린 글(newsFloor 로 오래 남는 글)·이번에 목록에서 다시 본 글의 열쇠 — 지우면 그 글이 새 글로 다시 올라온다.
   canDrop(열쇠): 지워도 되는 열쇠인가 — 소식 로봇은 '이번에 목록을 읽은 게시판의 열쇠'만 허락한다(못 읽은 게시판의 날짜 없는 고정 글을 잊지 않게). */
export const SEEN_KEEP_DAYS = 90;
export function pruneSeen(seen, today, { keepDays = SEEN_KEEP_DAYS, keep = new Set(), canDrop = () => true } = {}) {
  const cut = new Date(Date.parse(`${today}T00:00:00Z`) - keepDays * 86400000).toISOString().slice(0, 10);
  let n = 0;
  for (const [k, v] of Object.entries(seen || {})) {
    if (typeof v !== 'string' || v >= cut || keep.has(k) || !canDrop(k)) continue;
    delete seen[k];
    n++;
  }
  return n;
}

/* 학교마다 가장 최근 소식 n 건 — 수집일·게시일 기한이 지나도 남긴다 (2026-10-03 개발자 지시 "소식이 0건인 학교는 없어").
   글이 드문 게시판(서강 공지사항: 6월 30일 뒤 새 글 없음)은 기한이 다 지나면 홈 첫 화면 띠가 비었다.
   🔴 오래된 고정 공지를 새로 데려오는 길이 아니다 — 수집 때 게시일 기한(60일)은 그대로라, 여기 남는 것은 **실렸던** 글뿐이다.
   숨긴 글은 세지 않는다 · 순서는 게시일(없으면 수집일) 최근 순 · 돌려주는 것은 남길 글 객체의 Set */
export function newsFloor(items, n = 4) {
  const bySchool = new Map();
  for (const it of items) {
    if (!it || it.hidden || !it.school) continue;
    if (!bySchool.has(it.school)) bySchool.set(it.school, []);
    bySchool.get(it.school).push(it);
  }
  const keep = new Set();
  for (const list of bySchool.values()) {
    list.sort((a, b) => String(b.postedAt || b.foundAt || '').localeCompare(String(a.postedAt || a.foundAt || '')));
    for (const it of list.slice(0, n)) keep.add(it);
  }
  return keep;
}

/* 이 줄이 '작성 규칙 후보'인가 — 판정 규칙 한 곳 (2026-08-23 분리)
 *
 * 🔴 순수 모듈이다. 불러와도 아무것도 실행되지 않는다 — 그래서 검사가 진짜로 돌려 볼 수 있다.
 *    (essay-playbook-learn.mjs 는 불러오는 순간 인터넷을 두드린다.)
 * 🔴 베끼지 말 것. 학습 로봇과 검사가 같은 파일을 써야 "로봇은 통과시켰는데 검사는 모르는" 일이 없다.
 */

/* 규칙처럼 생긴 문장인가 — 목록 항목이거나 권고·금지형 어미로 끝난다 */
export const LISTY = /^\s*(?:[-–—·•●▶▸◆■□▣①②③④⑤⑥⑦⑧⑨⑩]|\d{1,2}[.)])\s*/;
export const ADVICE = /(세요|야\s*합니다|야\s*한다|십시오|해야|하지\s*마|하지\s*말|것이\s*좋|좋습니다|중요합?니다|피하|권장|필수|금물|안\s*됩니다|주의|바랍니다)/;

/* 규칙 후보로 볼 수 없는 줄 — 게시판 껍데기·광고·목차 */
export const JUNK = /(로그인|회원가입|댓글|조회수|구독|광고|저작권|무단전재|이전\s*글|다음\s*글|목차|바로가기|앱\s*다운|카카오|공유하기|스크랩|이용약관|개인정보|이력서|채용\s*공고|요금제|무료로\s*시작|지금\s*시작|Chrome|주문|결제|고객센터|뉴스레터)/i;

/* 🔴 버릴 것을 열거하지 말고 '규칙임'을 증명하게 한다 (match-engine 의 REQ_SIGNAL 과 같은 계열).
   1차 실행에서 컨펌 대기 40건 중 25건이 메뉴·광고·목차였다 — 블랙리스트는 새 유형을 영영 못 잡는다.
   그래서 **글쓰기 이야기라는 증거가 줄 안에 있어야** 후보가 된다. */
/* 🔴 2026-09-05: 낱말 8개를 보탰다 — 이유는 '못 배우는 종류'가 넷이나 있었기 때문이다.
   자기소개·가치관·필요성·아이디어를 말하는 줄은 여기에 걸릴 낱말이 없어 **후보조차 되지
   못했다.** 그래서 그 종류 글을 아무리 읽혀도 규칙이 한 줄도 안 생겼다(경위는 아래 VOCAB). */
export const DOMAIN = /(자기소개서|자소서|지원서|문장|문단|단락|서술|표현|작성|소재|분량|구성|첫\s*줄|첫\s*문장|두괄식|경험|에피소드|사례|심사|평가자|면접관|지원자|장학|어필|강조|근거|구체적|솔직|진정성|통일성|일관성|군더더기|맞춤법|어휘|어미|가치관|인생관|신념|아이디어|문제\s*정의|기대\s*효과|퇴고|오탈자)/;

/** 이 줄이 규칙 후보인가 — 후보면 다듬은 문장, 아니면 null */
export function isCandidate(line) {
  const t = String(line).replace(LISTY, '').trim();
  if (t.length < 8 || t.length > 120) return null;
  if (JUNK.test(t)) return null;
  if (!/[가-힣]/.test(t)) return null;
  /* 글쓰기 이야기라는 증거가 없으면 후보가 아니다 — 위 DOMAIN 주석 참조 */
  if (!DOMAIN.test(t)) return null;
  const listy = LISTY.test(line);
  if (!listy && !ADVICE.test(t)) return null;
  return t;
}

export const TOPIC = /(자기소개서|자소서|장학금|장학생|작성법|작성-법|글쓰기|첨삭|지원서|합격|자소서작성)/;
/* 주제어가 있어도 이런 곳은 규칙이 아니라 광고·서비스다 */
/* 🔴 '예시문 모음'은 출처가 아니다 — 이 기능의 뼈대를 뒤집는 곳이다.
   1차 자동 확장에서 로봇이 **합격자소서 데이터베이스 2곳을 승격시켰다.**
   규칙이 붙은 이유는 그 집 메뉴에 '자기소개서'가 있어서였지 글에 규칙이 있어서가 아니다.
   우리가 예시문을 안 쓰기로 한 이유는 셋이다(docs/designs/essay-tailoring.md):
   ① 재단의 표절 검사 ② 저작권 ③ 모두가 같은 예시를 보면 오히려 획일화된다.
   자동으로 넓히더라도 이 선은 넘지 않는다. */
/* 🔴 무엇을 막고 무엇을 여는가 — 2026-08-24 개발자 지시로 다시 그었다.

   개발자가 원하는 것: **사람이 팁을 남기는 글 · 학생이 후기로 남기는 글**을 널리 학습.
   그래서 '후기·팁·예시가 섞인 블로그 글'은 **열어야** 한다 — 거기가 진짜 팁이 사는 곳이다.

   막아야 하는 것은 **예시문 데이터베이스**뿐이다(합격자소서를 통째로 베껴 파는 곳):
     ① 재단의 표절 검사 ② 저작권 ③ 모두가 같은 예시를 보면 획일화(docs/designs/essay-tailoring.md).
   1차 확장에서 승격됐던 것이 정확히 그런 DB 두 곳이었다(linkareer cover-letter · 검색결과).

   그래서 막는 기준을 **낱말이 아니라 구조**로 바꿨다:
     · DB 경로/도메인 (cover-letter · jasoseol · keyword= 검색결과)
     · '모음/총정리 DB' 꼴 (예시문·자소서 뒤에 '모음')
   '후기'·'팁'·'예시'가 제목에 들었다고 막지 않는다 — 그게 우리가 찾는 글이다.

   진짜 방어선은 따로 있다: 우리는 **규칙 문장만** 뽑고 예시문 자체는 한 줄도 저장하지 않는다
   (isCandidate 가 조언·규칙 어미만 통과시킨다). DB를 실수로 읽어도 규칙 0종이면 승격 안 된다. */
/* 🔴 2026-09-05: 상품 판매 페이지를 보탰다. 첨삭·AI 수정을 **파는** 페이지 2곳이 출처로
   등록돼 있었고(첨삭 상품 · 'Ai로 만든 자소서, 깔끔하게 수정해드립니다'), 그 광고 문구가
   규칙 3개의 근거로 인용돼 있었다. 파는 글은 팁이 아니다 — 위 '광고·서비스' 선과 같은 계열. */
export const NOT_SOURCE = /(login|signin|signup|join|cart|order|pay|price|\/product\/|이력서|resume|채용|recruit\b|jobkorea|saramin|cover-letter|jasoseol|keyword=|(예시문|자소서|자기소개서)\s*모음|자소서\s*데이터?베이스|(첨삭|수정)\s*해\s*드립니다)/i;

/* ── HTML 실체참조를 되돌린다 (2026-09-05) ──
   🔴 안 되돌리면 주소가 깨진다. 실제로 `?idx=17893&amp;code=1219` 가 그대로 seeds 에
      올라가 매주 헛걸음했다 — 저쪽 서버는 `amp;code` 라는 없는 칸을 받는다.
      링크를 줍는 곳(linkCandidates)에서만 쓰면 되므로 여기 둔다. */
export function decodeEntities(s) {
  return String(s)
    .replace(/&(?:amp|#38|#x26);/gi, '&')
    .replace(/&(?:quot|#34);/gi, '"')
    .replace(/&(?:apos|#39);/gi, "'")
    .replace(/&(?:lt|#60);/gi, '<')
    .replace(/&(?:gt|#62);/gi, '>');
}

/* ── 네이버 블로그는 모바일 주소로 읽는다 (2026-08-24) ──
   개발자 지시로 네이버 블로그의 장학 팁·예시 글을 학습 대상에 넣는다. 그런데 데스크톱
   주소(blog.naver.com/{id}/{no})는 **프레임 껍데기**만 오고 본문은 iframe 안에 있다.
   모바일 주소(m.blog.naver.com/{id}/{no})는 본문이 HTML 에 그대로 온다 — 그것으로 읽는다.
   (PostView.naver?blogId=..&logNo=.. 꼴도 모바일 경로로 바꾼다.) */
export function naverMobile(url) {
  let u; try { u = new URL(url); } catch { return url; }
  if (!/(^|\.)blog\.naver\.com$/.test(u.hostname)) return url;
  const pv = u.pathname.replace(/\/$/, '') === '/PostView.naver' || /PostView/i.test(u.pathname);
  if (pv) {
    const id = u.searchParams.get('blogId'); const no = u.searchParams.get('logNo');
    if (id && no) return `https://m.blog.naver.com/${id}/${no}`;
  }
  const m = u.pathname.match(/^\/([A-Za-z0-9_-]+)\/(\d+)\/?$/);
  if (m) return `https://m.blog.naver.com/${m[1]}/${m[2]}`;
  return url.replace('://blog.naver.com', '://m.blog.naver.com');
}

/** 읽은 글에서 '다음에 읽을 만한 곳' 을 줍는다 */
export function linkCandidates(html, baseUrl) {
  const out = [];
  for (const m of String(html).matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]{0,120}?)<\/a>/gi)) {
    const [, href, inner] = m;
    /* 속성이 섞여 들어오지 않게 — 1차 실행에서 `data-tiara-layer="..."` 가 제목으로 잡혔다 */
    const text = inner.replace(/<[^>]*>?/g, ' ').replace(/[\w-]+=["'][^"']*["']/g, ' ')
      .replace(/["'>]/g, ' ').replace(/\s+/g, ' ').trim();
    let abs; try { abs = new URL(decodeEntities(href), baseUrl).toString(); } catch { continue; }
    if (!/^https?:/.test(abs)) continue;
    if (NOT_SOURCE.test(abs) || NOT_SOURCE.test(text)) continue;
    /* 제목이든 주소든 이 주제라는 표시가 있어야 한다 */
    if (!TOPIC.test(text) && !TOPIC.test(decodeURIComponent(abs))) continue;
    if (abs.split('#')[0] === String(baseUrl).split('#')[0]) continue;
    out.push({ url: abs.split('#')[0], text: text.slice(0, 80) });
  }
  return out;
}


/* ── robots.txt — 남의 집 규칙을 먼저 읽는다 ──
   순수 함수로 둔 이유: 읽어 오는 일(fetch)과 해석하는 일을 가르면 **검사가 해석만 돌려 볼 수 있다.**
   `User-agent: *` 아래의 Disallow 만 본다 — 우리가 그 별표에 해당한다. */
export function parseRobots(text) {
  const rules = [];
  let mine = false;
  for (const raw of String(text || '').split('\n')) {
    const line = raw.split('#')[0].trim();
    const m = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const [, k, v] = m;
    if (/^user-agent$/i.test(k)) mine = (v.trim() === '*');
    else if (mine && /^disallow$/i.test(k) && v.trim()) rules.push(v.trim());
  }
  return rules;
}
export function robotsBlocks(rules, url) {
  let u; try { u = new URL(url); } catch { return true; }
  const path0 = u.pathname + u.search;
  return (rules || []).some((d) => d === '/' || path0.startsWith(d));
}

/* ── HTML 에서 글자만 — 태그를 지우고 줄로 자른다 ──
   🔴 순수 모듈에 둔 이유(2026-08-24 사고): 이 함수가 학습 로봇 안에 있었는데,
      출처 넓히기를 만들며 코드를 옮기다 **함께 지워졌다.** 그런데 로컬에서는 페이지가
      전부 403 이라 이 줄까지 가 보지도 못하고 '통과'로 보였고, Actions 에서 처음으로
      `ReferenceError: toLines is not defined` 가 났다.
      = **못 읽어서 안 터진 것을 잘 된 것으로 읽은 것**이다(이 저장소가 여러 번 겪은 유형).
      이제 검사가 실제로 이 함수를 돌려 본다 — verify/verify-essay-ask.mjs [13]. */
export function toLines(html) {
  const body = String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<\/(p|div|li|h[1-6]|br|tr)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ');
  /* 실체참조는 한 곳에서만 되돌린다 — 여기와 링크 줍는 곳이 다른 목록을 쓰면 갈라진다 */
  const text = decodeEntities(body);
  return text.split(/\n+/).map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
}

/* ── 우리 규칙 어휘 — 뽑은 문장이 '이미 아는 규칙'을 말하고 있나 ──
   🔴 2026-09-05 에 학습 로봇 안에서 이리로 옮겼다. 옮긴 이유가 곧 이 파일이 있는 이유다:
      학습 로봇은 **불러오는 순간 인터넷을 두드려** 검사가 돌려 볼 수 없다. 그래서
      "규칙이 모자란 종류가 왜 안 채워지나"를 아무도 기계로 확인하지 못했다.

   🔴 여기 없는 종류는 영영 못 배운다 — 2026-09-05 에 밝혀진 것.
      리포트는 만들어진 뒤 줄곧(2026-08-23~09-05, 실행 7회) "`intro`·`value`·`effect`·`idea` 는 전용 규칙이 없습니다.
      그 종류 글 주소를 seeds 에 넣어 주세요"라고 안내해 왔지만, **주소를 넣어도 생기지
      않았다.** 붙일 어휘가 여기 없으면 그 종류 문장은 전부 '컨펌 대기'로만 쌓인다.
      → 종류를 새로 만들 때는 essay-ask.js 의 ESSAY_KINDS 와 여기를 **함께** 늘린다.
      관문: verify/verify-essay-guard.mjs 가 두 목록을 맞춰 본다. */
export const VOCAB = {
  'lead-first': [/두괄식/, /결론부터/, /첫\s*문장/, /맨\s*앞에.*핵심/, /핵심을?\s*먼저/],
  'show-dont-tell': [/성실합니다/, /공허/, /말하기만/, /~한\s*사람입니다/, /규정하지/, /단정적/],
  'concrete-scene': [/구체적/, /수치/, /장면/, /사례/, /경험을?\s*들어/, /에피소드/],
  'answer-the-question': [/질문을?\s*(꼼꼼히|정확히)/, /묻는\s*것에/, /문항/, /질문에\s*맞는/],
  'know-the-foundation': [/재단/, /취지/, /설립\s*목적/, /인재상/, /선발\s*기준/, /미리\s*공부/],
  'direction': [/방향성/, /목표/, /계획/, /진로/, /포부/],
  'no-cliche': [/진부/, /상투/, /흔한\s*표현/, /남발/, /속담/, /명언/, /금칙어/, /금지어/],
  'no-self-pity': [/부정적인\s*표현/, /자기\s*비하/, /낮추는/, /겸손/],
  'motive-need-then-plan': [/지원\s*동기/, /신청\s*사유/, /왜\s*필요/],
  'growth-lesson': [/성장\s*과정/, /가정\s*환경/, /어린\s*시절/],
  'character-evidence': [/장단점|장\s*·?\s*단점/, /성격/, /강점/],
  'future-steps': [/장래/, /향후/, /졸업\s*후/],
  'study-measurable': [/학업\s*계획/, /학습\s*계획/],
  'share-specific': [/나눔/, /환원/, /사회\s*공헌/, /기여/],
  'use-itemized': [/사용\s*계획/, /사용처/, /어디에\s*쓸/],
  'episode-star': [/STAR/i, /상황.*행동.*결과/, /경험\s*기술/],
  'message-short': [/간결/, /짧게/, /담백/],
  'consistency': [/통일성/, /일관성/, /한\s*방향/, /끝까지\s*이어/],
  'plain-sentence': [/군더더기/, /주어와\s*서술어/, /수식어/, /간결한\s*문장/],

  /* ── 2026-09-05 신설 — 그동안 못 배우던 네 종류 + 컨펌 대기에서 승격한 둘 ── */
  'intro-hook': [/자기\s*소개(서)?\s*(항목|칸|문항)/, /한\s*줄\s*소개/, /나를\s*소개/, /첫\s*인상/, /요약문/],
  'value-evidence': [/가치관/, /인생관/, /신념/, /중요하게\s*생각/],
  'effect-why-this': [/필요성/, /장학금이\s*필요/, /왜\s*이\s*장학금/, /다른\s*장학금이\s*아닌/, /지원\s*자격이\s*있는\s*이유/],
  'idea-problem-first': [/문제\s*정의/, /기대\s*효과/, /해결\s*방안/, /실현\s*가능/, /아이디어.*(구조|구성|정리)/],
  'proofread': [/맞춤법/, /오탈자/, /퇴고/, /띄어쓰기/],
  'failure-lesson': [/실패한?\s*경험/, /실패를\s*통해/],
};

/** 이 문장이 어느 규칙을 말하고 있나 — 여러 개면 전부 돌려준다 */
export function matchRule(text) {
  const hits = [];
  for (const [code, pats] of Object.entries(VOCAB)) {
    if (pats.some((re) => re.test(text))) hits.push(code);
  }
  return hits;
}

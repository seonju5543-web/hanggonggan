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
export const DOMAIN = /(자기소개서|자소서|지원서|문장|문단|단락|서술|표현|작성|소재|분량|구성|첫\s*줄|첫\s*문장|두괄식|경험|에피소드|사례|심사|평가자|면접관|지원자|장학|어필|강조|근거|구체적|솔직|진정성|통일성|일관성|군더더기|맞춤법|어휘|어미)/;

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
export const NOT_SOURCE = /(login|signin|signup|join|cart|order|pay|price|이력서|resume|채용|recruit|job)/i;

/** 읽은 글에서 '다음에 읽을 만한 곳' 을 줍는다 */
export function linkCandidates(html, baseUrl) {
  const out = [];
  for (const m of String(html).matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]{0,120}?)<\/a>/gi)) {
    const [, href, inner] = m;
    const text = inner.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    let abs; try { abs = new URL(href, baseUrl).toString(); } catch { continue; }
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
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  return body.split(/\n+/).map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
}

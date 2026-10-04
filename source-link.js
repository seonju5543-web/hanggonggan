/* 원문 링크 — 이 주소를 누르면 학생에게 **실제로 무엇이 열리는가** (한 곳 · 2026-10-03 신설)
   ─────────────────────────────────────────────────────────────────────────────
   왜 생겼나 (2026-10-03 개발자 보고 · P0):
     *"공고 내 원문공고를 클릭했을 때 해당 공고의 페이지로 이동하지 않고 재단이나 장학금
      페이지 전체가 표시되는 상황이 발생하여 사용자들이 신청에 어려움이 있다"* — 장학금뿐
     아니라 대외활동·공모전·소식까지 앱 전반에서.

   조사에서 나온 원인 (자세한 경위는 SESSIONS.md 「원문 링크가 공고가 아니라 홈페이지·목록을 열던 사고」):
     ① 화면이 링크 이름을 **주소 글자만 보고** 정했다 — `#n-` 표식이 없으면 무조건 '원문'.
        그래서 목록 주소에 글 번호만 덧붙인 것(서버가 번호를 무시하고 목록을 준다),
        재단·기관 **홈페이지**, `&#038;` 이 박혀 글 번호가 잘린 주소가 전부 '원문 공고 ↗' 였다.
     ② 이름을 정하는 곳이 **일곱 군데**였고 서로 달랐다 — 층2(재단 홈페이지)를 아는 곳은
        하나뿐이라 신청 내역은 재단 홈페이지를 '공고 원문 보기 ↗' 라고 불렀다.
     ③ 아무도 **학생처럼 새 탭으로 열어 보고** 그 공고가 뜨는지 확인한 기록을 남기지 않았다.

   이 파일이 하는 일 — 화면은 링크 이름을 **여기서만** 받는다:
     · decodeUrlEntities — `&#038;`·`&amp;` 가 박힌 주소를 되돌린다(안 하면 `#` 뒤가 조각이 돼 글 번호가 사라진다)
     · linkShape         — 주소 꼴: 'none' · 'marker'(#n- 게시판 목록 표식) · 'listid'(목록 주소+번호 — 목록이 열린다) · 'home'(index·main 파일) · 'root'(맨 도메인 — 화면에선 page) · 'page'
     · setLinkChecks     — 원문 링크 확인 로봇(collector/link-check.mjs)이 **새 탭으로 열어 본 결과** 중
                           '그 공고가 아니었다'가 확정된 것(data/link-check.json 의 bad)을 받는다
     · linkKind          — 종류 하나: post 계열('page') · 목록('list') · 홈페이지('home'·'foundation-home'·'program')
                           · 문제('login'·'gone'·'other') · 없음('none')
     · sourceLink        — {href, kind, cls, label, hint, caution} — 화면(surface)마다 승인된 말투로

   🔴 베끼지 말 것 — 일곱 군데가 각자 판정하다가 한 곳만 고쳐지는 사고가 이번 사태의 절반이다.
   🔴 'page'(아직 문제로 확정되지 않은 보통 주소)의 이름은 **예전 그대로**다 — 승인받은 화면 글자를
      바꾸지 않는다. 바뀌는 것은 로봇이 '공고가 아니다'를 확인했거나 주소 꼴이 홈페이지·목록인 경우뿐.
   ───────────────────────────────────────────────────────────────────────────── */

/* ── ① 주소에 박힌 HTML 기호 ─────────────────────────────────────────────
   게시판이 링크를 HTML 로 이스케이프해 내보내면(워드프레스·KBoard 등) 로봇이 `&#038;` 을
   그대로 담아 온다. 브라우저는 `#038;category1=…&#038;uid=392` 를 **조각(fragment)**으로 읽어
   서버에 `?mod=document&` 만 보낸다 — 글 번호(uid)가 사라져 공고가 아니라 메뉴 화면이 열린다
   (서울대 학생처 3건 실측 · 2026-10-03). `&amp;` 도 서버엔 `amp;x` 라는 이상한 이름으로 간다.
   두 겹 이스케이프(`&amp;#038;`)도 있어 세 번까지 되푼다. */
const URL_AMP_HAS = /&(?:amp|#0*38|#x0*26);/i;
const URL_AMP_ALL = /&(?:amp|#0*38|#x0*26);/gi;
function decodeUrlEntities(u) {
  let s = String(u == null ? '' : u).trim();
  for (let i = 0; i < 3 && URL_AMP_HAS.test(s); i += 1) s = s.replace(URL_AMP_ALL, '&');
  return s;
}

/* ── ② 주소 꼴 ───────────────────────────────────────────────────────────
   'home' 은 **확실한 것만**: 경로가 비었거나(`/`) 마지막 조각이 index·main·default·home 파일이고
   물음표가 없을 때. `/nysc/` 같은 한 칸짜리 폴더는 행사 전용 페이지일 수도 있어 여기서 단정하지 않는다
   (그런 것은 로봇이 열어 보고 'home' 으로 확정한다 — 꼴만 보고 틀리게 말하지 않는다). */
const HOME_FILE_RE = /^(index|main|default|home)(\.[a-z]{2,5})?$/i;
/* 목록 주소에 글 번호만 붙인 꼴 — 'listid' (2026-10-03 실측).
   K2Web `…/subview.do?nttId=` · eGov `selectNttList.do?…nttId=` 는 게시판이 내보내는 글 주소가 아니라
   **우리 로봇이 목록 주소에 번호를 덧붙여 만든 것**이었고, 서버는 그 번호를 무시하고 목록을 준다
   (가천 18·고려 9·서울교대 10건 — 번호만 다른 주소들이 글자 하나 안 다른 같은 목록 화면).
   🔴 꼴만으로 '목록'이라 부르는 유일한 경우다 — 데이터가 병합으로 되돌아와도(합집합 병합기는 '진짜 주소'를 표식보다
      앞세운다) 화면이 다시 '원문'이라 거짓말하지 않게. 같은 규칙을 수집 쪽 병합(collector/url-key.mjs preferNotice)이 쓴다. */
const LIST_PLUS_ID_RE = /\/subview\.do\?(?:[^#]*&)?nttId=|\/selectNttList\.do\?[^#]*nttId=/i;
function isListPlusId(u) {
  return LIST_PLUS_ID_RE.test(decodeUrlEntities(u));
}
function linkShape(u) {
  const s = decodeUrlEntities(u);
  if (!/^https?:\/\//i.test(s)) return 'none';
  if (/#n-/.test(s)) return 'marker';
  if (LIST_PLUS_ID_RE.test(s)) return 'listid';
  let x;
  try { x = new URL(s); } catch (e) { return 'none'; }
  if (x.search && x.search !== '?') return 'page';
  const segs = x.pathname.split('/').filter(Boolean);
  /* 🔴 맨 도메인('/')은 'root' — 화면에서는 보통 주소와 같다 (2026-10-03 리뷰 APP-2). 정책브리핑 공모전은 `maicon.kr/`·
     `112contest2026.com/` 처럼 **공모전 전용 사이트의 첫 화면이 곧 그 공모전**이라, 꼴만 보고 '주최 측 홈페이지 — 제목으로 찾아 주세요'라
     하면 없는 글을 찾게 만든다. 진짜 기관 첫 화면인지는 원문 링크 확인 로봇이 열어 보고 'home' 으로 확정한다(층2는 sourceKind 로 따로). */
  if (!segs.length) return 'root';
  if (segs.length <= 2 && HOME_FILE_RE.test(segs[segs.length - 1])) return 'home';
  return 'page';
}

/* ── ③ 로봇이 열어 본 결과 ───────────────────────────────────────────────
   `data/link-check.json` = { updatedAt, v, bad: { <주소>: { v, at } } }.
   🔴 bad 에는 **확정된 것만** 있다(로봇이 다른 날 두 번 같은 결과를 봤거나, 번호만 다른 주소 여럿이
      글자 하나 안 다른 같은 화면을 받았을 때 — collector/link-landing.mjs). 한 번 막혀 껍데기를 받은
      것으로 멀쩡한 링크를 '문제'라고 부르지 않는다(2026-08-01 동국대 12건 오판의 교훈).
   열쇠는 decodeUrlEntities 를 거친 주소 그대로 — 로봇도 같은 함수로 열쇠를 만든다. */
const LINK_BAD = ['list', 'home', 'login', 'gone', 'other'];
let LINK_CHECKS = {};
let LINK_CHECKED_AT = '';
let LINK_FIX_ROBOT = {};   // data/link-check.json 의 fix — 로봇이 열어 보고 확인한 원문(아래 ⑥)
let LINK_FIX_HUMAN = {};   // data/link-fixes.json 의 fix — 관리자가 넣은 원문(아래 ⑥)
function setLinkChecks(doc) {
  LINK_CHECKS = (doc && doc.bad && typeof doc.bad === 'object') ? doc.bad : {};
  LINK_CHECKED_AT = (doc && doc.updatedAt) || '';
  LINK_FIX_ROBOT = (doc && doc.fix && typeof doc.fix === 'object') ? doc.fix : {};
}
function setLinkFixes(doc) {
  LINK_FIX_HUMAN = (doc && doc.fix && typeof doc.fix === 'object') ? doc.fix : {};
}
function linkCheckFor(u) {
  const c = LINK_CHECKS[decodeUrlEntities(u)];
  return c && LINK_BAD.indexOf(c.v) >= 0 ? c : null;
}

/* ── ④ 종류 ──────────────────────────────────────────────────────────────
   item 은 화면이 쓰는 공고 모양 그대로(정식 등록·층2·상시 제도는 sourceUrl, 피드·활동·소식은 url).
   · 'program'         — data.js 상시 제도(국가장학금 등) — 한국장학재단 홈페이지
   · 'foundation-home' — 층2(한국장학재단에 등록된 재단 장학금) — KOSAF 상세가 POST 전용이라 재단 홈페이지뿐
   · 'list'            — 게시판 목록(#n- 표식이거나 로봇이 목록 화면으로 확정)
   · 'home'            — 사이트 첫 화면(꼴이 홈페이지이거나 로봇이 홈으로 돌려보내짐을 확정)
   · 'login'·'gone'·'other' — 로봇 확정: 로그인 요구 · 열리지 않음(404) · 다른 화면
   · 'page'            — 보통 주소(문제로 확정된 적 없음)
   · 'none'            — 열 수 있는 주소가 없음 */
function linkUrlOf(item) {
  const it = item || {};
  return it.sourceUrl != null && it.sourceUrl !== '' ? it.sourceUrl : (it.url || '');
}
/* 데이터에 실린 주소 그대로의 종류(바로잡기 전) */
function rawLinkKind(item) {
  const it = item || {};
  if (it.program) return 'program';
  const url = linkUrlOf(it);
  if (it.sourceKind === 'kosaf') return linkShape(url) === 'none' ? 'none' : 'foundation-home';
  const shape = linkShape(url);
  if (shape === 'none') return 'none';
  if (shape === 'marker' || shape === 'listid') return 'list';
  const c = linkCheckFor(url);
  if (c) return c.v;
  if (shape === 'home') return 'home';
  return 'page';
}

/* ── ⑥ 원문 바로잡기 (2026-10-04 · 개발자 지시 *"원문 공고 링크를 최대한 어떻게든 찾을 방법"* · *"관리자 페이지에 원문 공고를 추가할 칸"*) ──
   데이터 파일은 로봇이 날마다 다시 만든다(실시간 공고·대외활동 API·층2 재단은 통째로) — 거기 고쳐 써 두면 다음 실행에 사라진다.
   그래서 **바로잡은 원문은 따로 적고, 링크 이름을 정하는 이 한 곳이 읽는다**(화면·도우미·제출처가 전부 sourceLink 를 거친다).
     · 사람: data/link-fixes.json `fix` — 관리자 화면 「원문 링크」가 적는다(tools/admin-apply.mjs linkFix · 쓰는 곳은 그 하나).
             **늘 이긴다**(사람이 원문을 열어 보고 넣은 것) — 다만 로봇이 날마다 그 주소도 열어 보고 문제면 '(확인 필요)'로 말한다.
     · 로봇: data/link-check.json `fix` — 원문 링크 확인 로봇이 후보 주소를 새 탭으로 열어 **그 공고·그 회차**임을 확인한 것만
             (collector/link-candidates.mjs acceptCandidate · 쓰는 곳은 collector/link-check.mjs 하나).
             🔴 지금 링크가 이미 그 공고로 가면(page) **쓰지 않는다** — 멀쩡한 링크를 로봇이 바꾸지 않는다(2026-10-03 순찰 사고의 교훈).
   열쇠: `id:<공고 id>`(정식 등록 · 층2 `kosaf-<코드>`) 또는 `u:<지금 주소(되푼 것)>`(게시판 글·재단 글·대외활동·소식).
   🔴 `round` 가 적힌 바로잡기는 그 공고의 마감(deadline·due)이 같을 때만 쓴다 — 층2 재단 코드는 해마다 그대로라
      지난 회차 공고를 올해 공고로 보여 주면 가짜 공지다(운영 원칙 6). */
function itemRound(item) {
  const it = item || {};
  return String(it.deadline || it.due || '');
}
function fixKeys(item) {
  const it = item || {};
  const keys = [];
  if (it.id) keys.push(`id:${it.id}`);
  const raw = linkUrlOf(it);
  if (raw) keys.push(`u:${decodeUrlEntities(raw)}`);
  return keys;
}
/* 바로잡을 수 있는 주소인가 — 목록 표식·목록+번호·첫 화면 꼴·http(s) 아닌 것은 원문이 아니다 */
function fixUrlUsable(u) {
  const s = decodeUrlEntities(u);
  if (!/^https?:\/\//i.test(s)) return false;
  const shape = linkShape(s);
  return shape === 'page' || shape === 'root';
}
function linkFixFor(item) {
  const it = item || {};
  if (it.program) return null;
  const keys = fixKeys(it);
  if (!keys.length) return null;
  const fits = (e) => e && fixUrlUsable(e.url) && (!e.round || String(e.round) === itemRound(it));
  for (const k of keys) {
    const e = LINK_FIX_HUMAN[k];
    if (fits(e)) return { url: decodeUrlEntities(e.url), src: 'admin', at: e.at || '', key: k };
  }
  if (rawLinkKind(it) === 'page') return null;
  for (const k of keys) {
    const e = LINK_FIX_ROBOT[k];
    if (fits(e)) return { url: decodeUrlEntities(e.url), src: 'robot', at: e.at || '', key: k };
  }
  return null;
}
/* 학생이 실제로 여는 주소 — 바로잡은 원문이 있으면 그것, 없으면 데이터 주소 */
function effectiveLinkUrl(item) {
  const f = linkFixFor(item);
  return f ? f.url : linkUrlOf(item);
}
function linkKind(item) {
  const it = item || {};
  const f = linkFixFor(it);
  if (!f) return rawLinkKind(it);
  /* 바로잡은 원문도 로봇이 날마다 열어 본다 — 확정된 문제면 그대로 말한다 */
  const c = linkCheckFor(f.url);
  return c ? c.v : 'page';
}
/* 종류 → 보여 주는 갈래 넷 (화면 말투를 고르는 데만 쓴다) */
function linkClass(kind) {
  if (kind === 'page') return 'post';
  if (kind === 'list') return 'list';
  if (kind === 'home' || kind === 'foundation-home' || kind === 'program') return 'home';
  if (kind === 'none') return 'none';
  return 'trouble';
}

/* ── ⑤ 화면마다의 이름 ───────────────────────────────────────────────────
   🔴 page·list·foundation-home·program 의 글자는 **2026-10-03 이전 화면 글자 그대로**다
      (detail = sourceLinkHtml · amount = 금액 상세 · applog = 신청 내역 · card = 게시판·소식 카드 ·
       activity = 활동 시트 단추 · chat = 도우미). 새로 생긴 것은 home(일반 홈페이지)과
      trouble(로봇이 '공고가 아니다'를 확정) 두 갈래의 글자뿐이다 — 개발자 확인 대상(보고서에 화면 첨부). */
const SURFACE_LABELS = {
  detail:   { page: '원문 공고 ↗', list: '게시판 목록 ↗', 'foundation-home': '재단 홈페이지 ↗', program: '한국장학재단 ↗', home: '홈페이지 ↗', trouble: '원문 공고(확인 필요) ↗' },
  amount:   { page: '원문 공고 ↗', list: '게시판 목록 ↗', 'foundation-home': '재단 홈페이지 ↗', program: '한국장학재단 ↗', home: '홈페이지 ↗', trouble: '원문 공고(확인 필요) ↗' },
  applog:   { page: '공고 원문 보기 ↗', list: '게시판 목록 열기 ↗', 'foundation-home': '재단 홈페이지 열기 ↗', program: '한국장학재단에서 보기 ↗', home: '홈페이지 열기 ↗', trouble: '공고 원문 보기(확인 필요) ↗' },
  card:     { page: '원문 보기 ↗', list: '게시판 목록에서 보기 ↗', 'foundation-home': '재단 홈페이지에서 보기 ↗', program: '한국장학재단에서 보기 ↗', home: '홈페이지에서 보기 ↗', trouble: '원문 보기(확인 필요) ↗' },
  activity: { page: '원문에서 신청하기 ↗', list: '게시판 목록에서 보기 ↗', 'foundation-home': '재단 홈페이지 ↗', program: '한국장학재단 ↗', home: '주최 측 홈페이지 ↗', trouble: '원문 보기(확인 필요) ↗' },
  chat:     { page: '↗', list: '(게시판 목록) ↗', 'foundation-home': '(재단 홈페이지) ↗', program: '(한국장학재단) ↗', home: '(홈페이지) ↗', trouble: '(원문 확인 필요) ↗' },
};
/* 문제(trouble)일 때 붙이는 한 줄 — 로봇이 무엇을 봤는지 그대로 말한다(짐작해 덧붙이지 않는다) */
const TROUBLE_CAUTION = {
  login: '이 주소는 로그인해야 열려요',
  gone: '이 주소가 열리지 않았어요',
  other: '이 주소에서 이 공고가 보이지 않았어요',
};

/* 목록 표식(#n-)에 든 제목 — 학생이 목록에서 찾을 글자 */
function markerTitleOf(u) {
  const s = String(u || '');
  const i = s.indexOf('#n-');
  if (i < 0) return '';
  try { return decodeURIComponent(s.slice(i + 3)); } catch (e) { return s.slice(i + 3); }
}

/* 화면이 부르는 유일한 함수.
   돌려주는 것: href(되푼 주소 — 화면이 safeUrl·esc 를 한 번 더 씌운다) · kind · cls · label ·
   hint(목록에서 찾을 제목 — 목록일 때만) · caution(문제일 때 한 줄 — 확인 날짜 포함) */
function sourceLink(item, surface) {
  const it = item || {};
  const labels = SURFACE_LABELS[surface] || SURFACE_LABELS.detail;
  const kind = linkKind(it);
  const cls = linkClass(kind);
  const raw = effectiveLinkUrl(it);
  const href = kind === 'none' ? '' : decodeUrlEntities(raw);
  let label = '';
  if (cls === 'post') label = labels.page;
  else if (cls === 'list') label = labels.list;
  else if (cls === 'home') label = labels[kind] || labels.home;
  else if (cls === 'trouble') label = labels.trouble;
  const hint = cls === 'list'
    ? (markerTitleOf(raw) || String(it.boardTitle || it.title || it.name || '')).trim()
    : '';
  let caution = '';
  if (cls === 'trouble') {
    const c = linkCheckFor(raw);
    caution = `${TROUBLE_CAUTION[kind] || TROUBLE_CAUTION.other}${c && c.at ? ` (${c.at} 확인)` : ''} — 게시판에서 제목으로 찾아 주세요.`;
  }
  return { href, kind, cls, label, hint, caution };
}

/* Node(관문·감사·로봇)에서도 같은 판정을 쓰게 — 브라우저·서비스워커에는 영향 없음(section-head.js 와 같은 겸용) */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    decodeUrlEntities, linkShape, isListPlusId, setLinkChecks, linkCheckFor, linkKind, linkClass, sourceLink,
    markerTitleOf, SURFACE_LABELS, LINK_BAD, TROUBLE_CAUTION,
    setLinkFixes, rawLinkKind, itemRound, fixKeys, fixUrlUsable, linkFixFor, effectiveLinkUrl,
  };
}

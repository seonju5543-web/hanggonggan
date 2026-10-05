/* 공고 주소 정규화 — 같은 공고를 '새 공고'로 다시 수집하지 않기 위한 열쇠 만들기.
   (2026-07-30 서울시립대 사례로 도입)

   서울시립대 게시판은 상세 주소에 목록에서의 순번(sort=)·페이지 번호 같은,
   글 자체와 무관한 값이 붙는다:
     .../view.do?list_id=FA1&seq=30511&sort=3&pageIndex=1&...
   글이 목록에서 한 칸만 밀려도 sort 값이 바뀌어 주소가 달라지므로,
   수집기는 어제 본 글을 오늘 '신규'로 다시 담았다. 그 결과 시립대 피드 40건 중
   실제 공고는 13건뿐이었고, 학교당 40건 상한을 중복이 채워 진짜 새 공고를 밀어냈다.

   그래서 '어떤 글인가'와 무관한 값들을 떼어낸 주소를 중복 판정 열쇠로 쓴다.
   사용자에게 보여주는 주소(url)는 원본 그대로 유지한다 — 링크가 확실히 열려야 하므로.

   참고: auto-register.mjs에도 canonUrl이 따로 있다. 그쪽은 '아는 식별자만 남기는' 방식이라
   정식 등록 중복 판정처럼 더 세게 뭉쳐야 하는 곳에 쓰고, 여기 urlKey는 '군더더기만 떼는'
   방식이라 수집 단계에서 서로 다른 글이 잘못 합쳐지지 않아야 하는 곳에 쓴다. 역할이 달라 둘 다 둔다. */
import { looksLikeHint } from './deadline-hint.mjs';
/* 앱과 같은 '목록 주소+번호' 규칙 — 병합 때 그런 주소가 정직한 표식을 이기지 않게 (2026-10-03).
   🔴 **사본이다** — 원본은 source-link.js 의 LIST_PLUS_ID_RE. 이 파일은 관리자 화면이 브라우저 모듈로 싣는데(_admin/build.sh → vendor/),
      source-link.js 는 앱의 고전 스크립트라 브라우저 모듈이 가져올 수 없다(가져오면 관리자 화면이 통째로 죽는다 — 2026-10-03 verify-admin 이 잡음).
      그래서 정규식 한 줄만 옮겨 두고, 관문 「원문 링크 정직성」 core ⑥ 이 두 줄이 **글자까지 같은지** 대조한다. */
const LIST_PLUS_ID_RE = /\/subview\.do\?(?:[^#]*&)?nttId=|\/selectNttList\.do\?[^#]*nttId=/i;
const URL_AMP_ANY = /&(?:amp|#0*38|#x0*26);/i;   // source-link.js decodeUrlEntities 가 되돌리는 기호(사본 — 관리자 화면 때문)
const isListPlusId = (u) => LIST_PLUS_ID_RE.test(String(u || '').replace(/&(?:amp|#0*38|#x0*26);/gi, '&'));
/* 같은 게시판 글 번호 (2026-10-03 리뷰 F4) — 목록+번호 꼴(가천 subview.do?nttId=125843 · 서울교대 selectNttList?nttId=)과
   그 글의 진짜 주소(가천 /bbs/kor/478/125843/artclView.do · 서울교대 selectNttInfo?nttSn=)는 제목 머리말이 달라([장학공지]/[공통])
   주소 열쇠·제목 열쇠 어느 쪽으로도 안 합쳐져 같은 공고가 두 장 떴다. 이 세 꼴만 '호스트+글 번호'로 묶는다. */
function postIdKey(raw) {
  let x;
  try { x = new URL(String(raw || '').replace(/&(?:amp|#0*38|#x0*26);/gi, '&')); } catch { return ''; }
  const host = x.host.replace(/^www\./, '');
  const m = x.pathname.match(/\/bbs\/[^/]+\/\d+\/(\d+)\/artclView\.do$/);
  if (m) return `pid:${host}:${m[1]}`;
  if (/\/subview\.do$/.test(x.pathname) && x.searchParams.get('nttId')) return `pid:${host}:${x.searchParams.get('nttId')}`;
  if (/\/selectNtt(List|Info)\.do$/.test(x.pathname)) {
    const id = x.searchParams.get('nttSn') || x.searchParams.get('nttId');
    if (id) return `pid:${host}:${id}`;
  }
  return '';
}
/* 목록 표식(#n-)에 담아 둔 게시판 글 번호(postId — 브라우저 수집이 확인된 규칙으로 행에서 읽은 것 · 2026-10-04).
   표식 주소에는 번호가 없어 위 열쇠가 못 잡는다 — 가천 RE 2건·서울교대 4건이 진짜 주소 짝과 영영 안 합쳐진 이유(research 2026-10-04).
   🔴 위 세 꼴의 **목록 쪽 주소**(selectNttList.do · subview.do · K2Web artclList.do)일 때만 — 그 세 게시판 체계는 글 번호가
      사이트 전체에서 하나라 위 열쇠가 이미 '호스트 + 번호'로 묶는다. 다른 게시판의 번호는 게시판마다 겹칠 수 있어 묶지 않는다. */
function markerPostIdKey(n) {
  const raw = String((n && n.url) || '');
  const pid = String((n && n.postId) || '').trim();
  if (!pid || !/^\d{3,20}$/.test(pid) || !raw.includes('#n-')) return '';
  let x;
  try { x = new URL(raw.split('#')[0].replace(/&(?:amp|#0*38|#x0*26);/gi, '&')); } catch { return ''; }
  if (!/\/selectNttList\.do$|\/subview\.do$|\/bbs\/[^/]+\/\d+\/artclList\.do$/.test(x.pathname)) return '';
  return `pid:${x.host.replace(/^www\./, '')}:${pid}`;
}

// 글을 가리키지 않는(휘발성) 값들 — 정렬·페이지·검색어·권한·표시 개수 등
const VOLATILE = new Set([
  'sort', 'pageIndex', 'page', 'searchCnd', 'searchWrd', 'cate_id',
  'viewAuth', 'writeAuth', 'board_list_num', 'lpageCount', 'identified',
  'offset', 'rowNum', 'startPage', 'listNo', 'searchKey', 'searchValue',
  /* 계명대 page.jsp 의 목록 상태 값 (2026-10-05 점검 B6) — pageRef 는 '그때 목록 첫 글의 번호'라 새 글이 올라올 때마다 바뀌어
     목록 40건이 통째로 '새 글'로 다시 들어왔다(09-30 → 10-02 · 39건 수집일이 덮였다). 글은 parm_bod_uid 가 가리킨다.
     🔴 canon-url.mjs 의 VOLATILE 에도 같은 이름을 넣는다(두 목록 같은 뜻) · 옛 열쇠로 적힌 장부는 rekeyLedger 가 잇는다. */
  'pageRef', 'pagePrvNxt', 'pageOrder',
]);

export function urlKey(raw) {
  if (!raw) return '';
  let u = String(raw).trim();
  // 클릭형 게시판의 '목록주소#n-제목' 표식은 그대로 열쇠로 쓴다 (제목이 곧 구분자)
  const hashIdx = u.indexOf('#');
  const hash = hashIdx >= 0 ? u.slice(hashIdx) : '';
  if (hashIdx >= 0) u = u.slice(0, hashIdx);
  const qIdx = u.indexOf('?');
  if (qIdx < 0) return u + hash;
  const base = u.slice(0, qIdx);
  const kept = u.slice(qIdx + 1).split('&')
    .filter((p) => p)
    .map((p) => {
      const eq = p.indexOf('=');
      return eq < 0 ? [p, ''] : [p.slice(0, eq), p.slice(eq + 1)];
    })
    .filter(([k, v]) => !VOLATILE.has(k) && v !== '') // 빈 값 파라미터도 노이즈
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))           // 순서가 바뀌어도 같은 글로 인식
    .map(([k, v]) => `${k}=${v}`);
  return base + (kept.length ? `?${kept.join('&')}` : '') + hash;
}

/* 같은 공고가 '진짜 링크'와 '클릭형 표식(#n-제목)' 두 형태로 들어오는 경우가 있다.
   같은 게시판을 일반 수집기와 브라우저 수집기가 각각 훑거나, 브라우저 수집기가 링크와
   클릭 수집을 모두 성공했을 때 생긴다. 주소가 아예 다르므로 urlKey로는 못 걸러진다.
   그래서 '학교 + 제목'을 두 번째 열쇠로 쓴다. */
export function normTitle(title) {
  return (title || '')
    .replace(/^\d{3,5}\s+/, '')                 // 목록 행 번호
    .replace(/\s*20\d{2}\.\d{1,2}\.\d{1,2}\.?\s*조회\s*\d+\s*$/, '')
    .replace(/신규게시글|Attachment|새글|공지/g, '')
    .replace(/[\s\[\]()·ㆍ~〜.,'"“”‘’!⭐★]/g, '')
    .toLowerCase();
}

export function titleKey(item) {
  const t = normTitle(item.title);
  if (!t) return '';
  return `${item.school || ''}|${item.campus || ''}|${t}`;
}

/* 클릭형 게시판의 '이 행을 이미 눌러 봤나' 열쇠 (2026-08-17).

   클릭형 게시판(중앙·경희·동국·부산·서울교대…)은 행을 **눌러 봐야** 주소를 알 수 있다.
   그래서 주소로 만든 장부(seen)로는 "이 행이 이미 아는 공고인가"를 누르기 전에 물어볼 수
   없었고, 로봇은 매 실행 40행을 전부 다시 눌렀다. 게시판 예산 180초를 아는 공고에 다 쓰고
   목록 아래쪽 **새 공고에는 닿지 못한 채** 끊기던 것이 이 때문이다.

   그래서 주소 대신 **게시판 + 제목**으로 열쇠를 만든다. 제목 다듬기는 titleKey와 같은
   함수(normTitle)를 쓴다 — 갈라지면 "중복 판정은 같은 글이라는데 클릭 장부는 다른 글"이라는
   엇갈림이 생긴다. 게시판 주소는 urlKey로 정규화해, 정렬 순번 같은 군더더기가 붙어도
   같은 게시판으로 본다. */
export function clickRowKey(listUrl, title) {
  const t = normTitle(title);
  if (!t) return '';
  return `click:${urlKey(listUrl)}|${t.slice(0, 80)}`;
}

/* 열쇠 규칙(위 VOLATILE)이 바뀐 뒤 **옛 열쇠로 적힌 장부를 새 열쇠로 잇는다** (2026-10-05 점검 B6).
   안 이으면 규칙을 바꾼 첫 실행에 그 게시판 글 전부가 한 번 더 '새 글'이 된다(계명 40건 · 소식 20건 실측).
   열쇠 꼴 셋만 본다 — 맨 주소(seen·seen-news·seen-activities·seen-external) · 'click:<목록>|<제목>'(클릭 장부 · 목록 쪽만 다시) ·
   'url:<주소>'(소식 썸네일 장부 news-thumb.mjs thumbKey). 그 밖('post:…' 등)은 그대로.
   새 열쇠가 **없을 때만** 같은 값을 넣는다 · 여러 옛 열쇠가 한 새 열쇠로 모이면 가장 이른 날짜(글자 비교 · 날짜가 아닌 값은 먼저 온 것).
   옛 열쇠는 지우지 않는다(합집합 병합기가 다른 판에서 되살린다 · 남아도 해가 없다) · 더한 수를 돌려준다 · 두 번 불러도 같다.
   🔴 새 import 를 더하지 말 것 — url-key.cjs 다리가 이 소스를 그대로 평가한다. */
export function rekeyKey(k) {
  const s = String(k || '');
  const pre = (s.match(/^(click:|url:)(?=https?:\/\/)/) || [''])[0];
  const rest = s.slice(pre.length);
  if (!/^https?:\/\//.test(rest)) return s;
  if (pre === 'click:') {
    const bar = rest.indexOf('|');
    return bar < 0 ? s : `click:${urlKey(rest.slice(0, bar))}${rest.slice(bar)}`;
  }
  return pre + urlKey(rest);
}
export function rekeyLedger(obj) {
  if (!obj || typeof obj !== 'object') return 0;
  const add = new Map();
  for (const [k, v] of Object.entries(obj)) {
    const nk = rekeyKey(k);
    if (nk === k || Object.prototype.hasOwnProperty.call(obj, nk)) continue;
    const prev = add.get(nk);
    if (prev === undefined || (typeof v === 'string' && typeof prev === 'string' && v < prev)) add.set(nk, v);
  }
  for (const [nk, v] of add) obj[nk] = v && typeof v === 'object' && !Array.isArray(v) ? { ...v } : v;   // 썸네일 장부 칸은 객체 — 두 열쇠가 한 객체를 같이 쥐지 않게
  return add.size;
}

/* 주소 하나의 순위(작을수록 낫다) — 진짜 주소 0 · HTML 기호가 남은 주소 1 · 목록 표식 2 · 목록 주소+번호 3.
   병합(preferNotice)과 학교별 파일 고치기(publish-notices.mjs patchUrlsBySchool)가 같이 쓴다 — 🔴 순위를 낮추는 쪽으로는 고치지 않는다. */
export function noticeUrlRank(url) {
  const u = String(url || '');
  if (u.includes('#n-')) return 2;
  if (isListPlusId(u)) return 3;
  return URL_AMP_ANY.test(u) ? 1 : 0;
}

/* 두 항목 중 사용자에게 더 나은 쪽 — 공고로 바로 가는 진짜 주소를 남긴다
   (클릭형 표식은 게시판 목록까지만 열린다) */
export function preferNotice(a, b) {
  /* 순위: 진짜 주소(0) > 목록 표식(1) > 목록 주소에 번호만 붙인 것(2).
     🔴 (2026-10-03) 예전엔 '표식이 아니면 진짜'였다 — 그래서 목록 주소에 번호만 붙인 주소(서버가 번호를 무시하고
        목록을 준다)가 사람이 고친 정직한 표식을 병합 때마다 이겼다(합집합 병합기가 이 함수로 고른다).
        표식이 그보다 앞서는 이유: 표식은 앱이 '게시판 목록'이라 부르고 링크 사냥꾼이 진짜 주소를 찾아 나서는 대상이다. */
  /* (2026-10-03 리뷰 F4) HTML 기호(&#038;)가 남은 주소는 같은 주소의 되돌린 판보다 뒤 — 동점이면 '먼저 온 쪽'(병합의 우리 쪽)을
     남겨, 기본 브랜치의 깨진 판이 고친 판을 되돌리고 있었다. 앱은 되돌려 열지만 감사·장부가 다시 깨진다. */
  const rank = (n) => noticeUrlRank(n.url);
  if (rank(a) !== rank(b)) return rank(a) < rank(b) ? a : b;
  /* 🔴 힌트는 **있기만 하면** 점수를 주고 있었다 (2026-09-12 코드 리뷰). 그래서 청소한 판과
     옛 판이 합쳐지면 **버린 쓰레기 힌트가 이긴다** — 병합기가 `까지 나 . 선발 : 10 월…` 을
     되살리는 것을 실측으로 확인했다. 지금은 **읽을 수 있는 힌트**에만 점수를 준다. */
  const score = (n) => (looksLikeHint(n.deadlineHint) ? 1 : 0) + ((n.attachments || []).length ? 1 : 0);
  return score(b) > score(a) ? b : a;
}

/* 발행 직전 중복 정리 — 두 열쇠(정규화 주소 · 학교+제목)로 같은 공고를 하나로 합친다.
   먼저 들어온 순서(최신 수집분이 앞)를 유지하되, 남길 항목은 preferNotice로 고른다. */
/* opts.distinct(a, b) 가 참이면 열쇠가 같아도 합치지 않는다 (재검증 2026-10-02 · 교내 소식) — 목록 표식(#n-제목) 주소는 같은 제목의
   다른 글(글 번호가 다름)도 같은 주소가 되어, 주소 열쇠만 보면 새 글이 옛 글에 먹혔다. 넘기지 않으면 예전과 똑같다. */
export function dedupeNotices(items, opts = {}) {
  const distinct = typeof opts.distinct === 'function' ? opts.distinct : null;
  const out = [];
  const idx = new Map(); // 열쇠 → out에서의 위치들 (먼저 온 것이 앞)
  for (const n of items || []) {
    const pid = postIdKey(n.url) || markerPostIdKey(n);
    const keys = [`u:${urlKey(n.url)}`, titleKey(n) ? `t:${titleKey(n)}` : null, pid || null].filter(Boolean);
    let hit;
    for (const k of keys) {
      hit = (idx.get(k) || []).find((pos) => !distinct || !distinct(out[pos], n));
      if (hit !== undefined) break;
    }
    if (hit === undefined) {
      const pos = out.push(n) - 1;
      keys.forEach((k) => idx.set(k, (idx.get(k) || []).concat(pos)));
    } else {
      out[hit] = preferNotice(out[hit], n);
      keys.forEach((k) => { const l = idx.get(k) || []; if (!l.includes(hit)) idx.set(k, l.concat(hit)); });
    }
  }
  return out;
}

/* 앱에 실을 공고 수 상한 — 학교 수에 비례해 늘어난다 (2026-08-01)

   왜 고쳤나: 예전엔 전체 상한이 **200건 고정**이었다. 게시판을 12곳 볼 때는 넉넉했지만
   (2026-08-01 기준 146건), 학교를 10곳쯤 더 붙이면 200을 넘고 **넘친 만큼 오래된 공고가
   조용히 사라진다.** 오류도 안 나고 리포트에도 안 남아 아무도 모른다.
   그래서 상한을 '학교 수 × 15건'으로 두되, 지금까지의 200건을 밑바닥으로 보장한다.
   학교를 30곳까지 늘려도 학교마다 15건씩은 자리가 남는다.

   학교당 40건 상한은 그대로 둔다 — 공고가 많은 학교 하나가 목록을 통째로 차지하지
   못하게 막는 장치라 성격이 다르다. */
export function capNotices(items, opts = {}) {
  const perSchool = opts.perSchool ?? 40;
  const perSchoolShare = opts.perSchoolShare ?? 15;
  const minTotal = opts.minTotal ?? 200;
  const keyOf = (n) => `${n.school}|${n.campus || ''}`;
  const total = Math.max(minTotal, new Set(items.map(keyOf)).size * perSchoolShare);

  const take = (limit) => {
    const count = {};
    return items.filter((n) => {
      const k = keyOf(n);
      count[k] = (count[k] || 0) + 1;
      return count[k] <= limit;
    });
  };

  /* 그래도 전체 상한을 넘으면, 뒤에서부터 뭉텅이로 자르지 않고 **학교당 몫을 함께 줄인다.**
     그냥 잘라 내면 목록 뒤쪽 학교가 통째로 사라진다(30개교로 시험했더니 7개교가 0건이 됐다).
     학생 입장에서는 '우리 학교 공고가 아예 없는' 것이 최악이므로, 많이 가진 학교부터
     양보하게 한다. */
  let picked = take(perSchool);
  for (let limit = perSchool - 1; picked.length > total && limit >= 1; limit -= 1) picked = take(limit);
  return picked.slice(0, total);
}

export default urlKey;

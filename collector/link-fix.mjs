/* 원문 바로잡기 — 관리자가 넣는 '진짜 원문 공고 주소'를 받아도 되는가 (2026-10-04 · 개발자 지시
   *"정확하게 표시되지 않는 부분에 대해서는 관리자 페이지에 원문 공고를 추가할 수 있는 칸을 제작"*)
   ─────────────────────────────────────────────────────────────────────────────
   쓰는 곳 둘이 **같은 파일**을 본다(베끼지 않는다):
     · 관리자 화면 「할 일 › 원문 링크 손볼 것」 — 적어 두기 전에 막는다(_admin/build.sh 가 vendor 로 옮긴다)
     · 저장소 tools/admin-apply.mjs linkFix — 화면이 보낸 것을 믿지 않고 한 번 더 막는다
   🔴 주소 꼴 규칙(목록 표식·목록+번호·첫 화면 파일·되풀기)은 **source-link.js 한 곳**이다 — 여기 다시 적지 않고
      부르는 쪽이 `L`(그 파일의 함수 묶음)을 넘긴다. 화면은 <script src="vendor/source-link.js"> 의 전역,
      Node 는 createRequire('../source-link.js'). 첨부 내려받기 꼴도 같은 이유로 entry-rules.cjs RULES.DOWNLOAD_URL 을 받는다.
   🔴 바로잡은 주소는 data/link-fixes.json 에만 적는다 — 데이터 파일의 주소는 로봇이 날마다 다시 만들어 고쳐 써도 사라진다.
      앱은 source-link.js ⑥ 이 그 장부를 읽어 링크 이름·주소를 정한다.
   이 파일은 아무것도 부르지 않는다(브라우저에서 그대로 import 된다). */

/* 집계 사이트 — 주최가 올린 원래 공고가 아니다(링커리어류는 주최사 직접 등록 · CLAUDE.md 「재단·지자체 게시판」).
   🔴 한 곳: 관리자 화면(활동 출처 추가)·저장소(activitySource·linkFix)가 이것을 불러 쓴다. */
export const AGGREGATOR_RE = /linkareer|wevity|thinkcontest|campuspick|all-con|contestkorea|thinkyou|allforyoung/i;

export const FIX_URL_MAX = 600;    // 주소 길이 상한 — 이보다 길면 붙여 넣기 사고(여러 줄·본문)다
export const FIX_TEXT_MAX = 200;   // 원문 제목·메모 길이 상한

/* 바로잡기를 받는 묶음 여섯 — 학생 화면이 링크를 그리는 데이터 전부 */
export const FIX_DATASETS = ['registered', 'kosaf', 'notices', 'news', 'external', 'activities'];
export const FIX_DATASET_LABEL = {
  registered: '정식 등록', kosaf: '층2 재단', notices: '실시간 공고', news: '교내 소식', external: '재단·지자체 글', activities: '대외활동',
};

const hostOf = (u) => { try { return new URL(u).hostname.toLowerCase().replace(/^www\./, ''); } catch (e) { return ''; } };

/** 관리자가 넣은 주소를 원문 공고 주소로 받아도 되는가.
 *  돌려주는 것: { url(되푼 주소), errors[](하나라도 있으면 받지 않는다), warns[](받되 확인을 한 번 더 받는다) }
 *  opts.from = 지금 학생이 여는 주소(데이터에 실린 그대로) · opts.L = source-link.js 함수 묶음 · opts.downloadRe = 첨부 내려받기 꼴 */
export function checkFixUrl(raw, opts = {}) {
  const { from = '', L, downloadRe } = opts;
  const errors = [];
  const warns = [];
  if (!L || typeof L.decodeUrlEntities !== 'function' || typeof L.linkShape !== 'function' || typeof L.fixUrlUsable !== 'function') {
    return { url: '', errors: ['주소 규칙 파일(source-link.js)을 읽지 못했습니다 — 화면을 새로 고쳐 주세요'], warns };
  }
  const url = L.decodeUrlEntities(raw);
  if (!url) return { url, errors: ['주소가 비어 있습니다'], warns };
  if (url.length > FIX_URL_MAX) errors.push(`주소가 너무 깁니다(${FIX_URL_MAX}자 넘음) — 주소 한 줄만 붙여 넣어 주세요`);
  if (/\s/.test(url)) errors.push('주소 안에 빈칸·줄바꿈이 있습니다 — 주소 한 줄만 붙여 넣어 주세요');
  if (!/^https?:\/\//i.test(url)) {
    errors.push('http:// 또는 https:// 로 시작하는 주소여야 합니다');
    return { url, errors, warns };
  }
  let x = null;
  try { x = new URL(url); } catch (e) { errors.push('주소 꼴이 아닙니다 — 브라우저 주소창의 주소를 그대로 복사해 주세요'); return { url, errors, warns }; }
  if (!/\./.test(x.hostname)) errors.push('사이트 이름(도메인)이 이상합니다');
  const shape = L.linkShape(url);
  if (shape === 'marker') errors.push('게시판 목록 표식(#n-)이 붙은 주소입니다 — 목록이 아니라 그 글을 열고 주소창의 주소를 넣어 주세요');
  else if (shape === 'listid') errors.push('목록 주소에 글 번호만 붙인 꼴입니다(열면 목록이 뜹니다) — 그 글을 열고 주소창의 주소를 넣어 주세요');
  else if (shape === 'home') errors.push('사이트 첫 화면 주소입니다 — 그 공고 글의 주소를 넣어 주세요');
  else if (!L.fixUrlUsable(url)) errors.push('원문 공고 주소로 쓸 수 없는 꼴입니다');
  if (downloadRe && downloadRe.test(url)) errors.push('첨부 파일 내려받기 주소입니다 — 첨부가 아니라 공고 글의 주소를 넣어 주세요');
  if (AGGREGATOR_RE.test(url)) errors.push('집계 사이트(링커리어 등) 주소입니다 — 주최가 올린 원래 공고를 넣어 주세요');
  if (/(^|\.)kosaf\.go\.kr$/i.test(x.hostname)) errors.push('한국장학재단(kosaf.go.kr) 상세 주소는 새 탭에서 열리지 않습니다 — 재단이 직접 올린 공고 주소를 넣어 주세요');
  const fromUrl = L.decodeUrlEntities(from);
  if (fromUrl && fromUrl === url) errors.push('지금 링크와 같은 주소입니다');
  if (!errors.length) {
    const a = hostOf(fromUrl);
    const b = hostOf(url);
    if (a && b && a !== b) warns.push(`지금 링크와 사이트가 다릅니다(${a} → ${b}) — 같은 공고가 맞는지 열어서 확인해 주세요`);
    if (shape === 'root') warns.push('사이트 첫 화면(맨 도메인) 주소입니다 — 공모전 전용 사이트처럼 첫 화면이 곧 그 공고일 때만 넣어 주세요');
  }
  return { url, errors, warns };
}

/** 데이터 한 건을 source-link.js 가 읽는 모양으로 — 층2 재단은 앱(app.js kosafAsScholarships)과 같은 칸만 만든다
 *  (id `kosaf-<코드>` · 마감 = due · 원문 = 재단 홈페이지 · sourceKind 'kosaf'). 나머지는 데이터 그대로. */
export function linkItemOf(ds, item) {
  const it = item || {};
  if (ds !== 'kosaf') return it;
  return {
    id: `kosaf-${it.code || ''}`, sourceKind: 'kosaf', sourceUrl: it.home || '', deadline: it.due || null,
    name: it.name || '', provider: it.org || '',
  };
}

/** 바로잡기 장부(data/link-fixes.json fix)의 열쇠 — source-link.js fixKeys 가 찾는 것과 같은 글자.
 *  정식 등록·층2 = `id:<공고 id>`(층2는 `kosaf-<코드>`) · 피드 넷 = `u:<지금 주소(되푼 것)>`. 못 만들면 ''
 *  피드 글이라도 제 id 가 있으면 id: 로 — 공공 API 글(`api-<출처>-<번호>`)은 주소가 날마다 바뀔 수 있어
 *  u: 열쇠는 하루 만에 '대상 없음'이 된다(원문 확인 로봇 publishFix 도 fixKeys 의 첫 열쇠 = id: 를 쓴다). */
export function fixKeyFor(ds, item, L) {
  const it = item || {};
  if (ds === 'registered') return it.id ? `id:${it.id}` : '';
  if (ds === 'kosaf') {
    const id = it.code ? `kosaf-${it.code}` : (String(it.id || '').startsWith('kosaf-') ? it.id : '');
    return id ? `id:${id}` : '';
  }
  if (typeof it.id === 'string' && it.id) return `id:${it.id}`;
  const raw = it.sourceUrl != null && it.sourceUrl !== '' ? it.sourceUrl : (it.url || '');
  if (!raw || !L || typeof L.decodeUrlEntities !== 'function') return '';
  return `u:${L.decodeUrlEntities(raw)}`;
}

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

// 글을 가리키지 않는(휘발성) 값들 — 정렬·페이지·검색어·권한·표시 개수 등
const VOLATILE = new Set([
  'sort', 'pageIndex', 'page', 'searchCnd', 'searchWrd', 'cate_id',
  'viewAuth', 'writeAuth', 'board_list_num', 'lpageCount', 'identified',
  'offset', 'rowNum', 'startPage', 'listNo', 'searchKey', 'searchValue',
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
export function titleKey(item) {
  const t = (item.title || '')
    .replace(/^\d{3,5}\s+/, '')                 // 목록 행 번호
    .replace(/\s*20\d{2}\.\d{1,2}\.\d{1,2}\.?\s*조회\s*\d+\s*$/, '')
    .replace(/신규게시글|Attachment|새글|공지/g, '')
    .replace(/[\s\[\]()·ㆍ~〜.,'"“”‘’!⭐★]/g, '')
    .toLowerCase();
  if (!t) return '';
  return `${item.school || ''}|${item.campus || ''}|${t}`;
}

/* 두 항목 중 사용자에게 더 나은 쪽 — 공고로 바로 가는 진짜 주소를 남긴다
   (클릭형 표식은 게시판 목록까지만 열린다) */
export function preferNotice(a, b) {
  const marker = (n) => (n.url || '').includes('#n-');
  if (marker(a) !== marker(b)) return marker(a) ? b : a;
  const score = (n) => (n.deadlineHint ? 1 : 0) + ((n.attachments || []).length ? 1 : 0);
  return score(b) > score(a) ? b : a;
}

/* 발행 직전 중복 정리 — 두 열쇠(정규화 주소 · 학교+제목)로 같은 공고를 하나로 합친다.
   먼저 들어온 순서(최신 수집분이 앞)를 유지하되, 남길 항목은 preferNotice로 고른다. */
export function dedupeNotices(items) {
  const out = [];
  const idx = new Map(); // 열쇠 → out에서의 위치
  for (const n of items || []) {
    const keys = [`u:${urlKey(n.url)}`, titleKey(n) ? `t:${titleKey(n)}` : null].filter(Boolean);
    const hit = keys.map((k) => idx.get(k)).find((v) => v !== undefined);
    if (hit === undefined) {
      const pos = out.push(n) - 1;
      keys.forEach((k) => idx.set(k, pos));
    } else {
      out[hit] = preferNotice(out[hit], n);
      keys.forEach((k) => { if (!idx.has(k)) idx.set(k, hit); });
    }
  }
  return out;
}

export default urlKey;

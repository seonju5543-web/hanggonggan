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

export default urlKey;

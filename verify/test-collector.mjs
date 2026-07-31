/* 수집기 규칙 자체 테스트 — 인터넷 없이 즉시 끝난다. 수집 워크플로가 매 실행마다 돌린다.
   목적: 2026-07-30에 고친 '같은 공고를 다시 담지 않는 규칙'이 나중에 조용히 되돌아가지 않게 한다.
   (그때는 시립대 피드 40건 중 실제 공고가 13건뿐이었고, 중복이 학교당 상한을 채워
    진짜 새 공고를 밀어냈다. 사람이 눈으로 보기 전에는 아무도 몰랐다.)

   실행: node verify/test-collector.mjs   (실패하면 exit 1) */
import { urlKey, titleKey, dedupeNotices, preferNotice } from '../collector/url-key.mjs';
import { isAttachmentEntry, isHtmlPayload } from '../collector/attachment-link.mjs';
import { isDetailUrl, isMarkerUrl, markerTitle, sameTitle, detailCandidates } from '../collector/detail-url.mjs';

let fail = 0;
const eq = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) { fail++; console.log(`  ✕ ${label}\n      받은 값: ${JSON.stringify(got)}\n      기대 값: ${JSON.stringify(want)}`); }
  else console.log(`  ✓ ${label}`);
};

console.log('■ 주소 정규화 (정렬 순번이 바뀌어도 같은 글로 봐야 한다)');
const uosA = 'https://www.uos.ac.kr/korNotice/view.do?list_id=FA1&seq=30511&sort=3&pageIndex=1&searchCnd=&searchWrd=&viewAuth=Y&board_list_num=10&menuid=200';
const uosB = 'https://www.uos.ac.kr/korNotice/view.do?list_id=FA1&seq=30511&sort=12&pageIndex=2&board_list_num=10&menuid=200';
eq('sort·pageIndex만 다른 같은 글', urlKey(uosA) === urlKey(uosB), true);
eq('seq가 다르면 다른 글', urlKey(uosA) === urlKey(uosA.replace('seq=30511', 'seq=31133')), false);
eq('클릭형 표식(#n-)은 글의 정체성이라 남긴다', urlKey('https://x.ac.kr/list#n-abc').endsWith('#n-abc'), true);
eq('쿼리 없는 주소는 그대로', urlKey('https://dep.hufs.ac.kr/student/12767/subview.do'), 'https://dep.hufs.ac.kr/student/12767/subview.do');

console.log('■ 제목 열쇠 (같은 공고가 다른 주소 형태로 들어와도 하나로)');
const t1 = { school: '서울시립대학교', title: '[빅데이터혁신융합대학사업단] 2026학년도 1학기 성과형 장학금(자격증) 신청 안내' };
const t2 = { school: '서울시립대학교', title: '2653 [빅데이터혁신융합대학사업단] 2026학년도 1학기 성과형 장학금(자격증) 신청 안내 2026.07.24. 조회 12' };
eq('행 번호·조회수 꼬리가 붙어도 같은 제목', titleKey(t1) === titleKey(t2), true);
eq('학교가 다르면 다른 공고(학교별 접수분 보존)', titleKey(t1) === titleKey({ ...t1, school: '경희대학교' }), false);

console.log('■ 중복 통합 (진짜 링크를 남기고 클릭형 표식을 버린다)');
const merged = dedupeNotices([
  { school: '서울시립대학교', title: 'A 장학금 신청 안내', url: 'https://u.ac.kr/list.do?list_id=FA1#n-A' },
  { school: '서울시립대학교', title: 'A 장학금 신청 안내', url: 'https://u.ac.kr/view.do?seq=1', deadlineHint: '~8/1' },
  { school: '서울시립대학교', title: 'B 장학금 신청 안내', url: 'https://u.ac.kr/view.do?seq=2' },
]);
eq('같은 공고 2건 → 1건', merged.length, 2);
eq('남은 주소가 진짜 링크', merged[0].url, 'https://u.ac.kr/view.do?seq=1');
eq('진짜 링크 우선 판정', preferNotice({ url: 'https://x/list#n-a' }, { url: 'https://x/view.do?seq=1' }).url, 'https://x/view.do?seq=1');

console.log('■ 재수집 방지 (어제 본 글을 오늘 신규로 담지 않는다)');
const seen = { [urlKey(uosA)]: '2026-07-29' };
eq('정렬만 바뀐 같은 글은 신규 아님', !!seen[urlKey(uosB)], true);

console.log('■ 첨부파일·부스러기가 공고로 들어오지 않는다 (2026-07-31 — 상명대 15건 사례)');
eq('내려받기 주소는 공고 아님',
  isAttachmentEntry({ title: '코나아이_소상공인_장학생_모집_포스터.png', url: 'https://www.smu.ac.kr/kor/life/notice.do?mode=download&articleNo=1&attachNo=2' }), true);
eq('제목이 파일 이름이면 공고 아님',
  isAttachmentEntry({ title: '5. 2026-2 면학장학금 신청 안내문.hwp', url: 'https://u.ac.kr/view.do?seq=1' }), true);
eq('말머리만 남은 부스러기는 공고 아님',
  isAttachmentEntry({ title: '서울 [등록/장학]', url: 'https://u.ac.kr/view.do?seq=1' }), true);
eq('진짜 공고는 그대로 유지',
  isAttachmentEntry({ title: '2026학년도 2학기 해성문화재단 장학생 선발 안내(~8/2(일)까지)', url: 'https://u.ac.kr/view.do?seq=1' }), false);
eq('첨부가 실제로는 웹페이지면 양식 아님',
  isHtmlPayload(Buffer.from('<!DOCTYPE html>\n<html lang="ko"><head>')), true);
eq('진짜 HWP 원본은 양식으로 인정',
  isHtmlPayload(Buffer.from([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1])), false);

/* 2026-07-31 — 앱에서 '원문 공고 ↗'를 눌렀을 때 학교 장학 공지 목록 전체가 열리던 문제.
   원인은 수집기가 '진짜 상세 주소인가'를 물음표(?) 유무로만 판정한 것이었다.
   그 판정이 되돌아가면 같은 문제가 그대로 재발하므로 여기서 못 박아 둔다. */
console.log('■ 공고 원문 주소 판정 (목록이 아니라 그 공고 하나가 열려야 한다)');
const khuList = 'https://news.khu.ac.kr/kor/user/bbs/BMSR00040/list.do?menuNo=200318';
const dgList = 'https://www.dongguk.edu/article/JANGHAKNOTICE/list';
eq('물음표 없는 경로형 상세도 원문이다 (동국대 /detail/2666 — 예전엔 이걸 버렸다)',
  isDetailUrl('https://www.dongguk.edu/article/JANGHAKNOTICE/detail/2666', dgList), true);
eq('글 번호가 붙은 view 주소는 원문', isDetailUrl(khuList.replace('list.do', 'view.do') + '&nttId=1078712', khuList), true);
eq('게시판 목록 주소는 원문이 아니다', isDetailUrl(khuList, khuList), false);
eq('목록 + 제목 표식(#n-)은 원문이 아니다', isDetailUrl(khuList + '#n-%EA%B3%B5%ED%86%B5', khuList), false);
eq('목록 주소 자체는 상세로 오인하지 않는다', isDetailUrl(dgList, dgList), false);
eq('표식 판정', isMarkerUrl(khuList + '#n-abc') && !isMarkerUrl(khuList), true);
eq('표식에서 제목 되찾기', markerTitle('https://x/list.do#n-%EC%9E%A5%ED%95%99%EA%B8%88'), '장학금');
eq('클릭이 POST라 주소가 안 바뀌는 게시판은 숨은 글 번호로 view 주소를 조립한다',
  detailCandidates({ url: khuList, listUrl: khuList, hiddenInputs: { nttId: '1078712', menuNo: '200318' } })[0],
  'https://news.khu.ac.kr/kor/user/bbs/BMSR00040/view.do?menuNo=200318&nttId=1078712');
eq('식별자처럼 생기지 않은 값으로는 주소를 만들지 않는다 (동국 상세의 name="no" value="dongguk.edu")',
  detailCandidates({ url: dgList, listUrl: dgList, hiddenInputs: { no: 'dongguk.edu' } }).length, 0);
eq('목록 행의 클릭 스크립트 인자에서 글 번호를 뽑아 원문 주소를 만든다',
  detailCandidates({ url: khuList, listUrl: khuList, rowIds: ['1078712'] })
    .includes('https://news.khu.ac.kr/kor/user/bbs/BMSR00040/view.do?menuNo=200318&nttId=1078712'), true);
eq('안내 페이지(/page/533)는 공고 원문이 아니다', isDetailUrl('https://www.dongguk.edu/page/533', dgList), false);
/* 경희 news.khu.ac.kr 실제 구조 (2026-07-31 클릭 함수를 떠서 확인):
     행  = javascript:view('322635','')
     view = function(boardId, catId){ form.elements["boardId"].value = boardId; form.submit(); }
     폼   = action=/kor/user/contents/view.do · menuNo=200226&boardId=&catId=
   목록 주소에서 이름을 유추하면 경로·파라미터·메뉴 번호가 전부 틀린다(실제로 세 번 틀렸다).
   게시판이 스스로 쓰는 폼을 그대로 쓰는 이 규칙이 되돌아가면 경희대가 다시 목록으로 간다. */
eq('게시판이 쓰는 폼의 빈 칸에 글 번호를 넣어 원문 주소를 만든다 (경희 실제 구조)',
  detailCandidates({
    listUrl: khuList, url: khuList, rowIds: ['322635'],
    forms: [{ action: '/kor/user/search/list.do', fields: 'searchWord=' },
      { action: '/kor/user/contents/view.do', fields: 'menuNo=200226&boardId=&catId=' }],
  })[0],
  'https://news.khu.ac.kr/kor/user/contents/view.do?menuNo=200226&boardId=322635');
eq('상세와 무관한 폼(검색창)으로는 주소를 만들지 않는다',
  detailCandidates({ listUrl: khuList, url: khuList, rowIds: ['322635'],
    forms: [{ action: '/kor/user/search/list.do', fields: 'searchWord=' }] })
    .some((u) => u.includes('search')), false);
eq('목록 제목과 상세 제목이 같은 글인지 알아본다',
  sameTitle('공통 2026년 충남평생교육진흥원 재능키움 장학생 2차 모집 안내',
    '[공지] 2026년 충남평생교육진흥원 재능키움 장학생 2차 모집 안내'), true);
eq('다른 공고를 같은 글로 착각하지 않는다',
  sameTitle('2026년 충남평생교육진흥원 재능키움 장학생 2차 모집 안내', '2026년 롯데장학관 입주생 모집 안내'), false);

console.log(fail ? `\n✕ 실패 ${fail}건 — 수집기 중복 제거 규칙이 깨졌습니다` : '\n✓ 수집기 규칙 전부 통과');
process.exit(fail ? 1 : 0);

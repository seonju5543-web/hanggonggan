/* 수집기 규칙 자체 테스트 — 인터넷 없이 즉시 끝난다. 수집 워크플로가 매 실행마다 돌린다.
   목적: 2026-07-30에 고친 '같은 공고를 다시 담지 않는 규칙'이 나중에 조용히 되돌아가지 않게 한다.
   (그때는 시립대 피드 40건 중 실제 공고가 13건뿐이었고, 중복이 학교당 상한을 채워
    진짜 새 공고를 밀어냈다. 사람이 눈으로 보기 전에는 아무도 몰랐다.)

   실행: node verify/test-collector.mjs   (실패하면 exit 1) */
import fs from 'node:fs';
import { urlKey, titleKey, dedupeNotices, preferNotice, capNotices, clickRowKey } from '../collector/url-key.mjs';
import { mergeCandidates } from '../collector/candidates.mjs';
import { publishBySchool, splitBySchool } from '../collector/publish-notices.mjs';
import { pageCandidates, pageUrl, existingPageParam, samePage, shouldRetry } from '../collector/paginate.mjs';
import { looseCandidate, sameNotice, findMissing, classifyMiss, coverageOf, looksLikeBoardChrome, looksLikeAttachmentName, dedupeNear } from '../collector/coverage-rules.mjs';
import { createRequire } from 'node:module';
import { isAttachmentEntry, isHtmlPayload } from '../collector/attachment-link.mjs';
import { isDetailUrl, isMarkerUrl, markerTitle, sameTitle, detailCandidates, looksLikeLoginWall, rowDetailCandidates } from '../collector/detail-url.mjs';
import { cleanTitle, isMenuEntry } from '../collector/clean-title.mjs';
import { makeBudget, rotateOrder, nextCursor, withDeadline, TIMED_OUT } from '../collector/harvest-budget.mjs';
import { canonUrl } from '../collector/canon-url.mjs';
import { checkFormQuality } from '../collector/form-quality.mjs';
import { checkFormCoverage } from '../collector/form-coverage.mjs';
import { canonUrl as nsCanonUrl, hasText, looksLikeErrorPage } from '../collector/notice-source.mjs';

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

console.log('■ 주소 열쇠가 서로 다른 글을 하나로 뭉개지 않는다 (2026-08-14 — 실제로 뭉개고 있었다)');
/* 예전 규칙은 '아는 이름의 파라미터만 남기고 나머지는 버린다'였다. 그래서 아는 이름이
   없는 게시판에서는 **서로 다른 글이 같은 열쇠**가 됐다 — 실측 613건 중 177건.
   피해 ① 남의 공고 원문이 붙어 자격 요건이 뒤바뀐다(원칙 8-1) ② 그 학교의 새 공고가
   전부 '이미 등록됨'으로 건너뛰어진다. 아래 셋이 되돌아가면 그 사고가 그대로 재현된다. */
const knuA = 'https://home.knu.ac.kr/HOME/knussw/sub.htm?nav_code=knu1619416593&mode=view&mv_data=aWR4PTIxMTI=';
const knuB = 'https://home.knu.ac.kr/HOME/knussw/sub.htm?nav_code=knu1619416593&mode=view&mv_data=aWR4PTIxMDU=';
eq('경북대 — 글 번호가 base64 안에 숨어 있어도 다른 글로 본다', canonUrl(knuA) === canonUrl(knuB), false);
const khuA = 'https://news.khu.ac.kr/kor/user/bbs/BMSR00040/view.do?menuNo=200318&boardId=322765';
const khuB = 'https://news.khu.ac.kr/kor/user/bbs/BMSR00040/view.do?menuNo=200318&boardId=322766';
eq('경희대 — 메뉴 번호가 같아도 글 번호가 다르면 다른 글', canonUrl(khuA) === canonUrl(khuB), false);
const jnuA = 'https://www.jnu.ac.kr/WebApp/web/HOM/COM/Board/board.aspx?boardID=5&bbsMode=view&page=1&key=69996';
const jnuB = 'https://www.jnu.ac.kr/WebApp/web/HOM/COM/Board/board.aspx?boardID=5&bbsMode=view&page=2&key=69993';
eq('전남대 — boardID는 게시판 번호다(글은 key). 이름만 보고 가르면 안 된다', canonUrl(jnuA) === canonUrl(jnuB), false);
eq('같은 글이면 페이지·표시값이 달라도 같은 열쇠',
  canonUrl('https://x.ac.kr/v.do?articleNo=1&mode=view') === canonUrl('https://x.ac.kr/v.do?articleNo=1&mode=view&article.offset=0&pageIndex=3'), true);
eq('규칙이 한 벌뿐이다 (notice-source가 베끼면 발췌기와 등록기가 갈라진다)',
  nsCanonUrl(knuA) === canonUrl(knuA) && nsCanonUrl(khuA) === canonUrl(khuA), true);

console.log('■ 만들어진 양식이 학생이 채울 수 있는 모양인가 (2026-08-14 — 못 쓸 양식 5종이 등록돼 있었다)');
/* 무료 변환기는 원본이 표로 짜인 신청서에서 칸을 잘못 쪼갠다. 예전 판정은 **입력 글자**에
   특정 낱말('시간표'·'원고지')이 있나만 봐서 아래 것들이 전부 통과해 앱에 올라갔다.
   지금은 **결과물**을 본다. 이 검사가 되돌아가면 학생이 원본과 다른 신청서를 내게 된다. */
const 깨끗 = { sections: [{ fields: [
  { id: 'a', label: '성명' }, { id: 'b', label: '학과' }, { id: 'c', label: '연락처' },
  { id: 'd', label: '지원 동기', type: 'textarea' }, { id: 'e', label: '개인정보 수집 동의', options: ['동의함', '동의하지 않음'] },
] }] };
eq('멀쩡한 양식은 통과', checkFormQuality(깨끗).ok, true);
eq('"성적 __ 점"의 단위가 질문이 되면 걸린다',
  checkFormQuality({ sections: [{ fields: [{ id: 'a', label: '성적' }, { id: 'b', label: '점' }, { id: 'c', label: '학년' }, { id: 'd', label: '이름' }] }] }).ok, false);
eq('선택지가 부스러기면 비율과 상관없이 걸린다 (학생이 고를 수 없는 칸)',
  checkFormQuality({ sections: [{ fields: [
    { id: 'a', label: '성명' }, { id: 'b', label: '학과' }, { id: 'c', label: '연락처' }, { id: 'd', label: '주소' },
    { id: 'e', label: '동의 여부', options: ['동의함', ')'] }] }] }).ok, false);
eq('공고문을 신청서로 오인하면 걸린다 (국가우수장학금 선발계획 사례)',
  checkFormQuality({ sections: [{ fields: [
    { id: 'a', label: '목적' }, { id: 'b', label: '1) 신청대상' }, { id: 'c', label: '2) 지원자격' },
    { id: 'd', label: '제출 서류' }, { id: 'e', label: '지원자 정보' }] }] }).ok, false);
eq('빈 양식은 통과시키지 않는다', checkFormQuality({ sections: [] }).ok, false);
eq('걸릴 때는 무엇이 문제인지 남긴다',
  checkFormQuality({ sections: [{ fields: [{ id: 'a', label: '초' }] }] }).problems.length > 0, true);
/* 🔴 기준을 조이다 **멀쩡한 양식까지 걸리는** 일이 실제로 있었다.
   손으로 만든 신청서(조병두·산학·롯데)는 '1. 성명'처럼 번호를 붙여 쓴다 — 원본이 그 모양이다.
   그래서 번호가 붙었다는 이유만으로 걸면 안 되고, 번호를 뗀 뒤 내용을 봐야 한다.
   아래 두 줄이 그 균형을 지킨다. 지금 앱의 양식 전수 검사는 verify/audit-data.js가 한다. */
eq('원본이 번호를 붙여 쓰는 진짜 항목은 걸지 않는다 ("1. 성명")',
  checkFormQuality({ sections: [{ fields: [
    { id: 'a', label: '1. 성       명' }, { id: 'b', label: '2. 학       번' },
    { id: 'c', label: '3. 학부 / 전공' }, { id: 'd', label: '4. 연락처' }] }] }).ok, true);
eq('제출서류 목록이 질문이 되면 걸린다 (하림장학재단 — "성적증명서 1통"이 질문이었다)',
  checkFormQuality({ sections: [{ fields: [
    { id: 'a', label: '성명' }, { id: 'b', label: '학과' }, { id: 'c', label: '연락처' },
    { id: 'd', label: '성적증명서 1통' }, { id: 'e', label: '장학금 수령 계좌 사본' }] }] }).ok, false);

console.log('■ 200으로 받아도 오류·점검 화면은 원문이 아니다 (2026-08-14 — 16건이 그 상태였다)');
/* 서울대가 점검 중이던 날 수집이 돌아 저장된 '원문' 16건이 전부 "정보서비스 장애 조치 안내"였다.
   발췌기는 그걸 공고로 읽어 **장학금 공고의 문의처를 전산실 헬프데스크 번호로** 만들었다.
   실패는 안심되는 쪽으로 틀리면 안 된다 — 못 받은 것과 똑같이 '원문 없음'으로 다룬다. */
eq('점검 안내 화면은 원문으로 치지 않는다',
  hasText({ text: '정보서비스 장애 조치 안내\n서울대학교 정보화본부입니다. 현재 정보서비스 장애 조치를 위한 작업이 진행중 입니다.' }), false);
eq('진짜 공고는 그대로 원문으로 본다',
  hasText({ text: '2026학년도 2학기 동행장학금 선발 안내\n1. 신청기간: 2026. 8. 18. ~ 8. 21.\n2. 신청자격: 재학생' }), true);
eq('영문 오류 화면도 잡는다', looksLikeErrorPage('Service Unavailable — please try again later'), true);

console.log('■ 뺀 공고를 주소로 막는다 (id는 주소에서 파생돼 규칙이 바뀌면 무효가 된다)');
/* 🔴 2026-08-14에 실제로 당했다: id가 `auto-` + canonUrl 뒷 24자라, 주소 정규화를 고치자
   막아 둔 23건의 id가 전부 바뀌어 **부경대 2014·2016·2021·2024년 공고가 새 id로 되살아났다.** */
{
  const ar = fs.readFileSync(new URL('../collector/auto-register.mjs', import.meta.url), 'utf8');
  eq('되돌리기가 id뿐 아니라 주소로도 막는다', /blockedUrls/.test(ar) && /cfg\.blockUrls/.test(ar), true);
  eq('새로 등록할 때도 막힌 주소는 건너뛴다',
    /if \(blockedIds\.has\(id\) \|\| blockedUrls\.has\(cu\)\) continue;/.test(ar), true);
  const cfg = JSON.parse(fs.readFileSync(new URL('../collector/auto-register-config.json', import.meta.url), 'utf8'));
  eq('막은 목록이 주소로도 채워져 있다', (cfg.blockUrls || []).length > 0, true);
}

console.log('■ HWP 원본은 미리보기가 아니라 본문을 읽는다 (2026-08-14 — 앞 1023자만 보고 있었다)');
/* 한글의 `PrvText`는 **미리보기용**이라 1023자에서 잘린다(저장분 91개 중 56개가 그 상태였다).
   그래서 변환기는 신청서 뒷부분 항목의 **존재 자체를 몰랐다** — 인하대 변호산 건의
   "졸업 후 총동창회 가입 동의(필수)"가 그렇게 사라졌다. 본문(BodyText)을 읽자 같은 91개에서
   글자가 24만 자 늘었다. 아래 두 줄이 그 배선을 지킨다. */
{
  const sch = fs.readFileSync(new URL('../collector/schematize-forms.mjs', import.meta.url), 'utf8');
  eq('본문(.body.txt)을 미리보기(.txt)보다 먼저 본다',
    /\['\.body\.txt',\s*'\.txt'\]/.test(sch), true);
  const wf = ['collect-scholarships', 'browser-collect', 'deep-fetch']
    .map((n) => fs.readFileSync(new URL(`../.github/workflows/${n}.yml`, import.meta.url), 'utf8'));
  eq('수집·심층 로봇이 본문 추출기를 실제로 돌린다',
    wf.every((y) => y.includes('hwp-bodytext.py')), true);
}

console.log('■ 원본 항목이 양식에서 빠지지 않았나 (2026-08-14 — 조용한 누락이 진짜 위험이다)');
/* form-quality가 못 잡는 실패가 있다: 남은 항목은 전부 멀쩡해 보이는데 **한 칸이 통째로 빠진** 경우.
   인하대 변호산장학금은 자기소개서 4문항 중 3번 "학업계획 및 향후 진로계획"만 빠져 있었고,
   방송대 중앙도서관 건은 우선선발 체크칸과 자기소개가 통째로 없었다. 학생이 그대로 제출한다. */
const 원본 = '장학금 신청서  성 명  생년월일  학 번  연락처  e-mail  자기소개  학업계획';
eq('원본 항목이 다 들어 있으면 통과',
  checkFormCoverage({ sections: [{ info: [['성명', 'name', '학번', 'studentId']],
    fields: [{ id: 'birth', label: '생년월일' }, { id: 'phone', label: '연락처' },
      { id: 'email', label: 'e-mail' }, { id: 'a', label: '자기소개' }, { id: 'b', label: '학업계획' }] }] },
    원본).missing.length, 0);
eq('원본에 있는 항목이 빠지면 잡아낸다',
  checkFormCoverage({ sections: [{ fields: [{ id: 'a', label: '성명' }, { id: 'b', label: '학번' }] }] },
    원본).missing.includes('생년월일'), true);
eq('원본이 없으면 "통과"가 아니라 "모른다"로 답한다 (확인 안 한 것을 확인한 것처럼 보이면 안 된다)',
  checkFormCoverage({ sections: [] }, '').known, false);

console.log('■ (이어서) 양식 모양 검사');
eq('번호가 붙어도 공고문 절 제목이면 걸린다 ("3. 최종 합격자 통보")',
  checkFormQuality({ sections: [{ fields: [
    { id: 'a', label: '성명' }, { id: 'b', label: '학과' }, { id: 'c', label: '연락처' },
    { id: 'd', label: '주소' }, { id: 'e', label: '3. 최종 합격자 통보' }] }] }).ok, false);

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
/* 조립형(view.do?…&nttId=)은 여전히 후보에 있어야 한다 — 다만 '첫 번째'는 아니다.
   경로형을 먼저 시도하도록 순서를 바꿨으므로(동국대 33건 404 사례), 자리 대신 존재를 본다. */
eq('클릭이 POST라 주소가 안 바뀌는 게시판은 숨은 글 번호로 view 주소도 조립해 둔다',
  detailCandidates({ url: khuList, listUrl: khuList, hiddenInputs: { nttId: '1078712', menuNo: '200318' } })
    .includes('https://news.khu.ac.kr/kor/user/bbs/BMSR00040/view.do?menuNo=200318&nttId=1078712'), true);
eq('식별자처럼 생기지 않은 값으로는 주소를 만들지 않는다 (동국 상세의 name="no" value="dongguk.edu")',
  detailCandidates({ url: dgList, listUrl: dgList, hiddenInputs: { no: 'dongguk.edu' } }).length, 0);
eq('목록 행의 클릭 스크립트 인자에서 글 번호를 뽑아 원문 주소를 만든다',
  detailCandidates({ url: khuList, listUrl: khuList, rowIds: ['1078712'] })
    .includes('https://news.khu.ac.kr/kor/user/bbs/BMSR00040/view.do?menuNo=200318&nttId=1078712'), true);
eq('안내 페이지(/page/533)는 공고 원문이 아니다', isDetailUrl('https://www.dongguk.edu/page/533', dgList), false);
/* 후보 순서: 게시판이 실제로 쓰는 경로형이 먼저, 이름을 유추한 조립형이 나중.
   순서가 뒤집혀 있어서 동국대에 없는 `view?nttId=…`가 채택됐고 33건이 전부 404였다
   (경로형 `detail/…` 5건은 전부 통과). 이 순서가 되돌아가면 같은 일이 되풀이된다. */
eq('경로형 상세를 조립형보다 먼저 시도한다 (동국대 33건 404의 원인)',
  detailCandidates({ listUrl: dgList, url: dgList, rowIds: ['26765595'] })[0],
  'https://www.dongguk.edu/article/JANGHAKNOTICE/detail/26765595');
/* 경희 news.khu.ac.kr 실제 구조 (2026-07-31 클릭 함수를 떠서 확인):
     행  = javascript:view('322635','')
     view = function(boardId, catId){ form.elements["boardId"].value = boardId; form.submit(); }
     폼   = action=/kor/user/contents/view.do · menuNo=200226&boardId=&catId=
   목록 주소에서 이름을 유추하면 경로·파라미터·메뉴 번호가 전부 틀린다(실제로 세 번 틀렸다).
   게시판이 스스로 쓰는 폼을 그대로 쓰는 이 규칙이 되돌아가면 경희대가 다시 목록으로 간다. */
/* 폼에서 만든 주소는 여전히 후보로 남긴다 — 다만 **1순위는 아니다.**
   '폼이 1순위'라는 전제가 바로 경희대 로그인 벽 사고의 원인이었다(그 폼이 로그인 폼이었다). */
eq('게시판이 쓰는 폼의 빈 칸에 글 번호를 넣은 주소도 후보로 남긴다 (경희 실제 구조)',
  detailCandidates({
    listUrl: khuList, url: khuList, rowIds: ['322635'],
    forms: [{ action: '/kor/user/search/list.do', fields: 'searchWord=' },
      { action: '/kor/user/contents/view.do', fields: 'menuNo=200226&boardId=&catId=' }],
  }).includes('https://news.khu.ac.kr/kor/user/contents/view.do?menuNo=200226&boardId=322635'), true);
/* 2026-08-01 경희대 사고: 목록 화면의 폼(menuNo=200226)이 사실 **로그인 페이지 폼**이었다.
   그걸 그대로 써서 만든 주소 7건이 전부 '아이디/비밀번호를 입력하세요' 화면으로 갔다.
   마크업만으로는 로그인 폼인지 알 수 없으므로(action에도 필드에도 login 글자가 없다),
   **목록이 쓰는 경로·메뉴를 그대로 유지한 형태를 맨 먼저** 시도해야 한다.
   이 순서가 되돌아가면 경희대가 다시 로그인 화면으로 간다. */
eq('목록의 경로·메뉴를 유지한 주소를 1순위로 만든다 (경희대 로그인 벽 사고)',
  detailCandidates({
    listUrl: khuList, url: khuList, rowIds: ['322535'],
    forms: [{ action: '/kor/user/search/list.do', fields: 'searchWord=' },
      { action: '/kor/user/contents/view.do', fields: 'menuNo=200226&boardId=&catId=' }],
  })[0],
  'https://news.khu.ac.kr/kor/user/bbs/BMSR00040/view.do?menuNo=200318&boardId=322535');
eq('boardId도 글 번호 이름으로 알아본다 (경희대가 쓰는 이름)',
  detailCandidates({ listUrl: khuList, url: khuList, rowIds: ['322535'],
    forms: [{ action: '/kor/user/contents/view.do', fields: 'menuNo=200226&boardId=' }] })
    .some((u) => u.includes('boardId=322535')), true);
eq('로그인 화면은 제목이 보여도 원문으로 인정하지 않는다',
  looksLikeLoginWall('홈 사이트안내 로그인 로그인 아이디를 입력하세요 비밀번호를 입력하세요 아이디저장 로그인', true), true);
eq('상세와 무관한 폼(검색창)으로는 주소를 만들지 않는다',
  detailCandidates({ listUrl: khuList, url: khuList, rowIds: ['322635'],
    forms: [{ action: '/kor/user/search/list.do', fields: 'searchWord=' }] })
    .some((u) => u.includes('search')), false);
/* 되돌릴 때 게시판 원래 제목을 앱의 정리된 이름으로 덮으면, 나중에 그 행을 게시판에서
   못 찾는다 — 2026-08-01에 실제로 정식 등록 8건이 이렇게 미아가 됐다.
   ('전문자격장학 (2026-2학기)'로 덮여서 '공지 공지 2026-2학기 전문자격장학 신청안내'를 못 찾음) */
eq('게시판 원래 제목과 앱의 정리된 이름은 서로 못 찾는다 (덮어쓰면 안 되는 이유)',
  sameTitle('공지 공지 2026-2학기 전문자격장학 신청안내 2026.06.01. 조회 55', '전문자격장학 (2026-2학기)'), false);
eq('게시판 원래 제목끼리는 찾아진다',
  sameTitle('공지 공지 2026-2학기 전문자격장학 신청안내 2026.06.01. 조회 55', '2026-2학기 전문자격장학 신청안내'), true);
eq('글 번호가 아닌 조각으로 만든 상세 주소는 거른다 (…/detail/dongguk.edu)',
  isDetailUrl('https://www.dongguk.edu/article/JANGHAKNOTICE/detail/dongguk.edu', dgList), false);
eq('목록 제목과 상세 제목이 같은 글인지 알아본다',
  sameTitle('공통 2026년 충남평생교육진흥원 재능키움 장학생 2차 모집 안내',
    '[공지] 2026년 충남평생교육진흥원 재능키움 장학생 2차 모집 안내'), true);
eq('다른 공고를 같은 글로 착각하지 않는다',
  sameTitle('2026년 충남평생교육진흥원 재능키움 장학생 2차 모집 안내', '2026년 롯데장학관 입주생 모집 안내'), false);

/* ── 학교를 더 붙여도 공고가 조용히 사라지지 않는다 (2026-08-01) ────────────────
   예전엔 전체 상한이 200건 고정이라, 게시판을 10곳쯤 더 붙이면 넘친 만큼 오래된 공고가
   말없이 잘려 나갔다(오류도 리포트도 없다). 지금은 학교 수에 비례해 늘어난다. */
console.log('\n■ 공고 상한 (학교를 더 붙여도 특정 학교가 통째로 사라지면 안 된다)');
{
  const mk = (school, n) => Array.from({ length: n }, (_, i) => ({ school, campus: '', title: `${school}${i}` }));
  const now13 = [].concat(...['동국', '외대', '경희', '광운', '홍익', '중앙', '성균관', '연세', '시립', '한양', '상명', '서강', '서울']
    .map((s, i) => mk(s, [35, 23, 19, 14, 11, 11, 11, 10, 7, 2, 1, 1, 1][i])));
  eq('지금 규모(13개교 146건)는 그대로 유지', capNotices(now13).length, 146);
  const many = [].concat(...Array.from({ length: 30 }, (_, i) => mk(`학교${i}`, 20)));
  eq('30개교로 늘려도 200건에서 잘리지 않는다', capNotices(many).length > 200, true);
  eq('30개교 전부 공고가 남는다 (한 곳도 0건이 되면 안 된다)',
    new Set(capNotices(many).map((x) => x.school)).size, 30);
  const hog = [].concat(mk('동국', 300), ...Array.from({ length: 20 }, (_, i) => mk(`학교${i}`, 10)));
  eq('공고 많은 학교 하나가 목록을 독차지하지 못한다 (학교당 40건)',
    capNotices(hog).filter((x) => x.school === '동국').length, 40);
}

/* ── 게시판이 이미 알려 준 주소를 버리고 '조립'하지 않는다 (2026-08-01) ──────────
   링크 사냥꾼이 동국대 12건을 전부 놓쳤다. 원인은 행에
   `…/article/JANGHAKNOTICE/detail/26765625`라고 **적혀 있는데도** 그걸 후보에 넣지 않고
   매번 주소를 조립한 것이었다(복구 로봇에는 있던 규칙인데 사냥꾼에만 없었다).
   그래서 규칙을 detail-url.mjs 한 곳으로 모았다 — 여기서 순서까지 못박아 둔다. */
console.log('\n■ 원문 주소 후보 순서 (게시판이 쓰는 것 먼저, 조립은 마지막)');
{
  const dgList = 'https://www.dongguk.edu/article/JANGHAKNOTICE/list';
  const real = 'https://www.dongguk.edu/article/JANGHAKNOTICE/detail/26765625';
  const c1 = rowDetailCandidates({
    row: { abs: real, src: '|/article/JANGHAKNOTICE/detail/26765625|' },
    listUrl: dgList, forms: [],
  });
  eq('행에 적힌 상세 주소가 1순위로 들어간다 (동국대 12건이 이걸 빠뜨려 실패했다)', c1[0], real);
  const c2 = rowDetailCandidates({
    row: { abs: real, src: '|/article/JANGHAKNOTICE/detail/26765625|' },
    listUrl: dgList, forms: [], landed: 'https://www.dongguk.edu/article/JANGHAKNOTICE/detail/26765625?from=list',
  });
  eq('눌러서 실제로 간 주소가 있으면 그게 맨 앞', c2[0].includes('from=list'), true);
  eq('행 주소도 후보에 남는다', c2.includes(real), true);
  // 목록 주소는 후보가 될 수 없다 (원문이 아니라 게시판 전체가 열린다)
  eq('목록 주소는 후보로 안 넣는다', rowDetailCandidates({
    row: { abs: dgList, src: `|${dgList}|` }, listUrl: dgList, forms: [],
  }).includes(dgList), false);
}

/* ── 로봇이 '시작은 하는데 도중에 넘어지는' 사고 막기 (2026-08-01) ────────────
   링크 사냥꾼이 4분 동안 원문 주소 13건을 찾아 놓고, **리포트 마지막 줄에서** 옛 이름
   (GIVE_UP_AFTER — 이름을 ESCALATE_AT으로 바꿀 때 한 군데를 놓쳤다)을 부르며 넘어졌다.
   자바스크립트는 그 줄에 닿기 전까지 아무 말도 안 해 주므로, 실행해 보기 전에는 몰랐다.
   여기서 '선언한 적 없는 대문자 이름을 부르는 곳'을 미리 찾아낸다 — 인터넷도 필요 없다. */
console.log('\n■ 로봇 코드에 없는 이름을 부르는 곳이 있나 (실행 전에 잡는다)');
const NAME_GLOBALS = new Set(['URL', 'JSON', 'NaN', 'Infinity', 'Math', 'Date', 'Number', 'String', 'Boolean', 'Array', 'Object', 'Set', 'Map', 'RegExp', 'Promise', 'Error']);
console.log('\n■ 제목 청소 (2026-08-02 학교 17곳 시험 수집에서 실제로 새어 들어온 것들)');
/* HTML 특수문자 — 안 풀면 앱 화면에 "&quot;근로지담당자&quot;" 처럼 그대로 보인다 */
eq('큰따옴표(&quot;)를 되돌린다',
  cleanTitle('국가근로장학생 &quot;근로지담당자&quot; 안내자료'), '국가근로장학생 "근로지담당자" 안내자료');
eq('숫자 표기(&#40;)를 되돌린다',
  cleanTitle('5·18 희망장학생 모집 안내&#40;~2026.08.12&#41;'), '5·18 희망장학생 모집 안내(~2026.08.12)');
eq('부등호(&lt; &gt;)를 되돌린다',
  cleanTitle('2학기 &lt;이원길 장학금&gt; 선발'), '2학기 <이원길 장학금> 선발');
eq('&amp;를 마지막에 풀어 이중 해제가 안 생긴다', cleanTitle('A &amp;quot; B'), 'A &quot; B');

/* 게시판 옆 메뉴 — 실공고로 잡으면 앱에 '학자금 대출' 같은 빈 카드가 뜬다 */
['학자금 대출', '장학금 주요사항', '외국인장학금', '장학 및 대출', '신입생장학금',
 '장학/학자금공지', '국가장학금 Ⅰ, Ⅱ유형', '반드시 알아야 할 장학정보']
  .forEach((t) => eq(`메뉴로 거른다 — ${t}`, isMenuEntry(t), true));

/* 실공고는 절대 지우면 안 된다 — 연도·학기·기간 표시가 있으면 짧아도 공고다 */
['2026학년도 2학기 동문장학금 신청', '2026-2학기 가송재단 장학생 선발 안내(~8/9)',
 '가송재단 2026년 2학기 장학생 선발', '2026-1학기 복지장학금 시행 공고(서울캠퍼스)']
  .forEach((t) => eq(`실공고는 남긴다 — ${t.slice(0, 26)}`, isMenuEntry(t), false));

/* ⚠️ 이 절이 실패하면 '…안내'로 끝나는 실공고를 통째로 버리던 2026-08-02 사고가 되살아난 것이다.
   그때 세종대 13건 중 11건·명지대 10건 중 8건이 이 이유로 사라졌다.
   원인은 두 수집기가 규칙을 따로 갖고 있었고 일반 수집기에만 NOTICE_SIGNAL 우회가 없던 것. */
['2026-2 주거안정지원장학금 신청안내', '2026-2 국가장학금(Ⅰ,Ⅱ) 및 에델바이스Ⅱ 신청안내',
 '2026년 화성시인재육성재단 소상공인 장학생 모집 안내', '2026학년도 2학기 성적장학금 신청 안내',
 '김해시미래인재장학재단 제3회 장학수기 공모전 안내']
  .forEach((t) => eq(`'안내'로 끝나도 실공고는 남긴다 — ${t.slice(0, 24)}`, isMenuEntry(t), false));

/* 짧고 표시 없는 메뉴는 공고 낱말이 들어 있어도 메뉴다 —
   '선발'이 NOTICE_SIGNAL에 있다고 먼저 통과시키면 아주대 옆 메뉴가 새어 나간다(순서 회귀) */
eq("'장학생 선발'(옆 메뉴)은 '선발'이 있어도 메뉴", isMenuEntry('장학생 선발'), true);

function undeclaredNames(src) {
  let code = src;
  code = code.replace(/\/\*[\s\S]*?\*\//g, ' ');                       // 블록 주석
  code = code.replace(/(^|[^:/])\/\/[^\n]*/g, '$1 ');                  // 줄 주석
  // 템플릿 문자열: 글자는 지우되 ${…} 안의 코드는 남긴다 — 사고가 거기 숨어 있었다
  code = code.replace(/`(?:\\[\s\S]|\$\{[^{}]*\}|[^`\\])*`/g,
    (m) => m.replace(/\$\{[^{}]*\}|[\s\S]/g, (c) => (c.startsWith('${') ? c : ' ')));
  code = code.replace(/'(?:\\.|[^'\\\n])*'/g, "''").replace(/"(?:\\.|[^"\\\n])*"/g, '""');
  code = code.replace(/([(,=:[!&|?{};+\n]\s*)\/(?![/*])(?:\\.|\[(?:\\.|[^\]\\\n])*\]|[^/\\\n])+\/[gimsuy]*/g, '$1/re/');
  code = code.replace(/\.\s*([A-Za-z_$][\w$]*)/g, '.p');               // 속성 접근(process.env.X 등)
  const declared = new Set(NAME_GLOBALS);
  for (const m of code.matchAll(/\b(?:const|let|var|function|class)\s+([A-Z][A-Z0-9_]{2,})\b/g)) declared.add(m[1]);
  for (const m of code.matchAll(/import\s*\{([^}]*)\}/g)) {
    m[1].split(',').forEach((s) => { const n = s.trim().split(/\s+as\s+/).pop(); if (n) declared.add(n); });
  }
  const bad = new Set();
  for (const m of code.matchAll(/\b([A-Z][A-Z0-9_]{2,})\b/g)) if (!declared.has(m[1])) bad.add(m[1]);
  return [...bad];
}
{
  const dir = new URL('../collector/', import.meta.url);
  for (const f of fs.readdirSync(dir).filter((n) => n.endsWith('.mjs')).sort()) {
    eq(`${f} — 선언 없는 이름 없음`, undeclaredNames(fs.readFileSync(new URL(f, dir), 'utf8')), []);
  }
  // 이 검사가 실제로 그 사고를 잡는지 스스로 확인한다 (검사가 잠들면 없느니만 못하다)
  eq('검사가 실제로 그 사고를 잡는다',
    undeclaredNames('const A = 1;\nconsole.log(`값 ${A}/${GIVE_UP_AFTER}회`);'), ['GIVE_UP_AFTER']);
}

/* 재시도 대기에 page.waitForTimeout을 쓰면 안 된다 (2026-08-02 이슈 #89).
   페이지가 닫혀서 goto가 실패한 경우 그 대기가 스스로 예외를 던져 **진짜 실패 원인을
   덮어쓰고 남은 재시도까지 건너뛴다.** 서울대·가천대·외대·상명대가 이 경로로 죽고 있었다.
   goto 성공 뒤의 '화면 그려질 때까지 대기'는 페이지가 살아 있으므로 정상 — catch 안만 본다. */
{
  const src = fs.readFileSync(new URL('../collector/browser-collect.mjs', import.meta.url), 'utf8');
  const badBackoff = (text) => {
    // 주석은 걷어내고 본다 — 안 그러면 '쓰지 말라'고 적어 둔 주석 자체를 잡는다(실제로 겪음)
    const code = text.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    const out = [];
    const re = /catch\s*\([^)]*\)\s*\{([\s\S]*?)\n\s{0,6}\}/g;
    let m;
    while ((m = re.exec(code))) if (/page\.waitForTimeout|\bp\.waitForTimeout/.test(m[1])) out.push('catch');
    return out;
  };
  eq('재시도 대기가 페이지에 의존하지 않는다', badBackoff(src), []);
  eq('검사가 실제로 그 사고를 잡는다',
    badBackoff('try { a(); } catch (e) {\n  await page.waitForTimeout(3000);\n}'), ['catch']);
}

/* 로봇이 쓰는 파일은 워크플로 저장 단계의 git add 목록에 반드시 있어야 한다.
   이 유형이 두 번 터졌다 — 2026-08-01 data/forms.json(이슈 #79), 2026-08-02 collector/health.json.
   빠뜨리면 ① 그 파일 변경이 저장되지 않고 ② 추적 중인 파일이 스테이지 안 된 채 남아
   재시도의 git pull --rebase가 "unstaged changes"로 죽어 **실행 전체가 날아간다**(24분 수집 유실). */
{
  const pairs = [
    ['collector/collect.mjs', '.github/workflows/collect-scholarships.yml'],
    ['collector/browser-collect.mjs', '.github/workflows/browser-collect.yml'],
  ];
  const root = new URL('../', import.meta.url);
  for (const [robot, flow] of pairs) {
    const src = fs.readFileSync(new URL(robot, root), 'utf8');
    const yml = fs.readFileSync(new URL(flow, root), 'utf8');
    // writeFileSync(new URL('X', HERE) …) 와 writeFileSync('X' …) 에서 파일 이름을 뽑는다
    const written = [...src.matchAll(/writeFileSync\(\s*(?:new URL\(\s*)?['"]([\w./-]+\.(?:json|md))['"]/g)]
      .map((m) => m[1].split('/').pop());
    const missing = [...new Set(written)].filter((f) => !yml.includes(f));
    // report.md류(추적 안 하는 산출물)는 저장 목록에 없어도 되지만, .json 장부는 반드시 있어야 한다
    const missingLedgers = missing.filter((f) => f.endsWith('.json'));
    eq(`${robot.split('/').pop()}가 쓰는 장부가 저장 목록에 다 있다`, missingLedgers, []);
  }
}

/* 저장 재시도는 남은 파일이 있어도 죽지 않아야 한다 (위와 같은 사고의 2차 방어) */
{
  const root = new URL('../', import.meta.url);
  for (const f of ['collect-scholarships', 'browser-collect', 'deep-fetch', 'resolve-detail-urls', 'link-hunter']) {
    // 주석은 걷어내고 본다 — '이렇게 쓰지 말라'고 적어 둔 설명 자체를 잡는다(두 번째 겪음)
    const yml = fs.readFileSync(new URL(`.github/workflows/${f}.yml`, root), 'utf8')
      .split('\n').filter((l) => !/^\s*#/.test(l)).join('\n');
    const plain = (yml.match(/git pull --rebase(?! --autostash)/g) || []).length;
    eq(`${f}: 맨몸 git pull --rebase 없음(--autostash 필수)`, plain, 0);
  }
}

/* ── 시간 예산 · 학교 순서 회전 (2026-08-03 시간초과 사고 회귀) ──────────────
   학교가 13→29곳으로 늘자 브라우저 수집이 워크플로 상한(40분)에 걸려 4회 연속 **취소**됐고,
   취소는 저장 단계까지 죽여서 그날 수집분이 전부 버려졌다.
   크래시가 아니라 강제 종료라 '넘어져도 저장'으로는 못 막는다 — 스스로 예산 안에 끝내야 한다.
   가짜 시계를 써서 진짜로 기다리지 않고 검사한다. */
console.log('■ 수집 시간 예산 (예산을 넘기면 남은 학교를 건너뛰고 저장까지 간다)');
{
  let clock = 0;
  const b = makeBudget(1000, () => clock);
  eq('시작 직후는 예산이 남아 있다', b.expired(), false);
  clock = 400;
  eq('40% 지점에서 학교 하나(300ms)를 더 시작할 여유가 있다', b.hasRoom(300), true);
  clock = 800;
  eq('80% 지점에서는 300ms짜리를 새로 시작하지 않는다', b.hasRoom(300), false);
  eq('아직 예산 자체가 끝난 것은 아니다', b.expired(), false);
  clock = 1000;
  eq('예산을 다 쓰면 만료', b.expired(), true);
  eq('경과 시간을 리포트에 쓸 수 있다', b.elapsed(), 1000);
}

console.log('■ 학교 순서 회전 (잘리는 학교가 매번 같으면 그 학교는 영영 안 돈다)');
{
  eq('커서 0이면 설정 파일 순서 그대로', rotateOrder(5, 0), [0, 1, 2, 3, 4]);
  eq('커서 3이면 3번 학교부터 돌아 한 바퀴', rotateOrder(5, 3), [3, 4, 0, 1, 2]);
  eq('커서가 목록 끝을 넘어도 안전하게 되돌아온다', rotateOrder(5, 7), [2, 3, 4, 0, 1]);
  eq('음수 커서도 안전', rotateOrder(5, -1), [4, 0, 1, 2, 3]);
  eq('학교가 없으면 빈 목록', rotateOrder(0, 3), []);
  // 17곳 중 10곳만 돌고 잘린 상황 → 다음 실행은 못 돈 11번째 학교부터
  eq('건너뛴 학교가 다음 실행의 시작점이 된다', nextCursor(17, 0, 10), 10);
  eq('전부 돌면 시작점이 앞으로 나아가 순서가 고정되지 않는다', nextCursor(17, 0, 17), 0);
  eq('커서가 있는 상태에서 잘려도 이어서 계산된다', nextCursor(17, 10, 5), 15);
  eq('한 바퀴를 넘어가면 되돌아온다', nextCursor(17, 15, 5), 3);
}

/* 클릭 수집이 도는 조건 (2026-08-07 — 학교 두 곳이 이것 때문에 통째로 비어 있었다)

   ① 부산대 onestop: 공고 행이 `<a href="#popup">`이고 클릭 처리는 스크립트로 붙어 있어
      onclick 속성도 javascript: 주소도 없다. 클릭 대상 선택자가 그 둘뿐이라 **클릭 시도 0건**,
      46개 링크가 전부 목록 주소로 접혀 장학 공고 1건(그마저 목록 주소)이었다.
   ② 서울교대: 옆 메뉴의 '장학제도'·'장학'·'학자금대출' 링크 3개가 "이미 상세 주소가 3개 있다"로
      세어져 클릭 수집이 **아예 안 돌았다**. 공고 행 15개는 멀쩡히 클릭 가능한 상태였는데도 0건.

   두 조건 모두 되돌리면 그 학교 학생 화면이 다시 빈다. */
console.log('■ 클릭 수집이 도는 조건');
{
  const src = fs.readFileSync(new URL('../collector/browser-collect.mjs', import.meta.url), 'utf8');
  const clickable = (src.match(/const CLICKABLE = '([^']+)'/) || [])[1] || '';
  eq('클릭 대상에 해시(#) 가짜 주소 행이 있다 (부산대 유형)', /a\[href\^="#"\]/.test(clickable), true);
  eq('클릭 대상에 onclick·javascript 행도 그대로 있다',
    /\[onclick\]/.test(clickable) && /a\[href\^="javascript"\]/.test(clickable), true);
  // 가동 조건을 세는 곳에서 메뉴를 걸러야 한다 — 판정은 수집 본체와 같은 모듈로
  const gate = (src.match(/const kwAnchors = new Set\(links[\s\S]*?\)\)\.size;/) || [''])[0];
  eq('가동 조건에서 메뉴 링크를 뺀다 (서울교대 유형)', /isMenuEntry\(/.test(gate), true);
  // 그 판정이 실제로 서울교대 메뉴를 걸러 내고 진짜 공고는 살리는지 (모듈이 바뀌면 여기서 걸린다)
  eq('메뉴 판정이 서울교대 옆 메뉴를 걸러 낸다',
    ['장학제도', '장학', '학자금대출'].filter((t) => !isMenuEntry(t)), []);
  eq('메뉴 판정이 진짜 공고 제목은 살린다',
    isMenuEntry('2026학년도 2학기 학부 재학생 우선선발장학금(형제자매장학 등) 신청 안내'), false);
}

/* 절대 시한 (2026-08-17 사고) — 예산 시계는 일을 **시작하기 전과 끝난 뒤**에만 물어볼 수
   있어서, 학교 하나가 답을 영영 안 주면 로봇이 그 자리에 멈춰 선다. 그러면 저장 단계까지
   강제 종료돼 그날 수집분이 통째로 버려진다(8/15~17 3회 연속, 하루치 2번 + 리포트 3일치).
   그래서 '대답을 안 기다리고 끊는' 장치를 따로 둔다. */
/* 클릭형 게시판의 '이 행 이미 눌러 봤나' 장부 (2026-08-17).
   클릭형 게시판은 눌러 봐야 주소를 알 수 있어서 주소 장부(seen)를 누르기 전에 못 쓴다.
   그래서 매 실행 40행을 전부 다시 눌렀고, 게시판 예산 180초를 아는 공고에 다 써서
   목록 아래쪽 새 공고에 닿지 못한 채 끊겼다(8/17 중앙대: 11/15건까지만 채집). */
console.log('\n■ 클릭형 게시판 장부 (아는 행을 다시 누르지 않게)');
{
  const board = 'https://www.cau.ac.kr/cms/FR_CON/index.do?MENU_ID=100&P_TAB_NO=5';
  const t = '2026학년도 2학기 성적우수 장학금 선발 공고';
  eq('같은 게시판·같은 제목이면 같은 열쇠', clickRowKey(board, t) === clickRowKey(board, t), true);
  eq('제목이 다르면 다른 열쇠', clickRowKey(board, t) !== clickRowKey(board, t + ' 2차'), true);
  // 목록 정렬 순번이 바뀌어도 같은 게시판이어야 한다 (시립대 sort= 유형)
  eq('게시판 주소의 군더더기는 무시', clickRowKey(board + '&sort=3', t) === clickRowKey(board, t), true);
  // 제목 다듬기는 중복 판정(titleKey)과 **같은 함수**를 써야 판정이 갈라지지 않는다
  eq('행 번호·새글 표식이 붙어도 같은 글', clickRowKey(board, `1234 ${t} 새글`) === clickRowKey(board, t), true);
  eq('제목이 비면 열쇠를 만들지 않는다 (빈 열쇠로 전부 건너뛰는 사고 방지)', clickRowKey(board, '   '), '');
  const src = fs.readFileSync(new URL('collector/browser-collect.mjs', new URL('../', import.meta.url)), 'utf8');
  /* 순서가 중요하다 — 화면에서 40행을 먼저 자르면, 위쪽 40행이 전부 아는 공고인 게시판에서는
     41번째의 새 공고에 영영 닿지 못한다. 걸러낸 **뒤에** 40건을 골라야 한다. */
  eq('아는 행을 걸러낸 뒤에 40건을 고른다',
    /rawRows\.filter\(\(\[, t\]\) => !seen\[clickRowKey\(url, t\)\]\)\.slice\(0, 40\)/.test(src), true);
  eq('화면에서는 40건보다 넉넉히 받아 둔다', /\.slice\(0, 80\)\.map/.test(src), true);
  eq('새로 수집한 행을 장부에 적는다', /seen\[clickRowKey\(url, it\.title\)\] = rec\.foundAt;/.test(src), true);
  // 이미 아는 공고로 밝혀진 행도 적어야 한다 — 안 적으면 상세 루프가 안 건드려 영영 다시 누른다
  eq('이미 아는 공고로 밝혀진 행도 장부에 적는다', /if \(known\) seen\[clickRowKey\(url, title\)\] = known;/.test(src), true);
  eq('건너뛴 건수를 리포트에 적는다 (공고가 준 것처럼 보이지 않게)', /이미 아는 공고 \$\{r\.clickSkipped\}건/.test(src), true);
}

/* 누락 감사 (2026-08-17) — 로봇은 자기가 읽은 것만 알아서 스스로는 누락을 셀 수 없다.
   그래서 게시판을 별도로 다시 읽어 대조한다. 이 절의 검사들이 지키는 것은
   **감사가 수집기와 같은 그물을 쓰지 않는다**는 점이다 — 같으면 언제나 '누락 0건'이 된다. */
console.log('\n■ 누락 감사 (감사가 수집기의 맹점을 물려받지 않는가)');
{
  const root = new URL('../', import.meta.url);
  /* 🔴 이 절의 핵심 검사. 감사 그물이 수집기 그물보다 넓어야 한다.
     '면학보조금'은 수집기가 못 잡는 대표 사례인데, 감사도 못 잡으면 누락을 영영 못 본다. */
  const HARVEST = /장학|학자금|등록금 감면|학업장려|근로장학/;
  const onlyLoose = ['2026-2학기 면학보조금 지급 안내', '2026학년도 2학기 수업료 감면 신청 안내',
    '2026학년도 2학기 학업지원 프로그램 참가자 모집', '2026년 2학기 생활비 지원 신청 안내'];
  for (const t of onlyLoose) {
    eq(`감사 그물이 '${t.slice(0, 14)}…'를 후보로 집는다`, looseCandidate(t), true);
    eq(`  (수집기 그물은 못 잡는다 — 그래서 감사가 필요하다)`, HARVEST.test(t), false);
  }
  // 너무 짧거나 긴 것은 행 부스러기다 (감사도 무한정 넓으면 리포트가 잡음으로 덮인다)
  eq('짧은 부스러기는 후보가 아니다', looseCandidate('장학'), false);
  eq('장학과 무관한 제목은 후보가 아니다', looseCandidate('2026학년도 2학기 수강신청 안내입니다'), false);

  // 제목 대조 — 게시판 목록의 부스러기(행 번호·조회수·새글)에 흔들리면 멀쩡한 공고를 누락으로 센다
  eq('행 번호·새글 표식을 무시하고 같은 글로 본다',
    sameNotice('1234 2026학년도 2학기 교내장학금 신청 안내 새글', '2026학년도 2학기 교내장학금 신청 안내'), true);
  eq('제목이 잘려도 같은 글로 본다',
    sameNotice('2026학년도 2학기 성적우수장학금 신청 안내(8월 20일까지)', '2026학년도 2학기 성적우수장학금 신청 안내'), true);
  eq('다른 공고는 다른 글로 본다', sameNotice('제1호 교내장학금 신청', '제2호 교내장학금 신청'), false);
  eq('짧은 제목은 우연히 겹쳐도 같다고 하지 않는다', sameNotice('장학 안내', '교내 장학 안내 공고문'), false);
  eq('우리 데이터에 있는 것은 누락이 아니다',
    findMissing(['2026학년도 2학기 성적우수장학금 신청'], ['2026학년도 2학기 성적우수장학금 신청']).length, 0);
  eq('우리 데이터에 없는 것만 누락',
    findMissing(['A 2026 성적우수장학금 신청 안내', 'B 2026 면학보조금 지급 안내'], ['A 2026 성적우수장학금 신청 안내']).length, 1);

  /* 원인 분류 — '몇 건 누락'이 아니라 '무엇을 고쳐야 하나'가 나와야 값이 있다 */
  const deps = { keywords: HARVEST, isMenuEntry, isAttachmentEntry: () => false };
  eq('키워드 밖으로 가른다', classifyMiss('2026-2학기 면학보조금 지급 안내', deps), '키워드 밖');
  eq('메뉴로 걸러진 것을 가른다', classifyMiss('학자금 대출', deps), '메뉴로 걸러짐');
  eq('2페이지 이후를 가른다',
    classifyMiss('2026학년도 2학기 성적우수장학금 선발 공고', { ...deps, page: 2 }), '2페이지 이후');
  /* 수집기 규칙을 다 통과하는데 없는 것 = 진짜 문제. 이 이름이 바뀌면 리포트·워크플로도 어긋난다 */
  eq('규칙을 다 통과하는데 없으면 원인 미상',
    classifyMiss('2026학년도 2학기 성적우수장학금 선발 공고', { ...deps, page: 1 }), '원인 미상');
  eq('게시판을 못 읽었으면 비율을 말하지 않는다', coverageOf(0, 0), null);
  eq('비율 계산', coverageOf(10, 2), 80);

  /* 🔴 첫 실행(2026-08-17)의 실제 잡음을 고정 자료로 박아 둔다.
     그때 '원인 미상 60건' 중 **37건이 게시판 옆 메뉴 덩어리, 9건이 첨부 파일 이름**이었다.
     사람이 볼 칸에 잡음이 62%면 그 칸은 안 보게 된다 — 감사가 장식이 되는 실패다.
     아래 문장들은 실제 리포트에서 그대로 가져온 것이다. */
  const realMenuBlobs = [
    '장학 장학금안내 교내장학금 한국장학재단 발전재단·교외재단 학자금대출',
    '소식·알림 공지사항 학생처 소식 FAQ 장학 복지 상담 부속시설 시설이용 기타 S-CARD 병무안내 견학',
    '공지사항 - 전체 - 학사 - 입학 - 취업 - 채용/모집 - 장학 - 행사/세미나 - 일반',
    '행정 지원 안내 업무별 담당 부서 안내 등록 안내 장학 안내 증명발급 안내 기숙사 안내 교직이수 교원자격증발급 학생대관 외부대관 통합 양식자료실',
    '커뮤니티 커뮤니티 학생지원 장학 도서관/박물관 정보서비스 경희미디어',
    '장학 및 학자금 대출 교내장학 외부장학 국가장학 국가근로장학 학자금 대출 학자금 중복지원 방지 장학 상담',
    '게시판 학생활동 장학(공지) 자료실 FAQ / Q&A',
    '장학금 신청안내 종류 선발절차 학자금대출',
    '장학금안내(서울) chevron_right',
    '장학금안내(ERICA) open_in_new',
  ];
  realMenuBlobs.forEach((t) => eq(`메뉴 덩어리로 가른다: '${t.slice(0, 20)}…'`, looksLikeBoardChrome(t), true));
  ['2. (홈페이지 게시글) 2026학년도 2학기 근로(행정부서) 장학생 신청 안내.hwp 웹 브라우저에서 바로보기',
    '2026년_손태희장학재단_4기_장학생_선발_공고문.pdf 웹 브라우저에서 바로보기']
    .forEach((t) => eq(`첨부 파일 이름으로 가른다: '${t.slice(0, 18)}…'`, looksLikeAttachmentName(t), true));

  /* 🔴 그리고 **진짜 공고는 부스러기로 버리지 않아야 한다** — 이쪽이 더 중요하다.
     부스러기 규칙이 과하면 감사가 진짜 누락을 숨겨, 있는 문제를 없다고 말하게 된다. */
  const realNotices = [
    '[한국장학재단] 2026학년도 2학기 국가장학금 2차 신청 안내 (8/12~9/9)',
    '[학생복지팀] 2026학년도 2학기 교내 근로(행정부서) 장학생 신청 안내',
    '[등록/장학] 2026학년도 2학기 문주장학재단 신규장학생 선발 안내(기간연장)',
    '1388 2026학년도 2학기 부영주택 장학생 지원 안내',
    '[공통][국가] 2026학년도 2학기 2차 주거안정장학금 신청기간 안내(~9/9) 새글',
    '2026학년도 2학기 한국사학진흥재단 행복기숙사(연합) 입주생 정기모집 안내',
  ];
  realNotices.forEach((t) => {
    eq(`진짜 공고를 부스러기로 버리지 않는다: '${t.slice(0, 22)}…'`, looksLikeBoardChrome(t), false);
    eq(`  (첨부로도 오해하지 않는다)`, looksLikeAttachmentName(t), false);
  });
  /* 순서 확인 — 메뉴 덩어리를 '키워드 밖'으로 세면 "키워드를 넓히면 되겠구나"라는 틀린 결론이 된다 */
  eq('메뉴 덩어리는 키워드 밖이 아니라 부스러기로 센다',
    classifyMiss('장학 및 학자금 대출 교내장학 외부장학 국가장학 국가근로장학 학자금 대출 학자금 중복지원 방지 장학 상담', deps),
    '게시판 메뉴·설명문 (공고 아님)');

  /* 🔴 조회수가 제목에 붙는 게시판 (2026-08-17 2차 감사에서 잡은 거짓 누락 22건의 원인).
     한국항공대는 제목·부서·작성일·**조회수**를 한 칸에 그린다. 조회수가 매시간 늘기 때문에
     수집 때(69회)와 감사 때(269회)의 지문이 달라져 **22건 전부 누락(인식 0%)** 으로 보고됐다.
     실제로는 우리가 다 갖고 있었다. 이 규칙이 되돌아가면 그 게시판은 영영 '전부 누락'이 된다. */
  eq('조회수가 늘어도 같은 공고로 본다', sameNotice(
    '2026년 2학기 국가장학금 2차 신청 안내 학생지원팀 2026-08-10 69',
    '2026년 2학기 국가장학금 2차 신청 안내 학생지원팀 2026-08-10 269'), true);
  eq('조회수에 쉼표가 있어도 같은 공고', sameNotice(
    '2026학년도 2학기 국가근로 장학 교내 신청 안내 학생지원팀 2026-07-20 1,250',
    '2026학년도 2학기 국가근로 장학 교내 신청 안내 학생지원팀 2026-07-20 250'), true);
  // 그래도 다른 공고는 구분해야 한다 — 꼬리 숫자를 뗀다고 제목까지 뭉개면 진짜 누락을 숨긴다
  eq('꼬리 숫자를 떼도 다른 공고는 구분', sameNotice(
    '2026학년도 2학기 제1호 장학금 안내 부서 2026-08-10 5',
    '2026학년도 2학기 제2호 장학금 안내 부서 2026-08-10 5'), false);
  eq('1차/2차는 여전히 다른 공고', sameNotice(
    '2026년 2학기 국가장학금 2차 신청 안내', '2026년 2학기 국가장학금 1차 신청 안내'), false);
  // 전화번호·내선번호 표가 행으로 잡히던 것 (경북대)
  eq('전화번호 조각은 공고가 아니다', looksLikeBoardChrome('교내장학금 : 053-950-2103'), true);
  eq('내선번호 조각도 공고가 아니다', looksLikeBoardChrome('글로컬대학사업, Bk21장학금: 2108'), true);

  /* 같은 공고가 '제목만'과 '제목+조회수·작성일'로 두 번 세어지던 것 (성균관·광운에서 실제로 발생) */
  eq('메타데이터가 붙은 같은 공고는 한 건으로 합친다', dedupeNear([
    '[한국장학재단] 2026학년도 2학기 국가장학금 2차 신청 안내 (8/12~9/9) NEW No.3080 학생지원팀 2026-08-12 조회수2199 첨부파일',
    '[한국장학재단] 2026학년도 2학기 국가장학금 2차 신청 안내 (8/12~9/9)',
  ]).length, 1);
  eq('다른 공고는 합치지 않는다', dedupeNear([
    '2026학년도 2학기 국가장학금 2차 신청 안내',
    '2026학년도 2학기 주거안정장학금 2차 신청 안내',
  ]).length, 2);

  const src = fs.readFileSync(new URL('collector/audit-coverage.mjs', root), 'utf8');
  /* 🔴 감사는 아무것도 고치지 않는다. 데이터를 만지면 감사가 만든 변화를 감사가 다시 재는
     순환이 생긴다. 쓰기는 자기 리포트 둘뿐이어야 한다. */
  /* 쓰기 대상을 **끝까지 따라가서** 확인한다. 인자가 변수면 그 선언을 찾아 실제 파일명을 본다 —
     변수 이름만 보면 `writeFileSync(histPath, …)`가 무엇을 쓰는지 알 수 없어 검사가 헛돈다. */
  const writeArgs = [...src.matchAll(/writeFileSync\(\s*([^,]+?)\s*,/g)].map((m) => m[1].trim());
  const resolveTarget = (arg) => {
    const lit = arg.match(/new URL\('([^']+)'/);
    if (lit) return lit[1];
    const decl = src.match(new RegExp(`(?:const|let)\\s+${arg.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}\\s*=\\s*new URL\\('([^']+)'`));
    return decl ? decl[1] : arg;                      // 못 따라가면 원문을 그대로 넘겨 실패하게 둔다
  };
  const writes = writeArgs.map(resolveTarget);
  /* 쓰기 파일이 늘면 이 검사가 실패한다 — 그때 '감사가 왜 그 파일을 쓰나'를 먼저 따져야 한다.
     (2026-08-17에 회전 커서가 늘어 둘 → 셋이 됐다. 셋 다 감사 자기 파일이다.) */
  eq('감사가 쓰는 파일이 셋뿐', writes.length, 3);
  eq('감사가 쓰는 파일은 자기 것뿐 (실제 파일명까지 확인)',
    writes.every((w) => /^coverage-(report\.md|history\.json|cursor\.json)$/.test(w)), true);
  eq('감사가 seen.json을 고치지 않는다', /writeFileSync\([^)]*seen/.test(src), false);
  eq('감사가 notices.json을 고치지 않는다', /writeFileSync\([^)]*notices/.test(src), false);
  // 주소를 못 받은 학교를 누락으로 세면 매일 같은 경고가 떠서 진짜 문제가 묻힌다
  eq('주소가 있는 게시판만 감사한다', /s\.boardUrl \? \[s\.boardUrl\] : null/.test(src), true);
  // '못 읽음'을 '괜찮음'으로도 '누락'으로도 단정하지 않는다 (동국대 교훈과 같은 계열)
  eq("못 읽은 게시판은 '판정 불가'로 다룬다", /verdict: 'unreadable'/.test(src), true);
  eq('학교 하나에 절대 시한이 있다', /withDeadline\(/.test(src) && /PER_SCHOOL_MS/.test(src), true);
  /* 원인을 가를 때 쓰는 수집기 그물은 수집기의 것과 **같아야** 한다.
     갈라지면 '키워드 밖'이라는 진단 자체가 거짓이 된다. */
  const audited = (src.match(/HARVEST_KEYWORDS = (\/[^\n]+\/);/) || [])[1];
  for (const f of ['collector/collect.mjs', 'collector/browser-collect.mjs']) {
    const k = (fs.readFileSync(new URL(f, root), 'utf8').match(/KEYWORDS = (\/[^\n]+\/);/) || [])[1];
    eq(`감사의 수집기 그물 사본이 ${f}와 같다`, audited === k, true);
  }
  const yml = fs.readFileSync(new URL('.github/workflows/audit-coverage.yml', root), 'utf8');
  eq('감사 워크플로가 리포트만 저장한다',
    [...yml.matchAll(/git add (\S+)/g)].every((m) => m[1].startsWith('collector/coverage')), true);
  // 상한을 넘긴 작업은 '실패'가 아니라 '취소'로 끝난다 — cancelled()가 없으면 알림을 건너뛴다
  eq('시간 초과에도 알림이 간다', /failure\(\) \|\| cancelled\(\)/.test(yml), true);
  // 수집 로봇과 같은 대기줄에 넣으면 감사가 조용히 취소된다
  eq('수집 로봇과 다른 대기줄을 쓴다', /group: audit-coverage/.test(yml), true);
  // 첫 실행은 20분 예산으로 16/41곳만 봤다 — 회전이 없으면 뒤쪽 학교는 영영 감사되지 않는다
  eq('감사도 학교 순서를 회전시킨다', /rotateOrder\(/.test(src) && /coverage-cursor/.test(src), true);
  eq('워크플로 저장 목록에 회전 커서가 있다', /git add collector\/coverage-cursor\.json/.test(yml), true);
  const jobCap = Number((yml.match(/^ {4}timeout-minutes:\s*(\d+)/m) || [])[1]);
  const auditBudget = Number((src.match(/AUDIT_BUDGET_MS \|\| (\d+)/) || [])[1]);
  eq('작업 상한이 감사 예산보다 크다', jobCap > auditBudget, true);
}

/* 목록 페이지 넘기기 (2026-08-17) — 1페이지만 읽어 상단 고정 공지에 밀린 실공고를 놓치던 것 */
console.log('\n■ 목록 페이지 넘기기 (1페이지 밖의 공고도 잡게)');
{
  // 이미 페이지 파라미터가 있으면 그것만 바꾼다 — 확실한 경우라 짐작하지 않는다
  const withParam = 'https://x.ac.kr/list.do?menuNo=1&pageIndex=1';
  eq('이미 있는 파라미터를 알아본다', existingPageParam(withParam).param, 'pageIndex');
  eq('그 파라미터만 바꾼다', pageUrl(withParam, 3, { kind: 'page', param: 'pageIndex' }).includes('pageIndex=3'), true);
  // artclList.do 계열은 '몇 번째 글부터'(offset)를 받는다 — 연세·외대·가천이 이 계열
  const artcl = 'https://www.yonsei.ac.kr/bbs/sc/58/artclList.do?findClSeq=257';
  eq('artclList 계열은 offset을 먼저 시도', pageCandidates(artcl, 2)[0].way.param, 'article.offset');
  eq('offset은 (페이지-1)×한페이지', pageUrl(artcl, 3, { kind: 'offset', param: 'article.offset', limit: 10 }).includes('article.offset=20'), true);
  // 한 페이지 크기가 주소에 적혀 있으면 그 값을 쓴다 (10건이 아닐 수 있다)
  eq('주소에 적힌 한 페이지 크기를 쓴다',
    pageUrl('https://x.ac.kr/artclList.do?pageUnit=20', 2, { kind: 'offset', param: 'article.offset' }).includes('article.offset=20'), true);
  eq('list.do 계열은 pageIndex를 먼저 시도', pageCandidates('https://x.ac.kr/list.do?menuNo=1', 2)[0].way.param, 'pageIndex');
  eq('후보에 원래 주소는 넣지 않는다', pageCandidates(artcl, 2).every((c) => c.url !== artcl), true);
  /* 🔴 '받아 왔지만 1페이지와 같다'를 걸러 내는 것이 이 기능의 안전장치다.
     게시판이 파라미터를 무시하면 1페이지가 한 번 더 오는데, 그걸 못 걸러 내면
     같은 공고를 몇 번씩 담는다(이슈 #75와 같은 유형). */
  const first = ['a', 'b', 'c', 'd', 'e'];
  eq('파라미터를 무시하는 게시판 = 같은 페이지', samePage(first, ['a', 'b', 'c', 'd', 'e']), true);
  eq('진짜 2페이지는 다른 페이지', samePage(first, ['f', 'g', 'h', 'i', 'j']), false);
  eq('아무것도 안 오면 다음 페이지가 없는 것', samePage(first, []), true);
  // 고정 공지가 모든 페이지에 얹혀 오는 게시판이 있다 — 겹침이 조금 있는 것은 정상
  eq('고정 공지가 겹쳐도 새 글이 있으면 다른 페이지', samePage(first, ['a', 'b', 'f', 'g', 'h']), false);
  // 안 되는 게시판은 매일 다시 헤매지 않는다. 다만 영구 포기도 아니다(게시판은 개편된다)
  eq('안 되는 게시판은 후보를 만들지 않는다', pageCandidates(artcl, 2, { ok: false }).length, 0);
  eq('오늘 확인했으면 다시 시도하지 않는다',
    shouldRetry({ ok: false, checkedAt: new Date().toISOString().slice(0, 10) }), false);
  eq('14일 지나면 다시 시도한다', shouldRetry({ ok: false, checkedAt: '2026-07-01' }, new Date('2026-08-17')), true);
  eq('기록이 없으면 시도한다', shouldRetry(null), true);
  eq('알아낸 방식이 있으면 그것만 쓴다',
    pageCandidates(artcl, 2, { ok: true, way: { kind: 'page', param: 'page' } }).length, 1);
  const root = new URL('../', import.meta.url);
  for (const f of ['collector/collect.mjs', 'collector/browser-collect.mjs']) {
    const src = fs.readFileSync(new URL(f, root), 'utf8');
    eq(`${f}가 2페이지 이후도 읽는다`, /readMorePages\(/.test(src), true);
    // 알아낸 것을 저장하지 않으면 매 실행 처음부터 헤맨다 (이슈 #79와 같은 유형)
    eq(`${f}가 알아낸 방식을 저장한다`, /pagination\.json/.test(src) && /writeFileSync\(pagePath/.test(src), true);
  }
  /* 브라우저 로봇에서는 '덤'이다 — 예산이 모자라면 손대지 않아야 한다.
     2026-08-16에 덤으로 붙는 재시도가 멈춰 그날 수집분 전체를 잃은 것과 같은 계열. */
  const bsrc = fs.readFileSync(new URL('collector/browser-collect.mjs', root), 'utf8');
  eq('브라우저 로봇은 예산이 모자라면 페이지를 더 안 읽는다',
    /if \(!budget\.hasRoom\(MIN_PER_TARGET_MS\)\) return \[\];/.test(bsrc), true);
  for (const f of ['.github/workflows/collect-scholarships.yml', '.github/workflows/browser-collect.yml']) {
    eq(`${f} 저장 목록에 페이지 기록이 있다`,
      /git add collector\/pagination\.json/.test(fs.readFileSync(new URL(f, root), 'utf8')), true);
  }
}

/* 학교별 공고 파일 (2026-08-17) — '학교당 16건'의 원인이던 전체 상한을 없앤 구조 */
console.log('\n■ 학교별 공고 파일 (로봇이 쓴 파일을 앱이 찾아갈 수 있나)');
{
  const root = new URL('../', import.meta.url);
  const req = createRequire(import.meta.url);
  const ME = req('../match-engine.js');
  eq('이름이 영숫자뿐 (이 저장소엔 한글 파일명이 하나도 없다)', /^n[0-9a-z]+$/.test(ME.noticeFileKey('한국외국어대학교')), true);
  eq('같은 학교면 같은 이름', ME.noticeFileKey('경희대학교'), ME.noticeFileKey('경희대학교'));
  eq('다른 학교면 다른 이름', ME.noticeFileKey('경희대학교') !== ME.noticeFileKey('고려대학교'), true);
  /* 🔴 이 검사가 이 절의 핵심이다. 로봇이 쓰는 파일 이름과 앱이 찾아가는 이름이 갈라지면
     **앱은 404를 조용히 넘기므로 오류 하나 없이 공고가 0건**이 된다. */
  const tmp = new URL('../.tmp-notices-test/', root);
  fs.rmSync(tmp, { recursive: true, force: true });
  publishBySchool([
    { school: '경희대학교', campus: '서울', title: 'a', url: 'https://k.kr/1', foundAt: '2026-08-17' },
    { school: '고려대학교', title: 'b', url: 'https://k2.kr/1', foundAt: '2026-08-17' },
  ], { dir: tmp });
  const wrote = fs.readdirSync(tmp).filter((f) => f !== 'index.json');
  const wants = ME.noticeFileFor('경희대학교').split('/').pop();
  eq('로봇이 쓴 파일을 앱의 규칙으로 찾을 수 있다', wrote.includes(wants), true);
  eq('학교 수만큼 파일이 생긴다', wrote.length, 2);
  // 색인은 사람이 읽으려는 것 — 한글 학교명이 파일 이름과 이어져 있어야 디버깅이 된다
  const idx = JSON.parse(fs.readFileSync(new URL('index.json', tmp), 'utf8'));
  eq('색인이 학교 이름과 파일을 이어 준다', idx.files['경희대학교'].file, wants);
  fs.rmSync(tmp, { recursive: true, force: true });
  /* 학교별 파일은 **다른 학교에 밀려 줄어들지 않는다** — 전체 상한이 없어진 것이 이 작업의 핵심.
     capNotices는 학교가 늘수록 학교당 몫을 함께 줄여 41곳에서 16건까지 조여졌다. */
  const many = [];
  for (let s = 0; s < 60; s += 1) for (let i = 0; i < 30; i += 1) many.push({ school: `학교${s}`, title: `t${i}`, url: `https://x.kr/${s}/${i}` });
  const split = splitBySchool(many);
  eq('학교가 60곳이어도 학교당 30건 그대로', split.get('학교0').length, 30);
  eq('학교당 상한은 지킨다', splitBySchool(many, 10).get('학교0').length, 10);
  // 분교가 본교 게시판을 함께 쓰면 본교 파일도 받아야 한다 (한양 ERICA·건국 글로컬·홍익 세종)
  eq('분교 학생은 본교 파일도 받는다',
    ME.noticeFilesForProfile({ school: '한양대학교 ERICA캠퍼스' }).includes(ME.noticeFileFor('한양대학교')), true);
  eq('본교 학생은 자기 파일 하나', ME.noticeFilesForProfile({ school: '고려대학교' }).length, 1);
  eq('학교가 없으면 받을 파일도 없다', ME.noticeFilesForProfile({}).length, 0);
  // 화면과 알림이 **같은 규칙**을 써야 한다 — 갈라지면 화면에 있는 공고를 알림이 모른다
  for (const f of ['app.js', 'sw.js']) {
    eq(`${f}가 학교별 파일 규칙을 쓴다`,
      /noticeFilesForProfile\(/.test(fs.readFileSync(new URL(f, root), 'utf8')), true);
  }
  // 옛 파일로 물러나는 길 — 아직 자기 학교 파일이 없는 학생의 화면이 비면 안 된다
  for (const f of ['app.js', 'sw.js']) {
    eq(`${f}에 옛 파일 폴백이 남아 있다`,
      /data\/notices\.json/.test(fs.readFileSync(new URL(f, root), 'utf8')), true);
  }
  for (const f of ['collector/collect.mjs', 'collector/browser-collect.mjs']) {
    const src = fs.readFileSync(new URL(f, root), 'utf8');
    // 자르기 **전** 목록으로 발행해야 한다 — 순서가 뒤집히면 학교별 파일도 16건으로 잘린다
    eq(`${f}가 상한을 적용하기 전 목록으로 발행한다`,
      src.indexOf('publishBySchool(beforeCap)') < src.indexOf('notices.items = capNotices('), true);
  }
}

/* 검수 후보 장부 (2026-08-17) — 앱 파일의 크기 상한에 밀린 공고가 조용히 사라지던 것 */
console.log('\n■ 검수 후보 장부 (상한에 밀려도 검수 대상은 잃지 않게)');
{
  const day = (d) => `2026-08-${String(d).padStart(2, '0')}`;
  const n = (u, extra = {}) => ({ url: u, title: 't' + u, foundAt: day(15), ...extra });
  const merged = mergeCandidates([n('https://a.kr/v?seq=1')], [n('https://a.kr/v?seq=2')], new Date('2026-08-17'));
  eq('새 공고와 옛 공고가 함께 남는다', merged.length, 2);
  // 같은 공고면 정보가 더 많은 판을 남긴다 — 수집기·중복 제거와 같은 규칙(preferNotice)
  const rich = n('https://a.kr/v?seq=1', { deadlineHint: '8/20까지', attachments: [{ name: 'x' }] });
  eq('같은 공고는 정보가 많은 쪽을 남긴다',
    mergeCandidates([n('https://a.kr/v?seq=1')], [rich], new Date('2026-08-17'))[0].deadlineHint, '8/20까지');
  // 60일 지난 것은 떨군다 — seen.json·실시간 공고와 같은 기간이어야 되살아나지 않는다
  const old = mergeCandidates([{ url: 'https://a.kr/v?seq=9', title: 'old', foundAt: '2026-05-01' }], [], new Date('2026-08-17'));
  eq('60일 지난 공고는 장부에서 떨어진다', old.length, 0);
  /* 순서가 흔들리면 내용이 같아도 git이 1MB 파일을 매번 새로 저장한다 (하루 2회 × 1년) */
  const a = mergeCandidates([], [n('https://a.kr/v?seq=2'), n('https://a.kr/v?seq=1')], new Date('2026-08-17'));
  const b = mergeCandidates([], [n('https://a.kr/v?seq=1'), n('https://a.kr/v?seq=2')], new Date('2026-08-17'));
  eq('입력 순서가 달라도 저장 순서는 같다', JSON.stringify(a) === JSON.stringify(b), true);
  const root = new URL('../', import.meta.url);
  for (const f of ['collector/collect.mjs', 'collector/browser-collect.mjs']) {
    const src = fs.readFileSync(new URL(f, root), 'utf8');
    eq(`${f}가 후보 장부에 남긴다`, /saveCandidates\(mergeCandidates\(loadCandidates\(\)\.items, freshAll\)\)/.test(src), true);
  }
  for (const f of ['.github/workflows/collect-scholarships.yml', '.github/workflows/browser-collect.yml']) {
    // 저장 목록에서 빠지면 매 실행 되살아났다 다시 사라진다 (이슈 #79와 같은 유형)
    eq(`${f} 저장 목록에 후보 장부가 있다`,
      /git add collector\/candidates\.json/.test(fs.readFileSync(new URL(f, root), 'utf8')), true);
  }
  // 검수 도구가 앱 파일이 아니라 장부를 봐야 한다 — 안 그러면 되살린 것이 화면에 안 나온다
  eq('검수 도구가 후보 장부를 읽는다',
    /collector\/candidates\.json/.test(fs.readFileSync(new URL('verify/list-unregistered.js', root), 'utf8')), true);
}

console.log('\n■ 절대 시한 (답이 안 오는 학교에서 로봇이 멈춰 서지 않게)');
{
  const late = new Promise((r) => { setTimeout(() => r('늦게 옴'), 200); });
  eq('시한 안에 못 끝내면 TIMED_OUT', (await withDeadline(late, 20)) === TIMED_OUT, true);
  eq('시한 안에 끝나면 원래 결과', await withDeadline(Promise.resolve('수집'), 50), '수집');
  eq('영영 안 끝나는 일도 반드시 돌아온다', (await withDeadline(new Promise(() => {}), 20)) === TIMED_OUT, true);
  /* 타이머를 안 걷어내면 다 끝난 뒤에도 프로세스가 안 죽는다 —
     저장까지 다 해 놓고 단계 상한에 걸려 '실패'로 끝나는 최악의 결말이 된다. */
  let cleared = 0;
  await withDeadline(Promise.resolve(1), 50, setTimeout, (h) => { cleared += 1; clearTimeout(h); });
  eq('일이 먼저 끝나면 타이머를 걷어낸다', cleared, 1);
  await withDeadline(new Promise(() => {}), 10, setTimeout, (h) => { cleared += 1; clearTimeout(h); });
  eq('시한에 걸렸을 때도 타이머를 걷어낸다', cleared, 2);
}

console.log('\n■ 예산 장치가 실제로 배선돼 있나 (되돌아가면 같은 사고가 난다)');
{
  const root = new URL('../', import.meta.url);
  const src = fs.readFileSync(new URL('collector/browser-collect.mjs', root), 'utf8');
  eq('브라우저 수집기가 예산 모듈을 쓴다', /from '\.\/harvest-budget\.mjs'/.test(src), true);
  eq('학교를 새로 시작하기 전에 남은 시간을 본다', /budget\.hasRoom\(MIN_PER_TARGET_MS\)/.test(src), true);
  eq('상세 방문에도 예산이 있다 (한 학교가 20분을 먹던 자리)', /detailBudgetMs/.test(src), true);
  eq('회전 커서를 저장한다 (안 하면 매번 같은 학교가 잘린다)', /nextCursor\(/.test(src) && /cursorPath/.test(src), true);
  /* 학교 하나를 새로 집어 들 최소 여유는 **그 학교의 최악치보다 커야** 한다.
     작으면 예산이 거의 다 됐는데도 학교를 시작해 상한을 넘긴다 — 2026-08-07에 실제로
     그렇게 취소됐다(2분 30초만 남은 줄 알고 재시도를 시작해 16분 30초를 씀).
     최악치 = 클릭 채집 예산 + 상세 방문 예산. */
  const num = (re) => Number((src.match(re) || [])[1]);
  const minPer = num(/MIN_PER_TARGET_MS \|\| (\d+)\)/);
  const clickCap = num(/const clickBudgetMs = (\d+);/);
  const detailCap = num(/DETAIL_BUDGET_MS \|\| (\d+)\)/);
  eq('세 값을 다 읽어냈다', [minPer, clickCap, detailCap].some(Number.isNaN), false);
  eq('학교 시작 여유가 한 학교 최악치(클릭+상세)보다 크다', minPer >= clickCap + detailCap, true);
  /* 예산은 '물어보는 장치'라 일이 끝나야 물어볼 수 있다. 학교 하나가 답을 안 주면
     아무도 못 물어보고 로봇이 멈춰 선다 — 2026-08-15~17에 3회 연속 그렇게 하루치를 잃었다.
     그래서 본 수집·재시도 **양쪽 다** 대답을 안 기다리고 끊는 시한이 걸려 있어야 한다.
     (8/16 08:29은 학교 17곳을 7분 50초에 다 돌고도 '재시도' 한 곳이 멈춰 전부 잃었다 —
      본 수집에만 걸면 그 사고는 그대로 다시 난다.) */
  eq('학교 한 곳에 절대 시한이 걸려 있다', /withDeadline\(harvestTarget\(/.test(src), true);
  eq('본 수집이 시한 장치를 거쳐 학교를 본다', /await harvestWithDeadline\(t,/.test(src), true);
  eq('재시도도 같은 시한 장치를 거친다', /await harvestWithDeadline\(f\.t,/.test(src), true);
  /* 시한이 '학교를 하나 더 집어도 되는 여유'보다 길면, 여유를 보고 시작한 학교가 그
     여유를 넘겨 예산 밖으로 흘러넘친다 — 약속과 장치가 어긋나면 장치가 무의미해진다. */
  const hardMs = num(/TARGET_HARD_MS \|\| (\w+)\)/) || minPer;   // 기본값이 MIN_PER_TARGET_MS면 같은 값
  eq('학교 절대 시한이 학교 시작 여유를 넘지 않는다', hardMs <= minPer, true);
  // 멈춘 학교를 또 두드리면 시한을 한 번 더 통째로 쓴다 — 재시도 목록에 넣지 않는다
  eq('멈춘 학교는 재시도 목록에 넣지 않는다', /if \(stalled\) hung\.push\(name\);\s*\n\s*else if \(!ok\) failedTargets\.push/.test(src), true);
  // 버려진 브라우저 작업이 프로세스를 붙잡아 '저장은 다 했는데 실패'로 끝나는 것을 막는다
  eq('저장을 마치면 스스로 끝낸다', /process\.exit\(0\)/.test(src), true);
  /* 재시도 패스도 로그를 남겨야 한다 — 없으면 시간을 어디서 썼는지 영영 못 본다.
     2026-08-17에 본 수집과 재시도가 같은 함수(harvestWithDeadline)를 쓰게 바뀌면서,
     로그는 그 함수 안에서 찍히고 재시도인지는 넘긴 표식으로 구분한다. */
  eq('학교마다 시작·끝을 실행 로그에 남긴다', /console\.log\(`\[\$\{[^`]*\}s\] ▶ \$\{tag\}`\)/.test(src), true);
  eq('실패 학교 재시도에도 실행 로그가 있다', /harvestWithDeadline\(f\.t, lines, f\.name, '\(재시도\)'\)/.test(src), true);
  const yml = fs.readFileSync(new URL('.github/workflows/browser-collect.yml', root), 'utf8');
  eq('워크플로 저장 목록에 회전 커서가 있다', /browser-cursor\.json/.test(yml), true);
  /* 작업(job) 상한은 들여쓰기 4칸, 단계(step) 상한은 8칸이다. 2026-08-04에 단계별 상한이
     생기면서 예전 정규식(`timeout-minutes` 첫 등장)이 단계 상한을 작업 상한으로 잘못 읽을
     수 있게 됐다 — 순서만 바뀌어도 검사가 통과해 버린다. 그래서 둘을 나눠서 읽는다. */
  const limit = Number((yml.match(/^ {4}timeout-minutes:\s*(\d+)/m) || [])[1]);
  const stepCaps = [...yml.matchAll(/^ {8}timeout-minutes:\s*(\d+)/gm)].map((m) => Number(m[1]));
  // 예산(22분)보다 넉넉히 커야 저장·감사·리포트 단계가 돌 시간이 남는다
  eq('워크플로 상한이 예산보다 크다', limit > 22, true);
  /* 상한은 '모든 단계 상한의 합 + 준비·저장 여유'를 담아야 한다. 이게 깨지면 마지막 단계들
     (저장·리포트)이 시작도 못 하고 작업이 취소되고, 취소는 그날 수집분을 통째로 버린다
     — 2026-08-04에 실제로 이렇게 이틀치 리포트가 사라졌다.
     2026-08-05: 수집 단계가 자체 상한을 갖게 되면서 수집 예산(22)은 그 상한 안에 포함됐다.
     여기서 22를 또 더하면 같은 시간을 두 번 세게 되므로 단계 상한만 합한다. */
  const OVERHEAD = 3;   // 체크아웃·playwright 설치·감사·저장·리포트
  eq('작업 상한이 단계 상한의 합 + 여유보다 크다',
    limit > stepCaps.reduce((a, b) => a + b, 0) + OVERHEAD, true);
  /* 수집 단계의 상한은 수집 예산보다 커야 한다 — 예산보다 작으면 스스로 마무리하기 전에
     잘려서 그날 수집분이 저장되지 않는다(안전망이 오히려 흉기가 된다). */
  const harvestCap = Math.max(...stepCaps);
  eq('수집 단계 상한이 수집 예산(22분)보다 크다', harvestCap > 22, true);
}

/* 원문을 짧게 자르면 자격 절이 통째로 날아간다 (2026-08-03 도입).
   deepfetch가 본문을 5,000자에서 자르고 있었다. 학교 홈페이지는 본문 앞에 메뉴·배너 글자가
   길게 붙어서, 잘린 공고 12건을 다시 받아 보니 **5건이 자격 절을 5,302~6,213자 지점**에
   두고 있었다. 저장된 615건 중 247건이 이 컷에 걸려 있었고, 그게 '자격 미확보' 84건 중
   32건의 원인이었다. 작은 컷이 되살아나면 같은 일이 조용히 반복된다. */
console.log('\n■ 원문 자르는 길이 (자격 절이 날아가지 않을 만큼 길어야 한다)');
{
  const root = new URL('../', import.meta.url);
  const cutLimit = (text) => {
    // 주석은 걷어내고 본다 — 설명에 적힌 옛 숫자를 코드로 착각하지 않도록
    const code = text.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    const m = code.match(/slice\(\s*0\s*,\s*(?:LIMIT|(\d+))\s*\)/);
    if (!m) return null;
    if (m[1] === undefined) {                      // slice(0, LIMIT) — 상수 값을 찾는다
      const c = code.match(/const\s+LIMIT\s*=\s*(\d+)/);
      return c ? Number(c[1]) : null;
    }
    return Number(m[1]);
  };
  const src = fs.readFileSync(new URL('collector/deepfetch.mjs', root), 'utf8');
  const lim = cutLimit(src);
  eq('deepfetch: 본문 컷이 10,000자 이상', lim !== null && lim >= 10000, true);
  // 검사가 잠들면 없느니만 못하다 — 옛날 코드를 넣어 보고 정말 잡는지 확인한다
  eq('  (자기검증) 옛 5000자 컷은 잡아낸다', cutLimit('const x = clean(t).slice(0, 5000);') >= 10000, false);
  eq('  (자기검증) LIMIT 상수 형태도 읽어낸다', cutLimit('const LIMIT = 15000;\nx.slice(0, LIMIT)'), 15000);
}

/* 2026-08-20 — 자격 요건이 '엉망'이라는 개발자 지적으로 고친 것들.
   발췌기는 불러오는 순간 실행되는 파일이라(이 저장소의 알려진 함정) 함수를 직접 부를 수 없다.
   그래서 위 '본문 컷'과 같은 방식으로 **원본 글자를 읽어** 규칙이 살아 있는지만 본다.
   숫자로 된 검증은 `node verify/eligibility-report.mjs`가 맡는다(전후 비교가 그 도구의 일). */
console.log('\n■ 자격 요건 발췌 규칙 (2026-08-20 수리분이 되돌려지지 않았는가)');
{
  const root = new URL('../', import.meta.url);
  const src = fs.readFileSync(new URL('collector/extract-excerpts.mjs', root), 'utf8');
  const code = src.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

  // ① 안 풀린 개체 문자가 절 경계를 막던 문제 — 저장된 원문에 실제로 있던 7종
  for (const e of ['diams', 'Dagger', 'rArr', 'sim', 'copy', 'ne', 'divide']) {
    eq(`  &${e}; 를 글자로 푼다`, code.includes(`&${e};`), true);
  }
  // ② 절 머리글 기호에 ♦(=&diams;)가 들어 있어야 "♦ 신청기간:"을 다음 절로 읽는다
  eq('  절 머리글 기호에 ♦ 가 있다', /SECT_PREFIX\s*=[^\n]*♦/.test(code), true);
  // ③ "3. 제출기한 : …" 같은 소제목을 다음 절로 알아본다
  for (const w of ['제출\\\\s?기한', '확인\\\\s?방법', '양식']) {
    eq(`  다음 절 낱말에 ${w.replace('\\\\s?', ' ')} 가 있다`, code.includes(w), true);
  }
  // ④ 자격 신호가 하나도 없는 블록은 쓰지 않는다(이화 양영재단이 제출서류를 자격으로 보여 줬다)
  eq('  요건 신호 없는 블록은 버린다', /REQ_SIGNAL\.test/.test(code), true);
  // ⑤ 표는 줄 단위로 못 가른다 — 재시도 금지 경고가 코드에 남아 있어야 한다
  eq('  표 파싱 재시도 금지 경고가 남아 있다', /표는 납작해지면서/.test(src), true);

  /* ⑥ 물러선 주소를 영영 버리지 않는다 (2026-08-20).
     '3번 실패하면 제외'만 있고 되돌아오는 길이 없어서, 물러선 주소가 줄지 않고 쌓이기만 했다
     (자격 미확보 81건 중 20건이 그 상태였다). 이 세 줄이 사라지면 그 상태로 되돌아간다. */
  const df = fs.readFileSync(new URL('collector/deepfetch.mjs', root), 'utf8');
  const dfCode = df.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  eq('  물러선 주소를 다시 두드릴 자리가 있다', /RETRY_SLOTS/.test(dfCode), true);
  eq('  실패가 적은 것부터 골라 회전한다', /retired\.sort\(\(a, b\) => a\.fails - b\.fails\)/.test(dfCode), true);
  // 8초에 걸려 물러선 것을 또 8초로 재면 결과가 바뀔 리 없다
  eq('  다시 두드릴 때는 넉넉히 기다린다', /patient \? 20000 : 8000/.test(dfCode), true);
}

/* 2026-08-20 — 유료 API 크레딧이 새던 세 자리. 되돌리면 같은 파일을 매 실행 다시 보낸다. */
console.log('\n■ 유료 API 크레딧 누수 방지 (2026-08-20)');
{
  const root = new URL('../', import.meta.url);
  const sf = fs.readFileSync(new URL('collector/schematize-forms.mjs', root), 'utf8');
  const code = sf.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  // ① 공고문·안내문은 학생이 채우는 신청서가 아니다 — API로 보내면 반드시 관문에 걸린다
  eq('  신청서가 아닌 첨부를 유료 경로에서 뺀다', /NOT_A_FORM\.test\(row\.attachment\)/.test(code), true);
  // ② 실패한 항목이 큐에 남아 매 실행 재전송되던 것 — 상한이 있어야 멈춘다
  eq('  자동 변환 실패가 쌓이면 재시도를 멈춘다', /apiTries/.test(code), true);
  // ③ effort 미지정이면 opus-5는 사고 켜진 채 high로 돈다(사고 토큰 = 출력 단가)
  eq('  사고 깊이를 지정한다(기본값이 가장 비싸다)', /output_config:\s*\{\s*effort:/.test(code), true);
}

/* 2026-08-20 — 자격 절을 어디서 끊나. 개발자가 "본문에 다 써 있는데 못 읽는 것 같다"고
   짚어 준 뒤 판 결과, 절 경계를 **길이로 재던 것**이 진짜 원인이었다.
   `EXCERPTS_AS_LIB=1`로 발췌기를 라이브러리처럼 불러 **규칙 함수를 직접 돌린다**
   (예전엔 불러오는 순간 본편이 실행돼 이런 검사를 못 썼다). */
console.log('\n■ 자격 절을 어디서 끊나 (2026-08-20)');
{
  process.env.EXCERPTS_AS_LIB = '1';
  const EX = await import(new URL('../collector/extract-excerpts.mjs', import.meta.url));

  /* 🔴 시립대 빅데이터 성과형 장학금 실제 사례.
     `가. 빅데이터 마이크로디그리 이수(예정)자`가 **정확히 20자**라, 옛 규칙
     ('떼어낸 본문 20자 이하 = 새 절 제목')이 자격 절 **첫 줄에서** 끊어 버렸다. */
  const real = ['3. 신청 자격',
    '가. 빅데이터 마이크로디그리 이수(예정)자',
    '- 빅데이터 교과목을 1과목 이상 수강해야 함',
    '나. 2026학년도 1학기 등록한 학부 재학생',
    '- 휴학생 및 대학원생 신청 불가',
    '4. 제출 서류'].join('\n');
  const got = EX.extractQualifyLines(real);
  eq('숫자 절 아래의 가./나. 는 하위 항목이지 다음 절이 아니다', got.length >= 4, true);
  eq('  첫 요건(정확히 20자)이 살아 있다', got.includes('가. 빅데이터 마이크로디그리 이수(예정)자'), true);
  eq('  같은 단계(4.)를 만나면 끊는다', got.some((l) => /제출 서류/.test(l)), false);

  /* 반대쪽도 지켜야 한다 — 같은 단계 번호를 만나면 반드시 끊어야 다음 절이 안 섞인다 */
  const sibling = ['가. 신청자격', '- 재학생으로 평점 3.0 이상인 자', '나. 제출서류', '- 성적증명서 1부'].join('\n');
  eq('한글 절 아래에서 같은 한글 단계를 만나면 끊는다',
    EX.extractQualifyLines(sibling).some((l) => /성적증명서/.test(l)), false);

  /* 2026-08-20 전수 읽기 — 미확보 60건의 본문을 사람이 다 읽고 찾은 나머지 구멍들.
     하나하나가 '원문에 자격이 뻔히 적혀 있는데 못 읽던' 실제 공고다. */
  const head = (l) => EX.extractQualifyLines(l.join('\n')).length;
  eq('응시자격 (종근당고촌)', head(['3. 응시자격', '가. 서울 소재 4년제 대학교 1~3학년에 재학 중인 자',
    '나. 이수학기 총 평점이 80점 이상인 자', '4. 지원혜택']) >= 2, true);
  eq('추천 조건 (이화 양영재단)', head(['2. 추천 조건', '가. 2학년 2학기 진학예정인 학부생',
    '나. 직전학년도 학업 성적이 2.80/4.30 이상인 학생', '3. 장학금액']) >= 2, true);
  eq('대 상 자 : (세종대 삼성기부 — 자간 공백까지)',
    head(['■ 대 상 자 : 사회적 배려가 필요한 자로 정규 잔여학기가 2개 학기 이상 남아있는 재학생']) >= 1, true);
  eq('N. 대상 : (홍익 교내봉사)', head(['1. 대상 : 홍익대 서울캠퍼스 재학생 중 결격사유가 없는 자',
    '① 직전학기 성적경고 또는 15학점 미만 이수한 학생은 신청 불가', '2. 선발인원 : 15명']) >= 2, true);

  /* 🔴 표 머리글이 **다음 절 판정보다 먼저** 걸러져야 한다 — 광운 국가고시장학금은
     자격 칸 바로 아래가 옆 칸 머리글 `장학금지급기간`이라 거기서 통째로 끊겼다. */
  eq('표 머리글(장학금지급기간)이 자격 절을 끊지 않는다',
    head(['1. 장학금 신청 자격 및 내용', '장학금지급기간',
      '① 국가공무원 5급 시험의 합격자', '② 직전학기 평량평균이 2.5 이상인 자']) >= 2, true);

  /* 🔴 '금액'이 제목 **뒤쪽**에 붙었다고 자격 절을 밀어내면 안 된다 (방송대 학업지속) */
  /* 🔴 한 줄에 뭉친 번호 항목 — 가톨릭대 산학협동재단의 요건이 **201자**로 들어와
     길이 상한(200)에 **딱 1자** 걸려 통째로 버려졌다. 상한을 올리는 게 아니라 나눈다
     (문턱에 딱 걸린 사고는 이번이 두 번째다 — 20자짜리 첫 요건도 같은 유형이었다). */
  eq('한 줄에 뭉친 1) 2) 3) 항목을 나눠 읽는다', head(['가. 선발기준',
    '1) 국내 4년제 대학 재학생 2) 부모가 모두 대한민국 국적이 아닌 외국인으로서, 부모 중 1명 이상이 '
    + '국내에서 근로를 목적으로 체류하며 현재 근로 중인 자의 자녀 3) 전체 이수학기 성적 우수자 우대 '
    + '(전체 평점평균 높은 순서대로 우선 선발) * 지원제한(제외대상) : 이중 수혜 해당 시 지원 불가',
    '나. 제출서류']) >= 3, true);
  eq('  짧은 줄의 1)은 문장 속 표기라 나누지 않는다',
    head(['신청 자격', '1) 재학생으로 평점 3.0 이상인 자']) >= 2, true);

  eq("'선발대상 및 지급금액' 제목이 밀리지 않는다",
    head(['1. 선발대상 및 지급금액', '￭ 2025년 2학기 신입생으로 입학하여 재학 중인 자',
      '￭ 직전학기 12학점 이상 이수자']) >= 2, true);
}

/* 2026-08-20 — 게시판 메뉴 걷어내기. 이건 순수 함수라 **진짜로 돌려서** 검사한다
   (발췌기와 달리 불러도 아무것도 실행되지 않는다). */
console.log('\n■ 게시판 메뉴 걷어내기 (2026-08-20)');
{
  const { buildBoilerplate, stripBoilerplate } = await import(new URL('../collector/page-boilerplate.mjs', import.meta.url));
  const menu = ['홈', '로그인', '학사안내', '오시는 길', '개인정보처리방침'];
  const page = (n, body) => ({ url: `https://a.ac.kr/view?id=${n}`, text: [...menu, ...body].join('\n') });
  /* 본문은 실제 공고만큼 길게 둔다 — 아래 안전판이 '너무 앙상하면 원문 유지'라
     짧은 시험 자료를 쓰면 걷어내기가 아예 일어나지 않아 검사가 헛돈다(실제로 그랬다). */
  const body1 = ['1. 지원자격',
    '가. 2026학년도 2학기 재학 예정인 학부생으로서 직전학기를 정상적으로 이수한 자',
    '나. 직전학기 평점평균이 3.0 이상이고 취득학점이 12학점 이상인 자(계절학기 제외)',
    '다. 다른 교내외 장학금을 등록금 전액 범위로 이미 받고 있지 않은 자'];
  const texts = [
    page(1, body1),
    page(2, ['공지 둘', '내용이 전혀 다른 두 번째 공고 본문입니다. 여기에는 자격 이야기가 없습니다.']),
    page(3, ['공지 셋', '세 번째 공고의 본문으로 앞의 것들과 겹치는 문장이 하나도 없습니다.']),
    page(4, ['공지 넷', '네 번째 공고의 본문이며 역시 다른 공고와 같은 줄이 없습니다.']),
  ];
  const boiler = buildBoilerplate(texts);
  const set = boiler.get('a.ac.kr');
  eq('여러 공고에 똑같이 나오는 줄을 메뉴로 본다', set && set.has('로그인'), true);
  eq('한 공고에만 있는 줄은 지우지 않는다', set && set.has('1. 지원자격'), false);
  const out = stripBoilerplate(texts[0].text, set);
  eq('메뉴만 사라지고 본문은 남는다', out.split('\n').join('|'), body1.join('|'));

  /* 🔴 표본이 적으면 판단하지 않는다 — 두세 건만 보고 지우면 본문을 지운다 */
  eq('공고가 적은 학교는 아무것도 지우지 않는다', buildBoilerplate(texts.slice(0, 2)).size, 0);

  /* 🔴 안전판 — 다 지워질 상황이면 원문을 그대로 돌려준다.
     '조금 지저분한 원문'은 고쳐 읽을 수 있지만 '내용이 사라진 원문'은 손쓸 수가 없다. */
  const allBoiler = new Set(['가', '나', '다']);
  eq('본문이 통째로 사라질 상황이면 원문을 그대로 둔다',
    stripBoilerplate('가\n나\n다', allBoiler), '가\n나\n다');
}

/* ── 신청서 질문 방식 최적화 (2026-08-18 개발자 지시) ──────────────
   지키려는 것: **묻는 방식만 바꾸고 문서는 그대로.** 아래가 깨지면 학생이
   같은 것을 신청서마다 다시 쓰거나(자동 채움 끊김), 성별에 남·여를 둘 다
   체크할 수 있게 되거나(단일 선택 끊김), 문서에 빈 칸이 나간다. */
console.log('\n■ 신청서 질문 설계기 (form-plan.js)');
{
  const FP = await import(new URL('../form-plan.js', import.meta.url));
  const T = JSON.parse(fs.readFileSync(new URL('../data/forms.json', import.meta.url), 'utf8')).templates;

  // ① 라벨 정규화 — 게시판마다 '성 명'·'성　명'·'1. 성    명'으로 적힌다
  eq('라벨 정규화: 공백·번호를 걷어낸다', FP.formLabelKey('1. 성       명'), '성명');
  eq('라벨 정규화: 전각 공백도 같은 값', FP.formLabelKey('성　명'), '성명');

  // ② 자동 채움 — 이게 끊기면 생년월일 20종·주소 30칸을 매번 다시 묻는다
  eq('자동 채움: 라벨로 프로필 열쇠를 찾는다', FP.formAutoKey({ label: '생년월일', type: 'text' }), 'birth');
  eq('자동 채움: 데이터에 적힌 auto가 우선', FP.formAutoKey({ label: '아무거나', type: 'text', auto: 'name' }), 'name');
  eq('자동 채움: 서술형은 프로필로 대신하지 않는다', FP.formAutoKey({ label: '성명', type: 'textarea' }), '');

  // ③ 단일 선택 — 원본이 '중복 선택 가능'이라 한 것은 절대 하나만 고르게 하지 않는다
  eq('단일 선택: 성별은 하나만',
    FP.formIsSingleChoice({ type: 'checks', label: '성 별', options: ['남', '여'] }), true);
  eq('단일 선택: 원본이 중복 가능이라 하면 여러 개 그대로',
    FP.formIsSingleChoice({ type: 'checks', label: '희망 대상 학교급', options: ['초등학교', '중학교', '고등학교'],
      suffix: '※ 중복 선택 가능' }), false);
  eq('단일 선택: 보기가 많은 항목은 건드리지 않는다',
    FP.formIsSingleChoice({ type: 'checks', label: '우선선발 대상자 여부',
      options: ['장애인', '다문화', '다자녀', '유공자', '중증환자', '육아', '기타'] }), false);

  // ④ 저장된 답 방어 — 타입이 바뀌어도 기기에 남은 답으로 문서를 다시 그릴 수 있어야 한다
  eq('옛 답 방어: 글자로 저장된 답이 선택형에서도 안 터진다',
    FP.formAnswerFor({ type: 'choice', options: ['남', '여'] }, '여').checks.join(''), '여');
  eq('옛 답 방어: 답이 없어도 모양은 맞춘다',
    Array.isArray(FP.formAnswerFor({ type: 'checks', options: ['남'] }, undefined).checks), true);

  // ⑤ 상한 — 전부 세어 개발자 지시(클릭 15·입력 10·전체 20)와 대조
  const rows = Object.entries(T).map(([k, v]) => ({ k, ...FP.formBudgetReport(v).counts }));
  eq('전체 질문 20개를 넘는 양식이 없다', rows.filter((r) => r.total > 20).length, 0);
  eq('클릭형 15개를 넘는 양식이 없다', rows.filter((r) => r.click > 15).length, 0);
  /* 직접입력 10개를 넘는 2종은 서술형이 7·9개라 더 못 줄인다 — 감사가 이름을 보고한다.
     늘어나면 새 양식이 최적화를 못 탄 것이니 여기서 잡는다. */
  eq('직접입력 10개를 넘는 양식이 2종 이하', rows.filter((r) => r.input > 10).length <= 2, true);

  // ⑥ 되풀이된 섹션이 남아 있지 않다 (로봇이 같은 첨부를 두 번 담던 문제)
  const dupes = Object.entries(T).filter(([, v]) => {
    const seen = new Set();
    return (v.sections || []).some((sec) => {
      const sig = (sec.fields || []).map((f) => FP.formLabelKey(f.label)).join('|');
      if (!sig) return false;
      if (seen.has(sig)) return true;
      seen.add(sig); return false;
    });
  });
  eq('같은 항목의 섹션이 되풀이된 양식이 없다', dupes.length, 0);

  // ⑦ 감사가 새 타입을 알고 있다 — 모르면 exit 1로 죽어 그날 수집분이 통째로 안 저장된다
  const audit = fs.readFileSync(new URL('../verify/audit-data.js', import.meta.url), 'utf8');
  eq('감사 FIELD_TYPES에 choice·group·static이 들어 있다',
    ['choice', 'group', 'static'].every((t) => audit.includes(`'${t}'`)), true);
}

/* 2026-08-20 — 중앙대 15건이 원문을 통째로 못 받던 원인은 게시판이 아니라 **요청 머리말**이었다 */
console.log('\n■ 공고를 받아올 때 쓰는 머리말 (2026-08-20)');
{
  const root = new URL('../', import.meta.url);
  const H = await import(new URL('collector/http-headers.mjs', root));
  eq('학생 브라우저와 같은 UA를 쓴다', /Chrome\/\d/.test(H.FETCH_HEADERS['User-Agent']), true);
  // 🔴 UA 꼬리에 봇 이름을 붙이면 중앙대가 실제로 거부했다(UND_ERR_SOCKET) — 신원은 From에 담는다
  eq('  UA에 봇 이름을 붙이지 않는다', /bot/i.test(H.FETCH_HEADERS['User-Agent']), false);
  eq('  대신 From 헤더로 신원을 밝힌다', /@/.test(H.FETCH_HEADERS.From || ''), true);
  for (const f of ['collector/deepfetch.mjs', 'collector/collect.mjs']) {
    const src = fs.readFileSync(new URL(f, root), 'utf8');
    eq(`  ${f.split('/').pop()} 가 같은 머리말을 쓴다`, /FETCH_HEADERS/.test(src), true);
    eq(`  ${f.split('/').pop()} 에 UA를 따로 박아 두지 않았다`, /'User-Agent':\s*'Mozilla[^']*compatible/.test(src), false);
  }
}

/* 2026-08-20 — 자바스크립트로 그리는 게시판(서강·부산·건국·명지)의 껍데기 문제 */
console.log('\n■ 껍데기 페이지와 브라우저 본문 (2026-08-20)');
{
  const root = new URL('../', import.meta.url);
  const NS = await import(new URL('collector/notice-source.mjs', root));
  const shell = 'K2Web Wizard L o a d i n g . . . --> 단축 url 글번호 1202730 [교외] 안내';
  const real = '신청 자격\n가. 2026학년도 2학기 재학 예정인 학부생으로서 직전학기를 이수한 자\n'
    + '나. 직전학기 평점평균이 3.0 이상이고 취득학점이 12학점 이상인 자(계절학기 제외)\n'
    + '다. 다른 교내외 장학금을 등록금 전액 범위로 이미 받고 있지 않은 자';
  /* 🔴 껍데기를 '원문 확보'로 세면 **문제가 있는 곳을 영영 못 찾는다** —
     자격을 못 읽는 원인이 '원문이 없어서'가 아니라 '규칙이 나빠서'인 것처럼 보였다. */
  eq('껍데기는 원문으로 세지 않는다', NS.hasText({ text: shell }), false);
  /* 문턱(한글 400자)을 확실히 넘겨서 잰다 — 아슬아슬한 자료를 쓰면 검사가 문턱을 재는지
     규칙을 재는지 알 수 없다(실제로 361자로 붙어 있다가 고쳤다). */
  eq('  본문이 딸려 온 것은 껍데기로 보지 않는다', NS.hasText({ text: shell + ' ' + real.repeat(8) }), true);
  eq('  멀쩡한 원문은 그대로 통과', NS.hasText({ text: real }), true);

  const U = 'https://a.ac.kr/view?id=1';
  const bodies = { [U]: { title: '가나다 장학금', text: real, at: '2026-08-20', via: 'browser' } };
  /* 브라우저 본문이 껍데기를 이겨야 한다 */
  const i1 = NS.indexTexts([{ url: U, title: '가나다 장학금', text: shell }], bodies);
  eq('브라우저 본문이 껍데기를 이긴다', /평점평균/.test(i1.byUrl.get([...i1.byUrl.keys()][0]).text), true);
  /* 🔴 반대로 멀쩡한 원문은 덮으면 안 된다 — 순서를 뒤집으면 여기서 걸린다 */
  const good = real + ' 추가로 저장돼 있던 온전한 원문입니다.';
  const i2 = NS.indexTexts([{ url: U, title: '가나다 장학금', text: good }], bodies);
  eq('  멀쩡한 원문은 브라우저 본문이 덮지 않는다',
    /추가로 저장돼 있던/.test(i2.byUrl.get([...i2.byUrl.keys()][0]).text), true);

  // 브라우저 수집기가 이미 그린 본문을 저장한다 (추가 페이지 열기 0회)
  const bc = fs.readFileSync(new URL('collector/browser-collect.mjs', root), 'utf8');
  eq('브라우저 수집기가 상세 본문을 저장한다', /bodies\[it\.url\]\s*=/.test(bc), true);
  eq('  심층 수집과 다른 파일에 저장한다(서로 지우지 않게)', /browser-bodies\.json/.test(bc), true);
}

/* 2026-08-20 — '목록 화면' 오인. 한쪽으로만 재면 반드시 다른 학교가 망가지는 자리라
   **양방향을 함께** 검사한다(중앙대를 살리는 것과 동국대를 지키는 것). */
console.log('\n■ 목록 화면인가 상세 화면인가 (2026-08-20)');
{
  const D = await import(new URL('../collector/detail-url.mjs', import.meta.url));
  const others = ['가송재단 장학생 모집 안내입니다 여기까지가 제목',
    '서울인재대학장학금 장학생 선발 공고 안내입니다', '해성문화재단 장학생 선발 안내 공고입니다'];
  // ① 진짜 목록 — 다른 공고 제목이 여럿 보이고 '이전글/다음글'이 없다 (동국 진담거사 사고 방지)
  eq('진짜 목록은 목록으로 본다', D.looksLikeList(others.join('\n') + '\n조회 등록일', others), true);
  /* ② 한 장에 목록과 상세가 함께 들어 있는 게시판(중앙대) — 멀쩡한 상세 12건이
        통째로 '목록'으로 탈락하고 있었다. `이전글/다음글`은 '글 하나를 보는 중'이라는 뜻이라
        목록 화면에는 나올 이유가 없다(중앙대·동국·경희 실측으로 확인). */
  eq('상세+목록이 한 장인 화면은 목록으로 보지 않는다',
    D.looksLikeList('찾는 공고 제목\n신청 자격 …\n이전글 다음글\n' + others.join('\n'), others), false);
  eq('  다른 제목이 적으면 애초에 목록이 아니다', D.looksLikeList(others[0], others), false);
  // ③ 규칙은 한 곳에만 — 복사본이 살아나면 두 로봇이 갈라진다
  for (const f of ['collector/link-hunter.mjs', 'collector/resolve-detail-urls.mjs']) {
    const src = fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');
    eq(`  ${f.split('/').pop()} 는 공용 규칙을 쓴다`, /looksLikeList[^\n]*detail-url|looksLikeList\s*\}/.test(src), true);
    eq(`  ${f.split('/').pop()} 에 복사본이 없다`, /function looksLikeList/.test(src), false);
  }
}

/* 2026-08-20 — 중간 인증서를 안 보내는 학교(계명대) 때문에 Node만 연결이 막히던 문제 */
console.log('\n■ 학교가 빠뜨린 중간 인증서 (2026-08-20)');
{
  const root = new URL('../', import.meta.url);
  const pem = fs.readFileSync(new URL('collector/certs/sectigo-server-auth-dv-r36.pem', root), 'utf8');
  eq('중간 인증서가 저장소에 있다', /BEGIN CERTIFICATE/.test(pem), true);
  for (const f of ['.github/workflows/collect-scholarships.yml', '.github/workflows/browser-collect.yml']) {
    const yml = fs.readFileSync(new URL(f, root), 'utf8');
    eq(`  ${f.split('/').pop()} 가 그 인증서를 쓴다`, /NODE_EXTRA_CA_CERTS:\s*collector\/certs\//.test(yml), true);
    /* 🔴 검증을 끄는 것이 아니다 — 이게 들어오면 아무 서버나 믿게 된다 */
    eq(`  ${f.split('/').pop()} 가 인증서 검증을 끄지 않는다`,
      /NODE_TLS_REJECT_UNAUTHORIZED|rejectUnauthorized:\s*false/.test(yml), false);
  }
  for (const f of ['collector/deepfetch.mjs', 'collector/collect.mjs', 'collector/browser-collect.mjs']) {
    const src = fs.readFileSync(new URL(f, root), 'utf8');
    eq(`  ${f.split('/').pop()} 가 인증서 검증을 끄지 않는다`,
      /NODE_TLS_REJECT_UNAUTHORIZED|rejectUnauthorized:\s*false/.test(src), false);
  }
}

/* 2026-08-20 — AI로 자격을 읽을 때의 지어냄 방지. **잔액 없이** 가짜 응답으로 검증한다
   (챗봇 AI 안전장치를 가짜 서버로 검증한 것과 같은 방식). */
console.log('\n■ AI 자격 읽기 안전장치 (2026-08-20)');
{
  process.env.ELIG_AI_AS_LIB = '1';
  const AI = await import(new URL('../collector/eligibility-ai.mjs', import.meta.url));
  const lines = ['3. 신청 자격', '가. 2026-2학기 재학 예정인 학부생', '나. 직전학기 평점평균 3.0 이상인 자',
    '4. 제출서류', '가. 성적증명서 1부', '5. 문의 : 02-1234-5678',
    '등록일 2026.06.02.', '조회 5464', '인재개발실', '포스터.png'];
  const v = (p) => AI.verifyPick(p, lines);
  eq('자격 줄만 고르면 채택', v({ none: false, lines: [0, 1, 2] }).ok, true);
  eq('  범위 밖 번호는 버리고 나머지는 살린다', v({ none: false, lines: [1, 2, 999] }).lines.length, 2);
  eq('  범위 밖만 주면 통째로 버린다', v({ none: false, lines: [999] }).ok, false);
  eq('  제출서류·문의는 자격이 아니다', v({ none: false, lines: [3, 4, 5] }).ok, false);
  /* 🔴 한글 뒤에는 \b(낱말 경계)가 듣지 않는다 — `^(등록일)\b`로 썼다가 하나도 안 걸렸다 */
  eq('  게시판 머리말·부서명·첨부명은 자격이 아니다', v({ none: false, lines: [6, 7, 8, 9] }).ok, false);
  eq('  요건 신호가 없으면 통째로 버린다', v({ none: false, lines: [0] }).ok, false);
  eq('  모른다(none)고 하면 그대로 둔다', v({ none: true, lines: [] }).ok, false);
  eq('  빈 응답도 버린다', v(null).ok, false);
  /* 🔴 이것이 이 파일의 존재 이유 — 모델이 글자를 보내도 화면에는 **앱이 제 원문에서 꺼낸 것**만 간다 */
  const made = v({ none: false, lines: [1], text: '최대 987654원 지급' });
  eq('  모델이 보낸 글자는 결과에 섞이지 않는다', JSON.stringify(made.lines).includes('987654'), false);
  // 기본은 꺼져 있어야 한다 — 켠 채로 배포되면 잔액이 조용히 샌다
  const cfg = JSON.parse(fs.readFileSync(new URL('../collector/eligibility-ai-config.json', import.meta.url), 'utf8'));
  eq('  기본은 꺼져 있다', cfg.enabled, false);
}

/* 2026-08-20 — 공고문 첨부에서 자격 읽기. 되돌리면 안 되는 지점이 셋이다. */
console.log('\n■ 공고문 첨부에서 자격 읽기 (2026-08-20)');
{
  const AT = await import(new URL('../collector/attachment-text.mjs', import.meta.url));
  /* ① 신청서·동의서는 읽지 않는다 — 읽으면 개인정보 수집 항목이 자격 자리에 앉는다
        (2026-08-20에 실제로 3건이 그렇게 돼 통째로 되돌린 적이 있다) */
  eq('공고문은 읽을 대상', AT.isNoticeDoc('2026년 장학생 선발 공고문.hwp'), true);
  eq('  신청서는 읽지 않는다', AT.isNoticeDoc('장학금 신청서.hwp'), false);
  eq('  개인정보 동의서도 읽지 않는다', AT.isNoticeDoc('개인정보 수집·이용 동의서.hwp'), false);
  eq('  선발원서도 서식이다', AT.isNoticeDoc('F_장학생 선발원서(제24기).docx'), false);
  /* ② PDF는 자격 경로에서 쓰지 않는다 — 글자가 정확히 안 나온다.
        실측: 원문 `3년 이상`이 `년이상`으로 뽑혔다. 숫자 하나가 결론을 바꾸는 글이다. */
  eq('  PDF는 자격 경로에서 쓰지 않는다', AT.attachmentText('없는파일.pdf'), '');
  /* ③ 문단 단위로 이어 붙인다 — 조각마다 줄을 나누면 `4년제`의 `4`가 버려져
        `년제 대학교 재학생`만 남는다(실제로 그렇게 나와서 고쳤다) */
  const docx = fs.readdirSync(new URL('../collector/extracted/', import.meta.url))
    .filter((f) => /^elig-.*\.docx$/.test(f))[0];
  if (docx) {
    const t = AT.attachmentText(new URL(`../collector/extracted/${docx}`, import.meta.url).pathname);
    eq('  docx는 문단 단위로 읽어 숫자가 안 빠진다', /\d년제/.test(t) || /\d\.\d\/\d\.\d/.test(t), true);
  } else eq('  (docx 표본 없음 — 건너뜀)', true, true);
  eq('  글자가 거의 없으면 읽을 만하지 않다고 답한다', AT.readable('가나다'), false);
}

/* 2026-08-20 — 개발자 지적: "지원 자격·공고 원문 안내가 전혀 말에 맞지 않는다."
   화면에 나가는 두 블록을 '사람이 정리한 것처럼' 만드는 규칙. */
console.log('\n■ 화면에 나가는 자격 줄 다듬기 (2026-08-20)');
{
  const ME = createRequire(import.meta.url)('../match-engine.js');
  const R = (lines) => ME.requirementLines(null, lines);
  /* 🔴 잘린 줄은 **버리지 말고 이어 붙인다** — 버리면 그 줄의 진짜 요건이 사라진다.
     화면에 이렇게 떠 있었다: `소득분위가 "기초생활수급자" 또는` (뒤가 없다) */
  const joined = R(['2026-2학기 정규학기 학부 재학생 및 복학예정자 중', '기초생활수급자']);
  eq('이어지는 줄을 붙여 문장을 완성한다', joined[0], '2026-2학기 정규학기 학부 재학생 및 복학예정자 중 기초생활수급자');
  eq('  잘린 채로 내보내지 않는다', joined.some((l) => /(또는|및|중)\s*$/.test(l)), false);
  // 표 칸·구분 머리표·배점은 자격이 아니다
  eq('표 칸은 버린다', R(['국가고시', '직전학기 평점평균 3.0 이상인 자']).length, 1);
  eq('  구분 머리표도 버린다', R(['(계속장학생)', '직전학기 평점 3.0 이상인 자']).length, 1);
  eq('  배점표도 버린다', R(['비교과프로그램참여 (30%)', '직전학기 평점 3.0 이상인 자']).length, 1);
  /* 🔴 자격 범주 이름은 짧아도 지킨다 — 그 자체가 요건이다(전수에서 2건이 이 경우였다) */
  eq('  북한이탈주민은 자격이라 지킨다', R(['북한이탈주민']).length, 1);
  eq('  국적 조건도 지킨다', R(['국적-몽골']).length, 1);
  // 사람이 정리한 것처럼 — 5줄이면 충분하다
  eq('  다섯 줄을 넘기지 않는다',
    R(['가. 재학생인 자', '나. 평점 3.0 이상인 자', '다. 9구간 이내인 자', '라. 12학점 이상인 자',
      '마. 휴학생이 아닌 자', '바. 초과학기가 아닌 자', '사. 졸업예정이 아닌 자']).length, 5);
}

console.log(fail ? `\n✕ 실패 ${fail}건 — 수집기 중복 제거 규칙이 깨졌습니다` : '\n✓ 수집기 규칙 전부 통과');
process.exit(fail ? 1 : 0);

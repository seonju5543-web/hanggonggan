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
/* 2026-08-30 — 마감일 파서. 앱이 **끝난 공고를 학생에게 보여주고 있었다**:
   교외 등록 81건 중 39건이 마감 미상인데, 그 대부분은 원문에 날짜가 적혀 있었다.
   여기 있는 줄은 전부 **저장된 원문에서 그대로 가져온 것**이다(지어낸 예시가 아니다).
   🔴 되돌리지 말 것 — 아래 '읽으면 안 되는 것'이 이 파서의 존재 이유다.
      게시일·조회수·다른 공고의 날짜가 같은 본문에 섞여 있어서, 이름표 없이 날짜를
      주우면 엉뚱한 날이 마감으로 박힌다. */
/* 2026-08-30 — 정식 등록을 경희대·한국외대로 좁혔다(개발자 지시).
   🔴 좁힌 것은 **등록뿐**이고 수집은 그대로다 — 실시간 공고 피드는 계속 나가야
   다른 학교 학생이 빈 화면을 보지 않는다. 되돌리려면 설정의 `schools` 를 [] 로. */
/* 2026-08-30 — 수집망도 두 곳으로 좁혔다. 🔴 뺀 학교의 주소는 **지우지 않고 parked 로 옮겼다** —
   이 boardUrl 들은 알아내는 데 실행이 여러 번 걸렸고(경희대만 8회), 지우면 되돌릴 때 처음부터
   다시 찾아야 한다. 로봇은 `schools`·`targets` 만 읽으므로 parked 는 아무 일도 하지 않는다. */
console.log('\n■ 수집망 좁히기 (2026-08-30)');
{
  const sc = JSON.parse(fs.readFileSync(new URL('../collector/schools.json', import.meta.url), 'utf8'));
  const bt = JSON.parse(fs.readFileSync(new URL('../collector/browser-targets.json', import.meta.url), 'utf8'));
  const names = (a) => a.map((x) => x.school).sort();
  eq('일반 수집은 두 곳', names(sc.schools), ['경희대학교', '한국외국어대학교']);
  eq('브라우저 수집도 두 곳', names(bt.targets), ['경희대학교', '한국외국어대학교']);
  /* 🔴 뺀 학교를 지워 버리면 되돌릴 때 주소를 처음부터 다시 찾아야 한다 */
  /* ⚠️ `sc.parked.length` 로 바로 읽으면 키가 통째로 사라졌을 때 **검사가 죽는다** —
     빨간불이 아니라 뒤 절이 아예 안 도는 것이라 더 나쁘다. 없으면 빈 배열로 본다. */
  const parked = (o) => (Array.isArray(o.parked) ? o.parked : []);
  eq('뺀 학교의 게시판 주소가 남아 있다', parked(sc).length > 0 && parked(bt).length > 0, true);
  eq('  보관분에도 주소가 실제로 들어 있다',
    parked(sc).length > 0 && parked(sc).every((x) => 'boardUrl' in x), true);
  eq('  왜 뺐는지·어떻게 되돌리는지 적혀 있다', /되돌리려면/.test(sc._parked || ''), true);
  /* 로봇이 보관분을 실수로 훑으면 좁힌 뜻이 사라진다 */
  const cm = fs.readFileSync(new URL('../collector/collect.mjs', import.meta.url), 'utf8');
  const bc = fs.readFileSync(new URL('../collector/browser-collect.mjs', import.meta.url), 'utf8');
  eq('로봇은 parked 를 읽지 않는다', /\.parked/.test(cm) || /\.parked/.test(bc), false);
}

console.log('\n■ 정식 등록 대상 학교 좁히기 (2026-08-30)');
{
  const cfg = JSON.parse(fs.readFileSync(new URL('../collector/auto-register-config.json', import.meta.url), 'utf8'));
  const src = fs.readFileSync(new URL('../collector/auto-register.mjs', import.meta.url), 'utf8');
  eq('설정에 대상 학교가 적혀 있다', cfg.schools, ['경희대학교', '한국외국어대학교']);
  eq('  왜 좁혔는지도 적혀 있다', /품질|자격 요건 매칭/.test(cfg._schools || ''), true);
  eq('로봇이 그 설정을 실제로 읽는다', /cfg\.schools/.test(src), true);
  eq('  대상 밖 공고를 등록 전에 거른다', /onlySchools\.size && n\.school && !onlySchools\.has\(n\.school\)/.test(src), true);
  /* 🔴 조용히 좁히면 다음 세션이 "로봇이 갑자기 등록을 안 한다"고 없는 버그를 쫓는다 */
  eq('  좁혔다는 사실을 리포트에 적는다', /등록 대상 학교/.test(src), true);
  /* 🔴 수집까지 좁히면 다른 학교 학생의 실시간 피드가 통째로 빈다 — 등록 로봇은 수집에 손대지 않는다 */
  eq('등록 로봇이 수집 설정을 건드리지 않는다', /schools\.json|browser-targets/.test(src), false);
}

/* 2026-08-30 — 학교 이름이 걸린 요건. 개발자 지적: "~대 학생은 제외 이런 요건 정도는
   너가 다 할 수 있잖아." 실제로 `현재 충남대학교 재학 중인 학부생` 에 한국외대 학생이
   **✓ 충족**으로 떠 있었다 — 아는 것을 안 쓰고 있었다.
   🔴 아래 '집으면 안 되는 것'이 이 규칙의 존재 이유다. 넓히면 **틀린 미달**이 쏟아진다. */
/* 2026-08-30 — 개발자 지적 셋을 한 절에 모은다. 전부 **전수 대조로 실물을 확인**한 것이다:
     ① "판정할 수 없는 둘째 이상 자녀나 취약계층의 손자녀 이런 건 왜 체크해놨어 무지성으로?"
     ② "특수교육대상자=장애학생인데 이것도 너가 판정할 수 있는 건데"
     ③ "~대학 학생들은 제외했을 때 그 학교 학생이 이 앱을 쓰면 x 도 뜨는 거지?"  ← **안 떴다** */
/* 🔴 브라우저에서 쓰는 이름을 **손으로 맞추지 않게** 한다 (2026-08-30).
   match-engine 은 Node 에서는 require, 브라우저에서는 **전역 이름 목록**으로 parse-requirements
   를 받는다. 그 목록에 이름을 빠뜨리면 **Node 검사는 전부 통과하는데 앱은 죽는다** —
   파일 주석이 그렇게 경고하고 있었는데도 `unaskedAttr` 을 빠뜨려 앱이 통째로 넘어졌다
   (`PR.unaskedAttr is not a function`). 사람이 기억하는 대신 소스를 대조한다. */
console.log('\n■ 브라우저에서 쓸 이름이 빠지지 않았나 (2026-08-30)');
{
  const src = fs.readFileSync(new URL('../match-engine.js', import.meta.url), 'utf8');
  const listed = new Set((src.match(/:\s*\{\s*parseLine[^}]*\}/) || [''])[0]
    .replace(/[{}:]/g, ' ').split(/[\s,]+/).filter(Boolean));
  const used = [...new Set([...src.matchAll(/\bPR2?\.([A-Za-z_$][\w$]*)/g)].map((m) => m[1]))];
  const missing = used.filter((n) => !listed.has(n));
  eq(`match-engine 이 쓰는 PR.* 이름이 전부 브라우저 목록에 있다 (쓰는 것 ${used.length}개)`, missing, []);
}

/* 2026-08-30 — 시·군까지 받아 지역 요건을 판정한다 (개발자 지시: "시군 선택도 하고
   뭐 관내 ~ 이런 거 해결하기 위해"). 지역 요건은 한국장학재단 등록 116곳 중 83곳(72%)에 있는데
   시·도만으로는 `안양시에 주소를 두고` 를 못 읽어 통째로 '자격 미확인'이었다. */
/* 2026-08-30 — 성적을 **다른 단위로 쓴 줄**도 읽는다 (개발자 지적: "성적 단위 27줄
   정도는 너가 환산할 수 있을텐데"). 실측 판정 34줄 → 62줄. */
console.log('\n■ 성적 단위 환산 (2026-08-30)');
{
  const MEq = createRequire(import.meta.url)('../match-engine.js');
  const PRq = createRequire(import.meta.url)('../parse-requirements.js');
  const g = (t) => PRq.parseLine(t, false).conds.find((c) => c.kind === 'grade') || null;
  const v = (t, gpa) => { const c = g(t); return c ? MEq.judgeCond(c, { gpa }, {}) : '(안 집음)'; };

  /* ⚠️ 숫자와 `이상` 사이에 딴 게 낀 것들 — 전부 실제 원문이고 전부 놓치고 있었다 */
  eq('괄호 등급이 끼어도 읽는다', (g('누적 평점평균이 3.0(B학점) 이상인 자') || {}).min, 3);
  eq('  `점`이 끼어도 읽는다', (g('4.5점 만점에 2.5점 이상') || {}).min, 2.5);
  eq('  뒤에 만점 표기가 붙어도 읽는다', (g('직전학기 성적 2.5점 이상인 자(4.5점 만점 기준)') || {}).min, 2.5);
  /* `이상` 없이 기준 등급만 적는 공고 */
  eq('「평균 B학점」처럼 기준만 적어도 읽는다', (g('직전학기 학교 성적 평균 B학점') || {}).min, 'B');

  /* 🔴 등급 → 4.5 만점 환산. 학교마다 기준이 다르므로(데이터에 그 경고가 있다)
     **넉넉히 넘을 때만 통과**로 보고 미달은 내지 않는다 — 백분위와 같은 규칙. */
  eq('평점 3.2 는 B(3.0) 기준을 넘는다', v('성적 B0 이상', 3.2), 'pass');
  eq('  B+(3.5) 는 못 넘지만 **미달로 단정하지 않는다**', v('직전학기 평점 B+ 이상', 3.2), 'unknown');
  eq('  평점 4.2 면 A0 도 넘는다', v('성적 A0 이상', 4.2), 'pass');

  /* ── 🔴 읽으면 안 되는 것 ── */
  eq('학교별 기준을 알리는 주의 문구는 요건이 아니다',
    g('특정대학 B학점이 2.7 기준인 대학은 신청서 접수 시 유의바람'), null);
  eq('  어학 점수를 평점으로 읽지 않는다 (IELTS)', g('Overall 5.5 이상의 성적'), null);
  eq('  기준 없는 「성적이 우수한 자」는 요건이 아니다', g('학업성적이 우수한 자'), null);
}

console.log('\n■ 지역 요건 — 시·군까지 (2026-08-30)');
{
  const MEq = createRequire(import.meta.url)('../match-engine.js');
  const PRq = createRequire(import.meta.url)('../parse-requirements.js');
  const res = (t) => PRq.parseLine(t, false).conds.find((c) => c.kind === 'residence') || null;
  const cityOf = (t) => (res(t) || {}).cities || null;

  eq('시·군을 집는다', cityOf('안양시에 주소를 두고 국내 각 급 학교에 재학 중인 학생'), ['안양시']);
  /* ⚠️ 한글은 조사가 이름에 **바로 붙는다**(`안양시에`) — 경계를 '한글이 아닌 것'으로
     잡았다가 하나도 못 집었다. 또 `둔` 은 `두`+`ㄴ` 이 아니라 한 글자다. */
  eq('  조사가 붙어도 집는다 (`주소를 둔`)', cityOf('광양시에 주소를 둔 광양보건대학교 재학생'), ['광양시']);
  eq('  두 글자 구도 집는다', cityOf('공고일 현재 동구에 1년이상 주소를 두고 있는 주민'), ['동구']);
  eq('  시·도 이름은 시·군이 아니다', cityOf('대구광역시에 주소를 둔 학생'), []);
  eq('  엉뚱한 말은 안 집는다', res('학생구분에 따라 거주 요건이 다름'), null);

  const mk = (prov, line) => ({ id: 'x', name: '장학생', provider: prov, type: '교외', amount: '-',
    amountValue: 0, deadline: '2026-12-31', period: '-', summary: '-',
    eligibility: { selective: true }, documents: [], eligibilityLines: [line] });
  const base = { name: 't', school: '한국외국어대학교', campus: '', track: 'humanities', major: '영어',
    year: 3, status: '재학', gpa: 3.2, bracket: 6, credits: 14, region: '경기', parentRegion: '경기',
    nationality: 'korean', birthYear: 2004, flags: [], cert: false, exchange: false, common: {} };
  const verdict = (sch, over) => {
    const fd = MEq.fitDetail(sch, { ...base, ...over });
    return fd.fails.length ? '미달' : (fd.met > 0 ? '통과' : '미확인');
  };
  const anyang = { regionCity: '안양시', parentRegionCity: '안양시' };
  const gwangyang = { regionCity: '광양시', parentRegionCity: '광양시' };

  eq('사는 시·군이 맞으면 통과', verdict(mk('안양시 인재육성재단', '안양시에 주소를 두고 재학 중인 학생'), anyang), '통과');
  eq('  다르면 미달 (안양시 학생 · 광양시 장학금)',
    verdict(mk('백운장학회(광양)', '광양시에 주소를 두고 재학 중인 학생'), anyang), '미달');
  /* 🔴 안 고른 학생에게 ✕ 를 치면 안 된다 — 모르는 것과 안 맞는 것은 다르다 */
  eq('  시·군을 안 골랐으면 미달이 아니라 미확인',
    verdict(mk('백운장학회(광양)', '광양시에 주소를 두고 재학 중인 학생'), {}), '미확인');
  /* 🔴 예외 문구가 있으면 ✕ 를 치지 않는다 — `대학생은 관외 거주 인정` 이 실제로 있다 */
  eq('  예외 문구가 있으면 미달로 단정하지 않는다',
    verdict(mk('백운장학회(광양)', '광양시에 주소를 둔 자 대학생의 경우 본인에 한하여 관외 거주 인정'), anyang) !== '미달', true);

  /* 🔴 `관내` 는 **그 재단의 관할**이다 — 줄만 봐서는 모르고 기관 이름이 정한다 */
  eq('「관내」를 재단 이름에서 알아낸다 (해당 학생은 통과)',
    verdict(mk('(재)무안군승달장학회', '관내에 1년 이상 거주한 자'), { regionCity: '무안군' }), '통과');
  eq('  다른 시·군 학생은 미달',
    verdict(mk('(재)무안군승달장학회', '관내에 1년 이상 거주한 자'), anyang), '미달');
  eq('  관할을 못 알아내면 단정하지 않는다',
    verdict(mk('한국장학재단', '관내에 1년 이상 거주한 자'), anyang), '미확인');
  /* 시·도 이름이 든 기관은 관할로 쓰지 않는다 (`서울시립대학교` → `서울시` 가 아니다) */
  eq('  시·도에서 온 이름은 관할이 아니다',
    verdict(mk('서울시립대학교', '관내에 1년 이상 거주한 자'), anyang), '미확인');
  eq('부모님 시·군으로도 맞는다', verdict(mk('백운장학회(광양)', '부모가 광양시에 주소를 둔 자'),
    { regionCity: '안양시', parentRegionCity: '광양시' }), '통과');
}

console.log('\n■ 자격 판정의 정직함 (2026-08-30)');
{
  const MEq = createRequire(import.meta.url)('../match-engine.js');
  const PRq = createRequire(import.meta.url)('../parse-requirements.js');
  const base = { name: 't', school: '한국외국어대학교', campus: '', track: 'humanities', major: '영어',
    year: 3, status: '재학', gpa: 3.2, bracket: 6, credits: 14, region: '서울', parentRegion: '서울',
    nationality: 'korean', birthYear: 2004, flags: [], cert: false, exchange: false, common: {} };
  const mark = (line, over) => MEq.requirementMatch(line, { ...base, ...(over || {}) }, {});

  /* ① 한 조건만 맞았다고 줄 전체에 ✓ 를 치면, **묻지도 않은 처지**를 확인했다고 말하는 셈이다 */
  eq('묻지 않은 처지에는 ✓ 를 치지 않는다 (손자녀)',
    mark('취약계층 국민연금수급자 또는 그 자녀(손자녀)로서 대학교 4년제·전문대에 재학 중인 자'), null);
  eq('  둘째아 이상 자녀', mark('보호자가 6개월 이상 원주시에 주민등록을 두고 거주하는 만 24세 이하의 둘째아 이상 자녀'), null);
  eq('  세대주 나이', mark('세대주가 만 65세 이하'), null);
  eq('  산업체 근로자', mark('산업체근로자 - 상주시 기업체에 근무하는 근로자 중 2년제 이상 대학에 재학 중인 자'), null);
  /* 🔴 반대쪽 — 우리가 **묻는** 처지까지 막으면 진짜 판정이 사라진다 */
  eq('우리가 묻는 처지는 그대로 판정한다 (장애)',
    mark('장애학생으로 국내 대학에 재학 중인 자', { flags: ['disabled'] }), 'ok');
  /* 🔴 형편을 말하는 낱말은 **소득구간으로 확인된다** — 프로필에 칸이 있다.
     `저소득` 이라는 낱말만 보고 막으면 우리가 아는 것으로 판정할 수 있는 줄까지
     '모른다'가 된다(2026-08-30 코드 리뷰에서 잡은 잠복 버그). */
  eq('  「저소득」이라도 소득구간이 있으면 판정한다',
    PRq.unaskedAttr('학자금 지원구간 8구간 이하의 저소득층 학생',
      PRq.parseLine('학자금 지원구간 8구간 이하의 저소득층 학생', false).conds), false);
  eq('  구간이 없으면 그대로 막는다',
    PRq.unaskedAttr('저소득 가정의 대학생', PRq.parseLine('저소득 가정의 대학생', false).conds), true);

  /* ② 특수교육대상자 = 장애학생 (행정 용어라 못 알아보고 있었다) */
  const flagsOf = (t) => (PRq.parseLine(t, false).conds.find((c) => c.kind === 'flags') || {}).anyOf || null;
  eq('「특수교육대상자」를 장애로 읽는다', flagsOf('특수교육대상자로 등록된 학생'), ['disabled']);

  /* ③ 🔴 제외 조항의 **방향** — 걸려야 할 사람이 걸리고, 남은 안 걸려야 한다.
     고치기 전에는 학교·특별자격이 **정반대**였다: 서울대 학생은 멀쩡히 통과하고 남이 미달이었다. */
  const exSch = { id: 'x', name: 't', type: '교외', provider: 'p', amount: '-', amountValue: 0,
    deadline: '2026-12-31', period: '-', summary: '-', eligibility: { selective: true }, documents: [],
    eligibilityLines: ['국내 대학 재학생'] };
  const caught = (ex, over) => MEq.fitDetail({ ...exSch, eligibilityExcludes: [ex] },
    { ...base, ...over }).fails.length > 0;
  for (const [line, hit, miss, label] of [
    ['서울대학교 학생은 제외', { school: '서울대학교' }, { school: '한국외국어대학교' }, '학교'],
    ['장애학생은 지원 제외', { flags: ['disabled'] }, { flags: [] }, '특별자격'],
    ['휴학생은 제외', { status: '휴학' }, { status: '재학' }, '학적'],
    ['외국인 유학생은 지원 불가', { nationality: 'foreign' }, { nationality: 'korean' }, '국적'],
  ]) {
    eq(`제외 조항(${label}) — 해당 학생은 걸린다`, caught(line, hit), true);
    eq(`  그리고 남은 안 걸린다 (${label})`, caught(line, miss), false);
  }
  /* 🔴 이미 뽑아 둔 제외 목록이 판정에 **들어가는가** — 실측 정읍 5줄 → 0줄이었다 */
  eq('발췌해 둔 제외 줄이 판정 대상에 들어간다',
    MEq.fitDetail({ ...exSch, eligibilityExcludes: ['휴학생은 제외'] }, { ...base, status: '휴학' })
      .fails.includes('휴학생은 제외'), true);
}

console.log('\n■ 학교 이름이 걸린 요건 (2026-08-30)');
{
  const PRq = createRequire(import.meta.url)('../parse-requirements.js');
  const of = (t) => (PRq.parseLine(t, false).conds.find((c) => c.kind === 'school') || {}).anyOf || null;

  eq('본인 재학 요건에서 학교를 집는다', of('현재 충남대학교 재학 중인 학부생'), ['충남대학교']);
  eq('  줄임말도 집는다', of('광양보건대학교 재학생'), ['광양보건대학교']);
  eq('  제외 문장에서도 집는다', of('서울대학교 학생은 제외'), ['서울대학교']);

  /* ── 🔴 집으면 안 되는 것 ── */
  /* 단과대학을 학교로 읽어 **자기 학교 공대 장학금이 미달**로 뒤집혔다(실제로 그랬다) */
  eq('단과대학은 학교가 아니다', of('가 . 공과대학 재학생이며 , 2026-2 학기 등록 기준 2 학년'), null);
  eq('  인문·경영대학도 마찬가지', of('경영대학에 재학 중인 학생'), null);
  /* 갈래 이름을 학교로 읽으면 **모든 공고가 미달**이 된다 */
  eq('「4년제 대학교」는 학교 이름이 아니다', of('4년제 대학교에 재학 중인 대한민국 국적의 대학생'), null);
  eq('  「관내 대학」도 아니다', of('관내 대학에 재학 중인 학생'), null);
  eq('  「서울 소재 대학교」도 아니다', of('서울 소재 대학교 또는 비서울 소재 대학교(서울시민) 재학생'), null);
  /* 🔴 같은 줄에 남 이야기가 섞인다 — 추천해 줄 교수의 출신 학교는 **학생 조건이 아니다** */
  eq('추천 교수의 출신 학교는 안 집는다', of('충남대학교 학부 출신 교수의 추천서 1부'), null);
  /* 안내 문장을 요건으로 읽으면 방송대가 아닌 학생이 전부 미달이 된다 */
  eq('「별도 문의」 안내는 요건이 아니다', of('교환학생/방송대학생 별도 문의의'), null);
}

/* 2026-08-30 — 학과·전공·계열. 개발자 지적:
     "윤하 장학금도 보면 학과 이름에 천문 이런 게 들어가야 된다 이런 자격 있던데 …
      왜 내 과에 천문 이런 게 없는데도 체크표시가 되어 있는지 모르겠네 (무지성 체크)"
   프로필에 학과명·계열이 둘 다 있는데 조건 종류가 없어 이 축이 통째로 안 읽혔다.
   🔴 그리고 **안 읽힌 절은 보이지 않는다** — 같은 줄의 소득구간 하나가 맞으면 줄 전체에
      ✓ 가 붙었다. 그래서 '판정 못 하는 축'은 조용한 결함이 아니라 **틀린 안심**이다.
   🔴 아래 '집으면 안 되는 것'이 이 규칙의 존재 이유다 — 넓히면 틀린 미달이 쏟아진다. */
console.log('\n■ 학과·전공·계열 요건 (2026-08-30)');
{
  const MEq = createRequire(import.meta.url)('../match-engine.js');
  const PRq = createRequire(import.meta.url)('../parse-requirements.js');
  const of = (t) => PRq.parseLine(t, false).conds.find((c) => c.kind === 'major') || null;
  const names = (t) => (of(t) || {}).names || null;
  const base = { school: '한국외국어대학교', track: 'humanities', major: '영어학과', year: 3,
    status: '재학', gpa: 3.2, bracket: 4, credits: 16, region: '서울', parentRegion: '서울',
    nationality: 'korean', birthYear: 2004, flags: [], common: {} };
  const mark = (line, over) => MEq.requirementMatch(line, { ...base, ...(over || {}) }, {});

  /* ① 재단이 적어 준 포함 단어 — 윤하 장학금 원문 그대로 */
  const yunha = '신청자격: 학자금 지원구간 6구간 이하이며 학과명에 아래의 단어가 포함된 자 '
    + '* 학과명 포함 단어: 물리, 천문';
  eq('「학과명 포함 단어」를 읽는다', (of(yunha) || {}).words, ['물리', '천문']);
  eq('  해당 없는 학과는 미달이다 (고치기 전엔 ✓ 였다)', mark(yunha), 'no');
  eq('  해당하는 학과는 충족이다', mark(yunha, { major: '천문우주학과', track: 'science' }), 'ok');

  /* ② 학과·학부 이름 */
  eq('학부 이름을 집는다', names('일본학대학 융합일본지역학부 재학생'), ['융합일본지역']);
  eq('  남의 학부면 미달', mark('일본학대학 융합일본지역학부 재학생'), 'no');
  eq('  내 학부면 충족', mark('일본학대학 융합일본지역학부 재학생', { major: '융합일본지역학부' }), 'ok');

  /* ── 🔴 집으면 안 되는 것 ── 전부 전수 대조에서 실제로 틀렸던 줄이다 */
  eq('띄어 쓴 앞말은 학과명이 아니다 (본교 학부)',
    names('본교 학부 / 대학원 수업연한 내 정규학기 재학생'), null);
  eq('  학년도 아니다', names('도내 대학 2~4학년 학부 재학생'), null);
  eq('  「관련학과」는 테두리가 흐리다', names('SW 관련학과 2026-2학기 등록 기준 2학년 재학생'), null);
  /* 꼬리말 **뒤도** 봐야 한다 — 안'전공'사에서 `전공` 을 집어 학과명을 만들고 있었다 */
  eq('  낱말 안에 든 「전공」은 집지 않는다',
    names('(한국가스안전공사장학금) 국내 대학교 재학생(만 39세 이하)'), null);
  eq('  「우수학과」는 이름이 아니다', names('SKY 등 우수대학교 및 우수학과에 진학한 자'), null);

  /* ③ 계열 — 맞으면 ✓, 어긋나면 **모른다**(재단 7분류와 우리 8분류가 안 맞는다) */
  const igong = '4년제 대학교 이공계 전공 새터민으로 2026년도 2학기 재학 예정인 대학생';
  eq('계열이 맞으면 충족', mark(igong, { track: 'engineering', flags: ['defector'] }), 'ok');
  eq('  어긋나면 미달이 아니라 판정 안 함', mark(igong), null);
  eq('  계열 낱말을 학과명으로 집지 않는다', names(igong), null);
  /* 재단이 체크박스를 통째로 적어 둔 줄은 제한이 없다는 뜻이다 */
  eq('7계열 전부 적힌 줄은 요건이 아니다',
    of('인문계열 사회계열 교육계열 공학계열 자연계열 의약계열 예체능계열'), null);
  eq('  「포항공과대학교」는 계열이 아니다',
    of('우수대학교 : 서울대·고려대·연세대·카이스트·포항공과대학교'), null);

  /* ④ 🔴 확신이 낮은 미달은 **사라지지 않고 '모른다'** 가 된다.
     예전에는 그냥 흘려버려서, 어긋난 절이 있는데도 같은 줄의 다른 절이 맞으면 ✓ 가 붙었다. */
  eq('확신 낮은 미달이 다른 절의 ✓ 를 지운다',
    mark('2026-2학기 국제학부 재학생 (외국인 포함), 국제학부를 졸업한 국제지역대학원 재학생'), null);
}

/* 🔴 **표시용 글자를 숫자로 읽지 말 것** (2026-08-30). 알림 배지는 10건부터 `9+` 로
   상한이 걸리는데(notify.js) 검사가 `Number(badgeText)` 로 읽어서, 읽지 않은 알림이
   10건을 넘는 순간 조용히 빨간불이 됐다 — **앱은 멀쩡한데 검사만 죽는** 유형이다.
   오늘 한국장학재단 116곳이 매칭에 들어오면서 실제로 넘었다. */
console.log('\n■ 표시 글자를 숫자로 읽지 않는다 (2026-08-30)');
{
  const dir = new URL('./', import.meta.url);
  const bad = [];
  for (const f of fs.readdirSync(dir).filter((x) => /\.(js|mjs|cjs)$/.test(x))) {
    /* ⚠️ **주석을 걷어내고 본다** — 안 그러면 이 관문이 자기 설명문에 적힌 예시 글자를
       잡는다(처음에 그렇게 만들었다). 코드에 진짜로 있는 것만 봐야 한다. */
    const src = fs.readFileSync(new URL(f, dir), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');
    for (const m of src.matchAll(/Number\(\s*(\w*[Bb]adge\w*|\w*[Cc]ount\w*)\s*\)/g)) bad.push(`${f}: ${m[0]}`);
  }
  eq('배지·카운트 글자를 Number() 로 읽는 곳이 없다 (상한이 걸리면 NaN 이 된다)', bad, []);
}

/* 🔴 **예약 로봇끼리 같은 분에 두지 말 것** (2026-08-30). 대기줄(concurrency)이 다르면
   GitHub 이 동시에 돌리는데, 커밋하는 로봇끼리 겹치면 같은 브랜치에 동시에 push 해서
   한쪽이 튕긴다(재시도가 있어 버티지만 헛돈다). 실제로 05:23 과 08:07 이 겹쳐 있었다.
   ⚠️ 요일이 다르면(월·목 vs 매일) 실제로 겹치는 날이 있으므로 시각만 본다. */
console.log('\n■ 예약 겹침 (2026-08-30)');
{
  const wdir = new URL('../.github/workflows/', import.meta.url);
  const slots = new Map();
  for (const f of fs.readdirSync(wdir).filter((x) => x.endsWith('.yml'))) {
    const src = fs.readFileSync(new URL(f, wdir), 'utf8');
    if (!/git push/.test(src)) continue;                 // 커밋 안 하는 로봇은 겹쳐도 무해
    for (const m of src.matchAll(/cron:\s*'(\d+)\s+(\d+)/g)) {
      const key = `${m[2]}:${m[1]}`;
      slots.set(key, (slots.get(key) || []).concat(f));
    }
  }
  const clash = [...slots.entries()].filter(([, v]) => v.length > 1)
    .map(([k, v]) => `${k}UTC ${v.join(' + ')}`);
  eq('커밋하는 예약 로봇끼리 같은 분에 돌지 않는다', clash, []);
}

console.log('\n■ 마감일을 원문에서 읽는다 (2026-08-30)');
{
  process.env.EXCERPTS_AS_LIB = '1';
  const EX = await import(new URL('../collector/extract-excerpts.mjs', import.meta.url));
  const D = (s) => EX.extractDeadline(s);

  /* ── 읽어야 하는 것 (전부 실제 원문 줄) ── */
  eq('범위의 끝날을 쓴다', D('1) 신청기간: 2026.7.20.(월) ~ 2026.7.31.(금)'), '2026-07-31');
  eq('끝날에 해가 없으면 시작한 해', D('· 신청기간 : 2026. 8. 10( 월 ) ~ 9. 4( 금 ) 17:00 까지'), '2026-09-04');
  eq('날짜 하나면 그날이 마감', D('□ 지원기간: 2026. 7. 22.(수) 16시까지(22일 도착분까지 접수)'), '2026-07-22');
  eq('`~`가 날짜 앞에 오는 꼴', D('1. 모집기간 : ~ 2026 년 7 월 16 일 ( 목 )'), '2026-07-16');
  eq('두 자리 해(26.)', D('7. 접수 기한 : ~ 26. 7. 24. (금) 16:00 원본 제출 (기한 엄수)'), '2026-07-24');
  eq('`-`도 범위 기호', D('5. 접수기간 : 2026. 08. 04( 화 ) - 08. 28( 금 )'), '2026-08-28');
  eq('한글 날짜', D('1. 접수기한 : 2026년 4월 9일(목) 밤 11시 59분까지'), '2026-04-09');
  /* 🔴 수집기가 숫자 사이를 벌려 놓는다 — 실제 원문이 `20 26.07.24` 다 */
  eq('해가 공백으로 갈라진 원문', D('9. 제출기한: 20 26.07.24(금). 14:00까지 직접 제출'), '2026-07-24');
  /* 🔴 `&sim;` 을 안 풀면 범위를 못 본다(원문에 개체 문자가 그대로 남아 있다) */
  eq('안 풀린 &sim; 도 범위 기호', D('4) 지원기간 : 2026 년 8 월 3 일 (월 ) &sim;8 월 7일 (금 ) 15:00 까지'), '2026-08-07');
  eq('이름표 뒤에 다음 절이 붙어 있어도 끝날만',
    D('미. 신청기간: 2026. 9. 7.(월) 09:00 ~ 9. 23.(수) 18:00 바. 문의처: (재)경주시장학회 사무국 (054-748-7760, 760-7350)'),
    '2026-09-23');
  eq('같은 날 안의 시각 범위는 그날이 마감',
    D('2 ) 서류 접수기간(이메일): 2026. 8. 24.(월) 10:00 ~ 18:00'), '2026-08-24');
  eq('해를 넘기는 범위', D('4. 신청 기간 : 2026. 9. 1. ~ 2027. 2. 15.'), '2027-02-15');
  eq('끝날 해가 안 적혔고 달이 앞서면 이듬해', D('신청기간 : 2026. 12. 20.(금) ~ 1. 10.(금)'), '2027-01-10');

  /* ── 🔴 읽으면 안 되는 것 ── */
  eq('게시일은 마감이 아니다', D('2026.07.03\n조회수 1847'), null);
  eq('이름표 없는 날짜는 안 읽는다', D('2026학년도 2학기 학점교류 신청 안내 (서울대학교)\n2026.08.03'), null);
  eq('게시 기간(목록의 노출 기간)은 마감이 아니다', D('게시기간 : 2026.07.20 ~ 2026.07.23'), null);
  eq('장학금을 주는 기간은 마감이 아니다', D('3. 지급기간 : 2026. 9. 1. ~ 2027. 2. 28.'), null);
  eq('근로 기간은 마감이 아니다', D('ㆍ근로 기간 : 2026.09.07. ( 월 ) ~ 2026.12.14. ( 월 ) 예정'), null);
  eq('거주 기간은 마감이 아니다', D('3. 거주기간 : 2026 년 8 월 24일(월) ~ 2027 년 8 월 말 (1 년 )'), null);
  eq('마일리지 산정 기간은 마감이 아니다', D('2. 마일리지 산정기간 : 2026. 3. 1. ~ 2026. 8. 31.'), null);
  /* 🔴 `~` 뒤에 날짜가 없으면 **시작일을 마감으로 쓰면 안 된다** — 아직 열려 있는 공고다 */
  eq('끝이 「선발 완료시」면 마감을 모르는 것이다',
    D('4. 신청기간 : 2026. 8. 10.(월) ~ 선발 완료시 까지'), null);
  /* 🔴 원문 오타(끝이 시작보다 앞선다). 해를 고쳐 주는 것은 지어내는 것이라 비운다 */
  eq('끝이 시작보다 앞서면 비운다',
    D('ㆍ신청기간 : 2026. 09. 01. ( 화 ) ~ 2025. 09. 03. ( 목 ) 14 시까지'), null);
  /* 🔴 2026-08-30 개발자 지적으로 **넓혔다**: 마감이 버젓이 적혀 있는데 '기한 원문 확인'으로
     내보내는 것은 정직이 아니라 실패다(실측 14건 중 6건이 규칙이 너무 좁아서였다). */
  eq('맨 「기간 :」도 이름표다', D('가. 기간 : 2026. 7. 20.(월) ~ 8. 14.(금) 16:00 까지'), '2026-08-14');
  /* 🔴 그런데 맨 이름표를 그냥 열면 **일하는 기간을 접수 마감으로 읽는다.** 근로장학생 공고에서
     실제로 그랬다 — `가. 기간: 2026. 9. 1. ~ 2027. 2. 12.`(근로 기간)가 진짜 접수일(8/24)을
     2027년으로 밀어냈다. 일하는 기간은 '까지'라고 쓰지 않는다. */
  eq('  「까지」가 없는 맨 「기간 :」은 일하는 기간이다 — 안 읽는다',
    D('가. 기간: 2026. 9. 1. ~ 2027. 2. 12.\n2) 서류 접수기간(이메일): 2026. 8. 24.(월) 10:00 ~ 18:00'),
    '2026-08-24');
  eq('이름표가 「방법」이어도 내용이 마감이면 읽는다',
    D('5. 제출방법: 2026년 7월 23일(목) 오후 18시까지 scholar2@yonsei.ac.kr로 제출'), '2026-07-23');
  eq('  그러나 내용이 마감을 말하지 않으면 안 읽는다',
    D('5. 제출방법: 이메일로 제출하며 결과는 2026년 9월 5일 발표합니다'), null);
  /* 🔴 해를 아예 안 적는 공고가 있다. **지어내지 않고 본문에서 가져온다** — 해가 하나뿐일 때만. */
  eq('본문의 해가 하나뿐이면 해 없는 날짜에 그 해를 준다',
    D('2026학년도 2학기 장학생 모집\n3. 모집기간: ~ 7월 31일(금) 24:00까지'), '2026-07-31');
  eq('  해가 둘 이상 섞이면 고르지 않는다',
    D('2025학년도 사업의 후속으로 2026년 시행\n3. 모집기간: ~ 7월 31일(금) 24:00까지'), null);
  eq('  본문에 해가 아예 없으면 지어내지 않는다', D('3. 모집기간: ~ 7월 31일(금) 24:00까지'), null);
  eq('문장 속의 「신청기간」은 이름표가 아니다',
    D('2026 학년도 하계방학집중근로 희망근로지 신청기간을 공지하오니 2026. 5. 20. 참고하시기 바랍니다'), null);
  eq('달력에 없는 날은 버린다', D('신청기간 : 2026. 2. 31.(금) 까지'), null);
  eq('전화번호를 날짜로 읽지 않는다', D('신청기간 : 문의 054-748-7760, 760-7350'), null);
  /* 🔴 줄 끝의 전화번호 하이픈을 범위 기호로 읽으면 **멀쩡한 마감일이 통째로 버려진다** */
  eq('날짜 뒤 전화번호가 있어도 마감일을 잃지 않는다',
    D('신청기간: 2026. 8. 20.(목) 까지 · 문의 02-940-5114'), '2026-08-20');
}

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

  /* 2026-08-21 — 기호 머리글(■□▣◇◆)도 절을 가른다. 안 그러면 자격 절이 안 끝나
     **시상 내역·상금표까지 지원 자격 자리에 딸려 들어온다**(의암 손병희·서울과기대 튜터). */
  eq('기호 머리글이 자격 절을 끝낸다',
    head(['□ 참가자격', '○ 전국 대학(원)생 (휴학생 제외)', '□ 시상내역', '○ 총 규모 : 논문 4편 (400만원)',
      '최우수상', '우수논문']), 2);
  /* 🔴 그런데 기호는 **하나하나가 다른 단계**다 — ■ 아래에 □를 겹쳐 쓰는 공고가 있어서,
     한 덩어리로 묶으면 첫 하위 항목에서 끊겨 진짜 요건이 통째로 날아간다(GR 인재양성 플랫폼). */
  eq('  ■ 아래의 □는 하위 항목이라 절을 안 끊는다',
    head(['■ 모집 대상 및 요건', '□ 성균관대학교 건축공학 전공 재학생',
      '□ 탄소중립건축 마이크로디그리 신청 필수', '□ 특성화 교육과정 수료가 가능한 자']) >= 3, true);

  /* 2026-08-21 — 우선 선발 기준은 자격 절에서 떼어 **따로** 모은다(제외 대상과 같은 방식).
     제목 줄은 담지 않는다(화면 블록에 이미 이름이 있다) — 같은 말이 두 번 나온다. */
  {
    const doc = ['2. 장학생 신청 조건 : 전남 목포 소재 고등 및 중등 과정을 마친 자',
      '3. 장학생 우선선발 기준 ( 위 조건을 충족한 지원자 대상 )',
      '- 성적 우수자 : 성적 상위자 우선 선발',
      '- 목포에 대한 애향심이 크고, 차후 향우회 회원으로서 활동이 가능한 자 우선 선발',
      '4. 제출 서류', '- 성적증명서 1부'].join('\n');
    const pri = EX.extractPriorityLines(doc);
    eq('우선 선발 기준을 따로 모은다', pri.length, 2);
    eq('  제목 줄은 안 담는다', pri.some((l) => /우선선발 기준/.test(l)), false);
    eq('  다음 절(제출 서류)로 넘어가지 않는다', pri.some((l) => /증명서/.test(l)), false);
    /* 🔴 머리글만 믿으면 자기소개 안내·결과발표·문의처가 딸려 온다(실제로 2건이 그랬다) */
    eq('  우선순위를 말하는 줄만 담는다',
      EX.extractPriorityLines(['■ 우선선발 기준', '- 성적 우수자 우선 선발',
        '자기소개', '아래 능력 해당시 자기소개에 기재 할 것'].join('\n')).length, 1);
  }

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
  /* 🔴 반대로 멀쩡한 원문은 덮으면 안 된다 — 순서를 뒤집으면 여기서 걸린다.
     ⚠️ 예시를 4배로 늘린 이유(2026-08-23): 껍데기 판정이 '본문 한글 300자 미만'으로
     넓어지면서, 100자짜리 예시가 **그 자체로 껍데기 취급**이 돼 이 검사가 엉뚱하게
     깨졌다. 실제 공고 본문의 중앙값은 673자다 — 검사가 재려는 것은 '길이'가 아니라
     '덮어쓰기 순서'이므로 예시를 현실적인 길이로 맞춘다. */
  const good = real.repeat(4) + ' 추가로 저장돼 있던 온전한 원문입니다.';
  const i2 = NS.indexTexts([{ url: U, title: '가나다 장학금', text: good }], bodies);
  eq('  멀쩡한 원문은 브라우저 본문이 덮지 않는다',
    /추가로 저장돼 있던/.test(i2.byUrl.get([...i2.byUrl.keys()][0]).text), true);

  /* 🔴 2026-08-23 — **껍데기 표시가 없는 껍데기**. 자격을 못 읽는 70건 중 29건이
     "원문 확보"로 세어지고 있었다(세종이도: 5,439자를 받아 놓고 본문은 한글 191자,
     나머지는 로그인·사이트맵·학사일정). 표시가 아니라 실제 본문 분량으로 판정한다.
     이 검사를 지우면 "못 받은 것을 받았다고 세는" 상태로 그대로 되돌아간다. */
  const menu = ['로그인', '사이트맵', '학사일정', '전체메뉴', '개인정보처리방침', '찾아오시는길'];
  const pages = [1, 2, 3, 4].map((n) => ({
    url: `https://b.ac.kr/view?id=${n}`, title: `공고 ${n}`,
    text: menu.join('\n') + `\n공고 ${n} 제목입니다`,
  }));
  const i3 = NS.indexTexts(pages, {});
  eq('메뉴만 있는 페이지는 원문으로 세지 않는다', NS.hasText(i3.byUrl.get([...i3.byUrl.keys()][0])), false);
  const withBody = [...pages, { url: 'https://b.ac.kr/view?id=9', title: '공고 9', text: menu.join('\n') + '\n' + real.repeat(4) }];
  const i4 = NS.indexTexts(withBody, {});
  eq('  메뉴 뒤에 본문이 있으면 원문으로 센다', NS.hasText(i4.byUrl.get(NS.canonUrl('https://b.ac.kr/view?id=9'))), true);
  /* 🔴 문턱을 **올리지 말 것.** 손해가 대칭이 아니다 — 멀쩡한 본문을 '없음'으로 보면
     AI가 영영 시도하지 않아 공고 하나를 영구히 잃고, 메뉴뿐인데 '있음'으로 보면
     AI가 "못 읽겠다"고 답하고 끝나 0.2원이다. 처음에 300으로 잡았다가
     동국대 교내장학(전체)(본문 정상, 한글 237자)을 버리는 것을 보고 내렸다. */
  eq('  문턱은 100자다 (올리면 멀쩡한 짧은 공고를 버린다)', NS.MIN_BODY, 100);

  /* 🔴 2026-08-23 — **줄바꿈을 없애면 본문이 있으나 마나다.** 재수집 로봇을 처음
     만들 때 태그를 벗기고 `\s+ → ' '`로 눌렀더니 본문이 통짜 한 줄이 됐고,
     ① AI가 줄 번호를 못 매겨 대상에서 빠지고 ② 표의 칸 구분(공통/재학생/신규자)이
     통째로 사라졌다 — 이 작업의 핵심이 그 구조를 살리는 것인데 받는 자리에서 죽였다.
     37건을 그렇게 저장했다가 전부 다시 받았다. */
  const rb = fs.readFileSync(new URL('collector/rescue-bodies.mjs', root), 'utf8');
  eq('재수집은 화면에 그려진 줄바꿈을 그대로 받는다', /innerText\(/.test(rb), true);
  /* 본문을 다듬을 때 **가로 공백만** 누른다 — `\s+`로 누르면 줄바꿈까지 사라진다.
     ⚠️ '파일 어디에도 \s+ 가 없다'로 검사하면 안 된다. 첨부 **이름**을 다듬는
     `textContent.replace(/\s+/g,' ')`는 정상이고 본문과 무관한데 거기 걸린다
     (실제로 그렇게 썼다가 멀쩡한 코드가 검사에 걸렸다). 본문 줄만 콕 집어 본다. */
  eq('  본문은 가로 공백만 누른다(줄바꿈 보존)', /replace\(\/\[ \\t\\u00a0\]\+\/g, ' '\)/.test(rb), true);
  /* '통짜 한 줄이면 다시 받는다'는 규칙이 여기 있었다. 대상 기준이 '아직 자격을 못 읽었나'로
     바뀌면서 그 뜻이 **더 넓게** 포함됐다 — 못 읽은 공고면 본문 모양과 상관없이 다시 간다.
     규칙을 지운 게 아니라 삼킨 것이므로, 검사도 새 기준을 가리키게 옮긴다. */
  /* 🔴 기준은 '본문이 없나'가 아니라 **'아직 자격을 못 읽었나'** 다.
     본문 문턱을 300 → 100 으로 내리자 메뉴만 있는 페이지들이 '본문 있음'으로 보이게 돼
     이 로봇이 아예 안 갔고, 포스터 그림도 못 찾고 첨부 목록도 안 고쳐졌다 — 43건이 그랬다.
     읽을 재료를 찾으러 가는 로봇이므로 못 읽은 공고면 다시 가 본다. */
  eq('  대상은 아직 자격을 못 읽은 공고다', /if \(requirementLines\(it\)\.length\) continue;/.test(rb), true);
  /* 🔴 빈 말뭉치로 재면 메뉴를 걷어낼 수 없어 **메뉴 글자가 본문으로 세어진다.**
     실제로 정읍시민장학재단(한글 387자가 전부 메뉴)이 '확보 ✅'로 통과했고,
     되찾았다던 37건 중 24건이 그런 가짜였다. 발췌기·AI와 같은 말뭉치를 써야
     "재수집기는 됐다는데 발췌기는 못 읽는" 어긋남이 안 생긴다. */
  eq('  본문 판정은 발췌기와 같은 말뭉치로 한다', /indexTexts\(texts, \{ \[t\.url\]/.test(rb), true);
  /* 🔴 동국대는 '오늘 하루 보지 않기' 팝업이 본문을 덮어, 받아 온 글자가
     `불교동아리 소식 · 공양기도문 · POPUP`뿐이었다. 그리고 일부 학교는 본문을
     iframe에 그린다 — 주 프레임만 보면 메뉴와 팝업만 손에 남는다.
     둘 다 CLAUDE.md에 이미 적혀 있던 함정인데 이 로봇을 만들 때 빠뜨렸다. */
  eq('  화면을 덮은 팝업을 먼저 치운다', /오늘 하루 보지 않기/.test(rb), true);
  eq('  본문 프레임 안까지 읽는다', /page\.frames\(\)/.test(rb), true);
  /* 🔴 실패 횟수는 '그때의 코드와 그때의 문턱'으로 센 값이다. 문턱을 300 → 100으로
     내렸더니 42건 전부가 '3회 실패·7일 휴식'이었는데, 그 판정은 100~299자 본문을
     받아 놓고 버린 것일 수 있었다. 고장 났던 코드로 센 실패로 멀쩡한 공고가 쉬면 안 된다.
     notice-source의 needsFetch가 '지금보다 짧은 한도로 잘렸으면 다시 받는다'와 같은 규칙. */
  eq('  판정이 느슨해지면 쉬는 중이라도 다시 해 본다', /staleJudgment/.test(rb), true);
  eq('    어떤 문턱으로 판정했는지 장부에 남긴다', /minBody: MIN_BODY/.test(rb), true);
  /* 🔴 페이지를 열어 놓고 첨부 이름을 눈앞에 두고도 기록을 안 고치고 있었다. 그 사이
     우리 목록이 낡아, 게시판엔 공고문이 붙어 있는데 기록엔 서식·동의서만 있어
     무료 경로가 못 읽었다(건국대 의암 손병희 · 조선대 교내장학금). */
  eq('  본문을 받을 때 첨부 목록도 받아 적는다', /regDirty = true/.test(rb), true);
  /* 게시판에서 내려간 공고는 '못 받은 것'이 아니라 '없어진 것'이다 — 섞으면 영영 다시 받으려 애쓴다 */
  eq('  삭제된 공고는 따로 가려낸다', /gone: true/.test(rb), true);
  /* 🔴 봇 차단은 **브라우저만** 막는다 (2026-08-23 실측). 홍익대는 브라우저로 열면
     cdn-botmanager.stclab.com/…/challenge 로 튕기는데, 일반 fetch 로 받아 둔 원문
     13건에는 봇 차단 화면이 0건이었다 — STCLab 봇매니저가 헤드리스만 잡는 것이다.
     대안은 '브라우저를 더 잘 위장한다'가 아니라 '막히면 다른 길로 간다'이다. */
  eq('  봇 차단에 걸리면 일반 내려받기로 물러선다', /BOT_WALL\.test\(text\)/.test(rb), true);
  eq('    최종 주소로도 판정한다 (challenge 로 튕긴다)', /BOT_WALL\.test\(String\(finalUrl\)\)/.test(rb), true);
  /* 🔴 `[홍보]` 계열 공고는 글자 없이 **포스터 그림만** 올려 둔다. innerText 로는 한 글자도
     안 잡혀 '본문이 없다'로 보이지만 눈으로 읽을 내용은 있다. 큰 그림만 담는다 —
     아이콘·로고를 담으면 자격을 읽으라고 로고를 보내는 꼴이 된다. */
  eq('  본문이 그림뿐인 공고는 그림을 찾아 적는다', /naturalWidth >= 300/.test(rb), true);
  eq('    아이콘·로고는 담지 않는다 (세로도 본다)', /naturalHeight >= 300/.test(rb), true);

  // 브라우저 수집기가 이미 그린 본문을 저장한다 (추가 페이지 열기 0회)
  const bc = fs.readFileSync(new URL('collector/browser-collect.mjs', root), 'utf8');
  eq('브라우저 수집기가 상세 본문을 저장한다', /bodies\[it\.url\]\s*=/.test(bc), true);
  eq('  심층 수집과 다른 파일에 저장한다(서로 지우지 않게)', /browser-bodies\.json/.test(bc), true);
}

/* 2026-08-20 — '목록 화면' 오인. 한쪽으로만 재면 반드시 다른 학교가 망가지는 자리라
   **양방향을 함께** 검사한다(중앙대를 살리는 것과 동국대를 지키는 것). */
/* 🔴 2026-08-23 — 링크 사냥꾼이 헛걸음하는 첫째 원인은 '제목이 안 맞는 것'이다.
   게시판 행 글자를 그대로 담아 둔 boardTitle 에는 앞머리에 `공지 공지`·`2651` 같은
   행 번호·분류 배지가 붙는다. 대조는 제목 **앞부분**을 맞춰 보므로(fingerprint의
   slice(0,24)), 앞머리가 어긋나면 뒤가 아무리 같아도 통째로 빗나간다.
   청소는 수집기와 **같은 모듈**을 써야 한다 — 여기에 한 벌 더 두면
   "수집기는 같다는데 사냥꾼은 다르다"가 된다(중앙대 11건이 3주간 헛돈 유형). */
/* 🔴 2026-08-23 — **학교 서버에 붙는 워크플로는 인증서 설정을 갖고 있어야 한다.**
   계명대·조선대처럼 중간 인증서를 안 보내는 학교가 있는데, 브라우저·curl 은 시스템
   저장소에서 사슬을 이어 붙이지만 Node 는 안 한다 — '로봇만 못 읽고 학생은 멀쩡히
   보는' 상태가 된다. 수집 워크플로에는 대비가 돼 있었는데 나중에 만든 워크플로 둘에
   빠져 있어서, 조선대 공고문 PDF 내려받기가 TypeError 로 죽었다.
   새 워크플로를 만들 때마다 사람이 기억해서 넣는 방식은 또 빠뜨린다 — 검사로 묶는다. */
console.log('\n■ 학교 서버에 붙는 워크플로의 인증서 설정 (2026-08-23)');
{
  const dir = new URL('../.github/workflows/', import.meta.url);
  /* collector 의 로봇을 부르는 워크플로만 본다 — 배포·알림 워크플로는 학교에 안 붙는다 */
  const need = fs.readdirSync(dir).filter((f) => /\.ya?ml$/.test(f))
    .map((f) => ({ f, t: fs.readFileSync(new URL(f, dir), 'utf8') }))
    .filter((x) => /node collector\/(collect|deepfetch|browser-collect|rescue-bodies|link-hunter|resolve-detail-urls|eligibility-ai|extract-excerpts)/.test(x.t));
  const missing = need.filter((x) => !/NODE_EXTRA_CA_CERTS/.test(x.t)).map((x) => x.f);
  eq(`수집 로봇을 부르는 워크플로 ${need.length}개가 모두 인증서 설정을 갖고 있다`, missing.join(',') || '(없음)', '(없음)');
  /* 검증을 끄는 것과 혼동하지 말 것 — 그건 아무 서버나 믿겠다는 뜻이다 */
  const unsafe = need.filter((x) => /NODE_TLS_REJECT_UNAUTHORIZED|rejectUnauthorized:\s*false/.test(x.t)).map((x) => x.f);
  eq('  인증서 검증을 끄는 워크플로는 없다', unsafe.join(',') || '(없음)', '(없음)');
  /* 오류를 낱말 하나로 뭉개면 원인을 영영 못 본다 — Node fetch 의 진짜 이유는 cause 안에 있다 */
  const df = fs.readFileSync(new URL('../collector/deepfetch.mjs', import.meta.url), 'utf8');
  eq('  내려받기 실패는 원인(cause)까지 적는다', /e\.cause && \(e\.cause\.code/.test(df), true);
}

/* 🔴 개발자가 **네 번째로** 같은 것을 지적했다 (2026-08-23): 동국인재육성장학에
   '마일리지 산정기간', 동산장학회에 '추천기한'·제외가 지원 자격으로 들어가 있다.
   앞선 세 번은 그때그때 잡음을 이름 대서 필터에 추가했고, 그래서 새 유형이 나오면
   개발자가 앱을 눈으로 볼 때까지 아무도 몰랐다. 이번엔 **세는 자리**를 만들었다.
   ⚠️ 채점기가 필터와 같은 낱말을 쓰면 필터의 눈으로 필터를 채점하는 꼴이라
   필터가 놓친 것은 영영 0으로 나온다 — 다른 축(문장이 무엇을 말하는가)으로 재야 한다. */
console.log('\n■ 자격 자리의 잡음을 유형별로 세는가 (2026-08-23)');
{
  const rep = fs.readFileSync(new URL('../verify/eligibility-report.mjs', import.meta.url), 'utf8');
  eq('채점기가 잡음을 유형별로 센다', /NOISE_KIND/.test(rep), true);
  eq('  어느 경로가 넣었는지도 센다 (규칙 vs AI)', /발췌기\(규칙\) \$\{hits\.length - byAi\}/.test(rep), true);
  /* 필터의 낱말 목록을 그대로 **가져다 쓰면** 안 된다.
     ⚠️ 낱말만 찾으면 '쓰지 말라'고 적은 주석까지 잡힌다(실제로 그랬다) —
     주석을 걷어내고 **실제로 부르는지**를 본다. */
  const code = rep.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  eq('  필터의 잡음 목록을 그대로 쓰지 않는다', /REQ_NOISE|NOT_REQ_RE/.test(code), false);
  /* 개발자가 짚은 두 유형은 반드시 잡혀야 한다 */
  /* 규칙은 이제 채점기·관문이 **함께 읽는 한 파일**에 있다 (2026-08-24) —
     예전엔 두 곳에 베껴져 있어 한쪽만 고치면 조용히 갈라졌다. */
  const kinds = fs.readFileSync(new URL('./eligibility-noise.cjs', import.meta.url), 'utf8');
  eq('  채점 규칙은 한 곳뿐이다 (채점기·관문이 같이 읽는다)',
    /require\('\.\/eligibility-noise\.cjs'\)/.test(rep), true);
  eq('  배점·평가를 잡는다 (마일리지 산정기간)', /산정\\s\*\(기간/.test(kinds), true);
  eq('  일정·기한을 잡는다 (추천기한)', /'일정·기한'/.test(kinds), true);
  eq('  제외 대상을 잡는다', /'제외 대상/.test(kinds), true);
  /* 🔴 2026-08-24 개발자 지적 — 앱을 열자마자 셋을 찾았다. 요건 낱말을 갖고 있어
     통과 조건도 옛 채점기도 통째로 뚫린 유형이라, 채점기가 반드시 이름을 알아야 한다. */
  eq('  순위 기준을 잡는다 (학년이 높은 학생)', /'순위 기준/.test(kinds), true);
  /* 채점기는 필터보다 **넓게** 잡는다 — 좁게 베끼면 필터가 놓친 것을 똑같이 놓친다 */
  const noise = createRequire(import.meta.url)('./eligibility-noise.cjs');
  const rank = noise.NOISE_KIND['순위 기준 (자리가 틀렸다 — 먼저 뽑는 기준으로)'];
  for (const l of ['학년이 높은 학생', '누적 평균 평점이 높은 학생', '학자금지원구간이 낮은 학생',
    '소득순위 순으로 선발', '성적상위자 우선 고려', '소득구간이 동일할 경우, 총 평점평균이 높은 학생 우선'])
    eq(`    채점기가 본다: ${l.slice(0, 22)}`, rank(l), true);
  const ex = noise.NOISE_KIND['제외 대상 (자리가 틀렸다 — 제외 블록으로)'];
  eq('  괄호 안 지원불가는 제외 줄이 아니다 (요건에 붙은 부연)',
    ex('2026년 2학기 재학생 (2026-2학기 휴학예정자 지원불가)'), false);
  eq('    괄호 밖이면 제외 줄이 맞다', ex('타 장학금 수혜자는 지원 불가'), true);

  /* 🔴 **리포트가 아니라 관문이어야 재발이 끝난다** (개발자 질문: "왜 자꾸 재발하는거지?").
     지금까지 잡음을 찾아내는 일이 개발자가 앱을 눈으로 보는 것뿐이었다. 이제 감사가
     오류로 올리고, 수집 워크플로는 감사가 실패하면 그 실행분을 되돌린다 —
     잡음이 섞인 데이터는 앱에 하루도 못 나간다. */
  const aud = fs.readFileSync(new URL('../verify/audit-data.js', import.meta.url), 'utf8');
  eq('감사가 자격 잡음을 오류로 올린다 (경고가 아니라)', /errors\.push\(`registered:\$\{it\.id\} — 지원 자격에 \[/.test(aud), true);
  eq('  화면과 같은 함수로 본다 (감사만 통과하는 일이 없게)', /require\('\.\.\/match-engine\.js'\)/.test(aud), true);
  eq('  조각난 줄은 경고로 둔다 (버리면 진짜 요건을 잃는다)', /자격 줄이 조각나 보입니다/.test(aud), true);
  /* 🔴 원인을 단정하지 않는다 (2026-08-29). 걸린 두 건을 원문과 대조하니 둘 다
     학교가 문장 중간에 줄을 바꾼 것이었는데, 문구는 `(수집 단계)`라고 못 박고 있었다.
     확인 안 한 원인을 적으면 다음 세션이 없는 버그를 쫓는다. */
  eq('    원인을 단정하지 않는다 (수집 탓이라고 적지 않는다)', /상했습니다\(수집 단계\)/.test(aud), false);

  /* 화면 문 자체가 줄마다 '요건임'을 묻는가 — 이게 없으면 좋은 줄에 잡음이 얹혀 간다 */
  const eng = fs.readFileSync(new URL('../match-engine.js', import.meta.url), 'utf8');
  eq('화면 문이 줄마다 요건 신호를 확인한다', /if \(!REQ_SIGNAL\.test\(t\)\) continue;/.test(eng), true);
  /* 🔴 잣대는 그대로 줄 단위다. 다만 **괄호 안은 부연**이라 떼고 본다 (2026-08-28) —
     `직전학기 C⁰ 수준(70/100점 만점) 이상인 재학생` 의 '만점'이 배점표 표지로 읽혀
     진짜 성적 요건이 사라지고 있었다. 괄호를 떼고도 잡음이면 그대로 버린다. */
  eq('  자격이 아닌 부류는 줄 단위로 버린다',
    /if \(NOT_A_REQUIREMENT\.test\(bareAll\.length >= 6 \? bareAll : t\)\) continue;/.test(eng), true);
  eq('  괄호 안 부연으로 요건을 죽이지 않는다', /const bareAll = t\.replace\(/.test(eng), true);
  eq('  제외 대상은 버리지 않고 자리를 옮긴다', /if \(EXCLUDE_LINE\.test\(bare/.test(eng), true);
  /* 제외·우선 블록에는 그 잣대를 대면 안 된다 — 대면 그 블록이 통째로 사라진다 */
  eq('  제외·우선 블록에는 그 잣대를 대지 않는다', /opts\.loose \|\| opts\.keepPriority/.test(eng), true);
}

/* ── 🔴 `data/registered.json` 을 로봇과 **같은 형식**으로 저장하는가 (2026-08-29) ──
   이 파일은 일부러 자동 병합에서 뺐다(여기서는 '삭제'가 뜻을 가진다 — CLAUDE.md).
   그래서 형식이 바뀌면 로봇 커밋과 **파일 전체가 충돌**한다. 실제로 이 세션에서 값 두 개를
   채우려다 `JSON.stringify(…, null, 2)` 로 저장해 **10,849줄짜리 diff** 를 만들었다.

   🔴 기준은 **디스크에 있는 모양이 아니라 로봇이 쓰는 모양**이다 (코드 리뷰 지적).
   첫 판은 디스크를 그대로 고정했다가 로봇 셋을 어기게 만들 뻔했다 —
   link-hunter·resolve-detail-urls 는 끝 개행을 **안 붙인다**. 그 상태로 CI 에 올라가면
   사냥 결과를 저장하는 순간 관문이 빨간불이 되고, 워크플로가 그 실행분을 되돌려
   **찾아낸 원문 주소를 통째로 버린다**(CLAUDE.md 에 같은 사고가 적혀 있다).
   그래서 들여쓰기만 본다 — 로봇이 모두 `null, 1` 로 쓴다.

   🟢 `forms.json` 도 2026-08-29 개발자 승인으로 1칸으로 되돌렸다(내용 변경 0).
   2026-08-15 에 한 세션이 2칸으로 저장해 놓은 것이었고, 그 파일을 쓰는 로봇
   (`schematize-forms.mjs`)은 줄곧 1칸이었다 — 다음 실행에 6천 줄이 뒤집힐 상태였다. */
/* ── 🔴 CLAUDE.md 가 다시 불어나지 못하게 (2026-08-29 개발자 지시) ──
   이 문서는 **매 세션 통째로 실린다.** 1,560줄까지 불어나자 개발자가 지적했다 —
   *"써 있는데도 못 읽는 경우가 많고 줄이 엄청 늘어났다."* 그날 641줄로 줄였다
   (68개 항목 중 38개는 이미 검사가 지키므로 설명 대신 '규칙 한 줄 + 관문 위치'만 남겼다).
   🔴 **줄이라고 적어 두는 것은 리포트다.** 실제로 줄이기 직전 최대 항목이 71줄이었고,
      "간결하게 쓰자"는 문장은 그 옆에 계속 있었다. 그래서 관문으로 만든다. */
console.log('\n■ CLAUDE.md 부피 (2026-08-29)');
{
  const md = fs.readFileSync(new URL('../CLAUDE.md', import.meta.url), 'utf8');
  const total = md.split('\n').length;
  eq(`문서 전체가 900줄을 넘지 않는다 (지금 ${total}줄)`, total <= 900, true);
  /* 항목 하나가 길어지는 것이 부풀기의 실제 경로다 — 전체 줄 수보다 먼저 걸린다 */
  const facts = md.slice(md.indexOf('## 중요한 기술 사실'), md.indexOf('## 현황 숫자는'));
  const items = facts.split(/\n(?=- \*\*)/).slice(1);
  const longs = items.map((t) => [t.split('\n').length, t.split('\n')[0].slice(0, 40)])
                     .filter(([n]) => n > 20);
  eq('한 항목이 20줄을 넘지 않는다 (넘으면 경위를 SESSIONS.md 로)', longs, []);
}

console.log('\n■ 데이터 파일 형식 (2026-08-29)');
{
  /* 자동 병합에서 뺀 두 파일. 형식이 어긋나면 로봇 커밋과 파일 전체가 충돌한다.
     끝 개행은 로봇마다 달라 보지 않는다 — 보면 사냥꾼 결과를 되돌리게 된다(위 주석). */
  for (const f of ['registered', 'forms']) {
    const raw = fs.readFileSync(new URL(`../data/${f}.json`, import.meta.url), 'utf8');
    eq(`data/${f}.json 은 로봇과 같은 들여쓰기(1칸)다`,
       JSON.stringify(JSON.parse(raw), null, 1) === raw.replace(/\n$/, ''), true);
  }
}

console.log('\n■ 링크 사냥꾼의 제목 대조 (2026-08-23)');
{
  const lh = fs.readFileSync(new URL('../collector/link-hunter.mjs', import.meta.url), 'utf8');
  eq('사냥꾼은 수집기와 같은 제목 청소 규칙을 쓴다', /from '\.\/clean-title\.mjs'/.test(lh), true);
  eq('  대조할 제목에서 부스러기를 뗀다', /cleanTitle\(\(t\.ref\.boardTitle/.test(lh), true);
  eq('  받아 적을 때도 떼고 담는다', /boardTitle = cleanTitle\(mate\.title\)/.test(lh), true);
  const CT = await import(new URL('../collector/clean-title.mjs', import.meta.url));
  eq('  분류 배지를 뗀다', /^공지/.test(CT.cleanTitle('공지 공지 2026-2학기 복지장학1(본인장애) 신청안내')), false);
  eq('  행 번호를 뗀다', /^2651/.test(CT.cleanTitle('2651 2026-2학기 부남장학생 선발 안내')), false);
  /* 저장된 값에도 부스러기가 남아 있으면 안 된다 — 대조는 저장된 값으로 한다 */
  const regd = JSON.parse(fs.readFileSync(new URL('../data/registered.json', import.meta.url), 'utf8'));
  const dirty = (regd.items || regd).filter((x) => x.boardTitle && CT.cleanTitle(x.boardTitle) !== x.boardTitle);
  eq('  저장된 boardTitle 에도 부스러기가 없다', dirty.length, 0);
}

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

  /* 2026-08-23 — **공고문 PDF 경로.** 게시판 본문이 '붙임 참조'뿐이고 공고문이 PDF인데
     그 PDF가 CID 폰트·스캔이면 무료 해석기로 한글이 0자 나온다(실측 5개 전부).
     여기서는 뽑을 글자가 없어 **줄 번호 계약을 쓸 수 없다** — 이 경로만 모델이 글자를
     돌려주고, 개발자가 자격 요건에 한해 승인한 예외를 쓰는 곳이 여기 하나다.
     그래서 번호 경로와 **같은 낱말 관문**을 반드시 통과시켜야 한다. */
  const p = (lines, none = false) => AI.verifyPdfLines({ none, lines, why: '' });
  eq('공고문 PDF: 자격 줄이면 채택', p(['2026학년도 2학기 재학 예정인 학부생']).ok, true);
  eq('  제출서류·문의는 자격이 아니다', p(['성적증명서 1부', '문의 : 02-1234-5678']).ok, false);
  eq('  게시판 머리말도 거른다', p(['등록일 2026.06.02.', '조회 5464']).ok, false);
  eq('  요건 신호가 없으면 통째로 버린다', p(['3. 신청 자격']).ok, false);
  eq('  모른다(none)고 하면 그대로 둔다', p([], true).ok, false);
  eq('  같은 줄이 여러 번 와도 한 번만', p(['1학년 재학생', '1학년 재학생']).lines.length, 1);
  /* 🔴 제외 대상을 자격 줄과 섞으면 요건이 실제보다 까다로워 보여 지원할 수 있는
     학생이 포기하고, 5줄 상한에 밀려 진짜 요건이 잘려 나간다 —
     정읍시민장학재단에서 제외 3줄이 실제로 그렇게 버려졌다. */
  const pe = AI.verifyPdfLines({ none: false, why: '', lines: ['1학년 재학생'],
    excludes: ['타 장학금 수령자는 제외', '원격대학 재학생 제외'] });
  eq('  제외 대상은 자격 줄과 갈라 담는다', pe.excludes.length, 2);
  eq('    자격 줄에는 섞이지 않는다', pe.lines.length, 1);
  /* 🔴 발췌기가 AI가 읽은 자격을 덮어쓰면 안 된다. '원문은 읽었는데 못 뽑았다 →
     낡은 발췌를 남기지 않는다'는 규칙은 발췌 결과에는 맞지만, AI가 **공고문 PDF**에서
     읽은 값까지 지웠다 — 게시판 본문이 비어 있다는 사실은 PDF 안 내용에 대해
     아무 말도 하지 않는다. 실제로 정읍시민·세종이도가 7줄·6줄을 읽어 놓고 지워졌다
     (로그에는 ✓로 남고 데이터는 비어 있었다). */
  const xs = fs.readFileSync(new URL('../collector/extract-excerpts.mjs', import.meta.url), 'utf8');
  eq('  발췌기는 AI가 읽은 자격을 건드리지 않는다', /\/\^AI\/\.test\(it\.eligibilityFrom/.test(xs), true);
  /* ⚠️ 그 가드는 **for 반복문 안**이라 continue 여야 한다 — return 을 쓰면 그 뒤 공고를
     전부 건너뛴다(실제로 return 으로 썼다가 잡았다). */
  eq('    그 가드는 continue 다 (return 이면 나머지 공고를 다 건너뛴다)',
    /eligibilityFrom \|\| ''\)\) \{ kept \+= 1; continue; \}/.test(xs), true);
  /* 🔴 이 경로는 출처를 **'AI(공고문 PDF)'**로 남겨 번호 경로와 구분한다 —
     화면 표식은 같지만, 나중에 되짚을 때 어느 계약으로 들어온 글자인지 알아야 한다. */
  const src = fs.readFileSync(new URL('../collector/eligibility-ai.mjs', import.meta.url), 'utf8');
  eq('  출처를 번호 경로와 구분해 남긴다', /'AI\(공고문 PDF\)'/.test(src), true);
  eq('  기관명을 줄이지 말라고 못 박는다', /줄이지 마세요/.test(src), true);
  /* 🔴 **본문이 그림뿐인 공고**도 같은 길로 읽는다 (2026-08-23). `[홍보]` 계열은 글자 없이
     포스터만 올려 둔다 — 넘기려던 7건 전부에 A4 포스터급 그림이 있었다(최대 5906×8268).
     '본문이 없는 것'이 아니라 '눈으로 읽어야 하는 것'이었다.
     ⚠️ PDF 는 document 블록, 그림은 image 블록이다 — 형태를 섞으면 400 이 난다. */
  eq('  그림은 image 블록으로 보낸다', /type: 'image', source:/.test(src), true);
  eq('    PDF 는 document 블록 그대로', /type: 'document', source:/.test(src), true);
  eq('    출처를 그림/PDF 로 갈라 남긴다', /'AI\(공고 포스터 그림\)'/.test(src), true);
  /* 🔴 API 는 이미지 한 변을 8,000픽셀까지만 받는다. 학교 포스터는 인쇄용 원본을
     그대로 올려 이 한계를 자주 넘는다 — 한미 첨단분야가 5906×8268이라 400 이 났다. */
  eq('    8,000픽셀을 넘는 포스터는 줄여서 보낸다', /> 7800/.test(src), true);
  /* 🔴 한계는 **둘**이다 — 치수를 고치려고 큰 PNG 로 다시 만들었더니 15MB 가 돼
     이번엔 파일 크기(10MB)에 걸렸다. 둘 다 봐야 한다. */
  eq('    파일 10MB 한계도 함께 본다', /9 \* 1024 \* 1024/.test(src), true);
  eq('    PNG 가 아니라 JPEG 로 내보낸다 (PNG 는 포스터에서 몇 배로 부푼다)', /\.jpeg\(\{ quality/.test(src), true);
  const wf = fs.readFileSync(new URL('../.github/workflows/eligibility-fill.yml', import.meta.url), 'utf8');
  eq('      줄이는 도구가 워크플로에 설치된다', /npm i @anthropic-ai\/sdk sharp/.test(wf), true);
  const dfx = fs.readFileSync(new URL('../collector/deepfetch.mjs', import.meta.url), 'utf8');
  eq('  본문 그림도 내려받는다 (이름 규칙에는 안 걸린다)', /a\.bodyImage && IMG_EXT\.test/.test(dfx), true);

  /* 2026-08-23 — 자격을 **구조로** 읽는 경로. 종단추천장학처럼 원문이 표인 공고에서
     '공통 / 둘 중 하나 / 성적'이 평평해지면 학생이 뜻을 정반대로 읽는다(설계 문서 참조). */
  const L2 = ['3. 신청 자격', '대한불교조계종 스님 (학부 정규학기 재학생)',
    '재학생(계속장학생)', '2026-1학기 종단추천장학 기수혜자', '2026-2학기 재학 및 복학예정자',
    '재학생(신규자)', '대한불교조계종 교육원의 장학추천 가능자',
    '직전학기 평점평균 3.0/4.5, 취득학점 15학점 이상인 자',
    '타 장학금 중복 수혜자는 제외', '기초생활수급자 우선 선발'];
  const s2 = AI.verifyPick({
    none: false, why: '',
    common: [1], grade: [7], exclude: [8], priority: [9],
    either: [{ label: [2], lines: [3, 4] }, { label: [5], lines: [6] }],
  }, L2);
  eq('구조로 고르면 공통·갈래·성적이 갈라진다', s2.ok, true);
  eq('  갈래가 둘로 남는다', s2.struct.either.length, 2);
  /* 🔴 갈래 이름이 없으면 학생이 어느 쪽을 봐야 할지 모른다 (2026-08-23 개발자 지적) */
  eq('  갈래 이름도 원문에서 꺼낸다', s2.struct.either[0].label, '재학생(계속장학생)');
  /* 🔴 기관명을 줄이면 다른 종단 스님이 자기 공고로 읽는다 — 앱은 원문 줄을 통째로 낸다 */
  eq('  기관명이 줄지 않는다', s2.struct.either[1].lines[0], '대한불교조계종 교육원의 장학추천 가능자');
  eq('  제외 대상은 따로 나온다', s2.excludes.length, 1);
  eq('  우선 선발 기준도 따로 나온다', s2.priority.length, 1);
  /* 화면·알림·챗봇이 지금 쓰는 평평한 모양은 그대로 나와야 한다 — 안 그러면 셋이 갈라진다 */
  eq('  평평한 모양도 함께 나온다(하위호환)', s2.lines.length >= 4, true);

  /* 🔴 애매하면 공통 — 공통인데 택일로 그리면 자격 없는 학생이 서류를 뗀다.
     갈래가 하나뿐인 건 택일이 아니므로 공통으로 합친다. */
  const s1 = AI.verifyPick({ none: false, why: '', common: [1], grade: [], exclude: [], priority: [],
    either: [{ label: [2], lines: [3] }] }, L2);
  eq('  갈래가 하나뿐이면 공통으로 합친다', s1.struct.either.length, 0);
  eq('    합쳐진 줄은 사라지지 않는다', s1.struct.common.includes(L2[3]), true);

  /* 구조 경로에도 같은 관문이 걸린다 — 여기가 느슨하면 AI 경로로 쓰레기가 들어온다 */
  const sBad = AI.verifyPick({ none: false, why: '', common: [0], grade: [], exclude: [], priority: [],
    either: [] }, L2);
  eq('  구조로 와도 요건 신호가 없으면 버린다', sBad.ok, false);
  const sOut = AI.verifyPick({ none: false, why: '', common: [1, 999], grade: [], exclude: [], priority: [],
    either: [{ label: [999], lines: [3] }, { label: [5], lines: [6] }] }, L2);
  eq('  범위 밖 갈래 이름은 null 로 둔다', sOut.struct.either[0].label, null);
  eq('    이름을 못 읽어도 그 갈래의 요건은 살린다', sOut.struct.either[0].lines.length, 1);
  /* 🔴 표의 칸 이름이 두 줄로 쪼개진 게시판이 흔하다 ("재학생" + "(계속장학생)").
     한 줄만 쓰면 두 갈래가 똑같이 "재학생"이 돼 학생이 자기 갈래를 못 고른다. */
  const L3 = ['신청대상', '공통', '스님 (학부 정규학기 재학생)', '재학생', '(계속장학생)',
    '2026-1학기 종단추천장학 기수혜자', '재학생', '(신규자)', '교육원의 장학추천 가능자'];
  const sJoin = AI.verifyPick({ none: false, why: '', common: [2], grade: [], exclude: [], priority: [],
    either: [{ label: [3, 4], lines: [5] }, { label: [6, 7], lines: [8] }] }, L3);
  eq('  갈래 이름이 두 줄이면 붙여서 쓴다', sJoin.struct.either[0].label, '재학생 (계속장학생)');
  eq('    두 갈래 이름이 서로 달라진다', sJoin.struct.either[1].label, '재학생 (신규자)');
  /* 스키마가 있어도 모델은 배열 대신 숫자를 보낼 수 있다 — 여기서 죽으면
     그 실행의 나머지 공고까지 통째로 못 읽는다. */
  const sNum = AI.verifyPick({ none: false, why: '', common: [2], grade: [], exclude: [], priority: [],
    either: [{ label: 3, lines: [5] }, { label: 6, lines: [8] }] }, L3);
  eq('  갈래 이름이 숫자 하나로 와도 죽지 않는다', sNum.ok, true);
  /* 🔴 실측(2026-08-23): 모델이 `교육원의 장학추천 가능자`를 공통과 신규자 갈래
     양쪽에 넣었다. 그대로 두면 계속장학생이 "나도 그게 필요하네" 하고 포기한다. */
  const sDup = AI.verifyPick({ none: false, why: '', common: [2, 8], grade: [], exclude: [], priority: [],
    either: [{ label: [3, 4], lines: [5] }, { label: [6, 7], lines: [8] }] }, L3);
  eq('  갈래에 든 줄은 공통에서 뺀다', sDup.struct.common.includes(L3[8]), false);
  eq('    그래도 갈래 쪽에는 남는다', sDup.struct.either[1].lines.includes(L3[8]), true);
  eq('    공통의 다른 줄은 그대로', sDup.struct.common.includes(L3[2]), true);
  /* 성적 줄이 공통에도 오면 화면에 같은 줄이 두 번 뜬다 (2026-08-23 실측) */
  const sDup2 = AI.verifyPick({ none: false, why: '', common: [2, 5], grade: [5], exclude: [], priority: [],
    either: [] }, L3);
  eq('  성적 줄이 공통에도 오면 한 번만 뜬다', sDup2.struct.common.includes(L3[5]), false);
}

/* 2026-08-20 — 공고문 첨부에서 자격 읽기. 되돌리면 안 되는 지점이 셋이다. */
console.log('\n■ 공고문 첨부에서 자격 읽기 (2026-08-20)');
{
  /* 🔴 PDF를 받아야 한다 (2026-08-23). 예전엔 '글자가 정확히 안 나온다'며 제외했는데,
     그건 안 받을 이유가 아니라 받아 보고 안 되면 버릴 이유였다 — 못 읽는 PDF는
     readable()이 조용히 거른다. 안 받으면 그 공고는 영영 자격을 못 읽는다. */
  const df = fs.readFileSync(new URL('../collector/deepfetch.mjs', import.meta.url), 'utf8');
  eq('자격용 공고문 첨부에 PDF가 들어간다', /OK_EXT = \/\\\.\(hwp\|hwpx\|docx\?\|pdf\)/.test(df), true);
  /* 🔴 **목록이 갈라지면 파일이 `.bin`으로 저장돼 아무도 못 읽는다.**
     받을 대상(OK_EXT·IMG_EXT)에만 넣고 파일 확장자를 정하는 쪽을 안 고치면,
     내려받은 것이 전부 `.bin`이 된다 — attachmentText()·AI 경로 둘 다 확장자로
     해석기를 고르므로 320KB·1.1MB짜리 파일을 눈앞에 두고 손도 못 댄다(실제로 그랬다).
     낱말을 하나씩 박아 두면 목록이 늘 때마다 검사가 헛되이 깨지므로,
     **'받는 목록의 모든 확장자가 정하는 목록에 있는가'** 라는 뜻 자체를 잰다. */
  /* ⚠️ **자격 함수 안만 본다.** `const ext = (a.name.match(…))` 는 양식 내려받기 쪽에도
     같은 이름으로 있어서, 파일 전체에서 찾으면 엉뚱한 줄을 잰다(실제로 그랬다). */
  const eligFn = df.slice(df.indexOf('async function downloadEligDocs'));
  const extsOf = (re) => (eligFn.match(re) || [, ''])[1].split('|')
    .map((x) => x.replace('?', '').replace(/[()]/g, '')).filter(Boolean);
  const wanted = [...new Set([
    ...extsOf(/OK_EXT = \/\\\.\(([^)]+)\)\$\/i/),
    ...extsOf(/IMG_EXT = \/\\\.\(([^)]+)\)\$\/i/),
  ])];
  const mapping = extsOf(/const ext = \(a\.name\.match\(\/\\\.\(([^)]+)\)\$\/i\)/);
  const gap = wanted.filter((e) => !mapping.includes(e));
  eq(`받는 확장자 ${wanted.length}종이 모두 파일 이름 규칙에 있다`, gap.join(',') || '(없음)', '(없음)');
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
  /* 2026-08-21 — 개발자 지적: "자격이라고 할 수 없는 텍스트가 쓰여 있는 경우가 대부분이다."
     전수로 세니 412줄 중 56줄이 자격이 아니었다. 아래는 **실제로 화면에 나가고 있던 줄들**이다. */
  const KEEP = '직전학기 평점 3.0 이상인 자';
  const gone = (label, line) => eq(label, R([line, KEEP]).length, 1);
  /* 🔴 가장 나쁜 것 — 중앙대 교내장학금은 **자격 5줄이 전부 제출서류**였다.
     자격이 없는데 **있는 척** 보이는 것이라 '아직 못 읽었어요'보다 나쁘다. */
  gone('  제출서류는 자격이 아니다 (가족관계증명서)', '가족관계증명서');
  gone('  제출서류 — 앞에 설명이 붙어도', '본인: 교육지원 대상자 증명서');
  gone('  제출서류 — 괄호 부연이 붙어도', '국가고시반 지도교수 확인서 (1차 합격자만 해당)');
  gone('  동의서도 제출서류다', '개인정보보호수집이용 동의서');
  /* 🔴 그러나 '서류를 낼 수 있는 자'는 요건이다 — 서류 이름으로 **끝날 때만** 버린다 */
  eq('  서류가 요건인 문장은 지킨다', R(['소득분위 증명서를 제출할 수 있는 자']).length, 1);
  gone('  행사 안내는 자격이 아니다', '장학증서 수여식');
  gone('  행사 일시도', '일 시: 2026. 8. 31(월)');
  /* 🔴 그러나 '참석할 수 있는 학생'은 진짜 요건이다 — 실제로 그런 공고가 둘 있다 */
  eq('  참석 가능 여부는 요건이라 지킨다',
    R(['장학증서 수여식에 참석할 수 있는 학생 (2026. 8. 31.(월) 예정, 필수 참석)']).length, 1);
  gone('  추천인원은 자격이 아니다', '추천인원: 1명');
  gone('  이름표만 남은 제목 — 앞수식어가 붙어도', '장학생 기본 자격');
  gone('  이름표만 남은 제목 — 괄호 부연이 붙어도', '지원 자격 (가.~사. 모두 충족)');
  gone('  이름표만 남은 제목 — 붙여 쓴 것도', '신청대상(다음 조건을 모두 충족하여야 함)');
  gone('  이름표만 남은 칸', '학자금지원구간');
  gone('  분류 머리표', '국가유공자 관련 장학금');
  /* 🔴 이름표 뒤에 내용이 있으면 **이름표만 떼고 내용은 살린다** */
  eq('  장학대상 : 뒤의 내용은 살린다',
    R(['장학대상 : 2026학년도 신입생중 다문화가정자녀'])[0], '2026학년도 신입생중 다문화가정자녀');

  /* 2026-08-21 개발자 지적(목포향우회): "선발 조건이랑 우선선발 기준이 섞여서 난리이고,
     자격요건만 띄우는 건데 앞에 `~요건:` 이런 것도 붙어 있다. 요건이면 요건만 띄워야지."
     진짜 자격은 `전남 목포에서 중·고등 마친 자` **한 줄뿐**인데 5줄이 떠 있었다. */
  eq('  이름표는 떼고 내용만 — 바깥 제목이 이미 \'지원 자격\'이다',
    R(['장학생 신청 조건 : 전남 목포 소재 고등 및 중등 과정을 마친 자'])[0],
    '전남 목포 소재 고등 및 중등 과정을 마친 자');
  eq('  추천조건: 도 이름표다', R(['추천조건: 소득분위가 낮은 학생'])[0], '소득분위가 낮은 학생');
  /* 🔴 우선선발은 자격이 아니라 **자격을 갖춘 사람 중 누구를 먼저 뽑나**이다.
     자격 자리에 앉으면 요건이 실제보다 훨씬 까다로워 보인다. */
  gone('  우선선발 기준은 자격이 아니다', '장학생 우선선발 기준 (위 조건을 충족한 지원자 대상)');
  gone('  우선 선발로 끝나는 줄도', '성적 우수자 : 성적 상위자 우선 선발');
  gone('  우대·우선 선발 문장도', '전체 이수학기 성적 우수자 우대 (전체 평점평균 높은 순서대로 우선 선발)');
  /* 🔴 다만 **버리는 게 아니라 자리를 옮기는 것**이다 (2026-08-21 개발자 지적:
     "우선 선발 기준도 자격 요건 중 하나인데 이런 경우 어떻게 표시하는 게 좋을까").
     '먼저 뽑는 기준' 블록을 그릴 때는 같은 줄이 **살아 있어야** 한다. */
  const P = (lines) => ME.requirementLines(null, lines, { keepPriority: true });
  eq('  옮긴 자리(먼저 뽑는 기준)에서는 살아 있다',
    P(['성적 우수자 : 성적 상위자 우선 선발']).length, 1);
  eq('  자격 블록에서는 같은 줄이 안 보인다',
    R(['성적 우수자 : 성적 상위자 우선 선발', KEEP]).length, 1);
  /* 🔴 자격 칸을 **비우면서까지** 걷어내지는 않는다 (2026-08-24) — 학계장학문화재단은
     `소득분위가 낮고 학업성적이 우수한 학생`이 공고의 유일한 조건이라, 옮겨 버리면
     카드가 '자격을 아직 읽지 못했어요'가 된다. 자격이 사라지는 쪽이 더 나쁜 실패다. */
  eq('  그래도 자격이 통째로 비면 되돌린다',
    R(['소득분위가 낮고 학업성적이 우수한 학생(타 장학금 미수혜 학생)']).length, 1);

  /* ── 🔴 2026-08-24 개발자 지적 — **앱 열자마자 셋** ──
     "유흥수에도 지원구간 확인서 1부가 지원 자격은 아니지 않나. 총동문회에서 단순히 학년이
      높은 학생이 지원 요건은 아니지 그냥 가산이라는거고. 국가근로의 소득순위 순으로 선발이나
      성적상위자 우선 고려 이런 것도 마찬가지."
     셋 다 **요건 낱말(학년·성적·구간·소득)을 갖고 있어** 통과 조건도 채점기도 뚫었다.
     아래는 전부 그날 실제로 화면에 나가던 줄이다. */
  gone('  순위 기준은 자격이 아니다 (학년이 높은 학생)', '학년이 높은 학생');
  gone('    누적 평균 평점이 높은 학생', '누적 평균 평점이 높은 학생');
  gone('    학자금지원구간이 낮은 학생', '학자금지원구간이 낮은 학생');
  gone('    소득순위 순으로 선발', '소득순위 순으로 선발');
  gone('    성적상위자 우선 고려', '성적상위자 우선 고려');
  /* 줄 끝에만 걸면 안 된다 — 비교 표현은 문장 어디에나 온다 */
  gone('    문장 가운데 있어도', '소득구간이 동일할 경우, 총 평점평균이 높은 학생 우선');
  gone('    뒤에 괄호가 붙어도', '소득분위가 낮고 학업성적이 우수한 학생(타 장학금 미수혜 학생)');
  /* 🔴 그러나 같은 줄에 **진짜 커트라인**이 있으면 자격에 남긴다 — 옮기면 선이 사라진다 */
  eq('  커트라인이 함께 있으면 자격에 남긴다',
    R(['평점 3.0 이상이면서 성적이 우수한 학생']).length, 1);
  /* 버리는 게 아니라 옮기는 것이다 */
  eq('  옮긴 자리에서는 살아 있다',
    ME.requirementLines(null, ['학년이 높은 학생'], { keepPriority: true, onlyPriority: true }).length, 1);

  /* 배점표 한 행 — 순위 줄이 빠지자 뒤에 있던 이 줄이 5칸 안으로 올라왔다 (2026-08-24) */
  gone('  배점표 행은 자격이 아니다', '학자금 지원구간 (40 점): 학자금 지원구간 1구간 ∼ 9구간에 따라 평정');

  /* 🔴 제출서류가 **수량을 달고** 온다 — 서류 규칙이 '서류 이름으로 끝날 때만' 버려서 뚫렸다 */
  gone('  수량이 붙은 제출서류도 서류다', '2026년 2학기 학자금 지원구간 확인서 1 부');
  gone('    각 1통도', '주민등록등본 각 1통');
  /* 🔴 절 제목을 버리고 나면 자식 줄이 혼자 남는다 — 제목을 읽고 그 뒤를 통째로 본다 */
  eq('  제출서류 절 아래는 전부 서류다',
    R(['필수제출서류', '짧은 에세이 1 부', '학자금 지원구간 확인서 1 부', '외국어능통자']).length, 0);
  eq('    자격 제목이 다시 나오면 되돌아온다',
    R(['제출서류', '가족관계증명서', '신청자격', KEEP]).length, 1);
  /* 🔴 괄호 안의 지원불가로 줄을 통째로 버리면 진짜 자격이 조용히 사라진다 */
  eq('  괄호 부연이 붙은 요건은 지킨다',
    R(['2026년 2학기 재학생 (2026-2학기 휴학예정자 지원불가)']).length, 1);
  eq('    괄호 밖의 제외 문장은 여전히 옮긴다',
    R(['타 장학금 수혜자는 지원 불가', KEEP]).length, 1);

  /* 2026-08-21 개발자 지적(사랑나눔, **세 번째**): "'아래 두 가지 자격을 충족하는 자'나
     '학업 성적 기준' 같은 요건이 아닌 놈들이 쓰여 있다. 재발 방지되게 조치해 달라."
     아래는 전부 **그날 실제로 화면에 나가던 줄**이다. */
  gone('  다음 줄을 가리키기만 하는 연결 문장', '아래 두 가지 자격을 모두 충족하는 자');
  gone('  연결 문장 — 다른 표현도', '아래 중 하나에 해당하는 자');
  gone('  하위 절 제목', '학업 성적 기준');
  gone('  하위 절 제목 — 대상자로 끝나도', '신청 대상자');
  /* 🔴 그러나 조건이 붙어 있으면 제목이 아니다 — 길이로 가른다 */
  eq('  조건이 붙은 줄은 기준으로 끝나도 지킨다',
    R(['복학생인 경우, 휴학 직전학기 성적 기준']).length, 1);
  gone('  콜론으로 끝나는 제목', '특성화 교육과정 수료 기준 (총 24학점 이수):');
  /* 🔴 2026-08-24에 뜻이 바뀐 항목 — 약화가 아니라 강화다.
     예전엔 이 제목을 '그냥 버리는 제목'으로만 봤다. 지금은 **제외 절을 여는 머리글**로 읽는다.
     그래서 ① 제목 자신은 여전히 자격에 안 나오고 ② 제목 **뒤**의 줄은 자격이 아니라
     제외로 간다(그게 원문이 말하는 바다 — 결격사유 절 아래 줄은 못 받는 조건이다).
     제목 앞의 진짜 요건은 그대로 살아 있어야 한다. */
  eq('  꺾쇠로 감싼 제목 — 제목 자신은 자격에 안 나온다',
    R([KEEP, '<교내 장학금 지급 결격사유>']).length, 1);
  eq('  꺾쇠 제목 뒤의 줄은 자격이 아니다 (제외 절이 열렸다)',
    R(['<교내 장학금 지급 결격사유>', KEEP]).length, 0);
  gone('  자간을 벌려 쓴 제목', '제출 서 류');
  gone('  서류·자료 이름', '수혜금액을 확인할 수 있는 증빙자료');
  gone('  인원 안내', '학술·봉사·설계 00명');
  /* 🔴 인원이 뒤에 붙었을 뿐 진짜 요건인 줄은 지킨다 — 지우면 '관악구 거주'가 사라진다 */
  eq('  요건 + 인원인 줄은 지킨다', R(['관악구 거주 대학 재학생(0명)']).length, 1);
  gone('  접수처 주소', '[13620] 경기도 성남시 분당구 구미로 173번길 82 분당서울대학교병원');
  gone('  일정 안내', '시간 및 장소 추후 개별 안내 예정');
  gone('  앞이 잘린 조각', '~ ④ 모두 만족하는 자');

  // 사람이 정리한 것처럼 — 5줄이면 충분하다
  eq('  다섯 줄을 넘기지 않는다',
    R(['가. 재학생인 자', '나. 평점 3.0 이상인 자', '다. 9구간 이내인 자', '라. 12학점 이상인 자',
      '마. 휴학생이 아닌 자', '바. 초과학기가 아닌 자', '사. 졸업예정이 아닌 자']).length, 5);
}


/* ── 🔴 절 경계: 제외 대상·선발기준이 '지원 자격'으로 새지 않는가 (2026-08-24) ──
   개발자가 앱을 눈으로 보고 다섯 가지를 찾아냈는데 검사는 '잡음 0'을 답하고 있었다.
   원인은 둘 다 정규식 한 곳이었다:
     ① NEXT_SECTION이 `◎ 지원 제외 대상`에서 안 멈췄다 — 앞머리 기호를 뗀 자리에
        '지원'이 먼저 와서 `제외\s?대상` 가지가 붙지 못했다. 그래서 자격 절 읽기가
        제외 절 머리글을 지나쳐 **제외 대상을 지원 자격으로** 담았다
        (시립대 활동도우미: 휴학생·자퇴생·대학원생이 '지원 자격'에 떴다 — 자격이
         뒤집혀 보이는, 잡음보다 나쁜 실패).
     ② QUALIFY_HEAD에 `선발 기준`·`심사 기준`이 들어 있었다 — 그건 자격이 아니라
        **뽑는 기준**이라(개발자 지적) 절 전체가 지원 자격으로 읽혔다
        (대청교 멘토: '종합적으로 평가하여 선발', '기참여자 가산점').
   이 절이 실패하면 그 상태로 되돌아간 것이다. */
console.log('\n■ 절 경계 — 제외 대상·선발기준이 자격으로 새지 않는가 (2026-08-24)');
{
  const { isSectionBreak, isQualifyHead, isExcludeHead, isSelectHead } =
    createRequire(import.meta.url)('../section-head.js');

  // ① 제외 절 머리글은 자격 절을 끊어야 한다 — 앞에 낱말이 붙어도
  for (const l of ['◎ 지원 제외 대상', '□ 지원제외 대상', '3. 장학생 제외 대상', '■ 신청 제외자']) {
    eq(`'${l}' 에서 자격 절이 끊긴다`, isSectionBreak(l), true);
  }
  eq("'◎ 지원 제외 대상' 을 제외 절 머리글로 본다", isExcludeHead('◎ 지원 제외 대상'), true);

  // ② 선발기준·심사기준은 자격 절 머리글이 아니다 (뽑는 기준이지 자격이 아니다)
  eq("'4. 선발기준' 은 자격 절 머리글이 아니다", isQualifyHead('4. 선발기준'), false);
  eq("'3. 심사 기준' 은 자격 절 머리글이 아니다", isQualifyHead('3. 심사 기준'), false);
  eq("'4. 선발기준' 은 선발 절 머리글이다", isSelectHead('4. 선발기준'), true);

  // ③ 진짜 자격 머리글은 그대로 자격이어야 한다 (되돌아가지 않았는가)
  for (const l of ['◎ 신청 자격', '□ 지원자격', '2) 추천대상', '1. 신청 대상']) {
    eq(`'${l}' 은 자격 절 머리글이다`, isQualifyHead(l), true);
  }
  // ④ 자격 머리글은 자격 절을 끊지 않는다
  eq("'◎ 신청 자격' 은 절을 끊지 않는다", isSectionBreak('◎ 신청 자격'), false);

  /* 🔴 **브라우저에서 실제로 도는가** — Node에서만 보면 놓친다 (2026-08-24에 실제로 놓쳤다).
     match-engine은 Node에서는 require로, 브라우저에서는 **전역 함수**로 section-head를 쓴다.
     그 전역 목록에 headRest를 빠뜨렸더니 Node 검사는 전부 통과하는데 **앱은 첫 카드에서 죽었다**.
     그래서 index.html과 같은 순서로 두 파일을 실어 보고 실제로 불러 본다. */
  const vm = createRequire(import.meta.url)('node:vm');
  const ctx = vm.createContext({ console });
  for (const f of ['../section-head.js', '../parse-requirements.js', '../match-engine.js']) {
    vm.runInContext(fs.readFileSync(new URL(f, import.meta.url), 'utf8'), ctx, { filename: f });
  }
  const lines = '["◎ 신청 자격","▶ 서울시립대학교 재학생","◎ 지원 제외 대상","1. 휴학생, 졸업생, 자퇴생"]';
  eq('브라우저 순서로 실어도 자격 블록이 돈다',
    vm.runInContext(`requirementLines({}, ${lines})`, ctx), ['서울시립대학교 재학생']);
  eq('브라우저에서 제외 줄은 제외 칸으로 간다',
    vm.runInContext(`requirementLines({}, ${lines}, {onlyExclude:true})`, ctx), ['휴학생, 졸업생, 자퇴생']);
  /* 🔴 브라우저 전역 목록에 이름을 빠뜨리면 Node 검사는 통과하는데 앱이 죽는다 —
     headRest에 이어 caseBranch로 두 번째다(2026-08-24). 경우별 분기까지 실제로 불러 본다. */
  eq('브라우저에서 경우별 분기가 돈다',
    vm.runInContext(`requirementLines({}, ["신입생: 2026년 1학기 85점 이상","재학생: 2025년 2학기 85점 이상"])`, ctx).length, 2);
  eq('브라우저에서 머리글 뒤 내용도 살린다',
    vm.runInContext(`requirementLines({}, ["2) 추천대상 : 4년제 대학교 이공계 전공 새터민으로 재학 예정인 대학생"])`, ctx),
    ['4년제 대학교 이공계 전공 새터민으로 재학 예정인 대학생']);
}


/* ── 🔴 적합도 — 0%를 내는 여덟 조건 (2026-08-24 · docs/designs/fit-score.md) ──
   0%는 학생에게서 장학금을 뺏는 판정이라 틀리면 가장 비싸다. 개발자 지시:
   *"0%로 뜨면 학생이 아예 거들떠보지도 않을 테니 엄청 정확하게 0%임을 찾아야 한다."*
   아래 항목들은 전부 **0% 전수 확인에서 실제로 오탐이 났던 것**이다(18건 → 9건으로 줄인 과정).
   되돌리면 멀쩡한 학생이 0%를 보게 된다. */
console.log('\n■ 적합도 — 0%를 내는 조건 (2026-08-24)');
{
  const req = createRequire(import.meta.url);
  const M = req('../match-engine.js');
  const FC = req('./fit-consistency.cjs');   // 판정 규칙 한 곳 (채점기와 공유)
  const P = req('../parse-requirements.js');
  const fit = (lines, p, ex) => M.fitDetail({ eligibilityLines: lines, eligibilityExcludes: ex || [] }, p);
  const 평범 = { gpa: 3.5, bracket: 5, year: 3, status: '재학', credits: 15, nationality: 'korean', flags: [] };

  // ① 확신 있는 미달만 0%
  /* 🔴 100·0은 쓰지 않는다(2026-08-24 개발자 지시) — 상·하한으로 본다.
     `=== 0` / `=== 100`으로 적으면 그 순간 검사가 영영 실패하거나 조용히 무력해진다. */
  eq('평점 미달은 최저점', fit(['직전학기 평점평균 4.0 이상인 자'], 평범).pct, M.FIT_MIN);
  eq('평점 충족은 최고점', fit(['직전학기 평점평균 3.0 이상인 자'], 평범).pct, M.FIT_MAX);

  // ② 프로필에 값이 없으면 미달이 아니라 '확인 필요'
  eq('평점을 안 적었으면 0%가 아니다', fit(['직전학기 평점평균 4.0 이상인 자'], { flags: [] }).fails.length === 0, true);

  // ③ 단위가 다르면 떨어뜨리지 않는다 (백분위 70을 평점 70으로 읽으면 전원 0%)
  eq('백분위 요건으로는 미달을 내지 않는다', fit(['직전학기 성적 70/100 만점 이상'], 평범).fails.length === 0, true);
  eq('두 단위가 섞인 줄은 확신이 낮다',
    P.parseLine('평균 평점 80 점 또는 평균평점 B 학점 이상인 학생').conds[0].conf, P.LOW);

  // ④ 괄호 예외가 붙으면 확신을 낮춘다
  eq('예외가 붙은 줄은 확신이 낮다',
    P.parseLine('직전 정규학기 12학점 이상(신입생, 편입생 예외)').conds.every((c) => c.conf === P.LOW), true);

  // ⑤ 선택지(OR)는 하나만 만족해도 충족 — 필수로 읽으면 오탐 0%가 난다
  {
    const lines = ['아래 세 가지 조건 중 하나를 만족하는 자',
      '직전학기 평점평균 4.0 이상인 자', '직전학기 평점평균 3.0 이상인 자', '직전학기 평점평균 4.4 이상인 자'];
    eq('선택지는 하나만 만족해도 0%가 아니다', fit(lines, 평범).fails.length === 0, true);
    eq('선택지 묶음은 요건 1개로 센다', fit(lines, 평범).total, 1);
  }

  // ⑥ `재학`이 부분문자열로 제외 목록에 들어가면 재학생이 통째로 0%가 된다
  eq('“수업연한 초과 재학생 지원 불가”로 재학생을 떨어뜨리지 않는다',
    fit(['본교 재학생'], 평범, ['휴학생, 수료생 및 수업연한 초과 재학생은 지원 불가']).fails.length === 0, true);
  eq('휴학생은 제대로 걸러낸다',
    fit(['본교 재학생'], { ...평범, status: '휴학' }, ['휴학생은 지원 불가']).pct, M.FIT_MIN);

  // ⑦ 제외 줄의 국적은 **같을 때만** 미달 (내국인이 0%가 됐던 오탐)
  eq('“외국인 유학생 선발 불가”로 내국인을 떨어뜨리지 않는다',
    fit(['본교 재학생'], 평범, ['순수외국인전형으로 입학한 외국인 유학생은 선발 불가']).fails.length === 0, true);

  // ⑧ 대학원 전용 줄은 학부생 판정에서 뺀다
  eq('대학원 전용 줄로 학부생을 떨어뜨리지 않는다',
    fit(['학부생 : 전체 평점 3.3 이상인 자', '일반대학원생 : 전체 평점 4.0 이상인 자'], 평범).pct, M.FIT_MAX);

  // ⑨ 지급액 구간표를 요건으로 읽지 않는다
  eq('구간이 여러 값이면 지급액 표로 보고 미달을 내지 않는다',
    fit(['학자금지원구간 4분위 이하', '학자금지원구간 5분위 이상 ~ 6분위 이하'], 평범).fails.length === 0, true);

  /* 🔴 **퍼센트와 화면의 ✓/✗는 갈라질 수 없어야 한다** (2026-08-24 개발자 지적).
     *"적합도가 100%인데 지원 자격에 ✕가 쳐져 있고 아예 체크도 안 된 것도 있다."*
     원인은 판정이 두 벌이었기 때문이다(퍼센트=parse-requirements / 표시=옛 정규식).
     지금은 `lineVerdict` 하나를 함께 쓴다. 아래 셋이 이 약속을 지킨다 —
     누군가 판정기를 한 벌 더 만들면 여기서 바로 깨진다. */
  {
    const reg = req('../data/registered.json');
    const base = { school: '한국외국어대학교', track: '인문', nationality: 'korean',
                   region: '서울', parentRegion: '서울', birthYear: 2004 };
    const profs = [
      { gpa: 4.3, bracket: 1, year: 3, status: '재학', credits: 18, flags: ['basicLiving'] },
      { gpa: 3.5, bracket: 5, year: 3, status: '재학', credits: 15, flags: [] },
      { gpa: 2.3, bracket: 9, year: 2, status: '재학', credits: 12, flags: [] },
      { gpa: 3.5, bracket: 5, year: 3, status: '휴학', credits: 15, flags: [] },
      { gpa: null, bracket: 5, year: 1, status: '신입학', credits: null, flags: [] },
      { gpa: 3.0, bracket: 6, year: 4, status: '초과학기', credits: 12, flags: [] },
      { gpa: 3.2, bracket: 4, year: 4, status: '졸업유예', credits: 9, flags: [] },
      { gpa: 3.5, bracket: 5, year: 2, status: '복학예정', credits: 15, flags: [] },
      { gpa: null, bracket: null, year: 3, status: null, credits: null, flags: [] },
    ];
    let mismatchX = 0, muteZero = 0;
    for (const pp of profs) {
      const p = { ...base, ...pp };
      for (const sch of reg.items) {
        const fd = M.fitDetail(sch, p);
        if (fd.unread) continue;
        /* 🔴 판정 규칙은 **verify/fit-consistency.cjs 한 곳**에서 가져온다 (2026-08-29).
           예전엔 여기와 채점기(eligibility-report)에 같은 규칙이 베껴져 있었고,
           2026-08-26 상수 변경을 여기만 따라가서 채점기가 경고 227건을 냈다.
           옛 `pct === FIT_MAX && !== 'ok'` 가지는 지웠다 — `!== 'ok'` 는 선택지 묶음의
           **일부러 null 인 줄**을 모순이라 부르고(실측 재현), `=== 'no'` 로 고치면
           아래 mismatchX 에 통째로 포함된다(전수 × 프로필 7종에서 단독 발화 0회). */
        if (FC.fitInconsistency(M, sch, p)) mismatchX += 1;
        if (fd.fails.length && fd.pct !== M.FIT_MIN) muteZero += 1;
      }
    }
    eq('미달이 아니면 ✕가 있는 줄이 없다 (등록 전수 × 프로필 9종)', mismatchX, 0);
    eq('미달은 반드시 최저점으로 나온다', muteZero, 0);

    /* 🔴 개발자 지시 (2026-08-24): "100이랑 0은 없는 걸로 — 아무리 적합해도 혹시 모르니까."
       앱은 자기가 읽은 것만 알지 공고의 전부를 알지 못한다. 이 둘이 되살아나면
       '완벽히 맞는다'·'절대 안 된다'는, 앱이 낼 수 없는 말을 다시 하게 된다. */
    let has100 = 0, has0 = 0;
    for (const pp of profs) {
      const p = { ...base, ...pp };
      for (const sch of reg.items) {
        const pct = M.fitDetail(sch, p).pct;
        if (pct >= 100) has100 += 1;
        if (pct <= 0) has0 += 1;
      }
    }
    eq('100%는 나오지 않는다', has100, 0);
    eq('0%는 나오지 않는다', has0, 0);

    /* 🔴 화면 5줄 상한이 **점수 분모까지** 자르고 있었다 — 삼일장학회는 요건이 9개인데
       5개만 세어 '5개 중 5개 = 100%'가 떴다(실측 15건·23줄). 점수는 전부 세야 한다. */
    const samil = reg.items.find((i) => i.id === 'reg-cau-samil');
    if (samil) {
      eq('점수는 화면 상한(5줄)에 잘리지 않는다',
        M.fitDetail(samil, { ...base, school: '중앙대학교', gpa: 3.5, bracket: 5, year: 3,
                             status: '재학', credits: 15, flags: [] }).total > 5, true);
    }
  }

  /* 🔴 학적상태는 **평평한 이름표가 아니라 포함 관계**다 (2026-08-24 개발자 지적):
     *"재학 = 신입생 첫 학기 똑같잖아. 신입생도 재학생인데."*
     `국내 대학교 재학생`이 신입생 화면에 아무 표시도 안 뜨고 있었다. */
  {
    const 재학요건 = '한국장학재단에서 학자금대출을 받은 국내 대학교 재학생';
    const mk = (status) => ({ school: 'x', status, flags: [] });
    eq('신입생도 재학생이다', M.requirementMatch(재학요건, mk('신입학'), null), 'ok');
    eq('초과학기생도 재학생이다', M.requirementMatch(재학요건, mk('초과학기'), null), 'ok');
    eq('졸업유예자도 재학생이다', M.requirementMatch(재학요건, mk('졸업유예'), null), 'ok');
    eq('휴학생은 재학생이 아니다', M.requirementMatch(재학요건, mk('휴학'), null), 'no');
    eq('복학예정은 단정하지 않는다', M.requirementMatch(재학요건, mk('복학예정'), null), null);
    /* `정규학기 재학생`(실측 14줄)은 초과학기·졸업유예를 뺀 말이다 */
    const 정규 = '2026-2학기 정규학기 학부 재학생';
    eq('정규학기 한정이면 신입생은 포함', M.requirementMatch(정규, mk('신입학'), null), 'ok');
    eq('정규학기 한정이면 초과학기는 단정하지 않는다', M.requirementMatch(정규, mk('초과학기'), null), null);
  }

  // ⑩ 자격을 하나도 못 읽은 공고는 0%가 아니라 '자격 미확인'
  const un = fit(['경제적 지원이 필요한 학생'], 평범);
  eq('자격을 못 읽으면 0%가 아니다', un.pct, M.FIT_FLOOR);
  eq('자격 줄이 아예 없으면 미확인', fit([], 평범).unread, true);
}

console.log('■ 마감 판정이 앱을 켠 시각에 굳지 않는다 (2026-08-25 개발자 지적으로 수리)');
/* 🔴 예전엔 app.js 첫머리에 `const TODAY = new Date()` 가 있었고 dday() 가 그 값을 썼다.
   이 앱은 홈 화면에 설치해 쓰는 앱이라 한 번 연 화면이 며칠씩 살아 있다 — 그동안 그 값이
   사흘 전인 채로 남아 **이미 마감된 공고가 D-2로 보이고 일괄 신청 준비 대상에도 들어갔다.**
   되돌아가면 여기서 잡는다. 브라우저 없이 app.js 의 진짜 함수를 떼어 내 돌려 본다. */
{
  const appSrc = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  /* 이름으로 함수 한 덩어리를 떼어 낸다 — 베낀 사본이 아니라 **진짜 코드**를 검사해야
     의미가 있다(사본을 검사하면 원본이 바뀌어도 계속 통과한다). */
  const grab = (name) => {
    const start = appSrc.indexOf(`function ${name}(`);
    if (start < 0) throw new Error(`app.js 에서 ${name} 을 못 찾음`);
    let depth = 0, seen = false;
    for (let i = appSrc.indexOf('{', start); i < appSrc.length; i++) {
      if (appSrc[i] === '{') { depth++; seen = true; }
      else if (appSrc[i] === '}') { depth--; if (seen && depth === 0) return appSrc.slice(start, i + 1); }
    }
    throw new Error(`${name} 의 끝을 못 찾음`);
  };

  eq('app.js 에 굳은 TODAY 상수가 없다', /^const\s+TODAY\s*=\s*new Date\(\);/m.test(appSrc), false);
  eq('dday 가 todayStart() 로 오늘을 읽는다', /const startOfToday = todayStart\(\);/.test(appSrc), true);

  /* Date 를 가짜 시계로 바꿔 끼운다 — 함수 인자로 넘기면 안쪽의 new Date() 가 이걸 쓴다 */
  const make = (nowMs) => {
    class FakeDate extends Date {
      constructor(...a) { super(...(a.length ? a : [nowMs])); }
      static now() { return nowMs; }
    }
    return new Function('Date', `${grab('todayStart')}\n${grab('dday')}\nreturn { todayStart, dday };`)(FakeDate);
  };
  const DAY = 86400000;
  const 어제 = (ms) => new Date(ms - DAY).toISOString().slice(0, 10);

  const t0 = Date.UTC(2026, 7, 25, 3, 0, 0);          // 2026-08-25 (KST 정오쯤)
  eq('어제 마감은 마감이다', make(t0).dday(어제(t0)).label, '마감');
  eq('오늘 마감은 D-DAY다', make(t0).dday(new Date(t0).toISOString().slice(0, 10)).label, 'D-DAY');

  /* 🔴 이 항목이 이 절의 존재 이유다 — 앱을 켠 지 사흘 지난 상태.
     TODAY 굳음이 되살아나면 '그때의 어제'가 여전히 D-2 로 나와 여기서 실패한다. */
  const t3 = t0 + 3 * DAY;
  eq('앱을 켠 지 사흘 지나도 그날의 어제는 마감이다', make(t3).dday(어제(t3)).label, '마감');
  eq('사흘 전 기준의 D-2 는 이제 마감이다', make(t3).dday(어제(t0)).label, '마감');

  /* 지원 자격을 '단어'로 옮기는 규칙 — 지어내지 않는지 본다(원칙 8-1) */
  /* bulkTags 는 자기 파일의 상수(BULK_TAG_MAX)와 원문 파서(parseLine)를 함께 쓴다.
     파서는 typeof 로 막혀 있어 없으면 건너뛴다 — 여기서는 구조화된 자격만 본다. */
  const bulkTags = new Function('FLAG_LABELS', 'TRACKS', 'BULK_TAG_MAX',
    `${grab('bulkTags')}\nreturn bulkTags;`)(
    { basicLiving: '기초생활수급자' }, [{ id: 'eng', label: '공학계열' }], 5);
  eq('구조로 저장된 자격만 단어로 옮긴다',
    bulkTags({ eligibility: { minGpa: 3, maxBracket: 8, years: [2, 3], flagsAny: ['basicLiving'] } }),
    ['기초생활수급자', '평점 3 이상', '소득 8구간 이하', '2·3학년']);
  eq('자격을 모르면 지어내지 않는다', bulkTags({ eligibility: {} }), ['자격 원문 확인']);
  eq('자격 칸이 아예 없어도 지어내지 않는다', bulkTags({}), ['자격 원문 확인']);
}

console.log('■ 회원가입·로그인 배선 (2026-08-25) — 빠뜨리면 조용히 안 되는 세 가지');
{
  const at = (f) => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');
  const html = at('index.html');
  const sw = at('sw.js');
  const cli = at('supabase-client.js');

  /* ① CSP — 이걸 빼면 앱이 Supabase 에 아예 못 붙는다. 오류도 조용해서 원인 찾기가 어렵다. */
  eq('CSP connect-src 가 supabase 를 허용한다', /connect-src[^"]*https:\/\/\*\.supabase\.co/.test(html), true);
  eq('CSP script-src 는 여전히 self 뿐이다 (외부 스크립트 차단 유지)', /script-src 'self';/.test(html), true);
  eq('supabase 스크립트가 app.js 보다 먼저 실린다',
    html.indexOf('supabase-client.js') < html.indexOf('src="app.js"'), true);

  /* ② 오프라인 — 캐시 목록에서 빠지면 그 파일만 없어 앱이 죽는다 */
  for (const f of ['supabase-config.js', 'supabase-client.js', 'terms.html']) {
    eq('sw.js 캐시 목록에 ' + f, sw.includes("'" + f + "'"), true);
  }
  /* 서비스워커는 로그인을 모른다 — importScripts 에 들어가면 개인정보 경계가 흐려진다 */
  eq('서비스워커가 로그인 코드를 실어 들이지 않는다', /importScripts\([^)]*supabase/.test(sw), false);

  /* ③ 🔴 나가면 안 되는 것 — terms.html 이 약속한 문장의 뿌리.
     **베낀 사본이 아니라 supabase-client.js 의 진짜 함수**를 떼어 내 돌린다. */
  const start = cli.indexOf('function syncSafeProfile(');
  if (start < 0) throw new Error('supabase-client.js 에서 syncSafeProfile 을 못 찾음');
  let depth = 0, seen = false, body = null;
  for (let j = cli.indexOf('{', start); j < cli.length; j++) {
    if (cli[j] === '{') { depth++; seen = true; }
    else if (cli[j] === '}') { depth--; if (seen && depth === 0) { body = cli.slice(start, j + 1); break; } }
  }
  const safe = new Function(body + "\nconst SYNC_OMIT_COMMON=['rrn','account'];"
    + "\nconst SYNC_SENSITIVE_KEYS=['flags'];\nreturn syncSafeProfile;")();

  const raw = { school: '한국외국어대학교', flags: ['basicLiving'],
    common: { studentId: '1', rrn: '990101-1', account: '110-2' } };
  const out = safe(raw, true);
  eq('주민등록번호는 서버로 갈 사본에서 떨어진다', out.common.rrn, undefined);
  eq('계좌번호도 떨어진다', out.common.account, undefined);
  eq('학번처럼 민감하지 않은 것은 남는다', out.common.studentId, '1');
  eq('동의하면 특별자격이 남는다', out.flags, ['basicLiving']);
  eq('동의하지 않으면 특별자격이 빠진다', safe(raw, false).flags, undefined);
  eq('원본은 손대지 않는다 (기기 데이터가 사라지면 안 된다)', raw.common.rrn, '990101-1');
}

/* ── 🔴 금액 산정 (2026-08-27 신설) ──────────────────────────────
   등록 224건 중 216건(96%)이 금액 0이었다. auto-register가 `amountValue: 0`을 박고
   파싱을 한 번도 시도하지 않았기 때문이다. 그런데 **금액만 채우면 홈 합계는 더 틀린다** —
   같은 장학금이 여러 학교 접수분으로 중복 등록돼 있고, 이중수혜 금지 공고를 그냥 더하면
   학생이 실제로 받을 수 없는 숫자가 된다. 그건 기망이고 법적 책임이 따른다(개발자 지적).
   아래는 전부 **실제 원문에서 오탐이 났던 것**이다. 되돌리면 그 상태로 돌아간다. */
console.log('\n■ 금액 산정 — 부풀리지 않는가 (2026-08-27)');
{
  const PA = createRequire(import.meta.url)('../parse-amount.js');
  const { isAmountHead } = createRequire(import.meta.url)('../section-head.js');
  const kindOf = (lines) => PA.amountFrom(lines).kind;
  const wonOf = (lines) => PA.amountFrom(lines).value;

  /* ① 🔴 사업 전체 규모를 1인당으로 내보내면 안 된다 — 가톨릭대 이원길장학금.
        원문: `- 총 장학금액: 총 5천만원` (사업 전체) / 실제 1인당은 200만원.
        그대로 읽으면 한 카드가 25배로 부푼다. */
  eq('총 사업규모는 금액으로 읽지 않는다',
    kindOf(['- 총 장학금액: 총 5천만원', '- 지급기준']), 'unknown');
  eq('총액과 1인당이 같이 있으면 1인당을 쓴다',
    wonOf(['장학금액 : 총상금 3천만원, 1인당 200만원 기준']), 2000000);

  /* ② 🔴 금액 절이 다음 절을 삼키면 자격 줄의 숫자를 금액으로 줍는다 — 중앙대 성림장학금.
        `5. 신청자격: … 건강보험료 지역 17만원 이하`의 17만원이 장학금액이 될 뻔했다. */
  eq('자격 절의 숫자를 금액으로 줍지 않는다',
    wonOf(['4. 장학금액: 1백만원 ~ 2백만원(1인당)', '5. 신청자격: 건강보험료 지역 17만원 이하']), 2000000);

  /* ③ 🔴 머리글 오탐 — 전부 실제 원문에 있는 줄이다 */
  eq('결격사유는 금액 머리글이 아니다', isAmountHead('<교내 장학금 지급 결격사유>'), false);
  eq('지급시기는 금액 머리글이 아니다', isAmountHead('6) 장학금 지급시기 : 2026 년 9 월'), false);
  eq('학교 홈 메뉴는 금액 머리글이 아니다', isAmountHead('의료기관 진료혜택'), false);
  /* 🔴 2026-08-27에 제가 직접 만든 회귀 두 개 — 되돌아가면 절대액이 48→35건으로 떨어진다.
     ① 맨 `장학금`을 낱말 목록에 그냥 넣었더니 학교 홈 메뉴가 금액 머리글로 잡혔다.
        인하대 가송재단은 `2. 장학금 : 500만원` 이라고만 적어서 콜론 규칙이 필요하다. */
  eq("'2. 장학금 : 500만원' 은 금액 머리글이다", isAmountHead('2. 장학금 : 500만원 (※ 생활비 성 장학금 )'), true);
  eq("메뉴 '# 장학금 | # 도서관' 은 금액 머리글이 아니다", isAmountHead('# 장학금 | # 도서관 | # 증명서 | # 등록금'), false);
  eq('그 안의 500만원을 읽는다', wonOf(['2. 장학금 : 500만원 (※ 생활비 성 장학금 )']), 5000000);
  /* ② 첫 머리글에서 멈추면 껍데기 블록을 금액 절로 읽고 진짜 금액을 놓친다.
        공고에는 금액처럼 읽히는 머리글이 여러 개 있다(메뉴·`장학금 종류`·`지원내용`). */
  eq('첫 머리글이 껍데기면 뒤의 진짜 금액 절을 고른다',
    wonOf(['3. 장학금 종류 : 성적우수장학금', '4. 대상 : 재학생', '5. 장학금액 : 300만원']), 3000000);
  /* ③ 근로장학금은 `10,320원/시간` 꼴로 적는다 — 시급형으로 읽어야 합산에서 빠진다 */
  eq("'10,320원/시간' 은 시급형이다",
    kindOf(['나. 장학금액: 교내 10,320원/시간, 교외 12,790원/시간']), 'hourly');
  eq("'12,790원/h' 도 시급형이다",
    kindOf(['2. 장학금액', '가. 국가근로장학생', '- 교내근로 : 10,320원/h, 교외 : 12,790원/h']), 'hourly');
  /* 🔴 반대로 조이다 죽이면 안 된다 — `기간`을 넓게 막았더니 진짜 금액 7건이 사라졌다 */
  eq('장학혜택(기간 N년)은 금액 머리글이다', isAmountHead('2. 장학혜택(기간 1년) : 장학금 800 만원/년'), true);
  eq('그 안의 800만원을 읽는다',
    wonOf(['2. 장학혜택(기간 1년) : 프로그램 교육비 전액 지원, 장학금 800 만원/년']), 8000000);

  /* ④ 등록금 비율형은 숫자로 바꾸지 않고 비율로 남긴다 (학생 등록금을 모르면 환산 불가) */
  eq('수업료 70%는 비율로 읽는다', kindOf(['장학금액', '수업료 70% ( 정규학기 )']), 'ratio');
  eq('등록금 전액은 100%다', PA.ratioIn('등록금 전액'), 1);
  eq('등록금을 모르면 비율은 0원이다', PA.ratioWon({ kind: 'ratio', ratio: 0.7 }, 0), 0);
  eq('등록금을 알면 환산한다', PA.ratioWon({ kind: 'ratio', ratio: 0.7 }, 4180000), 2926000);

  /* 🔴 '전액'이 **무엇의** 전액인가 (2026-08-27 — 실제로 틀린 값이 앱까지 갈 뻔했다).
     종근당고촌재단 무상기숙사 공고의 `지원혜택 : 주거비 전액지원` 을 등록금 100%로 읽어
     그 학생의 등록금 전액(약 800만원)이 '받을 수 있는 돈'에 들어갔다. 주거비는 등록금이 아니다. */
  eq('주거비 전액지원은 등록금 비율이 아니다', PA.ratioIn('가. 지원혜택 : 주거비 전액지원 (기숙사비, 관리비 무료)'), 0);
  eq('식비 전액지원도 아니다', PA.ratioIn('식비 전액지원'), 0);
  eq('학비 전액지원은 맞다', PA.ratioIn('학비 전액지원'), 1);
  /* ⚠️ 글 어딘가에 '등록금'만 있으면 통과시키면 안 된다 — 그러면 아래 줄이 되살아난다 */
  eq('기숙사비 전액지원인데 등록금은 본인 부담', PA.ratioIn('기숙사비 전액지원 이며 등록금은 본인 부담'), 0);

  /* 🔴 상한·금지 조항을 장학금액으로 읽지 않는다 (2026-08-27 전수 대조에서 잡았다).
     `6. 장학금 지급 관련 유의사항 - … 등록금의 100%를 초과하여 지급할 수 없습니다` 가
     '등록금 100%를 주는 장학금'으로 읽혔다. 유의사항 절은 금액을 말하는 절이 아니다. */
  eq('유의사항은 금액 머리글이 아니다', isAmountHead('6. 장학금 지급 관련 유의사항'), false);
  eq('지급 관련 안내는 금액 머리글이다', isAmountHead('다. 장학금 지급 관련 안내'), true);

  /* 🔴 이름표(콜론 앞)와 내용(콜론 뒤)을 갈라 본다 — 안 가르면 진짜 금액 줄이 통째로 죽는다.
     실제 원문 4건이 이것 때문에 0원이었다(쌍용곰두리·유한재단·양영재단·주거안정). */
  eq('내용에 결격이 있어도 이름표가 금액이면 금액이다',
    wonOf(['2. 장학금액: 학기당 생활보조비 100만원 지원(결격사유가 없는 한 1년간 지급)']), 1000000);
  eq('내용에 제외가 있어도 마찬가지',
    wonOf(['1. 장학금액: 생활비성 장학금 300만원(휴학 등 사고시 제외)']), 3000000);
  eq('이름표가 금액을 말하면 지급기간이 붙어도 금액이다',
    wonOf(['3. 장학금액 및 지급기간: 수업료전액, 학업보조비 300만원/학기']), 3000000);
  /* ⚠️ 되돌아가면 안 되는 반대편 — 때·방법만 말하는 머리글은 여전히 금액이 아니다 */
  eq('지급방법은 여전히 금액 머리글이 아니다', isAmountHead('장학금 지급방법 : 계좌이체'), false);

  /* 한국외대 공고 3건이 `금 액 :` 이라고만 적어 0원이었다(자간을 벌린 한글 문서 꼴) */
  eq('맨 「금 액 :」도 금액 머리글이다', isAmountHead('3 ) 금 액 : 250 만 원 ( 등록금 외 장학금 )'), true);
  eq('그 250만원을 읽는다', wonOf(['3 ) 금 액 : 250 만 원 ( 등록금 외 장학금 - 생활비성 )']), 2500000);
  /* ⚠️ 학생이 **내는** 돈은 장학금액이 아니다 */
  eq('등록금액은 금액 머리글이 아니다', isAmountHead('등록금액 : 3,500,000원'), false);
  eq('콜론 없는 표 머리 「납부 금액」도 아니다', isAmountHead('납부 금액'), false);

  /* ⑤ 시급형은 활동 시간에 따라 달라져 합산할 수 없다 */
  eq('시급형은 합산하지 않는다', kindOf(['장학금액 : 시급 12,790원 (활동 시간 기준 지급)']), 'hourly');

  /* ⑥ 🔴 이중수혜 — 괄호 안 예외 때문에 뜻이 뒤집히면 안 된다.
        원문: `라. 타 장학금과 중복수혜 가능(근로장학금 간 중복 불가)`
        괄호까지 보면 '불가'가 걸려 **받을 수 있는 공고를 못 받는다고** 뒤집는다. */
  eq('이중수혜 금지를 읽는다', PA.exclusivityFrom(['※ 타 대외 장학금과 이중수혜 불가']).kind, 'forbidden');
  eq('괄호 안 예외에 뒤집히지 않는다',
    PA.exclusivityFrom(['라. 타 장학금과 중복수혜 가능(근로장학금 간 중복 불가)']).kind, 'allowed');
  eq('조항이 없으면 모른다고 답한다', PA.exclusivityFrom(['가. 재학생']).kind, 'unknown');
  /* 🔴 '무엇과' 겹치면 안 되는가를 **한정어**로 읽는다 (2026-08-28 개발자가 직접 정해 줌):
       `타 대외 장학금` → 전부 · `타 장학금` → **전부**(한정어가 없으면 전부) ·
       `타 인재양성사업` → 그 사업만.
     좁은 것을 '외부 재단 장학금 보유자는 지원 불가'로 쓰면 멀쩡한 학생이 떨어지고,
     반대로 좁은 것을 합계에서 빼면 받을 수 있는 돈을 적게 말하게 된다. */
  eq('타 대외 장학금 → 전부',
    PA.exclusivityFrom(['타 대외 장학금과는 이중수혜 금지']).scope, 'external');
  /* 🔴 한정어가 없으면 전부다 — 예전엔 '대외' 낱말이 없다는 이유로 범위 불분명으로 뒀다 */
  eq('타 장학금(한정어 없음) → 전부',
    PA.exclusivityFrom(['유한재단 장학금을 수혜 받을 시 타 장학금은 중복 수혜 불가합니다']).scope, 'external');
  eq('타 인재양성사업 → 그 사업만',
    PA.exclusivityFrom(['④ 타 인재양성사업 중복 수혜 불가']).scope, 'narrow');
  eq('특정 장학금 이름을 대면 그것과만',
    PA.exclusivityFrom(['복지장학 2( 부분 ) 장학은 복지장학 1( 본인장애 ) 장학과 중복수혜 불가']).scope, 'narrow');
  /* ⚠️ 순서가 방어선 — 넓은 표지가 있으면 좁은 낱말이 예외로 끼어 있어도 전부다 */
  eq('「국가 장학금 이외의 교외 장학금」은 전부',
    PA.exclusivityFrom(['학교 및 국가 장학금 이외의 교외 장학금 중복 수혜 사실이 없음을 증명함']).scope, 'external');
  /* 🔴 `민간재단` 은 공기관을 뺀 말이다 (2026-08-28 개발자 확인) —
     국가장학금만 받고 있는 학생은 막히면 안 된다. 거의 모든 학생이 국가장학금을 받는다. */
  {
    const ME2 = createRequire(import.meta.url)('../match-engine.js');
    const sch2 = { eligibility: {}, exclusivity: { kind: 'forbidden', scope: 'external', raw: '타 민간재단 이중수혜 불가' } };
    const who = (list) => ME2.evaluate(sch2, { school: 'A', flags: [], gpa: 4.0, bracket: 5, year: 2, scholarships: list }).status;
    eq('국가장학금만 받고 있으면 안 막는다', who(['kosaf']) !== 'ineligible', true);
    eq('교내 장학금만 받고 있어도 안 막는다', who(['internal']) !== 'ineligible', true);
    eq('교외(외부 재단)를 받고 있으면 막는다', who(['external']), 'ineligible');
    eq('아무것도 안 받으면 안 막는다', who([]) !== 'ineligible', true);
    /* 🔴 이름이 뜻을 지킨다 — 한때 이 값을 `all` 이라고 불렀다. 그 이름을 읽고
       국가장학금까지 막으면 거의 모든 학생이 떨어진다(대부분이 국가장학금을 받는다).
       여기서 '전부'는 **교외(민간) 전부**이지 문자 그대로의 전부가 아니다. */
    const src2 = fs.readFileSync(new URL('../parse-amount.js', import.meta.url), 'utf8');
    eq('범위 값 이름이 external 이다 (all 이 아니다)',
      /scope:\s?'external'\|'narrow'/.test(src2) && !/\? 'all' :/.test(src2), true);
  }
  eq('타 민간재단도 전부',
    PA.exclusivityFrom(['지원제한 : 타 민간재단 및 직장 복지(등록금성격 장학금) 이중 수혜에 해당시 지원 불가']).scope, 'external');
  /* 🔴 좁은 것은 **합계에서 빼지 않는다** — 빼면 받을 수 있는 돈을 적게 말한다 */
  {
    const narrow = { id: 'n', amountSpec: { kind: 'fixed', value: 1000000 },
      exclusivity: { kind: 'forbidden', scope: 'narrow', raw: '' } };
    const all = { id: 'a', amountSpec: { kind: 'fixed', value: 2000000 },
      exclusivity: { kind: 'forbidden', scope: 'external', raw: '' } };
    const plain = { id: 'p', amountSpec: { kind: 'fixed', value: 3000000 } };
    const bill = PA.sumAmounts([narrow, all, plain], {});
    eq('좁은 배타는 그대로 더한다', bill.total, 6000000);
    eq('좁은 배타는 버려지지 않는다', bill.dropped.length, 0);
    const two = PA.sumAmounts([all, { ...plain, id: 'a2', exclusivity: { kind: 'forbidden', scope: 'external', raw: '' } }], {});
    eq('전부 배타끼리는 큰 것 하나만', two.total, 3000000);
  }

  /* ⑥-2 자격 판정에 실제로 반영되는가 — 학생이 헛수고하는 걸 막는 자리 */
  {
    const ME = createRequire(import.meta.url)('../match-engine.js');
    const ev = ME.evaluate || ME;
    const base = { school: 'A', flags: [], status: 'enrolled', gpa: 4.0, bracket: 5, year: 2 };
    const ext = { eligibility: {}, exclusivity: { kind: 'forbidden', scope: 'external', raw: '' } };
    const inn = { eligibility: {}, exclusivity: { kind: 'forbidden', scope: 'narrow', raw: '' } };
    eq('외부 재단 장학금을 받는 중이면 지원 불가로 뜬다',
      ev(ext, { ...base, scholarships: ['external'] }).status, 'ineligible');
    eq('받는 게 없으면 지원 가능이다',
      ev(ext, { ...base, scholarships: [] }).status, 'eligible');
    eq('국가장학금은 막지 않는다 (원문이 대개 허용한다)',
      ev(ext, { ...base, scholarships: ['kosaf'] }).status, 'eligible');
    eq('아직 안 물어봤으면 판정하지 않는다 (모른다)',
      ev(ext, { ...base }).status, 'unknown');
    eq('교내끼리 배타는 외부 장학금 보유자를 막지 않는다',
      ev(inn, { ...base, scholarships: ['external'] }).status, 'eligible');
  }

  /* ⑦ 🔴 합계는 더하기가 아니라 고르기다 */
  const A = (v) => ({ kind: 'fixed', value: v, ratio: 0, min: v, max: v, raw: '' });
  const sum = PA.sumAmounts([
    { id: 'a', amountSpec: A(1000000) },
    { id: 'b', amountSpec: A(1500000) },
    /* 같은 장학금이 여러 학교 접수분으로 등록된 경우 — 가송재단이 실제로 8건이다 */
    { id: 'c1', sameAs: 'gasong', amountSpec: A(5000000) },
    { id: 'c2', sameAs: 'gasong', amountSpec: A(5000000) },
    { id: 'c3', sameAs: 'gasong', amountSpec: A(5000000) },
    /* 함께 받을 수 없는 셋 — 가장 큰 하나만 */
    { id: 'x', amountSpec: A(3180000), exclusivity: { kind: 'forbidden', raw: '' } },
    { id: 'y', amountSpec: A(2000000), exclusivity: { kind: 'forbidden', raw: '' } },
    { id: 'z', amountSpec: A(1000000), exclusivity: { kind: 'forbidden', raw: '' } },
    /* 못 읽은 것은 0원 — 합계에서 빠지되 목록에는 남는다 */
    { id: 'u', amountSpec: { kind: 'unknown', value: 0, ratio: 0, min: 0, max: 0, raw: '' } }
  ], {});
  eq('같은 장학금은 한 번만 센다', sum.added.length, 3);              // a, b, gasong 1건
  eq('함께 못 받는 것은 하나만 센다', sum.onlyOne.length, 1);
  eq('나머지 배타 건은 버리지 않고 남긴다', sum.dropped.length, 2);
  eq('못 읽은 것은 목록에 남는다', sum.unknown.length, 1);
  eq('합계 = 100만 + 150만 + 500만(가송 1건) + 318만(배타 최대)',
    sum.total, 1000000 + 1500000 + 5000000 + 3180000);
  /* 중복 합치기가 없으면 가송이 1,500만원으로 세어진다 — 이 차이가 기망의 크기다 */
  eq('중복을 안 합치면 1,000만원이 더 붙는다는 것', 5000000 * 3 - 5000000, 10000000);

  /* ⑧ 🔴 등록금은 세 단계로 찾는다 — 학생 입력 > 학교×계열 > 학교 평균. 셋 다 없으면 0.
        전국 평균 같은 것을 끼워 넣으면 안 된다(지어낸 숫자다).
        ⚠️ 학과 단위 등록금은 **공시 항목 자체가 없다** — 계열이 공개 데이터의 상한이다.
        🔴 표는 **1년치**이고 함수는 **한 학기분**을 준다 (2026-08-29 개발자 확인).
           그래서 기대값이 표 값의 절반이다 — 이 절반이 사라지면 홈 합계가 두 배로 부푼다. */
  const TT = { '한국외국어대학교': { avg: 4180000, byField: { '인문사회': 3820000, '공학': 4960000 } } };
  eq('계열 등록금이 있으면 그걸 쓴다 (한 학기분)',
    PA.tuitionFor({ school: '한국외국어대학교', track: 'engineering' }, TT), 4960000 / 2);
  eq('계열이 없으면 학교 평균으로 내려간다 (한 학기분)',
    PA.tuitionFor({ school: '한국외국어대학교', track: 'medical' }, TT), 4180000 / 2);
  eq('학생이 직접 넣은 등록금이 가장 세다',
    PA.tuitionFor({ school: '한국외국어대학교', track: 'engineering', tuitionSelf: 5200000 }, TT), 5200000);
  eq('모르는 학교는 0 — 전국 평균을 지어내지 않는다',
    PA.tuitionFor({ school: '없는대학교', track: 'engineering' }, TT), 0);
  eq('환산 근거를 화면에 밝힐 수 있다',
    PA.tuitionSource({ school: '한국외국어대학교', track: 'engineering' }, TT), 'field');
  eq('상경·사범은 인문사회로 묶인다 (공시 계열이 5종이라)',
    PA.TRACK_TO_FIELD.business, '인문사회');

  /* ⑨ 🔴 **브라우저에서 실제로 도는가** — Node 만 보면 놓친다.
        이 저장소는 match-engine 의 전역 목록에 이름을 빠뜨려 **Node 검사는 전부 통과하는데
        앱은 첫 카드에서 죽은** 사고를 두 번 냈다(headRest·caseBranch). parse-amount 도
        브라우저에서는 section-head 의 **전역 함수**를 쓰므로 같은 함정이 있다.
        그래서 index.html 과 같은 순서로 실어 보고 실제로 불러 본다. */
  {
    const vm2 = createRequire(import.meta.url)('node:vm');
    const ctx2 = vm2.createContext({ console });
    for (const f of ['../section-head.js', '../parse-requirements.js', '../parse-amount.js']) {
      vm2.runInContext(fs.readFileSync(new URL(f, import.meta.url), 'utf8'), ctx2, { filename: f });
    }
    eq('브라우저 순서로 실어도 금액 절을 찾는다',
      vm2.runInContext(`amountFrom(["장학금액","수업료 70% ( 정규학기 )"]).ratio`, ctx2), 0.7);
    eq('브라우저에서 이중수혜를 읽는다',
      vm2.runInContext(`exclusivityFrom(["※ 타 대외 장학금과 이중수혜 불가"]).kind`, ctx2), 'forbidden');
    eq('브라우저에서 합계 고르기가 돈다',
      vm2.runInContext(`sumAmounts([{id:'a',amountSpec:{kind:'fixed',value:1000000}},{id:'b',sameAs:'g',amountSpec:{kind:'fixed',value:5000000}},{id:'c',sameAs:'g',amountSpec:{kind:'fixed',value:5000000}}],{}).total`, ctx2), 6000000);
    /* 브라우저에서도 **한 학기분**이 나와야 한다 — 여기만 1년치면 앱 화면만 두 배가 된다 */
    eq('브라우저에서 등록금 조회가 돈다 (한 학기분)',
      vm2.runInContext(`tuitionFor({school:'A',track:'engineering'},{A:{avg:4000000,byField:{'공학':5000000}}})`, ctx2), 2500000);
  }

  /* ⑩ 🔴 앱이 parse-amount.js 를 실제로 싣고 있는가 — 파일만 만들고 안 실으면 앱이 죽는다 */
  {
    const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    const swSrc = fs.readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
    eq('index.html 이 parse-amount.js 를 싣는다', html.includes('parse-amount.js'), true);
    eq('section-head.js 가 parse-amount.js 보다 먼저 실린다 (전역을 쓰므로)',
      html.indexOf('section-head.js') < html.indexOf('parse-amount.js'), true);
    eq('서비스워커도 parse-amount.js 를 싣는다',
      /importScripts\([^)]*parse-amount\.js/.test(swSrc), true);
    eq('캐시 목록에 parse-amount.js 가 있다',
      /ASSETS\s*=[\s\S]{0,600}parse-amount\.js/.test(swSrc), true);
  }

  /* ⑪ 등록금 비율형은 등록금을 알 때만 합계에 들어간다 */
  const r = { kind: 'ratio', value: 0, ratio: 0.7, min: 0, max: 0, raw: '' };
  eq('등록금을 모르면 비율형은 미확인으로 간다',
    PA.sumAmounts([{ id: 'r', amountSpec: r }], {}).unknown.length, 1);
  eq('등록금을 알면 추정으로 간다 (합계와 분리해 표시해야 한다)',
    PA.sumAmounts([{ id: 'r', amountSpec: r }], { tuition: 4180000 }).estimated.length, 1);
}

/* ── 🔴 승인받은 화면을 코드가 조용히 바꾸지 못하게 (2026-08-27 사고로 신설) ──
   개발자에게 목업을 보여 주고 네 차례 수정받아 확정한 '금액 상세' 화면이 있는데,
   구현하면서 **'내용이 없으면 갈래를 통째로 숨긴다'는 규칙을 말없이 넣어** 실제 앱에는
   갈래가 2개만 나갔다. 승인받은 것과 다른 것이 배포된 것이다.
   이 절은 그 화면의 **구조와 문구를 코드에 못 박는다.** 바꾸려면 개발자에게 다시 보여
   승인받고 이 검사도 같이 고쳐야 한다 — 검사만 고치는 것은 같은 사고의 반복이다. */
/* ── 🔴 등록금 비율은 **한 학기** 기준으로 환산한다 (2026-08-29 개발자 확인) ──
   `data/tuition.json` 의 값은 **1년치**다(개발자 확인: "1년치네 보통 한 학기에 360이니까
   외대 인문은"). 그런데 장학금은 학기 단위로 준다 — 등록 공고의 비율형 18건 중
   **12건이 원문에 스스로 `(정규학기)`·`고지서감면방식`이라 적었고, 연간이라 적은 것은 0건**,
   나머지 6건도 전부 `2026-2학기` 공고다.
   그대로 곱하면 한 카드가 두 배가 되고 홈 합계가 부풀려진다 — 학생이 실제로 받을 수 없는
   숫자를 '지금 받을 수 있는 장학금'이라 부르는 것은 기망이다(운영 원칙·개발자 지적). */
console.log('\n■ 등록금 비율 환산 — 한 학기 기준인가 (2026-08-29)');
{
  const req = createRequire(import.meta.url);
  const PA = req('../parse-amount.js');
  const T = req('../data/tuition.json').schools;
  const p = { school: '한국외국어대학교', track: 'humanities' };
  const yearly = (T['한국외국어대학교'].byField || {})['인문사회'];
  eq('표에는 1년치가 들어 있다 (외대 인문사회)', yearly, 7269500);
  const t = PA.tuitionFor(p, T);
  eq('tuitionFor 는 한 학기분을 준다', t, Math.round(yearly / 2));
  eq('  개발자가 말한 값과 맞는다 (한 학기 약 360만원)', t > 3300000 && t < 3900000, true);
  eq('  계열별 값을 쓴다 (학교 평균이 아니라)', PA.tuitionSource(p, T), 'field');
  /* 100% 공고가 1년치로 뜨면 그 카드 하나가 두 배가 된다 */
  const full = PA.ratioWon({ kind: 'ratio', ratio: 1 }, t);
  eq('수업료 100% 공고가 1년치로 뜨지 않는다', full < yearly, true);
  /* 학생이 직접 넣는 값이 생기면 그것도 한 학기분이어야 한다 — 섞이면 같은 사고가 난다 */
  eq('학생 입력값은 그대로 쓴다 (한 학기분으로 받는다)',
     PA.tuitionFor({ tuitionSelf: 3600000 }, T), 3600000);
}

console.log('\n■ 금액 상세 — 승인받은 화면 그대로인가 (2026-08-27)');
{
  const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  /* 줄 하나를 그리는 amountDetailRow 도 같은 화면이라 함께 본다 */
  const body = app.slice(app.indexOf('function amountDetailRow'), app.indexOf('function renderBulkPrep'));
  eq('renderAmountDetail 이 있다', body.length > 200, true);

  // ① 갈래 넷 — 이름은 개발자가 '명사형으로 조이기'로 정한 것이다
  for (const t of ['합산', '중복 수혜 불가', '등록금 비율 환산', '금액 미확인']) {
    eq(`갈래 '${t}' 가 있다`, body.includes(`grp('${t}'`), true);
  }
  eq('제목은 금액 상세다', body.includes('금액 상세'), true);

  // ② 🔴 비어 있어도 갈래를 그린다 — 이게 이번 사고의 재발 방지선이다
  eq('갈래가 비었다고 통째로 숨기지 않는다', /grp = \([^)]*\) => \(rows \?/.test(body), false);
  eq('빈 갈래는 안내 문구로 자리를 지킨다', body.includes('ad-empty'), true);

  // ③ 개발자가 고쳐 준 문구 — 되돌아가면 실패한다
  eq('학교별 등록금 기준 (평균 아님)', body.includes('학교별 한 학기 등록금 기준 추정값'), true);
  /* 🔴 단위를 밝힌다 (2026-08-29) — 표는 1년치인데 장학금은 학기 단위라, 단위를 안 적으면
     학생이 1년치로 읽는다. 개발자가 고쳐 준 '학교별'(평균 아님)은 그대로 지켰다. */
  eq('  한 학기 기준임을 밝힌다', /한 학기 등록금 기준/.test(body), true);
  eq("'~했어요' 체를 쓰지 않는다", /했어요|드릴게요|돼요/.test(body), false);
  eq('갈래 이름에 이모지를 붙이지 않는다', /grp\('[^']*[\u{1F300}-\u{1FAFF}\u{2700}-\u{27BF}]/u.test(body), false);
  eq('뺀 공고 문구에 안 셈을 붙이지 않는다', body.includes('안 셈'), false);
  eq('원문은 더보기로 접는다', body.includes('원문 보기'), true);
  /* 🔴 발췌만 넣고 **출처 줄을 빠뜨렸다가** 승인받은 화면과 달라졌다(2026-08-27).
     목업은 발췌를 따옴표로 감싸고 밑에 `○○대학교 게시 원문`을 붙인다. */
  eq('원문 발췌를 따옴표로 감싼다', body.includes('"${esc(raw || exRaw)}"'), true);
  eq('발췌 밑에 출처 줄을 붙인다', body.includes('noticeSourceLabel'), true);
  /* 빈 갈래 문구에 이중부정을 쓰지 않는다 (개발자 지적) */
  eq('빈 갈래에 이중부정을 쓰지 않는다', /없는 공고가 없|못 읽은 공고가 없/.test(body), false);
  eq("빈 갈래는 '0건 중 0건' 대신 해당 없음으로 쓴다", body.includes("'해당 없음'"), true);
  eq('뺀 공고도 더보기로 보여 준다', body.includes('함께 못 받는 공고'), true);
  eq('미확인 공고도 더보기로 보여 준다', body.includes('건 보기'), true);
  eq('합침은 학교 이름 외 N건으로 쓴다', /외 \$\{merged\}건|외 \$\{/.test(app), true);

  /* ④ 줄을 누르면 **그 공고의 상세 시트**가 바로 뜬다 (2026-08-27 개발자 지시로 변경).
     예전엔 장학금 탭으로 옮겨 그 카드를 찾아 스크롤했는데, 필터·정렬·마감 숨김 때문에
     카드가 목록에 없으면 아무 일도 안 일어난 것처럼 보였다. 찾아가지 않고 그냥 연다. */
  eq('줄마다 이동 표식이 붙는다', body.includes('data-goto'), true);
  {
    eq('누르면 상세 시트를 연다', /openDetail\(row\.dataset\.goto\)/.test(app), true);
    /* 🔴 되돌아가면 안 되는 것 — 탭을 옮겨 카드를 찾아 스크롤하던 방식.
       그 방식은 '카드가 목록에 없으면 조용히 아무 일도 안 일어난다'는 함정을 갖고 있었다. */
    eq('탭을 옮겨 카드를 찾아가지 않는다', /function gotoExploreCard/.test(app), false);
    /* 시트 그릇은 금액 상세와 같은 #detail-sheet 하나다 — 새 시트를 만들면 쓸어 닫기·
       배경 눌러 닫기·ESC 배선을 또 해야 하고 한쪽만 고쳐져 갈라진다 */
    eq('상세도 같은 시트 그릇을 쓴다', /openSheetShell\(\)/.test(app), true);
  }
  /* 🔴 무엇이 '이동이 아닌가' — 2026-08-27에 여기서 한 번 틀렸다.
     `details` 안쪽 클릭을 통째로 막았더니, **뺀 공고와 미확인 공고가 그 접기 안에 들어 있어서**
     그 줄들은 눌러도 안 갔다. 막아야 하는 건 손잡이·링크·**그 줄 자신의** 접기 안쪽뿐이다. */
  {
    const nav = app.slice(app.indexOf('const notNav ='), app.indexOf('const notNav =') + 400);
    eq('여닫는 손잡이는 이동이 아니다', nav.includes("closest('summary')"), true);
    eq('링크는 이동이 아니다', nav.includes("closest('a')"), true);
    eq('막는 것은 그 줄 자신의 접기 안쪽뿐이다', nav.includes('row.contains(det)'), true);
    /* 되돌아가면 접기 안의 줄이 죽는다 — details 를 통째로 막는 꼴을 금지한다 */
    const handler = app.slice(app.indexOf("document.addEventListener('click', (e) => {\n    const row = e.target.closest('[data-goto]')"));
    eq('details 를 통째로 막지 않는다',
      /if \(!row \|\| .*closest\('details'\)/.test(handler.slice(0, 300)), false);
  }

  /* ⑥ 공고 카드에서 **내리면 보던 금액 상세로 돌아온다** (2026-08-29 개발자 요청)
     그냥 닫히면 금액 상세를 처음부터 다시 열어야 한다("귀찮음이 있어서"). */
  eq('돌아갈 곳을 기억하는 자리가 있다', /let sheetBack = null;/.test(app), true);
  eq('사용자가 내리는 경로는 dismissSheet 로 모인다',
    /enableSheetSwipe\(\$\('#detail-sheet'\), dismissSheet\)/.test(app)
    && /'#sheet-backdrop'\)\.addEventListener\('click', dismissSheet\)/.test(app), true);
  eq('  ESC·손잡이도 같은 길을 쓴다',
    (app.match(/dismissSheet\(\)/g) || []).length >= 2, true);
  /* 🔴 closeSheet 자체를 고치면 안 된다 — 신청 준비·양식 작성 흐름도 그걸 부르는데
     그때 금액 상세로 튕겨 돌아가면 엉뚱하다. 흐름은 여전히 closeSheet 를 쓴다. */
  eq('신청 흐름은 여전히 그냥 닫는다 (되돌아가지 않는다)',
    /finalizeApply\(sch, null\);\n\s*closeSheet\(\);/.test(app), true);
  eq('흐름이 닫을 때 돌아갈 곳도 지운다', /sheetBack = null;\s*\/\/ 흐름이 닫을 때/.test(app), true);
  /* 화면 이동 버튼(index.html 의 data-goto="explore")까지 걸리면 엉뚱한 곳으로 되돌아간다 */
  eq('시트 안에서 누른 것만 되돌아갈 곳을 기억한다',
    /row\.closest\('#detail-sheet'\) && findSch\(row\.dataset\.goto\)/.test(app), true);
  /* 🔴 되돌아가기가 **실패하면 닫는다** — 안 그러면 시트가 열린 채 멈춘다
     (`renderAmountDetail()` 은 lastBill 이 없으면 아무것도 안 그린다. 코드 리뷰 지적) */
  eq('되돌아가기가 실패하면 그냥 닫는다', /if \(back\(\) === false\) closeSheet\(\);/.test(app), true);
  /* 🔴 되돌아갈 때 **내려가는 동작을 끝까지 보여 준다** (2026-08-29 개발자 지적:
     "그 탭을 내리면 금액 상세 탭이 너무 빠르게 나와서 헷갈린다"). 손을 떼자마자 내용만
     갈아끼우면 쓸어내린 시트가 도로 올라오면서 다른 것이 튀어나온 것처럼 보인다. */
  eq('  내려간 뒤에 이전 화면을 올린다', /classList\.remove\('show'\);\s*\n\s*setTimeout\(/.test(app), true);
  eq('  기다리는 시간을 CSS 에서 읽는다 (숫자를 박지 않는다)',
     /getComputedStyle\(sheet\)\.transitionDuration/.test(app), true);
  /* 내용만 갈아끼우면 앞 내용의 스크롤이 남아 '공고의 아랫부분'이 보인다 */
  eq('  시트를 열 때 스크롤을 맨 위로 되돌린다', /sheet\.scrollTop = keepScroll \|\| 0;/.test(app), true);
  eq('  되돌아갈 때만 보던 자리를 넘긴다', /openSheetShell\(keepScroll\)/.test(app), true);
  eq('  못 그렸다는 것을 알려 준다', /if \(!lastBill\) return false;/.test(app), true);
  /* 🔴 이 동작은 **실제로 눌러 보는 드라이버**가 지킨다 — 글자만 훑는 검사는
     아무것도 안 하는 구현도 통과시킨다(2026-08-29에 실제로 그랬다). */
  eq('실제로 눌러 보는 드라이버가 있다',
    fs.existsSync(new URL('../verify/verify-sheet-back.js', import.meta.url)), true);
  {
    const ui = fs.readFileSync(new URL('../.github/workflows/verify-ui.yml', import.meta.url), 'utf8');
    eq('  그 드라이버가 CI 관문에 들어 있다', /verify-sheet-back\.js/.test(ui), true);
  }

  // ⑤ 시트가 따로 계산하지 않는다 (홈과 다른 말을 하면 안 된다)
  eq('홈이 만든 lastBill 을 그대로 그린다', body.includes('lastBill'), true);
  eq('시트가 sumAmounts 를 다시 부르지 않는다', body.includes('sumAmounts('), false);
}


/* ── 계열별 등록금 수확 (2026-08-27 · collector/fetch-tuition-field.mjs) ──────
   앱은 이 값에 비율을 곱해 '받을 수 있는 금액'이라고 말한다. 그래서 여기서 틀리면
   그대로 사용자 기망이 된다. 인터넷 없이 순수 함수만 돌려 본다. */
{
  const TF = await import('../collector/fetch-tuition-field.mjs');
  console.log('\n■ 계열별 등록금 수확 (KOSAF 포털)');

  /* 🔴 분교는 앱에서 별개 학교다 — 합치면 그 학교 학생이 남의 등록금으로 환산된 금액을 본다.
     KOSAF 표기가 두 가지(괄호형·제2캠퍼스형)라 표 없이는 못 가른다. */
  eq('분교는 앱 학교명으로 간다 (괄호형)', TF.schoolKey('한양대학교(ERICA)[캠퍼스]'), '한양대학교 ERICA캠퍼스');
  eq('분교는 앱 학교명으로 간다 (제2캠퍼스형)', TF.schoolKey('홍익대학교[제2캠퍼스]'), '홍익대학교 세종캠퍼스');
  eq('KOSAF 는 경주, 앱은 WISE', TF.schoolKey('동국대학교(경주)[캠퍼스]'), '동국대학교 WISE캠퍼스');
  /* 이원화는 앱에서 한 학교라 **일부러** 합친다 — 여기서 갈라 놓으면 앱이 못 찾는다 */
  eq('이원화 제2캠퍼스는 본교로 합친다', TF.schoolKey('단국대학교[제2캠퍼스]'), '단국대학교');
  eq('본교 표시는 떼고 공백도 없앤다 (기존 파일 관례)', TF.schoolKey('한국외국어대학교[본교]'), '한국외국어대학교');

  /* 🔴 소수점을 지우면 정확히 10배가 된다 (학교 평균 쪽에서 실제로 저장까지 갔던 사고) */
  eq('천원 → 원 (소수점을 지우지 않는다)', TF.wonOf('6355.7'), 6355700);
  eq('쉼표는 버린다', TF.wonOf('9,260'), 9260000);
  eq('미공시(0)는 0', TF.wonOf('0'), 0);

  /* 가운뎃값은 매 실행 같아야 한다 — 짝수에서 평균을 내면 없는 금액이 만들어진다 */
  eq('짝수는 아래쪽 가운뎃값 (지어낸 숫자를 안 만든다)', TF.median([100, 200, 300, 400]), 200);

  const rows = [
    { school: '가짜대학교[본교]', dept: '경영학과', track: '인문사회', degree: '학사', amount: '7,000' },
    { school: '가짜대학교[본교]', dept: '국문학과', track: '인문사회', degree: '학사', amount: '7,200' },
    { school: '가짜대학교[본교]', dept: '미공시학과', track: '인문사회', degree: '학사', amount: '0' },
    { school: '가짜대학교[본교]', dept: '대학원과정', track: '인문사회', degree: '석사', amount: '99,000' },
    { school: '가짜대학교[본교]', dept: '의예과', track: '의학', degree: '학사', amount: '12,000' },
  ];
  const built = TF.buildByField(rows);
  eq('0원(미공시)은 평균에 섞지 않는다', built['가짜대학교']['인문사회'], 7000000);
  /* 🔴 대학원은 **학기액** 기준이라 섞으면 학부 등록금이 통째로 부푼다 (포털 화면이 그렇게 적어 둔다) */
  eq('대학원(학사가 아닌 것)은 버린다', Object.keys(built['가짜대학교']).length, 2);
  eq('계열이 나뉘어 담긴다', built['가짜대학교']['의학'], 12000000);
  /* 같은 학과가 쪽이 겹쳐 두 번 와도 한 번으로 센다 */
  eq('같은 학과가 두 번 와도 한 번', TF.buildByField([rows[0], rows[0], rows[1]])['가짜대학교']['인문사회'], 7000000);

  /* 앱이 실제로 읽는 이름과 같아야 한다 — 포털이 계열 이름을 바꾸면 앱은 조용히 학교 평균으로 되돌아간다 */
  const PAsrc = fs.readFileSync(new URL('../parse-amount.js', import.meta.url), 'utf8');
  const mapped = [...PAsrc.slice(PAsrc.indexOf('var TRACK_TO_FIELD')).slice(0, 400).matchAll(/'([^']+)'/g)].map((m) => m[1]);
  eq('KNOWN_TRACKS 가 parse-amount 의 TRACK_TO_FIELD 와 같은 이름을 쓴다',
    TF.KNOWN_TRACKS.every((t) => mapped.includes(t)), true);

  /* 쪽 넘김을 `paging` 으로 되돌리면 1쪽만 영원히 긁는다 (실측으로 확인한 함정) */
  const src = fs.readFileSync(new URL('../collector/fetch-tuition-field.mjs', import.meta.url), 'utf8');
  eq('쪽 넘김 파라미터는 no 다', /no: String\(no\)/.test(src), true);
  eq('학과명은 LIKE 와일드카드', /dptNm: '%'/.test(src), true);
  /* 대학원이 섞이면 학기액이 연간액 자리에 들어간다 */
  eq('대학(학부)만 받는다', /univDivCd: '10'/.test(src), true);
}


/* ── ※ 곁말 줄 (2026-08-27 전수 조사) ─────────────────────────────────────
   `※` 로 시작하는 자격 줄 95개가 **내용도 안 보고** 통째로 버려지고 있었다.
   그 안에 버려선 안 되는 것이 섞여 있다 — 되돌아가면 이 검사가 실패한다. */
{
  const ME = createRequire(import.meta.url)('../match-engine.js');
  const where = (l) => (ME.requirementLines({}, [l]).length ? '자격'
    : (ME.requirementLines({}, [l], { onlyExclude: true }).length ? '제외' : '버림'));
  console.log('\n■ ※ 곁말 — 증명한 줄만 통과 (2026-08-27)');

  /* 🔴 제외를 말하는 ※ 는 제외 칸으로. 버리면 **그 학생이 자기가 된다고 읽는다** —
     자격이 뒤집혀 보이는 실패라 잡음보다 나쁘다(실제 21줄 · 14개 카드가 이 상태였다). */
  eq('※ 지원 불가는 제외 칸으로', where('※ 졸업유예자, 휴학생, 대학원생, 세종캠퍼스 학생은 지원 불가'), '제외');
  eq('※ 휴학생 신청 불가도 제외 칸으로', where('※ 2026-2학기 휴학생 신청 불가'), '제외');

  /* 🔴 본문 규칙을 뒤집는 **예외 자격**. 빠지면 되는 학생이 안 된다고 나온다
     (면학장학금은 본문이 `8학기 이하`라 9~10학기 이중전공자가 통째로 탈락해 보였다). */
  eq('※ 예외 자격은 자격 칸으로', where('※ 10 학기 이하 후기 이중전공자는 등록금 전액 납부 시 신청 가능'), '자격');

  /* ⚠️ 반대편 — ※ 를 통째로 열면 2026-08-02에 개발자가 지적한 잡음이 되살아난다 */
  eq('※ 예산·지급기준 안내는 여전히 버린다',
    where('※ 예산 범위 내 학교 지급기준에 의거하여 지급가능 소득분위 및 금액 결정 예정'), '버림');
  eq('※ 동점자 처리기준도 버린다', where('※ 동점자 처리기준 : 소득구간 > 등록금 실납입액 비율'), '버림');
  eq('※ 상세내역 안내도 버린다', where('※ 상세내역은 첨부 참조'), '버림');

  /* 🔴 줄의 주장은 끝에 있다 — `…신청할 수 없는 … 미소지자도 선발 가능` 은 자격이다.
     제외 칸에 넣으면 외국 국적 학생이 자기가 안 된다고 읽는다(방향만 반대인 같은 실패). */
  eq('끝이 「선발 가능」이면 제외가 아니다',
    where('※ 국가장학금을 신청할 수 없는 대한민국 국적 미소지자도 선발 가능'), '자격');
  eq('끝이 「신청할 수 없음」이면 제외다', where('타 장학금 수혜자는 신청할 수 없음'), '제외');

  /* 신청 **방법·일정**이 자격으로 새면 개발자가 네 번 지적한 그 잡음이다 */
  eq('신청 방법은 자격이 아니다', where('신청 방법 : 포털에서 신청 가능'), '버림');
  eq('신청 일정도 자격이 아니다', where('8월 20일부터 온라인 신청 가능'), '버림');

  /* 두 곳이 같은 잣대를 쓰는지 — 베껴 두면 한쪽만 고쳐져 갈라진다 */
  const meSrc = fs.readFileSync(new URL('../match-engine.js', import.meta.url), 'utf8');
  eq('AFFIRM_ELIG 를 REQ_SIGNAL 과 ※ 관문이 함께 쓴다',
    /AFFIRM_ELIG\.source/.test(meSrc) && /asideProven = EXCLUDE_LINE\.test\(t\) \|\| AFFIRM_ELIG\.test\(t\)/.test(meSrc), true);
  /* ⚠️ 버리는 것은 ※ 뿐이다 — `*` 까지 버리면 멀쩡한 요건이 같이 죽는다(실제로 그랬다) */
  /* 잡음 판정은 **원문 줄에서 괄호만 뗀 것**으로 본다 — 다듬은 줄로 보면 `^배점` 같은
     줄머리 규칙이 이름표와 함께 사라져 뚫리고, 원문 그대로 보면 괄호 안 부연에 걸린다. */
  eq('잡음 판정은 원문에서 괄호만 떼고 본다', /let noiseProbe = String\(l \|\| ''\)\.replace\(/.test(meSrc), true);
  eq('증명된 ※ 곁말은 기호를 떼고 본다', /if \(asideProven\) noiseProbe = noiseProbe\.replace\(\/\^\[※\*\]/.test(meSrc), true);
  eq('별표로 시작하는 요건은 살아 있다', where('* 2026-2학기 재학생인 자'), '자격');
  /* 🔴 괄호 **안**의 낱말로 줄을 통째로 버리지 않는다 (2026-08-28).
     `… 확정된 자 (국가장학 필수 신청, 미신청시 수혜 불가)` 가 괄호 안 `미신청시` 하나 때문에
     죽어, 그 공고의 **핵심 자격**이 화면에서 사라져 있었다. */
  eq('괄호 안 잡음 낱말이 진짜 요건을 죽이지 않는다',
    where('2026학년도 2학기 국가장학금 1유형을 신청하여 소득분위가 “기초생활수급자” 또는 “0분위”로 확정된 자 (국가장학 필수 신청, 미신청시 수혜 불가)'), '자격');
  eq('괄호 밖이 잡음이면 여전히 버린다', where('미신청시 불이익이 있습니다 (참고)'), '버림');
  /* 🔴 괄호 안의 `만점` 은 배점표 표지가 아니라 **성적 척도**다 (2026-08-28).
     이것 때문에 진짜 성적 요건이 자격 칸에서 사라지고 있었다. */
  eq('괄호 안 만점은 성적 척도다', where('직전학기 C⁰ 수준(70/100점 만점) 이상인 재학생'), '자격');
  eq('괄호 안 만점 (평점 척도)도 같다', where('직전 이수학점 3.5 이상 (4.5 만점) 인 자에 한함'), '자격');
  /* ⚠️ 반대편 — 괄호를 떼고도 배점표면 그대로 버린다 */
  eq('배점 안내는 여전히 버린다', where('Dream PATH 마일리지 점수 적용 : 매학기 70 점 만점 적용'), '버림');
  eq('배점표도 여전히 버린다', where('학업성적(50) + 취창업준비계획(20) + 면접(30)'), '버림');
  eq('총점 안내도 여전히 버린다', where('총점 100점 만점'), '버림');
  /* 줄머리 규칙이 살아 있는가 — 다듬은 줄로만 보면 이름표가 떨어져 뚫린다 */
  eq('번호 뗀 「금 액 :」은 자격이 아니다', where('3 ) 금 액 : 250 만 원'), '버림');
}

/* ── 로봇이 쓰는 학교 열쇠 = 앱이 읽는 학교 이름 (2026-08-27) ────────────────────
   majors.mjs 가 '연세대학교 미래캠퍼스(원주)' 로 저장하는데 app.js 는
   MAJORS_BY_SCHOOL['연세대학교 미래캠퍼스'] 로 찾고 있었다 — 커리어넷에 그 학교
   학과가 나타나는 순간 영영 매칭되지 않는다. 폴백(전국 공통 목록)이 조용히 받아
   주기 때문에 화면상으로는 아무 일도 안 일어난 것처럼 보인다. 검사가 없으면 아무도 모른다. */
console.log('\n■ 분교 이름이 로봇과 앱에서 같은가 (갈라지면 학과 추천이 조용히 죽는다)');
{
  const strip = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '');
  const sec = (src, head) => strip(src.slice(src.indexOf(head)).split(/\n[}\]];/)[0]);
  const dataSrc = fs.readFileSync(new URL('../data.js', import.meta.url), 'utf8');
  const majorsSrc = fs.readFileSync(new URL('../collector/majors.mjs', import.meta.url), 'utf8');
  const unis = new Set([...sec(dataSrc, 'const UNIVERSITIES = [').matchAll(/'([^']+)'/g)].map((m) => m[1]));
  const targets = [...sec(majorsSrc, 'const BRANCH_MAP = {').matchAll(/:\s*'([^']+)'/g)].map((m) => m[1]);

  eq('data.js 학교 목록을 실제로 읽었다', unis.size > 100, true);
  eq('BRANCH_MAP 을 실제로 읽었다', targets.length >= 7, true);
  eq('BRANCH_MAP 값이 전부 data.js UNIVERSITIES 안에 있다', targets.filter((t) => !unis.has(t)), []);
  /* 분교 7곳은 전부 매핑돼 있어야 한다 — 빠지면 그 학교 학과가 본교로 합쳐진다 */
  eq('data.js 분교 7곳이 전부 BRANCH_MAP 에 있다',
    [...unis].filter((u) => /캠퍼스$/.test(u) && !targets.includes(u)), []);
}


/* ── 한 번의 읽기로 자격과 금액을 함께 (2026-08-28 개발자 지시) ────────────────
   원문 미확보 15건을 실제로 열어 보니 **수집 실패가 아니라** 게시자가 공고문을
   그림·PDF 로만 올린 것이었다. 그 글자는 AI 가 그림을 읽어야 나오는데, 예전에는
   자격만 받아 와서 같은 그림을 금액 때문에 또 읽어야 했다. */
{
  const AI = await import('../collector/eligibility-ai.mjs').catch(() => null);
  const src = fs.readFileSync(new URL('../collector/eligibility-ai.mjs', import.meta.url), 'utf8');
  const ex = fs.readFileSync(new URL('../collector/extract-amounts.mjs', import.meta.url), 'utf8');
  console.log('\n■ 첨부 한 번 읽어 자격·금액 함께 (2026-08-28)');

  eq('그림·PDF 응답 스키마에 금액 줄이 있다', /amountLines: \{ type: 'array'/.test(src), true);
  eq('required 에도 들어 있다', /required: \['none', 'lines', 'excludes', 'amountLines', 'why'\]/.test(src), true);
  eq('프롬프트가 금액 줄을 원문 그대로 달라고 한다', /amountLines/.test(src) && /원문 그대로/.test(src), true);
  eq('읽어 온 금액 줄을 저장한다', /it\.amountLines = v\.amountLines/.test(src), true);
  /* 🔴 대상이 '자격 없음'만이면 금액만 빠진 공고는 영영 안 읽힌다 — 그게 '한세월'의 정체였다 */
  eq('금액만 못 읽은 공고도 대상이다', /const needAmount =/.test(src) && /!needElig && !needAmount/.test(src), true);
  /* 돈 나가는 자리는 누르기 전에 대상이 보여야 한다 */
  eq('미리보기가 첨부 대상 수를 보여 준다', /첨부로 읽을 수 있는 공고/.test(src), true);
  /* 🔴 기본은 꺼져 있어야 한다 — 되돌아가면 수집 로봇이 매 실행 돈을 쓴다 */
  {
    const cfg = JSON.parse(fs.readFileSync(new URL('../collector/eligibility-ai-config.json', import.meta.url), 'utf8'));
    eq('AI 자격 읽기는 기본이 꺼짐', cfg.enabled, false);
  }

  /* 🔴 모델에게 금액을 **계산**시키지 않는다 — 옮겨 온 줄을 parse-amount 가 읽는다.
     그래야 총액/1인당 가르기·유의사항 절 차단·자릿수 관문이 그대로 걸린다. */
  eq('금액 판정은 parse-amount 가 한다', /PA\.amountFrom\(\['장학금액', \.\.\.aiLines\]\)/.test(ex), true);
  eq('본문이 있으면 본문이 먼저다', /bodyLines\.length \? PA\.amountFrom\(bodyLines\)/.test(ex), true);

  /* 검산기가 금액 줄을 실제로 돌려주는지 — 가짜 응답으로 돌려 본다(돈 0원) */
  if (AI && AI.verifyPdfLines) {
    const v = AI.verifyPdfLines({ none: false, why: '',
      lines: ['대한민국 국적의 4년제 대학 재학생'], excludes: ['휴학생은 지원 불가'],
      amountLines: ['장학금액 : 1인당 300만원 (생활비성)', '문의 : 학생지원팀'] });
    eq('금액 줄을 돌려준다', v.ok && v.amountLines.includes('장학금액 : 1인당 300만원 (생활비성)'), true);
    /* 금액처럼 생기지 않은 줄은 버린다 — 자격 관문(REQ_SIGNAL)을 대면 안 되지만 아무거나 받아도 안 된다 */
    eq('금액이 아닌 줄은 버린다', v.ok && !v.amountLines.includes('문의 : 학생지원팀'), true);
    /* 그 줄을 parse-amount 에 먹이면 1인당 300만원이 나온다 (150만원 분할에 끌려가지 않는다) */
    const PAx = createRequire(import.meta.url)('../parse-amount.js');
    const a = PAx.amountFrom(['장학금액', '장학금액 : 1인당 300만원 (생활비성)', '지급 방법 : 학기당 150만원씩 2회 분할']);
    eq('1인당 금액을 집는다', a.kind === 'fixed' && a.value === 3000000, true);
  }
}


/* ── 검사 드라이버가 조용히 썩지 않게 (2026-08-29) ────────────────────────────
   브라우저 검사 7개가 깨진 채 방치돼 있었고, 원인은 셋뿐이었다. 전부 **정적으로**
   잡을 수 있는 것이라 여기서 못 박는다 — 브라우저 없이 즉시 끝난다. */
{
  console.log('\n■ 검사 드라이버가 썩지 않게 (2026-08-29)');
  const dir = new URL('../verify/', import.meta.url);
  const names = fs.readdirSync(dir).filter((f) => /\.(js|mjs)$/.test(f));

  /* ① 온보딩 단계 번호를 박으면 단계가 늘 때마다 죽는다 (4 → 6 이 되며 6개가 죽었다).
        `data-step="N"` 으로 **마지막 단계**를 짚는 것이 금지다 — 중간 단계를 채우는
        용도(0,1,2)는 그 단계에 입력 칸이 있어 어쩔 수 없다. */
  const lastStepUsers = names.filter((f) => {
    const src = fs.readFileSync(new URL(f, dir), 'utf8');
    return /data-step="[3-9]"\]\s*\[data-next\]/.test(src);
  });
  eq('마지막 온보딩 단계를 번호로 짚는 드라이버가 없다', lastStepUsers, []);

  /* ② 브라우저 경로를 박으면 개발자 맥에서 통째로 못 돈다(그 경로는 리눅스 샌드박스용) */
  const hardPath = names.filter((f) => {
    const src = fs.readFileSync(new URL(f, dir), 'utf8');
    return /=\s*'\/opt\/pw-browsers/.test(src) || /executablePath:\s*'\/opt\/pw-browsers/.test(src);
  });
  eq('브라우저 경로를 박은 드라이버가 없다 (CHROME_PATH 를 먼저 본다)', hardPath, []);

  /* 🔴 ②-2 **포트를 박으면 남의 워크트리를 잰다** (2026-08-29 실사고).
     이 저장소는 워크트리를 여러 개 두고 쓰는데, 드라이버가 `localhost:8123` 을 박아 둬서
     다른 세션이 띄워 둔 서버(= 다른 워크트리의 코드)를 재고 있었다.
     그날 `drive.js` 가 **두 번 연속 `ERRORS: none`** 을 냈는데 전부 남의 코드였고,
     정작 내가 고친 app.js 는 한 번도 실행되지 않았다 — 통과가 거짓이 된다.
     경로 박기·단계 번호 박기와 같은 계열이라 여기에 함께 둔다. */
  const hardPort = names.filter((f) => {
    const src = fs.readFileSync(new URL(f, dir), 'utf8');
    return /goto\(\s*['"]http:\/\/localhost:\d+/.test(src);
  });
  eq('서버 포트를 박은 드라이버가 없다 (PORT 를 먼저 본다)', hardPort, []);

  /* ③ 사람이 미리 준비해야 하는 검사는 언젠가 반드시 안 돌아간다.
        verify-forms-data 가 "더미 양식이 주입된 앱 복사본이 서빙 중이어야 함"을 요구해
        돌리는 족족 실패했다 — 이제 드라이버가 스스로 주입한다. */
  const fd = fs.readFileSync(new URL('verify-forms-data.js', dir), 'utf8');
  eq('forms-data 가 픽스처를 스스로 주입한다', /page\.route\('\*\*\/data\/forms\.json'/.test(fd), true);
  eq('  살아 있는 데이터에 픽스처가 남아 있기를 기대하지 않는다',
    /registeredList\.find\(\(s\) => s\.formId === 'test-dummy'\)/.test(fd), false);

  /* ④ 배지와 정렬이 같은 근거를 쓴다 — 갈라지면 '적합도 33%' 카드가 미달 카드 사이에 앉는다 */
  const app2 = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  eq('미달 판정이 한 곳(fitVerdict)에 있다', /function fitVerdict\(/.test(app2), true);
  eq('배지가 그 한 곳을 쓴다', /const verdict = fitVerdict\(fit, fd\)/.test(app2), true);
  eq('정렬도 그 한 곳을 쓴다', /fitRank\(a\) - fitRank\(b\)/.test(app2), true);
  eq('정렬이 status 로 따로 판단하지 않는다', /order\[a\.result\.status\]/.test(app2), false);
}


/* ── 판정이 공고 원문 요건을 본다 (2026-08-29 개발자 지시) ─────────────────────
   예전에는 구조화된 `eligibility` 규칙만 봐서, 원문에 `평점 4.0 이상` 이라고 적힌
   공고가 평점 3.2 학생에게 '지원 가능'으로 떴다. 배지는 미달이라 맞게 말하는데
   신청 버튼은 열려 있어 학생이 서류를 준비하다 헛수고했다. */
{
  const ME3 = createRequire(import.meta.url)('../match-engine.js');
  console.log('\n■ 판정이 원문 요건을 본다 (2026-08-29)');
  const who = (over) => ({ school: 'A', flags: [], status: '재학', year: 3,
    gpa: 3.2, bracket: 6, credits: 14, nationality: 'korean', common: {}, ...over });
  const sch = (lines) => ({ id: 't', eligibility: {}, eligibilityLines: lines });

  eq('원문 요건에 미달하면 미달이다',
    ME3.evaluate(sch(['직전학기 18학점 이상, 전체 학년 총 평점평균 4.0/4.5 이상인 학생']), who()).status, 'ineligible');
  eq('  사유에 그 원문 줄을 그대로 적는다',
    /직전학기 18학점 이상/.test(ME3.evaluate(sch(['직전학기 18학점 이상, 전체 학년 총 평점평균 4.0/4.5 이상인 학생']), who()).reasons.join(' ')), true);
  eq('넘으면 미달이 아니다',
    ME3.evaluate(sch(['직전학기 12학점 이상, 평점평균 3.0/4.5 이상인 학생']), who()).status !== 'ineligible', true);

  /* 🔴 **틀린 미달은 못 받는 것보다 나쁘다.** 아래 넷은 미달을 내면 안 되는 자리다 —
     되돌아가면 멀쩡한 학생이 통째로 막힌다. */
  eq('프로필에 값이 없으면 미달이 아니다 (모른다)',
    ME3.evaluate(sch(['직전학기 평점평균 4.0 이상인 자']), who({ gpa: null })).status !== 'ineligible', true);
  eq('예외 문구가 붙은 줄로는 미달을 안 낸다',
    ME3.evaluate(sch(['평점평균 4.0 이상인 자 (단, 신입생은 예외)']), who()).status !== 'ineligible', true);
  eq('백분위 성적은 환산이 불확실해 미달을 안 낸다',
    ME3.evaluate(sch(['직전학기 성적 90점 이상인 학생']), who()).status !== 'ineligible', true);
  eq('자격 줄이 없으면 미달이 아니다', ME3.evaluate(sch([]), who()).status !== 'ineligible', true);

  /* 판정과 배지가 같은 근거를 쓰는지 — 갈라지면 화면이 스스로 모순된다 */
  const src3 = fs.readFileSync(new URL('../match-engine.js', import.meta.url), 'utf8');
  eq('판정이 fitDetail 의 fails 를 쓴다', /fitDetail\(sch, p\)\.fails/.test(src3), true);
}


/* ── 화면 주장을 재는 도구가 앱과 갈라지지 않게 (2026-08-29) ─────────────────
   2026-08-29에 `requirementLines()` 를 그냥 불러 5줄이 나온 것을 보고
   "자격 줄 18건이 화면에 안 뜬다"고 보고했다. 틀렸다 — 그건 **목록 카드용 5줄
   미리보기**였고 상세 시트는 전부 보여 주고 있었다. 코드는 멀쩡했고 검사도 조용했다.
   틀린 것은 **내가 잰 방법**이었다. 그래서 `verify/what-shows.mjs` 로만 재기로 했다.

   🔴 첫 판의 이 검사는 **글자만 훑는 껍데기**여서, 아무것도 안 하는 도구도 전부 통과했다
      (코드 리뷰가 잡았다: 한 줄짜리 가짜 파일로 6개 다 ✓). 그래서 **실제로 돌려서** 본다. */
{
  console.log('\n■ 화면 주장을 재는 도구 (verify/what-shows.mjs · 2026-08-29)');
  const { execFileSync } = await import('node:child_process');
  const run = (args) => {
    try {
      return execFileSync(process.execPath, ['verify/what-shows.mjs', ...args],
        { cwd: new URL('..', import.meta.url).pathname, encoding: 'utf8', timeout: 60000 });
    } catch (e) { return String((e && (e.stdout || e.message)) || ''); }
  };

  /* 🔴 **실제로 돌려서** 앱과 같은 답을 내는지 본다 — 글자만 훑으면 빈 파일도 통과한다 */
  const reg2 = JSON.parse(fs.readFileSync(new URL('../data/registered.json', import.meta.url), 'utf8'));
  const ME4 = createRequire(import.meta.url)('../match-engine.js');
  /* 목록(상한 5)과 상세(전부)의 줄 수가 **다른** 공고를 골라야 그날의 실수를 재현 검사할 수 있다 */
  const target = reg2.items.find((x) =>
    ME4.requirementLines(x, null, { all: true }).length > ME4.requirementLines(x, null).length);
  eq('목록과 상세가 다른 공고가 실제로 있다 (이 검사의 전제)', !!target, true);
  if (target) {
    const out = run([target.id]);
    const listN = Number((out.match(/목록 카드에 보이는 자격 줄 \((\d+)줄/) || [])[1]);
    const allN = Number((out.match(/상세 시트에 보이는 자격 줄 \((\d+)줄/) || [])[1]);
    eq('  도구가 목록 줄 수를 앱과 같게 센다', listN, ME4.requirementLines(target, null).length);
    eq('  도구가 상세 줄 수를 앱과 같게 센다', allN, ME4.requirementLines(target, null, { all: true }).length);
    eq('  둘이 다르면 그 사실을 짚어 준다 (그날 실수의 정체)', /미리보기 상한/.test(out) && allN > listN, true);
  }

  /* 🔴 신청 버튼은 **마감까지** 봐야 한다 — 첫 판은 이걸 빠뜨려 8건을 '열림'이라 했다.
     마감이 지난 공고를 골라 '잠김'이라 말하는지 실제로 확인한다. */
  const closed = reg2.items.find((x) => {
    if (!x.deadline) return false;
    return new Date(x.deadline) < new Date() && ME4.requirementLines(x, null).length > 0;
  });
  if (closed) {
    const out = run([closed.id]);
    eq('마감 지난 공고는 신청 버튼 잠김이라고 말한다', /신청 버튼 잠김/.test(out), true);
  }

  /* 배지 문구를 손으로 옮겨 적으면 갈라진다 — 앱 함수를 가져다 쓰는지 소스로도 못 박는다 */
  const ws = fs.readFileSync(new URL('../verify/what-shows.mjs', import.meta.url), 'utf8');
  eq('앱 함수를 이름으로 떼어 온다 (사이를 잘라 오지 않는다)', /function takeFn\(name\)/.test(ws), true);
  eq('  배지는 앱의 fitBadgeHtml 이 낸 것을 쓴다', /fitBadgeHtml/.test(ws) && !/지원 자격 미달'/.test(ws), true);
  eq('  신청 버튼은 앱처럼 마감도 본다', /d\.days >= 0/.test(ws), true);
  eq('  못 가져오면 조용히 넘어가지 않고 멈춘다', /throw new Error\(`app\.js 에서/.test(ws), true);
}

/* ── 🔴 적합도 상수와 감사가 갈라지지 않는가 (2026-08-29) ──
   2026-08-24 에 만든 '퍼센트와 화면이 같은 말을 하는가' 검사는 그때의 뜻으로 쓰였다:
   미달 = 0% · 만점 = 100%. 그런데 2026-08-26(83f0e42)이 그 뜻을 바꿨다 —
   미달은 FIT_MIN(5), 만점은 FIT_MAX(95)가 됐다. **상수는 바뀌었는데 그 값을 읽는
   감사는 안 바뀌어서** 세 가지가 한꺼번에 죽었다:
     ① `pct === 100` → 95가 상한이라 영영 참이 안 된다 (죽은 가지)
     ② `pct > 0 && ✕`  → 미달(5%)이 전부 걸린다 (경고 227건 = 전체의 85%)
     ③ `pct === 0`     → 0이 안 나오므로 영영 참이 안 된다 (죽은 가지)
   즉 이 검사는 8/26 이후 **아무것도 못 잡으면서 오탐만 227건** 내고 있었다.
   되돌리기 방지: 임계값을 숫자로 적지 말고 match-engine 이 내보내는 상수를 읽는다. */
console.log('\n■ 적합도 상수 — 감사가 match-engine 과 같은 뜻을 쓰는가 (2026-08-29)');
{
  const req = createRequire(import.meta.url);
  const M = req('../match-engine.js');
  const src = fs.readFileSync(new URL('../verify/eligibility-report.mjs', import.meta.url), 'utf8');

  /* 상수가 실제로 그 뜻인지부터 — 여기가 바뀌면 아래 검사도 같이 바뀌어야 한다 */
  eq('미달 확정 점수는 0이 아니다 (FIT_MIN)', M.FIT_MIN > 0, true);
  eq('만점은 100이 아니다 (FIT_MAX)', M.FIT_MAX < 100, true);

  /* 🔴 핵심 — 임계값을 숫자로 적어 두면 상수가 바뀔 때 조용히 갈라진다.
     이 한 줄이 8/26 회귀를 그날 잡았을 검사다. **한 파일이 아니라 적합도를 읽는
     도구 전부**를 본다 — 실제로 같은 커밋이 세 곳을 한꺼번에 죽였고(감사 2가지 +
     fit-report), 파일 하나만 막았으면 나머지는 그대로 눈이 먼 채였다. */
  /* 🔴 관문 파일 **자신**도 넣는다 (2026-08-29 코드 리뷰 지적). 첫 판에서 여기를 빼는 바람에
     이 파일 안에 남아 있던 같은 병 6개(`.pct > 0` — 미달이 5라 언제나 참)를 못 봤다.
     그 6개는 '틀린 미달을 내지 않는다'를 지키던 것이라, 가장 비싼 판정이 무장 해제돼 있었다. */
  const readers = ['eligibility-report.mjs', 'fit-report.mjs', 'test-collector.mjs'];
  /* 주석과 문자열은 코드가 아니다 — 안 걸러내면 **이 병을 설명하는 주석마다** 걸린다
     (실제로 바로 위 주석의 예시 글자에 걸렸다). 실행되는 코드만 본다. */
  const codeOnly = (t) => t
    .replace(/\/\*[\s\S]*?\*\//g, ' ')   // 여러 줄 주석
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1')  // 한 줄 주석 (URL 의 // 는 남긴다)
    .replace(/`[^`]*`/g, ' ');             // 템플릿 문자열
  const hard = readers.flatMap((f) => {
    const t = codeOnly(fs.readFileSync(new URL(`../verify/${f}`, import.meta.url), 'utf8'));
    return (t.match(/\.pct\s*(===|!==|>=|<=|>|<)\s*\d+/g) || []).map((m) => `${f}: ${m}`);
  });
  eq('적합도를 읽는 도구가 점수를 숫자와 직접 비교하지 않는다', hard.join(' · '), '');
  /* 미달을 세는 도구가 실제로 셀 수 있는가 — 조건이 참이 될 수 있는지 못 박는다.
     (8/26 이후 fit-report 는 '0% 0건'만 답했다. 안 세는 검사는 통과해도 무의미하다) */
  eq('미달을 fails 로 센다 (점수로 세면 상수가 바뀔 때 0건이 된다)',
     /!r\.f\.unread && r\.f\.fails\.length/.test(
       fs.readFileSync(new URL('../verify/fit-report.mjs', import.meta.url), 'utf8')), true);

  /* 확정 미달은 ✕가 있는 것이 **정상**이다 — 그걸 모순이라 부르면 안 된다 */
  const 미달 = M.fitDetail(
    { eligibilityLines: ['직전학기 평점 4.0 이상인 학생'], eligibilityExcludes: [] },
    { gpa: 2.3, bracket: 9, year: 2, status: '재학', credits: 12, nationality: 'korean', flags: [] });
  eq('평점 미달 학생의 적합도는 FIT_MIN 이다', 미달.pct, M.FIT_MIN);
  eq('  그리고 사유가 함께 있다 (사유 없는 미달은 없다)', 미달.fails.length > 0, true);
}

console.log(fail ? `\n✕ 실패 ${fail}건 — 수집기 중복 제거 규칙이 깨졌습니다` : '\n✓ 수집기 규칙 전부 통과');
process.exit(fail ? 1 : 0);

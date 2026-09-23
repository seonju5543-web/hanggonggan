/* 수집기 규칙 자체 테스트 — 인터넷 없이 즉시 끝난다. 수집 워크플로가 매 실행마다 돌린다.
   목적: 2026-07-30에 고친 '같은 공고를 다시 담지 않는 규칙'이 나중에 조용히 되돌아가지 않게 한다.
   (그때는 시립대 피드 40건 중 실제 공고가 13건뿐이었고, 중복이 학교당 상한을 채워
    진짜 새 공고를 밀어냈다. 사람이 눈으로 보기 전에는 아무도 몰랐다.)

   실행: node verify/test-collector.mjs   (실패하면 exit 1) */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
/* 관리자 수정 전후 대조 규칙 — 화면·저장소 공용 원본 (2026-09-14) */
import { diffPatch } from '../tools/edit-diff.mjs';

/* 🔴 파일은 **줄바꿈을 통일해서** 읽는다 (2026-09-06).
   윈도우에서는 git 의 core.autocrlf 가 체크아웃 때 줄바꿈을 CRLF 로 바꿔 준다(정상 설정이고,
   올릴 때 LF 로 되돌리므로 저장소는 안 더러워진다). 그런데 검사가 `\n}\n` 같은 LF 를 글자 그대로
   찾고 있어서, **개발자 컴퓨터에서만 4건이 늘 빨간불**이었다. 로봇은 리눅스라 통과한다.
   늘 켜져 있는 빨간불은 신호가 아니다 — 진짜 실패가 5건째로 섞여도 눈에 안 띈다.
   같은 계열의 수리: 2026-09-05 `검사 5건이 개발자 컴퓨터에서만 실패하고 있었다`(URL.pathname).
   🔴 파일이나 core.autocrlf 를 건드리지 말 것 — 저장소 전 파일이 '바뀐 것'으로 보여 통째로 충돌한다.
      고칠 곳은 **읽는 쪽**이고, 그 자리는 여기 하나다. */
const readText = (u) => fs.readFileSync(u, 'utf8').replace(/\r\n/g, '\n');
// 하트비트 순수 함수 — 예약 간격 계산은 한 곳에만 둔다 (2026-09-06)
import { hoursFor, cronsOf, isStale, countField, runsPerWeek, everyWords } from '../collector/robot-heartbeat.mjs';
/* 🔴 URL 을 파일 경로로 쓸 때는 .pathname 이 아니라 fileURLToPath 다.
   윈도우에서 .pathname 은 `/C:/…` 를 주는데 그건 유효한 경로가 아니라 파일을 못 열고
   자식 프로세스도 못 띄운다. 리눅스(클라우드 검사)에서는 멀쩡해서 **이 검사 5개가
   개발자 컴퓨터에서만 조용히 실패하고 있었다** — 진짜 실패를 가리는 소음이었다(2026-09-05). */
import { fileURLToPath } from 'node:url';
import { urlKey, titleKey, dedupeNotices, preferNotice, capNotices, clickRowKey } from '../collector/url-key.mjs';
/* extract-excerpts 는 **불러오면 그 자리에서 실행된다** — EXCERPTS_AS_LIB 가 그걸 막는 스위치다
   (이 저장소의 알려진 함정: `node -e "import('./x.mjs')"` 로 문법 검사를 하면 안 되는 이유와 같다). */
process.env.EXCERPTS_AS_LIB = '1';
const AWAIT_EE = await import('../collector/extract-excerpts.mjs');
import { mergeCandidates } from '../collector/candidates.mjs';
import { publishBySchool, splitBySchool } from '../collector/publish-notices.mjs';
import { pageCandidates, pageUrl, existingPageParam, samePage, shouldRetry } from '../collector/paginate.mjs';
import { looseCandidate, sameNotice, findMissing, classifyMiss, coverageOf, looksLikeBoardChrome, looksLikeAttachmentName, dedupeNear } from '../collector/coverage-rules.mjs';
import { createRequire } from 'node:module';
import { isAttachmentEntry, isHtmlPayload } from '../collector/attachment-link.mjs';
import { isDetailUrl, isMarkerUrl, markerTitle, sameTitle, titleCore, rowByCore, detailCandidates, looksLikeLoginWall, rowDetailCandidates } from '../collector/detail-url.mjs';
import { cleanTitle, isMenuEntry } from '../collector/clean-title.mjs';
import { makeBudget, rotateOrder, nextCursor, withDeadline, TIMED_OUT } from '../collector/harvest-budget.mjs';
import { canonUrl } from '../collector/canon-url.mjs';
import { checkFormQuality } from '../collector/form-quality.mjs';
import { checkFormCoverage } from '../collector/form-coverage.mjs';
import { canonUrl as nsCanonUrl, hasText, looksLikeErrorPage } from '../collector/notice-source.mjs';
/* 층2 첨부 — KOSAF 포털과 말하는 규칙은 kosaf-session.mjs 한 곳이다(베끼면 갈라진다) */
import { parseFiles, filenameFrom, nameFromUrl, safeFileName, looksLikeHtml, sniffKind } from '../collector/kosaf-session.mjs';
import { slimKosaf, blockKey } from '../collector/kosaf-open.mjs';
/* 층2 빈 껍데기 — '비었나'의 판정은 collector/kosaf-empty.mjs 한 곳이다 */
import { emptyVerdict, emptyShells, charsOfText, MIN_BODY_CHARS } from '../collector/kosaf-empty.mjs';

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
  const ar = readText(new URL('../collector/auto-register.mjs', import.meta.url));
  eq('되돌리기가 id뿐 아니라 주소로도 막는다', /blockedUrls/.test(ar) && /cfg\.blockUrls/.test(ar), true);
  /* 🔴 조건만 본다 — 줄 전체를 대조하면 뒤에 집계 한 줄을 더하는 것만으로 빨간불이 된다
     (2026-09-19에 실제로 그랬다). 지켜야 하는 것은 '막힌 id·주소면 등록하지 않는다' 하나다. */
  eq('새로 등록할 때도 막힌 주소는 건너뛴다',
    /if \(blockedIds\.has\(id\) \|\| blockedUrls\.has\(cu\)\)[^\n]*continue;/.test(ar), true);
  const cfg = JSON.parse(readText(new URL('../collector/auto-register-config.json', import.meta.url)));
  eq('막은 목록이 주소로도 채워져 있다', (cfg.blockUrls || []).length > 0, true);
}

console.log('■ HWP 원본은 미리보기가 아니라 본문을 읽는다 (2026-08-14 — 앞 1023자만 보고 있었다)');
/* 한글의 `PrvText`는 **미리보기용**이라 1023자에서 잘린다(저장분 91개 중 56개가 그 상태였다).
   그래서 변환기는 신청서 뒷부분 항목의 **존재 자체를 몰랐다** — 인하대 변호산 건의
   "졸업 후 총동창회 가입 동의(필수)"가 그렇게 사라졌다. 본문(BodyText)을 읽자 같은 91개에서
   글자가 24만 자 늘었다. 아래 두 줄이 그 배선을 지킨다. */
{
  const sch = readText(new URL('../collector/schematize-forms.mjs', import.meta.url));
  eq('본문(.body.txt)을 미리보기(.txt)보다 먼저 본다',
    /\['\.body\.txt',\s*'\.txt'\]/.test(sch), true);
  /* ⚠️ 2026-09-12: 한국장학재단 로봇을 여기 넣는 것을 처음에 빠뜨렸다 — 그래서 받아 둔
     공고문 HWP 를 **미리보기 1023자만** 읽고 있었다. 첨부를 받는 로봇이 새로 생기면
     이 목록에도 넣어야 한다(안 넣으면 그 로봇만 조용히 앞 1000자만 본다). */
  /* ⚠️ 2026-09-15: eligibility-fill 도 빠져 있었다 — `deepfetch --elig-attach` 가 파생 .txt 를
     지우고 원본만 다시 놓는데 글자를 뽑는 단계가 없어, 울산연구원 HWP 본문 20KB 를 지운 채
     커밋했다(실측). **`--elig-attach` 를 부르는 워크플로는 이 목록에서 자동으로 찾는다** —
     이름을 손으로 적으면 다음 로봇도 또 빠진다. */
  const wfDir = new URL('../.github/workflows/', import.meta.url);
  const fetchers = fs.readdirSync(wfDir).filter((f) => f.endsWith('.yml'))
    .filter((f) => /deepfetch\.mjs --elig-attach/.test(readText(new URL(f, wfDir))));
  eq('  --elig-attach 를 부르는 워크플로를 찾는다 (eligibility-fill 포함)',
    fetchers.includes('eligibility-fill.yml'), true);
  const wf = [...new Set(['collect-scholarships', 'browser-collect', 'deep-fetch', 'kosaf-fetch']
    .map((n) => `${n}.yml`).concat(fetchers))]
    .map((n) => [n, readText(new URL(n, wfDir))]);
  eq('첨부를 받는 로봇이 전부 본문 추출기를 실제로 돌린다',
    wf.filter(([, y]) => !y.includes('hwp-bodytext.py')).map(([n]) => n), []);
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
  /* 기본 임포트(`import ASK from '...'`)도 선언이다 — 2026-09-05 에 이걸 못 읽어
     멀쩡한 임포트를 '선언 없는 이름'이라고 잡았다. 검사가 틀리면 다음 사람이 검사를 끈다. */
  for (const m of code.matchAll(/import\s+([A-Z][A-Z0-9_]{2,})\s*(?:,\s*\{[^}]*\}\s*)?from\b/g)) declared.add(m[1]);
  for (const m of code.matchAll(/import\s*\*\s*as\s+([A-Z][A-Z0-9_]{2,})\b/g)) declared.add(m[1]);
  const bad = new Set();
  for (const m of code.matchAll(/\b([A-Z][A-Z0-9_]{2,})\b/g)) if (!declared.has(m[1])) bad.add(m[1]);
  return [...bad];
}
{
  const dir = new URL('../collector/', import.meta.url);
  for (const f of fs.readdirSync(dir).filter((n) => n.endsWith('.mjs')).sort()) {
    eq(`${f} — 선언 없는 이름 없음`, undeclaredNames(readText(new URL(f, dir))), []);
  }
  // 이 검사가 실제로 그 사고를 잡는지 스스로 확인한다 (검사가 잠들면 없느니만 못하다)
  eq('검사가 실제로 그 사고를 잡는다',
    undeclaredNames('const A = 1;\nconsole.log(`값 ${A}/${GIVE_UP_AFTER}회`);'), ['GIVE_UP_AFTER']);
  eq('  기본 임포트는 선언으로 읽는다 (잘못된 빨간불 방지)',
    undeclaredNames("import ASK from './x.js';\nconsole.log(ASK.p);"), []);
  eq('  그래도 안 들여온 이름은 잡는다',
    undeclaredNames("import ASK from './x.js';\nconsole.log(NOPE);"), ['NOPE']);
}

/* 🔴 PDF 글자 뽑기 (2026-09-05) — 이 단계는 **조용히 아무 일도 안 하기 쉬운** 꼴이다.
   `pdftotext` 가 없으면 스크립트는 알리고 그냥 끝난다(실행을 죽이지 않는 것이 맞다).
   그래서 워크플로가 poppler 를 설치하는 것을 잊으면 **매번 0개를 뽑고 초록불**이 된다 —
   이 저장소가 여러 번 겪은 '못 읽어서 안 터진 것을 잘 된 것으로 읽기' 유형이다. */
{
  const wf = fs.readdirSync(new URL('../.github/workflows/', import.meta.url))
    .filter((f) => f.endsWith('.yml'))
    .map((f) => [f, readText(new URL('../.github/workflows/' + f, import.meta.url))])
    .filter(([, t]) => /pdf-text\.py/.test(t));
  eq('PDF 글자 뽑기를 부르는 워크플로가 있다', wf.length > 0, true);
  for (const [name, text] of wf) {
    eq(`  ${name} 가 poppler-utils 를 설치한다 (안 하면 조용히 0개)`, /poppler-utils/.test(text), true);
    eq(`  ${name} 가 설치 실패를 삼키지 않는다 (|| true 로 덮으면 0개인 채 초록불)`,
      /poppler-utils\s*\|\|\s*true/.test(text), false);
  }
  /* 🔴 없으면 readFileSync 가 던져 **이 아래 모든 검사 절이 통째로 안 돈다.**
     파일이 빠진 것도 결함이므로, 죽지 말고 그 사실을 실패로 알린다. */
  const pyUrl = new URL('../collector/pdf-text.py', import.meta.url);
  const hasPy = fs.existsSync(pyUrl);
  eq('  collector/pdf-text.py 가 저장소에 있다 (워크플로가 부른다)', hasPy, true);
  const py = hasPy ? readText(pyUrl) : '';
  eq('  확장자가 아니라 앞 4바이트로 PDF 를 가른다 (.bin 으로 떨어진 PDF 13개가 실제로 있었다)',
    /%PDF/.test(py) && /read\(4\)/.test(py), true);
  eq('  글자가 거의 없으면 빈 .txt 를 남기지 않는다 (다음 실행이 뽑은 줄 알고 건너뛴다)',
    /MIN_CHARS/.test(py) && /len\(text\)\s*<\s*MIN_CHARS/.test(py), true);
  eq('  이미 뽑은 것은 다시 안 뽑는다 (원본이 더 새것일 때만)', /getmtime/.test(py), true);
}

/* 🔴 재단 서버가 한 번 안 받아 주면 실행 전체가 죽는다 (2026-09-01 이슈 #227).
   `ConnectTimeoutError` 하나에 34초 만에 끝나 그날 층2 갱신이 통째로 사라졌다.
   재시도를 붙였으니, 다음 사람이 무심코 맨 `fetch` 를 다시 쓰는 것을 여기서 막는다.
   (학교 게시판 수집은 2026-07-30 시립대 유실로 이미 같은 것을 배웠다.) */
/* ⚠️ 2026-09-12에 포털과 말하는 규칙이 `kosaf-session.mjs` 한 곳으로 모였다(로봇 셋이
   같은 파일을 쓴다). 검사의 **뜻은 그대로 두고 자리만** 옮긴다 — 옛 파일을 재던 것을
   그냥 지우면 재시도가 사라져도 아무도 모른다. */
{
  const sess = readText(new URL('../collector/kosaf-session.mjs', import.meta.url));
  const bare = [...sess.matchAll(/await\s+fetch\(/g)].length;
  eq('한국장학재단 수확이 맨 fetch 를 쓰지 않는다 (재시도를 거친다)', bare, 1);  // tryFetch 안의 1회뿐
  eq('  재시도 함수가 있다', /export async function tryFetch\(/.test(sess), true);
  eq('  넘어지면 성공으로 위장하지 않는다 (끝내 못 받으면 던진다)', /\n\s*throw last;/.test(sess), true);
  /* 로봇들은 세션을 거쳐야 한다 — 자기 자리에서 fetch 를 부르면 재시도도 쿠키도 리퍼러도 없다 */
  for (const f of ['kosaf-fetch.mjs', 'kosaf-attach.mjs']) {
    const src = readText(new URL(`../collector/${f}`, import.meta.url));
    eq(`  ${f} 는 포털을 직접 부르지 않는다`, /await\s+fetch\(/.test(src), false);
  }
}

/* 재시도 대기에 page.waitForTimeout을 쓰면 안 된다 (2026-08-02 이슈 #89).
   페이지가 닫혀서 goto가 실패한 경우 그 대기가 스스로 예외를 던져 **진짜 실패 원인을
   덮어쓰고 남은 재시도까지 건너뛴다.** 서울대·가천대·외대·상명대가 이 경로로 죽고 있었다.
   goto 성공 뒤의 '화면 그려질 때까지 대기'는 페이지가 살아 있으므로 정상 — catch 안만 본다. */
{
  const src = readText(new URL('../collector/browser-collect.mjs', import.meta.url));
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
    const src = readText(new URL(robot, root));
    const yml = readText(new URL(flow, root));
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
    const yml = readText(new URL(`.github/workflows/${f}.yml`, root))
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
  const src = readText(new URL('../collector/browser-collect.mjs', import.meta.url));
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
  const src = readText(new URL('collector/browser-collect.mjs', new URL('../', import.meta.url)));
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

  const src = readText(new URL('collector/audit-coverage.mjs', root));
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
    const k = (readText(new URL(f, root)).match(/KEYWORDS = (\/[^\n]+\/);/) || [])[1];
    eq(`감사의 수집기 그물 사본이 ${f}와 같다`, audited === k, true);
  }
  const yml = readText(new URL('.github/workflows/audit-coverage.yml', root));
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
    const src = readText(new URL(f, root));
    eq(`${f}가 2페이지 이후도 읽는다`, /readMorePages\(/.test(src), true);
    // 알아낸 것을 저장하지 않으면 매 실행 처음부터 헤맨다 (이슈 #79와 같은 유형)
    eq(`${f}가 알아낸 방식을 저장한다`, /pagination\.json/.test(src) && /writeFileSync\(pagePath/.test(src), true);
  }
  /* 브라우저 로봇에서는 '덤'이다 — 예산이 모자라면 손대지 않아야 한다.
     2026-08-16에 덤으로 붙는 재시도가 멈춰 그날 수집분 전체를 잃은 것과 같은 계열. */
  const bsrc = readText(new URL('collector/browser-collect.mjs', root));
  eq('브라우저 로봇은 예산이 모자라면 페이지를 더 안 읽는다',
    /if \(!budget\.hasRoom\(MIN_PER_TARGET_MS\)\) return \[\];/.test(bsrc), true);
  for (const f of ['.github/workflows/collect-scholarships.yml', '.github/workflows/browser-collect.yml']) {
    eq(`${f} 저장 목록에 페이지 기록이 있다`,
      /git add collector\/pagination\.json/.test(readText(new URL(f, root))), true);
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
  const idx = JSON.parse(readText(new URL('index.json', tmp)));
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
      /noticeFilesForProfile\(/.test(readText(new URL(f, root))), true);
  }
  // 옛 파일로 물러나는 길 — 아직 자기 학교 파일이 없는 학생의 화면이 비면 안 된다
  for (const f of ['app.js', 'sw.js']) {
    eq(`${f}에 옛 파일 폴백이 남아 있다`,
      /data\/notices\.json/.test(readText(new URL(f, root))), true);
  }
  for (const f of ['collector/collect.mjs', 'collector/browser-collect.mjs']) {
    const src = readText(new URL(f, root));
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
    const src = readText(new URL(f, root));
    eq(`${f}가 후보 장부에 남긴다`, /saveCandidates\(mergeCandidates\(loadCandidates\(\)\.items, freshAll\)\)/.test(src), true);
  }
  for (const f of ['.github/workflows/collect-scholarships.yml', '.github/workflows/browser-collect.yml']) {
    // 저장 목록에서 빠지면 매 실행 되살아났다 다시 사라진다 (이슈 #79와 같은 유형)
    eq(`${f} 저장 목록에 후보 장부가 있다`,
      /git add collector\/candidates\.json/.test(readText(new URL(f, root))), true);
  }
  // 검수 도구가 앱 파일이 아니라 장부를 봐야 한다 — 안 그러면 되살린 것이 화면에 안 나온다
  eq('검수 도구가 후보 장부를 읽는다',
    /collector\/candidates\.json/.test(readText(new URL('verify/list-unregistered.js', root))), true);
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
  const src = readText(new URL('collector/browser-collect.mjs', root));
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
  const yml = readText(new URL('.github/workflows/browser-collect.yml', root));
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
  const src = readText(new URL('collector/deepfetch.mjs', root));
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
  const src = readText(new URL('collector/extract-excerpts.mjs', root));
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
  const df = readText(new URL('collector/deepfetch.mjs', root));
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
  const sf = readText(new URL('collector/schematize-forms.mjs', root));
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
  const sc = JSON.parse(readText(new URL('../collector/schools.json', import.meta.url)));
  const bt = JSON.parse(readText(new URL('../collector/browser-targets.json', import.meta.url)));
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
  const cm = readText(new URL('../collector/collect.mjs', import.meta.url));
  const bc = readText(new URL('../collector/browser-collect.mjs', import.meta.url));
  eq('로봇은 parked 를 읽지 않는다', /\.parked/.test(cm) || /\.parked/.test(bc), false);
}

console.log('\n■ 「또는」 줄의 처지 판정 (2026-09-18 개발자 결정)');
{
  /* 🔴 개발자 결정: *"'또는'이면 첫번째 예시로는 농어촌이거나 기초생활이어야하니까
     기초생활이 농어촌이 아니더라도 적합으로 해줘."*
     증상이던 것 — `농어촌 지역 출신 학생 또는 기초생활수급자` 가 **기초생활수급자 학생에게
     미달**로 떴다(한 줄의 조건은 AND 인데 이 줄의 `또는` 은 OR 라서).
     🔴 아래 '되돌리면 안 되는 쪽' 두 절이 이 관문의 심장이다 — 규칙을 줄 전체 OR 로
        넓히면 그쪽이 빨간불이 된다. */
  const eng = createRequire(import.meta.url)('../match-engine.js');
  const P = (x) => Object.assign({ school: '한국외국어대학교', year: 2, status: '재학' }, x);
  const v = (line, prof) => eng.requirementMatch(line, P(prof));
  const OR = '농어촌 지역 출신 학생 또는 기초생활수급자';

  eq('갈래 하나가 맞으면 다른 갈래가 아니어도 적합이다',
    v(OR, { flags: ['basicLiving'], traits: { farm: false } }), 'ok');
  eq('  갈래가 전부 아니면 그대로 미달이다 (판정을 잃지 않는다)',
    v(OR, { flags: [], traits: { farm: false } }), 'no');
  /* 🔴 **공통 꼬리가 붙은 줄은 풀지 않는다** — 전부 **실제 KOSAF 원문**이고, 코드 리뷰가
     실측으로 잡은 자리다. `또는` 뒤의 꼬리가 양쪽 갈래에 다 걸리는데, 갈래를 가르면 꼬리가
     마지막 갈래에만 들어가 '한쪽에만 있는 처지' 처럼 보인다. */
  eq('공통 꼬리(…본인**으로** …기숙사 입사자)는 풀지 않는다',
    v('○ 국민기초생활보장법 상의 생계급여수급자·의료급여수급자·주거급여수급자 및 저소득 차상위계층의 자녀 또는 본인으로 부동산 임대차(월세) 계약자 및 기숙사 입사자',
      { flags: ['nearPoverty'], traits: { dorm: false } }), 'no');
  eq('  덧붙임(※)이 붙은 갈래도 풀지 않는다 (안전원 — 회원 아닌 재학생)',
    v('○ 안전원 회원가입기간이 5년 이상이고 국내 대학 및 대학교에 재학 중인 회원 또는 회원 자녀 ※ 장학금 지급일까지 안전원 회원자격을 유지해야 함',
      { traits: { member: false } }), 'no');
  /* 🔴 **택1 묶음 안에서도 같은 규칙이다** (2026-09-18 코드 리뷰). 안 걸면 같은 줄이 혼자
     있을 때는 충족인데 묶음 안에서는 '모름' 이 된다 — 판정이 두 벌이 되는 자리다.
     🔴 **맥락을 진짜로 만들어 잰다** — `inAnyOf` 를 손으로 흉내 내면 묶음을 여는 규칙이
        바뀌어도 관문이 모른다. 안내 줄(`다음 두 가지 중 하나…`)로 실제 묶음을 연다. */
  {
    const eng = createRequire(import.meta.url)('../match-engine.js');
    const prof = P({ flags: ['basicLiving'], traits: { farm: false } });
    const sch = { id: 't', name: 't',
      eligibilityLines: ['다음 두 가지 중 하나에 해당하는 자', OR, '국가유공자 자녀'] };
    const groups = eng.requirementLines(sch, sch.eligibilityLines, { withMeta: true })
      .map((it) => it.group);
    /* 묶음이 실제로 열렸는지 먼저 못 박는다 — 안 열리면 아래가 본 경로를 재고 만다 */
    eq('택1 묶음이 실제로 열렸다 (못 열리면 아래가 헛돈다)', groups, [1, 1]);
    eq('  묶음 안에서도 혼자 있을 때와 같은 판정이다',
      eng.requirementMatch(OR, prof, sch), eng.requirementMatch(OR, prof));
  }
  /* ⚠️ **같은 줄의 처지끼리는 원래부터 OR 다** — 파서가 `anyOf: ['farm','ged']` 한 조건으로
     묶기 때문이다. 이번 결정이 고친 것은 갈래가 **서로 다른 축**에 떨어질 때다
     (처지 ↔ 특별자격). 아래 줄이 그 사실을 붙잡아 둔다 — 파서가 갈라지면 여기서 걸린다. */
  eq('같은 축의 갈래는 원래부터 한 조건으로 묶인다',
    createRequire(import.meta.url)('../parse-requirements.js')
      .parseLine('농어촌 출신 또는 검정고시 합격자', false).conds
      .filter((c) => c.kind === 'trait').map((c) => (c.anyOf || []).join('/')), ['farm/ged']);
  /* 🔴 **「또는」 이 없는 줄은 예전 그대로 AND 다** — 실제 등록 공고의 줄이다(곰두리장학금).
     장애학생 **이면서** 수상 실적이 있어야 한다. 여기서 풀면 수상만으로 적합이 된다. */
  eq('「또는」이 없으면 처지는 여전히 AND 다 (곰두리 — 장애 그리고 수상)',
    v('장애학생 중 학업 성적 우수, 예술‧체육‧기능‧기타 분야에서 도단위 이상 대회 3위 이상 수상 실적이 있는 자(곰두리장학금)',
      { flags: [], traits: { award: false } }), 'no');
  /* 🔴 **줄 전체를 OR 로 쪼개지 말 것** — 실측으로 확인한 함정이다. 등록 자격 줄 198개 중
     괄호 밖 `또는` 이 있는 17줄의 여럿은 요건 둘을 잇는 게 아니라 한 요건의 속살이다.
     아래 둘은 **실제 등록 공고의 줄**이고, 통째로 OR 로 보면 아무 재학생이나 통과한다. */
  eq('달서구 구민이 아닌 재학생이 적합이 되지 않는다 (틀린 안심 금지)',
    v('1. 신청대상 : 선발 공고일 현재 1년 이상 달서구 관내 주소를 두고 거주하는 구민 또는 그 자녀로서 대학교에 재학 중인 학생',
      { region: '서울', regionCity: '강남구' }) === 'ok', false);
  eq('  기초생활수급자가 아닌 재학생도 적합이 되지 않는다',
    v('기초생활수급자 또는 차상위계층인 재학생', { flags: [] }) === 'ok', false);
  /* 🔴 **맞은 것이 「또는」의 반대편에 있을 때만 푼다** — 아래는 **실제 KOSAF 원문**이고,
     여기 `또는` 은 **석사/박사**를 가르는 것이지 종교를 가르는 게 아니다. '어딘가 맞은 게
     있으면' 으로 두었더니 이 줄이 `모른다 → 적합` 으로 뒤집혀 **천주교 신자가 아닌 학생에게
     적합**이 됐다(실측). 전수 대조에서 이 유형이 2줄이었고 지금은 0줄이다. */
  eq('맞은 조건이 같은 갈래에 있으면 풀지 않는다 (신앙 서류 — 실제 KOSAF 줄)',
    v('○ 장학금신청서 ○ 전 과정 성적증명서(두 학기 이하 이수일 경우 출신국 학부 성적증명서 제출) ○ 재학증명서 ○ 추천서 ○ 담임목사 추천서 ○ 지도교수 추천서 ○ 신앙에세이 A4 또는 3매',
      { traits: { religion: false } }) === 'ok', false);
  eq('  종교 요건이 있는 줄은 신자가 아니면 여전히 미달이다',
    v('○ 장학금 지원분야:국내외에서 천주교와 관련된 학문을 연구하는 대학 입학예정자·재학생·석사 또는 박사 학위과정(석박사 통합 과정 포함)·박사 후 과정(포스트 닥터)에 있는 자',
      { traits: { religion: false } }), 'no');
  /* 실제 KOSAF 줄 — 전주 거주 학생이 검정고시가 아니라고 **미달**이 되던 자리 */
  eq('전주 거주 학생이 검정고시 아니라고 미달이 되지 않는다 (실제 KOSAF 줄)',
    v('공고일 현재 전주시에 3년 이상 계속 거주하고 있는 전주 시민의 자녀로서 전북특별자치도 관내 고등학교를 졸업한 대학생 또는 고등학교 검정고시 졸업자격을 합격한 대학생',
      { region: '전북', regionCity: '전주시', traits: { ged: false } }) === 'no', false);
  /* 괄호 안의 `또는` 은 한 조건의 속살이라 이 규칙을 깨우지 않는다 */
  eq('괄호 안의 「또는」은 갈래가 아니다',
    createRequire(import.meta.url)('../parse-requirements.js')
      .hasTopLevelOr('평점 3.5 이상(4.5 만점 기준 또는 4.3 만점)'), false);
}

console.log('\n■ 학적정보 수정이 다른 칸을 지우지 않는다 (2026-09-18 코드 리뷰)');
{
  /* 🔴 `collectProfile()` 은 프로필 객체를 **통째로 새로 만든다** — 그 화면에 칸이 없는 값은
     여기에 적지 않으면 저장을 누르는 순간 사라진다. `common`(서류 정보)이 이미 그래서
     `Object.assign` 으로 물려받고 있었는데, 2026-09-18 에 들어온 `traits`(처지)가 빠져
     **MY → 학적정보 수정 저장 한 번에 학생이 답해 둔 처지가 전부 날아가고** 있었다.
     ⚠️ 프로필에 화면 밖 칸을 새로 만들면 여기 한 줄을 더하는 것까지가 한 세트다. */
  const app = readText(new URL('../app.js', import.meta.url));
  const at = app.indexOf('function collectProfile');
  let fn = '';
  if (at >= 0) {
    let depth = 0;
    for (let j = app.indexOf('{', at); j < app.length; j++) {
      if (app[j] === '{') depth++;
      else if (app[j] === '}' && --depth === 0) { fn = app.slice(at, j + 1); break; }
    }
  }
  fn = fn.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  /* 함수를 못 자르면 아래가 빈 문자열을 상대로 조용히 통과한다 — 심장을 먼저 못 박는다 */
  eq('학적정보를 모으는 함수를 통째로 찾았다 (못 찾으면 아래가 헛돈다)',
    /school:/.test(fn) && /flags:/.test(fn), true);
  for (const key of ['common', 'traits']) {
    eq(`  화면에 칸이 없는 '${key}' 를 물려받는다 (저장해도 안 지워진다)`,
      new RegExp(key + ':\\s*Object\\.assign\\(\\{\\},\\s*\\(state\\.profile').test(fn), true);
  }
}

console.log('\n■ 병합 충돌 표식이 파일에 남지 않는다 (2026-09-18 실사고)');
{
  /* 🔴 **실제로 main 까지 나갔다** — `style.css` 에 `<<<<<<< HEAD`·`=======`·`>>>>>>> …` 세 줄이
     커밋된 채 배포돼 있었다. 조용한 사고라 아무도 못 봤다: JS 였다면 즉시 죽지만 **CSS 는
     안 죽고 그냥 버린다**. 브라우저 파서는 표식을 선택자로 읽고 다음 `{` 까지 삼켜서,
     **표식 하나당 바로 뒤 규칙 한 개**가 사라진다.
     실측(표식 제거 전/후): 규칙 1,210 → 1,213 · `.hero-amount` 1 → 2벌 ·
     `.elig-ask-yn` 0 → 1 · `.elig-ask` 0 → 1 · 홈 히어로 아래 여백 **2px → 20px**
     (그 블록 주석이 경고하던 바로 그 증상이 실제로 일어나 있었다).
     🔴 이 관문은 **앱이 싣는 파일 전부**를 본다 — 한 파일만 보면 다음엔 옆 파일에서 난다. */
  const files = ['style.css', 'app.js', 'index.html', 'sw.js', 'data.js', 'match-engine.js',
    'boot.js', 'resume.js', 'notify.js', 'notify-rules.js', 'chat.js', 'forms.js',
    'parse-amount.js', 'section-head.js', 'interactions.js', 'elig-ask.js',
    'form-plan.js', 'essay.js', 'essay-quality.js', 'essay-submit-check.js',
    '_admin/admin.css', '_admin/admin.js'];
  /* ⚠️ 줄 **처음**에 온 것만 본다 — 본문·주석에 `=======` 같은 구분선을 긋는 파일이 있다
     (이 저장소 주석이 실제로 `═` 를 쓴다). 표식은 늘 0열에서 시작한다. */
  const MARK = /^(<{7} |={7}$|>{7} )/m;
  const dirty = files.filter((f) => {
    let t; try { t = readText(new URL('../' + f, import.meta.url)); } catch (e) { return false; }
    return MARK.test(t);
  });
  eq('앱이 싣는 파일에 병합 충돌 표식이 없다', dirty, []);
  /* 🔴 파일 목록이 비면 위 줄이 **아무것도 안 세고 통과**한다 — 실제로 읽혔는지 못 박는다 */
  eq('  검사가 실제로 파일을 읽었다 (빈 목록을 상대로 통과하지 않는다)',
    readText(new URL('../style.css', import.meta.url)).length > 1000, true);
}

console.log('\n■ 교내·교외 분류와 주관 기관 (2026-09-18 개발자 지시)');
{
  /* 🔴 개발자 지적으로 드러난 것: 학생 카드가 `교내 · 경희대학교 게시 공고 /
     푸른등대 한국수력원자력 k-원전 장학금` 이었다 — **한국장학재단 장학금을 경희대가 주는 것처럼**
     보여 주고 있었다. 원인 둘:
       ① `type` 이 제목 낱말(재단·장학회·시민…)로 교외를 찾고 **나머지를 전부 교내**로 떨어뜨렸다.
          실측: '교내' 19건 중 진짜 교내는 2건, 국가장학금 7건 + 외부 재단·지자체 10건.
       ② `provider` 에 **게시한 학교**가 들어갔다(33건). 그 칸은 '누가 주는가'다.
     🔴 규칙을 여기에 베끼지 않는다 — 로봇 소스에서 읽어 그대로 돌린다(베끼면 갈라진다). */
  const src = readText(new URL('../collector/auto-register.mjs', import.meta.url));
  /* 🔴 판정 규칙은 **`match-engine.js` 한 곳**이다 (2026-09-18에 옮겼다 — 앱 화면도 같은 말을
     해야 해서다). 로봇도 앱도 이 함수를 불러 쓴다. 여기서 규칙을 베끼지 않고 그 파일에서 읽는다. */
  const eng = readText(new URL('../match-engine.js', import.meta.url));
  const mMark = eng.match(/const NOTICE_CAMPUS_MARK = (\/.*\/);/);
  const mProv = src.match(/const PROVIDER_UNKNOWN = '([^']+)';/);
  eq('교내 표식 규칙(NOTICE_CAMPUS_MARK)이 공용 엔진에 있다', !!mMark, true);
  eq('  로봇이 그 함수를 가져다 쓴다 (규칙을 베끼지 않는다)',
    /\{ noticeKind \} = createRequire/.test(src) && /type: noticeKind\(title, n\.school\)/.test(src), true);
  eq('로봇에 "모름" 주관 기관(PROVIDER_UNKNOWN)이 있다', !!mProv, true);
  if (mMark && mProv) {
    const MARK = eval(mMark[1]);
    const typeOf = (t) => (MARK.test(t) ? '교내' : '교외');
    /* 전부 **실제로 등록돼 있던 제목**이다 */
    eq('[교내] 표식이 붙은 것만 교내다',
      ['[교내][서울]2026-2 국제학부 김봉철 장학금 장학생 모집(~9/4)',
       '[공통][교내] 2026-2학기 가족장학금 신청 안내 (9/10 ~ 9/28)'].map(typeOf), ['교내', '교내']);
    eq('  한국장학재단 국가장학금은 교내가 아니다',
      ['[공통][국가]2026년 2학기 푸른등대 기부장학금 장학생 선발(~9/10)',
       '[공통][국가근로] 2026-2학기 국가근로장학생 희망근로지 신청 안내',
       '[공통][국가]2026-2 중소기업취업연계장학금 신규장학생 신청안내(~9/18)',
       '[공통][국가]2026년 2학기 고졸 후학습자 장학금 신청안내',
       '공통 푸른등대 한국수력원자력 k-원전 장학금 신청안내 (9.11~9.28)'].map(typeOf),
      ['교외', '교외', '교외', '교외', '교외']);
    eq('  제목에 재단 낱말이 없는 외부 공고도 교내가 아니다',
      ['공통 2026년 상반기 사랑나눔장학생 모집 공고',
       '공통 제36기 미레에셋 해외교환 장학생 선발',
       '[화성시] 2026년 코나아이 소상공인 장학생 모집'].map(typeOf), ['교외', '교외', '교외']);
    /* 🔴 **`교내` 뒤에 `외` 가 오면 교내가 아니다** — `교내외`·`교내·외`·`교내•외` 는 둘 다를
       뜻한다. 이 셋이 규칙을 넓힐 때의 경계값이다(전부 실제 게시판 제목). */
    eq('  "교내외" 류는 교내가 아니다',
      ['2026-2학기 교내외 장학금 통합 안내',
       '(서울)2026학년도 2학기 서울캠퍼스 학기중 일반 교내·외 국가근로장학생 선발 안내',
       '(다빈치) 2026학년도 다빈치캠퍼스 2학기 학기 중 교내•외근로 국가근로장학생 선발 안내'].map(typeOf),
      ['교외', '교외', '교외']);
    /* 🔴 반대쪽 함정 — 대괄호 표식만 보면 게시판이 대괄호 없이 쓰는 **진짜 교내 공고**를 놓친다.
       실측(notices.json 120판): 제목에 `교내` 가 든 31건 중 12건만 잡히고 19건이 교외로 떨어졌다. */
    eq('  대괄호가 없어도 제목이 "교내" 라고 하면 교내다',
      ['[교내근로-인문캠퍼스] 2026학년도 2학기 국가근로장학생(교내근로) 선발결과 안내',
       '2026학년도 2학기 대학원 교내 특별 장학금(외국인, 공로, 개신가족) 추가 신청 안내',
       '[입학처] 2026학년도 2학기 교내 및 국가 근로장학생 모집 안내'].map(typeOf),
      ['교내', '교내', '교내']);
    eq('로봇이 주관 기관에 게시 학교를 넣지 않는다',
      /provider: `\$\{n\.school\}/.test(src), false);
    eq('  대신 "모른다"고 적는다', /provider: PROVIDER_UNKNOWN/.test(src), true);
  }
  /* 소급 적용 (운영 원칙 7) — 이미 등록된 것에도 같은 기준이 서 있어야 한다 */
  const reg = JSON.parse(readText(new URL('../data/registered.json', import.meta.url)));
  const board = reg.items.filter((i) => /게시 공고$/.test(String(i.provider || '')));
  eq('등록분에 "○○ 게시 공고" 주관 기관이 남아 있지 않다', board.length, 0);
  /* 🔴 **'교내'는 "우리 학교가 준다"는 뜻이다** — 주관 기관이 바깥 기관이면 둘 중 하나가 틀렸다.
     실제로 `한미 첨단분야 청년교류 지원사업`(주관 한국산업기술진흥원 KIAT)이 '교내'로 등록돼
     **학교를 가리지 않고 모두에게** 교내 장학금처럼 떠 있었다(2026-09-18 발견).
     낱말 목록이 아니라 **두 칸이 서로 모순되는가**로 본다 — 새 유형이 와도 걸린다. */
  const SCHOOLISH = /대학교|대학|[가-힣]대\s|[가-힣]대$/;
  const contradict = reg.items.filter((i) => i.type === '교내'
    && !/원문 확인/.test(String(i.provider || ''))
    && !SCHOOLISH.test(String(i.provider || '')));
  eq('교내로 분류한 공고의 주관 기관은 학교이거나 "모름"이다',
    contradict.map((i) => `${i.id}:${i.provider}`), []);
  /* 🔴 **"모른다"고 적은 값이 학생 화면·학생 글로 새지 않는다** (2026-09-18 코드 리뷰가 셋을 더 잡았다).
     `주관 기관 원문 확인` 은 앱 내부 사정이다 — 학생에게 그대로 보이면 2026-09-17 지시
     (앱 내부 사정은 학생 화면에 안 적는다)를 정면으로 어긴다. 새던 자리 셋을 각각 못 박는다. */
  const app = readText(new URL('../app.js', import.meta.url));
  eq('초안이 "모름" 주관 기관을 문장에 넣지 않는다', /provLead\(sch\)/.test(app), true);
  eq('  그 함수가 "원문 확인" 을 걸러 낸다', /원문 확인\|미확인/.test(app), true);
  const dataJs = readText(new URL('../data.js', import.meta.url));
  eq('제출처 안내도 "모름" 주관 기관을 이름으로 쓰지 않는다', /knownProvider/.test(dataJs), true);
  /* 🔴 33건이 **같은 글자**를 갖게 되므로, 그 글자로 점수를 주면 '원문'·'확인' 두 글자에
     무관한 공고가 한꺼번에 걸린다(chat.js CHAT_STOP 주석이 경고한 유형). */
  const chatJs = readText(new URL('../chat.js', import.meta.url));
  eq('도우미가 "모름" 주관 기관으로 공고를 고르지 않는다', /원문 확인\|미확인\/\.test\(rawProv\)/.test(chatJs), true);
  /* 🔴 **관리자 등록 갈래의 기본값이 로봇과 같아야 한다** — 다르면 관리자가 공고 하나만 등록해도
     위 '게시 공고가 남아 있지 않다' 관문이 빨간불이 되고, 수집 워크플로의 데이터 관문이 실패해
     **그 실행의 자동 등록분이 통째로 되돌려진다**(revert-auto.mjs). */
  const adminApply = readText(new URL('../tools/admin-apply.mjs', import.meta.url));
  eq('관리자 등록도 기본이 교외다', /patch\.type === '교내' \? '교내' : '교외'/.test(adminApply), true);
  /* ⚠️ **주석까지 세지 말 것** — 걷어낸 옛 배선을 인용한 주석에 걸려 빨간불이 된다
     (CLAUDE.md 2026-09-12 · 실제로 이 줄을 쓰면서 그렇게 걸렸다). 주석을 지우고 본다. */
  const adminCode = adminApply.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  eq('  관리자 등록도 게시 학교를 주관 기관으로 넣지 않는다', /게시 공고/.test(adminCode), false);
  /* 🔴 인스타 로봇은 `provider` 글자로 학교를 찾고 있었다 — 그 칸이 `○○대학교 게시 공고` 라서
     우연히 맞던 것이다. 정직하게 고치자 학교를 찾는 공고가 39 → 10건으로 떨어졌다(실측). */
  const instaSchool = readText(new URL('../insta/school.mjs', import.meta.url));
  eq('인스타가 학교를 schoolOnly 로 찾는다', /eligibility \|\| \{\}\)\.schoolOnly/.test(instaSchool), true);

  /* 🔴 **실시간 공고 카드도 같은 말을 해야 한다** (2026-09-18 개발자 지적 "교내공고에서 교내로").
     그 카드 맨 윗줄은 목록 카드와 **같은 자리**(`.sch-org`)인데 `교내 공고` 로 못 박혀 있었다 —
     제목이 `[공통][교외]` 인 공고가 '교내 공고' 로 떴다(실측 한국외대 27건 중 26건이 교외).
     ⚠️ 주석까지 세지 말 것 — 아래 경위 주석이 옛 문구를 인용한다. */
  /* ⚠️ 앱 전체에서 `교내 공고` 를 세면 안 된다 — MY 화면의 판 번호 줄이 `교내 공고 2개교`
     로 쓴다(전혀 다른 뜻). **그 카드를 그리는 함수 안에서만** 본다. */
  /* 🔴 **비탐욕 정규식으로 함수를 자르지 말 것** (2026-09-18 코드 리뷰). 안쪽에 0열 `}` 가
     하나 생기는 순간 토막만 잘려 나오고, 아래 '못 박혀 있지 않다' 가 **빈 껍데기를 상대로
     조용히 통과**한다. 여는 괄호부터 세어 짝이 맞는 자리에서 끊는다. */
  const cutFn = (src, name) => {
    const at = src.indexOf(`function ${name}(`);
    if (at < 0) return '';
    let i = src.indexOf('{', at), depth = 0;
    for (let j = i; j < src.length; j++) {
      if (src[j] === '{') depth++;
      else if (src[j] === '}' && --depth === 0) return src.slice(at, j + 1);
    }
    return '';
  };
  /* 🔴 **카드 그림은 `noticeCardHtml` 한 곳이다** (2026-09-18 오후에 갈라 뒀다 — 홈과
     '교내' 칸이 같은 그림을 쓴다). 여기서 함수 이름을 안 따라가면 아래 세 줄이 **빈 문자열을
     상대로 조용히 통과**한다(이 저장소가 겪은 '자리를 옮기면 관문이 무력해진다' 유형).
     그래서 바로 아래 '통째로 찾았다' 가 심장 노릇을 한다. */
  const liveFn = cutFn(app, 'noticeCardHtml')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  /* 이 함수의 심장(카드 마크업)이 실제로 잘려 왔는지 본다 — 길이만 보면 토막도 통과한다 */
  eq('게시판 글 카드를 그리는 함수를 통째로 찾았다 (못 찾으면 아래가 헛돈다)',
    /sch-org/.test(liveFn) && /sch-name/.test(liveFn), true);
  /* 🔴 **게시판 글 카드는 교내/교외를 말하지 않는다** (2026-09-18 오후 개발자 지시:
     "교내 교외가 어디에 게시되느냐가 아니라 어떤 재단이 주최하는가가 기준이 되어야 돼").
     제목·링크뿐이라 주최를 모른다 — 아는 것(어느 게시판에서 왔나)만 적는다.
     ⚠️ 같은 날 아침에 `교내 공고` → `noticeKind` 로 고쳤다가, 그것도 주최가 아니라
        제목 표식일 뿐이라는 것이 실측으로 드러나 **아예 안 적는 쪽**으로 다시 바꿨다. */
  eq('게시판 글 카드가 "교내 공고" 로 못 박혀 있지 않다', /교내 공고/.test(liveFn), false);
  eq('  교내/교외를 아예 말하지 않는다 (주최를 모르므로)',
    /교내|교외|noticeKind/.test(liveFn), false);
  eq('  어느 게시판에서 왔는지는 적는다', /게시판</.test(liveFn), true);
  /* 브라우저에서는 전역으로 잡힌다 — 내보내기 목록에서 빠지면 Node 검사만 통과하고 앱이 죽는다 */
  eq('  noticeKind 가 Node 쪽으로도 내보내진다', /noticeKind, NOTICE_CAMPUS_MARK/.test(eng), true);

  /* 🔴 **'교내' 칸에는 우리가 확인한 등록 공고만 온다** (2026-09-18 개발자 지시).
     게시판 글을 그 칸에 되돌리면 개발자가 짚은 혼동(교내 칸에 외부 장학금)이 그대로 돌아온다.
     옮긴 자리는 홈이다 — 사라지면 학생이 학교 게시판 새 공고를 볼 곳이 없어진다. */
  const cutFnApp = (name) => cutFn(app, name).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const exploreFn = cutFnApp('renderExplore');
  const homeFn = cutFnApp('renderHome');
  eq('탐색·홈 두 함수를 통째로 찾았다 (못 찾으면 아래가 헛돈다)',
    /explore-list/.test(exploreFn) && /home-deadline-list/.test(homeFn), true);
  eq('"교내" 칸이 게시판 글을 통째로 그리지 않는다', /liveNoticesHtml/.test(exploreFn), false);
  eq('  대신 홈이 그린다', /#live-notices.*liveNoticesHtml\(\)/.test(homeFn), true);
  /* 🔴 **학교가 `[교내]` 라고 적어 둔 글은 '교내' 칸에도 온다** (2026-09-18 개발자 지적:
     *"실시간 공고 보니까 교내에서 진행되는 거 있는데 교내탭에는 안 들어가져 있어"*).
     실측으로 확인한 것: 그때 홈에 떠 있던 한국외대 `[공통][교내] 2026-2학기 가족장학금` 이
     '교내' 칸에는 한 장도 없었다. 우리가 주최를 알아맞히는 것이 아니라 **주최자가 적어 둔
     글자**를 읽는 것이라 원칙 8-1(추론 금지)에 걸리지 않는다. */
  eq('  학교가 [교내] 라고 적어 둔 게시판 글은 "교내" 칸에도 온다',
    /boardNoticesInSchool\(\)/.test(exploreFn), true);
  eq('    그 카드도 같은 그림을 쓴다 (베끼지 않는다)', /noticeCardHtml/.test(exploreFn), true);
  /* 판정을 새로 만들지 않는다 — `noticeKind` 한 곳(로봇·앱이 같이 쓴다) */
  const inSchoolFn = cutFnApp('boardNoticesInSchool');
  eq('    판정은 공용 noticeKind 하나다', /noticeKind\(n\.title\) === '교내'/.test(inSchoolFn), true);
  /* 목록 고르기도 한 곳 — 베끼면 홈에만 뜨거나 '교내' 칸에만 뜨는 공고가 생긴다 */
  const forMeFn = cutFnApp('boardNoticesForMe');
  eq('    홈과 같은 목록을 본다', /noticeForProfile\(n, p\)/.test(forMeFn)
    && /boardNoticesForMe\(\)/.test(inSchoolFn)
    && /boardNoticesForMe\(\)/.test(cutFnApp('liveNoticesHtml')), true);
  /* 홈에 그릴 자리가 실제로 있어야 한다 — 표식이 index.html 에서 빠지면 조용히 아무것도 안 뜬다 */
  const html = readText(new URL('../index.html', import.meta.url));
  const homeBlock = html.slice(html.indexOf('id="screen-home"'), html.indexOf('id="screen-explore"'));
  eq('  그 자리(#live-notices)가 홈 안에 있다', /id="live-notices"/.test(homeBlock), true);
  eq('  탐색 화면에는 없다',
    /id="live-notices"/.test(html.slice(html.indexOf('id="screen-explore"'))), false);
}

console.log('\n■ 정식 등록 대상 학교 좁히기 (2026-08-30)');
{
  const cfg = JSON.parse(readText(new URL('../collector/auto-register-config.json', import.meta.url)));
  const src = readText(new URL('../collector/auto-register.mjs', import.meta.url));
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
  const src = readText(new URL('../match-engine.js', import.meta.url));
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

/* ══ 대학원 전용 공고 (2026-09-12 · 개발자 지적 "의과확지 장학금은 자격 미확인으로 뜸") ══
   이 축은 세 번 판정이 바뀐 자리다. 지금 상태와 **왜 그 상태인지**를 여기서 못 박는다:
     ① 2026-08-24 — `일반대학원생 : 평점 4.0` 같은 **표의 한 칸**은 학부생과 무관하니 분모에서 뺀다.
     ② 2026-09-09 — 그 처리가 `국내 의과학 대학원 석/박사 과정 재학생` 처럼 **대상을 말하는
        문장**에도 걸려 남은 줄만 세는 바람에 적합도 95% 가 됐다 → '자격 미확인'(35)으로 낮췄다.
     ③ 2026-09-12 — 개발자가 화면에서 보고 그것도 틀렸다고 했다. 맞다: 온보딩이 받는 학적은
        1~4학년 + 재학·신입학·복학예정·휴학·초과학기·졸업유예로 **학부뿐**이라 우리는 모르는 게
        아니다. 이제 **미달**이고, 근거로 그 원문 줄을 그대로 보여 준다.
   🔴 되돌리려거든 온보딩에 학위 과정 칸을 먼저 만들 것(그 값을 보는 판정으로 바꿔야 한다). */
/* ══ 접수 기간 한 줄 (2026-09-12 · 노션 UI-16 작업 중 드러남) ═══════════════
   '우리 학교' 칸을 만들면서 그 카드들이 화면의 주인공이 되자, 메타 줄이 이렇게 떠 있었다:
     · `까지 나 . 선발 : 10 월 중순예정 다 . 선발확인 : Hufs Ability 로그인 후…`
     · `마감 안내 작성일 2026.08.31 수정일 2026.08.31 작성자 2026085 조회수 5…`
   옛 규칙이 `/(마감|까지|기한|접수기간|신청기간)[^\n<]{0,60}/` 라, 본문 아무 데나 있는
   `까지` 가 걸리면 거기서 60자를 잘라 왔기 때문이다(`collector/extracted/notices-text.json`
   86건 실측: 41건 중 20건이 문장 중간에서 시작 · 5건은 게시판 껍데기).
   🔴 지금은 **기간을 말하는 이름표**에서 시작한다 — 이 저장소가 마감일에 이미 쓰는 방식이다
      (2026-08-30 extract-excerpts). 규칙은 `collector/deadline-hint.mjs` **한 곳**이고
      수집기 둘이 그것을 가져다 쓴다(예전에는 정규식이 두 벌이었다). */
console.log('\n■ 접수 기간 한 줄 (2026-09-12)');
{
  const { deadlineHintFrom, looksLikeHint } = await import('../collector/deadline-hint.mjs');
  const H = (t) => deadlineHintFrom(t);

  eq('이름표에서 시작한다',
    H('1. 신청기간 : 2026. 9. 11(금) ~ 9. 18(금) 15:00 까지 나. 선발 : 10월'),
    '신청기간 : 2026. 9. 11(금) ~ 9. 18(금) 15:00 까지 나. 선발 : 10월');
  eq('  문장 중간의 「까지」로는 시작하지 않는다', H('까지) 다음글 2025학년도 후기 학위수여식 안내 목록'), null);
  eq('  게시판 껍데기를 기간이라고 하지 않는다', H('마감 안내 작성일 2026.08.31 수정일 2026.08.31 조회수 5'), null);
  eq('  맨 「기한」은 콜론이 있을 때만 이름표다 (문장 중간에 흔하다)',
    [H('기한 내에 희망근로지 신청을 하시기 바랍니다 . 해당 기한을 지나서'),
      !!H('5. 제출기한 : 2026. 9. 11( 금 ) 15:00 6. 제출처')], [null, true]);
  /* 🔴 첫 이름표를 그냥 쓰면 학교 홈 배너의 다른 공고 기간을 집어 온다(실측 2건) */
  eq('배너가 먼저 나와도 날짜 있는 진짜 기간을 고른다',
    H('모집기간: 2026.06.29. ~ 상시신청 이전 슬라이드 다음 슬라이드 2. 신청기간 : 2026.6.15.(월)~ 9.11.(금) 3. 지원방법'),
    '신청기간 : 2026.6.15.(월)~ 9.11.(금) 3. 지원방법');
  eq('  날짜가 이름표에서 멀면 그 문장이 아니다',
    H('신청기간을 안내합니다. 궁금한 사항은 해당 캠퍼스로 문의바랍니다. 파일 첨부 2026년 2학기 푸른등대'), null);
  eq('저장된 옛 힌트를 가려낼 수 있다 (데이터 청소용)',
    [looksLikeHint('까지 나 . 선발 : 10 월 중순예정'), looksLikeHint('신청기간 : 2026. 9. 11( 금 ) ~ 9. 18( 금 ) 15:00')],
    [false, true]);

  /* 🔴 규칙은 한 곳 — 수집기가 제 정규식을 되살리면 두 벌이 갈라진다 */
  const col = readText(new URL('../collector/collect.mjs', import.meta.url));
  const br = readText(new URL('../collector/browser-collect.mjs', import.meta.url));
  eq('수집기 둘 다 공용 모듈을 쓴다',
    [/deadline-hint\.mjs/.test(col) && /deadlineHintFrom\(/.test(col),
      /deadline-hint\.mjs/.test(br) && /deadlineHintFrom\(/.test(br)], [true, true]);
  eq('  수집기에 옛 정규식이 되살아나지 않았다',
    [col, br].some((t) => /DEADLINE_RE\s*=/.test(t)), false);

  /* 🔴 발행된 데이터에도 옛 힌트가 남아 있지 않다 (2026-09-12 에 한 번 청소했다).
     🔴 **앱이 읽는 것은 학교별 파일**(`data/notices/<열쇠>.json`)이다 — `notices.json` 은
        폴백일 뿐이다(app.js loadNotices · match-engine noticeFilesForProfile).
        처음엔 폴백만 보고 초록불을 받았는데, 그동안 학생 화면에는 `마감 안내 작성일 …
        조회수 5` 가 그대로 떠 있었다(2026-09-12 코드 리뷰가 브라우저로 잡았다).
        **관문이 학생이 보는 파일을 봐야 한다** — 이 저장소가 몇 번이나 데인 유형이다. */
  const noticeFiles = ['../data/notices.json',
    ...fs.readdirSync(new URL('../data/notices/', import.meta.url))
      .filter((f) => f.endsWith('.json') && f !== 'index.json').map((f) => `../data/notices/${f}`)];
  eq('학교별 공고 파일을 실제로 찾았다 (폴백만 보고 통과하지 않는다)', noticeFiles.length >= 2, true);
  const bad = noticeFiles.flatMap((rel) => {
    const doc = JSON.parse(readText(new URL(rel, import.meta.url)));
    return (doc.items || []).map((n) => n.deadlineHint).filter(Boolean)
      .filter((h) => !looksLikeHint(h)).map((h) => `${rel.split('/').pop()}: ${h.slice(0, 30)}`);
  });
  eq('발행된 공고의 기간 줄이 전부 이름표로 시작한다 (학교별 파일 포함)', bad.slice(0, 3), []);

  /* 🔴 청소가 **병합에서 되살아나지 않는다** — 공고 파일은 합집합 병합이라 옛 판과 합쳐진다.
     점수가 '힌트가 있기만 하면'이었을 때는 버린 쓰레기가 이겼다(실측). */
  /* 🔴 **다리(.cjs)로 부른다** — `audit-data.js` 가 쓰는 길이 그것이다. url-key.mjs 에 import 를
     더했을 때 그 다리가 `new Function` 에서 터져 감사가 통째로 죽은 적이 있다(2026-09-12).
     여기서 다리를 지나가면 그 사고가 관문에 걸린다. */
  const UK = createRequire(import.meta.url)('../collector/url-key.cjs');
  const junk = { url: 'https://x/1', deadlineHint: '까지 나 . 선발 : 10 월 중순예정' };
  const clean = { url: 'https://x/1' };
  eq('병합이 쓰레기 힌트를 되살리지 않는다', (UK.preferNotice(clean, junk) || {}).deadlineHint, undefined);
}

console.log('\n■ 대학원 전용 공고는 학부 프로필에 미달 (2026-09-12)');
{
  const MEq = createRequire(import.meta.url)('../match-engine.js');
  const P = { school: '한국외국어대학교', track: 'humanities', major: '영어학과', year: 3,
    status: '재학', gpa: 3.5, bracket: 5, credits: 15, region: '서울', flags: [] };
  const fd = (lines) => MEq.fitDetail({ id: 'x', eligibilityLines: lines }, P);

  /* 실제 원문 — 동행복지재단 의과학자 장학금(KOSAF 층2) */
  const grad = fd(['국내 의과학 대학원 석/박사 과정 재학생', '대한민국 국적 보유자',
    '한국장학재단 학자금 지원구간 5구간 이하인 자']);
  eq('대상이 대학원생이라고 말한 공고는 미달이다', grad.fails.length > 0, true);
  eq('  「자격 미확인」으로 두지 않는다', grad.unread, false);
  eq('  근거는 그 원문 줄 그대로다 (지어내지 않는다)', grad.fails, ['국내 의과학 대학원 석/박사 과정 재학생']);

  /* 🔴 학부를 함께 말한 공고는 건드리지 않는다 — LG디스플레이(학사·석사 둘 다)가 실제 사례다.
     여기서 막으면 **틀린 미달**이 되고, 그건 못 받는 것보다 나쁘다. */
  const both = fd(['26년 9월 기준 학부 3학년 2학기(6학기) 재학생 또는 27년 3월 기준 학부 4학년 1학기 복학 예정자',
    '병역필 또는 면제자로서 해외 여행에 결격 사유가 없는 자']);
  eq('학부를 함께 말한 공고는 미달이 아니다', both.fails.length, 0);

  /* 🔴 표의 한 칸은 예전 그대로 **분모에서 빼기만** 한다(2026-08-24 가톨릭대 오탐 방지) */
  const table = fd(['학부생 : 직전학기 평점 3.0 이상', '일반대학원생 : 평점 4.0 이상']);
  eq('학부/대학원 기준을 나란히 적은 표는 미달이 아니다', table.fails.length, 0);

  /* 🔴 **틀린 미달 세 모양** — 2026-09-12 코드 리뷰가 실측으로 보여 준 것들이다.
     벌이 무거워졌으므로(미달 = 버튼 잠김 · 홈에서 사라짐) 이 셋은 반드시 막혀야 한다. */
  eq('「대학원생은 지원할 수 없음」으로 학부생을 떨어뜨리지 않는다 (뜻이 반대다)',
    fd(['재학생 중 성적 우수자', '대학원 재학생은 지원할 수 없음']).fails.length, 0);
  eq('  「…은 제외」도 마찬가지다',
    fd(['재학생 중 성적 우수자', '대학원 석·박사 과정 재학생은 제외']).fails.length, 0);
  eq('여러 장학금이 묶인 공고는 한 갈래가 대학원용이라고 통째로 막지 않는다 (설계 조건 ⑧)',
    fd(['(우수장학금) 직전학기 평점 3.0 이상인 자', '(연구장학금) 대학원 석/박사 과정 재학생']).fails.length, 0);
  eq('띄어 쓴 「대학 재학생」도 학부를 말한 것으로 본다',
    fd(['4년제 대학 재학생', '대학원 석/박사 과정 재학생', '소득 8구간 이하']).fails.length, 0);
  /* ⚠️ 그러면서도 진짜 대학원 전용은 여전히 막혀야 한다 — 위 첫 항목이 그것을 지킨다 */

  /* ══ 학위 과정이 **판정하는 축**이 됐다 (2026-09-12 · 노션 핵심-4) ══════════
     그전에는 대학원을 말하는 줄을 **통째로 건너뛰고**(gradOnly) 대상을 말하는 문장만
     fitDetail 이 따로 막았다. 그래서 `학부 재학생` 처럼 **학생이 맞는다고 말해 주는 줄**은
     아무 표시 없이 지나갔다 — 백로그가 말한 "안 잡힌 절은 보이지 않는다"가 이것이다.
     실측(자격 줄 1,011 중 학위를 말하는 줄 157): 축이 잡던 것은 7줄뿐이었다.
     축을 넣은 뒤 적합도가 오른 공고 8건 · 내린 공고 0건(브라우저 전후 대조). */
  const PRq = createRequire(import.meta.url)('../parse-requirements.js');
  eq('학부 줄은 충족으로 센다 (예전엔 아무 말도 안 했다)',
    [fd(['2026-2학기 학부 재학생', '대한민국 국적 보유자']).met,
      fd(['2026-2학기 학부 재학생', '대한민국 국적 보유자']).unknown], [1, 1]);
  eq('  학부·대학원을 함께 말한 줄도 충족이다', fd(['본교 학부 및 대학원 재학생']).met, 1);
  eq('  대학원만 말한 줄은 미달이다', fd(['국내 의과학 대학원 석/박사 과정 재학생']).fails.length, 1);
  /* 🔴 제외 줄에서는 **판정하지 않는다** — 학위 낱말이 딴 뜻으로 섞여 틀린 미달이 났다(실측) */
  eq('제외 줄의 학위 낱말로는 판정하지 않는다 (틀린 미달을 막는다)',
    [PRq.parseDegree('2027-1학부터 타재단 장학금 중복수혜 불가', true),
      PRq.parseDegree('경상남도장학회 2025년 도내 대학 재학생 장학금 수해자 및 2026년 장학사업 중복 수혜자', true),
      PRq.parseDegree('대학원 재학생은 지원할 수 없음', false)], [null, null, null]);
  eq('  표의 한 칸도 요건이 아니다', PRq.parseDegree('일반대학원생 : 평점 4.0 이상', false), null);
  eq('  학위를 말하지 않는 줄에는 조건을 만들지 않는다', PRq.parseDegree('소득 8구간 이하', false), null);
  /* 🔴 프로필 쪽 값은 **한 곳**에서 나온다 — 온보딩에 학위 칸이 생기면 그 함수만 고친다 */
  eq('프로필의 학위는 학부다 (온보딩이 학부만 받는다)', fd(['본교 학부 재학생']).met, 1);

  /* 🔴 **거꾸로도 못 박는다 — 학위 낱말 하나로 ✓ 를 주면 안 된다** (2026-09-12 코드 리뷰).
     첫 판은 `대학생` 만 있으면 충족으로 셌고, 리뷰가 실측으로 18줄을 찾아냈다. 그중 이런 줄들이
     '확인했다'가 돼 있었다 — 거주 2년 · 선원 가족 · 기숙사 입사 · 재난 피해처럼 **우리가 묻지도
     않은 처지**다(적합도 95% 가 세 건 생겨 탐색·홈 맨 위에 떴다). 전부 실제 원문이다. */
  /* 줄 하나짜리 공고로 재면 앱과 같은 함수를 지난다 — ✓ 면 met 1, 모르면 met 0 이다
     (`lineVerdict` 는 내보내지 않는다 — 내보내려고 파일을 고치기보다 공개된 길로 잰다). */
  const okOf = (t) => { const r = fd([t]); return r.fails.length ? 'no' : (r.met ? 'ok' : null); };
  eq('거주 요건이 붙은 줄을 학위만 보고 충족이라 하지 않는다',
    okOf('공고일 기준 대상지역 실거주기간이 연속 2년 이상인 주민의 대학생 자녀'), null);
  eq('  선원 가족 요건도 마찬가지다',
    okOf('(대상) 선원법 제3조 적용선박 승·하선 선원 및 그 가족 중 대학생 : 본인/배우자/자녀'), null);
  eq('  기숙사 입사 요건도',
    okOf('천안행복기숙사 26년 7월~12월 기간 내 입사 중이거나 예정인 대학생'), null);
  eq('  나이 요건이 붙은 줄도', okOf('30세 미만 대학생(기준일: 2026년 1월 1일)'), null);
  eq('  안내 문장도 (요건이 아니다)', okOf('대학생 본인은 타 지역에 주소를 두고 있어도 신청 가능'), null);
  /* 그러면서도 **학위 이야기뿐인 줄**은 여전히 충족이다 — 그게 이 축의 쓸모다.
     ⚠️ 한국장학재단의 구분 칸(`전문대(2~3년제) 4년제(…)`)은 여기까지 오지도 않는다 —
        `requirementLines` 가 코드 나열로 보고 먼저 걷어낸다(실측). 그건 그 필터의 몫이다. */
  eq('학위 이야기뿐인 줄은 충족이다', okOf('정규대학생'), 'ok');
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
  /* 🔴 **2026-09-09 에 이 항목의 판정 방식을 바꿨다 — 약화가 아니라 강화다.**
     원래는 `names` 가 비어 있는지만 봤다. 이 항목이 막으려던 것은 `SW관련` 을 학과명으로 집어
     **엉뚱한 미달**을 내는 것이었는데, 이름을 아예 안 집으니 **학과 축이 통째로 사라져**
     아무 학과 학생이나 그 줄에 ✓ 를 받았다(영어학과 학생이 SW 관련학과 줄에 충족으로 떴다).
     지금은 **흐린 이름(fuzzy)** 으로 담는다 — 맞으면 ✓, 어긋나면 '모른다'. 미달은 여전히 안 낸다.
     그래서 여기서는 이름의 모양이 아니라 **판정**을 본다(그게 원래 지키려던 것이다). */
  eq('  「관련학과」는 흐린 이름으로 담는다', (of('SW 관련학과 2026-2학기 등록 기준 2학년 재학생') || {}).fuzzy, true);
  eq('  그래도 남의 학과에 미달을 내지 않는다 (모른다)',
    mark('SW 관련학과 2026-2학기 등록 기준 2학년 재학생'), null);
  eq('  그리고 아무 학과나 충족이 되지도 않는다',
    mark('SW 관련학과 2026-2학기 등록 기준 2학년 재학생') === 'ok', false);
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

  /* ④ 계열 낱말을 지명·학교 이름에서 줍지 않는다 — 전수 대조에서 실제로 틀렸던 줄이다 */
  eq('「경상남도」는 상경계열이 아니다', of('경상남도 청년 기본 조례에 따른 39세 이하'), null);
  eq('  대회 입상은 우리가 묻지 않는다 (계열만 맞았다고 ✓ 를 치면 안 된다)',
    mark('예체능(미술/음악/체육/기타) 분야에 소질과 재능이 뛰어나고 전국대회에서 입상한 자',
      { track: 'arts' }), null);

  /* ⑤ 교환학생도 온보딩에서 묻는다 — 안 읽으면 계열만 맞고 파견 조건이 안 보인다 */
  const ex = '모교의 교환학생 선발 과정을 통과하여 美 대학에 2027년 봄학기부터 최초 파견 시작 예정인 이공계 학부생';
  eq('교환학생 파견 예정이면 충족', mark(ex, { track: 'engineering', exchange: true }), 'ok');
  eq('  아니면 판정하지 않는다 (계열만 맞았다고 ✓ 를 치지 않는다)',
    mark(ex, { track: 'engineering', exchange: false }), null);
  eq('  「교환학생/방송대학생 별도 문의」는 요건이 아니다',
    mark('교환학생/방송대학생 별도 문의의', { exchange: true }), null);

  /* ⑥ 🔴 확신이 낮은 미달은 **사라지지 않고 '모른다'** 가 된다.
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
    const src = readText(new URL(f, dir))
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
    const src = readText(new URL(f, wdir));
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

  /* ── 접수 시작일 · 발표일 (2026-09-07 · 캘린더 UI-21) ──
     🔴 이 둘은 마감일과 **같은 줄**에서 와야 한다. 끝을 못 읽는 줄에서 시작만 주우면
        접수 시작일이 다른 줄의 것이 된다 — 실제로 그렇게 2건이 틀렸다(코드 리뷰에서 잡음). */
  const O = (s) => EX.extractOpenDate(s);
  const A = (s) => EX.extractAnnounce(s);

  eq('기간 줄에서 시작일을 읽는다', O('신청기간 : 2026. 7. 30(목) ~ 8. 7(금) 13:00'), '2026-07-30');
  eq('끝을 못 읽는 줄에서는 시작일도 읽지 않는다',
    O('○ 모집기간: 2026.06.29. ~ 상시신청'), null);
  eq("'선발 완료시'도 마찬가지다", O('신청기간: 2026. 8. 10.(월) ~ 선발 완료시 까지'), null);
  eq('같은 날 안의 시각 범위는 접수 기간이 아니다',
    O('신청기간: 2026. 8. 24.(월) 10:00 ~ 18:00'), null);
  eq('날짜 하나뿐이면 그것은 마감이지 시작이 아니다',
    O('□ 지원기간: 2026. 7. 22.(수) 16시까지'), null);
  eq('기간을 말하지 않는 이름표는 안 읽는다', O('근로기간: 2026. 9. 1. ~ 2027. 2. 12.'), null);

  eq('발표 이름표 뒤의 날짜를 읽는다', A('○ 선발발표 : 2026. 8. 26.(수)'), '2026-08-26');
  eq('결과 통보도 발표다', A('4. 결과 통보: 2026-09-15'), '2026-09-15');
  /* 🔴 `발표` 는 뜻이 여럿이다 — 행사 일정을 발표일로 읽으면 학생이 헛되이 결과를 보러 간다 */
  eq('성과 발표회는 발표일이 아니다', A('성과 발표회 : 2026. 10. 5.(월)'), null);
  eq('면접 발표 순서도 아니다', A('면접 발표 순서 : 2026. 9. 9.(수)'), null);
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
  /* 🔴 그 안전판은 읽을 때의 것이다 — 잴 때는 끌 수 있어야 한다 (2026-09-15).
     끄는 길이 없으면 빈 본문이 메뉴 분량으로 '있음'이 된다(notice-source 주석). */
  eq('  잴 때는 안전판을 끄고 남은 것만 돌려준다',
    stripBoilerplate('가\n나\n다', allBoiler, { fallback: false }), '');
}

/* ── 신청서 질문 방식 최적화 (2026-08-18 개발자 지시) ──────────────
   지키려는 것: **묻는 방식만 바꾸고 문서는 그대로.** 아래가 깨지면 학생이
   같은 것을 신청서마다 다시 쓰거나(자동 채움 끊김), 성별에 남·여를 둘 다
   체크할 수 있게 되거나(단일 선택 끊김), 문서에 빈 칸이 나간다. */
console.log('\n■ 신청서 질문 설계기 (form-plan.js)');
{
  const FP = await import(new URL('../form-plan.js', import.meta.url));
  const T = JSON.parse(readText(new URL('../data/forms.json', import.meta.url))).templates;

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
  const audit = readText(new URL('../verify/audit-data.js', import.meta.url));
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
    const src = readText(new URL(f, root));
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

  /* 🔴 2026-09-15 — **안전판이 빈 본문을 '있음'으로 뒤집었다** (노션 UI-10 · F-9).
     메뉴 걷어내기의 안전판('다 지워지면 원문을 그대로 돌려준다')은 읽을 때의 것인데
     잴 때도 걸려서, 본문이 그림뿐인 경희대 공고의 메뉴 1,400자가 본문 분량으로 세어졌다.
     재수집 로봇은 그걸 '본문 확보 ✅'라고 적었고 발췌기·금액 로봇은 메뉴를 읽었다.
     아래 셋은 그 경위의 세 조각이다 — 하나라도 되돌리면 껍데기가 다시 통과한다. */
  {
    /* ⚠️ 픽스처 크기가 곧 검사다 (코드 리뷰 2026-09-15 — 처음 판은 셋이 옛 코드에서도 통과했다).
       메뉴는 **한글 100자를 넘겨야** 안전판이 되돌린 메뉴가 '본문 있음'이 되고, 제목은 정규화
       뒤 **10자를 넘겨야** 제목 규칙이 켜진다. 줄이면 검사가 문턱만 재고 규칙은 안 잰다. */
    const menuK = ['로그인', '사이트맵', '학사일정', '전체메뉴', '개인정보처리방침', '찾아오시는길',
      '대학 입학 연구 교류 대학생활 교육 발전기금 웹메일 인포 채용시스템',
      '공지사항 커뮤니티 학생지원 장학 도서관 박물관 정보서비스 미디어',
      '대학소개 총장인사말 연혁 상징 비전 캠퍼스안내 부속기관 규정집',
      '학사안내 수강신청 성적 졸업 학적변동 교직 복수전공 부전공 안내'];
    const menuKo = menuK.join('').replace(/[^가-힣]/g, '').length;
    eq('  (픽스처) 메뉴가 문턱을 넘긴다', menuKo >= 100, true);
    const titleK = (n) => `${n}번째 공고 — 2026학년도 2학기 장학생 선발 안내문`;
    eq('  (픽스처) 제목이 제목 규칙의 최소 길이를 넘긴다', NS.normTitle(titleK(1)).length >= 10, true);
    const shellK = (n, extra) => ({ url: `https://k.ac.kr/view?id=${n}`, title: titleK(n),
      text: [...menuK, titleK(n), `2026-09-0${n}조회수 15${n}`, ...(extra || [])].join('\n') });
    /* ① 메뉴 밑에 제목·조회수뿐인 페이지 넷 — 걷어내면 120자가 안 돼 안전판이 켜지는 크기다.
          안전판이 잴 때도 켜지면 메뉴 100자+가 본문이 돼 true 로 돌아간다. */
    const i5 = NS.indexTexts([1, 2, 3, 4].map((n) => shellK(n)), {});
    eq('메뉴를 걷어낸 뒤 남는 것이 제목뿐이면 원문으로 세지 않는다',
      NS.hasText(i5.byUrl.get(NS.canonUrl('https://k.ac.kr/view?id=1'))), false);
    /* ② 저장된 bodyChars 를 믿지 않는다 — 옛 규칙으로 잰 값이 파일에 남아 있다 */
    const stale = [1, 2, 3, 4].map((n) => ({ ...shellK(n), bodyChars: 1400 }));
    const i6 = NS.indexTexts(stale, {});
    eq('  파일에 남은 옛 본문 분량을 믿지 않고 다시 잰다',
      NS.hasText(i6.byUrl.get(NS.canonUrl('https://k.ac.kr/view?id=1'))), false);
    /* ③ 이전글·다음글 줄은 다른 공고의 제목이다 — 본문으로 세지 않는다.
          다른 공고 제목 넷(한글 90자+)과 자기 제목만으로 100자를 넘기게 해서, 제목 규칙이
          꺼지면 true 로 돌아가게 한다(메뉴는 이미 걷어내진 상태라 안전판과 무관하다). */
    const nav = [1, 2, 3, 4].map((n) => shellK(n, [1, 2, 3, 4].filter((m) => m !== n).map(titleK).concat([`[공통] ${titleK(((n + 1) % 4) + 1)}`])));
    const i7 = NS.indexTexts(nav, {});
    eq('  이전글·다음글(다른 공고 제목) 줄은 본문으로 세지 않는다',
      NS.hasText(i7.byUrl.get(NS.canonUrl('https://k.ac.kr/view?id=1'))), false);
    /* ④ 브라우저가 그린 판에만 있는 메뉴도 따로 배운다 — 한 통에 섞으면 비율 문턱에 못 미친다.
          브라우저 메뉴만으로 한글 100자를 넘겨야, 따로 배우지 않으면 true 로 돌아간다. */
    /* 본문은 공고마다 달라야 한다 — 같은 문장을 일곱 쪽에 넣으면 그게 메뉴로 배워진다(실제로 그랬다) */
    const plain = [1, 2, 3, 4, 5, 6, 7].map((n) => shellK(n, real.split('\n').map((l) => `${l} — ${n}번 공고만의 문장`)));
    const browserMenu = ['일반 학사 장학 근로 시간표 변경 교내학점교류 행사 채용 국제교류 취업',
      '서울캠퍼스 서울특별시 동대문구 경희대로 국제캠퍼스 경기도 용인시 기흥구 덕영대로 광릉캠퍼스 남양주시',
      '개인정보처리방침 이메일무단수집거부 교내전화번호 대학정보공시 예결산공고 입찰공고 관련기관',
      '확대 축소 프린트 주소복사 목록 이전글 다음글 파일첨부 작성자 조회수 등록일 담당부서'];
    eq('  (픽스처) 브라우저 메뉴가 문턱을 넘긴다', browserMenu.join('').replace(/[^가-힣]/g, '').length >= 100, true);
    const bBodies = {};
    for (const n of [8, 9, 10]) bBodies[`https://k.ac.kr/view?id=${n}`] = { title: titleK(n), text: [...browserMenu, titleK(n)].join('\n'), via: 'rescue' };
    const i8 = NS.indexTexts(plain, bBodies);
    eq('  브라우저 판에만 있는 메뉴 줄도 걷어낸다(말뭉치별로 따로 배운다)',
      NS.hasText(i8.byUrl.get(NS.canonUrl('https://k.ac.kr/view?id=8'))), false);
    eq('    본문이 딸린 일반 수집분은 그대로 통과',
      NS.hasText(i8.byUrl.get(NS.canonUrl('https://k.ac.kr/view?id=1'))), true);
  }

  /* 🔴 2026-08-23 — **줄바꿈을 없애면 본문이 있으나 마나다.** 재수집 로봇을 처음
     만들 때 태그를 벗기고 `\s+ → ' '`로 눌렀더니 본문이 통짜 한 줄이 됐고,
     ① AI가 줄 번호를 못 매겨 대상에서 빠지고 ② 표의 칸 구분(공통/재학생/신규자)이
     통째로 사라졌다 — 이 작업의 핵심이 그 구조를 살리는 것인데 받는 자리에서 죽였다.
     37건을 그렇게 저장했다가 전부 다시 받았다. */
  const rb = readText(new URL('collector/rescue-bodies.mjs', root));
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
  /* 🔴 브라우저 본문도 같이 넣는다 (2026-09-15 코드 리뷰) — 메뉴는 브라우저 판에서도 따로 배우므로
     이 한 건만 넣으면 표본이 없어 '여기선 확보, 발췌기에선 껍데기'로 갈린다(의암 손병희 163자 vs 85자). */
  eq('  본문 판정은 발췌기와 같은 말뭉치로 한다 (브라우저 본문 포함)', /indexTexts\(texts, \{ \.\.\.bodies, \[t\.url\]/.test(rb), true);
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
  const bc = readText(new URL('collector/browser-collect.mjs', root));
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
    .map((f) => ({ f, t: readText(new URL(f, dir)) }))
    .filter((x) => /node collector\/(collect|deepfetch|browser-collect|rescue-bodies|link-hunter|resolve-detail-urls|eligibility-ai|extract-excerpts)/.test(x.t));
  const missing = need.filter((x) => !/NODE_EXTRA_CA_CERTS/.test(x.t)).map((x) => x.f);
  eq(`수집 로봇을 부르는 워크플로 ${need.length}개가 모두 인증서 설정을 갖고 있다`, missing.join(',') || '(없음)', '(없음)');
  /* 검증을 끄는 것과 혼동하지 말 것 — 그건 아무 서버나 믿겠다는 뜻이다 */
  const unsafe = need.filter((x) => /NODE_TLS_REJECT_UNAUTHORIZED|rejectUnauthorized:\s*false/.test(x.t)).map((x) => x.f);
  eq('  인증서 검증을 끄는 워크플로는 없다', unsafe.join(',') || '(없음)', '(없음)');
  /* 오류를 낱말 하나로 뭉개면 원인을 영영 못 본다 — Node fetch 의 진짜 이유는 cause 안에 있다 */
  const df = readText(new URL('../collector/deepfetch.mjs', import.meta.url));
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
  const rep = readText(new URL('../verify/eligibility-report.mjs', import.meta.url));
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
  const kinds = readText(new URL('./eligibility-noise.cjs', import.meta.url));
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
  const aud = readText(new URL('../verify/audit-data.js', import.meta.url));
  eq('감사가 자격 잡음을 오류로 올린다 (경고가 아니라)', /errors\.push\(`registered:\$\{it\.id\} — 지원 자격에 \[/.test(aud), true);
  eq('  화면과 같은 함수로 본다 (감사만 통과하는 일이 없게)', /require\('\.\.\/match-engine\.js'\)/.test(aud), true);
  eq('  조각난 줄은 경고로 둔다 (버리면 진짜 요건을 잃는다)', /자격 줄이 조각나 보입니다/.test(aud), true);
  /* 🔴 원인을 단정하지 않는다 (2026-08-29). 걸린 두 건을 원문과 대조하니 둘 다
     학교가 문장 중간에 줄을 바꾼 것이었는데, 문구는 `(수집 단계)`라고 못 박고 있었다.
     확인 안 한 원인을 적으면 다음 세션이 없는 버그를 쫓는다. */
  eq('    원인을 단정하지 않는다 (수집 탓이라고 적지 않는다)', /상했습니다\(수집 단계\)/.test(aud), false);

  /* 화면 문 자체가 줄마다 '요건임'을 묻는가 — 이게 없으면 좋은 줄에 잡음이 얹혀 간다 */
  const eng = readText(new URL('../match-engine.js', import.meta.url));
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
  const md = readText(new URL('../CLAUDE.md', import.meta.url));
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
    const raw = readText(new URL(`../data/${f}.json`, import.meta.url));
    eq(`data/${f}.json 은 로봇과 같은 들여쓰기(1칸)다`,
       JSON.stringify(JSON.parse(raw), null, 1) === raw.replace(/\n$/, ''), true);
  }
}

console.log('\n■ 링크 사냥꾼의 제목 대조 (2026-08-23)');
{
  const lh = readText(new URL('../collector/link-hunter.mjs', import.meta.url));
  eq('사냥꾼은 수집기와 같은 제목 청소 규칙을 쓴다', /from '\.\/clean-title\.mjs'/.test(lh), true);
  eq('  대조할 제목에서 부스러기를 뗀다', /cleanTitle\(\(t\.ref\.boardTitle/.test(lh), true);
  eq('  받아 적을 때도 떼고 담는다', /boardTitle = cleanTitle\(mate\.title\)/.test(lh), true);
  const CT = await import(new URL('../collector/clean-title.mjs', import.meta.url));
  eq('  분류 배지를 뗀다', /^공지/.test(CT.cleanTitle('공지 공지 2026-2학기 복지장학1(본인장애) 신청안내')), false);
  eq('  행 번호를 뗀다', /^2651/.test(CT.cleanTitle('2651 2026-2학기 부남장학생 선발 안내')), false);
  /* 저장된 값에도 부스러기가 남아 있으면 안 된다 — 대조는 저장된 값으로 한다 */
  const regd = JSON.parse(readText(new URL('../data/registered.json', import.meta.url)));
  const dirty = (regd.items || regd).filter((x) => x.boardTitle && CT.cleanTitle(x.boardTitle) !== x.boardTitle);
  eq('  저장된 boardTitle 에도 부스러기가 없다', dirty.length, 0);

  /* 🔴 **사냥꾼은 저장 전에 중복을 합쳐야 한다** (2026-09-05 — 열흘치 결과를 버린 원인).
     사냥꾼은 표식(#n-)을 진짜 주소로 바꾸는 로봇이라, 같은 글이 서로 다른 표식으로 두 번
     담겨 있으면 **둘 다 같은 주소로 풀리며 그 순간 중복이 된다**(수집 때는 없던 중복이다).
     그 중복 하나 때문에 저장 직전 감사가 `실시간 공고에 중복 1건`으로 떨어지고,
     워크플로는 `steps.audit.outcome == 'success'` 일 때만 저장하므로 **사냥해 온 주소를
     통째로 되돌린다.** 2026-09-03 실행이 정확히 그랬고(주소를 찾아 놓고 전량 폐기),
     2026-09-05 에 손으로 돌렸을 때도 동국대 고졸후학습자 2건이 같은 주소로 풀려 재현됐다.
     ⚠️ 합치기는 수집기와 **같은 함수**여야 한다 — 베끼면 '수집기는 합치는데 사냥꾼은
     안 합치는' 갈라짐이 그대로 돌아온다. */
  /* ⚠️ **가져오는 이름까지 못 박는다** — `url-key.mjs 에서 뭐라도 가져오는가`만 보면
     같은 파일에서 urlKey 만 가져오고 dedupeNotices 를 **파일 안에 베껴 두는** 우회가 통과한다
     (2026-09-05 리뷰에서 실제로 뚫렸다). 베끼면 막으려던 갈라짐이 그대로 돌아온다. */
  eq('  사냥꾼도 수집기와 같은 중복 합치기를 쓴다',
    /import \{[^}]*\bdedupeNotices\b[^}]*\} from '\.\/url-key\.mjs'/.test(lh), true);
  eq('    베껴 두지 않는다 (같은 파일에 정의가 또 있으면 안 된다)',
    /function dedupeNotices\s*\(/.test(lh), false);
  {
    /* ⚠️ 함수 본문을 `indexOf('\nfunction ', 1)` 로 자르지 말 것 — saveAll 이 **파일의 마지막
       함수**라 그 검색이 `-1` 을 돌려주고, `slice(0, -1)` 은 본문이 아니라 **파일 끝까지**가 된다.
       그러면 "저장 경로에서 부른다"가 아무것도 증명하지 못한다(2026-09-05 리뷰에서 확인). */
    const save = lh.slice(lh.indexOf('function saveAll'));
    const end = save.indexOf('\n}\n');
    eq('    saveAll 본문을 제대로 잘랐다 (자르기가 깨지면 아래가 무의미해진다)', end > 0, true);
    const body = save.slice(0, end);
    /* 🔴 **대입까지** 본다 — `dedupeNotices(notices.items);` 는 호출만 하고 결과를 버려
       아무 일도 안 하는데, 호출 여부만 세면 그대로 통과한다(리뷰에서 뚫린 두 번째 길). */
    const dedupeAt = body.indexOf('notices.items = dedupeNotices(notices.items)');
    const writeAt = body.indexOf('writeFileSync(noticesPath');
    eq('    저장 경로에서 결과를 실제로 되받는다', dedupeAt >= 0, true);
    eq('    쓰기보다 먼저 합친다 (뒤면 중복이 그대로 저장된다)',
      dedupeAt >= 0 && writeAt >= 0 && dedupeAt < writeAt, true);
  }
  /* 🔴 **워치독** — 예산을 넘기면 어디서 매달려 있든 스스로 저장하고 끝내야 한다.
     이게 없으면 timeout 이 프로세스를 죽여 그 회차 결과가 통째로 사라지고, 그러면
     link-hunt.json 이 안 남아 실패 간격(nextTryAt)까지 안 밀린다(위 워크플로 주석 참조). */
  eq('  예산을 넘기면 스스로 저장하고 끝낸다 (워치독)', /setTimeout\(\(\) => \{[\s\S]{0,600}?saveAll\(/.test(lh), true);
  eq('    정상 종료를 붙들지 않는다 (unref)', /watchdog\.unref\(\)/.test(lh), true);
}

console.log('\n■ 서비스하지 않는 학교의 공고는 피드에 안 담는다 (2026-09-05)');
{
  /* 🔴 2026-08-30 에 수집을 경희대·한국외대 둘로 좁혔는데 **예전에 담긴 다른 학교 공고가
     그대로 남아** 있었다 — 실측 200건 중 173건(87%)이 그것이었다. 로봇이 그걸 붙들고 일한다.
     ⚠️ **'상한을 차지해 새 공고를 밀어낸다'고 적지 말 것 — 재 보니 사실이 아니었다**
     (2026-09-05 리뷰). capNotices 의 전체 상한은 `max(200, 학교수 × 15)` 라 죽은 학교가
     많을수록 상한이 **커진다**: 35개교일 때 525 라 200건은 한 건도 안 잘렸고,
     새 공고 30건을 얹어도 30건 전부 살아남았다(실측). 이득은 다른 데 있다 —
     폰이 받는 파일 120KB → 14KB · 사냥꾼 순찰 후보 237 → 72건 · 표적 게시판 3 → 0곳.
     ⚠️ 목록은 화면·알림과 **같은 것**(match-engine 의 SERVED_SCHOOLS)을 쓴다 — 베끼면
     '화면은 안 보여 주는데 로봇은 계속 모으는' 어긋남이 그대로 돌아온다. */
  const { dropUnserved } = await import(new URL('../collector/publish-notices.mjs', import.meta.url));
  const ME = await import(new URL('../match-engine.js', import.meta.url));
  const served = ME.default ? ME.default.SERVED_SCHOOLS : ME.SERVED_SCHOOLS;
  const got = dropUnserved([
    { school: served[0], title: 'ㄱ' }, { school: '동국대학교', title: 'ㄴ' },
    { school: served[1], title: 'ㄷ' }, { title: '학교 없음' }, null,
  ]);
  eq('서비스 학교만 남긴다', got.map((n) => n.school), [served[0], served[1]]);
  eq('  학교 칸이 빈 공고도 뺀다 (어느 학생에게도 안 보인다)', got.length, 2);

  for (const [name, file] of [['일반 수집', 'collect.mjs'], ['브라우저 수집', 'browser-collect.mjs']]) {
    const src = readText(new URL(`../collector/${file}`, import.meta.url));
    /* ⚠️ **대입까지 본다** — `const _unused = dropUnserved(notices.items);` 는 결과를 버려
       아무 일도 안 하는데, 호출만 세면 그대로 통과한다(2026-09-05 리뷰에서 실증).
       바로 앞 커밋 69113d0 이 다른 관문에서 배운 것과 같은 유형이다. */
    eq(`  ${name} 로봇이 이것을 쓴다 (결과를 되받는다)`,
      /notices\.items\s*=\s*dropUnserved\(notices\.items\)/.test(src), true);
    eq('    가져다 쓴다 (베끼지 않는다)',
      /import \{[^}]*\bdropUnserved\b[^}]*\} from '\.\/publish-notices\.mjs'/.test(src), true);
    /* 🔴 **자르기·발행보다 먼저** 떨궈야 뜻이 있다 — 뒤에 두면 이미 상한을 차지한 뒤다 */
    const dropAt = src.search(/notices\.items\s*=\s*dropUnserved\(notices\.items\)/);
    const pubAt = src.indexOf('publishBySchool(beforeCap)');
    const capAt = src.indexOf('capNotices(notices.items)');
    eq('    학교별 발행보다 먼저 떨군다', dropAt >= 0 && pubAt > dropAt, true);
    eq('    전체 상한을 매기기 전에 떨군다', dropAt >= 0 && capAt > dropAt, true);
  }
  /* 데이터에도 남아 있지 않아야 한다 — 소급 적용 원칙(운영 원칙 7) */
  const feed = JSON.parse(readText(new URL('../data/notices.json', import.meta.url)));
  eq('  지금 피드에 서비스 밖 학교가 없다', dropUnserved(feed.items).length, feed.items.length);
}

console.log('\n■ 주소를 고치는 로봇은 학교별 파일까지 고친다 (2026-09-05)');
{
  /* 🔴 앱이 읽는 것은 `data/notices.json` 이 아니라 `data/notices/<학교>.json` 이다
     (2026-08-17 분리). 주소를 고치는 로봇 둘(링크 사냥꾼·원문 링크 복구)이 옛 파일만
     고치고 있어서, **고친 주소가 다음 수집까지 학생 화면에 안 닿았다.**
     실측(2026-09-05): 학교별 파일에 표식(#n-)이 38건 남아 있었고 그중 15건은
     `notices.json` 에서는 이미 진짜 주소로 고쳐진 것이었다.

     🔴 **재발행(publishBySchool)으로 고치면 더 나빠진다** — 수집기는 `capNotices` 로
     자르기 **전** 목록을 발행하는데 이 로봇들이 든 것은 이미 잘린 목록이라, 재발행하면
     학교별 파일이 전체 상한만큼 **줄어든다**. 그래서 `patchUrlsBySchool` 로 그 자리만 고친다. */
  for (const [name, file] of [['링크 사냥꾼', 'link-hunter.mjs'], ['원문 링크 복구', 'resolve-detail-urls.mjs']]) {
    const src = readText(new URL(`../collector/${file}`, import.meta.url));
    eq(`${name}은 학교별 파일도 고친다`, /patchUrlsBySchool\(/.test(src), true);
    eq('  가져다 쓴다 (베끼지 않는다)',
      /import \{[^}]*\bpatchUrlsBySchool\b[^}]*\} from '\.\/publish-notices\.mjs'/.test(src), true);
    /* ⚠️ 재발행은 금지 — 위 주석 참조. 이 검사가 그 실수를 막는 유일한 자리다. */
    /* ⚠️ **괄호를 붙여 `publishBySchool\(` 로 찾지 말 것** — `import { publishBySchool as
       republish }` 로 이름만 바꿔 부르면 그대로 통과한다(2026-09-05 리뷰에서 실증).
       이 두 로봇은 재발행할 이유가 없으므로 **낱말이 나오는 것 자체**를 막는다. */
    eq('  재발행하지 않는다 (부르면 학교별 파일이 551→200 으로 줄어든다)',
      /publishBySchool/.test(src), false);
    /* 고치는 것은 **쓴 뒤**여야 한다 — notices.json 을 쓰기 전에 고치면 옛 값으로 고친다 */
    const writeAt = src.indexOf('writeFileSync(noticesPath');
    const patchAt = src.indexOf('patchUrlsBySchool(');
    eq('  notices.json 을 쓴 뒤에 고친다', writeAt >= 0 && patchAt > writeAt, true);
  }
  /* 🔴 고쳐도 `git add` 에 없으면 저장되지 않는다 (이슈 #79 계열) */
  for (const wf of ['link-hunter', 'resolve-detail-urls']) {
    const y = readText(new URL(`../.github/workflows/${wf}.yml`, import.meta.url));
    /* ⚠️ **처음 만나는 한 줄만 보지 말 것** — 워크플로에 git add 가 하나 더 생기면
       조용히 엉뚱한 줄을 검사한다. 전부 모아서 본다. */
    const lines = y.split('\n').filter((l) => /^\s*git add /.test(l));
    eq(`  ${wf} 워크플로에 git add 가 있다`, lines.length > 0, true);
    eq(`  ${wf} 워크플로가 data/notices 를 저장한다`,
      lines.some((l) => /\bdata\/notices\b(?!\.json)/.test(l)), true);
  }

  /* 🔴 **글자만 훑지 말고 실제로 돌려 본다** (2026-09-05 리뷰 지적).
     위 정적 검사들은 `patchUrlsBySchool([])`(무동작)이나 죽은 가지도 통과시킨다 —
     '부르는가'는 '하는가'가 아니다. CLAUDE.md 매 세션 3번·메모리 verify-the-gate-itself 가
     이름 붙인 유형이라, 임시 폴더에 진짜 파일을 두고 함수를 불러 결과를 잰다. */
  {
    const os = await import('node:os');
    const pathMod = await import('node:path');
    const { patchUrlsBySchool } = await import(new URL('../collector/publish-notices.mjs', import.meta.url));
    const dir = fs.mkdtempSync(pathMod.join(os.tmpdir(), 'notices-'));
    const dirUrl = new URL(`file://${dir}/`);
    const before = {
      school: '경희대학교',
      items: [
        { school: '경희대학교', title: '두을장학재단 제29기 장학생 모집', url: 'https://x/list#n-두을' },
        { school: '경희대학교', title: '학교별 파일에만 있는 옛 공고', url: 'https://x/list#n-옛것' },
      ],
    };
    fs.writeFileSync(new URL('n1.json', dirUrl), JSON.stringify(before, null, 1));
    fs.writeFileSync(new URL('index.json', dirUrl), JSON.stringify({ files: {} }, null, 1));
    fs.writeFileSync(new URL('broken.json', dirUrl), '{ 깨진 파일');

    const r = patchUrlsBySchool([
      { school: '경희대학교', title: '두을장학재단 제29기 장학생 모집', url: 'https://x/view?id=322949' },
    ], { dir: dirUrl });

    const after = JSON.parse(readText(new URL('n1.json', dirUrl)));
    eq('  진짜로 고친다 (표식 → 진짜 주소)', after.items[0].url, 'https://x/view?id=322949');
    eq('    고친 건수를 돌려준다', r.fixed, 1);
    /* 🔴 **줄지 않는다** — 재발행으로 바꾸면 여기서 걸린다. 이 한 줄이 551→200 축소를
       막는 진짜 방어선이다(정적 검사는 이름만 바꿔도 뚫린다). */
    eq('    항목 수가 줄지 않는다 (재발행이면 여기서 걸린다)', after.items.length, before.items.length);
    eq('    대응이 없는 옛 공고는 건드리지 않는다', after.items[1].url, 'https://x/list#n-옛것');
    eq('    색인은 건드리지 않는다', JSON.parse(readText(new URL('index.json', dirUrl))).files ? true : false, true);
    /* 같은 주소면 다시 쓰지 않는다 — 무의미한 커밋을 만들지 않는다 */
    eq('    바뀔 것이 없으면 파일을 안 쓴다', patchUrlsBySchool([
      { school: '경희대학교', title: '두을장학재단 제29기 장학생 모집', url: 'https://x/view?id=322949' },
    ], { dir: dirUrl }).files, 0);
    /* 폴더가 없어도 넘어지지 않는다 (새 클론·첫 실행) */
    eq('    폴더가 없어도 넘어지지 않는다',
      patchUrlsBySchool([], { dir: new URL(`file://${dir}/없는폴더/`) }).fixed, 0);
    fs.rmSync(dir, { recursive: true, force: true });
  }
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
    const src = readText(new URL('../' + f, import.meta.url));
    eq(`  ${f.split('/').pop()} 는 공용 규칙을 쓴다`, /looksLikeList[^\n]*detail-url|looksLikeList\s*\}/.test(src), true);
    eq(`  ${f.split('/').pop()} 에 복사본이 없다`, /function looksLikeList/.test(src), false);
  }
}

/* 2026-08-20 — 중간 인증서를 안 보내는 학교(계명대) 때문에 Node만 연결이 막히던 문제 */
console.log('\n■ 학교가 빠뜨린 중간 인증서 (2026-08-20)');
{
  const root = new URL('../', import.meta.url);
  const pem = readText(new URL('collector/certs/sectigo-server-auth-dv-r36.pem', root));
  eq('중간 인증서가 저장소에 있다', /BEGIN CERTIFICATE/.test(pem), true);
  for (const f of ['.github/workflows/collect-scholarships.yml', '.github/workflows/browser-collect.yml']) {
    const yml = readText(new URL(f, root));
    eq(`  ${f.split('/').pop()} 가 그 인증서를 쓴다`, /NODE_EXTRA_CA_CERTS:\s*collector\/certs\//.test(yml), true);
    /* 🔴 검증을 끄는 것이 아니다 — 이게 들어오면 아무 서버나 믿게 된다 */
    eq(`  ${f.split('/').pop()} 가 인증서 검증을 끄지 않는다`,
      /NODE_TLS_REJECT_UNAUTHORIZED|rejectUnauthorized:\s*false/.test(yml), false);
  }
  for (const f of ['collector/deepfetch.mjs', 'collector/collect.mjs', 'collector/browser-collect.mjs']) {
    const src = readText(new URL(f, root));
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
  const cfg = JSON.parse(readText(new URL('../collector/eligibility-ai-config.json', import.meta.url)));
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
  const xs = readText(new URL('../collector/extract-excerpts.mjs', import.meta.url));
  /* 🔴 AI 뿐 아니라 **사람이 고른 줄도** 건드리면 안 된다 (2026-09-14).
     관리자 화면이 `eligibilityFrom = '관리자 <날짜>'` 를 붙이는데 발췌기가 안 읽어,
     사람이 고른 자격 문장이 다음 수집에 통째로 지워지고 **이름표만 남았다** —
     그러면 로봇이 다시 채울 때 로봇 줄에 관리자 이름이 붙는다(거짓 출처 · 원칙 8-1).
     그래서 둘 다 지키는지 본다. 한쪽만 남기면 그쪽이 다시 지워진다. */
  eq('  발췌기는 AI가 읽은 자격을 건드리지 않는다',
    /\.test\(it\.eligibilityFrom/.test(xs) && /\^\(?AI/.test(xs), true);
  eq('  발췌기는 사람이 고른 자격도 건드리지 않는다', /관리자\)?\/\.test\(it\.eligibilityFrom/.test(xs), true);
  /* ⚠️ 그 가드는 **for 반복문 안**이라 continue 여야 한다 — return 을 쓰면 그 뒤 공고를
     전부 건너뛴다(실제로 return 으로 썼다가 잡았다). */
  eq('    그 가드는 continue 다 (return 이면 나머지 공고를 다 건너뛴다)',
    /eligibilityFrom \|\| ''\)\) \{ kept \+= 1; continue; \}/.test(xs), true);
  /* 🔴 **첨부 경로에 2차(scoop)를 붙이지 말 것** (2026-09-04 — 붙였다가 되돌린 자리).
     "본문 경로는 두 겹인데 첨부 경로는 1차뿐이니 대칭을 맞추자"는 생각이 자연스러워서
     다음 사람이 또 붙인다. 붙이면 무슨 일이 나는지는 extract-excerpts.mjs 의
     qualFromDocs 첫머리에 실측으로 적혀 있다 — 요강 전문(888줄·분야 5종)에서
     **한 분야의 성적 기준이 공고 전체 요건으로 승격돼 틀린 「지원 자격 미달」이 떴다.**
     얻은 공고 0건, 잃은 것 1건. 품질·자리·유형 축 셋 다 못 잡았다. */
  /* 🔴 **자리를 못 박는다 — 개수만 세면 옮기기로 뚫린다** (2026-09-04 리뷰에서 실증).
     되돌린 버그(첨부 경로의 2차)를 넣으면서 합계 3을 유지하는 길이 둘 있었다:
       ① 본문 경로에서 빼고 qualFromDocs 로 **옮긴다**      → 합계 3, 초록불
       ② qualFromDocs 에 넣고 export 에서 뺀다("내부용")   → 합계 3, 초록불
     그래서 개수(간접 헬퍼용)와 **자리 두 곳**을 함께 본다. 본문 경로는 `(body)` 로,
     첨부 경로는 `(t)` 로 부르므로 인자 이름이 그대로 자리 표식이 된다. */
  {
    /* 줄 끝 주석까지 걷어낸다 — 행 첫머리 주석만 걷으면 `const x = 1;  (줄 끝 주석)`
       안에 든 낱말이 세어져, 평범한 편집 하나가 합계를 늘려 **거짓 실패**를 냈다(리뷰 실측).
       콜론 뒤 두 빗금(주소의 스킴 구분자)은 건드리지 않는다 — 주소가 잘려 나가면 안 된다. */
    const code = xs.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
    /* 지금 자리 셋: 정의 · export · 본문 경로 호출. 늘었으면 **왜 늘었는지 보고** 정한다 —
       정당한 호출이 새로 생긴 것일 수도, 우회 헬퍼일 수도 있다(원인을 여기서 단정하지 않는다). */
    eq('  scoop 이 나오는 자리는 셋뿐 (정의·export·본문 경로 호출)',
      (code.match(/scoopQualifyLines\b/g) || []).length, 3);
    /* ①을 막는다 — 본문 경로의 그 호출이 제자리에 있어야 한다 */
    eq('    본문 경로가 2차로 물러나는 자리는 그대로다',
      /\?\s*extractQualifyLines\(body\)\s*:\s*scoopQualifyLines\(body\);/.test(code), true);
    /* ②를 막는다 — 첨부 경로는 `(t)` 로 부른다. 1차는 있고 2차는 없어야 한다.
       ⚠️ `function qualFromDocs[\s\S]*?extractQualifyLines\(` 로 쓰지 말 것 — 게으른
       무한 매칭이라 함수에서 1차를 통째로 지워도 **아래 본문 경로에 걸려 통과한다**(실증). */
    eq('    첨부 경로는 1차(t)를 쓴다', /extractQualifyLines\(t\);/.test(code), true);
    eq('    첨부 경로는 2차(t)로 물러나지 않는다', /scoopQualifyLines\(t\)/.test(code), false);
  }
  /* 🔴 이 경로는 출처를 **'AI(공고문 PDF)'**로 남겨 번호 경로와 구분한다 —
     화면 표식은 같지만, 나중에 되짚을 때 어느 계약으로 들어온 글자인지 알아야 한다. */
  const src = readText(new URL('../collector/eligibility-ai.mjs', import.meta.url));
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
  const wf = readText(new URL('../.github/workflows/eligibility-fill.yml', import.meta.url));
  eq('      줄이는 도구가 워크플로에 설치된다', /npm i @anthropic-ai\/sdk sharp/.test(wf), true);
  const dfx = readText(new URL('../collector/deepfetch.mjs', import.meta.url));
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
  const df = readText(new URL('../collector/deepfetch.mjs', import.meta.url));
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
  /* ②-2 🔴 HWPX 조각 안의 자식 태그를 벗긴다 (2026-09-15 — 익산사랑 장학생 공고문).
        `<hp:t>` 안에 `<hp:sz …/>` 가 와서 `3. 지급액 및 접수 방법 <hp:sz width=…` 처럼
        태그가 글자에 섞여 나왔고 금액·자격 규칙이 한 줄도 못 읽었다. 저장된 실제 파일로 잰다. */
  {
    /* 저장된 파일에 기대지 않는다 — `deepfetch --elig-attach` 가 elig-* 를 갈아엎으면 검사가
       조용히 건너뛴다(코드 리뷰). 압축(저장 방식 0)만 쓴 HWPX 를 검사 안에서 만든다. */
    const storedZip = (entries) => {
      const locals = [], centrals = []; let off = 0;
      for (const { name, data } of entries) {
        const n = Buffer.from(name), d = Buffer.from(data);
        const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4);
        lh.writeUInt32LE(d.length, 18); lh.writeUInt32LE(d.length, 22); lh.writeUInt16LE(n.length, 26);
        const ch = Buffer.alloc(46); ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6);
        ch.writeUInt32LE(d.length, 20); ch.writeUInt32LE(d.length, 24); ch.writeUInt16LE(n.length, 28); ch.writeUInt32LE(off, 42);
        locals.push(lh, n, d); centrals.push(ch, n); off += 30 + n.length + d.length;
      }
      const cd = Buffer.concat(centrals);
      const eocd = Buffer.alloc(22); eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(entries.length, 8);
      eocd.writeUInt16LE(entries.length, 10); eocd.writeUInt32LE(cd.length, 12); eocd.writeUInt32LE(off, 16);
      return Buffer.concat([...locals, cd, eocd]);
    };
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hwpx-'));
    const file = path.join(dir, 'notice.hwpx');
    fs.writeFileSync(file, storedZip([{ name: 'Contents/section0.xml',
      data: '<hp:p><hp:t>3. 지급액 및 접수 방법 <hp:sz width="49169" widthRelTo="ABSOLUTE"/>대학생 2백만원</hp:t></hp:p>'
        + '<hp:p><hp:t>&lt;참고&gt; 4</hp:t><hp:t>년제 재학생</hp:t></hp:p>' }]));
    const t = AT.attachmentText(file);
    eq('  HWPX 조각 안의 자식 태그를 벗긴다', /<hp:/.test(t), false);
    eq('    태그 자리의 글자는 붙어서 읽힌다', /3\. 지급액 및 접수 방법 대학생 2백만원/.test(t), true);
    eq('    원문의 &lt; 는 글자라 남긴다 · 조각은 붙여 읽는다', /<참고> 4년제 재학생/.test(t), true);
    fs.rmSync(dir, { recursive: true, force: true });
  }
  /* ③ 문단 단위로 이어 붙인다 — 조각마다 줄을 나누면 `4년제`의 `4`가 버려져
        `년제 대학교 재학생`만 남는다(실제로 그렇게 나와서 고쳤다) */
  const docx = fs.readdirSync(new URL('../collector/extracted/', import.meta.url))
    .filter((f) => /^elig-.*\.docx$/.test(f))[0];
  if (docx) {
    const t = AT.attachmentText(fileURLToPath(new URL(`../collector/extracted/${docx}`, import.meta.url)));
    eq('  docx는 문단 단위로 읽어 숫자가 안 빠진다', /\d년제/.test(t) || /\d\.\d\/\d\.\d/.test(t), true);
  } else eq('  (docx 표본 없음 — 건너뜀)', true, true);
  eq('  글자가 거의 없으면 읽을 만하지 않다고 답한다', AT.readable('가나다'), false);

  /* ④ 🔴 **글자 조각 태그를 이름 앞머리로 찾지 말 것** (2026-09-15 · 백로그 G-3 파다가 나옴)
        `<w:t[^>]*>` 는 `<w:t>` 만이 아니라 **이름이 `w:t` 로 시작하는 형제 태그 전부**에
        걸린다 — `<w:tbl>`·`<w:tblPr>`·`<w:tc>`·`<w:tr>`·`<w:trPr>`·`<w:tcW …/>`,
        hwpx 쪽은 `<hp:tc>`·`<hp:tbl>`·`<hp:table>`. 그러면 표가 열리는 자리마다 그 태그를
        '글자'로 읽고 다음 `</w:t>` 까지를 통째로 삼켜, **XML 속성과 글꼴 이름이 본문이 된다.**
        장학 공고는 표투성이라 영향이 컸다 — 저장된 docx·hwpx 23개에서 찌꺼기 줄 2,583줄.
        그 탓에 표 안에 적힌 `신청기간`·`접수` 줄이 태그에 묻혀 마감일 파서가 못 읽었다.
        ⚠️ 잃는 것처럼 보이는 한글은 내용이 아니라 `<w:rFonts w:ascii="나눔고딕">` 의
           **글꼴 이름**이다(실측으로 확인 — 진짜 낱말은 하나도 안 준다).
        🔴 검사는 `xmlDocText` 로 **진짜 함수**를 부른다. 정규식을 여기 베끼면 갈라진다. */
  {
    const docxXml = '<w:tbl><w:tblPr><w:tblW w:w="9354"/></w:tblPr><w:tr><w:trPr/>'
      + '<w:tc><w:tcPr><w:tcW w:w="3118"/></w:tcPr>'
      + '<w:p><w:r><w:rPr><w:rFonts w:ascii="나눔고딕"/></w:rPr>'
      + '<w:t>신청기간</w:t></w:r><w:r><w:t xml:space="preserve"> : 2026.9.1 ~ 9.30</w:t></w:r></w:p>'
      + '</w:tc></w:tr></w:tbl>';
    const got = AT.xmlDocText(docxXml, 'docx');
    eq('  docx — 표 태그를 글자로 읽지 않는다', /<w:|w:w=|w:ascii=/.test(got), false);
    eq('    표 칸 안의 진짜 글자는 그대로 나온다', got.includes('신청기간 : 2026.9.1 ~ 9.30'), true);
    eq('    글꼴 이름이 본문에 섞이지 않는다', got.includes('나눔고딕'), false);

    const hwpxXml = '<hp:tbl><hp:tr><hp:tc name=""><hp:subList id="" textDirection="HORIZONTAL">'
      + '<hp:p><hp:run><hp:t>접수기한</hp:t></hp:run>'
      + '<hp:run><hp:t> : 2026. 9. 30.</hp:t></hp:run></hp:p>'
      + '</hp:subList></hp:tc></hp:tr></hp:tbl>';
    const gotH = AT.xmlDocText(hwpxXml, 'hwpx');
    eq('  hwpx — 표 태그를 글자로 읽지 않는다', /<hp:|textDirection=/.test(gotH), false);
    eq('    표 칸 안의 진짜 글자는 그대로 나온다', gotH.includes('접수기한 : 2026. 9. 30.'), true);

    /* 🔴 hwpx 는 **`<hp:t>` 안에 서식 기호를 넣는다** — 고정폭 공백·줄바꿈·탭.
       위 ④ 를 고친 뒤에도 이것들이 글자로 남아 `2. 접 수 처<hp:fwSpace/>` 처럼 나왔다.
       뜻대로 바꿔 준다: 공백·탭 → 빈칸, 줄바꿈 → 진짜 줄바꿈. 나머지 표시는 버린다.
       ⚠️ 글자에 든 `&lt;` 는 살아남아야 한다 — 표시를 걷는 것은 **`unent` 보다 먼저**여야
          한다(뒤에 하면 `&lt;3년 이상&gt;` 이 태그로 보여 통째로 사라진다). */
    eq('  hwpx — 고정폭 공백은 빈칸이 된다',
      AT.xmlDocText('<hp:p><hp:t>접 수 처<hp:fwSpace/>서울</hp:t></hp:p>', 'hwpx'), '접 수 처 서울');
    eq('    탭도 빈칸이 된다',
      AT.xmlDocText('<hp:p><hp:t>202<hp:tab width="1136" leader="0" type="1"/>년</hp:t></hp:p>', 'hwpx'),
      '202 년');
    eq('    줄바꿈은 줄을 나눈다',
      AT.xmlDocText('<hp:p><hp:t>항목 : 성명<hp:lineBreak/>기간 : 2026년</hp:t></hp:p>', 'hwpx'),
      '항목 : 성명\n기간 : 2026년');
    eq('    글자에 든 부등호는 살아남는다',
      AT.xmlDocText('<hp:p><hp:t>&lt;3년 이상&gt; 거주자</hp:t></hp:p>', 'hwpx'), '<3년 이상> 거주자');

    /* 🔴 **좁히기 자체를 재는 자리** (2026-09-15 · 코드 리뷰가 잡았다).
       위 검사들은 `inlineMarks` 의 통짜 태그 제거가 증상을 **가려서**, 정규식을
       `<w:t[^>]*>` 로 되돌려도 전부 초록이었다 — 관문이 조용히 무력해진 것이다
       (내 red-green 은 inlineMarks 를 넣기 전에 한 것이라 그때만 진짜였다).
       가려지지 않는 것은 **삼킨 구간 안에 '지워진 글'이 있을 때**다:
         · `<w:delText>` = 편집자가 **삭제한** 글. 표 태그부터 삼키면 되살아난다.
         · `<w:instrText>` = 필드 코드(HYPERLINK …). 주소가 본문에 섞인다.
       지워진 옛 마감일이 진짜 마감일 앞에 붙는 것이라 이 저장소에서 가장 나쁜 꼴이다. */
    const 삭제된글 = '<w:tbl><w:tr><w:tc><w:p>'
      + '<w:r><w:delText>2025년 마감 8.31</w:delText></w:r>'
      + '<w:r><w:t>접수기간 : 2026.9.9</w:t></w:r></w:p></w:tc></w:tr></w:tbl>';
    eq('    지워진 글(w:delText)이 되살아나지 않는다',
      AT.xmlDocText(삭제된글, 'docx'), '접수기간 : 2026.9.9');
    const 필드코드 = '<w:tbl><w:tc><w:p>'
      + '<w:r><w:instrText> HYPERLINK "http://x.kr/abc" </w:instrText></w:r>'
      + '<w:r><w:t>접수기간 : 2026.9.9</w:t></w:r></w:p></w:tc></w:tbl>';
    eq('    필드 코드(w:instrText)가 본문에 섞이지 않는다',
      AT.xmlDocText(필드코드, 'docx'), '접수기간 : 2026.9.9');
    const 표제목 = '<hp:tbl><hp:caption><hp:p><hp:t>표 제목</hp:t></hp:p></hp:caption>'
      + '<hp:tc><hp:p><hp:t>접수기한 : 2026. 9. 9.</hp:t></hp:p></hp:tc></hp:tbl>';
    eq('    hwpx 표 캡션이 칸 글자에 붙지 않는다',
      AT.xmlDocText(표제목, 'hwpx').split('\n').pop(), '접수기한 : 2026. 9. 9.');
    eq('    docx 쪽도 같은 규칙이다',
      AT.xmlDocText('<w:p><w:t>&lt;3년&gt; 이상</w:t></w:p>', 'docx'), '<3년> 이상');

    /* 🔴 **학생이 보는 양식에 찌꺼기가 없어야 한다** (2026-09-15 · 코드 리뷰가 파급을 짚었다).
       이 글자 뽑기는 마감·자격만 쓰는 게 아니라 **양식 스키마화**도 쓴다
       (`collector/schematize-forms.mjs`). 찌꺼기가 있던 시절엔 콜론형 인식기가
       `hp:t` 의 콜론에 반응해 **`hp:t 대상자`·`hp:t 성 명` 같은 가짜 칸**을 만들었다
       (정읍 서식 실측 40칸 — 전부 가짜). 지금은 기존 관문 셋(변환 보류·품질·항목 누락)이
       전부 막아 승격되는 것이 0건이지만, 이미 등록된 48종에 남아 있으면 학생이 그걸 본다. */
    const tpls = JSON.parse(readText(new URL('../data/forms.json', import.meta.url))).templates;
    /* ⚠️ 경계를  로 쓰면 JSON 안에서는 앞이 따옴표라  을 놓친다
       (실제로 그렇게 짰다가 가짜 라벨을 못 잡는 걸 확인하고 고쳤다). */
    const 찌꺼기 = /\b(hp|w):[a-z]+[\s>]|w:val=|나눔고딕|함초롬|맑은 고딕/;
    eq(`등록된 양식 ${Object.keys(tpls).length}종에 XML 찌꺼기·글꼴 이름이 없다`,
      Object.entries(tpls).filter(([, t]) => 찌꺼기.test(JSON.stringify(t))).map(([k]) => k), []);

    /* 🔴 실제로 저장된 문서에도 찌꺼기가 안 남아야 한다 — 합성 XML 만 재면
       진짜 문서의 다른 태그 모양을 놓친다(합성은 내가 만든 것이라 늘 통과한다). */
    const dir = new URL('../collector/extracted/', import.meta.url);
    const real = fs.existsSync(fileURLToPath(dir))
      ? fs.readdirSync(fileURLToPath(dir)).filter((f) => /\.(docx|hwpx)$/i.test(f)) : [];
    if (real.length) {
      const SOUP = /<\/?(w|hp):[a-zA-Z]|w:val=|widthRelTo=/;
      const dirty = real.map((f) => [f, AT.attachmentText(fileURLToPath(new URL(f, dir)))])
        .map(([f, t]) => [f, t.split('\n').filter((l) => SOUP.test(l)).length])
        .filter(([, n]) => n > 0);
      eq(`  저장된 문서 ${real.length}개에 XML 찌꺼기 줄이 없다`,
        dirty.map(([f, n]) => `${f}:${n}`), []);
    } else eq('  (저장된 docx·hwpx 표본 없음 — 건너뜀)', true, true);
  }
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
    vm.runInContext(readText(new URL(f, import.meta.url)), ctx, { filename: f });
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
    /* ⚠️ 2026-09-17: 예전 픽스처 `한국장학재단에서 학자금대출을 받은 국내 대학교 재학생` 은
       이제 **'모른다'** 다 — 학자금대출을 받았는지는 프로필이 모르는 처지라 ✓ 를 치지 않는다
       (아래 '자격 판정 전수 대조' 절). 학적 포함 관계를 재는 데는 대출 말이 없는 줄이 맞다. */
    const 재학요건 = '국내 대학교 재학생 (2026-2학기 기준)';
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
  /* 🔴 **이 절의 이름대로 고쳤다** (2026-09-21). 예전 단언은 `pct === FIT_FLOOR`(15) 였는데,
     그건 화면에 **'적합도 15%'** 로 나가는 값이라 바로 위 주석이 말하는 '자격 미확인'이
     아니었다 — 이름과 값이 서로 다른 말을 하고 있었다.
     실측으로 드러난 대가: 요건 3개 중 **0개를 판정하고도** 카드가 '적합'이라고 말했다
     (울산 남구·전남 장학금이 강서구 학생에게 · verify-kosaf 가 잡은 그것).
     이제 못 읽으면 `unread` 로 나가고 퍼센트도 FIT_UNREAD 로 맞는다.
     ⚠️ 검사를 무르게 한 것이 아니다 — 0% 가 아니라는 원래 단언은 그대로 두고,
        '미확인이라고 말하는가'를 **더 세게** 묻는다. */
  /* ⚠️ `.pct` 를 **숫자와 직접 견주지 않는다** — 이 파일의 '적합도 상수' 절이 금지한다
     (상수의 뜻이 바뀌면 숫자로 비교하던 곳이 조용히 죽는 사고를 2026-08-29 에 겪었다).
     "0% 가 아니다"는 이름 붙은 상수와 맞대어 말한다. */
  const un = fit(['경제적 지원이 필요한 학생'], 평범);
  eq('자격을 못 읽으면 미확인이다 (적합이라고 하지 않는다)', un.unread, true);
  eq('  퍼센트도 미확인 값이다 (0% 가 아니다)', un.pct, M.FIT_UNREAD);
  eq('자격 줄이 아예 없으면 미확인', fit([], 평범).unread, true);
  /* 하나라도 맞힌 공고는 예전처럼 비율로 나간다 — 통째로 미확인이 되면 그게 퇴보다 */
  const some = fit(['2026-2학기 학부 재학생', '경제적 지원이 필요한 학생'], 평범);
  eq('하나라도 판정했으면 미확인이 아니다', some.unread, false);
}

console.log('■ 마감 판정이 앱을 켠 시각에 굳지 않는다 (2026-08-25 개발자 지적으로 수리)');
/* 🔴 예전엔 app.js 첫머리에 `const TODAY = new Date()` 가 있었고 dday() 가 그 값을 썼다.
   이 앱은 홈 화면에 설치해 쓰는 앱이라 한 번 연 화면이 며칠씩 살아 있다 — 그동안 그 값이
   사흘 전인 채로 남아 **이미 마감된 공고가 D-2로 보이고 일괄 신청 준비 대상에도 들어갔다.**
   되돌아가면 여기서 잡는다. 브라우저 없이 app.js 의 진짜 함수를 떼어 내 돌려 본다. */
{
  const appSrc = readText(new URL('../app.js', import.meta.url));
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

  /* ── 마감 공고의 자리 — 목록에서 내리고 신청 내역에는 남긴다 (2026-09-05 개발자 지시) ──
     같은 블록에 두는 이유: 위의 grab·appSrc 를 그대로 쓴다(사본을 만들면 갈라진다). */
  console.log('■ 마감 공고의 자리 — 목록에서 내리고 신청 내역에는 남긴다 (2026-09-05)');
  eq('마감 공고는 마감 다음 날까지만 목록에 남는다',
    appSrc.includes('const CLOSED_KEEP_DAYS = 1;'), true);
  eq('목록 거르기가 그 상수를 그대로 쓴다',
    appSrc.includes('dday(m.sch.deadline).days >= -CLOSED_KEEP_DAYS'), true);
  eq('층2(KOSAF)도 같은 상수를 쓴다',
    appSrc.includes('dday(i.due).days >= -CLOSED_KEEP_DAYS'), true);

  /* 🔴 이 항목이 이 절의 존재 이유다 — 신청 내역은 마감으로 거르면 안 된다.
     목록에서 내리는 근거가 '신청 내역에는 남아 있다'이므로, 여기에 마감 필터가 들어오는
     순간 학생이 담아 둔 공고가 통째로 사라진다. 지금 그걸 막는 장치는 이 검사뿐이다. */
  const appsSrc = grab('renderApplications');
  eq('신청 내역은 마감으로 거르지 않는다 (CLOSED_KEEP_DAYS 없음)',
    appsSrc.includes('CLOSED_KEEP_DAYS'), false);
  eq('신청 내역은 마감으로 거르지 않는다 (dday 판정 없음)',
    appsSrc.includes('dday('), false);

  /* ── 🔴 신청 기록을 버리지 않는다 (2026-09-20 개발자 지시로 수리) ──
     예전엔 `.filter((a) => findSch(a.id))` 라, 공고를 못 찾으면 그 신청 기록을 화면에서
     통째로 빼고 **아무 말도 하지 않았다.** 실측으로 저장 3건 중 1장만 그려졌고 선정으로
     기록해 둔 건까지 사라졌다. 못 찾는 일은 드물지 않다 — 학생이 학교를 바꾸거나(schoolOnly),
     층2(KOSAF) 공고가 마감 다음 날 데이터에서 내려갈 때 일어난다.
     바로 위 '마감으로 거르지 않는다'와 같은 계열이다: **신청 내역에서 줄이 사라지면 안 된다.** */
  console.log('■ 신청 기록을 버리지 않는다 (2026-09-20)');
  eq('공고를 못 찾는다고 기록을 거르지 않는다',
    /filter\(\s*\(a\)\s*=>\s*findSch\(/.test(appsSrc), false);
  eq('기록↔공고 잇기를 appRows 로 한다', appsSrc.includes('appRows(state.applications, findSch)'), true);
  /* 금액은 못 찾으면 0 이어야 한다 — 옛 코드는 공고를 못 찾는 그 자리에서 죽었다
     (그래서 위 filter 가 있었던 것이기도 하다). 되돌아오면 여기서 잡는다.
     🔴 **주석을 빼고 잰다** — 걷어낸 옛 코드를 인용한 주석에 걸려 빨간불이 된다
        (2026-09-12 에 같은 함정을 한 번 밟았다: CLAUDE.md '주석까지 세지 말 것'). */
  const codeOnly = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1');
  eq('못 찾는 공고의 금액에서 죽지 않는다',
    /findSch\([^)]*\)\.amountValue/.test(codeOnly(appsSrc)), false);

  /* 규칙을 글자로만 재지 않고 **함수를 그대로 돌려 본다** — 못 찾는 기록이 살아남는가 */
  const appRows = new Function(`${grab('appRows')}\nreturn appRows;`)();
  const stored = [{ id: 'a' }, { id: 'gone' }, { id: 'c' }];
  const rows = appRows(stored, (id) => (id === 'gone' ? null : { id, name: id }));
  eq('못 찾는 기록도 줄로 남는다', rows.length, 3);
  eq('못 찾는 줄은 공고 자리가 비어 있다', rows.map((r) => !!r.sch), [true, false, true]);
  eq('차례는 최근 담은 것부터', rows.map((r) => r.app.id), ['c', 'gone', 'a']);
  eq('기록이 없으면 빈 목록', appRows(null, () => null).length, 0);

  /* 사라진 공고 카드가 **모르는 것을 말하지 않는가** (원칙 8-1) */
  const goneSrc = grab('appCardGone');
  eq('이름을 지어내지 않는다 (적어 둔 name 만 쓴다)',
    goneSrc.includes("app.name || '(목록에서 내려간 공고)'"), true);
  eq('마감을 말하지 않는다', goneSrc.includes('dday('), false);
  eq('금액을 말하지 않는다', goneSrc.includes('amountValue'), false);
  eq('진행 단계(n/4)를 말하지 않는다', goneSrc.includes('APP_STEPS'), false);
  /* 학생이 적어 둔 것은 학생의 기록이라 그대로 남는다 */
  eq('학생이 기록한 결과는 남긴다', /app\.result/.test(goneSrc), true);
  eq('잘못 누른 기록을 되돌릴 길이 있다', goneSrc.includes('data-undo-result'), true);
  /* 되돌리기는 공고를 요구하면 안 된다 — 요구하면 사라진 공고의 기록이 영영 안 지워진다
     (저장 해제 `toggleSave` 가 2026-09-07 코드 리뷰에서 같은 이유로 고쳐졌다) */
  eq('되돌리기가 공고를 요구하지 않는다', grab('undoProgress').includes('typeof schOrId'), true);

  /* 합이 0 일 때 '0원'이라고 말하지 않는다 — 금액 미확인 공고가 많아(실측 68건 중 41건)
     그중 하나를 선정으로 기록하면 '선정된 장학금 0원'이 떴다. */
  eq("합이 0 이면 '금액 미확인'이라고 적는다",
    appsSrc.includes("shownAmount ? won(shownAmount) : '금액 미확인'"), true);

  /* ── 🔴 차례 — 할 일이 있는 것부터 (2026-09-20 개발자 지적) ──
     예전엔 담은 순서를 뒤집기만 해서, 실측으로 위 세 장이 전부 끝난 일이고 '서류 작성
     필요'와 마감 전 공고가 맨 아래로 밀렸다. 🔴 **차례만 바꾸고 거르지 않는다.** */
  console.log('■ 신청내역 차례 — 할 일이 있는 것부터 (2026-09-20)');
  const appOrder = new Function(`${grab('appOrder')}\nreturn appOrder;`)();
  const T = '2026-09-20';
  const R = (id, app, deadline) => ({ app: { id, ...app }, sch: deadline === null ? null : { deadline } });
  const mixed = [
    R('끝남',      { result: 'won' },            '2026-09-30'),
    R('기다림',    { submittedAt: '2026-09-01' }, '2026-09-25'),
    R('마감지남',  {},                            '2026-09-01'),
    R('마감모름',  {},                            null),
    R('급함',      {},                            '2026-09-22'),
    R('덜급함',    {},                            '2026-09-28'),
  ];
  eq('할 일 → 기다림 → 끝남 차례, 할 일 안에서는 임박순',
    appOrder(mixed, T).map((r) => r.app.id),
    ['급함', '덜급함', '마감지남', '마감모름', '기다림', '끝남']);
  /* 🔴 이 항목이 이 절의 존재 이유다 — 차례를 바꾸다 줄을 흘리면 1번 사고가 되살아난다 */
  eq('차례를 바꿔도 줄 수는 그대로', appOrder(mixed, T).length, mixed.length);
  eq('한 줄도 잃지 않는다',
    appOrder(mixed, T).map((r) => r.app.id).slice().sort().join(),
    mixed.map((r) => r.app.id).slice().sort().join());
  eq('빈 목록도 괜찮다', appOrder([], T).length, 0);
  /* 마감을 모르는 공고에 '남은 날 14일'이라는 가짜 값을 쓰지 않는다(CLAUDE.md) */
  eq('차례를 정할 때 dday 를 쓰지 않는다', grab('appOrder').includes('dday('), false);

  /* ── 손잡이가 없는 것을 약속하지 않는다 · 마감된 건의 막대 · 금액 이름표 (2026-09-20) ── */
  console.log('■ 신청내역 — 없는 것을 약속하지 않는다 (2026-09-20)');
  /* 아래 절이 쓰는 `cardSrc` 는 여기보다 뒤에서 선언된다 — 같은 이름을 앞당겨 쓰면
     초기화 전 접근으로 죽는다(실제로 한 번 죽였다). 따로 떼어 쓴다. */
  const appCardSrc = grab('appCard');
  eq("결과를 기록한 건은 '기록 보기'라고 말한다",
    appCardSrc.includes("app.result ? '기록 보기' : '세부사항 입력하기'"), true);
  eq('마감됐는데 제출 기록이 없으면 막대를 진행색으로 칠하지 않는다',
    appCardSrc.includes("deadPrep ? ' app-step-closed' : ''"), true);
  eq('제출을 기록한 건은 마감 뒤에도 진행색을 지킨다 (심사 중이므로)',
    /const deadPrep = isClosed && !app\.submittedAt && !app\.result;/.test(appCardSrc), true);
  eq('금액 이름표가 건수 줄에서 떨어져 있다', appsSrc.includes('class="summary-label"'), true);
  eq('건수 줄에 금액 이름표를 다시 붙이지 않는다',
    /건\$\{[^}]*\}\s*·\s*\$\{wonApps\.length \? '선정된 장학금'/.test(appsSrc), false);

  /* 마감 배지는 자기만의 잣대를 만들지 않는다 — dday() 가 내린 cls 를 읽는다.
     새로 `days < 0` 을 쓰면 상시 제도(days:14)·기한 미확인까지 규칙이 갈라진다. */
  const cardSrc = grab('appCard');
  eq('신청 내역 카드가 마감을 표시한다', cardSrc.includes('badge-dday closed'), true);
  eq('마감 판정을 dday().cls 로 한다', cardSrc.includes("dday(sch.deadline).cls === 'closed'"), true);
  eq('마감 판정을 손으로 다시 쓰지 않는다', cardSrc.includes('.days < 0'), false);

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

  /* ── 🔴 홈 차례 — 적합도와 마감일을 한 점수로 (2026-09-17 개발자 지시) ──
     "홈화면 장학금 적합도순으로 된것같은데 제목은 마감임박이야. 마감임박이라는 수치를 지우고
      앞으로 홈화면에는 적합도와 마감일을 모두 고려하여 내림차순으로 공고를 정렬하고 싶어."
     옛 규칙은 '마감 7일 안쪽인가'가 **1차 키**라 그 안쪽이면 적합도 15% 도 바깥의 50% 위였고,
     칸 이름('마감 임박')과 안쪽 차례(적합도순)가 서로 다른 말을 했다.
     이 절이 지키는 것은 **규칙의 뜻**이다 — 그린 차례가 앱 규칙과 같은지는
     verify-explore-sort 가 본다(그쪽은 앱의 비교 함수를 그대로 불러 대조한다).
     같은 블록에 두는 이유: 위의 grab·appSrc 를 그대로 쓴다(사본을 만들면 갈라진다). */
  console.log('■ 홈 차례 — 적합도와 마감일을 한 점수로 (2026-09-17 개발자 지시)');

  eq('마감 7일 문턱으로 줄을 가르지 않는다 (urgentRank 가 없다)', /urgentRank/.test(appSrc), false);
  eq('홈 목록이 비교 함수 하나로 정렬한다', appSrc.includes('.sort(byHomeOrder)'), true);
  {
    const i = appSrc.indexOf('const byHomeOrder');
    const src = i < 0 ? '' : appSrc.slice(i, appSrc.indexOf(';', i) + 1);
    /* 🔴 미달·자격 미확인이 점수 위로 올라오면 '마감이 가까운 지원 자격 미달' 카드가
       홈 맨 위에 앉는다 — 적합도를 고려한다면서 미달을 맨 위에 두는 셈이다. */
    eq('미달·자격 미확인은 점수와 무관하게 아래다 (fitRank 가 1차 키)',
      src.includes('fitRank(a) - fitRank(b)'), true);
    eq('  그 다음이 적합도+마감 한 점수다', src.includes('homeScore(b) - homeScore(a)'), true);
  }

  /* 규칙을 베끼지 않는다 — app.js 의 **진짜** homeScore 를 떼어 내 가짜 시계 위에서 돌린다 */
  const HORIZON = Number((appSrc.match(/const HOME_FIT_DAY_HORIZON = (\d+);/) || [])[1]);
  eq('지평선 상수를 app.js 에서 그대로 읽었다', HORIZON > 0, true);
  const nowHome = Date.UTC(2026, 8, 17, 3, 0, 0);          // 2026-09-17 (KST 정오쯤)
  class HomeDate extends Date {
    constructor(...a) { super(...(a.length ? a : [nowHome])); }
    static now() { return nowHome; }
  }
  const { homeScore } = new Function('Date', 'HOME_FIT_DAY_HORIZON',
    `${grab('todayStart')}\n${grab('dday')}\n${grab('homeScore')}\nreturn { homeScore };`)(HomeDate, HORIZON);
  /* fit 과 '며칠 뒤 마감'만 있는 최소 픽스처 — 카드 한 장이 홈에서 갖는 값 그대로다 */
  const 공고 = (fit, n) => ({ fit, sch: { deadline: n === null ? '' :
    new Date(nowHome + n * 86400000).toISOString().slice(0, 10) } });
  const 위 = (a, b) => homeScore(a) > homeScore(b);

  eq('같은 적합도면 마감이 가까운 쪽이 위다', 위(공고(33, 1), 공고(33, 6)), true);
  /* 🔴 지시의 핵심 — 마감이 **동점 처리에 그치지 않는다**. 적합도가 조금 뒤져도
     마감 차이가 크면 순서가 뒤집힌다(옛 규칙에서는 둘 다 임박 밖이면 40% 가 이겼다). */
  eq('적합도가 조금 낮아도 마감이 훨씬 가까우면 위로 온다', 위(공고(33, 1), 공고(40, 20)), true);
  /* 🔴 그러나 적합도가 크게 앞서면 마감이 며칠 멀어도 위에 남는다 — 2026-09-12 지적
     ("적합도가 낮아도 마감이 임박하면 홈에 뜬다 — 굳이…")의 재발 방지. 실측 그 짝이다. */
  eq('적합도가 크게 앞서면 마감이 며칠 멀어도 위에 남는다', 위(공고(50, 11), 공고(15, 1)), true);
  eq('  20% D-1 도 50% D-11 을 못 넘는다', 위(공고(50, 11), 공고(20, 1)), true);
  /* 🔴 마감을 모르는 공고에 dday() 의 **가짜 14일**을 주지 않는다 — 그 값은 목록에서
     안 사라지게 하려는 장치라 순서에 쓰면 모르는 날짜를 아는 척하게 된다(원칙 8-1). */
  eq('마감을 모르는 공고는 지평선으로 둔다 (가짜 14일을 쓰지 않는다)',
    homeScore(공고(40, null)), 40 - HORIZON);
  eq('  그래서 같은 적합도의 15일 뒤 마감보다 위가 아니다 (가짜 14 면 여기서 뒤집힌다)',
    위(공고(40, null), 공고(40, 15)), false);
  /* 한 달 너머는 다 같이 '아직 멀다' — 지평선 밖에서 날짜로 더 가르지 않는다 */
  eq('지평선 너머끼리는 마감으로 더 가르지 않는다',
    homeScore(공고(40, HORIZON + 5)), homeScore(공고(40, HORIZON + 40)));

  /* 🔴 지시의 앞 절반 — "마감임박이라는 수치를 지우고". 구획 제목이 되돌아오면 잡는다.
     ⚠️ `<h3>` 안만 본다 — 이 변경을 설명하는 주석에도 그 낱말이 들어 있다. */
  {
    const h = readText(new URL('../index.html', import.meta.url));
    const head = h.slice(h.indexOf('id="screen-home"'), h.indexOf('id="home-deadline-list"'));
    eq('홈 구획 제목이 더 이상 「마감 임박」이 아니다',
      /<h3>[^<]*마감\s*임박[^<]*<\/h3>/.test(head), false);
    eq('  그래도 이름은 있다 (빈 제목으로 지우지 않았다)', /<h3>\s*\S[^<]*<\/h3>/.test(head), true);
  }
}

console.log('■ 회원가입·로그인 배선 (2026-08-25) — 빠뜨리면 조용히 안 되는 세 가지');
{
  const at = (f) => readText(new URL('../' + f, import.meta.url));
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
  /* ①-2 🔴 인원 × 예산 표 (2026-09-15 — 울산연구원 하반기 공고문 HWP · 노션 F-9).
        `총·예산` 낱말이 없는 지급 계획표가 글자로 뽑히면 칸마다 줄이 갈라져 나온다.
        그대로 읽으면 1억 8천만원이 1인당 장학금이 됐다(실측). 아래는 실제 원문 줄이다. */
  eq('인원과 금액이 칸으로 갈라진 예산표는 읽지 않는다',
    kindOf(['지급금액', '계', '311명', '421백만원', '우수장학금', '대 학 생', '115명', '180백만원']), 'unknown');
  eq('  한 줄에 붙어 있어도 마찬가지다',
    kindOf(['지급금액 계 311명 421백만원 우수장학금 대학생 115명 180백만원']), 'unknown');
  /* 넓힐 때 잃으면 안 되는 것 — 1인당·각 표시가 있으면 인원이 같이 있어도 읽는다 */
  eq('  1인당 표시가 있으면 인원이 있어도 읽는다',
    wonOf(['장학금액', '선발인원 20명', '1인당 100만원']), 1000000);
  eq('  `각` 이 있으면 읽는다', wonOf(['장학금액 : 선발인원 12명, 각 100만원']), 1000000);
  eq('  한 자리 인원은 예산표로 보지 않는다', wonOf(['장학금액 : 3명, 100만원']), 1000000);
  /* ①-3 AI 가 포스터·PDF 에서 옮겨 온 실제 줄 (2026-09-15) — 표기가 넓다 */
  eq('소수점 백만원을 읽는다 (2.5백만원 — 5백만원이 아니다)',
    wonOf(['장학금액', '1. 가수 윤하 장학금액(학기당) 2.5백만원']), 2500000);
  eq('천원 단위를 읽는다 (12,420천원)',
    wonOf(['장학금액', '한 학기 장학금 12,420천원 (약 $0.9만), 4개월 이상 체류']), 12420000);
  eq('  천만원이 천원보다 먼저다', wonOf(['장학금액 : 5천만원(1인당)']), 50000000);
  eq('  수수료 5천원은 금액이 아니다', kindOf(['장학금액', '발급 수수료 5천원']), 'unknown');
  /* 넓히면서 드러난 옛 구멍 둘 — 둘 다 실제 원문 줄이다 */
  eq('숫자 속 쉼표에서 조각을 가르지 않는다 (1인당 최대 1,000,000원)',
    wonOf(['장학금액', '1인당 최대 1,000,000원', '(인당 지원액) 개인별 상이(최대 500천원) ※대출이자 금액에 따라 상이']), 1000000);
  eq('311명 은 1명 이 아니다 — 인원·예산 한 줄은 읽지 않는다',
    kindOf(['○ 선발 예정인원 및 지급금액 : 311명, 421,000천원 예정']), 'unknown');
  /* 🔴 예산표 관문이 진짜 1인당 금액까지 지우면 안 된다 (코드 리뷰 2026-09-15 — 처음 판이 그랬다).
     범위(`~`)·학기당·매월은 한 사람 몫의 표기라 인원이 옆에 있어도 읽는다. */
  {
    const r = PA.amountFrom(['장학금액 : 1백만원 ~ 2백만원 (선발인원 20명)']);
    eq('범위가 적혀 있으면 인원이 옆에 있어도 읽는다 (1백만원 ~ 2백만원 · 20명)', `${r.kind} ${r.value}`, 'range 2000000');
  }
  eq('  학기당은 한 사람 몫이다 (선발인원 20명 · 학기당 100만원)', wonOf(['장학금액', '선발인원 20명', '학기당 100만원']), 1000000);
  eq('  매월도 한 사람 몫이다 (20명 내외 · 매월 50만원)', wonOf(['장학금액', '선발인원 20명 내외', '매월 50만원']), 500000);
  /* 천원은 무늬 순서에서 맨 뒤 — 앞에 두면 괄호 안 교재비가 장학금이 된다 */
  eq('천원이 뒤에 있는 교재비를 장학금으로 읽지 않는다', wonOf(['장학금액 : 3,000,000원 (교재비 100천원 별도)']), 3000000);
  {
    const r = PA.amountFrom(['장학금액 : 1인당 2.5백만원 ~ 3백만원']);
    eq('소수점 범위도 범위다 (2.5백만원 ~ 3백만원)', `${r.kind} ${r.min} ${r.max}`, 'range 2500000 3000000');
  }

  /* 🔴 **표의 합계 행도 총액이다** (2026-09-17 · 노션 UI-12).
     `TOTAL_RE` 는 `총상금`·`총예산`·`사업비` 같은 **낱말**을 찾는데, 요강의 예산표는
     그런 낱말 없이 `지급금액 계 | 311명 | 421백만원` 처럼 **표의 합계 행**으로 적는다.
     울산연구원 공고문 HWP 가 실제로 그 꼴이라, 첨부를 금액 경로에 붙이자마자
     `180백만원`(115명 몫)이 **1인당 1억 8천만원**으로 나왔다 — 개발자가 '기망'이라고
     한 바로 그 실패다. 표는 한 줄에 한 칸씩 펼쳐져 오므로 금액 절이 통째로 삼킨다.
     ⚠️ 저장분으로 재 보니 이 규칙이 **지금 금액이 있는 27건 중 0건**을 잃는다.
     ⚠️ 글자가 깨져도(`계 311浵ࡦ명`) 잡혀야 한다 — HWP 추출이 흔히 그렇게 낸다. */
  /* ⚠️ **금액 머리글을 꼭 붙여 잰다** — 안 붙이면 절이 아예 안 열려 `unknown` 이 나오고
     검사가 **다른 이유로** 통과한다(처음에 그렇게 짰다가 잡았다). 로봇도 머리글을 붙여 먹인다
     (`extract-amounts.mjs` 의 `PA.amountFrom(['장학금액', ...aiLines])`). 붙이면 4.21억이 나왔다. */
  eq('표의 합계 행(계 + 인원)을 1인당으로 읽지 않는다',
    kindOf(['장학금액', '지급금액 계 311명 421백만원', '우수장학금', '대 학 생', '115명', '180백만원']), 'unknown');
  eq('  글자가 깨진 합계 행도 막는다',
    kindOf(['장학금액', '지급금액 계 311浵ࡦ명 421浵ࡦ백만원', '우수장학금', '대 학 생', '115명', '180백만원']), 'unknown');
  eq('  「합계」·「소계」·「총계」도 총액이다', kindOf(['장학금액', '합계 3,000만원']), 'unknown');
  /* 🔴 그러면서 진짜 1인당은 살아야 한다 — 위 검사만 두면 "늘 unknown" 으로도 통과한다 */
  eq('  진짜 1인당은 그대로 읽는다', wonOf(['장학금액 : 1인당 100만원']), 1000000);
  eq('  인원만 적힌 줄은 총액 신호가 아니다', wonOf(['장학금액 : 200만원', '모집인원 : 10명']), 2000000);
  eq('  「선발 계획 30명」의 계획을 합계로 오인하지 않는다',
    wonOf(['장학금액 : 200만원', '선발 계획 30명']), 2000000);


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

  /* 🔴 **한정어 없음의 기본값을 좁힌 자리** (2026-09-09 코드 리뷰 · 전수 대조).
     `타 장학금은 중복 불가` 처럼 **남의 장학금**을 말하는 줄은 예전처럼 '전부' 다(위 검사가 지킨다).
     그런데 남의 장학금 이야기가 아닌 줄까지 '전부' 로 읽혀, 교외 장학금을 하나라도 받는
     학생에게 **지원 불가**가 떴다 — 그 학생은 받을 수 있는 돈을 신청조차 안 하게 된다.
     ⚠️ 합계는 안 바뀐다 — sumAmounts 는 'narrow' 만 예외로 두므로 'unspecified' 도
        예전처럼 보수적으로 셈한다(홈 합계 실측 1,205만원 그대로). */
  /* 🔴 **비율형도 '함께 못 받는 것 중 하나만'에 참여한다** (2026-09-10 코드 리뷰).
     예전에는 `ratio` 이면 곧바로 estimated 로 빠져나가 이중수혜 갈래에 한 번도 안 닿았다.
     그래서 함께 받을 수 없는 두 공고가 합계에 나란히 더해졌다 —
     등록금 전액(교외 이중수혜 불가) + 500만원(교외 이중수혜 불가) → **900만원**
     (실제로 받을 수 있는 최대는 500만원). `dropped` 도 비어 있어 금액 상세의
     '중복 수혜 불가' 칸에도 안 떠, 학생이 어긋남을 알아챌 길이 없었다.
     🔴 받을 수 없는 숫자를 '받을 수 있는 장학금'이라 부르는 것은 기망이다(이 파일 첫머리). */
  {
    const ex = (k, sc) => ({ kind: k, scope: sc, raw: 'x' });
    const T = 4000000;
    const sum = (items) => PA.sumAmounts(items, { tuition: T }).total / 10000;
    eq('비율형+고정형이 둘 다 교외 배타면 큰 쪽 하나만 센다',
      sum([{ id: 'a', amountSpec: { kind: 'ratio', ratio: 1 }, exclusivity: ex('forbidden', 'external') },
        { id: 'b', amountSpec: { kind: 'fixed', value: 5000000 }, exclusivity: ex('forbidden', 'external') }]), 500);
    /* 🔴 되돌림 방지 셋 — 넓게 빼면 받을 수 있는 돈을 **적게** 말하게 된다 */
    eq('  배타 조항이 없으면 그대로 더한다',
      sum([{ id: 'a', amountSpec: { kind: 'ratio', ratio: 1 } },
        { id: 'b', amountSpec: { kind: 'fixed', value: 5000000 } }]), 900);
    eq('  좁은 배타는 빼지 않는다',
      sum([{ id: 'a', amountSpec: { kind: 'ratio', ratio: 1 }, exclusivity: ex('forbidden', 'narrow') },
        { id: 'b', amountSpec: { kind: 'fixed', value: 5000000 }, exclusivity: ex('forbidden', 'narrow') }]), 900);
    eq('  비율형 하나만 있으면 그대로 센다 (두 번 세지 않는다)',
      sum([{ id: 'a', amountSpec: { kind: 'ratio', ratio: 1 } }]), 400);
    /* '추정' 표시는 남아 있어야 한다 — 화면이 '약 400만원 · 추정' 이라고 적는 근거다 */
    eq("  그래도 '추정' 목록에는 남는다",
      PA.sumAmounts([{ id: 'a', amountSpec: { kind: 'ratio', ratio: 1 }, exclusivity: ex('forbidden', 'external') },
        { id: 'b', amountSpec: { kind: 'fixed', value: 5000000 }, exclusivity: ex('forbidden', 'external') }],
      { tuition: T }).estimated.length, 1);
  }

  eq("'동일인 중복 지급 불가' 는 그 재단 이야기다 (교외 전부가 아니다)",
    PA.exclusivityFrom(['당해연도 내 동일인 중복 지급 불가']).scope, 'unspecified');
  eq('  장학금 이름을 대면 그것과만',
    PA.exclusivityFrom(['동일종목 및 동일수상실적으로 춘향인재장학금과 중복 지급 불가']).scope, 'narrow');
  /* 🔴 되돌림 방지 — 아래 둘은 계속 '전부' 여야 한다 */
  eq('  그래도 「타 장학금」(한정어 없음)은 여전히 전부',
    PA.exclusivityFrom(['본 장학금 수혜자는 타 장학금 중복 수혜 불가']).scope, 'external');
  eq('  「대외 장학금」도 여전히 전부',
    PA.exclusivityFrom(['대외 장학금과 동일인 중복 지급 불가']).scope, 'external');
  /* 🔴 화면까지 — 교외 장학금을 받는 학생이 '동일인' 줄 때문에 막히지 않는다 */
  {
    const MEx = createRequire(import.meta.url)('../match-engine.js');
    const held = { school: '경희대학교', campus: '서울캠퍼스', track: 'engineering', major: '컴퓨터공학과',
      year: 3, status: '재학', gpa: 4.0, credits: 16, bracket: 4, region: '서울',
      flags: [], scholarships: ['external'], common: {} };
    const mk = (line) => ({ id: 't', name: 't', type: '교외', eligibility: { selective: true },
      exclusivity: PA.exclusivityFrom([line]), eligibilityLines: [] });
    eq("  '동일인' 줄로는 교외 수혜자를 막지 않는다",
      MEx.evaluate(mk('당해연도 내 동일인 중복 지급 불가'), held).status !== 'ineligible', true);
    eq("  '타 장학금' 줄로는 여전히 막는다 (되돌림 방지)",
      MEx.evaluate(mk('본 장학금 수혜자는 타 장학금 중복 수혜 불가'), held).status, 'ineligible');
  }
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
    const src2 = readText(new URL('../parse-amount.js', import.meta.url));
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
      vm2.runInContext(readText(new URL(f, import.meta.url)), ctx2, { filename: f });
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
    const html = readText(new URL('../index.html', import.meta.url));
    const swSrc = readText(new URL('../sw.js', import.meta.url));
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
  const app = readText(new URL('../app.js', import.meta.url));
  /* 줄 하나를 그리는 amountDetailRow 도 같은 화면이라 함께 본다 */
  /* estOpt(추정 표시)·amountDetailRow(줄 하나)도 같은 화면이라 함께 본다 */
  const body = app.slice(app.indexOf('function estOpt'), app.indexOf('function renderBulkPrep'));
  eq('renderAmountDetail 이 있다', body.length > 200, true);

  // ① 갈래 넷 — 이름은 개발자가 '명사형으로 조이기'로 정한 것이다
  for (const t of ['합산', '중복 수혜 불가', '등록금 비율 환산', '금액 미확인']) {
    eq(`갈래 '${t}' 가 있다`, body.includes(`grp('${t}'`), true);
  }
  eq('제목은 금액 상세다', body.includes('금액 상세'), true);

  /* 🔴 **추정값을 확정값처럼 적지 않는다** (2026-09-11 코드 리뷰에서 잡았다).
     2026-09-10 수리로 비율형이 이중수혜 갈래를 거치게 되면서 같은 공고가 `added`(또는
     `onlyOne`)와 `estimated` 양쪽에 들어간다. 합계는 옳지만, 합산 줄이 `400만원` 이라고
     딱 떨어지게 적으면 학교 평균 등록금에서 뽑은 **추정**이 확정된 금액으로 읽힌다.
     ⚠️ 계산을 고치지 말 것 — total 은 옳다. 고칠 자리는 '적는 법'(estOpt)뿐이다. */
  eq('합산 줄이 추정 여부를 거쳐 그려진다', /bill\.added\.map\(\(m\) => amountDetailRow\(m, estOpt\(/.test(body), true);
  eq('  중복 수혜 불가 줄도 같은 길을 쓴다', /bill\.onlyOne\.map\(\(m\) => amountDetailRow\(m, estOpt\(/.test(body), true);
  eq("  추정이면 '약' 과 est 를 붙인다", /estimated\.indexOf\(m\)[\s\S]{0,200}text: '약 '/.test(body), true);
  eq('  비율 환산 갈래가 다시 적은 것임을 밝힌다', body.includes('건수를 더하지 마세요'), true);

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
    const ui = readText(new URL('../.github/workflows/verify-ui.yml', import.meta.url));
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
  const PAsrc = readText(new URL('../parse-amount.js', import.meta.url));
  const mapped = [...PAsrc.slice(PAsrc.indexOf('var TRACK_TO_FIELD')).slice(0, 400).matchAll(/'([^']+)'/g)].map((m) => m[1]);
  eq('KNOWN_TRACKS 가 parse-amount 의 TRACK_TO_FIELD 와 같은 이름을 쓴다',
    TF.KNOWN_TRACKS.every((t) => mapped.includes(t)), true);

  /* 쪽 넘김을 `paging` 으로 되돌리면 1쪽만 영원히 긁는다 (실측으로 확인한 함정) */
  const src = readText(new URL('../collector/fetch-tuition-field.mjs', import.meta.url));
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
  const meSrc = readText(new URL('../match-engine.js', import.meta.url));
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
  const dataSrc = readText(new URL('../data.js', import.meta.url));
  const majorsSrc = readText(new URL('../collector/majors.mjs', import.meta.url));
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
  const src = readText(new URL('../collector/eligibility-ai.mjs', import.meta.url));
  const ex = readText(new URL('../collector/extract-amounts.mjs', import.meta.url));
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
    const cfg = JSON.parse(readText(new URL('../collector/eligibility-ai-config.json', import.meta.url)));
    eq('AI 자격 읽기는 기본이 꺼짐', cfg.enabled, false);
  }

  /* 🔴 모델에게 금액을 **계산**시키지 않는다 — 옮겨 온 줄을 parse-amount 가 읽는다.
     그래야 총액/1인당 가르기·유의사항 절 차단·자릿수 관문이 그대로 걸린다. */
  eq('금액 판정은 parse-amount 가 한다', /PA\.amountFrom\(\['장학금액', \.\.\.aiLines\]\)/.test(ex), true);
  eq('본문이 있으면 본문이 먼저다', /bodyLines\.length \? PA\.amountFrom\(bodyLines\)/.test(ex), true);
  /* 🔴 공고문 첨부(HWP·DOCX)를 **글자로** 읽는 길 (2026-09-15 · 노션 F-9).
     이 로봇은 2026-09-15 까지 첨부를 한 번도 안 열었다 — 게시판 본문이 '붙임 참조'뿐인 공고는
     영영 '금액 원문 확인'이었다. 자격 발췌기와 **같은 색인(elig-docs)·같은 함수(attachmentText)**
     를 써야 "발췌기는 읽는데 금액 로봇은 못 읽는" 어긋남이 안 생긴다. */
  eq('금액 로봇이 공고문 첨부 색인을 연다', /elig-docs\.json/.test(ex), true);
  eq('  첨부 글자는 발췌기와 같은 함수로 읽는다', /import \{ attachmentText, readable, docOrder \} from '\.\/attachment-text\.mjs'/.test(ex), true);
  eq('  본문·AI 줄로 못 읽었을 때만 첨부를 본다', /a\.kind === 'unknown' && hasDocs/.test(ex), true);
  eq('  첨부 금액도 parse-amount 가 정한다', /PA\.amountFrom\(t\.split/.test(ex), true);

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
    const src = readText(new URL(f, dir));
    return /data-step="[3-9]"\]\s*\[data-next\]/.test(src);
  });
  eq('마지막 온보딩 단계를 번호로 짚는 드라이버가 없다', lastStepUsers, []);

  /* ② 브라우저 경로를 박으면 개발자 맥에서 통째로 못 돈다(그 경로는 리눅스 샌드박스용) */
  const hardPath = names.filter((f) => {
    const src = readText(new URL(f, dir));
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
    const src = readText(new URL(f, dir));
    return /goto\(\s*['"]http:\/\/localhost:\d+/.test(src);
  });
  eq('서버 포트를 박은 드라이버가 없다 (PORT 를 먼저 본다)', hardPort, []);

  /* 🔴 ②-3 **PORT 를 읽는 것만으로는 안 막힌다 — 서버가 내 앱인지 확인해야 한다** (2026-09-02).
     2026-08-29 에 포트 박기를 걷어냈는데 **다음 날 같은 사고가 또 났다**: PORT 를 안 주면
     기본값 8123 으로 가고, 거기엔 다른 작업 폴더가 8월 29일부터 띄워 둔 서버가 살아 있었다.
     그 옛 app.js 를 재고 `verify-sheet-back` 이 빨간불이었는데 **이 폴더의 코드는 한 번도
     실행되지 않았다.** 반대 방향이 더 위험하다 — 8/29 `drive.js` 의 `ERRORS: none` 두 번이
     전부 남의 코드였다. **가짜 초록불은 아무도 의심하지 않는다.**
     그래서 브라우저를 띄우는 드라이버는 재기 전에 `assertOwnServer(PORT)` 를 불러야 한다.

     ⚠️ 예외 셋은 **자기가 앱 서버를 직접 띄운다**(`http.createServer`). 남의 앱을 잴 수가
        없어 이미 안전하고, 관문을 붙이면 오히려 없는 포트를 확인하다 죽는다. */
  const SELF_SERVED = ['verify-admin.js', 'verify-supabase.js', 'verify-push-client.js'];
  /* ⚠️ 두 번째 예외 갈래 — **서버를 아예 안 쓰는 드라이버** (2026-09-14 신설).
     `verify-admin-shape.js` 는 CSS 두 벌을 디스크에서 읽어 `page.setContent` 로 직접 넣는다.
     남의 서버를 잴 길이 처음부터 없어 `assertOwnServer` 를 붙일 자리도 없다(없는 포트를
     확인하다 죽는다). 대신 **정말 서버를 안 쓰는지**를 아래에서 증명한다 —
     주소로 열지 않는가(goto http) + 화면을 스스로 넣는가(setContent). */
  const NO_SERVER = ['verify-admin-shape.js'];
  const browserDrivers = names.filter((f) => {
    const src = readText(new URL(f, dir));
    return /require\('playwright-core'\)/.test(src)
      && !SELF_SERVED.includes(f) && !NO_SERVER.includes(f);
  });
  const noGuard = browserDrivers.filter((f) =>
    !/assertOwnServer\s*\(/.test(readText(new URL(f, dir))));
  eq(`브라우저 드라이버가 전부 서버를 확인한다 (${browserDrivers.length}개)`, noGuard, []);
  /* 예외로 적어 둔 이름이 실제로 자기 서버를 띄우는지도 본다 — 이유 없이 빠져나가지 못하게 */
  const fakeExempt = SELF_SERVED.filter((f) => {
    try { return !/createServer/.test(readText(new URL(f, dir))); }
    catch { return true; }   // 파일이 없어졌으면 목록에서 빼야 한다
  });
  eq('  예외 목록이 전부 자기 서버를 띄우는 드라이버다', fakeExempt, []);
  /* 서버를 안 쓴다고 적어 둔 드라이버가 정말 그런지 — 주소로 열면 남의 앱을 잴 수 있다 */
  const fakeNoServer = NO_SERVER.filter((f) => {
    try {
      const src = readText(new URL(f, dir));
      return /goto\(\s*[`'"]https?:/.test(src) || !/setContent\s*\(/.test(src);
    } catch { return true; }
  });
  eq('  서버를 안 쓴다고 적은 드라이버가 정말 주소를 안 연다', fakeNoServer, []);

  /* 🔴 **화면이 숨기는 학교와 로봇이 수집하는 학교가 갈라지면 안 된다** (2026-09-02 코드 리뷰).
     `match-engine.js` 의 `SERVED_SCHOOLS` 는 `collector/schools.json` 의 활성 학교를
     그대로 옮겨 적은 것이다. 같은 사실이 두 곳에 있으면 반드시 갈라진다 — 학교를 다시
     넣었을 때 로봇은 수집하는데 앱은 계속 숨겨서, **아무도 모르는 채로** 그 학교 학생이
     빈 화면을 본다. 안내문으로는 안 막히므로 여기서 대조한다.
     (학교를 늘리거나 줄일 때는 두 파일을 같이 고치면 된다 — 이 검사가 알려 준다.) */
  const served = createRequire(import.meta.url)('../match-engine.js').SERVED_SCHOOLS;
  const active = JSON.parse(readText(new URL('../collector/schools.json', import.meta.url)))
    .schools.map((x) => x.school);
  eq('화면이 보여 주는 학교 = 로봇이 수집하는 학교',
     [...served].sort(), [...new Set(active)].sort());

  /* ③ 사람이 미리 준비해야 하는 검사는 언젠가 반드시 안 돌아간다.
        verify-forms-data 가 "더미 양식이 주입된 앱 복사본이 서빙 중이어야 함"을 요구해
        돌리는 족족 실패했다 — 이제 드라이버가 스스로 주입한다. */
  const fd = readText(new URL('verify-forms-data.js', dir));
  eq('forms-data 가 픽스처를 스스로 주입한다', /page\.route\('\*\*\/data\/forms\.json'/.test(fd), true);
  eq('  살아 있는 데이터에 픽스처가 남아 있기를 기대하지 않는다',
    /registeredList\.find\(\(s\) => s\.formId === 'test-dummy'\)/.test(fd), false);

  /* ④ 배지와 정렬이 같은 근거를 쓴다 — 갈라지면 '적합도 33%' 카드가 미달 카드 사이에 앉는다 */
  const app2 = readText(new URL('../app.js', import.meta.url));
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
  const src3 = readText(new URL('../match-engine.js', import.meta.url));
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
        { cwd: fileURLToPath(new URL('..', import.meta.url)), encoding: 'utf8', timeout: 60000 });
    } catch (e) { return String((e && (e.stdout || e.message)) || ''); }
  };

  /* 🔴 **실제로 돌려서** 앱과 같은 답을 내는지 본다 — 글자만 훑으면 빈 파일도 통과한다 */
  const reg2 = JSON.parse(readText(new URL('../data/registered.json', import.meta.url)));
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
  /* app.js 에서 함수 한 덩어리를 **이름으로** 떼어 온다 — 베낀 사본이 아니라 진짜 코드다.
   (같은 방식이 위 '마감 판정' 절에도 있다. 규칙을 두 벌 두지 않으려고 여기서도 이걸 쓴다) */
  const grabApp = (name) => {
    const src = readText(new URL('../app.js', import.meta.url));
    const start = src.indexOf(`function ${name}(`);
    if (start < 0) throw new Error(`app.js 에서 ${name} 을 못 찾음`);
    let depth = 0, seen = false;
    for (let i = src.indexOf('{', start); i < src.length; i++) {
      if (src[i] === '{') { depth++; seen = true; }
      else if (src[i] === '}') { depth--; if (seen && depth === 0) return src.slice(start, i + 1); }
    }
    throw new Error(`${name} 의 끝을 못 찾음`);
  };
  /* 🔴 '마감이 지났는가'를 **여기서 새로 판정하지 않는다** (2026-08-31 실패로 수리).
     예전에는 `new Date(x.deadline) < new Date()` 로 직접 쟀는데, 이 식은
     `new Date('2026-08-31')` 을 **UTC 자정**으로 읽는다. 앱의 `dday()` 는
     `todayStart()`(로컬 자정) 기준이라, **오늘이 마감일인 공고**에서 둘의 답이 갈렸다 —
     검사는 '지났다', 앱은 'D-DAY · 아직 열림'. 그런 공고가 목록 앞에 오는 날에만
     터져서, 어제까지는 초록불이었다.
     이 저장소가 이미 배운 것과 같다: **규칙을 베끼면 갈라진다.** 앱 함수를 그대로 쓴다. */
  const ddayFn = new Function(`${grabApp('todayStart')}\n${grabApp('dday')}\nreturn dday;`)();
  /* 🔴 **자격은 통과하는데 마감만 지난** 공고를 골라야 한다 (2026-08-31 규명).
     예전에는 그냥 '마감 지난 것'을 집었는데, 첫 건이 `ineligible` 이라 마감과 상관없이
     잠겨 있었다 — 그래서 `d.days >= 0` 을 코드에서 **통째로 지워도 검사가 통과했다.**
     이 검사가 증명하려는 것은 '자격이 되는데도 마감이라 잠긴다'이다. */
  const WS_P = { school: '한국외국어대학교', campus: '', track: 'humanities', major: '영어학과',
    year: 3, status: '재학', gpa: 3.2, bracket: 6, credits: 14, region: '서울',
    parentRegion: '서울', nationality: 'korean', birthYear: 2004, flags: [], common: {} };
  const closed = reg2.items.find((x) => {
    if (!x.deadline || ddayFn(x.deadline).days >= 0) return false;
    if (!ME4.requirementLines(x, null).length) return false;
    return ['eligible', 'selective'].includes(ME4.evaluate(x, WS_P).status);
  });
  eq('  마감만 지난(자격은 통과) 공고를 실제로 골랐다 — 없으면 이 검사는 무의미하다', !!closed, true);
  if (closed) {
    const out = run([closed.id]);
    eq('마감 지난 공고는 신청 버튼 잠김이라고 말한다', /신청 버튼 잠김/.test(out), true);
  }

  /* 배지 문구를 손으로 옮겨 적으면 갈라진다 — 앱 함수를 가져다 쓰는지 소스로도 못 박는다 */
  const ws = readText(new URL('../verify/what-shows.mjs', import.meta.url));
  eq('앱 함수를 이름으로 떼어 온다 (사이를 잘라 오지 않는다)', /function takeFn\(name\)/.test(ws), true);
  eq('  배지는 앱의 fitBadgeHtml 이 낸 것을 쓴다', /fitBadgeHtml/.test(ws) && !/지원 자격 미달'/.test(ws), true);
  /* 🔴 주석을 걷어내고 본다 (2026-08-31 규명). 예전에는 `/d\.days >= 0/` 를 파일 전체에서
     찾았는데 **머리말 주석 두 줄에 그 글자가 있어**, 실제 판정 줄에서 지워도 통과했다.
     "검사가 조용하면 통과가 아니라 무력해진 것부터 의심한다"의 표본이다. */
  const wsCode = ws.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  /* 🔴 뜻은 그대로, 자리만 옮겼다 (2026-09-13). 예전에는 이 도구가 신청 버튼 조건을
     **제 사본**으로 들고 있었고(`const canApply = [...].includes(result.status) && d.days >= 0`),
     그래서 app.js 의 자격 잠금을 푼 뒤에도 이 도구만 계속 '잠김'이라 보고했다.
     지금은 앱의 `applyLock` 을 이름으로 가져다 부른다 — 검사는 '사본이 없는가'를 본다. */
  eq('  신청 버튼 판정은 앱의 applyLock 을 가져다 쓴다 (사본이 아니다)',
     /appFn\('applyLock'\)/.test(wsCode), true);
  eq('  제 사본을 다시 들지 않는다 (자격 목록을 직접 적지 않는다)',
     /\['eligible', ?'selective'\]/.test(wsCode), false);
  eq('  못 가져오면 조용히 넘어가지 않고 멈춘다', /throw new Error\(`app\.js 에서/.test(ws), true);
}

console.log('\n■ 이중수혜 — 가족 안의 이야기를 「다른 장학금 금지」로 읽지 않는다 (2026-09-13)');
{
  const PAx = createRequire(import.meta.url)('../parse-amount.js');
  const sc = (l) => { const r = PAx.exclusivityFrom([l]); return r.kind + '/' + r.scope; };
  /* 🔴 실제 원문이다. 한정어가 하나도 없어 기본값(external)에 떨어졌고, 교외 장학금을
     받는 학생이 이 공고에서 **미달**이 됐다(마감 9/28 인 살아 있는 공고였다).
     한 가족 안에서 두 사람이 같이 못 받는다는 말이지, 그 학생이 다른 장학금을 갖고
     있으면 안 된다는 말이 아니다. 틀린 미달은 못 받는 것보다 나쁘다. */
  eq('🔴 「1 가족당 형제·자매 … 동시 수혜 불가」는 자격을 막지 않는다 (narrow)',
     sc('나 . 1 가족당 형제 · 자매 합산하여 총 2 회에 한하여 지급 ( 동일 학기에 2 명 동시 수혜 불가 )'),
     'forbidden/narrow');
  /* ⚠️ 그러면서 **원래 막던 것은 계속 막아야 한다** — 여기가 무르면 이미 다른 재단
     장학금을 받는 학생이 서류를 다 준비하고 탈락한다(이 축을 만든 이유). */
  eq('  한정어 없이 남의 장학금을 말하는 줄은 그대로 external',
     sc('타 장학금과 중복 수혜 불가'), 'forbidden/external');
  eq('  넓은 표지(교외)도 그대로', sc('교외 장학금과 중복 수혜 불가'), 'forbidden/external');
  /* 🔴 가족 이야기 **더하기** 넓은 표지면 넓은 쪽이 이긴다 — 그 줄은 진짜 남의 장학금 이야기다 */
  eq('  가족 + 넓은 표지는 넓은 쪽이 이긴다',
     sc('형제·자매가 타 재단 장학금을 받는 경우 중복 수혜 불가'), 'forbidden/external');
  eq('  좁은 표지는 예전처럼 narrow', sc('근로장학금과 중복 수혜 불가'), 'forbidden/narrow');

  /* 로봇이 사람 값을 덮지 않는다 — 매일 돌게 되면서 생긴 위험이다 */
  const ea = readText(new URL('../collector/extract-amounts.mjs', import.meta.url));
  /* 🔴 **뜻으로 잰다 — 글자를 박지 않는다** (2026-09-17 고침). 예전엔 `!it.amountFrom`
     이라는 **옛 규칙의 생김새**를 박아 뒀는데, 그 규칙 자체가 거꾸로였다: 사람이 출처를
     적는 순간 로봇이 제 것으로 알고 지웠다. 관문이 그 결함을 지키고 있었던 셈이다.
     지금은 「로봇 표식이 아니면 사람」 — 옆 칸(exclusivityFrom·sameAsFrom)과 같은 뜻이다. */
  eq('금액 로봇이 사람이 넣은 값을 덮지 않는다 (주인 표식을 본다)',
     /amountFrom !== OWN_AMOUNT/.test(ea), true);
  eq('  표식이 없어야 사람이라던 옛 판정이 남아 있지 않다',
     /humanAmount = !it\.amountFrom &&/.test(ea), false);
  /* 🔴 `· 비움` 은 사람이 **틀린 금액을 지운** 조치다 (2026-09-17 · F-9 컨펌 2) — 값이 비었다고
     로봇에게 돌려주면 다음 실행이 같은 줄을 다시 읽어 같은 틀린 금액을 되채운다. */
  eq('  사람이 비운 금액도 되채우지 않는다 (틀린 금액을 지운 조치가 무효가 되지 않게)',
     /const amountCleared = \/\^관리자 \.\*· 비움\$\//.test(ea) && /humanAmount = amountCleared/.test(ea), true);
  eq('  sameAs 도 제가 붙인 것만 지운다', /it\.sameAsFrom === OWN_SAME/.test(ea), true);
  /* 🔴 다른 로봇은 전부 날짜만 적는다 — 여기만 시각까지 적으면 매 실행 파일이 더러워진다 */
  eq('  updatedAt 은 날짜만 적는다 (매 실행 더러워지지 않게)',
     /toISOString\(\)\.slice\(0, 10\)/.test(ea), true);
}

console.log('\n■ 금액을 로봇이 못 읽은 공고 — 사람이 적는다 (2026-09-17 · 노션 F-9 컨펌 2)');
{
  /* 🔴 왜 있나 — 개발자가 '관리자 화면에서 손으로 채운다' 로 정했다(다른 안이던 본문 재수집
     로봇은 고르지 않았다). 그런데 **숫자만 넣으면 감사가 묶음 전체를 되돌린다**:
     entry-rules 는 `amountValue > 0` 인데 카드 문구에 숫자가 없으면 오류로 잡는다
     (카드는 '금액 원문 확인', 합계는 500만원이라고 서로 다른 말을 하기 때문이다).
     그래서 문구를 만드는 규칙이 **한 곳**이어야 하고, 화면의 전후 대조도 같은 것을 써야 한다. */
  const ed = readText(new URL('../tools/edit-diff.mjs', import.meta.url));
  const aa = readText(new URL('../tools/admin-apply.mjs', import.meta.url));
  const ea = readText(new URL('../collector/extract-amounts.mjs', import.meta.url));
  const adminJs = readText(new URL('../_admin/admin.js', import.meta.url));
  const { wonText, amountText, amountAfterValue, diffPatch: dp } = await import('../tools/edit-diff.mjs');

  eq('금액 문구를 만드는 규칙이 한 곳이다 (로봇이 가져다 쓴다)',
     /import \{ amountText \} from '\.\.\/tools\/edit-diff\.mjs'/.test(ea), true);
  /* 🔴 베끼면 로봇이 적는 문구와 사람이 적을 때 붙는 문구가 갈라진다 */
  /* ⚠️ **꼴을 하나만 찾으면 사본을 놓친다** (2026-09-18 코드 리뷰) — 예전엔 로봇에서는
     `const wonText =`, 화면에서는 `function wonText` 만 찾아서, 서로 반대 꼴로 베끼면
     그냥 통과했다. 두 파일에 같은 잣대를 댄다. */
  const copiesWonText = (t) => /(?:const|let|var|function)\s+wonText\b/.test(t);
  eq('  로봇·화면이 제 사본을 다시 만들지 않는다',
     copiesWonText(ea) || copiesWonText(adminJs), false);
  eq('  화면도 같은 파일에서 가져온다',
     /import \{[^}]*wonText[^}]*\} from '\.\/vendor\/edit-diff\.mjs'/.test(adminJs), true);

  eq('만원으로 딱 떨어지면 만원, 아니면 원',
     [wonText(5000000), wonText(1234000), amountText({ kind: 'range', min: 1000000, max: 3000000 })],
     ['500만원', '1,234,000원', '100만원 ~ 300만원']);
  /* 🔴 이미 숫자가 든 문구는 건드리지 않는다 — 사람이 다듬은 뜻을 맨 숫자로 덮으면 사라진다 */
  eq('이미 숫자가 든 문구는 덮지 않는다',
     amountAfterValue('등록금 + 영농정착 지원 300만원', 5000000), '등록금 + 영농정착 지원 300만원');
  eq('  숫자가 없는 문구에만 넣는다', amountAfterValue('금액 원문 확인', 5000000), '500만원');
  eq('  비우는 조치는 문구를 건드리지 않는다 (무엇으로 되돌릴지 모른다)',
     amountAfterValue('금액 원문 확인', 0), '금액 원문 확인');

  /* 화면이 예고한 칸과 저장소가 고치는 칸이 같아야 한다 */
  const rows = dp({ id: 'x', amount: '금액 원문 확인', amountValue: 0 }, { amountValue: 3000000 });
  eq('화면의 전후 대조가 카드 문구까지 예고한다',
     rows.map((r) => `${r.key}=${r.after}`), ['amountValue=3000000', 'amount=300만원']);
  eq('  저장소가 같은 함수를 쓴다', /amountAfterValue\(it\.amount, it\.amountValue\)/.test(aa), true);
  /* 🔴 표식이 없으면 로봇이 다음 날 아침에 덮는다 — 비울 때도 남긴다(마감일과 같은 이유) */
  eq('  관리자가 금액을 고치면 표식을 남긴다',
     /changed\.includes\('amountValue'\)/.test(aa)
     && /it\.amountFrom = Number\(it\.amountValue\) > 0 \? OWNER : `\$\{OWNER\} · 비움`/.test(aa), true);
  /* 🔴 **비울 때는 로봇이 읽어 둔 구조도 함께 지워야 한다** — 합계는 amountSpec 을 먼저 보고
     amountValue 는 그것이 없을 때만 본다. 안 지우면 사람이 '틀렸다' 고 지운 금액이 학생
     화면에 그대로 떠 있는다(받을 수 없는 숫자를 보여 주는 일). 아래 한 줄이 그 근거다. */
  const PAa = createRequire(import.meta.url)('../parse-amount.js');
  eq('  (근거) 합계는 amountSpec 을 먼저 본다 — 그래서 숫자만 비우면 티가 안 난다',
     PAa.amountWon({ amountSpec: { kind: 'fixed', value: 2500000 }, amountValue: 0 }, 0), 2500000);
  /* 🔴 **여기서 글자로 재지 않는다** — 이 규칙이 진짜 도는지는 아래 「관리자 쓰기」 절이
     `admin-apply.mjs` 를 자식 프로세스로 돌려 본다(ⓓ~ⓕ). 코드 리뷰가 실증했듯, 정규식으로
     재면 조건을 죽이고 그 문장을 주석에 남기는 것만으로 초록불이 된다. */

  /* 🔴 화면은 금액을 짐작하지 않는다(원칙 8-1) · 숫자 한 칸으로 못 적는 것은 비워 둔다 */
  eq('화면이 금액을 짐작하지 않는다고 말한다', /화면은 금액을 짐작하지 않습니다/.test(adminJs), true);
  eq('  자릿수 실수를 막는 천장이 있다 (만원 칸에 원을 치면 300억이 된다)',
     /n > MAN_MAX/.test(adminJs) && /const MAN_MAX = 10000/.test(adminJs), true);
  /* 🔴 학생 화면에 없는 공고를 할 일로 올리면 잡음이 된다 — 잡음이 된 관문·목록은 꺼진다 */
  eq('  마감이 지난 공고는 적는 목록에 올리지 않는다',
     /dday\(it\.deadline\) == null \|\| dday\(it\.deadline\) >= 0/.test(adminJs), true);
  eq('  품질 카드도 같은 셈을 쓴다 (카드 숫자와 줄 수가 갈라지지 않게)',
     /const noAmount = noAmountItems\(\)\.length/.test(adminJs), true);
}

console.log('\n■ 만들어 놓고 안 돌리는 로봇이 없는가 (2026-09-13 · 노션 F-9)');
{
  /* 🔴 왜 있나 — `collector/extract-amounts.mjs` 는 2026-08-27 에 만들어졌는데
     **어느 워크플로에도 걸려 있지 않았다.** 그래서 원문에 `장학금액 : 최대 1,000,000 원`
     이라고 또렷이 적혀 있는데도 registered.json 은 '금액 원문 확인' 인 채였다 —
     실측으로 마감 전 20건 중 금액을 아는 것이 **2건**뿐이었고, 한 번 돌리니 14건이 찼다.
     이 저장소가 이미 배운 문장 그대로다: **안내문에 적는 것은 리포트고, 강제하는 것은
     워크플로와 훅뿐이다.** 같은 일이 또 생기지 않게 여기서 못 박는다.
     ⚠️ 목록을 넓히려면 '데이터를 고쳐 저장하는 로봇' 만 넣는다 — 조회·리포트 로봇까지
        넣으면 관문이 잡음이 되고, 잡음이 된 관문은 꺼진다. */
  const MUST_RUN = [
    ['collector/extract-amounts.mjs', '금액·이중수혜를 원문에서 읽어 registered.json 에 넣는다'],
    ['collector/extract-excerpts.mjs', '원문 발췌·마감일을 registered.json 에 넣는다'],
  ];
  /* 🔴 **주석을 걷고 본다** — 안 걷으면 "이 로봇이 안 걸려 있었다" 고 적어 둔 **설명 주석**의
     글자를 읽고 통과한다. 만들면서 실제로 그랬다: 단계를 통째로 지웠는데도 초록불이었다.
     (2026-09-10 서체 관문·2026-08-31 what-shows 관문이 똑같이 새던 자리다.) */
  const stripYmlComments = (t) => t.split('\n').filter((l) => !/^\s*#/.test(l)).join('\n');
  const wf = fs.readdirSync(new URL('../.github/workflows/', import.meta.url))
    .filter((f) => f.endsWith('.yml'))
    .map((f) => stripYmlComments(readText(new URL('../.github/workflows/' + f, import.meta.url))))
    .join('\n');
  for (const [file, what] of MUST_RUN) {
    eq(`${file} 을 실제로 돌리는 워크플로가 있다 (${what})`, wf.includes(file), true);
  }
}

console.log('\n■ 지역 요건 — 거주지·학교 위치·출신 고교를 가른다 (2026-09-13 · 노션 백로그 G-6)');
{
  const MEg = createRequire(import.meta.url)('../match-engine.js');
  const PRg = createRequire(import.meta.url)('../parse-requirements.js');
  const res = (t) => PRg.parseLine(t, false).conds.find((c) => c.kind === 'residence') || null;
  const about = (t) => (res(t) || {}).about || null;

  /* 🔴 왜 있나 — 지역 이름이 있는데 지역 조건이 **아예 안 만들어지는** 줄이 6건이었다.
     안 잡힌 절은 보이지 않으므로, 같은 줄의 쉬운 절 하나(`재학생`)가 맞으면 줄 전체에
     ✓ 가 붙는다. 실측: 다섯 줄이 전부 서울 학생에게 **✓ 충족**이었다(틀린 안심).
     아래 여덟 줄은 **전부 실제 원문**이다(등록 + 한국장학재단). */

  /* ① 거주지 — 프로필에 칸이 있다. 판정한다. */
  eq('① 낱말 없이 지역만 적은 줄도 거주지로 읽는다 (세종)',
     about('(신청자격) 세종특별자치시 초·중·고·대학생(재학생)'), 'home');
  eq('  「완도군 청소년」도 거주지다', about('완도군 청소년으로서 만29세 이하인 자'), 'home');
  eq('  예전 낱말 문턱도 그대로 (거주·주소)',
     about('공고일 현재 부 또는 모가 1년 이상 계속하여 정읍시에 주소를 두고 있는 국내 대학의 재학생'), 'home');

  /* ② 학교 위치 — **앱은 학교 소재지를 모른다**(data.js 의 UNIVERSITIES 는 이름 목록뿐) */
  eq('② 「○○시 소재 대학」은 학교 위치다 (거주지가 아니다)',
     about('울산시 소재 대학에 재학 중인 학생'), 'school');
  eq('  「연접 지역에 있는 대학교」도 학교 위치다',
     about('포항시 및 포항시와 연접 지역에 있는 대학교 재학생'), 'school');

  /* ③ 출신 고교 — 앱이 묻지 않는 항목이다 */
  eq('③ 「○○시 소재 고등학교 졸업자」는 출신 고교다',
     about('울산시 소재 고등학교 졸업자인 대학교 재학생'), 'origin');
  eq('  「○○ 소재 고등 및 중등 과정을 마친 자」도 출신 고교다',
     about('2. 장학생 신청 조건 : 전남 목포 소재 고등 및 중등 과정을 마친 자'), 'origin');

  /* 🔴 **거주를 말하는 낱말이 있으면 그것이 이긴다** — 이걸 빠뜨려 회귀를 만들었다.
     `…정읍시에 주소를 두고 **있는** 국내 **대학**의 재학생` 이 ②로 떨어져 원래 ✕ 던 것이
     '모른다'가 됐다. 정읍 사람이 아닌 학생이 자기가 된다고 읽게 되는 후퇴다. */
  eq('🔴 「주소를 두고 있는 … 대학」은 학교 위치가 아니라 거주지다 (회귀 방지)',
     about('공고일 현재 본인이 포항시에 1년 이상 계속하여 주민등록이 되어 있는 자'), 'home');

  /* ── 판정 — ②③ 은 '모른다'다. ✕ 를 만들지 않는다. ── */
  const mk = (line) => ({ id: 'x', name: '장학생', provider: '재단', type: '교외', amount: '-',
    amountValue: 0, deadline: '2026-12-31', period: '-', summary: '-',
    eligibility: { selective: true }, documents: [], eligibilityLines: [line] });
  const seoul = { school: '한국외국어대학교', campus: '', track: 'humanities', major: '영어',
    year: 3, status: '재학', gpa: 3.5, bracket: 5, credits: 15, region: '서울', regionCity: '동대문구',
    parentRegion: '서울', parentRegionCity: '동대문구', nationality: 'korean', birthYear: 2004,
    flags: [], cert: false, exchange: false, common: {} };
  const verdict = (line, over) => {
    const fd = MEg.fitDetail(mk(line), { ...seoul, ...over });
    return fd.fails.length ? '미달' : (fd.met > 0 ? '충족' : '모른다');
  };

  /* 🔴 이 넷이 이 절의 핵심이다 — 고치기 전에는 **전부 '충족'** 이었다(실측).
     되돌리면 여기가 빨간불이다. */
  eq('🔴 서울 학생에게 세종 공고가 「충족」이 아니다',
     verdict('(신청자격) 세종특별자치시 초·중·고·대학생(재학생)') !== '충족', true);
  eq('🔴 학교 위치는 「모른다」다 (미달로 단정하지 않는다)',
     verdict('울산시 소재 대학에 재학 중인 학생'), '모른다');
  eq('  서울 학생이 포항공대에 다닐 수 있다 — 그래서 ✕ 를 치지 않는다',
     verdict('포항시 및 포항시와 연접 지역에 있는 대학교 재학생'), '모른다');
  eq('🔴 출신 고교도 「모른다」다 (앱이 묻지 않는 항목이다)',
     verdict('울산시 소재 고등학교 졸업자인 대학교 재학생'), '모른다');

  /* ① 은 실제로 판정한다 — 사는 곳이 다르면 미달, 맞으면 충족 */
  eq('완도 학생은 완도 공고에 충족',
     verdict('완도군 청소년으로서 만29세 이하인 자',
       { region: '전남', regionCity: '완도군', parentRegion: '전남', parentRegionCity: '완도군' }), '충족');
  eq('  서울 학생은 미달 (사는 곳이 다르다)', verdict('완도군 청소년으로서 만29세 이하인 자'), '미달');

  /* ── 🔴 넓히다가 실제로 만든 회귀 둘 — 되돌아오면 여기서 잡는다 ── */
  /* ⚠️ `자녀를 둔 **가구** 학생에 배정` 의 `가구` 를 시·군·구로 읽어 상주시장학회가
     **모든 학생에게 틀린 미달**이 됐다. 틀린 미달은 못 받는 것보다 나쁘다. */
  eq('🔴 「가구 학생」의 가구를 시·군·구로 읽지 않는다 (틀린 미달을 만들었다)',
     verdict('직전 학기 10학점 이상 이수하고 성적이 B+학점 이상인 자 - 다자녀: 선발인원 중 일부를 3명 이상의 자녀를 둔 가구 학생에 배정') !== '미달', true);
  /* ⚠️ **다리가 낱말을 자르면 안 된다** — `장학생` 가운데의 `학생` 이 걸려
     `불참시` 가 지역이 됐고, 그 공고가 모든 학생에게 틀린 미달이 됐다(코드 리뷰). */
  eq('🔴 「장학생」 가운데의 「학생」을 집지 않는다 (불참시)',
     res('장학금 수여식 불참시 장학생 선발 취소'), null);
  /* ⚠️ **흔한 낱말(학생·자녀)은 시·도 공식 표기와 함께일 때만** — 안 그러면 시·군·구 꼬리말로
     끝나는 보통명사가 전부 지역이 된다(`다자녀가구`·`발생시`). */
  eq('🔴 「다자녀가구 자녀」의 가구를 지역으로 읽지 않는다',
     res('가정형편이 어려운 자 또는 다자녀가구 자녀로서 셋째이상인 자'), null);
  eq('  「울주군 대학생 장학금 수혜자」도 (장학금 이름이지 거주 요건이 아니다)',
     res('2025년도 울주군 대학생 장학금 수혜자'), null);
  /* 🔴 그러면서도 진짜 둘은 계속 받는다 — 위 ① 항목들이 그것을 못 박는다 */

  /* ── 🔴 제외 줄의 지역 이름은 판정하지 않는다 (코드 리뷰 · 실측으로 확인) ── */
  {
    const exSch = { id: 'x', name: '장학생', provider: '(재)영동군민장학회', type: '교외',
      amount: '-', amountValue: 0, deadline: '2026-12-31', period: '-', summary: '-',
      eligibility: { selective: true }, documents: [], eligibilityLines: ['국내 4년제 대학 재학생'],
      eligibilityExcludes: ['(재)영동군민장학회 장학생으로 선발되어 재학 중 2회 이상 장학금을 받은 자'] };
    const vOf = (over) => MEg.fitDetail(exSch, { ...seoul, ...over }).fails.length;
    /* 이 줄은 '이미 두 번 받은 사람을 뺀다'는 뜻인데, 시·군 규칙이 '영동군에 살아야 한다'로
       읽어 서울 학생이 미달이 됐다 — 한 번도 받은 적 없는 학생이다. */
    eq('🔴 제외 줄의 기관 이름을 거주 요건으로 읽지 않는다 (서울 학생)', vOf({}), 0);
    /* ⚠️ 뒤집어서 '안 살면 통과'로 만들지도 않는다 — 그러면 이번엔 그 지역 학생이 미달이 된다 */
    eq('  그 지역 학생도 미달이 아니다 (뒤집어 고치지 않았다)',
       vOf({ region: '충북', regionCity: '영동군', parentRegion: '충북', parentRegionCity: '영동군' }), 0);
  }

  /* ⚠️ `서울캠퍼스` 는 지역이 아니라 캠퍼스 이름이다 — 지역으로 읽으면 한국외대 서울캠퍼스
     공고가 경기 사는 학생에게 틀린 미달이 된다. 방어선은 '이름 바로 뒤가 띄어쓰기인가'다. */
  eq('🔴 「서울캠퍼스」를 지역으로 읽지 않는다', res('가. 2026년도 2학기 서울캠퍼스 재학생'), null);
  eq('  「( 서울 및 글로벌 )」도 캠퍼스 이야기다',
     res('2. 지원자격 : 2026-1 학기 학부 재학생 ( 서울 및 글로벌 ) 으로 평점 3.5 이상인 학생'), null);
  /* ⚠️ 재단 주소 줄에 시·군·구가 잔뜩 들어 있다 — 요건이 아니다 */
  eq('  재단 주소 줄을 요건으로 읽지 않는다',
     res('[13620] 경기도 성남시 분당구 구미로 173번길 82 분당서울대학교병원 2동 7층 외과 7714호 (동산장학회)'), null);
}

console.log('\n■ 신청 잠금 — 자격 판정으로는 막지 않는다 (2026-09-13 · 노션 백로그 핵심-2)');
{
  /* 🔴 왜 있나 — 우리 판정은 100% 가 아니다. 원문을 못 받았거나(`unknown`) 축이 없어서
     미달이 된 공고가 실제로는 신청 가능한데, 버튼을 잠가 버리면 그 학생은 받을 수 있는
     장학금을 **영영 못 본다**(개발자가 백로그에 적어 둔 이유 그대로).
     ⚠️ 그렇다고 **전부** 열면 안 된다 — 마감은 우리 판정이 아니라 사실이므로 계속 막는다.
        이 절은 '무엇이 열렸는가'와 '무엇이 여전히 막히는가'를 **둘 다** 못 박는다.

     🔴 규칙을 베끼지 않는다 — app.js 의 `applyLock` 을 이름으로 떼어 내 그대로 돌린다.
        (손으로 옮겨 적으면 app.js 가 바뀌어도 이 검사는 계속 통과한다.) */
  const src = readText(new URL('../app.js', import.meta.url));
  const grab = (name) => {
    const m = src.match(new RegExp(`^function ${name}\\([\\s\\S]*?^\\}`, 'm'));
    if (!m) throw new Error(`app.js 에서 ${name}() 을 못 찾았습니다 — 최상위 함수가 아니거나 이름이 바뀌었습니다.`);
    return m[0];
  };
  const applyLock = new Function(`${grab('applyLock')}\nreturn applyLock;`)();

  const open = { days: 5 }, closed = { days: -1 };
  const R = (status) => ({ status });

  eq('자격 통과는 열린다', applyLock(R('eligible'), null, open).canApply, true);
  eq('선발 심사도 열린다', applyLock(R('selective'), null, open).canApply, true);
  /* 🔴 이 둘이 이 절의 핵심이다 — 되돌리면(자격 목록을 canApply 에 다시 넣으면) 여기가 빨간불이다 */
  eq('🔴 요건 미달이어도 열린다 (판정은 참고, 결정은 학생)', applyLock(R('ineligible'), null, open).canApply, true);
  eq('🔴 자격을 못 읽었어도 열린다 (unknown 은 미달이 아니다)', applyLock(R('unknown'), null, open).canApply, true);

  /* 🔴 열었다고 **아무 말 없이** 열면 안 된다 — 무엇을 확인해야 하는지 말해야 한다(원칙 8-1) */
  eq('미달일 때는 안내가 붙는다', applyLock(R('ineligible'), null, open).caution, 'ineligible');
  eq('  못 읽었을 때도 안내가 붙는다', applyLock(R('unknown'), null, open).caution, 'unknown');
  /* 🔴 **둘을 뭉뚱그리지 않는다** — 학생이 해야 할 일이 다르다(읽어 보라 ↔ 따져 보라).
     2026-09-09 에 버튼 문구는 갈랐는데 잠금은 안 갈랐던 것이 이 업무의 출발점이다. */
  eq('  두 갈래가 서로 다른 값이다 (뭉뚱그리지 않는다)',
     applyLock(R('ineligible'), null, open).caution !== applyLock(R('unknown'), null, open).caution, true);
  eq('자격 통과에는 안내를 붙이지 않는다 (없는 걱정을 만들지 않는다)',
     applyLock(R('eligible'), null, open).caution, '');

  /* 🔴 **여기는 계속 막힌다** — 우리 판정이 아니라 사실이라서다 */
  eq('마감된 공고는 여전히 잠긴다', applyLock(R('eligible'), null, closed).canApply, false);
  eq('  마감이면 안내도 안 붙는다 (누를 수 없는 버튼에 붙는 안내는 잡음이다)',
     applyLock(R('ineligible'), null, closed).caution, '');
  eq('이미 신청 준비를 마친 공고는 잠긴다', applyLock(R('eligible'), { pending: false }, open).canApply, false);
  eq('  쓰다 만 것은 이어서 할 수 있다', applyLock(R('eligible'), { pending: true }, open).canApply, true);

  /* 🔴 화면 문구가 되돌아가는 것도 막는다 — '신청할 수 없음'은 이제 **사실이 아니다** */
  const appCode = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  eq("버튼 문구에 '신청할 수 없음'이 없다 (주석 말고 코드에서)",
     /신청할 수 없음/.test(appCode), false);
  eq('자격이 못 미더우면 버튼 위에 안내를 그린다', /dp-caution/.test(appCode), true);

  /* 🔴 **일괄 신청 준비는 일부러 안 열었다** — 여러 건을 한꺼번에 고르는 자리라 미달까지
     섞으면 학생이 무엇을 고른 것인지 알 수 없게 된다. 누가 '일관성'을 이유로 여기까지
     열어 버리는 것을 막는다(열려면 화면 설계부터 다시 해야 한다). */
  eq('일괄 신청 준비는 자격 통과분만 담는다 (여기는 안 열었다)',
     /function bulkTargets\(\)[\s\S]{0,400}?\['eligible', 'selective'\]/.test(appCode), true);
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
  const src = readText(new URL('../verify/eligibility-report.mjs', import.meta.url));

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
    const t = codeOnly(readText(new URL(`../verify/${f}`, import.meta.url)));
    return (t.match(/\.pct\s*(===|!==|>=|<=|>|<)\s*\d+/g) || []).map((m) => `${f}: ${m}`);
  });
  eq('적합도를 읽는 도구가 점수를 숫자와 직접 비교하지 않는다', hard.join(' · '), '');
  /* 미달을 세는 도구가 실제로 셀 수 있는가 — 조건이 참이 될 수 있는지 못 박는다.
     (8/26 이후 fit-report 는 '0% 0건'만 답했다. 안 세는 검사는 통과해도 무의미하다) */
  eq('미달을 fails 로 센다 (점수로 세면 상수가 바뀔 때 0건이 된다)',
     /!r\.f\.unread && r\.f\.fails\.length/.test(
       readText(new URL('../verify/fit-report.mjs', import.meta.url))), true);

  /* 확정 미달은 ✕가 있는 것이 **정상**이다 — 그걸 모순이라 부르면 안 된다 */
  const 미달 = M.fitDetail(
    { eligibilityLines: ['직전학기 평점 4.0 이상인 학생'], eligibilityExcludes: [] },
    { gpa: 2.3, bracket: 9, year: 2, status: '재학', credits: 12, nationality: 'korean', flags: [] });
  eq('평점 미달 학생의 적합도는 FIT_MIN 이다', 미달.pct, M.FIT_MIN);
  eq('  그리고 사유가 함께 있다 (사유 없는 미달은 없다)', 미달.fails.length > 0, true);
}

/* ■ 말투·토큰 관문이 워크플로에 걸려 있는가 (2026-08-31)
   🔴 이 저장소가 이미 겪은 사고다 — 검사를 만들어 두고 워크플로에 안 걸어서
      31개 중 5개만 돌고 7개가 깨진 채 방치됐다. **관문은 걸려 있어야 관문이다.** */
console.log('\n■ 화면 말투·토큰 관문이 살아 있는가');
{
  eq('verify/ui-tone.mjs 가 있다', fs.existsSync(new URL('../verify/ui-tone.mjs', import.meta.url)), true);
  const wf = readText(new URL('../.github/workflows/verify-ui.yml', import.meta.url));
  eq('워크플로가 그것을 실제로 돌린다', /node verify\/ui-tone\.mjs/.test(wf), true);
  /* ⚠️ 2026-09-09 에 감시 목록을 파일 이름 나열에서 **글로브**로 바꿨다(여덟이 빠져 있었다).
     그래서 여기서는 글자 그대로 찾지 않는다 — 지키려는 것은 '이름이 적혀 있는가'가 아니라
     **'css 가 바뀌면 이 관문이 도는가'** 이고, 그 대조는 아래 「CI 감시 범위」 절이 전수로 한다. */
  eq('style.css 가 바뀔 때도 돈다', /- '(?:style[.]css|[*][.]css)'/.test(wf), true);
}

console.log('\n■ 로봇이 조용히 죽지 않는다 (2026-09-06)');
/* 🔴 이 절이 잡는 사고 셋 — 공통점은 **오류가 하나도 안 난다**는 것이다.
   ① browser-collect 가 브라우저로 그린 본문을 저장하는 줄에서 선언 없는 이름(`today`)을 써서,
      2026-08-20 에 그 줄을 넣은 뒤 **한 번도 성공한 적이 없었다** (browser-bodies.json 68건이
      전부 rescue 가 넣은 것). 게다가 catch 가 학교 단위라 그 학교의 남은 공고까지 함께 날아갔고,
      리포트는 '학교 서버가 응답하지 않아'라고 **틀린 원인**을 적었다.
   ② collect 가 학교별 파일을 '새로 주운 것'만으로 발행하면, 링크 사냥꾼·주소 복구가 고친 주소가
      영영 앱에 안 닿는다 — 그 둘은 publishBySchool 을 부르지 않는다(주소만 고친다).
   ③ 예약 로봇이 시한 없이 매달리거나(기본 6시간) 넘어져도 알림이 없으면 아무도 모른다.
   ⚠️ ①은 일반적인 '선언 없는 변수' 검사로는 못 잡는다 — 위 undeclaredNames 는 대문자 상수만 본다.
      소문자까지 넓히려면 스코프 분석(=린터)이 필요하고, 틀린 빨간불은 다음 사람이 검사를 끄게
      만든다. 그래서 이 저장소 방식대로 **표적 회귀**로 못 박는다. */
{
  const bc = readText(new URL('../collector/browser-collect.mjs', import.meta.url));
  eq('브라우저가 그린 본문을 저장한다 (뽑고 버리지 않는다)', bc.includes('bodies[it.url] = {'), true);
  eq('  그 줄의 날짜가 선언된 이름이다 (todayStr)', bc.includes('at: todayStr'), true);
  eq('  선언되지 않은 today 를 쓰지 않는다', bc.includes('at: today,'), false);

  const cl = readText(new URL('../collector/collect.mjs', import.meta.url));
  eq('학교별 파일은 전체 목록으로 발행한다 (freshAll 이 아니다)',
    cl.includes('publishBySchool(beforeCap)'), true);

  /* 예약으로 도는 로봇은 전부 ⓐ시한 ⓑ실행 알림을 갖는다.
     ⓑ는 failure() 와 cancelled() **둘 다** 봐야 한다 — 시간 초과는 '실패'가 아니라 '취소'라
     failure() 만 쓰면 알림 단계가 통째로 건너뛰어진다 (2026-08-04 수집 로봇 사고). */
  const wfDir = new URL('../.github/workflows/', import.meta.url);
  const noTimeout = [], noAlert = [];
  for (const f of fs.readdirSync(wfDir).filter((n) => n.endsWith('.yml')).sort()) {
    const raw = readText(new URL(f, wfDir));
    const code = raw.split(/\r?\n/).filter((l) => !/^\s*#/.test(l)).join('\n');
    if (!/^\s*- cron:/m.test(code)) continue;      // 예약이 없으면 이 절의 대상이 아니다
    if (!code.includes('timeout-minutes:')) noTimeout.push(f);
    if (!code.includes('failure()') || !code.includes('cancelled()')) noAlert.push(f);
  }
  eq('예약 로봇은 모두 시한(timeout-minutes)을 갖는다', noTimeout, []);
  eq('예약 로봇은 모두 failure() 와 cancelled() 를 함께 본다', noAlert, []);

  /* 두 번째 겹 — '아예 안 돈 것'은 위 두 항목으로 못 잡는다(실행 기록 자체가 없다).
     GitHub 은 예약을 실제로 거른다(2026-07-06 완전 누락). 하트비트가 그 자리를 맡는다. */
  eq('하트비트 로봇이 있다', fs.existsSync(new URL('robot-heartbeat.yml', wfDir)), true);
}

console.log('\n■ 하트비트 간격 계산 (브라우저·인터넷 불필요)');
{
  eq('하루 2회면 12시간 간격', hoursFor(['41 22 * * *', '41 2 * * *']), 12);
  eq('하루 1회면 24시간', hoursFor(['23 5 * * *']), 24);
  eq('요일이 **하나**면 주 1회', hoursFor(['13 20 * * 1']), 168);
  eq('예약이 없으면 판정하지 않는다', hoursFor([]), null);

  /* 🔴 2026-09-13 수리 — 옛 판은 요일 칸이 `*` 가 아니기만 하면 무조건 168시간으로 봤다.
     그래서 아래 둘이 조용히 틀렸고, **위 검사 넷은 그때도 전부 통과했다**(그게 이 버그가
     오래 산 이유다). 요일·시각 칸에 **적힌 개수**를 세야 한다.
     · 한국장학재단 수확은 월·목 주 2회인데 7일에 1회로 읽혀 경보 문턱이 21일이었다.
       21일이면 층2 90곳 중 72곳이 이미 마감이다(실측) — 목록이 거의 빈 뒤에 알림이 온다.
     · 인스타 댓글은 세 시간마다인데 '하루 1회'로 읽혔다(문턱 3일 → 9시간). */
  eq('요일이 둘이면 주 2회 (kosaf-fetch: 월·목)', hoursFor(['53 20 * * 1,4']), 84);
  eq('시각 칸의 건너뛰기를 센다 (insta-comments: 세 시간마다)', hoursFor(['29 */3 * * *']), 3);
  eq('요일 범위를 센다 (평일만)', hoursFor(['0 9 * * 1-5']), 33.6);
  eq('달이 지정되면 판정하지 않는다', hoursFor(['0 9 1 1 *']), null);
  eq('  칸 하나 세기 — 전부', countField('*', 'hour'), 24);
  eq('  칸 하나 세기 — 건너뛰기', countField('*/3', 'hour'), 8);
  eq('  칸 하나 세기 — 나열', countField('1,4', 'dow'), 2);
  eq('  칸 하나 세기 — 범위', countField('1-5', 'dow'), 5);
  eq('  한 줄이 주당 몇 번', runsPerWeek('53 20 * * 1,4'), 2);
  /* 🔴 84시간을 '4일에 1회'라고 적으면 사람이 읽는 뜻이 어긋난다 */
  eq('사람이 읽는 간격 문구 — 주 2회', everyWords(84), '주 2회');
  eq('  하루 8회', everyWords(3), '하루 8회');
  eq('  7일에 1회', everyWords(168), '7일에 1회');
  eq('  판정 못 한 것은 그렇게 적는다', everyWords(null), '판정 안 함');
  /* 주석에 적힌 cron 은 세지 않는다 — 세면 간격이 짧아져 헛알림이 난다 */
  eq('주석의 cron 은 안 센다',
    cronsOf("#    - cron: '2 3 * * *'\n    - cron: '4 5 * * *'"), ['4 5 * * *']);
  const now = Date.parse('2026-09-06T00:00:00Z');
  eq('간격의 3배를 넘으면 조용한 것', isStale(24, '2026-09-01T00:00:00Z', now), true);
  eq('  3배 안이면 정상 (GitHub 이 몇 시간 미루는 건 정상이다)',
    isStale(24, '2026-09-04T12:00:00Z', now), false);
  eq('  성공 기록이 아예 없으면 조용한 것', isStale(24, null, now), true);

  /* 🔴 위 검사들은 **글자로 쓴 cron** 을 본다 — 셈이 되돌아가면 잡히지만, 저장소의 진짜
     예약이 어떻게 읽히는지는 못 본다. 층2 수확이 정확히 그 자리에서 조용히 틀렸다:
     월·목(주 2회)인데 '주 1회'로 읽혀 경보 문턱이 21일이었고, 21일이면 층2 90곳 중
     72곳이 이미 마감이다(실측). 그래서 **진짜 파일**로 한 번 더 잰다. */
  const wfOf = (f) => readText(new URL(`../.github/workflows/${f}`, import.meta.url));
  const kosafH = hoursFor(cronsOf(wfOf('kosaf-fetch.yml')));
  eq('한국장학재단 수확의 예약을 진짜 파일에서 읽는다', typeof kosafH === 'number', true);
  eq('  주 1회보다 자주 도는 것으로 읽는다 (요일 셈이 되돌아가면 여기서 걸린다)',
    kosafH < 168, true);
  eq('  사람이 읽는 문구도 주 1회가 아니다', everyWords(kosafH) !== '7일에 1회', true);
  /* 인스타 댓글은 세 시간마다다 — '하루 1회'로 읽히면 문턱이 3일이 된다 */
  const cmtH = hoursFor(cronsOf(wfOf('insta-comments.yml')));
  eq('  인스타 댓글은 하루 한 번보다 자주 도는 것으로 읽는다', typeof cmtH === 'number' && cmtH < 24, true);
}

console.log('\n■ 검사가 개발자 컴퓨터에서만 실패하지 않는다 (2026-09-06)');
/* 🔴 이 저장소는 같은 함정에 세 번 빠졌다. 셋 다 **리눅스(클라우드)에서는 멀쩡하고
   윈도우에서만 죽는다** — 그래서 로봇은 초록불인데 개발자 화면만 늘 빨간불이었다.
     ① URL.pathname 을 경로로 씀 → `/C:/…` 는 유효한 경로가 아니다 (검사 5건, 2026-09-05 수리)
     ② import() 에 파일 경로를 넘김 → ESM 로더가 `c:` 를 프로토콜로 읽는다
        (verify-push-server 74항목이 **한 번도 안 돌았다**, 2026-09-06 수리)
     ③ 파일을 읽고 LF(`\n`)를 글자 그대로 찾음 → 디스크에는 CRLF 다 (검사 4건, 2026-09-06 수리)
   🔴 늘 켜져 있는 빨간불은 신호가 아니다. 진짜 실패가 5건째로 섞여도 눈에 안 띈다. */
{
  const vDir = new URL('../verify/', import.meta.url);
  const files = fs.readdirSync(vDir).filter((n) => /\.(mjs|cjs|js)$/.test(n));
  const badImport = [], badPath = [];
  for (const f of files) {
    const src = readText(new URL(f, vDir));
    /* import(…) 에 경로를 그대로 넘기면 윈도우에서 죽는다 — pathToFileURL 로 감싸야 한다 */
    for (const m of src.matchAll(/import\(([^)]*)\)/g)) {
      const arg = m[1];
      if (/path\.join|__dirname|ROOT/.test(arg) && !/pathToFileURL/.test(arg)) badImport.push(f);
    }
    /* .pathname 을 파일 경로로 쓰면 윈도우에서 `/C:/…` 가 된다 */
    if (/\)\.pathname/.test(src) && !/\/\* *윈도우/.test(src)) badPath.push(f);
  }
  eq('import() 에 경로를 그대로 넘기지 않는다 (pathToFileURL)', [...new Set(badImport)], []);
  eq('URL.pathname 을 파일 경로로 쓰지 않는다 (fileURLToPath)', [...new Set(badPath)], []);

  /* 이 파일 자신도 우회하지 않는다 — 읽는 자리는 readText 하나여야 한다 */
  const self = readText(new URL('test-collector.mjs', vDir));
  eq('이 검사는 파일을 readText 로만 읽는다 (줄바꿈 통일)',
    // 바늘을 쪼개 넣는다 — 통째로 적으면 이 줄 자신이 걸려 영영 2가 된다
    self.split("fs.read" + "FileSync(").length - 1, 1);   // readText 정의 안의 1회뿐
}


/* ══ 첫 실행 화면 · 이어보기 (2026-09-09 · 노션 원문 목록 4번) ══════════════
   설계: docs/designs/first-run-and-resume.md

   지키는 사고 넷 — 전부 2026-09-09에 앱을 띄워 실측한 것이다:
   ① 프로필이 있는 학생이 다시 켜도 **환영 화면이 먼저 그려졌다**(index.html 에서
      hidden 이 없는 화면이 그것 하나뿐이라, app.js 가 화면을 정할 때까지 그게 화면이다)
   ② 탐색 탭에서 나갔다 와도 **늘 홈**이었고 ③ 그 홈에 **이전 화면의 스크롤이 붙었다**
   ④ 신청서를 쓰다 나가면 **쓴 것이 통째로 사라졌다**(크레딧을 낸 AI 초안까지) */
console.log('\n■ 첫 실행 화면 (2026-09-09)');
{
  const root = new URL('../', import.meta.url);
  const html = readText(new URL('index.html', root));

  /* ① 화면은 전부 감춰진 채 시작한다 — 하나라도 열려 있으면 그게 '첫 화면'이 된다 */
  const screens = [...html.matchAll(/<section id="screen-([a-z]+)" class="screen"([^>]*)>/g)]
    .filter((m) => !/\bhidden\b/.test(m[2])).map((m) => m[1]);
  eq('열린 채 시작하는 .screen 이 없다', screens, []);

  /* ② 부팅 화면 자체가 있고, 걷는 손잡이가 있다 */
  eq('부팅 화면이 index.html 에 있다', /id="boot"/.test(html), true);
  const bootJs = readText(new URL('boot.js', root));
  eq('boot.js 가 스크롤 되살리기를 끈다', /scrollRestoration\s*=\s*'manual'/.test(bootJs), true);
  eq('boot.js 에 시한이 있다 (갇히지 않는다)', /BOOT_TIMEOUT_MS/.test(bootJs), true);
  eq('boot.js 가 걷는 손잡이를 연다', /window\.bootDone/.test(bootJs), true);
  eq('app.js 가 화면을 정한 뒤 부팅 화면을 걷는다',
    /window\.bootDone\(\)/.test(readText(new URL('app.js', root))), true);

  /* ③ 🔴 boot.js 는 **다른 스크립트보다 먼저** 실려야 한다. 뒤에 두면 그 사이가
     그대로 비고, 그게 이 파일이 없애려던 바로 그 틈이다. */
  const order = [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]);
  eq('boot.js 가 첫 스크립트다', order[0], 'boot.js');
  eq('resume.js 가 app.js 보다 먼저다', order.indexOf('resume.js') < order.indexOf('app.js'), true);

  /* ④ 🔴 인라인 <script> 로 옮기면 CSP(script-src 'self')가 막아 **조용히** 아무 일도 안 난다 */
  eq('CSP 가 여전히 인라인 스크립트를 막는다 (boot.js 를 인라인으로 옮기면 안 되는 이유)',
    /script-src 'self'/.test(html) && !/script-src[^;]*unsafe-inline/.test(html), true);

  /* 🔴 같은 CSP 가 **인라인 이벤트 처리기(`onclick="…"`)도** 막는다. 2026-09-09 에 실제로
     그래서 부팅 실패 화면의 '다시 시도' 버튼이 죽어 있었다(브라우저로 확인 — "Refused to
     execute inline event handler"). 오류가 화면에 안 나므로 **눌러도 아무 일이 안 나는** 것이
     유일한 증상이고, 앱이 안 오는 학생은 거기서 갇힌다.
     ⚠️ 이 검사는 '고쳤다'를 지키는 것이 아니라 **다음에 누가 또 쓰는 것**을 막는다 —
        HTML 을 손으로 고치는 순간 가장 쉽게 손이 가는 방법이 그것이다. */
  const inlineOn = [...html.matchAll(/\son(click|change|input|submit|load|error)\s*=/gi)].map((m) => m[0].trim());
  eq('index.html 에 인라인 이벤트 처리기가 없다 (CSP 가 막아 조용히 죽는다)', inlineOn, []);
  eq('부팅 실패 화면의 다시 시도를 boot.js 가 배선한다',
    /boot-retry[\s\S]{0,160}addEventListener\('click'/.test(bootJs)
      && /id="boot-retry"/.test(html), true);

  /* ⑤ 서비스워커가 새 파일을 안 담으면 설치된 앱에서 오프라인에 깨진다 */
  const sw = readText(new URL('sw.js', root));
  eq('sw.js ASSETS 에 boot.js 가 있다', /'boot\.js'/.test(sw), true);
  eq('sw.js ASSETS 에 resume.js 가 있다', /'resume\.js'/.test(sw), true);
}

/* ══ 환영 화면 문구 (2026-09-12 · 노션 UI-22) ═════════════════════════════
   옛 문구는 "1분이면 내 장학금 확인" 이었다. 재 보니 **그 말이 참인 길은 전부 건너뛰는
   길 하나뿐**이었다 — 앱이 실제로 막는 것은 1단계의 학교·학년 둘뿐이라 8번 누르고 5글자
   치면 홈까지 간다(로봇 2.8초 · 캠퍼스가 있는 경희대도 8번 — 캠퍼스는 안 막는다).
   반대로 처음 가입하는 학생에게 보이는 칸은 입력 10 · 고르기 6 · 칩 3묶음 · 체크 15개다
   (계좌·민감정보 동의처럼 조건부로 숨는 칸은 뺀 수). 단계는 넷 → 여섯으로 늘었고,
   **시간을 적어 두면 그때마다 조용히 거짓말이 된다** — 실제로 그렇게 틀렸다(원칙 5).
   ⚠️ 근거로 '홈에 카드 3장'을 쓰지 말 것 — 실측하니 그 석 장은 **학교를 안 본다**
      (외대·경희대·포항공대가 전부 같은 KOSAF 전국 재단 셋, 마감순). 학교로 갈리는 것은
      히어로 건수다(11 · 13 · 5건 — 같은 최소 경로로 실측).
   지키는 것 둘: ① 문구가 시간을 약속하지 않는다 ② 온보딩에서 **앞으로 못 가게 막는 칸**이
   문구가 말하는 둘과 같다. 셋째 필수 칸이 생기면 문구가 거짓이 되므로 여기서 잡는다. */
/* ══ 도구들의 기준 학생이 갈라지지 않는다 (2026-09-12 · 노션 UI-1) ═══════════
   개발자 백로그: "적합도가 실제로 맞게 계산되는지 정밀하게 검사하는 방법을 확인한다."
   확인하다 **도구 자신이 틀린 학생으로 재고 있는 것**을 찾았다 — `fit-report.mjs` 의 기준
   학생이 `track: '인문'` 이었는데 계열 값은 `humanities` 같은 **id** 다(data.js TRACKS).
   그래서 계열 축이 통째로 어긋나 미달이 6건으로 나왔다(제대로 주면 4건).
   demo-profile.js 는 이미 "what-shows.mjs 의 기준 학생과 같은 값"이라고 적어 두고 있었는데,
   fit-report 만 그 약속 밖에 있었다. 사람이 기억하는 대신 여기서 센다. */
console.log('\n■ 도구들의 기준 학생 (2026-09-12 · UI-1)');
{
  const root = new URL('../', import.meta.url);
  const files = ['verify/fit-report.mjs', 'verify/what-shows.mjs', 'verify/demo-profile.js'];
  const track = files.map((f) => (readText(new URL(f, root)).match(/track:\s*(?:arg\('track',\s*)?'([^']+)'/) || [])[1]);
  eq('세 도구가 같은 계열 값을 쓴다', [...new Set(track)], ['humanities']);
  const school = files.map((f) => (readText(new URL(f, root)).match(/school:\s*(?:arg\('school',\s*)?'([^']+)'/) || [])[1]);
  eq('  같은 학교를 기준 학생으로 쓴다', [...new Set(school)], ['한국외국어대학교']);
  /* 🔴 계열 값은 **data.js 의 id** 여야 한다 — 라벨('인문·어문')을 넣으면 축이 조용히 죽는다 */
  const ids = [...readText(new URL('data.js', root)).matchAll(/\{\s*id:\s*'([a-z]+)',\s*label:/g)].map((m) => m[1]);
  eq('  그 값이 data.js 의 계열 id 다', ids.includes(track[0]), true);
}

/* ══ 화면이 '전국'을 약속하지 않는다 (2026-09-13) ══════════════════════════
   두 자리가 **전국 모든 대학을 지원한다**고 적고 있었다 — 온보딩 1단계 부제("전국 모든 대학
   지원")와 MY 맨 아래("한대장 v0.3 (MVP) · 전국 대학 지원").
   학교는 전국에서 고를 수 있는 것이 맞지만, **교내 공고가 있는 학교는 두 곳뿐**이다
   (실측: 등록 48건 = 한국외국어대학교 22 · 경희대학교 12 · 학교 무관 14 · 층2 전국 재단 90곳).
   '모든 대학 지원'은 그 학생이 교내 공고도 받는다는 말로 읽힌다 — 확인 안 한 것을 단정하지
   않는다(원칙 5 · UI-22 에서 시간 약속을 지운 것과 같은 유형).
   ⚠️ 학교 목록을 줄일지는 노션 A-6(개발자 판단 대기)다 — 여기서 지키는 것은 **말**뿐이다. */
console.log('\n■ 화면이 「전국 모든 대학」을 약속하지 않는다 (2026-09-13)');
{
  const root = new URL('../', import.meta.url);
  const html = readText(new URL('index.html', root));
  const app = readText(new URL('app.js', root));
  const strip = (t) => t.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  eq('화면 문구에 「전국 모든 대학」이 없다', /전국\s*모든\s*대학/.test(strip(html) + strip(app)), false);
  eq('  MY 아래줄이 「전국 대학 지원」이라고 하지 않는다', /전국 대학 지원/.test(strip(app)), false);
  /* 🔴 숫자를 손으로 적지 않는다 — 학교가 늘면 저절로 맞아야 한다(데이터가 세어 말한다) */
  eq('  대신 데이터에서 센다 (교내 학교 수 · 층2 재단 수)',
    /schoolOnly\)\.filter\(Boolean\)/.test(app) && /kosafList\.length/.test(app), true);
}

/* ══ 시작 화면 — 승인받은 컷 A 그대로인가 (2026-09-18 · 노션 UI-3) ═══════════
   개발자 결정: "A로 진행하고 사진은 무작위 3곳, 우선 배포 시작해". 승인받은 것은
   tools/gate-reel/reel.html 이 그린 컷 A(사진 3장 · 학교당 2.5초 · 마지막 장면 정지)다.
   시간·비율은 값을 못 박지 않고 **reel.html 과 같은가**를 잰다(부팅 절과 같은 이유 —
   둘을 함께 고치면 못 박은 검사가 없는 불일치를 있다고 말한다). 구조·문구는 그대로 못 박는다.
   🔴 스킬 approved-design 6번: 승인받은 화면은 검사로 못 박는다 — 검사만 고치고 화면을 바꾸지 말 것. */
console.log('\n■ 시작 화면 — 승인받은 컷 A 그대로인가 (2026-09-18 · UI-3)');
{
  const root = new URL('../', import.meta.url);
  const html = readText(new URL('index.html', root));
  const css = readText(new URL('style.css', root));
  const app = readText(new URL('app.js', root));
  const reel = readText(new URL('tools/gate-reel/reel.html', root));
  const step0 = (html.match(/<div class="onboard-step" data-step="0">([\s\S]*?)\n      <\/div>/) || [])[1] || '';
  const s0 = step0.replace(/<!--[\s\S]*?-->/g, '');
  eq('0단계 블록을 찾았다', s0.length > 200, true);
  /* ① 승인받은 요소 전부 — 무대 · 스크림 · 워드마크 · 카피 두 줄 · 버튼 · 안내 한 줄 */
  eq('사진 무대(#start-stage)가 있고 img 를 박아 두지 않는다 (무작위는 app.js 가 고른다)',
    /id="start-stage"/.test(s0) && !/<img/.test(s0), true);
  eq('스크림은 인라인 SVG 다 (style.css 에 linear-gradient 를 두지 않는다)',
    /<svg class="start-scrim"[\s\S]*?<linearGradient/.test(s0), true);
  eq('워드마크 「한대장」', /class="start-mark">한대장</.test(s0), true);
  eq('카피 첫 줄 「한국 대학교 장학금,」', /class="start-tag">한국 대학교 장학금,</.test(s0), true);
  eq('제목 「한 곳에서 찾고 / 한 번에 신청」', /<h1>한 곳에서 찾고<br \/>한 번에 신청<\/h1>/.test(s0), true);
  eq('버튼 「내 장학금 찾기」 (data-next — 드라이버가 이걸 누른다)',
    /<button[^>]*data-next[^>]*>내 장학금 찾기<\/button>/.test(s0), true);
  eq('  0단계의 data-next 는 하나뿐이다', (s0.match(/data-next/g) || []).length, 1);
  /* ② 해피 토크는 돌아오지 않는다 (2026-09-17 개발자 지시 "예비 고객은 앱에 대한 정보를 알고 있어") */
  eq('로고 타일·기능 카드·숫자 자랑이 없다', /onboard-logo|onboard-points|onboard-tagline|\d+\s*(건|곳|종)/.test(s0), false);
  /* ③ 사진 재료 — 14개교 · 파일이 실제로 있다 · 출처 줄 · NC/ND 없음 · 초점 */
  const gates = JSON.parse(readText(new URL('assets/gates/gates.json', root)));
  eq('사진 목록이 14개교다', gates.length, 14);
  eq('사진 파일이 전부 실제로 있다',
    gates.filter((g) => !fs.existsSync(new URL('assets/gates/' + g.file, root))).map((g) => g.file), []);
  eq('전부 출처 줄(작가 · 라이선스 · Wikimedia Commons)이 있다',
    gates.filter((g) => !g.name || !/Wikimedia Commons/.test(g.credit || '') || !/CC|Public domain|PD/i.test(g.license || '')).length, 0);
  eq('NC·ND 라이선스가 없다 (상업 이용이 가능한 것만)', gates.filter((g) => /NC|ND/.test(g.license || '')).map((g) => g.file), []);
  eq("출처 줄이 '정문' 이라고 단정하지 않는다 (정문이 아닌 사진이 있다)", gates.filter((g) => /정문/.test(g.credit || '')).length, 0);
  /* ④ app.js — 무작위 3장 · 시간은 CSS 에서 · 덮개가 열릴 때 시작 · 마지막 장면 정지 · 움직임 줄이기 */
  eq('한 번에 보여 주는 학교는 3곳', Number((app.match(/const START_SCENES = (\d+)/) || [])[1]), 3);
  const pickBody = app.slice(app.indexOf('function pickRandom'), app.indexOf('function cssMs'));
  const mont = app.slice(app.indexOf('function startMontage'), app.indexOf('function whenBootOpen'));
  eq('무작위로 고른다 (Math.random)', /Math\.random\(\)/.test(pickBody) && /pickRandom\(/.test(mont), true);
  eq('장면 시간을 CSS(--start-dur)에서 읽는다 · setTimeout 에 숫자를 적지 않는다',
    /'--start-dur'/.test(mont) && !/setTimeout\([^)]*,\s*\d/.test(mont), true);
  eq('덮개가 열리는 순간에 시작한다 (whenBootOpen · boot:open)', /whenBootOpen\(/.test(mont) && /'boot:open'/.test(app), true);
  const bootJs = readText(new URL('boot.js', root));
  eq("  boot.js 가 열림 단계에서 그 신호를 보낸다 ('boot-open' 바로 뒤)",
    /classList\.add\('boot-open'\);[\s\S]{0,400}dispatchEvent\(new Event\('boot:open'\)\)/.test(bootJs), true);
  eq('마지막 장면은 .last (멈춘 채 남는다 · 한 번 재생)', /'last' : 'run'/.test(mont), true);
  /* 🔴 되돌아와도 다시 돌지 않는다 — display:none 에서 다시 보이면 CSS 애니메이션이 처음부터 다시 돈다(실측) */
  eq('  다 돌면 멈춘 상태를 굳힌다 (start-done — 1단계에서 돌아와도 셋이 다시 돌지 않는다)',
    /classList\.add\('start-done'\)/.test(mont) && /\.start-stage\.start-done \.start-scene\s*\{[^}]*animation:\s*none;\s*opacity:\s*0/.test(css), true);
  eq('움직임 줄이기 기기에서는 한 장만 둔다', /prefers-reduced-motion: reduce/.test(mont) && /reduce \? 1 : START_SCENES/.test(mont), true);
  eq('사진을 못 받아도 지어내지 않는다 (빈 목록으로 조용히)', /\.catch\(\(\) => \[\]\)/.test(mont), true);
  eq('0단계를 그릴 때 부른다 (고치러 온 사람에게는 안 돈다)', /onboardStep === 0 && !onboardEditing\) startMontage\(\)/.test(app), true);
  /* ⑤ style.css — reel.html(승인받은 컷을 그린 파일)과 같은 값인가 */
  const num = (t, re) => Number((t.match(re) || [])[1]);
  eq('장면 시간이 컷 A 와 같다', num(css, /--start-dur:\s*(\d+)ms/), num(reel, /q\.get\('dur'\) \|\| (\d+)/));
  const stops = (t, name) => [...((t.match(new RegExp('@keyframes ' + name + '\\s*\\{[^\\n]*')) || [''])[0]
    .matchAll(/(\d+(?:\.\d+)?)%\s*\{\s*opacity:\s*([\d.]+)/g))].map((m) => [Number(m[1]), Number(m[2])]);
  const scales = (t, name) => [...((t.match(new RegExp('@keyframes ' + name + '\\s*\\{[^\\n]*')) || [''])[0]
    .matchAll(/scale\(([\d.]+)\)/g))].map((m) => Number(m[1]));
  eq('페이드 곡선이 컷 A 와 같다 (0→14% 들어오고 86→100% 나간다)', stops(css, 'start-fade'), stops(reel, 'fade'));
  eq('  마지막 장면의 곡선도 같다', stops(css, 'start-fadein'), stops(reel, 'fadein'));
  eq('  값을 실제로 읽었다 (빈 배열끼리 같다고 통과하면 안 된다)', stops(css, 'start-fade').length, 4);
  eq('걷는 정도가 컷 A 와 같다 (1.00→1.10)', scales(css, 'start-walk'), scales(reel, 'walk'));
  eq('  그 값도 실제로 읽었다', scales(css, 'start-walk').length, 2);
  eq('시작 화면 움직임에 infinite 가 없다', /start-(?:fade|fadein|walk)[^;\n]*infinite/.test(css), false);
  eq('스크림이 아래 45% (컷 A 의 380/844)',
    num(css, /\.start-scrim\s*\{[^}]*height:\s*(\d+)%/), Math.round(num(reel, /\.scrim\{[^}]*height:(\d+)px/) / 844 * 100));
  eq('style.css 에 linear-gradient 를 더하지 않았다 (스크림은 SVG)', /start[^\n]*linear-gradient/.test(css), false);
  eq('이 화면만 .screen 여백과 .app 아래 빈자리를 거둔다 (:has — 148px 헛스크롤이 남지 않는다)',
    /#screen-onboarding:has\([^{]*data-step="0"[^{]*\)\s*\{\s*padding:\s*0/.test(css) && /\.app:has\([^{]*data-step="0"[^{]*\)\s*\{\s*padding-bottom:\s*0/.test(css), true);
  /* 🔴 첫 실측에서 잡은 것: .onboard-step 의 flex:1 이 height 를 무시해 0단계 높이가 0 이 됐다 */
  eq('  0단계는 flex 에서 빠진다 (flex: none — 안 빼면 높이가 0 이 되어 아래 붙인 버튼이 화면 밖으로 나간다)',
    /\.onboard-step\[data-step="0"\]\s*\{[^}]*flex:\s*none/.test(css), true);
}

console.log('\n■ 환영 화면 문구 (2026-09-12 · UI-22)');
{
  const root = new URL('../', import.meta.url);
  const html = readText(new URL('index.html', root));
  /* 🔴 0단계 안의 문구를 본다 — 클래스만 보면 다른 단계에 같은 이름이 먼저 생겼을 때
     엉뚱한 글을 재면서 초록불이 된다(2026-09-12 코드 리뷰). */
  const step0 = (html.match(/<div class="onboard-step" data-step="0">([\s\S]*?)\n      <\/div>/) || [])[1] || '';
  const note = (step0.match(/<p class="onboard-note">([^<]*)<\/p>/) || [])[1] || '';
  eq('환영 화면에 안내 한 줄이 있다', note.length > 0, true);
  /* '1분'·'30초' 같은 약속 — 우리가 재지 않는 것을 적지 않는다 */
  eq('걸리는 시간을 약속하지 않는다', /\d+\s*(분|초)/.test(note), false);

  /* 🔴 1단계 블록만 들여다보지 말 것 (2026-09-12 코드 리뷰가 잡았다) — 가장 그럴듯한
     미래 변경은 **완료 버튼에 검증을 더하는 것**인데 그건 1단계 밖이라 통째로 안 보였다.
     그래서 파일 전체에서 '알리고 막는 줄'을 찾는다: 한 줄 안에서 toast 로 알리고 return 으로
     돌아서며 온보딩 칸(in-…)을 보는 줄. `#` 을 붙여 세지 않는다 — getElementById('in-major')
     처럼 쓰면 `#` 이 없어 그냥 빠져나갔다(실측). */
  const app = readText(new URL('app.js', root));
  const blockers = [...new Set(app.split('\n')
    .filter((l) => /toast\(/.test(l) && /return;/.test(l) && /\bin-[a-z-]+/.test(l))
    .flatMap((l) => [...l.matchAll(/\bin-([a-z-]+)/g)].map((m) => m[1])))].sort();
  eq('온보딩에서 앞을 막는 칸은 학교와 학년 둘뿐이다 (늘면 문구가 거짓이 된다)', blockers, ['school', 'year']);
  eq('문구가 그 둘을 그대로 말한다', /학교/.test(note) && /학년/.test(note), true);

  /* 🔴 **한 줄짜리 그물은 진짜 막는 자리를 놓친다** (2026-09-12 코드 리뷰 · 실측으로 확인).
     위 그물은 `toast(…); return;` 이 **한 줄에** 있을 때만 센다. 그런데 막는 일이 실제로
     일어나는 곳은 단계 넘김 버튼이고, 거기에 셋째 칸을 **여러 줄로** 적으면 여섯 줄이
     전부 초록인 채 환영 문구만 거짓이 된다(넣어 보니 그대로 통과했다).
     아래 그물은 줄이 아니라 **그 처리기 덩어리**를 통째로 읽는다. 그 처리기가 하는 일은
     검사와 다음 단계로 넘기기뿐이라, 거기 이름이 나오는 온보딩 칸 = 막는 칸이다. */
  const stepBody = (app.match(/\$\$\('\.onboard-step \[data-next\]'\)[\s\S]*?\n  \);/) || [])[0] || '';
  eq('단계 넘김 처리기를 실제로 찾았다 (빈 값을 통과시키지 않는다)', stepBody.length > 150, true);
  const stepFields = [...new Set([...stepBody.matchAll(/\bin-([a-z-]+)/g)].map((m) => m[1]))].sort();
  eq('  단계 넘김에서 보는 칸도 그 둘뿐이다 (여러 줄로 적어도 걸린다)', stepFields, ['school', 'year']);

  /* 여러 줄로 쓴 검증은 위 그물을 빠져나간다 — 완료 버튼만은 '도중에 안 막는다'로 따로 못 박는다 */
  const fin = (app.match(/\$\('#btn-finish-onboard'\)\.addEventListener\('click', \(\) => \{([\s\S]*?)\n  \}\);/) || [])[1] || '';
  eq('완료 버튼 처리기를 실제로 찾았다 (빈 값을 통과시키지 않는다)', fin.length > 200, true);
  eq('완료 버튼은 도중에 막지 않는다 (막으면 문구가 거짓이 된다)', /\breturn;/.test(fin), false);
}

console.log('\n■ 이어보기 판정 (2026-09-09)');
{
  const req = createRequire(import.meta.url);
  const R = req('../resume.js');
  const HOUR = 3600e3;
  const now = 1757400000000;
  const base = (o) => Object.assign({ v: 1, at: now - 5 * 60e3, screen: 'explore', scroll: { explore: 240 } }, o || {});
  const dec = (saved, opts) => R.resumeDecide(Object.assign({ saved, now, hasProfile: true, search: '', hash: '' }, opts || {}));

  /* ── 창 안 = 하던 화면 그대로 (개발자 지시 ①) ── */
  eq('5분 만에 오면 하던 탭', dec(base()).screen, 'explore');
  eq('그때 스크롤도 이어진다', dec(base()).scroll, 240);
  eq('보던 공고가 다시 열린다', dec(base({ sheet: { kind: 'detail', id: 'reg-x' } })).sheet, 'reg-x');

  /* ── 창을 넘기면 홈. 하지만 쓰던 것은 안 버린다 (개발자 지시 ②) ── */
  const stale = base({ at: now - 5 * HOUR, form: { schId: 'reg-y', ans: { a: 1 }, at: now - 5 * HOUR } });
  eq('5시간 만에 오면 홈', dec(stale).screen, 'home');
  eq('그래도 쓰던 신청서는 남아 있다', (dec(stale).resumeCard || {}).schId, 'reg-y');
  eq('창을 넘겼으니 자동으로 열지는 않는다', dec(stale).form, null);

  /* 🔴 창(어디로 가는가)과 보관 기한(언제 버리는가)은 **다른 값**이다 */
  eq('창과 보관 기한이 같은 값이 아니다', R.RESUME_WINDOW_MS === R.RESUME_KEEP_MS, false);
  const ancient = base({ at: now - 30 * 24 * HOUR, form: { schId: 'reg-y', ans: {}, at: now - 30 * 24 * HOUR } });
  eq('보관 기한(7일)을 넘긴 진행분은 버린다', dec(ancient).resumeCard, null);

  /* ── 창 안에 신청서를 쓰고 있었으면 그 신청서로 ── */
  const wip = base({ sheet: { kind: 'form', id: 'reg-z' }, form: { schId: 'reg-z', ans: { a: 1 }, at: now - 60e3 } });
  eq('쓰던 신청서를 그대로 연다', (dec(wip).form || {}).schId, 'reg-z');
  eq('그때 공고 상세는 안 연다 (둘이 겹치지 않는다)', dec(wip).sheet, null);

  /* ── 알림·로그인 복귀가 이긴다 (나중에 덮으면 화면이 두 번 바뀐다) ── */
  eq('알림으로 열면 이어보기가 손을 뗀다', dec(base(), { search: '?sch=reg-a' }).skip, true);
  eq('화면 딥링크도 마찬가지', dec(base(), { search: '?screen=my' }).skip, true);
  eq('로그인 복귀 토큰도 마찬가지', dec(base(), { hash: '#access_token=abc' }).skip, true);

  /* ── 온보딩 진행분은 창과 상관없이 되살린다 (학교·학년을 다시 치게 하지 않는다) ── */
  const ob = { step: 3, fields: { 'in-school': '경희대학교' }, at: now - 3 * 24 * HOUR };
  const noProf = dec(base({ at: now - 3 * 24 * HOUR, onboard: ob }), { hasProfile: false });
  eq('프로필이 없으면 온보딩으로', noProf.screen, 'onboarding');
  eq('사흘 뒤에 와도 치던 단계에서 잇는다', (noProf.onboard || {}).step, 3);

  /* ── 없는 장부·손상된 장부에서도 안 죽는다 ── */
  eq('장부가 없으면 홈', dec(null).screen, 'home');
  eq('손상된 장부는 없는 것으로', dec({ nope: 1 }).screen, 'home');
  eq('모르는 화면 이름은 홈으로', dec(base({ screen: 'wat' })).screen, 'home');
  /* 폰 시각이 뒤로 갔을 때 — 창 판정이 한쪽으로 쏠리면 안 된다 */
  eq('시계가 미래면 창 밖으로 본다', dec(base({ at: now + 10 * HOUR })).fresh, false);

  /* 🔴 진행분은 **기기 밖으로 안 나간다** — 프로필 장부와 다른 열쇠여야 한다.
     여기엔 학생이 신청서에 쓴 글이 들어가고, 저쪽은 로그인하면 서버로 올라간다. */
  const appJs = readText(new URL('../app.js', import.meta.url));
  eq('이어보기 열쇠가 프로필 열쇠와 다르다', R.RESUME_KEY === 'handaejang.v1', false);
  eq('이어보기 값을 state 에 넣지 않는다', /state\.resume\b/.test(appJs), false);

  /* 🔴 답을 넣는 함수와 빼는 함수가 **같은 칸 종류**를 다뤄야 한다 —
     어긋나면 되살릴 때 조용히 빈 칸이 된다. */
  const formsJs = readText(new URL('../forms.js', import.meta.url));
  const kindsOf = (fn) => {
    const i = formsJs.indexOf('function ' + fn);
    const body = formsJs.slice(i, formsJs.indexOf('\nfunction ', i + 10));
    return [...new Set([...body.matchAll(/f\.type === '([a-z+]+)'/g)].map((m) => m[1]))].sort();
  };
  eq('collectFormAnswers 와 fillFormAnswers 가 같은 칸 종류를 다룬다',
    kindsOf('fillFormAnswers'), kindsOf('collectFormAnswers'));

  /* 🔴 `beforeunload` 로 저장하면 휴대폰에서 안 불린다 — 이탈한 그 순간을 못 적는다 */
  eq('앱이 숨는 순간에 적는다 (beforeunload 가 아니라 visibilitychange)',
    /visibilitychange[\s\S]{0,200}resumeMark/.test(appJs), true);

  /* ── 2026-09-09 코드 리뷰에서 잡힌 다섯 (되돌아오면 조용히 망가지는 것들) ── */

  /* ① 시트를 닫으면 `formFill` 도 내려야 한다. 안 내리면 같은 시트를 쓰는 일괄 준비에서
     체크만 해도 **칸 없는 화면의 빈 답이 좋은 답을 덮는다.** */
  const closeBody = appJs.slice(appJs.indexOf('function closeSheet'), appJs.indexOf('function closeSheet') + 1200);
  eq('closeSheet 가 formFill 을 내린다', /formFill = null/.test(closeBody), true);

  /* ② 질문 화면이 안 떠 있으면 답을 모으지 않는다 (같은 이유) */
  const saveBody = appJs.slice(appJs.indexOf('function formProgressSave'), appJs.indexOf('function formProgressClear'));
  eq('질문 화면이 떠 있을 때만 답을 모은다', /btn-ff-generate/.test(saveBody), true);

  /* ③ '질문 다시 보기'는 쓴 답을 들고 돌아간다 (안 그러면 빈 화면이 그대로 장부에 적힌다) */
  eq("'질문 다시 보기'가 답을 들고 돌아간다",
    /btn-ff-back[\s\S]{0,260}renderFormFill\(\s*\{\s*ans:/.test(appJs), true);

  /* ④ id 없는 체크박스(특별자격·보유 장학금)도 담는다 — 매칭을 좌우하는 값들이다 */
  eq('온보딩 갈무리가 id 없는 체크박스도 담는다', /check-list[\s\S]{0,200}checked/.test(appJs), true);
  eq('되살릴 때 캠퍼스 칸을 다시 그린다', /renderCampusChips\(campus\)/.test(appJs), true);

  /* ⑥ 🔴 부팅 화면에 **바닥값**이 있어야 한다 (2026-09-09 개발자 지적:
     "환영 화면이 나타났지만 사용자가 겨우 볼 수 있을 만큼 시간이 짧았어").
     바닥값이 없으면 보이는 길이가 **앱 코드가 실리는 데 걸린 시간 그대로**라 기기마다
     들쭉날쭉하고, 캐시가 데워진 폰에서는 깜빡이고 만다. */
  const bootJs2 = readText(new URL('../boot.js', import.meta.url));
  const minMs = Number((bootJs2.match(/BOOT_MIN_SHOW_MS\s*=\s*(\d+)/) || [])[1]);
  eq('부팅 화면에 최소로 보여 주는 시간이 있다', minMs > 0, true);
  eq('그 시간을 실제로 기다린다 (선언만 해 두지 않는다)',
    /BOOT_MIN_SHOW_MS\s*-\s*sinceShown\(\)/.test(bootJs2), true);
  eq('시한(6초)보다는 짧다', minMs < Number((bootJs2.match(/BOOT_TIMEOUT_MS\s*=\s*(\d+)/) || [])[1]), true);
  /* 🔴 **시안에서 개발자가 보고 고른 값과 같아야 한다** — 갈라지면 승인받은 것과 다른 것이 나간다.
     ⚠️ 750 을 못 박지 않는다(2026-09-09 코드 리뷰): 개발자가 나중에 값을 바꾸기로 하고 시안·앱을
        **함께** 고치면, 못 박아 둔 검사가 '둘이 다르다'는 라벨로 빨간불을 낸다 — 없는 불일치를
        있다고 말하는 것이라 다음 세션이 엉뚱한 곳을 뒤진다. 재는 것은 '둘이 같은가' 하나다. */
  const mock = readText(new URL('../docs/designs/mockups/first-run/Main.dc.html', import.meta.url));
  const mockMs = Number((mock.match(/booting:\s*false\s*\}\);\s*resolve\(\);\s*\},\s*(\d+)\)/) || [])[1]);
  eq('시안에서 값을 읽어 냈다 (읽기 실패는 NaN 이라 조용히 통과하면 안 된다)', Number.isFinite(mockMs), true);
  eq('시안이 쓰는 값과 앱이 쓰는 값이 같다', minMs, mockMs);

  /* ⑨ 🔴 부팅 화면의 **등장 움직임** (2026-09-09 개발자 지시: "로고나 글자가 애니메이션
     형태로 나타난다. 하지만 앱의 신뢰성을 떨어뜨리지 않으면서도 깔끔해야 한다").
     지키는 것은 그 두 조건을 옮긴 셋이다 — 셋 다 값이 어긋나면 조용히 나빠지는 유형이라
     글로만 적어 두면 다음 세션이 되돌린다. */
  const css = readText(new URL('../style.css', import.meta.url));
  const bootMock = readText(new URL('../docs/designs/mockups/first-run/Boot.dc.html', import.meta.url));
  /* 이름으로 그 애니메이션이 쓰인 선언 한 줄을 집어 초 단위 값만 읽는다.
     shorthand 는 앞의 시간이 길이, 뒤의 시간이 늦추기다. */
  const useOf = (text, name) => {
    const decl = (text.match(new RegExp('animation:[^;]*\\b' + name + '\\b[^;]*;')) || [''])[0];
    const seg = decl.split(',').find((s) => s.includes(name)) || '';
    /* cubic-bezier 안의 숫자에는 s 가 안 붙으므로 여기서 걸리지 않는다 */
    const secs = [...seg.matchAll(/([\d.]+)s\b/g)].map((m) => Number(m[1]) * 1000);
    return { dur: secs[0], delay: secs[1] || 0, decl };
  };
  const logoIn = useOf(css, 'boot-in-logo');
  const wordIn = useOf(css, 'boot-in-word');
  const spinIn = useOf(css, 'boot-spin-in');
  eq('로고에 등장 움직임이 있다', Number.isFinite(logoIn.dur), true);
  eq('글자에 등장 움직임이 있다', Number.isFinite(wordIn.dur), true);

  /* ㉮ **바닥값보다 일찍 끝난다.** 걷히는 순간까지 움직이고 있으면 급해 보인다 —
     끝나고 고요한 시간이 남아야 '차분히 놓였다'로 읽힌다. */
  eq('로고 등장이 최소 노출 시간 안에 끝난다', logoIn.dur + logoIn.delay < minMs, true);
  eq('글자 등장이 최소 노출 시간 안에 끝난다', wordIn.dur + wordIn.delay < minMs, true);

  /* ㉯ **한 번만 나타나고 멈춘다.** 로고·글자가 계속 움직이면 '들어왔다'가 아니라
     '아직도 로딩 중'으로 읽힌다 — 그게 신뢰를 깎는 자리다. */
  eq('로고가 계속 움직이지 않는다', /infinite/.test(logoIn.decl), false);
  eq('글자가 계속 움직이지 않는다', /infinite/.test(wordIn.decl), false);

  /* ㉰ 계속 도는 표시는 **바닥값이 지난 뒤에야** 나온다 — 앱이 제때 오면 학생은 못 본다.
     처음부터 띄우면 빠른 기기에서도 매번 '기다리는 화면'이 된다. */
  eq('도는 표시가 최소 노출 시간이 지난 뒤에 나타난다', spinIn.delay > minMs, true);

  /* 🔴 그 표시는 등장 애니메이션이 opacity 를 올리므로, 움직임을 줄인 기기에서
     `animation: none` 만 주면 **영영 안 보인다**(느린 기기에서 아무 표시도 없는 빈 화면). */
  const reduce = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)', css.indexOf('.boot-spin')));
  eq('움직임을 줄인 기기에서 로고·글자 등장을 끈다',
    /\.boot-logo,\s*\.boot-word\s*\{\s*animation:\s*none/.test(reduce.slice(0, 400)), true);
  eq('그때 도는 표시는 보이게 되돌린다 (안 그러면 영영 안 보인다)',
    /\.boot-spin\s*\{\s*animation:\s*none;\s*opacity:\s*1/.test(reduce.slice(0, 400)), true);

  /* 🔴 시안과 앱이 갈라지지 않는다 — 값을 못 박지 않고 **둘이 같은가**만 잰다(위 ⑥과 같은 이유) */
  eq('시안의 로고 등장이 앱과 같다',
    [logoIn.dur, logoIn.delay], [useOf(bootMock, 'boot-in-logo').dur, useOf(bootMock, 'boot-in-logo').delay]);
  eq('시안의 글자 등장이 앱과 같다',
    [wordIn.dur, wordIn.delay], [useOf(bootMock, 'boot-in-word').dur, useOf(bootMock, 'boot-in-word').delay]);
  eq('시안의 도는 표시 지연이 앱과 같다', spinIn.delay, useOf(bootMock, 'boot-spin-in').delay);

  /* ⑩ 🔴 부팅 화면의 **걷힘 움직임** (2026-09-11 개발자 지시 — 카카오웹툰 환영 화면 참고:
     "한대장 또한 스플래시에서 다음과 같은 인터랙션이 있었으면 좋겠어").
     페이드가 아니라 로고가 세로 막대로 접혔다가(.boot-fold) 그 자리에 뚫린 구멍이 커지며
     앱이 열린다(.boot-open). 설계 문서 '걷힘 움직임' 절. 여기서 지키는 것은 다섯 —
     값이 어긋나면 화면은 멀쩡해 보이면서 조용히 나빠지는 유형이라 글로만 두면 되돌아간다. */
  const bootBlock = css.slice(css.indexOf('#boot {'), css.indexOf('.resume-card {'));
  const msVar = (text, name) => {
    const m = text.match(new RegExp('\\s' + name + ':\\s*([\\d.]+)(ms|s)\\b'));
    return m ? Number(m[1]) * (m[2] === 's' ? 1000 : 1) : NaN;
  };
  const foldMs = msVar(bootBlock, '--boot-fold');
  const holdMs = msVar(bootBlock, '--boot-hold');
  const openMs = msVar(bootBlock, '--boot-open');
  eq('걷힘에 접힘 단계가 있다 (--boot-fold)', Number.isFinite(foldMs) && foldMs > 0, true);
  eq('접힌 막대에서 쉬는 시간이 CSS 에 있다 (--boot-hold — JS 에 숫자로 두면 합계에서 빠진다)',
    Number.isFinite(holdMs) && holdMs >= 0, true);
  eq('걷힘에 열림 단계가 있다 (--boot-open)', Number.isFinite(openMs) && openMs > 0, true);
  /* ㉮ 바닥값(1초) **뒤에** 붙는 시간이라 길수록 그대로 앱이 느려 보인다 — 0.8초가 천장이다.
     쉼까지 셋을 합쳐 잰다(2026-09-11 코드 리뷰: 쉼이 JS 에만 있어 합계에서 빠져 있었다). */
  eq('접힘+쉼+열림이 0.8초를 넘지 않는다 (바닥값 뒤에 붙는 시간이라 그대로 느려 보인다)',
    foldMs + holdMs + openMs <= 800, true, `${foldMs}+${holdMs}+${openMs}`);
  /* ㉯ 접힘은 transition 이 아니라 keyframes — 등장 애니메이션(both)이 쥔 transform 은
     transition 으로 안 이어진다(260ms 가 한 프레임에 툭 바뀌었다 · 녹화로 확인) */
  eq('접힘은 keyframes 애니메이션이다 (transition 은 등장 애니메이션이 쥔 속성을 못 움직인다)',
    /#boot\.boot-fold \.boot-logo\s*\{[^}]*animation:\s*boot-fold-logo/.test(bootBlock)
      && /@keyframes boot-fold-logo/.test(bootBlock), true);
  eq('걷힘에 infinite 가 없다', /boot-fold[^;]*infinite|boot-open[^;]*infinite/.test(bootBlock), false);
  /* ㉰ 열림은 덮개에 뚫는 구멍이다 — 막대를 따로 흐리게 하면 '막대가 창이 된다'가 깨진다 */
  eq('열림은 덮개의 구멍(clip-path polygon evenodd)이다',
    /#boot\.boot-open\s*\{[^}]*clip-path:\s*polygon\(evenodd/.test(bootBlock), true);
  eq('열림 단계에서 막대를 따로 흐리게 하지 않는다 (구멍이 막대까지 같이 잘라낸다)',
    /#boot\.boot-open \.boot-logo\s*\{[^}]*opacity/.test(bootBlock), false);
  /* ㉱ 걷히기 시작하면 도는 표시를 끈다 — 걷힘이 1.2초를 넘겨 표시가 스며 나오던 것(실측) */
  eq('걷히기 시작하면 도는 표시를 끈다',
    /#boot\.boot-fold \.boot-spin\s*\{[^}]*animation:\s*none;\s*opacity:\s*0/.test(bootBlock), true);
  /* ㉲ boot.js 는 시간을 CSS 에서 **읽기만** 한다 — 숫자를 두 곳에 적으면 한쪽만 고쳐져 어긋난다 */
  const doneBody = bootJs2.slice(bootJs2.indexOf('window.bootDone'));
  eq('boot.js 가 걷힘 시간을 CSS 에서 읽는다',
    /--boot-fold/.test(doneBody) && /--boot-hold/.test(doneBody) && /--boot-open/.test(doneBody), true);
  /* 두 번째 인자가 숫자로 **시작**하는 setTimeout 을 잡는다 — `}, 440)` · `, 60 + foldMs)` ·
     `, 0.44 * 1000)` · `setTimeout(hide, 440)` 전부. `openMs + 20` 처럼 변수로 시작하면 통과. */
  eq('boot.js 가 걷힘 시간을 숫자로 적어 두지 않는다 (setTimeout 두 번째 인자가 숫자로 시작하면 안 된다)',
    /,\s*\d[\d.]*\s*(?:\)|\*|\+|-)/.test(doneBody), false);
  eq('boot.js 가 접힘·열림 두 단계를 차례로 켠다',
    doneBody.indexOf("'boot-fold'") > 0 && doneBody.indexOf("'boot-open'") > doneBody.indexOf("'boot-fold'"), true);
  /* ㉳ 움직임 줄이기 기기에서는 접지도 열지도 않는다 — 둘 다 0 이면 boot.js 도 곧바로 넘긴다 */
  eq('움직임 줄이기에서 세 값을 0 으로 준다',
    /#boot\s*\{\s*--boot-fold:\s*0ms;\s*--boot-hold:\s*0ms;\s*--boot-open:\s*0ms;/.test(reduce.slice(0, 900)), true);
  eq('움직임 줄이기에서 구멍을 뚫지 않는다',
    /#boot\.boot-fold,\s*#boot\.boot-open\s*\{\s*clip-path:\s*none/.test(reduce.slice(0, 900)), true);
  /* ㉴ 시안과 갈라지지 않는다 — 값을 못 박지 않고 둘이 같은가만 잰다 */
  eq('시안의 접힘 길이가 앱과 같다', msVar(bootMock, '--boot-fold'), foldMs);
  eq('시안의 쉼 길이가 앱과 같다', msVar(bootMock, '--boot-hold'), holdMs);
  eq('시안의 열림 길이가 앱과 같다', msVar(bootMock, '--boot-open'), openMs);
  eq('시안의 스크립트도 시간을 CSS 에서 읽는다 (숫자를 박으면 CSS 를 고칠 때 어긋난다)',
    /getPropertyValue\('--boot-fold'\)|ms\('--boot-fold'\)/.test(bootMock)
      && !/,\s*\d[\d.]*\s*\+\s*\d/.test(bootMock.slice(bootMock.indexOf('<script>'))), true);

  /* ⑧ 🔴 알림 딥링크는 **공고 목록이 올 때까지 기다린다** (2026-09-09 개발자 지적).
     한 번 보고 없으면 탐색 탭으로 보내던 것이 원인이었다 — 회선이 느린 폰에서는 늘 그랬다. */
  const notifyJs = readText(new URL('../notify.js', import.meta.url));
  const launchBody = notifyJs.slice(notifyJs.indexOf('function notifyHandleLaunch'),
    notifyJs.indexOf('function notifyHandleLaunch') + 2000);
  eq('알림 딥링크가 공고를 기다렸다 연다 (한 번 보고 포기하지 않는다)',
    /setTimeout\(tryOpen/.test(launchBody), true);
  eq('그래도 무한정 기다리지는 않는다 (시한이 있다)', /DEADLINE/.test(launchBody), true);

  /* ⑦ 홈 줄의 말은 개발자가 정한 그대로다 (2026-09-09 지시) */
  eq("홈 줄의 버튼 문구가 '신청서 마저 쓰기' 다",
    /rc-go">신청서 마저 쓰기</.test(appJs), true);

  /* ⑤ 🔴 데이터 초기화가 이어보기 장부까지 지운다 — 안 지우면 '지웠다'가 거짓말이 된다
     (그 장부에 이름·학번·전화·계좌번호와 신청서에 쓴 글이 들어 있다) */
  const resetAt = appJs.indexOf('[STORAGE_KEY, ...LEGACY_KEYS].forEach');
  eq('데이터 초기화가 이어보기 장부도 지운다',
    /resumeClear\(\)/.test(appJs.slice(resetAt, resetAt + 600)), true);

  /* ⑥ 🔴 **초기화가 빈 상태를 제 손으로 다시 적지 않는다** (2026-09-09 코드 리뷰).
     예전에는 `state = { profile: null, applications: [] }` 라고 손으로 적어, 그 뒤에 늘어난
     칸(`saved`·`consent`·`updatedAt`)이 빠졌다. 초기화한 뒤 그 자리에서 온보딩을 다시 마치면
     `state.saved` 가 undefined 라 화면을 그릴 때마다
     `Cannot read properties of undefined (reading 'some')` 가 났다(브라우저 실측).
     앱을 껐다 켜면 `loadState` 가 메워 주기 때문에 **눈으로 재현하기 가장 어려운 유형**이다. */
  eq('초기화가 빈 상태 만드는 함수를 쓴다 (손으로 다시 적지 않는다)',
    /state = emptyState\(\)/.test(appJs.slice(resetAt, resetAt + 900)), true);
  eq('  그 함수가 선언부에서도 쓰인다 (두 벌이 아니다)',
    /let state = emptyState\(\);/.test(appJs), true);
  /* 빈 상태에 있어야 하는 칸 — 하나라도 빠지면 그 칸을 읽는 곳이 죽는다 */
  const emptyBlk = appJs.slice(appJs.indexOf('function emptyState()'), appJs.indexOf('let state = emptyState();'));
  ['profile', 'applications', 'saved', 'consent', 'updatedAt'].forEach((k) => {
    eq(`  빈 상태에 '${k}' 칸이 있다`, new RegExp('^\\s*' + k + ':', 'm').test(emptyBlk), true);
  });
}

/* ══ 손짓과 움직임 (2026-09-09) ══════════════════════════════════════════
   브라우저 검사(verify/verify-interactions.js)가 동작을 지키고, 여기서는 **브라우저로는
   못 보거나 늦게야 보이는 함정 넷**을 실행 전에 잡는다. */
{
  console.log('\n■ 손짓과 움직임');
  const appJs = readText(new URL('../app.js', import.meta.url));
  const inter = readText(new URL('../interactions.js', import.meta.url));
  const css = readText(new URL('../style.css', import.meta.url));
  const html = readText(new URL('../index.html', import.meta.url));
  const sw = readText(new URL('../sw.js', import.meta.url));

  /* 🔴 ① `.app` 에 transform 을 걸면 그 안의 `position: fixed`(하단 탭·시트·도우미 단추)가
     화면이 아니라 `.app` 을 기준으로 자리를 잡아 함께 밀린다. 눈으로는 '조금 어긋난' 정도라
     검사를 통과해 버리기 쉬워서 글자로 못 박는다. */
  eq('당겨서 새로고침이 .app 을 옮기지 않는다 (그 안에 fixed 가 산다)',
    /querySelector\('\.app'\)\.style\.transform\s*=/.test(inter), false);

  /* 🔴 ② 튕김 표시를 떼는 시간은 CSS 움직임보다 길어야 한다 — 짧으면 움직임이 중간에 잘린다 */
  const popClear = Number((inter.match(/POP_CLEAR_MS\s*=\s*(\d+)/) || [])[1]);
  const cssMs = [...css.matchAll(/animation:\s*save-(?:pop|ring)\s+([\d.]+)s/g)].map((m) => Number(m[1]) * 1000);
  eq('튕김 표시 제거 시간을 읽어 냈다', Number.isFinite(popClear) && cssMs.length === 2, true);
  eq('그 시간이 CSS 움직임보다 길다', cssMs.every((v) => popClear > v), true);

  /* 🔴 ③ 새 파일이 서비스워커 목록에서 빠지면 **오프라인에서만** 앱이 죽는다
     (2026-08-01 로그인 파일에서 겪은 것과 같은 유형). */
  eq('interactions.js 가 index.html 에 실린다', /src="interactions\.js"/.test(html), true);
  eq('interactions.js 가 서비스워커 목록에 있다', /'interactions\.js'/.test(sw), true);
  eq('그리고 app.js 보다 **먼저** 실린다 (app.js 가 카드를 그릴 때 부른다)',
    html.indexOf('src="interactions.js"') < html.indexOf('src="app.js"'), true);

  /* 🔴 ④ 마감 막대는 **뺐다** (2026-09-11 개발자 지시: "빨간색 마감 인터렉션 바를 지우고
     마감 D-DAY 카운트만 남겨놓기"). 되살아나면 여기서 잡는다 — 카드가 마감을 두 가지로 말하게 된다. */
  eq('interactions.js 에 마감 막대 함수가 없다', /function deadlineMeter|DEADLINE_WINDOW_DAYS\s*=/.test(inter), false);
  eq('app.js 가 막대를 부르지 않는다', /deadlineMeterHtml|dl-meter/.test(appJs), false);
  eq('style.css 에 막대 규칙이 없다', /\.dl-meter\s*[{,]/.test(css), false);
  eq('손짓 파일에 날짜 계산이 없다 (판정은 dday 한 곳)',
    /new Date\(|Date\.now\(\)\s*[-/]/.test(inter.slice(0, inter.indexOf('function haptic'))), false);
  eq('카드의 빨강 문턱은 dday 의 urgent 문턱(7일) 그대로다',
    /d <= 7\) return \{ label: `D-\$\{d\}`, cls: 'urgent'/.test(appJs)
    && /d\.days >= 0 && d\.days <= 7\) \? ' urgent'/.test(appJs), true);
  /* 카드의 마감 글자 = dday().label — 앱의 진짜 함수를 떼어 내 돌린다(사본을 검사하면 원본이 바뀌어도 통과한다) */
  {
    const src = appJs.match(/function ddayWords\(d\) \{[\s\S]*?\n\}/)[0];
    const ddayWords = new Function(src + '; return ddayWords;')();
    eq('D-DAY 는 D-DAY 그대로', ddayWords({ label: 'D-DAY', cls: 'urgent', days: 0 }), 'D-DAY');
    eq('D-3 은 D-3 그대로 (풀어 쓰지 않는다)', ddayWords({ label: 'D-3', cls: 'urgent', days: 3 }), 'D-3');
    eq('지난 것은 마감', ddayWords({ label: '마감', cls: 'closed', days: -2 }), '마감');
    eq('못 읽은 것은 지어내지 않는다', ddayWords({ label: '기한 원문 확인', cls: '', days: 14 }), '기한 확인 중');
  }
  /* 마감 자리는 맨 아랫줄(.sch-foot) — 맨 윗줄(.sch-top)은 적합도 자리라 거기 두면 안 된다(개발자 지시) */
  {
    const card = appJs.slice(appJs.indexOf('function schCard('), appJs.indexOf('function saveBtnHtml('));
    const top = card.slice(card.indexOf('class="sch-top"'), card.indexOf('class="sch-name"'));
    eq('마감(.sch-due)이 맨 윗줄에 없다', /sch-due/.test(top), false);
    eq('마감(.sch-due)이 맨 아랫줄(.sch-foot)에 있다', /class="sch-foot">[\s\S]*?sch-due/.test(card), true);
  }

  /* 🔴 ⑤ 진동은 **되돌리기 어려운 일**에만 — 화면이 바뀔 때마다 울리면 학생이 앱 진동을
     통째로 꺼 버린다. 부르는 곳이 늘어나면 여기서 먼저 걸린다(늘릴 거면 이 숫자를 함께 고친다). */
  const hapticCalls = (appJs.match(/haptic\(/g) || []).length;
  eq(`앱이 진동을 부르는 곳은 셋뿐이다 (지금 ${hapticCalls}곳)`, hapticCalls <= 3, true);
}

/* ══ 카드 제목은 기관명을 담는다 · 기관명은 카드에 한 번만 (2026-09-21) ══════════
   개발자 지시: *"공고 이름이 너무 축약되어 있음. `~재단 성적 장학금` 이면 메인 제목은 그냥
   `성적장학금` 으로 뜨니까 학생 입장에서 헷갈릴 것 같아."*

   내력: 2026-09-10 에 기관명을 **뗐다**(한 카드에 두 번 나와서). 2026-09-11 에 그게 지나쳐
   `장학생` 만 남는 것을 `GENERIC_TITLE_REST` 로 막았지만, **괄호가 붙으면 새어 나갔다** —
   실측 `장학생 (이공계 새터민 대상)` · `장학생 (2026 하반기)` · `특기장학금` · `복지장학금`.
   지금은 제목이 기관명을 담고, 대신 **윗줄에서 뺀다**. 두 지적을 다 지킨다.

   길이는 브라우저에 그려 놓고 쟀다(375px · 제목 폭 335px · 169장): 1줄 158→154 · 2줄 11→15 ·
   **3줄 0건**. `.sch-name` 은 줄임표도 줄 수 제한도 없어 잘리지 않는다.
   🔴 앱의 진짜 함수를 떼어 내 돌린다 — 사본을 검사하면 원본이 바뀌어도 통과한다. */
{
  console.log('\n■ 카드 제목 — 기관명을 담고, 윗줄에서는 뺀다 (2026-09-21)');
  const appJs = readText(new URL('../app.js', import.meta.url));
  const parts = [
    appJs.match(/const bareOrg = .*\n/),
    appJs.match(/const orgBase = .*\n/),
    appJs.match(/function cardTitle\(sch\) \{[\s\S]*?\n\}\n/),
    appJs.match(/function cleanCardTitle\(name\) \{[\s\S]*?\n\}\n/),
    appJs.match(/function cardOrgLine\(sch\) \{[\s\S]*?\n\}\n/),
  ];
  eq('cardTitle · cleanCardTitle · cardOrgLine 을 app.js 에서 떼어 냈다', parts.every(Boolean), true);
  const src = parts.map((m) => (m ? m[0] : '')).join('\n');
  const [cardTitle, cardOrgLine] = ['cardTitle', 'cardOrgLine'].map((n) => new Function(`${src}\nreturn ${n};`)());
  const t = (name, provider) => cardTitle({ name, provider });

  /* 전부 **실제로 카드에 그렇게 떠 있던** 제목이다 (2026-09-21 실측) */
  eq('동산장학회 장학생 → 기관명이 제목에 남는다',
    t('동산장학회 장학생 (이공계 새터민 대상)', '동산장학회'), '동산장학회 장학생 (이공계 새터민 대상)');
  eq('  충북인재평생교육진흥원 장학생 → 그대로',
    t('충북인재평생교육진흥원 장학생 (2026 하반기)', '충북인재평생교육진흥원'), '충북인재평생교육진흥원 장학생 (2026 하반기)');
  eq('  층2(재단명 + 사업명)도 그대로', t('울진군장학재단 특기장학금', '울진군장학재단'), '울진군장학재단 특기장학금');
  eq('  앞에 다른 글자가 붙어도 안 뗀다 (예전엔 뗐다)',
    t('재단법인 안산인재육성재단 특별장학생', '재단법인 안산인재육성재단'), '재단법인 안산인재육성재단 특별장학생');

  /* 🔴 **떼는 것은 게시판 표식·꼬리 날짜뿐이다** — 그건 그대로 남긴다(제목의 일부가 아니다) */
  eq('게시판 대괄호 표식은 여전히 뗀다',
    t('[공통][교외]2026년도 2학기 이백장학금 장학생 모집(9/7~9/15)', '주관 기관 원문 확인'),
    '2026년도 2학기 이백장학금 장학생 모집');

  /* 🔴 기관명은 카드에 **한 번**만 — 제목이 담고 있으면 윗줄에서 뺀다 */
  eq('제목이 기관명을 담으면 윗줄은 교내/교외만',
    cardOrgLine({ type: '교외', provider: '울진군장학재단', name: '울진군장학재단 특기장학금' }), '교외');
  eq('  법인 표기가 달라도 같은 이름으로 본다',
    cardOrgLine({ type: '교외', provider: '재단법인 안산인재육성재단', name: '안산인재육성재단 특별장학생' }), '교외');
  eq('  제목에 없으면 예전처럼 붙인다',
    cardOrgLine({ type: '교외', provider: '한국장학재단', name: '대학생 청소년교육지원장학금(대청교) 멘토' }),
    '교외 · 한국장학재단');
  eq('  기관명을 못 읽은 공고도 예전 그대로',
    cardOrgLine({ type: '교외', provider: '주관 기관 원문 확인', name: '2026년 코나아이 소상공인 장학생 모집' }),
    '교외 · 주관 기관 원문 확인');
  eq('  provider 가 비면 교내/교외만', cardOrgLine({ type: '교내', provider: '', name: '가족장학금' }), '교내');
  /* 🔴 기관명 칸의 꼬리 괄호(접수처 표기)를 떼고 대조한다 — 안 떼면 통째로 겹치는데도 못 알아본다
     (2026-09-21 코드 리뷰 · 실측 3건: 가송재단 · 양천장학회 · 미래의동반자재단) */
  eq('  기관명 칸의 꼬리 괄호는 떼고 대조한다',
    cardOrgLine({ type: '교외', provider: '(재)가송재단 (한국외대 접수)', name: '(재)가송재단 장학생 (한국외대 접수, 2026-2학기)' }), '교외');
  /* 🔴 **바닥값을 낮추지 말 것** — 두 글자 기관명은 엉뚱한 낱말 안에서 걸린다.
     이 줄이 없으면 `p.length >= 3` 을 1로 바꿔도 관문이 조용하다(리뷰가 잡았다). */
  eq('  두 글자 기관명으로는 지우지 않는다 (엉뚱한 낱말 안에서 걸린다)',
    cardOrgLine({ type: '교외', provider: 'KT', name: 'KT 장학금' }), '교외 · KT');
  /* 🔴 **이름이 일부만 겹치는 짝은 그대로 둔다** — 맞히려면 느슨한 대조가 필요하고,
     그건 멀쩡한 기관명을 지우는 쪽으로 틀린다. 지금 실측 5건이 이 꼴이다. */
  eq('  이름이 일부만 겹치면 윗줄을 그대로 둔다',
    cardOrgLine({ type: '교외', provider: '한국외대 총동문회', name: '총동문회 장학금 (한국외대, 2026-2학기)' }),
    '교외 · 한국외대 총동문회');

  /* 🔴 카드가 **그 함수를 실제로 부르는가** — 함수만 두고 안 부르면 아무 일도 안 일어난다
     (2026-09-19~20에 같은 자리에서 두 번 속았다: 함수만 보는 관문은 호출을 지워도 초록이다) */
  eq('카드가 cardOrgLine 을 쓴다', /<span class="sch-org">\$\{esc\(cardOrgLine\(sch\)\)\}<\/span>/.test(appJs), true);
  eq('  제목 자리는 cardTitle 그대로', /<p class="sch-name">\$\{esc\(cardTitle\(sch\)\)\}<\/p>/.test(appJs), true);
}

/* ══ 프로필 사진 (2026-09-11 개발자 지시) ═══════════════════════════════════
   "마이페이지에서 프로필사진 교체 기능 추가. 해당 기능은 본인의 사진을 요구하는 장학 공고에 쓰일 수 있음."
   브라우저 없이 잡을 수 있는 함정 셋 — 서버로 새는 길 · 사진란 없는 양식에 붙는 것 · 카드 클릭으로 번지는 것. */
{
  console.log('\n■ 프로필 사진 (2026-09-11)');
  const appJs = readText(new URL('../app.js', import.meta.url));
  const formsJs = readText(new URL('../forms.js', import.meta.url));
  const sbJs = readText(new URL('../supabase-client.js', import.meta.url));
  const html = readText(new URL('../index.html', import.meta.url));
  eq('사진은 서류 보관함과 같은 금고의 photo 칸에 둔다 (새 저장소 없음)',
    /const PHOTO_SLOT = 'photo'/.test(appJs) && /slot: PHOTO_SLOT/.test(appJs) && !/indexedDB\.open\('handaejang-photo/.test(appJs), true);
  eq('사진이 서버로 나가는 프로필에 안 들어간다 (state.profile 밖 · supabase-client 가 모른다)',
    /state\.profile\.(photo|profilePhoto)|profile\.photo\s*=/.test(appJs) || /photo|dataUrl/i.test(sbJs), false);
  /* 🔴 photoNote 는 이름과 달리 사진 이야기가 아닌 안내도 담는다(실측 13건 중 3건) — '사진' 낱말이 있을 때만 사진란 */
  eq('양식 문서에는 photoNote 에 "사진" 이 있는 양식에만 들어간다',
    /const hasPhotoBox = !!\(tpl\.photoNote && \/사진\/\.test\(tpl\.photoNote\)\)/.test(formsJs)
    && /const photo = \(hasPhotoBox && typeof profilePhotoDataUrl === 'function'\)/.test(formsJs), true);
  eq('원문 안내 문구는 사진이 있어도 지우지 않는다 (규격은 원문이 말한다)',
    /html \+= `<p class="fd-note">\$\{esc\(tpl\.photoNote\)\}<\/p>`;\n\s*if \(photo\) html \+=/.test(formsJs), true);
  eq('원본이 좌측 상단이면 왼쪽에 붙인다', /photoSide = \/좌측\|왼쪽\//.test(formsJs) && /\.fd-photo\.left \{ float:left/.test(formsJs), true);
  {
    const forms = JSON.parse(readText(new URL('../data/forms.json', import.meta.url)));
    const notes = Object.values(forms.templates || forms).map((t) => t && t.photoNote).filter(Boolean);
    const nonPhoto = notes.filter((n) => !/사진/.test(n));
    eq(`photoNote 에 사진 이야기가 아닌 안내가 실제로 있다 (지금 ${nonPhoto.length}건 — 0이면 위 관문의 뜻이 사라진다)`, nonPhoto.length > 0, true);
  }
  eq('휴지통을 거쳐도 문서용 사본(dataUrl)이 따라간다 · 없으면 blob 에서 다시 만든다',
    /rec\.dataUrl \? \{ dataUrl: rec\.dataUrl \}/.test(appJs) && /rec\.dataUrl \|\| await blobToDataUrl\(rec\.blob\)/.test(appJs), true);
  eq('초안 서버로 가는 서류 목록에 사진 칸이 섞이지 않는다',
    /k !== 'welfare' && k !== 'photo'/.test(readText(new URL('../essay.js', import.meta.url))), true);
  /* 🔴 **뜻은 그대로, 재는 자리를 옮겼다** (2026-09-12). 예전엔 캡처 단계 가로채기가
     코드에 있는지를 봤는데, 그 장치는 **카드 전체가 버튼이던 시절**에 사진 단추를 눌러도
     수정 화면이 같이 열리는 것을 막으려던 것이다. 개발자 지시로 카드가 버튼이 아니게 되어
     그 가로채기를 걷었으니, 이제는 **겹칠 수 없다는 것 자체**를 본다.
     ⚠️ 카드를 다시 버튼으로 만들면 이 줄이 빨간불이 되고, 그때 가로채기도 같이 살려야 한다.
     '사진 단추를 눌러도 안 넘어간다'는 실제 동작은 `verify-settings.js` 가 브라우저로 잰다. */
  eq('프로필 카드가 통째로 버튼이 아니다 (그래야 사진 단추와 겹칠 일이 없다)',
    /id="my-profile" class="my-card"><\/div>/.test(html), true);
  /* 🔴 **마크업만 보면 반쪽이다** (2026-09-12 코드 리뷰가 잡았다) — `role`·`tabindex` 를
     안 붙여도 app.js 에서 카드에 `onTap` 을 다시 걸면 버그가 그대로 돌아오는데 위 줄은
     초록이다. 그 배선까지 없는지 함께 본다. */
  /* ⚠️ **주석까지 세면 안 된다** — app.js 의 그 자리 주석이 걷어낸 옛 배선을
     `onTap('#my-profile', …)` 로 **인용**하고 있어, 날글자로 재면 제대로 고쳐 놓고도
     빨간불이 된다(만들면서 실제로 그랬다). 블록 주석을 지우고 진짜 코드만 본다.
     🔴 **줄머리 `/*` 만 주석으로 본다** — 아무 `/*` 나 주석 시작으로 읽으면
     `accept` 의 `image/` 뒤에 붙은 별표(app.js)에 걸려 **거기서 다음 닫는 표시까지 진짜 코드가 통째로
     지워진다**(실측: `bindPhotoButtons` 가 사라져 이 관문의 눈이 멀었다). 2026-09-12 코드 리뷰. */
  const appCode = appJs.replace(/^[ \t]*\/\*[\s\S]*?\*\//gm, '');
  eq('  app.js 도 카드 전체에 손짓을 걸지 않는다',
    /onTap\(\s*'#my-profile'/.test(appCode), false);
  eq('지우기는 삭제가 아니라 휴지통으로 옮기기다 (walletDeleteSlot 그대로)', /walletDeleteSlot\(PHOTO_SLOT\)/.test(appJs), true);
  eq('CSP 가 blob:·data: 그림을 허용한다 (사진이 안 보이면 이 줄부터)', /img-src [^;]*blob:/.test(html) && /img-src [^;]*data:/.test(html), true);
  eq('시작할 때 사진을 읽어 홈 동그라미까지 채운다', /walletRefresh\(\)\.then\(photoRefresh\)/.test(appJs), true);
}

/* ── 특별자격 이름표 (2026-09-09 신설) ───────────────────────────────────────────
   🔴 온보딩 체크박스(index.html `#in-flags`)와 이름표 표(data.js `FLAG_LABELS`)는
      **열쇠가 한 글자도 어긋나면 안 된다.**
      2026-09-03 에 특별자격을 5종 → 8종으로 늘리면서(백로그 A-4) 체크박스만 늘리고
      이름표를 안 늘렸다. 그래서 한부모·북한이탈·다문화를 고른 학생의 MY 화면이
      `특별자격: , ,` 가 됐다 — **자기가 방금 고른 것이 화면에서 통째로 사라진다.**
      셋만 고른 학생에게 남는 글자는 쉼표 둘뿐이었다(브라우저로 실측).
      이 유형은 화면이 조용히 비는 것이라 눈으로는 '해당 없음'과 구분되지 않는다.
      ⚠️ 이 검사는 **이름표 → 체크박스** 방향도 본다. 체크박스에서 뺀 항목의 이름표가
         남아 있으면 그 자리 역시 어긋난 것이다(고른 적 없는 자격이 살아난다). */
{
  console.log('\n■ 특별자격 이름표');
  const html = readText(new URL('../index.html', import.meta.url));
  const dataJs = readText(new URL('../data.js', import.meta.url));

  const block = (html.match(/<div class="check-list" id="in-flags">([\s\S]*?)<\/div>/) || [])[1] || '';
  const boxes = [...block.matchAll(/value="([A-Za-z]+)"/g)].map((m) => m[1]);

  const table = (dataJs.match(/const FLAG_LABELS = \{([\s\S]*?)\n\};/) || [])[1] || '';
  const labels = [...table.matchAll(/^\s*([A-Za-z]+):\s*'([^']+)'/gm)].map((m) => m[1]);

  eq('온보딩 특별자격 체크박스를 읽어 냈다', boxes.length >= 5, true);
  eq('이름표 표를 읽어 냈다', labels.length >= 5, true);
  eq(`체크박스에 있는데 이름표가 없는 자격이 없다 (체크박스 ${boxes.length} · 이름표 ${labels.length})`,
    boxes.filter((k) => !labels.includes(k)), []);
  eq('이름표에 있는데 체크박스에 없는 자격이 없다',
    labels.filter((k) => !boxes.includes(k)), []);

  /* 🔴 화면이 이름표를 못 찾았을 때 **빈칸을 내놓지 않는다** — 열쇠라도 보여 준다.
     빈칸은 '해당 없음'처럼 읽혀서, 학생이 자기가 입력한 것이 지워진 줄 안다.
     ⚠️ **MY 화면은 2026-09-12 개발자 지시로 특별자격 줄을 뺐다**("이거 삭제해"). 그래서
        이 규칙이 사는 자리는 이제 일괄 신청 준비 목록(`bulkTags`) 하나다 — 거기서도
        `L[f] || f` 로 열쇠를 내놓는다. MY 에 줄을 되살린다면 같은 꼴로 쓸 것. */
  const appJs = readText(new URL('../app.js', import.meta.url));
  eq('이름표 없는 자격을 빈칸으로 내놓지 않는다 (일괄 준비 목록)',
    /L\[f\]\s*\|\|\s*f/.test(appJs), true);
  eq('MY 화면에 특별자격 줄이 되살아나지 않았다 (개발자가 뺀 줄)',
    /특별자격:\s*\$\{/.test(appJs), false);
}

/* ── 학교 이름 오독 (2026-09-09 신설) ────────────────────────────────────────────
   🔴 자격 줄에서 학교 이름을 집을 때 **사업과의 관계를 말하는 말**과 **숫자에 붙은 조각**을
      학교로 읽으면, 그 공고는 **모든 학생에게 미달**이 된다. 실제로 셋이 그랬다(전수 대조):
        · `사업 참여대학에 재학 중인 자`  → `참여대학`   (중소기업취업연계장학금 — 모집 중이었다)
        · `4년제대학 재학생`(붙여 씀)     → `년제대학`   (한국장학재단 등재 · 광산김씨 장학회)
        · `국외대학재학생`                → `국외대학`
      첫 번째는 평점 4.5 · 20학점 · 3학년 재학생의 **신청 버튼을 실제로 잠그고 있었다.**
   🔴 **틀린 미달은 못 받는 것보다 나쁘다** — 그 학생은 받을 수 있는 장학금을 영영 못 본다.
      알 수 없는 것은 미달이 아니라 '모른다'여야 하므로 조건 자체를 만들지 않는다.
   ⚠️ 반대 방향도 함께 본다 — **진짜 학교 이름은 계속 잡혀야 한다.** 넓게 막으면
      `충남대학교 재학생` 이 안 잡혀 남의 학교 공고에 ✓ 가 붙는다(2026-08-30 에 고친 것). */
{
  console.log('\n■ 학교 이름 오독');
  const PR = createRequire(import.meta.url)('../parse-requirements.js');
  const schools = (t) => {
    const c = (PR.parseLine(t).conds || []).filter((x) => x.kind === 'school');
    return c.length ? c[0].anyOf : [];
  };
  const none = [
    ['사업과의 관계는 이름이 아니다 (참여대학)', '대한민국 국적자로 선발학기 사업 참여대학에 재학 중인 자'],
    ['협약대학도 이름이 아니다', '협약대학 재학생'],
    ['지정대학도 이름이 아니다', '지정대학에 재학 중인 자'],
    ['숫자에 붙은 조각을 이름으로 읽지 않는다 (4년제대학)', '4년제대학 재학생'],
    ['띄어 쓴 것도 마찬가지', '4년제 대학 재학생'],
    ['국외대학은 이름이 아니다', '국외대학재학생'],
    ['단과대학은 학교가 아니다', '공과대학 재학생'],
  ];
  none.forEach(([label, t]) => eq(label, schools(t), []));

  const some = [
    ['진짜 학교 이름은 잡는다 (충남대학교)', '현재 충남대학교 재학 중인 학부생', ['충남대학교']],
    ['방송통신대도 잡는다', '한국방송통신대학 재학생', ['한국방송통신대학']],
    ['조사가 붙어도 잡는다', '경희대학교에 재학 중인 학생', ['경희대학교']],
  ];
  some.forEach(([label, t, want]) => eq(label, schools(t), want));

  /* 남 이야기(추천인·교수)는 여전히 학생 조건이 아니다 */
  eq('출신 교수 이야기는 학생 조건이 아니다', schools('충남대학교 학부 출신 교수의 추천'), []);

  /* 🔴 지금 데이터 전수에도 없는 학교가 없어야 한다 — 규칙만 고치고 데이터를 안 재면
     새 표현이 들어와도 모른다. */
  const regItems = JSON.parse(readText(new URL('../data/registered.json', import.meta.url))).items;
  const KNOWN = /대학교$|대학$|대$/;
  const bogus = [];
  regItems.forEach((it) => (it.eligibilityLines || []).forEach((l) => {
    if (typeof l !== 'string') return;
    schools(l).forEach((n) => { if (!KNOWN.test(n) || /^(참여|협약|협력|지정|선정|대상|소속|위탁|인정|수혜|모집|파견|주관|운영|시행|연계|추천|년제|국외)/.test(n)) bogus.push(it.id + '::' + n); });
  }));
  eq('등록 공고 전수에 없는 학교가 없다', bogus, []);
}

/* ── 학위 과정 (2026-09-09 신설 · 노션 핵심-4) ──────────────────────────────────
   🔴 프로필에 학위 과정 칸이 없다. 그래서 이 축은 **'모른다'로 두는 것이 정답**이고,
      95% 라고 말하거나 미달이라고 말하는 것 둘 다 틀렸다. 실제로 겪은 것 셋:
      ① `국내 의과학 대학원 석/박사 과정 재학생` (동행복지재단 · 대학원 전용)이
         **학부 3학년 컴퓨터공학과 학생에게 적합도 95%** 로, 탐색 목록 맨 위에 떠 있었다.
         대학원 줄을 분모에서 빼고 남은 두 줄(국적·소득구간)만 셌기 때문이다.
      ② 반대로 `미술관련 학과 **대학생 및** 대학원 재학생` 처럼 **학부를 함께 적은 줄**이
         '대학원 전용'으로 읽혀 통째로 빠졌다 — 그 학생을 자격 있게 만드는 줄이 사라진다.
         원인은 '학부' 목록에 **`대학생` 이 없던 것** 하나였다(3건이 그랬다).
      ③ 그 줄에서 `미술관련` 을 학과명으로 집지 않는 것은 일부러 그렇게 둔 것인데
         (띄어 쓴 앞말은 이름이 아니다), 그러면 학과 축이 통째로 사라져 아무 학과나 통과한다.
         → **흐린 이름(fuzzy)** 으로 담는다: 맞으면 ✓, 어긋나면 '모른다'(미달 아님). */
{
  console.log('\n■ 학위 과정 · 흐린 학과');
  const req = createRequire(import.meta.url);
  const PR = req('../parse-requirements.js');
  const ME = req('../match-engine.js');

  eq('표의 한 칸은 label — 분모에서만 뺀다',
    PR.gradTarget('일반대학원생 : 2학기 이수자 이상, 평점 4.0 이상'), 'label');
  eq('대상을 말하는 문장은 body', PR.gradTarget('국내 의과학 대학원 석/박사 과정 재학생'), 'body');
  eq("'대학생' 이 함께 적힌 줄은 대학원 전용이 아니다",
    PR.gradTarget('대한민국 국적보유자로 미술관련 학과 대학생 및 대학원 재학생'), null);
  eq("'학부' 가 함께 적힌 줄도 아니다", PR.gradTarget('본교 재학생 (학부 및 대학원생)'), null);
  eq("'대학원생' 은 '대학생' 을 품지 않는다 (되돌림 방지)",
    PR.gradTarget('국내 대학원 박사과정 첫 번째 학기 재학자'), 'body');

  const prof = (major, track) => ({ name: 't', school: '경희대학교', campus: '서울캠퍼스',
    track, major, year: 3, status: '재학', gpa: 4.0, credits: 15, bracket: 4, region: 'seoul',
    flags: [], cert: false, exchange: false, common: {} });
  const sch = (lines) => ({ id: 't', name: 't', type: '교외', eligibility: { selective: true }, eligibilityLines: lines });

  /* ① 대학원 전용 공고는 **미달**이다 (95% 도, '자격 미확인' 도 아니다).
     🔴 2026-09-12 개발자 지시로 바뀐 줄이다 ("의과확지 장학금은 자격 미확인으로 뜸").
        2026-09-09 에는 '모르니까 자격 미확인' 으로 뒀는데, 우리는 모르지 않는다 —
        온보딩이 받는 학적이 학부뿐이라(index.html `#in-year` 1~4학년) 이 앱의 프로필은
        정의상 학부생이다. 되돌리려거든 온보딩에 학위 과정 칸을 먼저 만들 것.
        같은 내용을 '대학원 전용 공고는 학부 프로필에 미달' 절에서도 지킨다(원문 줄로). */
  const gradOnlyFd = ME.fitDetail(sch(['국내 의과학 대학원 석/박사 과정 재학생',
    '대한민국 국적 보유자', '한국장학재단 학자금 지원구간 5구간 이하인 자']), prof('컴퓨터공학과', 'engineering'));
  eq('대학원 전용 공고는 미달이다 (95% 도 자격 미확인도 아니다)',
    [!!gradOnlyFd.unread, gradOnlyFd.fails.length], [false, 1]);
  /* 🔴 2026-09-12 학위 축(핵심-4)으로 바뀐 숫자다 — 예전에는 대학원 줄을 만나면 그 자리에서
     끝내서 분모가 1이었다. 지금은 **모든 줄을 채점하고** 그중 학위 줄이 ✕ 다. 학생 화면에도
     '요건 3개 중 1개 충족'처럼 나머지 요건이 함께 보인다. */
  eq('  나머지 요건도 함께 채점한다 (그 줄만 ✕)', [gradOnlyFd.met, gradOnlyFd.total, gradOnlyFd.fails.length], [1, 3, 1]);

  /* ② 표의 한 칸(label)은 예전 그대로 — 여기서 막으면 가톨릭대 오탐이 되살아난다 */
  const mixedFd = ME.fitDetail(sch(['일반대학원생 : 2학기 이수자 이상, 평점 4.0 이상',
    '직전학기 평점 3.3 이상인 학부 재학생']), prof('컴퓨터공학과', 'engineering'));
  eq('학부/대학원 기준을 나란히 적은 공고는 그대로 채점한다', !!mixedFd.unread, false);

  /* ③ 흐린 학과 — 맞으면 ✓, 어긋나면 '모른다'(미달 아님) */
  const artLine = sch(['미술관련 학과 재학생']);
  const artHit = ME.fitDetail(artLine, prof('미술학과', 'arts'));
  const artMiss = ME.fitDetail(artLine, prof('컴퓨터공학과', 'engineering'));
  eq('흐린 학과가 맞으면 충족', [artHit.met, artHit.total], [1, 1]);
  eq('어긋나면 미달이 아니라 모른다', [artMiss.unknown, artMiss.fails.length], [1, 0]);
  /* 🔴 이름이 정확히 적힌 줄은 **미달을 낸다** — 흐린 쪽으로 넓히면 그 판정이 사라진다 */
  const exact = ME.fitDetail(sch(['미술학과 재학생']), prof('컴퓨터공학과', 'engineering'));
  eq('정확한 학과 이름은 여전히 미달을 낸다', exact.fails.length, 1);

  /* 🔴 데이터 전수 — 대학원 전용 공고가 높은 적합도로 떠 있지 않은가 */
  const reg = JSON.parse(readText(new URL('../data/registered.json', import.meta.url))).items;
  const bad = reg.filter((it) => {
    const ls = it.eligibilityLines || [];
    if (!ls.some((t) => PR.gradTarget(t) === 'body')) return false;
    if (ls.some((t) => PR.mentionsUndergrad(t))) return false;
    return !ME.fitDetail(it, prof('컴퓨터공학과', 'engineering')).unread;
  }).map((it) => it.id);
  eq('등록 공고 전수 — 대학원 전용인데 점수가 매겨진 것이 없다', bad, []);
}

/* ── 화면이 두 곳에서 다른 말을 하지 않는다 (2026-09-10 신설 · 코드 리뷰) ──────────
   반박 검증까지 통과한 발견 넷을 못 박는다. 공통점은 **같은 사실을 두 곳이 다르게 말하거나,
   말하는 숫자와 보여 주는 줄이 어긋난 것**이다. */
{
  console.log('\n■ 화면이 두 곳에서 다른 말을 하지 않는다');
  /* ⚠️ **주석을 먼저 걷어낸다.** 이 저장소의 주석은 사고 경위에 옛 코드를 그대로 인용하므로
     (`예전에는 showScreen() 으로 …`), 안 걷어내면 고쳐 놓은 것을 안 고쳤다고 잡는다. */
  const strip = (t) => t.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  const appJs = strip(readText(new URL('../app.js', import.meta.url)));

  /* ① 목록 카드가 '담았다'와 '다 했다'를 가른다.
     '한 번에 신청 준비'로 담은 건은 `pending: bulkNeedsWork(sch)` 로 **서류가 남은 채** 들어간다.
     그런데 카드는 `state.applications.some(...)` 로 있기만 하면 '신청 완료'라 적었다 —
     같은 공고를 신청내역은 '서류 작성 필요'라고 말하는데 카드는 다 끝났다고 말한 것이다. */
  /* ⚠️ 2026-09-11 페이스리프트로 배지가 **한 개**가 되면서 그 판정이 `cardBadgeHtml()`
     로 옮겨 갔다. 뜻은 그대로 두고 **읽는 자리만** 넓힌다 — schCard 안만 보면 고쳐 둔
     것을 안 고쳤다고 잡는다(검사를 무르게 한 것이 아니라 함수 경계를 따라간 것이다). */
  const cardAt = appJs.indexOf('function cardBadgeHtml(');
  const schAt = appJs.indexOf('function schCard(', cardAt);
  const cardBlk = appJs.slice(cardAt, appJs.indexOf('function ', schAt + 40));
  eq('목록 카드가 pending 을 본다 (있기만 하면 완료라 하지 않는다)',
    /\.find\(\(a\) => a\.id === sch\.id\)/.test(cardBlk) && /myApp\.pending/.test(cardBlk), true);
  eq("  그때 낱말은 신청내역과 같다 ('서류 작성 필요')",
    /badge-pending">서류 작성 필요</.test(cardBlk), true);
  eq('  신청내역도 같은 낱말을 쓴다 (두 벌이 아니다)',
    /app\.pending \? '서류 작성 필요'/.test(appJs), true);

  /* ② 진척도를 기록해도 화면이 맨 위로 튀지 않는다.
     `showScreen()` 은 마지막에 조건 없이 스크롤을 되돌린다 — 같은 화면을 다시 그릴 뿐인데
     화면을 '바꾸는' 함수를 부르면 신청내역을 한참 내려가 기록할 때마다 맨 위로 튄다(실측 2527→0). */
  const refAt = appJs.indexOf('function refreshProgressViews(');
  const refBlk = appJs.slice(refAt, appJs.indexOf('function toast(', refAt));
  eq('진척도 기록이 showScreen 을 부르지 않는다 (스크롤이 안 튄다)',
    /showScreen\(/.test(refBlk), false);
  eq('  대신 지금 화면의 렌더 함수만 다시 부른다',
    /renderApplications\(\)/.test(refBlk) && /renderHome\(\)/.test(refBlk), true);

  /* ③ 제출 서류 개수 머리글이 실제 줄 수와 같다.
     '아직 못 읽었다' 표시는 줄에서 갈라 냈는데 숫자는 안 갈라서, 머리글 3개 · 목록 2줄이 됐다. */
  const dcAt = appJs.indexOf('function docChecklistHtml(');
  const dcBlk = appJs.slice(dcAt, dcAt + 2600);
  eq('서류 개수 머리글이 실제로 그리는 줄(known)을 센다',
    /제출 서류 \$\{known\.length\}개/.test(dcBlk), true);
  eq("  '아직 못 읽었다' 표시를 서류로 세지 않는다",
    /제출 서류 \$\{all\.length\}개/.test(dcBlk), false);

  /* ④ 화면에 나가는 데이터는 esc 를 거친다.
     학과 칸은 학생이 직접 치는 자유 입력이라, 빠뜨리면 `B<b>학과` 한 줄에 MY 화면 아래쪽이
     통째로 그 태그 안으로 빨려 들어간다(브라우저 실측). */
  /* 🔴 **이 검사는 두 번 헛돌았다 — 그 경위를 남긴다.**
     ① 처음에는 `${p.school}` 처럼 **딱 그 이름만** 든 칸을 찾게 짜서, 실제 코드
        (`${p.school || '대학 미설정'}`)를 한 번도 못 잡았다.
     ② 다음에는 '앞에 태그가 닫혀 있는 칸만' 보게 했는데, 한 줄에 태그가 여러 개거나
        여는 태그가 **윗줄**에 있으면 못 잡았다(넷 중 둘을 놓쳤다).
     둘 다 **고친 것을 되돌려도 초록불**이라 알아챘다(red-green). 그래서 자리로 가르는 것을
     그만두고, **전부 잡고 예외를 이유와 함께 적는** 방식으로 바꿨다.
     ⚠️ 예외는 줄 번호가 아니라 **코드 한 조각**으로 적는다 — 줄은 움직인다. */
  const DATA = /(?<![\w.-])(doc|def\.doc|t\.doc|p\.major|p\.school|p\.name|sch\.name|sch\.provider|sch\.amount|app\.resultAt)(?![\w-])/;
  /* 글자용 자리 — esc 를 쓰면 학생 화면에 `&lt;` 가 그대로 보여 **오히려 틀린다**.
     전부 HTML 로 해석되지 않는 곳이다(textContent · 토스트 · 공유문 · 메일 제목 · 문서 본문). */
  const TEXT_OK = [
    "$('#home-greet').textContent",          // textContent 는 태그를 해석하지 않는다
    '`[지원 동기]',                            // 앱이 만들어 주는 지원서 본문(글자)
    'const parts = [`[${sch.name} 지원서류]`', // 공유·메일 본문
    'parts.push(`',                        // 같은 본문의 서류 절 (같은 글자 묶음)
    'navigator.share({ title:',              // 공유 시트 제목
    "toast(`'${sch.name}'",                  // 토스트도 textContent 로 넣는다(app.js el.textContent = msg)
    'const subject = `[장학금 신청]',           // 메일 제목
  ];
  const leaks = [];
  appJs.split('\n').forEach((line, i) => {
    if (TEXT_OK.some((k) => line.includes(k))) return;
    for (const m of line.matchAll(/\$\{([^{}]*)\}/g)) {
      const expr = m[1];
      if (!DATA.test(expr) || expr.includes('esc(')) continue;
      leaks.push(`${i + 1}: ${line.trim().slice(0, 74)}`);
    }
  });
  eq('화면(HTML)에 데이터를 넣을 때 esc 를 빠뜨린 자리가 없다', leaks, []);
}

/* ── 옛 프로필 값 (2026-09-09 신설) ─────────────────────────────────────────────
   🔴 **온보딩이 저장하는 값과 코드가 읽는 값이 어긋나면 그 판정은 조용히 죽는다.**
      실측으로 일곱 자리가 그랬다 — 저장되는 값은 `신입학`·`복학예정`·`서울`·`경기` 인데
      코드는 `freshman`·`returning`·`seoul`·`gyeonggi` 를 보고 있었다.
      app.js 의 `LEGACY_STATUS`·`LEGACY_REGION` 이 옛 프로필까지 새 값으로 바꿔 주므로
      그 비교는 **영영 참이 안 된다**(죽은 코드다).
      가장 아팠던 것: 온보딩이 *"직전학기 평점 (4.5 만점 · **신입학은 공란 가능**)"* 이라고
      직접 안내해 평점을 비운 신입생이, **국가장학금 Ⅰ·Ⅱ유형과 국가근로장학금에서 전부
      '정보 입력 필요' 로 떨어지고 신청 버튼이 잠겼다**(브라우저로 온보딩을 눌러 실측).
      이 저장소가 이미 아는 '상수의 뜻이 바뀌면 그 값을 읽는 곳이 조용히 죽는다' 유형이다. */
{
  console.log('\n■ 옛 프로필 값');
  const appJs = readText(new URL('../app.js', import.meta.url));
  const html = readText(new URL('../index.html', import.meta.url));

  /* 이전표에 적힌 **옛 값**이 곧 '코드에 있으면 안 되는 값'이다 — 목록을 따로 베끼지 않는다 */
  const legacy = [];
  for (const name of ['LEGACY_STATUS', 'LEGACY_REGION']) {
    const blk = (appJs.match(new RegExp(name + '\\s*=\\s*\\{([^}]*)\\}')) || [])[1] || '';
    [...blk.matchAll(/([A-Za-z_][A-Za-z0-9_]*)\s*:/g)].forEach((m) => legacy.push(m[1]));
  }
  eq('이전표에서 옛 값을 읽어 냈다', legacy.length >= 5, true);

  const files = ['app.js', 'match-engine.js', 'data.js', 'notify-rules.js', 'chat.js',
    'essay-ask.js', 'essay.js', 'form-plan.js', 'forms.js', 'interactions.js', 'resume.js'];
  /* ⚠️ **주석을 먼저 걷어낸다.** 이 저장소의 주석은 사고 경위를 길게 적어 두므로 그 안에
     옛 값이 그대로 인용돼 있다(`p.status === 'enrolled'` 처럼). 줄 첫 글자로만 가리면
     여러 줄 주석의 가운데 줄이 코드로 읽혀 헛경보가 난다(그렇게 짰다가 잡았다).
     줄 번호를 지키려고 지우는 대신 **같은 길이의 공백으로 덮는다.** */
  const strip = (src) => src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + ' '.repeat(m.length - p1.length));
  const bad = [];
  for (const f of files) {
    const src = strip(readText(new URL('../' + f, import.meta.url)));
    src.split('\n').forEach((line, i) => {
      if (/LEGACY_STATUS|LEGACY_REGION/.test(line)) return;      // 이전표 자신
      for (const v of legacy) {
        if (new RegExp("(status|region|parentRegion)\\s*[!=]==\\s*'" + v + "'").test(line)) {
          bad.push(`${f}:${i + 1} ${line.trim().slice(0, 60)}`);
        }
      }
    });
  }
  eq('옛 값과 견주는 곳이 없다 (있으면 그 판정은 죽어 있다)', bad, []);

  /* 🔴 반대 방향 — 온보딩 칩에 있는 값을 실제로 읽는가. 값이 바뀌면 여기가 먼저 걸린다. */
  const chips = [...html.matchAll(/id="in-status"[\s\S]*?<\/div>/g)][0] || '';
  const values = [...String(chips).matchAll(/data-value="([^"]+)"/g)].map((m) => m[1]);
  eq('온보딩 학적 칩을 읽어 냈다', values.length >= 5, true);
  eq("'신입학' 이 온보딩에 있다", values.includes('신입학'), true);
  const me = readText(new URL('../match-engine.js', import.meta.url));
  eq('판정 엔진이 그 값을 그대로 읽는다', /status === '신입학'/.test(me), true);
}

/* ── CI 감시 범위 (2026-09-09 신설) ─────────────────────────────────────────────
   🔴 **화면 검사는 `paths:` 에 걸린 파일이 바뀔 때만 돈다.** 그 목록을 손으로 관리하면
      새 파일이 생길 때마다 어긋나고, **어긋난 것은 조용하다** — 검사가 실패하는 게 아니라
      아예 안 도는 것이라 초록불도 빨간불도 안 뜬다.
      실측(2026-09-09): index.html 이 싣는 스크립트 23개 중 **여덟이 감시 밖**이었다
      (boot · resume · interactions · sw · supabase-client · push-config · supabase-config · chat-config).
      `boot.js` 만 고치면 그걸 검사하는 verify-resume.js 가 한 번도 안 돌았다.
      2026-09-06 의 B-4(ui-tone 이 오래 빨간불인 채 안 보였다)와 같은 뿌리다.
   ⚠️ 이 검사는 목록이 **길어지는지**를 보는 게 아니라 **덮는지**를 본다. */
{
  console.log('\n■ CI 감시 범위');
  const html = readText(new URL('../index.html', import.meta.url));
  const yml = readText(new URL('../.github/workflows/verify-ui.yml', import.meta.url));

  const block = yml.slice(yml.indexOf('    paths:'), yml.indexOf('  workflow_dispatch:'));
  const globs = [...block.matchAll(/^\s*-\s*'([^']+)'/gm)].map((m) => m[1]);
  eq('감시 목록을 읽어 냈다', globs.length > 0, true);

  /* 글로브 → 정규식 (`*` 는 `/` 를 안 넘는다 · `**` 는 넘는다) */
  const toRe = (g) => new RegExp('^' + g
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '\u0000')
    .replace(/\*/g, '[^/]*')
    .replace(/\u0000/g, '.*') + '$');
  const res = globs.map(toRe);
  const covered = (f) => res.some((r) => r.test(f));

  const scripts = [...html.matchAll(/src="([a-z0-9-]+\.js)"/g)].map((m) => m[1]);
  eq('index.html 의 스크립트를 읽어 냈다', scripts.length >= 15, true);
  eq('앱 스크립트가 전부 감시 범위 안에 있다', scripts.filter((f) => !covered(f)), []);
  eq('서비스워커도 감시한다', covered('sw.js'), true);
  eq('약관 화면도 감시한다', covered('terms.html'), true);
  eq('화면 모양(css)도 감시한다 — 말투·토큰 관문이 여기 걸려 있다', covered('style.css'), true);
  eq('검사 드라이버도 감시한다', covered('verify/verify-resume.js'), true);

  /* 🔴 반대 방향 — 로봇이 하루에 열 번씩 커밋하는 것까지 감시하면 안 된다.
     그러면 수집 커밋마다 브라우저 검사가 돌아 Actions 한도를 먹는다. */
  eq('로봇 데이터는 감시하지 않는다', covered('data/notices.json'), false);
  eq('수집기 코드도 감시하지 않는다 (자기 관문이 따로 있다)', covered('collector/collect.mjs'), false);
}

/* ── 묻지 않는 처지 · 성씨와 문중 (2026-09-09 신설) ─────────────────────────────
   🔴 프로필에 성씨 칸이 없다. 그런데 그 줄에 딸린 조건(재학·학년)만 맞으면 높은 점수가 났다:
     · `본인 또는 부모가 **명씨 성**을 가진 … 재학생`   (대하장학회 — **적합도 95%**)
     · `**광산김씨 후손**(남/녀자손)으로서 4년제대학 재학생` (광산김씨대종중 — 67%)
     · `북청읍 출신의 **후손**으로 국내 대학에 재학중인 자` (50%)
   2026-08-30 에 '우리가 묻지도 않은 처지'를 막는 장치를 만들어 뒀는데 성씨 계열이 빠져 있었다.
   ⚠️ `본관` 은 넣지 말 것 — 공고에서 그 낱말은 대개 **건물 이름**이다(실제로 걸렸다).
   ⚠️ `독립유공자 후손` 처럼 **우리가 묻는 처지**가 함께 적힌 줄은 계속 판정해야 한다. */
{
  console.log('\n■ 묻지 않는 처지 · 성씨와 문중');
  const PRx = createRequire(import.meta.url)('../parse-requirements.js');
  const un = (t) => PRx.unaskedAttr(t, PRx.parseLine(t).conds || []);
  eq('명씨 성 → 모른다', un('본인 또는 부모가 명씨 성을 가진 대학생 및 대학원 석·박사과정 재학생'), true);
  eq('광산김씨 후손 → 모른다', un('광산김씨 후손(남/녀자손)으로서 4년제대학 재학생'), true);
  eq('출신 후손 → 모른다', un('북청읍 출신의 후손으로 국내 대학에 재학중인 자'), true);
  eq('독립유공자 후손은 계속 판정한다 (우리가 묻는 처지)',
    un('대한민국 국민으로서 독립유공자 후손 중 생활이 어렵고 대학에 재학하면서 학업 성적 등 학교생활에 모범이 되는 학생'), false);
  eq("건물 이름 '본관' 을 처지로 읽지 않는다",
    un('4) 수여식 : 2026 년 9 월 3 일 ( 목 ) 오전 10 시, 장소 : 본관 203 호 이덕선 회의실'), false);
}

/* ── 모르는 것을 '미충족'이라 부르지 않는다 (2026-09-09 신설) ───────────────────
   🔴 판정 `unknown` 은 '요건에 못 미친다'가 아니라 **'우리가 못 읽었다'**는 뜻이다.
      동산장학회(이공계 새터민)에서 실제로 그랬다 — 새터민이고 이공계이고 성적도 넘는
      학생인데 자격 줄 셋 중 둘을 못 읽어 unknown 이 됐고, 화면은 '요건 미충족'이라 단정했다
      (reasons 도 비어 있어 이유조차 없었다). 확인 안 한 것을 확인했다고 말하는 것이다. */
{
  console.log('\n■ 판정 문구의 정직함');
  const appJs = readText(new URL('../app.js', import.meta.url));
  /* ⚠️ 끝을 찾을 때 **시작 뒤부터** 찾는다 — `$('#detail-sheet')` 는 파일 앞쪽에도 나와서
     그냥 indexOf 하면 시작보다 앞을 가리키고 잘라 낸 조각이 빈다(그렇게 짰다가 잡았다). */
  /* 🔴 **뜻은 그대로, 자리만 옮겼다** (2026-09-13). 2026-09-09 에 이 검사는 버튼 문구
     (`btnLabel`)를 쟀다 — 그때는 자격이 못 미더우면 버튼이 잠겨 있었고, 문구가 학생에게
     닿는 유일한 말이었기 때문이다. 지금은 자격으로 버튼을 잠그지 않으므로(핵심-2)
     그 갈래가 **버튼 위 안내(`applyLock` 의 caution)** 로 옮겨 갔다.
     ⚠️ 검사만 고쳐 통과시킨 것이 아니다 — 재는 대상을 옮겼고, 지키는 규칙은 같다:
        **모르는 것(`unknown`)을 '미충족'이라고 부르지 않는다.** */
  const from = appJs.indexOf('function applyLock(');
  const to = appJs.indexOf("/* ---------------- 상세 바텀시트", from);
  const seg = from >= 0 && to > from ? appJs.slice(from, to) : '';
  eq('신청 잠금 판정 자리를 찾았다', seg.length > 0 && seg.length < 800, true);
  eq('  갈래를 실제로 가른다 (뭉뚱그린 불리언이 아니다)', /result\.status/.test(seg), true);

  /* 학생에게 닿는 **문구** 쪽도 같은 규칙을 지키는지 본다 — 화면 문구는 상세 시트에 있다 */
  const noteFrom = appJs.indexOf('dp-note dp-caution');
  const noteTo = appJs.indexOf('id="btn-apply-one"', noteFrom);
  const note = noteFrom >= 0 && noteTo > noteFrom ? appJs.slice(noteFrom, noteTo) : '';
  eq('버튼 위 안내 문구 자리를 찾았다', note.length > 0 && note.length < 800, true);
  eq("  unknown 일 때 '요건 미충족'이라고 하지 않는다",
    /'unknown'/.test(note) && !/미충족/.test(note), true);
  /* 🔴 **문구는 바뀌었고 뜻은 그대로다** (2026-09-17 개발자 지시: "'이 공고는 지원자격을
     아직 읽지 못했습니다' 와 같은 설명이 나타나지 않게 전부 삭제 … 앱 내부 사정에 대한
     설명은 학생이 아니라 관리자에게만 나타나야 해"). 예전 이 줄은 `/읽지 못했/` 를
     요구했는데, 그건 **우리 사정**을 학생 화면에 적으라고 못 박은 것이었다.
     지키려던 규칙은 그게 아니라 '모르는 것을 미충족이라 부르지 않는다'이므로,
     규칙은 그대로 두고 잣대만 옮긴다 — 두 갈래가 서로 다른 말을 하고, unknown 쪽은
     원문에서 자격을 보라고 말하며, 우리 공정 이야기는 하지 않는다.
     ⚠️ 검사만 고쳐 통과시킨 것이 아니다 — 문구를 지운 것은 개발자 지시이고,
        '자격을 확인해 준 척하지 않는다'는 요구는 아래 세 줄이 그대로 지킨다. */
  const unkNote = (note.match(/\?\s*'([^']+)'/) || [])[1] || '';
  const badNote = (note.match(/:\s*'([^']+)'/) || [])[1] || '';
  eq('  두 갈래가 서로 다른 말을 한다', !!unkNote && !!badNote && unkNote !== badNote, true);
  eq('  unknown 쪽은 원문에서 자격을 보라고 말한다',
    /원문/.test(unkNote) && /자격/.test(unkNote), true);
  eq('  그러면서 우리 공정 이야기는 하지 않는다 (2026-09-17 개발자 지시)',
    /읽지 못|검수|AI가/.test(unkNote), false);
  /* 🔴 미달 쪽 문구도 **단정하지 않는다** — 우리 판정이 틀릴 수 있다는 것이 이 업무의 전제다 */
  eq('  미달 쪽도 단정하지 않는다 (틀릴 수 있다고 말한다)', /틀릴 수 있/.test(note), true);
}

/* ── 🔴 못 읽은 금액 어림잡기 (2026-09-17 개발자 지시) ──
   "금액을 읽지 못한 공고에 대해서는 앞으로 금액 추정하여 해당 인터페이스에 합산되도록 해줘."
   🔴 이 저장소는 **정확히 반대 방향의 사고**를 이미 겪었다 — 2026-07-30 에 확인한 적 없는
      `amountValue: 500000` 을 전 공고에 박아 넣어 홈 합계가 부풀어 있었고, 그걸 '지어낸
      숫자'라고 걷어내면서 `audit-data.js` 에 관문을 세웠다. 그래서 이번 추정은 **데이터가
      아니라 합계 한 곳**에서만 산다. 이 절이 그 선을 지킨다.
   🔴 짐작의 근거는 우리가 **실제로 읽은 금액들의 중앙값**이다 — 상수를 박으면 그게
      2026-07-30 의 500,000 과 같은 물건이 된다. */
console.log('\n■ 못 읽은 금액 어림잡기 (2026-09-17 개발자 지시)');
{
  const req2 = createRequire(import.meta.url);
  const PA = req2('../parse-amount.js');
  const mk = (id, won, extra) => Object.assign({ id: id, amount: won ? won + '원' : '',
    amountValue: won || 0 }, extra || {});
  /* 읽은 금액 셋(100·200·900만) + 못 읽은 둘 — 중앙값은 200만이다 */
  const pool = [mk('a', 1000000), mk('b', 2000000), mk('c', 9000000), mk('u1', 0), mk('u2', 0)];

  const off = PA.sumAmounts(pool, {});
  eq('기본값은 그대로다 — 켜지 않으면 한 푼도 어림잡지 않는다',
    [off.total, off.assumedWon, off.assumed.length], [12000000, 0, 0]);

  const on = PA.sumAmounts(pool, { estimate: true });
  eq('켜면 못 읽은 건마다 중앙값을 더한다', on.assumedEach, 2000000);
  eq('  그래서 합계가 두 건 몫만큼 늘어난다', on.total, 12000000 + 2 * 2000000);
  eq('  어림잡은 건수를 셀 수 있다', on.assumed.length, 2);
  /* 🔴 금액 상세가 그 목록을 '금액 원문 확인'으로 그대로 보여 줘야 짚어 볼 수 있다 */
  eq('  미확인 목록에서 빼지 않는다 (금액 상세가 그대로 보여 준다)', on.unknown.length, 2);

  /* 🔴 근거가 0건이면 짐작하지 않는다 — 근거 없는 추정은 지어내는 것이다 */
  const none = PA.sumAmounts([mk('u1', 0), mk('u2', 0)], { estimate: true });
  eq('읽은 금액이 하나도 없으면 어림잡지 않는다', [none.total, none.assumedWon], [0, 0]);

  /* 🔴 이중수혜가 넓게 막힌 공고는 짐작에서도 뺀다 — onlyOne 이 이미 하나만 세는데
     여기서 또 더하면 '함께 받을 수 없는 돈'을 더하는 셈이다(parse-amount 첫머리). */
  const exc = PA.sumAmounts(pool.concat([
    mk('x', 0, { exclusivity: { kind: 'forbidden', scope: 'external' } }),
  ]), { estimate: true });
  eq('함께 못 받는 공고는 어림잡지 않는다', exc.assumed.length, 2);
  /* 반대로 좁은 이중수혜는 함께 받을 수 있으므로 어림잡는다 (scope 값을 뭉뚱그리지 않는다) */
  const nar = PA.sumAmounts(pool.concat([
    mk('y', 0, { exclusivity: { kind: 'forbidden', scope: 'narrow' } }),
  ]), { estimate: true });
  eq('  범위가 좁은 이중수혜는 어림잡는다', nar.assumed.length, 3);

  /* ── 🔴 짐작이 데이터로 새지 않는가 ── */
  /* ⚠️ 주석은 코드가 아니다 — 안 걸러내면 이 변경을 설명하는 주석이 '켜는 곳'으로 세어진다
     (실제로 그렇게 짰다가 2건으로 나왔다). '적합도 상수' 절이 쓰는 방식 그대로다. */
  const appSrc2 = readText(new URL('../app.js', import.meta.url))
    .replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
  eq('켜는 곳은 홈 히어로 한 곳뿐이다 (금액 상세·감사는 확인된 금액만 본다)',
    (appSrc2.match(/estimate:\s*true/g) || []).length, 1);
  eq('  그리고 그 자리는 renderHome 이다',
    appSrc2.indexOf('estimate: true') > appSrc2.indexOf('function renderHome(')
    && appSrc2.indexOf('estimate: true') < appSrc2.indexOf('function renderExplore('), true);
  /* 🔴 2026-07-30 의 재발 방지 — 등록 데이터에 확인 안 한 금액이 들어가면 감사가 잡지만,
     여기서도 한 번 본다(관문이 하나뿐이면 그 하나가 꺼졌을 때 아무도 모른다). */
  const regItems = req2('../data/registered.json').items;
  const madeUp = regItems.filter((it) => it.amountValue > 0 && !/[0-9０-９]/.test(it.amount || ''));
  eq('등록 데이터에는 어림잡은 금액이 한 건도 안 들어갔다',
    madeUp.map((it) => it.id), []);

  /* 🔴 **홈 히어로는 '약' 을 붙이지 않는다** (2026-09-17 개발자 지시 2차).
     한때 어림잡은 몫이 섞이면 '약' 을 붙였는데 개발자가 걷으라고 했다 — *"어차피 사용자가
     직접 공고 내 들어가면 금액 있는 원문은 최대 ~ 라고 표시되고 추정치는 금액 원문 확인으로
     표시되므로"*. 어느 공고가 확인된 것인지는 카드와 상세가 이미 말한다.
     🔴 그 대신 **금액 상세는 내역을 그대로 말해야 한다** — 둘 다 걷으면 어림잡은 숫자를
        확인한 숫자처럼 내놓게 된다(원칙 8-1). 아래 두 줄이 그 자리를 지킨다. */
  /* ⚠️ **파일 전체를 훑지 말 것** — 금액 상세(renderAmountDetail)는 '약' 을 **일부러**
     쓴다(바로 아래 줄에서 어림잡았다고 밝히므로 짝이 맞다). 홈 히어로 안만 본다. */
  const homeBody = appSrc2.slice(appSrc2.indexOf('function renderHome('),
    appSrc2.indexOf('function renderExplore('));
  eq('renderHome 구간을 찾았다', homeBody.length > 500, true);
  eq("홈 히어로가 '약' 을 붙이지 않는다", /'약 '/.test(homeBody), false);
  eq('  홈 히어로는 countUp 에 최대만 넘긴다',
    /countUp\(\$\('#hero-amount'\), total, \(v\) => `최대 \$\{won\(v\)\}`\)/.test(appSrc2), true);
  eq('금액 상세는 어림잡은 몫을 그대로 밝힌다 (여기까지 걷으면 안 된다)',
    /금액을 못 읽은 \$\{bill\.assumed\.length\}건은 어림잡아 더함/.test(appSrc2)
    && /확인된 공고들의 중앙값/.test(appSrc2), true);

  /* 🔴 히어로 아랫줄은 **요소째로 없앴다** (2026-09-17 개발자 지시 2차: "금액 밑에 있는
     '그중 N건은 바로 신청할 수 있어요' 안내도 삭제해줘"). 금액 회계 두 줄에 이어 마지막
     한 줄까지 걷어, 히어로는 건수·금액·버튼 셋뿐이다. */
  {
    const h2 = readText(new URL('../index.html', import.meta.url));
    eq("히어로에 '그중 n건은 바로 신청할 수 있어요' 가 없다",
      /바로 신청할 수 있어요/.test(appSrc2), false);
    eq('  #hero-count 요소 자체가 없다 (채우는 곳 없는 빈 칸을 남기지 않는다)',
      /id="hero-count"/.test(h2), false);
    /* 🔴 그 칸이 주던 아래 여백을 물려받지 않으면 금액과 버튼이 2px 로 붙는다(실측 57 → 2).
       style.css 는 뒤 블록이 앞을 덮으므로 파일 끝 '히어로' 절에 있어야 먹는다. */
    const css = readText(new URL('../style.css', import.meta.url));
    const tail = css.slice(css.lastIndexOf('홈 히어로 (2026-09-17'));
    eq('  금액 아래 여백을 .hero-amount 가 물려받는다 (파일 끝 블록에서)',
      /\.hero-amount \{ margin-bottom: 20px; \}/.test(tail), true);
  }
}

/* ── 🔴 앱 내부 사정은 학생 화면에 적지 않는다 (2026-09-17 개발자 지시) ──
   "이와 같이 앱 내부 사정에 대한 설명은 학생이 아니라 관리자에게만 나타나야 해.
    현재 앱 내에 존재하는 다음과 같은 설명들을 모두 찾아 삭제하고 필요하다면 해당 내용을
    관리자 페이지에 추가해."
   🔴 **없어진 게 아니라 자리를 옮긴 것**이라, 이 절은 양쪽을 같이 본다 —
      앱1(app.js)에서 사라졌는가 **그리고** 관리자 화면이 그것을 세는가.
      한쪽만 보면 '학생에게도 안 보이고 우리도 모르는' 상태가 조용히 만들어진다.
   ⚠️ 지우면 안 되는 것도 못 박는다 — '자격 미확인' 배지와 unknown 안내 문구는 남아야
      한다(2026-09-17 개발자 확인). 없으면 자격을 한 줄도 못 읽은 공고가 아무 말 없이
      신청 버튼만 내밀어, 앱이 확인해 준 것처럼 읽힌다(원칙 8-1). */
console.log('\n■ 앱 내부 사정은 학생 화면에 적지 않는다 (2026-09-17 개발자 지시)');
{
  const app = readText(new URL('../app.js', import.meta.url));
  const adm = readText(new URL('../_admin/admin.js', import.meta.url));
  /* 주석은 화면이 아니다 — 이 변경을 설명하는 주석마다 걸리면 관문이 못 쓰게 된다.
     (바로 위 '적합도 상수' 절이 같은 이유로 쓰는 방식 그대로다.) */
  const codeOnly = (t) => t
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
  const appCode = codeOnly(app);

  /* ① 학생 화면에서 사라졌는가 — 지시가 콕 집은 문장부터 */
  eq('「지원 자격을 아직 읽지 못했습니다」가 학생 화면에 없다',
    /지원 자격을 아직 읽지 못했습니다/.test(appCode), false);
  eq('「AI가 공고 원문에서 읽은 것입니다」가 학생 화면에 없다',
    /AI가 공고 원문에서 읽은 것입니다/.test(appCode), false);
  eq('「자동 등록 · 검수 전」 배지가 학생 화면에 없다',
    /자동 등록 · 검수 전/.test(appCode), false);
  eq('  상세 시트 갈래 배지에도 「검수 전」을 붙이지 않는다',
    /' · 검수 전'/.test(appCode), false);
  eq('「날짜를 아직 읽지 못한 공고」가 학생 화면에 없다',
    /날짜를 아직 읽지 못한/.test(appCode), false);
  /* 홈 히어로의 금액 회계 두 줄 — 개발자가 스크린샷으로 짚은 자리 */
  eq('홈 히어로가 「금액을 아직 못 읽은 n건은 뺀 금액」이라고 말하지 않는다',
    /못 읽은 \$\{unknownAmt\}건은 뺀 금액|건은 뺀 금액이에요/.test(appCode), false);
  eq('  「확인된 금액만 더한 금액이에요」도 없다',
    /확인된 금액만 더한 금액이에요/.test(appCode), false);

  /* ② 관리자 화면이 그것을 세는가 — 옮긴 자리가 실제로 있는지 본다 */
  eq('관리자 화면이 「AI가 읽은 자격 · 사람 검수 전」을 센다',
    /AI가 읽은 자격 · 사람 검수 전/.test(adm) && /aiReadCount/.test(adm), true);
  eq('  그 판정식이 관리자 쪽에 있다',
    /eligibilityFrom[\s\S]{0,80}eligibilityReviewed/.test(adm), true);
  eq('  그리고 앱1 에는 더 이상 없다 (원본이 둘이면 갈라진다)',
    /eligibilityReviewed/.test(appCode), false);
  eq('관리자 화면이 「검수 전」 공고를 여전히 센다',
    /검수 전/.test(adm), true);
  eq('관리자 화면이 금액·마감·자격 미확보를 여전히 센다',
    /금액 미확인/.test(adm) && /마감일 없음/.test(adm) && /지원 자격 미확보/.test(adm), true);

  /* ③ 🔴 지워서는 안 되는 것 — 여기까지 지우면 앱이 '확인해 줬다'고 말하는 셈이 된다 */
  eq('그래도 「자격 미확인」 배지는 남아 있다 (원칙 8-1)',
    /badge-fit-unknown">자격 미확인</.test(appCode), true);
  eq('  자격을 못 읽은 공고는 신청 전에 원문을 보라고 말한다',
    /공고 원문에서 지원 자격을 확인하세요/.test(appCode), true);
}

/* ── 🔴 DESIGN.md 가 style.css 와 갈라지지 않게 (2026-09-11) ──
   `DESIGN.md` 는 style.css 의 값을 사람이 읽게 옮긴 **사본**이다. 사본은 관문이 없으면
   반드시 썩는다 — 실제로 그랬다: 그 문서는 2026-09-11 04:45 에 만들어졌는데 서체를
   Pretendard 로 되돌린 커밋이 **3분 뒤인 04:48** 에 들어와, 문서가 `SUIT`/`SUITE` 와
   46px 척도를 적은 채로 남았다. 개발자가 그날 직접 되돌리라고 말한 바로 그 값이다.
   🔴 원본은 style.css 하나다. 값을 바꿀 땐 CSS 를 고치고 문서를 따라 고친다.
   ⚠️ 역할 이름(`body`·`card-title`)까지 맞추려 들지 않는다 — 그 대응은 사람이 정하는 것이라
      여기서 강제하면 이름을 바꿀 때마다 관문이 막는다. **쓰인 값이 CSS 에 있는가**만 본다. */
console.log('\n■ DESIGN.md 가 style.css 와 같은 값을 적는가 (2026-09-11)');
{
  const css = readText(new URL('../style.css', import.meta.url));
  const design = readText(new URL('../DESIGN.md', import.meta.url));

  /* :root 가 여러 번 나오고 **뒤에 나온 것이 이긴다** — 첫 덩어리만 읽으면 옛 팔레트를 본다 */
  const rootVars = {};
  const re = /(^|\n)\s*:root\s*\{/g;
  let m;
  while ((m = re.exec(css))) {
    const st = css.indexOf('{', m.index) + 1, en = css.indexOf('}', st);
    for (const d of css.slice(st, en).matchAll(/--([a-z0-9-]+):\s*([^;]+);/g)) {
      rootVars[d[1]] = d[2].split('/*')[0].trim();
    }
  }
  const scale = Object.keys(rootVars).filter((k) => /^t-/.test(k)).map((k) => rootVars[k]);
  eq('style.css 에서 글자 척도를 읽어 냈다 (못 읽으면 조용히 통과하면 안 된다)', scale.length >= 5, true);

  const sizes = [...design.matchAll(/fontSize:\s*([0-9.]+px)/g)].map((x) => x[1]);
  eq('DESIGN.md 에서 글자 크기를 읽어 냈다', sizes.length >= 5, true);
  eq('  적힌 글자 크기가 전부 style.css 의 --t-* 안에 있다',
    sizes.filter((v) => !scale.includes(v)), []);

  const family = (rootVars['font-text'] || '').split(',')[0].replace(/['"]/g, '').trim();
  const fams = [...new Set([...design.matchAll(/fontFamily:\s*([^\n]+)/g)].map((x) => x[1].trim()))];
  eq(`  적힌 글꼴이 --font-text 와 같다 (지금 ${family})`, fams.filter((f) => f !== family), []);

  /* 색은 이름이 다르므로(canvas↔bg) 짝을 여기 적는다 — 이 여섯이 문서의 주장이다 */
  for (const [doc, cssName] of [['canvas', 'bg'], ['surface-1', 'surface'], ['surface-2', 'surface-2'],
                                ['ink', 'text'], ['primary', 'primary'], ['accent', 'accent']]) {
    const want = rootVars[cssName];
    const got = (design.match(new RegExp('\\n  ' + doc + ':\\s*"([^"]+)"')) || [])[1];
    eq(`  ${doc} = --${cssName}`, got && got.toLowerCase(), want && want.toLowerCase());
  }
}


/* ══════════════════════════════════════════════════════════════════════════
   한국장학재단(층2) 첨부 — 재단 홈페이지 하나만 주던 구조를 고친 자리 (2026-09-12)

   🔴 개발자 지적: *"KOSAF 에서 크롤링 해오는 외부 공고들은 신청 양식 / 첨부파일 /
      원문 공고 링크만 없고 해당 장학 재단으로만 이동할 수 있는 구조"*.
      원인은 상세 파서가 `strip()` 으로 태그를 지우면서 **첨부로 가는 유일한 길을
      `[다운로드]` 라는 글자로 뭉갠 것**이었다. 넉 달 동안 그 글자만 갖고 있었다.
   여기 있는 것은 전부 그 수리가 되돌아가면 빨간불이 되는 것들이다.
   ══════════════════════════════════════════════════════════════════════════ */
console.log('\n■ 층2 첨부 — 상세 화면에서 공고문 링크를 읽는다');
{
  const row = (cell) => `<table><tr><th>선발공고문</th><td>${cell}</td></tr></table>`;

  /* ① 진짜 주소 — 경로만 온 것은 KOSAF 본주소에 붙인다 */
  const a1 = parseFiles(row(`<a href="/CO/fileDown.do?atchFileId=FILE_000123&fileSn=0">[다운로드]</a>`));
  eq('경로형 첨부를 절대 주소로 읽는다', a1.map((f) => f.url),
    ['https://portal.kosaf.go.kr/CO/fileDown.do?atchFileId=FILE_000123&fileSn=0']);

  /* ② 클릭형 — 주소가 없으면 **지어내지 않고** 호출을 그대로 남긴다(원칙 8-1).
        리포트가 이 날것을 보여 주고, 그걸 보고 다음 수리를 한다. */
  const a2 = parseFiles(row(`<a href="#" onclick="fn_fileDown('FILE_000999','2'); return false;">[다운로드]</a>`));
  eq('클릭형은 주소를 지어내지 않는다', a2.map((f) => f.url), [undefined]);
  eq('  대신 호출을 그대로 남긴다', a2.map((f) => f.call), [{ fn: 'fn_fileDown', args: ['FILE_000999', '2'] }]);

  /* ③ 빈 앵커는 첨부가 아니다 — 걸러 두지 않으면 '못 받은 첨부'로 리포트에 쌓여
        진짜 못 받은 것이 그 잡음에 묻힌다 */
  eq('javascript:void(0) 는 첨부가 아니다', parseFiles(row(`<a href="javascript:void(0);">미리보기</a>`)), []);
  eq('첨부 칸이 없으면 빈 목록', parseFiles('<table><tr><th>성적기준</th><td>평점 3.0</td></tr></table>'), []);

  /* ④ 이름은 본문이 아니라 **헤더**에 있다(링크 글자는 `[다운로드]` 하나뿐이라 이름이 없다).
        관공서 서버는 세 가지 꼴을 섞어 쓰는데, 마지막 것을 그냥 쓰면 이름이 깨진다. */
  eq('RFC5987 이름', filenameFrom("attachment; filename*=UTF-8''%EA%B3%B5%EA%B3%A0%EB%AC%B8.pdf", 'x'), '공고문.pdf');
  eq('퍼센트 인코딩 이름', filenameFrom('attachment; filename="%EA%B3%B5%EA%B3%A0.hwp"', 'x'), '공고.hwp');
  eq('EUC-KR 바이트를 latin1 로 실어 보낸 이름',
    filenameFrom(`attachment; filename="${Buffer.from('공고문.pdf', 'utf8').toString('latin1')}"`, 'x'), '공고문.pdf');
  eq('이름이 없으면 우리가 정한 이름', filenameFrom('', '선발공고문-1'), '선발공고문-1');

  /* ⑤ 🔴 재단이 붙인 이름을 그대로 디스크에 쓰면 저장소 아무 데나 쓰게 된다 */
  eq('상위 경로를 이름으로 못 쓴다', safeFileName('../../.github/workflows/deploy.yml'), 'deploy.yml');
  eq('경로 구분자를 떼어 낸다', safeFileName('a/b/공고문.pdf'), '공고문.pdf');
  eq('이름이 통째로 비면 대체 이름', safeFileName('   ', 'fallback'), 'fallback');

  /* ⑥ 🔴 KOSAF 는 막을 때 404 가 아니라 **200 에 HTML** 로 답한다. 그걸 저장하면
        학생이 '공고문'을 눌러 오류 화면을 내려받는다. */
  eq('HTML 응답을 파일로 착각하지 않는다', looksLikeHtml(Buffer.from('<!DOCTYPE html><html><head>')), true);
  eq('  진짜 PDF 는 통과', looksLikeHtml(Buffer.from('%PDF-1.7 ...')), false);
  /* ⑦ 확장자를 믿지 않는다 — 첨부 주소에 확장자가 없으면 이름이 비어 온다 */
  eq('앞 바이트로 PDF 를 가른다', sniffKind(Buffer.from('%PDF-1.4')), 'pdf');
  eq('앞 바이트로 HWP(OLE) 를 가른다', sniffKind(Buffer.from('d0cf11e0a1b11ae1', 'hex')), 'ole');
  eq('앞 바이트로 hwpx·docx(zip) 를 가른다', sniffKind(Buffer.from('504b0304', 'hex')), 'zip');

  /* ⑧ 🔴 **실제 표 순서로 재는 회귀** — 2026-09-12 코드 리뷰가 잡은 치명적 버그.
        `선발공고문` 은 상세표의 **맨 마지막 칸**이고, 그보다 앞 칸(`자격제한`·`제출처 및
        제출서류`)에는 `※ 자세한 사항은 첨부파일 또는 홈페이지 참고` 라는 상투구가 거의
        항상 들어 있다(실측: 선발공고문 칸이 있는 1,587곳 중 **1,525곳**).
        낱말로 줄을 찾으면 96%가 엉뚱한 행을 집고, 그러면 첨부가 0건이 되면서
        **관문 셋이 전부 빈 목록을 상대로 통과한다**(조용한 초록불). */
  const real = `<table>
    <tr><th>자격제한</th><td>휴학생 제외 ㅁ※ 자세한 사항은 첨부파일 또는 홈페이지 참고</td></tr>
    <tr><th>제출처 및 제출서류</th><td>장학생 신청서 ※ 자세한 사항은 첨부파일 또는 홈페이지 참고</td></tr>
    <tr><th>문의처</th><td>062-607-2414</td><th>선발공고문</th><td><a href="/CO/fileDown.do?id=Z9">[다운로드]</a></td></tr>
  </table>`;
  eq('앞 칸의 「첨부파일 참고」 상투구에 속지 않는다', parseFiles(real).map((f) => f.url),
    ['https://portal.kosaf.go.kr/CO/fileDown.do?id=Z9']);
  /* 한 줄에 이름표·내용이 두 쌍씩 오는 표라, 줄이 아니라 **칸 자리**로 짚어야 한다 */
  eq('  같은 줄의 앞 칸(문의처)을 첨부로 착각하지 않는다',
    /062-607/.test(JSON.stringify(parseFiles(real))), false);

  /* ⑨ 🔴 **실제 KOSAF 첨부 주소로 재는 회귀** (2026-09-12 정찰 run 34708636409 에서 그대로 가져왔다).
        정찰하지 않았으면 못 봤을 함정 둘이 이 한 줄에 다 들어 있다:
          · href 가 **중간부터 `&amp;` 로 적혀 있다** — 안 풀면 칸 이름이 `amp;path`·`amp;encVal`
            이 되어 서버가 알아듣지 못하고, 그 실패는 **200 에 HTML** 로 조용히 돌아온다.
          · 주소에 **공백과 한글이 날것으로** 들어 있다 — 규격대로 인코딩하지 않으면 fetch 가 던진다. */
  const realHref = 'https://portal.kosaf.go.kr/FL/downloadServletEcm.do'
    + '?filename=SS/SL/goods/2.+2026년+울진군+대학생+장학금+신청+및+선발공고_260708 (1)_2026090214255200.hwp'
    + '&FileNameDn=2.+2026년+울진군+대학생+장학금+신청+및+선발공고_260708 (1).hwp'
    + '&amp;path=KOSAF_COMMON&amp;encVal=c7f33ce75b6106012d1d04958826fa63';
  const realOut = parseFiles(`<table><tr><th>선발공고문</th><td><a href="${realHref}" /><strong>[다운로드]</strong></a></td></tr></table>`);
  const realUrl = new URL(realOut[0].url);
  eq('KOSAF 주소의 &amp; 를 푼다 (안 풀면 칸 이름이 amp;path 가 된다)',
    [realUrl.searchParams.get('path'), !!realUrl.searchParams.get('encVal')], ['KOSAF_COMMON', true]);
  eq('  공백·한글을 규격대로 인코딩한다 (날것이면 fetch 가 던진다)',
    /\s|[가-힣]/.test(realOut[0].url), false);
  /* 🔴 이름은 **주소에 적힌 것**(`FileNameDn=`)을 먼저 쓴다 — 헤더는 인코딩이 제각각이다.
        질의 문자열이라 `+` 는 공백이다. */
  eq('  보여 줄 이름을 주소에서 읽는다',
    nameFromUrl(realOut[0].url), '2. 2026년 울진군 대학생 장학금 신청 및 선발공고_260708 (1).hwp');
  /* 날것(raw)은 주소를 못 만들었을 때만 남긴다 — 전부 담으면 재단 1,587곳 × 300자로
     data/kosaf.json 이 0.5MB 불어난다 */
  eq('  주소를 만들었으면 날것을 담지 않는다', 'raw' in realOut[0], false);
}

console.log('\n■ 층2 첨부 — 학생이 실제로 받을 수 있는 주소만 앱에 나간다');
{
  /* 🔴 KOSAF 첨부 원주소는 Referer 검사가 있어 앱에서 누르면 "비정상적인 접근"이 뜬다.
     앱 파일에 담기는 것은 **우리가 받아 둔 사본 경로**뿐이어야 한다. */
  const src = {
    updatedAt: '2026-09-12T00:00:00Z', source: 't',
    items: [{
      code: '111', org: '테스트장학회', name: '장학생', kind: '민간', goods: '장학금',
      due: '2999-12-31', home: 'https://example.or.kr',
      detail: { 신청기간: '2026-09-01~2999-12-31' },
      files: [{ text: '[다운로드]', url: 'https://portal.kosaf.go.kr/CO/fileDown.do?x=1' }],
      mirror: { at: '2026-09-12', files: [
        { name: '선발공고문.pdf', path: 'data/kosaf-files/111/선발공고문.pdf', bytes: 12345 },
        { name: '나쁜 것', path: 'https://portal.kosaf.go.kr/CO/fileDown.do?x=1', bytes: 1 },
      ] },
    }],
  };
  const out = slimKosaf(src, '2026-09-12');
  eq('받아 둔 사본을 앱 파일에 담는다', (out.items[0].files || []).map((f) => f.path),
    ['data/kosaf-files/111/선발공고문.pdf']);
  eq('  KOSAF 원주소는 담지 않는다', /kosaf\.go\.kr/.test(JSON.stringify(out.items)), false);
  eq('  받아 둔 것이 없으면 칸 자체가 없다',
    'files' in slimKosaf({ ...src, items: [{ ...src.items[0], mirror: undefined }] }, '2026-09-12').items[0], false);
}

console.log('\n■ 층2 첨부 — 앱이 그 파일을 실제로 열 수 있게 배선돼 있다');
{
  const appjs = readText(new URL('../app.js', import.meta.url));
  const swjs = readText(new URL('../sw.js', import.meta.url));
  /* 🔴 `location.origin` 을 기준으로 풀면 `data/…` 가 **사이트 뿌리**로 풀려 404 다
     (앱은 …github.io/hanggonggan/ 에 있다). 되돌리면 공고문 링크가 전부 죽는다. */
  eq('safeUrl 이 앱이 놓인 자리를 기준으로 푼다', /new URL\(String\(u\), document\.baseURI\)/.test(appjs), true);
  /* 🔴 서비스워커가 가로채면 느린 회선에서 **3.5초 시한에 걸려 index.html 이 대신 나간다** —
     공고문을 눌렀는데 앱이 또 열린다. */
  const guard = 'if (/\\/data\\/kosaf-files\\//.test(url.pathname)) return;';
  eq('서비스워커가 공고문 사본을 가로채지 않는다', swjs.includes(guard), true);
  /* ⚠️ 위치를 **낱말**로 재지 말 것 (2026-09-12 코드 리뷰) — 'kosaf-files' 는 파일 맨 위
     CACHE 주석에도 있어서, 가드를 navigate 분기 **아래로 옮겨도** 영원히 초록불이었다.
     가드 줄 자체의 자리를 잰다. */
  eq('  그 줄이 navigate 분기보다 위에 있다',
    swjs.indexOf(guard) >= 0 && swjs.indexOf(guard) < swjs.indexOf("e.request.mode === 'navigate'"), true);
  /* 🔴 층2 의 sourceUrl 은 KOSAF 가 아니라 그 재단 홈페이지다 — 이름을 틀리면 거짓말이 된다 */
  eq('층2 원문 링크를 재단 홈페이지라고 부른다', /sourceKind === 'kosaf' \? '재단 홈페이지 ↗'/.test(appjs), true);
  eq('층2 사본을 첨부로 넘긴다', /attachments: i\.files\.map/.test(appjs), true);
}

/* ══════════════════════════════════════════════════════════════════════════
   층2 빈 껍데기 — 재단이 '선발공고문' 자리에 올려 둔 **속이 빈 파일** (2026-09-13)

   학생이 층2의 유일한 공고 원문을 눌렀는데 빈 문서가 열리는 것은 안내가 아니라 헛걸음이다.
   실측(사본 70개 전수): 증명된 빈 것 5개(0·0·5·8·29자) · 진짜 공고문의 최소 823자 ·
   **못 읽은 것 10개**(스캔 PDF 5 · 포스터 JPG 5 — 학생은 그림으로 읽는다).
   ══════════════════════════════════════════════════════════════════════════ */
console.log('\n■ 층2 빈 껍데기 판정 (collector/kosaf-empty.mjs)');
{
  /* ① 열어 본 글자로 가른다 — 문턱은 증명된 빈 것(29자)과 진짜 공고문(823자) 사이 */
  eq('글자가 0자면 빈 것', emptyVerdict({ name: '공고문 없음.hwp', chars: 0 }).empty, true);
  eq('글자가 29자여도 빈 것', emptyVerdict({ name: '선발 공고문 없음.hwp', chars: 29 }).empty, true);
  eq('글자가 823자면 진짜 공고문', emptyVerdict({ name: '영축총림 장학금 신청 안내.hwp', chars: 823 }).empty, false);
  eq('문턱은 200자', MIN_BODY_CHARS, 200);
  /* ② 🔴 **'못 읽음'은 '비었음'이 아니다** — 이 한 줄을 지우면 스캔 PDF·포스터 JPG 10건이
        학생 화면에서 통째로 사라진다(원칙 8-1: 확인 안 한 것을 단정하지 않는다). */
  eq('못 읽은 것은 숨기지 않는다 (스캔 PDF)',
    emptyVerdict({ name: '2026년도_하반기_장학생_선발계획_공고문.pdf', chars: null }).empty, false);
  eq('  포스터 JPG 도 마찬가지', emptyVerdict({ name: '석성2026.jpg', chars: null }).empty, false);
  eq('  왜 안 숨겼는지 말한다', emptyVerdict({ name: 'x.pdf', chars: null }).why, '열지 못함(이미지·스캔)');
  /* ③ 🔴 이름은 증거일 뿐 근거가 아니다 — 이름이 멀쩡해도 속이 비면 내린다 */
  eq('이름이 멀쩡해도 속이 비면 내린다', emptyVerdict({ name: '2026 선발계획 공고.hwp', chars: 3 }).empty, true);
  eq('이름이 "공고문 없음"이어도 내용이 있으면 안 내린다',
    emptyVerdict({ name: '공고문 없음.hwp', chars: 1200 }).empty, false);
  /* ④ 사유는 사람이 읽고 되살릴지 정하는 근거라 **숫자를 적는다**(지어내지 않는다) */
  eq('사유에 글자 수를 적는다', emptyVerdict({ name: '공고문 없음.hwp', chars: 5 }).why,
    "열어 보니 글자가 5자 · 파일 이름도 '공고문 없음.hwp'");
  /* ⑤ 공백은 빼고 센다 — 개행 두 바이트를 '2자'로 세면 빈 파일이 안 걸린다 */
  eq('공백은 글자로 세지 않는다', charsOfText('\n \t\r\n'), 0);
  /* ⑥ 목록에서 뽑기 — 파일이 없는 재단은 아무것도 내놓지 않는다 */
  const items = [
    { code: 'A', org: '가재단', files: [{ name: '공고문 없음.hwp', path: 'p/a' }, { name: '진짜.hwp', path: 'p/b' }] },
    { code: 'B', org: '나재단' },
  ];
  const chars = (p) => ({ 'p/a': 4, 'p/b': 5000 }[p] ?? null);
  eq('빈 첨부만 골라낸다', emptyShells(items, chars).map((x) => [x.code, x.file]), [['A', '공고문 없음.hwp']]);
}

console.log('\n■ 층2 제외 장부 (collector/kosaf-block.json → slimKosaf)');
{
  const today = '2026-09-13';
  const data = { items: [
    { code: 'A', org: '가재단', name: '장학생', goods: '장학금', due: '2026-12-01',
      detail: { 신청기간: '~12/1' },
      mirror: { files: [{ name: '공고문 없음.hwp', path: 'data/kosaf-files/A/공고문 없음.hwp', bytes: 1 },
                        { name: '진짜.hwp', path: 'data/kosaf-files/A/진짜.hwp', bytes: 2 }] } },
    { code: 'B', org: '나재단', name: '장학생', goods: '장학금', due: '2026-12-01',
      detail: { 신청기간: '~12/1' },
      mirror: { files: [{ name: '공고.hwp', path: 'data/kosaf-files/B/공고.hwp', bytes: 3 }] } },
  ] };
  /* 🔴 장부가 비면 **예전과 글자 하나까지 같아야** 한다 — 아니면 이 장치가 기존 동작을 바꾼 것이다 */
  eq('장부가 비면 예전과 똑같다',
    JSON.stringify(slimKosaf(data, today)) === JSON.stringify(slimKosaf(data, today, { hidden: [], keep: [] })), true);
  /* 🔴 첨부 하나를 내려도 **재단은 남는다** — 재단째 내리면 멀쩡히 모집 중인 장학금이 사라진다 */
  const one = slimKosaf(data, today, { hidden: [{ code: 'A', file: '공고문 없음.hwp' }] });
  eq('내린 첨부만 빠진다', one.items.find((i) => i.code === 'A').files.map((f) => f.name), ['진짜.hwp']);
  eq('  재단은 그대로 남는다', one.count, 2);
  /* 재단의 마지막 첨부를 내리면 files 키 자체가 안 생긴다 → 앱이 '선발 공고문' 머리말을 안 그린다 */
  const gone = slimKosaf(data, today, { hidden: [{ code: 'B', file: '공고.hwp' }] });
  eq('마지막 첨부를 내리면 files 키가 안 생긴다', 'files' in gone.items.find((i) => i.code === 'B'), false);
  eq('  그래도 재단은 목록에 있다', gone.items.some((i) => i.code === 'B'), true);
  /* 🔴 사람이 '자동 판정이 틀렸다'고 적은 것(keep)이 이긴다 */
  const kept = slimKosaf(data, today, {
    hidden: [{ code: 'A', file: '공고문 없음.hwp' }], keep: [{ code: 'A', file: '공고문 없음.hwp' }] });
  eq('되살린 것이 내린 것을 이긴다', kept.items.find((i) => i.code === 'A').files.length, 2);
  /* 파일 이름 없이 적으면 재단째 내린다(앞으로 쓸 자리) */
  eq('파일 이름이 없으면 재단째 내린다', slimKosaf(data, today, { hidden: [{ code: 'B' }] }).count, 1);
  /* 열쇠는 코드 + 파일 이름 둘이다 — 코드만 보면 같은 재단의 다른 첨부까지 내려간다 */
  eq('열쇠는 코드와 파일 이름 둘', blockKey('A', '진짜.hwp') === blockKey('A', '공고문 없음.hwp'), false);
}

console.log('\n■ 층2 제외 장치가 배선돼 있다 (장부를 아무도 안 읽으면 장치가 없는 것이다)');
/* 🔴 위 두 절은 **함수가 제대로 판정하는가**를 본다. 그런데 그 함수를 아무도 부르지 않으면
   판정이 아무리 옳아도 빈 껍데기가 그대로 학생에게 나간다 — 그 경우 위 두 절은 **전부 초록**이다.
   그래서 여기서는 「누가 부르는가」를 본다. 되돌아가는 길이 실제로 셋 있다:
     ⓐ 앱 파일을 만드는 쪽(kosaf-fetch·kosaf-attach)이 장부를 안 넘긴다 → 내린 첨부가 되살아난다
     ⓑ 저장 직전 관문(kosaf-check)에서 그 절이 사라진다 → 다음 회차가 조용히 나간다
     ⓒ 장부 파일이 사라지거나 로봇과 다른 모양으로 저장된다 → 로봇 커밋과 파일 전체가 충돌한다 */
{
  const ROOT_K = fileURLToPath(new URL('..', import.meta.url));
  const src = (f) => readText(path.join(ROOT_K, f));
  /* ⚠️ 주석은 '부르는 자리'가 아니다 — 걷고 본다 (아래 ⓑ 주석 참조) */
  const noComment = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
  /* ⓐ 앱 파일을 만드는 두 자리가 장부를 넘긴다 — 넘기지 않으면 slimKosaf 이 전부 통과시킨다 */
  for (const f of ['collector/kosaf-fetch.mjs', 'collector/kosaf-attach.mjs']) {
    eq(`  ${f} 가 장부를 읽어 넘긴다`, /slimKosaf\([^)]*loadBlock\(\)/.test(noComment(src(f))), true);
  }
  /* ⓑ 저장 직전 관문이 그 절을 갖고 있다.
     ⚠️ **주석까지 세지 말 것** — 이 파일 머리말에 `판정은 emptyVerdict 한 곳에 있다` 라고
        적혀 있어서, 부르는 자리를 통째로 들어내도 그 한 줄 때문에 초록불이었다(실측).
        그래서 주석을 걷고 **부르는 모양**(`emptyVerdict(`)으로 본다. */
  const check = noComment(src('collector/kosaf-check.mjs'));
  eq('  저장 직전 관문이 빈 공고문을 본다',
    /emptyVerdict\s*\(/.test(check) && /loadBlock\s*\(/.test(check), true);
  eq('    사람이 되살린 것(keep)은 빼고 센다 (되살리기가 수확을 막으면 안 된다)',
    /\bkeep\b/.test(check), true);
  /* ⓒ 장부 파일 — 있고, 모양이 로봇과 같고, 줄마다 사유·날짜·주체가 있다.
     🔴 들여쓰기 1칸은 취향이 아니다 — 자동 병합에서 뺀 파일과 같은 계열이라, 다르게 저장하면
        로봇 커밋과 파일 전체가 충돌한다. */
  const bp = path.join(ROOT_K, 'collector/kosaf-block.json');
  eq('  내려 둔 공고문 장부가 있다', fs.existsSync(bp), true);
  if (fs.existsSync(bp)) {
    const raw = readText(bp);
    const b = JSON.parse(raw);
    eq('    들여쓰기 1칸으로 저장돼 있다 (로봇과 같은 모양)', raw === `${JSON.stringify(b, null, 1)}\n`, true);
    eq('    내림·되살림 두 칸이 있다', Array.isArray(b.hidden) && Array.isArray(b.keep), true);
    eq('    로봇이 실제로 내린 것이 있다 (빈 장부를 상대로 통과하지 않는다)', b.hidden.length > 0, true);
    eq('    줄마다 코드·사유·날짜·주체가 있다',
      b.hidden.concat(b.keep).filter((x) => !(x.code && x.why && x.at && x.by)), []);
    /* 같은 첨부가 양쪽에 있으면 사람이 장부를 읽고 결과를 못 맞힌다 */
    const keys = new Set(b.keep.map((x) => blockKey(x.code, x.file)));
    eq('    같은 첨부가 내림·되살림에 동시에 있지 않다',
      b.hidden.filter((x) => keys.has(blockKey(x.code, x.file))), []);
  }
  /* 판정의 원본은 한 곳 — 베끼면 로봇과 관문이 다른 말을 한다 */
  eq('  판정을 베낀 곳이 없다 (원본은 kosaf-empty.mjs 하나)',
    ['collector/kosaf-fetch.mjs', 'collector/kosaf-attach.mjs', 'collector/kosaf-check.mjs',
      'collector/kosaf-open.mjs']
      .filter((f) => /function\s+emptyVerdict\b/.test(noComment(src(f)))), []);
  eq('  못 읽은 첨부는 숨기지 않는다 (스캔 PDF·포스터를 통째로 잃지 않게)',
    emptyVerdict({ name: '선발공고문.pdf', chars: null }).empty, false);
  eq('  MIN_BODY_CHARS 가 남아 있다 (문턱이 사라지면 전부 통과한다)',
    typeof MIN_BODY_CHARS === 'number' && MIN_BODY_CHARS > 0, true);
}

console.log('\n■ 층2 — 앱 파일을 「열어 본 뒤」에 만든다 (워크플로 순서)');
{
  const yml = readText(new URL('../.github/workflows/kosaf-fetch.yml', import.meta.url));
  /* 🔴 **이 순서가 이 장치의 전부다.** 글자 뽑기보다 앞에서 앱 파일을 만들면 사본이 처음
     내려온 회차에 .txt 가 아직 없어 아무것도 안 걸러지고, 빈 껍데기가 한 회차 그대로 나간다.
     관문보다 뒤면 관문이 옛 파일을 본다. */
  const textStep = yml.indexOf('- name: 공고문에서 글자 뽑기');
  const rebuild = yml.indexOf('- name: 앱 파일 다시 만들기');
  const gate = yml.indexOf('- name: 관문 — 층2가 비거나');
  eq('앱 파일 다시 만들기 단계가 있다', rebuild > 0, true);
  eq('  글자 뽑기보다 뒤에 있다', textStep > 0 && rebuild > textStep, true);
  eq('  관문보다 앞에 있다', gate > 0 && rebuild < gate, true);
  eq('  그 단계가 kosaf-open.mjs --write 를 부른다',
    /앱 파일 다시 만들기[\s\S]{0,200}node collector\/kosaf-open\.mjs --write/.test(yml), true);
  /* 🔴 저장 목록에 없으면 매 실행 장부가 버려진다 — 사람이 내린 것이 되살아난다(이슈 #79 유형) */
  eq('저장 목록에 내려 둔 공고문 장부가 있다', /git add collector\/kosaf-block\.json/.test(yml), true);
  /* 로봇이 쓰는 파일은 전부 저장 목록에 있어야 한다 */
  for (const f of ['data/kosaf.json', 'data/kosaf-open.json', 'data/kosaf-files'])
    eq(`  저장 목록에 ${f}`, yml.includes(`git add ${f}`) || yml.includes(`git add -A ${f}`), true);
}


/* ══════════════════════════════════════════════════════════════════
   관리자 화면 — 「무엇이 바뀌는가」·「무엇을 부를 수 있는가」 (2026-09-14)
   ══════════════════════════════════════════════════════════════════ */

/* 워크플로 yml 의 수동 실행(workflow_dispatch) 부분만 떼어 낸다.
   🔴 yaml 라이브러리를 새로 끌어오지 않는다 — 이 검사는 의존성 0으로 도는 것이 값이다. */
function dispatchSpec(yml) {
  const lines = yml.split('\n');
  /* ⚠️ 꼬리 주석(`workflow_dispatch:   # 수동 실행 버튼`)을 놓치면 멀쩡한 로봇을
     '수동 실행이 안 된다'고 부른다 — 실제로 update-progress.yml 이 그 꼴이다. */
  const start = lines.findIndex((l) => /^\s{0,2}workflow_dispatch:\s*(#.*)?$/.test(l));
  if (start < 0) return null;
  const base = lines[start].match(/^\s*/)[0].length;
  const body = [];
  for (let i = start + 1; i < lines.length; i++) {
    const l = lines[i];
    if (!l.trim() || /^\s*#/.test(l)) { body.push(l); continue; }
    if (l.match(/^\s*/)[0].length <= base) break;
    body.push(l);
  }
  const scalar = (rawText) => {
    const t = String(rawText).trim();
    const q = t.match(/^'((?:[^']|'')*)'/) || t.match(/^"((?:[^"\\]|\\.)*)"/);
    if (q) return q[1].replace(/''/g, "'");
    return t.replace(/\s+#.*$/, '').trim();
  };
  const inputs = {};
  const iAt = body.findIndex((l) => /^\s*inputs:\s*$/.test(l));
  if (iAt >= 0) {
    const ind = body[iAt].match(/^\s*/)[0].length;
    let cur = null;
    for (let i = iAt + 1; i < body.length; i++) {
      const l = body[i];
      if (!l.trim() || /^\s*#/.test(l)) continue;
      const at = l.match(/^\s*/)[0].length;
      if (at <= ind) break;
      const nameHit = l.match(/^\s*([A-Za-z_][\w-]*):\s*$/);
      if (nameHit && at === ind + 2) { cur = nameHit[1]; inputs[cur] = { options: [] }; continue; }
      if (!cur) continue;
      const kv = l.match(/^\s*(type|default|required):\s*(.+)$/);
      if (kv) { inputs[cur][kv[1]] = scalar(kv[2]); continue; }
      if (/^\s*-\s+/.test(l)) inputs[cur].options.push(scalar(l.replace(/^\s*-\s+/, '')));
    }
  }
  return { inputs };
}

/* admin.js 안의 배열 리터럴을 그대로 평가한다 — 설명이 함수(`() => …D.schools…`)라도
   **부르지 않으므로** 안전하다. 정규식으로 칸을 긁으면 곧 어긋난다. */
function arrayFromSource(src, name) {
  const at = src.indexOf(`const ${name} = [`);
  if (at < 0) return null;
  const end = src.indexOf('\n];\n', at);
  if (end < 0) return null;
  const lit = src.slice(src.indexOf('[', at), end + 2);
  // eslint-disable-next-line no-new-func
  return new Function('D', `return ${lit};`)({ schools: [], targets: [] });
}

console.log('\n■ 관리자 수정 규칙이 한 벌인가 (화면 미리보기 ↔ 저장소)');
{
  const adminJs = readText(new URL('../_admin/admin.js', import.meta.url));
  const applyJs = readText(new URL('../tools/admin-apply.mjs', import.meta.url));
  const diffJs = readText(new URL('../tools/edit-diff.mjs', import.meta.url));

  /* ① 화면이 규칙을 **스스로 정의하지 않는다** — 가져다 쓸 뿐이다 */
  eq('화면이 EDIT_LABEL 을 스스로 정의하지 않는다', /(const|let|var)\s+EDIT_LABEL\s*=/.test(adminJs), false);
  eq('화면이 diffPatch 를 스스로 정의하지 않는다', /function\s+diffPatch\b/.test(adminJs), false);
  eq('화면이 공용 파일에서 가져온다', /from\s+'\.\/vendor\/edit-diff\.mjs'/.test(adminJs), true);
  eq('build.sh 가 그 파일을 vendor 로 옮긴다',
    /cp\s+tools\/edit-diff\.mjs\s+"\$OUT\/vendor\/edit-diff\.mjs"/.test(
      readText(new URL('../_admin/build.sh', import.meta.url))), true);

  /* ② 고칠 수 있는 칸 목록이 저장소와 같은가 — 한쪽에만 칸을 더하면 화면이 보낸 값이
     **조용히 버려지거나**(ALLOWED 밖) 미리보기에 안 뜬다. */
  const allowedOf = (src) => {
    const at = src.indexOf('ALLOWED = new Set([');
    const end = src.indexOf(']);', at);
    return [...src.slice(at, end).matchAll(/'([a-zA-Z]+)'/g)].map((m) => m[1]).sort();
  };
  /* ⚠️ 이 파일에는 이름표 표가 둘 있다(EDIT_LABEL·ELIG_LABEL) — 블록을 잘라 내지 않으면
     자격 칸 이름까지 섞여 들어와 늘 빨간불이다(만들면서 실제로 그랬다). */
  const labelBlock = diffJs.slice(diffJs.indexOf('EDIT_LABEL = {'), diffJs.indexOf('\n};', diffJs.indexOf('EDIT_LABEL = {')));
  const labelKeys = [...labelBlock.matchAll(/^  ([a-zA-Z]+):\s*'/gm)].map((m) => m[1]);
  eq('고칠 수 있는 칸 목록이 저장소와 같다', allowedOf(applyJs), [...new Set(labelKeys)].sort());
  const eligKeysOf = (src) => {
    const at = src.indexOf('ELIG_KEYS = {');
    const end = src.indexOf('};', at);
    return [...src.slice(at, end).matchAll(/^\s{2}([a-zA-Z]+):/gm)].map((m) => m[1]).sort();
  };
  eq('기계 판정용 자격 칸 목록도 같다', eligKeysOf(applyJs), eligKeysOf(diffJs));

  /* ③ 🔴 **진짜 대조** — 같은 patch 를 넣어 저장소를 실제로 돌리고, 화면이 예고한
     '바뀌는 칸'과 '바뀐 뒤 값'이 그대로인지 본다. 칸 이름만 대면 안 된다:
     `'0'` 과 `0` 은 칸 이름이 같아도 값이 다르다(되돌림 실험으로 확인했다). */
  const base = {
    id: 'x1', name: '테스트 장학금', type: '교외', provider: '테스트재단',
    amount: '100만원', amountValue: 1000000, summary: '요약', sourceUrl: 'https://example.com/a',
    eligibility: { schoolOnly: '경희대학교', years: [1, 2] }, documents: ['재학증명서'],
    deadline: '2026-12-01', noForm: '양식 없음',
  };
  const CASES = [
    ['years 문자열이 같은 배열로 풀리면 안 바뀐 것이다', { eligibility: { schoolOnly: '경희대학교', years: '1,2' } }],
    ['years 가 실제로 달라지면 바뀐 것이다', { eligibility: { schoolOnly: '경희대학교', years: '1,2,3' } }],
    ['빈 문자열은 칸을 지운다', { note: '' }],
    ["amountValue 는 숫자로 들어간다 ('0')", { amountValue: '0' }],
    ['학교 한정만 빼기 (C2)', { eligibility: { years: [1, 2] } }],
    ['같은 값이면 아무것도 안 바뀐다', { name: '테스트 장학금' }],
    ['마감일', { deadline: '2026-11-30' }],
    ['자격 문장', { eligibilityLines: '재학생\n성적 3.0 이상' }],
  ];
  const script = fileURLToPath(new URL('../tools/admin-apply.mjs', import.meta.url));
  for (const [label, patch] of CASES) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'admdiff-'));
    fs.mkdirSync(path.join(dir, 'data'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'data/registered.json'),
      `${JSON.stringify({ items: [JSON.parse(JSON.stringify(base))] }, null, 1)}\n`);
    fs.writeFileSync(path.join(dir, 'data/forms.json'), JSON.stringify({ forms: {} }));
    const r = spawnSync(process.execPath, [script], {
      cwd: dir, encoding: 'utf8',
      env: { ...process.env, ACTION: 'edit', ACTOR: 'gate', PAYLOAD: JSON.stringify({ edits: [{ id: 'x1', patch }] }) },
    });
    const out = `${r.stdout || ''}${r.stderr || ''}`;
    const m = out.match(/x1 — ([^\n]*)/);
    const repoKeys = (r.status === 0 && m) ? m[1].split(',').map((x) => x.trim()).sort() : [];
    const rows = diffPatch(base, patch);
    eq(`  ${label}`, rows.map((d) => d.key).sort(), repoKeys);
    if (r.status === 0) {
      const after = JSON.parse(readText(path.join(dir, 'data/registered.json'))).items[0];
      const wrong = rows.filter((d) => JSON.stringify(after[d.key]) !== JSON.stringify(d.after))
        .map((d) => `${d.key}: 저장소 ${JSON.stringify(after[d.key])} / 화면 ${JSON.stringify(d.after)}`);
      eq('    바뀐 뒤 값까지 같다', wrong, []);
    }
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

console.log('\n■ 경고를 고치는 로봇은 실재하고, 부르는 모양이 있다');
{
  const { checkEntry, FIX_PLAN } = createRequire(import.meta.url)('./entry-rules.cjs');
  const wfDir = fileURLToPath(new URL('../.github/workflows/', import.meta.url));
  /* 규칙이 내주는 `fix` 를 전부 모은다 — 픽스처로 모든 가지를 한 번씩 켠다 */
  const fixes = new Set();
  const probes = [
    {}, { sourceUrl: 'https://x.kr/list.do?bbs=1' }, { sourceUrl: 'https://x.kr/a#n-제목' },
    { eligibilityLines: ['재학생'], formId: 'a' },
  ];
  probes.forEach((p) => (checkEntry(p) || []).forEach((x) => { if (x.fix) fixes.add(x.fix); }));
  /* 🔴 **개수가 아니라 이름으로 못 박는다** (2026-09-14). `>= 3` 만 보던 판은 하나를 떼고
     다른 하나를 더하면 그대로 통과했다 — 그러면 화면의 '고치기' 버튼이 조용히 사라진다
     (경고는 그대로 뜨는데 고칠 길만 없어지므로 아무도 못 알아챈다).
     새 원인에 `fix` 를 붙이는 것은 환영이다 — 그때 이 목록에 이름을 더하면 된다. */
  eq('경고를 고치는 로봇 이름이 그대로다', [...fixes].sort(),
    ['deep-fetch.yml', 'eligibility-fill.yml', 'resolve-detail-urls.yml']);
  eq('  fix 를 붙인 원인이 있다 (헛도는 검사가 아니다)', fixes.size >= 3, true);
  for (const f of fixes) {
    const file = path.join(wfDir, f);
    eq(`  ${f} 가 실재한다`, fs.existsSync(file), true);
    if (!fs.existsSync(file)) continue;
    const spec = dispatchSpec(readText(file));
    eq(`  ${f} 를 손으로 부를 수 있다`, !!spec, true);
    /* 🔴 **기본값이 위험한 로봇은 화면이 값을 보내야 한다.** eligibility-fill 의 mode 기본값은
       '전부'(전수 약 2,229원)이고 deep-fetch 의 form_targets 기본값은 엉뚱한 공고('조병두')다.
       입력이 있는데 FIX_PLAN 이 없으면 버튼 한 번이 그 기본값을 그대로 돌린다. */
    /* 🔴 **화면이 뜻을 정해 보내야 하는 입력**만 따진다 —
       고르는 상자 · 필수 · '빈칸이 아닌 기본값'(deep-fetch 의 '조병두', eligibility-fill 의 '전부').
       기본값이 false·빈칸인 boolean(resolve-detail-urls 의 dry)은 그냥 눌러도 안전하다. */
    const names = Object.keys((spec && spec.inputs) || {}).filter((k) => {
      const d = spec.inputs[k];
      return d.type === 'choice' || String(d.required) === 'true'
        || (d.type === 'string' && d.default && d.default !== "''" && d.default !== '');
    });
    if (names.length) {
      const plan = FIX_PLAN[f];
      eq(`  ${f} 에 부르는 모양(FIX_PLAN)이 있다`, !!(plan && plan.main), true);
      const sends = { ...((plan && plan.main && plan.main.inputs) || {}) };
      if (plan && plan.main && plan.main.arg) sends[plan.main.arg] = '(화면이 채운다)';
      eq(`  ${f} 가 첫 입력 '${names[0]}' 을 빈칸으로 두지 않는다`, names[0] in sends, true);
    }
  }
  /* FIX_PLAN 이 보내는 고르는 값은 yml 의 선택지와 한 글자도 달라선 안 된다 */
  Object.keys(FIX_PLAN).forEach((f) => {
    const spec = dispatchSpec(readText(path.join(wfDir, f)));
    ['main', 'all'].forEach((which) => {
      const p = FIX_PLAN[f][which];
      Object.keys((p && p.inputs) || {}).forEach((k) => {
        const decl = (spec.inputs || {})[k];
        eq(`  ${f} ${which}.${k} 가 워크플로의 선택지 안에 있다`,
          !decl || decl.type !== 'choice' || decl.options.includes(p.inputs[k]), true);
      });
    });
  });
}

console.log('\n■ 관리자 화면 로봇 목록 — 화면이 부를 수 있는 것이 전부다');
{
  const adminJs = readText(new URL('../_admin/admin.js', import.meta.url));
  const wfDir = fileURLToPath(new URL('../.github/workflows/', import.meta.url));
  const robots = arrayFromSource(adminJs, 'ROBOTS');
  eq('ROBOTS 목록을 읽어 냈다 (못 읽으면 아래가 헛돈다)', Array.isArray(robots) && robots.length > 20, true);
  /* 🔴 **여기서 빠지면 그 로봇은 사람이 손으로 못 부른다** — 예약만 남으므로 층2처럼
     '다음 월·목까지 기다린다'가 된다. 목록이 27종이라 하나가 빠져도 길이로는 안 보인다.
     아래 다섯은 화면에서 부를 일이 실제로 있는 것들이라 이름으로 못 박는다.
     ⚠️ 새 로봇을 더하는 것은 막지 않는다 — 이 다섯이 **빠지는 것**만 막는다. */
  for (const f of ['kosaf-fetch.yml', 'collect-scholarships.yml', 'browser-collect.yml',
    'deep-fetch.yml', 'eligibility-fill.yml']) {
    eq(`  ${f} 가 화면 목록에 있다`, robots.some((r) => r.f === f), true);
  }

  const specs = new Map();
  robots.forEach((r) => {
    const file = path.join(wfDir, r.f);
    eq(`  ${r.f} 가 실재한다`, fs.existsSync(file), true);
    if (!fs.existsSync(file)) return;
    const spec = dispatchSpec(readText(file));
    specs.set(r.f, spec);
    eq(`  ${r.f} 를 손으로 부를 수 있다`, !!spec, true);
    if (!spec) return;
    (r.inputs || []).forEach((i) => {
      const decl = spec.inputs[i.name];
      eq(`  ${r.f} 의 입력 '${i.name}' 이 워크플로에 있다`, !!decl, true);
      if (!decl) return;
      if (i.kind === 'choice') {
        eq(`  ${r.f} '${i.name}' 의 선택지가 워크플로와 한 글자도 다르지 않다`, i.options, decl.options);
        eq(`  ${r.f} '${i.name}' 의 미리 고른 값이 선택지 안에 있다`, decl.options.includes(i.def), true);
      }
    });
    /* 🔴 필수 입력을 화면이 모르면 GitHub 이 422 로 거부한다 — 눌러 봐야만 보이는 실패다 */
    Object.keys(spec.inputs).filter((k) => String(spec.inputs[k].required) === 'true').forEach((k) => {
      eq(`  ${r.f} 의 필수 입력 '${k}' 을 화면이 선언했다`,
        (r.inputs || []).some((i) => i.name === k), true);
    });
  });

  /* 🔴 일부러 안 넣은 둘 — 되돌리지 말 것 */
  const notListed = [...((adminJs.match(/const ROBOT_NOT_LISTED = \[([^\]]*)\]/) || [])[1] || '')
    .matchAll(/'([^']+)'/g)].map((m) => m[1]);
  eq("'이 기기에서 배포' 는 목록에 없다 (수동 실행에서는 아무것도 배포하지 않는다)",
    robots.some((r) => r.f === 'device-deploy.yml'), false);
  eq('일회용 로봇도 목록에 없다', robots.some((r) => r.f === 'two-school-scan.yml'), false);
  eq('  그 둘을 화면이 정직하게 밝힌다',
    notListed.includes('device-deploy.yml') && notListed.includes('two-school-scan.yml'), true);

  /* ⑥ 화면이 **아예 못 부르는** 워크플로를 센다 — 새 로봇이 생기면 여기서 말해 준다.
     인스타·관리자 조정은 ROBOTS 에 없지만 화면이 다른 자리에서 부른다(파일 이름이 admin.js 에 있다). */
  const all = fs.readdirSync(wfDir).filter((f) => f.endsWith('.yml'))
    .filter((f) => dispatchSpec(readText(path.join(wfDir, f))));
  /* 🔴 '일부러 안 넣었다'고 적어 둔 줄은 **부르는 자리가 아니다** — 빼고 센다.
     안 빼면 그 줄 때문에 못 부르는 워크플로가 0개로 보여 이 검사가 통째로 무력해진다. */
  const calls = adminJs
    .replace(/\/\*[\s\S]*?\*\//g, '')            // 주석은 부르는 자리가 아니다
    .split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n')
    .replace(/const ROBOT_NOT_LISTED = \[[^\]]*\]/, '');
  const unreachable = all.filter((f) => !calls.includes(f));
  eq(`화면이 못 부르는 워크플로 (지금 ${unreachable.length}개: ${unreachable.join(' · ')})`,
    unreachable.sort(), ['device-deploy.yml', 'two-school-scan.yml']);
}

console.log('\n■ 안내문이 사람을 화면으로 부른다 (채팅으로 되돌아가면 실패)');
/* 🔴 2026-09-14 — 로봇이 넘어지거나 컨펌을 기다릴 때 안내문이 "다음 세션에 이렇게 말하세요"
   라고만 적고 있었다. 그런데 그 일들은 **관리자 화면에 이미 버튼이 있다**(작업대 · 로봇 ·
   인스타). 그래서 안내문을 화면 주소로 바꿨다.
   되돌아가는 길은 셋이다 — ⓐ 문장이 다시 채팅으로 돌아간다 ⓑ 링크가 **없는 화면 이름**을
   가리킨다(화면은 조용히 첫 화면으로 보낸다 — 아무도 깨진 줄 모른다) ⓒ 「」 안의 로봇
   이름이 화면의 이름과 어긋난다(사람이 그 이름을 화면에서 못 찾는다). 셋 다 여기서 막는다. */
{
  const adminJs = readText(new URL('../_admin/admin.js', import.meta.url));
  const ROOT_DIR = fileURLToPath(new URL('..', import.meta.url));
  const SCREENS = JSON.parse((adminJs.match(/const SCREENS = (\[[^\]]*\])/) || [])[1].replace(/'/g, '"'));
  const robotNames = (arrayFromSource(adminJs, 'ROBOTS') || []).map((r) => r.n);

  /* 사람에게 뜨는 안내문이 사는 곳 — 워크플로 · 공용 액션 · 수집 로봇 · 인스타 */
  const files = [];
  const walk = (rel) => {
    for (const e of fs.readdirSync(path.join(ROOT_DIR, rel), { withFileTypes: true })) {
      const next = `${rel}/${e.name}`;
      /* extracted·pub·node_modules 는 **로봇이 받아 온 남의 글**이라 안내문이 아니다 */
      if (e.isDirectory()) { if (!['extracted', 'node_modules', 'pub', 'kosaf-files'].includes(e.name)) walk(next); }
      else if (/\.(yml|yaml|mjs|js|json|md|txt)$/.test(e.name)) files.push(next);
    }
  };
  ['.github/workflows', '.github/actions', 'collector', 'insta'].forEach(walk);
  const read = (f) => readText(path.join(ROOT_DIR, f));
  eq('안내문이 사는 파일을 실제로 훑었다 (빈 목록을 상대로 통과하지 않는다)', files.length > 40, true);

  /* ① 링크가 가리키는 화면 이름이 실재하는가.
     🔴 admin.js 의 show()·screenFromHash() 는 모르는 이름을 **오류 없이** 기본 화면으로
        보낸다 — 그래서 오타 난 링크는 눌러도 아무 표시가 없다. 여기서만 잡힌다. */
  let linked = 0;
  for (const f of files) {
    for (const [, name] of read(f).matchAll(/hanggonggan-admin\.pages\.dev\/?#([A-Za-z-]+)/g)) {
      linked += 1;
      eq(`  ${f}: #${name} 은 실재하는 화면이다 (SCREENS=${SCREENS.join(',')})`, SCREENS.includes(name), true);
    }
  }
  eq('  화면으로 부르는 링크가 하나라도 있다', linked > 0, true);

  /* ② 정식 등록 컨펌 — 채팅이 아니라 작업대로 부른다 (양식·자격은 여전히 채팅이다) */
  const collect = read('collector/collect.mjs');
  const confirmLine = collect.split('\n').find((l) => l.includes('등록하는 곳'));
  eq('수집 리포트의 컨펌 안내가 작업대(#review)를 가리킨다',
    !!confirmLine && confirmLine.includes('hanggonggan-admin.pages.dev/#review'), true);
  /* ⚠️ 전부 화면으로 보내면 거짓말이 된다 — 양식 스키마화·자격 판정은 화면에 버튼이 없다 */
  eq('  화면에 버튼이 없는 일(양식·자격)은 채팅이라고 함께 적는다',
    /양식|자격/.test(collect.split('\n').filter((l) => l.trimStart().startsWith("'> ")).join('')), true);

  /* ③ '지금 실행' 을 시키는 줄은 화면에 **실제로 있는 로봇 이름**을 댄다 */
  eq('  화면의 로봇 이름을 읽어 냈다', robotNames.length > 20, true);
  let called = 0;
  for (const f of files) {
    for (const line of read(f).split('\n')) {
      if (!line.includes('#robots') || !line.includes('지금 실행')) continue;
      called += 1;
      const quoted = [...line.matchAll(/「([^」]+)」/g)].map((m) => m[1]);
      eq(`  ${f}: 어느 로봇인지 「」 로 댄다`, quoted.length > 0, true);
      quoted.forEach((n) => eq(`  ${f}: 「${n}」 은 화면에 있는 로봇 이름이다`, robotNames.includes(n), true));
    }
  }
  eq('  로봇 화면으로 부르는 안내문이 하나라도 있다', called > 0, true);
  /* 🔴 **어느 파일이 부르는지까지 못 박는다.** 개수만 세면 하나가 채팅으로 되돌아가도
     나머지 셋이 남아 그대로 통과한다 — 되돌아간 그 로봇만 조용히 옛길로 돌아간다.
     아래 넷은 넘어졌을 때 **다시 돌리는 것이 해법**이고 화면에 버튼이 있다.
     ⚠️ 여기 없는 워크플로(push-health·robot-heartbeat·search-index·verify-ui)는
        아직 화면 목록에 없어서 일부러 안 넣었다 — 넣으면 없는 버튼을 누르라고 하는 것이다. */
  const callers = files.filter((f) => read(f).split('\n')
    .some((l) => l.includes('#robots') && l.includes('지금 실행'))).sort();
  eq('  로봇 화면으로 부르는 안내문이 있어야 할 곳에 그대로 있다', callers, [
    '.github/workflows/browser-collect.yml', '.github/workflows/collect-scholarships.yml',
    '.github/workflows/deploy-sync.yml', '.github/workflows/main-guard.yml',
  ]);

  /* ④ 🔴 **다시 돌려도 안 풀리는 사유를 화면으로 보내지 않는다.**
     되가져오기가 실패하는 사유는 셋인데 재실행이 해법인 것은 pushfail 하나뿐이다.
     conflict(내용이 부딪힘)·auditfail(데이터 관문 불통)은 사람이 파일을 고쳐야 하므로,
     거기에 '화면에서 다시 실행' 을 적으면 사람이 버튼만 되풀이 누르게 된다. */
  for (const f of ['.github/workflows/main-guard.yml', '.github/workflows/deploy-sync.yml',
    '.github/workflows/device-deploy.yml']) {
    for (const line of read(f).split('\n')) {
      if (!/^\s*(conflict|auditfail)\)/.test(line)) continue;
      eq(`  ${f}: ${line.trim().split(')')[0]} 가지는 화면으로 부르지 않는다`,
        line.includes('hanggonggan-admin'), false);
    }
  }

  /* ⑤ 톱니 — 관리자 주소가 박힌 파일 수. 늘어나면 '한 곳으로 모을 때인가'를 사람이 본다
     (앱 주소가 8군데에 박혀 있다 하나를 놓쳐 메일 접수가 조용히 막힌 전례가 있다). */
  const PINNED = [
    '.github/workflows/admin-lock-check.yml', '.github/workflows/browser-collect.yml',
    '.github/workflows/collect-scholarships.yml', '.github/workflows/deploy-sync.yml',
    '.github/workflows/insta.yml', '.github/workflows/main-guard.yml',
    'collector/collect.mjs', 'collector/report.md', 'insta/mail.mjs',
  ].sort();
  const found = files.filter((f) => read(f).includes('hanggonggan-admin.pages.dev')).sort();
  eq(`관리자 주소가 박힌 파일은 ${PINNED.length}개 그대로다`, found, PINNED);

  /* ⑥ 인스타 — 안내문이 대는 버튼 글자가 화면에 그대로 있는가 */
  const insta = read('.github/workflows/insta.yml');
  eq('인스타 안내문이 화면 버튼 글자를 그대로 인용한다', insta.includes('「이 판형으로 다시 그리기」'), true);
  eq('  그 글자가 admin.js 버튼에 그대로 있다', adminJs.includes('이 판형으로 다시 그리기'), true);
}

console.log('\n■ 관리자 쓰기 — 되돌릴 수 없는 일 앞의 안전장치 (저장소를 실제로 돌려 본다)');
/* 🔴 이 절은 **글자를 훑지 않는다** — `tools/admin-apply.mjs` 를 진짜 자식 프로세스로 돌려
   파일이 어떻게 바뀌었는지 본다. 함수 이름만 찾는 검사는 그 함수를 부르지 않게 바꾸는
   순간 조용히 통과한다(실제로 그렇게 무력해진 관문이 이 저장소에 있었다).

   왜 여기서만 막을 수 있나 — 감사(`verify/audit-data.js`)는 **남은 것**만 본다.
   사본 저장소에서 items 를 48 → 0 으로 비워도 감사는 종료코드 0이었다(실측).
   그리고 감사를 고쳐 막으면 수집 워크플로가 그 감사를 관문으로 쓰므로, 로봇이 차단 목록을
   반영해 지우는 **정상 삭제까지** 걸려 그날 수집분 저장이 통째로 멈춘다. */
{
  const script = fileURLToPath(new URL('../tools/admin-apply.mjs', import.meta.url));
  /* 공고 N건짜리 사본 저장소를 만들고 한 가지 일을 시킨다 */
  const run = (action, payload, n = 20, tweak = null) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'admwrite-'));
    fs.mkdirSync(path.join(dir, 'data'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'collector'), { recursive: true });
    const items = Array.from({ length: n }, (_, i) => ({
      id: `reg-t${i}`, name: `테스트 장학금 ${i}`, type: '교외', provider: '테스트재단',
      amount: '금액 원문 확인', amountValue: 0, summary: '요약',
      sourceUrl: `https://example.ac.kr/view.do?seq=${100 + i}`,
      eligibility: { selective: true }, documents: ['재학증명서'],
      deadline: '2026-12-01', noForm: '양식 없음', auto: true, listedAt: '2026-09-01',
    }));
    if (tweak) items.forEach(tweak);
    fs.writeFileSync(path.join(dir, 'data/registered.json'), `${JSON.stringify({ items }, null, 1)}\n`);
    fs.writeFileSync(path.join(dir, 'data/forms.json'), JSON.stringify({ forms: {}, templates: {} }));
    fs.writeFileSync(path.join(dir, 'collector/auto-register-config.json'),
      `${JSON.stringify({ enabled: true, blockIds: [], blockUrls: [] }, null, 1)}\n`);
    const r = spawnSync(process.execPath, [script], {
      cwd: dir, encoding: 'utf8',
      env: { ...process.env, ACTION: action, ACTOR: 'gate', PAYLOAD: JSON.stringify(payload) },
    });
    const after = JSON.parse(readText(path.join(dir, 'data/registered.json'))).items;
    const cfg = JSON.parse(readText(path.join(dir, 'collector/auto-register-config.json')));
    const out = `${r.stdout || ''}${r.stderr || ''}`;
    fs.rmSync(dir, { recursive: true, force: true });
    return { status: r.status, out, after, cfg, left: after.length };
  };
  const ids = (a, b) => Array.from({ length: b - a }, (_, i) => `reg-t${a + i}`);
  /* ⑨ 금액을 손으로 채우는 길 — **글자를 훑지 않고 저장소를 실제로 돌려 본다** (2026-09-18).
     🔴 앞서 이 기능의 관문 둘은 `admin-apply.mjs` 의 **소스 글자**를 정규식으로 보고 있었다.
        코드 리뷰가 그 무력함을 실증했다: 실제 조건을 `if (false && …)` 로 죽이고 정규식이
        찾는 문장을 주석에 남겨 두자 관문이 그대로 초록불이었다. 이 절이 그 자리를 메운다.
     🔴 그리고 여기서만 잡히는 진짜 사고가 있었다 — **검수 시트는 `[data-ed]` 칸을 전부
        보내므로 `amount`·`period` 가 늘 patch 에 실린다.** 파생을 '키가 왔나' 로 가르면
        시트 경로에서 한 번도 안 돌고, 금액 쪽은 감사가 오류를 내 `admin-apply.yml` 이
        **그 묶음의 다른 수정까지 통째로 되돌린다.** */
  {
    const sheet = (id, patch) => ({ edits: [{ id, patch }] });
    /* ⓐ 시트처럼 '안 바뀐 문구' 를 함께 보내도 카드 문구가 따라간다 */
    const withLabel = run('edit', sheet('reg-t0', { amount: '금액 원문 확인', amountValue: 3000000 }), 3);
    const w0 = withLabel.after.find((x) => x.id === 'reg-t0');
    eq('시트가 안 바뀐 금액 문구를 같이 보내도 문구가 숫자를 따라간다 (감사가 묶음을 되돌리던 자리)',
      [withLabel.status, w0.amount, w0.amountValue], [0, '300만원', 3000000]);
    eq('  사람 표식이 붙는다 (로봇이 다음 날 안 덮게)', /^관리자 /.test(w0.amountFrom || ''), true);
    /* ⓑ 마감 → 기간 문구도 같은 꼴 (감사가 안 잡아 조용히 나가던 자리) */
    /* ⚠️ 픽스처에 기간 문구를 **미리** 넣는다 — 안 넣으면 시트가 보낸 값이 '안 바뀐 값'이
       아니라 새 값이 되어, 파생을 건너뛰는 것이 맞는 동작이 된다(이 검사를 만들며 겪었다). */
    const dl = run('edit', sheet('reg-t0', { deadline: '2026-12-31', period: '접수 기간 원문 확인' }), 3,
      (it) => { it.period = '접수 기간 원문 확인'; });
    eq('시트가 안 바뀐 기간 문구를 같이 보내도 문구가 마감을 따라간다',
      dl.after.find((x) => x.id === 'reg-t0').period, '접수 기간 ~2026-12-31');
    /* ⓒ 사람이 문구를 **진짜로** 고치면 그쪽이 이긴다 (덮어쓰지 않는다) */
    const own = run('edit', sheet('reg-t0', { amount: '등록금 전액 + 생활비', amountValue: 3000000 }), 3);
    eq('  사람이 문구를 직접 고치면 그대로 둔다', own.after.find((x) => x.id === 'reg-t0').amount, '등록금 전액 + 생활비');
    /* ⓓ 로봇이 읽어 둔 구조가 사람 값과 어긋나면 물러난다 — 합계는 amountSpec 을 먼저 본다 */
    const ratio = run('edit', sheet('reg-t1', { amountValue: 3000000 }), 3,
      (it) => { if (it.id === 'reg-t1') { it.amountSpec = { kind: 'ratio', ratio: 1, value: 0, raw: '등록금 전액' }; it.amountFrom = '공고 원문'; } });
    const r1 = ratio.after.find((x) => x.id === 'reg-t1');
    eq('🔴 사람이 적은 금액과 어긋나는 로봇 구조는 물러난다 (카드와 합계가 다른 말을 하지 않게)',
      [r1.amount, r1.amountValue, r1.amountSpec], ['300만원', 3000000, undefined]);
    /* ⓔ 값이 같으면 구조를 남긴다 — 그 안에 원문 근거(raw)가 있고 감사가 그걸 센다 */
    const same = run('edit', sheet('reg-t1', { amountValue: 2500000 }), 3,
      (it) => { if (it.id === 'reg-t1') { it.amountSpec = { kind: 'fixed', value: 2500000, raw: '금 액 : 250 만 원' }; it.amountFrom = '공고 원문'; it.amount = '250만원'; it.amountValue = 2500000; } });
    eq('  값이 같은 구조는 남긴다 (원문 근거를 버리지 않는다)',
      !!same.after.find((x) => x.id === 'reg-t1').amountSpec, true);
    /* ⓕ 비우기 — 표식이 남고 구조도 함께 지워진다(안 지우면 지운 티가 안 난다) */
    const clear = run('edit', sheet('reg-t2', { amountValue: 0 }), 3,
      (it) => { if (it.id === 'reg-t2') { it.amountValue = 2500000; it.amount = '250만원'; it.amountSpec = { kind: 'fixed', value: 2500000, raw: '250만원' }; it.amountFrom = '공고 원문'; } });
    const c2 = clear.after.find((x) => x.id === 'reg-t2');
    eq('금액을 비우면 · 비움 표식이 남고 로봇 구조도 함께 지워진다',
      [/· 비움$/.test(c2.amountFrom || ''), c2.amountSpec, c2.amount], [true, undefined, '250만원']);
    /* ⓖ 음수는 그 자리에서 막는다 — 합계를 깎는다 */
    const neg = run('edit', sheet('reg-t0', { amountValue: -5000 }), 3);
    eq('음수 금액은 저장소가 멈춘다 (합계를 깎는다)', [neg.status !== 0, neg.after.find((x) => x.id === 'reg-t0').amountValue], [true, 0]);
    /* ⓗ 정식 등록 갈래도 같은 함수를 쓴다 — 여기만 옛 모양으로 남아 있었다 */
    const reg1 = run('register', { notice: { url: 'https://example.ac.kr/view.do?seq=777', title: '새로 등록하는 검사용 장학금' },
      patch: { name: '새로 등록하는 검사용 장학금', amountValue: 3000000, type: '교외', provider: '검사용' } }, 3);
    const added = reg1.after.find((x) => x.name === '새로 등록하는 검사용 장학금');
    eq('정식 등록 갈래도 문구가 숫자를 따라간다 (감사가 그 등록을 되돌리던 자리)',
      [reg1.status, added && added.amount, added && added.amountValue], [0, '300만원', 3000000]);
  }


  /* ① 많이 지우기 — 건수를 숫자로 한 번 더 받지 않으면 **한 건도** 안 지운다 */
  const big = run('remove', { ids: ids(0, 6) });
  eq('여섯 건을 지우려는데 건수를 안 적으면 멈춘다', big.status !== 0, true);
  eq('  그때 파일은 한 글자도 안 바뀐다 (반만 지워지지 않는다)', big.left, 20);
  eq('  사람이 무엇을 해야 하는지 말한다 (지울 건수를 적는다)',
    /한 번에 6건을 지우는 요청/.test(big.out) && /숫자로 한 번 더/.test(big.out), true);
  const wrongN = run('remove', { ids: ids(0, 6), expect: 5 });
  eq('  건수가 틀리면 멈춘다', wrongN.status !== 0 && wrongN.left === 20, true);
  const okN = run('remove', { ids: ids(0, 6), expect: 6 });
  eq('  건수가 맞으면 지운다', okN.status === 0 && okN.left === 14, true);
  /* 🔴 '요청한 id 개수'가 아니라 **실제로 지워질 건수**와 댄다 — 없는 id 가 섞였으면
     사람이 생각한 것과 다른 일이 벌어지는 중이다. */
  const ghost = run('remove', { ids: [...ids(0, 6), 'reg-없는것', 'reg-없는것2'], expect: 8 });
  eq('  없는 id 를 세어 준 건수는 안 받는다', ghost.status !== 0 && ghost.left === 20, true);
  /* 작은 삭제까지 막으면 매번 숫자를 적게 돼 사람이 그 확인을 안 읽게 된다.
     ⚠️ 목록이 50건일 때의 세 건이다 — 20건에서는 15%라 아래 비율 관문에 걸린다(실측). */
  eq('작은 삭제(50건 중 세 건)는 그냥 지운다', run('remove', { ids: ids(0, 3) }, 50).left, 47);
  /* 목록이 작으면 비율로도 걸린다 — 다섯 건 중 두 건은 40%다 */
  eq('목록이 작을 때는 비율로 막는다 (다섯 중 둘)', run('remove', { ids: ids(0, 2) }, 5).status !== 0, true);
  /* 되돌리기(revert)도 같은 관문을 지난다 — 한쪽만 막으면 뚫린 길이 남는다 */
  const rv = run('revert', { ids: ids(0, 6) });
  eq('되돌리기도 같은 관문을 지난다', rv.status !== 0 && rv.left === 20, true);

  /* ② 되돌리기는 id 와 **주소를 함께** 막는다 — id 는 주소에서 파생돼 규칙이 바뀌면 무효가 된다
     (2026-08-14 부경대: 규칙이 바뀌자 막아 둔 23건이 새 id 를 달고 돌아왔다). */
  const rv1 = run('revert', { ids: ['reg-t0'] });
  eq('되돌리면 id 를 차단 목록에 넣는다', (rv1.cfg.blockIds || []).includes('reg-t0'), true);
  eq('  주소도 함께 넣는다 (id 파생 규칙이 바뀌어도 되살아나지 않게)',
    (rv1.cfg.blockUrls || []).length, 1);

  /* ③ 필수 칸을 빈칸으로 지우지 않는다 — 비면 학생 앱이 그 자리에서 죽는다 */
  const blank = run('edit', { edits: [{ id: 'reg-t0', patch: { documents: '' } }] });
  eq('요구 서류를 빈칸으로 지우려 하면 멈춘다', blank.status !== 0, true);
  eq('  그때 옛 값이 그대로 남는다', blank.after[0].documents, ['재학증명서']);
  eq('  이름도 마찬가지', run('edit', { edits: [{ id: 'reg-t0', patch: { name: '' } }] }).status !== 0, true);
  /* 막기만 하고 고치는 길을 안 내주면 사람이 갇힌다 */
  const fill = run('edit', { edits: [{ id: 'reg-t0', patch: { documents: '재학증명서\n성적증명서' } }] });
  eq('  제대로 채우면 줄 단위로 저장된다', fill.after[0].documents, ['재학증명서', '성적증명서']);

  /* ④ 달력에 없는 날을 저장하지 않는다 — 모양만 보면 `2026-13-01` 이 통과한다(실제 구멍이었다) */
  eq('달력에 없는 달은 막는다', run('edit', { edits: [{ id: 'reg-t0', patch: { deadline: '2026-13-01' } }] }).status !== 0, true);
  eq('달력에 없는 날은 막는다', run('edit', { edits: [{ id: 'reg-t0', patch: { deadline: '2026-02-30' } }] }).status !== 0, true);
  eq('  있는 날은 저장된다',
    run('edit', { edits: [{ id: 'reg-t0', patch: { deadline: '2026-11-30' } }] }).after[0].deadline, '2026-11-30');

  /* ⑤ 자유 형식 제출 스위치는 **저장된 원문에 그 문장이 있을 때만** 켜진다 (운영 원칙 8-1·8-2) */
  const made = run('edit', { edits: [{ id: 'reg-t0', patch: { prepDoc: true, prepDocBasis: '지어낸 문장입니다 자유 양식' } }] });
  eq('원문에 없는 문장을 근거로 자유 형식 스위치를 켜지 않는다', made.status !== 0, true);
  eq('  근거 없이 켜는 것도 막는다',
    run('edit', { edits: [{ id: 'reg-t0', patch: { prepDoc: true } }] }).status !== 0, true);

  /* ⑥ 새 동작을 더할 때 저장 목록에 넣는 것까지가 한 세트 (이슈 #79 유형 —
     화면엔 "✅ 성공" 이 뜨는데 파일은 그대로) */
  const applySrc = readText(new URL('../tools/admin-apply.mjs', import.meta.url));
  const cases = [...applySrc.matchAll(/^\s{2}case '([a-zA-Z]+)':/gm)].map((m) => m[1]);
  const writes = [...((applySrc.match(/const WRITES_REG = \[([^\]]*)\]/) || [])[1] || '')
    .matchAll(/'([^']+)'/g)].map((m) => m[1]);
  eq('저장소가 할 줄 아는 일을 읽어 냈다', cases.length > 8, true);
  /* 🔴 `unblock`·`autoRegister`·`addBoard`·`formQueue` 는 공고 목록을 안 건드려 일부러 빠져 있다.
     목록이 바뀌면 사람이 '이 동작도 공고 목록을 고치는가'를 한 번 본다. */
  eq('공고 목록을 안 고치는 동작 목록이 그대로다',
    cases.filter((c) => !writes.includes(c)).sort(),
    ['addBoard', 'autoRegister', 'formQueue', 'unblock']);
}

console.log('\n■ 못 읽은 파일의 숫자를 화면이 단정하지 않는다');
/* 🔴 관리자 화면이 말하는 「게시판 2곳」·「재단 90곳」은 전부 **파일에서 센 것**이다.
   그 파일을 못 읽었을 때 조용히 빈 값으로 바꾸면 인터넷이 끊겨도 화면은 「0곳 · 모든
   게시판 정상」이라고 말한다 — 확인하지 않은 것을 확인했다고 말하는 것이다(운영 원칙 8-1).
   그래서 admin.js 의 `readJson` 은 실패를 **`D.failed` 에 적고**, 화면 맨 위가
   「아래 숫자를 믿지 마세요」라고 말한다.
   되돌아가는 길은 하나뿐이다 — 데이터 파일을 조용한 읽기(`quiet`)로 옮기는 것.
   그러면 `D.failed` 가 비어 경고가 안 뜨고, 숫자만 0으로 남는다.
   🔴 층2(한국장학재단) 파일을 화면에 붙일 때 정확히 이 길로 가기 쉽다 —
      「아직 없을 수 있는 파일」처럼 보이기 때문이다. 여기서 막는다.
   ⚠️ 이 절은 글자만 본다. **정말로 못 읽게 만들어 경고가 뜨는지**는 브라우저로 재야 하고
      그 자리는 `verify/verify-admin.js` 의 「못 읽은 파일」 절이다. */
{
  const adminJs = readText(new URL('../_admin/admin.js', import.meta.url));
  /* 실패를 적는 두 자리가 살아 있는가 — 응답이 나쁠 때와 아예 못 닿을 때 */
  const readJsonBody = adminJs.slice(adminJs.indexOf('async function readJson('),
    adminJs.indexOf('async function readText('));
  eq('읽기 실패를 장부에 적는 자리가 둘이다 (응답이 나쁠 때 · 아예 못 닿을 때)',
    (readJsonBody.match(/D\.failed\.push\(/g) || []).length, 2);
  eq('  못 읽은 파일이 있으면 숫자를 믿지 말라고 말한다', /믿지 마세요/.test(adminJs), true);

  /* 🔴 톱니 — 조용히 읽는 파일은 「아직 없을 수 있는 것」 넷뿐이다(계정 연결 전·견본 전).
     data/ 나 collector/ 의 파일이 여기 들어오면 그 숫자는 못 읽어도 0으로 뜬다. */
  const QUIET_OK = ['insta/comments.json', 'insta/samples/index.json',
    'insta/stats.json', 'insta/token-seen.json'].sort();
  const quietFiles = [...adminJs.matchAll(/\bquiet\('([^']+)'/g)].map((m) => m[1]).sort();
  eq('조용히 읽는 파일은 「아직 없을 수 있는 것」 넷뿐이다', quietFiles, QUIET_OK);
  eq('  그중 data/·collector/ 파일은 하나도 없다',
    quietFiles.filter((f) => /^(data|collector)\//.test(f)), []);

  /* loadAll 이 읽는 나머지는 전부 장부에 적히는 읽기여야 한다 */
  const loadAll = adminJs.slice(adminJs.indexOf('async function loadAll()'),
    adminJs.indexOf('\n}\n', adminJs.indexOf('D.log = ')));
  const loud = [...loadAll.matchAll(/\breadJson\('([^']+)'/g)].map((m) => m[1]);
  eq('장부에 적히는 읽기가 여럿이다 (헛도는 검사가 아니다)', loud.length >= 10, true);
  eq('  data/·collector/ 파일은 전부 그쪽으로 읽는다',
    [...loadAll.matchAll(/\b(readJson|quiet)\('((?:data|collector)\/[^']+)'/g)]
      .filter((m) => m[1] !== 'readJson').map((m) => m[2]), []);
}

/* ── 학교 장학 신청 포털 (백로그 UI-20 · 2026-09-14) ─────────────────────────
   제출 안내 1단계가 예전부터 "학교 포털 장학 메뉴에서 접수 방법 확인"이라고 말해 왔는데
   그 포털이 어디인지는 앱 어디에도 없었다. 그 한 줄을 누를 수 있게 만든 것이 이 표다.

   🔴 이 절이 지키는 가장 큰 것은 **포털이 '제출처'로 돌아오지 않는 것**이다.
      첫 판이 그렇게 짰다가 코드 리뷰에서 되돌렸다 — `eligibility.schoolOnly` 는 '이 학교
      학생에게만 보인다'(노출 범위)이지 '이 학교에 낸다'가 아니라, 학교 게시판에 올라온
      교외·국가 공고 12건이 전부 틀린 제출처를 받았다. 그중 중소기업취업연계장학금은
      같은 화면의 원문 발췌가 `www.kosaf.go.kr … 를 통하여 신청` 이었다(원칙 8-1 위반).
   🔴 그리고 **짐작한 주소가 들어오는 것**을 막는다 — 확인 기록(verifiedTitle·verifiedAt)이
      없으면 표에 못 들어온다. 주석은 관문이 아니다(「관문이 없는 규칙은 되돌아간다」). */
console.log('■ 학교 장학 신청 포털 — 「학교 포털」이 어디인지 (2026-09-14 · 백로그 UI-20)');
{
  const dataSrc = readText(new URL('../data.js', import.meta.url));
  const appSrc2 = readText(new URL('../app.js', import.meta.url));
  const lit = (name) => {
    const at = dataSrc.indexOf(`const ${name} = {`);
    if (at < 0) throw new Error(`data.js 에서 ${name} 을 못 찾음`);
    const end = dataSrc.indexOf('\n};', at);
    if (end < 0) throw new Error(`${name} 의 끝을 못 찾음`);
    return dataSrc.slice(at, end + 3);
  };
  /* 🔴 규칙을 베끼지 않는다 — data.js 의 진짜 함수를 이름으로 떼어 내 돌린다 */
  const grabData = (src, name) => {
    const start = src.indexOf(`function ${name}(`);
    if (start < 0) throw new Error(`${name} 을 못 찾음`);
    let depth = 0, seen = false;
    for (let i = src.indexOf('{', start); i < src.length; i++) {
      if (src[i] === '{') { depth++; seen = true; }
      else if (src[i] === '}') { depth--; if (seen && depth === 0) return src.slice(start, i + 1); }
    }
    throw new Error(`${name} 의 끝을 못 찾음`);
  };
  const { officialChannel, schoolPortal, SCHOOL_PORTALS } = new Function(
    [lit('OFFICIAL_CHANNELS'), lit('SCHOOL_PORTALS'), lit('SUBMIT_GUIDES'),
      grabData(dataSrc, 'officialChannel'), grabData(dataSrc, 'schoolPortal'),
      'return { officialChannel, schoolPortal, SCHOOL_PORTALS };'].join('\n'))();

  const names = Object.keys(SCHOOL_PORTALS);
  eq('학교 포털 표를 실제로 읽었다', names.length >= 2, true);

  /* 열쇠는 registered.json 의 schoolOnly 와 같은 글자여야 한다 = data.js UNIVERSITIES 의 이름 */
  const uniAt = dataSrc.indexOf('const UNIVERSITIES = [');
  const unis = new Set([...dataSrc.slice(uniAt, dataSrc.indexOf('\n];', uniAt))
    .matchAll(/'([^']+)'/g)].map((m) => m[1]));
  eq('  data.js 학교 목록을 실제로 읽었다', unis.size > 100, true);
  eq('  포털 표의 학교가 전부 UNIVERSITIES 안에 있다', names.filter((n) => !unis.has(n)), []);

  /* 🔴 짐작으로 지은 주소를 막는다 — 확인 기록이 없으면 못 들어온다.
     (주소 둘을 이름으로 막는 것만으로는 다음 사람이 다른 학교를 짐작으로 넣는 것을 못 막는다) */
  const bad = names.filter((n) => {
    const p = SCHOOL_PORTALS[n];
    return !/^https:\/\//.test(p.url || '')
      || !(p.verifiedTitle || '').trim()
      || !/^\d{4}-\d{2}-\d{2}$/.test(p.verifiedAt || '');
  });
  eq('  주소마다 실제로 열어 본 기록(제목·날짜)이 있다', bad, []);
  eq('  확인해 보니 없던 주소가 돌아오지 않았다',
    names.map((n) => SCHOOL_PORTALS[n].url)
      .filter((u) => /^https:\/\/(info|ability)\.(khu|hufs)\.ac\.kr/.test(u)), []);
  eq('  이름을 줄이지 않는다 (학생이 자기 학교로 못 알아본다)',
    names.filter((n) => !SCHOOL_PORTALS[n].label.startsWith(n)), []);

  /* 🔴 되돌리지 말 것 — 포털은 **제출처가 아니다**.
     schoolOnly 는 노출 범위일 뿐이라, 교외·국가 공고가 학교 포털을 제출처로 받게 된다. */
  const khu = { id: 'reg-x', provider: '경희대학교', sourceUrl: 'https://news.khu.ac.kr/list',
    eligibility: { schoolOnly: '경희대학교' } };
  eq('교내 게시 공고의 제출처는 여전히 원문 공고다 (포털이 가로채지 않는다)',
    officialChannel(khu).url, khu.sourceUrl);
  eq('  한국장학재단 제도도 예전 그대로다',
    officialChannel({ id: 'kosaf-type1', provider: '한국장학재단' }).url, 'https://www.kosaf.go.kr');
  /* ⚠️ 이름 하나만 막으면 샌다 — `schoolPortal(sch)` 로 우회해도 같은 사고다(직접 겪었다) */
  eq('  officialChannel 이 포털을 아예 안 본다',
    /SCHOOL_PORTALS|schoolPortal\s*\(/.test(grabData(dataSrc, 'officialChannel')), false);

  /* 실제로 그런 공고가 등록돼 있다 — 위 규칙이 가상의 걱정이 아니라는 증거(사라지면 알려 준다) */
  const regd = JSON.parse(readText(new URL('../data/registered.json', import.meta.url))).items || [];
  const scoped = regd.filter((i) => (i.eligibility || {}).schoolOnly);
  eq('등록된 교내 게시 공고가 있다 (헛도는 검사가 아니다)', scoped.length > 0, true);
  eq('  그중 교외·국가 공고가 실제로 섞여 있다 (제출처로 쓰면 안 되는 이유)',
    scoped.filter((i) => /\[교외\]|\[국가/.test(i.name)).length > 0, true);

  /* 표에 있는 학교의 공고는 전부 포털 한 줄을 받는다 — 학교별로 센다.
     🔴 전체를 한 번에 세면 그 학교 공고가 0건일 때 0 === 0 으로 조용히 통과한다. */
  for (const n of names) {
    const mine = scoped.filter((i) => i.eligibility.schoolOnly === n);
    if (!mine.length) continue;   // 아직 공고가 없는 학교는 실데이터로 잴 것이 없다
    eq(`  ${n} 공고 ${mine.length}건이 전부 포털 한 줄을 받는다`,
      mine.filter((i) => (schoolPortal(i) || {}).url !== SCHOOL_PORTALS[n].url).length, 0);
  }
  eq('  표에 없는 학교는 아무것도 지어내지 않는다',
    schoolPortal({ eligibility: { schoolOnly: '서울대학교' } }), null);
  eq('  자격 칸이 없어도 죽지 않는다', schoolPortal({}), null);

  /* 화면 — 한 줄이 실제로 제출 안내 블록에 그려지고, 단정하지 않는다 */
  const note = grabData(appSrc2, 'schoolPortalNote');
  eq('화면이 그 한 줄을 그린다', /\$\{schoolPortalNote\(sch\)\}/.test(appSrc2), true);
  eq('  주소를 safeUrl·esc 를 거쳐 낸다', /esc\(safeUrl\(p\.url\)\)/.test(note), true);
  eq('  "이 공고를 여기 제출하라"고 단정하지 않는다', /이 공고의 접수 방법은/.test(note), true);
  eq('  교내 장학금으로 한정해 말한다', /교내 장학금은/.test(note), true);
}

/* ── 첨부에서 마감일 (2026-09-15 · 백로그 G-3) ──────────────────────────────
   자격은 예전부터 공고문 첨부를 봤는데(`qualFromDocs`) **마감일은 본문만 봤다.**
   경희대처럼 게시판 본문이 껍데기이고 내용이 첨부 HWPX 안에 있는 유형은, 첨부를 받아
   놓고도 마감을 영영 못 읽어 학생 화면에 '기한 원문 확인'으로 남았다 — 끝난 공고가
   목록에 계속 떴다(G-3 이 말한 증상).

   🔴 이 절이 지키는 둘:
     ① **두 갈래 다** 첨부를 본다 — 본문이 있는 길과 본문이 아예 없는 길. 한쪽만 붙이면
        '본문 껍데기' 게시판이 갈림길에서 통째로 빠져나간다(실제로 그 유형이 대상이다).
     ② **긴 요강에서 엉뚱한 날을 줍지 않는다.** 첨부는 본문과 달리 요강 전문이라
        `실적 인정 기간`·`지급기간`·발급 안내 날짜가 잔뜩 섞여 있다. 방어선은 이름표다. */
console.log('■ 첨부에서 마감일 — 본문이 껍데기인 게시판 (2026-09-15 · G-3)');
{
  const ee = readText(new URL('../collector/extract-excerpts.mjs', import.meta.url));
  /* ① 🔴 **진짜로 불러서 잰다** (2026-09-15 · 코드 리뷰가 잡았다).
     처음엔 이 절이 전부 소스 글자 grep 이었다 — `deadlineFromDocs` 의 **속을 통째로
     `return null` 로 비워도 다섯 항목이 전부 초록**이었다. 부르는 자리만 세고 있었던 것이다.
     게다가 grep 하나는 변수 이름과 중괄호 위치까지 박아 둬서, 뜻이 같은 리팩터에는
     빨간불이 되고 뜻이 죽은 코드에는 초록불이었다 — 관문이 지켜야 할 방향의 정반대다.
     ⚠️ 저장된 첨부는 60일마다 갈리므로, 표본이 없으면 '통과'가 아니라 **건너뜀**이라고 적는다. */
  /* 🔴 래치는 **배포된 데이터**에 묶는다 — '표본이 없으면 건너뜀' 만 두면 함수를 비웠을 때
     표본이 0이 되어 그대로 통과한다(실제로 그렇게 새는 걸 확인하고 고쳤다).
     `deadlineFrom: '공고문 첨부'` 로 적힌 공고는 **그 첨부에서 그 날짜가 나와야 한다**.
     함수가 죽으면 이 왕복이 깨진다. */
  const reg = JSON.parse(readText(new URL('../data/registered.json', import.meta.url))).items;
  const 첨부마감 = reg.filter((i) => i.deadlineFrom === '공고문 첨부' && i.deadline);
  if (첨부마감.length) {
    eq(`첨부에서 읽었다고 적힌 공고 ${첨부마감.length}건이 실제로 다시 읽힌다`,
      첨부마감.filter((i) => AWAIT_EE.deadlineFromDocs({ id: i.id }) !== i.deadline).map((i) => i.id), []);
  } else {
    /* 표본이 없다 — 그래도 **함수가 살아 있는지**는 잰다(첨부가 60일마다 갈려 0건일 수 있다) */
    const 색인 = JSON.parse(readText(new URL('../collector/extracted/elig-docs.json', import.meta.url)));
    const 읽힌것 = Object.keys(색인).filter((id) => AWAIT_EE.deadlineFromDocs({ id }));
    eq('(첨부 마감 표본 없음) 그래도 첨부에서 읽어 내는 힘은 살아 있다',
      읽힌것.length > 0 || Object.keys(색인).length === 0, true);
  }
  eq('첨부에서 마감을 읽는 함수가 있다', typeof AWAIT_EE.deadlineFromDocs, 'function');

  /* ⚠️ 붙임 자르기·발표 이름표·관리자 표식은 **선주 세션 판**이 더 촘촘해 그쪽을 남겼다
     (아래 ④ 절 — 붙임 변형 일곱·통째 붙임·서류 목록 속 [서식 n]·첨부에서 접수시작/발표까지).
     내 판은 `[붙임 1] 선발 공고` 처럼 **파일 자체가 붙임인 것**을 통째로 잘라 버렸다(실측: 결과 빈 문자열).
     여기 남긴 것은 그쪽에 없는 부정 하나뿐이다 — 지급일은 발표일이 아니다. */
  eq('「지급 예정일」은 발표일이 아니다',
    AWAIT_EE.extractAnnounce('지급 예정일 : 2026. 11. 13.') || '(없음)', '(없음)');

  /* 🔴 **포스터 이미지는 로봇이 못 읽는다 — 사람이 읽은 값은 근거를 적어 둔다** (2026-09-16)
     마감 없는 13건 중 7건은 첨부가 **공고 포스터 이미지**라 글자층이 없다(무료 경로로는
     방법이 없고 AI 경로 몫이다). 그 7건은 세션에서 사람이 이미지를 열어 읽었다.
     지어낸 값과 구분되려면 **어디서 읽었는지와 원문 문구**가 남아야 한다 —
     `deadlineFrom: "공고문 이미지 <날짜> · <원문 기간 문구>"`.
     🔴 문구 없이 '공고문 이미지' 만 적는 것을 막는다. 그러면 다음 사람이 확인할 길이 없다.
     🔴 그리고 **정말 이미지 첨부가 있는 공고여야** 한다 — 없으면 근거가 허공이다.
     ⚠️ 하나의 접수기간이 또렷한 것만 채웠다. 세종이도인재처럼 **분야별로 기간이 다른**
        공고(디딤돌·무지개 7/10 · 핵심인재육성 9/30)는 비워 뒀다 — 하나로 납작하게 만들면
        다른 분야 지원자에게 거짓말이 된다(자격 쪽의 같은 함정과 같은 이유). */
  {
    const 이미지발 = reg.filter((i) => /^공고문 이미지/.test(i.deadlineFrom || ''));
    if (이미지발.length) {
      eq(`사람이 이미지에서 읽은 마감 ${이미지발.length}건에 원문 문구가 붙어 있다`,
        이미지발.filter((i) => !/ · .*\d/.test(i.deadlineFrom)).map((i) => i.id), []);
      const 색인2 = JSON.parse(readText(new URL('../collector/extracted/elig-docs.json', import.meta.url)));
      const IMG = /\.(png|jpe?g|webp|gif)$/i;
      eq('  그 공고들에 실제로 이미지 첨부가 있다',
        이미지발.filter((i) => !((색인2[i.id] || {}).files || []).some((f) => IMG.test(f))).map((i) => i.id), []);
      eq('  마감일이 실제로 채워져 있다', 이미지발.filter((i) => !i.deadline).map((i) => i.id), []);
      /* 🔴 인용 문구와 마감일의 **산수**까지 잰다 — 셋만 보면 문구가 `9. 18.` 인데
         deadline 에 `2026-09-08` 이라 적어도 통과한다(표기가 제각각이라 근사로 잰다:
         마감일의 월·일 숫자가 문구 안에 실제로 있는가). */
      eq('  인용 문구에 그 마감일의 월·일이 실제로 있다', 이미지발.filter((i) => {
        const 숫자 = (i.deadlineFrom.match(/\d+/g) || []).map(Number);
        const [, m, d] = i.deadline.split('-').map(Number);
        return !(숫자.includes(m) && 숫자.includes(d));
      }).map((i) => i.id), []);
    } else {
      /* 🔴 '없으면 건너뜀' 만 두면 누가 `deadlineFrom` 만 지워도 관문이 통째로 침묵한다.
         포스터 이미지 첨부가 있는데 마감이 **하나도** 안 채워졌으면 그건 되돌아간 것이다. */
      const 색인3 = JSON.parse(readText(new URL('../collector/extracted/elig-docs.json', import.meta.url)));
      const IMG2 = /\.(png|jpe?g|webp|gif)$/i;
      const 이미지공고 = reg.filter((i) => ((색인3[i.id] || {}).files || []).some((f) => IMG2.test(f)));
      eq('(이미지 출처 표식이 하나도 없다) 이미지 첨부 공고에 마감도 없는가',
        이미지공고.filter((i) => i.deadline).map((i) => i.id), 이미지공고.filter((i) => i.deadline).map((i) => i.id));
      eq('  이미지 첨부 공고가 마감을 가졌다면 출처가 적혀 있어야 한다',
        이미지공고.filter((i) => i.deadline && !i.deadlineFrom).map((i) => i.id), []);
    }
  }
  /* ⚠️ 변수 이름·중괄호 자리를 박지 않는다 — 뜻이 같은 리팩터에 빨간불이 되면 다음 사람이 관문을 끈다.
     재는 것은 '본문을 먼저 보고, 못 읽었을 때 첨부로 물러나는 순서' 하나다. */
  const 본문먼저 = ee.indexOf('extractDeadline(body)');
  eq('  본문을 먼저 보고 못 읽었을 때만 첨부로 물러난다',
    본문먼저 > 0 && ee.indexOf('deadlineFromDocs(it)', 본문먼저) > 본문먼저, true);
  /* 본문이 아예 없는 길(= `if (!hasText(src))` 블록) 안에서도 불러야 한다 */
  const noBody = ee.slice(ee.indexOf('if (!hasText(src)) {'), ee.indexOf('const body = strip('));
  eq('  본문이 아예 없는 길에서도 첨부를 본다', /deadlineFromDocs\(it\)/.test(noBody), true);
  eq('  채우는 자리는 한 곳이다 (period 처리가 갈라지지 않게)',
    (ee.match(/function putDeadline\(/g) || []).length, 1);
  /* 2026-09-17: 표식은 docLabel 이 정한다 — 원문 글자면 '공고문 첨부', OCR 이면 '공고문 첨부(OCR)' */
  eq('  출처를 정직하게 적는다', /putDeadline\(it, dl, docLabel\(fromDocs\.lastFile\)\)/.test(ee) && /'공고문 첨부\(OCR\)' : '공고문 첨부'/.test(ee), true);

  /* ③ 🔴 **동사가 든 이름표는 날짜 '범위'도 근거로 받는다** (2026-09-15 · G-3 이어서).
     `서류 접수 : 2026.7.27 (월) ~ 7.30 (목)` 를 놓치고 있었다 — 이름표는 통과하는데
     값이 `까지`로 안 끝나서 거부됐다(그 방어선은 `신청방법:` 용이다). 사랑의열매
     사랑나눔장학생이 포스터와 docx 둘 다 이 꼴이었다.
     🔴 **맨 이름표(`기간 :`)에는 이 완화를 주지 말 것** — 근로장학생의
        `가. 기간: 2026. 9. 1. ~ 2027. 2. 12.` 은 **일하는 기간**이다. 넓혔다가 관문이
        실제로 이 회귀를 잡았다(아래 두 줄이 그 자리다). */
  {
    const { extractDeadline: ed } = AWAIT_EE;
    eq('동사가 든 이름표 + 날짜 범위를 읽는다', ed('서류 접수 : 2026.7.27 (월) ~ 7.30 (목)'), '2026-07-30');
    eq('  이름표가 「접수」 하나여도 읽는다', ed('접수 : 2026.7.27 (월) ~ 7.30 (목)'), '2026-07-30');
    eq('  🔴 맨 「기간 :」 + 범위는 여전히 안 읽는다 (일하는 기간)',
      ed('가. 기간: 2026. 9. 1. ~ 2027. 2. 12.') || '(없음)', '(없음)');
    eq('  🔴 맨 「기간 :」 은 「까지」일 때만 읽는다',
      ed('가. 기간 : 2026. 7. 20. ~ 8. 14.(금) 16:00 까지'), '2026-08-14');
    eq('  방법 이름표에 날짜가 딴 뜻이면 안 읽는다', ed('신청방법 : 포털에서 신청') || '(없음)', '(없음)');
    eq('  접수처는 이름표가 아니다', ed('접수처 : 서울시 광진구 천호대로 549') || '(없음)', '(없음)');

    /* 🔴 **완화의 진짜 위험은 「자격 줄 속 괄호 기간」이다** (2026-09-16 코드 리뷰가 잡았다).
       동사 이름표 + 범위만 보면, 기간을 말하는 줄이 아니라 **조건을 말하는 줄**이 열린다.
       아래는 전부 저장된 원문 전수 대조에서 실제로 새로 열렸거나(항공대) 같은 꼴로 만든 것이다.
       한국항공대 건은 자격 줄이 진짜 기간 줄보다 **위에** 있어서, 첫 승자 규칙 때문에
       진짜 마감 8/13 을 **6/22 로 뒤집었다** — 살아 있는 공고가 끝난 것이 된다.
       🔴 가르는 것은 이름표가 아니라 **값의 꼬리**다: 끝 날짜 뒤에 한글 산문이 남으면
          (`) 완료한 자`·`이상인 자`·`재학한 자`·`인정`) 그 줄은 기간 안내가 아니다.
          진짜 기간 줄의 꼬리에는 요일·시각·`까지` 밖에 없다. */
    eq('  자격 줄 속 괄호 기간을 마감으로 줍지 않는다',
      ed('○ 한국장학재단 신청 : 2026학년도 2학기 국가근로 장학금 1차 신청(2026.5.22 ~ 6.22) 완료한 자') || '(없음)', '(없음)');
    eq('  그 줄이 진짜 기간 줄보다 위에 있어도 진짜만 집는다',
      ed('○ 한국장학재단 신청 : 2026학년도 2학기 국가근로 장학금 1차 신청(2026.5.22 ~ 6.22) 완료한 자\n5. 교내 신청 기간: 2026. 7. 20(월) 17:00 ~ 8. 13(목) 23:55'),
      '2026-08-13');
    eq('  성적 범위를 날짜로 읽지 않는다',
      ed('○ 신청 : 2026학년도 성적 3.5 ~ 4.5 이상인 자') || '(없음)', '(없음)');
    eq('  지난 학기 기간(자격)도 안 읽는다',
      ed('○ 신청 : 지난 학기(2025.9.1 ~ 2026.2.28) 재학한 자') || '(없음)', '(없음)');
    eq('  실적 인정 기간도 안 읽는다',
      ed('신청 : 봉사활동 실적 2025. 1. 1. ~ 2025. 12. 31. 인정') || '(없음)', '(없음)');
    /* 🔴 그러면서 **진짜 기간 줄은 살아야** 한다 — 꼬리가 요일·시각뿐인 것들 */
    eq('  꼬리가 요일뿐이면 읽는다', ed('접수 : 2026.7.27 (월) ~ 7.30 (목)'), '2026-07-30');
    eq('  꼬리가 시각이어도 읽는다',
      ed('접수 : 2026. 8. 31.( 월 ) 09:00 ～ 9. 18.( 금 ) 18:00'), '2026-09-18');
    eq('  꼬리에 「까지」가 붙어도 읽는다',
      ed('서류 접수 : 2026.9.1(화) ~ 9.30(수) 18시까지'), '2026-09-30');
  }

  /* ② 긴 요강의 함정 — 전부 **실제 문서에서 가져온 줄**이다
     ((재)익산사랑장학재단 2026년도 선발 공고 hwpx · 768줄). 진짜 함수를 부른다. */
  const { extractDeadline } = AWAIT_EE;
  const 함정 = [
    '- 실적 인정 기간 : 2025. 7. 1. ~ 2026. 6. 30.',
    '- 수상실적 인정 기간 : 2025. 7. 1. ~ 2026. 6. 30.',
    '2. 모든 제출 서류는 공고일(2026년 8월 26일) 이후 발급한 원본으로 제출하여야 함',
    '- 2026년 5월 ~ 7월까지 가입상태(변동사항)를 확인가능하도록 발급',
  ];
  eq('요강에 널린 날짜를 마감으로 줍지 않는다',
    함정.filter((l) => extractDeadline(l)), []);
  eq('  그 넷을 한 덩어리로 줘도 마감이 없다고 답한다', extractDeadline(함정.join('\n')) || '(없음)', '(없음)');
  /* 🔴 그런데 진짜 접수기간 줄은 읽어야 한다 — 위 검사만 두면 "늘 null" 로도 통과한다 */
  const 진짜 = '1. 접수기간 : 2026. 9. 3.(목) ∼ 9. 9.(수) 18:00까지';
  eq('  진짜 접수기간 줄은 읽는다 (헛도는 검사가 아니다)', extractDeadline(진짜), '2026-09-09');
  eq('  요강 전체(함정 + 진짜)에서도 진짜만 집는다',
    extractDeadline([...함정, 진짜].join('\n')), '2026-09-09');

  /* ④ 🔴 **붙임 서식 뒤의 날짜는 공고의 날짜가 아니다** (2026-09-16 · G-3 ①②③ 후속 —
     세현 판에 코드 리뷰가 남긴 지적 셋을 되돌려 빨간불을 확인했다).
     `elig-1xmn1p-1.docx` 가 `form-1xmn1p-1.docx` 와 똑같다 — 공고문에 신청서가 같은 파일로
     붙어 온다. 서식 칸의 `신청기간 : 2025. 9. 1. ~ 9. 10.` 은 지난 회차 견본인데,
     본문에 기간 줄이 없으면 첫 승자 규칙이 그것을 마감으로 집었다(실측 2025-09-10).
     `deadlineFromDocs(it, texts)` 의 둘째 인자는 **관문 전용 창구**다 — 파일 대신 합성 글을
     먹여 자르기가 진짜로 일하는지 잰다(저장된 첨부는 60일마다 갈려 픽스처가 못 된다). */
  {
    const { deadlineFromDocs: dfd, announceFromDocs: afd, openDateFromDocs: ofd, extractAnnounce: ea, annexCut } = AWAIT_EE;
    eq('첨부에서 접수 시작일·발표일도 읽는 함수가 있다',
      [typeof ofd, typeof afd, typeof annexCut], ['function', 'function', 'function']);
    const 공고 = '2026년 장학생 선발 공고\n1. 개요\n2. 지원자격 : 재학생\n3. 제출서류 : 신청서 1부';
    /* 서식은 머리줄 뒤에 **칸 이름**(성명·학과)이 따라온다 — 그게 '서식이 시작됐다'는 증거다 */
    const 서식 = '[붙임1] 장학생 신청서\n신청기간 : 2025. 9. 1. ~ 9. 10.\n발표 예정일 : 2025. 10. 1.\n성명 :\n학과 :';
    eq('🔴 붙임 서식의 견본 날짜를 마감으로 줍지 않는다',
      dfd({ id: '(합성)' }, [`${공고}\n${서식}`]) || '(없음)', '(없음)');
    eq('  견본 날짜를 발표일로도 줍지 않는다', afd({ id: '(합성)' }, [`${공고}\n${서식}`]) || '(없음)', '(없음)');
    eq('  견본 날짜를 접수 시작일로도 줍지 않는다', ofd({ id: '(합성)' }, [`${공고}\n${서식}`]) || '(없음)', '(없음)');
    eq('  붙임 앞의 진짜 접수기간은 읽는다',
      dfd({ id: '(합성)' }, [`${공고}\n${진짜}\n${서식}`]), '2026-09-09');
    eq('  붙임이 「별지」·「서식」·괄호꼴·「별지 제1호서식」·「<서식1>」이어도 자른다',
      ['[별지 1] 신청서', '(서식 1) 신청서', '별첨 1. 신청서', '붙임 1. 익산사랑 장학생 신청서 1부.',
        '[별지 제1호서식]', '<서식1> 참여의향서 (*9.11까지 제출)', '서식 1']
        .map((h) => dfd({ id: '(합성)' }, [`${공고}\n${h}\n장학생 신청서\n신청기간 : 2025. 9. 1. ~ 9. 10.\n성명 :`]) || '(없음)'),
      ['(없음)', '(없음)', '(없음)', '(없음)', '(없음)', '(없음)', '(없음)']);
    /* 🔴 머리줄만으로 자르면 안 된다 (코드 리뷰) — 대전청년내일재단은 증빙서류 표 **안에**
       `[서식 1] 장학생 추천서` · `[서식 2] 서약서` 를 목록으로 적고 그 뒤에 유의사항·접수기간이 온다 */
    eq('  🔴 서류 목록 속의 [서식 n] 줄은 경계가 아니다 (뒤에 칸 이름이 없다)',
      dfd({ id: '(합성)' }, [`${공고}\n증빙서류\n[서식 1] 장학생 추천서(학교(총)장 추천)\n[서식 2] 서약서\n주민등록등본\n- 주민등록번호 뒷자리 마스킹 필수\n성적증명서\nㅇ 문의: 042-719-8426\n${진짜}`]), '2026-09-09');
    eq('  머리줄 자신이 날짜 이름표를 달고 있으면 경계가 아니다',
      dfd({ id: '(합성)' }, [`${공고}\n붙임 1. 접수기간 : 2026. 9. 3.(목) ∼ 9. 9.(수) 18:00까지\n성명 :`]), '2026-09-09');
    eq('  🔴 앞에 빈 줄이 셋 있어도 통째 붙임 파일은 잘리지 않는다 (글자 있는 줄만 센다)',
      dfd({ id: '(합성)' }, [`\n\n\n[붙임 1] 2026년 선발 공고\n1. 개요\n${진짜}\n성명 :`]), '2026-09-09');
    eq('  칸 이름이 여덟 줄 뒤에 오면(정보성 붙임) 자르지 않는다',
      dfd({ id: '(합성)' }, [`${공고}\n붙임 1\n학자금 이중지원 방지\n□ 기본 취지\n◦ 등록금 전액 규모를 초과하여\n◦ 둘\n◦ 셋\n◦ 넷\n◦ 다섯\n◦ 여섯\n◦ 일곱\n${진짜}`]), '2026-09-09');
    eq('  파일이 통째로 붙임이면(첫 세 줄) 자르지 않는다',
      dfd({ id: '(합성)' }, [`[붙임 1] 2026년 선발 공고\n1. 개요\n${진짜}`]), '2026-09-09');
    eq('  본문 문장 속의 [별지1] 언급은 경계가 아니다 (머리줄은 40자 이하)',
      dfd({ id: '(합성)' }, [`${공고}\n※ 초·중·고등학생은 학교장 추천서 및 학교 직인 날인 제출 [별지1] 장학생 신청서 서식을 쓴다\n${진짜}`]), '2026-09-09');
    eq('  둘째 파일에 진짜가 있으면 그것을 읽는다 (파일 순서대로)',
      dfd({ id: '(합성)' }, [`${공고}\n${서식}`, `${공고}\n${진짜}`]), '2026-09-09');

    /* ③ 이름표 `발표 예정일` — 익산사랑 요강 676행, 빈칸 하나 때문에 못 읽었다 */
    eq('🔴 「발표 예정일 :」 을 발표일로 읽는다',
      ea('1. 발표 예정일 : 2026. 11. 13.(금)(*선발자에 한해 개별 통보)'), '2026-11-13');
    eq('  「발표예정일」·「발표일」도 그대로', [ea('발표예정일 : 2026. 11. 13.'), ea('발표일 : 2026. 11. 13.')],
      ['2026-11-13', '2026-11-13']);
    eq('  「발표 준비물」·「성과 발표회」는 여전히 안 읽는다 (넓히지 않았다)',
      [ea('발표 준비물 : 2026. 11. 13.'), ea('성과 발표회 : 2026. 11. 13.')].map((v) => v || '(없음)'), ['(없음)', '(없음)']);
    eq('  첨부에서 발표일을 읽는다 (붙임 앞)',
      afd({ id: '(합성)' }, [`${공고}\n${진짜}\n선발자 발표\n1. 발표 예정일 : 2026. 11. 13.(금)\n${서식}`]), '2026-11-13');
    /* 저장된 첨부 전수 — 「발표 예정일 :」 줄이 있는 문서는 빠짐없이 발표일이 나와야 한다
       (id 를 박지 않는다 — 첨부는 60일마다 갈린다. 그런 줄이 하나도 없으면 건너뜀이라 적는다) */
    {
      const 색인4 = JSON.parse(readText(new URL('../collector/extracted/elig-docs.json', import.meta.url)));
      const { attachmentText: at, readable: rd } = await import('../collector/attachment-text.mjs');
      const 있는것 = Object.entries(색인4).filter(([, v]) => (v.files || []).some((f) => {
        const t = at(fileURLToPath(new URL(`../collector/extracted/${f}`, import.meta.url)));
        return rd(t) && /발표\s?예정일\s*[:：]/.test(annexCut(t));
      }));
      if (있는것.length) {
        eq(`  저장된 첨부 중 「발표 예정일」 줄이 있는 ${있는것.length}건이 전부 발표일을 낸다`,
          있는것.filter(([id]) => !afd({ id })).map(([id]) => id), []);
      } else console.log('  (저장된 첨부에 「발표 예정일」 줄이 없어 실데이터 항목은 건너뜀)');
    }

    /* 순서 — 본문이 먼저 · 첨부는 물러날 곳 · 채우는 자리는 한 곳 · 두 갈래 다 */
    eq('  접수 시작·발표를 채우는 자리는 한 곳이다', (ee.match(/function fillCalendarDates\(/g) || []).length, 1);
    eq('  본문이 있는 길: 본문을 먼저 보고 첨부로 물러난다',
      /extractOpenDate\(body\) \|\| openDateFromDocs\(it/.test(ee) && /extractAnnounce\(body\) \|\| announceFromDocs\(it/.test(ee), true);
    eq('  본문이 아예 없는 길에서도 첨부에서 접수 시작·발표를 본다',
      /fillCalendarDates\(it, \(\) => openDateFromDocs\(it[^\n]*announceFromDocs\(it/.test(noBody), true);

    /* ② 🔴 사람이 정한 마감은 로봇이 건드리지 않는다 — 두 갈래 다 표식을 본다 */
    eq('🔴 마감을 채우는 두 자리가 모두 관리자·AI 표식을 본다',
      (ee.match(/!it\.deadline && !humanOwned\(it\.deadlineFrom\)/g) || []).length, 2);
    eq('  표식 판정은 자격과 같은 꼴이다 (AI·관리자)', /humanOwned = \(from\) => \/\^\(AI\|관리자\)\//.test(ee), true);
    const aa = readText(new URL('../tools/admin-apply.mjs', import.meta.url));
    eq('  관리자 화면이 마감을 고치면 표식을 남긴다', /changed\.includes\('deadline'\)/.test(aa) && /it\.deadlineFrom = it\.deadline \? OWNER/.test(aa), true);
    eq('  🔴 마감을 비울 때도 표식이 남는다 (되채움 차단)', /`\$\{OWNER\} · 비움`/.test(aa), true);
    /* period 가 마감을 따라가는 규칙은 화면·저장소가 **같은 함수**(edit-diff periodAfterDeadline)를 쓴다 */
    const { periodAfterDeadline: pad } = await import('../tools/edit-diff.mjs');
    eq('  저장소가 그 함수를 쓴다', /periodAfterDeadline\(it\.period, it\.deadline, oldDeadline\)/.test(aa), true);
    eq('  사람이 적은 마감은 「원문 확인」 자리에 들어간다 (D-14 옆에 「원문 확인」이 남지 않게)',
      [pad('접수 기간 원문 확인', '2026-11-30'), pad('', '2026-11-30'), pad('2026-2학기 1차 ~2026-10-01', '2026-11-30')],
      ['접수 기간 ~2026-11-30', '접수 ~2026-11-30', '2026-2학기 1차 ~2026-10-01']);
    eq('  비울 때 방금 지운 그 날짜가 든 문구는 「원문 확인」으로 되돌린다',
      [pad('접수 ~2025-09-10', undefined, '2025-09-10'), pad('접수 ~2026-10-01', undefined, '2025-09-10')],
      ['접수 기간 원문 확인', '접수 ~2026-10-01']);
    eq('  발표일도 같은 표식을 남기고 로봇이 존중한다',
      /it\.announceDateFrom = it\.announceDate \? OWNER/.test(aa) && /!it\.announceDate && !humanOwned\(it\.announceDateFrom\)/.test(ee), true);
    eq('  합칠 때 사람이 비운 마감을 되살리지 않는다', /!keep\.deadline && drop\.deadline && !\/\^\(AI\|관리자\)\//.test(aa), true);
  }
}

/* ── 2026-09-15 · 노션 UI-11 — 도우미가 자주 묻는 질문을 답한다 ──
   고객센터 화면과 **같은 원본**(app.js FAQ_ITEMS)을 읽고 답 문장을 그대로 낸다. 공고 검색보다
   뒤에 오고(그대로 물은 것만 앞), 낱말 하나로는 답하지 않는다 — '지원금 있어?' 사고의 FAQ 판. */
console.log('\n■ 도우미가 자주 묻는 질문을 답한다 (2026-09-15 · 노션 UI-11)');
{
  const appSrc = readText(new URL('../app.js', import.meta.url));
  const a = appSrc.indexOf('const FAQ_ITEMS = [');
  const b = appSrc.indexOf('\n];', a);
  eq('FAQ 원본은 app.js 하나다', a > 0 && b > a, true);
  const faq = new Function(`return ${appSrc.slice(a + 'const FAQ_ITEMS = '.length, b + 2)}`)();
  const chatSrc = readText(new URL('../chat.js', import.meta.url));
  eq('  chat.js 에 FAQ 사본이 없다', /const FAQ_ITEMS\s*=/.test(chatSrc), false);
  globalThis.FAQ_ITEMS = faq;
  const C = createRequire(import.meta.url)('../chat.js');
  const isFaq = (r) => !!(r && r.actions && r.actions.some((x) => x.act === 'faq'));
  eq('그대로 물으면 답한다 (알림이 안 와요)', isFaq(C.chatRoute('알림이 안 와요')), true);
  eq('  답 문장은 원본 그대로, 태그만 벗긴다', C.chatRoute('알림이 안 와요').text,
    faq.find(([, q]) => q === '알림이 안 와요.')[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim());
  eq('  짧은 질문도 (유료인가요?)', isFaq(C.chatRoute('유료인가요?')), true);
  eq('  말이 달라도 (앱에서 신청까지 끝나?)', isFaq(C.chatRoute('앱에서 신청까지 끝나?')), true);
  eq('  동점이면 물은 글자와 길게 이어지는 질문이 이긴다 (내 정보는 어디에 저장돼?)',
    String((C.chatRoute('내 정보는 어디에 저장돼?') || {}).note || '').includes('내 정보는 어디에 저장되나요'), true);
  eq('  공고 낱말이 든 질문은 FAQ 로 새지 않는다 (기숙사 알림)', isFaq(C.chatRoute('기숙사 알림')), false);
  eq('  모르는 것은 모른다 (쿼카 사육 지원금)', C.chatRoute('쿼카 사육 지원금 있어?'), null);
  /* 🔴 코드 리뷰(2026-09-15)가 잡은 새는 자리 둘 — 되돌리면 여기서 빨간불 */
  eq('  낱말 하나로는 답하지 않는다 (공고 없어 → 인터넷 FAQ 가 아니다)', C.chatRoute('공고 없어'), null);
  eq('    이름 바꾸기 → 기기 바꾸기 FAQ 가 아니다', C.chatRoute('이름 바꾸기'), null);
  eq('    유료? 한 낱말은 모른다 (그대로 물어야 답한다)', C.chatRoute('유료?'), null);
  eq('  4글자 부분일치로 삼키지 않는다 (학교 공고 → 우리 학교 공고 FAQ 가 아니다)', isFaq(C.chatRoute('학교 공고')), false);
  eq('    공고 안 보여 도 마찬가지', isFaq(C.chatRoute('공고 안 보여')), false);
  eq('  FAQ 는 공고 검색보다 뒤에 온다 (그대로 물은 것만 앞)',
    chatSrc.indexOf('const faq = chatAnswerFaq(s);') > chatSrc.indexOf('const cards = chatSearch(s);'), true);
  eq('  버튼이 자주 묻는 질문 화면으로 간다', /act === 'faq'\) return go\('faq'\)/.test(chatSrc) && /name === 'faq'\) renderFaq\(\)/.test(appSrc), true);
  delete globalThis.FAQ_ITEMS;
}

/* ── 2026-09-17 · 노션 UI-10 — 틀린 ✓ · 틀린 ✗ (자격 판정 전수 대조) ──
   개발자 지적: "학생에게 해당하지 않는 지원자격이 충족 표시되거나, 해당함에도 미충족 표시되는
   문제". verify/verdict-table.mjs 로 학생 여섯 × 자격 줄 전부의 ✓·✗ 를 뽑아 사람이 읽었고,
   아홉 갈래가 틀려 있었다. 아래는 그 실제 줄이다 — 되돌리면 여기서 빨간불. */
console.log('\n■ 자격 판정 전수 대조 — 틀린 ✓·틀린 ✗ (2026-09-17 · 노션 UI-10)');
{
  const MEq = createRequire(import.meta.url)('../match-engine.js');
  const PRq = createRequire(import.meta.url)('../parse-requirements.js');
  const base = { school: '한국외국어대학교', campus: '서울', track: 'humanities', major: '영어학과', year: 3,
    status: '재학', gpa: 3.5, bracket: 5, credits: 15, region: '서울', parentRegion: '서울',
    nationality: 'korean', birthYear: 2004, flags: [], common: {} };
  const mark = (line, over, sch) => MEq.requirementMatch(line, { ...base, ...(over || {}) }, sch || {});
  const onLeave = { status: '휴학' };

  /* ① 부정어 뒤의 학적은 금지다 — 휴학생에게 ✓ 가 떴던 세 줄 */
  eq('「(휴학생 제외)」는 휴학생을 막는다 (틀린 ✓ 였다)', mark('전국 대학(원)생 (휴학생 제외)', onLeave), 'no');
  eq('  재학생은 그 줄에 통과한다', mark('전국 대학(원)생 (휴학생 제외)'), 'ok');
  eq('  붙여 쓴 「(휴학생제외)」도', mark('초·중·고·대학교 재학생(휴학생제외)', onLeave), 'no');
  eq('  「휴학예정자 지원불가」도', mark('2026년 2학기 재학생 (2026-2학기 휴학예정자 지원불가)', onLeave), 'no');
  eq('  「재학 및 복학예정자」는 여전히 휴학생을 받는다 (되돌아가면 안 되는 것)',
    PRq.parseLine('2026-2학기 재학 및 복학예정자', false).conds.find((c) => c.kind === 'status').anyOf.includes('휴학'), false);
  /* ② `복학생인 경우,` 도 경우별 분기다 — 휴학생에게 ✓ 가 떴다 */
  eq('「복학생인 경우, 휴학 직전학기 …」는 휴학생의 줄이 아니다', mark('복학생인 경우, 휴학 직전학기 성적 기준', onLeave), null);
  eq('  복학예정자에게는 판정한다', PRq.caseBranch('복학생인 경우, 휴학 직전학기 성적 기준'), ['복학예정']);
  /* ③ `시각디자인 전공자` — 이름이 `전공자` 로 잡혀 시각디자인학과 학생이 ✗ 였다 */
  eq('「시각디자인 전공자」는 시각디자인학과 학생에게 ✓ (틀린 ✗ 였다)',
    mark('시각디자인 전공자 및 판화학과 재학생', { major: '시각디자인학과', track: 'arts', school: '경희대학교' }), 'ok');
  eq('  영어학과 학생에게는 ✗ 그대로', mark('시각디자인 전공자 및 판화학과 재학생'), 'no');
  eq('  이름 목록에 「전공자」가 없다',
    (PRq.parseLine('시각디자인 전공자 및 판화학과 재학생', false).conds.find((c) => c.kind === 'major') || {}).names, ['시각디자인', '판화']);
  /* ④ 두 척도가 나란한 줄 — 4.5 만점 3.5 학생이 ✗ 였다 */
  const two = '직전 학기까지의 전체 평균 평점 3.5 이상(4.5 만점 기준) 또는 3.3 이상(4.3 만점 기준) 성적을 가진 학생';
  eq('4.5 만점 쪽 숫자를 쓴다 (평점 3.5 → ✓ · 틀린 ✗ 였다)', mark(two), 'ok');
  eq('  평점 2.8 은 ✗', mark(two, { gpa: 2.8 }), 'no');
  /* ⑤ 선택지 묶음 안에서도 조건 전부가 맞아야 ✓ — 정읍시민장학재단 실제 공고로 잰다 */
  {
    const sch = JSON.parse(readText(new URL('../data/registered.json', import.meta.url))).items.find((x) => x.id === 'reg-hi-jeongeup');
    if (sch) {
      const line = (sch.eligibilityLines || []).find((l) => /재학생:.*85점/.test(l));
      if (line) eq('  (실데이터) 정읍 「재학생: … 85점 이상」이 평점 2.8 학생에게 ✓ 가 아니다', mark(line, { gpa: 2.8, school: '경희대학교' }, sch), null);
      else console.log('   (정읍 공고의 그 줄이 바뀌어 실데이터 항목을 건너뜀)');   // 줄이 없으면 null===null 로 조용히 통과하지 않게
    } else console.log('   (정읍 공고가 등록 목록에 없어 실데이터 항목을 건너뜀)');
  }
  /* ⑤-2 선택지 묶음 안에서도 '묻지 않은 처지'·구간표 예외는 본 경로와 같다 (2026-09-17 코드 리뷰) */
  {
    const sch = { eligibilityLines: ['다음 두 가지 중 하나에 해당하는 국내 대학 재학생',
      '한국장학재단에서 학자금대출을 받은 국내 대학교 재학생', '학과장 추천을 받은 재학생 (4분위 이하)', '5~6분위 재학생'] };
    eq('  택1 묶음 안의 「학자금대출을 받은 … 재학생」도 ✓ 가 아니다', mark(sch.eligibilityLines[1], {}, sch), null);
    eq('  택1 묶음 안의 「추천을 받은 재학생」도', mark(sch.eligibilityLines[2], { bracket: 3 }, sch), null);
  }
  /* ⑤-3 부정어의 사정거리는 절 전체다 — 목록·`및` 앞쪽 낱말이 허용으로 새고 있었다 */
  eq('「재학생(휴학생, 졸업유예자 제외)」는 휴학생을 막는다', mark('재학생(휴학생, 졸업유예자 제외)', onLeave), 'no');
  eq('  졸업유예자도', mark('재학생(휴학생, 졸업유예자 제외)', { status: '졸업유예' }), 'no');
  eq('  「재학생 (휴학생·수료생·졸업생 제외)」의 수료생', mark('재학생 (휴학생·수료생·졸업생 제외)', { status: '수료' }), 'no');
  eq('  「휴학생 및 휴학 예정자 지원 불가」의 휴학생 (실데이터 꼴)',
    mark('1학년 또는 2학년 학생 (2026년 2학기 휴학생 및 휴학 예정자 지원 불가)', { ...onLeave, year: 2 }), 'no');
  eq('  「수료생 및 졸업생 제외」— 앞쪽 수료생도 금지',
    (PRq.parseLine('수료생 및 졸업생 제외', false).conds.find((c) => c.kind === 'status') || {}).not, ['수료', '졸업']);
  eq('  「휴학생은 신청할 수 없음」', mark('휴학생은 신청할 수 없음', onLeave), 'no');
  eq('  「휴학생은 신청 가능, 수료생은 신청 불가」에서 휴학생은 금지가 아니다',
    (PRq.parseLine('휴학생은 신청 가능, 수료생은 신청 불가', false).conds.find((c) => c.kind === 'status') || {}).anyOf, ['휴학']);
  eq('  「학적 제한 없음」은 부정이 아니다', (PRq.parseLine('휴학생 포함 학적 제한 없음', false).conds.find((c) => c.kind === 'status') || {}).not, undefined);
  eq('  재학생은 「재학생(휴학생 제외)」에 여전히 ✓', mark('재학생(휴학생, 졸업유예자 제외)'), 'ok');
  /* ⑤-4 `X 전공자` 의 X 가 일반 낱말이면 이름이 아니다 — 모든 학생이 ✗ 였다 */
  eq('「해당 학과 전공자」는 ✗ 가 아니다', mark('해당 학과 전공자'), null);
  eq('  「타 학과 전공자 지원 불가」도 ✗ 가 아니다', mark('타 학과 전공자 지원 불가'), null);
  eq('  이름 목록이 빈다', (PRq.parseLine('동일 계열 전공자 우대', false).conds.find((c) => c.kind === 'major') || { names: [] }).names, []);
  /* ⑤-5 괄호 안에 제 문턱이 있으면 4.5 쪽 숫자를 쓴다 */
  eq('「4.3 만점 3.0 이상 (4.5 만점 3.2 이상)」은 평점 3.1 에게 ✗',
    mark('평점 4.3 만점 3.0 이상 (4.5 만점 3.2 이상)', { gpa: 3.1 }), 'no');
  /* ⑤-6 서술어는 지역 이름이 아니다 */
  eq('「계속 거주하는 도민」의 지역 이름이 「거주하는」이 아니다',
    (PRq.parseLine('충북에 3년 이상 계속 거주하는 도민의 자녀', false).conds.filter((c) => c.kind === 'residence' && c.unnamed)).length, 0);
  eq('  「용인 지역」은 여전히 지역이다', (PRq.parseLine('용인 지역 거주자', false).conds.find((c) => c.kind === 'residence') || {}).unnamed, true);
  eq('  「경력 무관」은 묻는 것이 아니다', PRq.unaskedAttr('경력 무관 · 재학생', [{ kind: 'status' }]), false);
  /* ⑥ 이름 모르는 곳도 지역 요건이다 — 부산 신입생에게 포항·광양 줄이 ✓ 였다 */
  const fresh = { status: '신입학', year: 1, gpa: null, credits: null, region: '부산', parentRegion: '부산' };
  eq('「포항·광양 지역 가정 자녀 … 신입생」은 부산 신입생에게 ✓ 가 아니다', mark('포항·광양 지역 가정 자녀 중 2026년 대학 신입생', fresh), null);
  eq('  「포항·광양 소재 대학교 … 신입생」도', mark('포항·광양 소재 대학교 2026년 우수성적 신입생', fresh), null);
  eq('  「해당 지역」·「전국」은 지역 요건이 아니다',
    PRq.parseLine('전국 4년제 대학교 2026년 신입생', false).conds.some((c) => c.kind === 'residence'), false);
  /* ⑦ 한 일·가진 것을 묻는 줄은 처지 낱말이 있어도 ✓ 가 아니다 */
  eq('「학자금대출을 받은 … 재학생」은 ✓ 가 아니다', mark('한국장학재단에서 학자금대출을 받은 국내 대학교 재학생'), null);
  eq('  「형제·자매가 2인 이상 동시에 재학」도', mark('2026-2학기 본교 학부에 형제 · 자매가 2 인 이상 동시에 재학하고 있는 자'), null);
  eq('  「추천을 받은 2학년 이상」도', mark('타지역에 소재한 국내 대학교에 재학 중인 학교(총)장 또는 단과대학장의 추천을 받은 대학교 2학년 이상 학생'), null);
  eq('  「장애학생 중 … 수상 실적」은 장애 학생에게도 ✓ 가 아니다',
    mark('장애학생 중 학업 성적 우수, 예술‧체육‧기능‧기타 분야에서 도단위 이상 대회 3위 이상 수상 실적이 있는 자', { flags: ['disabled'] }), null);
  eq('  다자녀 줄은 여전히 다자녀 학생에게 ✓ (되돌아가면 안 되는 것)', mark('다자녀 가구의 자녀', { flags: ['multiChild'] }), 'ok');

  /* ⑧ 🔴 정답표 — 사람이 읽은 판정과 엔진이 같은가 (예방 장치).
     규칙을 고쳐 판정이 바뀌면 여기서 빨간불이 난다. 의도한 변화면 표를 다시 읽고
     `node verify/verdict-table.mjs --write-gold` 로 굳힌다. 안 읽고 굳히지 말 것. */
  process.env.VERDICT_AS_LIB = '1';
  const VT = await import(new URL('./verdict-table.mjs', import.meta.url));
  const gold = JSON.parse(readText(new URL('./fixtures/eligibility-gold.json', import.meta.url)));
  const now = VT.verdictRows();
  const key = (r) => `${r.id} ${r.text} ${r.exclude ? 1 : 0}`;
  const nowMap = new Map(now.map((r) => [key(r), r.verdict]));
  const drift = [];
  let seen = 0;
  for (const g of gold.rows) {
    const v = nowMap.get(key(g));
    if (!v) continue;   // 그 공고가 목록에서 빠졌으면 잴 것이 없다(목록은 매일 바뀐다)
    seen += 1;
    for (const p of Object.keys(g.verdict)) {
      if ((g.verdict[p] || null) !== (v[p] || null)) drift.push(`${g.id} · ${p} · ${g.text.slice(0, 40)} : ${g.verdict[p] || '·'} → ${v[p] || '·'}`);
    }
  }
  /* ⚠️ 열쇠(줄 글자)가 하나도 안 맞으면 전부 건너뛰어 조용히 통과한다 — 그래서 절반 넘게는 맞아야 한다
     (목록에서 빠진 공고는 있어도 되지만, requirementLines 의 글자 다듬기가 바뀌면 여기서 드러난다) */
  eq(`정답표 ${gold.rows.length}줄 중 아직 목록에 있는 줄을 실제로 쟀다 (${seen}줄)`, seen >= Math.ceil(gold.rows.length / 2), true);
  eq('  엔진 판정이 정답표와 같다 (다르면 표를 읽고 --write-gold)', drift, []);
  eq('  정답표는 사람이 읽은 뒤 굳힌다고 적혀 있다', /사람이 표를 읽은 뒤에만/.test(gold.note || ''), true);
}

/* ── 2026-09-17 · 노션 G-3 — 마감일 감사 (틀린 마감은 못 읽은 것보다 나쁘다) ──
   개발자 지적: "마감일이 아직 지나지 않았음에도 마감된 공고라고 뜨면서 신청 불가로 뜨는 문제".
   verify/deadline-audit.mjs 가 마감마다 **근거 줄**을 찾고 말이 되는지 본다. 전수 조사 결과:
   근거 없는 마감은 전부 2026-09-12 자동 등록이 **게시판 요약 한 줄**에서 읽었는데 그 요약이
   어디에도 저장되지 않아 근거를 잃은 것이다(아래 톱니의 천장이 그것이다 — 건국 1건은 2026-09-17
   링크 정찰 run 35207443601 로 게시판 제목에서 확인해 deadlineFrom 에 적었다 · 4 → 3). */
console.log('\n■ 마감일 감사 — 근거 없는 마감이 늘지 않는다 (2026-09-17 · 노션 G-3)');
{
  process.env.DEADLINE_AUDIT_AS_LIB = '1';
  const DA = await import(new URL('./deadline-audit.mjs', import.meta.url));
  /* ① 문구에서 끝 날짜 — 발표·지급 날짜는 마감이 아니다 */
  eq('문구의 마지막 날짜를 끝으로 읽는다 (신청 2026.7.6 ~ 8.31)', DA.lastDateIn('신청 2026.7.6(월) ~ 8.31(월) 18:00', '2026'), '2026-08-31');
  eq('  발표 날짜는 마감이 아니다 (모집 ~2026.8.5 · 선발 발표 8.26)', DA.lastDateIn('모집 ~2026.8.5 · 선발 발표 8.26(수)', '2026'), '2026-08-05');
  eq('  해가 없으면 빌린다 (~9/18)', DA.lastDateIn('접수 ~9/18', '2026'), '2026-09-18');
  eq('  달이 거꾸로 가면 해가 넘어간 것이다 (12.20 ~ 1.10)', DA.lastDateIn('접수 2026.12.20 ~ 1.10', '2026'), '2027-01-10');
  eq('  소수는 날짜가 아니다 (평점 3.5 ~ 4.5)', DA.lastDateIn('접수 ~ 2026. 9. 18.(금) 18:00 · 평점 3.5 ~ 4.5', '2026'), '2026-09-18');
  eq('  날짜가 없으면 null', DA.lastDateIn('접수 기간 원문 확인', '2026'), null);
  /* ② 전수 — 톱니. 근거 없는 마감이 지금(4건)보다 늘면 빨간불.
        줄이면 천장을 내릴 것 · 올리려면 그 마감이 어디서 왔는지 먼저 적을 것. */
  const rows = DA.auditDeadlines(new Date('2026-09-17T00:00:00'));
  const noEvidence = rows.filter((r) => r.flags.some((f) => /근거를 못 찾음/.test(f)));
  eq(`근거 없는 마감이 3건을 넘지 않는다 (지금 ${noEvidence.length}건: ${noEvidence.map((r) => r.id).join(', ') || '없음'})`,
    noEvidence.length <= 3, true);
  const wrongLabel = rows.filter((r) => r.flags.some((f) => /화면 문구의 끝 날짜/.test(f)));
  eq('화면 문구의 끝 날짜와 마감이 어긋난 공고가 없다', wrongLabel.map((r) => `${r.id} ${r.deadline} vs 문구 「${r.period}」`), []);
  const farAway = rows.filter((r) => r.flags.some((f) => /1년 넘게/.test(f)));
  eq('등록일에서 1년 넘게 먼 마감이 없다', farAway.map((r) => r.id), []);
  /* ③ 마감이 있는 공고는 전부 ISO 날짜이고 실제로 있는 날이다 — 틀린 꼴은 dday 가 NaN 을 낸다 */
  const badIso = rows.filter((r) => r.deadline && !(/^\d{4}-\d{2}-\d{2}$/.test(r.deadline) && !Number.isNaN(new Date(r.deadline + 'T00:00:00').getTime())));
  eq('마감은 전부 YYYY-MM-DD 이고 달력에 있는 날이다', badIso.map((r) => `${r.id} ${r.deadline}`), []);
  /* ④ 자동 등록이 제목·요약에서 읽은 마감은 그 문구를 표식에 남긴다 — 근거 없는 마감이 더 생기지 않게 */
  const ar = readText(new URL('../collector/auto-register.mjs', import.meta.url));
  eq('자동 등록이 마감을 읽으면 그 문구를 deadlineFrom 에 남긴다', /deadlineFrom: `게시판 요약 · \$\{/.test(ar), true);
}

/* ── 2026-09-17 · OCR — 그림·스캔 첨부 글자 읽기 (개발자 지시 "직접 할 수 있으면 사용") ──
   무료 tesseract 로 글자층 없는 PDF·그림을 읽되 **품질 관문을 넘은 것만** `.ocr.txt` 로 남긴다.
   실측: 스캔 공고문 0.92~0.98 통과 · 포스터 0.41~0.86 탈락(39개 중 8개). 틀린 자격 줄은 못 읽는 것보다
   나쁘므로(원칙 8-1) 관문·글머리 기호 되돌림·AI 값 보호 셋이 이 절의 심장이다. */
console.log('\n■ OCR — 그림·스캔 첨부 글자 읽기 (2026-09-17)');
{
  const ocrSrc = readText(new URL('../collector/ocr-text.py', import.meta.url));
  eq('OCR 스크립트가 품질 관문을 가진다 (문서 한글 비율 0.9 · 살아남은 한글 200자)',
    /ACCEPT_RATIO = 0\.90/.test(ocrSrc) && /ACCEPT_HANGUL = 200/.test(ocrSrc), true);
  eq('  결과는 .ocr.txt 로만 남긴다 (.txt 면 pdf-text 의 "이미 뽑았다" 판정과 섞인다)',
    /\+ '\.ocr\.txt'/.test(ocrSrc) && !/path \+ '\.txt', 'w'/.test(ocrSrc), true);
  eq('  장부는 훑는 폴더 안에 둔다 (git add <폴더> 가 담는다 — 이슈 #79 유형)', /os\.path\.join\(root, LEDGER\)/.test(ocrSrc), true);
  eq('  tesseract 가 없으면 경고를 남긴다 (조용히 0개 금지)', /::warning::tesseract/.test(ocrSrc), true);
  /* 자가 검사 — 실제 OCR 출력 두 조각으로 관문이 살아 있는지(좋은 스캔은 남기고 포스터는 버리고
     글머리 기호 오독(`ㅁ`·`(2`)을 되돌린다). python3 은 워크플로 러너와 개발 컴퓨터에 다 있다. */
  const st = spawnSync('python3', ['collector/ocr-text.py', '--self-test'],
    { cwd: fileURLToPath(new URL('..', import.meta.url)), encoding: 'utf8' });
  eq('  자가 검사 통과', st.status === 0 && /"ok": true/.test(st.stdout || ''), true);
  /* 코드 리뷰(2026-09-17)가 잡은 자리 셋 — 반쪽 굳힘 · 장부 유실 · 관문 상수 변경 뒤 영영 건너뜀 */
  eq('  예산이 문서 중간에 바닥나면 반쪽을 굳히지 않는다 (Budget 예외)', /raise Budget\(/.test(ocrSrc) && /except Budget/.test(ocrSrc), true);
  eq('  파일마다 장부를 저장한다 (단계가 죽어도 남게)', (ocrSrc.match(/save_ledger\(root, ledger\)/g) || []).length >= 2, true);
  eq('  장부에 관문 판(gate)을 적어 상수가 바뀌면 다시 읽는다', /entry\.get\('gate'\) != GATE/.test(ocrSrc), true);
  eq('  바깥 명령의 대기 시간을 남은 예산으로 깎는다', /timeout=remaining\(deadline/.test(ocrSrc), true);
  /* 워크플로 — PDF 글자를 뽑는 로봇 전부가 OCR 도 돌리고, 설치 실패를 삼키지 않는다 */
  const wfs = fs.readdirSync(new URL('../.github/workflows', import.meta.url))
    .filter((f) => f.endsWith('.yml'))
    .map((f) => [f, readText(new URL('../.github/workflows/' + f, import.meta.url))]);
  eq('PDF 글자를 뽑는 워크플로 전부가 OCR 도 돌린다',
    wfs.filter(([, t]) => /ocr-text\.py/.test(t)).map(([f]) => f).sort(),
    wfs.filter(([, t]) => /pdf-text\.py/.test(t)).map(([f]) => f).sort());
  for (const [f, t] of wfs.filter(([, t]) => /ocr-text\.py/.test(t))) {
    eq(`  ${f} 가 tesseract-ocr-kor 를 설치한다 (안 하면 조용히 0개)`, /tesseract-ocr-kor/.test(t), true);
    eq(`  ${f} 가 설치 실패를 삼키지 않는다`, /tesseract-ocr-kor[^\n]*\|\|\s*true/.test(t), false);
    eq(`  ${f} 의 OCR 단계는 자기 예산 + continue-on-error 다 (보강 단계 규칙)`,
      /name: 그림·스캔 첨부 글자 읽기 \(OCR\)\n(?:\s+if:[^\n]*\n)?\s+timeout-minutes: \d+\n\s+continue-on-error: true/.test(t), true);
  }
  /* 읽는 쪽 — PDF·그림에서 .ocr.txt 만 읽는다(.pdf.txt 는 2026-08-20 결정대로 안 읽는다) */
  const at = readText(new URL('../collector/attachment-text.mjs', import.meta.url));
  eq('attachmentText 가 PDF·그림에서 .ocr.txt 를 읽고 .pdf.txt 는 안 읽는다',
    /\.ocr\.txt/.test(at) && !/'\.pdf\.txt'/.test(at), true);
  {
    const AT = await import(new URL('../collector/attachment-text.mjs', import.meta.url));
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ocr-'));
    const img = path.join(tmp, 'elig-x-1.png');
    fs.writeFileSync(img, 'not an image');
    eq('  .ocr.txt 가 없으면 빈 문자열(모른다)', AT.attachmentText(img), '');
    fs.writeFileSync(img + '.ocr.txt', '○ 전국 대학(원)생 (휴학생 제외)\n');
    eq('  있으면 그 글자', AT.attachmentText(img).trim(), '○ 전국 대학(원)생 (휴학생 제외)');
    const pdf = path.join(tmp, 'form-x-1.pdf');
    fs.writeFileSync(pdf, '%PDF-1.4');
    fs.writeFileSync(pdf + '.txt', '글자층 평점 3.0 이상');
    eq('  PDF 의 .pdf.txt 는 여전히 안 읽는다', AT.attachmentText(pdf), '');
    /* 코드 리뷰(2026-09-17): OCR 이 글자를 내기 시작하면 색인 순서(PDF 가 앞)만으로 HWP 를 이긴다 */
    eq('첨부 읽는 차례 — HWP·DOCX 가 OCR(PDF·그림)보다 먼저', AT.docOrder(['a.pdf', 'b.jpg', 'c.hwp', 'd.docx']), ['c.hwp', 'd.docx', 'a.pdf', 'b.jpg']);
    eq('  OCR 에서 온 글자인지 알 수 있다 (출처 표식용)', [AT.isOcrSource(img), AT.isOcrSource(pdf), AT.isOcrSource(path.join(tmp, 'x.hwp'))], [true, false, false]);
  }
  const exSrc2 = readText(new URL('../collector/extract-excerpts.mjs', import.meta.url));
  eq('발췌기가 그 차례로 읽고 OCR 출처를 「공고문 첨부(OCR)」로 적는다',
    (exSrc2.match(/docOrder\(/g) || []).length >= 2 && (exSrc2.match(/docLabel\(/g) || []).length >= 4 && /'공고문 첨부\(OCR\)'/.test(exSrc2), true);
  eq('  옛 표식을 지울 때 (OCR) 판도 같이 본다', /\/\^공고문 첨부\/\.test\(it\.eligibilityFrom/.test(exSrc2), true);
  eq('  금액 로봇도 같은 차례', /docOrder\(/.test(readText(new URL('../collector/extract-amounts.mjs', import.meta.url))), true);
  /* KOSAF 쪽 — 사본 정리가 장부를 지우지 않고, 빈 껍데기 판정이 .ocr.txt 도 연다 */
  eq('KOSAF 사본 정리가 재단 폴더만 지운다 (장부는 남긴다)', /isDirectory\(\)\) continue;/.test(readText(new URL('../collector/kosaf-attach.mjs', import.meta.url))), true);
  eq('  KOSAF 빈 껍데기 판정이 .ocr.txt 도 연다', /'\.ocr\.txt'/.test(readText(new URL('../collector/kosaf-empty.mjs', import.meta.url))), true);
  /* 🔴 무료 경로가 AI·관리자 값을 덮지 않는다 — OCR 을 붙인 첫 실행에서 의암 손병희의
     `AI(공고 포스터 그림)` 자격 줄이 거친 OCR 줄로 갈렸다(본문 없는 갈림길에 관문이 없었다). */
  const exSrc = readText(new URL('../collector/extract-excerpts.mjs', import.meta.url));
  eq('본문 없는 갈림길도 AI·관리자가 채운 자격을 덮지 않는다',
    /got\.length && WRITE && !humanOwned\(it\.eligibilityFrom\)/.test(exSrc), true);
}

/* ── 자격 묻기 — 채워도 판정이 안 바뀌는 줄에는 묻지 않는다 (2026-09-17 · 노션 AI-1) ──
   🔴 이 절이 이 기능의 심장이다. 적어도 안 풀리는 줄에 단추를 달면
      **학생이 적었는데 화면이 그대로다** — 묻지 않는 것보다 나쁘다.
   🔴 판정은 화면이 쓰는 `requirementMatch` 를 그대로 탐침해서 낸다. judgeCond 로
      바로 가면 경우별 분기·표 라벨·선택지 묶음 관문을 건너뛴다(사전 점검에서 실제로
      `신입생:` 줄이 재학생에게 '평점을 물어라'를 냈다).
   ⚠️ 아래 줄과 기대값은 **실제로 재서 얻은 것**이다(2026-09-17). 지어내지 말 것.
      기대값이 안 맞으면 코드를 의심하기 전에 이 값을 다시 재 볼 것. */
console.log('\n■ 자격 묻기 — 무엇을 물을 수 있나');
{
  const EA = createRequire(import.meta.url)('../elig-ask.js');
  /* 온보딩 선택 칸을 하나도 안 채운 학생 — 필수(학교·캠퍼스·학년·학적)만 있다 */
  const bare = { school: '경희대학교', campus: '서울', year: 3, status: '재학' };
  const sch = { id: 't', name: '두을장학재단', provider: '두을장학재단' };
  const L45 = '26년 정규 1학기를 총 15학점 이상 이수하고, 성적을 3.5/4.5 이상 취득한 자';

  eq('평점과 이수학점을 묻는다 (4.5 만점으로 적힌 줄)',
    EA.askableFields(L45, bare, sch), ['gpa', 'credits']);

  /* 🔴 되돌림 방지 — 백분위 성적은 평점을 적어도 그 줄이 안 풀린다(줄이 풀리려면
     조건이 **전부** 풀려야 하는데 환산 조건이 막혀 있다). 학점만 묻는 것이 맞다. */
  eq('백분율환산 줄에서는 평점을 묻지 않는다 (학점만)',
    EA.askableFields('학기별 최소 9학점 이상 이수하고 평점평균(백분율환산)이 85점 이상인 자', bare, sch),
    ['credits']);

  /* 🔴 되돌림 방지 — 재학생에게 `신입생:` 줄은 영영 판정되지 않는다 */
  eq('내 경우가 아닌 분기 줄은 묻지 않는다',
    EA.askableFields('신입생: 2026년 1학기 85점 이상', bare, sch), []);

  eq('자격이 아닌 줄은 묻지 않는다 (접수 주소)',
    EA.askableFields('[13620] 경기도 성남시 분당구 구미로 173번길 82 분당서울대학교병원 2동 7층', bare, sch), []);
  eq('절 제목은 묻지 않는다', EA.askableFields('2. 신청자격', bare, sch), []);

  eq('소득구간을 묻는다',
    EA.askableFields('한국장학재단 학자금 지원구간 8구간 이내인 자', bare, sch), ['bracket']);
  eq('국적을 묻는다',
    EA.askableFields('대한민국 국적을 가진 자에 한함', bare, sch), ['nationality']);

  /* 🔴 이미 채운 칸은 다시 묻지 않는다 — 남은 칸만 묻는다 */
  eq('이미 적은 칸은 묻지 않는다 (남은 칸만)',
    EA.askableFields(L45, { ...bare, gpa: 4.0 }, sch), ['credits']);
  eq('  둘 다 적었으면 물을 것이 없다 (판정이 났으므로)',
    EA.askableFields(L45, { ...bare, gpa: 4.0, credits: 15 }, sch), []);

  /* 🔴 이미 **미달**로 판정된 줄에도 묻지 않는다 — 단추를 달면 이미 답이 난 줄에
     또 적으라고 하는 것이다. (판정 유무로 보지 'ok' 인지로 보지 않는다)
     ⚠️ 여기서 평점만 적어도 판정이 끝난다 — 확신 높은 미달은 나머지 조건을 안 보고
        그 자리에서 'no' 다. 그래서 학점을 안 적었는데도 물을 것이 없다(실측). */
  eq('미달로 판정된 줄에도 묻지 않는다', EA.askableFields(L45, { ...bare, gpa: 2.0 }, sch), []);
  eq('  학점을 안 적었어도 마찬가지다', EA.askableFields(L45, { ...bare, gpa: 3.42 }, sch), []);

  /* ── 칸의 이름·단위 ─────────────────────────────────────────────
     🔴 칸 이름이 온보딩(app.js collectProfile)과 갈라지면 시트가 엉뚱한 칸에
        저장하고 판정은 영영 안 바뀐다. 사람이 기억하는 대신 소스를 대조한다. */
  eq('물을 수 있는 칸에는 전부 이름표가 있다',
    Object.keys(EA.FIELD_PROBE).filter((f) => !EA.FIELD_META[f]), []);
  eq('  이름표만 있고 탐침이 없는 칸은 없다 (물을 수 없는 칸을 화면에 그리지 않는다)',
    Object.keys(EA.FIELD_META).filter((f) => !EA.FIELD_PROBE[f]), []);

  {
    const appJs = readText(new URL('../app.js', import.meta.url));
    const at = appJs.indexOf('function collectProfile()');
    const body = appJs.slice(at, at + 2600);
    const made = new Set([...body.matchAll(/^\s{4}([A-Za-z_$][\w$]*):/gm)].map((m) => m[1]));
    eq('FIELD_META 의 칸 이름이 전부 온보딩이 만드는 칸이다',
      Object.keys(EA.FIELD_META).filter((k) => !made.has(k)), []);
  }

  /* 입력 문자열 → 프로필 값. 🔴 못 읽으면 0 이 아니라 null 이다(모르면 판정하지 않는다) */
  eq('평점은 숫자로 바뀐다', EA.coerceField('gpa', '3.42'), 3.42);
  eq('  빈 칸은 null', EA.coerceField('gpa', '  '), null);
  eq('  글자는 null (0 이 아니다)', EA.coerceField('gpa', '몰라요'), null);
  eq('  4.5 를 넘으면 4.5 로 깎는다 (온보딩과 같은 규칙)', EA.coerceField('gpa', '5.0'), 4.5);
  eq('  음수는 0 으로', EA.coerceField('gpa', '-1'), 0);
  eq('소득구간은 정수', EA.coerceField('bracket', '8'), 8);
  eq('  0 은 null 이 아니다 (0 구간·0 학점은 유효한 값이다)', EA.coerceField('credits', '0'), 0);

  /* 공고 단위로 모은다 — 같은 칸을 두 번 담지 않는다 */
  {
    const many = { id: 't', name: '두을장학재단', provider: '두을장학재단', eligibilityLines: [
      L45,
      '직전 학기 평점 3.0 이상인 자',
      '대한민국 국적을 가진 자에 한함',
    ] };
    eq('공고의 자격 줄 전부에서 모으고 중복은 뺀다',
      EA.askableForSch(many, bare), ['gpa', 'credits', 'nationality']);
    eq('  자격 줄이 없는 공고에서도 죽지 않는다 (층2·상시 제도)',
      EA.askableForSch({ id: 'k', name: '상시' }, bare), []);
  }
}

/* ── 링크 사냥꾼 — 앱 이름과 게시판 제목이 달라도 찾는다 (2026-09-18) ──
   🔴 실측: 한국외대 6건이 `목록에서 못 찾음` 4회로 likelyGone 처리됐는데, 게시판에
      그 글이 **멀쩡히 있었다**. 앱 이름(사람이 다듬음)과 행 글자가 달라 지문이 안 맞은 것이다.
   🔴 **느슨하게 풀면 안 된다** — 예전에 `복지장학금 (서울캠퍼스)` 가 `(다빈치캠퍼스)`
      공고에 붙었다. 딱 하나일 때만, 캠퍼스가 어긋나면 버린다. */
console.log('\n■ 링크 사냥꾼 — 알맹이 낱말로 한 번 더 찾기');
{
  const HUFS = '[공통][교내] 2026학년도 2학기 면학장학금 신청 안내';
  eq('앱 이름에서 장학금 이름만 집는다', titleCore('면학장학금 (한국외대 교내)'), '면학장학금');
  eq('  학기·연도·「신청 안내」는 알맹이가 아니다', titleCore(HUFS), '면학장학금');
  eq('지문이 안 맞아도 알맹이로 찾는다 (실제로 못 찾던 줄)',
    !sameTitle('면학장학금 (한국외대 교내)', HUFS)
      && !!rowByCore('면학장학금 (한국외대 교내)', [{ t: HUFS }, { t: '[공통][교내] 2026-2학기 가족장학금 신청 안내' }]),
    true);
  eq('  여럿이면 지어내지 않는다',
    rowByCore('면학장학금 (한국외대 교내)', [{ t: HUFS }, { t: '2025 면학장학금 안내' }]), null);
  eq('  캠퍼스가 어긋나면 버린다 (복지장학금 사고)',
    rowByCore('복지장학금 (서울캠퍼스)', [{ t: '[다빈치캠퍼스] 복지장학금 안내' }]), null);
  eq('  같은 캠퍼스면 고른다',
    !!rowByCore('복지장학금 (서울캠퍼스)', [{ t: '[서울캠퍼스] 복지장학금 안내' }]), true);
  eq('  알맹이가 짧으면 안 고른다 (우연히 겹친다)',
    rowByCore('장학 (안내)', [{ t: '아무 장학 공고' }]), null);
}

/* ── 처지(trait) — 프로필에 칸이 없던 개인 사정 (2026-09-18 · 노션 AI-1) ──
   개발자 지시: *"평점 말고 개인적인 부분들 있잖아 뭐 예를들면 스님인지 그런거"*.
   실측으로 개인 처지를 말하는 자격 줄 75개 중 68개를 못 풀고 있었다 — 층2를 안 봐서가
   아니라(층2도 eligibilityLines 를 갖는다) 그런 **칸 자체가 프로필에 없어서**였다.
   🔴 `flags` 와 같은 모양이다 — 파서가 종류를 내고 judgeCond 가 프로필을 본다. */
console.log('\n■ 처지 요건 — 프로필에 칸이 없던 개인 사정');
{
  const EA = createRequire(import.meta.url)('../elig-ask.js');
  const MEt = createRequire(import.meta.url)('../match-engine.js');
  const PRq0 = createRequire(import.meta.url)('../parse-requirements.js');
  const sch = { id: 't', name: '테스트재단', provider: '테스트재단' };
  const base = { school: '한국외국어대학교', campus: '서울', year: 3, status: '재학', flags: [] };
  const v = (line, traits) => MEt.requirementMatch(line, { ...base, traits }, sch);

  /* 실제 원문 줄이다 — 지어내지 말 것 */
  const GED = '2026년 시행된 중졸 또는 고졸 검정고시를 합격한 자';
  eq('안 물어봤으면 판정하지 않는다', v(GED, undefined), null);
  eq('  「예」 면 충족', v(GED, { ged: true }), 'ok');
  eq('  「아니요」 면 미달', v(GED, { ged: false }), 'no');

  /* 🔴 **일부만 답한 상태에서 미달을 내지 않는다** — 한 줄이 여러 처지를 말할 때
     안 물어본 갈래 때문에 틀린 ✕ 가 된다. 틀린 미달은 못 받는 것보다 나쁘다. */
  const MANY = '군 복무를 마쳤거나 봉사활동 실적이 있는 자';
  eq('여러 처지를 말하는 줄 — 하나만 「아니요」 면 판정하지 않는다',
    v(MANY, { military: false }), null);
  eq('  전부 「아니요」 여야 미달이다', v(MANY, { military: false, volunteer: false }), 'no');
  eq('  하나라도 「예」 면 충족', v(MANY, { military: true }), 'ok');

  /* 🔴 **징계는 어느 칸에 있든 「있으면 미달」이다** (2026-09-19 실측으로 잡은 틀린 미달).
     자격 칸에 **부정문**으로 적히는 일이 흔하다 — `교내 징계처분을 받지 않은 학생`.
     이것을 보통 처지처럼 읽으면 「징계 없음」이라고 답한 학생이 **미달**이 된다.
     ⚠️ 부정어 사정거리를 새로 만들어 풀지 말 것 — 층2의 `○` 묶음 줄에서 절 경계가 새
     `… 3위 이내 입상자 (미술 분야 공모전 … 제외)` 가 「수상하면 미달」이 된다(실측 2줄).
     장학금이 **징계 받았을 것을 요구하는 일은 없으므로** 종류 자체를 결격으로 둔다. */
  const DISC = '다 . 교내 징계처분을 받지 않은 학생';
  eq('징계 — 자격 칸의 부정문에서 「없음」이 충족이다', v(DISC, { discipline: false }), 'ok');
  eq('  「있음」이면 미달', v(DISC, { discipline: true }), 'no');
  eq('  안 물어봤으면 판정하지 않는다', v(DISC, undefined), null);
  const DISC_X = '3) 공고일 현재 정학, 퇴학 등 징계 처분을 받은 학생은 제외';
  eq('  같은 줄이 제외 문구로 적혀 있어도 뜻이 같다', v(DISC_X, { discipline: false }), 'ok');

  /* 🔴 **제외 칸에서는 결격 처지만 미달을 낸다** (2026-09-19 코드 리뷰 · 전수 24줄 중 9줄이
     틀린 미달이었다). 제외 칸 줄에 처지 낱말이 있다고 '그 처지면 탈락'이 아니다 — 층2는
     한 줄에 `○` 로 여러 조항이 뭉쳐 있어 낱말이 어느 조항에 속하는지 알 수 없다. */
  const exFail = (line, traits) => {
    const { conds } = PRq0.parseLine(line, true);
    return conds.filter((c) => c.conf === PRq0.HIGH && c.kind === 'trait')
      .some((c) => MEt.judgeCond(c, { ...base, traits }, {}) === 'fail');
  };
  eq('제외 칸 — 수상자를 「중복 수혜 불가」 로 떨어뜨리지 않는다',
    exFail('○ 동일한 수상실적으로 중복 수혜 불가', { award: true }), false);
  eq('  대출자를 「초과시 제외」 로 떨어뜨리지 않는다',
    exFail('○ 학자금대출과 타 장학금이 해당 학기 등록금을 초과시 제외', { loan: true }), false);
  eq('  긍정문이 제외 칸에 있어도 뒤집지 않는다 (군필 미달 사고)',
    exFail('○ 남성의 경우 병역을 마쳤거나 면제인 자만 지원가능', { military: true }), false);
  eq('  징계는 제외 칸에서 그대로 미달이다', exFail('① 징계받은 자 또는 징계 의결 중인 자', { discipline: true }), true);

  /* 🔴 **물어서 답을 받은 성취는 빗장이 풀린다** — 안 풀면 「예」가 무의미하고 「아니요」만
     미달을 만든다(실측: 수상 15줄 중 12줄). ⚠️ 물을 칸이 없는 낱말이 남으면 그대로 막힌다. */
  const AWARD = '예술‧체육‧과학‧기능 분야의 전국규모 이상 대회에서 3위 이상 수상실적이 있는 자';
  eq('성취를 물어서 답했으면 충족이 된다', v(AWARD, { award: true }), 'ok');
  eq('  안 물어봤으면 그대로 모른다', v(AWARD, undefined), null);
  eq('  「아니요」 면 미달', v(AWARD, { award: false }), 'no');
  eq('  물을 칸이 없는 낱말이 섞이면 풀지 않는다 (추천서)',
    v('학교장의 추천을 받고 대회에서 3위 이상 수상실적이 있는 자', { award: true }), null);

  /* 🔴 **어느 답으로도 충족이 될 수 없으면 묻지 않는다** — 자기를 떨어뜨리는 것밖에
     못 하는 단추를 학생에게 주지 않는다. */
  const ONEWAY = '학교장의 추천을 받고 대회에서 3위 이상 수상실적이 있는 자';
  eq('답해서 나아질 수 없는 처지는 묻지 않는다',
    EA.askableFields(ONEWAY, base, sch).filter((k) => k === 'trait:award'), []);

  /* 🔴 넓히려다 되돌린 넷 — 다시 넓히면 여기서 걸린다 (경위는 설계 문서 12절) */
  const kindsOf = (t) => (PRq0.parseLine(t, false).conds
    .filter((c) => c.kind === 'trait' || c.kind === 'flags').flatMap((c) => c.anyOf));
  eq('지역 학사(재사생·학숙)는 학교 기숙사가 아니다',
    kindsOf('○ 공고일 기준 학숙생활 3개월 이상인 전남학숙 재사생').includes('dorm'), false);
  eq('  맨 `병역` 으로 넓히지 않는다',
    kindsOf('○ 남성의 경우 병역을 마쳤거나 면제인 자만 지원가능').includes('military'), false);
  eq('  `시정유공자`·`새마을 유공자` 는 국가유공자가 아니다',
    kindsOf('○ 시정유공자로 시장의 포상을 받은 본인 또는 자녀').includes('merit'), false);
  eq('  `국가보훈등록증`·`참전유공자` 는 맞다',
    kindsOf('○ 6.25 참전유공자 후손(고손/증손/손자/자녀)').includes('merit'), true);
  eq('  `셋째 이상` 은 「둘째 이상 자녀」 칸으로 답할 수 없다',
    kindsOf('○ 반값등록금 대상자 중 셋째 이상 자녀').includes('birthOrder'), false);
  eq('  `산업재해` 는 재난·재해 피해가 아니다',
    kindsOf('○ 산업재해 및 기타사유로 가정생활이 어려운 근로자').includes('disaster'), false);

  /* 종류와 이름표가 갈라지면 화면에 못 그린다 */
  const PRq = createRequire(import.meta.url)('../parse-requirements.js');
  eq('결격 처지는 파서가 아는 종류여야 한다',
    [...PRq.TRAIT_DISQUALIFY].filter((k) => !PRq.TRAIT_PAT.some(([x]) => x === k)), []);
  eq('파서의 처지 종류에 전부 이름표가 있다',
    PRq.TRAIT_PAT.map(([k]) => k).filter((k) => !EA.TRAIT_LABEL[k]), []);
  eq('  이름표만 있고 파서가 모르는 종류는 없다',
    Object.keys(EA.TRAIT_LABEL).filter((k) => !PRq.TRAIT_PAT.some(([x]) => x === k)), []);

  /* 🔴 말은 **명사형**이다 (2026-09-18 개발자 지시) — 다른 칸(`평점`)과 같은 결이어야 한다 */
  eq('이름표가 묻는 문장이 아니다 (명사형)',
    Object.values(EA.TRAIT_LABEL).filter((t) => /[?？]|나요|습니까|하셨|인가요/.test(t)), []);

  /* 물을 수 있는 칸으로 잡히는가 — 화면이 이걸 보고 그린다 */
  eq('처지를 물을 칸으로 내놓는다',
    EA.askableFields(GED, base, sch), ['trait:ged']);
  eq('  이미 답했으면 다시 묻지 않는다',
    EA.askableFields(GED, { ...base, traits: { ged: true } }, sch), []);
}

/* ── 2026-09-19 · 실시간 공고가 장학금 탭에 올라오는가 (개발자 지적 "로봇 문제 수정") ──
   실측: 경희·한국외대 공고 52건 중 **33건이 정식 등록에 못 갔고**, 그중 13건은 틀린 판정이었다.
   원인 둘 — 둘 다 `skip` 이라 리포트에 한 줄도 안 남아 **몇 주 동안 아무도 몰랐다**.
     ① `POSITIVE` 가 `장학생|장학금` 두 낱말만 봐서, 이름이 `장학` 으로 끝나는 **교내 장학금**
        (반영장학·우정장학·경희꿈도전장학)과 `선원가족장학사업` 이 통째로 떨어졌다.
     ② 중복 판정이 제 사본(4-gram ≥ 0.55)이라 붙박이 말이 다인 짧은 등록명이 아무거나 다 잡았다 —
        경주시장학회↔동산장학회, 한원↔양천, 금신사랑↔익산사랑 …
   🔴 규칙을 여기에 베끼지 않는다 — 로봇 소스에서 읽고, 중복 판정은 공용 파일 것을 그대로 부른다. */
console.log('\n■ 실시간 공고 → 장학금 탭 (자동 등록 판정 · 2026-09-19)');
{
  const src = readText(new URL('../collector/auto-register.mjs', import.meta.url));

  /* ① 장학 신호 — 로봇이 쓰는 그 정규식으로 실제 게시판 제목을 잰다 */
  const mPos = src.match(/const POSITIVE = (\/.*\/);/);
  eq('로봇에 장학 신호 규칙(POSITIVE)이 있다', !!mPos, true);
  if (mPos) {
    const POS = eval(mPos[1]);
    /* 전부 **실제로 게시판에 올라왔고 떨어졌던 제목**이다 */
    const mustPass = [
      '공통 [공통] 2026학년도 2학기 반영장학 신청 안내',
      '공통 [공통] 2026학년도 2학기 우정장학(학업장려금) 신청 안내',
      '공통 [공통] 2026학년도 2학기 우정장학(가계곤란) 복학생/재입학생 신청 안내',
      '공통 [공통] 2026학년도 2학기 경희꿈도전장학 신청 안내',
      '[공통][교외] 2026년 2학기 선원가족장학사업 선발 안내',
    ];
    eq('이름이 `장학` 으로 끝나는 교내 장학금을 장학 공고로 본다', mustPass.filter((t) => !POS.test(t)), []);
    /* 🔴 넓히기만 하면 안 된다 — 장학이 아예 없는 이자지원은 그대로 걸러져야 한다 */
    eq('  학자금 이자지원은 여전히 장학 신호가 아니다',
      ['공통 2026년 상반기분 통영시 대학생 학자금 이자 지원 공고(안)',
        '[공통][대출] 2026년 하반기분 통영시 대학생 학자금 이자 지원 공고(~3/25)'].filter((t) => POS.test(t)), []);
  }

  /* ②-1 넓히기와 **한 세트**인 조이기 — 뽑고 난 뒤의 공지가 장학금 카드가 되면 안 된다.
     🔴 `/장학/` 만 넓히고 이 줄을 빼면 행정 공지 열둘이 학생 화면에 나간다(실측 candidates.json). */
  {
    const grab = (n) => { const m = src.match(new RegExp(`const ${n} = (/[^\\n]*/[a-z]*);`)); return m ? eval(m[1]) : null; };
    const [ADMIN, EVENT] = [grab('ADMIN_NOTICE'), grab('EVENT')];
    eq('로봇에서 행정 공지·행사 규칙을 찾았다', !!ADMIN && !!EVENT, true);
    if (ADMIN && EVENT) {
      const 행정 = [
        '2026학년도 2학기 성적우수장학 선발 결과 확인 안내',
        '공지 공지 2026-2학기 동국인재육성장학 선발 및 결과발표 안내 2026.08.13. 조회 283',
        '[공통] └ RE:(생활비)2026년 (재)광진복지재단 미래도약 장학지원 사업 선발결과 안내',
        '[장학] 2026학년도 2학기 교내장학 선발 포기 신청 안내 공고',
        '[국가근로] 2026학년도 2학기 국가근로장학 희망근로지 신청(1차) 및 신청방법 변경 안내',
        '[장학] 2026학년도 2학기 국가·교내장학 이중선발자 최종 수혜 장학 선택 안내 공고',
        '[학생지원팀]2026학년도 2학기 국가근로장학 선발 관련 필수사항 안내',
        '2026학년도 2학기 국가근로장학사업 관련 절차 및 선발 여부 확인 방법 등 안내',
        '[장학안내] 2026학년도 대학생 청소년AI교육지원사업 멘토 선발자 공고',
      ];
      eq('뽑고 난 뒤의 공지를 신청 공고로 보지 않는다', 행정.filter((t) => !ADMIN.test(t)), []);
      eq('  캠프·서포터즈는 행사다',
        ['[학부-교외장학] 2026년 한국전력기술주식회사 PES Summer Camp (34기) 참가 대학생 선발 안내',
          '2026년 통일과나눔 재단 통일축제 서포터즈 모집 안내'].filter((t) => !EVENT.test(t)), []);
      /* 🔴 조이기가 진짜 모집 공고를 잡아가면 안 된다 — 넓힌 뜻이 사라진다 */
      eq('  진짜 모집 공고는 그대로 통과한다',
        ['공통 [공통] 2026학년도 2학기 반영장학 신청 안내',
          '공통 [공통] 2026학년도 2학기 우정장학(가계곤란) 복학생/재입학생 신청 안내',
          '서울 [서울C] 2026학년도 2학기 남순자인재양성장학 선발 안내(~8/21까지)',
          '[공통][교외] 2026년 2학기 선원가족장학사업 선발 안내'].filter((t) => ADMIN.test(t) || EVENT.test(t)), []);
    }
  }

  /* ②-2 중복 판정은 감사와 같은 파일을 쓴다 (베끼면 또 갈라진다) */
  eq('로봇이 공용 중복 판정을 가져다 쓴다',
    /isDuplicatePair \} = createRequire|checkEntry, isDuplicatePair \}/.test(src) && /isDuplicatePair\(\{ name: bare\(title\)/.test(src), true);
  eq('  제 사본(titleSim)을 다시 들이지 않는다', /function titleSim/.test(src), false);
  {
    const { isDuplicatePair } = createRequire(import.meta.url)('./entry-rules.cjs');
    /* 🔴 꼬리표 떼는 규칙은 **로봇 소스에서 떼어 온다** — 여기에 베끼면 로봇만 바뀌어도 관문이 모른다 */
    const mBare = src.match(/const bare = \(s\) => \(s \|\| ''\)\.replace\((\/.*?\/g), ''\);/);
    eq('로봇에서 꼬리표 떼는 규칙을 찾았다', !!mBare, true);
    const TAG = mBare ? eval(mBare[1]) : /$^/;
    const bare = (s) => (s || '').replace(TAG, '');
    const dup = (a, b) => isDuplicatePair({ name: bare(a), eligibility: {} }, { name: bare(b), eligibility: {} });

    /* 🔴 떼는 것은 **꼬리표뿐**이다 — 괄호 안이 이름의 일부면 남겨야 한다.
       통째로 떼자 경희대의 서로 다른 두 장학금이 한 장학금이 됐다(실측으로 하나가 사라졌다). */
    eq('접수·학기·날짜 꼬리표는 뗀다',
      [bare('양천장학회 장학금 (한국외대 접수, 2026 후기)'), bare('[공통][교외] 2026년 고속도로 장학생 선발(~10/11)')],
      ['양천장학회 장학금 ', '[공통][교외] 2026년 고속도로 장학생 선발']);
    eq('  이름의 일부인 괄호는 남긴다',
      [bare('우정장학(학업장려금) 신청 안내'), bare('정영오(Luke) 장학금')],
      ['우정장학(학업장려금) 신청 안내', '정영오(Luke) 장학금']);

    /* 전부 실제 게시판 제목 ↔ 실제 등록명이다. 왼쪽은 **등록된 적도 없는** 별개 사업이었다. */
    const 별건 = [
      ['[공통][교외]2026-2학기 정영오(Luke) 장학금 장학생 모집안내', '[공통][교외]2026년도 2학기 이백장학금 장학생 모집(9/7~9/15)'],
      ['공통 2026년 (재)경주시장학회 장학생 선발 안내', '동산장학회 장학생 (이공계 새터민 대상)'],
      ['[공통][교외]2026년도 (재)포항시장학회 장학생 선발공고', '동산장학회 장학생 (이공계 새터민 대상)'],
      ['[공통][교외] 2026학년도 여성동문회 장학금 장학생 모집', '총동문회 장학금 (한국외대, 2026-2학기)'],
      ['[글로벌][교외] 2026-2학기 한원장학회 장학금 신청 안내', '양천장학회 장학금 (한국외대 접수, 2026 후기)'],
      ['공통 2026년 금신사랑장학생 선발 안내', '공통 2026년도 익산사랑 장학생 선발 안내'],
      ['공통 2026년도 하반기 울산연구원 장학생 선발 안내', '공통 2026년도 익산사랑 장학생 선발 안내'],
      // 같은 학교의 **다른** 장학금 — 괄호를 통째로 떼면 여기서 하나가 사라진다
      ['공통 [공통] 2026학년도 2학기 우정장학(가계곤란) 복학생/재입학생 신청 안내', '공통 [공통] 2026학년도 2학기 우정장학(학업장려금) 신청 안내'],
    ];
    eq('이름만 비슷한 남의 사업을 "동일 사업"이라 부르지 않는다',
      별건.filter(([a, b]) => dup(a, b)).map(([a]) => a.slice(0, 30)), []);
    eq('  진짜 재게시는 그대로 중복으로 본다',
      [['[서울][국가근로] 2026학년도 2학기 국가근로장학생 모집 안내(추가)', '[서울][국가근로] 2026학년도 2학기 국가근로장학생 모집 안내'],
        ['공통 제36기 미레에셋 해외교환 장학생 선발', '공통 제36기 미레에셋 해외교환 장학생 선발 안내'],
        ['[공통][국가] 2026-2학기 고졸후학습자(희망사다리2유형) 장학금 신청(~9/17)', '[공통][국가]2026년 2학기 고졸 후학습자 장학금 신청안내'],
        ['공통 2026년 고속도로 장학생 선발 안내', '[공통][교외] 2026년 고속도로 장학생 선발(~10/11)']]
        .filter(([a, b]) => !dup(a, b)).map(([a]) => a.slice(0, 30)), []);
  }

  /* ③ 거른 이유를 리포트에 남긴다 — 이 사고가 오래간 이유가 '조용해서'였다 */
  eq('거른 공고를 이유별로 세어 리포트에 적는다',
    /거른 공고 \$\{total\}건/.test(src) && /skipped\.set\(/.test(src), true);
  eq('  막아 둔 공고·같은 id 도 집계에 들어간다',
    /사람이 막아 둔 공고/.test(src) && /이미 등록\(같은 id\)/.test(src), true);
  eq('  상한에 걸려 안 본 공고는 거른 것과 따로 적는다', /unseen/.test(src) && /보지 않았어요/.test(src), true);

  /* ④ 마감 — `(~ 9. 18)` 처럼 띄어 쓴 꼴은 읽고, **달력에 없는 날은 비운다** */
  const mDl = src.match(/hay\.match\((\/~\\s\*.*?\/)\);/);
  eq('연도 없는 마감 규칙을 찾았다', !!mDl, true);
  if (mDl) eq('  점 뒤에 빈칸이 있어도 마감으로 읽는다', eval(mDl[1]).test('여성동문회 장학금 장학생 모집 (~ 9. 17)'), true);
  {
    /* 🔴 2자리 연도 `~ 26. 9. 10.` 을 **달 26일**로 읽던 것(실측 16건). 그 `2026-26-09` 는
       글자 비교라 마감 경과를 통과하고, entry-rules 의 날짜 꼴 검사도 통과하며, 앱에서
       `Invalid Date` 가 돼 카드에 `D-NaN` 이 뜨고 **영영 안 사라진다**. */
    const mOk = src.match(/const okDate = ([\s\S]*?\n\};)/);
    eq('로봇에 날짜 실재 검사(okDate)가 있다', !!mOk, true);
    if (mOk) {
      const okDate = eval(`(${mOk[1].replace(/;\s*$/, '')})`);
      eq('  달력에 없는 날은 마감으로 쓰지 않는다',
        [okDate('2026', 26, 9), okDate('2026', 2, 31), okDate('2026', 0, 5)], [null, null, null]);
      eq('  진짜 날짜는 그대로 쓴다', okDate('2026', 9, 30), '2026-09-30');
    }
    /* 🔴 함수가 있는 것만 보면 **호출을 지워도 초록**이다 (만들면서 실제로 그랬다).
       마감을 내놓는 두 갈래(4자리 연도 · 연도 없는 꼴)가 둘 다 이 검사를 거쳐야 한다. */
    eq('  마감을 내놓는 두 갈래가 모두 그 검사를 거친다',
      (src.match(/const iso = okDate\(/g) || []).length, 2);
  }
}

/* ── 2026-09-20 · 학교가 스스로 운영하는 장학 제도는 '교내'다 (개발자 지시) ──
   *"그 셋이 대체 왜 교외에 있었는지 모르겠으며 교내로 바꾸고 재발하지 않도록 해줘."*
   원인: 판정이 **제목에 `교내` 라고 적혀 있을 때만** 교내라고 부르는데, 학교는 제 게시판에
   그 글자를 안 쓴다. 직접 열어 보니 게시판에도 근거가 없었다 — 게시판 하나 · 분류 칸은 캠퍼스 ·
   작성자는 전부 학생지원센터 · `[공통]` 은 교외인 두을장학재단도 달고 있다.
   그래서 **원문을 한 번 읽고 이름표를 적어 두는** 방식이다(근거는 docs/designs/on-campus-programs.md).
   🔴 규칙을 여기에 베끼지 않는다 — match-engine 에서 불러 쓴다. */
console.log('\n■ 학교가 스스로 운영하는 장학 제도 (2026-09-20)');
{
  const { noticeKind, OWN_PROGRAMS } = createRequire(import.meta.url)('../match-engine.js');
  eq('공용 엔진이 학교별 제도 이름표를 내보낸다', !!OWN_PROGRAMS && !!OWN_PROGRAMS['경희대학교'], true);

  /* 전부 **실제로 게시판에 올라온 제목**이고, 넷은 원문으로 교내임을 확인했다 */
  const 교내 = [
    '공통 [공통] 2026학년도 2학기 반영장학 신청 안내',
    '공통 [공통] 2026학년도 2학기 우정장학(학업장려금) 신청 안내',
    '공통 [공통] 2026학년도 2학기 우정장학(가계곤란) 복학생/재입학생 신청 안내',
    '공통 [공통] 2026학년도 2학기 경희꿈도전장학 신청 안내',
  ];
  eq('경희대가 직접 주는 장학금은 교내다', 교내.filter((t) => noticeKind(t, '경희대학교') !== '교내'), []);

  /* 🔴 같은 게시판·같은 작성자·같은 `[공통]` 표식을 단 교외 공고가 섞여 들면 표가 너무 넓은 것이다 */
  const 교외 = [
    '공통 [공통] 두을장학재단 제29기 장학생 모집',
    '공통 푸른등대 한국수력원자력 k-원전 장학금 신청안내 (9.11~9.28)',
    '공통 2026년 (재)경주시장학회 장학생 선발 안내',
    '서울 [서울C] 2026학년도 2학기 하나금융나눔재단 하나장학생 선발 안내',
    '공통 2026학년도 2학기 선원가족 장학생 모집 안내',
  ];
  eq('  같은 게시판의 외부 재단 공고는 그대로 교외다', 교외.filter((t) => noticeKind(t, '경희대학교') !== '교외'), []);

  /* 🔴 표는 **학교별**이다 — 다른 학교 게시판의 같은 낱말은 외부 재단일 수 있다 */
  eq('  다른 학교 제목에는 그 표를 쓰지 않는다',
    noticeKind('2026학년도 2학기 반영장학 신청 안내', '한국외국어대학교'), '교외');
  eq('  학교를 모르면 예전처럼 표식만 본다',
    [noticeKind('2026학년도 2학기 반영장학 신청 안내'), noticeKind('[교내] 가족장학금 신청')], ['교외', '교내']);

  /* 🔴 `교내외` 는 둘 다라 교내가 아니다 — 2026-09-18 규칙이 살아 있는지 */
  eq('  `교내외` 는 여전히 교내가 아니다', noticeKind('교내외 장학금 통합 안내', '경희대학교'), '교외');

  /* 🔴 **앱 화면(`boardNoticesInSchool`)에는 이 표를 쓰지 않는다** — 2026-09-18 결정
     *"표식 없는 것까지 낱말로 맞히려 하지 말 것"* 이 거기서는 그대로 살아 있다. 실제로 써 봤더니
     경희대 게시판의 `⭐중요⭐ 2026-2학기 국가장학금(2차) 및 복학생 우정장학(가계곤란) 신청 안내`
     가 '교내' 칸에 떴다 — **국가장학금 공지를 교내라고 부르는** 09-18 사고 그대로다.
     등록 로봇은 그 제목을 `국가장학금` 규칙으로 이미 거르므로, 표는 **등록 단계에서만** 쓴다. */
  const arSrc = readText(new URL('../collector/auto-register.mjs', import.meta.url));
  const appSrc = readText(new URL('../app.js', import.meta.url));
  eq('로봇이 학교를 같이 넘긴다', /type: noticeKind\(title, n\.school\)/.test(arSrc), true);
  eq('  앱의 게시판 글 판정은 표식만 본다 (표를 쓰지 않는다)',
    /noticeKind\(n\.title\) === '교내'/.test(appSrc), true);
  eq('  그 합성 제목은 등록 단계에서 걸러진다 (국가장학금 규칙)',
    /if \(\/국가장학금\/\.test\(t\)\) return \{ verdict: 'skip'/.test(arSrc), true);

  /* 소급 — 이미 등록된 것을 현재 규칙으로 다시 잰다. 🔴 이게 '재발 방지'의 실체다:
     규칙만 고치면 `type` 은 등록할 때 정해진 채 안 바뀐다.
     🔴 **글자가 아니라 동작으로 잰다** — 앞선 판은 감사 소스를 정규식으로 봐서, `errors.push` 를
        `warns.push` 로 바꿔 관문의 이빨을 통째로 뽑아도 초록이었다(코드 리뷰가 잡았다). */
  {
    const { checkEntry } = createRequire(import.meta.url)('./entry-rules.cjs');
    const base = {
      id: 'x', name: '공통 [공통] 2026학년도 2학기 반영장학 신청 안내', provider: 'p', amount: 'a',
      summary: 's', documents: [], sourceUrl: 'https://x/a', eligibility: { schoolOnly: '경희대학교' },
      noForm: '-', eligibilityVerified: true,
    };
    const hits = (it, opts) => checkEntry(it, opts).filter((p) => /스스로 운영/.test(p.msg));
    eq('교외로 남아 있으면 감사가 짚는다', hits({ ...base, type: '교외' }, { noticeKind }).length, 1);
    /* ⚠️ **오류가 아니라 경고여야 한다** — 오류면 사람이 관리자 화면에서 교외로 고치는 순간
       감사가 영영 실패하고 수집 워크플로가 매일 되돌리기를 돌려 자동 등록이 통째로 멈춘다
       (revert-auto 는 기존 항목을 못 고친다). 사람 판단을 기계가 잠그면 안 된다. */
    eq('  경고다 (오류로 두면 사람이 고친 값이 파이프라인을 잠근다)',
      hits({ ...base, type: '교외' }, { noticeKind })[0].level, 'warn');
    eq('  교내면 조용하다', hits({ ...base, type: '교내' }, { noticeKind }).length, 0);
    eq('  이름이 70자에서 잘려도 게시판 원제목으로 잡는다',
      hits({ ...base, type: '교외', name: '공통 [공통] 2026학년도 2학기', boardTitle: base.name }, { noticeKind }).length, 1);
    eq('  이어붙인 자리를 넘어 오탐하지 않는다',
      hits({ ...base, type: '교외', name: '재단 우', boardTitle: '정장학 안내' }, { noticeKind }).length, 0);
    eq('  학교를 모르는 전국 등록분은 건너뛴다',
      hits({ ...base, type: '교외', eligibility: {} }, { noticeKind }).length, 0);
    /* 🔴 감사가 판정 함수를 **실제로 넘기는가** — 안 넘기면 이 검사는 조용히 꺼진다 */
    const auditSrc = readText(new URL('./audit-data.js', import.meta.url));
    /* 🔴 **`checkEntry` 를 부르는 그 자리**를 본다 — 그냥 `noticeKind: reqNoticeKind` 를 찾으면
       위쪽 `require` 줄의 같은 글자에 걸려, 인자를 빼도 초록이다(만들면서 실제로 그랬다). */
    eq('  감사가 판정 함수를 넘긴다 (안 넘기면 조용히 꺼진다)',
      /checkEntry\(it, \{[^}]*noticeKind: reqNoticeKind/.test(auditSrc), true);
  }

  /* 근거 문서가 표와 같은 이름을 담고 있는가 — 근거 없이 이름만 늘어나는 것을 막는다 */
  const doc = readText(new URL('../docs/designs/on-campus-programs.md', import.meta.url));
  eq('표의 이름마다 근거 기록이 있다',
    (OWN_PROGRAMS['경희대학교'] || []).filter((p) => !doc.includes(p)), []);
}

/* ══════════════════════════════════════════════════════════════════
   🔴 모르는 접수 방법을 '포털형'이라고 부르지 않는다 (2026-09-21 개발자 지시)

   예전 `submitChannelLabel` 의 마지막 줄은 조건 없이 '온라인·포털 입력형'이었다. 그래서
   접수 방법을 **읽지 못한 공고까지** "포털에서 복사해 붙여넣으세요"라고 단정했다 —
   실측으로 등록 68건 중 44건에 그 문구가 붙었고 **42건은 원문에 근거가 없었다**.
   기술 고문 요청서 10쪽이 "연동 설계와 별개로 고쳐야 할 자리"로 지목한 바로 그 자리다.
   ══════════════════════════════════════════════════════════════════ */
console.log('\n■ 모르는 접수 방법을 단정하지 않는다 (2026-09-21)');
{
  const dataSrc = readText(new URL('../data.js', import.meta.url));
  const acSrc = readText(new URL('../apply-channel.js', import.meta.url));

  /* 규칙을 베끼지 않았는가 — 근거 판정은 apply-channel.js 하나여야 한다 */
  eq('앱이 근거 판정을 베끼지 않는다 (classifyChannels 를 부른다)',
    /classifyChannels\(\{\s*lines/.test(dataSrc), true);
  eq('판정 순서가 한 곳이다 (submitChannelKind)', dataSrc.includes('function submitChannelKind'), true);
  eq('관리자 화면이 그 함수를 쓴다',
    readText(new URL('../_admin/admin.js', import.meta.url)).includes('submitChannelKind(it)'), true);
  /* 부르는 이웃까지 옮겼는가 — 안 옮기면 관리자 화면에서 조용히 '모름'만 나온다 */
  eq('관리자 빌드가 apply-channel.js 를 함께 옮긴다',
    readText(new URL('../_admin/build.sh', import.meta.url)).includes('apply-channel.js'), true);
  /* 🔴 **주석까지 세지 말 것** — 바로 위 줄의 설명 주석에 'data.js' 가 들어 있어서
     생 indexOf 로 재면 순서가 거꾸로 읽힌다(실제로 한 번 빨간불이 났다). 태그로 잰다. */
  eq('앱이 data.js 보다 먼저 싣는다', (() => {
    const h = readText(new URL('../index.html', import.meta.url));
    const at = (f) => h.indexOf(`<script src="${f}"></script>`);
    return at('apply-channel.js') >= 0 && at('apply-channel.js') < at('data.js');
  })(), true);

  /* 글자가 아니라 **동작**으로 잰다 — data.js 의 진짜 함수를 떼어 내 돌린다 */
  const grabFn = (name) => {
    const s = dataSrc.indexOf(`function ${name}(`);
    if (s < 0) throw new Error(`data.js 에서 ${name} 을 못 찾음`);
    let d = 0, seen = false;
    for (let i = dataSrc.indexOf('{', s); i < dataSrc.length; i++) {
      if (dataSrc[i] === '{') { d++; seen = true; }
      else if (dataSrc[i] === '}') { d--; if (seen && !d) return dataSrc.slice(s, i + 1); }
    }
    throw new Error(`${name} 의 끝을 못 찾음`);
  };
  /* apply-channel.js 를 **파일 그대로** 앞에 싣고, 그 위에서 data.js 의 진짜 함수를 돌린다
     — 베낀 사본이 아니라 원본을 재야 의미가 있다(이 파일의 다른 절과 같은 방식). */
  const built = new Function(`${acSrc}
${dataSrc.match(/const SUBMIT_CHANNEL_LABEL = \{[\s\S]*?\};/)[0]}
${[ 'hasFormAttachment', 'hasPortalEvidence', 'submitChannelKind', 'submitChannelLabel' ].map(grabFn).join('\n')}
return { submitChannelKind, submitChannelLabel };`)();
  const kind = built.submitChannelKind;
  const label = built.submitChannelLabel;

  /* 🔴 이 항목이 이 절의 존재 이유다 */
  eq('접수 방법을 모르면 포털이라고 하지 않는다',
    kind({ documents: ['신청 서류·접수 방법은 원문 공고 확인'] }), 'unknown');
  eq('아무 정보도 없으면 포털이라고 하지 않는다', kind({}), 'unknown');
  eq('모를 때의 문구가 단정하지 않는다', label({}), '🖥 접수 방법은 원문 공고에서 확인');
  /* 근거가 있으면 예전처럼 포털이라고 말한다 — 모두 '모름'으로 만들어 버리면 그것도 퇴보다 */
  eq('원문이 포털이라고 하면 포털이다',
    kind({ documents: ['종합정보시스템(포털)에서 온라인 신청'] }), 'portal');
  /* 상단 메뉴의 '포털' 글자로 되살아나지 않는가 (apply-channel.js 첫머리의 오탐 ②) */
  eq('메뉴 글자만으로는 포털이 아니다',
    kind({ excerpts: ['학사행정 포털 장학 로그인 사이트맵'] }), 'unknown');
  /* 앞선 갈래는 그대로여야 한다 */
  eq('이메일 접수는 그대로', kind({ applyEmail: 'a@hufs.ac.kr' }), 'email');
  eq('양식 연결분은 그대로', kind({ formId: 'x' }), 'form');
  eq('첨부 양식형은 그대로', kind({ attachments: [{ name: '신청서.hwp' }] }), 'download');

  /* 실제 데이터로도 — 근거 없는 단정이 0건인가 */
  const reg = JSON.parse(readText(new URL('../data/registered.json', import.meta.url)));
  const claimed = reg.items.filter((it) => kind(it) === 'portal');
  /* 🔴 근거는 **두 갈래**다 (2026-09-23 에 둘째가 생겼다) — 화면에 실린 발췌 줄,
     그리고 로봇이 공고 원문 전체를 읽어 남긴 `applyPortalSource`. 뒤엣것이 더 강하다
     (발췌는 14칸 상한이라 신청방법 줄이 자주 밀려난다 — 실측 원문 15건 vs 발췌 1건).
     ⚠️ 이 검사의 이빨은 그대로다: **어느 쪽이든 근거가 있어야** 포털이라고 부를 수 있고,
        `applyPortalSource` 는 그 안에 **시스템 이름이 실제로 들어 있어야** 근거로 친다. */
  const PORTAL_WORDS = /종합정보시스템|HUFS\s?Ability|학사정보시스템|학생지원시스템|포털|인포\s?21|INFO\s?21/i;
  const baseless = claimed.filter((it) => {
    const t = [].concat(it.documents || [], it.excerpts || []).join(' ');
    if (PORTAL_WORDS.test(t)) return false;
    return !(it.applyPortalSource && PORTAL_WORDS.test(it.applyPortalSource));
  });
  eq('등록 데이터에 근거 없는 포털 단정이 없다', baseless.length, 0);
}

/* ── 🔴 노션 「작업 현황」이 낡은 것을 오늘 일이라고 말하지 않는다 (2026-09-22 신설) ──
   개발자 지적: *"지금 내가 한 일들이 노션에 업데이트 돼야하는데 안되고있어 뭐야 대체 뭐가문제야"*.
   로봇은 **16일 동안 초록불로 성공**하고 있었다 — 9/6 커밋 8건을 찾아내 '갱신 2026-09-22' 와
   나란히 적었다. 멈춘 것이 아니라 **최신인 것처럼 보이는 것**이라 아무도 못 알아봤다.
   뿌리: `--author` 로 사람을 갈랐는데 **주소가 더 이상 사람을 가르지 않는다** — 실측으로
   9/7 이후 사람 커밋 250개 중 182개가 Claude Code 공용 주소(`noreply@anthropic.com`)다.
   🔴 이 로봇에는 **관문이 하나도 없었다.** 그래서 16일이 지나갔다 — 그게 이 절이 생긴 이유다.
   🔴 **글자가 아니라 동작으로 잰다** — `--dry` 로 실제로 돌려 무엇을 적는지 본다. */
{
  console.log('\n■ 노션 「작업 현황」 (2026-09-22)');
  const src = readText(new URL('../tools/notion-status.mjs', import.meta.url));
  const yml = readText(new URL('../.github/workflows/update-progress.yml', import.meta.url));

  /* ① 공용 주소를 사람 칸에 다시 넣지 않는다 — 넣으면 한 사람의 줄에 셋의 일이 실린다.
        주석 속 인용은 빼고 **코드**만 본다. */
  const peopleBlock = src.slice(src.indexOf('const PEOPLE = {'), src.indexOf('};', src.indexOf('const PEOPLE = {')));
  eq('공용 주소를 emails 에 넣지 않는다', /noreply@anthropic\.com/.test(peopleBlock), false);

  /* ② 워크플로가 push 범위를 넘긴다 — 안 넘기면 로봇이 영영 주소 근거로만 돈다(사고 그대로). */
  eq('워크플로가 GITHUB_EVENT_BEFORE 를 넘긴다', /GITHUB_EVENT_BEFORE:\s*\$\{\{\s*github\.event\.before\s*\}\}/.test(yml), true);
  eq('로봇이 그 값을 읽는다', /process\.env\.GITHUB_EVENT_BEFORE/.test(src), true);

  /* ③ '지금 하는 일' 은 **목록에 보인 그 커밋**을 본다 — git 을 따로 한 번 더 읽으면
        두 칸이 서로 다른 날의 일을 말한다(고치기 전이 그랬다). */
  eq("'지금 하는 일' 이 목록과 같은 커밋을 본다", /git show --name-status[^`]*list\.slice\(0, 3\)/.test(src), true);

  /* ④ ⟵ 여기가 심장이다. 로봇을 **실제로 돌려** 세 경우를 잰다. */
  const run = (env) => {
    const r = spawnSync(process.execPath, ['tools/notion-status.mjs', '--dry'], {
      cwd: fileURLToPath(new URL('..', import.meta.url)),
      encoding: 'utf8',
      env: { ...process.env, NOTION_TOKEN: 'dry', GITHUB_EVENT_BEFORE: '', GITHUB_REF_NAME: 'main', ...env },
    });
    return (r.stdout || '') + (r.stderr || '');
  };
  /* 최근 커밋 둘이 실려 있어야 잴 수 있다 — 얕은 클론이면 건너뛴다(거짓 빨간불 금지). */
  /* 🔴 **저장소 이력에 기대지 않는다** (2026-09-23 · 두 번째 판).
     첫 판은 이 저장소의 최근 커밋에서 범위를 골랐는데, 기본 브랜치를 한 번 병합하자
     닻부터 **34커밋**(PUSH_MAX 30 초과)이 되어 로봇이 '따라잡기 push' 로 올바르게
     판정했고 **관문만 빨간불**이 됐다. 로봇은 멀쩡한데 검사가 흔들린 것이다 —
     그런 관문은 다음 사람이 통째로 꺼 버린다(2026-09-11 '통과할 수 없는 관문' 교훈).
     그래서 **검사가 제 저장소를 만들어** 잰다: 커밋 둘(사람 하나·로봇 하나)만 있는
     깨끗한 이력이라 병합·수집 커밋이 아무리 쌓여도 결과가 안 변한다. */
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'notion-gate-'));
  const git = (...a) => spawnSync('git', a, { cwd: tmp, encoding: 'utf8' });
  git('init', '-q', '-b', 'main');
  git('config', 'user.email', 'dhdp0105@gmail.com');
  git('config', 'user.name', '유은서');
  fs.writeFileSync(path.join(tmp, 'seed.txt'), 'x');
  git('add', '-A'); git('commit', '-qm', '씨앗 커밋');
  const before = git('rev-parse', 'HEAD').stdout.trim();
  /* 사람이 만진 파일 — AREAS 가 '한국장학재단 목록'으로 읽는 경로를 일부러 고른다 */
  fs.mkdirSync(path.join(tmp, 'collector'), { recursive: true });
  fs.writeFileSync(path.join(tmp, 'collector/kosaf-open.mjs'), '// 고침');
  git('add', '-A'); git('commit', '-qm', '층2 목록을 고쳤다');

  const runIn = (env) => {
    const r = spawnSync(process.execPath,
      [fileURLToPath(new URL('../tools/notion-status.mjs', import.meta.url)), '--dry'],
      { cwd: tmp, encoding: 'utf8',
        env: { ...process.env, NOTION_TOKEN: 'dry', GITHUB_EVENT_BEFORE: '', GITHUB_REF_NAME: 'main', ...env } });
    return (r.stdout || '') + (r.stderr || '');
  };

  const pushed = runIn({ GITHUB_ACTOR: 'didinin-wq', GITHUB_EVENT_BEFORE: before });
  eq('push 근거가 주소 근거를 이긴다 (낡음 경고가 안 뜬다)', /지금 한 일이 아닙니다/.test(pushed), false);
  eq('push 로 올린 커밋을 적는다', /층2 목록을 고쳤다/.test(pushed), true);
  eq("'지금 하는 일' 은 만진 파일에서 읽는다", /지금 하는 일: 한국장학재단 목록/.test(pushed), true);

  /* 🔴 되돌림 검사 — push 근거를 빼앗으면 **반드시 낡음 경고가 떠야 한다.**
     이 한 줄이 2026-09-22 사고 그 자체다(주소 근거밖에 없을 때 9/6 을 오늘로 적던 것).
     이 임시 저장소에는 은서 주소로 된 커밋이 '씨앗'뿐이고 그건 방금 만든 것이라
     낡지 않았다 — 그래서 **일부러 오래된 날짜로** 하나 더 얹어 낡음을 만든다. */
  git('-c', 'user.email=dhdp0105@gmail.com', 'commit', '-q', '--allow-empty',
      '--date=2020-01-02T00:00:00', '-m', '아주 오래된 커밋');
  const noPush = runIn({ GITHUB_ACTOR: 'didinin-wq' });
  eq('근거가 낡으면 낡았다고 적는다', /지금 한 일이 아닙니다/.test(noPush), true);
  eq("낡으면 '지금 하는 일' 을 덮지 않는다", /지금 하는 일: \(못 읽어서 그대로 둠\)/.test(noPush), true);

  /* 근거가 아예 없으면 — 남의 커밋으로 채우지 않는다(이선주는 emails 가 비어 있다) */
  const none = runIn({ GITHUB_ACTOR: 'seonju5543-web' });
  eq('근거가 없으면 못 찾았다고 적는다', /사람 커밋을 찾지 못했습니다/.test(none), true);
  fs.rmSync(tmp, { recursive: true, force: true });
}

/* ── 🔴 메일 접수 주소 — 문의처를 접수처라고 부르지 않는다 (2026-09-23 신설) ──
   2026-09-02 에 사람이 공고 121건을 직접 열어 접수 채널을 갈랐고 이메일 접수를 찾아냈는데,
   그 결과가 기술 고문 요청서(PDF)에만 남고 **앱 데이터에는 한 칸도 안 들어갔다** —
   `applyEmail` 이 등록 68건 중 0건이라 '접수 메일 열기' 버튼이 한 번도 뜬 적이 없었다.
   이제 원문을 읽는 자리(extract-excerpts)가 수집 때마다 채운다.
   🔴 여기 픽스처는 **하나만 빼고 전부 실제 공고 원문 줄**이다. 규칙을 넓히려는 다음 사람이
      무엇을 깨뜨리는지 눈으로 보게 하려는 것이다. 합성인 하나는 아래 ⑦에 표시해 뒀다 —
      그 규칙(문의)만이 잡는 줄이 지금 말뭉치에 **0건**이라 실제 줄을 쓸 수가 없었다.
   🔴 가장 위험한 것은 오탐이다 — 주소가 틀리면 학생의 신청서와 증명서류가 **엉뚱한 사람**
      에게 간다. 그래서 '버려야' 줄이 '받아야' 줄보다 많다. */
{
  console.log('\n■ 메일 접수 주소 (2026-09-23)');
  const src = readText(new URL('../collector/apply-email.mjs', import.meta.url));
  const exc = readText(new URL('../collector/extract-excerpts.mjs', import.meta.url));

  /* ① 규칙이 한 곳인가 — 베끼면 본문 경로와 첨부 경로가 다른 말을 한다 */
  eq('판정 규칙은 apply-email.mjs 한 곳', /export function judgeLine/.test(src), true);
  eq('발췌기가 그것을 가져다 쓴다', /from '\.\/apply-email\.mjs'/.test(exc), true);
  eq('발췌기 안에 규칙을 베껴 두지 않았다',
    /(INQUIRY|OTHER_SENDER|SUBMIT_VERB)\s*=/.test(exc), false);

  /* ② 🔴 **두 경로가 같은 함수를 쓴다.** 본문이 껍데기인 게시판(경희대 유형)은 위쪽
        갈림길에서 continue 로 빠져나가므로, 본문 경로에만 붙이면 첨부에 접수처가 적힌
        공고가 통째로 샌다 — 만들면서 실제로 그렇게 틀려 울산연구원 1건을 놓쳤다. */
  eq("'첨부만' 경로도 접수 메일을 채운다", /fillApplyEmail\(it, null\)/.test(exc), true);
  eq('본문 경로도 같은 함수를 부른다', /fillApplyEmail\(it, body\)/.test(exc), true);

  /* ③ ⟵ 심장. 실제 원문 10줄을 그대로 넣어 받고 버리는 것을 잰다. */
  const { judgeLine, findApplyEmail } = await import('../collector/apply-email.mjs');
  const take = (line) => { const v = judgeLine(line); return !!(v && v.ok); };

  eq('신청서를 이메일로 제출하라는 줄 — 받는다',
    take('9. 지원방법 : [ 붙임 ] 의 신청서를 작성하여 관재팀 이메일 (khsa0063@khu.ac.kr) 로 제출'), true);
  eq('접수주소 이름표가 붙은 줄 — 받는다',
    take('◯ 접수주소 : nohsy12@518.org (※우편접수 불가)'), true);
  eq('메일로 서류를 제출하라는 줄 — 받는다',
    take('⑥ 서류 준비 및 메일(injae@uri.re.kr)로 신청서(3종), 증빙서류 제출'), true);
  eq('제출 방법 : 이메일 — 받는다',
    take('다 . 멘토활동계획서 제출 방법 : 이메일 : scholarship@hufs.ac.kr 또는 장학팀 ( 학생회관 121 호 ) 직접 제출'), true);

  /* 🔴 버려야 하는 줄 — 전부 실제로 나온 것이다 */
  eq('문의처 줄은 접수처가 아니다',
    take('12. 문의처 : 서울캠퍼스 총무관리처 관재팀 (02-961-0043~4, khsa0063@khu.ac.kr)'), false);
  eq('문의사항 줄도 아니다',
    take('☎ 문의사항 : 서울 장학팀 (02-2173-2136 / scholarship@hufs.ac.kr)'), false);
  eq('담당자 줄도 아니다',
    take('① 서울 사랑의열매 담당자 : jiwon.kim716@chest.or.kr'), false);
  eq("내는 행위가 없는 '- 이메일 :' 줄은 받지 않는다",
    take('- 이메일 : scholarship@hufs.ac.kr'), false);
  eq('부서 연락처 줄도 받지 않는다',
    take('글로벌 학생지원 . 장학팀 (031-330-4034 / studenty@hufs.ac.kr )'), false);
  /* 🔴 이 줄이 이 절의 존재 이유다 — '제출'도 있고 주소도 있지만 **보내는 사람이 교수**이고
     주소는 **이화여대**다. 받으면 우리 학생의 신청서가 남의 학교 메일함으로 간다. */
  eq('🔴 제3자(교수)가 내는 줄은 받지 않는다',
    take('(또는 교수님이 장학복지팀으로 제출하는 것도 가능함/ scholarship@ewha.ac.kr [추천 학생의 이름/학 번/장학금명 기재])'), false);

  /* ⑦ 🔴 **합성 픽스처 — 위 줄들과 달리 실제 공고에서 뽑은 것이 아니다.**
     말뭉치를 뒤져 보니 '메일 + 내는 행위 + 문의'를 한 줄에 가진 공고가 지금은 0건이라,
     문의 규칙이 **혼자 잡는 경우**를 실제 줄로는 시험할 수가 없었다(그래서 이 규칙을
     빼도 관문이 한동안 초록이었다 — 만들면서 그렇게 틀렸다).
     규칙을 남겨 둔 이유: `제출 관련 문의` 꼴은 한국 공고에 흔한 표현이고, 그 주소는
     **물어보는 곳이지 내는 곳이 아니다.** 여기로 신청서를 보내면 접수가 안 된다.
     ⚠️ 애매한 줄(`제출 및 문의`)도 함께 버린다 — 버리면 학생은 '원문 확인'을 보지만,
        잘못 받으면 신청서가 엉뚱한 메일함으로 간다. 한쪽이 훨씬 싸다. */
  eq('[합성] 제출 문의용 주소는 접수처가 아니다',
    take('※ 제출 관련 문의 : 장학팀 scholarship@example.ac.kr'), false);

  /* ④ 근거 문장을 반드시 함께 돌려준다 — 감사가 그것으로 주소를 대조한다 */
  const got = findApplyEmail('가. 안내\n◯ 접수주소 : nohsy12@518.org (※우편접수 불가)\n나. 문의 : 02-0000');
  eq('주소를 찾아낸다', got && got.email, 'nohsy12@518.org');
  eq('근거 문장에 그 주소가 들어 있다', !!(got && got.source.includes(got.email)), true);

  /* ⑤ 감사가 근거 없는 주소를 막는가 — 로봇이 넣은 것은 오류, 사람이 넣은 것은 경고.
     🔴 사람 것을 오류로 만들면 관리자가 화면에서 고치는 순간 자동 등록이 통째로 멈춘다. */
  const { checkEntry } = createRequire(import.meta.url)('./entry-rules.cjs');
  const base = { id: 't', name: '테스트 장학금', sourceUrl: 'https://x.ac.kr/a', type: '교외', deadline: '2026-12-01' };
  const lv = (o) => (checkEntry({ ...base, ...o }, { formIds: new Set() })
    .find((p) => /메일 주소/.test(p.msg)) || {}).level || '(없음)';
  eq('근거 있으면 통과', lv({ applyEmail: 'a@b.ac.kr', applyEmailSource: '접수주소 : a@b.ac.kr 로 제출', applyEmailFrom: '공고 원문' }), '(없음)');
  eq('로봇이 근거 없이 넣으면 오류', lv({ applyEmail: 'a@b.ac.kr', applyEmailFrom: '공고 원문' }), 'error');
  eq('사람이 넣은 것은 경고까지만', lv({ applyEmail: 'a@b.ac.kr', applyEmailFrom: '관리자 2026-09-23' }), 'warn');
  eq('근거가 딴 주소면 오류', lv({ applyEmail: 'a@b.ac.kr', applyEmailSource: '접수주소 : zzz@c.ac.kr 로 제출', applyEmailFrom: '공고 원문' }), 'error');

  /* ⑥ 실제 데이터 — 넣어 둔 주소가 전부 제 근거 문장 안에 있는가 */
  const reg = JSON.parse(readText(new URL('../data/registered.json', import.meta.url)));
  const mailed = reg.items.filter((x) => x.applyEmail);
  eq('접수 메일 주소가 들어 있다 (0건이면 통로가 다시 막힌 것)', mailed.length > 0, true);
  eq('전부 근거 문장을 달고 있다', mailed.filter((x) => !(x.applyEmailSource || '').includes(x.applyEmail)), []);
}

/* ── 🔴 포털 신청 — '어느 시스템'까지 읽는다 (2026-09-23 신설) ──
   그전까지 포털 공고에 앱이 하는 말은 **학교 포털 주소 하나**였다. 그런데 한국외대는
   시스템이 둘이라(신청 `HUFS Ability` · 계좌 `종합정보시스템`) 학교로만 고르면 학생을
   계좌 등록 화면으로 보낸다 — 거기엔 신청 버튼이 없어서 끝까지 못 찾는다.
   🔴 **길은 우리가 쓰지 않는다** — 원문에 통째로 적혀 있으므로 그 문장을 그대로 보인다
      (원칙 8-1). 우리가 다시 쓰면 추론이 되고, 학교가 메뉴를 바꾸면 거짓이 된다.
   🔴 픽스처는 **전부 실제 공고 원문 줄**이다. 오탐 셋(다운로드·선발확인·지급계좌)이
      '받아야' 줄보다 중요하다 — 그게 학생을 엉뚱한 화면으로 보내는 길이다. */
{
  console.log('\n■ 포털 신청 시스템 (2026-09-23)');
  const req = createRequire(import.meta.url);
  const { judgePortalLine, findApplyPortal, PORTAL_SYSTEMS } = req('../apply-channel.js');
  const exc = readText(new URL('../collector/extract-excerpts.mjs', import.meta.url));
  const dataJs = readText(new URL('../data.js', import.meta.url));
  const appJs = readText(new URL('../app.js', import.meta.url));
  const take = (l) => { const v = judgePortalLine(l); return !!(v && v.ok); };
  const sysOf = (l) => { const v = judgePortalLine(l); return v && v.ok ? v.system : null; };

  /* ① 내는 곳을 말하는 줄 — 받는다 (셋 다 실제 원문) */
  eq('HUFS Ability 신청방법 줄을 받는다',
    sysOf('6. 신청방법 : 온라인 신청 (HUFS Ability- 학생핵심역량통합시스템 ) → 로그인 ( 학번 / 비번 ) → 교과 / 비교과 → 장학신청 목록 → 해당 장학금'), 'HUFS Ability');
  eq('종합정보시스템 신청방법 줄을 받는다',
    sysOf('3. 신청 방법 : 종합정보시스템 로그인 - 등록 / 장학정보 - 면학장학금 신청'), '종합정보시스템');
  eq('인포21 신청방법 줄을 받는다', sysOf('신청방법: 인포21을 통한 신청'), '인포21');
  eq('인포21 접수 줄도 받는다', sysOf('4. 신청 접수 : 2026년 8월 26일(수)까지 인포21 신청'), '인포21');

  /* ② 🔴 내는 곳이 **아닌** 줄 — 전부 실제 원문. 여기가 이 절의 심장이다. */
  eq('양식 받는 곳은 접수처가 아니다',
    take('가 . 장학금 신청서 ( HUFS Ability 다운로드 )'), false);
  eq('결과 보는 곳은 접수처가 아니다',
    take('다 . 선발확인 : HUFS Ability 로그인 후 장학금 신청내역에서 확인'), false);
  eq('입금 계좌는 접수처가 아니다',
    take('7. 지급방법 : 계좌 지급 ( 종합정보시스템 등록 계좌로 지급 예정 )'), false);
  eq('계좌 등록 안내도 접수처가 아니다',
    take('※ 종합정보시스템 로그인 → 등록 / 장학 → 본인명의 계좌입력'), false);
  /* 🔴 경희대 사이트 상단 메뉴다(웹메일 / 인포21 / 채용시스템) — 실측으로 확인했다 */
  eq('상단 메뉴의 맨 이름은 접수처가 아니다', take('인포21'), false);

  /* ③ 🔴 `로` 가 `로그인` 첫 글자에 걸리던 것 — 한 글자 겹침이라 눈으로는 안 보인다 */
  const ch = req('../apply-channel.js');
  eq('조사 `로` 가 `로그인` 을 먹지 않는다',
    ch.classifyChannels({ lines: ['다 . 선발확인 : HUFS Ability 로그인 후 장학금 신청내역에서 확인'], attachments: [] })
      .some((h) => h.kind === '학교 시스템 입력형'), false);

  /* ④ 한 공고에 시스템이 둘이면 **내는 쪽**을 고른다 (실측: 씨앗 장학금이 그 꼴) */
  const two = findApplyPortal([
    '6. 신청방법 : 온라인 신청 (HUFS Ability- 학생핵심역량통합시스템 ) → 로그인 → 교과 / 비교과 → 장학신청 목록',
    '7. 지급방법 : 계좌 지급 ( 종합정보시스템 등록 계좌로 지급 예정 )',
    '※ 종합정보시스템 로그인 → 등록 / 장학 → 계좌정보 입력',
  ].join('\n'));
  eq('시스템이 둘이면 내는 쪽을 고른다', two && two.system, 'HUFS Ability');

  /* ⑤ 두 경로가 같은 함수를 쓴다 (접수 메일에서 낸 실수를 되풀이하지 않는다) */
  eq("'첨부만' 경로도 포털을 채운다", /fillApplyPortal\(it, null\)/.test(exc), true);
  eq('본문 경로도 같은 함수를 부른다', /fillApplyPortal\(it, body\)/.test(exc), true);

  /* ⑥ 열쇠가 두 파일에서 같은 글자인가 — 갈라지면 안내가 통째로 사라진다 */
  const keys = PORTAL_SYSTEMS.map(([k]) => k);
  eq('시스템 열쇠를 읽어 냈다', keys.length >= 3, true);
  eq('data.js 의 주소 표가 같은 열쇠를 쓴다',
    keys.filter((k) => !new RegExp(`'${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'\\s*:`).test(dataJs)), []);

  /* ⑦ 🔴 주소를 모르는 시스템은 **링크를 만들지 않는다** — 틀린 링크보다 이름만이 낫다 */
  eq('주소 미확인 시스템은 url 이 비어 있다', /'종합정보시스템':\s*\{[^}]*url:\s*''/.test(dataJs), true);
  eq('화면이 url 이 있을 때만 링크를 만든다', /sys\.url\s*\?/.test(appJs), true);

  /* ⑧ 길을 우리가 다시 쓰지 않는다 — 원문 문장을 그대로 보인다 */
  eq('화면이 근거 문장을 그대로 보인다', /applyPortalSource/.test(appJs), true);
  /* 🔴 **없는 클래스를 지어내지 않는다** — 만들면서 `.dp-quote` 라는 이름을 새로 지었는데
     style.css 에 그런 규칙이 없어 스타일 없는 글이 앞 문장에 붙어 나올 참이었다.
     이 자리에서 쓰는 이름은 CSS 에 실제로 있어야 한다. */
  const css = readText(new URL('../style.css', import.meta.url));
  const note = appJs.slice(appJs.indexOf('function schoolPortalNote'), appJs.indexOf('function openDetail'));
  const used = [...note.matchAll(/class="([a-z][a-z0-9-]*)"/g)].map((m) => m[1]);
  eq('포털 안내가 쓰는 클래스를 읽어 냈다', used.length > 0, true);
  eq('그 클래스가 전부 style.css 에 있다',
    used.filter((c) => !new RegExp(`\\.${c}\\b`).test(css)), []);

  /* ⑨ 실제 데이터 — HTML 기호가 학생 화면에 글자로 새지 않는가 (2026-09-11 사고와 같은 줄) */
  const reg = JSON.parse(readText(new URL('../data/registered.json', import.meta.url)));
  const withPortal = reg.items.filter((x) => x.applyPortal);
  eq('포털 시스템이 들어 있다 (0건이면 통로가 막힌 것)', withPortal.length > 0, true);
  eq('전부 근거 문장을 달고 있다', withPortal.filter((x) => !x.applyPortalSource), []);
  const ents = reg.items.filter((x) => /&[a-zA-Z#0-9]+;/.test(`${x.applyPortalSource || ''}${x.applyEmailSource || ''}`));
  eq('근거 문장에 HTML 기호가 남아 있지 않다', ents.map((x) => x.id), []);
}

/* ── 🔴 기술 고문 요청서가 우리 전제와 어긋나지 않는다 (2026-09-23 신설) ──
   이 문서는 **바깥 사람에게 보내는 글**이라 틀리면 고칠 기회가 없다 — 고문이 없는 전제로
   답을 쓰면 그 답이 통째로 버려진다. 실제로 그랬다: 문서가 「전국 외부 공고까지 넓히려
   합니다」라고 적고 있었는데 개발자는 2026-09-21에 **정반대**를 정했다(2곳 확정).
   CLAUDE.md 도 「보내기 전에 고칠 것」이라고 적어 뒀지만 글로만 적힌 규칙은 되돌아간다.
   🔴 여기서 잠그는 것은 **잘 안 변하는 전제**뿐이다. 공고 건수 같은 값은 날마다 변하므로
      잠그면 **통과할 수 없는 관문**이 되어 다음 사람이 관문 전체를 꺼 버린다
      (2026-09-11 서체 문턱에서 이미 겪었다). 그 값은 `docs/advisor/check-brief.mjs` 가
      보내기 전에 나란히 찍어 준다 — 막지 않고 보여 준다. */
{
  console.log('\n■ 기술 고문 요청서 (2026-09-23)');
  const brief = readText(new URL('../docs/advisor/tech-advisor-brief.html', import.meta.url));
  const claude = readText(new URL('../CLAUDE.md', import.meta.url));

  /* ① 수집망 결정과 어긋나지 않는가 — 이 사고 그 자체 */
  eq('CLAUDE.md 에 「수집망 두 곳」 결정이 살아 있다', /수집망은 두 곳 그대로/.test(claude), true);
  eq('요청서가 「전국으로 넓히려 한다」고 말하지 않는다',
    /전국\s*(외부\s*)?공고까지\s*넓히려/.test(brief), false);
  eq('요청서가 좁힌 사실을 적는다', /2곳으로 확정|경희대·한국외대 2곳/.test(brief), true);

  /* ② 이미 고친 결함을 미해결로 적어 두지 않는다 — 고문의 시간을 뺏는다 */
  eq('포털 오단정을 아직 고칠 자리라고 적지 않는다',
    /포털에서 복사해 붙여넣으세요[\s\S]{0,200}고쳐야 할 자리/.test(brief), false);

  /* ③ Q5 ①의 사실관계 — '키만 없다'가 아니었다(대상 데이터가 없었고, mailto 는 서버가 필요 없다) */
  eq("메일 접수를 '키만 없다'고 적지 않는다", /키만 없습니다/.test(brief), false);
  eq('mailto 로 이미 열려 있다는 사실을 적는다', /mailto:/.test(brief), true);

  /* ④ 낡은 숫자가 되돌아오지 않는가 — 한 번 고친 값들이다(현재값을 박는 게 아니라 옛값을 막는다) */
  const OLD = ['14,677', '18개 파일', '정식 등록 공고 45건', '재단 116곳', '실시간 공고 507건'];
  eq('고쳐 둔 옛 숫자가 되돌아오지 않았다', OLD.filter((n) => brief.includes(n)), []);

  /* ⑤ 재는 도구가 있고, 문서가 잰 날짜를 밝히는가 */
  eq('보내기 전 대조 도구가 있다',
    fs.existsSync(fileURLToPath(new URL('../docs/advisor/check-brief.mjs', import.meta.url))), true);
  eq('문서가 실측 날짜를 밝힌다', /2026-09-23 저장소 실측/.test(brief), true);
}

/* ── 🔴 문의처 — 앱과 약관이 같은 주소를 말한다 (2026-09-23 신설) ─────────────
   왜 관문인가: `support-config.js` 는 비어 있으면 '문의 메일 쓰기' 버튼을 아예 안 낸다.
   그래서 주소를 채우는 것과 약관 9번을 고치는 것이 **한 세트**인데, 한쪽만 하기 쉽다.
   실제로 로그인이 켜져 배포된 뒤에도 약관은 "이용자를 받고 있지 않습니다 ·
   별도 문의처를 두지 않습니다" 라고 말하고 있었다 — 개인정보를 받으면서 지우거나
   물어볼 곳이 없다고 적혀 있던 것이다.
   🔴 **주소를 여기 베껴 적지 않는다** — 베끼면 이 관문이 세 번째 사본이 된다.
      support-config.js 에서 읽어 terms.html 안에 그 주소가 있는지만 본다. */
{
  console.log('\n■ 문의처 — 앱과 약관이 갈라지지 않는다 (2026-09-23)');
  const supportSrc = readText(new URL('../support-config.js', import.meta.url));
  const terms = readText(new URL('../terms.html', import.meta.url));
  const m = supportSrc.match(/\bemail:\s*'([^']*)'/);
  eq('support-config.js 에서 문의처 칸을 읽어 냈다', !!m, true);
  const email = m ? m[1] : '';

  if (email) {
    eq('약관이 그 주소를 그대로 적는다', terms.includes(email), true);
    /* 주소가 있는데 "문의처를 두지 않습니다"가 남아 있으면 앱과 약관이 반대말을 한다 */
    eq('약관이 「문의처를 두지 않습니다」라고 말하지 않는다',
      /별도\s*문의처를\s*두지\s*않습니다/.test(terms), false);
    eq('약관이 「이용자를 받고 있지 않습니다」라고 말하지 않는다',
      /이용자를\s*받고\s*있지\s*않습니다/.test(terms), false);
    /* 로그인이 켜져 있으면 '공개되지 않았다'도 사실이 아니다 */
    eq('약관이 「외부에 공개되지 않았」다고 말하지 않는다',
      /외부에\s*공개되지\s*않았/.test(terms), false);
    eq('채워 두고 남은 임시 표식이 없다', /legal-tmp/.test(terms), false);
  } else {
    /* 비워 둔 상태도 정당하다 — 다만 그때는 약관도 같은 말을 해야 한다 */
    eq('문의처가 비었으면 약관도 없다고 말한다',
      /별도\s*문의처를\s*두지\s*않습니다/.test(terms), true);
  }

  /* 🔴 응대 시간은 지킬 수 있을 때만 적는다(운영 원칙 1) — 빈 칸은 정상이다.
     적혀 있다면 화면이 그것을 쓰는지까지는 이 관문이 보지 않는다(verify-settings 의 몫). */
  const h = supportSrc.match(/\bhours:\s*'([^']*)'/);
  eq('응대 시간 칸이 있다 (비어 있어도 된다)', !!h, true);
}

console.log(fail ? `\n✕ 실패 ${fail}건 — 수집기 중복 제거 규칙이 깨졌습니다` : '\n✓ 수집기 규칙 전부 통과');
process.exit(fail ? 1 : 0);
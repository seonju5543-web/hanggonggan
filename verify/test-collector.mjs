/* 수집기 규칙 자체 테스트 — 인터넷 없이 즉시 끝난다. 수집 워크플로가 매 실행마다 돌린다.
   목적: 2026-07-30에 고친 '같은 공고를 다시 담지 않는 규칙'이 나중에 조용히 되돌아가지 않게 한다.
   (그때는 시립대 피드 40건 중 실제 공고가 13건뿐이었고, 중복이 학교당 상한을 채워
    진짜 새 공고를 밀어냈다. 사람이 눈으로 보기 전에는 아무도 몰랐다.)

   실행: node verify/test-collector.mjs   (실패하면 exit 1) */
import fs from 'node:fs';
import { urlKey, titleKey, dedupeNotices, preferNotice } from '../collector/url-key.mjs';
import { isAttachmentEntry, isHtmlPayload } from '../collector/attachment-link.mjs';
import { isDetailUrl, isMarkerUrl, markerTitle, sameTitle, detailCandidates, looksLikeLoginWall, rowDetailCandidates } from '../collector/detail-url.mjs';

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

console.log(fail ? `\n✕ 실패 ${fail}건 — 수집기 중복 제거 규칙이 깨졌습니다` : '\n✓ 수집기 규칙 전부 통과');
process.exit(fail ? 1 : 0);

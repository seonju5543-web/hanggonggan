/* 「로봇·도구 점검 관문」 qnotice 묶음 — 장학 공고 글 품질·양식·메일 접수 (2026-10-05 대대적 점검)
   잰다:
     ① 메일 접수 — 예외·서류 전용 (app1-04): '오류 발생 시에만' 쓰는 예비 메일·'신청은 다른 곳 · 메일은 서류만' 줄은 접수처가 아니다
        (고려대 송화재단 · 연세대 신문고 실례 — 큰 '접수 메일 열기' 버튼이 학생을 예비 메일함으로 보냈다) ·
        이미 들어간 로봇 값도 매 실행 다시 묻는다(staleApplyEmail) · **진짜 extract-excerpts.mjs 를 임시 폴더에서 돌려** 지워지는지 본다
     ② 게시판 행 꼬리 · 배너 기간 (collect-04): 제목 꼬리(부서·게시일·조회수 · 「첨부파일 있음」 · 폭 없는 공백)는 공용 cleanTitle 한 곳 ·
        항공대 머리 배너(교수 채용 `접수기간 : 2026.10.15.(목) 13:30까지`)가 19건 전부의 기간 힌트가 되던 것 — 같은 호스트 여러 쪽에 똑같이 나오는
        줄(껍데기)을 걷고 읽는다(deadline-hint.mjs hintWithoutChrome · isChromeHint · notice-deadline.mjs makeBodyReader) · 수집기 배선
     ③ 자동 등록 — 원문 마감을 먼저 본다 (collect-07): 본문에만 기간이 적힌 글이 마감 없이 등록됐다가 몇 분 뒤 지난 마감을 받았다(항공대 2건 ·
        등록 뒤 마감 경과 20건) — 본문 마감(bodyDeadline · 껍데기를 모르면 읽지 않는다)을 먼저 보고, 이미 그렇게 들어간 로봇 등록분은 빼고
        그 글에 마감을 적어 다시 등록되지 않게 한다 · **진짜 auto-register.mjs 를 임시 폴더에서 돌린다**
     ④ 범위 승격은 마감 전만 (collect-14): 지난 등록분을 전국으로 풀거나 지난 회차가 새 회차를 흡수하지 않는다(openOn 한 곳)
     ⑤ 소식 제목의 행 꼬리·번호 (news-7): 영남 「9 2026학년도 …」 행 번호는 **게시판 단위로만**(80%) 뗀다(한 제목만 보고 떼면 「3 대 3 농구대회」가 깨진다) ·
        항공대 꼴(<a> 안에 제목·부서·날짜·조회수) · 실려 있던 글도 발행 때 같은 청소(retitleStored · 주소·글 번호는 그대로)
     ⑥ 도우미 검색 재료에 메뉴·남의 제목이 없다 (app1-05): 요약 7건에 메뉴 낱말(로그아웃·학생포탈·eclass)이 들어가 엉뚱한 공고가 섞였다 —
        껍데기 줄 · 다른 공고 제목 줄 · 「이전글」 뒤 두 줄 · 날짜 줄 앞 줄을 걷는다 · 불러오기만 하면 파일을 쓰지 않는다
     ⑦ 포털 후보는 원문에서 이름을 찾는다 (app1-11): 예전엔 이미 아는 시스템(applyPortal)만 모아 새 시스템을 영영 못 찾았다(결과 0건) —
        신청을 말하는 원문 줄에서 이름 꼴을 읽고(출력·다운로드·문의 줄은 버림) · 학교 고유 이름 + 근거 2건만 표 후보 · 불러오기만 하면 안 쓴다
     ⑧ 양식이 붙은 열린 공고 수 · 옛 양식 후보 (app1-03 ③ · app1-08 ①): 열린 공고 86건 중 학생이 앱에서 양식을 여는 것이 1건뿐이어도 리포트가 조용했다 —
        양식 로봇이 매 실행 숫자를 싣고 0~1건이면 🚨 · 쓰지 않는 옛 양식 중 같은 사업으로 보이는 것을 **후보로만**(자동으로 잇지 않는다 · 개발자 결정) ·
        **진짜 schematize-forms.mjs 를 임시 폴더에서 돌린다**
   🔴 표본(고정 예시)만 잰다 — data/·collector/ 장부를 읽어 단정하지 말 것(verify/health-gates.mjs 머리말).
      로봇을 돌릴 때는 저장소 코드를 임시 폴더로 **복사**해 그 안의 표본만 읽고 쓴다(bodies.mjs sandbox). */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { sandbox } from './bodies.mjs';
import { cleanEnv, stripComments } from './gate.mjs';
import { judgeLine, findApplyEmail, staleApplyEmail } from '../../collector/apply-email.mjs';
import { cleanTitle, retitleItems } from '../../collector/clean-title.mjs';
import { deadlineHintFrom, hintWithoutChrome, isChromeHint } from '../../collector/deadline-hint.mjs';
import { boilerMulti, boilerFor } from '../../collector/page-boilerplate.mjs';
import { parseDeadline, bodyDeadlineFrom, makeBodyReader } from '../../collector/notice-deadline.mjs';
import { openOn, promotableOn, absorbsOn } from '../../collector/registered-merge.mjs';
import { extractDatedRows, dropRowNumbers, retitleStored } from '../../collector/board-links.mjs';
import { buildSearchIndex } from '../../collector/build-search-index.mjs';
import { portalNameCandidates, portalCandidates } from '../../collector/portal-candidates.mjs';

const require = createRequire(import.meta.url);
const J = (x) => `${JSON.stringify(x, null, 1)}\n`;

/* 같은 사업(푸른등대 K-원전) 세 학교 글 — 실데이터 제목 그대로(세종대 등록분과 부산대 글은 사업 열쇠가 달라 이름 대조로만 같은 사업이 된다) */
const KWON = {
  sejong: '푸른등대 한국수력원자력 K-원전 신규장학생 선발안내',
  busan: '2026년 푸른등대 한국수력원자력 K-원전 장학금 신규 장학생 선발 안내',
  dongguk: '[홍보] 2026년 푸른등대 한국수력원자력 K-원전 장학금 신규장학생 선발 안내',
};
/* 가짜 항공대 — 쪽마다 같은 머리 배너(교수 채용)와 메뉴 줄 + 서로 다른 본문 기간 줄 (2026-10-04 실측 꼴) */
const KAU = 'https://kau.example.ac.kr/web/pages/gc32172b.do?siteFlag=www&bbsFlag=View&bbsId=0119&nttId=';
/* 배너가 두 줄로 갈라져 그려지는 판 — 이름표가 줄 머리에 오면 날짜 판독기(extractDeadline)도 배너 날짜를 읽는다 */
const BANNER = ['모집대상 : 정년 및 비정년트랙', '접수기간 : 2026.10.15.(목) 13:30까지'];
const CHROME = ['통합검색', '2027학년도 1학기 전임교원 채용', ...BANNER, '2026 동계 어학연수 (Advanced Language Program)모집 안내 자세히', '주메뉴 바로가기', '대학소개', '입학안내', '개인정보처리방침'];
const kauPage = (no, title, body) => ({ url: `${KAU}${no}`, title, text: [...CHROME, title, ...body, '목록'].join('\n') });
const KAU_PAGES = [
  kauPage(11234, '2026 대전청년 내일 장학생 선발 안내', ['가. 지원 대상 : 대전시 거주 대학생', '나. 신청기간 : 2026. 9. 1.( 화 ) ~ 10. 8.( 목 ) 17:00 까지 ( 기간 연장 )', '라. 신청방법 : 대전청년포털']),
  kauPage(10681, '2026년 2학기 청년창업농장학금 신청 안내', ['1) 지원 대상 : 영농 창업 희망 재학생', '2) 신청 기간 : 2026. 6. 1. ( 월 ) ~ 7. 6. (월 )']),
  kauPage(11156, '2026년 하반기 인재육성(성취) 장학생 선발 안내', ['1. 선발 대상 : 재학생', '2. 접수 기간 : 2026. 9. 8. ( 화 ) ~ 9. 23. ( 수 )']),
];
const linesOf = (p) => p.text.split('\n');

export default async function qnotice(eq, ctx) {
  const root = ctx.root;

  /* ── ① 메일 접수 — 예외·서류 전용 ── */
  {
    const take = (line, before) => { const v = judgeLine(line, before); return v && v.ok ? 'ok' : (v ? v.why : null); };
    const KOREA = '※ 온라인 신청 오류 발생 시 scholarship@korea.ac.kr로 제출';
    const YONSEI = "… 들어가 하단에 있는 '새글'버튼을 눌러 신청서를 작성 하여주시기 바랍니다. ('새글'버튼을 눌러서 신청서 작성 후 저장해야 장학금 신청 완료됨) 관련 제출서류는 scholar@yonsei.ac.kr로 보내주시기 바랍니다. 메일 발송 시 반드시 제목은 ‘신문고장학금(";
    eq('① 오류 발생 시에만 쓰는 예비 메일은 접수처가 아니다 (고려대 송화재단 원문)', take(KOREA), '예외 경로(오류·불가피 시)');
    eq('  업로드 오류 때 서류 메일도 (조선대 원문)', take('※ 업로드 오류 발생 시 이메일 서류제출 : scholarship@chosun.ac.kr'), '예외 경로(오류·불가피 시)');
    eq('  신청은 새글·저장으로 끝나고 메일은 서류만 (연세대 신문고 원문)', take(YONSEI), '신청은 다른 경로 — 메일은 서류만');
    /* 같은 공고의 다른 판 — 두 말이 앞 줄과 메일 줄로 갈라져 있다 */
    const Y_LINES = [
      "신문고장학금(재난) 신청을 원하시면 신문고 장학금 탭에 들어가 하단에 있는 '새글'버튼을 눌러 신청서를 작성하여주시기 바랍니다. ('새글'버튼을 눌러서 신청서 작성 후 저장해야 장학금 신청 완료됨)",
      '관련 제출서류는 scholar@yonsei.ac.kr로 보내주시기 바랍니다. 메일 발송 시 반드시 제목은 ‘신문고장학금(재난) 서류 제출(학번, 이름)’ 형식으로 기재하시기 바랍니다.',
    ];
    eq('  앞 줄이 다른 경로를 말하면 서류 메일 줄도 접수처가 아니다', findApplyEmail(Y_LINES.join('\n')), null);
    eq('  (앞 줄 없이 그 줄만 보면 받는다 — 앞 줄을 넘기는 것이 하는 일)', take(Y_LINES[1]), 'ok');
    /* 계속 받아야 하는 줄 — test-collector 「메일 접수 주소」의 받는 줄 넷 + 합성 하나 */
    for (const l of [
      '9. 지원방법 : [ 붙임 ] 의 신청서를 작성하여 관재팀 이메일 (khsa0063@khu.ac.kr) 로 제출',
      '◯ 접수주소 : nohsy12@518.org (※우편접수 불가)',
      '⑥ 서류 준비 및 메일(injae@uri.re.kr)로 신청서(3종), 증빙서류 제출',
      '다 . 멘토활동계획서 제출 방법 : 이메일 : scholarship@hufs.ac.kr 또는 장학팀 ( 학생회관 121 호 ) 직접 제출',
      '[합성] 신청서를 작성하여 이메일(a@b.ac.kr)로 제출하면 신청이 완료됩니다',
      '❍ 신청서 및 구비서류 전부 e-mail 제출 (jh@sri.re.kr )',
    ]) eq(`  받는 줄은 그대로 받는다: ${l.slice(0, 28)}…`, take(l), 'ok');
    eq('  홈페이지에서 신청서를 받아 메일로 내는 공고는 메일 접수다',
      findApplyEmail('가. 홈페이지에서 신청서 양식 다운로드\n나. 작성한 신청서와 증빙서류를 apply@found.or.kr 로 제출')?.email, 'apply@found.or.kr');

    /* 이미 들어간 값 — 로봇 값만 다시 묻는다 */
    const robot = (src) => ({ applyEmail: 'scholarship@korea.ac.kr', applyEmailSource: src, applyEmailFrom: '공고 원문' });
    eq('  로봇 값 + 예외 줄 → 걷는다', staleApplyEmail(robot(KOREA)), true);
    eq('  사람(관리자) 값은 건드리지 않는다', staleApplyEmail({ ...robot(KOREA), applyEmailFrom: '관리자 2026-10-04' }), false);
    eq('  정상 근거면 그대로', staleApplyEmail(robot('5. 접수 : 2026. 10. 16.(금) 오후 5시까지 scholarship@korea.ac.kr 으로 제출')), false);
    eq('  잘린 근거라 내는 낱말이 창 밖이면 지우지 않는다(본문 없는 날 멀쩡한 주소를 잃는다)',
      staleApplyEmail(robot('… 붙임 서식 작성 · 사진 첨부 · 스캔본 하나로 scholarship@korea.ac.kr …')), false);

    /* 진짜 발췌기를 임시 폴더에서 — 예외 줄로 들어간 값은 지우고, 같은 본문의 정상 줄이 있으면 새 규칙으로 다시 찾는다 */
    const sb = sandbox(root, 'hdj-qnotice-mail-');
    try {
      const U1 = 'https://www.korea.ac.kr/notice/1';
      const U2 = 'https://www.korea.ac.kr/notice/2';
      /* 본문 분량(한글 MIN_BODY)을 넘겨야 '원문 있음' 길로 간다 */
      const BODY = '지원 대상은 국내 대학에 재학 중인 학부생으로서 직전 학기 성적이 평균 이상인 학생입니다.\n'
        + '선발된 학생에게는 한 학기 등록금 전액과 생활비를 함께 지원하며 학업 계획서를 심사합니다.\n';
      sb.write('collector/extracted/notices-text.json', [
        { title: '2026 표본재단 장학생 선발', url: U1, text: BODY + '6. 신청방법 : 방문 제출 또는 온라인 신청\n' + KOREA + '\n7. 문의 : 장학팀' },
        { title: '2026 표본장학회 장학생 선발', url: U2, text: BODY + '5. 접수 : 2026. 10. 16.(금) 오후 5시까지 ga@sample.com 으로 제출\n' + KOREA },
      ]);
      sb.write('data/registered.json', { items: [
        { id: 't1', name: '2026 표본재단 장학생 선발', sourceUrl: U1, ...robot(KOREA) },
        { id: 't2', name: '2026 표본장학회 장학생 선발', sourceUrl: U2, ...robot(KOREA) },
        { id: 't3', name: '2026 사람이 넣은 메일', sourceUrl: 'https://x.ac.kr/3', ...robot(KOREA), applyEmailFrom: '관리자 2026-10-04' },
      ] });
      const r = sb.run('collector/extract-excerpts.mjs', ['--write'], { EXCERPTS_AS_LIB: '' });   // test-collector 가 켜 둔 '라이브러리로만' 스위치를 끈다
      const out = sb.json('data/registered.json');
      const by = Object.fromEntries((out?.items || []).map((x) => [x.id, x]));
      eq('  [발췌기 실행] 끝까지 돈다', r.status, 0);
      eq('  [발췌기 실행] 예외 줄로 들어간 메일 세 칸을 걷는다', [by.t1?.applyEmail, by.t1?.applyEmailSource, by.t1?.applyEmailFrom], [undefined, undefined, undefined]);
      eq('  [발췌기 실행] 같은 본문의 정상 줄이 있으면 새 규칙으로 다시 찾는다', by.t2?.applyEmail, 'ga@sample.com');
      eq('  [발췌기 실행] 사람이 넣은 값은 그대로', by.t3?.applyEmail, 'scholarship@korea.ac.kr');
    } finally { sb.done?.(); }
  }

  /* ── ② 게시판 행 꼬리 · 배너 기간 ── */
  {
    eq('② 제목 행 꼬리(부서 · 게시일 · 조회수)는 뗀다',
      ['2026년 하반기 인재육성 성취(대) 장학생 선발 안내 학생지원팀 2026-09-28 142', '2026학년도 2학기 교내장학금 신청 안내 학생지원팀 2026-09-02 1,076',
        '2026-2 전공페스타 한마당행사 운영 안내 드림디자인칼리지 2026-09-22 2,065'].map(cleanTitle),
      ['2026년 하반기 인재육성 성취(대) 장학생 선발 안내', '2026학년도 2학기 교내장학금 신청 안내', '2026-2 전공페스타 한마당행사 운영 안내']);
    eq('  목록 열 「첨부파일 있음」·폭 없는 공백을 뗀다 (서울대·항공대·계명대 소식)',
      [cleanTitle('2026학년도 2학기 등록금 납부 안내 첨부파일 있음'), cleanTitle('​대학 캠퍼스 방송 촬영 안내 총무팀 2026-09-30 128'), cleanTitle('제122회 <대학원생 콜로키움>에 초대합니다. ​')],
      ['2026학년도 2학기 등록금 납부 안내', '대학 캠퍼스 방송 촬영 안내', '제122회 <대학원생 콜로키움>에 초대합니다.']);
    const KEEP = ['셔틀 운행 2026-10-05 중단 안내', '서류 마감 2026-10-02 18시', '리포트 집중지도(1차) 참가자 발표(*첨부파일 필독)',
      '제 36기 미래에셋 해외교환 장학생 선발 안내 2026.09.01.(화)~2026.10.06.(화)', '2026 동계 어학연수 (Advanced Language Program) 모집 안내'];
    eq('  제목 속 날짜·첨부 낱말·맨 앞 연도는 남긴다', KEEP.map(cleanTitle), KEEP);
    eq('  두 번 돌려도 같다', KEEP.concat('2026학년도 2학기 등록금 납부 안내 첨부파일 있음').map((t) => cleanTitle(cleanTitle(t)) === cleanTitle(t)), Array(6).fill(true));

    const set = boilerFor(boilerMulti([KAU_PAGES]), KAU_PAGES[0].url);
    eq('  (대조군) 껍데기를 안 걷으면 세 쪽 모두 배너가 힌트다', KAU_PAGES.map((p) => /^접수기간 : 2026\.10\.15/.test(deadlineHintFrom(p.text.replace(/\n/g, ' ')) || '')), [true, true, true]);
    eq('  껍데기 줄(배너·메뉴)을 걷으면 각 쪽의 본문 기간 줄이 힌트다',
      KAU_PAGES.map((p) => (hintWithoutChrome(linesOf(p), set) || '').slice(0, 14)), ['신청기간 : 2026. 9', '신청 기간 : 2026. ', '접수 기간 : 2026. ']);
    const bannerHint = deadlineHintFrom(KAU_PAGES[0].text.replace(/\n/g, ' '));
    eq('  배너에서 시작한 힌트는 껍데기 힌트다 · 본문 힌트는 아니다 · 껍데기를 모르면 아니다',
      [isChromeHint(bannerHint, set), isChromeHint(hintWithoutChrome(linesOf(KAU_PAGES[0]), set), set), isChromeHint(bannerHint, new Set())], [true, false, false]);

    /* 발행 단계의 읽개 — 실린 글(배너 힌트)은 저장된 원문으로 다시 읽고 · 원문 없는 글은 비우고 · 이번 실행 글은 늘 걷고 · 껍데기를 모르는 호스트는 그대로 */
    const run = new Map();
    const fresh = { url: `${KAU}11300`, title: '2026 표본 장학생 선발', deadlineHint: bannerHint };
    run.set(fresh, [...CHROME, '2026 표본 장학생 선발', '신청기간 : 2026. 10. 1. ~ 10. 20.'].join('\n'));
    const r = makeBodyReader({ stored: KAU_PAGES, run, extract: () => null });
    const old1 = { url: KAU_PAGES[0].url, deadlineHint: bannerHint };
    const gone = { url: `${KAU}99999`, deadlineHint: bannerHint };
    const other = { url: 'https://other.example.ac.kr/v?id=1', deadlineHint: bannerHint };
    /* 🔴 '실린 글은 힌트가 껍데기에서 시작했을 때만' — 같은 호스트의 정상 힌트는 원문이 있든 없든 그대로(리뷰 2026-10-05: 이 '만'을 지워도 초록이던 표본) */
    const NORMAL = '신청기간 : 2026. 9. 1. ~ 9. 30. (사람이 고친 힌트)';
    const keepNoText = { url: `${KAU}88888`, deadlineHint: NORMAL };
    const keepWithText = { url: KAU_PAGES[1].url, deadlineHint: NORMAL };
    r.heal(fresh, true); r.heal(old1); r.heal(gone); r.heal(other); r.heal(keepNoText); r.heal(keepWithText);
    eq('  발행 단계 — 이번 실행 글 · 실린 글 · 원문 없는 글 · 껍데기 모르는 호스트 · 같은 호스트의 정상 힌트(원문 없음 · 원문 있음)는 그대로',
      [(fresh.deadlineHint || '').slice(0, 14), (old1.deadlineHint || '').slice(0, 14), gone.deadlineHint, other.deadlineHint === bannerHint,
        keepNoText.deadlineHint, keepWithText.deadlineHint, r.counts.hints],
      ['신청기간 : 2026. 1', '신청기간 : 2026. 9', null, true, NORMAL, NORMAL, 3]);

    /* 실려 있던 장학·활동·재단 글도 발행 때 지금 청소를 입힌다(원칙 7 소급 · 리뷰 2026-10-05 — 예전엔 소식만 소급됐다) · 주소는 그대로 */
    const stored = [{ title: '2026학년도 2학기 등록금 납부 안내 첨부파일 있음', url: 'https://a.example/1#n-x' }, { title: KEEP[0], url: 'https://a.example/2' }, { url: 'https://a.example/3' }];
    retitleItems(stored);
    eq('  실린 글 소급(retitleItems) — 제목만 지금 청소로 · 이미 깨끗한 제목·제목 없는 글은 그대로 · 주소는 그대로',
      [stored.map((n) => n.title), stored.map((n) => n.url)], [['2026학년도 2학기 등록금 납부 안내', KEEP[0], undefined], ['https://a.example/1#n-x', 'https://a.example/2', 'https://a.example/3']]);
    const col = stripComments(fs.readFileSync(new URL('collector/collect.mjs', root), 'utf8'));
    eq('  수집기 배선 — 실린 장학 글(피드 메우기 뒤 · 학교별 파일 발행 전) · 활동 · 재단 글에 retitleItems',
      [/retitleItems\(notices\.items\);\s*for \(const n of notices\.items\) \{ bodyReader\.heal\(n\);[\s\S]*publishBySchool\(beforeCap\)/.test(col) && col.indexOf('retitleItems(notices.items)') > col.indexOf('healFromLedger('),
        /acts\.items = retitleItems\(freshActs\.concat\(acts\.items \|\| \[\]\)\);/.test(col), /ext\.items = retitleItems\(freshExt\.concat\(ext\.items \|\| \[\]\)\);/.test(col)],
      [true, true, true]);
    eq('  수집기 배선 — 이번 실행 상세 글자를 모으고 · 읽개를 만들고 · 새 글(장학·활동·재단)과 실린 글 전부(장학·활동·재단)에 건다',
      [(col.match(/runBodies\.set\(it, detail\.text\)/g) || []).length, /makeBodyReader\(\{[\s\S]*?run: runBodies/.test(col),
        /for \(const it of freshAll\) \{ bodyReader\.heal\(it, true\); bodyReader\.fill\(it\); \}/.test(col), /freshActs\.concat\(freshExt\)\) bodyReader\.heal\(it, true\)/.test(col),
        /for \(const n of notices\.items\) \{ bodyReader\.heal\(n\); bodyReader\.fill\(n\); \}[\s\S]*publishBySchool\(beforeCap\)/.test(col),
        /acts\.items\.forEach\(\(n\) => bodyReader\.heal\(n\)\)/.test(col), /ext\.items\.forEach\(\(n\) => bodyReader\.heal\(n\)\)/.test(col)],
      [3, true, true, true, true, true, true]);
    /* url-key.cjs 가 이 소스를 new Function 으로 평가한다(2026-09-12 감사 전멸 자리) — import 를 더하면 여기서 터진다 */
    eq('  deadline-hint.mjs 는 아무것도 불러오지 않는다 · url-key.cjs 다리가 그대로 돈다',
      [/^import /m.test(fs.readFileSync(new URL('collector/deadline-hint.mjs', root), 'utf8')), typeof require('../../collector/url-key.cjs').deadlineHintFrom], [false, 'function']);
  }

  /* ── ③ 자동 등록 — 원문 마감을 먼저 본다 ── */
  {
    const { lastDateIn, registeredAfterDeadline } = require('../entry-rules.cjs');
    let setLib = false;
    if (!process.env.EXCERPTS_AS_LIB) { process.env.EXCERPTS_AS_LIB = '1'; setLib = true; }
    const { activityExcerpts } = await import('../../collector/activity-excerpts.mjs');
    if (setLib) delete process.env.EXCERPTS_AS_LIB;
    const extract = (t) => activityExcerpts(t).deadline;
    const T = '2026-10-04';
    eq('③ 본문 마감(근거 문구와 함께)을 먼저 본다 — 제목·요약에 기간이 없는 청년창업농장학금',
      parseDeadline({ title: '2026년 2학기 청년창업농장학금 신청 안내', deadlineHint: null, bodyDeadline: '2026-07-06', bodyDeadlineText: '2) 신청 기간 : 2026. 6. 1. ( 월 ) ~ 7. 6. (월 )' }, T),
      { date: '2026-07-06', text: '2) 신청 기간 : 2026. 6. 1. ( 월 ) ~ 7. 6. (월 )', from: '공고 원문' });
    eq('  본문 마감이 없으면 예전처럼 제목 (~9/17) 에서 · 근거 문구 없는 본문 마감·달력에 없는 날은 쓰지 않는다',
      [parseDeadline({ title: '고졸후학습자 장학금 신청(~9/17)' }, T)?.date, parseDeadline({ title: '고졸후학습자 장학금 신청(~9/17)', bodyDeadline: '2026-07-06' }, T)?.date,
        parseDeadline({ title: '장학생 선발', bodyDeadline: '2026-02-31', bodyDeadlineText: '2026. 2. 31' }, T)],
      ['2026-09-17', '2026-09-17', null]);
    const set = boilerFor(boilerMulti([KAU_PAGES]), KAU_PAGES[1].url);
    const got = bodyDeadlineFrom(KAU_PAGES[1].text, set, extract, lastDateIn);
    eq('  껍데기를 걷은 본문에서 장학과 같은 판독기로 — 날짜와 그 날짜를 내는 원문 한 줄', [got?.date, lastDateIn(got?.text || '', '2026') === got?.date], ['2026-07-06', true]);
    /* 배너만 남은 쪽(본문 기간 줄 없음)을 껍데기를 안 걷고 읽으면 배너 날짜가 나온다 — 그래서 껍데기를 모르면 읽지 않는다 */
    const bannerOnly = KAU_PAGES[0].text.split('\n').filter((l) => !/신청기간/.test(l)).join('\n');
    eq('  🔴 껍데기를 모르는 호스트는 읽지 않는다 — 배너 날짜(10-15)가 모든 글의 마감이 되는 것을 막는다',
      [bodyDeadlineFrom(KAU_PAGES[1].text, undefined, extract, lastDateIn), bodyDeadlineFrom(KAU_PAGES[1].text, new Set(), extract, lastDateIn), extract(bannerOnly), bodyDeadlineFrom(bannerOnly, set, extract, lastDateIn)],
      [null, null, '2026-10-15', null]);
    const L = { auto: true, listedAt: '2026-10-04', deadline: '2026-07-06', deadlineFrom: '공고 원문' };
    eq('  등록할 때 이미 끝나 있던 로봇 등록분 — 사람 표식·양식·여러 학교 근거·제때 등록·사람 등록은 빼지 않는다',
      [registeredAfterDeadline(L), registeredAfterDeadline({ ...L, deadlineFrom: '관리자 2026-10-04' }), registeredAfterDeadline({ ...L, formId: 'f1' }),
        registeredAfterDeadline({ ...L, alsoPostedAt: [{ school: 'x' }] }), registeredAfterDeadline({ ...L, deadline: '2026-10-04' }), registeredAfterDeadline({ ...L, auto: false })],
      [true, false, false, false, false, false]);

    /* 지난 회차 장부 — 순수 함수(collector/past-rounds.mjs) */
    {
      const PR = await import('../../collector/past-rounds.mjs');
      const late = { id: 'auto-a', name: KWON.sejong, deadline: '2026-09-28', sourceUrl: 'https://s.example/a', eligibility: { schoolOnly: '세종대학교' } };
      let L = PR.recordPastRounds(null, [late], '2026-10-05');
      L = PR.recordPastRounds(L, [late], '2026-10-06');
      eq('  지난 회차 장부 — 같은 id 는 한 줄(뺀 날만 새로) · 판정은 부르는 쪽이 넘긴 것 그대로 · 60일 지난 줄만 지운다',
        [L.items.length, L.items[0].droppedAt, L.items[0].school, PR.pastRoundOf(L, (x) => x.name === KWON.sejong)?.id, PR.pastRoundOf(L, () => false),
          PR.prunePastRounds(L, '2026-12-05').removed, PR.prunePastRounds(L, '2026-12-06').removed],
        [1, '2026-10-06', '세종대학교', 'auto-a', null, 0, 1]);
    }

    /* 진짜 자동 등록을 사본 저장소에서 — 불러오는 순간 실행되는 파일이라 import 하지 않는다 */
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hdj-qnotice-areg-'));
    try {
      for (const d of ['collector/extracted', 'verify', 'data']) fs.mkdirSync(path.join(dir, d), { recursive: true });
      for (const f of fs.readdirSync(fileURLToPath(root))) if (f.endsWith('.js')) fs.copyFileSync(fileURLToPath(new URL(f, root)), path.join(dir, f));
      for (const f of fs.readdirSync(fileURLToPath(new URL('collector/', root)))) if (f.endsWith('.mjs')) fs.copyFileSync(fileURLToPath(new URL(`collector/${f}`, root)), path.join(dir, 'collector', f));
      for (const f of fs.readdirSync(fileURLToPath(new URL('verify/', root)))) if (f.endsWith('.cjs')) fs.copyFileSync(fileURLToPath(new URL(`verify/${f}`, root)), path.join(dir, 'verify', f));
      const w = (rel, body) => fs.writeFileSync(path.join(dir, rel), typeof body === 'string' ? body : J(body));
      const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
      const shift = (n) => new Date(Date.parse(today) + n * 86400000).toISOString().slice(0, 10);
      const U = (n) => `https://kau.example.ac.kr/bbs/view.do?seq=${n}`;
      w('collector/auto-register-config.json', { enabled: true, schools: [], maxPerRun: 8, blockIds: [], blockUrls: [] });
      w('data/notices.json', { items: [
        { title: '2026년 2학기 청년창업농장학금 신청 안내', url: U(10681), school: '한국항공대학교', foundAt: shift(-1) },   // 이미 잘못 등록된 글 — 본문 마감 없음
        { title: '2026 표본재단 장학생 선발 안내', url: U(500), school: '한국항공대학교', foundAt: today, bodyDeadline: shift(-3), bodyDeadlineText: `신청기간 : ~ ${shift(-3)}` },
        { title: '2026 미래표본장학회 장학생 선발 안내', url: U(501), school: '한국항공대학교', foundAt: today, bodyDeadline: shift(20), bodyDeadlineText: `2. 신청기간 : ${shift(1)} ~ ${shift(20)}` },
        /* 브라우저 수집 워크플로 꼴 — 수집기가 본문 마감을 안 채운 채 온 글. 저장된 원문(가짜 항공대 3쪽)에서 자동 등록이 채워 거른다(9/23 마감) */
        { title: KAU_PAGES[2].title, url: KAU_PAGES[2].url, school: '한국항공대학교', foundAt: today },
        /* 늦은 등록분(세종대 K-원전)과 같은 사업의 다른 학교 글 둘 — 마감을 못 읽은 채 온다(실데이터 재현 꼴 · 리뷰 2026-10-05).
           빼기 전에는 세종대 등록분이 짝이 되어 컨펌 대기였는데, 빼고 나니 부산대 글이 새로 등록되고 동국대 글이 그것을 전국으로 승격했다 */
        { title: KWON.busan, url: 'https://onestop.pusan.example.ac.kr/page?seq=700', school: '부산대학교', foundAt: today },
        { title: KWON.dongguk, url: 'https://www.dongguk.example.edu/article/detail/26766277', school: '동국대학교', foundAt: today },
      ] });
      w('collector/extracted/notices-text.json', KAU_PAGES);   // 실제 파일과 같은 꼴(배열 — 발췌기가 불러올 때 배열로 읽는다)
      w('data/registered.json', { items: [
        { id: 'auto-late', name: '2026년 2학기 청년창업농장학금 신청 안내', type: '교외', provider: '주관 기관 원문 확인', amount: '금액 원문 확인', amountValue: 0, auto: true,
          listedAt: shift(-1), deadline: shift(-90), deadlineFrom: '공고 원문', period: `접수 기간 ~${shift(-90)}`, sourceUrl: U(10681), eligibility: { schoolOnly: '한국항공대학교' } },
        { id: 'auto-human', name: '사람이 고친 표본 장학', type: '교외', auto: true, listedAt: shift(-1), deadline: shift(-90), deadlineFrom: '관리자 2026-10-04', sourceUrl: U(9), eligibility: {} },
        { id: 'auto-kwon-sejong', name: KWON.sejong, type: '교외', provider: '주관 기관 원문 확인', amount: '금액 원문 확인', amountValue: 0, auto: true,
          listedAt: shift(-6), deadline: shift(-8), deadlineFrom: '공고 원문', period: `접수 기간 ~${shift(-8)}`, sourceUrl: 'https://board.sejong.example.ac.kr/notice?articleNo=893809', eligibility: { schoolOnly: '세종대학교' } },
      ] });
      w('data/forms.json', { templates: {} }); w('collector/report.md', '');
      const run = spawnSync(process.execPath, [path.join(dir, 'collector/auto-register.mjs')], { cwd: dir, encoding: 'utf8', env: cleanEnv() });
      const reg = JSON.parse(fs.readFileSync(path.join(dir, 'data/registered.json'), 'utf8'));
      const nts = JSON.parse(fs.readFileSync(path.join(dir, 'data/notices.json'), 'utf8')).items;
      const report = fs.readFileSync(path.join(dir, 'collector/report.md'), 'utf8');
      const by = Object.fromEntries(reg.items.map((i) => [i.sourceUrl, i]));
      eq('  [자동 등록 실행] 끝까지 돈다', [run.status, run.status ? `${run.stdout}${run.stderr}`.slice(-400) : ''], [0, '']);
      eq('  [자동 등록 실행] 등록 뒤 마감이 지나 있던 로봇 등록분은 빼고 · 사람 표식은 둔다 · 리포트에 되돌림',
        [!!by[U(10681)], !!by[U(9)], /등록 뒤 원문에서 마감 경과 확인 — 되돌림 2건/.test(report)], [false, true, true]);
      /* 🔴 뺀 등록분이 막던 같은 사업 글 — 빼도 계속 막는다(같은 실행) · 다른 학교 글에 남의 마감을 적지 않는다 · 원인은 단정하지 않고 마감 출처를 적는다 */
      const kwonIn = (items) => items.filter((i) => /k-?원전/i.test(i.name || '')).map((i) => `${(i.eligibility || {}).schoolOnly || '전국'}`);
      const past = JSON.parse(fs.readFileSync(path.join(dir, 'collector/past-rounds.json'), 'utf8'));
      eq('  [자동 등록 실행] 🔴 뺀 등록분과 같은 사업의 다른 학교 글은 등록·승격하지 않고 \'지난 회차 — 컨펌 대기\'로 · 다른 학교 글에 마감을 적지 않는다',
        [kwonIn(reg.items), (report.match(/같은 사업의 지난 회차\(세종대학교 등록분 · 마감 [\d-]+\) — 새 회차인지 컨펌 대기/g) || []).length, /전국으로 승격/.test(report),
          nts.filter((n) => /k-?원전/i.test(n.title) && n.bodyDeadline).length],
        [[], 2, false, 0]);
      eq('  [자동 등록 실행] 지난 회차 장부에 뺀 두 건 · 리포트는 원인을 단정하지 않고 마감 출처를 적는다',
        [past.items.map((x) => x.id).sort(), /마감 출처: 공고 원문/.test(report), /본문에만 기간이 적혀/.test(report)], [['auto-kwon-sejong', 'auto-late'], true, false]);
      /* 다음 실행 — 등록 목록에서는 빠졌어도 장부가 막는다 · 뺀 글 자신은 '마감 경과'로 거른다 */
      fs.writeFileSync(path.join(dir, 'collector/report.md'), '');
      const run2 = spawnSync(process.execPath, [path.join(dir, 'collector/auto-register.mjs')], { cwd: dir, encoding: 'utf8', env: cleanEnv() });
      const reg2 = JSON.parse(fs.readFileSync(path.join(dir, 'data/registered.json'), 'utf8'));
      const report2 = fs.readFileSync(path.join(dir, 'collector/report.md'), 'utf8');
      eq('  [다음 실행] 장부가 계속 막는다 — 같은 사업 글 둘은 컨펌 대기 · 뺀 글 자신(주소 같음)은 다시 등록하지 않는다',
        [run2.status, kwonIn(reg2.items), (report2.match(/같은 사업의 지난 회차/g) || []).length, reg2.items.some((i) => i.sourceUrl === U(10681))], [0, [], 2, false]);
      eq('  [자동 등록 실행] 뺀 글에 마감을 적어 두어 같은 실행에도 다시 등록하지 않는다',
        [nts.find((n) => n.url === U(10681))?.bodyDeadline, reg.items.filter((i) => i.sourceUrl === U(10681)).length], [shift(-90), 0]);
      eq('  [자동 등록 실행] 본문 마감이 지난 글은 등록하지 않는다 · 열린 글은 그 마감과 근거 문구로 등록한다',
        [!!by[U(500)], by[U(501)]?.deadline, by[U(501)]?.deadlineFrom], [false, shift(20), `공고 원문 · 2. 신청기간 : ${shift(1)} ~ ${shift(20)}`]);
      eq('  [자동 등록 실행] 수집기가 본문 마감을 안 채운 글(브라우저 수집 꼴)도 저장된 원문(껍데기 걷고)에서 채워 끝난 공고를 거른다',
        [!!by[KAU_PAGES[2].url], nts.find((n) => n.url === KAU_PAGES[2].url)?.bodyDeadline], [false, '2026-09-23']);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
    /* 본문 마감 두 칸은 로봇 장부에만 — 폰이 받는 학교별 파일에는 싣지 않는다(앱은 안 쓰는 칸 · 파일이 1할쯤 커졌다) */
    {
      const { publishBySchool } = await import('../../collector/publish-notices.mjs');
      const pdir = fs.mkdtempSync(path.join(os.tmpdir(), 'hdj-qnotice-pub-'));
      try {
        const n = { title: '2026 표본 장학생 선발', url: 'https://kau.example.ac.kr/bbs/view.do?seq=1', school: '한국항공대학교', foundAt: '2026-10-04',
          deadlineHint: '신청기간 : 2026. 10. 1. ~ 10. 20.', bodyDeadline: '2026-10-20', bodyDeadlineText: '2. 신청기간 : 2026. 10. 1. ~ 10. 20.' };
        publishBySchool([n], { dir: new URL(`file://${pdir}/`) });
        const f = fs.readdirSync(pdir).find((x) => x !== 'index.json');
        const got = f ? JSON.parse(fs.readFileSync(path.join(pdir, f), 'utf8')).items[0] : null;
        eq('  본문 마감 두 칸은 장부에만 — 학교별 파일(폰이 받는 것)에는 빼고 · 다른 칸·장부의 글은 그대로',
          [got && 'bodyDeadline' in got, got && 'bodyDeadlineText' in got, got?.deadlineHint, n.bodyDeadline], [false, false, n.deadlineHint, '2026-10-20']);
      } finally { fs.rmSync(pdir, { recursive: true, force: true }); }
    }
    const ar = stripComments(fs.readFileSync(new URL('collector/auto-register.mjs', root), 'utf8'));
    eq('  자동 등록 배선 — 마감 규칙은 notice-deadline.mjs · 되돌림 판정은 entry-rules registeredAfterDeadline (베끼지 않는다)',
      [/from '\.\/notice-deadline\.mjs'/.test(ar), /\bregisteredAfterDeadline\b[^}]*\} = createRequire/.test(ar), /function parseDeadline|const okDate/.test(ar)], [true, true, false]);
    const wfOf = (f) => fs.readFileSync(new URL(`.github/workflows/${f}`, root), 'utf8');
    eq('  지난 회차 장부 배선 — 규칙은 past-rounds.mjs 를 불러 쓰고 · 두 수집 워크플로가 장부를 저장한다 · 병합 규칙이 있다',
      [/import \{ recordPastRounds, prunePastRounds, pastRoundOf \} from '\.\/past-rounds\.mjs'/.test(ar),
        ['collect-scholarships.yml', 'browser-collect.yml'].map((f) => /\[ -f collector\/past-rounds\.json \] && git add collector\/past-rounds\.json/.test(wfOf(f))),
        /^collector\/past-rounds\.json\s+merge=ours/m.test(fs.readFileSync(new URL('.gitattributes', root), 'utf8'))],
      [true, [true, true], true]);
  }

  /* ── ④ 범위 승격은 마감 전만 ── */
  {
    eq('④ openOn — 마감 모름은 열림 · 지난 것은 닫힘 · 오늘·뒤는 열림',
      [openOn({}, '2026-10-04'), openOn({ deadline: '2026-09-18' }, '2026-10-04'), openOn({ deadline: '2026-10-04' }, '2026-10-04'), openOn({ deadline: '2026-10-30' }, '2026-10-04')],
      [true, false, true, true]);
    /* 판정은 registered-merge.mjs 한 곳(실행 코드 없음)이라 표본으로 잰다 — 예전엔 승격 로봇 안에 있어 글자로만 봤고,
       판정 안의 openOn 을 무력화(`openOn(it, TODAY) || true`)해도 관문이 초록이었다(리뷰 2026-10-05 red-green) */
    const T = '2026-10-04';
    const robot = (extra = {}) => ({ auto: true, type: '교외', eligibility: { schoolOnly: '부산대학교' }, deadline: '2026-10-30', ...extra });
    eq('  승격 후보(promotableOn) — 로봇·교외·학교 한정·마감 전만 · 지난 마감·사람 범위·교내·사람 등록·전국은 아니다',
      [promotableOn(robot(), T), promotableOn(robot({ deadline: undefined }), T), promotableOn(robot({ deadline: '2026-09-18' }), T),
        promotableOn(robot({ scopeFrom: '관리자 2026-10-01' }), T), promotableOn(robot({ type: '교내' }), T), promotableOn(robot({ auto: false }), T),
        promotableOn(robot({ eligibility: {} }), T)],
      [true, true, false, false, false, false, false]);
    const nat = (extra = {}) => ({ auto: true, type: '교외', eligibility: {}, deadline: '2026-10-30', ...extra });
    eq('  흡수(absorbsOn) — 마감 전 전국 로봇 등록분만 · 지난 회차는 흡수하지 않는다 · 여러 학교만 받는 공고는 그 학교가 목록에 있을 때만',
      [absorbsOn(nat(), '동국대학교', T), absorbsOn(nat({ deadline: '2026-09-28' }), '동국대학교', T), absorbsOn(nat({ eligibility: { schoolOnly: 'x' } }), '동국대학교', T),
        absorbsOn(nat({ eligibility: { schoolsAny: ['부산대학교', '경희대학교|국제캠퍼스(용인)'] } }), '경희대학교', T),
        absorbsOn(nat({ eligibility: { schoolsAny: ['부산대학교'] } }), '동국대학교', T), absorbsOn(nat({ scopeFrom: '관리자 2026-10-01' }), '동국대학교', T)],
      [true, false, false, true, false, false]);
    const sp = stripComments(fs.readFileSync(new URL('collector/scope-promote.mjs', root), 'utf8'));
    const fnBody = (src, name) => (src.match(new RegExp(`export function ${name}\\([\\s\\S]*?\\n\\}`)) || [''])[0];
    const ar = stripComments(fs.readFileSync(new URL('collector/auto-register.mjs', root), 'utf8'));
    const twinPart = (ar.match(/if \(twin\) \{[\s\S]*?\n {2}\}/) || [''])[0];
    eq('  배선 — 승격 로봇 후보·흡수 쪽이 그 판정을 오늘 날짜로 부르고 · 자동 등록 흡수(openOn)·승격(promotableOn) 두 갈래 (registered-merge.mjs 한 곳 · 베끼지 않는다)',
      [/return promotableOn\(it, TODAY\);/.test(fnBody(sp, 'isCandidate')), /return absorbsOn\(it, school, TODAY\);/.test(fnBody(sp, 'isNationalAbsorber')),
        /if \(!schoolOf\(twin\)\) \{\s*if \(!openOn\(twin, TODAY\)\)/.test(twinPart), /const promotable = promotableOn\(twin, TODAY\);/.test(twinPart),
        /import \{[^}]*\bpromotableOn\b[^}]*\babsorbsOn\b[^}]*\} from '\.\/registered-merge\.mjs'/.test(sp), /import \{[^}]*\bopenOn\b[^}]*\bpromotableOn\b[^}]*\} from '\.\/registered-merge\.mjs'/.test(ar),
        /twin\.auto && twin\.type|it\.auto && it\.type/.test(sp + ar)],
      [true, true, true, true, true, true, false]);
  }

  /* ── ⑤ 소식 제목의 행 꼬리·번호 ── */
  {
    const BASE = 'https://www.yu.example.ac.kr/main/bachelor/bachelor-guide.do';
    const row = (no, title, date, extra = '') => `<tr><td class="num">${extra}</td><td class="title"><a href="${BASE}?mode=view&articleNo=${no}">${title}</a></td><td>관리자</td><td>${date}</td></tr>`;
    const list = (rows) => `<html><body><table><tbody>${rows.join('')}</tbody></table></body></html>`;
    const numbered = extractDatedRows(list([
      row(901, '9 2026학년도 2학기 중간시험 실시 안내', '2026-10-02'), row(902, '8 2026학년도 전기 조기졸업 신청 안내', '2026-10-01'),
      row(903, '7 2026-2학기 강의실 변경 안내', '2026-09-30'), row(904, '6 2026학년도 2학기 중간강의평가 실시 안내', '2026-09-29')]), BASE);
    eq('⑤ 번호 칸이 링크 안에 든 게시판 — 행 번호를 뗀다 (영남 꼴)', numbered.map((r) => r.title),
      ['2026학년도 2학기 중간시험 실시 안내', '2026학년도 전기 조기졸업 신청 안내', '2026-2학기 강의실 변경 안내', '2026학년도 2학기 중간강의평가 실시 안내']);
    const single = extractDatedRows(list([
      row(911, '3 대 3 농구대회 참가 안내', '2026-10-02'), row(912, '2026학년도 2학기 중간시험 실시 안내', '2026-10-01'),
      row(913, '2026-2학기 강의실 변경 안내', '2026-09-30'), row(914, '중간강의평가 실시 안내', '2026-09-29')]), BASE);
    eq('  번호가 한 행에만 있으면 제목의 일부다 — 그대로', single.map((r) => r.title)[0], '3 대 3 농구대회 참가 안내');
    const kau = extractDatedRows(list([
      row(921, '[의료지원실] 시험기간 비타민 데이 안내 학생지원팀 2026-10-02 26', '2026-10-02'), row(922, '대학 캠퍼스 방송 촬영 안내 총무팀 2026-09-30 128', '2026-09-30'),
      row(923, '2026학년도 비교과 프로그램 통합 사전 요구조사 실시 안내 미래교육혁신원 2026-09-30 118', '2026-09-30'), row(924, '2026-2 전공페스타 한마당행사 운영 안내 드림디자인칼리지 2026-09-22 2,065', '2026-09-22')]), BASE);
    eq('  링크가 행 전체를 감싼 게시판 — 부서·게시일·조회수를 뗀다 (항공대 꼴)', kau.map((r) => r.title),
      ['[의료지원실] 시험기간 비타민 데이 안내', '대학 캠퍼스 방송 촬영 안내', '2026학년도 비교과 프로그램 통합 사전 요구조사 실시 안내', '2026-2 전공페스타 한마당행사 운영 안내']);
    eq('  맨 앞 연도는 번호가 아니다 (모든 행이 「2026 …」이어도)',
      dropRowNumbers(['2026 동계 어학연수 안내', '2026 하계 계절학기 안내', '2026 장학 안내'].map((title) => ({ title }))).map((r) => r.title),
      ['2026 동계 어학연수 안내', '2026 하계 계절학기 안내', '2026 장학 안내']);
    /* 실려 있던 글 — 영남 6건 꼴 · 다른 게시판의 한 건은 그 게시판끼리만 센다 · 주소·글 번호는 그대로 */
    const stored = ['9 2026학년도 2학기 중간시험 실시 및 부정행위자 처리 기준 안내', '8 2026학년도 2학기 교양, 교직, 일반선택 중간시험 시간표 안내(주간, 야간)',
      '7 2026학년도 전기(27년2월) 조기졸업 신청 안내', '6 2026-2학기 정보전산원 수업 강의실 변경 안내 및 협조 요청 (9월28일부터)',
      '5 2026학년도 2학기 중간강의평가 실시 안내', '4 2026학년도 2학기 졸업예정자(최종학기) 조기취업 공인출석 안내']
      .map((title, i) => ({ school: '영남대학교', title, url: `${BASE}?mode=view&articleNo=2318${i}`, postId: `2318${i}` }));
    const other = { school: '영남대학교', title: '3 대 3 농구대회 참가 안내', url: 'https://www.yu.example.ac.kr/main/campus/notice.do?mode=view&no=1' };
    const kauStored = { school: '한국항공대학교', title: '\u200b대학 캠퍼스 방송 촬영 안내 총무팀 2026-09-30 128', url: 'https://kau.example.ac.kr/bbs/list#n-x', postId: '77' };
    const urls = stored.concat(other, kauStored).map((n) => [n.url, n.postId]);
    retitleStored(stored.concat(other, kauStored));
    eq('  실려 있던 글 — 게시판별로 번호를 떼고 · 다른 게시판 한 건은 그대로 · 꼬리·폭 없는 공백도 · 주소·글 번호 그대로',
      [stored.every((n) => !/^\d{1,4}\s/.test(n.title)), other.title, kauStored.title, JSON.stringify(stored.concat(other, kauStored).map((n) => [n.url, n.postId])) === JSON.stringify(urls)],
      [true, '3 대 3 농구대회 참가 안내', '대학 캠퍼스 방송 촬영 안내', true]);
    const cn = stripComments(fs.readFileSync(new URL('collector/collect-news.mjs', root), 'utf8'));
    eq('  소식 로봇 배선 — 실려 있던 글에만(새 글과 섞기 전) retitleStored · 같은 글 합치기보다 먼저',
      /freshAll\.concat\(retitleStored\(loadPublished\(\)\)\)[\s\S]*collapseSamePost\(all\)/.test(cn), true);
  }

  /* ── ⑥ 도우미 검색 재료에 메뉴·남의 제목이 없다 ── */
  {
    const H = 'https://hdj.example.ac.kr/bbs/view?no=';
    const MENU = ['스킵네비게이션', '주메뉴바로가기', '로그아웃', '학생포탈 eclass', '대학공지'];
    const FILL = ['지원 대상은 국내 대학에 재학 중인 학부생으로서 직전 학기 성적이 평균 이상인 학생입니다.',
      '선발된 학생에게는 한 학기 등록금 전액과 생활비를 함께 지원하며 학업 계획서를 심사합니다.',
      '신청 서류는 재단 누리집에서 내려받아 작성한 뒤 기한 안에 전자우편으로 제출하시기 바랍니다.'];   // 본문 분량(한글 MIN_BODY)을 넘긴다
    /* 본문 줄은 쪽마다 글자가 달라야 한다 — 같으면 그 줄도 껍데기로 배운다(그러면 본문 분량이 모자라 '원문 없음'이 된다) */
    /* 걸러야 할 줄을 본문 **앞**에 둔다 — 뒤에 두면 한 공고 글자 상한(PER_ITEM)에 먼저 잘려, 규칙을 빼도 낱말이 안 들어와 관문이 헛돈다(만들면서 그랬다) */
    const page = (no, title, extra) => ({ url: `${H}${no}`, title, text: [...MENU, title, ...extra, ...FILL.map((l) => `${l} (${'가나다라'[no - 1]}반)`)].join('\n') });
    /* 같은 호스트 4쪽 — 정식 등록은 그중 둘뿐이라 '여러 공고에 나오는 낱말 빼기'(두 건 문턱)만으로는 메뉴 낱말이 안 걸러진다(실제 학교 다수가 이 꼴) */
    const texts = [
      page(1, '2026 표본 장학생 선발 안내 하나', ['본문 줄 2026 수달문화재단 장학생 선발 안내 참고', '특이 요건 도토리숲기금 추천서 필수', '부엉이복지회 장학금 수혜자 발표', '2026.08.03', '이전글', '2026 너구리재단 하반기 장학생 모집 안내', '첨부파일 없음']),
      page(2, '2026 표본 장학생 선발 안내 둘', ['특이 요건 다람쥐숲기금 면접 필수']),
      page(3, '2026 청설모재단 장학생 선발 안내', ['특이 요건 청설모 지원']),
      page(4, '2026 수달문화재단 장학생 선발 안내', ['특이 요건 수달 지원']),
    ];
    const items = [{ id: 'q1', name: '2026 표본 장학생 선발 안내 하나', sourceUrl: `${H}1` }, { id: 'q2', name: '2026 표본 장학생 선발 안내 둘', sourceUrl: `${H}2` }];
    const out = buildSearchIndex(items, texts, {}).items;
    const has = (id, w) => String(out[id] || '').split(' ').includes(w);
    eq('⑥ 검색 재료 — 제 고유 낱말은 있다', [has('q1', '도토리숲기금'), has('q2', '다람쥐숲기금')], [true, true]);
    eq('  메뉴 낱말(껍데기 줄)이 없다', ['로그아웃', '학생포탈', 'eclass', '스킵네비게이션'].filter((w) => has('q1', w) || has('q2', w)), []);
    eq('  「이전글」 뒤 남의 제목 · 말뭉치의 다른 공고 제목 줄 · 날짜 줄 앞 목록 줄의 낱말이 없다',
      ['너구리재단', '수달문화재단', '부엉이복지회'].filter((w) => has('q1', w)), []);
    const src = stripComments(fs.readFileSync(new URL('collector/build-search-index.mjs', root), 'utf8'));
    const fn = (src.match(/export function buildSearchIndex\([\s\S]*?\n\}/) || [''])[0];
    eq('  불러오기만 하면 쓰지 않는다 — 본편은 직접 실행할 때만 · 함수는 파일을 안 쓴다 · 읽기 재료는 notice-source makeTitleLine(베끼지 않는다)',
      [/if \(process\.argv\[1\] && import\.meta\.url === pathToFileURL\(path\.resolve\(process\.argv\[1\]\)\)\.href\) main\(\);\s*$/.test(src), !!fn && !/writeFileSync|readFileSync/.test(fn),
        /import \{[^}]*makeTitleLine[^}]*\} from '\.\/notice-source\.mjs'/.test(src)], [true, true, true]);
  }

  /* ── ⑦ 포털 후보는 원문에서 이름을 찾는다 ── */
  {
    const names = (l) => portalNameCandidates([l]).map((c) => c.name);
    eq('⑦ 신청 길 줄에서 시스템 이름을 읽는다 (고려대·국민대 원문)',
      [names('가. 포털(KUPID) → 학사 → 등록·장학 → 장학(일반) → 장학금 신청'), names('ㅇ 신청방법 : ON 국민 - 포털 - 학생서비스 - 장학정보 - 장학신청'),
        names('★ 서울캠퍼스 학부생이 있는 경우 : 서울캠퍼스 학부생이 학사정보시스템에서 신청')],
      [['KUPID'], ['ON 국민'], ['학사정보시스템']]);
    /* 이름 꼴은 맞지만 내는 줄이 아닌 것 — 양식 받는 곳 · 결과 보는 곳 · 문의처 · 출력(인하대 원문) · 내는 행위 없음 */
    eq('  내는 줄이 아니면 읽지 않는다 — 내려받기 · 결과 확인 · 문의 · 출력 · 내는 행위 없음',
      [names('장학금 신청서는 포털(KUPID) → 서식자료실에서 다운로드'), names('선발확인 : 포털(KUPID) → 장학 → 신청내역 확인'), names('문의 : 포털(KUPID) 장학 신청 관련 학생지원팀'),
        names('가. 장학금수혜신청서 ( 인하대학교 포털시스템에서 출력 ) 1 부'), names('학생지원팀 KUPID 공지 참고')],
      [[], [], [], [], []]);
    const TEXT = {
      a: '가. 포털(KUPID) → 학사 → 등록·장학 → 장학(일반) → 장학금 신청', b: '가. 포탈(KUPID) - 학사행정 - 등록/장학 - 장학금신청 - "소망장학금" 신청',
      c: '서울캠퍼스 학부생이 학사정보시스템에서 신청', d: '학부생은 학사정보시스템에서 신청', e: '6. 신청방법 : 온라인 신청 (HUFS Ability) → 로그인 → 장학신청',
    };
    const items = [
      { id: 'a', eligibility: { schoolOnly: '고려대학교' } }, { id: 'b', eligibility: { schoolOnly: '고려대학교' } },
      { id: 'c', eligibility: { schoolOnly: '건국대학교' } }, { id: 'd', eligibility: { schoolOnly: '표본대학교' } }, { id: 'e', eligibility: { schoolOnly: '한국외국어대학교' } },
    ];
    const got = portalCandidates(items, (it) => TEXT[it.id], { knownSystems: new Set(['HUFS Ability']) });
    const by = Object.fromEntries(got.map((c) => [c.school, c]));
    eq('  학교 고유 이름 + 근거 2건만 표 후보 · 여러 학교에 나오는 흔한 이름은 아니다 · 이미 표에 있는 이름은 뺀다',
      [by['고려대학교']?.best.system, by['고려대학교']?.best.count, by['고려대학교']?.unique, by['건국대학교']?.unique, by['한국외국어대학교']], ['KUPID', 2, true, false, undefined]);
    const src = stripComments(fs.readFileSync(new URL('collector/portal-candidates.mjs', root), 'utf8'));
    eq('  불러오기만 하면 쓰지 않는다 — 본편은 직접 실행할 때만 · 내는 줄 판정은 apply-channel.js 것을 불러 쓴다',
      [/if \(process\.argv\[1\] && import\.meta\.url === pathToFileURL\(path\.resolve\(process\.argv\[1\]\)\)\.href\) main\(\);\s*$/.test(src),
        /const AC = createRequire\(import\.meta\.url\)\('\.\.\/apply-channel\.js'\)/.test(src) && /const PORTAL_SUBMIT = AC\.PORTAL_SUBMIT;/.test(src), /const PORTAL_SUBMIT\s*=\s*\//.test(src)],
      [true, true, false]);
    const { judgePortalLine, hasPortalName } = require('../../apply-channel.js');
    eq('  찾아 넣은 고유 이름은 앱 판정이 신청 시스템으로 읽는다 (결과 보는 줄은 아니다)',
      [judgePortalLine(TEXT.a)?.system, judgePortalLine(TEXT.b)?.system, judgePortalLine('다 . 선발확인 : KUPID 로그인 후 확인')?.ok],
      ['KUPID', 'KUPID', false]);

    /* 🔴 표에 이름을 넣으면 **데이터 검사**도 그 이름을 근거로 읽어야 한다 (2026-10-05 리뷰 · 막은 사고) — test-collector 「등록 데이터에 근거 없는
       포털 단정이 없다」가 손으로 적은 낱말 목록(포털만 · 포탈·KUPID 없음)으로 재서, 다음 수집의 발췌기가 고려대 소망장학금에 채울
       applyPortal 'KUPID'(근거 「가. 포탈(KUPID) - 학사행정 - …」)를 근거 없음으로 세어 데이터 관문이 빨개질 참이었다(그날 자동 등록이 통째로 되돌려진다).
       근거 낱말은 apply-channel.js hasPortalName 한 곳(표 + 흔한 이름) — 검사는 그것을 불러 쓴다. */
    eq('  포털 근거 낱말 — 표의 이름(KUPID·인포21) · 포털/포탈 · …정보시스템은 근거 · 메뉴 아닌 맨 낱말(장학팀)은 아니다',
      [hasPortalName(TEXT.b), hasPortalName('나. 포탈 - 학사행정 - 등록/장학 - 장학금신청'), hasPortalName('신청방법: 인포21을 통한 신청'), hasPortalName(TEXT.c), hasPortalName('장학팀 방문 접수')],
      [true, true, true, true, false]);
    const tc = stripComments(fs.readFileSync(new URL('verify/test-collector.mjs', root), 'utf8'));
    const tcPart = tc.slice(tc.indexOf("eq('등록 데이터에 근거 없는 포털 단정이 없다'") - 900, tc.indexOf("eq('등록 데이터에 근거 없는 포털 단정이 없다'"));
    eq('  데이터 검사 배선 — 근거 낱말을 apply-channel.js 에서 받아 쓰고(hasPortalName) 손으로 적은 목록이 없다',
      [/return \{ submitChannelKind, submitChannelLabel, hasPortalName \};/.test(tc), /const hasPortalName = built\.hasPortalName;/.test(tcPart), /PORTAL_WORDS\s*=\s*\//.test(tc)],
      [true, true, false]);
    /* 진짜 발췌기를 임시 폴더에서 — 원문의 「포탈(KUPID)」 줄로 applyPortal 을 채우고, 채운 값이 데이터 검사의 근거 판정을 지난다 */
    const sb = sandbox(root, 'hdj-qnotice-portal-');
    try {
      const U = 'https://www.korea.ac.kr/notice/3856';
      const BODY = '지원 대상은 국내 대학에 재학 중인 학부생으로서 직전 학기 성적이 평균 이상인 학생입니다.\n'
        + '선발된 학생에게는 한 학기 등록금 전액과 생활비를 함께 지원하며 학업 계획서를 심사합니다.\n';
      sb.write('collector/extracted/notices-text.json', [{ title: '2026-2학기 소망장학금 신청 안내', url: U, text: `${BODY}4. 신청방법\n${TEXT.b}\n5. 문의 : 학생지원팀` }]);
      sb.write('data/registered.json', { items: [{ id: 'k1', name: '2026-2학기 소망장학금 신청 안내', sourceUrl: U, auto: true, eligibility: { schoolOnly: '고려대학교' } }] });
      const r = sb.run('collector/extract-excerpts.mjs', ['--write'], { EXCERPTS_AS_LIB: '' });
      const k1 = (sb.json('data/registered.json')?.items || [])[0] || {};
      const docs = [].concat(k1.documents || [], k1.excerpts || []).join(' ');
      eq('  [발췌기 실행] 원문 「포탈(KUPID)」 줄로 신청 시스템을 채우고 · 그 값이 데이터 검사의 근거 판정을 지난다',
        [r.status, k1.applyPortal, hasPortalName(docs) || !!(k1.applyPortalSource && hasPortalName(k1.applyPortalSource))], [0, 'KUPID', true]);
    } finally { sb.done?.(); }
  }

  /* ── ⑧ 양식이 붙은 열린 공고 수 · 옛 양식 후보 (app1-03 ③ · app1-08 ①) ── */
  {
    const T = '2026-10-05';
    const NOW = Date.parse('2026-10-05T03:00:00Z');
    const items = [
      { id: 'a', name: '공통 2026년도 세종연구원 세종이도인재장학금 장학생 모집 안내', deadline: '2026-10-20' },
      { id: 'b', name: '2026 미래 인재육성 장학생 선발 안내', deadline: '2026-10-20' },   // 붙여 쓰면 「미래인재」가 되지만 다른 사업
      { id: 'c', name: '[빅데이터혁신융합대학사업단] 2026학년도 2학기 성과형 장학금(자격증) 신청 안내', listedAt: '2026-09-20' },   // 마감 모름 · 등록 60일 안
      { id: 'd', name: '2026 AI 멘토 장학생 모집', deadline: '2026-10-30', formId: 'used-form' },
      { id: 'e', name: '지난 회차 세종연구원 장학금 공고', deadline: '2026-09-01' },   // 마감 지남 — 세지 않는다
      { id: 'f', name: '오래된 세종연구원 장학금 공고', listedAt: '2026-07-01' },       // 마감 모름 · 등록 60일 지남 — 앱도 숨긴다
      { id: 'g', name: '경영경제전문도서관 국가근로장학생 추가 모집', deadline: '2026-10-20' },   // 근로장학은 학교마다 제 서식
      { id: 'h', name: '없는 양식을 가리키는 공고', deadline: '2026-10-20', formId: 'gone-form' },
    ];
    const templates = {
      'used-form': { title: 'AI 멘토 활동계획서' },
      'sejong-ido-apply': { title: '세종연구원 장학금 지원 신청서 외 3종' },
      'uos-cert': { title: '성과형 장학금(자격증) 신청서' },
      'mirae-apply': { title: '(재)미래인재 장학금 신청서' },   // 「미래 인재육성」(b)과 붙여 쓴 글자로만 겹친다
      'mju-workstudy': { title: '2026-2학기 학기중 교내 국가근로장학생 지원서' },
      'ihanae': { title: '장 학 금 지 급 원 서' },
    };
    const FR = await import('../../collector/form-reach.mjs');
    eq('⑧ 열린 공고 = 마감 전 · 마감 모름이면 등록 60일 안(앱과 같은 notStale) · 양식은 forms.json 에 실제로 있는 것만 센다',
      FR.formReach(items, templates, T, NOW), { open: 6, withForm: 1, ids: ['d'] });
    eq('  옛 양식 후보 — 사업 낱말이 공고 이름 낱말에 들어 있는 짝만 · 붙여 쓴 글자로는 안 잇는다 · 근로장학·이름 없는 서식은 안 잇는다 · 쓰는 양식·닫힌 공고는 빼고',
      FR.oldFormCandidates(items, templates, T, NOW).map((c) => `${c.id}↔${c.formId}`), ['a↔sejong-ido-apply', 'c↔uos-cert']);
    const rep = FR.formReachReport(items, templates, T, NOW, { apiOn: false }).join('\n');
    const rep2 = FR.formReachReport(items.map((i) => (i.id === 'a' ? { ...i, formId: 'sejong-ido-apply' } : i)), templates, T, NOW).join('\n');
    eq('  리포트 — 숫자 줄 · 0~1건이면 🚨 + 유료 변환 스위치 상태 · 후보는 「자동으로 잇지 않아요」와 함께 · 2건이면 🚨 없음',
      [/### 📝 앱에서 바로 쓰는 양식 — 열린 공고 6건 중 1건/.test(rep), /🚨 \*\*양식이 붙은 열린 공고가 1건뿐이에요/.test(rep), /apiEnabled\)은 지금 꺼져 있어요/.test(rep),
        /같은 사업의 옛 양식 후보 2건/.test(rep) && /자동으로 잇지 않아요/.test(rep), /열린 공고 6건 중 2건/.test(rep2) && !/🚨/.test(rep2)],
      [true, true, true, true, true]);

    /* 진짜 양식 로봇을 사본 저장소에서 — 할 일이 없는 날(대기열 비어 있음)에도 숫자 단락이 리포트에 실린다 */
    const sb = sandbox(root, 'hdj-qnotice-reach-');
    try {
      sb.write('verify/entry-rules.cjs', fs.readFileSync(new URL('verify/entry-rules.cjs', root), 'utf8'));
      const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
      const shift = (n) => new Date(Date.parse(today) + n * 86400000).toISOString().slice(0, 10);
      sb.write('collector/schematize-config.json', { enabled: true, apiEnabled: false });
      sb.write('collector/pending-forms.json', { items: [] });
      sb.write('data/registered.json', { items: [
        { id: 'r1', name: '2026 세종연구원 세종이도인재장학금 장학생 모집', deadline: shift(10) },
        { id: 'r2', name: '2026 표본재단 장학생 모집', deadline: shift(10), formId: 'f-used' },
        { id: 'r3', name: '지난 표본 장학 공고', deadline: shift(-10) },
      ] });
      sb.write('data/forms.json', { templates: { 'f-used': { title: '표본재단 장학금 신청서' }, 'sejong-ido-apply': { title: '세종연구원 장학금 지원 신청서 외 3종' } } });
      sb.write('r.md', '');
      const r = sb.run('collector/schematize-forms.mjs', ['r.md'], { ANTHROPIC_API_KEY: '' });
      const out = sb.read('r.md') || '';
      eq('  [양식 로봇 실행] 할 일 없는 날에도 숫자 단락 · 옛 양식 후보가 리포트에 실린다 (불러오기 실패 ⚠️ 없음)',
        [r.status, /### 📝 앱에서 바로 쓰는 양식 — 열린 공고 2건 중 1건/.test(out), /`r1`[^\n]*↔ 양식 `sejong-ido-apply`/.test(out), /세지 못했어요/.test(out)],
        [0, true, true, false]);
    } finally { sb.done?.(); }
    const sf = stripComments(fs.readFileSync(new URL('collector/schematize-forms.mjs', root), 'utf8'));
    eq('  양식 로봇 배선 — form-reach.mjs 를 불러 쓰고(베끼지 않는다) · 마지막(finish)에 이번 실행 판으로 센다',
      [/await import\('\.\/form-reach\.mjs'\)/.test(sf), /function finish\(\) \{[\s\S]*?formReachReport\(reachItems, reachTemplates/.test(sf), /reachTemplates = forms\.templates/.test(sf)],
      [true, true, true]);
  }
}

/* 「원문 링크 정직성」 — candidates 갈래: 원문 후보 확인 (2026-10-04 · 개발자 지시 *"원문 공고 링크를 최대한 어떻게든 찾을 방법"*)
   찾아 온 주소(collector/link-candidates.json · 우리 기록의 같은 제목 글 · 층2와 짝지은 재단 글)를 원문 링크 확인 로봇이 학생처럼 열어,
   **그 공고·그 회차**인 것만 data/link-check.json `fix` 로 앱에 싣는가(collector/link-candidates.mjs · link-check.mjs ⓪).
   잰다:
     G1 판정(acceptCandidate) — 조사(2026-10-03)에서 실제로 나온 꼴을 표본으로: 남구 묶음 공고 · 대하 지난 회차 결과 · 송파 상/하반기 ·
        서울교대 ↔ 서울대 학과 사이트 · 신문 기사 · 목록 화면 · 첫 화면으로 돌려보냄 · 403 · 앱 이름뿐 · 세션 표식 · 겹침 · 관리자 후보
     G2 층2 짝짓기(인터넷 없이) — 음성(마감 · 같은 재단의 다른 사업은 거절) · 아산(층2 홈이 바로 그 글) · 파안(후기) · 동점이면 안 고름
     G3 끝에서 끝까지 — 가짜 관측으로 로봇을 **실제로 돌려** 확인한 후보가 fix 로 실리고 · 네 출력 말고는 안 바뀌고 · 이미 원문인 링크엔
        싣지 않고 · 이튿날 그 주소가 확인 대상이 되고 · 층2 마감이 바뀌면 빠진다
     G4 착지 판정 — 글 주소 → 목록 주소 · 글 번호만 빠진 주소는 결정적 '목록' · 판정이 제목 증거의 세기(ev)를 함께 준다
     G5 걸려 있는가 — 워크플로가 후보 파일 push 로 깨고(기본 브랜치만) · 후보만 보는 모드 · 넷째 파일을 저장·되돌림
     G8 2026-11-20 실측(정답 글 55건 중 5건만 받던 것) — 기대 제목 넓히기 · 제목 자리(「제  목」 칸·제목 줄·첨부 파일 이름) · 재단 표기 · 자체 사업 · 남의 사이트에 재단이 직접 올린 글
     G6 후보 파일 읽기는 무엇이 와도 던지지 않는다 — 잘못된 줄은 리포트 줄이 된다(관문이 빨개지면 그날 자동 등록이 되돌려진다)
   🔴 실데이터 숫자를 박지 않는다 · 진짜 후보 파일을 검사하지 않는다(사람이 잘못 적은 줄은 리포트로 — CLAUDE.md 2026-10-01 사고). */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as C from '../../collector/link-candidates.mjs';
import * as J from '../../collector/link-landing.mjs';
import * as P from '../../collector/link-check-plan.mjs';

const KOSAF = [
  /* 광주 남구 — 공고문 하나에 사업 코드 다섯(조사: 같은 공고문을 쓰는 코드 묶음) */
  ...[['0568001', '행복나눔 장학생'], ['0568002', '일반장학생'], ['0568003', '특별장학생']].map(([code, name]) => ({
    code, org: '광주남구장학회', name, due: '2026-10-02', home: 'https://namgu.gwangju.kr',
    fields: { 신청기간: '○ 2026-09-14~2026-10-02 18:00까지' }, files: [{ name: '(재)남구장학회 제30회 장학생 선발 공고.hwpx' }],
  })),
  /* 대하 — KOSAF 홈은 다음 카페, 공고문 사본에 적힌 사이트는 deaha.or.kr */
  { code: '2000999001', org: '대하장학회', name: '장학금', due: '2026-10-15', home: 'https://cafe.daum.net/deahamyung', fields: { 신청기간: '○ 2026-09-20 ~ 2026-10-15' }, files: [] },
  { code: '2700388001', org: '(재)송파구 인재육성 장학재단', name: '일반장학생', due: '2026-10-02', home: 'http://janghak.songpa.go.kr/main.jsp', fields: { 신청기간: '○ 2026-09-16 ~ 2026-10-02' }, files: [{ name: '송파구인재육성장학재단_공고_제2026-4호.pdf' }] },
  { code: '0767001', org: '재단법인 춘천인재육성장학재단', name: '성적우수장학금', due: '2026-10-07', home: 'http://ccbomnae.or.kr', fields: { 신청기간: '○ 2026-09-28 ~ 2026-10-07' }, files: [{ name: '2026년 하반기 봄내장학생 선발 공고(게시용-QR).hwp' }] },
  /* 음성 — 전입장학금과 군민평생은 다른 사업(다른 공고문) */
  { code: '2000429013', org: '(재)음성군장학회', name: '전입장학금', due: '2026-11-30', home: 'https://scholarship.eumseong.go.kr/www/index.do', fields: { 신청기간: '○ 2026-05-01 ~ 2026-11-30 ※ 예산 소진 시 종료' }, files: [{ name: '[공고문] 2026년 전입장학금 지원 공고.pdf' }] },
  { code: '2000429001', org: '(재)음성군장학회', name: '군민평생 장학금', due: '2026-09-18', home: 'https://scholarship.eumseong.go.kr/www/index.do', fields: { 신청기간: '○ 2026-08-31 ~ 2026-09-18' }, files: [{ name: '2026년 군민평생 장학생 선발 공고.pdf' }] },
  /* 아산 — 층2 홈 주소가 바로 그 글 */
  { code: '2000436005', org: '아산시미래장학회', name: '우수봉사 장학금', due: '2026-11-13', home: 'http://asanmirae.or.kr/main/index.php?m_cd=32&b_id=20260714107548723', fields: { 신청기간: '○ 2026-11-02 ~ 2026-11-13 18:00까지' }, files: [{ name: '우수봉사_대학생_사전공고.hwpx' }] },
  { code: '2703469001', org: '파안장학문화재단법인', name: '장학금', due: '2026-10-02', home: 'https://paan.or.kr', fields: { 신청기간: '○ 2026-09-28 ~ 2026-10-02' }, files: [] },
];
const SNUE_MARK = 'https://www.snue.ac.kr/snue/na/ntt/selectNttList.do?mi=3004&bbsId=1083#n-%EA%B5%AD%EA%B0%80%EA%B7%BC%EB%A1%9C';
const SNUE_TITLE = '2026학년도 2학기 국가근로장학생 희망근로지 2차 신청기간 안내';
const KHU_MARK = 'https://news.khu.ac.kr/kor/user/bbs/BMSR00040/list.do?menuNo=200318#n-%EC%9D%98%EC%95%94';
const DATA = {
  registered: [
    { id: 'reg-khu', name: '의암 손병희 우수논문 장학생 (2026)', boardTitle: '의암 손병희 우수논문 장학생 (2026)', sourceUrl: KHU_MARK, deadline: '2026-10-11', eligibility: { schoolOnly: '경희대학교' } },
    { id: 'reg-s', name: '표본대 2026 성적우수 장학생 선발 공고', boardTitle: '표본대 2026 성적우수 장학생 선발 공고', sourceUrl: 'https://s.ac.kr/bbs/view.do?id=3' },
  ],
  notices: [
    { school: '서울교육대학교', title: SNUE_TITLE, url: SNUE_MARK },
    { school: '서울교육대학교', title: '다른 공고 2026 학사 일정 안내', url: 'https://www.snue.ac.kr/snue/na/ntt/selectNttInfo.do?mi=3004&bbsId=1083&nttSn=999' },
  ],
  news: [], activities: [],
  external: [],
  kosaf: KOSAF,
  kosafTexts: { 2000999001: '접수처: 대하장학회 사무국 (www.deaha.or.kr 공지사항 참고) 한국장학재단 www.kosaf.go.kr' },
  externalSources: [],
  boards: [{ school: '서울교육대학교', urls: ['https://www.snue.ac.kr/snue/na/ntt/selectNttList.do?mi=3004&bbsId=1083'] }, { school: '경희대학교', urls: ['https://news.khu.ac.kr/kor/user/bbs/BMSR00040/list.do?menuNo=200318'] }],
  pool: [],
};
const FILL = '본문 '.repeat(200);
const W = (s) => String(s || '');

export default async function gate(eq, ctx) {
  const root = (ctx && ctx.root) || new URL('../../', import.meta.url);
  const ROOT = fileURLToPath(root);
  const idx = C.buildIndex(DATA);
  const T = (ds, key) => idx.find({ ds, key });
  const judge = (t, cand, obs, others = []) => J.judgeLanding({ ...obs, requestedUrl: cand.url, titles: C.judgeTitles(t, cand), titlesFromNameOnly: !!t.nameOnly, otherTitles: others });
  const accept = (t, cand, obs, extra = {}, others = []) => C.acceptCandidate({
    target: t, cand, obs, verdict: judge(t, cand, obs, others),
    ctx: { owners: idx.ownersOf(cand.url), alsoTargets: Object.fromEntries((cand.also || []).map((k) => [k, T('kosaf', k)])), ...extra },
  });
  const cand = (o) => ({ also: [], source: 'search', by: '표본', addedAt: '2026-10-04', title: '', trusted: false, board: '', ...o });

  /* ── G1 판정 ─────────────────────────────────────────────────────── */
  const namgu = T('kosaf', '0568001');
  const nObs = { status: 200, docTitle: '광주광역시 남구', headings: ['(재)남구장학회 제30회 장학생 선발 공고'],
    text: `(재)남구장학회 제30회 장학생 선발 공고\n1. 선발 분야: 행복나눔 장학생 · 일반장학생 · 특별장학생\n2. 신청기간: 2026. 9. 14.(월) ~ 10. 2.(금) 18:00까지\n작성일 2026.09.10 첨부 ${FILL}` };
  const nCand = cand({ url: 'https://namgu.gwangju.kr/board/view.do?idx=100', also: ['0568002', '0568003'] });
  const nRes = accept(namgu, nCand, nObs);
  eq('G1 남구 묶음 공고 — 공고문 제목이 제목 자리 · 신청기간이 이번 회차 · 같은 공고문을 쓰는 코드도 함께(also) → 원문으로 올림',
    [nRes.status, nRes.alsoOk, nRes.checks.H, nRes.checks.R, nRes.checks.X, nRes.checks.P], ['verified', ['0568002', '0568003'], 'ok', 'ok', 'ok', 'ok']);
  const NT = '2026 남구장학회 행복나눔 장학생 모집 안내';
  const n2 = accept(namgu, cand({ url: 'https://namgu.gwangju.kr/board/view.do?idx=101', title: NT, source: 'match' }),
    { status: 200, docTitle: '광주광역시 남구', headings: [NT], text: `${NT}\n신청기간: 2026. 9. 14.(월) ~ 10. 2.(금)\n작성일 ${FILL}` });
  eq('  재단 이름은 KOSAF 표기(광주남구장학회)에서 지역 머리가 빠진 꼴(남구장학회)도 센다', [n2.status, n2.checks.X], ['verified', 'ok']);
  const dRes = accept(T('kosaf', '2000999001'), cand({ url: 'https://www.deaha.or.kr/sub/sub02_01.php?boardid=notice&mode=view&idx=14', title: '2024-2(후기) 대하장학회 장학생 선발 결과' }),
    { status: 200, docTitle: '대하장학회', headings: ['2024-2(후기) 대하장학회 장학생 선발 결과'], text: `2024-2(후기) 대하장학회 장학생 선발 결과 작성일 2024.09.01 ${FILL}` });
  eq('  대하 「2024-2(후기) … 선발 결과」 — 같은 재단 사이트라도 다른 해·결과 발표는 거절(지난 회차를 이번 공고로 보여 주면 가짜 공지)',
    [dRes.status, dRes.checks.H, /다른 해/.test(dRes.why)], ['rejected', 'ok', true]);
  const songpa = T('kosaf', '2700388001');
  const sObs = (half, period) => ({ status: 200, docTitle: '송파구인재육성장학재단', headings: [`2026년 ${half} 송파구인재육성장학재단 장학생 선발 공고`],
    text: `2026년 ${half} 송파구인재육성장학재단 장학생 선발 공고\n□ 선발 분야: 일반장학생\n□ 접수기간: ${period}\n작성일 ${FILL}` });
  const sUp = accept(songpa, cand({ url: 'https://janghak.songpa.go.kr/22/?bmode=view&idx=171830562&t=board', title: '2026년 상반기 송파구인재육성장학재단 장학생 선발 공고' }), sObs('상반기', '2026. 6. 15.(월) ~ 6. 24.(수) 18:00'));
  const sDown = accept(songpa, cand({ url: 'https://janghak.songpa.go.kr/22/?bmode=view&idx=174161241&t=board', title: '2026년 하반기 송파구인재육성장학재단 장학생 선발 공고' }), sObs('하반기', '2026. 9. 16.(수) ~ 10. 2.(금)'));
  eq('  송파 — 상반기 공고(6/24 마감)는 거절 · 하반기(10/2 마감 = 이번 회차)는 원문', [sUp.status, sUp.checks.R, sDown.status], ['rejected', 'fail', 'verified']);
  eq('  날짜가 안 보여도 반대 학기·반기 제목은 다른 회차(접수 9월에 「상반기」) · 날짜도 학기도 없으면 회차를 못 가린다(사람 확인)',
    [C.roundCheck({ round: { open: '2026-09-16', due: '2026-10-02' }, head: '2026년 상반기 송파구인재육성장학재단 장학생 선발 공고', text: '선발 공고 본문' }).s,
      C.roundCheck({ round: { open: '2026-09-16', due: '2026-10-02' }, head: '2026년 송파구인재육성장학재단 장학생 선발 공고', text: '선발 공고 본문' }).s], ['fail', 'none']);
  const sWeak = accept(songpa, cand({ url: 'https://janghak.songpa.go.kr/22/?bmode=view&idx=174161241&t=board', title: '2026년 하반기 송파구인재육성장학재단 장학생 선발 공고' }),
    { ...sObs('하반기', '2026. 9. 16.(수) ~ 10. 2.(금)'), headings: [] });
  eq('  제목이 제목 자리가 아니라 본문에만 보이면(약한 증거) 원문으로 올리지 않고 사람 확인', [sWeak.status, sWeak.checks.L], ['suggest', 'weak']);
  const snue = T('notices', SNUE_MARK);
  const snuRes = accept(snue, cand({ url: 'https://linguist.snu.ac.kr/23706/', title: SNUE_TITLE }), { status: 200, docTitle: SNUE_TITLE, headings: [SNUE_TITLE], text: `${SNUE_TITLE} 작성일 ${FILL}` });
  eq('  서울교대 표식 ↔ 서울대 학과 사이트의 같은 제목 글 — 사이트가 달라 거절 · snu.ac.kr 는 snue.ac.kr 가 아니다(점 경계)',
    [snuRes.status, snuRes.checks.H, C.hostAllowed('https://linguist.snu.ac.kr/1', snue.allowed), C.hostAllowed('https://www.snue.ac.kr/snue/na/ntt/selectNttInfo.do?nttSn=1', snue.allowed), C.hostAllowed('https://evilsnue.ac.kr/x', snue.allowed)],
    ['rejected', 'fail', false, true, false]);
  const cc = T('kosaf', '0767001');
  const others = ['2026년 상반기 봄내장학생 합격자 발표 안내', '2026 춘천시 청소년 해외연수 참가자 모집', '2026년 춘천 지역인재 장학금 추가 모집 공고'];
  const ccRes = accept(cc, cand({ url: 'http://ccbomnae.or.kr/user/sub5/sub5-1.php?page=1' }),
    { status: 200, docTitle: '춘천인재육성장학재단', headings: ['공지사항'], text: `${others.join('\n')}\n2026년 하반기 봄내장학생 선발 공고\n${FILL}` }, {}, others);
  eq('  춘천 게시판 목록 화면(다른 글 제목이 여럿) — 목록이라 거절', [ccRes.status, ccRes.checks.L], ['rejected', 'fail']);
  const sReg = T('registered', 'reg-s');
  const home = accept(sReg, cand({ url: 'https://s.ac.kr/bbs/view.do?id=9', trusted: true, by: '관리자 표본' }), { status: 200, finalUrl: 'https://s.ac.kr/', docTitle: '표본대학교', text: FILL });
  const blocked = accept(sReg, cand({ url: 'https://s.ac.kr/bbs/view.do?id=10' }), { status: 403 });
  const blocked5 = accept(sReg, cand({ url: 'https://s.ac.kr/bbs/view.do?id=10' }), { status: 403 }, { tries: 4 });
  const trustedUnread = accept(sReg, cand({ url: 'https://s.ac.kr/bbs/view.do?id=11', trusted: true, by: '관리자 표본' }), { status: 403 });
  eq('  첫 화면으로 돌려보내짐은 관리자 후보도 거절 · 403 은 거절이 아니라 다시 봄(다섯 번째면 사람 확인) · 관리자 후보는 못 열어도 원문',
    [home.status, blocked.status, blocked5.status, trustedUnread.status], ['rejected', 'pending', 'suggest', 'verified']);
  const khu = T('registered', 'reg-khu');
  const khuRes = accept(khu, cand({ url: 'https://news.khu.ac.kr/kor/user/bbs/BMSR00040/view.do?menuNo=200318&boardId=322415', title: '2026 의암 손병희 우수논문 장학생 선발 공고' }),
    { status: 200, docTitle: '경희대학교', headings: ['2026 의암 손병희 우수논문 장학생 선발 공고'], text: `2026 의암 손병희 우수논문 장학생 선발 공고 신청기간 2026.10.01 ~ 2026.10.11 작성일 이전글 다음글 ${FILL}` });
  eq('  앱 이름뿐인 정식 등록(게시판 원제목 없음) — 열려도 원문으로 올리지 않고 사람 확인 · 검색 제목은 우리 제목과 같을 때만 증거', [khuRes.status, khuRes.checks.T], ['suggest', 'weak']);
  const PT = '파안장학문화재단법인이 미래 성공이 기대되는 인재를 2026-2(후기) 장학생으로 선발합니다';
  const paanRes = accept(T('kosaf', '2703469001'), cand({ url: 'https://paan.or.kr/sub/sub02_01.php?boardid=notice&mode=view&idx=46', title: PT, source: 'match' }),
    { status: 200, docTitle: '파안장학문화재단', headings: [PT], text: `${PT}\n접수기간: 2026년 9월 28일 ~ 2026년 10월 2일\n작성일 ${FILL}` });
  eq('  층2는 공고문 파일이 없어도(앱 이름뿐) 재단·회차가 보이면 원문 — 「앱 이름뿐」 보류는 정식 등록에만', [paanRes.status, paanRes.checks.T, paanRes.checks.R], ['verified', 'ok', 'ok']);
  const clash = accept(snue, cand({ url: 'https://www.snue.ac.kr/snue/na/ntt/selectNttInfo.do?mi=3004&bbsId=1083&nttSn=999', title: SNUE_TITLE }),
    { status: 200, docTitle: SNUE_TITLE, headings: [SNUE_TITLE], text: `${SNUE_TITLE} 작성일 ${FILL}` });
  eq('  다른 공고(제목이 다름)가 이미 쓰는 주소 — 겹침으로 거절', [clash.status, clash.checks.C], ['rejected', 'fail']);

  /* 판정 → 앱이 받는 fix (publishFix) — 계약: 열쇠·회차·이미 원문인 링크·확정 문제 */
  const st = {
    'kosaf|0568001|n': { ds: 'kosaf', key: '0568001', url: nCand.url, source: 'search', status: 'verified', verifiedAt: '2026-10-01', round: '2026-10-02', also: ['0568002', '0568003'] },
    'registered|reg-s|x': { ds: 'registered', key: 'reg-s', url: 'https://s.ac.kr/bbs/view.do?id=12', source: 'search', status: 'verified', verifiedAt: '2026-10-01' },
    'notices|snue|t': { ds: 'notices', key: SNUE_MARK, url: 'https://www.snue.ac.kr/snue/na/ntt/selectNttInfo.do?mi=3004&bbsId=1083&nttSn=54793', source: 'twin', status: 'verified', verifiedAt: '2026-10-01' },
    'kosaf|2700388001|s': { ds: 'kosaf', key: '2700388001', url: 'https://janghak.songpa.go.kr/22/?bmode=view&idx=174161241&t=board', source: 'search', status: 'verified', verifiedAt: '2026-10-01', round: '2025-10-02' },
    'kosaf|0767001|c': { ds: 'kosaf', key: '0767001', url: 'http://ccbomnae.or.kr/bbs/view.php?no=7', source: 'search', status: 'suggest' },
  };
  const pf = C.publishFix(st, idx, { bad: {} });
  eq('  publishFix — 층2는 id:kosaf-<코드> + 회차(마감) · 같은 공고문 코드도 · 피드 표식은 u:<지금 주소> · 이미 원문(page)인 정식 등록은 안 실음 · 회차가 다른 층2·사람 확인 후보는 안 실음',
    [Object.keys(pf.fix), pf.fix['id:kosaf-0568002'] && pf.fix['id:kosaf-0568002'].round, pf.fix['id:kosaf-0568001'].src, pf.dropped.map((d) => [d.key, d.why.slice(0, 6)])],
    [['id:kosaf-0568001', 'id:kosaf-0568002', 'id:kosaf-0568003', `u:${SNUE_MARK}`], '2026-10-02', 'robot', [['reg-s', '지금 링크가'], ['2700388001', '회차가 바뀜']]]);
  const pfBad = C.publishFix(st, idx, { bad: { [nCand.url]: { v: 'gone', at: '2026-10-03' } } });
  eq('  고친 주소가 확인 로봇의 확정 문제면 싣지 않는다', Object.keys(pfBad.fix), [`u:${SNUE_MARK}`]);

  /* ── G7 리뷰 2026-10-04 — 틀린 글을 원문으로 받던 길 일곱(리뷰가 표본으로 재현한 꼴 그대로) ─────────────── */
  {
    const MK = 'https://www.p.ac.kr/bbs/list.do#n-x';
    const D2 = {
      registered: [{ id: 'reg-root', name: '표본재단 장학생 (2026)', boardTitle: '2026년 표본재단 대학생 장학생 선발 공고', sourceUrl: 'https://www.oofdn.or.kr/index.php' }],
      notices: [
        { school: '표본대학교', title: '[모집] 2026학년도 2학기 가나드림 장학생 모집', url: MK, foundAt: '2026-09-20' },
        { school: '표본대학교', title: '도서관 열람실 운영시간 변경 안내', url: 'https://www.p.ac.kr/bbs/list.do#n-y', foundAt: '2026-10-01' },
        { school: '고려대학교 세종캠퍼스', title: '2026학년도 2학기 국가근로장학생 추가 모집 안내', url: 'https://sejong.korea.ac.kr/bbs/list.do#n-z', foundAt: '2026-09-25' },
      ],
      news: [], activities: [], external: [],
      kosaf: [
        { code: '7770001', org: '(재)한빛장학회', name: '대학생 장학금', due: '2026-03-15', home: 'https://hanbit.or.kr', fields: { 신청기간: '○ 2026-03-02 ~ 2026-03-15' }, files: [{ name: '한빛장학회 대학생 장학생 선발 공고.hwp' }] },
        { code: '8880111', org: '(재)누리장학회', name: '대학생 장학금', due: '2026-10-30', home: 'https://nuri.or.kr', fields: { 신청기간: '○ 2026-10-01 ~ 2026-10-30' }, files: [] },
        { code: '8880222', org: '(재)누리장학회', name: '신입대학생 장학금', due: '2026-10-30', home: 'https://nuri.or.kr', fields: { 신청기간: '○ 2026-10-01 ~ 2026-10-30' }, files: [] },
      ],
      kosafTexts: {}, externalSources: [], pool: [],
      boards: [{ school: '표본대학교', urls: ['https://www.p.ac.kr/bbs/list.do'] }, { school: '고려대학교', urls: ['https://www.korea.ac.kr/bbs/list.do'] }, { school: '고려대학교 세종캠퍼스', urls: ['https://sejong.korea.ac.kr/bbs/list.do'] }],
    };
    const ix = C.buildIndex(D2);
    const T2 = (ds, key) => ix.find({ ds, key });
    const acc = (t, c, obs, verdict) => C.acceptCandidate({ target: t, cand: c, obs, verdict: verdict || J.judgeLanding({ ...obs, requestedUrl: c.url, titles: C.judgeTitles(t, c), titlesFromNameOnly: !!t.nameOnly, otherTitles: [] }), ctx: { owners: ix.ownersOf(c.url) } });
    const hb = T2('kosaf', '7770001');
    const r1 = acc(hb, cand({ url: 'https://hanbit.or.kr/bbs/view.php?no=40' }), { status: 200, docTitle: '한빛장학회', headings: ['한빛장학회 대학생 장학생 선발 공고'], text: `한빛장학회 대학생 장학생 선발 공고\n신청기간: 2025. 3. 2.(일) ~ 3. 15.(토)\n작성일 2025.02.20 ${FILL}` });
    eq('G7 ① 작년 글 — 「2025. 3. 2.(일) ~ 3. 15.(토)」 의 짧은 날짜는 2026-03-15 가 아니다 · 글이 말하는 마감이 다르면 먼저 거절', [r1.status, r1.checks.R], ['rejected', 'fail']);
    eq('    짧은 날짜(연도 없음)는 바로 앞 온전한 날짜의 해를 따른다 — 다른 해면 그 날짜가 아니다 · 같은 해·「2025학년도」 같은 낱말은 그대로',
      [C.dateShown('신청기간: 2025. 3. 2.(일) ~ 3. 15.(토)', '2026-03-15'), C.dateShown('신청기간: 2026. 3. 2.(일) ~ 3. 15.(토)', '2026-03-15'), C.dateShown('2025학년도 장학 · 접수 ~ 3. 15.(토)', '2026-03-15')], [false, true, true]);
    const r2 = acc(T2('notices', MK), cand({ url: 'https://www.p.ac.kr/bbs/view.do?id=88', title: '[결과] 2026학년도 2학기 가나드림 장학생 모집 결과 안내', source: 'data' }),
      { status: 200, docTitle: '표본대학교', headings: ['[결과] 2026학년도 2학기 가나드림 장학생 모집 결과 안내'], text: `[결과] 2026학년도 2학기 가나드림 장학생 모집 결과 안내 작성일 2026.10.01 ${FILL}` });
    eq('  ② 결과 발표 글 — 층2 밖(실시간 공고)에서도 거절 · 후보가 적어 온 제목의 「결과」로 판정이 꺼지지 않는다', [r2.status, /결과/.test(r2.why)], ['rejected', true]);
    eq('  ③ 사이트 첫 화면 주소는 대외활동 말고는 후보로도 안 받는다(재단 첫 화면이 「원문 공고」로 나갈 뻔)',
      [C.loadCandidates({ items: [{ target: { ds: 'registered', key: 'reg-root' }, url: 'https://www.oofdn.or.kr/', by: 't', addedAt: '2026-10-04' }] }, { today: '2026-10-04' }).bad.length,
        C.loadCandidates({ items: [{ target: { ds: 'activities', key: 'https://maicon.kr/' }, url: 'https://maicon.kr/', by: 't', addedAt: '2026-10-04' }] }, { today: '2026-10-04' }).ok.length], [1, 1]);
    const sj = T2('notices', 'https://sejong.korea.ac.kr/bbs/list.do#n-z');
    const SJT = '2026학년도 2학기 국가근로장학생 추가 모집 안내';
    const r4 = acc(sj, cand({ url: 'https://www.korea.ac.kr/bbs/view.do?id=5' }), { status: 200, docTitle: '고려대학교', headings: [SJT], text: `${SJT} 작성일 2026.09.24 ${FILL}` });
    eq('  ④ 여러 캠퍼스가 같이 쓰는 사이트(korea.ac.kr ↔ 세종)의 같은 제목 글은 사람 확인 — 다른 캠퍼스 공고일 수 있다', [r4.status, r4.checks.H], ['suggest', 'weak']);
    const r5 = acc(T2('notices', MK), cand({ url: 'https://www.p.ac.kr/bbs/view.do?id=89', trusted: true }), { status: 200, docTitle: '표본대학교', headings: ['도서관 휴관 안내'], text: `도서관 휴관 안내 작성일 2026.09.20 ${FILL}` });
    eq('  ⑤ 관리자 후보라도 다른 글이 열리면 원문이 아니다(너그러운 것은 못 연 경우뿐)', r5.status === 'verified', false);
    /* 판정기가 「그 글」이라 본 뒤의 단계(P)를 잰다 — 층2 기대 제목이 재단+사업 이름뿐이면 판정기는 다른 글을 '못 읽음'으로 미루므로 착지는 주어 둔다 */
    const r6 = acc(T2('kosaf', '8880111'), cand({ url: 'https://nuri.or.kr/bbs/view?no=3', title: '2026년 하반기 (재)누리장학회 신입대학생 장학생 선발 공고', source: 'match' }), { status: 200, docTitle: '누리장학회', headings: ['2026년 하반기 (재)누리장학회 신입대학생 장학생 선발 공고'], text: `(재)누리장학회 신입대학생 장학생 선발 공고 신청기간: 2026. 10. 1. ~ 10. 30.(금) ${FILL}` }, { v: 'post', ev: 'strong', why: '제목 자리' });
    eq('  ⑥ 형제 사업 이름이 우리 이름을 품으면(신입대학생 ⊃ 대학생) 그 글은 형제 사업 것', [r6.status, r6.checks.P], ['rejected', 'fail']);
    const r7 = acc(T2('notices', MK), cand({ url: 'https://www.p.ac.kr/bbs/view.do?id=90' }), { status: 200, docTitle: '표본대학교 장학공지', headings: ['표본대학교 장학공지'], text: `제목 [모집] 2026학년도 2학기 가나드림 장학생 모집 (OO재단) 작성일 2026.09.19 ${FILL}` }, { v: 'post', ev: 'strong', why: '제목 칸 앞부분' });
    eq('  ⑦ 제목 자리에서 우리 제목을 통째로 못 찾으면(「제목」 칸 앞 24자만 같음) 사람 확인', [r7.status, r7.checks.L], ['suggest', 'weak']);
    const hy = T2('notices', 'https://www.p.ac.kr/bbs/list.do#n-y');
    const HY = '도서관 열람실 운영시간 변경 안내';
    const r8 = acc(hy, cand({ url: 'https://www.p.ac.kr/bbs/view.do?id=10' }), { status: 200, docTitle: '표본대학교', headings: [HY], text: `${HY} 작성일 2024.03.02 ${FILL}` });
    const r9 = acc(hy, cand({ url: 'https://www.p.ac.kr/bbs/view.do?id=91' }), { status: 200, docTitle: '표본대학교', headings: [HY], text: `${HY} ${FILL}` });
    eq('  ⑧ 해·마감이 없는 제목(해마다 같은 이름으로 올라오는 안내) — 글 날짜가 우리가 본 때와 멀면 거절 · 날짜가 없으면 사람 확인', [r8.status, r9.status], ['rejected', 'suggest']);
  }

  /* ── G8 2026-11-20 실측 — 정답 글 55건(사람이 열어 확인한 재단 원문)을 확인 로봇이 5건만 받던 까닭 여섯을 고친 것 ─────────────
     🔴 남의 재단에 붙인 같은 주소(오답)는 하나도 원문이 되면 안 된다 — 고친 것마다 받는 꼴(+)과 막는 꼴(−)을 같이 잰다 */
  {
    const KS = (code, org, name, open, due, home, files = [], extra = {}) => ({ code, org, name, due, home, fields: { 신청기간: `○ ${open} ~ ${due}` }, files: files.map((n) => ({ name: n })), ...extra });
    const D8 = { registered: [], notices: [], news: [], activities: [], external: [], kosafTexts: {}, externalSources: [], pool: [], boards: [{ school: '표본대학교', urls: ['https://www.x.ac.kr/bbs/list.do'] }],
      kosaf: [
        KS('8100001', '강원도 원주시청', '다자녀가정 특별지원 장학금', '2026-11-02', '2026-11-30', 'https://www.wonju.go.kr'),
        KS('8100010', '영광군미래교육재단', '대학생등록금 지원', '2026-11-02', '2026-11-27', 'https://www.ygef.or.kr', ['2026년 영광군 대학생 등록금 지원사업 공고(안).hwp']),
        KS('8100020', '한국천주교주교회의 평신도기금운영위원회', '명도회 장학금', '2026-11-01', '2026-11-30', 'https://www.cbck.or.kr/'),
        KS('8100021', '표본관공서 평신도기금운영위원회', '명도회 장학금', '2026-11-01', '2026-11-30', 'https://www.pyobon.go.kr/'),
        KS('8100030', '문의육영장학재단', '장학생', '2026-11-01', '2026-11-30', 'https://www.munui.or.kr'),
        KS('8100031', '문의육영장학재단', '특별장학금', '2026-11-01', '2026-11-30', 'https://www.munui.or.kr'),
        KS('8100040', '(재)한국장학재단', '국가근로장학금', '2026-03-01', '2027-02-28', 'https://www.kosaf.go.kr/ko/scholar.do?pg=scholarship05_04_01&naviParam=JH,03,01,08'),
        KS('8100041', '(재)한국장학재단', '대학생청소년교육지원장학금', '2026-03-01', '2027-02-28', 'https://www.kosaf.go.kr/ko/mkinfo.do?pg=PTMKKsSrvMntoringGive_01M'),
        KS('8100050', '한독제석재단', '장학생', '2026-11-03', '2026-11-30', 'https://www.handokjeseok.or.kr', ['2026년 한독제석재단 장학생 선발 공고.pdf']),
        KS('8100060', '(재)다른장학회', '장학생', '2026-11-03', '2026-11-30', 'https://www.dareun.or.kr', ['2026년 다른장학회 장학생 선발 공고.pdf']),
      ] };
    const ix = C.buildIndex(D8);
    const T8 = (key) => ix.find({ ds: 'kosaf', key });
    const acc = (t, c, obs) => C.acceptCandidate({ target: t, cand: c, obs, verdict: J.judgeLanding({ ...obs, requestedUrl: c.url, titles: C.judgeTitles(t, c), titlesFromNameOnly: !!t.nameOnly, otherTitles: [] }), ctx: { owners: ix.ownersOf(c.url) } });

    /* ① 검색 제목이 우리 사업 이름을 품으면(재단 이름이 없어도) 기대 제목 — 흔한 낱말만인 사업 이름(대학생)은 아니다 */
    const WT = '2026년 다자녀가정 특별지원（대학등록금） 신청 안내';
    const wObs = (org) => ({ status: 200, docTitle: `${WT} - ${org}`, headings: [WT], text: `${WT}\n담당부서 교육지원과 · ${org}\n신청기간: 2026. 11. 2.(월) ~ 2026. 11. 30.(월)\n작성일 2026-11-01 ${FILL}` });
    const w1 = acc(T8('8100001'), cand({ url: 'https://www.wonju.go.kr/www/selectBbsNttView.do?bbsNo=1&nttNo=4008', title: WT }), wObs('원주시청'));
    eq('G8 ① 시청 글 — 검색 제목에 우리 사업 이름(다자녀가정 특별지원)이 있으면 기대 제목 · KOSAF 의 「강원도 원주시청」은 도 이름을 떼고 화면의 「원주시청」과 맞춘다 → 원문',
      [w1.status, w1.checks.L, w1.checks.X], ['verified', 'ok', 'ok']);
    const w2 = acc(T8('8100001'), cand({ url: 'https://www.wonju.go.kr/www/selectBbsNttView.do?bbsNo=1&nttNo=4009', title: WT }), wObs('춘천시청'));
    eq('  (−) 같은 글이 다른 시청 이름만 보이면 재단(X) 거절', [w2.status, w2.checks.X], ['rejected', 'fail']);
    eq('  (−) 사업 이름이 흔한 낱말뿐(대학생)이면 검색 제목을 기대 제목에 넣지 않는다 · 공고문 파일 제목과 10자 이상 이어 같으면 넣는다',
      [C.kosafKin({ programCore: '대학생', attachTitles: [] }, '2026년 대학생 장학금 지원 안내'), C.judgeTitles({ ds: 'kosaf', titles: ['원주시청 대학생 장학금'], orgCore: '강원도원주시청', programCore: '대학생', attachTitles: [] }, { title: '2026년 대학생 장학금 지원 안내' }).length,
        C.kosafKin({ programCore: '', attachTitles: ['2026년 영광군 대학생 등록금 지원사업 공고(안)'] }, '2026년 2학기 대학생 등록금 지원사업 공고')], [false, 1, true]);

    /* ② 제목 자리 넓히기 — 「제  목」 칸(통째) · 제목 줄(아래에 글 표지) · KOSAF 공고문 파일 이름이 첨부에 보임 */
    const BT = '2026년도 백산장학재단 장학금 선발 공고';
    eq('② 「제  목」(빈칸 둘) 칸이 그 제목 통째면 제목 자리 · 칸 앞 24자만 같고 뒤에 (OO재단)이 붙으면 통째가 아니다(⑦과 같은 꼴)',
      [J.labeledTitle(`제  목\t${BT}\n작성자\t백산장학재단\t작성일\t2026-11-01`, BT, { whole: true }),
        J.labeledTitle('제목 [모집] 2026학년도 2학기 가나드림 장학생 모집 (OO재단) 작성일 2026.09.19', '[모집] 2026학년도 2학기 가나드림 장학생 모집', { whole: true }),
        J.labeledTitle('제목 [모집] 2026학년도 2학기 가나드림 장학생 모집 (OO재단) 작성일 2026.09.19', '[모집] 2026학년도 2학기 가나드림 장학생 모집')], [true, false, true]);
    const YT = '2026년 영광군 대학생 등록금 지원사업 공고';
    const yText = `공지사항\n${YT}\n영광군미래교육재단 / 2026-11-02 / 조회:657\n□ 접수기간: 2026. 11. 2.(월) ~ 11. 27.(금)\n${FILL}`;
    const listText = `공지사항\n2026년 다른 공고 하나 안내\n2026-10-01\n2026년 다른 공고 둘째 안내\n2026-10-02\n${YT}\n2026-10-03\n${FILL}`;
    eq('  제목 줄 — 한 줄이 그 제목 통째이고 바로 아래 줄이 글 표지(날짜·조회) · 그런 묶음이 셋 이상이면 목록이라 안 센다',
      [J.lineTitle(yText, YT), J.lineTitle(listText, YT), J.lineTitle(`${YT}\n□ 접수기간: 2026. 11. 2.(월) ~ 11. 27.(금)`, YT)], [YT, '', '']);
    const y1 = acc(T8('8100010'), cand({ url: 'https://www.ygef.or.kr/board/?type=view&post_idx=2190', title: YT }), { status: 200, docTitle: '영광군미래교육재단', headings: [], text: yText });
    eq('  h 태그 없이 줄로만 제목을 그리는 게시판 — 제목 줄이면 제목 자리(L ok) → 원문', [y1.status, y1.checks.L], ['verified', 'ok']);
    const y2 = acc(T8('8100010'), cand({ url: 'https://www.ygef.or.kr/board/?type=list&page=1', title: YT }), { status: 200, docTitle: '영광군미래교육재단', headings: [], text: listText.replace('2026-10-03', `2026-10-03\n접수: 2026. 11. 2. ~ 11. 27.`) });
    eq('  (−) 같은 제목이 목록의 한 줄(제목+날짜 묶음이 셋)이면 제목 자리가 아니다 → 원문 아님', y2.status === 'verified', false);
    const fileText = `알림마당\n대학생 등록금 지원 안내\n첨부파일 2026년 영광군 대학생 등록금 지원사업 공고(안).hwp (120KB)\n□ 접수기간: 2026. 11. 2.(월) ~ 11. 27.(금) 영광군미래교육재단 ${FILL}`;
    eq('  첨부 목록에 그 코드의 KOSAF 공고문 파일 이름이 보이면 그 파일을 단 글 · 다른 이름이면 아니다',
      [!!J.fileShown(fileText, ['2026년 영광군 대학생 등록금 지원사업 공고(안).hwp']), J.fileShown(fileText, ['2026년 다른군 장학생 선발 공고.hwp'])], [true, '']);
    const y3 = acc(T8('8100010'), cand({ url: 'https://www.ygef.or.kr/board/?type=view&post_idx=2191' }), { status: 200, docTitle: '영광군미래교육재단', headings: [], text: fileText });
    const y4 = acc(T8('8100060'), cand({ url: 'https://www.dareun.or.kr/board/?type=view&post_idx=2191' }), { status: 200, docTitle: '다른장학회', headings: [], text: fileText.replace(/영광군미래교육재단/, '다른장학회') });
    eq('  (+) 파일 이름으로 L 통과 · (−) 파일이 다른 코드에 붙이면 L 이 통과하지 않는다(원문 아님)', [y3.checks.L, y4.checks.L === 'ok', y4.status === 'verified'], ['ok', false, false]);

    /* ③ 재단 표기가 제 사이트와 다를 때 — KOSAF 가 적은 그 재단 홈(관공서·대학 아님)에서 제목 자리에 우리 사업 이름 */
    const MT = '2026년 명도회 장학생 선발 공고';
    const mObs = { status: 200, docTitle: '주교회의 평신도인재양성·기금위원회', headings: [MT], text: `${MT}\n주교회의 평신도인재양성·기금위원회\n접수: 2026. 11. 1. ~ 11. 30.\n작성일 2026-10-28 ${FILL}` };
    const m1 = acc(T8('8100020'), cand({ url: 'https://www.cbck.or.kr/Notice/2026/view?idx=301', title: MT }), mObs);
    const m2 = acc(T8('8100021'), cand({ url: 'https://www.pyobon.go.kr/Notice/view?idx=301', title: MT }), mObs);
    eq('③ 재단 자기 사이트 + 제목 자리에 사업 이름(명도회) → 이름 표기가 달라도 X 통과 · (−) 홈이 관공서(.go.kr)면 X 거절',
      [m1.status, m1.checks.X, m2.status, m2.checks.X], ['verified', 'ok', 'rejected', 'fail']);
    const p1 = acc(T8('8100030'), cand({ url: 'https://www.munui.or.kr/bbs/view.php?no=41', title: '2026년 문의육영장학재단 장학생 선발계획 공고' }), { status: 200, docTitle: '문의육영장학재단', headings: ['2026년 문의육영장학재단 장학생 선발계획 공고'], text: `2026년 문의육영장학재단 장학생 선발계획 공고\n신청기간 2026. 11. 1. ~ 11. 30.\n작성일 2026-10-30 ${FILL}` });
    const p2 = acc(T8('8100030'), cand({ url: 'https://www.munui.or.kr/bbs/view.php?no=42', title: '2026년 문의육영장학재단 특별장학생 선발 공고' }), { status: 200, docTitle: '문의육영장학재단', headings: ['2026년 문의육영장학재단 특별장학생 선발 공고'], text: `2026년 문의육영장학재단 특별장학생 선발 공고\n신청기간 2026. 11. 1. ~ 11. 30.\n작성일 2026-10-30 ${FILL}` });
    eq('  사업 이름이 그냥 「장학생」 — 제목 자리에 재단 이름 통째면 P 통과 · (−) 형제 사업(특별) 제목이면 P 거절', [p1.status, p1.checks.P, p2.status, p2.checks.P], ['verified', 'ok', 'rejected', 'fail']);

    /* ④ 한국장학재단 자체 사업 — 사업 이름만 제목 · 재단 누리집만 · 사업 기간(달 범위) */
    const gk = T8('8100040');
    const KP = 'https://www.kosaf.go.kr/ko/scholar.do?pg=scholarship05_04_01&naviParam=JH,03,01,08';
    const kObs = { status: 200, docTitle: '한국장학재단', headings: ['국가근로장학금'], text: `국가근로장학금\n사업기간 : 2026년 3월 ~ 2027년 2월\n지원대상 대학생 ${FILL}` };
    const k1 = acc(gk, cand({ url: KP, source: 'data' }), kObs);
    const k2 = acc(T8('8100041'), cand({ url: KP, source: 'data' }), kObs);
    const k3 = acc(gk, cand({ url: 'https://www.x.ac.kr/bbs/view.do?id=77', title: '2026학년도 국가근로장학금 신청 안내' }), { status: 403 });   // 못 열어도 '다시 봄'이 아니라 바로 거절(대학 모집 글은 학교 창구판)
    eq('④ 한국장학재단 자체 사업 — 사업 안내 쪽(제목 = 사업 이름 · 사업 기간 2026년 3월 ~ 2027년 2월) → 원문 · (−) 같은 쪽을 다른 자체 사업에 붙이면 원문 아님 · (−) 대학 글은 열지 않고 거절',
      [k1.status, k1.checks.R, k2.status === 'verified', k3.status, k3.checks.H, gk.kosafOwn, gk.titles.includes('국가근로장학금'), !!T8('8100050').kosafOwn, T8('8100050').titles.includes('장학생')],
      ['verified', 'ok', false, 'rejected', 'fail', true, true, false, false]);
    eq('  사업 기간 달 범위는 자체 사업에만 · 그 회차의 해와 같을 때만 · 제목의 해 + 글 날짜(작성일)가 접수 시작 30일 전 ~ 마감이면 회차 ok · 멀면 모름 · 다른 해 제목은 거절',
      [C.roundCheck({ round: { open: '2026-03-01', due: '2027-02-28' }, head: '국가근로장학금', text: '사업기간 : 2026년 3월 ~ 2027년 2월', kosafOwn: true }).s,
        C.roundCheck({ round: { open: '2026-03-01', due: '2027-02-28' }, head: '국가근로장학금', text: '사업기간 : 2025년 3월 ~ 2026년 2월', kosafOwn: true }).s,
        C.roundCheck({ round: { open: '2026-03-01', due: '2027-02-28' }, head: '국가근로장학금', text: '사업기간 : 2026년 3월 ~ 2027년 2월' }).s,
        C.roundCheck({ round: { open: '2026-10-27', due: '2026-11-27' }, head: '[공고] 일신문화재단 2026 형남장학금', text: '작성일 26-10-27 DATE : 2026-10-30' }).s,
        C.roundCheck({ round: { open: '2026-10-27', due: '2026-11-27' }, head: '[공고] 일신문화재단 2026 형남장학금', text: 'DATE : 2026-06-10' }).s,
        C.roundCheck({ round: { open: '2026-10-27', due: '2026-11-27' }, head: '[공고] 일신문화재단 2025 형남장학금', text: 'DATE : 2026-10-30' }).s],
      ['ok', 'none', 'none', 'ok', 'none', 'fail']);
    eq('  파일 이름의 올린 날 도장(앞 261027- · 끝 …공고0416)은 제목이 아니다 · 「제10기」·해는 그대로',
      [C.cleanAttachTitle('2026년도내대학해외교환장학생모집·선발공고0416.hwp'), C.cleanAttachTitle('261027-2026년 표본장학회 장학생 선발 공고.pdf'), C.cleanAttachTitle('2027년도 제10기 장학생 선발 안내문.pdf')],
      ['2026년도내대학해외교환장학생모집·선발공고', '2026년 표본장학회 장학생 선발 공고', '2027년도 제10기 장학생 선발 안내문']);

    /* ⑤ 재단이 남의 사이트에 직접 올린 그 공고(박물관 게시판 · 도 신청 창구) — 같은 문서 + 올린 이가 재단 + 마감·접수일, 셋 다 화면에 */
    const HT = '2026년 한독제석재단 장학생 선발 공고';
    const hObs = (crumb, extra = '접수기간 2026. 11. 3. ~ 11. 30.\n작성일 2026-11-03') => ({ status: 200, docTitle: '한독의약박물관', headings: [HT], text: `${crumb}\n${HT}\n${extra}\n${FILL}` });
    const h1 = acc(T8('8100050'), cand({ url: 'https://www.handokmuseum.com/bbs/board.php?bo_table=notice&wr_id=88', title: HT }), hObs('HOME / 한독제석재단 / 공지사항'));
    const h2 = acc(T8('8100050'), cand({ url: 'https://www.x.ac.kr/bbs/view.do?id=88', title: HT }), hObs('HOME / 한독제석재단 / 공지사항\n작성자 학생과'));
    const h3 = acc(T8('8100050'), cand({ url: 'https://www.handokmuseum.com/bbs/board.php?bo_table=notice&wr_id=89', title: HT }), hObs('주최 | 한독제석재단'));
    const h4 = acc(T8('8100050'), cand({ url: 'https://www.handokmuseum.com/bbs/board.php?bo_table=notice&wr_id=90', title: HT }), hObs('HOME / 한독제석재단 / 공지사항', '장학생을 선발합니다\n작성일 2026-10-20'));   // 글 날짜는 회차 무렵이지만 마감·접수일이 안 보인다
    const h5 = acc(T8('8100060'), cand({ url: 'https://www.handokmuseum.com/bbs/board.php?bo_table=notice&wr_id=88', title: HT }), hObs('HOME / 한독제석재단 / 공지사항'));
    /* 🔴 (리뷰 2026-11-20) 다른 사이트는 증거가 다 있어도 **사람 확인까지만** — 고교·교육지원청·시청·장학 정보 사이트가 옮겨 실은 글도 같은 증거를 낸다 */
    eq('⑤ 다른 사이트라도 KOSAF 공고문 제목이 제목 자리 + 「한독제석재단 / 공지사항」 길잡이 + 접수일 → 사람 확인(원문 아님 · H weak) · (−) 학교 사이트면 「학교가 옮겨 실은 글」 거절 · (−) 「주최」 이름표뿐 · 마감·접수일 없이 글 날짜뿐 · 남의 재단 코드는 원문 아님',
      [h1.status, h1.checks.H, /사람 확인/.test(h1.why), h2.status, /학교가 옮겨 실은 글/.test(h2.why), h3.status === 'verified', h4.status === 'verified', h5.status === 'verified'],
      ['suggest', 'weak', true, 'rejected', true, false, false, false]);
    /* 집계·블로그·신문 기사 사이트는 길잡이 증거가 있어도 재단이 올린 글로 보지 않는다(issuerElsewhere 의 첫 거름 · 리뷰 M13) */
    const ie = (url, fin) => C.issuerElsewhere(T8('8100050'), hObs('HOME / 한독제석재단 / 공지사항'), [HT], fin || url).ok;
    eq('  (−) 길잡이·첨부 증거가 같아도 집계 사이트(allforyoung·contestkorea)·블로그로 돌려보냄·신문 기사 주소는 「재단이 올린 글」이 아니다 · (+) 보통 사이트는 맞다',
      [ie('https://www.allforyoung.com/posts/1'), ie('https://www.contestkorea.com/sub/view.php?str_no=1'), ie('https://www.x.or.kr/a', 'https://blog.naver.com/abc/223'), ie('https://www.news.co.kr/news/articleView.html?idxno=1'), ie('https://www.handokmuseum.com/bbs/board.php?wr_id=88')],
      [false, false, false, false, true]);
    for (const [u, lab] of [['https://www.allforyoung.com/posts/1', '집계'], ['https://www.contestkorea.com/sub/view.php?str_no=202611030001', '집계'], ['https://www.news.co.kr/news/articleView.html?idxno=1', '기사']]) {
      const r = acc(T8('8100050'), cand({ url: u, title: HT }), hObs('HOME / 한독제석재단 / 공지사항'));
      eq(`  (−) ${lab} 주소(${u.split('/')[2]})는 원문이 아니다`, r.status === 'verified', false);
    }
  }

  /* ── G8 ⑥ 리뷰 2026-11-20 — 오답이 원문으로 오르던 꼴들(모두 실관측 쪽을 고쳐 만든 표본) ─────────────────────────────── */
  {
    const KS = (code, org, name, open, due, home, files = []) => ({ code, org, name, due, home, fields: { 신청기간: `○ ${open} ~ ${due}` }, files: files.map((n) => ({ name: n })) });
    const D9 = { registered: [], notices: [], news: [], activities: [], external: [], kosafTexts: {}, externalSources: [], pool: [], boards: [],
      kosaf: [
        KS('8200001', '(재)가나장학재단', '장학생', '2026-10-01', '2026-10-31', 'https://gana.or.kr/'),
        KS('8200002', '(재)가나장학재단', '장학생', '2026-10-01', '2026-10-31', 'https://gana.or.kr/', ['2026년 가나장학재단 장학생 선발 공고.hwp']),
        KS('8200003', '영광군미래교육재단', '대학생등록금 지원', '2026-11-02', '2026-11-27', 'https://www.ygef.or.kr', ['2026년_2학기_영광군_대학생등록금_지원사업_공고(안).hwpx']),
        KS('8200004', '일신문화재단', '형남장학금', '2026-10-27', '2026-11-27', 'http://www.ilshinfoundation.com'),
        KS('8200005', '(재)가나장학재단', '희망나래장학생', '2026-10-01', '2026-10-31', 'https://gana.or.kr/', ['2026년 가나장학재단 희망나래장학생 선발 공고문.hwp']),
        KS('8200006', '(재)한국장학재단', '국가근로장학금', '2026-03-01', '2027-02-28', 'https://www.kosaf.go.kr/ko/scholar.do?pg=scholarship05_04_01&naviParam=JH,03,01,08'),
      ] };
    const ix = C.buildIndex(D9);
    const T9 = (key) => ix.find({ ds: 'kosaf', key });
    const acc = (t, c, obs) => C.acceptCandidate({ target: t, cand: c, obs, verdict: J.judgeLanding({ ...obs, requestedUrl: c.url, titles: C.judgeTitles(t, c), titlesFromNameOnly: !!t.nameOnly, otherTitles: [] }), ctx: { owners: ix.ownersOf(c.url) } });
    const post = (title, body, doc) => ({ status: 200, docTitle: doc || title, headings: [title], text: `${title}\n작성자 관리자\n${body}\n${FILL}` });

    /* ⑥-1 「장학생」뿐인 사업 — 같은 재단의 수여식·이사회·전달식 글(글 날짜가 접수 무렵)은 원문이 아니다 */
    const b1 = acc(T9('8200001'), cand({ url: 'https://gana.or.kr/bbs/view.php?id=501', title: '2026 가나장학재단 장학증서 수여식 안내' }), post('2026 가나장학재단 장학증서 수여식 안내', '작성일 2026-10-10\n조회 33\n일시: 2026. 11. 20.(금) 14:00'));
    const b2 = acc(T9('8200002'), cand({ url: 'https://gana.or.kr/bbs/view.php?id=502', title: '2026년 가나장학재단 정기 이사회 개최 공고' }), post('2026년 가나장학재단 정기 이사회 개최 공고', '작성일 2026-10-05\n조회 12'));
    const b3 = acc(T9('8200001'), cand({ url: 'https://gana.or.kr/bbs/view.php?id=503', title: '2026년 가나장학재단 장학금 전달식 안내' }), post('2026년 가나장학재단 장학금 전달식 안내', '관리자 2026-10-12 조회: 155'));
    const b4 = acc(T9('8200001'), cand({ url: 'https://gana.or.kr/bbs/view.php?id=504', title: '2026년 가나장학재단 장학생 선발 공고' }), post('2026년 가나장학재단 장학생 선발 공고', '관리자 2026-10-01 조회: 155'));
    eq('G8 ⑥-1 (−) 「장학생」뿐인 사업에 같은 재단의 수여식·이사회·전달식 글 → 원문 아님 · (+) 같은 재단의 그해 장학생 선발 글(글 올린 날이 접수 무렵)은 원문',
      [b1.status === 'verified', b2.status === 'verified', b3.status === 'verified', b4.status], [false, false, false, 'verified']);
    /* 마감이 보여 회차가 맞아도(R ok) 수여식 글은 장학생 선발 글이 아니다 — 첨부 없는 「장학생」 사업은 P 가 n/a 라 이 거절이 마지막 문이다 */
    const b5 = acc(T9('8200001'), cand({ url: 'https://gana.or.kr/bbs/view.php?id=505', title: '2026 가나장학재단 장학증서 수여식 안내' }), post('2026 가나장학재단 장학증서 수여식 안내', '작성일 2026-11-02\n신청기간 2026. 10. 1. ~ 2026. 10. 31. 에 선발된 장학생의 수여식을 엽니다.'));
    /* 첨부가 있는 「장학생」 사업 — 제목 자리에 재단 이름만 있고 장학생을 뽑는 낱말이 없는 글(사무실 이전 안내)은 P 를 주지 않는다 */
    const b6 = acc(T9('8200002'), cand({ url: 'https://gana.or.kr/bbs/view.php?id=506', title: '2026년 가나장학재단 사무실 이전 안내' }), post('2026년 가나장학재단 사무실 이전 안내', '작성일 2026-10-02\n이전일 2026. 10. 31.(토)'));
    eq('  (−) 마감이 보이는 수여식 글 → P 거절 · (−) 재단 이름뿐인 다른 안내 글(첨부 있는 사업) → P 를 주지 않는다', [b5.status, b5.checks.P, b6.status === 'verified', b6.checks.P === 'ok'], ['rejected', 'fail', false, false]);
    /* 회차 날짜 창은 글 올린 날만 — 본문 일정 줄(「설명회 일시 2026. 10. 15.」)의 날짜로는 열지 않는다 */
    const b7 = acc(T9('8200001'), cand({ url: 'https://gana.or.kr/bbs/view.php?id=507', title: '2026년 가나장학재단 장학생 선발 공고' }), post('2026년 가나장학재단 장학생 선발 공고', '관리자 2026-03-02 조회: 155\n설명회 일시 2026. 10. 15.(목) 본관'));
    eq('  (−) 글 올린 날(3월)은 멀고 본문 일정 날짜만 접수 무렵 → 원문 아님', b7.status === 'verified', false);
    eq('  사냥꾼도 수여식·이사회 글을 고르지 않는다', [C.scoreKosafPost(T9('8200001'), { title: '2026 가나장학재단 장학증서 수여식 안내', url: 'https://gana.or.kr/bbs/view.php?id=501' }).score, C.scoreKosafPost(T9('8200001'), { title: '2026년 가나장학재단 정기 이사회 개최 공고', url: 'https://gana.or.kr/bbs/view.php?id=502' }).score], [-1, -1]);

    /* ⑥-2 회차 날짜는 **그 글이 올라온 날**만 — 이전글·다음글·최근 게시물 줄의 날짜가 1학기 글을 2학기 회차로 올리던 것 */
    eq('  글 올린 날(postDates) — 작성일 이름표 · 글 표지 줄 · 「26-10-27 19:51」 · (−) 다음글·최근 게시물·제목+날짜 목록 줄·최종수정일은 아니다',
      [C.postDates('작성자\t재단\t작성일\t2026-11-01 오전 10:38:40\t조회\t1078'), C.postDates('관리자 2026-11-04 조회: 155'), C.postDates('26-10-27 19:51'),
        C.postDates('재단 / 2026-03-09 / 조회:657\n다음글 2026년 2학기 대학생등록금 지원사업 공고 2026-10-12'), C.postDates('2026 청소년문화센터 강사 채용 공고 2026-11-02'), C.postDates('최종수정일2021-11-17'), C.postDates('이전글 2026-10-12\n재단 / 2026-03-09')],
      [['2026-11-01'], ['2026-11-04'], ['2026-10-27'], ['2026-03-09'], [], [], ['2026-03-09']]);
    const YT = '2026년 대학생등록금 지원사업 공고';
    const yBody = (extra) => `영광군미래교육재단 / 2026-03-09 / 조회:657\n2026년도 1학기 영광군대학생 등록금 지원사업을 공고합니다.\n2026년_1학기_영광군_대학생등록금_지원사업_공고(안).hwpx\n${extra}`;
    const a2 = acc(T9('8200003'), cand({ url: 'https://www.ygef.or.kr/board/?type=view&post_idx=2201', title: YT }), post(YT, yBody('다음글 2026년 2학기 대학생등록금 지원사업 공고 2026-10-12')));
    const a4 = acc(T9('8200003'), cand({ url: 'https://www.ygef.or.kr/board/?type=view&post_idx=2190', title: `[영광군미래교육재단] ${YT}` }), post(`[영광군미래교육재단] ${YT}`, yBody('최근 게시물\n2026 청소년문화센터 강사 채용 공고 2026-11-02')));
    const a5 = acc(T9('8200003'), cand({ url: 'https://www.ygef.or.kr/board/?type=view&post_idx=2191', title: YT }), post(YT, yBody('2026 청소년문화센터 강사 채용 공고 2026-11-02')));
    eq('  (−) 같은 해 1학기 글 — 다음글 줄·「최근 게시물」 옆 칸 날짜(접수 시작일과 같은 날이어도)로는 이번 회차가 아니다',
      [a2.status === 'verified', a4.status === 'verified', a5.status === 'verified'], [false, false, false]);

    /* ⑥-3 후보 제목이 그 쪽의 뭉뚱그린 창 제목 — 진짜 글 제목(결과 발표)을 못 보고 원문으로 오르던 것 */
    const RT = '[발표] 일신문화재단 2026 형남장학금 선발 결과 안내';
    const rObs = { status: 200, docTitle: '공지사항 | 일신문화재단', headings: ['공지사항', RT], text: `HOME > 게시판 > 공지사항\n${RT}\n작성자\n일신문화재단\n작성일\n26-11-26 10:02\n일신문화재단 2026 형남장학금(신청기간 2026. 10. 27. ~ 2026. 11. 27.) 선발 결과를 안내합니다.\n${FILL}` };
    const c1 = acc(T9('8200004'), cand({ url: 'http://www.ilshinfoundation.com/bbs/board.php?bo_table=notice&wr_id=15', title: '공지사항 | 일신문화재단' }), rObs);
    const c2 = acc(T9('8200004'), cand({ url: 'http://www.ilshinfoundation.com/bbs/board.php?bo_table=notice&wr_id=16', title: RT }), rObs);
    eq('  (−) 창 제목 후보(「공지사항 | 일신문화재단」)로 연 결과 발표 글 → 원문 아님 · 글 제목 후보면 「결과·명단 발표 글」 거절', [c1.status === 'verified', c2.status], [false, 'rejected']);

    /* ⑥-4 다른 사이트(장학 정보 모음)가 작성자 줄·첨부 이름까지 옮겨 실은 글 → 사람 확인까지만 */
    const GT = '2026년 가나장학재단 희망나래장학생 선발 공고문';
    const g1 = acc(T9('8200005'), cand({ url: 'https://www.janghak-info.co.kr/board/view.php?no=8812', title: GT }),
      { status: 200, docTitle: GT, headings: [GT], text: `장학정보나라 > 장학 소식\n${GT}\n작성자 : 가나장학재단\n등록일 2026-10-01\n접수기간: 2026. 10. 1. ~ 2026. 10. 31.\n첨부파일 2026년 가나장학재단 희망나래장학생 선발 공고문.hwp\n${FILL}` });
    eq('  (−) 장학 정보 사이트가 옮겨 실은 글(작성자 : 재단) → 원문 아님(사람 확인)', g1.status, 'suggest');

    /* ⑥-5 한국장학재단 「장학금 한눈에 보기」(여러 사업을 모은 쪽)는 한 사업의 원문이 아니다 */
    const f5 = acc(T9('8200006'), cand({ url: 'https://www.kosaf.go.kr/ko/scholar.do?pg=scholarship_main&naviParam=JH,01', title: '국가근로장학금', source: 'data' }),
      { status: 200, docTitle: '장학금 한눈에 보기 | 장학금 | 한국장학재단', headings: ['장학금 한눈에 보기', '국가장학금', '국가근로장학금', '국가우수 장학금', '주거안정장학금'], text: `국가근로장학금\n2026년 2학기 사업기간: 2026. 9. 1. ~ 2027. 2. 28.\n2026년 1학기 사업기간: 2026. 3. 1. ~ 2026. 8. 31.\n${FILL}` });
    eq('  (−) 「장학금 한눈에 보기」 모음 쪽 → P 거절', [f5.status, f5.checks.P], ['rejected', 'fail']);
    eq('  자체 사업의 다른 사이트 글은 열기 전에 건너뛴다(link-check 가 판정과 같은 함수를 부른다)',
      [C.kosafOwnOffHost(T9('8200006'), 'https://www.x.ac.kr/bbs/1'), C.kosafOwnOffHost(T9('8200006'), 'https://www.kosaf.go.kr/ko/x.do'), C.kosafOwnOffHost(T9('8200001'), 'https://www.x.ac.kr/bbs/1'),
        /if \(!cand\.trusted && kosafOwnOffHost\(q\.target, url\)\) return[^\n]*\n[\s\S]{0,200}?const obs = await observe\(t\)/.test(fs.readFileSync(path.join(ROOT, 'collector/link-check.mjs'), 'utf8'))],
      [true, false, false, true]);

    /* ⑥-6 파일 이름의 해는 회차를 묶는 글자라 떼지 않는다 · 밑줄로 붙은 앞 도장(261027_)도 뗀다 */
    eq('  올린 날 도장 — 끝의 해(2026)는 남긴다 · 앞 「261027_」도 뗀다',
      [C.cleanAttachTitle('가나장학재단 장학생 선발 공고 2026.hwp'), C.cleanAttachTitle('261027_2026년 경남장학회 장학생 선발 공고.hwp')],
      ['가나장학재단 장학생 선발 공고 2026', '2026년 경남장학회 장학생 선발 공고']);

    /* ⑥-7 검색 요약·기대 제목 넓히기의 문턱 */
    const kt = T9('8200005');
    eq('  (−) 검색 요약이 재단 이름만 더하면(사업 이름·공고문 파일 제목 없음) 고르지 않는다 · (+) 공고문 파일 제목을 더하면 고른다 · 제목만으로 3점이면 요약을 보지 않는다',
      [C.scoreKosafPost(kt, { title: '공지사항', snippet: '가나장학재단 소식 2026', url: 'https://gana.or.kr/bbs/1' }).why.includes('검색 요약'),
        C.scoreKosafPost(kt, { title: '공지사항', snippet: '[공고] 2026년 가나장학재단 희망나래장학생 선발 공고문', url: 'https://gana.or.kr/bbs/2' }).why.includes('검색 요약'),
        C.scoreKosafPost(kt, { title: '2026 가나장학재단 장학 소식', snippet: '희망나래장학생 선발 공고', url: 'https://gana.or.kr/bbs/3' }).why.includes('검색 요약')],
      [false, true, false]);
    eq('  (−) 공고문 파일 제목과 4~9자만 이어 같으면 기대 제목이 아니다 · (+) 10자 이상·60% 이상이면 맞다',
      [C.kosafKin({ programCore: '', attachTitles: ['2026년 가나장학재단 희망나래장학생 선발 공고문'] }, '2026년 다른 재단 선발 공고문 안내'),
        C.kosafKin({ programCore: '', attachTitles: ['2026년 가나장학재단 희망나래장학생 선발 공고문'] }, '가나장학재단 희망나래장학생 선발 안내')], [false, true]);
  }

  /* G7 ⑨ 같은 주소 열쇠(u:)를 쓰는 다른 글이 있으면 로봇 바로잡기를 싣지 않는다 · ⑩ 날마다 다시 볼 때 바로잡기의 제목도 기대 제목 */
  {
    const MK = 'https://www.q.ac.kr/bbs/list.do#n-ceo';
    const D3 = { registered: [], news: [], activities: [], external: [], kosaf: [], kosafTexts: {}, externalSources: [], pool: [], boards: [{ school: '표본대학교', urls: ['https://www.q.ac.kr/bbs/list.do'] }],
      notices: [{ school: '표본대학교', title: 'CEO TALK SHOW 안내', url: MK, foundAt: '2026-09-02', postId: '11' }, { school: '표본대학교', title: 'CEO TALK SHOW 안내', url: MK, foundAt: '2026-10-01', postId: '12' }] };
    const ix3 = C.buildIndex(D3);
    const st = { c1: { ds: 'notices', key: MK, url: 'https://www.q.ac.kr/bbs/view.do?id=11', source: 'data', status: 'verified', verifiedAt: '2026-10-04' } };
    const pf = C.publishFix(st, ix3, { bad: {} });
    eq('G7 ⑨ 같은 표식 주소를 쓰는 다른 달의 같은 제목 글이 있으면 로봇 바로잡기를 싣지 않는다(다른 글도 그 원문을 연다)',
      [Object.keys(pf.fix).length, pf.dropped.some((d) => /같은 주소를 쓰는 다른 글/.test(d.why))], [0, true]);
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fixtitle-'));
    const W2 = (rel, doc) => { fs.mkdirSync(path.dirname(path.join(tmp, rel)), { recursive: true }); fs.writeFileSync(path.join(tmp, rel), JSON.stringify(doc, null, 1)); };
    const RM = 'https://news.r.ac.kr/bbs/list.do#n-x';
    W2('data/registered.json', { items: [{ id: 'reg-t', name: '표본 장학생 (2026)', sourceUrl: RM }] });
    W2('data/link-fixes.json', { v: 1, fix: { 'id:reg-t': { url: 'https://news.r.ac.kr/bbs/view.do?boardId=5', by: 't', at: '2026-10-04', title: '2026 표본 우수논문 장학생 선발 공고' } } });
    let gt = null;
    try { gt = P.gatherTargets(tmp, { today: '2026-10-04' }); } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
    const tg = gt && gt.targets.find((x) => x.url === 'https://news.r.ac.kr/bbs/view.do?boardId=5');
    eq('  ⑩ 바로잡은 원문을 날마다 다시 볼 때 그 바로잡기의 원문 제목도 기대 제목 — 앱 이름뿐이라 미뤄지거나 다른 글로 버려지지 않는다',
      [!!tg, tg && tg.titles.includes('2026 표본 우수논문 장학생 선발 공고'), tg && tg.nameOnly], [true, true, false]);
  }

  /* ── G2 층2 짝짓기 ──────────────────────────────────────────────── */
  const eum = T('kosaf', '2000429013');
  const eumPosts = [
    { title: '2026년 한국가스안전공사 지역상생 특별장학생 선발 공고', url: 'https://scholarship.eumseong.go.kr/www/selectBbsNttView.do?key=33&bbsNo=3&nttNo=838', deadline: '2026-10-23' },
    { title: '2026년 군민평생 장학생 선발 공고', url: 'https://scholarship.eumseong.go.kr/www/selectBbsNttView.do?key=33&bbsNo=3&nttNo=828', deadline: '2026-09-18' },
    { title: '2026년 2학기 우수대학생 특별장학금(前명문대 특별장학금) 신청 접수 및 지급 계획 안내', url: 'https://scholarship.eumseong.go.kr/www/selectBbsNttView.do?key=33&bbsNo=3&nttNo=827', deadline: '2026-09-18' },
    { title: '2026년 전입장학금 지원 공고', url: 'https://scholarship.eumseong.go.kr/www/selectBbsNttView.do?key=33&bbsNo=3&nttNo=792', deadline: '2026-11-30' },
  ];
  const asan = T('kosaf', '2000436005');
  const asanPosts = [['2026년 효·선행 장학금 안내', '20260921135833261'], ['2026년 함께키움(다자녀) 장학금 안내', '20260921126853852'], ['2026년 다문화 장학금 안내', '20260921129086443'], ['2026년 우수봉사 장학생(대학생) 선발 공고', '20260714107548723']]
    .map(([title, b]) => ({ title, url: `https://asanmirae.or.kr:449/main/index.php?m_cd=32&b_id=${b}` }));
  const paan = T('kosaf', '2703469001');
  const paanPosts = [
    { title: '파안장학문화재단법인이 어려운 이웃을 위해 2026 추석 자선기금 지원신청을 받습니…', url: 'https://paan.or.kr/sub/sub02_01.php?boardid=notice&mode=view&idx=49' },
    { title: '파안장학문화재단법인이 미래 성공이 기대되는 인재를 2026-2(후기) 장학생으로 선발…', url: 'https://paan.or.kr/sub/sub02_01.php?boardid=notice&mode=view&idx=46' },
    { title: '장학생 신청/자선기금 수혜자 모집 및 발표', url: 'https://paan.or.kr/sub/sub04_01.php' },
  ];
  const pick = (t, posts) => { const p = C.pickKosafPost(t, posts); return p ? p.p.url.split(/[?&](?:nttNo|b_id|idx)=/)[1] : null; };
  const twin = [{ title: '2026년 전입장학금 지원 공고 (1)', url: 'https://scholarship.eumseong.go.kr/www/selectBbsNttView.do?key=33&bbsNo=3&nttNo=1', deadline: '2026-11-30' },
    { title: '2026년 전입장학금 지원 공고 (2)', url: 'https://scholarship.eumseong.go.kr/www/selectBbsNttView.do?key=33&bbsNo=3&nttNo=2', deadline: '2026-11-30' }];
  eq('G2 층2 ↔ 재단 게시판 글 — 음성 전입(마감 같음) · 군민평생은 같은 재단의 다른 사업이라 거절 · 아산(층2 홈 주소가 바로 그 글) · 파안 후기 · 동점 둘이면 안 고른다',
    [pick(eum, eumPosts), C.scoreKosafPost(eum, eumPosts[1]).why, pick(asan, asanPosts), pick(paan, paanPosts), C.pickKosafPost(eum, twin)],
    ['792', ['같은 재단의 다른 사업'], '20260714107548723', '46', null]);
  const km = C.kosafMatches(C.buildIndex({ ...DATA, external: eumPosts.concat(asanPosts) }), eumPosts.concat(asanPosts), { today: '2026-10-04' });
  eq('  kosafMatches — 그 재단 사이트의 글만 후보로(층2 홈 호스트 · 포트 무시) · 후보 출처는 match',
    km.map((c) => [c.target.key, c.source, c.url.split(/[?&](?:nttNo|b_id)=/)[1]]).sort(), [['2000429001', 'match', '828'], ['2000429013', 'match', '792'], ['2000436005', 'match', '20260714107548723']]);
  /* 🔴 (2026-10-12 · 개발자 "KOSAF 원문은 재단의 개별 공고로") 짝지은 재단 피드 글이 겹침(C)으로 거절되던 것 —
     색인에 실린 재단 글(external)은 그 주소의 '주인'이라 collisionOf 가 '다른 공고의 링크'로 세었다(제목이 층2 사업 이름과 다르다).
     같은 재단 사이트의 피드 글은 짝 자체다 · 남의 사이트 글·정식 등록은 그대로 겹침. */
  /* 제목이 층2 사업 이름과 **다른** 재단 글(실데이터 꼴 — 신안 '일반(저소득)장학생' ↔ '2026년 하반기 장학생 선발 공고') */
  const eumOther = { title: '2026년 하반기 음성군장학회 장학생 선발 공고', url: 'https://scholarship.eumseong.go.kr/www/selectBbsNttView.do?key=33&bbsNo=3&nttNo=901', host: '재단', school: '', deadline: '' };
  const idxExt = C.buildIndex({ ...DATA, external: eumPosts.concat(asanPosts, [eumOther]).map((p) => ({ host: '재단', school: '', deadline: '', ...p })) });
  const eumT = idxExt.find({ ds: 'kosaf', key: '2000429013' });
  eq('  층2 ↔ 같은 재단 사이트의 피드 글은 제목이 달라도 겹침이 아니다 (열어 보기 전에 거절되던 것)', [idxExt.ownersOf(eumOther.url).length >= 1, C.collisionOf(eumT, idxExt.ownersOf(eumOther.url))], [true, '']);
  eq('  다른 사이트의 글·정식 등록 주소는 그대로 겹침', [
    !!C.collisionOf(eumT, [{ ds: 'external', key: 'x', raw: 'https://other.or.kr/view?id=1', titles: ['다른 재단 공고'] }]),
    !!C.collisionOf(eumT, [{ ds: 'registered', key: 'reg-x', raw: eumOther.url, titles: ['전혀 다른 제목의 공고'] }]),
  ], [true, true]);
  const tw = C.twinCandidates(C.buildIndex({ ...DATA, pool: [
    { title: SNUE_TITLE, url: 'https://www.snue.ac.kr/snue/na/ntt/selectNttInfo.do?mi=3004&bbsId=1083&nttSn=54793' },
    { title: SNUE_TITLE, url: 'https://www.snue.ac.kr/snue/na/ntt/selectNttList.do?mi=3004&bbsId=1083&nttId=54793' },
    { title: SNUE_TITLE, url: 'https://linguist.snu.ac.kr/23706/' },
    { title: '다른 제목 2026 장학 안내 공고', url: 'https://www.snue.ac.kr/snue/na/ntt/selectNttInfo.do?mi=3004&bbsId=1083&nttSn=1' },
  ] }), { today: '2026-10-04' });
  eq('  twinCandidates — 표식 글과 같은 사이트·같은 제목의 글 주소만(목록+번호·다른 사이트·다른 제목은 아님)', tw.map((c) => [c.target.key === SNUE_MARK, c.url.split('nttSn=')[1]]), [[true, '54793']]);

  /* ── G6 후보 파일 읽기 ──────────────────────────────────────────── */
  let threw = '';
  const garbage = [null, 'x', 3, { items: 'x' }, { items: [null, 1, 'a', [], { target: null }, { target: { ds: 'zz', key: 'a' } }, { target: { ds: 'registered', key: 'reg-s' }, url: 'javascript:alert(1)', by: 'x', addedAt: '2026-10-01' }] }];
  const outs = [];
  for (const g of garbage) { try { outs.push(C.loadCandidates(g, { today: '2026-10-04' })); } catch (e) { threw = String(e); } }
  const ok1 = { target: { ds: 'registered', key: 'reg-s' }, url: 'https://s.ac.kr/bbs/view.do?id=4', by: '세션', addedAt: '2026-10-01' };
  const L = C.loadCandidates({ v: 1, items: [
    ok1, { ...ok1 },
    { target: { ds: 'notices', key: SNUE_MARK.replace(/&/g, '&amp;') }, url: 'https://www.kyonggi.ac.kr/x/selectBbsNttView.do;jsessionid=ABC123?key=1&amp;nttNo=5', by: '세션', addedAt: '2026-10-01' },
    { ...ok1, url: 'https://www.welfarenews.net/news/articleView.html?idxno=211059' },
    { ...ok1, url: 'https://github.com/x/y/issues/365' },
    { ...ok1, url: SNUE_MARK },
    { ...ok1, url: 'https://www.gachon.ac.kr/kor/7986/subview.do?nttId=125842' },
    { target: { ds: 'kosaf', key: 'kosaf-0568001' }, url: 'https://namgu.gwangju.kr/', by: '세션', addedAt: '2026-10-01' },
    { ...ok1, url: 'https://s.ac.kr/bbs/view.do?id=5', addedAt: '2026-07-01' },
    { ...ok1, url: 'https://s.ac.kr/bbs/view.do?id=6', board: 'https://s.ac.kr/bbs/list.do' },
    { target: { ds: 'kosaf', key: '0568001' }, board: 'https://namgu.gwangju.kr/board/list.do', also: ['0568002', 'x'], by: '세션', addedAt: '2026-10-02' },
  ] }, { today: '2026-10-04' });
  eq('G6 후보 파일 — 무엇이 와도 던지지 않는다 · 망가진 파일·줄은 이유와 함께 bad 로', [threw, outs.map((o) => [o.ok.length, o.bad.length > 0])], ['', garbage.map(() => [0, true])]);
  eq('  읽은 줄 — 세션 표식(;jsessionid)·HTML 기호를 걷고 · 신문 기사·저장소·표식·목록+번호·층2 첫 화면·60일 지난 줄·url/board 둘 다·같은 줄 두 번은 bad · 층2 열쇠는 코드로',
    [L.ok.map((c) => c.url || `board:${c.board}`), L.ok[1].target.key === SNUE_MARK, L.ok[2].target.key, L.ok[2].also, L.bad.map((b) => b.i)],
    [['https://s.ac.kr/bbs/view.do?id=4', 'https://www.kyonggi.ac.kr/x/selectBbsNttView.do?key=1&nttNo=5', 'board:https://namgu.gwangju.kr/board/list.do'], true, '0568001', ['0568002'], [1, 3, 4, 5, 6, 7, 8, 9]]);

  /* ── G4 착지 판정 ───────────────────────────────────────────────── */
  const want = ['표본대 2026 성적우수 장학생 선발 공고'];
  const listText = `표본대 2026 성적우수 장학생 선발 공고 ${FILL}`;
  eq('G4 글 주소 → 목록 주소(artclView → artclList · selectNttInfo → selectNttList)·글 번호만 빠진 주소로 돌려보내지면 결정적 「목록」 — 목록에 그 제목 줄이 보여도',
    [J.judgeLanding({ status: 200, requestedUrl: 'https://g.ac.kr/bbs/kor/478/125809/artclView.do', finalUrl: 'https://g.ac.kr/bbs/kor/478/artclList.do', text: listText, titles: want }),
      J.judgeLanding({ status: 200, requestedUrl: 'https://f.or.kr/bbs/board.php?bo_table=s&wr_id=5', finalUrl: 'https://f.or.kr/bbs/board.php?bo_table=s', text: listText, titles: want }).v,
      J.judgeLanding({ status: 200, requestedUrl: 'https://f.or.kr/view.do?id=5&page=2', finalUrl: 'https://f.or.kr/view.do?id=5', headings: [want[0]], text: listText, titles: want }).v],
    [{ v: 'list', why: '글 주소에서 목록 주소로 돌려보내짐', decisive: true, ev: 'weak' }, 'list', 'post']);
  eq('  「삭제된 게시물입니다」 알림창(로봇이 닫고 적어 둔 것)은 결정적 「열리지 않음」 — 제목 자리에 그 제목이 보이면 그대로 공고',
    [J.judgeLanding({ status: 200, requestedUrl: 'https://f.or.kr/v?id=9', dialog: '삭제된 게시물입니다.', text: `메뉴 ${FILL}`, titles: want }).v,
      J.judgeLanding({ status: 200, requestedUrl: 'https://f.or.kr/v?id=9', dialog: '삭제된 게시물입니다.', headings: [want[0]], text: listText, titles: want }).v,
      J.judgeLanding({ status: 200, requestedUrl: 'https://f.or.kr/v?id=9', dialog: '로그인 후 이용하세요', text: `메뉴 ${FILL}`, titles: want }).v !== 'gone'],
    ['gone', 'post', true]);
  eq('  판정은 제목 증거의 세기를 함께 준다 — 제목 자리 strong · 본문 어딘가 weak(후보는 strong 만 원문으로)',
    [J.judgeLanding({ status: 200, requestedUrl: 'https://f.or.kr/v?id=1', headings: [want[0]], text: listText, titles: want }).ev,
      J.judgeLanding({ status: 200, requestedUrl: 'https://f.or.kr/v?id=1', headings: [], text: `작성일 ${listText}`, titles: want }).ev], ['strong', 'weak']);

  /* ── G3 끝에서 끝까지 ──────────────────────────────────────────── */
  const hashTree = (dir, skip) => {
    const out = {};
    const walk = (d) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const f = path.join(d, e.name);
        const rel = path.relative(dir, f).split(path.sep).join('/');
        if (skip(rel)) continue;
        if (e.isDirectory()) walk(f); else out[rel] = crypto.createHash('sha1').update(fs.readFileSync(f)).digest('hex');
      }
    };
    walk(dir);
    return out;
  };
  const changed = (a, b) => [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((k) => a[k] !== b[k]).sort();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'link-cand-'));
  try {
    const Wf = (rel, obj) => { fs.mkdirSync(path.dirname(path.join(tmp, rel)), { recursive: true }); fs.writeFileSync(path.join(tmp, rel), typeof obj === 'string' ? obj : JSON.stringify(obj, null, 1)); };
    const MTITLE = '2026학년도 2학기 표본 장학생 선발 안내';
    const MARK = `https://s.test.ac.kr/bbs/list.do#n-${encodeURIComponent(MTITLE)}`;
    const TWIN = 'https://s.test.ac.kr/bbs/view.do?id=7';
    const PTITLE = '2026학년도 2학기 보통 장학생 선발 안내';
    const PAGE = 'https://s.test.ac.kr/bbs/view.do?id=2';
    const PCAND = 'https://s.test.ac.kr/bbs/view.do?id=8';
    const KPOST = 'https://found.test.or.kr/bbs/view.php?idx=31';
    const KTITLE = '2026 표본장학회 희망장학생 선발 공고';
    const kosafItem = (due, open = '2026-09-25') => ({ code: '0001', org: '표본장학회', name: '희망 장학생', due, home: 'https://found.test.or.kr', fields: { 신청기간: `○ ${open} ~ ${due}` }, files: [{ name: `${KTITLE}.hwp` }] });
    Wf('data/registered.json', { items: [
      { id: 'reg-m', name: '표본 장학생 (2026-2)', boardTitle: MTITLE, sourceUrl: MARK, deadline: '2026-10-20' },
      { id: 'reg-p', name: '보통 장학생 (2026-2)', boardTitle: PTITLE, sourceUrl: PAGE },
    ] });
    Wf('data/notices/index.json', { files: {} });
    Wf('data/notices/nfake.json', { school: '표본대학교', items: [] });
    Wf('data/external.json', { items: [{ title: KTITLE, url: KPOST, deadline: '2026-10-20', host: '표본장학회' }] });
    Wf('data/activities.json', { items: [] });
    Wf('data/kosaf-open.json', { items: [kosafItem('2026-10-20')] });
    Wf('data/forms.json', { templates: [] });
    Wf('data/link-check.json', { updatedAt: null, v: 1, bad: {} });
    Wf('data/link-fixes.json', { v: 1, fix: {} });
    Wf('collector/candidates.json', { items: [{ title: MTITLE, url: TWIN }] });
    Wf('collector/link-candidates.json', { v: 1, items: [
      { target: { ds: 'registered', key: 'reg-p' }, url: PCAND, title: PTITLE, by: '세션 표본', addedAt: '2026-10-04' },
      { target: { ds: 'registered', key: 'reg-p' }, url: 'https://www.welfarenews.net/news/articleView.html?idxno=1', by: '세션 표본', addedAt: '2026-10-04' },
      { target: { ds: 'registered', key: 'reg-없음' }, url: 'https://s.test.ac.kr/bbs/view.do?id=99', by: '세션 표본', addedAt: '2026-10-04' },
    ] });
    const post = (title, extra = '') => ({ status: 200, docTitle: title, headings: [title], text: `${title}\n${extra}\n작성일 2026.09.20 첨부 ${FILL}` });
    const obs = {
      [TWIN]: post(MTITLE, '신청기간: 2026. 9. 25. ~ 10. 20.'),
      [PCAND]: post(PTITLE),
      [PAGE]: post(PTITLE),
      [KPOST]: post(KTITLE, '표본장학회 희망장학생 모집 · 신청기간: 2026. 9. 25.(금) ~ 10. 20.(화)'),
    };
    const fakeFile = path.join(tmp, 'fake.json');
    fs.writeFileSync(fakeFile, JSON.stringify(obs));
    const outFile = path.join(tmp, 'gh-output.txt');
    const run = (day, env = {}) => {
      fs.writeFileSync(outFile, '');
      const r = spawnSync(process.execPath, [path.join(ROOT, 'collector/link-check.mjs')], {
        encoding: 'utf8',
        env: { ...process.env, LINK_CHECK_ROOT: tmp, LINK_CHECK_FAKE: fakeFile, LINK_CHECK_TODAY: day, GITHUB_OUTPUT: outFile,
          LINK_CHECK_TXT: '', LINK_CHECK_ONLY: '', LINK_CHECK_MAX: '', LINK_CHECK_PER_HOST: '', LINK_CHECK_BUDGET_MS: '', LINK_CHECK_SPACING_MS: '', LINK_CHECK_MODE: '', LINK_CHECK_CAND_BUDGET_MS: '', ...env },
      });
      const out = Object.fromEntries(fs.readFileSync(outFile, 'utf8').split('\n').filter(Boolean).map((l) => l.split('=')));
      return { code: r.status, out, err: (r.stderr || '').slice(0, 300) };
    };
    const ledger = () => JSON.parse(fs.readFileSync(path.join(tmp, 'data/link-check.json'), 'utf8'));
    const lcState = () => JSON.parse(fs.readFileSync(path.join(tmp, 'collector/link-check-state.json'), 'utf8'));
    const OUT4 = ['data/link-check.json', 'collector/link-check-state.json', 'collector/link-candidates-state.json', 'collector/link-check-report.md'];
    const skip = (rel) => OUT4.includes(rel) || rel === 'fake.json' || rel === 'gh-output.txt';
    const before = hashTree(tmp, skip);

    const d1 = run('2026-10-05', { LINK_CHECK_MODE: 'candidates' });
    const f1 = ledger().fix || {};
    eq('G3 첫날(후보만) — 로봇이 끝까지 돈다 · 앱 링크는 안 열고 후보 셋(둘째 짝·층2 짝·사람 후보)을 판정 · 넷 다 원문',
      [d1.code, d1.err, d1.out.checked, d1.out.cand_checked, d1.out.cand_verified], [0, '', '0', '3', '3']);
    eq('  확인한 후보가 fix 로 — 표식 정식 등록(id:) · 층2(id:kosaf- + 회차) · 🔴 이미 원문인 정식 등록(reg-p)엔 싣지 않는다',
      [Object.keys(f1), f1['id:reg-m'] && [f1['id:reg-m'].url, f1['id:reg-m'].src], f1['id:kosaf-0001'] && [f1['id:kosaf-0001'].url, f1['id:kosaf-0001'].round]],
      [['id:kosaf-0001', 'id:reg-m'], [TWIN, 'robot'], [KPOST, '2026-10-20']]);
    const rep = fs.readFileSync(path.join(tmp, 'collector/link-check-report.md'), 'utf8');
    eq('  리포트 「원문 후보 확인」 — 올린 것 · 못 읽은 후보 줄(신문 기사) · 못 찾은 공고 · 이미 원문이라 안 실은 것',
      [/### 원문 후보 확인/.test(rep), /2번째 줄: 신문 기사/.test(rep), /reg-없음[^\n]*못 찾음/.test(rep), /reg-p[^\n]*이미 원문/.test(rep)], [true, true, true, true]);
    eq('🔴 네 출력(앱 장부 · 로봇 장부 · 후보 장부 · 리포트) 말고는 한 바이트도 안 바뀐다 — 후보 파일·데이터 파일은 읽기만', changed(before, hashTree(tmp, skip)), []);

    const d2 = run('2026-10-06');
    const s2 = lcState();
    const rep2 = fs.readFileSync(path.join(tmp, 'collector/link-check-report.md'), 'utf8');
    eq('  이튿날 — 리포트 표의 층2 줄에 바로잡은 원문 하나가 「공고 확인」으로 (층2는 바로잡은 원문이 있을 때만 여는 묶음)',
      new RegExp(`\\| ${P.DS_LABEL.kosaf.replace(/[()]/g, '\\$&')} \\| 0 \\| 1 \\|`).test(rep2), true);
    eq('  이튿날 — 원문으로 올린 주소가 날마다 여는 대상이 된다(학생이 실제로 여는 주소 · 층2 포함) · 후보는 다시 안 연다',
      [d2.code, d2.err, s2[TWIN] && s2[TWIN].lastAt, s2[KPOST] && s2[KPOST].lastAt, Object.keys(s2).some((k) => /#n-/.test(k)), d2.out.cand_checked, Object.keys(ledger().fix)],
      [0, '', '2026-10-06', '2026-10-06', false, '0', ['id:kosaf-0001', 'id:reg-m']]);

    Wf('data/kosaf-open.json', { items: [kosafItem('2027-03-20', '2027-03-02')] });
    const d3 = run('2026-10-07');
    const rep3 = fs.readFileSync(path.join(tmp, 'collector/link-check-report.md'), 'utf8');
    eq('  층2 회차(접수 기간)가 바뀌면 그 바로잡기는 빠진다(지난 회차 글을 새 공고로 보여 주지 않는다) · 리포트에 까닭',
      [d3.code, Object.keys(ledger().fix), /kosaf[^\n]*0001[^\n]*회차가 바뀜/.test(rep3) || /0001`[^\n]*회차가 바뀜/.test(rep3)], [0, ['id:reg-m'], true]);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }

  /* ── G5 걸려 있는가 ─────────────────────────────────────────────── */
  const read = (rel) => { try { return fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n'); } catch { return ''; } };
  const wf = read('.github/workflows/link-check.yml').split('\n').filter((l) => !/^\s*#/.test(l)).join('\n');
  const push = (wf.match(/^ {2}push:\n((?: {4}.*\n)+)/m) || [])[1] || '';
  eq('G5 워크플로 — 후보 파일 push 로 깬다(기본 브랜치만) · 그때와 수동 mode 는 후보만 · 후보 장부를 저장하고 감사 실패면 되돌린다',
    [/- 'collector\/link-candidates\.json'/.test(push), /branches:\s*\['claude\/nice-heisenberg-WESq5'\]/.test(push), /^ {6}mode:/m.test(wf),
      /LINK_CHECK_MODE: \$\{\{ inputs\.mode \|\|[^\n]*commits\.\*\.modified[^\n]*collector\/link-candidates\.json[^\n]*commits\.\*\.added[^\n]*'candidates'/.test(wf),
      /git add collector\/link-candidates-state\.json/.test(wf), /git checkout -- collector\/link-candidates-state\.json/.test(wf)],
    [true, true, true, true, true, true]);
  const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
  const lc = strip(read('collector/link-candidates.mjs'));
  eq('  후보 판정 파일은 불러와도 아무것도 쓰지 않는다 · 로봇(link-check.mjs)을 부르지 않는다 · 앱과 같은 source-link.js 를 쓴다',
    [/writeFileSync|appendFileSync|renameSync|unlinkSync|rmSync|mkdirSync/.test(lc), /link-check\.mjs/.test(lc), /require\('\.\.\/source-link\.js'\)/.test(lc)], [false, false, true]);
  eq('  후보 파일은 사람·세션이 쓰는 입력 — 합집합 병합 표시를 달지 않는다(규칙 없이 달면 병합기가 1 로 끝난다) · 후보 장부는 내 쪽',
    [/link-candidates\.json\s+merge=jsonunion/.test(read('.gitattributes')), /collector\/link-candidates-state\.json\s+merge=ours/.test(read('.gitattributes')), W(read('collector/link-candidates.json')).length > 0],
    [false, true, true]);
}

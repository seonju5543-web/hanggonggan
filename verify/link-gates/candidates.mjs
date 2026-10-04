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

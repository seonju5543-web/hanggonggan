/* 「로봇·도구 점검 관문」 gate 묶음 — 데이터 관문 · 되돌리기 구조 (2026-10-04 대대적 점검)
   잰다:
     ① 학사·석사 나란히 적은 줄 — DAAD `… 학사 및 석사과정 학생` 이 학부생에게 '지원 자격 미달'로 보였다(틀린 미달).
        고치면서 'both' 갈래에 남는 글자 잣대를 같이 넣었다(안 넣으면 독일어 요건을 묻지도 않고 95% = 틀린 안심).
     ② 관리자 저장 = 로봇 관문 — 관리자 저장 관문(admin-apply.yml)은 감사(audit-data) 하나만 돌려, test-collector 만 아는 규칙
        (활동 출처 근거 10자 · 소식 출처 학교당 하나 · 화면 문구 끝 날짜 = 마감)을 어긴 저장이 통과하고 **다음 로봇 실행의 데이터 관문이
        빨개졌다**. 규칙을 감사가 쓰는 한 곳(verify/source-rules.cjs · entry-rules checkEntry)으로 옮기고 저장소가 저장 전에 같은 함수로 거절한다.
        감사의 일은 auditSourceFiles 하나 — 표본으로 돌리고, 감사가 그 결과를 경고로 낮추지 않았는지도 본다(리뷰: errors→warns 로 바꿔도 조용했다).
     ③ 실데이터 단정 톱니 — test-collector 가 실데이터를 읽어 단정하면 로봇이 데이터를 바꾸는 순간 관문이 빨개진다(10-01·10-04 사고).
        읽는 곳 수를 파일별로 세어 늘면 빨간불(ROOT 기준 path.join·readFileSync 꼴 포함) · 도구가 대신 읽는 호출(TOOL_READS_ALLOW)도 ·
        저장 전 관문이 없던 등록금·학과 갱신 로봇에 관문 · 등록금 표본.
     ④ 데이터 관문 되돌리기 — 되돌린 뒤 관문을 다시 재지 않아(revert-auto) 원인이 기존 항목이면 관문 실패 상태로 저장되고,
        링크 사냥꾼은 결과를 버리고도 초록불이었다. collector/gate-guard.mjs 를 임시 git 저장소 + 가짜 관문으로 잰다 · 워크플로 배선 · 쉬기 장부.
        소식 로봇도 같은 도구를 쓴다 — 단락이 늘 '정식 등록'을 말해 소식 리포트에 사실과 반대인 문장이 들어갔다(리뷰) → 소식 단계 시나리오도 잰다.
     ⑤ 알림이 제 리포트로 간다 — '"수집 리포트" in:title' 부분 일치가 다른 로봇의 리포트 이슈를 집었다(#381) · 워크플로 전부를 본다.
     ⑥ 양식 대기열 고아 — 정식 등록에서 빠진 공고의 대기 항목(123건 중 71건)을 스키마화 로봇이 매 실행 정리한다.
   🔴 표본(고정 예시)만 잰다 — data/·collector/ 장부를 읽어 단정하지 말 것(verify/health-gates.mjs 머리말). */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

/* 임시 폴더에서 돌리는 자식 프로세스의 환경 — GIT_DIR·GIT_WORK_TREE·GIT_INDEX_FILE 같은 GIT_* 가 남아 있으면(git 훅 안에서 관문을 돌릴 때)
   임시 저장소의 git init·commit·checkout 이 **진짜 저장소**에 커밋·되돌리기를 한다(리뷰 2026-10-04) → 전부 지운다 */
export const cleanEnv = (extra = {}) => {
  const e = { ...process.env, ...extra };
  for (const k of Object.keys(e)) if (/^GIT_/.test(k)) delete e[k];
  /* 로봇을 라이브러리로만 불러오는 표식(ACTIVITY_DOCS_AS_LIB)은 물려주지 않는다 — 물려받은 activity-docs.mjs 자식은 본편을 안 돌고 0 으로 끝나
     관문이 헛잰다(2026-10-05 병합: test-collector 가 앞 절에서 불러온 elig-ocr-guard.mjs 가 표식을 남겨 bodies ②ⓑ 둘이 빨갰다). 일부러 넘길 때만 남긴다 */
  if (!Object.prototype.hasOwnProperty.call(extra, 'ACTIVITY_DOCS_AS_LIB')) delete e.ACTIVITY_DOCS_AS_LIB;
  return e;
};

/* 주석을 걷어낸 소스 — 주석에 남은 글자로 관문이 통과하지 않게 */
export const stripComments = (s) => String(s).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
export const stripYamlComments = (s) => String(s).replace(/^\s*#.*$/gm, '');

/* test-collector 소스에서 **실데이터를 읽는 곳**을 파일별로 센다 — `new URL('../data/…')`·`require('../data/…')`·
   `createRequire(…)('../data/…')`·`readFileSync('data/…')`·`path.join(ROOT|root|__dirname…, 'data/…')`(조각으로 나눠 적은
   `path.join(ROOT, 'data', 'x.json')` 포함) 와 로봇·관리자가 쓰는 설정·장부 json.
   임시 폴더 표본(`path.join(dir, 'data/…')` — 저장소 뿌리 이름이 아닌 것)은 세지 않는다.
   (리뷰 2026-10-04: `fs.readFileSync(path.join(ROOT, 'data/registered.json'))` 꼴은 세지 않아 톱니를 조용히 비켜 갈 수 있었다) */
const CFG_FILES = 'news-sources|activity-sources|external-sources|schools|own-programs|pending-forms|news-config|activity-config';
const ROOT_NAMES = String.raw`(?:ROOT|root|REPO|repo|repoRoot|__dirname|HERE|process\.cwd\(\))`;
export function realDataReads(src) {
  const target = String.raw`['\x60](?:\.{1,2}/)?(data/[^'\x60]*|collector/(?:${CFG_FILES})\.json)['\x60]`;
  const res = [
    new RegExp(String.raw`(?:new URL|req(?:uire)?|\)|readFileSync|readText)\(\s*${target}`, 'g'),
    new RegExp(String.raw`path\.(?:join|resolve)\(\s*${ROOT_NAMES}\s*,\s*(?:['\x60]\.\.['\x60]\s*,\s*)?${target}`, 'g'),
  ];
  const n = {};
  const add = (k) => { n[k] = (n[k] || 0) + 1; };
  const code = stripComments(src);
  for (const re of res) for (const m of code.matchAll(re)) add(m[1]);
  /* 조각으로 나눠 적은 꼴 — path.join(ROOT, 'data', 'registered.json') */
  const seg = new RegExp(String.raw`path\.(?:join|resolve)\(\s*${ROOT_NAMES}\s*,\s*(?:['\x60]\.\.['\x60]\s*,\s*)?['\x60](data|collector)['\x60]\s*,\s*['\x60]([^'\x60]+)['\x60]`, 'g');
  for (const m of code.matchAll(seg)) {
    const k = `${m[1]}/${m[2]}`;
    if (m[1] === 'data' || new RegExp(String.raw`^collector/(?:${CFG_FILES})\.json$`).test(k)) add(k);
  }
  return n;
}
/* 불러온 **도구가 대신** 실데이터를 읽는 곳 — 정규식으로는 안 보인다(예: deadline-audit 의 auditDeadlines() 가 registered.json 을 읽고,
   그 결과로 '마감은 전부 YYYY-MM-DD' 실데이터 단정이 남아 있다). 호출 수를 세어 늘면 ✕ · 다음 점검에서 줄일 목록이다.
   🔴 늘리지 말 것 — 표본 파일을 넘기는 꼴(what-shows 의 WHAT_SHOWS_REGISTERED 처럼)로 바꾸고 줄인다. */
export const TOOL_READS_ALLOW = {
  'auditDeadlines(': { reads: 'data/registered.json (verify/deadline-audit.mjs)', allow: 1 },
};
export function toolDataReads(src) {
  const code = stripComments(src);
  return Object.fromEntries(Object.keys(TOOL_READS_ALLOW).map((k) => [k, code.split(k).length - 1]));
}
/* 허용 개수(2026-10-04 1단계 정리 뒤 실측). 🔴 늘리지 말 것 — 실데이터의 항목 불변식은 verify/audit-data.js(entry-rules·source-rules)로,
   개수·'있어야 한다'는 표본 단정 + `ℹ` 숫자 보이기로. 줄었으면 이 표도 줄인다(다음 점검에서 남은 것을 줄인다). */
export const REAL_READ_ALLOW = {
  'data/registered.json': 11, 'data/forms.json': 3, 'data/activities.json': 3, 'data/external.json': 1,
  'data/news/index.json': 2, 'data/notices/': 1, 'data/notices.json': 1, 'data/majors/index.json': 1, 'data/${f}.json': 1,
  'collector/schools.json': 5, 'collector/activity-sources.json': 2, 'collector/news-sources.json': 1,
  'collector/external-sources.json': 1, 'collector/own-programs.json': 1,
};

/* 관리자 저장소(tools/admin-apply.mjs)를 임시 폴더에서 진짜로 돌린다 — 글자를 훑지 않는다 */
function adminRun(root, files, action, payload) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hdj-gate-admin-'));
  for (const [rel, body] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), typeof body === 'string' ? body : `${JSON.stringify(body, null, 1)}\n`);
  }
  return {
    dir,
    run(act = action, pay = payload) {
      const r = spawnSync(process.execPath, [fileURLToPath(new URL('tools/admin-apply.mjs', root))],
        { cwd: dir, encoding: 'utf8', env: cleanEnv({ ACTION: act, ACTOR: 'gate', PAYLOAD: JSON.stringify(pay) }) });
      return { status: r.status, out: `${r.stdout || ''}${r.stderr || ''}` };
    },
    read: (rel) => fs.readFileSync(path.join(dir, rel), 'utf8'),
    done: () => fs.rmSync(dir, { recursive: true, force: true }),
  };
}

export default async function gate(eq, ctx) {
  const root = ctx.root;
  /* ── ① 학사·석사 나란히 적은 줄 ── */
  {
    const PR = require('../../parse-requirements.js');
    const ME = require('../../match-engine.js');
    const DAAD = '유럽언어기준 B1 이상의 독일어 능력을 보유한 학사 및 석사과정 학생';
    const lines = [DAAD, '학사 또는 석사과정 재학생', '학사, 석사ㆍ박사과정에 재학 중인 학생',
      '학사 및 석사 학위 소지자', '학사 학위 소지자로서 대학원 진학 예정자', '국내 대학원 석사과정 재학생'];
    eq('① 학사를 석사와 나란히 적은 과정 이름은 학부도 받는다 (`및`·`또는`·`,` · 학위 소지자·대학원 과정은 아님)',
      lines.map((l) => PR.mentionsUndergrad(l)), [true, true, true, false, false, false]);
    const prof = { school: '한국항공대학교', campus: '', track: 'humanities', major: '영어학과', year: 3, status: '재학',
      gpa: 3.2, bracket: 6, credits: 14, region: '서울', parentRegion: '서울', nationality: 'korean', birthYear: 2004, flags: [], common: {} };
    const d = ME.fitDetail({ id: 't', name: 't', eligibilityLines: [DAAD], eligibility: {} }, prof);
    eq('① DAAD 줄은 학부 3학년에게 미달도 ✓ 도 아니다 — [미달 수, 자격 미확인] (독일어 요건을 묻지 않았다)',
      [(d.fails || []).length, !!d.unread], [0, true]);
    const both = (t) => PR.parseLine(t, false).conds.filter((c) => c.kind === 'degree').map((c) => c.want);
    eq('① 학위 이야기뿐인 줄은 여전히 학부·대학원 둘 다 ✓ (잣대가 ✓ 길을 죽이지 않았다)',
      [both('대학생 및 대학원 재학생'), both('대학생 또는 대학원 학·석·박사 과정 재학생')], [['both'], ['both']]);
  }

  /* ── ② 관리자 저장 = 로봇 관문 ── */
  {
    const ER = require('../entry-rules.cjs');
    const SR = require('../source-rules.cjs');
    const served = require('../../match-engine.js').SERVED_SCHOOLS;
    /* ⓓ 순수 규칙 — 감사·관리자 저장·자동 등록이 같은 checkEntry 를 쓴다 */
    const regBase = { id: 't1', name: '표본 장학금', type: '교외', provider: '표본재단', amount: '100만원', summary: '표본',
      eligibility: {}, documents: ['신청서'], sourceUrl: 'https://example.ac.kr/view.do?seq=1', noForm: '표본', listedAt: '2026-07-01',
      deadline: '2026-08-31', period: '신청 2026.7.6(월) ~ 8.31(월) 18:00' };
    const periodErr = (o) => ER.checkEntry({ ...regBase, ...o }).filter((p) => p.level === 'error').map((p) => p.msg).filter((m) => /화면 문구의 끝 날짜/.test(m)).length;
    eq('② ⓓ 화면 문구의 끝 날짜 ≠ 마감은 등록 규칙 오류 · 같으면·문구에 날짜가 없으면·상시 제도면 통과',
      [periodErr({ deadline: '2026-12-30' }), periodErr({}), periodErr({ deadline: '2026-12-30', period: '접수 기간 원문 확인' }), periodErr({ deadline: '2026-12-30', program: true })], [1, 0, 0, 0]);
    eq('  lastDateIn 표 — 끝 날짜 · 발표 날짜 아님 · 해 빌리기 · 해 넘김 · 평점 소수 아님 · 날짜 없음',
      [ER.lastDateIn('신청 2026.7.6(월) ~ 8.31(월) 18:00', '2026'), ER.lastDateIn('모집 ~2026.8.5 · 선발 발표 8.26(수)', '2026'),
        ER.lastDateIn('접수 ~9/18', '2026'), ER.lastDateIn('접수 2026.12.20 ~ 1.10', '2026'),
        ER.lastDateIn('접수 ~ 2026. 9. 18.(금) 18:00 · 평점 3.5 ~ 4.5', '2026'), ER.lastDateIn('접수 기간 원문 확인', '2026')],
      ['2026-08-31', '2026-08-05', '2026-09-18', '2027-01-10', '2026-09-18', null]);
    /* 감사가 출처 규칙을 **오류로** 넣는가 — 예전엔 `SR.…Problems(` 를 부르는지만 봐서, 감사의 errors.push 를 warns.push 로 바꿔도
       이 관문·test-collector 가 둘 다 초록이었다(리뷰 2026-10-04 실측). 그러면 로봇 길(찾기 로봇이 news-sources.json 을 고칠 때)을
       막는 곳이 하나도 없다. 그래서 감사의 일은 source-rules 의 auditSourceFiles 하나로 모으고 ⓔ 그 함수를 표본으로 돌리고
       ⓕ 감사가 그 결과를 **errors 에만** 넣는지(그리고 집계 사이트 정규식을 link-fix.mjs 에서 받아 넘기는지) 주석 걷은 소스로 본다. */
    const audSrc = stripComments(fs.readFileSync(new URL('verify/audit-data.js', root), 'utf8'));
    const calls = audSrc.match(/[^\n]*auditSourceFiles\([^\n]*/g) || [];
    eq('② ⓕ 감사가 출처 규칙 결과를 **오류(errors)로만** 넣는다 · 집계 사이트 정규식은 link-fix.mjs 에서 받아 넘긴다 · 마감일 감사 도구는 lastDateIn 을 불러 쓴다 · 찾기 로봇 문턱도 같은 파일',
      [calls.length, calls.every((l) => /^\s*errors\.push\(\.\.\.SR\.auditSourceFiles\(readCfg, \{ served, aggregator \}\)\);\s*$/.test(l)),
        /aggregator = require\('\.\.\/collector\/link-fix\.mjs'\)\.AGGREGATOR_RE/.test(audSrc),
        /const \{ lastDateIn \} = require\('\.\/entry-rules\.cjs'\)/.test(fs.readFileSync(new URL('verify/deadline-audit.mjs', root), 'utf8')),
        /MIN_ROWS = SOURCE_RULES\.NEWS_MIN_ROWS/.test(fs.readFileSync(new URL('collector/find-news-boards.mjs', root), 'utf8'))],
      [1, true, true, true, true]);
    /* ⓔ 감사가 부르는 함수를 표본 파일로 돌린다 — 실데이터를 읽지 않는다 */
    {
      const { AGGREGATOR_RE } = await import(new URL('collector/link-fix.mjs', root));
      const okAct = { sources: [{ school: '경희대학교', campus: '공통', boardUrl: 'https://ex.ac.kr/board', evidence: '표본 — 학교 누리집 메뉴에서 확인' }, { school: '', host: '표본재단', boardUrl: null }], parked: [] };
      const okNews = { sources: [{ school: '경희대학교', campus: '공통', boardUrl: 'https://k.ac.kr/notice', evidence: '표본 — 학교 누리집 메뉴에서 확인' }], parked: [] };
      const sch = { schools: [{ school: '경희대학교' }] };
      const reader = (files) => (rel) => { if (!(rel in files)) throw new Error(`없음: ${rel}`); return files[rel]; };
      const run = (files, opts = { served, aggregator: AGGREGATOR_RE }) => SR.auditSourceFiles(reader(files), opts);
      const base = { 'collector/activity-sources.json': okAct, 'collector/news-sources.json': okNews, 'collector/schools.json': sch };
      const hit = (errs, re) => errs.some((m) => re.test(m));
      const badAct = run({ ...base, 'collector/activity-sources.json': { sources: [
        { school: '경희대학교', boardUrl: 'https://ex.ac.kr/b2', evidence: '학교 공지 확인' },
        { school: '', host: '표본', boardUrl: 'https://linkareer.com/list/activity', evidence: '표본 — 주최가 올린 게시판이 아닌 것' },
        { school: '없는대학교', boardUrl: null }] } });
      const badNews = run({ ...base, 'collector/news-sources.json': { sources: [okNews.sources[0], { school: '경희대학교', boardUrl: 'https://k.ac.kr/two', evidence: '표본 — 학교 누리집 메뉴에서 확인' }] } });
      eq('② ⓔ 감사 함수(auditSourceFiles) 표본 — 멀쩡하면 0건 · 짧은 근거·집계 사이트·서비스 밖 학교 · 한 학교 게시판 둘 · 못 읽음 · 집계 규칙 못 받음은 전부 오류',
        [run(base), hit(badAct, /10자 넘게/), hit(badAct, /집계 사이트는 출처가 아닙니다/), hit(badAct, /없는대학교 — 서비스하지 않는 학교/), hit(badNews, /게시판이 있는 줄이 2개/),
          hit(run({ 'collector/schools.json': sch, 'collector/news-sources.json': okNews }), /activity-sources — 출처 목록을 읽지 못했습니다/),
          hit(run(base, { served }), /집계 사이트 규칙.*받지 못해/)],
        [[], true, true, true, true, true, true]);
    }

    /* ⓐ 활동 출처 — 짧은 근거에도 날짜 도장이 붙어 감사 규칙을 넘는다 */
    {
      const A = adminRun(root, {
        'data/registered.json': { items: [] }, 'data/forms.json': { forms: {}, templates: {} },
        'data/activities.json': { updatedAt: '2026-10-04', items: [] }, 'collector/activity-config.json': { hideUrls: [] },
        'collector/activity-sources.json': { sources: [{ school: '경희대학교', campus: '공통', boardUrl: 'https://ex.ac.kr/board', evidence: '표본 — 학교 누리집 메뉴에서 확인' }], parked: [], _parked: '되돌리려면' },
      }, 'activitySource', { op: 'add', source: { school: '한국외국어대학교', boardUrl: 'https://ex.ac.kr/b3', evidence: '학교 공지 확인' } });
      const r = A.run();
      const src = JSON.parse(A.read('collector/activity-sources.json'));
      const row = src.sources.find((x) => x.boardUrl === 'https://ex.ac.kr/b3') || {};
      eq('② ⓐ 활동 출처 추가 — 8자 근거에도 날짜 도장이 붙어 감사 규칙(10자 넘게)을 넘는다',
        [r.status, (row.evidence || '').length > 10, /관리자 화면에서 등록/.test(row.evidence || ''), SR.activitySourceProblems(src, { served })], [0, true, true, []]);
      A.done();
      /* 보관해 둔 옛 줄의 근거가 짧으면 되살리기도 저장 전에 거절한다(감사와 같은 규칙 — 이 작업이 새로 만든 문제만) */
      const P = adminRun(root, {
        'data/registered.json': { items: [] }, 'data/forms.json': { forms: {}, templates: {} },
        'data/activities.json': { updatedAt: '2026-10-04', items: [] }, 'collector/activity-config.json': { hideUrls: [] },
        'collector/activity-sources.json': { sources: [], parked: [{ school: '경희대학교', campus: '공통', boardUrl: 'https://ex.ac.kr/old', evidence: 'x' }], _parked: '되돌리려면' },
      });
      const up = P.run('activitySource', { op: 'unpark', boardUrl: 'https://ex.ac.kr/old' });
      const left = JSON.parse(P.read('collector/activity-sources.json'));
      eq('  근거가 짧은 옛 줄 되살리기는 저장 전에 거절 (파일 그대로 · 사유를 말한다)',
        [up.status !== 0, /데이터 관문에 걸립니다/.test(up.out), left.sources.length, left.parked.length], [true, true, 0, 1]);
      P.done();
    }
    /* ⓑ 소식 출처 — 보관 → 새 주소 추가 → 옛 줄 되살리기는 거절(학교 하나에 게시판 하나) */
    {
      const N = adminRun(root, {
        'data/registered.json': { items: [] }, 'data/forms.json': { forms: {}, templates: {} }, 'data/admin-log.json': { items: [] },
        'collector/schools.json': { schools: [{ school: '경희대학교' }, { school: '서울대학교' }] },
        'collector/news-sources.json': { sources: [{ school: '경희대학교', campus: '공통', boardUrl: 'https://k.ac.kr/notice', evidence: '표본 — 학교 누리집 메뉴에서 확인', candidates: [] }],
          parked: [{ school: '서울대학교', campus: '', boardUrl: 'https://s.ac.kr/old', evidence: '짧음' }], _parked: '되돌리려면' },
      });
      const s1 = N.run('newsSource', { op: 'park', boardUrl: 'https://k.ac.kr/notice' }).status;
      const s2 = N.run('newsSource', { op: 'add', source: { school: '경희대학교', boardUrl: 'https://k.ac.kr/new-notice', evidence: '표본 근거' } }).status;
      const r3 = N.run('newsSource', { op: 'unpark', boardUrl: 'https://k.ac.kr/notice' });
      const src = JSON.parse(N.read('collector/news-sources.json'));
      eq('② ⓑ 소식 출처 보관 → 새 주소 → 옛 줄 되살리기는 거절 · 파일에는 그 학교 게시판 줄이 하나',
        [s1, s2, r3.status !== 0, /이미 게시판이 있습니다/.test(r3.out), src.sources.filter((x) => x.school === '경희대학교' && x.boardUrl).length,
          SR.newsSourceProblems(src, { schools: ['경희대학교', '서울대학교'] })], [0, 0, true, true, 1, []]);
      /* 근거도 로봇 확인도 없는 옛 줄 되살리기 — 학교 자리는 비어 있어도 저장 전 확인(감사와 같은 규칙)이 거절한다 */
      const r4 = N.run('newsSource', { op: 'unpark', boardUrl: 'https://s.ac.kr/old' });
      eq('  근거 없는 옛 줄 되살리기는 저장 전에 거절', [r4.status !== 0, /데이터 관문에 걸립니다/.test(r4.out)], [true, true]);
      N.done();
    }
    /* ⓒ 마감만 고치고 문구를 두면 저장 전에 거절 · 문구를 같이 고치면 통과 */
    {
      const files = { 'data/registered.json': { items: [regBase] }, 'data/forms.json': { forms: {}, templates: {} },
        'collector/auto-register-config.json': { enabled: true, blockIds: [], blockUrls: [] } };
      const E1 = adminRun(root, files);
      const before = E1.read('data/registered.json');
      const r1 = E1.run('edit', { edits: [{ id: 't1', patch: { deadline: '2026-12-30' } }] });
      const after1 = E1.read('data/registered.json');
      E1.done();
      const E2 = adminRun(root, files);
      const r2 = E2.run('edit', { edits: [{ id: 't1', patch: { deadline: '2026-12-30', period: '신청 2026.7.6(월) ~ 12.30(수) 18:00' } }] });
      const it2 = JSON.parse(E2.read('data/registered.json')).items[0];
      E2.done();
      eq('② ⓒ 마감만 고치고 문구를 두면 저장 전에 거절(파일 그대로 · 이유를 말한다) · 문구를 같이 고치면 저장',
        [r1.status !== 0, /화면 문구의 끝 날짜/.test(r1.out), after1 === before, r2.status, it2.deadline, it2.period],
        [true, true, true, 0, '2026-12-30', '신청 2026.7.6(월) ~ 12.30(수) 18:00']);
      /* 자동 등록분의 문구는 늘 `접수 ~YYYY-MM-DD` — 마감만 고쳐도 문구가 따라가 저장된다(리뷰 2026-10-04 · 흔한 관리자 작업이 '문구도 손으로'가 됐었다) */
      const E3 = adminRun(root, { ...files, 'data/registered.json': { items: [{ ...regBase, period: '접수 ~2026-08-31' }] } });
      const r3 = E3.run('edit', { edits: [{ id: 't1', patch: { deadline: '2026-12-30' } }] });
      const it3 = JSON.parse(E3.read('data/registered.json')).items[0];
      E3.done();
      const { periodAfterDeadline: pad } = await import(new URL('tools/edit-diff.mjs', root));
      eq('  자동 등록 꼴(접수 ~옛 마감)은 마감만 고쳐도 문구가 따라가 저장 · 사람 꼴 문구·같은 날짜는 짐작해 고치지 않는다 (화면 미리보기도 같은 함수)',
        [r3.status, it3.period, pad('접수 ~2026-08-31', '2026-12-30', '2026-08-31'), pad('신청 2026.7.6(월) ~ 8.31(월) 18:00', '2026-12-30', '2026-08-31'), pad('접수 ~2026-08-31', '2026-08-31', '2026-08-31'), pad('2차 ~2026-10-01', '2026-12-30', '2026-08-31')],
        [0, '접수 ~2026-12-30', '접수 ~2026-12-30', '신청 2026.7.6(월) ~ 8.31(월) 18:00', '접수 ~2026-08-31', '2차 ~2026-10-01']);
    }
  }

  /* ── ③ 실데이터 단정 톱니 ── */
  {
    const tc = fs.readFileSync(new URL('verify/test-collector.mjs', root), 'utf8');
    const now = realDataReads(tc);
    const over = Object.entries(now).filter(([f, n]) => n > (REAL_READ_ALLOW[f] || 0)).map(([f, n]) => `${f} ${REAL_READ_ALLOW[f] || 0}→${n}`);
    eq('③ test-collector 의 실데이터 읽기가 늘지 않았다 (늘었으면 그 단정은 audit-data.js 로 · 개수·있음은 표본 + ℹ — CLAUDE.md)', over, []);
    const under = Object.entries(REAL_READ_ALLOW).filter(([f, n]) => (now[f] || 0) < n).map(([f, n]) => `${f} ${n}→${now[f] || 0}`);
    if (under.length) console.log(`  ℹ 실데이터 읽기가 줄었다 — 허용 표(REAL_READ_ALLOW)도 줄이세요: ${under.join(' · ')}`);
    const plus = (line) => (realDataReads(`${tc}\n${line}`)['data/registered.json'] || 0) - (now['data/registered.json'] || 0);
    eq('  톱니가 헛돌지 않는다 — 읽는 꼴마다 표본 한 줄을 더하면 센다(new URL · ROOT 기준 path.join · 조각 path.join · 상대 경로 readFileSync) · 임시 폴더 표본은 안 센다',
      [plus("JSON.parse(readText(new URL('../data/registered.json', import.meta.url)));"), plus("fs.readFileSync(path.join(ROOT, 'data/registered.json'), 'utf8');"),
        plus("fs.readFileSync(path.join(__dirname, '..', 'data', 'registered.json'), 'utf8');"), plus("fs.readFileSync('data/registered.json', 'utf8');"),
        plus("fs.writeFileSync(path.join(dir, 'data/registered.json'), '{}');")],
      [1, 1, 1, 1, 0]);
    const tools = toolDataReads(tc);
    const toolOver = Object.entries(tools).filter(([k, n]) => n > TOOL_READS_ALLOW[k].allow).map(([k, n]) => `${k} ${TOOL_READS_ALLOW[k].allow}→${n} (${TOOL_READS_ALLOW[k].reads})`);
    eq('③ 도구가 대신 실데이터를 읽는 호출도 늘지 않았다 (TOOL_READS_ALLOW — 다음 점검에서 줄일 목록)', toolOver, []);
    const toolUnder = Object.entries(tools).filter(([k, n]) => n < TOOL_READS_ALLOW[k].allow).map(([k, n]) => `${k} ${TOOL_READS_ALLOW[k].allow}→${n}`);
    if (toolUnder.length) console.log(`  ℹ 도구가 대신 읽는 호출이 줄었다 — 표(TOOL_READS_ALLOW)도 줄이세요: ${toolUnder.join(' · ')}`);
    eq('  (도구 호출 톱니도 헛돌지 않는다 — 한 줄 더하면 센다)', toolDataReads(`${tc}\nDA.auditDeadlines(new Date());`)['auditDeadlines('], (tools['auditDeadlines('] || 0) + 1);
    /* 등록금·학과 갱신 로봇도 저장 전에 데이터 관문을 지난다 — 관문 단계에 continue-on-error 가 없고 git commit 보다 앞 */
    const gated = (wf) => {
      const y = stripYamlComments(fs.readFileSync(new URL(`.github/workflows/${wf}`, root), 'utf8'));
      const steps = y.split(/\n(?=\s+- name:)/);
      const st = steps.find((s) => /node verify\/test-collector\.mjs/.test(s) && /node verify\/audit-data\.js/.test(s));
      return !!st && !/continue-on-error/.test(st) && y.indexOf(st) < y.indexOf('git commit');
    };
    eq('③ 등록금·학과 갱신 로봇이 저장 전에 데이터 관문을 지난다 (걸리면 저장 없이 빨간불)',
      [gated('refresh-tuition.yml'), gated('refresh-majors.yml')], [true, true]);
    const PA = require('../../parse-amount.js');
    const T = { '한국외국어대학교': { avg: 7791804, byField: { 인문사회: 7269500 } } };
    eq('③ 등록금 표본 — 표의 1년치를 한 학기로 (외대 인문사회 7,269,500 → 3,634,750 · 실데이터를 읽지 않는다)',
      [PA.tuitionFor({ school: '한국외국어대학교', track: 'humanities' }, T), PA.tuitionSource({ school: '한국외국어대학교', track: 'humanities' }, T)], [3634750, 'field']);
  }

  /* ── ④ 데이터 관문 되돌리기 ── */
  {
    const guardPath = fileURLToPath(new URL('collector/gate-guard.mjs', root));
    const STAGES = ['--stage', 'auto', '--stage', 'data/registered.json,data/forms.json,collector/pending-forms.json'];
    const J = (x) => `${JSON.stringify(x, null, 1)}\n`;
    /* 임시 git 저장소 — HEAD 판을 커밋하고, 이번 실행이 바꾼 것을 덮어쓴 뒤 gate-guard 를 진짜로 돌린다.
       가짜 관문: 정식 등록에 bad:true 항목이 있으면 ✕ 한 줄을 찍고 exit 1 */
    /* 가짜 관문은 정식 등록·소식 발행분(data/news/*.json)·소식 출처 목록 어디든 bad:true 항목이 있으면 ✕ */
    const CHECK = [
      "const fs = require('fs'); const rd = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return {}; } };",
      "const news = fs.existsSync('data/news') ? fs.readdirSync('data/news').filter((f) => f.endsWith('.json')).flatMap((f) => rd('data/news/' + f).items || []) : [];",
      "const bad = [...(rd('data/registered.json').items || []), ...news, ...(rd('collector/news-sources.json').sources || [])].filter((i) => i && i.bad);",
      "if (bad.length) { console.log('  ✕ 표본 관문 — bad 항목 ' + bad.map((i) => i.id).join(',')); process.exit(1); }",
      "console.log('  ✓ 표본 관문'); process.exit(0);",
    ].join('\n');
    const scenario = (head, work, { stages = STAGES, extra = {} } = {}) => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hdj-gate-guard-'));
      const w = (rel, body) => { fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); fs.writeFileSync(path.join(dir, rel), typeof body === 'string' ? body : J(body)); };
      const g = (...a) => spawnSync('git', a, { cwd: dir, encoding: 'utf8', env: cleanEnv() });
      g('init', '-q'); g('config', 'user.email', 'gate@example.com'); g('config', 'user.name', 'gate'); g('config', 'commit.gpgsign', 'false');
      w('check.cjs', `${CHECK}\n`);
      for (const [rel, body] of Object.entries(head)) w(rel, body);
      g('add', '-A'); g('commit', '-qm', 'head');
      for (const [rel, body] of Object.entries(work)) w(rel, body);
      const outFile = path.join(dir, '.gh-output');
      const r = spawnSync(process.execPath, [guardPath, '--report', 'r.md', '--note', path.join(dir, 'note.md'), ...stages],
        { cwd: dir, encoding: 'utf8', env: cleanEnv({ GATE_CMD: 'node check.cjs', GITHUB_OUTPUT: outFile, ...extra }) });
      const read = (rel) => (fs.existsSync(path.join(dir, rel)) ? fs.readFileSync(path.join(dir, rel), 'utf8') : null);
      const out = Object.fromEntries((read('.gh-output') || '').split('\n').filter(Boolean).map((l) => l.split('=')));
      const res = { status: r.status, out, read, headReg: g('show', 'HEAD:data/registered.json').stdout };
      return { ...res, done: () => fs.rmSync(dir, { recursive: true, force: true }) };
    };
    const HEAD = { 'data/registered.json': { items: [{ id: 'old', auto: true, v: 1 }] }, 'data/forms.json': { templates: {} },
      'collector/pending-forms.json': { items: [{ id: 'old', fetched: true }] }, 'r.md': '# 리포트\n\n### 🤖 자동 등록 (선조치후보고) — 2건 등록\n\n- 표본\n' };
    /* ㉠ 새 자동 등록분이 원인 → 그것만 빼고 통과 · 기존 항목 개선(v:2)은 남는다 · 대기열에서도 빠진다 · 쉬기 장부에 적힌다 */
    {
      const S = scenario(HEAD, { 'data/registered.json': { items: [{ id: 'old', auto: true, v: 2 }, { id: 'n1', auto: true, bad: true }, { id: 'n9', auto: true }] },
        'collector/pending-forms.json': { items: [{ id: 'old', fetched: true }, { id: 'n1' }, { id: 'n9' }] } });
      const reg = JSON.parse(S.read('data/registered.json'));
      const held = JSON.parse(S.read('collector/auto-held.json') || '{"items":[]}');
      const rep = S.read('r.md');
      eq('④ ㉠ 새 자동 등록분이 원인 → 그것만 빼고 통과(reverted-auto) · 기존 항목 개선은 남는다 · 대기열·쉬기 장부',
        [S.status, S.out.gate, S.out.removed, reg.items.map((i) => `${i.id}:${i.v || ''}`), JSON.parse(S.read('collector/pending-forms.json')).items.map((i) => i.id), held.items.map((i) => `${i.id}:${i.reverts}`).sort()],
        [0, 'reverted-auto', '2', ['old:2'], ['old'], ['n1:1', 'n9:1']]);
      eq('  ㉣ 리포트의 \'N건 등록\' 줄에 되돌림 표시 + 사람이 읽을 단락 (이슈 본문에도 그대로 간다)',
        [/— 2건 등록 시도 · ↩ 데이터 관문에 걸려 되돌림/.test(rep), /새 자동 등록 2건을 되돌렸습니다/.test(rep), rep.indexOf('되돌렸습니다') > rep.indexOf('### 🤖')], [true, true, true]);
      eq('  저장 형식은 로봇과 같다 (JSON.stringify(x, null, 1) + 끝 개행)', S.read('data/registered.json'), J(reg));
      S.done();
    }
    /* ㉣ 제목이 둘인 리포트 — 게시판 수집 단계가 잘리면 리포트에 지난 실행의 제목이 남고 자동 등록이 이번 제목을 끝에 덧붙인다.
       고치는 것은 **마지막**(이번 실행) 제목 하나 — 지난 실행의 'N건 등록'을 되돌림이라 하지 않는다(리뷰 2026-10-04 재현) */
    {
      const S = scenario({ ...HEAD, 'r.md': '# 리포트\n\n### 🤖 자동 등록 (선조치후보고) — 8건 등록\n\n- 지난 실행\n' },
        { 'data/registered.json': { items: [{ id: 'old', auto: true, v: 1 }, { id: 'n7', auto: true, bad: true }] },
          'r.md': '# 리포트\n\n### 🤖 자동 등록 (선조치후보고) — 8건 등록\n\n- 지난 실행\n\n### 🤖 자동 등록 (선조치후보고) — 1건 등록\n\n- 이번 실행\n' });
      const rep = S.read('r.md');
      eq('  ㉣ 제목이 둘인 리포트(지난 실행 제목이 남음)는 마지막 제목만 \'시도 · 되돌림\' · 단락은 그 아래',
        [S.out.gate, /— 8건 등록\n/.test(rep), /— 8건 등록 시도/.test(rep), /— 1건 등록 시도 · ↩ 데이터 관문에 걸려 되돌림/.test(rep),
          rep.indexOf('새 자동 등록 1건을 되돌렸습니다') > rep.indexOf('— 1건 등록 시도'), rep.indexOf('새 자동 등록 1건을 되돌렸습니다') > rep.indexOf('- 지난 실행')],
        ['reverted-auto', true, false, true, true, true]);
      S.done();
    }
    /* ㉡ 기존 항목 수정이 원인 → 새 자동 등록분을 빼도 빨강 → 정식 등록 파일을 HEAD 바이트로 → 통과(reverted-files) · 쉬기 장부에 안 적는다 */
    {
      const S = scenario(HEAD, { 'data/registered.json': { items: [{ id: 'old', auto: true, v: 2, bad: true }, { id: 'n2', auto: true }] } });
      eq('④ ㉡ 기존 항목 수정이 원인 → 파일을 HEAD 바이트 그대로 되돌려 통과(reverted-files) · 쉬기 장부 없음',
        [S.status, S.out.gate, S.read('data/registered.json') === S.headReg, S.read('collector/auto-held.json')], [0, 'reverted-files', true, null]);
      const rep = S.read('r.md');
      eq('  리포트 단락 — 되돌린 것(새 자동 등록 1건 · 정식 등록)만 말하고 등록 숫자는 시도였다고 · 안 바뀐 양식은 말하지 않는다',
        [/이번 실행의 새 자동 등록 1건과 정식 등록 변경을 저장하지 않았습니다/.test(rep), /자동 등록·승격 숫자는 시도한 것입니다/.test(rep), /양식/.test(rep), /— 2건 등록 시도 · ↩ 데이터 관문에 걸려 되돌림/.test(rep)], [true, true, false, true]);
      S.done();
    }
    /* ㉢ HEAD 자체가 빨강 → 새 자동 등록분을 빼도 빨강(still-failing) · 그래도 exit 0(빨간불은 워크플로 마지막 단계가 낸다) · 걸린 검사를 적는다 ·
       단락은 실제로 되돌린 것(새 자동 등록 1건)만 말한다 — 바이트가 그대로인 정식 등록 파일을 '되돌렸다'고 하지 않는다 */
    {
      const S = scenario({ ...HEAD, 'data/registered.json': { items: [{ id: 'old', auto: true, bad: true }] } },
        { 'data/registered.json': { items: [{ id: 'old', auto: true, bad: true }, { id: 'n3', auto: true }] } });
      const note = S.read('note.md');
      eq('④ ㉢ 직전 판부터 빨강 → still-failing · exit 0 · GITHUB_OUTPUT · 단락에 되돌린 것(새 자동 등록 1건)과 걸린 검사',
        [S.status, S.out.gate, /되돌린 뒤에도 데이터 관문이 빨갛습니다\*\* — 이번 실행의 새 자동 등록 1건을 되돌려도/.test(note), /정식 등록 변경/.test(note), /걸린 검사: 「표본 관문 — bad 항목 old」/.test(note)],
        [0, 'still-failing', true, false, true]);
      S.done();
    }
    /* 되돌릴 것 없이 다시 재니 통과 → flaky (still-failing 이라 하지 않는다) */
    {
      const S = scenario(HEAD, {});
      eq('  되돌릴 것 없이 다시 재니 통과하면 flaky (빨간불·이슈를 내지 않는다 · 리포트의 \'N건 등록\' 줄을 \'시도\'로 고치지 않는다)',
        [S.status, S.out.gate, /— 2건 등록\n/.test(S.read('r.md')), /등록 시도/.test(S.read('r.md'))], [0, 'flaky', true, false]);
      S.done();
    }
    /* GIT_* 가 남은 환경(git 훅 안에서 관문을 돌릴 때)에서도 임시 저장소의 git 이 진짜 저장소를 건드리지 않는다 —
       가짜 GIT_DIR 을 걸고 돌려 그 자리가 비어 있는지 본다(리뷰 2026-10-04 · 지금 그런 훅은 없다) */
    {
      const trap = fs.mkdtempSync(path.join(os.tmpdir(), 'hdj-gitdir-trap-'));
      const had = Object.prototype.hasOwnProperty.call(process.env, 'GIT_DIR');
      const saved = process.env.GIT_DIR;
      process.env.GIT_DIR = path.join(trap, 'repo.git');
      let gate1;
      try {
        const S = scenario(HEAD, { 'data/registered.json': { items: [{ id: 'old', auto: true, v: 1 }, { id: 'n5', auto: true, bad: true }] } });
        gate1 = S.out.gate;
        S.done();
      } finally { if (had) process.env.GIT_DIR = saved; else delete process.env.GIT_DIR; }
      eq('  GIT_DIR 이 걸린 환경에서도 임시 저장소에서만 돈다 (가짜 GIT_DIR 자리가 비어 있다 · 결과는 그대로)', [fs.existsSync(path.join(trap, 'repo.git')), gate1], [false, 'reverted-auto']);
      fs.rmSync(trap, { recursive: true, force: true });
    }
    /* ㉥ 소식 로봇 단계(collect-news.yml 과 같은 꼴) — 단락은 실제로 되돌린 소식 파일을 말하고 '정식 등록'·'자동 등록'은 한 글자도 없다(리뷰 — 사실과 반대인 문장) */
    {
      const NEWS_STAGES = ['--stage', 'data/news,collector/seen-news.json,collector/news-thumbs.json', '--stage', 'collector/news-sources.json'];
      const NH = { 'data/news/k.json': { school: '경희대학교', items: [{ id: 'p1' }] }, 'collector/seen-news.json': { seen: ['p1'] },
        'collector/news-sources.json': { sources: [{ id: 's1', school: '경희대학교' }] }, 'r.md': '# 교내 소식 수집 리포트\n\n- 새 글 2건\n' };
      const noScholar = (t) => !/정식 등록|자동 등록|등록·승격|실시간 피드/.test(t || '');
      /* 새 글이 원인 → 소식 발행분·장부를 되돌려 통과 · 새로 생긴 학교 파일·사진 장부는 지운다 · 출처 목록 개선은 남는다 */
      const A = scenario(NH, { 'data/news/k.json': { school: '경희대학교', items: [{ id: 'p1' }, { id: 'p2', bad: true }] }, 'data/news/s.json': { items: [{ id: 'p3' }] },
        'collector/seen-news.json': { seen: ['p1', 'p2', 'p3'] }, 'collector/news-thumbs.json': { posts: {} }, 'collector/news-sources.json': { sources: [{ id: 's1', school: '경희대학교', rows: 9 }] } },
      { stages: NEWS_STAGES });
      const ra = A.read('r.md');
      eq('④ ㉥ 소식 단계 — 새 글이 원인 → 소식 발행분·장부만 되돌려 통과 · 새 파일 지움 · 출처 개선은 남는다 · 단락은 소식만 말한다',
        [A.status, A.out.gate, A.read('data/news/s.json'), A.read('collector/news-thumbs.json'), JSON.parse(A.read('collector/news-sources.json')).sources[0].rows,
          noScholar(ra), /교내 소식 발행분·소식 장부·소식 사진 장부 변경을 저장하지 않았습니다/.test(ra), /「우리 학교 소식」은 이번 실행에 갱신되지 않습니다/.test(ra), /소식 출처 목록/.test(ra)],
        [0, 'reverted-files', null, null, 9, true, true, true, false]);
      A.done();
      /* 출처 목록이 원인 → 발행분을 되돌려도 빨강 → 출처 목록까지 되돌려 통과 · 단락이 출처 목록도 말한다 */
      const B = scenario(NH, { 'data/news/k.json': { school: '경희대학교', items: [{ id: 'p1' }, { id: 'p2' }] }, 'collector/news-sources.json': { sources: [{ id: 's1', school: '경희대학교', bad: true }] } },
        { stages: NEWS_STAGES });
      const rb = B.read('note.md');
      eq('  출처 목록이 원인 → 발행분 다음 출처 목록까지 되돌려 통과 · 단락에 출처 목록 · 정식 등록 낱말 없음',
        [B.out.gate, B.read('collector/news-sources.json') === J(NH['collector/news-sources.json']), /교내 소식 발행분·소식 출처 목록 변경을 저장하지 않았습니다/.test(rb), /게시판 주소도 저장하지 않았습니다/.test(rb), noScholar(rb)],
        ['reverted-files', true, true, true, true]);
      B.done();
      /* 직전 판부터 빨강 · 이번 실행이 소식 파일을 안 바꿨다 → still-failing · '되돌린 뒤에도'가 아니라 '바뀌지 않았는데도' */
      const C = scenario({ ...NH, 'data/news/k.json': { items: [{ id: 'p1', bad: true }] } }, {}, { stages: NEWS_STAGES });
      const rc = C.read('note.md');
      eq('  직전 판부터 빨강 · 바뀐 소식 파일 없음 → still-failing · 되돌릴 수 있던 것을 말하고 \'되돌린 뒤에도\'라 하지 않는다 · 정식 등록 낱말 없음',
        [C.out.gate, /되돌릴 수 있는 것\(교내 소식 발행분·소식 장부·소식 사진 장부·소식 출처 목록\)이 이번 실행에 바뀌지 않았는데도/.test(rc), /되돌린 뒤에도/.test(rc), noScholar(rc)],
        ['still-failing', true, false, true]);
      C.done();
    }
    /* ㉤ 쉬기 장부 — 두 번 걸리면 마지막 날부터 3일 쉰다 · 정식 등록되면 지운다 */
    {
      const H = await import(new URL('collector/auto-held.mjs', root));
      let L = H.recordReverts(null, ['x'], '2026-10-01');
      const once = H.isHeld(L, 'x', '2026-10-01');
      L = H.recordReverts(L, ['x'], '2026-10-02');
      eq('④ ㉤ 쉬기 장부 — 한 번은 안 쉼 · 두 번이면 그날~2일 뒤 쉼 · 3일·4일 뒤 다시 봄 · 등록되면 지움',
        [once, H.isHeld(L, 'x', '2026-10-02'), H.isHeld(L, 'x', '2026-10-04'), H.isHeld(L, 'x', '2026-10-05'), H.isHeld(L, 'x', '2026-10-06'), H.pruneRegistered(L, new Set(['x'])).ledger.items.length],
        [false, true, true, false, false, 0]);
      /* 끝내 등록되지 않는 공고(마감 지남·사람이 막음)가 영영 남지 않게 — 마지막으로 걸린 지 30일 넘은 줄은 지운다(리뷰 2026-10-04) */
      const old = { items: [{ id: 'a', reverts: 2, lastAt: '2026-09-01' }, { id: 'b', reverts: 2, lastAt: '2026-09-02' }, { id: 'c', reverts: 1, lastAt: '2026-10-01' }] };
      const pr = H.pruneRegistered(old, new Set(['c']), '2026-10-02');
      eq('  쉬기 장부 — 정식 등록된 줄과 30일 넘게 지난 줄을 지운다(30일째는 남김) · 날짜를 안 주면 지난 줄은 그대로',
        [pr.ledger.items.map((x) => x.id), pr.removed, pr.stale, H.pruneRegistered(old, new Set()).ledger.items.length], [['b'], 2, 1, 3]);
    }
    /* 워크플로 배선 (주석 걷고) */
    const wfText = (f) => stripYamlComments(fs.readFileSync(new URL(`.github/workflows/${f}`, root), 'utf8'));
    const steps = (t) => t.split(/\n(?= {6}- )/);
    const stepWith = (t, re) => steps(t).find((s) => re.test(s)) || '';
    const lastStepExit = (f) => {
      const t = wfText(f);
      const st = stepWith(t, /steps\.guard\.outputs\.gate == 'still-failing'/);
      const fail = t.indexOf("failure() || cancelled()");
      return !!st && /exit 1\s*$/.test(st.trimEnd()) && !/continue-on-error/.test(st) && fail > 0 && t.indexOf(st) > fail;
    };
    eq('④ 장학·브라우저 수집 — gate-guard 로 되돌리고(리포트 단락) · 끝내 빨가면 실패 알림 뒤에서 exit 1',
      ['collect-scholarships.yml', 'browser-collect.yml'].map((f) => [/node collector\/gate-guard\.mjs --report collector\/(browser-)?report\.md/.test(wfText(f)), /id: guard/.test(stepWith(wfText(f), /gate-guard\.mjs/)), lastStepExit(f), /git add collector\/auto-held\.json/.test(wfText(f))]),
      [[true, true, true, true], [true, true, true, true]]);
    {
      const lh = wfText('link-hunter.yml');
      const st = steps(lh).filter((s) => /steps\.audit\.outcome == 'failure'/.test(s) && /exit 1\s*$/.test(s.trimEnd()) && !/continue-on-error/.test(s));
      const cn = wfText('collect-news.yml');
      eq('④ 링크 사냥꾼 — 감사에 걸려 결과를 버리면 빨간불(continue-on-error 없는 exit 1) · 소식 로봇 — gate-guard + 끝내 빨가면 exit 1',
        [st.length >= 1, /node collector\/gate-guard\.mjs --report collector\/news-report\.md (--note \S+ )?--stage data\/news,/.test(cn), lastStepExit('collect-news.yml')], [true, true, true]);
    }
    const ar = stripComments(fs.readFileSync(new URL('collector/auto-register.mjs', root), 'utf8'));
    eq('④ 자동 등록이 쉬기 장부를 불러 쓴다 (isHeld · pruneRegistered — 베끼지 않는다)',
      /import \{ isHeld, pruneRegistered \} from '\.\/auto-held\.mjs'/.test(ar), true);
    /* 자동 등록을 사본 저장소에서 **진짜로** 돌린다(불러오는 순간 실행되는 파일이라 import 하지 않는다 — test-collector 의 사본 꼴).
       같은 공고가 장부에 두 번 걸려 있으면 등록하지 않고 컨펌 대기에 이유를 남긴다 · 장부가 없으면(대조군) 등록한다 */
    {
      const runAreg = (ledger) => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hdj-gate-areg-'));
        for (const d of ['collector', 'verify', 'data']) fs.mkdirSync(path.join(dir, d), { recursive: true });
        for (const f of fs.readdirSync(fileURLToPath(root))) if (f.endsWith('.js')) fs.copyFileSync(fileURLToPath(new URL(f, root)), path.join(dir, f));
        for (const f of fs.readdirSync(fileURLToPath(new URL('collector/', root)))) if (f.endsWith('.mjs')) fs.copyFileSync(fileURLToPath(new URL(`collector/${f}`, root)), path.join(dir, 'collector', f));
        for (const f of fs.readdirSync(fileURLToPath(new URL('verify/', root)))) if (f.endsWith('.cjs')) fs.copyFileSync(fileURLToPath(new URL(`verify/${f}`, root)), path.join(dir, 'verify', f));
        const w = (rel, body) => fs.writeFileSync(path.join(dir, rel), typeof body === 'string' ? body : J(body));
        w('collector/auto-register-config.json', { enabled: true, schools: [], maxPerRun: 8, blockIds: [], blockUrls: [] });
        w('data/notices.json', { items: [{ title: '2026학년도 2학기 표본재단 장학생 선발 안내', url: 'https://example.ac.kr/bbs/view.do?seq=777', school: '경희대학교', campus: '', foundAt: '2026-10-04' }] });
        w('data/registered.json', { items: [] }); w('data/forms.json', { templates: {} }); w('collector/report.md', '');
        if (ledger) w('collector/auto-held.json', ledger(dir));
        const r = spawnSync(process.execPath, [path.join(dir, 'collector/auto-register.mjs')], { cwd: dir, encoding: 'utf8', env: cleanEnv() });
        const res = { status: r.status, ids: JSON.parse(fs.readFileSync(path.join(dir, 'data/registered.json'), 'utf8')).items.map((i) => i.id),
          report: fs.readFileSync(path.join(dir, 'collector/report.md'), 'utf8'),
          ledger: fs.existsSync(path.join(dir, 'collector/auto-held.json')) ? JSON.parse(fs.readFileSync(path.join(dir, 'collector/auto-held.json'), 'utf8')) : null };
        fs.rmSync(dir, { recursive: true, force: true });
        return res;
      };
      const free = runAreg(null);
      const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
      const held = runAreg(() => ({ items: [...free.ids.map((id) => ({ id, reverts: 2, lastAt: today })), { id: 'auto-gone', reverts: 2, lastAt: '2020-01-01' }] }));
      const group = held.report.slice(held.report.indexOf('**데이터 관문 쉬기'));
      eq('④ 자동 등록 — 장부 없으면 등록(대조군) · 두 번 걸린 공고는 등록하지 않고 \'데이터 관문 쉬기\' 묶음에 이유를 남긴다(신호가 약하다는 묶음이 아니다) · 30일 넘은 장부 줄은 지운다',
        [free.status, free.ids.length, held.status, held.ids, /\*\*데이터 관문 쉬기 1건\*\*/.test(held.report), /데이터 관문에 2번 걸려 되돌린 공고 — 3일 쉬었다 다시 봅니다/.test(group),
          /함께 들어온 다른 공고 때문에 같이 되돌려졌을 수도/.test(group), /자동 기준 미달/.test(held.report), (held.ledger.items || []).map((x) => x.id)],
        [0, 1, 0, [], true, true, true, false, free.ids]);
    }
    eq('  옛 이름(revert-auto)은 gate-guard 의 auto 단계만 부르는 얇은 입구다 (로직 사본 없음)',
      /import \{ main \} from '\.\/gate-guard\.mjs'/.test(fs.readFileSync(new URL('collector/revert-auto.mjs', root), 'utf8')) && !/knownIds|execSync/.test(stripComments(fs.readFileSync(new URL('collector/revert-auto.mjs', root), 'utf8'))), true);
  }

  /* ── ⑤ 알림이 제 리포트로 간다 ── */
  {
    const wf = (f) => stripYamlComments(fs.readFileSync(new URL(`.github/workflows/${f}`, root), 'utf8'));
    /* 셋만 보다가 심층 수집(deep-fetch.yml)의 실패 알림이 그대로 남았다(리뷰 2026-10-04) → 워크플로 **전부**를 본다 */
    const allWf = fs.readdirSync(fileURLToPath(new URL('.github/workflows/', root))).filter((f) => /\.ya?ml$/.test(f));
    eq('⑤ 어느 워크플로에도 맨 \'"수집 리포트" in:title\' 검색이 없다 (부분 일치라 다른 로봇의 리포트 이슈를 집는다 · 워크플로 전부)',
      [allWf.length > 10, allWf.filter((f) => /["']"수집 리포트" in:title["']/.test(wf(f)))], [true, []]);
    eq('  심층 수집 실패 알림은 장학공고 리포트로 (양식 원본은 정식 등록 쪽 일)', /'"장학공고 수집 리포트" in:title'/.test(wf('deep-fetch.yml')), true);
    const cs = wf('collect-scholarships.yml');
    const auditAlert = cs.split(/\n(?= {6}- )/).find((s) => /name: 🚨 데이터 감사 실패 알림/.test(s)) || '';
    const zero = cs.split(/\n(?= {6}- )/).find((s) => /name: 0건 실행 알림/.test(s)) || '';
    eq('  장학 감사 실패 알림은 제 리포트 · 로봇 이름 · 무엇을 되돌렸는지는 gate-guard 단락(문구 사본 없음) / 0건 알림은 관문 결과로 가른다',
      [/'"장학공고 수집 리포트" in:title'/.test(auditAlert), /🤖 장학공고 수집 로봇:/.test(auditAlert), /cat \/tmp\/gate-note\.md/.test(auditAlert) && !/저장하지 않았습니다/.test(auditAlert), /steps\.audit\.outcome/.test(zero)], [true, true, true, true]);
    eq('  0건 알림 — 다시 재니 통과(flaky)를 빨간불이라 하지 않고 결과 이름(영문)을 그대로 적지 않는다',
      [/flaky\)\s+gate="데이터 관문은 처음에 빨갛다가 다시 재니 통과/.test(zero), /되돌림: \$\{\{ steps\.guard\.outputs\.gate \}\}/.test(zero)], [true, false]);
    /* 끝내 빨간불 이슈는 열린 같은 이슈에 코멘트 — 원인이 기존 데이터면 실행마다(하루 최대 5번) 새 이슈가 쌓였다(리뷰) */
    const dedupe = (f) => {
      const st = wf(f).split(/\n(?= {6}- )/).find((x) => /steps\.guard\.outputs\.gate == 'still-failing'/.test(x)) || '';
      return /--search '"데이터 관문이 되돌린 뒤에도 빨간불" in:title' --state open/.test(st) && /gh issue comment "\$open"/.test(st) && st.indexOf('gh issue comment') < st.indexOf('gh issue create');
    };
    eq('  끝내 빨간불 이슈 — 열린 같은 이슈가 있으면 코멘트 (장학·브라우저)', [dedupe('collect-scholarships.yml'), dedupe('browser-collect.yml')], [true, true]);
    const cn = wf('collect-news.yml');
    const newsIssue = cn.split(/\n(?= {6}- )/).find((x) => /name: 🚨 데이터 감사 실패 알림/.test(x)) || '';
    eq('  소식 감사 실패 이슈 — 제목은 결과로 가르고(flaky 는 \'되돌린 것 없음\') · 본문은 gate-guard 단락 · 열린 같은 이슈엔 코멘트(공용 tools/alert-issue.mjs — 제목 앞글자로 찾아 날짜 붙은 옛 이슈도) · 되돌리기 단계가 단락을 남긴다',
      [/flaky\)\s+result="다시 재니 통과\(되돌린 것 없음\)"/.test(newsIssue), /이번 발행분을 되돌렸습니다/.test(newsIssue), /cat \/tmp\/gate-note\.md/.test(newsIssue),
        /node tools\/alert-issue\.mjs --mode open --match prefix/.test(newsIssue) && /--title "🚨 교내 소식 데이터 감사 실패"/.test(newsIssue), /gate-guard\.mjs --report collector\/news-report\.md --note \/tmp\/gate-note\.md/.test(cn)],
      [true, false, true, true, true]);
    const bc = wf('browser-collect.yml');
    /* 2026-10-05 browser 묶음 B4 — 셋째 알림(여러 번 연속 공고를 못 읽은 학교 · 0건 날)도 같은 제 리포트 이슈로 */
    eq('  브라우저 알림 셋(감사 실패·실패/시간초과·연속으로 못 읽은 학교)은 브라우저형 리포트로', (bc.match(/'"브라우저형 수집 리포트" in:title'/g) || []).length, 3);
    eq('  사냥꾼은 장학공고 리포트로 (제 리포트 이슈가 없다)', /'"장학공고 수집 리포트" in:title'/.test(wf('link-hunter.yml')), true);
  }

  /* ── ⑥ 양식 대기열 고아 ── */
  {
    const PQ = await import(new URL('collector/pending-queue.mjs', root));
    const q = { items: [{ id: 'a', fetched: true, tries: 2 }, { id: 'b', retired: true }, { id: 'c' }] };
    const r = PQ.pruneOrphans(q, new Set(['a']));
    eq('⑥ 정식 등록에 없는 대기 항목을 뺀다 — 남는 항목 칸은 그대로 · 원본 큐는 안 바꾼다',
      [r.kept, r.dropped.map((x) => x.id), q.items.length], [[{ id: 'a', fetched: true, tries: 2 }], ['b', 'c'], 3]);
    const sf = stripComments(fs.readFileSync(new URL('collector/schematize-forms.mjs', root), 'utf8'));
    const iCall = sf.indexOf('pruneOrphans(queue');
    eq('  스키마화 로봇이 pending-queue 를 불러 \'스키마화할 항목 없음\' 조기 종료보다 앞에서 정리한다',
      [/import \{ pruneOrphans \} from '\.\/pending-queue\.mjs'/.test(sf), iCall > 0 && iCall < sf.indexOf("log('스키마화할 항목 없음')")], [true, true]);
    eq('  되돌리기(gate-guard)도 같은 함수로 대기열을 정리한다', /import \{ pruneOrphans \} from '\.\/pending-queue\.mjs'/.test(fs.readFileSync(new URL('collector/gate-guard.mjs', root), 'utf8')), true);
  }
}

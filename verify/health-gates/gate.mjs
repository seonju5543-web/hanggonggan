/* 「로봇·도구 점검 관문」 gate 묶음 — 데이터 관문 · 되돌리기 구조 (2026-10-04 대대적 점검)
   잰다:
     ① 학사·석사 나란히 적은 줄 — DAAD `… 학사 및 석사과정 학생` 이 학부생에게 '지원 자격 미달'로 보였다(틀린 미달).
        고치면서 'both' 갈래에 남는 글자 잣대를 같이 넣었다(안 넣으면 독일어 요건을 묻지도 않고 95% = 틀린 안심).
     ② 관리자 저장 = 로봇 관문 — 관리자 저장 관문(admin-apply.yml)은 감사(audit-data) 하나만 돌려, test-collector 만 아는 규칙
        (활동 출처 근거 10자 · 소식 출처 학교당 하나 · 화면 문구 끝 날짜 = 마감)을 어긴 저장이 통과하고 **다음 로봇 실행의 데이터 관문이
        빨개졌다**. 규칙을 감사가 쓰는 한 곳(verify/source-rules.cjs · entry-rules checkEntry)으로 옮기고 저장소가 저장 전에 같은 함수로 거절한다.
     ③ 실데이터 단정 톱니 — test-collector 가 실데이터를 읽어 단정하면 로봇이 데이터를 바꾸는 순간 관문이 빨개진다(10-01·10-04 사고).
        읽는 곳 수를 파일별로 세어 늘면 빨간불 · 저장 전 관문이 없던 등록금·학과 갱신 로봇에 관문 · 등록금 표본.
   🔴 표본(고정 예시)만 잰다 — data/·collector/ 장부를 읽어 단정하지 말 것(verify/health-gates.mjs 머리말). */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

/* 주석을 걷어낸 소스 — 주석에 남은 글자로 관문이 통과하지 않게 */
export const stripComments = (s) => String(s).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
export const stripYamlComments = (s) => String(s).replace(/^\s*#.*$/gm, '');

/* test-collector 소스에서 **실데이터를 읽는 곳**을 파일별로 센다 — `new URL('../data/…')`·`require('../data/…')`·
   `createRequire(…)('../data/…')` 와 로봇·관리자가 쓰는 설정·장부 json. 임시 폴더 표본(path.join(dir, 'data/…'))은 세지 않는다. */
const CFG_FILES = 'news-sources|activity-sources|external-sources|schools|own-programs|pending-forms|news-config|activity-config';
export function realDataReads(src) {
  const re = new RegExp(String.raw`(?:new URL|req(?:uire)?|\))\(\s*['\x60](?:\.\./)?(data/[^'\x60]*|collector/(?:${CFG_FILES})\.json)['\x60]`, 'g');
  const n = {};
  for (const m of stripComments(src).matchAll(re)) n[m[1]] = (n[m[1]] || 0) + 1;
  return n;
}
/* 허용 개수(2026-10-04 1단계 정리 뒤 실측). 🔴 늘리지 말 것 — 실데이터의 항목 불변식은 verify/audit-data.js(entry-rules·source-rules)로,
   개수·'있어야 한다'는 표본 단정 + `ℹ` 숫자 보이기로. 줄었으면 이 표도 줄인다(다음 점검에서 남은 것을 줄인다). */
export const REAL_READ_ALLOW = {
  'data/registered.json': 11, 'data/forms.json': 3, 'data/activities.json': 3, 'data/external.json': 2,
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
        { cwd: dir, encoding: 'utf8', env: { ...process.env, ACTION: act, ACTOR: 'gate', PAYLOAD: JSON.stringify(pay) } });
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
    eq('  감사가 출처 규칙(source-rules)을 오류로 · 마감일 감사 도구는 lastDateIn 을 불러 쓴다 · 찾기 로봇 문턱도 같은 파일',
      [/SR\.activitySourceProblems\(/.test(stripComments(fs.readFileSync(new URL('verify/audit-data.js', root), 'utf8'))),
        /SR\.newsSourceProblems\(/.test(stripComments(fs.readFileSync(new URL('verify/audit-data.js', root), 'utf8'))),
        /const \{ lastDateIn \} = require\('\.\/entry-rules\.cjs'\)/.test(fs.readFileSync(new URL('verify/deadline-audit.mjs', root), 'utf8')),
        /MIN_ROWS = SOURCE_RULES\.NEWS_MIN_ROWS/.test(fs.readFileSync(new URL('collector/find-news-boards.mjs', root), 'utf8'))],
      [true, true, true, true]);

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
    eq('  톱니가 헛돌지 않는다 — 표본 한 줄을 더하면 센다', realDataReads(`${tc}\nJSON.parse(readText(new URL('../data/registered.json', import.meta.url)));`)['data/registered.json'], (now['data/registered.json'] || 0) + 1);
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
}

/* 「로봇·도구 점검 관문」 — ci 묶음: 화면 검사(verify-ui.yml) 그물이 데이터 탓으로 걷히지 않는가 (2026-10-04)
   사고: 10-03~10-04 verify-ui 가 연속 빨간불(이슈 #383 → #389·#390). 원인 둘이 겹쳤다 —
     ① verify-registered.js 가 '이 학생에게 보이는 마감 전 양식 공고'를 실데이터에서 못 찾으면 실패했다(데이터 탓 빨간불).
     ② 화면 검사 단계가 `set -e` + 맨몸 `node` 라 그 하나가 넘어지면 뒤 드라이버 22개와 아래 단계 셋(말투·토큰 · 수집기 규칙 · 전 여정)이
        통째로 안 돌았다 — 그 사이 들어온 토큰 위반(ui-tone 천장 75→76)이 CI 에 한 번도 안 보였다.
   잰다:
     ① 양식 표본 — 표본을 언제·무엇으로 심는가(verify/open-form-sample.cjs · 드라이버와 같은 함수) + 드라이버 배선
     ② 화면 검사 워크플로 — 한 곳이 넘어져도 그물이 남는다(실패를 모아 끝에 한 번 · 뒤 단계 !cancelled() · 경보는 failure() 그대로)
     ③ 작업 브랜치 배포(device-deploy.yml) 뒤 화면 검사를 깨운다
     ④ 양식을 고친 그날 '종류를 모르는 자기소개서 칸'을 데이터 감사가 경고한다(verify/essay-unknown-fields.cjs · 주간 검사와 같은 함수 · 경고만)
        (점검 명세는 양식 로봇 리포트에 붙이라 했지만, 그 로봇은 칸에 kind 를 달지 않아 영영 안 울린다 — 'story' 는 세션이 단다.
         09-29 에 주간 로봇을 멈춘 칸도 세션이 손으로 옮긴 양식(09-24 f4438304)이었다. 그래서 세션이 반드시 돌리는 감사에 건다.)
   🔴 표본(고정 예시)만 쓴다 — data/ 를 읽지 않는다. 워크플로·코드 파일은 코드라 글자로 대조한다. */
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { shouldPlantSample, openFormSample } = require('../open-form-sample.cjs');
const { unknownStoryFields } = require('../essay-unknown-fields.cjs');

/* 워크플로 단계 읽기 — `      - ` 로 시작하는 단계마다 name·id·if·run·continue-on-error 와 원문(raw).
   YAML 해석기를 들이지 않는다(수집 로봇도 이 관문을 돌리는데 npm 설치가 없다). 이 저장소 워크플로의 꼴만 안다:
   단계 칸은 8칸 들여쓰기, 여러 줄 값(`|` · `>`)은 그보다 더 들여 쓴 줄들. */
export function stepsOf(yml) {
  const lines = String(yml).replace(/\r/g, '').split('\n');
  const steps = [];
  let i = 0;
  while (i < lines.length) {
    const m = /^ {6}- (.*)$/.exec(lines[i]);
    if (!m) { i += 1; continue; }
    const chunk = [`        ${m[1]}`];
    i += 1;
    while (i < lines.length && !/^ {6}- /.test(lines[i])
      && (lines[i].trim() === '' || /^ {8,}\S/.test(lines[i]) || /^\s*#/.test(lines[i]))) { chunk.push(lines[i]); i += 1; }
    const st = { raw: chunk.join('\n') };
    for (let j = 0; j < chunk.length; j += 1) {
      const km = /^ {8}([A-Za-z_-]+):(?:\s(.*))?$/.exec(chunk[j]);
      if (!km) continue;
      const key = km[1];
      const rest = (km[2] || '').trim();
      if (/^[|>][-+]?$/.test(rest)) {
        const body = [];
        while (j + 1 < chunk.length && (chunk[j + 1].trim() === '' || /^ {9,}/.test(chunk[j + 1]))) { j += 1; body.push(chunk[j].replace(/^ {10}/, '')); }
        st[key] = rest[0] === '>' ? body.map((s) => s.trim()).filter(Boolean).join(' ') : body.join('\n').replace(/\n+$/, '');
      } else st[key] = rest;
    }
    steps.push(st);
  }
  return steps;
}

const read = (root, rel) => fs.readFileSync(new URL(rel, root), 'utf8');

export default async function gate(eq, ctx) {
  const root = ctx.root;

  /* ── ① 화면 검사 — 양식 표본 (표본만 쓴다) ── */
  eq('① 보이는 양식 공고가 아예 없으면 표본을 심는다 (10-04 #390 — 예전 조건 `ids.length && …` 로는 false)', shouldPlantSample([], []), true);
  eq('  시도한 후보가 전부 「신청 버튼 잠김」(마감)이면 표본', shouldPlantSample(['a'], ['a(신청 버튼 잠김)']), true);
  eq('  잠김 말고 다른 이유로 실패한 후보가 하나라도 있으면 표본을 쓰지 않는다(진짜 고장을 덮지 않는다)',
    shouldPlantSample(['a', 'b'], ['a(신청 버튼 잠김)', 'b(문서가 비었다)']), false);
  const LIST = [
    { id: 'hufs-only', formId: 'f1', deadline: '2026-09-30', eligibility: { schoolOnly: '한국외국어대학교', campusOnly: '서울', schoolsAny: ['x'], minGpa: 3 } },
    { id: 'no-tpl', formId: 'missing' },
    { id: 'plain', name: 'p', eligibility: {} },
  ];
  const pick = openFormSample(LIST, ['f1'], [], '2026-10-04');
  eq('  화면에 안 보여도 양식이 있는 실제 등록 항목을 고른다(어느 학교든)', pick && pick.from, 'hufs-only');
  eq('  표본: id · 마감 오늘+20일 · 등록일 오늘(60일 규칙에 안 걸리게) · 양식 그대로',
    pick && [pick.copy.id, pick.copy.deadline, pick.copy.listedAt, pick.copy.formId], ['gate-open-form', '2026-10-24', '2026-10-04', 'f1']);
  eq('  학교 범위 칸 셋만 지우고 다른 자격 칸은 그대로',
    pick && [['schoolOnly', 'campusOnly', 'schoolsAny'].some((k) => k in pick.copy.eligibility), pick.copy.eligibility.minGpa], [false, 3]);
  eq('  원본은 바꾸지 않는다(깊은 복사)', [LIST[0].eligibility.schoolOnly, LIST[0].id, LIST[0].deadline], ['한국외국어대학교', 'hufs-only', '2026-09-30']);
  eq('  달·해가 바뀌어도 날짜가 맞다', (openFormSample(LIST, ['f1'], [], '2026-12-20') || {}).copy?.deadline, '2027-01-09');
  eq('  화면에 보인 후보가 있으면 그것을 먼저',
    (openFormSample([...LIST, { id: 'vis', formId: 'f1' }], ['f1'], ['vis'], '2026-10-04') || {}).from, 'vis');
  const builtin = openFormSample([{ id: 'plain', eligibility: { schoolOnly: 'A' } }], ['jobyungdu-apply'], [], '2026-10-04');
  eq('  등록 목록에 양식 공고가 하나도 없으면 앱 내장 양식을 실제 항목에 붙인다(데이터에 기대지 않는다)',
    builtin && [builtin.from, builtin.copy.formId, 'schoolOnly' in builtin.copy.eligibility], ['plain', 'jobyungdu-apply', false]);
  eq('  쓸 양식이 하나도 없으면 null — 빨간불로 남긴다', openFormSample(LIST, [], [], '2026-10-04'), null);

  const drv = read(root, 'verify/verify-registered.js');
  eq('  드라이버가 같은 함수를 불러 쓴다(베끼지 않는다) · 후보 0장에서 빠져나가는 이른 반환이 없다',
    [/require\('\.\/open-form-sample\.cjs'\)/.test(drv), /shouldPlantSample\(/.test(drv), /openFormSample\(/.test(drv),
      /if \(!ids\.length\) return/.test(drv), /delete copy\.eligibility|864e5/.test(drv)],
    [true, true, true, false, false]);

  /* ── ② 화면 검사 워크플로 — 한 곳이 넘어져도 그물이 남는다 ── */
  const SAMPLE = [
    'jobs:', '  x:', '    steps:',
    '      - uses: actions/checkout@v4',
    '      # 사이 주석',
    '      - name: 둘째',
    '        id: two',
    '        if: ${{ !cancelled() }}',
    '        run: node a.js',
    '      - name: 셋째',
    '        if: >',
    '          failure() ||',
    '          cancelled()',
    '        env: { A: \'1\' }',
    '        run: |',
    '          echo 1',
    '          echo 2',
    '', '  y:', '    runs-on: z',
  ].join('\n');
  const ss = stepsOf(SAMPLE);
  eq('② (해석기 자체 점검) 단계 셋 · 이름 · if · 여러 줄 run · 접힌 if',
    [ss.length, ss[1].name, ss[1].id, ss[1].if, ss[1].run, ss[2].if, ss[2].run, ss[0].uses],
    [3, '둘째', 'two', '${{ !cancelled() }}', 'node a.js', 'failure() || cancelled()', 'echo 1\necho 2', 'actions/checkout@v4']);

  const ui = read(root, '.github/workflows/verify-ui.yml');
  const steps = stepsOf(ui);
  const by = (name) => steps.find((s) => s.name === name) || {};
  const drivers = by('화면 검사 (관문)');
  const runLines = String(drivers.run || '').split('\n');
  const nodeLines = runLines.filter((l) => l.includes('node "verify/$f"'));
  eq('  verify-ui.yml 의 단계를 읽어 냈다(헛도는 검사가 아니다)', [steps.length > 10, !!drivers.run, nodeLines.length > 0], [true, true, true]);
  eq('  ⓐ 화면 검사 단계에 `set -e` 가 없다', runLines.some((l) => /^\s*set -e\s*$/.test(l)), false);
  eq('  ⓑ 드라이버 실패를 `||` 로 받아 모은다(기본 셸이 bash -e 라 이게 없으면 첫 실패에서 멈춘다)', nodeLines.every((l) => l.includes('||')), true);
  eq('  ⓒ 모은 실패로 마지막에 한 번 빨간불 · 실패 목록을 출력으로 넘긴다',
    [/\bexit 1\b/.test(drivers.run || ''), /failed=.*>>\s*"\$GITHUB_OUTPUT"/.test(drivers.run || ''), drivers.id], [true, true, 'drivers']);
  for (const n of ['말투·토큰 관문', '수집기·관리자 규칙 관문 (브라우저 불필요)', '전 여정 회귀 (drive.js)']) {
    eq(`  ⓓ 「${n}」 은 앞 단계가 실패해도 돈다(!cancelled())`, /!cancelled\(\)|always\(\)/.test(by(n).if || ''), true);
  }
  eq('  ⓓ 전 여정은 서버를 띄웠을 때만', [/steps\.server\.outcome == 'success'/.test(by('전 여정 회귀 (drive.js)').if || ''), by('로컬 서버 띄우기').id], [true, 'server']);
  const alarm = by('🚨 화면 검사가 빨간불이다');
  eq('  ⓔ 경보는 failure() 그대로(cancel-in-progress 취소에 헛경보를 안 낸다)', alarm.if, 'failure()');
  eq('  ⓕ 경보 본문이 옛 설명(`set -e` 로 뒤가 안 돈다)을 하지 않고 실패한 드라이버를 싣는다',
    [/set -e/.test(alarm.run || ''), /steps\.drivers\.outputs\.failed/.test(alarm.raw || ''), /\$\{FAILED/.test(alarm.run || '')], [false, true, true]);

  /* ── ③ 작업 브랜치 배포 뒤 화면 검사를 깨운다 ── */
  const dd = read(root, '.github/workflows/device-deploy.yml');
  const perm = (/^permissions:\n((?: {2}.*\n?)*)/m.exec(dd) || [])[1] || '';
  eq('③ device-deploy 권한에 actions: write(화면 검사를 깨울 열쇠)', /^ {2}actions: write\b/m.test(perm), true);
  const wake = stepsOf(dd).find((s) => /gh workflow run verify-ui\.yml/.test(s.run || ''));
  eq('  배포가 끝났을 때만 깨우고 · 깨우기 실패가 배포를 실패로 보이게 하지 않는다',
    wake ? [/steps\.run\.outputs\.state == 'deployed'/.test(wake.if || ''), wake['continue-on-error'], /--ref claude\/nice-heisenberg-WESq5/.test(wake.run)] : null,
    [true, 'true', true]);
  eq('  verify-ui.yml 이 버튼 실행(workflow_dispatch)을 받는다 — 지우면 깨우기가 조용히 실패한다', /^ {2}workflow_dispatch:/m.test(ui), true);

  /* ── ④ 양식을 고친 그날 모르는 자기소개서 칸을 경고한다 ── */
  const T = { t1: { sections: [{ fields: [
    { id: 'a', type: 'textarea', kind: 'story', label: '성장과정' },
    { id: 'b', type: 'textarea', kind: 'story', label: '특이사항 서술' },
    { id: 'c', type: 'textarea', kind: 'fact', label: '특이사항 서술' },
    { id: 'd', type: 'text', label: '특이사항 서술' },
  ] }] } };
  eq('④ 서술형(story) 칸 가운데 종류를 못 알아본 것만 집는다', unknownStoryFields(T), [{ form: 't1', id: 'b', label: '특이사항 서술' }]);
  eq('  사람이 적어 둔 질문(ask)이 있는 칸은 모르는 칸이 아니다',
    unknownStoryFields({ t: { sections: [{ fields: [{ id: 'x', type: 'textarea', kind: 'story', label: '특이사항 서술', ask: [{ q: 'a' }, { q: 'b' }] }] }] } }), []);
  const audit = read(root, 'verify/audit-data.js');
  const auditBlock = (audit.match(/require\('\.\/essay-unknown-fields\.cjs'\)[\s\S]*?\n\}/) || [''])[0];
  eq('  데이터 감사가 같은 함수로 양식 전부를 보고 **경고**로 적는다(오류면 그날 자동 등록분이 되돌려진다)',
    [/unknownStoryFields\(forms\.templates\)/.test(auditBlock), /warns\.push\([^;]*자기소개서 칸/.test(auditBlock), /errors\.push/.test(auditBlock)],
    [true, true, false]);
  const weekly = read(root, 'verify/verify-essay-ask.mjs');
  eq('  주간 검사(verify-essay-ask)도 같은 함수를 부른다 — 경고와 검사가 갈라지지 않는다',
    [/require\('\.\/essay-unknown-fields\.cjs'\)/.test(weekly), /unknownStoryFields\(T\)/.test(weekly), /essayAskFor\(f\)\.kind === 'generic'/.test(weekly)],
    [true, true, false]);
}

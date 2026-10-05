/* 「로봇·도구 점검 관문」 — refresh 묶음: 데이터 갱신 로봇(학과·등록금·한국장학재단·정문 사진·작성 규칙)이 제 일을 하고, 멈추면 사람이 아는가 (2026-10-05)
   찾은 것:
     ⓐ KOSAF-01 한국장학재단 공고문 사본을 매 실행 전부 다시 받았다 — 첨부 주소 끝 encVal 이 받을 때마다 바뀌는데 주소 전체로 '같은 파일인가'를 쟀다
        (첨부 리포트 네 번 연속 '이미 있던 것 0곳'). 열쇠는 서버 저장 이름(filename · 올린 시각 꼬리 포함) — kosaf-session.mjs attachKey 한 곳.
     ⓑ KOSAF-02 수확 예산 시계가 목록 185쪽(약 2분)을 받은 뒤에 켜져 단계 상한(20분)까지 여유가 3분뿐이었다 · 새 상세를 최악 시간(2분) 없이도 시작했다.
     ⓒ MAJORS-02 학과 로봇이 Actions 에서 열쇠가 없어도 exit 0 이라 '변경 없음' 초록불이었다.
     ⓓ MAJORS-01 연세대 미래캠퍼스(서비스 학교) 학과 파일이 없어 학생이 전국 공통 목록으로 조용히 물러나 있었다 — 커리어넷 이름은 확인 못 함 →
        다음 실행이 증거(원래 이름·캠퍼스 번호·학과 수)를 리포트에 남기고, 서비스 학교가 빠지면 ::warning (관문이 아니다 — 실데이터).
     ⓔ QUEUE-01 학과·등록금 로봇이 수집 대기줄(collector)에 서서 기다리는 예약 수집·관리자 버튼을 취소시킬 수 있었다 · 넘어짐 알림이 없었다 ·
        gaps-06 학과 로봇은 예약이 없어 08-06 뒤로 한 번도 안 돌았다(→ 2·8월 예약 · 달 칸 예약만 있는 워크플로는 수동 성공도 회복으로 센다).
     ⓕ GATE-02 학교 사진 파일 이름(<학교키>-<번호>.jpg)이 다시 받으면 다른 사진이 되는데 빌드가 이름만 봤다 → 고른 기록에 원본 제목을 적고 대조한다.
     ⓖ GATE-01 사진 도구가 불러오기만 해도 위키미디어를 두드렸다 · 한글 제목 40개 묶음이 414(주소 너무 김) · Openverse 401 을 학교마다 다시 물었다.
   🔴 표본(고정 예시)만 잰다 — data/·collector/ 장부는 읽지 않는다(이 점검에서 사고 셋). 코드·워크플로 파일은 코드라 글자로 대조한다.
   🔴 워크플로 글자를 재는 줄(eqWf)은 로봇 워크플로에서 어긋나도 경고만 한다(alerts 묶음과 같은 잣대 softEq) — 로컬·verify-ui(DOC_GATES=1)에서는 실패.
   🔴 kosaf-fetch.mjs·majors.mjs 는 **불러오는 순간 실행된다**(포털·커리어넷을 두드린다) — 글자로 읽거나, 열쇠 없는 새 환경에서 따로 돌려 본다. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { stepsOf } from './ci.mjs';
import { softEq, codeOf, jobsOf, coversDown } from './alerts.mjs';
import { stripComments } from './servers.mjs';
import { cronsOf, successEventFor } from '../../collector/robot-heartbeat.mjs';

const read = (root, rel) => fs.readFileSync(new URL(rel, root), 'utf8').replace(/\r/g, '');
/** 함수 몸통 — `function 이름(` 부터 짝 맞는 `}` 까지 (못 찾으면 '') */
function fnBody(src, head) {
  const at = src.indexOf(head);
  if (at < 0) return '';
  let d = 0;
  for (let j = src.indexOf('{', at); j > 0 && j < src.length; j += 1) {
    if (src[j] === '{') d += 1;
    else if (src[j] === '}' && --d === 0) return src.slice(at, j + 1);
  }
  return '';
}

export default async function gate(eq, ctx) {
  const root = ctx.root;
  const DOC_GATES = ctx.docGates ?? (!process.env.GITHUB_ACTIONS || process.env.DOC_GATES === '1');
  const eqWf = softEq(eq, DOC_GATES);
  if (!DOC_GATES) console.log('  (로봇 워크플로 — 워크플로 글자 관문은 어긋나도 경고만 · verify-ui.yml 과 로컬에서는 실패)');

  /* ── ⓐ KOSAF-01 공고문 사본의 '같은 파일' 열쇠 ── */
  {
    const KS = await import(new URL('collector/kosaf-session.mjs', root));
    const u = (fn, enc) => `https://portal.kosaf.go.kr/FL/downloadServletEcm.do?filename=SS/SL/goods/${encodeURIComponent(fn)}&FileNameDn=x.hwp&path=KOSAF_COMMON&encVal=${enc}`;
    const A = '(재)남구장학회 제30회 장학생 선발 공고_2026091617231400.hwpx';
    eq('ⓐ attachKey — 주소 끝 encVal 만 다르면 같은 파일 · 새 회차(올린 시각 꼬리가 다른 서버 이름)는 다른 파일',
      [KS.attachKey(u(A, 'ce068c')) === KS.attachKey(u(A, '9008d0')), KS.attachKey(u('A_2026100111111100.hwpx', 'aa')) === KS.attachKey(u('A_2026091617231400.hwpx', 'aa'))],
      [true, false]);
    eq('  서버 이름이 없으면 보여 줄 이름(FileNameDn) · 그것도 없으면 encVal 뺀 주소 · 주소가 아니면 원문',
      [KS.attachKey('https://p.kr/d?FileNameDn=x.hwp&encVal=1') === KS.attachKey('https://p.kr/d?FileNameDn=x.hwp&encVal=2'),
        KS.attachKey('https://p.kr/d?a=1&encVal=1') === KS.attachKey('https://p.kr/d?a=1&encVal=2'),
        KS.attachKey('https://p.kr/d?a=1&encVal=1') === KS.attachKey('https://p.kr/d?a=2&encVal=1'), KS.attachKey('주소 아님')],
      [true, true, false, 'r:주소 아님']);
    eq('  mirrorMatches — 옛 장부(from = 주소 전체)도 열쇠로 풀어 같은 파일로 본다 · 다른 파일이면 다시 받는다',
      [KS.mirrorMatches([{ url: u('A', 'bb') }], { from: u('A', 'aa') }), KS.mirrorMatches([{ url: u('B', 'bb') }], { from: u('A', 'aa') })],
      [true, false]);
    eq('  두 파일은 순서와 무관 · key 칸이 있으면 key 로 · 지금 첨부가 없으면 참 · 빈 주소는 뺀다',
      [KS.mirrorMatches([{ url: u('B', 'x') }, { url: u('A', 'y') }], { from: [u('A', '1'), u('B', '2')].join('|') }),
        KS.mirrorMatches([{ url: u('A', 'z') }], { from: '깨진 옛 값', key: KS.filesKey([u('A', 'q')]) }),
        KS.mirrorMatches([{ url: u('A', 'z') }], { from: u('A', 'q'), key: KS.filesKey([u('C', 'q')]) }),
        KS.mirrorMatches([], { from: u('A', 'q') }), KS.filesKey(['', u('A', '1'), null]) === KS.filesKey([u('A', '2')])],
      [true, true, false, true, true]);
    const att = stripComments(read(root, 'collector/kosaf-attach.mjs'));
    const alive = fnBody(att, 'function mirrorAlive(');
    eq('  사본 로봇이 그 함수를 쓴다 — mirrorAlive 가 mirrorMatches 를 부르고 주소 전체 비교(=== (m.from)가 없다 · 장부에 key: filesKey( 를 적는다',
      [/mirrorMatches\(/.test(alive), /===\s*\(m\.from/.test(att), /key:\s*filesKey\(/.test(att)], [true, false, true]);
  }

  /* ── ⓑ KOSAF-02 수확 예산 (kosaf-fetch.mjs 는 불러오는 순간 포털을 두드린다 — 글자로만) ── */
  let detailWorst = 0;
  {
    const src = stripComments(read(root, 'collector/kosaf-fetch.mjs'));
    const mb = src.indexOf('makeBudget(');
    eq('ⓑ 예산 시계를 목록보다 먼저 켠다 (makeBudget( 가 await S.open() 앞)', mb > 0 && mb < src.indexOf('await S.open()'), true);
    const expr = (/const DETAIL_WORST_MS = ([\d\s*+]+);/.exec(src) || [])[1] || '';
    detailWorst = expr ? Function(`return (${expr});`)() : 0;
    const loop = src.slice(src.indexOf('for (const [i, r] of target.entries())'));
    eq('  새 상세는 최악 시간(DETAIL_WORST_MS ≥ 100초 — 30초×3 + 대기 15초)이 남을 때만 시작한다 · 목록 쪽 넘김도 예산이 다 되면 실패로 끝낸다',
      [detailWorst >= 100000, /if \(!budget\.hasRoom\(DETAIL_WORST_MS\)\)/.test(loop.slice(0, 300)),
        /for \(let p = 2; p <= last; p \+= 1\) \{\s*if \(budget\.expired\(\)\) \{[\s\S]{0,200}?process\.exit\(1\)/.test(src)],
      [true, true, true]);
    const wf = read(root, '.github/workflows/kosaf-fetch.yml');
    const st = stepsOf(wf).find((s) => s.name === '한국장학재단 통합검색 수확') || {};
    const tmin = Number(st['timeout-minutes'] || 0);
    const bmin = Number(((/--budget-min=(\d+)/.exec(st.run || '')) || [])[1] || 0);
    eqWf('  kosaf-fetch.yml 수확 단계 상한 > 예산 + 상세 최악 + 저장 1분 (분 단위 · 상한 · 예산)',
      [tmin > 0 && bmin > 0 && tmin * 60000 > bmin * 60000 + detailWorst + 60000, tmin, bmin], [true, tmin, bmin]);
  }

  /* ── ⓒ MAJORS-02 열쇠 없음 = Actions 에서 빨간불 (열쇠 없는 새 환경에서 실제로 돌린다 · process.env 를 펼치지 않는다) ── */
  {
    const cwd = fileURLToPath(root);
    const run = (env) => spawnSync(process.execPath, ['collector/majors.mjs'], { cwd, env: { PATH: process.env.PATH, ...env }, timeout: 20000, encoding: 'utf8' });
    const ci = run({ GITHUB_ACTIONS: 'true' });
    const local = run({});
    eq('ⓒ 학과 로봇 — Actions 에서 CAREERNET_API_KEY 가 없으면 ::error 와 함께 실패(1) · 로컬은 조용히 0',
      [ci.status, /::error::CAREERNET_API_KEY/.test(ci.stderr || ''), local.status], [1, true, 0]);
  }

  /* ── ⓓ MAJORS-01 학과 진단 — 표본만 ── */
  {
    const PM = await import(new URL('collector/publish-majors.mjs', root));
    eq('ⓓ missingServed — 서비스 학교 중 이번에 발행 안 된 학교',
      PM.missingServed(['연세대학교', '경희대학교'], ['연세대학교', '연세대학교 미래캠퍼스', '경희대학교']), ['연세대학교 미래캠퍼스']);
    const unis = new Set(['연세대학교', '연세대학교 미래캠퍼스', '상명대학교', '상명대학교 천안캠퍼스', '경희대학교']);
    const pairs = [{ school: '연세대학교(원주)', campus: '제1캠퍼스', n: 38 }, { school: '상명대학교', campus: '제1캠퍼스', n: 60 },
      { school: '상명대학교', campus: '제2캠퍼스', n: 55 }, { school: '경희대학교', campus: '제2캠퍼스', n: 40 }, { school: '경희대학교', campus: '제1캠퍼스', n: 70 }];
    const sus = PM.campusNameSuspects(pairs, unis);
    eq('  campusNameSuspects — 앱 이름과 안 맞는 분교 후보(연세대학교(원주)) · 분교가 있는 학교의 캠퍼스 번호 둘(상명 두 줄) · 이원화 학교(경희)는 안 낸다',
      [sus.some((l) => l.startsWith('연세대학교(원주) | 제1캠퍼스 | 학과 38')), sus.filter((l) => l.startsWith('상명대학교 |')).length, sus.some((l) => l.startsWith('경희대학교'))],
      [true, 2, false]);
    eq('  로봇의 이름 정리(normalize)를 거쳐 분교로 맞으면 후보가 아니다 · 캠퍼스가 붙은 이름이 본교로 합쳐지면 후보다',
      [PM.campusNameSuspects([{ school: '연세대학교(원주)', campus: '제1캠퍼스', n: 1 }], unis, { normalize: (s) => (s === '연세대학교(원주)' ? '연세대학교 미래캠퍼스' : s) }).length,
        PM.campusNameSuspects([{ school: '연세대학교 원주캠퍼스', campus: '제2캠퍼스', n: 9 }], unis, { normalize: () => '연세대학교' }).length],
      [0, 1]);
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'refresh-majors-'));
    try {
      const pub = PM.publishMajorsBySchool({ '한국과학기술원': ['전산학부'], '없는대학교': ['아무학과'] }, { dir: pathToFileURL(tmp + path.sep), updatedAt: '2026-10-05' });
      eq('  publishMajorsBySchool 이 발행한 앱 이름 목록(published)을 돌려준다 (한국과학기술원 → KAIST · 없는 학교는 빠진다)',
        [pub.published, pub.skipped], [['KAIST'], ['없는대학교']]);
    } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
    const mj = stripComments(read(root, 'collector/majors.mjs'));
    eq('  로봇이 진단을 부르고 리포트를 쓴다 · 앱 학교가 바닥값보다 적으면 저장 전에 멈춘다 (missingServed( · campusNameSuspects( · majors-report.md · MIN_APP_SCHOOLS 가 data/majors.json 쓰기 앞)',
      [/missingServed\(pub\.published, ME\.SERVED_SCHOOLS\)/.test(mj), /campusNameSuspects\(/.test(mj), /majors-report\.md/.test(mj),
        mj.indexOf('appSchools < MIN_APP_SCHOOLS') > 0 && mj.indexOf('appSchools < MIN_APP_SCHOOLS') < mj.indexOf('fs.writeFileSync(OUT_PATH')],
      [true, true, true, true]);
    eqWf('  refresh-majors.yml 이 그 리포트를 커밋한다', /git add[^\n]*collector\/majors-report\.md/.test(codeOf(read(root, '.github/workflows/refresh-majors.yml'))), true);
  }

  /* ── ⓔ QUEUE-01 · gaps-06 갱신 로봇 둘 — 제 대기줄 · 기본 브랜치 끝 · 넘어짐 알림 · 학과는 학기 전 예약 ── */
  {
    const files = ['refresh-majors.yml', 'refresh-tuition.yml'];
    const ys = files.map((f) => read(root, `.github/workflows/${f}`));
    const groups = ys.map((y) => ((/^concurrency:\n\s+group:\s*(\S+)/m.exec(codeOf(y))) || [])[1] || '');
    eqWf('ⓔ 학과·등록금 로봇은 수집 대기줄(collector)이 아닌 제 줄에 선다 (줄 이름 · 서로 다름)',
      [groups.map((g) => g && g !== 'collector'), new Set(groups).size], [[true, true], 2]);
    eqWf('  체크아웃은 기본 브랜치 끝(ref: claude/nice-heisenberg-WESq5)',
      ys.map((y) => ((/- uses: actions\/checkout@v4\n\s+with:\n(?:\s+#[^\n]*\n)*\s+ref: (\S+)/.exec(y)) || [])[1] || ''),
      ['claude/nice-heisenberg-WESq5', 'claude/nice-heisenberg-WESq5']);
    eqWf('  넘어짐 알림(robot-down · failure() || cancelled())이 있고 이슈 권한(issues: write)이 있다',
      ys.map((y) => [jobsOf(y).some((j) => coversDown(stepsOf(j.text))), /^permissions:\n(?:\s+[a-z-]+:\s*\w+\n)*?\s+issues:\s*write/m.test(codeOf(y))]),
      [[true, true], [true, true]]);
    const cr = cronsOf(ys[0]);
    const [mi, , , mon] = (cr[0] || '').split(/\s+/);
    eqWf('  학과 로봇은 학기 전 예약이 하나 있다 — 홀수 분 · 달 칸이 있다(2·8월)',
      [cr.length, Number(mi) % 2 === 1, !!mon && mon !== '*'], [1, true, true]);
    eq('  달 칸 예약만 있는 워크플로는 수동 성공도 회복으로 센다(successEventFor null) · 매일 예약은 예약 성공만(schedule)',
      [successEventFor("on:\n  schedule:\n    - cron: '29 21 19 2,8 *'\n  workflow_dispatch:\n"), successEventFor("on:\n  schedule:\n    - cron: '17 3 * * *'\n  workflow_dispatch:\n")],
      [null, 'schedule']);
  }

  /* ── ⓕ GATE-02 고른 사진의 원본 제목 대조 (build-school-photos.mjs 는 main 가드가 있어 불러도 실행되지 않는다) ── */
  {
    const SP = await import(new URL('tools/build-school-photos.mjs', root));
    eq('ⓕ titleFromPage — 공용 페이지 주소 → 원본 제목 (%3A·밑줄 되돌림)',
      [SP.titleFromPage('https://commons.wikimedia.org/wiki/File%3ASeoulNatlUnivMainGateAtNight.jpg'), SP.titleFromPage('https://commons.wikimedia.org/wiki/File%3AKorea_University_Anam_campus.jpg'), SP.titleFromPage('')],
      ['File:SeoulNatlUnivMainGateAtNight.jpg', 'File:Korea University Anam campus.jpg', '']);
    const files = new Map([['x-1.jpg', { title: 'File:Gate.jpg' }], ['x-2.jpg', { title: 'File:Other.jpg' }]]);
    eq('  pickProblems — 같은 제목이면 문제 없음 · 다른 사진이 됐으면 · 제목이 없으면 · manifest 에 없으면 각 1건',
      [SP.pickProblems({ A: [{ file: 'x-1.jpg', title: 'File:Gate.jpg' }] }, files).length,
        SP.pickProblems({ A: [{ file: 'x-1.jpg', title: 'File:Old.jpg' }] }, files).filter((m) => /다른 사진/.test(m)).length,
        SP.pickProblems({ A: [{ file: 'x-1.jpg' }] }, files).filter((m) => /title/.test(m)).length,
        SP.pickProblems({ A: [{ file: 'x-9.jpg', title: 'File:Gate.jpg' }] }, files).length],
      [0, 1, 1, 1]);
    const prev = [{ id: 'snu', file: 'snu-1.jpg', page: 'https://commons.wikimedia.org/wiki/File%3AA.jpg' }];
    eq('  startScreenChanged — 같은 파일 이름인데 공용 페이지가 바뀌면 1건 · 새로 고른 파일 · 받아들인 학교 · 첫 빌드는 0건',
      [SP.startScreenChanged([{ id: 'snu', name: '서울대학교', file: 'snu-1.jpg', page: 'https://commons.wikimedia.org/wiki/File%3AB.jpg' }], prev).length,
        SP.startScreenChanged([{ id: 'snu', name: '서울대학교', file: 'snu-2.jpg', page: 'https://commons.wikimedia.org/wiki/File%3AB.jpg' }], prev).length,
        SP.startScreenChanged([{ id: 'snu', name: '서울대학교', file: 'snu-1.jpg', page: 'https://commons.wikimedia.org/wiki/File%3AB.jpg' }], prev, new Set(['snu'])).length,
        SP.startScreenChanged([{ id: 'snu', name: '서울대학교', file: 'snu-1.jpg', page: 'x' }], null).length],
      [1, 0, 0, 0]);
    const bsp = stripComments(read(root, 'tools/build-school-photos.mjs'));
    const main = fnBody(bsp, 'async function main(');
    const bag = stripComments(read(root, 'tools/gate-reel/build-app-gates.mjs'));
    eq('  빌드 둘이 대조를 쓴다 — 학교 사진 main 이 pickProblems( 로 거르고 시작 화면 주입에 titleFromPage( · 시작 화면 빌드는 startScreenChanged 로 걸리면 쓰기 전에 멈춘다',
      [/pickProblems\(\{ \[school\]: \[p\] \}, files\)/.test(main), /title: titleFromPage\(g\.page\)/.test(main),
        /import \{ startScreenChanged \} from '\.\.\/build-school-photos\.mjs'/.test(bag),
        bag.indexOf('process.exit(1)') > 0 && bag.indexOf('process.exit(1)') < bag.indexOf('fs.writeFileSync(')],
      [true, true, true, true]);
  }

  /* ── ⓖ GATE-01 사진 수집 도구 — 불러도 실행되지 않는다(가드가 없으면 부르지 않는다 · 위키미디어를 두드리게 된다) ── */
  {
    const src = stripComments(read(root, 'tools/fetch-gate-photos.mjs'));
    const guarded = /\nif \(process\.argv\[1\] && path\.resolve\(process\.argv\[1\]\) === fileURLToPath\(import\.meta\.url\)\) await main\(\);/.test(src)
      && src.indexOf('async function main(') > 0 && src.indexOf('async function main(') < src.indexOf('fs.mkdirSync(OUT');
    eq('ⓖ fetch-gate-photos.mjs 의 실행부가 main() 안에 있고 직접 실행할 때만 돈다 (아니면 아래를 부르지 않는다)', guarded, true);
    if (guarded) {
      const FG = await import(new URL('tools/fetch-gate-photos.mjs', root));
      const long = Array.from({ length: 40 }, (_, i) => `File:2009년 3월 20일 중앙소방학교 FEMP(소방방재전문과정입학식) 입학식${i}.jpg`);
      const lc = FG.titleChunks(long);
      eq('  titleChunks — 한글 긴 제목 40개는 주소 글자 6000 안으로 나뉜다 · 순서 그대로',
        [lc.length > 1, lc.every((c) => encodeURIComponent(c.join('|')).length <= 6000), JSON.stringify(lc.flat()) === JSON.stringify(long)], [true, true, true]);
      const short = Array.from({ length: 100 }, (_, i) => `File:A${i}.jpg`);
      const huge = 'File:' + '가'.repeat(3000) + '.jpg';
      eq('  짧은 제목 100개는 40개씩 · 혼자 넘는 제목은 혼자 한 묶음',
        [FG.titleChunks(short).map((c) => c.length), FG.titleChunks(['File:a.jpg', huge, 'File:b.jpg']).map((c) => c.length)], [[40, 40, 20], [1, 1, 1]]);
      eq('  pickedFilesFor — 다시 받는 학교 중 고른 기록(학교 사진·시작 화면)이 있는 것만',
        FG.pickedFilesFor([{ id: 'snu', name: '서울대학교' }, { id: 'nx', name: '숭실대학교' }, { id: 'ny', name: '없는대학교' }],
          { 숭실대학교: [{ file: 'nx-4.jpg' }] }, ['snu-1.jpg', 'korea-2.jpg']),
        [{ name: '서울대학교', files: ['snu-1.jpg'] }, { name: '숭실대학교', files: ['nx-4.jpg'] }]);
    }
    const cf = fnBody(src, 'async function commonsFiles(');
    eq('  commonsFiles 가 titleChunks( 로 묶고 40개 고정 자르기(i += 40)가 없다 · Openverse 401·403 이면 끈다(openverseOff)',
      [/titleChunks\(titles\)/.test(cf), /i \+= 40/.test(src), /let openverseOff = 0;/.test(src) && /if \(e\.status === 401 \|\| e\.status === 403\) \{ openverseOff = e\.status;/.test(src)],
      [true, false, true]);
  }
}

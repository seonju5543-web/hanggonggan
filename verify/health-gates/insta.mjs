/* 「로봇·도구 점검 관문」 — insta 묶음: 인스타 로봇이 되돌릴 수 없는 게시를 지키고, 장부·그림이 쌓이지 않는가 (2026-10-04)
   찾은 것:
     ① 판형 2·3·4 가 그린 날 기준 「마감 D-21」 을 그림에 박았다(그림은 굳는다 → 다음 날부터 거짓) · 마감 지난 카드도 게시가 됐다
        (publish.mjs 도 관리자 화면도 마감을 안 봤다 — 화면 줄에 '마감 지남' 과 게시 버튼이 같이 있었다).
     ② 게시는 성공했는데 main push 가 거절돼(#263) '게시 실패' 이슈 — 사람이 다시 누르면 같은 글이 두 번 올라갈 수 있었다.
     ④ 워크플로 대기줄 하나에 준비·게시·건너뛰기가 묶여, 연달아 누르면 가운데 것이 조용히 취소됐다 · insta/seen.json 은
        병합 규칙이 없고 일반 seen.json 규칙에 걸리면 올림 기록이 사라졌다.
     ⑦ 마감 지난 카드 폴더를 지우는 단계가 없어 insta/pub 이 3주에 100MB · 올림 파일(artifact)이 매번 그 통째.
     ⑧ 댓글이 그대로여도 updatedAt 한 줄로 매번 커밋.
     ⑨ 「이 기기에서 배포」 로 올린 run-notify.txt 는 insta.yml 을 못 깨워 수정본 알림이 조용히 안 갔다.
     리뷰(2026-10-05): 장부 줄의 dates 배선·정리 폴더 지우기·장부 저장이 글자 검사라 빠져도 초록 · 사람이 건너뛴 카드가 마감 연장으로 다시 뽑힘 ·
        주소 묻기에 시한이 없어 올린 뒤 장부에 못 적음 · 준비 실패 이슈가 열려 있으면 이번 실패의 알림 못 간 카드가 사라짐 · 올림 기록 병합이 code 하나로 줄임.
   🔴 표본(고정 예시)만 잰다 — insta/seen.json·insta/pub·data/ 는 읽지 않는다. 코드·워크플로·판형 파일은 코드라 읽는다.
   🔴 셸 단계를 돌릴 때 진짜 gh·git 을 부르지 않는다(같은 이름의 셸 함수가 먼저 잡히고, 열쇠·집 폴더를 넘기지 않는다).
   🔴 워크플로·스킬 문서 **글자**를 재는 줄(eqWf·eqDoc)은 로봇 워크플로(데이터 관문)에서는 어긋나도 경고만 한다 — 이 관문은 test-collector
      「로봇·도구 점검 관문」 을 거쳐 수집 로봇의 데이터 관문에서도 돈다. 문구 하나·무해한 단계 이름 하나에 그 실행의 자동 등록분이
      되돌려지면 안 된다(리뷰 2026-10-05 · alerts·servers 묶음과 같은 잣대 softEq). 로컬과 화면 검사(verify-ui.yml · DOC_GATES=1)에서는 그대로 실패한다.
      순수 함수·진짜 명령 표본(publishRefusal·명령줄 거절·관리자 vm·병합기·expire·장부 명령·fetchAll·가짜 인스타)은 어디서나 엄격하다.
   🔴 장부를 쓰는 명령(ledger.mjs·revise.mjs)은 **임시 폴더에 복사해 실제로 돌린다** — 글자로 재면 배선(dates 옮기기·폴더 지우기·장부 저장)이
      빠져도 초록이었다(리뷰 변이 M4·M5·M7·M8). */
import fs from 'node:fs';
import vm from 'node:vm';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { stepsOf } from './ci.mjs';
import { jobsOf, codeOf, softEq } from './alerts.mjs';

const read = (root, rel) => fs.readFileSync(new URL(rel, root), 'utf8').replace(/\r/g, '');
const tmp = (tag) => fs.mkdtempSync(path.join(os.tmpdir(), `insta-gate-${tag}-`));

/** 워크플로 단계의 셸 글을 가짜 gh·git 과 함께 돌린다 — 나온 글자(stdout)를 돌려준다 */
function runStep(script, env, fakes = '') {
  const home = tmp('home');
  const gh = 'gh() { printf "GH"; for a in "$@"; do printf " [%s]" "$a"; done; printf "\\n"; }';
  try {
    const r = spawnSync('bash', ['-c', `${gh}\n${fakes}\n${script}`], {
      encoding: 'utf8', timeout: 10000,
      env: { PATH: process.env.PATH || '/usr/bin:/bin', HOME: home, GH_CONFIG_DIR: home, GITHUB_STEP_SUMMARY: path.join(home, 'summary'), REPO: 'gate/none', RUN: '1', ...env },
    });
    return `${r.stdout || ''}${r.status ? `(셸 종료 ${r.status} ${String(r.stderr || '').slice(0, 160)})` : ''}`;
  } finally { fs.rmSync(home, { recursive: true, force: true }); }
}

/** 장부 명령 상자 — insta/ 의 진짜 파일(ledger·pick·graph·revise)을 임시 폴더에 복사한다. 그 파일들은 제 위치(ROOT = 한 칸 위)의
    insta/seen.json·insta/pub/ 를 쓰므로, 복사본은 저장소가 아니라 상자 안만 건드린다. files = { '상대 경로': 글자 } 로 표본을 깐다. */
function sandbox(rootDir, files = {}) {
  const dir = tmp('sbx');
  fs.mkdirSync(path.join(dir, 'insta/pub'), { recursive: true });
  for (const f of ['insta/ledger.mjs', 'insta/pick.mjs', 'insta/graph.mjs', 'insta/revise.mjs']) fs.copyFileSync(path.join(rootDir, f), path.join(dir, f));
  for (const [rel, body] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), typeof body === 'string' ? body : JSON.stringify(body, null, 1));
  }
  const run = (script, ...args) => {
    const r = spawnSync(process.execPath, [path.join(dir, script), ...args], { cwd: dir, encoding: 'utf8', timeout: 20000,
      env: { PATH: process.env.PATH || '/usr/bin:/bin', HOME: dir } });
    return { code: r.status, out: r.stdout || '', err: r.stderr || '' };
  };
  const seen = () => JSON.parse(fs.readFileSync(path.join(dir, 'insta/seen.json'), 'utf8'));
  const has = (rel) => fs.existsSync(path.join(dir, rel));
  return { dir, run, seen, has, done: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

/** _admin/admin.js 의 최상위 함수 하나 — 열 0 의 `function 이름(` · `async function 이름(` 부터 열 0 의 `}` 까지 */
function takeFn(src, name) {
  const m = src.match(new RegExp(`^(?:async )?function ${name}\\([\\s\\S]*?^\\}`, 'm'));
  if (!m) throw new Error(`_admin/admin.js 에서 ${name}() 을 못 찾았습니다`);
  return m[0];
}

export default async function gate(eq, ctx) {
  const root = ctx.root;
  const ROOT_DIR = fileURLToPath(root);
  const R = await import(new URL('insta/render.mjs', root));
  const P = await import(new URL('insta/publish.mjs', root));
  const PK = await import(new URL('insta/pick.mjs', root));
  const CM = await import(new URL('insta/comments.mjs', root));
  const wf = read(root, '.github/workflows/insta.yml');
  const jobs = Object.fromEntries(jobsOf(wf).map((j) => [j.name, j.text]));
  const steps = Object.fromEntries(Object.entries(jobs).map(([k, t]) => [k, stepsOf(t)]));
  /* 단계는 이름이 아니라 id 로 찾는다 — 다른 세션이 단계 이름만 다듬어도 관문이 헛빨간불을 내지 않게 */
  const byId = (job, id) => (steps[job] || []).find((s) => s.id === id) || {};
  /* 워크플로·문서 글자 관문의 엄격함 — test-collector 문서 관문(DOC_GATES)·alerts·servers 묶음과 같은 잣대(로컬이거나 DOC_GATES=1 이면 엄격) */
  const DOC_GATES = ctx.docGates ?? (!process.env.GITHUB_ACTIONS || process.env.DOC_GATES === '1');
  const eqWf = softEq(eq, DOC_GATES);
  const eqDoc = eqWf;
  if (!DOC_GATES) console.log('  (로봇 워크플로 — insta 의 워크플로·스킬 문서 글자 관문은 어긋나도 경고만 · verify-ui.yml 과 로컬에서는 실패)');

  /* ── ① 카드에 상대 날짜를 박지 않는다 · 마감 지난 카드·옛 「마감 D-N」 카드는 올리지 않는다 ── */
  const tpls = await R.loadTemplates();
  const s0 = { code: 'fx', org: '테스트재단', name: '테스트장학', due: '2026-10-23',
    fields: { 지원금액: '○ 100만원', 특정자격: '○ 대학 재학생', 자격제한: '○ 휴학생 제외' } };
  const drawn = (s, today) => Object.values(tpls).map((t) => [t.no, t.cards(R.context(s, today, R.SKINS.blue, 12345, null), R.KIT).join('')]);
  const d1002 = new Date('2026-10-02T10:00:00+09:00');
  const cards = drawn(s0, d1002);
  eq('①-a 판형 전부 — 그림에 상대 날짜(「마감 D-N」·「D-N」·「오늘 마감」)가 없다 (10-04 실측: 2·3·4번이 「마감 D-21」)',
    cards.filter(([, h]) => /마감 D-\d|D-\d+|오늘 마감/.test(h)).map(([n]) => n), []);
  eq('  2·3·4번은 절대 날짜 「10월 23일 마감」 을 싣는다 · 마감 당일도 「10월 2일 마감」',
    [cards.filter(([n, h]) => [2, 3, 4].includes(n) && h.includes('10월 23일 마감')).map(([n]) => n),
      drawn({ ...s0, due: '2026-10-02' }, d1002).filter(([n, h]) => [2, 3, 4].includes(n) && h.includes('10월 2일 마감')).map(([n]) => n)],
    [[2, 3, 4], [2, 3, 4]]);
  const rsrc = read(root, 'insta/render.mjs');
  const metaAt = rsrc.indexOf("writeFileSync(join(pub, 'meta.json')");
  eqWf('  게시용 meta.json 에 dates: \'absolute\' 를 적는다(옛 카드와 가르는 표식 · 코드 글자 — insta/** 를 고치면 verify-ui 가 엄격하게 돈다)', metaAt > 0 && /dates: 'absolute'/.test(rsrc.slice(metaAt, metaAt + 600)), true);

  const NOW = Date.parse('2026-10-04T12:00:00+09:00');
  const ref = (m, now = NOW) => { const r = P.publishRefusal(m, now); return r === null ? null : (/마감이 지난/.test(r) ? '마감' : /D-N/.test(r) ? 'D-N' : r); };
  eq('①-b publishRefusal — 마감 지남→거절 · 미래+absolute→통과 · 미래+dates 없음+2번→거절 · 1번→통과 · 마감 없음→통과 · 오늘 마감 23:59 전→통과 · 지난 직후→거절',
    [ref({ due: '2026-10-03', tplNo: 1, dates: 'absolute' }), ref({ due: '2026-10-30', tplNo: 2, dates: 'absolute' }),
      ref({ due: '2026-10-30', tplNo: 2 }), ref({ due: '2026-10-30', tplNo: 1 }), ref({ tplNo: 2 }),
      ref({ due: '2026-10-04', tplNo: 3, dates: 'absolute' }), ref({ due: '2026-10-04', tplNo: 3, dates: 'absolute' }, Date.parse('2026-10-05T00:00:30+09:00'))],
    ['마감', null, 'D-N', null, null, null, '마감']);

  /* 진짜 길 — 명령줄 그대로. 시크릿 없이 돌려서 네트워크·장부 쓰기 전에 멈춘다(publish() 첫 줄) */
  const runPub = (meta, args) => {
    const dir = tmp('pub');
    try {
      fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify(meta));
      fs.writeFileSync(path.join(dir, '1.jpg'), ''); fs.writeFileSync(path.join(dir, '2.jpg'), '');
      fs.writeFileSync(path.join(dir, 'caption.txt'), '표본 캡션\n');
      const env = { ...process.env };
      for (const k of ['IG_USER_ID', 'IG_ACCESS_TOKEN', 'GITHUB_OUTPUT']) delete env[k];
      const r = spawnSync(process.execPath, [path.join(ROOT_DIR, 'insta/publish.mjs'), `--dir=${dir}`, ...args], { encoding: 'utf8', timeout: 20000, env, cwd: ROOT_DIR });
      return { code: r.status, err: r.stderr || '' };
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  };
  const past = runPub({ code: 'fx', due: '2020-01-01', tplNo: 1, dates: 'absolute', at: '2019-12-20' }, ['--publish']);
  const oldTpl = runPub({ code: 'fx', due: '2099-12-31', tplNo: 2, at: '2026-09-12' }, ['--publish']);
  const dry = runPub({ code: 'fx', due: '2020-01-01', tplNo: 1, dates: 'absolute' }, []);
  const okCard = runPub({ code: 'fx', due: '2099-12-31', tplNo: 2, dates: 'absolute' }, ['--publish']);
  eq('①-c 명령줄 — 마감 지난 표본은 종료 1 · 「마감」 · 시크릿 검사까지 안 간다 / 옛 2번 표본도 거절 / 예행연습도 거절',
    [past.code, /마감이 지난/.test(past.err), /IG_USER_ID/.test(past.err), oldTpl.code, /D-N/.test(oldTpl.err), dry.code, /마감이 지난/.test(dry.err)],
    [1, true, false, 1, true, 1, true]);
  eq('  대조군 — 멀쩡한 카드는 가드를 지나 시크릿 검사에서 멈춘다(네트워크·장부 쓰기 전)',
    [okCard.code, /IG_USER_ID · IG_ACCESS_TOKEN 이 없습니다/.test(okCard.err)], [1, true]);

  /* 관리자 화면 — 함수를 떼어 실제로 그려 본다 (verify-admin.js 는 1번·마감 +5일 표본만 쓴다) */
  const adm = read(root, '_admin/admin.js');
  const box = { jobs: [], sent: [] };
  const D = { insta: { templates: [], stats: { posts: [] }, seen: { posted: [], prepared: [] } } };
  /* 화면의 '지금' 을 고정한다 — 마감 다음 날 06:00 KST (반올림이면 -0.25 → -0 이라 '오늘 마감' 으로 읽히던 자리 · 2026-10-05) */
  const ADMIN_NOW = Date.parse('2026-10-04T06:00:00+09:00');
  class FixedDate extends Date {
    constructor(...a) { if (a.length) super(...a); else super(ADMIN_NOW); }
    static now() { return ADMIN_NOW; }
  }
  const vctx = vm.createContext({ D, Date: FixedDate, Math, Number, String, JSON, Set, Map, console,
    esc: (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])),
    raw: (p) => `raw/${p}`, safeUrl: (u) => u, jobShow: (m, kind) => box.jobs.push([m, kind]),
    instaDispatch: async (...a) => { box.sent.push(a[1]); }, INSTA_STEP: { publish: '게시 (준비된 것을 올린다)' }, WF_INSTA: 'insta.yml',
    document: { querySelector: () => null }, CSS: { escape: (s) => s } });
  vm.runInContext(['instaTplName', 'instaDday', 'instaPublishBlock', 'instaGroups', 'instaPostRow', 'handleInstaClick'].map((n) => takeFn(adm, n)).join('\n\n'), vctx);
  const rows = [
    { code: 'P', status: 'prepared', due: '2020-01-01', tplNo: 1, dates: 'absolute' },
    { code: 'O', status: 'prepared', due: '2099-12-31', tplNo: 2 },
    { code: 'N', status: 'prepared', due: '2099-12-31', tplNo: 2, dates: 'absolute' },
    { code: 'Q', status: 'prepared', due: '2099-12-31', tplNo: 1 },
    { code: 'Y', status: 'prepared', due: '2026-10-03', tplNo: 1, dates: 'absolute' },   // 어제 마감 · 지금 06:00 — 6시간 지났다
    { code: 'T', status: 'prepared', due: '2026-10-04', tplNo: 1, dates: 'absolute' },   // 오늘 마감 — 아직 올릴 수 있다
  ];
  D.insta.seen.prepared = rows;
  eq('①-d 관리자 줄 — 마감 지난 줄(다음 날 아침 포함)·옛 2번 줄에는 게시 버튼이 없고 이유를 둔다 · 미래+absolute·1번·오늘 마감 줄에는 있다 (로봇의 publishRefusal 과 같은 잣대)',
    rows.map((r) => [r.code, /data-ig-publish=/.test(vctx.instaPostRow(r, 'prepared')), /data-ig-block=/.test(vctx.instaPostRow(r, 'prepared')),
      P.publishRefusal(r, ADMIN_NOW) !== null]),
    [['P', false, true, true], ['O', false, true, true], ['N', true, false, false], ['Q', true, false, false], ['Y', false, true, true], ['T', true, false, false]]);
  const click = async (code) => {
    box.jobs.length = 0; box.sent.length = 0;
    await vctx.handleInstaClick({ target: { closest: (sel) => (sel === '[data-ig-publish]' ? { getAttribute: () => code } : null) } });
    return [box.sent.length, box.jobs.map(([, k]) => k).join(',')];
  };
  eq('  옛 화면이 남아 버튼을 눌러도 — 마감 지난·옛 카드는 로봇을 안 깨우고 거절(bad) · 멀쩡한 카드는 깨운다',
    [await click('P'), await click('O'), await click('N')], [[0, 'bad'], [0, 'bad'], [1, '']]);
  const pubFail = byId('publish', 'alarm');
  eqWf('  게시 실패 이슈의 원인 목록에 「마감 지남·옛 D-N 카드 → 게시 거절」 이 있다 · 「첫 🚨 줄이 이유」 라고 단정하지 않는다(토큰 경고가 먼저 찍힐 수 있다)',
    [/마감이 지난 카드·그림에 「마감 D-N」/.test(pubFail.run || ''), /첫 🚨 줄이 이유/.test(pubFail.run || '')], [true, false]);

  /* 장부 줄의 dates 배선 — 그린 카드(meta.json)가 장부 줄이 되어도 '새 카드' 로 읽혀야 한다 (리뷰 2026-10-05 · 변이 M7·M8 이 초록이던 자리)
     🔴 빠지면 새로 그린 2·3·4번 카드 전부가 관리자 화면에서 '옛 카드' 로 막히고 다시 그려도 안 풀린다. */
  const newMeta = { code: 'N', org: '테스트재단', name: '테스트장학', due: '2099-12-31', tplNo: 2, cards: 3, at: '2026-10-05', dates: 'absolute' };
  const oldMeta = { ...newMeta, code: 'O' }; delete oldMeta.dates;
  const rowN = PK.preparedRow('N', newMeta); const rowO = PK.preparedRow('O', oldMeta);
  eq('①-e preparedRow — 새 2번 카드의 장부 줄은 게시도(publishRefusal) 화면도(instaPublishBlock) 막지 않는다 · dates 없는 옛 줄은 둘 다 막는다',
    [rowN.dates, P.publishRefusal(rowN, ADMIN_NOW), vctx.instaPublishBlock(rowN), rowN.status, rowN.dir,
      P.publishRefusal(rowO, ADMIN_NOW) !== null, vctx.instaPublishBlock(rowO)],
    ['absolute', null, null, 'prepared', 'insta/pub/N', true, '옛 카드(D-N) — 다시 그린 뒤 게시']);
  {
    /* 진짜 명령 — ledger.mjs prepared(자동 준비)와 revise.mjs(채팅에서 다시 그리기)를 상자에서 돌려 장부 줄을 읽는다.
       revise 는 render.mjs 를 부르므로 상자에는 meta.json 만 쓰는 가짜 render.mjs 를 둔다(브라우저 없이 · 장부 배선만 잰다). */
    const fakeRender = `import { mkdirSync, writeFileSync } from 'node:fs';
const code = process.argv[2]; const tpl = Number((process.argv.find((a) => a.startsWith('--tpl=')) || '--tpl=2').slice(6));
const d = new URL('pub/' + code + '/', import.meta.url); mkdirSync(d, { recursive: true });
writeFileSync(new URL('meta.json', d), JSON.stringify({ ...${JSON.stringify(newMeta)}, code, tplNo: tpl }));
`;
    const box = sandbox(ROOT_DIR, { 'insta/pub/N/meta.json': newMeta, 'insta/render.mjs': fakeRender });
    try {
      const led = box.run('insta/ledger.mjs', 'prepared', 'N');
      const rev = box.run('insta/revise.mjs', 'V', '--tpl=3', '--no-preview');
      const rows = Object.fromEntries((box.seen().prepared || []).map((r) => [r.code, r]));
      const look = (r) => (r ? [r.dates, r.tplNo, P.publishRefusal(r, ADMIN_NOW), vctx.instaPublishBlock(r)] : '(장부에 줄 없음)');
      eq('  명령을 돌려 본다 — ledger.mjs prepared(자동 준비)·revise.mjs(다시 그리기)가 쓴 장부 줄이 dates 를 옮겨 게시·화면을 막지 않는다',
        [led.code, rev.code, look(rows.N), look(rows.V), rows.V && rows.V.revisedAt],
        [0, 0, ['absolute', 2, null, null], ['absolute', 3, null, null], '2026-10-05']);
    } finally { box.done(); }
  }

  /* ── ② 올라간 뒤의 실패를 '게시 실패' 라고 하지 않는다 · main push 는 재시도 루프 안에서만 ── */
  eqWf('②-a 게시 작업에 main push 가 없다(장부는 Pages 가 필요 없다 · #263 거짓 경보의 자리)', /push origin HEAD:main/.test(codeOf(jobs.publish || '')), false);
  const mainOutsideLoop = Object.entries(steps).flatMap(([j, ss]) => ss.filter((s) => /HEAD:main/.test(String(s.run || '').replace(/for i in 1 2 3; do[\s\S]*?\bdone\b/g, ''))).map((s) => `${j}: ${s.name}`));
  const mainInLoop = Object.values(steps).flat().filter((s) => /for i in 1 2 3; do[\s\S]*?HEAD:main[\s\S]*?\bdone\b/.test(s.run || ''));
  eqWf('②-b HEAD:main 은 모든 단계에서 `for i in 1 2 3` 재시도 루프 안에만 · 준비 커밋(id commit)에 그 루프가 있다',
    [mainOutsideLoop, mainInLoop.map((s) => s.id || s.name)], [[], ['commit']]);
  const post = byId('publish', 'post');
  const record = byId('publish', 'record');
  const rec = record.run || '';
  eqWf('②-c 올리기 단계에 id: post · 기록 저장은 올라갔으면(단계 성공 또는 media 번호) 앞이 넘어져도 돈다 · media 번호로 올림 기록을 직접 적고(git add 앞) · 실패 알림이 steps.post.outcome·media 를 본다',
    [/insta\/publish\.mjs[^\n]*--publish/.test(post.run || ''), /always\(\)/.test(record.if || ''), /steps\.post\.outcome == 'success'/.test(record.if || ''),
      /steps\.post\.outputs\.media != ''/.test(record.if || ''), /steps\.post\.outputs\.media/.test(record.raw || ''),
      rec.indexOf('node insta/ledger.mjs posted') >= 0 && rec.indexOf('node insta/ledger.mjs posted') < rec.indexOf('git add'),
      /steps\.post\.outcome/.test(pubFail.raw || ''), /steps\.post\.outputs\.media/.test(pubFail.raw || '')],
    [true, true, true, true, true, true, true, true]);
  const failRun = (env) => runStep(pubFail.run || 'exit 9', { CODE: 'C1', ...env });
  const titleOf = (out) => ((/\[--title\] \[([^\]]*)\]/.exec(out) || [])[1] || '(이슈 없음)');
  const NOREPOST = '⚠️ 인스타에는 올라갔는데 기록 저장만 실패했습니다 — 다시 게시하지 마세요 (C1)';
  eqWf('  실패 알림을 돌려 본다 — 올라갔는데 기록 실패 → 「다시 게시하지 마세요」(주소 포함) · 올린 뒤 단계가 넘어졌는데 기록 단계가 media 로 적음 → 이슈 없음 · 둘 다 끝나지 못함 → 같은 경고 · 도중에 끊김(증거 없음) → 「먼저 확인」(시한 또는 취소) · 안 올라감 → 「게시가 실패」 · 둘 다 됨 → 이슈 없음',
    [titleOf(failRun({ POSTED: 'success', RECORDED: 'failure', PERMALINK: 'https://www.instagram.com/p/x/', MEDIA: 'M1' })),
      /instagram\.com\/p\/x/.test(failRun({ POSTED: 'success', RECORDED: 'failure', PERMALINK: 'https://www.instagram.com/p/x/', MEDIA: 'M1' })),
      titleOf(failRun({ POSTED: 'failure', RECORDED: 'success', MEDIA: 'M1' })), titleOf(failRun({ POSTED: 'cancelled', RECORDED: 'cancelled', MEDIA: 'M1' })),
      titleOf(failRun({ POSTED: 'cancelled', RECORDED: 'skipped' })), /시한에 걸렸거나 실행이 취소되어/.test(failRun({ POSTED: 'cancelled', RECORDED: 'skipped' })),
      titleOf(failRun({ POSTED: 'failure', RECORDED: 'skipped' })), titleOf(failRun({ POSTED: 'success', RECORDED: 'success' }))],
    [NOREPOST, true, '(이슈 없음)', NOREPOST, '⚠️ 인스타 게시 단계가 도중에 끊겼습니다 — 올라갔는지 먼저 확인하세요 (C1)', true,
      '🚨 인스타 게시가 실패했습니다', '(이슈 없음)']);
  {
    /* 올림 기록 한 줄 — 게시 명령(publish.mjs)과 「올린 기록 저장」(ledger.mjs posted)이 같이 쓰는 recordPosted · 같은 게시물은 한 줄 */
    const sp = { posted: [], prepared: [{ code: 'A', status: 'prepared', due: '2099-12-31' }] };
    const first = PK.recordPosted(sp, { code: 'A', media: 'M1', permalink: 'https://www.instagram.com/p/a/' }, NOW);
    const again = PK.recordPosted(sp, { code: 'A', media: 'M1' }, NOW);
    const other = PK.recordPosted(sp, { code: 'A', media: 'M2' }, NOW);
    eq('②-e recordPosted — 처음은 적고 준비 줄을 「올림」 으로(KST 날짜) · 같은 공고·같은 media 는 다시 안 적는다 · media 가 다르면 버리지 않고 적는다',
      [first, again, other, sp.posted.map((p) => `${p.code}:${p.media}:${p.at}`), sp.prepared[0].status, sp.prepared[0].postedAt],
      [true, false, true, ['A:M1:2026-10-04', 'A:M2:2026-10-04'], 'posted', '2026-10-04']);
    const box = sandbox(ROOT_DIR, { 'insta/pub/A/meta.json': { code: 'A', org: '테스트재단', name: '테스트장학', tplNo: 1 },
      'insta/seen.json': { posted: [], prepared: [{ code: 'A', status: 'prepared', due: '2099-12-31' }] } });
    try {
      const r1 = box.run('insta/ledger.mjs', 'posted', 'A', '--media=M1', '--permalink=https://www.instagram.com/p/a/?x=1');
      const r2 = box.run('insta/ledger.mjs', 'posted', 'A', '--media=M1', '--permalink=');
      const sn = box.seen();
      eq('  명령을 돌려 본다 — ledger.mjs posted 가 media·주소·meta 의 이름으로 한 줄 적고 준비 줄을 「올림」 으로 · 두 번 불러도 한 줄',
        [r1.code, r2.code, sn.posted.map((p) => [p.code, p.media, p.permalink, p.org, p.by]), sn.prepared[0].status],
        [0, 0, [['A', 'M1', 'https://www.instagram.com/p/a/?x=1', '테스트재단', '기록 단계']], 'posted']);
    } finally { box.done(); }
  }
  /* publish() 가 올린 결과를 GITHUB_OUTPUT 에 남긴다 — 명령줄은 outFile 을 안 넘기므로 기본값(환경변수) 길로 잰다
     hang — 올린 뒤 게시물 주소 묻기가 영영 답이 없다. 🔴 그 요청에는 시한이 있어(waits.permalinkMs) publish() 가 주소 없이 **스스로** 돌아와야
     명령줄이 장부에 올림 기록을 적는다(리뷰 2026-10-05 — 옛 판은 시한이 없어 작업 시한까지 매달렸다).
     정상 한 바퀴는 벽시계와 겨루지 않는다(붐비는 러너에서 헛빨간불 금지 · 주소 시한도 진짜 값 30초) — 멈춤 표본만 시한을 30ms 로 줄이고,
     그보다 훨씬 긴 10초를 넘기면 '(멈춤)' 으로 읽는다(시한이 빠진 코드가 관문을 영영 붙잡지 않게). */
  const fakeRound = async (hang) => {
    const out = path.join(tmp('out'), 'gh-output');
    fs.writeFileSync(out, '');
    const keep = { u: process.env.IG_USER_ID, t: process.env.IG_ACCESS_TOKEN, o: process.env.GITHUB_OUTPUT };
    const ok = (b) => ({ ok: true, json: async () => b });
    let made = 0;
    const f = async (u, o) => {
      const s = String(u);
      if (o?.method === 'HEAD') return { ok: true };
      if (/\/me\?/.test(s)) return ok({ user_id: '77' });
      if (/content_publishing_limit/.test(s)) return ok({ data: [] });
      if (/\/77\/media_publish$/.test(s)) return ok({ id: 'M1' });
      if (/\/77\/media$/.test(s)) return ok({ id: `c${++made}` });
      if (/\/M1\?/.test(s)) return hang ? new Promise(() => {}) : ok({ permalink: 'https://www.instagram.com/p/x/' });
      if (/\/c\d+\?/.test(s)) return ok({ status_code: 'FINISHED' });
      throw new Error(`뜻밖의 주소 ${s}`);
    };
    try {
      process.env.IG_USER_ID = '77'; process.env.IG_ACCESS_TOKEN = 'tok-관문'; process.env.GITHUB_OUTPUT = out;
      const run = P.publish({ dir: 'x', images: ['https://i/1.jpg', 'https://i/2.jpg'], caption: 'c', live: true, f,
        waits: { ...P.WAITS, liveGapMs: 0, readyGapMs: 0, pubGapMs: 0, ...(hang ? { permalinkMs: 30 } : {}) }, tokenStore: { read: () => ({}), write: () => {} }, log: () => {} });
      let timer;
      const r = hang ? await Promise.race([run, new Promise((res) => { timer = setTimeout(() => res('(멈춤)'), 10000); })]).finally(() => clearTimeout(timer)) : await run;
      return [r && typeof r === 'object' ? [r.mediaId, r.permalink] : r, fs.readFileSync(out, 'utf8')];
    } catch (e) { return [`넘어짐 ${e.message}`, '']; } finally {
      for (const [k, v] of [['IG_USER_ID', keep.u], ['IG_ACCESS_TOKEN', keep.t], ['GITHUB_OUTPUT', keep.o]]) if (v === undefined) delete process.env[k]; else process.env[k] = v;
      fs.rmSync(path.dirname(out), { recursive: true, force: true });
    }
  };
  eq('②-d 가짜 인스타 한 바퀴 — 올리면 GITHUB_OUTPUT 에 media·permalink 를 남긴다 · 주소 묻기가 답이 없어도 시한 뒤 주소 없이 돌아온다(media 는 먼저 남아 있다 · 장부에 적힌다)',
    [await fakeRound(false), await fakeRound(true)],
    [[['M1', 'https://www.instagram.com/p/x/'], 'media=M1\npermalink=https://www.instagram.com/p/x/\n'], [['M1', null], 'media=M1\npermalink=\n']]);
  const prepFail = byId('prepare', 'alarm');
  const bodyOf = (out) => ((/\[--body\] \[([\s\S]*?)\]\n/.exec(out) || [])[1] || '');
  /* 가짜 gh — 열린 '준비가 실패' 이슈 번호 묻기(issue list)에는 OPEN 을 답하고, 나머지는 받은 인자를 찍는다 */
  const ghList = 'gh() { if [ "$1 $2" = "issue list" ]; then printf "%s" "$OPEN"; return 0; fi; printf "GH"; for a in "$@"; do printf " [%s]" "$a"; done; printf "\\n"; }';
  const prep = (env) => runStep(prepFail.run || 'exit 9', env, ghList);
  const verbOf = (out) => (out.split('\n').find((l) => /^GH \[issue\] \[(create|comment)\]/.test(l)) || '(없음)').replace(/^GH \[issue\] \[(create|comment)\]( \[(\d+)\])?.*$/, '$1$3');
  eqWf('  준비 실패 알림 — 장부가 기본 브랜치에 들어갔으면 「관리자 화면에 있다 · 알림 다시 보내기」, 아니면 「다음 실행이 다시 그린다」 · 열린 이슈가 있으면 끝내지 않고 그 이슈에 같은 말을 댓글로',
    [/장부에 준비됨으로/.test(bodyOf(prep({ OK: 'A B', SAVED: 'ok', OPEN: '' }))), /저장하기 전에 멈췄습니다/.test(bodyOf(prep({ OK: 'A B', SAVED: '', OPEN: '' }))),
      verbOf(prep({ OK: 'A B', SAVED: 'ok', OPEN: '' })), verbOf(prep({ OK: 'A B', SAVED: 'ok', OPEN: '41' })),
      /장부에 준비됨으로/.test(bodyOf(prep({ OK: 'A B', SAVED: 'ok', OPEN: '41' })))],
    [true, true, 'create', 'comment41', true]);

  /* ── ④ 대기줄은 작업마다 · 인스타 장부 병합 규칙(올림 기록을 안 버린다) ── */
  const conc = (t) => (/^ {4}concurrency:\n {6}group: (.+)\n {6}cancel-in-progress: false$/m.exec(t || '') || [])[1] || null;
  /* 대기줄 이름 식을 실제로 셈해 본다 — GitHub 식의 &&·|| 는 빈 글자·null 을 거짓으로 보는 JS 와 같다(format·== 만 바꿔 끼운다) */
  const groupOf = (expr, ctx) => {
    const body = (/^\$\{\{\s*([\s\S]*?)\s*\}\}$/.exec(expr || '') || [])[1];
    if (!body) return `(식이 아님: ${expr})`;
    const js = body.replace(/==/g, '===').replace(/'([^']*)'/g, (_, t) => JSON.stringify(t));
    try {
      return Function('inputs', 'github', 'format', `return (${js});`)(ctx.inputs || {}, ctx.github || {},
        (f, ...a) => String(f).replace(/\{(\d+)\}/g, (_, i) => String(a[Number(i)] ?? '')));
    } catch (e) { return `(셈 못 함: ${e.message})`; }
  };
  const runs = {
    '게시 X': { inputs: { step: '게시', code: 'X' }, github: { event_name: 'workflow_dispatch' } },
    '건너뛰기 X': { inputs: { step: '건너뛰기', code: 'X' }, github: { event_name: 'workflow_dispatch' } },
    '다시 그리기 X': { inputs: { step: '준비', code: 'X' }, github: { event_name: 'workflow_dispatch' } },
    '알림 X(배포가 깨움)': { inputs: { step: '알림', code: 'X' }, github: { event_name: 'workflow_dispatch' } },
    '알림 push 1': { github: { event_name: 'push', sha: 's1' } },
    '알림 push 2': { github: { event_name: 'push', sha: 's2' } },
    '수집 뒤 자동': { github: { event_name: 'workflow_run', sha: 's3' } },
    '예약': { github: { event_name: 'schedule', sha: 's4' } },
    '준비 버튼(코드 없음)': { inputs: { step: '준비', code: '' }, github: { event_name: 'workflow_dispatch' } },
  };
  const lane = (name) => groupOf(conc(jobs[/^게시/.test(name) ? 'publish' : /^건너뛰기/.test(name) ? 'skip' : 'prepare']), runs[name]);
  eqWf('④-a 워크플로 단위 대기줄 없음 · 대기줄을 셈해 보면 — 같은 공고의 게시·건너뛰기·다시 그리기·알림은 한 줄, 사람이 올린 알림(push)은 push 마다 제 줄(자동 준비에 밀려 취소되지 않게), 자동·예약·버튼 준비만 insta-prepare',
    [/^concurrency:/m.test(wf), Object.keys(runs).map((n) => `${n} → ${lane(n)}`)],
    [false, ['게시 X → insta-code-X', '건너뛰기 X → insta-code-X', '다시 그리기 X → insta-code-X', '알림 X(배포가 깨움) → insta-code-X',
      '알림 push 1 → insta-push-s1', '알림 push 2 → insta-push-s2', '수집 뒤 자동 → insta-prepare', '예약 → insta-prepare', '준비 버튼(코드 없음) → insta-prepare']]);
  const merge = (O, A, B) => {
    const dir = tmp('merge');
    try {
      const [o, a, b] = ['O', 'A', 'B'].map((n) => path.join(dir, n));
      fs.writeFileSync(o, JSON.stringify(O, null, 1) + '\n'); fs.writeFileSync(a, JSON.stringify(A, null, 1) + '\n'); fs.writeFileSync(b, JSON.stringify(B, null, 1) + '\n');
      const r = spawnSync(process.execPath, [path.join(ROOT_DIR, 'tools/merge-json-union.mjs'), o, a, b, 'insta/seen.json'], { encoding: 'utf8', timeout: 20000 });
      const got = JSON.parse(fs.readFileSync(a, 'utf8'));
      return { code: r.status, posted: (got.posted || []).map((p) => `${p.code || ''}:${p.media || ''}`), prepared: (got.prepared || []).map((p) => `${p.code}:${p.status}`) };
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  };
  const m1 = merge({ posted: [], prepared: [{ code: 'A', status: 'prepared', at: '2026-10-01' }] },
    { posted: [{ code: 'A', media: '1', at: '2026-10-02' }], prepared: [{ code: 'A', status: 'posted', at: '2026-10-01', postedAt: '2026-10-02' }] },
    { posted: [], prepared: [{ code: 'A', status: 'prepared', at: '2026-10-01' }, { code: 'B', status: 'prepared', at: '2026-10-02' }] });
  eq('④-b 병합기(진짜 명령) — 한쪽 올림 + 다른 쪽 새 준비 → 올림 기록 A 와 준비 B 가 둘 다 남는다(옛 일반 규칙: posted [] · B 사라짐)',
    m1, { code: 0, posted: ['A:1'], prepared: ['A:posted', 'B:prepared'] });
  const m2 = merge({ posted: [], prepared: [{ code: 'X', status: 'skipped', at: '2026-10-01', skippedAt: '2026-10-02' }] },
    { posted: [], prepared: [{ code: 'X', status: 'skipped', at: '2026-10-01', skippedAt: '2026-10-02' }, { code: 'N', status: 'prepared', at: '2026-10-04' }] },
    { posted: [], prepared: [{ code: 'X', status: 'prepared', at: '2026-10-04', revisedAt: '2026-10-04', skippedAt: '2026-10-02' }] });
  const m3 = merge({ posted: [], prepared: [{ code: 'Y', status: 'prepared', at: '2026-10-01' }] },
    { posted: [], prepared: [{ code: 'Y', status: 'skipped', at: '2026-10-01', skippedAt: '2026-10-03' }] },
    { posted: [{ code: 'Y', media: '9', at: '2026-10-03' }], prepared: [{ code: 'Y', status: 'posted', at: '2026-10-01', postedAt: '2026-10-03' }] });
  eq('  한쪽만 바뀐 줄은 바뀐 쪽(건너뛴 카드를 다시 그린 것이 옛 「건너뜀」 에 안 진다) · 둘 다 바뀌면 올림이 이긴다 · 올림 기록은 어느 쪽 것이든 남는다',
    [m2.prepared, m3.prepared, m3.posted], [['X:prepared', 'N:prepared'], ['Y:posted'], ['Y:9']]);
  /* 올림 기록은 code·media 로 합친다 — 같은 게시물(조상에서 온 줄)은 한 줄 · 한쪽 안의 이중 게시(같은 code·다른 media)·code 없는 줄은 그대로 (리뷰 2026-10-05) */
  const m4 = merge({ posted: [{ code: 'A', media: '1', at: '2026-10-01' }], prepared: [] },
    { posted: [{ code: 'A', media: '1', at: '2026-10-01' }, { code: 'A', media: '2', at: '2026-10-02' }, { media: '7', at: '2026-10-02', note: '손으로 넣은 줄' }], prepared: [] },
    { posted: [{ code: 'A', media: '1', at: '2026-10-01' }, { code: 'B', media: '3', at: '2026-10-03' }], prepared: [] });
  eq('  올림 기록 — 같은 게시물(code·media)은 한 줄 · 같은 공고의 두 번째 게시물(이중 게시의 증거)과 code 없는 줄도 남는다 · 다른 쪽 올림도 합친다',
    m4.posted, ['A:1', 'A:2', ':7', 'B:3']);
  const ga = read(root, '.gitattributes');
  const saving = Object.entries(steps).flatMap(([j, ss]) => ss.filter((s) => /git add[^\n]*insta\/seen\.json/.test(s.run || '')).map((s) => [j, s]));
  eqWf('④-c .gitattributes 에 insta/seen.json 합집합 · 장부를 저장하는 단계 셋(준비·게시·건너뛰기) 모두 git add 전에 병합 규칙 등록(setup-collab)',
    [/^insta\/seen\.json\s+merge=jsonunion/m.test(ga), saving.map(([j]) => j).sort(),
      saving.filter(([, s]) => { const r = s.run || ''; const i = r.indexOf('bash tools/setup-collab.sh'); return i < 0 || i > r.indexOf('git add'); }).map(([j]) => j)],
    [true, ['prepare', 'publish', 'skip'], []]);

  /* ── ⑦ 마감 지난 카드 정리 · 올림 파일은 이번 카드만 ── */
  const seen7 = () => ({ posted: [{ code: 'D' }], prepared: [
    { code: 'A', status: 'prepared', due: '2026-10-01' }, { code: 'B', status: 'skipped', due: '2026-10-01' },
    { code: 'C', status: 'failed', due: '2026-10-01' }, { code: 'D', status: 'prepared', due: '2026-10-01' },
    { code: 'E', status: 'prepared', due: '' }, { code: 'F', status: 'prepared', due: '2026-10-04' },
    { code: 'G', status: 'prepared', due: '2026-12-31' }, { code: 'H', status: 'posted', due: '2026-10-01' }] });
  const s7 = seen7();
  const gone = PK.expireRows(s7, NOW);
  eq('⑦-a expireRows — 마감 지난 준비·건너뜀·실패만 만료 · 올린 것(D·H)·마감 없음·오늘 마감(12:00)·미래는 그대로 · 만료일은 KST · 만료 전 상태를 남긴다',
    [gone, s7.prepared.map((p) => p.status), s7.prepared.find((p) => p.code === 'A').expiredAt, s7.prepared.filter((p) => p.expiredFrom).map((p) => `${p.code}:${p.expiredFrom}`)],
    [['A', 'B', 'C'], ['expired', 'expired', 'expired', 'prepared', 'prepared', 'prepared', 'prepared', 'posted'], '2026-10-04', ['A:prepared', 'B:skipped', 'C:failed']]);
  const item = (code, due) => ({ code, org: 'o', name: `n${code}`, due, fields: { 지원금액: '100만원' } });
  const exp = { posted: [], prepared: [{ code: 'R', status: 'expired', due: '2026-10-01' }, { code: 'S', status: 'expired', due: '2026-10-01' },
    { code: 'K', status: 'skipped', due: '2026-10-01', skippedAt: '2026-09-20', skippedBy: '사람' }] };
  PK.expireRows(exp, NOW);   // K — 사람이 건너뛴 카드가 마감이 지나 만료된 진짜 길
  const pick7 = PK.candidates([item('R', '2026-10-30'), item('S', '2026-10-01'), item('K', '2026-10-30')], Date.parse('2026-09-20T12:00:00+09:00'), exp, { unpreparedOnly: true });
  eq('⑦-b 재단이 마감을 미뤘으면(지금 마감 10-30 > 장부 10-01) 다시 뽑힌다 · 같은 마감이면 안 뽑힌다 · 사람이 건너뛴 카드(skipped→expired)는 마감이 미뤄져도 안 뽑힌다(담당자 셋에게 다시 안 간다)',
    [pick7.ok.map((c) => c.x.code), pick7.drop.이미준비], [['R'], 2]);

  /* 정리 몸통(expireAndClean)을 임시 폴더에서 실제로 돌린다 — 만료한 A 의 폴더만 사라지고, 올린 D·미래 G·폴더 바깥은 남는다 (리뷰 변이 M4 가 초록이던 자리) */
  {
    const dir = tmp('pub7');
    try {
      const pub = path.join(dir, 'pub');
      for (const c of ['A', 'D', 'G']) { fs.mkdirSync(path.join(pub, c), { recursive: true }); fs.writeFileSync(path.join(pub, c, '1.jpg'), ''); }
      fs.mkdirSync(path.join(dir, 'x')); fs.writeFileSync(path.join(dir, 'x', 'keep'), '');
      const sc = { posted: [{ code: 'D', media: '9' }], prepared: [{ code: 'A', status: 'prepared', due: '2026-10-01' }, { code: 'D', status: 'prepared', due: '2026-10-01' },
        { code: 'G', status: 'prepared', due: '2026-12-31' }, { code: '../x', status: 'prepared', due: '2026-10-01' }] };
      const goneC = PK.expireAndClean(sc, pathToFileURL(pub + '/'), NOW);
      eq('⑦-d expireAndClean — 만료한 A 의 폴더만 지운다 · 올린 D·미래 G 는 남는다 · 폴더 이름으로 못 쓰는 코드(../x)는 장부만 고치고 바깥을 안 건드린다',
        [goneC, ['A', 'D', 'G'].filter((c) => fs.existsSync(path.join(pub, c))), fs.existsSync(path.join(dir, 'x', 'keep')), sc.prepared.map((p) => `${p.code}:${p.status}`)],
        [['A', '../x'], ['D', 'G'], true, ['A:expired', 'D:prepared', 'G:prepared', '../x:expired']]);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  }
  {
    /* 진짜 명령 — ledger.mjs expire 를 상자에서 돌린다(지금 시각 · 마감 2020 은 지났고 2099 는 미래). 폴더가 지워지고 장부가 저장되는가 (변이 M5 — 저장을 빼면 초록이던 자리) */
    const jpg = { 'insta/pub/A/1.jpg': '', 'insta/pub/D/1.jpg': '', 'insta/pub/G/1.jpg': '' };
    const box = sandbox(ROOT_DIR, { ...jpg, 'insta/seen.json': { posted: [{ code: 'D', media: '9' }], prepared: [
      { code: 'A', status: 'prepared', due: '2020-01-01' }, { code: 'D', status: 'posted', due: '2020-01-01' }, { code: 'G', status: 'prepared', due: '2099-12-31' }] } });
    try {
      const r = box.run('insta/ledger.mjs', 'expire');
      const sn = box.seen();
      eq('  명령을 돌려 본다 — ledger.mjs expire 가 A 의 폴더만 지우고 장부에 expired 를 저장한다 · 올린 D·미래 G 는 그대로 · 마지막 줄 expired=1',
        [r.code, ['A', 'D', 'G'].filter((c) => box.has(`insta/pub/${c}/1.jpg`)), sn.prepared.map((p) => `${p.code}:${p.status}`), sn.posted.length, /expired=1\s*$/.test(r.out)],
        [0, ['D', 'G'], ['A:expired', 'D:posted', 'G:prepared'], 1, true]);
    } finally { box.done(); }
  }
  const ps = steps.prepare || [];
  const at = (re) => ps.findIndex((s) => re.test(s.run || ''));
  const expire = byId('prepare', 'expire');
  const upload = ps.find((s) => /upload-artifact/.test(s.uses || '')) || {};
  const commit = byId('prepare', 'commit');
  eqWf('⑦-c insta.yml — 정리가 「무엇을 할지」(pick --new) 보다 먼저 · 보강 단계(continue-on-error·시한) · 올림 파일은 insta/pub 통째가 아니다 · 새 카드가 없어도 정리분을 커밋',
    [at(/ledger\.mjs expire/) >= 0 && at(/ledger\.mjs expire/) < at(/pick\.mjs --new/), expire['continue-on-error'], /timeout-minutes/.test(expire.raw || ''),
      /path:\s*insta\/pub\/?\s*$/m.test(upload.raw || ''), /path:/.test(upload.raw || ''), /steps\.plan\.outputs\.mode != 'none'/.test(commit.if || '')],
    [true, 'true', true, false, true, true]);

  /* ── ⑧ 댓글이 그대로면 쓰지 않는다 ── */
  {
    const keep = process.env.IG_ACCESS_TOKEN;
    let list = [{ id: '9', text: '되나요?', username: 'stu', timestamp: '2026-09-12T01:00:00+0000', like_count: 0, hidden: false, replies: { data: [] } }];
    const f = async (u) => {
      if (/111\/comments/.test(String(u))) return { ok: true, json: async () => ({ data: list }) };
      throw new Error(`뜻밖의 주소 ${u}`);
    };
    let cur = { items: [] }; let writes = 0;
    const store = { read: () => JSON.parse(JSON.stringify(cur)), write: (v) => { writes += 1; cur = JSON.parse(JSON.stringify(v)); }, seen: () => ({ posted: [{ code: 'A', media: '111' }] }) };
    let got;
    try {
      process.env.IG_ACCESS_TOKEN = 'tok-관문';
      await CM.fetchAll(f, store, Date.parse('2026-10-04T01:00:00Z'));
      const second = await CM.fetchAll(f, store, Date.parse('2026-10-04T02:00:00Z'));
      const w2 = writes;
      list = [...list, { id: '10', text: '감사합니다', username: 'b', timestamp: '2026-10-04T01:30:00+0000' }];
      await CM.fetchAll(f, store, Date.parse('2026-10-04T03:00:00Z'));
      got = [w2, !!second.unchanged, writes, cur.items.length, cur.updatedAt];
    } finally { if (keep === undefined) delete process.env.IG_ACCESS_TOKEN; else process.env.IG_ACCESS_TOKEN = keep; }
    eq('⑧-a 같은 댓글로 두 번 받으면 한 번만 쓴다 · 댓글이 늘면 다시 쓴다(updatedAt = 마지막으로 바뀐 시각)',
      got, [1, true, 2, 2, '2026-10-04T03:00:00.000Z']);
  }

  /* ── ⑨ 「이 기기에서 배포」 가 인스타 수정본 알림까지 깨운다 ── */
  const dd = read(root, '.github/workflows/device-deploy.yml');
  const opt = ((/options: \[([^\]]*)\]/.exec(wf) || ['', ''])[1].split(',').map((x) => x.trim()).find((x) => x.startsWith('알림'))) || '(insta.yml 에 알림 선택지 없음)';
  const ns = stepsOf(dd).find((s) => /gh workflow run insta\.yml/.test(s.run || '')) || {};
  eqWf('⑨-a device-deploy — actions: write · 배포가 끝났을 때만 · 보강 단계 · step 글자가 insta.yml 「알림」 선택지와 한 글자도 같다 · 코드 꼴 검사',
    [/^ {2}actions: write\b/m.test(dd), /state == 'deployed'/.test(ns.if || ''), ns['continue-on-error'], ((/-f step='([^']*)'/.exec(ns.run || '') || [])[1]) === opt, /\^\[A-Za-z0-9_-\]\+\$/.test(ns.run || '')],
    [true, true, 'true', true, true]);
  const fakeGit = (diff, notify) => `git() { case "$1" in diff) printf '%s' ${JSON.stringify(diff)};; show) printf '%b\\n' ${JSON.stringify(notify)};; *) :;; esac; }`;
  const wakeRaw = (diff, notify, before = 'abc') => runStep(ns.run || 'exit 9', { BEFORE: before, BASE: 'claude/nice-heisenberg-WESq5' }, fakeGit(diff, notify));
  const wake = (diff, notify) => wakeRaw(diff, notify).split('\n').filter((l) => l.startsWith('GH')).join('');
  eqWf('  셸을 돌려 본다 — 표식이 바뀌고 코드가 맞으면 insta.yml 을 알림·그 코드로 깨운다 · 안 바뀜·빈 코드·이상한 코드는 안 깨운다 · 배포됐는데 합치기 전 위치(before)가 비면 조용히 넘기지 않고 실패(아래 🚨 이슈)',
    [wake('insta/run-notify.txt', 'code: 2704055001\nat: x'), wake('', 'code: 2704055001'), wake('insta/run-notify.txt', 'code:\nat: x'), wake('insta/run-notify.txt', 'code: ../x'),
      /셸 종료 1/.test(wakeRaw('insta/run-notify.txt', 'code: 2704055001', ''))],
    [`GH [workflow] [run] [insta.yml] [--repo] [gate/none] [--ref] [claude/nice-heisenberg-WESq5] [-f] [step=${opt}] [-f] [code=2704055001]`, '', '', '', true]);
  /* 깨우기는 run 단계가 **합치기 전에** 남긴 before= 에 기댄다 — 합친 뒤에 남기면 diff 가 늘 비어 알림이 조용히 안 간다(리뷰 변이 M6 이 초록이던 자리) */
  const runSt = stepsOf(dd).find((s) => s.id === 'run') || {};
  const rr = codeOf(runSt.run || '');
  const beforeAt = rr.search(/echo "before=\$\(git rev-parse "origin\/\$BASE"\)" >> "\$GITHUB_OUTPUT"/);
  const mergeAt = rr.search(/git merge /);
  eqWf('  run 단계(id run)가 before= 를 첫 git merge 보다 **앞에** 남긴다 · 깨우기 단계가 그 값(steps.run.outputs.before)을 받는다',
    [beforeAt >= 0, mergeAt >= 0 && beforeAt >= 0 && beforeAt < mergeAt, /BEFORE: \$\{\{ steps\.run\.outputs\.before \}\}/.test(ns.raw || '')], [true, true, true]);
  eqWf('  깨우기가 넘어지면 따로 이슈(배포 실패로 보이지 않게)',
    stepsOf(dd).some((s) => /instanotify\.outcome == 'failure'/.test(s.if || '') && /alert-issue/.test(s.uses || '')), true);
  eqDoc('  스킬 insta-revise 가 이 길(이 기기에서 배포 → 알림)을 안내한다',
    /알림까지 깨운다/.test(read(root, '.claude/skills/insta-revise/SKILL.md')), true);
}

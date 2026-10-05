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
   🔴 표본(고정 예시)만 잰다 — insta/seen.json·insta/pub·data/ 는 읽지 않는다. 코드·워크플로·판형 파일은 코드라 읽는다.
   🔴 셸 단계를 돌릴 때 진짜 gh·git 을 부르지 않는다(같은 이름의 셸 함수가 먼저 잡히고, 열쇠·집 폴더를 넘기지 않는다). */
import fs from 'node:fs';
import vm from 'node:vm';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { stepsOf } from './ci.mjs';
import { jobsOf, codeOf } from './alerts.mjs';

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
  eq('  게시용 meta.json 에 dates: \'absolute\' 를 적는다(옛 카드와 가르는 표식)', metaAt > 0 && /dates: 'absolute'/.test(rsrc.slice(metaAt, metaAt + 600)), true);

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
  const pubFail = (steps.publish || []).find((s) => s.name === '실패하면 시끄럽게') || {};
  eq('  게시 실패 이슈의 원인 목록에 「마감 지남·옛 D-N 카드 → 게시 거절」 이 있다', /마감이 지난 카드·그림에 「마감 D-N」/.test(pubFail.run || ''), true);

  /* ── ② 올라간 뒤의 실패를 '게시 실패' 라고 하지 않는다 · main push 는 재시도 루프 안에서만 ── */
  eq('②-a 게시 작업에 main push 가 없다(장부는 Pages 가 필요 없다 · #263 거짓 경보의 자리)', /push origin HEAD:main/.test(codeOf(jobs.publish || '')), false);
  const mainOutsideLoop = Object.entries(steps).flatMap(([j, ss]) => ss.filter((s) => /HEAD:main/.test(String(s.run || '').replace(/for i in 1 2 3; do[\s\S]*?\bdone\b/g, ''))).map((s) => `${j}: ${s.name}`));
  const mainInLoop = Object.values(steps).flat().filter((s) => /for i in 1 2 3; do[\s\S]*?HEAD:main[\s\S]*?\bdone\b/.test(s.run || ''));
  eq('②-b HEAD:main 은 모든 단계에서 `for i in 1 2 3` 재시도 루프 안에만 · 준비 커밋에 그 루프가 있다',
    [mainOutsideLoop, mainInLoop.map((s) => s.name)], [[], ['게시용 그림·장부 커밋']]);
  const post = (steps.publish || []).find((s) => s.id === 'post') || {};
  const record = (steps.publish || []).find((s) => s.name === '올린 기록 저장') || {};
  eq('②-c 올리기 단계에 id: post · 기록 저장은 올라갔으면 앞이 넘어져도 돈다 · 실패 알림이 steps.post.outcome 을 본다',
    [/insta\/publish\.mjs[^\n]*--publish/.test(post.run || ''), /always\(\)/.test(record.if || ''), /steps\.post\.outcome == 'success'/.test(record.if || ''),
      /steps\.post\.outcome/.test(pubFail.raw || '')], [true, true, true, true]);
  const failRun = (env) => runStep(pubFail.run || 'exit 9', { CODE: 'C1', ...env });
  const titleOf = (out) => ((/\[--title\] \[([^\]]*)\]/.exec(out) || [])[1] || '(이슈 없음)');
  eq('  실패 알림을 돌려 본다 — 올라갔는데 기록 실패 → 「다시 게시하지 마세요」(주소 포함) · 안 올라감 → 「게시가 실패」 · 둘 다 됨 → 이슈 없음',
    [titleOf(failRun({ POSTED: 'success', RECORDED: 'failure', PERMALINK: 'https://www.instagram.com/p/x/', MEDIA: 'M1' })),
      /instagram\.com\/p\/x/.test(failRun({ POSTED: 'success', RECORDED: 'failure', PERMALINK: 'https://www.instagram.com/p/x/', MEDIA: 'M1' })),
      titleOf(failRun({ POSTED: 'failure', RECORDED: 'skipped' })), titleOf(failRun({ POSTED: 'success', RECORDED: 'success' }))],
    ['⚠️ 인스타에는 올라갔는데 기록 저장만 실패했습니다 — 다시 게시하지 마세요 (C1)', true, '🚨 인스타 게시가 실패했습니다', '(이슈 없음)']);
  /* publish() 가 올린 결과를 GITHUB_OUTPUT 에 남긴다 — 명령줄은 outFile 을 안 넘기므로 기본값(환경변수) 길로 잰다 */
  {
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
      if (/\/M1\?/.test(s)) return ok({ permalink: 'https://www.instagram.com/p/x/' });
      if (/\/c\d+\?/.test(s)) return ok({ status_code: 'FINISHED' });
      throw new Error(`뜻밖의 주소 ${s}`);
    };
    let got;
    try {
      process.env.IG_USER_ID = '77'; process.env.IG_ACCESS_TOKEN = 'tok-관문'; process.env.GITHUB_OUTPUT = out;
      const r = await P.publish({ dir: 'x', images: ['https://i/1.jpg', 'https://i/2.jpg'], caption: 'c', live: true, f,
        waits: { ...P.WAITS, liveGapMs: 0, readyGapMs: 0, pubGapMs: 0 }, tokenStore: { read: () => ({}), write: () => {} }, log: () => {} });
      got = [r && r.mediaId, fs.readFileSync(out, 'utf8')];
    } catch (e) { got = [`넘어짐 ${e.message}`, '']; } finally {
      for (const [k, v] of [['IG_USER_ID', keep.u], ['IG_ACCESS_TOKEN', keep.t], ['GITHUB_OUTPUT', keep.o]]) if (v === undefined) delete process.env[k]; else process.env[k] = v;
      fs.rmSync(path.dirname(out), { recursive: true, force: true });
    }
    eq('②-d 가짜 인스타 한 바퀴 — 올리면 GITHUB_OUTPUT 에 media·permalink 를 남긴다(실패 알림이 「올라갔다」 를 안다)',
      got, ['M1', 'media=M1\npermalink=https://www.instagram.com/p/x/\n']);
  }
  const prepFail = (steps.prepare || []).find((s) => s.name === '실패하면 시끄럽게') || {};
  const bodyOf = (out) => ((/\[--body\] \[([\s\S]*?)\]\n/.exec(out) || [])[1] || '');
  eq('  준비 실패 알림 — 장부가 기본 브랜치에 들어갔으면 「관리자 화면에 있다 · 알림 다시 보내기」, 아니면 「다음 실행이 다시 그린다」',
    [/장부에 준비됨으로/.test(bodyOf(runStep(prepFail.run || 'exit 9', { OK: 'A B', SAVED: 'ok' }))),
      /저장하기 전에 멈췄습니다/.test(bodyOf(runStep(prepFail.run || 'exit 9', { OK: 'A B', SAVED: '' })))], [true, true]);

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
  eq('④-a 워크플로 단위 대기줄 없음 · 대기줄을 셈해 보면 — 같은 공고의 게시·건너뛰기·다시 그리기·알림은 한 줄, 사람이 올린 알림(push)은 push 마다 제 줄(자동 준비에 밀려 취소되지 않게), 자동·예약·버튼 준비만 insta-prepare',
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
      return { code: r.status, posted: (got.posted || []).map((p) => `${p.code}:${p.media || ''}`), prepared: (got.prepared || []).map((p) => `${p.code}:${p.status}`) };
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
  const ga = read(root, '.gitattributes');
  const saving = Object.entries(steps).flatMap(([j, ss]) => ss.filter((s) => /git add[^\n]*insta\/seen\.json/.test(s.run || '')).map((s) => [j, s]));
  eq('④-c .gitattributes 에 insta/seen.json 합집합 · 장부를 저장하는 단계 셋(준비·게시·건너뛰기) 모두 git add 전에 병합 규칙 등록(setup-collab)',
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
  eq('⑦-a expireRows — 마감 지난 준비·건너뜀·실패만 만료 · 올린 것(D·H)·마감 없음·오늘 마감(12:00)·미래는 그대로 · 만료일은 KST',
    [gone, s7.prepared.map((p) => p.status), s7.prepared.find((p) => p.code === 'A').expiredAt],
    [['A', 'B', 'C'], ['expired', 'expired', 'expired', 'prepared', 'prepared', 'prepared', 'prepared', 'posted'], '2026-10-04']);
  const item = (code, due) => ({ code, org: 'o', name: `n${code}`, due, fields: { 지원금액: '100만원' } });
  const exp = { posted: [], prepared: [{ code: 'R', status: 'expired', due: '2026-10-01' }, { code: 'S', status: 'expired', due: '2026-10-01' }] };
  eq('⑦-b 재단이 마감을 미뤘으면(지금 마감 10-30 > 장부 10-01) 다시 뽑힌다 · 같은 마감이면 안 뽑힌다',
    PK.candidates([item('R', '2026-10-30'), item('S', '2026-10-01')], Date.parse('2026-09-20T12:00:00+09:00'), exp, { unpreparedOnly: true }).ok.map((c) => c.x.code), ['R']);
  const ps = steps.prepare || [];
  const at = (re) => ps.findIndex((s) => re.test(s.run || ''));
  const expire = ps.find((s) => /ledger\.mjs expire/.test(s.run || '')) || {};
  const upload = ps.find((s) => /upload-artifact/.test(s.uses || '')) || {};
  const commit = ps.find((s) => s.name === '게시용 그림·장부 커밋') || {};
  eq('⑦-c insta.yml — 정리가 「무엇을 할지」(pick --new) 보다 먼저 · 보강 단계(continue-on-error·시한) · 올림 파일은 insta/pub 통째가 아니다 · 새 카드가 없어도 정리분을 커밋',
    [at(/ledger\.mjs expire/) >= 0 && at(/ledger\.mjs expire/) < at(/pick\.mjs --new/), expire['continue-on-error'], /timeout-minutes/.test(expire.raw || ''),
      /path:\s*insta\/pub\/?\s*$/m.test(upload.raw || ''), /path:/.test(upload.raw || ''), /steps\.plan\.outputs\.mode != 'none'/.test(commit.if || '')],
    [true, 'true', true, false, true, true]);
  const led = read(root, 'insta/ledger.mjs');
  eq('  ledger.mjs expire — 규칙은 pick.mjs expireRows 를 불러 쓰고 · 올린 것의 폴더는 지우지 않는다(두 번 확인)',
    [/import \{[^}]*expireRows[^}]*\} from '\.\/pick\.mjs'/.test(led), /cmd === 'expire'[\s\S]*?posted\.has\(c\)[\s\S]*?rmSync/.test(led)], [true, true]);

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
  eq('⑨-a device-deploy — actions: write · 배포가 끝났을 때만 · 보강 단계 · step 글자가 insta.yml 「알림」 선택지와 한 글자도 같다 · 코드 꼴 검사',
    [/^ {2}actions: write\b/m.test(dd), /state == 'deployed'/.test(ns.if || ''), ns['continue-on-error'], ((/-f step='([^']*)'/.exec(ns.run || '') || [])[1]) === opt, /\^\[A-Za-z0-9_-\]\+\$/.test(ns.run || '')],
    [true, true, 'true', true, true]);
  const fakeGit = (diff, notify) => `git() { case "$1" in diff) printf '%s' ${JSON.stringify(diff)};; show) printf '%b\\n' ${JSON.stringify(notify)};; *) :;; esac; }`;
  const wake = (diff, notify) => runStep(ns.run || 'exit 9', { BEFORE: 'abc', BASE: 'claude/nice-heisenberg-WESq5' }, fakeGit(diff, notify)).split('\n').filter((l) => l.startsWith('GH')).join('');
  eq('  셸을 돌려 본다 — 표식이 바뀌고 코드가 맞으면 insta.yml 을 알림·그 코드로 깨운다 · 안 바뀜·빈 코드·이상한 코드는 안 깨운다',
    [wake('insta/run-notify.txt', 'code: 2704055001\nat: x'), wake('', 'code: 2704055001'), wake('insta/run-notify.txt', 'code:\nat: x'), wake('insta/run-notify.txt', 'code: ../x')],
    [`GH [workflow] [run] [insta.yml] [--repo] [gate/none] [--ref] [claude/nice-heisenberg-WESq5] [-f] [step=${opt}] [-f] [code=2704055001]`, '', '', '']);
  eq('  깨우기가 넘어지면 따로 이슈(배포 실패로 보이지 않게) · 스킬 insta-revise 가 이 길을 안내한다',
    [stepsOf(dd).some((s) => /instanotify\.outcome == 'failure'/.test(s.if || '') && /alert-issue/.test(s.uses || '')), /알림까지 깨운다/.test(read(root, '.claude/skills/insta-revise/SKILL.md'))],
    [true, true]);
}

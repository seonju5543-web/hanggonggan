/* 「로봇·도구 점검 관문」 bodies 묶음 — 자격요건 로봇 · 본문 · 첨부 · OCR (2026-10-04 대대적 점검)
   잰다:
     ① 자격요건 로봇(rescue-bodies.mjs) — **진짜 파일을 임시 폴더에서 가짜 브라우저로 돌린다** (bodies-1·bodies-4)
        ⓐ 대상 거르기·차례: 이레 안에 본문을 확보한 공고 · 마감 지난 공고 · 오래돼 내려간 공고 · 자격 줄 있는 공고는 빠지고,
           덜 해 본 것 → 한 번도 못 받은 것 먼저 (rescue-plan.mjs 순수 함수 + 로봇의 미리보기 '차례' 줄)
        ⓑ 한 공고가 멈춰도(시한) 다음 공고로 간다 · 시한 뒤 늦게 끝난 읽기가 registered.json 을 몰래 바꾸지 않는다 ·
           멈춘 뒤 새 창 · **공고마다 저장**(넷째 공고에서 프로세스가 강제로 죽어도 앞 세 공고의 장부·본문이 남는다) ·
           본문 확보는 장부에서 지우지 않고 날짜를 적는다
        ⓒ 워크플로(rescue-bodies.yml): 재수집 단계가 끝까지 못 가면 작업을 실패로(bodies-2) · 실패 알림은 오늘 리포트만 붙이고
           실행 로그 주소를 단다 · 성공하면 옛 실패 이슈를 닫는다(bodies-7) · 관문에 걸려 되돌릴 때 장부도 되돌린다(bodies-12 ③)
   🔴 표본(고정 예시)만 잰다 — data/·collector/ 장부를 읽어 단정하지 말 것(verify/health-gates.mjs 머리말).
      로봇을 돌릴 때는 저장소 파일을 임시 폴더로 **복사**해 그 안에서만 돌린다(진짜 장부·데이터를 건드리지 않는다). */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { cleanEnv, stripYamlComments } from './gate.mjs';
import { canonUrl } from '../../collector/canon-url.mjs';
import { restingAfterOk, closedForStudents, orderTargets, ledgerEntry, newAttachments } from '../../collector/rescue-plan.mjs';
import { slugOf, attSig, missWait, pickEligDocTargets } from '../../collector/elig-attach-plan.mjs';
import { fillRetired, nextShells } from '../../collector/notice-source.mjs';

const kstToday = () => new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
const shift = (day, n) => new Date(Date.parse(day) + n * 86400000).toISOString().slice(0, 10);

/* 저장소 코드를 임시 폴더로 복사한다 — 로봇은 제 자리(import.meta.url) 기준으로 ../data·장부를 읽고 쓰므로,
   복사본을 돌리면 임시 폴더의 표본만 읽고 쓴다. 가짜 모듈(playwright 등)은 node_modules 에 둔다. */
export function sandbox(root, prefix = 'hdj-bodies-') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  const src = fileURLToPath(root);
  fs.mkdirSync(path.join(dir, 'collector', 'extracted'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'data'), { recursive: true });
  for (const f of fs.readdirSync(path.join(src, 'collector'))) {
    if (/\.(mjs|cjs|js|py)$/.test(f)) fs.copyFileSync(path.join(src, 'collector', f), path.join(dir, 'collector', f));
  }
  for (const f of fs.readdirSync(src)) if (/\.(js|cjs)$/.test(f)) fs.copyFileSync(path.join(src, f), path.join(dir, f));
  const abs = (rel) => path.join(dir, rel);
  return {
    dir, abs,
    write(rel, body) {
      fs.mkdirSync(path.dirname(abs(rel)), { recursive: true });
      fs.writeFileSync(abs(rel), (typeof body === 'string' || Buffer.isBuffer(body)) ? body : `${JSON.stringify(body, null, 1)}\n`);
    },
    read(rel) { try { return fs.readFileSync(abs(rel), 'utf8'); } catch { return null; } },
    json(rel) { try { return JSON.parse(fs.readFileSync(abs(rel), 'utf8')); } catch { return null; } },
    exists: (rel) => fs.existsSync(abs(rel)),
    module(name, files) {
      for (const [f, body] of Object.entries(files)) this.write(`node_modules/${name}/${f}`, body);
    },
    run(script, args = [], env = {}, timeout = 25000, nodeArgs = []) {
      const r = spawnSync(process.execPath, [...nodeArgs, abs(script), ...args],
        { cwd: dir, encoding: 'utf8', timeout, env: cleanEnv(env) });
      return { status: r.status, signal: r.signal, out: `${r.stdout || ''}${r.stderr || ''}` };
    },
    done: () => fs.rmSync(dir, { recursive: true, force: true }),
  };
}

/* 가짜 브라우저 — 주소에 든 낱말로 행동이 갈린다.
     hang-forever : 본문 읽기가 영영 안 끝난다(닫기도 안 끝난다)
     hang-late    : 본문 읽기가 FAKE_LATE_MS 뒤에야 끝나고, 공고문 첨부 하나를 내놓는다(시한 뒤 늦게 끝나는 읽기)
     kill         : 여는 순간 프로세스를 강제로 죽인다(단계 시한의 강제 종료 흉내 — 신호 처리기가 못 돈다)
     그 밖        : 바로 열리고 본문을 준다
   부른 일은 FAKE_PW_LOG 파일에 한 줄씩 남긴다(새 창을 몇 번 열었나). */
const FAKE_PLAYWRIGHT = `import fs from 'node:fs';
const note = (m) => { if (process.env.FAKE_PW_LOG) fs.appendFileSync(process.env.FAKE_PW_LOG, m + '\\n'); };
const never = () => new Promise(() => {});
const later = (ms, v) => new Promise((r) => setTimeout(() => r(v), ms));
const BODY = ['2026학년도 2학기 표본재단 장학생 선발 안내',
  '지원 대상은 국내 대학에 재학 중인 학부생으로서 직전 학기 성적이 평균 이상인 학생입니다.',
  '선발된 학생에게는 한 학기 등록금 전액과 생활비를 함께 지원하며 학업 계획서를 심사합니다.',
  '신청 서류는 재단 누리집에서 내려받아 작성한 뒤 기한 안에 전자우편으로 제출하시기 바랍니다.',
  '문의 사항은 재단 사무국으로 연락 주시면 친절하게 안내해 드리겠습니다.'].join('\\n');
function makePage() {
  let url = 'about:blank';
  const kind = () => (/hang-forever/.test(url) ? 'forever' : /hang-late/.test(url) ? 'late' : /kill/.test(url) ? 'kill' : 'ok');
  const frame = {
    locator: () => ({ innerText: () => (kind() === 'forever' ? never() : kind() === 'late' ? later(Number(process.env.FAKE_LATE_MS || 450), BODY) : Promise.resolve(BODY)) }),
    $$eval: (sel) => Promise.resolve(sel === 'a[href]' && kind() === 'late' ? [{ name: '2026 표본 장학생 선발 공고문.hwp', url: 'https://fake.example/f.hwp' }] : []),
  };
  return {
    goto: async (u) => { url = u; note('goto ' + u); if (kind() === 'kill') process.kill(process.pid, 'SIGKILL'); },
    waitForTimeout: () => Promise.resolve(),
    url: () => url,
    locator: () => ({ first: () => ({ count: async () => 0, evaluate: async () => {} }) }),
    frames: () => [frame],
    close: () => (kind() === 'ok' ? Promise.resolve() : never()),
  };
}
function makeContext() { note('newContext'); return { newPage: async () => makePage(), close: async () => { note('ctx.close'); } }; }
export const chromium = {
  launch: async () => { note('launch'); return { newContext: async () => makeContext(), isConnected: () => true, close: async () => { note('browser.close'); } }; },
};
`;

export default async function bodies(eq, ctx) {
  const root = ctx.root;
  const readText = (rel) => fs.readFileSync(new URL(rel, root), 'utf8');

  /* ── ① ⓐ 대상 거르기·차례 — 순수 함수 ── */
  {
    const today = '2026-10-04';
    const now = new Date('2026-10-04T03:00:00Z');
    eq('① ⓐ 이레 안에 본문을 확보한 공고는 쉰다 · 여드레면 다시 · 확보 기록 없으면 안 쉰다',
      [restingAfterOk({ ok: '2026-10-01' }, today), restingAfterOk({ ok: '2026-09-26' }, today), restingAfterOk({ tries: 2, at: '2026-10-03' }, today), restingAfterOk(undefined, today)],
      [true, false, false, false]);
    eq('  마감 지난 공고 · 마감 없이 등록 70일 지난 공고는 학생 화면에 없다 · 마감 오늘·마감도 등록일도 없는 공고는 있다',
      [closedForStudents({ deadline: '2026-10-03' }, today, now), closedForStudents({ listedAt: shift(today, -70) }, today, now),
        closedForStudents({ deadline: '2026-10-04' }, today, now), closedForStudents({}, today, now)],
      [true, true, false, false]);
    eq('  차례 — 덜 해 본 것 → 같으면 한 번도 본문을 못 받은 것 → 등록 순서',
      orderTargets([{ id: 'b', tries: 0, everOk: true }, { id: 'g', tries: 1 }, { id: 'e', tries: 0, everOk: false }, { id: 'h', tries: 0 }]).map((t) => t.id),
      ['e', 'h', 'b', 'g']);
    eq('  장부 한 칸 — 확보는 날짜(지우지 않는다) · 시한 초과·본문 없음은 한 번 센다 · 마지막 확보 날짜는 이어 둔다',
      [ledgerEntry({ tries: 2 }, 'ok', { today, minBody: 100, name: 'n' }), ledgerEntry({ tries: 1, ok: '2026-09-01' }, 'hung', { today, minBody: 100, name: 'n' }),
        ledgerEntry(undefined, 'miss', { today, minBody: 100, name: 'n' })],
      [{ ok: today, at: today, tries: 0, name: 'n' }, { tries: 2, at: today, minBody: 100, hung: true, name: 'n', ok: '2026-09-01' },
        { tries: 1, at: today, minBody: 100, name: 'n' }]);
    eq('  첨부 합치기 — 번호·미리보기 꼬리를 뗀 이름이 같으면 같은 첨부',
      newAttachments([{ name: '공고문.hwp' }], [{ name: '1. 공고문.hwp 미리보기' }, { name: '신청서.hwp' }, { name: '신청서.hwp' }]).map((a) => a.name), ['신청서.hwp']);
  }

  /* ── ① 진짜 로봇을 임시 폴더에서 ── */
  const sb = sandbox(root);
  try {
    sb.module('playwright', { 'package.json': '{"name":"playwright","type":"module","main":"index.js"}', 'index.js': FAKE_PLAYWRIGHT });
    sb.write('collector/extracted/notices-text.json', []);
    const today = kstToday();
    const u = (k) => `https://fake.example/${k}?id=${k.length}`;
    const item = (id, k, extra = {}) => ({ id, name: `표본 ${id} 장학생 선발 안내 공고`, sourceUrl: u(k), attachments: [], listedAt: today, ...extra });

    /* ⓐ 미리보기의 '차례' 줄 — 로봇 안의 pickTargets 가 rescue-plan 규칙을 쓰는가 */
    sb.write('data/registered.json', { items: [
      item('A', 'a-ok-recent'), item('B', 'b-ok-old'), item('C', 'c-closed', { deadline: shift(today, -1) }),
      item('D', 'd-stale', { listedAt: shift(today, -70) }), item('E', 'e-new'),
      item('F', 'f-has-lines', { eligibilityLines: ['직전학기 평점평균 3.0 이상인 재학생'] }), item('G', 'g-tried'),
    ] });
    sb.write('collector/rescue-ledger.json', {
      [canonUrl(u('a-ok-recent'))]: { ok: shift(today, -3), at: shift(today, -3), tries: 0 },
      [canonUrl(u('b-ok-old'))]: { ok: shift(today, -8), at: shift(today, -8), tries: 0 },
      [canonUrl(u('g-tried'))]: { tries: 1, at: shift(today, -1), minBody: 100 },
    });
    const pre = sb.run('collector/rescue-bodies.mjs', [], {});
    eq('① ⓐ 로봇 미리보기의 차례 — 새 공고(E) → 확보한 지 여드레(B) → 한 번 실패(G) · 이레 안 확보(A)·마감 지남(C)·오래됨(D)·자격 줄 있음(F)은 없다',
      [pre.status, (pre.out.match(/차례: ([^\n]*)/) || [])[1] || pre.out.slice(-300)], [0, 'E · B · G']);

    /* ⓑ 쓰기 — 늦게 끝나는 공고 · 영영 멈춘 공고 둘 · 열리는 공고 · 여는 순간 강제 종료 */
    const reg = { items: [item('late', 'hang-late'), item('fa', 'hang-forever-a'), item('fb', 'hang-forever-b'), item('ok', 'ok-page'), item('kill', 'kill-page')] };
    sb.write('data/registered.json', reg);
    sb.write('collector/rescue-ledger.json', {});
    const log = sb.abs('fake-pw.log');
    const w = sb.run('collector/rescue-bodies.mjs', ['--write'],
      { FAKE_PW_LOG: log, RESCUE_NOTICE_MS: '300', RESCUE_GAP_MS: '300', FAKE_LATE_MS: '450', RESCUE_BUDGET_MS: '120000', RESCUE_CAP: '10' }, 25000);
    const led = sb.json('collector/rescue-ledger.json') || {};
    const L = (k) => led[canonUrl(u(k))] || null;
    const regNow = sb.json('data/registered.json') || { items: [] };
    const lateNow = regNow.items.find((x) => x.id === 'late') || {};
    const bodiesNow = sb.json('collector/extracted/browser-bodies.json') || {};
    const reportNow = sb.read('collector/rescue-report.md') || '';
    const pw = (sb.read('fake-pw.log') || '').split('\n');
    eq('① ⓑ 넷째·다섯째 사이에서 강제로 죽어도(단계 시한 흉내) 앞 공고들의 장부가 남는다 — 공고마다 저장',
      [w.signal, !!L('hang-late'), !!L('hang-forever-a'), !!L('hang-forever-b'), !!L('ok-page'), !!L('kill-page')],
      ['SIGKILL', true, true, true, true, false]);
    eq('  멈춘 공고(늦게 끝남·영영 멈춤)는 시한 초과로 한 번 세고 다음으로 간다',
      [L('hang-late'), L('hang-forever-a')].map((x) => x && [x.hung, x.tries]), [[true, 1], [true, 1]]);
    eq('  🔴 시한 뒤 늦게 끝난 읽기가 찾은 첨부는 등록 항목에 붙지 않는다 (registered.json 을 몰래 바꾸지 않는다)',
      (lateNow.attachments || []).map((a) => a.name), []);
    eq('  열리는 공고는 본문을 저장하고 장부에서 지우지 않고 확보 날짜를 적는다',
      [!!bodiesNow[u('ok-page')], L('ok-page') && L('ok-page').ok, L('ok-page') && L('ok-page').tries], [true, today, 0]);
    eq('  멈출 때마다 새 창으로 — 새 창 4번(처음 1 + 멈춤 3) · 리포트에 시한 초과 3줄과 진행 중 꼬리',
      [pw.filter((l) => l === 'newContext').length, (reportNow.match(/^- ⏱ /gm) || []).length, /\(진행 중 4\/5/.test(reportNow)],
      [4, 3, true]);
    eq('  공고를 시작할 때 ▶ 줄을 찍는다(멈춘 자리를 로그로 안다)', /▶ 1\/5 /.test(w.out) && /▶ 4\/5 /.test(w.out), true);
  } finally {
    sb.done();
  }

  /* ── ① 글자 검사 — 루프 구조 ── */
  {
    const rb = readText('collector/rescue-bodies.mjs');
    const loop = rb.slice(rb.indexOf('for (const t of targets) {'));
    eq('① 예산은 공고를 시작하기 전에 \'공고 하나 최악이 들어갈 자리\'로 본다 · 끝의 브라우저 닫기도 시한 안에서',
      [/budget\.hasRoom\(PAGE_MS \+ \d+\)/.test(loop), /await settle\(browser\.close\(\), \d+\)/.test(loop)], [true, true]);
  }

  /* ── ① ⓒ 워크플로 ── */
  {
    const wf = stripYamlComments(readText('.github/workflows/rescue-bodies.yml'));
    const iSave = wf.indexOf('- name: 저장');
    const iAlert = wf.indexOf('- name: 실패하면 이슈로 알린다');
    const fail = wf.slice(iSave, iAlert);
    eq('① ⓒ 재수집 단계가 끝까지 못 가면(시한·넘어짐) 저장 뒤 작업을 실패로 — 알림·하트비트가 성공으로 세지 않게 (bodies-2)',
      [iSave > 0 && iAlert > iSave, /if: steps\.rescue\.outcome != 'success'[\s\S]*?exit 1/.test(fail)], [true, true]);
    const alert = wf.slice(iAlert, wf.indexOf('- name:', iAlert + 10) > 0 ? wf.indexOf('- name:', iAlert + 10) : undefined);
    eq('  실패 알림은 오늘 리포트만 붙이고(옛 판이면 끊겼다고 적는다) 실행 로그 주소를 단다 (bodies-7)',
      [/실행: /.test(alert) && /Asia\/Seoul|9 \* 3600000/.test(alert), /const runUrl = `[^`]*context\.runId/.test(alert) && /body: \[[^\]]*\$\{runUrl\}/.test(alert)], [true, true]);
    const iClose = wf.indexOf('- name: 성공하면 옛 실패 이슈를 닫는다');
    const close = iClose > 0 ? wf.slice(iClose) : '';
    eq('  성공한 실행은 rescue-bodies 라벨의 열린 이슈를 닫는다 — 성공일 때만 · 알림 뒤 (bodies-7)',
      [iClose > iAlert, /if: success\(\)/.test(close), /labels: 'rescue-bodies'/.test(close) && /state: 'closed'/.test(close), /continue-on-error: true/.test(close)],
      [true, true, true, true]);
    const revert = (wf.match(/- name: 관문에 걸리면 되돌린다[\s\S]*?exit 1/) || [''])[0];
    eq('  관문에 걸려 되돌릴 때 장부(rescue-ledger.json)도 되돌린다 — 본문은 되돌려지고 확보 기록만 남으면 이레 동안 아무도 안 연다 (bodies-12 ③)',
      /git checkout -- [^\n]*collector\/rescue-ledger\.json/.test(revert), true);
  }

  /* ── ② PaddleOCR 엔진 고장을 소리 내고 기회를 되돌린다 (gaps-02) ──
     ⓐ paddle-ocr.py 를 가짜 paddleocr·PIL 로 진짜 돌린다: 모든 그림이 같은 오류 → 종료 코드 2 + ::warning:: + 상태 파일 ·
        잘 읽으면 0 · 설치가 안 돼 불러오지도 못하면 그것도 엔진 고장
     ⓑ activity-docs: 장부 판이 바뀌면 자격 못 찾은 칸을 한 번 비운다(migrateOcrTries) · OCR 실패 파일 때문에 못 읽은 글은 기회를 되돌린다(rollbackOcrTries)
        · --apply 를 임시 폴더에서 진짜 돌려 무료 모드 장부(act-docs.json)에 되돌림이 저장되고 같은 결과로 두 번 되돌리지 않는다
     ⓒ 두 워크플로가 실패를 `|| true` 로 삼키지 않는다(설치·읽기 둘 다 ::warning::) */
  {
    const probe = spawnSync('python3', ['-c', 'print("PYOK")'], { encoding: 'utf8' });
    if (!(probe.status === 0 && /PYOK/.test(probe.stdout || ''))) {
      console.log('  … ② ⓐ PaddleOCR 행동 검사 건너뜀 — 이 컴퓨터에 파이썬이 없다(윈도우의 python3 는 스토어 껍데기). 클라우드 로봇에서는 실제로 돈다.');
    } else {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hdj-paddle-'));
      try {
        const files = path.join(dir, 'files'); const fakes = path.join(dir, 'fakes');
        fs.mkdirSync(files); fs.mkdirSync(path.join(fakes, 'PIL'), { recursive: true });
        fs.writeFileSync(path.join(fakes, 'paddleocr.py'), [
          'import os', "mode = os.environ.get('FAKE_PADDLE', 'ok')",
          "if mode == 'noimport':", "    raise ImportError('fake: paddleocr 설치 안 됨')",
          'class PaddleOCR:', '    def __init__(self, **kw):', '        pass', '    def predict(self, p):',
          "        if mode == 'broken':", "            raise RuntimeError('(Unimplemented) ConvertPirAttribute2RuntimeAttribute not support [pir::ArrayAttribute<pir::DoubleAttribute>]')",
          "        return [{'rec_texts': ['모집대상 : 도내 거주 청년'], 'rec_scores': [0.95], 'rec_boxes': [[0, 0, 200, 20]]}]", ''].join('\n'));
        fs.writeFileSync(path.join(fakes, 'PIL', '__init__.py'), '');
        fs.writeFileSync(path.join(fakes, 'PIL', 'Image.py'), [
          'import builtins', 'class _Im:', '    def convert(self, m):', '        return self', '    def thumbnail(self, s):', '        pass',
          '    def save(self, p, quality=None):', "        builtins.open(p, 'wb').write(b'x')", 'def open(p):', '    return _Im()', ''].join('\n'));
        for (const f of ['a.jpg', 'b.png']) fs.writeFileSync(path.join(files, f), 'x');
        const script = fileURLToPath(new URL('collector/paddle-ocr.py', root));
        const runPy = (mode) => spawnSync('python3', [script, files, '--budget-sec=30'],
          { encoding: 'utf8', env: cleanEnv({ PYTHONPATH: fakes, PYTHONDONTWRITEBYTECODE: '1', FAKE_PADDLE: mode }) });
        const status = () => { try { return JSON.parse(fs.readFileSync(path.join(files, 'paddle-status.json'), 'utf8')); } catch { return null; } };
        const r1 = runPy('broken'); const s1 = status() || {};
        eq('② ⓐ 모든 그림이 같은 엔진 오류 — 종료 코드 2 · ::warning:: 한 줄 · 상태 파일에 고장 표시와 실패 파일 (예전엔 \'끝 — 0장\' 에 초록불)',
          [r1.status, /::warning::PaddleOCR 엔진 오류 — 2개 모두 실패: \(Unimplemented\) ConvertPir/.test(r1.stdout || ''), s1.engineFailed, s1.failed], [2, true, true, ['a.jpg', 'b.png']]);
        const r2 = runPy('ok'); const s2 = status() || {};
        eq('  잘 읽으면 종료 코드 0 · 고장 표시 없음 · 그림마다 .ocr.txt',
          [r2.status, s2.engineFailed, s2.ok, fs.existsSync(path.join(files, 'a.jpg.ocr.txt'))], [0, false, ['a.jpg', 'b.png'], true]);
        for (const f of ['a.jpg', 'b.png']) fs.rmSync(path.join(files, `${f}.ocr.txt`));
        const r3 = runPy('noimport'); const s3 = status() || {};
        eq('  설치가 안 돼 불러오지도 못하면 그것도 엔진 고장(종료 코드 2 · 읽을 그림 전부 실패로)',
          [r3.status, s3.engineFailed, s3.failed, /ImportError/.test(s3.error || '')], [2, true, ['a.jpg', 'b.png'], true]);
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    }
  }
  const prevLib = process.env.ACTIVITY_DOCS_AS_LIB;
  process.env.ACTIVITY_DOCS_AS_LIB = '1';   // 본편이 돌지 않게(불러오는 순간 data/activities.json 을 고친다)
  const AD = await import('../../collector/activity-docs.mjs');
  if (prevLib === undefined) delete process.env.ACTIVITY_DOCS_AS_LIB; else process.env.ACTIVITY_DOCS_AS_LIB = prevLib;
  {
    const led = { 'https://a': { at: '2026-10-03', tries: 1 }, 'https://b': { at: '2026-10-03', tries: 1, lines: ['x'] }, _common: ['h'] };
    const n1 = AD.migrateOcrTries(led);
    const snap = JSON.stringify(led);
    const n2 = AD.migrateOcrTries(led);
    eq('② ⓑ 장부 판이 바뀌면 자격 못 찾은 칸만 한 번 비운다 — 찾은 칸·공통 그림은 남는다 · 판을 적어 두 번째는 그대로',
      [n1, 'https://a' in led, !!led['https://b'], led._common, typeof led._ocrV, n2, JSON.stringify(led) === snap], [1, false, true, ['h'], 'string', 0, true]);
    const L2 = { u1: { at: '2026-10-04', tries: 1 }, u2: { at: '2026-10-04', tries: 1 }, u3: { at: '2026-10-04', tries: 1 }, u4: { at: '2026-10-04', tries: 0 } };
    const back = AD.rollbackOcrTries(L2, { u1: ['k1-0i.jpg'], u2: ['k2-0i.jpg'], u3: ['k3-1.hwp'], u4: ['k4-0i.jpg'] },
      { failed: ['k1-0i.jpg', 'k2-0i.jpg', 'k4-0i.jpg'] }, new Set(['u2']));
    eq('  OCR 이 실패한 파일 때문에 자격을 못 찾은 글만 기회를 되돌린다 — 자격을 찾은 글·실패 파일이 없는 글은 그대로 · 0 아래로 안 간다 · 날짜는 그대로',
      [back, L2.u1.tries, L2.u2.tries, L2.u3.tries, L2.u4.tries, L2.u1.at], [['u1'], 0, 1, 1, 0, '2026-10-04']);
  }
  {
    const sb2 = sandbox(root, 'hdj-actdocs-');
    try {
      const u1 = 'https://act.example/post/1'; const u2 = 'https://act.example/post/2';
      const k = (u) => u.split('/').pop();
      /* 발췌 규칙 파일(extract-excerpts.mjs)이 불러오는 순간 이 둘을 읽는다 — 빈 표본 */
      sb2.write('collector/extracted/notices-text.json', []);
      sb2.write('data/registered.json', { items: [] });
      sb2.write('data/activities.json', { items: [
        { title: '청년 체인지메이커 아카데미 운영', url: u1 }, { title: '청년 체인지메이커 아카데미 2기 운영', url: u2 }] });
      sb2.write('collector/act-files/manifest.json', { [u1]: [`p${k(u1)}-0.jpg`], [u2]: [`p${k(u2)}-0.jpg`] });
      sb2.write(`collector/act-files/p${k(u2)}-0.jpg`, 'x');
      sb2.write(`collector/act-files/p${k(u2)}-0.jpg.ocr.txt`, '청년 체인지메이커 아카데미\n모집대상 : 도내 거주 청년 누구나\n');
      sb2.write(`collector/act-files/p${k(u1)}-0.jpg`, 'x');
      sb2.write('collector/act-files/paddle-status.json', { engineFailed: false, ok: [`p${k(u2)}-0.jpg`], failed: [`p${k(u1)}-0.jpg`], error: 'x' });
      sb2.write('collector/act-docs.json', { [u1]: { at: '2026-10-04', tries: 2 }, [u2]: { at: '2026-10-04', tries: 1 }, _ocrV: 'x' });
      const a1 = sb2.run('collector/activity-docs.mjs', ['--apply'], {});
      const after1 = sb2.json('collector/act-docs.json') || {};
      const a2 = sb2.run('collector/activity-docs.mjs', ['--apply'], {});
      const after2 = sb2.json('collector/act-docs.json') || {};
      const acts = sb2.json('data/activities.json') || { items: [] };
      eq('  --apply 를 진짜 돌리면 — OCR 실패 글(1)의 기회가 무료 장부에 되돌려 저장되고(2→1), 자격을 찾은 글(2)은 그대로 · 상태에 적용 표시 · 두 번째 실행은 또 안 되돌린다',
        [a1.status, after1[u1] && after1[u1].tries, after1[u2] && after1[u2].tries, (sb2.json('collector/act-files/paddle-status.json') || {}).applied,
          a2.status, after2[u1] && after2[u1].tries, (acts.items[1].eligibilityLines || []).length > 0],
        [0, 1, 1, true, 0, 1, true]);
      /* 받기(--fetch) 단계의 '피드에서 빠진 글은 장부에서 뺀다'가 판 표시(_ocrV)를 지우면 다음 실행이 또 판이 바뀐 줄 알고 장부를 통째로 비운다 —
         자격이 다 있는 표본이라 아무것도 받지 않는다(망 없이 돈다) */
      const cur = {}; AD.migrateOcrTries(cur);
      sb2.write('data/activities.json', { items: [{ title: '표본', url: u1, eligibilityLines: ['대학생'] }] });
      sb2.write('collector/act-docs.json', { [u1]: { at: '2026-10-04', tries: 1 }, 'https://gone.example/x': { at: '2026-10-01', tries: 1 }, _common: ['h'], _ocrV: cur._ocrV });
      const f1 = sb2.run('collector/activity-docs.mjs', ['--fetch'], {});
      const afterF = sb2.json('collector/act-docs.json') || {};
      eq('  받기 단계 — 피드에서 빠진 글 칸은 지우고 · 판 표시·공통 그림 칸은 남긴다 · 같은 판이면 장부를 비우지 않는다',
        [f1.status, 'https://gone.example/x' in afterF, afterF._ocrV === cur._ocrV, !!afterF._common, !!afterF[u1]], [0, false, true, true, true]);
    } finally {
      sb2.done();
    }
  }
  {
    for (const f of ['collect-scholarships.yml', 'rescue-bodies.yml']) {
      const y = stripYamlComments(readText(`.github/workflows/${f}`));
      eq(`② ⓒ ${f} — PaddleOCR 설치·읽기 실패를 \`|| true\` 로 삼키지 않는다(경고를 남기고, 같은 단계의 --apply 는 계속)`,
        [/pip install[^\n]*paddleocr==[\d.]+[^\n]*\|\| true/.test(y), /pip install[^\n]*paddleocr==[\d.]+ \|\| echo "::warning::/.test(y),
          /paddle-ocr\.py[^\n]*\|\| true/.test(y), /paddle-ocr\.py collector\/act-files --budget-sec=\d+ \|\| echo "::warning::/.test(y)],
        [false, true, false, true]);
    }
  }
  /* ── ③ 자격용 공고문 첨부 받기(deepfetch --elig-attach) — 받은 그대로인 공고는 다시 안 받는다 · 파생 글자 보존 (bodies-3·bodies-5) ── */
  {
    const today = '2026-10-04';
    const now = new Date('2026-10-04T03:00:00Z');
    const att = (n) => [{ name: `2026 장학생 선발 공고문 ${n}.hwp`, url: `https://f.example/${n}.hwp` }];
    const items = [];
    const index = {};
    const onDisk = new Set();
    for (let i = 1; i <= 6; i++) {   // 1~6 은 받은 그대로 — 색인·파일 있음 · 서명 같음
      items.push({ id: `n${i}`, name: `공고 ${i}`, attachments: att(i), listedAt: today });
      index[`n${i}`] = { slug: slugOf(`공고 ${i}`), files: [`elig-${i}.hwp`], sig: attSig(att(i)) };
      onDisk.add(`elig-${i}.hwp`);
    }
    items.push({ id: 'n7', name: '공고 7', attachments: att(7), listedAt: today });                     // 처음
    items.push({ id: 'n8', name: '공고 8', attachments: att(8), listedAt: today });                     // 처음
    items.push({ id: 'n9', name: '공고 9', attachments: att(9), deadline: '2026-10-03' });             // 마감 어제
    items.push({ id: 'n10', name: '공고 10', attachments: att('10-새판'), listedAt: today });            // 첨부 이름이 바뀜
    index.n10 = { slug: slugOf('공고 10'), files: ['elig-10.hwp'], sig: attSig(att(10)) }; onDisk.add('elig-10.hwp');
    items.push({ id: 'n11', name: '공고 11', attachments: att(11), listedAt: today });                   // 서명 칸 없는 옛 색인
    index.n11 = { slug: slugOf('공고 11'), files: ['elig-11.hwp'] }; onDisk.add('elig-11.hwp');
    items.push({ id: 'n12', name: '공고 12', attachments: att(12), listedAt: today });                   // 오늘 하나도 못 받음 — 쉰다
    index.n12 = { slug: slugOf('공고 12'), files: [], tried: { sig: attSig(att(12)), at: today, miss: 1 } };
    items.push({ id: 'n13', name: '공고 13', attachments: att(13), listedAt: today });                   // 사흘 전 못 받음 — 다시
    index.n13 = { slug: slugOf('공고 13'), files: [], tried: { sig: attSig(att(13)), at: '2026-10-01', miss: 1 } };
    items.push({ id: 'n14', name: '공고 14', attachments: att(14), listedAt: today, eligibilityLines: ['직전학기 평점평균 3.0 이상인 재학생'] });
    const RL = (it) => it.eligibilityLines || [];
    const plan = pickEligDocTargets(items, index, { today, now, fileExists: (f) => onDisk.has(f), requirementLines: RL, pickAtts: (it) => it.attachments, max: 6 });
    eq('③ 받을 차례 — 처음 받는 것(7·8·13) → 첨부가 바뀐 것(10) · 받은 그대로(1~6)·마감 지남(9)·오늘 못 받아 쉬는 것(12)·자격 있는 것(14)은 없다',
      plan.targets.map((t) => t.it.id), ['n7', 'n8', 'n13', 'n10']);
    eq('  서명 칸 없는 옛 색인(11)은 다시 받지 않고 서명만 채운다 · 받은 그대로 센 수', [plan.sigOnly.map((s) => s.id), plan.kept], [['n11'], 7]);
    eq('  하나도 못 받은 공고의 쉼 — 1·2·4·8·14일', [1, 2, 3, 4, 5, 9].map((m) => missWait(m)), [1, 2, 4, 8, 14, 14]);
  }
  {
    const sb3 = sandbox(root, 'hdj-eligatt-');
    try {
      sb3.write('fake-fetch.mjs', `import fs from 'node:fs';
globalThis.fetch = async (url) => {
  if (process.env.FAKE_FETCH_LOG) fs.appendFileSync(process.env.FAKE_FETCH_LOG, String(url) + '\\n');
  const body = Buffer.from(('fake ' + url + ' ').repeat(60));
  return { ok: true, status: 200, headers: new Map(), arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.length) };
};
`);
      const today = kstToday();
      const bytesOf = (u) => Buffer.from(`fake ${u} `.repeat(60));
      const A = (k, ext = 'hwp') => [{ name: `2026 ${k} 장학생 선발 공고문.${ext}`, url: `https://f.example/${k}.${ext}` }];
      const reg = { items: [
        { id: 'S', name: '같은 공고', attachments: A('s'), listedAt: today },
        { id: 'C', name: '바뀐 목록 같은 바이트', attachments: A('c', 'pdf'), listedAt: today },
        { id: 'D', name: '바뀐 목록 다른 바이트', attachments: A('d', 'pdf'), listedAt: today },
        { id: 'N', name: '처음 받는 공고', attachments: A('n'), listedAt: today },
        { id: 'X', name: '마감 지난 공고', attachments: A('x'), deadline: shift(today, -1) },
      ] };
      sb3.write('data/registered.json', reg);
      sb3.write('data/notices.json', { items: [] });
      const fileOf = (name, ext) => `elig-${slugOf(name)}-1.${ext}`;
      const fS = fileOf('같은 공고', 'hwp'), fC = fileOf('바뀐 목록 같은 바이트', 'pdf'), fD = fileOf('바뀐 목록 다른 바이트', 'pdf'), fN = fileOf('처음 받는 공고', 'hwp');
      sb3.write(`collector/extracted/${fS}`, bytesOf('https://f.example/s.hwp'));
      sb3.write(`collector/extracted/${fS}.body.txt`, '같은 공고 본문 글자');
      sb3.write(`collector/extracted/${fC}`, bytesOf('https://f.example/c.pdf'));
      sb3.write(`collector/extracted/${fC}.ocr.txt`, 'OCR 로 읽은 글자 — 바이트가 같으면 남아야 한다');
      sb3.write(`collector/extracted/${fD}`, 'old bytes '.repeat(200));
      sb3.write(`collector/extracted/${fD}.txt`, '옛 판의 글자 — 바이트가 바뀌면 지워야 한다');
      sb3.write('collector/extracted/elig-docs.json', {
        S: { slug: slugOf('같은 공고'), files: [fS], sig: attSig(A('s')) },
        C: { slug: slugOf('바뀐 목록 같은 바이트'), files: [fC], sig: 'oldsignature' },
        D: { slug: slugOf('바뀐 목록 다른 바이트'), files: [fD], sig: 'oldsignature' },
      });
      const log = sb3.abs('fetch.log');
      const r1 = sb3.run('collector/deepfetch.mjs', ['--elig-attach'], { FAKE_FETCH_LOG: log }, 25000, ['--import', sb3.abs('fake-fetch.mjs')]);
      const fetched = (sb3.read('fetch.log') || '').split('\n').filter(Boolean).map((u) => u.replace('https://f.example/', '')).sort();
      const idx = sb3.json('collector/extracted/elig-docs.json') || {};
      eq('③ 진짜 deepfetch --elig-attach — 받은 그대로(S)·마감 지남(X)은 안 받고, 첨부가 바뀐 것(C·D)과 처음(N)만 받는다',
        [r1.status, fetched], [0, ['c.pdf', 'd.pdf', 'n.hwp']]);
      eq('  🔴 받은 바이트가 같으면 파생 글자(.ocr.txt)를 지우지 않는다 · 다르면 그 파생만 지운다 · 다시 받지 않은 공고의 파생은 그대로 (bodies-5)',
        [sb3.exists(`collector/extracted/${fC}.ocr.txt`), sb3.exists(`collector/extracted/${fD}.txt`), sb3.exists(`collector/extracted/${fS}.body.txt`),
          sb3.read(`collector/extracted/${fD}`) === bytesOf('https://f.example/d.pdf').toString()],
        [true, false, true, true]);
      eq('  색인 — 받은 공고에 파일·서명·날짜 · 서명이 새 첨부 목록으로 · 마감 지난 공고는 색인에 없다',
        [idx.N && idx.N.files, idx.N && idx.N.sig === attSig(A('n')), idx.C && idx.C.sig === attSig(A('c', 'pdf')), idx.N && idx.N.at === today, 'X' in idx],
        [[fN], true, true, true, false]);
      fs.rmSync(log, { force: true });
      const r2 = sb3.run('collector/deepfetch.mjs', ['--elig-attach'], { FAKE_FETCH_LOG: log }, 25000, ['--import', sb3.abs('fake-fetch.mjs')]);
      eq('  다음 실행은 아무것도 다시 받지 않는다(예전엔 매 실행 같은 공고를 다시 받으며 파생 글자를 지웠다)',
        [r2.status, (sb3.read('fetch.log') || '').trim()], [0, '']);
    } finally {
      sb3.done();
    }
  }
  /* ── ④ 원문 보충(deepfetch --fill) — 껍데기도 세어 물러서고, 받기 전체에 예산 (B8 · bodies-12 ①) ── */
  {
    eq('④ 물러서기 — 받기 실패 3번 또는 껍데기 3번 · 껍데기 2번은 아직',
      [fillRetired({ fails: 3 }), fillRetired({ shells: 3 }), fillRetired({ shells: 2 }), fillRetired(undefined)], [true, true, false, false]);
    eq('  껍데기 세기 — 메뉴뿐이면 하나 더 · 본문이 오면 0 · 받기 실패는 껍데기가 아니다(실패는 fails 가 센다)',
      [nextShells({ shells: 2 }, { text: '메뉴', bodyChars: 10 }), nextShells({ shells: 2 }, { text: '본문 '.repeat(100), bodyChars: 300 }), nextShells({}, { text: 'FETCH_FAIL HTTP 500' })],
      [3, 0, 0]);
    const FAKE = `import fs from 'node:fs';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
globalThis.fetch = async (url) => {
  if (process.env.FAKE_FETCH_LOG) fs.appendFileSync(process.env.FAKE_FETCH_LOG, String(url) + '\\n');
  await sleep(Number(process.env.FAKE_FETCH_DELAY || 0));
  const shell = /shell|retired/.test(String(url));
  const html = shell ? '<html><body><div>홈 로그인 메뉴</div></body></html>'
    : '<html><body><p>' + '이 장학금은 국내 대학에 재학 중인 학부생을 대상으로 하며 직전 학기 성적과 가정 형편을 함께 심사합니다. '.repeat(4) + '</p></body></html>';
  return { ok: true, status: 200, headers: new Map(), text: async () => html };
};
`;
    const fillRun = (setup, env) => {
      const sb = sandbox(root, 'hdj-fill-');
      try {
        sb.write('fake-fetch.mjs', FAKE);
        sb.write('data/registered.json', { items: [] });
        setup(sb);
        const r = sb.run('collector/deepfetch.mjs', ['--fill'], { FAKE_FETCH_LOG: sb.abs('fetch.log'), ...env }, 25000, ['--import', sb.abs('fake-fetch.mjs')]);
        const fetched = (sb.read('fetch.log') || '').split('\n').filter(Boolean).map((u) => u.replace('https://n.example/', ''));
        const texts = sb.json('collector/extracted/notices-text.json') || [];
        return { r, fetched, by: (k) => texts.find((t) => t.url === `https://n.example/${k}`) || null, n: texts.length };
      } finally {
        sb.done();
      }
    };
    const menu = '홈\n로그인\n메뉴';
    const one = fillRun((sb) => {
      sb.write('data/notices.json', { items: ['shell-1', 'retired-1', 'body-1'].map((k) => ({ title: `${k} 장학 공고`, school: '표본대학교', url: `https://n.example/${k}`, foundAt: '2026-10-01' })) });
      sb.write('collector/extracted/notices-text.json', [
        { title: 'shell-1 장학 공고', url: 'https://n.example/shell-1', text: menu, cut: false, limit: 15000, shells: 2 },
        { title: 'retired-1 장학 공고', url: 'https://n.example/retired-1', text: menu, cut: false, limit: 15000, shells: 3 },
      ]);
    }, { FILL_RETRY_SLOTS: '0' });
    eq('④ 진짜 deepfetch --fill — 껍데기 3번인 주소는 물러서 안 받고(회전 0자리) · 껍데기 2번인 주소는 받아 3번으로 · 본문이 온 주소는 껍데기 칸 없음',
      [one.r.status, [...one.fetched].sort(), one.by('shell-1') && one.by('shell-1').shells, one.by('body-1') && one.by('body-1').shells, one.by('retired-1') && one.by('retired-1').shells],
      [0, ['body-1', 'shell-1'], 3, undefined, 3]);
    const slow = fillRun((sb) => {
      sb.write('data/notices.json', { items: Array.from({ length: 8 }, (_, i) => ({ title: `slow-${i} 장학 공고`, school: '표본대학교', url: `https://n.example/slow-${i}`, foundAt: '2026-10-01' })) });
      sb.write('collector/extracted/notices-text.json', []);
    }, { FILL_BUDGET_MS: '700', FAKE_FETCH_DELAY: '300' });
    eq('  받기 예산 — 예산(0.7초)이 지나면 다음 요청을 시작하지 않고 그때까지 받은 것을 저장한다(8건 중 일부만 · 저장된 수 = 받은 수)',
      [slow.r.status, slow.fetched.length >= 1 && slow.fetched.length <= 5, slow.n === slow.fetched.length], [0, true, true]);
    const df = readText('.github/workflows/deep-fetch.yml');
    eq('  심층 수집 워크플로는 제 대기줄(deep-fetch) — 수집 대기줄(collector)과 합치지 않는다',
      [/^concurrency:\n {2}group: deep-fetch\n {2}cancel-in-progress: false/m.test(df), /group: collector\b/.test(stripYamlComments(df))], [true, false]);
  }
  /* ── ⑤ OCR — 글자층이 있어도 자격용 공고문 PDF 는 쪽 그림으로 읽는다 (bodies-6) ──
     자격 경로는 글자층(.pdf.txt)을 쓰지 않는다(2026-08-20 결정) — 그런데 OCR 은 '글자층이 있으면 이미 뽑았다'며 건너뛰어
     자격용 PDF 가 무료 경로 어디에서도 안 읽혔다. 양식(form-*)·층2 사본은 예전처럼 글자층을 쓴다. */
  {
    const probe = spawnSync('python3', ['-c', 'print("PYOK")'], { encoding: 'utf8' });
    if (!(probe.status === 0 && /PYOK/.test(probe.stdout || ''))) {
      console.log('  … ⑤ OCR 후보 검사 건너뜀 — 이 컴퓨터에 파이썬이 없다(윈도우의 python3 는 스토어 껍데기). 클라우드 로봇에서는 실제로 돈다.');
    } else {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hdj-ocrcand-'));
      try {
        for (const f of ['elig-a-1.pdf', 'form-b-1.pdf', 'plain-c.pdf']) {
          fs.writeFileSync(path.join(dir, f), '%PDF-1.4\n표본');
          fs.writeFileSync(path.join(dir, `${f}.txt`), '글자층');
        }
        fs.writeFileSync(path.join(dir, 'elig-d-1.pdf'), '%PDF-1.4\n글자층 없는 스캔');
        const code = ['import importlib.util, json, os, sys',
          "spec = importlib.util.spec_from_file_location('ocrtext', sys.argv[1])",
          'm = importlib.util.module_from_spec(spec)', 'spec.loader.exec_module(m)',
          'print(json.dumps(sorted([os.path.basename(p), k] for p, k in m.candidates(sys.argv[2]))))'].join('\n');
        const r = spawnSync('python3', ['-c', code, fileURLToPath(new URL('collector/ocr-text.py', root)), dir],
          { encoding: 'utf8', env: cleanEnv({ PYTHONDONTWRITEBYTECODE: '1' }) });
        let got = null;
        try { got = JSON.parse((r.stdout || '').trim().split('\n').pop()); } catch { got = (r.stderr || r.stdout || '').slice(-200); }
        eq('⑤ OCR 후보 — 자격용 공고문 PDF 는 글자층이 있어도 읽는다 · 양식·그 밖의 PDF 는 글자층이 있으면 건너뛴다 · 글자층 없는 PDF 는 예전처럼 읽는다',
          got, [['elig-a-1.pdf', 'pdf'], ['elig-d-1.pdf', 'pdf']]);
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    }
  }
}

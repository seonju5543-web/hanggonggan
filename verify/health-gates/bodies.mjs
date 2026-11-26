/* 「로봇·도구 점검 관문」 bodies 묶음 — 원문 받기 로봇 · 본문 · 첨부 · OCR (2026-10-04 대대적 점검)
   잰다:
     ① 원문 받기 로봇(rescue-bodies.mjs) — **진짜 파일을 임시 폴더에서 가짜 브라우저로 돌린다** (bodies-1·bodies-4)
        ⓐ 대상 거르기·차례: 이레 안에 본문을 확보한 공고 · 마감 지난 공고 · 오래돼 내려간 공고 · 자격 줄 있는 공고는 빠지고,
           덜 해 본 것 → 한 번도 못 받은 것 먼저 (rescue-plan.mjs 순수 함수 + 로봇의 미리보기 '차례' 줄)
        ⓑ 한 공고가 멈춰도(시한) 다음 공고로 간다 · 시한 뒤 늦게 끝난 읽기가 registered.json 을 몰래 바꾸지 않는다 ·
           멈춘 뒤 새 창 · **공고마다 저장**(넷째 공고에서 프로세스가 강제로 죽어도 앞 세 공고의 장부·본문이 남는다) ·
           본문 확보는 장부에서 지우지 않고 날짜를 적는다
        ⓒ 워크플로(rescue-bodies.yml): 재수집 단계가 끝까지 못 가면 작업을 실패로(bodies-2) · 실패 알림은 오늘 리포트만 붙이고
           실행 로그 주소를 단다 · 성공하면 옛 실패 이슈를 닫는다(bodies-7) · 관문에 걸려 되돌릴 때 장부도 되돌린다(bodies-12 ③)
     ② PaddleOCR 엔진 고장(gaps-02) — paddle-ocr.py 를 가짜 paddleocr·PIL 로 진짜 돌려 종료 코드 2·::warning::·상태 파일 ·
        activity-docs 의 장부 판 이동·기회 되돌리기(--apply·--fetch 를 임시 폴더에서 진짜로) · 두 워크플로가 실패를 삼키지 않는다
     ③ 자격용 공고문 첨부(deepfetch --elig-attach · bodies-3·5) — 줄이 돈다(고르기는 기본 브랜치 elig-targets.mjs) · 미리 몽땅 지우지 않고 바이트가 같으면 파생 글자 보존 (가짜 fetch 로 진짜 실행)
     ④ 원문 보충(deepfetch --fill · B8 · bodies-12 ①) — 껍데기도 세어 물러선다 · 받기 예산 · 심층 수집 대기줄 (가짜 fetch 로 진짜 실행)
     ⑤ OCR(ocr-text.py · bodies-6) — 글자층이 있어도 자격용 PDF 는 쪽 그림으로 · 관문에서 버릴 때 남(PaddleOCR)이 만든 .ocr.txt 는 안 지운다(bodies-int-1)
     ⑥ AI 자격 읽기 버튼(eligibility-fill.yml · bodies-10) — 대상 세 갈래 합 · 0 이면 돈이 드는 단계만 건너뛴다 (세기 줄을 bash 로 진짜 실행)
     ⑦ 브라우저 수집(browser-collect.mjs · B7) — 클릭형 게시판 상세 글자도 본문으로(남의 글 막기 셋) · 저장하는 본문은 줄을 살린 것
   🔴 표본(고정 예시)만 잰다 — data/·collector/ 장부를 읽어 단정하지 말 것(verify/health-gates.mjs 머리말).
      로봇을 돌릴 때는 저장소 파일을 임시 폴더로 **복사**해 그 안에서만 돌린다(진짜 장부·데이터를 건드리지 않는다). */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { cleanEnv, stripComments, stripYamlComments } from './gate.mjs';
import { browserBodyEntry, clickBodyEntry } from '../../collector/html-text.mjs';
import { canonUrl } from '../../collector/canon-url.mjs';
import { restingAfterOk, closedForStudents, orderTargets, ledgerEntry, newAttachments, pruneLedger, wantsBody,
  wantsAttachments, withAttCheck, withAttMiss, preferUsable, upgradeAttachmentUrls, attGapOf, replayOk, wrongKind, fileNameIn, usableUrl, attachmentAlarms, feedAttachmentGaps,
  trustedAttachment, censusInPage, FILE_NAME_SRC, pageSelfUrl, dropSelfLinks, linksFromAnchors } from '../../collector/rescue-plan.mjs';
import { detailAttachments, BUTTON_WORD } from '../../collector/attachment-link.mjs';
import { pickEligTargets } from '../../collector/elig-targets.mjs';
import { fillRetired, nextShells, fillCounts } from '../../collector/notice-source.mjs';

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
     att-err : 열리지 않는다(연결 거부)
     att-click-ok / att-click-login / att-href : 화면에 파일 이름이 보인다(첨부 살피기 · 2026-11-17) — 누르면 내려받기가 시작되거나(앞 둘) 진짜 링크가 그려져 있다(셋째)
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
  /* att-click-self: 첨부가 \`<a href="#" onclick="filedown(…)">\` 꼴 — 브라우저는 a.href 를 **화면 주소 + #** 으로 풀어 준다(서울시립대 · 2026-11-18) */
  const att = () => (/att-click-self/.test(url) ? [{ i: 0, name: '2026 표본 장학금 서식.hwp', href: url + '#' }]
    : /att-href/.test(url) ? [{ i: 0, name: '2026 표본 장학금 공고문.pdf', href: 'https://fake.example/files/notice.pdf' }]
    : /att-click-login/.test(url) ? [{ i: 0, name: '2026 표본 장학금 지원서.hwp', href: '' }]
    : /att-click-ok/.test(url) ? [{ i: 0, name: '2026 표본 장학금 신청서.hwp', href: '' }] : []);
  const frame = {
    evaluate: async () => att(),
    locator: (sel) => ({ innerText: () => (kind() === 'forever' ? never() : kind() === 'late' ? later(Number(process.env.FAKE_LATE_MS || 450), BODY) : Promise.resolve(BODY)),
      first: () => ({ evaluate: async () => { note('click ' + sel); } }) }),
    $$eval: (sel) => Promise.resolve(sel === 'a[href]' && /att-click-self/.test(url) ? [{ name: '2026 표본 장학금 서식.hwp', url: url + '#' }]
      : sel === 'a[href]' && kind() === 'late' ? [{ name: '2026 표본 장학생 선발 공고문.hwp', url: 'https://fake.example/f.hwp' }]
      : /att-junk/.test(url) && sel === 'a[href]' ? [{ name: '대학정보공시', url: 'http://info.example/pubinfo/list.do?schlId=1&filePath=01' }, { name: '부설연구기관', url: 'https://fake.example/department/research_attach.jsp' },
        { name: '첨부파일 다운로드', url: 'https://fake.example/notice.do?mode=fileDownload&attachNo=9' }, { name: '첨부파일 보기', url: 'https://fake.example/_attach/view.jsp?attach_no=9' },
        { name: '2026 표본 장학금 신청 안내문', url: 'https://fake.example/notice.do?mode=download&attachNo=7' }]
      : /att-junk/.test(url) && sel === 'img' ? [{ url: 'https://fake.example/img/logo.webp', w: 509, h: 348 }] : []),
  };
  return {
    goto: async (u) => { url = u; note('goto ' + u); if (kind() === 'kill') process.kill(process.pid, 'SIGKILL'); if (/att-err/.test(u)) throw new Error('net::ERR_CONNECTION_REFUSED'); },
    waitForTimeout: () => Promise.resolve(),
    waitForEvent: () => (/att-click/.test(url) ? Promise.resolve({ url: () => 'https://fake.example/dl/' + (/login/.test(url) ? 'login' : 'file') + '.hwp', cancel: async () => {} })
      : new Promise((_, rej) => setTimeout(() => rej(new Error('no download')), 30))),
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
    /* 2026-10-29 — 대상 기준이 '자격 없음'뿐이라 본문이 껍데기인데 자격은 있는 공고 61건(금액·마감 모름)에 로봇이 한 번도 안 갔다 */
    eq('  열어 볼 이유 — 자격 없으면 늘 · 자격 있어도 본문 껍데기 + 금액 모름 또는 마감 없음이면 · 본문 있으면 안 감 · 등록금 전액·시급은 아는 금액 · 상시 제도는 마감 없어도 안 감',
      [wantsBody({ amountValue: 0 }, false, true), wantsBody({ amount: '금액 원문 확인', amountValue: 0, deadline: '2026-12-01' }, true, false), wantsBody({ amountValue: 500000, deadline: '' }, true, false),
        wantsBody({ amount: '금액 원문 확인', amountValue: 0 }, true, true), wantsBody({ amount: '등록금 전액', amountValue: 0, deadline: '2026-12-01' }, true, false), wantsBody({ amount: '시급 12,790원', amountValue: 0, program: true }, true, false)],
      [true, true, true, false, false, false]);
    eq('  rescue-bodies 의 대상 고르기가 그 규칙(wantsBody)을 원문 색인과 함께 부른다', /wantsBody\(it, requirementLines\(it\)\.length > 0, hasText\(sourceFor\(it, idx\)\)\)/.test(readText(new URL('../../collector/rescue-bodies.mjs', import.meta.url))), true);
    eq('  차례 — 덜 해 본 것 → 같으면 한 번도 본문을 못 받은 것 → 등록 순서',
      orderTargets([{ id: 'b', tries: 0, everOk: true }, { id: 'g', tries: 1 }, { id: 'e', tries: 0, everOk: false }, { id: 'h', tries: 0 }]).map((t) => t.id),
      ['e', 'h', 'b', 'g']);
    eq('  장부 한 칸 — 확보는 날짜(지우지 않는다) · 시한 초과·본문 없음은 한 번 센다 · 마지막 확보 날짜는 이어 둔다',
      [ledgerEntry({ tries: 2 }, 'ok', { today, minBody: 100, name: 'n' }), ledgerEntry({ tries: 1, ok: '2026-09-01' }, 'hung', { today, minBody: 100, name: 'n' }),
        ledgerEntry(undefined, 'miss', { today, minBody: 100, name: 'n' })],
      [{ ok: today, at: today, tries: 0, name: 'n' }, { tries: 2, at: today, minBody: 100, hung: true, name: 'n', ok: '2026-09-01' },
        { tries: 1, at: today, minBody: 100, name: 'n' }]);
    const L0 = { [canonUrl('https://a.example/x?id=1')]: { ok: today }, [canonUrl('https://b.example/gone?id=2')]: { tries: 1 }, _v: 1 };
    eq('  장부 정리(pruneLedger) — 등록 목록에 없는 공고 칸만 지운다 · 표식 칸(_)은 남긴다 · 삭제된 공고 칸도 지난 확보 날짜를 이어 둔다 (리뷰 R5)',
      [pruneLedger(L0, [{ sourceUrl: 'https://a.example/x?id=1' }]), Object.keys(L0).sort(),
        ledgerEntry({ tries: 1, ok: '2026-09-01' }, 'gone', { today, minBody: 100, name: 'n', restAfter: 3 }),
        /ledger\[key\] = ledgerEntry\(ledger\[key\], 'gone'/.test(stripComments(readText('collector/rescue-bodies.mjs')))],
      [1, ['_v', canonUrl('https://a.example/x?id=1')].sort(), { tries: 3, at: today, minBody: 100, gone: true, name: 'n', ok: '2026-09-01' }, true]);
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
      item('F', 'f-has-lines', { eligibilityLines: ['직전학기 평점평균 3.0 이상인 재학생'], amount: '등록금 전액', deadline: shift(today, 10) }), item('G', 'g-tried'),
      /* H — 자격은 있는데 본문이 껍데기(원문 없음)라 금액을 못 읽은 공고: 2026-10-29부터 간다(wantsBody) */
      item('H', 'h-shell-no-amount', { eligibilityLines: ['재학생'], amount: '금액 원문 확인', amountValue: 0, deadline: shift(today, 10) }),
    ] });
    sb.write('collector/rescue-ledger.json', {
      [canonUrl(u('a-ok-recent'))]: { ok: shift(today, -3), at: shift(today, -3), tries: 0 },
      [canonUrl(u('b-ok-old'))]: { ok: shift(today, -8), at: shift(today, -8), tries: 0 },
      [canonUrl(u('g-tried'))]: { tries: 1, at: shift(today, -1), minBody: 100 },
    });
    const pre = sb.run('collector/rescue-bodies.mjs', [], {});
    eq('① ⓐ 로봇 미리보기의 차례 — 새 공고(E) → 자격 있어도 껍데기·금액 모름(H) → 확보한 지 여드레(B) → 한 번 실패(G) · 이레 안 확보(A)·마감 지남(C)·오래됨(D)·자격 줄 있고 금액·마감 아는 것(F)은 없다',
      [pre.status, (pre.out.match(/차례: ([^\n]*)/) || [])[1] || pre.out.slice(-300)], [0, 'E · H · B · G']);

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

    /* ⓓ 저장 도중 강제 종료 · 감시 타이머 · 장부 정리 (리뷰 R2·R5) */
    sb.write('kill-on-write.mjs', [
      "import fs from 'node:fs';",
      'const orig = fs.writeFileSync; let n = 0;',
      'fs.writeFileSync = function (file, data, ...rest) {',
      '  const p = file instanceof URL ? file.pathname : String(file);',
      '  if (/browser-bodies\\.json/.test(p) && ++n === Number(process.env.KILL_ON_WRITE_N || 2)) {',
      '    orig.call(fs, file, String(data).slice(0, Math.floor(String(data).length / 2)), ...rest);',
      "    process.kill(process.pid, 'SIGKILL');",
      '  }',
      '  return orig.call(fs, file, data, ...rest);',
      '};', ''].join('\n'));
    sb.write('data/registered.json', { items: [item('k1', 'ok-k1'), item('k2', 'ok-k2'), item('k3', 'ok-k3')] });
    sb.write('collector/rescue-ledger.json', {});
    sb.write('collector/extracted/browser-bodies.json', {});
    const kw = sb.run('collector/rescue-bodies.mjs', ['--write'], { RESCUE_GAP_MS: '0', RESCUE_BUDGET_MS: '120000', RESCUE_CAP: '10' }, 25000,
      ['--import', sb.abs('kill-on-write.mjs')]);
    const kb = sb.json('collector/extracted/browser-bodies.json');
    eq('① ⓓ 🔴 본문 파일을 쓰는 도중에 강제로 죽어도 파일이 반쯤 잘리지 않는다 — 바로 앞 저장 판(첫 공고 본문) 그대로 · 임시 파일에 쓰고 이름만 바꾼다 (리뷰 R2)',
      [kw.signal, kb !== null, !!(kb && kb[u('ok-k1')]), !!(kb && kb[u('ok-k2')])], ['SIGKILL', true, true, false]);

    sb.write('data/registered.json', { items: [item('w1', 'ok-w1'), item('w2', 'hang-forever-w2'), item('w3', 'ok-w3')] });
    sb.write('collector/rescue-ledger.json', { [canonUrl('https://fake.example/left-registered?id=1')]: { tries: 2, at: shift(today, -2), minBody: 100 } });
    sb.write('collector/extracted/browser-bodies.json', {});
    const t0 = Date.now();
    const wd = sb.run('collector/rescue-bodies.mjs', ['--write'],
      { RESCUE_NOTICE_MS: '600000', RESCUE_GAP_MS: '0', RESCUE_BUDGET_MS: '1200000', RESCUE_CAP: '10', RESCUE_WATCHDOG_MS: '1500' }, 20000);
    /* 여유를 넉넉히 — 이 관문은 수집 로봇의 데이터 관문 안에서도 돈다(test-collector). 바쁜 실행기에서 node 를 띄우는 데만 몇 초가 걸려도
       빨개지면 안 된다. 감시 타이머가 없으면 영영 멈춘 공고(10분 시한) 때문에 20초에 강제로 끊겨 signal 이 남는다 → ✕ */
    const wdMs = Date.now() - t0;
    const wdLed = sb.json('collector/rescue-ledger.json') || {};
    const wdRep = sb.read('collector/rescue-report.md') || '';
    eq('  감시 타이머 — 한 공고 시한보다 오래 멈춘 호출이 있어도 단계 시한 전에 스스로 저장하고 끝낸다(종료 코드 1 · 강제 종료 아님) · 앞 공고의 본문·장부와 리포트 꼬리가 남는다 (리뷰 R2)',
      [wd.status, wd.signal, wdMs < 18000, !!(wdLed[canonUrl(u('ok-w1'))] || {}).ok, /감시 타이머/.test(wdRep) && /\(진행 중 2\/3/.test(wdRep), !!(sb.json('collector/extracted/browser-bodies.json') || {})[u('ok-w1')]],
      [1, null, true, true, true, true]);
    eq('  장부 정리 — 등록 목록에서 빠진 공고의 칸은 지운다(확보 기록을 남기게 된 뒤 장부가 끝없이 자라지 않게) (리뷰 R5)',
      Object.keys(wdLed).includes(canonUrl('https://fake.example/left-registered?id=1')), false);
  } finally {
    sb.done();
  }

  /* ── ① ⓔ 첨부 살피기 (2026-11-17 개발자 지시 — 원문에 있는 파일이 앱에도 보이게) ──
     실측: 정식 등록 355건 중 90건이 첨부 0개 · 서울시립대·전북대·국민대는 16건 중 16건 0개(원문엔 파일이 있었다 — 주소가 아니라 누르면 도는 동작·화면이 뜬 뒤 그려지는 목록).
     순수 규칙(rescue-plan) + 진짜 로봇을 가짜 브라우저·가짜 fetch 로 돌린다 */
  {
    const today = kstToday();
    eq('① ⓔ 화면 글자에서 파일 이름 — 확장자로 끝나는 덩어리만 · 단추 글자·그림 이름은 아니다',
      [fileNameIn('  붙임1. 2026-2학기 지원가능학과_교내근로(3차).xlsx [13KB] '), fileNameIn('미래 건설교통신기술인 장학사업 안내.pdf'), fileNameIn('다운로드'), fileNameIn('학교 로고.png'), fileNameIn('첨부파일 보기')],
      ['붙임1. 2026-2학기 지원가능학과_교내근로(3차).xlsx', '미래 건설교통신기술인 장학사업 안내.pdf', '', '', '']);
    eq('  🔴 확장자 바로 뒤에 글자가 이어지면 파일 이름이 아니다(본문 문장 「…신청서.hwp를 작성하여」 · 리뷰 1) · 꼬리표(`(다운로드 : 12회)`)가 붙은 것은 이름만',
      [fileNameIn('제출서류는 붙임의 장학금 신청서.hwp를 작성하여 제출'), fileNameIn('장학금 신청서.hwp (다운로드 : 12회)'), fileNameIn('장학금 신청서.hwp')],
      ['', '장학금 신청서.hwp', '장학금 신청서.hwp']);
    eq('  🔴 같은 파일은 한 번만 쌓는다 — 화면 글자 `X.hwp` 와 링크 글자 `X.hwp (다운로드 : 12회)`·`1. X.hwp 미리보기` 는 같은 첨부(리뷰 5 · 서울교대 한 공고에 36개)',
      newAttachments([{ name: '장학금 신청서.hwp (다운로드 : 12회)' }], [{ name: '장학금 신청서.hwp' }, { name: '1. 장학금 신청서.hwp 미리보기' }, { name: '선발 공고문.pdf [1.2MB]' }, { name: '선발 공고문.pdf' }]).map((a) => a.name),
      ['선발 공고문.pdf [1.2MB]']);
    /* 2026-11-20 — 광운대 인석장학금: 같은 링크를 읽는 길마다 이름이 달라(`Attachment 2026….hwp` · `Attachment2026….hwp` · `2026….hwp`) 파일 2개가 6줄이 됐다.
       이름만 보던 겹침 판정에 **받을 주소까지 같은 같은 파일**(attachment-link sameFileAmong)을 더했다 — 주소만 같고 이름이 딴판이면 여전히 새 첨부다 */
    {
      const U = 'https://www.kw.ac.kr/include/Download.jsp?fuid=35466&ano=53536';
      const SELF = 'https://scholarship.uos.ac.kr/scholarship/notice/notice/view.do?brdDate=20261105&brdSeq=1&#';
      eq('  🔴 이름이 조금 달라도 받을 주소가 같은 같은 파일은 다시 쌓지 않는다(이미 적힌 것과 · 이번에 찾은 것끼리) — 주소가 다르면 새 첨부',
        [newAttachments([{ name: 'Attachment 20261021 인석장학금 체크리스트1.hwp', url: U }], [{ name: 'Attachment20261021 인석장학금 체크리스트1.hwp', url: U }, { name: '20261021 인석장학금 체크리스트1.hwp', url: U }]).length,
          newAttachments([], [{ name: 'Attachment20261021 인석장학금 체크리스트1.hwp', url: U }, { name: '20261021 인석장학금 체크리스트1.hwp', url: U }]).map((a) => a.name),
          newAttachments([{ name: 'Attachment 20261021 인석장학금 체크리스트1.hwp', url: U }], [{ name: '20261021 인석장학금 체크리스트1.hwp', url: `${U}9` }]).length],
        [0, ['Attachment20261021 인석장학금 체크리스트1.hwp'], 1]);
      eq('  🔴 주소만 같고 이름이 딴판이면 다른 파일이다 — 공고 화면 주소(`…#`)를 같이 단 신청서·자기소개서는 둘 다 적는다(서울시립대 실측 꼴)',
        newAttachments([{ name: '발전기금 장학생 신청서.hwp', url: SELF }], [{ name: '자기소개서_기본형.hwp', url: SELF }]).map((a) => a.name), ['자기소개서_기본형.hwp']);
      /* 리뷰 11-20 — 닮은 이름이어도 파일 하나의 주소가 아니면(그 주소에 딴 이름이 이미 섞여 있으면) 새 첨부로 둔다 · 학교가 새 이름으로 바꿔 올린 파일은 새 첨부다(경희대 점프장학) */
      const ONE = 'https://a.ac.kr/down?no=1';
      eq('  🔴 한 주소에 딴 이름이 이미 섞여 있으면 닮은 이름도 새로 적는다 · 같은 자리의 새 이름(`…_수정_20261001.pdf`)은 새 첨부 · 확장자만 다른 것도',
        [newAttachments([{ name: '붙임1 공고문.hwp', url: ONE }, { name: '붙임2 신청서.hwp', url: ONE }], [{ name: '공고문.hwp', url: ONE }]).length,
          newAttachments([{ name: '붙임1 운영 계획안_수정.pdf', url: U }], [{ name: '붙임1 운영 계획안_수정_20261001.pdf', url: U }]).length,
          newAttachments([{ name: '선발 공고문.hwp', url: ONE }], [{ name: '선발 공고문.pdf', url: ONE }]).length],
        [1, 1, 1]);
      /* 리뷰 11-20 (중요 1) — 새로 쌓지 않은 줄을 '못 구한 것'으로 세면 광운대 공고마다 헛 경보가 뜨고 이레마다 다시 연다. 찾은 줄에 받을 주소가 있으면 구한 것이다 */
      const stored = [{ name: '20261021 인석장학금 체크리스트1.hwp', url: U }];
      const foundNow = [{ name: 'Attachment20261021 인석장학금 체크리스트1.hwp', url: U }, { name: '20261021 인석장학금 체크리스트1.hwp', url: U }];
      const seenNow = ['Attachment20261021 인석장학금 체크리스트1.hwp', '20261021 인석장학금 체크리스트1.hwp', '화면에만 보인 서식.hwp'];
      eq('  🔴 못 구한 첨부 수(attGap) — 같은 파일이라 안 쌓은 이름은 세지 않고(찾은 줄에 받을 주소가 있다) · 화면에만 보이고 주소를 못 구한 것만 센다 · 찾은 줄을 안 넘기면 예전처럼 2',
        [newAttachments(stored, foundNow).length, attGapOf(seenNow, stored, foundNow), attGapOf(seenNow, stored), attGapOf(['주소 없는 서식.hwp'], stored, [{ name: '주소 없는 서식.hwp', url: '' }])],
        [0, 1, 2, 1]);
      eq('  로봇이 그 셈에 이번에 찾은 줄을 넘긴다(attGapOf(names, 적힌 것, 찾은 것))', /gap: attGapOf\(names, t\.it\.attachments, r\.found\)/.test(readText('collector/rescue-bodies.mjs')), true);
    }
    eq('  받을 수 있는 주소는 http(s) 뿐 — `javascript:`·빈 주소·`#` 는 앱이 이름만 보인다',
      [usableUrl('https://a.example/f.hwp'), usableUrl("javascript:filedown('1')"), usableUrl(''), usableUrl('#'), usableUrl(undefined)], [true, false, false, false, false]);
    eq('  살필 때 — 한 번도 안 살폈으면 · 다 구했으면 다시 안 연다 · 못 구한 것이 남았어도 이레 안이면 쉰다 · 여드레면 다시',
      [wantsAttachments(undefined, today), wantsAttachments({ tries: 1 }, today), wantsAttachments({ att: shift(today, -30), attGap: 0 }, today),
        wantsAttachments({ att: shift(today, -3), attGap: 1 }, today), wantsAttachments({ att: shift(today, -8), attGap: 1 }, today)],
      [true, true, false, false, true]);
    eq('  🔴 못 여는 공고를 매 실행 두드리지 않는다(리뷰 2) — 내려간 글 · 본문 쪽에서 세 번 실패해 쉬는 글 · 첨부 살피기로 세 번 못 연 글은 이레 쉰다 · 두 번까지는·여드레 뒤에는 다시',
      [wantsAttachments({ gone: true, tries: 3, at: shift(today, -30) }, today), wantsAttachments({ tries: 3, at: shift(today, -2) }, today), wantsAttachments({ tries: 3, at: shift(today, -8) }, today),
        wantsAttachments({ attTries: 3, attAt: shift(today, -2) }, today), wantsAttachments({ attTries: 2, attAt: shift(today, -2) }, today), wantsAttachments({ attTries: 3, attAt: shift(today, -8) }, today)],
      [false, false, true, false, true, true]);
    eq('  못 연 횟수는 첨부 쪽에만 센다(본문 칸은 그대로) · 화면을 보면 지운다',
      [withAttMiss({ ok: '2026-11-01', tries: 0 }, today), withAttMiss(withAttMiss(undefined, today), today).attTries, Object.keys(withAttCheck({ attTries: 2, attAt: today }, { today, seen: 0, gap: 0 })).sort()],
      [{ ok: '2026-11-01', tries: 0, attTries: 1, attAt: today }, 2, ['att', 'attGap', 'attSeen']]);
    eq('  🔴 장부 칸을 새로 적어도(본문 확보·실패·멈춤·삭제) 첨부 살핀 기록은 이어진다 — 안 이으면 매 실행 다시 연다 · 기록이 없던 칸에는 아무것도 안 생긴다',
      [['ok', 'miss', 'hung', 'gone'].map((o) => { const e = ledgerEntry({ tries: 1, att: '2026-11-10', attSeen: 2, attGap: 1, attTries: 2, attAt: '2026-11-09' }, o, { today, minBody: 100, name: 'n' }); return [e.att, e.attSeen, e.attGap, e.attTries, e.attAt]; }),
        Object.keys(ledgerEntry({ tries: 1 }, 'ok', { today, minBody: 100, name: 'n' })).filter((k) => k.startsWith('att'))],
      [Array.from({ length: 4 }, () => ['2026-11-10', 2, 1, 2, '2026-11-09']), []]);
    eq('  살핀 결과 얹기 — 본문 칸은 그대로',
      withAttCheck({ ok: '2026-11-01', tries: 0 }, { today, seen: 3, gap: 1 }), { ok: '2026-11-01', tries: 0, att: today, attSeen: 3, attGap: 1 });
    eq('  같은 이름을 주소 읽기(`javascript:`)와 누르기(진짜 주소)가 둘 다 냈으면 진짜 주소 쪽을 남긴다 · 앞 번호·미리보기 꼬리는 같은 이름 · 본문 그림은 주소로 구분',
      preferUsable([{ name: '1. 신청서.hwp', url: "javascript:dl('1')" }, { name: '신청서.hwp 미리보기', url: 'https://a.example/1.hwp' }, { name: '공고문.pdf', url: '' },
        { name: '본문이미지-800x1200.jpg', url: 'https://a.example/p1.jpg', bodyImage: true }, { name: '본문이미지-800x1200.jpg', url: 'https://a.example/p2.jpg', bodyImage: true }]).map((a) => a.url),
      ['https://a.example/1.hwp', '', 'https://a.example/p1.jpg', 'https://a.example/p2.jpg']);
    eq('  이름만 적혀 있던 첨부에 주소를 채운다 — 이름·차례는 그대로 · 이미 진짜 주소가 있으면 안 건드린다 · 주소 없는 것으로는 안 채운다',
      (() => { const r = upgradeAttachmentUrls([{ name: '1. 신청서.hwp', url: "javascript:dl('1')" }, { name: '공고문.pdf', url: 'https://old.example/n.pdf' }, { name: '서약서.hwp', url: '' }],
        [{ name: '신청서.hwp', url: 'https://a.example/1.hwp' }, { name: '공고문.pdf', url: 'https://new.example/n.pdf' }, { name: '서약서.hwp', url: '' }]);
      return [r.list.map((a) => [a.name, a.url]), r.upgraded]; })(),
      [[['1. 신청서.hwp', 'https://a.example/1.hwp'], ['공고문.pdf', 'https://old.example/n.pdf'], ['서약서.hwp', '']], ['1. 신청서.hwp']]);
    eq('  못 구한 수 — 화면에서 본 이름 가운데 기록에 받을 주소가 없는 것(같은 이름은 한 번)',
      [attGapOf(['신청서.hwp', '1. 신청서.hwp', '공고문.pdf'], [{ name: '신청서.hwp', url: 'https://a.example/1.hwp' }, { name: '공고문.pdf', url: '' }]), attGapOf([], []), attGapOf(['공고문.pdf'], [])],
      [1, 0, 1]);
    eq('  🔴 눌러서 잡은 주소는 세션 없는 새 요청이 **파일**을 줄 때만 믿는다 — 로그인·오류 화면도 200 으로 온다 · 빈 응답·4xx 는 아니다',
      [replayOk(200, Buffer.from('%PDF-1.7 ...')), replayOk(200, Buffer.from([0xd0, 0xcf, 0x11, 0xe0])), replayOk(200, Buffer.from('<!DOCTYPE html><html><head><title>로그인</title>')),
        replayOk(200, Buffer.from('\n  <html lang="ko">')), replayOk(200, Buffer.alloc(0)), replayOk(200, null), replayOk(403, Buffer.from('%PDF')), replayOk(302, Buffer.from('%PDF'))],
      [true, true, false, false, false, false, false, false]);
    eq('  🔴 파일 서명일 때만 믿는다(리뷰 4) — 안내창 스크립트·JSON 오류·보통 글자는 웹페이지 표지가 없어도 파일이 아니다 · 압축 꼴(hwpx·docx·xlsx)·한글 3 은 파일',
      [replayOk(200, Buffer.from('<script>alert("로그인 후 이용");history.back()</script>')), replayOk(200, Buffer.from('{"error":"not found"}')), replayOk(200, Buffer.from('잘못된 접근입니다.')),
        replayOk(200, Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14])), replayOk(200, Buffer.from('HWP Document File V3.00'))],
      [false, false, false, true, true]);
    eq('  눌러서 내려온 파일의 종류가 화면의 이름과 다르면 남의 내려받기다(앞 단추의 늦은 내려받기 · 리뷰 6) · 서버가 바꿔 준 이름·확장자 없는 이름은 그대로 믿는다',
      [wrongKind('장학금 신청서.hwp', '선발 공고문.pdf'), wrongKind('장학금 신청서.hwp', '20261117_a1b2.hwp'), wrongKind('장학금 신청서.hwp', 'download'), wrongKind('장학금 신청서.hwp (12KB)', 'x.HWP')],
      [true, false, false, false]);
    eq('  첨부만 살피러 간 공고에서 믿는 첨부 — 파일 이름이거나 분명한 내려받기 주소 · 단추 글자·뷰어 안내·메뉴 링크·본문 그림은 아니다',
      [{ name: '선발 공고문.pdf', url: '' }, { name: '2027-1 교내장학금 신청안내', url: 'https://a.example/n.do?mode=download&attachNo=7' }, { name: '첨부파일 다운로드', url: 'https://a.example/n.do?mode=fileDownload&attachNo=7' },
        { name: '파일 다운로드', url: 'https://a.example/f.do?fileNo=3' }, { name: '한글뷰어 다운로드', url: 'https://a.example/csDownload.do' }, { name: '대학정보공시', url: 'http://i.example/list.do?filePath=01' },
        { name: '부설연구기관', url: 'https://a.example/research_attach.jsp' }, { name: '본문이미지-800x600.jpg', url: 'https://a.example/p.jpg', bodyImage: true }].map(trustedAttachment),
      [true, true, false, false, false, false, false, false]);
    /* 화면에서 파일 이름 세기(censusInPage) — 브라우저 안에서 도는 함수를 **가짜 화면**으로 부른다(리뷰: 로봇 표본은 세기 결과를 통째로 가짜로 줘 이 함수가 한 번도 안 돌았다) */
    {
      const el = (tag, o = {}) => ({ tagName: tag, parentElement: o.parent || null, _a: { ...(o.attrs || {}) }, _hidden: !!o.hidden, _in: o.inside || '',
        hasAttribute(k) { return k in this._a; }, getAttribute(k) { return this._a[k] ?? null; }, setAttribute(k, v) { this._a[k] = v; },
        get href() { return `https://fake.example${this._a.href || ''}`; },
        closest(sel) { return this._in && sel.split(',').includes(this._in) ? this : (this.parentElement ? this.parentElement.closest(sel) : null); },
        getBoundingClientRect() { return this._hidden ? { width: 0, height: 0 } : { width: 100, height: 20 }; } });
      const body = el('BODY');
      const btn = el('BUTTON', { parent: body, attrs: { onclick: "cf_download('k1')" } });
      const link = el('A', { parent: body, attrs: { href: '/files/notice.pdf' } });
      const hash = el('A', { parent: body, attrs: { href: '#', onclick: "filedown('1')" } });
      const para = el('P', { parent: el('DIV', { parent: body }) });
      const two = el('A', { parent: body, attrs: { href: 'javascript:void(0)' } });
      const nodes = [
        { nodeValue: ' 미래 건설교통신기술인 장학사업 안내.pdf ', parentElement: el('SPAN', { parent: btn }) },           // 누르면 도는 동작(전북대)
        { nodeValue: '2026 장학생 선발 공고문.pdf [1.2MB]', parentElement: link },                                         // 화면이 그린 진짜 링크(국민대)
        { nodeValue: '추천 기준.hwp', parentElement: hash },                                                              // `#` 뒤의 동작(서울시립대)
        { nodeValue: '제출서류는 붙임의 장학금 신청서.hwp 를 내려받아 작성한 뒤 학과 사무실로 기한 안에 제출하시기 바랍니다', parentElement: para },   // 본문 문장 — 누를 수 없다
        { nodeValue: '안내 사항은 첨부한 유의사항 안내문.pdf (필독) 을 꼭 확인한 뒤 신청해 주시기 바랍니다 문의는 장학팀', parentElement: el('SPAN', { parent: hash }) },   // 누를 수 있어도 문장
        { nodeValue: '숨은 양식.hwp', parentElement: el('A', { parent: body, attrs: { href: '/h.hwp' }, hidden: true }) },   // 안 보인다
        { nodeValue: 'var f = "틀 속 이름.hwp"', parentElement: el('SCRIPT', { parent: body, inside: 'script' }) },           // 스크립트 속 글자
        { nodeValue: '붙임1 신청서.hwp', parentElement: two }, { nodeValue: '붙임2 서약서.hwp', parentElement: two },       // 한 단추에 둘
        { nodeValue: '추천 기준.hwp', parentElement: el('A', { parent: body, attrs: { href: '/dup.hwp' } }) },               // 같은 이름 또
      ];
      const saved = [globalThis.document, globalThis.NodeFilter];
      let got;
      try {
        let k = 0;
        globalThis.document = { body, createTreeWalker: () => ({ nextNode: () => nodes[k++] || null }) };
        globalThis.NodeFilter = { SHOW_TEXT: 4 };
        got = censusInPage(FILE_NAME_SRC);
      } finally { [globalThis.document, globalThis.NodeFilter] = saved; }
      eq('  🔴 화면에서 세는 것 — 누를 수 있는 것 안의 파일 이름만 · 본문 문장(누를 수 없음·글자가 길게 붙음)·안 보이는 것·스크립트 속 글자는 세지 않는다 · 같은 이름은 한 번 (리뷰 1)',
        got.map((x) => x.name), ['미래 건설교통신기술인 장학사업 안내.pdf', '2026 장학생 선발 공고문.pdf', '추천 기준.hwp', '붙임1 신청서.hwp', '붙임2 서약서.hwp']);
      eq('  진짜 링크는 주소를 주고 `#`·`javascript:`·단추는 빈 값(눌러서 잡는다) · 🔴 한 단추에 이름이 둘이면 둘째는 누르지 않는다(-1 — 표식을 덮어쓰지 않는다 · 리뷰 3)',
        [got.map((x) => x.href), got.map((x) => x.i), two.getAttribute('data-hdj-att')],
        [['', 'https://fake.example/files/notice.pdf', '', '', ''], [0, 1, 2, 3, -1], '3']);
    }
    {
      const u2 = (k) => `https://fake.example/${k}`;
      const led = { [canonUrl(u2('gap'))]: { att: today, attSeen: 2, attGap: 1 }, [canonUrl(u2('fine'))]: { att: today, attSeen: 1, attGap: 0 },
        [canonUrl(u2('blocked'))]: { attTries: 3, attAt: today }, [canonUrl(u2('once'))]: { attTries: 1, attAt: today }, [canonUrl(u2('closed'))]: { att: today, attSeen: 2, attGap: 2 } };
      const al = attachmentAlarms([{ id: 'gap', name: 'g', sourceUrl: u2('gap'), attachments: [{ name: 'a.hwp', url: '' }], listedAt: today }, { id: 'fine', name: 'f', sourceUrl: u2('fine'), attachments: [], listedAt: today },
        { id: 'blocked', name: 'b', sourceUrl: u2('blocked'), attachments: [], listedAt: today }, { id: 'closed', name: 'c', sourceUrl: u2('closed'), deadline: shift(today, -1) },
        { id: 'new', name: 'n', sourceUrl: u2('new'), listedAt: today }, { id: 'once', name: 'o', sourceUrl: u2('once'), listedAt: today }, { id: 'prog', name: 'p', sourceUrl: u2('prog'), program: true }], led, today);
      eq('  경보 — 이름만 보이는 첨부가 남은 공고 · 원문을 세 번 열지 못한 공고만(한 번 못 연 것은 아직) · 마감 지난 공고·상시 제도는 빼고 · 안 살핀 공고는 수로',
        [al.rows.map((r) => r.id), al.notYet, al.checked], [['gap', 'blocked'], 3, 2]);
      eq('  피드 진단 — 글이 8건 이상인데 첨부 있는 글이 다섯에 하나도 안 되는 학교만 · 적은 순',
        feedAttachmentGaps([...Array.from({ length: 16 }, () => ({ school: '가대', attachments: [] })), ...Array.from({ length: 16 }, (_, i) => ({ school: '나대', attachments: i < 3 ? [{ name: 'a' }] : [] })),
          ...Array.from({ length: 16 }, (_, i) => ({ school: '다대', attachments: i < 4 ? [{ name: 'a' }] : [] })), ...Array.from({ length: 5 }, () => ({ school: '라대', attachments: [] }))]).map((g) => [g.school, g.total, g.withAtt]),
        [['가대', 16, 0], ['나대', 16, 3]]);
    }
    /* 주소 읽기 길(일반 수집기 · 물러선 HTML) — `href="#" onclick="filedown(…)"` (서울시립대) */
    eq('  `href="#"` 뒤에 숨은 내려받기 동작도 첨부로 본다(이름이 파일 이름일 때만) — 펼치기 단추·맨 위로·「첨부파일 보기」는 첨부가 아니다',
      detailAttachments(`<span>첨부파일 :</span><a href="#" onclick="filedown('20261117', '1','1');return false;" class="filedown"> 2026 국가우수장학금(이공계) 추천 기준.pdf</a>
        <a href="#" onclick="toggleMenu();return false;">전체 메뉴 열기</a><a href="#top">맨 위로 가기</a><a href="#" onclick="openAttachLayer()">첨부파일 보기</a>`, 'https://scholarship.example.ac.kr/notice/view.do').map((a) => a.name),
      ['2026 국가우수장학금(이공계) 추천 기준.pdf']);

    /* 진짜 로봇 — 가짜 브라우저(위 att-…) + 가짜 fetch(로그인 화면을 주는 주소 하나) */
    const sb = sandbox(root, 'hdj-att-');
    try {
      sb.module('playwright', { 'package.json': JSON.stringify({ name: 'playwright', type: 'module', main: 'index.mjs', exports: './index.mjs' }), 'index.mjs': FAKE_PLAYWRIGHT });
      sb.write('fake-fetch.mjs', ["import fs from 'node:fs';",
        'globalThis.fetch = async (url) => {',
        "  if (process.env.FAKE_FETCH_LOG) fs.appendFileSync(process.env.FAKE_FETCH_LOG, String(url) + '\\n');",
        "  const bytes = new TextEncoder().encode(/login/.test(String(url)) ? '<!DOCTYPE html><html><head><title>로그인</title></head></html>' : 'HWP Document File');",
        '  return { status: 200, ok: true, body: { getReader: () => ({ read: async () => ({ value: bytes, done: false }), cancel: async () => {} }) } };',
        '};', ''].join('\n'));
      const u = (k) => `https://fake.example/${k}?id=${k.length}`;
      const read = { eligibilityLines: ['직전학기 평점평균 3.0 이상인 재학생'], amount: '등록금 전액', deadline: shift(today, 10) };   // 자격·금액·마감을 이미 읽은 공고 — 본문 대상이 아니다
      const item = (id, k, extra = {}) => ({ id, name: `표본 ${id} 장학생 선발 안내 공고`, sourceUrl: u(k), attachments: [], listedAt: today, ...extra });
      sb.write('data/registered.json', { items: [
        item('click', 'att-click-ok-a'),                                   // 본문 대상 + 눌러서 받는 첨부
        item('login', 'att-click-login-b'),                                // 눌러서 잡은 주소가 로그인 화면을 준다
        item('href', 'att-href-c'),                                        // 화면이 그린 진짜 링크
        item('only', 'att-click-ok-d', read),                              // 본문은 이미 읽음 — 첨부만 살핀다
        item('up', 'att-click-ok-e', { ...read, attachments: [{ name: '1. 2026 표본 장학금 신청서.hwp', url: "javascript:dl('7')" }] }),   // 이름만 있던 기록
        item('shut', 'att-click-ok-f', { ...read, deadline: shift(today, -1) }),   // 마감 지남 — 안 연다
        item('junk', 'att-junk-g', read),                                  // 첨부만 살피는 공고의 화면에 메뉴 링크·단추·로고가 있다
        item('err', 'att-err-h', read),                                    // 첨부만 살피러 갔는데 열리지 않는다
      ] });
      sb.write('collector/rescue-ledger.json', { [canonUrl(u('att-click-ok-d'))]: { ok: shift(today, -3), at: shift(today, -3), tries: 0, name: 'x' } });
      sb.write('data/notices.json', { items: Array.from({ length: 9 }, (_, i) => ({ title: `글 ${i}`, url: `https://fake.example/n${i}`, school: '표본대학교', attachments: [] })) });
      const pre = sb.run('collector/rescue-bodies.mjs', [], {});
      eq('  로봇 미리보기 — 본문 차례 줄은 그대로(본문 대상만) · 첨부만 살필 공고는 따로 한 줄(본문 대상 뒤 · 마감 지난 공고는 없다)',
        [pre.status, (pre.out.match(/차례: ([^\n]*)/) || [])[1], (pre.out.match(/첨부 살피기 \d+건 \(본문 대상 뒤에\): ([^\n]*)/) || [])[1]],
        [0, 'click · login · href', 'up · junk · err · only']);   // 확보 기록이 없는 공고(up) 먼저 — orderTargets
      const env = { FAKE_PW_LOG: sb.abs('pw.log'), FAKE_FETCH_LOG: sb.abs('fetch.log'), RESCUE_GAP_MS: '0', RESCUE_BUDGET_MS: '120000', RESCUE_CAP: '10' };
      const w = sb.run('collector/rescue-bodies.mjs', ['--write'], env, 25000, ['--import', sb.abs('fake-fetch.mjs')]);
      const regNow = (sb.json('data/registered.json') || { items: [] }).items;
      const A = (id) => ((regNow.find((x) => x.id === id) || {}).attachments || []).map((a) => [a.name, a.url]);
      const led = sb.json('collector/rescue-ledger.json') || {};
      const L = (k) => led[canonUrl(u(k))] || {};
      const rep = sb.read('collector/rescue-report.md') || '';
      const pw = (sb.read('pw.log') || '').split('\n');
      eq('  🔴 눌러서 내려받기가 시작되면 그 주소를 적는다(새 요청으로 파일이 오는 것을 본 뒤) — 링크가 아니라 동작으로 내려 주는 게시판(전북대 꼴)',
        [w.status, A('click')], [0, [['2026 표본 장학금 신청서.hwp', 'https://fake.example/dl/file.hwp']]]);
      eq('  🔴 잡은 주소가 새 요청에 로그인 화면을 주면 주소를 적지 않는다 — 이름만 적고(앱은 「원문 게시판에서 내려받기」) 장부에 못 구한 수를 남긴다',
        [A('login'), L('att-click-login-b').attSeen, L('att-click-login-b').attGap], [[['2026 표본 장학금 지원서.hwp', '']], 1, 1]);
      eq('  화면이 그린 진짜 링크는 누르지 않고 그대로 적는다(국민대 꼴 — 목록이 뜬 뒤에 그려진다) · 누른 것은 주소 없는 넷뿐',
        [A('href'), pw.filter((l) => /^click /.test(l)).length], [[['2026 표본 장학금 공고문.pdf', 'https://fake.example/files/notice.pdf']], 4]);
      eq('  첨부만 살피러 간 공고 — 첨부는 적고 · 본문 칸(확보 날짜·실패 횟수)은 그대로 · 본문 파일에 안 들어간다',
        [A('only'), L('att-click-ok-d').ok, L('att-click-ok-d').tries, L('att-click-ok-d').att, L('att-click-ok-d').attGap, !!(sb.json('collector/extracted/browser-bodies.json') || {})[u('att-click-ok-d')]],
        [[['2026 표본 장학금 신청서.hwp', 'https://fake.example/dl/file.hwp']], shift(today, -3), 0, today, 0, false]);
      eq('  이름만 있던 기록(`javascript:`)에는 주소만 채운다 — 이름·개수는 그대로(같은 파일을 한 번 더 쌓지 않는다)',
        A('up'), [['1. 2026 표본 장학금 신청서.hwp', 'https://fake.example/dl/file.hwp']]);
      eq('  🔴 첨부만 살피러 간 공고에는 메뉴 링크(주소에 file·attach)·단추 글자(「첨부파일 다운로드」「보기」)·로고 그림을 적지 않는다 — 분명한 내려받기 주소만',
        A('junk'), [['2026 표본 장학금 신청 안내문', 'https://fake.example/notice.do?mode=download&attachNo=7']]);
      eq('  🔴 첨부만 살피러 갔는데 열리지 않으면 — 살폈다고 적지 않고 첨부 쪽 실패만 한 번 센다 · 본문 칸(실패 횟수)은 생기지 않는다(리뷰 2)',
        [L('att-err-h').att, L('att-err-h').attTries, L('att-err-h').attAt, L('att-err-h').tries], [undefined, 1, today, undefined]);
      eq('  마감 지난 공고는 열지 않는다 · 본문 대상은 본문도 확보하고 살핀 기록도 남는다',
        [pw.some((l) => l.includes('att-click-ok-f')), L('att-click-ok-a').ok, L('att-click-ok-a').att], [false, today, today]);
      eq('  리포트 맨 위(실행 날짜 바로 아래)에 첨부 경보 — 못 구한 공고가 🚨 로 · 피드에서 첨부가 안 잡히는 학교 표',
        [/^실행: \d{4}-\d{2}-\d{2}\n\n## 📎 첨부/m.test(rep), (rep.match(/^- 🚨 .*\(login\)/gm) || []).length, /경보 \*\*1건\*\*/.test(rep), /- 표본대학교 — 글 9건 중 첨부 있는 글 0건/.test(rep)],
        [true, 1, true, true]);
      const alarm = sb.run('collector/attach-alarm.mjs', [], {});
      eq('  경보 세기 도구(attach-alarm.mjs)가 같은 셈을 한 줄씩 찍는다 — 못 구한 공고 1건 · 이름과 id',
        [alarm.status, /^count=1$/m.test(alarm.out), /^list=표본 login 장학생 선발 안내 공고\(login\)$/m.test(alarm.out)], [0, true, true]);
      const again = sb.run('collector/rescue-bodies.mjs', [], {});
      eq('  다시 돌리면 살핀 공고는 다시 안 연다 — 못 구한 공고도 이레 안에는 쉰다 · 한 번 못 연 공고만 다시 간다(세 번까지)',
        [again.status, (again.out.match(/첨부 살피기 \d+건 \(본문 대상 뒤에\): ([^\n]*)/) || [])[1]], [0, 'err']);
      const led2 = { ...led, [canonUrl(u('att-click-login-b'))]: { ...L('att-click-login-b'), att: shift(today, -8), ok: shift(today, -1) } };
      sb.write('collector/rescue-ledger.json', led2);
      const later2 = sb.run('collector/rescue-bodies.mjs', [], {});
      eq('  여드레가 지나면 못 구한 공고도 다시 살핀다', (later2.out.match(/첨부 살피기 \d+건 \(본문 대상 뒤에\): ([^\n]*)/) || [])[1], 'login · err');
    } finally {
      sb.done();
    }
    /* ── ① ⓔ-2 공고 화면 자신의 주소는 첨부 주소가 아니다 (2026-11-18 · 제보 "PDF 등 문서가 앱에 안 올라오거나 일부만") ──
       브라우저는 `href="#"`·빈 href 를 화면 주소로 풀어 준다(a.href) → http(s) 라 '받을 주소 있음'으로 세어 누르지 않았고,
       학생이 「신청서.hwp」를 누르면 공고 화면이 다시 열렸다 · 장부는 attGap 0 이라 다시 살피지도 경보도 없었다(서울시립대 언론인회 · 서울과기대 #n- 표식) */
    {
      const P = 'https://board.example.ac.kr/view.do?brdSeq=1&identified=anonymous&';
      eq('① ⓔ-2 화면 주소 판정 — 조각(#…)을 떼고 같으면 화면 자신 · `&amp;` 는 되푼다 · 다른 주소·javascript:·빈 값은 아니다',
        [pageSelfUrl(`${P}#`, [P]), pageSelfUrl(`${P}#n-%EC%84%9C%EC%8B%9D.hwp`, [P]), pageSelfUrl(P.replace(/&/g, '&amp;'), [P]), pageSelfUrl('https://board.example.ac.kr/dl.do?id=1', [P]),
          pageSelfUrl("javascript:filedown('1')", [P]), pageSelfUrl('', [P]), pageSelfUrl(`${P}#`, ['', null])],
        [true, true, true, false, false, false, false]);
      eq('  걷어 내기 — 같은 이름에 진짜 주소 줄이 있으면 화면 주소 줄을 지우고 · 없으면 이름만 남긴다 · 본문 그림·다른 첨부는 그대로',
        dropSelfLinks([{ name: '공고문.hwpx', url: 'https://board.example.ac.kr/dl.do?id=1' }, { name: '공고문.hwpx', url: `${P}#n-x` }, { name: '신청서.hwp', url: `${P}#` },
          { name: '본문이미지-900x900.jpg', url: `${P}#`, bodyImage: true }, { name: '규정.hwp', url: "javascript:dl('2')" }], [P]).map((a) => [a.name, a.url]),
        [['공고문.hwpx', 'https://board.example.ac.kr/dl.do?id=1'], ['신청서.hwp', ''], ['본문이미지-900x900.jpg', `${P}#`], ['규정.hwp', "javascript:dl('2')"]]);
      eq('  걷어 낸 뒤의 셈 — 화면 주소 줄은 받을 주소가 아니라 장부가 못 구한 것으로 센다(경보·다시 살피기가 돈다)',
        [attGapOf(['신청서.hwp'], [{ name: '신청서.hwp', url: `${P}#` }]), attGapOf(['신청서.hwp'], dropSelfLinks([{ name: '신청서.hwp', url: `${P}#` }], [P]))], [0, 1]);
      /* 새로 적는 길 — 브라우저 안 주소 읽기(linksFromAnchors). a.href 는 그 프레임 화면 주소로 풀리므로(iframe 안이면 iframe 주소) 글자(getAttribute)로 가린다(리뷰 11-18 ①) */
      const A = (text, raw, href, prev) => ({ textContent: text, getAttribute: () => raw, href, previousElementSibling: prev ? { textContent: prev } : null });
      const IF = 'https://board.example.ac.kr/inner/view.jsp?x=1';
      eq('  주소 읽기 — 빈 href·`#…` 는 주소가 아니다(작은 창 안이어도) · 진짜 링크·`javascript:` 는 그대로 · 단추 글자(`다운로드`)는 앞 요소 이름',
        linksFromAnchors([A('2026 서식.hwp', '#', `${IF}#`), A('신청서.hwp', '#none', `${IF}#none`), A('빈.hwp', '', IF), A(' 공고문.pdf ', '/dl.do?id=2', 'https://board.example.ac.kr/dl.do?id=2'),
          A('다운로드', '/f.hwp', 'https://board.example.ac.kr/f.hwp', '추천서 양식.hwp'), A('규정.hwp', "javascript:fileDown('3')", "javascript:fileDown('3')")], BUTTON_WORD.source).map((l) => [l.name, l.url]),
        [['2026 서식.hwp', ''], ['신청서.hwp', ''], ['빈.hwp', ''], ['공고문.pdf', 'https://board.example.ac.kr/dl.do?id=2'], ['추천서 양식.hwp', 'https://board.example.ac.kr/f.hwp'], ['규정.hwp', "javascript:fileDown('3')"]]);
      const rbSrc = stripComments(readText('collector/rescue-bodies.mjs'));
      eq('  배선 — 로봇의 주소 읽기가 그 함수를 쓴다 · 이미 적힌 줄 걷기는 화면을 실제로 본 날에만(못 연 날 걸으면 다시 살필 표시만 사라진다 · 리뷰 11-18 ②)',
        [/\$\$eval\('a\[href\]', linksFromAnchors, BUTTON_WORD\.source\)/.test(rbSrc), /if \(!r\.error && text\) \{\s*const before = t\.it\.attachments/.test(rbSrc)], [true, true]);
      /* 진짜 로봇 — 가짜 브라우저 att-click-self(위) · 장부가 잘못 '다 구함'으로 적은 공고 하나 */
      const sb2 = sandbox(root, 'hdj-att-self-');
      try {
        sb2.module('playwright', { 'package.json': JSON.stringify({ name: 'playwright', type: 'module', main: 'index.mjs', exports: './index.mjs' }), 'index.mjs': FAKE_PLAYWRIGHT });
        sb2.write('fake-fetch.mjs', ["globalThis.fetch = async () => {",
          "  const bytes = new TextEncoder().encode('HWP Document File');",
          '  return { status: 200, ok: true, body: { getReader: () => ({ read: async () => ({ value: bytes, done: false }), cancel: async () => {} }) } };',
          '};', ''].join('\n'));
        const u = (k) => `https://fake.example/${k}?id=${k.length}`;
        const read = { eligibilityLines: ['직전학기 평점평균 3.0 이상인 재학생'], amount: '등록금 전액', deadline: shift(today, 10) };
        sb2.write('data/registered.json', { items: [
          { id: 'self', name: '표본 self 장학생 선발 안내 공고', sourceUrl: u('att-click-self-i'), attachments: [], listedAt: today, ...read },
          { id: 'heal', name: '표본 heal 장학생 선발 안내 공고', sourceUrl: u('att-href-j'), listedAt: today, ...read,
            attachments: [{ name: '2026 표본 장학금 공고문.pdf', url: 'https://fake.example/files/notice.pdf' }, { name: '2026 표본 장학금 공고문.pdf', url: `${u('att-href-j')}#n-x` }] },
          { id: 'done', name: '표본 done 장학생 선발 안내 공고', sourceUrl: u('att-href-k'), listedAt: today, ...read,
            attachments: [{ name: '2026 표본 장학금 공고문.pdf', url: 'https://fake.example/files/notice.pdf' }] },
          { id: 'errheal', name: '표본 errheal 장학생 선발 안내 공고', sourceUrl: u('att-err-z'), listedAt: today, ...read,
            attachments: [{ name: '2026 표본 장학금 서식.hwp', url: `${u('att-err-z')}#` }] },   // 화면 주소 줄이 있는데 오늘은 안 열린다
        ] });
        /* heal·done·errheal 은 어제 살펴 '다 구함(attGap 0)'으로 적혀 있다 — heal·errheal 은 화면 주소 줄이 남아 있어 다시 가야 하고, done 은 안 간다 */
        const yday = shift(today, -1);
        sb2.write('collector/rescue-ledger.json', { [canonUrl(u('att-href-j'))]: { att: yday, attSeen: 1, attGap: 0 }, [canonUrl(u('att-href-k'))]: { att: yday, attSeen: 1, attGap: 0 },
          [canonUrl(u('att-err-z'))]: { att: yday, attSeen: 1, attGap: 0 } });
        const pickAtt = (run) => ((run.out.match(/첨부 살피기 \d+건 \(본문 대상 뒤에\): ([^\n]*)/) || [])[1] || '').split(' · ').filter(Boolean).sort();
        const pre2 = sb2.run('collector/rescue-bodies.mjs', [], {});
        eq('  🔴 장부보다 지금 데이터 — 화면 주소가 첨부로 적힌 공고는 장부가 \'다 구함\'이어도 다시 살핀다 · 진짜 주소뿐인 공고는 안 간다', [pre2.status, pickAtt(pre2)], [0, ['errheal', 'heal', 'self']]);
        const w2 = sb2.run('collector/rescue-bodies.mjs', ['--write'], { RESCUE_GAP_MS: '0', RESCUE_BUDGET_MS: '120000', RESCUE_CAP: '10' }, 25000, ['--import', sb2.abs('fake-fetch.mjs')]);
        const reg2 = (sb2.json('data/registered.json') || { items: [] }).items;
        const A2 = (id) => ((reg2.find((x) => x.id === id) || {}).attachments || []).map((a) => [a.name, a.url]);
        const led2b = sb2.json('collector/rescue-ledger.json') || {};
        eq('  🔴 `href="#"` 첨부는 화면 주소를 적지 않고 **눌러서** 진짜 내려받기 주소를 잡는다(서울시립대 꼴) · 장부도 다 구함',
          [w2.status, A2('self'), (led2b[canonUrl(u('att-click-self-i'))] || {}).attGap], [0, [['2026 표본 장학금 서식.hwp', 'https://fake.example/dl/file.hwp']], 0]);
        eq('  이미 적힌 화면 주소 줄은 살필 때 걷는다 — 같은 이름의 진짜 주소 줄이 있으면 그 줄만 남는다(서울과기대 꼴) · 리포트에 🧹 한 줄',
          [A2('heal'), /🧹 표본 heal/.test(sb2.read('collector/rescue-report.md') || '')], [[['2026 표본 장학금 공고문.pdf', 'https://fake.example/files/notice.pdf']], true]);
        const errLed = led2b[canonUrl(u('att-err-z'))] || {};
        eq('  🔴 안 열린 날엔 걷지 않는다 — 화면 주소 줄이 그대로 남고(다시 살필 표시) · 장부엔 못 연 횟수만(옛 \'살핀 날\'은 그대로) (리뷰 11-18 ②)',
          [A2('errheal'), errLed.attTries, errLed.att], [[['2026 표본 장학금 서식.hwp', `${u('att-err-z')}#`]], 1, yday]);
        const again2 = sb2.run('collector/rescue-bodies.mjs', [], {});
        eq('  …그래서 다음 실행이 그 공고를 다시 고른다(살핀 self·heal 은 이제 안 간다) — 못 연 횟수의 쉼은 그대로 지킨다', pickAtt(again2), ['errheal']);
      } finally {
        sb2.done();
      }
    }
    {
      const wf = stripYamlComments(readText('.github/workflows/rescue-bodies.yml'));
      const iSave = wf.indexOf('- name: 저장'), iCount = wf.indexOf('node collector/attach-alarm.mjs >> "$GITHUB_OUTPUT"');
      const TITLE = 'title: 🚨 원문에 있는 첨부가 앱에 다 안 보여요';
      eq('  워크플로 — 저장 뒤에 세고 · 0 이 아니면 이슈를 열고 0 이면 닫는다(같은 제목 한 짝) · 세지 못했으면(빈 값) 열지도 닫지도 않는다',
        [iSave > 0 && iCount > iSave, (wf.match(new RegExp(TITLE, 'g')) || []).length,
          /if: always\(\) && steps\.att\.outputs\.count != '' && steps\.att\.outputs\.count != '0'[\s\S]{0,200}?mode: open/.test(wf.replace(/\n\s+(?:timeout-minutes|continue-on-error|uses|with|token)[^\n]*/g, '')),
          /if: always\(\) && steps\.att\.outputs\.count == '0'[\s\S]{0,200}?mode: resolve/.test(wf.replace(/\n\s+(?:timeout-minutes|continue-on-error|uses|with|token)[^\n]*/g, ''))],
        [true, 2, true, true]);
    }
    const rb = stripComments(readText('collector/rescue-bodies.mjs'));
    eq('  첨부 살피기는 제 몫의 시한 안에서만 돌고(한 공고 시한을 넘기면 본문까지 시한 초과가 된다) · 누르는 수에 상한 · 화면이 넘어갔으면 그만 · 따로 try 로 감싼다',
      [/const until = Date\.now\(\) \+ ATT_BUDGET_MS/.test(rb), /clicks < ATT_MAX_CLICKS && Date\.now\(\) < until && page\.url\(\) === at/.test(rb), /seenNames = \[\];\s*try \{/.test(rb)],
      [true, true, true]);
    eq('  누르기·세기·취소에 시한을 준다(표식이 사라지면 기본 30초를 기다린다 · 리뷰 3) · 안 내려오면 더 누르지 않는다(리뷰 6) · 제 창의 탭만 닫는다(리뷰 7)',
      [/\.evaluate\(\(e\) => e\.click\(\), undefined, \{ timeout: left\(\) \}\)/.test(rb), /settle\(f\.evaluate\(censusInPage, FILE_NAME_SRC\), \d+\)/.test(rb), /settle\(dl\.cancel\(\), \d+\)/.test(rb),
        /if \(!url\) clicks = ATT_MAX_CLICKS/.test(rb), /const pageCtx = ctx;/.test(rb) && /for \(const p of pageCtx\.pages\(\)\)/.test(rb) && !/for \(const p of ctx\.pages\(\)\)/.test(rb)],
      [true, true, true, true, true]);
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

    /* 두 스크립트(github-script)를 **진짜로 돌린다** — 글자 검사만으로는 '옛 판 리포트를 붙이지 않는다'를 지워도 통과했다(red-green 에서 드러남).
       가짜 github·context 와 가짜 fs(리포트 표본)로 부른다. 리포트의 '실행:' 은 한국 날짜다. */
    const raw = readText('.github/workflows/rescue-bodies.yml');
    const scriptOf = (name) => {
      const i = raw.indexOf(`- name: ${name}\n`);
      const m = i < 0 ? null : raw.slice(i).match(/\n {10}script: \|\n((?: {12}[^\n]*\n|[ \t]*\n)+)/);
      return m ? m[1].replace(/^ {12}/gm, '') : '';
    };
    const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;
    const ctxFake = { serverUrl: 'https://github.example', repo: { owner: 'o', repo: 'r' }, runId: 4242 };
    const runUrl = 'https://github.example/o/r/actions/runs/4242';
    const runAlert = async (report) => {
      const made = [];
      const fakeFs = { readFileSync: () => { if (report === null) throw new Error('ENOENT'); return report; } };
      try {
        await new AsyncFunction('require', 'github', 'context', scriptOf('실패하면 이슈로 알린다'))(
          (m) => (m === 'fs' ? fakeFs : null), { rest: { issues: { create: async (o) => { made.push(o); } } } }, ctxFake);
      } catch (e) { return `스크립트 오류: ${e.message}`; }
      return made.length === 1 ? `${made[0].title}\n${made[0].body}` : `이슈 ${made.length}건`;
    };
    const fresh = await runAlert(`# 리포트\n\n실행: ${kstToday()}\n\n- ⏱ 오늘표본공고 — 60초 안에 끝나지 않아 건너뜀\n`);
    const stale = await runAlert('# 리포트\n\n실행: 2026-09-30\n\n- · 옛표본공고 — 본문 없음 (4회째)\n');
    const none = await runAlert(null);
    eq('  실패 알림을 진짜로 돌리면 — 오늘 리포트는 붙이고 · 옛 판(9-30) 리포트는 안 붙이고 그 날짜를 적고 · 리포트가 없어도 이슈는 생긴다 · 셋 다 실행 로그 주소 (bodies-7)',
      [/오늘표본공고/.test(fresh), /옛표본공고/.test(stale), /2026-09-30 판이라 붙이지 않았습니다/.test(stale), /리포트가 없습니다/.test(none),
        [fresh, stale, none].every((b) => b.includes(runUrl)), /^🚨 원문 받기 로봇/.test(fresh)],
      [true, false, true, true, true, true]);
    const closed = [];
    const commented = [];
    try {
      await new AsyncFunction('github', 'context', scriptOf('성공하면 옛 실패 이슈를 닫는다'))({
        paginate: async (fn, opts) => (opts.labels === 'rescue-bodies' && opts.state === 'open' ? [{ number: 7 }, { number: 8, pull_request: {} }] : []),
        rest: { issues: { listForRepo: () => {}, createComment: async (o) => { commented.push([o.issue_number, o.body.includes(runUrl)]); },
          update: async (o) => { closed.push([o.issue_number, o.state, o.state_reason]); } } },
      }, ctxFake);
    } catch (e) { closed.push(`스크립트 오류: ${e.message}`); }
    eq('  성공 정리를 진짜로 돌리면 — rescue-bodies 라벨의 열린 이슈만(끌어오기 요청 빼고) 실행 로그 주소를 남기고 닫는다 (bodies-7)',
      [commented, closed], [[[7, true]], [[7, 'closed', 'completed']]]);
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
    /* 리뷰 12차 — 첨부 로봇이 제 목록(「공고문 첨부」)을 새로 읽은 목록으로 바꾸며 서류 줄이 준 글은 수집 리포트 끝에 남아야 한다(리뷰 11차) —
       글자 셋만 보던 검사는 모으는 줄(`if (lost) shrunk.push`)을 지워도 초록이었다 → 임시 폴더에서 --apply 를 진짜 돌려 목록이 바뀌고 리포트에 그 절이 생기는지 본다 */
    const sb3 = sandbox(root, 'hdj-actshrink-');
    try {
      const u = 'https://act.example/post/9';
      sb3.write('collector/extracted/notices-text.json', []);
      sb3.write('data/registered.json', { items: [] });
      sb3.write('data/activities.json', { items: [{ title: '청년 공모전 참가자 모집', url: u, documents: ['옛 서류 가 1부', '옛 서류 나 1부', '옛 서류 다 1부'], documentsFrom: '공고문 첨부' }] });
      sb3.write('collector/act-files/manifest.json', { [u]: ['p9-0.jpg'] });
      sb3.write('collector/act-files/p9-0.jpg', 'x');
      sb3.write('collector/act-files/p9-0.jpg.ocr.txt', '청년 공모전 참가자 모집\n모집대상 : 도내 거주 청년 누구나\n제출서류 : 참가신청서 1부\n');
      sb3.write('collector/report.md', '# 수집 리포트\n');
      const r = sb3.run('collector/activity-docs.mjs', ['--apply'], {});
      const rep = sb3.read('collector/report.md') || '';
      const it = ((sb3.json('data/activities.json') || { items: [] }).items[0]) || {};
      eq('② ⓔ 첨부에서 다시 읽어 서류 줄이 준 글 — 목록은 새로 읽은 것으로 바뀌고(3→1) 수집 리포트 끝에 이름과 줄 수가 남는다(--apply 를 임시 폴더에서 진짜로)',
        [r.status, it.documents, it.documentsFrom, /### 📎 대외활동 — 첨부에서 다시 읽어 서류 줄이 준 글 1건/.test(rep), /청년 공모전 참가자 모집 3→1줄/.test(rep)],
        [0, ['참가신청서 1부'], '공고문 첨부(OCR)', true, true]);
    } finally {
      sb3.done();
    }
  }
  {
    /* PaddleOCR 을 까는·부르는 줄 **전부**를 본다(2026-10-05 병합 — 기본 브랜치가 장학 포스터 단계를 새로 달며 `|| true` 로 삼키고 설치 줄은
       경고 없이 두었다: 설치가 실패하면 bash -e 에 끊겨 같은 단계의 주인 확인이 안 돌았다). 파일 목록을 박지 않고 워크플로 전부에서 찾는다. */
    const pins = new Map();
    const wfDir = new URL('.github/workflows/', root);
    for (const f of fs.readdirSync(wfDir).filter((x) => x.endsWith('.yml')).sort()) {
      const lines = stripYamlComments(readText(`.github/workflows/${f}`)).split('\n');
      const installs = lines.filter((l) => /pip install[^\n]*paddleocr/.test(l));
      const runs = lines.filter((l) => /python3 collector\/paddle-ocr\.py/.test(l));
      if (!installs.length && !runs.length) continue;
      for (const l of installs) {
        const pin = (l.match(/paddlepaddle==[\d.]+ paddleocr==[\d.]+/) || ['(판 고정 없음)'])[0];
        pins.set(pin, [...(pins.get(pin) || []), f]);
      }
      eq(`② ⓒ ${f} — PaddleOCR 설치 ${installs.length}줄·읽기 ${runs.length}줄 전부 실패를 \`|| true\` 로 삼키지도, 경고 없이 bash -e 에 끊기지도 않는다(경고를 남기고 같은 단계 다음 줄은 계속 · gaps-02)`,
        [...installs, ...runs].filter((l) => /\|\| true/.test(l) || !/\|\| (?:\{ touch [^;]+; )?echo "::warning::/.test(l)).map((l) => l.trim().slice(0, 70)), []);   // 설치 줄은 표식 파일을 남기고 경고(경보 짝 · 2026-10-28)
    }
    eq(`  PaddleOCR 판 고정은 모든 워크플로·단계가 한 벌 — 두 판이 섞이면 뒤 단계가 다른 판을 다시 깐다(단계가 여럿이라 설치 줄도 여럿 · 지금: ${[...pins.keys()].join(' / ')})`,
      pins.size === 1 && !pins.has('(판 고정 없음)'), true);
    /* 읽은 결과(paddle-status.json)는 읽는 폴더에 남는다 — 장학 포스터 단계는 collector/extracted 를 읽는데, 수집 저장 단계가 그 폴더를 통째로
       add 하므로 무시 규칙이 없으면 매 실행 커밋된다(2026-10-05 병합). 부르는 폴더를 워크플로에서 뽑아 git 에 직접 묻는다. */
    const folders = [...new Set(fs.readdirSync(wfDir).filter((x) => x.endsWith('.yml'))
      .flatMap((f) => [...stripYamlComments(readText(`.github/workflows/${f}`)).matchAll(/python3 collector\/paddle-ocr\.py (\S+)/g)].map((m) => m[1])))].sort();
    const notIgnored = folders.filter((d) => spawnSync('git', ['check-ignore', '-q', `${d}/paddle-status.json`], { cwd: fileURLToPath(root) }).status !== 0);
    eq(`  PaddleOCR 결과 파일(paddle-status.json)은 읽는 폴더(${folders.join(' · ')}) 어디서든 커밋되지 않는다`, notIgnored, []);
  }
  {
    /* ② ⓓ 라이브러리 표식이 새지 않는다 — 대외활동 로봇(activity-docs.mjs)을 함수만 쓰려고 불러오는 모듈은 표식(ACTIVITY_DOCS_AS_LIB)을 되돌려야 한다.
       2026-10-05 병합: 장학 그림 주인 확인(elig-ocr-guard.mjs)이 표식을 남겨, 그것을 먼저 불러온 test-collector 가 띄운 activity-docs.mjs --apply·--fetch
       자식이 본편을 안 돌고 0 으로 끝났다(②ⓑ 가 헛잼 → 빨간불 · 수집 로봇의 데이터 관문도 같은 길). 자식 프로세스에서 불러 보고 표식을 본다. */
    const leaks = [], seen = [];
    for (const f of fs.readdirSync(new URL('collector/', root)).filter((x) => x.endsWith('.mjs')).sort()) {
      const src = readText(`collector/${f}`);
      if (f === 'activity-docs.mjs' || !/import\(\s*['"]\.\/activity-docs\.mjs['"]\s*\)/.test(src) || !/ACTIVITY_DOCS_AS_LIB\s*=/.test(src)) continue;
      if (!/^export /m.test(src)) continue;   // 불러다 쓰는 모듈만(실행 전용 파일은 프로세스가 곧 끝난다)
      seen.push(f);
      const r = spawnSync(process.execPath, ['--input-type=module', '-e',
        `await import(${JSON.stringify(new URL(`collector/${f}`, root).href)}); console.log('AS_LIB=' + (process.env.ACTIVITY_DOCS_AS_LIB ?? '없음'));`],
        { encoding: 'utf8', timeout: 20000, env: cleanEnv() });
      const got = ((r.stdout || '').match(/AS_LIB=(\S+)/) || [])[1] || `(실행 실패 ${String(r.stderr || '').slice(-120)})`;
      if (got !== '없음') leaks.push(`${f}: ${got}`);
    }
    eq(`② ⓓ 대외활동 로봇을 함수로만 불러오는 모듈(${seen.join(' · ') || '없음'})은 라이브러리 표식(ACTIVITY_DOCS_AS_LIB)을 되돌린다 — 남기면 같은 프로세스가 띄우는 로봇 자식이 헛돈다`,
      [seen.length > 0, leaks], [true, []]);
    const prev = process.env.ACTIVITY_DOCS_AS_LIB;
    process.env.ACTIVITY_DOCS_AS_LIB = '1';
    const kept = [cleanEnv().ACTIVITY_DOCS_AS_LIB, cleanEnv({ ACTIVITY_DOCS_AS_LIB: '1' }).ACTIVITY_DOCS_AS_LIB];
    if (prev === undefined) delete process.env.ACTIVITY_DOCS_AS_LIB; else process.env.ACTIVITY_DOCS_AS_LIB = prev;
    eq('  관문이 띄우는 자식 환경(cleanEnv)은 표식을 물려주지 않는다 · 일부러 넘기면 남긴다', kept, [undefined, '1']);
  }
  /* ── ③ 자격용 공고문 첨부 받기(deepfetch --elig-attach) — 줄이 돌고(앞의 몇 건이 자리를 차지하지 않는다) · 다시 받아도 파생 글자 보존 (bodies-3·bodies-5) ──
     고르기는 기본 브랜치의 elig-targets.mjs pickEligTargets 한 곳(2026-10-05 · 시도한 날 `at` · 사흘 쉼 · 안 해 본 것 → 오래된 것).
     점검 수리(elig-attach-plan.mjs 의 '받은 그대로면 건너뛰기')는 병합 때 걷었다 — 같은 일을 하는 고르기가 둘이 되지 않게(2026-10-05).
     남은 점검 수리는 deepfetch 의 '갈아끼우기': 미리 몽땅 지우지 않는다 · 받은 바이트가 같으면 파생 글자를 지우지 않는다 · 못 받으면 옛 파일 그대로. */
  {
    const today = '2026-10-04';
    const att = [{ name: '2026 장학생 선발 공고문.hwp', url: 'https://f.example/x.hwp' }];
    const items = [];
    const index = {};
    for (let i = 1; i <= 6; i++) {   // 1~6 은 어제 받아 봤다(자격은 여전히 못 읽음) — 예전엔 매 실행 이 여섯이 앞자리를 다 차지했다
      items.push({ id: `n${i}`, attachments: att });
      index[`n${i}`] = { slug: `s${i}`, files: [`elig-s${i}-1.hwp`], at: shift(today, -1) };
    }
    items.push({ id: 'n7', attachments: att }, { id: 'n8', attachments: att });                                      // 처음
    items.push({ id: 'n13', attachments: att }); index.n13 = { slug: 's13', files: [], at: shift(today, -10) };        // 열흘 전에 해 봤다
    items.push({ id: 'n14', attachments: att, eligibilityLines: ['재학생'], deadline: '2026-10-30', amountValue: 1000000 });   // 다 읽었다
    items.push({ id: 'n15', attachments: att, eligibilityLines: ['재학생'], deadline: '2026-10-30' });               // 자격만 읽고 금액이 비었다
    const o = { requirementLines: (it) => it.eligibilityLines || [], docAtts: (it) => it.attachments, live: () => true, max: 6 };
    eq('③ 받을 차례 — 처음(7·8·15) → 오래전에 해 본 것(13) · 어제 해 본 1~6 은 쉬고(앞자리를 차지하지 않는다) · 다 읽은 것(14)은 없다 (bodies-3)',
      pickEligTargets(items, index, today, o).map((t) => t.it.id), ['n7', 'n8', 'n15', 'n13']);
  }
  {
    const FAKE = `import fs from 'node:fs';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
globalThis.fetch = async (url) => {
  url = String(url);
  if (process.env.FAKE_FETCH_LOG) fs.appendFileSync(process.env.FAKE_FETCH_LOG, url + '\\n');
  await sleep(Number(process.env.FAKE_FETCH_DELAY || 0));
  if (process.env.FAKE_FAIL && new RegExp(process.env.FAKE_FAIL).test(url)) return { ok: false, status: 404, headers: new Map() };
  const tag = process.env.FAKE_NEW && new RegExp(process.env.FAKE_NEW).test(url) ? 'new ' : 'fake ';
  const body = Buffer.from((tag + url + ' ').repeat(60));
  return { ok: true, status: 200, headers: new Map(), arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.length) };
};
`;
    const today = kstToday();
    const A = (k, ext = 'hwp') => [{ name: `2026 ${k} 장학생 선발 공고문.${ext}`, url: `https://f.example/${k}.${ext}` }];
    const run = (sb, env = {}) => {
      sb.write('fetch.log', '');
      const r = sb.run('collector/deepfetch.mjs', ['--elig-attach'], { FAKE_FETCH_LOG: sb.abs('fetch.log'), ...env }, 25000, ['--import', sb.abs('fake-fetch.mjs')]);
      const fetched = (sb.read('fetch.log') || '').split('\n').filter(Boolean).map((u) => u.replace('https://f.example/', '')).sort();
      return { status: r.status, fetched, out: r.out, idx: sb.json('collector/extracted/elig-docs.json') || {} };
    };
    const ex = (sb, f) => sb.exists(`collector/extracted/${f}`);
    const sb3 = sandbox(root, 'hdj-eligatt-');
    try {
      sb3.write('fake-fetch.mjs', FAKE);
      sb3.write('data/notices.json', { items: [] });
      const reg = { items: [
        { id: 'S', name: '오늘 받아 본 공고', attachments: A('s'), listedAt: today },
        { id: 'C', name: '쉼이 끝난 공고 같은 바이트', attachments: A('c', 'pdf'), listedAt: today },
        { id: 'D', name: '쉼이 끝난 공고 다른 바이트', attachments: A('d', 'pdf'), listedAt: today },
        { id: 'F', name: '쉼이 끝났는데 못 받는 공고', attachments: A('f'), listedAt: today },
        { id: 'X', name: '마감 지난 공고', attachments: A('x'), deadline: shift(today, -1) },
      ] };
      sb3.write('data/registered.json', reg);
      /* 준비 — 한 번 받아 색인·파일을 만든다(파일 이름 표식은 로봇이 정한 것을 색인에서 읽는다 — 규칙을 베끼지 않는다) */
      const r0 = run(sb3);
      const f0 = (id) => ((r0.idx[id] || {}).files || [])[0];
      const [fS, fC, fD, fF] = ['S', 'C', 'D', 'F'].map(f0);
      eq('③ 진짜 deepfetch --elig-attach (준비) — 처음 보는 공고는 받고 마감 지난 공고(X)는 안 받는다 · 시도한 날을 적는다',
        [r0.status, r0.fetched, 'X' in r0.idx, ['S', 'C', 'D', 'F'].every((k) => r0.idx[k] && r0.idx[k].at === today && r0.idx[k].files.length === 1)],
        [0, ['c.pdf', 'd.pdf', 'f.hwp', 's.hwp'], false, true]);
      /* 지난번에 받아 OCR·본문 글자까지 뽑아 둔 상태로 만들고, S 만 오늘 해 본 것으로 둔다 */
      const idx0 = sb3.json('collector/extracted/elig-docs.json');
      for (const k of ['C', 'D', 'F']) idx0[k].at = shift(today, -5);
      sb3.write('collector/extracted/elig-docs.json', idx0);
      sb3.write(`collector/extracted/${fS}.body.txt`, '오늘 받아 둔 공고의 본문 글자');
      sb3.write(`collector/extracted/${fC}.ocr.txt`, 'OCR 로 읽은 글자 — 바이트가 같으면 남아야 한다');
      sb3.write(`collector/extracted/${fD}.txt`, '옛 판의 글자 — 바이트가 바뀌면 지워야 한다');
      sb3.write(`collector/extracted/${fF}.ocr.txt`, '못 받는 날에도 남아야 하는 지난 글자');
      reg.items.push({ id: 'N', name: '처음 받는 공고', attachments: A('n'), listedAt: today });
      sb3.write('data/registered.json', reg);
      const r1 = run(sb3, { FAKE_NEW: '/d\\.pdf$', FAKE_FAIL: '/f\\.hwp$' });
      eq('③ 진짜 deepfetch --elig-attach — 오늘 해 본 것(S)·마감 지남(X)은 안 받고, 쉼이 끝난 것(C·D·F)과 처음(N)만 받는다',
        [r1.status, r1.fetched], [0, ['c.pdf', 'd.pdf', 'f.hwp', 'n.hwp']]);
      eq('  🔴 다시 받은 바이트가 같으면 파생 글자(.ocr.txt)를 지우지 않는다 · 다르면 그 파생만 지우고 원본을 바꾼다 · 안 받은 공고의 파생은 그대로 (bodies-5)',
        [ex(sb3, `${fC}.ocr.txt`), ex(sb3, `${fD}.txt`), sb3.read(`collector/extracted/${fD}`) === 'new https://f.example/d.pdf '.repeat(60), ex(sb3, `${fS}.body.txt`)],
        [true, false, true, true]);
      eq('  하나도 못 받은 공고(F)는 받아 둔 파일·글자·색인 파일 목록을 그대로 두고 시도한 날만 오늘로(줄은 돈다)',
        [ex(sb3, fF), ex(sb3, `${fF}.ocr.txt`), r1.idx.F && r1.idx.F.files, r1.idx.F && r1.idx.F.at], [true, true, [fF], today]);
      eq('  색인 — 처음 받은 공고에 파일·날짜 · 마감 지난 공고는 색인에 없다',
        [r1.idx.N && r1.idx.N.files.length, r1.idx.N && r1.idx.N.at, 'X' in r1.idx], [1, today, false]);
      const r2 = run(sb3);
      eq('  같은 날 다음 실행은 아무것도 다시 받지 않는다(시도한 날이 적혀 쉰다 — 예전엔 매 실행 같은 공고를 다시 받으며 파생 글자를 지웠다)',
        [r2.status, r2.fetched], [0, []]);
      /* 예산에 잘린 실행 — 차례가 안 온 공고의 원본·파생 글자를 미리 지우지 않는다(예전엔 대상 전부를 받기 전에 몽땅 지워,
         잘린 공고는 원본도 OCR 글자도 없이 다음 실행까지 갔다) */
      const idx2 = sb3.json('collector/extracted/elig-docs.json');
      idx2.C.at = shift(today, -6); idx2.F.at = shift(today, -5);
      sb3.write('collector/extracted/elig-docs.json', idx2);
      const r3 = run(sb3, { ELIG_BUDGET_MS: '300', FAKE_FETCH_DELAY: '700' });
      eq('  🔴 예산에 잘리면 차례가 안 온 공고(F)의 원본·OCR 글자·색인은 그대로 · 시도한 날도 안 바뀐다(다음 실행이 먼저 받는다)',
        [r3.status, r3.fetched, ex(sb3, fF), ex(sb3, `${fF}.ocr.txt`), r3.idx.F && r3.idx.F.files, r3.idx.F && r3.idx.F.at, ex(sb3, `${fC}.ocr.txt`)],
        [0, ['c.pdf'], true, true, [fF], shift(today, -5), true]);
    } finally {
      sb3.done();
    }
  }
  /* ── ③-b 표적 양식 받기(deepfetch --forms-only)가 등록 공고의 공고문류를 자격 색인에도 올린다 (2026-11-02) ──
     그 전엔 form-* 와 forms-index.txt 에만 남아 발췌기 qualFromDocs(elig 색인만 읽는다)가 영영 못 봤다 — 10-30·10-31 표적 재수집이 헛돈 이유.
     되돌리면 색인이 비어 빨간불 */
  {
    const FAKE = `import fs from 'node:fs';
globalThis.fetch = async (url) => {
  url = String(url);
  if (process.env.FAKE_FETCH_LOG) fs.appendFileSync(process.env.FAKE_FETCH_LOG, url + '\\n');
  const body = Buffer.from(('fake ' + url + ' ').repeat(60));
  return { ok: true, status: 200, headers: new Map(), arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.length) };
};
`;
    const today = kstToday();
    const sb = sandbox(root, 'hdj-formselig-');
    try {
      sb.write('fake-fetch.mjs', FAKE);
      sb.write('collector/run-deepfetch.txt', 'targets: 표적 장학생 선발\n');
      sb.write('data/notices.json', { items: [
        { title: '2026 표적 장학생 선발 안내', url: 'https://s.example/view?no=1', attachments: [
          { name: '2026 표적 장학생 선발 공고문.hwp', url: 'https://f.example/t1.hwp' }, { name: '표적 장학생 신청서.hwp', url: 'https://f.example/t1-form.hwp' }] },
        { title: '2026 표적 장학생 선발 안내(미등록)', url: 'https://s.example/view?no=2', attachments: [{ name: '선발 공고문.pdf', url: 'https://f.example/t2.pdf' }] },
      ] });
      sb.write('data/registered.json', { items: [{ id: 'T', name: '표적 장학생 선발', sourceUrl: 'https://s.example/view?no=1', listedAt: today }] });
      sb.write('fetch.log', '');
      const r = sb.run('collector/deepfetch.mjs', ['--forms-only'], { FAKE_FETCH_LOG: sb.abs('fetch.log') }, 25000, ['--import', sb.abs('fake-fetch.mjs')]);
      const idx = sb.json('collector/extracted/elig-docs.json') || {};
      const forms = (sb.read('collector/extracted/forms-index.txt') || '').split('\n').filter(Boolean).length;
      const f = idx.T && idx.T.files;
      eq('③-b 표적 양식 받기 — 등록 공고의 공고문(hwp)만 자격 색인에 오른다(elig-<표식>-1.hwp · 시도한 날) · 신청서는 안 오른다 · 미등록 공고는 색인에 없다 · 양식 색인엔 셋 다',
        [r.status, forms, Array.isArray(f) && f.length === 1 && /^elig-[a-z0-9]{1,6}-1\.hwp$/.test(f[0]), idx.T && idx.T.at, Object.keys(idx), !!f && sb.exists(`collector/extracted/${f[0]}`)],
        [0, 3, true, today, ['T'], true]);
      /* 같은 바이트로 다시 받으면 파생 글자를 지우지 않는다(keepEligDoc 공용) */
      if (f) sb.write(`collector/extracted/${f[0]}.body.txt`, '지난 실행이 뽑아 둔 본문 글자');
      const r2 = sb.run('collector/deepfetch.mjs', ['--forms-only'], { FAKE_FETCH_LOG: sb.abs('fetch.log') }, 25000, ['--import', sb.abs('fake-fetch.mjs')]);
      eq('  같은 바이트로 다시 받으면 파생 글자(.body.txt)는 남는다 · 색인도 같은 파일 하나', [r2.status, !!f && sb.exists(`collector/extracted/${f[0]}.body.txt`), (sb.json('collector/extracted/elig-docs.json') || {}).T?.files], [0, true, f]);
    } finally {
      sb.done();
    }
  }
  /* ── ④ 원문 보충(deepfetch --fill) — 껍데기도 세어 물러서고, 받기 전체에 예산 (B8 · bodies-12 ①) ── */
  {
    eq('④ 물러서기 — 받기 실패 3번 또는 껍데기 3번 · 껍데기 2번은 아직',
      [fillRetired({ fails: 3 }), fillRetired({ shells: 3 }), fillRetired({ shells: 2 }), fillRetired(undefined)], [true, true, false, false]);
    eq('  껍데기 세기 — 메뉴뿐이면 하나 더 · 본문이 오면 0 · 받기 실패는 껍데기가 아니다(실패는 fails 가 센다)',
      [nextShells({ shells: 2 }, { text: '메뉴', bodyChars: 10 }), nextShells({ shells: 2 }, { text: '본문 '.repeat(100), bodyChars: 300 }), nextShells({}, { text: 'FETCH_FAIL HTTP 500' })],
      [3, 0, 0]);
    const shellNow = { text: '메뉴', bodyChars: 10 };
    eq('  남길 수(fillCounts) — 받기 실패면 fails 하나 더(껍데기 수는 이어 둠) · 껍데기면 shells 하나 더(실패 수는 이어 둠) · 본문이 오면 둘 다 0 · 지난 수는 원래 항목에서',
      [fillCounts({ fails: 1, shells: 2 }, { text: 'FETCH_FAIL HTTP 500' }), fillCounts({ fails: 2, shells: 1 }, { text: '메뉴' }, shellNow),
        fillCounts({ fails: 2, shells: 2 }, { text: '본문' }, { text: '본문 '.repeat(100), bodyChars: 300 }), fillCounts(undefined, { text: 'FETCH_ERROR TimeoutError' })],
      [{ fails: 2, shells: 2 }, { fails: 2, shells: 2 }, { fails: 0, shells: 0 }, { fails: 1, shells: 0 }]);
    const FAKE = `import fs from 'node:fs';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
globalThis.fetch = async (url) => {
  if (process.env.FAKE_FETCH_LOG) fs.appendFileSync(process.env.FAKE_FETCH_LOG, String(url) + '\\n');
  await sleep(Number(process.env.FAKE_FETCH_DELAY || 0));
  if (process.env.FAKE_FAIL && /alt/.test(String(url))) return { ok: false, status: 500, headers: new Map(), text: async () => '' };
  const shell = /shell|retired|alt/.test(String(url));
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
    /* 같은 임시 폴더에서 여러 번 돌린다(실행마다 받은 주소 · 실행 뒤 칸) — 리뷰 R1·R6.
       bshell : 같은 주소에 브라우저 본문(browser-bodies.json)도 있는데 그것도 껍데기 — 색인(indexTexts)은 원래 항목 대신 그 브라우저 본문을 얹어
                fails·shells 칸이 없는 항목을 돌려준다. 예전엔 지난 수를 거기서 읽어 껍데기 수가 영영 1이었다(실데이터 needsFetch 111건 중 21건).
       alt    : 받기 실패(FAKE_FAIL)와 껍데기가 번갈아 — 예전엔 서로의 수를 0 으로 되돌려 어느 쪽도 3에 안 닿았다. */
    const seq = (() => {
      const sb = sandbox(root, 'hdj-fill-seq-');
      try {
        sb.write('fake-fetch.mjs', FAKE);
        sb.write('data/registered.json', { items: [] });
        sb.write('data/notices.json', { items: ['bshell-1', 'alt-1'].map((k) => ({ title: `${k} 장학 공고`, school: '표본대학교', url: `https://n.example/${k}`, foundAt: '2026-10-01' })) });
        sb.write('collector/extracted/notices-text.json', []);
        sb.write('collector/extracted/browser-bodies.json', { 'https://n.example/bshell-1': { title: 'bshell-1 장학 공고', text: '홈\n로그인\n메뉴 바로가기', at: '2026-10-01', via: 'browser' } });
        const runs = [];
        for (const fail of [1, 0, 1, 0, 1, 0]) {
          sb.write('fetch.log', '');
          const r = sb.run('collector/deepfetch.mjs', ['--fill'], { FAKE_FETCH_LOG: sb.abs('fetch.log'), FILL_RETRY_SLOTS: '0', FAKE_FAIL: fail ? '1' : '' }, 25000, ['--import', sb.abs('fake-fetch.mjs')]);
          const texts = sb.json('collector/extracted/notices-text.json') || [];
          const at = (k) => { const t = texts.find((x) => x.url === `https://n.example/${k}`) || {}; return [t.fails || 0, t.shells || 0]; };
          runs.push({ status: r.status, fetched: (sb.read('fetch.log') || '').split('\n').filter(Boolean).map((u) => u.replace('https://n.example/', '')).sort(), b: at('bshell-1'), a: at('alt-1') });
        }
        return runs;
      } finally {
        sb.done();
      }
    })();
    eq('  🔴 브라우저 본문도 껍데기인 주소 — 껍데기 수가 1·2·3 으로 오르고 넷째 실행부터 물러선다(회전 0자리라 안 받는다) (리뷰 R1)',
      [seq.map((r) => r.status), seq.map((r) => r.fetched.includes('bshell-1')), seq.map((r) => r.b[1])],
      [[0, 0, 0, 0, 0, 0], [true, true, true, false, false, false], [1, 2, 3, 3, 3, 3]]);
    eq('  받기 실패와 껍데기가 번갈아도 서로의 수를 이어 둔다 — 실패 1·1·2·2·3 · 껍데기 0·1·1·2·2 · 실패 3번째 뒤엔 물러선다 (리뷰 R6)',
      [seq.map((r) => r.a), seq.map((r) => r.fetched.includes('alt-1'))],
      [[[1, 0], [1, 1], [2, 1], [2, 2], [3, 2], [3, 2]], [true, true, true, true, true, false]]);
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
      /* 관문을 못 넘을 때 지우는 것은 **제가 남긴** .ocr.txt 뿐 (bodies-int-1) — 장학 포스터 PaddleOCR 이 글자층 있는 elig-*.pdf 도 먼저 읽어
         .ocr.txt 를 남긴다. tesseract 가 처음 읽고 관문에서 버리며 그것을 지우면, 뒤에 Paddle 단계가 없는 워크플로에서 자격 글자가 빈 채 커밋될 수 있었다.
         run() 을 진짜로 돌리되 쪽 그리기·tesseract 만 '포스터 글자'를 돌려주는 가짜로 바꾼다(관문에서 버려지는 꼴) */
      const dir2 = fs.mkdtempSync(path.join(os.tmpdir(), 'hdj-ocrkeep-'));
      try {
        fs.writeFileSync(path.join(dir2, 'elig-p-1.pdf'), '%PDF-1.4\n글자층 있는 공고문');
        fs.writeFileSync(path.join(dir2, 'elig-p-1.pdf.txt'), '글자층');
        fs.writeFileSync(path.join(dir2, 'elig-p-1.pdf.ocr.txt'), 'PaddleOCR 이 읽은 자격 글자');   // 장부에 칸 없음 = 남이 만든 것
        fs.writeFileSync(path.join(dir2, 'elig-t-1.pdf'), '%PDF-1.4\n바뀐 바이트');
        fs.writeFileSync(path.join(dir2, 'elig-t-1.pdf.ocr.txt'), '예전에 tesseract 가 남긴 글자');   // 장부에 통과 기록 = 제가 만든 것
        fs.writeFileSync(path.join(dir2, 'ocr-ledger.json'), JSON.stringify({ 'elig-t-1.pdf': { sig: '1:old', gate: 'old', ok: true, at: '2026-10-01' } }));
        const code = ['import importlib.util, json, os, sys',
          "spec = importlib.util.spec_from_file_location('ocrtext', sys.argv[1])",
          'm = importlib.util.module_from_spec(spec)', 'spec.loader.exec_module(m)',
          "POSTER = '=     2026년     재5지.\\n프로그램 소개   지원 자격\\n신정 기간   29   ueneE 이하\\n'",
          'm.ocr_pdf = lambda path, deadline: (POSTER, 1)',
          'm.tesseract = lambda path, deadline: POSTER',
          'm.run([sys.argv[2]], 600)',
          'led = json.load(open(os.path.join(sys.argv[2], m.LEDGER), encoding="utf-8"))',
          "print(json.dumps([os.path.exists(os.path.join(sys.argv[2], f + '.ocr.txt')) for f in ('elig-p-1.pdf', 'elig-t-1.pdf')] + [[led.get(f, {}).get('ok') for f in ('elig-p-1.pdf', 'elig-t-1.pdf')]]))"].join('\n');
        const r = spawnSync('python3', ['-c', code, fileURLToPath(new URL('collector/ocr-text.py', root)), dir2],
          { encoding: 'utf8', env: cleanEnv({ PYTHONDONTWRITEBYTECODE: '1' }) });
        let got = null;
        try { got = JSON.parse((r.stdout || '').trim().split('\n').pop()); } catch { got = (r.stderr || r.stdout || '').slice(-200); }
        eq('  관문에서 버릴 때 — 장부에 통과 기록이 없는 .ocr.txt(PaddleOCR 이 남긴 것)는 그대로 · 제가 전에 남긴 것(통과 기록)만 지운다 · 둘 다 장부엔 못 넘음으로',
          got, [true, false, [false, false]]);
      } finally {
        fs.rmSync(dir2, { recursive: true, force: true });
      }
    }
  }
  {
    /* ⑤ 의 '양식·그 밖의 PDF 는 글자층이 있으면 건너뛴다'는 **글자층을 먼저 뽑아 둔 뒤**에만 맞다 — OCR 을 돌리는 워크플로마다 PDF 글자 뽑기(pdf-text.py)가
       OCR(ocr-text.py)보다 앞에 있어야 한다. 2026-10-05 병합: 기본 브랜치가 OCR 을 발췌 앞으로 올리며 PDF 글자 뽑기보다 앞서게 되어, 새로 받은 양식 PDF 를
       OCR 이 먼저 쪽 그림으로 읽느라 예산(150초)을 썼고 목록 갱신(apt-get update)도 두 번 돌았다. */
    const wfDir = new URL('.github/workflows/', root);
    const bad = [];
    for (const f of fs.readdirSync(wfDir).filter((x) => x.endsWith('.yml')).sort()) {
      const y = stripYamlComments(readText(`.github/workflows/${f}`));
      const io = y.indexOf('python3 collector/ocr-text.py');
      if (io < 0) continue;
      const ip = y.indexOf('python3 collector/pdf-text.py');
      const upd = (y.match(/apt-get update/g) || []).length;
      if (ip < 0 || ip > io || upd !== 1) bad.push(`${f}(PDF ${ip < 0 ? '없음' : ip > io ? 'OCR 뒤' : '앞'} · 목록 갱신 ${upd}번)`);
    }
    eq('⑤ OCR 을 돌리는 워크플로 전부 — PDF 글자 뽑기가 OCR 보다 앞 · 목록 갱신(apt-get update)은 한 번', bad, []);
  }
  /* ── ⑥ AI 자격 읽기 버튼(eligibility-fill.yml) — 대상 세 갈래를 다 세고, 0 이면 돈이 드는 단계만 건너뛴다 (bodies-10) ── */
  {
    const wf = readText('.github/workflows/eligibility-fill.yml');
    const stepIf = (name) => {
      const i = wf.indexOf(`- name: ${name}\n`);
      if (i < 0) return null;
      const m = wf.slice(i).match(/^- name: [^\n]*\n {8}if: ([^\n]*)/);
      return m ? m[1] : '';
    };
    const PAID = ['SDK 설치', '첨부만 (공고문 PDF · 포스터 그림)', '공고 하나만', '시범 3건', '전수 169건', '대외활동 — 포스터·첨부·본문 AI 읽기'];
    const FREE = ['공고문 첨부 받기 (무료)', '받은 첨부에서 글자 뽑기 (HWP 본문 · PDF)', '그림·스캔 첨부 글자 읽기 (OCR)', '첨부에서 자격 발췌 (무료)'];
    eq('⑥ 돈이 드는 단계 여섯은 대상이 0건이면 건너뛴다 · 무료 단계 넷은 그대로 돈다(받은 뒤에 대상이 생길 수 있다)',
      [PAID.map((n) => /steps\.preview\.outputs\.count != '0'/.test(stepIf(n) || '')), FREE.map((n) => stepIf(n) !== null && !/count/.test(stepIf(n)))],
      [PAID.map(() => true), FREE.map(() => true)]);
    /* 세는 줄을 워크플로에서 그대로 떼어 표본 출력에 돌린다 — 장학 본문 · 공고문 첨부 · 대외활동 세 줄의 합 */
    const lines = (wf.match(/^ {10}s=\$\(sed[\s\S]*?^ {10}echo "count=[^\n]*$/m) || [''])[0];
    const hasBash = spawnSync('bash', ['-c', 'echo BOK'], { encoding: 'utf8' });
    if (!(hasBash.status === 0 && /BOK/.test(hasBash.stdout || ''))) {
      console.log('  … ⑥ 세기 줄 실행 건너뜀 — 이 컴퓨터에 bash 가 없다. 클라우드 로봇에서는 실제로 돈다.');
    } else {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hdj-efill-'));
      try {
        const sample = path.join(dir, 'preview.txt'); const out = path.join(dir, 'out.txt');
        const SAMPLE = '[elig-ai] 대상 5건 — 전수(--all)\n[elig-ai] 첨부로 읽을 수 있는 공고 3건 (포스터 그림 1 · 공고문 PDF 2)\n[activity-docs] AI 대상 7건 (자격 0줄 · 무료로 못 읽은 것)\n';
        const count = (text) => {
          fs.writeFileSync(sample, text); fs.writeFileSync(out, '');
          spawnSync('bash', ['-c', lines.replace(/^ {10}/gm, '').split('/tmp/preview.txt').join(sample)], { encoding: 'utf8', env: cleanEnv({ GITHUB_OUTPUT: out }) });
          return fs.readFileSync(out, 'utf8').trim();
        };
        eq('  대상 수 = 장학 본문 + 공고문 첨부 + 대외활동 (예전엔 첫 줄만 세어 첨부·대외활동만 있는 날 0 이었다)',
          [count(SAMPLE), count('[elig-ai] 대상 0건 — 전수(--all)\n[elig-ai] 첨부로 읽을 수 있는 공고 2건 (포스터 그림 2 · 공고문 PDF 0)\n[activity-docs] AI 대상 0건\n'), count('')],
          ['count=15', 'count=2', 'count=0']);
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    }
  }
  /* ── ⑦ 브라우저 수집 — 클릭형 게시판의 상세 글자도 본문으로 · 저장하는 본문은 줄을 살린 것 (B7) ── */
  {
    const P = '<p>이 장학금은 국내 대학에 재학 중인 학부생을 대상으로 하며 직전 학기 성적과 가정 형편을 함께 심사합니다.</p>';
    const page = (title, extra = '') => `<nav>홈 로그인 사이트맵</nav><h3>${title}</h3>${P}${P}${P}<p>둘째 문단 — 신청 서류는 누리집에서 내려받습니다.</p>${extra}`;
    const e = browserBodyEntry({ title: '표본', html: page('2026학년도 2학기 교내장학금 신청 안내'), at: '2026-10-04' });
    eq('⑦ 상세 화면 → 본문 한 칸 — 줄을 살린다(여러 줄) · 표식 browser · 한글 120자 미만이면 본문으로 치지 않는다',
      [e && e.text.split('\n').length >= 3, e && e.via, e && e.at, browserBodyEntry({ title: 't', html: '<p>짧은 안내 한 줄뿐인 화면입니다</p>', at: 'x' })],
      [true, 'browser', '2026-10-04', null]);
    const row = '공지 [장학] 2026학년도 2학기 교내장학금 신청 안내 2026.09.17. 조회 1640';
    const others = ['2026학년도 2학기 국가근로장학생 추가 모집 안내', '2026 미래에셋 해외교환 장학생 선발 공고', '2026학년도 2학기 가족장학 신청 안내 공지', '고속도로 장학재단 2026 장학생 모집'];
    const cb = (o) => clickBodyEntry({ title: row, otherTitles: others, at: '2026-10-04', opened: true, ...o });
    const prevNext = `<p>이전글 ${others[0]}</p><p>다음글 ${others[1]}</p>`;
    const listy = others.map((t) => `<li>${t}</li>`).join('');
    eq('  클릭으로 연 화면을 그 행의 본문으로 — 상세가 열렸고 이 행 제목이 있으면(이전글·다음글 둘은 괜찮다) 남긴다 · 행 꼬리(공지·날짜·조회)는 뗀 제목',
      [!!cb({ html: page('2026학년도 2학기 교내장학금 신청 안내', prevNext) }), (cb({ html: page('2026학년도 2학기 교내장학금 신청 안내') }) || {}).title],
      [true, '[장학] 2026학년도 2학기 교내장학금 신청 안내']);
    eq('  🔴 남의 글을 붙이지 않는다 — 안 열렸으면 · 이 행 제목이 화면에 없으면 · 다른 행 제목이 셋 이상 보이면(아직 목록 화면) 남기지 않는다',
      [cb({ html: page('2026학년도 2학기 교내장학금 신청 안내'), opened: false }), cb({ html: page('2026 미래에셋 해외교환 장학생 선발 공고') }),
        cb({ html: page('2026학년도 2학기 교내장학금 신청 안내', listy) })],
      [null, null, null]);
    const bc = stripComments(readText('collector/browser-collect.mjs'));
    const cdBlock = (bc.match(/if \(cd\) \{[\s\S]*?\} else if/) || [''])[0];
    eq('  브라우저 수집기 배선 — 상세 방문과 클릭 두 길이 같은 함수 · 클릭 때 남긴 본문을 상세 루프가 저장(cd) · 뭉갠 글자로 본문을 만들지 않는다',
      [(bc.match(/browserBodyEntry\(/g) || []).length >= 1 && (bc.match(/clickBodyEntry\(/g) || []).length >= 1,
        /clickDetails\[title\] = \{[^\n]*body/.test(bc), /bodies\[it\.url\] =/.test(cdBlock), /bodies\[it\.url\] = \{ title: it\.title, text: text/.test(bc)],
      [true, true, true, false]);
  }
}

/* 「로봇·도구 점검 관문」 — servers 묶음: 서버(푸시·접수·로그인)가 제 일을 하고, 멈추면 사람이 아는가 (2026-10-04)
   찾은 것:
     ① 접수 대행 워커가 `createRequire(node:module)` 로 엔진을 불러 Workers 에 올리는 순간 넘어진다(꺼져 있어 아직 영향 없음).
     ② server/README.md 가 폐기된 mail-worker 기준이었다 · apply/wrangler.toml 이 '증빙은 KV 로'라고 틀리게 적었다.
     ③④ 푸시 서버 /health 로는 '예약 회차가 돌았는지' 알 수 없었고(결과를 버렸다) · 한 번 포기하면 lastError 를 지우는 길이 없었다.
     ⑥ 주소만 바뀐 같은 공고로 학교를 깨웠다(10-04 08:10 회차: 깨운 9개교 전부) — 폰은 학교+제목 열쇠로 안 알려 빈 알림 · 장부를 넣은 순서로 잘랐다.
     ⑦ 마감 사유로 같은 날 두 번 깨웠다(20:10 은 빈 알림) · 여러 학교만 받는 공고(schoolsAny)로 전원을 깨웠다.
     ⑧ 게시판을 같이 쓰는 분교(한양 ERICA·건국 글로컬·홍익 세종) 학생은 제 학교 새 글로 안 깨워졌다.
     ⑨ 로그인 서버(Supabase)를 보는 로봇이 없었다.
     ⑩ 공용 파일 하나가 안 실리면 서비스워커가 `NOTIFY_RULES` 에서 던져 푸시를 받고도 알림 0건이었다.
   🔴 표본(고정 예시)만 잰다 — data/·collector/ 장부는 읽지 않는다. 코드 파일(server/·sw.js·엔진)은 코드라 읽는다.
   🔴 Date.now·fetch 는 바꿔 끼운 뒤 finally 로 되돌린다. */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { stepsOf } from './ci.mjs';
import { actionBeforeCheckout, codeOf } from './alerts.mjs';
import { verdict as pushVerdict, slotTime } from '../../tools/push-health-verdict.mjs';
import { readSupabaseConfig, verdict as sbVerdict, probe as sbProbe } from '../../tools/supabase-health.mjs';

const require = createRequire(import.meta.url);

/* ── ① Workers 에서 못 싣는 모듈 찾기 (순수 함수 · readFile 을 받아 표본과 실제 코드를 같은 함수로 잰다) ── */
const IMPORT_RE = /(?:^|[\s;])import\s+(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]|(?:^|[^\w.])require\(\s*['"]([^'"]+)['"]\s*\)|import\(\s*['"]([^'"]+)['"]\s*\)/g;
/** 주석을 걷는다 — 주석 속 낱말(머리말의 'createRequire 금지' 같은)로 잡히지 않게 */
export const stripComments = (src) => String(src).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\'"])\/\/.*$/gm, '$1');
/** entry(경로)에서 상대 경로 import·require·import() 를 따라가며 문제를 모은다 → [ '파일: 문제' … ]
    readFile(경로) 는 글자 또는 null(없는 파일). JSON 등 스크립트가 아닌 파일은 따라가지 않는다. */
export function workerImportProblems(readFile, entry) {
  const bad = [];
  const seen = new Set();
  const walk = (file) => {
    if (seen.has(file)) return;
    seen.add(file);
    if (!/\.(?:m?js|cjs)$/.test(file)) return;          // JSON 등은 스크립트가 아니다 — 읽지 않는다(data/ 를 재지 않는다)
    const raw = readFile(file);
    if (raw == null) { bad.push(`${file}: 없는 파일`); return; }
    const src = stripComments(raw);
    if (/\bcreateRequire\b/.test(src)) bad.push(`${file}: createRequire`);
    for (const m of src.matchAll(IMPORT_RE)) {
      const spec = m[1] || m[2] || m[3];
      if (/^node:/.test(spec)) { bad.push(`${file}: ${spec}`); continue; }
      if (!spec.startsWith('.')) continue;
      walk(path.posix.normalize(path.posix.join(path.posix.dirname(file), spec)));
    }
  };
  walk(path.posix.normalize(entry));
  return bad;
}

/* 워커 모듈을 매번 새로 싣는다(되돌려 본 판이 섞이지 않게) — 파일 주소 대신 글자로 실어 경고 없이 */
async function loadPushWorker(root) {
  const src = fs.readFileSync(new URL('server/push/worker.js', root), 'utf8');
  return import(`data:text/javascript;charset=utf-8,${encodeURIComponent(`${src}\n//# ${Date.now()}-${Math.random()}`)}`);
}

/* 가짜 KV (Workers KV 의 get·put·delete·list 만) */
function fakeKV() {
  const m = new Map();
  return {
    _m: m,
    get: async (k) => (m.has(k) ? m.get(k) : null),
    put: async (k, v) => { m.set(k, String(v)); },
    delete: async (k) => { m.delete(k); },
    list: async ({ prefix = '', limit } = {}) => {
      const keys = [...m.keys()].filter((k) => k.startsWith(prefix)).sort().slice(0, limit || 1000).map((name) => ({ name }));
      return { keys, list_complete: true, cursor: null };
    },
  };
}
const KST = (s) => Date.parse(`${s}+09:00`);

export default async function gate(eq, ctx) {
  const root = ctx.root;
  const rootDir = fileURLToPath(root);
  const read = (rel) => fs.readFileSync(new URL(rel, root), 'utf8').replace(/\r/g, '');
  const readOpt = (rel) => { try { return read(rel); } catch (e) { return ''; } };
  const realNow = Date.now;
  const realFetch = globalThis.fetch;
  const at = (ms) => { Date.now = () => ms; };

  try {
    /* ── ① 서버 워커가 Workers 에서 못 싣는 모듈을 부르지 않는다 ── */
    const sample = (guard) => (f) => ({
      'w/worker.js': "import { v } from './guard.mjs';",
      'w/guard.mjs': guard,
      'engine.js': "if (typeof module !== 'undefined') module.exports = {};",
    })[f] ?? null;
    eq('① 표본 — createRequire 꼴은 문제 둘(createRequire · node:module) · 기본 가져오기 꼴은 없음 · 없는 상대 경로는 잡는다',
      [workerImportProblems(sample("import { createRequire as _cr } from 'node:module';\nconst ME = _cr(import.meta.url)('../engine.js');"), 'w/worker.js'),
        workerImportProblems(sample("/* createRequire 금지 — node:module 없음 */\nimport ME from '../engine.js';"), 'w/worker.js'),
        workerImportProblems(sample("import X from './nope.js';"), 'w/worker.js')],
      [['w/guard.mjs: createRequire', 'w/guard.mjs: node:module'], [], ['w/nope.js: 없는 파일']]);
    const readRepo = (f) => { try { return fs.readFileSync(path.join(rootDir, f), 'utf8'); } catch (e) { return null; } };
    const workers = fs.readdirSync(path.join(rootDir, 'server')).filter((d) => fs.existsSync(path.join(rootDir, 'server', d, 'wrangler.toml'))).sort();
    const mains = workers.map((d) => [d, (/^main\s*=\s*"([^"]+)"/m.exec(readRepo(`server/${d}/wrangler.toml`)) || [])[1]]);
    eq('  서버 워커 넷(apply·chat·essay·push)의 진입점을 wrangler.toml 에서 읽는다(헛도는 검사가 아니다)', mains, [['apply', 'worker.js'], ['chat', 'worker.js'], ['essay', 'worker.js'], ['push', 'worker.js']]);
    eq('  실제 서버 코드 — 진입점부터 따라간 모든 파일에 node: 모듈·createRequire·없는 경로가 없다(접수 대행은 엔진을 기본 가져오기로)',
      mains.map(([d, m]) => [d, workerImportProblems(readRepo, `server/${d}/${m}`)]), mains.map(([d]) => [d, []]));
    eq('  접수 대행 판정 파일이 엔진(match-engine.js)을 실제로 따라간다(불러 쓰기 · 사본 아님)',
      /^import ME from '\.\.\/\.\.\/match-engine\.js';$/m.test(stripComments(readRepo('server/apply/apply-guard.mjs') || '')), true);

    /* ── ② 서버 폴더 안내가 지금 모습이다 ── */
    const sreadme = readOpt('server/README.md');
    eq('② server/README.md 에 워커 폴더 넷이 모두 나오고 · 폐기된 HANDAEJANG_CONFIG 안내가 없다 · mail-worker 는 쓰지 않음으로',
      [workers.filter((d) => !sreadme.includes(`\`${d}/\``)), /HANDAEJANG_CONFIG/.test(sreadme), /mail-worker\.js[^\n]*쓰지 않음/.test(sreadme)],
      [[], false, true]);
    eq('  server/apply/wrangler.toml — 발송 증빙이 Supabase apply_sends 에 남는다고 적는다(\'KV 를 붙인다\' 옛 안내 없음)',
      [/apply_sends/.test(readOpt('server/apply/wrangler.toml')), /KV 를 붙인다/.test(readOpt('server/apply/wrangler.toml'))], [true, false]);

    /* ── 푸시 워커 (③~⑧) ── */
    const W = await loadPushWorker(root);
    const worker = W.default;

    /* ③ 예약 회차가 돌았는지 /health 가 보인다 */
    const env3 = { SUBS: fakeKV(), VAPID_JWK: 'x', VAPID_PUBLIC: 'y' };
    globalThis.fetch = async (u) => {
      u = String(u);
      if (u.endsWith('data/registered.json')) return new Response(JSON.stringify({ items: [{ id: 'a', eligibility: { schoolOnly: 'A대학교' }, deadline: '2026-12-01' }] }));
      if (u.endsWith('data/notices.json')) return new Response(JSON.stringify({ items: [] }));
      return new Response('', { status: 201 });
    };
    const health = async (env) => (await worker.fetch(new Request('https://w/health'), env)).json();
    const runSlot = async (env, startMs) => {
      let t = startMs;
      for (let i = 0; i < 10; i += 1) { at(t); const r = await W.tick(env); t += 120000; if (r && r.idle) break; }
    };
    await env3.SUBS.put('state:lastError', JSON.stringify({ at: KST('2026-10-03T20:20:00'), step: 'reg', note: '표본' }));
    const h0 = await health(env3);
    eq('⑤ 포기 기록이 회차 전 것이면 회복 전까지는 lastError 로 보인다', [!!h0.lastError, h0.pastError || null], [true, null]);
    await runSlot(env3, KST('2026-10-04T08:10:30'));
    const h1 = await health(env3);
    eq('③ 예약 회차를 끝까지 돌리면 /health 에 마지막으로 시작한 회차(lastSlot)와 결과(lastRun)가 보인다',
      [h1.lastSlot, h1.lastRun && h1.lastRun.outcome, h1.lastRun && h1.lastRun.slot, h1.step], ['2026-10-04#08:10', 'nothing', '2026-10-04#08:10', 'idle']);
    eq('⑤ 그 뒤 회차가 끝까지 돌면 lastError 는 비고 같은 기록이 pastError 로 내려간다(KV 에서 지우지는 않는다)',
      [h1.lastError, h1.pastError && h1.pastError.at, env3.SUBS._m.has('state:lastError')], [null, KST('2026-10-03T20:20:00'), true]);
    await env3.SUBS.put('state:lastError', JSON.stringify({ at: Date.now() + 3600e3, step: 'plan', note: '표본' }));
    const h2 = await health(env3);
    eq('  마지막 회차보다 뒤의 포기 기록은 계속 lastError 로 보인다', [!!h2.lastError, h2.pastError || null], [true, null]);

    /* ③ 발송 회차도 끝까지 돌면 결과가 남는다 (2026-10-04 리뷰 — 위 표본은 '알릴 거리 없음' 회차뿐이라
       send 단계 끝의 finishRun 'sent' 를 옛 clearRun 으로 되돌려도 초록이었다) */
    {
      const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
      const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
      const pub = Buffer.from(await crypto.subtle.exportKey('raw', pair.publicKey)).toString('base64url');
      const env4 = { SUBS: fakeKV(), VAPID_JWK: JSON.stringify(jwk), VAPID_PUBLIC: pub };
      await env4.SUBS.put('state:seen', JSON.stringify(['n:https://seed/0']));   // 첫 실행이 아니게(첫 실행은 새 글로 안 깨운다)
      const ep = 'https://fcm.googleapis.com/fcm/send/sample';
      await env4.SUBS.put(W.subKey(ep), JSON.stringify({ endpoint: ep, school: 'A대학교', campus: '' }));
      let feed = [{ url: 'https://n/1', school: 'A대학교', title: '새 장학 안내' }];
      let pushStatus = 201;
      const pushes = [];
      globalThis.fetch = async (u) => {
        u = String(u);
        if (u.endsWith('data/registered.json')) return new Response(JSON.stringify({ items: [] }));
        if (u.endsWith('data/notices.json')) return new Response(JSON.stringify({ items: feed }));
        pushes.push(u);                                                          // 데이터 주소가 아니면 푸시 서비스
        return new Response('', { status: pushStatus });
      };
      const pick = (r) => r && { outcome: r.outcome, sent: r.sent, woke: r.woke, dropped: r.dropped, slot: r.slot };
      await runSlot(env4, KST('2026-10-04T08:10:30'));
      const s1 = await health(env4);
      eq('③ 발송 회차(새 글 1 · 그 학교 구독 1)를 끝까지 돌리면 /health.lastRun 이 그 회차다 — 깨우기 1건 · 받아 줌 1건',
        [pick(s1.lastRun), pushes, s1.step], [{ outcome: 'sent', sent: 1, woke: 1, dropped: 0, slot: '2026-10-04#08:10' }, [ep], 'idle']);
      feed = [...feed, { url: 'https://n/2', school: 'A대학교', title: '또 새 장학' }];
      pushStatus = 410;
      await runSlot(env4, KST('2026-10-04T20:10:30'));
      const s2 = await health(env4);
      eq('  그 폰이 없어진 다음 회차(푸시 서비스 410) — lastRun {sent:1 · woke:0 · dropped:1} · 구독 기록은 지운다',
        [pick(s2.lastRun), s2.subs], [{ outcome: 'sent', sent: 1, woke: 0, dropped: 1, slot: '2026-10-04#20:10' }, 0]);
      const v2 = pushVerdict({ curlOk: true, code: 200, json: s2, now: KST('2026-10-05T06:17:00') });
      eq('④ 그 /health 로 다음 날 06:17 매일 확인 — 없어진 구독만 있던 회차는 경보가 아니다(ok · 등록 0대 경고만)',
        [v2.verdict, v2.warnings.length], ['ok', 1]);
    }

    /* ④ 매일 확인의 판정 — 표본 */
    const NOW = KST('2026-10-04T06:17:00');
    const okJ = { ok: true, configured: true, step: 'idle', sent: 0, subs: 4, lastError: null, lastSlot: '2026-10-03#20:10', lastRun: { outcome: 'nothing', sent: 0, woke: 0 } };
    const pv = (o, extra = {}) => pushVerdict({ curlOk: true, code: 200, json: { ...okJ, ...o }, now: NOW, ...extra }).verdict;
    eq('④ 판정 — 정상 ok · 한 회차만 빠짐(10-03 08:10 · 22시간) ok · 두 회차 연속 빠짐(10-02 20:10 · 34시간) stale · lastSlot 칸 없음 outdated',
      [pv({}), pv({ lastSlot: '2026-10-03#08:10' }), pv({ lastSlot: '2026-10-02#20:10' }), pushVerdict({ curlOk: true, code: 200, json: (({ lastSlot, ...r }) => r)(okJ), now: NOW }).verdict],
      ['ok', 'ok', 'stale', 'outdated']);
    eq('  판정 — 깨우기를 보냈는데 한 건도 안 받음 error · HTTP 503 down · 연결 실패 down · 열쇠 없음 misconfig · 포기 기록 error · 저장소 못 읽음 error',
      [pv({ lastRun: { outcome: 'sent', sent: 3, woke: 0 } }), pv({}, { code: 503 }), pv({}, { curlOk: false, code: '000' }), pv({ configured: false }), pv({ lastError: { at: 1 } }), pv({ subs: -1 })],
      ['error', 'down', 'down', 'misconfig', 'error', 'error']);
    eq('  판정 — 없어진 구독만 있던 회차 {sent:1 · dropped:1 · woke:0} ok · 살아 있는 구독이 남았는데 0건 {sent:3 · dropped:1 · woke:0} error',
      [pv({ lastRun: { outcome: 'sent', sent: 1, dropped: 1, woke: 0 } }), pv({ lastRun: { outcome: 'sent', sent: 3, dropped: 1, woke: 0 } })],
      ['ok', 'error']);
    const w0 = pushVerdict({ curlOk: true, code: 200, json: { ...okJ, lastSlot: null, subs: 0 }, now: NOW });
    eq('  새 저장소(lastSlot null)·등록 0대는 경고만 하고 ok', [w0.verdict, w0.warnings.length], ['ok', 2]);
    eq('  깨우기 실패 문구는 원인을 단정하지 않고 woke 가 도착 수가 아님을 적는다',
      (() => { const w = pushVerdict({ curlOk: true, code: 200, json: { ...okJ, lastRun: { sent: 3, woke: 0 } }, now: NOW }).why; return [/수 있/.test(w), /도착 수가 아니/.test(w)]; })(), [true, true]);
    eq('  회차 표기 읽기 — KST', [slotTime('2026-10-04#08:10') === KST('2026-10-04T08:10:00'), Number.isNaN(slotTime('엉뚱'))], [true, true]);
    const ph = readOpt('.github/workflows/push-health.yml');
    const phProbe = stepsOf(ph).find((s) => s.id === 'probe') || {};
    eq('  push-health.yml 이 판정 도구 한 곳을 부르고(셸 판정 없음) · 도구 폴더를 받는다',
      [/node tools\/push-health-verdict\.mjs/.test(phProbe.run || ''), /jq -r '\.lastError/.test(phProbe.run || ''), /sparse-checkout: \|\n\s+\.github\/actions\n\s+tools/.test(ph)], [true, false, true]);

    /* ⑥ 본 공고 — 주소 · 학교+제목 · 수집일 (폰과 같은 셋) · 장부 자르기 */
    const sum = (items) => W.summarize(null, { items });
    const wake = async (env, notices, reg = []) => {
      const r = await W.schoolsToWake(env, { reg: W.summarize({ items: reg }, null).reg, notices: sum(notices).notices });
      return { schools: [...r.schools].sort(), wakeAll: r.wakeAll };
    };
    {
      const env = { SUBS: fakeKV() };
      at(KST('2026-10-03T08:10:00'));
      await wake(env, [{ url: 'https://a/#n-1', school: '가천대학교', title: '2026 장학 안내' }]);
      at(KST('2026-10-03T20:10:00'));
      const r1 = await wake(env, [{ url: 'https://a/view?id=1', school: '가천대학교', title: '2026  장학 안내' }]);
      const r2 = await wake(env, [{ url: 'https://a/view?id=1', school: '가천대학교', title: '2026  장학 안내' }, { url: 'https://a/view?id=2', school: '가천대학교', title: '새 장학' }]);
      eq('⑥ (a) 주소만 바뀌고 제목은 빈칸만 다른 같은 공고 → 깨우지 않는다 · 제목이 다른 새 글 → 그 학교', [r1.schools, r2.schools], [[], ['가천대학교']]);
    }
    {
      const env = { SUBS: fakeKV() };
      at(KST('2026-10-04T08:10:00'));
      await wake(env, [{ url: 'https://b/1', school: '고려대학교', title: '첫 글', foundAt: '2026-10-04' }]);
      at(KST('2026-10-04T20:10:00'));
      const rOld = await wake(env, [{ url: 'https://b/2', school: '고려대학교', title: '되살아난 옛 글', foundAt: '2026-10-01' }]);
      const rNew = await wake(env, [{ url: 'https://b/3', school: '고려대학교', title: '오늘 새 글', foundAt: '2026-10-04' }]);
      eq('  (b) 새 주소·새 제목이라도 지난 판정보다 이틀 넘게 앞서 수집된 글 → 깨우지 않는다 · 오늘 수집된 글 → 깨운다', [rOld.schools, rNew.schools], [[], ['고려대학교']]);
    }
    {
      const NR = require('../../notify-rules.js');
      const titles = ['2026 장학 안내', '2026\t장학  안내', '2026 장학 안내 ', ' [공지] 장학　안내'];
      const got = titles.map((title) => {
        const n = { url: `https://a/${encodeURIComponent(title)}`, school: '가천대학교', title };
        const out = NR.evaluate({ now: KST('2026-10-04T08:10:00'), profile: { school: '가천대학교' }, notices: [n], noticeForProfile: () => true });
        const phone = (out.ledger.seenNotice || []).filter((k) => k.startsWith('t:'));
        return [phone, typeof W.titleSeenKey === 'function' ? [W.titleSeenKey(n)] : null];
      });
      eq('  (c) 학교+제목 열쇠가 폰(notify-rules 장부)과 글자까지 같다 — 빈칸·탭·NBSP·전각 빈칸 표본 (사본 대조)', got.filter(([a, b]) => JSON.stringify(a) !== JSON.stringify(b)), []);
      eq('  (c) 대조가 실제로 열쇠를 읽었다(헛도는 검사가 아니다)', got.every(([a]) => a.length === 1), true);
    }
    {
      const env = { SUBS: fakeKV() };
      const cur = { url: 'https://a/cur', school: '가천대학교', title: '오래 실린 공고' };
      const old = Array.from({ length: 4000 }, (_, i) => `n:https://old/${i}`);
      await env.SUBS.put('state:seen', JSON.stringify(['n:https://a/cur', 't:가천대학교|오래실린공고', ...old]));
      at(KST('2026-10-04T08:10:00'));
      await wake(env, [cur]);
      const kept = JSON.parse(await env.SUBS.get('state:seen'));
      at(KST('2026-10-04T20:10:00'));
      const again = await wake(env, [cur]);
      eq('  (d) 옛 열쇠 4000개 + 지금 실린 공고 → 장부를 자를 때 지금 공고의 열쇠가 남고(상한 4000) 다음 회차에 다시 깨우지 않는다',
        [kept.includes('n:https://a/cur'), kept.length <= 4000, again.schools], [true, true, []]);
    }

    /* ⑦ 마감 사유는 공고마다 하루 한 번 · 여러 학교만 받는 공고는 그 학교만 */
    {
      const env = { SUBS: fakeKV() };
      const reg = [{ id: 'nat', eligibility: {}, deadline: '2026-10-05' }, { id: 'later', eligibility: { schoolOnly: 'A대학교' }, deadline: '2026-12-01' }];
      const seq = [];
      for (const t of ['2026-10-04T08:10:00', '2026-10-04T20:10:00', '2026-10-05T08:10:00', '2026-10-05T20:10:00']) {
        at(KST(t));
        seq.push((await wake(env, [], reg)).wakeAll);
      }
      eq('⑦ 전국 공고(10-05 마감) — 10-04 08:10 깨움(장부가 빈 첫 실행에도) → 같은 날 20:10 안 깨움 → 10-05 08:10 깨움 → 20:10 안 깨움', seq, [true, false, true, false]);
      const env2 = { SUBS: fakeKV() };
      at(KST('2026-10-04T08:10:00'));
      const any = await wake(env2, [], [{ id: 'm', eligibility: { schoolsAny: ['경희대학교', '한국외국어대학교|서울'] }, deadline: '2026-10-05' }]);
      eq('  여러 학교만 받는 공고(schoolsAny · 캠퍼스 꼬리는 뗀다) → 전원이 아니라 그 학교만', [any.wakeAll, any.schools], [false, ['경희대학교', '한국외국어대학교']]);
    }

    /* ⑧ 게시판을 같이 쓰는 분교 — 화면(noticeForProfile)이 보여 주는 학교는 반드시 깨운다 */
    {
      const ME = require('../../match-engine.js');
      eq('⑧ 분교 표(SHARED_BOARD_BRANCH)가 match-engine 과 같다(사본 대조 — 원본을 바꾸면 여기가 빨개진다)', W.SHARED_BOARD_BRANCH || null, ME.SHARED_BOARD_BRANCH);
      const tagTitles = ['[ERICA] 장학', '(에리카) 장학', ' [ erica ] 장학', '[서울] 장학', '( 서울 ) 장학', '[서울캠퍼스] 장학', '장학 [ERICA]', 'ERICA 장학'];
      const tagDiff = ['한양대학교', '건국대학교'].flatMap((school) => tagTitles.map((title) => {
        const n = { school, title };
        return [school, title, typeof W.taggedSchool === 'function' ? W.taggedSchool(n) : '(없음)', ME.taggedSchool(n)];
      })).filter((r) => r[2] !== r[3]);
      eq('  제목 캠퍼스 표식(taggedSchool)이 match-engine 과 같은 답을 낸다(표본 16개)', tagDiff, []);
      const notices = [
        { url: 'u1', school: '한양대학교', title: '[ERICA] 장학 안내' },
        { url: 'u2', school: '한양대학교', title: '[서울] 장학 안내' },
        { url: 'u3', school: '한양대학교', title: '장학 안내' },
        { url: 'u4', school: '건국대학교', title: '[교외] 재단 장학' },
        { url: 'u5', school: '홍익대학교', title: '장학' },
        { url: 'u6', school: '한양대학교', title: '캠퍼스를 적은 글', campus: '서울' },
      ];
      const profiles = ['한양대학교', '한양대학교 ERICA캠퍼스', '건국대학교', '건국대학교 글로컬캠퍼스', '홍익대학교', '홍익대학교 세종캠퍼스'];
      const rows = [];
      for (const n of notices) {
        const env = { SUBS: fakeKV() };
        await env.SUBS.put('state:seen', JSON.stringify(['n:https://seed/0']));    // 첫 실행이 아니게
        at(KST('2026-10-04T08:10:00'));
        const got = (await wake(env, [n])).schools;
        const want = profiles.filter((p) => ME.noticeForProfile(n, { school: p }));
        const allow = new Set([...want, ME.taggedSchool(n) || n.school]);
        rows.push({ title: n.title, missed: want.filter((p) => !got.includes(p)), extra: got.filter((p) => !allow.has(p)) });
      }
      eq('  화면에 보이는 학교는 하나도 안 놓치고(놓침 0) · 화면 밖 학교는 제목이 밝힌 캠퍼스 말고는 안 깨운다 — 표본 6글 × 학교 6곳',
        rows.filter((r) => r.missed.length || r.extra.length), []);
      eq('  잰 표본에 분교가 실제로 보이는 글이 있다(헛도는 검사가 아니다)',
        notices.filter((n) => ['한양대학교 ERICA캠퍼스', '건국대학교 글로컬캠퍼스', '홍익대학교 세종캠퍼스'].some((p) => ME.noticeForProfile(n, { school: p }))).length, 3);
    }

    /* ── ⑨ 로그인 서버(Supabase) 매일 확인 ── */
    eq('⑨ 설정 읽기 — 주소·열쇠가 있으면 그 값(끝 / 는 뗀다) · 비었으면 null(= 꺼짐) · 글자가 깨졌으면 null',
      [readSupabaseConfig("const SUPABASE_CONFIG = { url: 'https://abc.supabase.co/', anonKey: 'sb_publishable_x', providers: [] };\nfunction supabaseConfigured() {}\nif (typeof module !== 'undefined' && module.exports) module.exports = { SUPABASE_CONFIG };"),
        readSupabaseConfig("const SUPABASE_CONFIG = { url: '', anonKey: '' };"), readSupabaseConfig('const SUPABASE_CONFIG = {')],
      [{ url: 'https://abc.supabase.co', anonKey: 'sb_publishable_x' }, null, null]);
    eq('  판정 — 200 ok · 401 misconfig · 403 misconfig · 540 down · 연결 실패 down',
      [sbVerdict({ ok: true, code: 200 }), sbVerdict({ ok: true, code: 401 }), sbVerdict({ ok: true, code: 403 }), sbVerdict({ ok: true, code: 540 }), sbVerdict({ ok: false, code: 0 })].map((v) => v.verdict),
      ['ok', 'misconfig', 'misconfig', 'down', 'down']);
    {
      const calls = [];
      const flaky = (codes) => async (u, o) => { calls.push([u, o.headers.apikey]); const c = codes.shift(); if (c === 'x') throw new Error('연결 끊김'); return { status: c }; };
      const cfg = { url: 'https://abc.supabase.co', anonKey: 'k' };
      const quiet = { sleep: async () => {}, log: () => {} };
      const a = await sbProbe(cfg, { fetchImpl: flaky(['x', 503, 200]), ...quiet });
      const n1 = calls.length;
      const b = await sbProbe(cfg, { fetchImpl: flaky([540, 540, 540]), ...quiet });
      eq('  묻기 — 일시 장애는 다시 묻는다(연결 끊김·503 뒤 200 → ok · 세 번) · 세 번 다 540 → down · /auth/v1/health 에 공개 열쇠를 싣는다',
        [a.verdict, n1, b.verdict, calls.length, calls[0]], ['ok', 3, 'down', 6, ['https://abc.supabase.co/auth/v1/health', 'k']]);
    }
    const sbw = readOpt('.github/workflows/supabase-health.yml');
    const sbSteps = stepsOf(sbw);
    const cronMin = Number(((/cron:\s*'(\d+)\s/.exec(codeOf(sbw)) || [])[1]) ?? NaN);
    const withOf = (s, k) => ((new RegExp(`^ {10}${k}:\\s*(.+)$`, 'm').exec((s && s.raw) || '') || [])[1] || '').trim();
    const openStep = sbSteps.find((s) => /alert-issue/.test(s.uses || '') && withOf(s, 'mode') === 'open') || {};
    const closeStep = sbSteps.find((s) => /alert-issue/.test(s.uses || '') && withOf(s, 'mode') === 'resolve') || {};
    eq('  supabase-health.yml — 예약은 홀수 분(0 아님) · 작업 시한 · 로컬 액션보다 체크아웃이 앞 · 판정 도구를 부른다',
      [!!sbw, cronMin % 2 === 1, /^ {4}timeout-minutes: \d+/m.test(sbw), actionBeforeCheckout(sbw), sbSteps.some((s) => /node tools\/supabase-health\.mjs/.test(s.run || ''))],
      [true, true, true, [], true]);
    eq('  이상(down·misconfig)이면 경보 한 곳(open) · 정상·꺼짐이면 닫는다(resolve · 같은 제목) · 넘어지면 robot-down',
      [/'down'/.test(openStep.if || '') && /'misconfig'/.test(openStep.if || ''), withOf(openStep, 'title'), /'ok'/.test(closeStep.if || '') && /'off'/.test(closeStep.if || ''), withOf(closeStep, 'title'),
        sbSteps.some((s) => /cancelled\(\)/.test(s.if || '') && /robot-down/.test(s.uses || ''))],
      [true, '🚨 로그인 서버(Supabase) 이상', true, '🚨 로그인 서버(Supabase) 이상', true]);
    eq('  설계 문서 「어디가 끊기면」 표에 로그인 줄이 있다', /\|\s*로그인\s*\|[^\n]*`supabase-health\.yml`/.test(readOpt('docs/designs/data-flow.md')), true);

    /* ── ⑩ 서비스워커 — 규칙 파일이 안 실려도 푸시를 받으면 알림 1건 ── */
    const swSrc = read('sw.js');
    const runSw = async (loadScripts) => {
      const handlers = {};
      const shown = [];
      const self = {
        addEventListener: (t, f) => { handlers[t] = f; },
        registration: { showNotification: async (t) => { shown.push(t); }, pushManager: { getSubscription: async () => null }, scope: 'https://x/' },
        clients: {}, skipWaiting() {}, location: { origin: 'https://x' },
      };
      const idb = {
        open() {
          const rq = {};
          setTimeout(() => {
            rq.result = {
              objectStoreNames: { contains: () => true },
              transaction() {
                const tx = { objectStore: () => ({ get() { const r = {}; setTimeout(() => { r.result = null; if (tx.oncomplete) tx.oncomplete(); }, 0); return r; } }) };
                return tx;
              },
            };
            if (rq.onsuccess) rq.onsuccess();
          }, 0);
          return rq;
        },
      };
      const box = {
        self, console: { log() {}, warn() {}, error() {} }, Promise, URL, Date, Math, JSON, setTimeout, clearTimeout,
        fetch: async () => ({ ok: false }), caches: { open: async () => ({}) }, indexedDB: idb,
        importScripts: (...files) => {
          if (!loadScripts) throw new Error('불러오기 실패(표본)');
          for (const f of files) vm.runInContext(read(f), box, { filename: f });
        },
      };
      box.globalThis = box;
      vm.createContext(box);
      vm.runInContext(swSrc, box, { filename: 'sw.js' });
      let p = null;
      if (handlers.push) handlers.push({ data: null, waitUntil: (x) => { p = x; } });
      const res = await Promise.resolve(p).then(() => 'resolved', (e) => `rejected: ${e && e.message}`);
      return { res, shown, box };
    };
    const sw1 = await runSw(false);
    eq('⑩ (a) importScripts 가 실패한 서비스워커가 빈 푸시를 받으면 — 거절 없이 알림 1건(기본 문구)', [sw1.res, sw1.shown], ['resolved', ['한대장 · 새 장학 소식']]);
    const list = ((/importScripts\(([^)]*)\)/.exec(stripComments(swSrc)) || [])[1] || '').match(/'[^']+'/g) || [];
    const sw2 = await runSw(true);
    eq('  (b) sw.js 의 importScripts 목록(순서 그대로)을 실제 파일로 실으면 알림 규칙·엔진이 선다(목록에서 하나 빠지면 빨간불)',
      [list.length >= 5, ['NOTIFY_RULES', 'evaluate', 'noticeFilesForProfile', 'noticeForProfile', 'scopedToProfile'].map((k) => vm.runInContext(`typeof ${k}`, sw2.box)),
        vm.runInContext("typeof NOTIFY_RULES === 'object' && typeof NOTIFY_RULES.shouldSelfUnsubscribe", sw2.box)],
      [true, ['object', 'function', 'function', 'function', 'function'], 'function']);
    eq('  (b) 규칙이 실린 서비스워커도 빈 푸시에 알림 1건(알릴 것 없으면 기본 문구)', [sw2.res, sw2.shown.length], ['resolved', 1]);
  } finally {
    Date.now = realNow;
    globalThis.fetch = realFetch;
  }
}

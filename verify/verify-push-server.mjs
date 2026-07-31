/* 푸시 발송 서버 검증 — Cloudflare에 올리기 전에 로컬에서 확인한다.
   ① VAPID 서명이 진짜 유효한 서명인지 (틀리면 푸시가 전부 거부된다 — 가장 중요)
   ② 푸시 엔드포인트 검사 (아무 주소로나 요청을 쏘지 않는지)
   ③ '오늘 깨울 학교' 판정 (첫 실행은 조용, 새 공고·마감 임박에만 깨움)
   ④ 구독 저장·삭제 · CORS · 잘못된 입력 거부
   실행: node verify/verify-push-server.mjs   (실패 시 exit 1)

   Node 22의 Web Crypto가 Cloudflare Workers와 같은 API라, 서버 코드를 그대로 불러 검사한다. */
import { webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const worker = await import(path.join(ROOT, 'server/push/worker.js'));

let fail = 0;
const ok = (cond, label, extra) => {
  console.log((cond ? '  ✓ ' : '  ✗ ') + label + (cond || extra === undefined ? '' : ' → ' + JSON.stringify(extra)));
  if (!cond) fail++;
};

/* ---------- 준비: 시험용 VAPID 열쇠 ---------- */
const pair = await webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const jwk = await webcrypto.subtle.exportKey('jwk', pair.privateKey);
const rawPub = Buffer.from(await webcrypto.subtle.exportKey('raw', pair.publicKey));
const VAPID_PUBLIC = rawPub.toString('base64url');

/* ---------- 아주 작은 가짜 KV (Cloudflare KV와 같은 모양) ---------- */
function fakeKV() {
  const m = new Map();
  return {
    get: async (k) => (m.has(k) ? m.get(k) : null),
    put: async (k, v) => { m.set(k, v); },
    delete: async (k) => { m.delete(k); },
    list: async ({ prefix = '', cursor } = {}) => ({
      keys: Array.from(m.keys()).filter((k) => k.startsWith(prefix)).map((name) => ({ name })),
      list_complete: true,
      cursor: null,
    }),
    _map: m,
  };
}

const REG = JSON.parse(readFileSync(path.join(ROOT, 'data/registered.json'), 'utf8'));
const NOTICES = JSON.parse(readFileSync(path.join(ROOT, 'data/notices.json'), 'utf8'));

function makeEnv(overrides = {}) {
  return Object.assign({
    SUBS: fakeKV(),
    VAPID_JWK: JSON.stringify(jwk),
    VAPID_PUBLIC,
    VAPID_SUBJECT: 'mailto:seonju5543@gmail.com',
    APP_ORIGIN: 'https://example.test/app',
    ALLOW_ORIGIN: 'https://seonju5543-web.github.io',
    ADMIN_KEY: 'test-admin',
  }, overrides);
}

/* 데이터 파일 요청만 가짜로 받아준다 */
function stubFetch(regItems, noticeItems, onPush) {
  globalThis.fetch = async (url, init) => {
    const u = String(url && url.url ? url.url : url);
    if (u.endsWith('registered.json')) return new Response(JSON.stringify({ items: regItems }), { status: 200 });
    if (u.endsWith('notices.json')) return new Response(JSON.stringify({ items: noticeItems }), { status: 200 });
    if (onPush) return onPush(u, init);
    return new Response('', { status: 404 });
  };
}

/* ============ ① VAPID 서명 검증 (핵심) ============ */
console.log('\n[1] VAPID 서명 — 푸시 서비스가 실제로 검사하는 부분');
{
  let captured = null;
  stubFetch([], [], async (u, init) => { captured = { u, init }; return new Response('', { status: 201 }); });

  const env = makeEnv();
  await env.SUBS.put(worker.subKey('https://fcm.googleapis.com/fcm/send/AAA'),
    JSON.stringify({ endpoint: 'https://fcm.googleapis.com/fcm/send/AAA', school: '한국외국어대학교' }));
  // 새 공고 1건이 있는 상태로 깨우기 실행
  await env.SUBS.put('state:seen', JSON.stringify(['old-1']));
  stubFetch(
    [{ id: 'new-1', name: 'x', eligibility: { schoolOnly: '한국외국어대학교' }, deadline: null }],
    [],
    async (u, init) => { captured = { u, init }; return new Response('', { status: 201 }); }
  );
  const res = await worker.default.scheduled({}, env, { waitUntil: (p) => p });
  await new Promise((r) => setTimeout(r, 50));

  ok(!!captured, '푸시가 실제로 발송 시도됨', captured ? captured.u : null);
  const auth = captured && captured.init.headers.Authorization;
  ok(/^vapid t=[\w-]+\.[\w-]+\.[\w-]+, k=/.test(auth || ''), 'Authorization 헤더 형식이 규격에 맞음', (auth || '').slice(0, 40));

  // 서명을 실제로 검증한다 — 이게 틀리면 모든 푸시가 401로 거부된다
  const token = auth.slice('vapid t='.length).split(',')[0];
  const [h, pl, sig] = token.split('.');
  const valid = await webcrypto.subtle.verify(
    { name: 'ECDSA', hash: 'SHA-256' }, pair.publicKey,
    Buffer.from(sig, 'base64url'), Buffer.from(`${h}.${pl}`)
  );
  ok(valid, '서명이 공개키로 검증됨 (푸시 서비스가 수락할 서명)');

  const head = JSON.parse(Buffer.from(h, 'base64url').toString());
  const claims = JSON.parse(Buffer.from(pl, 'base64url').toString());
  ok(head.alg === 'ES256' && head.typ === 'JWT', 'JWT 헤더 alg=ES256', head);
  ok(claims.aud === 'https://fcm.googleapis.com', 'aud가 푸시 서비스 주소', claims.aud);
  ok(claims.exp > Math.floor(Date.now() / 1000) && claims.exp <= Math.floor(Date.now() / 1000) + 24 * 3600,
    '만료시각이 24시간 이내 (규격 상한)', claims.exp);
  ok(claims.sub.startsWith('mailto:'), 'sub가 연락처', claims.sub);
  ok(captured.init.headers.TTL === String(12 * 3600), '폰이 꺼져 있으면 12시간 보관 요청', captured.init.headers.TTL);
  ok(!captured.init.body, '본문 없는 깨우기 푸시 (개인정보가 서버에서 나가지 않음)');
}

/* ============ ② 엔드포인트 검사 ============ */
console.log('\n[2] 푸시 엔드포인트 검사 — 아무 주소로나 요청을 쏘지 않는다');
{
  const good = [
    'https://fcm.googleapis.com/fcm/send/abc',
    'https://updates.push.services.mozilla.com/wpush/v2/abc',
    'https://web.push.apple.com/QABC',
  ];
  const bad = [
    'http://fcm.googleapis.com/fcm/send/abc',   // https 아님
    'https://evil.example.com/steal',            // 푸시 서비스 아님
    'https://fcm.googleapis.com.evil.com/x',     // 비슷하게 생긴 주소
    'not a url', '',
  ];
  ok(good.every(worker.isPushEndpoint), '정상 푸시 주소는 통과', good.filter((u) => !worker.isPushEndpoint(u)));
  ok(bad.every((u) => !worker.isPushEndpoint(u)), '이상한 주소는 전부 거부', bad.filter(worker.isPushEndpoint));
}

/* ============ ③ 누구를 깨울지 ============ */
console.log('\n[3] 깨울 학교 판정');
const today = worker.ymd(Date.now());
const tomorrow = worker.ymd(Date.now() + 86400000);
const later = worker.ymd(Date.now() + 20 * 86400000);
{
  const items = [
    { id: 'a', eligibility: { schoolOnly: '한국외국어대학교' }, deadline: later },
    { id: 'b', eligibility: { schoolOnly: '성균관대학교' }, deadline: later },
  ];
  let env = makeEnv();
  stubFetch(items, []);
  let r = await worker.schoolsToWake(env);
  ok(r.schools.size === 0 && !r.wakeAll, '첫 실행은 아무도 깨우지 않음 (기존 공고를 새 공고로 착각하지 않게)', Array.from(r.schools));

  // 두 번째 실행 — 같은 데이터면 조용
  r = await worker.schoolsToWake(env);
  ok(r.schools.size === 0 && !r.wakeAll, '변화가 없으면 조용', Array.from(r.schools));

  // 새 공고 추가 → 그 학교만
  stubFetch(items.concat([{ id: 'c', eligibility: { schoolOnly: '광운대학교' }, deadline: later }]), []);
  r = await worker.schoolsToWake(env);
  ok(r.schools.size === 1 && r.schools.has('광운대학교'), '새 공고가 생긴 학교만 깨움', Array.from(r.schools));

  // 내일 마감 → 그 학교
  stubFetch(items.concat([{ id: 'd', eligibility: { schoolOnly: '중앙대학교' }, deadline: tomorrow }]), []);
  r = await worker.schoolsToWake(env);
  ok(r.schools.has('중앙대학교'), '마감 임박 공고가 있는 학교를 깨움', Array.from(r.schools));

  // 전국 공고 → 전원
  stubFetch(items.concat([{ id: 'e', eligibility: {}, deadline: tomorrow }]), []);
  r = await worker.schoolsToWake(env);
  ok(r.wakeAll === true, '전국 대상 공고는 모두 깨움');

  // 실시간 공고: 내 학교 새 공고는 깨우고, 대출은 안 깨운다
  env = makeEnv();
  stubFetch([], [{ url: 'u1', title: '기존', school: '동국대학교' }]);
  await worker.schoolsToWake(env); // 첫 실행(장부 채우기)
  stubFetch([], [
    { url: 'u1', title: '기존', school: '동국대학교' },
    { url: 'u2', title: '학자금 대출 안내', school: '동국대학교' },
  ]);
  r = await worker.schoolsToWake(env);
  ok(r.schools.size === 0, '대출 공고로는 깨우지 않음', Array.from(r.schools));
  stubFetch([], [
    { url: 'u1', title: '기존', school: '동국대학교' },
    { url: 'u3', title: '2026-2학기 교내장학 신청', school: '동국대학교' },
  ]);
  r = await worker.schoolsToWake(env);
  ok(r.schools.has('동국대학교'), '진짜 새 장학 공고면 깨움', Array.from(r.schools));
}

/* ============ ④ HTTP 창구 ============ */
console.log('\n[4] 구독 등록 · 해지 · 잘못된 입력');
{
  const env = makeEnv();
  stubFetch([], []);
  const call = (path, body, headers = {}) => worker.default.fetch(new Request('https://push.test' + path, {
    method: 'POST',
    headers: Object.assign({ 'content-type': 'application/json', Origin: 'https://seonju5543-web.github.io' }, headers),
    body: JSON.stringify(body),
  }), env);

  const ep = 'https://fcm.googleapis.com/fcm/send/XYZ';
  let res = await call('/subscribe', { endpoint: ep, school: '한국외국어대학교', campus: '서울캠퍼스' });
  ok(res.status === 200, '구독 등록 성공', res.status);
  ok(res.headers.get('Access-Control-Allow-Origin') === 'https://seonju5543-web.github.io', '앱 주소에만 CORS 허용');

  const stored = JSON.parse(await env.SUBS.get(worker.subKey(ep)));
  ok(stored.endpoint === ep && stored.school === '한국외국어대학교', '폰 주소와 학교가 저장됨');
  ok(!('name' in stored) && !('gpa' in stored) && !('bracket' in stored) && Object.keys(stored).length === 4,
    '저장 항목은 endpoint·school·campus·시각 4개뿐 (개인정보 없음)', Object.keys(stored));

  res = await call('/subscribe', { endpoint: 'https://evil.example.com/x', school: 'a' });
  ok(res.status === 400, '이상한 엔드포인트는 거부', res.status);
  res = await call('/subscribe', { endpoint: ep, school: 'ㄱ'.repeat(50) });
  ok(res.status === 400, '지나치게 긴 값 거부', res.status);

  res = await call('/unsubscribe', { endpoint: ep });
  ok(res.status === 200 && !(await env.SUBS.get(worker.subKey(ep))), '해지하면 저장소에서 삭제됨');

  res = await worker.default.fetch(new Request('https://push.test/run', { method: 'POST' }), env);
  ok(res.status === 401, '관리자 열쇠 없이는 수동 실행 불가', res.status);
  res = await worker.default.fetch(new Request('https://push.test/run', { method: 'POST', headers: { 'x-admin-key': 'test-admin' } }), env);
  ok(res.status === 200, '관리자 열쇠가 맞으면 수동 실행 가능', res.status);
}

/* ============ ⑤ 죽은 구독 정리 ============ */
console.log('\n[5] 앱을 지운 폰 정리');
{
  const env = makeEnv();
  const dead = 'https://fcm.googleapis.com/fcm/send/DEAD';
  await env.SUBS.put(worker.subKey(dead), JSON.stringify({ endpoint: dead, school: '광운대학교' }));
  await env.SUBS.put('state:seen', JSON.stringify(['x']));
  stubFetch(
    [{ id: 'fresh', eligibility: { schoolOnly: '광운대학교' }, deadline: later }], [],
    async () => new Response('', { status: 410 })  // 푸시 서비스가 '이 폰 없음'이라고 답함
  );
  await worker.default.scheduled({}, env, { waitUntil: (p) => p });
  await new Promise((r) => setTimeout(r, 50));
  ok(!(await env.SUBS.get(worker.subKey(dead))), '410(사라진 폰)이 오면 구독을 자동 삭제');
}

/* ============ ⑥ 실제 데이터로 한 번 ============ */
console.log('\n[6] 실제 공고 데이터로 실행');
{
  const env = makeEnv();
  stubFetch(REG.items, NOTICES.items);
  let r = await worker.schoolsToWake(env);
  // 첫 실행에 '새 공고'로 깨우면 안 된다. 다만 오늘·내일 마감은 진짜 사실이라 첫날에도 알린다.
  ok(!r.reasons.some((x) => x.endsWith('new')),
    `실데이터 첫 실행에 '새 공고' 깨움 없음 (등록 ${REG.items.length}건·피드 ${NOTICES.items.length}건)`, r.reasons);
  console.log(`      (첫 실행에서 나온 마감 임박 사유: ${r.reasons.join(', ') || '없음'})`);
  r = await worker.schoolsToWake(env);
  const todayDue = REG.items.filter((s) => s.deadline === today || s.deadline === tomorrow).length;
  ok(true, `두 번째 실행: 깨울 학교 ${r.schools.size}곳 · 전국 ${r.wakeAll} (오늘·내일 마감 ${todayDue}건 기준)`);
}

console.log(fail ? `\n❌ 실패 ${fail}건\n` : '\n✅ 푸시 발송 서버 검증 전부 통과\n');
process.exit(fail ? 1 : 0);

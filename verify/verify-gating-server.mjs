/* 과팅 서버 검증 — Cloudflare 에 올리기 전에 로컬에서 확인한다 (2026-09-21).
   ① 짝 고르기(pairRequests)가 개발자 결정대로인가 — 남↔여 · 다른 과 · 인원 차 1 · 범위 양방향 ·
      차단·재매칭 제외 · 결정적
   ② 학교 이메일 판정 — ac.kr 은 전부 · 표에 있는 도메인만 학교 이름 · 없으면 null(지어내지 않는다)
   ③ 인증 번호는 해시로만 저장되고, 메일에는 번호만 가고 만능 열쇠는 Supabase 밖으로 안 나간다
   ④ Origin · 토큰 · 속도 제한
   실행: node verify/verify-gating-server.mjs   (실패 시 exit 1 · 인터넷 불필요) */
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
/* 🔴 동적 import 에는 file:// 주소를 넘긴다 (verify-push-server.mjs 의 교훈 — 윈도우에서 죽는다) */
const W = await import(pathToFileURL(path.join(ROOT, 'server/gating/worker.js')).href);
const worker = W.default;

let fail = 0;
const ok = (cond, label, extra) => {
  console.log((cond ? '  ✓ ' : '  ✗ ') + label + (cond || extra === undefined ? '' : ' → ' + JSON.stringify(extra)));
  if (!cond) fail++;
};

/* ───────── ① 짝 고르기 ───────── */
console.log('■ 짝 고르기 (pairRequests)');
{
  const r = (id, o) => Object.assign({ id, user_id: 'u' + id, school: '경희대학교', dept: '국문', gender: '남',
    headcount: 3, want_school: 'any', created_at: `2026-09-21T00:00:${String(id).padStart(2, '0')}Z`, status: 'waiting' }, o);
  const pair = (rs, blocks, recent) => W.pairRequests(rs, blocks || [], recent || []);

  ok(JSON.stringify(pair([r(1), r(2, { gender: '여', dept: '영문' })])) === '[[1,2]]', '남·여 · 다른 과 → 짝');
  ok(pair([r(1), r(2, { dept: '영문' })]).length === 0, '같은 성별은 짝이 아니다');
  ok(pair([r(1), r(2, { gender: '여' })]).length === 0, '같은 학교 같은 과는 짝이 아니다');
  ok(pair([r(1), r(2, { gender: '여', school: '한국외국어대학교' })]).length === 1, '학교가 다르면 같은 과 이름이어도 짝');
  ok(pair([r(1), r(2, { gender: '여', dept: '영문', headcount: 5 })]).length === 0, '인원 차 2 는 짝이 아니다');
  ok(pair([r(1), r(2, { gender: '여', dept: '영문', headcount: 4 })]).length === 1, '인원 차 1 은 된다');
  ok(pair([r(1, { want_school: 'same' }), r(2, { gender: '여', school: '한국외국어대학교' })]).length === 0,
    "'같은 학교만' 이면 다른 학교와는 안 맺는다 (내 쪽)");
  ok(pair([r(1), r(2, { gender: '여', school: '한국외국어대학교', want_school: 'same' })]).length === 0,
    "'같은 학교만' 은 상대 쪽 조건도 본다");
  ok(pair([r(1), r(2, { gender: '여', dept: '영문' })], [{ blocker: 'u2', blocked: 'u1' }]).length === 0, '차단한 사이는 안 맺는다');
  ok(pair([r(1), r(2, { gender: '여', dept: '영문' })], [], [{ user_a: 'u2', user_b: 'u1' }]).length === 0, '최근 짝이었던 둘은 다시 안 맺는다');
  ok(pair([r(1, { status: 'cancelled' }), r(2, { gender: '여', dept: '영문' })]).length === 0, '취소된 요청은 뺀다');
  ok(pair([r(1), r(2, { gender: '여', dept: '영문', user_id: 'u1' })]).length === 0, '같은 사람의 요청 둘은 안 맺는다');
  ok(pair([r(1, { gender: null }), r(2, { gender: '여', dept: '영문' })]).length === 0, '성별을 안 적은 요청은 안 맺는다');

  /* 점수 — 인원 같음 +2 · 같은 학교 +1. 먼저 온 요청이 가장 좋은 짝을 고른다 */
  const three = pair([r(1), r(2, { gender: '여', dept: '영문', headcount: 4 }), r(3, { gender: '여', dept: '영문', headcount: 3 })]);
  ok(JSON.stringify(three) === '[[1,3]]', '인원이 같은 쪽을 고른다', three);
  const sch = pair([r(1), r(2, { gender: '여', dept: '영문', school: '한국외국어대학교' }), r(3, { gender: '여', dept: '영문' })]);
  ok(JSON.stringify(sch) === '[[1,3]]', '점수가 같으면 같은 학교를 고른다', sch);

  /* 결정적 — 순서를 섞어 넣어도 같은 답 */
  const a = pair([r(1), r(2, { gender: '여', dept: '영문' }), r(3, { gender: '여', dept: '사학' }), r(4, { dept: '철학' })]);
  const b = pair([r(4, { dept: '철학' }), r(3, { gender: '여', dept: '사학' }), r(2, { gender: '여', dept: '영문' }), r(1)]);
  ok(JSON.stringify(a) === JSON.stringify(b), '입력 순서와 무관하게 같은 짝 (created_at 순)', [a, b]);
  ok(a.length === 2, '넷이면 두 쌍', a);
  const used = new Set(a.flat());
  ok(used.size === 4, '한 요청이 두 쌍에 들어가지 않는다');
}

/* ───────── ② 학교 이메일 판정 ───────── */
console.log('\n■ 학교 이메일 판정 (parseSchoolEmail)');
{
  const map = { domains: { 'khu.ac.kr': '경희대학교', 'skku.edu': '성균관대학교' } };
  const p = (e) => W.parseSchoolEmail(e, map);
  ok(p('a@khu.ac.kr').ok && p('a@khu.ac.kr').school === '경희대학교', '표에 있는 도메인 → 학교 이름');
  ok(p('a@mail.khu.ac.kr').school === '경희대학교', '하위 도메인도 그 학교');
  const unknown = p('a@abc.ac.kr');
  ok(unknown.ok === true && unknown.school === null && unknown.domain === 'abc.ac.kr',
    '🔴 표에 없는 ac.kr → 인증은 되고 학교 이름은 null (지어내지 않는다)', unknown);
  ok(p('a@skku.edu').ok && p('a@skku.edu').school === '성균관대학교', '표에 적힌 .edu 는 받는다');
  ok(p('a@gmail.com').ok === false, 'gmail 은 학교가 아니다');
  ok(p('a@ac.kr').ok === false, "'ac.kr' 자체는 학교가 아니다");
  ok(p('a@fake-ac.kr').ok === false, "'-ac.kr' 로 끝나는 가짜 도메인은 안 된다");
  ok(p('notanemail').ok === false, '이메일 꼴이 아니면 안 된다');
  ok(p('A@KHU.AC.KR').school === '경희대학교', '대문자도 같은 학교');
}

/* ───────── ③④ 요청 처리 — 가짜 Supabase · 가짜 Resend ───────── */
console.log('\n■ 인증 요청 처리 (가짜 서버)');
{
  const env = {
    APP_ORIGIN: 'https://example.test/app', ALLOW_ORIGIN: 'https://seonju5543-web.github.io',
    SUPABASE_URL: 'https://sb.test', SUPABASE_ANON: 'anon-key', SUPABASE_SERVICE_ROLE: 'SERVICE-SECRET',
    RESEND_KEY: 'RESEND-SECRET', VERIFY_PEPPER: 'pepper', MAIL_FROM: '한대장 <noreply@test>',
  };
  const calls = [];
  const db = { verifications: [], profiles: [], requests: [], blocks: [], matches: [], commits: [] };
  let nextId = 1;
  globalThis.fetch = async (url, init) => {
    const u = String(url);
    const method = (init && init.method) || 'GET';
    const headers = (init && init.headers) || {};
    const body = init && init.body ? JSON.parse(init.body) : null;
    calls.push({ url: u, method, headers, body });
    const J = (obj, status = 200) => new Response(JSON.stringify(obj), { status });
    if (u.endsWith('/data/school-domains.json')) return J({ domains: { 'khu.ac.kr': '경희대학교' } });
    if (u.startsWith('https://sb.test/auth/v1/user')) {
      const t = String(headers.Authorization || '');
      if (t === 'Bearer good-token') return J({ id: 'user-1', email: 'x@gmail.com' });
      return J({ msg: 'bad' }, 401);
    }
    if (u.startsWith('https://api.resend.com/emails')) return J({ id: 'mail-1' });
    if (u.includes('/rest/v1/school_verifications')) {
      if (method === 'POST') { db.verifications.push(Object.assign({ id: nextId++, attempts: 0, sent_at: new Date().toISOString(), consumed_at: null }, body)); return new Response(null, { status: 201 }); }
      if (method === 'PATCH') { const id = Number((u.match(/id=eq\.(\d+)/) || [])[1]); const row = db.verifications.find((r) => r.id === id); Object.assign(row, body); return new Response(null, { status: 204 }); }
      if (method === 'DELETE') return new Response(null, { status: 204 });
      const rows = db.verifications.filter((r) => u.includes('consumed_at=is.null') ? !r.consumed_at : true).sort((a, b) => b.id - a.id);
      return J(rows);
    }
    if (u.includes('/rest/v1/gating_profiles')) { db.profiles.push(body); return J([body], 201); }
    if (u.includes('/rest/v1/rpc/gating_run_expiry')) return new Response(null, { status: 204 });
    if (u.includes('/rest/v1/rpc/gating_commit_match')) { db.commits.push(body); return J(1); }
    if (u.includes('/rest/v1/gating_requests')) return J(db.requests);
    if (u.includes('/rest/v1/gating_blocks')) return J(db.blocks);
    if (u.includes('/rest/v1/gating_matches')) return J(db.matches);
    return J({ msg: 'not found' }, 404);
  };
  const req = (pathname, body, headers) => new Request('https://gating.test' + pathname, {
    method: body === undefined ? 'GET' : 'POST',
    headers: Object.assign({ Origin: 'https://seonju5543-web.github.io', 'content-type': 'application/json' }, headers || {}),
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  /* Origin · 토큰 */
  let res = await worker.fetch(req('/verify/send', { email: 'a@khu.ac.kr' }, { Origin: 'https://evil.test', Authorization: 'Bearer good-token' }), env);
  ok(res.status === 403, '다른 Origin 은 거부한다', res.status);
  res = await worker.fetch(req('/verify/send', { email: 'a@khu.ac.kr' }), env);
  ok(res.status === 401, '토큰 없으면 401', res.status);
  res = await worker.fetch(req('/verify/send', { email: 'a@khu.ac.kr' }, { Authorization: 'Bearer wrong' }), env);
  ok(res.status === 401, '가짜 토큰도 401', res.status);
  res = await worker.fetch(req('/health'), env);
  ok(res.status === 200 && (await res.json()).ok === true, '/health 는 열려 있다');

  /* 보내기 */
  const auth = { Authorization: 'Bearer good-token' };
  res = await worker.fetch(req('/verify/send', { email: 'a@gmail.com' }, auth), env);
  ok(res.status === 400 && (await res.json()).error === 'not_school', '학교 이메일이 아니면 400 not_school');
  res = await worker.fetch(req('/verify/send', { email: 'Stu@KHU.ac.kr' }, auth), env);
  const sent = await res.json();
  ok(res.status === 200 && sent.ok && sent.school === '경희대학교', '학교 이메일이면 번호를 보낸다', sent);
  const mail = calls.find((c) => c.url.startsWith('https://api.resend.com'));
  ok(!!mail && mail.body.to[0] === 'stu@khu.ac.kr', '메일은 소문자로 정리한 그 주소로 간다', mail && mail.body.to);
  const code = (mail.body.text.match(/\b(\d{6})\b/) || [])[1];
  ok(!!code, '메일 본문에 여섯 자리 번호가 있다');
  ok(!JSON.stringify(mail.headers).includes('SERVICE-SECRET') && !mail.body.text.includes('SERVICE-SECRET'),
    '🔴 만능 열쇠가 메일 서비스로 나가지 않는다');
  const row = db.verifications[0];
  ok(row && row.code_hash !== code && !row.code_hash.includes(code), '🔴 표에는 번호가 아니라 해시만 남는다', row && row.code_hash.slice(0, 12));
  ok(!JSON.stringify(sent).includes(code), '응답에 번호가 안 실린다');
  const sbCalls = calls.filter((c) => c.url.startsWith('https://sb.test/rest'));
  ok(sbCalls.every((c) => c.headers.apikey === 'SERVICE-SECRET'), '표를 만질 때는 만능 열쇠를 쓴다 (학생 토큰으로는 그 표에 못 쓴다)');
  const outside = calls.filter((c) => !c.url.startsWith('https://sb.test/') && JSON.stringify(c.headers).includes('SERVICE-SECRET'));
  ok(outside.length === 0, '🔴 만능 열쇠는 Supabase 밖으로 한 번도 안 나간다', outside.map((c) => c.url));

  /* 연달아 보내기 — 1분 안이면 429 */
  res = await worker.fetch(req('/verify/send', { email: 'stu@khu.ac.kr' }, auth), env);
  ok(res.status === 429, '1분 안에 다시 보내면 429');

  /* 확인 */
  res = await worker.fetch(req('/verify/check', { code: '000000' === code ? '111111' : '000000' }, auth), env);
  const wrong = await res.json();
  ok(res.status === 400 && wrong.error === 'wrong_code' && wrong.left === W.CODE_MAX_ATTEMPTS - 1, '틀리면 400 · 남은 횟수를 알린다', wrong);
  ok(db.verifications[0].attempts === 1, '틀린 횟수가 표에 쌓인다');
  res = await worker.fetch(req('/verify/check', { code }, auth), env);
  const done = await res.json();
  ok(res.status === 200 && done.ok && done.school === '경희대학교', '맞으면 인증 완료', done);
  const prof = db.profiles[0];
  ok(prof && prof.user_id === 'user-1' && prof.verified_domain === 'khu.ac.kr' && prof.school === '경희대학교', '프로필 행이 만들어진다', prof);
  ok(prof && !('email' in prof) && prof.school_email_hash && !prof.school_email_hash.includes('khu'), '🔴 프로필에는 이메일 원문이 아니라 해시만', prof && Object.keys(prof));
  ok(!('nickname' in (prof || {})), '닉네임은 서버가 정하지 않는다 (학생이 고른다)');
  ok(db.verifications[0].consumed_at, '쓴 번호는 닫힌다');

  /* 다섯 번 틀리면 잠긴다 */
  db.verifications.length = 0;
  await worker.fetch(req('/verify/send', { email: 'b@khu.ac.kr' }, auth), env);
  // 방금 보낸 것이라 1분 제한에 걸린다 — 표를 직접 손봐 오래전 발송으로 만든다
  db.verifications[0].sent_at = new Date(Date.now() - 3600 * 1000).toISOString();
  for (let i = 0; i < W.CODE_MAX_ATTEMPTS; i++) await worker.fetch(req('/verify/check', { code: '999999' }, auth), env);
  res = await worker.fetch(req('/verify/check', { code: '999999' }, auth), env);
  ok(res.status === 429, `${W.CODE_MAX_ATTEMPTS}번 틀리면 잠긴다`, res.status);

  /* 만료 */
  db.verifications.length = 0;
  db.verifications.push({ id: 99, user_id: 'user-1', email: 'c@khu.ac.kr', code_hash: 'x', attempts: 0,
    expires_at: new Date(Date.now() - 1000).toISOString(), sent_at: new Date(Date.now() - 3600 * 1000).toISOString(), consumed_at: null });
  res = await worker.fetch(req('/verify/check', { code: '123456' }, auth), env);
  ok(res.status === 410, '만료된 번호는 410');

  /* 예약 실행 — 짝을 고르고 확정 RPC 를 부른다 */
  console.log('\n■ 예약 실행 (만료 정리 → 매칭)');
  db.requests = [
    { id: 1, user_id: 'u1', school: '경희대학교', dept: '국문', gender: '남', headcount: 3, want_school: 'any', created_at: '2026-09-21T00:00:01Z', status: 'waiting' },
    { id: 2, user_id: 'u2', school: '경희대학교', dept: '영문', gender: '여', headcount: 3, want_school: 'any', created_at: '2026-09-21T00:00:02Z', status: 'waiting' },
    { id: 3, user_id: 'u3', school: '경희대학교', dept: '사학', gender: '남', headcount: 3, want_school: 'any', created_at: '2026-09-21T00:00:03Z', status: 'waiting' },
  ];
  const r = await W.runScheduled(env);
  ok(r.expired === true, '만료 정리 RPC 를 먼저 부른다');
  ok(r.proposed === 1 && r.committed === 1, '셋 중 남·여 한 쌍만 확정한다', r);
  ok(JSON.stringify(db.commits[0]) === '{"a":1,"b":2}', '확정은 SQL 함수(gating_commit_match)에 맡긴다', db.commits[0]);
  ok(calls.filter((c) => c.url.includes('gating_commit_match')).every((c) => c.headers.apikey === 'SERVICE-SECRET'), '확정 RPC 는 만능 열쇠로 부른다');
  res = await worker.fetch(req('/health'), env);
  const h = await res.json();
  ok(h.lastRun && h.lastRun.committed === 1, '/health 가 마지막 실행 결과를 보여 준다', h.lastRun);
}

console.log(fail ? `\n❌ 실패 ${fail}건` : '\n✅ 과팅 서버 검증 통과');
process.exit(fail ? 1 : 0);

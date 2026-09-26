/* ============================================================================
   접수 대행 — 보내기 전 서버 재검증 관문 (2026-09-25 · 고문 보고서 Q4)

   재는 것은 하나다: **변조된 클라이언트가 보내려 할 때 서버가 막는가.**
   🔴 판정을 여기 베끼지 않는다 — `server/apply/apply-guard.mjs` 를 실제로 불러 돌린다.
   실행: node verify/verify-apply-guard.mjs        (인터넷 불필요)
   ========================================================================== */
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { validateSubmission, deadlinePassed, SENDABLE } from '../server/apply/apply-guard.mjs';

let fail = 0;
const ok = (cond, label, extra) => {
  console.log((cond ? '  ✓ ' : '  ✕ ') + label + (cond || extra === undefined ? '' : ' → ' + JSON.stringify(extra)));
  if (!cond) fail++;
};
const NOW = new Date('2026-09-25T00:00:00Z');

/* 픽스처는 **실제 등록 공고의 모양** 그대로 만든다(칸 이름이 바뀌면 여기가 먼저 깨져야 한다) */
const NOTICE = {
  id: 'reg-test-mail', name: '시험 장학금', type: '교외',
  applyEmail: 'scholar@test.ac.kr',
  applyEmailSource: '신청서는 scholar@test.ac.kr 로 제출',
  deadline: '2026-12-31',
  /* ⚠️ 칸 이름은 **등록 데이터에 실제로 있는 것**이다 — 지어내면 이 관문이
     아무것도 안 막으면서 초록불이 된다(처음에 `gpaMin` 이라 써서 실제로 그랬다). */
  eligibility: { minGpa: 3.0 },
};
const REG = { items: [NOTICE] };
const P = { school: '한국외국어대학교', campus: '서울캠퍼스', track: 'humanities',
            major: '영어통번역학과', year: 3, status: '재학', gpa: 3.6, bracket: 5, flags: [] };

console.log('\n■ 보내도 되는 경우');
{
  const v = validateSubmission({ noticeId: NOTICE.id, profile: P }, REG, NOW);
  ok(v.ok, '자격을 채운 학생은 통과한다', v.why);
  ok(v.to === NOTICE.applyEmail, '🔴 보낼 주소는 **공고에서** 나온다', v.to);
}

console.log('\n■ 🔴 변조 — 막아야 하는 것');
{
  /* ① 클라이언트가 받는 주소를 지어내도 그 값을 쓰지 않는다 */
  const v = validateSubmission(
    { noticeId: NOTICE.id, profile: P, to: 'attacker@evil.ac.kr', applyEmail: 'attacker@evil.ac.kr' }, REG, NOW);
  ok(v.ok && v.to === NOTICE.applyEmail,
    '🔴 클라이언트가 준 받는 주소를 무시한다 (아무 .ac.kr 로나 보내지지 않는다)', v.to);

  /* ② 우리가 모르는 공고 */
  ok(!validateSubmission({ noticeId: 'reg-made-up', profile: P }, REG, NOW).ok,
    '모르는 공고는 막는다');

  /* ③ 자격 미달 — 성적을 낮춰 본다 */
  const low = validateSubmission({ noticeId: NOTICE.id, profile: { ...P, gpa: 1.0 } }, REG, NOW);
  ok(!low.ok, '자격 미달은 막는다', low);

  /* ④ 마감 지난 공고 */
  const past = { items: [{ ...NOTICE, deadline: '2026-01-01' }] };
  ok(!validateSubmission({ noticeId: NOTICE.id, profile: P }, past, NOW).ok, '마감된 공고는 막는다');

  /* ⑤ 근거 문장 없이 주소만 있는 공고 — 사람이 손으로 넣다 틀린 자리 */
  const noSrc = { items: [{ ...NOTICE, applyEmailSource: '' }] };
  ok(!validateSubmission({ noticeId: NOTICE.id, profile: P }, noSrc, NOW).ok,
    '접수 주소의 근거 문장이 없으면 막는다');

  /* ⑥ 학교 한정 공고를 남의 학교 학생이 */
  const only = { items: [{ ...NOTICE, eligibility: { ...NOTICE.eligibility, schoolOnly: '경희대학교' } }] };
  ok(!validateSubmission({ noticeId: NOTICE.id, profile: P }, only, NOW).ok,
    '🔴 남의 학교 한정 공고는 막는다', validateSubmission({ noticeId: NOTICE.id, profile: P }, only, NOW));

  /* ⑦ 프로필이 아예 없을 때 — 빈 값으로 통과하면 안 된다 */
  ok(!validateSubmission({ noticeId: NOTICE.id }, REG, NOW).ok, '프로필이 없으면 막는다');
  ok(!validateSubmission({}, REG, NOW).ok, '공고를 안 지정하면 막는다');
}

console.log('\n■ 판정을 베끼지 않았는가 (갈라지면 화면과 서버가 다른 말을 한다)');
{
  const src = fs.readFileSync(fileURLToPath(new URL('../server/apply/apply-guard.mjs', import.meta.url)), 'utf8');
  ok(/match-engine\.js/.test(src), '앱과 같은 match-engine 을 불러 쓴다');
  ok(/ME\.evaluate\(/.test(src), '자격 판정은 evaluate 로 한다');
  ok(/ME\.scopedToProfile\(/.test(src), '학교 범위도 같은 함수로 본다');
  ok(!SENDABLE.has('unknown'), "🔴 '자격을 못 읽은 공고'는 보내도 되는 것이 아니다");

  const w = fs.readFileSync(fileURLToPath(new URL('../server/apply/worker.js', import.meta.url)), 'utf8');
  ok(/validateSubmission\(/.test(w), '워커가 관문을 실제로 부른다');
  ok(/to: \[v\.to\]/.test(w), '🔴 워커가 보내는 주소는 관문이 고른 것이다');
  ok(!/payload\.to\b/.test(w), '워커가 클라이언트의 to 를 쓰지 않는다');
  ok(/env\.RESEND_KEY/.test(w) && /503/.test(w), '열쇠가 없으면 보내는 척하지 않는다');
}

console.log('\n■ 마감 판정 (날짜끼리 · 당일은 살아 있다)');
{
  ok(deadlinePassed('2026-09-01', NOW), '지난 마감은 지났다');
  ok(!deadlinePassed('2026-12-31', NOW), '남은 마감은 안 지났다');
  ok(!deadlinePassed('', NOW), '마감을 못 읽은 공고를 이 줄로 막지 않는다');
}

console.log('\n■ 발송 기록 · 바운스 (2026-09-26 · Q5 D+30)');
{
  const L = await import('../server/apply/send-log.mjs');
  const w = fs.readFileSync(fileURLToPath(new URL('../server/apply/worker.js', import.meta.url)), 'utf8');

  /* ① 발신 도메인 — SPF·DKIM·DMARC 는 DNS 라 코드로 못 잰다.
        잴 수 있는 것은 **인증한 도메인을 안 넣으면 코드가 닫히는가** 하나다. */
  ok(!/apply@handaejang\.app/.test(w), '🔴 발신 주소를 코드에 박아 두지 않는다');
  ok(/env\.APPLY_FROM/.test(w) && /APPLY_FROM\)\s*return say\(503/.test(w),
    '발신 도메인이 없으면 보내지 않는다 (스팸으로 버려지거나 반송된다)');

  /* ② 증빙 — 못 남기면 아예 안 보낸다 · 누가 냈는지는 토큰으로 확인한다 */
  ok(/logConfigured\(env\)\)\s*return say\(503/.test(w), '기록을 남길 수 없으면 대신 보내지 않는다');
  ok(/resolveUser\(env, req\.headers\.get\('Authorization'\)\)/.test(w),
    '🔴 누가 냈는지를 클라이언트 말로 믿지 않는다 (토큰을 서버가 확인)');
  ok(!/payload\.user_?[Ii]d/.test(w), '요청 본문의 user_id 를 쓰지 않는다');

  /* ③ 순서 — 보낸 뒤에 적는다(안 보낸 것을 보냈다고 적는 게 더 나쁘다) */
  ok(w.indexOf('api.resend.com') < w.indexOf('recordSend('), '기록은 발송 **뒤에** 한다');
  ok(/status: r\.ok \? 'queued' : 'failed'/.test(w), '발송이 실패하면 실패로 적는다');

  /* ④ 웹훅 — 서명을 못 맞추면 장부를 건드리지 않는다 */
  const SEC = 'whsec_' + Buffer.from('test-secret-key-16').toString('base64');
  const body = JSON.stringify({ type: 'email.bounced', data: { email_id: 'abc' } });
  const id = 'msg_1', ts = String(Math.floor(Date.now() / 1000));
  const crypto = await import('node:crypto');
  const good = crypto.createHmac('sha256', Buffer.from(SEC.replace(/^whsec_/, ''), 'base64'))
    .update(`${id}.${ts}.${body}`).digest('base64');
  const hdr = (sig, t) => new Map([['svix-id', id], ['svix-timestamp', t || ts], ['svix-signature', sig]]);
  const H = (m) => ({ get: (k) => m.get(k) ?? null });

  ok(await L.verifySvix(SEC, H(hdr('v1,' + good)), body), '맞는 서명은 통과한다');
  ok(!await L.verifySvix(SEC, H(hdr('v1,' + 'A'.repeat(good.length))), body), '🔴 틀린 서명은 막는다');
  ok(!await L.verifySvix(SEC, H(hdr('v1,' + good)), body + 'x'), '🔴 본문이 바뀌면 막는다');
  ok(!await L.verifySvix(SEC, H(hdr('v1,' + good, '1000000000')), body),
    '🔴 오래된 요청은 막는다 (되받아치기)');
  ok(!await L.verifySvix('', H(hdr('v1,' + good)), body), '열쇠가 없으면 막는다');
  /* 열쇠를 돌릴 때 서명이 여럿 온다 — 하나라도 맞으면 통과여야 한다(첫 것만 보면 교체 중 다 막힌다) */
  ok(await L.verifySvix(SEC, H(hdr('v1,' + 'B'.repeat(good.length) + ' v1,' + good)), body),
    '서명이 여럿이면 하나만 맞아도 통과한다 (열쇠 교체 중)');
  ok(/verifySvix\(env\.RESEND_WEBHOOK_SECRET/.test(w) && /status: 401/.test(w),
    '워커가 서명을 확인하고, 아니면 401');

  /* ⑤ 모르는 사건을 상태로 바꾸지 않는다 */
  ok(L.EVENT_STATUS['email.bounced'] === 'bounced', '반송은 bounced 로');
  ok(L.EVENT_STATUS['email.delivery_delayed'] === null, '지연은 아직 실패가 아니다');
  ok((await L.applyWebhook({}, { type: 'email.nonsense' })).ok === false, '모르는 사건은 반영하지 않는다');
  /* 🔴 보통 객체면 `'constructor' in 표` 가 **참**이라(프로토타입) 상태 칸에 함수가 들어간다.
     자체 리뷰에서 잡았다 — 되돌아오면 여기서 막힌다. */
  for (const proto of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) {
    ok((await L.applyWebhook({}, { type: proto })).why === '모르는 사건',
      `  🔴 프로토타입 이름을 사건으로 받지 않는다 (${proto})`);
  }
  /* 망가진 열쇠에 던지면 워커가 500 이고 Resend 가 계속 되보낸다 */
  ok(await L.verifySvix('whsec_!!!not-base64!!!',
    H(hdr('v1,' + good)), body) === false, '🔴 망가진 열쇠에 터지지 않고 막는다');

  /* CORS — `Authorization` 을 안 열면 브라우저가 그 헤더를 아예 안 보낸다(늘 401) */
  ok(/'Access-Control-Allow-Headers': 'Content-Type, Authorization'/.test(w),
    '🔴 CORS 가 Authorization 을 허용한다 (안 열면 학생을 영영 못 알아본다)');

  /* ⑥ 표와 정책 — 증빙이라 학생이 못 고쳐야 한다 */
  const sql = fs.readFileSync(fileURLToPath(new URL('../supabase/migrations/0003_apply_sends.sql', import.meta.url)), 'utf8');
  ok(/enable row level security/.test(sql), 'RLS 를 켠다');
  ok(/for select/.test(sql), '읽기 정책이 있다');
  ok(!/for (insert|update|delete|all)/.test(sql),
    '🔴 넣기·고치기·지우기 정책을 만들지 않는다 (학생이 증빙을 조작할 수 없다)');
  ok(!/service_role/.test(sql) || /절대 넣지 않는다/.test(sql), 'service_role 열쇠를 파일에 적지 않는다');
  for (const bad of ['formAns', 'docs', 'essay', 'rrn', 'account']) {
    ok(!new RegExp('\\b' + bad + '\\b').test(sql), `🔴 학생이 쓴 글·민감정보를 담지 않는다 (${bad})`);
  }
}

console.log(fail ? `\n✕ 실패 ${fail}건` : '\n✓ 접수 대행 재검증 관문 통과');
process.exit(fail ? 1 : 0);

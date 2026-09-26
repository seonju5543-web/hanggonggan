/* ============================================================================
   접수 대행 — 보내기 전 서버 재검증 관문 (2026-09-25 · 고문 보고서 Q4)

   재는 것은 하나다: **변조된 클라이언트가 보내려 할 때 서버가 막는가.**
   🔴 판정을 여기 베끼지 않는다 — `server/apply/apply-guard.mjs` 를 실제로 불러 돌린다.
   실행: node verify/verify-apply-guard.mjs        (인터넷 불필요)
   ========================================================================== */
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { validateSubmission, deadlinePassed, SENDABLE,
         PROFILE_BOUNDS, profileOutOfRange } from '../server/apply/apply-guard.mjs';

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
/* 🔴 **서버가 가진 사본**이다(넷째 인자). 요청 본문의 프로필이 아니다 —
   그 구분이 이 파일의 절반이다(2026-09-26). */
const HELD = (over) => ({ profile: { ...P, ...(over || {}) }, sensitiveOk: true });

console.log('\n■ 보내도 되는 경우');
{
  const v = validateSubmission({ noticeId: NOTICE.id }, REG, NOW, HELD());
  ok(v.ok, '자격을 채운 학생은 통과한다', v.why);
  ok(v.to === NOTICE.applyEmail, '🔴 보낼 주소는 **공고에서** 나온다', v.to);
}

console.log('\n■ 🔴 변조 — 막아야 하는 것');
{
  /* ① 클라이언트가 받는 주소를 지어내도 그 값을 쓰지 않는다 */
  const v = validateSubmission(
    { noticeId: NOTICE.id, to: 'attacker@evil.ac.kr', applyEmail: 'attacker@evil.ac.kr' }, REG, NOW, HELD());
  ok(v.ok && v.to === NOTICE.applyEmail,
    '🔴 클라이언트가 준 받는 주소를 무시한다 (아무 .ac.kr 로나 보내지지 않는다)', v.to);

  /* ② 우리가 모르는 공고 */
  ok(!validateSubmission({ noticeId: 'reg-made-up' }, REG, NOW, HELD()).ok, '모르는 공고는 막는다');

  /* ③ 자격 미달 — 성적을 낮춰 본다 */
  const low = validateSubmission({ noticeId: NOTICE.id }, REG, NOW, HELD({ gpa: 1.0 }));
  ok(!low.ok, '자격 미달은 막는다', low.why);

  /* ④ 마감 지난 공고 */
  const past = { items: [{ ...NOTICE, deadline: '2026-01-01' }] };
  ok(!validateSubmission({ noticeId: NOTICE.id }, past, NOW, HELD()).ok, '마감된 공고는 막는다');

  /* ⑤ 근거 문장 없이 주소만 있는 공고 — 사람이 손으로 넣다 틀린 자리 */
  const noSrc = { items: [{ ...NOTICE, applyEmailSource: '' }] };
  ok(!validateSubmission({ noticeId: NOTICE.id }, noSrc, NOW, HELD()).ok,
    '접수 주소의 근거 문장이 없으면 막는다');

  /* ⑥ 학교 한정 공고를 남의 학교 학생이 */
  const only = { items: [{ ...NOTICE, eligibility: { ...NOTICE.eligibility, schoolOnly: '경희대학교' } }] };
  ok(!validateSubmission({ noticeId: NOTICE.id }, only, NOW, HELD()).ok, '🔴 남의 학교 한정 공고는 막는다');

  /* ⑦ 프로필이 아예 없을 때 — 빈 값으로 통과하면 안 된다 */
  ok(!validateSubmission({ noticeId: NOTICE.id }, REG, NOW, null).ok, '서버에 프로필이 없으면 막는다');
  ok(!validateSubmission({}, REG, NOW, HELD()).ok, '공고를 안 지정하면 막는다');
}

console.log('\n■ 🔴 조작한 프로필로 자격을 맞힐 수 없다 (2026-09-26)');
{
  /* 이번 수정의 심장이다 — 요청 본문에 무엇을 적어 보내도 **서버 사본으로만** 판정해야 한다. */

  /* ① 성적을 올려 보낸다. 서버 사본은 미달이다 → 막혀야 한다. */
  const cheat = validateSubmission(
    { noticeId: NOTICE.id, profile: { ...P, gpa: 4.5 } }, REG, NOW, HELD({ gpa: 1.0 }));
  ok(!cheat.ok, '🔴 본문에 성적을 올려 적어도 통과하지 않는다', cheat.why);
  ok(cheat.code === 'not_eligible', '  이유는 자격 미달로 나온다', cheat.code);

  /* ② 반대 방향도 본다 — 본문이 미달이어도 **서버가 적합하면 보낸다.**
     (본문을 아예 안 본다는 뜻이다. 한쪽만 재면 '둘 다 보는' 코드도 통과한다.) */
  const ok2 = validateSubmission(
    { noticeId: NOTICE.id, profile: { ...P, gpa: 0.1 } }, REG, NOW, HELD({ gpa: 4.0 }));
  ok(ok2.ok, '🔴 본문이 미달이어도 서버 사본이 적합하면 보낸다 (본문을 안 본다)', ok2.why);

  /* ③ 학교를 바꿔 보낸다 — 남의 학교 한정 공고를 제 학교라고 적어도 안 된다. */
  const only = { items: [{ ...NOTICE, eligibility: { ...NOTICE.eligibility, schoolOnly: '경희대학교' } }] };
  ok(!validateSubmission({ noticeId: NOTICE.id, profile: { ...P, school: '경희대학교' } },
    only, NOW, HELD()).ok, '🔴 본문에 학교를 바꿔 적어도 통과하지 않는다');

  /* ④ 코드가 본문 프로필을 아예 안 읽는다 — 글자로도 못 박는다.
     ⚠️ 위 ①~③ 만으로는 '둘 다 보고 둘 다 맞아야 통과' 같은 구현도 통과한다. */
  /* ⚠️ **주석까지 세지 말 것** — 걷어낸 옛 배선을 인용한 주석에 걸려 빨간불이 났다(실제로 났다).
     이 저장소가 2026-09-12 에 같은 실수를 한 자리다. 주석을 지우고 **코드만** 본다. */
  const strip = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const g = strip(fs.readFileSync(fileURLToPath(new URL('../server/apply/apply-guard.mjs', import.meta.url)), 'utf8'));
  ok(!/payload\s*(&&\s*payload)?\s*\.\s*profile/.test(g), '🔴 apply-guard 가 payload.profile 을 읽지 않는다');
  const w0 = fs.readFileSync(fileURLToPath(new URL('../server/apply/worker.js', import.meta.url)), 'utf8');
  ok(/loadProfile\(env, userId\)/.test(w0), '워커가 서버 사본을 읽어 온다');
  ok(/validateSubmission\(payload, registered, null, held\)/.test(w0), '판정에 그 사본을 넘긴다');

  /* ⑤ '없다'와 '모른다'를 가른다 — 동의를 안 켠 학생에게 "특별자격이 없다"고 말하지 않는다.
     🔴 실측: flagsAny 공고 + flags 없는 프로필 → 엔진은 ineligible 을 내고 이유가
        "해당 특별자격이 필요해요" 다. 그대로 학생에게 보이면 거짓말이 된다. */
  const needFlag = { items: [{ ...NOTICE, eligibility: { flagsAny: ['basicLiving'] } }] };
  const noConsent = validateSubmission({ noticeId: NOTICE.id }, needFlag, NOW,
    { profile: { ...P, flags: undefined }, sensitiveOk: false });
  ok(!noConsent.ok, '민감정보 동의가 없으면 특별자격 공고는 막는다');
  ok(noConsent.code === 'sensitive_off',
    '🔴 그 이유를 "자격 미달"이 아니라 "확인할 수 없다"로 말한다', noConsent.code);
  ok(/동의/.test(noConsent.why), '  무엇을 하면 되는지 알려 준다', noConsent.why);
  /* 🔴 **넓히지 말 것** — `cert` 는 동의와 무관하게 서버에 올라간다(실측). 그래서 외국어성적
     미달은 '확인할 수 없다'가 아니라 **진짜 미달**이다. `needCert` 를 needsSensitive 에
     넣었다가 뺀 자리다 — 되살리면 여기서 막힌다. */
  const needCert = { items: [{ ...NOTICE, eligibility: { needCert: true } }] };
  const certFail = validateSubmission({ noticeId: NOTICE.id }, needCert, NOW,
    { profile: { ...P, cert: false }, sensitiveOk: false });
  ok(!certFail.ok && certFail.code === 'not_eligible',
    '🔴 외국어성적 미달은 "확인할 수 없다"가 아니라 자격 미달이다', certFail.code);

  /* 동의를 켠 학생은 그대로 판정한다(동의가 통과 티켓이 되면 안 된다) */
  const consented = validateSubmission({ noticeId: NOTICE.id }, needFlag, NOW,
    { profile: { ...P, flags: [] }, sensitiveOk: true });
  ok(!consented.ok && consented.code === 'not_eligible',
    '  동의를 켰는데 정말 없으면 자격 미달이다', consented.code);
}

console.log('\n■ 🔴 있을 수 없는 값 · DB 제약과 같은 숫자인가 (2026-09-26 · Q6)');
{
  /* 실제 구멍: 변조한 앱이 학생 본인 토큰으로 사본에 999 를 써 넣으면 `minGpa` 를
     뭐라고 적어 둬도 전부 통과한다. 사본을 읽는 것만으로는 못 막는다. */
  for (const [over, label] of [
    [{ gpa: 999 }, '성적 999'],
    [{ gpa: 4.6 }, '성적 4.6 (4.5 초과)'],
    [{ gpa: -1 }, '성적 음수'],
    [{ year: 99 }, '학년 99'],
    [{ bracket: 99 }, '학자금지원구간 99'],
    [{ credits: 999999 }, '이수학점 999999'],
    [{ credits: 31 }, '이수학점 31 (30 초과)'],
    [{ birthYear: 3000 }, '출생연도 3000 (나이가 음수가 된다)'],
    /* 🔴 **숫자로 못 읽는 값도 막는다** — 처음에는 "엔진이 저절로 미달로 떨어뜨린다"고 믿고
       통과시켰는데, 실측하니 `gpa: '사점일'` 이 *"성적 요건 충족"* 으로 나왔다(코드 리뷰). */
    [{ gpa: '사점일' }, "성적 '사점일' (숫자로 못 읽는다)"],
    [{ gpa: {} }, '성적이 객체'],
  ]) {
    const v = validateSubmission({ noticeId: NOTICE.id }, REG, NOW, HELD(over));
    ok(v.ok === false && v.code === 'profile_bad', `🔴 ${label} 은 판정 전에 막는다`, v);
  }
  /* 🔴 정상 학생을 막으면 안 된다 — 여기가 red-green 의 반대쪽이다 */
  for (const [over, label] of [
    [{ year: 0 }, '학년을 안 골랐다(0)'],
    [{ bracket: 0 }, '소득구간 0'],
    [{ gpa: 0 }, '성적 0.0 (진짜 0 이다)'],
    [{ gpa: 4.5 }, '성적 4.5 (경계)'],
    [{ gpa: null, year: null, bracket: null }, '전부 모른다'],
    [{ credits: 0 }, '이수학점 0 (진짜 0 이다)'],
    [{ credits: 30 }, '이수학점 30 (경계)'],
    [{ birthYear: 1940 }, '출생연도 1940 (경계)'],
    [{ credits: '', birthYear: null }, '이수학점·출생연도를 안 적었다'],
  ]) {
    const v = validateSubmission({ noticeId: NOTICE.id }, REG, NOW, HELD(over));
    ok(v.code !== 'profile_bad', `  ${label} 은 막지 않는다`, v.code);
  }
  /* 🔴 **'모른다'와 '읽을 수 없다'를 가른다** — 뭉개면 둘 중 하나가 틀린다 */
  ok(profileOutOfRange({ gpa: null }) === '' && profileOutOfRange({ gpa: '' }) === '',
    "안 적은 것은 '모른다'라 막지 않는다");
  ok(profileOutOfRange({ gpa: '사점일' }) === 'gpa',
    '🔴 숫자로 못 읽는 값은 막는다 (엔진은 그것을 *충족* 으로 읽는다 — 실측)');
  ok(profileOutOfRange({ gpa: '4.1' }) === '',
    '숫자로 적힌 문자열은 막지 않는다 (앱이 그렇게 보낼 수도 있다)');

  /* 🔴 **DB CHECK 와 숫자가 같은가** — 한쪽만 고치면 겹이 하나 사라지므로 여기서 잡는다 */
  const mig = fs.readFileSync(fileURLToPath(new URL('../supabase/migrations/0004_profile_columns.sql', import.meta.url)), 'utf8');
  const num = (re) => { const m = re.exec(mig); return m ? m.slice(1).map(Number) : null; };
  const sqlGrade   = num(/grade\s+between\s+([0-9.]+)\s+and\s+([0-9.]+)/);
  const sqlBracket = num(/income_bracket\s+between\s+([0-9.]+)\s+and\s+([0-9.]+)/);
  const sqlGpa     = num(/gpa\s*>=\s*([0-9.]+)\s+and\s+gpa\s*<=\s*([0-9.]+)/);
  ok(sqlGrade && sqlGrade[0] === PROFILE_BOUNDS.year[0] && sqlGrade[1] === PROFILE_BOUNDS.year[1],
    '🔴 학년 범위가 0004 의 CHECK 와 같다', { sql: sqlGrade, js: PROFILE_BOUNDS.year });
  ok(sqlBracket && sqlBracket[0] === PROFILE_BOUNDS.bracket[0] && sqlBracket[1] === PROFILE_BOUNDS.bracket[1],
    '🔴 소득구간 범위가 0004 의 CHECK 와 같다', { sql: sqlBracket, js: PROFILE_BOUNDS.bracket });
  ok(sqlGpa && sqlGpa[0] === PROFILE_BOUNDS.gpa[0] && sqlGpa[1] === PROFILE_BOUNDS.gpa[1],
    '🔴 성적 범위가 0004 의 CHECK 와 같다', { sql: sqlGpa, js: PROFILE_BOUNDS.gpa });
  const sqlCredits = num(/credits\s+between\s+([0-9.]+)\s+and\s+([0-9.]+)/);
  const sqlBirth   = num(/birth_year\s+between\s+([0-9.]+)\s+and\s+([0-9.]+)/);
  ok(sqlCredits && sqlCredits[0] === PROFILE_BOUNDS.credits[0] && sqlCredits[1] === PROFILE_BOUNDS.credits[1],
    '🔴 이수학점 범위가 0004 의 CHECK 와 같다', { sql: sqlCredits, js: PROFILE_BOUNDS.credits });
  ok(sqlBirth && sqlBirth[0] === PROFILE_BOUNDS.birthYear[0] && sqlBirth[1] === PROFILE_BOUNDS.birthYear[1],
    '🔴 출생연도 범위가 0004 의 CHECK 와 같다', { sql: sqlBirth, js: PROFILE_BOUNDS.birthYear });
  /* 🔴 **칸을 더했으면 여기도 늘어야 한다** — 새 칸을 PROFILE_BOUNDS 에 넣고 SQL 을
     잊으면(또는 그 반대면) 위 대조가 `null` 로 잡는다. 개수까지 못 박아 한쪽만 늘지 않게 한다. */
  ok(Object.keys(PROFILE_BOUNDS).length === 5,
    '범위를 재는 칸이 다섯이다 (늘렸으면 SQL·관문도 같이 늘린다)', Object.keys(PROFILE_BOUNDS));
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

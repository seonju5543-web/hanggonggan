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

console.log(fail ? `\n✕ 실패 ${fail}건` : '\n✓ 접수 대행 재검증 관문 통과');
process.exit(fail ? 1 : 0);

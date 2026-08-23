/* ============================================================
   초안 서버 실물 확인 — 진짜 Claude API가 이 요청 모양을 받아 주는가

   실행:  ANTHROPIC_API_KEY=... node server/essay/smoke.mjs
          (Actions 탭의 「초안 서버 실물 확인」 버튼이 이걸 돌립니다)

   왜 필요한가
     verify/verify-essay-guard.mjs 는 **가짜 응답**으로 안전장치를 검사한다.
     그건 "우리 규칙이 도는가"를 증명하지만 "API가 이 모양을 받아 주는가"는
     증명하지 못한다. 자격 AI가 `fallbacks` 하나 때문에 시범 3건이 전부 400으로
     죽은 일이 바로 그 틈에서 났다(2026-08-23) — 잔액이 없어 한 번도 안 걸렸다가
     잔액을 채우자마자 첫 호출부터 죽었다.

   🔴 **진짜 worker.js 를 그대로 부른다.** 요청 본문을 여기서 따로 만들면
      서버와 갈라져서, 여기서 통과한 모양이 실제 서버에서는 틀릴 수 있다.

   비용: 호출 1회 (소넷 기준 약 50원).
   ============================================================ */
import worker from './worker.js';

const KEY = process.env.ANTHROPIC_API_KEY;
if (!KEY) { console.error('ANTHROPIC_API_KEY 가 없습니다.'); process.exit(1); }

const ORIGIN = 'https://seonju5543-web.github.io';

/* 학생이 준 재료는 일부러 짧게 둔다 — 실제로 학생이 쓰는 만큼만 준다.
   모델이 여기 없는 사실을 넣으면 검사가 잡아야 한다. */
const payload = {
  scholarship: {
    name: '가송재단 장학금',
    provider: '가송재단',
    amountText: '학기당 200만원',
    quotes: ['가정형편이 어려우나 학업 의지가 뚜렷한 학생을 선발한다.'],
  },
  profile: { school: '한국외국어대학교', year: '3학년', major: '소프트웨어학과' },
  materials: [
    { label: '왜 필요한가', value: '등록금이 부담돼서' },
    { label: '요즘 하는 일', value: '주말에 아르바이트를 하고 있습니다' },
  ],
  fields: [
    { key: 'growth', kind: 'story', label: '성장과정 · 가정환경', hint: '성장과정과 가정환경', answer: '' },
    { key: 'volunteer', kind: 'fact', label: '봉사기관 · 봉사일자 · 봉사시간', hint: '', answer: '' },
  ],
};

const res = await worker.fetch(
  new Request('https://x/', {
    method: 'POST',
    headers: { Origin: ORIGIN, 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  }),
  { ANTHROPIC_API_KEY: KEY, ESSAY_MODEL: process.env.ESSAY_MODEL, ESSAY_EFFORT: process.env.ESSAY_EFFORT },
);
const j = await res.json();

console.log(`HTTP ${res.status}`);
if (j.error) {
  console.error(`\n❌ 실패: ${j.error}${j.status ? ` (API ${j.status})` : ''}`);
  if (j.why) console.error(`   API가 보낸 말: ${j.why}`);
  console.error('\n   → 요청 모양이 틀렸습니다. server/essay/worker.js 의 body 를 보세요.');
  process.exit(1);
}

console.log(`\n■ 초안 ${(j.drafts || []).length}칸 · 건너뜀 ${(j.skipped || []).length}칸`);
for (const d of j.drafts || []) console.log(`\n[${d.key}]\n${d.text}\n`);
for (const s of j.skipped || []) console.log(`  · ${s.key} — ${s.reason}`);

const gotStory = (j.drafts || []).some((d) => d.key === 'growth');
const blockedFact = (j.skipped || []).some((s) => s.key === 'volunteer');

if (!blockedFact) { console.error('\n❌ 사실 나열형 칸(volunteer)이 막히지 않았습니다.'); process.exit(1); }
console.log('\n✓ 사실 나열형 칸은 막혔습니다.');

if (!gotStory) {
  /* 초안이 검사에 걸린 것 자체는 실패가 아니다 — 안전장치가 일한 것이다.
     다만 매번 이러면 프롬프트를 손봐야 하므로 눈에 띄게 적는다. */
  console.log('\n⚠️ 서술형 칸에 초안이 안 나왔습니다 — 위 건너뜀 사유를 보세요.');
  console.log('   (지어냄이 걸린 것이면 안전장치가 제대로 일한 것입니다.)');
} else {
  console.log('✓ 서술형 칸에 초안이 나왔고 검사를 통과했습니다.');
}
console.log('\n✓ 진짜 API가 이 요청 모양을 받아 줍니다.');

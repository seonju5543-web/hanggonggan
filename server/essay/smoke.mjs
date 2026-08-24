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
import fs from 'node:fs';
import worker from './worker.js';
import { createRequire } from 'node:module';

const KEY = process.env.ANTHROPIC_API_KEY;
if (!KEY) { console.error('ANTHROPIC_API_KEY 가 없습니다.'); process.exit(1); }

const ORIGIN = 'https://seonju5543-web.github.io';
const DEMO = process.argv.includes('--demo');

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

/* ============================================================
   --demo — 개발자에게 **실제로 어떻게 작동하는지** 보여 주는 모드 (2026-08-24)

   개발자 지시: "B와 스토리텔링 클릭 질문도 예시로 어떻게 작용되는지 실제 사용을 통해 보여줘."

   🔴 손으로 만든 예시가 아니다. 아래 재료는 전부 **저장소의 진짜 데이터**에서 온다:
     · 공고 · 작성 규정 → data/essay-form-rules.json (collector/essay-house-mine.mjs 가 캔 것)
     · 재단이 보는 것 · 블라인드 → essay-ask.js 의 foundationFocus / blindReview
     · 질문과 보기          → essay-ask.js 의 ESSAY_ASKS / storyAsksFor
   학생이 한 일은 **보기를 누른 것**과 **한 줄을 직접 쓴 것**뿐이다.
   ============================================================ */
function demoIds() {
  const require2 = createRequire(import.meta.url);
  const RULES = require2('../../data/essay-form-rules.json');
  const has = (k) => RULES.notices[k].lines.some((l) => /(평가|심사)\s*기준\s*\d\s*순위/.test(l));
  if (process.env.DEMO_ID) return [process.env.DEMO_ID];
  const keys = Object.keys(RULES.notices);
  const out = [];
  const blind = keys.find((k) => RULES.notices[k].blind);      /* 블라인드가 작동하는 공고 */
  const focus = keys.find((k) => has(k));                       /* B 가 작동하는 공고 */
  for (const k of [focus, blind]) if (k && !out.includes(k)) out.push(k);
  return out.length ? out : keys.slice(0, 1);
}

function buildDemo(id) {
  const require2 = createRequire(import.meta.url);
  const ASK = require2('../../essay-ask.js');
  const REG = require2('../../data/registered.json');
  const RULES = require2('../../data/essay-form-rules.json');
  const items = REG.items || REG;

  const it = items.find((x) => x.id === id) || {};
  const rule = RULES.notices[id];
  const schIn = { name: it.name || '', provider: it.provider || '', quotes: (it.excerpts || []).concat(rule.lines) };

  const focus = ASK.foundationFocus(schIn);
  const blind = rule.blind || ASK.blindReview(schIn);

  /* 학생: 한국외대 3학년 · 인문계열 · 복학생 */
  const profile = { school: '한국외국어대학교', year: '3학년', major: '통번역학과',
    schoolAliases: ['외대', '한국외대', '한외대'] };
  const ctx = { profile: { track: 'humanities', year: 3, status: 'returning' }, scholarship: schIn, docs: ['langCert'] };

  /* 실제 서술형 칸 두 개 — 한 지원서 안에서 서로 이어져야 한다(규칙 4) */
  const raw = [
    { key: 'motive', kind: 'story', label: '장학금 신청 사유를 자기소개서 형식으로 (A4 2장 내외)' },
    { key: 'growth', kind: 'story', label: '성장과정 및 가정환경' },
  ];

  /* 학생이 누른 보기 — 질문 설계기가 실제로 낸 보기 중에서 고른다(지어내지 않는다) */
  const picked = {
    motive: { need: ['등록금 부담', '스스로 벌어 다님'], now: ['학업 리듬 되찾기'], change: ['아르바이트 축소'] },
    growth: { home: ['맞벌이'], hard: ['경제적 어려움'], learn: ['스스로 해내는 힘'] },
  };
  /* 학생이 **직접 쓴 한 줄** — 되묻기 칸. 이것이 글의 중심이 된다 */
  const own = {
    motive: '새벽 물류 아르바이트를 하면서도 전공 수업은 한 번도 빠지지 않았어요',
    growth: '부모님이 늦게 오셔서 초등학교 때부터 동생 저녁을 챙겼어요',
  };
  /* 스토리텔링 클릭 질문의 답 — 전부 **눌러서** 고른 것이다 */
  const story = {
    motive: { result: '아직 하는 중이에요', when: '새벽·야간', howLong: '2년 넘게' },
    growth: { turn: '대학에 오고 나서', when: '학기 중 매주', with: '가족과' },
  };

  const fields = raw.map((f) => {
    const plan = ASK.essayAskFor({ label: f.label, kind: 'story' }, ctx);
    const asks = [];
    for (const a of plan.asks) {
      const v = (picked[f.key] || {})[a.id];
      if (v) asks.push({ q: a.q, a: v.join(', '), own: false });
    }
    asks.push({ q: '꼭 넣고 싶은 말', a: own[f.key], own: true });
    for (const sc of plan.scene) {
      const v = (story[f.key] || {})[sc.id];
      if (v) asks.push({ q: sc.q, a: v, own: false });
    }
    return { key: f.key, kind: 'story', label: f.label, hint: '', askKind: plan.kind, target: plan.target, asks, answer: '' };
  });

  console.log('════════ 시연: 학생이 실제로 한 일 ════════');
  console.log(`공고: ${it.name}`);
  console.log(`이 재단이 보는 것(B): ${focus.length ? focus.map((x, i) => `${i + 1}. ${x.say}`).join('  ') : '(공고에 없음)'}`);
  console.log(`블라인드 심사: ${blind ? '예 — 학교명을 쓰면 심사에서 제외됩니다' : '아니오'}`);
  console.log(`이 공고가 정한 작성 규정 ${rule.lines.length}줄:`);
  for (const l of rule.lines.slice(0, 4)) console.log(`  · ${l}`);
  for (const f of fields) {
    console.log(`\n[${f.label}]  (목표 ${f.target}자)`);
    for (const a of f.asks) console.log(`  ${a.own ? '✍️ 직접 씀' : '👆 눌러서 고름'} — ${a.q}: ${a.a}`);
  }
  console.log('\n════════ 앱이 만든 글 ════════');

  return { scholarship: { name: it.name || '', provider: it.provider || '', amountText: it.amountText || '',
    quotes: (it.excerpts || []).slice(0, 10), writeRules: rule.lines, focus: focus.map((x) => x.say), blind },
    profile, materials: [], fields };
}

/* ── 실제로 부른다 ──
   시연 모드는 공고 2건(B가 작동하는 것 · 블라인드가 작동하는 것)을 각각 한 번씩 부른다.
   호출 2회 ≈ 100원. 평소 실물 확인은 예전 그대로 1회다. */
const jobs = DEMO ? demoIds() : [null];

for (const id of jobs) {
  await runOne(DEMO ? buildDemo(id) : payload);
}

async function runOne(sendPayload) {
const res = await worker.fetch(
  new Request('https://x/', {
    method: 'POST',
    headers: { Origin: ORIGIN, 'content-type': 'application/json' },
    body: JSON.stringify(sendPayload),
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
if (!DEMO) {
  const blockedFact = (j.skipped || []).some((s) => s.key === 'volunteer');
  if (!blockedFact) { console.error('\n❌ 사실 나열형 칸(volunteer)이 막히지 않았습니다.'); process.exit(1); }
  console.log('\n✓ 사실 나열형 칸은 막혔습니다.');
} else {
  /* 시연에서는 이것을 본다: 학교 이름이 한 글자도 안 들어갔는가 */
  const 학교표현 = ['한국외국어대학교', '한국외대', '외대', '한외대'];
  const 샌것 = (j.drafts || []).filter((d) => 학교표현.some((n) => d.text.includes(n)));
  console.log(샌것.length
    ? `\n❌ 블라인드 심사인데 학교 이름이 남았습니다: ${샌것.map((d) => d.key).join(', ')}`
    : '\n✓ 블라인드 심사 — 초안에 학교 이름이 한 글자도 없습니다.');
  for (const d of j.drafts || []) if ((d.quality || []).length) {
    console.log(`\n[${d.key}] 앱이 학생에게 짚어 줄 것:`);
    for (const w of d.quality) console.log(`  · ${w}`);
  }
}

if (!gotStory) {
  /* 초안이 검사에 걸린 것 자체는 실패가 아니다 — 안전장치가 일한 것이다.
     다만 매번 이러면 프롬프트를 손봐야 하므로 눈에 띄게 적는다. */
  console.log('\n⚠️ 서술형 칸에 초안이 안 나왔습니다 — 위 건너뜀 사유를 보세요.');
  console.log('   (지어냄이 걸린 것이면 안전장치가 제대로 일한 것입니다.)');
} else {
  console.log('✓ 서술형 칸에 초안이 나왔고 검사를 통과했습니다.');
}
console.log('\n✓ 진짜 API가 이 요청 모양을 받아 줍니다.');
}

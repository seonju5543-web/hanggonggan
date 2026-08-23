/* ============================================================
   키워드 질문 검사 — 서술형 칸에 빈 A4 2장을 던지지 않는가

   실행:  node verify/verify-essay-ask.mjs        (브라우저·서버·돈 불필요)

   🔴 이 검사가 지키는 두 가지

   ① **학생이 채워야 하는 양이 실제로 줄었는가.**
      개발자 지적(2026-08-23): "장학 신청 사유를 자기소개서로 (A4 2장 내외)"라고
      적힌 빈 칸을 학생에게 던지는 것은 우리가 할 일을 떠넘기는 것이다.
      서술형 칸 66개 전부에 키워드 질문이 배정돼야 한다 — 하나라도 빠지면
      그 칸은 예전처럼 빈 칸이 된다.

   ② **질문 수 상한(FORM_LIMITS)이 안 늘어났는가.**
      키워드 질문은 서술형 칸 **안에** 그려지므로 form-plan.js 의 countPlan 이
      세는 숫자가 그대로여야 한다. 늘어나면 24차 세션에서 정한 상한이 깨진다.
   ============================================================ */
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { essayAskFor, essayKindOf, essayTargetChars } = require('../essay-ask.js');
/* countPlan 은 내보내지 않는다 — planFormQuestions 가 plan.counts 에 넣어 주는 값이
   화면·감사가 실제로 쓰는 값이라 그것을 본다. */
const { planFormQuestions, formBudgetReport, FORM_LIMITS } = require('../form-plan.js');
const T = JSON.parse(fs.readFileSync(fileURLToPath(new URL('../data/forms.json', import.meta.url)), 'utf8')).templates;

let pass = 0, fail = 0;
const ok = (cond, name, extra) => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}${extra ? '\n      ' + extra : ''}`); }
};
const head = (s) => console.log(`\n[${s}]`);

const storyFields = [];
for (const [key, tpl] of Object.entries(T))
  for (const sec of tpl.sections || [])
    for (const f of sec.fields || [])
      if (f.type === 'textarea' && f.kind === 'story') storyFields.push({ form: key, f });

head('1) 빈 칸을 던지는 서술형이 하나도 없는가');
ok(storyFields.length > 0, `서술형(story) 칸 ${storyFields.length}개`);
{
  const noAsk = storyFields.filter(({ f }) => {
    const p = essayAskFor(f);
    return !p.asks || p.asks.length < 2;
  });
  ok(noAsk.length === 0, '① 모든 서술형 칸에 키워드 질문이 2개 이상 배정된다',
    noAsk.slice(0, 3).map((x) => `${x.form}/${x.f.id}`).join(', '));

  const generic = storyFields.filter(({ f }) => essayAskFor(f).kind === 'generic');
  ok(generic.length === 0, '① 종류를 못 알아본 칸이 없다 (generic 0)',
    generic.slice(0, 5).map((x) => String(x.f.label).replace(/\s+/g, ' ')).join(' / '));
}
{
  /* 키워드 질문의 절반 이상은 **눌러서 고르는 것**이어야 한다 —
     전부 직접 입력이면 '키워드만 고르면 된다'는 약속이 거짓말이 된다. */
  let clicky = 0, total = 0;
  for (const { f } of storyFields) {
    for (const a of essayAskFor(f).asks) { total++; if (a.c && a.c.length) clicky++; }
  }
  ok(clicky / total >= 0.5, `① 키워드 질문의 과반이 눌러서 고르는 것 (${clicky}/${total})`);
}

head('2) 분량을 원본 라벨에서 읽는가 — 지어내지 않는다');
ok(essayTargetChars('신청사유 (자기소개서) A4 2장 내외') === 1800, 'A4 2장 → 1800자');
ok(essayTargetChars('2. 자기소개 내용을 서술해 주세요. (500자 이상)') === 600, '500자 이상 → 600자');
ok(essayTargetChars('자기소개서 (1,000자 이내)') === 850, '1,000자 이내 → 850자 (쉼표가 있어도 읽는다)');
ok(essayTargetChars('1. 성장과정 및 가족사항 (400~800자)') === 600, '400~800자 → 600자');
ok(essayTargetChars('기타 특기사항') === 500, '분량이 안 적혀 있으면 500자');
{
  const big = storyFields.filter(({ f }) => essayAskFor(f).target >= 1500);
  ok(big.length > 0, `② 원본에 A4 2장이라고 적힌 칸을 실제로 찾아낸다 (${big.length}칸)`,
    big.map((x) => `${x.form}`).join(', '));
}

head('3) 종류를 알아보는가');
ok(essayKindOf('성장과정 · 가정환경') === 'growth', '성장과정 → growth');
ok(essayKindOf('지원 동기 및 포부') === 'future', '지원동기 및 포부 → future (포부가 더 구체적)');
ok(essayKindOf('신청사유 (자기소개서)') === 'motive', '신청사유 → motive');
ok(essayKindOf('성격 · 인생관') === 'character', '성격·인생관 → character');
ok(essayKindOf('나눔에 대한 본인의 생각이나 의지') === 'share', '나눔 → share');
ok(essayKindOf('장학금 사용계획') === 'use', '사용계획 → use');
ok(essayKindOf('재단에 하고 싶은 말') === 'message', '하고 싶은 말 → message');
ok(essayKindOf('자신의 성실성을 증명할 수 있는 경험') === 'episode', '경험 → episode');

head('4) 🔴 질문 수 상한이 안 늘어났는가');
{
  /* 키워드 질문은 서술형 칸 '안'에 그려진다. 그러므로 설계기가 세는 숫자는
     이 작업 전과 **완전히 같아야** 한다. 하나라도 달라지면 상한이 깨진 것이다. */
  /* 🔴 감사(audit-data.js)와 **같은 함수**로 센다 — formBudgetReport.
     여기서만 planFormQuestions(tpl, {}) 처럼 따로 부르면 프로필이 빈 상태로 세어
     감사와 숫자가 갈라진다(실제로 15종 대 2종으로 갈라졌다). */
  const leaked = [];
  let worst = { input: 0, click: 0, total: 0 };
  let overForms = 0;
  for (const [key, tpl] of Object.entries(T)) {
    const b = formBudgetReport(tpl);
    const c = b.counts;
    worst = { input: Math.max(worst.input, c.input), click: Math.max(worst.click, c.click), total: Math.max(worst.total, c.total) };
    if (b.over.length) overForms++;
    /* 설계기가 세는 항목에 '키워드 질문'이 섞여 들어온 것이 없는지 본다 */
    for (const sec of planFormQuestions(tpl, {}).secs)
      for (const f of sec.items)
        if (String(f.id || '').startsWith('ask-')) leaked.push(`${key}/${f.id}`);
  }
  ok(leaked.length === 0, '④ 키워드 질문이 설계기의 질문 목록에 섞이지 않는다', leaked.slice(0, 3).join(', '));
  console.log(`      가장 많은 양식: 직접입력 ${worst.input} · 클릭 ${worst.click} · 전체 ${worst.total}`
    + `  (상한 ${FORM_LIMITS.input}/${FORM_LIMITS.click}/${FORM_LIMITS.total})`);
  /* 상한을 넘는 양식은 이 작업 전에도 2종이었다(감사가 경고로 잡고 있다).
     늘었으면 키워드 질문이 새 질문으로 새어 들어간 것이다. */
  ok(overForms === 2, `④ 상한을 넘는 양식이 그대로 2종이다 (지금 ${overForms}종)`);
}

head('5) 보기를 지어내지 않는가');
{
  /* 키워드 보기는 '흔한 사정'을 적어 둔 것이고, 고르지 않으면 글에 안 들어간다.
     그래도 민감정보(별도 동의가 필요한 항목)를 보기로 내밀면 안 된다 —
     서버가 그 요청을 통째로 거절하므로 기능이 조용히 죽는다. */
  const BAD = ['기초생활수급', '차상위', '국가유공자', '보훈', '장애등급', '장애인등록', '주민등록번호', '계좌'];
  const hits = [];
  for (const { f } of storyFields)
    for (const a of essayAskFor(f).asks)
      for (const c of a.c || [])
        for (const b of BAD) if (c.includes(b)) hits.push(`${c} (${b})`);
  ok(hits.length === 0, '⑤ 민감정보를 보기로 내밀지 않는다 — 서버가 거절해 기능이 죽는다',
    [...new Set(hits)].join(', '));
}

console.log(`\n${fail ? '✗' : '✓'} 키워드 질문 — 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);

/* ============================================================
   제출 전 점검표 검사 — '제출 가능'의 선이 실제로 그어지는가

   실행:  node verify/verify-essay-submit.mjs        (브라우저·서버·돈 불필요)

   설계: docs/designs/essay-submit-ready.md 1순위.
   판정 원본은 essay-submit-check.js 한 곳 — 이 검사가 그 함수를 그대로 돌려 본다.

   🔴 이 검사가 지키는 것
   ① 막을 것을 실제로 막는가 — 빈칸 `[ ]`·블라인드 공고의 학교명이 있으면
      submittable=false 여야 한다(그대로 내면 학생이 손해 본다).
   ② 제안(warn)은 막지 않는가 — 분량·문체·재단정렬·직접이야기는 submittable 을 안 내린다.
   ③ 지어내지 않는가 — 공고가 안 밝힌 것(focus 없음)·블라인드 아님이면 그 줄이 아예 없다.
   ============================================================ */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const {
  essaySubmitChecklist, essayCountBlanks, essayStyleMixed,
  essaySchoolLeak, essayFocusMissing,
} = require('../essay-submit-check.js');

let pass = 0, fail = 0;
const ok = (cond, name, extra) => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}${extra ? '\n      ' + extra : ''}`); }
};
const head = (s) => console.log(`\n[${s}]`);

/* 한 칸 재료의 기본형 — 필요한 것만 덮어쓴다 */
const field = (over = {}) => Object.assign({
  label: '지원 동기', text: '', blind: false, schoolTerms: [],
  focus: [], lengthWarn: false, ownWarn: false,
}, over);

head('1) 빈칸 [ ] 세기');
ok(essayCountBlanks('앞 [ ] 뒤') === 1, '[ ] 하나를 센다');
ok(essayCountBlanks('[]와 [   ]') === 2, '[] 와 [   ] 를 모두 센다');
ok(essayCountBlanks('대괄호 없음[문자]') === 0, '내용이 있는 대괄호는 빈칸이 아니다');

head('2) 문체 혼용');
ok(essayStyleMixed('열심히 했습니다. 앞으로도 잘할게요.') === true, '합니다체+해요체가 섞이면 잡는다');
ok(essayStyleMixed('열심히 했습니다. 앞으로도 잘하겠습니다.') === false, '합니다체만이면 안 잡는다');
ok(essayStyleMixed('열심히 했어요. 앞으로도 잘할게요.') === false, '해요체만이면 안 잡는다');
ok(essayStyleMixed('') === false, '빈 글은 혼용이 아니다');
/* 🔴 요-끝 명사(중요/필요…)가 문장 끝에 와도 해요체로 오해하지 않는다(코드 리뷰 지적).
   '중요.'·'필요.'는 형식체 글에도 나오는데, 빼지 않으면 문체 혼용 경고가 잘못 뜬다. */
ok(essayStyleMixed('저는 끝까지 해냈습니다. 무엇보다 꾸준함이 중요.') === false,
  '형식체 + 요-끝 명사(중요)는 혼용이 아니다');
ok(essayStyleMixed('열심히 준비했습니다. 그래서 자신 있게 지원해요.') === true,
  '형식체 + 진짜 해요체(지원해요)는 혼용으로 잡는다');

head('3) 블라인드 유출 — 학교명·별칭');
ok(essaySchoolLeak('저는 외대에서 공부했습니다', ['한국외국어대학교', '외대']).join() === '외대',
  '별칭 "외대"를 잡는다');
ok(essaySchoolLeak('전공 수업을 열심히 들었습니다', ['한국외국어대학교', '외대']).length === 0,
  '학교 이름이 없으면 빈 배열');
/* 🔴 흔한 낱말·지명과 겹치는 짧은 별칭은 막지 않는다(코드 리뷰 지적 · block 오탐 방지) */
ok(essaySchoolLeak('오래도록 고대하던 꿈을 이뤘습니다', ['고려대학교', '고대']).length === 0,
  "'고대하던'을 학교(고대)로 오해해 막지 않는다");
ok(essaySchoolLeak('연대 의식을 배웠습니다', ['연세대학교', '연대']).length === 0,
  "'연대 의식'을 학교(연대)로 오해해 막지 않는다");
ok(essaySchoolLeak('저는 고려대학교 학생입니다', ['고려대학교', '고대'])[0] === '고려대학교',
  '정식 명칭은 그대로 막는다 (짧은 별칭만 예외)');

head('4) 재단 정렬 — foundationFocus 반영');
{
  const focus = [{ say: '나눔과 사회 기여', re: /나눔|봉사|사회\s*공헌/ }];
  ok(JSON.stringify(essayFocusMissing('평소 봉사를 이어 왔습니다', focus)) === '[]',
    '재단이 보는 것이 글에 있으면 빠진 것 없음([])');
  ok(essayFocusMissing('성적을 관리했습니다', focus)[0] === '나눔과 사회 기여',
    '없으면 빠진 항목을 돌려준다');
  ok(essayFocusMissing('아무 글', []) === null, '공고가 밝힌 것이 없으면 판정 안 함(null)');
}

head('5) 점검표 조립 — 막을 것을 막는가');
{
  const r = essaySubmitChecklist({ fields: [field({ text: '가정 형편이 [ ] 어려워' })] });
  const blank = r.items.find((i) => i.id === 'blank');
  ok(blank && blank.status === 'block', '빈칸 [ ] 이 있으면 block');
  ok(r.submittable === false, '① 빈칸이 있으면 제출 불가(submittable=false)');
}
{
  const r = essaySubmitChecklist({ fields: [
    field({ blind: true, schoolTerms: ['외대'], text: '저는 외대 학생으로서 열심히 했습니다' }),
  ] });
  const b = r.items.find((i) => i.id === 'blind');
  ok(b && b.status === 'block', '블라인드 공고에 학교명이 남으면 block');
  ok(r.submittable === false, '① 블라인드 유출이면 제출 불가');
}
{
  /* 블라인드 아님 → 블라인드 줄이 아예 없다(지어내지 않는다) */
  const r = essaySubmitChecklist({ fields: [field({ text: '깨끗한 글입니다' })] });
  ok(!r.items.some((i) => i.id === 'blind'), '③ 블라인드 공고가 아니면 블라인드 줄이 없다');
}

head('6) 제안(warn)은 제출을 막지 않는가');
{
  const r = essaySubmitChecklist({ fields: [field({
    lengthWarn: true, ownWarn: true,
    text: '봉사도 했고 잘했습니다',
    focus: [{ say: '이공계 전공 역량', re: /이공|공학|과학/ }],   // 글에 없음 → focus warn
  })] });
  ok(r.submittable === true, '② 분량·직접이야기·재단정렬은 제출을 막지 않는다');
  ok(r.items.find((i) => i.id === 'length').status === 'warn', '분량이 warn 으로 뜬다');
  ok(r.items.find((i) => i.id === 'own').status === 'warn', '직접 이야기 없음이 warn');
  ok(r.items.find((i) => i.id === 'focus').status === 'warn', '재단 정렬 빠짐이 warn');
  ok(r.allPass === false, 'warn 이 있으면 allPass=false');
}

head('7) 전부 통과 — 제출 가능');
{
  const r = essaySubmitChecklist({ fields: [field({
    text: '봉사를 2년 넘게 이어 오며 배운 것을 앞으로도 이어 가겠습니다',
    focus: [{ say: '나눔과 사회 기여', re: /나눔|봉사/ }],
  })] });
  ok(r.allPass === true, '막을 것·제안 모두 없으면 allPass=true (제출 가능 ✅)');
  ok(r.submittable === true, 'submittable=true');
}

head('8) 빈 자소서는 제출 가능이 아니다 (분량 줄이 잡는다)');
{
  const r = essaySubmitChecklist({ fields: [field({ text: '' })] });
  const len = r.items.find((i) => i.id === 'length');
  ok(len && len.status === 'warn', '빈 칸이면 분량 줄이 warn (essay-quality 가 빈 글을 통과시켜도)');
  ok(r.allPass === false, '빈 자소서는 allPass=false — "제출 가능 ✅"이 안 뜬다');
  ok(r.submittable === true, '다만 막지는 않는다 — 손으로 채울 수도 있으니(warn)');
}

head('9) 빈 입력에도 안 죽는다');
{
  const r = essaySubmitChecklist({ fields: [] });
  ok(r && Array.isArray(r.items), '필드가 없어도 결과 객체를 돌려준다');
}

console.log(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);

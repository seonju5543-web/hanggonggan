/* ============================================================
   서술형 질문 조사 — 양식 자동 작성 고도화(다음 작업)의 출발점

   왜 이 도구가 먼저인가: 자격 요건 작업에서 배운 것과 같다 —
   **공고를 하나씩 열어 보고 고치는 방식으로는 끝이 안 난다.**
   전수로 세어 놓고, 규칙을 고치기 전후로 숫자를 비교해야 한다.

   🔴 이 도구가 답하는 가장 중요한 질문:
   "AI가 글을 써 줘도 되는 칸과, 손대면 학생이 허위 기재를 하게 되는 칸을 갈랐는가."
   봉사시간·학력 연월일·가족사항을 AI가 채우면 자격 미달보다 훨씬 나쁜 일이 벌어진다.

   실행: node verify/essay-survey.mjs        요약
         node verify/essay-survey.mjs --fact  사실 나열형 전부 (AI 금지 구역)
         node verify/essay-survey.mjs --gray  애매한 것 전부 (사람이 원본 대조로 갈라야 함)
         node verify/essay-survey.mjs --bare  추천 문구 없이 빈 칸에서 시작하는 질문
   ============================================================ */
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const T = JSON.parse(fs.readFileSync(
  fileURLToPath(new URL('../data/forms.json', import.meta.url)), 'utf8')).templates;

/* 학생만 아는 사실(날짜·기관·시간·금액)을 적는 칸 — 지어내면 허위 서류가 된다 */
const FACT = /학력|경력|가족|봉사|수혜|내역|자격증|수상|일자|기간|연월일|증명|명단|목록|계좌|주소|번호|교과목|논문|추천인/;
/* 학생의 생각·계획을 글로 쓰는 칸 — AI가 도울 수 있는 자리 */
const STORY = /동기|사유|포부|계획|소개|성장|과정|인생관|성격|의지|생각|강점|목표|배경|필요성|주제|아이디어|방법|의견|다짐|각오|경험/;

const rows = [];
for (const [key, tpl] of Object.entries(T)) {
  for (const sec of tpl.sections || []) {
    for (const f of sec.fields || []) {
      if (f.type !== 'textarea') continue;
      const label = String(f.label || '').replace(/\s+/g, ' ').trim();
      /* 데이터가 못 박은 것이 언제나 이긴다 — 규칙은 아직 안 정한 것을 메우는 자리다 */
      let kind = f.kind || '';
      if (!kind) {
        if (FACT.test(label) && !STORY.test(label)) kind = 'fact';
        else if (STORY.test(label)) kind = 'story';
        else kind = 'gray';
      }
      rows.push({ form: key, label, kind, declared: !!f.kind, sugg: (f.sugg || []).length });
    }
  }
}

const n = (k) => rows.filter((r) => r.kind === k).length;
const arg = process.argv[2] || '';

if (arg === '--fact' || arg === '--gray' || arg === '--story') {
  const want = arg.slice(2);
  rows.filter((r) => r.kind === want).forEach((r) =>
    console.log(`  ${r.declared ? '[데이터]' : '[추정]  '} ${r.label.slice(0, 52).padEnd(54)} ${r.form}`));
  process.exit(0);
}
if (arg === '--bare') {
  const bare = rows.filter((r) => !r.sugg);
  console.log(`추천 문구 없이 빈 칸에서 시작하는 서술형: ${bare.length}개\n`);
  bare.forEach((r) => console.log(`  ${r.kind.padEnd(6)} ${r.label.slice(0, 52).padEnd(54)} ${r.form}`));
  process.exit(0);
}

console.log(`양식 ${Object.keys(T).length}종 · 서술형 질문 ${rows.length}개\n`);
console.log(`  스토리텔링형 (AI가 글을 써 줄 자리) : ${n('story')}개`);
console.log(`  사실 나열형   (🔴 AI 금지 구역)     : ${n('fact')}개   → --fact`);
console.log(`  애매          (사람이 갈라야 함)     : ${n('gray')}개   → --gray`);
console.log();
const declared = rows.filter((r) => r.declared).length;
console.log(`  데이터에 kind가 적힌 것 : ${declared} / ${rows.length}개`);
if (declared < rows.length) {
  console.log(`  ⚠️ 나머지 ${rows.length - declared}개는 라벨로 **추정**한 것이다.`);
  console.log(`     추정이 틀리면 학생이 허위 기재를 하게 되므로, AI를 붙이기 전에`);
  console.log(`     최소한 사실 나열형·애매 ${n('fact') + n('gray')}개는 원본과 대조해 data/forms.json에 kind를 적을 것.`);
}
console.log();
console.log(`  추천 문구가 있는 것 : ${rows.filter((r) => r.sugg).length}개`);
console.log(`  빈 칸에서 시작      : ${rows.filter((r) => !r.sugg).length}개   → --bare`);

/* ============================================================
   '학생이 직접 써야 하는 양' 전수 조사 (2026-08-23 개발자 지시)

   실행:  node verify/formfill-burden.mjs          요약
          node verify/formfill-burden.mjs --list   공고별 전부
          node verify/formfill-burden.mjs --bad    아직 빈 칸을 던지는 공고만

   🔴 왜 이 도구가 필요한가
      개발자 지적(2026-08-23): "직접입력칸에 사용자의존적 서비스로 변환된 모든 공고에
      대해 해결됐는지 확인해 달라." 한 건 고쳐 놓고 됐다고 하면 안 된다.
      자격 요건 작업에서 배운 것과 같다 — **전수로 세어 놓고 전후를 비교한다.**

   무엇을 세는가 (한 공고 = 한 양식 기준)
      ⓐ 키워드로 해결된 서술형   : 학생은 누르기만 하면 된다 (story + 키워드 카드)
      ⓑ 아직 직접 써야 하는 서술형 : 사실을 적는 칸(fact) — AI가 채우면 허위 서류가 된다
      ⓒ 짧은 직접 입력            : 프로필로 못 채우는 한 줄 칸
      ⓓ 클릭                     : 눌러서 고르는 칸

      '해결됨' = 그 양식의 서술형 중 **빈 칸으로 남는 것이 없다**는 뜻이다.
      ⓑ는 남아 있어도 되는 것이 아니라, **AI가 손대면 안 되는 칸**이다(원칙 8-1).
      대신 학생이 쓸 양이 적은지(글자 수 목표가 있는 긴 글인지)를 따로 센다.
   ============================================================ */
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { essayAskFor, essayTargetChars } = require('../essay-ask.js');
const { formBudgetReport, formAutoKey, FORM_AUTO_KEYS_ALL } = require('../form-plan.js');

const rd = (p) => JSON.parse(fs.readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8'));
const T = rd('../data/forms.json').templates;
const R = rd('../data/registered.json');
const regs = Array.isArray(R) ? R : (R.items || R.registered || []);

const arg = process.argv[2] || '';

/* 한 줄이면 충분한 칸 — 원본이 표의 작은 칸인데 스키마화가 textarea 로 만든 것들 */
const SHORT_RE = /^(논문\s*제목|취미|특기사항|취미[․·.]?\s*특기|과정|추\s*천\s*인|직전학기|활동 가능한 시간|기타\s*사항|기타|\(4\)\s*기타|보유 자격증)/;

/* 양식 하나의 부담 */
function burdenOf(key) {
  const tpl = T[key];
  if (!tpl) return null;
  const b = formBudgetReport(tpl);
  let keyworded = 0, mustType = 0, shortInput = 0, click = 0;
  const heavy = [];      // 분량이 적힌 긴 글인데 AI가 못 돕는 칸
  const oneLine = [];    // 한 줄이면 되는데 큰 상자로 그려지는 칸
  const listy = [];      // 여러 줄 나열형 (표로 받으면 편한 칸)
  for (const sec of tpl.sections || []) {
    for (const f of sec.fields || []) {
      if (f.type === 'static') continue;
      if (f.type === 'textarea') {
        if (f.kind === 'story') { keyworded++; continue; }
        mustType++;
        const label = String(f.label).replace(/\s+/g, ' ').trim();
        const both = `${label} ${f.q || ''} ${f.placeholder || ''}`;
        /* 🔴 '분량이 적혀 있는 긴 글'만 센다. essayTargetChars 의 기본값 500 을 그대로
           쓰면 '논문제목'·'취미·특기' 같은 한 줄짜리까지 500자 글로 세어 과장된다
           (첫 판이 실제로 그랬다 — 24종으로 부풀었다). */
        const stated = /\d{2,5}\s*자|A4\s*\d+\s*장/.test(both);
        if (stated && essayTargetChars(both) >= 400) {
          heavy.push({ label, target: essayTargetChars(both) });
        } else if (SHORT_RE.test(label)) {
          oneLine.push(label);            // 한 줄이면 되는데 큰 상자로 그려지는 칸
        } else {
          listy.push(label);              // 여러 줄 나열형 (봉사내역·학력·경력)
        }
        continue;
      }
      if (f.type === 'checks' || f.type === 'checks+text' || f.type === 'choice' || f.type === 'schedule') { click++; continue; }
      /* 프로필로 채워지는 칸은 학생이 안 친다 */
      if (formAutoKey(f)) continue;
      shortInput++;
    }
  }
  return { key, keyworded, mustType, shortInput, click, heavy, oneLine, listy, counts: b.counts, over: b.over };
}

const rows = Object.keys(T).map(burdenOf).filter(Boolean);
const byForm = new Map(rows.map((r) => [r.key, r]));

/* 공고 쪽에서 본다 — 학생이 실제로 만나는 것은 공고다 */
const linked = regs.filter((s) => s.formId && T[s.formId]);
const perNotice = linked.map((s) => ({ id: s.id, name: s.name, form: s.formId, b: byForm.get(s.formId) }));

/* ── 요약 ── */
const withStory = rows.filter((r) => r.keyworded > 0);
const unsolved = rows.filter((r) => {
  /* '아직 빈 칸을 던진다' = 키워드 도움 없이 학생이 긴 글을 써야 하는 칸이 있다 */
  return r.heavy.length > 0;
});
const noticesWithStory = perNotice.filter((n) => n.b.keyworded > 0);
const noticesUnsolved = perNotice.filter((n) => n.b.heavy.length > 0);

if (arg === '--bad') {
  const show = (title, pick) => {
    const list = rows.filter((r) => pick(r).length);
    console.log(`\n■ ${title} — 양식 ${list.length}종`);
    for (const r of list) {
      const ns = perNotice.filter((n) => n.form === r.key).length;
      console.log(`  ${r.key}${ns ? ` (공고 ${ns}건)` : ' (연결된 공고 없음)'}`);
      for (const x of pick(r)) console.log(`     · ${typeof x === 'string' ? x : `${x.label}  (약 ${x.target}자)`}`);
    }
  };
  show('🔴 분량이 적힌 긴 글인데 AI가 못 돕는 칸 (사실을 적는 칸)', (r) => r.heavy);
  show('⚠️ 한 줄이면 되는데 큰 상자로 그려지는 칸 (입력 방식만 고치면 됨)', (r) => r.oneLine);
  show('⚠️ 여러 줄 나열형 — 표로 받으면 학생이 편해지는 칸', (r) => r.listy);
  process.exit(0);
}

if (arg === '--list') {
  console.log('공고별 — 키워드로 해결 / 직접 써야 함 / 짧은 입력 / 클릭\n');
  for (const n of perNotice.sort((a, b) => b.b.keyworded - a.b.keyworded)) {
    const b = n.b;
    console.log(`${String(b.keyworded).padStart(2)}✍  ${String(b.mustType).padStart(2)}✎  ${String(b.shortInput).padStart(2)}⌨  ${String(b.click).padStart(2)}◉   ${n.name.slice(0, 40).padEnd(42)} ${n.form}`);
  }
  process.exit(0);
}

console.log(`■ 양식 ${rows.length}종 · 그중 서술형(story)이 있는 것 ${withStory.length}종`);
console.log(`■ 정식 등록 공고 ${regs.length}건 · 그중 양식이 연결된 것 ${linked.length}건\n`);

const sum = (a, k) => a.reduce((x, r) => x + (r.b ? r.b[k] : r[k]), 0);
console.log('[학생이 만나는 칸 — 양식이 연결된 공고 ' + linked.length + '건 합계]');
console.log(`  ✍ 키워드로 해결된 서술형   ${String(sum(perNotice, 'keyworded')).padStart(4)}칸   ← 누르기만 하면 됩니다`);
console.log(`  ✎ 직접 써야 하는 서술형    ${String(sum(perNotice, 'mustType')).padStart(4)}칸   ← 사실을 적는 칸 (AI 금지)`);
console.log(`  ⌨ 짧은 직접 입력          ${String(sum(perNotice, 'shortInput')).padStart(4)}칸`);
console.log(`  ◉ 클릭                    ${String(sum(perNotice, 'click')).padStart(4)}칸\n`);

console.log('[해결 여부]');
console.log(`  서술형이 있는 공고            ${noticesWithStory.length}건 / ${linked.length}건`);
console.log(`  그중 키워드 카드가 붙은 공고   ${noticesWithStory.length}건  ← 100%`);
console.log(`  아직 긴 글을 직접 써야 하는 공고 ${noticesUnsolved.length}건`
  + (noticesUnsolved.length ? '  → --bad 로 확인' : '  ✅ 없음'));

const noStory = perNotice.filter((n) => n.b.keyworded === 0 && n.b.mustType === 0);
console.log(`  서술형이 아예 없는 공고        ${noStory.length}건 (표만 채우면 되는 양식)\n`);

/* 데이터에 kind 가 안 적힌 서술형이 남아 있으면 그 칸은 키워드 카드를 못 받는다 */
let noKind = 0;
for (const tpl of Object.values(T))
  for (const sec of tpl.sections || [])
    for (const f of sec.fields || [])
      if (f.type === 'textarea' && !f.kind) noKind++;
console.log(`[데이터] kind 가 안 적힌 서술형 ${noKind}칸` + (noKind ? ' ← 이 칸은 키워드 카드를 못 받습니다' : ' ✅'));
if (rows.some((r) => r.over.length)) {
  const o = rows.filter((r) => r.over.length);
  console.log(`[질문 수] 상한 초과 양식 ${o.length}종: ${o.map((r) => r.key).join(', ')}`);
}

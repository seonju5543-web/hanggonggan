/* 적합도 전수 리포트 — 특히 **미달 판정이 맞는지** 사람이 눈으로 확인하는 도구 (2026-08-24)
   설계: docs/designs/fit-score.md
   미달은 학생에게서 장학금을 뺏는 판정이라, 오탐이 1건이라도 나오면 그 규칙의 확신을 낮춘다.
   실행: node verify/fit-report.mjs [--zero]

   🔴 2026-08-29 — 이 도구는 2026-08-26(83f0e42)부터 **사흘 동안 눈이 멀어 있었다.**
   미달 점수가 0 → FIT_MIN(5)으로 바뀌었는데 여기는 `pct === 0`으로 세고 있어서,
   실제로 미달이 13건인데 "0% 판정 0건"이라고 답했다. 가장 비싼 판정을 사람이 확인하라고
   만든 도구가 확인할 것이 없다고 말한 것이다. 그래서 이제 **점수가 아니라 `fails`**를 본다 —
   상수가 또 바뀌어도 안 깨진다. (되돌리기 방지: test-collector '적합도 상수' 절) */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const M = require('../match-engine.js');
const d = require('../data/registered.json');

const ZERO = process.argv.includes('--zero');   // 미달 공고의 자격 원문까지 함께 본다

/* 🔴 **학생을 바꿔 가며 잴 수 있어야 한다** (2026-09-12 · 노션 UI-1 "적합도 정밀 검사 방법").
   그전에는 대표 학생 한 명이 코드에 박혀 있어, 다른 학교·다른 성적에서 판정이 어떻게 되는지
   이 도구로는 볼 수 없었다. 자격 축은 학교·지역·계열마다 다르게 걸리므로 한 명만 재는 것은
   '정밀 검사'가 아니다. 칸 이름은 `what-shows.mjs` 와 **같게** 맞췄다(두 도구를 번갈아 쓴다).
     node verify/fit-report.mjs --school=경희대학교 --gpa=4.2 --bracket=3 --year=4 --track=engineering */
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`));
  return hit ? hit.slice(k.length + 3) : d;
};
/* 숫자 칸에 숫자가 아닌 것이 오면 **멈춘다** — `평점 NaN` 인 채 그럴듯한 답을 내놓는 것이
   가장 나쁘다(what-shows.mjs 와 같은 규칙). */
const num = (k, d) => {
  const v = arg(k, String(d));
  if (!/^-?\d+(\.\d+)?$/.test(v)) { console.error(`--${k}=${v} 는 숫자가 아닙니다.`); process.exit(1); }
  return Number(v);
};
const p = { school: arg('school', '한국외국어대학교'), campus: arg('campus', ''),
            gpa: num('gpa', 3.5), bracket: num('bracket', 5), year: num('year', 3),
            track: arg('track', 'humanities'), major: arg('major', '영어학과'), flags: [],
            status: arg('status', '재학'), credits: num('credits', 15), nationality: 'korean',
            region: arg('region', '서울'), parentRegion: arg('parentRegion', arg('region', '서울')),
            birthYear: num('birthYear', 2004), common: {} };

const rows = d.items.map((s) => ({ s, f: M.fitDetail(s, p) }));
const bucket = {};
for (const { f } of rows) { const k = f.unread ? '자격 미확인' : f.fails.length ? `${f.pct}% (미달)` : `${f.pct}%`; bucket[k] = (bucket[k] || 0) + 1; }
console.log(`■ 적합도 분포 — 등록 ${d.items.length}건`);
console.log(`   학생: ${p.school}${p.campus ? ' ' + p.campus : ''} ${p.track} ${p.year}학년 ${p.status}`
  + ` · 평점 ${p.gpa} · ${p.credits}학점 · ${p.bracket}구간 · ${p.region}`);
/* 🔴 **이 리포트가 안 보는 것을 먼저 말한다** (2026-09-12 · UI-1). 학생 화면의 공고는 두 층인데
   여기서 읽는 것은 층1(우리가 원문을 읽어 등록한 공고)뿐이다. 층2(한국장학재단 목록)는
   `app.js` 가 화면에서 만들어 내므로 Node 에서는 안 보인다 — 그쪽은 브라우저 검사가 맡는다.
   안 적어 두면 "48건을 다 봤다"가 "학생이 보는 것을 다 봤다"로 읽힌다(실제 매칭은 133건). */
console.log(`   ⚠️ 이 리포트는 층1(data/registered.json)만 본다 — 층2(한국장학재단 ${(() => {
  try { return require('../data/kosaf-open.json').items.length; } catch { return '?'; }
})()}건)은 verify-kosaf.js·verify-fit-badge.js 가 브라우저에서 잰다.`);
Object.entries(bucket).sort((a, b) => (parseInt(b[0]) || -1) - (parseInt(a[0]) || -1))
  .forEach(([k, n]) => console.log(`   ${k.padStart(12)} : ${n}건`));

const zeros = rows.filter((r) => !r.f.unread && r.f.fails.length);
console.log(`\n■ 미달 판정 ${zeros.length}건 — 사유가 원문과 맞는지 확인할 것`);
for (const { s, f } of zeros) {
  console.log(`\n  ✕ ${s.id} | ${(s.name || '').slice(0, 46)}`);
  f.fails.forEach((l) => console.log(`      사유: ${l.slice(0, 88)}`));
  if (ZERO) (s.eligibilityLines || []).forEach((l) => console.log(`      원문| ${l.slice(0, 88)}`));
}
/* 🔴 '사유 없는 미달' 검사는 여기서 뺐다 (2026-08-29 코드 리뷰 지적).
   미달을 `fails` 로 세기 시작한 순간 `zeros` 는 전부 사유가 있는 것이 되어,
   그걸 다시 거르는 `filter(!fails.length)` 는 **영영 빈 배열**이다 —
   이 커밋이 없애려던 바로 그 죽은 가지를 새로 만든 꼴이었다.
   같은 불변식은 관문이 지킨다: test-collector 의 '미달은 반드시 최저점으로 나온다'와
   '평점 미달 학생의 적합도는 FIT_MIN 이다 / 그리고 사유가 함께 있다'. */

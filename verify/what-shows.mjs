/* 이 공고가 이 학생 화면에 **실제로 어떻게 보이는가** (2026-08-29 신설)

   🔴 왜 만들었나 — 2026-08-29에 이런 실수를 했다:
      `requirementLines(it, lines)` 를 그냥 불러 5줄이 나온 것을 보고
      **"자격 줄 18건이 화면에 안 뜬다"**고 개발자에게 보고했다. 틀렸다.
      그건 **목록 카드용 5줄 미리보기**였고, 상세 시트는 `{all:true}` 로 전부 보여 주고
      있었다. 코드는 멀쩡했고 검사도 조용했다 — **틀린 것은 내가 잰 방법**이었다.

      이 저장소가 이미 배운 교훈과 같다: **사본을 재면 원본과 갈라진다.**
      그래서 화면에 대한 주장은 그 자리에서 짠 스크립트가 아니라 **이 도구로** 재고 말한다.

   어떻게 보장하나: `app.js`·`match-engine.js` 를 **파일 그대로** vm 에 실어
   앱이 쓰는 바로 그 함수(`fitVerdict`·`requirementLines`)를 부른다. 베낀 규칙이 없다.

   실행:
     node verify/what-shows.mjs 총동문회                 (이름 일부로 찾기)
     node verify/what-shows.mjs reg-hufs-samil --gpa=4.2 --credits=18 --bracket=2
     node verify/what-shows.mjs 면학 --school=한국외국어대학교 --track=humanities
*/
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ME = require('../match-engine.js');
const reg = JSON.parse(fs.readFileSync(new URL('../data/registered.json', import.meta.url), 'utf8'));

const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`));
  return hit ? hit.slice(k.length + 3) : d;
};
const q = process.argv.slice(2).find((a) => !a.startsWith('--'));
if (!q) {
  console.log('쓰는 법: node verify/what-shows.mjs <공고 id 또는 이름 일부> [--gpa=3.2 --credits=14 --bracket=6 --parentRegion=서울 ...]');
  process.exit(1);   // 쓰는 법을 틀린 것은 성공이 아니다 (감싸는 스크립트가 통과로 읽으면 안 된다)
}

/* 숫자 칸에 숫자가 아닌 것이 오면 **멈춘다** — 이 도구의 답은 개발자에게 그대로 인용된다.
   `평점 NaN` 인 채로 그럴듯한 판정을 내놓는 것이 가장 나쁘다. */
const num = (k, d) => {
  const v = arg(k, String(d));
  if (!/^-?\d+(\.\d+)?$/.test(v)) { console.error(`--${k}=${v} 는 숫자가 아닙니다.`); process.exit(1); }
  return Number(v);
};
const p = {
  school: arg('school', '한국외국어대학교'), campus: arg('campus', ''),
  track: arg('track', 'humanities'), major: arg('major', '영어학과'),
  year: num('year', 3), status: arg('status', '재학'),
  gpa: num('gpa', 3.2), bracket: num('bracket', 6),
  credits: num('credits', 14), region: arg('region', '서울'),
  parentRegion: arg('parentRegion', arg('region', '서울')), nationality: 'korean', birthYear: 2004,
  flags: [], common: {},
};

let hits = reg.items.filter((x) => x.id === q || (x.name || '').includes(q));
if (!hits.length) { console.log(`'${q}' 로 찾은 공고가 없습니다.`); process.exit(1); }
/* 넓게 찾으면 수백 줄이 쏟아져 정작 볼 것을 못 본다 — 세어 주고 앞쪽만 보여 준다 */
const CAP = 8;
if (hits.length > CAP) {
  console.log(`'${q}' 로 ${hits.length}건이 걸렸습니다 — 앞 ${CAP}건만 보여 줍니다. 좁혀서 다시 찾으세요.`);
  hits = hits.slice(0, CAP);
}

/* 🔴 앱 규칙을 **한 줄도 베끼지 않는다.** app.js 에서 필요한 함수를 **이름으로 떼어 내**
   그대로 실행한다. 배지 문구도, 신청 버튼 판정도 앱이 쓰는 그 함수가 낸 값이다.

   ⚠️ 첫 판에서는 배지 라벨과 신청 버튼 조건을 손으로 옮겨 적었다가 **8건이 틀렸다**
      (마감 지난 공고를 '신청 버튼 열림'이라고 말했다 — 앱은 `d.days >= 0` 도 본다).
      코드 리뷰가 잡았다. 규칙을 베끼면 갈라진다는 것을, 그걸 막으려고 만든 도구가
      스스로 다시 증명한 셈이다. 그래서 이제 **가져다 쓴다.**

   ⚠️ 두 함수 사이를 잘라 오지 않는다 — 순서가 바뀌거나 사이에 주석 한 줄만 들어가도
      엉뚱한 곳을 자른다(리뷰가 재현했다: 10만 자를 자르거나 0자를 자른다).
      이 파일의 최상위 함수는 열 0의 `function 이름(` 으로 시작해 열 0의 `}` 로 끝난다. */
const appSrc = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
function takeFn(name) {
  const re = new RegExp(`^function ${name}\\([\\s\\S]*?^\\}`, 'm');
  const m = appSrc.match(re);
  if (!m) throw new Error(`app.js 에서 ${name}() 을 못 찾았습니다 — 이름이 바뀌었거나 최상위 함수가 아닙니다. `
    + `이 도구는 앱 규칙을 베끼지 않고 가져다 쓰므로, 못 가져오면 멈춥니다(틀린 답을 내느니 멈춘다).`);
  return m[0];
}
/* 의존 순서대로 — dday 는 todayStart 를, fitBadgeHtml 은 fitTone·fitVerdict 를 쓴다 */
const NEED = ['todayStart', 'dday', 'fitTone', 'fitVerdict', 'fitBadgeHtml'];
const ctx = vm.createContext({ Date, Math, Number, String, JSON, console });
vm.runInContext(NEED.map(takeFn).join('\n\n'), ctx, { filename: 'app.js(발췌)' });
const appFn = (n) => vm.runInContext(n, ctx);
const stripTags = (h) => String(h).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

for (const sch of hits) {
  const result = ME.evaluate(sch, p);
  const fit = ME.fitScore(sch, result, p);
  const fd = ME.fitDetail(sch, p);
  /* 배지는 앱의 fitBadgeHtml 이 낸 그대로 (문구·'확인 필요 N' 까지 같다) */
  const badge = stripTags(appFn('fitBadgeHtml')(fit, fd)) || '(배지 없음)';
  /* 신청 버튼도 앱과 같은 조건 — **마감(d.days >= 0)까지 본다** */
  const d = appFn('dday')(sch.deadline);
  const canApply = ['eligible', 'selective'].includes(result.status) && d.days >= 0;

  const listLines = ME.requirementLines(sch, null);                    // 목록 카드 — 5줄 상한
  const allLines = ME.requirementLines(sch, null, { all: true });      // 상세 시트 — 전부
  const exLines = ME.requirementLines(sch, [...(sch.eligibilityExcludes || []), ...(sch.eligibilityLines || [])], { onlyExclude: true });

  console.log(`\n■ ${sch.name || sch.id}`);
  console.log(`   학생: ${p.school} ${p.track} ${p.year}학년 · 평점 ${p.gpa} · ${p.credits}학점 · ${p.bracket}구간`);
  console.log(`   판정 ${result.status}  ·  배지 「${badge}」`);
  console.log(`   신청 버튼 ${canApply ? '열림' : '잠김'}  (마감: ${d.label || '?'})`);
  console.log(`   ─ 목록 카드에 보이는 자격 줄 (${listLines.length}줄 · 5줄 상한)`);
  for (const l of listLines) console.log(`       · ${String(l).slice(0, 84)}`);
  console.log(`   ─ 상세 시트에 보이는 자격 줄 (${allLines.length}줄 · 전부)`);
  for (const l of allLines) console.log(`       · ${String(l).slice(0, 84)}`);
  if (allLines.length > listLines.length) console.log(`     ⚠️ 목록에는 ${allLines.length - listLines.length}줄이 안 보인다 — 그건 '숨겨진 것'이 아니라 미리보기 상한이다`);
  console.log(`   ─ '이런 경우는 제외돼요' (${exLines.length}줄)`);
  for (const l of exLines) console.log(`       ✗ ${String(l).slice(0, 84)}`);
  const why = (result.reasons || []).filter((r) => /미달|없어|불가/.test(r));
  if (why.length) console.log(`   ─ 미달 사유\n       ${why.map((w) => w.slice(0, 90)).join('\n       ')}`);
}

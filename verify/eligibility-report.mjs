/* ============================================================
   자격 요건 전수 재채점 (2026-08-03 신설)

   왜 만들었나 — 개발자 지적:
     "앞으로 너가 못 쓴 몇십 건의 공고를 다 하나하나 고치라고 할 수는 없잖아."

   그동안 자격이 잘못 나올 때마다 **그 공고 하나를 보고** 규칙을 고쳤다.
   그래서 고칠 때마다 다른 공고가 새로 샜다(해성문화재단 번호 → 동국인재육성 선발인원 →
   교육보호장학 오독…). 한 건씩 보는 한 이 굴레는 끝나지 않는다.

   이 도구는 등록 공고 **전체를 한 번에 채점**한다. 규칙을 고치기 전후로 돌려
   "확보 몇 건 → 몇 건, 의심 줄 몇 건 → 몇 건"을 숫자로 비교하면,
   그 수정이 정말 나아진 것인지 다른 데를 망가뜨린 것인지 바로 보인다.

   실행: node verify/eligibility-report.mjs          (요약)
         node verify/eligibility-report.mjs --list   (미확보 공고 전부 나열)
         node verify/eligibility-report.mjs --bad    (의심 줄 전부 나열)
   ============================================================ */
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { indexTexts, sourceFor, hasText, isCut } from '../collector/notice-source.mjs';

const require = createRequire(import.meta.url);
/* 화면이 실제로 보여 주는 줄로 채점해야 의미가 있다 —
   match-engine이 다듬고 걸러낸 뒤 남는 것이 학생 눈에 보이는 자격이다. */
const { requirementLines } = require('../match-engine.js');

const HERE = new URL('.', import.meta.url);
const reg = JSON.parse(fs.readFileSync(new URL('../data/registered.json', HERE), 'utf8'));
let texts = [];
try { texts = JSON.parse(fs.readFileSync(new URL('../collector/extracted/notices-text.json', HERE), 'utf8')); } catch { /* 없으면 원문 0건 */ }
const idx = indexTexts(texts);

const LIST = process.argv.includes('--list');
const BAD = process.argv.includes('--bad');

/* 원문에 자격 절 제목이 있는가 — 발췌기와 같은 낱말 */
const QUALIFY_HEAD = /(신청\s?자격|지원\s?자격|응모\s?자격|자격\s?요건|지원\s?요건|신청\s?요건|장학생\s?기본\s?자격|장학생\s?자격|선발\s?요건|응모\s?요건|자격\s?기준|지원\s?조건|신청\s?조건|지원\s?대상|신청\s?대상|모집\s?대상|선발\s?대상|추천\s?대상|수혜\s?대상|장학\s?대상|지급\s?대상|선발\s?기준|심사\s?기준)/;

/* 이 줄이 '누가 받을 수 있나'를 말하고 있다는 신호.
   금액·숫자가 섞여 있어도 이 신호가 있으면 진짜 요건이다 —
   예: "재학성적 평균 B학점 이상, 건강보험료 지역 17만원 이하의 해당 학생"(건국 성림)
   이걸 안 두면 채점기가 멀쩡한 요건을 '금액 안내'라고 잘못 잡는다. */
const REQ_SIGNAL = /(재학|휴학|복학|신입|편입|졸업|\d\s?학년|학부생|대학생|성적|평점|학점|분위|수급|차상위|기초생활|한부모|다자녀|자녀|유공|보훈|장애|다문화|북한이탈|거주|출신|이상인?\s?자|이하의?\s?(해당\s?)?학생|해당하는\s?자|자격을\s?갖춘)/;

/* 개발자가 실제로 지적했던 오류 유형들. 자격이 아닌 것이 자격 자리에 앉아 있으면 잡는다.
   [주의] 한글은 정규식 \W에 걸린다 — `^[\d\W]{1,6}$`로 쓰면 '한부모가정'까지 기호로 잡힌다
   (2026-08-03 이 채점기를 처음 돌렸을 때 실제로 그렇게 잘못 잡았다). 그래서 '글자가 하나도
   없는 줄'만 기호로 본다. */
const SUSPECT = [
  ['선발인원이 자격으로', /선발\s?인원|모집\s?인원|배정\s?인원|\d+\s?명\s?(내외|이내|선발)|총\s?\d+\s?명/],
  ['혜택·지급 안내가 자격으로', /^(지원\s?내용|장학\s?내용|혜택|지급\s?(일정|방법|시기|액))|지급\s?(일정|방법|시기)|장학금\s?지급/],
  ['제출서류·문의가 자격으로', /제출\s?서류|구비\s?서류|문의\s?처|담당자|@|\d{2,4}-\d{3,4}-\d{4}/],
  ['신청기간이 자격으로', /신청\s?기간|접수\s?기간|신청\s?기한|제출\s?기한/],
  ['번호·기호만 남은 줄', /^[^가-힣A-Za-z]{1,10}$/],
  ['게시판 메뉴가 섞여 들어옴', /^(목록보기|목록|이전\s?글|다음\s?글|인쇄|공유|첨부파일|바로가기)$/],
  ['절 제목만 남은 줄', /^[□■◆●▶▷○]\s*\S{1,10}$|^(신청|지원|응모|선발|모집|추천)?\s*(자격|대상|요건|기준)\s*[:：]?\s*$/],
  ['첨부 파일 이름', /\.(hwp|hwpx|pdf|docx?|xlsx?|zip)\s*$/i],
  ['너무 긴 줄(문단 통째)', /^.{101,}$/],
  /* 2차 경로(제목 없는 공고에서 줄 단위로 줍기)를 켜고 눈으로 확인해 찾은 유형들.
     채점기가 이걸 못 보면 "커버리지는 늘었는데 실은 쓰레기가 늘었다"를 놓친다. */
  ['브라우저 제목줄이 섞여 들어옴', /\s\|\s/],
  ['부서·기관 이름만 있는 줄', /^.{0,16}(센터|팀|실)$/],
  ['증명서 발급 안내가 자격으로', /증명서\s*\d*\s*부|에서\s?발급/],
];
/* 금액 줄은 요건 신호가 하나도 없을 때만 의심한다 (위 REQ_SIGNAL 설명 참조) */
const MONEY_ONLY = /\d+\s?만\s?원|\d{3,}\s?원|등록금\s?전액/;

const stat = { total: 0, ok: 0, cut: 0, noHead: 0, noText: 0 };
const missing = [];
const suspects = [];

for (const it of reg.items) {
  if (it.program) continue;              // 상시 제도는 공고가 아니다
  stat.total += 1;

  const src = sourceFor(it, idx);
  const shown = requirementLines(it);    // 학생 눈에 실제로 보이는 자격 줄

  if (shown.length) {
    stat.ok += 1;
    for (const line of shown) {
      const hit = SUSPECT.find(([, re]) => re.test(line))
        || (MONEY_ONLY.test(line) && !REQ_SIGNAL.test(line) ? ['금액 안내가 자격으로'] : null);
      if (hit) suspects.push({ id: it.id, why: hit[0], line });
    }
    continue;
  }

  // 못 뽑았다 — 왜인지 원인을 나눈다
  let why;
  if (!hasText(src)) { why = '원문 미확보'; stat.noText += 1; }
  else if (isCut(src)) { why = '원문 잘림'; stat.cut += 1; }
  else if (!QUALIFY_HEAD.test(src.text)) { why = '자격 제목 없음'; stat.noHead += 1; }
  else { why = '제목은 있는데 못 읽음'; stat.noHead += 1; }
  missing.push({ id: it.id, name: it.name, why, url: it.sourceUrl });
}

const pct = (n) => `${((n / stat.total) * 100).toFixed(0)}%`;
console.log(`\n■ 자격 요건 확보 현황 — 등록 공고 ${stat.total}건`);
console.log(`   확보    ${String(stat.ok).padStart(3)}건 (${pct(stat.ok)})`);
console.log(`   미확보  ${String(missing.length).padStart(3)}건 (${pct(missing.length)})`);
console.log(`     ├ 원문이 잘려 자격 절이 날아감   ${String(stat.cut).padStart(3)}건  → 원문을 더 길게 받으면 살아난다`);
console.log(`     ├ 원문에 자격 제목이 없음        ${String(stat.noHead).padStart(3)}건  → 줄글·표 안에 섞여 있다`);
console.log(`     └ 원문 자체가 없음               ${String(stat.noText).padStart(3)}건  → 다시 받아야 한다`);

console.log(`\n■ 품질 — 자격 자리에 엉뚱한 것이 들어간 줄`);
if (!suspects.length) console.log('   없음');
else {
  const byWhy = new Map();
  for (const s of suspects) byWhy.set(s.why, (byWhy.get(s.why) || 0) + 1);
  const ids = new Set(suspects.map((s) => s.id));
  console.log(`   의심 줄 ${suspects.length}개 · 공고 ${ids.size}건`);
  for (const [why, n] of [...byWhy].sort((a, b) => b[1] - a[1])) console.log(`     · ${why}: ${n}개`);
  if (!BAD) console.log('   (--bad 를 붙이면 전부 보여 줍니다)');
}
if (BAD) for (const s of suspects) console.log(`   ✕ ${s.id} [${s.why}] ${s.line.slice(0, 90)}`);

if (LIST) {
  console.log(`\n■ 미확보 ${missing.length}건`);
  for (const m of missing) console.log(`   - ${m.id} [${m.why}] ${m.name.slice(0, 40)}`);
} else if (missing.length) {
  console.log(`\n   (--list 를 붙이면 미확보 ${missing.length}건을 전부 보여 줍니다)`);
}

/* 채점 도구는 실패를 만들지 않는다 — 숫자를 보여 주는 것이 일이고,
   빌드를 막는 것은 audit-data.js의 몫이다(거기서 막으면 수집 로봇이 전부 선다). */
console.log('');

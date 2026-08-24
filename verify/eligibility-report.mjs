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
let browserBodies = {};
try { browserBodies = JSON.parse(fs.readFileSync(new URL('../collector/extracted/browser-bodies.json', HERE), 'utf8')); } catch { /* 아직 없음 */ }
const idx = indexTexts(texts, browserBodies);

const LIST = process.argv.includes('--list');
const BAD = process.argv.includes('--bad');

/* 원문에 자격 절 제목이 있는가 — 발췌기와 같은 낱말 */
const QUALIFY_HEAD = /(신청\s?자격|지원\s?자격|응모\s?자격|자격\s?요건|지원\s?요건|신청\s?요건|장학생\s?기본\s?자격|장학생\s?자격|선발\s?요건|응모\s?요건|자격\s?기준|지원\s?조건|신청\s?조건|지원\s?대상|신청\s?대상|모집\s?대상|선발\s?대상|추천\s?대상|수혜\s?대상|장학\s?대상|지급\s?대상|선발\s?기준|심사\s?기준|응시\s?자격|추천\s?조건|추천\s?자격|대\s?상\s?자\s*[:：]|^\s*\d+\s*[.)]\s*대\s?상\s*[:：])/;

/* 이 줄이 '누가 받을 수 있나'를 말하고 있다는 신호.
   금액·숫자가 섞여 있어도 이 신호가 있으면 진짜 요건이다 —
   예: "재학성적 평균 B학점 이상, 건강보험료 지역 17만원 이하의 해당 학생"(건국 성림)
   이걸 안 두면 채점기가 멀쩡한 요건을 '금액 안내'라고 잘못 잡는다. */
const REQ_SIGNAL = /(재학|휴학|복학|신입|편입|졸업|\d\s?학년|학부생|대학생|성적|평점|학점|분위|수급|차상위|기초생활|한부모|다자녀|자녀|유공|보훈|장애|다문화|북한이탈|거주|출신|이상인?\s?자|이하의?\s?(해당\s?)?학생|해당하는\s?자|자격을\s?갖춘|결격\s?사유|결격사유)/;

/* 개발자가 실제로 지적했던 오류 유형들. 자격이 아닌 것이 자격 자리에 앉아 있으면 잡는다.
   [주의] 한글은 정규식 \W에 걸린다 — `^[\d\W]{1,6}$`로 쓰면 '한부모가정'까지 기호로 잡힌다
   (2026-08-03 이 채점기를 처음 돌렸을 때 실제로 그렇게 잘못 잡았다). 그래서 '글자가 하나도
   없는 줄'만 기호로 본다. */
const SUSPECT = [
  ['선발인원이 자격으로', /선발\s?인원|모집\s?인원|배정\s?인원|\d+\s?명\s?(내외|이내|선발)|총\s?\d+\s?명/],
  ['혜택·지급 안내가 자격으로', /^(지원\s?내용|장학\s?내용|혜택|지급\s?(일정|방법|시기|액))|지급\s?(일정|방법|시기)|장학금\s?지급/],
  ['제출서류·문의가 자격으로', /제출\s?서류|구비\s?서류|문의\s?처|담당자|@|\d{2,4}-\d{3,4}-\d{4}/],
  /* '신청기간 내 …구간 미산출시 지원불가'처럼 **기간을 조건으로 쓰는** 진짜 요건이 있다.
     날짜가 함께 있을 때만 안내로 본다 — 안 그러면 영원한 오탐이 되어 리포트를 못 믿게 된다. */
  ['신청기간이 자격으로', /(신청\s?기간|접수\s?기간|신청\s?기한|제출\s?기한)[^가-힣]{0,6}[:：]?\s*\d/],
  ['번호·기호만 남은 줄', /^[^가-힣A-Za-z]{1,10}$/],
  ['게시판 메뉴가 섞여 들어옴', /^(목록보기|목록|이전\s?글|다음\s?글|인쇄|공유|첨부파일|바로가기)$/],
  ['절 제목만 남은 줄', /^[□■◆●▶▷○]\s*\S{1,10}$|^(신청|지원|응모|선발|모집|추천)?\s*(자격|대상|요건|기준)\s*[:：]?\s*$/],
  ['첨부 파일 이름', /\.(hwp|hwpx|pdf|docx?|xlsx?|zip)\s*$/i],
  /* 2026-08-20: 화면이 **잘린 줄을 이어 붙이게** 되면서 진짜 요건도 길어질 수 있다
     (이화 국가근로의 제외 대상 목록이 그렇다 — 예전엔 잘려 있었다).
     그래서 문턱을 화면 규칙(requirementLines의 160자)과 맞춘다. 여기만 낮으면
     **고쳐 놓은 것을 망가뜨린 것처럼 보여** 엉뚱한 되돌리기를 부른다. */
  ['너무 긴 줄(문단 통째)', /^.{161,}$/],
  /* 2차 경로(제목 없는 공고에서 줄 단위로 줍기)를 켜고 눈으로 확인해 찾은 유형들.
     채점기가 이걸 못 보면 "커버리지는 늘었는데 실은 쓰레기가 늘었다"를 놓친다. */
  ['브라우저 제목줄이 섞여 들어옴', /\s\|\s/],
  ['부서·기관 이름만 있는 줄', /^.{0,16}(센터|팀|실)$/],
  ['증명서 발급 안내가 자격으로', /증명서\s*\d*\s*부|에서\s?발급/],
  /* 🔴 2026-08-21 — 여기가 "없음"이라고 하는 동안 화면에는 잡음이 계속 있었다.
     개발자가 목포향우회·사랑나눔에서 세 번 짚어 준 뒤에야 알았다.
     원인: 채점기가 **필터가 아는 유형만** 알고 있었다 — 필터의 눈으로 필터를 채점한 셈이라
     새 유형을 영영 못 본다. 그래서 아래는 **필터가 안 보는 축**으로 잡는다:
     "이 줄이 조건을 말하는가"가 아니라 **"이 줄이 제목·목록·표처럼 생겼는가"**.
     정밀하지 않아도 된다 — 여기 걸린 것을 사람이 보고 판단하면 되고, 그게 목적이다. */
  ['제목·이름표로 끝나는 줄', /^.{0,14}(기준|조건|요건|대상|자격|구분|내역|사항|유형|항목|사유|서류|방법)\s*(\([^)]*\))?\s*[:：]?$/],
  ['꺾쇠·대괄호로 감싼 제목', /^[<\[［【].{2,30}[>\]］】]$/],
  ['다음 줄을 가리키기만 하는 연결 문장', /^(아래|다음|위|상기)[^.]{0,20}(모두\s*)?(충족|해당|같|참고|기재)[^.]{0,8}$/],
  ['서류·자료 이름', /(자료|요강|사본|서류|양식|증명서|확인서|동의서|신청서)\s*(\([^)]*\))?\s*$/],
  /* 인원이 뒤에 붙었을 뿐 진짜 요건인 줄이 있다(`관악구 거주 대학 재학생(0명)`) —
     요건 낱말이 함께 있으면 의심하지 않는다. 리포트는 **0으로 읽혀야** 새 잡음이 눈에 띈다. */
  ['인원 안내', /^(?!.*(거주|재학|학년|이상|이하|구간|성적|전공|수급|출신)).{0,14}[\s(（]\s*\d+\s?(명|팀)\s*[)）]?\s*$/],
  ['주소·연락처', /^\[\d{5}\]|\d+번?길\s*\d|\d{2,3}-\d{3,4}-\d{4}/],
  ['일정·기간 안내', /추후\s?(개별\s?)?안내|^\s*\d{1,2}\.\d{1,2}\.?\s*\([월화수목금토일]\)\s*\d{1,2}시/],
  ['우선선발·우대 (자격이 아니라 순위)', /우선\s?선발\s*[).\]]*\s*$|우선\s?선발\s?기준/],
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
      /* 🔴 요건 신호가 있는 줄은 '지급·혜택' 낱말이 섞여 있어도 진짜 요건이다 (2026-08-20).
         홍익대 교내봉사장학의 `홍익대 서울캠퍼스 재학생 중 교내 장학금 지급에 결격사유가 없는 자`가
         '장학금 지급'만 보고 '지급 안내'로 잡혔다 — 멀쩡한 자격을 불량으로 세면 채점기가
         고친 것을 망가뜨린 것처럼 보여 **엉뚱한 되돌리기를 부른다.** 금액 규칙이 쓰던
         완화를 이 규칙에도 똑같이 준다. */
      const hit = SUSPECT.find(([why, re]) => re.test(line)
          && !(why === '혜택·지급 안내가 자격으로' && REQ_SIGNAL.test(line)))
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

/* ── 🔴 세 번째 축 — **줄이 맞는 칸에 있는가** (2026-08-24 신설) ──
   개발자가 앱을 눈으로 보고 여섯 가지를 짚어 줬는데 이 채점기는 '잡음 0'을 답하고 있었다.
   이유가 분명하다: 위 두 축은 줄의 **생김새**만 본다(제목처럼 생겼나 · 요건 낱말이 있나).
   그런데 지적된 여섯 개는 전부 **자리**가 틀린 것이었다 — 제외 조건이 지원 자격에,
   선발 기준이 지원 자격에, 같은 줄이 두 칸에, 긍정 자격이 제외 칸에.
   생김새는 멀쩡하니 두 축 모두 통과했다. 그래서 축을 하나 더 둔다.

   ⚠️ 여기서는 화면 필터의 절 판정(section-head)을 **쓰지 않는다** — 필터의 눈으로
   필터를 채점하면 새 유형을 영영 못 본다(이 저장소가 이미 두 번 겪은 실패다).
   대신 **칸끼리 대조한다**: 세 칸에 같은 줄이 있나, 자격 칸의 줄이 못 받는 조건을
   말하나, 제외 칸의 줄이 받을 조건을 말하나. 필터가 어떻게 판정했든 결과만 본다. */
const M = require("../match-engine.js");
const misplaced = [];
{
  const EX_TAIL = /(지원|신청|참여|참가|지급|수혜)\s*불가\s*$|제외\s*$|제외됩니다\s*$/;
  const POS_TAIL = /해당하지\s*않는\s*자|아닌\s*자\s*$|없는\s*자\s*$/;
  const bare = (t) => t.replace(/\s*[(（][^)）]*[)）]\s*$/, '').trim();
  for (const it of reg.items) {
    const lines = it.eligibilityLines || [];
    if (!lines.length) continue;
    const req = M.requirementLines(it, lines) || [];
    const exl = M.requirementLines(it, [...(it.eligibilityExcludes || []), ...lines],
      { onlyExclude: true }) || [];
    const pri = M.requirementLines(it, lines, { keepPriority: true, onlyPriority: true }) || [];
    const add = (why, line) => misplaced.push({ id: it.id, why, line });
    const R = new Set(req);
    for (const l of exl) if (R.has(l)) add('같은 줄이 자격·제외 두 칸에', l);
    for (const l of pri) if (R.has(l)) add('같은 줄이 자격·선발 두 칸에', l);
    for (const l of req) {
      const b = bare(l);
      if (EX_TAIL.test(b.length >= 4 ? b : l)) add('못 받는 조건이 지원 자격 칸에', l);
    }
    for (const l of exl) if (POS_TAIL.test(l)) add('받을 수 있는 조건이 제외 칸에', l);
    /* 자격은 한 줄도 못 읽었는데 선발·제외는 읽었다 → 절을 잘못 갈랐을 가능성이 높다 */
    if (!req.length && (pri.length || exl.length)) add('자격 칸만 비어 있다 (절 가르기 의심)', `선발 ${pri.length}줄 · 제외 ${exl.length}줄`);
  }
}
console.log(`\n■ 줄이 맞는 칸에 있는가 (2026-08-24 — 자리 축)`);
if (!misplaced.length) console.log('   없음');
else {
  const byWhy = new Map();
  for (const s of misplaced) byWhy.set(s.why, (byWhy.get(s.why) || 0) + 1);
  console.log(`   자리가 틀린 줄 ${misplaced.length}개 · 공고 ${new Set(misplaced.map((s) => s.id)).size}건`);
  for (const [why, n] of [...byWhy].sort((a, b) => b[1] - a[1])) console.log(`     · ${why}: ${n}개`);
}
if (BAD) for (const s of misplaced) console.log(`   ✕ ${s.id} [${s.why}] ${s.line.slice(0, 90)}`);

/* 🔴 참고 목록 — **필터도 채점기도 이름을 모르는 새 잡음**을 찾는 자리 (2026-08-21 신설).
   위 '의심 줄'은 이름을 아는 유형만 잡는다. 그래서 새 유형이 생기면 0으로 보이고,
   개발자가 앱을 눈으로 볼 때까지 아무도 모른다 — 목포향우회·사랑나눔이 그렇게 세 번 지적됐다.
   여기서는 **완전히 다른 축**으로 본다: 요건 줄은 거의 언제나 '학생의 무엇'을 말하므로,
   그 낱말이 **하나도 없는 줄**을 전부 올린다. 정밀하지 않다(진짜 요건도 섞인다) —
   1분 안에 훑을 분량으로 유지하는 것이 목적이고, 이상한 것이 있으면 여기 먼저 보인다.
   ⚠️ 이 목록을 '오류'로 만들지 말 것. 로봇을 막으면 멀쩡한 공고 저장이 멈춘다. */
const REQ_WORD = /(재학|휴학|복학|졸업|신입|편입|학년|학기|학점|평점|평량|성적|점\s?이상|소득|분위|구간|수급|차상위|보훈|유공|장애|다자녀|한부모|다문화|새터민|북한이탈|거주|국적|전공|학과|계열|이수|수료|자격증|합격|재직|연령|만\s?\d+\s?세|학생|학부생|대학생|자녀|가정|본인|제외|불가|가능|충족|한함)/;
const noSignal = [];
for (const it of reg.items) {
  if (it.program) continue;
  for (const line of requirementLines(it)) if (!REQ_WORD.test(line)) noSignal.push({ id: it.id, line });
}
console.log(`\n■ 참고 — 요건 낱말이 하나도 없는 줄 (새 잡음이 여기 먼저 보인다)`);
console.log(`   ${noSignal.length}줄 / 화면에 나가는 ${reg.items.reduce((n, i) => n + (i.program ? 0 : requirementLines(i).length), 0)}줄`);
if (BAD) for (const s of noSignal) console.log(`   ? ${s.id} ${s.line.slice(0, 90)}`);
else console.log('   (--bad 를 붙이면 전부 보여 줍니다 — 이상한 줄이 보이면 필터에 규칙을 더합니다)');

/* ── 자격 자리에 들어간 '자격이 아닌 줄'을 **유형별로** 센다 (2026-08-23 개발자 지시) ──
   개발자가 **네 번째로** 같은 것을 지적했다: "동국인재육성장학에 마일리지 산정기간이,
   동산장학회에 추천기한·제외가 지원 자격으로 들어가 있다."
   앞선 세 번은 그때그때 잡음을 이름 대서 필터에 추가했고, 그래서 새 유형이 나오면
   개발자가 앱을 눈으로 볼 때까지 아무도 몰랐다. 이번엔 **세는 자리를 만든다.**

   🔴 필터(match-engine의 REQ_NOISE)가 쓰는 낱말을 그대로 쓰면 안 된다 —
   필터의 눈으로 필터를 채점하는 꼴이라 필터가 놓친 것은 영영 0으로 나온다.
   그래서 '문장이 무엇을 말하는가'라는 **다른 축**으로 가른다. */
const { NOISE_KIND, FRAGMENT, MISPLACED } = require('./eligibility-noise.cjs');
{
  const hits = [];
  let shown = 0;
  for (const it of reg.items) {
    if (it.program) continue;
    for (const l of requirementLines(it)) {
      shown += 1;
      for (const [k, re] of [...Object.entries(NOISE_KIND), ['잘린 조각', (t) => FRAGMENT.test(t)]]) {
        if (!re(l)) continue;
        /* 요건 신호가 뚜렷한 줄은 '자리가 틀린 것'(제외)과 '망가진 것'(조각)만 문제 삼는다 —
           그 밖의 유형은 낱말 하나로 진짜 요건을 잡음이라 부르게 된다(위 주석). */
        if (REQ_SIGNAL.test(l) && !MISPLACED.test(k)) continue;
        hits.push({ id: it.id, kind: k, line: l, ai: /^AI/.test(it.eligibilityFrom || '') });
        break;
      }
    }
  }
  const cards = new Set(hits.map((h) => h.id)).size;
  console.log(`\n■ 자격이 아닌 줄이 자격 자리에 (유형별 — 필터와 다른 축으로 잰다)`);
  console.log(`   ${hits.length}줄 / 화면에 나가는 ${shown}줄 · 카드 ${cards}건`);
  const tally = {};
  for (const h of hits) tally[h.kind] = (tally[h.kind] || 0) + 1;
  for (const [k, v] of Object.entries(tally).sort((a, b) => b[1] - a[1])) console.log(`      ${String(v).padStart(3)}줄  ${k}`);
  /* 어느 경로가 넣었는지 함께 센다 — 규칙이 뽑은 것과 AI가 읽은 것의 품질 차이가 여기 드러난다 */
  const byAi = hits.filter((h) => h.ai).length;
  console.log(`   경로별: 발췌기(규칙) ${hits.length - byAi}줄 · AI ${byAi}줄`);
  if (BAD) for (const h of hits) console.log(`   ! [${h.kind.split(' ')[0]}] ${h.id} ${h.line.slice(0, 80)}`);
  else console.log('   (--bad 를 붙이면 전부 보여 줍니다)');
}

if (LIST) {
  console.log(`\n■ 미확보 ${missing.length}건`);
  for (const m of missing) console.log(`   - ${m.id} [${m.why}] ${m.name.slice(0, 40)}`);
} else if (missing.length) {
  console.log(`\n   (--list 를 붙이면 미확보 ${missing.length}건을 전부 보여 줍니다)`);
}

/* 채점 도구는 실패를 만들지 않는다 — 숫자를 보여 주는 것이 일이고,
   빌드를 막는 것은 audit-data.js의 몫이다(거기서 막으면 수집 로봇이 전부 선다). */
console.log('');

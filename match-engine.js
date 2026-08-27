/* ============================================================
   한대장 — 공유 매칭 엔진
   앱 화면(app.js)과 서비스워커(sw.js, 백그라운드 알림)가 **같은 규칙**을 쓰도록
   자격 판정을 이 파일 한 곳에 둔다. 규칙이 바뀌면 화면과 알림이 동시에 바뀐다.
   (소급 적용 원칙 — 엔진이 두 벌이면 알림만 옛 기준으로 남는 사고가 난다)
   ============================================================ */

/* 절 경계 판정 — section-head.js 한 곳에서만 정한다(브라우저는 전역, Node는 require).
   베끼면 화면·발췌기·감사가 서로 다른 경계를 쓰게 된다 — 그게 이 문제가 재발한 이유다. */
const SH = (typeof module !== 'undefined' && module.exports)
  ? require('./section-head.js')
  : { sectionOf, headRest, isQualifyHead, isExcludeHead, isSelectHead };

/* 요건 파서도 같은 방식으로 — 브라우저는 전역, Node는 require.
   ⚠️ `window.parseLine`으로 찾으면 안 된다(서비스워커에는 window가 없다).
      전역 이름을 그대로 쓰면 <script>·importScripts 양쪽에서 잡힌다. */
const PR = (typeof module !== 'undefined' && module.exports)
  ? require('./parse-requirements.js')
  /* 🔴 브라우저에서는 **전역 함수**로 쓴다 — 여기에 이름을 빠뜨리면 Node 검사는 전부
     통과하는데 앱은 첫 카드에서 죽는다. `headRest`(section-head)에 이어 `caseBranch`도
     같은 실수를 했다(2026-08-24). 아래 회귀가 브라우저 순서로 실어 실제로 불러 본다. */
  : { parseLine, gradOnly, caseBranch, GRADE_SCALE, HIGH, LOW, MULTI_PROGRAM };
const PR2 = PR;   // requirementLines가 쓰는 별칭 (선언 순서 때문에 이름만 따로 둔다)

/* 자격 진단 — 프로필과 공고의 요건을 대조해 상태·사유·부족정보를 돌려준다 */
function evaluate(sch, p) {
  const e = sch.eligibility || {};
  const reasons = [];
  const missing = [];
  let ok = true;

  const flags = (p && p.flags) || [];
  const gpaExempt = p.status === 'freshman';

  if (e.minGpa != null && !gpaExempt) {
    if (p.gpa == null) missing.push('직전학기 평점');
    else if (p.gpa < e.minGpa) { ok = false; reasons.push(`평점 ${e.minGpa} 이상 필요 (현재 ${p.gpa})`); }
    else reasons.push(`성적 요건 충족 (${e.minGpa} 이상)`);
  }

  if (e.maxBracket != null) {
    if (p.bracket == null) missing.push('학자금 지원구간');
    else if (p.bracket > e.maxBracket) { ok = false; reasons.push(`지원구간 ${e.maxBracket}구간 이내 필요 (현재 ${p.bracket}구간)`); }
    else reasons.push(`소득 요건 충족 (${e.maxBracket}구간 이내)`);
  }

  if (e.years && !e.years.includes(p.year)) {
    ok = false; reasons.push(`${e.years.join('·')}학년만 지원 가능`);
  }

  if (e.freshmanOnly && p.status !== 'freshman') {
    ok = false; reasons.push('신입학 첫 학기 학생만 지원 가능');
  }

  if (e.tracks && !e.tracks.includes(p.track)) {
    ok = false; reasons.push('지원 대상 전공 계열이 아니에요');
  } else if (e.tracks) {
    reasons.push('전공 계열 요건 충족');
  }

  if (e.flagsAny) {
    /* 어떤 자격으로 충족됐는지 괄호로 밝힌다 (2026-08-02 개발자 요청) —
       '특별자격 요건 충족'만으로는 무엇 때문에 통과했는지 알 수 없다.
       라벨은 data.js의 FLAG_LABELS를 쓰되, 서비스워커에는 그 파일이 없으므로 없으면 키를 쓴다. */
    const matched = e.flagsAny.filter((f) => flags.includes(f));
    if (!matched.length) { ok = false; reasons.push('해당 특별자격(수급자·다자녀·보훈 등)이 필요해요'); }
    else {
      const L = (typeof FLAG_LABELS !== 'undefined' && FLAG_LABELS) || {};
      reasons.push(`특별자격 요건 충족 (${matched.map((f) => L[f] || f).join(', ')})`);
    }
  }

  if (e.seoulOnly) {
    if (p.region !== 'seoul') { ok = false; reasons.push('서울 거주자만 지원 가능'); }
    else reasons.push('거주지 요건 충족 (서울)');
  }

  if (e.needCert) {
    if (!p.cert) { ok = false; reasons.push('공인 외국어성적 보유가 필요해요'); }
    else reasons.push('외국어성적 보유 확인');
  }

  if (e.exchange) {
    if (!p.exchange) { ok = false; reasons.push('교환학생 파견 예정자만 지원 가능'); }
    else reasons.push('교환학생 요건 충족');
  }

  if (e.schoolOnly) {
    if (p.school !== e.schoolOnly) { ok = false; reasons.push(`${e.schoolOnly} 재학생만 지원 가능`); }
    else reasons.push(`재학 대학 공고 (${e.schoolOnly})`);
  }

  /* 🔴 이중수혜 (2026-08-27 개발자 지적으로 신설).
     공고 원문 66건에 `타 재단 장학금 중복수혜 불가` 같은 조항이 있는데, 그동안 학생이
     보는 자리에는 **0건** 노출이었다. 이 조항은 자격 절에도 제외 절에도 안 살고
     신청기간·장학금액·제출서류 절에 흩어져 있어서, 절 단위로 자격을 읽는 구조가
     통째로 버리고 있었다. 결과는 이 저장소가 가장 싫어하는 실패다 — 이미 다른
     장학금을 받는 학생이 서류를 다 준비하고 지원했다가 탈락한다.

     ⚠️ 모르면 판정하지 않는다. `scholarships` 가 null(=아직 안 물어봄)이면 missing 으로
        두고, 없다고 단정하지 않는다. 이 앱의 '모른다고 말할 자유' 규칙 그대로다. */
  const ex = sch.exclusivity;
  /* 🔴 scope 가 'external' 인 것만 판정에 쓴다. `복지장학 2는 복지장학 1과 중복 불가`
     같은 **교내끼리의 배타**를 외부 재단 장학금 보유자에게 적용하면 멀쩡한 학생이 떨어진다.
     원문이 대외·교외·타 재단이라고 못박은 것만 자격으로 본다. */
  if (ex && ex.kind === 'forbidden' && ex.scope === 'external') {
    const held = p && p.scholarships;
    if (!Array.isArray(held)) missing.push('지금 받고 있는 장학금');
    else if (held.includes('external')) {
      ok = false;
      reasons.push('이미 받고 있는 외부 재단 장학금이 있어 지원할 수 없어요');
    } else reasons.push('중복 수혜 조건 충족 (외부 재단 장학금 없음)');
  }

  if (!ok) return { status: 'ineligible', reasons, missing };
  if (missing.length) return { status: 'unknown', reasons, missing };
  if (e.selective) return { status: 'selective', reasons, missing };
  return { status: 'eligible', reasons, missing };
}

/* 적합도 점수 (0~99) — 정렬용 */
/* ══════════════════════════════════════════════════════════════════════════
   적합도 — 자격 요건 기반 (2026-08-24 전면 재설계 · docs/designs/fit-score.md)

   왜 바꿨나: 예전 점수는 `62 - 8 + 3`에서 거의 안 움직여, 한 학생에게 보이는 27건이
   **57%와 54% 두 값**뿐이었다. 정렬이 사실상 무작위였고 학생이 보는 퍼센트는
   근거가 없는데 정밀해 보였다 — 개발자가 지적한 피로감의 진짜 원인이다.

   지금 방식: **화면에 나가는 자격 줄을 세어, 학생이 충족한 비율**을 낸다.
     · 못 읽은 요건은 **분모에만** 들어간다(= 감점 — 개발자 결정)
     · 확신 있는 미달이 하나라도 있으면 **0%**
     · 요건을 하나도 못 읽은 공고는 **35%** + '자격 미확인'
   ══════════════════════════════════════════════════════════════════════════ */
const FIT_UNREAD = 35;   // 자격을 하나도 못 읽은 공고 (실측 53건) — 읽어낸 공고보다 낮게 깐다
const FIT_FLOOR = 15;    // 요건은 읽었으나 하나도 충족을 확인 못 한 경우. 미달 확정과 구분한다
/* 🔴 **100%도 0%도 쓰지 않는다** (2026-08-24 개발자 지시: "아무리 적합해도 혹시 모르니까").
   근거가 있는 조심이다 — 자격이 첨부 HWP 안에만 있거나, 발췌기가 절을 통째로 놓쳤거나,
   원문에 안 적힌 조건이 있을 수 있다. 앱은 **자기가 읽은 것**만 알지 공고의 전부를 알지 못한다.
   100은 '완벽히 맞는다', 0은 '절대 안 된다'는 뜻이라 앱이 낼 수 있는 말이 아니다.
   대신 뜻은 배지가 전한다 — 미달은 '지원 자격 미달' 빨강, 확인 필요는 개수로.
   숫자는 순서를 정하는 일만 한다. */
const FIT_MAX = 95;      // 다 맞아도 95 — 못 읽은 요건이 있을 수 있다
const FIT_MIN = 5;       // 미달이어도 5 — 파싱이 틀렸을 수 있다 (0이면 학생이 아예 안 본다)

/* 파싱된 조건 하나를 학생과 맞춰 본다 → 'pass' | 'fail' | 'unknown'
   🔴 **모르면 unknown**이다. 틀린 fail은 학생에게서 장학금을 뺏는다. */
function judgeCond(c, p) {
  const S = PR.GRADE_SCALE;
  switch (c.kind) {
    case 'grade': {
      if (p.gpa == null) return 'unknown';
      /* 🔴 단위가 다르면 **떨어뜨리지 않는다**(설계 조건 ⑥). 백분위 70을 평점 70으로 읽으면
         거의 모든 학생이 0%가 된다. 넉넉히 넘을 때만 통과로 보고, 미달 판정은 안 낸다. */
      if (c.scale === S.gpa45) return p.gpa >= c.min ? 'pass' : 'fail';
      if (c.scale === S.gpa43) return (p.gpa / 4.5 * 4.3) >= c.min ? 'pass' : 'fail';
      if (c.scale === S.percent) {
        const pct = p.gpa / 4.5 * 100;
        return pct >= c.min + 10 ? 'pass' : 'unknown';   // 환산표가 학교마다 달라 미달은 안 낸다
      }
      return 'unknown';                                   // B학점 등 — 환산 불가
    }
    case 'bracket':
      if (p.bracket == null) return 'unknown';
      return p.bracket <= c.max ? 'pass' : 'fail';
    case 'credits':
      if (p.credits == null) return 'unknown';
      if (c.min != null) return p.credits >= c.min ? 'pass' : 'fail';
      return 'unknown';
    case 'year': {
      const y = p.year == null ? null : Number(p.year);
      if (y == null || Number.isNaN(y)) return 'unknown';
      if (c.min != null) return y >= c.min ? 'pass' : 'fail';
      if (c.max != null) return y <= c.max ? 'pass' : 'fail';
      if (c.eq != null) return y === c.eq ? 'pass' : 'unknown';   // `2학년 학생`은 딱 그 학년인지 애매
      return 'unknown';
    }
    case 'status': {
      if (!p.status) return 'unknown';
      if (c.not) return c.not.includes(p.status) ? 'fail' : 'pass';
      if (!c.anyOf) return 'unknown';
      if (c.anyOf.includes(p.status)) return 'pass';
      /* 🔴 학적상태는 **평평한 이름표가 아니라 포함 관계**다 (2026-08-24 개발자 지적):
         *"재학 = 신입생 첫 학기 똑같잖아. 신입생도 재학생인데."*
         `국내 대학교 재학생`이 신입생에게 아무 표시도 안 뜨고 있었다.
           · 신입학·초과학기·졸업유예 → 다 재학생이다
           · 단 `정규학기 재학생`(실측 14줄)은 초과학기·졸업유예를 뺀 말이라 제외한다
           · 복학예정은 공고가 `재학생 및 복학예정자`로 **직접 적을 때만** 인정한다
             (그냥 `재학생`이면 지금은 휴학 중이라 단정할 수 없다 — 모르면 판정하지 않는다)
         `휴학`은 재학생이 아니므로 미달이다 — 이게 헛걸음을 막는 자리다. */
      if (c.anyOf.includes('재학')) {
        const asEnrolled = c.regularOnly ? ['신입학'] : ['신입학', '초과학기', '졸업유예'];
        if (asEnrolled.includes(p.status)) return 'pass';
        if (['휴학', '수료', '졸업', '자퇴'].includes(p.status)) return 'fail';
      }
      return 'unknown';   // 그 밖에는 단정하지 않는다
    }
    case 'flags': {
      const f = p.flags || [];
      if (!f.length) return 'unknown';                    // 안 고른 것과 해당 없는 것은 다르다
      return c.anyOf.some((k) => f.includes(k)) ? 'pass' : 'unknown';
    }
    case 'nationality':
      if (!p.nationality) return 'unknown';
      /* 🔴 제외 줄에서는 **같을 때만** 미달이다 — `외국인 유학생 선발 불가`는
         한국 학생에게 아무 문제가 없다. 예전엔 '다르면 미달'로 읽어 내국인이 0%가 됐다
         (2026-08-24 0% 전수 확인에서 오탐 3건). */
      if (c.exclude) return p.nationality === c.eq ? 'fail' : 'pass';
      return p.nationality === c.eq ? 'pass' : 'fail';
    case 'age': {
      if (!p.birthYear) return 'unknown';
      const age = new Date().getFullYear() - Number(p.birthYear);
      return age <= c.max ? 'pass' : 'fail';
    }
    case 'residence': {
      const mine = [p.region, p.parentRegion].filter(Boolean);
      if (!mine.length) return 'unknown';
      return c.anyOf.some((r) => mine.some((x) => x.includes(r) || r.includes(x))) ? 'pass' : 'unknown';
    }
    default: return 'unknown';
  }
}

/* 🔴 줄 하나의 판정 — **퍼센트와 화면의 ✓/✗가 반드시 같은 함수를 써야 한다** (2026-08-24).
   개발자 지적: *"적합도가 100%인데 지원 자격에 ✕가 쳐져 있고 아예 체크가 안 된 것도 있다."*
   원인은 판정이 두 벌이었기 때문이다 — 퍼센트는 parse-requirements로, 화면의 ✓/✗는
   옛 `requirementMatch`(정규식 한 벌 더)로 각각 계산했다. 그 옛 함수는 심지어
   `p.status === 'enrolled'`처럼 **오늘 바뀐 옛 학적상태 값**을 보고 있었다.
   이 저장소가 되풀이해 겪은 '규칙 두 벌' 사고와 같은 계열이라, 아예 하나로 합친다.

   반환: 'ok'(충족) | 'no'(미달) | null(판정 불가 — 화면에 아무 표시도 안 한다)
   ⚠️ **'no'는 확신이 높을 때만** 낸다. ✕는 0%와 같은 무게의 판정이다. */
function lineVerdict(text, p, isExclude, ctx) {
  if (!p) return null;
  if (PR.gradOnly(text)) return null;          // 대학원 전용 줄 — 학부생과 무관
  /* 🔴 경우별 분기(`신입생:` `재학생:` `복학생 및 편입생:`)는 **내 경우만** 판정한다
     (2026-08-24 개발자 지적). 안 그러면 재학생인데 `신입생:` 줄에도 ✓가 붙는다.
     프로필에 없는 경우(편입생·학년제)는 해당 여부를 모르므로 아무 표시도 안 한다. */
  const cases = PR.caseBranch(text);
  if (cases && !(p.status && cases.includes(p.status))) return null;
  /* 🔴 아래 둘은 **미달이라고 말하면 안 되는 자리**다 (2026-08-24 전수 대조에서 발견).
     퍼센트는 이미 맞게 처리하고 있었는데 화면 표시만 ✕가 떠서 서로 어긋났다. */
  if (ctx && ctx.multi) return null;                        // 장학금이 여럿 묶인 공고
  if (ctx && ctx.inAnyOf && ctx.inAnyOf.has(text)) {        // 선택지 묶음의 한 갈래
    const { conds: cs } = PR.parseLine(text, !!isExclude);
    for (const c of cs) if (judgeCond(c, p) === 'pass') return 'ok';
    return null;                                            // 떨어져도 ✕는 안 친다
  }
  const { conds } = PR.parseLine(text, !!isExclude);
  let seen = null;
  for (const c of conds) {
    /* 지급액 구간표는 요건이 아니다 — 공고를 통째로 봐야 알 수 있어 맥락으로 받는다
       (한 공고에 `4분위 이하`·`5~6분위`가 함께 있으면 표다). 이걸 모르면
       퍼센트는 멀쩡한데 화면에만 ✕가 뜬다(2026-08-24 개발자 지적). */
    if (ctx && ctx.bracketTable && c.kind === 'bracket') continue;
    const v = judgeCond(c, p);
    if (v === 'fail' && c.conf === PR.HIGH) return 'no';
    if (v === 'pass') seen = 'ok';
  }
  return seen;
}

/* 공고 단위로만 알 수 있는 것 — 줄 하나만 봐서는 판단할 수 없다. 퍼센트와 ✓/✗가
   **같은 맥락**을 봐야 갈라지지 않는다. */
function noticeCtx(sch) {
  const lines = (sch && sch.eligibilityLines) || [];
  const items = requirementLines(sch, lines, { withMeta: true });
  const brackets = new Set();
  /* 선택지 묶음에 든 줄 — **여기서 하나 떨어지는 건 정상**이다(하나만 만족하면 되므로).
     ✕를 치면 학생이 "안 되는구나" 하고 접는다. 퍼센트는 맞는데 표시만 틀렸던 자리다. */
  const inAnyOf = new Set();
  for (const it of items) {
    if (it.group > 0) inAnyOf.add(it.text);
    for (const c of PR.parseLine(it.text, false).conds) if (c.kind === 'bracket') brackets.add(c.max);
  }
  /* 여러 장학금이 묶인 공고 — 하나에 미달해도 다른 것에 지원한다(설계 조건 ⑧) */
  const multi = items.some((it) => PR.MULTI_PROGRAM.test(it.text));
  return { bracketTable: brackets.size > 1, inAnyOf, multi };
}

/* 공고 하나에 대한 적합도 **내역**. 카드가 "요건 6개 중 4개 충족"을 띄우려면 숫자가 필요하다. */
function fitDetail(sch, p) {
  const parseLine = PR.parseLine;
  const lines = (sch && sch.eligibilityLines) || [];
  /* 🔴 대학원 전용 줄은 **분모에서도 뺀다** — 건너뛰기만 하면 학부생에게 무관한 줄이
     '확인 필요'로 남아 점수를 깎는다(가톨릭대 동문장학금이 50%로 떨어졌다). */
  /* 🔴 **화면 5줄 상한을 점수에 적용하면 안 된다** (2026-08-24 개발자 지적으로 발견).
     화면은 5줄만 보여 주는데 점수도 그 5줄만 세고 있었다. 그래서 삼일장학회(중앙대)는
     요건이 **9개**인데 5개만 맞으면 '요건 5개 중 5개 충족 · 100%'가 떴다 —
     확인조차 안 한 요건 4개가 점수에서 통째로 빠진 것이다(실측 15건 · 23줄).
     점수는 `all: true`로 **전부** 세고, 화면에 몇 줄을 띄우는지는 따로 정한다. */
  const items = requirementLines(sch, lines, { withMeta: true, all: true }).filter((it) => !PR.gradOnly(it.text));
  if (!items.length) return { pct: FIT_UNREAD, unread: true, met: 0, total: 0, unknown: 0, fails: [] };

  const exLines = requirementLines(sch, [...((sch && sch.eligibilityExcludes) || []), ...lines], { onlyExclude: true });
  /* 여러 장학금이 묶인 공고는 0%를 내지 않는다(설계 조건 ⑧) — 하나에 미달해도 다른 것에 지원한다 */
  const multi = items.some((it) => PR.MULTI_PROGRAM.test(it.text));

  const ctx = noticeCtx(sch);

  const fails = [];
  let met = 0, unknown = 0;
  const groups = new Map();          // 선택지 묶음 → 그 안에서 하나라도 충족했나
  for (const it of items) {
    const lv = lineVerdict(it.text, p, false, ctx);
    const verdict = lv === 'no' ? 'fail' : lv === 'ok' ? 'pass' : 'unknown';
    if (it.group > 0) {
      const g = groups.get(it.group) || { any: false };
      if (verdict === 'pass') g.any = true;
      groups.set(it.group, g);
      continue;
    }
    if (verdict === 'pass') met += 1;
    else if (verdict === 'fail' && !multi) fails.push(it.text);
    else unknown += 1;
  }
  /* 선택지 묶음은 통째로 요건 1개로 센다 — 하나만 만족하면 충족이다(설계 조건 ⑤) */
  for (const [, g] of groups) { if (g.any) met += 1; else unknown += 1; }

  /* 제외 조항에 걸리면 미달과 같다 */
  for (const line of exLines) {
    const { conds } = parseLine(line, true);
    for (const c of conds) {
      if (c.conf !== PR.HIGH) continue;
      if (ctx.bracketTable && c.kind === 'bracket') continue;
      if (judgeCond(c, p) === 'fail' && !multi) fails.push(line);
    }
  }

  const total = items.filter((it) => it.group === 0).length + groups.size;
  /* 미달이어도 0이 아니라 FIT_MIN — 파싱이 틀렸을 가능성을 남긴다(위 FIT_MIN 주석) */
  if (fails.length) return { pct: FIT_MIN, unread: false, met, total, unknown, fails };
  const pct = total ? Math.round((met / total) * 100) : FIT_UNREAD;
  return { pct: Math.min(FIT_MAX, Math.max(FIT_FLOOR, pct)), unread: false, met, total, unknown, fails: [] };
}

function fitScore(sch, result, p) {
  /* 구조화된 자격(eligibility)으로 이미 미달이 확정된 공고는 그대로 0 */
  if (result.status === 'ineligible') return 0;
  return fitDetail(sch, p).pct;
}

/* 마감일을 확정하지 못한 공고(원문에 마감이 없거나 못 읽은 경우)는 dday가 '기한 원문 확인'이라
   목록에서 영영 사라지지 않는다 — 지난 학기 공고가 계속 떠 있는 문제가 있었다(2026-07-30 발견).
   그래서 등록일(listedAt)로부터 60일이 지나면 숨긴다. 실시간 공고의 60일 규칙과 같은 기준이다.
   마감이 있는 공고는 기존대로 '마감 + 30일' 규칙만 적용된다.
   **알림도 이 함수를 쓴다** — 화면에서 숨긴 공고를 알림으로 알리면 사용자는 눌러도 찾을 수 없다. */
const STALE_DAYS = 60;
function notStale(sch, now) {
  if (!sch || sch.deadline || !sch.listedAt) return true;
  const listed = new Date(sch.listedAt + 'T00:00:00');
  if (Number.isNaN(listed.getTime())) return true;
  const t = new Date(now || Date.now());
  const startOfToday = new Date(t.getFullYear(), t.getMonth(), t.getDate());
  return Math.round((startOfToday - listed) / 86400000) <= STALE_DAYS;
}

/* 학교·캠퍼스 한정 공고 걸러내기 — 다른 학교 공고가 목록·알림에 섞이지 않게 */
function scopedToProfile(list, p) {
  if (!p) return [];
  return (list || []).filter((s) => {
    const e = s.eligibility || {};
    if (e.schoolOnly && e.schoolOnly !== p.school) return false;
    if (e.campusOnly && p.campus && e.campusOnly !== p.campus) return false;
    return true;
  });
}

/* ---------------- 실시간 공고가 이 학생 것인가 ----------------
   화면(app.js)과 알림(notify-rules.js)이 **같은 함수**를 쓴다. 갈라지면 화면에 없는 공고를
   알림으로 알리게 된다(match-engine을 만든 이유와 같다). data.js는 서비스워커가 안 읽으므로
   분교 관련 판정은 반드시 여기 있어야 한다. */

/* 본교와 게시판을 함께 쓰는 분교 → 본교.
   연세 미래·고려 세종·동국 WISE·상명 천안은 자기 게시판이 따로 있어 여기 없다
   (그쪽은 공고의 school 이름이 이미 분교다). */
const SHARED_BOARD_BRANCH = {
  '한양대학교 ERICA캠퍼스': '한양대학교',
  '건국대학교 글로컬캠퍼스': '건국대학교',
  '홍익대학교 세종캠퍼스': '홍익대학교',
};

/* 제목 앞 [표시]로 캠퍼스를 가르는 게시판 — 한양대가 실제로 [서울]·[ERICA]를 붙인다.
   건국([교외]·[교내]·[국가])·홍익([단과대]·[재단명])의 대괄호는 캠퍼스가 아니라 분류라 넣지 않는다. */
const TITLE_CAMPUS = {
  '한양대학교': [
    [/^\s*[\[(]\s*서울\s*[\])]/, '한양대학교'],
    [/^\s*[\[(]\s*(ERICA|에리카)\s*[\])]/i, '한양대학교 ERICA캠퍼스'],
  ],
};

/* 제목이 캠퍼스를 밝혔으면 그 학교, 아니면 null */
function taggedSchool(n) {
  for (const [re, school] of TITLE_CAMPUS[n && n.school] || []) if (re.test(n.title || '')) return school;
  return null;
}

function noticeForProfile(n, p) {
  if (!p || !p.school || !n) return false;
  const tagged = taggedSchool(n);
  const school = tagged || n.school;
  if (school === p.school) return !(n.campus && p.campus && n.campus !== p.campus);
  // 공용 게시판의 공고 — 제목이 캠퍼스를 밝히지 않은 것만 분교 학생에게도 보여 준다
  if (!tagged && !n.campus && SHARED_BOARD_BRANCH[p.school] === school) return true;
  return false;
}

/* ---------------- 공고의 자격 요건을 짧게 정리하고 프로필과 대조 ----------------
   원문을 통째로 붙이면 ※ 부연설명까지 섞여 지저분하다(2026-08-02 개발자 지적).
   여기서는 **요건 줄만 골라 다듬어** '1) 4년제 대학생 2) 한부모 가정'처럼 짧게 만든다.
   다듬기는 표기 정리일 뿐 내용을 지어내지 않는다 — 원문에 없는 요건은 절대 만들지 않는다. */

/* 요건이 아니라 부연·안내·다른 항목인 줄 (버린다).
   자격 블록 안에는 선발인원·금액·수여식 같은 줄이 섞여 들어오는데, 이것들이 자리를 차지하면
   정작 중요한 요건이 뒤로 밀려 잘린다(2026-08-02 유흥수 장학금 사례). */
/* ── '이 줄이 지원 자격인가'를 묻는 단 하나의 잣대 (2026-08-23 개발자 지시로 신설) ──

   개발자가 **네 번째로** 같은 것을 지적했다: 마일리지 산정기간·추천기한 같은 것이
   지원 자격으로 뜬다. 그리고 이렇게 물었다 — **"왜 자꾸 재발하는거지?"**

   원인은 셋인데 셋 다 구조였다:
     ① 막는 방식이 **열거형**이었다. 잡음을 이름 대서 버리는 목록(REQ_NOISE)이라,
        게시판·재단마다 새 표현이 나오면 그때마다 목록이 한 칸 모자란다. 끝이 없다.
     ② 통과 조건이 **덩어리 단위**였다. "이 공고의 자격 줄 중 하나라도 요건 신호가
        있으면 통과"라서, 좋은 줄 다섯에 잡음 한 줄이 얹혀 같이 나갔다.
     ③ **아무도 세지 않았다.** 잡음을 발견하는 일이 개발자 눈에 맡겨져 있었다.

   그래서 이번엔 **통과 조건을 뒤집는다.** 버릴 것을 열거하는 대신,
   **줄마다 '요건임'을 증명해야 화면에 나간다.** 증명하지 못하면 안 보여 준다 —
   이 저장소의 '모른다고 말하는 것이 틀리게 말하는 것보다 낫다'와 같은 방향이다.

   🔴 이 잣대는 **여기 한 곳에만** 둔다. 예전엔 collector/eligibility-ai.mjs 와
   verify/eligibility-report.mjs 에 같은 정규식이 복사돼 있었고, 정작 화면으로 나가는
   문인 이 파일에는 없었다 — 그래서 앱이 무엇을 내보내는지 아무도 검사하지 않았다. */
/* '누구는 신청할 수 있다' 꼴 — REQ_SIGNAL 과 ※ 곁말 관문이 **같은 것**을 본다.
   두 곳에 따로 적으면 한쪽만 고쳐져 갈라진다(이 저장소가 반복해 겪은 실패). */
const AFFIRM_ELIG = /(자|학생|생)[는은도만이가]?\s?[^.]{0,25}(신청|지원|참여|응모|수혜|선발)\s?(이|가)?\s?(가능|할\s?수\s?있)/;

const REQ_SIGNAL = new RegExp([
  /* ① 자격을 이루는 낱말 — 학적·성적·소득·특별자격·지역 */
  '재학|휴학|복학|신입|편입|졸업|\\d\\s?학년|학부생|대학생|대학원생',
  '성적|평점|학점|분위|구간|소득|수급|차상위|기초생활',
  '한부모|다자녀|자녀|유공|보훈|장애|다문화|북한이탈|새터민',
  '거주|주소를?\\s?두|출신|국적|미혼|기혼|만\\s?\\d+\\s?세',
  /* ② 한국어 공고가 '누가 받는가'를 쓰는 **일반형**. ①만으로는 좁아서
        `전남 목포 소재 고등 및 중등 과정을 마친 자`·`수여식에 참석할 수 있는 학생`처럼
        낱말이 안 걸리는 진짜 요건이 잘려 나갔다(회귀가 잡았다).
        이 꼴은 거의 언제나 '자격이 있는 사람'을 가리킨다. */
  '(자|학생|사람|대상자)\\s*[)）]?\\s*$',          // …인 자 / …한 학생 (으로 끝난다)
  '수\\s?있는\\s?(자|학생|사람)',                    // …할 수 있는 학생
  '(마친|가진|이수한|합격한|해당하는|갖춘)\\s?자',
  '이상인?\\s?자|이하의?\\s?(해당\\s?)?학생',
  '결격\\s?사유|결격사유|합격자|재직|파견|추천\\s?(가능|대상)자?|이수(한|자)',
  /* ③ '누구는 신청할 수 있다' 꼴 — 한국어 공고가 **예외 자격**을 쓰는 대표 형식이다.
        ②까지로는 증명이 안 돼 실제로 21줄이 화면에서 사라져 있었다(2026-08-27 전수):
          `10학기 이하 후기 이중전공자는 등록금 전액 납부 시 신청 가능`   ← 면학장학금
          `정규학기 내 재학생만 지원 가능 (건축학과 등 예외 인정)`        ← 사랑나눔
          `학제 5~6년인 전공에 한하여 … 재학 중인 학생 지원 가능`        ← 인재림
        이 줄들은 **본문 규칙을 뒤집는 예외**라, 빠지면 자격이 되는 학생이 안 된다고 본다.
        (잡음보다 나쁜 실패 — 사랑나눔에서 기초생활수급자 요건이 잘렸던 것과 같은 계열)
     🔴 넓히지 말 것. `포털을 통해 신청가능`(신청 방법)·`8월 20일부터 신청 가능`(일정)이
        같이 들어오면 개발자가 네 번 지적한 그 잡음이 되살아난다. 그래서 두 겹으로 좁혔다:
          ⓐ **사람을 가리키는 낱말**이 앞에 있어야 하고 (자·학생·생)
          ⓑ 그 사이에 **마침표가 없어야** 한다(다른 문장으로 건너뛰지 않는다). */
  AFFIRM_ELIG.source,
].join('|'));

/* 자격이 **아닌 것**이 스스로 드러내는 표지 — 이름을 대는 게 아니라 '무엇을 말하는 줄인가'를 본다.
   ①의 열거형 목록(REQ_NOISE)과 달리 여기 있는 것은 **부류**라서 새 공고가 와도 같이 걸린다. */
const NOT_A_REQUIREMENT = new RegExp([
  '(기한|기간)\\s*[:：]',                                   // 추천기한 : 2026년 10월 2일
  '우편\\s*도착분',
  /* 🔴 `만점` 뒤에 문턱 낱말이 오면 그건 배점표가 아니라 **진짜 요건**이다 (2026-08-24).
     `직전학기 성적기준: 80점/100점 만점 이상을 충족하는 자`가 이 가지에 걸려
     시립대 활동도우미의 성적 요건이 통째로 사라져 있었다 — 잡음보다 나쁜 실패다. */
  '(만점(?!\\s*(이상|이하|미만|초과|충족))|배점|가점|점수\\s*적용|반영\\s*비율)',
  /* 배점표의 한 행 — `학자금 지원구간 (40 점): …에 따라 평정`. 요건 낱말(구간)을 갖고 있어
     통과 조건을 뚫는다. 괄호 안 점수 + '평정'이 배점표의 표지다 (2026-08-24) */
  '\\(\\s*\\d{1,3}\\s*점\\s*\\)|따라\\s*평정|평정\\s*(기준|결과)',
  '산정\\s*(기간|방법|기준)\\s*$',                          // 마일리지 산정기간
  '평가\\s*(항목|비율)',
].join('|'));

/* 제외 대상은 **버리지 않고 자리를 옮긴다** — 정보는 맞고 자리가 틀린 것뿐이다.
   자격 줄에 섞이면 요건이 실제보다 훨씬 까다로워 보여 지원할 수 있는 학생이 포기한다
   (2026-08-21 목포향우회 우선선발과 같은 계열). 앱에 '이런 경우는 제외돼요' 블록이 이미 있다. */
/* 🔴 `참여 불가`·`참가 불가`가 빠져 있어서 `휴학생 참여 불가`가 지원 자격 자리에 앉아 있었다
   (2026-08-24 개발자 지적 — 대청교 멘토). 제외를 말하는 낱말은 여기 한 곳에 모은다. */
const EXCLUDE_LINE = /(제외(한다|합니다|됨|대상)?\s*$|받은\s*(학생|자)는?\s*제외|불가\s*$|불가능\s*$|불가자|(지원|신청|참여|참가|수혜|선발|근로)\s*불가|신청할\s*수\s*없|선발에서\s*제외|대상에서\s*제외)/;
/* 🔴 '제외'가 붙었다고 다 제외가 아니다 — **면제·산정 규칙**은 오히려 학생에게 유리하다
   (2026-08-24 전수 조사). `신/편입생은 입학 학기에만 학점 및 성적 기준 적용 제외`가
   '이런 경우는 제외돼요'에 떠서, 혜택을 불이익으로 보여 주고 있었다.
   `계절, 교류, 인정학점 제외`도 사람을 빼는 말이 아니라 학점 세는 규칙이다. */
/* 🔴 줄의 **주장**은 끝에 있다 (2026-08-27). `국가장학금을 신청할 수 없는 대한민국 국적
   미소지자도 선발 가능` 은 '신청할 수 없는'만 보면 제외로 읽히지만, 이 줄이 실제로
   말하는 것은 **선발 가능**이다. 앞의 '없는'은 대상을 꾸미는 말일 뿐이다.
   제외 칸에 넣으면 외국 국적 학생이 자기가 안 된다고 읽는다 — 자격이 뒤집혀 보인다. */
const ENDS_AFFIRM = /(가능|있음|인\s?자|한다)\s*[.]?\s*$/;
const NOT_AN_EXCLUSION = /(기준\s*)?적용\s*제외|미적용|산정.{0,6}제외|학점\s*제외|계절.{0,10}제외|제외한\s|제외하고|을\s*제외한|를\s*제외한/;
/* 제외 절에 있어도 **긍정으로 적힌 줄은 자격**이다 (2026-08-24 개발자 지적).
   `결격사유에 해당하지 않는 자`는 지원 자격이고, `결격사유에 해당하면` 제외다. */
const POSITIVE_REQ = /해당하지\s*않는\s*자|아닌\s*자\s*$|없는\s*자\s*$/;
/* 뽑는 **행위**를 말하는 줄 — 학생의 상태가 아니라 심사자가 하는 일이다.
   '선발기준' 절에서 이런 줄만 '먼저 뽑는 기준'으로 옮긴다(아래 주석 참조). */
const SELECT_VERB = /평가하여|평가하고|종합\s*평가|종합적으로|심사하여|선발한다|선발함|선발하되|가산점|우대|고려하여|우수자/;

const REQ_NOISE = new RegExp([
  '^(※|상세내역|참고|유의|비고|문의|첨부|붙임)',
  '미신청시|확대 적용|바랍니다|참고하시기|공고문을 확인|일괄 진행|제출필요 없음|담당자|안내드립니다',
  // 선발 인원 : 1명 — 줄 앞뿐 아니라 **중간에 있어도** 인원 안내다
  // ('도우미 장학생 선발인원 : 최대 16명'이 자격 자리에 앉아 있었다, 2026-08-20)
  '^(추천|선발|모집)\\s?인원|(추천|선발|모집)\\s?인원\\s*[:：]',
  '^금\\s*액|^장학\\s*금액|^지원\\s*금액|^지급\\s*액',   // 금 액 : 250만원
  '^(수여식|시상식|일정|장소|기간)\\s*[:：]',
  // '가./나./다.'로 시작한다고 버리면 안 된다 — 그건 자격 절 안의 **진짜 요건 줄**이기도 하다
  // (면학장학금: "가. 2026-2학기 등록자…"). 접두어는 tidyRequirement가 이미 떼고,
  // "나. 장학생 선발" 같은 제목 줄은 아래 '이름표만 남은 제목' 규칙이 잡는다.
  '^(선발\\s?기준|선발\\s?방법|장학생\\s?선발)\\s*$',
  // 이름표만 남은 제목 줄 ("선발 대상", "지원자격" 등) — 내용이 없으면 요건이 아니다.
  // "및 …" 꼬리까지 봐야 한다 — 가톨릭대 동문장학금의 "2. 신청 자격 및 선발인원"이
  // 이 규칙을 비켜 가 **제목 한 줄이 요건 자리에 앉아 있었다** (2026-08-20).
  // 이름표만 남은 제목 줄. 앞에 수식어가 붙거나(`장학생 기본 자격`) 괄호 부연이 달려도
  // (`지원 자격 (가.~사. 모두 충족)` `신청대상(다음 조건을 모두 충족하여야 함)`) 내용은 없다.
  '^(장학생|공통|기본|아래|다음)?\\s*(장학생|공통|기본)?\\s*(신청|지원|응모|선발|모집|추천|장학)?\\s*(자격|대상|요건|기준)\\s*(요건|기준)?\\s*(및\\s*[^:：]{1,12})?\\s*(\\([^)]*\\))?\\s*[:：]?\\s*$',
  '^서류\\s?접수|^제출\\s?서류',                    // 서류 안내
  // 제출서류가 자격 자리에 앉는다 — 중앙대 교내장학금은 **자격 5줄이 전부 서류 이름**이었다
  // (`가족관계증명서` `중앙나래장학금 신청서`…). 자격이 없는데 **있는 척** 보이는 것이라 가장 나쁘다.
  // 줄이 서류 이름으로 **끝날 때만** 버린다 — '증명서 제출 가능한 자'처럼 요건인 문장은 살린다.
  '(증명서|확인서|증빙\\s?서류|서류\\s?사본|신청서|동의서)\\s*(\\([^)]*\\))?\\s*$',
  // 행사 안내 — 조각만 버린다. '수여식 참석 가능한 자'는 진짜 요건이라 살린다
  '^(장학증서\\s?)?(수여식|시상식)\\s*$|^일\\s?시\\s*[:：]|^장\\s?소\\s*[:：]|미\\s?참석.{0,12}(취소|제외)',
  '^시\\s?간\\s*(및\\s*장소)?\\s*[:：]|(수여식|시상식).{0,14}(변경|취소)될',   // 행사 진행 안내
  '확인\\s?경로\\s*[:：]|홈페이지\\s*\\(?[a-z0-9.-]+\\.(kr|com|net)',        // 어디서 확인하나 — 안내
  // 배점표 — '학업성적(50) + 취창업준비계획(20) + …'
  '\\(\\d{1,3}\\)\\s*\\+.*\\(\\d{1,3}\\)',
  // 분류 머리표 — '국가유공자 관련 장학금' '새터민(교육보호대상자) 관련 장학금'
  '관련\\s?장학금\\s*$',
  '^학자금\\s?지원\\s?구간\\s*$',              // 이름표만 남은 칸
  '\\.(hwp|hwpx|pdf|docx?|xlsx?|zip|png|jpg)$',    // 첨부 파일 이름이 섞여 들어온 것
  '신청\\s?(일정|안내)\\s*$',                       // "…국가장학금 1차 신청 안내"
  '지급\\s*$|근무 기준 월|원 지급',                  // 금액·지급 안내
].join('|'));

/* 🔴 '우선선발'은 자격이 **아니지만 버릴 것도 아니다** — 자격을 갖춘 사람 중 누구를
   먼저 뽑나이고, 학생에게 쓸모가 있다(2026-08-21 개발자 지적).
   그래서 **자격 블록에서는 걸러내고, '먼저 뽑는 기준' 블록에서 따로 보여 준다**
   (제외 대상을 따로 두는 것과 같은 방식). 섞어 놓으면 요건이 실제보다 훨씬 까다로워
   보여서 지원할 수 있는 학생이 스스로 포기한다 — 목포향우회가 그랬다.
   ⚠️ 판정(✓/✗)은 하지 않는다. 충족해도 '된다'는 뜻이 아니라 '먼저 본다'는 뜻이라
   초록 체크를 달면 거짓 안심이 된다(제외 대상과 같은 규칙). */
/* 🔴 '우선선발'이라고 **써 있는 줄만** 잡으면 안 된다 (2026-08-24 개발자 지적 — 앱 열자마자 3건).
   공고는 순위 기준을 그 낱말 없이 쓴다: `학년이 높은 학생` `누적 평균 평점이 높은 학생`
   `학자금지원구간이 낮은 학생` `소득순위 순으로 선발` `성적상위자 우선 고려`.
   이 줄들은 **요건 낱말(학년·성적·구간·소득)을 갖고 있어서** 통과 조건도 채점기도 뚫었다.
   가르는 것은 낱말이 아니라 **말투**다 — 요건은 선(`3.0 이상`)을 긋고, 순위는 **비교**(`높은`)를 한다.
   비교형은 충족 여부를 물을 수 없으므로 자격이 아니다. 버리지 않고 '먼저 뽑는 기준'으로 옮긴다.

   ⚠️ 줄 **끝**에만 걸면 안 된다 — 처음에 그렇게 적었더니 채점기가 곧바로 셋을 더 찾아냈다:
   `…평점평균이 높은 학생 우선` `…우수한 학생(타 장학금 미수혜 학생)` `…높은 학생을 순차적으로 선발`.
   비교 표현은 문장 어디에나 온다. */
const RANK_LINE = new RegExp([
  '(높은|낮은|우수한|많은|좋은)\\s*(순|순서)?\\s*(학생|자|사람|가정|순)',
  '순으로\\s*(선발|선정|지급|배정)|순차적으로\\s*선발',
  '상위자|고득점자|성적순|점수순',
  '우선\\s?(선발|고려|검토|배정|선정|순위|함|한다|시)|우선\\s*[).\\]]*\\s*$',
  '우대\\s*[).\\]]*\\s*$',
].join('|'));

/* 🔴 같은 줄에 **진짜 커트라인**이 있으면 자격에 남긴다 — `평점 3.0 이상인 성적 우수한 학생`을
   통째로 순위 블록에 보내면 3.0이라는 선이 사라진다. 순위를 걷어내려다 자격을 잃는 쪽이 더 나쁘다. */
const HARD_THRESHOLD = /\d\s*(\.\d+)?\s*(점|학점|분위|구간|세|명)?\s*(이상|이하|미만|초과|이내)/;
const PRIORITY_LINE = new RegExp(`우선\\s?선발\\s?기준|우선\\s?순위\\s*[:：]|${RANK_LINE.source}`);

/* 🔴 제출서류가 **수량을 달고** 온다 — `학자금 지원구간 확인서 1 부` `주민등록등본 각 1통`.
   서류 규칙(REQ_NOISE)이 '서류 이름으로 끝날 때만' 버리게 돼 있어 `1 부` 꼬리에 그대로 뚫렸다.
   수량으로 끝나는 줄은 세는 물건, 곧 제출물이다(`재학생 2명`은 '명'이라 여기 안 걸린다). */
const DOC_COUNT_TAIL = /\d+\s*(부|통|매|장)\s*(\([^)]*\))?\s*$/;

/* 🔴 절 제목을 버리고 나면 **자식 줄이 혼자 남아** 무슨 절에 속했는지 아무도 모른다 —
   그래서 서류 목록·자기소개 항목이 "학생으로 끝나는 문장"으로만 보인다(위 세 건의 공통 뿌리).
   제목을 읽고 **그 뒤를 통째로** 자격 아님으로 본다. 다시 자격 제목이 나오면 되돌아온다. */
const NON_ELIG_SECTION = /^(필수|공통|추가|기타|구비|첨부|제출)?\s*(제출|구비|첨부)?\s*서류\s*[:：]?\s*$|^자기소개서?\s*[:：]?\s*$/;
const ELIG_SECTION = /(신청|지원|응모|선발|모집|추천)?\s*(자격|대상|요건)\s*[:：]?\s*$/;

function tidyRequirement(line) {
  return String(line || '')
    // 앞머리 기호 — ■ □ ▣ ▷ ★ 를 빠뜨리면 '■ 자격요건' 같은 절 제목이 요건인 척 남는다
    // (2026-08-03 전수 재채점에서 세종대·서울과기대 사례로 발견)
    .replace(/^[\s\-–—•▪▶▷◆◇○●■□▣★♦⇒‡◦∙❍◎￭·ㆍ*◌◍]+/, '')
    // 앞머리 번호 — "3 )" "1." "가." "①" 모두
    .replace(/^\(?\s*\d+\s*[).]|^[①-⑳]|^[가-힣]\s*[.)]\s/, '')
    // "지원자격 : 내용" 처럼 이름표가 앞에 붙은 경우 이름표만 뗀다 (내용은 살린다)
    /* "지원자격 : 내용" 처럼 이름표가 앞에 붙은 경우 이름표만 뗀다 (내용은 살린다).
       바깥 제목이 이미 '지원 자격'이라 **줄마다 또 말하면 같은 말이 두 번** 나온다
       (목포향우회의 `장학생 신청 조건 : 전남 목포…` — 2026-08-21 개발자 지적).
       수식어(장학생·공통…)와 '조건'까지 봐야 그 줄이 걸린다. */
    /* 이름표는 자간을 벌려 쓰기도 한다(`대 상 자 :`) — 공백을 접어 보고 뗀다.
       바깥 제목이 이미 '지원 자격'이라 줄마다 또 말하면 같은 말이 두 번 나온다. */
    .replace(/^\s*(장학생|장학금|공통|기본)?\s*(신청|지원|응모|선발|모집|추천|장학)?\s*(자격|대상|요건|기준|조건)\s*[:：]\s*/, '')
    .replace(/^\s*((?:[가-힣]\s?){2,5})\s*[:：]\s*(?=\S)/, (mm, lab) =>
      /^(대상자|성적기준|지원요건|신청요건|자격기준|선발기준|지원자격|신청자격|대상)$/.test(lab.replace(/\s+/g, '')) ? '' : mm)
    .replace(/^[\s.)\]]+/, '')
    .replace(/\s*★\s*/g, '')
    .replace(/\s+/g, ' ')
    // 수집 과정에서 벌어진 한글/숫자 사이 공백 되붙이기 ("1 유형"→"1유형", "9 분위"→"9분위")
    .replace(/(\d)\s+(유형|분위|구간|학년|학기|학점|명|년|개월)/g, '$1$2')
    .replace(/\s+([,.)%】」』])/g, '$1')
    .replace(/([(【「『])\s+/g, '$1')
    .replace(/([“‘])\s+/g, '$1').replace(/\s+([”’])/g, '$1')   // 따옴표 안쪽 공백
    .replace(/([”’])\s*(로|으로|이|가|는|은|을|를)\b/g, '$1 $2')
    /* 🔴 줄 전체가 괄호로 싸인 부연은 괄호·별표를 벗겨 사람 문장처럼 보여 준다 (2026-08-24).
       동산장학회의 `(*공대, 자연대, 농대 우대)`가 기호를 단 채 화면에 그대로 떠 있었다
       (개발자 지적 — "사람같이 하기로 했는데 괄호랑 별 모양 기호 쓰여있음"). */
    .replace(/^[(（]\s*[*※]\s*([^)）]+?)\s*[)）]$/, '$1')
    .replace(/^[*※]\s*/, '')
    .trim();
}

/* lines를 따로 넘기면 그 줄들을 정리한다 — 자격 줄이 없어 원문 발췌로 물러날 때도
   같은 정리를 거치게 하기 위해서다(안 그러면 그 경로로만 ※ 부연이 새어 나온다). */
/* 뒷줄로 이어지는 줄 — 여기서 끊으면 **문장이 잘린 채** 화면에 나간다.
   실제로 이렇게 떠 있었다: `소득분위가 “기초생활수급자” 또는` (뒤가 없다),
   `2026-2학기 정규학기 학부 재학생 및 복학예정자 중`.
   🔴 버리면 안 된다 — 그 줄에 진짜 요건이 들어 있다. **다음 줄과 이어 붙인다.** */
const CONTINUES = /(또는|및|이고|이며|하여|중)\s*$|\s인\s*$|[,·+]\s*$/;

/* 자격이 아닌 것이 확실한 줄만 걷어낸다.
   ⚠️ '조건 낱말이 없으면 버린다'는 식의 일괄 규칙을 쓰지 말 것 — 2026-08-20에 세어 보니
   그렇게 버려지는 105줄 안에 `2026-1학기 종단추천장학 기수혜자`,
   `대한불교조계종 교육원의 장학추천 가능자`, `직전학기 평균성적이 0점인 경우 지원 불가`
   같은 **진짜 요건**이 섞여 있었다. 확실한 것만 이름을 대서 버린다. */
const NOT_REQ_LINE = [
  '^\\(.{1,14}\\)$',                       // (1 종) · (계속장학생) · (신규자) — 구분 머리표
  '^\\d+\\s?종$',
  '^합격일\\s?후|지급\\s?기간',              // 언제까지 주나 — 혜택이지 자격이 아니다
  '^총점\\s|\\(\\d+\\s?%\\)\\s*$|^배점',      // 배점표 — '비교과프로그램참여 (30%)'처럼 뒤에 붙는다
  '참고$|참고하시기|확인\\s?바랍|인정하지\\s?않음|첨부파일\\s*\\d*\\s*\\]?$',   // 참조·부연
].join('|');
const NOT_REQ_RE = new RegExp(NOT_REQ_LINE);

/* 표의 칸 하나가 통째로 줄이 된 것 — `국가고시` `모집부문` `재학여부` 같은 머리글이다.
   띄어쓰기가 없고 짧으며 서술로 끝나지 않는다.
   🔴 다만 **자격 범주 이름은 지킨다** — `북한이탈주민` `국적-몽골` 같은 것은 그 자체가 요건이다
   (전수로 세어 보니 16개 중 2개가 그랬다. 뭉뚱그려 버리면 진짜 자격이 사라진다). */
const BARE_CELL = /^\S{1,10}$/;   // 6자였을 때 `학자금지원구간`(7자)이 새어 나왔다

/* 🔴 하위 절 제목 — `1) 학업 성적 기준` `2) 경제적 기준` 처럼 **이름표로 끝나고 내용이 없는** 짧은 줄.
   번호를 떼면 이름표만 남는다. 2026-08-21 개발자 지적(사랑나눔): "'학업 성적 기준' 같은
   '요건'이 아닌 놈들이 쓰여 있다."
   ⚠️ 길이로 가른다 — `복학생인 경우, 휴학 직전학기 성적 기준`은 조건이 붙어 있어 진짜 요건이다.
   ⚠️ 자격 범주 이름(수급자·보훈 대상 등)은 짧아도 그 자체가 요건이라 지킨다(REAL_CATEGORY). */
const SUB_HEAD = /^.{0,12}(기준|조건|요건|대상자?|자격|구분|내역|사항|유형|항목)$/;

/* 🔴 제목 줄은 짧지 않을 수도 있다 — **콜론으로 끝나거나 꺾쇠·대괄호로 감싸면** 제목이다.
   `특성화 교육과정 수료 기준 (총 24학점 이수):` `<교내 장학금 지급 결격사유>` `[필수서류]`
   `근로장학생 자격 및 선발기준` — 길이로만 재면 전부 새어 나온다. */
const TITLE_LINE = /^[<\[［【].{2,30}[>\]］】]$|(기준|사유|서류|자격|항목|사항|요건|대상|방법)\s*(\([^)]*\))?\s*[:：]\s*$|^.{0,20}(자격\s?및\s?선발기준|선발\s?기준|결격\s?사유)$|^(제출|필수|선택|구비)?서류$/;

/* 서류·자료 이름으로 끝나는 줄 (증명서 규칙의 나머지 절반) — `…소득분위자료` `…모집요강` */
const DOC_TAIL = /(자료|요강|사본|서류|양식)\s*(\([^)]*\))?\s*$/;

/* 인원 안내 — `학술·봉사·설계 00명` `실현(창업) 0팀`.
   ⚠️ 앞에 조건이 붙어 있으면(`관악구 거주 대학 재학생(0명)`) 요건이므로 짧을 때만 본다. */
const HEADCOUNT_LINE = /^.{0,14}[\s(（]\s*\d+\s?(명|팀)\s*[)）]?\s*$/;

/* 우편번호·주소 — 접수처 주소가 자격 자리에 앉아 있었다(동산장학회) */
const ADDRESS_LINE = /^\[\d{5}\]|\d+번?길\s*\d/;

/* 일정 — `시간 및 장소 추후 개별 안내 예정` `7.13.(월) 10시 ~ 8.12(수) 15시까지` */
const SCHEDULE_LINE = /추후\s?(개별\s?)?안내|^\s*\d{1,2}\.\d{1,2}\.?\s*\([월화수목금토일]\)\s*\d{1,2}시/;

/* 🔴 연결·안내 문장 — `아래 두 가지 자격을 모두 충족하는 자` `아래 중 하나에 해당하는 자`.
   **그 자체로는 아무 조건도 말하지 않고** 다음 줄들을 가리키기만 한다. 화면에는 어차피
   그 다음 줄들이 이어 나오므로 한 자리만 차지하고, 5줄 상한이 있어 진짜 요건을 밀어낸다. */
/* 🔴 가리키기만 하는 줄 — 그 자체로는 아무 조건도 말하지 않는다. 화면에는 어차피
   가리키는 줄들이 이어 나오는데, 한 자리를 먹어 진짜 요건을 5줄 밖으로 밀어낸다.
   `아래 두 가지 조건을 모두 충족하는 학부 재학생` `이상 위 3개항 모두에 해당하는 자에 한함`
   같은 꼴을 2026-08-24 전수 조사에서 더 찾아 넓혔다. */
const POINTER_LINE = /^(아래|다음|위|상기|이상\s*위)[^.]{0,30}(모두|중\s*하나|각)?[^.]{0,20}(충족|해당|만족|같|참고|기재)[^.]{0,12}$/;

/* 🔴 **선택지(OR) 구조를 잃지 않는다** (2026-08-24 · 설계 docs/designs/fit-score.md 조건 ⑤).
   `아래 세 가지 조건 중 하나를 만족하는 자` 다음 줄들은 **선택지**지 필수가 아니다.
   안내 줄을 그냥 지우면 선택지가 필수처럼 남아, 하나만 만족하는 학생이 0%가 된다
   (한국고등교육재단 동아시아연구장학생으로 실증 — 석사 재학생은 1번만 만족한다).
   `세 가지`처럼 **개수가 적혀 있으면 그 개수만큼**을 한 묶음으로 본다 — 짐작보다 정확하다. */
const ANY_OF_LINE = /(중\s*(하나|1\s*개|어느\s*하나)|둘\s*중|가지\s*중)[^.]{0,12}(만족|해당|충족)/;
const KOR_NUM = { 한: 1, 두: 2, 세: 3, 네: 4, 다섯: 5, 여섯: 6 };
function anyOfCount(line) {
  const t = String(line || '');
  if (!ANY_OF_LINE.test(t)) return 0;
  const kor = t.match(/(한|두|세|네|다섯|여섯)\s*가지/);
  if (kor) return KOR_NUM[kor[1]] || 0;
  const dig = t.match(/(\d)\s*가지/);
  return dig ? parseInt(dig[1], 10) : 0;
}
const REAL_CATEGORY = /(자|생|중|상|하|명|원)$|북한이탈|새터민|다문화|기초생활|차상위|국적|유공|보훈|장애|한부모|다자녀/;
const isTableCell = (t) => BARE_CELL.test(t) && !REAL_CATEGORY.test(t);

function requirementLines(sch, lines, opts) {
  const keepPriority = !!(opts && opts.keepPriority);   // '먼저 뽑는 기준' 블록을 그릴 때만 참
  /* `loose` — '제외 대상'·'먼저 뽑는 기준' 블록을 그릴 때만 참.
     그 블록들은 애초에 자격이 아니므로 '요건임을 증명하라'를 적용하면 통째로 사라진다. */
  const loose = !!(opts && (opts.loose || opts.keepPriority || opts.onlyExclude));
  const raw = lines || (sch && sch.eligibilityLines) || [];
  /* ① 먼저 이어지는 줄을 붙인다 — 정리·거르기는 **붙인 뒤에** 해야 한다.
     (붙이기 전에 거르면 앞줄이 잡음 규칙에 걸려 사라지고 뒷줄만 덩그러니 남는다) */
  const joined = [];
  for (const l of raw) {
    const s = String(l || '').trim();
    if (!s) continue;
    const prev = joined[joined.length - 1];
    if (prev && CONTINUES.test(prev) && (prev + ' ' + s).length <= 160) joined[joined.length - 1] = `${prev} ${s}`;
    else joined.push(s);
  }
  const out = [];
  const moved = [];   // 순위로 옮긴 줄 — 자격이 통째로 비면 되돌린다 (아래)
  const sectMoved = [];   // '선발기준' **절**에 있던 줄 — 이건 되돌리지 않는다 (아래 주석)
  let inNonElig = false;   // 지금 읽는 줄이 '제출서류'·'자기소개' 절 안인가 (위 주석)
  /* 🔴 공고가 스스로 적어 둔 절 경계를 **버리지 않고 쓴다** (2026-08-24 개발자 지적).
     `◎ 신청 자격` / `◎ 지원 제외 대상` / `4. 선발기준`이 줄 목록 안에 그대로 들어 있는데,
     예전에는 아래 TITLE_LINE이 그 머리글을 **지워 버리고** 줄마다 낱말로 소속을 다시
     알아맞혔다. 그래서 제외 대상이 지원 자격으로 새어 나갔다 —
     시립대 활동도우미에서 `휴학생, 졸업생, 자퇴생, 대학원생…`이 '지원 자격'에 떴다.
     휴학생이 그 줄을 보고 자기가 된다고 읽는, **자격이 뒤집혀 보이는 실패**다.
     판정은 section-head.js 한 곳에 있다(발췌기·감사도 같은 파일을 쓴다 — 베끼지 말 것). */
  let sect = 'qualify';   // 머리글을 만나기 전까지는 자격 절로 본다(대개 자격부터 적는다)
  let asideSect = false;  // 지금 절이 ※ 곁말에서 온 것인가 (아래 주석)
  let asideBase = 'qualify';   // 곁말 전에 있던 절 — 번호 항목을 만나면 여기로 돌아온다
  let anyLeft = 0, anyGroup = 0;   // 선택지 묶음 — 몇 줄 남았나 / 몇 번째 묶음인가 (위 주석)
  const meta = [];                 // out과 같은 순서로 각 줄의 묶음 번호
  let caseRun = false, caseGroup = 0;   // 연달아 오는 '경우별 분기'를 한 묶음으로 (아래 주석)
  for (const l of joined) {
    let t = tidyRequirement(l);
    const head = SH.sectionOf(l) || SH.sectionOf(t);
    /* 🔴 `※ 신청불가자: …` 같은 **곁말**은 절을 바꾸지 않는다 (2026-08-24 전수 조사).
       이화 국가근로는 `가./나./다.` 자격 목록 **중간에** ※로 신청불가자를 적고 다시 `라.`로
       자격을 잇는다. ※를 절 머리글로 보면 그 뒤 `라. 국가근로장학금 1차 신청을 완료한 학생`
       (진짜 요건)까지 '제외돼요'로 넘어간다. 곁말은 자기 줄에만 걸리고,
       다음 **번호 항목**(가./나./1)/①)을 만나면 원래 절로 돌아온다. */
    const isAside = /^\s*[※*]/.test(String(l || ''));
    const isEnum = /^\s*(?:[가-하]\s*[.)]|\d+\s*[.)]|[①-⑳])/.test(String(l || ''));
    if (isEnum && asideSect) { sect = asideBase; asideSect = false; }
    if (head) {
      if (isAside) { asideSect = true; asideBase = sect; }
      else asideSect = false;
      sect = head;
      /* 🔴 머리글 뒤에 내용이 붙어 있으면 그 내용은 살린다 — `2) 추천대상 : 4년제 대학교…`.
         버리면 그 공고의 **유일한 자격 줄**이 사라진다(동산장학회로 실증). */
      const rest = SH.headRest(l);
      if (!rest) continue;
      t = tidyRequirement(rest);
    }
    /* 자격 블록을 그릴 때는 자격 절 밖의 줄을 담지 않는다.
       `loose`(제외·순위 블록)일 때는 이 잣대를 대지 않는다 — 그 블록은 애초에 자격이 아니다. */
    /* 🔴 '선발기준' 절을 **통째로** 자격에서 빼면 진짜 요건이 사라진다 (2026-08-24 회귀).
       유흥수 장학금은 `1) 선발기준` 아래 첫 줄이 `2026년 2학기 재학생`이다 — 뽑는 순서가
       아니라 넘어야 하는 선인데, 절째로 빼자 어느 칸에도 안 남았다(잡음보다 나쁜 실패).
       그래서 절이 아니라 **줄**을 본다:
         · 옮긴다 — `종합적으로 평가하여 선발` `기참여자 가산점` `평점이 높은 학생`
         · 남긴다 — `2026년 2학기 재학생` `직전학기 성적 백분위 70점 이상인 재학생` */
    if (!loose && sect === 'exclude' && POSITIVE_REQ.test(t)) {
      // 제외 절에 있어도 긍정으로 적힌 줄은 자격이다 (위 POSITIVE_REQ 주석)
    } else if (!loose && sect === 'select'
               && !(SELECT_VERB.test(t) || (PRIORITY_LINE.test(t) && !HARD_THRESHOLD.test(t)))) {
      // 자격으로 통과시킨다 (아래 공통 검사는 그대로 받는다)
    } else if (!loose && sect !== 'qualify') { if (sect === 'select') sectMoved.push(t); continue; }
    if (NON_ELIG_SECTION.test(t)) { inNonElig = true; continue; }
    if (ELIG_SECTION.test(t)) inNonElig = false;
    if (inNonElig && !loose) continue;
    // 다듬은 뒤에 검사한다 — "3 ) 금 액 : …"은 번호를 떼야 '금액' 줄인 것이 드러난다
    /* 🔴 `※` 곁말을 **내용도 안 보고** 버리면 안 된다 (2026-08-27 전수 조사).
       ※ 로 시작하는 자격 줄이 95개인데 한 줄도 화면에 못 나가고 있었다. 그중에는
       버려선 안 되는 것이 섞여 있다:
         · `※ 졸업유예자, 휴학생, 대학원생, 세종캠퍼스 학생은 지원 불가`  (25건)
           → 제외 칸에도 못 가서, 그 학생이 **자기가 된다고 읽는다.** 자격이 뒤집혀
             보이는 실패라 잡음보다 나쁘다.
         · `※ 10학기 이하 후기 이중전공자는 등록금 전액 납부 시 신청 가능`
           → 본문 규칙(`8학기 이하`)을 뒤집는 **예외 자격**이다. 빠지면 되는 학생이 안 된다고 나온다.
       ⚠️ 그렇다고 ※ 를 통째로 열면 2026-08-02에 개발자가 지적한 그 잡음이 되살아난다
          (`※ 예산 범위 내 학교 지급기준에 의거하여 …`, `※ 동점자 처리기준 : …`).
       그래서 이 저장소 방식대로 **증명한 줄만** 통과시킨다 — 제외를 말하거나(EXCLUDE_LINE),
       '누구는 신청 가능' 꼴이거나(AFFIRM_ELIG). 나머지 ※ 는 예전처럼 버린다. */
    const asideProven = isAside && (EXCLUDE_LINE.test(t) || AFFIRM_ELIG.test(t));
    if (!asideProven && REQ_NOISE.test(l.trim())) continue;
    if (REQ_NOISE.test(t)) continue;
    if (!loose && DOC_COUNT_TAIL.test(t)) continue;
    if (NOT_REQ_RE.test(t) || isTableCell(t)) continue;
    const ranks = PRIORITY_LINE.test(t) && !HARD_THRESHOLD.test(t);
    if (!keepPriority && ranks) { moved.push(t); continue; }   // 자격 블록에서는 뺀다 (위 주석)
    /* 자격 줄 안에 섞여 있던 순위 기준을 **주워서 옮길 때**만 참 — 버리지 않는다는 약속을
       지키는 자리다(자격에서 뺐는데 아무 데도 안 나오면 그건 그냥 삭제다). */
    /* 🔴 제외 줄은 **어느 절에 있든** 제외 블록으로 모은다 (2026-08-24).
       예전엔 발췌기가 따로 뽑아 둔 `eligibilityExcludes`만 봤다. 그래서 자격 절 안에 섞여
       있던 제외 줄(동산장학회 `정학·퇴학 등 징계 처분을 받은 학생은 제외`)은 갈 곳이 없어
       자격으로 뜨거나 통째로 사라졌다. 긍정으로 적힌 줄은 자격이므로 여기서 뺀다. */
    if (opts && opts.onlyExclude) {
      if (POSITIVE_REQ.test(t)) continue;
      /* 🔴 괄호 **안**의 '지원 불가'로 줄을 제외 블록에 넣으면 안 된다 (2026-08-24).
         `2026학년도 2학기 정규 등록 예정자 (※ 휴학 예정자 지원 불가)`는 **자격 줄**이고
         괄호는 부연일 뿐이다. 넣으면 같은 줄이 자격·제외 두 곳에 뜬다(실측 9줄).
         자격 블록이 쓰는 잣대와 **같은 규칙**이다 — 갈라지면 또 어긋난다. */
      if (NOT_AN_EXCLUSION.test(t)) continue;   // 면제·산정 규칙은 제외가 아니다 (위 주석)
      /* 끝이 '…선발 가능'이면 그 줄의 주장은 자격이다 (위 ENDS_AFFIRM 주석) */
      if (AFFIRM_ELIG.test(t) && ENDS_AFFIRM.test(t)) continue;
      const bareEx = t.replace(/\s*[(（][^)）]*[)）]\s*$/, '').trim();
      const pureEx = EXCLUDE_LINE.test(bareEx.length >= 4 ? bareEx : t);
      if (!(sect === 'exclude' || pureEx)) continue;
      /* 🔴 말투 (2026-08-24 개발자 지시 — "그냥 ~인 경우라고만 쓰는 게 사람같은 말투").
         블록 제목이 이미 '이런 경우는 제외돼요'이므로 꼬리의 '…참여 불가'는 같은 말이
         두 번이다: `학칙 등에 따라 징계 중인 경우 해당 기간 내 사업 참여 불가`
         → `학칙 등에 따라 징계 중인 경우`. '경우'로 끊을 수 있을 때만 손댄다. */
      t = t.replace(/^(.*?경우)\s*[^)]*?(참여|참가|지원|신청|지급|수혜)\s*불가\s*$/, '$1');
    }
    if (opts && opts.onlyPriority && !ranks
        && !(sect === 'select' && (SELECT_VERB.test(t) || PRIORITY_LINE.test(t)))) continue;
    /* '먼저 뽑는 기준' 블록에 **제외 줄**을 넣지 않는다 — 그건 '이런 경우는 제외돼요' 몫이다
       (동산장학회: `정학·퇴학 등 징계 처분을 받은 학생은 제외`가 순위로 떠 있었다). */
    if (opts && opts.onlyPriority && EXCLUDE_LINE.test(t)) continue;
    // 문턱 줄은 자격 블록으로 이미 나갔다 — 두 블록에 같은 줄을 띄우지 않는다
    if (opts && opts.onlyPriority && sect === 'select' && HARD_THRESHOLD.test(t) && !SELECT_VERB.test(t)) continue;
    /* ⚠️ 여기서 REAL_CATEGORY를 쓰면 안 된다 — 그건 짧은 **표 칸** 판정용이라
       `(자|생|중|상|하|명|원)$`처럼 느슨해서 `지원 제외 대상`의 '상'까지 자격으로 봤다.
       제목에서 지켜야 할 것은 **진짜 자격 범주 이름뿐**이므로 좁게 적는다. */
    if (SUB_HEAD.test(t) && !/수급|차상위|보훈|유공|장애|다자녀|한부모|새터민|북한이탈|다문화|국적/.test(t)) continue;
    /* 대학원 전용 줄(`일반대학원생 : …`)은 학부생에게 해당이 없다. 화면에 남겨 두면
       100%인데 아무 표시도 없는 줄이 되어 학생이 혼란스럽다(2026-08-24 개발자 지적). */
    if (!loose && PR2.gradOnly(t)) continue;
    if (POINTER_LINE.test(t)) {
      /* 안내 줄 자신은 화면에 안 내보내되, '여기부터 n줄은 선택지'라는 사실은 남긴다 */
      const n = anyOfCount(t);
      if (n > 0) { anyLeft = n; anyGroup += 1; }
      continue;
    }
    /* 제목 판정은 **공백을 없애고** 본다 — 한글 문서가 `제 출 서 류`처럼 자간을 벌려 쓴다 */
    if (TITLE_LINE.test(t) || TITLE_LINE.test(t.replace(/\s+/g, ''))) continue;
    if (/^[~〜]/.test(t)) continue;          // `~ ④ 모두 만족하는 자` — 앞이 잘린 조각
    if (DOC_TAIL.test(t)) continue;
    /* 인원 안내는 **요건이 함께 적혀 있지 않을 때만** 버린다 —
       `관악구 거주 대학 재학생(0명)`은 인원이 뒤에 붙었을 뿐 진짜 요건이다(실증). */
    if (HEADCOUNT_LINE.test(t) && !/거주|재학|학년|이상|이하|구간|성적|전공|수급|출신/.test(t)) continue;
    if (ADDRESS_LINE.test(t)) continue;
    if (SCHEDULE_LINE.test(t)) continue;
    if (t.length < 4 || t.length > 160) continue;
    if (/^(신청\s?자격|지원\s?자격|지원\s?대상|신청\s?대상|모집\s?대상|선발\s?대상|자격\s?요건)$/.test(t)) continue;
    /* ── 🔴 자격 블록에는 **요건임을 증명한 줄만** 나간다 (2026-08-23) ──
       버릴 것을 열거하는 대신 통과 조건을 뒤집었다. 왜 그랬는지는 REQ_SIGNAL 첫머리 참조.
       세 겹으로 본다:
         ① 자격이 아닌 것이 스스로 드러내는 표지가 있으면 버린다(일정·배점·평가)
         ② 제외 대상은 버리지 않고 '이런 경우는 제외돼요' 블록으로 자리를 옮긴다
         ③ 요건 신호가 하나도 없으면 안 보여 준다 — 모른다고 말하는 편이 낫다 */
    if (!loose) {
      if (NOT_A_REQUIREMENT.test(t)) continue;
      /* 🔴 괄호 **안**의 '지원불가'로 줄을 통째로 버리면 안 된다 (2026-08-24) —
         `2026년 2학기 재학생 (휴학예정자 지원불가)`는 요건이고 괄호는 부연일 뿐인데,
         제외 규칙에 걸려 **진짜 자격이 조용히 사라지고 있었다**(잡음보다 나쁜 실패).
         괄호를 떼고도 여전히 제외를 말하는 줄만 옮긴다. 괄호가 곧 전부인 줄
         (`(타 장학금 수혜자 지원 불가)`)은 떼면 빈 껍데기라 그대로 본다. */
      const bare = t.replace(/\s*[(（][^)）]*[)）]\s*$/, '').trim();
      if (EXCLUDE_LINE.test(bare.length >= 4 ? bare : t) && !NOT_AN_EXCLUSION.test(t)
          && !(AFFIRM_ELIG.test(t) && ENDS_AFFIRM.test(t))) continue;
      if (!REQ_SIGNAL.test(t)) continue;
    }
    if (!out.includes(t)) {
      out.push(t);
      /* 🔴 연달아 오는 경우 분기는 **한 요건**이다 — 따로 세면 분모가 부풀어
         정읍시민이 요건 7개(실제 4개)로 잡혔다. 첫 분기에서 묶음을 열고 이어 붙인다. */
      if (PR.caseBranch(t)) {
        if (!caseRun) { caseGroup = (anyGroup += 1); caseRun = true; }
        meta.push(caseGroup);
      } else {
        caseRun = false;
        meta.push(anyLeft > 0 ? anyGroup : 0);   // 0 = 반드시 충족 / 1 이상 = 그 묶음 중 하나만
      }
      if (anyLeft > 0) anyLeft -= 1;
    }
    /* 5줄이면 충분하다 — 더 늘어놓으면 학생이 안 읽는다. 사람이 정리한 것처럼 보여야 한다.
       못 담은 것은 바로 아래 '원문 보기'로 갈 수 있다. */
    if (!(opts && opts.all) && out.length >= 5) break;
  }
  /* 🔴 자격 칸을 **비우면서까지** 순위를 걷어내지는 않는다 (2026-08-24) —
     학계장학문화재단은 `소득분위가 낮고 학업성적이 우수한 학생`이 공고의 유일한 조건이라,
     옮겨 버리면 카드가 '자격을 아직 읽지 못했어요'가 된다. 애매한 진짜 조건을 보여 주는 편이
     아무것도 안 보여 주는 것보다 낫다(잡음보다 나쁜 실패 = 자격이 사라지는 것). */
  /* ⚠️ 이 구제는 **자격 블록 전용**이다. onlyExclude에도 적용됐더니 '이런 경우는 제외돼요'에
     `누적 평균 평점이 높은 학생` 같은 순위 줄이 튀어나왔다(2026-08-24 유흥수로 실증). */
  if (!out.length && !keepPriority && !(opts && opts.onlyExclude) && moved.length) {
    const mv = moved.slice(0, 5);
    return (opts && opts.withMeta) ? mv.map((text) => ({ text, group: 0 })) : mv;
  }
  /* 🔴 `sectMoved`는 **되돌리지 않는다** (2026-08-24 개발자 지적).
     위 되돌리기는 '자격 줄 하나가 순위처럼 보여 옮겼는데 자격이 비었다'를 구제하는 장치다.
     그런데 공고 전체가 `4. 선발기준`뿐인 경우(대청교 멘토)에는 **뽑는 기준을 지원 자격으로
     되살려** 놓았다 — '종합적으로 평가하여 선발', '기참여자 가산점'이 자격으로 떴다.
     자격이 원문에 없으면 없다고 말하는 편이 맞다(원칙 8-1) — 앱이 '아직 읽지 못했어요'로
     정직하게 표시하고, 이 줄들은 '먼저 뽑는 기준' 블록에서 따로 보여 준다. */
  /* `withMeta`를 달라고 한 쪽(적합도 계산)에만 묶음 정보를 준다 — 화면은 예전 그대로 문자열이다 */
  if (opts && opts.withMeta) return out.map((text, i) => ({ text, group: meta[i] || 0 }));
  return out;
}

/* 요건 한 줄이 이 학생에게 맞는지 — **확실할 때만** 판정한다.
   틀린 초록 체크는 '모른다'보다 나쁘다(자격도 안 되는 학생이 서류를 준비하게 된다).
   그래서 숫자·낱말이 명확한 것만 보고, 조금이라도 애매하면 null(판정 안 함)을 낸다. */
function requirementMatch(text, p, sch) {
  /* 🔴 예전에는 여기에 **정규식 판정기가 한 벌 더** 있었다(2026-08-24 제거).
     그래서 화면의 ✓/✗가 적합도 퍼센트와 따로 놀았다 — 100%인데 ✕가 뜨고, 아무 표시도
     없는 줄이 100%에 섞였다. 게다가 그 판정기는 `p.status === 'enrolled'`처럼
     **바뀐 옛 프로필 값**을 보고 있어 학적 판정이 조용히 죽어 있었다.
     지금은 퍼센트를 만드는 것과 **똑같은 함수**를 쓴다 — 갈라질 수가 없다. */
  return lineVerdict(text, p, false, sch ? noticeCtx(sch) : null);
}

/* ---------------- 학교별 공고 파일 이름 (2026-08-17 신설) ----------------
   왜 나눴나: `data/notices.json`은 **폰이 통째로 내려받는 파일**이라, 고려대 학생도
   동국대 공고를 같이 받았다. 그래서 크기 상한(학교 수 × 15건)이 필요했고, 학교가 41곳이
   되면서 그 상한이 실제로 물려 바쁜 학교 34곳이 **16건에서 잘리고** 있었다.
   학교별로 나누면 학생은 자기 학교 것만 받으므로 **상한 자체가 필요 없어진다.**

   ⚠️ 파일 이름에 한글을 쓰지 않는 이유: 이 저장소에는 한글 파일명이 하나도 없다.
   지금 들이면 git 설정(core.quotepath)·GitHub Pages·나중의 Cloudflare 이전까지
   전부 확인해야 할 것이 늘어난다. 그래서 학교 이름을 **정해진 규칙으로 짧은 영숫자**로
   바꾼다(FNV-1a). 사람이 읽을 이름은 `data/notices/index.json`에 함께 적어 둔다.

   ⚠️ 이 함수는 **화면(app.js)·알림(sw.js)·수집 로봇(Node)이 같이 쓴다.**
   베껴 두면 로봇이 쓴 파일을 앱이 못 찾는다 — 그런데 앱은 404를 조용히 넘기므로
   **아무 오류 없이 공고가 0건이 된다**(가장 찾기 힘든 종류의 고장).
   verify/test-collector.mjs가 로봇과 이 함수의 결과가 같은지 검사한다. */
function noticeFileKey(school) {
  let h = 0x811c9dc5;
  const s = String(school || '');
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;    // imul — 32비트 곱셈을 정확히 (그냥 *는 정밀도를 잃는다)
  }
  return `n${h.toString(36)}`;
}

function noticeFileFor(school) {
  return `data/notices/${noticeFileKey(school)}.json`;
}

/* 이 학생이 받아야 할 공고 파일들.
   분교가 본교 게시판을 함께 쓰는 경우(한양 ERICA·건국 글로컬·홍익 세종)에는 본교 파일도
   받아야 한다 — 공고가 본교 이름으로 저장되기 때문. 어느 것이 내 공고인지는 그다음에
   noticeForProfile이 가른다(그 판정은 여기서 손대지 않는다). */
function noticeFilesForProfile(p) {
  if (!p || !p.school) return [];
  const list = [noticeFileFor(p.school)];
  const parent = SHARED_BOARD_BRANCH[p.school];
  if (parent) list.push(noticeFileFor(parent));
  return list;
}

/* 자격 요건을 **구조**로 — 공통 / 둘 중 하나 / 성적 (2026-08-23 신설).

   왜 필요한가: 원문이 표인 공고를 줄 목록으로 펴면 공통·분기가 사라져 뜻이 뒤집힌다.
   동국대 종단추천장학이 실증 — 원문은 "공통 1개 + 둘 중 하나 + 성적"인데 다섯 줄을
   나란히 그려서, 신규 지원자가 "기수혜자여야 한다"로 읽고 포기한다.

   🔴 **갈래가 둘 이상일 때만** 구조를 낸다(아니면 null → 화면은 지금 모양 그대로).
   갈래가 없는 공고까지 새 모양으로 바꿀 이유가 없고, 바뀌는 곳이 적을수록 사고도 적다.

   줄을 다듬고 거르는 일은 `requirementLines`에게 그대로 맡긴다 — 여기에 규칙을 한 벌 더
   두면 화면·알림·챗봇이 서로 다른 말을 하게 된다(이 파일이 존재하는 이유). */
function requirementStruct(sch) {
  const st = sch && sch.eligibilityStruct;
  if (!st) return null;
  const clean = (arr) => requirementLines(sch, arr || []);
  const either = (st.either || [])
    .map((b) => ({
      /* 갈래 이름도 원문 줄이다 — 앱이 지어내지 않는다. 못 읽었으면 null로 두고
         화면이 '첫째 · 둘째'로만 가른다(이름을 만들어 붙이는 것보다 낫다). */
      label: b && b.label ? tidyRequirement(String(b.label)) : null,
      lines: clean(b && b.lines).slice(0, 3),
    }))
    .filter((b) => b.lines.length);
  if (either.length < 2) return null;
  /* 칸 수는 구조 단위로 나눈다 — 예전엔 통째로 5줄에서 잘려 갈래가 통으로 날아갔다 */
  return { common: clean(st.common).slice(0, 4), either, grade: clean(st.grade).slice(0, 2) };
}

/* Node(검증 스크립트)에서도 같은 엔진을 불러 쓸 수 있게 — 브라우저·서비스워커에는 영향 없음 */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { evaluate, fitScore, fitDetail, judgeCond, FIT_UNREAD, FIT_FLOOR, FIT_MAX, FIT_MIN,
                     scopedToProfile, notStale, STALE_DAYS,
                     requirementLines, requirementStruct, requirementMatch, tidyRequirement,
                     REQ_SIGNAL, NOT_A_REQUIREMENT, EXCLUDE_LINE, HARD_THRESHOLD,
                     noticeForProfile, taggedSchool, SHARED_BOARD_BRANCH,
                     noticeFileKey, noticeFileFor, noticeFilesForProfile };
}

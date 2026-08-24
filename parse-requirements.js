/* 자격 요건 파서 — 자격 줄 한 줄에서 '기계가 판정할 수 있는 조건'을 뽑는다 (2026-08-24 신설)
   ─────────────────────────────────────────────────────────────────────────
   설계: docs/designs/fit-score.md

   🔴 이 파일의 존재 이유는 **확신도**다. 조건을 뽑는 것보다 "이걸 믿어도 되나"가 중요하다.
      적합도 0%는 학생에게서 장학금을 뺏는 판정이라, 틀리면 가장 비싸다.
      그래서 조금이라도 애매하면 확신을 낮추고, 낮은 확신은 0%를 못 낸다.

   브라우저·Node 겸용 (match-engine.js·section-head.js와 같은 방식).
   **베끼지 말 것** — 화면·감사·검사가 같은 파일을 써야 판정이 갈라지지 않는다.
   ───────────────────────────────────────────────────────────────────────── */

/* 성적 단위 — 데이터에 세 가지가 섞여 있다. 섞어서 비교하면 재앙이다:
   백분위 70점을 평점 70으로 읽으면 거의 모든 학생이 0%가 된다(설계 조건 ⑥). */
const GRADE_SCALE = {
  gpa45: 'gpa45',       // 3.0 / 4.5만점
  gpa43: 'gpa43',       // 2.8 / 4.3만점
  percent: 'percent',   // 백분위 70점 / 100점
  letter: 'letter',     // B학점 이상
};

/* 학적 상태 — `복학예정`을 `휴학`으로 뭉개면 안 된다(설계 조건 ⑦ · 실측 14건) */
const STATUSES = ['재학', '휴학', '복학예정', '초과학기', '졸업유예', '수료', '졸업', '자퇴', '대학원'];

/* 확신 등급. 'high'만 0%(자격 미달)를 낼 수 있다. */
const HIGH = 'high', LOW = 'low';

/* 예외가 붙은 줄은 확신을 낮춘다 — `(단, 신입생은 미적용)` (설계 조건 ④ · 실측 5건).
   예외를 못 읽으면서 본문만 읽고 미달을 선언하면 신입생이 통째로 잘려 나간다. */
const HAS_EXCEPTION = /단,|다만|제외하고|미적용|예외|무관|해당\s?없|경우는?\s*(제외|미적용)|포함/;

/* 여러 장학금이 한 공고에 묶인 줄 — 하나에 미달해도 다른 것에 지원할 수 있다(설계 조건 ⑧) */
const MULTI_PROGRAM = /^\s*[(（]\s*[^)）]{2,16}장학(금|생)?\s*[)）]/;

function num(s) { const m = String(s).match(/\d+(\.\d+)?/); return m ? parseFloat(m[0]) : null; }

/* ── 성적 ───────────────────────────────────────────────────────────────
   단위를 **확정할 수 있을 때만** 낸다. `평균 80점 또는 평점 B학점 이상`처럼
   두 단위가 한 줄에 있으면 확신을 낮춘다(둘 중 어느 쪽으로 재야 하는지 모른다). */
function parseGrade(t) {
  const hasPct = /백분위|\/\s*100|100\s*점\s*만점|\d{2,3}\s*점\s*(이상|\/)/.test(t);
  const has45 = /\/\s*4\.5|4\.5\s*만점|평점\s*평균|평균\s*평점|평점이?\s*\d\.\d/.test(t);
  const has43 = /\/\s*4\.3|4\.3\s*만점/.test(t);
  const hasLetter = /\b[ABC][+0]?\s*(학점)?\s*이상/.test(t);
  const kinds = [hasPct, has45 || has43, hasLetter].filter(Boolean).length;

  const mDec = t.match(/(\d\.\d{1,2})\s*(?:\/\s*4\.[35])?\s*(?:이상|이상인|넘)/);
  const mPct = t.match(/(?:백분위|평균)?\s*(\d{2,3})\s*점?\s*(?:\/\s*100)?\s*(?:만점)?\s*(?:이상|이상인)/);

  if (mDec) {
    const v = parseFloat(mDec[1]);
    if (v > 4.5) return null;                     // 평점이 4.5를 넘을 수 없다 — 잘못 읽은 것
    return { kind: 'grade', scale: has43 ? GRADE_SCALE.gpa43 : GRADE_SCALE.gpa45, min: v,
             conf: (kinds > 1 || HAS_EXCEPTION.test(t)) ? LOW : HIGH };
  }
  if (mPct) {
    const v = num(mPct[1]);
    if (v == null || v < 40 || v > 100) return null;   // 백분위는 40~100 밖일 수 없다
    return { kind: 'grade', scale: GRADE_SCALE.percent, min: v,
             conf: (kinds > 1 || HAS_EXCEPTION.test(t)) ? LOW : HIGH };
  }
  if (hasLetter) return { kind: 'grade', scale: GRADE_SCALE.letter, min: (t.match(/([ABC][+0]?)\s*(학점)?\s*이상/) || [])[1], conf: LOW };
  return null;
}

/* ── 소득 구간(분위) ── `9구간 이하` `3분위 이내` */
function parseBracket(t) {
  const m = t.match(/(\d{1,2})\s*(?:구간|분위)\s*(이하|이내|미만)/);
  if (!m) return null;
  const v = num(m[1]);
  if (v == null || v < 1 || v > 10) return null;
  /* 🔴 `5분위 이상 ~ 6분위 이하`처럼 구간이 여럿이면 요건이 아니라 **지급액 표**다
     (서울과기대 근로장학이 이 표로 0% 오탐을 냈다 — 2026-08-24). */
  const many = (t.match(/\d{1,2}\s*(구간|분위)/g) || []).length > 1;
  return { kind: 'bracket', max: m[2] === '미만' ? v - 1 : v,
           conf: (many || /이상/.test(t) || HAS_EXCEPTION.test(t)) ? LOW : HIGH };
}

/* ── 직전학기 이수학점 ── `12학점 이상` */
function parseCredits(t) {
  const m = t.match(/(\d{1,2})\s*학점\s*(이상|이내|미만)/);
  if (!m) return null;
  const v = num(m[1]);
  if (v == null || v < 1 || v > 30) return null;
  /* 여러 개가 한 줄에 있으면(`15학점(4학년 12학점)`) 어느 쪽인지 모른다 */
  const many = (t.match(/\d{1,2}\s*학점/g) || []).length > 1;
  return { kind: 'credits', min: m[2] === '이상' ? v : null, max: m[2] !== '이상' ? v : null,
           conf: (many || HAS_EXCEPTION.test(t)) ? LOW : HIGH };
}

/* ── 학년 ── `2학년 이상` `1학년` `신입생` */
function parseYear(t) {
  if (/신입생/.test(t) && !/신\s*[·,\/]\s*편입생/.test(t)) return { kind: 'year', eq: 1, conf: LOW };
  const m = t.match(/(\d)\s*학년\s*(이상|이하|만)?/);
  if (!m) return null;
  const v = num(m[1]);
  if (v == null || v < 1 || v > 6) return null;
  const many = (t.match(/\d\s*학년/g) || []).length > 1;   // `1학년 또는 2학년` — 범위라 단정 불가
  if (m[2] === '이상') return { kind: 'year', min: v, conf: many ? LOW : HIGH };
  if (m[2] === '이하') return { kind: 'year', max: v, conf: many ? LOW : HIGH };
  return { kind: 'year', eq: v, conf: LOW };   // `2학년 학생` — 딱 그 학년인지 이상인지 애매
}

/* ── 학적 상태 ── 자격 줄이면 '이래야 한다', 제외 줄이면 '이러면 안 된다' */
function parseStatus(t, isExclude) {
  const hit = [];
  /* 🔴 `재학`은 부분문자열로 아무 데나 걸린다 — `수업연한 초과 재학생`·`비재학생`·
     `외국 대학에 재학 중인`. 이게 제외 목록에 들어가면 **재학생이 통째로 0%**가 된다
     (2026-08-24 0% 전수 확인에서 오탐 9건 중 5건이 이것이었다).
     장학금이 재학생을 제외하는 일은 없으므로, 제외 줄에서는 아예 담지 않는다. */
  if (/재학/.test(t) && !isExclude && !/비재학|초과\s?재학|외국\s?대학에\s?재학/.test(t)) hit.push('재학');
  if (/휴학/.test(t)) hit.push('휴학');
  if (/복학\s?예정/.test(t)) hit.push('복학예정');
  if (/초과\s?학기|수업연한\s?초과/.test(t)) hit.push('초과학기');
  if (/졸업\s?유예|학사학위취득유예/.test(t)) hit.push('졸업유예');
  if (/수료(생|자)/.test(t)) hit.push('수료');
  if (/졸업(생|자|\s?예정)/.test(t) && !/졸업\s?유예/.test(t)) hit.push('졸업');
  if (/자퇴/.test(t)) hit.push('자퇴');
  if (/대학원(생|\s?재학)/.test(t)) hit.push('대학원');
  if (!hit.length) return null;
  /* 🔴 `복학예정`이 함께 적혀 있으면 `휴학`을 금지로 읽지 않는다 —
     `2026-2학기 재학 및 복학예정자`는 휴학 중인 학생을 받아 주는 공고다(실측 14건). */
  const list = hit.includes('복학예정') ? hit.filter((h) => h !== '휴학') : hit;
  /* `정규학기 재학생`은 초과학기생·졸업유예자를 뺀 말이다(실측 14줄).
     그냥 `재학생`(120줄)이면 그들도 재학생이므로 포함한다 — 판정은 judgeCond가 한다. */
  return { kind: 'status', [isExclude ? 'not' : 'anyOf']: list,
           regularOnly: /정규\s?학기/.test(t),
           conf: HAS_EXCEPTION.test(t) ? LOW : HIGH };
}

/* ── 특별자격 ── 프로필 flags와 같은 이름을 쓴다 */
const FLAG_PAT = [
  ['basicLiving', /기초\s?생활\s?수급|기초수급/], ['nearPoverty', /차상위/],
  ['multiChild', /다자녀/], ['merit', /국가유공|보훈\s?대상|독립유공/],
  ['disabled', /장애\s?(학생|인|우|의\s?정도)/], ['singleParent', /한부모/],
  ['defector', /북한이탈|새터민|탈북/], ['multicultural', /다문화/],
];
function parseFlags(t) {
  const hit = FLAG_PAT.filter(([, re]) => re.test(t)).map(([k]) => k);
  if (!hit.length) return null;
  return { kind: 'flags', anyOf: hit, conf: HAS_EXCEPTION.test(t) ? LOW : HIGH };
}

/* ── 국적 ── */
function parseNationality(t) {
  if (/외국인\s?유학생|유학생으로서|외국인\s?학생/.test(t)) return { kind: 'nationality', eq: 'foreign', conf: HIGH };
  if (/대한민국\s?국적|국적\s?소지|내국인/.test(t)) {
    /* 🔴 `대한민국 국적으로 **외국 대학에 재학 중인** 대학생`(제외)은 국적이 아니라
       '어디에 다니느냐'가 조건이다. 국적만 보고 떨어뜨리면 국내 재학생이 0%가 된다
       (시립대 활동도우미로 실증 — 2026-08-24). */
    if (/외국\s?대학|해외\s?대학|국외\s?대학/.test(t)) return null;
    return { kind: 'nationality', eq: 'korean', conf: /포함/.test(t) ? LOW : HIGH };
  }
  return null;
}

/* 🔴 학부생에게 해당하지 않는 줄 — `일반대학원생 : 2학기 이수자 이상, 평점 4.0 이상`.
   가톨릭대 동문장학금은 학부(3.3)와 대학원(4.0) 기준을 따로 적는데, 대학원 줄로 학부생을
   떨어뜨리고 있었다(2026-08-24 오탐). 이런 줄은 아예 판정에서 뺀다. */
const GRAD_ONLY_LINE = /^\s*(일반)?\s*대학원\s?생?\s*[:：]|^\s*대학원\s?과정\s*[:：]/;
function gradOnly(t) { return GRAD_ONLY_LINE.test(String(t || '')); }

/* ── 나이 ── `만 39세 이하` */
function parseAge(t) {
  const m = t.match(/만\s?(\d{2})\s*세\s*(이하|미만)/);
  if (!m) return null;
  const v = num(m[1]);
  return v == null ? null : { kind: 'age', max: m[2] === '미만' ? v - 1 : v, conf: HIGH };
}

/* ── 거주지 ── 시·도 이름. `부 또는 모가 1년 이상 거주`가 흔해 본인/부모를 가르지 않고
   '집안 중 누구든 그 지역'으로 본다(설계: 프로필에서 본인·부모를 따로 받는다). */
const REGIONS = ['서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종', '경기', '강원',
  '충북', '충남', '전북', '전남', '경북', '경남', '제주', '충청북도', '충청남도', '전라북도',
  '전라남도', '경상북도', '경상남도', '강원도', '경기도', '제주특별자치도'];
function parseResidence(t) {
  if (!/거주|주소를?\s?두|주민등록|시민|도민/.test(t)) return null;
  const hit = REGIONS.filter((r) => t.includes(r));
  if (!hit.length) return null;
  return { kind: 'residence', anyOf: hit, conf: HAS_EXCEPTION.test(t) ? LOW : HIGH };
}

/* 한 줄에서 조건을 전부 뽑는다. `isExclude`면 '이러면 안 된다'로 읽는다. */
function parseLine(line, isExclude) {
  const t = String(line || '');
  if (!t.trim()) return { conds: [], multiProgram: false };
  const conds = [];
  const push = (c) => { if (c) conds.push(c); };
  push(parseGrade(t)); push(parseBracket(t)); push(parseCredits(t)); push(parseYear(t));
  push(parseStatus(t, isExclude)); push(parseFlags(t)); push(parseNationality(t));
  push(parseAge(t)); push(parseResidence(t));
  if (isExclude) conds.forEach((c) => { c.exclude = true; });
  return { conds, multiProgram: MULTI_PROGRAM.test(t) };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { parseLine, gradOnly, GRADE_SCALE, STATUSES, HIGH, LOW, MULTI_PROGRAM, HAS_EXCEPTION };
}

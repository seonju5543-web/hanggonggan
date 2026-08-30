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
  /* 🔴 `특수교육대상자` 는 **장애 학생을 가리키는 행정 용어**다 (2026-08-30 개발자 지적:
     "특수교육대상자=장애학생인데 이것도 너가 판정할 수 있는 건데"). 못 알아봐서
     판정에서 빠지고 있었다. `장애인 등에 대한 특수교육법` 의 용어다. */
  ['disabled', /장애\s?(학생|인|우|의\s?정도)|특수\s?교육\s?대상자?/], ['singleParent', /한부모/],
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
/* 🔴 예전에는 **`대학원생 :` 꼴의 이름표만** 잡았다. 그래서 `국내 대학원 박사과정
   첫 번째 학기 재학자`처럼 문장으로 적힌 대학원 전용 줄이 학부생 화면에서 ✓를 받았다
   (2026-08-24 전수 스윕에서 발견 — 동아시아연구장학생).
   ⚠️ `본교 재학생 (학부 및 대학원생)`처럼 **학부를 함께 적은 줄은 대학원 전용이 아니다** —
      학부생도 해당하므로 여기서 빼면 진짜 요건이 사라진다. */
const GRAD_LABEL = /^\s*(일반)?\s*대학원\s?생?\s*[:：]|^\s*대학원\s?과정\s*[:：]/;
const GRAD_BODY = /대학원\s?(석사|박사)?\s?과정|석사\s?(과정|학위)|박사\s?(과정|학위)|대학원\s?재학/;
const UNDERGRAD_TOO = /학부|학사\s?과정|전문대/;
function gradOnly(t) {
  const x = String(t || '');
  if (GRAD_LABEL.test(x)) return true;
  return GRAD_BODY.test(x) && !UNDERGRAD_TOO.test(x);
}

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
/* 🔴 지역 요건은 **대부분 시·군 단위**다 (2026-08-30 개발자 지시로 신설).
   `안양시에 주소를 두고`·`무안군에 1년 이상` 을 시·도만으로는 판정할 수 없어,
   한국장학재단 등록 116곳 중 83곳(72%)이 통째로 '자격 미확인'이었다.
   ⚠️ 표를 두지 않는다 — 글자만 집는다. 시·군·구 목록은 온보딩 화면(data.js)에만 있고,
      여기(서비스워커도 읽는 파일)에 두면 두 벌이 된다. */
/* ⚠️ 한국어는 조사가 이름에 **바로 붙는다**(`안양시에`). 그래서 '뒤가 한글이 아니면 끝'
   으로 자르면 하나도 못 집는다(처음에 그렇게 만들었다가 전부 놓쳤다).
   대신 **뒤에 올 수 있는 것**을 적어 경계를 잡는다 — 안 그러면 `학생구분` 의 `학생구`가
   시·군·구로 잡힌다. */
const CITY_RE = /([가-힣]{1,6}(?:시|군|구))(?=[에의를을는은이가와과로,·)\s]|$|민|청|내|외)/g;
/* 시·도 이름이 `시`로 끝나는 것들(대구광역시 등)과 갈래말은 시·군이 아니다 */
const CITY_NOT = /^(광역시|특별시|자치시|특별자치시|해당시|소재지|거주지|주소지|본인이|우리시|관할시)$/;
function parseResidence(t) {
  /* ⚠️ `주소를 둔` 의 `둔` 은 `두`+`ㄴ` 이 아니라 **한 글자**다 — `주소를?\s?두` 로 잡으려다
     `주소를 둔 광양보건대학교 재학생` 을 통째로 놓쳤다(한글은 음절이 미리 합쳐져 있다). */
  if (!/거주|주소|주민등록|시민|도민|군민|구민|관내|관할/.test(t)) return null;
  const prov = REGIONS.filter((r) => t.includes(r));
  const cities = [];
  CITY_RE.lastIndex = 0;
  let m;
  while ((m = CITY_RE.exec(t)) !== null) {
    const c = m[1];
    /* 시·도 이름은 시·군이 아니다 — `서울특별시`·`대구광역시`·`제주특별자치도` */
    if (CITY_NOT.test(c) || /(특별시|광역시|특별자치시)$/.test(c)) continue;
    if (REGIONS.includes(c.replace(/(시|군|구)$/, ''))) continue;
    if (!cities.includes(c)) cities.push(c);
  }
  /* `관내`는 **그 재단의 관할**을 뜻한다 — 어느 시·군인지는 줄만 봐서는 모르고
     공고를 낸 곳(주관 기관 이름)이 정한다. 판정기가 맥락으로 받는다. */
  const inArea = /관내|관할/.test(t);
  if (!prov.length && !cities.length && !inArea) return null;
  /* 🔴 거주 요건은 **예외를 달고 다닌다.** 실제 원문:
       `부·모 또는 보호자가 광양시에 1년 이상 주소를 둔 자
        ○ 대학생의 경우 본인에 한하여 관외 거주 인정`
     이걸 못 보면 광양 학생이 아닌 사람에게 ✕ 를 친다 — 틀린 미달은 못 받는 것보다 나쁘다.
     공용 HAS_EXCEPTION 은 `단,`·`다만` 만 알아서 이 꼴을 놓친다(공용이라 넓히지 않는다). */
  const RES_EXCEPT = /관외|본인에\s?한하여|예외|한하여\s?인정|단\s|다만/;
  return { kind: 'residence', anyOf: prov, cities, inArea,
    conf: (HAS_EXCEPTION.test(t) || RES_EXCEPT.test(t)) ? LOW : HIGH };
}

/* 🔴 **학교 이름이 걸린 요건** (2026-08-30 개발자 지적: "~대 학생은 제외 이런 요건 정도는
   다 할 수 있잖아"). 실제로 `현재 충남대학교 재학 중인 학부생` 에 한국외대 학생이
   **✓ 충족**으로 떠 있었다 — 우리가 학교를 아는데도 판정을 안 했다.
   🔴 **남 이야기와 가른다.** 같은 줄에 `충남대학교 학부 출신 교수의 추천` 이 있는데,
      그건 추천인 조건이지 학생 조건이 아니다. 그래서 학교 이름 **바로 뒤에 '재학·학생'** 이
      붙었을 때만 집고, 둘레에 `출신·교수·동문·졸업생` 이 있으면 버린다.
   ⚠️ `4년제 대학교`·`관내 대학` 같은 **갈래 이름은 학교가 아니다** — 넣으면 모든 공고가
      "그 학교가 아니다"로 미달이 된다(틀린 미달은 못 받는 것보다 나쁘다). */
const SCHOOL_GENERIC = /^(4년제|사년제|국내|해외|외국|관내|관외|소재|각급|각종|전문|일반|방송통신|사이버|원격|기술|산업|지방|수도권|정규|전국|국공립|사립|해당|타|본|우리|위|동|기타|상기|아래|모든|기타의)/;
/* 🔴 **단과대학은 학교가 아니다** (2026-08-30 전수 대조에서 잡았다).
   `가. 공과대학 재학생이며 …` 를 학교 이름으로 읽는 바람에, 자기 학교 공대 장학금인데
   **미달**로 뒤집혔다 — 틀린 미달은 못 받는 것보다 나쁘다. 학교 안의 단위는 전부 뺀다. */
const SCHOOL_COLLEGE = /^(공과|인문|사범|자연|자연과학|과학|경영|상경|경상|의과|치과|한의과|약학|간호|예술|미술|음악|체육|사회|사회과학|법과|법학|농과|농업|수의과|생활과학|정보|공학|국제|글로벌|융합|자유전공|첨단|바이오|보건|디자인|신학|생명|해양|항공|IT|ICT)대학?$/;
/* 🔴 안내 문장은 요건이 아니다 — `교환학생/방송대학생 별도 문의` 를 요건으로 읽으면
   방송대가 아닌 학생이 전부 미달이 된다. */
const SCHOOL_NOT_REQ = /문의|안내\s?사항|참고|별도\s?문의/;
const SCHOOL_NAME = /([가-힣]{2,12}(?:대학교|대학|대))\s*(?:에서|에|의|를|을)?\s*(?:재학생|재학|학부생|학생|다니는|소속)/g;
const SCHOOL_NOT_SELF = /(출신|교수|동문|졸업생|추천인|학부모|자녀의)/;
function parseSchool(t) {
  if (SCHOOL_NOT_REQ.test(t)) return null;
  const names = [];
  let m;
  SCHOOL_NAME.lastIndex = 0;
  while ((m = SCHOOL_NAME.exec(t)) !== null) {
    const name = m[1];
    if (SCHOOL_GENERIC.test(name) || SCHOOL_COLLEGE.test(name)) continue;
    const around = t.slice(Math.max(0, m.index - 10), m.index + m[0].length + 10);
    if (SCHOOL_NOT_SELF.test(around)) continue;
    if (!names.includes(name)) names.push(name);
  }
  if (!names.length) return null;
  return { kind: 'school', anyOf: names, conf: HAS_EXCEPTION.test(t) ? LOW : HIGH };
}

/* 🔴 **우리가 묻지도 않은 처지**를 확인했다고 말하지 않는다 (2026-08-30 개발자 지적:
   "판정할 수 없는 둘째 이상 자녀나 취약계층의 손자녀 이런 건 왜 체크해놨어").
   전수 대조에서 실제로 이런 줄들이 ✓ 로 떠 있었다 — 딸린 조건(국적·나이·재학) 하나가
   맞았다는 이유로:
     `취약계층 국민연금수급자 또는 그 자녀(손자녀)로서 … 재학 중인 자`
     `보호자가 6개월 이상 원주시에 거주하는 만 24세 이하의 둘째아 이상 자녀`
     `세대주가 만 65세 이하`   `산업체근로자 … 대학에 재학 중인 자`
   프로필에 칸이 아예 없는 처지들이라 **모른다고 두는 것**이 맞다.
   ⚠️ 우리가 묻는 처지(기초생활·차상위·다자녀·장애·한부모·보훈·북한이탈·다문화)는
      flags 조건으로 잡히므로 여기서 막지 않는다 — 막으면 진짜 판정까지 사라진다. */
const UNASKED_ATTR = /(둘째|셋째|넷째|막내|손자녀|조손|유자녀|유족|세대주|부양\s?가족|고아|위탁\s?가정|소년소녀|보호\s?종료|자립\s?준비|의사자|의상자|농어촌|농업인|어업인|귀농|귀어|소상공인|중소기업|재직자?|근로자|취약\s?계층|저소득|사회적\s?배려|가정\s?형편|생계|수급자|(도민|시민|군민|구민|주민)의\s?자녀)/;
function unaskedAttr(text, conds) {
  if (!UNASKED_ATTR.test(String(text || ''))) return false;
  return !(conds || []).some((c) => c.kind === 'flags');
}

/* 한 줄에서 조건을 전부 뽑는다. `isExclude`면 '이러면 안 된다'로 읽는다. */
function parseLine(line, isExclude) {
  const t = String(line || '');
  if (!t.trim()) return { conds: [], multiProgram: false };
  const conds = [];
  const push = (c) => { if (c) conds.push(c); };
  push(parseGrade(t)); push(parseBracket(t)); push(parseCredits(t)); push(parseYear(t));
  push(parseStatus(t, isExclude)); push(parseFlags(t)); push(parseNationality(t));
  push(parseAge(t)); push(parseResidence(t)); push(parseSchool(t));
  if (isExclude) conds.forEach((c) => { c.exclude = true; });
  return { conds, multiProgram: MULTI_PROGRAM.test(t) };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { parseLine, gradOnly, GRADE_SCALE, STATUSES, HIGH, LOW, MULTI_PROGRAM, HAS_EXCEPTION, caseBranch, unaskedAttr, REGIONS};
}

/* ── 경우별 분기 (2026-08-24 개발자 지적) ─────────────────────────────────
   *"난 재학생(신입생)으로 했는데 복학생 및 편입생에도 체크 표시가 되어 있네."*

   공고는 같은 기준을 **학적 경우별로** 나눠 적는다(정읍시민장학재단):
     신입생: 2026년 1학기 85점 이상
     재학생: 2025년 2학기와 2026년 1학기 각각 85점 이상
     복학생 및 편입생<2026년 1학기 해당자>: 2026년 1학기 85점 이상
     학년제 성적 산출 대학생: 2025학년도 1년 성적 85점 이상
   이건 **네 개의 요건이 아니라 한 요건의 네 가지 경우**다. 한 학생에게는 하나만 해당한다.
   그런데 줄마다 따로 판정해서 재학생인데 `신입생:` 줄에도 ✓가 붙고, 분모도 4로 부풀었다.

   🔴 프로필에 없는 경우(편입생·재입학생·학년제)는 **빈 목록**을 준다 —
      해당 여부를 모르므로 ✓도 ✕도 치지 않는다(모르면 판정하지 않는다).
   ───────────────────────────────────────────────────────────────────── */
const CASE_STATUS = [
  [/^신입생/, ['신입학']],
  [/^재학생/, ['재학', '초과학기', '졸업유예']],
  [/^복학생/, ['복학예정']],
  [/^편입생|^재입학생/, []],
  [/^학년제/, []],
];

/** 이 줄이 '경우별 분기'인가 — 맞으면 그 경우에 해당하는 학적상태 목록, 아니면 null */
function caseBranch(text) {
  const t = String(text || '').trim();
  /* 이름표가 줄 맨 앞에 있고 **콜론이 곧 따라와야** 분기다.
     `직전학기 성적기준: 80점…`처럼 앞말이 다르면 분기가 아니다. */
  const head = t.split(/[:：]/)[0];
  if (head === t || head.length > 26) return null;
  for (const [re, statuses] of CASE_STATUS) if (re.test(head)) return statuses;
  return null;
}

/* ============================================================
   한대장 — 자격 확인 도우미: 무엇을 물을까 (2026-09-17 · 노션 AI-1)
   ------------------------------------------------------------
   🔴 이 파일이 있는 이유 (실측 2026-09-17):

     마감 안 지난 등록 공고 20건의 자격 줄 70줄 중, 온보딩을 빠짐없이 채운 학생은
     19줄을 판정받고 **필수만 채운 학생은 4줄**을 판정받는다. 못 읽는 원인은 파서가
     아니라 **학생이 비워 둔 프로필 칸**이었다. 그 칸을 필요해진 자리에서 묻는다.

     ⚠️ 백로그 원문("못 읽는 자격은 물어본다")을 글자 그대로 만들면 안 된다 —
        그 70줄 중 29줄은 **애초에 자격이 아니라** 우편 접수 주소·`2. 신청자격` 같은
        절 제목·초중고 대상이다. 학생에게 우편 주소를 물어보게 된다.

   🔴 이 파일의 심장 — **채워도 판정이 안 바뀌는 줄에는 묻지 않는다.**
     `평점평균(백분율환산)이 85점 이상` 은 평점을 적어도 그 줄이 안 풀리고,
     `신입생:` 줄은 재학생에게 영영 판정되지 않는다. 거기에 단추를 달면
     학생이 적었는데 화면이 그대로다 — 묻지 않는 것보다 나쁘다.

     그래서 규칙표를 손으로 적지 않고 **화면이 쓰는 `requirementMatch` 를 그대로
     탐침한다.** 규칙이 갈라질 수가 없고, 파서가 좋아지면 물을 수 있는 줄이 저절로 는다.

   🔴 여기서 사실을 만들지 않는다. 정하는 것은 **무엇을 물을까**이지 답이 아니다.

   브라우저·Node 겸용 (match-engine.js·essay-ask.js 와 같은 방식) —
   화면과 검사가 같은 파일로 같은 결과를 봐야 한다.
   설계: docs/designs/eligibility-ask.md · 관문: verify/test-collector.mjs 「자격 묻기」 절
   ============================================================ */

/* 판정기 — 브라우저는 전역, Node는 require.
   ⚠️ `window.requirementMatch` 로 찾으면 안 된다(서비스워커에는 window 가 없다).
   🔴 아래 전역 이름 목록에 빠뜨리면 **Node 검사는 다 통과하는데 앱이 죽는다** —
      match-engine 이 `unaskedAttr` 로 실제로 그렇게 죽었다(2026-08-24).
   🔴 **화면이 쓰는 그 함수 하나만** 쓴다. judgeCond 로 내려가면 경우별 분기·표 라벨·
      선택지 묶음 관문을 건너뛰어, 재학생에게 `신입생:` 줄의 평점을 묻게 된다. */
const EA_ME = (typeof module !== 'undefined' && module.exports)
  ? Object.assign({}, require('./match-engine.js'), { parseLine: require('./parse-requirements.js').parseLine, REGION_CITIES: require('./parse-requirements.js').REGION_CITIES })
  : { requirementMatch, RESIDENCE_SPANS, parseLine, REGION_CITIES };

/* 물어볼 수 있는 칸과 그 **탐침 값**.
   🔴 칸 이름은 app.js `collectProfile()` 이 만드는 이름과 반드시 같아야 한다 —
      다르면 시트가 엉뚱한 칸에 저장하고 판정은 영영 안 바뀐다(관문이 대조한다).
   🔴 값은 양 끝을 넣는다. 한쪽이라도 줄을 풀면 물을 수 있는 칸이다.
      ⚠️ 양쪽 다 요구하면(엄격) 멀쩡한 경우가 통째로 죽는다 — `3.5/4.5 이상` 줄에
         평점 0 을 넣으면 judgeCond 가 'fail' 이 아니라 'unknown' 을 내기 때문이다(실측).
   ⚠️ 이 값들은 **화면에 안 나간다.** 판정이 달라지는지 보려고 잠깐 넣어 보는 것뿐이다.
   ⚠️ 여기 없는 것(학교·학년·학적)은 온보딩 필수라 늘 차 있다. */
const FIELD_PROBE = {
  gpa: [0, 4.5],
  credits: [0, 24],
  bracket: [1, 10],
  birthYear: [1980, 2010],
  nationality: ['korean', 'foreign'],   // 🔴 프로필·엔진이 쓰는 값 그대로(index.html #in-nationality · match-engine `p.nationality === c.eq`) — 2026-11-15 까지 '대한민국'·'기타' 라 고르면 한국 학생이 ✕ 가 됐다(리뷰)
  major: ['국어국문학과', '기계공학과'],
  region: ['서울', '전남'],
  regionCity: ['종로구', '무안군'],
  parentRegion: ['서울', '전남'],
  parentRegionCity: ['종로구', '무안군'],
  /* 출신 고교 소재지 (2026-10-24) — match-engine 이 `about:'origin'` 줄을 이 둘로 본다(맞으면 ✓ · 아니면 모름) */
  originRegion: ['서울', '전남'],
  originCity: ['종로구', '무안군'],
  /* 지금 주소에 산 지 (2026-11-13) — 칸의 하한 개월. 양 끝(1년 미만 · 10년 이상)으로 `n년 이상 계속 거주` 줄이 풀리는지 본다(match-engine RESIDENCE_SPANS) — 풀리는 것은 10년 이상의 ✓ 뿐이다(모자라도 ✕ 는 안 낸다 · 2026-11-13 리뷰) */
  residenceMonths: [0, 120],
};

/* 🔴 학적정보에 **있는데 여기 없는 칸**과 그 이유 (2026-09-18 개발자 지시):
     · 특별자격(flags)·보유 장학금(scholarships) — **온보딩에서 이미 고르는 것**이라
       여기서 또 띄우지 않는다("굳이 또 화면을 두번 띄울 필요는 없을 것 같고").
       여러 개를 고르는 칸이라 화면도 무겁고, 프로필 수정으로 가면 될 일이다.
     · school·campus·year·status·track — 온보딩 필수라 늘 차 있다
     · cert·exchange — 체크박스 한 칸이라 `false` 가 '아니오'인지 '안 답함'인지
       값만으로 갈리지 않는다. 실측으로 여는 줄도 0이라 넣지 않았다. */

/* 🔴 처지(trait) — **프로필에 칸이 없던 개인 사정** (2026-09-18 개발자 지시).
   "평점 말고 개인적인 부분들 있잖아 뭐 예를들면 스님인지 그런거".
   실측: 개인 처지를 말하는 자격 줄 75개 중 **68개**를 못 풀고 있었다.
   종류는 `parse-requirements.js` 의 `TRAIT_PAT` 한 곳이 정한다 — 여기는 **칸 이름만** 갖는다.
   ⚠️ 거기에 종류를 더하면 여기도 같이 더한다(이름이 없으면 화면에 못 그린다). 관문이 대조한다.
   🔴 **말은 명사형이다** (2026-09-18 개발자 지시: "결혼하셨나요? 보다는 혼인 여부 이런식으로") —
      다른 칸(`평점`·`직전 학기 이수학점`)과 같은 결이어야 한 목록으로 읽힌다. */
const TRAIT_LABEL = {
  award:     '대회·공모전 수상',
  married:   '혼인 여부',
  job:       '재직 여부',
  career:    '특정 분야 진출 희망',
  farm:      '농어촌·농어업 가정',
  dorm:      '기숙사 입사',
  military:  '군 복무',
  ged:       '검정고시 졸업',
  religion:  '해당 종교',
  member:    '단체 회원 (본인·부모)',
  volunteer: '봉사활동 실적',
  cert:      '자격증·어학 성적',
  /* 2026-09-19 — 자격 글 540줄 전수 대조로 늘린 여덟. 걸린 줄 수는 설계 문서 6절. */
  discipline: '징계 이력',
  loan:       '학자금대출 이용',
  club:       '동아리·학생단체 활동',
  disaster:   '재난·재해 피해',
  birthOrder: '둘째 이상 자녀',
  bereaved:   '가족 사망 · 유가족',
  sailor:     '선원 · 선원 가족',
  diabetes:   '당뇨 진단',
  /* 2026-10-15 · 노션 G-14 결정 ② — 「이번 학기 국가장학금을 신청했나요」를 명사형으로. 걸리는 줄은 parse-requirements TRAIT_PAT 참조 */
  kosafApplied: '이번 학기 국가장학금 신청',
  fullTuition:  '이번 학기 등록금 전액 장학·면제',   // 2026-11-13 · 선조치 후 보고 — 늘 결격(「예」 ✕ · 「아니요」 통과 · parse-requirements TRAIT_DISQUALIFY)
  careLeaver:   '자립준비청년 (보호 종료)',   // 2026-10-31 · 2단계 전수 — 진짜 요건 3곳(등록 1 · 재단 1 · 활동 1) · 2026-11-09 개발자 결정으로 온보딩에도(위 ONBOARD_TRAITS)
};

/* 🔴 온보딩 「적합도 높이기」 단계가 **처음부터** 묻는 처지 (2026-10-24 · 개발자 지시 "수집된 공고를 모아 적합도 고도화
   질문을 고안 · 최대한 클릭형"). 공고 안에서 묻는 것(위)과 **같은 칸(p.traits)** 에 저장된다 — 판정 규칙을 새로 만들지 않는다.
   고른 기준: 지금 열린 공고(정식 등록 107 + 층2 129 + 대외활동 163 · 2026-10-24 실측 · 설계 문서 academic-info-tailoring.md)에서
   **4곳 이상**이 묻는 처지. 걸린 공고 수 — award 17 · kosafApplied 11 · discipline 10 · job 10 · volunteer 6 · dorm 4 · military 4.
   ⚠️ 3곳 이하(birthOrder·farm·loan 각 3 · 나머지 1~2)는 공고 안에서만 묻는다 — 온보딩을 길게 만들 만큼 자주 나오지 않는다.
   ⚠️ 여기 적는 종류는 TRAIT_LABEL·TRAIT_PAT 에 있어야 한다(관문이 대조한다). 순서가 화면 순서다. */
const ONBOARD_TRAITS = ['award', 'kosafApplied', 'discipline', 'job', 'dorm', 'military', 'loan', 'careLeaver', 'fullTuition'];
/* 2026-11-15 개발자 결정("빼 주세요") — 봉사활동 실적(volunteer)을 뺐다. 같은 날 봉사 규칙을 '해 둔 실적을 말할 때만' 으로 좁히자(parse-requirements TRAIT_PAT)
   걸리는 공고가 9곳 → 2곳이 됐다(나머지 7곳은 `봉사활동 가능자`·`…에 관심 있는 대학생` 처럼 요구가 아닌 줄이었다) — 잣대 「4곳 이상」 아래다.
   그 두 공고에서는 공고 안 「미확인 자격」이 그대로 묻는다 · 이미 답해 둔 학생의 답(traits.volunteer)은 지우지 않는다(collectProfile 이 물려받는다). */
/* 2026-11-13 fullTuition(이번 학기 등록금 전액 장학·면제 · 선조치 후 보고) — 열린 공고 4곳(층2 거창군·안산 반값·등록금 지원사업·다자녀가정 — 모두 제외 칸)이라 위 잣대 「4곳 이상」에 들어 더했다.
   ⚠️ 넷 다 **제외 칸**이라 공고 안 「미확인 자격」(자격 줄만 탐침)에서는 안 물린다 — 온보딩이 이 처지를 묻는 유일한 자리다. 3곳 이하로 줄면 집계가 「4곳 미만인데 묻는 것」으로 알린다 */
/* 2026-11-09 개발자 결정("질문에 넣어") — 전수 집계가 「4곳 이상인데 안 묻는 것: loan 5 · careLeaver 4」 를 알린 뒤 둘을 더했다(loan 은 대출 이자 지원 장학 · careLeaver 는 자립준비청년 전용).
   careLeaver 는 그 뒤 3곳으로 줄었지만 개발자가 직접 넣으라 한 것이라 둔다 — 집계가 「4곳 미만인데 묻는 것」으로 적으면 사람이 다시 본다. */
/* (옛 판단 · 2026-11-09 개발자 결정으로 바뀜) 2026-10-31 — careLeaver(자립준비청년) 종류를 더했지만 온보딩에는 넣지 않았다: 집계가 4곳으로 셌으나 그중 하나는 국가근로의
   「자립준비청년인 경우 성적 기준 적용 제외」(면제 안내)라 진짜 요건은 3곳이다(리뷰). 공고 안에서만 묻는다.
   `node verify/eligibility-coverage.mjs --brief` 가 수집 리포트에 「4곳 이상인데 안 묻는 것 / 4곳 미만인데 묻는 것」을 ⚠️ 로 적는다 — 목록을 고치는 것은 사람이다. */

/* 칸 하나를 화면에 그리는 데 필요한 것.
   🔴 `label` 은 칸 이름이지 문장이 아니다. 여기에 설명을 넣지 말 것
      (화면에 새로 넣는 한국어를 늘리지 않는다 — 설계 3-3). */
const FIELD_META = {
  gpa:         { label: '평점', kind: 'number', suffix: '/ 4.5', min: 0, max: 4.5, step: 0.01 },
  credits:     { label: '직전 학기 이수학점', kind: 'number', min: 0, max: 30, step: 1 },
  bracket:     { label: '학자금 지원구간', kind: 'number', min: 0, max: 10, step: 1 },
  birthYear:   { label: '태어난 해', kind: 'number', min: 1940, max: 2020, step: 1 },   // 온보딩·DB(0004)·input-guard 와 같은 범위 (2026-11-17 · 1950~2015 였다)
  /* 값은 온보딩 선택 칸(index.html #in-nationality)과 같은 코드 · 이름표도 그 글자 그대로 */
  nationality: { label: '국적', kind: 'select', options: [{ value: 'korean', label: '대한민국' }, { value: 'foreign', label: '외국인 유학생' }, { value: 'dual', label: '복수국적 · 영주권' }] },
  major:       { label: '학과', kind: 'text' },
  /* 🔴 시·도는 **고르는 칸** (2026-11-15 리뷰) — 글자로 받으면 「서울특별시」·「경기도」 가 온보딩 값(서울·경기)과 달라 틀린 ✕ 가 나고 학적정보 수정 화면의 선택 칸이 비어 저장 때 지워진다.
     선택지는 판정이 쓰는 표(parse-requirements REGION_CITIES 의 시·도) 그대로 · `city` 는 시·도가 바뀌면 함께 비울 짝 칸(다른 시·도의 구가 남지 않게 — app.js eligAskCollect) */
  region:      { label: '거주 시·도', kind: 'select', options: Object.keys(EA_ME.REGION_CITIES || {}), city: 'regionCity' },
  regionCity:  { label: '거주 시·군·구', kind: 'text' },
  parentRegion:     { label: '부모 거주 시·도', kind: 'select', options: Object.keys(EA_ME.REGION_CITIES || {}), city: 'parentRegionCity' },
  parentRegionCity: { label: '부모 거주 시·군·구', kind: 'text' },
  originRegion:     { label: '출신 고교 시·도', kind: 'select', options: Object.keys(EA_ME.REGION_CITIES || {}), city: 'originCity' },
  originCity:       { label: '출신 고교 시·군·구', kind: 'text' },
  /* 🔴 값이 **숫자**인 선택 칸 — 선택지는 match-engine RESIDENCE_SPANS 한 곳(온보딩 칩과 같은 칸 · 베끼면 칸이 갈라진다). 저장값은 칸의 하한 개월 */
  residenceMonths:  { label: '지금 주소 거주 기간', kind: 'select', numeric: true,
    options: (EA_ME.RESIDENCE_SPANS || []).map((s) => ({ value: String(s.months), label: s.label })) },
};

/* 이 칸에 학생이 **답을 준 적이 있나**.
   🔴 여러 개를 고르는 칸은 `[]` 가 두 가지 뜻이다 — '해당 없음' 과 '아직 안 물음'.
      값만으로는 갈리지 않으므로 답한 사실을 `<칸>Asked` 표식으로 따로 적는다.
      (`scholarships` 는 온보딩이 이미 `null`=안 물음 / `[]`=없음 으로 갈라 둔다) */
function answered(p, key) {
  const v = p[key];
  if (Array.isArray(v)) return v.length > 0 || p[key + 'Asked'] === true;
  return v !== null && v !== undefined && v !== '';
}

/* 이 줄을 푸는 프로필 칸이 무엇인가 → ['gpa', 'credits']
   빈 배열이면 물을 것이 없다(= 단추를 달지 않는다).

   🔴 **판정이 났으면 묻지 않는다** — 충족('ok')이든 미달('no')이든 마찬가지다.
      `=== 'ok'` 로 보면 이미 미달로 답이 난 줄에 또 적으라는 단추가 붙는다.

   ⚠️ 알려진 천장: 어떤 칸은 **탐침 값으로는 풀리는데 학생의 실제 값으로는 안 풀릴** 수
      있다. 그때는 적어도 그 줄이 흐린 채 남는다(틀린 말을 하지는 않는다). 실측 8줄에서는
      그런 경우가 없었고, 막으려면 칸마다 판정 가능 구간을 적어야 해서 하지 않는다. */
/* 이 줄이 말하는 조건 종류로 **탐침할 칸을 좁힌다** (2026-11-15 · 대외활동 관문 「내 정보」).
   줄 하나를 칸 13개 × 2 + 처지 23개 × 2 로 다 찔러 보면 100ms 안팎이라, 보이는 글 전부(400줄)를 세는 관문이 3초쯤 멈췄다(리뷰 실측).
   조건 종류(parse-requirements parseLine)가 읽는 칸만 남긴다 — **좁히기만 한다**: 판정은 여전히 탐침이 하고, 모르는 종류가 섞이면 null(= 전부 탐침).
   실측(활동 + 정식 등록 2,598줄): 전부 탐침과 다른 줄 3 — 모두 조건이 없는 줄에 탐침이 헛걸린 것(학년 줄의 `학과` 등)이라 안 묻는 쪽이 맞다.
   ⚠️ 공고 안 「미확인 자격」(askableForSch 기본)은 예전대로 전부 탐침한다 — 넘겨받을 때만 좁힌다. */
const KIND_FIELDS = { age: ['birthYear'], grade: ['gpa'], credits: ['credits'], bracket: ['bracket'], nationality: ['nationality'], major: ['major'],
  residence: ['region', 'regionCity', 'parentRegion', 'parentRegionCity', 'originRegion', 'originCity', 'residenceMonths'] };
const KIND_NO_FIELD = ['open', 'degree', 'scholarship', 'year', 'semester', 'cert', 'status', 'flags', 'school'];   // 묻는 칸이 없는 종류(온보딩 필수 칸·여러 개 고르는 칸)
function probeKeysFor(line) {
  let conds;
  try { conds = EA_ME.parseLine(line).conds || []; } catch (e) { return null; }
  const out = [];
  for (const c of conds) {
    if (c.kind === 'trait') { if (!(c.anyOf || []).length) return null; c.anyOf.forEach((t) => out.push('trait:' + t)); }
    else if (KIND_FIELDS[c.kind]) out.push(...KIND_FIELDS[c.kind]);
    else if (KIND_NO_FIELD.indexOf(c.kind) === -1) return null;
  }
  return out;
}

/* 처지 칸 이름 — 단체 회원은 그 단체 이름으로(parse-requirements memberOrgOf · `member:<단체>` 열쇠) */
function traitLabel(key) {
  if (TRAIT_LABEL[key]) return TRAIT_LABEL[key];
  const m = /^member:(.+)$/.exec(String(key || ''));
  return m ? `${m[1]} 회원·소속 (본인·부모)` : String(key || '');
}

function askableFields(line, profile, sch, only) {
  const p = profile || {};
  if (only && !only.length) return [];                    // 좁혔더니 물을 칸이 없는 줄 — 판정기를 부르지 않는다
  if (EA_ME.requirementMatch(line, p, sch)) return [];   // 지금도 판정된다
  const out = [];
  for (const key of Object.keys(FIELD_PROBE)) {
    if (only && only.indexOf(key) === -1) continue;        // 이 줄이 읽지 않는 칸
    if (answered(p, key)) continue;                        // 이미 답했다
    for (const v of FIELD_PROBE[key]) {
      const trial = Object.assign({}, p);
      trial[key] = v;
      if (EA_ME.requirementMatch(line, trial, sch)) { out.push(key); break; }
    }
  }
  /* 처지도 같은 방식으로 탐침한다 — 예/아니요를 넣어 본다.
     🔴 이름은 `trait:<종류>` 로 돌려준다(프로필 칸 이름과 섞이지 않게).

     🔴 **어느 답으로도 충족이 될 수 없으면 묻지 않는다** (2026-09-19 코드 리뷰).
        위 스칼라 칸과 여기가 다른 점이다. 처지는 **답해서 나아질 수 없는데 나빠지기만
        하는 질문**이 생긴다 — 줄의 다른 낱말을 앱이 영영 못 읽으면(`추천을 받은`)
        「예」는 여전히 '모름'이고 「아니요」만 미달이 된다. 실측으로 수상 15줄 중 12줄이
        그 꼴이었다. 학생에게 자기를 떨어뜨리는 것밖에 못 하는 단추를 주지 않는다. */
  const tr = (p.traits && typeof p.traits === 'object') ? p.traits : {};
  /* 단체 회원 열쇠(`member:<단체>`)는 줄마다 다르다 — 이 줄이 읽는 열쇠를 더한다 */
  const lineKeys = (probeKeysFor(line) || []).filter((k) => k.indexOf('trait:member:') === 0).map((k) => k.slice(6));
  for (const key of Object.keys(TRAIT_LABEL).concat(lineKeys)) {
    if (only && only.indexOf('trait:' + key) === -1) continue;
    if (typeof tr[key] === 'boolean') continue;            // 이미 답했다
    const verdicts = [true, false].map((v) => EA_ME.requirementMatch(
      line, Object.assign({}, p, { traits: Object.assign({}, tr, { [key]: v }) }), sch));
    if (verdicts.includes('ok')) out.push('trait:' + key);
  }
  return out;
}

/* 이 공고에서 물을 수 있는 칸 전부 (자격 줄을 다 훑어 중복 제거).
   ⚠️ 자격 줄이 없는 공고(층2 KOSAF·상시 제도)에서도 죽지 않아야 한다 — 빈 배열을 낸다. */
function askableForSch(sch, profile, narrow) {
  const lines = (sch && sch.eligibilityLines) || [];
  const out = [];
  for (const line of lines) {
    for (const k of askableFields(line, profile, sch, narrow ? probeKeysFor(line) : null)) {
      if (out.indexOf(k) === -1) out.push(k);
    }
  }
  return out;
}

/* 입력 문자열 → 프로필에 넣을 값.
   🔴 못 읽으면 **0 이 아니라 null** 이다. 0 을 넣으면 '평점 0.0' 인 학생이 되어
      멀쩡한 공고가 전부 미달로 뒤집힌다(모르면 판정하지 않는다).
   ⚠️ 다만 학생이 **정말 0 을 적은 것**은 유효한 값이다(0학점·0구간) — 빈 칸과 다르다. */
function coerceField(key, raw) {
  const meta = FIELD_META[key];
  if (!meta) return null;
  /* 여러 개를 고르는 칸은 고른 것들의 배열이 그대로 값이다 — 아무것도 안 골랐으면
     `[]`(= 해당 없음)이고, 답했다는 사실은 화면이 `<칸>Asked` 로 적는다. */
  if (meta.kind === 'checks') return Array.isArray(raw) ? raw.slice() : [];
  const s = String(raw == null ? '' : raw).trim();
  if (s === '') return null;
  /* 숫자 값 선택 칸(거주 기간) — 선택지에 있는 값만 받는다(없는 값은 null = 모름) */
  if (meta.kind === 'select' && meta.numeric) {
    return meta.options.some((o) => (o.value != null ? o.value : o) === s) ? Number(s) : null;
  }
  if (meta.kind === 'number') {
    const n = parseFloat(s);
    if (Number.isNaN(n)) return null;
    const lo = meta.min == null ? -Infinity : meta.min;
    const hi = meta.max == null ? Infinity : meta.max;
    /* 🔴 범위 밖은 **깎지 않고 null(모름)** (2026-11-17). 예전엔 5.0 → 4.5 로 깎아 학생이 적지 않은
       값을 지어냈다(원칙 8-1). 화면은 칠 때부터 막으므로(input-guard.js) 여기는 마지막 방어다.
       정수 칸에 소수가 오면 반올림하지 않고 역시 null — 19.5학점을 20학점으로 바꾸지 않는다. */
    if (n < lo || n > hi) return null;
    if (meta.step === 1 && !Number.isInteger(n)) return null;
    return n;
  }
  return s;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { askableFields, askableForSch, probeKeysFor, coerceField, answered, FIELD_META, FIELD_PROBE, TRAIT_LABEL, ONBOARD_TRAITS, traitLabel };
}

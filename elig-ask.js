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
  ? require('./match-engine.js')
  : { requirementMatch };

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
  nationality: ['대한민국', '기타'],
  major: ['국어국문학과', '기계공학과'],
  region: ['서울', '전남'],
  regionCity: ['종로구', '무안군'],
  parentRegion: ['서울', '전남'],
  parentRegionCity: ['종로구', '무안군'],
};

/* 🔴 학적정보에 **있는데 여기 없는 칸**과 그 이유 (2026-09-18 개발자 지시):
     · 특별자격(flags)·보유 장학금(scholarships) — **온보딩에서 이미 고르는 것**이라
       여기서 또 띄우지 않는다("굳이 또 화면을 두번 띄울 필요는 없을 것 같고").
       여러 개를 고르는 칸이라 화면도 무겁고, 프로필 수정으로 가면 될 일이다.
     · school·campus·year·status·track — 온보딩 필수라 늘 차 있다
     · cert·exchange — 체크박스 한 칸이라 `false` 가 '아니오'인지 '안 답함'인지
       값만으로 갈리지 않는다. 실측으로 여는 줄도 0이라 넣지 않았다. */

/* 칸 하나를 화면에 그리는 데 필요한 것.
   🔴 `label` 은 칸 이름이지 문장이 아니다. 여기에 설명을 넣지 말 것
      (화면에 새로 넣는 한국어를 늘리지 않는다 — 설계 3-3). */
const FIELD_META = {
  gpa:         { label: '평점', kind: 'number', suffix: '/ 4.5', min: 0, max: 4.5, step: 0.01 },
  credits:     { label: '직전 학기 이수학점', kind: 'number', min: 0, max: 30, step: 1 },
  bracket:     { label: '학자금 지원구간', kind: 'number', min: 0, max: 10, step: 1 },
  birthYear:   { label: '태어난 해', kind: 'number', min: 1950, max: 2015, step: 1 },
  nationality: { label: '국적', kind: 'select', options: ['대한민국', '기타'] },
  major:       { label: '학과', kind: 'text' },
  region:      { label: '거주 시·도', kind: 'text' },
  regionCity:  { label: '거주 시·군·구', kind: 'text' },
  parentRegion:     { label: '부모 거주 시·도', kind: 'text' },
  parentRegionCity: { label: '부모 거주 시·군·구', kind: 'text' },
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
function askableFields(line, profile, sch) {
  const p = profile || {};
  if (EA_ME.requirementMatch(line, p, sch)) return [];   // 지금도 판정된다
  const out = [];
  for (const key of Object.keys(FIELD_PROBE)) {
    if (answered(p, key)) continue;                        // 이미 답했다
    for (const v of FIELD_PROBE[key]) {
      const trial = Object.assign({}, p);
      trial[key] = v;
      if (EA_ME.requirementMatch(line, trial, sch)) { out.push(key); break; }
    }
  }
  return out;
}

/* 이 공고에서 물을 수 있는 칸 전부 (자격 줄을 다 훑어 중복 제거).
   ⚠️ 자격 줄이 없는 공고(층2 KOSAF·상시 제도)에서도 죽지 않아야 한다 — 빈 배열을 낸다. */
function askableForSch(sch, profile) {
  const lines = (sch && sch.eligibilityLines) || [];
  const out = [];
  for (const line of lines) {
    for (const k of askableFields(line, profile, sch)) {
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
  if (meta.kind === 'number') {
    const n = parseFloat(s);
    if (Number.isNaN(n)) return null;
    const lo = meta.min == null ? -Infinity : meta.min;
    const hi = meta.max == null ? Infinity : meta.max;
    const clamped = Math.min(hi, Math.max(lo, n));
    return meta.step === 1 ? Math.round(clamped) : clamped;
  }
  return s;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { askableFields, askableForSch, coerceField, answered, FIELD_META, FIELD_PROBE };
}

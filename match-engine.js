/* ============================================================
   한대장 — 공유 매칭 엔진
   앱 화면(app.js)과 서비스워커(sw.js, 백그라운드 알림)가 **같은 규칙**을 쓰도록
   자격 판정을 이 파일 한 곳에 둔다. 규칙이 바뀌면 화면과 알림이 동시에 바뀐다.
   (소급 적용 원칙 — 엔진이 두 벌이면 알림만 옛 기준으로 남는 사고가 난다)
   ============================================================ */

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
    const has = e.flagsAny.some((f) => flags.includes(f));
    if (!has) { ok = false; reasons.push('해당 특별자격(수급자·다자녀·보훈 등)이 필요해요'); }
    else reasons.push('특별자격 요건 충족');
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

  if (!ok) return { status: 'ineligible', reasons, missing };
  if (missing.length) return { status: 'unknown', reasons, missing };
  if (e.selective) return { status: 'selective', reasons, missing };
  return { status: 'eligible', reasons, missing };
}

/* 적합도 점수 (0~99) — 정렬용 */
function fitScore(sch, result, p) {
  if (result.status === 'ineligible') return 0;
  const e = sch.eligibility || {};
  let score = 62;
  const condCount = ['minGpa', 'maxBracket', 'years', 'tracks', 'flagsAny', 'seoulOnly', 'needCert', 'exchange', 'freshmanOnly', 'schoolOnly']
    .filter((k) => e[k] != null && e[k] !== false).length;
  score += Math.min(15, condCount * 3);
  if (result.status === 'selective') score -= 8;
  if (result.status === 'unknown') score -= 22;
  if (e.minGpa != null && p.gpa != null) score += Math.min(12, Math.max(0, Math.round((p.gpa - e.minGpa) * 10)));
  if (e.maxBracket != null && p.bracket != null) score += Math.min(6, e.maxBracket - p.bracket);
  if (e.flagsAny) score += 6;
  return Math.max(5, Math.min(99, score));
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

/* Node(검증 스크립트)에서도 같은 엔진을 불러 쓸 수 있게 — 브라우저·서비스워커에는 영향 없음 */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { evaluate, fitScore, scopedToProfile, notStale, STALE_DAYS };
}

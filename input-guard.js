/* 입력 안전장치 — 학생이 **있을 수 없는 값**을 칸에 넣지 못하게 한다 (2026-11-17 · 업무 요청서 HDJ-요청-2026-001 후속)

   요청: "성적 999 같은 값은 입력조차 안 되게."
   그 전에는 막는 곳이 서버(DB 검문 0004) 하나뿐이었다. 그래서 —
     · 평점 999 → 앱이 **말없이 4.5 로 깎아** 저장했다(학생 모르게 만점 학생이 됨 — 지어낸 값)
     · 학점 999 · 출생연도 3000 → 폰 안에 그대로 저장돼 폰 안의 자격 판정이 그 값으로 돌았다
       ('15학점 이상'·'만 30세 이하'가 전부 ✓). 서버 저장만 거절됐다.
   입력칸의 min/max 는 **표시일 뿐** 브라우저가 타이핑을 막지 않는다 — 그래서 이 파일을 만들었다.

   세 겹:
     ① 칠 때 막는다   — guardText: 범위를 넘게 되는 글자는 칸에 안 들어간다(붙여넣기·자동완성 포함).
     ② 넘길 때 막는다 — checkNumber: 다 못 친 값(출생연도 '19')은 ①로 못 막으니 '다음'·'저장'에서 짚는다.
     ③ 이미 있는 값   — scrubProfileNumbers: 예전에 저장된 999 는 그 칸만 비운다(모름). **고쳐 넣지 않는다.**

   🔴 범위 숫자는 PROFILE_LIMITS 한 곳이다. 같은 숫자가 index.html 입력칸 min/max · DB 검문(0004) ·
      대신 접수 서버(apply-guard) · elig-ask FIELD_META 에도 있고, verify/test-collector.mjs 가 다섯 곳을
      대조한다. 한 곳만 넓히면 정상 학생의 저장이 서버에서 거절된다.
   🔴 범위를 넘는 값을 **가장 가까운 값으로 깎지 말 것.** 깎으면 학생이 적지 않은 값(4.5)을 우리가
      지어낸다(원칙 8-1). 넘으면 막거나 비운다.
   브라우저·Node 겸용(match-engine.js 와 같은 방식) — 화면과 검사가 같은 함수를 쓴다. */

const PROFILE_LIMITS = {
  gpa:       { min: 0,    max: 4.5,  decimals: 2, label: '평점',     unit: '' },
  credits:   { min: 0,    max: 30,   decimals: 0, label: '이수학점', unit: '학점' },
  birthYear: { min: 1940, max: 2020, decimals: 0, label: '태어난 해', unit: '년' },
};

/* 숫자 칸의 글자 모양 — 숫자와 (허용될 때) 점 하나, 소수 자릿수까지만 */
function numberShapeOk(text, decimals) {
  const re = decimals > 0 ? new RegExp('^\\d*(\\.\\d{0,' + decimals + '})?$') : /^\d*$/;
  return re.test(text);
}

/* 지금까지 친 글자에 **더 쳐서** 범위 안 값이 될 수 있는가.
   예) 출생연도 '1' → 1940~1999 가 될 수 있다(통과) · '3' → 무엇을 더 쳐도 3000 이상(막음)
       '18' → 1800~1899 뿐이라 1940 에 못 닿는다(막음) · 평점 '4.6' → 이미 4.5 초과(막음) */
function canStillFit(text, lim) {
  if (text === '' || text === '.') return true;
  if (/^0\d/.test(text)) return false;                       // '05' 같은 앞자리 0 은 안 받는다
  const [ip, fp] = text.split('.');
  const maxIntDigits = String(Math.floor(lim.max)).length;
  if (ip.length > maxIntDigits) return false;
  if (fp !== undefined) {                                    // 점을 이미 쳤다 — 정수 부분은 끝났다
    const lo = Number(ip + '.' + fp);
    const hi = Number(ip + '.' + fp + '9'.repeat(Math.max(0, lim.decimals - fp.length)));
    return hi >= lim.min && lo <= lim.max;
  }
  /* 정수 부분을 치는 중 — 뒤에 숫자를 0~n개 더 붙인 값들 중 범위에 닿는 게 있는가 */
  const p = Number(ip || '0');
  for (let extra = 0; ip.length + extra <= maxIntDigits; extra++) {
    const scale = Math.pow(10, extra);
    const lo = p * scale;
    const hi = p * scale + (scale - 1) + (lim.decimals > 0 ? 0.99 : 0);
    if (hi >= lim.min && lo <= lim.max) return true;
  }
  return false;
}

/* ① 칠 때 — 새 글자를 받아도 되는가. 안 되면 칸은 직전 글자로 돌아간다. */
function guardText(text, lim) {
  const t = String(text == null ? '' : text);
  return numberShapeOk(t, lim.decimals) && canStillFit(t, lim);
}

/* ② 넘길 때 — 다 친 값이 범위 안인가. 빈 칸은 '모름'이라 통과한다(이 앱은 모르면 판정하지 않는다). */
function checkNumber(text, lim) {
  const t = String(text == null ? '' : text).trim();
  if (t === '') return { ok: true, value: null };
  const range = lim.min + '~' + lim.max + (lim.unit || '');
  if (!numberShapeOk(t, lim.decimals) || t === '.' || /\.$/.test(t)) {
    return { ok: false, msg: lim.label + '은(는) ' + range + ' 사이 숫자로 적어 주세요' };
  }
  const n = Number(t);
  if (!(n >= lim.min && n <= lim.max)) {
    return { ok: false, msg: lim.label + '은(는) ' + range + ' 사이만 적을 수 있어요' };
  }
  return { ok: true, value: n };
}

/* ③ 이미 저장된 값 — 범위 밖이거나 숫자가 아니면 **그 칸만** null(모름)로 비운다. 비운 칸 이름을 돌려준다.
   🔴 고쳐 넣지 않는다(999 → 4.5 금지). 비우는 것이 이 앱의 안전한 기본값이다. */
function scrubProfileNumbers(p) {
  const cleared = [];
  if (!p || typeof p !== 'object') return cleared;
  for (const key of Object.keys(PROFILE_LIMITS)) {
    const v = p[key];
    if (v == null || v === '') continue;
    const r = checkNumber(String(v), PROFILE_LIMITS[key]);
    if (!r.ok) { p[key] = null; cleared.push(PROFILE_LIMITS[key].label); }
  }
  return cleared;
}

/* 서류 정보 칸 — 숫자 칸에 엉뚱한 글자가 들어가지 않게 (권장안 1 · 2026-11-17).
   글자 **종류**만 본다. 길이는 각 칸의 maxlength 가 맡는다. */
const TEXT_GUARDS = {
  account: /^[0-9-]*$/,               // 계좌번호(하이픈 허용) — 은행 앱에서 복사해 붙이면 하이픈이 따라온다
  studentId: /^[0-9A-Za-z-]*$/,       // 학번 — 대개 숫자지만 영문이 섞인 학교가 있어 영문까지
  phone: /^[0-9-]*$/,
  date: /^[0-9.\-/ ]*$/,              // 생년월일 — 2005.03.14 · 2005-03-14 · 20050314
};
function guardKind(text, kind) {
  const re = TEXT_GUARDS[kind];
  return !re || re.test(String(text == null ? '' : text));
}

/* 생년월일 — 다 쳤을 때 **있을 수 없는 날짜**(13월·32일)인가. 빈 칸·덜 친 칸은 판정하지 않는다. */
function checkBirthDate(text) {
  const t = String(text == null ? '' : text).trim();
  if (t === '') return { ok: true };
  /* 구분자가 있으면 월·일은 한 자리도 받는다(2005.3.14) · 없으면 여덟 자리(20050314) */
  const parts = t.split(/[.\-/ ]+/).filter(Boolean);
  let y, m, day;
  if (parts.length === 3 && /^\d{4}$/.test(parts[0]) && /^\d{1,2}$/.test(parts[1]) && /^\d{1,2}$/.test(parts[2])) {
    [y, m, day] = parts.map(Number);
  } else if (/^\d{8}$/.test(t)) {
    y = +t.slice(0, 4); m = +t.slice(4, 6); day = +t.slice(6, 8);
  } else {
    return { ok: false, msg: '생년월일은 2005.03.14 처럼 적어 주세요' };
  }
  const lim = PROFILE_LIMITS.birthYear;
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();   // 그 달의 마지막 날(윤년 포함)
  if (y < lim.min || y > lim.max || m < 1 || m > 12 || day < 1 || day > last) {
    return { ok: false, msg: '있을 수 없는 생년월일이에요 — 다시 확인해 주세요' };
  }
  return { ok: true };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PROFILE_LIMITS, guardText, checkNumber, scrubProfileNumbers, TEXT_GUARDS, guardKind, checkBirthDate, canStillFit };
}

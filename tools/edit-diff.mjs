/* 관리자 수정 한 건이 '무엇을 바꾸는가' 를 정하는 규칙 — 한 곳 (2026-09-14)
   ------------------------------------------------------------------
   🔴 **왜 이 파일이 있나.** 관리자 화면이 '한꺼번에 반영' 전에 "무엇이 바뀌는지" 를
      전후로 보여 주려면, 저장소가 **실제로** 무슨 값을 넣는지 화면이 알아야 한다.
      그 규칙을 화면에서 다시 짜면 반드시 갈라진다 — 실제로 화면은 `years:'1,2'`(문자열)를
      보내는데 저장소는 `[1,2]`(배열)로 바꿔 넣으므로, 날것끼리 대 보면 **안 바뀐 칸이
      '바뀜' 으로** 뜬다. 그러면 미리보기가 거짓말을 한다.

   🔴 **베끼지 말 것.** 브라우저는 `./vendor/edit-diff.mjs`(build.sh 가 옮긴다),
      Node 는 `./edit-diff.mjs` 로 **같은 파일**을 부른다.

   ⚠️ 여기서는 **형식 검사(validateValue)와 값 정리(normalizeValue)를 섞지 않는다.**
      정리하다 던지면 화면이 미리보기를 그리다 죽는다 — 화면은 막힌 줄을 **보여 줘야** 한다.
      대신 저장소(tools/admin-apply.mjs)는 validateValue 가 돌려준 문구로 그 자리에서 멈춘다.

   ⚠️ 여기서 **못 보는 것 하나** — `exclusivity.raw`·`prepDocBasis` 가 저장된 공고 원문에
      정말로 있는지(원문 대조)는 800KB 원문을 읽어야 알 수 있어 저장소에서만 본다.
      그래서 그 두 칸은 '막힘' 으로 표시되지 않아도 저장 때 거부될 수 있다. 화면 문구가
      "저장 때 막히는 값" 이라고 적는 이유다(확인 안 한 것을 확인했다고 말하지 않는다).   */

/* 고칠 수 있는 칸 → 사람이 읽는 이름.
   🔴 이 목록은 `tools/admin-apply.mjs` 의 ALLOWED 와 같아야 한다 — 여기 없는 칸을 화면이
      보내면 저장소가 **조용히 버린다**(화면에는 '성공' 으로 보인다). */
export const EDIT_LABEL = {
  name: '공고 제목',
  provider: '주관 기관',
  type: '구분',
  amount: '금액 문구',
  amountValue: '금액 숫자',
  deadline: '마감일',
  period: '신청 기간 문구',
  summary: '요약',
  note: '안내 문구',
  sourceUrl: '원문 공고 주소',
  formId: '연결된 양식',
  noForm: '양식 없는 사유',
  applyEmail: '이메일 접수 주소',
  eligibility: '자격 — 기계 판정용',
  eligibilityLines: '학생에게 보여 줄 자격 문장',
  eligibilityVerified: '자격 제한 없음 확인',
  documents: '요구 서류',
  announceDate: '결과 발표일',
  eligibilityExcludes: '이런 학생은 못 받아요',
  eligibilityPriority: '먼저 뽑는 기준',
  exclusivity: '이중수혜(중복 수혜) 조항',
  prepDoc: '자유 형식 제출 (준비용 문서)',
  prepDocBasis: '자유 형식 제출 근거 문장',
};

export const ALLOWED = new Set(Object.keys(EDIT_LABEL));

/* 스위치와 근거 문장은 **짝으로만** 뜻이 있다 — 따로 세면 '근거만 바뀜' 같은 줄이 나온다 */
export const PAIRED = new Set(['prepDoc', 'prepDocBasis']);

/* 빈칸으로 지울 수 없는 칸 — 비우면 학생 앱이 그 자리에서 죽는다 */
export const NEVER_EMPTY = new Set(['name', 'type', 'provider', 'amount', 'summary', 'sourceUrl', 'documents']);

/* 기계 판정용 자격 — 값의 형태까지 못 박는다(자유 문장이 섞이면 매칭이 조용히 망가진다) */
export const ELIG_KEYS = {
  selective: 'bool',
  schoolOnly: 'str',
  campusOnly: 'str',
  years: 'numArr',      // [1,2,3,4]
  minGpa: 'num',
  maxBracket: 'num',
  tracks: 'strArr',
};

/* 자격 칸을 사람 말로 — 화면이 `{"schoolOnly":"경희대학교"}` 를 그대로 뱉으면 못 읽는다 */
export const ELIG_LABEL = {
  selective: '선발제', schoolOnly: '학교 한정', campusOnly: '캠퍼스 한정',
  years: '학년', minGpa: '최소 학점', maxBracket: '소득구간 상한', tracks: '계열',
};

/** 기계 판정용 자격을 정리한다. 모르는 키는 조용히 버린다.
 *  🔴 저장소(admin-apply.mjs)는 이 함수가 던지면 그 문구로 멈춘다 —
 *     `process.exit` 가 없는 브라우저에서도 돌아야 해서 throw 를 쓴다. */
export function cleanEligibility(v) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('자격(기계 판정용) 형식이 올바르지 않습니다');
  const out = {};
  Object.keys(v).forEach((k) => {
    const kind = ELIG_KEYS[k];
    if (!kind) return;                                  // 모르는 키는 조용히 버린다
    const raw = v[k];
    if (raw === null || raw === '' || raw === undefined) return;
    if (kind === 'bool') { if (raw === true) out[k] = true; return; }
    if (kind === 'str') { const t = String(raw).trim(); if (t) out[k] = t; return; }
    if (kind === 'num') { const n = Number(raw); if (Number.isFinite(n)) out[k] = n; return; }
    if (kind === 'numArr') {
      const a = (Array.isArray(raw) ? raw : String(raw).split(',')).map((x) => Number(String(x).trim()))
        .filter((n) => Number.isInteger(n) && n >= 1 && n <= 6);
      if (a.length) out[k] = [...new Set(a)].sort();
      return;
    }
    if (kind === 'strArr') {
      const a = (Array.isArray(raw) ? raw : String(raw).split(',')).map((x) => String(x).trim()).filter(Boolean);
      if (a.length) out[k] = [...new Set(a)];
    }
  });
  return out;
}

/** 사람이 읽는 문장 목록 — 줄 수·길이에 상한을 둔다(브라우저에서 오는 값을 믿지 않는다) */
export function cleanLines(v) {
  const arr = Array.isArray(v) ? v : String(v || '').split('\n');
  return arr.map((x) => String(x).replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, 20)
    .map((x) => x.slice(0, 300));
}

/* 달력에 **실제로 있는 날**인가 — 모양만 보면 `2026-13-01`·`2026-02-30` 이 통과한다 */
export const isDay = (v) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(v || ''))) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
};

/** 이중수혜 — 모양만 다듬는다(원문 대조는 저장소에서만 할 수 있다) */
export function cleanExclusivity(v) {
  if (v === null || v === '' || v === undefined) return null;
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('이중수혜 값의 형식이 올바르지 않습니다');
  return { kind: v.kind, scope: v.scope, raw: String(v.raw || '').replace(/\s+/g, ' ').trim().slice(0, 200) };
}

/** 저장소가 실제로 넣을 값. 형식 오류는 여기서 보지 않는다(validateValue 가 본다).
 *  돌려주는 값이 `null` 또는 `''` 이면 **칸 자체를 지운다**는 뜻이다. */
export function normalizeValue(k, v) {
  let out = v;
  if (typeof out === 'string') out = out.trim();
  if (k === 'eligibility') return cleanEligibility(out);
  if (k === 'eligibilityLines' || k === 'documents'
    || k === 'eligibilityExcludes' || k === 'eligibilityPriority') {
    const a = cleanLines(out);
    return a.length ? a : null;
  }
  if (k === 'eligibilityVerified') return (out === true || out === 'true') ? true : null;
  if (k === 'exclusivity') return cleanExclusivity(out);
  if (k === 'amountValue') return Number(out) || 0;
  if (k === 'prepDoc') return (out === true || out === 'true');
  return out;
}

/** 이 값이 저장소에서 거부되는가 — 거부되면 사람이 읽을 문구, 괜찮으면 null.
 *  `item` 은 발표일↔마감일처럼 **다른 칸과 견줘야** 판정되는 것 때문에 받는다. */
export function validateValue(k, v, item = {}) {
  if ((v === null || v === '' || v === undefined) && NEVER_EMPTY.has(k)) {
    return k === 'documents'
      ? '요구 서류는 비울 수 없습니다 (모르면 "제출 서류는 공고 원문에서 확인" 처럼 한 줄이라도 남겨 주세요)'
      : '비울 수 없는 칸입니다 (비우면 학생 화면이 깨집니다)';
  }
  if (v === null || v === '' || v === undefined) return null;
  if (k === 'deadline' && !isDay(v)) return `마감일은 달력에 있는 날이어야 합니다 (YYYY-MM-DD): ${v}`;
  if (k === 'announceDate') {
    if (!isDay(v)) return `발표일은 달력에 있는 날이어야 합니다 (YYYY-MM-DD): ${v}`;
    if (item.deadline && v < item.deadline) return `발표일(${v})이 마감일(${item.deadline})보다 앞섭니다`;
  }
  if (k === 'type' && !['교내', '교외'].includes(v)) return `구분은 '교내' 또는 '교외'만 가능합니다: ${v}`;
  if (k === 'sourceUrl' && !/^https?:\/\//i.test(v)) return `원문 주소는 http(s)로 시작해야 합니다: ${v}`;
  if (k === 'applyEmail' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return `이메일 형식이 올바르지 않습니다: ${v}`;
  if (k === 'exclusivity') {
    if (v.kind !== 'forbidden') return "이중수혜는 '중복 불가'만 화면에서 정합니다 (가능·모름은 칸을 비우세요)";
    if (!['external', 'narrow'].includes(v.scope)) return `이중수혜 범위는 external·narrow 둘뿐입니다: ${v.scope}`;
  }
  return null;
}

/** 두 값이 같은가 — 객체·배열은 모양까지 본다 (저장소의 `same` 과 같은 판정) */
export const sameValue = (a, b) => ((typeof a === 'object' || typeof b === 'object')
  ? JSON.stringify(a) === JSON.stringify(b)
  : a === b);

/* ── 값을 사람 말로 ─────────────────────────────────────────────
   🔴 자르면서 **글자 수를 안 적으면**, 앞 60자가 같은 두 값이 '안 바뀜' 처럼 보인다. */
const CUT = 60;
function cut(s) {
  const t = String(s);
  return t.length <= CUT ? t : `${t.slice(0, CUT)}…(총 ${t.length}자)`;
}

export function showValue(v) {
  if (v === null || v === undefined || v === '') return '(빈칸)';
  if (v === true) return '켬';
  if (v === false) return '끔';
  if (Array.isArray(v)) return v.length ? cut(v.join(' · ')) : '(빈칸)';
  if (typeof v === 'object') {
    /* 이중수혜는 칸 이름이 따로 있다 */
    if (v.kind === 'forbidden') {
      const scope = v.scope === 'external' ? '교외 장학금 전부' : '좁은 범위';
      return cut(`중복 불가 · ${scope}${v.raw ? ` · ${v.raw}` : ''}`);
    }
    const parts = Object.keys(v).map((k) => {
      const label = ELIG_LABEL[k] || k;
      const val = Array.isArray(v[k]) ? v[k].join(',') : (v[k] === true ? '예' : String(v[k]));
      return `${label} ${val}`;
    });
    return parts.length ? cut(parts.join(' · ')) : '(빈칸)';
  }
  return cut(v);
}

/* ── 이 patch 가 실제로 바꾸는 칸 ────────────────────────────────
   저장소(admin-apply.mjs 의 applyPatch)와 **같은 판정**으로 고른다:
     ① ALLOWED 밖은 버린다  ② 정리한 값이 비면 '칸을 지움'  ③ 같은 값이면 안 센다   */

/** 자유 형식 제출 스위치 — 짝으로 한 줄만 만든다 */
function prepDocRow(item, patch) {
  if (!('prepDoc' in patch) && !('prepDocBasis' in patch)) return null;
  const on = ('prepDoc' in patch) ? (patch.prepDoc === true || patch.prepDoc === 'true') : true;
  const before = item.prepDoc === true;
  if (!on) {
    if (!before && item.prepDocBasis === undefined) return null;
    return { key: 'prepDoc', label: EDIT_LABEL.prepDoc, before: true, after: false, block: null };
  }
  const basis = String(patch.prepDocBasis || item.prepDocBasis || '').replace(/\s+/g, ' ').trim().slice(0, 300);
  let block = null;
  if (!('prepDoc' in patch) && !before) block = '스위치(자유 형식 제출)를 함께 보내 주세요';
  else if (item.formId) block = `이 공고에는 양식(${item.formId})이 연결돼 있어 준비용 문서가 뜨지 않습니다`;
  else if (item.program) block = '상시 제도에는 준비용 문서가 뜨지 않습니다';
  else if (basis.replace(/\s+/g, '').length < 12) block = '근거 문장을 원문에서 12자 이상 그대로 복사해 주세요';
  if (before === true && item.prepDocBasis === basis && !block) return null;
  return {
    key: 'prepDoc',
    label: EDIT_LABEL.prepDoc,
    before: before ? `켬 · ${item.prepDocBasis || ''}` : false,
    after: `켬 · ${basis}`,
    block,
  };
}

/** 마감일이 바뀌면 학생 화면 문구(period)가 따라 바뀐다 (2026-09-17 · G-3 컨펌 C).
 *  🔴 저장소(admin-apply)와 화면(전후 대조)이 **이 한 함수**를 쓴다 — 갈라지면 화면이 예고한
 *     것과 저장된 것이 다르다(관문 '화면이 예고한 바뀌는 칸'이 그 어긋남을 잡는다).
 *  규칙은 로봇(extract-excerpts putDeadline)과 같다: 문구가 없으면 `접수 ~날짜`, '원문 확인'
 *  자리에는 `~날짜`. 마감을 비우면 방금 지운 그 날짜가 든 문구를 '원문 확인'으로 되돌린다.
 *  사람이 적은 날짜는 짐작이 아니므로 학생 문구에 넣어도 원칙 8-1 에 어긋나지 않는다. */
export function periodAfterDeadline(period, deadline, oldDeadline) {
  const p = period || '';
  if (deadline) {
    if (!p) return `접수 ~${deadline}`;
    if (/원문\s*확인/.test(p)) return p.replace(/원문\s*확인/, `~${deadline}`);
    return p;
  }
  if (oldDeadline && p.includes(`~${oldDeadline}`)) return '접수 기간 원문 확인';
  return p;
}

/** 금액 숫자 → 카드에 뜰 문구. 만원으로 딱 떨어지면 `500만원`, 아니면 `1,234,000원`.
 *  🔴 원본은 여기 하나다 — 로봇(collector/extract-amounts.mjs)·저장소(admin-apply)·화면이
 *     전부 이걸 부른다. 베끼면 로봇이 적는 문구와 사람이 적을 때 붙는 문구가 갈라진다. */
export function wonText(n) {
  const v = Number(n) || 0;
  return v % 10000 === 0
    ? `${(v / 10000).toLocaleString('ko-KR')}만원`
    : `${v.toLocaleString('ko-KR')}원`;
}
export function amountText(a) {
  return a && a.kind === 'range' ? `${wonText(a.min)} ~ ${wonText(a.max)}` : wonText(a && a.value);
}

/** 금액 숫자가 바뀌면 카드 문구(amount)가 따라 바뀐다 (2026-09-17 · F-9 컨펌 2 · 개발자 결정 '나').
 *  🔴 **숫자만 넣으면 감사가 막는다** — `verify/entry-rules.cjs` 는 `amountValue > 0` 인데
 *     문구에 숫자가 없으면 **오류**로 잡는다(카드는 '금액 원문 확인', 합계는 500만원이라고
 *     서로 다른 말을 하기 때문이다). 그래서 문구를 같이 고치는 것이 이 함수다.
 *  규칙은 로봇(extract-amounts)과 같다: **이미 숫자가 든 문구는 건드리지 않는다**
 *  (`등록금 + 영농정착 지원` 처럼 사람이 다듬은 뜻을 맨 숫자로 덮지 않는다).
 *  숫자를 비우는 조치는 문구를 건드리지 않는다 — 무엇으로 되돌릴지 우리가 모른다. */
export function amountAfterValue(amount, won) {
  const cur = String(amount || '');
  if (!(Number(won) > 0)) return cur;
  if (/\d/.test(cur)) return cur;
  return wonText(won);
}

/**
 * 한 건의 patch 가 실제로 바꾸는 칸만 고른다.
 * @returns {{key:string,label:string,before:*,after:*,block:(string|null)}[]}
 */
export function diffPatch(item, patch) {
  const it = item || {};
  const rows = [];
  const pair = prepDocRow(it, patch || {});
  if (pair) rows.push(pair);

  Object.keys(patch || {}).forEach((k) => {
    if (PAIRED.has(k)) return;                 // 위에서 짝으로 처리했다
    if (!ALLOWED.has(k)) return;               // 저장소가 버리는 키 — 화면도 안 센다
    let v;
    let block = null;
    try {
      v = normalizeValue(k, patch[k]);
    } catch (e) {
      rows.push({ key: k, label: EDIT_LABEL[k] || k, before: it[k], after: patch[k], block: e.message });
      return;
    }
    block = validateValue(k, v, it);
    const old = it[k];
    const empty = (v === null || v === '' || v === undefined);
    if (empty) {
      if (old === undefined && !block) return;          // 원래 없던 칸을 비우는 것은 아무 일도 아니다
      rows.push({ key: k, label: EDIT_LABEL[k] || k, before: old, after: undefined, block });
      return;
    }
    if (sameValue(old, v) && !block) return;
    rows.push({ key: k, label: EDIT_LABEL[k] || k, before: old, after: v, block });
  });
  /* 마감일이 바뀌면 문구(period)도 따라 바뀐다 — 사람이 문구를 직접 적었으면 그쪽이 이긴다 */
  const dl = rows.find((r) => r.key === 'deadline' && !r.block);
  if (dl && !('period' in (patch || {}))) {
    const after = periodAfterDeadline(it.period, dl.after, it.deadline);
    if (after !== (it.period || '')) rows.push({ key: 'period', label: EDIT_LABEL.period, before: it.period, after, block: null });
  }
  /* 금액 숫자가 들어오면 카드 문구(amount)도 따라 바뀐다 — 사람이 문구를 직접 적었으면 그쪽이 이긴다.
     🔴 이 줄이 없으면 미리보기가 '금액 숫자' 한 칸만 예고하는데 저장소는 문구까지 고친다. */
  const av = rows.find((r) => r.key === 'amountValue' && !r.block);
  if (av && !('amount' in (patch || {}))) {
    const after = amountAfterValue(it.amount, av.after);
    if (after !== (it.amount || '')) rows.push({ key: 'amount', label: EDIT_LABEL.amount, before: it.amount, after, block: null });
  }
  return rows;
}

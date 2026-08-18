/* ============================================================
   한대장 — 신청서 질문 설계기 (2026-08-18)

   하는 일 하나: **원본 스키마를 그대로 둔 채, 학생에게 낼 질문 목록만 다시 짠다.**
   - 앱이 이미 아는 것은 묻지 않고 채운다
   - 답이 정해진 것은 클릭으로 고르게 한다
   - 그래도 많으면 같은 표의 칸들을 한 카드로 묶는다

   🔴 이 파일이 문서를 만들지 않는다. 문서는 forms.js의 renderFormDoc이
   **원본 스키마를 그대로 읽어** 만든다. 그래서 질문을 아무리 줄여도
   만들어지는 문서는 한 글자도 달라지지 않는다(운영 원칙 4).
   증명 장치: `node verify/form-snapshot.mjs`

   🔴 여기서 선택지를 지어내지 않는다(운영 원칙 8-1).
   클릭형으로 바꾸는 것은 **데이터에 이미 보기가 적혀 있는 필드**뿐이고,
   자동 채움은 **학생 본인이 앱에 입력한 값**을 옮기는 것뿐이다.

   화면(forms.js)·감사(verify/audit-data.js)·관리자 화면이 같은 파일을 쓴다.
   베끼면 "화면은 12개인데 감사는 20개"처럼 갈라진다.
   ============================================================ */

/* 개발자 지시(2026-08-17)로 정한 상한.
   ⚠️ 넘는다고 질문을 감추지 않는다 — 전부 보여 주고 감사가 리포트한다.
   숨기면 학생이 못 채운 칸이 있는 문서를 제출하게 된다. */
const FORM_LIMITS = { input: 10, click: 15, total: 20 };

/* ---------- 라벨 정규화 ----------
   같은 항목인데 게시판마다 '성명' '성 명' '성　명' '1. 성       명'으로 적힌다.
   실측: 이 정규화로 서로 다른 라벨 442종 → 408종. */
function formLabelKey(label) {
  return String(label || '')
    .replace(/^[\s]*[0-9]+\s*[.)]\s*/, '')       // 앞 번호 "1." "2)"
    .replace(/[\s 　]/g, '')            // 공백·전각공백
    .replace(/[()（）［］\[\]{}·・.,:：;/\\\-—–~〜*※'"’”]/g, '')
    .toLowerCase();
}

/* ---------- 라벨 → 프로필 열쇠 ----------
   로봇이 만든 양식에는 auto가 한 건도 없다(필드 233개 전부 생짜).
   48종을 손으로 고치는 대신 라벨을 읽어 잇는다.
   🔴 데이터에 적힌 f.auto가 언제나 이긴다 — 여기는 못 적힌 것을 메우는 자리다. */
const FORM_AUTO_LABELS = [
  ['name', /^(성명|이름|성명한글|한글성명|신청인성명|지원자성명|본인성명|예금주)$/],
  ['studentId', /^(학번|학생번호)$/],
  ['birth', /^(생년월일|생년월일자|출생년월일|생일)$/],
  ['major', /^(학과|전공|학부전공|학과전공|소속학과|학과명|전공명|학부학과)$/],
  ['school', /^(학교|학교명|대학명|대학교명|대학교|재적학교|소속학교|재학학교|소속대학)$/],
  ['email', /^(이메일|이메일주소|emailemail|e-?mail|메일주소)$/],
  ['phone', /^(연락처|전화|전화번호|휴대전화|휴대폰|휴대폰번호|핸드폰|핸드폰번호|본인연락처|연락처휴대폰|이동전화|자택전화)$/],
  ['year', /^(학년|재학학년|소속학년)$/],
  ['gender', /^(성별|성별필수)$/],
  ['addr', /^(주소|현주소|거주지|주소지|자택주소|현거주지|본인주소)$/],
  ['emergency', /^(긴급연락처|비상연락처|긴급연락망)$/],
  ['guardianName', /^(보호자|보호자성명|보호자이름|학부모성명)$/],
  ['guardianRel', /^(학생과의관계|신청인과의관계|본인과의관계)$/],
  ['guardianPhone', /^(보호자연락처|보호자전화|학부모연락처|보호자휴대폰)$/],
  ['bank', /^(은행|은행명|거래은행)$/],
  ['account', /^(계좌번호|계좌|입금계좌|입금계좌번호|장학금수령계좌번호)$/],
  ['bracket', /^(소득분위|학자금지원구간|지원구간|국가장학금소득분위)$/],
  ['rrn', /^(주민등록번호|주민번호|주민등록no)$/],
];

function formAutoKey(field) {
  if (!field) return '';
  if (field.auto) return field.auto;
  /* 서술형·선택형은 프로필 한 줄로 대신할 수 없다 — text만 본다 */
  if (field.type && field.type !== 'text') return '';
  const k = formLabelKey(field.label);
  if (!k) return '';
  const hit = FORM_AUTO_LABELS.find(([, re]) => re.test(k));
  return hit ? hit[0] : '';
}

/* ---------- 단일 선택인가 ----------
   지금 checks(다중 선택)로 된 것 상당수가 실은 하나만 고르는 항목이다
   (성별 남/여, 동의함/동의하지 않음, 병역구분, 신규/계속…).
   다중 선택이라 학생이 남·여를 둘 다 체크할 수 있는 상태다.
   🔴 확신이 있을 때만 승격한다 — 여러 개 해당될 수 있는 항목
   (우선선발 대상자·가산점항목)을 하나만 고르게 하면 학생이 못 쓴다. */
const CHOICE_MULTI_SIGNAL = /중복|모두\s*(선택|고르)|여러\s*개/;
const CHOICE_SINGLE_LABEL = /^(성별|병역|병역구분|병역사항|구분|대상구분|학교구분|학교소재|재학구분|대학분류|계속자여부|신규자계속자|신청유형|동의여부|성별필수)$/;
const CHOICE_SINGLE_TAIL = /(여부|구분|분류)$/;
const CHOICE_EXCLUSIVE_SETS = [
  ['남', '여'], ['동의함', '동의하지않음'], ['동의', '거부'], ['예', '아니오'],
  ['신규', '계속'], ['필', '미필', '면제', '해당없음'],
];

/* 괄호 부속(본인)·(체크✓)을 떼고 본 라벨만 — '사회보장 수급여부 (본인)'의 끝은 '여부'다 */
function formLabelCore(label) {
  return formLabelKey(String(label || '').replace(/[([（［][^)\]）］]*[)\]）］]/g, ' '));
}

function formIsSingleChoice(f) {
  if (!f || !(f.type === 'checks' || f.type === 'choice')) return false;
  if (f.single === true) return true;      // 데이터가 못 박은 것이 최우선
  if (f.multi === true) return false;
  const opts = f.options || [];
  if (!opts.length) return false;
  const hay = `${f.q || ''} ${f.suffix || ''} ${f.label || ''}`;
  /* 원본이 '중복 선택 가능'이라고 적어 둔 것은 절대 하나만 고르게 하지 않는다 */
  if (CHOICE_MULTI_SIGNAL.test(hay)) return false;
  const lk = formLabelKey(f.label);
  const core = formLabelCore(f.label);
  if (/택\s*1|택일|하나만|한\s*가지만/.test(hay)) return true;
  if (opts.length === 1) return /동의|서약/.test(lk);
  /* 보기가 7개 넘게 늘어선 것은 '해당하는 것을 다 고르는' 항목일 때가 많다
     (우선선발 대상자 여부 7개·고시장학금 합격 구분 7개) — 건드리지 않는다 */
  if (opts.length > 6) return false;
  const optKeys = opts.map(formLabelKey);
  if (CHOICE_EXCLUSIVE_SETS.some((set) => set.length === optKeys.length && set.every((s, i) => optKeys[i] === s))) return true;
  if (CHOICE_SINGLE_LABEL.test(core)) return true;
  /* 실측: 지금 데이터의 보기 2개짜리 checks는 전부 서로 배타적인 짝이다
     (남/여, 동의함/동의하지 않음, 원금상환/이자지원, 4년대/전문대…) */
  if (opts.length === 2) return true;
  if (CHOICE_SINGLE_TAIL.test(core) && opts.length <= 5) return true;
  if (/동의/.test(core)) return true;
  return false;
}

/* ---------- 답 모양 맞추기 ----------
   저장된 답(application.formAns)은 기기에 남아 나중에 다시 문서로 그려진다.
   필드 타입이 바뀌면 옛 답의 모양이 달라 renderFormDoc이 터진다
   (a.checks.includes is not a function). 버리지 않고 맞춰 준다 — 학생이 쓴 글이다. */
function formAnswerFor(f, raw) {
  const t = f && f.type;
  if (t === 'checks' || t === 'checks+text' || t === 'choice') {
    if (raw && Array.isArray(raw.checks)) return { checks: raw.checks, text: raw.text || '' };
    if (typeof raw === 'string' && raw) {
      const hit = (f.options || []).find((o) => o === raw);
      return { checks: hit ? [hit] : [], text: hit ? '' : raw };
    }
    return { checks: [], text: '' };
  }
  if (t === 'schedule') {
    if (raw && Array.isArray(raw.days)) return { days: raw.days, time: raw.time || '15:00 ~ 17:00' };
    return { days: [], time: '15:00 ~ 17:00' };
  }
  if (t === 'group') {
    const out = {};
    (f.sub || []).forEach((s) => {
      const v = raw && typeof raw === 'object' ? raw[s.id] : undefined;
      out[s.id] = typeof v === 'string' ? v : '';
    });
    return out;
  }
  if (raw && typeof raw === 'object') {
    /* 옛 답이 객체인데 지금은 한 줄 칸 — 고른 값이 있으면 그것을 글로 옮긴다 */
    if (Array.isArray(raw.checks)) return raw.checks.join(', ') + (raw.text ? ` ${raw.text}` : '');
    return '';
  }
  return typeof raw === 'string' ? raw : '';
}

/* ---------- 병합 가능한 짧은 칸인가 ---------- */
function formIsShortText(f) {
  if (!f || f.type !== 'text' || f.sugg) return false;
  /* 🔴 프로필로 배울 수 있는 칸은 묶지 않는다. 묶으면 카드 안에 들어가
     '다음 신청서에도 쓸게요'가 안 붙어, 그 값을 영영 못 배우고 매번 다시 묻게 된다.
     (동산장학회의 현주소·긴급연락처가 정확히 그 경우였다) */
  if (formAutoKey(f)) return false;
  return String(f.label || '').replace(/\s/g, '').length <= 14;
}

/* ---------- 질문 설계 ----------
   autoValues: { name:'홍길동', birth:'2003.05.14', … } — 프로필에서 뽑아 넘긴다.
   순수 함수라 화면 없이도 셀 수 있다(감사·관리자 화면이 같은 값을 본다). */
function planFormQuestions(tpl, autoValues, opts) {
  const av = autoValues || {};
  const limits = Object.assign({}, FORM_LIMITS, (opts && opts.limits) || {});
  const auto = {};        // 안 물어본 필드의 답
  const autoRows = [];    // '이 정보로 채웠어요' 패널
  const mirror = {};      // 중복 섹션 — 앞 섹션의 답을 그대로 복사
  const secs = [];
  const seenSig = new Map();

  (tpl.sections || []).forEach((sec, si) => {
    const fields = sec.fields || [];
    const sig = fields.map((f) => formLabelKey(f.label)).join('|');
    /* ① 같은 섹션이 두 번 이상 들어 있다 — 로봇이 같은 첨부를 두 번 담은 것.
       문서에는 원본대로 두 번 그리고, 질문만 한 번 한다. */
    if (sig && seenSig.has(sig)) {
      const src = seenSig.get(sig);
      fields.forEach((f, i) => { if (src[i]) mirror[f.id] = src[i].id; });
      return;
    }
    if (sig) seenSig.set(sig, fields);

    const items = [];
    fields.forEach((f) => {
      /* ② 채우는 칸이 아닌 것(표 헤더·안내문) — 원본 대조로 확인된 것만 데이터가 static을 붙인다 */
      if (f.type === 'static') { auto[f.id] = ''; return; }
      /* ③ 앱이 이미 아는 것은 묻지 않는다 */
      const key = formAutoKey(f);
      const val = key ? av[key] : '';
      if (key && val) {
        auto[f.id] = val;
        autoRows.push({ id: f.id, label: f.label, key, value: val });
        return;
      }
      /* ④ 답이 정해진 것은 클릭으로 — 보기는 데이터에 있는 것만 쓴다 */
      if (f.type === 'checks' && formIsSingleChoice(f)) {
        items.push(Object.assign({}, f, { type: 'choice', _from: 'checks' }));
        return;
      }
      items.push(f);
    });
    if (items.length) secs.push({ heading: sec.heading, note: sec.note, si, items });
  });

  /* ⑤ 클릭 먼저, 짧은 입력 다음, 서술은 마지막 — 첫 화면에서 긴 글부터 만나지 않게.
     🔴 병합보다 **먼저** 정렬해야 한다. 원본 순서 그대로 두면 표 칸 사이사이에 서술형이
     끼어 있어 묶을 수 있는 줄이 토막 난다(동산장학회에서 카드가 7개가 아니라 12개가 됐다).
     정렬은 묻는 차례만 바꾼다 — 문서는 원본 스키마 순서 그대로다. */
  let plan = { auto, autoRows, mirror, secs };
  plan.secs.forEach((s) => {
    const rank = (f) => (f.type === 'choice' || f.type === 'checks' || f.type === 'checks+text' || f.type === 'schedule' ? 0
      : f.type === 'textarea' ? 2 : 1);
    s.items = s.items.map((f, i) => [f, i]).sort((a, b) => rank(a[0]) - rank(b[0]) || a[1] - b[1]).map((x) => x[0]);
  });

  /* ⑥ 그래도 직접 입력이 상한을 넘으면 같은 표의 칸들을 한 카드로 묶는다.
     서술형은 절대 묶지 않는다 — 그건 줄이면 안 되는 질문이다. */
  if (countPlan(plan).input > limits.input) plan = mergeShortFields(plan, limits);

  plan.counts = countPlan(plan);
  plan.limits = limits;
  plan.over = [];
  if (plan.counts.input > limits.input) plan.over.push(`직접 입력 ${plan.counts.input}개 (상한 ${limits.input})`);
  if (plan.counts.click > limits.click) plan.over.push(`클릭형 ${plan.counts.click}개 (상한 ${limits.click})`);
  if (plan.counts.total > limits.total) plan.over.push(`전체 ${plan.counts.total}개 (상한 ${limits.total})`);
  return plan;
}

function countPlan(plan) {
  let click = 0; let input = 0;
  plan.secs.forEach((s) => s.items.forEach((f) => {
    if (f.type === 'choice' || f.type === 'checks' || f.type === 'checks+text' || f.type === 'schedule') click++;
    else input++;
  }));
  return { click, input, total: click + input };
}

/* 같은 섹션에서 잇달아 나오는 짧은 한 줄 칸을 한 질문 카드로 묶는다.
   원본이 표인데 셀마다 질문이 된 것(동산장학회 학력표 7칸 등)이 이 대상이다.
   🔴 카드 1개로 세지만 문서에는 원래 칸 수만큼 그대로 나간다. */
function mergeShortFields(plan, limits) {
  const MAX_SUB = 5;
  let budget = countPlan(plan).input;
  const secs = plan.secs.map((sec) => {
    if (budget <= limits.input) return sec;
    const out = [];
    let run = [];
    const flush = () => {
      if (run.length >= 2) {
        out.push({
          id: `g_${run[0].id}`, type: 'group', label: '', sub: run.slice(),
          q: run.map((f) => String(f.label || '').replace(/\s+/g, ' ').trim()).join(' · '),
        });
        budget -= run.length - 1;
      } else run.forEach((f) => out.push(f));
      run = [];
    };
    sec.items.forEach((f) => {
      if (budget > limits.input && formIsShortText(f)) {
        /* 🔴 카드가 꽉 차면 **새 카드를 시작**한다. 예전엔 여기서 그 칸을 낱개로 흘려보내
           '5개 묶음 → 낱개 1개 → 5개 묶음'이 반복됐다(동산장학회에서 34칸이 11개로만 줄었다) */
        if (run.length >= MAX_SUB) flush();
        run.push(f);
        return;
      }
      flush();
      out.push(f);
    });
    flush();
    return Object.assign({}, sec, { items: out });
  });
  return Object.assign({}, plan, { secs });
}

/* 감사·관리자 화면용 — 프로필이 다 채워졌을 때의 최선값을 센다.
   ('이 양식을 최적화하면 몇 개인가'가 개발자가 볼 숫자다) */
const FORM_AUTO_KEYS_ALL = ['name', 'studentId', 'birth', 'major', 'school', 'email', 'phone',
  'year', 'gender', 'addr', 'emergency', 'guardianName', 'guardianRel', 'guardianPhone',
  'bank', 'account', 'bracket', 'rrn', 'yearRemain', 'gpaLast', 'campus', 'region', 'status'];

function formBudgetReport(tpl) {
  const full = {};
  FORM_AUTO_KEYS_ALL.forEach((k) => { full[k] = '(있음)'; });
  const plan = planFormQuestions(tpl, full);
  return { counts: plan.counts, over: plan.over, autoFilled: plan.autoRows.length,
           mirrored: Object.keys(plan.mirror).length };
}

/* Node(감사·검증 스크립트)에서도 같은 규칙을 쓴다 — 브라우저에는 영향 없음 */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { FORM_LIMITS, FORM_AUTO_LABELS, FORM_AUTO_KEYS_ALL,
    formLabelKey, formAutoKey, formIsSingleChoice, formIsShortText,
    formAnswerFor, planFormQuestions, formBudgetReport };
}

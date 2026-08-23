/* ============================================================
   한대장 — AI 초안 검사기 (서버·검사 드라이버 공용 · 순수 함수)
   ------------------------------------------------------------
   이 파일이 이 기능의 심장이다. 서버(worker.js)와 검사 드라이버
   (verify/verify-essay-guard.mjs)가 **같은 파일**을 쓴다.
   베껴 두면 "서버는 통과시키는데 검사는 잡는" 일이 생긴다
   (canon-url.mjs·notice-source.mjs를 한 곳으로 모은 것과 같은 이유).

   ─────────────────────────────────────────────────────────────
   무엇이 금지인가 — 2026-08-23 개발자와 다시 그은 경계선
   ─────────────────────────────────────────────────────────────
   금지인 것은 **'글을 쓰는 것'이 아니라 '사실을 만드는 것'** 이다.

     ✅ 허용 — 학생이 준 재료를 문장으로 엮기
              `등록금 부담` → "가계 사정으로 등록금 마련이 어려워…"
     ❌ 금지 — 학생이 안 준 사실 넣기
              없는 수상·봉사시간·동아리·가족사항·금액·날짜

   그래서 검사는 **'재료에 없는 사실이 들어왔나'** 하나만 본다.
   문장이 좋은지 나쁜지는 보지 않는다 — 그건 학생이 읽고 고칠 몫이다.

   ─────────────────────────────────────────────────────────────
   두 방향으로 검사한다
   ─────────────────────────────────────────────────────────────
   ① 보내기 전 — scanOutgoing()  : 민감정보가 요청에 섞였나
   ② 받은 뒤   — checkDraft()    : 재료에 없는 사실이 초안에 있나

   ①은 앱이 이미 거르지만 서버가 한 번 더 본다. 앱에 버그가 나도
   민감정보가 나가지 않아야 한다 — 두 겹으로 두는 편이 낫다.
   ============================================================ */

/* ── ① 민감정보 — 무슨 일이 있어도 나가지 않는다 ──
   개발자 승인 범위(2026-08-23): 나갈 수 있는 것은 '그 질문에 학생이 쓴 답 +
   공고의 공개 정보 + 학년/전공'뿐이다. 아래는 그 밖의 것을 잡는 그물이다. */

/* 프로필의 민감 플래그 키 (data.js FLAG_LABELS) — 키 이름만 보여도 거절한다 */
const SENSITIVE_KEYS = ['disabled', 'basicLiving', 'merit', 'account', 'accountNo', 'rrn', 'ssn', 'jumin'];

/* 글자로 드러난 민감정보 — 학생이 자기 답에 직접 적었어도 보내지 않는다.
   보내지 않는 대신 앱이 "이 문장은 민감정보라 보내지 않았어요"라고 말한다. */
const SENSITIVE_WORDS = [
  '주민등록번호', '주민번호', '기초생활수급', '차상위', '수급자',
  '국가유공자', '보훈', '장애인등록', '장애등급', '중증장애', '계좌번호',
];

/* 주민등록번호 꼴 (000000-0000000) · 계좌번호 꼴(숫자 10자리 이상 덩어리) */
const RRN_RE = /\d{6}\s*[-–]\s*[1-4]\d{6}/;
const ACCOUNT_RE = /\d[\d-]{9,}\d/;

/**
 * 요청 본문(무엇을 보내려는가)에 민감정보가 섞였는지 본다.
 * @returns {{ok:boolean, hits:string[]}}  hits 는 무엇이 걸렸는지 (사람이 읽는 말)
 */
export function scanOutgoing(payload) {
  const hits = [];
  const seen = new Set();
  const add = (why) => { if (!seen.has(why)) { seen.add(why); hits.push(why); } };

  const walk = (node, path) => {
    if (node == null) return;
    if (Array.isArray(node)) { node.forEach((v, i) => walk(v, `${path}[${i}]`)); return; }
    if (typeof node === 'object') {
      for (const [k, v] of Object.entries(node)) {
        if (SENSITIVE_KEYS.includes(k)) add(`민감 항목 '${k}'`);
        walk(v, path ? `${path}.${k}` : k);
      }
      return;
    }
    const s = String(node);
    if (RRN_RE.test(s)) add('주민등록번호 꼴');
    if (ACCOUNT_RE.test(s)) add('계좌번호 꼴');
    for (const w of SENSITIVE_WORDS) if (s.includes(w)) add(`민감 낱말 '${w}'`);
  };
  walk(payload, '');
  return { ok: hits.length === 0, hits };
}

/* ── ② 초안 검사 — 재료에 없는 사실이 들어왔나 ── */

/* 숫자가 붙은 주장 — 여기가 허위 기재가 실제로 벌어지는 자리다.
   ('3'처럼 맨숫자는 안 본다 — 재료에 거의 항상 있어 검사가 무뎌지고, 위험한 것은
    언제나 단위가 붙은 쪽이다: 120시간 · 2024년 · 300만원 · 3회 · 4.2점) */
const NUM_CLAIM_RE = /(?:19|20)\d{2}\s*년|\d+(?:\.\d+)?\s*(?:시간|회|번|개월|학점|점|등|위|명|건|권|만원|억원|원|%|퍼센트|년간|주간|개)/g;

/* 지어내면 곧바로 허위 서류가 되는 사실 낱말.
   초안에 나왔는데 재료에 그 낱말이 없으면 그 초안을 버린다. */
const AWARD_RE = /(최우수상|우수상|장려상|대상|금상|은상|동상|표창|수상|입상|선정되어|합격하여)/g;
const CERT_RE = /(토익|TOEIC|토플|TOEFL|텝스|오픽|OPIc|컴활|컴퓨터활용능력|정보처리기사|산업기사|한국사능력|자격증|면허증)/gi;

/* 고유명사 꼴 — 앞 글자 + 아래 꼬리. 재료에 없는 기관·단체를 지어낸 경우를 잡는다. */
const ORG_RE = /[가-힣A-Za-z]{2,12}(?:재단|장학회|공모전|경진대회|봉사단|동아리|협회|학회|연구소|위원회|아카데미)/g;

/** 비교할 때는 띄어쓰기·기호를 지운다 — "120 시간"과 "120시간"은 같은 말이다 */
const norm = (s) => String(s || '').replace(/[\s.,·․'"“”‘’()\[\]{}\-–—/\\]/g, '');

/**
 * 초안 한 칸을 검사한다.
 * @param {string} text      모델이 써 온 초안
 * @param {string} material  학생이 준 재료 + 공고 공개 정보를 이어붙인 글
 * @returns {{ok:boolean, reasons:string[]}}
 */
export function checkDraft(text, material) {
  const reasons = [];
  const t = String(text || '').trim();
  if (!t) return { ok: false, reasons: ['초안이 비어 있음'] };

  const mat = norm(material);
  const has = (frag) => mat.includes(norm(frag));

  /* 숫자가 붙은 주장 — 재료에 없으면 지어낸 것이다 */
  for (const m of t.match(NUM_CLAIM_RE) || []) {
    if (!has(m)) reasons.push(`재료에 없는 숫자 주장: "${m.trim()}"`);
  }
  /* 수상·자격증 — 없는 것을 적으면 자격 미달보다 나쁘다 */
  for (const re of [AWARD_RE, CERT_RE]) {
    re.lastIndex = 0;
    for (const m of t.match(re) || []) {
      if (!has(m)) reasons.push(`재료에 없는 사실: "${m}"`);
    }
  }
  /* 기관·단체 이름 */
  for (const m of t.match(ORG_RE) || []) {
    if (!has(m)) reasons.push(`재료에 없는 기관·단체: "${m}"`);
  }

  /* 같은 사유가 여러 번 나와도 한 번만 센다 */
  const uniq = [...new Set(reasons)];
  return { ok: uniq.length === 0, reasons: uniq };
}

/**
 * 이 칸에 AI를 붙여도 되는가.
 * 🔴 데이터에 적힌 kind 가 언제나 이긴다. 'story'가 **아니면** 붙이지 않는다 —
 *    빠졌거나 모르는 값이면 fact 로 본다. 애매할 때 안 건드리는 쪽이 안전한 방향이다.
 */
export function mayDraft(field) {
  return !!field && field.kind === 'story';
}

/** 재료를 한 덩어리로 — 검사와 프롬프트가 **같은 글**을 봐야 한다 */
export function materialText(payload) {
  const parts = [];
  const s = payload && payload.scholarship;
  if (s) {
    parts.push(s.name || '', s.provider || '', s.amountText || '');
    for (const q of s.quotes || []) parts.push(q);
  }
  for (const m of (payload && payload.materials) || []) parts.push(`${m.label || ''} ${m.value || ''}`);
  for (const f of (payload && payload.fields) || []) {
    parts.push(f.label || '', f.hint || '', f.answer || '');
    /* 🔴 학생이 고른 키워드가 재료의 본체다 (2026-08-23).
       이걸 빠뜨리면 검사기가 **키워드로 쓴 멀쩡한 글을 전부 지어냄으로 보고 버린다** —
       이 기능이 통째로 동작하지 않게 되는 자리라서 회귀 검사를 붙여 뒀다. */
    for (const a of f.asks || []) parts.push(`${a.q || ''} ${a.a || ''}`);
  }
  const p = payload && payload.profile;
  if (p) parts.push(p.year || '', p.major || '', p.school || '');
  return parts.filter(Boolean).join('\n');
}

/* ============================================================
   ③ 품질 검사 — '에세이'와 '제출 가능한 문서'를 가르는 층
   ------------------------------------------------------------
   🔴 왜 필요한가 (개발자 지적 2026-08-23):
      "아무 데이터도 없는 상황에서 API에게 양식 필아웃을 시키면 제출 가능 수준의
       문서가 아니라 말 그대로 '에세이'를 쓸 문제가 걱정된다."
      맞다. 지금까지 프롬프트에 적어 둔 '좋은 글'의 기준은 내가 짐작해 쓴 것이지
      근거가 없었다. 그래서 **'좋은 장학 자소서의 조건'을 규칙으로 모아**
      (data/essay-playbook.json) ⓐ 모델에게 조건으로 주고 ⓑ 받은 글을 되받아 검사한다.

   🔴 예시문을 베끼지 않는다. 규칙만 쓴다 — 표절·저작권·획일화를 셋 다 피한다.
      (경위: docs/designs/essay-tailoring.md)

   비용 0원. 정규식과 글자 수만 본다.
   ============================================================ */

/** 문단 수 — 빈 줄로 나뉜 덩어리 */
const paraCount = (t) => String(t || '').split(/\n\s*\n/).filter((p) => p.trim().length > 20).length || 1;

/**
 * 초안 한 칸의 '수준'을 본다. 통과/실패가 아니라 **고칠 곳 목록**을 돌려준다 —
 * 학생이 읽고 고치는 것이 이 기능의 전제이므로, 버리는 것보다 짚어 주는 편이 낫다.
 * @param {string} text     검사할 글 (AI 초안이든 학생이 쓴 글이든)
 * @param {object} opt      { target, ownWords: string[], checks: [] }
 * @returns {{warnings: {code:string,msg:string}[]}}
 */
export function qualityCheck(text, opt = {}) {
  const t = String(text || '').trim();
  const checks = opt.checks || [];
  const warnings = [];
  const add = (c, msg) => { if (!warnings.some((w) => w.code === c)) warnings.push({ code: c, msg }); };
  if (!t) return { warnings };

  for (const c of checks) {
    if (c.type === 'banRegex') {
      let re;
      try { re = new RegExp(c.pattern); } catch { continue; }
      if (re.test(t)) add(c.code, c.msg);
    } else if (c.type === 'banWords') {
      const hit = (c.words || []).find((w) => t.includes(w));
      if (hit) add(c.code, `${c.msg} ("${hit}")`);
    } else if (c.type === 'minParagraphs') {
      const need = Number(c.whenTargetAtLeast) || 0;
      if ((opt.target || 0) >= need && paraCount(t) < (c.min || 2)) add(c.code, c.msg);
    } else if (c.type === 'lengthBand') {
      const tg = Number(opt.target) || 0;
      const tol = Number(c.tolerance) || 0.25;
      if (tg && (t.length < tg * (1 - tol) || t.length > tg * (1 + tol))) {
        add(c.code, `${c.msg} (지금 ${t.length}자 · 목표 약 ${tg}자)`);
      }
    } else if (c.type === 'usesOwnMaterial') {
      /* 학생이 **직접 친 글**(칩이 아니라 자유 입력)의 낱말이 본문에 반영됐는가.
         반영이 하나도 없으면 그 글은 누구에게나 맞는 글이 된다 — 개발자가 걱정한 획일화가
         실제로 일어나는 지점이 여기다. */
      /* 🔴 통짜로 비교하면 안 된다 — 학생이 '새벽 아르바이트를 1년간 했어요'라고 적으면
         글에는 '새벽 아르바이트를 이어 왔습니다'처럼 다르게 들어간다. 문장 전체를 찾으면
         거의 언제나 '안 썼다'가 나와 경고가 소음이 된다. **낱말 단위로** 본다. */
      const STOP = new Set(['해요', '했어요', '합니다', '입니다', '있어요', '없어요', '그리고', '하지만', '예요', '이에요']);
      const tokens = (opt.ownWords || [])
        .flatMap((w) => String(w).split(/[\s,·/]+/))
        .map((x) => x.replace(/[.!?]/g, '').trim())
        .filter((x) => x.length >= 2 && !STOP.has(x));
      if (tokens.length) {
        const body = String(t).replace(/\s/g, '');
        /* 조사가 붙어 형태가 달라지므로 앞 2~4자로 본다 ('아르바이트를' → '아르바이트') */
        const used = tokens.some((x) => body.includes(x) || body.includes(x.slice(0, Math.max(2, x.length - 1))));
        if (!used) add(c.code, c.msg);
      }
    }
  }
  return { warnings };
}

/** 이 칸에 줄 규칙 — 전체 공통(*) + 그 종류 전용 */
export function rulesFor(playbook, kind) {
  const rs = (playbook && playbook.rules) || [];
  return rs.filter((r) => r.kind === '*' || r.kind === kind);
}

/* ============================================================
   한대장 — 제출 전 최종 점검표 (브라우저·검사 공용 · 순수 함수)
   ------------------------------------------------------------
   🔴 왜 이 파일이 있나 (2026-08-29, 양식 작성 고도화 1순위):
      설계 docs/designs/essay-submit-ready.md 는 "지금 구조에는 글을 **쓰는**
      장치는 있는데 '다 됐다'를 판정하는 장치가 없다"고 짚는다. 이 파일이
      그 '다 됐다'의 선을 만든다 — 문서를 만들기 직전에 한 화면으로 보여 주고,
      전부 초록이면 '제출 가능'이라고 말한다.

   경계선 (essay-quality.js 와 같은 계열):
      이 판정은 '글이 좋은지'가 아니라 **'제출해도 되는 문서인가'**를 본다.
        · 막는 것(block) — 그대로 내면 **사고**가 나는 것: 빈칸 `[ ]`, 블라인드
          공고에 학교 이름이 남은 것. 이 둘은 학생이 손해를 본다.
        · 짚어 주는 것(warn) — 더 좋게 만드는 제안: 분량·문체·재단 정렬·직접 쓴 이야기.

   🔴 값을 **베끼지 않는다**. 이 파일은 제출 전용 판정(빈칸·문체·블라인드 유출·
      재단 정렬)만 소유한다. 분량·직접-쓴-이야기 판정은 essay-quality.js 가 원본이라,
      호출자가 거기서 얻은 결과(불리언)를 넘겨 준다 — 문턱이 두 곳으로 갈라지지 않게.
      (essay-quality.js 가 draft-guard 와 갈라지지 않게 한 것과 같은 이유.)

   비용 0원. 정규식·글자 수만 본다. 서버가 필요 없다.

   ⚠️ 브라우저에서는 `<script src="essay-submit-check.js">` 로 전역 함수가 되고,
      Node(검사)에서는 아래 module.exports 로 가져간다. `export` 를 쓰면 브라우저
      전역이 깨지므로 절대 쓰지 말 것 (essay-quality.js·essay-ask.js 와 같은 규칙).
   ============================================================ */

/* ── 빈칸 — AI 초안이 '모르는 자리'로 일부러 비운 것(draft-guard) ──
   지어내지 않으려는 옳은 설계지만, 그대로 제출되면 안 된다.

   🔴 빈 대괄호만 세면 안 된다 (2026-08-29 수정 · 되돌리지 말 것).
      첫 판은 `[]`·`[ ]` 만 셌는데, **초안 서버가 실제로 만드는 것은 이름 붙은 자리**다:
        · `server/essay/worker.js:60` 프롬프트의 예시 자체가 `"[봉사 기관명]에서 활동하며"`
        · `verify/verify-essay-guard.mjs:95` 의 통과 예시도 `[봉사 기관명]`
      그래서 빈 대괄호만 세면 관문이 **가장 흔한 진짜 경우를 그냥 통과시킨다** —
      학생이 `[봉사 기관명]` 이 박힌 문서를 제출하게 되고, 1순위가 막으려던 사고가
      바로 그것이라 관문이 무의미해진다.

   🔴 그렇다고 대괄호를 전부 막으면 멀쩡한 글을 가둔다(block 이라 더 위험 —
      짧은 별칭을 막지 않기로 한 것과 같은 판단). 자리 표시만 고르는 조건 셋:
        ① 비어 있거나,  ② 한글이 든 짧은 이름(12자 이하)이고  ③ 숫자가 없다.
      `[붙임2]`·`[note]`·긴 인용은 그래서 안 걸린다. 자리 표시는 프롬프트가 시킨 대로
      '봉사 기관명·활동 시간' 같은 **빠진 정보의 이름**이라 언제나 이 꼴이다. */
const ESSAY_BLANK_RE = /\[[^\[\]\n]{0,12}\]/g;
const ESSAY_BLANK_HANGUL = /[가-힣]/;
const ESSAY_BLANK_DIGIT = /\d/;

/** 그 대괄호 조각이 '아직 안 채운 자리'인가 */
function essayIsBlankToken(tok) {
  const inner = String(tok || '').slice(1, -1);
  if (!inner.trim()) return true;                       // [] · [ ] · [   ]
  if (ESSAY_BLANK_DIGIT.test(inner)) return false;      // [붙임2] — 인용·붙임 표기
  return ESSAY_BLANK_HANGUL.test(inner);                // [봉사 기관명] — 빠진 정보의 이름
}

/** 찾은 자리 조각을 그대로 (같은 것은 한 번만) — 학생에게 무엇을 찾을지 보여 주려고 */
function essayBlankTokens(text) {
  const m = String(text || '').match(ESSAY_BLANK_RE) || [];
  const hit = m.filter(essayIsBlankToken);
  return hit.filter((v, i) => hit.indexOf(v) === i);
}

function essayCountBlanks(text) {
  return essayBlankTokens(text).length;
}

/* ── 문체 혼용 — 한 글 안에 '합니다체'와 '해요체'가 섞였나 ──
   문장 끝에서만 본다(인용·제목 오탐을 줄이려 끝기호나 글 끝을 요구).
   이건 warn 이라 낮은 확률의 오탐은 감수한다 — 막지 않고 제안만 한다. */
const ESSAY_END = `(?=[\\s.!?"'」』)\\]]|$)`;
const ESSAY_FORMAL_RE = new RegExp(`(습니다|합니다|입니다|됩니다|입니까|습니까|십시오)${ESSAY_END}`, 'g');
/* 해요체는 '요/죠'로 끝난다 — 게요·네요·까요·세요·해요·거죠 … 를 다 담으려면
   낱말을 하나씩 세지 말고 **문장 끝의 한글+요/죠**를 본다. 형식체(…다/…까/…오)는
   여기 안 걸리고, '중요·필요' 같은 요-끝 명사가 문장 끝에 오는 드문 경우만 오탐인데
   warn 이라 감수한다. */
const ESSAY_CASUAL_RE = new RegExp(`([가-힣][요죠])${ESSAY_END}`, 'g');
/* '요'로 끝나는 명사 — 문장 끝에 와도 해요체가 아니다('가장 중요.' '준비가 필요.').
   이걸 빼지 않으면 형식체만 쓴 글에도 문체 혼용 경고가 뜬다(코드 리뷰 지적). */
const ESSAY_YO_NOUN = new Set(['중요', '필요', '주요', '개요', '수요', '동요', '내용요']);
function essayStyleMixed(text) {
  const t = String(text || '');
  const f = (t.match(ESSAY_FORMAL_RE) || []).length;
  const c = (t.match(ESSAY_CASUAL_RE) || []).filter((m) => !ESSAY_YO_NOUN.has(m)).length;
  return f > 0 && c > 0;
}

/* ── 아직 안 채워졌나 ──
   서술형 칸은 목표가 수백 자다. 20자 미만이면 '아직 글이 없다'로 본다.
   🔴 essay-quality 의 분량 검사는 빈 글에 경고를 내지 않는다(팁에서 잔소리하지 않으려는
      옳은 설계). 그런데 그러면 **빈 자소서가 '제출 가능'으로 보인다** — 그걸 막으려고
      제출 점검표는 빈 칸을 따로 본다. */
function essayTooShort(text) {
  return String(text || '').trim().length < 20;
}

/* ── 블라인드 유출 — 블라인드 공고인데 초안에 학교 이름/별칭이 남았나 ──
   실제 위험: 코퍼스에 "학교명을 기재한 경우 심사에서 제외" 공고가 있다.
   terms = 학교 정식명 + 별칭('외대' 등). 걸린 낱말을 돌려준다(없으면 빈 배열).

   🔴 짧은 별칭은 흔한 낱말·지명과 겹친다(코드 리뷰 지적 · 이 저장소가 이미 아는 함정 —
      부산/서울/고대/연대 substring). '고대'(고대하던)·'연대'(연대 의식)를 그대로 substring
      으로 막으면 **멀쩡한 글을 실격 위험이라며 막는다**(block 이라 더 위험 — 학생을 가둔다).
      그래서 그 겹치는 짧은 별칭은 **막지 않는다**(아래 DENY). 정식 명칭·안 겹치는 별칭('외대')은
      그대로 막는다. AI 초안의 학교명은 서버 scrubSchool 이 실제로 지우고, 이 점검표는
      손으로 친 글의 그물이다 — 정식 명칭이 가장 큰 유출 경로라 거기에 집중한다.
   🔴 이 판정은 서버 scrubSchool(server/essay/draft-guard.mjs)과 두 벌이다. 서버는 어간
      변형(…대학교/…대학/…대)까지 지운다. 별칭표에 그 꼴이 이미 있으면(외대·한국외대·한외대)
      여기서도 잡히고, 없는 어간은 이 그물을 빠져나갈 수 있다 — 그때도 서버가 마지막에 지운다. */
const ESSAY_LEAK_DENY = new Set(['고대', '연대', '서울', '부산', '상주', '밀양']);
function essaySchoolLeak(text, terms) {
  const body = String(text || '');
  const seen = [];
  for (const x of terms || []) {
    if (!x || x.length < 2) continue;
    if (x.length < 4 && ESSAY_LEAK_DENY.has(x)) continue;   // 흔한 낱말·지명과 겹치는 짧은 별칭은 막지 않는다
    if (body.includes(x) && !seen.includes(x)) seen.push(x);
  }
  return seen;
}

/* ── 재단 정렬 — 이 재단이 보는 것(focus)이 글에 등장했나 ──
   focus = [{ say, re }]  (essay-ask.js 의 foundationFocus 가 감지한 테마 + 그 테마의 정규식).
   그 테마의 정규식을 **글 본문에** 대 본다. 하나도 안 나오면 '아직 안 담겼다'.
   🔴 지어내지 않는다: 공고가 아무것도 안 밝혔으면 focus 가 비어 있어 이 줄은 안 뜬다. */
function essayFocusMissing(text, focus) {
  const body = String(text || '');
  const themes = (focus || []).filter((f) => f && f.re);
  if (!themes.length) return null;                 // 공고가 밝힌 것이 없다 — 판정 안 함
  const hit = themes.filter((f) => { try { return f.re.test(body); } catch (e) { return false; } });
  return hit.length ? [] : themes.map((f) => f.say);  // 하나라도 담겼으면 통과, 아니면 빠진 것 목록
}

/* ── 조사 고르기 — '국제 역량**를** 봐요' 처럼 어색하게 나오던 것 (2026-08-29) ──
   받침이 있으면 '을/은/이', 없으면 '를/는/가'. 낱말이 따옴표·대괄호로 끝나므로
   **마지막 한글 음절**을 찾아서 본다(`[봉사 기관명]` → '명' → 받침 있음 → '을').
   한글이 하나도 없으면 받침 없는 쪽을 쓴다(영문 낱말에 '를'이 자연스럽다). */
function essayParticle(word, withBatchim, without) {
  const m = String(word || '').match(/[가-힣](?=[^가-힣]*$)/);
  if (!m) return without;
  return ((m[0].charCodeAt(0) - 0xac00) % 28) ? withBatchim : without;
}

/* ============================================================
   제출 전 점검표 — 서술형 칸 전체를 훑어 '고칠 곳/막을 곳'을 한 장으로 모은다.

   input = {
     fields: [{
       label,                   // 화면에 보일 칸 이름
       text,                    // 그 칸의 지금 글 (AI 초안이든 학생 글이든)
       blind,                   // 이 공고가 블라인드인가
       schoolTerms,             // 블라인드일 때 지워야 할 학교명·별칭
       focus,                   // [{say, re}] — 이 재단이 보는 것
       lengthWarn,              // essay-quality 가 '분량 벗어남'이라 했나 (불리언)
       ownWarn,                 // essay-quality 가 '직접 쓴 이야기 없음'이라 했나 (불리언)
     }]
   }

   returns { items:[{id,label,status,detail}], submittable, allPass }
     status: 'pass' | 'warn' | 'block'
     submittable = block 이 하나도 없다   (그대로 제출해도 사고가 안 난다)
     allPass     = 전부 pass              ('제출 가능 ✅' 배지)
   ============================================================ */
function essaySubmitChecklist(input) {
  const fields = (input && input.fields) || [];
  const items = [];
  const firstLabel = (arr) => (arr[0] && arr[0].label) ? arr[0].label.replace(/\s+/g, ' ') : '';

  /* ① 빈칸 — block. 그대로 내면 문서에 대괄호가 그대로 찍힌다.
     🔴 찾은 자리를 **그대로 보여 준다** — `[봉사 기관명]` 처럼 이름이 붙어 있어서,
        '[ ] 가 있어요'라고만 하면 학생이 글에서 무엇을 찾아야 할지 모른다. */
  const blankFields = fields.filter((f) => essayCountBlanks(f.text) > 0);
  items.push(blankFields.length
    ? { id: 'blank', label: '빈칸이 남지 않았는가', status: 'block',
        detail: `${firstLabel(blankFields)} 칸에 아직 채우지 못한 자리가 있어요 — `
          + `${(() => { const t = essayBlankTokens(blankFields[0].text).slice(0, 3);
              return `${t.join(' ')}${essayParticle(t[t.length - 1], '을', '를')}`; })()} 직접 채워 주세요` }
    : { id: 'blank', label: '빈칸이 남지 않았는가', status: 'pass', detail: '채우지 못한 자리가 없어요' });

  /* ② 블라인드 유출 — block. 블라인드 공고가 아닐 땐 이 줄을 넣지 않는다. */
  const blindFields = fields.filter((f) => f.blind);
  if (blindFields.length) {
    const leaked = blindFields
      .map((f) => ({ label: f.label, hit: essaySchoolLeak(f.text, f.schoolTerms) }))
      .filter((x) => x.hit.length);
    items.push(leaked.length
      ? { id: 'blind', label: '학교 이름을 쓰지 않았는가 (블라인드)', status: 'block',
          detail: `이 공고는 학교 이름을 쓰면 심사에서 제외돼요 — '${leaked[0].hit.join("', '")}'${essayParticle(leaked[0].hit[leaked[0].hit.length - 1], '을', '를')} 지워 주세요` }
      : { id: 'blind', label: '학교 이름을 쓰지 않았는가 (블라인드)', status: 'pass',
          detail: '학교 이름이 글에 들어 있지 않아요' });
  }

  /* ③ 분량 — warn. 규정 벗어남(essay-quality 판정 · 문턱이 갈라지지 않게)에다,
     아직 안 채워진 칸(빈 자소서)도 여기서 잡는다 — 그래야 빈 글이 '제출 가능'이 안 된다. */
  const empty = fields.filter((f) => essayTooShort(f.text));
  const overBand = fields.filter((f) => !essayTooShort(f.text) && f.lengthWarn);
  items.push(empty.length
    ? { id: 'length', label: '분량이 공고 규정 안인가', status: 'warn',
        detail: `${firstLabel(empty)} 칸이 아직 비어 있어요 — 키워드로 초안을 만들거나 직접 채워 주세요` }
    : overBand.length
    ? { id: 'length', label: '분량이 공고 규정 안인가', status: 'warn',
        detail: `${firstLabel(overBand)} 칸의 분량을 공고 규정에 맞춰 주세요` }
    : { id: 'length', label: '분량이 공고 규정 안인가', status: 'pass', detail: '분량이 적당해요' });

  /* ④ 문체 혼용 — warn. */
  const mixed = fields.filter((f) => essayStyleMixed(f.text));
  items.push(mixed.length
    ? { id: 'style', label: '문체가 섞이지 않았는가', status: 'warn',
        detail: `${firstLabel(mixed)} 칸에 '합니다체'와 '해요체'가 섞여 있어요 — 하나로 맞춰 주세요` }
    : { id: 'style', label: '문체가 섞이지 않았는가', status: 'pass', detail: '문체가 하나로 통일돼 있어요' });

  /* ⑤ 재단 정렬 — warn. 공고가 밝힌 것이 없으면(focus 없음) 이 줄을 넣지 않는다. */
  const focusRows = fields
    .map((f) => ({ label: f.label, miss: essayFocusMissing(f.text, f.focus) }))
    .filter((x) => x.miss !== null);
  if (focusRows.length) {
    const missing = focusRows.filter((x) => x.miss.length);
    items.push(missing.length
      ? { id: 'focus', label: '재단이 보는 것이 담겼는가', status: 'warn',
          detail: `이 재단은 '${missing[0].miss.join("', '")}'${essayParticle(missing[0].miss[missing[0].miss.length - 1], '을', '를')} 봐요 — 그 이야기를 한 줄 넣으면 더 맞아요` }
      : { id: 'focus', label: '재단이 보는 것이 담겼는가', status: 'pass',
          detail: '재단이 보는 것이 글에 담겨 있어요' });
  }

  /* ⑥ 직접 쓴 이야기 — warn. essay-quality 판정을 그대로 쓴다. */
  const noOwn = fields.filter((f) => f.ownWarn);
  items.push(noOwn.length
    ? { id: 'own', label: '직접 쓴 이야기가 담겼는가', status: 'warn',
        detail: `${firstLabel(noOwn)} 칸에 직접 겪은 이야기가 한 줄 들어가면 훨씬 좋아져요` }
    : { id: 'own', label: '직접 쓴 이야기가 담겼는가', status: 'pass', detail: '직접 쓴 이야기가 담겨 있어요' });

  const submittable = !items.some((i) => i.status === 'block');
  const allPass = items.every((i) => i.status === 'pass');
  return { items, submittable, allPass };
}

/* ── 브라우저 전역 (essay.js 가 부르는 이름) ── */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    essaySubmitChecklist, essayCountBlanks, essayBlankTokens, essayIsBlankToken, essayParticle, essayStyleMixed, essayTooShort,
    essaySchoolLeak, essayFocusMissing,
    ESSAY_BLANK_RE, ESSAY_FORMAL_RE, ESSAY_CASUAL_RE,
  };
}

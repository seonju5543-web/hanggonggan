/* ============================================================================
   접수 대행 — 보내기 전에 서버가 다시 본다 (2026-09-25 · 기술 고문 보고서 Q4)

   왜 만들었나 — 지금 `server/mail-worker.js` 는 **클라이언트가 준 `to`·`subject`·`text`
   를 그대로 발송**한다. 자격 검증이 한 줄도 없고 받는 주소도 클라이언트가 고른다
   (도메인 허용목록만 있다). 고문의 지적 그대로다:

     "조작된 프로필 데이터를 가진 학생이 기기에서 값을 변조하면, 검증 없이 그대로
      학교·재단에 접수 메일이 발송된다. 제출 대행을 시작하기 전, 최종 제출 내용을
      서버로 보내어 자격 요건을 백엔드에서 1회 재검증하는 로직을 반드시 추가."

   🔴 **지금은 아직 안 터진다** — 앱의 메일 버튼은 `mailto:` 라 학생 폰의 메일 앱이 열리고
      학생이 제 손으로 보낸다. 우리가 중계하는 것이 아니다. 이 파일이 막는 것은
      **Resend 자동 발송을 켜는 순간** 우리가 보내는 주체가 되는 그때다.

   🔴 **판정을 여기서 새로 만들지 않는다.** 앱과 같은 `match-engine.js` 를 불러 쓴다
      (`server/essay/draft-guard.mjs` 가 `essay-quality.js` 를 불러 쓰는 것과 같은 방식).
      여기에 규칙을 한 벌 더 두면 화면은 '적합'이라는데 서버는 막는 일이 생긴다.

   🔴 **받는 주소를 클라이언트에게서 받지 않는다.** 공고 id 로 우리 발행물에서 찾아 쓴다.
      이것이 이 파일에서 가장 값싸고 가장 크게 막는 구멍이다 — 그러지 않으면 변조된
      클라이언트가 **아무 `.ac.kr` 주소로나** 우리 이름으로 메일을 보낼 수 있다.

   🔴 **막는 쪽으로 닫힌다(fail-closed).** 공고를 못 찾거나·접수 주소가 없거나·마감이
      지났거나·자격이 미달이면 **안 보낸다.** 판단이 안 서면 보내지 않는 쪽이다.
   ========================================================================== */
import { createRequire as _cr } from 'node:module';
const ME = _cr(import.meta.url)('../../match-engine.js');

/** 자격 판정이 '보내도 된다'로 인정하는 값. 🔴 `unknown` 은 넣지 않는다 —
 *  우리가 자격을 못 읽은 공고까지 대신 보내면 앱이 확인해 준 척이 된다. */
export const SENDABLE = new Set(['eligible', 'selective']);

/** 오늘(KST 날짜)로 마감을 본다. 🔴 `dday()` 를 베끼지 않는다 — 여기서 필요한 것은
 *  라벨이 아니라 '지났는가' 하나뿐이고, 날짜끼리 비교해야 마감 당일이 살아 있다. */
export function deadlinePassed(deadline, now) {
  if (!deadline) return false;                       // 못 읽은 마감으로 막지 않는다(다른 줄이 막는다)
  const kst = new Date((now ? now.getTime() : Date.now()) + 9 * 3600 * 1000);
  const today = kst.toISOString().slice(0, 10);      // KST 기준 YYYY-MM-DD
  return String(deadline) < today;
}

/** 발행물에서 그 공고를 찾는다. 목록 모양이 둘(`{items:[]}` · `[]`)이라 여기서 맞춘다. */
export function findNotice(registered, id) {
  const list = (registered && registered.items) || registered || [];
  return list.find((x) => x && x.id === id) || null;
}

/* 🔴 **서버 사본이 특별자격·처지를 모를 수 있다** — 학생이 민감정보 동의를 안 켰으면
   `syncSafeProfile` 이 `flags`·`traits` 를 떼고 올린다. 그 상태로 특별자격 공고를 판정하면
   엔진이 `ineligible` 을 내고 이유는 *"해당 특별자격이 필요해요"* 가 된다 —
   **사실은 '없다'가 아니라 '우리가 모른다'** 다. 그 둘을 뭉개면 멀쩡한 학생에게 거짓말을 한다.
   그래서 그 경우를 먼저 가려 **무엇을 하면 되는지**를 말한다. */
function needsSensitive(notice) {
  const e = (notice && notice.eligibility) || {};
  /* 🔴 **`flagsAny` 하나뿐이다.** 실측으로 좁혔다(2026-09-26):
     · 동의로 빠지는 것은 `flags`·`traits` 둘뿐이고(`SYNC_SENSITIVE_KEYS`),
       구조화된 요건 중 그 둘과 대조하는 것은 `flagsAny` 뿐이다.
     · ⚠️ `needCert` 를 여기 넣었다가 뺐다 — `cert` 는 **동의와 무관하게 서버에 올라간다.**
       넣어 두면 진짜 미달(외국어성적 없음)을 "확인할 수 없다"고 말해 학생을 헷갈리게 한다.
     · ⚠️ 원문 자격 줄 경로(`fitDetail().fails`)는 처지가 없어도 `fails` 를 만들지 않는다
       (실측: 동의 O/X 어느 쪽도 `eligible`). 그래서 여기 넣을 것이 없다.
     🔴 넓히려면 **먼저 재고** 넓힌다 — 넓히면 진짜 미달이 '모름'으로 새어 나간다. */
  return Array.isArray(e.flagsAny) && e.flagsAny.length > 0;
}

/* 🔴 **있을 수 없는 값은 판정 전에 막는다** (2026-09-26 · 고문 보고서 Q6)

   고문의 지적: *"데이터 내용 검증은 클라이언트가 아닌 DB 제약 혹은 서버에서 수행한다."*
   실제 구멍은 이렇다 — 변조한 앱이 학생 **본인 토큰**으로 우리 사본에 `gpa: 999` 를 써 넣으면
   (RLS 는 '자기 행'만 보므로 이것은 막지 않는다), 엔진의 `minGpa` 를 뭐라고 적어 둬도
   **전부 통과한다.** 서버가 사본을 읽는다는 것만으로는 이걸 못 막는다.

   두 겹으로 막는다:
     ① DB — `supabase/migrations/0004_profile_columns.sql` 의 CHECK 가 **쓰기 자체를 거절**한다.
     ② 여기 — 그래도 한 번 더 본다. 0004 를 붙여넣기 **전에** 올라간 행은 검사를 안 받았고,
        서버가 'DB 설정이 되어 있을 것'을 전제하면 안 된다(fail-closed 원칙).

   🔴 아래 숫자는 0004 의 CHECK 와 **같아야 한다.** 관문 `verify/verify-apply-guard.mjs` 가
      그 SQL 을 읽어 숫자가 어긋나면 실패한다 — 한쪽만 고치면 거기서 잡힌다.
   ⚠️ 글자 길이는 여기서 보지 않는다. 1만 자 학교 이름은 어떤 요건과도 안 맞아 **저절로
      떨어지므로**, 판정을 뒤집는 숫자 칸만 본다(막을 수 있는 것만 막는다고 적는다). */
export const PROFILE_BOUNDS = {
  gpa: [0, 4.5],          // index.html #in-gpa        min=0    max=4.5
  year: [1, 8],           // 온보딩 칩은 1~4 · 초과학기·대학원까지 여유
  bracket: [1, 10],       // 학자금지원구간
  credits: [0, 30],       // index.html #in-credits    min=0    max=30
  birthYear: [1940, 2020],// index.html #in-birth-year min=1940 max=2020
};
/* 🔴 위 넷(`gpa`·`credits`·`birthYear`)의 숫자는 **`index.html` 의 입력칸 min/max 와 같다.**
   입력칸을 넓히면서 여기를 안 넓히면 **정상 학생의 저장이 거절된다** — 관문
   `verify/test-collector.mjs` 「프로필 개별 칸 · DB 검증」 이 두 곳을 대조한다.
   ⚠️ `credits`·`birthYear` 를 뒤늦게 더했다(2026-09-26 코드 리뷰). 둘 다 판정을 뒤집는다 —
      실측: '15학점 이상' 줄에서 `credits: 999999` 가 통과하고, `birthYear: 3000` 은
      나이가 **음수**가 되어 '만 30세 이하'를 통과했다. 새 칸을 만들면 여기도 같이 본다. */

/* 0 은 '안 골랐다'다 — app.js `Number(getChip('#in-year'))` 가 빈 칩에서 0 을 만든다.
   0 을 미달로 읽으면 학년을 안 고른 정상 학생을 막는다. 성적·이수학점의 0 은 진짜 0 이다. */
const ZERO_IS_UNKNOWN = new Set(['year', 'bracket']);

/** 숫자로 읽는다. 읽을 수 없으면 `NaN` — **`null`(모른다)과 구분해야 한다.** */
function numOrNaN(v) {
  if (v === null || v === undefined || v === '') return null;   // 모른다
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;                          // 읽을 수 없다
}

/** 있을 수 없는 값이 있으면 그 칸 이름, 없으면 빈 문자열. */
export function profileOutOfRange(p) {
  if (!p || typeof p !== 'object') return '';
  for (const key of Object.keys(PROFILE_BOUNDS)) {
    const n = numOrNaN(p[key]);
    if (n === null) continue;                                   // 모른다 → 엔진이 'unknown' 으로 둔다
    /* 🔴 **읽을 수 없는 값을 통과시키면 안 된다** (2026-09-26 코드 리뷰에서 잡았다).
       처음에는 "엔진 비교가 전부 false 라 저절로 미달로 떨어진다"고 적고 통과시켰는데,
       **실측하니 반대였다** — 엔진은 `else if (p.gpa < min) 미달; else 충족` 꼴이라
       `gpa: '사점일'` 이 *"성적 요건 충족"* 으로 나온다(`{}` 도 같다). 즉 읽을 수 없는 값은
       미달이 아니라 **통과**다. 0004 의 CHECK 는 그것을 이미 `-1` 로 거절하고 있었으므로
       서버만 뚫려 있었던 셈이다. 두 겹이 같은 말을 하게 여기서도 막는다. */
    if (Number.isNaN(n)) return key;
    if (n === 0 && ZERO_IS_UNKNOWN.has(key)) continue;
    const [lo, hi] = PROFILE_BOUNDS[key];
    if (n < lo || n > hi) return key;
  }
  return '';
}

const BOUND_LABEL = { gpa: '성적(학점)', year: '학년', bracket: '학자금지원구간',
                      credits: '이수학점', birthYear: '출생연도' };

/**
 * 보내도 되는가 — 보낼 주소까지 **여기서** 정해 돌려준다.
 *
 * 🔴 **프로필을 payload 에서 받지 않는다** (2026-09-26). 넷째 인자로 **서버가 읽어 온 것**을
 *    받는다(`send-log.mjs loadProfile`). 요청 본문의 프로필로 판정하면 기기에서 성적을 고친
 *    학생이 그대로 통과해, '서버 재검증'이라는 이름만 남는다.
 *
 * @param {{noticeId:string}} payload   클라이언트가 보낸 것 — **공고 id 만 쓴다**
 * @param {object} registered           우리 발행물(data/registered.json)
 * @param {Date|null} now
 * @param {{profile:object, sensitiveOk:boolean}|null} held  서버가 가진 프로필
 * @returns {{ok:boolean, to?:string, notice?:object, why?:string, code?:string}}
 */
export function validateSubmission(payload, registered, now, held) {
  const id = payload && payload.noticeId;
  if (!id || typeof id !== 'string') return { ok: false, why: '공고를 지정하지 않았습니다' };

  const notice = findNotice(registered, id);
  if (!notice) return { ok: false, why: '우리가 아는 공고가 아닙니다' };

  /* 🔴 주소는 **공고에서** 온다. payload 의 to 는 쳐다보지 않는다. */
  const to = String(notice.applyEmail || '').trim();
  if (!to) return { ok: false, why: '이 공고는 메일 접수처가 확인되지 않았습니다' };

  /* 근거 문장이 없는 주소는 로봇이 넣은 것이 아니다 — 등록 규칙과 같은 기준으로 한 번 더 본다. */
  if (!String(notice.applyEmailSource || '').includes(to)) {
    return { ok: false, why: '접수 주소의 근거 문장이 없습니다' };
  }

  if (deadlinePassed(notice.deadline, now)) return { ok: false, why: '접수가 마감된 공고입니다' };

  /* 🔴 **서버가 가진 프로필만** 본다. payload.profile 은 쳐다보지 않는다. */
  const p = held && held.profile;
  if (!p || typeof p !== 'object') {
    return { ok: false, code: 'no_profile',
      why: '프로필이 서버에 올라와 있지 않습니다 (앱에서 로그인해 한 번 저장해 주세요)' };
  }

  /* 🔴 있을 수 없는 값이면 판정하지 않는다 — 통과시키면 그게 바로 변조 통과다. */
  const bad = profileOutOfRange(p);
  if (bad) {
    return { ok: false, code: 'profile_bad',
      why: `프로필의 ${BOUND_LABEL[bad] || bad} 값이 올바르지 않습니다 (앱에서 다시 저장해 주세요)`,
      field: bad };
  }

  /* 🔴 학교 한정 공고를 남의 학교 학생이 내지 못하게 — 앱과 같은 함수로 본다. */
  if (!ME.scopedToProfile([notice], p).length) {
    return { ok: false, code: 'scope', why: '이 공고를 낼 수 있는 학교·캠퍼스가 아닙니다' };
  }

  const r = ME.evaluate(notice, p) || {};
  if (!SENDABLE.has(r.status)) {
    /* '없다'와 '모른다'를 가른다 — 위 needsSensitive 주석 참조. */
    if (needsSensitive(notice) && !(held && held.sensitiveOk)) {
      return { ok: false, code: 'sensitive_off',
        why: '특별자격을 서버가 확인할 수 없습니다 (설정에서 민감정보 동의를 켜면 대신 낼 수 있어요)' };
    }
    return { ok: false, code: 'not_eligible',
      why: '지원 자격을 충족하지 않습니다', status: r.status, reasons: r.reasons };
  }
  return { ok: true, to, notice };
}

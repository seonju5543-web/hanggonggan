/* ============================================================================
   '이 공고는 메일로 접수하는가 · 어디로 보내는가' 판정 한 곳 (2026-09-23 신설)

   왜 만들었나 — 2026-09-02 에 경희·한국외대 공고 121건을 사람이 직접 열어 접수 채널을
   갈랐고, 그중 **이메일 접수 13건**을 찾아냈다. 그런데 그 결과가 기술 고문 요청서(PDF)에만
   남고 **앱 데이터에는 한 칸도 안 들어갔다.** 그래서 `applyEmail` 은 등록 68건 중 0건이고,
   앱의 '접수 메일 열기' 버튼은 한 번도 뜬 적이 없다 — 가장 비싼 수작업의 결과가 증발했다.

   🔴 **이 버튼은 서버도 열쇠도 필요 없다.** `app.js` 가 `mailto:` 로 학생 폰의 메일 앱을
      열고 제목·본문을 채워 준다(app.js `btn-mail-apply`). 요청서는 이것을 "코드는 있고
      키만 없습니다"라고 적었는데 사실이 아니다 — 없는 것은 **대상 데이터**다.
      Resend 워커(server/mail-worker.js)는 '완전 자동 발송'용이고 그건 다음 단계다.

   🔴 **주소를 지어내지 않는다** (원칙 8-1). 원문 한 줄을 근거로 남기고(`applyEmailSource`),
      감사가 "주소가 그 문장 안에 실제로 들어 있는가"를 본다. 근거 없는 주소는 못 들어온다.

   🔴 **문의처는 접수처가 아니다.** 실측한 8건 중 4건이 문의·담당자 줄이었다. 메일 주소가
      있다고 다 접수처면, 학생이 장학팀 문의 메일함으로 신청서를 보낸다.

   🔴 **남이 내는 것은 학생이 내는 것이 아니다.** 미래의동반자재단 공고에 이런 줄이 있다 —
      「(또는 **교수님이** 장학복지팀으로 제출하는 것도 가능함/ scholarship@ewha.ac.kr ...)」
      제출이라는 낱말이 있고 주소도 있지만 **보내는 사람이 교수**이고 주소는 **이화여대**다.
      우리 학생에게 그 버튼을 띄우면 남의 학교 메일함으로 신청서가 간다.
      가르는 자리는 조사다: `관재팀 이메일로 제출`(받는 곳)과 `교수님이 … 제출`(보내는 사람).

   쓰는 곳: collector/extract-excerpts.mjs (본문 경로 · 첨부 경로 둘 다 — 베끼지 말 것)
   관문:    verify/test-collector.mjs 「메일 접수 주소」 절 · verify/audit-data.js
   ========================================================================== */

export const MAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;

/* 내는 행위를 말하는 줄만 본다. `- 이메일 : scholarship@hufs.ac.kr` 처럼 동사가 없는 줄은
   문의 안내 블록 안에 있는 경우가 많아(실측) 받지 않는다. */
const SUBMIT_VERB = /(제출|접수|송부|발송|보내)/;

/* 문의·담당자 줄 — 같은 주소가 접수처이기도 하면 아래 '제출' 줄에서 따로 잡힌다.
   ⚠️ 넓히지 말 것: `안내`·`신청` 을 넣으면 `신청서를 … 제출` 이 통째로 걸린다. */
const INQUIRY = /(문의|담당자|연락처|궁금)/;

/* 🔴 **보내는 사람이 학생이 아닌 줄.** 조사(이/가/께서)가 붙어 있는지로 가른다 —
   `관재팀 이메일로 제출`(받는 곳)은 조사가 `로` 라 안 걸리고,
   `교수님이 … 제출`(보내는 사람)은 걸린다. */
const OTHER_SENDER = /(교수|지도교수|추천인|추천자|학과장|담당자|소속\s*기관)\s*(님)?\s*(이|가|께서)/;

/* 이름표가 대놓고 접수처라고 말하는 줄이 가장 믿을 만하다 — 여럿이면 이쪽을 먼저 고른다. */
const EXPLICIT = /(접수\s*주소|접수처|제출처|접수\s*방법|제출\s*방법|지원\s*방법)/;

/** 한 줄이 '학생이 여기로 낸다'고 말하는가 — 판정 근거를 통째로 돌려준다. */
export function judgeLine(line) {
  const text = String(line || '').replace(/\s+/g, ' ').trim();
  const m = text.match(MAIL_RE);
  if (!m) return null;
  if (INQUIRY.test(text)) return { ok: false, why: '문의처', addr: m[0], line: text };
  if (OTHER_SENDER.test(text)) return { ok: false, why: '제3자 제출', addr: m[0], line: text };
  if (!SUBMIT_VERB.test(text)) return { ok: false, why: '내는 행위가 없음', addr: m[0], line: text };
  return { ok: true, explicit: EXPLICIT.test(text), addr: m[0], line: text };
}

/**
 * 공고 글(본문 또는 첨부)에서 접수용 메일 주소 하나를 고른다.
 * @param {string} text  공고 원문
 * @returns {{email: string, source: string} | null}  근거 문장을 함께 돌려준다
 */
export function findApplyEmail(text) {
  const lines = String(text || '').split('\n');
  let best = null;
  for (const raw of lines) {
    const v = judgeLine(raw);
    if (!v || !v.ok) continue;
    /* 이름표가 있는 줄이 이긴다. 같은 급이면 **먼저 나온 줄**을 쓴다 —
       공고는 접수 방법을 앞에 적고 뒤에 부연을 단다. */
    if (!best || (v.explicit && !best.explicit)) best = v;
  }
  if (!best) return null;
  /* 근거 문장은 화면·감사가 그대로 읽는다. 길면 자르되 주소는 반드시 남긴다. */
  let source = best.line;
  if (source.length > 200) {
    const i = source.indexOf(best.addr);
    const from = Math.max(0, i - 90);
    source = (from ? '… ' : '') + source.slice(from, i + best.addr.length + 90).trim() + ' …';
  }
  return { email: best.addr, source };
}

/** 사람(관리자·AI)이 정한 값은 로봇이 덮지 않는다 — 마감일의 `humanOwned` 와 같은 규칙. */
export const humanOwnedEmail = (from) => /^(AI|관리자)/.test(from || '');

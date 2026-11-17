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
/* 🔴 이름표가 **신청 방법**이고 그 값이 메일이면 내는 행위를 말한 줄이다 (2026-11-16 · 한국건설교통신기술협회 요강
   「ㅇ 신청방법 : 이메일(kcna@kcna.or.kr) 및 우편(등기)」 — 동사가 없어 마감 이틀 전 메일 접수 공고 셋의 '접수 메일 열기'가 안 떴다).
   값이 **메일로 시작할 때만**(`신청방법 : 이메일(…)`) — 이름표 없는 `- 이메일 : …` 줄(문의 블록에 많다)은 여전히 받지 않는다 */
const METHOD_IS_MAIL = /(?:신청|접수|제출|지원|응모)\s?방법\s*[:：]\s*(?:이\s?메일|e-?mail|메일|전자\s?우편)/i;

/* 문의·담당자 줄 — 같은 주소가 접수처이기도 하면 아래 '제출' 줄에서 따로 잡힌다.
   ⚠️ 넓히지 말 것: `안내`·`신청` 을 넣으면 `신청서를 … 제출` 이 통째로 걸린다. */
const INQUIRY = /(문의|담당자|연락처|궁금)/;

/* 🔴 **보내는 사람이 학생이 아닌 줄.** 조사(이/가/께서)가 붙어 있는지로 가른다 —
   `관재팀 이메일로 제출`(받는 곳)은 조사가 `로` 라 안 걸리고,
   `교수님이 … 제출`(보내는 사람)은 걸린다. */
const OTHER_SENDER = /(교수|지도교수|추천인|추천자|학과장|담당자|소속\s*기관)\s*(님)?\s*(이|가|께서)/;

/* 이름표가 대놓고 접수처라고 말하는 줄이 가장 믿을 만하다 — 여럿이면 이쪽을 먼저 고른다. */
const EXPLICIT = /(접수\s*주소|접수처|제출처|접수\s*방법|제출\s*방법|지원\s*방법)/;

/* 🔴 **오류가 났을 때만 쓰는 예비 길** (2026-10-05 점검 app1-04 · 고려대 송화재단 실례).
   원문 6항은 「신청방법: 방문 제출 또는 온라인 신청」이고 메일 줄은
   「※ 온라인 신청 오류 발생 시 scholarship@korea.ac.kr로 제출」 — 정상 접수처가 아니다.
   큰 '접수 메일 열기' 버튼을 띄우면 학생은 정상 경로 대신 예비 메일함으로 신청서를 낸다. */
const FALLBACK_ONLY = /(오류|장애|불가피|부득이|문제|접속\s*불가|시스템\s*점검)\s*(가|이)?\s*(발생\s*)?(시|할\s*경우|한\s*경우|하는\s*경우|되는\s*경우|경우에?(만|는)?)(?![가-힣])/;

/* 🔴 **신청은 다른 곳에서 끝나고 메일은 서류만 받는 줄** (같은 날 · 연세대 신문고장학금 실례).
   「'새글'버튼을 눌러서 신청서 작성 후 저장해야 장학금 신청 완료됨) 관련 제출서류는 scholar@yonsei.ac.kr로」 —
   메일로 신청서를 보내면 신청이 안 된다. 두 조건이 **같은 줄에 함께** 있을 때만 거른다:
   ① 메일이 아닌 곳에서 끝나는 행위(저장해야 · 새글 · 홈페이지/포털/시스템에서 신청) ② 주소 바로 앞이 '서류'.
   ⚠️ '…로 제출하면 신청이 완료됩니다' 같은 진짜 메일 접수 줄은 받아야 한다 — '신청 완료' 낱말 하나로 거르지 말 것.
   ⚠️ 원문에 따라 두 말이 **바로 앞 줄**에 갈라져 있다(같은 연세 공고의 다른 판 — 「…저장해야 장학금 신청 완료됨)」 ↵ 「관련 제출서류는 …로 보내」).
      그래서 findApplyEmail 은 앞 두 줄을 `before` 로 넘긴다. '신청서·양식'을 받는 곳(「홈페이지에서 신청서 다운로드」)은 다른 경로가 아니다(`(?!서|양식)`). */
const ELSEWHERE_DONE = /(저장해야|작성\s*후\s*저장|새\s*글|(홈페이지|포털|포탈|시스템|사이트)\s*(에서|을\s*통해|를\s*통해)\s*(온라인\s*)?(신청|작성)(?!서|양식))/;
const DOCS_BY_MAIL = /서류[^@\n]{0,20}[A-Za-z0-9._%+-]+@/;

/* 🔴 **신청은 시스템·포털로 끝나고, 메일은 뽑힌 뒤 단계의 서류만 받는 공고** (2026-11-17 · 상명대 근로장학 실례 auto-enoticedoarticleno770333).
   「8. 신청방법: 샘물통합정보시스템 신청 선착순 선발」 → 「9. 선발자 안내: …」 → 「10. 신청서 제출: …」 「<이메일 제출처: hajinpark@smu.ac.kr >」 —
   메일은 **선발된 뒤** 근로부서 서명 신청서를 내는 곳이다. 그 주소로 '접수 메일 열기'를 띄우면 학생은 선착순 시스템 신청을 건너뛰고
   메일만 보낸다(관리자가 11-16 에 손으로 비웠다 — 규칙이 그대로면 다른 학교·다른 회차에서 또 들어온다).
   한 줄만 봐서는 못 가른다(「제출처」 이름표 + 주소라 가장 믿을 만한 줄로 보인다) — 글 전체를 보는 findApplyEmail 에서 **두 조건이 함께일 때만** 거른다:
     ① 신청방법 이름표의 값이 메일이 아닌 길(시스템·포털·홈페이지·방문·우편…)이고 그 값에 메일 낱말이 없다
     ② 그 줄 **뒤** · 메일 줄**까지** 사이에 선발 뒤 단계를 여는 줄(선발자 안내·선정 결과 발표·선발 후·합격자 …)이 있다
   ⚠️ 신청방법 값에 메일이 있으면(「신청방법 : 이메일(kcna@…) 및 우편」) 그대로 받는다 ·
      자격 줄의 「국가근로장학생 선발자는 … 신청 불가」는 신청방법 줄보다 **앞**이라 세지 않는다(그래서 ②는 '뒤'만 본다).
   🔴 신청방법 줄은 메일 줄에서 **가장 가까운 앞 줄**(그 줄 자신 포함)을 본다 — 장학금 여럿을 한 글에 적은 공고는 절마다 신청방법이 다르다
      (「1. 성적우수 · 신청방법: 학생포털 · 선발결과 발표」 → 「2. 지역인재 · 신청방법: 이메일 접수 · 제출처: …@」 — 리뷰 3차 2026-11-17).
      글의 첫 신청방법 줄만 보면 뒤 절의 진짜 접수 메일을 버리고, 발췌기 소급(staleInTexts)이 이미 들어간 주소까지 지운다.
      가장 가까운 신청방법 줄이 메일을 말하거나 메일 아닌 길을 말하지 않으면 그대로 받는다(헷갈리면 거르지 않는다). */
const METHOD_LABEL = /(?:신청|접수|지원|응모|제출)\s?방법\s*[:：]\s*(.+)$/;
const OTHER_CHANNEL = /(시스템|포털|포탈|홈페이지|사이트|방문|우편|등기|온라인)/;
const MAIL_WORD = /(이\s?메일|e-?mail|메일|전자\s?우편|@)/i;
const AFTER_SELECTION = /((선발|선정|합격)\s?(자|결과)\s?(안내|발표|통보|공지|확인)|(선발|선정|합격)\s?(완료\s?)?(후|이후)(?![가-힣])|(선발|선정|합격)(된|되신)\s?(학생|자|분|경우))/;
/** i 번째 줄(자신 포함)에서 가장 가까운 앞 신청방법 줄 — { at, other } (없으면 null).
 *  other = 그 값이 메일이 아닌 길(시스템·포털·방문·우편…)이고 메일 낱말이 없다 */
function nearestMethodAt(lines, i) {
  for (let j = i; j >= 0; j -= 1) {
    const m = String(lines[j] || '').replace(/\s+/g, ' ').trim().match(METHOD_LABEL);
    if (m) return { at: j, other: OTHER_CHANNEL.test(m[1]) && !MAIL_WORD.test(m[1]) };
  }
  return null;
}

/** 한 줄이 '학생이 여기로 낸다'고 말하는가 — 판정 근거를 통째로 돌려준다.
 *  @param {string} line    판정할 줄
 *  @param {string} [before] 바로 앞 줄들(있으면) — '신청은 다른 곳에서 끝난다'가 앞 줄에 있는 꼴만 본다 */
export function judgeLine(line, before = '') {
  const text = String(line || '').replace(/\s+/g, ' ').trim();
  const m = text.match(MAIL_RE);
  if (!m) return null;
  if (INQUIRY.test(text)) return { ok: false, why: '문의처', addr: m[0], line: text };
  if (OTHER_SENDER.test(text)) return { ok: false, why: '제3자 제출', addr: m[0], line: text };
  if (FALLBACK_ONLY.test(text)) return { ok: false, why: '예외 경로(오류·불가피 시)', addr: m[0], line: text };
  if ((ELSEWHERE_DONE.test(text) || ELSEWHERE_DONE.test(String(before || ''))) && DOCS_BY_MAIL.test(text)) {
    return { ok: false, why: '신청은 다른 경로 — 메일은 서류만', addr: m[0], line: text };
  }
  if (!SUBMIT_VERB.test(text) && !METHOD_IS_MAIL.test(text)) return { ok: false, why: '내는 행위가 없음', addr: m[0], line: text };
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
  for (let i = 0; i < lines.length; i += 1) {
    const v = judgeLine(lines[i], lines.slice(Math.max(0, i - 2), i).join(' '));
    if (!v || !v.ok) continue;
    /* 이 메일 줄의 절에서 신청은 다른 길 + 메일 줄은 선발 뒤 단계(위 METHOD_LABEL 머리말) — 접수처가 아니다 */
    const method = nearestMethodAt(lines, i);
    if (method && method.other && lines.slice(method.at + 1, i + 1).some((l) => AFTER_SELECTION.test(l))) continue;
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

/**
 * 이미 들어간 로봇 값이 **지금 규칙으로는 접수처가 아닌가** (2026-10-05 점검 app1-04 · 원칙 7 소급).
 * 발췌기(fillApplyEmail)는 applyEmail 이 있으면 다시 보지 않아서, 규칙을 고쳐도 이미 들어간 값은 그대로 남았다.
 * 발췌기가 매 실행 모든 항목에 이것을 먼저 묻고, 참이면 세 칸을 지운 뒤 새 규칙으로 다시 찾는다.
 * 🔴 사람(관리자·AI)이 넣은 값은 건드리지 않는다.
 * ⚠️ 근거 문장은 길면 주소 앞뒤 90자로 잘려 있다(findApplyEmail) — 잘린 탓에 '내는 낱말'이 창 밖으로 나간 것은
 *    지우지 않는다(본문이 없는 날이면 다시 찾지 못해 멀쩡한 주소를 잃는다).
 */
export function staleApplyEmail(it) {
  if (!it || !it.applyEmail || humanOwnedEmail(it.applyEmailFrom)) return false;
  const src = String(it.applyEmailSource || '');
  const v = judgeLine(src);
  if (v && v.ok) return false;
  if (v && v.why === '내는 행위가 없음' && /^…|…$/.test(src.trim())) return false;
  return true;
}

/**
 * 🔴 **글 전체를 봐야 갈리는 규칙의 소급** (2026-11-17 · 원칙 7 · 위 METHOD_LABEL 머리말).
 * staleApplyEmail 은 근거 한 줄만 보므로 '신청은 시스템 · 메일은 선발 뒤 단계'처럼 글 전체로 가르는 규칙을 못 본다
 * (조선대 빛고을장학재단 첨부의 「* 철회요청 접수 이메일 주소 : …@korea.kr」 — 개인정보 동의 철회 메일함이 '접수 메일'로 들어가 있었다).
 * 그래서 **근거 문장이 든 원문(본문·첨부)이 손에 있을 때만**, 지금 규칙이 그 글에서 이 주소를 더는 고르지 않으면 참.
 * 원문이 없거나 근거 문장이 든 글이 하나도 없으면 거짓 — 본문 없는 날 멀쩡한 주소를 잃지 않는다(staleApplyEmail 의 ⚠️ 와 같은 까닭).
 * 🔴 사람(관리자·AI)이 넣은 값은 건드리지 않는다.
 * @param {object} it
 * @param {string[]} texts  발췌기가 접수 메일을 찾을 때 읽는 글 그대로(본문 · 자른 첨부 글)
 */
export function staleInTexts(it, texts) {
  if (!it || !it.applyEmail || humanOwnedEmail(it.applyEmailFrom)) return false;
  const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim();
  const src = norm(it.applyEmailSource).replace(/^…\s*/, '').replace(/\s*…$/, '');
  if (!src) return false;
  const holding = (texts || []).filter((t) => t && norm(t).includes(src));
  if (!holding.length) return false;
  return !holding.some((t) => (findApplyEmail(t) || {}).email === it.applyEmail);
}

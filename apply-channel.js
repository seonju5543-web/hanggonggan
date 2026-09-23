/* ============================================================
   신청 채널 판정 규칙 — **원본은 여기 하나** (2026-09-02)
   공고 원문에서 '학생이 어디에 무엇을 내는가'를 정한다.

   🔴 베끼지 말 것 — 조사 로봇(scan-two-schools.mjs)과 재분류 도구가 같은 파일을 쓴다.
      갈라지면 "로봇은 포털이라 하고 보고서는 이메일이라 하는" 일이 생긴다.

   🔴 판정은 **신청·접수 방법을 말하는 줄 안에서만** 한다 (2026-09-02 코드 리뷰에서 잡은 결함).
      본문 아무 데나 훑으면 두 가지가 반드시 오탐이 된다 —
        ① 게시판 껍데기의 '웹메일'·바닥글 담당자 주소 때문에 거의 모든 공고가 '이메일 접수'가 된다
        ② 상단 메뉴의 '학사행정'·'포털' 글자 때문에 거의 모든 공고가 '포털 입력형'이 된다
      이 앱이 이미 저지르고 있는 잘못(모르면 포털이라고 부르기)을 조사 도구가 반복하면 안 된다.

   🔴 '문의' 줄은 근거가 아니다 — `문의: xxx@hufs.ac.kr` 은 접수처가 아니라 물어볼 곳이다.

   🔴 **브라우저·Node 겸용이다** (2026-09-21 — `collector/apply-channel.mjs` 에서 옮겨 왔다).
      옮긴 이유: 앱(`data.js submitChannelLabel`)이 "모르는 공고"를 **포털형이라고 단정**하고
      있었는데(등록 68건 중 44건이 그 문구 · 그중 42건은 근거 없음), 그걸 고치려면 앱도
      '근거가 있는가'를 물어야 했다. 규칙을 data.js 에 베끼면 이 파일 첫머리가 경고한
      오탐 ②가 앱에서 그대로 되살아나므로, 베끼지 않고 **같은 파일을 싣는다**
      (section-head.js · match-engine.js 와 같은 방식).
      `collector/apply-channel.mjs` 는 이 파일을 다시 내보내는 얇은 껍데기로 남아 있어
      조사 로봇 둘은 고치지 않아도 그대로 돈다.
   ============================================================ */

/* 신청·접수 방법을 말하는 줄 (근거 후보) */
const METHOD_LINE = /(신청\s*방법|접수\s*방법|제출\s*방법|지원\s*방법|신청\s*절차|접수\s*처|제출\s*처|제출\s*서류|신청\s*기간|접수\s*기간|신청\s*방식|어떻게\s*신청|신청\s*및|접수\s*및|제출\s*기한)/;

/* 근거로 쓰면 안 되는 줄 — 물어볼 곳이지 낼 곳이 아니다 */
const NOT_EVIDENCE = /^(문의|담당|담당자|연락처|문의처)\s*[:：]/;

/* 어디에 있든 그 자체로 채널을 말하는 강한 문구 (메뉴·바닥글에는 안 나온다) */
const STRONG = {
  '한국장학재단': /한국장학재단\s*(홈페이지|누리집|앱)|kosaf\.go\.kr|국가장학금\s*신청|국가근로장학금\s*신청/,
  /* ⚠️ 이름과 조사 사이에 괄호가 끼는 실제 표기가 있다 — `종합정보시스템(포털)에서 온라인 신청`
     (면학장학금 실측). 괄호를 못 넘어서 **진짜 포털 공고를 '미확인'으로 흘리고 있었다.**
     조사(에서·로) 요구는 그대로 둔다 — 그게 상단 메뉴 오탐을 막는 장치다. */
  /* 🔴 **조사 `로` 뒤에 `그인` 이 오면 그건 조사가 아니다** (2026-09-23 실측).
     `다 . 선발확인 : HUFS Ability 로그인 후 …` 이 접수처로 잡혔다 — 그 줄은 **결과를 보는
     화면**이지 내는 곳이 아니다. 한 글자 겹침이라 눈으로는 안 보이고 관문만이 잡는다. */
  '학교 시스템 입력형': /종합정보시스템\s*(?:\([^)]{0,20}\))?\s*(에서|로(?!그인)|을|>|＞)|HUFS\s?Ability\s*(?:\([^)]{0,20}\))?\s*(에서|로(?!그인)|을|>|＞)|학사정보시스템\s*(에서|로(?!그인))|학생지원시스템\s*(에서|로(?!그인))|포털\s*(에서|로)\s*신청|온라인\s*신청\s*[:：]?\s*\(?\s*(종합정보|포털|HUFS|인포\s?21)|인포\s?21\s*(을|를|에서|으로|로(?!그인)|신청|접수)/,
  '이메일 접수': /(이메일|메일|전자우편)\s*(로|으로)?\s*(접수|제출|송부|발송)|메일\s*접수|이메일\s*접수/,
  '방문·우편 접수': /방문\s*(접수|제출)|우편\s*(접수|제출)|직접\s*(제출|접수)|사무실\s*(로|에)\s*제출/,
  '구글폼·설문 접수': /구글\s*폼|docs\.google\.com\/forms|forms\.gle|네이버\s*폼/,
};

/* 방법 줄 안에서만 인정하는 약한 신호 */
const WEAK = {
  '한국장학재단': /한국장학재단|국가장학금|국가근로/,
  /* 🔴 학교마다 포털 이름이 다르다 — 경희대는 **인포21**(INFO21)이다 (2026-09-02 첨부 원본 실측:
     `5. 신청방법 : 인포21 장학신청 메뉴로 신청`). 이름을 모르면 그 학교는 통째로 '미확인'이 되고,
     그건 "포털 신청이 없다"로 잘못 읽힌다. 학교를 늘릴 때 이 목록부터 채울 것.
     ⚠️ 여기(약한 신호)에 두는 것이 중요하다 — '인포21'은 경희대 사이트 **상단 메뉴에도** 있어서
        강한 문구로 올리면 거의 모든 공고가 포털형이 된다(이 파일 첫머리의 오탐 ② 그대로). */
  '학교 시스템 입력형': /종합정보시스템|HUFS\s?Ability|학사행정|통합정보시스템|학생지원시스템|학교\s*포털|포털|인포\s?21|INFO\s?21/i,
  '이메일 접수': /[\w.+-]+@[\w-]+\.[\w.]{2,}/,
  '방문·우편 접수': /제출\s*처\s*[:：]|접수\s*처\s*[:：]/,
  '재단·외부 사이트 신청': /재단\s*(홈페이지|누리집)|홈페이지\s*(에서|를\s*통해)\s*(온라인)?\s*신청|온라인\s*접수/,
};

const FORM_ATT = /신청서|지원서|양식|서식|원서|동의서/;

/* 🔴 부정문을 긍정으로 읽지 말 것 (2026-09-02 red-green 검사에서 잡음) —
   `이메일 접수 (※우편접수 불가)` 를 '우편 접수'로 세고 있었다.
   걸린 자리 바로 뒤에 부정어가 붙으면 그 줄은 그 채널의 근거가 아니다. */
const NEGATED = /^\s*(불가|불허|제외|아님|안\s*됨|하지\s*않|않습니다|없음)/;
function matchOn(line, re) {
  const m = re.exec(line);
  if (!m) return null;
  const tail = line.slice(m.index + m[0].length, m.index + m[0].length + 10);
  return NEGATED.test(tail) ? null : line;
}

/**
 * 공고 하나의 신청 채널을 정한다.
 * @param {{body?:string, lines?:string[], methodLines?:string[], attachments?:string[]}} item
 * @returns {{kind:string, evidence:string, how:'강한 문구'|'방법 줄'|'첨부'}[]}
 */
function classifyChannels(item) {
  const all = item.lines
    || String(item.body || '').split(/\n+/).map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const method = (item.methodLines && item.methodLines.length ? item.methodLines : all.filter((l) => METHOD_LINE.test(l)))
    .filter((l) => !NOT_EVIDENCE.test(l));

  const hits = [];
  const take = (kind, evidence, how) => {
    if (hits.some((h) => h.kind === kind)) return;
    hits.push({ kind, evidence: String(evidence || '').replace(/\s+/g, ' ').slice(0, 180), how });
  };

  // ① 본문 어디에 있든 인정하는 강한 문구
  for (const [kind, re] of Object.entries(STRONG)) {
    const line = all.find((l) => !NOT_EVIDENCE.test(l) && matchOn(l, re));
    if (line) take(kind, line, '강한 문구');
  }
  // ② 방법 줄 안에서만 인정하는 약한 신호
  for (const [kind, re] of Object.entries(WEAK)) {
    const line = method.find((l) => matchOn(l, re));
    if (line) take(kind, line, '방법 줄');
  }
  // ③ 그래도 없으면 — 첨부에 신청서가 있다는 사실만 적는다(제출처는 모른다고 말한다)
  if (!hits.length && (item.attachments || []).some((a) => FORM_ATT.test(a))) {
    take('첨부 양식만 있음(제출처 미확인)', `첨부: ${(item.attachments || []).join(', ')}`, '첨부');
  }
  /* 같은 줄을 두 번 세지 않는다 — 한국장학재단 안내를 '외부 재단 사이트'로도 세면 현황이 부풀려진다 */
  const kosaf = hits.find((h) => h.kind === '한국장학재단');
  const out = hits.filter((h) => !(h.kind === '재단·외부 사이트 신청' && kosaf && h.evidence === kosaf.evidence));
  return out.length ? out : [{ kind: '미확인', evidence: '', how: '근거 없음' }];
}

/* ============================================================================
   포털 '어느 시스템인가' 읽기 (2026-09-23 신설)

   왜 시스템 이름까지 읽나 — 지금 앱이 포털 공고에 하는 말은 학교 포털 주소 하나뿐이라
   (`app.js schoolPortalNote`) 학생이 로그인한 다음부터는 혼자 헤맨다. 공고 원문에는
   **길이 통째로 적혀 있다**: `로그인 → 교과/비교과 → 장학신청 목록 → 해당 장학금 선택`.
   그 길은 **공고마다가 아니라 시스템마다 같다**(실측: HUFS Ability 공고 11건이 전부 같은 길).
   그래서 공고에서는 '어느 시스템인지'만 읽고, 길은 시스템 표(data.js)에서 꺼낸다.

   🔴 **한 학교가 시스템을 둘 쓴다** — 한국외대는 신청이 `HUFS Ability`, 계좌 등록이
      `종합정보시스템`이다. 한 공고에 둘 다 나오므로 아무거나 고르면 학생을 계좌 화면으로
      보낸다. 그래서 **내는 행위를 말하는 줄에서 읽은 것만** 쓴다.
   🔴 **시스템 이름이 나온다고 접수처가 아니다** (실측 18건 중 여럿):
        `장학금 신청서 (HUFS Ability 다운로드)`   → 양식 받는 곳
        `선발확인 : HUFS Ability 로그인 후 …`      → 결과 보는 곳
        `지급방법 : 계좌 지급 (종합정보시스템 …)` → 입금 계좌
      전부 버린다. 남기면 학생이 엉뚱한 화면에서 '신청 버튼이 없다'고 막힌다.
   ========================================================================== */

/* 이 줄이 '내는 행위'를 말하는가 — 위 오탐 셋을 가르는 자리 */
const PORTAL_NOT_SUBMIT = /(다운로드|내려받|선발\s*확인|결과\s*확인|신청내역\s*확인|지급\s*방법|계좌)/;
const PORTAL_SUBMIT = /(신청|접수|지원)\s*(방법|방식|절차|접수)?|온라인\s*신청/;

/* 시스템 이름 → 표준 열쇠. 🔴 열쇠는 `data.js` 의 포털 표와 **같은 글자**여야 한다
   (관문이 두 곳을 대조한다 — 갈라지면 길을 못 찾아 안내가 통째로 사라진다). */
const PORTAL_SYSTEMS = [
  ['HUFS Ability', /HUFS\s?Ability|허프스\s?어빌리티/i],
  ['종합정보시스템', /종합정보시스템/],
  ['인포21', /인포\s?21|INFO\s?21/i],
];

/** 한 줄이 '이 시스템으로 낸다'고 말하는가 — 근거를 통째로 돌려준다. */
function judgePortalLine(line) {
  const text = String(line || '').replace(/\s+/g, ' ').trim();
  const sys = PORTAL_SYSTEMS.find(([, re]) => re.test(text));
  if (!sys) return null;
  if (NOT_EVIDENCE.test(text)) return { ok: false, why: '문의처', system: sys[0], line: text };
  if (PORTAL_NOT_SUBMIT.test(text)) return { ok: false, why: '내는 곳이 아님', system: sys[0], line: text };
  if (!PORTAL_SUBMIT.test(text)) return { ok: false, why: '내는 행위가 없음', system: sys[0], line: text };
  return { ok: true, explicit: METHOD_LINE.test(text), system: sys[0], line: text };
}

/**
 * 공고 글에서 '어느 학교 시스템으로 내는가'를 고른다.
 * @returns {{system: string, source: string} | null}  근거 문장을 함께 돌려준다
 */
function findApplyPortal(text) {
  const lines = String(text || '').split('\n');
  let best = null;
  for (const raw of lines) {
    const v = judgePortalLine(raw);
    if (!v || !v.ok) continue;
    if (!best || (v.explicit && !best.explicit)) best = v;
  }
  if (!best) return null;
  let source = best.line;
  if (source.length > 220) source = source.slice(0, 220).trim() + ' …';
  return { system: best.system, source };
}

/* 브라우저(앱1·관리자 화면)와 Node(로봇·검사)가 **같은 판정**을 쓰게 한다.
   🔴 베끼지 말 것 — 사본이 생기는 순간 이 파일 첫머리의 오탐 ①②가 한쪽에서 되살아난다. */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { classifyChannels, METHOD_LINE, NOT_EVIDENCE,
                     findApplyPortal, judgePortalLine, PORTAL_SYSTEMS };
}

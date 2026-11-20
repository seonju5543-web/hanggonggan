/* ============================================================
   한대장 — 대장님 말귀 (chat-nlu.js · 2026-11-20 개발자 지시)
   ------------------------------------------------------------
   개발자 지시: *"사용자가 오타를 내거나, 같은 의미에서 변형된 말을 해도 알아듣고
   질문에 대한 답을 제시해줄 수 있어야 해."*

   여기는 **말을 알아듣는 곳**이고 답은 만들지 않는다 — 답의 사실은 chat-kb.js(앱 사용법·인사)와
   chat.js(공고 — 앱이 이미 가진 데이터)에 있다. AI 를 쓰지 않는다(비용 0 · 비행기 모드에서도 동작 ·
   질문이 기기 밖으로 나가지 않는다).

   알아듣는 방법 세 겹
     ① 고쳐 읽기 — 줄임말·소리 나는 대로 쓴 말(`어케`·`머야`·`알랴줘`·`ㄱㅅ`)을 바른 말로 바꾼다(CHAT_FIX).
     ② 띄어쓰기 무시 — 폰 입력은 띄어쓰기가 제멋대로다. 비교는 공백을 다 뺀 글자로 한다.
     ③ 자모 비교 — 글자를 ㄱ·ㅏ 같은 자모로 풀어 두 글자씩 겹치는 정도(다이스 계수)로 잰다.
        음절째 비교하면 오타 한 자가 두 조각을 망가뜨리지만, 자모로 풀면 한 자모만 틀린다 —
        `마깜 임박`·`서루 뭐 준비해` 같은 오타가 원래 말과 거의 같은 점수를 받는다.

   🔴 문턱은 **보수적으로**. 못 알아들으면 '못 찾았다'고 하는 것이 엉뚱한 답보다 낫다(chat.js 머리말).
      `쿼카 사육 지원금 있어?` 같은 질문이 인사·사용법 답으로 새면 안 된다 — 관문이 지킨다
      (test-collector 「대장님 말귀」).
   ============================================================ */

/* ---------------- ① 고쳐 읽기 ----------------
   [찾을 꼴, 바꿀 말] — 위에서부터 차례로 바꾼다. 낱말 경계 없이 바꾸므로 **다른 낱말 속에 들어갈 수
   있는 짧은 꼴은 넣지 않는다**(예: '넘' → '너무' 는 '넘어' 를 망가뜨린다). */
const CHAT_FIX = [
  [/안뇽|안냥|아뇽|안넝|안뇨옹/g, '안녕'],
  [/세여(?=\s|$|[?!.~])/g, '세요'],
  [/해여(?=\s|$|[?!.~])/g, '해요'],
  [/([와되해나까데죠세돼봐줘써어])여(?=\s|$|[?!.~])/g, '$1요'],   // `안와여`·`되나여` — 말끝의 '여'만(`참여`는 그대로)
  [/어딨어|어딧어|어딨|어딧|어디써/g, '어디 있어'],
  [/뭐임|머임/g, '뭐야'],
  [/알랴\s?줘|알려\s?죠|알러\s?줘|알여\s?줘|알료\s?줘|알려\s?조|알랴\s?주/g, '알려줘'],
  [/갈켜\s?줘|갈쳐\s?줘|가르켜\s?줘|가리켜\s?줘|갈켜\s?주/g, '알려줘'],
  [/어케|어캐|어떡해|어뜨케|어떠케|어떻케|어떻해|어떡케|우째|어찌/g, '어떻게'],
  [/머야|모야|뭐임|머임|뭐냐|머냐|뭐여|뭐얌|머얌|무ㅓ야/g, '뭐야'],
  [/뭔데|먼데|몬데/g, '뭔데'],
  [/머해|모해|뭐함|머함/g, '뭐해'],
  [/뭘까|멀까/g, '뭘까'],
  [/잇어|잇나|잇음|있음\?/g, '있어'],
  [/업어|업나|없음\?/g, '없어'],
  [/됌|됨\?|되요|돼요\?/g, '돼요'],
  [/됬/g, '됐'],
  [/왜케|왤케|왜이렇게/g, '왜 이렇게'],
  [/ㄱㅅ|ㄳ|감사감사|땡큐|땡스|\bthx\b|\bthanks\b|\bthank you\b/g, '고마워'],
  [/ㅎㅇ|하이루|하이요|ㅎ2|\bhi\b|\bhello\b|헬로/g, '안녕'],
  [/ㅂㅇ|ㅂ2|바이바이|빠이|\bbye\b/g, '잘가'],
  [/ㅇㅋ|오키|오케이|\bok\b|\bokay\b/g, '알겠어'],
  [/^\s*(?:ㅇㅇ|ㅇ|웅|ㅇㅋㅇㅋ)\s*$/g, '응'],
  [/ㄴㄴ/g, '아니'],
  [/ㅈㅅ|ㅈㅅㅈㅅ|쏘리|\bsorry\b/g, '미안'],
  [/장학굼|장학긍|장하금|장악금|쟝학금|잔학금|장학ㄱ/g, '장학금'],
  [/국장(?!학)/g, '국가장학금'],
  [/(?:주민\s?등록\s?)?등본/g, '주민등록등본'],
  [/가관증|가족\s?관계\s?증명서?/g, '가족관계증명서'],
  [/성적표|성증(?!명)|성적\s?증명서?/g, '성적증명서'],
  [/재증(?!명)|재학\s?증명서?/g, '재학증명서'],
  [/자소서/g, '자기소개서'],
  [/신쳥|싱청|신천|신청ㅇ/g, '신청'],
  [/마깜|마김|마검|마감ㅇ/g, '마감'],
  [/서루|서뷰|소류/g, '서류'],
  [/링크좀|링크 좀/g, '링크'],
  [/어플|애플리케이션|애플리캐이션|\bapp\b/g, '앱'],
  [/알람/g, '알림'],
  [/로긴|로그인ㅇ/g, '로그인'],
  [/로갓|로그아웃ㅇ/g, '로그아웃'],
  [/회탈|회원 탈퇴/g, '탈퇴'],
  [/북마크|즐찾|즐겨찾기|찜/g, '저장'],
  [/프사/g, '프로필 사진'],
  [/ㅠ+|ㅜ+/g, ' '],
  [/ㅋ{2,}|ㅎ{2,}/g, ' ㅋㅋ '],
];

function nluFix(s) {
  let t = String(s || '').normalize('NFC').toLowerCase();
  for (const [re, to] of CHAT_FIX) t = t.replace(re, to);
  /* 같은 글자를 셋 넘게 이어 치면 둘로 — `안녕하세요오오오`·`???` */
  t = t.replace(/(.)\1{2,}/g, '$1$1');
  return t;
}

/* 비교용 글자 — 고쳐 읽고, 기호·공백을 전부 뺀다(②). */
const NLU_ROMAN = { 'ⅰ': '1', 'ⅱ': '2', 'ⅲ': '3', 'ⅳ': '4', 'ⅴ': '5', 'Ⅰ': '1', 'Ⅱ': '2', 'Ⅲ': '3', 'Ⅳ': '4', 'Ⅴ': '5' };
function nluNorm(s) {
  /* 공고 이름의 로마 숫자(`국가장학금 Ⅰ유형`)를 학생이 치는 숫자(`1유형`)로 */
  return nluFix(s).replace(/[ⅰ-ⅴⅠ-Ⅴ]/g, (c) => NLU_ROMAN[c] || c).replace(/[^0-9a-zㄱ-ㅎㅏ-ㅣ가-힣]/g, '');
}

/* 말끝을 떼어 '알맹이'만 남긴다 — `서류 뭐 준비해요?` 와 `서류 뭐 준비해` 를 같은 것으로.
   여러 번 떼므로(`알려주세요` → `알려줘`·`주세요` 순) 위에서부터 길게 적는다. */
const NLU_TAILS = [
  '알려줄수있어', '알려줄래', '알려주실래요', '알려주세요', '알려주라', '알려줘봐', '알려줘', '알려', '가르쳐줘', '말해줘', '말해봐',
  '궁금해요', '궁금해', '궁금함', '궁금',
  '해주세요', '해줄래', '해줘', '해봐', '주세요', '줄래', '줘',
  '인가요', '일까요', '입니까', '인지', '인가', '일까', '이에요', '예요', '에요', '이야', '이냐', '이니',
  '나요', '까요', '는지', '는가', '니', '냐', '지', '죠', '요', '야', '좀', '음',
];
/* 낱말 끝 토씨 — `홈에 금액은 뭐야` 와 `홈 금액 뭐야` 를 같게. '이'·'가' 는 낱말 끝 글자일 때가 많아 안 뗀다 */
const NLU_PARTICLE = /([가-힣]{2,})(?:에서|으로|은|는|을|를|에|의|도|로)(?=\s|$)/g;
function nluCore(s) {
  let t = nluNorm(nluFix(s).replace(NLU_PARTICLE, '$1'));
  for (let i = 0; i < 4; i++) {
    const before = t;
    for (const tail of NLU_TAILS) {
      if (t.length > tail.length + 1 && t.endsWith(tail)) { t = t.slice(0, -tail.length); break; }
    }
    if (t === before) break;
  }
  return t;
}

/* ---------------- ③ 자모로 풀기 ----------------
   한 음절 = 초성 + 중성 (+ 종성). 겹받침·겹모음은 쪼개지 않는다 — 쪼개면 짧은 낱말이 서로 너무 닮는다. */
const NLU_CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
const NLU_JUNG = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ';
const NLU_JONG = ' ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ';
function nluJamo(s) {
  let out = '';
  for (const ch of String(s || '')) {
    const c = ch.charCodeAt(0) - 0xac00;
    if (c < 0 || c > 11171) { out += ch; continue; }
    out += NLU_CHO[Math.floor(c / 588)] + NLU_JUNG[Math.floor((c % 588) / 28)];
    const jong = c % 28;
    if (jong) out += NLU_JONG[jong];
  }
  return out;
}

/* 두 글자씩 조각 — 같은 조각이 여러 번 나오면 여러 번 센다(다중집합) */
function nluGrams(s) {
  const m = new Map();
  for (let i = 0; i + 2 <= s.length; i++) {
    const g = s.slice(i, i + 2);
    m.set(g, (m.get(g) || 0) + 1);
  }
  if (!m.size && s) m.set(s, 1);   // 한 글자짜리도 비교는 된다
  return m;
}
function nluOverlap(a, b) {
  let n = 0;
  const [small, big] = a.size <= b.size ? [a, b] : [b, a];
  small.forEach((v, k) => { const w = big.get(k); if (w) n += Math.min(v, w); });
  return n;
}
function nluSize(m) { let n = 0; m.forEach((v) => { n += v; }); return n; }

/* 미리 계산해 둔 비교 재료 — 문장 수천 개를 질문마다 다시 풀면 느리다 */
function nluPrep(text) {
  const core = nluCore(text);
  const jamo = nluJamo(core);
  const grams = nluGrams(jamo);
  return { text, core, jamo, grams, size: nluSize(grams) };
}

/* 두 문장의 닮음 0~1.
   · 다이스 = 겹친 조각 × 2 / (두 조각 수 합)
   · 덮음 = 학습 문장 조각 중 질문에 있는 비율 — `안녕 대장님` 처럼 학습 문장에 말을 덧붙여도 잡는다.
     🔴 덮음만 크게 쓰면 짧은 학습 문장(`안녕`)이 긴 질문 속 어디에나 걸린다. 그래서 질문이
        학습 문장보다 훨씬 길면 덮음을 깎는다(길이 비). */
function nluSim(q, u) {
  if (!q.size || !u.size) return 0;
  if (q.core === u.core) return 1;
  const ov = nluOverlap(q.grams, u.grams);
  const dice = (2 * ov) / (q.size + u.size);
  const cover = ov / u.size;
  const ratio = Math.min(1, u.size / q.size);
  const contained = cover * (0.55 + 0.45 * ratio);
  return Math.max(dice, contained * 0.96);
}

/* ---------------- 의도 가르기 ----------------
   intents = [{ id, utter: [문장…] }] → 가장 닮은 의도와 점수.
   두 번째로 닮은 **다른** 의도와의 차이(margin)도 돌려준다 — 둘이 비슷하면 확신이 낮은 것이다. */
function nluBuildIndex(intents) {
  const rows = [];
  for (const it of intents) {
    for (const u of it.utter || []) {
      const p = nluPrep(u);
      if (p.core) rows.push({ id: it.id, p });
    }
  }
  return rows;
}

function nluClassify(index, text) {
  const q = nluPrep(text);
  if (!q.core) return null;
  const best = new Map();   // id → { score, utter }
  for (const r of index) {
    const s = nluSim(q, r.p);
    const cur = best.get(r.id);
    if (!cur || s > cur.score) best.set(r.id, { score: s, utter: r.p.text });
  }
  const ranked = [...best.entries()].sort((a, b) => b[1].score - a[1].score);
  if (!ranked.length) return null;
  const [id, top] = ranked[0];
  const second = ranked[1] ? ranked[1][1].score : 0;
  return { id, score: top.score, utter: top.utter, margin: top.score - second, core: q.core };
}

/* ---------------- 공고 이름 찾기 ----------------
   "○○ 장학금 지원 자격 알려줘" 에서 '○○ 장학금' 이 어느 공고인지. 이름은 길고 괄호·기관명이 섞여 있어
   통째 다이스로는 약하다 → **질문 알맹이가 이름의 어느 토막과 얼마나 겹치는가**(자모 조각 덮음)로 잰다.
   묻는 말(자격·링크·마감 …)은 미리 떼어 내고 남은 글자로 잰다(nluStripAsk).

   names = [{ key, names: [이름 후보…] }] → [{ key, score }] 높은 순 */
function nluNameScore(qCore, name) {
  /* 이름 쪽도 흔한 말(장학금·재단…)을 똑같이 뺀다 — 질문에서만 빼면 `국가1유형` 이 `국가장학금1유형` 속에 안 든다 */
  const n = nluNorm(String(name || '').replace(NLU_GENERIC, ' '));
  if (!qCore || !n) return 0;
  if (qCore.length >= 2 && n.includes(qCore)) return 0.9 + 0.1 * Math.min(1, qCore.length / n.length);
  /* 오타 봐주기 — **세 글자 이상**, 이름 속 **같은 길이 토막**과 자리마다 견줘 **한 글자**(다섯 글자 이상은 두 글자)만
     다르고, 다른 글자끼리도 첫소리나 모음이 같을 때(`유흥슈`↔`유흥수` · `국세쳥`↔`국세청`)만 같은 이름으로 본다.
     🔴 자모 조각을 이름 전체와 견주면 긴 이름일수록 우연히 다 들어 있어 `드림` 이 엉뚱한 공모전에,
        `준비해` 가 `창업준비 아카데미` 에 걸렸다(2026-11-20 실측) — 그래서 자리를 맞춰 견준다. */
  if (qCore.length < 3) return 0;
  const allow = qCore.length >= 5 ? 2 : 1;
  const near = (a, b) => {
    const x = nluJamo(a), y = nluJamo(b);
    return x[0] === y[0] || (x[1] && x[1] === y[1]);
  };
  for (let i = 0; i + qCore.length <= n.length; i++) {
    let miss = 0;
    for (let k = 0; k < qCore.length && miss <= allow; k++) {
      const a = qCore[k], b = n[i + k];
      if (a !== b) miss += near(a, b) ? 1 : allow + 1;
    }
    if (miss <= allow) return 0.88 - 0.03 * (miss - 1);   // 오타 맞음은 글자 그대로 맞음(0.9~)보다 늘 아래
  }
  return 0;
}

/* 이름 찾기에서 **어느 공고에나 있는 말**은 뺀다 — `장학금 자격 알려줘` 의 '장학금' 하나로
   모든 공고가 '이름에 들어 있다'로 걸리면 안 된다(chat.js CHAT_STOP 과 같은 사고). */
const NLU_GENERIC = /(장학\s?재단|장학\s?금|장학\s?회|장학|대학교|대학|학교|재단|사업|프로그램|모집|선발|공고|안내|지원\s?금|대외\s?활동|공모전|그거|그것|이거|저거)/g;

function nluFindByName(text, entries, limit = 3) {
  /* 한 글자 토막(남은 토씨·말끝 `해`·`야`)은 이름이 아니다 */
  const toks = nluStripAsk(text).replace(NLU_GENERIC, ' ').split(/\s+/).map(nluNorm).filter((w) => w.length >= 2);
  if (!toks.length) return [];
  /* 이어진 토막 묶음마다 재고 가장 좋은 것 — `유흥수 뽑아` 의 '뽑아' 같은 남은 말이 점수를 깎지 않게.
     🔴 짧은 묶음만 맞으면 조금 깎는다(전체 글자 중 쓴 비율) — 남은 말 하나가 우연히 이름에 걸리는 것을 줄인다. */
  const total = toks.join('').length;
  const spans = [];
  for (let i = 0; i < toks.length && i < 6; i++) {
    for (let j = i; j < toks.length && j < i + 4; j++) {
      const q = toks.slice(i, j + 1).join('');
      if (q.length >= 2) spans.push({ q, w: 0.85 + 0.15 * (q.length / total) });
    }
  }
  return entries.map((e) => {
    let best = 0;
    for (const nm of e.names) {
      if (!nm) continue;
      for (const sp of spans) best = Math.max(best, nluNameScore(sp.q, nm) * sp.w);
    }
    return { key: e.key, score: best };
  })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/* ---------------- 무엇을 묻는가 (공고 한 건의 칸) ----------------
   공고 한 건에 대해 물을 수 있는 칸 — chat.js 가 칸마다 **앱이 가진 원문**으로 답한다.
   [칸, 꼴] 위에서부터 먼저 걸린 것. 🔴 '서류'는 '신청 방법'보다 먼저(`제출 서류`), '링크'는 '신청'보다 먼저
   (`신청 페이지 링크`). 꼴은 고쳐 읽은 글자(nluFix)에 대어 본다 — 띄어쓰기 변형을 \s? 로 받는다. */
const NLU_FIELDS = [
  ['link', /(링크|원문|주소|url|사이트|홈페이지|홈피|바로\s?가기|웹\s?페이지|페이지|게시글|게시물|공지\s?글|원본\s?공고|공고\s?문\s?(?:어디|보|열))/],
  ['documents', /(서류|증명서|준비물|구비|제출\s?물|첨부\s?서류|뭐\s?떼|무엇을\s?(?:내|제출))/],
  ['attach', /(첨부\s?파일|첨부|양식|신청서|서식|다운\s?로드|다운|hwp|한글\s?파일|pdf)/],
  ['announce', /(발표|결과\s?(?:언제|발표|나와)|합격\s?(?:발표|자\s?발표)|선정\s?(?:발표|결과))/],
  ['deadline', /(마감|언제\s?까지|기한|접수\s?기간|신청\s?기간|모집\s?기간|지원\s?기간|며칠\s?까지|데드\s?라인|deadline|기간|일정|언제\s?(?:신청|접수|지원|내|해)|시작\s?(?:일|해|하))/],
  ['amount', /(금액|얼마|액수|지원\s?금(?!\s?있)|장학\s?금액|받는\s?돈|돈\s?(?:얼마|은)|만\s?원|혜택\s?(?:이|은|뭐)|얼만)/],
  ['how', /(어떻게\s?(?:신청|지원|접수|내|제출|해)|신청\s?(?:방법|하는\s?법|하는\s?방법|경로|절차|어디)|접수\s?(?:방법|처|어디)|지원\s?(?:방법|절차)|제출\s?(?:방법|처|어디)|어디(?:에|서)\s?(?:신청|내|제출|접수|지원)|절차)/],
  ['contact', /(문의|연락처|전화\s?번호|전화|이메일|메일\s?주소|담당\s?자|담당\s?부서|물어\s?볼\s?곳)/],
  ['count', /(몇\s?명|인원|선발\s?인원|모집\s?인원|티오|\bto\b)/],
  ['dup', /(중복|이중\s?수혜|같이\s?받|동시\s?(?:에\s?)?(?:수혜|받)|다른\s?장학금)/],
  ['provider', /(주관|주최|어디서\s?(?:주|하)|누가\s?주|기관|재단\s?(?:이|은|어디)|어느\s?(?:재단|기관))/],
  ['elig', /(자격|조건|대상|누가\s?(?:신청|지원|받)|지원\s?가능|신청\s?가능|요건|기준|해당\s?(?:돼|되|되나)|받을\s?수\s?있|나도\s?(?:돼|되|가능)|될까|되나|가능\s?(?:해|한가|할까))/],
  ['summary', /(정보|내용|요약|설명|자세히|상세|어떤\s?(?:장학금|공고)|뭐야|뭔데)$/],
];
function nluField(text) {
  const t = nluFix(text);
  for (const [field, re] of NLU_FIELDS) if (re.test(t)) return field;
  return null;
}

/* 이름을 찾기 전에 **묻는 말**을 떼어 낸다 — 남은 글자가 공고 이름이다.
   `유흥수 장학금 지원 자격 알려줘` → `유흥수 장학금` */
const NLU_ASK_WORDS = /(알려\s?줘|알려\s?주세요|알려|보여\s?줘|궁금해요?|궁금|뭐야|뭔데|뭐예요|뭐에요|어떻게\s?돼|어디야|어디예요|있어|있나요|있나|좀|요$|\?|!|의|공고|장학\s?생|모집|선발|안내|링크|원문|주소|사이트|홈페이지|바로\s?가기|페이지|게시글|자격|조건|대상|요건|기준|마감|기한|언제\s?까지|언제|기간|일정|금액|얼마|액수|서류|증명서|첨부\s?파일|첨부|양식|신청서|신청\s?방법|접수\s?방법|지원\s?방법|방법|어떻게|신청|지원|접수|제출|발표|결과|문의|연락처|전화\s?번호|담당자|인원|몇\s?명|중복|주관|주최|기관|정보|내용|요약|설명|자세히|상세|해당|가능|받을\s?수|나도|될까|되나|돼|해줘|줘|확인|어디서|어디에|어디|보는\s?법|보려면|볼\s?수|봐|준비\s?(?:해|하|할|물)?|뭐|무엇|무슨|어떤|필요|해야|하나요|할까|하면|돼요|되요|있어요|없어|좋을까)/g;
function nluStripAsk(text) {
  return nluFix(text).replace(NLU_ASK_WORDS, ' ')
    /* 낱말 끝 토씨 하나 — 낱말 **속**의 '이'·'가'(이공계·가톨릭)는 건드리지 않는다 */
    .replace(/([가-힣])(?:은|는|을|를|의|이|가|에|도|로|으로)(?=\s|$)/g, '$1')
    .replace(/\s+/g, ' ').trim();
}

/* ---------------- 위기의 말 ----------------
   장학금 앱이라도 학생이 이런 말을 남기면 **장학금 이야기를 하지 않는다** — 도울 수 있는 곳을 먼저 말한다.
   🔴 오타·띄어쓰기에 상관없이 잡아야 해서 공백을 뺀 글자(nluNorm)에 댄다. */
const NLU_CRISIS = /(죽고싶|죽고십|자살|극단적선택|살기싫|살고싶지않|사라지고싶|목숨|뛰어내리|손목긋|자해)/;
function nluCrisis(text) { return NLU_CRISIS.test(nluNorm(text)); }

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    nluFix, nluNorm, nluCore, nluJamo, nluPrep, nluSim, nluBuildIndex, nluClassify,
    nluField, nluStripAsk, nluFindByName, nluNameScore, nluCrisis, CHAT_FIX, NLU_FIELDS,
  };
}

/* ============================================================
   금액 읽기 · 합칠 수 있는가 판정 — 한 곳 (2026-08-27 신설)

   왜 만들었나 (실측):
     등록 224건 중 **216건(96%)이 금액 0**이었다. auto-register.mjs 가 `amountValue: 0`을
     그냥 박고 파싱을 한 번도 시도하지 않았기 때문이다(예전에 500,000원을 지어내다
     걸려서 0으로 되돌린 흔적 — CLAUDE.md 참조). 못 읽은 게 아니라 안 읽고 있었다.

   🔴 그런데 금액만 채우면 홈 합계는 **더 틀린다**. 세 가지가 겹쳐 있다:
     ① 동일성 — (재)가송재단 장학금이 8개 학교 접수분으로 **8건 등록**돼 있고 전부
        schoolOnly 표시가 없다. 금액을 채우면 같은 장학금 하나가 4,000만원으로 세어진다.
     ② 표현   — `수업료 100%`·`등록금 전액` 처럼 **등록금 비율**로만 적힌 공고가 55건.
        숫자 한 칸(amountValue)으로는 표현할 수 없어 영영 0으로 남는다.
     ③ 합산   — 원문 547건 중 **66건에 이중수혜 조항**이 있고 방향이 양쪽 다 있다
        (`중복 수혜 가능` / `이중수혜 금지`). 그냥 더하면 학생이 실제로 받을 수 없는
        숫자가 되고, 그건 기망이다(개발자 지적 2026-08-27).

   그래서 이 파일은 '얼마인가'만이 아니라 **'합쳐도 되는가'까지** 답한다.
   순수 함수만 있다 — 불러도 아무것도 실행되지 않는다(canon-url.mjs 와 같은 계열).
   브라우저·서비스워커·Node(수집기·감사·검사)가 **같은 파일**을 쓴다. 베끼지 말 것.
   ============================================================ */

/* 절 가르기는 section-head.js 한 곳에 있다. 여기에 정규식을 복사해 두면
   화면과 수집기가 서로 다른 절을 읽게 된다(2026-08-24 자격 사고와 같은 유형). */
var PA_SH = (typeof module !== 'undefined' && module.exports)
  ? require('./section-head.js')
  : { isAmountHead: isAmountHead, isQualifyHead: isQualifyHead, isExcludeHead: isExcludeHead,
      isSelectHead: isSelectHead, isSectionBreak: isSectionBreak };

/* ── 금액 종류 ────────────────────────────────────────────────
   'fixed'   절대액        — 100만원, 1,000,000원
   'ratio'   등록금 비율   — 수업료 100%, 등록금의 50%, 등록금 전액
   'range'   범위          — 1백만원 ~ 2백만원
   'hourly'  시간 연동     — 시급 12,790원 (활동 시간에 따라 달라져 합산 불가)
   'unknown' 못 읽음       — 0원. 지어내지 않는다.
   ────────────────────────────────────────────────────────── */

/* 한글 수 표기까지 읽는다. `1백만원`은 실제 원문에 있다(중앙대 성림장학금). */
var WON_PATTERNS = [
  { re: /(\d[\d,]*)\s*억\s*(\d[\d,]*)?\s*만?\s*원?/, mul: 100000000 },
  { re: /(\d[\d,]*)\s*천\s*만\s*원/,                  mul: 10000000 },
  { re: /(\d[\d,]*)\s*백\s*만\s*원/,                  mul: 1000000 },
  { re: /(\d[\d,]*)\s*만\s*원/,                       mul: 10000 },
  { re: /(\d[\d,]{5,})\s*원/,                         mul: 1 }
];

/* 등록금 비율 — `전액`은 100%, `반액`은 50%로 읽는다(원문이 그 뜻으로 쓴다). */
var RATIO_RE = /(등록금|수업료)\s*(의)?\s*(전액|반액|절반|(\d{1,3})\s*%)|(전액)\s*(면제|감면|지원)/;
/* `시급 12,790원` 뿐 아니라 `10,320원/시간`·`12,790원/h` 도 시급형이다 —
   국가근로·교내근로 공고가 대부분 뒤쪽 꼴로 적는다(2026-08-27 전수 조사). */
var HOURLY_RE = /(시급|시간당)\s*[\d,]+\s*원|[\d,]+\s*원\s*\/\s*(시간|시|h|H)|활동\s*시간\s*기준|시간\s*단위/;

/* 금액이 아닌 숫자를 금액으로 읽지 않기 위한 최소선.
   5만원 미만은 대개 수수료·보험료·서류 부수라 금액으로 보지 않는다. */
var MIN_WON = 50000;

/* 🔴 1인당인가, 사업 전체 규모인가 — 이걸 안 가르면 한 카드가 25배로 부푼다.
   가톨릭대 이원길장학금 원문이 실제로 이렇게 생겼다:
       ▣장학금 규모
       - 총 장학금액: 총 5천만원          ← 사업 전체
       ▷학술·봉사·설계 부문: 총상금 3천만원, 1인당 200만원 기준   ← 진짜 1인당
   그냥 읽으면 학생 합계에 **5,000만원**이 들어간다. 실제로 받는 건 200만원이다.
   그래서 ① 1인당 표시가 있으면 그 조각의 숫자를 쓰고 ② 없는데 총액 표현이 있으면
   **모른다고 답한다**(0원). 축소는 안전하고 과장은 기망이다. */
var PERSON_RE = /(1\s*인\s*당|인\s*당|1\s*인|1\s*명|명\s*당|인\s*기준|1인)/;
var TOTAL_RE  = /(총\s*장학금액|장학금\s*총액|총\s*상금|총상금|총\s*예산|총\s*지원\s*규모|총\s*규모|사업비|총액)/;

/* 한 줄 안에 총액과 1인당이 같이 있으면(`총상금 3천만원, 1인당 200만원`) 조각으로 갈라
   1인당이 적힌 쪽만 본다 — 줄 전체를 읽으면 왼쪽의 총액이 먼저 잡힌다. */
function perPersonWon(blockLines) {
  var arr = blockLines || [];
  for (var i = 0; i < arr.length; i++) {
    var segs = String(arr[i]).split(/[,;]|·|▷|&middot;/);
    for (var j = 0; j < segs.length; j++) {
      if (!PERSON_RE.test(segs[j])) continue;
      var v = wonIn(segs[j]);
      if (v) return v;
    }
  }
  return 0;
}

function paNum(s) { return Number(String(s || '').replace(/,/g, '')) || 0; }

/** 한 덩어리 글에서 첫 번째 금액을 읽는다 → 원(₩) 정수. 못 읽으면 0 */
function wonIn(text) {
  var t = String(text || '');
  for (var i = 0; i < WON_PATTERNS.length; i++) {
    var m = t.match(WON_PATTERNS[i].re);
    if (!m) continue;
    var v = paNum(m[1]) * WON_PATTERNS[i].mul;
    /* `3억 5천만원` 처럼 뒤에 붙는 자리 */
    if (WON_PATTERNS[i].mul === 100000000 && m[2]) v += paNum(m[2]) * 10000;
    if (v >= MIN_WON) return v;
  }
  return 0;
}

/** 등록금 비율을 읽는다 → 0~1 사이 비율. 비율형이 아니면 0 */
function ratioIn(text) {
  var s = String(text || '');
  var m = s.match(RATIO_RE);
  if (!m) return 0;
  /* 🔴 `전액`이 **무엇의** 전액인지 확인한다 (2026-08-27 — 실제로 틀렸다).
     종근당고촌재단 무상기숙사 공고의 `가. 지원혜택 : 주거비 전액지원` 을 **등록금 100%** 로
     읽어, 그 학생의 등록금 전액(약 800만원)이 '받을 수 있는 돈'으로 합계에 들어갔다.
     주거비·식비·기숙사비의 전액지원은 등록금과 아무 상관이 없다.
     RATIO_RE 의 둘째 갈래(`전액 면제/감면/지원`)에는 등록금 닻이 없어서 생긴 일이라,
     여기서 **바로 앞 20자 안에 등록금 낱말이 있을 때만** 비율로 인정한다.
     ⚠️ 글 전체에서 찾으면 안 된다 — `기숙사비 전액지원 … 등록금은 본인 부담` 이 되살아난다. */
  if (m[5]) {
    var at = s.indexOf(m[0]);
    var near = s.slice(Math.max(0, at - 20), at + m[0].length);
    if (!/등록금|수업료|학비/.test(near)) return 0;
  }
  if (m[4]) return Math.min(100, paNum(m[4])) / 100;      // `수업료 70%`
  if (/전액/.test(m[0])) return 1;
  if (/반액|절반/.test(m[0])) return 0.5;
  return 0;
}

/* 금액 절이 여기서 끝나는가. isSectionBreak 는 **자격 절**용이라 자격 머리글에서
   false 를 돌려준다 — 금액 절은 자격 머리글에서도 끝나야 하므로 따로 본다.
   🔴 이 확인이 없으면 중앙대 성림장학금에서 `4. 장학금액: 1백만원 ~ 2백만원` 다음 줄인
   `5. 신청자격: … 건강보험료 지역 17만원 이하`의 **17만원을 금액으로 줍는다**. */
function paEndsAmount(line) {
  return PA_SH.isQualifyHead(line) || PA_SH.isExcludeHead(line)
      || PA_SH.isSelectHead(line) || PA_SH.isSectionBreak(line);
}

/** 금액 절을 찾아 그 안의 줄만 돌려준다. 못 찾으면 null
 *  🔴 **첫 머리글에서 멈추면 안 된다.** 공고에는 금액 머리글로 읽히는 줄이 여러 개 있고
 *     (학교 홈 메뉴 `# 장학금`, `장학금 종류`, `지원내용` 같은 빈 껍데기가 흔하다)
 *     첫 번째가 껍데기면 진짜 금액이 뒤에 있어도 통째로 놓친다 — 2026-08-27에 실제로
 *     절대액이 48→35건으로 떨어졌다. 그래서 **숫자나 등록금 비율이 들어 있는 블록**을
 *     우선으로 고르고, 그런 게 하나도 없을 때만 첫 블록을 돌려준다. */
function amountBlock(lines, maxLines) {
  var arr = lines || [], cap = maxLines || 8, first = null;
  for (var i = 0; i < arr.length; i++) {
    if (!PA_SH.isAmountHead(arr[i])) continue;
    var out = [arr[i]];
    for (var j = i + 1; j < arr.length && out.length < cap; j++) {
      if (paEndsAmount(arr[j])) break;
      out.push(arr[j]);
    }
    var blk = { head: arr[i], lines: out, at: i };
    if (!first) first = blk;
    var body = out.join(' ');
    if (wonIn(body) || ratioIn(body) || HOURLY_RE.test(body)) return blk;   // 알맹이가 있는 블록
  }
  return first;
}

/**
 * 공고 원문 줄에서 금액을 읽는다.
 * @returns {{kind:string, value:number, ratio:number, min:number, max:number, raw:string}}
 *   kind 가 'unknown' 이면 value 0 — **비우는 것이 실패가 아니고 지어내는 것이 실패다.**
 */
function amountFrom(lines) {
  var none = { kind: 'unknown', value: 0, ratio: 0, min: 0, max: 0, raw: '' };
  var blk = amountBlock(lines);
  if (!blk) return none;
  var body = blk.lines.join(' ');

  /* 비율형이 먼저다. `등록금 전액`에는 숫자가 없어서 금액 읽기로는 0이 나오고,
     `한학기 2,500,000원 등록금 한도내`처럼 둘 다 있으면 **적힌 절대액이 실제 지급액**이다.
     그래서 '절대액이 있으면 절대액, 없으면 비율'로 가른다. */
  /* 1인당 표시가 있으면 그게 이긴다 (위 PERSON_RE 주석 참조) */
  var perWon = perPersonWon(blk.lines);
  var won = perWon || wonIn(body);
  var ratio = ratioIn(body);

  if (HOURLY_RE.test(body) && !won) {
    return { kind: 'hourly', value: 0, ratio: 0, min: 0, max: 0, raw: body.slice(0, 200) };
  }

  /* 1인당을 못 찾았는데 총액 표현이 있으면 **읽지 않는다.**
     사업 전체 규모를 학생 한 명이 받는 금액으로 내보내는 것이 이 파일에서 가장 위험한 실패다. */
  if (!perWon && TOTAL_RE.test(body)) {
    return { kind: 'unknown', value: 0, ratio: 0, min: 0, max: 0, raw: body.slice(0, 200) };
  }

  if (won) {
    /* 범위 — `1백만원 ~ 2백만원`. 뒤쪽(큰 값)도 읽어 둔다. */
    var rangeM = body.match(/([\d,]+\s*[백천]?\s*만?\s*원)\s*[~〜∼\-–—]\s*([\d,]+\s*[백천]?\s*만?\s*원)/);
    if (rangeM) {
      var lo = wonIn(rangeM[1]), hi = wonIn(rangeM[2]);
      if (lo && hi && hi > lo) {
        return { kind: 'range', value: hi, ratio: 0, min: lo, max: hi, raw: body.slice(0, 200) };
      }
    }
    return { kind: 'fixed', value: won, ratio: 0, min: won, max: won, raw: body.slice(0, 200) };
  }

  if (ratio) {
    return { kind: 'ratio', value: 0, ratio: ratio, min: 0, max: 0, raw: body.slice(0, 200) };
  }
  return { kind: 'unknown', value: 0, ratio: 0, min: 0, max: 0, raw: body.slice(0, 200) };
}

/* ── 이중수혜 ────────────────────────────────────────────────
   자격 절에도 제외 절에도 살지 않는다. 실측으로 확인한 자리는
   신청기간·장학금액·제출서류 절이었다. 그래서 **절을 가리지 않고 전문에서** 찾는다.
   이 조항은 금액 합산뿐 아니라 **지원 자격 그 자체**다 — 이미 타 재단 장학금을 받는
   학생은 지원해도 선발될 수 없다(개발자 지적 2026-08-27).
   ────────────────────────────────────────────────────────── */
var DUP_LINE = /(이중\s?수혜|중복\s?수혜|중복\s?지급|동시\s?수혜|타\s?장학금과?\s?중복)/;
var DUP_NO   = /(불가|금지|안\s?됨|제한|불허|없음)/;
var DUP_OK   = /(가능|허용|무관|상관\s?없)/;

/* 🔴 '무엇과' 겹치면 안 되는가 — **한정어**로 읽는다 (2026-08-28 개발자 확인).
   18건을 원문으로 대조해 개발자가 직접 정해 준 기준이다:
     · `타 **대외** 장학금` → 전부      · `타 장학금` → **전부**(한정어가 없으면 전부다)
     · `타 **인재양성사업**` → 그 사업만
   예전에는 `대외·타 재단` 같은 **낱말이 있느냐**로만 갈라서, 낱말이 없다는 이유로
   `유한재단 장학금을 수혜 받을 시 타 장학금은 중복 수혜 불가`(= 명백히 전부)를
   '범위 불분명'으로 분류했다. 우연히 결과가 맞았을 뿐 판정이 틀렸다.

   순서가 방어선이다:
     ① 넓은 표지(대외·교외·타 재단·타 기관)가 있으면 **전부**다.
        `학교 및 국가 장학금 **이외의** 교외 장학금` 처럼 좁은 낱말이 예외로 끼어 있어도
        주장은 '교외 전부'다 — 순서를 뒤집으면 이 줄이 좁은 것으로 뒤집힌다.
     ② 좁은 한정어가 붙었으면 그 범위만이다.
     ③ 아무것도 없으면 **전부**다 — 축소는 안전하고 과장은 기망이다. */
/* ⚠️ `민간재단` 은 **공기관을 뺀 말**이다 (2026-08-28 개발자 확인) — 한국장학재단
   국가장학금 같은 것은 그 배타에 안 걸린다. 그래도 여기서는 넓은 표지로 둔다:
   '민간재단 전부'라는 뜻이라 범위가 넓고, **국가장학금은 애초에 막히지 않는다** —
   자격 판정(match-engine)이 프로필의 `external`(교외·외부 재단)만 보기 때문이다.
   온보딩이 국가장학금·교내·교외·근로를 따로 묻는 것이 그 근거다. */
var DUP_BROAD  = /(대외|교외|외부\s?재단|타\s?재단|타\s?기관|타\s?장학\s?재단|타\s?기관\s?장학|민간\s?재단|타\s?단체)/;
var DUP_NARROW = /(등록금성|생활비성|인재\s?양성\s?사업|근로\s?장학|교내\s?장학|복지\s?장학|다산\s?장학|성적\s?우수\s?장학|국가\s?장학금)/;

/**
 * 이 공고를 다른 장학금과 함께 받을 수 있는가.
 * @returns {{kind:'forbidden'|'allowed'|'unknown', scope:'all'|'narrow', raw:string}}
 *   scope 'all'    — 다른 장학금 **전부**와 못 겹친다. 자격 판정과 합산에 쓴다.
 *   scope 'narrow' — 정해진 몇 개·같은 성격끼리만. 다른 장학금과는 같이 받을 수 있으므로
 *                    합계에서 빼지 않는다. 원문은 화면에 그대로 보여 준다.
 */
function exclusivityFrom(lines) {
  var arr = lines || [];
  for (var i = 0; i < arr.length; i++) {
    var line = String(arr[i] || '');
    if (!DUP_LINE.test(line)) continue;

    /* 🔴 괄호 안을 먼저 떼고 본다. 실제 원문에 이런 줄이 있다:
         `라. 타 장학금과 중복수혜 가능(근로장학금 간 중복 불가)`
       괄호까지 보면 '불가'가 먼저 걸려 **받을 수 있는 공고를 못 받는다고 뒤집는다.**
       괄호 밖이 그 줄의 주장이고, 괄호 안은 좁은 예외다. */
    var main = line.replace(/[（(][^）)]*[）)]/g, ' ');
    var probe = DUP_LINE.test(main) ? main : line;

    var scope = DUP_BROAD.test(line) ? 'all' : (DUP_NARROW.test(line) ? 'narrow' : 'all');
    var raw = line.trim().slice(0, 200);
    if (DUP_NO.test(probe) && !DUP_OK.test(probe)) return { kind: 'forbidden', scope: scope, raw: raw };
    if (DUP_OK.test(probe) && !DUP_NO.test(probe)) return { kind: 'allowed',   scope: scope, raw: raw };
    /* 둘 다 있거나 둘 다 없으면 **모른다고 말한다.** 원문은 화면에 그대로 보여 준다. */
    return { kind: 'unknown', scope: scope, raw: raw };
  }
  return { kind: 'unknown', scope: 'all', raw: '' };
}

/* ── 합산 ────────────────────────────────────────────────────
   홈 화면의 '최대 N원'을 만드는 자리. 단순히 더하지 않는다.
   ────────────────────────────────────────────────────────── */

/* ── 등록금 찾기 ──────────────────────────────────────────────
   `수업료 100%` 를 원으로 바꾸려면 **그 학생의 등록금**을 알아야 한다.
   정밀도는 세 단계이고, 위에서부터 있는 것을 쓴다:
     ① 학생이 직접 입력한 값      — 고지서를 보고 넣는 값이라 가장 정확하다
     ② 학교 × 계열 공시 등록금    — 의약·예체능은 인문보다 크게 비싸서 이 단계가 중요하다
     ③ 학교 평균 공시 등록금      — 계열 데이터가 없을 때
   셋 다 없으면 **0을 돌려준다.** 전국 평균 같은 것을 끼워 넣지 않는다 —
   그건 지어낸 숫자이고, 금액을 지어내는 것이 이 저장소가 가장 싫어하는 실패다.

   ⚠️ 학과 단위 등록금은 **공시 항목 자체가 없다**(학교가 개별 공지한다).
      공개 데이터로 닿을 수 있는 최대 정밀도가 학교 × 계열이다. */
var TRACK_TO_FIELD = {
  humanities: '인문사회', social: '인문사회', business: '인문사회', education: '인문사회',
  science: '자연과학', engineering: '공학', arts: '예체능', medical: '의학'
};

/**
 * 이 학생의 등록금 (원). 모르면 0.
 * @param profile 앱 프로필 { school, track, tuitionSelf }
 * @param table   data/tuition.json 의 schools 표
 */
function tuitionFor(profile, table) {
  var p = profile || {};
  if (p.tuitionSelf > 0) return Number(p.tuitionSelf);        // ① 학생이 직접 넣은 값이 이긴다
  var row = table && table[p.school];
  if (!row) return 0;
  var field = TRACK_TO_FIELD[p.track];                         // ② 학교 × 계열
  if (field && row.byField && row.byField[field] > 0) return Number(row.byField[field]);
  return Number(row.avg) > 0 ? Number(row.avg) : 0;            // ③ 학교 평균
}

/** 환산값이 어느 단계에서 나왔는가 — 화면이 '추정' 근거를 그대로 보여 주려고 쓴다 */
function tuitionSource(profile, table) {
  var p = profile || {};
  if (p.tuitionSelf > 0) return 'self';
  var row = table && table[p.school];
  if (!row) return 'none';
  var field = TRACK_TO_FIELD[p.track];
  if (field && row.byField && row.byField[field] > 0) return 'field';
  return Number(row.avg) > 0 ? 'school' : 'none';
}

/** 등록금 비율을 원으로 환산. tuition 을 모르면 0 — 지어내지 않는다. */
function ratioWon(amount, tuition) {
  if (!amount || amount.kind !== 'ratio' || !tuition) return 0;
  return Math.round(amount.ratio * tuition);
}

/* 🔴 칸 이름은 `amountSpec` 이다. `amount` 는 **이미 금액 문구 문자열**(`"금액 원문 확인"`)로
   쓰이고 있어서, 여기에 객체를 넣으면 entry-rules.cjs 의 `it.amount.slice()` 가 죽는다
   (2026-08-27에 실제로 감사가 통째로 멈췄다). 앱·챗봇·알림도 전부 문자열로 읽는다. */

/** 이 공고 한 건이 합계에 넣을 금액 (모르면 0) */
function amountWon(item, tuition) {
  var a = item && item.amountSpec;
  if (!a) return Number(item && item.amountValue) || 0;
  if (a.kind === 'fixed' || a.kind === 'range') return a.value || 0;
  if (a.kind === 'ratio') return ratioWon(a, tuition);
  return 0;
}

/**
 * 합계를 낸다. 더하기가 아니라 **고르기**다.
 *  · 같은 장학금(sameAs)은 한 번만
 *  · 함께 못 받는 공고(exclusivity forbidden)끼리는 가장 큰 것 하나만
 *  · 등록금 비율형은 tuition 이 있을 때만, '추정'으로 표시
 *  · 못 읽은 것은 0원 (합계에서 빠지되 목록에는 남는다)
 * @returns {{total:number, added:[], onlyOne:[], dropped:[], estimated:[], unknown:[]}}
 */
function sumAmounts(items, opts) {
  var o = opts || {}, tuition = o.tuition || 0;
  var list = (items || []).slice();

  /* ① 같은 장학금 합치기 — sameAs 가 같으면 한 건으로 본다.
        (재)가송재단이 8개 학교 접수분으로 등록돼 있어 이 단계가 없으면 8배로 세어진다. */
  var seen = {}, merged = [];
  for (var i = 0; i < list.length; i++) {
    var it = list[i], key = it.sameAs || it.id;
    if (seen[key]) { (seen[key].mergedFrom = seen[key].mergedFrom || []).push(it); continue; }
    var copy = { ref: it, key: key, mergedFrom: [] };
    seen[key] = copy; merged.push(copy);
  }

  /* ② 갈래로 나눈다 */
  var added = [], estimated = [], unknown = [], exclusive = [];
  for (var j = 0; j < merged.length; j++) {
    var m = merged[j], a = m.ref.amountSpec || null;
    var won = amountWon(m.ref, tuition);
    m.won = won;
    if (a && a.kind === 'ratio') { if (won) estimated.push(m); else unknown.push(m); continue; }
    if (!won) { unknown.push(m); continue; }
    /* 🔴 **전부**와 못 겹치는 것만 골라내기 대상이다 (2026-08-28 개발자 확인).
       `타 인재양성사업 중복 수혜 불가` 처럼 범위가 좁은 것은 다른 장학금과 같이 받을 수
       있으므로 합계에서 빼면 **실제보다 적게** 말하게 된다. 원문은 화면에 그대로 남는다. */
    var ex = m.ref.exclusivity;
    if (ex && ex.kind === 'forbidden' && ex.scope !== 'narrow') exclusive.push(m); else added.push(m);
  }

  /* ③ 함께 못 받는 것들 중 가장 큰 하나만 */
  exclusive.sort(function (a, b) { return b.won - a.won; });
  var onlyOne = exclusive.slice(0, 1), dropped = exclusive.slice(1);

  var total = 0;
  for (var k = 0; k < added.length; k++)     total += added[k].won;
  for (var l = 0; l < onlyOne.length; l++)   total += onlyOne[l].won;
  for (var n = 0; n < estimated.length; n++) total += estimated[n].won;

  return { total: total, added: added, onlyOne: onlyOne, dropped: dropped,
           estimated: estimated, unknown: unknown };
}

/* Node(수집기·감사·검사)와 브라우저·서비스워커가 같은 파일을 쓴다.
   section-head.js·match-engine.js 와 같은 겸용 방식. */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    wonIn: wonIn, ratioIn: ratioIn, amountBlock: amountBlock, amountFrom: amountFrom,
    exclusivityFrom: exclusivityFrom, ratioWon: ratioWon, amountWon: amountWon, sumAmounts: sumAmounts,
    tuitionFor: tuitionFor, tuitionSource: tuitionSource, TRACK_TO_FIELD: TRACK_TO_FIELD,
    MIN_WON: MIN_WON
  };
}

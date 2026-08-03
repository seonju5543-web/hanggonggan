/* ============================================================
   공고 원문 발췌기 (2026-07-15 개발자 지시 — 정직 원칙)
   '추론'으로 신청 방법을 지어내는 대신, 확보된 공고 전문에서
   신청기간·신청방법·제출서류·문의 문장을 **한 글자도 바꾸지 않고**
   그대로 뽑아 registered.json 항목의 excerpts 필드에 넣는다.
   앱은 이 발췌를 "공고 원문 발췌" 블록으로만 표시한다.
   발췌가 없으면 앱은 아무것도 지어내지 않고 '원문 보기' 링크만 준다.

   실행: node collector/extract-excerpts.mjs        (미리보기)
         node collector/extract-excerpts.mjs --write (registered.json 반영)
   ============================================================ */
import fs from 'node:fs';
/* 원문 찾기 규칙은 notice-source.mjs 한 곳에 있다 — 수집기·재채점 도구와 같은 방법을
   써야 "발췌기는 찾았는데 수집기는 못 찾는" 어긋남이 안 생긴다 (2026-08-03 분리). */
import { indexTexts, sourceFor, hasText } from './notice-source.mjs';

const HERE = new URL('.', import.meta.url);
const texts = JSON.parse(fs.readFileSync(new URL('extracted/notices-text.json', HERE), 'utf8'));
const regPath = new URL('../data/registered.json', HERE);
const reg = JSON.parse(fs.readFileSync(regPath, 'utf8'));
const WRITE = process.argv.includes('--write');

/* 발췌 규칙: 신청 안내 신호가 있는 문장만, 메뉴·잡음 문장은 제외, 원문 그대로 */
const MARK = /(신청\s?기간|접수\s?기간|신청\s?방법|접수\s?방법|제출\s?서류|구비\s?서류|제출\s?방법|제출\s?기한|신청\s?기한|선발\s?인원|지급\s?금액|장학금액|문의처|문의\s?:|신청\s?자격|지원\s?자격|응모\s?자격|자격\s?요건|지원\s?대상|신청\s?대상|모집\s?대상|선발\s?대상|추천\s?대상)/;
/* 자격 신호(2026-08-02 개발자 지시로 추가) — 앞으로 들어오는 공고는 자격 요건 문장도 함께 발췌한다.
   예전엔 신청기간·서류만 뽑아서, 앱이 자격을 "별도 제한 없음"으로 단정하는 원인이 됐다.
   추론이 아니라 **원문 문장 그대로**이므로 원칙 8-1을 지킨다. */
const QUALIFY = /(신청\s?자격|지원\s?자격|응모\s?자격|자격\s?요건|지원\s?대상|신청\s?대상|모집\s?대상|선발\s?대상|추천\s?대상)/;
const JUNK = /바로가기|사이트맵|SITEMAP|로그인|회원가입|검색어|메뉴|팝업|카드뉴스|이전글|다음글|목록으로|목록보기|첨부파일\s*$|저작권|개인정보처리방침|instagram|facebook/i;

function extractFrom(text) {
  if (!text) return [];
  // 문장 단위로 자르되 원문 표기를 보존한다.
  // HTML 기호는 사람이 읽는 글자로 바꾼다 — 안 하면 앱에 'nDRIMS &rarr; 대표'처럼 그대로 보인다
  // (2026-08-02: 자격 블록에만 적용하고 여기엔 안 걸어서 실제로 노출됐다).
  const parts = text.split(/(?<=[.다요함음])\s+|\n+/).map((s) => unent(s).trim()).filter(Boolean);
  const out = [];
  for (const p of parts) {
    if (!MARK.test(p)) continue;
    if (JUNK.test(p)) continue;
    if (p.length < 8 || p.length > 240) continue;
    if (!/[0-9가-힣]/.test(p)) continue;
    if (/[:：]\s*2?0?2?6?\.?$/.test(p)) continue;          // 날짜가 잘려나간 조각
    if (!/[0-9]/.test(p) && p.length < 20) continue;       // 내용 없는 제목 줄

    out.push(p);
    if (out.length >= 5) break;
  }
  return out;
}

/* 자격 항목 블록 뽑기 (2026-08-02 개발자 지시).
   "지원자격" 한 문장만 뽑으면 정작 중요한 '1) 4년제 대학생 2) 5·18 (유)자녀' 같은
   **딸린 항목들**이 빠진다. 제목 줄부터 다음 항목(2. 지원내용 …)이 나오기 전까지를
   통째로 잘라 줄 단위로 담는다. 한 글자도 바꾸지 않는다 — 추론이 아니라 발췌다. */
/* 자격 절의 제목으로 실제 쓰이는 표현 (2026-08-02 미확보 80건을 세어 보고 추가).
   **그냥 '자격'이나 '대상'은 넣지 않는다** — 세어 보니 가장 많이 나온 것이
   '교원자격'·'평생교육사자격'처럼 **자격증 이름**이라, 넣으면 엉뚱한 줄이 요건으로 들어온다. */
const QUALIFY_HEAD = /(신청\s?자격|지원\s?자격|응모\s?자격|자격\s?요건|자격\s?기준|지원\s?조건|신청\s?조건|지원\s?대상|신청\s?대상|모집\s?대상|선발\s?대상|추천\s?대상|수혜\s?대상|장학\s?대상|지급\s?대상|지원\s?가능\s?대상|선발\s?기준|심사\s?기준)/;
/* 자격 블록의 끝 — **확실한 다음 절**에서만 끊는다.
   예전엔 '장학금액' 같은 낱말에서도 끊었는데, 자격이 표로 적힌 공고에서는 그게
   표의 머리글이라 거기서 잘려 정작 중요한 요건 줄(장애의 정도가 심한 장애인 등)을
   통째로 놓쳤다(2026-08-02 복지장학1 사례). 표 머리글은 아래 TABLE_NOISE로 걸러낸다. */
/* 절 머리글 앞에 붙는 것들. **■ □ ▣ 같은 네모 기호를 빠뜨리면 안 된다**
   (2026-08-03 전수 재채점에서 발견 — 의심 줄 22개 중 12개가 이 하나 때문이었다).
   세종대·서울과기대처럼 절을 '■ 자격요건 / ■ 장학금액 / ■ 유의사항'으로 나누는 공고에서
   기호를 못 알아봐 자격 절을 지나 금액·문의·유의사항까지 통째로 자격으로 읽고 있었다. */
const SECT_PREFIX = '^\\s*(?:[■□▣●▶◆◇○★]\\s*|[가-힣]\\s*[.)]\\s*|\\d+\\s*[.)]\\s*|[①-⑳]\\s*)?';
const NEXT_SECTION = new RegExp(SECT_PREFIX +
  '(신청\\s?기간|접수\\s?기간|지원\\s?기간|신청\\s?접수|신청\\s?방법|접수\\s?방법|제출\\s?서류|구비\\s?서류|제출\\s?방법|선발\\s?방법|유의\\s?사항|문의|지급|장학금\\s?지급|장학\\s?금액|안내|일정|기타|참고|제외\\s?대상|선발\\s?제외|지원\\s?내용|장학\\s?내용|혜택)');

/* 자격 절이 끝났는지 판단하는 **구조적** 기준 (2026-08-02 해성문화재단 사례).
   공고는 보통 '가. / 나. / 다. / 라.' 또는 '1. / 2. / 3.'으로 절이 나뉜다.
   자격 절 다음에 오는 **다른 절 머리글**을 만나면 거기서 끝이다 — 낱말을 일일이
   나열하는 방식은 '장학금 지급 관련 안내'처럼 처음 보는 제목에 계속 뚫린다.
   단, 그 머리글 자체가 자격을 뜻하면(선발 대상 등) 이어서 읽는다. */
const SECTION_HEAD = /^\s*(?:[가-힣]\s*[.)]|\d+\s*\.)\s*\S/;
/* 이 절 머리글이 여전히 '누가 받을 수 있나'를 말하면 이어서 읽는다.
   '나. 장학생 선발' / '1) 선발기준' 아래에 실제 요건이 이어지는 공고가 있다(유흥수 장학금). */
const STILL_QUALIFY = /(자격|대상자?|요건|기준)\s*$|(신청|지원|선발|모집|추천)\s?(자격|대상)|장학생\s?선발|선발\s?기준/;

/* 표 머리글·표 안의 값 — 요건이 아니라 표를 이루는 부속이라 버린다 */
const TABLE_NOISE = new RegExp([
  '^(구분|장학금액|장학명|성적기준|취득학점|평점평균|비고|순번|번호|지급액|금액|장학종류|유형)$',
  '^수업료\\s*\\d+%',            // 수업료 100%
  '^\\d+\\s*%$',
  '^복지장학\\s*\\d',            // 복지장학 1(100%)
  '^\\d+\\s*학점$',
  '^\\d\\.\\d+\\s*이상$',
  '^성적제한\\s*없음$',
  '^(신청대상|장학기준|지원자격|신청자격|지원대상)\\s*(및)?$',   // 두 줄로 쪼개진 제목
].join('|'));

/* 원문에 남아 있는 HTML 기호를 사람이 읽는 글자로 (&ldquo; → “). 뜻은 바꾸지 않는다.
   &amp;는 반드시 마지막 — 먼저 풀면 이중 해제된다(clean-title.mjs와 같은 규칙). */
const ENT = [[/&lt;/g, '<'], [/&gt;/g, '>'], [/&quot;/g, '"'], [/&#39;|&apos;/g, "'"],
  [/&ldquo;/g, '“'], [/&rdquo;/g, '”'], [/&lsquo;/g, '‘'], [/&rsquo;/g, '’'],
  [/&nbsp;/g, ' '], [/&middot;/g, '·'], [/&hellip;/g, '…'],
  [/&times;/g, '×'], [/&sdot;/g, '·'], [/&deg;/g, '°'], [/&ndash;/g, '–'], [/&mdash;/g, '—'],
  [/&rarr;/g, '→'], [/&larr;/g, '←'], [/&harr;/g, '↔'], [/&bull;/g, '•'], [/&prime;/g, '′'],
  [/&#(\d+);/g, (_, n) => String.fromCharCode(+n)],   // 숫자 표기(&#39; 등)도 함께
  [/&amp;/g, '&']];
const unent = (s) => ENT.reduce((t, [re, ch]) => t.replace(re, ch), s);

/* 장학 제외 대상 — "※ 장학제외 대상자" 아래의 항목들을 원문 그대로 모은다.
   자격 절과 같은 방식으로 다음 절 머리글을 만나면 끊는다. */
const EXCLUDE_HEAD = /(제외\s?대상|장학\s?제외|지원\s?제외|신청\s?제외|제외자)/;
function extractExcludeLines(text) {
  if (!text) return [];
  const lines = text.split(/\n+/).map((l) => unent(l).replace(/[ \t　]+/g, ' ').trim()).filter(Boolean);
  const start = lines.findIndex((l) => EXCLUDE_HEAD.test(l) && l.length <= 30);
  if (start < 0) return [];
  const out = [];
  for (let i = start + 1; i < lines.length && out.length < 6; i += 1) {
    const l = lines[i];
    if (NEXT_SECTION.test(l)) break;
    if (SECTION_HEAD.test(l)) {
      const body = l.replace(/^\s*(?:[가-힣]\s*[.)]|\d+\s*\.)\s*/, '');
      if (body.length <= 20) break;
    }
    if (/^[●▶◆■]/.test(l)) break;              // 다음 큰 항목
    if (TABLE_NOISE.test(l) || l.length < 4 || l.length > 120) continue;
    out.push(l);
  }
  return out;
}

function extractQualifyLines(text) {
  if (!text) return [];
  const lines = text.split(/\n+/).map((l) => unent(l).replace(/[ \t　]+/g, ' ').trim()).filter(Boolean);
  /* 자격처럼 보이는 곳이 여러 군데일 수 있다. **첫 번째를 잡으면 안 된다** —
     교육보호장학은 "교육보호장학 대상자는 반드시…"라는 평범한 문장이 앞에 있어서
     거기서 시작해 엉뚱한 '변경내용' 표를 자격으로 읽었다(2026-08-03 개발자 지적).
     그래서 **제목처럼 생긴 줄**(짧고, 그 낱말로 시작하거나 콜론이 붙은 줄)을 고른다. */
  const cands = [];
  lines.forEach((l, i) => { if (QUALIFY_HEAD.test(l)) cands.push(i); });
  if (!cands.length) return [];
  const headScore = (l) => {
    const t = l.replace(/^[\s\-–—•▪▶◆◇○●·ㆍ*]+/, '').replace(/^(?:[가-힣]\s*[.)]|\d+\s*[.)])\s*/, '');
    let s = 0;
    if (QUALIFY_HEAD.test(t.slice(0, 12))) s += 3;      // 낱말이 앞머리에 있다
    if (t.length <= 12) s += 3;                          // 제목처럼 짧다
    else if (t.length <= 30) s += 1;
    if (/[:：]/.test(t.slice(0, 16))) s += 2;            // "신청자격 : …"
    if (/(는|은|이|가)\s|바랍니다|하시어|합니다/.test(t)) s -= 3;   // 서술 문장이다
    /* '자격 기준 및 선발 인원'처럼 **인원·금액 배정표**의 제목은 자격 절이 아니다
       (동국인재육성장학 — 여기서 시작해 학과별 배정 인원표를 자격으로 읽었다, 2026-08-03). */
    if (/인원|금액|지급액|배정/.test(t)) s -= 4;
    return s;
  };
  let start = cands[0], best = -99;
  for (const i of cands) { const s = headScore(lines[i]); if (s > best) { best = s; start = i; } }
  const out = [];
  for (let i = start; i < lines.length && out.length < 8; i += 1) {
    const l = lines[i];
    if (i > start && NEXT_SECTION.test(l)) break;      // 다음 절 시작 — 여기서 끊는다
    /* 다른 절 머리글(다. / 라. / 3.)을 만나면 자격 절이 끝난 것이다.
       단 '가./나./다.'는 **자격 절 안의 하위 항목**으로도 쓰인다(면학장학금:
       "가. 2026-2학기 등록자…"). 그래서 **제목처럼 짧을 때만** 절 머리글로 본다 —
       내용이 이어지는 긴 줄은 요건 그 자체다. 이 구분이 없으면 자격을 통째로 놓친다. */
    if (i > start && SECTION_HEAD.test(l) && !STILL_QUALIFY.test(l)) {
      const body = l.replace(/^\s*(?:[가-힣]\s*[.)]|\d+\s*\.)\s*/, '');
      if (body.length <= 20) break;      // 짧으면 제목 → 절이 바뀐 것
    }
    if (JUNK.test(l)) continue;
    if (TABLE_NOISE.test(l.replace(/\s+/g, ' ').trim())) continue;   // 표 머리글·표 값
    if (l.length < 4 || l.length > 200) continue;
    if (!/[0-9가-힣]/.test(l)) continue;
    out.push(l);
  }
  // 제목 줄 하나만 남았고 내용이 없으면 쓸모없다
  return out.length >= 1 && out.join('').length >= 10 ? out : [];
}

/* ── 2차 경로: 자격 절 제목이 아예 없는 공고 (2026-08-03) ──────────────
   전수 재채점 결과, 못 뽑은 84건 중 **35건은 원문에 '지원자격' 같은 제목이 없었다**.
   자격이 줄글이나 표 안에 섞여 있는 유형이라, 제목 낱말을 아무리 늘려도 잡히지 않는다.

   그래서 제목을 못 찾았을 때만 **줄 단위로 줍는다.** 단, 넓게 주우면 제출서류·문의처가
   자격으로 둔갑하므로(시제품에서 실제로 그랬다) 아주 보수적으로 간다:
     · '누가 받을 수 있나'를 말하는 **분명한 신호**가 있는 줄만
     · 기간·서류·금액·인원 줄은 제외
     · **2줄 이상 모였을 때만** 채택 — 한 줄만 걸린 건 대개 오탐이다
   이래도 못 뽑으면 지어내지 않고 비워 둔다(원칙 8-1). */
const STRONG = /(평점\s?\d|평균\s?\d|\d\.\d+\s?이상|\d+\s?학점\s?이상|소득\s?분위|\d\s?분위|기초\s?생활|수급자|차상위|한부모|다자녀|유자녀|국가유공|독립유공|보훈|장애\s?(학생|인|정도)|다문화|북한이탈|새터민|미혼모)/;
const WHO = /(재학생|재학\s?중|복학생|신입생|편입생|\d\s?학년|학부생|4\s?년제|대학생)/;
const TAIL = /(이상인?\s?자|이하인?\s?자|해당하는\s?자|가능한\s?자|갖춘\s?자|인\s?자$|학생$|대상자$)/;
/* 요건이 아닌 것이 분명한 줄 — 여기 걸리면 신호가 있어도 버린다 */
const NOT_REQ = /(신청\s?기간|접수\s?기간|지원\s?기간|신청\s?기한|제출\s?기한|제출\s?서류|구비\s?서류|문의|담당자|전화|이메일|@|팩스|첨부|다운로드|바로가기|클릭|홈페이지|www\.|http|지급\s?(일정|방법|시기)|지원\s?내용|장학\s?금액|선발\s?인원|모집\s?인원|\d+\s?명\s?(내외|이내)|만\s?원|\d{3,}\s?원|붙임|별첨|공고합니다|바랍니다|하시기|메일\s?제목|파일\s?명)/;
/* 요건처럼 생겼지만 요건이 아닌 세 가지 — 2026-08-03 2차 경로를 켜고 눈으로 확인해 잡은 것들
   ① 브라우저 제목줄("… 신청 안내 | 숙명여자대학교")  ② 부서·기관 이름만 있는 줄("장애학생지원센터")
   ③ 증명서 발급 안내("… 증명서 1부(보훈청에서 발급)") — 이건 제출서류지 자격이 아니다 */
const NOT_REQ2 = /\s\|\s|^.{0,16}(센터|팀|실)$|증명서\s*\d*\s*부|발급\s*\)|에서\s?발급/;

function scoopQualifyLines(text) {
  if (!text) return [];
  const lines = text.split(/\n+/).map((l) => unent(l).replace(/[ \t　]+/g, ' ').trim()).filter(Boolean);
  const out = [];
  for (const l of lines) {
    if (l.length < 6 || l.length > 110) continue;
    if (JUNK.test(l) || NOT_REQ.test(l) || NOT_REQ2.test(l)) continue;
    if (TABLE_NOISE.test(l)) continue;
    if (!/[가-힣]/.test(l)) continue;
    if (/^\d{4}[.\-]\d/.test(l)) continue;                 // 날짜 줄
    const strong = STRONG.test(l);
    if (!strong && !(WHO.test(l) && TAIL.test(l))) continue;
    if (!out.includes(l)) out.push(l);
    if (out.length >= 6) break;
  }
  return out.length >= 2 ? out : [];      // 한 줄짜리는 믿지 않는다
}

const idx = indexTexts(texts);

let hit = 0, none = 0, kept = 0;
for (const it of reg.items) {
  if (it.program) continue;
  const src = sourceFor(it, idx);

  /* 원문이 없으면 **아무 판단도 하지 않는다** (2026-08-03 수정).
     예전엔 원문을 못 찾으면 이미 뽑아 둔 자격·발췌를 지웠다. 그런데 원문 파일은 수집 목록이
     60일마다 갈리면서 통째로 다시 만들어져, 등록 공고의 원문이 정상적으로 사라진다.
     그래서 **멀쩡하던 자격이 두 달 뒤 저절로 없어지고 있었다**(원문 미확보 17건이 그 결과).
     "원문이 없다"는 "자격이 없다"가 아니라 "모른다"이므로, 이전 값을 그대로 둔다.
     — 원칙 8-1(모르는 것을 단정하지 않는다)과 같은 정신. */
  if (!hasText(src)) { kept += 1; continue; }

  const ex = extractFrom(src.text);
  // 자격 절을 못 찾았을 때만 2차 경로로 물러난다 (절이 있으면 그쪽이 언제나 정확하다)
  const qual = extractQualifyLines(src.text).length
    ? extractQualifyLines(src.text)
    : scoopQualifyLines(src.text);
  if (WRITE) {
    if (qual.length) it.eligibilityLines = qual;
    else delete it.eligibilityLines;   // 원문은 읽었는데 못 뽑았다 → 옛 값을 남기지 않는다

    /* '제외 대상'도 자격 정보다 (2026-08-03 개발자 지적 — 동국인재육성장학).
       "누가 받을 수 있나"만큼 "누가 못 받나"도 학생이 알아야 한다. 원문 그대로 뽑는다. */
    const excl = extractExcludeLines(src.text);
    if (excl.length) it.eligibilityExcludes = excl;
    else delete it.eligibilityExcludes;
  }
  if (ex.length) {
    hit++;
    if (WRITE) { it.excerpts = ex; it.excerptNote = '공고 원문에서 그대로 발췌 (자동)'; }
    if (!WRITE) {
      console.log(`\n■ ${it.id} | ${it.name.slice(0, 40)}`);
      ex.forEach((e) => console.log('   →', e.slice(0, 110)));
      if (qual.length) { console.log('   [자격 블록]'); qual.forEach((q) => console.log('      ·', q.slice(0, 100))); }
    }
  } else {
    none++;
    if (WRITE && it.excerpts) { delete it.excerpts; delete it.excerptNote; }
  }
}
console.log(`\n발췌 성공 ${hit}건 · 원문은 읽었으나 발췌 불가 ${none}건 · 원문 미확보라 손대지 않음 ${kept}건`);
if (WRITE) {
  fs.writeFileSync(regPath, JSON.stringify(reg, null, 1) + '\n');
  console.log('registered.json 반영 완료');
}

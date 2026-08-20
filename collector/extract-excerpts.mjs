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
/* 게시판 메뉴·푸터를 걷어내는 규칙 (2026-08-20 신설 — page-boilerplate.mjs 첫머리 참조).
   자격을 못 뽑은 61건 중 40건이 '본문이 메뉴에 파묻힌' 상태였다. */
import { makeStripper } from './page-boilerplate.mjs';
/* 공고문 첨부에서 글자 뽑기 — 본문이 "붙임 참조"뿐인 공고가 있다.
   🔴 **공고문만** 본다(attachment-text.mjs 첫머리 참조) — 신청서·동의서를 읽으면
   개인정보 수집 항목이 지원 자격 자리에 앉는다(실제로 겪고 되돌린 적이 있다). */
import { attachmentText, readable } from './attachment-text.mjs';

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
const QUALIFY_HEAD = /(신청\s?자격|지원\s?자격|응모\s?자격|자격\s?요건|지원\s?요건|신청\s?요건|장학생\s?기본\s?자격|장학생\s?자격|선발\s?요건|응모\s?요건|자격\s?기준|지원\s?조건|신청\s?조건|지원\s?대상|신청\s?대상|모집\s?대상|선발\s?대상|추천\s?대상|수혜\s?대상|장학\s?대상|지급\s?대상|지원\s?가능\s?대상|선발\s?기준|심사\s?기준|응시\s?자격|추천\s?조건|추천\s?자격|대\s?상\s?자\s*[:：]|^\s*\d+\s*[.)]\s*대\s?상\s*[:：])/;
/* 자격 블록의 끝 — **확실한 다음 절**에서만 끊는다.
   예전엔 '장학금액' 같은 낱말에서도 끊었는데, 자격이 표로 적힌 공고에서는 그게
   표의 머리글이라 거기서 잘려 정작 중요한 요건 줄(장애의 정도가 심한 장애인 등)을
   통째로 놓쳤다(2026-08-02 복지장학1 사례). 표 머리글은 아래 TABLE_NOISE로 걸러낸다. */
/* 절 머리글 앞에 붙는 것들. **■ □ ▣ 같은 네모 기호를 빠뜨리면 안 된다**
   (2026-08-03 전수 재채점에서 발견 — 의심 줄 22개 중 12개가 이 하나 때문이었다).
   세종대·서울과기대처럼 절을 '■ 자격요건 / ■ 장학금액 / ■ 유의사항'으로 나누는 공고에서
   기호를 못 알아봐 자격 절을 지나 금액·문의·유의사항까지 통째로 자격으로 읽고 있었다. */
const SECT_PREFIX = '^\\s*(?:[■□▣●▶▷◆◇○★♦⇒‡◦∙❍◎￭ㅇ]\\s*|[가-힣]\\s*[.)]\\s*|\\d+\\s*[.)]\\s*|[①-⑳]\\s*)?';
const NEXT_SECTION = new RegExp(SECT_PREFIX +
  /* 🔴 여기 빠진 낱말은 그대로 '자격 요건'이 되어 학생에게 보인다 (2026-08-20).
     "3. 제출기한 : ~2026.8.3" 처럼 **콜론 뒤에 내용이 붙은 소제목**은 아래 SECTION_HEAD
     길이 규칙(짧아야 제목)에 걸리지 않아, 제출기한·양식 안내가 자격 자리에 앉아 있었다
     (한국장학재단 이공계 중간평가 공고로 실증 — 자격 4줄 중 3줄이 이 유형이었다). */
  '(신청\\s?기간|접수\\s?기간|지원\\s?기간|신청\\s?접수|신청\\s?방법|접수\\s?방법|제출\\s?서류|구비\\s?서류|제출\\s?방법|제출\\s?기한|신청\\s?기한|접수\\s?기한|확인\\s?방법|대상자\\s?확인|양식|서식|선발\\s?방법|유의\\s?사항|문의|지급|장학금?\\s?(지급|금액|내용|혜택|종류)|안내|일정|기타|참고|제외\\s?대상|선발\\s?제외|지원\\s?내용|혜택)');

/* 자격 절이 끝났는지 판단하는 **구조적** 기준 (2026-08-02 해성문화재단 사례).
   공고는 보통 '가. / 나. / 다. / 라.' 또는 '1. / 2. / 3.'으로 절이 나뉜다.
   자격 절 다음에 오는 **다른 절 머리글**을 만나면 거기서 끝이다 — 낱말을 일일이
   나열하는 방식은 '장학금 지급 관련 안내'처럼 처음 보는 제목에 계속 뚫린다.
   단, 그 머리글 자체가 자격을 뜻하면(선발 대상 등) 이어서 읽는다. */
const SECTION_HEAD = /^\s*(?:[가-힣]\s*[.)]|\d+\s*\.)\s*\S/;
/* 줄 앞머리 번호가 '어느 단계'인가 — 같은 단계를 만나야 절이 바뀐 것이다.
   숫자는 값까지 본다(3. 아래의 1)은 하위 항목, 4.가 다음 절). */
function markerOf(line) {
  const num = String(line).match(/^\s*(\d+)\s*[.)]/);
  if (num) return { kind: 'num', n: Number(num[1]) };
  if (/^\s*[가-힣]\s*[.)]/.test(line)) return { kind: 'kor', n: 0 };
  if (/^\s*[\u2460-\u2473]/.test(line)) return { kind: 'circ', n: 0 };
  return { kind: '', n: 0 };
}
/* 이 절 머리글이 여전히 '누가 받을 수 있나'를 말하면 이어서 읽는다.
   '나. 장학생 선발' / '1) 선발기준' 아래에 실제 요건이 이어지는 공고가 있다(유흥수 장학금). */
const STILL_QUALIFY = /(자격|대상자?|요건|기준)\s*$|(신청|지원|선발|모집|추천)\s?(자격|대상)|장학생\s?선발|선발\s?기준/;

/* 표 머리글·표 안의 값 — 요건이 아니라 표를 이루는 부속이라 버린다 */
const TABLE_NOISE = new RegExp([
  '^(구분|장학금액|장학명|장학금명|성적기준|취득학점|평점평균|비고|순번|번호|지급액|금액|장학종류|유형)$',
  '^장학금?\\s?지급\\s?기간$|^지급\\s?기간$',      // 표 머리글 칸 (광운 국가고시장학금)
  /* ⚠️ '^\S{2,12}(지원|장학)$'(띄어쓰기 없는 짧은 이름씨)를 여기 넣지 말 것 — 2026-08-20에
     넣어 봤다가 되돌렸다. 이화 양영재단의 메뉴 부스러기 2줄은 지워지지만, **자격 확보가
     106 → 102건으로 떨어진다**(성균관 성적우수의 진짜 요건까지 함께 날아갔다).
     부스러기 2줄을 없애자고 진짜 요건 4건을 잃는 거래다. */
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
  /* 🔴 안 풀린 개체 문자는 **글자가 아니라 절 경계를 망가뜨린다** (2026-08-20 발견).
     아래 SECT_PREFIX는 줄 앞머리가 ■ ▶ ◆ 같은 **풀린 기호**일 때만 '절 머리글'로 읽는데,
     `&diams;`가 그 자리를 막고 있으면 "♦ 신청기간:"을 다음 절로 못 알아본다 →
     신청방법·제출서류가 **자격 요건인 척** 앱에 뜬다(서울과기대 마이크로디그리로 실증).
     저장된 원문 전수에서 안 풀린 것이 이 7종이라 전부 넣는다. */
  [/&diams;/g, '♦'], [/&Dagger;/g, '‡'], [/&rArr;/g, '⇒'], [/&sim;/g, '∼'],
  [/&copy;/g, '©'], [/&ne;/g, '≠'], [/&divide;/g, '÷'],
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
    if (/^[●▶◆■□▣♦❍◎￭]/.test(l)) break;           // 다음 큰 항목
    if (TABLE_NOISE.test(l) || l.length < 4 || l.length > 120) continue;
    out.push(l);
  }
  return out;
}

/* '이 줄이 누가 받을 수 있나를 말한다'는 신호.
   verify/eligibility-report.mjs의 REQ_SIGNAL과 **같은 낱말이어야 한다** —
   갈라지면 채점기가 통과시킨 것을 발췌기가 버리는(또는 그 반대) 일이 생긴다. */
const REQ_SIGNAL = /(재학|휴학|복학|신입|편입|졸업|\d\s?학년|학부생|대학생|성적|평점|학점|분위|수급|차상위|기초생활|한부모|다자녀|자녀|유공|보훈|장애|다문화|북한이탈|거주|출신|이상인?\s?자|이하의?\s?(해당\s?)?학생|해당하는\s?자|자격을\s?갖춘|결격\s?사유|결격사유)/;

/* 🔴 한 줄에 뭉친 번호 항목을 나눈다 (2026-08-20).
   HTML이 납작해지면서 `1) 국내 4년제 대학 재학생 2) 부모가 모두 … 3) 성적 우수자 우대`가
   **한 줄**로 들어오는 공고가 있다(가톨릭대 산학협동재단). 그 줄이 **201자**여서 아래 길이
   상한(200)에 딱 1자 걸려 통째로 버려졌고, 제목만 남아 '내용 없음'이 됐다.
   상한을 올리는 것은 답이 아니다 — 다음 공고가 또 걸린다. 원래 여러 항목이었으니 나눈다.
   ⚠️ 번호가 **2개 이상**이고 줄이 길 때만 나눈다. 짧은 줄의 `1)`은 문장 속 표기일 수 있다. */
function splitMerged(line) {
  if (line.length <= 120) return [line];
  let parts = [line];
  const marks = line.match(/(?:^|\s)\d\s?\)\s/g) || [];
  if (marks.length >= 2) parts = line.split(/(?=(?:^|\s)\d\s?\)\s)/);
  /* 항목 안에 다시 `* 지원제한 …` `※ …`이 붙어 오는 경우가 있다 — 그것도 원래 딴 줄이다.
     (가톨릭대 산학협동재단: `3) 성적 우수자 우대 (…) * 지원제한(제외대상) : …`) */
  return parts.flatMap((p2) => (p2.length > 100 ? p2.split(/\s(?=[*※]\s)/) : [p2]))
    .map((p2) => p2.trim()).filter((p2) => p2.length >= 4);
}

function extractQualifyLines(text) {
  if (!text) return [];
  const lines = text.split(/\n+/).map((l) => unent(l).replace(/[ \t　]+/g, ' ').trim())
    .filter(Boolean).flatMap(splitMerged);
  /* 자격처럼 보이는 곳이 여러 군데일 수 있다. **첫 번째를 잡으면 안 된다** —
     교육보호장학은 "교육보호장학 대상자는 반드시…"라는 평범한 문장이 앞에 있어서
     거기서 시작해 엉뚱한 '변경내용' 표를 자격으로 읽었다(2026-08-03 개발자 지적).
     그래서 **제목처럼 생긴 줄**(짧고, 그 낱말로 시작하거나 콜론이 붙은 줄)을 고른다. */
  const cands = [];
  lines.forEach((l, i) => { if (QUALIFY_HEAD.test(l)) cands.push(i); });
  if (!cands.length) return [];
  const headScore = (l) => {
    const t = l.replace(/^[\s\-–—•▪▶▷◆◇○●■□▣★♦⇒‡◦∙❍◎￭·ㆍ*]+/, '').replace(/^(?:[가-힣]\s*[.)]|\d+\s*[.)])\s*/, '');
    let s = 0;
    if (QUALIFY_HEAD.test(t.slice(0, 12))) s += 3;      // 낱말이 앞머리에 있다
    if (t.length <= 12) s += 3;                          // 제목처럼 짧다
    else if (t.length <= 30) s += 1;
    if (/[:：]/.test(t.slice(0, 16))) s += 2;            // "신청자격 : …"
    if (/(는|은|이|가)\s|바랍니다|하시어|합니다/.test(t)) s -= 3;   // 서술 문장이다
    /* '인원 배정' 표의 제목은 자격 절이 아니다(동국인재육성장학 — 여기서 시작해 학과별
       배정 인원표를 자격으로 읽었다, 2026-08-03).
       🔴 다만 **그 낱말이 제목의 주제일 때만** 깎는다 (2026-08-20 전수 읽기에서 교정).
       방송대 학업지속장학의 자격 절 제목이 `1. 선발대상 및 지급금액`인데, 뒤에 붙은
       '금액' 때문에 4점이 깎여 후보에서 밀렸고 진짜 요건 두 줄을 통째로 놓치고 있었다.
       제목의 **앞쪽 절반**에 그 낱말이 있을 때만 '인원·금액 절'로 본다. */
    const head2 = t.slice(0, Math.max(6, Math.ceil(t.length / 2)));
    if (/인원|금액|지급액|배정/.test(head2)) s -= 4;
    return s;
  };
  /* 🔴 점수 1등 하나만 보고 포기하지 않는다 (2026-08-20).
     예전엔 가장 높은 후보 **한 곳**에서만 읽어 보고, 거기서 못 건지면 그대로 빈손이었다.
     그런데 점수는 제목의 생김새만 보는 것이라 어느 쪽이 진짜 자격 절인지 확실히 못 가른다 —
     '자격 기준 및 선발 인원'(동국: 학과별 배정표라 자격 아님)과 '선발대상 및 지급금액'
     (방송대: 그 아래가 진짜 요건)이 점수로는 똑같이 깎인다. 어느 쪽인지는 **읽어 봐야** 안다.
     그래서 점수 순으로 몇 곳을 실제로 읽어 보고, 아래 관문(요건 신호)을 통과한 첫 블록을 쓴다.
     관문이 이미 '자격이 아닌 블록'을 걸러 주므로 이 되풀이가 안전하다.
     상위 4곳까지만 본다 — 더 뒤지면 공고 끝의 엉뚱한 절까지 손을 뻗는다. */
  let best = -99, top = cands[0];
  for (const i of cands) { const s = headScore(lines[i]); if (s > best) { best = s; top = i; } }
  return blockFrom(top);

  function blockFrom(start) {
  const startMark = markerOf(lines[start]);
  const out = [];
  for (let i = start; i < lines.length && out.length < 8; i += 1) {
    const l = lines[i];
    /* 🔴 표 머리글 칸은 **다음 절 판정보다 먼저** 걸러낸다 (2026-08-20 전수 읽기에서 발견).
       광운 국가고시장학금은 `장학금명|신청자격|장학금액|장학금지급기간` 표인데, 자격 절
       바로 아래 줄이 옆 칸 머리글 `장학금지급기간`이었다. 아래 NEXT_SECTION이 그걸
       '지급'으로 읽고 **자격 절 첫 줄에서 끊어** 제목만 남겼다. TABLE_NOISE는 통째로 한 줄인
       표 머리글만 좁게 잡으므로("3. 장학금액 : 200만원" 같은 진짜 절 제목은 안 걸린다)
       먼저 건너뛰어도 안전하다. 순서를 되돌리면 표로 된 공고가 다시 통째로 사라진다. */
    if (i > start && TABLE_NOISE.test(l.replace(/\s+/g, ' ').trim())) continue;
    /* 다음 절 시작 — 여기서 끊는다.
       ⚠️ **표로 된 공고를 여기서 구해내려 하지 말 것** (2026-08-20에 해 보고 되돌렸다).
       광운 국가고시장학금은 `장학금명|신청자격|장학금액|장학금지급기간` 표라 '신청자격' 칸에서
       시작해 바로 옆 칸을 다음 절로 보고 멈춘다. "아직 한 줄도 못 모았으면 짧은 줄은 건너뛰고
       계속 읽자"고 고쳤더니 광운은 살아났지만 **세종 햇빛장학금이 대신 망가졌다** —
       거기선 `구분|지원대상|제출서류` 표라 같은 규칙이 제출서류 칸('가족관계증명서 1부')을
       자격으로 끌고 들어왔다. 표는 납작해지면서 칸이 한 줄씩 번갈아 나오므로
       **줄 단위로는 어느 칸의 글자인지 알 수 없다.** 고치려면 수집 단계에서 표 구조를
       살려 두어야 한다(별건). 여기서 재시도하면 반드시 다른 공고가 대신 망가진다. */
    if (i > start && NEXT_SECTION.test(l)) break;
    /* 다른 절 머리글(다. / 라. / 3.)을 만나면 자격 절이 끝난 것이다.
       🔴 **길이로 재지 말 것** (2026-08-20 — 개발자가 "본문에 다 써 있는데 못 읽는 것 같다"고
       짚어 파 보고 찾은 진짜 버그). 예전 규칙은 '떼어낸 본문이 20자 이하면 절 제목'이었는데,
       시립대 빅데이터 성과형 장학금의 첫 요건 `가. 빅데이터 마이크로디그리 이수(예정)자`가
       **정확히 20자**라 자격 절 첫 줄에서 그대로 끊겼다. 제목만 남아 내용 없음으로 버려졌다.

       바른 기준은 길이가 아니라 **번호 단계**다. `3. 신청 자격` 아래의 `가./나./다.`는
       한 단계 **아래** 항목이지 다음 절이 아니다. 다음 절은 같은 단계의 `4.`다.
       그래서 시작 줄의 번호 종류를 기억해 두고 **같은 종류를 만났을 때만** 끊는다.
       숫자는 순서까지 본다 — `3. 신청자격` 아래의 `1)` `2)`는 하위 항목이고 `4.`가 다음 절이다.
       시작 줄에 번호가 없으면(`■ 신청자격` 등) 예전처럼 길이로 재되 문턱을 낮춰 둔다. */
    if (i > start && SECTION_HEAD.test(l) && !STILL_QUALIFY.test(l)) {
      const mk = markerOf(l);
      if (startMark.kind) {
        if (mk.kind === startMark.kind
          && (mk.kind !== 'num' || mk.n > startMark.n)) break;
      } else {
        const body = l.replace(/^\s*(?:[가-힣]\s*[.)]|\d+\s*\.)\s*/, '');
        if (body.length <= 20) break;
      }
    }
    if (JUNK.test(l)) continue;
    if (TABLE_NOISE.test(l.replace(/\s+/g, ' ').trim())) continue;   // 표 머리글·표 값
    if (l.length < 4 || l.length > 200) continue;
    if (!/[0-9가-힣]/.test(l)) continue;
    out.push(l);
  }
  // 제목 줄 하나만 남았고 내용이 없으면 쓸모없다
  if (!(out.length >= 1 && out.join('').length >= 10)) return [];
  /* 🔴 마지막 관문 — 이 블록이 정말 '누가 받을 수 있나'를 말하고 있는가 (2026-08-20).
     자격 절 제목을 잘못 짚으면(이화 양영재단: '신청방법' 블록을 자격으로 읽었다) 제출서류·
     유의사항 8줄이 통째로 **지원 자격 자리에** 앉는다. 학생은 그걸 요건으로 읽고 자기가
     해당되는지 판단하므로, 틀린 자격은 '아직 못 읽었어요'보다 나쁘다(원칙 8-1).
     한 줄도 요건 신호가 없으면 짚은 곳이 틀린 것이니 **비워 두고** 2차 경로에 넘긴다.
     '성적증명서'처럼 서류 이름 안에 든 낱말은 신호로 세지 않는다 — 안 그러면 제출서류
     목록이 '성적' 신호로 통과한다(실제로 그랬다). */
  if (out.some((l) => REQ_SIGNAL.test(l.replace(/\S*증명서/g, '')))) return out;
  /* 신호가 없어도 **첫 줄이 제대로 된 이름표 줄**이면 짚은 곳이 맞다 — 그 줄 자체가 요건이다.
     "지원대상 : 만3세~만24세 소아·청소년 당뇨인" 처럼 대상이 학생 속성이 아닌 공고가 있어서,
     신호만으로 자르면 **멀쩡한 요건까지 날아간다**(실제로 2건 날아가 이 예외를 만들었다).
     단 '추천 대상 인원 : 본교 최대 1명'처럼 인원·금액 이름표는 자격이 아니므로 뺀다. */
  const head = out[0].replace(/^[\s\-–—•▪▶▷◆◇○●■□▣★♦⇒‡◦∙❍◎￭·ㆍ*]+/, '')
    .replace(/^(?:[가-힣]\s*[.)]|\d+\s*[.)])\s*/, '');
  const m = head.match(/^([^:：]{2,14})[:：]\s*\S/);
  return m && QUALIFY_HEAD.test(m[1]) && !/인원|금액|지급액|배정/.test(m[1]) ? out : [];
  }
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

/* 규칙 함수를 밖에서 부를 수 있게 내보낸다 (2026-08-20).
   이 파일은 **불러오는 순간 아래 본편이 통째로 실행되던** 구조라 규칙 하나를 시험해 보려면
   비슷한 코드를 따로 베껴야 했고(그러면 규칙이 두 벌이 된다), 검사도 '원본 글자를 읽어
   규칙이 살아 있는지만 보는' 약한 방식에 머물렀다. `EXCERPTS_AS_LIB=1`이면 본편을 건너뛴다. */
export { extractQualifyLines, scoopQualifyLines, extractFrom, extractExcludeLines };

let browserBodies = {};
try { browserBodies = JSON.parse(fs.readFileSync(new URL('extracted/browser-bodies.json', HERE), 'utf8')); } catch { /* 아직 없음 */ }
const idx = indexTexts(texts, browserBodies);
/* 게시판 메뉴·푸터를 걷어낸 글자로 읽는다 — 자격이 메뉴 700줄에 파묻혀 있던 문제.
   같은 학교 여러 공고에 똑같이 나오는 줄만 지우므로 학교 구조를 알 필요가 없다.
   걷어낸 결과가 앙상하면 stripBoilerplate가 원문을 그대로 돌려준다(안전판). */
const strip = makeStripper(texts);

/* 공고문 첨부 색인 (deepfetch --elig-attach 가 만든다) */
let eligDocs = {};
try { eligDocs = JSON.parse(fs.readFileSync(new URL('extracted/elig-docs.json', HERE), 'utf8')); } catch { /* 아직 없음 */ }

let hit = 0, none = 0, kept = 0, cleaned = 0, fromDoc = 0;
if (!process.env.EXCERPTS_AS_LIB) main();
function main() {
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

  const body = strip(src.url, src.text);
  if (body !== src.text) cleaned += 1;

  const ex = extractFrom(body);
  // 자격 절을 못 찾았을 때만 2차 경로로 물러난다 (절이 있으면 그쪽이 언제나 정확하다)
  let qual = extractQualifyLines(body).length
    ? extractQualifyLines(body)
    : scoopQualifyLines(body);
  /* 본문에서 못 뽑았으면 **공고문 첨부**를 본다 — 순서를 뒤집지 말 것.
     본문이 있는 한 본문이 언제나 정확하다(첨부에는 붙임·서식이 섞인다). */
  let viaDoc = false;
  if (!qual.length && eligDocs[it.id]) {
    for (const f of eligDocs[it.id].files || []) {
      const t = attachmentText(new URL(`extracted/${f}`, HERE).pathname);
      if (!readable(t)) continue;                       // 스캔 PDF 등 — 조용히 넘어간다
      const got = extractQualifyLines(t);
      if (got.length) { qual = got; viaDoc = true; fromDoc += 1; break; }
    }
  }
  if (WRITE) {
    if (viaDoc) it.eligibilityFrom = '공고문 첨부';
    else if (it.eligibilityFrom === '공고문 첨부') delete it.eligibilityFrom;
    if (qual.length) it.eligibilityLines = qual;
    else delete it.eligibilityLines;   // 원문은 읽었는데 못 뽑았다 → 옛 값을 남기지 않는다

    /* '제외 대상'도 자격 정보다 (2026-08-03 개발자 지적 — 동국인재육성장학).
       "누가 받을 수 있나"만큼 "누가 못 받나"도 학생이 알아야 한다. 원문 그대로 뽑는다. */
    const excl = extractExcludeLines(body);
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
console.log(`\n게시판 메뉴를 걷어낸 공고 ${cleaned}건`);
console.log(`발췌 성공 ${hit}건 · 원문은 읽었으나 발췌 불가 ${none}건 · 원문 미확보라 손대지 않음 ${kept}건`);
if (WRITE) {
  fs.writeFileSync(regPath, JSON.stringify(reg, null, 1) + '\n');
  console.log('registered.json 반영 완료');
}
}

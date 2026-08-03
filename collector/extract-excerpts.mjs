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

const HERE = new URL('.', import.meta.url);
const texts = JSON.parse(fs.readFileSync(new URL('extracted/notices-text.json', HERE), 'utf8'));
const regPath = new URL('../data/registered.json', HERE);
const reg = JSON.parse(fs.readFileSync(regPath, 'utf8'));
const WRITE = process.argv.includes('--write');

const ID_PARAMS = /^(seq|articleno|bbs_seq|duid|list_id|entryid|bbsidx|menu_id|contents_no|site_no|board_seq|menuno|no|ntt|nttsn|idx|wr_id|bidx)$/i;
function canonUrl(raw) {
  try {
    const u = new URL(raw);
    const keep = [];
    for (const [k, v] of u.searchParams) if (ID_PARAMS.test(k) && v) keep.push(`${k.toLowerCase()}=${v}`);
    keep.sort();
    const marker = u.hash && u.hash.startsWith('#n-') ? u.hash : '';
    return u.origin + u.pathname + (keep.length ? '?' + keep.join('&') : '') + marker;
  } catch { return (raw || '').split('#')[0]; }
}
const norm = (t) => (t || '').replace(/\[[^\]]*\]/g, '').replace(/[\s·ㆍ()~〜.,'"“”‘’!⭐★]/g, '').toLowerCase();

/* 발췌 규칙: 신청 안내 신호가 있는 문장만, 메뉴·잡음 문장은 제외, 원문 그대로 */
const MARK = /(신청\s?기간|접수\s?기간|신청\s?방법|접수\s?방법|제출\s?서류|구비\s?서류|제출\s?방법|제출\s?기한|신청\s?기한|선발\s?인원|지급\s?금액|장학금액|문의처|문의\s?:|신청\s?자격|지원\s?자격|응모\s?자격|자격\s?요건|지원\s?대상|신청\s?대상|모집\s?대상|선발\s?대상|추천\s?대상)/;
/* 자격 신호(2026-08-02 개발자 지시로 추가) — 앞으로 들어오는 공고는 자격 요건 문장도 함께 발췌한다.
   예전엔 신청기간·서류만 뽑아서, 앱이 자격을 "별도 제한 없음"으로 단정하는 원인이 됐다.
   추론이 아니라 **원문 문장 그대로**이므로 원칙 8-1을 지킨다. */
const QUALIFY = /(신청\s?자격|지원\s?자격|응모\s?자격|자격\s?요건|지원\s?대상|신청\s?대상|모집\s?대상|선발\s?대상|추천\s?대상)/;
const JUNK = /바로가기|사이트맵|SITEMAP|로그인|회원가입|검색어|메뉴|팝업|카드뉴스|이전글|다음글|목록으로|저작권|개인정보처리방침|instagram|facebook/i;

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
const QUALIFY_HEAD = /(신청\s?자격|지원\s?자격|응모\s?자격|자격\s?요건|자격\s?기준|지원\s?조건|신청\s?조건|지원\s?대상|신청\s?대상|모집\s?대상|선발\s?대상|추천\s?대상|수혜\s?대상|장학\s?대상|지급\s?대상|지원\s?가능\s?대상)/;
/* 자격 블록의 끝 — **확실한 다음 절**에서만 끊는다.
   예전엔 '장학금액' 같은 낱말에서도 끊었는데, 자격이 표로 적힌 공고에서는 그게
   표의 머리글이라 거기서 잘려 정작 중요한 요건 줄(장애의 정도가 심한 장애인 등)을
   통째로 놓쳤다(2026-08-02 복지장학1 사례). 표 머리글은 아래 TABLE_NOISE로 걸러낸다. */
const SECT_PREFIX = '^\\s*(?:[가-힣]\\s*[.)]\\s*|\\d+\\s*[.)]\\s*|[①-⑳]\\s*)?';
const NEXT_SECTION = new RegExp(SECT_PREFIX +
  '(신청\\s?기간|접수\\s?기간|신청\\s?접수|신청\\s?방법|접수\\s?방법|제출\\s?서류|구비\\s?서류|제출\\s?방법|선발\\s?방법|유의\\s?사항|문의|지급|장학금\\s?지급|안내|일정|기타|참고)');

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

function extractQualifyLines(text) {
  if (!text) return [];
  const lines = text.split(/\n+/).map((l) => unent(l).replace(/[ \t　]+/g, ' ').trim()).filter(Boolean);
  const start = lines.findIndex((l) => QUALIFY_HEAD.test(l));
  if (start < 0) return [];
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

const byUrl = new Map();
const byTitle = new Map();
for (const v of Object.values(texts)) {
  if (v.url) byUrl.set(canonUrl(v.url), v);
  if (v.title) byTitle.set(norm(v.title), v);
}

let hit = 0, none = 0;
for (const it of reg.items) {
  if (it.program) continue;
  const src = byUrl.get(canonUrl(it.sourceUrl || '')) || byTitle.get(norm(it.name)) || null;
  const ex = src ? extractFrom(src.text) : [];
  const qual = src ? extractQualifyLines(src.text) : [];
  if (WRITE) {
    if (qual.length) it.eligibilityLines = qual;
    else delete it.eligibilityLines;   // 원문이 바뀌어 못 뽑게 되면 옛 값을 남기지 않는다
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
console.log(`\n발췌 성공 ${hit}건 · 원문 미확보/발췌 불가 ${none}건 (이 경우 앱은 '원문 보기' 링크만 표시)`);
if (WRITE) {
  fs.writeFileSync(regPath, JSON.stringify(reg, null, 1) + '\n');
  console.log('registered.json 반영 완료');
}

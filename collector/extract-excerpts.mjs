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
const QUALIFY_HEAD = /(신청\s?자격|지원\s?자격|응모\s?자격|자격\s?요건|지원\s?대상|신청\s?대상|모집\s?대상|선발\s?대상|추천\s?대상)/;
/* 다음 절이 시작되면 자격 블록이 끝난 것으로 본다 */
const NEXT_SECTION = /^\s*(?:\d+\s*[.)]\s*)?(지원\s?내용|지원\s?금액|장학\s?금액|선발\s?인원|선발\s?분야|신청\s?기간|접수\s?기간|신청\s?접수|신청\s?방법|접수\s?방법|제출\s?서류|구비\s?서류|제출\s?방법|선발\s?방법|선발\s?기준|유의\s?사항|기타|문의)/;

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
    if (JUNK.test(l)) continue;
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

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
const MARK = /(신청\s?기간|접수\s?기간|신청\s?방법|접수\s?방법|제출\s?서류|구비\s?서류|제출\s?방법|제출\s?기한|신청\s?기한|선발\s?인원|지급\s?금액|장학금액|문의처|문의\s?:)/;
const JUNK = /바로가기|사이트맵|SITEMAP|로그인|회원가입|검색어|메뉴|팝업|카드뉴스|이전글|다음글|목록으로|저작권|개인정보처리방침|instagram|facebook/i;

function extractFrom(text) {
  if (!text) return [];
  // 문장 단위로 자르되 원문 표기를 보존한다
  const parts = text.split(/(?<=[.다요함음])\s+|\n+/).map((s) => s.trim()).filter(Boolean);
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
  if (ex.length) {
    hit++;
    if (WRITE) { it.excerpts = ex; it.excerptNote = '공고 원문에서 그대로 발췌 (자동)'; }
    if (!WRITE) {
      console.log(`\n■ ${it.id} | ${it.name.slice(0, 40)}`);
      ex.forEach((e) => console.log('   →', e.slice(0, 110)));
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

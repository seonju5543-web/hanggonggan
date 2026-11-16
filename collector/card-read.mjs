/* ============================================================
   유료 카드 읽기 — 공고 한 건을 통째로 읽어 카드의 모든 칸을 채운다 (2026-11-15 개발자 지시)
   설계: docs/designs/paid-card-reading.md · 시안: docs/designs/mockups/paid-card-reading/

   무료 길(규칙)은 칸마다 따로 읽어서 번호가 남고, 줄이 「~하고,」 에서 끊기고, 선발 인원이 자격 자리에 앉고,
   접수 시작일이 마감으로 읽혔다. 이 로봇은 본문 + 첨부 글자를 **한꺼번에** 모델 둘에게 따로 읽히고,
   ① 글자가 원문에 있는지 기계로 대조하고(verify) ② 둘이 같은 말을 한 줄만(agree) `data/card-read.json` 에 싣는다.
   앱은 그 파일이 있는 공고에 유료 결과를 얹고(app.js applyCardRead), 없는 공고는 무료 길 값 그대로(비상망)다.

   🔴 `data/registered.json` 을 고치지 않는다 — 무료 길 값을 덮으면 비상망이 사라지고, 그 파일은 충돌하면 통째로 깨진다.
   🔴 돈이 나가는 로봇이다 — 스위치 둘(`card-read-config.json` enabled + 환경 변수 CARD_READ_ENABLE=1)이 다 켜져야 부른다.
      한 실행의 상한(maxPerRun · maxUsdPerRun)을 넘으면 멈춘다. 원문 해시가 같은 공고는 다시 읽지 않는다.
   🔴 지어냄을 막는 것은 지시문이 아니라 **verify** 다 — 지시문을 고쳐도 verify 는 느슨하게 하지 말 것.

   실행: node collector/card-read.mjs                 (미리보기 — 부르지 않는다)
         node collector/card-read.mjs --write         (반영 · 스위치가 켜져 있어야 부른다)
         node collector/card-read.mjs --only=<id> --write
         CARD_READ_FAKE=<파일> … --write              (가짜 응답 {id: {a: …, b: …}} — 관문이 돈 없이 돌린다)
         node collector/card-read.mjs --recheck --write  (장부에 남긴 응답 원본으로 결과를 다시 만든다 — 규칙을 고친 뒤 · 돈 0)
         node collector/card-read.mjs --check          (결과 파일의 꼴을 잰다 — 워크플로가 저장 전에)
   ============================================================ */
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { indexTexts, sourceFor, hasText } from './notice-source.mjs';
import { attachmentText, docOrder, readableDoc } from './attachment-text.mjs';
import { closedForStudents } from './rescue-plan.mjs';

const require = createRequire(import.meta.url);
const HERE = new URL('.', import.meta.url);
const P = (rel) => fileURLToPath(new URL(rel, HERE));
const readJson = (rel, dflt) => { try { return JSON.parse(fs.readFileSync(P(rel), 'utf8')); } catch { return dflt; } };
const log = (m) => console.log(`[card-read] ${m}`);

export const MODELS = { a: 'claude-opus-5-5', b: 'claude-sonnet-5-5' };
const PRICE = { 'claude-opus-5-5': [4, 20], 'claude-sonnet-5-5': [2, 10] };   // 달러 / 100만 토큰 (입력, 출력) — 2026-11 요금

export const SYSTEM = `한국 대학 장학금 공고의 원문을 읽어 공고 카드의 칸을 채웁니다. 결과는 학생에게 그대로 보입니다. 사람이 한 줄 한 줄 검수한 것처럼 깔끔해야 합니다.

원문은 「게시판 본문」과 「첨부」(공고문 파일에서 뽑은 글자) 여러 덩어리로 옵니다. 게시판 본문에는 사이트 메뉴·바닥글·이전글 제목이 섞여 있고, 공고의 진짜 내용이 첨부에만 있는 경우가 많습니다. 전부 끝까지 읽으세요.

가장 중요한 규칙 — 사실은 원문 그대로입니다.
허용되는 손질은 다섯 가지뿐입니다.
 ① 줄 중간에서 끊긴 문장을 이어 붙이기
 ② 깨진 띄어쓰기 고치기 (「제 출 서 류」→「제출서류」, 「2026 학년도」→「2026학년도」)
 ③ 줄머리의 번호·기호 떼기 (가. / 1) / 3) / - / ○ / ※ / ◤ 등 — 학생 화면에 번호가 남으면 안 됩니다)
 ④ 줄머리의 이름표 떼기 (「신청방법 :」「지원서 접수방법 :」「장학금 지급 금액 :」「지원자격 :」 — 칸 이름이 이미 그 말을 합니다)
 ⑤ eligibility·excludes 줄의 **끝말만** 고쳐 한 줄이 혼자 읽히게 하기
    「…차상위 계층 대학생으로,」 → 「…차상위 계층 대학생」
    「…C학점 이상(2026년 1학기 성적 기준)을 취득하고,」 → 「…C학점 이상(2026년 1학기 성적 기준)을 취득한 자」
    끝말 말고는 한 글자도 바꾸지 않습니다. 뜻이 바뀌는 고침(부정 ↔ 긍정)은 절대 하지 않습니다.
그 밖에는 낱말을 바꾸거나, 더하거나, 요약하거나, 말투를 바꾸지 마세요. 원문에 없는 사실은 쓰지 않습니다.
원문에 없는 칸은 비워 둡니다. 추측하지 않습니다. 모르면 비우는 것이 정답입니다.

칸의 뜻 — 섞지 마세요.
- eligibility: 누가 받을 수 있는가. 한 줄에 요건 하나. 모든 줄은 「~인 자」「~한 학생」처럼 사람으로 끝나거나 명사로 끝납니다. 「~하고,」「~이며,」「~으로,」로 끝나는 줄은 틀린 줄입니다.
  자격이 아닌 것: 「신청자격」 같은 제목, 장학금 종류 이름을 늘어놓은 줄(「성적우수·특기·다자녀 … 장학금」), 선발 인원(「200명 내외」), 선발 방법·심사 기준, 제출 서류, 금액.
- excludes: 받을 수 없는 사람. **누가 못 받는지만** 적습니다 — 칸 이름이 이미 '받을 수 없는 경우'이므로 「…는 선발에서 배제됩니다」「…는 지원 불가」「… 제외」 같은 뒷말은 뗍니다.
  「9학기 진학 및 부분 등록자는 선발에서 배제됩니다.」 → 「9학기 진학 및 부분 등록자」 · 「2027학년도 1학기 등록금성 장학금 수혜자는 지원 불가」 → 「2027학년도 1학기 등록금성 장학금 수혜자」 · 「휴학생 제외」 → 「휴학생」
- priority: 우대·우선 선발·가산점 기준. 자격이 아닙니다.
- amount: 장학금액·지원금액이 **숫자로** 적힌 문구만. 금액 숫자가 없는 줄(「생활지원금(타 장학금 중복 수혜 가능)」)은 amount 가 아닙니다 — 필요하면 notes 로.
- deadline: 신청(접수) 마감일. 「11. 18부터 11. 26까지」면 마감은 11. 26 입니다(시작일이 아닙니다). 게시일·발표일·선발일·지급일은 마감이 아닙니다. date 는 YYYY-MM-DD, quote 는 그 날짜가 적힌 원문 문구.
- apply: 어디에 어떻게 내는가(접수 방법·접수처). 문의 전화번호는 넣지 않습니다.
- documents: 제출 서류의 **이름**. 서류 하나에 한 줄. 「제출서류」 같은 제목 줄, 「…을 읽어보시고 참고하시길 바랍니다」 같은 안내 문장은 서류가 아닙니다(원문이 서류 이름을 적지 않았으면 비웁니다).
- notes: 유의사항(이중수혜 제한, 지급 조건 등) 가운데 학생이 신청 전에 알아야 하는 것만. 선발 인원, 발표일, 「자세한 사항은 공고문 참조」 같은 줄은 넣지 않습니다.
- title: 공고 제목에서 게시판 말머리([공통]·[교외]·[학생지원팀] 등)와 꼬리 날짜((~11/26) 등)를 뗀 것. 그 밖의 글자는 그대로.
- host: 장학금을 주는 곳(재단·기관·대학). 원문에 적힌 이름 그대로 — 공고문(첨부)에 적힌 정식 이름을 먼저 쓰고, 없으면 제목에 적힌 꼴을 씁니다. 게시판을 운영하는 대학은 주는 곳이 아닙니다(그 대학의 교내 장학금이 아니라면).

그 밖에.
- 사이트 메뉴, 바닥글, 이전글·다음글 제목, 조회수, 첨부파일 이름 목록은 공고 내용이 아닙니다.
- 한 공고에 장학금이 여러 종 묶여 있으면 multi 를 true 로 하고, **모든 종에 공통인 것만** 채웁니다(종마다 다른 자격·금액은 비웁니다).
- 본문과 첨부 어디에도 공고 내용이 없으면(메뉴뿐·오류 화면) unreadable 을 true 로 하고 나머지는 비웁니다.`;

const S = { type: 'string' };
const A = { type: 'array', items: S };
export const SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['title', 'host', 'eligibility', 'excludes', 'priority', 'amount', 'deadline', 'apply', 'documents', 'notes', 'multi', 'unreadable'],
  properties: {
    title: S, host: S, eligibility: A, excludes: A, priority: A, amount: A,
    deadline: { type: 'object', additionalProperties: false, required: ['date', 'quote'], properties: { date: S, quote: S } },
    apply: A, documents: A, notes: A, multi: { type: 'boolean' }, unreadable: { type: 'boolean' },
  },
};
export const LIST_FIELDS = ['eligibility', 'excludes', 'priority', 'amount', 'apply', 'documents', 'notes'];

/* ── ① 기계 대조 — 글자가 원문에 있는가 (공백·줄바꿈·전각 꼴만 무시) ──────────── */
export const norm = (s) => String(s || '').normalize('NFKC').replace(/[\s ​]+/g, '').replace(/[·ㆍ•‧・∙]/g, '·')
  .replace(/[“”„]/g, '"').replace(/[‘’]/g, "'").replace(/[∼～〜]/g, '~').replace(/[–—―]/g, '-');
/* 🔴 떨어진 조각을 이을 때의 틈 (2026-11-15 리뷰 C2) — 처음엔 '두 조각이 원문 어딘가에 있으면 통과'였다. 그러면 서로 다른 문장의 숫자·부정이 섞인다:
   「평점 2.5 이상인 자」+「평점 3.0 미만은 감점」 → 「평점 3.0 이상인 자」 통과 · 「받지 않은 자」+「받은 자는 제외」 → 「타 장학금을 받은 자」 통과.
   조각은 **차례대로 · 가까이(틈 40자 이하)** 있어야 하고, 틈에 숫자·부정이 없어야 한다(줄머리 번호 「나.」「2)」 는 틈으로 치지 않는다). */
const GAP_MAX = 40;
const ENUM_GAP = /(?:[가-하][.)]|\d{1,2}[.)]|[①-⑳]|[-·•○※*◤▶■□◦])/g;
const gapOk = (gap) => { const g = gap.replace(ENUM_GAP, ''); return g.length <= GAP_MAX && !/\d/.test(g) && !/않|못|아니|아닌|없/.test(g); };
function inOrderNear(pieces, srcN) {
  const walk = (i, from, first) => {
    if (i === pieces.length) return true;
    for (let at = srcN.indexOf(pieces[i], from); at >= 0; at = srcN.indexOf(pieces[i], at + 1)) {
      if (!first && !gapOk(srcN.slice(from, at))) { if (at - from > GAP_MAX + 12) break; continue; }
      if (walk(i + 1, at + pieces[i].length, false)) return true;
      if (!first && at - from > GAP_MAX + 12) break;
    }
    return false;
  };
  return walk(0, 0, true);
}
export function inSource(line, srcN) {
  const n = norm(line);
  if (n.length < 2) return { ok: false, why: '빈 줄' };
  if (srcN.includes(n)) return { ok: true, how: '그대로' };
  /* 줄머리 기호가 사이에 낀 줄 — 쉼표·괄호에서 쪼갠 조각이 **전부** 차례대로 가까이 있어야 한다. 숫자 사이 쉼표(1,000,000)는 쪼개지 않는다(리뷰 I7 —
     쪼개면 「2,000,000원」 의 조각 「000」 만 대조돼 원문 「1,000,000원」 으로 통과했다) */
  const parts = n.split(/(?<!\d),(?!\d)|[;:()[\]]/).filter((x) => x.length);
  if (parts.length > 1 && parts.every((x) => x.length >= 2 || !/\d/.test(x)) && inOrderNear(parts.filter((x) => x.length >= 2), srcN)) return { ok: true, how: '조각' };
  /* 포스터·표에서 한 문장이 두 줄로 갈라져 사이에 다른 줄이 낀 경우(「학자금 지원구간 / … / 5구간 이내」) — 두 조각(각 4자 이상)이 차례대로 가까이 */
  for (let i = 4; i <= n.length - 4; i++) if (inOrderNear([n.slice(0, i), n.slice(i)], srcN)) return { ok: true, how: '두 조각 이음' };
  return { ok: false, why: `원문에 없는 글자: 「${(parts.find((x) => x.length >= 2 && !srcN.includes(x)) || n).slice(0, 30)}」` };
}
/* 끝말 고침(손질 ⑤) — 자격·제외 줄만. 「…취득한 자」 의 줄기 「…취득」 이 원문에 있고, 원문에서 그 바로 뒤가 잇는 말(하고·이며·으로…)일 때만 통과.
   🔴 부정이 뒤따르면 뜻이 뒤집힌 것이라 버린다 — 「…을 수혜하고 있지 않은 자」 를 「…을 수혜한 자」 로 고친 줄이 통과하면 안 된다 */
const END = /(?:(?:인|한|된|하는|받은|있는|둔|중인|다닌)?(?:자|학생|사람|대학생))$/;
const CONT = /^(?:하고|하며|하여|하였으며|하였고|했고|이고|이며|이면서|으로서|으로|로서|로|받고|두고|,|인자|한자|하는자|인학생|한학생|인대학생)/;
const NEG_AFTER = /^.{0,8}(?:않|못|아니|아닌|없|안됨|안된|불가|제외)/;
export function inSourceEnding(line, srcN) {
  const r = inSource(line, srcN);
  if (r.ok) return r;
  const n = norm(line), m = n.match(END);
  if (!m) return r;
  const stem = n.slice(0, n.length - m[0].length);
  if (stem.length < 6) return r;
  for (let at = srcN.indexOf(stem); at >= 0; at = srcN.indexOf(stem, at + 1)) {
    const after = srcN.slice(at + stem.length, at + stem.length + 12);
    if (CONT.test(after) && !NEG_AFTER.test(after)) return { ok: true, how: '끝말' };
  }
  return { ok: false, why: `끝말을 떼어도 원문에 없음: 「${stem.slice(-24)}」` };
}
/* 마감 — 진짜 날짜이고, 근거 문구가 원문에 있고, 그 문구에 **그 월과 일이 붙어** 있고(「11.23」「11월 23일」), 문구에 연도가 있으면 그 연도이고, 게시일보다 이르지 않아야 한다
   (리뷰 I6 — 「11명 선발, 23일 발표」 로 11-23 이, 「접수: 2025.11.2~2025.11.23」 으로 2026-11-23 이, 「12.20~1.10」 으로 지난 1월 10일이 통과했다) */
function checkDeadline(d, srcN, item) {
  if (!d || !d.date) return { ok: false, why: '없음' };
  const m = String(d.date).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return { ok: false, why: '날짜 꼴 아님' };
  const [y, mo, da] = [+m[1], +m[2], +m[3]];
  const real = new Date(Date.UTC(y, mo - 1, da));
  if (real.getUTCFullYear() !== y || real.getUTCMonth() !== mo - 1 || real.getUTCDate() !== da) return { ok: false, why: '없는 날짜' };
  if (!inSource(d.quote, srcN).ok) return { ok: false, why: '근거 문구가 원문에 없음' };
  const q = norm(d.quote);
  if (!new RegExp(`(?<!\\d)0?${mo}[./월-]0?${da}(?!\\d)`).test(q)) return { ok: false, why: '근거 문구에 그 월·일이 붙어 있지 않음' };
  const years = (q.match(/20\d{2}/g) || []).map(Number);
  if (years.length && !years.includes(y)) return { ok: false, why: '근거 문구의 연도와 다름' };
  if (item && /^\d{4}-\d{2}-\d{2}$/.test(String(item.listedAt || '')) && d.date < item.listedAt) return { ok: false, why: '게시일보다 이른 마감' };
  return { ok: true };
}
/* 모델 한 번의 응답 → 원문에 있는 것만(kept) · 버린 것(dropped). 응답 꼴이 틀리면 전부 버린다(던지지 않는다) */
export function verify(out, source, item) {
  const o = (out && typeof out === 'object') ? out : {};
  const srcN = norm(source);
  const titleN = norm([item.name, item.boardTitle].filter(Boolean).join(' '));
  const kept = {}, dropped = [];
  for (const k of LIST_FIELDS) {
    kept[k] = [];
    for (const line of Array.isArray(o[k]) ? o[k] : []) {
      if (typeof line !== 'string') continue;
      const r = (k === 'eligibility' || k === 'excludes') ? inSourceEnding(line, srcN) : inSource(line, srcN);
      if (r.ok) kept[k].push(line.trim()); else dropped.push({ field: k, line, why: r.why });
    }
  }
  const t = typeof o.title === 'string' && o.title ? inSource(o.title, titleN) : { ok: false };
  kept.title = t.ok ? o.title.trim() : ''; if (o.title && !t.ok) dropped.push({ field: 'title', line: String(o.title), why: t.why || '꼴 아님' });
  const h = typeof o.host === 'string' && o.host ? inSource(o.host, srcN + titleN) : { ok: false };
  kept.host = h.ok ? o.host.trim() : ''; if (o.host && !h.ok) dropped.push({ field: 'host', line: String(o.host), why: h.why || '꼴 아님' });
  const dl = (o.deadline && typeof o.deadline === 'object') ? o.deadline : null;
  const d = checkDeadline(dl, srcN, item);
  kept.deadline = d.ok ? { date: dl.date, quote: String(dl.quote).trim() } : null;
  if (dl && dl.date && !d.ok) dropped.push({ field: 'deadline', line: `${dl.date} ← ${dl.quote}`, why: d.why });
  kept.multi = o.multi === true; kept.unreadable = o.unreadable === true;
  return { kept, dropped };
}

/* ── ② 두 번 읽기 일치 — 둘이 같은 말을 한 줄만 싣는다 ────────────────────────── */
function lcs(a, b) {   // 가장 긴 공통 조각 길이
  let best = 0; const prev = new Array(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) { let diag = 0; for (let j = 1; j <= b.length; j++) { const t = prev[j]; prev[j] = a[i - 1] === b[j - 1] ? diag + 1 : 0; if (prev[j] > best) best = prev[j]; diag = t; } }
  return best;
}
/* 🔴 같은 줄인가 — **줄 대 줄**로, 긴 쪽 길이로 나눠 재고, 숫자와 부정·비교 낱말이 똑같아야 한다 (2026-11-15 리뷰 C1).
   처음엔 첫째 줄을 둘째 읽기의 '전체 글자'에 대고 첫째 줄 길이로 나눴다 — 그래서 한쪽의 실수가 혼자 실렸다:
   「평점평균 2.0 이상인 자」(둘째) ↔ 「평점평균 3.5 이상인 자」(첫째 — 우대 줄의 숫자) · 「서울시 거주자가 아닌 자로서 …」 ↔ 「서울시 거주자」(잘린 줄) · 「3.0 이상」↔「3.0 미만」 */
const digitsOf = (n) => (n.match(/\d+(?:\.\d+)?/g) || []);
const TOK = /않|못|아니|아닌|없|미만|이하|이상|초과|이내|이외|제외|불가/g;
const toksOf = (n) => (n.match(TOK) || []).sort().join(',');
export function sameLine(a, b) {
  const x = norm(a), y = norm(b);
  if (!x || !y) return false;
  if (digitsOf(x).join(',') !== digitsOf(y).join(',') || toksOf(x) !== toksOf(y)) return false;
  return lcs(x, y) / Math.max(x.length, y.length) >= 0.7;
}
/* 칸 전체가 같은 말인가 — 두 읽기가 줄을 다르게 나눴을 뿐일 때(한쪽은 세 줄 · 한쪽은 한 줄) 줄 대 줄로는 안 맞는다.
   칸의 글자를 통째로 견준다: 숫자(여러 개면 모음으로)와 부정·비교 낱말이 똑같고, 두 글자 조각의 겹침(다이스)이 0.9 이상 */
const bigrams = (n) => { const m = new Map(); for (let i = 0; i < n.length - 1; i++) { const g = n.slice(i, i + 2); m.set(g, (m.get(g) || 0) + 1); } return m; };
export function fieldAgree(aLines, bLines) {
  const x = norm(aLines.join('')), y = norm(bLines.join(''));
  if (x.length < 2 || y.length < 2) return false;
  if (digitsOf(x).sort().join(',') !== digitsOf(y).sort().join(',') || toksOf(x) !== toksOf(y)) return false;
  const A = bigrams(x), B = bigrams(y); let both = 0;
  for (const [g, c] of A) both += Math.min(c, B.get(g) || 0);
  return (2 * both) / (x.length - 1 + y.length - 1) >= 0.9;
}
/* 「연장」 공고 — 받아 두지 못한 연장 공고문이 진짜 마감을 갖고 있을 수 있다(hy사회복지재단 「든든 학업지원금 연장 공고문.pdf」 — 포스터엔 옛 마감)
   ⚠️ 첨부 이름이 공고 데이터에 안 실려 있고 **본문 글자에만** 있는 경우가 있다(hy재단이 그랬다) — 원문 글자에서도 찾는다.
   사이트 메뉴의 「로그인 연장하기」 는 아니다 — 공고·기간·접수·마감에 붙은 연장만 */
const EXT_IN_TEXT = /연장\s?공고|공고\s?연장|(?:접수|신청|모집)\s?(?:기간|기한)\s?(?:을\s?)?[^.\n]{0,10}연장|기간\s?연장|마감\s?연장|[(（]\s?연장\s?[)）]|연장\s?(?:모집|접수|안내)/;
export const isExtension = (item, source = '') => /연장/.test([item.name, item.boardTitle, ...(item.attachments || []).map((a) => a && a.name)].filter(Boolean).join(' ')) || EXT_IN_TEXT.test(String(source));

/* 한 줄이라도 빠지면 틀린 판정이 되는 칸 — 자격(빠진 요건은 '틀린 안심') · 제외 · 서류. 이 칸은 한 줄이라도 두 읽기가 갈리면 **칸 전체를 싣지 않는다**(null = 무료 길 값 그대로).
   나머지 칸(금액 문구·방법·유의·우선)은 맞은 줄만 싣는다 — 맞은 줄이 하나도 없는데 갈린 줄이 있으면 그 칸도 null */
const STRICT_FIELDS = new Set(['eligibility', 'excludes', 'documents']);
/* 두 읽기(va·vb = verify 결과) → 실을 것(final · 칸마다 줄 배열 또는 null) · 사람에게 넘길 것(held). 첫째 읽기의 글자를 싣는다 */
export function agree(va, vb, item, source = '') {
  const final = {}, held = [];
  for (const k of LIST_FIELDS) {
    const A = va.kept[k], B = vb.kept[k];
    if (!A.length && !B.length) { final[k] = []; continue; }
    if (fieldAgree(A, B)) { final[k] = A.slice(); continue; }
    const ok = [], miss = [];
    for (const line of A) (B.some((o) => sameLine(line, o)) ? ok : miss).push({ field: k, line, why: '둘째 읽기에 없음' });
    for (const line of B) if (!A.some((o) => sameLine(o, line))) miss.push({ field: k, line, why: '첫째 읽기에 없음' });
    held.push(...miss);
    final[k] = miss.length && (STRICT_FIELDS.has(k) || !ok.length) ? null : ok.map((x) => x.line);
  }
  const da = va.kept.deadline, db = vb.kept.deadline;
  final.deadline = da && db && da.date === db.date ? da : null;
  if ((da || db) && !final.deadline) held.push({ field: 'deadline', line: `${da ? da.date : '없음'} / ${db ? db.date : '없음'}`, why: '두 읽기의 마감이 다름' });
  if (final.deadline && isExtension(item, source)) { held.push({ field: 'deadline', line: `${final.deadline.date} ← ${final.deadline.quote}`, why: '「연장」 공고 — 연장된 마감을 사람이 확인' }); final.deadline = null; }
  final.title = va.kept.title && norm(va.kept.title) === norm(vb.kept.title) ? va.kept.title : '';
  final.host = va.kept.host && norm(va.kept.host) === norm(vb.kept.host) ? va.kept.host : '';
  if ((va.kept.host || vb.kept.host) && !final.host) held.push({ field: 'host', line: `${va.kept.host || '없음'} / ${vb.kept.host || '없음'}`, why: '두 읽기의 주최가 다름' });
  final.multi = va.kept.multi || vb.kept.multi;
  return { final, held, unreadable: va.kept.unreadable && vb.kept.unreadable };
}
/* 맨 위 금액 — 금액 문구에서 숫자만(parse-amount wonIn). 묶인 공고는 종마다 달라 안 싣는다 · 총액·예산 줄은 1인당 금액이 아니다(「총 장학금 1억원」).
   ⚠️ 앱은 이 값을 **무료 길이 금액을 못 읽었을 때만** 쓴다(match-engine withCardRead · 리뷰 I5 — 무료 길의 금액 규칙이 더 꼼꼼하다) */
export function headAmount(final, item, wonIn) {
  if (final.multi || !final.amount) return 0;
  const wons = final.amount.filter((l) => !/총\s?(?:장학금|지원|예산|\d)|합계|예산|[~∼～-]\s?\d/.test(l)).map((l) => wonIn(l)).filter((v) => v > 0);
  return wons.includes(item.amountValue) ? item.amountValue : (wons.length === 1 ? wons[0] : 0);
}
/* 한 공고의 두 응답 → 앱에 실을 한 건(entry) 과 장부에 남길 것. 실을 것이 하나도 없으면 entry 는 null(무료 길 그대로) */
export function buildEntry(item, source, outA, outB, wonIn) {
  const va = verify(outA, source, item), vb = verify(outB, source, item);
  const { final, held, unreadable } = agree(va, vb, item, source);
  const dropped = [...va.dropped.map((x) => ({ ...x, by: 'a' })), ...vb.dropped.map((x) => ({ ...x, by: 'b' }))];
  const filled = LIST_FIELDS.some((k) => final[k] && final[k].length) || !!final.deadline;
  if (unreadable || !filled) return { entry: null, held, dropped, unreadable: true };
  const entry = { title: final.title, host: final.host };
  for (const k of LIST_FIELDS) entry[k] = final[k];
  entry.head = headAmount(final, item, wonIn);
  entry.deadline = final.deadline;
  entry.multi = final.multi;
  return { entry, held, dropped, unreadable: false };
}

/* ── 원문 = 게시판 본문 + 첨부 글자 (eligibility-ai·extract-excerpts 와 같은 길: notice-source · elig-docs · attachment-text) ── */
export function sourceText(parts) { return parts.map((x) => `===== ${x.label} =====\n${x.text}`).join('\n\n'); }
export const sourceHash = (text) => crypto.createHash('sha256').update(SYSTEM).update('\n').update(text).digest('hex').slice(0, 16);   // 지시문이 바뀌어도 다시 읽는다
export function makeSources({ texts, browserBodies, eligDocs, extractedDir }) {
  const idx = indexTexts(texts, browserBodies || {});
  return (it) => {
    const s = sourceFor(it, idx); const out = [];
    if (hasText(s)) out.push({ label: '게시판 본문', text: s.text });
    for (const f of docOrder(((eligDocs || {})[it.id] || {}).files || [])) {
      const p = `${extractedDir}/${f}`;
      let t = ''; try { t = attachmentText(p); } catch { /* 못 읽는 첨부는 건너뛴다 */ }
      if (t && readableDoc(p, t)) out.push({ label: `첨부 ${f.replace(/^elig-[a-z0-9]+-/, '').replace(/\.(ocr\.)?txt$/, '')}`, text: t });
    }
    return out;
  };
}
/* 학생 화면에서 내려간 공고인가 — 🔴 **유료가 읽은 마감이 있으면 그 마감으로** 잰다 (2026-11-15 리뷰 C4).
   무료 길 마감으로 재면, 유료가 「접수 시작일을 마감으로 읽은 것」을 바로잡은 공고(인석장학회 11.18 → 11.26)를 옛 마감 다음 날 결과 파일에서 지워 버린다 —
   그러면 앱은 무료 길로 돌아가 마지막 한 주 동안 그 공고를 「마감」으로 보인다. 앱도 같은 마감(얹은 뒤의 값)으로 잰다 */
export function closedNow(it, paid, today) {
  const d = paid && paid.deadline && paid.deadline.date;
  return closedForStudents(d ? { ...it, deadline: d } : it, today);
}
/* 대상 — 학생 화면에 떠 있는 정식 등록 공고 중, 원문이 있고, 그 원문(과 지시문)을 아직 안 읽은 것. 마감이 가까운 것부터 */
export function pickTargets(items, partsOf, ledger, { today, giveUpAfter = 3, only = null, paid = {} } = {}) {
  const out = [];
  for (const it of items) {
    if (it.program) continue;
    if (only ? it.id !== only : closedNow(it, paid[it.id], today)) continue;
    const text = sourceText(partsOf(it));
    if (text.replace(/[^가-힣]/g, '').length < 40) continue;      // 읽을 원문이 없다 — 무료 길 그대로
    const hash = sourceHash(text), led = ledger[it.id] || {};
    if (!only && led.hash === hash && (led.done || (led.tries || 0) >= giveUpAfter)) continue;
    out.push({ it, text, hash });
  }
  const key = (t) => t.it.deadline || '9999';
  return out.sort((x, y) => (key(x) < key(y) ? -1 : key(x) > key(y) ? 1 : 0));
}
/* 결과 파일의 꼴 — 앱이 받는 파일이라 저장 전에 스스로 잰다(워크플로 `--check`). 문제 줄 목록을 낸다(비면 통과) */
export function checkData(data) {
  const bad = [];
  if (!data || typeof data !== 'object' || !data.items || typeof data.items !== 'object' || Array.isArray(data.items)) return ['items 가 객체가 아니다'];
  for (const [id, e] of Object.entries(data.items)) {
    if (!e || typeof e !== 'object' || Array.isArray(e)) { bad.push(`${id}: 항목이 객체가 아니다`); continue; }
    for (const k of LIST_FIELDS) if (!(e[k] === null || (Array.isArray(e[k]) && e[k].every((l) => typeof l === 'string' && l.trim())))) bad.push(`${id}: ${k} 가 글자 배열도 null 도 아니다`);
    if (!(e.deadline === null || (e.deadline && /^\d{4}-\d{2}-\d{2}$/.test(String(e.deadline.date)) && typeof e.deadline.quote === 'string'))) bad.push(`${id}: deadline 꼴`);
    if (!(Number.isInteger(e.head) && e.head >= 0)) bad.push(`${id}: head 가 0 이상의 정수가 아니다`);
    if (typeof e.host !== 'string' || typeof e.multi !== 'boolean' || typeof e.hash !== 'string') bad.push(`${id}: host·multi·hash 꼴`);
  }
  return bad;
}

/* ── 모델 부르기 ── */
async function ask(client, model, item, source, effort) {
  /* 🔴 thinking 을 끄지 않는다(오퍼스 5.5·소넷 5.5 는 끄면 400) · 강제 tool_choice 도 안 쓴다 — 꼴은 output_config.format 이 지킨다.
     안전 거절은 날 일이 없지만 5.5 계열 기본대로 서버 쪽 대체 모델을 켜 둔다(fallbacks: "default") */
  const stream = client.beta.messages.stream({
    model, max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default',
    system: SYSTEM,
    output_config: { effort, format: { type: 'json_schema', schema: SCHEMA } },
    messages: [{ role: 'user', content: `공고 제목: ${item.name}\n게시한 곳: ${(item.eligibility && item.eligibility.schoolOnly) || '(여러 곳)'}\n\n${source}` }],
  });
  const msg = await stream.finalMessage();
  if (msg.stop_reason === 'refusal') throw new Error('모델이 처리를 거절함');
  if (msg.stop_reason === 'max_tokens') throw new Error('출력이 잘림');
  const text = msg.content.find((b) => b.type === 'text');
  if (!text) throw new Error('글자 응답이 없음');
  const u = msg.usage || {}, [pi, po] = PRICE[model] || [0, 0];
  return { out: JSON.parse(text.text), usd: ((u.input_tokens || 0) * pi + (u.output_tokens || 0) * po) / 1e6 };
}

/* ── 본편 — 직접 실행할 때만 (진짜 경로로 견준다 · find-boards.mjs 와 같은 이유) ── */
const ranDirectly = () => { try { return fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url)); } catch { return false; } };
if (process.argv[1] && ranDirectly()) {
  const WRITE = process.argv.includes('--write');
  const RECHECK = process.argv.includes('--recheck');   // 장부에 남긴 응답 원본으로 결과를 다시 만든다(규칙을 고친 뒤 · 돈 0)
  const ONLY = (process.argv.find((a) => a.startsWith('--only=')) || '').slice(7) || null;
  const TODAY = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);   // KST
  /* 있는 파일이 깨져 있으면 멈춘다 — 빈 것으로 읽고 이어 가면 전부 다시 읽는다(돈) · 없는 파일만 기본값 (리뷰 I10) */
  const strictJson = (rel, dflt) => { if (!fs.existsSync(P(rel))) return dflt; try { return JSON.parse(fs.readFileSync(P(rel), 'utf8')); } catch (e) { console.error(`[card-read] ${rel} 을 읽지 못했습니다(깨진 파일) — 멈춥니다: ${e.message}`); process.exit(1); } };
  const cfg = { enabled: false, maxPerRun: 20, maxUsdPerRun: 3, giveUpAfter: 3, effort: 'medium', maxMs: 9 * 60 * 1000, ...readJson('card-read-config.json', {}) };
  const data = strictJson('../data/card-read.json', { items: {} });
  if (!data.items) data.items = {};
  if (process.argv.includes('--check')) {
    const bad = checkData(data);
    bad.slice(0, 20).forEach((l) => console.error(`[card-read] ✕ ${l}`));
    log(bad.length ? `결과 파일 꼴 문제 ${bad.length}건` : `결과 파일 꼴 통과 — ${Object.keys(data.items).length}건`);
    process.exit(bad.length ? 1 : 0);
  }
  const reg = readJson('../data/registered.json', { items: [] });
  const partsOf = makeSources({ texts: readJson('extracted/notices-text.json', {}), browserBodies: readJson('extracted/browser-bodies.json', {}), eligDocs: readJson('extracted/elig-docs.json', {}), extractedDir: P('extracted') });
  const ledger = strictJson('card-read-ledger.json', {});
  const { wonIn } = require('../parse-amount.js');
  /* 임시 파일에 쓰고 이름을 바꾼다(쓰다 죽어도 반쪽 파일이 안 남는다) · 결과 파일을 장부보다 먼저(장부만 '읽음'이고 결과가 없는 상태가 안 생긴다) */
  const writeAtomic = (rel, obj) => { const p = P(rel), tmp = `${p}.tmp`; fs.writeFileSync(tmp, `${JSON.stringify(obj, null, 1)}\n`); fs.renameSync(tmp, p); };
  const save = () => { data.updatedAt = TODAY; writeAtomic('../data/card-read.json', data); writeAtomic('card-read-ledger.json', ledger); };

  /* 학생 화면에서 내려간 공고·목록에서 빠진 공고는 결과 파일과 장부에서 뺀다(자라기만 하지 않게) — 내려갔는지는 유료 마감으로 잰다(closedNow) */
  const live = new Map(reg.items.map((it) => [it.id, it]));
  let pruned = 0;
  for (const id of Object.keys(data.items)) { const it = live.get(id); if (!it || closedNow(it, data.items[id], TODAY)) { delete data.items[id]; pruned += 1; } }
  for (const id of Object.keys(ledger)) { const it = live.get(id); if (!it || (!data.items[id] && closedNow(it, null, TODAY))) delete ledger[id]; }

  /* 한 건의 두 응답을 결과·장부에 적는다 — 읽기와 다시 재기(--recheck)가 같은 길 */
  const put = (it, text, hash, outA, outB) => {
    const led = ledger[it.id] = { ...(ledger[it.id] || {}), name: String(it.name).slice(0, 60), hash };
    const r = buildEntry(it, text, outA, outB, wonIn);
    led.done = true; led.at = TODAY; led.held = r.held; led.dropped = r.dropped; led.raw = { a: outA, b: outB };
    if (r.unreadable) led.unreadable = true; else delete led.unreadable;
    delete led.error;
    if (r.entry) data.items[it.id] = { ...r.entry, hash, readAt: TODAY }; else delete data.items[it.id];
    return r;
  };

  if (RECHECK) {
    let n = 0, filled = 0;
    for (const it of reg.items) {
      const led = ledger[it.id];
      if (!led || !led.raw || closedNow(it, data.items[it.id], TODAY)) continue;
      const text = sourceText(partsOf(it));
      if (sourceHash(text) !== led.hash) continue;   // 원문이 바뀌었다 — 다음 유료 실행이 다시 읽는다
      const r = put(it, text, led.hash, led.raw.a, led.raw.b); n += 1; if (r.entry) filled += 1;
    }
    if (WRITE) save();
    log(`다시 재기 — 응답 원본 ${n}건으로 결과를 다시 만들었습니다(실음 ${filled}) · 쓴 돈 $0${WRITE ? '' : ' · 미리보기(--write 로 반영)'}`);
    process.exit(0);
  }

  const targets = pickTargets(reg.items, partsOf, ledger, { today: TODAY, giveUpAfter: cfg.giveUpAfter, only: ONLY, paid: data.items });
  log(`대상 ${targets.length}건 (학생 화면에 떠 있고 · 원문이 있고 · 이 원문을 아직 안 읽은 정식 등록 공고) · 이미 실린 것 ${Object.keys(data.items).length}건 · 내린 것 ${pruned}건`);
  const fake = process.env.CARD_READ_FAKE ? JSON.parse(fs.readFileSync(process.env.CARD_READ_FAKE, 'utf8')) : null;
  const paidOn = cfg.enabled === true && process.env.CARD_READ_ENABLE === '1';
  if (!WRITE) { targets.slice(0, 30).forEach((t) => log(`  · ${t.it.id} · ${String(t.it.name).slice(0, 40)} · 원문 ${t.text.length}자`)); log('미리보기 — 부르지 않았습니다 (--write 로 반영)'); process.exit(0); }
  if (!fake && !paidOn) { if (pruned) save(); log(`유료 스위치가 꺼져 있어 부르지 않았습니다 (card-read-config.json enabled: ${cfg.enabled} · CARD_READ_ENABLE: ${process.env.CARD_READ_ENABLE || '없음'})`); process.exit(0); }

  let client = null;
  if (!fake) { const { default: Anthropic } = await import('@anthropic-ai/sdk'); client = new Anthropic(); }
  const t0 = Date.now();
  let usd = 0, done = 0, filled = 0, failed = 0, streak = 0, heldN = 0, stopped = '';
  try {
    for (const t of targets) {
      const left = targets.length - done - failed;
      if (done + failed >= cfg.maxPerRun) { stopped = `한 실행 상한 ${cfg.maxPerRun}건`; log(`${stopped}에 닿아 멈춥니다 — 남은 ${left}건은 다음 실행`); break; }
      if (usd >= cfg.maxUsdPerRun) { stopped = `한 실행 예산 $${cfg.maxUsdPerRun}`; log(`${stopped}에 닿아 멈춥니다 — 남은 ${left}건은 다음 실행`); break; }
      if (Date.now() - t0 >= cfg.maxMs) { stopped = '시간 예산'; log(`시간 예산(${Math.round(cfg.maxMs / 60000)}분)에 닿아 멈춥니다 — 남은 ${left}건은 다음 실행`); break; }
      /* 🔴 연달아 세 번 실패하면 멈춘다(리뷰 I8) — 잔액 부족·요청 꼴 오류 같은 '전부 실패'가 상한까지 돈을 쓰며 도는 것을 막는다 */
      if (streak >= 3) { stopped = '연달아 실패'; log(`연달아 ${streak}건 실패해 멈춥니다 — 남은 ${left}건은 다음 실행`); break; }
      if (fake && !fake[t.it.id]) continue;   // 가짜 응답에 없는 공고는 건드리지 않는다(장부에도 안 적는다)
      const led = ledger[t.it.id] = { ...(ledger[t.it.id] || {}), name: String(t.it.name).slice(0, 60) };
      if (led.hash !== t.hash) { led.hash = t.hash; led.tries = 0; led.done = false; delete led.raw; }
      /* 두 읽기를 함께 부르되, **한쪽이 실패해도 다른 쪽에 쓴 돈은 센다**(allSettled) — 안 세면 예산 상한이 실제보다 늦게 걸린다 */
      const [sa, sb] = fake ? [{ status: 'fulfilled', value: { out: fake[t.it.id].a, usd: 0 } }, { status: 'fulfilled', value: { out: fake[t.it.id].b, usd: 0 } }]
        : await Promise.allSettled([ask(client, MODELS.a, t.it, t.text, cfg.effort), ask(client, MODELS.b, t.it, t.text, cfg.effort)]);
      const spent = (sa.status === 'fulfilled' ? sa.value.usd : 0) + (sb.status === 'fulfilled' ? sb.value.usd : 0);
      usd += spent; led.usd = Math.round(((led.usd || 0) + spent) * 10000) / 10000;
      if (sa.status === 'fulfilled' && sb.status === 'fulfilled') {
        const r = put(t.it, t.text, t.hash, sa.value.out, sb.value.out);
        heldN += r.held.length; done += 1; streak = 0; if (r.entry) filled += 1;
        log(`  ✓ ${t.it.id} · ${String(t.it.name).slice(0, 30)} · ${r.entry ? ['eligibility', 'excludes', 'documents'].map((k) => `${{ eligibility: '자격', excludes: '제외', documents: '서류' }[k]} ${r.entry[k] ? r.entry[k].length : '보류'}`).join(' · ') + ` · 마감 ${r.entry.deadline ? r.entry.deadline.date : '—'}` : '실을 것 없음(무료 길 그대로)'} · 넘긴 줄 ${r.held.length} · 버린 줄 ${r.dropped.length}`);
      } else {
        failed += 1; streak += 1; led.tries = (led.tries || 0) + 1;
        led.error = String(((sa.status === 'rejected' ? sa.reason : sb.reason) || {}).message || sa.reason || sb.reason).slice(0, 200);
        log(`  ✕ ${t.it.id} · ${led.error}`);
      }
      save();   // 건마다 저장 — 중간에 강제 종료돼도(단계 시한) 돈을 쓴 결과를 잃지 않는다
    }
  } finally {
    save();
  }
  log(`끝 — 읽음 ${done}건(실음 ${filled}) · 실패 ${failed}건 · 사람에게 넘긴 줄 ${heldN} · 쓴 돈 $${usd.toFixed(4)} · 결과 파일 ${Object.keys(data.items).length}건${stopped ? ` · 멈춘 까닭: ${stopped}` : ''}`);
  /* 실패가 있으면 빨갛게 끝낸다 — 한 건만 성공해도 초록이면 19건 실패가 조용하다(리뷰 I8). 읽은 것은 위에서 이미 저장했다 */
  if (failed) process.exit(1);
}

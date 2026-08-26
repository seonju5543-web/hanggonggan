/* ============================================================
   금액·이중수혜·동일성 뽑기 (2026-08-27 신설)

   등록 공고 원문에서 세 가지를 읽어 data/registered.json 에 넣는다.
     · amountSpec   — 얼마인가 (절대액 / 등록금 비율 / 범위 / 시급 / 미확인)
     · exclusivity  — 다른 장학금과 함께 받을 수 있는가
     · sameAs       — 같은 장학금이 여러 학교 접수분으로 등록돼 있는가

   🔴 왜 셋을 한 번에 하나: 셋 중 하나만 해도 홈 합계가 **더 틀린다.**
      금액만 채우면 (재)가송재단 8건이 4,000만원으로 세어지고,
      이중수혜를 모르면 함께 못 받는 공고를 다 더한다. 학생이 실제로 받을 수 없는
      숫자를 '지금 받을 수 있는 장학금'이라고 말하는 것은 기망이다(개발자 지시 2026-08-27).

   판정 규칙은 여기에 없다 — parse-amount.js 한 곳에 있다(화면·감사와 공유).
   이 파일이 하는 일은 '원문을 찾아 그 함수에 먹이고 결과를 저장'뿐이다.

   실행:  node collector/extract-amounts.mjs          (미리보기 — 아무것도 안 고침)
          node collector/extract-amounts.mjs --write  (registered.json 반영)
   ============================================================ */
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { indexTexts, sourceFor, hasText } from './notice-source.mjs';

const require = createRequire(import.meta.url);
const PA = require('../parse-amount.js');

const HERE = new URL('.', import.meta.url);
const WRITE = process.argv.includes('--write');
const regPath = new URL('../data/registered.json', import.meta.url);
const reg = JSON.parse(fs.readFileSync(regPath, 'utf8'));
const items = reg.items || [];

const texts = JSON.parse(fs.readFileSync(new URL('extracted/notices-text.json', HERE), 'utf8'));
let browserBodies = {};
try { browserBodies = JSON.parse(fs.readFileSync(new URL('extracted/browser-bodies.json', HERE), 'utf8')); } catch { /* 아직 없음 */ }
const idx = indexTexts(texts, browserBodies);

/* ── 동일성 ────────────────────────────────────────────────────
   같은 재단이 여러 학교에서 접수하는 공고는 **하나의 장학금**이다.
   (재)가송재단이 8개 학교 접수분으로 등록돼 있는 것이 실제 사례다.

   🔴 느슨한 제목 대조로 이으면 안 된다 (CLAUDE.md 2026-08-21 사고):
      `복지장학금 (서울캠퍼스)`가 `(다빈치캠퍼스)` 공고에 붙은 적이 있다.
      그래서 조건 셋을 **모두** 만족할 때만 잇는다 (자세한 사정은 아래 merges 주석):
        ① 이름/주관에서 `○○재단·○○장학회` 꼴 이름표가 뽑히고
        ② 원문에서 읽어낸 **금액이 정확히 같은 것이 2건 이상**이고
        ③ 그 2건이 서로 **다른 학교 게시판**에서 온 것일 때
      하나라도 어긋나면 잇지 않는다 —
      **안 잇는 것은 합계가 부풀 뿐이고, 잘못 잇는 것은 남의 공고가 붙는 것이다.**
   ────────────────────────────────────────────────────────── */
const FOUND_RE = /([가-힣A-Za-z]{2,10})\s*(재단|장학회|장학재단|문화재단|복지재단|장학문화재단)/;
/* 학교 이름이 들어간 것은 그 학교 교내 장학금이라 잇지 않는다 */
const SCHOOL_WORD = /(대학교|대학|학원|캠퍼스)/;

function foundationKey(it) {
  const src = `${it.provider || ''} ${it.name || ''}`;
  const m = src.match(FOUND_RE);
  if (!m) return '';
  const name = m[1].replace(/^\(재\)|^재\)|^\(사\)/, '').trim();
  if (name.length < 2 || SCHOOL_WORD.test(name)) return '';
  return name + m[2];
}

/* 어느 학교 게시판에서 온 공고인가 — 같은 학교끼리는 잇지 않는다(교내 중복일 수 있다) */
function originOf(it) {
  const u = String(it.sourceUrl || '');
  const m = u.match(/^https?:\/\/([^/]+)/);
  return m ? m[1].replace(/^www\./, '') : (it.school || '');
}

/* ── 읽기 ─────────────────────────────────────────────────── */
let read = 0, noText = 0;
const stat = { fixed: 0, ratio: 0, range: 0, hourly: 0, unknown: 0 };
const excl = { forbidden: 0, allowed: 0, unknown: 0 };
const parsed = new Map();

for (const it of items) {
  const src = sourceFor(it, idx);
  if (!hasText(src)) { noText++; continue; }
  read++;
  const lines = String(src.text).split('\n').map((s) => s.trim()).filter(Boolean);
  const a = PA.amountFrom(lines);
  const e = PA.exclusivityFrom(lines);
  stat[a.kind]++; excl[e.kind]++;
  parsed.set(it.id, { a, e });
}

/* ── 동일성 묶기 ──────────────────────────────────────────── */
const byFoundation = new Map();
for (const it of items) {
  const key = foundationKey(it);
  if (!key) continue;
  if (!byFoundation.has(key)) byFoundation.set(key, []);
  byFoundation.get(key).push(it);
}

/* 🔴 재단 이름만으로는 부족하다 (처음에 그렇게 썼다가 실제로 틀렸다):
     · 한국장학재단 7건 — 국가근로·주거안정·대청교 멘토는 **서로 다른 사업**인데 한 건으로 묶였다
     · 한국고등교육재단 2건 — 동아시아연구장학생과 인재림 제6기는 다른 사업이다
   큰 재단은 사업을 여러 개 굴린다. 그래서 이름표에 더해 **금액이 같다는 증거**를 요구한다:
   같은 재단 안에서 **원문에서 읽어낸 금액이 정확히 같은 것끼리만**, 그것도 **2건 이상이
   각자 읽었을 때만** 묶는다. 한 건만 읽히고 나머지가 미확인이면 묶지 않는다 —
   미확인은 어차피 0원이라 합계가 부풀지 않으므로, **안 묶는 쪽이 언제나 안전하다.** */
const merges = [];
for (const [key, group] of byFoundation) {
  if (group.length < 2) continue;
  const byWon = new Map();
  for (const g of group) {
    const won = parsed.get(g.id)?.a.value || 0;
    if (!won) continue;                       // 미확인은 묶지 않는다 (0원이라 무해)
    if (!byWon.has(won)) byWon.set(won, []);
    byWon.get(won).push(g);
  }
  for (const [won, same] of byWon) {
    if (same.length < 2) continue;            // 혼자면 증거가 아니다
    const origins = new Set(same.map(originOf));
    if (origins.size < 2) continue;           // 같은 학교끼리는 교내 중복일 수 있다
    merges.push({ key, group: same, won, skipped: group.length - same.length });
  }
}

/* ── 보고 ─────────────────────────────────────────────────── */
const man = (n) => (n ? (n / 10000).toLocaleString('ko-KR') + '만원' : '-');

/* 카드에 뜰 금액 문구. 만원으로 딱 떨어지면 `500만원`, 아니면 `1,234,000원`. */
const wonText = (n) => (n % 10000 === 0
  ? (n / 10000).toLocaleString('ko-KR') + '만원'
  : n.toLocaleString('ko-KR') + '원');
const amountText = (a) => (a.kind === 'range'
  ? `${wonText(a.min)} ~ ${wonText(a.max)}`
  : wonText(a.value));
console.log(`\n■ 금액 읽기 — 등록 ${items.length}건 (원문 있음 ${read} · 없음 ${noText})`);
console.log(`   절대액 ${stat.fixed + stat.range}건 · 등록금 비율 ${stat.ratio}건 · 시급 ${stat.hourly}건 · 미확인 ${stat.unknown}건`);
console.log(`\n■ 이중수혜`);
console.log(`   함께 못 받음 ${excl.forbidden}건 · 함께 받을 수 있음 ${excl.allowed}건 · 원문에 없음 ${excl.unknown}건`);
console.log(`\n■ 같은 장학금으로 묶은 것 — ${merges.length}갈래`);
for (const m of merges) {
  console.log(`   ${m.key} · ${m.group.length}건 · ${man(m.won)}${m.skipped ? `  (같은 재단 ${m.skipped}건은 금액 미확인이라 안 묶음)` : ''}`);
  m.group.forEach((g) => console.log(`      - ${g.id}  ${String(g.name || '').slice(0, 46)}`));
}

if (!WRITE) {
  console.log('\n(미리보기입니다 — 아무것도 고치지 않았습니다. 반영하려면 --write)');
  process.exit(0);
}

/* ── 반영 ─────────────────────────────────────────────────── */
const sameAsOf = new Map();
for (const m of merges) for (const g of m.group) sameAsOf.set(g.id, m.key);

let wrote = 0;
for (const it of items) {
  const got = parsed.get(it.id);
  if (got) {
    const { a, e } = got;
    /* 🔴 `amount` 가 아니라 `amountSpec` 이다 — `amount` 는 이미 금액 문구 문자열 칸이다.
       처음에 `amount` 에 객체를 넣었다가 entry-rules.cjs 의 `it.amount.slice()` 가 죽어
       감사가 통째로 멈췄다. 앱·챗봇·알림도 전부 문자열로 읽는다. */
    if (a.kind === 'unknown') delete it.amountSpec;
    else { it.amountSpec = a; wrote++; }

    /* 🔴 amountValue 는 남겨 둔다 — 앱·챗봇·관리자 화면이 아직 이걸 읽는다.
       amount 를 읽는 쪽으로 다 옮기기 전에 지우면 금액이 통째로 사라진다.
       비율형·시급형은 학생 등록금을 모르면 원으로 못 바꾸므로 0 그대로 둔다
       (지어내지 않는다 — 원칙 8-1). */
    if (a.kind === 'fixed' || a.kind === 'range') {
      it.amountValue = a.value;
      /* 🔴 화면 문구도 같이 고쳐야 한다. 숫자만 채우고 `금액 원문 확인` 을 그대로 두면
         **카드는 "금액 원문 확인", 합계는 500만원**이라고 서로 다른 말을 한다.
         감사(entry-rules.cjs)가 바로 이걸 오류로 잡는다 — 처음에 그 상태로 저장했다가 걸렸다.
         ⚠️ 이미 숫자가 든 문구는 건드리지 않는다. 사람이 손으로 다듬어 넣은 것
            (`등록금 + 영농정착 지원` 같은)을 맨 숫자로 덮으면 뜻이 사라진다. */
      if (!/\d/.test(String(it.amount || ''))) it.amount = amountText(a);
    }

    if (e.kind === 'unknown') delete it.exclusivity;
    else it.exclusivity = e;
  }
  const key = sameAsOf.get(it.id);
  if (key) it.sameAs = key; else delete it.sameAs;
}

reg.updatedAt = new Date().toISOString();
fs.writeFileSync(regPath, JSON.stringify(reg, null, 1) + '\n');
console.log(`\nregistered.json 반영 완료 — 금액 ${wrote}건 · 동일성 ${sameAsOf.size}건`);

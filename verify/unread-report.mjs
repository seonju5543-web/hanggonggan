/* ============================================================
   읽지 못한 공고 현황 — 금액·마감·자격을 못 읽은 정식 등록 공고를 **원인별로** 세어 리포트에 붙인다 (2026-10-29)

   왜: 개발자가 카드를 하나씩 열어 보고 "이건 왜 금액이 없어?"라고 알려 줘야 고쳐지던 것을 끝낸다.
       같은 숫자를 매일 로봇이 세어 수집 리포트(GitHub 이슈)에 붙이면, 새 유형은 **사람이 아니라 숫자가** 먼저 말한다.
   무엇을 가르나(마감 전 공고만 · 상시 제도 제외):
     · 원문 없음           — 받아 온 글자가 메뉴뿐(껍데기)이거나 없다 → 자격요건 로봇(rescue-bodies)의 몫
     · 글자 있는데 못 읽음 — 원문에 금액 글자·이름표 달린 날짜가 있는데 규칙이 못 읽었다 → **규칙 고칠 일**(이 목록이 개발자가 알려 주던 그것)
     · 원문에 없음         — 글자는 있는데 금액·날짜가 적혀 있지 않다 → 첨부가 있으면 첨부 로봇의 몫, 없으면 정직하게 빈 칸
   베끼지 않는다: 원문 찾기는 notice-source(indexTexts·sourceFor·hasText), 금액은 parse-amount, 마감은 extract-excerpts 그대로.
   쓰는 곳: collect-scholarships.yml 「읽지 못한 공고 현황」 단계가 collector/report.md 끝에 붙인다 · 관문 test-collector 「읽지 못한 공고 현황」.
   ============================================================ */
import fs from 'node:fs';
import { createRequire } from 'node:module';
process.env.EXCERPTS_AS_LIB = process.env.EXCERPTS_AS_LIB || '1';
const require = createRequire(import.meta.url);
const PA = require('../parse-amount.js');
const NS = await import('../collector/notice-source.mjs');
const EX = await import('../collector/extract-excerpts.mjs');

const WON_WORD = /\d[\d,]*\s?(만\s?원|원)|등록금\s?(전액|반액|\d+\s?%)/;
const DATE_WORD = /20\d\d\s?[.\-년]\s?\d{1,2}\s?[.\-월]\s?\d{1,2}|\d{1,2}\s?월\s?\d{1,2}\s?일|\d{1,2}\s?[./]\s?\d{1,2}\s?[(（]/;
const PERIOD_WORD = /(신청|접수|모집|제출)\s?(\([^)]*\)\s?)?(기간|기한|마감|일정)/;
const amountKnown = (it) => it.amountValue > 0 || /(전액|반액|\d\s?%|시급|시간당)/.test(String(it.amount || ''));

/** 순수 분류 — 관문이 가짜 자료로 돌려 본다. @returns {{amount:Object, deadline:Object, elig:Object}} 원인 → 공고 목록 */
export function classify(items, idx, { today = new Date().toISOString().slice(0, 10), eligDocs = {} } = {}) {
  const open = items.filter((s) => !s.program && (!s.deadline || s.deadline >= today));
  const amount = {}, deadline = {}, elig = {};
  const put = (bag, k, s) => { (bag[k] = bag[k] || []).push(s); };
  for (const s of open) {
    const src = NS.sourceFor(s, idx);
    const has = NS.hasText(src);
    const docs = ((eligDocs[s.id] || {}).files || []).length > 0;
    if (!amountKnown(s)) {
      if (!has) put(amount, docs ? '원문 없음·첨부 있음' : '원문 없음·첨부 없음', s);
      else {
        const got = PA.amountFrom(String(src.text).split('\n').map((x) => x.trim()).filter(Boolean));
        if (got.kind !== 'unknown') put(amount, '지금 규칙으로는 읽힘(다음 실행이 채움)', s);
        else if (WON_WORD.test(src.text)) put(amount, '글자 있는데 못 읽음', s);
        else put(amount, docs ? '원문에 금액 없음·첨부 있음' : '원문에 금액 없음·첨부 없음', s);
      }
    }
    if (!s.deadline) {
      if (!has) put(deadline, '원문 없음', s);
      else if (EX.extractDeadline(src.text)) put(deadline, '지금 규칙으로는 읽힘(다음 실행이 채움)', s);
      else if (PERIOD_WORD.test(src.text) && DATE_WORD.test(src.text)) put(deadline, '글자 있는데 못 읽음', s);
      else if (DATE_WORD.test(src.text)) put(deadline, '날짜만 있음(이름표 없음)', s);
      else put(deadline, '원문에 날짜 없음', s);
    }
    if (!(s.eligibilityLines || []).length) put(elig, has ? '원문 있는데 자격 절 없음' : '원문 없음', s);
  }
  return { open: open.length, amount, deadline, elig };
}

/** 리포트 글자 — 원인별 건수 + '글자 있는데 못 읽음'은 공고 이름까지(규칙 고칠 목록) */
export function render(r) {
  const lines = ['', '## 🔎 읽지 못한 공고 현황 (마감 전 정식 등록 ' + r.open + '건 · 상시 제도 제외)', ''];
  const sec = (title, bag) => {
    const total = Object.values(bag).reduce((n, v) => n + v.length, 0);
    lines.push(`### ${title} — ${total}건`);
    for (const k of Object.keys(bag).sort((a, b) => bag[b].length - bag[a].length)) {
      lines.push(`- ${k}: ${bag[k].length}건`);
      if (/못 읽음/.test(k)) for (const s of bag[k].slice(0, 12)) lines.push(`    - ${String(s.name || '').slice(0, 48)} \`${s.id}\``);
    }
    lines.push('');
  };
  sec('💰 금액 모름', r.amount);
  sec('📅 마감 없음', r.deadline);
  sec('📋 자격 줄 없음', r.elig);
  lines.push('> 「글자 있는데 못 읽음」은 규칙이 고칠 목록(parse-amount · extract-excerpts) · 「원문 없음」은 자격요건 로봇(rescue-bodies)이 다시 받는다 · 「원문에 없음」은 첨부 로봇 몫이거나 정직한 빈 칸.');
  return lines.join('\n');
}

if (process.argv[1] && /unread-report\.mjs$/.test(process.argv[1])) {
  const HERE = new URL('../collector/', import.meta.url);
  const items = JSON.parse(fs.readFileSync(new URL('../data/registered.json', import.meta.url), 'utf8')).items || [];
  const texts = JSON.parse(fs.readFileSync(new URL('extracted/notices-text.json', HERE), 'utf8'));
  let bodies = {}; try { bodies = JSON.parse(fs.readFileSync(new URL('extracted/browser-bodies.json', HERE), 'utf8')); } catch { /* 없음 */ }
  let eligDocs = {}; try { eligDocs = JSON.parse(fs.readFileSync(new URL('extracted/elig-docs.json', HERE), 'utf8')); } catch { /* 없음 */ }
  console.log(render(classify(items, NS.indexTexts(texts, bodies), { eligDocs })));
}

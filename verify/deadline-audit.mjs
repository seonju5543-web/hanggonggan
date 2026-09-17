/* 마감일 감사 — '이 마감이 어디서 왔고 말이 되는가'를 전수로 본다 (2026-09-17 · 노션 G-3)

   개발자 지적(2026-09-16): "마감일이 아직 지나지 않았음에도 마감된 공고라고 뜨면서 신청 불가로
   뜨는 문제". 마감은 학생에게서 신청 버튼을 빼앗는 값이라 **틀린 마감은 못 읽은 것보다 나쁘다.**
   그런데 지금까지는 '마감을 읽었는가'만 세고 '읽은 마감이 맞는가'는 아무도 안 봤다.

   이 도구가 하는 일 — 등록 공고마다:
     ① 근거 줄 — 저장된 본문·첨부에서 **그 마감을 실제로 내는 줄**을 찾아 보여 준다.
        (마감을 읽는 규칙은 extract-excerpts 의 것을 그대로 부른다 — 베끼지 않는다)
     ② 말이 되는가 — 다음이면 🔴 의심으로 올린다:
        · 등록일보다 앞선 마감(게시되기 전에 끝난 접수)   · 등록일에서 1년 넘게 먼 마감
        · 화면 문구(period)의 날짜와 다른 마감            · 첨부에서 읽었는데 그 첨부가 신청서 서식
        · 근거 줄을 못 찾은 로봇 마감(제목·옛 규칙에서 온 것)
     ③ 안 보이는 공고 — 마감을 못 읽어 등록 60일 뒤 목록에서 내려간 것(학생 눈엔 '사라짐').

   🔴 판정을 새로 만들지 않는다. 사람이 볼 표를 만들 뿐이다. 의심이 곧 오류는 아니다 —
      원문을 열어 확인한 뒤 고친다(원칙 5 · 확인 안 한 원인을 단정하지 않는다).
   관문: test-collector '마감일 감사' 절 — 의심 건수가 굳혀 둔 천장보다 늘면 빨간불(톱니).

   실행: node verify/deadline-audit.mjs          (요약 + 의심 목록)
         node verify/deadline-audit.mjs --all    (전 공고의 근거 줄까지)
*/
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { indexTexts, sourceFor, hasText } from '../collector/notice-source.mjs';
import { attachmentText, readable } from '../collector/attachment-text.mjs';

const require = createRequire(import.meta.url);
const M = require('../match-engine.js');
process.env.EXCERPTS_AS_LIB = '1';
const EX = await import('../collector/extract-excerpts.mjs');

const ROOT = new URL('../', import.meta.url);
const readJson = (rel, fallback) => {
  try { return JSON.parse(fs.readFileSync(fileURLToPath(new URL(rel, ROOT)), 'utf8')); } catch { return fallback; }
};
const reg = readJson('data/registered.json', { items: [] });
const texts = readJson('collector/extracted/notices-text.json', []);
const bodies = readJson('collector/extracted/browser-bodies.json', {});
const eligDocs = readJson('collector/extracted/elig-docs.json', {});
const idx = indexTexts(texts, bodies);

const ALL = process.argv.includes('--all');
const FORMISH_FILE = /서식|양식|신청서|지원서|선발원서|동의서|서약서|추천서|계획서/;

/* 글에서 **마감을 내는 첫 줄**을 찾는다 — 규칙은 extractDeadline 그대로, 줄 단위로 부른다.
   ⚠️ 해가 빠진 날짜(`~ 7월 31일까지`)는 공고 전체의 해를 빌리므로 줄 하나만 주면 못 읽는다.
      그래서 못 찾으면 글 전체로 한 번 더 읽어 '전체로는 읽힘(해 빌림)'을 구분해 적는다. */
function evidenceLine(text, want) {
  if (!text) return null;
  const lines = String(text).split(/\n+/).map((l) => l.trim()).filter(Boolean);
  for (const l of lines) if (l.length <= 200 && EX.extractDeadline(l) === want) return l;
  return EX.extractDeadline(text) === want ? '(줄 하나로는 안 읽히고 글 전체로 읽힘 — 해를 빌린 날짜)' : null;
}

function docsOf(it) {
  const out = [];
  for (const f of (eligDocs[it.id] || {}).files || []) {
    const t = attachmentText(fileURLToPath(new URL(`collector/extracted/${f}`, ROOT)));
    if (readable(t)) out.push({ file: f, text: t });
  }
  return out;
}

/* 문구에 적힌 **마지막 날짜** — `신청 2026.7.6(월) ~ 8.31(월) 18:00` 의 끝은 8.31 이다.
   해가 안 적힌 끝 날짜는 앞의 해(없으면 마감의 해)를 빌린다 — dateFrom 과 같은 뜻. */
export function lastDateIn(text, year) {
  /* `모집 ~2026.8.5 · 선발 발표 8.26(수)` — 발표·지급 날짜는 마감이 아니다. 그 말 앞까지만 본다 */
  const p = String(text || '').split(/발표|지급|공고일|게시/)[0];
  /* ⚠️ 뒤에 소수점 자리가 더 오면 날짜가 아니다 — `평점 3.5 ~ 4.5` 를 3월 5일로 읽지 않는다 */
  const re = /(?<!\d)(?:(20\d{2})\s?[-./년]\s?)?(\d{1,2})\s?[-./월]\s?(\d{1,2})(?![\d.]\d)(?!\d)/g;
  let last = null, y = year, prevMo = 0;
  for (const m of p.matchAll(re)) {
    if (m[1]) y = m[1];
    if (!y) continue;
    const mo = Number(m[2]), da = Number(m[3]);
    if (mo < 1 || mo > 12 || da < 1 || da > 31) continue;
    /* 성적 이야기 속 소수(`평점 3.5 ~ 4.5`)는 날짜가 아니다 — 앞 10자에 성적 낱말이 있거나 뒤에 `점·이상` 이 붙는다 */
    if (/평점|성적|학점|점수|GPA/i.test(p.slice(Math.max(0, m.index - 10), m.index)) || /^\s*(점|이상|이하|만점)/.test(p.slice(m.index + m[0].length))) continue;
    /* 해가 안 적힌 채 달이 거꾸로 가면(`12.20 ~ 1.10`) 해가 넘어간 것이다(2026-09-17 코드 리뷰) */
    if (!m[1] && prevMo && mo < prevMo) y = String(Number(y) + 1);
    prevMo = mo;
    last = `${y}-${String(mo).padStart(2, '0')}-${String(da).padStart(2, '0')}`;
  }
  return last;
}
/* 제목의 `(~9/10)`·`(9.11~9.28)` — auto-register 가 제목에서 읽는 마감의 근거 */
function titleEnd(name, year) {
  const m = String(name || '').match(/[~∼〜～]\s?(\d{1,2})\s?[./]\s?(\d{1,2})\s?\)?/);
  if (!m || !year) return null;
  return `${year}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
}

export function auditDeadlines(now) {
  const today = new Date(now || Date.now());
  const rows = [];
  for (const it of reg.items) {
    if (it.program) continue;
    const row = { id: it.id, name: it.name, deadline: it.deadline || null, from: it.deadlineFrom || '',
      listedAt: it.listedAt || null, period: it.period || '', flags: [], evidence: null, evidenceIn: null };
    const human = /^(AI|관리자)/.test(row.from);
    if (!it.deadline) {
      if (!M.notStale(it, today)) row.hidden = '마감 미상 + 등록 60일 경과 → 목록에서 안 보임';
      rows.push(row);
      continue;
    }
    /* ① 근거 줄 */
    const src = sourceFor(it, idx);
    if (hasText(src)) {
      const l = evidenceLine(src.text, it.deadline);
      if (l) { row.evidence = l; row.evidenceIn = '본문'; }
    }
    if (!row.evidence) {
      for (const d of docsOf(it)) {
        const l = evidenceLine(d.text, it.deadline);
        if (l) { row.evidence = l; row.evidenceIn = d.file; break; }
      }
    }
    /* 본문·첨부에 없으면 제목(`~9/10`)과 화면 문구(사람이 적은 기간)에서 찾는다 — 그것도 근거다.
       출처 표식이 원문 문구를 달고 있으면(`공고문 이미지 2026-09-15 · 신청기간 '26. 9. 1. ~ 9. 18.`·
       `게시판 요약 · ~2026.9.18`) 그 문구가 근거다 — 세현이 2026-09-16 에 그렇게 남기기 시작했다. */
    const year = it.deadline.slice(0, 4);
    if (!row.evidence && /·/.test(row.from)) {
      const quoted = row.from.slice(row.from.indexOf('·') + 1).trim();
      if (quoted && (lastDateIn(quoted, year) === it.deadline || EX.extractDeadline(quoted) === it.deadline)) {
        row.evidence = quoted; row.evidenceIn = '출처 표식의 원문 문구';
      }
    }
    if (!row.evidence && titleEnd(it.name, year) === it.deadline) { row.evidence = it.name; row.evidenceIn = '제목'; }
    if (!row.evidence && lastDateIn(it.period, year) === it.deadline && !/원문\s*확인/.test(it.period)) {
      row.evidence = it.period; row.evidenceIn = '화면 문구';
    }
    /* ② 말이 되는가 */
    const dl = new Date(it.deadline + 'T00:00:00');
    const listed = it.listedAt ? new Date(it.listedAt + 'T00:00:00') : null;
    /* ⚠️ 등록일(listedAt)은 **로봇이 담은 날**이지 게시일이 아니다 — 게시판에 늦게 발견한 공고는
       담을 때 이미 끝나 있을 수 있다(사랑나눔: 게시 7/23 · 마감 7/30 · 등록 8/17). 의심이 아니라 참고다. */
    if (listed && dl < listed) row.info = `등록 당시 이미 지난 마감 (등록 ${it.listedAt})`;
    if (listed && (dl - listed) / 86400000 > 365) row.flags.push('등록일에서 1년 넘게 먼 마감');
    const pe = lastDateIn(it.period, year);
    if (pe && pe !== it.deadline) row.flags.push(`화면 문구의 끝 날짜(${pe})와 다름`);
    if (/첨부/.test(row.from) && row.evidenceIn && row.evidenceIn !== '본문') {
      const nm = (((eligDocs[it.id] || {}).names) || [])[0] || '';
      if (FORMISH_FILE.test(nm) || FORMISH_FILE.test(row.evidenceIn)) row.flags.push('첨부가 신청서 서식으로 보임');
    }
    if (!row.evidence && !human) row.flags.push(`근거를 못 찾음 — 본문·첨부·제목·문구 어디에도 ${it.deadline} 을 내는 줄이 없다${row.from ? ` (출처 표식 ${row.from})` : ' (출처 표식 없음)'}`);
    rows.push(row);
  }
  return rows;
}

if (!process.env.DEADLINE_AUDIT_AS_LIB) {
  const rows = auditDeadlines();
  const withDl = rows.filter((r) => r.deadline);
  const suspicious = rows.filter((r) => r.flags.length);
  const hidden = rows.filter((r) => r.hidden);
  const late = rows.filter((r) => r.info);
  const by = {};
  for (const r of withDl) {
    /* 첨부는 파일마다 이름이 달라(elig-…) 한 묶음으로 센다 — 안 그러면 '첨부 1' 이 네 번 찍힌다 */
    const k = !r.evidenceIn ? '(근거 없음)' : r.evidenceIn.startsWith('elig-') ? '첨부' : r.evidenceIn;
    by[k] = (by[k] || 0) + 1;
  }
  console.log(`■ 마감일 감사 — 등록 ${rows.length}건 · 마감 있음 ${withDl.length}건 · 근거 확인 ${withDl.filter((r) => r.evidence).length}건`);
  console.log(`   근거 자리: ${Object.entries(by).map(([k, n]) => `${k} ${n}`).join(' · ')}`);
  console.log(`   의심 ${suspicious.length}건 (아래) — 의심은 오류가 아니라 사람이 원문을 열어 볼 자리다\n`);
  for (const r of suspicious) {
    console.log(`  🔴 ${r.id} | ${String(r.name).slice(0, 44)}`);
    console.log(`     마감 ${r.deadline || '(없음)'} · 출처 ${r.from || '(표식 없음)'} · 등록 ${r.listedAt || '?'} · 문구 「${String(r.period).slice(0, 36)}」`);
    for (const f of r.flags) console.log(`     - ${f}`);
    if (r.evidence) console.log(`     근거(${r.evidenceIn}): ${r.evidence.slice(0, 100)}`);
  }
  console.log(`\n■ 참고 — 등록 당시 이미 지난 마감 ${late.length}건 (게시판에서 늦게 발견한 것 · 오류 아님)`);
  for (const r of late) console.log(`     ${r.id.padEnd(32)} 마감 ${r.deadline} · ${r.info}`);
  console.log(`\n■ 학생 눈에 안 보이는 공고 — 마감 미상 + 등록 60일 경과 ${hidden.length}건`);
  for (const r of hidden) console.log(`     ${r.id.padEnd(32)} 등록 ${r.listedAt} · 문구 「${String(r.period).slice(0, 40)}」`);
  if (ALL) {
    console.log('\n■ 전 공고의 근거 줄');
    for (const r of withDl) console.log(`  ${r.flags.length ? '🔴' : '  '} ${r.id.padEnd(32)} ${r.deadline} ${(r.from || '-').padEnd(8)} ${r.evidenceIn ? `[${r.evidenceIn}] ` : '[근거 없음] '}${(r.evidence || '').slice(0, 70)}`);
  }
}

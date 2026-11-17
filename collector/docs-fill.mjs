/* ============================================================
   제출 서류 채우기 로봇 — 자리표시뿐인 정식 등록분의 서류 칸을 원문에서 읽어 채운다 (2026-10-17 신설)
   ------------------------------------------------------------
   왜 — 자동 등록(auto-register.mjs)은 documents 에 `지원 자격·제출 서류는 원문 공고에서 확인` 한 줄만 두고 온다.
   화면은 그 자리표시를 서류로 치지 않아(app.js DOC_PLACEHOLDER) 「제출 서류」 칸이 비고, 2026-10-17 전수(진짜 크롬 214장)에서
   정식 등록 78장이 「제출 서류는 공고 원문에서 확인해 주세요」를 찍고 있었다 — 원문의 `4. 제출서류` 절에는 서류가 적혀 있는데.
   개발자 지시: *"원문에서 확인 이렇게 뜨는 게 하나도 없고 … 발췌 못하는 애들을 먼저 고쳐보자"*.

   하는 일 — 원문 본문(collector/extracted · 브라우저 본문 포함)에서 extract-excerpts extractDocuments 가 읽은 서류 이름을
   documents 에 넣고 documentsFrom 에 근거(로봇·날짜)를 남긴다. 사람이 적은 서류(자리표시가 아닌 줄이 하나라도 있는 항목)와
   관리자가 손댄 항목(documentsFrom 이 '관리자')은 건드리지 않는다. 원문이 없거나 서류 절이 없으면 그대로 둔다(지어내지 않는다).
   자리는 수집 워크플로의 데이터 관문 **앞**(scope-promote·kind-classify 와 같은 줄) — 관문이 결과를 본다.
   관문: verify/test-collector.mjs 「공고 카드 품질」 ⑮.
   ============================================================ */
import fs from 'node:fs';
import { isDocPlaceholder } from './extract-excerpts.mjs';
import { readDocuments, DOC_PLACEHOLDER_LINE, hasDocSection } from './doc-list.mjs';   // 🔴 서류 목록 규칙은 doc-list 한 곳(2026-11-15 리뷰 — 이 로봇만 옛 규칙 사본 extractDocuments 를 써서 고친 규칙이 74건에 안 닿았다)
import { indexTexts, sourceFor, hasText } from './notice-source.mjs';
import { DOC_JUNK } from './doc-list.mjs';

const HERE = new URL('.', import.meta.url);
const REG = new URL('../data/registered.json', HERE);
const reportArg = process.argv.slice(2).find((a) => !a.startsWith('--'));
const REPORT = new URL(reportArg || 'report.md', reportArg && reportArg.includes('/') ? new URL('../', HERE) : HERE);
const WRITE = !process.argv.includes('--dry');
const TODAY = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);

const readJson = (u, d) => { try { return JSON.parse(fs.readFileSync(u, 'utf8')); } catch { return d; } };

/** 채울 후보인가 — 서류 칸이 비었거나 자리표시뿐 · 사람이 손대지 않음(관리자 표식) */
export const needsDocs = (it) => !/^관리자/.test(it.documentsFrom || '') && (it.documents || []).every(isDocPlaceholder);
/** 한 벌의 등록분에 적용 — 순수 함수(관문이 픽스처로 돈다). 바뀐 항목 수와 리포트 줄을 돌려준다 */
export function fillDocuments(items, idx, today = TODAY) {
  let filled = 0; const lines = [];
  for (const it of items) {
    if (!needsDocs(it)) continue;
    const src = sourceFor(it, idx);
    if (!hasText(src)) continue;
    const docs = readDocuments(src.text).docs;
    if (!docs.length) continue;
    it.documents = docs;
    it.documentsFrom = `로봇 ${today} · 원문 「제출서류」 절`;
    filled += 1;
    lines.push(`- 📄 \`${it.id}\` ${(it.name || '').slice(0, 40)} — ${docs.length}건: ${docs.slice(0, 3).join(' · ')}${docs.length > 3 ? ' …' : ''}`);
  }
  return { filled, lines };
}

/** 이미 실린 서류 칸에서 서류가 아닌 줄(사이트 맨 아래 줄·안내문·유의사항 — doc-list.mjs DOC_JUNK 한 곳)을 걷는다 (2026-11-17 · 원칙 7 소급).
    로봇이 적은 칸(ROBOT_OWNED)만 — 관리자·AI·출처 표식 없는 사람의 칸은 건드리지 않는다. 다 걸러져 비면 자동 등록의 자리표시로 되돌린다 — 위 fillDocuments 가 같은 실행에서 새 규칙으로 다시 읽는다.
    순수 함수 — 바뀐 항목 수와 리포트 줄을 돌려준다 */
export { DOC_PLACEHOLDER_LINE };   // 글자는 doc-list.mjs 한 곳
export const ROBOT_OWNED = /^(공고 원문|공고문 첨부|로봇 )/;   // extract-excerpts.mjs(공고 원문·공고문 첨부…) · 이 파일 fillDocuments(로봇 날짜 · …)
export function scrubDocuments(items) {
  let scrubbed = 0; const lines = [];
  for (const it of items) {
    /* 🔴 로봇이 적은 칸만 — extract-excerpts fillDocuments 와 같은 소유 규칙(리뷰 2026-11-17): 관리자·AI 가 적은 칸, 출처 표식 없이 사람이 읽어 적은 옛 칸은 건드리지 않는다 */
    if (!ROBOT_OWNED.test(it.documentsFrom || '') || !Array.isArray(it.documents)) continue;
    const kept = it.documents.filter((d) => !DOC_JUNK.test(String(d)));
    if (kept.length === it.documents.length) continue;
    const dropped = it.documents.filter((d) => DOC_JUNK.test(String(d)));
    it.documents = kept.length ? kept : [DOC_PLACEHOLDER_LINE];
    if (!kept.length) delete it.documentsFrom;
    scrubbed += 1;
    lines.push(`- 🧹 \`${it.id}\` ${(it.name || '').slice(0, 40)} — 서류가 아닌 줄 ${dropped.length}개 걷음: ${dropped.slice(0, 2).map((d) => String(d).trim().slice(0, 30)).join(' · ')}`);
  }
  return { scrubbed, lines };
}

/** 이 로봇이 적은 목록(「로봇 날짜 · 원문 「제출서류」 절」)을 **제 출처로** 다시 읽는다 (2026-11-18 · 원칙 7 소급).
    서류 목록 규칙이 doc-list.mjs 한 곳으로 합쳐지며 바뀌었으니 옛 규칙(extractDocuments 사본)이 적은 74건을 같은 규칙으로 맞춘다.
    ① 원문에서 목록이 나오고 지금 것과 다르면 바꾼다(날짜 표식만 새로 · 같으면 안 건드린다 — 매일 바뀌지 않게)
    ② 원문을 실제로 읽었는데 목록이 없으면 자리표시로 되돌린다(옛 목록은 잡음이었다) · 원문이 없으면 그대로 둔다(못 읽은 날 지우지 않는다).
    extract-excerpts 는 이 목록을 지우지 않는다 — 그 로봇의 본문은 이 로봇의 출처(브라우저 본문 등)와 다를 수 있다. 순수 함수. */
export function refreshOwnDocuments(items, idx, today = TODAY) {
  let changed = 0, reset = 0; const lines = [];
  const norm = (a) => (a || []).map((d) => String(d).replace(/\s+/g, '')).join('|');
  for (const it of items) {
    if (!/^로봇 /.test(it.documentsFrom || '') || /^관리자/.test(it.documentsFrom || '')) continue;
    const src = sourceFor(it, idx);
    if (!hasText(src)) continue;
    const docs = readDocuments(src.text).docs;
    if (docs.length) {
      if (norm(docs) === norm(it.documents)) {
        if (JSON.stringify(docs) !== JSON.stringify(it.documents)) it.documents = docs;   // 빈칸만 다르면(띄어쓰기 다듬기) 글자만 맞춘다
        continue;
      }
      it.documents = docs; it.documentsFrom = `로봇 ${today} · 원문 「제출서류」 절`; changed += 1;
      lines.push(`- 🔁 \`${it.id}\` ${(it.name || '').slice(0, 40)} — 같은 규칙으로 다시 읽음: ${docs.slice(0, 3).join(' · ')}${docs.length > 3 ? ' …' : ''}`);
    } else if (hasDocSection(src.text)) {
      it.documents = [DOC_PLACEHOLDER_LINE]; delete it.documentsFrom; reset += 1;
      lines.push(`- ↩️ \`${it.id}\` ${(it.name || '').slice(0, 40)} — 원문에 서류 목록이 없어 자리표시로 되돌림`);
    }
  }
  return { changed, reset, lines };
}

/* ── 본편 — DOCS_FILL_AS_LIB 가 있으면 함수만(관문이 불러 쓴다 · activity-docs 와 같은 관례) ── */
if (!process.env.DOCS_FILL_AS_LIB) {
  const reg = readJson(REG, null);
  if (!reg || !Array.isArray(reg.items)) { console.log('docs-fill: data/registered.json 없음 — 건너뜀'); process.exit(0); }
  const idx = indexTexts(readJson(new URL('extracted/notices-text.json', HERE), []), readJson(new URL('extracted/browser-bodies.json', HERE), {}));
  const scrub = scrubDocuments(reg.items);   // 먼저 걷고(비면 자리표시로) → 같은 실행에서 새 규칙으로 다시 채운다
  const own = refreshOwnDocuments(reg.items, idx);   // 이 로봇이 적은 목록을 같은 규칙으로 다시(2026-11-18)
  const { filled, lines } = fillDocuments(reg.items, idx);
  lines.unshift(...scrub.lines, ...own.lines);
  if ((filled || scrub.scrubbed || own.changed || own.reset) && WRITE) {
    reg.updatedAt = TODAY;
    fs.writeFileSync(REG, JSON.stringify(reg, null, 1) + '\n');
  }
  const left = reg.items.filter(needsDocs).length;
  const head = `\n### 📄 제출 서류 채우기 (원문 「제출서류」 절) — ${filled}건 · 서류 아닌 줄 걷음 ${scrub.scrubbed}건 · 같은 규칙으로 다시 ${own.changed}건 · 되돌림 ${own.reset}건 · 아직 자리표시뿐 ${left}건`;
  const body = lines.length ? lines : ['- 이번 실행에서 원문에서 읽은 서류가 없었어요.'];
  if (WRITE && fs.existsSync(REPORT)) fs.appendFileSync(REPORT, ['', head, '원문 본문의 `제출서류·구비서류` 절 아래 서류 이름 줄만 담았어요(설명 문장·곁말·제출 방법은 뺌). 원문이 없거나 절이 없는 글은 그대로 둡니다.', ...body].join('\n') + '\n');
  console.log(`docs-fill: ${filled} filled · ${scrub.scrubbed} scrubbed · ${own.changed} refreshed · ${own.reset} reset · ${left} left` + (WRITE ? "" : " (dry)"));
}

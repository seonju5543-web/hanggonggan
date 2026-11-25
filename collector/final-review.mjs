/* ============================================================
   유료 최종 검토 (6번) — 둘째 AI 가 공고를 통째로 다시 읽고 카드·첨부 구분·변환 PDF 를 바로잡는다
   설계: docs/designs/paid-gate-pipeline.md (2026-11-20 지시 · 2026-11-21 개정)
   *"6.->두번째 API: 공고를 통째로 AI에게 읽게 하여 카드를 정확하게 함 (변환한 PDF가 원문 PDF가 같은지, 공고 카드 내용)
     빠진 내용 채워놓기 / 틀린 내용 없는지 확인 / 변환 완성도 / 첨부파일에서 신청양식은 신청양식으로 따로 분류, 설명은 공고카드로 추가"*

   🔴 2026-11-21 개발자 결정 — **기계 검사는 없다.** 4번(card-read)이 쓴 카드와 첨부 구분을 둘째 AI 가 원문과 대조해 **고친 완성본**을 내고, 로봇은 그것을 그대로 싣는다.
     ① 카드 — 틀린 줄은 고치거나 빼고 빠진 내용은 채운 완성본 → `data/card-read.json` 의 그 공고 칸을 통째로 바꾼다(무엇이 바뀌었는지는 changes 에 남긴다)
     ② 첨부 구분 — 4번의 구분(collector/attach-role-ai.json)을 다시 보고 낸 답 → `collector/final-review.json` 의 roles (이쪽이 이긴다 · collector/attach-role-ai.mjs loadAiRoles)
     ③ PDF 사본 — 앱이 보여 주는 사본(신청서 사본 · 공고문에서 뗀 서식 쪽 · 공고문 사본)을 **파일째** 보고 원본과 같은지·읽을 수 있는지 → pdfs.
        🔴 ok 가 아닌 사본은 그 자리에서 **앱에서 내린다**(collector/pdf-verdicts.mjs applyPdfVerdicts — 앱이 받는 색인에서 그 줄을 빼고 변환 로봇의 색인에 「다시 만들지 말 것」을 남긴다 ·
           파일은 여기서 안 지운다 — 색인에서 빠진 파일은 그 변환 로봇이 다음 실행에서 지운다 · 까닭은 pdf-verdicts 머리말).
           학생에게는 올린 원본 파일만 보인다 · 내린 것은 사람이 볼 것(problems)과 내린 기록(dropped — 까닭까지)에 적는다 — 개발자 *"문서 문제도 그냥 너가 잡아서"*
     그 첨부 구분(②)과 사본 판정(③)을 5번 변환 로봇이 다음 실행에 읽는다(attach-role-ai.mjs · 설계 「5번 연결」) — 신청 양식 / 내용 문서를 이 답으로 가르고, 붙은 문서는 PDF 둘로 낸다
   보는 것: 4번이 읽어 학생 화면에 오른 숨김 등록분(`paidGate`)과 관리자가 직접 등록한 공고(`paidRead`). 그 전 등록분은 보지 않는다(개발자 결정 「옛 공고는 냅둬」).
   언제: 유료 카드 읽기가 끝난 직후(카드) · 새벽 PDF 변환이 끝난 직후(사본) — 원문·카드·구분·사본이 그대로면 다시 보지 않는다(해시 장부).

   🔴 돈이 나가는 로봇 — 스위치 둘(final-review-config.json enabled + FINAL_REVIEW_ENABLE=1) · 실행당 상한 · 공고 하나에 보내는 PDF 쪽 수 상한(maxPdfPages).
   🔴 `data/registered.json` 을 고치지 않는다(card-read 와 같은 이유).
   실행: node collector/final-review.mjs [--write]   · FINAL_REVIEW_FAKE=<파일 {id: 응답}> 로 돈 없이(관문)
         node collector/final-review.mjs --activities [--only=<id>,<id>] [--write]   (대외활동·공모전 목록 · 2026-11-25 · 설계 docs/designs/paid-gate-activities.md 5-6)
            카드 쓰기와 같은 방식이다 — 파일 이름만 활동 것으로 바꿔 읽고 쓰고(collector/act-card.mjs ACT_FILES) 지시문만 활동용(ACT_REVIEW_SYSTEM).
            스위치는 셋(설정의 enabled · activities.enabled · 환경 변수 FINAL_REVIEW_ENABLE=1) · 상한은 activities 칸의 값 · `--only` 는 지정한 글만 본다(유료 시험 워크플로)
   ============================================================ */
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { makeSources, sourceText, sourceHash, norm, FIELD_LABEL, LIST_FIELDS, closedNow, CARD_RULES, SCHEMA as CARD_SCHEMA, cardEntry, rolesOf } from './card-read.mjs';
import { loadNoticeDocIndex } from './attachment-text.mjs';
import { pdfPages } from './attach-role-read.mjs';
import { ACT_FILES, ACT_SYSTEM, ACT_REVIEW_SYSTEM, actGateOn, actItems, makeActSources } from './act-card.mjs';
import { applyPdfVerdicts, loadPdfVerdicts } from './pdf-verdicts.mjs';   // ok 가 아닌 사본을 앱에서 내린다(변환 로봇을 불러오지 않는 파일 — 그 셋은 불러오는 순간 본편이 돈다)

const require = createRequire(import.meta.url);
const HERE = new URL('.', import.meta.url);
/* 대외활동·공모전 목록(`--activities` · 2026-11-25) — 카드 쓰기(card-read)와 같은 방식: 파일 이름만 활동 것으로 바꿔 읽고 쓴다(act-card ACT_FILES).
   아래 본편에 적힌 파일 이름은 장학금 것 그대로다 — 장학금 실행은 한 글자도 달라지지 않고, 두 목록은 서로의 파일을 건드릴 수 없다(관문 「대외활동 유료 관문 ③ 최종 검토」) */
const ACT = process.argv.includes('--activities');
const P = (rel) => fileURLToPath(new URL((ACT && ACT_FILES[rel]) || rel, HERE));
const readJson = (rel, d) => { try { return JSON.parse(fs.readFileSync(P(rel), 'utf8')); } catch { return d; } };
const log = (m) => console.log(`[final-review${ACT ? ' 활동' : ''}] ${m}`);

export const MODEL = 'claude-opus-5-5';
const PRICE = [4, 20];   // 달러 / 100만 토큰 (입력, 출력) — 2026-11 요금
export const MAX_PDF_BYTES = 4 * 1024 * 1024;   // 사본 하나의 크기 상한 — 넘으면 보내지 않는다(판정 없음)
export const MAX_PDF_PAGES_EACH = 12;           // 사본 하나의 쪽 수 상한
export const MAX_PDF_TOTAL_BYTES = 20 * 1024 * 1024;   // 공고 하나에 보내는 사본 크기의 합 상한(요청 하나가 너무 커지지 않게 — base64 로 실으면 1.33배)
export const PDF_VERDICTS = ['ok', 'broken', 'wrong', 'empty'];
const PDF_KIND = { form: '신청서 사본', pages: '공고문에서 뗀 서식 쪽', doc: '공고문·안내문 사본' };

export const SYSTEM = `한국 대학 장학금 공고의 최종 검토자입니다. 앞 단계의 AI 가 공고 원문을 읽고 학생 앱의 공고 카드를 썼고, 첨부를 내용 문서와 신청 양식으로 갈랐습니다. 그 결과가 맞는지 원문과 하나하나 대조해 **고친 완성본**을 냅니다. 내신 완성본이 그대로 학생 화면에 실립니다.

받는 것 넷 — ① 공고 원문(게시판 본문 + 첨부에서 뽑은 글자 · 첨부마다 꼬리표 [A1]·[A2]…) ② 지금 학생 화면의 카드(JSON) ③ 앞 단계가 한 첨부 구분 ④ 앱이 학생에게 보여 주는 PDF 사본(꼬리표 [P1]·[P2]… · 첨부 원본을 PDF 로 바꾼 것 — 파일로 함께 옵니다).

할 일.
1. 카드 고치기 — 카드의 모든 칸을 원문과 대조해 **완성본을 통째로** 다시 냅니다. 고칠 것이 없는 줄도 그대로 다시 내야 합니다(내지 않은 줄은 카드에서 지워집니다).
   - 틀린 내용 — 원문과 다른 숫자·날짜·조건, 원문에 없는 내용, 엉뚱한 칸에 들어간 줄 — 은 고치거나 뺍니다.
   - 빠진 내용 — 원문(본문·내용 문서)에 있는데 카드에 없는 자격·제외·금액·마감·접수 방법·서류·유의사항 — 은 채웁니다.
   - 맞는 줄은 말투만 바꾸려고 고치지 않습니다.
2. 첨부 구분 다시 보기 — 앞 단계의 구분이 맞는지 원문 글자로 확인하고, 첨부마다 다시 냅니다(틀렸으면 고쳐서 · 맞으면 그대로).
3. PDF 사본 보기(pdfs) — 파일로 온 사본마다 한 줄씩.
   - tag: 그 사본의 꼬리표(P1 처럼 대괄호 없이)
   - verdict: 넷 중 하나
      ok — 원본 첨부의 내용이 그대로 들어 있고 읽을 수 있다(글꼴·줄 간격이 조금 달라도 ok).
      broken — 변환이 잘못됐다: 글자가 깨졌거나(□·물음표·겹친 글자), 원본에 있는 내용이 빠졌거나, 표가 무너져 칸을 알아볼 수 없거나, 쪽이 잘렸다.
      wrong — 이 공고의 문서가 아니다. 「공고문에서 뗀 서식 쪽」 사본인데 학생이 채워 내는 서식이 아닌 쪽(읽는 글)이 들었거나 서식 쪽이 빠진 것도 wrong.
      empty — 읽을 내용이 없다(빈 쪽뿐·그림 하나뿐).
   - why: 그렇게 본 까닭을 한 문장으로(어느 쪽의 무엇이 문제인지).
   원본이 어느 첨부인지 적혀 있지 않은 사본은, 원문에서 내용이 같은 첨부를 찾아 그것과 대조합니다(없으면 사본 자체만 보고 판정). 파일로 오지 않은 사본은 내지 않습니다.
4. summary — 무엇을 고쳤는지 한두 문장으로(고친 것이 없으면 「고친 것 없음」).

카드와 첨부 구분의 규칙은 앞 단계와 같습니다.

${CARD_RULES}`;
const S = { type: 'string' };
/* 응답 = 고친 카드(4번과 같은 꼴 · 첨부 구분 포함) + PDF 판정 + 한 줄 요약 */
export const SCHEMA = {
  type: 'object', additionalProperties: false,
  required: [...CARD_SCHEMA.required, 'pdfs', 'summary'],
  properties: {
    ...CARD_SCHEMA.properties,
    pdfs: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['tag', 'verdict', 'why'], properties: { tag: S, verdict: { type: 'string', enum: PDF_VERDICTS }, why: S } } },
    summary: S,
  },
};

const clean = (v) => String(v || '').replace(/\s+/g, ' ').trim();
const fileSize = (f) => { try { return fs.statSync(f).size; } catch { return 0; } };
const filePages = (f) => { try { return pdfPages(fs.readFileSync(f)); } catch { return 0; } };

/* 앱이 보여 주는 PDF 사본 — 신청서 사본(forms-pdf) · 공고문에서 뗀 서식 쪽(form-pages) · 공고문 사본(docs-pdf). 꼬리표 [P1]… 를 붙이고,
   이름으로 원문의 첨부([A…])를 잇는다(이름을 아는 첨부만 — 못 이으면 AI 가 사본만 보고 판정한다). dataDir = 저장소의 data 폴더 */
export function pdfsOf(it, { formsPdf = {}, formPages = {}, docsPdf = {}, parts = [], dataDir, size = fileSize, pages = filePages }) {
  const byName = new Map((parts || []).filter((x) => x && x.tag && x.attach).map((x) => [x.attach, x.tag]));
  const byFile = new Map((parts || []).filter((x) => x && x.tag).map((x) => [x.file, x.tag]));
  const out = [];
  const add = (kind, dir, f, origName) => {
    if (!f || !f.file) return;
    const abs = `${dataDir}/${dir}/${f.file}`, bytes = size(abs);
    out.push({ tag: `P${out.length + 1}`, kind, file: `${dir}/${f.file}`, abs, name: f.name || '', orig: byName.get(origName) || byFile.get(origName) || null, bytes, pages: bytes ? (Number(f.pages) || pages(abs)) : 0,
      ...(f.cut ? { cut: f.cut } : {}) });   // cut — 붙은 문서라 읽는 글 쪽만 남긴 공고문 사본(doc-pdf cutRange)
  };
  for (const f of formsPdf[it.id] || []) add('form', 'forms-pdf', f, f && f.name);
  for (const f of formPages[it.id] || []) add('pages', 'form-pages', f, f && f.src);
  for (const f of docsPdf[it.id] || []) add('doc', 'docs-pdf', f, f && f.name);
  return out;
}
/* 모델에게 파일째 보낼 사본 고르기 — 차례대로(신청서 → 서식 쪽 → 공고문) 담되, 없는 파일·너무 큰 파일·쪽 수 합 상한을 넘는 것은 보내지 않는다(skip 에 까닭).
   들어온 줄은 고치지 않고 새 줄을 낸다 */
export function pickPdfs(pdfs, { maxPages = 24, maxBytes = MAX_PDF_BYTES, maxPagesEach = MAX_PDF_PAGES_EACH, maxTotalBytes = MAX_PDF_TOTAL_BYTES } = {}) {
  let used = 0, bytes = 0;
  return (pdfs || []).map((p) => {
    const skip = !p.bytes ? '파일이 없음' : p.bytes > maxBytes ? '파일이 큼' : !p.pages ? '쪽 수를 모름' : p.pages > maxPagesEach ? '쪽이 많음'
      : used + p.pages > maxPages ? '쪽 수 합 상한' : bytes + p.bytes > maxTotalBytes ? '크기 합 상한' : '';
    if (!skip) { used += p.pages; bytes += p.bytes; }
    return { ...p, sent: !skip, ...(skip ? { skip } : {}) };
  });
}
/* 🔴 앞선 검토가 ok 가 아니라고 본 사본(그 파일 · 그 크기)은 사본 목록에서 뺀다(리뷰 2026-11-23) — 세 색인은 병합 때 「내 것」(merge=ours)이라 새벽 변환과 같은 때 저장하면
   이 로봇이 내린 줄이 버려져 되살아난다. 빼지 않으면 「사본 목록이 바뀌었다」며 같은 공고를 돈 내고 또 본다 — 내린 것이 실렸든 버려졌든 목록(해시)이 같다.
   다시 만든 사본(크기가 다르다)은 새 사본이라 빼지 않는다 · judged = 그 공고의 앞선 판정 [{ file, bytes, verdict }] */
export const withoutJudged = (pdfs, judged) => {
  const bad = new Set((judged || []).filter((p) => p && p.verdict !== 'ok').map((p) => `${p.file}|${p.bytes}`));
  return (pdfs || []).filter((p) => !bad.has(`${p.file}|${p.bytes}`));
};
/* 같은 것을 다시 보지 않게 — 지시문 · 원문 · 카드(검토 도장 reviewedAt 빼고) · 4번의 구분 · 사본 목록(파일·크기 · 앞서 내린 사본은 빼고 — withoutJudged).
   🔴 원문은 4번과 같은 해시(sourceHash — 조회수 숫자를 뗀다)로 넣는다 (리뷰 2026-11-22) — 날것으로 넣으면 본문을 다시 받을 때마다 조회수만 바뀌어 같은 공고를 돈 내고 또 본다 */
/* system · cardSystem = 활동 목록이 제 검토 지시문과 제 카드 지시문을 넘긴다(act-card ACT_REVIEW_SYSTEM · ACT_SYSTEM) — 안 주면 장학금 것.
   활동 글의 해시가 장학금 지시문에 기대면 장학금 지시문을 고칠 때 활동 글까지 전부 다시 본다 */
export function reviewHash(source, entry, roles4, pdfs, system = SYSTEM, cardSystem) {
  const { reviewedAt, ...card } = entry || {};
  return crypto.createHash('sha256').update(system).update('\n').update(sourceHash(source, cardSystem)).update('\n')
    .update(JSON.stringify(card)).update(JSON.stringify((roles4 || []).map((d) => [d.file, d.hash, d.role, d.formStart || ''])))
    .update(JSON.stringify((pdfs || []).map((p) => [p.kind, p.file, p.bytes]))).digest('hex').slice(0, 16);
}
/* 카드가 어떻게 바뀌었나 — 줄 단위(공백·기호 꼴만 다른 줄은 같은 줄). 다듬은 줄은 뺀 줄 + 넣은 줄로 적힌다 */
export function diffCard(before, after) {
  const ch = [], b0 = before || {}, a0 = after || {};
  for (const k of LIST_FIELDS) {
    const b = Array.isArray(b0[k]) ? b0[k] : [], a = Array.isArray(a0[k]) ? a0[k] : [];
    const bn = new Set(b.map(norm)), an = new Set(a.map(norm));
    for (const l of a) if (!bn.has(norm(l))) ch.push({ field: k, label: FIELD_LABEL[k], kind: 'add', text: l });
    for (const l of b) if (!an.has(norm(l))) ch.push({ field: k, label: FIELD_LABEL[k], kind: 'remove', text: l });
  }
  const day = (e) => (e && e.deadline && e.deadline.date) || '';
  if (day(b0) !== day(a0)) ch.push({ field: 'deadline', label: FIELD_LABEL.deadline, kind: 'set', before: day(b0), after: day(a0) });
  for (const k of ['title', 'host']) if (norm(b0[k]) !== norm(a0[k])) ch.push({ field: k, label: FIELD_LABEL[k], kind: 'set', before: b0[k] || '', after: a0[k] || '' });
  return ch;
}
const ROLE_KO = { content: '내용 문서', form: '신청 양식', mixed: '내용 문서 + 신청 양식(붙은 문서)', other: '이 공고 문서 아님' };
/* 사본 문제의 사람 말 — down: 로봇이 그 사본을 앱에서 내렸다(pdf-verdicts applyPdfVerdicts · 학생에게는 올린 원본 파일만 보인다).
   내리지 못한 사본(그사이 다시 만들어져 색인 줄이 달라졌다)은 앱에 그대로 있다 — 그때는 「앱이 보여 주는 …」 으로 말한다 */
const DOWN_NOTE = ' 이 사본은 앱에서 내렸습니다 — 학생에게는 올린 원본 파일만 보입니다.';
const said = (p, why, down, what) => `${down ? '앱에 올렸던' : '앱이 보여 주는'} ${PDF_KIND[p.kind]} 「${p.name}」${what}${why ? ` — ${why}` : ''}.${down ? DOWN_NOTE : ''}`;
const PDF_PROBLEM = {
  broken: (p, why, down) => [said(p, why, down, '의 변환이 잘못됐습니다'), down ? '원본 첨부를 열어 확인해 주세요(원본이 바뀌거나 변환 방법을 고치면 로봇이 사본을 다시 만듭니다).' : '원본 첨부와 앱의 사본을 나란히 열어 확인해 주세요.'],
  wrong: (p, why, down) => [said(p, why, down, '이 이 공고의 문서(서식)가 아닙니다'), down ? '원본 첨부의 장학금 이름·기관·학년도와 쪽 내용을 확인해 주세요.' : '문서의 장학금 이름·기관·학년도와 쪽 내용을 확인해 주세요.'],
  empty: (p, why, down) => [said(p, why, down, '에 읽을 내용이 없습니다'), down ? '원본 첨부를 열어 내용이 있는 문서인지 확인해 주세요.' : '사본을 열어 내용이 있는 문서인지 확인해 주세요.'],
};
/* 사본 판정 한 줄(p = { kind, file, name, verdict, why }) → 사람이 볼 것 한 줄 */
const pdfProblem = (p, down = false) => { const [reason, check] = PDF_PROBLEM[p.verdict](p, p.why, down); return { kind: `pdf-${p.verdict}`, doc: p.name || p.file, reason, check }; };
/* 로봇이 실제로 내린 사본(applyPdfVerdicts 의 dropped)을 검토 결과에 적는다(순수 함수) —
   problems: 내린 사본의 줄을 「내렸습니다 · 학생에게는 원본 파일만」으로 바꾼다 · dropped: 내린 기록 [{ kind, name, verdict, why, at }] 을 지난 기록(before)에 이어 붙인다.
   🔴 지난 기록을 이어 붙이는 까닭 — 내린 사본은 다음 검토의 사본 목록에 없어 pdfs·problems 에서 사라진다(검토할 때마다 새로 쓴다). 내린 사실은 여기에만 남는다.
      같은 사본(갈래 + 이름)은 한 줄: 이번에 다시 판정한 사본의 옛 줄은 이번 판정이 대신한다(다시 만들어져 ok 가 됐으면 기록에서 빠진다) */
export function withDropped(a, down = [], before = [], today = '') {
  const gone = new Set((down || []).map((d) => d.file));
  const key = (x) => `${x.kind}|${x.name}`;
  const judged = new Set(a.pdfs.map(key));
  return {
    problems: [...a.problems.filter((x) => !String(x.kind).startsWith('pdf-')), ...a.pdfs.filter((p) => p.verdict !== 'ok').map((p) => pdfProblem(p, gone.has(p.file)))],
    dropped: [...(Array.isArray(before) ? before : []).filter((d) => d && !judged.has(key(d))),
      ...a.pdfs.filter((p) => gone.has(p.file)).map((p) => ({ kind: p.kind, name: p.name, verdict: p.verdict, why: p.why, at: today }))],
  };
}
/* 둘째 AI 의 응답을 받아 적용할 것을 낸다(순수 함수 · 파일을 안 건드린다) —
   entry: 실을 카드(응답이 읽을 내용 없음이면 앞 단계 카드 그대로) · changes: 바뀐 것 · roles: 첨부 구분(6번의 답) · pdfs: 사본 판정 · problems: 사람이 볼 것 */
/* 서식이 시작되는 줄(formStart)은 한 번 정해지면 그대로 둔다 (2026-11-22) — 둘째 AI 가 같은 줄을 볼 때마다 다른 말로 적으면, 그때마다 변환 로봇이 서식 쪽을 다시 떼고
   공고문을 다시 받아 자르고(색인 줄의 ai 표시가 달라진다), 그렇게 새로 생긴 사본을 제가 돈 내고 또 본다.
   앞선 답(지난 검토의 답 — 그 파일의 바이트가 그대로일 때 · 없으면 4번의 답)이 붙은 문서(mixed)이고 줄이 적혀 있고 이번 답도 붙은 문서면 **앞선 줄**을 싣는다.
   🔴 resplit — 이번 검토가 그 공고의 갈라낸 사본(공고문에서 뗀 서식 쪽 · 읽는 글 쪽만 남긴 공고문 사본)을 ok 가 아니라고 봤으면 새 줄을 싣는다(그 줄로 가른 자리가 틀렸다는 뜻이다) */
export function keepFormStart(roles, { roles4 = [], prevRoles = [], resplit = false } = {}) {
  if (resplit) return roles;
  return (roles || []).map((d) => {
    if (d.role !== 'mixed') return d;
    const earlier = (prevRoles || []).find((x) => x && x.file === d.file && x.hash === d.hash) || (roles4 || []).find((x) => x && x.file === d.file);
    return earlier && earlier.role === 'mixed' && earlier.formStart ? { ...d, formStart: earlier.formStart } : d;
  });
}
export function applyReview({ it, parts = [], entry, roles4 = [], prevRoles = [], out, pdfs = [], wonIn, today }) {
  const o = (out && typeof out === 'object') ? out : {};
  const changes = [], problems = [];
  const next = cardEntry(it, o, wonIn);
  let entryOut = entry;
  if (next) { entryOut = { ...next, hash: entry.hash, readAt: entry.readAt, reviewedAt: today }; changes.push(...diffCard(entry, next)); }
  else problems.push({ kind: 'unreadable', doc: '공고 카드', reason: '둘째 AI 가 이 공고의 원문에서 카드에 실을 내용을 찾지 못했습니다 — 카드는 앞 단계가 쓴 그대로 두었습니다.', check: '원문을 열어 공고 내용이 맞는지, 카드가 엉뚱한 글에서 나온 것이 아닌지 확인해 주세요.' });
  const byTag = new Map((pdfs || []).filter((p) => p && p.sent).map((p) => [p.tag, p]));
  const verdicts = [];
  let resplit = false;
  for (const v of Array.isArray(o.pdfs) ? o.pdfs : []) {
    const p = v && byTag.get(String(v.tag || '').replace(/[\[\]\s]/g, ''));
    if (!p || !PDF_VERDICTS.includes(v.verdict) || verdicts.some((x) => x.file === p.file)) continue;
    verdicts.push({ kind: p.kind, file: p.file, name: p.name, bytes: p.bytes, verdict: v.verdict, why: clean(v.why).slice(0, 200) });
    if (v.verdict !== 'ok') problems.push(pdfProblem(verdicts[verdicts.length - 1]));   // 내린 사본의 줄은 내린 뒤에 고쳐 쓴다(withDropped) — 이 함수는 파일을 안 건드린다
    if (v.verdict !== 'ok' && (p.kind === 'pages' || p.cut)) resplit = true;   // 갈라낸 사본이 틀렸다 — 서식이 시작되는 줄을 새 답으로(keepFormStart)
  }
  const roles = keepFormStart(rolesOf(parts, o), { roles4, prevRoles, resplit });
  const was = new Map((roles4 || []).map((d) => [d.file, d]));
  for (const d of roles) {   // 갈래가 바뀐 것만 적는다 — 서식이 시작되는 줄의 말만 다른 것은 고친 것이 아니다
    const b = was.get(d.file);
    if (b && b.role !== d.role) changes.push({ field: 'attachments', label: '첨부 구분', kind: 'role', text: d.attach || d.file, before: ROLE_KO[b.role] || b.role, after: ROLE_KO[d.role] || d.role, why: d.why });
  }
  return { entry: entryOut, changes, roles, pdfs: verdicts, problems, summary: clean(o.summary).slice(0, 300) };
}
/* 볼 공고 — 4번이 읽어 카드가 실린 숨김·직접 등록분. 마감은 **유료 마감·무료 마감 어느 쪽으로든 열려 있으면** 본다
   (4번 AI 가 마감을 지난 날짜로 잘못 읽은 공고도 여기서 바로잡혀야 한다 — 유료 마감만 보면 그 공고는 영영 「마감」으로 남는다) */
/* aiRead = 4번이 새 방식(AI 하나)으로 읽은 공고 표(카드 읽기 장부의 mode 'ai') — 개발자가 「공고 하나만 다시 읽기」로 옛 공고를 새 방식으로 읽혔으면 그 카드도 6번이 본다(안 보면 아무 검토 없는 카드가 남는다) */
export const reviewable = (items, cardRead, today, aiRead = {}) => items.filter((it) => (it.paidGate || it.paidRead || aiRead[it.id]) && cardRead[it.id]
  && (!closedNow(it, cardRead[it.id], today) || !closedNow(it, null, today)));
export const needsReview = (led, hash, giveUpAfter = 3) => !led || led.hash !== hash || !(led.done || (led.tries || 0) >= giveUpAfter);
/* 🔴 4번이 **이 원문을** 읽고 쓴 카드인가 (리뷰 2026-11-22) — 새벽에 첨부가 도착해 원문이 바뀌었으면 4번이 곧 다시 읽어 카드를 통째로 바꾼다.
   그 전에 옛 카드를 보면 그 검토는 버려지고(돈), 4번이 다시 읽은 뒤 또 본다. 카드의 hash 는 4번이 읽은 원문의 해시다(6번은 그 값을 안 바꾼다 · 조회수만 바뀐 원문은 같은 원문) */
export const readThisSource = (entry, source, cardSystem) => !!entry && entry.hash === sourceHash(source, cardSystem);   // cardSystem = 그 카드를 쓴 4번의 지시문(활동 목록은 ACT_SYSTEM · 안 주면 장학금 것)
/* 🔴 포기는 그날 하루만 (리뷰 2026-11-22) — 세 번 실패한 공고를 영영 안 보면 그 카드는 아무 검토 없이 남는다(4번에는 기계 검사가 없다).
   마지막 실패가 오늘이 아니면 다시 세 번까지 해 본다(한 공고에 하루 세 번이 상한) */
export const retryAgain = (led, hash, giveUpAfter, today) => !!led && led.hash === hash && !led.done && (led.tries || 0) >= giveUpAfter && led.failedAt !== today;

/* 모델에게 보낼 덩어리 — 글(원문 · 카드 · 4번의 구분 · 사본 목록) + 사본 파일들 */
export function reviewContent(it, { source, entry, roles4 = [], parts = [], pdfs = [], read = (f) => fs.readFileSync(f).toString('base64') }) {
  const { hash, readAt, reviewedAt, head, ...card } = entry || {};
  const tagOf = new Map((parts || []).filter((x) => x && x.tag).map((x) => [x.file, x.tag]));
  const roleLines = (roles4 || []).map((d) => `- [${tagOf.get(d.file) || '?'}] ${d.attach || d.file}: ${d.role}${d.formStart ? ` (서식이 시작되는 줄: ${d.formStart})` : ''} — ${d.why || ''}`);
  /* 붙은 문서의 공고문 사본은 읽는 글 쪽만 남긴 것이다(doc-pdf cutRange · cut) — 그렇게 일러 주지 않으면 「원본의 서식 쪽이 빠졌다」며 멀쩡한 사본을 변환 잘못으로 본다.
     🔴 그래도 서식 앞의 읽는 글 쪽은 전부 있어야 한다(리뷰 2026-11-23) — 자른 자리가 틀려 제출 서류·일정 쪽이 빠진 사본은 broken 이다(그래야 갈라낸 자리를 새 줄로 다시 가른다 · keepFormStart resplit) */
  const cutNote = (p) => (p.cut ? ` · 원본의 ${p.cut}(읽는 글)만 남긴 사본입니다 — 뒤의 신청 양식 쪽은 따로 떼어 냈으니 서식 쪽이 없는 것은 문제가 아닙니다. 다만 서식이 시작되기 전의 읽는 글 쪽(제출 서류·일정·접수 방법 같은 공고 쪽)이 하나라도 빠졌으면 broken 입니다` : '');
  const pdfLines = (pdfs || []).map((p) => `- [${p.tag}] ${PDF_KIND[p.kind]} 「${p.name}」 · ${p.orig ? `원본은 원문의 첨부 [${p.orig}]` : '원본이 어느 첨부인지 이름으로는 모름(원문에서 내용이 같은 첨부를 찾아 대조 · 없으면 사본만 보고 판정)'}${cutNote(p)}${p.sent ? '' : ` · 파일로 오지 않음(${p.skip}) — 판정하지 않습니다`}`);
  const text = [`공고 제목: ${it.name}`, `게시한 곳: ${(it.eligibility && it.eligibility.schoolOnly) || '(여러 곳)'}`, '',
    '########## ① 공고 원문 ##########', source, '',
    '########## ② 지금 학생 화면의 카드 ##########', JSON.stringify(card, null, 1), '',
    '########## ③ 앞 단계의 첨부 구분 ##########', roleLines.length ? roleLines.join('\n') : '(구분한 첨부 없음)', '',
    '########## ④ 앱이 보여 주는 PDF 사본 ##########', pdfLines.length ? pdfLines.join('\n') : '(사본 없음 — pdfs 는 빈 배열)'].join('\n');
  const blocks = [{ type: 'text', text }];
  for (const p of (pdfs || []).filter((x) => x.sent)) {
    blocks.push({ type: 'text', text: `[${p.tag}] ${PDF_KIND[p.kind]} 「${p.name}」 — 아래 파일` });
    blocks.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: read(p.abs) } });
  }
  return blocks;
}
export async function ask(client, content, effort, system = SYSTEM) {
  /* 카드 읽기(card-read ask)와 같은 꼴 — thinking 을 끄지 않는다 · 꼴은 output_config.format · 거절 대비 서버 쪽 대체 모델 */
  const stream = client.beta.messages.stream({
    model: MODEL, max_tokens: 24000, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default', system,
    output_config: { effort, format: { type: 'json_schema', schema: SCHEMA } },
    messages: [{ role: 'user', content }],
  });
  const msg = await stream.finalMessage();
  const u = msg.usage || {};
  const usd = ((u.input_tokens || 0) * PRICE[0] + (u.output_tokens || 0) * PRICE[1]) / 1e6;
  /* 🔴 실패한 호출도 돈이 나갔다 (리뷰 2026-11-22 · card-read ask 와 같은 규칙) — 오류에 쓴 돈(usd)을 실어 보낸다 */
  const fail = (m) => Object.assign(new Error(m), { usd });
  if (msg.stop_reason === 'refusal') throw fail('모델이 처리를 거절함');
  if (msg.stop_reason === 'max_tokens') throw fail('출력이 잘림');
  const text = (msg.content || []).find((b) => b.type === 'text');
  if (!text) throw fail('글자 응답이 없음');
  let out;
  try { out = JSON.parse(text.text); } catch { throw fail('응답이 JSON 이 아님'); }
  return { out, usd };
}

const ranDirectly = () => { try { return fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url)); } catch { return false; } };
if (process.argv[1] && ranDirectly()) {
  const WRITE = process.argv.includes('--write');
  const ONLY = (process.argv.find((a) => a.startsWith('--only=')) || '').slice(7).split(',').map((x) => x.trim()).filter(Boolean);   // 지정한 글만 본다(유료 시험 워크플로) — 없으면 빈 목록(전부)
  const SYS = ACT ? ACT_REVIEW_SYSTEM : SYSTEM, CARD_SYS = ACT ? ACT_SYSTEM : undefined;   // 활동 목록은 제 검토 지시문 · 그 카드를 쓴 4번의 지시문도 활동 것
  const TODAY = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
  /* 있는 파일이 깨져 있으면 멈춘다 — 빈 것으로 읽고 이어 가면 카드 파일을 빈 채로 덮거나 전부 다시 본다(돈) · 없는 파일만 기본값 */
  const strictJson = (rel, dflt) => { if (!fs.existsSync(P(rel))) return dflt; try { return JSON.parse(fs.readFileSync(P(rel), 'utf8')); } catch (e) { console.error(`[final-review] ${rel} 을 읽지 못했습니다(깨진 파일) — 멈춥니다: ${e.message}`); process.exit(1); } };
  /* maxMs 7분 — 단계 시한 12분 안에 진행 중인 한 건(PDF 를 읽어 오래 걸린다)까지 끝나게. 끊기면 돈만 나가고 결과가 없다 */
  const cfg = { enabled: false, maxPerRun: 15, maxUsdPerRun: 3, giveUpAfter: 3, effort: 'medium', maxMs: 7 * 60 * 1000, maxPdfPages: 24, ...readJson('final-review-config.json', {}) };
  /* 활동 목록 — 스위치는 위쪽 enabled 와 activities.enabled 둘 다(act-card actGateOn) · 상한은 activities 칸의 값(목록마다 따로 센다) */
  if (ACT) Object.assign(cfg, cfg.activities || {}, { enabled: actGateOn(cfg) });
  /* 등록 목록도 깨져 있으면 멈춘다 — 빈 목록으로 읽고 이어 가면 결과·장부가 「목록에서 빠진 공고」로 전부 지워진다 */
  const reg = strictJson('../data/registered.json', { items: [] });
  if (!Array.isArray(reg.items)) { console.error(`[final-review] ${ACT ? 'data/activities.json' : 'data/registered.json'} 에 items 목록이 없습니다 — 멈춥니다`); process.exit(1); }
  if (ACT) reg.items = actItems(reg.items);   // 활동 글을 로봇이 읽는 모양으로(id 없는 글은 빠진다 · 저장하지 않는다)
  const cr = strictJson('../data/card-read.json', { items: {} });
  if (!cr.items) cr.items = {};
  const ledger = strictJson('final-review-ledger.json', {});
  const result = strictJson('final-review.json', { items: {} });
  if (!result.items) result.items = {};
  const roles4 = readJson('attach-role-ai.json', { items: {} }).items || {};
  const docIdx = loadNoticeDocIndex(P('extracted'));
  const partsOf = ACT
    ? makeActSources({ storeDir: P('act-text'), formRows: docIdx.forms, extractedDir: P('extracted') })   // 활동 글의 원문 = 글자 기록 + 받아 둔 신청서 원본(카드 쓰기와 같은 덩어리 · 같은 열쇠)
    : makeSources({ texts: readJson('extracted/notices-text.json', {}), browserBodies: readJson('extracted/browser-bodies.json', {}), eligDocs: docIdx.elig, formRows: docIdx.forms, extractedDir: P('extracted') });
  /* 앱이 보여 주는 사본의 세 색인 — 사본을 내리면(아래) 다시 읽는다 */
  const loadPdfCtx = () => ({ formsPdf: readJson('../data/forms-pdf/index.json', { items: {} }).items || {}, formPages: readJson('../data/form-pages/index.json', { items: {} }).items || {},
    docsPdf: readJson('../data/docs-pdf/index.json', { items: {} }).items || {}, dataDir: P('../data') });
  let pdfCtx = loadPdfCtx();
  const { wonIn } = require('../parse-amount.js');
  /* 목록에서 빠진 공고는 결과·장부에서 뺀다(카드 읽기와 같은 규칙 — 등록 목록에 있는 동안은 남긴다 · 첨부 구분을 변환 로봇이 계속 읽는다) */
  const live = new Map(reg.items.map((it) => [it.id, it]));
  for (const id of Object.keys(result.items)) if (!live.get(id)) delete result.items[id];
  for (const id of Object.keys(ledger)) if (!live.get(id)) delete ledger[id];
  const writeAtomic = (rel, obj) => { const p = P(rel), tmp = `${p}.tmp`; fs.writeFileSync(tmp, `${JSON.stringify(obj, null, 1)}\n`); fs.renameSync(tmp, p); };
  let crDirty = false;   // 카드를 고쳤을 때만 유료 결과 파일을 다시 쓴다(카드 읽기 로봇과 같은 꼴 · JSON.stringify(x, null, 1))
  const save = () => { result.updatedAt = TODAY; if (crDirty) writeAtomic('../data/card-read.json', cr); writeAtomic('final-review.json', result); writeAtomic('final-review-ledger.json', ledger); };

  /* 원문·카드·구분·사본이 바뀌었으면 다시 본다(해시) */
  const crLedger = readJson('card-read-ledger.json', {});
  const aiRead = Object.fromEntries(Object.entries(crLedger).filter(([, l]) => l && l.mode === 'ai').map(([id]) => [id, true]));
  const targets = [];
  let stale = 0;
  for (const it of reviewable(reg.items, cr.items, TODAY, aiRead)) {
    if (ONLY.length && !ONLY.includes(it.id)) continue;   // 지정한 글만(유료 시험)
    if (ACT && it.hidden) continue;   // 관리자가 숨긴 활동 글은 학생이 못 본다 — 돈 내고 보지 않는다(카드는 그 글이 목록에 있는 동안 그대로 둔다)
    const parts = partsOf(it), source = sourceText(parts), r4 = ((roles4[it.id] || {}).docs) || [];
    if (!readThisSource(cr.items[it.id], source, CARD_SYS)) { stale += 1; continue; }   // 4번이 새 원문으로 다시 쓴 뒤에 본다(readThisSource)
    const pdfs = pickPdfs(withoutJudged(pdfsOf(it, { ...pdfCtx, parts }), (result.items[it.id] || {}).pdfs), { maxPages: cfg.maxPdfPages });   // 앞서 내린 사본은 다시 보내지도 해시에 넣지도 않는다
    const hash = reviewHash(source, cr.items[it.id], r4, pdfs, SYS, CARD_SYS);
    if (retryAgain(ledger[it.id], hash, cfg.giveUpAfter, TODAY)) ledger[it.id].tries = 0;
    if (needsReview(ledger[it.id], hash, cfg.giveUpAfter)) targets.push({ it, parts, source, r4, pdfs, hash });
  }
  if (stale) log(`4번이 다시 읽기를 기다리는 것 ${stale}건 (원문이 바뀌었다 — 카드 읽기가 새 원문으로 다시 쓴 뒤에 본다)`);
  const key = (t) => (cr.items[t.it.id].deadline && cr.items[t.it.id].deadline.date) || t.it.deadline || '9999';
  targets.sort((x, y) => (key(x) < key(y) ? -1 : key(x) > key(y) ? 1 : 0));
  log(`대상 ${targets.length}건 (4번이 읽어 학생 화면에 오른 숨김·직접 등록분 가운데 원문·카드·첨부 구분·PDF 사본이 바뀌어 아직 안 본 것)`);
  const fake = process.env.FINAL_REVIEW_FAKE ? JSON.parse(fs.readFileSync(process.env.FINAL_REVIEW_FAKE, 'utf8')) : null;
  const paidOn = cfg.enabled === true && process.env.FINAL_REVIEW_ENABLE === '1';
  if (!WRITE) { targets.slice(0, 30).forEach((t) => log(`  · ${t.it.id} · ${String(t.it.name).slice(0, 40)} · 사본 ${t.pdfs.length}개(보낼 것 ${t.pdfs.filter((p) => p.sent).length})`)); log('미리보기 — 부르지 않았습니다 (--write 로 반영)'); process.exit(0); }
  /* 🔴 앞선 검토들이 ok 가 아니라고 본 사본을 다시 내린다(색인만 · deleteFiles: false · 리뷰 2026-11-23) — 이 로봇이 새벽 변환보다 늦게 저장한 날은 내린 줄이 병합(merge=ours)에서 버려져
     학생에게 다시 보인다. 돈 0 · 스위치가 꺼져 있어도 · 두 번 적용해도 같다(이미 내린 것·다시 만든 사본은 안 건드린다). 넘어져도 검토는 잇는다(변환 로봇이 시작할 때 다시 내린다) */
  try { if (applyPdfVerdicts({ root: P('..'), verdicts: loadPdfVerdicts(P('..')), today: TODAY, deleteFiles: false }).dropped.length) pdfCtx = loadPdfCtx(); }
  catch (e) { log(`⚠ 앞서 내린 사본을 다시 내리지 못했습니다(${String((e && e.message) || e).slice(0, 120)}) — 변환 로봇이 다음 실행에 다시 내립니다`); }
  if (!fake && !paidOn) { save(); log(`유료 스위치가 꺼져 있어 부르지 않았습니다 (final-review-config.json ${ACT ? 'enabled 와 activities.enabled 둘 다' : 'enabled'}: ${cfg.enabled} · FINAL_REVIEW_ENABLE: ${process.env.FINAL_REVIEW_ENABLE || '없음'})`); process.exit(0); }
  let client = null;
  if (!fake) { const { default: Anthropic } = await import('@anthropic-ai/sdk'); client = new Anthropic(); }
  const t0 = Date.now();
  let usd = 0, done = 0, failed = 0, streak = 0, fixed = 0, stopped = '';
  try {
    for (const t of targets) {
      if (done + failed >= cfg.maxPerRun) { stopped = `한 실행 상한 ${cfg.maxPerRun}건`; break; }
      if (usd >= cfg.maxUsdPerRun) { stopped = `한 실행 예산 $${cfg.maxUsdPerRun}`; break; }
      if (Date.now() - t0 >= cfg.maxMs) { stopped = '시간 예산'; break; }
      if (streak >= 3) { stopped = '연달아 실패'; break; }   // 잔액 부족 같은 '전부 실패'가 상한까지 돈을 쓰며 돌지 않게
      if (fake && !fake[t.it.id]) continue;
      const led = ledger[t.it.id] = { ...(ledger[t.it.id] || {}), name: String(t.it.name).slice(0, 60) };
      if (led.hash !== t.hash) { led.hash = t.hash; led.tries = 0; led.done = false; }
      try {
        const entry = cr.items[t.it.id];
        const r = fake ? { out: fake[t.it.id], usd: 0 }
          : await ask(client, reviewContent(t.it, { source: t.source, entry, roles4: t.r4, parts: t.parts, pdfs: t.pdfs }), cfg.effort, SYS);
        usd += r.usd; led.usd = Math.round(((led.usd || 0) + r.usd) * 10000) / 10000;
        const a = applyReview({ it: t.it, parts: t.parts, entry, roles4: t.r4, prevRoles: (result.items[t.it.id] || {}).roles, out: r.out, pdfs: t.pdfs, wonIn, today: TODAY });
        if (a.entry !== entry) { cr.items[t.it.id] = a.entry; crDirty = true; }
        /* 🔴 ok 가 아닌 사본은 여기서 앱에서 내린다(2026-11-21 · pdf-verdicts) — 앱이 받는 색인에서 그 줄이 사라져 같은 커밋으로 학생 화면의 사본 줄이 없어지고 원본 파일만 남는다.
           🔴 색인만 고친다(deleteFiles: false · 2026-11-22) — 파일까지 지우면, 새벽 변환과 같은 때 저장해 색인 고침이 버려진 날(merge=ours) 「줄은 있는데 파일이 없는」 깨진 링크가 남는다.
              색인에서 빠진 파일은 그 변환 로봇이 다음 실행에서 지운다.
           내리다 넘어져도(색인을 못 썼다) 이 검토를 실패로 치지 않는다 — 돈을 쓴 결과다. 판정은 결과 파일(pdfs)에 남고 변환 로봇이 시작할 때 다시 내린다 */
        let down = [];
        try { down = applyPdfVerdicts({ root: P('..'), verdicts: a.pdfs.map((p) => ({ id: t.it.id, ...p })), today: TODAY, deleteFiles: false }).dropped; }
        catch (e) { log(`  ⚠ ${t.it.id} · 사본을 내리지 못했습니다(${String((e && e.message) || e).slice(0, 120)}) — 변환 로봇이 다음 실행에 다시 내립니다`); }
        if (down.length) pdfCtx = loadPdfCtx();
        /* 🔴 고친 뒤의 카드로 해시를 잡는다 — 안 그러면 제가 고친 카드 때문에 다음 실행이 같은 공고를 돈 내고 또 본다.
           🔴 사본 목록도 **내린 뒤의 것**으로 — 안 그러면 제가 내린 사본 때문에 「사본 목록이 바뀌었다」며 다음 실행이 같은 공고를 돈 내고 또 본다.
              이번에 ok 가 아니라고 본 사본도 뺀다(withoutJudged) — 내리지 못했거나 내린 것이 병합에서 버려져도 다음 실행의 목록(위 대상 고르기)과 같다 */
        const pdfsNow = withoutJudged(down.length ? pickPdfs(pdfsOf(t.it, { ...pdfCtx, parts: t.parts }), { maxPages: cfg.maxPdfPages }) : t.pdfs, a.pdfs);
        const hash = reviewHash(t.source, a.entry, t.r4, pdfsNow, SYS, CARD_SYS);
        led.hash = hash; led.done = true; led.at = TODAY; led.raw = r.out; delete led.error;
        /* 같은 4번 읽기(readAt·원문 해시가 그대로)를 다시 본 것이면 앞서 고친 기록을 이어 붙인다 — 사본만 다시 본 검토가 첫 검토의 기록을 지우지 않게 */
        const prev = result.items[t.it.id];
        const sameRead = prev && prev.readAt === entry.readAt && prev.cardHash === entry.hash;
        const seen = new Set();
        const changes = [...(sameRead ? prev.changes || [] : []), ...a.changes].filter((c) => { const k = JSON.stringify(c); if (seen.has(k)) return false; seen.add(k); return true; }).slice(-80);
        /* 내린 사본 — 사람이 볼 것의 그 줄을 「내렸습니다」로 바꾸고, 내린 기록(dropped)은 지난 검토의 것에 이어 붙인다(내린 사본은 다음 검토의 사본 목록에 없다) */
        const d = withDropped(a, down, prev && prev.dropped, TODAY);
        result.items[t.it.id] = { name: led.name, hash, at: TODAY, readAt: entry.readAt, cardHash: entry.hash, summary: a.summary, changes, roles: a.roles, pdfs: a.pdfs, problems: d.problems, ...(d.dropped.length ? { dropped: d.dropped } : {}) };
        done += 1; streak = 0; if (a.changes.length) fixed += 1;
        log(`  ✓ ${t.it.id} · ${String(t.it.name).slice(0, 30)} · 고친 것 ${a.changes.length}건 · 사본 ${a.pdfs.length}개(문제 ${a.pdfs.filter((p) => p.verdict !== 'ok').length} · 앱에서 내림 ${down.length}) · 사람이 볼 것 ${d.problems.length}건`);
      } catch (e) {
        const spent = Number(e && e.usd) || 0;   // 실패한 호출이 쓴 돈도 센다(ask 가 오류에 실어 보낸다)
        usd += spent; led.usd = Math.round(((led.usd || 0) + spent) * 10000) / 10000;
        failed += 1; streak += 1; led.tries = (led.tries || 0) + 1; led.failedAt = TODAY; led.error = String((e && e.message) || e).slice(0, 200);
        log(`  ✕ ${t.it.id} · ${led.error}`);
      }
      save();   // 건마다 저장 — 강제 종료돼도 돈을 쓴 결과를 잃지 않는다
    }
  } finally { save(); }
  log(`끝 — 검토 ${done}건(고친 공고 ${fixed}) · 실패 ${failed}건 · 쓴 돈 $${usd.toFixed(4)}${stopped ? ` · 멈춘 까닭: ${stopped}` : ''}`);
  if (failed) process.exit(1);
}

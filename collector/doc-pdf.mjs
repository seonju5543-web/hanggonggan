/* ============================================================
   공고문·안내문 원본 → PDF (첨부 문서 PDF 통일 · 2026-11-20 개발자 결정 · docs/designs/all-docs-pdf.md)
   ------------------------------------------------------------
   지시: *"한글이나 독스는 폰에서 바로 안열리니까 … 원본인 한글파일이나 독스는 그냥 맨 밑에 첨부파일에 원본 넣어놓고
          학생이 열 수 있는 공고들은 다 pdf 로"* — 앱은 PDF 줄을 위에, 올린 첨부 목록을 맨 밑에 그대로 둔다(app-live.js attachPdfRowsHtml).

   무엇을 — 마감 전 공고의 한글·워드(HWP·HWPX·DOC·DOCX) 첨부.
            · 층1 정식 등록·대외활동: 신청서(isApplicationForm — data.js 규칙)가 **아닌** 것만. 신청서는 form-pdf.mjs 몫이다(한 파일에 주인은 하나).
            · 층2 재단(data/kosaf-open.json): 전부. 층2는 form-pdf 가 안 본다. 원본은 저장소의 사본(data/kosaf-files/…)이다.
   어떻게 — 층1·활동은 첨부를 한 번 받아(임시 폴더) form-pdf 의 convertOne 으로 바꾸고 원본은 버린다(커밋 안 함).
            🔴 글자 대조(개발자 승인 11-20): 원본의 한글 음절·숫자가 PDF 에 KEEP_MIN 넘게 남았을 때만 사본을 둔다 — 학생은 원본 대신
               이 PDF 를 읽으므로 마감·자격 줄이 빠진 사본은 원본보다 나쁘다. 잴 수 없는 것(그림 문서·.doc·pdftotext 없음)은 사본을 두고 리포트에 센다.
   어디에 — data/docs-pdf/<공고 id>/<n>-<safeName(첨부 이름)>.pdf + data/docs-pdf/index.json
            { updatedAt, items: { <id>: [{ file, name, pages, bytes, fonts, kept, at }] }, tried: { "<id>|<첨부 이름>": { at, why } } }.
            🔴 registered.json 은 건드리지 않는다. 폴더를 form-pdf(data/forms-pdf)와 따로 둔다 — 그쪽 정리(prune)는 색인에 없는 폴더를 지운다.
   언제 — deep-fetch.yml 의 보강 단계(continue-on-error · 시한 · 경보 짝).

   🔴 한 번 바꾼 첨부는 다시 받지 않는다(같은 이름·파일·글꼴 도장이면 건너뜀) · 실패는 사흘 쉰다(같은 학교를 매일 두드리지 않는다).
   🔴 DOC_PDF_AS_LIB=1 이면 본편을 건너뛴다(관문이 함수만 부른다). DOC_PDF_ROOT 로 저장소를 바꿔 끼운다(관문 임시 폴더).
   실행: node collector/doc-pdf.mjs [--dry] [--today=YYYY-MM-DD]
   ============================================================ */
import { cleanAttachName } from './form-rules.mjs';

/* form-pdf.mjs 는 불러오는 순간 본편이 돈다 — 순수 함수만 쓰도록 표시를 먼저 세우고 동적으로 부른다(deepfetch 와 같은 길) */
process.env.FORM_PDF_AS_LIB = '1';
const FP = await import('./form-pdf.mjs');

export const OFFICE_DOC = /\.(hwp|hwpx|doc|docx)$/i;
export const KEEP_MIN = 0.98;        // 원본 글자 중 PDF 에 남아야 하는 몫(개수 기준) — 신청서 사본 51개 실측은 전부 1(11-20)
export const MIN_CHARS = 50;         // 이보다 원본 글자가 적으면 잴 수 없다(그림 문서) — 사본은 두고 리포트에 센다
export const REST_DAYS = 3;          // 받기·변환에 실패한 첨부는 사흘 쉰다
export const FETCH_TIMEOUT_MS = 30000;

/* 한 공고의 첨부 가운데 한글·워드인 것 — 본문 사진은 첨부가 아니다 · 아이콘 꼬리를 뗀 이름으로 한 번만 */
function officeAtts(atts, { skipForm = false, isApplicationForm = () => false } = {}) {
  const seen = new Set();
  const out = [];
  for (const a of atts || []) {
    if (!a || a.bodyImage) continue;
    const nm = cleanAttachName(a.name);
    if (!nm || seen.has(nm) || !OFFICE_DOC.test(nm)) continue;
    seen.add(nm);
    if (skipForm && isApplicationForm(a)) continue;   // form-pdf 와 같은 부름(원래 이름 그대로) — 두 로봇이 같은 첨부를 신청서라 부른다
    out.push(a);
  }
  return out;
}

/** 바꿀 대상 — [{ id, pageUrl, files: [{ name, url } | { name, src }] }] (층1·활동은 받을 주소 · 층2는 저장소 사본) */
export function pickDocTargets({ registered = [], activities = [], kosaf = [] } = {}, { today, isApplicationForm }) {
  const out = [];
  for (const it of [...registered, ...activities]) {
    if (!it || !it.id || it.program || it.hidden || !FP.isOpen(it, today)) continue;
    const files = officeAtts(it.attachments, { skipForm: true, isApplicationForm }).map((a) => ({ name: a.name, url: a.url || '' }));
    if (files.length) out.push({ id: it.id, pageUrl: it.sourceUrl || it.url || '', files });
  }
  for (const k of kosaf) {
    /* 층2는 due 가 마감 — 비어 있으면 모집 중일 수 있어 둔다(CLAUDE.md 「층2」) */
    if (!k || !k.code || !FP.isOpen({ deadline: k.due }, today)) continue;
    const files = officeAtts((k.files || []).map((f) => ({ name: f.name, path: f.path }))).map((a) => ({ name: a.name, src: a.path }));
    if (files.length) out.push({ id: `kosaf-${k.code}`, pageUrl: '', files });
  }
  return out;
}

/* 한글 음절·숫자의 개수 — 표 칸 차례·줄바꿈·띄어쓰기는 변환기마다 달라 보지 않는다 */
function tally(text) {
  const m = new Map();
  for (const ch of String(text || '').normalize('NFC')) if (/[가-힣0-9]/.test(ch)) m.set(ch, (m.get(ch) || 0) + 1);
  return m;
}
/** 원본 글자 중 PDF 에 남은 몫(0~1) — 원본 글자가 MIN_CHARS 보다 적으면 null(잴 수 없다) */
export function keptRatio(origText, pdfText) {
  const o = tally(origText);
  let n = 0;
  for (const c of o.values()) n += c;
  if (n < MIN_CHARS) return null;
  const p = tally(pdfText);
  let kept = 0;
  for (const [ch, c] of o) kept += Math.min(c, p.get(ch) || 0);
  return kept / n;
}

const dayDiff = (a, b) => Math.round((new Date(`${b}T00:00:00Z`) - new Date(`${a}T00:00:00Z`)) / 86400000);
/** 실패 장부(tried)에서 아직 쉬는 중인가 */
export function resting(tried, key, today, restDays = REST_DAYS) {
  const at = tried && tried[key] && tried[key].at;
  if (!at) return false;
  const d = dayDiff(at, today);
  return Number.isFinite(d) && d < restDays;
}

/* ============================================================
   자격용 공고문 첨부 받기(deepfetch.mjs --elig-attach)의 **순수 규칙** — 무엇을 받을지 · 파일 이름 표식
   (2026-10-04 로봇·도구 점검 bodies-3·bodies-5)

   왜 따로 있나 — deepfetch.mjs 는 불러오는 순간 수집을 시작해 관문이 부를 수 없다. 여기엔 부르는 순간 아무것도 하지 않는 함수만 둔다.

   고친 것:
     ① **이미 받은 그대로인 공고는 다시 받지 않는다.** 예전엔 자격을 못 읽은 공고를 등록 순서대로 앞에서 N건 골라 매 실행 다시 받았다 —
        그래서 앞의 몇 건(이미 받아 둔 것)이 자리를 다 차지해 뒤의 18건은 한 번도 안 받혔고(점검 bodies-3 · 한도 6 시절),
        다시 받을 때마다 파생 글자(.txt·.body.txt·.ocr.txt)까지 지워 OCR 결과가 발췌기에 닿기 전에 사라졌다(bodies-5).
        '받은 그대로'는 색인의 파일이 다 디스크에 있고, 고른 첨부 목록의 서명(sig)이 같은 것이다.
        서명 칸이 없는 옛 색인은 같은 것으로 보고 서명만 채운다(sigOnly · 다시 받지 않는다).
     ② 마감이 지났거나 학생 화면에서 내려간 공고는 받지 않는다 — 판정은 rescue-plan.mjs closedForStudents 한 곳(자격요건 로봇과 같다).
     ③ 차례: 한 번도 안 받은 것 → 첨부 목록이 바뀐 것(또는 파일이 사라진 것). 묶음 안은 등록 순서.
     ④ 받다가 하나도 못 받은 공고는 1·2·4·8·14일 쉬었다 다시 해 본다(tried — ocr-text.py 의 실패 쉼과 같은 꼴). 영구 포기는 없다.
   ⚠️ 색인(elig-docs.json)의 slug·files 칸은 여러 곳이 읽는다(extract-excerpts · extract-amounts · eligibility-ai · deadline-audit ·
      admin-apply) — 칸은 **더하기만** 한다(sig · at · tried).
   관문: verify/health-gates/bodies.mjs
   ============================================================ */
import crypto from 'node:crypto';
import { closedForStudents } from './rescue-plan.mjs';

/** 파일 이름에 넣는 공고별 표식. **양식 수집과 자격 수집이 같은 규칙을 써야** 한 공고의
    첨부가 두 벌로 쌓이지 않고, 다시 받을 때 옛 파일이 제대로 갈아끼워진다(deepfetch.mjs 가 불러 쓴다). */
export function slugOf(title) {
  let h = 0;
  for (let i = 0; i < title.length; i++) h = (h * 31 + title.charCodeAt(i)) >>> 0;
  return h.toString(36).slice(0, 6);
}

/** 고른 첨부 목록의 서명 — 이름·주소가 하나라도 바뀌면 달라진다 */
export function attSig(atts) {
  return crypto.createHash('sha1').update((atts || []).map((a) => `${a.name || ''}|${a.url || ''}`).join('\n')).digest('hex').slice(0, 12);
}

const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
/** 하나도 못 받은 뒤 쉬는 날 — 1·2·4·8·14 */
export const missWait = (miss) => Math.min(14, 2 ** Math.max(0, (miss || 1) - 1));

/** 이번 실행에 받을 공고.
    opts: today(한국 날짜) · now · fileExists(파일 이름) · requirementLines(공고) · pickAtts(공고 → 고른 첨부) · max
    → { targets: [{ it, atts, sig }], sigOnly: [{ id, sig }], kept } (kept = 받은 그대로라 건너뛴 수) */
export function pickEligDocTargets(items, index, { today, now = new Date(), fileExists, requirementLines, pickAtts, max = 30 }) {
  const fresh = [], changed = [], sigOnly = [];
  let kept = 0;
  for (const it of items || []) {
    if (it.program || requirementLines(it).length) continue;
    const atts = pickAtts(it);
    if (!atts.length) continue;
    if (closedForStudents(it, today, now)) continue;
    const sig = attSig(atts);
    const cur = (index || {})[it.id];
    const files = (cur && cur.files) || [];
    const have = files.length > 0 && files.every((f) => fileExists(f));
    if (have && cur.sig === sig) { kept += 1; continue; }
    if (have && !('sig' in cur)) { sigOnly.push({ id: it.id, sig }); kept += 1; continue; }   // 서명 칸 전의 옛 색인 — 같은 것으로 본다
    const tried = cur && cur.tried;
    if (tried && tried.sig === sig && daysBetween(tried.at, today) < missWait(tried.miss)) continue;
    (files.length ? changed : fresh).push({ it, atts, sig });
  }
  return { targets: [...fresh, ...changed].slice(0, max), sigOnly, kept };
}

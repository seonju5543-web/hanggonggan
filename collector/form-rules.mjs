/* ============================================================
   신청서 첨부 규칙 한 곳 (2026-11-15 · 금액·양식 카드 빈 칸)
   ------------------------------------------------------------
   순수 함수만 둔다 — 불러도 아무것도 실행되지 않는다(form-pdf·deepfetch·mark-fetched·card-coverage·관문이 같이 쓴다).
   · loadFormRules  — data.js 의 신청서 판정(isApplicationForm)을 **불러 쓴다**(베끼면 앱과 로봇이 다른 첨부를 신청서라 부른다)
   · attachExt      — 받은 첨부의 확장자: 아이콘 글자를 뗀 이름 → 없으면 파일 머리(바이트)
   · sameAttach     — 색인 줄의 첨부 이름과 공고 첨부 이름이 같은가(아이콘 꼬리를 뗀 이름으로)
   · markFetchedQueue — 양식 대기줄(pending-forms.json)에 '원본을 받았다'를 적고, 못 받은 날을 센다
   ============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { cleanAttachName } from './attachment-link.mjs';

export { cleanAttachName };

/* data.js 의 신청서 판정을 이름으로 떼어 온다 — data.js 는 브라우저 파일이라 통째로 못 불러온다 */
export function loadFormRules(root) {
  const src = fs.readFileSync(path.join(root, 'data.js'), 'utf8');
  const take = (name) => {
    const m = src.match(new RegExp(`^function ${name}\\([\\s\\S]*?^\\}`, 'm'));
    if (!m) throw new Error(`data.js 에서 ${name} 을 못 찾았습니다 — 가져올 수 없으면 멈춥니다`);
    return m[0];
  };
  const ctx = vm.createContext({});
  vm.runInContext(`${take('isFormAttachment')}\n${take('isApplicationForm')}`, ctx, { filename: 'data.js(발췌)' });
  return { isApplicationForm: vm.runInContext('isApplicationForm', ctx), isFormAttachment: vm.runInContext('isFormAttachment', ctx) };
}

/* 🔴 첨부 이름 끝의 아이콘 글자(`… .hwp chevron_forward` · 강원대 머티리얼 아이콘)는 떼고 본다 (2026-11-15 · 도전장학금 0xe0ymd).
   그 꼬리 때문에 `\.(hwp|…)$` 가 안 맞아 신청서 원본이 `form-mdklo3-1.bin` 으로 저장됐고, 양식 PDF 로봇은 이름이 달라 그 원본을 못 찾았다. */
const EXT_RE = /\.(hwp|hwpx|doc|docx|pdf|xls|xlsx|zip|png|jpe?g|gif|webp)$/i;
/** 첨부 확장자 — 이름(아이콘 글자를 뗀 것)이 먼저 · 이름에 없으면 받은 바이트의 머리로 · 둘 다 모르면 'bin'.
 *  ⚠️ OLE 꼴(D0CF11E0)은 hwp 와 doc 가 같아 이름 없이는 가르지 않는다(지어내지 않는다 · 'bin') */
export function attachExt(name, buf) {
  const m = cleanAttachName(name).match(EXT_RE);
  if (m) return m[1].toLowerCase();
  const b = buf && buf.length >= 4 ? buf : null;
  if (!b) return 'bin';
  const head = b.subarray(0, 8);
  if (head.subarray(0, 4).toString('latin1') === '%PDF') return 'pdf';
  if (head[0] === 0x89 && head.subarray(1, 4).toString('latin1') === 'PNG') return 'png';
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return 'jpg';
  if (head.subarray(0, 4).toString('latin1') === 'GIF8') return 'gif';
  return 'bin';
}

/** 색인 줄의 첨부 이름과 공고 첨부 이름이 같은가 — 아이콘 꼬리를 뗀 이름으로 */
export const sameAttach = (a, b) => cleanAttachName(a) === cleanAttachName(b);

/* ── 양식 대기줄 ─────────────────────────────────────────────
   🔴 '6회 시도'를 **하루 6번**으로 세고 있었다 (2026-11-15 · 경희 반영장학 323054 · 공과대 특성화 323410 · 가천 0mbofms · 동국 WISE 520869·520872).
      수집 워크플로가 하루에 여러 번 돌 때마다 시도를 하나씩 올려, 대기줄에 들어온 다음 날 이미 '6회 실패'로 내렸다(added 09-25 → retired 09-26).
      그 뒤 밀린 목록(deepfetch FORMS_BACKLOG)이 원본을 받아 색인에 id 를 달아 적었는데도, 내린 항목은 다시 보지 않아 '못 받음'으로 남았다.
   그래서 ① 시도는 **하루에 한 번만** 센다(lastTryAt 이 오늘이면 그대로) ② 내린 항목도 매번 색인을 다시 본다 — 받았으면 fetched 로 되돌린다
         ③ 색인 줄 다섯째 칸(id)이 그 공고 id 인 줄도 '받았다'로 본다(제목 글자가 달라도) ④ 옛 기록이 이틀 안에 내린 것(added~lastTryAt 이
         RETIRE_AT 일보다 짧은 것)은 하루 한 번 규칙으로 다시 세어 표적으로 돌린다. */
export const RETIRE_AT = 6;
const dayDiff = (a, b) => Math.round((new Date(`${b}T00:00:00Z`) - new Date(`${a}T00:00:00Z`)) / 86400000);
/** @param opts.isLive(id) — 다시 살릴 만한가(마감 전 등록 공고인가) · 없으면 모두 살린다. 받았다는 표시는 마감과 상관없이 적는다 */
export function markFetchedQueue(queue, indexText, today, { isLive = () => true } = {}) {
  const text = String(indexText || '');
  const ids = new Set(text.split('\n').map((l) => (l.split('\t')[4] || '').trim()).filter(Boolean));
  const got = (item) => ids.has(item.id) || (item.target && text.includes(String(item.target).trim()));
  const stat = { marked: 0, missed: 0, retired: 0, revived: 0 };
  for (const item of (queue && queue.items) || []) {
    if (item.fetched || !item.target) continue;
    if (got(item)) {
      if (item.retired) stat.revived += 1;
      item.fetched = true;
      delete item.tries; delete item.retired; delete item.retiredReason;
      stat.marked += 1;
      continue;
    }
    if (item.retired) {
      /* ④ 하루 한 번 규칙 전의 기록 — 내린 날까지 지난 날수가 RETIRE_AT 보다 짧으면 그날 수만큼만 센 것으로 되돌린다 */
      const span = item.added && item.lastTryAt ? dayDiff(item.added, item.lastTryAt) + 1 : RETIRE_AT;
      if (Number.isFinite(span) && span < RETIRE_AT && isLive(item.id)) {
        item.tries = Math.max(1, span);
        delete item.retired; delete item.retiredReason;
        stat.revived += 1;
      } else continue;
    }
    if (item.lastTryAt === today) continue;   // ① 오늘 이미 셌다
    item.tries = (item.tries || 0) + 1;
    item.lastTryAt = today;
    stat.missed += 1;
    if (item.tries >= RETIRE_AT) {
      item.retired = true;
      item.retiredReason = `${RETIRE_AT}일 동안 시도해도 원본을 못 받음 (공고가 수집 목록에서 사라진 것으로 보임). 다시 받으려면 retired를 지우세요.`;
      stat.retired += 1;
    }
  }
  return stat;
}

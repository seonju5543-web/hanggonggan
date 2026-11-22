/* ============================================================
   첨부 구분 — AI 가 정한 갈래를 읽는 한 곳 (2026-11-21 개발자 지시)
   *"3번에서 받은 첨부파일 중에서 내용 문서랑 신청 양식을 미리 1차로 구분해놓고(지능이 있는 ai 가) … 마지막에 6번 api 가
     구분된 내용양식이랑 신청양식을 보고 잘못 구분되어 있는데? 식으로"*

   쓰는 곳 둘: 4번 유료 카드 읽기(collector/card-read.mjs)가 카드를 쓰면서 첨부마다 갈래를 정해 `collector/attach-role-ai.json` 에,
              6번 최종 검토(collector/final-review.mjs)가 그 구분을 다시 보고 `collector/final-review.json` 의 roles 에(이쪽이 이긴다).
   읽는 곳: 6번 최종 검토(4번의 구분을 다시 본다) · 5번 변환 로봇 셋(설계 docs/designs/paid-gate-pipeline.md 「5번 연결」) —
            양식 PDF(form-pdf contentDecide — 받아 둔 파일로 aiRoleFor) · 서식 쪽 떼기(form-pages — 같은 길) · 공고문 PDF(doc-pdf — 첨부 이름과 받은 원본의 바이트로 aiRoleByName).
            AI 의 답이 있는 파일은 그 답이 갈래다(글자 표식·유료 첨부 판정·이름 규칙보다 먼저 · attachment-text attachDecision) · 답이 없는 파일은 예전 길 그대로.

   갈래: content(읽는 글 — 내용이 카드로) · form(학생이 채워 내는 서식) · mixed(한 파일에 둘 다 — formStart 줄부터 서식) · other(이 공고 문서가 아님·읽을 내용 없음)
   🔴 이 파일은 다른 로봇 파일을 불러오지 않는다 · attachment-text 는 이 파일을 불러오지 않는다(그 파일은 이웃을 pdf-text 하나만 부른다 — 관문) — 부르는 쪽이 찾은 갈래를 넘긴다
   🔴 같은 이름에 다른 바이트가 덮였으면 옛 답을 안 쓴다(hash) · 4번과 6번의 답을 **둘 다** 들고 있다가 그 파일의 바이트와 맞는 쪽을 쓴다(6번 먼저)
   ============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const AI_ROLES = ['content', 'form', 'mixed', 'other'];
export const fileHash16 = (f) => { try { return crypto.createHash('sha1').update(fs.readFileSync(f)).digest('hex').slice(0, 16); } catch { return ''; } };
/* attachDecision 이 쓰는 말로 — content 는 그쪽의 notice */
export const toDecisionRole = (role) => ({ content: 'notice', form: 'form', mixed: 'mixed', other: 'other' }[role] || null);

const readJson = (p, d) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return d; } };
/** 두 파일을 읽어 한 표로 — 6번(review)의 답이 4번(read)의 답 앞에 선다. collectorDir = 저장소의 collector 폴더
    🔴 4번의 답을 버리지 않는다(6번 줄의 read 칸에 남긴다 · 2026-11-22) — 파일을 다시 받아 바이트가 바뀐 뒤 4번만 다시 읽었으면, 옛 바이트를 본 6번의 답이
       새 답을 가려 그 파일은 「AI 답 없음」이 된다(aiRoleFor 가 바이트가 맞는 쪽을 고른다) */
export function loadAiRoles(collectorDir) {
  const read = readJson(path.join(collectorDir, 'attach-role-ai.json'), { items: {} }).items || {};
  const review = readJson(path.join(collectorDir, 'final-review.json'), { items: {} }).items || {};
  const out = {};
  const put = (id, docs, by) => {
    for (const d of Array.isArray(docs) ? docs : []) {
      if (!d || !AI_ROLES.includes(d.role) || !d.file) continue;
      const was = (out[id] ||= {})[d.file];
      out[id][d.file] = { ...d, by, ...(was && was.by === 'read' && by === 'review' ? { read: was } : {}) };
    }
  };
  for (const [id, e] of Object.entries(read)) put(id, e && e.docs, 'read');
  for (const [id, e] of Object.entries(review)) put(id, e && e.roles, 'review');
  return out;
}
/* 그 공고의 답 전부 — 파일마다 6번의 답, 바로 뒤에 4번의 답 */
const rowsOf = (roles, id) => Object.values((roles || {})[id] || {}).flatMap((d) => (d && d.read ? [d, d.read] : [d]));
/** 그 공고의 그 원본 파일(extracted/ 기준 이름)에 AI 가 정한 갈래 — 없거나 바이트가 달라졌으면 null. abs = 그 파일의 실제 경로(해시 대조용 · 없으면 대조 안 함)
    고르는 차례: 그 이름의 6번 답(바이트가 맞을 때) → 그 이름의 4번 답(바이트가 맞을 때) → 그 공고의 답 가운데 **바이트가 같은 다른 이름**의 답.
    마지막 길 — 카드 읽기(makeSources)는 바이트가 같은 사본을 한 번만 읽힌다: 답이 `form-…` 이름에 적혀 있고 자격 색인의 `elig-…` 사본에는 줄이 없다 */
export function aiRoleFor(roles, id, file, abs = null) {
  const d = ((roles || {})[id] || {})[file];
  if (!abs) return d || null;
  const hash = fileHash16(abs);
  const fits = (x) => !!x && (!x.hash || x.hash === hash);
  if (fits(d)) return d;
  if (d && fits(d.read)) return d.read;
  return (hash && rowsOf(roles, id).find((x) => x.hash === hash)) || null;
}
/** 첨부 **이름**으로 찾는다 — 공고문 PDF 로봇(doc-pdf)은 받아 둔 파일(extracted/)이 아니라 첨부 이름과 그때 받은 원본으로 일한다.
    hash(받은 원본의 fileHash16)를 주면 바이트가 같은 답만 쓴다: 그 이름의 답(6번 → 4번) → 이름을 모르는 답(자격 로봇이 받은 공고문류 — attach 없음)은 바이트로 찾는다.
    hash 가 없으면 이름만 본다(6번의 답 먼저) */
export function aiRoleByName(roles, id, attachName, hash = '') {
  const rows = rowsOf(roles, id);
  const named = rows.filter((d) => d.attach && d.attach === attachName);
  if (!hash) return named[0] || null;
  return named.find((d) => !d.hash || d.hash === hash) || rows.find((d) => d.hash === hash) || null;
}
/* 색인 줄에 적어 두는 「이 답으로 만들었다」 표시 — 답이 바뀌면(갈래·서식이 시작되는 줄) 변환 로봇이 다시 만든다 · 답이 없으면 빈 글자(예전 줄과 같다).
   🔴 서식이 시작되는 줄은 빈칸을 전부 걷고 견준다(2026-11-22) — 같은 줄을 띄어쓰기만 달리 적은 답에 다시 떼고 다시 받지 않게(쪽 찾기 formStartPage 도 빈칸을 걷고 찾는다 · 같은 쪽이 나온다) */
export const aiSig = (d) => (d && d.role ? `${d.role}|${String(d.formStart || '').replace(/\s+/g, '')}` : '');

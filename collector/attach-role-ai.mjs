/* ============================================================
   첨부 구분 — AI 가 정한 갈래를 읽는 한 곳 (2026-11-21 개발자 지시)
   *"3번에서 받은 첨부파일 중에서 내용 문서랑 신청 양식을 미리 1차로 구분해놓고(지능이 있는 ai 가) … 마지막에 6번 api 가
     구분된 내용양식이랑 신청양식을 보고 잘못 구분되어 있는데? 식으로"*

   쓰는 곳 둘: 4번 유료 카드 읽기(collector/card-read.mjs)가 카드를 쓰면서 첨부마다 갈래를 정해 `collector/attach-role-ai.json` 에,
              6번 최종 검토(collector/final-review.mjs)가 그 구분을 다시 보고 `collector/final-review.json` 의 roles 에(이쪽이 이긴다).
   읽는 곳: 6번 최종 검토(4번의 구분을 다시 본다). 변환 로봇(양식 PDF · 공고문 PDF · 서식 쪽 떼기)이 이 답으로 가르는 것은 설계 docs/designs/paid-gate-pipeline.md 「5번 연결」 — 아직 연결 전이다.

   갈래: content(읽는 글 — 내용이 카드로) · form(학생이 채워 내는 서식) · mixed(한 파일에 둘 다 — formStart 줄부터 서식) · other(이 공고 문서가 아님·읽을 내용 없음)
   🔴 이 파일은 다른 로봇 파일을 불러오지 않는다(attachment-text 가 이것을 불러 써도 돌려 물리지 않게) · 같은 이름에 다른 바이트가 덮였으면 옛 답을 안 쓴다(hash)
   ============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const AI_ROLES = ['content', 'form', 'mixed', 'other'];
export const fileHash16 = (f) => { try { return crypto.createHash('sha1').update(fs.readFileSync(f)).digest('hex').slice(0, 16); } catch { return ''; } };
/* attachDecision 이 쓰는 말로 — content 는 그쪽의 notice */
export const toDecisionRole = (role) => ({ content: 'notice', form: 'form', mixed: 'mixed', other: 'other' }[role] || null);

const readJson = (p, d) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return d; } };
/** 두 파일을 읽어 한 표로 — 6번(review)의 답이 4번(read)의 답을 덮는다. collectorDir = 저장소의 collector 폴더 */
export function loadAiRoles(collectorDir) {
  const read = readJson(path.join(collectorDir, 'attach-role-ai.json'), { items: {} }).items || {};
  const review = readJson(path.join(collectorDir, 'final-review.json'), { items: {} }).items || {};
  const out = {};
  const put = (id, docs, by) => {
    for (const d of Array.isArray(docs) ? docs : []) {
      if (!d || !AI_ROLES.includes(d.role) || !d.file) continue;
      (out[id] ||= {})[d.file] = { ...d, by };
    }
  };
  for (const [id, e] of Object.entries(read)) put(id, e && e.docs, 'read');
  for (const [id, e] of Object.entries(review)) put(id, e && e.roles, 'review');
  return out;
}
/** 그 공고의 그 원본 파일(extracted/ 기준 이름)에 AI 가 정한 갈래 — 없거나 바이트가 달라졌으면 null. abs = 그 파일의 실제 경로(해시 대조용 · 없으면 대조 안 함) */
export function aiRoleFor(roles, id, file, abs = null) {
  const d = ((roles || {})[id] || {})[file];
  if (!d) return null;
  if (abs && d.hash && d.hash !== fileHash16(abs)) return null;
  return d;
}

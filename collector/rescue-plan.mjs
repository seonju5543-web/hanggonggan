/* ============================================================
   자격요건 로봇(rescue-bodies.mjs)의 **순수 규칙** — 대상 거르기 · 차례 · 장부 한 칸 · 첨부 합치기
   (2026-10-04 로봇·도구 점검 bodies-1·bodies-4)

   왜 따로 있나 — rescue-bodies.mjs 는 불러오는 순간 registered.json 을 읽고 브라우저를 띄운다(미리보기면 process.exit).
   관문이 그 파일을 부를 수 없어 규칙을 시험할 길이 없었다. 여기에는 부르는 순간 아무것도 하지 않는 함수만 둔다
   (playwright 도 안 들인다). 페이지를 여는 일은 rescue-bodies.mjs 에 그대로 있다.

   이번에 더한 규칙 (bodies-4 · run #53·#54·#55 실측 — 같은 세 건이 매 실행 맨 앞 세 자리를 차지했다):
     ① 본문을 이레 안에 확보한 공고는 다시 안 연다 — 본문은 있는데 자격 절만 없는 공고는 발췌기·AI 의 몫이다.
        (예전엔 성공하면 장부 칸을 지워 tries 가 0 으로 돌아가, 다음 실행에 또 맨 앞에 왔다)
     ② 마감이 지났거나 학생 화면에서 내려간 공고(match-engine notStale)는 열지 않는다 — 학생이 못 보는 공고다.
     ③ 차례: 덜 해 본 것부터 · 같으면 한 번도 본문을 못 받은 것 먼저 · 그다음 등록 순서.
   관문: verify/health-gates/bodies.mjs
   ============================================================ */
import { createRequire } from 'node:module';

const { notStale } = createRequire(import.meta.url)('../match-engine.js');

/** 본문을 확보한 뒤 다시 안 여는 날 수 */
export const OK_REST_DAYS = 7;

const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);

/** 장부에 '이레 안에 본문 확보' 기록이 있는가 */
export function restingAfterOk(led, today) {
  return !!(led && led.ok && daysBetween(led.ok, today) < OK_REST_DAYS);
}

/** 학생 화면에 더는 안 나오는 공고인가 — 마감(한국 날짜)이 오늘 전 · 또는 마감도 없이 오래된 공고(notStale 거짓).
    마감도 등록일도 없으면 notStale 이 참이라 대상에 남는다. */
export function closedForStudents(it, today, now = new Date()) {
  const d = String((it && it.deadline) || '');
  if (/^\d{4}-\d{2}-\d{2}$/.test(d) && d < today) return true;
  return !notStale(it, now);
}

/** 차례 — [{ tries, everOk, … }] 를 새 배열로. 같은 값끼리는 들어온 차례(등록 순서) 그대로 */
export function orderTargets(list) {
  return (list || []).map((t, i) => ({ t, i }))
    .sort((a, b) => (a.t.tries - b.t.tries) || ((a.t.everOk ? 1 : 0) - (b.t.everOk ? 1 : 0)) || (a.i - b.i))
    .map((x) => x.t);
}

/** 장부 한 칸 — 결과(outcome)마다 무엇을 남기나.
    ok   : 본문 확보 — 날짜를 남긴다(이레 쉼 · 지우면 다음 실행에 또 맨 앞에 온다)
    hung : 한 공고 시한(PAGE_MS) 안에 안 끝남 — 실패로 한 번 센다 · 표식 hung
    miss : 열었는데 본문이 없음 — 실패로 한 번 센다
    gone : 게시판에서 내려간 공고 — 바로 쉼(REST_AFTER 만큼 센 것으로)
    어떤 문턱으로 판정했는지(minBody)는 실패 칸에 남긴다 — 문턱이 내려가면 쉬는 중이라도 다시 해 본다(staleJudgment).
    마지막 확보 날짜(ok)는 실패 칸에도 이어 둔다(차례의 '한 번도 못 받은 것 먼저'에 쓴다). */
export function ledgerEntry(prev, outcome, { today, minBody, name, restAfter = 3 }) {
  const p = prev || {};
  const keepOk = p.ok ? { ok: p.ok } : {};
  if (outcome === 'ok') return { ok: today, at: today, tries: 0, name };
  if (outcome === 'gone') return { tries: restAfter, at: today, minBody, gone: true, name, ...keepOk };
  if (outcome === 'hung') return { tries: (p.tries || 0) + 1, at: today, minBody, hung: true, name, ...keepOk };
  return { tries: (p.tries || 0) + 1, at: today, minBody, name, ...keepOk };
}

/* 첨부 이름 비교 — 앞 번호(`1. `)와 `미리보기` 꼬리를 뗀다. 안 떼면 `1. ○○.hwp` 와 `○○.hwp` 가 다른 첨부로 보여
   같은 파일이 두 번 쌓인다(2026-08-23 실측) */
const normName = (n) => String(n || '').replace(/\s*미리보기\s*$/, '').replace(/^\d+\.\s*/, '').trim();

/** 페이지에서 찾은 첨부 중 아직 기록에 없는 것만 */
export function newAttachments(have, found) {
  const had = new Set((have || []).map((a) => normName(a.name)));
  const out = [];
  for (const a of found || []) {
    const k = normName(a.name);
    if (had.has(k)) continue;
    had.add(k);
    out.push(a);
  }
  return out;
}

/* ============================================================================
   접수 대행 — 보내기 전에 서버가 다시 본다 (2026-09-25 · 기술 고문 보고서 Q4)

   왜 만들었나 — 지금 `server/mail-worker.js` 는 **클라이언트가 준 `to`·`subject`·`text`
   를 그대로 발송**한다. 자격 검증이 한 줄도 없고 받는 주소도 클라이언트가 고른다
   (도메인 허용목록만 있다). 고문의 지적 그대로다:

     "조작된 프로필 데이터를 가진 학생이 기기에서 값을 변조하면, 검증 없이 그대로
      학교·재단에 접수 메일이 발송된다. 제출 대행을 시작하기 전, 최종 제출 내용을
      서버로 보내어 자격 요건을 백엔드에서 1회 재검증하는 로직을 반드시 추가."

   🔴 **지금은 아직 안 터진다** — 앱의 메일 버튼은 `mailto:` 라 학생 폰의 메일 앱이 열리고
      학생이 제 손으로 보낸다. 우리가 중계하는 것이 아니다. 이 파일이 막는 것은
      **Resend 자동 발송을 켜는 순간** 우리가 보내는 주체가 되는 그때다.

   🔴 **판정을 여기서 새로 만들지 않는다.** 앱과 같은 `match-engine.js` 를 불러 쓴다
      (`server/essay/draft-guard.mjs` 가 `essay-quality.js` 를 불러 쓰는 것과 같은 방식).
      여기에 규칙을 한 벌 더 두면 화면은 '적합'이라는데 서버는 막는 일이 생긴다.

   🔴 **받는 주소를 클라이언트에게서 받지 않는다.** 공고 id 로 우리 발행물에서 찾아 쓴다.
      이것이 이 파일에서 가장 값싸고 가장 크게 막는 구멍이다 — 그러지 않으면 변조된
      클라이언트가 **아무 `.ac.kr` 주소로나** 우리 이름으로 메일을 보낼 수 있다.

   🔴 **막는 쪽으로 닫힌다(fail-closed).** 공고를 못 찾거나·접수 주소가 없거나·마감이
      지났거나·자격이 미달이면 **안 보낸다.** 판단이 안 서면 보내지 않는 쪽이다.
   ========================================================================== */
import { createRequire as _cr } from 'node:module';
const ME = _cr(import.meta.url)('../../match-engine.js');

/** 자격 판정이 '보내도 된다'로 인정하는 값. 🔴 `unknown` 은 넣지 않는다 —
 *  우리가 자격을 못 읽은 공고까지 대신 보내면 앱이 확인해 준 척이 된다. */
export const SENDABLE = new Set(['eligible', 'selective']);

/** 오늘(KST 날짜)로 마감을 본다. 🔴 `dday()` 를 베끼지 않는다 — 여기서 필요한 것은
 *  라벨이 아니라 '지났는가' 하나뿐이고, 날짜끼리 비교해야 마감 당일이 살아 있다. */
export function deadlinePassed(deadline, now) {
  if (!deadline) return false;                       // 못 읽은 마감으로 막지 않는다(다른 줄이 막는다)
  const kst = new Date((now ? now.getTime() : Date.now()) + 9 * 3600 * 1000);
  const today = kst.toISOString().slice(0, 10);      // KST 기준 YYYY-MM-DD
  return String(deadline) < today;
}

/** 발행물에서 그 공고를 찾는다. 목록 모양이 둘(`{items:[]}` · `[]`)이라 여기서 맞춘다. */
export function findNotice(registered, id) {
  const list = (registered && registered.items) || registered || [];
  return list.find((x) => x && x.id === id) || null;
}

/**
 * 보내도 되는가 — 보낼 주소까지 **여기서** 정해 돌려준다.
 * @param {{noticeId:string, profile:object}} payload  클라이언트가 보낸 것
 * @param {object} registered                          우리 발행물(data/registered.json)
 * @param {Date}   [now]
 * @returns {{ok:boolean, to?:string, notice?:object, why?:string}}
 */
export function validateSubmission(payload, registered, now) {
  const id = payload && payload.noticeId;
  if (!id || typeof id !== 'string') return { ok: false, why: '공고를 지정하지 않았습니다' };

  const notice = findNotice(registered, id);
  if (!notice) return { ok: false, why: '우리가 아는 공고가 아닙니다' };

  /* 🔴 주소는 **공고에서** 온다. payload 의 to 는 쳐다보지 않는다. */
  const to = String(notice.applyEmail || '').trim();
  if (!to) return { ok: false, why: '이 공고는 메일 접수처가 확인되지 않았습니다' };

  /* 근거 문장이 없는 주소는 로봇이 넣은 것이 아니다 — 등록 규칙과 같은 기준으로 한 번 더 본다. */
  if (!String(notice.applyEmailSource || '').includes(to)) {
    return { ok: false, why: '접수 주소의 근거 문장이 없습니다' };
  }

  if (deadlinePassed(notice.deadline, now)) return { ok: false, why: '접수가 마감된 공고입니다' };

  const p = payload && payload.profile;
  if (!p || typeof p !== 'object') return { ok: false, why: '프로필이 없습니다' };

  /* 🔴 학교 한정 공고를 남의 학교 학생이 내지 못하게 — 앱과 같은 함수로 본다. */
  if (!ME.scopedToProfile([notice], p).length) {
    return { ok: false, why: '이 공고를 낼 수 있는 학교·캠퍼스가 아닙니다' };
  }

  const r = ME.evaluate(notice, p) || {};
  if (!SENDABLE.has(r.status)) {
    return { ok: false, why: '지원 자격을 충족하지 않습니다', status: r.status, reasons: r.reasons };
  }
  return { ok: true, to, notice };
}

/* 링크 사냥꾼의 장부 규칙 — 시도 기록 · 사람에게 알릴 때 · '게시판에서 내려간 듯' (2026-10-04 · 순수 함수만)
   ─────────────────────────────────────────────────────────────────────────────
   link-hunter.mjs 는 불러오는 순간 브라우저를 띄우므로 관문이 그 안의 규칙을 실제로 돌려 볼 수 없었다.
   그래서 장부를 고치는 규칙만 여기로 떼어 냈다(사냥꾼이 부르고 관문이 같은 함수를 가짜 장부로 돌린다).

   이번에 바로잡은 것 (이슈 #387 · 2026-10-03 거짓 알림):
     ① 사람에게 알리는 건(stuck)은 **3단계(다른 게시판·사이트 검색)까지 실패한 뒤에만** 센다.
        예전엔 1단계에서 세 번째 실패를 적는 순간 셌다 — 그날 3단계가 바로 찾아낸 공고 하나 때문에 이슈가 열렸다.
     ② '목록에서 못 찾음'이 쌓여도 **목록을 끝까지 본 게 아니면** '게시판에서 내려간 듯(likelyGone)'으로 적지 않는다.
        정해 둔 쪽수(maxPages)·시간 상한에서 멈춘 것은 글이 더 뒤에 있을 수 있다는 뜻이다(경희 7월 글 3건 · 가천 전체공지 —
        읽은 쪽 너머에 멀쩡히 있었다). 예전에 그렇게 붙은 표식도 다음 '못 찾음'에서 걷어 낸다. */

export const ESCALATE_AT = 3;                       // 이 횟수에서 사람에게 알린다 (중단이 아니다)
export const BACKOFF_DAYS = [0, 1, 1, 3, 7, 14, 30]; // 실패 n회 뒤 며칠 있다 다시 볼지 (마지막 값이 상한)

/* 목록을 어디서 멈췄나 → 'end'(마지막 쪽까지 봤다) · 'deep'(더 있을 수 있다).
   stop: 'no-next'(다음 쪽 번호가 화면에 없다) · 'max-pages'(정해 둔 쪽수를 다 봤다) · 'out-of-time' · 'no-rows'(넘긴 쪽이 비었다 — 못 읽은 것)
   nextControl: 화면에 '다음'·'›'·'»' 같은 다음 묶음 단추가 있었나 — 쪽 번호가 10개씩 묶인 게시판은 11쪽 번호가 안 보여도 끝이 아니다. */
export function listScanEnd({ stop, nextControl = false } = {}) {
  return stop === 'no-next' && !nextControl ? 'end' : 'deep';
}

/* 시도 하나를 장부 줄(st)에 적는다 — 고친 st 를 돌려준다(넘겨받은 것을 그대로 고친다).
   outcome: 'ok'(찾음) · 'net'(학교 서버에 못 닿음 — 횟수에 안 센다) · 'bad'(닿았는데 못 찾음)
   opts: { today: 'YYYY-MM-DD', nowMs, url(찾은 주소), scan('end'|'deep' — '목록에서 못 찾음'일 때 목록을 끝까지 봤나) } */
export function recordAttempt(st, outcome, why, opts = {}) {
  const s = st || { attempts: 0 };
  const today = opts.today || new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
  s.lastTried = today;
  s.lastWhy = why || '';
  if (outcome === 'ok') {
    s.status = 'resolved'; s.resolvedUrl = opts.url || s.resolvedUrl; s.attempts = 0;
    delete s.escalated; delete s.likelyGone;          // 다시 표식이 되면 처음부터 센다
    return s;
  }
  if (outcome === 'net') return s;                    // 못 읽음은 횟수에 안 센다
  s.attempts = (s.attempts || 0) + 1;
  if (s.attempts === 1) delete s.escalated;           // 예전 회차의 알림 표식이 남아 새 묶음을 가리지 않게
  // 다음에 언제 다시 볼지 — 실패가 쌓일수록 간격을 늘린다 (그래도 계속 본다)
  const wait = BACKOFF_DAYS[Math.min(s.attempts, BACKOFF_DAYS.length - 1)];
  const now = opts.nowMs != null ? opts.nowMs : Date.now();
  s.nextTryAt = new Date(now + 9 * 3600000 + wait * 86400000).toISOString().slice(0, 10);
  s.status = '';                                      // 영구 포기 상태를 두지 않는다
  if (why === '목록에서 못 찾음') {
    if (opts.scan === 'end' && s.attempts >= ESCALATE_AT) s.likelyGone = true;
    else if (opts.scan !== 'end') delete s.likelyGone;   // 끝까지 못 본 회차는 '내려갔다'의 근거가 아니다
  }
  return s;
}

/* 3단계까지 끝난 뒤 — 이번에 처음으로 사람에게 알릴 건인가(참이면 st.escalated 를 세운다).
   찾은 것(resolved)·횟수가 모자란 것·이미 알린 것은 거짓. */
export function settleEscalation(st) {
  if (!st || st.status === 'resolved' || (st.attempts || 0) < ESCALATE_AT || st.escalated) return false;
  st.escalated = true;
  return true;
}

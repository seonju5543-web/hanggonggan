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
   opts: { today: 'YYYY-MM-DD', nowMs, url(찾은 주소), scan('end'|'deep' — '목록에서 못 찾음'일 때 목록을 끝까지 봤나),
           defer(false 면 'net' 이어도 미루지 않는다 — 우리 시간 상한처럼 학교 탓이 아닌 것) } */
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
  /* 못 읽음(시간 초과·5xx·게시판 안 열림)은 횟수에 안 센다 — 그래도 **내일로 미룬다** (2026-10-05 점검 links-14).
     예전엔 미루는 날(nextTryAt)을 안 적어, 학교 서버가 느린 표적을 하루 다섯 번 실행마다 다시 두드렸다('같은 학교를 하루에 여러 번 두드리지 말 것').
     이미 더 늦은 날이 적혀 있으면 줄이지 않는다. 우리 시간 상한으로 못 본 것은 부르는 쪽이 defer:false 로 넘긴다(다음 실행이 바로 본다). */
  if (outcome === 'net') {
    if (opts.defer !== false) {
      const now = opts.nowMs != null ? opts.nowMs : Date.now();
      const tomorrow = new Date(now + 9 * 3600000 + 86400000).toISOString().slice(0, 10);
      if (!s.nextTryAt || s.nextTryAt < tomorrow) s.nextTryAt = tomorrow;
    }
    return s;
  }
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

/* 이번에 처음 사람에게 알리는 공고 줄 (2026-10-05 점검 links-2) — 이슈 본문은 리포트 전체라, 이 절이 없으면 이슈 제목의 'n건'이
   어느 공고인지 본문에서 찾을 수 없었다(#387). 사냥꾼이 리포트 머리말 바로 뒤에 넣는다. 빈 목록이면 [](절을 안 찍는다).
   list: [{ title, key, attempts, lastWhy, likelyGone }] */
export function escalationLines(list) {
  const items = (list || []).filter(Boolean);
  if (!items.length) return [];
  return [
    `### 🙋 사람 확인 필요 — 이번에 처음 알리는 공고 ${items.length}건`,
    '로봇은 계속 찾습니다 — 게시판 주소가 바뀌었거나 글이 내려갔는지 사람이 보면 더 빨리 풀릴 수 있는 것들이에요.',
    '',
    ...items.map((x) => `- ${String(x.title || '').slice(0, 60)} — ${x.attempts || 0}회 못 찾음${x.likelyGone ? ' · 게시판 끝까지 봤는데 없음(내려간 듯)' : ''}`
      + `${x.lastWhy ? ` · 마지막 이유: ${String(x.lastWhy).slice(0, 60)}` : ''} (\`${String(x.key || '').slice(0, 120)}\`)`),
    '',
  ];
}

/* 장부 정리 (2026-10-05 점검 links-9) — link-hunt.json 을 지우는 곳이 없어 1,404줄 중 956줄이 이미 데이터에 없는 공고였다
   (꺼진 순찰의 흔적 patrolledAt·lastWhy 만 남은 줄이 대부분 · 관리자 화면 '죽은 링크' 30줄 중 18줄이 없는 공고).
   사냥꾼이 저장 직전에 부른다. 새 items 를 돌려준다(넘겨받은 것은 안 고친다).
     · 데이터에 있는 열쇠(liveKeys — 지금 피드 'n:<주소>' · 정식 등록 'r:<id>')는 남긴다. 순찰이 꺼져 있으면 순찰 흔적(patrolledAt·patrol)을 떼고,
       떼고 나서 순찰 흔적만 있던 줄(시도 기록 lastTried 없음 · lastWhy·attempts 0 뿐)은 버린다.
     · 데이터에 없는 열쇠는 버린다. 단 찾은 것(resolved)·사람에게 알린 것(escalated)은 마지막 시도가 graceDays 안이면 남긴다(최근 기록).
   🔴 살아 있는 표적의 attempts·nextTryAt·escalated·likelyGone 은 그대로 둔다. 합집합 병합기(merge-json-union mergeLinkHunt)가 지운 열쇠를
      되살려도 다음 실행이 다시 걷어 낸다 — 병합기를 지우기 쪽으로 바꾸지 말 것. */
const PATROL_TRACE = ['patrolledAt', 'patrol'];
export function pruneHuntState(items, liveKeys, today, graceDays = 30, { patrolOn = false } = {}) {
  const live = liveKeys instanceof Set ? liveKeys : new Set(liveKeys || []);
  const cutoff = new Date(Date.parse(`${today}T00:00:00Z`) - graceDays * 86400000).toISOString().slice(0, 10);
  const out = {};
  for (const [k, v0] of Object.entries(items || {})) {
    if (!v0 || typeof v0 !== 'object') continue;
    const v = { ...v0 };
    if (!patrolOn) for (const f of PATROL_TRACE) delete v[f];
    const huntRecord = !!v.lastTried || !!v.nextTryAt || (v.attempts || 0) > 0 || !!v.status || !!v.escalated || !!v.resolvedUrl;
    if (live.has(k)) {
      if (!patrolOn && !huntRecord) continue;   // 순찰 흔적만 있던 줄
      out[k] = v;
      continue;
    }
    if ((v.status === 'resolved' || v.escalated) && v.lastTried && v.lastTried >= cutoff) out[k] = v;
  }
  return out;
}

/* ============================================================
   게시판 목록 받기 + 실패 이유 펴기 — **한 곳** (2026-09-30 · 교내 소식 로봇을 만들며 collect.mjs 에서 떼어 왔다)
   collect.mjs 와 collect-news.mjs 가 같은 것을 쓴다. ⚠️ collect.mjs 는 불러오는 순간 실행되는 파일이라
   거기서 import 할 수 없어 여기로 옮겼다(board-links.mjs 와 같은 이유).
   ============================================================ */
import { FETCH_HEADERS } from './http-headers.mjs';

/* fetch의 네트워크 실패는 전부 'TypeError: fetch failed'로 뭉뚱그려져 온다.
   **진짜 이유는 e.cause에 들어 있다**(ENOTFOUND=주소가 없음 / UND_ERR_CONNECT_TIMEOUT=연결 지연 /
   CERT=인증서). 이걸 안 펴 줘서 홍익대·서울과기대가 며칠째 '⚠️ 오류 (TypeError)'로만 남아
   **주소가 틀린 건지 학교가 잠깐 느린 건지 구분할 수 없었다** (2026-08-02). */
export function netReason(e) {
  const seen = [];
  for (let c = e; c && seen.length < 4; c = c.cause) {
    if (c.code) seen.push(c.code);
    else if (c.message && c !== e) seen.push(String(c.message).slice(0, 60));
  }
  /* 원인 사슬이 없으면 이름보다 **메시지**가 낫다 — `new Error('HTTP 403')` 이 'Error' 한 낱말로 뭉개지지 않게 (2026-09-30) */
  return seen.length ? `${e.name}: ${seen.join(' ← ')}` : ((e.name && e.name !== 'Error') ? e.name : (e.message || e.name));
}

/* 연결이 잠깐 안 되는 것과 주소가 틀린 것은 다르다 — 일시 장애는 한 번 더 두드려 본다. */
const TRANSIENT = /TIMEOUT|ECONNRESET|ECONNREFUSED|EAI_AGAIN|ETIMEDOUT|UND_ERR/i;
export async function fetchBoard(url, opts = {}) {
  const headers = opts.headers || FETCH_HEADERS;
  const tries = opts.tries ?? 3;
  let lastErr;
  for (let i = 0; i < tries; i += 1) {
    try {
      /* POST 목록 API(중앙대 BBSViewList2.do · 2026-10-01 정찰) — 본문이 있으면 폼 전송으로 보낸다. 머리말은 같다(학생 브라우저와 같은 UA). */
      const init = { method: opts.method || (opts.body ? 'POST' : 'GET'), redirect: 'follow', headers: opts.body ? { ...headers, 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' } : headers, signal: AbortSignal.timeout(i === 0 ? (opts.firstMs ?? 20000) : (opts.retryMs ?? 45000)) };
      if (opts.body) init.body = opts.body;
      return await fetch(url, init);
    } catch (e) {
      lastErr = e;
      if (!TRANSIENT.test(netReason(e)) || i === tries - 1) break;   // 주소가 없는 것(ENOTFOUND)은 다시 해도 같다
      await new Promise((r) => setTimeout(r, 3000 * (i + 1)));
    }
  }
  throw lastErr;
}

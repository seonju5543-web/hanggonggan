/**
 * Graph API 부르기 — 트랙션(stats.mjs)·댓글(comments.mjs)이 같이 쓰는 한 곳 (2026-09-12 코드 리뷰).
 * 🔴 Instagram Login 경로 — 호스트는 graph.instagram.com (페이스북 페이지 없이 된다 · publish.mjs 머리말).
 * 🔴 Graph API 는 실패해도 200 을 주는 경우가 있어 **본문의 error 를 봐야** 한다 — 이 규칙이 세 벌로
 *    베껴져 있던 것을 여기로 모았다(게시 경로 publish.mjs 는 관문 C9·C10 이 그 파일을 직접 재서 그대로 둔다).
 * 🔴 env 를 모듈 맨 위에서 읽지 않는다 — 불러오는 순간 값이 굳어 검사가 시험을 못 한다(token-days.mjs 와 같은 이유).
 */
export const API = () => process.env.IG_API_BASE || 'https://graph.instagram.com';
export const TOKEN = () => process.env.IG_ACCESS_TOKEN;

/** GET 은 쿼리로, 그 외는 본문으로. `fetchImpl` 을 넣을 수 있어 검사가 가짜 서버로 돌린다. */
export async function graph(path, params = {}, method = 'GET', fetchImpl = fetch) {
  const u = new URL(`${API()}/${path}`);
  const body = new URLSearchParams({ ...params, access_token: TOKEN() });
  const r = method === 'GET' ? await fetchImpl(`${u}?${body}`) : await fetchImpl(u, { method, body });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(j.error?.message || `HTTP ${r.status}`);
  return j;
}

/** KST 기준 오늘(YYYY-MM-DD) · 지금(YYYY-MM-DD HH:MM). 🔴 UTC 로 재면 새벽에 어제가 된다. */
export const kstDay = (ms = Date.now()) => new Date(ms + 9 * 36e5).toISOString().slice(0, 10);
export const kstNow = (ms = Date.now()) => new Date(ms + 9 * 36e5).toISOString().slice(0, 16).replace('T', ' ');

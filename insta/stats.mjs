/**
 * 트랙션 수확 — 팔로워·게시물별 반응을 Graph API 에서 받아 `insta/stats.json` 에 적는다.
 * 관리자 화면 「인스타 › 트랙션」 이 이 파일 하나를 읽는다(2026-09-12 개발자 지시 ⑥).
 *
 * 🔴 토큰은 **서버(워크플로)에만** 있다 — 관리자 화면이 인스타에 직접 묻지 않는다.
 *    화면에 토큰을 주면 그 화면을 여는 사람 전부가 계정에 글을 쓸 수 있다.
 * 🔴 **이력은 덧붙인다** — 팔로워 수는 오늘 값 하나로는 그래프가 안 된다. 하루 한 줄(`history`),
 *    같은 날 두 번 돌면 마지막 값으로 덮는다.
 * 🔴 게시물 통계(insights)는 게시물마다 따로 물어야 하고 **하나가 실패해도 나머지는 적는다** —
 *    한 게시물 때문에 전체가 비면 화면이 '반응 0' 으로 거짓말한다. 실패는 `error` 칸에 남긴다.
 * 🔴 토큰이 없으면 `state=none` 으로 **조용히 0 종료** — 계정 연결 전엔 정상이다.
 *
 * 실행: node insta/stats.mjs            (워크플로 insta-stats.yml · 매일)
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { graph, TOKEN, kstDay } from './graph.mjs';   // 🔴 Graph 호출 규칙은 graph.mjs 한 곳

const FILE = new URL('stats.json', import.meta.url);
const SEEN = new URL('seen.json', import.meta.url);

export const fileStore = {
  read: () => (existsSync(FILE) ? JSON.parse(readFileSync(FILE, 'utf8')) : { history: [], posts: [] }),
  /** 🔴 로봇 기록장은 들여쓰기 1칸 — 다르게 쓰면 파일 전체가 충돌한다(CLAUDE.md). */
  write: (v) => writeFileSync(FILE, `${JSON.stringify(v, null, 1)}\n`),
  seen: () => (existsSync(SEEN) ? JSON.parse(readFileSync(SEEN, 'utf8')) : { posted: [] }),
};

const get = (fetchImpl, path, params = {}) => graph(path, params, 'GET', fetchImpl);

/** 수확 한 번. `fetchImpl`·`store`·`now` 를 넣을 수 있어 검사가 가짜 서버로 돌린다. */
export async function harvest(fetchImpl = fetch, store = fileStore, now = Date.now()) {
  if (!TOKEN()) return { state: 'none' };
  const prev = store.read();
  const seen = store.seen();
  const today = kstDay(now);

  const me = await get(fetchImpl, 'me', { fields: 'username,followers_count,media_count' });
  const account = { username: me.username || null, followers: me.followers_count ?? null, media: me.media_count ?? null };

  // 게시물 목록 — 최근 50개(우리 속도로는 두 달치가 넘는다).
  const list = await get(fetchImpl, 'me/media', {
    fields: 'id,permalink,timestamp,like_count,comments_count,media_type,caption', limit: '50' });
  const byMedia = new Map((seen.posted || []).map((p) => [String(p.media), p]));
  const posts = [];
  for (const m of list.data || []) {
    const ours = byMedia.get(String(m.id));
    const row = {
      id: String(m.id), code: ours?.code || null, org: ours?.org || null, name: ours?.name || null,
      permalink: m.permalink || null, at: String(m.timestamp || '').slice(0, 10),
      likes: m.like_count ?? null, comments: m.comments_count ?? null, type: m.media_type || null,
      reach: null, saved: null, shares: null, error: null,
    };
    // 🔴 게시물 하나의 실패가 전체를 비우면 안 된다 — 줄마다 따로 받고 실패는 적어 둔다.
    try {
      const ins = await get(fetchImpl, `${m.id}/insights`, { metric: 'reach,saved,shares' });
      for (const d of ins.data || []) row[d.name] = d.values?.[0]?.value ?? d.total_value?.value ?? null;
    } catch (e) { row.error = e.message; }
    posts.push(row);
  }

  const history = (prev.history || []).filter((h) => h.at !== today);
  history.push({ at: today, followers: account.followers, media: account.media,
    likes: posts.reduce((a, p) => a + (p.likes || 0), 0),
    comments: posts.reduce((a, p) => a + (p.comments || 0), 0),
    saved: posts.reduce((a, p) => a + (p.saved || 0), 0) });
  history.sort((a, b) => a.at.localeCompare(b.at));
  const out = { updatedAt: new Date(now).toISOString(), account, history: history.slice(-180), posts };
  store.write(out);
  return { state: 'ok', account, posts: posts.length, failed: posts.filter((p) => p.error).length };
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], 'file:').href) {
  const r = await harvest().catch((e) => { console.error(`🚨 수확 실패 — ${e.message}`); process.exit(1); });
  if (r.state === 'none') { console.log('시크릿이 없습니다 — 계정 연결 전이라 정상입니다.'); console.log('state=none'); process.exit(0); }
  console.log(`■ @${r.account.username} 팔로워 ${r.account.followers} · 게시물 ${r.posts}건 (반응을 못 받은 것 ${r.failed}건)`);
  console.log('state=ok');
}

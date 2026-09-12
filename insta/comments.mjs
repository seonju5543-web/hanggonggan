/**
 * 댓글 — 받아 적기 · 답글 · 숨기기 · 지우기 (2026-09-12 개발자 지시 ⑥ "댓글 관리").
 * 관리자 화면 「인스타 › 댓글」 이 `insta/comments.json` 을 읽고, 버튼은 워크플로
 * `insta-comments.yml` 을 깨워 여기로 온다 — **토큰은 서버에만 있다**(stats.mjs 와 같은 이유).
 *
 * 🔴 **기본은 예행연습이다.** 답글·숨김·삭제는 `--do` 를 줘야 실제로 한다 — 브랜드 계정으로
 *    나가는 되돌릴 수 없는 일이라 게시(publish.mjs)와 같은 규칙.
 * 🔴 받아 적을 때 **우리가 남긴 표식은 지우지 않는다** — `handledAt`(답했다·봤다) 은 인스타에
 *    없는 우리 기록이라, 새로 받아 온 것으로 통째로 덮으면 매번 '새 댓글' 로 되살아난다.
 * 🔴 댓글 글자는 **남이 쓴 것**이다 — 화면은 esc 로 그리고, 여기서는 그대로 적기만 한다.
 *
 * 실행: node insta/comments.mjs fetch
 *       node insta/comments.mjs reply  --comment=ID --text="…" [--do]
 *       node insta/comments.mjs hide   --comment=ID [--unhide] [--do]
 *       node insta/comments.mjs delete --comment=ID [--do]
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { graph as graphCall, TOKEN, kstNow } from './graph.mjs';   // 🔴 Graph 호출 규칙은 graph.mjs 한 곳

const FILE = new URL('comments.json', import.meta.url);
const SEEN = new URL('seen.json', import.meta.url);

export const fileStore = {
  read: () => (existsSync(FILE) ? JSON.parse(readFileSync(FILE, 'utf8')) : { items: [] }),
  write: (v) => writeFileSync(FILE, `${JSON.stringify(v, null, 1)}\n`),   // 🔴 들여쓰기 1칸
  seen: () => (existsSync(SEEN) ? JSON.parse(readFileSync(SEEN, 'utf8')) : { posted: [] }),
};

const graph = (fetchImpl, path, params = {}, method = 'GET') => graphCall(path, params, method, fetchImpl);

/** 우리 게시물 전부의 댓글을 받아 적는다. 우리 표식(`handledAt`)은 남긴다. */
export async function fetchAll(fetchImpl = fetch, store = fileStore, now = Date.now()) {
  if (!TOKEN()) return { state: 'none' };
  const prev = store.read();
  const mine = new Map((prev.items || []).map((c) => [c.id, c]));
  const seen = store.seen();
  const items = [];
  for (const p of seen.posted || []) {
    if (!p.media) continue;
    let data;
    try {
      data = (await graph(fetchImpl, `${p.media}/comments`, {
        fields: 'id,text,username,timestamp,like_count,hidden,replies{id,text,username,timestamp}' })).data || [];
    } catch (e) { items.push({ id: `err-${p.media}`, media: String(p.media), code: p.code, error: e.message }); continue; }
    for (const c of data) {
      const old = mine.get(String(c.id));
      items.push({
        id: String(c.id), media: String(p.media), code: p.code, org: p.org, name: p.name,
        username: c.username || null, text: c.text || '', at: String(c.timestamp || '').slice(0, 16).replace('T', ' '),
        likes: c.like_count ?? 0, hidden: !!c.hidden,
        replies: (c.replies?.data || []).map((r) => ({ id: String(r.id), username: r.username || null,
          text: r.text || '', at: String(r.timestamp || '').slice(0, 16).replace('T', ' ') })),
        handledAt: old?.handledAt || null,
      });
    }
  }
  items.sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')));
  store.write({ updatedAt: new Date(now).toISOString(), items });
  return { state: 'ok', count: items.filter((c) => !c.error).length, failed: items.filter((c) => c.error).length };
}

/** 답글·숨김·삭제. `live` 가 아니면 하려던 일만 말하고 끝낸다. */
export async function act(kind, { comment, text, unhide }, live, fetchImpl = fetch, store = fileStore, now = Date.now()) {
  if (!TOKEN()) throw new Error('IG_ACCESS_TOKEN 이 없습니다.');
  if (!comment || !/^\d+$/.test(String(comment))) throw new Error('--comment=<댓글 ID(숫자)> 가 필요합니다.');
  if (kind === 'reply' && !String(text || '').trim()) throw new Error('답글 글이 비었습니다.');
  const plan = kind === 'reply' ? `댓글 ${comment} 에 답글: ${text}`
    : kind === 'hide' ? `댓글 ${comment} ${unhide ? '다시 보이기' : '숨기기'}` : `댓글 ${comment} 삭제`;
  if (!live) return { dry: true, plan };
  let out;
  if (kind === 'reply') out = await graph(fetchImpl, `${comment}/replies`, { message: text }, 'POST');
  else if (kind === 'hide') out = await graph(fetchImpl, `${comment}`, { hide: unhide ? 'false' : 'true' }, 'POST');
  else if (kind === 'delete') out = await graph(fetchImpl, `${comment}`, {}, 'DELETE');
  else throw new Error(`모르는 작업 '${kind}'`);
  // 우리 기록 — 답했다/숨겼다/지웠다. 다음 fetch 가 인스타 값으로 맞추되 handledAt 은 남긴다.
  const cur = store.read();
  const row = (cur.items || []).find((c) => c.id === String(comment));
  if (row) {
    row.handledAt = kstNow(now);
    if (kind === 'reply') row.replies = [...(row.replies || []), { id: String(out.id || ''), username: '한대장', text, at: kstNow(now) }];
    if (kind === 'hide') row.hidden = !unhide;
    if (kind === 'delete') cur.items = cur.items.filter((c) => c.id !== String(comment));
    store.write(cur);
  }
  return { dry: false, plan, id: out.id || null };
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], 'file:').href) {
  const [kind] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const val = (k) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.split('=').slice(1).join('=') : undefined; };
  const live = process.argv.includes('--do');
  try {
    if (!kind || kind === 'fetch') {
      const r = await fetchAll();
      if (r.state === 'none') { console.log('시크릿이 없습니다 — 계정 연결 전이라 정상입니다.'); console.log('state=none'); process.exit(0); }
      console.log(`■ 댓글 ${r.count}건 받아 적음 (못 받은 게시물 ${r.failed}건)`); console.log('state=ok');
    } else {
      const r = await act(kind, { comment: val('comment'), text: val('text'), unhide: process.argv.includes('--unhide') }, live);
      console.log(r.dry ? `── 예행연습 — ${r.plan}\n   실제로 하려면 --do 를 주세요.` : `✅ ${r.plan}`);
    }
  } catch (e) { console.error(`🚨 ${e.message}`); process.exit(1); }
}

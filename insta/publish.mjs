/**
 * 인스타 게시 — Graph API 캐러셀 2단계.
 *
 * 🔴 **기본은 예행연습(dry-run)이다.** 실제로 올리려면 `--publish` 를 줘야 한다.
 *    게시는 되돌릴 수 없고 브랜드 계정으로 나가는 것이라, 실수로 올라가는 길을 안 만든다.
 *
 * 🔴 인스타는 **파일 업로드를 안 받는다.** `image_url` 에 **공개 주소**를 주면 인스타가
 *    우리 서버에서 가져간다. 그래서 그림을 GitHub Pages 로 먼저 내보내고, 그 주소가
 *    **실제로 열리는지 확인한 뒤에** 컨테이너를 만든다(Pages 배포에 몇십 초 걸린다 —
 *    안 기다리면 인스타가 404 를 받고 조용히 실패한다).
 * 🔴 **컨테이너는 만들자마자 올릴 수 없다** — 인스타가 그림을 가져가 처리하는 동안은
 *    `IN_PROGRESS` 다. 그래서 **물어보고 기다린다**(`waitReady`). 2026-09-13 첫 게시가
 *    이걸 안 해서 죽었다 — 자세한 것은 그 함수 머리말.
 * 🔴 **JPEG 만 받는다.** 다른 그림 형식을 주면 컨테이너 만들기에서 막힌다.
 * 🔴 장기 토큰은 **60일**이면 만료된다. 만료되면 조용히 게시가 멈추므로 남은 날짜를
 *    매 실행 찍고, 7일 안이면 시끄럽게 경고한다(노션 F-4 와 같은 유형).
 *
 * 필요한 것: IG_USER_ID · IG_ACCESS_TOKEN (저장소 시크릿)
 * 실행: node insta/publish.mjs --code=<공고 코드> [--publish]      (= --dir=insta/pub/<코드>)
 *       node insta/publish.mjs --dir=insta/pub/<코드> --urls | --wait-only
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// 🔴 Instagram Login 경로 — **페이스북 페이지가 필요 없다**(2026-09-11 문서 확인).
//    엔드포인트 경로는 Facebook Login 과 똑같고 호스트만 다르다.
const API = process.env.IG_API_BASE || 'https://graph.instagram.com';
const ROOT = new URL('../', import.meta.url);
/** 🔴 주소를 여기 한 곳에만 둔다 — 앱 주소가 여덟 군데 박혀 있어서 옮길 때 샜던 전례가 있다. */
const SITE = process.env.INSTA_PUBLIC_BASE || 'https://seonju5543-web.github.io/hanggonggan';

/** 🔴 기다림의 길이를 **한 곳에** 모은다 — 시험에서 0으로 줄여 쓴다(실제 값으로 시험하면 몇 분 걸린다).
 *  그래서 시험이 진짜 코드를 돌리면서도 빨리 끝난다(규칙을 베껴 재는 시험은 원본이 바뀌어도 통과한다). */
export const WAITS = { liveTries: 20, liveGapMs: 15000, readyTries: 30, readyGapMs: 4000, pubTries: 5, pubGapMs: 15000 };

const arg = (k, d) => {
  const a = process.argv.find((x) => x.startsWith(`--${k}=`));
  return a ? a.split('=').slice(1).join('=') : d;
};
const say = (...m) => console.log(...m);

/** Graph API 는 실패해도 200 을 주는 경우가 있어 **본문의 error 를 봐야** 한다.
 *  🔴 던지는 오류에 **응답 코드와 본문을 달아 둔다** — 부르는 쪽이 '다시 불러도 되는 실패인가'
 *     를 가려야 하기 때문이다. 글월만 보고 가르면 인스타가 말을 바꾸는 날 조용히 갈라진다. */
async function graph(path, params, method = 'POST', f = fetch) {
  const u = new URL(`${API}/${path}`);
  const body = new URLSearchParams({ ...params, access_token: process.env.IG_ACCESS_TOKEN });
  const r = method === 'GET'
    ? await f(`${u}?${body}`)
    : await f(u, { method: 'POST', body });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) {
    const e = j.error || {};
    const err = new Error(`Graph ${path} 실패 (${r.status}) — ${e.message || JSON.stringify(j)}`
      + (e.error_user_msg ? `\n   ${e.error_user_msg}` : ''));
    err.status = r.status; err.body = e;
    throw err;
  }
  return j;
}

/** 🔴 인스타가 가져가기 전에 **우리가 먼저 열어 본다.** Pages 배포가 안 끝났으면
 *  인스타는 404 를 받고 컨테이너를 못 만드는데, 그 오류는 원인을 안 알려 준다. */
export async function waitLive(urls, tries = WAITS.liveTries, gapMs = WAITS.liveGapMs, f = fetch, log = say) {
  for (let n = 1; n <= tries; n++) {
    const got = await Promise.all(urls.map((u) =>
      f(u, { method: 'HEAD' }).then((r) => r.ok).catch(() => false)));
    if (got.every(Boolean)) { log(`  그림 ${urls.length}장 공개 확인 (${n}번째 시도)`); return; }
    log(`  기다리는 중 ${got.filter(Boolean).length}/${urls.length} … (${n}/${tries})`);
    await new Promise((r) => setTimeout(r, gapMs));
  }
  throw new Error('그림이 공개 주소에서 안 열립니다 — Pages 배포를 확인하세요.');
}

/** 🔴 **컨테이너는 만들자마자 올릴 수 없다.** 인스타가 우리 주소에서 그림을 가져가 처리하는
 *  동안은 `IN_PROGRESS` 이고, 그때 `media_publish` 를 부르면 400 `Media ID is not available`
 *  (`The media is not ready for publishing`) 로 튕긴다.
 *  **2026-09-13 첫 게시가 실제로 이렇게 죽었다** — 캐러셀 컨테이너를 만든 지 **0.1초 만에** 불렀고,
 *  토큰·그림·한도가 전부 멀쩡했는데도 아무것도 안 올라갔다(run 34704614904). 기다리는 것 말고
 *  방법이 없고, 얼마나 걸리는지는 **물어봐야만** 안다.
 *  ⚠️ `status_code` 가 안 오면 **다 된 것으로 치지 말 것** — 모르는 것을 안다고 하는 것이다(원칙 8-1).
 *     그런 경우는 기다리다 시한에 걸려 죽는다. 모르는 채 올리는 것보다 낫다. */
export async function waitReady(id, what = '컨테이너',
  { tries = WAITS.readyTries, gapMs = WAITS.readyGapMs, f = fetch, log = say } = {}) {
  for (let n = 1; n <= tries; n++) {
    /* 🔴 '아직 안 됐다' 와 **'물어볼 수가 없다'** 는 다르다. 물어볼 수 없을 때 여기서 막으면
       멀쩡한 게시를 우리가 죽이는 것이다 — 그래서 `status` 를 뺀 채 한 번 더 물어보고,
       그래도 안 되면 **모른다(null)** 로 비켜 준다. 아래 publishWhenReady 의 400 재시도가
       받아 준다(그건 올라간 것이 없는 실패라 다시 불러도 안전하다). */
    let s;
    try { s = await graph(id, { fields: 'status_code,status' }, 'GET', f); }
    catch {
      try { s = await graph(id, { fields: 'status_code' }, 'GET', f); }
      catch (e2) { log(`  ${what} 상태를 못 물어봤습니다 — ${e2.message}`); return null; }
    }
    if (s.status_code === 'FINISHED') return s;
    // 🔴 끝난 것도 아니고 처리 중도 아닌 상태는 **기다려도 안 바뀐다** — 바로 말하고 죽는다.
    if (['ERROR', 'EXPIRED', 'PUBLISHED'].includes(s.status_code))
      throw new Error(`${what} 가 ${s.status_code} 입니다 — ${s.status || '인스타가 이유를 안 알려 줍니다'}`);
    if (n === 1 || n % 5 === 0) log(`  ${what} 처리 중 … (${n}/${tries})`);
    await new Promise((r) => setTimeout(r, gapMs));
  }
  throw new Error(`${what} 가 ${Math.round((tries * gapMs) / 1000)}초 안에 준비되지 않았습니다 — 잠시 뒤 「게시」 를 다시 누르세요.`);
}

/** 🔴 상태가 FINISHED 여도 인스타가 아직 "안 됐다" 고 할 때가 있다(반영이 늦는다).
 *  다시 부르는 것은 **400 일 때뿐**이다 — 400 은 요청이 거절된 것이라 **올라간 것이 없다.**
 *  시간초과·5xx 는 올라갔는지 우리가 모르므로 절대 다시 부르지 않는다: 다시 부르면
 *  같은 글이 두 번 올라가고, 그건 되돌릴 수 없다(이 파일이 조심하는 바로 그 일). */
async function publishWhenReady(id, creation_id,
  { tries = WAITS.pubTries, gapMs = WAITS.pubGapMs, f = fetch, log = say } = {}) {
  for (let n = 1; ; n++) {
    try { return await graph(`${id}/media_publish`, { creation_id }, 'POST', f); }
    catch (e) {
      const notReady = e.status === 400
        && /not (available|ready)/i.test(`${e.body?.message || ''} ${e.body?.error_user_msg || ''}`);
      if (!notReady || n >= tries) throw e;
      log(`  인스타가 "아직 준비 중" 이라고 합니다 — ${Math.round(gapMs / 1000)}초 뒤 다시 (${n}/${tries})`);
      await new Promise((r) => setTimeout(r, gapMs));
    }
  }
}

/** 남은 토큰 수명. 🔴 만료되면 **조용히** 멈추므로 매번 찍는다.
 *  판정은 `token-days.mjs` 한 곳 — 여기 규칙을 한 벌 더 두면 감시 로봇과 갈라진다.
 *  ⚠️ 기록장(store)을 받는 이유는 시험 때문이다 — 안 받으면 시험이 진짜 `token-seen.json` 에
 *     시험용 지문을 적어, 감시 로봇이 '토큰이 바뀌었다' 고 보고 남은 날을 60일로 되돌린다. */
async function tokenDays(f = fetch, store = null) {
  try {
    const { tokenState, fileStore } = await import('./token-days.mjs');
    const s = await tokenState(f, store || fileStore);
    return s.state === 'none' ? null : s.days;
  } catch { return null; }                       // 못 물어봐도 게시는 막지 않는다
}

export async function publish({ dir, images, caption, live, f = fetch, waits = WAITS, tokenStore = null, log = say }) {
  const id = process.env.IG_USER_ID;
  if (!id || !process.env.IG_ACCESS_TOKEN) throw new Error('IG_USER_ID · IG_ACCESS_TOKEN 이 없습니다.');
  if (images.length < 2 || images.length > 10) throw new Error(`캐러셀은 2~10장인데 ${images.length}장입니다.`);

  const days = await tokenDays(f, tokenStore);
  if (days !== null) {
    log(`  토큰 남은 수명 ${days}일`);
    if (days <= 7) console.error(`🚨 토큰이 ${days}일 뒤 만료됩니다 — 갱신하지 않으면 게시가 조용히 멈춥니다.`);
  }
  const limit = await graph(`${id}/content_publishing_limit`, {}, 'GET', f).catch(() => null);
  if (limit?.data?.[0]) log(`  24시간 게시량 ${limit.data[0].quota_usage} / ${limit.data[0].config?.quota_total ?? 100}`);

  if (!live) {
    log('\n── 예행연습 (실제로 안 올립니다) ─────────────────');
    images.forEach((u, i) => log(`  ${i + 1}장  ${u}`));
    log(`  캡션 ${caption.length}자 · 해시태그 ${(caption.match(/#[^\s#]+/g) || []).length}개`);
    log('  실제로 올리려면 --publish 를 주세요.');
    return null;
  }

  await waitLive(images, waits.liveTries, waits.liveGapMs, f, log);
  // ① 장마다 컨테이너
  const children = [];
  for (const [i, image_url] of images.entries()) {
    const { id: cid } = await graph(`${id}/media`, { image_url, is_carousel_item: 'true' }, 'POST', f);
    log(`  ${i + 1}장 컨테이너 ${cid}`);
    children.push(cid);
  }
  // 🔴 **한 장이라도 처리 중이면 캐러셀이 못 올라간다.** 같이 기다린다 — 차례로 기다리면 장수만큼 더 걸린다.
  await Promise.all(children.map((c, i) =>
    waitReady(c, `${i + 1}장`, { tries: waits.readyTries, gapMs: waits.readyGapMs, f, log })));
  // ② 캐러셀 컨테이너
  const { id: carousel } = await graph(`${id}/media`,
    { media_type: 'CAROUSEL', children: children.join(','), caption }, 'POST', f);
  log(`  캐러셀 컨테이너 ${carousel}`);
  // 🔴 캐러셀 그릇도 처리 시간이 있다 — 장들이 다 됐다고 그릇까지 된 것이 아니다.
  await waitReady(carousel, '캐러셀', { tries: waits.readyTries, gapMs: waits.readyGapMs, f, log });
  // ③ 게시
  const { id: mediaId } = await publishWhenReady(id, carousel,
    { tries: waits.pubTries, gapMs: waits.pubGapMs, f, log });
  const { permalink } = await graph(mediaId, { fields: 'permalink' }, 'GET', f).catch(() => ({}));
  log(`  ✅ 게시 완료 ${mediaId}${permalink ? ` — ${permalink}` : ''}`);
  return { mediaId, permalink: permalink || null, dir };
}

// ── 실행 ────────────────────────────────────────────────────
if (process.argv[1] && import.meta.url === new URL(process.argv[1], 'file:').href) {
  // 🔴 공고 하나에 폴더 하나(`insta/pub/<코드>/`) — `--code` 가 폴더를 정한다. 2026-09-12.
  const code = arg('code');
  if (code && !/^[A-Za-z0-9_-]+$/.test(code)) { console.error(`공고 코드 '${code}' 가 이상합니다.`); process.exit(1); }
  const dir = arg('dir') || (code ? `insta/pub/${code}` : null);
  if (!dir) { console.error('--code=<공고 코드> 또는 --dir=insta/pub/<코드> 를 주세요.'); process.exit(1); }
  const abs = new URL(dir + '/', ROOT);
  if (!existsSync(abs)) { console.error(`${dir} 가 없습니다 — 먼저 렌더하세요.`); process.exit(1); }

  const files = readdirSync(abs).filter((f) => f.endsWith('.jpg')).sort();
  const caption = readFileSync(new URL('caption.txt', abs), 'utf8').trim();
  const images = files.map((f) => `${SITE}/${dir}/${f}`);
  // 🔴 주소를 묻는 길 — 워크플로가 주소를 **베끼지 않게** 한다. SITE 는 이 파일 하나에만
  //    있어야 한다(머리말): 베껴 두면 기다린 주소와 이슈에 박은 주소가 갈라져,
  //    확인은 초록불인데 은서에게는 깨진 그림이 간다.
  if (process.argv.includes('--urls')) { images.forEach((u) => console.log(u)); process.exit(0); }

  say(`■ ${dir} — 그림 ${files.length}장`);

  // 🔴 준비 단계는 **올리지 않고** 그림이 공개됐는지만 본다 — 이슈에 박을 그림 주소가
  //    아직 404 면 GitHub 이 깨진 그림을 캐시해 버려서 은서가 영영 못 본다.
  if (process.argv.includes('--wait-only')) {
    // 🔴 `[].every()` 는 **참**이다 — 장수를 안 세면 0장짜리 폴더가 '공개 확인' 으로 통과한다.
    if (files.length < 2) { console.error(`\n🚨 그림이 ${files.length}장뿐입니다 — 캐러셀은 2장부터입니다.`); process.exit(1); }
    await waitLive(images).catch((e) => { console.error(`\n🚨 ${e.message}`); process.exit(1); });
    process.exit(0);
  }

  const live = process.argv.includes('--publish');
  // 🔴 스택 트레이스를 뱉으면 무엇이 잘못됐는지 안 보인다. 한 줄로 말하고 죽는다.
  const out = await publish({ dir, images, caption, live })
    .catch((e) => { console.error(`\n🚨 ${e.message}`); process.exit(1); });
  if (out) {
    // 🔴 올린 것을 기억하지 못하면 내일 같은 공고를 새 공고로 다시 올린다(이슈 #75 유형).
    const { readSeen, writeSeen } = await import('./pick.mjs');
    const { kstDay } = await import('./render.mjs');
    const meta = JSON.parse(readFileSync(new URL('meta.json', abs), 'utf8'));
    const seen = readSeen();
    seen.posted.push({ code: meta.code, org: meta.org, name: meta.name, tplNo: meta.tplNo ?? null,
      at: kstDay(), media: out.mediaId, permalink: out.permalink });   // 🔴 KST — UTC 면 새벽에 어제로 찍힌다
    // 준비 장부의 줄도 '올림' 으로 — 관리자 화면이 두 장부를 같이 본다.
    const pr = seen.prepared.find((p) => p.code === meta.code);
    if (pr) { pr.status = 'posted'; pr.postedAt = kstDay(); }
    writeSeen(seen);
    say(`  seen.json 에 기록 — 지금까지 ${seen.posted.length}건`);
  }
}

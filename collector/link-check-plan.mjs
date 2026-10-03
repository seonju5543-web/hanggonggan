/* 원문 링크 확인 로봇 — 무엇을, 어떤 순서로 열어 볼지 (순수 함수 · 2026-10-03 신설)
   ─────────────────────────────────────────────────────────────────────────────
   왜 생겼나 (2026-10-03 개발자 보고 · P0): *"원문 공고를 누르면 그 공고가 아니라 재단·장학금
   페이지 전체가 열린다"* — 장학금·대외활동·소식 전반. 조사해 보니 **아무도 학생처럼 새 탭으로
   열어 보고 그 공고가 뜨는지 기록하지 않았다.** 링크 사냥꾼의 순찰은 표식(#n-) 정리가 본업이라
   정식 등록·실시간 공고 일부만 돌았고, 대외활동·재단 게시판·소식은 아무도 안 봤다.

   이 파일은 **불러와도 아무 일도 안 한다**(관문이 불러 잰다). 일은 collector/link-check.mjs 가 한다.
     · gatherTargets — 앱이 실제로 받는 파일 **전부**에서 링크를 모은다
         data/registered.json(정식 등록) · data/notices/<학교>.json(실시간 공고 — 폰은 이것만 받는다)
         · data/external.json(재단·지자체) · data/activities.json(대외활동·공모전) · data/news/<학교>.json(소식)
       건너뛰는 것(세기만 한다): 주소 없음 · `#n-` 목록 표식(앱이 이미 '게시판 목록'이라 부른다)
         · 층2(data/kosaf-open.json — 재단 홈페이지뿐이라 앱이 늘 '재단 홈페이지'라 부른다) · 숨긴 글
     · otherTitlesFor — 같은 사이트의 **다른 글 제목**. 🔴 목록 판정에 꼭 있어야 한다:
         링크 사냥꾼 순찰이 `verify(url, title, [])` 로 빈 목록을 넘겨 가천·고려 목록 41건을 '통과'시켰다.
     · planQueue — 이번 실행에 열 순서(처음 보는 정식 등록 → 처음 보는 나머지 → 한 번 본 문제(다른 날 확정용)
         → 확정된 문제(풀렸는지) → 나머지 오래 안 본 것) · 사이트마다 상한(학교 서버를 몰아치지 않는다)
     · pickNext — 같은 사이트는 간격을 두고 연다(동국대가 짧은 간격에 막아 껍데기를 줬다 — 2026-08-01)
     · summarize — 리포트용 집계

   🔴 판정·확정 규칙은 여기 없다 — collector/link-landing.mjs 한 곳이다(베끼지 않는다).
   🔴 이 로봇은 **주소를 고치지 않는다** — 2026-10-03 순찰이 잡티 섞인 제목으로 멀쩡한 링크 8건을 목록 표식으로
      덮어쓴 사고 때문이다. 판정하는 쪽이 고치기까지 하면 오판 한 번이 곧 데이터 손상이다.
   ───────────────────────────────────────────────────────────────────────────── */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodeUrlEntities, linkShape, expectTitles, BAD } from './link-landing.mjs';
import { sameTitle, titleFingerprint } from './detail-url.mjs';

/* 데이터 묶음 이름 — 리포트·관문이 같은 낱말을 쓴다 */
export const DATASETS = ['registered', 'notices', 'external', 'activities', 'news'];
export const DS_LABEL = { registered: '정식 등록', notices: '실시간 공고', external: '재단·지자체', activities: '대외활동·공모전', news: '교내 소식' };

/* 오늘(한국 시각) — 'YYYY-MM-DD'. 다른 날 두 번이어야 확정이라 날짜는 한국 날짜로 센다. */
export function kstToday(now = Date.now()) {
  return new Date(now + 9 * 3600000).toISOString().slice(0, 10);
}

function rootDir(root) {
  if (root instanceof URL) return fileURLToPath(root);
  const s = String(root || '.');
  return s.startsWith('file:') ? fileURLToPath(s) : path.resolve(s);
}
function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}
/* 학교별 파일 묶음(data/notices · data/news) — 색인(index.json)과 그림 폴더(img)는 글이 아니다 */
function perSchoolFiles(dir) {
  let names = [];
  try { names = fs.readdirSync(dir); } catch { return []; }
  return names.filter((f) => f.endsWith('.json') && f !== 'index.json').sort().map((f) => path.join(dir, f));
}
function hostOf(u) { try { return new URL(u).host; } catch { return ''; } }
function originOf(u) { try { return new URL(u).origin; } catch { return ''; } }
const bump = (o, k, n = 1) => { o[k] = (o[k] || 0) + n; return o; };

/* 앱이 받는 파일 전부에서 열어 볼 링크를 모은다.
   돌려주는 것: { targets, skipped, markerTitles }
     targets  — [{ url(되돌린 주소 = 장부 열쇠), raw, ds:[…], id, title, titles:[…], host, origin, refs:[{ds,id,title,where}] }]
     skipped  — { marker:{ds:n}, noUrl:{ds:n}, noTitle:{ds:n}, hidden:{ds:n}, kosaf:{ items, withFiles, registered } }
     markerTitles — [{ origin, title }] 목록 표식 글의 제목(같은 사이트의 다른 글 제목으로만 쓴다 — 목록 판정 재료) */
export function gatherTargets(root) {
  const dir = rootDir(root);
  const D = (rel) => path.join(dir, rel);
  const skipped = { marker: {}, noUrl: {}, noTitle: {}, hidden: {}, kosaf: { items: 0, withFiles: 0, registered: 0 } };
  const markerTitles = [];
  const byUrl = new Map();

  const take = (ds, raw, item, ref) => {
    if (item && item.hidden) { bump(skipped.hidden, ds); return; }
    const shape = linkShape(raw);
    if (shape === 'none') { bump(skipped.noUrl, ds); return; }
    const titles = expectTitles(item);
    if (shape === 'marker') {
      bump(skipped.marker, ds);
      const o = originOf(decodeUrlEntities(raw));
      titles.forEach((t) => markerTitles.push({ origin: o, title: t }));
      return;
    }
    if (!titles.length) { bump(skipped.noTitle, ds); return; }
    const url = decodeUrlEntities(raw);
    const r = { ds, id: ref.id || '', title: titles[0], where: ref.where || '' };
    const had = byUrl.get(url);
    if (!had) {
      byUrl.set(url, { url, raw: String(raw), ds: [ds], id: r.id, title: titles[0], titles: [...titles], host: hostOf(url), origin: originOf(url), refs: [r] });
      return;
    }
    if (!had.ds.includes(ds)) had.ds.push(ds);
    if (!had.id && r.id) had.id = r.id;
    for (const t of titles) if (!had.titles.some((x) => titleFingerprint(x) === titleFingerprint(t))) had.titles.push(t);
    had.refs.push(r);
  };

  /* ① 정식 등록 — 화면이 sourceUrl 을 연다. 층2(sourceKind 'kosaf')가 섞여 들면 재단 홈페이지라 건너뛴다 */
  for (const it of (readJson(D('data/registered.json'), {}).items || [])) {
    if (it.sourceKind === 'kosaf') { skipped.kosaf.registered += 1; continue; }
    take('registered', it.sourceUrl, { boardTitle: it.boardTitle, name: it.name, hidden: it.hidden }, { id: it.id, where: (it.eligibility || {}).schoolOnly || it.provider || '' });
  }
  /* ② 실시간 공고 — 🔴 폰은 data/notices.json 이 아니라 **학교별 파일**만 받는다(CLAUDE.md 「학교별 공고 파일」) */
  for (const f of perSchoolFiles(D('data/notices'))) {
    const j = readJson(f, {});
    for (const it of (j.items || [])) take('notices', it.url, { boardTitle: it.boardTitle, title: it.title, hidden: it.hidden }, { where: it.school || j.school || '' });
  }
  /* ③ 재단·지자체 게시판 · ④ 대외활동·공모전 (숨긴 글은 앱에 안 나온다) */
  for (const it of (readJson(D('data/external.json'), {}).items || [])) take('external', it.url, { title: it.title, hidden: it.hidden }, { where: it.host || '' });
  for (const it of (readJson(D('data/activities.json'), {}).items || [])) take('activities', it.url, { title: it.title, hidden: it.hidden }, { where: it.host || it.school || '' });
  /* ⑤ 교내 소식 — 학교별 파일뿐(옛 통짜 파일 없음) · 사진 폴더(img)는 건너뛴다 */
  for (const f of perSchoolFiles(D('data/news'))) {
    const j = readJson(f, {});
    for (const it of (j.items || [])) take('news', it.url, { title: it.title, hidden: it.hidden }, { where: it.school || j.school || '' });
  }
  /* 층2 — 세기만 한다. KOSAF 상세는 POST 전용이라 재단 홈페이지 주소뿐이고, 앱은 그것을 '재단 홈페이지'라 부른다 */
  for (const it of (readJson(D('data/kosaf-open.json'), {}).items || [])) {
    skipped.kosaf.items += 1;
    if ((it.files || []).length) skipped.kosaf.withFiles += 1;
  }
  return { targets: [...byUrl.values()], skipped, markerTitles };
}

/* 같은 사이트의 다른 글 제목 — 목록 판정(looksLikeList)의 재료.
   같은 게시판(경로 앞부분이 같은 것)을 먼저, 그다음 같은 사이트의 나머지. 이 글과 같은 제목은 뺀다
   (같은 글이 두 데이터에 실린 경우 '다른 글'로 세면 멀쩡한 상세를 목록이라 한다). */
const dirOf = (u) => { try { const p = new URL(u).pathname; return p.slice(0, p.lastIndexOf('/') + 1); } catch { return ''; } };
export function otherTitlesFor(target, targets, markerTitles = [], cap = 80) {
  const mine = target.titles || [target.title];
  const near = []; const far = [];
  const seen = new Set();
  const push = (t, bucket) => {
    const k = titleFingerprint(t);
    if (k.length < 10 || seen.has(k) || mine.some((m) => sameTitle(m, t))) return;
    seen.add(k);
    bucket.push(t);
  };
  const d = dirOf(target.url);
  for (const o of targets) {
    if (o === target || o.url === target.url || o.origin !== target.origin) continue;
    const bucket = dirOf(o.url) === d ? near : far;
    for (const t of o.titles || [o.title]) push(t, bucket);
  }
  for (const m of markerTitles) if (m.origin === target.origin) push(m.title, near);
  return near.concat(far).slice(0, cap);
}

/* 이번 실행에 열 순서.
   tier 0 — 처음 보는 정식 등록(학생이 신청하러 누르는 곳)  1 — 처음 보는 나머지
        2 — 한 번 본 문제(앞선 날 · 오늘 다시 보면 '다른 날 두 번'이 되어 확정)
        3 — 확정된 문제(풀렸는지 — 오래 안 본 것부터)  4 — 나머지(오래 안 본 것부터)
   오늘 이미 본 것은 다시 열지 않는다(같은 날 두 번은 한 번으로 센다 — nextState).
   opts: { perHost(기본 8), max(기본 400) } — 한 사이트를 몰아치지 않게 사이트마다 상한. */
export function tierOf(t, state, today) {
  const s = (state || {})[t.url];
  if (!s || !s.lastAt) return (t.ds || []).includes('registered') ? 0 : 1;
  if (BAD.includes(s.v) && !s.confirmed && s.at && s.at < today) return 2;
  if (BAD.includes(s.v) && s.confirmed) return 3;
  return 4;
}
export function planQueue(targets, state, today, opts = {}) {
  const perHost = Number(opts.perHost) > 0 ? Number(opts.perHost) : 8;
  const max = Number(opts.max) > 0 ? Number(opts.max) : 400;
  const st = state || {};
  const rows = targets
    .map((t, i) => ({ t, i, tier: tierOf(t, st, today), s: st[t.url] || {} }))
    .filter((r) => r.s.lastAt !== today);
  const key = (r) => {
    if (r.tier === 2) return r.s.at || '';
    if (r.tier >= 3) return `${r.s.lastAt || ''}${r.s.v ? 1 : 0}`;   // 오래 안 본 것 · 판정이 아직 없는 것(모름) 먼저
    return '';
  };
  rows.sort((a, b) => (a.tier - b.tier) || (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0) || (a.i - b.i));
  const perCount = new Map();
  const out = [];
  for (const r of rows) {
    if (out.length >= max) break;
    const n = perCount.get(r.t.host) || 0;
    if (n >= perHost) continue;
    perCount.set(r.t.host, n + 1);
    out.push(r.t);
  }
  return out;
}

/* 다음에 열 것 — 줄 앞에서부터, 같은 사이트를 마지막으로 연 지 spacing 이 지난 첫 항목.
   다 막혀 있으면 { wait } (가장 먼저 풀리는 사이트까지 남은 시간). 순서는 되도록 지킨다. */
export function pickNext(queue, lastHit, now, spacingMs) {
  let wait = Infinity;
  for (let i = 0; i < queue.length; i += 1) {
    const last = lastHit.get(queue[i].host);
    const left = last == null ? 0 : (last + spacingMs) - now;
    if (left <= 0) return { index: i, wait: 0 };
    if (left < wait) wait = left;
  }
  return { index: -1, wait: queue.length ? wait : 0 };
}

/* 장부에서 이 링크의 지금 상태 — 리포트 표의 칸 이름 */
export function statusOf(s) {
  if (!s || !s.lastAt) return 'unchecked';
  if (BAD.includes(s.v)) return s.confirmed ? s.v : 'pending';
  if (s.v === 'post') return 'post';
  return 'unread';
}
export const STATUS_COLS = ['unchecked', 'post', 'unread', 'pending', ...BAD];

/* 리포트 집계 — 데이터 × 상태, 확정 문제 목록, 한 번 본 문제 목록 */
export function summarize(state, targets) {
  const byDs = Object.fromEntries(DATASETS.map((d) => [d, Object.fromEntries(STATUS_COLS.map((c) => [c, 0]))]));
  const confirmed = []; const pending = [];
  for (const t of targets) {
    const s = (state || {})[t.url];
    const st = statusOf(s);
    for (const d of t.ds) if (byDs[d]) byDs[d][st] += 1;
    if (st === 'pending') pending.push({ t, s });
    else if (BAD.includes(st)) confirmed.push({ t, s });
  }
  const order = (a, b) => (a.t.ds[0] < b.t.ds[0] ? -1 : a.t.ds[0] > b.t.ds[0] ? 1 : (a.t.url < b.t.url ? -1 : 1));
  return { byDs, confirmed: confirmed.sort(order), pending: pending.sort(order), total: targets.length };
}

export default { DATASETS, DS_LABEL, kstToday, gatherTargets, otherTitlesFor, tierOf, planQueue, pickNext, statusOf, STATUS_COLS, summarize };

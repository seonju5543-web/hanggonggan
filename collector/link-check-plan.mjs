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
         · 마감이 지나 앱이 더는 안 보여 주는 대외활동(앱의 activitiesForMe 를 app.js 에서 이름으로 떼어 그대로 부른다 — 베끼지 않는다)
       🔴 (2026-10-04) 여는 주소는 **학생이 실제로 여는 주소**다 — 바로잡은 원문(source-link.js ⑥: 관리자 data/link-fixes.json ·
          로봇 data/link-check.json fix)이 있으면 그것을 연다(effectiveLinkUrl). 그래야 사람이 넣은 주소·로봇이 확인한 주소도
          날마다 다시 열어 보고, 지워진 글이면 '(확인 필요)'로 말한다. 층2도 바로잡은 원문이 있으면 대상이 된다(묶음 'kosaf').
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
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { decodeUrlEntities, linkShape, expectTitles, BAD } from './link-landing.mjs';
import { sameTitle, titleFingerprint } from './detail-url.mjs';
import { kosafAppItem, kosafTitles, kosafAttachTitles } from './link-candidates.mjs';

/* 앱과 같은 파일 — 바로잡은 원문(⑥)을 고르는 규칙을 베끼지 않는다 */
const SL = createRequire(import.meta.url)('../source-link.js');

/* 데이터 묶음 이름 — 리포트·관문이 같은 낱말을 쓴다 */
export const DATASETS = ['registered', 'notices', 'external', 'activities', 'news', 'kosaf'];
export const DS_LABEL = { registered: '정식 등록', notices: '실시간 공고', external: '재단·지자체', activities: '대외활동·공모전', news: '교내 소식', kosaf: '층2 재단(바로잡은 원문)' };

/* 앱이 지금 보여 주는 대외활동만 — 마감이 지난 글은 앱에서 내려가므로 열어 볼 까닭이 없다.
   🔴 규칙을 베끼지 않는다: app.js 의 activitiesForMe(마감 다음 날까지 · CLOSED_KEEP_DAYS)를 **이름으로 떼어** 그대로 부른다
      (verify/what-shows.mjs 와 같은 길 — 열 0 의 `function 이름(` ~ 열 0 의 `}`). 학교 범위는 학생마다 달라 여기서는 묻지 않는다.
   '오늘'은 로봇의 기준일(한국 날짜)로 — 앱의 todayStart 가 부르는 new Date() 만 그날 낮으로 바꿔 넣는다. */
const APP_JS = new URL('../app.js', import.meta.url);
let appActivitiesSrc = null;
function appActivityRule() {
  if (appActivitiesSrc) return appActivitiesSrc;
  const src = fs.readFileSync(APP_JS, 'utf8');
  const fn = (name) => {
    const m = src.match(new RegExp(`^function ${name}\\([\\s\\S]*?^\\}`, 'm'));
    if (!m) throw new Error(`app.js 에서 ${name}() 을 못 찾았습니다 — 앱 규칙을 베끼지 않으므로 멈춥니다`);
    return m[0];
  };
  const cst = (name) => {
    const m = src.match(new RegExp(`^const ${name} = .*$`, 'm'));
    if (!m) throw new Error(`app.js 에서 ${name} 을 못 찾았습니다 — 앱 규칙을 베끼지 않으므로 멈춥니다`);
    return m[0];
  };
  appActivitiesSrc = [cst('CLOSED_KEEP_DAYS'), fn('todayStart'), fn('dday'), fn('activitiesForMe')].join('\n\n');
  return appActivitiesSrc;
}
export function shownActivities(items, today) {
  const [y, m, d] = String(today).split('-').map(Number);
  class Day extends Date { constructor(...a) { if (a.length) super(...a); else super(y, m - 1, d, 12); } }
  const box = vm.createContext({ Date: Day, Math, Number, String });
  vm.runInContext(`${appActivityRule()}\nvar state = { profile: {} }; var liveActivities = null; function activityForProfile() { return true; }`, box, { filename: 'app.js(activitiesForMe)' });
  box.liveActivities = { items: items || [] };
  return new Set(vm.runInContext('activitiesForMe()', box));
}

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
function dirOf(u) { try { const p = new URL(u).pathname; return p.slice(0, p.lastIndexOf('/') + 1); } catch { return ''; } }
function originOf(u) { try { return new URL(u).origin; } catch { return ''; } }
const bump = (o, k, n = 1) => { o[k] = (o[k] || 0) + n; return o; };

/* 앱이 받는 파일 전부에서 열어 볼 링크를 모은다.
   돌려주는 것: { targets, skipped, siteTitles }
     targets  — [{ url(되돌린 주소 = 장부 열쇠), raw, ds:[…], id, title, titles:[…], host, origin, refs:[{ds,id,title,where}] }]
     skipped  — { marker:{ds:n}, noUrl:{ds:n}, noTitle:{ds:n}, hidden:{ds:n}, kosaf:{ items, withFiles, registered } }
     siteTitles — [{ origin, dir, title }] 열지 않는 글의 제목 — **목록 판정 재료로만** 쓴다(같은 사이트의 다른 글 제목):
                  목록 표식 글 + 수집 검수 후보(collector/candidates.json — 앱이 안 받는 전량 기록).
                  🔴 앱에 실린 글만으로는 한 사이트에 제목이 서넛뿐인 곳이 많아(서울대 4건) 목록 화면을 못 알아본다
                     (looksLikeList 는 다른 글 제목 셋이 보여야 목록이라 한다). */
export function gatherTargets(root, opts = {}) {
  const dir = rootDir(root);
  const D = (rel) => path.join(dir, rel);
  const today = opts.today || kstToday();
  const skipped = { marker: {}, noUrl: {}, noTitle: {}, hidden: {}, closed: {}, kosaf: { items: 0, withFiles: 0, registered: 0, fixed: 0 } };
  const siteTitles = [];
  const byUrl = new Map();
  /* 바로잡은 원문 두 장부를 앱처럼 넘긴다 — 끝나면 반드시 되돌린다(모듈 상태 · 다음 부르는 곳이 남의 장부를 보지 않게) */
  SL.setLinkChecks(readJson(D('data/link-check.json'), null));
  SL.setLinkFixes(readJson(D('data/link-fixes.json'), null));
  try {
    return gatherWith();
  } finally {
    SL.setLinkChecks(null);
    SL.setLinkFixes(null);
  }

  function gatherWith() {
  /* appItem = 화면이 sourceLink 에 넘기는 모양. 바로잡은 원문이 있으면 그 주소를 연다 —
     로봇 바로잡기가 '원래 주소가 확정 문제라서' 쓰이는 중이면 원래 주소도 계속 연다(풀리면 원래 주소로 돌아가야 하므로 ·
     안 열면 장부에서 빠져 확정이 풀리고, 그러면 바로잡기도 꺼졌다 켜졌다 한다) */
  const takeApp = (ds, appItem, item, ref) => {
    const fix = item && item.hidden ? null : SL.linkFixFor(appItem);
    const raw = appItem.sourceUrl != null && appItem.sourceUrl !== '' ? appItem.sourceUrl : (appItem.url || '');
    if (!fix) { take(ds, raw, item, ref); return; }
    /* 바로잡은 원문의 제목(사람이 넣은 원문 제목 · 로봇이 확인 때 맞춘 글 제목)도 기대 제목에 — 확인 때보다 적은 제목으로 날마다 재면
       로봇이 제가 확인한 원문을 '다른 글'로 버린다(리뷰 2026-10-04) */
    take(ds, fix.url, fix.title ? { ...item, fixTitle: fix.title } : item, { ...ref, fix: fix.src });
    if (fix.src === 'robot' && ['page', 'root'].includes(linkShape(raw))) take(ds, raw, item, ref);
  };
  const take = (ds, raw, item, ref) => {
    if (item && item.hidden) { bump(skipped.hidden, ds); return; }
    const shape = linkShape(raw);
    if (shape === 'none') { bump(skipped.noUrl, ds); return; }
    const titles = [...(item && item.kosafTitles ? item.kosafTitles : expectTitles(item))];
    if (item && item.fixTitle && !titles.some((t) => titleFingerprint(t) === titleFingerprint(item.fixTitle))) titles.push(item.fixTitle);
    if (shape === 'marker') {
      bump(skipped.marker, ds);
      const u = decodeUrlEntities(raw);
      titles.forEach((t) => siteTitles.push({ origin: originOf(u), dir: dirOf(u), title: t }));
      return;
    }
    if (!titles.length) { bump(skipped.noTitle, ds); return; }
    const url = decodeUrlEntities(raw);
    const r = { ds, id: ref.id || '', title: titles[0], where: ref.where || '' };
    /* (리뷰 F2) 기대 제목이 정식 등록의 앱 이름(name)뿐인가 — 게시판 원제목(boardTitle)도 피드 제목도 없으면 판정기가 '다른 글'을 보류한다 */
    const nameOnly = item && item.fixTitle ? false : (ds === 'kosaf' ? !!(item && item.nameOnly) : ds === 'registered' && !(item && item.boardTitle));
    const had = byUrl.get(url);
    if (!had) {
      byUrl.set(url, { url, raw: String(raw), ds: [ds], id: r.id, title: titles[0], titles: [...titles], nameOnly, host: hostOf(url), origin: originOf(url), refs: [r] });
      return;
    }
    if (!nameOnly) had.nameOnly = false;                 // 같은 주소의 피드 글·게시판 원제목이 있으면 근거가 생긴다
    if (!had.ds.includes(ds)) had.ds.push(ds);
    if (!had.id && r.id) had.id = r.id;
    for (const t of titles) if (!had.titles.some((x) => titleFingerprint(x) === titleFingerprint(t))) had.titles.push(t);
    had.refs.push(r);
  };

  /* ① 정식 등록 — 화면이 sourceUrl 을 연다. 층2(sourceKind 'kosaf')가 섞여 들면 재단 홈페이지라 건너뛴다 */
  for (const it of (readJson(D('data/registered.json'), {}).items || [])) {
    if (it.sourceKind === 'kosaf') { skipped.kosaf.registered += 1; continue; }
    takeApp('registered', it, { boardTitle: it.boardTitle, name: it.name, hidden: it.hidden }, { id: it.id, where: (it.eligibility || {}).schoolOnly || it.provider || '' });
  }
  /* ② 실시간 공고 — 🔴 폰은 data/notices.json 이 아니라 **학교별 파일**만 받는다(CLAUDE.md 「학교별 공고 파일」) */
  for (const f of perSchoolFiles(D('data/notices'))) {
    const j = readJson(f, {});
    for (const it of (j.items || [])) takeApp('notices', it, { boardTitle: it.boardTitle, title: it.title, hidden: it.hidden }, { where: it.school || j.school || '' });
  }
  /* ③ 재단·지자체 게시판 · ④ 대외활동·공모전 (숨긴 글은 앱에 안 나온다 · 마감이 지나 앱이 내린 활동은 세기만) */
  for (const it of (readJson(D('data/external.json'), {}).items || [])) takeApp('external', it, { title: it.title, hidden: it.hidden }, { where: it.host || '' });
  const acts = readJson(D('data/activities.json'), {}).items || [];
  const shown = shownActivities(acts, today);
  for (const it of acts) {
    if (it && it.url && !it.hidden && !shown.has(it)) { bump(skipped.closed, 'activities'); continue; }
    takeApp('activities', it || {}, { title: it && it.title, hidden: it && it.hidden }, { id: (it && it.id) || '', where: (it && (it.host || it.school)) || '' });
  }
  /* ⑤ 교내 소식 — 학교별 파일뿐(옛 통짜 파일 없음) · 사진 폴더(img)는 건너뛴다 */
  for (const f of perSchoolFiles(D('data/news'))) {
    const j = readJson(f, {});
    for (const it of (j.items || [])) takeApp('news', it, { title: it.title, hidden: it.hidden }, { where: it.school || j.school || '' });
  }
  /* ⑥ 층2 — 재단 홈페이지 주소뿐이라(KOSAF 상세는 POST 전용) 앱이 '재단 홈페이지'라 부르고 열지 않는다(세기만).
     바로잡은 원문(그 회차)이 있는 것만 연다 — 제목은 공고문 파일 제목 + 앱 이름(재단·사업) */
  for (const it of (readJson(D('data/kosaf-open.json'), {}).items || [])) {
    const fix = SL.linkFixFor(kosafAppItem(it));
    if (fix) {
      skipped.kosaf.fixed += 1;
      take('kosaf', fix.url, { kosafTitles: kosafTitles(it), nameOnly: !kosafAttachTitles(it).length }, { id: `kosaf-${it.code}`, where: it.org || '', fix: fix.src });
      continue;
    }
    skipped.kosaf.items += 1;
    if ((it.files || []).length) skipped.kosaf.withFiles += 1;
  }
  /* 수집 검수 후보 — 열지 않는다. 같은 사이트의 다른 글 제목으로만 쓴다(목록 판정 재료) */
  for (const it of (readJson(D('collector/candidates.json'), {}).items || [])) {
    const u = decodeUrlEntities(it.url);
    const t = expectTitles({ title: it.title })[0];
    if (t && /^https?:\/\//i.test(u)) siteTitles.push({ origin: originOf(u), dir: dirOf(u), title: t });
  }
  return { targets: [...byUrl.values()], skipped, siteTitles };
  }
}

/* 같은 사이트의 다른 글 제목 — 목록 판정(looksLikeList)의 재료.
   같은 게시판(경로 앞부분이 같은 것)을 먼저, 그다음 같은 사이트의 나머지. 이 글과 같은 제목은 뺀다
   (같은 글이 두 데이터에 실린 경우 '다른 글'로 세면 멀쩡한 상세를 목록이라 한다).
   siteTitles(열지 않는 글의 제목 — gatherTargets)도 같은 규칙으로 섞는다. */
export function otherTitlesFor(target, targets, siteTitles = [], cap = 80) {
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
  for (const m of siteTitles) if (m.origin === target.origin) push(m.title, (m.dir || '') === d ? near : far);
  return near.concat(far).slice(0, cap);
}

/* 이번 실행에 열 순서.
   tier 0 — 처음 보는 정식 등록(학생이 신청하러 누르는 곳)  1 — 처음 보는 나머지
        2 — 한 번 본 문제(앞선 날 · 오늘 다시 보면 '다른 날 두 번'이 되어 확정)
        3 — 확정된 문제(풀렸는지 — 오래 안 본 것부터)  4 — 나머지(오래 안 본 것부터)
   🔴 여는 순서는 **2 → 0 → 1 → 3 → 4** (2026-10-03 리뷰 LC-4) — 한 번 본 문제를 다시 여는 것이 앱 글자를 바꾸는 일이다.
      처음 보는 링크 뒤에 두면 사이트 상한(8)에 밀려 링크가 많은 학교(광운 63건)는 확정까지 여드레가 걸렸다.
   오늘 이미 본 것은 다시 열지 않는다(같은 날 두 번은 한 번으로 센다 — nextState).
   opts: { perHost(기본 8), max(기본 400), used(사이트별로 이미 연 수), skip(오늘 이미 연 주소) } — 한 사이트를 몰아치지 않게 사이트마다 상한. */
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
  const ORDER = { 2: 0, 0: 1, 1: 2, 3: 3, 4: 4 };
  rows.sort((a, b) => (ORDER[a.tier] - ORDER[b.tier]) || (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0) || (a.i - b.i));
  /* opts.used — 같은 실행의 원문 후보 확인(0번 차례)이 이미 연 사이트별 수 · 사이트 상한에 함께 센다
     opts.skip — 오늘 이미 연 주소(후보 확인이 연 것) — 같은 날 같은 주소를 두 번 두드리지 않는다 */
  const perCount = new Map(opts.used instanceof Map ? opts.used : []);
  const skip = opts.skip instanceof Set ? opts.skip : new Set();
  const out = [];
  for (const r of rows) {
    if (out.length >= max) break;
    if (skip.has(r.t.url)) continue;
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

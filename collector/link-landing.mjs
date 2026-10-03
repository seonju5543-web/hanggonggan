/* 원문 링크 착지 판정 — '학생이 이 주소를 새 탭으로 열면 그 공고가 뜨는가' (한 곳 · 2026-10-03 신설)
   ─────────────────────────────────────────────────────────────────────────────
   쓰는 곳: collector/link-check.mjs(원문 링크 확인 로봇 — 앱이 보여 주는 모든 링크를 돈다).
   판정만 한다 — **주소를 고치지 않는다.** (2026-10-03 사고: 링크 사냥꾼 순찰이 잡티 섞인 제목으로
   멀쩡한 원문 주소를 '제목 불일치'로 보고 게시판 목록 표식으로 덮어써, 그날 멀쩡하던 정식 등록 5건
   (항공대 3 · 건국대 · 부경대)이 목록으로 바뀌었다(같은 날 바뀐 고려 3건은 원래 목록 주소였다). 판정하는 쪽이 고치기까지 하면 오판 한 번이 곧 데이터 손상이다.)

   판정 (VERDICTS):
     post  — 그 공고 화면이다            list  — 게시판 목록이다(글 번호를 무시하고 목록을 준다 등)
     home  — 사이트 첫 화면이다           login — 로그인을 요구한다
     gone  — 열리지 않는다(404·410)       other — 읽었는데 그 공고가 아니다
     unread — 판정할 수 없다(망 오류·5xx·껍데기 화면) — 🔴 '문제'로 세지 않는다

   🔴 판정 원칙 (이 저장소가 겪은 오판에서 나온 것):
     ① 제목 먼저, 로그인 벽은 나중 — 페이지 머리의 회원 로그인 상자(비밀번호 칸) 때문에 멀쩡한 공고가
        '로그인 요구'가 되던 것(전북대·부경대 실측). 제목이 보이면 로그인 벽이 아니다.
     ② 목록 판정에는 **같은 사이트의 다른 글 제목**이 필요하다 — 빈 목록을 넘기면 목록을 영영 못 알아본다
        (순찰이 `verify(url, title, [])` 로 불러 목록 41건을 '통과'시켰다).
     ③ 제목 후보는 여럿이다 — 게시판 원제목(boardTitle)·앱 이름(name)·피드 제목(title). 게시판 행에서 딸려 온
        `학생지원팀 2026-09-02 1,076` 같은 꼬리는 뗀다(stripRowTail) — 이 꼬리 때문에 멀쩡한 링크가 떨어졌다.
     ④ 껍데기(글자가 거의 없는 화면)는 판정 불가 — 막혔을 때 오는 화면을 '다른 글'로 몰지 않는다(동국대 12건).
     ⑤ 한 번 본 것으로 앱 글자를 바꾸지 않는다 — **다른 날 두 번** 같은 문제를 봐야 확정(nextState).
   ───────────────────────────────────────────────────────────────────────────── */
import { sameTitle, titleFingerprint, titleCore, looksLikeList, looksLikeLoginWall } from './detail-url.mjs';
import { cleanTitle } from './clean-title.mjs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
/* 앱과 같은 파일 — 주소 꼴·기호 되돌리기·열쇠를 베끼지 않는다 */
const SL = require('../source-link.js');
export const { decodeUrlEntities, linkShape } = SL;

export const VERDICTS = ['post', 'list', 'home', 'login', 'gone', 'other', 'unread'];
export const BAD = SL.LINK_BAD;   // ['list','home','login','gone','other'] — 앱이 아는 문제 종류와 한 벌

/* 게시판 행에서 제목에 딸려 온 꼬리 — `… 안내 학생지원팀 2026-09-02 1,076` · `… 2026.09.02 조회 12` · `… N` */
export function stripRowTail(t) {
  return cleanTitle(t)
    .replace(/\s+[가-힣A-Za-z]{2,12}\s+20\d{2}[-./]\d{1,2}[-./]\d{1,2}\.?(\s+[\d,]+)?\s*$/, '')
    .replace(/\s+20\d{2}[-./]\d{1,2}[-./]\d{1,2}\.?(\s+[\d,]+)?\s*$/, '')
    .replace(/\s+N\s*$/, '')
    .replace(/\s+/g, ' ').trim();
}

/* 이 항목의 제목 후보 — 겹치는 것은 하나로 */
export function expectTitles(item) {
  const it = item || {};
  const out = [];
  for (const t of [it.boardTitle, it.title, it.name]) {
    const s = stripRowTail(t || '');
    if (s && !out.some((x) => titleFingerprint(x) === titleFingerprint(s))) out.push(s);
  }
  return out;
}

const fp = (s) => String(s || '').replace(/[\s .,·ㆍ~〜'"“”‘’!?()[\]{}<>:;|/\\_+\-*&#%]/g, '').toLowerCase();

/* 제목이 화면 어디에 있나 — 'strong'(창 제목·h1~h3·og:title) · 'weak'(본문 어딘가) · 'none'
   본문 어딘가에만 있으면 목록일 수 있다(목록에도 그 제목이 있다) — 그래서 두 단계로 나눈다. */
/* 제목 자리(창 제목·머리글)가 그 공고 제목인가 — **머리글이 제목을 품거나, 제목의 거의 전부일 때만**.
   🔴 (2026-10-03 리뷰 LC-2) sameTitle 은 '짧은 쪽이 긴 쪽에 들어 있으면 같다'라서, 재단 홈페이지의 창 제목
      `관정이종환교육재단` 이 공고 제목 `2026학년도 관정이종환교육재단 장학생 선발 공고` 안에 들어 있다는 이유로
      홈페이지·없는 글 화면이 '제목 자리에 그 공고 제목'(post)이 됐다 — 이번 사고의 바로 그 모습이다. */
export function headMatches(title, head) {
  const x = titleFingerprint(title);
  const y = titleFingerprint(head);
  if (x.length < 6 || !y) return false;
  if (y.includes(x)) return true;                                       // 머리글이 제목을 통째로 품는다
  return x.includes(y) && y.length >= Math.max(8, Math.ceil(x.length * 0.7));   // 머리글이 제목의 거의 전부(잘린 제목)
}
export function titleEvidence({ titles, docTitle, headings, text }) {
  const heads = [docTitle || '', ...(headings || [])].filter(Boolean);
  const body = fp(text);
  /* (리뷰 F2) 제목 쪽은 titleFingerprint 로 날짜·[머리말]·조회수를 떼는데 본문은 fp 로만 다듬어, 제목에 날짜가 든 공고
     (`… 봄내장학생 선발 안내 (2026.09.28.(월) ~ 2026.10.07.(수))`)는 본문에 그대로 있어도 못 찾았다 → 같은 손질로도 본다. */
  const bodyT = titleFingerprint(text);
  let weak = false;
  for (const t of titles || []) {
    if (heads.some((h) => headMatches(t, h))) return 'strong';
    const k = titleFingerprint(t);
    if (k.length >= 8 && [body, bodyT].some((b) => b.includes(k) || (k.length >= 24 && b.includes(k.slice(0, 24))))) weak = true;
    const core = titleCore(t);
    if (!weak && core.length >= 6 && body.includes(fp(core))) weak = true;
  }
  return weak ? 'weak' : 'none';
}

const POST_MARK = /등록일|작성일|작성자|조회수|조회\s*\d|첨부|이전\s?글|다음\s?글|게시일/;

/* 한 번 열어 본 결과 → 판정.
   obs = { requestedUrl, finalUrl, status, error, docTitle, headings, text, hasPassword, titles, otherTitles } */
export function judgeLanding(obs) {
  const o = obs || {};
  if (o.error) return { v: 'unread', why: `열기 실패: ${String(o.error).split('\n')[0].slice(0, 60)}` };
  const st = Number(o.status || 0);
  /* decisive — 막힘으로는 생기지 않는 증거(404·410 · 401 · 첫 화면으로 돌려보냄). hostGuard 가 막힘 의심으로 지우지 않는다(리뷰 LC-1) */
  if (st === 404 || st === 410) return { v: 'gone', why: `HTTP ${st}`, decisive: true };
  if (st === 401) return { v: 'login', why: 'HTTP 401(로그인 요구)', decisive: true };
  if (!st || st >= 500 || st === 403 || st === 429) return { v: 'unread', why: st ? `HTTP ${st}` : '응답 없음' };
  if (st >= 400) return { v: 'gone', why: `HTTP ${st}` };

  const text = String(o.text || '');
  const compact = text.replace(/\s/g, '');
  const ev = titleEvidence({ titles: o.titles, docTitle: o.docTitle, headings: o.headings, text });
  const listy = looksLikeList(text, o.otherTitles || []);
  /* 첫 화면 꼴 — index·main 파일('home')과 맨 도메인('root') 둘 다. 화면 이름은 root 를 보통 주소로 두지만(공모전 전용 사이트),
     판정에서는 '첫 화면으로 돌려보내짐'·'첫 화면인데 제목이 없음'의 근거로 쓴다. */
  const homeish = (s) => s === 'home' || s === 'root';
  const reqShape = linkShape(o.requestedUrl);
  const finShape = o.finalUrl ? linkShape(o.finalUrl) : reqShape;

  /* 🔴 돌려보내진 증거가 제목보다 먼저다 (리뷰 LC-2) — 지워진 글·만료된 링크가 첫 화면으로 돌려보내지면 첫 화면의
     '최근 공지' 띠에 그 제목이 보여도 학생이 보는 것은 첫 화면이다. */
  if (homeish(finShape) && !homeish(reqShape)) return { v: 'home', why: '사이트 첫 화면으로 돌려보내짐', decisive: true };
  if (ev === 'strong') return { v: 'post', why: '제목 자리에 그 공고 제목' };
  if (ev === 'weak') return listy ? { v: 'list', why: '제목은 보이나 다른 공고 제목이 여럿 함께 보임(목록)' } : { v: 'post', why: '본문에 그 공고 제목' };

  /* 여기부터는 제목이 안 보인다 */
  /* 로그인 화면은 대개 짧다 — 껍데기 판정보다 먼저 본다(리뷰 LC-5: 짧은 SSO 화면이 '판정 불가'로 사라졌다) */
  if (o.hasPassword && looksLikeLoginWall(text, true)) return { v: 'login', why: '로그인 요구(제목이 안 보이고 비밀번호 칸)' };
  if (compact.length < 300) return { v: 'unread', why: `본문이 안 그려짐(${compact.length}자 — 판정 불가)` };
  if (looksLikeLoginWall(text, o.hasPassword)) return { v: 'login', why: '로그인 요구(제목이 안 보임)' };
  if (listy) return { v: 'list', why: '다른 공고 제목만 여럿 보임(목록)' };
  if (homeish(reqShape)) return { v: 'home', why: '사이트 첫 화면(제목이 안 보임)' };
  if (!POST_MARK.test(text)) {
    return compact.length >= 1500
      ? { v: 'other', why: '공고 화면이 아님(작성일·조회·첨부 표지가 없음)' }
      : { v: 'unread', why: '글 표지도 제목도 없음(판정 불가)' };
  }
  /* (리뷰 F2) 기대 제목이 **앱 이름뿐**(사람이 다듬은 `동산장학회 장학생 (이공계 새터민 대상)`)이면 게시판 제목과 글자가 달라
     '다른 글'을 단정할 근거가 없다 — 순찰이 같은 이유로 멀쩡한 주소를 덮던 사고를 확인 로봇이 되풀이하지 않게 판정 보류. */
  if (o.titlesFromNameOnly) return { v: 'unread', why: '다른 글로 보이나 기대 제목이 앱 이름뿐(판정 보류)' };
  return { v: 'other', why: '다른 글이 열림(제목 불일치)' };
}

/* 한 사이트에서 이번 실행의 '제목이 안 보이는' 문제가 절반을 넘으면(4건 이상) 우리가 막힌 것으로 본다.
   🔴 '제목은 보이는데 목록'(list + 근거 weak)은 막힘으로 생기지 않는다 — 가천·고려처럼 서버가 글 번호를
      무시하고 목록을 주는 게시판이 통째로 빠지면 안 되므로 그것은 그대로 둔다.
   🔴 (리뷰 LC-1) **결정적 증거**(404·410·401·첫 화면으로 돌려보냄 — decisive)도 막힘으로 생기지 않으니 빼고,
      비율은 **처음 보는 문제**(이번에 처음 나쁜 것 — wasBad 아님)로만 잰다. 그러지 않으면 순서(planQueue)가
      한 번 본 문제를 일부러 모아 다시 여는 날, 진짜 문제 다섯이 '막힘'으로 지워져 영영 확정되지 않았다.
      처음 보는 것이 넷이 안 되면, 이 사이트에서 연 것 **전부**가 제목 없는 문제일 때만 막힘으로 본다.
   results: [{ host, v, why, decisive?, wasBad? }] (판정 직후) → 같은 배열(막힘 의심분은 v:'unread') */
export function hostGuard(results) {
  const byHost = new Map();
  for (const r of results) {
    if (!byHost.has(r.host)) byHost.set(r.host, []);
    byHost.get(r.host).push(r);
  }
  const blindOf = (r) => BAD.includes(r.v) && !r.decisive && !/제목은 보이나/.test(r.why || '');
  for (const group of byHost.values()) {
    if (group.length < 4) continue;
    const fresh = group.filter((r) => !r.wasBad);
    const freshBlind = fresh.filter(blindOf);
    const blocked = fresh.length >= 4 ? freshBlind.length / fresh.length > 0.5 : group.every(blindOf);
    if (!blocked) continue;
    const blind = group.filter(blindOf);
    for (const r of blind) { r.v = 'unread'; r.why = `막힘 의심(이 사이트 ${blind.length}/${group.length}건이 제목 없음) · ${r.why}`; }
  }
  return results;
}

/* 장부 한 줄 갱신 — **다른 날 두 번 문제**를 봐야 확정(confirmed).
   🔴 (리뷰 LC-6) 문제의 **종류**는 날마다 바뀔 수 있다(목록 ↔ 다른 화면 — 목록 판정은 그날 우리가 아는 다른 글 제목 수에 달렸다).
      종류가 바뀌었다고 세기를 처음부터 하면 확정된 링크가 장부에서 빠졌다 들어오기를 되풀이하고, 같은 링크가 '새 문제'로 또 알려진다.
      그래서 **문제였던 날 수**를 세고(종류는 마지막 것), 그 공고가 뜬 날(post)만 처음으로 돌린다.
   prev = { v, at, n, confirmed, firstAt } | undefined · today = 'YYYY-MM-DD' */
export function nextState(prev, verdict, today, extra = {}) {
  const p = prev || {};
  const base = { ...p, lastAt: today, lastV: verdict.v, why: verdict.why, ...extra };
  if (verdict.v === 'unread') return base;                          // 모름 — 이전 판정을 지우지도 확정하지도 않는다
  if (verdict.v === 'post') return { ...base, v: 'post', at: today, n: 0, confirmed: false, firstAt: undefined };
  const wasBad = BAD.includes(p.v);
  const n = wasBad ? (p.at === today ? (p.n || 1) : (p.n || 1) + 1) : 1;
  return { ...base, v: verdict.v, at: today, n, firstAt: wasBad ? (p.firstAt || p.at || today) : today, confirmed: n >= 2 };
}

/* 앱이 받는 파일(data/link-check.json)의 bad — 확정된 문제 중 **지금 앱에 실린 주소**만 */
export function publishBad(state, liveUrls) {
  const live = new Set([...liveUrls].map(decodeUrlEntities));
  const bad = {};
  for (const [url, s] of Object.entries(state || {})) {
    if (!live.has(url) || !s || !s.confirmed || !BAD.includes(s.v)) continue;
    bad[url] = { v: s.v, at: s.at };
  }
  return Object.fromEntries(Object.entries(bad).sort(([a], [b]) => (a < b ? -1 : 1)));
}

export default { VERDICTS, BAD, stripRowTail, expectTitles, headMatches, titleEvidence, judgeLanding, hostGuard, nextState, publishBad };

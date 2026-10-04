/* 원문 후보 확인 — 찾아 온 주소가 **그 공고·그 회차의 원문**인지 가리는 곳 (순수 함수 · 2026-10-04 신설)
   ─────────────────────────────────────────────────────────────────────────────
   왜 생겼나 (2026-10-04 개발자 지시 *"원문 공고 링크를 최대한 어떻게든 찾을 방법"*):
     원문 링크 확인 로봇(collector/link-check.mjs)은 '이 링크가 그 공고로 가는가'를 보기만 했다. 고칠 주소를 찾는 일은
     사람·세션 몫이었는데, 찾은 주소를 **누가 어떤 잣대로 원문이라 인정하는가**가 없었다 — 웹 검색은 같은 제목의 남의 학교 글
     (서울교대 ↔ 서울대 학과 사이트)·지난 회차 공고(대하 2024-2 결과 발표)·신문 기사를 거의 늘 돌려준다(조사 2026-10-03).
     그래서 후보는 **사람·세션이 적고(collector/link-candidates.json)** · 로봇이 학생처럼 열어 보고 · 여기 잣대를 다 넘은 것만
     원문으로 올린다(data/link-check.json `fix` → 앱 source-link.js ⑥ 이 읽는다). 데이터 파일의 주소는 **고치지 않는다.**

   이 파일은 **불러와도 아무 일도 안 한다**(읽기만 · 쓰기 없음 — 관문이 불러 잰다). 일은 collector/link-check.mjs 의 0번 차례가 한다.
     · loadCandidates  — 후보 파일 읽기. 🔴 절대 던지지 않는다 — 잘못 적힌 줄은 리포트 줄이 된다(관문이 빨개지면 그날 자동 등록이 되돌려진다)
     · readIndexData · buildIndex — 앱이 받는 파일에서 '바로잡을 공고'(target)를 찾는 색인
     · twinCandidates  — 목록 표식 글과 **같은 사이트·같은 제목**의 글 주소가 우리 기록(수집 검수 후보·다른 피드)에 이미 있는가(인터넷 없이)
     · kosafMatches    — 층2 재단 장학금과 우리가 이미 모은 재단 게시판 글(data/external.json)을 짝짓기(인터넷 없이 · 하나만 · 차이 2 이상)
     · acceptCandidate — 열어 본 결과로 판정: verified(원문으로 올림) · suggest(사람 확인) · rejected · pending(못 엶 — 다시 본다)
     · publishFix      — 장부(collector/link-candidates-state.json)의 verified 를 앱이 받는 `fix` 로(계약: source-link.js ⑥)

   🔴 판정의 갈래(H·L·T·R·P·X·C)는 셋 중 하나만 어겨도 원문이 아니다:
     H 사이트 — 그 공고의 사이트(같은 호스트 또는 그 아래 · 점 경계)만. `.ac.kr` 밖에서 siteKey 로 넓히지 않는다
                (namgu.gwangju.kr → gwangju.kr · insong.dothome.co.kr → 공유 호스팅 · cafe.daum.net 은 그 카페 경로만)
     L 착지   — 판정은 link-landing.mjs judgeLanding **한 곳** · 제목 자리(ev 'strong')의 post 만 · 못 엶은 거절이 아니라 다시 본다
     T 제목   — 앱 이름뿐인 정식 등록은 사람 확인 · 후보에 적힌 제목은 우리 제목과 같을 때만 증거
     R 회차   — 층2 재단 코드는 해마다 그대로다: 마감·접수 시작일이 보여야 하고, 다른 해·결과 발표·반대 학기는 거절(가짜 공지 금지 · 원칙 6)
     P 사업   — 층2: 그 사업 이름(또는 공고문 파일 제목)이 보여야 · 같은 재단의 다른 사업 제목이면 거절
     X 기관   — 층2: 재단 이름이 화면에 있어야
     C 겹침   — 그 주소가 이미 다른 공고의 링크면 거절
   ───────────────────────────────────────────────────────────────────────────── */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { expectTitles, stripRowTail, headMatches } from './link-landing.mjs';
import { sameTitle, titleFingerprint, rowMatchesTitle, isDetailUrl } from './detail-url.mjs';
import { stripSessionId, siteKey } from './board-links.mjs';
import { urlKey, normTitle } from './url-key.mjs';

const require = createRequire(import.meta.url);
/* 앱과 같은 파일 — 주소 꼴·바로잡기 열쇠·회차를 베끼지 않는다 */
const SL = require('../source-link.js');
/* 🔴 extract-excerpts.mjs 는 불러오는 순간 본편(발췌 로봇)이 도는 파일이다 — activity-excerpts.mjs 와 같은 길로 부른다 */
process.env.EXCERPTS_AS_LIB = process.env.EXCERPTS_AS_LIB || '1';
const { extractDeadline } = await import('./extract-excerpts.mjs');

export const CAND_DS = ['registered', 'notices', 'news', 'external', 'activities', 'kosaf'];
export const CAND_SOURCES = ['search', 'board', 'admin', 'data', 'twin', 'match'];
export const MAX_AGE_DAYS = 60;          // 후보 파일의 줄은 60일이 지나면 읽지 않는다(지난 회차 후보가 쌓이지 않게)
export const RETRY_DAYS = [1, 3, 7, 7];  // 못 엶 → 1·3·7·7일 뒤 다시
export const MAX_TRIES = 5;              // 다섯 번 못 열면 사람 확인(suggest) — 거절하지 않는다(재단 사이트가 클라우드를 막는 일이 흔하다)
export const PER_HOST_CAND = 3;          // 한 사이트에서 한 실행에 여는 후보 수(게시판 열기 포함)

/* ── 주소 ─────────────────────────────────────────────────────────── */
const SESSION_ANY = /;jsessionid=[^?#/]*/gi;
export function normCandUrl(u) {
  return stripSessionId(SL.decodeUrlEntities(String(u == null ? '' : u).trim())).replace(SESSION_ANY, '');
}
export function hostOf(u) {
  try { return new URL(SL.decodeUrlEntities(u)).hostname.toLowerCase().replace(/^www\./, ''); } catch { return ''; }
}
const firstSeg = (u) => { try { return new URL(u).pathname.split('/').filter(Boolean)[0] || ''; } catch { return ''; } };
const isoOk = (s) => /^20\d{2}-\d{2}-\d{2}$/.test(String(s || ''));
export function addDays(iso, n) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
const daysBetween = (a, b) => Math.round((new Date(`${b}T00:00:00Z`) - new Date(`${a}T00:00:00Z`)) / 86400000);

/* 원문일 수 없는 곳 — 집계 사이트·신문 기사·블로그·위키·우리 저장소. 사람이 검색 결과를 그대로 붙여 넣는 일을 막는다 */
const BLOCK_HOSTS = ['github.com', 'githubusercontent.com', 'wikipedia.org', 'namu.wiki', 'linkareer.com', 'brunch.co.kr', 'blog.naver.com', 'tistory.com', 'news.naver.com', 'v.daum.net', 'campuspick.com', 'thinkcontest.com', 'wevity.com'];
const NEWS_ARTICLE = /\/news\/articleView\.(?:html|do)|\/articleView\.html\?idxno=/i;
/* 여럿이 함께 쓰는 사이트 — 호스트가 아니라 **첫 경로 조각(카페 이름)까지** 같아야 같은 곳이다 */
const SHARED_HOSTS = new Set(['cafe.daum.net', 'm.cafe.daum.net', 'cafe.naver.com', 'm.cafe.naver.com', 'band.us']);
const blockedHost = (h) => BLOCK_HOSTS.some((b) => h === b || h.endsWith(`.${b}`));

/* ── 후보 파일 읽기 ───────────────────────────────────────────────── */
/* collector/link-candidates.json = { v:1, note, items:[ { target:{ds,key}, also?, url | board, title?, source?, query?, by, addedAt, note?, trusted? } ] }
   ds: registered(정식 등록 id) · kosaf(층2 코드) · notices·news·external·activities(지금 보이는 주소 — 표식 그대로도 · 또는 "학교|제목")
   🔴 never throws — 잘못된 줄은 { i, why } 로 돌려준다(리포트에 그대로 싣는다). */
const str = (v, n = 300) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
export function candId(ds, key, url, board) {
  return `${ds}|${key}|${url ? url : `board:${board}`}`;
}
function checkOne(raw, today) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return '줄이 객체가 아님';
  const tg = raw.target;
  if (!tg || typeof tg !== 'object') return 'target 이 없음';
  const ds = str(tg.ds, 20);
  if (!CAND_DS.includes(ds)) return `target.ds 가 ${CAND_DS.join('·')} 중 하나가 아님`;
  let key = str(tg.key, 600);
  if (!key) return 'target.key 가 없음';
  if (ds === 'kosaf') key = key.replace(/^kosaf-/, '');
  if (ds === 'kosaf' && !/^\d{3,14}$/.test(key)) return 'kosaf 의 key 는 층2 코드(숫자)';
  if (!['registered', 'kosaf'].includes(ds) && /^https?:/i.test(key)) key = SL.decodeUrlEntities(key);
  const hasUrl = typeof raw.url === 'string' && raw.url.trim();
  const hasBoard = typeof raw.board === 'string' && raw.board.trim();
  if (!!hasUrl === !!hasBoard) return 'url 과 board 중 하나만 적어야 함';
  const u = normCandUrl(hasUrl ? raw.url : raw.board);
  if (!/^https?:\/\//i.test(u)) return '주소가 http(s) 가 아님';
  try { new URL(u); } catch { return '주소를 읽을 수 없음'; }
  const h = hostOf(u);
  if (blockedHost(h)) return `원문일 수 없는 사이트(${h} — 집계·블로그·위키·저장소)`;
  if (NEWS_ARTICLE.test(u)) return '신문 기사 주소(원문 공고가 아님)';
  if (hasUrl) {
    const shape = SL.linkShape(u);
    if (shape === 'marker') return '게시판 목록 표식(#n-) — 원문 주소가 아님';
    if (shape === 'listid' || SL.isListPlusId(u)) return '목록 주소에 글 번호만 붙인 꼴(목록이 열림)';
    if (ds === 'kosaf' && (shape === 'home' || shape === 'root')) return '첫 화면 주소 — 층2는 이미 재단 홈페이지를 보여 준다';
    if (!SL.fixUrlUsable(u)) return '원문으로 쓸 수 없는 주소 꼴';
  }
  const addedAt = str(raw.addedAt, 10);
  if (!isoOk(addedAt)) return 'addedAt(YYYY-MM-DD)이 없음';
  if (isoOk(today) && daysBetween(addedAt, today) > MAX_AGE_DAYS) return `${MAX_AGE_DAYS}일이 지난 후보`;
  const by = str(raw.by, 120);
  if (!by) return 'by(누가 적었나)가 없음';
  if (raw.trusted != null && typeof raw.trusted !== 'boolean') return 'trusted 는 true/false';
  const also = Array.isArray(raw.also) ? raw.also.map((x) => String(x).trim()).filter((x) => /^\d{3,14}$/.test(x) && x !== key) : [];
  if (raw.also != null && !Array.isArray(raw.also)) return 'also 는 층2 코드 목록';
  if (also.length && ds !== 'kosaf') return 'also 는 층2(kosaf) 후보에만';
  const source = CAND_SOURCES.includes(str(raw.source, 20)) ? str(raw.source, 20) : 'search';
  return {
    cid: candId(ds, key, hasUrl ? u : '', hasBoard ? u : ''),
    target: { ds, key }, also: [...new Set(also)],
    url: hasUrl ? u : '', board: hasBoard ? u : '',
    title: str(raw.title, 200), source, query: str(raw.query, 200), by, addedAt, note: str(raw.note, 300), trusted: raw.trusted === true,
  };
}
export function loadCandidates(json, { today = '' } = {}) {
  const ok = []; const bad = [];
  let items = null;
  try { items = json && typeof json === 'object' && Array.isArray(json.items) ? json.items : null; } catch { items = null; }
  if (!items) return { ok, bad: [{ i: -1, why: '파일 꼴이 아님({ v, items: [] } 이어야 함)' }] };
  const seen = new Set();
  items.forEach((raw, i) => {
    let got;
    try { got = checkOne(raw, today); } catch (e) { got = `읽지 못함(${String((e && e.message) || e).slice(0, 60)})`; }
    if (typeof got === 'string') { bad.push({ i, why: got }); return; }
    if (seen.has(got.cid)) { bad.push({ i, why: '같은 후보가 두 번 적힘' }); return; }
    seen.add(got.cid);
    ok.push(got);
  });
  return { ok, bad };
}

/* ── 층2 재단 장학금의 모양 · 제목 ──────────────────────────────────── */
/* 앱(app.js kosafAsScholarships)이 화면에 넘기는 모양 그대로 — 바로잡기 열쇠(id:kosaf-<코드>)·회차(deadline=due)를 앱과 같게 */
export function kosafAppItem(k) {
  const it = k || {};
  return { id: `kosaf-${it.code}`, name: `${it.org || ''} ${it.name || ''}`.trim(), sourceUrl: it.home || '', sourceKind: 'kosaf', deadline: it.due || null };
}
/* 공고문 파일 이름 → 게시판 글 제목 꼴. 신청서·서식 같은 파일은 제목이 아니다 */
const NOT_NOTICE_FILE = /신청서|서식|양식|동의서|추천서|계획서|자기소개서|증명|확인서|위임장|서약서|명세|목록|체크리스트/;
export function cleanAttachTitle(name) {
  const s = String(name || '')
    .replace(/\.(hwpx?|pdf|docx?|zip|jpe?g|png|xlsx?|txt)$/i, '')
    .replace(/\[(?:공고문?|붙임\s*\d*)\]|\((?:공고문?|붙임\s*\d*|최종|수정)\)/g, ' ')
    .replace(/^\s*(?:붙임|별첨)\s*\d*\s*[.)_-]?\s*/, '')
    .replace(/^\s*\d{1,2}\s*[.)]\s*/, '')
    .replace(/\((?:게시용[^)]*)\)|★|☆|_수정\d*|_최종/g, ' ')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ').trim();
  if (s.length < 8 || NOT_NOTICE_FILE.test(s) || !/공고|안내|모집|선발|장학/.test(s)) return '';
  return s;
}
export function kosafAttachTitles(k) {
  const out = [];
  for (const f of (k && k.files) || []) {
    const t = cleanAttachTitle(f && f.name);
    if (t && !out.some((x) => titleFingerprint(x) === titleFingerprint(t))) out.push(t);
  }
  return out;
}
/* 층2 공고의 기대 제목 — 공고문 파일 제목(대개 게시판 글 제목 그대로) 먼저, 그다음 앱 이름 */
export function kosafTitles(k) {
  const out = kosafAttachTitles(k);
  const nm = `${(k && k.org) || ''} ${(k && k.name) || ''}`.trim();
  if (nm && !out.some((x) => titleFingerprint(x) === titleFingerprint(nm))) out.push(nm);
  return out;
}
const ORG_NOISE = /\((?:재|사|주|복|사복)\)|재단법인|사단법인|사회복지법인|\(재단\)/g;
const ORG_REGION_HEAD = /^(?:서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)/;
export function orgCore(org) { return titleFingerprint(String(org || '').replace(ORG_NOISE, ' ')); }
export function programCore(name) {
  const s = titleFingerprint(String(name || '').replace(/\([^)]*\)/g, ' ').replace(/장학생|장학금|장학/g, ' '));
  return s.length >= 2 ? s : '';
}
/* 신청기간 칸 → { open, due } (재단이 적은 ISO 날짜 · due 는 KOSAF 마감이 우선) */
export function kosafRound(k) {
  const ds = String(((k && k.fields) || {})['신청기간'] || '').match(/20\d{2}-\d{2}-\d{2}/g) || [];
  const due = (k && k.due) || ds[ds.length - 1] || '';
  const open = ds.length >= 2 ? ds[0] : '';
  return due ? { open, due } : null;
}

/* ── 날짜 · 회차 ─────────────────────────────────────────────────── */
/* 글에 그 날짜가 보이나 — 2026. 10. 2. · 2026-10-02 · 2026년 10월 2일 · 26.10.02 · 10. 2.(금) · 9.14(월)부터 · ~ 10월 2일 */
export function dateShown(text, iso) {
  if (!isoOk(iso)) return false;
  const [y, m, d] = iso.split('-').map(Number);
  const s = String(text || '');
  if (new RegExp(`${y}\\s*[.\\-/년]\\s*0?${m}\\s*[.\\-/월]\\s*0?${d}(?!\\d)`).test(s)) return true;
  if (new RegExp(`(?<![\\d.])${String(y).slice(2)}\\s*\\.\\s*0?${m}\\s*\\.\\s*0?${d}(?!\\d)`).test(s)) return true;
  const md = `(?<![\\d.])0?${m}\\s*(?:\\.|월)\\s*0?${d}(?!\\d)\\s*(?:일|\\.)?`;
  if (new RegExp(`${md}\\s*(?:\\([월화수목금토일]\\)|부터|까지|[~〜])`).test(s)) return true;
  return new RegExp(`[~〜][^~〜\\n]{0,40}?${md}`).test(s);
}
const RESULT_WORD = /결과|합격|선정자|명단|발표/;
const yearsIn = (s) => (String(s || '').match(/(?<!\d)20\d{2}(?!\d)/g) || []).map(Number);
/* 반대 학기·반기 — 접수 시작 달과 어긋나는 말이 제목에 있으면 다른 회차다(송파 상반기 6월 ↔ 하반기 9월) */
function seasonClash(head, openIso) {
  if (!isoOk(openIso)) return '';
  const mo = Number(openIso.slice(5, 7));
  const h = String(head || '');
  if (/상반기/.test(h) && !/하반기/.test(h) && mo >= 8) return '상반기 공고인데 접수가 하반기';
  if (/하반기/.test(h) && !/상반기/.test(h) && mo <= 5) return '하반기 공고인데 접수가 상반기';
  if (/(?<!\d)1\s*학기|-1\s*\(|전기/.test(h) && !/2\s*학기|후기/.test(h) && mo >= 6 && mo <= 9) return '1학기(전기) 공고인데 접수가 2학기 무렵';
  if (/(?<!\d)2\s*학기|-2\s*\(|후기/.test(h) && !/1\s*학기|전기/.test(h) && (mo === 12 || mo <= 3)) return '2학기(후기) 공고인데 접수가 1학기 무렵';
  return '';
}
const seasonFits = (head, openIso) => {
  if (!isoOk(openIso)) return false;
  const mo = Number(openIso.slice(5, 7));
  return mo >= 6 && mo <= 11 ? /하반기|2\s*학기|후기/.test(head) : /상반기|1\s*학기|전기/.test(head);
};
/* 회차 판정 — { s: 'ok'|'fail'|'none', why } */
export function roundCheck({ round, deadline, expectTitles: want = [], head, text }) {
  const all = `${head || ''}\n${text || ''}`;
  if (round && round.due) {
    const dueY = Number(round.due.slice(0, 4));
    const ys = yearsIn(head);
    const okYears = [dueY, dueY + 1].concat(Number(round.due.slice(5, 7)) <= 2 ? [dueY - 1] : []);
    if (ys.length && !ys.some((y) => okYears.includes(y))) return { s: 'fail', why: `다른 해 공고(${ys.join('·')}) — 이번 회차 마감 ${round.due}` };
    if (RESULT_WORD.test(head || '') && !want.some((w) => RESULT_WORD.test(w))) return { s: 'fail', why: '결과·명단 발표 글' };
    const clash = seasonClash(head, round.open);
    if (clash) return { s: 'fail', why: clash };
    const dl = extractDeadline(all);
    if (dl === round.due || dateShown(all, round.due) || dateShown(all, round.open)) return { s: 'ok', why: '마감·접수 시작일이 보임' };
    if (dl && dl !== round.due) return { s: 'fail', why: `마감이 다름(글 ${dl} · 이번 회차 ${round.due})` };
    return { s: 'none', why: '회차를 가릴 날짜가 안 보임' };
  }
  const wantYears = [...new Set(want.flatMap(yearsIn))];
  const ys = yearsIn(head);
  if (wantYears.length && ys.length && !ys.some((y) => wantYears.includes(y))) return { s: 'fail', why: `다른 해 글(${ys.join('·')})` };
  if (isoOk(deadline)) {
    const dl = extractDeadline(all);
    if (dl === deadline || dateShown(all, deadline)) return { s: 'ok', why: '마감이 보임' };
    if (dl && dl !== deadline) return { s: 'fail', why: `마감이 다름(글 ${dl} · 우리 ${deadline})` };
  }
  return { s: 'none', why: '' };
}

/* ── 사이트 ─────────────────────────────────────────────────────────
   허락 항목 = { host, prefix? } — 같은 호스트이거나 **점 경계로** 그 아래(sub.host). prefix 가 있으면 첫 경로 조각까지 같아야. */
export function hostEntry(u) {
  const h = hostOf(u);
  if (!h) return [];
  if (SHARED_HOSTS.has(h)) { const seg = firstSeg(u); return seg ? [{ host: h, prefix: `/${seg}` }] : []; }
  const out = [{ host: h }];
  if (/\.ac\.kr$/.test(h)) { const k = siteKey(u); if (k && k !== h) out.push({ host: k }); }   // 학교는 한 도메인 아래 여러 사이트(student.snu.ac.kr ↔ snu.ac.kr)
  return out;
}
export function hostAllowed(url, allowed) {
  const h = hostOf(url);
  if (!h) return false;
  let p = '';
  try { p = new URL(SL.decodeUrlEntities(url)).pathname; } catch { return false; }
  return (allowed || []).some((a) => (a.prefix
    ? h === a.host && (p === a.prefix || p.startsWith(`${a.prefix}/`))
    : h === a.host || h.endsWith(`.${a.host}`)));
}
/* 공고문 사본 글자에 적힌 사이트 — 재단이 '우리 홈페이지 공지사항' 이라 적어 둔 곳(부안 buan.go.kr/injae 등 · 조사 2026-10-03). 남의 대문은 뺀다 */
const NOT_ORG_HOST = /(?:^|\.)(?:kosaf\.go\.kr|gov\.kr|naver\.com|daum\.net|google\.com|gmail\.com|hanmail\.net|nate\.com|kakao\.com|youtube\.com|instagram\.com|facebook\.com|nhis\.or\.kr|hometax\.go\.kr|minwon\.go\.kr|wetax\.go\.kr|w3\.org|microsoft\.com|hancom\.com)$/;
export function hostsInText(text) {
  const out = new Set();
  for (const m of String(text || '').matchAll(/(?:https?:\/\/|@|\bwww\.)?((?:[a-z0-9-]+\.)+(?:go\.kr|or\.kr|ac\.kr|co\.kr|re\.kr|ne\.kr|kr|com|net|org))(?![a-z0-9-])/gi)) {
    const h = m[1].toLowerCase().replace(/^www\./, '');
    if (h.split('.').length >= 2 && !NOT_ORG_HOST.test(h)) out.add(h);
  }
  return [...out];
}

/* ── 색인: 앱이 받는 파일 → 바로잡을 공고 ───────────────────────────── */
function rootDir(root) {
  if (root instanceof URL) return fileURLToPath(root);
  const s = String(root || '.');
  return s.startsWith('file:') ? fileURLToPath(s) : path.resolve(s);
}
const readJson = (f, fb) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return fb; } };
function perSchool(dir) {
  let names = [];
  try { names = fs.readdirSync(dir); } catch { return []; }
  return names.filter((f) => f.endsWith('.json') && f !== 'index.json').sort().map((f) => path.join(dir, f));
}
/* 읽기만 한다 — 같은 파일을 원문 링크 확인 로봇의 모으기(link-check-plan.mjs)도 읽는다 */
export function readIndexData(root) {
  const dir = rootDir(root);
  const J = (rel, fb = {}) => readJson(path.join(dir, rel), fb);
  const feed = (rel) => perSchool(path.join(dir, rel)).flatMap((f) => { const j = readJson(f, {}); return (j.items || []).map((it) => ({ ...it, school: it.school || j.school || '' })); });
  const kosaf = J('data/kosaf-open.json').items || [];
  const kosafTexts = {};
  for (const k of kosaf) {
    const d = path.join(dir, 'data/kosaf-files', String(k.code || ''));
    let names = [];
    try { names = fs.readdirSync(d).filter((f) => f.endsWith('.txt')); } catch { names = []; }
    kosafTexts[k.code] = names.map((f) => { try { return fs.readFileSync(path.join(d, f), 'utf8').slice(0, 200000); } catch { return ''; } }).join('\n');
  }
  const both = (j, k) => [...(j[k] || []), ...(j.parked || [])];
  const schools = J('collector/schools.json');
  const bt = J('collector/browser-targets.json');
  const ns = J('collector/news-sources.json');
  const as = J('collector/activity-sources.json');
  const boards = [
    ...both(schools, 'schools').map((s) => ({ school: s.school, urls: [s.boardUrl] })),
    ...both(bt, 'targets').map((s) => ({ school: s.school, urls: s.candidates || [] })),
    ...both(ns, 'sources').map((s) => ({ school: s.school, urls: [s.home, s.boardUrl, ...(s.candidates || []).map((c) => c && c.url)] })),
    ...both(as, 'sources').map((s) => ({ school: s.school, urls: [s.boardUrl] })),
  ].filter((b) => b.school);
  const es = J('collector/external-sources.json');
  return {
    registered: J('data/registered.json').items || [],
    notices: feed('data/notices'),
    news: feed('data/news'),
    external: J('data/external.json').items || [],
    activities: J('data/activities.json').items || [],
    kosaf,
    kosafTexts,
    externalSources: both(es, 'sources'),
    boards,
    pool: J('collector/candidates.json').items || [],
  };
}

const markerTitleOf = (u) => stripRowTail(SL.markerTitleOf(u) || '');
function feedTitles(it, raw) {
  const out = expectTitles({ boardTitle: it.boardTitle, title: it.title });
  const m = markerTitleOf(raw);
  if (m && !out.some((x) => titleFingerprint(x) === titleFingerprint(m))) out.push(m);
  return out;
}
/* 색인 — { targets, find({ds,key}), ownersOf(url), pool } */
export function buildIndex(data) {
  const d = data || {};
  const schoolHosts = new Map();
  const hostSchool = new Map();
  for (const b of d.boards || []) {
    for (const u of b.urls || []) {
      if (!u || !/^https?:/i.test(u)) continue;
      const es = hostEntry(u);
      if (!schoolHosts.has(b.school)) schoolHosts.set(b.school, []);
      schoolHosts.get(b.school).push(...es);
      for (const e of es) if (!hostSchool.has(e.host)) hostSchool.set(e.host, b.school);
    }
  }
  const schoolOfUrl = (u) => {
    const h = hostOf(u);
    for (const [host, school] of hostSchool) if (h === host || h.endsWith(`.${host}`)) return school;
    return '';
  };
  const targets = [];
  const byKey = new Map();
  const add = (t) => {
    t.fixKey = SL.fixKeys(t.appItem)[0] || '';
    t.allowed = t.allowed.filter((a, i, arr) => arr.findIndex((b) => b.host === a.host && (b.prefix || '') === (a.prefix || '')) === i);
    targets.push(t);
    const k = `${t.ds}|${t.key}`;
    if (!byKey.has(k)) byKey.set(k, t);
  };
  const schoolAllowed = (school, raw) => [...hostEntry(raw), ...(school ? schoolHosts.get(school) || [] : [])];

  for (const it of d.registered || []) {
    if (!it || !it.id || it.sourceKind === 'kosaf' || it.hidden) continue;
    const raw = SL.decodeUrlEntities(it.sourceUrl || '');
    const titles = expectTitles({ boardTitle: it.boardTitle, name: it.name });
    const m = markerTitleOf(raw);
    if (m && !titles.some((x) => titleFingerprint(x) === titleFingerprint(m))) titles.push(m);
    const school = ((it.eligibility || {}).schoolOnly) || schoolOfUrl(raw);
    /* 게시판 원제목이 없거나 앱 이름과 같으면 '앱 이름뿐' — 사람이 다듬은 이름으로는 원문을 단정하지 않는다(link-landing 리뷰 F2) */
    const nameOnly = !it.boardTitle || titleFingerprint(it.boardTitle) === titleFingerprint(it.name);
    add({ ds: 'registered', key: it.id, item: it, appItem: it, raw, titles, nameOnly, school, deadline: it.deadline || '', label: it.name || it.id, allowed: schoolAllowed(school, raw) });
  }
  for (const ds of ['notices', 'news', 'external', 'activities']) {
    for (const it of d[ds] || []) {
      if (!it || it.hidden || !it.url) continue;
      const raw = SL.decodeUrlEntities(it.url);
      const titles = feedTitles(it, raw);
      if (!titles.length) continue;
      const school = it.school || (ds === 'notices' || ds === 'news' ? schoolOfUrl(raw) : '');
      const allowed = schoolAllowed(school, raw);
      if (ds === 'external' || ds === 'activities') {
        for (const s of d.externalSources || []) {
          if (s && it.host && s.host === it.host) for (const u of [s.home, s.boardUrl]) if (u) allowed.push(...hostEntry(u));
        }
      }
      add({ ds, key: raw, item: it, appItem: it, raw, titles, nameOnly: false, school, deadline: it.deadline || '', label: titles[0], org: it.host || '', allowed });
      if (it.id && !byKey.has(`${ds}|${it.id}`)) byKey.set(`${ds}|${it.id}`, targets[targets.length - 1]);   // id 가 있는 피드 글(공공 API 활동 등)은 id 로도 찾는다
    }
  }
  const kosaf = d.kosaf || [];
  const fileKeys = (k) => kosafAttachTitles(k).map(titleFingerprint);
  for (const k of kosaf) {
    if (!k || !k.code) continue;
    const appItem = kosafAppItem(k);
    const raw = SL.decodeUrlEntities(k.home || '');
    const homeHost = hostOf(raw);
    const allowed = [...hostEntry(raw)];
    for (const s of d.externalSources || []) {
      if (s && s.home && homeHost && hostOf(s.home) === homeHost) for (const u of [s.home, s.boardUrl]) if (u) allowed.push(...hostEntry(u));
    }
    for (const o of kosaf) if (o !== k && o.org === k.org && o.home) allowed.push(...hostEntry(o.home));   // 같은 재단의 다른 사업이 적은 더 정확한 홈페이지(춘향 scholar.namwon.go.kr 등)
    for (const h of hostsInText((d.kosafTexts || {})[k.code])) allowed.push({ host: h });
    const mine = fileKeys(k);
    const sameNotice = (o) => o !== k && o.org === k.org && o.due === k.due && fileKeys(o).some((f) => mine.includes(f));
    const attachTitles = kosafAttachTitles(k);
    add({
      ds: 'kosaf', key: String(k.code), item: k, appItem, raw, titles: kosafTitles(k), nameOnly: !attachTitles.length, school: '',
      deadline: k.due || '', label: appItem.name, org: k.org || '', orgCore: orgCore(k.org), program: k.name || '', programCore: programCore(k.name),
      attachTitles, round: kosafRound(k), allowed,
      alsoCodes: kosaf.filter(sameNotice).map((o) => String(o.code)),
      siblings: kosaf.filter((o) => o !== k && o.org === k.org && !sameNotice(o)).map((o) => programCore(o.name)).filter(Boolean),
    });
  }
  /* 같은 주소를 쓰는 공고들 — 겹침(C) 판정 */
  const owners = new Map();
  for (const t of targets) {
    const u = t.ds === 'kosaf' ? '' : t.raw;
    if (!u || !/^https?:/i.test(u) || /#n-/.test(u)) continue;
    const k = urlKey(u);
    if (!owners.has(k)) owners.set(k, []);
    owners.get(k).push(t);
  }
  const findFeed = (ds, key) => {
    const hit = byKey.get(`${ds}|${key}`);
    if (hit) return hit;
    const bar = key.indexOf('|');
    if (bar < 0 || /^https?:/i.test(key)) return null;
    const school = key.slice(0, bar).trim(); const title = key.slice(bar + 1).trim();
    const same = targets.filter((t) => t.ds === ds && (t.school || '') === school);
    const exact = same.filter((t) => t.titles.some((x) => normTitle(x) === normTitle(title)));
    if (exact.length) return exact[0];
    const loose = same.filter((t) => t.titles.some((x) => sameTitle(x, title)));
    return loose.length === 1 ? loose[0] : null;
  };
  /* 둘째 짝 찾기 재료 — 수집 검수 후보(앱이 안 받는 전량 기록) + 앱에 실린 글 주소 */
  const pool = [];
  for (const it of d.pool || []) if (it && it.url && it.title) pool.push({ url: normCandUrl(it.url), title: it.title, from: '수집 검수 후보' });
  for (const t of targets) if (t.ds !== 'kosaf' && /^https?:/i.test(t.raw) && SL.linkShape(t.raw) === 'page') pool.push({ url: t.raw, title: t.titles[0], from: t.ds });
  return {
    targets,
    find: ({ ds, key }) => (ds === 'registered' || ds === 'kosaf' ? byKey.get(`${ds}|${String(key).replace(/^kosaf-/, '')}`) || null : findFeed(ds, String(key))),
    ownersOf: (u) => owners.get(urlKey(SL.decodeUrlEntities(u))) || [],
    pool,
  };
}

/* ── 둘째 짝(인터넷 없이) ───────────────────────────────────────────
   목록 표식(#n-)·목록+번호로 남은 학교 글 중, **같은 사이트·같은 제목**의 글 주소가 우리 기록에 이미 있는 것.
   (조사 2026-10-03: 표식 20건 중 9건이 수집 검수 후보에 진짜 주소를 갖고 있었다 — 서울교대 selectNttInfo ×4 · 국민 · 연세 · 가천.)
   🔴 목록+번호 꼴·표식·상세가 아닌 주소는 짝이 아니다 · 한 표식에 짝은 셋까지(열어 보고 판정은 acceptCandidate) */
export function twinCandidates(index, { today = '' } = {}) {
  const out = [];
  for (const t of index.targets) {
    if (!['registered', 'notices', 'news'].includes(t.ds)) continue;
    const shape = SL.linkShape(t.raw);
    if (shape !== 'marker' && shape !== 'listid') continue;
    const host = hostOf(t.raw);
    const seen = new Set();
    for (const p of index.pool) {
      if (seen.size >= 3) break;
      if (hostOf(p.url) !== host || p.url === t.raw || SL.linkShape(p.url) !== 'page' || SL.isListPlusId(p.url) || !isDetailUrl(p.url)) continue;
      if (!t.titles.some((w) => normTitle(w) === normTitle(p.title) || rowMatchesTitle(w, p.title))) continue;
      const k = urlKey(p.url);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push({ cid: candId(t.ds, t.key, p.url, ''), target: { ds: t.ds, key: t.key }, also: [], url: p.url, board: '', title: p.title, source: 'twin', query: '', by: `로봇(같은 사이트·같은 제목 — ${p.from})`, addedAt: today, note: '', trusted: false });
    }
  }
  return out;
}

/* ── 층2 ↔ 재단 게시판 글 짝짓기(인터넷 없이 · 조사 2026-10-03 §B.5) ─────────
   점수: 마감 = 이번 마감 +2 · 층2 홈 주소가 바로 그 글 +3 · 공고문 파일 제목 +2 · 사업 이름 +1 · 재단 이름 +1 · 마감 해 +1
         · 접수일이 제목에 +1 · 학기·반기가 맞음 +1 · 장학 낱말(재단 이름 빼고) +1 · 게시일이 접수 시작 45일 전~마감 사이 +1
   거절: 결과·명단 발표 · 다른 해 · 반대 학기 · **같은 재단의 다른 사업 이름만** 든 제목(음성 군민평생 ↔ 전입장학금)
   🔴 딱 하나 · 3점 이상 · 둘째와 2점 이상 차이 — 아니면 고르지 않는다(rowByCore 와 같은 '딱 하나' 원칙) */
const attachHit = (attach, title) => {
  const y = titleFingerprint(title);
  return attach.some((a) => {
    if (sameTitle(a, title)) return true;
    const x = titleFingerprint(a).replace(/(?:안내문|공고문|안내|공고)$/, '');
    return x.length >= 8 && y.includes(x);
  });
};
export function scoreKosafPost(t, post) {
  const title = String((post && post.title) || '');
  const r = t.round || {};
  const why = [];
  if (RESULT_WORD.test(title)) return { score: -1, why: ['결과·명단 발표'] };
  const ys = yearsIn(title);
  const dueY = Number(String(r.due || '').slice(0, 4));
  if (dueY && ys.length && !ys.some((y) => y === dueY || y === dueY + 1)) return { score: -1, why: [`다른 해(${ys.join('·')})`] };
  if (seasonClash(title, r.open)) return { score: -1, why: [seasonClash(title, r.open)] };
  const tf = titleFingerprint(title);
  const mineCore = t.programCore && tf.includes(t.programCore);
  if (!mineCore && (t.siblings || []).some((c) => c.length >= 2 && tf.includes(c))) return { score: -1, why: ['같은 재단의 다른 사업'] };
  let score = 0;
  const plus = (n, w) => { score += n; why.push(`${w} +${n}`); };
  const pdl = post.deadline || extractDeadline(String(post.deadlineHint || '')) || '';
  if (r.due && pdl === r.due) plus(2, '마감 같음');
  if (t.raw && SL.linkShape(t.raw) === 'page') {
    try {
      const a = new URL(t.raw); const b = new URL(SL.decodeUrlEntities(post.url));
      if (hostOf(t.raw) === hostOf(post.url) && a.pathname === b.pathname && a.search && urlKey(`x:${a.search}`) === urlKey(`x:${b.search}`)) plus(3, '층2 홈 주소가 바로 그 글');
    } catch { /* 못 읽는 주소 */ }
  }
  if (attachHit(t.attachTitles || [], title)) plus(2, '공고문 파일 제목');
  if (mineCore) plus(1, '사업 이름');
  if (t.orgCore && t.orgCore.length >= 3 && tf.includes(t.orgCore)) plus(1, '재단 이름');
  if (dueY && ys.includes(dueY)) plus(1, '마감 해');
  if (dateShown(title, r.open) || dateShown(title, r.due)) plus(1, '접수일');
  if (seasonFits(title, r.open)) plus(1, '학기·반기');
  if (/장학/.test(t.orgCore ? tf.split(t.orgCore).join('') : tf)) plus(1, '장학 낱말');
  if (isoOk(post.postedAt) && isoOk(r.due) && (!isoOk(r.open) || post.postedAt >= addDays(r.open, -45)) && post.postedAt <= r.due) plus(1, '게시일');
  return { score, why };
}
export function pickKosafPost(t, posts) {
  const scored = (posts || []).map((p) => ({ p, ...scoreKosafPost(t, p) })).filter((x) => x.score >= 0).sort((a, b) => b.score - a.score);
  if (!scored.length || scored[0].score < 3) return null;
  if (scored.length > 1 && scored[0].score - scored[1].score < 2) return null;
  return scored[0];
}
/* 재단 게시판 글 주소인가 — 상세 주소 판정(isDetailUrl)에 더해, 재단 사이트의 낯선 번호 칸(아산 `index.php?m_cd=32&b_id=2026…`)도 글로 본다
   (data/external.json 은 우리 재단 게시판 로봇이 **날짜 붙은 글 줄**에서만 뽑은 것이라 메뉴가 아니다 — board-links.mjs extractDatedRows) */
function looksLikePost(u) {
  if (isDetailUrl(u)) return true;
  try { return [...new URL(u).searchParams].some(([k, v]) => !/page|offset|limit|menu|m_cd|cate/i.test(k) && /^\d{3,}$/.test(String(v))); } catch { return false; }
}
export function kosafMatches(index, external, { today = '' } = {}) {
  const out = [];
  for (const t of index.targets) {
    if (t.ds !== 'kosaf' || !t.round) continue;
    const posts = (external || []).filter((p) => p && p.url && !p.hidden && hostAllowed(p.url, t.allowed)
      && SL.linkShape(p.url) === 'page' && looksLikePost(normCandUrl(p.url)));
    const best = pickKosafPost(t, posts);
    if (!best) continue;
    const url = normCandUrl(best.p.url);
    out.push({ cid: candId('kosaf', t.key, url, ''), target: { ds: 'kosaf', key: t.key }, also: t.alsoCodes || [], url, board: '', title: best.p.title, source: 'match', query: '', by: `로봇(재단 게시판 글과 짝 — ${best.why.join(' · ')})`, addedAt: today, note: '', trusted: false });
  }
  return out;
}

/* ── 판정에 넘길 기대 제목 ─────────────────────────────────────────
   후보에 적힌 제목(검색 결과 제목 등)은 **우리 제목과 같을 때만**(층2는 재단 이름이 들어 있을 때도) 증거다 —
   검색 결과 제목을 그대로 믿으면 남의 글 제목이 '제목 자리에 그 공고 제목'이 된다. 우리 짝짓기(match)가 고른 재단 글 제목과
   로봇이 재단 게시판 목록에서 점수로 고른 줄(picked)의 제목은 우리가 읽은 것이다. */
export function judgeTitles(t, cand) {
  const out = [...t.titles];
  const c = String((cand && cand.title) || '').trim();
  if (!c) return out;
  const fits = t.titles.some((w) => sameTitle(w, c))
    || (t.ds === 'kosaf' && ((t.orgCore && t.orgCore.length >= 3 && titleFingerprint(c).includes(t.orgCore)) || cand.source === 'match' || cand.picked));
  if (fits && !out.some((x) => titleFingerprint(x) === titleFingerprint(c))) out.push(stripRowTail(c));
  return out;
}

/* 겹침 — 그 주소가 이미 **제목이 다른** 다른 공고의 링크인가(층2는 같은 재단·같은 회차 묶음이면 괜찮다).
   여는 일 없이 잴 수 있어 로봇이 열기 전에 먼저 묻는다. owners = buildIndex().ownersOf(후보 주소) */
export function collisionOf(t, owners) {
  const others = (owners || []).filter((x) => x !== t && !(x.ds === t.ds && x.key === t.key))
    .filter((x) => !(t.ds === 'kosaf' && x.ds === 'kosaf' && x.org === t.org && x.deadline === t.deadline))
    .filter((x) => !x.titles.some((a) => t.titles.some((b) => sameTitle(a, b))));
  return others.length ? `다른 공고의 링크와 같은 주소(${others[0].label || others[0].key})` : '';
}

/* ── 판정 ───────────────────────────────────────────────────────────
   target: buildIndex 의 한 줄 · cand: 후보 · obs: 열어 본 것 · verdict: judgeLanding 결과(ev 포함) · ctx: { tries, owners }
   → { status, why, checks, alsoOk? } */
const V_WORD = { list: '목록이 열림', home: '첫 화면이 열림', login: '로그인을 요구함', gone: '열리지 않음', other: '다른 화면이 열림' };
export function acceptCandidate({ target, cand, obs, verdict, ctx = {} }) {
  const t = target || {}; const c = cand || {}; const o = obs || {}; const v = verdict || {};
  const checks = {};
  let status = 'verified'; let why = '';
  const reject = (k, w) => { checks[k] = 'fail'; if (status !== 'rejected') { status = 'rejected'; why = w; } };
  const soft = (k, w) => { checks[k] = 'weak'; if (status === 'verified') { status = 'suggest'; why = w; } };
  const pass = (k) => { if (!checks[k]) checks[k] = 'ok'; };

  /* C 겹침 — 다른 공고의 링크와 같은 주소(층2는 같은 재단·같은 회차 묶음이면 괜찮다) */
  const clash = collisionOf(t, ctx.owners);
  if (clash) reject('C', clash);
  else pass('C');

  /* 관리자가 열어 보고 넣은 후보 — 결정적 증거(404·401·첫 화면/목록으로 돌려보냄)만 막는다(재단 사이트는 클라우드를 자주 막는다) */
  if (c.trusted) {
    if (v.decisive && v.v !== 'post') return { status: 'rejected', why: `관리자 후보지만 ${V_WORD[v.v] || v.v}(${v.why})`, checks: { ...checks, L: 'fail' } };
    return { status: 'verified', why: `관리자가 넣은 주소 — 로봇이 본 것: ${v.v === 'post' ? '그 공고' : (v.why || v.v)}`, checks: { ...checks, A: 'ok' } };
  }
  if (status === 'rejected') return { status, why, checks };

  /* L 착지 */
  if (v.v === 'unread') {
    const tries = (Number(ctx.tries) || 0) + 1;
    return tries >= MAX_TRIES
      ? { status: 'suggest', why: `로봇이 ${tries}번 못 엶(${v.why}) — 사람이 열어 봐 주세요`, checks: { ...checks, L: 'unread' } }
      : { status: 'pending', why: `못 엶(${v.why}) — 다시 봅니다`, checks: { ...checks, L: 'unread' } };
  }
  if (v.v !== 'post') return { status: 'rejected', why: `${V_WORD[v.v] || v.v}(${v.why})`, checks: { ...checks, L: 'fail' } };
  if (v.ev === 'strong') pass('L'); else soft('L', '제목이 제목 자리가 아니라 본문에만 보임');

  const heads = [o.docTitle || '', ...(o.headings || [])].filter(Boolean);
  const want = judgeTitles(t, c);
  const headHit = heads.filter((h) => want.some((w) => headMatches(w, h)));
  const head = (headHit.length ? headHit : [o.docTitle || '']).join(' \n ');
  const text = String(o.text || '');
  const allFp = titleFingerprint(`${heads.join(' ')} ${text}`);

  /* H 사이트 — 돌려보내졌으면 닿은 곳으로 */
  const where = o.finalUrl || c.url;
  if (hostAllowed(where, t.allowed)) pass('H');
  else {
    const named = [t.orgCore, titleFingerprint(t.school || ''), titleFingerprint(t.org || '')].filter((x) => x && x.length >= 3);
    if (named.some((n) => heads.some((h) => titleFingerprint(h).includes(n)))) soft('H', `처음 보는 사이트(${hostOf(where)}) — 기관 이름은 보임 · 사람 확인`);
    else reject('H', `그 공고의 사이트가 아님(${hostOf(where)})`);
  }

  /* T 제목 — 정식 등록의 앱 이름은 사람이 다듬은 것이라 게시판 제목과 글자가 다르다(그것만으로는 원문을 단정하지 않는다).
     층2는 공고문 파일이 없어도 재단·사업·회차(R·P·X)를 따로 다 보므로 여기서 막지 않는다 */
  if (t.nameOnly && t.ds === 'registered') soft('T', '기대 제목이 앱 이름뿐 — 사람 확인');
  else pass('T');

  /* R 회차 */
  const rc = roundCheck({ round: t.ds === 'kosaf' ? t.round : null, deadline: t.deadline, expectTitles: want, head, text });
  if (rc.s === 'fail') reject('R', rc.why);
  else if (rc.s === 'ok') pass('R');
  else if (t.ds === 'kosaf') soft('R', rc.why || '회차를 가릴 날짜가 안 보임');
  else checks.R = 'n/a';

  let alsoOk;
  if (t.ds === 'kosaf') {
    /* P 사업 — 사업 이름이 보이거나 제목 자리가 공고문 파일 제목 · 제목 자리에 같은 재단의 **다른** 사업 이름만 있으면 거절 */
    const headFp = titleFingerprint(head);
    const attachHead = (t.attachTitles || []).some((a) => heads.some((h) => headMatches(a, h) || sameTitle(a, h)));
    /* X 기관 — 재단 이름(KOSAF 표기는 `광주남구장학회`, 공고문은 `(재)남구장학회` 처럼 지역 머리가 빠지기도 한다)이 화면에 있거나,
       제목 자리가 KOSAF 에 올라온 그 재단의 공고문 파일 제목일 때 */
    const orgShort = t.orgCore ? t.orgCore.replace(ORG_REGION_HEAD, '') : '';
    if (t.orgCore && t.orgCore.length >= 2 && !allFp.includes(t.orgCore) && !(orgShort.length >= 4 && allFp.includes(orgShort)) && !attachHead) reject('X', '재단 이름이 화면에 없음');
    else pass('X');
    const mine = t.programCore && allFp.includes(t.programCore);
    if (!(t.programCore && headFp.includes(t.programCore)) && (t.siblings || []).some((s) => s.length >= 2 && headFp.includes(s))) reject('P', '같은 재단의 다른 사업 글');
    else if (mine || attachHead) pass('P');
    else if (!t.programCore && !(t.attachTitles || []).length) checks.P = 'n/a';
    else soft('P', '사업 이름이 화면에 안 보임');
    /* 같은 공고문을 쓰는 다른 코드(남구 ×5 · 춘천 ×9) — 각자의 사업 이름이 보이거나 공고문 제목이 제목 자리일 때만 함께 */
    alsoOk = (c.also || []).filter((code) => {
      const a = ctx.alsoTargets && ctx.alsoTargets[code];
      if (!a || a.deadline !== t.deadline || a.org !== t.org) return false;
      return (a.programCore && allFp.includes(a.programCore)) || (a.attachTitles || []).some((x) => heads.some((h) => headMatches(x, h) || sameTitle(x, h)));
    });
  }
  const out = { status, why: why || (t.ds === 'kosaf' ? '그 재단·그 사업·이번 회차 공고로 확인' : '그 공고로 확인'), checks };
  if (alsoOk) out.alsoOk = alsoOk;
  return out;
}

/* ── 장부(collector/link-candidates-state.json) ──────────────────────
   열쇠 = 후보 id(cid) · { ds, key, url, board?, source, by, title?, firstAt, lastAt, tries, nextAt?, status, why, checks, final?, round?, verifiedAt?, decidedAt?, also? } */
export const FINAL = ['verified', 'suggest', 'rejected'];
export function roundOf(t) { return t && t.ds === 'kosaf' ? SL.itemRound(t.appItem) : ''; }
/* 오늘 열어 볼 후보인가 */
export function shouldOpen(entry, cand, today, round) {
  const e = entry;
  if (!e) return true;
  if (e.lastAt === today) return false;
  if (FINAL.includes(e.status)) {
    if (round && e.round && e.round !== round) return true;                         // 층2 회차가 바뀌었다 — 새 회차로 다시 본다
    /* 사람이 후보 줄을 다시 적었다(addedAt 이 판정한 날보다 뒤) — 로봇이 만든 후보(둘째 짝·층2 짝)는 날마다 새로 만들어져 해당 없음 */
    return !!(cand && !['twin', 'match'].includes(cand.source) && cand.addedAt && e.decidedAt && cand.addedAt > e.decidedAt);
  }
  return !e.nextAt || e.nextAt <= today;
}
export function nextCandState(prev, cand, res, today, extra = {}) {
  const p = prev || {};
  const fresh = FINAL.includes(p.status) && res.status !== p.status ? {} : p;   // 다시 보는 판정은 횟수를 새로 센다
  const tries = (fresh.tries || 0) + 1;
  const e = {
    ds: cand.target.ds, key: cand.target.key, url: cand.url || p.url || '', ...(cand.board ? { board: cand.board } : {}),
    source: cand.source, by: cand.by, ...(cand.title ? { title: cand.title } : {}),
    firstAt: p.firstAt || today, lastAt: today, tries,
    status: res.status, why: res.why, checks: res.checks || {},
    ...extra,
  };
  if (res.status === 'pending') e.nextAt = addDays(today, RETRY_DAYS[Math.min(tries - 1, RETRY_DAYS.length - 1)]);
  else { delete e.nextAt; e.decidedAt = today; }
  if (res.status === 'verified') e.verifiedAt = p.status === 'verified' && p.verifiedAt ? p.verifiedAt : today;
  if (res.alsoOk) e.also = res.alsoOk;
  if (cand.trusted) e.trusted = true;
  return e;
}

/* ── 앱이 받는 `fix` 로 (계약 — source-link.js ⑥) ───────────────────
   verified 만 · 공고가 아직 앱에 있고 · 지금 링크가 이미 원문(page)이 아니고 · 층2는 회차(마감)가 같고 · 고친 주소가 확정 문제가 아닐 때만.
   열쇠는 앱과 같은 fixKeys 의 첫째(정식 등록·층2 `id:` · 피드 `u:<지금 주소>` · id 가 있는 활동은 `id:`).
   bad = 이번 실행의 data/link-check.json bad(원래 주소의 확정 문제 포함). 🔴 source-link 의 모듈 상태를 쓰고 되돌린다. */
const SRC_RANK = { admin: 0, search: 1, board: 1, data: 1, twin: 2, match: 3 };
export function publishFix(candState, index, { bad = {} } = {}) {
  const fix = {}; const dropped = [];
  const entries = Object.entries(candState || {}).filter(([, e]) => e && e.status === 'verified' && e.url)
    .sort(([, a], [, b]) => ((b.trusted ? 1 : 0) - (a.trusted ? 1 : 0)) || ((SRC_RANK[a.source] ?? 1) - (SRC_RANK[b.source] ?? 1)) || String(a.verifiedAt || '').localeCompare(String(b.verifiedAt || '')));
  SL.setLinkChecks({ bad });
  try {
    for (const [cid, e] of entries) {
      const keys = [e.key, ...(e.ds === 'kosaf' ? (e.also || []) : [])];
      for (const key of keys) {
        const t = index.find({ ds: e.ds, key });
        const drop = (w) => dropped.push({ cid, ds: e.ds, key, url: e.url, why: w });
        if (!t) { drop('공고가 앱에서 내려감'); continue; }
        if (!t.fixKey) { drop('바로잡기 열쇠를 못 만듦'); continue; }
        if (SL.rawLinkKind(t.appItem) === 'page') { drop('지금 링크가 이미 원문으로 감 — 바꾸지 않음'); continue; }
        const round = roundOf(t);
        if (t.ds === 'kosaf' && String(e.round || '') !== round) { drop(`회차가 바뀜(확인 때 ${e.round || '없음'} · 지금 ${round || '없음'})`); continue; }
        const u = SL.decodeUrlEntities(e.url);
        if (!SL.fixUrlUsable(u)) { drop('원문으로 쓸 수 없는 주소 꼴'); continue; }
        if (bad[u]) { drop(`원문 링크 확인 로봇이 문제로 확정(${bad[u].v})`); continue; }
        if (fix[t.fixKey]) continue;
        fix[t.fixKey] = { url: u, at: e.verifiedAt || e.lastAt || '', src: 'robot', ...(t.titles[0] ? { title: t.titles[0] } : {}), ...(t.ds === 'kosaf' ? { round } : {}) };
      }
    }
  } finally {
    SL.setLinkChecks(null);
  }
  return { fix: Object.fromEntries(Object.entries(fix).sort(([a], [b]) => (a < b ? -1 : 1))), dropped };
}

export default {
  CAND_DS, loadCandidates, readIndexData, buildIndex, twinCandidates, kosafMatches, pickKosafPost, scoreKosafPost,
  acceptCandidate, collisionOf, judgeTitles, roundCheck, dateShown, hostAllowed, hostEntry, cleanAttachTitle, kosafTitles, kosafAppItem,
  shouldOpen, nextCandState, publishFix,
};

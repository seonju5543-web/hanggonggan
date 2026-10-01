/* ============================================================
   한대장 — 교내 소식 수집 로봇 (2026-09-30 · 개발자 지시 "사용자들 학교에 맞춘 교내 뉴스를 앱 내에 추가" · "로봇 신설")
   1) 학교 공지 게시판(collector/news-sources.json · boardUrl 있는 곳)의 목록 **1페이지**를 읽는다
   2) 장학 글(장학 피드 몫)·공모전·대외활동 글(대외활동 탭 몫)·옆 메뉴·파일 링크·결과 발표를 뺀 나머지를
      **제목 + 링크 + 수집일**로 담는다 — 상세를 읽지 않는다(발췌·마감 없음 · 원칙 8-1). 갈래는 news-kind.mjs 한 곳.
   3) 학교별 파일 data/news/<학교키>.json 로 발행한다(publish-notices.mjs · 이름 규칙은 match-engine noticeFileKey)
      → 앱 홈 「우리 학교 소식」. 폰은 제 학교 파일만 받는다. 알림은 울리지 않는다(notify-rules 는 이 파일을 모른다).

   🔴 장학 수집기(collect.mjs)와 **따로** 돈다 — 그 로봇의 8분 예산은 이미 꽉 차 있어(2026-09-30 실측 30/80 게시판)
      뉴스 게시판 44곳을 거기 넣으면 장학·활동 수집까지 느려진다. 제 워크플로(collect-news.yml)·제 예산·제 커서·제 장부.
   🔴 파일을 섞지 않는다 — notices.json 에 넣으면 알림이 '새 장학 공고'로 울고, activities.json 에 넣으면 활동 탭이 공지로 찬다.
   규칙은 harvest-budget.mjs(예산·시한·회전) · board-links.mjs(링크 읽기) · fetch-board.mjs(받기) 를 **불러 쓴다**.
   ============================================================ */
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { extractLinks, sameSite } from './board-links.mjs';
import { urlKey, dedupeNotices } from './url-key.mjs';
import { isAttachmentEntry } from './attachment-link.mjs';
import { activityKind } from './activity-kind.mjs';
import { newsKind, isNewsRow } from './news-kind.mjs';
import { canonUrl } from './canon-url.mjs';
import { robotsAllows } from './robots.mjs';
import { fetchBoard, netReason } from './fetch-board.mjs';
import { publishBySchool, dropUnserved } from './publish-notices.mjs';
import { makeBudget, rotateOrder, nextCursor, withDeadline, TIMED_OUT } from './harvest-budget.mjs';

const HERE = new URL('.', import.meta.url);
const require = createRequire(import.meta.url);
const { noticeFileKey } = require('../match-engine.js');

const cfg = JSON.parse(fs.readFileSync(new URL('news-sources.json', HERE), 'utf8'));

/* 장학 낱말 — collect.mjs 의 KEYWORDS 와 같아야 한다(관문 「수집 범위 감사」가 대조한다). 장학 글은 이 로봇이 싣지 않는다. */
const KEYWORDS = /장학|학자금|등록금 감면|학업장려|근로장학/;

/* ── 시간 예산 · 게시판별 절대 시한 · 순서 회전 — collect.mjs 와 같은 세 겹 (harvest-budget.mjs 한 곳) ──
   상세를 읽지 않으므로 게시판 하나는 요청 한 번(+robots) 이다. 예산 4분이면 44곳을 넉넉히 돈다(느린 학교가 시한을 채워도).
   ⚠️ 워크플로의 단계 상한(collect-news.yml 「소식 수집」)은 이 예산보다 커야 한다 — 관문 「교내 소식」이 대소관계를 잰다. */
const BUDGET_MS = Number(process.env.NEWS_BUDGET_MS || 4 * 60000);
const BOARD_HARD_MS = Number(process.env.NEWS_BOARD_HARD_MS || 45000);
const MIN_ROOM_MS = Number(process.env.NEWS_MIN_ROOM_MS || 15000);
const NEWS_FRESH_MAX = Number(process.env.NEWS_FRESH_MAX || 30);     // 게시판 하나에서 한 실행에 담는 새 글 상한
const NEWS_KEEP_DAYS = Number(process.env.NEWS_KEEP_DAYS || 30);      // 수집일로부터 이만큼 지나면 뺀다 (공지는 장학 공고보다 빨리 낡는다)
const NEWS_PER_SCHOOL = Number(process.env.NEWS_PER_SCHOOL || 40);    // 학교별 파일 한 장의 상한 (폰이 받는 크기)
const budget = makeBudget(BUDGET_MS);

const cursorPath = new URL('news-cursor.json', HERE);
let cursor = { next: 0 };
try { cursor = JSON.parse(fs.readFileSync(cursorPath, 'utf8')); } catch { /* 첫 실행 */ }
const seenPath = new URL('seen-news.json', HERE);
let seen = {};
try { seen = JSON.parse(fs.readFileSync(seenPath, 'utf8')); } catch { /* 첫 실행 */ }
const healthPath = new URL('news-health.json', HERE);
let health = {};
try { health = JSON.parse(fs.readFileSync(healthPath, 'utf8')); } catch { /* 첫 실행 */ }
/* 관리자가 숨긴 글 (news-config.json hideUrls) — 지우지 않고 hidden 표식을 붙인다(되살리기가 된다 · 활동 탭과 같은 규칙) */
let hideSet = new Set();
try { hideSet = new Set((JSON.parse(fs.readFileSync(new URL('news-config.json', HERE), 'utf8')).hideUrls || []).map(canonUrl)); } catch { /* 설정 없음 */ }

/* 지금 실려 있는 글 — 통짜 파일이 없다. 학교별 파일 전부를 읽어 합친다(발행도 그 폴더에 다시 쓴다). */
const NEWS_DIR = new URL('../data/news/', HERE);
const publishedFiles = [];   // { path, school } — 발행 뒤 글이 0건이 된 학교의 파일을 빈 파일로 되쓰는 데 쓴다
function loadPublished() {
  let files = [];
  try { files = fs.readdirSync(NEWS_DIR).filter((f) => /\.json$/.test(f) && f !== 'index.json'); } catch { return []; }
  const out = [];
  for (const f of files) {
    try {
      const doc = JSON.parse(fs.readFileSync(new URL(f, NEWS_DIR), 'utf8'));
      if (doc.school) publishedFiles.push({ path: new URL(f, NEWS_DIR), school: doc.school });
      out.push(...(doc.items || []));
    } catch { /* 깨진 파일은 이번 발행이 새로 쓴다 */ }
  }
  return out;
}

/* 목록 행이 진짜 링크가 아닌 게시판 — collect.mjs 의 BOARD_RULES 와 같은 꼴(kind json·dataId·onclick).
   지금은 비어 있다: 찾기 로봇이 못 읽은 학교(SPA·클릭형)가 리포트에 뜨면 그때 **실제로 열어 확인한 것만** 적는다. 주소를 유추하지 않는다. */
export const NEWS_BOARD_RULES = {};

const results = [];
const freshAll = [];
const boards = (cfg.sources || []).map((s) => ({ ...s }));
const boardLabel = (s) => (s.campus && s.campus !== '공통' ? `${s.school} ${s.campus}` : s.school);
const todayStr = () => new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);   // KST — 발행 색인·찾기 로봇·관리자와 같은 시계 (07:19 KST 실행이 어제 날짜를 찍지 않게)

/* 게시판 하나를 읽는다. `return` 은 이 게시판을 마치고 다음으로 간다는 뜻. */
async function harvestBoard(s, ctx = { dead: false }) {
  const name = boardLabel(s);
  if (!s.boardUrl) {
    results.push({ name, status: '⚙️ 게시판 주소 미설정' + (s.probe ? ' (찾기 로봇이 못 찾음 — 리포트 참조)' : ' (찾기 로봇이 다음 실행에 봅니다)'), items: [] });
    return;
  }
  /* robots.txt 가 막은 길이면 읽지 않는다 (공공·재단 게시판과 같은 규칙 · 파일이 없거나 못 받으면 읽어도 된다고 본다) */
  if (!(await robotsAllows(s.boardUrl))) {
    results.push({ name, status: '⛔ robots.txt 가 막아 둔 주소 — 읽지 않았습니다 (출처를 바꾸거나 보관하세요)', items: [] });
    return;
  }
  try {
    const rule = NEWS_BOARD_RULES[s.school];
    let rawLinks;
    if (rule && rule.kind === 'json') {
      const r = await fetchBoard(rule.api);
      if (!r.ok) throw new Error(`API HTTP ${r.status}`);
      const j = await r.json();
      const dig = (o, d = 0) => { if (Array.isArray(o)) return o; if (!o || typeof o !== 'object' || d > 2) return null; for (const k of ['list', 'data', 'content', 'result', 'items', 'rows']) { const hit = dig(o[k], d + 1); if (hit) return hit; } return null; };
      rawLinks = (dig(j) || []).map((x) => ({ title: String(x.title || x.subject || '').replace(/\s+/g, ' ').trim(), url: rule.detail(x.pkId ?? x.id ?? x.seq) })).filter((x) => x.title && !/undefined|null/.test(x.url));
    } else {
      const res = await fetchBoard(s.boardUrl);
      if (ctx.dead) return;
      if (!res.ok) { results.push({ name, status: `⚠️ 접속 실패 (HTTP ${res.status}) — 주소 수정 필요`, items: [] }); return; }
      const html = await res.text();
      if (rule && rule.kind === 'onclick') {
        rawLinks = [...html.matchAll(/<a\b[^>]*onclick\s*=\s*(["'])((?:(?!\1)[\s\S])*)\1[^>]*>([\s\S]*?)<\/a>/gi)].map((m) => { const id = (m[2].match(rule.fn) || [])[1]; return id ? { title: m[3].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(), url: rule.detail(id) } : null; }).filter((x) => x && x.title);
      } else if (rule && rule.kind === 'dataId') {
        rawLinks = [...html.matchAll(/data-id=["'](\d+)["'][^>]*>([\s\S]{0,300}?)<\/a>/g)].map((m) => ({ title: m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(), url: rule.detail(m[1]) })).filter((x) => x.title);
      } else {
        rawLinks = extractLinks(html, s.boardUrl);
      }
    }
    /* 무엇을 싣나 — 학교 사이트 안의 글 가운데 장학·활동·잡음을 뺀 것 (판정은 news-kind.mjs 한 곳) */
    const items = rawLinks
      .filter((i) => !rule ? sameSite(i.url, s.boardUrl) : true)
      .filter((i) => isNewsRow(i, { scholarship: KEYWORDS, activityKind, isAttachmentEntry }));
    const fresh = items.filter((i) => !seen[urlKey(i.url)]).slice(0, NEWS_FRESH_MAX);
    for (const it of fresh) {
      if (ctx.dead) return;
      const kind = newsKind(it.title);
      if (kind) it.kind = kind;
      it.school = s.school;
      it.campus = s.campus === '공통' ? '' : (s.campus || '');
      it.foundAt = todayStr();
      seen[urlKey(it.url)] = it.foundAt;
      freshAll.push(it);
    }
    if (ctx.dead) return;
    results.push({
      name,
      status: items.length ? `✅ 정상 (공지 글 ${items.length}건 감지 · 새 글 ${fresh.length})` : '🟡 접속은 되지만 공지 글을 찾지 못함 — 목록이 스크립트로만 그려지는 게시판이면 NEWS_BOARD_RULES 가 필요합니다',
      items: fresh,
    });
  } catch (e) {
    if (ctx.dead) return;
    results.push({ name, status: `⚠️ 오류 (${netReason(e)}) — 주소 확인 필요`, items: [] });
  }
}

const humanMs = (ms) => { const sec = Math.round(ms / 1000); return sec < 60 ? `${sec}초` : `${Math.floor(sec / 60)}분${sec % 60 ? ` ${sec % 60}초` : ''}`; };
const order = rotateOrder(boards.length, cursor.next || 0);
let doneCount = 0;
const skippedByBudget = [];
for (const idx of order) {
  const s = boards[idx];
  const name = boardLabel(s);
  if (!budget.hasRoom(MIN_ROOM_MS)) {
    skippedByBudget.push(name);
    results.push({ name, status: `⏰ 시간 예산(${humanMs(BUDGET_MS)}) 소진 — 이번 실행은 건너뜀, 다음 실행이 여기부터 이어서 봅니다`, items: [] });
    continue;
  }
  const t0 = Date.now();
  console.log(`[${Math.round(budget.elapsed() / 1000)}s] ▶ ${name}`);
  const ctx = { dead: false };
  const r = await withDeadline(harvestBoard(s, ctx), BOARD_HARD_MS);
  if (r === TIMED_OUT) {
    ctx.dead = true;
    results.push({ name, status: `⛔ 응답이 멈춰 ${humanMs(BOARD_HARD_MS)}에서 강제 중단 — 여기까지 주운 글만 저장합니다`, items: [] });
  }
  console.log(`[${Math.round(budget.elapsed() / 1000)}s] ◀ ${name} (${Math.round((Date.now() - t0) / 1000)}초)`);
  doneCount++;
}
cursor.next = nextCursor(boards.length, cursor.next || 0, doneCount);
cursor.updatedAt = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 16).replace('T', ' ');
fs.writeFileSync(cursorPath, JSON.stringify(cursor, null, 1));
fs.writeFileSync(seenPath, JSON.stringify(seen, null, 1));

/* 발행 — 새 글 + 실려 있던 글 → 보관 기한 → 중복 → 서비스 학교 → 숨김 표식 → 최근 수집 순 → 학교별 파일 */
const cutoff = new Date(Date.now() - NEWS_KEEP_DAYS * 86400000).toISOString().slice(0, 10);
let all = freshAll.concat(loadPublished());
all = all.filter((n) => n && n.url && n.school && (n.foundAt || '9999') >= cutoff);
all = all.filter((n) => !isAttachmentEntry(n));
all = dedupeNotices(all);
all = dropUnserved(all);
for (const n of all) { if (hideSet.has(canonUrl(n.url))) { n.hidden = true; } else if (n.hidden && !n.hiddenBy) { delete n.hidden; } }
all.sort((a, b) => String(b.foundAt || '').localeCompare(String(a.foundAt || '')));
const pub = publishBySchool(all, {
  dir: NEWS_DIR, perSchool: NEWS_PER_SCHOOL,
  note: '학교별 교내 소식 파일 색인 (data/news/). 앱은 match-engine.js newsFileFor(noticeFileKey) 로 자기 학교 파일을 바로 받는다 — 옛 통짜 파일로 물러나는 길은 없다. check-live.yml 이 이 색인의 학교 전부를 확인한다.',
});
/* 글이 하나도 안 남은 학교의 파일은 **빈 파일로 다시 쓴다** (리뷰 2026-10-01). publishBySchool 은 글이 있는 학교만 쓰고 옛 파일을 지우지 않는데,
   앱은 색인이 아니라 파일 이름으로 바로 받으므로 그대로 두면 30일 지난 글이 영영 보인다. */
{
  const alive = new Set(all.map((n) => n.school));
  const stamp = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
  for (const f of publishedFiles) {
    if (alive.has(f.school)) continue;
    fs.writeFileSync(f.path, JSON.stringify({ school: f.school, updatedAt: stamp, items: [] }, null, 1));
  }
}

/* 연속 실패 감시 — 장학 수집기와 같은 규칙(3회 연속이면 주소가 바뀐 것). 장부는 제 것(news-health.json — health.json 은 prune-health 가 schools.json 이름으로 고아를 지운다) */
const chronic = [];
for (const r of results) {
  if (/게시판 주소 미설정/.test(r.status) || /^⏰/.test(r.status)) continue;
  const h = health[r.name] || { fails: 0, lastOk: null };
  if (/⚠️|⛔/.test(r.status)) { h.fails += 1; if (h.fails >= 3) chronic.push(`${r.name} (${h.fails}회 연속) — ${r.status.replace(/^(?:⚠️|⛔)\s*/u, '')}`); } else { h.fails = 0; h.lastOk = todayStr(); }
  health[r.name] = h;
}
fs.writeFileSync(healthPath, JSON.stringify(health, null, 1));

/* 리포트 — 컨펌 대상이 아니다(제목+링크만 싣는다). 상태와 새 글, 사람 손이 필요한 것만 적는다. */
const known = boards.filter((s) => s.boardUrl).length;
const lines = [
  `## 🗞 교내 소식 수집 리포트 (${todayStr()})`, '',
  `새 글 **${freshAll.length}건** → 앱 홈 「우리 학교 소식」 (학교별 파일 data/news/ · ${pub.schools}개교 · 게시판 아는 학교 ${known}/${boards.length})`, '',
];
if (skippedByBudget.length) {
  lines.push(`⏰ **시간 예산(${humanMs(BUDGET_MS)})에 걸려 게시판 ${skippedByBudget.length}곳을 이번 실행에서 못 봤습니다** — ${skippedByBudget.slice(0, 8).join(' · ')}${skippedByBudget.length > 8 ? ' …' : ''}`);
  lines.push(`  → 이번에 본 게시판 ${doneCount}/${boards.length}곳 · 다음 실행은 **${boards[cursor.next] ? boardLabel(boards[cursor.next]) : '처음'}**부터 시작합니다.`, '');
} else {
  lines.push(`⏱ 게시판 ${doneCount}곳을 ${humanMs(budget.elapsed())}에 다 돌았습니다(예산 ${humanMs(BUDGET_MS)}).`, '');
}
if (chronic.length) {
  lines.push('### 🚨 연속 실패 — 게시판 주소 확인 필요');
  chronic.forEach((c) => lines.push(`- ${c}`));
  lines.push('');
}
const noRows = results.filter((r) => /^🟡/.test(r.status));
if (noRows.length) {
  lines.push(`### 🙋 열리지만 글을 못 읽는 게시판 ${noRows.length}곳 — 개발자에게 학생이 보는 공지 목록 주소를 요청합니다`);
  noRows.forEach((r) => lines.push(`- ${r.name}`));
  lines.push('');
}
const unset = results.filter((r) => /주소 미설정/.test(r.status));
if (unset.length) lines.push(`⚙️ 게시판 주소가 아직 없는 학교 ${unset.length}곳: ${unset.map((r) => r.name).join(' · ')} (찾기 로봇 리포트 collector/find-news-boards-report.md)`, '');
for (const r of results) {
  lines.push(`### ${r.name}`, `상태: ${r.status}`);
  for (const i of r.items) lines.push(`- ${i.kind ? `[${i.kind}] ` : ''}[${i.title}](${i.url})`);
  lines.push('');
}
lines.push('---', '⚙️ 설정: `collector/news-sources.json` · 발행: `data/news/<학교키>.json` · 로봇: `collector/collect-news.mjs` · 판정: `collector/news-kind.mjs`');
fs.writeFileSync(new URL('news-report.md', HERE), lines.join('\n'));

console.log(`news: ${freshAll.length} new; published ${all.length} items to ${pub.schools} school files`);
if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `new_count=${freshAll.length}\nneeds_human=${(chronic.length + noRows.length) ? '1' : '0'}\n`);
/* 저장을 마쳤으면 스스로 끝낸다 — 시한에 걸려 버려진 게시판의 소켓이 프로세스를 붙잡지 않게 (collect.mjs 와 같은 이유) */
process.exit(0);

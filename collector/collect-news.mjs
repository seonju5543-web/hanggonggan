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
import { sameSite, retitleStored } from './board-links.mjs';
import { NEWS_BOARD_RULES, newsRuleKey, rowsForBoard, verifyRuleDetail, needsDetailCheck, fetchesOwnList, collapseSamePost, newsHidden, newsDistinct, boardKey, dropRetiredBoards } from './news-board-rules.mjs';   // 클릭형 게시판 규칙 한 곳 (찾기 로봇과 같은 것)
import { urlKey, dedupeNotices, rekeyLedger } from './url-key.mjs';
import { isAttachmentEntry } from './attachment-link.mjs';
import { activityKind } from './activity-kind.mjs';
import { newsKind, isNewsRow, newsFloor, clearFuturePosted } from './news-kind.mjs';
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
const NEWS_MIN_KEEP = Number(process.env.NEWS_MIN_KEEP || 4);      // 학교마다 최근 이만큼은 기한이 지나도 남긴다 (홈 첫 화면 띠 카드 4장 · newsFloor)
const NEWS_POSTED_MAX_DAYS = Number(process.env.NEWS_POSTED_MAX_DAYS || 60);   // 게시일이 이보다 오래된 글은 싣지 않는다 — 상단 고정 공지가 2025년 글을 '소식'으로 올렸다(서울교대 7차 실측)
const postedCutoff = () => new Date(Date.now() - NEWS_POSTED_MAX_DAYS * 86400000).toISOString().slice(0, 10);
const budget = makeBudget(BUDGET_MS);

const cursorPath = new URL('news-cursor.json', HERE);
let cursor = { next: 0 };
try { cursor = JSON.parse(fs.readFileSync(cursorPath, 'utf8')); } catch { /* 첫 실행 */ }
const seenPath = new URL('seen-news.json', HERE);
let seen = {};
try { seen = JSON.parse(fs.readFileSync(seenPath, 'utf8')); } catch { /* 첫 실행 */ }
rekeyLedger(seen);   // 열쇠 규칙(urlKey)이 바뀌었으면 옛 열쇠를 새 열쇠로 잇는다 — 'post:' 열쇠는 그대로 (2026-10-05 점검 B6)
const healthPath = new URL('news-health.json', HERE);
let health = {};
try { health = JSON.parse(fs.readFileSync(healthPath, 'utf8')); } catch { /* 첫 실행 */ }
/* 관리자가 숨긴 글 (news-config.json) — 지우지 않고 hidden 표식을 붙인다(되살리기가 된다 · 활동 탭과 같은 규칙).
   글 번호가 있는 글은 **학교|글 번호**(hidePosts)로 숨긴다 — 목록 표식 주소는 같은 제목의 다른 글과 같아서, 주소로 숨기면 내년의 같은 제목 글까지 숨었다(리뷰 12차).
   주소(hideUrls)는 글 번호 없는 글과 진짜 상세 주소에만 쓴다. 판정은 news-board-rules.mjs newsHidden 한 곳(관리자 저장 경로와 같은 것). */
let hideCfg = {};
try { hideCfg = JSON.parse(fs.readFileSync(new URL('news-config.json', HERE), 'utf8')); } catch { /* 설정 없음 */ }

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

/* 목록 행이 진짜 링크가 아닌 게시판(동국·WISE·서울교대·전북)의 규칙은 news-board-rules.mjs **한 곳**에 있다 — 여기 베끼지 않는다.
   규칙 글은 첫 상세를 실제로 열어 제목을 확인한 뒤에만 싣는다(verifyRuleDetail). 주소를 유추하지 않는다. */

const results = [];
const freshAll = [];
const postIdByUrl = new Map();   // 이번에 본 글의 주소 열쇠 → 글 번호 (10차 전에 실린 글에도 번호를 달아 준다 · 발행 때 씀)
const srcByUrl = new Map();      // 이번에 본 글의 주소 열쇠 → 게시판 열쇠 (출처에서 뺀 게시판의 글을 발행 때 걷는다 · news-board-rules.mjs dropRetiredBoards)
/* 학교 하나에 게시판이 둘일 수 있다 (2026-10-03 · 서울대 일반공지는 장학 글이 많아 소식 2건 · 고려 세종 3건 → 학사공지를 더한다).
   둘째 게시판은 출처 줄의 extraBoards[{ boardUrl, label, evidence }] — 학교 규칙(NEWS_BOARD_RULES[학교])은 **첫 게시판에만** 맞는다.
   둘째 게시판의 규칙 열쇠는 '학교#이름'(newsRuleKey · 서강 행사특강) · 규칙이 없으면 보통 날짜 줄로 읽는다. 그 게시판 글에는 board(이름)를 달아
   썸네일 로봇이 같은 열쇠로 본문 API 를 찾는다. 같은 글이 두 게시판에 있어도 발행 때 주소·글 번호로 하나가 된다. */
const boards = (cfg.sources || []).flatMap((s) => [{ ...s }, ...(s.boardUrl ? (s.extraBoards || []) : [])
  .filter((e) => e && e.boardUrl)
  .map((e) => ({ school: s.school, campus: s.campus, boardUrl: e.boardUrl, label: e.label || '둘째 게시판', board: e.label || '둘째 게시판', extra: true }))]);
const ruleKey = newsRuleKey;   // 게시판 줄 { school, board } → 'school' 또는 'school#board'
const boardLabel = (s) => `${s.campus && s.campus !== '공통' ? `${s.school} ${s.campus}` : s.school}${s.extra ? ` · ${s.label}` : ''}`;
const todayStr = () => new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);   // KST — 발행 색인·찾기 로봇·관리자와 같은 시계 (07:19 KST 실행이 어제 날짜를 찍지 않게)

/* 게시판 하나를 읽는다. `return` 은 이 게시판을 마치고 다음으로 간다는 뜻. */
async function harvestBoard(s, ctx = { dead: false }) {
  const name = boardLabel(s);
  if (!s.boardUrl) {
    results.push({ name, status: '⚙️ 게시판 주소 미설정' + (s.probe ? ' (찾기 로봇이 못 찾음 — 리포트 참조)' : ' (찾기 로봇이 다음 실행에 봅니다)'), items: [] });
    return;
  }
  /* robots.txt 는 묻지 않는다 — 학교 게시판은 장학 수집기와 같은 정책(collector/robots.mjs 머리말 · 공공·재단 게시판만 묻는다).
     첫 실행에서 물었더니 10개교가 ⛔ 로 빠졌다(2026-10-01). */
  /* 이 게시판의 모든 요청(목록·API·상세 확인)은 게시판 시한 안에서만 기다린다 (재검증 2026-10-02 — 시한이 끊어도 요청은 뒤에서 계속 돌았다) */
  const fb = (url, o = {}) => fetchBoard(url, { ...o, deadlineAt: ctx.deadlineAt });
  try {
    const rule = NEWS_BOARD_RULES[ruleKey(s)];
    let html = '';
    /* json·post 규칙은 목록을 API 로 읽지만(rowsForBoard), 목록 표식(link:'list') 학교는 학생 링크가 그 화면이라 **화면도 열리는지** 본다
       (리뷰 2026-10-02: 화면이 404 가 돼도 API 만 살아 있으면 죽은 「게시판 목록 ↗」 이 계속 실렸다) */
    if (!fetchesOwnList(rule) || rule.link === 'list') {
      const res = await fb(s.boardUrl);
      if (ctx.dead) return;
      if (!res.ok) { results.push({ name, status: `⚠️ 접속 실패 (HTTP ${res.status}) — 주소 수정 필요`, items: [] }); return; }
      html = await res.text();
    }
    /* 🔴 글 줄만 — 페이지의 <a> 전부(extractLinks)를 쓰면 사이트 메뉴가 글로 담긴다(첫 실행 906건 사고 · 2026-10-01).
       날짜가 붙은 줄(<tr>·<li>…)의 링크만 글이고, 그 날짜가 게시일(postedAt)이다. 클릭형 게시판은 같은 눈에 규칙의 링크 풀이만 얹는다. */
    const rawLinks = await rowsForBoard(ruleKey(s), s.boardUrl, html, fb);
    if (ctx.dead) return;
    /* 무엇을 싣나 — 학교 사이트 안의 글 가운데 장학·활동·잡음을 뺀 것 (판정은 news-kind.mjs 한 곳) */
    /* 단계마다 수를 남긴다 — 0건일 때 '어디서 다 빠졌는지'를 리포트가 말하게 (서강 9차: 찾기는 30행인데 수집 0건 · 원인을 단정하지 않는다) */
    const onSite = rawLinks.filter((i) => sameSite(i.url, s.boardUrl));
    const recent = onSite.filter((i) => !i.postedAt || i.postedAt >= postedCutoff());   // 오래된 고정 공지 제외 (게시일을 아는 글만 잰다)
    const items = recent.filter((i) => isNewsRow(i, { scholarship: KEYWORDS, activityKind, isAttachmentEntry }));
    for (const i of items) srcByUrl.set(urlKey(i.url), boardKey(s.boardUrl));   // 이미 실린 글도 이번에 본 게시판으로 열쇠를 고쳐 단다
    /* 이미 본 글 — 주소 열쇠 또는 **게시판의 글 번호**(postId). 목록 표식(#n-제목) 주소는 제목을 다듬는 규칙이 바뀌면 달라져
       같은 글이 새 글로 다시 실렸다(경희 6건 두 번 · 리뷰 2026-10-02). 글 번호가 있으면 그것이 열쇠다. */
    const postKey = (i) => (i.postId ? `post:${s.school}:${i.postId}` : '');
    /* 이미 본 글에도 글 번호 장부를 채운다 (검증 2026-10-02: 10차 전에 본 글은 번호가 없어, 제목이 바뀌면 다시 두 번 실렸다).
       🔴 한 주소에 글 번호가 **하나뿐일 때만** 옮긴다 — 같은 제목의 글 둘(목록 표식 주소가 같다)이면 옛 장부가 어느 글 것인지 모른다(재검증 2026-10-02). */
    const idsByUrl = new Map();
    for (const i of items) if (i.postId) idsByUrl.set(urlKey(i.url), (idsByUrl.get(urlKey(i.url)) || new Set()).add(i.postId));
    /* 🔴 목록 표식(#n-제목) 주소의 장부는 **옮기지 않는다** (리뷰 12차) — 제목에서 만든 주소라 글을 가리키지 않는다. 옛 글이 목록에서 내려간 뒤
       같은 제목의 새 글이 오면 옛 글의 장부가 새 글 번호로 옮겨져 새 글이 영영 안 실렸다. 10차 전 목록 표식 장부는 11차 두 실행이 이미 옮겼다
       (seen-news.json 의 post:경희대학교 줄). 글 주소가 진짜 상세 주소인 학교는 주소가 곧 그 글이라 옮겨도 안전하다. */
    const isMarker = (i) => /#n-/.test(String(i.url || ''));
    for (const i of items) {
      if (!i.postId || isMarker(i) || idsByUrl.get(urlKey(i.url)).size !== 1) continue;
      postIdByUrl.set(urlKey(i.url), i.postId);
      if (seen[urlKey(i.url)] && !seen[postKey(i)]) seen[postKey(i)] = seen[urlKey(i.url)];
    }
    /* 글 번호가 있는 글은 글 번호로 새 글인지 가린다 — 목록 표식 주소로 보면 같은 제목의 새 글이 옛 글로 여겨져 영영 안 실린다(재검증 2026-10-02).
       진짜 상세 주소는 그 글 하나를 가리키므로 주소 장부도 같이 본다(옮기기 전에 목록에서 내려간 옛 글이 다시 오는 경우). */
    const fresh = items.filter((i) => (i.postId ? !seen[postKey(i)] && (isMarker(i) || !seen[urlKey(i.url)]) : !seen[urlKey(i.url)])).slice(0, NEWS_FRESH_MAX);
    /* 🔴 규칙으로 만든 상세 주소는 매번 첫 글 하나를 실제로 열어 제목을 확인한다 — 안 맞으면 이 게시판은 싣지 않는다(틀린 링크보다 0건). */
    if (needsDetailCheck(rule) && fresh.length) {
      const v = await verifyRuleDetail(fresh[0], { rule, boardUrl: s.boardUrl, others: items.map((i) => i.title), fetch: fb });
      if (ctx.dead) return;
      if (!v.ok) { results.push({ name, status: Date.now() >= ctx.deadlineAt - 200 ? timedOutStatus() : `⚠️ 클릭형 규칙(news-board-rules.mjs)의 상세 주소 확인 실패 — ${v.reason} · 이 게시판은 싣지 않음`, items: [] }); return; }
      /* verifyLast — 정찰이 상단 고정 줄만 눌러 본 규칙(경북)은 **마지막 글**(보통 줄)도 연다. 고정 줄과 보통 줄의 상세 주소 꼴이 다를 수 있다 */
      const last = fresh[fresh.length - 1];
      if (rule.verifyLast && fresh.length > 1 && last.url !== fresh[0].url) {
        const v2 = await verifyRuleDetail(last, { rule, boardUrl: s.boardUrl, others: items.map((i) => i.title), fetch: fb });
        if (ctx.dead) return;
        if (!v2.ok) { results.push({ name, status: Date.now() >= ctx.deadlineAt - 200 ? timedOutStatus() : `⚠️ 클릭형 규칙(news-board-rules.mjs)의 상세 주소 확인 실패(마지막 글 · 보통 줄) — ${v2.reason} · 이 게시판은 싣지 않음`, items: [] }); return; }
      }
    }
    for (const it of fresh) {
      if (ctx.dead) return;
      const kind = newsKind(it.title);
      if (kind) it.kind = kind;
      it.school = s.school;
      it.campus = s.campus === '공통' ? '' : (s.campus || '');
      if (s.board) it.board = s.board;   // 둘째 게시판 글 — 썸네일 로봇이 newsRuleKey 로 같은 규칙을 찾는다
      it.src = boardKey(s.boardUrl);     // 어느 게시판 글인가 — 출처에서 그 게시판을 빼면 다음 발행에서 빠진다(점검 news-4)
      it.foundAt = todayStr();
      seen[urlKey(it.url)] = it.foundAt;
      if (it.postId) seen[postKey(it)] = it.foundAt;
      freshAll.push(it);
    }
    if (ctx.dead) return;
    results.push({
      name,
      status: items.length ? `✅ 정상 (공지 글 ${items.length}건 감지 · 새 글 ${fresh.length})`
        /* 읽기는 했는데 실을 새 소식이 없는 것(오래된 글뿐·장학/활동 글뿐)은 개발자에게 주소를 달라고 할 일이 아니다 — ℹ️ (🙋·이슈 없음 · 리뷰 2026-10-02).
           글 링크가 모두 다른 사이트면 게시판을 잘못 잡았을 수 있어 🟡 로 남긴다. */
        : rawLinks.length && onSite.length ? `ℹ️ 읽힘 · 실을 새 소식 없음 (글 줄 ${rawLinks.length} · 학교 사이트 ${onSite.length} · ${NEWS_POSTED_MAX_DAYS}일 안 ${recent.length}) — ${
          !recent.length ? `게시일이 모두 ${NEWS_POSTED_MAX_DAYS}일보다 오래됨 (고정 공지만 보이거나 글이 드문 게시판)` : '모두 장학·활동·잡음 글이라 소식으로 싣지 않음'}`
        : rawLinks.length ? `🟡 글 줄 ${rawLinks.length} · 학교 사이트 0 — 글 링크가 모두 다른 사이트 (게시판을 잘못 잡았을 수 있음)`
        : (fetchesOwnList(rule) ? `🟡 규칙의 API 는 응답했지만 글을 못 읽음 — 응답의 글 칸(${rule.kind === 'post' ? 'JSON 의 번호·제목 칸 또는 HTML 행' : '번호·제목 칸'})이 바뀌었는지 news-board-rules.mjs 를 확인`
          : '🟡 접속은 되지만 날짜가 붙은 글 줄을 찾지 못함 — 목록이 스크립트로만 그려지거나 줄에 날짜가 없는 게시판이면 NEWS_BOARD_RULES 가 필요합니다'),
      items: fresh,
    });
  } catch (e) {
    if (ctx.dead) return;
    /* 게시판 시한에 걸려 놓은 요청은 주소·규칙 탓이 아니다 — '멈춤' 으로 적는다 (리뷰 12차: 시한을 요청에 넘기자 '주소 확인 필요' 로 잘못 적혔다) */
    if ((e && e.boardDeadline) || Date.now() >= ctx.deadlineAt - 200) { results.push({ name, status: timedOutStatus(), items: [] }); return; }
    const rule = NEWS_BOARD_RULES[ruleKey(s)];   // API 규칙의 실패는 주소가 아니라 규칙의 문제다 (리뷰 2026-10-01 · 원인을 단정하지 않는다)
    results.push({ name, status: fetchesOwnList(rule) ? `⚠️ 규칙의 API 오류 (${netReason(e)}) — news-board-rules.mjs 의 api·body 확인` : `⚠️ 오류 (${netReason(e)}) — 주소 확인 필요`, items: [] });
  }
}

const humanMs = (ms) => { const sec = Math.round(ms / 1000); return sec < 60 ? `${sec}초` : `${Math.floor(sec / 60)}분${sec % 60 ? ` ${sec % 60}초` : ''}`; };
const timedOutStatus = () => `⛔ 응답이 멈춰 ${humanMs(BOARD_HARD_MS)}에서 강제 중단 — 여기까지 주운 글만 저장합니다`;
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
  const ctx = { dead: false, deadlineAt: Date.now() + BOARD_HARD_MS - 1000 };   // 요청은 시한보다 1초 먼저 놓는다
  const r = await withDeadline(harvestBoard(s, ctx), BOARD_HARD_MS);
  if (r === TIMED_OUT) {
    ctx.dead = true;
    results.push({ name, status: timedOutStatus(), items: [] });
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
/* 실려 있던 글 제목에도 지금 청소를 입힌다(원칙 7 소급 · 2026-10-05 점검 news-7 — 항공대 「… 학생지원팀 2026-10-02 26」 · 영남 「9 2026학년도 …」 ·
   서울대 「… 첨부파일 있음」). 규칙은 board-links.mjs retitleStored 한 곳 · 제목만 고친다(주소·글 번호 그대로) · 새 글과 섞기 전에 */
let all = freshAll.concat(retitleStored(loadPublished()));
all = all.filter((n) => n && n.url && n.school);
all = all.filter((n) => !isAttachmentEntry(n));
/* 소급(원칙 7) — 실을지 규칙(news-kind)이 바뀌면 이미 실린 글도 같은 잣대로 다시 거른다. 2차 실행 뒤 메뉴·바닥글 잡음을 이것으로 걷었다. */
all = all.filter((n) => isNewsRow(n, { scholarship: KEYWORDS, activityKind, isAttachmentEntry }));
for (const n of all) if (!n.postId && postIdByUrl.has(urlKey(n.url))) n.postId = postIdByUrl.get(urlKey(n.url));   // 실려 있던 글에 이번에 본 글 번호를 단다
all = collapseSamePost(all);   // 같은 글이 제목 다듬기 차이로 두 번 실린 것을 합친다 (글 번호 · 목록 표식 제목의 분류 꼬리표 · 소급)
all = dedupeNotices(all, { distinct: newsDistinct });   // 글 번호가 다르면 같은 주소(목록 표식)라도 다른 글
all = dropUnserved(all);
/* 출처에서 뺀(바꾼) 게시판의 글은 뺀다 — 경북 포토뉴스 → 학사공지로 바꾼 뒤 포토뉴스 글이 바닥 4건 자리를 차지했다(점검 news-4).
   지금 게시판 = 출처 줄의 boardUrl + extraBoards(boards 목록 그대로). 열쇠 없는 옛 글은 판단하지 않는다. newsFloor 앞이라 빠진 글이 바닥 자리를 먹지 않는다 */
{
  const liveBoards = new Map();
  for (const b of boards) if (b.boardUrl) { if (!liveBoards.has(b.school)) liveBoards.set(b.school, new Set()); liveBoards.get(b.school).add(boardKey(b.boardUrl)); }
  all = dropRetiredBoards(all, liveBoards, srcByUrl);
}
for (const n of all) { if (newsHidden(n, hideCfg)) { n.hidden = true; } else if (n.hidden && !n.hiddenBy) { delete n.hidden; } }
/* 앞날 게시일은 비운다 — 바닥 4건·보관 기한·학교별 파일이 모두 정리된 값을 보게 (news-kind.mjs clearFuturePosted 한 곳 · 2026-10-05 점검 news-1 · KST 날짜) */
const futureCleared = clearFuturePosted(all, todayStr());
/* 보관 기한 — 수집일 30일 · 게시일 60일(소급 — 규칙이 바뀌면 실린 글도 같은 잣대). 단 학교마다 최근 NEWS_MIN_KEEP 건은 남긴다(newsFloor · 소식 0건 학교가 생기지 않게) */
const floor = newsFloor(all, NEWS_MIN_KEEP);
all = all.filter((n) => floor.has(n) || ((n.foundAt || '9999') >= cutoff && (!n.postedAt || n.postedAt >= postedCutoff())));
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
const mains = boards.filter((s) => !s.extra);
const known = mains.filter((s) => s.boardUrl).length;
/* 🔴 소식 0건 학교 (2026-10-03 개발자 지시 "소식이 0건인 학교는 없어") — 서비스 학교인데 발행된 글(숨김 빼고)이 하나도 없으면 사람 손이 필요하다(이슈) */
const liveBySchool = new Map();
for (const n of all) if (!n.hidden) liveBySchool.set(n.school, (liveBySchool.get(n.school) || 0) + 1);
const zeroSchools = [...new Set(mains.map((s) => s.school))].filter((name) => !liveBySchool.get(name));
const lines = [
  `## 🗞 교내 소식 수집 리포트 (${todayStr()})`, '',
  `새 글 **${freshAll.length}건** → 앱 홈 「우리 학교 소식」 (학교별 파일 data/news/ · ${pub.schools}개교 · 게시판 아는 학교 ${known}/${mains.length}${boards.length > mains.length ? ` · 둘째 게시판 ${boards.length - mains.length}곳` : ''})`, '',
];
if (futureCleared) lines.push(`ℹ️ 오늘보다 뒤인 게시일 ${futureCleared}건은 게시일이 아니라 비웠습니다 (제목 안 기한 날짜 등 · 수집일로 정렬)`, '');
if (zeroSchools.length) lines.push(`### 🙋 소식이 0건인 학교 ${zeroSchools.length}곳 — 출처를 찾아야 합니다 (모든 학교는 소식이 있다)`, ...zeroSchools.map((n) => `- ${n}`), '');
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
  for (const i of r.items) lines.push(`- ${i.kind ? `[${i.kind}] ` : ''}[${i.title}](${i.url})${i.postedAt ? ` — ${i.postedAt}` : ''}`);
  lines.push('');
}
lines.push('---', '⚙️ 설정: `collector/news-sources.json` · 발행: `data/news/<학교키>.json` · 로봇: `collector/collect-news.mjs` · 판정: `collector/news-kind.mjs`');
fs.writeFileSync(new URL('news-report.md', HERE), lines.join('\n'));

console.log(`news: ${freshAll.length} new; published ${all.length} items to ${pub.schools} school files`);
if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `new_count=${freshAll.length}\nneeds_human=${(chronic.length + noRows.length + zeroSchools.length) ? '1' : '0'}\n`);
/* 저장을 마쳤으면 스스로 끝낸다 — 시한에 걸려 버려진 게시판의 소켓이 프로세스를 붙잡지 않게 (collect.mjs 와 같은 이유) */
process.exit(0);

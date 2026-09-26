/* ============================================================
   한대장 — 장학공고 자동 수집 로봇 v2
   1) 학교 장학 게시판에서 새 공고 발견
   2) 각 공고 상세 페이지에 들어가 첨부파일(양식 hwp/pdf 등)과
      마감일 단서를 수집
   3) data/notices.json 으로 발행 → 앱의 '실시간 공고'에 표시
      (같은 게시판의 공모전·서포터즈 글은 data/activities.json → 앱 '대외활동' 탭 · 2026-09-25)
   4) 컨펌용 리포트 이슈 생성 (양식 스키마화·정식 등록은 개발자 컨펌 후)
   ============================================================ */
import fs from 'node:fs';
import { deadlineHintFrom } from './deadline-hint.mjs';
import { FETCH_HEADERS } from './http-headers.mjs';
import { urlKey, dedupeNotices, capNotices } from './url-key.mjs';
import { loadCandidates, mergeCandidates, saveCandidates } from './candidates.mjs';
import { publishBySchool, dropUnserved } from './publish-notices.mjs';
import { pageCandidates, samePage, shouldRetry } from './paginate.mjs';
import { cleanTitle, isMenuEntry } from './clean-title.mjs';
import { isAttachmentEntry } from './attachment-link.mjs';
import { activityKind } from './activity-kind.mjs';
import { extractLinks, stripSessionId } from './board-links.mjs';

const HERE = new URL('.', import.meta.url);
const cfg = JSON.parse(fs.readFileSync(new URL('schools.json', HERE), 'utf8'));

const seenPath = new URL('seen.json', HERE);
let seen = {};
try { seen = JSON.parse(fs.readFileSync(seenPath, 'utf8')); } catch { /* 첫 실행 */ }

const noticesPath = new URL('../data/notices.json', HERE);
let notices = { updatedAt: null, items: [] };
try { notices = JSON.parse(fs.readFileSync(noticesPath, 'utf8')); } catch { /* 첫 실행 */ }

const KEYWORDS = /장학|학자금|등록금 감면|학업장려|근로장학/;

/* ── 대외활동·공모전 (2026-09-25 · 노션 UI-34) ─────────────────────────────
   같은 게시판을 한 번만 두드린다 — 장학 게시판에서 주운 행 가운데 공모전·서포터즈 글은
   장학 피드가 버리던 것이라(KEYWORDS 에 안 걸린다) **같은 rawLinks 에서** 갈라 담는다.
   전용 게시판(activity-sources.json)은 아래 루프에 role:'activity' 로 붙어 같은 길을 간다.
   🔴 발행 파일은 data/activities.json 하나로 **notices.json 과 섞지 않는다** — 섞으면
      알림(notify-rules)·푸시(server/push)가 '새 장학 공고 N건'으로 세고, dropUnserved 가
      학교 없는 전국 글을 버린다. 판정은 activity-kind.mjs 한 곳. 장부도 따로 둔다
      (seen-activities.json) — 장학 장부에 이미 '봤다'로 적힌 글도 활동으로는 처음이다. */
const actCfgPath = new URL('activity-sources.json', HERE);
let actCfg = { sources: [] };
try { actCfg = JSON.parse(fs.readFileSync(actCfgPath, 'utf8')); } catch { /* 설정 없음 = 전용 게시판 없음 */ }
const seenActPath = new URL('seen-activities.json', HERE);
let seenAct = {};
try { seenAct = JSON.parse(fs.readFileSync(seenActPath, 'utf8')); } catch { /* 첫 실행 */ }
const actsPath = new URL('../data/activities.json', HERE);
let acts = { updatedAt: null, items: [] };
try { acts = JSON.parse(fs.readFileSync(actsPath, 'utf8')); } catch { /* 첫 실행 */ }
const ACT_FRESH_MAX = 20;    // 게시판 하나에서 한 실행에 상세까지 읽는 새 글 상한 (장학은 40)
const ACT_CAP = 200;         // 폰이 통째로 받는 파일 — 상한을 두어 작게 유지한다

/* ── 재단·지자체 장학 게시판 → 교외 공고 확대 (2026-09-26 · 노션 F-13) ─────────────
   external-sources.json 의 boardUrl 이 있는 곳(find-boards.mjs 가 찾았거나 사람이 적은 곳)을 같은 루프에서
   role:'external' 로 읽는다. 학교가 없는 전국 글이라 notices.json 에 넣을 수 없다(dropUnserved 가 버리고,
   알림이 '우리 학교 새 공고'로 센다) — data/external.json 에 따로 싣고 홈의 '재단·지자체 새 공고'에 보인다.
   주최(host)는 설정에서 받는다 — 제목으로 짐작하지 않는다(원칙 8-1). 장부는 seen-external.json. */
const extCfgPath = new URL('external-sources.json', HERE);
let extCfg = { sources: [] };
try { extCfg = JSON.parse(fs.readFileSync(extCfgPath, 'utf8')); } catch { /* 설정 없음 */ }
const seenExtPath = new URL('seen-external.json', HERE);
let seenExt = {};
try { seenExt = JSON.parse(fs.readFileSync(seenExtPath, 'utf8')); } catch { /* 첫 실행 */ }
const extPath = new URL('../data/external.json', HERE);
let ext = { updatedAt: null, items: [] };
try { ext = JSON.parse(fs.readFileSync(extPath, 'utf8')); } catch { /* 첫 실행 */ }
const EXT_FRESH_MAX = 20;
const EXT_CAP = 200;
/* 메뉴/공고 판정은 clean-title.mjs의 isMenuEntry 한 곳에만 둔다 — 브라우저 수집기와 갈라지면
   같은 게시판을 두 로봇이 다르게 읽는다(2026-08-02 '…안내' 공고 대량 유실 사고) */
const ATTACH_RE = /\.(hwp|hwpx|doc|docx|pdf|xls|xlsx)(\?|$)/i;
/* 접수 기간 한 줄을 뽑는 규칙은 collector/deadline-hint.mjs 한 곳 — 브라우저 수집기와 공용이다.
   여기 정규식을 되살리지 말 것(두 벌이 갈라져 학생 화면에 게시판 껍데기가 떴다 · 2026-09-12). */

const UA = FETCH_HEADERS;   // 규칙은 http-headers.mjs 한 곳 (2026-08-20)

/* extractLinks 는 board-links.mjs 로 옮겼다 (2026-09-26) — 재단 게시판 찾기 로봇과 같은 눈으로 읽는다 */

/* 공고 상세 페이지에서 첨부파일과 마감 단서 추출 */
async function fetchDetail(item) {
  try {
    const res = await fetch(item.url, { redirect: 'follow', headers: UA, signal: AbortSignal.timeout(15000) });
    if (!res.ok) return { attachments: [], deadlineHint: null };
    const html = await res.text();
    const links = extractLinks(html, item.url);
    // 첨부: 확장자 링크 + 다운로드성 링크
    const attachments = [];
    const re = /<a\b[^>]*href\s*=\s*["']([^"'#][^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let m;
    while ((m = re.exec(html)) !== null) {
      const name = m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      let url;
      try { url = new URL(m[1].replace(/&amp;/g, '&'), item.url).href; } catch { continue; }
      const isFile = ATTACH_RE.test(url) || ATTACH_RE.test(name) || /mode=download|download\.do|fileDown|attach/i.test(url);
      if (isFile && name && name.length >= 4 && name.length <= 120) {
        attachments.push({ name: name.slice(0, 100), url });
      }
      if (attachments.length >= 8) break;
    }
    const text = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

    const uniq = new Map();
    attachments.forEach((a) => { if (!uniq.has(a.url)) uniq.set(a.url, a); });
    return { attachments: [...uniq.values()], deadlineHint: deadlineHintFrom(text) };
  } catch {
    return { attachments: [], deadlineHint: null };
  }
}

/* fetch의 네트워크 실패는 전부 'TypeError: fetch failed'로 뭉뚱그려져 온다.
   **진짜 이유는 e.cause에 들어 있다**(ENOTFOUND=주소가 없음 / UND_ERR_CONNECT_TIMEOUT=연결 지연 /
   CERT=인증서). 이걸 안 펴 줘서 홍익대·서울과기대가 며칠째 '⚠️ 오류 (TypeError)'로만 남아
   **주소가 틀린 건지 학교가 잠깐 느린 건지 구분할 수 없었다** (2026-08-02).
   동국대에서 얻은 '못 읽음과 틀림을 뭉뚱그리지 말 것'과 같은 계열의 문제다. */
function netReason(e) {
  const seen = [];
  for (let c = e; c && seen.length < 4; c = c.cause) {
    if (c.code) seen.push(c.code);
    else if (c.message && c !== e) seen.push(String(c.message).slice(0, 60));
  }
  return seen.length ? `${e.name}: ${seen.join(' ← ')}` : (e.name || e.message);
}

/* 연결이 잠깐 안 되는 것과 주소가 틀린 것은 다르다 — 일시 장애는 한 번 더 두드려 본다.
   (브라우저 수집기는 이미 3단계 재시도가 있는데 일반 수집기에는 없어서, 학교가 잠시
   느린 날 통째로 빠지고 그게 리포트에는 '오류'로만 남았다.) */
const TRANSIENT = /TIMEOUT|ECONNRESET|ECONNREFUSED|EAI_AGAIN|ETIMEDOUT|UND_ERR/i;
async function fetchBoard(url) {
  let lastErr;
  for (let i = 0; i < 3; i += 1) {
    try {
      return await fetch(url, { redirect: 'follow', headers: UA, signal: AbortSignal.timeout(i === 0 ? 20000 : 45000) });
    } catch (e) {
      lastErr = e;
      if (!TRANSIENT.test(netReason(e)) || i === 2) break;   // 주소가 없는 것(ENOTFOUND)은 다시 해도 같다
      await new Promise((r) => setTimeout(r, 3000 * (i + 1)));
    }
  }
  throw lastErr;
}

/* 목록 행이 진짜 링크가 아닌 게시판 — 주소를 유추하지 말고 **게시판이 실제로 쓰는 것**만 쓴다
   (경희대에서 세 번 틀린 뒤 세운 규칙). 두 형태 다 실제로 열어서 확인해 둔 것이다.
   · json : 화면은 SPA라 껍데기만 오지만 목록을 주는 내부 API가 따로 있다.
   · dataId: 행이 <a href="javascript:" data-id="…">라 평범한 fetch로도 번호는 뽑힌다. */
const BOARD_RULES = {
  '서강대학교': {
    kind: 'json',
    api: 'https://www.sogang.ac.kr/api/api/v1/mainKo/BbsData/boardList?pageNum=1&pageSize=30&bbsConfigFk=141',
    // 상세 주소는 목록 행을 실제로 눌러서 받아 적었다 (2026-08-02): /ko/detail/<pkId>?bbsConfigFk=141
    detail: (id) => `https://www.sogang.ac.kr/ko/detail/${id}?bbsConfigFk=141&namepage=ScholarshipNotice`,
  },
  '서울교육대학교': {
    kind: 'dataId',
    detail: (id) => `https://www.snue.ac.kr/snue/na/ntt/selectNttInfo.do?mi=3004&bbsId=1083&nttSn=${id}`,
  },
  /* 전북대: 행이 <a href="javascript:;" onclick="pf_DetailMove('215647')">.
     상세 주소는 유추하지 않고 페이지의 함수를 그대로 읽었다 —
     pf_DetailMove는 action을 '/web/Board/<번호>/detailView.do'로 놓고 폼을 보낸다.
     실제로 열어 제목이 맞는지 확인했다(200·일치). */
  '전북대학교': {
    kind: 'onclick',
    fn: /pf_DetailMove\(\s*['"](\d+)['"]/,
    detail: (id) => `https://www.jbnu.ac.kr/web/Board/${id}/detailView.do?category=6`,
  },
};

/* stripSessionId 도 board-links.mjs 로 옮겼다 (2026-09-26) */

async function rowsByRule(rule, boardUrl) {
  if (rule.kind === 'json') {
    const r = await fetchBoard(rule.api);
    if (!r.ok) throw new Error(`API HTTP ${r.status}`);
    const j = await r.json();
    // 목록이 어디 있는지는 학교마다 다르다 — 서강은 data.list 처럼 한 겹 더 들어가 있다.
    // 배열이 나올 때까지 흔한 이름을 두 겹까지 따라간다.
    const dig = (o, d = 0) => {
      if (Array.isArray(o)) return o;
      if (!o || typeof o !== 'object' || d > 2) return null;
      for (const k of ['list', 'data', 'content', 'result', 'items', 'rows']) {
        const hit = dig(o[k], d + 1);
        if (hit) return hit;
      }
      return null;
    };
    const rows = dig(j) || [];
    return rows.map((x) => ({
      title: String(x.title || x.subject || '').replace(/\s+/g, ' ').trim(),
      url: rule.detail(x.pkId ?? x.id ?? x.seq),
    })).filter((x) => x.title && !/undefined|null/.test(x.url));
  }
  const r = await fetchBoard(boardUrl);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const html = await r.text();
  if (rule.kind === 'onclick') {
    // 행 전체를 잡아 클릭 스크립트의 글 번호와 제목을 짝짓는다
    // 따옴표 종류를 역참조로 맞춘다 — onclick="pf_DetailMove('215647')"처럼
    // 큰따옴표 안에 작은따옴표가 들어 있어 [^"']로는 거기서 끊긴다(전북대에서 실제로 겪음)
    return [...html.matchAll(/<a\b[^>]*onclick\s*=\s*(["'])((?:(?!\1)[\s\S])*)\1[^>]*>([\s\S]*?)<\/a>/gi)].map((m) => {
      const id = (m[2].match(rule.fn) || [])[1];
      return id ? { title: m[3].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(), url: rule.detail(id) } : null;
    }).filter((x) => x && x.title);
  }
  // dataId — 목록 HTML에서 번호와 제목을 짝지어 뽑는다
  return [...html.matchAll(/data-id=["'](\d+)["'][^>]*>([\s\S]{0,300}?)<\/a>/g)].map((m) => ({
    title: m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
    url: rule.detail(m[1]),
  })).filter((x) => x.title);
}

/* ── 목록 페이지 넘기기 (2026-08-17) ────────────────────────────────────────
   알아낸 방식은 collector/pagination.json에 적어 두어 매일 다시 헤매지 않는다.
   '안 되는 게시판'도 적어 두지만 영구 포기는 아니다 — 14일 뒤 한 번 더 본다(게시판 개편). */
const PAGES = Number(process.env.BOARD_PAGES || 3);          // 1페이지 + 뒤 2페이지
const pagePath = new URL('pagination.json', HERE);
let pageMemo = {};
try { pageMemo = JSON.parse(fs.readFileSync(pagePath, 'utf8')); } catch { /* 첫 실행 */ }
const pageNotes = [];
const todayStr = new Date().toISOString().slice(0, 10);

async function readMorePages(boardUrl, firstRows, readPage) {
  if (PAGES <= 1) return { rows: [], note: '' };
  const learned = pageMemo[boardUrl];
  if (!shouldRetry(learned)) return { rows: [], note: '' };
  const firstKeys = firstRows.map((r) => urlKey(r.url));
  const rows = [];
  let way = learned && learned.ok !== false ? learned.way : null;
  for (let pageNo = 2; pageNo <= PAGES; pageNo += 1) {
    const cands = pageCandidates(boardUrl, pageNo, way ? { way } : null);
    let got = null;
    for (const c of cands) {
      let page;
      try { page = await readPage(c.url); } catch { continue; }
      if (!page || !page.length) continue;
      /* 받아 온 목록이 1페이지와 사실상 같으면 게시판이 그 파라미터를 무시한 것이다.
         여기서 걸러 내지 않으면 같은 공고를 몇 번씩 담는다. */
      if (samePage(firstKeys, page.map((r) => urlKey(r.url)))) continue;
      got = { rows: page, way: c.way };
      break;
    }
    if (!got) {
      if (pageNo === 2) {   // 2페이지부터 못 넘겼다 = 이 게시판은 페이지 넘기기가 안 된다
        pageMemo[boardUrl] = { ok: false, checkedAt: todayStr };
        return { rows, note: '' };
      }
      break;                // 3페이지가 없는 것은 정상 (공고가 그만큼 없는 게시판)
    }
    way = got.way;
    pageMemo[boardUrl] = { ok: true, way, checkedAt: todayStr };
    rows.push(...got.rows);
    firstKeys.push(...got.rows.map((r) => urlKey(r.url)));   // 다음 페이지 비교 기준에 누적
  }
  return { rows, note: rows.length ? `${PAGES - 1}페이지 더 읽어 ${rows.length}행 추가` : '' };
}

const results = [];
const freshAll = [];
/* 대외활동·공모전 — 전용 게시판의 상태와 이번에 새로 주운 글. 장학 results 와 분리해 두는 이유:
   health.json(연속 실패 장부)은 prune-health.mjs 가 schools.json 이름으로 고아를 지우므로
   전용 게시판을 거기 섞으면 매 실행 지워진다. 전용 게시판 상태는 리포트에만 적는다. */
const actResults = [];
const freshActs = [];
/* 재단·지자체 게시판 — 상태와 새 글. health.json 에는 넣지 않는다(prune-health 가 schools.json 이름으로 고아를 지운다). */
const extResults = [];
const freshExt = [];

/* 게시판 하나를 두 역할이 나눠 읽는다 — role:'scholarship' 은 장학 피드 + 활동, role:'activity' 는 활동만 */
const boards = (cfg.schools || []).map((s) => ({ ...s, role: 'scholarship' }))
  .concat((actCfg.sources || []).map((s) => ({ ...s, role: 'activity' })))
  .concat((extCfg.sources || []).filter((s) => s.boardUrl).map((s) => ({ ...s, role: 'external' })));

for (const s of boards) {
  const isAct = s.role === 'activity';
  const isExt = s.role === 'external';
  const name = (s.campus && s.campus !== '공통' ? `${s.school} ${s.campus}` : s.school || (s.host || '전국'))
    + (isAct ? ' 대외활동·공모전' : '');
  const bucket = isAct ? actResults : (isExt ? extResults : results);
  if (!s.boardUrl) {
    bucket.push({ name, status: '⚙️ 게시판 주소 미설정' + (s.note ? ` (${s.note})` : ''), items: [] });
    continue;
  }
  try {
    const rule = BOARD_RULES[s.school];
    let rawLinks;
    if (rule) {
      rawLinks = await rowsByRule(rule, s.boardUrl);   // 링크가 아닌 행을 쓰는 게시판
    } else {
      const res = await fetchBoard(s.boardUrl);
      if (!res.ok) {
        results.push({ name, status: `⚠️ 접속 실패 (HTTP ${res.status}) — 주소 수정 필요`, items: [] });
        continue;
      }
      rawLinks = extractLinks(await res.text(), s.boardUrl);
      /* 목록 2페이지부터도 훑는다 (2026-08-17) — 상단 고정 공지가 많은 게시판은 실공고가
         1페이지 밖으로 밀리면 영영 안 잡혔다. 장부를 비워도 안 잡힌다(게시판에 그 순간
         떠 있는 것만 읽으므로). 규칙·경위는 collector/paginate.mjs 첫머리. */
      const extra = await readMorePages(s.boardUrl, rawLinks, (u) => fetchBoard(u).then(async (r) => (r.ok ? extractLinks(await r.text(), u) : [])));
      rawLinks = rawLinks.concat(extra.rows);
      if (extra.note) pageNotes.push(`${name}: ${extra.note}`);
    }
    /* 대외활동·공모전 — 같은 rawLinks 에서 갈라 담는다 (판정은 activity-kind.mjs 한 곳).
       장학 낱말 규칙(KEYWORDS)을 넘겨 '봉사장학·인턴장학' 같은 장학 제도는 장학 쪽에 남긴다. */
    {
      const actItems = rawLinks
        .map((i) => ({ ...i, kind: activityKind(i.title, { scholarship: KEYWORDS }) }))
        .filter((i) => i.kind)
        .filter((i) => !isMenuEntry(i.title))
        .filter((i) => !isAttachmentEntry(i));
      const freshA = actItems.filter((i) => !seenAct[urlKey(i.url)]).slice(0, ACT_FRESH_MAX);
      for (const it of freshA) {
        const detail = await fetchDetail(it);
        it.attachments = detail.attachments;
        it.deadlineHint = detail.deadlineHint;
        it.school = s.school || '';
        it.campus = s.campus === '공통' ? '' : (s.campus || '');
        if (!it.school && s.host) it.host = s.host;   // 전국 글은 주최를 설정에서 받는다(제목으로 짐작하지 않는다)
        it.foundAt = new Date().toISOString().slice(0, 10);
        seenAct[urlKey(it.url)] = it.foundAt;
        freshActs.push(it);
      }
      if (isAct) {
        actResults.push({
          name,
          status: actItems.length ? `✅ 정상 (활동·공모전 ${actItems.length}건 감지)` : '🟡 접속은 되지만 활동·공모전 글을 찾지 못함 — 게시판 종류 확인 필요',
          items: freshA,
        });
        continue;   // 전용 게시판은 장학 피드에 담지 않는다
      }
      if (freshA.length) actResults.push({ name: `${name} (장학 게시판에서 발견)`, status: '✅', items: freshA });
    }
    if (isExt) {
      /* 재단·지자체 게시판 — 장학 낱말 규칙은 학교 게시판과 같다. 학교 대신 host(주최)를 단다. */
      const extItems = rawLinks
        .filter((i) => KEYWORDS.test(i.title))
        .filter((i) => !isMenuEntry(i.title))
        .filter((i) => !isAttachmentEntry(i));
      const freshE = extItems.filter((i) => !seenExt[urlKey(i.url)]).slice(0, EXT_FRESH_MAX);
      for (const it of freshE) {
        const detail = await fetchDetail(it);
        it.attachments = detail.attachments;
        it.deadlineHint = detail.deadlineHint;
        it.school = '';
        it.campus = '';
        it.host = s.host || '';
        it.foundAt = new Date().toISOString().slice(0, 10);
        seenExt[urlKey(it.url)] = it.foundAt;
        freshExt.push(it);
      }
      extResults.push({
        name,
        status: extItems.length ? `✅ 정상 (장학 공고 ${extItems.length}건 감지)` : '🟡 접속은 되지만 장학 공고를 찾지 못함 — 게시판이 맞는지 확인 필요',
        items: freshE,
      });
      continue;   // 재단 글은 학교 피드(notices.json)에 담지 않는다
    }
    const items = rawLinks
      .filter((i) => KEYWORDS.test(i.title))
      .filter((i) => !isMenuEntry(i.title))     // 옆 메뉴 제외 (실공고 신호가 있으면 남긴다)
      // 첨부파일 내려받기 링크 제외 — 안 막으면 '…포스터.png' 같은 파일 이름이 공고로 뜬다
      .filter((i) => !isAttachmentEntry(i));
    // 이미 본 글인지는 정규화한 주소로 판정 — 정렬 순번만 바뀐 같은 글을 '신규'로 담지 않기 위해
    const fresh = items.filter((i) => !seen[i.url] && !seen[urlKey(i.url)]).slice(0, 40);

    // 상세 페이지 방문: 첨부양식·마감 단서 수집
    for (const it of fresh) {
      const detail = await fetchDetail(it);
      it.attachments = detail.attachments;
      it.deadlineHint = detail.deadlineHint;
      it.school = s.school;
      it.campus = s.campus === '공통' ? '' : s.campus;
      it.foundAt = new Date().toISOString().slice(0, 10);
      seen[urlKey(it.url)] = it.foundAt;
      freshAll.push(it);
    }
    results.push({
      name,
      status: items.length ? `✅ 정상 (실공고 ${items.length}건 감지)` : '🟡 접속은 되지만 실공고를 찾지 못함 — 공지 목록 페이지인지 확인 필요',
      items: fresh,
    });
  } catch (e) {
    // 이유를 그대로 적는다 — ENOTFOUND면 주소가 없는 것이고, TIMEOUT이면 학교가 느린 것이라
    // 해야 할 일이 정반대다. 'TypeError'만 적으면 둘을 구분할 수 없다.
    bucket.push({ name, status: `⚠️ 오류 (${netReason(e)}) — 주소 확인 필요`, items: [] });
  }
}

fs.writeFileSync(seenPath, JSON.stringify(seen, null, 1));
fs.writeFileSync(seenActPath, JSON.stringify(seenAct, null, 1));
fs.writeFileSync(seenExtPath, JSON.stringify(seenExt, null, 1));
fs.writeFileSync(pagePath, JSON.stringify(pageMemo, null, 1));

/* 앱 발행: 최신 공고를 학교별로 병합, 학교당 최대 15건·전체 200건 유지 */
notices.items = freshAll.concat(notices.items || []);
/* 수집일로부터 60일 지난 공고는 자동 삭제 (마감 공고 정리) */
const cutoff = new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10);
notices.items = notices.items.filter((n) => (n.foundAt || '9999') >= cutoff);
/* 예전에 담긴 첨부파일 링크도 매 실행 걷어낸다 (소급 적용 — 운영 원칙 7) */
notices.items = notices.items.filter((n) => !isAttachmentEntry(n));
notices.items = dedupeNotices(notices.items);
/* 학교당 40건 · 전체는 학교 수에 비례 (학교 수 × 15건, 최소 200건).
   상한이 200건 고정이던 시절엔 학교를 더 붙이면 오래된 공고가 조용히 잘려 나갔다. */
/* 검수 후보 장부에도 남긴다 (2026-08-17) — 아래 capNotices가 잘라내도 여기에는 남는다.
   상한은 **폰이 받는 파일**을 작게 유지하려는 것이지 '이 공고는 볼 필요 없다'는 뜻이 아닌데,
   예전엔 잘린 공고가 seen.json에만 '봤다'로 남아 다시 수집되지도, 검수되지도 않았다
   (2026-08-17 실측 747건 유실). 경위는 collector/candidates.mjs 첫머리. */
saveCandidates(mergeCandidates(loadCandidates().items, freshAll));

/* 🔴 서비스하지 않는 학교의 공고는 여기서 떨군다 (2026-09-05 개발자 지시).
   수집 대상은 이미 경희대·한국외대 둘뿐인데 **예전에 담긴 다른 학교 공고가 그대로 남아**
   (200건 중 173건) 로봇들이 그걸 붙들고 일하고 있었다. ⚠️ '상한을 차지해 새 공고를
   밀어낸다'는 설명은 **틀렸다** — 재 보니 한 건도 안 잘리고 있었다(2026-09-05 리뷰).
   이유·되돌리는 법은 publish-notices.mjs 의 dropUnserved 첫머리. */
{
  const before = notices.items.length;
  notices.items = dropUnserved(notices.items);
  if (notices.items.length !== before) {
    console.log(`서비스하지 않는 학교의 공고 ${before - notices.items.length}건을 피드에서 뺐습니다 (남은 ${notices.items.length}건)`);
  }
}

const beforeCap = notices.items;
/* 학교별 파일도 함께 발행한다 (2026-08-17) — 앱은 이쪽을 읽는다.
   위 capNotices는 **폰이 통째로 받는 옛 파일**을 작게 유지하려는 것이고, 학교별 파일에는
   그 상한이 필요 없다(학생은 자기 학교 것만 받는다). 그래서 자르기 **전** 목록으로 발행한다 —
   순서가 바뀌면 학교별 파일도 16건으로 잘려 나눈 뜻이 사라진다. 경위는 collector/publish-notices.mjs

   🔴 넘기는 것은 **전체 목록이어야 한다** — `freshAll`(이번에 새로 주운 것)로 바꾸지 말 것 (2026-09-06).
      링크 사냥꾼(매일 06:37)과 원문 링크 복구(월 05:13)는 data/notices.json 의 **주소만 고치고**
      학교별 파일은 만들지 않는다(publishBySchool 호출 0회, 워크플로 git add 목록에도 없다).
      그 수리를 학생 화면으로 옮기는 것이 **여기 한 곳뿐**이다 — 07:41 수집이 전체를 다시 발행하면서
      어젯밤 고쳐 둔 주소도 함께 실린다(실측: 두 파일의 주소 508건 전부 일치).
      새로 주운 것만 넘기면 그 수리가 영영 앱에 안 닿는데, **오류는 하나도 안 난다** —
      사냥꾼도 성공, 수집도 성공, 감사도 통과, 학생만 옛 주소를 누른다.
      2026-08-17 '학교별 파일이 19일 동안 저장되지 않았다' 사고와 같은 모양이다.
      관문: verify/test-collector.mjs '학교별 파일은 전체 목록으로 발행한다'. */
publishBySchool(beforeCap);

notices.items = capNotices(notices.items);
notices.updatedAt = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
fs.mkdirSync(new URL('../data/', HERE), { recursive: true });
fs.writeFileSync(noticesPath, JSON.stringify(notices, null, 1));

/* ── 대외활동·공모전 발행 — data/activities.json (notices.json 과 섞지 않는다) ──
   장학 피드와 같은 규칙: 60일 지나면 지운다 · 첨부 링크 걷어낸다 · 같은 글은 하나 · 상한.
   학교 글은 서비스 학교(dropUnserved)만, 학교가 빈 전국 글은 그대로 둔다(모든 학생에게 보인다). */
acts.items = freshActs.concat(acts.items || []);
acts.items = acts.items.filter((n) => (n.foundAt || '9999') >= cutoff);
acts.items = acts.items.filter((n) => !isAttachmentEntry(n));
acts.items = dedupeNotices(acts.items);
acts.items = acts.items.filter((n) => !n.school).concat(dropUnserved(acts.items.filter((n) => n.school)));
acts.items.sort((a, b) => String(b.foundAt || '').localeCompare(String(a.foundAt || '')));
acts.items = acts.items.slice(0, ACT_CAP);
acts.updatedAt = notices.updatedAt;
fs.writeFileSync(actsPath, JSON.stringify(acts, null, 1));

/* ── 재단·지자체 공고 발행 — data/external.json (학교 피드와 섞지 않는다 · 규칙은 위와 같다) ── */
ext.items = freshExt.concat(ext.items || []);
ext.items = ext.items.filter((n) => (n.foundAt || '9999') >= cutoff);
ext.items = ext.items.filter((n) => !isAttachmentEntry(n));
ext.items = dedupeNotices(ext.items);
ext.items = ext.items.filter((n) => !n.school && n.host);   // 학교 글은 여기 오지 않는다 · 주최 없는 글도 싣지 않는다
ext.items.sort((a, b) => String(b.foundAt || '').localeCompare(String(a.foundAt || '')));
ext.items = ext.items.slice(0, EXT_CAP);
ext.updatedAt = notices.updatedAt;
fs.writeFileSync(extPath, JSON.stringify(ext, null, 1));

/* 컨펌 리포트 */
const newCount = freshAll.length;
const today = notices.updatedAt;
const lines = [
  `## 🤖 장학공고 수집 리포트 (${today})`,
  '',
  `새로 발견한 공고: **${newCount}건** — 앱의 '실시간 공고'에는 즉시 표시되며(링크 연결만), 맞춤 매칭·양식 작성 지원 등록은 아래에서 컨펌해 주세요.`,
  '',
  /* 🔴 등록은 이제 화면에서 된다 — 채팅은 '화면이 못 하는 것'만 맡는다 (2026-09-13).
     주소는 마크다운 링크로 쓰지 않는다: 이 리포트는 GitHub 이슈와 관리자 화면 두 곳에 나가는데
     화면 쪽은 글자 그대로 그려서(esc) `[이름](주소)` 라고 쓰면 대괄호가 그대로 보인다.
     맨 주소로 두면 GitHub 이 알아서 링크로 만들고 화면에서도 읽힌다. */
  '> 등록하는 곳 — 관리자 화면 → 컨펌 작업대: https://hanggonggan-admin.pages.dev/#review',
  '> 「수집됐지만 아직 등록 안 한 공고」에서 원문 ↗ 으로 확인한 뒤 **등록하기**를 누르면 그 자리에서 등록됩니다(제목·구분·마감일·금액·주관·요약). 대출·대학원 전용처럼 규칙에 걸리는 것은 눌러도 막히니 안심하고 눌러도 됩니다.',
  '> 다만 **첨부된 신청서 양식**과 **자격 요건 줄들**은 원문과 같은 구조로 옮겨야 해서 화면에서 못 합니다 — 그것까지 필요하면 채팅에 "이슈 #N 의 ○○ 양식·자격까지 등록해줘"라고 말씀해 주세요.',
  '',
];
for (const r of results) {
  lines.push(`### ${r.name}`);
  lines.push(`상태: ${r.status}`);
  for (const i of r.items) {
    lines.push(`- [${i.title}](${i.url})`);
    if (i.deadlineHint) lines.push(`  - ⏰ ${i.deadlineHint}`);
    for (const a of (i.attachments || []).slice(0, 5)) {
      lines.push(`  - 📎 [${a.name}](${a.url})`);
    }
  }
  lines.push('');
}
/* 연속 실패 감시 — 브라우저 수집기에만 있고 여기엔 없었다 (2026-08-02).
   그래서 일반 수집기 담당 학교(홍익대)가 며칠째 '⚠️ 오류' 한 줄로 조용히 빠져 있어도
   아무도 몰랐다. 한 번 실패는 학교가 잠깐 느린 것이라 저절로 복구되지만,
   **연속 실패는 주소가 바뀐 것**이라 사람이 손을 대야 한다 — 그 구분을 여기서도 한다.
   장부는 브라우저 수집기와 같은 health.json을 쓴다(학교 이름이 열쇠라 섞이지 않는다). */
const healthPath = new URL('health.json', HERE);
let health = {};
try { health = JSON.parse(fs.readFileSync(healthPath, 'utf8')); } catch { /* 첫 실행 */ }
const chronic = [];
for (const r of results) {
  if (/게시판 주소 미설정/.test(r.status)) continue;   // 아직 주소가 없는 곳은 실패가 아니다
  const h = health[r.name] || { fails: 0, lastOk: null };
  if (/⚠️/.test(r.status)) {
    h.fails += 1;
    if (h.fails >= 3) chronic.push(`${r.name} (${h.fails}회 연속) — ${r.status.replace(/^⚠️\s*/, '')}`);
  } else {
    h.fails = 0; h.lastOk = today;
  }
  health[r.name] = h;
}
fs.writeFileSync(healthPath, JSON.stringify(health, null, 1));
if (chronic.length) {
  lines.push('### 🚨 연속 실패 — 게시판 주소 확인 필요');
  lines.push('한 번은 일시 장애지만 3회 연속이면 주소가 바뀐 것입니다. 해당 학교 학생 화면에 새 공고가 안 들어옵니다.');
  chronic.forEach((c) => lines.push(`- ${c}`));
  lines.push('');
}

/* 대외활동·공모전 — 컨펌 대상이 아니다(제목+링크만 앱 '대외활동' 탭에 실린다). 상태와 새 글만 적는다. */
lines.push(`### 🎯 대외활동·공모전 새 글 ${freshActs.length}건 → 앱 '대외활동' 탭 (data/activities.json · ${acts.items.length}건 게재 중)`);
for (const r of actResults) {
  lines.push(`- **${r.name}** — ${r.status}`);
  for (const i of r.items) lines.push(`  - [${i.kind}] [${i.title}](${i.url})${i.deadlineHint ? ` — ⏰ ${i.deadlineHint}` : ''}`);
}
if (!actCfg.sources || !actCfg.sources.some((x) => x.boardUrl)) {
  lines.push('> 전용 게시판 주소가 아직 없습니다 — `collector/activity-sources.json` 의 `boardUrl` 에 학교의 대외활동·공모전 게시판 주소를 적어 주세요(장학 게시판에서 발견되는 글만 담고 있습니다).');
}
lines.push('');

/* 재단·지자체 게시판 — 교외 확대. 컨펌 대상이 아니다(제목+링크만 홈 '재단·지자체 새 공고'에 실린다). */
{
  const known = (extCfg.sources || []).filter((x) => x.boardUrl).length;
  lines.push(`### 🏛 재단·지자체 새 공고 ${freshExt.length}건 → 홈 '재단·지자체 새 공고' (data/external.json · ${ext.items.length}건 게재 중 · 게시판 아는 곳 ${known}/${(extCfg.sources || []).length})`);
  for (const r of extResults) {
    lines.push(`- **${r.name}** — ${r.status}`);
    for (const i of r.items) lines.push(`  - [${i.title}](${i.url})${i.deadlineHint ? ` — ⏰ ${i.deadlineHint}` : ''}`);
  }
  if (!known) lines.push('> 아직 게시판을 아는 재단이 없습니다 — `collector/find-boards.mjs` 가 매 실행 홈페이지에서 찾습니다(`collector/find-boards-report.md`). 사람이 `collector/external-sources.json` 의 `boardUrl` 에 적어도 됩니다.');
  lines.push('');
}

if (pageNotes.length) {
  lines.push('### 📄 목록 2페이지 이후에서 더 읽은 게시판');
  lines.push('1페이지만 읽던 시절에는 상단 고정 공지에 밀린 실공고가 영영 안 잡혔습니다.');
  pageNotes.forEach((n) => lines.push(`- ${n}`));
  lines.push('');
}
const noPage = Object.values(pageMemo).filter((v) => v && v.ok === false).length;
if (noPage) lines.push(`📄 페이지 넘기기가 안 되는 게시판 ${noPage}곳 (14일 뒤 다시 시도합니다)`, '');

lines.push('---');
lines.push('⚙️ 설정: `collector/schools.json` · `collector/activity-sources.json` · `collector/external-sources.json` · 발행: `data/notices.json` · `data/activities.json` · `data/external.json` · 로봇: `collector/collect.mjs`');
fs.writeFileSync(new URL('report.md', HERE), lines.join('\n'));

console.log(`collected: ${newCount} new items; notices.json now has ${notices.items.length} items; activities: ${freshActs.length} new, ${acts.items.length} total; external: ${freshExt.length} new, ${ext.items.length} total`);
if (process.env.GITHUB_OUTPUT) {
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `new_count=${newCount}\n`);
}

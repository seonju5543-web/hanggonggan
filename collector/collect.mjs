/* ============================================================
   한대장 — 장학공고 자동 수집 로봇 v2
   1) 학교 장학 게시판에서 새 공고 발견
   2) 각 공고 상세 페이지에 들어가 첨부파일(양식 hwp/pdf 등)과
      마감일 단서를 수집
   3) data/notices.json 으로 발행 → 앱의 '실시간 공고'에 표시
   4) 컨펌용 리포트 이슈 생성 (양식 스키마화·정식 등록은 개발자 컨펌 후)
   ============================================================ */
import fs from 'node:fs';
import { urlKey, dedupeNotices, capNotices } from './url-key.mjs';
import { cleanTitle, isMenuEntry } from './clean-title.mjs';
import { isAttachmentEntry } from './attachment-link.mjs';

const HERE = new URL('.', import.meta.url);
const cfg = JSON.parse(fs.readFileSync(new URL('schools.json', HERE), 'utf8'));

const seenPath = new URL('seen.json', HERE);
let seen = {};
try { seen = JSON.parse(fs.readFileSync(seenPath, 'utf8')); } catch { /* 첫 실행 */ }

const noticesPath = new URL('../data/notices.json', HERE);
let notices = { updatedAt: null, items: [] };
try { notices = JSON.parse(fs.readFileSync(noticesPath, 'utf8')); } catch { /* 첫 실행 */ }

const KEYWORDS = /장학|학자금|등록금 감면|학업장려|근로장학/;
/* 메뉴/공고 판정은 clean-title.mjs의 isMenuEntry 한 곳에만 둔다 — 브라우저 수집기와 갈라지면
   같은 게시판을 두 로봇이 다르게 읽는다(2026-08-02 '…안내' 공고 대량 유실 사고) */
const ATTACH_RE = /\.(hwp|hwpx|doc|docx|pdf|xls|xlsx)(\?|$)/i;
const DEADLINE_RE = /(마감|까지|기한|접수기간|신청기간)[^\n<]{0,60}/;

const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; HandaejangBot/0.2; +https://github.com/seonju5543-web/hanggonggan)' };

function extractLinks(html, base) {
  const out = [];
  const re = /<a\b[^>]*href\s*=\s*["']([^"'#][^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const title = cleanTitle(m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
    if (title.length < 6 || title.length > 140) continue;
    let url;
    try { url = new URL(m[1].replace(/&amp;/g, '&'), base).href; } catch { continue; }
    if (!/^https?:/.test(url)) continue;
    out.push({ title, url: stripSessionId(url) });
  }
  const uniq = new Map();
  out.forEach((i) => { if (!uniq.has(i.url)) uniq.set(i.url, i); });
  return [...uniq.values()];
}

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
    const dm = text.match(DEADLINE_RE);
    const uniq = new Map();
    attachments.forEach((a) => { if (!uniq.has(a.url)) uniq.set(a.url, a); });
    return { attachments: [...uniq.values()], deadlineHint: dm ? dm[0].trim().slice(0, 80) : null };
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

/* 자바 게시판이 주소 경로에 끼워 넣는 세션 값(;JSESSIONID=…)을 뗀다.
   접속할 때마다 값이 달라서 그대로 두면 **매일 같은 공고를 새 공고로 다시 담고**
   (이슈 #75와 같은 병), 남의 세션이 박힌 주소를 학생에게 보여 주게 된다.
   충북대에서 실제로 이 형태가 왔고, 떼고 열어도 정상인 것을 확인했다 (2026-08-02). */
function stripSessionId(u) {
  return String(u || '').replace(/;jsessionid=[^?#/]*/i, '');
}

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

const results = [];
const freshAll = [];

for (const s of cfg.schools) {
  const name = s.campus && s.campus !== '공통' ? `${s.school} ${s.campus}` : s.school;
  if (!s.boardUrl) {
    results.push({ name, status: '⚙️ 게시판 주소 미설정' + (s.note ? ` (${s.note})` : ''), items: [] });
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
    results.push({ name, status: `⚠️ 오류 (${netReason(e)}) — 주소 확인 필요`, items: [] });
  }
}

fs.writeFileSync(seenPath, JSON.stringify(seen, null, 1));

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
notices.items = capNotices(notices.items);
notices.updatedAt = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
fs.mkdirSync(new URL('../data/', HERE), { recursive: true });
fs.writeFileSync(noticesPath, JSON.stringify(notices, null, 1));

/* 컨펌 리포트 */
const newCount = freshAll.length;
const today = notices.updatedAt;
const lines = [
  `## 🤖 장학공고 수집 리포트 (${today})`,
  '',
  `새로 발견한 공고: **${newCount}건** — 앱의 '실시간 공고'에는 즉시 표시되며(링크 연결만), 맞춤 매칭·양식 작성 지원 등록은 아래에서 컨펌해 주세요.`,
  '',
  '> 컨펌 방법: 채팅에 "이슈 #N에서 ○○ 정식 등록해줘"라고 말씀해 주시면 자격요건·금액·마감일·첨부 양식을 스키마로 정리해 등록합니다.',
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

lines.push('---');
lines.push('⚙️ 설정: `collector/schools.json` · 발행: `data/notices.json` · 로봇: `collector/collect.mjs`');
fs.writeFileSync(new URL('report.md', HERE), lines.join('\n'));

console.log(`collected: ${newCount} new items; notices.json now has ${notices.items.length} items`);
if (process.env.GITHUB_OUTPUT) {
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `new_count=${newCount}\n`);
}

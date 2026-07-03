/* ============================================================
   한대장 — 장학공고 자동 수집 로봇 v2
   1) 학교 장학 게시판에서 새 공고 발견
   2) 각 공고 상세 페이지에 들어가 첨부파일(양식 hwp/pdf 등)과
      마감일 단서를 수집
   3) data/notices.json 으로 발행 → 앱의 '실시간 공고'에 표시
   4) 컨펌용 리포트 이슈 생성 (양식 스키마화·정식 등록은 개발자 컨펌 후)
   ============================================================ */
import fs from 'node:fs';

const HERE = new URL('.', import.meta.url);
const cfg = JSON.parse(fs.readFileSync(new URL('schools.json', HERE), 'utf8'));

const seenPath = new URL('seen.json', HERE);
let seen = {};
try { seen = JSON.parse(fs.readFileSync(seenPath, 'utf8')); } catch { /* 첫 실행 */ }

const noticesPath = new URL('../data/notices.json', HERE);
let notices = { updatedAt: null, items: [] };
try { notices = JSON.parse(fs.readFileSync(noticesPath, 'utf8')); } catch { /* 첫 실행 */ }

const KEYWORDS = /장학|학자금|등록금 감면|학업장려|근로장학/;
const MENU_NOISE = /안내$|규정$|제도|구분$|바로가기|메뉴|홈페이지$|가이드북|증명서$|융자|^학사\/|장학안내|예우/;
const ATTACH_RE = /\.(hwp|hwpx|doc|docx|pdf|xls|xlsx)(\?|$)/i;
const DEADLINE_RE = /(마감|까지|기한|접수기간|신청기간)[^\n<]{0,60}/;

const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; HandaejangBot/0.2; +https://github.com/seonju5543-web/hanggonggan)' };

function extractLinks(html, base) {
  const out = [];
  const re = /<a\b[^>]*href\s*=\s*["']([^"'#][^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const title = m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (title.length < 6 || title.length > 140) continue;
    let url;
    try { url = new URL(m[1].replace(/&amp;/g, '&'), base).href; } catch { continue; }
    if (!/^https?:/.test(url)) continue;
    out.push({ title, url });
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
    const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    const dm = text.match(DEADLINE_RE);
    const uniq = new Map();
    attachments.forEach((a) => { if (!uniq.has(a.url)) uniq.set(a.url, a); });
    return { attachments: [...uniq.values()], deadlineHint: dm ? dm[0].trim().slice(0, 80) : null };
  } catch {
    return { attachments: [], deadlineHint: null };
  }
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
    const res = await fetch(s.boardUrl, { redirect: 'follow', headers: UA, signal: AbortSignal.timeout(20000) });
    if (!res.ok) {
      results.push({ name, status: `⚠️ 접속 실패 (HTTP ${res.status}) — 주소 수정 필요`, items: [] });
      continue;
    }
    const html = await res.text();
    const items = extractLinks(html, s.boardUrl)
      .filter((i) => KEYWORDS.test(i.title))
      .filter((i) => !MENU_NOISE.test(i.title)); // 메뉴성 링크 제외, 실공고 위주
    const fresh = items.filter((i) => !seen[i.url]).slice(0, 12);

    // 상세 페이지 방문: 첨부양식·마감 단서 수집
    for (const it of fresh) {
      const detail = await fetchDetail(it);
      it.attachments = detail.attachments;
      it.deadlineHint = detail.deadlineHint;
      it.school = s.school;
      it.campus = s.campus === '공통' ? '' : s.campus;
      it.foundAt = new Date().toISOString().slice(0, 10);
      seen[it.url] = it.foundAt;
      freshAll.push(it);
    }
    results.push({
      name,
      status: items.length ? `✅ 정상 (실공고 ${items.length}건 감지)` : '🟡 접속은 되지만 실공고를 찾지 못함 — 공지 목록 페이지인지 확인 필요',
      items: fresh,
    });
  } catch (e) {
    results.push({ name, status: `⚠️ 오류 (${e.name || e.message}) — 주소 확인 필요`, items: [] });
  }
}

fs.writeFileSync(seenPath, JSON.stringify(seen, null, 1));

/* 앱 발행: 최신 공고를 학교별로 병합, 학교당 최대 15건·전체 200건 유지 */
notices.items = freshAll.concat(notices.items || []);
const perSchool = {};
notices.items = notices.items.filter((n) => {
  const k = n.school + '|' + (n.campus || '');
  perSchool[k] = (perSchool[k] || 0) + 1;
  return perSchool[k] <= 15;
}).slice(0, 200);
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
lines.push('---');
lines.push('⚙️ 설정: `collector/schools.json` · 발행: `data/notices.json` · 로봇: `collector/collect.mjs`');
fs.writeFileSync(new URL('report.md', HERE), lines.join('\n'));

console.log(`collected: ${newCount} new items; notices.json now has ${notices.items.length} items`);
if (process.env.GITHUB_OUTPUT) {
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `new_count=${newCount}\n`);
}

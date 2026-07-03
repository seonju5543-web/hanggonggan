/* ============================================================
   한대장 — 장학공고 자동 수집 로봇
   매일 정해진 시간에 대상 학교 장학 게시판을 읽고,
   '장학' 관련 새 공고를 발견하면 컨펌용 리포트를 만든다.
   ※ 공고는 자동으로 앱에 게시되지 않는다 — 개발자 컨펌 후 반영.
   ============================================================ */
import fs from 'node:fs';

const HERE = new URL('.', import.meta.url);
const cfg = JSON.parse(fs.readFileSync(new URL('schools.json', HERE), 'utf8'));

const seenPath = new URL('seen.json', HERE);
let seen = {};
try { seen = JSON.parse(fs.readFileSync(seenPath, 'utf8')); } catch { /* 첫 실행 */ }

const KEYWORDS = /장학|학자금|등록금 감면|학업장려|근로장학/;

function extractLinks(html, base) {
  const out = [];
  const re = /<a\b[^>]*href\s*=\s*["']([^"'#][^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const title = m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (title.length < 6 || title.length > 120) continue;
    if (!KEYWORDS.test(title)) continue;
    let url;
    try { url = new URL(m[1], base).href; } catch { continue; }
    if (!/^https?:/.test(url)) continue;
    out.push({ title, url });
  }
  // 같은 링크 중복 제거
  const uniq = new Map();
  out.forEach((i) => { if (!uniq.has(i.url)) uniq.set(i.url, i); });
  return [...uniq.values()];
}

const results = [];
for (const s of cfg.schools) {
  const name = s.campus && s.campus !== '공통' ? `${s.school} ${s.campus}` : s.school;
  if (!s.boardUrl) {
    results.push({ name, status: '⚙️ 게시판 주소 미설정', items: [] });
    continue;
  }
  try {
    const res = await fetch(s.boardUrl, {
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; HandaejangBot/0.1; +https://github.com/seonju5543-web/hanggonggan)' },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) {
      results.push({ name, status: `⚠️ 접속 실패 (HTTP ${res.status}) — 주소 수정 필요`, items: [] });
      continue;
    }
    const html = await res.text();
    const items = extractLinks(html, s.boardUrl);
    const fresh = items.filter((i) => !seen[i.url]).slice(0, 15);
    fresh.forEach((i) => { seen[i.url] = new Date().toISOString().slice(0, 10); });
    results.push({
      name,
      status: items.length ? `✅ 정상 (장학 공고 ${items.length}건 감지)` : '🟡 접속은 되지만 장학 공고를 찾지 못함 — 게시판 주소가 목록 페이지인지 확인 필요',
      items: fresh,
    });
  } catch (e) {
    results.push({ name, status: `⚠️ 오류 (${e.name || e.message}) — 주소 확인 필요`, items: [] });
  }
}

fs.writeFileSync(seenPath, JSON.stringify(seen, null, 1));

const newCount = results.reduce((a, r) => a + r.items.length, 0);
const today = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10); // KST

const lines = [
  `## 🤖 장학공고 수집 리포트 (${today})`,
  '',
  `새로 발견한 공고: **${newCount}건**`,
  '',
  '> 아래 공고는 아직 앱에 게시되지 않았습니다. 확인 후 추가할 공고를 알려주시면 검증(자격요건·금액·마감일 정리) 후 앱에 반영합니다.',
  '',
];

for (const r of results) {
  lines.push(`### ${r.name}`);
  lines.push(`상태: ${r.status}`);
  if (r.items.length) {
    r.items.forEach((i) => lines.push(`- [${i.title}](${i.url})`));
  }
  lines.push('');
}

lines.push('---');
lines.push('⚙️ 게시판 주소 설정: `collector/schools.json` · 로봇 코드: `collector/collect.mjs`');

fs.writeFileSync(new URL('report.md', HERE), lines.join('\n'));
console.log(`collected: ${newCount} new items across ${results.length} boards`);

if (process.env.GITHUB_OUTPUT) {
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `new_count=${newCount}\n`);
}

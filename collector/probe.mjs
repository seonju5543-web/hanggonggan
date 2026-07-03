/* 게시판 후보 주소 정찰 — 각 후보에 접속해 상태와 샘플 링크를 리포트한다.
   collect.mjs와 달리 아무것도 저장하지 않는 읽기 전용 도구. */
import fs from 'node:fs';

const HERE = new URL('.', import.meta.url);
const cfg = JSON.parse(fs.readFileSync(new URL('probe-candidates.json', HERE), 'utf8'));

const KEYWORDS = /장학|학자금|등록금 감면|학업장려|근로장학/;
const ARTICLE_HINT = /(view|articleNo|artclView|wr_id|seq=|no=|\/\d{3,})/i;

function extractAll(html, base) {
  const out = [];
  const re = /<a\b[^>]*href\s*=\s*["']([^"'#][^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const title = m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (title.length < 6 || title.length > 120) continue;
    let url;
    try { url = new URL(m[1], base).href; } catch { continue; }
    if (!/^https?:/.test(url)) continue;
    out.push({ title, url });
  }
  return out;
}

const lines = [`## 🔍 게시판 후보 정찰 리포트 (${new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 16).replace('T', ' ')} KST)`, ''];

for (const c of cfg.candidates) {
  lines.push(`### ${c.school}`);
  for (const url of c.urls) {
    try {
      const res = await fetch(url, {
        redirect: 'follow',
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; HandaejangBot/0.1)' },
        signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) { lines.push(`- ❌ HTTP ${res.status} · ${url}`); continue; }
      const html = await res.text();
      const links = extractAll(html, url);
      const sch = links.filter((l) => KEYWORDS.test(l.title));
      const articleLike = links.filter((l) => ARTICLE_HINT.test(l.url));
      const sample = (sch.length ? sch : articleLike).slice(0, 3).map((l) => l.title).join(' / ');
      lines.push(`- ${sch.length ? '✅' : articleLike.length >= 5 ? '🟡' : '⚪'} 링크 ${links.length} · 장학키워드 ${sch.length} · 게시글형 ${articleLike.length} · ${url}`);
      if (sample) lines.push(`  - 샘플: ${sample.slice(0, 160)}`);
    } catch (e) {
      lines.push(`- ❌ 오류(${e.name || e.message}) · ${url}`);
    }
  }
  lines.push('');
}

fs.writeFileSync(new URL('probe-report.md', HERE), lines.join('\n'));
console.log('probe done');

/* 심층 수집: notices.json의 모든 공고 본문 전문 + 지정 공고의 첨부파일 원본을
   저장소(collector/extracted/)에 저장한다. 정식 등록 큐레이션의 원천 자료. */
import fs from 'node:fs';

const HERE = new URL('.', import.meta.url);
const OUT = new URL('extracted/', HERE);
fs.mkdirSync(OUT, { recursive: true });

const notices = JSON.parse(fs.readFileSync(new URL('../data/notices.json', HERE), 'utf8'));
const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; HandaejangBot/0.2)' };

/* 첨부 원본까지 내려받을 공고 (제목 부분일치) */
const DOWNLOAD_FORMS_FOR = (process.env.FORM_TARGETS || '조병두').split(',');

function clean(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|li|h\d)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim();
}

const texts = [];
for (const n of notices.items) {
  try {
    const res = await fetch(n.url, { redirect: 'follow', headers: UA, signal: AbortSignal.timeout(20000) });
    const body = res.ok ? clean(await res.text()).slice(0, 5000) : `FETCH_FAIL HTTP ${res.status}`;
    texts.push({ title: n.title, school: n.school, campus: n.campus, url: n.url,
      attachments: n.attachments || [], foundAt: n.foundAt, text: body });
    console.log('text ok:', n.title.slice(0, 40));
  } catch (e) {
    texts.push({ title: n.title, school: n.school, url: n.url, text: 'FETCH_ERROR ' + (e.name || e.message) });
  }
}
fs.writeFileSync(new URL('notices-text.json', OUT), JSON.stringify(texts, null, 1));

/* 지정 공고의 첨부 원본 다운로드 */
let fi = 0;
for (const n of notices.items) {
  if (!DOWNLOAD_FORMS_FOR.some((k) => n.title.includes(k))) continue;
  for (const a of n.attachments || []) {
    if (/부속기관|부설/.test(a.name)) continue; // 사이트 공통 링크 제외
    try {
      const res = await fetch(a.url, { redirect: 'follow', headers: UA, signal: AbortSignal.timeout(30000) });
      if (!res.ok) { console.log('attach fail', res.status, a.name); continue; }
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 1000 || buf.length > 15 * 1024 * 1024) continue;
      fi += 1;
      const ext = (a.name.match(/\.(hwp|hwpx|doc|docx|pdf|xls|xlsx|zip)$/i) || [,'bin'])[1];
      fs.writeFileSync(new URL(`form-${fi}.${ext}`, OUT), buf);
      fs.appendFileSync(new URL('forms-index.txt', OUT), `form-${fi}.${ext}\t${n.title}\t${a.name}\t${buf.length}\n`);
      console.log('attach ok:', a.name, buf.length);
    } catch (e) { console.log('attach err', a.name, e.name || e.message); }
  }
}
console.log(`done: ${texts.length} texts, ${fi} attachments`);

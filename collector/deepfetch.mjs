/* 심층 수집: notices.json의 모든 공고 본문 전문 + 지정 공고의 첨부파일 원본을
   저장소(collector/extracted/)에 저장한다. 정식 등록 큐레이션의 원천 자료. */
import fs from 'node:fs';
import { isHtmlPayload } from './attachment-link.mjs';

const HERE = new URL('.', import.meta.url);
const OUT = new URL('extracted/', HERE);
fs.mkdirSync(OUT, { recursive: true });

const notices = JSON.parse(fs.readFileSync(new URL('../data/notices.json', HERE), 'utf8'));
const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; HandaejangBot/0.2)' };

/* 첨부 원본까지 내려받을 공고 (제목 부분일치).
   우선순위: 환경변수 FORM_TARGETS > run-deepfetch.txt의 "targets: a,b,c" 줄 > 기본값.
   (GitHub MCP 없는 세션도 run-deepfetch.txt만 고쳐 push하면 대상 지정 가능) */
function readTargetsFromTrigger() {
  try {
    const txt = fs.readFileSync(new URL('run-deepfetch.txt', HERE), 'utf8');
    const m = txt.match(/^targets:\s*(.+)$/m);
    return m ? m[1].trim() : '';
  } catch { return ''; }
}
const DOWNLOAD_FORMS_FOR = (process.env.FORM_TARGETS || readTargetsFromTrigger() || '조병두')
  .split(',').map((s) => s.trim()).filter(Boolean);

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

/* 지정 공고의 첨부 원본 다운로드.
   예전에는 실행할 때마다 form-* 파일을 전부 지우고 1번부터 다시 채웠다. 그 바람에
   '스키마화 대기'로 큐에 남아 있던 공고의 원본이 다음 수집 때 사라져, 다음 세션이 양식을
   만들 수 없었다(2026-07-30 발견 — 도레이·염곡·시립대 원본이 이렇게 유실됨).
   그래서 파일 이름에 공고별 표식을 넣고, 이번에 다시 받는 공고의 파일만 갈아끼운다. */
const slugOf = (title) => {
  let h = 0;
  for (let i = 0; i < title.length; i++) h = (h * 31 + title.charCodeAt(i)) >>> 0;
  return h.toString(36).slice(0, 6);
};
const targets = notices.items.filter((n) => DOWNLOAD_FORMS_FOR.some((k) => n.title.includes(k)));
const refreshing = new Set(targets.map((n) => slugOf(n.title)));
// 이번에 다시 받는 공고의 예전 파일만 지운다 (다른 공고의 대기 중 원본은 보존)
for (const f of fs.readdirSync(OUT)) {
  const m = f.match(/^form-([a-z0-9]{1,6})-/);
  if (m && refreshing.has(m[1])) fs.unlinkSync(new URL(f, OUT));
}
const indexPath = new URL('forms-index.txt', OUT);
let indexLines = [];
try {
  indexLines = fs.readFileSync(indexPath, 'utf8').split('\n').filter(Boolean)
    .filter((line) => { const m = line.split('\t')[0].match(/^form-([a-z0-9]{1,6})-/); return m && !refreshing.has(m[1]); });
} catch { /* 첫 실행 */ }
let fi = 0;
for (const n of targets) {
  const slug = slugOf(n.title);
  let ai = 0;
  for (const a of n.attachments || []) {
    if (/부속기관|부설/.test(a.name)) continue; // 사이트 공통 링크 제외
    try {
      const res = await fetch(a.url, { redirect: 'follow', headers: UA, signal: AbortSignal.timeout(30000) });
      if (!res.ok) { console.log('attach fail', res.status, a.name); continue; }
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 1000 || buf.length > 15 * 1024 * 1024) continue;
      // 받아 보니 문서가 아니라 웹페이지면 버린다 — 게시판 하단 메뉴(부서 링크 등)를 첨부로
      // 착각해 받아 두면 스키마화가 매번 그걸 붙들고 실패한다(연구지원팀·연구진흥팀 사례).
      if (isHtmlPayload(buf)) { console.log('attach skip (웹페이지였음):', a.name); continue; }
      fi += 1; ai += 1;
      const ext = (a.name.match(/\.(hwp|hwpx|doc|docx|pdf|xls|xlsx|zip)$/i) || [, 'bin'])[1];
      const fname = `form-${slug}-${ai}.${ext}`;
      fs.writeFileSync(new URL(fname, OUT), buf);
      indexLines.push(`${fname}\t${n.title}\t${a.name}\t${buf.length}`);
      console.log('attach ok:', a.name, buf.length);
    } catch (e) { console.log('attach err', a.name, e.name || e.message); }
  }
}
fs.writeFileSync(indexPath, indexLines.join('\n') + (indexLines.length ? '\n' : ''));
console.log(`done: ${texts.length} texts, ${fi} attachments`);

/* ============================================================
   한대장 사내 보고서 양식 (report-kit) — 명세 JSON 하나를 A4 PDF 로
   2026-11-17 개발자 지시(이선주): "사내 보고서 양식을 리서치한 뒤 우리 앱에 맞는 양식을 만들어 적용 ·
   다음에도 쓸 수 있게". 양식 규칙과 명세 꼴은 tools/report-kit/README.md.
   ------------------------------------------------------------
   쪽 구성: 표지(로고·문서 정보·결재란) → 보고 개요(두괄식 한 쪽) → 장(Ⅰ·Ⅱ·Ⅲ …, 장마다 새 쪽) → 붙임(출처·용어·문서 이력) → 끝.
   본문 쪽은 모두 같은 머리글(로고·문서 제목 | 문서 번호·보안 등급)과 바닥글(보안 문구 | 쪽 번호)을 쓴다.

   쓰는 법:
     node tools/report-kit/build.mjs <명세.json> --out <보고서.pdf> [--png <미리보기 폴더>]
   글꼴: 앱과 같은 Pretendard. REPORT_FONT_DIR → node_modules/pretendard → 없으면 npm pack 으로 임시 폴더에 받는다.
   🔴 보고서 PDF·명세는 저장소에 커밋하지 않는다(공개 저장소 · 사내 문서) — 세션 임시 폴더에 만든다.
   ============================================================ */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const ROMAN = ['Ⅰ', 'Ⅱ', 'Ⅲ', 'Ⅳ', 'Ⅴ', 'Ⅵ', 'Ⅶ', 'Ⅷ', 'Ⅸ', 'Ⅹ', 'Ⅺ', 'Ⅻ', 'XIII', 'XIV', 'XV'];

export const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// **굵게** · `코드` · 줄바꿈
export const md = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/`(.+?)`/g, '<code>$1</code>').replace(/\n/g, '<br>');
const cssStr = (s) => String(s ?? '').replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, ' ');
const num = (n) => (typeof n === 'number' ? n.toLocaleString('en-US') : String(n ?? ''));

// 로고: 앱 아이콘(icons/icon.svg)을 그대로 쓴다 — 크기만 붙인다(없으면 @page 칸에서 쪽 전체로 커진다)
export function logoDataUri(size = 14) {
  const svg = fs.readFileSync(path.join(ROOT, 'icons', 'icon.svg'), 'utf8')
    .replace('<svg ', `<svg width="${size}" height="${size}" `);
  return 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
}

export function findFonts() {
  const cands = [process.env.REPORT_FONT_DIR, path.join(ROOT, 'node_modules', 'pretendard', 'dist', 'public', 'static'),
    path.join(os.tmpdir(), 'report-kit-pretendard', 'package', 'dist', 'public', 'static')].filter(Boolean);
  for (const d of cands) if (fs.existsSync(path.join(d, 'Pretendard-Regular.otf'))) return d;
  // 없으면 받는다 (npm 레지스트리 · 한 번만)
  try {
    const dir = path.join(os.tmpdir(), 'report-kit-pretendard');
    fs.mkdirSync(dir, { recursive: true });
    const tgz = execFileSync('npm', ['pack', 'pretendard@1.3.9', '--silent'], { cwd: dir, encoding: 'utf8' }).trim().split('\n').pop();
    execFileSync('tar', ['xzf', tgz], { cwd: dir });
    const d = path.join(dir, 'package', 'dist', 'public', 'static');
    if (fs.existsSync(path.join(d, 'Pretendard-Regular.otf'))) return d;
  } catch (e) { console.warn('⚠️ Pretendard 를 받지 못했다:', e.message); }
  return null;
}

// ── 블록 ─────────────────────────────────────────────────
function points(items) {
  const li = (x) => typeof x === 'string' ? `<li>${md(x)}</li>`
    : `<li>${md(x.text)}${x.sub?.length ? `<ul>${x.sub.map(li).join('')}</ul>` : ''}</li>`;
  return `<ul class="pts">${items.map(li).join('')}</ul>`;
}
function table(b) {
  return `<table class="tb"><thead><tr>${b.columns.map((c) => `<th${c.width ? ` style="width:${c.width}"` : ''}>${esc(c.label ?? c)}</th>`).join('')}</tr></thead>
  <tbody>${b.rows.map((r) => `<tr>${r.map((c) => `<td>${md(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}
function bars(b) {
  const max = b.max || Math.max(1, ...b.items.map((i) => Number(i.value) || 0));
  return `<div class="bars">${b.items.map((i) => `<div class="bar${i.tone ? ' t-' + i.tone : ''}"><span class="lb">${md(i.label)}</span>
    <span class="tr"><span class="fl" style="width:${Math.max(0.5, (i.value / max) * 100).toFixed(1)}%"></span></span>
    <span class="vl">${esc(i.display ?? num(i.value))}${b.unit ? ' ' + esc(b.unit) : ''}</span></div>`).join('')}</div>`;
}
function figures(items, cols = 3) {
  return `<div class="figs" style="grid-template-columns:repeat(${cols},1fr)">${items.map((f) => `<div class="fig${f.tone ? ' t-' + f.tone : ''}">
    <div class="k">${md(f.label)}</div><div class="v">${esc(num(f.value))}<small>${esc(f.unit || '')}</small></div>${f.note ? `<div class="d">${md(f.note)}</div>` : ''}</div>`).join('')}</div>`;
}
function block(b, ctx) {
  const title = b.title ? `<div class="blk-title">${md(b.title)}</div>` : '';
  const note = b.note ? `<div class="blk-note">${md(b.note)}</div>` : '';
  switch (b.type) {
    case 'subhead': ctx.sub += 1; return `<h3 class="sub"><span class="n">${ctx.sub}.</span>${md(b.text)}</h3>`;
    case 'points': return `<div class="blk">${title}${points(b.items)}${note}</div>`;
    case 'table': return `<div class="blk">${title}${table(b)}${note}</div>`;
    case 'bars': return `<div class="blk">${title}${bars(b)}${note}</div>`;
    case 'figures': return `<div class="blk">${title}${figures(b.items, b.cols)}${note}</div>`;
    case 'compare': return `<div class="blk">${title}<div class="cmp">${[['plus', b.left], ['minus', b.right]].map(([k, s]) => `<div class="${k}"><h4>${md(s.label)}</h4><ul>${s.items.map((x) => `<li>${md(x)}</li>`).join('')}</ul></div>`).join('')}</div>${note}</div>`;
    case 'steps': return `<div class="blk">${title}<ol class="steps">${b.items.map((s) => `<li><div><div class="st">${md(s.title)}</div>${s.note ? `<div class="sn">${md(s.note)}</div>` : ''}</div><div class="so">${esc(s.owner || '')}</div></li>`).join('')}</ol>${note}</div>`;
    case 'note': return `<div class="blk"><div class="note${b.tone === 'warn' ? ' warn' : ''}"><b class="mk">※</b>${md(b.text)}</div></div>`;
    case 'text': return `<div class="blk">${(b.paras || [b.text]).map((p) => `<p style="margin:0 0 2mm">${md(p)}</p>`).join('')}</div>`;
    default: throw new Error(`모르는 블록 type: ${b.type}`);
  }
}

// ── 문서 ─────────────────────────────────────────────────
export function renderHtml(spec) {
  const m = spec.meta;
  const fontDir = findFonts();
  if (!fontDir) console.warn('⚠️ Pretendard 글꼴이 없다 — 시스템 글꼴로 그린다');
  const face = (w, f) => fontDir ? `@font-face{font-family:Pretendard;font-weight:${w};src:url("${pathToFileURL(path.join(fontDir, f)).href}") format("opentype");}` : '';
  const css = fs.readFileSync(path.join(HERE, 'report.css'), 'utf8');
  const security = m.security || '사내 한정';
  const headLeft = `url("${logoDataUri(13)}") "  한대장  |  ${cssStr(m.runningTitle || m.title)}"`;
  const pageCss = `@page { size: A4; margin: 20mm 16mm 17mm 16mm;
    @top-left { content: ${headLeft}; font: 600 7.6pt Pretendard, sans-serif; color: #1e2b42; vertical-align: bottom; padding-bottom: 3mm; border-bottom: 0.25mm solid #d9dde4; }
    @top-right { content: "${cssStr(m.docNo || '')}   ${cssStr(security)}"; font: 600 7.6pt Pretendard, sans-serif; color: #858b96; vertical-align: bottom; padding-bottom: 3mm; border-bottom: 0.25mm solid #d9dde4; }
    @bottom-left { content: "${cssStr(m.footer || `한대장 · ${security} · 외부 공유 금지`)}"; font: 500 7.2pt Pretendard, sans-serif; color: #858b96; vertical-align: top; padding-top: 3mm; border-top: 0.25mm solid #d9dde4; }
    @bottom-right { content: "- " counter(page) " / " counter(pages) " -"; font: 600 7.4pt Pretendard, sans-serif; color: #4a505c; vertical-align: top; padding-top: 3mm; border-top: 0.25mm solid #d9dde4; } }
  @page :first { margin: 16mm 16mm 14mm 16mm; @top-left { content: none; border: 0; } @top-right { content: none; border: 0; } @bottom-left { content: none; border: 0; } @bottom-right { content: none; border: 0; } }`;

  const info = (m.fields || []).map(([k, v]) => `<tr><th>${esc(k)}</th><td>${md(v)}</td></tr>`).join('');
  const approvals = m.approvals || [{ role: '작성', name: '' }, { role: '검토', name: '' }, { role: '승인', name: '' }];
  const cover = `<section class="cover">
    <div class="cv-band"><img src="${logoDataUri(48)}" alt=""><div class="cv-org"><b>한대장</b><span>한국 대학교 장학금 · ${esc(m.dept || '')}</span></div><div class="cv-sec">${esc(security)}</div></div>
    <div class="cv-main"><div class="cv-type">${esc(m.docType || '사내 보고서')}</div><h1 class="cv-title">${md(m.title)}</h1>${m.subtitle ? `<div class="cv-sub">${md(m.subtitle)}</div>` : ''}<div class="cv-rule"></div></div>
    <div class="cv-bottom"><table class="cv-info">${info}</table>
      <table class="approval"><caption>결 재</caption><thead><tr>${approvals.map((a) => `<th>${esc(a.role)}</th>`).join('')}</tr></thead><tbody><tr>${approvals.map((a) => `<td>${esc(a.name || '')}</td>`).join('')}</tr></tbody></table></div>
    <div class="cv-foot"><span>${esc(m.docNo || '')}</span><span>${esc(m.date || '')}</span><span>한대장 · ${esc(security)}</span></div>
  </section>`;

  const overview = spec.overview ? `<section class="chapter">
    <div class="ch-head"><div class="ch-no sm">요약</div><div class="ch-title"><h2>보고 개요</h2><p>${md(spec.overviewLead || '이 보고서의 목적 · 결론 · 요청 사항을 한 쪽에 모았습니다.')}</p></div></div>
    <table class="ov">${spec.overview.map((r) => `<tr><th>${esc(r.label)}</th><td>${Array.isArray(r.text) ? points(r.text) : md(r.text)}</td></tr>`).join('')}</table>
    ${spec.keyFigures ? `<div class="blk-title">핵심 수치</div>${figures(spec.keyFigures, spec.keyFiguresCols || 3)}` : ''}
  </section>` : '';

  const chapters = (spec.chapters || []).map((c, i) => {
    const ctx = { sub: 0 };
    return `<section class="chapter"><div class="ch-head"><div class="ch-no">${ROMAN[i] || i + 1}</div><div class="ch-title"><h2>${md(c.title)}</h2>${c.summary ? `<p>${md(c.summary)}</p>` : ''}</div></div>
      ${(c.blocks || []).map((b) => block(b, ctx)).join('\n')}</section>`;
  }).join('\n');

  const ap = spec.appendix || {};
  const appendix = (ap.sources || ap.glossary || m.revisions) ? `<section class="chapter"><div class="ch-head"><div class="ch-no sm">붙임</div><div class="ch-title"><h2>붙임</h2><p>출처 · 용어 · 문서 이력</p></div></div>
    ${ap.sources ? `<h3 class="sub"><span class="n">1.</span>출처 · 확인 방법</h3><ol class="src">${ap.sources.map((s) => `<li>${md(s)}</li>`).join('')}</ol>` : ''}
    ${ap.glossary ? `<h3 class="sub"><span class="n">${ap.sources ? 2 : 1}.</span>용어 풀이</h3>${table({ columns: [{ label: '용어', width: '26%' }, { label: '뜻' }], rows: ap.glossary })}` : ''}
    ${m.revisions ? `<h3 class="sub"><span class="n">${1 + (ap.sources ? 1 : 0) + (ap.glossary ? 1 : 0)}.</span>문서 이력</h3>${table({ columns: [{ label: '판', width: '12%' }, { label: '날짜', width: '18%' }, { label: '바뀐 내용' }], rows: m.revisions.map((r) => [r.ver, r.date, r.note]) })}` : ''}
    <div class="end-mark">끝.</div></section>` : '<div class="end-mark">끝.</div>';

  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${esc(m.title)}</title>
<style>${face(400, 'Pretendard-Regular.otf')}${face(500, 'Pretendard-Medium.otf')}${face(600, 'Pretendard-SemiBold.otf')}${face(700, 'Pretendard-Bold.otf')}${face(800, 'Pretendard-ExtraBold.otf')}
${pageCss}
${css}</style></head><body>${cover}${overview}${chapters}${appendix}</body></html>`;
}

async function loadChromium() {
  const req = createRequire(import.meta.url);
  for (const mod of ['playwright', 'playwright-core']) {
    try { return (await import(mod)).chromium; } catch { /* 다음 */ }
    try { return req(mod).chromium; } catch { /* 다음 */ }
  }
  throw new Error('playwright 를 못 찾았다');
}

export async function build(spec, { out, png } = {}) {
  const htmlPath = out.replace(/\.pdf$/i, '') + '.html';
  fs.writeFileSync(htmlPath, renderHtml(spec));
  const chromium = await loadChromium();
  const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
  try {
    const page = await browser.newPage();
    await page.goto(pathToFileURL(path.resolve(htmlPath)).href, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    await page.pdf({ path: out, printBackground: true, preferCSSPageSize: true });
  } finally { await browser.close(); }
  if (png) {
    fs.mkdirSync(png, { recursive: true });
    try { execFileSync('pdftoppm', ['-r', '60', '-png', out, path.join(png, 'page')]); } catch (e) { console.warn('미리보기 실패:', e.message); }
  }
  return { out, html: htmlPath };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
  const specPath = args.find((a, i) => !a.startsWith('--') && !['--out', '--png'].includes(args[i - 1]));
  if (!specPath) { console.error('쓰는 법: node tools/report-kit/build.mjs <명세.json> --out <보고서.pdf> [--png 폴더]'); process.exit(2); }
  const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
  const r = await build(spec, { out: opt('--out') || specPath.replace(/\.json$/i, '.pdf'), png: opt('--png') });
  console.log(`✓ ${r.out}`);
}

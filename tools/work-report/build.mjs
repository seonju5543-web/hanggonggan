/* ============================================================
   사내 작업 보고서 PDF 만들기 (2026-10-12 개발자 지시 — "작업이 끝날 때와 하루의 마지막 작업이 끝난 뒤
   그날 한 일을 사내관리문서 PDF 로 만들어 제시 · 수치는 모두 시각 자료로")
   ------------------------------------------------------------
   보고서 내용은 JSON 명세 하나(meta · kpis · sections · sources)이고, 이 파일은 그것을 A4 문서로 그린다.
   그림(막대·쌓은 막대·세로 막대·일정표·비율 막대)은 모두 이 파일이 SVG 로 직접 그린다 — 바깥 그림 도구가 필요 없다.
   글꼴은 앱과 같은 Pretendard. 색은 dataviz 기본 팔레트(범주 순서 고정 · 상태 색은 심각도에만).

   쓰는 법:
     node tools/work-report/build.mjs <명세.json> --out <보고서.pdf> [--html <중간.html>] [--png <미리보기 폴더>]
     글꼴: REPORT_FONT_DIR(Pretendard-Regular/Medium/SemiBold/Bold.otf 가 든 폴더) → tools/work-report/fonts/
           → node_modules/pretendard/dist/public/static/ 순으로 찾는다. 없으면 `npm pack pretendard@1.3.9` 로 받아 푼다.
     브라우저: playwright(또는 playwright-core) · CHROME_PATH 가 있으면 그것을 쓴다.
   🔴 보고서 PDF 는 저장소에 커밋하지 않는다(공개 저장소 · 사내 문서) — 세션 임시 폴더에 만들고 파일로 전한다.
   🔴 숫자는 원천(기록 파일·git·Actions·노션)에서 센 것만 쓴다 — 명세의 sources 에 어디서 셌는지 적는다.
   명세의 꼴은 tools/work-report/README.md.
   ============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const HERE = path.dirname(fileURLToPath(import.meta.url));

// ── 색 (dataviz 기본 팔레트 · 밝은 면) ──────────────────────────
export const SERIES = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'];
export const STATUS = { good: '#0ca30c', warning: '#fab219', serious: '#ec835a', critical: '#d03b3b', neutral: '#a8a69e' };
const INK = { primary: '#0b0b0b', secondary: '#52514e', muted: '#8a8880', grid: '#e7e5e0', axis: '#c9c7c0', track: '#eeece7', panel: '#f6f5f2', surface: '#ffffff' };
const ACCENT = '#184f95';

export function color(c, i = 0) {
  if (!c) return SERIES[i % SERIES.length];
  if (c.startsWith('#')) return c;
  const [kind, key] = c.split(':');
  if (kind === 'series') return SERIES[(Number(key) - 1) % SERIES.length];
  if (kind === 'status') return STATUS[key] || STATUS.neutral;
  if (kind === 'ink') return INK[key] || INK.muted;
  return SERIES[i % SERIES.length];
}

// 채움 위 글자색 — 밝은 채움(노랑·하늘)엔 검정, 진한 채움엔 흰색
function onFill(hex) {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return L > 0.36 ? INK.primary : '#ffffff';
}

// ── 글자 폭 어림 (Pretendard) ──────────────────────────────────
export function textWidth(s, size) {
  let w = 0;
  for (const ch of String(s)) {
    const c = ch.codePointAt(0);
    if ((c >= 0xac00 && c <= 0xd7a3) || (c >= 0x3130 && c <= 0x318f) || (c >= 0x4e00 && c <= 0x9fff)) w += 0.93;
    else if (/[0-9]/.test(ch)) w += 0.6;
    else if (/[A-Z]/.test(ch)) w += 0.66;
    else if (ch === ' ') w += 0.27;
    else if (/[.,:;'`·|!()[\]/-]/.test(ch)) w += 0.34;
    else if (/[a-z]/.test(ch)) w += 0.54;
    else w += 0.9;
  }
  return w * size;
}

const cssStr = (s) => String(s ?? '').replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/</g, '\\3c ').replace(/\n/g, ' ');
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// 짧은 꾸밈: **굵게** · `코드` · 줄바꿈
export function inline(s) {
  return esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/`(.+?)`/g, '<code>$1</code>').replace(/\n/g, '<br>');
}
export const fmt = (n, d = 0) => (n == null || Number.isNaN(n) ? '–' : Number(n).toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d }));

// 막대 끝만 둥근 가로 막대 (바닥선 쪽은 각지게)
function hbarPath(x, y, w, h, r = 4) {
  if (w <= 0) return '';
  r = Math.min(r, h / 2, w);
  return `M${x},${y}h${w - r}a${r},${r} 0 0 1 ${r},${r}v${h - 2 * r}a${r},${r} 0 0 1 ${-r},${r}h${-(w - r)}z`;
}
// 위끝만 둥근 세로 막대
function vbarPath(x, y, w, h, r = 4) {
  if (h <= 0) return '';
  r = Math.min(r, w / 2, h);
  return `M${x},${y + h}v${-(h - r)}a${r},${r} 0 0 1 ${r},${-r}h${w - 2 * r}a${r},${r} 0 0 1 ${r},${r}v${h - r}z`;
}
const T = (x, y, s, { size = 12, weight = 400, fill = INK.secondary, anchor = 'start', baseline = 'middle' } = {}) =>
  `<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}" dominant-baseline="${baseline}">${esc(s)}</text>`;
const svg = (w, h, body, label) => `<svg class="chart" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${esc(label || '')}" xmlns="http://www.w3.org/2000/svg" font-family="Pretendard, sans-serif">${body}</svg>`;

// ── 가로 막대 ───────────────────────────────────────────────
export function hbars(b, W = 660) {
  const items = b.items || [];
  if (!items.length) return svg(W, 20, T(0, 10, '(자료 없음)', { size: 11, fill: INK.muted }), b.title);
  const size = 12;
  const labelW = Math.min(b.labelWidth || 240, Math.max(...items.map((it) => textWidth(it.label, size))) + 14);
  const valTxt = (it) => `${fmt(it.value, b.decimals || 0)}${it.unit ?? b.unit ?? ''}`;
  const noteW = Math.max(0, ...items.map((it) => (it.note ? textWidth(it.note, 11) + 8 : 0)));
  const valueW = Math.max(...items.map((it) => textWidth(valTxt(it), size))) + 10 + noteW;
  const rowH = b.rowHeight || 26, barH = b.barHeight || 14, top = 4;
  const x0 = labelW, area = Math.max(80, W - labelW - valueW - 4);
  const max = b.max || Math.max(1, ...items.map((it) => it.value));
  const H = top + items.length * rowH + 4;
  let body = `<line x1="${x0}" y1="${top - 2}" x2="${x0}" y2="${H - 2}" stroke="${INK.axis}" stroke-width="1"/>`;
  items.forEach((it, i) => {
    const y = top + i * rowH, cy = y + rowH / 2;
    const w = (it.value / max) * area;
    const fill = color(it.color || b.color, b.colorByIndex ? i : 0);
    body += T(0, cy, it.label, { size, fill: it.strong ? INK.primary : INK.secondary, weight: it.strong ? 600 : 400 });
    if (w > 0) body += `<path d="${hbarPath(x0, cy - barH / 2, Math.max(w, 2), barH)}" fill="${fill}"/>`;
    const vx = x0 + Math.max(w, 0) + 6;
    body += T(vx, cy, valTxt(it), { size, weight: 600, fill: INK.primary });
    if (it.note) body += T(vx + textWidth(valTxt(it), size) + 8, cy, it.note, { size: 11, fill: INK.muted });
  });
  return svg(W, H, body, b.title);
}

// ── 쌓은 가로 막대 (구성) ────────────────────────────────────
export function stacked(b, W = 660) {
  const series = b.series.map((s, i) => ({ ...s, fill: color(s.color, i) }));
  const rows = b.rows || [];
  if (!rows.length) return svg(W, 20, T(0, 10, '(자료 없음)', { size: 11, fill: INK.muted }), b.title);
  const size = 12;
  const total = (r) => series.reduce((a, s) => a + (r.values[s.key] || 0), 0);
  const labelW = Math.min(b.labelWidth || 220, Math.max(...rows.map((r) => textWidth(r.label, size))) + 14);
  const valueW = Math.max(...rows.map((r) => textWidth(fmt(total(r)) + (b.unit || ''), size))) + 12;
  const rowH = b.rowHeight || 26, barH = b.barHeight || 16;
  const x0 = labelW, area = Math.max(80, W - labelW - valueW - 4);
  const max = b.max || Math.max(1, ...rows.map(total));
  // 범례 — 폭을 넘으면 다음 줄로 (좁은 칸에서 글자가 잘리지 않게)
  let legend = '', legendH = 0;
  if (b.legend !== false) {
    const items = series.map((s) => {
      const sum = rows.reduce((a, r) => a + (r.values[s.key] || 0), 0);
      const lbl = b.legendTotals === false ? s.label : `${s.label} ${fmt(sum)}`;
      return { s, lbl, w: 15 + textWidth(lbl, 11.5) + 16 };
    });
    const need = items.reduce((a, it) => a + it.w, 0) - 16;
    const start = x0 + need <= W ? x0 : 0;   // 막대 칸에 다 들어가면 막대 위에, 아니면 왼쪽 끝부터
    let lx = start, ly = 11;
    for (const { s, lbl, w } of items) {
      if (lx > start && lx + w - 16 > W) { lx = start; ly += 18; }
      legend += `<rect x="${lx}" y="${ly - 5}" width="10" height="10" rx="2" fill="${s.fill}"/>` + T(lx + 15, ly, lbl, { size: 11.5, fill: INK.secondary });
      lx += w;
    }
    legendH = ly + 15;
  }
  const H = legendH + rows.length * rowH + 6;
  let body = legend;
  body += `<line x1="${x0}" y1="${legendH}" x2="${x0}" y2="${H - 4}" stroke="${INK.axis}" stroke-width="1"/>`;
  rows.forEach((r, i) => {
    const y = legendH + i * rowH + (rowH - barH) / 2, cy = y + barH / 2;
    body += T(0, cy, r.label, { size, fill: r.strong ? INK.primary : INK.secondary, weight: r.strong ? 600 : 400 });
    const segs = series.map((s) => ({ s, v: r.values[s.key] || 0 })).filter((g) => g.v > 0);
    let cx = x0;
    segs.forEach((g, j) => {
      const full = (g.v / max) * area;
      const last = j === segs.length - 1;
      const w = last ? full : Math.max(full - 2, 0.8);
      body += last ? `<path d="${hbarPath(cx, y, Math.max(w, 2), barH)}" fill="${g.s.fill}"/>` : `<rect x="${cx}" y="${y}" width="${w}" height="${barH}" fill="${g.s.fill}"/>`;
      const lab = fmt(g.v);
      if (b.segmentLabels !== false && w > textWidth(lab, 10.5) + 6) body += T(cx + w / 2, cy, lab, { size: 10.5, weight: 600, fill: onFill(g.s.fill), anchor: 'middle' });
      cx += full;
    });
    body += T(cx + 6, cy, fmt(total(r)) + (b.unit || ''), { size, weight: 600, fill: INK.primary });
  });
  return svg(W, H, body, b.title);
}

// ── 세로 막대 (날짜·차례) ────────────────────────────────────
export function columns(b, W = 660) {
  const items = b.items || [];
  if (!items.length) return svg(W, 20, T(0, 10, '(자료 없음)', { size: 11, fill: INK.muted }), b.title);
  const H = b.height || 190, top = 26, bottom = b.sublabels ? 34 : 22, left = 4, right = 4;
  const ph = H - top - bottom, pw = W - left - right;
  const band = pw / items.length, bw = Math.min(b.barWidth || 30, band * 0.62);
  const max = b.max || Math.max(1, ...items.map((it) => it.value));
  let body = '';
  for (const s of b.shade || []) {
    const i0 = items.findIndex((it) => it.label === s.from), i1 = items.findIndex((it) => it.label === s.to);
    if (i0 < 0 || i1 < 0) continue;
    const x = left + i0 * band + 1, w = (i1 - i0 + 1) * band - 2;
    body += `<rect x="${x}" y="${top - 18}" width="${w}" height="${ph + 18}" rx="4" fill="${INK.panel}"/>` + T(x + w / 2, top - 9, s.label, { size: 10.5, fill: INK.muted, anchor: 'middle' });
  }
  [0.5, 1].forEach((f) => { const y = top + ph - ph * f; body += `<line x1="${left}" y1="${y}" x2="${W - right}" y2="${y}" stroke="${INK.grid}" stroke-width="1" stroke-dasharray="2 3"/>`; });
  body += `<line x1="${left}" y1="${top + ph}" x2="${W - right}" y2="${top + ph}" stroke="${INK.axis}" stroke-width="1"/>`;
  items.forEach((it, i) => {
    const cx = left + i * band + band / 2;
    const h = (it.value / max) * ph;
    const fill = color(it.color || b.color);
    if (h > 0) body += `<path d="${vbarPath(cx - bw / 2, top + ph - Math.max(h, 2), bw, Math.max(h, 2))}" fill="${fill}"/>`;
    body += T(cx, top + ph - Math.max(h, 0) - 8, fmt(it.value) + (b.unit || ''), { size: 11, weight: 600, fill: it.value ? INK.primary : INK.muted, anchor: 'middle' });
    body += T(cx, top + ph + 12, it.label, { size: 10.5, fill: INK.secondary, anchor: 'middle' });
    if (b.sublabels && it.sub) body += T(cx, top + ph + 26, it.sub, { size: 10, fill: INK.muted, anchor: 'middle' });
  });
  return svg(W, H, body, b.title);
}

// ── 일정표 (단계 · 기간) ─────────────────────────────────────
export function timeline(b, W = 660) {
  const day = (s) => Date.parse(s + 'T00:00:00Z') / 864e5;
  const d0 = day(b.from), d1 = day(b.to) + 1;
  const size = 12;
  const labelW = Math.min(200, Math.max(...b.items.map((it) => textWidth(it.label, size))) + 14);
  const rowH = 28, top = 26, area = W - labelW - 6;
  const H = top + b.items.length * rowH + 6;
  const X = (d) => labelW + ((d - d0) / (d1 - d0)) * area;
  let body = '';
  for (let d = d0; d < d1; d++) {
    const x = X(d), date = new Date(d * 864e5);
    const md = `${date.getUTCMonth() + 1}/${date.getUTCDate()}`;
    const dow = '일월화수목금토'[date.getUTCDay()];
    if ([0, 6].includes(date.getUTCDay()) || (b.holidays || []).includes(date.toISOString().slice(0, 10))) body += `<rect x="${x}" y="${top - 4}" width="${area / (d1 - d0)}" height="${H - top}" fill="${INK.panel}"/>`;
    body += `<line x1="${x}" y1="${top - 4}" x2="${x}" y2="${H - 4}" stroke="${INK.grid}" stroke-width="1"/>`;
    body += T(x + area / (d1 - d0) / 2, 9, md, { size: 10.5, fill: INK.secondary, anchor: 'middle' }) + T(x + area / (d1 - d0) / 2, 20, dow, { size: 9.5, fill: INK.muted, anchor: 'middle' });
  }
  b.items.forEach((it, i) => {
    const cy = top + i * rowH + rowH / 2;
    body += T(0, cy, it.label, { size, fill: INK.primary, weight: 500 });
    const x1 = X(day(it.start) + (it.startFrac || 0)), x2 = X(day(it.end) + (it.endFrac ?? 1));
    if (it.kind === 'milestone') {
      body += `<path d="M${x1},${cy - 7}l7,7l-7,7l-7,-7z" fill="${color(it.color || 'series:2')}"/>`;
      if (it.note) body += T(x1 + 11, cy, it.note, { size: 11, fill: INK.secondary });
      return;
    }
    const fill = it.kind === 'pause' ? INK.track : color(it.color);
    body += `<rect x="${x1}" y="${cy - 8}" width="${Math.max(x2 - x1, 3)}" height="16" rx="4" fill="${fill}"${it.kind === 'pause' ? ` stroke="${INK.axis}" stroke-dasharray="3 2"` : ''}/>`;
    if (it.note) {
      const inside = textWidth(it.note, 10.5) + 10 < x2 - x1;
      body += inside ? T((x1 + x2) / 2, cy, it.note, { size: 10.5, weight: 600, fill: it.kind === 'pause' ? INK.secondary : onFill(fill), anchor: 'middle' })
        : T(x2 + 5, cy, it.note, { size: 10.5, fill: INK.secondary });
    }
  });
  return svg(W, H, body, b.title);
}

// ── 비율 막대 (n / 전체) ─────────────────────────────────────
export function meters(b) {
  return `<div class="meters"${b.columns ? ` style="grid-template-columns:repeat(${b.columns},1fr);column-gap:6mm"` : ''}>${b.items.map((it) => {
    const pct = it.total ? (it.value / it.total) * 100 : it.value;
    const fill = color(it.color || 'series:1');
    const big = `${fmt(pct, it.decimals ?? 0)}%`;
    return `<div class="meter"><div class="mhead"><span class="mlabel">${inline(it.label)}</span><span class="mbig">${big}</span></div>
      <svg class="mbar" viewBox="0 0 100 8" preserveAspectRatio="none" width="100%" height="8"><rect x="0" y="0" width="100" height="8" rx="4" fill="${INK.track}"/><path d="${hbarPath(0, 0, Math.max(Math.min(pct, 100), 1.5), 8, 4)}" fill="${fill}"/>${it.target ? `<line x1="${it.target}" y1="-1" x2="${it.target}" y2="9" stroke="${INK.primary}" stroke-width="0.6"/>` : ''}</svg>
      <div class="mcap">${it.total ? `${fmt(it.value)} / ${fmt(it.total)}${it.unit ? ' ' + esc(it.unit) : ''}` : ''}${it.note ? `<span class="mnote">${inline(it.note)}</span>` : ''}</div></div>`;
  }).join('')}</div>`;
}

// ── 숫자 칸 ────────────────────────────────────────────────
export function kpis(items, cols = 3) {
  return `<div class="kpis" style="grid-template-columns:repeat(${cols},1fr)">${items.map((k) => `<div class="kpi${k.tone ? ' tone-' + k.tone : ''}">
    <div class="klabel">${inline(k.label)}</div>
    <div class="kvalue">${esc(typeof k.value === 'number' ? fmt(k.value, k.decimals || 0) : k.value)}<span class="kunit">${esc(k.unit || '')}</span></div>
    ${k.note ? `<div class="knote">${inline(k.note)}</div>` : ''}</div>`).join('')}</div>`;
}

function block(b) {
  const head = b.title ? `<div class="fig-head"><div class="fig-title">${inline(b.title)}</div>${b.subtitle ? `<div class="fig-sub">${inline(b.subtitle)}</div>` : ''}</div>` : '';
  const foot = b.caption ? `<div class="fig-cap">${inline(b.caption)}</div>` : '';
  const W = b.width || 660;
  switch (b.type) {
    case 'text': return `<div class="text">${(b.paras || [b.md]).map((p) => `<p>${inline(p)}</p>`).join('')}</div>`;
    case 'list': { const tag = b.ordered ? 'ol' : 'ul'; return `${b.title ? head : ''}<${tag} class="list${b.ordered ? ' ordered' : ''}">${b.items.map((x) => `<li>${inline(x)}</li>`).join('')}</${tag}>`; }
    case 'callout': return `<div class="callout ${b.tone || 'info'}">${b.title ? `<div class="ctitle">${inline(b.title)}</div>` : ''}${(b.paras || [b.md]).map((p) => `<p>${inline(p)}</p>`).join('')}</div>`;
    case 'kpis': return `<figure class="fig">${head}${kpis(b.items, b.cols || 3)}${foot}</figure>`;
    case 'bars': return `<figure class="fig">${head}${hbars(b, W)}${foot}</figure>`;
    case 'stacked': return `<figure class="fig">${head}${stacked(b, W)}${foot}</figure>`;
    case 'columns': return `<figure class="fig">${head}${columns(b, W)}${foot}</figure>`;
    case 'timeline': return `<figure class="fig">${head}${timeline(b, W)}${foot}</figure>`;
    case 'meters': return `<figure class="fig">${head}${meters(b)}${foot}</figure>`;
    case 'steps': return `<figure class="fig">${head}<ol class="steps">${b.items.map((s, i) => `<li class="${s.state || ''}"><span class="snum">${i + 1}</span><div><div class="stitle">${inline(s.title)}</div>${s.note ? `<div class="snote">${inline(s.note)}</div>` : ''}</div>${s.badge ? `<span class="sbadge ${s.state || ''}">${esc(s.badge)}</span>` : ''}</li>`).join('')}</ol>${foot}</figure>`;
    case 'table': return `<figure class="fig">${head}<table class="tbl"><thead><tr>${b.columns.map((c) => `<th${c.width ? ` style="width:${c.width}"` : ''}>${esc(c.label || c)}</th>`).join('')}</tr></thead><tbody>${b.rows.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>${foot}</figure>`;
    case 'grid': return `<div class="grid" style="grid-template-columns:${b.template || '1fr 1fr'}">${b.blocks.map((x) => `<div>${block({ ...x, width: x.width || b.cellWidth || 320 })}</div>`).join('')}</div>`;
    case 'chips': return `<div class="chips">${b.items.map((c) => `<span class="chip ${c.tone || ''}">${c.icon ? `<b>${esc(c.icon)}</b> ` : ''}${inline(c.text)}</span>`).join('')}</div>`;
    default: throw new Error(`모르는 블록 종류: ${b.type}`);
  }
}

function findFonts() {
  const cands = [process.env.REPORT_FONT_DIR, path.join(HERE, 'fonts'), path.join(HERE, '../../node_modules/pretendard/dist/public/static')].filter(Boolean);
  for (const d of cands) if (fs.existsSync(path.join(d, 'Pretendard-Regular.otf'))) return d;
  return null;
}

export function renderHtml(spec) {
  const m = spec.meta;
  const fontDir = findFonts();
  if (!fontDir) console.warn('⚠️ Pretendard 글꼴을 못 찾았다 — 시스템 글꼴로 그린다(REPORT_FONT_DIR 참고)');
  const face = (w, f) => fontDir ? `@font-face{font-family:Pretendard;font-weight:${w};src:url("${pathToFileURL(path.join(fontDir, f)).href}") format("opentype");}` : '';
  const css = fs.readFileSync(path.join(HERE, 'report.css'), 'utf8');
  const metaRows = (m.fields || []).map(([k, v]) => `<tr><th>${esc(k)}</th><td>${inline(v)}</td></tr>`).join('');
  const sections = (spec.sections || []).map((s, i) => `<section class="sec${s.newPage ? ' newpage' : ''}">
    <h2><span class="secno">${String(i + 1).padStart(2, '0')}</span>${inline(s.title)}</h2>
    ${s.lead ? `<p class="lead">${inline(s.lead)}</p>` : ''}
    ${(s.blocks || []).map(block).join('\n')}
  </section>`).join('\n');
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${esc(m.title)}</title>
<style>${face(400, 'Pretendard-Regular.otf')}${face(500, 'Pretendard-Medium.otf')}${face(600, 'Pretendard-SemiBold.otf')}${face(700, 'Pretendard-Bold.otf')}
@page { size: A4; margin: 17mm 15mm 16mm 15mm;
  @top-left { content: "${cssStr(m.runningTitle || m.title)}"; font: 500 7.5pt Pretendard, sans-serif; color: #8a8880; }
  @top-right { content: "${cssStr(m.docNo || '')}"; font: 500 7.5pt Pretendard, sans-serif; color: #8a8880; }
  @bottom-left { content: "${cssStr(m.classification || '사내 한정')}"; font: 600 7.5pt Pretendard, sans-serif; color: #d03b3b; }
  @bottom-right { content: counter(page) " / " counter(pages); font: 500 7.5pt Pretendard, sans-serif; color: #52514e; } }
@page :first { @top-left { content: none; } @top-right { content: none; } }
${css}</style></head><body>
<header class="cover">
  <div class="brandline"><span class="brand">${esc(m.org || '')}</span><span class="doctype">${esc(m.docType || '사내 작업 보고서')}</span></div>
  <div class="ctitle-wrap"><div class="eyebrow">${esc(m.eyebrow || '')}</div><h1>${inline(m.title)}</h1>${m.subtitle ? `<div class="subtitle">${inline(m.subtitle)}</div>` : ''}</div>
  <div class="cover-grid"><table class="meta">${metaRows}</table>${m.status ? `<div class="status ${m.statusTone || 'good'}"><div class="slabel">상태</div><div class="svalue">${esc(m.status)}</div>${m.statusNote ? `<div class="snote">${inline(m.statusNote)}</div>` : ''}</div>` : ''}</div>
</header>
${spec.kpis ? `<section class="sec summary"><h2 class="plain">한눈에 보기</h2>${kpis(spec.kpis, spec.kpiCols || 3)}</section>` : ''}
${spec.summary ? `<section class="sec summary"><h2 class="plain">요약</h2><ul class="list summary-list">${spec.summary.map((x) => `<li>${inline(x)}</li>`).join('')}</ul></section>` : ''}
${sections}
${spec.sources ? `<section class="sec sources"><h2 class="plain">출처 · 측정 방법</h2><ol class="src">${spec.sources.map((x) => `<li>${inline(x)}</li>`).join('')}</ol></section>` : ''}
${m.signoff ? `<div class="signoff">${(m.signoff).map(([k, v]) => `<div><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('')}</div>` : ''}
</body></html>`;
}

async function loadChromium() {
  // ESM import 는 NODE_PATH(전역 설치)를 보지 않아 require 로도 한 번 더 찾는다
  const req = createRequire(import.meta.url);
  for (const mod of ['playwright', 'playwright-core']) {
    try { return (await import(mod)).chromium; } catch { /* 다음 */ }
    try { return req(mod).chromium; } catch { /* 다음 */ }
  }
  throw new Error('playwright 를 못 찾았다 — npm i playwright-core 후 CHROME_PATH 를 준다');
}

export async function build(spec, { out, html, png } = {}) {
  const doc = renderHtml(spec);
  const htmlPath = html || (/\.pdf$/i.test(out) ? out.replace(/\.pdf$/i, '.html') : `${out}.html`);
  fs.writeFileSync(htmlPath, doc);
  const chromium = await loadChromium();
  const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
  try {
    const page = await browser.newPage();
    await page.goto(pathToFileURL(path.resolve(htmlPath)).href, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    await page.pdf({ path: out, format: 'A4', printBackground: true, preferCSSPageSize: true });
  } finally { await browser.close(); }
  if (png) {
    fs.mkdirSync(png, { recursive: true });
    try { execFileSync('pdftoppm', ['-r', '70', '-png', out, path.join(png, 'page')]); } catch (e) { console.warn('미리보기 그림 실패(pdftoppm 없음?):', e.message); }
  }
  return { out, html: htmlPath };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
  const specPath = args.find((a) => !a.startsWith('--') && !Object.values({ o: opt('--out'), h: opt('--html'), p: opt('--png') }).includes(a));
  if (!specPath) { console.error('쓰는 법: node tools/work-report/build.mjs <명세.json> --out <보고서.pdf> [--html x.html] [--png 폴더]'); process.exit(2); }
  const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
  const out = opt('--out') || specPath.replace(/\.json$/i, '.pdf');
  const r = await build(spec, { out, html: opt('--html'), png: opt('--png') });
  console.log(`✓ ${r.out}`);
}

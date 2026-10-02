#!/usr/bin/env node
/* ============================================================
   교내 소식 썸네일 로봇 (2026-10-03 개발자 지시 — "실제 뉴스의 사진을 첨부해와서 해당 사진을 썸네일로 쓸 수 있도록 해")

   소식 수집(collect-news.mjs) **다음 단계**로 돈다(collect-news.yml). 따로 둔 까닭:
     · 수집은 게시판 목록 한 번씩이라 빠르고, 사진은 글마다 상세 화면 + 그림 받기라 느리다 — 같은 4분 예산에 넣으면 수집이 밀린다.
     · 사진을 못 받아도 소식은 나가야 한다(보강 단계 · continue-on-error).
   하는 일:
     ① 실린 글(data/news/*.json) 가운데 사진을 아직 안 찾아본 글을 새 글부터, 학교마다 돌아가며(perSchool) 연다 — 장부 collector/news-thumbs.json
     ② 글 화면(또는 규칙의 본문 API)에서 후보를 고르고(news-thumb.mjs imageCandidates) 받아서 진짜 사진인지 본다(sniffImage·photoProblem)
     ③ 240px 정사각 WebP 로 줄여 data/news/img/<해시>.webp 에 쓴다(sharp — 워크플로가 이 단계에서만 설치)
     ④ 장부를 실린 글 전부에 다시 입히고(applyThumbs · 소급), 아무 글도 안 쓰는 그림 파일은 지운다
     ⑤ 학교별로 몇 장이 붙었고 왜 못 붙었는지 리포트(collector/news-thumbs-report.md) — "대부분 사진이 있다"를 숫자로 본다
   🔴 학교 사진의 저작권은 학교에 있다 — 작게 줄인 썸네일만 두고, 카드는 원문으로 이어지며, 글이 피드에서 빠지면 파일도 지운다(④).
      관리자 「사진 빼기」(news-config.json noThumb)로 언제든 뺄 수 있다.
   ============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchBoard, netReason } from './fetch-board.mjs';
import { FETCH_HEADERS } from './http-headers.mjs';
import { NEWS_BOARD_RULES, postContentRequest } from './news-board-rules.mjs';
import { withDeadline, TIMED_OUT } from './harvest-budget.mjs';
import * as T from './news-thumb.mjs';

/* NEWS_THUMB_ROOT·NEWS_THUMB_OFFLINE 는 관문용 — 임시 폴더에서 받기(①~③) 없이 소급·정리(④⑤)만 돌려 본다 */
const ROOT = process.env.NEWS_THUMB_ROOT || fileURLToPath(new URL('..', import.meta.url));
const NEWS_DIR = path.join(ROOT, 'data/news');
const IMG_DIR = path.join(ROOT, T.THUMB_DIR);
const LEDGER_PATH = path.join(ROOT, 'collector/news-thumbs.json');
const CFG_PATH = path.join(ROOT, 'collector/news-config.json');
const REPORT_PATH = path.join(ROOT, 'collector/news-thumbs-report.md');
const BUDGET_MS = Number(process.env.NEWS_THUMB_BUDGET_MS || 150000);
const PER_SCHOOL = Number(process.env.NEWS_THUMB_PER_SCHOOL || 6);
const ITEM_HARD_MS = Number(process.env.NEWS_THUMB_ITEM_MS || 30000);
const GAP_MS = 400;                 // 같은 학교에 잇달아 두드리지 않게 글 사이 틈
const MAX_CANDS = 5;                // 글 하나에서 받아 볼 그림 수 상한
const today = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
const t0 = Date.now();
const fileExists = (rel) => fs.existsSync(path.join(ROOT, rel));
const readJson = (p, fb) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fb; } };

/* 실린 글 — 학교별 파일 전부 (색인 제외 · 하위 폴더 img/ 는 readdir 의 .json 거르기로 빠진다) */
const docs = [];
for (const f of (fs.existsSync(NEWS_DIR) ? fs.readdirSync(NEWS_DIR) : []).filter((x) => /\.json$/.test(x) && x !== 'index.json')) {
  const p = path.join(NEWS_DIR, f); const raw = fs.readFileSync(p, 'utf8');
  try { const doc = JSON.parse(raw); if (doc && Array.isArray(doc.items)) docs.push({ path: p, doc, eol: /\n$/.test(raw) }); } catch { /* 깨진 파일은 감사가 잡는다 */ }
}
const items = docs.flatMap((d) => d.doc.items);
const ledger = Object.assign(T.emptyLedger(), readJson(LEDGER_PATH, {}));
ledger.posts ||= {}; ledger.srcSeen ||= {};
const cfg = readJson(CFG_PATH, {});
const noThumb = new Set(Array.isArray(cfg.noThumb) ? cfg.noThumb : []);
/* 전체 스위치 news-config.json "thumbs" — on(기본) · dry(받아서 장부·그림만 두고 **카드에는 안 붙인다** — 처음 켤 때 사람이 그림을 먼저 본다) ·
   off(받지 않고 카드의 사진을 모두 뗀다 · 그림 파일도 지운다 — 틀린 사진이 쏟아질 때 한 번에 끄는 길) */
const MODE = ['on', 'dry', 'off'].includes(cfg.thumbs) ? cfg.thumbs : 'on';

/* sharp 는 이 단계에서만 설치된다(collect-news.yml). 없으면 받지 않고 ④⑤만 한다 — 실린 글의 사진 칸·파일 정리는 늘 맞춘다 */
let sharp = null; let sharpErr = '';
if (process.env.NEWS_THUMB_OFFLINE) sharpErr = '관문 실행 (NEWS_THUMB_OFFLINE) — 받지 않음';
else try { sharp = (await import('sharp')).default; } catch (e) { sharpErr = String(e && e.message || e).slice(0, 120); }

const runLog = [];   // { school, title, result, note }
async function getImage(src, referer) {
  const res = await fetch(src, { redirect: 'follow', headers: { ...FETCH_HEADERS, Referer: referer, Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8' }, signal: AbortSignal.timeout(12000) });
  if (!res.ok) return { problem: `그림 HTTP ${res.status}` };
  const ct = res.headers.get('content-type') || '';
  if (/text\/html|json|xml/i.test(ct)) return { problem: `그림이 아니라 ${ct.split(';')[0]}` };
  const len = Number(res.headers.get('content-length') || 0);
  if (len > T.IMG_MAX_BYTES) return { problem: `그림이 너무 큼 (${Math.round(len / 1048576)}MB)` };
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > T.IMG_MAX_BYTES) return { problem: '그림이 너무 큼' };
  return { buf };
}

async function shrink(buf) {
  let out = await sharp(buf, { animated: false, limitInputPixels: 60e6 }).rotate()
    .resize(T.THUMB_SIDE, T.THUMB_SIDE, { fit: 'cover', position: sharp.strategy.attention }).webp({ quality: 72 }).toBuffer();
  if (out.length > T.THUMB_MAX_BYTES) out = await sharp(buf, { animated: false, limitInputPixels: 60e6 }).rotate()
    .resize(T.THUMB_SIDE, T.THUMB_SIDE, { fit: 'cover', position: sharp.strategy.attention }).webp({ quality: 50 }).toBuffer();
  return out.length <= T.THUMB_MAX_BYTES ? out : null;
}

/* 글 하나 — { file, src, from } · { none } · { err } 를 돌려준다. ctx.dead 면 파일을 쓰지 않는다(시한 뒤 늦게 끝난 일) */
async function thumbFor(n, ctx) {
  const req = postContentRequest(NEWS_BOARD_RULES[n.school], n);
  if (!req) return { none: '글 화면이 없음 (목록에서 바로 여는 게시판)' };
  let res;
  try { res = await fetchBoard(req.url, { ...req.opts, tries: 1, firstMs: 12000 }); } catch (e) { return { err: `글 열기 실패 (${netReason(e)})` }; }
  if (!res.ok) return { err: `글 HTTP ${res.status}` };
  const text = await res.text();
  let cands;
  const ct = res.headers && res.headers.get ? (res.headers.get('content-type') || '') : '';
  if (/json/i.test(ct) || /^\s*[{[]/.test(text)) { try { cands = T.jsonImageCandidates(JSON.parse(text), req.base); } catch { cands = T.imageCandidates(text, req.base); } }
  else cands = T.imageCandidates(text, res.url || req.base);
  const key = T.thumbKey(n);
  T.recordPage(ledger, n.school, key, cands.map((c) => c.src));
  const blocked = T.blockedFor(ledger, n.school);
  const notes = [];
  let tried = 0;
  for (const c of cands) {
    if (blocked.has(c.src)) { notes.push(`${c.from}: 여러 글에 같은 그림(공통 그림)`); continue; }
    if (tried >= MAX_CANDS || ctx.dead) break;
    tried += 1;
    let got;
    try { got = await getImage(c.src, req.base); } catch (e) { notes.push(`${c.from}: 받기 실패 (${netReason(e)})`); continue; }
    if (got.problem) { notes.push(`${c.from}: ${got.problem}`); continue; }
    const info = T.sniffImage(got.buf);
    const prob = T.photoProblem(info, got.buf.length);
    if (prob) { notes.push(`${c.from}: ${prob}`); continue; }
    let out;
    try { out = await shrink(got.buf); } catch (e) { notes.push(`${c.from}: 줄이기 실패 (${String(e.message).slice(0, 60)})`); continue; }
    if (!out) { notes.push(`${c.from}: 줄여도 너무 큼`); continue; }
    if (ctx.dead) return { err: '시한 넘김' };
    const rel = T.thumbName(out);
    fs.mkdirSync(IMG_DIR, { recursive: true });
    if (!fileExists(rel)) fs.writeFileSync(path.join(ROOT, rel), out);
    return { file: rel, src: c.src, from: c.from, note: `${info.width}×${info.height} → ${Math.round(out.length / 1024)}KB` };
  }
  return { none: cands.length ? `사진으로 쓸 그림 없음 (${notes.slice(0, 3).join(' · ') || '후보 없음'})` : '글에 그림이 없음' };
}

/* ①~③ */
let done = 0;
if (sharp && MODE !== 'off') {
  const queue = T.planQueue(items, ledger, { today, perSchool: PER_SCHOOL, noThumb, fileExists });
  const requeued = new Set();
  for (let i = 0; i < queue.length; i += 1) {
    if (Date.now() - t0 > BUDGET_MS) { runLog.push({ school: '—', title: `⏰ 예산(${Math.round(BUDGET_MS / 1000)}초) 소진 — 남은 ${queue.length - i}건은 다음 실행에`, result: '' }); break; }
    const n = queue[i]; const key = T.thumbKey(n);
    const ctx = { dead: false };
    const r = await withDeadline(thumbFor(n, ctx).catch((e) => ({ err: `오류 (${String(e && e.message || e).slice(0, 80)})` })), ITEM_HARD_MS);
    if (r === TIMED_OUT) ctx.dead = true;
    const out = r === TIMED_OUT ? { err: `${Math.round(ITEM_HARD_MS / 1000)}초 안에 못 끝냄` } : r;
    const prev = ledger.posts[key];
    ledger.posts[key] = out.file ? { at: today, school: n.school, file: out.file, src: out.src, from: out.from }
      : out.none ? { at: today, school: n.school, none: out.none }
      : { at: today, school: n.school, err: out.err, tries: ((prev && prev.err && prev.tries) || 0) + 1 };
    runLog.push({ school: n.school, title: n.title, result: out.file ? `✅ ${out.from}` : out.none ? '— 없음' : '⚠️ 실패', note: out.file ? `${out.note} · ${out.file} ← ${String(out.src).slice(0, 120)}` : (out.none || out.err) });
    done += 1;
    /* 이 글로 공통 그림이 드러났으면 그 그림을 썸네일로 받은 다른 글을 되돌려 다시 찾는다(같은 실행 안에서 한 번) */
    for (const k of T.revokeRepeated(ledger, n.school)) {
      const back = items.find((x) => T.thumbKey(x) === k);
      runLog.push({ school: n.school, title: back ? back.title : k, result: '↩️ 되돌림', note: '썸네일이 여러 글의 공통 그림이었음 — 다시 찾음' });
      if (back && !requeued.has(k)) { requeued.add(k); queue.push(back); }
    }
    await new Promise((res) => setTimeout(res, GAP_MS));
  }
}

/* ④ 소급 입히기 · 고아 파일 지우기 · 장부 다듬기 */
const shown = MODE === 'on' ? noThumb : new Set(items.map(T.thumbKey));   // dry·off 는 카드에 하나도 안 붙인다
const changedItems = T.applyThumbs(docs, ledger, { noThumb: shown, fileExists });
for (const d of docs) if (d.changed) fs.writeFileSync(d.path, JSON.stringify(d.doc, null, 1) + (d.eol ? '\n' : ''));
/* 남길 그림 — 카드가 쓰는 것. dry 는 사람이 볼 수 있게 장부의 그림(실린 글 것)도 남긴다. off 는 전부 지운다 */
const referenced = new Set(items.map((n) => n.thumb).filter(Boolean));
if (MODE === 'dry') for (const n of items) { const e = ledger.posts[T.thumbKey(n)]; if (e && e.file && !noThumb.has(T.thumbKey(n))) referenced.add(e.file); }
let removed = 0;
for (const f of (fs.existsSync(IMG_DIR) ? fs.readdirSync(IMG_DIR) : [])) {
  const rel = `${T.THUMB_DIR}/${f}`;
  if (!referenced.has(rel)) { fs.unlinkSync(path.join(IMG_DIR, f)); removed += 1; }
}
T.pruneLedger(ledger, new Set(items.map(T.thumbKey)), today);
fs.writeFileSync(LEDGER_PATH, JSON.stringify({ note: '교내 소식 썸네일 장부 — collector/collect-news-thumbs.mjs 가 쓴다. posts: 글 열쇠별 결과(file·none·err) · srcSeen: 학교별 그림 주소를 본 글(두 글 이상이면 공통 그림이라 막는다).', ...ledger }, null, 1));

/* ⑤ 리포트 — 학교별 붙은 수·없는 까닭 */
const live = items.filter((n) => !n.hidden);
const bySchool = new Map();
for (const n of live) {
  const s = bySchool.get(n.school) || { total: 0, thumb: 0, none: 0, err: 0, off: 0, wait: 0, reasons: new Map() };
  s.total += 1;
  const e = ledger.posts[T.thumbKey(n)];
  if (noThumb.has(T.thumbKey(n))) s.off += 1;
  else if (n.thumb || (MODE === 'dry' && e && e.file)) s.thumb += 1;   // dry 는 카드에 안 붙였어도 받은 사진을 센다
  else if (e && e.none) { s.none += 1; const r = e.none.replace(/\s*\(.*$/, ''); s.reasons.set(r, (s.reasons.get(r) || 0) + 1); }
  else if (e && e.err) s.err += 1;
  else s.wait += 1;
  bySchool.set(n.school, s);
}
const tot = [...bySchool.values()].reduce((a, s) => ({ total: a.total + s.total, thumb: a.thumb + s.thumb, none: a.none + s.none, err: a.err + s.err, wait: a.wait + s.wait, off: a.off + s.off }), { total: 0, thumb: 0, none: 0, err: 0, wait: 0, off: 0 });
const looked = tot.thumb + tot.none;
const lines = [
  `## 🖼 교내 소식 썸네일 리포트 (${today})`, '',
  MODE !== 'on' ? `🔧 스위치 thumbs: ${MODE} (collector/news-config.json) — ${MODE === 'dry' ? '사진을 받아 두기만 하고 카드에는 안 붙입니다(사람이 먼저 봄)' : '사진을 받지 않고 카드의 사진을 모두 뗐습니다'}` : '',
  sharp ? `이번 실행: 글 ${done}건을 열어 봤습니다 (${Math.round((Date.now() - t0) / 1000)}초 · 예산 ${Math.round(BUDGET_MS / 1000)}초 · 학교당 ${PER_SCHOOL}건)` : `⚠️ 그림 도구(sharp)를 못 불러 이번엔 사진을 받지 않았습니다 (${sharpErr}) — 실린 글의 사진 칸·파일 정리만 했습니다`,
  '',
  `**실린 글 ${tot.total}건 중 사진 ${tot.thumb}건** · 사진 없음 ${tot.none}건 · 실패(다시 시도) ${tot.err}건 · 아직 안 봄 ${tot.wait}건${tot.off ? ` · 관리자가 뺀 사진 ${tot.off}건` : ''}${looked ? ` — 열어 본 글 가운데 사진이 있던 비율 **${Math.round((tot.thumb / looked) * 100)}%**` : ''}`,
  `파일: 바뀐 글 ${changedItems}건 · 지운 그림 ${removed}개 (피드에서 빠진 글·사진 빼기)`,
  '', '| 학교 | 글 | 사진 | 없음 | 실패 | 안 봄 | 없는 까닭(많은 순) |', '|---|---|---|---|---|---|---|',
  ...[...bySchool.entries()].sort((a, b) => b[1].total - a[1].total).map(([school, s]) => `| ${school} | ${s.total} | ${s.thumb} | ${s.none} | ${s.err} | ${s.wait} | ${[...s.reasons.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([r, c]) => `${r} ${c}`).join(' · ')} |`),
  '', '### 이번 실행에 연 글', '',
  ...runLog.slice(0, 200).map((l) => `- ${l.school} · ${String(l.title).slice(0, 40)} — ${l.result}${l.note ? ` (${String(l.note).slice(0, 160)})` : ''}`),
];
fs.writeFileSync(REPORT_PATH, lines.join('\n') + '\n');
console.log(lines.slice(0, 6).join('\n'));
process.exit(0);

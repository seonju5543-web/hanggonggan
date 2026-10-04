#!/usr/bin/env node
/* ============================================================
   교내 소식 썸네일 로봇 (2026-10-03 개발자 지시 — "실제 뉴스의 사진을 첨부해와서 해당 사진을 썸네일로 쓸 수 있도록 해")

   소식 수집(collect-news.mjs) **다음 단계**로 돈다(collect-news.yml). 따로 둔 까닭:
     · 수집은 게시판 목록 한 번씩이라 빠르고, 사진은 글마다 상세 화면 + 그림 받기라 느리다 — 같은 4분 예산에 넣으면 수집이 밀린다.
     · 사진을 못 받아도 소식은 나가야 한다(보강 단계 · continue-on-error).
   하는 일:
     ① 실린 글(data/news/*.json) 가운데 사진을 아직 안 찾아본 글을 새 글부터, 학교마다 돌아가며(perSchool) 연다 — 장부 collector/news-thumbs.json
     ② 글 화면(또는 규칙의 본문 API)에서 후보를 고르고(news-thumb.mjs imageCandidates) 받아서 진짜 사진인지 본다(sniffImage·photoProblem)
     ③ 360px 정사각 WebP 로 줄여 data/news/img/<해시>.webp 에 쓴다(sharp — 워크플로가 이 단계에서만 설치)
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
import { NEWS_BOARD_RULES, newsRuleKey, postContentRequest } from './news-board-rules.mjs';
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
ledger.posts ||= {}; ledger.srcSeen ||= {}; ledger.commonFiles ||= {};
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
  if (!res.ok) return { problem: `그림 HTTP ${res.status}`, transient: res.status >= 500 || res.status === 429 || res.status === 408 };
  const ct = res.headers.get('content-type') || '';
  if (/text\/html|json|xml/i.test(ct)) return { problem: `그림이 아니라 ${ct.split(';')[0]}` };
  const len = Number(res.headers.get('content-length') || 0);
  if (len > T.IMG_MAX_BYTES) return { problem: `그림이 너무 큼 (${Math.round(len / 1048576)}MB)` };
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > T.IMG_MAX_BYTES) return { problem: '그림이 너무 큼' };
  return { buf };
}

/* THUMB_SIDE(360px) 정사각 WebP 로 줄이고, 원래 그림이 QR 코드처럼 생겼는지 함께 잰다 (T.monoParts · T.looksLikeQr — 섞지 않고 160px 로 줄여 잰다) */
async function shrink(buf) {
  const make = (q) => sharp(buf, { animated: false, limitInputPixels: 60e6 }).rotate()
    .resize(T.THUMB_SIDE, T.THUMB_SIDE, { fit: 'cover', position: sharp.strategy.attention }).webp({ quality: q }).toBuffer();
  let out = await make(72);
  if (out.length > T.THUMB_MAX_BYTES) out = await make(50);
  if (out.length > T.THUMB_MAX_BYTES) return null;
  const rgb = await sharp(buf, { animated: false, limitInputPixels: 60e6 }).rotate().resize(160, 160, { fit: 'inside', kernel: 'nearest' }).removeAlpha().toColourspace('srgb').raw().toBuffer();
  const mono = T.monoParts(rgb);
  return { buf: out, mono, qr: T.looksLikeQr(mono), textPage: T.looksLikeTextPage(mono) };
}

/* 글 하나 — { file, src, from } · { none } · { err } 를 돌려준다. ctx.dead 면 파일을 쓰지 않는다(시한 뒤 늦게 끝난 일) */
async function thumbFor(n, ctx) {
  const req = postContentRequest(NEWS_BOARD_RULES[newsRuleKey(n)], n);   // 둘째 게시판 글(board)은 그 게시판의 규칙
  if (!req) return { none: '글 화면이 없음 (목록에서 바로 여는 게시판)' };
  let res;
  try { res = await fetchBoard(req.url, { ...req.opts, tries: 1, firstMs: 12000 }); } catch (e) { return { err: `글 열기 실패 (${netReason(e)})` }; }
  if (!res.ok) return { err: `글 HTTP ${res.status}` };
  const ct = res.headers && res.headers.get ? (res.headers.get('content-type') || '') : '';
  let text = await res.text();
  /* 본문 API 가 JSON 이면 글자를 풀어서 대조한다(\uXXXX 로 적힌 제목) */
  try { if (/^\s*[{[]/.test(text)) text = JSON.stringify(JSON.parse(text)); } catch { /* JSON 아님 */ }
  if (!T.pageHasTitle(text, n.title)) {
    /* 원인을 단정하지 않는다 — 다음 사람이 볼 수 있게 받은 화면의 제목·길이·글자표(charset)를 적는다 (세 번째 실제 실행: 계명 4건 · 서울대 1건) */
    const pt = ((text.match(/<title\b[^>]*>([\s\S]{0,120}?)<\/title>/i) || [])[1] || '').replace(/\s+/g, ' ').trim();
    return { err: `글 화면에 그 글의 제목이 없음 — 다음에 다시 (받은 화면: 「${pt.slice(0, 50) || '제목 없음'}」 · ${text.length}자 · ${(ct.match(/charset=([\w-]+)/i) || [])[1] || '글자표 안 적힘'} · ${String(res.url || '').slice(0, 90)})` };
  }
  let cands;
  if (/json/i.test(ct) || /^\s*[{[]/.test(text)) { try { cands = T.jsonImageCandidates(JSON.parse(text), req.base); } catch { cands = T.imageCandidates(text, req.base); } }
  else cands = T.imageCandidates(text, res.url || req.base);
  const key = T.thumbKey(n);
  T.recordPage(ledger, n.school, key, cands.map((c) => c.src));
  const blocked = T.blockedFor(ledger, n.school);
  const notes = [];
  let tried = 0; let transient = false; let leftOver = false;
  for (const c of cands) {
    if (blocked.has(c.src)) { notes.push(`${c.from}: 여러 글에 같은 그림(공통 그림)`); continue; }
    if (tried >= MAX_CANDS || ctx.dead) { leftOver = true; break; }
    tried += 1;
    let got;
    /* 받기 실패(연결 끊김·시간 초과)·5xx·429 는 **잠깐의 사정**이다 — '사진 없음'으로 굳히지 않고 하루 뒤 다시 본다 (리뷰 12차) */
    try { got = await getImage(c.src, req.base); } catch (e) { transient = true; notes.push(`${c.from}: 받기 실패 (${netReason(e)})`); continue; }
    if (got.problem) { if (got.transient) transient = true; notes.push(`${c.from}: ${got.problem}`); continue; }
    const info = T.sniffImage(got.buf);
    const prob = T.photoProblem(info, got.buf.length);
    if (prob) { notes.push(`${c.from}: ${prob}`); continue; }
    let out;
    try { out = await shrink(got.buf); } catch (e) { notes.push(`${c.from}: 줄이기 실패 (${String(e.message).slice(0, 60)})`); continue; }
    if (!out) { notes.push(`${c.from}: 줄여도 너무 큼`); continue; }
    if (out.qr) { notes.push(`${c.from}: QR 코드로 보임 (검정 ${Math.round(out.mono.black * 100)}% · 흰색 ${Math.round(out.mono.white * 100)}%)`); continue; }
    if (out.textPage) { notes.push(`${c.from}: 글자뿐인 문서 그림 (흰 바탕 ${Math.round(out.mono.white * 100)}% · 색 ${Math.round(out.mono.colour * 100)}%)`); continue; }
    const rel = T.thumbName(out.buf);
    /* 같은 학교의 다른 글이 **똑같은 그림 파일**을 쓰면 공통 그림이다 — 주소가 달라도(세션 꼬리·CDN) 바이트가 같다 (리뷰 12차) */
    if (T.isCommonFile(ledger, n.school, rel)) { notes.push(`${c.from}: 여러 글에 같은 그림(같은 파일)`); continue; }
    const twins = T.fileTwins(ledger, n.school, rel, key);
    if (twins.length) { T.markCommonFile(ledger, n.school, rel); notes.push(`${c.from}: 여러 글에 같은 그림(같은 파일 · ${twins.length}글)`); continue; }
    if (ctx.dead) return { err: '시한 넘김' };
    fs.mkdirSync(IMG_DIR, { recursive: true });
    if (!fileExists(rel)) fs.writeFileSync(path.join(ROOT, rel), out.buf);
    return { file: rel, src: c.src, from: c.from, note: `${info.width}×${info.height} → ${Math.round(out.buf.length / 1024)}KB` };
  }
  const why = notes.slice(0, 3).join(' · ') || '후보 없음';
  /* 잠깐의 실패가 있었거나, 공통 그림을 아직 몰라 후보를 다 못 열어 봤으면 '없음'으로 굳히지 않는다 — 다음 날 다시(장부 err · 세 번까지) */
  if (transient) return { err: `잠깐의 실패로 사진을 못 받음 (${why})` };
  if (leftOver) return { err: `후보가 많아 다 못 열어 봄 — 공통 그림을 알게 된 뒤 다시 (${why})` };
  return { none: cands.length ? `사진으로 쓸 그림 없음 (${why})` : '글에 그림이 없음' };
}

/* 고르는 규칙이 바뀌면(RULES_V) 옛 규칙으로 받은 사진은 버리고 다시 찾는다 — 소급(운영 원칙 7).
   v2(2026-10-03 두 번째 실제 실행 84장을 눈으로 본 뒤): 대표 이미지(og) 제외 · 글자뿐인 문서 그림 제외 · QR 기준 · 글 화면에 제목이 있어야 함(서버 오류 화면 그림) */
const RULES_V = 2;
for (const [k, e] of Object.entries(ledger.posts)) if (e.file && (e.v || 1) < RULES_V) delete ledger.posts[k];

/* ①~③ — **학교 여럿을 동시에**(LANES), 한 학교 안에서는 하나씩 틈을 두고 (첫 실제 실행: 하나씩 돌면 2.5분에 45건 — 쌓인 515건에 6일).
   한 학교를 몰아치지 않는 규칙은 그대로다(같은 학교 요청은 늘 차례로 · 글 사이 GAP_MS). */
const LANES = Number(process.env.NEWS_THUMB_LANES || 4);
let done = 0;
if (sharp && MODE !== 'off') {
  const queue = T.planQueue(items, ledger, { today, perSchool: PER_SCHOOL, noThumb, fileExists });
  const requeued = new Set();
  const lanes = new Map();
  for (const n of queue) { if (!lanes.has(n.school)) lanes.set(n.school, []); lanes.get(n.school).push(n); }
  /* 돌아가며 — 학교 줄에서 한 건씩 꺼내 처리하고 그 학교를 줄 끝으로 보낸다. 한 학교는 한 번에 한 일꾼만 잡는다(꺼낸 동안 줄에 없다).
     학교마다 한 줄씩 다 비우는 식이면 예산이 끝날 때 뒤쪽 학교가 매번 0건이었다. */
  const ready = [...lanes.keys()];
  let budgetNoted = false;
  const worker = async () => {
    for (;;) {
      if (Date.now() - t0 > BUDGET_MS) { if (!budgetNoted) { budgetNoted = true; runLog.push({ school: '—', title: `⏰ 예산(${Math.round(BUDGET_MS / 1000)}초) 소진 — 남은 ${[...lanes.values()].reduce((a, l) => a + l.length, 0)}건은 다음 실행에`, result: '' }); } return; }
      const school = ready.shift();
      if (!school) return;
      const list = lanes.get(school);
      const n = list.shift();
      if (n) { await one(n, list); await new Promise((res) => setTimeout(res, GAP_MS)); }
      if (list.length) ready.push(school);
    }
  };
  /* 글 하나 — 결과를 장부에 적고, 공통 그림이 드러났으면 그 그림을 받은 같은 학교 글을 되돌려 그 학교 줄 끝에 다시 넣는다 */
  const one = async (n, list) => {
    const key = T.thumbKey(n);
    const ctx = { dead: false };
    const r = await withDeadline(thumbFor(n, ctx).catch((e) => ({ err: `오류 (${String(e && e.message || e).slice(0, 80)})` })), ITEM_HARD_MS);
    if (r === TIMED_OUT) ctx.dead = true;
    const out = r === TIMED_OUT ? { err: `${Math.round(ITEM_HARD_MS / 1000)}초 안에 못 끝냄` } : r;
    const prev = ledger.posts[key];
    /* 키우기(옛 240px 사진을 360px 로)에 실패하면 **옛 사진을 그대로 둔다** — 없음·실패로 덮으면 카드의 사진이 사라진다. 다음 시도는 하루 뒤 · 세 번까지 */
    if (n.grow && !out.file && prev && prev.file) {
      ledger.posts[key] = { ...prev, growAt: today, growTries: (prev.growTries || 0) + 1 };
      runLog.push({ school: n.school, title: n.title, result: '↔️ 키우기 보류', note: `옛 사진 그대로 — ${out.none || out.err}` });
      done += 1;
      return;
    }
    ledger.posts[key] = out.file ? { at: today, school: n.school, file: out.file, src: out.src, from: out.from, v: RULES_V, side: T.THUMB_SIDE }
      : out.none ? { at: today, school: n.school, none: out.none }
      : { at: today, school: n.school, err: out.err, tries: ((prev && prev.err && prev.tries) || 0) + 1 };
    runLog.push({ school: n.school, title: n.title, result: out.file ? `✅ ${out.from}` : out.none ? '— 없음' : '⚠️ 실패', note: out.file ? `${out.note} · ${out.file} ← ${String(out.src).slice(0, 120)}` : (out.none || out.err) });
    done += 1;
    /* 이 글로 공통 그림이 드러났으면 그 그림을 썸네일로 받은 다른 글을 되돌려 다시 찾는다(같은 실행 안에서 한 번 · 같은 학교 줄 끝에) */
    for (const k of T.revokeRepeated(ledger, n.school)) {
      const back = items.find((x) => T.thumbKey(x) === k);
      runLog.push({ school: n.school, title: back ? back.title : k, result: '↩️ 되돌림', note: '썸네일이 여러 글의 공통 그림이었음 — 다시 찾음' });
      if (back && !requeued.has(k)) { requeued.add(k); list.push(back); }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, LANES) }, worker));
}

/* ④ 소급 입히기 · 고아 파일 지우기 · 장부 다듬기 */
const shown = MODE === 'on' ? noThumb : new Set(items.map(T.thumbKey));   // dry·off 는 카드에 하나도 안 붙인다
const changedItems = T.applyThumbs(docs, ledger, { noThumb: shown, fileExists });
for (const d of docs) if (d.changed) fs.writeFileSync(d.path, JSON.stringify(d.doc, null, 1) + (d.eol ? '\n' : ''));
/* 남길 그림 — 카드가 쓰는 것. dry 는 사람이 볼 수 있게 장부의 그림(실린 글 것)도 남긴다. off 는 전부 지운다 */
const referenced = new Set(items.map((n) => n.thumb).filter(Boolean));
if (MODE === 'dry') for (const n of items) { const e = ledger.posts[T.thumbKey(n)]; if (e && e.file && !T.optedOut(n, noThumb) && !T.isCommonFile(ledger, n.school, e.file)) referenced.add(e.file); }
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
  if (T.optedOut(n, noThumb)) s.off += 1;
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

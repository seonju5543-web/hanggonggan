#!/usr/bin/env node
/* ============================================================
   교내 소식 요약 로봇 (2026-10-10 팀 업무 분장 프론트 8번 · 유은서 — "교내 뉴스 게시글을 몇 줄 요약한 디스크립션")

   collect-news.yml 의 **보강 단계**다(썸네일 다음 · 실패해도 소식은 나간다). 썸네일 로봇과 장부를 나눈 까닭:
     썸네일 장부는 '사진을 찾았나'로 다시 볼지 정한다 — 요약을 거기 섞으면 사진이 이미 있는 글(수백 건)의 요약을 뜨려고
     사진 규칙까지 다시 돌아야 한다. 요약은 제 장부(collector/news-desc.json)로 **아직 안 본 글만** 연다.
   하는 일:
     ① 실린 글(data/news/*.json) 중 요약을 아직 안 뜬 글을 새 글부터 학교마다 돌아가며 연다(학교당 PER_SCHOOL · 글 사이 틈)
     ② 그 글의 화면에 **그 글의 제목이 있을 때만**(T.pageHasTitle — 서버 오류 화면에서 뜨지 않게) 본문 첫 문장들을 뜬다(news-desc.mjs)
     ③ 장부의 요약을 실린 글 전부에 입힌다(item.desc · 소급) — 못 뜬 글은 desc 가 없다(앱이 요약 줄을 안 그린다)
   🔴 발췌만 한다 — AI·짐작 없음. 판정은 순수 모듈 collector/news-desc.mjs 한 곳(관문이 그 파일을 그대로 부른다).
   ============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchBoard, netReason } from './fetch-board.mjs';
import { NEWS_BOARD_RULES, newsRuleKey, postContentRequest } from './news-board-rules.mjs';
import { withDeadline, TIMED_OUT } from './harvest-budget.mjs';
import * as T from './news-thumb.mjs';
import { newsDesc, DESC_MAX } from './news-desc.mjs';

const ROOT = process.env.NEWS_DESC_ROOT || fileURLToPath(new URL('..', import.meta.url));
const NEWS_DIR = path.join(ROOT, 'data/news');
const LEDGER_PATH = path.join(ROOT, 'collector/news-desc.json');
const BUDGET_MS = Number(process.env.NEWS_DESC_BUDGET_MS || 90000);
const PER_SCHOOL = Number(process.env.NEWS_DESC_PER_SCHOOL || 8);
const ITEM_HARD_MS = 20000;
const GAP_MS = 400;
const LANES = 4;
const RETRY_DAYS = 1;
const MAX_TRIES = 3;
const KEEP_DAYS = 30;
const today = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
const t0 = Date.now();
const dayDiff = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);
const readJson = (p, fb) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fb; } };

const docs = [];
for (const f of (fs.existsSync(NEWS_DIR) ? fs.readdirSync(NEWS_DIR) : []).filter((x) => /\.json$/.test(x) && x !== 'index.json')) {
  const p = path.join(NEWS_DIR, f); const raw = fs.readFileSync(p, 'utf8');
  try { const doc = JSON.parse(raw); if (doc && Array.isArray(doc.items)) docs.push({ path: p, doc, eol: /\n$/.test(raw) }); } catch { /* 깨진 파일은 감사가 잡는다 */ }
}
const items = docs.flatMap((d) => d.doc.items);
const ledger = Object.assign({ posts: {} }, readJson(LEDGER_PATH, {}));
ledger.posts ||= {};

/* ① 볼 글 — 장부에 없거나, 잠깐 실패해 하루 지난 것(세 번까지) */
const want = items.filter((n) => {
  if (!n || !n.url || !n.school || n.hidden) return false;
  const e = ledger.posts[T.thumbKey(n)];
  if (!e) return true;
  if (e.err) return (e.tries || 1) < MAX_TRIES && dayDiff(e.at, today) >= RETRY_DAYS;
  return false;
}).sort((a, b) => String(b.postedAt || b.foundAt || '').localeCompare(String(a.postedAt || a.foundAt || '')));
const lanes = new Map();
for (const n of want) { if (!lanes.has(n.school)) lanes.set(n.school, []); const l = lanes.get(n.school); if (l.length < PER_SCHOOL) l.push(n); }

async function descFor(n) {
  const req = postContentRequest(NEWS_BOARD_RULES[newsRuleKey(n)], n);
  if (!req) return { none: '글 화면이 없음' };
  let res;
  try { res = await fetchBoard(req.url, { ...req.opts, tries: 1, firstMs: 12000 }); } catch (e) { return { err: `글 열기 실패 (${netReason(e)})` }; }
  if (!res.ok) return { err: `글 HTTP ${res.status}` };
  let text = await res.text();
  try { if (/^\s*[{[]/.test(text)) text = JSON.stringify(JSON.parse(text)); } catch { /* JSON 아님 */ }
  if (!T.pageHasTitle(text, n.title)) return { err: '글 화면에 그 글의 제목이 없음' };
  const d = newsDesc(text, n.title);
  return d ? { desc: d } : { none: '본문 첫 문장을 확신할 수 없음' };
}

let done = 0; let got = 0;
const ready = [...lanes.keys()];
const worker = async () => {
  for (;;) {
    if (Date.now() - t0 > BUDGET_MS) return;
    const school = ready.shift();
    if (!school) return;
    const list = lanes.get(school);
    const n = list.shift();
    if (n) {
      const key = T.thumbKey(n);
      const r = await withDeadline(descFor(n).catch((e) => ({ err: String(e && e.message || e).slice(0, 80) })), ITEM_HARD_MS);
      const out = r === TIMED_OUT ? { err: '시한 넘김' } : r;
      const prev = ledger.posts[key];
      ledger.posts[key] = out.desc ? { at: today, desc: String(out.desc).slice(0, DESC_MAX + 1) }
        : out.none ? { at: today, none: out.none }
        : { at: today, err: out.err, tries: ((prev && prev.err && prev.tries) || 0) + 1 };
      done += 1; if (out.desc) got += 1;
      await new Promise((res) => setTimeout(res, GAP_MS));
    }
    if (list.length) ready.push(school);
  }
};
await Promise.all(Array.from({ length: LANES }, worker));

/* ③ 소급 입히기 · 장부 다듬기 */
let changed = 0;
const live = new Set();
for (const d of docs) {
  for (const n of d.doc.items || []) {
    const k = T.thumbKey(n); live.add(k);
    const e = ledger.posts[k];
    const w = e && e.desc ? e.desc : undefined;
    if (n.desc === w) continue;
    if (w) n.desc = w; else delete n.desc;
    d.changed = true; changed += 1;
  }
  if (d.changed) fs.writeFileSync(d.path, JSON.stringify(d.doc, null, 1) + (d.eol ? '\n' : ''));
}
for (const [k, e] of Object.entries(ledger.posts)) if (!live.has(k) && dayDiff(e.at, today) > KEEP_DAYS) delete ledger.posts[k];
fs.writeFileSync(LEDGER_PATH, JSON.stringify({ note: '교내 소식 요약 장부 — collector/collect-news-desc.mjs 가 쓴다. posts: 글 열쇠별 결과(desc 원문 발췌 · none 못 뜸 · err 다시 시도).', ...ledger }, null, 1) + '\n');
const withDesc = items.filter((n) => n.desc).length;
console.log(`교내 소식 요약 — 이번에 ${done}건 열어 ${got}건 뜸 · 실린 글 ${items.length}건 중 요약 ${withDesc}건 · 바뀐 글 ${changed}건 (${Math.round((Date.now() - t0) / 1000)}초)`);
process.exit(0);

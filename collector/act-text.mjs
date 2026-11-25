/* ============================================================
   대외활동 유료 관문 — 원문 글자 저장 (2026-11-25 · 설계 docs/designs/paid-gate-activities.md 5-2)

   장학금은 첨부 원본을 저장소에 둔다(collector/extracted — 공고문 원본만 공고당 650KB). 활동 글은 하루 10~15건이라 같은 방식이면
   저장소가 한 달에 수십 MB 씩 는다. 그래서 활동 글은 **뽑은 글자만** 글마다 작은 파일로 둔다:
     collector/act-text/<글 id>.json          — 무료 받기(수집 워크플로의 activity-docs)
     collector/act-text/<글 id>.browser.json  — 진짜 브라우저(원문 받기 워크플로의 activity-docs --browser)
   두 워크플로가 같은 파일을 쓰지 않게 모드마다 제 파일을 쓴다(같은 파일이면 push 가 부딪힌다). 읽는 쪽(readStore)이 둘을 합친다.

   🔴 한 번 쓴 본문은 다시 받아 덮지 않는다 — 본문은 받을 때마다 조회수·옆 목록이 달라진다. 덮으면 원문 해시가 바뀌어 같은 글을 돈 내고 다시 읽는다.
      본문이 빈 글자일 때만 채운다. 첨부 글자는 지문(원본 바이트의 sha1 앞 16자)이 새것만 더한다(같은 PDF 를 OCR 로 두 번 읽으면 글자가 달라진다 — 처음 것을 쓴다).
   🔴 이 파일은 글자만 다룬다 — 받기(HTTP)·글자 뽑기는 activity-docs.mjs 몫이고, 유료 로봇(card-read)은 readStore 로 읽기만 한다.
   관문: verify/test-collector.mjs 「대외활동 유료 관문 ① 원문 글자 저장」
   ============================================================ */
import fs from 'node:fs';
import path from 'node:path';

export const MAX_STORE_BYTES = 2 * 1024 * 1024;   // 한 글의 기록 상한 — 넘으면 큰 첨부부터 뺀다(무엇을 뺐는지 dropped 에)
export const TEXT_WAIT_DAYS = 3;                   // 표시 뒤 이 날까지만 받는다 — 앱은 그 뒤 무료 값으로 올리고, 원문 없는 글은 사람에게 넘어간다(card-read)
const daysSince = (from, today) => Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${String(from).slice(0, 10)}T00:00:00Z`)) / 86400000);
/* 파일 이름으로 쓰는 id — 활동 글 id 는 `act-<지문>`·`api-<출처>-<번호>` 꼴이다. 경로 글자가 섞였으면 쓰지 않는다(폴더 밖에 파일을 만들지 않는다) */
const safeId = (id) => /^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/.test(String(id || '')) && !String(id).includes('..');
const hasText = (v) => typeof v === 'string' && v.trim().length > 0;
const readOne = (file) => { try { const j = JSON.parse(fs.readFileSync(file, 'utf8')); return j && typeof j === 'object' && !Array.isArray(j) ? j : null; } catch { return null; } };

export const storeFile = (dir, id, mode = 'plain') => path.join(dir, `${id}${mode === 'browser' ? '.browser' : ''}.json`);

/** 한 글의 기록을 쓴다 — 바뀐 것이 있을 때만(빈 커밋이 생기지 않게). 쓴 뒤 참을 돌려준다.
    rec = { url, body, bodyFrom, docs: [{ name, hash, from: 'attach'|'img'|'guide', ocr, text }] } */
export function writeStore(dir, id, mode, rec, today) {
  if (!safeId(id)) return false;
  const file = storeFile(dir, id, mode);
  const old = readOne(file);
  const next = old ? { ...old, docs: Array.isArray(old.docs) ? [...old.docs] : [] } : { url: String((rec && rec.url) || ''), at: today, body: '', bodyFrom: '', docs: [] };
  let changed = !old;
  if (!hasText(next.body) && rec && hasText(rec.body)) { next.body = rec.body; next.bodyFrom = String(rec.bodyFrom || ''); changed = true; }
  const have = new Set(next.docs.map((d) => d && d.hash));
  for (const d of (rec && rec.docs) || []) {
    if (!d || !d.hash || !hasText(d.text) || have.has(d.hash)) continue;
    have.add(d.hash);
    next.docs.push({ name: String(d.name || ''), hash: String(d.hash), from: ['attach', 'img', 'guide'].includes(d.from) ? d.from : 'attach', ocr: !!d.ocr, text: d.text });
    changed = true;
  }
  if (!changed) return false;
  next.at = today;
  const bytes = () => Buffer.byteLength(JSON.stringify(next, null, 1));
  while (bytes() > MAX_STORE_BYTES && next.docs.length) {
    let big = 0;
    next.docs.forEach((d, i) => { if (String(d.text || '').length > String(next.docs[big].text || '').length) big = i; });
    const [gone] = next.docs.splice(big, 1);
    next.dropped = [...(next.dropped || []), gone.name || gone.hash];
  }
  fs.mkdirSync(dir, { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(next, null, 1)}\n`);
  fs.renameSync(tmp, file);
  return true;
}

/** 두 모드의 기록을 합쳐 읽는다 — 없으면 null. 본문은 무료 받기 것이 비지 않았으면 그것, 아니면 브라우저 것 · 첨부는 지문으로 한 번씩(무료 받기 것이 먼저 · 차례는 저장된 그대로) */
export function readStore(dir, id) {
  if (!safeId(id)) return null;
  const p = readOne(storeFile(dir, id, 'plain')), b = readOne(storeFile(dir, id, 'browser'));
  if (!p && !b) return null;
  const seen = new Set(); const docs = [];
  for (const d of [...((p && p.docs) || []), ...((b && b.docs) || [])]) {
    if (!d || !d.hash || !hasText(d.text) || seen.has(d.hash)) continue;
    seen.add(d.hash); docs.push(d);
  }
  if (p && hasText(p.body)) return { body: p.body, bodyFrom: p.bodyFrom || 'plain', docs };
  if (b && hasText(b.body)) return { body: b.body, bodyFrom: b.bodyFrom || 'browser', docs };
  return { body: '', bodyFrom: '', docs };
}

/** 이 글의 글자를 받아야 하나 — 표시(paidGate)가 달린 글만 사흘 동안. 올린 글(paidOpen)·관리자가 숨긴 글·id 없는 글은 아니다.
    ids = 시험 워크플로가 지정한 글(ACT_TEXT_IDS) — 표시가 없어도 받는다 */
export function wantsText(n, today, ids = new Set()) {
  if (!n || !n.id || !safeId(n.id)) return false;
  if (ids.has(n.id)) return true;
  if (!n.paidGate || n.paidOpen || n.hidden) return false;
  const d = daysSince(n.paidGate, today);
  return Number.isFinite(d) && d <= TEXT_WAIT_DAYS;
}

/** 지금 받을 차례인가 —
    무료 받기: 기록이 없거나, 본문이 빈 채 날이 바뀌었을 때(같은 날 같은 글을 다시 두드리지 않는다). 본문이 있으면 다시 받지 않는다.
    브라우저: 무료 받기 기록이 있고 그 본문이 빈 글만(무료 받기가 먼저) · 브라우저 기록이 이미 있으면 받지 않는다 */
export function textDue(dir, id, mode, today) {
  if (!safeId(id)) return false;
  const p = readOne(storeFile(dir, id, 'plain'));
  if (mode === 'browser') return !!p && !hasText(p.body) && !readOne(storeFile(dir, id, 'browser'));
  if (!p) return true;
  return !hasText(p.body) && p.at !== today;
}

/** 목록에서 빠진 글의 기록을 지운다 — 제 모드의 파일만(다른 워크플로의 파일을 건드리지 않는다). 지운 수를 돌려준다 */
export function pruneStore(dir, liveIds, mode) {
  let n = 0;
  let names = [];
  try { names = fs.readdirSync(dir); } catch { return 0; }
  for (const f of names) {
    const isBrowser = f.endsWith('.browser.json');
    if (!f.endsWith('.json') || (mode === 'browser') !== isBrowser) continue;
    const id = f.slice(0, -(isBrowser ? '.browser.json'.length : '.json'.length));
    if (liveIds.has(id)) continue;
    try { fs.unlinkSync(path.join(dir, f)); n += 1; } catch { /* 이미 없음 */ }
  }
  return n;
}

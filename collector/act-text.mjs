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
export const daysSince = (from, today) => Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${String(from).slice(0, 10)}T00:00:00Z`)) / 86400000);
/* 파일 이름으로 쓰는 id — 활동 글 id 는 `act-<지문>`·`api-<출처>-<번호>` 꼴이다. 경로 글자가 섞였으면 쓰지 않는다(폴더 밖에 파일을 만들지 않는다) */
const safeId = (id) => /^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/.test(String(id || '')) && !String(id).includes('..');
const hasText = (v) => typeof v === 'string' && v.trim().length > 0;
/* 그림 글자 대기(ocrPending · 2026-11-27 대외활동 유료 시험 · 개발자 「재발하지 않도록 순서도에 확실하게 각인」) — 그림 글자 엔진이 고장 났거나 시간이 모자라 못 읽은 그림의 원본 바이트 지문.
   표시가 남은 글은 원문이 덜 왔다: 카드 쓰기가 읽지 않고(돈 0) 사람에게도 넘기지 않는다(card-read pickTargets·actGateHeldOf) · 본문이 있어도 다음 날 다시 받는다(textDue).
   예전엔 못 읽은 그림이 기록에서 조용히 빠져 「다 받은」 기록이 됐고, 포스터뿐인 글은 「원문 없음」·서식만 읽힌 글은 「읽을 내용 없음」으로 사람에게 넘겨져 숨었다 */
const pendOf = (rec) => (rec && Array.isArray(rec.ocrPending) ? rec.ocrPending.filter((h) => typeof h === 'string' && h) : []);
/* 이름이 있는 첨부는 이름으로도 한 번만(최종 리뷰 2026-11-26) — 받을 때마다 워터마크·날짜를 박아 바이트가 바뀌는 사이트는 같은 첨부가 지문마다 한 번씩 실려 원문이 바뀌고 같은 글을 다시 샀다 · 처음 것을 쓴다.
   🔴 이름은 **이미 저장된 첨부(다른 날)와 다른 모드의 기록**에만 견준다 — 한 번 받기 안의 같은 이름은 서로 다른 파일이다(리뷰 3차 I2 · 서울과기대 act-0dyt0rm 의 「멘토링 계획서(양식).hwp」 두 줄 중 하나는 포스터).
   ponytail: 같은 이름의 둘 중 하나가 첫날 못 받아지고 다음 날 받아지면 그것은 빠진다(본문이 빈 글만 다시 받는다 — 드물다) · 잦아지면 열쇠에 첨부 자리(몇째 파일)를 넣는다 */
const nameKey = (d) => (d && String(d.name || '').trim() ? `${['attach', 'img', 'guide'].includes(d.from) ? d.from : 'attach'}|${String(d.name).trim()}` : '');
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
  const storedName = new Set(next.docs.map(nameKey).filter(Boolean));   // 이미 저장된 것만 — 이번 받기에서 더한 이름은 넣지 않는다
  for (const d of (rec && rec.docs) || []) {
    if (!d || !d.hash || !hasText(d.text) || have.has(d.hash) || (nameKey(d) && storedName.has(nameKey(d)))) continue;
    have.add(d.hash);
    next.docs.push({ name: String(d.name || ''), hash: String(d.hash), from: ['attach', 'img', 'guide'].includes(d.from) ? d.from : 'attach', ocr: !!d.ocr, text: d.text });
    changed = true;
  }
  /* 그림 글자 대기 — 이번 받기가 이 글의 그림을 다룬 실행이면(rec.ocrPending 이 배열 · activity-docs ocrPendingOf) 그 목록으로 바꾸고, 안 다룬 실행이면(칸 없음) 전 표시를 그대로 둔다.
     어느 쪽이든 글자가 이미 온 그림(docs 의 지문)은 뺀다 · 다 빠지면 칸을 지운다 */
  const docsHave = new Set(next.docs.map((d) => d && d.hash));
  const prevPend = pendOf(next);
  const nextPend = [...new Set(rec && Array.isArray(rec.ocrPending) ? pendOf(rec) : prevPend)].filter((h) => !docsHave.has(h));
  if (JSON.stringify(nextPend) !== JSON.stringify(prevPend)) {
    if (nextPend.length) next.ocrPending = nextPend; else delete next.ocrPending;
    changed = true;
  }
  /* 🔴 바뀐 것이 없어도 「오늘 받아 봤다」(tried)는 남긴다 — 안 남기면 textDue 가 그날 수집할 때마다 본문이 빈 글을 다시 받는다(최종 리뷰 2026-11-26 · 하루에 여러 번 두드리지 말 것).
     본문이 빈 기록과 그림 글자 대기가 남은 기록만(둘 다 아니면 다시 받을 일이 없다) · 그날 이미 적었으면 쓰지 않는다(빈 커밋 없음) · 내용이 바뀐 날(at)은 바뀐 날만 */
  if (!changed && ((hasText(next.body) && !pendOf(next).length) || old.tried === today)) return false;
  if (changed) next.at = today;
  next.tried = today;
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
  return changed;   // 「받아 봤다」만 적은 날은 쓴 글로 세지 않는다
}

/** 두 모드의 기록을 합쳐 읽는다 — 없으면 null. 본문은 무료 받기 것이 비지 않았으면 그것, 아니면 브라우저 것 · 첨부는 지문으로 한 번씩(무료 받기 것이 먼저 · 차례는 저장된 그대로) */
export function readStore(dir, id) {
  if (!safeId(id)) return null;
  const p = readOne(storeFile(dir, id, 'plain')), b = readOne(storeFile(dir, id, 'browser'));
  if (!p && !b) return null;
  const seen = new Set(); const docs = [];
  const plainNames = new Set(((p && p.docs) || []).map(nameKey).filter(Boolean));   // 이름은 다른 모드의 기록에만 견준다(한 모드 안의 같은 이름은 다른 파일)
  const add = (d, otherNames) => {
    if (!d || !d.hash || !hasText(d.text) || seen.has(d.hash) || (otherNames && nameKey(d) && otherNames.has(nameKey(d)))) return;
    seen.add(d.hash); docs.push(d);
  };
  for (const d of (p && p.docs) || []) add(d, null);
  for (const d of (b && b.docs) || []) add(d, plainNames);
  /* 그림 글자 대기는 두 모드의 표시를 합친다 — 어느 쪽에서든 글자가 온 그림은 뺀다(한쪽이 읽었으면 기다릴 것이 없다) */
  const pend = [...new Set([...pendOf(p), ...pendOf(b)])].filter((h) => !seen.has(h));
  const extra = pend.length ? { ocrPending: pend } : {};
  if (p && hasText(p.body)) return { body: p.body, bodyFrom: p.bodyFrom || 'plain', docs, ...extra };
  if (b && hasText(b.body)) return { body: b.body, bodyFrom: b.bodyFrom || 'browser', docs, ...extra };
  return { body: '', bodyFrom: '', docs, ...extra };
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
  if (mode === 'browser') {
    const b = readOne(storeFile(dir, id, 'browser'));
    if (b && pendOf(b).length) return (b.tried || b.at) !== today;   // 그림 글자 대기 — 다음 날 다시(하루 한 번 · 2026-11-27)
    return !!p && !hasText(p.body) && !b;
  }
  if (!p) return true;
  if (pendOf(p).length) return (p.tried || p.at) !== today;   // 그림 글자 대기 — 본문이 있어도 다음 날 다시 받아 그림을 다시 읽는다(하루 한 번 · 2026-11-27)
  return !hasText(p.body) && (p.tried || p.at) !== today;   // tried — 마지막으로 받아 본 날(바뀐 것이 없던 날도 · 옛 기록은 at)
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

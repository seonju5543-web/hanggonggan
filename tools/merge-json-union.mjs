#!/usr/bin/env node
/* 로봇이 만드는 상태 파일 전용 자동 병합기 (2026-07-31 신설)

   ─ 왜 필요한가 ─────────────────────────────────────────────────────
   두 개발자가 같은 시간대에 작업하면 충돌이 나는데, 실제로 부딪히는 파일의
   대부분은 사람이 쓴 코드가 아니라 **로봇이 매일 새로 쓰는 기록장**이다.
   (최근 100커밋 기준: notices.json 45회 · seen.json 36회 · 리포트 28회 —
    사람이 고친 앱 코드는 app.js 5회뿐)

   이런 파일은 "누구 것이 맞나"를 고를 필요가 없다. 양쪽 다 맞고,
   **둘을 합치면 되는 것**이다. 그런데 git은 내용을 모르니 줄 단위로만 보고
   "여기 둘 다 고쳤는데요?" 하며 멈춰 선다. 그래서 사람이(=Claude 세션이)
   매번 손으로 합쳐야 했고, 로봇의 배포 동기화는 🚨 이슈를 남기며 실패했다.

   이 파일은 그 합치는 규칙을 파일별로 알고 있는 병합기다. git이 충돌을
   만났을 때 이 프로그램을 대신 부르도록 `.gitattributes`에 지정돼 있고,
   등록은 `tools/setup-collab.sh`가 한다.

   ─ 안전장치 ────────────────────────────────────────────────────────
   · 규칙을 모르는 파일은 손대지 않는다(종료코드 1 → 평소처럼 사람이 해결).
   · JSON이 깨져 있으면 손대지 않는다.
   · 지우기는 하지 않는다. 합집합만 만든다. 잘못 합쳐져도 다음 수집 실행이
     60일 규칙·중복 제거·상한을 다시 적용하므로 스스로 정리된다.
   · 사람이 큐레이션하는 data/registered.json·data/forms.json은 일부러
     대상에서 뺐다 — 거기서는 '삭제'가 의미를 갖기 때문에(잘못 등록분 제거)
     합집합이 지운 항목을 되살릴 수 있다. 그건 사람이 봐야 한다.

   ─ 사용법 (git이 부른다) ────────────────────────────────────────────
     node tools/merge-json-union.mjs %O %A %B %P
       %O 공통 조상  %A 내 것(결과를 여기 쓴다)  %B 상대 것  %P 원래 파일 경로
     종료코드 0 = 합쳤음 / 1 = 못 합쳤으니 평소대로 충돌 처리해 주세요
*/

import fs from 'node:fs';
import path from 'node:path';
import { dedupeNotices } from '../collector/url-key.mjs';
/* 학교당 상한은 발행기 것을 그대로 쓴다 — 베끼면 병합이 발행과 다른 크기를 만든다 */
import { PER_SCHOOL } from '../collector/publish-notices.mjs';

const [, , oursBase, oursPath, theirsPath, filePath = ''] = process.argv;

function readJson(p) {
  try {
    const raw = fs.readFileSync(p, 'utf8');
    if (!raw.trim()) return null;
    return JSON.parse(raw);
  } catch {
    return undefined; // undefined = 못 읽음(깨졌거나 없음)
  }
}

/* 공고 피드: 두 쪽 공고를 합치고, 이미 있는 중복 제거 규칙(url-key.mjs)을 그대로 쓴다.
   수집기와 같은 함수를 쓰므로 규칙이 갈라질 수 없다. */
function mergeNotices(ours, theirs) {
  const a = Array.isArray(ours?.items) ? ours.items : [];
  const b = Array.isArray(theirs?.items) ? theirs.items : [];
  // 최신 수집분이 앞에 오도록 정렬한 뒤 중복 제거 — 남길 항목 선택은 preferNotice가 한다
  const all = a.concat(b).sort((x, y) => String(y.foundAt || '').localeCompare(String(x.foundAt || '')));
  let items = dedupeNotices(all);
  // 수집기와 같은 상한(전체 200건) — 합치느라 목록이 무한정 늘지 않게
  if (items.length > 200) items = items.slice(0, 200);
  const updatedAt = [ours?.updatedAt, theirs?.updatedAt].filter(Boolean).sort().pop();
  return { ...(ours || {}), ...(theirs || {}), updatedAt, items };
}

/* 🔴 **학교별 공고 파일** `data/notices/<학교>.json` (2026-09-05 신설).
   왜 지금 생겼나: 이 파일을 쓰는 것은 오랫동안 수집 로봇 둘뿐이었고 **같은 대기줄
   (concurrency: collector)이라 줄을 서서** 부딪힐 일이 없었다. 2026-09-05에 링크 사냥꾼과
   원문 링크 복구가 여기에 주소를 옮겨 쓰게 되면서 **서로 다른 대기줄 넷**이 같은 파일을
   건드리게 됐다. 규칙이 없으면 평범한 줄 단위 충돌이 나고, 워크플로는 pull --rebase 3회
   뒤 exit 1 — 사냥 결과가 통째로 날아가는 그 경로다(이슈 #85·#86과 같은 계열).
   ⚠️ 상한은 **전체 200이 아니라 학교당 PER_SCHOOL** 이다. 200을 쓰면 학교별로 나눈 뜻이
   사라진다 — 그래서 publish-notices.mjs 의 값을 가져다 쓴다(베끼면 갈라진다). */
function mergeSchoolNotices(ours, theirs) {
  const a = Array.isArray(ours?.items) ? ours.items : [];
  const b = Array.isArray(theirs?.items) ? theirs.items : [];
  const all = a.concat(b).sort((x, y) => String(y.foundAt || '').localeCompare(String(x.foundAt || '')));
  let items = dedupeNotices(all);
  if (items.length > PER_SCHOOL) items = items.slice(0, PER_SCHOOL);
  const updatedAt = [ours?.updatedAt, theirs?.updatedAt].filter(Boolean).sort().pop();
  return { ...(ours || {}), ...(theirs || {}), updatedAt, items };
}

/* 이미 본 공고 장부: 주소 → 처음 본 날짜. 합치되 **더 이른 날짜**를 남긴다.
   (늦은 날짜를 남기면 '아직 새 공고'로 오해해 같은 공고를 다시 담을 수 있다) */
function mergeSeen(ours, theirs) {
  const out = { ...(theirs || {}) };
  for (const [url, when] of Object.entries(ours || {})) {
    out[url] = out[url] && out[url] < when ? out[url] : when;
  }
  return out;
}

/* 양식 원본 대기 큐: id로 합치고, **더 많이 진행된 쪽**을 남긴다.
   (한쪽에서 원본을 받아 fetched:true가 됐는데 상대의 옛 false로 덮이면 다시 받게 된다) */
function mergePendingForms(ours, theirs) {
  const byId = new Map();
  const progress = (it) => (it.schematized ? 2 : 0) + (it.fetched ? 1 : 0);
  for (const it of [...(ours?.items || []), ...(theirs?.items || [])]) {
    if (!it || !it.id) continue;
    const prev = byId.get(it.id);
    if (!prev) { byId.set(it.id, it); continue; }
    byId.set(it.id, progress(it) > progress(prev) ? { ...prev, ...it } : { ...it, ...prev });
  }
  return { ...(ours || {}), ...(theirs || {}), items: [...byId.values()] };
}

/* 학교 접속 건강 기록: 학교별로 **최근에 성공한 쪽**을 남긴다.
   (연속 실패 횟수는 큰 쪽을 남기면 멀쩡한 학교에 🚨가 뜬다) */
function mergeHealth(ours, theirs) {
  const out = { ...(ours || {}) };
  for (const [school, t] of Object.entries(theirs || {})) {
    const o = out[school];
    if (!o) { out[school] = t; continue; }
    const newer = String(t.lastOk || '') >= String(o.lastOk || '') ? t : o;
    const older = newer === t ? o : t;
    out[school] = { ...older, ...newer, fails: Math.min(o.fails ?? 0, t.fails ?? 0) };
  }
  return out;
}

/* 링크 사냥꾼 기록장 — 공고별 시도 횟수·마지막 사유. 두 판이 갈리면 '더 많이 안 사람'을 남긴다.
   (시도 횟수는 큰 쪽, 판정이 난 쪽(resolved/gone/stuck)이 아직 판정 안 난 쪽을 이긴다) */
function mergeLinkHunt(o, t) {
  const rank = (s) => (s === 'resolved' ? 3 : s === 'gone' || s === 'stuck' ? 2 : 1);
  const out = { updatedAt: (o.updatedAt || '') > (t.updatedAt || '') ? o.updatedAt : t.updatedAt, items: { ...(t.items || {}) } };
  for (const [k, ov] of Object.entries(o.items || {})) {
    const tv = out.items[k];
    if (!tv) { out.items[k] = ov; continue; }
    const win = rank(ov.status) >= rank(tv.status) ? ov : tv;
    const lose = win === ov ? tv : ov;
    out.items[k] = { ...lose, ...win, attempts: Math.max(ov.attempts || 0, tv.attempts || 0) };
  }
  return out;
}

const RULES = [
  /* ⚠️ 학교별 파일이 먼저다 — `data/notices/x.json` 은 아래 notices.json 규칙에 안 걸리지만,
     순서를 눈에 보이게 두어 다음 사람이 헷갈리지 않게 한다. index.json 은 매 발행마다
     새로 쓰이므로 .gitattributes 에서 merge=ours 로 뺐다(합칠 내용이 없다). */
  { match: /(^|\/)data\/notices\/[^/]+\.json$/, merge: mergeSchoolNotices },
  { match: /(^|\/)notices\.json$/, merge: mergeNotices },
  { match: /(^|\/)link-hunt\.json$/, merge: mergeLinkHunt },
  { match: /(^|\/)seen\.json$/, merge: mergeSeen },
  { match: /(^|\/)pending-forms\.json$/, merge: mergePendingForms },
  { match: /(^|\/)health\.json$/, merge: mergeHealth },
];

function main() {
  const rel = filePath.split(path.sep).join('/');
  const rule = RULES.find((r) => r.match.test(rel));
  if (!rule) {
    console.error(`[merge-json-union] 규칙 없는 파일이라 자동 병합하지 않음: ${rel}`);
    return 1;
  }
  const ours = readJson(oursPath);
  const theirs = readJson(theirsPath);
  if (ours === undefined || theirs === undefined) {
    console.error(`[merge-json-union] JSON을 읽지 못해 자동 병합하지 않음: ${rel}`);
    return 1;
  }
  let merged;
  try {
    merged = rule.merge(ours, theirs);
  } catch (e) {
    console.error(`[merge-json-union] 병합 중 오류라 손대지 않음: ${rel} — ${e.message}`);
    return 1;
  }
  // 로봇이 쓰는 방식과 같은 서식(들여쓰기 1칸)으로 저장 — 다음 실행에서 통째로 바뀌지 않게.
  // 파일 끝 줄바꿈 유무도 원래대로 맞춘다(파일마다 다르다 — 안 맞추면 매번 헛 변경이 생긴다).
  const hadEol = /\n$/.test(fs.readFileSync(oursPath, 'utf8'));
  fs.writeFileSync(oursPath, JSON.stringify(merged, null, 1) + (hadEol ? '\n' : ''));
  console.error(`[merge-json-union] 자동 병합 완료: ${rel}`);
  return 0;
}

// 공통 조상(%O)은 쓰지 않지만 git이 넘겨주므로 자리를 지켜 둔다
void oursBase;
process.exit(main());

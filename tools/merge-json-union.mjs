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
     ⚠️ 예외 하나 — 검수 후보(candidates.json)는 수집기의 mergeCandidates 를 그대로 쓰므로
        60일 지난 후보는 합치면서 빠진다(로봇이 저장할 때와 같은 규칙 · 2026-09-30).
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
import { dedupeNotices, capNotices } from '../collector/url-key.mjs';
/* 학교당 상한은 발행기 것을 그대로 쓴다 — 베끼면 병합이 발행과 다른 크기를 만든다 */
import { PER_SCHOOL } from '../collector/publish-notices.mjs';
/* 검수 후보 장부는 수집기와 같은 합치기 규칙을 쓴다(베끼면 갈라진다 — 60일·주소 열쇠·preferNotice) */
import { mergeCandidates } from '../collector/candidates.mjs';
import { urlKey } from '../collector/url-key.mjs';
import { newsDistinct } from '../collector/news-board-rules.mjs';   // 소식 '다른 글' 잣대 한 곳 (발행과 같다)

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
  /* 🔴 상한은 **수집기와 같은 capNotices** 다 (2026-10-03 사고). 예전엔 여기만 '전체 200건'을 박아 두었는데, 수집기는 44개교
     복원 뒤 학교 수 × 15(지금 540)까지 담는다. 링크 사냥꾼과 원문 링크 복구가 같은 때 저장하며 이 병합기를 거치자 실시간 공고
     장부가 339 → 200건으로 잘렸고(13개교 139건), 다음 발행이 학교별 파일까지 그 장부로 다시 만들어 학생 화면에서 사라질 뻔했다.
     베끼지 않고 수집기 함수를 그대로 부른다 — 숫자가 다시 갈라지지 않게. */
  const items = capNotices(dedupeNotices(all));
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
function mergeSchoolNotices(ours, theirs, opts = {}) {
  const a = Array.isArray(ours?.items) ? ours.items : [];
  const b = Array.isArray(theirs?.items) ? theirs.items : [];
  const all = a.concat(b).sort((x, y) => String(y.foundAt || '').localeCompare(String(x.foundAt || '')));
  let items = dedupeNotices(all, opts);
  if (items.length > PER_SCHOOL) items = items.slice(0, PER_SCHOOL);
  const updatedAt = [ours?.updatedAt, theirs?.updatedAt].filter(Boolean).sort().pop();
  return { ...(ours || {}), ...(theirs || {}), updatedAt, items };
}

/* 이미 본 공고 장부: 주소 → 처음 본 날짜. 합치되 **더 이른 날짜**를 남긴다.
   (늦은 날짜를 남기면 '아직 새 공고'로 오해해 같은 공고를 다시 담을 수 있다) */
/* 🔴 대외활동·재단 피드 (2026-10-04 — .gitattributes 에는 2026-09-25·26 부터 jsonunion 이라 적혀 있었는데 **여기 규칙이 없어**
   「규칙 없는 파일이라 자동 병합하지 않음」 으로 물러났다. 그날 사람이 activities.json 을 고친 사이 수집 로봇이 저장하려다 충돌해
   그 실행의 결과(첨부·발췌·새 글)가 **통째로** 버려졌다).
   글은 주소(urlKey)로 짝짓고 · 양쪽에 있는 글은 칸을 합친다(같은 칸은 theirs — rebase 때 다시 얹는 쪽이 방금 실행한 로봇이다) ·
   한쪽에만 있는 글은 남긴다(로봇이 지운 지난 글이 되살아나도 다음 실행이 같은 규칙으로 다시 지운다 — 새 글을 잃는 것보다 낫다).
   나머지 칸(fields 등)은 theirs 를 덮어 쓰고 updatedAt 은 늦은 쪽. */
function mergeFeedByUrl(ours, theirs) {
  const a = Array.isArray(ours?.items) ? ours.items : [];
  const b = Array.isArray(theirs?.items) ? theirs.items : [];
  const out = new Map();
  for (const it of a) if (it && it.url) out.set(urlKey(it.url), it);
  for (const it of b) {
    if (!it || !it.url) continue;
    const k = urlKey(it.url);
    out.set(k, out.has(k) ? { ...out.get(k), ...it } : it);
  }
  const updatedAt = [ours?.updatedAt, theirs?.updatedAt].filter(Boolean).sort().pop();
  return { ...(ours || {}), ...(theirs || {}), updatedAt, items: [...out.values()] };
}

function mergeSeen(ours, theirs) {
  const out = { ...(theirs || {}) };
  for (const [url, when] of Object.entries(ours || {})) {
    out[url] = out[url] && out[url] < when ? out[url] : when;
  }
  return out;
}

/* 교내 소식 썸네일 장부 (2026-10-03) — 글마다 결과는 사진(file)이 있는 쪽 → 날짜가 늦은 쪽, 그림 주소를 본 글은 합집합(공통 그림을 잊지 않게) */
function mergeThumbLedger(ours, theirs) {
  const o = ours || {}; const t = theirs || {};
  const posts = { ...(t.posts || {}) };
  for (const [k, e] of Object.entries(o.posts || {})) {
    const x = posts[k];
    posts[k] = !x ? e : (!!e.file !== !!x.file ? (e.file ? e : x) : (String(e.at || '') >= String(x.at || '') ? e : x));
  }
  const srcSeen = {};
  for (const side of [t.srcSeen || {}, o.srcSeen || {}]) for (const [school, m] of Object.entries(side)) {
    const d = (srcSeen[school] ||= {});
    for (const [src, keys] of Object.entries(m)) d[src] = [...new Set([...(d[src] || []), ...keys])].slice(0, 3);
  }
  return { ...t, ...o, posts, srcSeen };
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

/* ── 2026-09-30 신설 셋 — 브라우저 수집 19곳 17분치가 통째로 버려진 사고에서 ──────────
   수동 실행 둘이 같은 대기줄(collector)에 서 있다가, 뒤 로봇이 **대기줄에 들어간 시점의 옛 커밋**에서
   시작해(GITHUB_SHA 가 큐에 넣을 때 굳는다) 앞 로봇의 저장 위로 rebase 하다 규칙 없는 파일 넷에서 충돌 →
   3회 재시도 실패 → exit 1. 체크아웃 기준을 고친 것(워크플로 `ref: github.ref_name`)이 본 수리이고,
   여기는 그래도 부딪힐 때를 위한 안전망이다. registered.json 은 여전히 일부러 뺀다(삭제가 뜻을 가진다). */
/* 검수 후보 장부 — 수집기의 mergeCandidates 그대로(주소 열쇠 · 60일 · 더 나은 판 선택 · 순서 고정) */
function mergeCandidateLedger(o, t) {
  const items = mergeCandidates(t?.items || [], o?.items || []);
  const updatedAt = [o?.updatedAt, t?.updatedAt].filter(Boolean).sort().pop();
  return { ...(t || {}), ...(o || {}), updatedAt, count: items.length, items };
}
/* 페이지 넘기기 기록: 게시판 주소 → { ok, checkedAt, … }. 더 최근에 확인한 쪽을 남긴다 */
function mergePagination(o, t) {
  const out = { ...(t || {}) };
  for (const [k, ov] of Object.entries(o || {})) {
    const tv = out[k];
    out[k] = !tv || String(ov?.checkedAt || '') >= String(tv?.checkedAt || '') ? ov : tv;
  }
  return out;
}
/* 공고 원문 말뭉치(배열): 주소로 합치고, 본문을 더 많이 가진 쪽을 남긴다(잘린 판이 온전한 판을 덮지 않게) */
function mergeNoticesText(o, t) {
  const byKey = new Map();
  const weight = (x) => (Number(x?.bodyChars) || String(x?.text || '').length);
  for (const it of [...(Array.isArray(t) ? t : []), ...(Array.isArray(o) ? o : [])]) {
    if (!it || !it.url) continue;
    const k = urlKey(it.url);
    const prev = byKey.get(k);
    byKey.set(k, !prev || weight(it) >= weight(prev) ? it : prev);
  }
  return [...byKey.values()];
}

/* 학습 표(own-programs.json · 2026-09-30): 학교별 제도 이름을 이름으로 합친다 · blocked 도 합친다 · blocked 에 있는 이름은 programs 에서 뺀다 */
function mergeOwnPrograms(o, t) {
  const out = { ...(t || {}), ...(o || {}), programs: {}, blocked: {} };
  for (const side of [t, o]) {
    for (const [school, list] of Object.entries((side && side.blocked) || {})) {
      const cur = out.blocked[school] || []; for (const p of list || []) if (!cur.some((x) => (x.name || x) === (p.name || p))) cur.push(p); out.blocked[school] = cur;
    }
  }
  for (const side of [t, o]) {
    for (const [school, list] of Object.entries((side && side.programs) || {})) {
      const blocked = new Set((out.blocked[school] || []).map((x) => x.name || x));
      const cur = out.programs[school] || [];
      for (const p of list || []) { const n = p.name || p; if (!blocked.has(n) && !cur.some((x) => (x.name || x) === n)) cur.push(p); }
      out.programs[school] = cur;
    }
  }
  return out;
}

const RULES = [
  { match: /(^|\/)collector\/own-programs\.json$/, merge: mergeOwnPrograms },
  { match: /(^|\/)collector\/candidates\.json$/, merge: mergeCandidateLedger },
  { match: /(^|\/)collector\/pagination\.json$/, merge: mergePagination },
  { match: /(^|\/)collector\/extracted\/notices-text\.json$/, merge: mergeNoticesText },
  /* ⚠️ 학교별 파일이 먼저다 — `data/notices/x.json` 은 아래 notices.json 규칙에 안 걸리지만,
     순서를 눈에 보이게 두어 다음 사람이 헷갈리지 않게 한다. index.json 은 매 발행마다
     새로 쓰이므로 .gitattributes 에서 merge=ours 로 뺐다(합칠 내용이 없다). */
  { match: /(^|\/)data\/notices\/[^/]+\.json$/, merge: mergeSchoolNotices },
  /* 교내 소식 (2026-09-30) — 학교별 파일·장부·건강 장부는 공고와 같은 모양이라 같은 병합기를 쓴다 */
  /* 글 번호가 다르면 같은 주소(목록 표식 #n-제목)라도 다른 글이다 — 수집 로봇의 발행(collect-news.mjs)과 같은 잣대 (리뷰 12차: 병합이 같은 제목의 옛 글을 지우면
     장부에 이미 본 글이라 영영 돌아오지 않았다) */
  { match: /(^|\/)data\/news\/[^/]+\.json$/, merge: (o, t) => mergeSchoolNotices(o, t, { distinct: newsDistinct }) },
  { match: /(^|\/)seen-news\.json$/, merge: mergeSeen },
  { match: /(^|\/)news-thumbs\.json$/, merge: mergeThumbLedger },
  { match: /(^|\/)news-health\.json$/, merge: mergeHealth },
  { match: /(^|\/)notices\.json$/, merge: mergeNotices },
  { match: /(^|\/)data\/(?:activities|external)\.json$/, merge: mergeFeedByUrl },
  { match: /(^|\/)collector\/seen-(?:activities|external)\.json$/, merge: mergeSeen },
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

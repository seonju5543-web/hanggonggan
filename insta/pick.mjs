/**
 * 오늘 올릴 공고 고르기 — 규격 `insta/SCRIPT.md`
 *
 * 🔴 **금액순이 아니라 '몇 명이 볼 수 있나'순.** 실측: 지역 제한 없고 200만원 이상이고
 *    마감 30일 내인 것이 145건 중 9건뿐이었고, 금액 큰 둘은 미술 전공·새터민 이공계였다.
 *    금액으로 고르면 아무도 못 받는 공고만 올리게 된다.
 * 🔴 올린 것·준비한 것은 `insta/seen.json` 이 기억한다. 없으면 매일 같은 공고를 새 공고로
 *    올린다(수집기 이슈 #75 와 같은 유형). 장부는 둘이다 —
 *    `posted`   올린 것(되돌릴 수 없는 사실 · 게시 단계만 적는다)
 *    `prepared` 카드를 그려 개발자에게 보낸 것(`insta/pub/<코드>/` 와 짝 · 상태 prepared/skipped/failed/expired/posted)
 *               expired = 올리기 전에 마감이 지나 폴더를 지운 것(expireRows · `ledger.mjs expire` · 2026-10-04)
 *
 * 🔴 **공고 하나에 게시물 하나 · 생기면 바로**(2026-09-12 개발자 지시). 예전엔 월·목에 점수
 *    1등 하나만 골랐다. 지금은 아직 준비 안 한 공고를 **전부** 후보로 보되, 한 실행에서
 *    그리는 수만 `--max` 로 막는다(그리기가 한 건에 30초쯤이라 첫 실행에 98건을 다 그리면
 *    시간 상한에 걸려 통째로 죽는다 — CLAUDE.md 의 '넘어져도 저장' 유형). 남은 것은 다음 실행.
 *
 * 실행: node insta/pick.mjs           점수 1등 하나 (JSON)
 *       node insta/pick.mjs --list    상위 12개를 점수와 함께 (사람이 볼 용도)
 *       node insta/pick.mjs --new [--max=6]   아직 준비 안 한 공고를 점수순으로 (JSON 배열)
 */
import { readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { kstDay } from './graph.mjs';

const ROOT = new URL('../', import.meta.url);
const SEEN = new URL('insta/seen.json', ROOT);

export const readSeen = () => {
  const s = existsSync(SEEN) ? JSON.parse(readFileSync(SEEN, 'utf8')) : {};
  return { posted: s.posted || [], prepared: s.prepared || [] };
};
/** 준비 장부에서 이 공고의 줄. */
export const preparedOf = (seen, code) => seen.prepared.find((p) => p.code === code) || null;
/** 준비했다고 적는다(같은 공고는 덮어쓴다 — 다시 그리면 최신이 정답이다). */
export function markPrepared(seen, rec) {
  const i = seen.prepared.findIndex((p) => p.code === rec.code);
  const row = { status: 'prepared', ...rec };
  if (i >= 0) seen.prepared[i] = { ...seen.prepared[i], ...row }; else seen.prepared.push(row);
  return seen;
}
/** 그린 카드의 meta.json(render.mjs --pub) → 장부 줄 — `ledger.mjs prepared` 와 `revise.mjs` 가 같이 쓰는 한 곳(리뷰 2026-10-05).
 *  🔴 `dates` 를 꼭 옮긴다 — 관리자 화면(instaPublishBlock)과 게시(publishRefusal)가 이 칸으로 옛 「마감 D-N」 카드를 가린다.
 *     빠지면 새로 그린 2·3·4번 카드 전부가 '옛 카드 — 다시 그린 뒤 게시' 로 막히고, 다시 그려도 안 풀린다(두 곳에 손으로 적던 시절의 함정). */
export const preparedRow = (code, m, extra = {}) => ({
  code, org: m.org, name: m.name, due: m.due, school: m.school || null, tplNo: m.tplNo, cards: m.cards,
  dir: `insta/pub/${code}`, at: m.at, dates: m.dates || null, status: 'prepared', ...extra,
});

/** 올린 기록 한 줄 — 게시 명령(publish.mjs)과 워크플로 「올린 기록 저장」(ledger.mjs posted)이 같이 쓰는 한 곳.
 *  같은 공고·같은 게시물(media)이 이미 있으면 그대로 둔다(두 길이 같은 게시를 두 번 적지 않게) — 적었으면 true.
 *  🔴 media 가 다르면 다른 게시물이다(실제 이중 게시의 증거) — 버리지 않고 적는다. */
export function recordPosted(seen, rec, now = Date.now()) {
  if (!rec?.code) return false;
  if (seen.posted.some((p) => p.code === rec.code && String(p.media || '') === String(rec.media || ''))) return false;
  const at = kstDay(now);                       // 🔴 KST — UTC 면 새벽에 어제로 찍힌다
  seen.posted.push({ code: rec.code, org: rec.org ?? null, name: rec.name ?? null, tplNo: rec.tplNo ?? null,
    at, media: rec.media ?? null, permalink: rec.permalink || null, ...(rec.by ? { by: rec.by } : {}) });
  // 준비 장부의 줄도 '올림' 으로 — 관리자 화면이 두 장부를 같이 본다.
  const pr = seen.prepared.find((p) => p.code === rec.code);
  if (pr) { pr.status = 'posted'; pr.postedAt = at; }
  return true;
}

/** 올리기 전에 마감이 지난 카드를 '만료(expired)' 로 바꾼다 — 바꾼 공고 코드 목록을 돌려준다 (2026-10-04 로봇·도구 점검).
 *  🔴 마감이 지난 카드는 다시 그릴 수도(캡션 거절) 올릴 수도(publishRefusal) 없는데 지우는 단계가 없어
 *     insta/pub 이 3주에 100MB 로 불었다(Pages 사이트 상한 1GB). 폴더 지우기는 `ledger.mjs expire` 가 한다.
 *  올린 것(posted)은 절대 안 건드린다 — 관리자 「올림」 줄의 썸네일이 그 폴더를 읽는다.
 *  마감 없음·오늘 마감(23:59 KST 전)·미래 마감은 그대로.
 *  `expiredFrom` 에 만료 전 상태를 남긴다 — 사람이 「건너뛰기」 로 정한 카드(skipped)는 재단이 마감을 미뤄도 다시 그리지 않는다(candidates). */
export const EXPIRABLE = ['prepared', 'skipped', 'failed'];
export function expireRows(seen, now = Date.now()) {
  const posted = new Set((seen.posted || []).map((p) => p.code));
  const out = [];
  for (const p of seen.prepared || []) {
    if (!EXPIRABLE.includes(p.status) || posted.has(p.code) || !p.due) continue;
    const t = Date.parse(`${p.due}T23:59:59+09:00`);
    if (Number.isNaN(t) || t >= now) continue;
    p.expiredFrom = p.status;
    p.status = 'expired';
    p.expiredAt = kstDay(now);
    out.push(p.code);
  }
  return out;
}

/** 만료 + 그 카드 폴더 지우기 — `ledger.mjs expire` 의 몸통(리뷰 2026-10-05 · 관문이 임시 폴더로 실제로 돌린다).
 *  `pubDir` 는 공고 폴더들이 든 곳(file URL · 끝에 `/`). 지운 공고 코드 목록을 돌려준다 — 장부 저장은 부르는 쪽이 한다.
 *  🔴 지우는 것은 `pubDir/<만료한 코드>/` 하나씩뿐이다 — pubDir 통째는 절대 아니다.
 *  🔴 올린 것(posted)은 두 번 확인한다(expireRows 도 빼지만) — 관리자 「올림」 줄의 썸네일이 그 폴더를 읽는다.
 *  코드는 장부에서 왔다 — 폴더 이름으로 못 쓰는 글자면(../ 등) 장부만 고치고 지우지 않는다. */
export function expireAndClean(seen, pubDir, now = Date.now(), log = () => {}) {
  const posted = new Set((seen.posted || []).map((p) => p.code));
  const gone = expireRows(seen, now);
  for (const c of gone) {
    if (!/^[A-Za-z0-9_-]+$/.test(c) || posted.has(c)) continue;
    rmSync(new URL(`${c}/`, pubDir), { recursive: true, force: true });
    log(c);
  }
  return gone;
}

/** 🔴 로봇 기록장과 같은 모양(들여쓰기 1칸)으로 저장한다 — 다르게 저장하면 파일 전체가
 *  충돌한다(CLAUDE.md 「매 세션 이것만은」 4번). */
export const writeSeen = (s) => writeFileSync(SEEN, JSON.stringify(s, null, 1) + '\n');

const V = (f, k) => String(f[k] || '');
/** 칸이 비었거나 '제한없음' 이면 조건이 **없는** 것이다. */
const unrestricted = (f, k) => { const v = V(f, k); return !v || /제한없음|해당없음/.test(v); };

/** 신분 조건 — 이게 붙으면 볼 수 있는 사람이 확 줄어든다. */
const IDENTITY = /새터민|북한이탈|국가유공|독립유공|보훈|장애|다문화|한부모|소년소녀|보호시설|기초생활|차상위|선원|해기사|농어촌|귀농/;
/** ⚠️ **제한은 칸에만 있지 않다** — `특정자격` 문장에도, **공고 이름에도** 숨어 있다.
 *  실측으로 두 번 뚫렸다:
 *   · `미술관련 학과` 가 `특정자격` 문장에 있어 넓이 만점을 받았다(SCRIPT.md).
 *   · `독립유공자 후손 장학금` 이 '신분 조건 없음' 을, `보훈장학금(대학원장학)` 이
 *     '전공 제한 없음' 을 받았다 — 둘 다 제한이 **이름**에 있었다.
 *  🔴 그래서 자격 칸·이름을 **다 이어 붙여** 한 번에 본다. */
const MAJOR = /학과|전공|계열|대학원|의예|사범|예체능|석사|박사/;
/** 그 공고가 '누구를 제한하는가' 를 말할 수 있는 글자 전부. */
const scope = (x) => {
  const f = x.fields || {};
  return `${x.name} ${V(f, '특정자격')} ${V(f, '학과구분')} ${V(f, '대학구분')} ${V(f, '소득기준')}`;
};

export function score(x, today) {
  const f = x.fields || {};
  const why = [];
  let s = 0;
  // 🔴 교내는 그 학교 학생만 보므로 '넓이' 로는 늘 진다. 그런데 우리가 교내까지 하는
  //    유일한 서비스라 **그게 차별점**이다 — 넓이에서 잃는 만큼 여기서 돌려준다.
  if (x.school) { s += 4; why.push(`${x.school} 교내 +4`); }
  if (unrestricted(f, '지역거주구분')) { s += 3; why.push('지역 제한 없음 +3'); }
  const sc = scope(x);
  if (unrestricted(f, '학과구분') && !MAJOR.test(sc)) { s += 3; why.push('전공 제한 없음 +3'); }
  if (!IDENTITY.test(sc)) { s += 2; why.push('신분 조건 없음 +2'); }
  // 🔴 4장(자격제한)이 이 계정의 정체성이다. 재료가 없는 공고는 4장 없이 나간다.
  if (V(f, '자격제한')) { s += 2; why.push('조항 있음 +2'); }
  // 마감이 코앞이면 지금 올려야 쓸모가 있다. 너무 멀면 학생이 잊는다.
  const d = Math.round((new Date(`${x.due}T23:59:59+09:00`).getTime() - today) / 864e5);
  if (d >= 3 && d <= 21) { s += 2; why.push(`마감 D-${d} +2`); }
  else if (d < 3) { s -= 2; why.push(`마감 D-${d} 임박 -2`); }
  return { s, d, why };
}

/** 고를 수 있는 공고만 남긴다. 🔴 못 고르는 이유를 **버리지 말고 세어서** 돌려준다 —
 *  "왜 오늘 올릴 게 없지" 를 다음 사람이 다시 조사하지 않게. */
export function candidates(items, today, seen, { unpreparedOnly = false } = {}) {
  const done = new Set(seen.posted.map((p) => p.code));
  // 준비돼 있거나(개발자 메일함에 있다) 건너뛰기로 정한 것은 다시 그리지 않는다.
  // 🔴 못 그린 것(failed)은 **7일 쉬었다** 다시 — 바로 다시 뽑으면 같은 공고가 매 실행 1등으로 나머지를 굶긴다.
  const RETRY_MS = 7 * 864e5;
  const prepped = new Map((seen.prepared || [])
    .filter((p) => p.status !== 'failed' || (today - Date.parse(`${p.failedAt}T00:00:00+09:00`)) < RETRY_MS)
    .map((p) => [p.code, p]));
  // 🔴 마감이 지나 만료한 카드라도 재단이 마감을 미뤘으면(지금 공고의 마감이 장부 줄보다 늦다) 다시 그린다.
  //    단 사람이 「건너뛰기」 로 정한 카드(expiredFrom skipped)는 다시 그리지 않는다 — 담당자 셋에게 같은 공고 알림이 다시 가지 않게(리뷰 2026-10-05).
  //    사람이 되살리려면 관리자 화면 「이 판형으로 다시 그리기」(코드를 준 준비)로 — 그 길은 이 후보 고르기를 거치지 않는다.
  const stillPrepped = (x) => {
    const p = prepped.get(x.code);
    if (!p) return false;
    if (p.status === 'expired' && p.expiredFrom === 'skipped') return true;
    return !(p.status === 'expired' && x.due && p.due && String(x.due) > String(p.due));
  };
  const drop = { 이미올림: 0, 이미준비: 0, 마감지남: 0, 마감없음: 0, 금액미확인: 0 };
  const ok = [];
  for (const x of items) {
    if (done.has(x.code)) { drop.이미올림++; continue; }
    if (unpreparedOnly && stillPrepped(x)) { drop.이미준비++; continue; }
    if (!x.due) { drop.마감없음++; continue; }
    const t = new Date(`${x.due}T23:59:59+09:00`).getTime();
    if (Number.isNaN(t)) { drop.마감없음++; continue; }
    if (t < today) { drop.마감지남++; continue; }
    // 🔴 금액을 못 읽은 공고는 아예 안 고른다(SCRIPT.md) — 추정 금액을 걸 수 없다.
    if (/기관확인필요/.test(V(x.fields || {}, '지원금액'))) { drop.금액미확인++; continue; }
    ok.push({ x, ...score(x, today) });
  }
  // 점수 같으면 마감이 가까운 것 먼저. 그래도 같으면 이름순 — 🔴 순서가 매번 흔들리면
  // 같은 날 두 번 돌렸을 때 다른 공고가 나온다.
  ok.sort((a, b) => b.s - a.s || a.d - b.d || (a.x.org + a.x.name).localeCompare(b.x.org + b.x.name));
  return { ok, drop };
}

// ── 실행 ────────────────────────────────────────────────────
if (process.argv[1] && import.meta.url === new URL(process.argv[1], 'file:').href) {
  const { allNotices } = await import('./notices.mjs');
  const { items } = allNotices();
  const isNew = process.argv.includes('--new');
  const { ok, drop } = candidates(items, Date.now(), readSeen(), { unpreparedOnly: isNew });

  // 🔴 새 공고 전부 — 워크플로가 이 목록을 돌며 한 건씩 그린다. 0건이면 빈 배열(정상 종료).
  //    상한을 넘긴 나머지는 버리는 게 아니라 **다음 실행 몫**이다(장부에 안 적혔으니 다시 뜬다).
  if (isNew) {
    const a = process.argv.find((x) => x.startsWith('--max='));
    const max = a ? Number(a.slice(6)) : 6;
    if (!Number.isInteger(max) || max < 1) { console.error('--max 는 1 이상의 정수'); process.exit(1); }
    console.error(`■ 준비 안 한 공고 ${ok.length}건 (이번에 ${Math.min(max, ok.length)}건) — 뺀 이유: `
      + Object.entries(drop).map(([k, v]) => `${k} ${v}`).join(' · '));
    console.log(JSON.stringify(ok.slice(0, max).map((c) => ({ code: c.x.code, org: c.x.org, name: c.x.name,
      due: c.x.due, school: c.x.school || null, score: c.s, dday: c.d })), null, 1));
    process.exit(0);
  }

  if (process.argv.includes('--list')) {
    console.log(`■ 고를 수 있는 공고 ${ok.length} / ${items.length}건`);
    console.log('  뺀 이유 —', Object.entries(drop).map(([k, v]) => `${k} ${v}`).join(' · '));
    for (const c of ok.slice(0, 12))
      console.log(`  ${String(c.s).padStart(3)}점  D-${String(c.d).padStart(3)}  ${c.x.org} · ${c.x.name}\n         ${c.why.join(' · ')}`);
    process.exit(0);
  }
  if (!ok.length) {
    console.error('오늘 올릴 공고가 없습니다 —', Object.entries(drop).map(([k, v]) => `${k} ${v}`).join(' · '));
    process.exit(2);           // 🔴 0 으로 끝내면 워크플로가 '올렸다' 고 착각한다
  }
  const top = ok[0];
  // 워크플로가 렌더러에 그대로 넘길 수 있게 이름만 찍는 길도 둔다.
  if (process.argv.includes('--name')) { console.log(top.x.name); process.exit(0); }
  console.log(JSON.stringify({ code: top.x.code, org: top.x.org, name: top.x.name,
    due: top.x.due, score: top.s, dday: top.d, why: top.why }, null, 1));
}

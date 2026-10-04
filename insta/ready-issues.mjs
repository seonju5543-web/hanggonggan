/**
 * 인스타 준비 이슈(insta-ready)가 아직 쓸모 있는가 — 한 곳 (2026-10-04 로봇·도구 점검 · 묶음 alerts)
 *
 * 준비 이슈 본문은 「올리거나 건너뛰면 저절로 닫힙니다」라고 약속하는데, 워크플로는 이슈 안 카드가 **1건 이하**일 때만
 * 닫았고 마감이 지난 카드는 아무도 안 봤다 — 살아 있는 카드가 하나도 없는 이슈 8건이 열린 채 쌓였다(10-04 · #256 등).
 * 여기서 '살아 있는 카드'를 한 번만 정한다: 장부(insta/seen.json)의 prepared 에서 상태가 'prepared' 이고,
 * 올린 목록(posted)에 없고, 마감이 비었거나 오늘(KST) 이후인 것.
 * 🔴 장부에 없는 코드는 '모름'이라 **살아 있는 것으로** 센다 — 못 읽은 것을 '끝났다'로 읽어 닫지 않는다.
 * 🔴 게시는 사람만 누른다 — 이 파일은 닫을지만 정하고 아무것도 올리지 않는다.
 *
 * 실행: node insta/ready-issues.mjs closable <ready.json>   (gh issue list --label insta-ready --json number,body) → '번호<TAB>이유'
 *       node insta/ready-issues.mjs live-in-body < 본문        → 살아 있는 카드 수
 */
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { kstDay } from './graph.mjs';

/** 본문의 카드 표식 `<!-- insta-code: X -->` 목록 (중복 제거) */
export function codesIn(body) {
  return [...new Set([...String(body || '').matchAll(/<!-- insta-code: (\S+?) -->/g)].map((m) => m[1]))];
}

/** 살아 있는 카드만 (올릴 수 있는 것) */
export function liveCodes(codes, seen, today) {
  const posted = new Set(((seen && seen.posted) || []).map((p) => p.code));
  const prep = new Map(((seen && seen.prepared) || []).map((p) => [p.code, p]));
  return (codes || []).filter((c) => {
    if (posted.has(c)) return false;
    const p = prep.get(c);
    if (!p) return true;                                  // 장부에 없음 = 모름 → 살아 있는 것으로
    if (p.status !== 'prepared') return false;            // 건너뜀·실패·올림
    return !p.due || String(p.due) >= String(today);      // 마감이 지난 카드는 올릴 수 없다
  });
}

/** 닫아도 되는 준비 이슈 — 살아 있는 카드가 하나도 없는 것 */
export function closableReadyIssues(issues, seen, today) {
  const out = [];
  for (const i of issues || []) {
    const codes = codesIn(i && i.body);
    if (!codes.length || liveCodes(codes, seen, today).length) continue;
    const posted = new Set(((seen && seen.posted) || []).map((p) => p.code));
    const prep = new Map(((seen && seen.prepared) || []).map((p) => [p.code, p]));
    const n = { 올림: 0, 건너뜀: 0, 마감: 0, 그밖: 0 };
    for (const c of codes) {
      const p = prep.get(c);
      if (posted.has(c) || (p && p.status === 'posted')) n.올림 += 1;
      else if (p && p.status === 'skipped') n.건너뜀 += 1;
      else if (p && (p.status === 'prepared' || p.status === 'expired')) n.마감 += 1;   // expired = 마감이 지나 정리됨(ledger.mjs expire)
      else n.그밖 += 1;
    }
    out.push({ number: i.number, reason: Object.entries(n).filter(([, v]) => v).map(([k, v]) => `${k} ${v}`).join(' · ') });
  }
  return out;
}

const readSeen = () => JSON.parse(readFileSync(new URL('./seen.json', import.meta.url), 'utf8'));

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [cmd, file] = process.argv.slice(2);
  if (cmd === 'closable') {
    if (!file) { console.error('쓰는 법: node insta/ready-issues.mjs closable <ready.json>'); process.exit(1); }
    for (const c of closableReadyIssues(JSON.parse(readFileSync(file, 'utf8')), readSeen(), kstDay())) console.log(`${c.number}\t${c.reason}`);
  } else if (cmd === 'live-in-body') {
    console.log(liveCodes(codesIn(readFileSync(0, 'utf8')), readSeen(), kstDay()).length);
  } else {
    console.error('closable <ready.json> | live-in-body');
    process.exit(1);
  }
}

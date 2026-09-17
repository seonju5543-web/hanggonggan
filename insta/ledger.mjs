/**
 * 준비 장부(`insta/seen.json` 의 prepared) 를 워크플로가 고치는 통로.
 * 규칙은 pick.mjs 의 markPrepared 한 곳 — 여기는 명령줄 껍데기다(워크플로에 node -e 를 길게 두면
 * 따옴표 하나에 조용히 깨진다).
 *
 * 실행: node insta/ledger.mjs prepared <코드…>            그린 것을 '준비됨' 으로 (insta/pub/<코드>/meta.json 을 읽는다)
 *       node insta/ledger.mjs skip <코드> [--by=사람]      '건너뛰기' 로 (폴더는 남긴다 · 다시 준비하면 되살아난다)
 *       node insta/ledger.mjs failed <코드…>              못 그린 것을 적는다 — 🔴 안 적으면 같은 공고가 매 실행 1등으로
 *                                                          다시 뽑혀 나머지를 굶기고 실패 이슈만 쌓인다(코드 리뷰). 7일 뒤 다시 뜬다
 *       node insta/ledger.mjs show                          장부 요약
 */
import { readFileSync, existsSync } from 'node:fs';
import { readSeen, writeSeen, markPrepared } from './pick.mjs';
import { kstDay } from './graph.mjs';

const ROOT = new URL('../', import.meta.url);
const [cmd, ...rest] = process.argv.slice(2);
const codes = rest.filter((a) => !a.startsWith('--'));
const by = (rest.find((a) => a.startsWith('--by=')) || '').slice(5) || null;
const seen = readSeen();

if (cmd === 'prepared') {
  if (!codes.length) { console.error('코드를 주세요.'); process.exit(1); }
  for (const c of codes) {
    const f = new URL(`insta/pub/${c}/meta.json`, ROOT);
    if (!existsSync(f)) { console.error(`🚨 insta/pub/${c}/meta.json 이 없습니다 — 그리지 않은 것을 장부에 적을 수 없습니다.`); process.exit(1); }
    const m = JSON.parse(readFileSync(f, 'utf8'));
    markPrepared(seen, { code: c, org: m.org, name: m.name, due: m.due, school: m.school || null,
      tplNo: m.tplNo, cards: m.cards, dir: `insta/pub/${c}`, at: m.at, status: 'prepared' });
  }
  writeSeen(seen);
  console.log(`장부: 준비 ${seen.prepared.filter((p) => p.status === 'prepared').length}건 · 건너뜀 ${seen.prepared.filter((p) => p.status === 'skipped').length}건 · 올림 ${seen.posted.length}건`);
} else if (cmd === 'skip') {
  const [c] = codes;
  if (!c) { console.error('코드를 주세요.'); process.exit(1); }
  const prev = seen.prepared.find((p) => p.code === c) || { code: c };
  markPrepared(seen, { ...prev, status: 'skipped', skippedAt: kstDay(), skippedBy: by });
  writeSeen(seen);
  console.log(`건너뛰기: ${c}${by ? ` (${by})` : ''}`);
} else if (cmd === 'failed') {
  if (!codes.length) { console.error('코드를 주세요.'); process.exit(1); }
  for (const c of codes) {
    const prev = seen.prepared.find((p) => p.code === c) || { code: c };
    // 이미 준비돼 있던 것을 다시 그리다 실패했으면 그 준비는 그대로 산다(폴더는 안 건드렸다) — 실패만 적어 둔다.
    markPrepared(seen, { ...prev, status: prev.status === 'prepared' ? 'prepared' : 'failed', failedAt: kstDay(), fails: (prev.fails || 0) + 1 });
  }
  writeSeen(seen);
  console.log(`못 그림: ${codes.join(' ')}`);
} else if (cmd === 'show') {
  for (const p of seen.prepared) console.log(`  ${p.status.padEnd(8)} ${p.code}  ${p.org || ''} · ${p.name || ''}  판형 ${p.tplNo ?? '?'}번  ${p.at || ''}`);
  console.log(`  올림 ${seen.posted.length}건`);
} else {
  console.error('prepared | skip | failed | show');
  process.exit(1);
}

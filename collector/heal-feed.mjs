/* ============================================================
   실시간 공고 피드 메우기 — 사람이 돌리는 도구 (2026-10-04 점검 collect-01 · app2-F1)
   ------------------------------------------------------------
   수집 로봇 둘(collect.mjs · browser-collect.mjs)은 매 실행 후보 장부(collector/candidates.json)에서
   FEED_HEAL_SINCE 이후 수집분을 메운다(publish-notices.mjs healFromLedger). 이 도구는 **같은 함수를 같은 차례로**
   한 번 돌리되, 메울 원천을 사람이 고른다 — 사고 직전 로봇이 발행한 판(git 커밋 안의 파일)처럼.

   왜 따로 있나 — 2026-09-30 병합기(옛 merge-json-union slice(0,200))가 notices.json 을 200건으로 잘라 15개교 215건이 학생 화면에서
   빠졌다. 그중 9-29 전에 수집한 경희·외대 글(61건)은 로봇의 메우기 범위(FEED_HEAL_SINCE) 밖이라 로봇이 스스로 못 메운다
   (그 범위를 넓히면 8월에 파킹으로 일부러 뺀 글 947건까지 돌아온다). 사고 직전 발행분만 원천으로 주면 그 61건만 정확히 돌아온다.

   쓰는 법 (저장소 맨 위에서 · 클라우드 수집과 겹치지 않게 겉옷으로 — robot-run.sh 가 맨 위로 옮겨 돌린다):
     bash tools/robot-run.sh node collector/heal-feed.mjs [--since=YYYY-MM-DD] [--dry] [원천 …]
     원천: JSON 파일({items:[…]} 또는 배열) · 폴더(*.json, index.json 빼고) · git:<커밋>:<경로>(파일이나 폴더 — 커밋 안의 판을 읽는다)
     원천을 안 주면 collector/candidates.json (로봇과 같은 길). --since 기본은 FEED_HEAL_SINCE · '0000-00-00' 이면 60일 규칙만.
     --dry 는 숫자만 보이고 아무것도 쓰지 않는다.
   9-30 사고 복구: bash tools/robot-run.sh node collector/heal-feed.mjs --since=0000-00-00 git:ab897c3b:data/notices/ git:60ce385a:data/notices.json

   하는 일(수집기 끝부분과 같은 차례): data/notices.json 읽기 → healFromLedger(메우기만 · 지금 글은 안 바꾼다 · foundAt 그대로 ·
   같은 글이면 지금 학교별 파일의 판(그 주소)이 원천보다 먼저 — 원천은 링크 로봇이 고친 주소를 모른다 · 수집기와 같은 opts.current)
   → dropUnserved → publishBySchool(자르기 전 목록) → capNotices → updatedAt(KST) → JSON.stringify(…, null, 1).
   ⚠️ registered.json 은 건드리지 않는다. 끝나면 node verify/audit-data.js 로 확인하고 data/notices.json · data/notices/ 를 커밋한다.
   ⚠️ 불러오는 순간 실행된다 — 관문·다른 로봇에서 import 하지 말 것.
   ============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { capNotices } from './url-key.mjs';
import { loadCandidates } from './candidates.mjs';
import { healFromLedger, dropUnserved, publishBySchool, readSchoolFiles, FEED_HEAL_SINCE } from './publish-notices.mjs';

/* 데이터는 **지금 자리(저장소 맨 위)** 의 data/·collector/ 를 읽고 쓴다 — 관문이 임시 저장소에서 이 도구를 그대로 돌려 보게(관리자 저장소와 같은 방식) */
const ROOT = process.cwd();
if (!fs.existsSync(path.join(ROOT, 'data/notices.json'))) { console.error(`⛔ 저장소 맨 위에서 돌리세요 — ${ROOT} 에 data/notices.json 이 없습니다`); process.exit(2); }
const args = process.argv.slice(2);
const flag = (name) => args.find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
const DRY = args.includes('--dry');
const since = flag('since') ?? FEED_HEAL_SINCE;
if (!/^\d{4}-\d{2}-\d{2}$/.test(since)) { console.error(`⛔ --since 는 YYYY-MM-DD 꼴이어야 합니다: ${since}`); process.exit(2); }
const sources = args.filter((a) => !a.startsWith('--'));

const itemsOf = (doc) => (Array.isArray(doc) ? doc : (doc && Array.isArray(doc.items) ? doc.items : []));
const git = (...a) => {
  const r = spawnSync('git', a, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`git ${a.join(' ')} — ${(r.stderr || '').trim().slice(0, 200)}`);
  return r.stdout;
};
/* 원천 하나 → 글 목록. 못 읽으면 멈춘다(반쯤 읽고 메우면 무엇이 빠졌는지 모른다). */
function readSource(src) {
  const m = src.match(/^git:([^:]+):(.+)$/);
  if (m) {
    const [, rev, p] = m;
    if (p.endsWith('/')) {
      const names = git('ls-tree', '--name-only', rev, p).split('\n').filter((f) => /\.json$/.test(f) && path.basename(f) !== 'index.json');
      return names.flatMap((f) => itemsOf(JSON.parse(git('show', `${rev}:${f}`))));
    }
    return itemsOf(JSON.parse(git('show', `${rev}:${p}`)));
  }
  const abs = path.resolve(ROOT, src);
  if (fs.statSync(abs).isDirectory()) {
    return fs.readdirSync(abs).filter((f) => /\.json$/.test(f) && f !== 'index.json')
      .flatMap((f) => itemsOf(JSON.parse(fs.readFileSync(path.join(abs, f), 'utf8'))));
  }
  return itemsOf(JSON.parse(fs.readFileSync(abs, 'utf8')));
}

let pool;
try {
  pool = sources.length ? sources.flatMap(readSource) : loadCandidates(path.join(ROOT, 'collector/candidates.json')).items;
} catch (e) {
  console.error(`⛔ 원천을 읽지 못했습니다 — 아무것도 쓰지 않았습니다: ${e.message}`);
  process.exit(1);
}

const noticesPath = path.join(ROOT, 'data/notices.json');
const notices = JSON.parse(fs.readFileSync(noticesPath, 'utf8'));
const before = notices.items || [];
const counts = {};
const healed = healFromLedger(before, pool, { since, current: readSchoolFiles({ dir: pathToFileURL(path.join(ROOT, 'data', 'notices') + path.sep) }), counts });
const had = new Set(before);
const added = healed.filter((n) => !had.has(n));
const by = {};
for (const n of added) by[n.school] = (by[n.school] || 0) + 1;
console.log(`원천 ${sources.length ? sources.join(' · ') : 'collector/candidates.json'} — 글 ${pool.length}건 · since ${since}`);
console.log(`메울 글 ${added.length}건(학교별 파일에도 없던 글 ${counts.restored} · notices.json 에만 없던 글 ${counts.kept}): ${Object.entries(by).sort((a, b) => b[1] - a[1]).map(([s, k]) => `${s} ${k}`).join(' · ') || '없음'}`);
if (DRY) { console.log('--dry — 아무것도 쓰지 않았습니다.'); process.exit(0); }
if (!added.length) { console.log('메울 글이 없어 아무것도 쓰지 않았습니다.'); process.exit(0); }

const beforeCap = dropUnserved(healed);
const pub = publishBySchool(beforeCap, { dir: pathToFileURL(path.join(ROOT, 'data', 'notices') + path.sep) });
notices.items = capNotices(beforeCap);
notices.updatedAt = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
fs.writeFileSync(noticesPath, JSON.stringify(notices, null, 1));
console.log(`학교별 파일 ${pub.schools}개교 발행(빈 파일로 바꾼 옛 파일 ${pub.emptied}) · data/notices.json ${before.length} → ${notices.items.length}건`);
console.log('다음: node verify/audit-data.js (exit 0) 확인 뒤 data/notices.json · data/notices/ 를 커밋하세요.');

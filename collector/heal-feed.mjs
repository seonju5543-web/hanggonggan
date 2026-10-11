/* ============================================================
   실시간 공고 피드 메우기 — 사람이 돌리는 도구 (2026-10-04 점검 collect-01 · app2-F1)
   ------------------------------------------------------------
   수집 로봇 둘(collect.mjs · browser-collect.mjs)은 매 실행 후보 장부(collector/candidates.json)에서
   FEED_HEAL_SINCE ~ FEED_HEAL_UNTIL(9-30 사고 창) 수집분을 메운다(publish-notices.mjs healFromLedger). 이 도구는 **같은 함수를 같은 차례로**
   한 번 돌리되, 메울 원천을 사람이 고른다 — 사고 직전 로봇이 발행한 판(git 커밋 안의 파일)처럼.

   왜 따로 있나 — 2026-09-30 병합기(옛 merge-json-union slice(0,200))가 notices.json 을 200건으로 잘라 15개교 215건이 학생 화면에서
   빠졌다. 그중 9-29 전에 수집한 경희·외대 글(61건)은 로봇의 메우기 범위(FEED_HEAL_SINCE) 밖이라 로봇이 스스로 못 메운다
   (그 범위를 넓히면 8월에 파킹으로 일부러 뺀 글 947건까지 돌아온다). 사고 직전 발행분만 원천으로 주면 그 61건만 정확히 돌아온다.

   쓰는 법 (저장소 맨 위에서 · 클라우드 수집과 겹치지 않게 겉옷으로 — robot-run.sh 가 맨 위로 옮겨 돌린다):
     bash tools/robot-run.sh node collector/heal-feed.mjs [--since=YYYY-MM-DD] [--until=YYYY-MM-DD] [--skip=<주소> …] [--dry] [원천 …]
     원천: JSON 파일({items:[…]} 또는 배열) · 폴더(*.json, index.json 빼고) · git:<커밋>:<경로>(파일이나 폴더 — 커밋 안의 판을 읽는다)
     원천을 안 주면 collector/candidates.json (로봇과 같은 길). --since 기본은 FEED_HEAL_SINCE · '0000-00-00' 이면 60일 규칙만.
     --until 기본은 FEED_HEAL_UNTIL(원천 글의 수집일이 이 날보다 늦으면 안 메운다 — 그 뒤 수집분은 링크 사냥꾼이 합친 옛 판일 수 있다 · CC-1).
     다른 사고 창을 메울 때만 --until=YYYY-MM-DD 로 바꾼다('9999-12-31' 이면 상한 없음). --since 가 --until 보다 늦으면 멈춘다(빈 창 — 리뷰 R4).
     --skip=<주소> 는 그 글을 원천에서 뺀다(여러 번 줄 수 있다 · 원천에 없는 주소면 오타일 수 있어 멈춘다).
     --dry 는 메울 글을 한 줄씩(학교 · 수집일 · 제목 · 주소 · 원천) 보이고 아무것도 쓰지 않는다. 목록 표식(#n-) 주소는 [표식] 으로 따로 센다.
     사냥꾼이 이미 푼 표식(collector/link-hunt.json 의 찾은 줄)은 수집기와 같이 찾은 주소로 바꿔 끼운 뒤 메운다(readHuntMoves · 리뷰 R2).
   🔴 돌리기 전에 --dry 목록을 사람이 눈으로 본다 — 학교가 **제목만 고친** 같은 글 짝은 주소·제목·글 번호가 다 달라 같은 글로 못 보고,
      링크 사냥꾼도 제목으로 행을 찾으므로 그 표식 판을 진짜 주소로 못 푼다(2026-10-11 확인: 경희 '공통 제36기 미레에셋 해외교환 장학생 선발'(9-01 · 목록 표식)
      ↔ 피드의 '…미래에셋…'(boardId=322953) — detail-url.mjs sameTitle·rowMatchesTitle 거짓 · rowByCore 없음). 메우면 '목록에서 못 찾음'만 쌓다가
      사람에게 알릴 건이 되고, 그동안 학생 화면에 같은 장학금 카드가 둘 뜬다. 그런 짝은 --skip=<표식 주소> 로 빼고 돌린다.
   9-30 사고 복구 (4-4 백필 — 경희 '미레에셋' 표식 판을 빼고 · 2026-10-11 --dry 로 그 주소가 원천에 있음을 확인):
     bash tools/robot-run.sh node collector/heal-feed.mjs --dry --since=0000-00-00 \
       --skip='https://news.khu.ac.kr/kor/user/bbs/BMSR00040/list.do?menuNo=200318#n-%EA%B3%B5%ED%86%B5%20%EC%A0%9C36%EA%B8%B0%20%EB%AF%B8%EB%A0%88%EC%97%90%EC%85%8B%20%ED%95%B4%EC%99%B8%EA%B5%90%ED%99%98%20%EC%9E%A5%ED%95%99%EC%83%9D%20%EC%84%A0%EB%B0%9C' \
       git:ab897c3b:data/notices/ git:60ce385a:data/notices.json
     → 목록을 보고(다른 제목 고침 짝이 있으면 --skip 을 더한다) --dry 를 떼고 같은 명령을 한 번 더. 두 원천은 9-30 까지 수집분뿐이라 --until 은 기본값 그대로다.

   하는 일(수집기 끝부분의 '앱 발행' 단락과 같은 함수·같은 차례 — 새 글 얹기만 없다): data/notices.json 읽기 → 60일 · 첨부 링크 거르기
   → dedupeNotices → healFromLedger(메우기만 · 지금 글은 안 바꾼다 · foundAt 그대로 · 학교별 파일 상한 안에 드는 것만 ·
   같은 글이면 지금 학교별 파일의 판(그 주소)이 원천보다 먼저 — 원천은 링크 로봇이 고친 주소를 모른다 · 수집기와 같은 opts.current)
   → dropUnserved → stripSiteChrome(게시판 공통 링크 걷기 · 정식 등록분과 함께 센다 — 읽기만 하고 registered.json 은 안 쓴다)
   → publishBySchool(자르기 전 목록) → capNotices → updatedAt(KST) → JSON.stringify(…, null, 1).
   🔴 수집기 끝부분에 단계를 더하거나 빼면 여기도 같이 — 관문 「로봇·도구 점검 관문」 feed ⑤ 가 두 수집기의 공통 차례와 이 파일의 차례를 대조한다.
   ⚠️ registered.json 은 건드리지 않는다. 끝나면 node verify/audit-data.js 로 확인하고 data/notices.json · data/notices/ 를 커밋한다.
   ⚠️ 불러오는 순간 실행된다 — 관문·다른 로봇에서 import 하지 말 것.
   ============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { capNotices, dedupeNotices } from './url-key.mjs';
import { loadCandidates, KEEP_DAYS } from './candidates.mjs';
import { isAttachmentEntry, stripSiteChrome } from './attachment-link.mjs';
import { healFromLedger, dropUnserved, publishBySchool, readSchoolFiles, readHuntMoves, FEED_HEAL_SINCE, FEED_HEAL_UNTIL } from './publish-notices.mjs';
/* 주소의 HTML 기호 되돌리기 — 메우기(healFromLedger)가 쓰는 것과 같은 함수(앱 source-link.js). --skip 대조·원천 표시에만 쓴다 */
const { decodeUrlEntities } = createRequire(import.meta.url)('../source-link.js');

/* 데이터는 **지금 자리(저장소 맨 위)** 의 data/·collector/ 를 읽고 쓴다 — 관문이 임시 저장소에서 이 도구를 그대로 돌려 보게(관리자 저장소와 같은 방식) */
const ROOT = process.cwd();
if (!fs.existsSync(path.join(ROOT, 'data/notices.json'))) { console.error(`⛔ 저장소 맨 위에서 돌리세요 — ${ROOT} 에 data/notices.json 이 없습니다`); process.exit(2); }
const args = process.argv.slice(2);
const flag = (name) => args.find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
const DRY = args.includes('--dry');
const since = flag('since') ?? FEED_HEAL_SINCE;
const until = flag('until') ?? FEED_HEAL_UNTIL;
for (const [name, v] of [['since', since], ['until', until]]) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) { console.error(`⛔ --${name} 는 YYYY-MM-DD 꼴이어야 합니다: ${v}`); process.exit(2); }
}
/* 빈 창은 소리 없이 0건이 된다 — --since 만 주면 --until 기본값(FEED_HEAL_UNTIL)에 걸린다(리뷰 R4 실측: --since=2026-10-05 → 원천 글 0건이었다) */
if (since > until) {
  console.error(`⛔ --since(${since}) 가 --until(${until}) 보다 늦어 메울 창이 비었습니다 — 아무것도 쓰지 않았습니다.${flag('until') ? '' : ` --until 기본값은 ${FEED_HEAL_UNTIL} 입니다 — 그 뒤 수집분을 메우려면 --until 을 함께 주세요.`}`);
  process.exit(2);
}
const skips = args.filter((a) => a.startsWith('--skip=')).map((a) => a.slice('--skip='.length)).filter(Boolean);
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

/* 원천마다 읽어 이름표를 단다 — 메울 글 목록에 '어느 원천에서 왔나'를 적으려고(원천 글을 고치지 않고 주소로 잇는다) */
const urlForms = (u) => [String(u || ''), decodeUrlEntities(String(u || ''))];
const srcOf = new Map();   // 주소 → 원천 이름(먼저 읽은 원천)
let pool;
try {
  const lists = sources.length ? sources.map((s) => [s, readSource(s)]) : [['collector/candidates.json', loadCandidates(path.join(ROOT, 'collector/candidates.json')).items]];
  for (const [label, list] of lists) for (const n of list) for (const u of urlForms(n && n.url)) if (u && !srcOf.has(u)) srcOf.set(u, label);
  pool = lists.flatMap(([, list]) => list);
} catch (e) {
  console.error(`⛔ 원천을 읽지 못했습니다 — 아무것도 쓰지 않았습니다: ${e.message}`);
  process.exit(1);
}
/* --skip — 사람이 목록을 보고 뺀 글. 원천에 없는 주소면 오타일 수 있어 멈춘다(빼려던 글이 그대로 메워지지 않게) */
if (skips.length) {
  const skipSet = new Set(skips.flatMap(urlForms));
  const has = new Set(pool.flatMap((n) => urlForms(n && n.url)));
  const missing = skips.filter((s) => !urlForms(s).some((u) => has.has(u)));
  if (missing.length) { console.error(`⛔ --skip 주소가 원천에 없습니다(오타일 수 있어 멈춥니다 — 아무것도 쓰지 않았습니다): ${missing.join(' · ')}`); process.exit(2); }
  const before = pool.length;
  pool = pool.filter((n) => !urlForms(n && n.url).some((u) => skipSet.has(u)));
  console.log(`--skip — 원천에서 뺀 글 ${before - pool.length}건`);
}

const noticesPath = path.join(ROOT, 'data/notices.json');
const notices = JSON.parse(fs.readFileSync(noticesPath, 'utf8'));
const before = notices.items || [];
/* 수집기와 같은 거르기 — 수집일 60일 · 첨부 링크(소급) · 같은 글 하나로. 거른 뒤의 목록이 '지금 글'이다(메우기는 이것을 바꾸지 않는다). */
const cutoff = new Date(Date.now() - KEEP_DAYS * 86400000).toISOString().slice(0, 10);
const kept = before.filter((n) => (n.foundAt || '9999') >= cutoff).filter((n) => !isAttachmentEntry(n));
const cur = dedupeNotices(kept);
const counts = {};
let current = [];   // 학생이 지금 보는 판 — 아래 메울 글 목록의 원천 표시에도 쓴다(수집기와 같은 차례로 부르려고 안에서 받는다 · 관문 feed ⑤ 차례 대조)
const healed = healFromLedger(cur, pool, { since, until, current: (current = readSchoolFiles({ dir: pathToFileURL(path.join(ROOT, 'data', 'notices') + path.sep) })),
  moved: readHuntMoves({ path: path.join(ROOT, 'collector/link-hunt.json') }), counts });
const had = new Set(cur);
const added = healed.filter((n) => !had.has(n));
const by = {};
for (const n of added) by[n.school] = (by[n.school] || 0) + 1;
console.log(`원천 ${sources.length ? sources.join(' · ') : 'collector/candidates.json'} — 글 ${pool.length}건 · since ${since} · until ${until}`);
console.log(`메울 글 ${added.length}건(학교별 파일에도 없던 글 ${counts.restored} · notices.json 에만 없던 글 ${counts.kept}): ${Object.entries(by).sort((a, b) => b[1] - a[1]).map(([s, k]) => `${s} ${k}`).join(' · ') || '없음'}`);
/* 메울 글 한 줄씩 — 사람이 같은 글 짝(학교가 제목만 고친 것 등)을 눈으로 고르게(리뷰 R1). 원천: 학생이 지금 보는 학교별 파일 판이면 그 이름, 아니면 주소로 원천을 잇는다
   (사냥꾼이 푼 표식은 찾은 주소로 바뀌어 원천 주소와 안 맞을 수 있다 — 그때는 '사냥꾼이 푼 주소'). 표식 주소는 [표식] — 학교가 제목을 고치면 사냥꾼도 못 푸는 꼴이다 */
const shownUrls = new Set(current.flatMap((n) => urlForms(n && n.url)));
const originOf = (n) => (shownUrls.has(n.url) ? '학교별 파일(학생이 지금 보는 판)' : (urlForms(n.url).map((u) => srcOf.get(u)).find(Boolean) || '사냥꾼이 푼 주소'));
const bySrc = {};
let markers = 0;
const rows = added.slice().sort((a, b) => String(a.school).localeCompare(String(b.school)) || String(b.foundAt || '').localeCompare(String(a.foundAt || '')));
for (const n of added) { const o = originOf(n); bySrc[o] = (bySrc[o] || 0) + 1; if (String(n.url).includes('#n-')) markers += 1; }
if (added.length) {
  console.log(`원천별: ${Object.entries(bySrc).map(([s, k]) => `${s} ${k}`).join(' · ')} · 그중 목록 표식(#n-) ${markers}건`);
  for (const n of rows) console.log(`- ${String(n.url).includes('#n-') ? '[표식] ' : ''}${n.school}${n.campus ? ` ${n.campus}` : ''} · ${n.foundAt || '?'} · ${String(n.title || '').slice(0, 70)} · ${n.url} (${originOf(n)})`);
}
if (DRY) { console.log('--dry — 아무것도 쓰지 않았습니다.'); process.exit(0); }
if (!added.length) { console.log('메울 글이 없어 아무것도 쓰지 않았습니다.'); process.exit(0); }

const beforeCap = dropUnserved(healed);
/* 게시판 공통 링크를 첨부에서 걷는다 — 두 수집기와 같은 자리·같은 셈(정식 등록분과 함께 · attachment-link.mjs · 2026-10-05 기본 브랜치).
   메운 글은 후보 장부의 옛 첨부를 그대로 들고 오므로 여기서 안 걷으면 다음 수집 실행까지 메뉴·규정 링크가 첨부로 보인다 */
stripSiteChrome([beforeCap, (() => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, 'data/registered.json'), 'utf8')).items || []; } catch { return []; } })()]);
const pub = publishBySchool(beforeCap, { dir: pathToFileURL(path.join(ROOT, 'data', 'notices') + path.sep) });
notices.items = capNotices(beforeCap);
notices.updatedAt = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
fs.writeFileSync(noticesPath, JSON.stringify(notices, null, 1));
console.log(`학교별 파일 ${pub.schools}개교 발행(빈 파일로 바꾼 옛 파일 ${pub.emptied}) · data/notices.json ${before.length} → ${notices.items.length}건`);
console.log('다음: node verify/audit-data.js (exit 0) 확인 뒤 data/notices.json · data/notices/ 를 커밋하세요.');

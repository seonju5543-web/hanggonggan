/* ============================================================
   잘려 나간 공고 되살리기 (2026-08-17 · 1회성 복구 도구)
   ------------------------------------------------------------
   `data/notices.json`의 크기 상한(capNotices)에 밀려 사라진 공고를,
   **git 히스토리에서** 되찾아 후보 장부(collector/candidates.json)에 채운다.

   되찾을 수 있는 이유: 수집 로봇이 매 실행 notices.json을 커밋해 왔다.
   그래서 잘리기 **전** 상태가 커밋마다 남아 있다. seen.json에는 주소와 날짜밖에
   없어서 제목·학교·마감·첨부를 복원할 수 없지만, 옛 notices.json에는 전부 있다.

   왜 1회성인가: 오늘부터는 수집 로봇이 매 실행 후보 장부에 직접 쌓으므로
   (candidates.mjs), 다시 이걸 돌릴 일은 없다. 다만 **다시 돌려도 안전하다** —
   같은 공고는 정규화 주소로 합쳐지고, 정보가 많은 판이 남는다.

   실행: node collector/recover-candidates.mjs [--dry]
   ============================================================ */
import { execFileSync } from 'node:child_process';
import { loadCandidates, mergeCandidates, saveCandidates, KEEP_DAYS } from './candidates.mjs';
import { urlKey } from './url-key.mjs';

const DRY = process.argv.includes('--dry');
const FILE = 'data/notices.json';

const git = (args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });

/* 60일치만 본다 — 그보다 오래된 공고는 어차피 장부에서 떨어진다.
   여유를 조금 두는 이유: 커밋 시각과 공고의 foundAt이 하루쯤 어긋날 수 있다. */
const commits = git(['log', '--format=%H', `--since=${KEEP_DAYS + 10} days ago`, '--', FILE])
  .split('\n').filter(Boolean);

console.log(`히스토리에서 ${FILE} 커밋 ${commits.length}개를 훑습니다…`);

const found = [];
let read = 0;
for (const sha of commits) {
  let text;
  try { text = git(['show', `${sha}:${FILE}`]); } catch { continue; }   // 그 시점에 파일이 없던 커밋
  let doc;
  try { doc = JSON.parse(text); } catch { continue; }                    // 깨진 판은 건너뛴다
  read += 1;
  for (const n of doc.items || []) if (n && n.url && n.title) found.push(n);
}

const prev = loadCandidates();
const merged = mergeCandidates(prev.items, found);

/* 지금 앱 파일에 살아 있는 공고와 비교해, 실제로 되살아난 것이 몇 건인지 보고한다.
   '몇 건 처리'가 아니라 '몇 건이 다시 검수 대상이 됐나'가 이 작업의 값어치다. */
import fs from 'node:fs';
const live = JSON.parse(fs.readFileSync(new URL('../data/notices.json', new URL('.', import.meta.url)), 'utf8')).items || [];
const liveKeys = new Set(live.map((n) => urlKey(n.url)));
const revived = merged.filter((n) => !liveKeys.has(urlKey(n.url)));

const bySchool = {};
for (const n of revived) {
  const k = `${n.school || '?'}${n.campus ? ' ' + n.campus : ''}`;
  bySchool[k] = (bySchool[k] || 0) + 1;
}

console.log(`\n읽어낸 커밋      : ${read}개`);
console.log(`히스토리 속 공고  : ${found.length}건 (중복 포함)`);
console.log(`후보 장부 총계    : ${merged.length}건`);
console.log(`앱 파일에 살아있음: ${live.length}건`);
console.log(`→ 되살아난 공고   : ${revived.length}건 (잘려서 아무도 못 보던 것)\n`);
Object.entries(bySchool).sort((a, b) => b[1] - a[1]).slice(0, 15)
  .forEach(([k, v]) => console.log(`  ${String(v).padStart(4)}  ${k}`));

if (DRY) { console.log('\n--dry — 저장하지 않았습니다.'); process.exit(0); }
saveCandidates(merged);
console.log(`\n저장 완료: collector/candidates.json (${merged.length}건)`);

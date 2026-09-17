/**
 * 준비된 게시물을 채팅에서 고친다 (2026-09-12 개발자 지시 ③ — "메일로 받은 초안을 개발자 셋
 * 모두 Claude Code 채팅에서 디자인·폰트 등 모든 부분을 고칠 수 있어야 한다").
 *
 * 하는 일 — 한 공고의 `insta/pub/<코드>/` 를 **같은 자리에 다시 그리고**, 개발자에게 보여 줄
 * 미리보기 한 장(`insta/out/_preview-<코드>.png`)을 만든다. 그게 전부다.
 * 🔴 **메일은 여기서 보내지 않는다.** 보내는 것은 개발자가 "보내라" 고 한 뒤 `insta/run-notify.txt`
 *    를 고쳐 push 하는 워크플로 몫이다(스킬 `.claude/skills/insta-revise/SKILL.md` 가 순서를 정한다:
 *    고친다 → 그림을 보여 준다 → **보낼지 묻는다** → 답을 듣고 보낸다).
 * 🔴 판형·글꼴·색·씨앗은 **안 준 것은 지난번 값 그대로**다(meta.json) — "글꼴만 바꿔" 라고 했는데
 *    판형까지 씨앗으로 다시 뽑히면 개발자가 본 것과 다른 카드가 된다.
 * 🔴 판형 코드 자체를 고치는 수정(문구·배치)은 이 도구가 아니라 `insta/render.mjs` /
 *    `insta/templates/<번호>-<id>.mjs` 를 고친 뒤 이 도구로 **다시 그려 보여 주는** 것이다.
 *
 * 실행: node insta/revise.mjs <공고 코드> [--tpl=번호] [--skin=…] [--font="…"] [--seed=N] [--no-preview]
 */
import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readSeen, writeSeen, markPrepared } from './pick.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const val = (k) => { const a = args.find((x) => x.startsWith(`--${k}=`)); return a ? a.split('=').slice(1).join('=') : undefined; };
const code = args.find((a) => !a.startsWith('--'));
if (!code || !/^[A-Za-z0-9_-]+$/.test(code)) { console.error('공고 코드를 주세요 — 예: node insta/revise.mjs 2704055001 --tpl=3'); process.exit(1); }

const dir = join(ROOT, 'insta', 'pub', code);
const metaFile = join(dir, 'meta.json');
// 준비된 적 없는 공고도 고칠 수 있다(처음 그리는 것과 같다) — 다만 지난 값이 없으니 씨앗이 정한다.
const prev = existsSync(metaFile) ? JSON.parse(readFileSync(metaFile, 'utf8')) : null;
if (!prev) console.error(`  ⚠️ ${code} 는 아직 준비된 적이 없습니다 — 처음부터 그립니다.`);

const tpl = val('tpl') ?? (prev ? String(prev.tplNo) : undefined);
const skin = val('skin') ?? (prev?.skin || undefined);
const font = val('font') ?? (prev?.font || undefined);
const seed = val('seed') ?? (prev ? String(prev.seed) : undefined);
const cmd = [join(ROOT, 'insta/render.mjs'), code, '--pub',
  ...(tpl ? [`--tpl=${tpl}`] : []), ...(skin ? [`--skin=${skin}`] : []),
  ...(font ? [`--font=${font}`] : []), ...(seed ? [`--seed=${seed}`] : [])];
console.log(`■ ${code} 다시 그리기 — ${cmd.slice(2).join(' ')}`);
const r = spawnSync('node', cmd, { stdio: 'inherit', cwd: ROOT });
if (r.status !== 0) { console.error(`\n🚨 다시 그리기 실패 (종료 ${r.status}) — 위 메시지를 보세요. 장부는 안 건드렸습니다.`); process.exit(r.status || 1); }

// 장부 — 고친 것도 '준비됨' 이다(건너뛰기였다면 되살아난다). 게시 여부는 posted 가 따로 안다.
const meta = JSON.parse(readFileSync(metaFile, 'utf8'));
const seen = readSeen();
markPrepared(seen, { code, org: meta.org, name: meta.name, due: meta.due, school: meta.school || null, tplNo: meta.tplNo, cards: meta.cards,
  dir: `insta/pub/${code}`, at: meta.at, revisedAt: meta.at, status: 'prepared' });
writeSeen(seen);

if (!args.includes('--no-preview')) {
  const pv = spawnSync('node', [join(ROOT, 'insta/preview.mjs'), `--dir=insta/pub/${code}`], { stdio: 'inherit', cwd: ROOT });
  if (pv.status !== 0) console.error('  ⚠️ 미리보기 한 장을 못 만들었습니다 — 카드 파일은 insta/pub/ 에 있습니다.');
}
console.log(`\n다음 — ① insta/out/_preview-${code}.png 를 개발자에게 보여 준다`
  + `\n      ② "메일로 보낼까요?" 라고 **묻는다** — 답 듣기 전에 보내지 않는다`
  + `\n      ③ 보내라고 하면 insta/run-notify.txt 에 'code: ${code}' 를 적고 커밋·push (워크플로가 개발자 셋에게 보낸다)`);

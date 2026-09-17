/** publish.mjs 의 `--urls` 를 그대로 부른다 — 주소를 베끼지 않기 위한 얇은 통로. */
import { spawnSync } from 'node:child_process';
const dir = process.argv.find((x) => x.startsWith('--dir='));
const r = spawnSync('node', ['insta/publish.mjs', dir, '--urls'], { encoding: 'utf8' });
process.stdout.write(r.stdout || '');
process.exit(r.status ?? 1);

/* ============================================================
   푸시 서버 '판 도장' — 저장소의 서버 코드가 어느 판인지 한 줄로 (2026-10-12 · 알림 재발 수리)
   ------------------------------------------------------------
   왜 만들었나
     푸시 발송 서버(server/push/worker.js)는 Cloudflare 에서 돈다. 저장소에서 고쳐도 **운영에 올라갔는지는 /health 로 안 보였다**
     (2026-10-12 실측: 커밋 328cf445 의 Cloudflare GitHub 연결 빌드가 성공하고도 운영은 옛 판).
     이제 배포 워크플로(.github/workflows/push-deploy.yml)가 올릴 때 이 도장을 서버 변수(BUILD)로 같이 올리고, 서버는 /health 에
     그 값을 그대로 내보인다. 매일 확인(push-health.yml)·배포 확인(push-limit-check.yml)은 **저장소에서 같은 도장을 다시 찍어**
     /health 의 값과 대조한다 — 다르면 '운영이 옛 판' 경보다(알림 재발의 원인 후보 — 폰 도달 자체는 여기서 재지 않는다).

   무엇을 찍나
     서버 묶음에 들어가는 파일 전부의 내용 — worker.js 에서 시작해 상대 경로 import 를 따라간 파일들 + wrangler.toml.
     (목록을 손으로 적지 않는다 — 새 import 가 생기면 저절로 따라간다 · 주석 속 글자는 걷어내고 본다 · 관문 verify/health-gates/servers.mjs ⑪ 이 표본으로 잰다.)
     ⚠️ 따라간 파일은 배포 워크플로가 보는 경로(server/push/·server/shared/) 안이어야 한다 — 밖의 파일을 import 하면 그 파일을 고쳐도 배포가 안 걸려
        매일 확인이 영영 '옛 판'이 된다(관문 ⑪(b)가 막는다).
     그래서 '고쳤다'가 저장소에만 있고 운영에 안 닿은 날을 매일 잡는다.
     커밋 번호가 아니라 **내용**의 해시라, 같은 내용이면 어느 브랜치·커밋이든 같은 도장이고, 문서만 바뀐 커밋은 도장이 안 바뀐다.

   실행:  node tools/push-build-stamp.mjs            → 도장 12자리(표준 출력)
          node tools/push-build-stamp.mjs --files    → 도장에 들어간 파일 목록
   ============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const ENTRY = 'server/push/worker.js';
export const EXTRA = ['server/push/wrangler.toml'];

/** 주석을 걷는다 — 주석 속 'import … from' 예문(server/README.md 에 그런 글이 있다)을 따라가 없는 파일에서 넘어지지 않게 */
export const stripComments = (src) => String(src).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\'"])\/\/.*$/gm, '$1');

/** 상대 경로 import 를 따라 묶음에 들어가는 파일을 모은다(저장소 기준 경로 · 정렬) — 순수 함수에 가깝게 readFile 을 받는다 */
export function bundleFiles(entry = ENTRY, readFile = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8'), extra = EXTRA) {
  const seen = new Set();
  const walk = (rel) => {
    const norm = path.posix.normalize(rel);
    if (seen.has(norm)) return;
    seen.add(norm);
    const src = stripComments(readFile(norm));
    // 한 줄 꼴(`import { a } from './x'`)과 여러 줄 중괄호 꼴(`import {\n a,\n b\n} from './x'`)만 — 줄을 건너 아무 따옴표나 잡지 않는다
    const re = /(?:^|\n)\s*(?:import|export)\s(?:[^'";\n{]*|[^'";{]*\{[^'";}]*\}[^'";\n]*)from\s*['"](\.\.?\/[^'"]+)['"]|(?:^|\n)\s*import\s*['"](\.\.?\/[^'"]+)['"]/g;
    let m;
    while ((m = re.exec(src))) walk(path.posix.join(path.posix.dirname(norm), m[1] || m[2]));
  };
  walk(entry);
  for (const e of extra) seen.add(path.posix.normalize(e));
  return [...seen].sort();
}

/** 도장 — 파일 경로+내용을 차례로 해시한 sha256 의 앞 12자리 */
export function stamp(entry = ENTRY, readFile = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8'), extra = EXTRA) {
  const h = crypto.createHash('sha256');
  for (const f of bundleFiles(entry, readFile, extra)) {
    h.update(f + '\0');
    h.update(readFile(f).replace(/\r\n/g, '\n'));   // 줄끝 차이(Windows 체크아웃)로 도장이 갈라지지 않게
    h.update('\0');
  }
  return h.digest('hex').slice(0, 12);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.includes('--files')) console.log(bundleFiles().join('\n'));
  else console.log(stamp());
}

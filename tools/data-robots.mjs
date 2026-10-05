#!/usr/bin/env node
/* 데이터를 고치는 로봇 워크플로 이름들 — 워크플로 파일에서 **읽는다** (2026-10-05 로봇·도구 점검 · gaps-04)
 *
 * 왜: tools/robot-run.sh 가 손으로 적은 이름 8개로 '클라우드에서 같은 로봇이 도는가'를 봤는데, 실제로 data/·collector/ 를
 *     커밋하는 워크플로는 그 두 배가 넘었다. 빠진 것 가운데 자격요건 로봇·자격요건 매칭은 바로 그 겉옷이 지키려던
 *     data/registered.json(자동 병합에서 뺀 파일)을 쓴다. 이름도 실제로 바뀐다(deploy-sync.yml '이름 바꿈' 주석) — 손 목록은 또 낡는다.
 *     → verify/check-deploy-sync.js 가 deploy-sync 감시 목록을 고르는 것과 같은 방식으로 `git add data/…|collector/…` 줄이 있는
 *       워크플로의 name: 을 읽는다. 저장하지 않는 워크플로(배포·잠금 확인)는 걸리지 않는다.
 *
 * 실행: node tools/data-robots.mjs [워크플로 폴더]   — 한 줄에 하나씩 (기본 .github/workflows)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
export const SAVES_DATA = /git add[^\n]*\b(data|collector)\//;

/** dir 의 *.yml 가운데 data/·collector/ 를 git add 하는 워크플로의 name: (따옴표 뗌 · 정렬 · 겹침 없음) */
export function dataRobotNames(dir = path.join(ROOT, '.github', 'workflows')) {
  const names = new Set();
  for (const f of fs.readdirSync(dir).filter((n) => /\.ya?ml$/.test(n))) {
    const y = fs.readFileSync(path.join(dir, f), 'utf8');
    /* 주석 줄은 보지 않는다 — '예전엔 git add data/… 했다' 같은 설명이 로봇으로 세어지면 안 된다 */
    const code = y.split(/\r?\n/).filter((l) => !/^\s*#/.test(l)).join('\n');
    if (!SAVES_DATA.test(code)) continue;
    const name = ((/^name:\s*(.+)$/m.exec(y) || [])[1] || '').trim().replace(/^(['"])(.*)\1$/, '$2');
    if (name) names.add(name);
  }
  return [...names].sort();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const names = dataRobotNames(process.argv[2] ? path.resolve(process.argv[2]) : undefined);
  if (names.length) console.log(names.join('\n'));
}

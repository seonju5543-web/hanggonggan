#!/usr/bin/env node
/* 「어떤 링크를 넣어 주면 학습이 나아지는가」를 한 화면에 뽑는다 (2026-09-05 개발자 지시).
 *
 * 왜 필요한가 — 집 밖 학습의 구조적 한계:
 *   학습 로봇은 **읽은 글 안의 링크**를 따라 스스로 넓어진다. 그런데 검색은 못 한다
 *   (무료 검색 API 가 없고, 검색 결과를 긁는 것은 각 검색사 약관에 걸린다 —
 *    collector/essay-sources.json 첫머리에 사유가 적혀 있다).
 *   그래서 **링크가 닿는 '이웃'까지만** 넓어진다. 새 동네로 건너뛰는 일은 사람만 할 수 있다.
 *   → 개발자가 업무 질문을 할 때 이 결과를 함께 보여 주고 **주소를 요청한다.**
 *
 * 🔴 지어내지 않는다. 여기 나오는 숫자는 전부 저장소 파일에서 센 것이다
 *    (data/essay-playbook.json · collector/essay-sources.json).
 * 🔴 주소를 추천하지 않는다 — 우리가 고른 주소가 좋은 글이라는 근거가 없다.
 *    무엇이 모자란지만 말하고, 판단과 주소는 사람이 준다.
 *
 * 실행: node tools/link-wanted.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/* pathname 은 퍼센트 인코딩이라 공백·한글 경로에서 깨진다 — 저장소 관례대로 fileURLToPath */
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));

const PLAYBOOK = rd('data/essay-playbook.json');
const SOURCES = rd('collector/essay-sources.json');

/* 화면이 가르는 종류 이름을 그대로 쓴다 — 여기 목록을 베끼면 화면과 갈라진다 */
const askSrc = fs.readFileSync(path.join(ROOT, 'essay-ask.js'), 'utf8');
const KINDS = [...askSrc.matchAll(/\[\s*'([a-z]+)'\s*,\s*\//g)].map((m) => m[1]);
/* 🔴 0개면 '규칙 없는 종류' 경고가 조용히 사라진다 — 못 읽었다고 말하고 멈춘다 */
if (!KINDS.length) {
  console.error('essay-ask.js 에서 종류 목록(ESSAY_KINDS)을 읽지 못했습니다 — 그 파일의 모양이 바뀌었는지 보세요.');
  process.exit(1);
}
const KO = {
  motive: '지원 동기', intro: '자기소개', growth: '성장 과정', character: '성격·장단점',
  value: '가치관', study: '학업 계획', future: '장래·포부', share: '나눔·사회기여',
  use: '사용 계획', effect: '필요성·효과', idea: '아이디어·창업', episode: '경험·사례',
  message: '하고 싶은 말',
};

const rules = PLAYBOOK.rules || [];
const byKind = new Map();
for (const r of rules) if (r.kind !== '*') byKind.set(r.kind, (byKind.get(r.kind) || 0) + 1);

const missing = KINDS.filter((k) => !byKind.has(k));
/* 규칙은 있는데 뒷받침이 얇은 것 — 출처 2곳 미만이면 한 사람 말만 듣고 있는 것이다 */
const thin = rules.filter((r) => r.kind !== '*' && (r.src || []).length < 2)
  .map((r) => `${KO[r.kind] || r.kind}(${r.code})`);

const seeds = SOURCES.seeds || [];
const withered = seeds.filter((s) => (s.strike || 0) >= 3);
/* 장학 이야기인 곳과 취업 자소서 쪽에서 온 곳 — 뿌리가 취업이면 링크가 그쪽으로만 뻗는다 */
const scholar = seeds.filter((s) => /장학/.test(`${s.note || ''} ${s.url}`)).length;

const lines = [];
lines.push('📌 학습 로봇에 넣어 주시면 좋은 링크 (검색은 로봇이 못 합니다 — 사람만 새 동네로 건너뜁니다)');
lines.push('');
lines.push(`· 지금 규칙 ${rules.length}개 · 출처 ${(PLAYBOOK.sources || []).length}곳 · seeds ${seeds.length}곳`
  + ` (그중 장학 이야기로 보이는 곳 ${scholar}곳)`);

if (missing.length) {
  lines.push('');
  lines.push(`🔴 전용 규칙이 아예 없는 종류 ${missing.length}가지 — 이 주제의 작성 팁 글 주소가 필요합니다:`);
  for (const k of missing) lines.push(`   · ${KO[k] || k}`);
}
if (thin.length) {
  lines.push('');
  lines.push(`⚠️ 규칙은 있는데 출처가 1곳뿐이라 한 사람 말만 듣고 있는 종류 ${thin.length}가지:`);
  lines.push(`   ${thin.join(' · ')}`);
}
if (scholar < seeds.length / 2) {
  lines.push('');
  lines.push(`⚠️ seeds ${seeds.length}곳 중 장학 이야기는 ${scholar}곳뿐입니다 — 나머지는 취업 자소서 글이라`);
  lines.push('   로봇이 링크를 따라갈수록 취업 쪽으로 번집니다. 장학 후기·재단 안내 글이 필요합니다.');
}
if (withered.length) {
  lines.push('');
  lines.push(`🗑 3회 연속 아무것도 못 준 곳 ${withered.length}곳 — 지울지 봐 주세요(로봇은 자동 삭제하지 않습니다):`);
  for (const s of withered) lines.push(`   · (${s.strike}회) ${s.url}`);
}

lines.push('');
lines.push('넣는 법: collector/essay-sources.json 의 seeds 에 { "url": "...", "kind": "종류", "note": "무엇" } 한 줄.');
lines.push('  · 넣어 주시면 다음 실행(매주 화 05:37)에 읽고, 그 글의 링크에서 로봇이 스스로 이웃까지 넓힙니다.');
lines.push('  · 막는 곳: 합격 자소서를 통째로 파는 예시문 DB (표절·저작권·획일화 — docs/designs/essay-tailoring.md)');

console.log(lines.join('\n'));

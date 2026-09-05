#!/usr/bin/env node
/* 노션 「작업 현황」 갱신 로봇 (2026-09-06 개발자 지시로 신설)
 *
 * 하는 일 하나: 개발자 3명의 **브랜치에 쌓인 커밋**을 읽어 노션 표의 세 칸을 채운다
 * (최근 커밋 · 쌓인 커밋 · 갱신). 그래서 셋 중 누가 지금 무엇을 만지고 있는지
 * 노션만 열어도 보인다.
 *
 * 🔴 **'지금 하는 일' 칸은 건드리지 않는다.** 그 칸의 주인은 Claude 세션이다
 *    (백로그 항목 번호를 사람 말로 적는 자리). 로봇이 덮으면 사람이 적은 맥락이 사라진다.
 *
 * 🔴 **NOTION_TOKEN 이 없으면 아무 일도 하지 않고 0으로 끝난다.** push-config.js·
 *    chat-config.js 와 같은 방식이다 — 열쇠를 안 넣은 저장소에서 워크플로가 빨간불이
 *    되면 진짜 고장과 구분이 안 된다.
 *
 * 🔴 페이지 id 를 여기 박아 둔 이유: 이름으로 찾으면 노션에서 개발자 이름을 고치는 순간
 *    로봇이 조용히 아무 줄도 못 찾는다. id 는 안 바뀐다. 줄을 새로 만들면 여기 추가한다.
 *
 * 실행: node tools/notion-status.mjs   (update-progress.yml 의 마지막 보강 단계)
 */
import { execSync } from 'node:child_process';

const BASE = 'origin/claude/nice-heisenberg-WESq5';   // 기본 브랜치 — PROGRESS 활동 로그와 같은 기준
const MAX_TEXT = 1900;                                // 노션 rich_text 한 조각 상한은 2000자
const LOG_LINES = 8;

const DEVS = [
  { name: '이선주', branch: 'claude/work-seonju',    page: '3d29505a-3ec3-81e0-a77e-df1a93912858' },
  { name: '세현',   branch: 'claude/work-josehyeon', page: '3d29505a-3ec3-81d5-8ad2-c11b875e594b' },
  { name: '은서',   branch: 'claude/work-eunseo',    page: '3d29505a-3ec3-81c1-b647-ef7cb39ca72d' },
];

const token = process.env.NOTION_TOKEN;
if (!token) {
  console.log('NOTION_TOKEN 이 없습니다 — 노션 현황 갱신을 건너뜁니다(정상).');
  process.exit(0);
}

const sh = (c) => { try { return execSync(c, { encoding: 'utf8' }).trim(); } catch { return ''; } };

function activity(branch) {
  const range = `${BASE}..origin/${branch}`;
  const log = sh(`git log ${range} --since="14 days ago" --no-merges --pretty=format:"%ad · %s" --date=format:"%m-%d %H:%M" -n ${LOG_LINES}`);
  const ahead = Number(sh(`git rev-list --count ${range}`) || 0);
  return { log: log || '(최근 14일 개별 작업 없음)', ahead };
}

const kst = new Date(Date.now() + 9 * 3600 * 1000).toISOString().replace('T', ' ').slice(0, 16) + ' KST';
let failed = 0;

for (const d of DEVS) {
  const { log, ahead } = activity(d.branch);
  const body = {
    properties: {
      '최근 커밋': { rich_text: [{ text: { content: log.slice(0, MAX_TEXT) } }] },
      '쌓인 커밋': { number: ahead },
      '갱신': { rich_text: [{ text: { content: kst } }] },
    },
  };
  const res = await fetch(`https://api.notion.com/v1/pages/${d.page}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    // 🔴 조용히 넘어가지 않는다 — 열쇠 만료·공유 해제는 '갱신' 칸이 멈춘 것으로만 보여
    //    아무도 모른 채 몇 주가 지난다. 무엇이 왜 실패했는지 로그에 남긴다.
    console.error(`✕ ${d.name}: ${res.status} ${(await res.text()).slice(0, 300)}`);
    failed++;
  } else {
    console.log(`✓ ${d.name} — ${ahead}커밋`);
  }
}

if (failed) {
  console.error(`\n${failed}명 갱신 실패. 노션 통합에 「한대장」 페이지가 공유돼 있는지 확인하세요.`);
  process.exit(1);
}

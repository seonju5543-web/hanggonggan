#!/usr/bin/env node
/* 노션 「작업 현황」 갱신 로봇 (2026-09-06 개발자 지시로 신설)
 *
 * 하는 일 하나: **누가 방금 무엇을 push 했는지**를 노션 표의 세 칸에 적는다
 * (최근 커밋 · 쌓인 커밋 · 갱신). 그래서 셋 중 누가 지금 무엇을 만지고 있는지
 * 노션만 열어도 보인다.
 *
 * 🔴 **`claude/work-*` 브랜치를 보면 안 된다** (2026-09-06 코드 리뷰가 잡았다).
 *    첫 판이 그걸 봤는데 셋 다 **기본 브랜치 대비 0커밋**이고 마지막 커밋이 7~8월이었다
 *    — 실제 작업은 매번 새로 생기는 주제 브랜치에서 일어나고 기본 브랜치로 합쳐진다.
 *    그래서 표가 영원히 '0커밋 · 작업 없음'만 말했을 것이다(정확하지만 쓸모없는 로봇).
 *    지금은 **push 이벤트의 `github.actor`** 로 사람을 가른다 — 이 저장소는 커밋
 *    작성자가 셋 다 `Claude <noreply@anthropic.com>` 라 작성자로는 구분되지 않는다.
 *
 * 🔴 **'지금 하는 일' 칸은 건드리지 않는다.** 그 칸의 주인은 사람이다.
 *
 * 🔴 **읽지 못한 것을 '작업 없음'이라고 쓰지 않는다** (원칙 8-1). git 이 실패하면
 *    그렇게 적고 숫자는 비운다 — 확인 안 한 것을 확인했다고 말하지 않는다.
 *
 * 🔴 페이지 id 를 박아 둔 이유: 이름으로 찾으면 노션에서 개발자 이름을 고치는 순간
 *    로봇이 조용히 아무 줄도 못 찾는다. id 는 안 바뀐다.
 *
 * 실행: update-progress.yml 의 `notion` 작업(push 때만).
 */
import { execSync } from 'node:child_process';

const MAX_TEXT = 1900;   // 노션 rich_text 한 조각 상한은 2000자
const LOG_LINES = 8;

/* GitHub 로그인 → 노션 줄. 🔴 모르는 사람은 **짐작하지 않고 그냥 끝낸다**(로그에 남긴다).
   ⚠️ 은서 님 GitHub 로그인을 아직 못 받아 비어 있다 — 받으면 여기 한 줄만 채우면 된다. */
const PEOPLE = {
  'seonju5543-web': { name: '이선주', page: '3d29505a-3ec3-81e0-a77e-df1a93912858' },
  'Se-Hyeon-Jo':    { name: '세현',   page: '3d29505a-3ec3-81d5-8ad2-c11b875e594b' },
  // '<은서-github-id>': { name: '은서', page: '3d29505a-3ec3-81c1-b647-ef7cb39ca72d' },
};

const token = process.env.NOTION_TOKEN;
const actor = process.env.GITHUB_ACTOR || '';
const ref = process.env.GITHUB_REF_NAME || '';

if (!token) {
  console.log('NOTION_TOKEN 이 없습니다 — 노션 현황 갱신을 건너뜁니다(정상).');
  process.exit(0);
}
const who = PEOPLE[actor];
if (!who) {
  console.log(`노션 「작업 현황」에 줄이 없는 사람입니다: ${actor || '(actor 없음)'} — 건너뜁니다.`);
  console.log('  줄을 이으려면 tools/notion-status.mjs 의 PEOPLE 에 GitHub 로그인을 추가하세요.');
  process.exit(0);
}

/* 실패를 '없음'과 구분한다 — 이게 없으면 fetch 가 통째로 실패한 날에도
   "최근 14일 작업 없음"이라는 **확인하지 않은 단정**이 노션에 적힌다. */
const sh = (c) => { try { return { ok: true, out: execSync(c, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() }; } catch { return { ok: false, out: '' }; } };

const base = sh('git rev-parse --verify -q origin/main').ok ? 'origin/main' : '';
const range = base && ref !== 'main' ? `${base}..HEAD` : 'HEAD';
const log = sh(`git log ${range} --no-merges --pretty=format:"%ad · %s" --date=format:"%m-%d %H:%M" -n ${LOG_LINES}`);
const cnt = sh(`git rev-list --count ${range}`);

/* 글자 수로 자르면 이모지(🔴 등)가 반 토막 나 깨진 글자가 남는다 — 줄 단위로 자른다.
   이 저장소의 커밋 제목에는 실제로 이모지가 들어 있다. */
function fitLines(text, max) {
  const kept = [];
  let len = 0;
  for (const line of text.split('\n')) {
    if (len + line.length + 1 > max) break;
    kept.push(line);
    len += line.length + 1;
  }
  return kept.join('\n') || text.slice(0, max);
}

const props = {
  '브랜치': { rich_text: [{ text: { content: ref.slice(0, 200) || '(모름)' } }] },
  '갱신': { rich_text: [{ text: { content: new Date(Date.now() + 9 * 3600 * 1000).toISOString().replace('T', ' ').slice(0, 16) + ' KST' } }] },
};
if (log.ok && cnt.ok) {
  props['최근 커밋'] = { rich_text: [{ text: { content: fitLines(log.out || '(이 브랜치에 새 커밋 없음)', MAX_TEXT) } }] };
  props['쌓인 커밋'] = { number: Number(cnt.out) || 0 };
} else {
  props['최근 커밋'] = { rich_text: [{ text: { content: '⚠️ git 기록을 읽지 못했습니다 — 실행 로그를 확인하세요.' } }] };
  props['쌓인 커밋'] = { number: null };
  console.error('✕ git 기록을 읽지 못했습니다 (fetch 실패이거나 origin/main 이 없습니다).');
}

const res = await fetch(`https://api.notion.com/v1/pages/${who.page}`, {
  method: 'PATCH',
  headers: {
    Authorization: `Bearer ${token}`,
    'Notion-Version': '2022-06-28',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ properties: props }),
});

if (!res.ok) {
  /* 🔴 조용히 넘어가지 않는다 — 열쇠 만료·공유 해제는 '갱신' 칸이 멈춘 것으로만 보여
     아무도 모른 채 몇 주가 지난다. 작업을 빨간불로 끝내 Actions 에서 보이게 한다
     (그래서 이 작업에는 continue-on-error 를 걸지 않는다). */
  console.error(`✕ ${who.name}: ${res.status} ${(await res.text()).slice(0, 300)}`);
  console.error('  노션 통합에 「한대장」 페이지가 공유돼 있는지, NOTION_TOKEN 이 살아 있는지 확인하세요.');
  process.exit(1);
}
console.log(`✓ ${who.name} — ${ref} · ${props['쌓인 커밋'].number ?? '?'}커밋`);

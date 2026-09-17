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
 * 🔴 **`origin/main..HEAD` 를 세면 안 된다** (2026-09-06 첫 실행에서 드러났다).
 *    이 저장소는 **세 브랜치에 같은 내용을 동시에 push** 하는 관례라, push 직후엔 main 이
 *    늘 따라잡아 차이가 0 이 된다 — 커밋 4개를 올린 세션이 '0커밋 · 새 커밋 없음'으로
 *    찍혔다. 리뷰가 잡았던 '빈 신호'와 같은 유형이다.
 *    → 최근 커밋은 **그 브랜치의 최근 이력 그대로** 보여 준다.
 *
 * 🔴 **커밋 '개수'는 적지 않는다** (2026-09-06 · 두 번 연속 틀린 뒤 칸을 없앴다).
 *    ① `origin/main..HEAD` → 세 브랜치 동시 push 관례 때문에 **항상 0**.
 *    ② `github.event.before..HEAD` → 뒤처진 브랜치를 따라잡는 push 에서 **935** 가 나왔다
 *       (실제로 한 일은 커밋 1개였다). 어느 기준이든 '이 사람이 방금 한 일'을 뜻하지 못한다.
 *    최근 커밋 목록은 두 경우 다 정확했다. **틀린 숫자보다 없는 숫자가 낫다.**
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
   셋 다 이 저장소 공동작업자임을 API 로 확인했다(2026-09-06). */
/* 🔴 `emails` 는 **줄마다 다른 목록이 나오게 하는 유일한 장치**다 (2026-09-06 개발자 지적:
   "왜 자꾸 내 최근 커밋이랑 은서 최근 커밋이 똑같은 내용으로 복붙되는지 모르겠고").
   원인: 예전에는 `git log` 를 필터 없이 읽어 **main 의 최근 8개**를 적었다. 이 로봇은
   main push 때만 도니까 누가 push 하든 같은 목록이 나온다 — 줄만 다르고 내용이 같았다.
   ⚠️ 머리말의 "셋 다 작성자가 Claude 라 구분이 안 된다"는 **더 이상 사실이 아니다.**
      실측(최근 300커밋): 조세현 117 · 유은서 57 · Claude 17 · 나머지는 로봇.
   ⚠️ 이선주 의 `noreply@anthropic.com` 는 **확인된 값이 아니라 추론이다** — 은서·세현은
      자기 이름으로 찍히는데 그 계정만 git 설정이 없어 보인다. 본인이 git 설정을 하면
      여기에 그 주소를 더할 것. 못 찾으면 로봇은 **지어내지 않고 못 찾았다고 적는다.** */
const PEOPLE = {
  'seonju5543-web': { name: '이선주', page: '3d29505a-3ec3-81e0-a77e-df1a93912858',
                      emails: ['noreply@anthropic.com'] },
  'Se-Hyeon-Jo':    { name: '세현',   page: '3d29505a-3ec3-81d5-8ad2-c11b875e594b',
                      emails: ['josehyeon@josehyeon-ui-MacBookAir.local', 'josehyeon0926@gmail.com'] },
  'didinin-wq':     { name: '은서',   page: '3d29505a-3ec3-81c1-b647-ef7cb39ca72d',
                      emails: ['dhdp0105@gmail.com'] },
};

/* '지금 하는 일' — **만진 파일에서 읽는다.** 커밋 제목을 요약하려 들면 지어내게 되고,
   백로그에서 가져오면 실제로 만진 것과 어긋난다(개발자 지적: "백로그에 있는거 가져와서 쓰는데
   그러지 말고"). 파일 경로는 지어낼 수 없는 사실이다.
   🔴 **기능 이름까지 내려간다** (2026-09-06 개발자 지시: "조금만 더 구체적으로, 자격 매칭
      개선 이런 식으로"). '수집'·'화면' 은 너무 넓어 누가 봐도 무엇을 하는지 모른다.
   ⚠️ **위에서부터 먼저 맞는 것**이라 좁은 줄이 넓은 줄보다 위에 있어야 한다
      (`collector/link-hunter` 가 `collector/` 보다 위).
   ⚠️ 뒤에 붙는 동사는 **git 이 아는 것만** 쓴다 — 새로 생긴 파일이면 '신설', 지웠으면 '정리',
      아니면 '수정'. '개선'·'수리' 처럼 잘했는지 못했는지를 말하는 낱말은 경로에도 git 에도
      없으므로 붙이지 않는다(그건 지어내는 것이다). 무엇을 했는지는 바로 옆 '최근 커밋' 칸이
      원문 그대로 말한다. */
const AREAS = [
  [/^collector\/(link-hunter|resolve-detail-urls|probe-links|detail-url|canon-url)/, '원문 링크 찾기'],
  [/^collector\/kosaf|^data\/kosaf/, '한국장학재단 목록'],
  [/^collector\/(schematize|schema-from-text)/, '양식 스키마화'],
  [/^collector\/(extract-excerpts|rescue-bodies|notice-source|deepfetch)/, '공고 원문 확보'],
  [/^collector\/(auto-register|clean-title)/, '공고 자동 등록'],
  [/^collector\//, '수집 로봇'],
  [/^data\/registered/, '공고 등록'],
  [/^data\/forms/, '신청서 양식'],
  [/^data\//, '공고 데이터'],
  [/^(match-engine|parse-requirements|section-head)\.js$/, '자격 매칭'],
  [/^parse-amount\.js$/, '금액 판정'],
  [/^(forms|form-plan)\.js$/, '신청서 양식'],
  [/^essay|^server\/essay/, '지원서 초안'],
  [/^(notify|push-config)|^server\/push/, '알림·푸시'],
  [/^chat|^server\/chat/, '장학금 도우미'],
  [/^supabase|^terms\.html$/, '로그인·약관'],
  [/^_admin\/|admin-apply/, '관리자 화면'],
  [/^verify\//, '검사 도구'],
  [/^\.github\//, '로봇 워크플로'],
  [/^tools\/notion-/, '노션 현황판'],
  [/^tools\/(merge-json-union|setup-collab)/, '협업 병합'],
  [/^tools\/(admin-apply|build-admin-preview)/, '관리자 화면'],
  [/^tools\/link-wanted/, '원문 링크 찾기'],
  [/^tools\/robot-run/, '수집 로봇'],
  [/^tools\//, '작업 도구'],
  [/^proposals\//, '제안서'],
  [/^(style\.css|index\.html)$/, '화면 디자인'],
  [/^app\.js$/, '앱 화면'],
  [/^sw\.js$/, '오프라인·캐시'],
  [/\.md$/, '문서'],
];

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

/* 🔴 **그 사람이 쓴 커밋만** 본다. 필터 없이 읽으면 세 줄이 전부 main 의 같은 목록이 된다.
   git 은 `--author` 를 여러 개 주면 '또는'으로 묶는다. */
const byAuthor = (who.emails || []).map((e) => `--author=${JSON.stringify(e)}`).join(' ');
const log = byAuthor
  ? sh(`git log --no-merges ${byAuthor} --pretty=format:"%ad · %s" --date=format:"%m-%d %H:%M" -n ${LOG_LINES}`)
  : { ok: false, out: '' };

/* 만진 파일 → 한 낱말. 최근 3개만 본다 — 지금 무엇을 하는 중인지가 알고 싶은 것이지
   이 사람이 여태 무엇을 했는지가 아니다. */
function nowDoing() {
  if (!byAuthor) return '';
  /* `--name-status` 로 받는다 — 무엇을 만졌는지뿐 아니라 **새로 만들었는지 고쳤는지**까지
     git 이 알려 준다. 그래야 뒤에 붙일 낱말을 지어내지 않아도 된다. */
  const files = sh(`git log --no-merges ${byAuthor} -n 3 --name-status --pretty=format:`);
  if (!files.ok || !files.out) return '';
  const count = new Map();      // 기능 이름 → 무게 합
  const marks = new Map();      // 기능 이름 → 본 상태 글자들
  const first = new Map();      // 기능 이름 → 처음 본 커밋 번호(동점일 때 최신이 이긴다)
  /* 🔴 **최신 커밋에 무게를 준다** — '지금' 하는 일이지 '요즘' 하는 일이 아니다.
     그냥 세면 파일을 많이 만진 옛 작업이 방금 한 일을 덮는다(실측: 방금 노션 로봇을
     고쳤는데 이틀 전 style.css 작업이 이겨서 '화면 디자인'이 떴다).
     ⚠️ 최신 하나만 보면 오탈자 커밋 하나에 칸이 통째로 흔들린다 — 그래서 3:2:1 이다. */
  const WEIGHT = [3, 2, 1];
  /* ⚠️ **0 에서 시작한다.** 앞머리에는 빈 줄이 없다 — `sh` 가 앞뒤를 다듬기 때문이다.
     -1 로 시작했더니 무게가 3·3·2 로 밀려서, 파일 하나짜리 최신 커밋이 파일 셋짜리
     옛 커밋에 졌다(실측: 노션 로봇을 고친 날 '화면 디자인'이 떴다). 커밋 사이 빈 줄은 하나다. */
  let idx = 0;
  for (const line of files.out.split('\n')) {
    if (!line.trim()) { idx++; continue; }   // 커밋과 커밋 사이의 빈 줄
    const w = WEIGHT[Math.min(Math.max(idx, 0), WEIGHT.length - 1)];
    const cols = line.split('\t');
    const mark = cols[0][0];                 // A(추가) M(수정) D(삭제) R(이름바꿈)
    const path = cols[cols.length - 1];      // 이름바꿈은 마지막 칸이 새 이름이다
    const hit = AREAS.find(([re]) => re.test(path));
    if (!hit) continue;
    count.set(hit[1], (count.get(hit[1]) || 0) + w);
    marks.set(hit[1], (marks.get(hit[1]) || '') + mark);
    if (!first.has(hit[1])) first.set(hit[1], idx);
  }
  if (!count.size) return '';
  /* 🔴 **문서는 혼자일 때만 이긴다.** CLAUDE.md 는 거의 모든 작업에 딸려 오는 동반자라,
     그냥 세면 무엇을 고쳤든 '문서'가 자주 1등이 된다(실제로 동점 1등이었다).
     문서만 만진 날에는 그대로 '문서'가 뜬다. */
  const real = [...count.entries()].filter(([k]) => k !== '문서');
  const pool = real.length ? real : [...count.entries()];
  /* 동점이면 **더 최근 커밋에서 본 것**이 이긴다 — '지금' 하는 일이 무엇인지가 기준이다.
     (동점은 자주 난다: 커밋 하나에 파일 하나씩만 만지면 전부 같은 무게가 된다) */
  const top = pool.sort((a, b) => b[1] - a[1] || first.get(a[0]) - first.get(b[0]))[0][0];
  const seen = marks.get(top) || '';
  const verb = seen.includes('A') ? '신설' : /^D+$/.test(seen) ? '정리' : '수정';
  return `${top} ${verb}`;
}

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
if (log.ok && log.out) {
  props['최근 커밋'] = { rich_text: [{ text: { content: fitLines(log.out, MAX_TEXT) } }] };
} else if (!byAuthor) {
  /* 주소를 모르는 사람 — **남의 커밋으로 채우지 않는다.** 그게 복붙의 원인이었다. */
  props['최근 커밋'] = { rich_text: [{ text: { content: `⚠️ ${who.name} 의 커밋 주소를 모릅니다 — tools/notion-status.mjs 의 PEOPLE 에 emails 를 채우세요.` } }] };
  console.error(`✕ ${who.name}: emails 가 비어 있습니다.`);
} else {
  props['최근 커밋'] = { rich_text: [{ text: { content: '⚠️ 이 이름으로 된 커밋을 찾지 못했습니다 — git 설정(user.email)을 확인하세요.' } }] };
  console.error(`✕ ${who.name}: ${who.emails.join(', ')} 로 된 커밋이 없습니다.`);
}

/* '지금 하는 일' — 예전에는 사람이 채우는 칸이었는데, 백로그를 베껴 붙이게 돼서
   실제로 만진 것과 어긋났다(2026-09-06 개발자 지시로 로봇이 채운다).
   ⚠️ **못 읽으면 비우지 않고 그냥 두지도 않는다** — 빈 값을 쓰면 사람이 적어 둔 것을 지운다.
      읽었을 때만 덮어쓴다. */
const doing = nowDoing();
if (doing) props['지금 하는 일'] = { rich_text: [{ text: { content: doing } }] };

/* `--dry` — 노션에 쓰지 않고 무엇을 쓸지만 보여 준다. 이 로봇은 push 때만 도는데,
   확인하려고 push 하면 그 push 가 또 값을 바꾼다. 손으로 미리 재보는 통로가 필요하다. */
if (process.argv.includes('--dry')) {
  console.log(`[시험] ${who.name} (${actor}) → ${who.page}`);
  for (const [k, v] of Object.entries(props)) console.log(`  ${k}: ${v.rich_text[0].text.content.replace(/\n/g, '\n' + ' '.repeat(k.length + 4))}`);
  if (!props['지금 하는 일']) console.log('  지금 하는 일: (못 읽어서 그대로 둠)');
  process.exit(0);
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
console.log(`✓ ${who.name} — ${ref}`);

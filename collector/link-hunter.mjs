/* 링크 사냥꾼 — '원문 공고로 못 가는 링크'를 계속 찾아 고치는 전담 로봇 (2026-08-01)

   ⭐ 목적을 좁히지 말 것 (2026-08-01 개발자 지적으로 바로잡음)
   이 로봇은 '동국대 고치기'가 아니다. **어느 학교든, 어떤 이유로든 학생이 원문 공고에
   못 가는 링크를 계속 찾아 고치는 것**이 목적이다. 처음 만들 때 내가 두 가지로 목적을
   좁혀 놨고, 그 바람에 경희대 로그인 벽 7건을 놓쳤다:
     ① onlyBoard로 한 학교에 묶음  → 이제 기본이 전체 학교다.
     ② 표식(#n-)이 붙은 것만 대상  → '주소는 멀쩡해 보이는데 눌러 보면 로그인 벽/다른 글'인
        경우는 표식이 없어 눈에 안 띄었다(그런 사각지대가 229건 있었다).
        → **순찰 단계**를 앞에 둬서 기존 링크도 돌아가며 다시 열어 본다.
        ⚠️ 2026-10-03 부터 이 일은 원문 링크 확인 로봇(link-check.mjs)이 **기록만** 하며 맡는다 — 아래 [덤 · 순찰].

   왜 따로 두나
   ─────────────────────────────────────────────────────────────────
   수집 로봇(browser-collect)은 매일 12개 캠퍼스를 훑어야 해서 **빨라야 한다**.
   그래서 공고마다 행을 눌러 보는 대신, 목록에서 글 번호를 긁어 주소를 '조립'한다.
   빠르지만 틀릴 수 있다 — 실제로 동국대에서 조립한 `view?nttId=…`가 33건 전부 404였고
   (그 주소 형태가 동국대엔 아예 없었다), 다른 17건은 열리긴 했는데 그 공고가 아니었다.

   이 로봇은 반대로 **느려도 정확한 방법**만 쓴다. 대상이 '남은 어려운 것들'뿐이라
   느려도 괜찮다. 핵심 원칙은 하나다:

       ⭐ 짐작하지 않는다. 행을 실제로 눌러서 브라우저가 간 주소를 받아 적는다.

   조립은 게시판이 폼을 안 내주고 클릭도 실패했을 때의 마지막 수단이다.

   무엇을 하나 — 본업이 먼저, 순찰은 덤 (2026-08-01 개발자 지시로 순서를 바꿈)
   ─────────────────────────────────────────────────────────────────
   본업은 **'앱에서 원문 공고를 눌렀을 때 그 공고가 안 열리는 링크'를 고치는 것**이다.
   멀쩡히 열리는 링크까지 매번 다시 둘러보느라 본업이 밀리면 안 되므로,
   사냥을 먼저 다 하고 **시간이 남을 때만** 순찰한다(`patrol: 0`이면 순찰 아예 끔).

   [1단계 사냥 — 본업]
   ① 표식(#n-…)인 공고를 전부 모은다 — **학교를 가리지 않는다.**
   ② 게시판을 페이지별로 넘기며 그 제목의 행을 찾는다.
   ③ 행을 **클릭**해 브라우저가 실제로 이동한 주소를 받는다.
      주소가 안 바뀌는 게시판(form POST)이면 상세 화면과 목록 폼에서 재료를 모아 조립한다.
   ④ 만든 주소를 **로그인도 리퍼러도 없는 새 탭**에서 다시 열어 그 공고가 맞는지 확인한다.
      (사용자는 그 조건으로 링크를 누르므로 그 조건으로 확인해야 한다.)
   ⑤ 통과한 것만 데이터에 반영한다. 못 찾은 것은 지어내지 않고 표식을 그대로 둔다.
   [덤 · 순찰] 🔴 **2026-10-03 부터 주소를 고치지 않는다 — 기본은 꺼짐(patrol: 0).**
      예전 순찰은 멀쩡한 원문 주소를 다시 열어 보고 '제목 불일치'면 게시판 목록 표식(#n-)으로
      **덮어썼다**(사본도 안 남겼다). 그런데 대조한 제목이 게시판 행 꼬리(`학생지원팀 2026-09-02 1,076`)나
      사람이 다듬은 앱 이름이라 멀쩡한 링크가 떨어졌다 — 그날 하루에 항공대 3건(scholnoti.php?…seq=)·건국대
      (artclView.do)·부경대(2432?action=view&no=) 원문 5건이 목록 표식으로 바뀌어 커밋됐다(aa195bf8 · 02ee20a3 ·
      e5f6de7b, 제목은 하나같이 '원문 주소 0건 확보'). 같은 날 고려대 3건도 바뀌었는데 그쪽은 원래도
      목록에 번호만 붙인 주소(subview.do?nttId=)였다 — 이렇게 덮어쓰기는 맞든 틀리든 흔적을 안 남긴다.
      게다가 목록 판정에 다른 글 제목을 안 넘겨(`verify(url, title, [])`) 진짜 목록 41건은 통과시켰다.
      판정하는 쪽이 고치기까지 하면 오판 한 번이 곧 데이터 손상이다 — 그래서 '앱의 모든 링크를 새 탭으로
      열어 보는 일'은 원문 링크 확인 로봇(collector/link-check.mjs)이 맡고, **주소를 고치지 않고 기록만** 한다.
      이 로봇의 순찰은 켜더라도(patrol: N) link-hunt.json 에 판정만 적는다.

   같은 것을 영원히 다시 두드리지 않기
   ─────────────────────────────────────────────────────────────────
   `collector/link-hunt.json`에 공고별로 시도 횟수와 마지막 사유를 남긴다.
   · 실패가 쌓일수록 간격을 늘려(1일→3일→7일→14일→30일) 계속 다시 찾는다 — 포기는 없다.
   · 실패가 3회 쌓이고 **3단계(다른 게시판·사이트 검색)까지 못 찾은 날** 한 번 사람에게 알린다(`stuck` → 이슈).
     (2026-10-04 · 이슈 #387 — 예전엔 1단계의 세 번째 실패에서 바로 세어, 같은 실행의 3단계가 찾아낸 공고로 이슈가 열렸다)
   · '목록에서 못 찾음'이 3회 쌓여도 목록 끝까지 본 경우에만 '게시판에서 내려간 듯(likelyGone)'으로 적는다
     (쪽수·시간 상한에서 멈췄으면 더 뒤에 있을 수 있다). 규칙은 link-hunt-rules.mjs 한 곳.
   · 네트워크로 못 읽은 것은 횟수에 세지 않는다 — 학교 서버 사정이지 공고 잘못이 아니다.
   · 관리자가 원문 주소를 넣은 공고(data/link-fixes.json)는 대상에서 뺀다 — 표식을 바꾸면 관리자 주소가 화면에서 사라진다.

   실행: node collector/link-hunter.mjs [--dry]
         (워크플로 link-hunter.yml · collector/run-link-hunt.txt 를 고쳐 push해도 실행) */
import fs from 'node:fs';
import { chromium } from 'playwright';
import { cleanTitle } from './clean-title.mjs';
import { isMarkerUrl, markerTitle, listUrlOf, isDetailUrl, sameTitle, rowMatchesTitle, rowByCore, rowDetailCandidates, observeLanding, otherTitlesOnSite, cleanStoredUrl } from './detail-url.mjs';
/* 🔴 '이 주소를 열면 그 공고가 뜨는가'는 **공용 판정 한 곳**(link-landing.mjs judgeLanding)으로 본다 (2026-10-03).
   예전 verify() 는 제 규칙을 따로 들고 있다가 ① 로그인 벽을 제목보다 먼저 봐서 머리의 회원 로그인 상자 때문에
   멀쩡한 전북·부경 공고를 떨어뜨렸고 ② 목록 판정에 빈 목록을 받아 진짜 목록을 통과시켰다.
   제목 후보(expectTitles)·행 꼬리 떼기(stripRowTail)도 같은 파일 것을 쓴다 — 베끼면 다시 갈라진다. */
import { judgeLanding, expectTitles, stripRowTail } from './link-landing.mjs';
/* 🔴 발행 직전 중복 정리는 **수집기와 같은 규칙**을 쓴다 (2026-09-04 신설).
   사냥꾼은 표식(#n-)을 진짜 주소로 바꾸는 로봇이라, 같은 공고가 서로 다른 표식으로
   두 번 담겨 있으면 **둘 다 같은 주소로 풀려 중복이 된다.** 그 중복 하나 때문에
   저장 직전 감사가 `실시간 공고에 중복 1건`으로 떨어지고, 워크플로가 사냥해 온 것을
   **통째로 되돌린다** — 2026-09-03 실행이 정확히 그랬다(주소를 찾아 놓고 전량 폐기).
   dedupeNotices 는 표식보다 진짜 링크를 남기므로 여기 쓰기에 꼭 맞는다. */
import { dedupeNotices } from './url-key.mjs';
/* 앱이 읽는 것은 학교별 파일이다 — 고친 주소를 거기까지 옮긴다(재발행이 아니라 그 자리만 고침).
   왜 재발행이면 안 되는지는 publish-notices.mjs 의 patchUrlsBySchool 첫머리에 있다. */
import { patchUrlsBySchool } from './publish-notices.mjs';
/* 장부 규칙(시도 기록 · 사람에게 알릴 때 · '내려간 듯')은 순수 함수 파일 하나 — 관문이 가짜 장부로 그대로 돌려 본다 (2026-10-04 · 이슈 #387) */
import { recordAttempt, settleEscalation, listScanEnd, escalationLines, pruneHuntState, boardUnreachableWhy } from './link-hunt-rules.mjs';
/* 관리자가 이미 원문을 넣은 공고는 건드리지 않는다 (2026-10-04) — 표식을 바꾸면 관리자 열쇠(u:<표식>)가 안 맞아 그 주소가 화면에서 사라진다 */
import { readLinkFixes, humanFixedBy } from './link-fixes-read.mjs';

const HERE = new URL('.', import.meta.url);
const DRY = process.argv.includes('--dry');
/* 오늘 날짜(KST) — 순찰·재시도 간격 판단에 쓴다.
   ⚠️ 반드시 맨 위에 둘 것: 2026-08-01에 순찰 단계를 넣으면서 이 선언이 사용처보다
   아래에 남아, 로봇이 시작하자마자 죽는 상태였다(const는 선언 전에 못 쓴다). */
const today = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);

/* 집계 — 맨 위에 둔다. 아래 '넘어져도 저장' 장치가 언제 불려도 읽을 수 있어야 하기 때문. */
let found = 0; let gone = 0; let stuck = 0;
/* 아직 못 찾은 공고 — 숫자가 아니라 열쇠 묶음으로 센다(2026-10-05 점검 links-2): 1단계에서 실패로 센 공고를 같은 실행의 3단계가 찾아도
   숫자는 안 내려가 끝줄 '아직 못 찾음'이 부풀었다(#387: 6건 중 1건은 찾은 것). 3단계가 찾으면 뺀다. */
const failedKeys = new Set();
const escalatedNow = [];   // 이번에 처음 사람에게 알리는 공고 — 리포트 머리 절(escalationLines)
let prunedKeys = 0;        // 저장할 때 걷어 낸 장부 줄 수(pruneHuntState)

/* ── 넘어져도 그때까지 찾은 것은 반드시 저장한다 (2026-08-01) ──────────────
   왜 만들었나: 리포트 마지막 줄의 낱말 하나가 틀려(옛 이름 GIVE_UP_AFTER) 로봇이
   마지막에 넘어졌는데, 그 바람에 **4분 동안 실제로 찾아낸 원문 주소 13건이 통째로
   버려졌다**(저장 단계가 통째로 건너뛰어졌다). 사냥은 오래 걸리는 일이라
   '다 되거나 아니면 전부 버리거나'는 너무 비싸다. 그래서 넘어지면
   ① 그때까지의 결과를 저장하고 ② 리포트에 넘어진 자리를 적고 ③ 그래도 실패는
   실패라고 알린다(종료 코드 1 → 워크플로가 🚨 알림). 저장 단계는 실패해도 돌도록
   link-hunter.yml에서 always()로 바꿔 두었다. */
let crashed = false;
const onCrash = (err) => {
  if (crashed) return;             // 두 번 저장하지 않는다
  crashed = true;
  console.error('\n🚨 사냥 도중 넘어졌습니다 — 그때까지 찾은 것은 저장합니다:\n', err);
  try { saveAll(String((err && err.stack) || err).split('\n').slice(0, 3).join(' · ')); } catch (e) {
    console.error('저장까지 실패했습니다:', e);
  }
  process.exit(1);
};
process.on('uncaughtException', onCrash);
process.on('unhandledRejection', onCrash);

function runSetting(key) {
  try {
    const txt = fs.readFileSync(new URL('run-link-hunt.txt', HERE), 'utf8');
    const m = txt.match(new RegExp('^\\s*' + key + ':\\s*(.+)$', 'm'));
    return m ? m[1].trim() : '';
  } catch { return ''; }
}
const ONLY = process.env.HUNT_ONLY_BOARD || runSetting('onlyBoard');
const MAX_PAGES = Number(process.env.HUNT_MAX_PAGES || runSetting('maxPages') || 10);
const BUDGET_MS = Number(process.env.HUNT_BUDGET_MS || 25 * 60000);

/* 🔴 **예산을 넘기면 어디서 멈춰 있든 스스로 저장하고 끝낸다** (2026-09-05 신설).
   왜: 최근 8회 중 5회가 `timeout-minutes: 40` **정각(40.4분)에 취소**됐다. 시간초과는
   GitHub 이 프로세스를 강제 종료하는 것이라 `saveAll` 도, 워크플로의 저장 단계도 못 간다 —
   실제로 09-02 회차는 hunt 단계가 표준출력 한 줄도 못 내고 죽었고, 그날 찾은 것이 전부 사라졌다.
   `uncaughtException` 훅으로는 못 막는다(넘어진 게 아니라 밖에서 죽인 것이다).

   🔴 이게 왜 백오프까지 망가뜨렸나 — `attempts`·`nextTryAt` 은 `link-hunt.json` 에 있고 그건
   `saveAll` 이 쓴다. 강제 종료된 회차는 아무것도 안 남기므로 **실패가 세어지지 않아
   다음 실행이 같은 표적을 같은 학교에 또 두드린다.** '영구 포기는 없다'의 간격 늘리기가
   정작 실패가 잦은 회차에서만 작동하지 않고 있었다.

   예산이 못 끊는 자리가 실제로 여럿이다(게시판 열기 3회 재시도 ≈129초 · 대상 하나의
   후보 확인 · 3단계의 다른 게시판 뒤지기 · 시한 없는 `browser.close()`). 자리마다
   withDeadline 을 두르는 것보다, **어디서 매달려도 반드시 저장되는 바깥 시계** 하나가 싸고 확실하다.
   `unref()` 라 정상 종료는 이 타이머 때문에 늦어지지 않는다. */
const watchdog = setTimeout(() => {
  if (crashed) return;
  crashed = true;                                    // saveAll 을 두 번 부르지 않는다
  console.error(`\n⏰ 예산(${Math.round(BUDGET_MS / 60000)}분)을 넘겨 스스로 멈춥니다 — 여기까지 찾은 것은 저장합니다.`);
  /* ⚠️ `saveAll(메모)` 의 메모 칸은 **넘어졌을 때** 쓰는 자리라 리포트에 '🚨 로봇이 도중에
     넘어졌습니다' 를 찍는다. 이건 넘어진 게 아니라 설계된 멈춤이므로 그렇게 적으면 거짓말이다.
     그래서 메모 없이 부르고, 사정은 리포트에 제 문장으로 남긴다. */
  try {
    report.push(`⏰ **예산(${Math.round(BUDGET_MS / 60000)}분)을 넘겨 스스로 멈췄습니다** — 여기까지 찾은 것은 저장했고, 남은 것은 다음 실행이 이어서 합니다.`);
    report.push('');
    saveAll(null);
  } catch (e) {
    console.error('저장까지 실패했습니다:', e);
  }
  /* 넘어진 것이 아니라 **설계된 멈춤**이라 0 으로 끝낸다 — 워크플로의 저장 단계가
     `always()` 가 아니라 감사 통과 여부만 보므로, 여기서 1 을 내면 🚨 알림이 매번 뜬다. */
  process.exit(0);
/* 유예 90초 — 예산 검사는 '게시판 하나가 끝난 뒤'에만 물어보므로 마지막 한 곳이
   정상적으로 조금 넘길 수 있다. 그 여유를 준 뒤에도 안 끝나면 매달린 것으로 본다.
   (검사에서 짧게 줄 수 있게 환경변수로 열어 둔다 — 기본값은 바꾸지 말 것) */
}, BUDGET_MS + Number(process.env.HUNT_WATCHDOG_GRACE_MS || 90 * 1000));
watchdog.unref();
/* 끈질김의 규칙 (2026-08-01 개발자 지시: "어떻게든 원문을 찾아서 올려둬라")
   실패해도 **영영 포기하지 않는다.** 다만 같은 것을 매일 두드리면 학교 서버에 무례하고
   시간도 낭비하므로, 실패가 쌓일수록 **간격을 늘려 가며 계속 시도한다.**
   3회째에 사람에게 알리지만(이슈), 그 뒤로도 로봇은 계속 찾아본다.
   (ESCALATE_AT·BACKOFF_DAYS 는 link-hunt-rules.mjs 에 있다 — 🔴 알림은 3단계까지 실패한 뒤에만 센다 · 2026-10-04) */
const startedAt = Date.now();
const outOfTime = () => Date.now() - startedAt > BUDGET_MS;

const noticesPath = new URL('../data/notices.json', HERE);
const registeredPath = new URL('../data/registered.json', HERE);
const statePath = new URL('link-hunt.json', HERE);
const notices = JSON.parse(fs.readFileSync(noticesPath, 'utf8'));
const registered = JSON.parse(fs.readFileSync(registeredPath, 'utf8'));
let state = { updatedAt: null, items: {} };
try { state = JSON.parse(fs.readFileSync(statePath, 'utf8')); } catch { /* 첫 실행 */ }
state.items = state.items || {};

/* 사냥 대상 모으기 — 학교를 가리지 않는다.
   🔴 관리자가 이미 원문을 넣은 공고(data/link-fixes.json — 앱과 같은 판정 humanFixedBy)는 빼고 센다 (2026-10-04).
      표식을 바꾸면 관리자 열쇠(u:<표식>)가 안 맞아 관리자가 넣은 주소가 학생 화면에서 소리 없이 사라진다. */
const humanFixed = humanFixedBy(readLinkFixes(new URL('../data/link-fixes.json', HERE)));
const heldByAdmin = [];
const targets = [];
for (const n of notices.items || []) {
  if (!isMarkerUrl(n.url)) continue;
  if (humanFixed(n)) { heldByAdmin.push(n.title); continue; }
  targets.push({ ref: n, field: 'url', title: n.title, key: `n:${n.url}`, school: n.school });
}
for (const r of registered.items || []) {
  if (!isMarkerUrl(r.sourceUrl)) continue;
  if (humanFixed(r)) { heldByAdmin.push(r.name); continue; }
  targets.push({ ref: r, field: 'sourceUrl', title: r.name, key: `r:${r.id}`, id: r.id, school: (r.eligibility || {}).schoolOnly });
}
/* 게시판에서 행을 찾을 때 쓰는 제목은 **게시판에 적힌 원래 제목**이어야 한다.
   앱에 보여주는 이름(r.name)은 사람이 다듬은 것이라("전문자격장학 (2026-2학기)")
   게시판 행("공지 공지 2026-2학기 전문자격장학 신청안내 …")과 안 맞아 못 찾는다.
   표식(#n-)에 든 제목이 원래 제목이고, boardTitle 필드가 있으면 그게 더 정확하다. */
function huntTitleOf(t) {
  /* 🔴 **부스러기를 떼고 쓴다** (2026-08-23). 게시판 행 글자를 그대로 담아 둔 값에는
     앞머리에 `공지 공지`·`2651` 같은 행 번호·분류 배지가 붙어 있다. 대조는 제목 **앞부분**을
     맞춰 보므로(아래 fingerprint의 `slice(0, 24)`), 앞머리가 어긋나면 뒤가 아무리 같아도
     통째로 빗나간다. 청소 규칙은 수집기와 **같은 모듈**을 쓴다 — 여기에 한 벌 더 두면
     "수집기는 같다는데 사냥꾼은 다르다"가 된다(clean-title.mjs 첫머리 참조).
     🔴 **뒤꼬리도 뗀다** (2026-10-03) — 게시판 행이 통째로 링크인 곳(항공대)은 제목 뒤에
     `학생지원팀 2026-09-02 1,076`(작성 부서·날짜·조회수)이 붙어 왔고, 그 꼬리 달린 제목으로 대조해
     멀쩡한 원문 3건이 '제목 불일치'로 목록 표식이 됐다. 떼는 규칙은 link-landing.mjs stripRowTail 한 곳. */
  const stored = stripRowTail(cleanTitle((t.ref.boardTitle || '').trim()));
  if (stored) return { title: stored, from: 'board' };
  const fromMarker = stripRowTail(cleanTitle(markerTitle(t.ref[t.field]) || ''));
  if (fromMarker) return { title: fromMarker, from: 'marker' };
  /* 🔴 마지막 폴백도 청소해서 돌려준다 (2026-08-29 코드 리뷰 지적).
     🔴 그리고 **어디서 왔는지 함께 돌려준다** (2026-10-03) — 정식 등록의 t.title 은 사람이 다듬은 앱 이름(r.name)이다.
     대조에는 써도 되지만 **게시판 원제목(boardTitle)으로 저장하면 안 된다**: 다음 실행이 그 이름으로 게시판 행을
     찾다가 영영 못 찾고(2026-08-01 미아 8건), 순찰 시절엔 그 이름과 상세 화면이 안 맞는다며 멀쩡한 링크를 덮어썼다.
     저장은 rememberBoardTitle 한 곳이 하고, 'name' 이면 게시판에서 실제로 본 행 글자를 대신 적는다. */
  return { title: stripRowTail(cleanTitle(String(t.title))), from: t.field === 'sourceUrl' ? 'name' : 'feed' };
}
function huntTitle(t) { return huntTitleOf(t).title; }

/* 게시판 원제목을 적어 둔다 — 비어 있을 때만, **게시판에서 온 글자만**.
   boardText = 게시판 목록·검색 결과에서 실제로 맞춘 행 글자(앱 이름이 아니다). */
function rememberBoardTitle(t, boardText) {
  if ((t.ref.boardTitle || '').trim()) return;
  const h = huntTitleOf(t);
  const text = h.from === 'name' ? (boardText || '') : h.title;
  const clean = cleanTitle(stripRowTail(text));
  if (clean) t.ref.boardTitle = clean;
}

/* 같은 사이트의 **다른 공고 제목** — '이 화면이 목록인가'를 가리는 재료 (2026-10-03 · 규칙은 detail-url.mjs 한 곳).
   🔴 빈 목록을 넘기면 목록 화면을 영영 못 알아본다(link-landing.mjs 원칙 ②) — 순찰이 그래서 목록 41건을 통과시켰다. */
function sameOriginTitles(url, exclude = []) {
  return otherTitlesOnSite(url, [...(notices.items || []), ...(registered.items || [])], { exclude, clean: stripRowTail });
}

const report0 = [];
if (heldByAdmin.length) report0.push(`- 관리자가 원문 주소를 넣은 공고 ${heldByAdmin.length}건은 건드리지 않았습니다(관리자 화면 「원문 링크」)`);

/* 되돌릴 때 쓸 '그 공고가 있던 게시판 목록 주소'를 찾는다.
   같은 호스트의 다른 공고가 이미 표식(#n-)을 달고 있으면 그 목록 주소를 쓰고,
   없으면 수집 설정(browser-targets.json·schools.json)에서 그 학교 게시판을 찾는다.
   못 찾으면 되돌리지 않는다 — 엉뚱한 목록으로 보내느니 그대로 두는 게 낫다. */
let BOARD_HINTS = [];
try {
  const bt = JSON.parse(fs.readFileSync(new URL('browser-targets.json', HERE), 'utf8'));
  BOARD_HINTS = BOARD_HINTS.concat((bt.targets || []).flatMap((t) => t.candidates || []));
} catch { /* 없으면 생략 */ }
try {
  const sc = JSON.parse(fs.readFileSync(new URL('schools.json', HERE), 'utf8'));
  BOARD_HINTS = BOARD_HINTS.concat((sc.schools || []).map((x) => x.boardUrl).filter(Boolean));
} catch { /* 없으면 생략 */ }

function boardListFor(t) {
  const url = String(t.ref[t.field] || '');
  let origin = '';
  try { origin = new URL(url).origin; } catch { return null; }
  /* 🔴 ① **수집 설정에 적힌 주소를 먼저 쓴다** (2026-08-21 — 순서를 바꾼 이유가 중요하다).
     예전엔 '같은 호스트의 다른 표식 공고가 쓰는 목록 주소'를 먼저 봤는데, 표식 공고들끼리는
     서로가 서로의 근거라 **다 같이 틀린 곳을 가리킬 수 있다.**
     중앙대가 정확히 그랬다: 표식 주소가 `index.do?MENU_ID=100`(전체 공지)이라 사냥꾼이
     그 탭만 뒤졌는데, 장학 공고는 **`P_TAB_NO=5`(장학 탭, 498건)** 에 있다. 전체 탭에서는
     수천 건 뒤로 밀려 14페이지 안에 없으니 매번 `목록에서 못 찾음`으로 떨어졌다 —
     11건이 그렇게 **사라진 공고로 오해**받고 있었다(`likelyGone`).
     수집 설정 값은 사람이 정찰로 확인해 넣은 것이라 유추보다 언제나 낫다. */
  const hint = BOARD_HINTS.find((h) => { try { return new URL(h).origin === origin; } catch { return false; } });
  if (hint) return hint;
  // ② 그래도 없으면 같은 호스트의 다른 공고가 쓰고 있는 목록 주소로 물러난다
  const mate = [...(notices.items || []), ...(registered.items || [])]
    .map((x) => x.url || x.sourceUrl || '')
    .find((u) => u.startsWith(origin) && isMarkerUrl(u));
  return mate ? listUrlOf(mate) : null;
}

/* 정식 등록 항목에 게시판 원래 제목이 없으면, 같은 글이 실시간 공고로도 수집돼 있는지 보고
   거기서 가져온다. 정식 등록의 name은 사람이 다듬은 이름이라 게시판 행과 안 맞기 때문.
   (제목이 없으면 그 공고는 게시판에서 영영 못 찾는 미아가 된다 — 2026-08-01에 15건이 그랬다) */
function backfillBoardTitles() {
  let n = 0;
  for (const t of targets) {
    if (t.field !== 'sourceUrl' || (t.ref.boardTitle || '').trim()) continue;
    const list = listUrlOf(t.ref[t.field]);
    const mate = (notices.items || []).find((x) => listUrlOf(x.url) === list && sameTitle(markerTitle(t.ref[t.field]) || t.title, x.title));
    /* 행 꼬리(작성 부서·날짜·조회수)는 떼고 담는다 (2026-10-03 — 꼬리 달린 원제목이 대조를 망쳤다) */
    if (mate) { t.ref.boardTitle = cleanTitle(stripRowTail(mate.title)); n += 1; }
  }
  return n;
}
const backfilled = backfillBoardTitles();
if (backfilled) report0.push(`- 게시판 원래 제목을 실시간 공고에서 보강: ${backfilled}건`);

/* 🔴 **미아를 따로 보고한다** (2026-08-21 개발자 지적: "얘 확실하게 수정 좀").
   게시판 원제목이 없으면 이 로봇은 그 공고를 **찾을 수가 없다** — 우리가 가진 것은
   사람이 다듬은 이름(`삼일장학회 희망/동행 장학생 (중앙대 접수)`)이고 게시판 제목은
   다른 글자(`2026학년도 2학기 삼일장학회 희망/동행 장학생 선발 공고`)이기 때문이다.
   그런데 리포트에는 다른 실패와 똑같이 `목록에서 못 찾음`으로 찍혀서, 중앙대 11건이
   **3주 동안 '게시판에서 내려간 공고'로 오해**받고 있었다(likelyGone까지 붙었다).
   원인이 다르면 다르게 적어야 고칠 수 있다 — 이건 로봇이 더 뒤져서 될 일이 아니라
   사람이 원제목을 채워 줘야 하는 일이다. */
const orphans = targets.filter((t) => t.field === 'sourceUrl' && !(t.ref.boardTitle || '').trim());
if (orphans.length) {
  report0.push(`- 🚨 **게시판 원제목이 없어 찾을 수 없는 공고 ${orphans.length}건** — 로봇이 더 뒤져도 안 됩니다.`);
  report0.push('  (우리가 가진 이름은 사람이 다듬은 것이라 게시판 행과 글자가 다릅니다.'
    + ' `data/registered.json`의 해당 항목에 `boardTitle`(게시판에 뜨는 제목 그대로)을 채워 주세요.)');
  orphans.slice(0, 12).forEach((t) => report0.push(`  - ${t.ref.id || ''} · ${String(t.title).slice(0, 50)}`));
}

/* ── 순찰 대상: **이미 주소가 있는 링크**도 다시 열어 본다 (2026-08-01 개발자 지적) ──
   이 로봇을 만든 목적은 '동국대 고치기'가 아니라 **원문 공고로 못 가는 링크를 계속 찾아
   고치는 것**이다. 그런데 표식(#n-)이 붙은 것만 집어 들고 있었다. 경희대처럼
   '주소는 멀쩡해 보이는데 눌러 보면 로그인 벽'인 경우는 표식이 없어 로봇 눈에 안 띄었다
   — 229건이 그렇게 사각지대에 있었다.
   그래서 순찰 단계를 앞에 뒀었다.
   🔴 2026-10-03 부터 순찰은 **판정만 적는다**(표식으로 되돌리지 않는다 — 아래 runPatrol 머리말). */
const patrol = [];
for (const n of notices.items || []) {
  if (n.url && !isMarkerUrl(n.url)) patrol.push({ ref: n, field: 'url', title: n.title, key: `n:${n.url}` });
}
for (const r of registered.items || []) {
  if (r.sourceUrl && !isMarkerUrl(r.sourceUrl)) patrol.push({ ref: r, field: 'sourceUrl', title: r.boardTitle || r.name, key: `r:${r.id}`, id: r.id });
}

/* 이미 포기한 건은 건너뛴다 (하지만 리포트에는 남긴다) */
const skipped = [];
const active = targets.filter((t) => {
  const st = state.items[t.key];
  // 영구 포기는 없다 — '아직 다시 볼 날이 안 된 것'만 이번 회차에서 쉰다
  if (st && st.nextTryAt && st.nextTryAt > today) { skipped.push({ t, st }); return false; }
  return true;
});

const boards = new Map();
for (const t of active) {
  /* 🔴 표식 주소가 가리키는 곳이 아니라 **수집 설정에 적힌 게시판**을 먼저 쓴다 (2026-08-21).
     중앙대 표식은 `index.do?MENU_ID=100`(전체 공지)이라 장학 공고가 수천 건 뒤로 밀린다.
     설정에는 정찰로 확인한 `P_TAB_NO=5`(장학 탭, 498건)가 있는데 1단계가 그걸 안 보고 있었다.
     (3단계는 이미 boardListFor를 쓰고 있었다 — 두 단계가 서로 다른 곳을 뒤지고 있던 셈이다.) */
  const list = boardListFor(t) || listUrlOf(t.ref[t.field]);
  if (ONLY && !list.includes(ONLY)) continue;
  if (!boards.has(list)) boards.set(list, []);
  boards.get(list).push(t);
}

const report = [`## 🎯 링크 사냥꾼 리포트 (${new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 16).replace('T', ' ')} KST)`, ''];
/* 쉬는 건은 포기가 아니다 — 실패가 쌓여 간격을 두고 다시 찾을 날을 기다리는 것이다(2026-10-04 · 이슈 #387 의 '포기 처리된 건'은 틀린 말이었다) */
report.push(`사냥 대상 **${active.length}건** (게시판 ${boards.size}곳) · 다음 시도 날을 기다리는 건 ${skipped.length}건`);
report0.forEach((l) => report.push(l));
report.push('');

/* CHROME_PATH가 있으면 그 브라우저를 쓴다 — 검증 드라이버와 같은 방식(2026-08-20).
   맥에서 세션을 여는 개발자도 이 로봇을 손으로 돌려 볼 수 있어야 한다. CI에서는 비어 있어
   playwright가 알아서 찾으므로 동작이 바뀌지 않는다. */
const browser = await chromium.launch({ args: ['--no-sandbox'],
  ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
const ctx = await browser.newContext({
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
  locale: 'ko-KR',
});

/* ── 확인: 로그인도 리퍼러도 없는 새 탭에서 진짜 그 공고가 열리는가 ── */
let verifyCtx = null;
async function freshPage() {
  if (!verifyCtx) {
    verifyCtx = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
      locale: 'ko-KR',
    });
  }
  await verifyCtx.clearCookies().catch(() => {});
  return verifyCtx.newPage();
}

/* 제목 정규화·목록 판정·로그인 벽은 **공용 판정 한 곳**(link-landing.mjs judgeLanding)을 그대로 쓴다.
   여기에 복사본을 두었다가 규칙이 갈라져 크게 손해를 봤다 (2026-08-01 날짜·조회수 지문 · 2026-10-03 로그인 상자·빈 목록).
   규칙은 한 곳에만 둔다 — 이 저장소가 entry-rules·url-key에서 이미 지키는 원칙이다. */

/* 화면에 제목이 그려질 때까지 기다릴 때 쓰는 조각.
   말머리([홍보]·공지)와 앞머리 번호를 떼야 상세 화면 본문과 맞는다 —
   안 떼면 매번 7초를 헛되이 기다린 뒤 판정으로 넘어간다. */
const probeOf = (title) => String(title || '')
  .replace(/^\s*\d{1,5}\s+/, '')
  .replace(/\[[^\]]{0,20}\]/g, '')
  .replace(/^\s*(공통|서울|글로벌|국제|공지|홍보|일반)\s+/g, '')
  .trim().slice(0, 12).trim();

/* 한 주소를 학생처럼(로그인·리퍼러 없는 새 탭) 열어 판정한다.
   titles = 이 공고의 제목 후보(게시판 원제목·행 글자·앱 이름) · others = 같은 게시판·사이트의 **다른** 공고 제목(목록 판정 재료).
   돌려주는 것: { ok(post 일 때만), v(판정), why, net(판정 불가 — 횟수에 안 센다) } */
async function verify(url, titles, others) {
  const want = [...new Set((Array.isArray(titles) ? titles : [titles]).map((x) => stripRowTail(x || '')).filter(Boolean))];
  const p = await freshPage();
  const out = (j) => ({ ok: j.v === 'post', v: j.v, why: j.why, net: j.v === 'unread' });
  try {
    let res = null;
    try {
      res = await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    } catch (e) {
      return out({ v: 'unread', why: `열기 실패: ${(e.message || String(e)).split('\n')[0].slice(0, 56)}` });
    }
    const status = res ? res.status() : 0;
    const probes = want.map(probeOf).filter((x) => x.length >= 4);
    if (probes.length && status && status < 400) {
      await p.waitForFunction((ns) => { const b = (document.body && document.body.innerText) || ''; return ns.some((n) => b.includes(n)); }, probes, { timeout: 7000 }).catch(() => {});
    }
    await p.waitForTimeout(700);
    const judge = async () => judgeLanding({ ...(await observeLanding(p, res)), requestedUrl: url, titles: want, otherTitles: others || [] });
    let j = await judge();
    /* ⭐ '못 읽은 것'을 '다른 글'이라고 부르지 않는다 (2026-08-01 동국대 12건 — 막혔을 때 오는 껍데기 화면을
       '다른 글'로 단정해 멀쩡한 주소를 버렸다). 늦게 그려지는 화면일 수 있으니 한 번 더 기다렸다 다시 본다.
       껍데기는 judgeLanding 이 'unread'(판정 불가)로 돌려준다 — 횟수에 세지 않는다. */
    if (j.v !== 'post' && j.v !== 'gone' && !(status >= 400)) {
      await p.waitForTimeout(4000);
      j = await judge();
    }
    return out(j);
  } finally {
    await p.close().catch(() => {});
  }
}

/* ── 목록 훑기 ── */
const ROW_SEL = 'a[href], [onclick]';
async function scrapeRows(page) {
  return page.$$eval(ROW_SEL, (els) => els.map((e, i) => ({
    i,
    t: (e.textContent || '').replace(/\s+/g, ' ').trim(),
    abs: e.tagName === 'A' ? (e.href || '') : '',
    src: [e.getAttribute('onclick') || '', e.getAttribute('href') || '', e.getAttribute('data-id') || ''].join('|'),
  })).filter((x) => x.t.length >= 6 && x.t.length <= 160)).catch(() => []);
}
async function scrapeForms(page) {
  return page.evaluate(() => [...document.querySelectorAll('form')].slice(0, 4).map((f) => ({
    action: f.getAttribute('action') || '',
    fields: [...f.querySelectorAll('input,select')].map((i) => `${i.name}=${i.value}`).filter((x) => !x.startsWith('=')).slice(0, 16).join('&'),
  }))).catch(() => []);
}
/* 다음 묶음 단추('다음'·'›'·'»'·'next')가 화면에 있나 — 쪽 번호가 10개씩 묶인 게시판은 11쪽 번호가 안 보여도 목록의 끝이 아니다 */
async function hasNextControl(page) {
  /* 마지막 쪽에서도 꺼진 '다음' 단추를 그대로 두는 게시판이 있다 — 그때도 '더 있을 수 있음'으로 본다(내려갔다고 잘못 말하지 않는 쪽) */
  return page.evaluate(() => [...document.querySelectorAll('a, button, [onclick]')].some((e) => {
    const txt = (e.textContent || '').replace(/\s+/g, ' ').trim();
    const meta = `${e.getAttribute('title') || ''} ${e.getAttribute('aria-label') || ''} ${typeof e.className === 'string' ? e.className : ''}`;
    if (/이전|prev|처음|first/i.test(`${txt} ${meta}`)) return false;
    return /^(다음|다음 ?페이지|다음 ?목록|다음 ?10|next|›|»|>|＞|>>|▶|▷)$/i.test(txt) || /next|다음/i.test(meta);
  })).catch(() => false);
}
async function gotoPage(page, n) {
  return page.evaluate((num) => {
    const cands = [...document.querySelectorAll('a, button, [onclick]')].filter((e) => (e.textContent || '').trim() === String(num));
    const el = cands.find((e) => /pag|page|num/i.test(e.className + ' ' + ((e.parentElement || {}).className || ''))) || cands[0];
    if (!el) return false;
    el.click();
    return true;
  }, n).catch(() => false);
}


/* ── 덤 · 순찰 — 🔴 **기록만 한다. 주소를 고치지 않는다** (2026-10-03) ─────────────────────────
   예전 순찰은 멀쩡해 보이는 링크를 다시 열어 '학생이 못 보는 링크'면 게시판 목록 표식(#n-)으로 **덮어썼다**.
   2026-10-03 하루에 그게 멀쩡한 원문 5건을 목록으로 바꿨다(항공대 scholnoti.php?…seq= 3건 · 건국대 artclView.do ·
   부경대 2432?action=view — 커밋 제목은 '원문 주소 0건 확보'). 원인 셋:
     ① 대조한 제목이 행 꼬리 달린 원제목이거나 사람이 다듬은 앱 이름이었다(그래서 '제목 불일치')
     ② 로그인 벽을 제목보다 먼저 봐서, 머리의 회원 로그인 상자 하나로 멀쩡한 공고가 '로그인 요구'가 됐다
     ③ 목록 판정에 다른 글 제목을 안 넘겨(`verify(url, title, [])`) 진짜 목록 41건은 오히려 통과시켰다
   판정하는 쪽이 고치기까지 하면 오판 한 번이 곧 데이터 손상이다(사본도 안 남겼다).
   그래서 '앱의 모든 링크를 새 탭으로 열어 보는 일'은 원문 링크 확인 로봇(collector/link-check.mjs)이 매일 하고,
   그 로봇도 **판정을 장부에만 적는다**(다른 날 두 번 같은 문제를 봐야 앱 글자가 바뀐다).
   이 순찰은 기본이 꺼짐이다. run-link-hunt.txt 의 `patrol: N` 으로 켜도 link-hunt.json 에 판정만 남긴다. */
const PATROL_PER_RUN = Number(process.env.HUNT_PATROL || runSetting('patrol') || 0);
const PATROL_OFF_NOTE = '순찰은 원문 링크 확인 로봇(link-check)이 맡는다 — 이 로봇은 주소를 고치지 않는다';
let patrolled = 0;
/* 순찰의 목록 판정 재료 — 그 게시판 목록을 한 번 열어 행 제목을 받아 둔다(게시판마다 한 번).
   우리 데이터의 같은 사이트 제목만으로는 목록 화면에 겹치는 것이 적어 목록을 '그 공고'로 기록한다
   (2026-10-03 로컬 게시판 시험: 아는 형제 제목 1개뿐이라 번호를 무시하고 목록을 주는 주소가 post 로 기록됐다). */
const liveRowsCache = new Map();
async function liveRowTitles(listUrl) {
  if (!listUrl) return [];
  if (liveRowsCache.has(listUrl)) return liveRowsCache.get(listUrl);
  const p = await freshPage();
  let titles = [];
  try {
    await p.goto(listUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await p.waitForTimeout(2500);
    titles = (await scrapeRows(p)).map((r) => stripRowTail(r.t)).filter((x) => x.length >= 8);
  } catch { /* 목록을 못 열면 데이터의 제목만 쓴다 */ } finally { await p.close().catch(() => {}); }
  liveRowsCache.set(listUrl, titles);
  return titles;
}
async function runPatrol() {
  if (!(PATROL_PER_RUN > 0) || outOfTime()) {
    report.push(`_(${PATROL_PER_RUN > 0 ? '순찰 생략 — 사냥에 시간을 다 썼습니다' : PATROL_OFF_NOTE})_`);
    report.push('');
    return;
  }
  report.push(`## 덤 · 순찰 (기록만 — ${PATROL_OFF_NOTE})`);
  const due = patrol
    .filter((t) => !ONLY || String(t.ref[t.field]).includes(ONLY))
    .sort((a, b) => {
      const A = (state.items[a.key] || {}).patrolledAt || '';
      const B = (state.items[b.key] || {}).patrolledAt || '';
      return A < B ? -1 : A > B ? 1 : 0;          // 오래 안 본 것 먼저
    })
    .slice(0, PATROL_PER_RUN);
  const tally = {};
  for (const t of due) {
    if (outOfTime()) { report.push('- (시간 상한 — 순찰 나머지는 다음 실행)'); break; }
    patrolled += 1;
    const titles = expectTitles(t.ref);
    const live = (await liveRowTitles(boardListFor(t))).filter((x) => !titles.some((w) => sameTitle(w, x))).slice(0, 60);
    const v = await verify(t.ref[t.field], titles, live.concat(sameOriginTitles(t.ref[t.field], titles)));
    const st = state.items[t.key] || {};
    st.patrolledAt = today;
    st.patrol = { v: v.v, why: v.why, at: today };   // 판정만 적는다 — t.ref 는 건드리지 않는다
    state.items[t.key] = st;
    tally[v.v] = (tally[v.v] || 0) + 1;
    if (!v.ok && !v.net) report.push(`  - (기록) ${v.v} · ${v.why}: ${String(t.title).slice(0, 44)}`);
    await new Promise((r) => setTimeout(r, 700));
  }
  report.push(`- 순찰 합계: ${patrolled}건 확인 · 판정 ${Object.entries(tally).map(([k, n]) => `${k} ${n}`).join(' · ') || '없음'} · **주소는 하나도 바꾸지 않았습니다**`);
  report.push('');
}

report.push('## 1단계 · 사냥 (원문 공고가 안 열리는 링크 고치기 — 본업)');

/* 장부 한 줄 고치기 — 규칙은 link-hunt-rules.mjs recordAttempt 한 곳.
   🔴 여기서 사람에게 알릴 건(stuck)을 세지 않는다 — 3단계가 같은 실행에서 찾아낼 수 있다(이슈 #387). 세는 곳은 3단계 뒤 한 곳.
   scan: '목록에서 못 찾음'일 때 목록을 끝까지 봤나('end') · 더 있을 수 있나('deep') — 'deep' 이면 '내려간 듯'으로 적지 않는다 */
function record(t, outcome, why, scan, opts = {}) {
  const st = state.items[t.key] || { attempts: 0, title: String(t.title).slice(0, 80) };
  state.items[t.key] = recordAttempt(st, outcome, why, { today, url: t.ref[t.field], scan, ...opts });
}

for (const [listUrl, group] of boards) {
  if (outOfTime()) { report.push('_(시간 상한 — 나머지 게시판은 다음 실행)_'); break; }
  report.push(`### ${listUrl}`);
  const page = await ctx.newPage();
  let opened = false; let openErr = '';
  for (let a = 0; a < 3 && !opened; a += 1) {
    try { await page.goto(listUrl, { waitUntil: a >= 2 ? 'commit' : 'domcontentloaded', timeout: a ? 45000 : 30000 }); opened = true; }
    catch (e) { openErr = (e.message || '').split('\n')[0].slice(0, 70); if (a === 2) report.push(`- ❌ 게시판 열기 실패: ${openErr}`); else await page.waitForTimeout(3000 * (a + 1)); }
  }
  if (!opened) {
    /* 게시판이 안 열리면 그 게시판 대상 전부를 내일로 미룬다(못 읽음 — 횟수에는 안 센다 · links-14). 안 적으면 실행마다 같은 게시판을 세 번씩 다시 두드린다 */
    for (const t of group) record(t, 'net', boardUnreachableWhy(openErr));   // 문구는 한 곳 — 관리자 「죽은 링크」에 안 걸리게(원인 단정 금지)
    report.push(`- ⏭ 이 게시판의 대상 ${group.length}건은 내일 다시 봅니다(횟수에는 안 셉니다)`);
    await page.close().catch(() => {}); report.push(''); continue;
  }
  await page.waitForTimeout(3500);
  const forms = await scrapeForms(page);

  /* 페이지를 넘기며, 각 페이지에서 '이 페이지에 있는 대상'을 그 자리에서 처리한다.
     (행 번호는 페이지를 넘기면 달라지므로, 찾은 페이지에서 바로 눌러야 한다) */
  const remaining = new Map(group.map((t) => [t.key, t]));
  /* 어디서 멈췄나 — '목록에서 못 찾음'이 '게시판에서 내려간 듯'의 근거가 되는 것은 목록 끝까지 봤을 때뿐이다(listScanEnd) */
  let stop = 'max-pages'; let nextControl = false;
  for (let pageNo = 1; pageNo <= MAX_PAGES && remaining.size; pageNo += 1) {
    if (outOfTime()) { stop = 'out-of-time'; break; }
    if (pageNo > 1) {
      const moved = await gotoPage(page, pageNo);
      if (!moved) { stop = 'no-next'; nextControl = await hasNextControl(page); break; }
      await page.waitForTimeout(3000);
    }
    let rows = await scrapeRows(page);
    if (!rows.length) { stop = 'no-rows'; break; }

    for (const t of [...remaining.values()]) {
      if (outOfTime()) break;
      const want = huntTitle(t);
      /* '이 화면이 목록인가'의 재료 — 이 게시판 목록의 다른 행 + 같은 사이트의 다른 공고 제목 (2026-10-03 · 빈 목록 금지) */
      const others = rows.map((r) => stripRowTail(r.t)).filter((x) => x && !sameTitle(want, x)).slice(0, 40)
        .concat(sameOriginTitles(listUrl, [want]));
      let idx = rows.findIndex((r) => rowMatchesTitle(want, r.t));   // 메뉴 조각을 행으로 뽑지 않는다(2026-10-03)
      /* 🔴 지문 대조가 빗나가면 **알맹이 낱말로 한 번 더** 본다 (2026-09-18).
         앱 이름은 사람이 다듬은 것이라 게시판 행과 글자가 달라 지문이 애초에 안 맞는다 —
         한국외대 6건이 이 이유로 4회 연속 '목록에서 못 찾음' 이 되어 likelyGone 처리됐다.
         규칙은 detail-url.mjs 의 rowByCore 한 곳이고, **딱 하나일 때만** 고른다
         (여럿이거나 캠퍼스가 어긋나면 지어내지 않고 넘긴다). */
      if (idx < 0) {
        const byCore = rowByCore(want, rows);
        if (byCore) {
          idx = rows.indexOf(byCore);
          report.push(`  · 알맹이 낱말로 찾음: ${String(byCore.t || '').slice(0, 48)}`);
        }
      }
      if (idx < 0) continue;                       // 이 페이지엔 없다 — 다음 페이지에서 찾는다
      remaining.delete(t.key);
      /* 게시판이 보여 준 그 행의 글자 — 제목 후보이자, 앱 이름밖에 없을 때 원제목으로 적을 글자(행 꼬리는 뗀다) */
      const rowText = stripRowTail(rows[idx].t);
      const titles = [want, rowText, ...expectTitles(t.ref)];

      let url = null; let lastWhy = ''; let lastV = '';
      /* ⭐ 1순위: 행을 실제로 눌러 브라우저가 간 주소를 받아 적는다 (짐작하지 않는다) */
      try {
        const els = await page.$$(ROW_SEL);
        const el = els[rows[idx].i];
        if (el) {
          const popupP = ctx.waitForEvent('page', { timeout: 4000 }).catch(() => null);
          const navP = page.waitForNavigation({ timeout: 8000 }).catch(() => null);
          /* 클릭이 막히는 게시판이 있다 (2026-08-01 동국대 — 정찰로 확인).
             동국대 목록에는 '디지털 역사관 … 오늘 하루 보지 않기 X' 팝업이 화면을 덮고 있어
             평범한 클릭이 5초를 기다리다 실패했다(진담거사 등이 이 이유로 떨어졌다).
             ① 먼저 팝업을 닫아 보고 ② 그래도 막히면 화면 위치를 따지지 않는 방식으로 누른다.
             (동국대 행은 href가 '#none'이라 '행에 적힌 주소'가 아예 없다 — 반드시 눌러야 한다.) */
          await page.evaluate(() => {
            const hit = [...document.querySelectorAll('a,button,span,div')].filter((e) => {
              const s = (e.textContent || '').trim();
              return s === 'X' || s === '닫기' || /오늘 하루 보지 않기/.test(s);
            });
            hit.slice(0, 6).forEach((e) => { try { e.click(); } catch { /* 무시 */ } });
          }).catch(() => {});
          try {
            await el.click({ timeout: 5000 });
          } catch {
            // 화면이 가려져 못 누르면 요소에게 직접 누르라고 시킨다 (위치를 따지지 않는다)
            await el.evaluate((e) => e.click());
          }
          const popup = await popupP;
          const detail = popup || page;
          if (popup) await popup.waitForLoadState('domcontentloaded').catch(() => {});
          else { await navP; await page.waitForTimeout(2500); }

          const landed = detail.url();
          const dom = await detail.evaluate(() => {
            const hidden = {};
            document.querySelectorAll('input[name]').forEach((i) => { if (i.name && i.value) hidden[i.name] = i.value; });
            const can = document.querySelector('link[rel=canonical]');
            const og = document.querySelector('meta[property="og:url"]');
            return { canonical: can ? can.getAttribute('href') : null, ogUrl: og ? og.getAttribute('content') : null, hiddenInputs: hidden };
          }).catch(() => ({ hiddenInputs: {} }));
          /* 후보 만들기는 **공용 규칙 한 곳**에서만 한다 (detail-url.mjs).
             예전엔 여기에 따로 적어 두었다가 '행에 적힌 주소'를 통째로 빠뜨렸고,
             그래서 동국대 12건이 전부 떨어졌다 — 규칙이 두 벌이면 반드시 갈라진다. */
          const cands = rowDetailCandidates({ row: rows[idx], listUrl, forms, landed, dom });
          for (const c of cands) {
            const v = await verify(c, titles, others);
            if (v.ok) { url = c; break; }
            lastWhy = v.why; lastV = v.v;
            report.push(`    · 탈락(${v.why}) ${c.slice(0, 96)}`);
            /* 404는 '이 주소가 틀렸다'는 뜻이므로 **다음 후보를 시도해야 한다**.
               멈춰야 하는 건 시간초과·연결끊김처럼 '학교 서버에 닿지 못하는' 상황뿐이다.
               예전엔 둘을 뭉뚱그려 404에서도 멈췄고, 그래서 첫 후보가 404면 정답일 수도 있는
               두 번째 후보(경로형)를 아예 안 열어 봤다 — 동국 5건이 이 이유로 실패했다. */
            if (v.net && !/^HTTP /.test(v.why)) break;
          }
          if (popup) await popup.close().catch(() => {});
        }
      } catch (e) {
        lastWhy = `클릭 실패: ${(e.message || '').split('\n')[0].slice(0, 40)}`;
      }
      // 목록으로 복귀 (다음 대상을 같은 페이지에서 계속 찾기 위해)
      if (page.url() !== listUrl) { await page.goto(listUrl, { waitUntil: 'domcontentloaded', timeout: 25000 }).catch(() => {}); await page.waitForTimeout(2000); }
      if (pageNo > 1) { for (let k = 2; k <= pageNo; k += 1) { if (!(await gotoPage(page, k))) break; await page.waitForTimeout(2500); } }
      rows = await scrapeRows(page);

      if (url) {
        if (!DRY) { t.ref[t.field] = url; rememberBoardTitle(t, rowText); }   // url 은 씻은 후보(rowDetailCandidates → cleanStoredUrl · links-7)
        found += 1;
        record(t, 'ok');
        report.push(`  - ✅ ${want.slice(0, 42)} → ${url.slice(0, 104)}`);
      } else {
        failedKeys.add(t.key);
        /* '못 읽음'으로 셀 것은 **학교 서버에 닿지 못한 경우만**이다.
           HTTP 404는 닿았는데 그 주소가 없다는 뜻이라 판정이 난 것이므로 횟수에 센다.
           안 그러면 404만 나는 공고는 시도 횟수가 영영 안 올라가 escalate가 되지 않고,
           매일 조용히 같은 실패를 반복한다 — '조용한 방치 불가' 설계가 무력해진다. */
        /* 판정 불가(unread — 망 오류·5xx·껍데기)도 횟수에 안 센다 — 공용 판정의 약속(link-landing.mjs) */
        const unreachable = lastV === 'unread' || /Timeout|ERR_|net::|클릭 실패/i.test(lastWhy);
        record(t, unreachable ? 'net' : 'bad', lastWhy || '주소를 못 만듦');
        report.push(`  - ⚠️ 실패(${lastWhy || '주소를 못 만듦'}): ${want.slice(0, 42)}`);
      }
      /* 학교 서버를 몰아치지 않는다. 900ms는 동국대에 너무 빨랐다 — 짧은 시간에 여러 번
         두드리자 응답이 막혀 껍데기 화면이 왔고, 로봇은 그걸 '다른 글'로 오해했다.
         대상이 몇 건뿐인 로봇이라 느려도 된다(25분 예산). */
      await new Promise((r) => setTimeout(r, 2500));
    }
  }
  /* 본 쪽에서 못 찾은 것 — 목록 끝까지 봤으면 '내려갔을 수 있다', 쪽수·시간 상한에서 멈췄으면 '더 뒤에 있을 수 있다'.
     🔴 (2026-10-04) 예전엔 어디서 멈췄든 3회면 likelyGone 을 붙였다 — 경희 7월 글 3건·가천 전체공지 글이 읽은 쪽 너머에 멀쩡히 있었다. */
  const scan = listScanEnd({ stop, nextControl });
  for (const t of remaining.values()) {
    /* 시간 상한으로 목록을 다 못 본 공고는 '못 찾음'이 아니라 '못 해 봄'이다 — 횟수에 세지 않는다(다음 실행이 다시 본다) */
    if (stop === 'out-of-time') { record(t, 'net', '시간 상한 — 목록을 다 못 봄', undefined, { defer: false }); report.push(`  - ⏱ 시간 상한 — 다음 실행에서: ${huntTitle(t).slice(0, 46)}`); continue; }
    failedKeys.add(t.key);
    record(t, 'bad', '목록에서 못 찾음', scan);
    const st = state.items[t.key];
    report.push(`  - ⚠️ 목록에서 못 찾음 (${st.attempts}회째 · ${scan === 'end' ? '목록 끝까지 봄' : '읽은 쪽 너머에 있을 수 있음'} · 계속 다시 찾습니다): ${huntTitle(t).slice(0, 46)}`);
  }
  await page.close().catch(() => {});
  report.push('');
}


/* ── 3단계 · 끈질기게 (2026-08-01 개발자 지시) ─────────────────────────────
   "다른 수집 로봇이 못 잡은 원문을 어떻게든 찾아서 올려둬라."

   1·2단계는 **그 공고가 기록된 게시판 한 곳**만 뒤진다. 그런데 공고가 거기 없을 수 있다:
   경희대가 그랬다 — 우리는 news.khu.ac.kr을 보는데 학생은 대학생활>장학에서 본다.
   그래서 여기서는 같은 학교의 **다른 게시판**과 **학교 사이트 검색**까지 동원한다.
   사람이 공고를 찾을 때 하는 행동 그대로다. */
const stillLost = [];
for (const [, group] of boards) {
  for (const t of group) {
    const st = state.items[t.key] || {};
    if (st.status === 'resolved') continue;
    if (isMarkerUrl(t.ref[t.field])) stillLost.push(t);
  }
}
let extraFound = 0;
const stage3Failed = new Set();   // 3단계까지 해 보고도 못 찾은 공고 — 사람에게 알릴 건은 여기서만 고른다(아래 settleEscalation)
if (stillLost.length && !outOfTime()) {
  report.push('## 3단계 · 끈질기게 (다른 게시판 · 학교 사이트 검색)');
  report.push(`- 아직 못 찾은 ${stillLost.length}건에 대해 다른 방법을 시도합니다`);

  /* 학교 사이트 검색창에 제목을 넣어 결과에서 그 공고를 찾는다 */
  async function siteSearch(origin, title) {
    const p = await freshPage();
    try {
      await p.goto(origin, { waitUntil: 'domcontentloaded', timeout: 25000 });
      await p.waitForTimeout(2000);
      const q = String(title).replace(/^\s*\d{1,5}\s+/, '').replace(/\[[^\]]{0,20}\]/g, '')
        .replace(/20\d{2}[.\-/]\d{1,2}[.\-/]\d{1,2}.*$/, '').trim().slice(0, 30);
      if (q.length < 6) return null;
      // 검색창 찾아 입력 (이름이 학교마다 달라 여러 후보를 본다)
      const typed = await p.evaluate((kw) => {
        const sel = 'input[type=search], input[name*=search i], input[name*=keyword i], input[name*=query i], input[name*=kwd i], input[id*=search i], input[placeholder*="검색"]';
        const el = [...document.querySelectorAll(sel)].find((e) => e.offsetParent !== null) || document.querySelector(sel);
        if (!el) return false;
        el.focus(); el.value = kw;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        return true;
      }, q).catch(() => false);
      if (!typed) return null;
      await p.keyboard.press('Enter').catch(() => {});
      await p.waitForTimeout(4000);
      // 결과 화면에서 제목이 맞는 링크를 고른다
      const hit = await p.evaluate(() => [...document.querySelectorAll('a[href]')].map((a) => ({
        t: (a.textContent || '').replace(/\s+/g, ' ').trim(), u: a.href,
      })).filter((x) => x.t.length >= 8), []).catch(() => []);
      const match = (hit || []).find((x) => rowMatchesTitle(title, x.t) && /^https?:/.test(x.u));
      /* 결과 화면의 다른 글 제목도 돌려준다 — 고른 주소가 목록·검색 화면인지 가리는 재료(빈 목록 금지 · 2026-10-03) */
      return match ? { u: match.u, t: match.t, others: hit.map((x) => stripRowTail(x.t)).filter((x) => x && !sameTitle(title, x)).slice(0, 40) } : null;
    } catch { return null; } finally { await p.close().catch(() => {}); }
  }

  for (const t of stillLost) {
    if (outOfTime()) { report.push('- (시간 상한 — 나머지는 다음 실행)'); break; }
    const want = huntTitle(t);
    let origin = '';
    try { origin = new URL(t.ref[t.field]).origin; } catch { /* 무시 */ }
    const others = [];
    // ① 같은 학교의 다른 게시판 후보
    for (const h of BOARD_HINTS) {
      try { if (new URL(h).origin === origin && listUrlOf(t.ref[t.field]) !== h) others.push(h); } catch { /* skip */ }
    }
    let got = null; let gotText = ''; const tried = [];
    const siteOthers = sameOriginTitles(t.ref[t.field], [want]);   // 같은 사이트의 다른 공고 제목 — 목록 판정 재료
    for (const board of others.slice(0, 3)) {
      if (outOfTime()) break;
      tried.push(board);
      const p = await freshPage();
      try {
        await p.goto(board, { waitUntil: 'domcontentloaded', timeout: 25000 });
        await p.waitForTimeout(3000);
        const rows = await p.$$eval('a[href]', (els) => els.map((e) => ({
          t: (e.textContent || '').replace(/\s+/g, ' ').trim(), u: e.href,
        })).filter((x) => x.t.length >= 8)).catch(() => []);
        const row = rows.find((r) => rowMatchesTitle(want, r.t) && isDetailUrl(r.u, board));
        if (row) {
          /* 🔴 다른 글 제목을 넘긴다 — 예전엔 `verify(row.u, want, [])` 라 목록 화면도 통과했다 (2026-10-03) */
          const boardOthers = rows.map((r) => stripRowTail(r.t)).filter((x) => x && !sameTitle(want, x)).slice(0, 40);
          const cu = cleanStoredUrl(row.u);   // 학생이 열 주소(세션 표식 뗀 것)로 확인하고 그대로 담는다 (links-7)
          const v = await verify(cu, [want, row.t, ...expectTitles(t.ref)], boardOthers.concat(siteOthers));
          if (v.ok) { got = cu; gotText = row.t; }
        }
      } catch { /* 다음 후보 */ } finally { await p.close().catch(() => {}); }
      if (got) break;
    }
    // ② 학교 사이트 검색
    if (!got && origin && !outOfTime()) {
      tried.push(`${origin} (사이트 검색)`);
      const hit = await siteSearch(origin, want);
      if (hit) {
        const cu = cleanStoredUrl(hit.u);
        const v = await verify(cu, [want, hit.t, ...expectTitles(t.ref)], hit.others.concat(siteOthers));
        if (v.ok) { got = cu; gotText = hit.t; }
      }
    }
    if (got) {
      if (!DRY) { t.ref[t.field] = got; rememberBoardTitle(t, gotText); }   // got 은 씻어서 확인한 주소(위 cu · links-7)
      extraFound += 1; found += 1;
      failedKeys.delete(t.key);   // 1단계에서 못 찾음으로 센 것을 거둔다(links-2)
      record(t, 'ok');
      report.push(`  - ✅ 다른 경로에서 찾음: ${want.slice(0, 40)} → ${got.slice(0, 100)}`);
    } else {
      stage3Failed.add(t.key);
      report.push(`  - ⚠️ 다른 경로에서도 못 찾음 (${tried.length}곳 시도): ${want.slice(0, 40)}`);
    }
    await new Promise((r) => setTimeout(r, 900));
  }
  report.push(`- 3단계 추가 확보: ${extraFound}건`);
  report.push('');
}

/* 사람에게 알릴 건 — **3단계까지 해 보고도 못 찾은 것**만, 실패가 ESCALATE_AT 회 쌓였을 때 한 번 (2026-10-04 · 이슈 #387).
   예전엔 1단계가 세 번째 실패를 적는 순간 셌다 — 같은 실행의 3단계가 그 공고를 찾아냈는데도 '3회 못 찾은 공고 1건' 이슈가 열렸다.
   시간이 모자라 3단계를 못 해 본 공고는 이번에 세지 않는다(다음 실행이 3단계까지 해 보고 센다). */
for (const t of stillLost) {
  if (stage3Failed.has(t.key) && settleEscalation(state.items[t.key])) {
    stuck += 1;
    const st = state.items[t.key] || {};
    escalatedNow.push({ title: huntTitle(t), key: t.key, attempts: st.attempts, lastWhy: st.lastWhy, likelyGone: st.likelyGone });
  }
}

/* 저장·리포트를 한 곳에 모아 둔다 — 정상 종료도, 넘어졌을 때도 **같은 길로** 저장한다.
   (위 onCrash가 이 함수를 부른다. 그래서 중간에 넘어져도 찾아낸 주소는 살아남는다.) */
function saveAll(crashNote) {
  state.updatedAt = today;
  if (!DRY) {
    /* 데이터를 바꾸는 것은 **사냥이 찾아 확인한 주소(found)뿐**이다 (2026-10-03).
       예전엔 순찰이 되돌린 것(demoted)도 여기서 저장했다 — 순찰이 더는 주소를 고치지 않으므로 그 갈래는 없다. */
    if (found) {
      /* 🔴 사냥 결과를 저장하기 전에 중복을 합친다 — 안 하면 감사가 이 실행의 결과를
         통째로 되돌린다(위 import 주석의 2026-09-03 사고). 표식이 진짜 주소로 풀리면서
         비로소 같은 글이 되는 것이라, 수집 때는 없던 중복이 여기서 처음 생긴다. */
      const before = notices.items.length;
      notices.items = dedupeNotices(notices.items);
      if (notices.items.length !== before) {
        report.push(`_(중복 ${before - notices.items.length}건을 합쳤습니다 — 표식이 진짜 주소로 풀리며 같은 글이 된 것)_`);
        report.push('');
      }
      fs.writeFileSync(noticesPath, JSON.stringify(notices, null, 1));
      /* 🔴 여기서 멈추면 고친 주소가 **다음 수집까지 학생 화면에 안 닿는다** —
         앱은 data/notices.json 이 아니라 data/notices/<학교>.json 을 읽는다. */
      const patched = patchUrlsBySchool(notices.items);
      if (patched.fixed) {
        report.push(`_(학교별 공고 파일 ${patched.files}개에서 주소 ${patched.fixed}건을 함께 고쳤습니다 — 앱이 읽는 것은 이쪽입니다)_`);
        report.push('');
      }
      fs.writeFileSync(registeredPath, JSON.stringify(registered, null, 1));
    }
    /* 장부 정리 — 데이터에 없는 공고·꺼진 순찰의 흔적을 걷는다(규칙은 link-hunt-rules.mjs pruneHuntState · links-9). 고친 주소가 반영된 뒤의 데이터로 잰다 */
    const liveKeys = new Set([...(notices.items || []).map((n) => `n:${n.url}`), ...(registered.items || []).map((r) => `r:${r.id}`)]);
    const beforeKeys = Object.keys(state.items || {}).length;
    /* 순찰 설정은 아래(runPatrol 앞)에서 읽는다 — 그 전에 넘어져 여기 오면 아직 못 읽으므로 켜진 것으로 보고 순찰 흔적을 남긴다 */
    let patrolOn = true;
    try { patrolOn = PATROL_PER_RUN > 0; } catch { /* 설정 읽기 전에 넘어짐 */ }
    state.items = pruneHuntState(state.items, liveKeys, today, 30, { patrolOn });
    prunedKeys = beforeKeys - Object.keys(state.items).length;
    fs.writeFileSync(statePath, JSON.stringify(state, null, 1));
  }

  if (skipped.length) {
    report.push('### 이번 회차는 쉬는 건 (간격을 두고 다시 시도합니다)');
    skipped.forEach(({ t, st }) => report.push(`- ⏳ ${st.nextTryAt} 에 다시 시도 (${st.attempts || 0}회 실패${st.likelyGone ? ' · 게시판에서 내려간 듯' : ''}) — ${String(t.title).slice(0, 44)} (${st.lastWhy || ''})`));
    report.push('');
  }
  if (prunedKeys > 0) { report.push(`_(장부 정리: ${prunedKeys}건 걷어 냄 — 데이터에 없는 공고·꺼진 순찰의 흔적)_`); report.push(''); }
  report.push('---');
  if (crashNote) {
    report.push(`🚨 **로봇이 도중에 넘어졌습니다** — 여기까지 찾은 것은 저장했습니다. 넘어진 자리: \`${crashNote}\``);
    report.push('');
  }
  report.push(`원문 주소 확보 **${found}건** · 아직 못 찾음 ${failedKeys.size}건 · 사람에게 알릴 건 ${stuck}건${DRY ? ' — 모의 실행' : ''}`);
  /* 이번에 처음 알리는 공고는 머리말 바로 뒤에 — 이슈 본문(리포트 전체)의 첫 화면에서 어느 공고인지 보이게(links-2 · #387) */
  report.splice(2, 0, ...escalationLines(escalatedNow));
  report.push('');
  report.push('**포기하는 건 없습니다** — 못 찾은 공고는 간격을 늘려 가며(1일→3일→7일→14일→30일) 계속 다시 찾습니다.');
  report.push('');
  report.push('실패해도 앱은 지어내지 않습니다 — 원문 주소를 못 찾은 공고는 "게시판 목록 ↗"으로 정직하게 안내합니다.');
  fs.writeFileSync(new URL('link-hunt-report.md', HERE), report.join('\n'));
  console.log(report.join('\n'));
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `found=${found}\nfailed=${failedKeys.size}\nstuck=${stuck}\n`);
  }
}

/* 본업(사냥)이 끝났다. 순찰은 기본이 꺼짐이고, 켜도 판정만 link-hunt.json 에 적는다(주소를 고치지 않는다 · 2026-10-03). */
report.push('');
await runPatrol();

await verifyCtx?.close().catch(() => {});
await browser.close();
saveAll(null);

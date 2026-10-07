# 수리 명세 — 묶음 ops

권장 순서: ops-09 → gaps-04 → ops-12 → gaps-05 → ops-10 → ops-11 → links-16 → ops-14
예상 손댈 파일: verify/check-deploy-sync.js .claude/skills/session-check/SKILL.md tools/robot-run.sh tools/data-robots.mjs tools/notion-status.mjs tools/notion-branch.mjs collector/probe-lines.mjs collector/probe-links.mjs .github/workflows/probe-links.yml collector/run-probe.txt collector/robot-heartbeat.mjs .github/workflows/robot-heartbeat.yml verify/health-gates/ops.mjs verify/health-gates.mjs .github/workflows/probe-boards.yml collector/probe.mjs collector/probe-candidates.json _admin/admin.js .github/workflows/main-guard.yml .github/workflows/device-deploy.yml .github/workflows/verify-ui.yml

검증 메모: 결과: 8건 가운데 confirmed 6건(ops-09 P2 · ops-10·ops-11·ops-12·gaps-04·gaps-05·ops-14 P3), needs-human 1건(links-16). 범위를 고친 것 셋:
- ops-10: P2 → P3. 수집→배포는 이미 workflow_run 사슬이다.
- ops-11: 이벤트로 거르라는 처방은 반박하고, 브랜치 구멍만 인정했다.
- gaps-04: '인스타 게시'는 대상이 아니다.

먼저 할 일
- 작업본 46f08990 은 지금(11:06Z) 기본 브랜치 4ba7da49 보다 뒤처져 있다. 수리 전에 origin/claude/nice-heisenberg-WESq5 를 병합한다.
- 다른 세션 브랜치(claude/source-link-integrity)는 거의 기본 브랜치에 합쳐졌다. 남은 차이는 data/ 와 style.css 뿐이라 이 묶음 파일과 충돌하지 않는다.

파일 공유와 순서
- verify/health-gates.mjs 의 PARTS 에 'ops' 를 더해야 ops.mjs 가 불린다. 모든 묶음이 같은 줄을 고치므로 오케스트레이터가 한 번에 합친다.
- collector/robot-heartbeat.mjs 는 bodies(bodies-2)·refresh(gaps-06)·admin(admin-F5) 묶음도 손댈 수 있으니 순차로 처리한다.
- check-live 의 배포 직후 헛경보(#350 열림 · #310·#384)는 ops-10 의 증거지만 수리는 alerts 묶음 ops-04 몫이다. check-live.yml 은 이 묶음에서 건드리지 않는다.
- ops-14 는 워크플로 파일 거의 전부를 건드린다. 모든 묶음이 병합된 뒤 마지막 한 커밋으로 하고, filesTouched 에는 진단이 적은 4개만 넣었다.

관문 운용
- ops.mjs 의 코드 위생 대조(⑤ robot-run 대조 · ⑥ yml 대조 · ⑦ 액션 판)는 test-collector 의 DOC_GATES 와 같은 조건(로컬·verify-ui 에서만)으로 잰다. 수집 로봇의 데이터 관문에서 빨개지면 자동 등록분이 되돌려지기 때문이다.
- 표본 기반 동작 검사(①②③④⑥ 의 순수 함수)는 늘 잰다.
- 임시 git 저장소를 쓰는 관문(①④)은 자식 env 에서 GIT_DIR·GIT_WORK_TREE·GIT_INDEX_FILE 을 지운다.

기록과 정리
- 이 묶음의 기록(예약 지연 실측표)은 SESSIONS.md 에 둔다. CLAUDE.md 는 숫자 없이 규칙 한 줄만 둘 수 있으며, 마지막 문서 단계에서 한 번에 고친다.
- 검증 중 만든 임시 저장소는 scratchpad/verify-ops/fx 에만 있다. 저장소 작업본과 워크트리는 건드리지 않았다.


---
## [ops-09] P2 · confirmed

이유: 지금 다시 재 봤다. 작업본 46f08990 은 origin/main 4ba7da49 보다 뒤처져 있다. 앞선 것은 관문 틀 커밋 둘뿐이고 앱 파일이 아니다. 그런데 verify/check-deploy-sync.js:99 의 두 점 `git diff --stat origin/main..HEAD -- 앱 경로` 는 style.css·sw.js 등 9개 파일을 내놓는다. 세 점 `origin/main...HEAD` 는 빈 값이다. 그래서 ❌ 와 exit 1 이 난다. 임시 저장소로도 재현했다(scratchpad/verify-ops/fx). ⓐ main 만 style.css 를 바꾼 '뒤처짐만' 상태 → exit 1 이 나고 'git push origin HEAD:main' 을 권한다(실제로 하면 거절된다). ⓑ 내 쪽이 assets/schools/photos.json 만 바꾼 '앞섬' 상태 → exit 0 '✅ main과 같음'(거짓 초록). 앱은 app.js:1158 의 assets/gates/gates.json 과 app.js:3298·6153 의 assets/schools/photos.json 을 받는데 :81 고정 목록에 'assets' 가 없다. 배포 동기화 로봇이 main 을 하루 수십 번 병합해 움직이므로, 세션 점검 2단계(session-check SKILL.md)는 거의 늘 거짓 ❌ 를 낸다 → 사람이 경고를 무시하게 된다. 더 새 커밋이 고친 흔적은 없다. 이 파일은 다른 세션의 목록에도 없다.

수리 명세: verify/check-deploy-sync.js:
① APP_PATHS 의 fixed 에 'assets' 를 더한다.
② diff 앞에 `git merge-base origin/main HEAD` 를 본다. 없으면(얕은 클론) '⚠️ 공통 조상을 못 찾아 비교 못 함 — git fetch --unshallow' 를 출력하고 exit 0 으로 끝낸다. 이때 '✅ 같음' 이라고 쓰지 않는다.
③ diff 는 세 점 `git diff --stat origin/main...HEAD -- APP_PATHS` 로 바꾼다(= 갈라진 뒤 내 쪽에만 있는 앱 변경). ahead = rev-list --count origin/main..HEAD, behind = HEAD..origin/main.
④ diff 가 비었으면 ✅ 를 내고, behind>0 이면 '(참고) main 에만 있는 커밋 n개 — 앱은 이미 그 내용을 보여 준다 · 작업본을 맞추려면 git merge origin/main' 을 덧붙인다. exit 0.
⑤ diff 가 있으면 ❌ 와 목록을 낸다. 건수 표(:115~130)는 origin/main 이 아니라 merge-base 판 → 작업본으로 비교하고 이름을 '내 작업이 바꾼 건수'로 한다. 갈라진 경우 로봇이 main 에 더한 공고 수가 섞이지 않게 하려는 것이다.
⑥ 해결 안내: behind>0 이면 먼저 'git fetch origin && git merge origin/main' 을 적는다. 그다음 CLAUDE.md 「브랜치 · 배포」 대로 작업 브랜치·기본 브랜치·main 세 곳에 push 하라고 적는다(휴대폰·웹 세션은 deploy/run-deploy.txt 의 branch: 줄). 'git push origin HEAD:main' 하나만 권하지 않는다 — 기본 브랜치를 건너뛰고 main 에만 올리지 말 것.
⑦ 종료 코드의 뜻(0 = 내 쪽에만 있는 앱 변경 없음, 1 = 있음)은 그대로 둔다.
바꾸지 말 것: 위쪽의 COLLECTORS 감시(main 직접 저장)와 deploy-sync workflows 목록 감시(`git add data/` 전부 · 2026-09-26 규칙), index.html·sw.js 에서 스크립트 목록을 읽는 방식(2026-09-29 규칙).
.claude/skills/session-check/SKILL.md 2단계 문장: '❌ 는 내 쪽에만 있고 main 에 없는 앱 파일 변경만 뜻한다 · main 이 앞선 것은 (참고)로만 나온다'.

관문: verify/health-gates/ops.mjs ①: os.tmpdir() 에 임시 git 저장소를 만든다. 브랜치는 work, 커밋은 `-c user.name -c user.email` 로 하고, 자식 env 에서 GIT_DIR·GIT_WORK_TREE·GIT_INDEX_FILE 을 지운다(훅 안에서 돌 때 진짜 저장소를 건드리지 않게). refs/remotes/origin/main 은 update-ref 로 세우고, `node <ctx.root>/verify/check-deploy-sync.js` 를 cwd=임시 저장소로 spawnSync 한다. origin 원격이 없어 fetch 는 조용히 실패한다.
(a) main 쪽만 style.css 변경(뒤처짐만) → status 0, 출력에 '참고'.
(b) 내 쪽만 assets/schools/photos.json 변경 → status 1, 출력에 그 경로.
(c) 갈라짐 — main 은 style.css, 내 쪽은 data/x.json → status 1, 출력에 data/x.json 은 있고 style.css 는 없다.
(d) 출력 어느 줄도 'git push origin HEAD:main' 하나만 권하지 않는다.
red: 세 점을 두 점으로 되돌리면 (a)(c) 가, 'assets' 를 빼면 (b) 가 빨개진다. 실데이터는 안 읽는다.

소급: 없음 — 데이터가 아닌 도구다.

파일: verify/check-deploy-sync.js .claude/skills/session-check/SKILL.md

위험: 낮음. 세션 점검의 출력 문구만 바뀐다. 관문이 git 을 부르지만 test-collector 의 노션 관문이 이미 같은 방식이라 CI 에 git 이 있다. 다른 세션 파일 목록과 겹치지 않는다.

---
## [ops-10] P3 · confirmed

이유: 현상은 사실이다. event=schedule 실행의 생성 시각을 gh api 로 다시 잤다. robot-heartbeat 는 08:29Z 예약인데 12:15~16:51Z 에 돈다. check-live 04:11Z → 08:35~10:52Z. deploy-sync 03:23Z → 08:36~10:00Z, 07:23Z → 12:17~15:40Z. collect-scholarships 02:41Z → 08:33~09:02Z, 06:41Z → 11:59~13:51Z. insta-comments(3시간마다)는 09-12 이후 91회로 하루 약 4회다(8회 예정). 최대 간격은 9.7시간(10-01 00:40Z→10:21Z)으로 하트비트 문턱 9시간을 넘는다. 원인은 플랫폼 쪽이라 저장소가 줄일 수 없다.
그러나 P2 는 과하다. 수집→배포는 이미 workflow_run 사슬이라 시각이 늦어도 데이터 흐름은 안 깨진다. 실제 피해는 둘이다. ① 시각표 전제가 깨진 라이브 점검이 배포 직후에 돌아 헛경보를 냈다 — #310·#384 는 사람이 닫았고 #350 은 열려 있다. run 36851872513 을 보면 deploy-sync push 가 10:51:59Z, 점검이 10:52:56Z, Pages 의 last-modified 가 10:49:21 이다. 이것은 alerts 묶음 ops-04(check-live.yml)가 고친다. ② 3시간 로봇의 하트비트 문턱(9h)이 관측 간격보다 짧아, 하트비트가 그 틈에 돌면 헛경보가 난다. 이 묶음이 고칠 것은 ② 와 기록뿐이다.

수리 명세: collector/robot-heartbeat.mjs: `export const STALE_MIN_HOURS = 12;` 를 더하고 `export function staleAfterHours(h) { return h == null ? null : Math.max(h * STALE_FACTOR, STALE_MIN_HOURS); }` 를 만든다. isStale 은 `age > staleAfterHours(everyHours)` 로 바꾼다. 주석에 근거를 적는다(3시간 로봇의 실측 최대 간격 9.7h · 91회/22일 · 2026-10-04).
머리줄 문구는 '문턱 = 기대 간격 × 3 (최소 12시간)'. robot-heartbeat.yml 의 이슈 본문은 '예정보다 3배(최소 12시간) 넘게'.
바꾸지 말 것: 3배 규칙, 경보 전 두 번째 길(recentSuccessAt·newerIso — 이슈 #316 수리), 조회 실패를 멈춤으로 단정하지 않는 규칙.
기록: SESSIONS.md 에 '예약 지연 실측 (2026-10-04)' 절 하나를 둔다(위 숫자 그대로). CLAUDE.md 에는 숫자 없이 한 줄만 둘 수 있다: '예약 시각은 목표일 뿐 수 시간 늦고 일부는 걸러진다 — 순서가 필요한 일은 workflow_run 으로 잇고, 확인 로봇은 배포 완료를 기다린다'. 문서 관문이 백틱 이름을 재므로 실재하는 이름만 쓴다.
워크플로마다 적힌 KST 주석은 고치지 않는다 — 다른 묶음과 충돌하고 사본은 낡는다. check-live 의 경합은 ops-04 몫이다(같은 파일을 두 묶음이 고치지 말 것).
사람 결정(선택): 외부 깨우미(cron-job.org → workflow_dispatch) 도입은 권장하지 않는다 — 열쇠 관리만 늘고 실제 피해는 위 둘로 덮인다.

관문: ops.mjs ②: now 를 고정한다. isStale(3, now-10h) === false, isStale(3, now-13h) === true, isStale(24, now-71h) === false, isStale(24, now-73h) === true, staleAfterHours(null) === null. red: 바닥값(STALE_MIN_HOURS)을 빼면 첫 줄이 true 가 되어 빨개진다. test-collector 「하트비트 간격 계산」 의 기존 표본은 24h 기준이라 영향이 없다.

소급: 없음. 열린 경보 #385 는 rescue-bodies 건이라 이 수리와 무관하다.

파일: collector/robot-heartbeat.mjs .github/workflows/robot-heartbeat.yml

위험: robot-heartbeat.mjs 는 bodies(bodies-2: 단계 결과 보기)·refresh(gaps-06: 예약 없는 로봇 180일)·admin(admin-F5: 열쇠 만료) 묶음도 손댈 수 있다. 같은 파일이므로 순차로 처리한다. ops-11 과는 한 커밋에 넣는다.

---
## [ops-11] P3 · confirmed

이유: 범위를 좁혀 인정한다. 코드는 진단대로다(robot-heartbeat.mjs:116~126 `status=success&per_page=1` · 이벤트·브랜치 거름 없음).
그러나 '이벤트로 걸러라'는 처방은 반박한다. push·workflow_run·수동 실행도 같은 일을 한다. 예약 로봇의 push 트리거는 전부 기본 브랜치로 좁혀져 있고, main-guard 만 설계상 main push 다. 지금 각 로봇의 마지막 성공도 전부 기본 브랜치이거나 main-guard 의 main 이다(오늘 재측정). 오히려 event=schedule 로 거르면 헛경보가 난다. 원문 링크 확인 로봇(link-check)은 예약 성공이 0건이고(10-04 11:06Z 기준 push 성공 3건) 바로 '성공 기록 없음' 경보가 선다. essay-playbook 는 09-29 예약 실패 뒤 10-01 수동 성공뿐이다.
남는 진짜 구멍은 브랜치다. 옛 워크플로 파일(branches 거름 없음)이 남은 작업 브랜치의 push 실행도 성공으로 센다. 실례: resolve-detail-urls 가 10-03 11:10Z claude/source-link-integrity 에서 push 로 성공했다(run 37118783324). 그 실행은 기본 브랜치의 일을 하지 않았다(CLAUDE.md: 로봇은 기본 브랜치에만 저장).

수리 명세: robot-heartbeat.mjs:
① `export const BASE_BRANCH = 'claude/nice-heisenberg-WESq5'` 를 둔다.
② lastSuccessAt 의 주소에 `&branch=${encodeURIComponent(BASE_BRANCH)}` 를 더한다.
③ latestSuccessIso(runs, opts) 에 선택 인자 `{ branches }` 를 둔다. 주어지면 head_branch 가 그 안에 있는 실행만 센다. 인자가 없으면 지금 동작 그대로다 — test-collector 「하트비트 간격 계산」 의 기존 표본에는 head_branch 가 없어서 깨지면 안 된다.
④ recentSuccessAt 은 `latestSuccessIso(runs, { branches: [BASE_BRANCH, 'main'] })` 로 부른다. main-guard 의 main push 와 main 에서 수동 실행한 check-live 는 같은 일을 하기 때문이다.
이벤트로는 거르지 않는다(위 근거). 행에 출처 칸을 더하지 않는다(출력 모양 유지).

관문: ops.mjs ③: 표본 runs 셋 — 작업 브랜치 성공(가장 늦음), 기본 브랜치 성공, main 성공. latestSuccessIso(runs, {branches:[BASE_BRANCH,'main']}) 가 작업 브랜치 것을 고르지 않는다. 인자 없이 부르면 옛 동작대로 가장 늦은 것을 고른다. 코드 대조: lastSuccessAt 의 주소 줄에 `branch=` 가 있다. red: branches 거름을 빼면 첫 줄이 빨개진다.

소급: 없음.

파일: collector/robot-heartbeat.mjs

위험: 낮음. 기본 브랜치에서 예약이 걸러졌는데 다른 길(push·workflow_run)로 돌았다면 지금처럼 조용하다 — 그건 의도다. ops-10 과 같은 파일이므로 한 커밋으로, 다른 묶음과는 순차로 처리한다.

---
## [ops-12] P3 · confirmed

이유: update-progress 최근 60회를 다시 봤다. 세 브랜치에 push 할 때마다 사람별 대기줄(update-progress.yml:51~53 `group: notion-status-${{ github.actor }}` · cancel-in-progress)에서 마지막에 줄 선 실행만 남는다. 그게 대개 main 이다(784·796·812·823·833 — run 37195416776 로그 '✓ 이선주 — main'). 가끔은 기본 브랜치다(790·809). notion-status.mjs:113 이 GITHUB_REF_NAME 을 읽어 :254 '브랜치' 칸에 그대로 쓴다.
재시도 없음도 사실이다. run 36856161345(10-01 11:34Z)가 노션 500 'Cross-cell memcached access is not allowed' 한 번에 exit 1 로 끝났다. 840회 중 1회라 영향은 작다. 다른 세션 목록과 겹치지 않는다.

수리 명세: 새 순수 모듈 tools/notion-branch.mjs 에 셋을 둔다.
① `branchLabel({ ref, pointsAt, base })`. pointsAt 은 HEAD 를 가리키는 원격 브랜치 이름이다(origin/ 을 떼고 HEAD 는 뺀다 · 못 읽었으면 null).
  · ref 가 'main'·base 가 아니면 ref 그대로.
  · 아니면 pointsAt 중 main·base 가 아닌 것을 이름순 첫째로 고른다(결정적이어야 어느 실행이 살아남든 같은 값을 쓴다).
  · 그것이 없고 pointsAt 에 base 가 있으면 base, 아니면 ref.
  · pointsAt 이 null 이면 null — 칸을 쓰지 않는다(빈 값·추측으로 덮지 않는다 · 원칙 8-1).
② `retryable(status)` = 429 또는 5xx.
③ `patchWithRetry(fetchFn, url, init, waits = [3000, 8000])`: 네트워크 예외나 재시도할 상태면 쉬고 다시 보낸다. 마지막 응답·예외는 그대로 돌려준다.
notion-status.mjs:
· pointsAt 은 `git for-each-ref --points-at HEAD --format=%(refname:short) refs/remotes/origin` 로 읽는다(기존 sh 로 · 실패는 null).
· props['브랜치'] 는 label 이 있을 때만 넣는다.
· fetch 는 patchWithRetry 로 바꾼다. 최종 실패는 지금처럼 exit 1 — 이 작업에 continue-on-error 를 걸지 않는 규칙은 유지한다.
· 마지막 로그 줄은 `✓ 이름 — label (ref: ref)`.
update-progress.yml 은 그대로 둔다(checkout fetch-depth: 0 이 원격 브랜치를 전부 받는다 · 대기줄도 그대로).
바꾸지 말 것: PEOPLE(공용 주소 금지), push 근거 > 주소 근거, STALE_DAYS·낡음 경고, '지금 하는 일' 규칙, --dry 동작(기존 「노션 「작업 현황」」 관문이 그것으로 잰다).

관문: ops.mjs ④:
· branchLabel 표본 다섯: main+[main,base,claude/foo] → claude/foo · ref claude/foo → claude/foo · main+[main,base] → base · main+[main] → main · pointsAt null → null.
· patchWithRetry 에 가짜 fetch 를 넣고 waits 는 [0,0]: 500→200 이면 두 번 부르고 ok, 400 이면 한 번만, 500 세 번이면 마지막이 not ok.
· 동작 확인: 기존 노션 관문처럼 임시 저장소에 refs/remotes/origin/claude/foo 를 HEAD 로 세우고, GITHUB_REF_NAME=main·NOTION_TOKEN=dry 로 `notion-status.mjs --dry` 를 돌리면 '브랜치: claude/foo' 가 나온다.
red: branchLabel 이 ref 를 그대로 돌려주게 되돌리면 첫 표본과 동작 확인이 빨개진다. notion-status.mjs 는 불러오는 순간 실행되므로 관문은 notion-branch.mjs 만 import 하고, 본체는 spawnSync 로만 돌린다.

소급: 없음. 다음 사람 push 때 칸이 스스로 바로잡힌다.

파일: tools/notion-status.mjs tools/notion-branch.mjs

위험: 낮음. 사람이 topic 브랜치보다 main 을 30초 넘게 먼저 올리면 그 실행은 base 나 main 을 적는다(허용). 다른 세션 목록과 겹치지 않는다.

---
## [gaps-04] P3 · confirmed

이유: tools/robot-run.sh:39 는 손으로 적은 8개다. 실제로 `git add data/|collector/` 를 하는 워크플로는 18개다(오늘 재집계). 빠진 것 가운데 둘이 이 겉옷이 막으려던 바로 그 파일을 쓴다. '자격요건 로봇 (진짜 브라우저)'(rescue-bodies — data/registered.json)와 '자격요건 매칭 · AI 자격 읽기'(eligibility-fill — data/registered.json·activities.json)다. registered.json 은 자동 병합에서 뺀 파일이다(.gitattributes 끝 주석).
그 밖에 공공 API·교내 소식·원문 링크 확인·한국장학재단 수확·등록금·작성 규칙 학습·공고 누락 감사도 빠졌다. 진단이 적은 '인스타 카드뉴스 게시'는 insta/ 만 써서 대상이 아니다.
이름 바꿈도 실제로 일어난다(deploy-sync.yml:23 '2026-10-04 이름 바꿈'). 손 목록은 또 낡는다.
덧붙여 `gh run list --limit 30` 은 최근 30개만 본다. gh 가 실패해도(로그인 안 됨 등) `|| true` 때문에 '비어 있음 ✅' 이라고 거짓 안심을 준다. test-collector 에 DATA_ROBOTS 검사는 0건이다.

수리 명세: 새 tools/data-robots.mjs: `export function dataRobotNames(dir)` — dir 의 *.yml 가운데 `/git add[^\n]*\b(data|collector)\//` 에 걸리는 파일의 `name:` 을 읽는다(따옴표 떼기 · 정렬). check-deploy-sync.js 와 같은 방식이다. 직접 실행하면 기본으로 .github/workflows 를 읽어 한 줄에 하나씩 출력한다.
tools/robot-run.sh:
· DATA_ROBOTS 손 목록을 지우고 `NAMES=$(node tools/data-robots.mjs)` 로 바꾼다. 비면 '⛔ 데이터 로봇 목록을 못 읽었습니다'를 내고, FORCE 가 아니면 exit 1.
· 도는 로봇은 `gh run list --status in_progress`·`--status queued`·`--status waiting` 을 각각 `-L 100 --json workflowName -q '.[].workflowName'` 로 묻는다.
· 하나라도 실패하면 '⚠️ 클라우드 상태를 확인하지 못했습니다'를 내고 FORCE 가 아니면 멈춘다. '비어 있음 ✅' 이라고 쓰지 않는다.
· 이름 대조는 `grep -Fx -f <(printf '%s\n' "$NAMES")` 로 한다. 이름에 괄호·가운뎃점이 있어 -E 를 쓰면 안 된다. Windows Git Bash 에서 프로세스 치환이 불안하면 임시 파일을 쓴다.
바꾸지 말 것: 대기줄을 하나로 합치지 않는다(머리말 ⚠️). 저장하지 않는 워크플로(배포·잠금 확인)는 넣지 않는다. ②③ 단계(fetch·merge·끝난 뒤 경고)는 그대로.

관문: ops.mjs ⑤:
· 임시 폴더에 표본 yml 셋을 둔다 — `name: 가 로봇 (괄호 · 점)` + `git add data/registered.json`, `name: 나` + `git add collector/seen.json`, `name: 다` + git add 없음. dataRobotNames 가 앞의 둘만 돌려준다.
· robot-run.sh 코드 대조(코드 위생이라 DOC_GATES 조건에서만): `DATA_ROBOTS='` 같은 손 목록이 없고, tools/data-robots.mjs 를 부르고, `--status` 와 `grep -F` 를 쓴다.
red: 손 목록을 되돌리면 대조가 빨개지고, 정규식을 data/ 만으로 줄이면 표본 '나'가 빠져 빨개진다. 실제 워크플로 이름은 박지 않는다(이름이 바뀐다).

소급: 없음.

파일: tools/robot-run.sh tools/data-robots.mjs

위험: 개발자 로컬 실행이 전보다 자주 '돌고 있음'으로 막힐 수 있다 — 그게 목적이다. 급하면 ROBOT_RUN_FORCE=1. 다른 세션 목록과 겹치지 않는다.

---
## [gaps-05] P3 · confirmed

이유: 지금 HEAD 의 run-probe.txt 활성 줄은 25개다(10-04 열 · 08-29 KOSAF findBoard · 09-17 넷 · 09-30 여섯 · 10-03 6차 넷). probe-links.mjs:27·295·312 는 실행마다 전부 연다.
10-03 하루에 정찰이 4번 돌았다(run 37142940191 18:06 · 37143828149 18:20 · 37144546504 18:31 · 37146558553 19:04). 매번 동국·서강·서울대·상명 등 옛 줄을 다시 열었다 — CLAUDE.md '같은 학교를 하루에 여러 번 두드리지 말 것'에 어긋난다.
6차 넷은 b444b603 에서 이미 규칙으로 반영됐는데(답 받음) 막히지 않았다. KOSAF 줄은 CLAUDE.md 가 '재조사 금지'로 정리했다. 10-04 실행(37176295018)은 10분 10초로 예산 11분을 거의 다 썼다. 다른 세션 목록에 probe-links.mjs·run-probe.txt 는 없다.

수리 명세: 새 순수 모듈 collector/probe-lines.mjs:
· `directives(text, key)` — 지금 probe-links 의 lines() 와 같은 뜻(trim 뒤 `key:` 로 시작하는 줄의 값).
· `addedDirectives(beforeText, afterText)` — after 의 활성 지시 줄(checkUrl·findBoard 별로) 가운데 before 의 활성 지시 줄 집합에 없는 것만 돌려준다. 주석을 풀어 되살린 줄은 '새 줄'로 센다.
probe-links.mjs:
· env PROBE_BEFORE 가 40자리 16진수이고 0 이 아니면 `execFileSync('git', ['show', `${before}:collector/run-probe.txt`])` 로 옛 판을 읽는다(셸 없이 · notion-status 와 같은 검사). 그리고 addedDirectives 만 연다.
· 옛 판을 못 읽으면 전부 열고, 리포트 첫머리에 '이번엔 바뀐 줄을 못 가려 전부 열었다'를 적는다(정직).
· 수동 실행(PROBE_BEFORE 없음)은 지금처럼 전부 연다.
· 예산 초과 문구 '다음 정찰에 다시' → '다시 보려면 그 줄을 지웠다 다시 넣어 push 하거나 Actions 에서 수동 실행'.
probe-links.yml: push 일 때 env `PROBE_BEFORE: ${{ github.event.before }}` 를 넘긴다. checkout 뒤에 `git fetch --no-tags --depth=1 origin "$PROBE_BEFORE" || true` 단계를 둔다(기본 fetch-depth 1 이면 옛 판이 없다). certHost 줄(지금 0줄)은 그대로 둔다.
run-probe.txt: 답 받은 것이 기록으로 확인되는 줄만 '# (답 받음 2026-10-0x · 근거) ' 로 막는다 — 10-03 6차 넷(b444b603), 10-04 열(다른 세션이 3ae5a6a8 등에서 반영), 08-29 KOSAF(CLAUDE.md 재조사 금지). 확인 안 되는 09-17·09-30 줄은 그대로 둔다(② 때문에 push 로는 다시 안 열린다). 이 파일을 고친 push 는 정찰을 깨우므로 ② 와 같은 커밋에 넣는다(새 워크플로·도구로 돌아 빈 실행이 된다).
바꾸지 말 것: 주소마다 100초 시한·전체 11분 예산·주소마다 리포트 쓰기(2026-10-02 수리), 기본 브랜치에서만 깨는 거름. test-collector:1605 의 네 학교 글자 검사는 건드리지 않는다 — 막은 줄에도 글자가 남아 통과하고, 공유 파일 충돌을 피한다.

관문: ops.mjs ⑥:
· 표본 before/after 문자열로 addedDirectives 를 잰다. 새 checkUrl 하나와 주석에서 되살린 줄 하나만 돌려주고, 그대로인 줄·주석·빈 줄·'# (답 받음) checkUrl:' 줄은 빼야 한다. findBoard 도 같은 규칙이다.
· 코드 대조(DOC_GATES 조건에서만): probe-links.mjs 가 probe-lines.mjs 를 불러 쓰고 PROBE_BEFORE 를 읽는다. probe-links.yml 이 github.event.before 를 넘긴다.
red: addedDirectives 가 after 전부를 돌려주게 되돌리면 빨개진다. probe-links.mjs 는 불러오는 순간 브라우저를 띄우므로 관문은 probe-lines.mjs 만 import 한다.

소급: run-probe.txt 의 답 받은 줄 막기(위). 데이터는 없다.

파일: collector/probe-lines.mjs collector/probe-links.mjs .github/workflows/probe-links.yml collector/run-probe.txt

위험: run-probe.txt 를 고쳐 push 하면 정찰이 한 번 깬다(새 코드면 새 줄 0개라 빈 실행). 같은 파일을 다른 세션이 동시에 고치면 충돌한다 — 지금 그 세션 목록엔 없다.

---
## [links-16] P3 · needs-human
**결정(추천안 ①): 게시판 후보 정찰 도구(.github/workflows/probe-boards.yml · collector/probe.mjs · collector/probe-candidates.json)를 git rm 하고, 관리자 화면 로봇 목록·관문·문서에서 그 이름을 뺀다. 이슈 #4 닫기는 오케스트레이터가 한다.**

이유: 사실이다. probe-boards.yml 은 수동 전용이고 실행은 단 1회다(28673950032 · 2026-07-03). 그때 만든 이슈 #4 가 열려 있다. probe.mjs 는 7월 후보 목록 collector/probe-candidates.json 만 읽고, 같은 일은 find-boards.mjs(씨앗→후보 리포트)와 probe-links(정찰)가 한다. 관리자 「로봇」 화면 목록에는 아직 '게시판 후보 정찰'로 뜬다(_admin/admin.js:2106). 지금 피해는 없다 — 저장도 안 하고, 리포트 이름이 probe-links 와 같지만 둘 다 커밋하지 않는다. 지우는 일은 관리자 화면 목록을 바꾸고 이슈를 닫는 일이라 개발자에게 묻는다.

수리 명세: ①을 고르면:
· .github/workflows/probe-boards.yml·collector/probe.mjs·collector/probe-candidates.json 을 지운다.
· _admin/admin.js ROBOTS 에서 probe-boards.yml 줄을 지운다. 관문 「관리자 화면 로봇 목록」 의 '실재한다'와 '화면이 못 부르는 워크플로'가 같이 맞아야 한다.
· verify/check-deploy-sync.js:56 제외 정규식의 probe-boards 토큰을 지운다(선택 · 해롭지 않음).
· #4 를 닫는다(state_reason not_planned · 코멘트에 대체 도구 find-boards·probe-links).
②를 고르면 probe.mjs 의 리포트 파일 이름을 probe-boards-report.md 로 바꾸고 워크플로의 --body-file 을 맞춘다.

관문: ① 이면 새 관문이 필요 없다 — 기존 「관리자 화면 로봇 목록」 절이 ROBOTS 의 파일이 '실재한다'를 이미 잰다(지우고 목록에 남기면 빨개진다). ② 이면 ops.mjs 에서 두 도구의 리포트 파일 이름이 다르다는 것을 대조한다.

소급: 없음.

파일: .github/workflows/probe-boards.yml collector/probe.mjs collector/probe-candidates.json _admin/admin.js verify/check-deploy-sync.js

위험: _admin/admin.js 는 다른 세션 목록에 있었지만 지금은 기본 브랜치에 합쳐져 차이가 없다(데이터·style.css 만 남음). 관리자 화면은 Cloudflare 빌드가 따로 배포한다.

---
## [ops-14] P3 · confirmed

이유: 경고는 실재한다(run 36851872513·37195416776 끝줄 '##[warning]Node.js 20 is deprecated … forced to run on Node.js 24: actions/checkout@v4'). Node 20 은 2026-04-30 에 지원이 끝났다.
진단이 적은 4개 파일만 고치면 반쪽이다. 저장소 전체에서 checkout@v4 가 37곳, setup-node@v4 가 33곳, github-script@v7 이 4곳, upload-artifact@v4 가 7곳이다. node-version 20 은 워크플로 29개에 있다(22 는 gate-photos·essay 둘뿐).
22 로 올려도 위험은 낮다. 로컬 관문 전체가 Node 22.22 에서 통과했다(test-collector.log). import assert 문법은 0건이다. 루트 package.json 이 없어 setup-node 새 판의 자동 캐시도 켜지지 않는다. 지금은 강제 Node 24 로 잘 돌아 급하지 않다.

수리 명세: .github/workflows/*.yml 과 .github/actions/*/action.yml 전부에서 기계적으로 치환한다(다른 줄은 손대지 않는다):
· actions/checkout@v4 → Node 24 판(v5)
· actions/setup-node@v4 → v5
· actions/github-script@v7 → v8
· actions/upload-artifact@v4 → Node 24 판이 있는지 릴리스 노트로 확인한 뒤
· `node-version: 20`·`'20'` → 22
이 묶음 안에서 하지 말고 모든 묶음이 병합된 뒤 마지막 한 커밋으로 한다 — 워크플로 파일 거의 전부를 건드려 다른 묶음(browser B11·collect-16 등)과 부딪힌다. 확인: 다음 실행 로그에 Node 20 경고 줄이 없고 verify-ui·test-collector 가 초록.

관문: ops.mjs ⑦ — 코드 위생이라 DOC_GATES 조건(`!process.env.GITHUB_ACTIONS || process.env.DOC_GATES === '1'`)에서만 잰다. 수집 로봇의 데이터 관문에서 빨개지면 자동 등록분이 되돌려지기 때문이다(문서 관문과 같은 이유). 워크플로·액션 파일 전부에서 `actions/(checkout|setup-node)@v[1-4]\b`·`github-script@v[1-7]\b`·`node-version:\s*['"]?(1\d|20)\b` 가 0건이어야 한다. red: 한 파일을 @v4/20 으로 되돌리면 빨개진다. 이 관문은 치환 커밋과 같이 넣는다.

소급: 없음.

파일: .github/workflows/main-guard.yml .github/workflows/device-deploy.yml .github/workflows/robot-heartbeat.yml .github/workflows/verify-ui.yml

위험: 검사 안 된 새 액션 판의 동작 차이(checkout v5 는 런타임만 바뀐 판으로 알려져 있지만 릴리스 노트로 확인할 것). 워크플로 파일 전체 충돌 — 반드시 마지막에 순차로.

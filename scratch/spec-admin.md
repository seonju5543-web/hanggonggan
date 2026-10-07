# 수리 명세 — 묶음 admin

권장 순서: 사전: 작업 브랜치(claude/robot-tool-health-sweep 46f08990)에 origin/claude/nice-heisenberg-WESq5(4ba7da49)를 먼저 합친다 — 32커밋 뒤처졌고 그 안에 다른 세션(source-link-integrity, 이미 기본 브랜치에 합쳐짐)의 _admin/admin.js·tools/admin-apply.mjs·verify/verify-admin.js·_admin/README.md·build-admin-preview.mjs·admin-apply.yml·test-collector.mjs 변경이 있다. 합치지 않고 고치면 같은 줄에서 충돌하고 admin-F3·F12 수리가 두 번 들어간다. → admin-F1 — tools/edit-diff.mjs needsBulkExpect → admin-apply.mjs 가 그것을 씀 → admin.js 시트 숫자 칸·expect → verify-admin.js 6건 되돌리기 → health-gates/admin.mjs 표본(+ verify/health-gates.mjs PARTS 에 'admin') → admin-F9 — admin.js applyAction 실패 갈래(jobs·annotations) + admin-apply.yml 🚨 본문 갈래 + 드라이버 세 경우 (F1 의 거절 사유가 여기서 화면에 보인다) → admin-F4 — admin.js 보내기 전 줄 확인·waitForRun 대기 표시/연장 + COLLECTOR_QUEUE 대조 관문 + 드라이버 → admin-F6 — README 감시 목록 + 관문 ⓐⓑⓒ(F3·F12 재발 방지 포함, STRICT 로만) → admin-F5·admin-F10 — 사람 결정 대기(humanQuestion 그대로 보고) · admin-F3·F11·F12 — 이미 고쳐짐(기본 브랜치 합치기로 들어옴)
예상 손댈 파일: tools/edit-diff.mjs tools/admin-apply.mjs _admin/admin.js _admin/README.md .github/workflows/admin-apply.yml verify/verify-admin.js verify/health-gates/admin.mjs verify/health-gates.mjs

검증 메모: 검증 기준: 진단 당시(b71da694..ca94c76e)가 아니라 지금 기본 브랜치 4ba7da49 — 2026-10-04 10:25Z 에 다른 세션 브랜치 origin/claude/source-link-integrity 가 기본 브랜치에 통째로 합쳐졌다(그 브랜치는 이제 기본 브랜치보다 0커밋 앞섬). 그래서 'other-session' 대신 'already-fixed'로 적은 것(F3·F12)은 그 세션 커밋 dbcddef3 로 고쳐져 기본 브랜치에 들어간 것이다. 우리 작업 브랜치 HEAD 46f08990 은 기본 브랜치보다 32커밋 뒤라 수리 전에 반드시 합쳐야 한다(가장 큰 충돌 위험: _admin/admin.js +472줄, verify/verify-admin.js +107줄, tools/admin-apply.mjs +137줄, verify/test-collector.mjs).

🔴 관문 배치 주의: verify/health-gates/admin.mjs 는 test-collector 를 거쳐 **수집 로봇의 데이터 관문**으로도 돈다. 관리자 도구의 정적 목록 대조(F3·F4·F6·F9·F12 의 정적 줄)가 거기서 빨개지면 그날 자동 등록분이 되돌려진다(verify-admin-vendor.js 21-23행이 같은 이유로 test-collector 를 피했다). 그래서 정적 대조는 STRICT(= `!process.env.GITHUB_ACTIONS || process.env.DOC_GATES === '1'`, test-collector 4068 과 같은 식 — 로컬·verify-ui.yml 에서만)일 때만 돌리고, needsBulkExpect 표본처럼 순수 함수 표본은 늘 돌려야 한다 — health-gates.mjs 의 '아무것도 재지 않으면 실패' 규칙 때문에 로봇 실행에서 0건이 되면 안 된다.

실측 근거 요약: ① 버리는 작업트리(4ba7da49)에서 ACTION=revert ids 6개 → exit 1 '받은 값: 없음', expect:6 → exit 0 '164 → 158건'. ② 같은 작업트리에서 `node tools/build-admin-preview.mjs` → exit 0(8016KB). ③ gh api: admin-apply.yml 실행 7회(dispatch 1회 08-09 · push 실패 6회 09-30), 그 뒤 0회. ④ collector 줄에서 시작 전 취소 실측: collect-scholarships 30733839394(jobs 0 · 08-02 05:21:41 취소 = 다음 실행 생성 1초 뒤) · 30733987559(jobs 0 · 05:42:50 취소 = 예약 실행 30734605400 생성 2초 뒤). ⑤ 저장 단계 git add 대상 14개 파일 모두 기본 브랜치에 있음. 작업트리는 지웠고 저장소(/home/user/hanggonggan)는 손대지 않았다(git status 깨끗).

F5 관련: 관리자 열쇠는 어떤 워크플로 시크릿에도 쓰이지 않는다 — 만료돼도 학생 앱·로봇은 무관하고 관리자 화면이 들어가는 순간 크게 알린다. 노션 F-4 의 현재 상태는 확인하지 않았다(노션 조회는 이번 검증 범위 밖).


---
## [admin-F1] P2 · confirmed

이유: 지금 기본 브랜치(origin/claude/nice-heisenberg-WESq5 4ba7da49 — 다른 세션 source-link-integrity 가 이미 합쳐진 판)에서도 그대로다. ① 화면: _admin/admin.js:1902-1921 bulkAction 시트에 숫자 칸이 없고, 4724-4731 data-bulk-go 처리기가 `applyAction(kind, { ids }, …)` 로 expect 없이 보낸다(`grep -n expect _admin/admin.js` 0건). ② 저장소: tools/admin-apply.mjs:269-283 guardBulkRemove 가 '실제로 지워질 건수 > 5 또는 목록의 10% 초과'면 payload.expect === 건수를 요구하고, revert(336)·remove(419)가 부른다. ③ 재현(버리는 작업트리 · 등록 164건): ACTION=revert ids 6개 → '::error::관리자 조정 실패 — 한 번에 6건을 지우는 요청입니다(지금 164건)… 받은 값: 없음' exit 1, 같은 요청에 expect:6 → '✅ revert — 6건 제거(164 → 158건)' exit 0. ④ 4b9f2528(09-13) 커밋 메시지가 '관문은 admin-apply.mjs 한 곳에만 뒀다'고 적었고 화면 쪽은 없다. verify-admin.js:839-856 은 일괄 confirm 만 누르고, test-collector 9389-9410 은 저장소 쪽만(expect 를 직접 넣어) 잰다. 심각도는 P1→P2 로 낮춘다: 실패가 안전한 쪽(한 건도 안 지워짐)이고 학생 화면 영향이 없으며 버튼 길 자체가 08-09 이후 0회 쓰였다. 다만 5건 이하로 나눠 누르면 관문을 우회하게 되어 관문의 뜻(사람이 숫자를 한 번 더 확인)도 무력해진다.

수리 명세: 0) 먼저 작업 브랜치에 origin/claude/nice-heisenberg-WESq5 를 합친다(32커밋 뒤처짐 — admin.js +472줄·admin-apply.mjs +137줄·verify-admin.js +107줄이 다른 세션에서 들어와 있다). 1) 문턱을 한 곳으로: tools/edit-diff.mjs(이미 화면 vendor·저장소 둘 다 부르는 공용 파일 — build.sh·VENDOR_SRC·verify-ui 감시에 이미 있어 새 vendor 등록이 필요 없다)에 `export const BULK_MIN = 5; export const BULK_RATIO = 0.1; export function needsBulkExpect(willRemove, before) { return willRemove > BULK_MIN || willRemove > before * BULK_RATIO; }` 를 더한다(순수 함수 · import 없음 유지). tools/admin-apply.mjs 는 지역 상수 BULK_MIN/BULK_RATIO 를 지우고 `import { …, needsBulkExpect } from './edit-diff.mjs'` 로 guardBulkRemove 의 조건만 바꾼다 — '요청 id 개수가 아니라 실제로 지워질 건수와 대조'·실패 문구·expect 정수 검사는 그대로(test-collector 9389-9410 이 그 문구를 잰다). 2) 화면: admin.js 에서 `import { diffPatch, showValue, wonText, needsBulkExpect } from './vendor/edit-diff.mjs'`. bulkAction(kind): kind 가 revert/remove 이고 needsBulkExpect(items.length, D.reg.length) 이면 시트 note 아래에 `<label>실수로 목록을 통째로 지우는 것을 막으려고 지울 건수를 숫자로 한 번 더 받습니다 <input type="number" inputmode="numeric" data-bulk-expect></label>` 를 그리고 data-bulk-go 버튼을 disabled 로 둔다. input 이벤트에서 Number(value) === items.length 일 때만 버튼을 푼다. data-bulk-go 처리기: ids 는 `[...SEL]` 대신 시트에 보여 준 목록(selRows().map(x=>x.id))으로 보내고, 칸이 있으면 `{ ids, expect: Number(칸 값) }` 를 보낸다(칸 값이 건수와 다르면 보내지 않고 toast). 3) 한 건 경로(admin.js 4774-4788 data-act revert/remove)도 같은 needsBulkExpect 로 판단한다 — 목록이 10건 미만이면 한 건도 비율 문턱(1 > 0.9)에 걸리므로, 걸릴 때만 같은 숫자 칸 확인을 거친다(지금 164건이라 실제로는 안 걸린다). 4) 바꾸지 말 것: confirm 일괄 경로·'반영 완료' 문구(verify-admin.js 856·2098 이 그 글자를 기다린다)·시트에 '무엇을 지우는지 목록으로 보여 준 뒤 확인' 구조(admin.js 1890-1892 주석)·저장소 관문을 감사로 옮기지 않는다(admin-apply.mjs 262-267 주석: 감사로 옮기면 수집 저장이 멈춘다). 숫자를 화면이 자동으로 채우지 말 것(사람이 적는 것이 관문의 뜻). 5) 실패 문구가 '검사를 통과하지 못해'로 나가는 것은 admin-F9 에서 함께 고친다.

관문: ① verify/health-gates/admin.mjs (새 파일 · verify/health-gates.mjs PARTS 에 'admin' 추가) — 늘 도는 표본 관문: needsBulkExpect(6,152)=true · (5,152)=false · (2,5)=true · (3,50)=false · (1,9)=true. 정적 관문(아래 STRICT 일 때만 — 로봇 워크플로에선 건너뛴다): admin-apply.mjs 가 needsBulkExpect 를 edit-diff 에서 가져오고 `const BULK_MIN` 을 따로 두지 않는다 · admin.js 가 './vendor/edit-diff.mjs' 에서 needsBulkExpect 를 가져오고 data-bulk-go 처리기에서 expect 를 싣는다. STRICT = `!process.env.GITHUB_ACTIONS || process.env.DOC_GATES === '1'`(test-collector 4068 과 같은 식) — 🔴 verify-admin-vendor.js 머리말대로 관리자 도구의 정적 대조가 수집 로봇 데이터 관문을 빨갛게 해 자동 등록분을 되돌리면 안 된다. 표본 관문은 STRICT 와 무관하게 늘 돌려야 '아무것도 재지 않으면 실패' 규칙(health-gates.mjs)에 안 걸린다. ② verify/verify-admin.js(브라우저 드라이버 · verify-ui.yml 이 돌린다) — 컨펌 작업대에서 input[data-pick] 6개를 체크(6개 미만이면 '표본 부족'으로 ❌, 조용히 건너뛰지 말 것) → [data-sel="revert"] → 시트에 [data-bulk-expect] 칸이 있고 [data-bulk-go] 가 disabled → 5 를 적으면 여전히 disabled → 6 을 적으면 풀림 → 누르면 가로챈 dispatch 의 inputs.action==='revert' 이고 JSON.parse(inputs.payload).expect===6 · ids.length===6. 이어서 2개만 골라 remove 하면 칸이 없다(작은 삭제는 숫자를 안 묻는다). red 증명: admin.js 의 bulkAction/처리기 변경만 되돌리면 ②가 ❌(칸 없음·expect 없음)이고 ①의 정적 줄이 ✕; edit-diff 의 needsBulkExpect 에서 `|| willRemove > before * BULK_RATIO` 를 지우면 ①의 (2,5)·(1,9) 표본이 ✕.

소급: 없음 — 데이터를 바꾸는 버그가 아니다(실패는 한 건도 안 지운 채 멈췄다). 08-09 이후 버튼 실행이 0회라 잘못 열린 이슈도 없다.

파일: tools/edit-diff.mjs tools/admin-apply.mjs _admin/admin.js verify/verify-admin.js verify/health-gates/admin.mjs verify/health-gates.mjs

위험: (없음)

---
## [admin-F4] P3 · confirmed

이유: 구조는 사실이고 이 저장소에서 실제로 일어난 적이 있다(관리자 실행이 아니라 로봇끼리). admin-apply.yml:35-37 `group: collector · cancel-in-progress: false` — 같은 줄: collect-scholarships·browser-collect·open-api·refresh-majors·refresh-tuition. GitHub 대기줄은 '기다리는 실행 하나'만 남기고 새로 온 것이 기다리던 것을 취소한다. 실측: collect-scholarships run 30733839394(push, 08-02 05:16:46 생성)가 jobs 0개인 채 05:21:41 취소 — 같은 워크플로 run 30733987559 가 05:21:40 에 생긴 바로 그 순간. 그 30733987559 도 jobs 0개로 05:42:50 취소 — 예약 run 30734605400 이 05:42:48 에 생긴 순간. 시작 전 취소라 🚨 알림 단계(if: failure()||cancelled())도 안 돈다. 화면: admin.js:483-499 waitForRun 은 최대 약 6분(90회)·대기(queued) 상태도 '반영 중… 검사와 저장이 진행되고 있어요'로 말하고, conclusion 'cancelled' 를 '검사를 통과하지 못해 되돌렸습니다'로 말한다. 거꾸로 버튼 한 번이 줄 서 있던 예약 수집 실행을 밀어내 취소시킬 수 있다. 다만 지금 로봇 실행은 10~15분이고(collect-scholarships 최근 실행 9~14분, browser-collect 8~13분) 버튼 실행은 08-09 이후 0회라 실제 확률은 낮다 → P2→P3. 진단의 부가 주장(collect-news 가 news-sources.json 을 저장해 관리자 newsSource 와 rebase 충돌)은 이론상 맞지만 09-27 이후 그 파일을 고친 커밋은 사람 커밋 둘(b444b603·247b89f9)뿐이라 이번 수리 범위에서 뺀다. 선택지 (가) '관리자를 따로 된 줄로 빼기'는 권하지 않는다 — registered.json 은 병합 규칙이 없어(.gitattributes 에 없음 · 일부러 뺀 파일) 로봇과 동시에 저장하면 rebase 충돌로 **로봇 쪽 수집분이 버려지는** 09-30 사고(run 36649509008) 유형이 된다. 그래서 줄은 그대로 두고 화면이 막고 알리는 (나)를 원칙 3(선조치후보고)으로 고른다.

수리 명세: 줄(concurrency)은 바꾸지 않는다(CLAUDE.md '대기줄을 하나로 합치지 말 것'과 반대 방향 변경도 하지 않는다 · admin-apply.yml 의 ref: github.ref_name 은 그대로). admin.js 만 고친다. ① 보내기 전 확인(applyAction 안, dispatchWorkflow 직전): `GET /repos/{o}/{r}/actions/runs?status=queued&per_page=30` 와 `…?status=pending&per_page=30`(Actions 읽기 — 관리자 열쇠 권한 안)을 읽어, path 가 COLLECTOR_QUEUE(새 상수: 'collect-scholarships.yml','browser-collect.yml','open-api.yml','refresh-majors.yml','refresh-tuition.yml','admin-apply.yml' — `.github/workflows/` 를 뗀 파일 이름) 중 하나인 실행이 줄을 서 있으면 보내지 않고 jobShow('수집 로봇 실행 하나가 줄을 서 있어요. 지금 보내면 그 실행이 취소됩니다 — 그 로봇이 시작된 뒤 다시 눌러 주세요', 'bad', 그 실행 html_url) 후 false. 읽기에 실패하면(응답 !ok·형식 다름) 막지 않고 보내되 '줄 상태를 확인하지 못했습니다'를 덧붙인다(확인 안 한 것을 확인했다고 말하지 않는다 — 원칙 5). in_progress 인 로봇만 있으면 보내되 문구에 '수집 로봇이 끝나면 이어서 반영됩니다'. ② waitForRun: run.status 가 queued/pending/waiting/requested 이면 '줄 서는 중 — 앞선 수집 로봇이 끝나길 기다리고 있어요'로 보이고, 줄 서는 동안은 15초 간격·최대 60분까지 기다린다(in_progress 가 된 뒤에는 지금처럼 최대 약 6분 + 작업 상한 10분 안). 기다림을 넘기면 지금 문구('아직 끝나지 않았어요…')를 유지. ③ conclusion 'cancelled' 의 문구는 admin-F9 에서 가른다(jobs 0개 = '시작 전에 취소됐습니다 — 같은 줄의 다른 로봇 실행에 밀렸을 수 있습니다 · 데이터는 바뀌지 않았습니다 · 다시 눌러 주세요'). 자동 재요청은 하지 않는다(재요청이 이번엔 줄 서 있던 로봇을 취소시킨다). ④ window.__admin 에 COLLECTOR_QUEUE 를 노출하지 않아도 된다 — 관문은 소스 정적 대조로 본다. 바꾸지 말 것: dispatchWorkflow 의 ref(BRANCH), jobBusy 잠금, '반영 완료' 문구.

관문: verify/health-gates/admin.mjs (STRICT 일 때만): `.github/workflows/*.yml` 중 `concurrency:` 아래 `group: collector`(정확히 그 이름 — collector-news 는 아님)인 파일 이름 집합 == admin.js 의 COLLECTOR_QUEUE 배열(정규식으로 뽑음) — 로봇이 같은 줄에 새로 들어오면 화면 목록도 고치라고 빨간불. red 증명: COLLECTOR_QUEUE 에서 'open-api.yml' 을 지우면 ✕. 화면 동작은 verify/verify-admin.js: '**/actions/runs?status=queued*'(및 pending)를 가로채 collect-scholarships.yml 실행 하나를 돌려주고 [data-bulk-go] 또는 컨펌을 누르면 dispatch 가 **나가지 않고**(가로챈 dispatches 0회) #job-text 에 '줄을 서 있어요'가 뜬다; 빈 목록이면 지금처럼 나간다. red: 보내기 전 확인을 지우면 dispatch 가 나가 ❌. ⚠️ 드라이버의 기존 catch-all(api.github.com/** → {full_name})은 workflow_runs 가 없으므로 '읽지 못함 → 막지 않음' 길로 가야 기존 검사가 그대로 통과한다 — 그 길도 함께 확인.

소급: 없음 — 데이터 손상 기록이 없다(관리자 실행 0회 · 로봇 대기 취소는 다음 예약 실행이 메웠다).

파일: _admin/admin.js verify/verify-admin.js verify/health-gates/admin.mjs

위험: (없음)

---
## [admin-F5] P3 · needs-human
**결정: 보고만(사람이 새 열쇠를 만든다). 코드 변경 없음.**

이유: 만료일(2026-11-07)은 CLAUDE.md「노션에 없고 여기서만 사는 것」②와 노션 F-4 에만 있고, 화면(admin.js:122-147·1437-1446)은 사람이 열쇠를 넣을 때 적어 둔 날짜가 있어야 14일 전에 「할 일」에 띄운다 — 이 브라우저 저장소 값은 로봇이 못 읽는다. 다만 진단보다 영향이 작다: 이 열쇠는 어떤 워크플로 시크릿에도 쓰이지 않고(워크플로가 쓰는 secrets 는 ANTHROPIC_API_KEY·IG_*·DATA_GO_KR_KEY·YOUTHCENTER_*·PUSH_ADMIN_KEY·NOTION_TOKEN·MAIL_*·CAREERNET_API_KEY 뿐), 만료되면 관리자 화면에 들어가는 순간 verifyKey 가 401 → '열쇠가 올바르지 않거나 만료됐습니다'(admin.js:164)로 **크게** 알린다(조용히 멈추지 않는다). 학생 앱·로봇은 영향 없다. 열쇠 재발급은 사람만 할 수 있다(GitHub 설정·비밀값). P2→P3.

수리 명세: (없음)

관문: (없음)

소급: (없음)

파일: _admin/admin.js .github/workflows/admin-lock-check.yml

위험: (없음)

---
## [admin-F6] P3 · confirmed

이유: 기본 브랜치(4ba7da49)의 _admin/README.md 「빌드 감시 경로」 목록은 다른 세션이 source-link.js·collector/link-fix.mjs 둘을 더한 뒤에도 아홉 줄(_admin/*, data.js, apply-channel.js, forms.js, verify/entry-rules.cjs, collector/url-key.mjs, collector/activity-kind.mjs, source-link.js, collector/link-fix.mjs)이고, _admin/build.sh 가 복사·감싸는 원본(28-58행 cp + 65행 cat) 중 form-plan.js, collector/deadline-hint.mjs, collector/notice-source.mjs, collector/canon-url.mjs, collector/page-boilerplate.mjs, tools/edit-diff.mjs, collector/news-kind.mjs 일곱이 빠져 있다. verify-admin-vendor.js ②(125-187행)는 build.sh ↔ verify-ui.yml 만 대조하고 README 는 안 본다. 실제 Cloudflare 설정이 README 대로인지는 이 샌드박스에서 확인할 수 없다(사람 확인 필요). 피해는 '그 원본만 바뀐 커밋에서 관리자 화면이 옛 사본을 계속 씀'이고 다음 _admin/ 변경 때 저절로 풀리므로 P2→P3. admin-F1 수리가 edit-diff.mjs 를 바꾸지만 같은 커밋에서 admin.js 도 바뀌어 재빌드는 된다.

수리 명세: ① _admin/README.md 「빌드 감시 경로」 코드 블록을 build.sh 가 실제로 쓰는 원본 전부로 고친다: _admin/*, data.js, apply-channel.js, forms.js, form-plan.js, source-link.js, verify/entry-rules.cjs, collector/url-key.mjs, collector/deadline-hint.mjs, collector/notice-source.mjs, collector/canon-url.mjs, collector/page-boilerplate.mjs, collector/activity-kind.mjs, collector/news-kind.mjs, collector/link-fix.mjs, tools/edit-diff.mjs. 'collector/**' 처럼 넓히지 말 것(README 자체 설명대로 로봇 커밋마다 재빌드돼 월 500회 무료 한도를 며칠에 쓴다). 문장 '아래 줄을 전부 넣으세요' 뒤에 '목록은 관문(로봇·도구 점검 관문 admin)이 build.sh 와 대조한다 — 새 원본을 vendor 로 옮기면 여기도 더하라고 빨간불이 켜진다' 한 줄. ② 사람 할 일(보고에 적는다): Cloudflare Pages → hanggonggan-admin → Settings → Build → Build watch paths 의 Include paths 를 새 목록으로 갱신. ③ 관문 셋을 verify/health-gates/admin.mjs 에 STRICT 일 때만(로컬·verify-ui.yml DOC_GATES=1) 둔다 — 관리자 도구 목록 어긋남이 수집 로봇의 데이터 관문을 빨갛게 해 자동 등록분을 되돌리면 안 된다(verify-admin-vendor.js 21-23행 주석과 같은 이유): ⓐ build.sh 원본 ⊆ README 목록(README 의 `_admin/*`·`*` 는 '/ 를 안 넘는 글로브'로 해석) — admin-F6; ⓑ build.sh 의 `cp <원본> "$OUT/vendor/<이름>"` 쌍마다: 이름이 .mjs 면 build-admin-preview.mjs 의 VENDOR_SRC[이름] === 원본, 아니면 VENDOR['vendor/<이름>'] 가 있다(entry-rules.js 는 cat 블록이라 VENDOR['vendor/entry-rules.js'] 존재로) — admin-F3 재발 방지; ⓒ admin-apply.yml 의 action 입력 description 괄호 안 ' / ' 목록 == admin-apply.mjs 최상위 switch 의 `case '이름':` 목록(정렬 비교) — admin-F12 재발 방지. 정규식은 verify-admin-vendor.js 의 교훈대로 0개를 '없다'가 아니라 '못 읽었다'로 실패시킨다(빈 목록이면 ✕). build.sh·verify-admin-vendor.js 자체는 고치지 않는다(README 어긋남으로 Cloudflare 빌드가 실패하면 안 된다).

관문: verify/health-gates/admin.mjs 의 ⓐⓑⓒ(STRICT). red 증명: 지금 README 그대로 두고 돌리면 ⓐ가 일곱 개를 나열하며 ✕(수리 전 빨강 → 목록 고친 뒤 초록) · ⓑ는 VENDOR_SRC 에서 'news-kind.mjs' 줄을 지우면 ✕ · ⓒ는 description 에서 'linkUnfix' 를 지우면 ✕. 세 대조 모두 코드·문서 파일만 읽는다(data/·장부 금지 규칙과 충돌 없음).

소급: 없음(문서·관문). Cloudflare 설정 갱신은 사람이 한다.

파일: _admin/README.md verify/health-gates/admin.mjs

위험: (없음)

---
## [admin-F9] P3 · confirmed

이유: 기본 브랜치 _admin/admin.js:502-525 applyAction — `if (run.conclusion === 'success') …; jobShow(`${label} — 검사를 통과하지 못해 되돌렸습니다. 실행 기록에서 사유를 확인하세요`)` 로 conclusion 종류(failure/cancelled/timed_out)와 실패 단계를 가르지 않는다. admin-apply.mjs 의 fail()(92-95행)은 '::error::관리자 조정 실패 — …' 주석을 남기고 그 호출이 100곳이라 대부분의 실패는 '감사'가 아니라 '입력 거절'이다(admin-F1 의 건수 요구가 대표). 시작 전 취소(jobs 0개 · run 30733839394 실측 꼴)도 같은 문구가 된다. admin-apply.yml:144-147 실패 이슈 본문도 '감사를 통과하지 못하면 되돌리도록 되어 있습니다'로 감사 탓을 기본으로 적는다. CLAUDE.md 매 세션 5번(확인 안 한 원인을 단정하지 않는다)과 어긋난다.

수리 명세: ① admin.js applyAction: run.conclusion !== 'success' 이면 `GET /repos/{o}/{r}/actions/runs/{run.id}/jobs`(Actions 읽기 — 열쇠 권한 안에서 확실히 됨)를 읽어 갈래를 정한다: jobs 0개 + cancelled → '시작 전에 취소됐습니다 — 같은 줄의 다른 로봇 실행에 밀렸을 수 있습니다. 데이터는 바뀌지 않았습니다. 다시 눌러 주세요'(admin-F4 와 짝); 단계 '요청 내용 적용' 이 failure → '저장소가 요청을 받지 않았습니다: <사유>' + '데이터는 바뀌지 않았습니다'; '감사 실패를 실패로 끝낸다' 가 failure(또는 '데이터 감사' outcome failure) → '데이터 감사를 통과하지 못해 되돌렸습니다'; '저장' 이 failure → '저장(push)에 실패했습니다 — 데이터는 바뀌지 않았습니다'; 작업이 시작된 뒤 cancelled → '실행이 도중에 멈췄습니다(시간 상한 10분 또는 취소)' — 단 '저장' 단계가 success 였으면 '저장은 끝났습니다'로 말한다(단계 결과로 말하고 짐작하지 않는다); 그 밖 → `실행이 「${단계 이름}」 단계에서 실패했습니다`. 단계 이름 문자열은 admin-apply.yml 의 name: 과 글자까지 같아야 한다(관문이 대조). <사유>: job.check_run_url(=…/check-runs/{id})의 `/annotations` 를 읽어 '관리자 조정 실패 — ' 로 시작하는 message 를 그대로 보인다(textContent — jobShow 가 이미 textContent). 이 읽기가 실패하면(관리자 열쇠에 Checks 권한이 없을 수 있다 — 공개 저장소라 열릴 가능성이 높지만 확인 안 됨) 사유 없이 '사유 원문은 실행 기록에서' 로 끝낸다 — 지어내지 않는다. 링크는 지금처럼 run.html_url. ② admin-apply.yml 🚨 실패 알림 단계: env 에 `APPLY: ${{ steps.apply.outcome }}`·`AUDIT: ${{ steps.audit.outcome }}` 를 넘기고 본문 둘째 줄을 갈래별로: APPLY=failure → '요청 내용 적용 단계에서 거절됐습니다(입력 관문) — 데이터는 바뀌지 않았습니다'; AUDIT=failure → '데이터 감사를 통과하지 못해 되돌렸습니다'; 그 밖 → '저장 또는 다른 단계에서 실패/취소됐습니다 — 실행 기록을 보세요'. 셸에 화면 값(ACTION_NAME)을 직접 넣는 방식은 지금처럼 env 로만. 이슈 제목·라벨·기존 이슈에 댓글 다는 흐름은 그대로. ③ 바꾸지 말 것: 성공 문구 '반영 완료. 앱1에는 배포 로봇이 이어서 올립니다'(드라이버 856·2098 이 기다림), jobBusy 해제(finally), 단계 이름(admin-apply.yml 의 name: 을 바꾸면 화면 대조도 같이).

관문: verify/verify-admin.js 에 세 경우를 더한다(가짜 응답만 — 실데이터 아님): '**/actions/workflows/**/runs**' 가 conclusion failure 실행을, '**/actions/runs/*/jobs' 가 steps=[{name:'요청 내용 적용',conclusion:'failure'}] 와 check_run_url 을, '**/check-runs/*/annotations' 가 [{message:'관리자 조정 실패 — 한 번에 6건을 지우는 요청입니다…'}] 를 돌려줄 때 #job-text 에 '한 번에 6건' 이 있고 '검사를 통과하지 못해' 가 없다 / annotations 가 403 이면 '실행 기록에서' 로 끝나고 지어낸 사유가 없다 / conclusion cancelled + jobs 0개면 '시작 전에 취소' 가 뜬다. 각 경우 뒤 jobBusy 가 풀린다. health-gates/admin.mjs(STRICT): admin.js 가 비교하는 단계 이름 문자열('요청 내용 적용','감사 실패를 실패로 끝낸다','저장')이 admin-apply.yml 의 `- name:` 에 모두 있다 · 🚨 단계 env 에 steps.apply.outcome 이 있다. red 증명: applyAction 을 옛 한 줄 문구로 되돌리면 드라이버 세 줄이 ❌; yml 의 '요청 내용 적용' 이름을 바꾸면 정적 대조 ✕.

소급: 없음(문구·알림 본문). 지금 열린 admin-apply 라벨 이슈는 없다(버튼 실행 0회).

파일: _admin/admin.js .github/workflows/admin-apply.yml verify/verify-admin.js

위험: (없음)

---
## [admin-F10] P3 · needs-human
**결정(추천안 ②): admin-apply.yml 에 '시험 실행'(dry_run 입력 — 요청 적용 + 데이터 감사까지만, 저장·push 안 함) 스위치를 만든다. 실제로 돌려 보는 것은 오케스트레이터가 나중에 한다.**

이유: 사실이다. GitHub 실행 기록(gh api …/admin-apply.yml/runs): total_count 7 — workflow_dispatch 는 31318681754(2026-08-09 success) 한 번뿐, 나머지 6개는 09-30 00:56~01:41Z push 실패(jobs 0 — admin-F11). data/admin-log.json 은 지금 19건으로 늘었지만(10-04 조세현 activitySource·addBoard 18:41-18:44 KST, Claude linkFix 14:11·19:06 KST 등) 모두 세션의 로컬 실행 커밋(3506962b 조세현 · 3ae5a6a8·08f663d7 Claude)이고 Actions 실행은 0회 늘었다. 그 사이 동작 23종 중 다수(활동 5·소식 6·원문 2 등)와 워크플로 변경(ref: github.ref_name · git add 목록 · 중복 with: 수리)이 Actions 에서 돈 적이 없다. 이번 검증에서 저장 단계의 git add 대상 14개 파일이 기본 브랜치에 모두 있는 것은 확인했다(없으면 bash -e 로 저장 단계가 넘어진다). 실행으로 증명하려면 버튼을 누르거나 워크플로를 깨워야 해서(이번 검증 규칙상 금지 · 열쇠는 개발자에게만 있다) 사람 결정이 필요하다.

수리 명세: (없음)

관문: (없음)

소급: (없음)

파일: .github/workflows/admin-apply.yml data/admin-log.json

위험: (없음)

---
## 손대지 않는 것 (이미 고쳐짐·오진·다른 세션·사람 결정 대기)
- [admin-F3] already-fixed: 증상은 다른 세션 커밋 dbcddef3(2026-10-04 04:39Z · 「원문 링크 손볼 것」)이 고쳤고 그 브랜치는 기본 브랜치에 합쳐졌다(origin/claude/source-link-integrity 가 기본 브랜치에 0커밋 앞섬). tools/build-admin-preview.mjs VENDOR_SRC 에 activity-kind.mjs·news-kind.mjs·link-fix.mjs 가 들어갔고 VENDOR 에 vendor/source-link.js 도 들어갔다. 버리는 작업트리(4ba7da49)에서 `node too
- [admin-F11] already-fixed: 실행 기록이 진단과 같다: 36652725658·36652729517·36652729679(09-30 00:56Z)·36655321046(01:29Z)·36655768143(01:34Z)·36656324138(01:41Z) — event push, conclusion failure, jobs 0개(잘못된 워크플로 파일). 원인 5e69767c(00:56:22Z)가 체크아웃 단계에 `with: ref: ${{ github.ref_name }}` 블록을 하나 더 붙여 기존 `with: ref: claude/nice-heisenberg-
- [admin-F12] already-fixed: 다른 세션 커밋 dbcddef3(2026-10-04 04:39Z)이 admin-apply.yml:22 description 에 newsKind / newsHide / newsUnhide / newsThumbOff / newsThumbOn / newsSource / linkFix / linkUnfix 를 더했고, 그 브랜치는 기본 브랜치에 합쳐졌다. 기본 브랜치에서 description 목록(23종)과 tools/admin-apply.mjs 의 `case` 목록(confirm revert unblock remove register f

# 수리 명세 — 묶음 ci

권장 순서: 0. 먼저 origin/claude/nice-heisenberg-WESq5(4bc2df37 이상)를 이 브랜치에 합친다. verify-ui.yml(+link-fix.mjs 줄)·test-collector.mjs(251줄)·app.js·sw.js 가 기본 브랜치에서 바뀌었고, source-link-integrity 는 이미 기본 브랜치에 들어갔다. → 1. ops-01(app1-01·app2-F3① 포함): verify/open-form-sample.cjs 를 새로 만들고 verify-registered.js 를 고친다. 로컬 PORT= 로 수정 전 rc=1, 수정 후 rc=0 을 확인한다. → 2. ops-02(app1-02·admin-F7·app2-F3② 포함): verify-ui.yml 의 드라이버 루프를 실패를 모으는 꼴로 바꾸고, 뒤 단계에 !cancelled() 를 달고, 경보 본문을 고친다. → 3. verify/health-gates/ci.mjs 를 만들고(①②, 이어서 ③④) verify/health-gates.mjs 의 PARTS 에 'ci' 를 넣는다. 각 줄을 되돌려 red 를 확인한다. → 4. new-ui-tone-boot-dot: 그 세션(start-work-9737a2)이 이미 고쳤는지 확인한다. 안 고쳤으면 style.css 의 :root 토큰과 var() + DESIGN.md + sw.js 번호를 고친다. ui-tone 75/75 를 확인한다(천장은 그대로). → 5. ops-03: device-deploy.yml 에 actions: write 와 '화면 검사 깨우기' 단계를 넣는다. test-collector 로 배포를 막는 것은 개발자 답을 받은 뒤에 한다. → 6. app1-07: collector/essay-unknown-fields.mjs 를 만들고 schematize-forms.mjs 리포트에 절을 더한다. → 7. 전부: node verify/health-gates.mjs ci → DOC_GATES=1 node verify/test-collector.mjs → node verify/audit-data.js → 로컬 드라이버 전부(PORT=) → push 뒤 verify-ui 초록불과 이슈 #389·#390 자동 닫힘을 확인한다.
예상 손댈 파일: verify/verify-registered.js verify/open-form-sample.cjs .github/workflows/verify-ui.yml .github/workflows/device-deploy.yml verify/health-gates/ci.mjs verify/health-gates.mjs collector/schematize-forms.mjs collector/essay-unknown-fields.mjs style.css DESIGN.md sw.js

검증 메모: CI 관문(verify-ui)은 지금도 빨간불이다. 마지막 실패는 10:02Z 실행 37193935701 이고, 원인은 verify-registered.js 가 '마감 전 양식 공고'를 실데이터에서 하나도 못 찾는 것이다. 고치면 한 군데가 더 드러난다(아래 3).

1. 재현과 수리안 실측: 버림용 워크트리(4bc2df37 = 기본 브랜치 끝, PORT=8793, 저장소 chromium-1194)에서 확인했다.
   - verify-registered.js 를 그대로 돌리면 'SKKU registered visible: 0 … 대체 구동: 없음' rc=1 로 CI 와 같다.
   - 수리안을 흉내 내 돌리면 'gate-open-form(←reg-hi-jeju) | 문서 생성: true' rc=0 이다.
   - 내장 양식 폴백 길도 rc=0 이다. 칸이 적은 가짜 항목은 PAGEERROR 로 죽어서, 실제 항목을 복사하는 쪽으로 fixSpec 에 반영했다.

2. 그 상태로 CI 목록 전체를 로컬에서 돌렸다.
   - 드라이버 26개 전부, DOC_GATES=1 test-collector('수집기 규칙 전부 통과'), drive.js 는 통과했다.
   - ui-tone.mjs 만 실패했다. 로그는 scratchpad/verify-ci/logs/ 에 있다.

3. 그래서 verify-registered 를 고친 직후에도 CI 는 ui-tone 으로 빨갛다.
   - 원인은 58a3a525(start-work-9737a2 세션, 09:54Z)의 `.boot-dot { fill: #d9b56a }` 하나다. 천장 75 를 76 으로 넘었다.
   - 단계 16이 앞 실패로 skipped 라 CI 에는 한 번도 안 보였다. ops-02 의 피해를 보여 주는 실물 증거다.
   - 그 세션이 활동 중이라 other-session 으로 두었고, 안 고쳤으면 이 묶음이 고친다.

4. 다른 세션 확인: origin/claude/source-link-integrity 는 이미 기본 브랜치에 합쳐졌다(`merge-base --is-ancestor` 참). 3점 diff 가 비어 있어 이 묶음 파일과 겹치는 미병합 작업은 없다. 다만 이 점검 브랜치(46f08990)가 기본 브랜치보다 뒤처져 verify-ui.yml·test-collector.mjs 가 다르니 먼저 합친다.

5. 묶음 밖에서 지나가다 본 것(P3, 선택):
   - 경보 이슈 #389 와 #390 이 같은 시각(03:57:53Z)에 둘 다 생겼다. 기본 브랜치 실행과 main 실행이 동시에 실패해 둘 다 '열린 이슈 없음'을 보고 만든 경쟁이다.
   - 닫기 단계가 둘 다 닫아 주므로 해는 작다. 고친다면 이슈를 여는 것을 기본 브랜치 실행에만 두거나, 만든 뒤 다시 조회해 늦은 쪽을 닫는다.

6. 정리: 쓰기는 scratchpad/verify-ci/ 안에서만 했다. 워크트리는 제거했고 저장소 작업 트리는 깨끗하다.


---
## [ops/ops-01] P1 · confirmed

이유: 지금(10-04 10:02Z)도 빨간불이다. verify-ui 실행 #420~#439 가운데 취소되지 않은 것은 전부 실패했다. 가장 최근은 run 37193935701(main, 4bc2df37)로 로그가 '대체 구동(마감 전 양식 공고): 없음 | 문서 생성: false / ERRORS: 마감 전 양식 공고를 하나도 구동하지 못했습니다'이고, 이슈 #390 에 코멘트 15개가 달렸다. 원인 코드는 HEAD 와 기본 브랜치 끝이 같다. verify/verify-registered.js:40 `if (!ids.length) return { id: null, ok: false };` 가 :58 의 표본 심기(`ids.length && tried.every(…잠김…)`)보다 먼저 빠져나간다. 데이터는 기본 브랜치 끝 data/registered.json 으로 확인했다. formId 가 있는 19건은 모두 forms.json 에 양식이 있는데, 마감 전인 것은 auto-ent2431266737artclviewdo(10-30) 하나이고 schoolOnly 가 한국외국어대학교다. reg-hi-jeju·reg-hi-jeongeup 은 마감이 없고 listedAt 이 07-16 이라 notStale(match-engine.js:734, 60일 규칙)에 걸려 숨는다. reg-dongsan(10-02)은 app.js:331 CLOSED_KEEP_DAYS=1 과 :1922 필터 때문에 UTC 10-04 부터 목록에서 빠졌다. 로컬 재현: 4bc2df37 워크트리, PORT=8793 에서 같은 출력이 나오고 rc=1. 수리안을 손으로 흉내 내 같은 데이터로 돌렸더니 'gate-open-form(←reg-hi-jeju) | 문서 생성: true · ERRORS: none' rc=0 이었다. 그 상태로 드라이버 26개 전부, DOC_GATES=1 test-collector, drive.js 도 통과했다. 실데이터에 기대는 관문이라는 진단이 맞고, 새 커밋(06a34cc7·b444b603·source-link 병합)으로 고쳐지지 않았다.

수리 명세: ① 새 파일 verify/open-form-sample.cjs (순수 함수, CommonJS. 드라이버가 require 하고 관문도 같은 함수를 부른다. 베끼지 말 것)
- shouldPlantSample(visibleIds, tried): `!visibleIds.length || (tried.length > 0 && tried.every((t) => /\(신청 버튼 잠김\)$/.test(t)))`. 잠김 말고 다른 이유로 실패한 후보가 하나라도 있으면 false 다. 진짜 고장을 표본으로 덮지 않는다.
- openFormSample(list, templateIds, visibleIds, todayISO, builtinId = 'jobyungdu-apply'): `{ copy, from }` 또는 null 을 돌려준다. 고르는 순서는 다음과 같다.
  ⓐ 화면에 보인 후보(visibleIds) 가운데 formId 가 templateIds 에 있는 것
  ⓑ 목록 전체에서 formId 가 templateIds 에 있는 것. 화면에 보이든 안 보이든 상관없다.
  ⓒ 그것도 없고 builtinId 가 templateIds 에 있으면, 아무 등록 공고 하나(list[0])를 복사하고 formId 를 builtinId 로 바꾼다. forms.js 내장 양식이라 데이터에 기대지 않는다.
  복사본 규칙: 깊은 복사, id = 'gate-open-form', deadline = todayISO + 20일(UTC 날짜 계산이라 달이 바뀌어도 맞다), listedAt = todayISO. eligibility 에서는 schoolOnly·campusOnly·schoolsAny 만 지우고 다른 자격 칸은 그대로 둔다. 원본은 바꾸지 않는다.
  🔴 칸이 적은 가짜 항목을 지어내지 말 것. 이름·기관만 있는 항목을 넣어 봤더니 상세를 열 때 PAGEERROR "Cannot read properties of undefined (reading 'filter')" 로 죽었다(실측). 반드시 실제 등록 항목을 복사한다. ⓒ 길(reg-hufs-yuheungsu + jobyungdu-apply)도 로컬에서 rc=0 으로 확인했다.
② verify/verify-registered.js 의 driveAnyLiveForm
- :40 `if (!ids.length) return { id: null, ok: false };` 를 지운다.
- :58 조건을 `if (shouldPlantSample(ids, tried))` 로 바꾼다.
- :59-68 의 page.evaluate 안에서 고르던 부분을 다음으로 바꾼다.
  `const snap = await page.evaluate(() => ({ list: registeredList, tpl: Object.keys(FORM_TEMPLATES) }));`
  `const pick = openFormSample(snap.list, snap.tpl, ids, new Date().toISOString().slice(0, 10));`
  `if (pick) { await page.evaluate((c) => { registeredList.push(c); renderExplore(); }, pick.copy); … driveOneForm(page, 'gate-open-form') … }`
- 로그 문구: ids 가 비면 `(이 학생에게 보이는 마감 전 양식 공고가 없음 — ${from} 를 복사한 마감 전 표본으로 구동)`, 아니면 지금 문구를 쓴다. 지금은 '실제 후보  가 모두 마감'처럼 빈칸이 찍힌다.
- 주석: 10-03 수리 주석 아래에 10-04 사고(후보 0장 · 이슈 #389/#390)를 한 줄 덧붙인다.
그대로 둘 것:
- 실제 후보가 하나라도 열려 있으면 실제 것을 먼저 몬다.
- 손은 driveOneForm 하나다.
- 표본도 실패하면 errors 에 그대로 넣어 빨간불로 남긴다.
- data/registered.json 의 마감·학교 범위를 고쳐 초록불을 만들지 말 것(원칙 2·6, 가짜 공지 금지).
- app.js 의 CLOSED_KEEP_DAYS·notStale 은 학생 화면 규칙이라 손대지 않는다.

관문: verify/health-gates/ci.mjs 의 ① 「화면 검사 — 양식 표본」 (표본만 쓴다)
- shouldPlantSample([], []) === true. 지금 코드 조건 `ids.length && …` 로는 false 라 red.
- shouldPlantSample(['a'], ['a(신청 버튼 잠김)']) === true.
- shouldPlantSample(['a','b'], ['a(신청 버튼 잠김)','b(문서가 비었다)']) === false. 진짜 고장은 덮지 않는다.
- 픽스처 LIST = [{id:'hufs-only', formId:'f1', deadline:'2026-09-30', eligibility:{schoolOnly:'한국외국어대학교', campusOnly:'서울', schoolsAny:['x'], minGpa:3}}, {id:'no-tpl', formId:'missing'}, {id:'plain', name:'p', eligibility:{}}] 로 openFormSample(LIST, ['f1'], [], '2026-10-04') 를 부르면:
  · from 'hufs-only' (보이지 않아도 고른다)
  · deadline '2026-10-24', listedAt '2026-10-04', id 'gate-open-form'
  · 'schoolOnly'·'campusOnly'·'schoolsAny' in copy.eligibility 가 모두 false
  · minGpa 3 은 그대로
  · LIST[0].eligibility.schoolOnly 는 그대로(원본 불변)
- 달 경계: todayISO '2026-12-20' → deadline '2027-01-09'.
- 보이는 후보 우선: LIST 에 {id:'vis', formId:'f1'} 를 더하고 visibleIds ['vis'] 를 주면 from 'vis'.
- 내장 양식 폴백: openFormSample([{id:'plain', eligibility:{schoolOnly:'A'}}], ['jobyungdu-apply'], [], '2026-10-04') → from 'plain', copy.formId 'jobyungdu-apply'.
- 양식이 하나도 없으면 openFormSample(LIST, [], [], …) === null (빨간불 유지).
- 배선(글자 대조): verify/verify-registered.js 에 `require('./open-form-sample.cjs')`·`shouldPlantSample(`·`openFormSample(` 가 있고 `if (!ids.length) return` 이 없다.
red 증명:
- openFormSample 을 'visibleIds 안에서만 고른다'로 되돌린다 → 픽스처 케이스 ✕.
- shouldPlantSample 을 `visibleIds.length && …` 로 되돌린다 → 첫 줄 ✕.
- 배선: :40 줄을 되살린다 → ✕.
실물 확인(관문 밖): PORT=<내 포트> node verify/verify-registered.js 가 수정 전에는 rc=1('없음'), 수정 후에는 rc=0('gate-open-form(←…) | 문서 생성: true').

소급: 없음. 검사 드라이버만 고친다. 데이터·화면 규칙은 바뀌지 않으므로 소급할 것이 없다.

파일: verify/verify-registered.js verify/open-form-sample.cjs

위험: 낮음. 바뀌는 것은 검사 드라이버뿐이고 앱·데이터는 그대로다. 표본이 실제 공고를 복사하므로, 그 양식 엔진이 진짜로 깨지면 여전히 빨간불이 된다. 다른 세션(source-link-integrity)은 이미 기본 브랜치에 합쳐졌고 이 파일을 건드리지 않았다. 다만 이 브랜치(46f08990)는 기본 브랜치 끝(4bc2df37)보다 뒤처져 있으니 먼저 합친다.

---
## [app1/app1-01] P1 · confirmed

이유: ops-01 과 같은 사고이고 같은 원인이다(verify/verify-registered.js:40 의 이른 반환). 근거로 든 실행 37175886336 과 로컬 재현을 다시 확인했다. 그 뒤로도 #423~#439 가 같은 문구로 실패했다. 인용한 줄 번호(:46·:67)는 지금 파일과 맞지 않는다(지금은 :40·:58). 내용은 같다. 수리안('ids 가 비어도 표본, 학교 범위 지움, 마감 +20일, 그래도 없으면 템플릿으로')은 ops-01 의 fixSpec 에 합쳤다. 다만 '가짜 등록 항목을 만든다'는 실측으로 깨졌다(PAGEERROR). 그래서 실제 항목을 복사하고 내장 양식을 붙이는 쪽으로 고쳤다.

수리 명세: ops-01 과 같은 수리다. 따로 고치지 말고 ops-01 하나로 끝낸다. 이 항목이 함께 적은 .github/workflows/verify-ui.yml 부분은 ops-02 에서 처리한다.

관문: ops-01 과 같다(verify/health-gates/ci.mjs ①).

소급: 없음

파일: verify/verify-registered.js verify/open-form-sample.cjs

위험: ops-01 과 같다.

---
## [app2/app2-F3] P1 · confirmed

이유: ①(실데이터 의존 드라이버)은 ops-01 과 같고, ②(set -e 로 나머지가 통째로 안 돎)는 ops-02 와 같다. 둘 다 지금도 사실이다. 실행 37193935701 의 단계 15가 failure 이고 16·17·18 은 skipped 였다. 이 묶음의 드라이버 10개를 포함한 나머지가 CI 에서 안 돌고 있다는 주장도, 로컬에서 수리안을 흉내 낸 실행으로 확인했다. 드라이버 26개 전부 통과했고, 숨어 있던 실패 하나(ui-tone)가 드러났다. 아래 new-ui-tone-boot-dot 항목을 본다.

수리 명세: ① 은 ops-01, ② 는 ops-02 의 fixSpec 을 따른다. 중복이니 한 번씩만 고친다.

관문: ops-01(ci.mjs ①)과 ops-02(ci.mjs ②)를 따른다.

소급: 없음

파일: verify/verify-registered.js .github/workflows/verify-ui.yml

위험: ops-01·ops-02 와 같다.

---
## [ops/ops-02] P2 · confirmed

이유: 지금도 사실이다. run 37193935701(10-04 10:00Z)의 단계 목록을 보면 15 '화면 검사 (관문)' failure, 16 '말투·토큰 관문' skipped, 17 '수집기·관리자 규칙 관문' skipped, 18 '전 여정 회귀 (drive.js)' skipped 다. verify-ui.yml:145 에 `set -e` 가 있고, 그 줄이 없어도 GitHub 기본 셸이 `bash -e {0}`(로그 'shell: /usr/bin/bash -e {0}')라 맨몸으로 둔 `node "verify/$f"` 는 첫 실패에서 멈춘다. 뒤 단계 셋에는 `if:` 가 없어 기본값 success() 로 건너뛴다. 피해는 실측으로 확인했다. 4bc2df37 에서 verify-registered 를 고친 상태로 전부 돌리니 드라이버 26개·test-collector·drive.js 는 통과했지만 ui-tone.mjs 가 '팔레트(:root) 밖에서 직접 쓴 유채색: 76 (천장 75)'로 실패했다. 이 실패는 58a3a525(09:54Z)가 들여왔는데, 단계 16이 건너뛰어져 CI 에는 한 번도 안 보였다. 이 항목이 막으려는 사고가 지금 실제로 일어나 있다.

수리 명세: .github/workflows/verify-ui.yml (먼저 기본 브랜치 끝을 합칠 것. 4bc2df37 이 paths 에 'collector/link-fix.mjs' 줄을 더했다)
1) '로컬 서버 띄우기' 단계에 `id: server`, '화면 검사 (관문)' 단계에 `id: drivers` 를 붙인다.
2) '화면 검사 (관문)' run 본문에서 `set -e` 줄을 지운다. 드라이버 목록과 순서는 그대로 두고 루프를 다음 꼴로 바꾼다.
   fails=""
   for f in …; do
     echo "── $f"
     timeout 300 node "verify/$f" || { echo "❌ $f"; fails="$fails $f"; }
   done
   echo "failed=${fails# }" >> "$GITHUB_OUTPUT"
   if [ -n "$fails" ]; then echo "❌ 실패한 드라이버:$fails"; exit 1; fi
   🔴 `||` 로 받는 것이 핵심이다. 기본 셸이 bash -e 라서 `set -e` 만 지우면 아무것도 안 바뀐다.
   `timeout 300` 을 다는 이유: 성공 실행 37147128153 에서 가장 긴 드라이버가 76초(verify-settings)였다. 매달린 드라이버 하나가 30분 그릇을 다 먹으면 작업이 '취소'로 끝나고, 취소는 경보가 안 뜬다. 작업 상한 30분은 올리지 않는다(CLAUDE.md '상한을 키워 때우지 말 것').
3) 실행 조건:
   · '말투·토큰 관문'·'수집기·관리자 규칙 관문 (브라우저 불필요)' 에 `if: ${{ !cancelled() }}`
   · '전 여정 회귀 (drive.js)' 에 `if: ${{ !cancelled() && steps.server.outcome == 'success' }}`
4) '🚨 화면 검사가 빨간불이다' 단계:
   · `if: failure()` 는 그대로 둔다. cancelled 를 일부러 안 본다는 주석도 그대로 둔다.
   · env 에 `FAILED: ${{ steps.drivers.outputs.failed }}` 를 더한다.
   · 본문의 '한 드라이버가 넘어지면 `set -e` 로 그 뒤 드라이버는 안 돕니다 — 고친 뒤 다시 돌리면 그때 다음 것이 드러날 수 있습니다' 문단을 바꾼다. 새 문단: '실패한 드라이버: ${FAILED:-없음 — 말투·토큰·수집기 규칙·전 여정 단계를 보세요}. 드라이버는 하나가 넘어져도 끝까지 돌고, 뒤의 값싼 관문들도 같은 실행에서 돕니다.'
5) 주석: 164-170·185-186·222-224 의 '맨 뒤에 둔다' 이유는 남긴다. 각 자리에 '앞 단계가 실패해도 돈다(!cancelled() — 2026-10-04 이전엔 이 조건이 없어 앞이 빨간 날 통째로 건너뛰었다)' 한 줄을 더한다.
그대로 둘 것: 드라이버 목록, paths, concurrency(cancel-in-progress), timeout-minutes 30, 닫기 단계(`success() && 기본 브랜치`), 순수 모듈 단계들.

관문: verify/health-gates/ci.mjs 의 ② 「화면 검사 워크플로 — 한 곳이 넘어져도 그물이 남는다」
- 작은 해석기 stepsOf(yml) 를 만든다. `      - ` 로 시작하는 단계마다 name·if·run 을 뽑는다.
- 해석기부터 표본 YAML 문자열(단계 셋, 그중 하나는 if 있음·run 여러 줄)로 eq 해 무력화를 막는다.
- 그다음 실제 .github/workflows/verify-ui.yml(코드다, 실데이터 아님)에 아래를 단정한다.
  ⓐ '화면 검사 (관문)' run 에 `^\s*set -e\s*$` 줄이 없다.
  ⓑ 같은 run 에서 `node "verify/$f"` 가 나오는 줄마다 `||` 가 붙어 있다.
  ⓒ 같은 run 에 `exit 1` 이 있다.
  ⓓ '말투·토큰 관문'·'수집기·관리자 규칙 관문'·'전 여정 회귀 (drive.js)' 의 if 에 `!cancelled()` 또는 `always()` 가 있다.
  ⓔ 경보 단계 if 는 정확히 `failure()` 다.
  ⓕ 경보 본문에 'set -e 로' 문구가 없다.
red 증명: 고치기 전 verify-ui.yml 로 되돌리면 ⓐⓑⓓⓕ 가 ✕ 이다. 한 단계의 if 만 지워도 ⓓ ✕.

소급: 없음. 워크플로 모양만 바뀐다.

파일: .github/workflows/verify-ui.yml

위험: 낮음~중간. 실패한 실행이 끝까지 돌아 빨간 실행도 길어진다(성공 실행 약 15분과 비슷). drive.js 는 서버 단계가 실패하면 안 돈다. 경보는 여전히 빨간 실행마다 하나다. 다른 세션 충돌: 기본 브랜치 끝이 이 파일 paths 에 한 줄을 더했으니 합친 뒤 고친다. 같은 파일을 app1-07(바꾸지 않기로 함)·ops-03(바꾸지 않음)은 건드리지 않는다. 덧붙임: 이 수리 직후 CI 는 ui-tone 으로 여전히 빨갛다(new-ui-tone-boot-dot). 실패 목록에 그것이 정확히 찍히는지가 이 수리의 실물 확인이다.

---
## [app1/app1-02] P2 · confirmed

이유: ops-02 와 같은 원인(verify-ui.yml:145 set -e 와 뒤 단계 if 없음)이고 지금도 사실이다(run 37193935701 단계 16~18 skipped). 이슈 #383(10-03, 코멘트 24) → #389·#390(10-04) 연속이라는 주장도 이슈 목록으로 확인했다. 수리안 가운데 `if: always() && steps.<setup>.outcome == 'success'` 는 ops-02 의 `!cancelled()`(+ drive.js 만 서버 성공 조건)로 합쳤다. always() 는 취소된 실행에서도 돌아 cancel-in-progress 로 정상 취소될 때 헛일을 한다.

수리 명세: ops-02 와 같은 수리다. 한 번만 고친다. 실패 목록을 경보 본문에 싣는 것도 ops-02 4) 에 들어 있다.

관문: ops-02 와 같다(ci.mjs ②).

소급: 없음

파일: .github/workflows/verify-ui.yml

위험: ops-02 와 같다.

---
## [admin/admin-F7] P2 · confirmed

이유: 같은 원인(ops-02)이다. verify-admin.js·verify-admin-shape.js 는 루프에서 verify-registered.js(4번째) 뒤에 있어 10-04 03:55Z 이후 CI 에서 한 번도 안 돌았다. 로컬 확인: 4bc2df37 에서 verify-registered 를 고친 채 돌리니 둘 다 통과했다. 관리자 화면이 지금 깨진 것은 아니고 확인이 꺼져 있는 상태다. 다른 묶음과 같은 수리라 심각도는 ops-02 에 맞춘다.

수리 명세: ops-02 와 같은 수리다. 한 번만 고친다.

관문: ops-02 와 같다(ci.mjs ②).

소급: 없음

파일: .github/workflows/verify-ui.yml

위험: ops-02 와 같다.

---
## [ops/ops-03] P3 · confirmed

이유: 사실이다. device-deploy.yml 은 actions/checkout 기본 GITHUB_TOKEN 으로 기본 브랜치·main 에 push 하고(:130·:156), 그 push 는 verify-ui 를 깨우지 못한다(파일 주석 :15-19 가 스스로 적었다). 병합 때 검사는 :123 `node verify/audit-data.js` 하나다. 실측: verify-ui 실행이 10-02 15:12Z(#381)에서 10-03 08:06Z(#382)까지 없었다. 다만 심각도는 P2 에서 P3 로 낮춘다. 사람 세션 대부분은 관례대로 기본 브랜치·main 에 직접도 push 해서 verify-ui 가 같이 돈다. 예: 10-04 04:36Z device-deploy #157 과 verify-ui #423 이 같은 커밋, 09:04Z #158 과 #426·#427 도 같다. 구멍은 작업 브랜치 하나만 쓰는 세션일 때뿐이다. 또 verify-ui 는 배포를 막지 않으므로 이 구멍은 '발견이 늦어지는 것'이다.

수리 명세: .github/workflows/device-deploy.yml
1) permissions 에 `actions: write` 를 더한다(contents: write · issues: write 는 그대로).
2) '배포된 내용 요약' 단계 뒤에 새 단계 '화면 검사 깨우기 (배포한 내용으로)' 를 둔다.
   · `if: steps.run.outputs.state == 'deployed'`
   · `continue-on-error: true` (깨우기 실패로 배포가 실패로 보이면 안 된다)
   · env: GH_TOKEN: ${{ github.token }}, REPO: ${{ github.repository }}
   · run: `gh workflow run verify-ui.yml --repo "$REPO" --ref claude/nice-heisenberg-WESq5`
   workflow_dispatch 는 GITHUB_TOKEN 으로도 새 실행을 만든다(push 와 달리 GitHub 이 허용하는 예외). 기본 브랜치로 깨우는 이유가 둘이다. ① 경보를 닫는 단계가 기본 브랜치에서만 돈다. ② main 은 방금 기본 브랜치를 합친 같은 내용이다.
그대로 둘 것:
- 배포를 막는 조건(지금은 audit 하나)
- state 사유와 '다시 돌려도 안 풀리는 사유를 관리자 화면으로 부르지 않는다' 규칙(test-collector 9271 부근 절)
- concurrency 그룹
(개발자가 ①을 고르면 덧붙임) :123 audit 옆에 `node verify/test-collector.mjs` 를 DOC_GATES 없이 둔다(문서 오타로 배포가 멈추지 않게). 실패하면 `git reset --hard origin/$BASE` 하고 state=auditfail(기존 사유를 다시 쓴다. 화면으로 부르지 않는 규칙이 유지된다).

관문: verify/health-gates/ci.mjs 의 ③ 「이 기기에서 배포 뒤 화면 검사를 깨운다」(워크플로 글자 대조, ②의 stepsOf 재사용)
- device-deploy.yml permissions 에 `actions: write` 가 있다.
- if 에 `steps.run.outputs.state == 'deployed'` 가 있고 run 에 `gh workflow run verify-ui.yml` 이 있는 단계가 있다.
- verify-ui.yml 에 `workflow_dispatch:` 가 있다(이걸 지우면 깨우기가 조용히 실패한다).
red 증명: 새 단계나 actions: write 를 지우면 ✕.

소급: 없음

파일: .github/workflows/device-deploy.yml

위험: 낮음. 배포 1회마다 verify-ui 가 약 15분 더 돈다(Actions 분). 같은 ref 의 push 실행과 겹치면 cancel-in-progress 로 하나만 남는다. 깨우기 실패는 continue-on-error 라 배포 결과에 영향이 없다.

---
## [app1/app1-07] P3 · confirmed

이유: 사실이다. verify-essay-ask.mjs 는 essay-playbook.yml:60(주 1회 월 20:37 UTC)에서만 돌고 verify-ui·test-collector·audit-data 에는 없다(grep 0건). 9-29 예약 실행 #13 이 실패했고 2b4d99a1(10-01, #317)이 칸 이름을 가르쳐 고쳤다. 지금은 forms.json 에 generic 이 0이다(로컬 4bc2df37 에서 verify-essay-ask 117/0, guard 108/0). 그러나 수리안('verify-ui.yml 에 verify-essay-ask·guard 를 건다')은 받아들이지 않는다. verify-essay-ask.mjs:27·52 는 로봇이 쓰는 data/forms.json 에 대해 'generic 0'을 단정하고, :455 부근은 코퍼스에 '블라인드 공고 ≥1'을, guard :491 은 collector/essay-sources.json seeds 를 단정한다. 실데이터 단정을 화면 검사에 거는 것은 이번 묶음 사고(ops-01)와 같은 꼴이다(CLAUDE.md '실데이터에 기댄 고정 검사를 관문에 두지 말 것'). 게다가 verify-ui 의 paths 에는 data/ 가 없어 로봇이 forms.json 에 칸을 더해도 돌지 않으므로 증상도 못 잡는다. 학생 화면은 generic 칸에도 일반 질문 3개(storyAsksFor('generic'))를 내므로 깨지지 않는다. 피해는 주간 학습 로봇이 멈추는 것이라 P3 다.

수리 명세: 알림은 같은 날 하되 관문으로 막지는 않는다.
1) 새 순수 모듈 collector/essay-unknown-fields.mjs
   · `unknownStoryFields(templates)` → [{ form, id, label }]
   · 대상: sections[].fields 가운데 `type === 'textarea' && kind === 'story'` 이면서 `essayAskFor(f).kind === 'generic'` 인 칸
   · essay-ask.js 는 createRequire 로 불러 쓴다. 판정을 베끼지 말 것.
   · 이 파일은 불러와도 아무것도 실행하지 않아야 한다(관문이 import 한다).
2) collector/schematize-forms.mjs
   · 이번 실행에서 새로 만든 양식(freeDone·done 의 fid)에만 위 함수를 돌린다.
   · 걸린 칸이 있으면 리포트(이미 이슈로 가는 길)에 다음 절을 더한다: '### 🙋 자기소개서 칸 종류를 못 알아봤어요 — essay-ask.js 에 이 이름을 더해야 학생에게 맞는 키워드 질문이 나갑니다(그대로 두면 월요일 작성 규칙 학습 로봇이 이 칸 때문에 멈춥니다)' + `- 양식id / 칸id — 칸 이름` 목록.
   · 경고만 한다. 종료코드·forms.json 쓰기·데이터 관문은 건드리지 않는다.
하지 말 것:
- verify-essay-ask.mjs·verify-essay-guard.mjs 를 verify-ui.yml 에 그대로 걸지 말 것(위 이유).
- test-collector·audit-data 에 generic 을 오류로 넣지 말 것. 데이터 관문이 빨개지면 자동 등록분이 되돌려진다.
- essay-playbook.yml 의 기존 검사는 그대로 둔다(개발자가 둔 주간 관문).

관문: verify/health-gates/ci.mjs 의 ④ 「새 양식의 모르는 자기소개서 칸을 그날 알린다」
- 픽스처 templates = { t1: { sections: [{ fields: [
    { id:'a', type:'textarea', kind:'story', label:'성장과정' },
    { id:'b', type:'textarea', kind:'story', label:'특이사항 서술' },
    { id:'c', type:'textarea', kind:'fact', label:'특이사항 서술' },
    { id:'d', type:'text', label:'특이사항 서술' } ] }] } }
  → unknownStoryFields(templates) 가 [{ form:'t1', id:'b', label:'특이사항 서술' }] 를 돌려준다.
  로컬 실측: '성장과정' → growth, '특이사항 서술' → generic.
- 배선(글자 대조. schematize-forms.mjs 는 불러오는 순간 실행돼 import 금지 파일이다): 그 파일에 `essay-unknown-fields.mjs` import 와 `unknownStoryFields(` 호출, `report.push(` 안 '🙋 자기소개서 칸' 문구가 있다.
red 증명:
- 함수가 늘 [] 를 돌려주게 하거나 kind 조건을 빼면 ✕.
- schematize 의 호출 줄을 지우면 배선 ✕.

소급: 없음. 지금 forms.json 은 generic 0 이다(로컬 117/0). 리포트 절은 다음 새 양식부터 붙는다.

파일: collector/schematize-forms.mjs collector/essay-unknown-fields.mjs

위험: 낮음. 리포트 글이 늘 뿐이다. schematize-forms.mjs 는 import 하면 실행되는 파일이라 관문은 글자로만 배선을 본다. 다른 세션 변경 파일 목록에 없다.

---
## 손대지 않는 것 (이미 고쳐짐·오진·다른 세션·사람 결정 대기)
- [new-ui-tone-boot-dot] other-session: 이번 검증에서 새로 찾은 것이다. verify-registered 를 고쳐도 CI 는 빨간불로 남는다. 4bc2df37 에서 `node verify/ui-tone.mjs` 를 돌리면 '✕ 팔레트(:root) 밖에서 직접 쓴 유채색: 76 (천장 75) … 3765:#d9b56a' 가 나온다. 이분 탐색 결과 46f08990·6080cf9a 는 75 로 통과하고, 58a3a525(2026-10-04 09:54Z '시작 화면: 오늘 처음 · 4시간 넘게 쉬면 학사모 인트로…', 브랜치 claude/start-work-9737a2, 기본
- [app2/app2-F10] already-fixed: 증상의 사례는 이미 해소됐다. 기본 브랜치 끝(4bc2df37)의 sw.js:26 은 `handaejang-v223` 이다. 마지막 인상은 58a3a525(2026-10-04 09:54Z)이고, 근거로 든 98cc4bbc(04:24Z)·722791c2·6080cf9a(style.css 09:04Z)보다 뒤다(git log -- sw.js · style.css · app.js · index.html). 관문 제안('마지막 sw.js 변경 뒤에 style.css/app.js 가 바뀌었으면 경고')은 git 이력에 기대 앱 커밋마다 울린

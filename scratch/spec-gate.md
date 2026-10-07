# 수리 명세 — 묶음 gate

권장 순서: browser/B1 → gaps/gaps-03 → admin/admin-F2 → gaps/gaps-01 → collect/collect-03 → browser/B9 → collect/collect-13
예상 손댈 파일: parse-requirements.js verify/health-gates/gate.mjs verify/health-gates.mjs verify/test-collector.mjs verify/audit-data.js verify/entry-rules.cjs verify/deadline-audit.mjs verify/source-rules.cjs tools/admin-apply.mjs collector/gate-guard.mjs collector/revert-auto.mjs collector/auto-held.mjs collector/auto-register.mjs collector/pending-queue.mjs collector/schematize-forms.mjs .github/workflows/collect-scholarships.yml .github/workflows/browser-collect.yml .github/workflows/link-hunter.yml .github/workflows/collect-news.yml .github/workflows/refresh-tuition.yml .github/workflows/refresh-majors.yml

검증 메모: 검증 방법: HEAD 46f08990(= 기본 브랜치 + 관문 틀), 버린 worktree 에서 재현 후 제거함(저장소 손대지 않음 · git status 깨끗). HEAD 기준 test-collector·audit-data 둘 다 통과(로그 scratchpad/verify-gate/tc-head2.log · audit-head2.log). 최신 수집 실행 37190037848(08:47Z)은 관문 통과 — 06a34cc7 이후 자동 등록 되돌림 고리는 멈췄고 8건이 registered·main 에 들어갔다. 그 결과 DAAD 가 한국항공대 학부생에게 '지원 자격 미달'로 지금 보인다(B1, what-shows 실측) — 묶음에서 가장 먼저 고칠 것. B1 은 정규식만 고치면 95%(틀린 안심)가 되므로 parseDegree 'both' 갈래의 남는 글자 잣대를 꼭 같이 넣을 것(시제품 실측: 1032 조합 중 DAAD 3건만 바뀜 · eligibility-report --bad 동일 · test-collector 통과). gaps-03 은 '근거 없는 마감 ≤3' 이 지금 정확히 3건이라 P1 로 올렸다 — 10-01 사고와 같은 꼴이 한 건 차이로 대기 중. 병렬 수리 주의: verify/health-gates.mjs 의 PARTS 목록·verify/test-collector.mjs 는 다른 묶음 수리자도 고칠 수 있다 · 다른 세션(source-link-integrity)이 tools/admin-apply.mjs·verify/audit-data.js·verify/test-collector.mjs 를 고치지만 덩어리 위치가 겹치지 않음을 diff 로 확인. CLAUDE.md 는 지금 400줄(부피 관문 한도)이라 문서 반영 때 줄을 줄여야 한다. 개발자에게 물을 것 하나(B9 risk 칸): 브라우저 리포트 이슈 자동 닫기 여부 — 추천은 지금처럼 두기.


---
## [browser/B1] P1 · confirmed

이유: 관문 고리 부분은 06a34cc7 로 끝났지만(위 collect-02), 원인 ①은 그대로이고 지금 학생 화면에 나와 있다. DAAD(auto-notiphpcodes1301seq11193)가 12035004 로 등록·main 배포됐고, `node verify/what-shows.mjs auto-notiphpcodes1301seq11193 --school=한국항공대학교` → '판정 ineligible · 배지 「지원 자격 미달」 · 미달 사유: …학사 및 석사과정 학생'(학부 3학년 프로필 fitDetail fails 1, 5%). 06a34cc7 의 UNDERGRAD_TOO(parse-requirements.js:336)는 `학사\s*[,·ㆍ/]\s*석…과정` 만 받아 '학사, 석사ㆍ박사과정'(파안)은 고쳤으나 '학사 **및** 석사과정'(DAAD 원문 'B1 이상의 독일어 능력을 보유한 학사 및 석사과정 학생' · 2학년 이상 학부생 대상)은 여전히 gradTarget 'body' → 대학원 전용 → 미달. CLAUDE.md '틀린 미달은 못 받는 것보다 나쁘다'. ⚠️ 실측으로 확인한 함정: 정규식에 '및' 만 더하면 이 줄이 parseDegree 의 `grad && under → {degree:'both'}`(parse-requirements.js:676)로 가서 **남는 글자 검사 없이 ✓** — DAAD 가 적합도 95% 가 된다(독일어 B1 을 묻지 않았는데 충족 = 틀린 안심). 학부 갈래(:694-701)에는 '남는 글자 2자 초과면 판정 안 함' 잣대가 있는데 both 갈래엔 없다. 두 수정을 같이 넣은 시제품(버린 worktree)에서: DAAD → '자격 미확인'(unread, fails 0) · 등록+활동 344건×프로필 3종 = 1032 조합 중 바뀐 것은 DAAD 3건뿐 · eligibility-report --bad 전후 동일 · test-collector 통과(정답표 drift 없음).

수리 명세: parse-requirements.js 두 군데만.
① UNDERGRAD_TOO(:336) 의 두 번째 갈래 `학사\s*[,·ㆍ/]\s*석\s?[·ㆍ]?\s*(?:박사)?[^.]{0,8}과정` 의 구분자를 `(?:[,·ㆍ/]|및|와|과|또는|이나)` 로 넓힌다 → '학사 및 석사과정 학생'·'학사 또는 석사과정 재학생' = 학부 포함. `과정` 까지 붙어야 센다는 06a34cc7 의 선은 그대로('학사 및 석사 학위 소지자'·'학사 학위 소지자로서 대학원 진학 예정자'는 학부 아님 — 실측 false 유지). 머리말 주석에 DAAD 실측 한 줄.
② parseDegree(:661~) 의 `if (grad && under) return {kind:'degree', want:'both'}` 앞에 학부 갈래와 같은 '남는 글자' 잣대를 둔다: 앞머리 이름표(`^[^:：]{1,14}[:：]`)·괄호·학위 낱말(학부생?|학사|석사|박사|과정|전문대(학교)?|대학생|대학원생?|대학\(원\)|대학원|일반|전일제|정규|재학생?|재학\s?중(인|이거나)?|학생|신입생|및|또는|이거나|와|과|에|인|\d+\s?(년제|학기|학년)|대학교?)를 걷어낸 뒤 한글이 2자 넘게 남으면 null(판정 안 함 = 모름). 시제품 결과: '대학생 및 대학원 재학생'·'대학생 또는 대학원 학·석·박사 과정 재학생' 은 여전히 both ✓, DAAD 줄은 조건 없음 → 공고 '자격 미확인'.
바꾸지 말 것: 학부 갈래 잣대(2자), 대학원 갈래(잣대 없음 — 주석이 이유를 적어 둠), gradTarget/mentionsUndergrad 가 UNDERGRAD_TOO 한 곳을 쓰는 구조(베끼지 말 것), 제외 줄 불판정(DEGREE_NEGATED).
작업 방식(CLAUDE.md): `node verify/eligibility-report.mjs --bad` 전후 비교 · `node verify/what-shows.mjs auto-notiphpcodes1301seq11193 --school=한국항공대학교` 가 '자격 미확인' · test-collector(정답표 포함) 통과 · audit-data 통과.

관문: verify/health-gates/gate.mjs 「학사·석사 나란히 적은 줄」(표본만 — registered.json 을 읽지 말 것): ① PR.mentionsUndergrad 표 — ['유럽언어기준 B1 이상의 독일어 능력을 보유한 학사 및 석사과정 학생', '학사 또는 석사과정 재학생', '학사, 석사ㆍ박사과정에 재학 중인 학생', '학사 및 석사 학위 소지자', '학사 학위 소지자로서 대학원 진학 예정자', '국내 대학원 석사과정 재학생'] → [true,true,true,false,false,false] ② ME.fitDetail({id:'t',name:'t',eligibilityLines:[DAAD 줄],eligibility:{}}, 학부 3학년 프로필) → [fails.length, unread] = [0, true] (미달도 ✓ 도 아님) ③ PR.parseLine('대학생 및 대학원 재학생',false) 에 degree:both 가 남는다(✓ 길을 죽이지 않았다). 빨간불 증명: ①을 되돌리면 ②가 [1,false] · ②의 잣대를 빼면 [0,false](95%) — 둘 다 ✕.

소급: 데이터 손댈 것 없음 — 판정은 앱이 코드로 매번 다시 한다(소급 자동). main 배포 뒤 what-shows 로 DAAD 가 '자격 미확인'인지 확인. 파안(auto-202026091720eca1b0ed9a8c)은 변화 없음(33% — 실측).

파일: parse-requirements.js verify/health-gates/gate.mjs verify/health-gates.mjs

위험: 정규식·잣대 변경은 엔진 전체 판정에 닿는다 — 시제품 기준 바뀐 조합은 DAAD 3건뿐이었지만 수리 시점 데이터로 같은 비교(fitDetail 전 항목×프로필 · eligibility-report --bad)를 다시 돌려 숫자를 리포트에 적을 것. 다른 세션 변경 파일 아님.

---
## [gaps/gaps-01] P1 · confirmed

이유: 구조 결함이 오늘 HEAD 에 그대로다. ① collector/revert-auto.mjs:24-29 는 'auto:true 이면서 HEAD 에 없던 항목'만 빼고, :31-33 은 '기존 데이터 쪽 문제'라고만 찍고 끝난다 — 되돌린 뒤 관문을 다시 재지 않는다. ② collect-scholarships.yml:238-245 · browser-collect.yml:173-186 의 저장 단계는 관문 결과와 상관없이 data/registered.json·forms.json 을 커밋한다. 실측: 8f4bb49 → a31a8538(수집 37169572702, 관문 실패) 에서 기존 항목 파안장학 자격 줄 0→8줄이 저장됐고, b364d997(브라우저 37171328367, 관문 실패) 에서 일운(auto-0ec82aced95admoddocument) 0→6줄이 저장됨(git show 로 확인). ③ 링크 사냥꾼 37171951136: '데이터 감사' 단계 outcome failure(continue-on-error 라 표시는 success) → '감사 실패 시 되돌리기'·'🚨 되돌렸음을 알린다' 실행 · '결과 저장' skipped · **실행 결론 success**(link-hunter.yml:122-124 알림 단계가 continue-on-error 라 exit 1 이 없다). 이슈 #381 코멘트에 링크 사냥꾼 '결과 전량 폐기' 4회(37112370475·37121988077·37170293698·37171951136) — 전부 초록불. collect-news.yml:103-122 도 되돌림+이슈 뒤 news-sources.json 등은 저장하고 초록불. rescue-bodies.yml 만 exit 1. ④ 이번 원인은 06a34cc7 이 고쳤지만, 같은 꼴(실데이터 단정)이 test-collector 에 더 있어(gaps-03 — '근거 없는 마감 ≤3' 이 지금 정확히 3건) 다음 빨간불도 같은 길을 탄다. CLAUDE.md 「로봇 · 워크플로」 '감사 실패면 결과가 하나도 안 남는다'와도 어긋난다.

수리 명세: 새 파일 collector/gate-guard.mjs (CLI + 내보내는 순수 함수 · `if (import.meta.url === pathToFileURL(process.argv[1]).href)` 로만 실행 — 불러오는 순간 실행 금지) 하나에 '단계별 되돌리기 + 관문 다시 재기'를 둔다.
사용: `node collector/gate-guard.mjs --report <리포트 파일> --stage auto --stage data/registered.json,data/forms.json,collector/pending-forms.json` (단계는 순서대로 · `auto` 는 특수 단계 = 지금 revert-auto 의 '이번 실행 새 auto 항목 빼기'). 관문 명령은 환경변수 GATE_CMD(기본 `node verify/test-collector.mjs && node verify/audit-data.js`), 저장소 뿌리는 cwd.
동작: 단계를 하나 적용할 때마다 관문을 다시 돌린다(출력 저장 · `✕`/오류 줄 앞 5개를 모은다). 통과하면 멈춘다. 결과 status = 'reverted-auto'(auto 단계로 통과) | 'reverted-files'(파일 단계로 통과) | 'still-failing'(모든 단계 뒤에도 실패 = 원인이 기존 데이터나 다른 파일). 파일 단계는 `git show HEAD:<path>` 바이트 그대로 되쓰기(디렉터리는 `git checkout HEAD -- <dir>` + `git clean -fdq <dir>`) — JSON 을 다시 직렬화하지 말 것(형식 충돌 · CLAUDE.md 매 세션 4). `auto` 단계는 지금 revert-auto 로직(HEAD 의 id 집합 대조)을 쓰되 JSON.stringify(cur,null,1)+'\n' 로 저장(지금과 같음) · 뺀 id 를 collector/pending-forms.json 대기열에서도 지운다(collect-13). 마지막에 $GITHUB_OUTPUT 에 `gate=<status>`·`removed=<n>` 를 적고 **항상 exit 0**(예상 못 한 예외만 exit 1).
리포트(--report 파일): '### 🤖 자동 등록 (선조치후보고) — N건 등록' 줄을 '— N건 등록 시도 · ↩ 데이터 관문에 걸려 되돌림' 으로 바꾸고 바로 아래에 인용문 한 단락: status 별 문장(reverted-auto: '새 자동 등록 n건(id…)을 되돌렸습니다 — 같은 실행의 다른 결과는 저장' / reverted-files: '이번 실행의 정식 등록 변경(자동 등록·발췌·범위 승격·교내 판정)을 저장하지 않았습니다 — 위 문단의 숫자는 시도한 것입니다' / still-failing: '되돌린 뒤에도 관문이 빨갛습니다 — 원인은 기존 데이터나 다른 파일 · 사람 확인') + 걸린 검사 이름 5개. 그 줄이 없으면 파일 끝에 같은 단락.
collector/revert-auto.mjs: 로직을 gate-guard 로 옮기고 이 파일은 `--stage auto` 만 부르는 얇은 CLI 로 남긴다(다른 문서·주석이 이 이름을 가리킨다 — admin-apply.mjs:432 · verify-admin-vendor.js:22 · entry-rules.cjs:96).
워크플로:
· collect-scholarships.yml · browser-collect.yml — '감사 실패 시 자동 등록분 되돌리기' 단계에 `id: guard` · `timeout-minutes: 3` · `run: node collector/gate-guard.mjs --report collector/report.md --stage auto --stage data/registered.json,data/forms.json,collector/pending-forms.json || git checkout -- data/registered.json data/forms.json collector/pending-forms.json` (브라우저는 --report collector/browser-report.md). 작업 상한은 단계 합이 3 늘었으니 관문 「일반 수집 예산」(limit > 합+3) 셈법대로 collect 56→59 · browser 50→53, 주석에 '관문 다시 재기 3분'(상한을 키워 때우는 것이 아니라 새 단계의 몫). 저장 단계는 그대로(되돌린 뒤의 registered 는 관문을 통과한 판이거나 HEAD 판이다). 파일 맨 끝(🚨 failure()||cancelled() 알림 **뒤**)에 `🚨 관문이 끝내 빨간불` 단계: `if: steps.guard.outputs.gate == 'still-failing'` → gh issue create(제목 '🚨 데이터 관문이 되돌린 뒤에도 빨간불 — <로봇 이름> <날짜>', 본문 = 리포트의 그 단락 + 실행 로그 주소) 후 `exit 1`. (failure() 알림 뒤에 둬야 '이번 수집분은 저장되지 않았습니다'라는 틀린 문구가 안 붙는다.)
· link-hunter.yml — '🚨 되돌렸음을 알린다' 뒤, 업로드 단계 뒤 맨 끝에 `if: always() && steps.audit.outcome == 'failure'` · continue-on-error 없이 `exit 1` 단계(사냥 결과를 버렸으면 빨간불 → 하트비트 robot-heartbeat.mjs 의 '마지막 성공'에도 잡힌다).
· collect-news.yml — 되돌리기 단계를 `id: guard` + `node collector/gate-guard.mjs --report collector/news-report.md --stage data/news,collector/seen-news.json,collector/news-thumbs.json --stage collector/news-sources.json`(timeout 1→3)로 바꾸고, 맨 끝에 still-failing 이면 exit 1. 이슈 생성 단계는 그대로. 상한 35 → 단계 합(31+2+1=34)+3 보다 크게 38, 주석의 합계 줄도 고친다(관문 「교내 소식」 :2268). 관문 :2272 의 `if: steps\.audit\.outcome == 'failure'` 문자열은 유지.
⑤ 같은 공고 무한 반복 끊기(collect-02 ③): 새 순수 모듈 collector/auto-held.mjs — `recordReverts(ledger, ids, today)`(reverts+1, lastAt=today) · `isHeld(ledger, id, today)`(reverts≥2 이고 lastAt 로부터 3일 안) · `pruneRegistered(ledger, ids)`. 장부 collector/auto-held.json `{_comment, items:[{id,reverts,lastAt}]}` (JSON.stringify(x,null,1)+'\n'). gate-guard 는 status 가 reverted-auto 일 때만 뺀 id 를 기록(파일 단계까지 간 경우는 새 등록분이 무고할 수 있어 기록 안 함). auto-register.mjs: 시작 때 등록된 id 를 장부에서 지우고, verdict 'register' 인 공고의 id 가 isHeld 면 `held.push({n, why:'데이터 관문에 n번 걸려 되돌린 공고 — 3일 쉬었다 다시 봅니다'})` 후 continue(상한 maxPerRun 을 먹지 않는다). 두 워크플로 저장 단계에 `[ -f collector/auto-held.json ] && git add collector/auto-held.json`(이슈 #79 규칙).
바꾸지 말 것: auto-register 를 import 하지 말 것(불러오는 순간 실행) · 저장 위치 원칙(기본 브랜치만) · 대기줄(concurrency) · 0건 이슈 대신 코멘트 관례 · registered/forms 저장 형식.

관문: verify/health-gates/gate.mjs 「데이터 관문 되돌리기」 — 실데이터 없이 임시 git 저장소로 잰다: mkdtemp → git init → data/registered.json {items:[{id:'old',auto:true,v:1}]} · data/forms.json · collector/pending-forms.json {items:[{id:'old'}]} 커밋 → 가짜 관문 check.cjs(registered 에 bad:true 항목이 있으면 exit 1, 아니면 0)를 GATE_CMD 로. ㉠ 새 auto 'n1'(bad) 추가 → status reverted-auto · 'old' 수정은 남는다 · pending 에서 n1 제거 ㉡ 기존 'old' 를 bad 로 고치고 새 auto 'n2'(정상) 추가 → status reverted-files · registered.json 바이트 = HEAD 바이트 ㉢ HEAD 자체에 bad → status still-failing · exit code 0 · GITHUB_OUTPUT 파일에 gate=still-failing ㉣ 리포트 표본('### 🤖 자동 등록 (선조치후보고) — 2건 등록')에 '↩ 데이터 관문에 걸려 되돌림' 단락이 들어간다 ㉤ auto-held: recordReverts 두 번 → isHeld(오늘) true · 4일 뒤 false. 정적 검사(주석 걷고): collect-scholarships·browser-collect 에 `gate-guard.mjs --report` · `steps.guard.outputs.gate == 'still-failing'` 단계가 `exit 1` 로 끝나고 `failure() || cancelled()` 알림보다 뒤 · link-hunter·collect-news 에 continue-on-error 없는 `steps.audit.outcome == 'failure'` → exit 1 단계 · auto-register.mjs 가 './auto-held.mjs' 에서 isHeld 를 불러 쓴다(소스 대조 — import 금지). 빨간불 증명: gate-guard 를 '다시 재지 않는' 옛 revert-auto 동작으로 되돌리면 ㉡이 reverted-auto 로 남아 ✕ · 워크플로의 exit 1 단계를 지우면 정적 검사 ✕.

소급: 소급할 데이터 없음 — 이번 사고로 저장된 기존 항목 수정(파안·일운 자격 줄)은 06a34cc7 이 규칙을 고쳐 지금 정상 판정이다(파안 33% · 일운은 대학원 전용 → 미달). 장부 auto-held.json 은 첫 되돌림 때 로봇이 만든다(손으로 만들지 말 것).

파일: collector/gate-guard.mjs collector/revert-auto.mjs collector/auto-held.mjs collector/auto-register.mjs .github/workflows/collect-scholarships.yml .github/workflows/browser-collect.yml .github/workflows/link-hunter.yml .github/workflows/collect-news.yml verify/health-gates/gate.mjs verify/health-gates.mjs

위험: ① 관문을 최대 두 번 더 돌려(test-collector 로컬 실측 ~23초) 실행이 1분쯤 길어진다 — 작업 상한 셈을 반드시 관문 「일반 수집 예산」·브라우저 예산 절(test-collector :1047·:1431)·「교내 소식」(:2268) 대로 맞출 것. ② 'reverted-files' 는 그 실행의 기존 공고 개선(발췌·범위 승격)도 버린다 — 원인을 사람이 고칠 때까지 매 실행 같은 일이 반복되지만, 이제 빨간불+이슈로 드러난다(의도). ③ test-collector 의 기존 정적 검사가 워크플로 문자열을 잰다(:2272 등) — 단계 이름·`steps.audit` 문자열을 지우지 말고 더할 것. ④ CLAUDE.md 가 지금 정확히 400줄(관문 「CLAUDE.md 부피」 한도) — 문서에 줄을 더하려면 다른 줄을 줄여야 한다. ⑤ 다른 세션은 이 워크플로들을 안 고친다(목록에 없음).

---
## [admin/admin-F2] P2 · confirmed

이유: 버린 worktree(HEAD 46f08990)에서 셋 다 재현: ⓐ ACTION=activitySource op:add evidence '학교 공지 확인'(8자) → 저장값 그대로(tools/admin-apply.mjs:857 `String(s.evidence||'').trim() || …`) · audit-data exit 0 · test-collector exit 1 '✕ 주소가 있는 항목은 확인한 근거(evidence)를 적는다'(test-collector.mjs:1666 `length > 10`). 관리자 화면 입력칸(_admin/admin.js:2526)은 길이 제한이 없다. 소식 출처 add 는 이미 날짜 도장을 붙인다(admin-apply.mjs:997-998). ⓑ newsSource park(경희 BMSR00040) → add(https://example.ac.kr/new-notice) → unpark → audit 0 · test-collector '✕ 출처 학교는 전부 서비스 학교 · 게시판이 있는 줄은 학교 하나에 하나'(:2018). unpark(admin-apply.mjs:1005-1015)는 add 의 '이미 게시판이 있는 학교는 거절'(:1000)을 안 본다. ⓒ edit reg-sejong-didim deadline 2026-08-31→2026-12-30 → period '신청 2026.7.6(월) ~ 8.31(월) 18:00' 그대로(tools/edit-diff.mjs:237-246 periodAfterDeadline 은 '원문 확인'만 바꾼다) · audit 0 · test-collector '✕ 화면 문구의 끝 날짜와 마감이 어긋난 공고가 없다'(:9958). 관리자 관문(admin-apply.yml:67-71)은 audit-data 하나라 이 셋이 저장되고, 다음 로봇 실행 10곳의 데이터 관문이 빨개진다. 실제 발생 기록은 없어 P2(잠복) — 단 터지면 gaps-01 연쇄 전체.

수리 명세: 원칙: '관리자가 고치는 데이터의 불변식'은 test-collector(코드 규칙 관문)가 아니라 두 길(로봇·관리자)이 같이 도는 데이터 감사에 둔다 + 관리자 저장소가 같은 규칙으로 먼저 거절해 화면이 사유를 말한다.
① 새 CJS 모듈 verify/source-rules.cjs (순수 함수 · 파일을 읽지 않는다): `activitySourceProblems(src, served)` — boardUrl 있는 줄은 evidence 문자열 길이 > 10 · 학교는 served 안(전국 글은 host) · 집계 사이트 아님 / `newsSourceProblems(src, schoolNames)` — 학교는 schools.json 안 · boardUrl 있는 줄은 학교당 하나 · boardUrl 줄은 autoFound(rows ≥ MIN_ROWS — 값은 find-news-boards 에서 받아 인자로) 또는 evidence > 10. 반환 [{msg}]. (집계 사이트 정규식은 다른 세션이 admin-apply 에 AGGREGATOR_RE 로 뽑고 있다 — 합칠 때 하나로.)
② verify/audit-data.js: 위 두 함수로 collector/activity-sources.json·collector/news-sources.json 을 보고 **오류**로 넣는다. test-collector.mjs :1666(activity evidence)·:2018·:2020(news 한 학교 하나·근거) 실데이터 단정은 지우고 그 자리에 '감사가 source-rules 로 본다' 정적 대조 한 줄.
③ 마감↔문구: verify/deadline-audit.mjs 의 `lastDateIn`(순수 · :68)을 verify/entry-rules.cjs 로 옮겨 export(브라우저 감쌈에도 안전 — 정규식뿐) · deadline-audit.mjs 는 createRequire 로 불러 쓴다(베끼지 말 것). checkEntry 에 오류 규칙: `!it.program && it.deadline && it.period` 이고 `lastDateIn(it.period, it.deadline.slice(0,4))` 가 있고 deadline 과 다르면 error '화면 문구의 끝 날짜(X)와 마감(Y)이 다릅니다 — 문구(period)도 같이 고치세요'. (auto-register 는 checkEntry 오류를 '컨펌 대기'로 보내므로 — auto-register.mjs:377-381 — 자동 등록이 멈추지 않는다.) test-collector :9958 실데이터 단정은 표본(checkEntry 에 어긋난 항목 하나·맞는 항목 하나)으로 바꾼다.
④ tools/admin-apply.mjs: activitySource add 의 evidence 를 newsSource 와 같은 꼴 `${typed ? typed + ' · ' : ''}관리자 화면에서 등록 (${kstNow()} KST)`(작은 함수 하나로 두 곳이 같이 쓴다) · newsSource unpark: 되살릴 줄의 학교에 boardUrl 있는 줄이 이미 있으면 fail('… 은 이미 게시판이 있습니다 — 되살리려면 지금 줄을 먼저 보관하세요') · edit: 패치를 적용한 항목에 checkEntry 를 돌려 위 ③ 오류가 새로 생기면 fail(문구) — 패치에 period 가 같이 오면 통과. 저장 전 source-rules 로도 확인.
바꾸지 말 것: entry-rules 의 '사람 판단을 기계가 잠그지 않는다' 경고들(교외 판정 등)은 경고 그대로 · edit-diff.mjs 는 브라우저로 실리므로 deadline-audit(fs 사용)를 import 하지 말 것(verify-admin-vendor.js 가 잡는다) — 미리보기 경고가 필요하면 entry-rules(이미 vendor/entry-rules.js 로 실림)의 checkEntry 를 화면에서 부른다.

관문: verify/health-gates/gate.mjs 「관리자 저장 = 로봇 관문」: test-collector 의 기존 꼴(:1744 runAct · :2323 hdj-news — mkdtemp 에 표본 파일을 깔고 spawnSync admin-apply, cwd=임시 폴더)대로. ⓐ activitySource add evidence '학교 공지 확인' → status 0 이고 저장된 evidence 길이 > 10 · source-rules 문제 0 ⓑ newsSource park→add(새 주소)→unpark → 마지막 unpark status ≠ 0 · 파일에 그 학교 boardUrl 줄 하나 ⓒ registered 표본 {id:'t1', deadline:'2026-08-31', period:'신청 2026.7.6(월) ~ 8.31(월) 18:00', …필수칸} 에 edit deadline 2026-12-30 → status ≠ 0 · 파일 그대로 / period 같이 주면 status 0. ⓓ 순수 함수 표: checkEntry(어긋난 표본) 에 level 'error' 하나 · lastDateIn 기존 표(test-collector :9940 대) 그대로. 빨간불 증명: admin-apply 의 세 가드를 하나씩 빼면 ⓐ/ⓑ/ⓒ 가 ✕.

소급: 지금 데이터는 세 규칙을 다 통과한다(HEAD test-collector 통과 실측) — 고칠 데이터 없음. 옮긴 뒤 `node verify/audit-data.js` exit 0 확인.

파일: verify/source-rules.cjs verify/audit-data.js verify/entry-rules.cjs verify/deadline-audit.mjs tools/admin-apply.mjs verify/test-collector.mjs verify/health-gates/gate.mjs

위험: 다른 세션(origin/claude/source-link-integrity)이 tools/admin-apply.mjs(:847-853 집계 사이트 정규식 · :1020 뒤 linkFix 88줄)·verify/audit-data.js(:403 한 줄)·verify/test-collector.mjs(:2063 소식 절 · :9367 · :11168)를 고친다 — 우리 자리(:857 · :1005-1015 · audit 새 블록 · test-collector :1666/:2018-2020/:9958)와 겹치지 않지만 :2018-2020 은 그들 :2063 덩어리와 45줄 거리라 병합 때 눈으로 볼 것. entry-rules.cjs 에 오류 규칙을 더하면 관리자 화면(vendor)에서도 같은 판정이 돈다 — verify-admin-vendor.js 를 돌려 확인.

---
## [gaps/gaps-03] P1 · confirmed

이유: test-collector.mjs 에 실데이터 단정이 여전히 많고(실데이터 파일 읽기 26곳 — grep), 그중 하나는 **지금 선 위에 서 있다**: HEAD 관문 출력 '✓ 근거 없는 마감이 3건을 넘지 않는다 (지금 3건: auto-rnoticedoarticleno154473, auto-c839d20ec84a0ebb09c20202, auto-09c6eab8b020ec9ea5ed9599)'(:9952 근처 `noEvidence.length <= 3`) — 로봇이 근거 문구 없는 마감 하나만 더 넣어도 10-01 사고(CLAUDE.md 「장학금 판정 자동화」 '근거 없는 마감이 4건이 되어 … 자동 등록 8건이 되돌려졌다')가 그대로 재발한다. 그래서 원 등급 P2 → P1. 등록금: :6013-6016 `eq('표에는 1년치가 들어 있다 (외대 인문사회)', yearly, 7269500)` + :6019 '한 학기 약 360만원' 범위도 실값 — refresh-tuition.yml(:48-58)·refresh-majors.yml 은 test-collector·audit-data 를 한 번도 부르지 않고 저장한다(grep 0) — 등록금 갱신 한 번이면 모든 로봇 관문이 빨개진다(갱신은 수동 실행이라 지금은 조용함). 시간이 지나면 0이 되는 '실제로 있다' 단정도 있다: :10763 '접수 메일 주소가 들어 있다'(지금 11건 · 마감 10-30 이 마지막 → notStale 로 11월 말 모두 빠질 수 있음) · :10848 '포털 시스템이 들어 있다' · :9499 '등록된 교내 게시 공고가 있다' · :6580 '목록과 상세가 다른 공고가 실제로 있다' · :7837 photoNote '지금 3건'. 06a34cc7 은 이 꼴 중 한 줄만 옮겼다.

수리 명세: 원칙(CLAUDE.md '실데이터에 기댄 고정 검사를 관문에 두지 말 것' · 10-01 data-weight 선례): test-collector 는 코드 규칙만 표본으로 잰다. 실데이터는 ⓐ 항목 하나의 불변식이면 audit-data(오류 — entry-rules checkEntry 또는 source-rules · admin-F2 와 같은 자리) ⓑ 개수 문턱·'있어야 한다'·특정 값이면 표본 단정 + `console.log('  ℹ …')` 숫자 보이기(빨간불 아님).
1단계(이번 수리 — 위험한 것부터): ① :9952 근처 '근거 없는 마감 ≤3' → ℹ 줄(목록·개수만) — 근거 찾기 규칙은 lastDateIn 표본 검사가 이미 잰다 ② '등록일에서 1년 넘게 먼 마감이 없다' → ℹ 줄 ③ '화면 문구의 끝 날짜와 마감' → checkEntry 오류(admin-F2 ③) ④ :6013-6026 등록금 → 표본 표 `{ '한국외국어대학교': { byField: { 인문사회: 7269500 } } }` 로 같은 단정(1년치·학기 환산·field·100% 가 1년치 아님·학생 입력값) — data/tuition.json 을 읽지 않는다 ⑤ :10763·:10848·:9499·:6580·:7837 '실제로 있다'류 → 실데이터에 있으면 재고 없으면 표본으로(정읍 :9855 `if (line)` 꼴) — 없다는 이유로 실패하지 않는다 · 같은 절의 '전부 근거 문장을 달고 있다'·'HTML 기호가 없다' 같은 항목 불변식은 audit-data 오류로 옮긴다(이미 감사에 있으면 지운다) ⑥ activity/news 출처 단정(:1666·:2018·:2020) → admin-F2 ①②.
⑦ refresh-tuition.yml·refresh-majors.yml 의 저장 단계 앞에 '데이터 관문' 단계(`node verify/test-collector.mjs && node verify/audit-data.js` · continue-on-error 없음 · timeout-minutes 5) — 걸리면 저장 없이 빨간불(두 워크플로는 수동 실행이라 사람이 본다). majors 쪽은 :6352 '발행된 열쇠가 전부 앱의 학교 이름'(진짜 불변식)을 저장 전에 지키게 된다.
⑧ 톱니(ratchet): verify/health-gates/gate.mjs 가 test-collector.mjs 소스(주석 걷고)에서 실데이터 읽기(`data/` 아래 파일 · collector/ 의 로봇·관리자가 쓰는 설정·장부 json — news-sources·activity-sources·external-sources·schools·own-programs·pending-forms·news-config·activity-config)를 세어 파일별 허용 개수표(1단계 뒤 실측값)와 대조 — 늘면 ✕('실데이터 단정은 audit-data.js 로 · CLAUDE.md'), 줄면 ℹ('표를 줄이세요'). 남은 것은 다음 점검에서 줄인다.
바꾸지 말 것: 경고를 오류로 올리지 말 것(entry-rules :93-96 '사람 판단을 기계가 잠그면 안 된다') · 학교가 늘면 「정식 등록도 나눌 때」 ℹ 꼴 그대로.

관문: verify/health-gates/gate.mjs 「실데이터 단정 톱니」: ① 위 ⑧ 대조 ② refresh-tuition.yml·refresh-majors.yml(주석 걷고)에 `node verify/test-collector.mjs` 와 `node verify/audit-data.js` 가 `git commit` 보다 앞에 있고 그 단계에 continue-on-error 가 없다 ③ 등록금 표본: PA.tuitionFor({school:'한국외국어대학교',track:'humanities'}, 표본) === 3634750. 빨간불 증명: test-collector 에 `JSON.parse(readText(new URL('../data/registered.json', import.meta.url)))` 한 줄을 더하면 ①✕ · 워크플로 관문 단계를 지우면 ②✕.

소급: 없음(검사 위치만 옮긴다). 옮긴 뒤 HEAD 데이터로 test-collector·audit-data 둘 다 통과해야 한다 — audit 으로 옮긴 오류가 지금 데이터에 걸리면 그 데이터는 원문을 열어 보고 admin-apply 로 고친다(손으로 JSON 고치지 말 것).

파일: verify/test-collector.mjs verify/audit-data.js verify/entry-rules.cjs .github/workflows/refresh-tuition.yml .github/workflows/refresh-majors.yml verify/health-gates/gate.mjs

위험: '있어야 한다'류(무력화 방지) 단정을 표본으로 바꿀 때 검사의 뜻(헛도는지 보기)이 사라지지 않게 — 표본이 실제로 그 길을 지나는지 red-green 으로 볼 것(CLAUDE.md 매 세션 3). test-collector 는 다른 세션도 고친다(:2063·:9367·:11168 — 우리 자리와 안 겹침). 이 항목의 ③⑥ 은 admin-F2 와 같은 코드라 한 사람이 같이 고칠 것.

---
## [collect/collect-03] P2 · confirmed

이유: 코드·이슈로 확인. collect-scholarships.yml:357-366 '🚨 데이터 감사 실패 알림'만 `--search '"수집 리포트" in:title'`(다른 알림 :90·:347·:379 는 '"장학공고 수집 리포트"'). 이슈 #381(🖥 브라우저형 수집 리포트) 코멘트 9개 중 4개가 일반 수집 로봇의 감사 실패(37110095633·37111713944?·37121388488·37169572702 — 실제로 run 37110095633·37121388488·37169572702 는 장학공고 수집 로봇), 4개가 링크 사냥꾼. 특히 10-04 02:11:31 코멘트는 그 실행이 3초 전(02:11:28)에 만든 #388(🤖 장학공고 수집 리포트)이 아니라 #381 에 붙었다 — 방금 만든 이슈는 검색에 아직 안 잡히고, '수집 리포트' 부분 일치가 더 최근의 브라우저 이슈를 집는다. 두 로봇의 실패 문구가 똑같아(어느 로봇인지 안 적힘) 구분도 안 된다. '0건 실행 알림'(:342-353)은 `steps.audit.outcome` 을 안 보고 '수집 로봇 정상 실행'이라 쓴다. revert-auto.mjs 는 report.md 를 안 고쳐 이슈·리포트가 '8건 등록'으로 남는다(코드 확인). 관문 실패 자체는 gaps-01 이 빨간불+이슈로 바꾸므로 P1→P2.

수리 명세: gaps-01 과 같은 손으로(같은 파일):
① collect-scholarships.yml '🚨 데이터 감사 실패 알림' 검색어를 '"장학공고 수집 리포트" in:title' 로 · 본문 첫머리에 '🤖 장학공고 수집 로봇:' · status(steps.guard.outputs.gate)별 문구(reverted-auto / reverted-files / still-failing — gaps-01 의 리포트 단락과 같은 말).
② '0건 실행 알림' 본문을 `steps.audit.outcome` 으로 가른다: success 면 지금 문구, failure 면 '수집은 정상 · 데이터 관문 빨간불(되돌림: <gate>) — 위 감사 실패 코멘트를 보세요'.
③ 리포트 '8건 등록' 바로잡기는 gate-guard 의 --report 단락(gaps-01)이 한다 — 리포트 이슈 생성 단계가 저장 뒤에 돌아 이슈 본문에도 들어간다(지금 순서 그대로).
④ 같은 원인 반복은 gaps-01 의 still-failing 새 이슈 + auto-held 장부가 맡는다(새 장치 더 만들지 말 것).

관문: verify/health-gates/gate.mjs 「알림이 제 리포트로 간다」(워크플로 주석 걷고 정적 검사): collect-scholarships.yml·browser-collect.yml·link-hunter.yml 어디에도 맨 `'"수집 리포트" in:title'` 검색이 없다 · collect 의 감사 실패 알림 검색어는 '"장학공고 수집 리포트"' · 0건 알림 단계 본문에 `steps.audit.outcome` 이 있다. 빨간불 증명: 검색어를 '"수집 리포트"' 로 되돌리면 ✕.

소급: 없음 — 지난 이슈 코멘트는 고치지 않는다.

파일: .github/workflows/collect-scholarships.yml collector/gate-guard.mjs verify/health-gates/gate.mjs

위험: gh 검색은 방금 만든 이슈를 몇 초간 못 찾는다 — 그때는 직전 장학공고 리포트 이슈에 붙는다(같은 로봇 이슈라 허용). 리포트 이슈 번호를 단계 출력으로 넘기는 개선은 선택.

---
## [browser/B9] P2 · confirmed

이유: 이슈 #366·#368·#381 본문 '🤖 자동 등록 — 8건 등록'인데 같은 실행이 되돌림(revert-auto 가 browser-report.md 를 안 고친다 — 코드 확인). browser-collect.yml:276·:294 알림 검색어 '"수집 리포트" in:title' 로 일반 수집 리포트와 섞인다 — #381 코멘트 9개 중 브라우저 자신의 것은 1개(37171328367). link-hunter.yml:131 도 같은 검색어. 열린 이슈 186개 중 브라우저 리포트가 #324·#327·#333·#340·#346·#366·#368·#381 로 쌓여 있고 닫는 단계가 없다(:262 gh issue create).

수리 명세: ① browser-collect.yml 의 두 알림(:276 감사 실패 · :294 실패·시간초과) 검색어를 '"브라우저형 수집 리포트" in:title' 로, 감사 실패 문구는 gaps-01 status 별로 + '🖥 브라우저형 수집 로봇:' 머리. ② link-hunter.yml:131 검색어를 '"장학공고 수집 리포트" in:title' 로(사냥꾼은 제 리포트 이슈가 없고, 원문 주소는 정식 등록 쪽 일이다) + 문구에 '링크 사냥꾼:' 유지. ③ '8건 등록' 바로잡기는 gate-guard --report collector/browser-report.md(gaps-01). ④ 리포트 이슈 쌓임(자동 닫기)은 이번에 하지 않는다 — 리포트가 '컨펌 대기' 목록을 싣고 있어 닫으면 개발자가 아직 안 본 컨펌 거리가 숨는다(원칙 2). 개발자 결정 사항으로 보고만.

관문: collect-03 과 같은 정적 검사 절에 browser-collect.yml 두 알림의 검색어가 '"브라우저형 수집 리포트"' 인지 · link-hunter.yml 에 맨 '"수집 리포트"' 가 없는지. 빨간불 증명: 검색어를 되돌리면 ✕.

소급: 없음.

파일: .github/workflows/browser-collect.yml .github/workflows/link-hunter.yml verify/health-gates/gate.mjs

위험: 이슈 자동 닫기는 개발자 질문으로 남긴다: '브라우저형 수집 리포트 이슈가 실행마다 새로 열려 8개가 열려 있습니다. ① 새 리포트를 열 때 지난 리포트를 닫기(컨펌 대기가 숨을 수 있음) ② 지금처럼 두기 ③ 새 공고가 있어도 한 이슈에 코멘트로 — 추천은 ②(컨펌을 채팅에서 하므로 이슈는 기록용)'.

---
## [collect/collect-13] P3 · confirmed

이유: 지금 더 늘었다: collector/pending-forms.json 123건 중 registered.json 에 없는 고아 71건(진단 때 64) — fetched·미스키마화 50 · 이미 스키마화 16 · retired 5(실측). 원본을 다시 받으러 가는 것은 0건(pending-targets.mjs 는 fetched/retired 를 거름)이라 시간 낭비는 없고, 피해는 리포트 소음('건너뜀 n건 — registered.json에 항목 없음' · schematize-forms.mjs:336)과 auto-register 의 '⏳ 스키마화 대기 중 n건'(auto-register.mjs:437 — 고아 50건이 숫자를 부풀린다). 되돌린 자동 등록분도 대기열에 남는다(revert-auto 는 registered 만 고침).

수리 명세: ① 새 순수 모듈 collector/pending-queue.mjs `pruneOrphans(queue, registeredIds) → { kept, dropped }`(id 가 정식 등록에 없는 대기 항목을 뺀다 · 다른 칸은 손대지 않는다). ② collector/schematize-forms.mjs: 큐와 registered 를 읽은 직후(지금 :286 큐 읽기 · :314 registered 읽기 — registered 읽기를 '스키마화할 항목 없음' 조기 종료(:304) 앞으로 올린다) pruneOrphans 를 적용하고, 리포트에는 목록 대신 '대기열 정리 n건 — 정식 등록에서 빠진 공고(마감 지남·되돌림·삭제)' 한 줄. 큐는 지금처럼 :520 에서 JSON.stringify(queue,null,1)+'\n'. ③ gate-guard 의 auto 단계가 뺀 id 를 같은 함수로 대기열에서 지운다(gaps-01). 다시 등록되면 auto-register(:418 '대기줄에 없으면 넣는다')가 다시 넣으므로 안전 — 사람이 retired 로 내린 항목도 그 공고가 등록돼 있으면 고아가 아니라 남는다.
바꾸지 말 것: schematize-forms.mjs 를 import 하지 말 것(불러오는 순간 실행) · pending-forms.json 은 jsonunion 병합 파일이라 다른 브랜치 병합으로 지운 항목이 되살아날 수 있다 — 다음 실행이 다시 지우므로 그대로 둔다.

관문: verify/health-gates/gate.mjs 「양식 대기열 고아」: pruneOrphans({items:[{id:'a',fetched:true},{id:'b',retired:true},{id:'c'}]}, new Set(['a'])) → kept ids ['a'] · dropped 2 · 남은 항목 칸 그대로. 정적: schematize-forms.mjs 가 './pending-queue.mjs' 에서 pruneOrphans 를 불러 '스키마화할 항목 없음' 줄보다 앞에서 부른다(소스 위치 대조). 빨간불 증명: 호출을 조기 종료 뒤로 옮기면 ✕.

소급: 다음 수집 실행의 schematize 단계가 스스로 71건을 정리한다(자가 치유). 손으로 지우지 말 것.

파일: collector/pending-queue.mjs collector/schematize-forms.mjs collector/gate-guard.mjs verify/health-gates/gate.mjs

위험: P3 — 묶음 안에서 맨 나중. 미루어도 해가 없다.

---
## 손대지 않는 것 (이미 고쳐짐·오진·다른 세션·사람 결정 대기)
- [collect/collect-02] already-fixed: 증상(같은 8건 등록→되돌림 무한 반복)은 오늘 끊겼다. 06a34cc7(10-04 03:55Z)이 test-collector 의 실데이터 단정 '대학원 전용인데 점수가 매겨진 것이 없다'를 표본 검사 + audit-data.js 경고로 옮겼고, 그 뒤 첫 수집 실행 https://github.com/seonju5543-web/hanggonggan/actions/runs/37190037848 (08:47Z) 은 '데이터 관문' 성공 · '감사 실패 시 자동 등록분 되돌리기' skipped. 커밋 12035004 이후 data/reg
- [api/api-02] already-fixed: 이 항목이 지목한 두 가지 모두 06a34cc7(10-04 03:55Z)에 들어 있다: ① parse-requirements.js UNDERGRAD_TOO 에 '학사, 석사ㆍ박사과정' 갈래 추가 → 파안장학(auto-202026091720eca1b0ed9a8c) gradTarget null · 학부생 33%(미달 아님 — 지금 HEAD 실측) ② test-collector.mjs:7972-7981 실데이터 전수 단정을 표본 검사로 바꾸고 실데이터는 audit-data.js 경고('적합으로 뜰 때만')로 옮김. 그 뒤 수집 실행 37
- [browser/B13] already-fixed: '지금은 아직 말하지 않는다 (선을 안 넘었다)' 고정 단정은 HEAD test-collector 에 없다(grep 0). 「학교가 늘면 「정식 등록도 나눌 때」라고 말하는가」 절(:5386~)이 '실데이터는 재기만 하고 빨간불로 두지 않는다 … 여기선 숫자만 보인다'(ℹ 줄)로 바뀌었고 이후 실행에서 재발 없음. 같은 꼴의 남은 단정은 gaps-03 이 맡는다.

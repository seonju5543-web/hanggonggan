# 수리 명세 — 묶음 refresh

권장 순서: refresh/QUEUE-01 → refresh/MAJORS-02 → refresh/MAJORS-01 → app2/app2-F5 → refresh/KOSAF-01 → refresh/KOSAF-02 → refresh/GATE-02 → refresh/GATE-01 → gaps/gaps-06 → refresh/TUITION-01 → refresh/ESSAY-03 → refresh/TWO-01
예상 손댈 파일: .github/workflows/refresh-majors.yml .github/workflows/refresh-tuition.yml collector/majors.mjs collector/publish-majors.mjs collector/kosaf-session.mjs collector/kosaf-attach.mjs collector/kosaf-fetch.mjs tools/build-school-photos.mjs tools/fetch-gate-photos.mjs tools/gate-reel/build-app-gates.mjs docs/designs/assets/gates/school-photo-picks.json verify/health-gates/refresh.mjs verify/health-gates.mjs

검증 메모: 사람이 결정해야 하는 것(needs-human)을 빼고 고칠 것은 일곱이다. 순서는 이렇게 하면 된다: ① 대기줄·넘어짐 알림(yml 둘) → ② 열쇠 없음 빨간불 → ③ 학과 진단 리포트 → ④ 한국장학재단 사본 열쇠 → ⑤ 수확 예산 → ⑥ 사진 제목 대조와 picks 소급 → ⑦ 사진 도구 묶음 길이·Openverse 끄기.

- 같은 파일을 겹쳐 고치는 짝: ②③은 collector/majors.mjs 를, ①과 ③은 refresh-majors.yml 을 같이 고친다. 한 수리자가 차례로 하는 것이 안전하다.
- 묶음 공용 파일: verify/health-gates.mjs 의 PARTS 에 'refresh' 한 줄을 더하는 것은 다른 묶음과 공용이라 조율이 필요하다. 새 관문 파일 verify/health-gates/refresh.mjs 는 표본과 코드 글자만 읽는다. data/·collector/ 장부는 읽지 않는다.
- 다른 세션(origin/claude/source-link-integrity): 대부분 이미 기본 브랜치에 합쳐졌다. 남은 차이는 data/news/*·collector/news-*·data/link-fixes.json·data/admin-log.json·style.css 뿐이라 이 묶음과 겹치는 파일이 없다. 이 묶음은 verify/test-collector.mjs 를 고치지 않는다. 다만 TWO-01 에서 ②(지우기)를 고르면 test-collector·_admin/admin.js 를 건드리게 된다.
- 기준점 이동: 기본 브랜치는 46f08990 이후 앞으로 갔지만(원문 링크 등), 이 묶음의 파일은 하나도 바뀌지 않았다(git diff HEAD origin/claude/nice-heisenberg-WESq5 로 확인).
- 진단을 바로잡은 것 셋:
  · KOSAF-01 의 '같은 파일을 상품 코드마다 다시 받는다'는 서버 filename 이 달라 받기 전엔 알 수 없다. 저장소는 git 이 같은 바이트를 한 번만 저장한다. 그래서 심각도를 P3 로 낮췄다.
  · KOSAF-02 는 실제 시한초과가 0회라 P3 로 낮췄다.
  · GATE-01 의 '고려 세종 0장'은 98cc4bbc 에서 이미 해소됐다.
- 실데이터 관문 금지를 지켰다: '서비스 학교 전부 학과 파일이 있다'는 지금 빨간불이라 관문에 두지 않고 로봇 리포트와 ::warning 으로만 알린다.
- 수확 시간을 더 줄이려면 '마감 지난 재단 상세는 가끔만 받기'도 가능하다. 하지만 이것은 데이터 정책 결정이라 이번 수리에서 뺐다.
- 이 검증에서 쓴 것: GitHub 실행 로그 36945129700·37146558541, 실행 이력(kosaf-fetch·refresh-majors·refresh-tuition), 이슈 #342·#227. 실데이터 비교는 git show 로 kosaf.json 세 판과 manifest 세 판을 읽어 했고, 임시 파일은 /tmp/claude-0/-home-user-hanggonggan/409b9928-bac2-5670-b5b4-24e2b322cd7b/scratchpad/verify-refresh/ 에 있다. 로컬 실행은 verify-essay-ask(117/0)와 YAML 중복 키 검사뿐이다. 저장소는 고치지 않았다(git status 깨끗).


---
## [refresh/KOSAF-01] P3 · confirmed

이유: 반박 실패, 증상은 실재한다. 원인도 확정했다. data/kosaf.json 의 09-30판(2467ccfb)과 10-02판(HEAD)을 대조하니, 사본(mirror)이 있는 64곳 모두 mirror.from 이 달랐고 차이는 encVal 칸 하나뿐이었다(예: 광주남구장학회 filename=…_2026091617231400.hwpx 는 같고 encVal 만 ce068c…→9008d0…). 판정 코드는 collector/kosaf-attach.mjs:117-118 로, 주소 전체를 문자열로 비교한다. keep()(134행)도 주소 전체를 저장한다. 첨부 리포트는 네 번 연속 '이미 있던 것 0곳'이었다(e6981a30 · 1358c133 · 2467ccfb · 10-02 run 36945129700 '새로 67개(21508KB)'). 확인 시험: encVal 을 뺀 filename 열쇠로 다시 대조하면 09-30→10-02 은 79/79, 09-17→09-30 은 73/73 이 같다(지금 코드로는 0). 심각도는 P2 에서 P3 로 낮춘다. 근거: 사본 단계는 70초뿐이다(run 36945129700 step 7, 00:33:28→00:34:38). 같은 바이트는 git 이 한 번만 저장하므로 저장소가 불지 않는다. 학생 화면 손실도 아직 없다. 남은 위험은 40MB 상한(지금까지 최대 34,241KB, 86%)을 넘는 철에 목록 뒤쪽의 새 재단이 매번 잘리는 것이다. 진단의 '같은 실행에서 같은 filename 은 한 번만' 부분은 틀렸다. 광주남구 ×5·순천 ×5 등은 서버 filename 부터 다르다(올린 시각 꼬리가 다르고, 실측 filename 중복은 1,616개 중 0). 받기 전에는 같은 파일인지 알 수 없으므로 이 부분은 수리에서 뺀다.

수리 명세: ① collector/kosaf-session.mjs 의 순수 함수 구역(네트워크 없음 — 관문이 이미 import 한다 · 맨 fetch 호출을 늘리지 말 것, test-collector 485행 관문이 'await fetch( 1회'를 센다)에 셋을 둔다.
  · export function attachKey(url): new URL(url).searchParams 에서 'filename' 칸(KOSAF 서버 저장 이름 · 올린 시각 꼬리 _YYYYMMDDhhmmss00 포함 → 재단이 새 회차를 올리면 바뀐다)을 'f:'+값으로 돌려준다. 없으면 'FileNameDn' 칸을 'd:'+값으로, 그것도 없으면 encVal 칸을 지운 주소를 'u:'+href 로 돌려준다. 파싱이 실패하면 'r:'+원문.
  · export function filesKey(urls): 빈 값을 빼고 attachKey 로 바꾼 뒤 정렬해 '\n' 으로 잇는다(구분자를 '|' 로 하지 말 것 — 질의 문자열에 '|' 가 날것으로 올 수 있다).
  · export function mirrorMatches(files, mirror): now = filesKey((files||[]).map(f=>f.url||'')). now 가 비면 true. want = mirror.key ?? filesKey(String(mirror.from||'').split('|')) (옛 장부 호환 — 지금 장부에는 key 가 없다). return now === want.
② collector/kosaf-attach.mjs: mirrorAlive 의 117-118행을 `return mirrorMatches(it.files || [], m);` 로 바꾼다(108-113행의 '장부 파일이 디스크에 실제로 있어야 한다'는 그대로 둔다). keep() 은 `{ at: today, from: <지금처럼 전체 주소를 '|' 로 이은 것 — 사람용>, key: filesKey(urls), files: saved }` 를 쓴다.
③ kosaf-fetch.mjs 는 고칠 것이 없다(142행이 mirror 를 통째로 이어받으므로 key 도 따라간다).
바꾸지 말 것: 새 회차(파일 이름이 다른 것)는 다시 받는다 · HTML·빈 파일은 저장하지 않는다 · prune() · 앱 파일(kosaf-open.json)엔 우리 경로만(kosaf-check) · '--write 없으면 아무것도 안 만진다'. 같은 내용을 다른 상품 코드에 중복으로 받는 문제는 이번 범위 밖이다.

관문: verify/health-gates/refresh.mjs ⓐ — import(new URL('collector/kosaf-session.mjs', ctx.root)). 표본 주소 u(fn, enc) = 'https://portal.kosaf.go.kr/FL/downloadServletEcm.do?filename=SS/SL/goods/'+encodeURIComponent(fn)+'&FileNameDn=x.hwp&path=KOSAF_COMMON&encVal='+enc.
(1) attachKey(u('A_2026091617231400.hwpx','aa')) === attachKey(u('A_2026091617231400.hwpx','bb')) → true
(2) 파일 이름이 다르면(새 회차 A_2026100111111100.hwpx) false
(3) mirrorMatches([{url:u('A','bb')}], {from:u('A','aa')}) → true (옛 장부 꼴)
(4) mirrorMatches([{url:u('B','bb')}], {from:u('A','aa')}) → false
(5) 두 파일은 순서와 무관하게 같음 · key 칸이 있으면 key 로 비교
(6) 정적 검사: kosaf-attach.mjs 소스(주석 제거)에서 mirrorAlive 가 mirrorMatches( 를 부르고, `=== (m.from` 이 없으며, keep() 이 `key: filesKey(` 를 쓴다.
red 증명: attachKey 가 주소를 그대로 돌려주게 되돌리면 (1)(3)이 실패한다. mirrorAlive 를 옛 문자열 비교로 되돌리면 (6)이 실패한다.

소급: 손으로 고칠 데이터가 없다 — 다음 수확(월·목 05:53 KST 예약)이 스스로 맞춘다. mirrorMatches 가 옛 장부의 from(전체 주소)을 열쇠로 풀어 비교하므로 첫 실행부터 다시 받지 않는다(실측 09-30→10-02 79/79 일치). 확인 방법: 그다음 collector/kosaf-attach-report.md 의 '이미 있던 것' 이 0곳이 아니라 60곳 안팎이어야 한다.

파일: collector/kosaf-session.mjs collector/kosaf-attach.mjs

위험: 작다. 판정이 틀리면 '못 받는' 쪽이 아니라 '다시 받는' 쪽으로 틀리도록 설계했다(열쇠가 다르면 받는다). 단, KOSAF 가 같은 서버 filename 에 내용만 바꿔 올리면 놓치게 되는데, 실측으로는 올릴 때마다 시각 꼬리가 새로 붙는다. 다른 세션(origin/claude/source-link-integrity)은 이 파일들을 건드리지 않는다.

---
## [refresh/KOSAF-02] P3 · confirmed

이유: 실재한다. 수확 단계가 세 번 연속 17분 안팎이었다: 10-02 run 36945129700 은 17분00초, 09-30 run 36663155157 은 17분07초, 09-17 run 35285454073 은 16분49초. 10-02 로그를 보면 00:16:29 '목록: 마지막 쪽 185' → 00:18:28 '목록 확보: 1847건'(목록만 2분) → 00:33:28 '예산을 다 써 365건은 다음 실행으로'. collector/kosaf-fetch.mjs:123 의 makeBudget 이 58-71행 목록 쪽 넘김 뒤에 만들어지므로 목록 시간이 예산 밖이다. kosaf-fetch.yml:75-76 의 상한은 20분, --budget-min=15 라 여유가 3분뿐이다. 상세 한 건은 최악 105초가 걸릴 수 있다(kosaf-session.mjs:42-58 tryFetch 30초×3 + 대기 5+10초). 아직 시한초과는 한 번도 없었다(실패 3회는 #227 관문 때문). 시한초과가 나도 failure() 알림은 뜨므로 조용하지는 않다 → P3. '마감 지난 재단 상세를 덜 받자'는 제안은 데이터 정책(마감 지나도 자격 칸은 쓴다) 결정이라 이번 수리에서 뺀다.

수리 명세: collector/kosaf-fetch.mjs 를 고친다.
① `const budget = makeBudget(Number(arg('budget-min', 15)) * 60000);` 을 43행 `const S = createSession();` 바로 뒤, 즉 `firstHtml = await S.open()` 앞으로 옮긴다. 목록 185쪽을 받는 시간까지 예산 15분에 넣는다. 123행 원래 자리는 지운다.
② 상세 반복(126행)의 `if (budget.expired())` 를 `if (!budget.hasRoom(DETAIL_WORST_MS))` 로 바꾼다. 파일 머리에 `const DETAIL_WORST_MS = 2 * 60000;` 을 두고 주석으로 근거를 적는다: tryFetch 30초×3 + 대기 5+10초 = 105초 + 쉼 0.25초.
③ (권장) 목록 쪽 넘김 반복 안에서 budget.expired() 이면 console.error('목록을 예산 안에 다 못 받았습니다 — 저장하지 않습니다') 후 process.exit(1) 한다. 반쪽 목록은 어차피 kosaf-check 가 막는다. 단계가 상한에 강제 종료되기 전에 실패로 끝나 알림이 가게 하려는 것이다.
결과: 최악의 단계 길이 = 15분 + 저장 몇 초 → 상한 20분까지 약 5분 여유(지금은 3분). 실행마다 상세를 2분치(약 200건) 덜 받지만, 마감 전·마감 빈칸 재단을 먼저 받으므로 앱의 층2에는 영향이 없다.
바꾸지 말 것: kosaf-fetch.yml 의 --budget-min=15 · 단계 상한 20 · 작업 상한 44 · 지난 실행 상세 이어받기(85-91·136-143행) · '마감 전/빈칸 먼저' 순서 · --write 없으면 쓰지 않음 · --codes/--only/--max.

관문: verify/health-gates/refresh.mjs ⓑ — 정적 검사(코드라서 실데이터가 아니다). kosaf-fetch.mjs 는 import 하는 순간 포털을 두드리므로 import 하지 말 것.
src = 주석을 걷은 kosaf-fetch.mjs.
(1) src.indexOf('makeBudget(') > 0 && < src.indexOf('await S.open()')
(2) 상세 반복이 `budget.hasRoom(` 을 쓰고, DETAIL_WORST_MS 가 100초 이상이다(소스에서 숫자를 읽는다).
(3) kosaf-fetch.yml 의 '한국장학재단 통합검색 수확' 단계에서 timeout-minutes 와 --budget-min 을 읽어 timeout×60000 > budget×60000 + DETAIL_WORST_MS + 60000(저장 여유).
red 증명: makeBudget 줄을 목록 반복 뒤로 되돌리면 (1)이 실패한다. expired() 로 되돌리면 (2)가 실패한다. yml 의 --budget-min 을 18 로 올리면 (3)이 실패한다.

소급: 없음 — 실행 길이만 바뀐다.

파일: collector/kosaf-fetch.mjs

위험: 작다. 예산 시작점이 앞당겨져 상세가 매회 약 200건 덜 들어오지만 나머지는 다음 실행이 받는다(이어받기). 다른 세션과 겹치는 파일은 없다.

---
## [refresh/MAJORS-01] P2 · confirmed

이유: 실재한다. match-engine.js SERVED_SCHOOLS 44곳 각각에 대해 majorsFileFor 파일이 있는지 확인했더니 '연세대학교 미래캠퍼스 → data/majors/n1if6uwu.json' 하나만 없었다. data/majors.json(updatedAt 2026-08-06) bySchool 에 연세 미래가 없다. '연세대학교' 119개 학과에도 작업치료·물리치료·임상병리·방사선·치위생이 없다. 즉 본교로 합쳐진 것도 아니다. 남는 가능성은 둘이다: 커리어넷 이름이 normalizeSchool 정규식('…대학교 …캠퍼스')에도 BRANCH_MAP(collector/majors.mjs:49-60)에도 걸리지 않아 inApp 에서 버려졌거나, 커리어넷에 아예 없거나. 커리어넷 원래 이름은 확인하지 못했다(샌드박스 차단 · Actions 수확 0회 · 원인 단정 금지). 학생 화면은 app.js:1019-1020 에서 전국 공통 목록(MAJORS_COMMON)으로 조용히 물러난다. 2026-08-02 사고와 같은 유형이고 학과는 자격 판정 입력이므로 P2 를 유지한다. 사람이 관리자 화면 「학과 목록 갱신」(_admin/admin.js:2096)으로 실행할 수 있다.

수리 명세: 목표: 다음 실행이 '커리어넷이 그 분교를 뭐라고 부르는지'를 증거로 남기고, 서비스 학교의 파일이 빠지면 소리를 내게 한다. 이름은 지어내지 않는다.
① collector/publish-majors.mjs(불러와도 실행되지 않는 파일)에 순수 함수 둘을 더한다.
  · `export function missingServed(published, served)` → served 중 published(발행된 앱 학교 이름 목록)에 없는 것.
  · `export function campusNameSuspects(pairs, unis)` — pairs = [{school: 커리어넷 schoolName 원문, campus: campus_nm, n: 학과 수}]. 두 가지를 돌려준다. (a) 원문 이름이 unis 에 없는데(BRANCH_MAP·별칭 정규화 뒤에도) '…대학교' 밑동이 '분교를 가진 앱 학교'(unis 에 '<밑동> …캠퍼스' 가 있는 학교, 예: 연세대학교·상명대학교)와 같은 줄. (b) 그런 학교가 campus_nm 을 두 가지 이상으로 받은 경우의 줄. 줄 모양은 '연세대학교(원주) | 제1캠퍼스 | 학과 38' 꼴로 한다. 이원화 학교(경희 등 — 분교가 UNIVERSITIES 에 따로 없는 곳)는 내지 않는다.
  · publishMajorsBySchool 의 반환값에 `published: Object.keys(index)` 를 더한다(기존 schools·updatedAt·skipped 는 그대로).
② collector/majors.mjs: 상세 정규식(79행)을 `/<campus_nm>([\s\S]*?)<\/campus_nm>[\s\S]*?<majorName>([\s\S]*?)<\/majorName>\s*<schoolName>([\s\S]*?)<\/schoolName>/g` 로 바꿔 campus_nm 도 잡고, (원문 schoolName, campus_nm) 짝별 학과 수를 센다. 발행 뒤 다음을 한다.
  · missingServed(pub.published, ME.SERVED_SCHOOLS) 의 각 학교마다 `::warning::서비스 학교인데 학과 파일이 없다 — <학교>` 를 찍는다.
  · campusNameSuspects 결과를 찍는다.
  · 위 둘과 skipped 를 collector/majors-report.md 에 쓴다(머리: 날짜 · 학교 수 · 상세 실패 수).
  · match-engine 은 createRequire 로 부른다(publish-majors 와 같은 방식).
③ .github/workflows/refresh-majors.yml 저장 단계: `git add data/majors.json data/majors collector/majors-report.md`. test-collector 6313행 정규식 `git add[^\n]*\bdata\/majors\b(?!\.json)` 이 계속 맞아야 한다.
④ 그다음(이 수리 밖, 실행 뒤): 리포트에 찍힌 원래 이름을 그 글자 그대로 BRANCH_MAP 에 한 줄 더한다. 캠퍼스 번호로 오면 '학교|campus_nm → 분교' 표를 BRANCH_MAP 옆에 근거 주석과 함께 둔다. 이원화 캠퍼스는 지금처럼 합친다.
🔴 하지 말 것:
  · '서비스 학교 전부 학과 파일이 있다'를 test-collector 관문으로 두지 말 것. 실데이터라 지금 빨간불이 되고, 관문을 같이 쓰는 수집 로봇이 결과를 버린다 — 이번 점검의 사고 유형이다. 로봇 리포트와 ::warning 으로만 알린다.
  · BRANCH_MAP 에 이름을 짐작해 넣지 말 것.
  · app.js 의 폴백·손 검수 외대 목록 우선·majorsFileFor 이름 규칙·UNIV_ALIASES 통과는 그대로 둔다.
  · test-collector 「분교 이름이 로봇과 앱에서 같은가」가 majors.mjs 소스에서 BRANCH_MAP 을 읽으므로, BRANCH_MAP 은 majors.mjs 에 남긴다.

관문: verify/health-gates/refresh.mjs ⓓ — 표본만 쓴다. import(new URL('collector/publish-majors.mjs', root)).
(1) missingServed(['연세대학교','경희대학교'], ['연세대학교','연세대학교 미래캠퍼스','경희대학교']) → ['연세대학교 미래캠퍼스']
(2) unis = new Set(['연세대학교','연세대학교 미래캠퍼스','상명대학교','상명대학교 천안캠퍼스','경희대학교']), pairs = [{school:'연세대학교(원주)',campus:'제1캠퍼스',n:38},{school:'상명대학교',campus:'제1캠퍼스',n:60},{school:'상명대학교',campus:'제2캠퍼스',n:55},{school:'경희대학교',campus:'제2캠퍼스',n:40},{school:'경희대학교',campus:'제1캠퍼스',n:70}] → 결과에 '연세대학교(원주)' 줄과 '상명대학교' 줄이 있고 '경희대학교' 줄은 없다.
(3) 정적 검사: majors.mjs 가 missingServed( · campusNameSuspects( 를 부르고 majors-report.md 를 쓰며, refresh-majors.yml 이 그 파일을 git add 한다.
(4) publishMajorsBySchool 을 임시 폴더로 불러 published 에 앱 이름(한국과학기술원 → KAIST)이 들어간다.
red 증명: campusNameSuspects 가 [] 를 돌려주게 하면 (2)가 실패한다. published 를 빼면 (4)가 실패한다.

소급: 코드만으로는 데이터가 안 고쳐진다. 들어간 뒤 사람이 관리자 화면 「학과 목록 갱신」을 한 번 누른다(→ gaps-06). 리포트에서 연세 미래·상명 천안 이름을 확인하고 BRANCH_MAP 에 한 줄 더한 뒤, 다시 한 번 눌러 data/majors/n1if6uwu.json 이 생기는지 본다. 그 사이 연세 미래 학생은 지금과 같은 전국 공통 목록이다(나빠지지 않음). 원칙 7 소급: 학과 파일은 로봇 발행물이라 다음 실행이 전부 다시 쓴다.

파일: collector/majors.mjs collector/publish-majors.mjs .github/workflows/refresh-majors.yml

위험: 중간. 정규식을 바꾸다 학과·학교 짝을 잘못 잡으면 학과 목록 전체가 틀어질 수 있다. majors.mjs 에는 '상세 실패 20% 초과면 저장 안 함'만 있고 내용 관문이 없다. 정규식 변경 뒤 학교 수·학과 수가 08-06판(209곳)과 크게 다르면 저장하지 않는 바닥 검사(예: 학교 수가 150 미만이면 exit 1)를 같이 두는 것을 권한다. 다른 세션과 겹치는 파일은 없다.

---
## [app2/app2-F5] P3 · confirmed

이유: 연세 미래 부분은 MAJORS-01 과 같은 결함이라 따로 고치지 않는다. 추가 주장도 확인했다. 상명대학교(서비스 학교) 학과 파일 120개에 만화ㆍ애니메이션학과·무대미술학과·가구조형전공·예술학부 무대미술전공 등이 들어 있다. 천안 학과가 서울로 섞였을 가능성이 있지만, 커리어넷이 캠퍼스 번호로 줘서 합쳐졌다는 것은 추정이고 확인하지 못했다. 영향은 '없는 학과가 추천에 더 뜨는' 쪽이라 연세 미래(파일 없음)보다 가볍다. 경찰대학·상명대학교 천안캠퍼스는 SERVED_SCHOOLS 밖이라 학생 영향이 없다. data/majors/index.json 209곳에 셋 다 없는 것은 사실이다. app.js:1004 의 줄 번호는 지금 majorSuggestions 시작 줄(1004) · 폴백 1020행이다.

수리 명세: MAJORS-01 과 같은 수리다. campusNameSuspects (b)가 '상명대학교 | 제1·제2캠퍼스' 를 찍으면 그 증거로 '상명대학교|<번호> → 상명대학교 천안캠퍼스' 를 잇는다. 이건 실행 뒤의 일이다. 별도 코드는 없다.

관문: MAJORS-01 의 ⓓ(2) 표본에 상명대학교 두 캠퍼스 짝이 들어 있다.

소급: MAJORS-01 과 같음(실행 → 증거 → BRANCH_MAP/캠퍼스 표 → 재실행).

파일: collector/majors.mjs collector/publish-majors.mjs

위험: MAJORS-01 과 같음.

---
## [refresh/MAJORS-02] P3 · confirmed

이유: collector/majors.mjs:30 이 열쇠가 없으면 process.exit(0) 으로 끝난다. 그러면 refresh-majors.yml:46 이 '변경 없음' 으로 초록불을 낸다. Actions 에서 수확까지 간 실행이 0회라(6회 모두 09-30 push 0초 실패 — 36652726612 등) 시크릿이 실제로 있는지는 실행으로 증명된 적이 없다. SESSIONS.md 3008행의 '등록됨' 기록만 있다.

수리 명세: collector/majors.mjs 30행을 다음으로 바꾼다:
```js
if (!KEY) { const ci = process.env.GITHUB_ACTIONS === 'true';
  console.error(ci ? '::error::CAREERNET_API_KEY 가 없습니다 — 저장소 Secret 을 확인하세요 (학과 목록을 갱신하지 못했습니다)' : 'CAREERNET_API_KEY가 없습니다 — 아무것도 하지 않고 종료합니다.');
  process.exit(ci ? 1 : 0); }
```
refresh-majors.yml 머리말 4행의 '(없으면 스크립트가 아무것도 안 하고 조용히 종료)' 를 'Actions 에서는 빨간불' 로 고친다. 이 검사는 import 문 다음, 네트워크 호출 전이어야 한다(지금 자리 그대로).
바꾸지 말 것: 로컬 실행은 그대로 exit 0. 열쇠를 코드나 로그에 찍지 말 것. 등록금(fetch-tuition.mjs)의 '열쇠 없으면 ① 건너뛰고 ② 계열 단계는 돈다'는 설계라 건드리지 않는다.

관문: verify/health-gates/refresh.mjs ⓒ — 행동 검사. spawnSync(process.execPath, ['collector/majors.mjs'], { cwd: fileURLToPath(root), env: { PATH: process.env.PATH, GITHUB_ACTIONS: 'true' }, timeout: 20000, encoding: 'utf8' }).
🔴 env 는 process.env 를 펼치지 말고 새로 짠다. 개발자 기계에 열쇠가 있으면 실제 수확이 시작되기 때문이다.
(1) status === 1 && /::error::CAREERNET_API_KEY/.test(stderr)
(2) 같은 호출에서 GITHUB_ACTIONS 를 빼면 status === 0
네트워크는 열쇠 검사 앞에서 끝나므로 일어나지 않는다.
red 증명: exit(0) 으로 되돌리면 (1)이 실패한다.

소급: 없음.

파일: collector/majors.mjs .github/workflows/refresh-majors.yml

위험: 작다. Actions 에서 열쇠가 실제로 없으면 다음에 누를 때 빨간불이 된다. 그것이 목적이다.

---
## [refresh/QUEUE-01] P3 · confirmed

이유: 잠재 결함으로 실재한다. refresh-majors.yml:14-16 과 refresh-tuition.yml:15-17 이 `group: collector` 다. 같은 대기줄에 admin-apply·browser-collect·collect-scholarships·open-api 가 있다. GitHub 은 한 대기줄에 대기 실행을 하나만 남기고 앞의 대기분을 취소한다. 등록금은 작업 상한이 55분이고, 예약 수집이 07:41·08:07·11:41·12:07·15:41·16:17 KST 에 도므로 그 사이 둘이 줄을 서면 앞의 것(관리자 버튼 포함)이 조용히 취소될 수 있다. 두 워크플로가 쓰는 파일(data/majors.json·data/majors/·data/tuition.json)은 다른 워크플로가 쓰지 않는다(.github/workflows grep 결과 check-live·deploy-sync 는 읽기만). 그래서 같은 줄에 설 이유가 없다. 실제 피해 기록은 없다(09-30 이후 두 워크플로 실행 0회) → P3. ref_name 체크아웃 문제는 관리자 화면이 기본 브랜치로 부르므로 실제로는 위험이 낮지만, 명시적으로 고정하는 편이 kosaf-fetch·rescue-bodies 와 같은 꼴이다. 덧붙여 두 워크플로 모두 failure()/cancelled() 알림이 없다(TUITION-01 의 알림 부분을 여기서 함께 고친다).

수리 명세: 두 파일 모두 같은 방식으로 고친다.
① concurrency.group 을 각각 `refresh-majors` · `refresh-tuition` 으로 바꾼다(cancel-in-progress: false 유지). 주석을 단다: '수집 로봇과 다른 대기줄 — 같은 줄이면 대기 중인 예약 수집·관리자 버튼이 취소된다 · 이 로봇이 쓰는 파일은 다른 로봇이 안 쓴다 · 저장 충돌은 pull --rebase 재시도가 받는다'.
② checkout 의 `ref: ${{ github.ref_name }}` 를 `ref: claude/nice-heisenberg-WESq5` 로 바꾼다(kosaf-fetch.yml:59 와 같은 꼴 — 읽은 브랜치에만 저장. 체크아웃 시점의 브랜치 끝이라 09-30 '옛 커밋' 사고는 다시 나지 않는다). 기존 09-30 주석은 그 뜻에 맞게 고친다.
③ permissions 에 `issues: write` 를 더하고, 마지막 단계로 다음을 둔다:
```yaml
- name: 🚨 로봇이 넘어졌다
  if: failure() || cancelled()
  uses: ./.github/actions/robot-down
  with:
    robot: 학과 목록 갱신   # 등록금 쪽은 '등록금 갱신'
    token: ${{ github.token }}
```
바꾸지 말 것: workflow `name:` — deploy-sync.yml 의 workflows: 목록과 관리자 화면이 이름·파일명으로 찾는다. 수동 실행만(예약 추가는 gaps-06 결정 뒤). refresh-tuition 의 단계 순서·상한(55/45)·--write. 저장 단계의 push 재시도.
test-collector 「로봇 대기줄」은 collector 줄 워크플로만 본다. 남는 넷으로 '≥2' 를 만족하므로 그대로 통과한다.

관문: verify/health-gates/refresh.mjs ⓔ — 두 yml 을 글자로 읽는다(코드이므로 실데이터가 아니다).
(1) /^concurrency:\n\s+group:\s*(\S+)/m 의 값이 'collector' 가 아니고 파일마다 다르다.
(2) actions/checkout 바로 다음 with 블록의 ref 가 'claude/nice-heisenberg-WESq5' 다.
(3) `if: failure() || cancelled()` + `uses: ./.github/actions/robot-down` 단계가 있고 permissions 에 `issues: write` 가 있다.
red 증명: group 을 collector 로 되돌리면 (1)이 실패한다. 알림 단계를 지우면 (3)이 실패한다.

소급: 없음.

파일: .github/workflows/refresh-majors.yml .github/workflows/refresh-tuition.yml

위험: 작다. 관리자 화면 로봇 목록(admin.js ROBOTS)과 test-collector 「관리자 화면 로봇 목록」은 파일명·workflow_dispatch 만 보므로 영향이 없다. 다른 세션은 이 두 파일을 건드리지 않는다.

---
## [refresh/TUITION-01] P3 · needs-human
**결정: 보고만(개발자에게 시운전 여부를 묻는다). 대기줄 수리는 QUEUE-01 로 한다.**

이유: 실재한다. refresh-tuition 의 성공 실행은 08-27 두 번(33054402176·33054553008, 각 약 20초)뿐이다. 둘 다 계열 단계가 생기기 전이다. 그 뒤 수동 실행은 0회이고, 6회는 09-30 push 0초 실패(36652726646 등 — 워크플로 파일 거절 시기)다. data/tuition.json 의 byField 는 개발자 맥북 실행(fieldUpdatedAt 2026-08-27T09:22:54Z)으로 만든 것이다. 지금 44곳 모두 avg·byField 를 갖고 있어 화면 영향은 없다. 실패 알림 단계가 없다는 부분은 코드 결함이라 QUEUE-01 수리에 넣었다. 남은 것은 '언제 시운전할지'라는 사람의 결정이다.

수리 명세: 알림 단계는 QUEUE-01 수리에 포함했다. 이 항목은 사람이 시운전 시점을 정하는 것만 남는다.

관문: QUEUE-01 의 ⓔ(3)이 refresh-tuition.yml 의 넘어짐 알림을 잰다.

소급: 없음 — 실행하면 관문을 통과한 것만 저장된다.

파일: .github/workflows/refresh-tuition.yml

위험: 시운전은 한국장학재단 포털 약 2,711쪽(25분)을 두드린다. 월·목 05:53 KST 한국장학재단 수확 로봇과 겹치지 않게 누르는 편이 좋다.

---
## [refresh/ESSAY-03] P3 · needs-human
**결정(추천안 ①): 두 인크루트 글을 출처 목록에서 뺀다(지우지 말고 그 파일의 보관 방식이 있으면 보관).**

이유: 실재한다. 이슈 #342(2026-10-01, 열림)의 '🩺 seed 건강' 에 '(5회) …newsno=436538 · (5회) …newsno=436729' 가 있다. 같은 이슈의 '읽은 곳' 에서 두 글은 각각 280줄·296줄을 읽고 규칙 0종이다(읽기 실패가 아니라 내용이 규칙에 안 붙는다). collector/essay-sources.json:102-113 두 줄 모두 strike 5, '2026-09-05 추가'. 로봇은 설계상 스스로 지우지 않는다.

수리 명세: 개발자가 ①을 고르면 collector/essay-sources.json seeds 에서 두 객체(url newsno=436538 · 436729)를 지운다. 파일의 현재 들여쓰기 형식을 그대로 지킨다.

관문: 없음(데이터 한 번 정리).

소급: 없음.

파일: collector/essay-sources.json

위험: 없음.

---
## [refresh/TWO-01] P3 · needs-human
**결정(추천안 ①): 그대로 둔다 — 코드 변경 없음.**

이유: 실재하지만 해는 없다. two-school-scan.yml 은 workflow_dispatch 와 옛 브랜치(claude/external-expert-consultation-questions-o8bik7, 아직 있음 d0da898) push 로만 돈다. 예약이 없고 결과(collector/extracted/two-school/)는 이미 기본 브랜치에 있다. 지우려면 test-collector 9102·9104·9118행(관리자 화면 목록 검사)과 _admin/admin.js 의 ROBOT_NOT_LISTED 를 함께 고쳐야 한다. test-collector 1624행은 scan.json 을 판정 표본으로 쓰므로 결과물은 남겨야 한다. 다른 작업과 겹칠 곳이 많아 지금 지울 이득이 작다.

수리 명세: 개발자가 ②를 고를 때만 한다. two-school-scan.yml 을 지우고, _admin/admin.js 의 ROBOT_NOT_LISTED 와 test-collector 9100-9118행의 기대값에서 'two-school-scan.yml' 을 뺀다. collector/scan-two-schools.mjs·classify-two-schools.mjs·extracted/two-school/ 은 남긴다(1624행 표본).

관문: 기존 test-collector 「관리자 화면 로봇 목록」이 지운 뒤의 목록을 잰다.

소급: 없음.

파일: .github/workflows/two-school-scan.yml

위험: ②를 고르면 _admin/admin.js·verify/test-collector.mjs 를 다른 묶음과 함께 고치게 되어 충돌 위험이 있다. ①이면 위험이 없다.

---
## [refresh/GATE-01] P3 · confirmed

이유: 실재한다. run 37146558541(10-03) 로그를 보면 Openverse 가 9개교 모두 '401 https://api.openverse.org/v1/images/?q=…' 이다. 강원대학교는 '위키데이터: api 414 https://commons.wikimedia.org/w/api.php?…titles=File%3AKangwonUniv+Mirae.jpg%7C…'(한글 제목 40개를 묶은 GET 주소)로, 분류 61장 중 검색 1장만 받았다. 코드는 tools/fetch-gate-photos.mjs:176-180(commonsFiles 40개 고정 묶음 GET)와 205-207행(Openverse 익명 GET)이다. '고려대 세종 0장' 증상은 그 뒤 #9·#10 실행과 사람의 선택으로 사진 2장이 붙어(98cc4bbc '고려 세종 사진으로 44/44') 해소됐다. 남은 것은 도구 결함 둘이다. Openverse 401 의 원인은 확인하지 못했다(샌드박스에서 접근 불가). 국민대 '두부1·치즈1' 같은 잡음은 사람이 고르므로 해가 없다.

수리 명세: ① tools/fetch-gate-photos.mjs 의 실행부(지금 228행 `fs.mkdirSync(OUT…)` 부터 끝까지)를 `async function main()` 으로 감싼다. 그리고 `if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();` 로 부른다(build-school-photos.mjs:121 과 같은 꼴). 관문이 순수 함수를 불러도 위키미디어를 두드리지 않게 하려는 것이다. 맨 위의 SCHOOLS·ME·sharpLib 는 그대로 둔다. test-collector 1609행은 `ME.SERVED_SCHOOLS`·`ME.noticeFileKey(name)` 글자를 보므로 위치만 지키면 된다.
② `export function titleChunks(titles, maxChars = 6000, maxN = 40)` 를 더한다. 앞에서부터 담다가 encodeURIComponent(묶음.join('|')).length 가 maxChars 를 넘거나 개수가 maxN 이 되면 끊는다. 제목 하나가 혼자 넘으면 혼자 한 묶음이다. 순서·중복은 보존한다. commonsFiles 는 이 묶음으로 돈다.
③ Openverse: getJson 이 던지는 오류에 status 를 싣는다. openverseCandidates 가 401/403 을 받으면 모듈 변수 `openverseOff = status` 를 세우고, 남은 학교는 요청 없이 건너뛴다. 실행 끝에 한 줄만 찍는다: `Openverse 출처 꺼짐 (HTTP ${status} — 원인 미확인: 익명 요청 거절 또는 Actions 주소 차단일 수 있음)`. 원인을 단정하는 문구는 금지(CLAUDE.md 매 세션 5). 인증 열쇠(OAuth) 도입은 사람 결정이라 하지 않는다.
바꾸지 말 것: 라이선스 거름(OK_LICENSE·BAD_LICENSE) · must/not 이름 거름 · '이 파일은 고르지 않는다' · ONLY/FRESH/PER/SOURCES 뜻 · manifest 의 picks/pruned 이어받기 · 파일 이름 규칙(GATE-02 는 이름을 바꾸지 않고 대조로 막는다).

관문: verify/health-gates/refresh.mjs ⓖ.
(0) 먼저 정적 검사: 소스에 main 가드(`await main()` 이 argv 비교 if 안에 있음)가 있어야만 import 한다. 가드 없이 import 하면 관문이 실제 위키미디어를 두드리므로, 가드가 없으면 실패로 세고 import 하지 않는다.
(1) 표본: 'File:2009년 3월 20일 중앙소방학교 FEMP(소방방재전문과정입학식) 입학식'+i+'.jpg' 40개 → 모든 묶음의 encodeURIComponent(join('|')).length ≤ 6000 이고, flat() 이 입력과 같다.
(2) 짧은 영문 제목 100개 → 묶음마다 40개 이하.
(3) 정적 검사: commonsFiles 가 titleChunks( 를 부르고, `i += 40` 고정 잘라내기가 없다.
(4) 정적 검사: openverseOff 가 있다.
red 증명: titleChunks 를 40개 고정 slice 로 되돌리면 (1)이 실패한다.

소급: 없음. 사람이 다음에 run-gate-photos.txt 로 돌릴 때부터 적용된다. 지금 학교 사진은 44/44 이다.

파일: tools/fetch-gate-photos.mjs

위험: 작다. main() 으로 감쌀 때 맨 위 변수 의존(SCHOOLS·OUT·SOURCES)을 빠뜨리면 실행이 깨지는데, 관문은 순수 함수만 재므로 그 실수를 못 잡는다. 수리자는 `node --check tools/fetch-gate-photos.mjs` 와 함께 ONLY 없이 미리보기 실행을 할 수 없으므로(네트워크), 코드 리뷰로 확인할 것.

---
## [refresh/GATE-02] P3 · confirmed

이유: 위험이 실재하고 실측 사례가 있다. 같은 파일 이름이 실행마다 다른 사진이 된다. run #6(dee37fe0, 10-03 10:01)→#7(7c3ff9a8, 10:40) 사이에 9개 이름의 뜻이 바뀌었다. 예: n1mo5fbn-2.jpg 는 'File:20150227광나루안전체험관 세종대학교 유학생 안전교육16.jpg' → 'File:Sejong University Gate.jpg', nwqmwga-1.jpg 는 '전남대학교 정문 입구 길목' → '518memorial hall…', 그 밖에 n6xhy7d-2·n1uf7bji-2·nlzhvsh-1 등. 지금은 어긋남이 없다. 고른 기록(docs/designs/assets/gates/school-photo-picks.json, 33개교)은 모두 그 학교의 마지막 재수집 뒤에 만들어졌다. 대조한 순서: picks 커밋 a05186fd 10:52 · c6051346 · f6868dab · b444b603 · 98cc4bbc ↔ 재수집 #6 10:01 · #7 10:40 · #8 19:05(9개교, picks 는 그다음 날) · #9·#10 10-04 04:04~05(n1ch7t87, picks 는 04:24). 문제는 다음과 같다. tools/build-school-photos.mjs:86-90 은 file 이름만 보고 원본 제목을 대조하지 않는다. picks 칸에는 file·focusSquare·what·by(·crop)만 있다. 시작 화면 14장(assets/gates/gates.json · manifest.picks 'snu-1.jpg' 등)도 같은 꼴이고, 'snu' 등 id 가 fetch-gate-photos SCHOOLS 에 남아 있어 FRESH 재수집 대상이 될 수 있다(gate-photos.yml:53 FRESH '1' 고정). crop 은 번호판·행인을 덜어 내는 장치라, 엉뚱한 사진에 적용되면 그것이 공개 주소(640px)로 나간다.

수리 명세: 이름을 바꾸지 않고 '원본 제목 대조'로 막는다. 틀리면 다른 사진을 내보내지 않고 멈춘다.
① tools/build-school-photos.mjs 에 순수 함수 `export function titleFromPage(url)` 를 둔다. commons /wiki/ 뒤를 decodeURIComponent 하고 '_' 를 ' ' 로 바꾼다.
② 같은 파일에 `export function pickProblems(chosen, files)` 를 둔다. chosen = {학교:[pick]}, files = Map(file → manifest 항목). 문제 문장 배열을 돌려준다.
  · manifest 에 없음(지금 87행과 같음)
  · pick.title 이 없음 → '<학교>: <file> 고른 기록에 원본 제목(title)이 없다'
  · meta.title !== pick.title → '<학교>: <file> 가 지금은 다른 사진이다 (고른 것 <pick.title> · 지금 <meta.title>) — 다시 받은 뒤 다시 골라야 한다'
③ main() 은 사진을 만들기 전에 pickProblems 로 걸린 pick 을 건너뛰고 problems 에 넣는다(지금처럼 끝에 exitCode 1). 시작 화면 주입(70-73행)은 `{…, title: titleFromPage(g.page)}` 를 붙인다. assets/gates/gates.json 의 page 가 승인 당시 원본이다.
④ tools/gate-reel/build-app-gates.mjs(작게): manifest.picks 의 파일마다 새 manifest pageUrl 과 기존 assets/gates/gates.json 의 같은 id 항목 page 를 비교한다. 다르면 exit 1 로 멈추고 '시작 화면 사진이 다시 받은 뒤 다른 사진이 됐다 — 다시 골라야 한다' 를 알린다. gates.json 이 없으면(첫 빌드) 건너뛴다.
⑤ tools/fetch-gate-photos.mjs: FRESH=1 이고 targets 중 school-photo-picks.json 이나 manifest.picks 에 파일이 있는 학교가 있으면, 지우기 전에 '⚠️ 고른 기록이 있는 학교를 다시 받습니다 — <학교>: <파일들> · 빌드가 제목 대조로 멈추니 다시 골라야 합니다' 를 찍는다(막지는 않는다).
바꾸지 말 것: 바이트 해시 이름(assets/schools/*.webp) · 라이선스 거름 · crop 뜻 · 학교당 3장 · 서비스 학교만 · 안 쓰는 그림 지우기.

관문: verify/health-gates/refresh.mjs ⓕ — import(new URL('tools/build-school-photos.mjs', root))(main 가드가 이미 있다 · 121행).
(1) titleFromPage('https://commons.wikimedia.org/wiki/File%3ASeoulNatlUnivMainGateAtNight.jpg') === 'File:SeoulNatlUnivMainGateAtNight.jpg'
(2) files = Map([['x-1.jpg',{title:'File:Gate.jpg'}],['x-2.jpg',{title:'File:Other.jpg'}]]). pickProblems({A:[{file:'x-1.jpg',title:'File:Gate.jpg'}]}, files) → []. 같은 것에 title 'File:Old.jpg' → 문제 1건('다른 사진'). title 없음 → 문제 1건. 없는 파일 → 문제 1건.
(3) 정적 검사: main() 이 pickProblems( 를 부르고, 시작 화면 주입이 titleFromPage( 를 쓴다.
red 증명: pickProblems 에서 제목 비교 줄을 지우면 (2)의 'File:Old.jpg' 사례가 [] 가 되어 실패한다.

소급: 한 번만 하는 로컬 실행으로 처리한다. school-photo-picks.json 의 모든 pick 에, 지금 docs/designs/assets/gates/manifest.json 의 같은 file 항목 title 을 `title` 로 붙인다. 손으로 쓰지 말고 짧은 node 스크립트로 한다. 저장 형식은 지금 파일과 같은 JSON.stringify(x, null, 1), 끝 개행 없음(실측: 그 형식과 바이트 일치). 이 소급이 안전한 근거는 reason 의 타임라인 대조다(모든 picks 가 마지막 재수집 뒤에 만들어졌다). 붙인 뒤 `node tools/build-school-photos.mjs` 를 돌려 problems 0 · assets/schools/photos.json 이 바뀌지 않는지(같은 해시 이름) 확인한다. sharp 가 필요하다.

파일: tools/build-school-photos.mjs docs/designs/assets/gates/school-photo-picks.json tools/fetch-gate-photos.mjs tools/gate-reel/build-app-gates.mjs

위험: 중간. build 가 문제를 찾으면 그 학교 사진을 빼고 '안 쓰는 그림'으로 지우므로, 소급이 틀리면 학교 사진이 빠진다(틀린 사진보다는 낫다). 소급 뒤 빌드 결과에 diff 가 없어야 한다. 다른 세션과 겹치는 파일은 없다. test-collector 「학교 대표 사진」(2603행)이 build-school-photos.mjs 의 내보내기·소스 글자를 보므로, 기존 export 이름(OK_LICENSE·FOCUS_RE·cleanAuthor·cropBox·creditLine)과 2658·2663행이 찾는 글자 꼴을 지킬 것.

---
## [gaps/gaps-06] P3 · needs-human
**결정: (나) ① 학기 시작 전(2월·8월 20일 새벽, 정각 피하기 · 홀수 분) 자동 예약을 넣는다 + MAJORS-02(열쇠 없으면 빨간불). (가) 한 번 눌러 보는 것은 오케스트레이터가 나중에 개발자에게 묻는다.**

이유: 실재한다. refresh-majors.yml 실행 이력은 모두 6건이고, 전부 09-30 push 이벤트 0초 실패다(36652726612 ~ 36656322579). workflow_dispatch 는 0건이다. data/majors.json 의 updatedAt 은 2026-08-06(15c9cbc, 로컬 실행)이고, data/majors/ 는 09-26 7e3d8fab 에 그 파일로 미리 발행한 것이다. 예약은 없다(머리말 3행 '학기 시작 무렵 수동 실행'). robot-heartbeat.mjs 는 cron 이 있는 워크플로만 본다(104행 scheduledWorkflows). 저장 전 내용 관문이 없다는 지적(gaps-03)은 다른 묶음 몫이다. 실행 자체는 사람이 관리자 화면(admin.js:2096 「학과 목록 갱신」)에서 누를 수 있다. 이 검증자와 수리자는 워크플로를 깨우지 않는다.

수리 명세: (가) 코드 변경 없음 — MAJORS-01·MAJORS-02·QUEUE-01 이 들어간 뒤 사람이 한 번 누른다. 실행 로그와 collector/majors-report.md 를 보고 '열쇠 없음' ::error 가 없는지, 연세 미래 이름 후보가 찍혔는지 확인한다.
(나) ①을 고르면 refresh-majors.yml 에 schedule 을 더한다: `- cron: '17 21 19 2,8 *'`(2·8월 20일 06:17 KST — 홀수 분 · 정각과 UTC 자정 피함). 달 칸이 있는 cron 은 robot-heartbeat 가 판정하지 않는다(null) — 알려진 한계로 주석에 적는다.

관문: (나)①을 고르면 health-gates/refresh.mjs ⓔ 에 'refresh-majors.yml 에 schedule 이 있고 분이 홀수다' 를 더한다.

소급: 실행이 곧 소급이다 — 학과 파일 전부를 다시 쓴다.

파일: .github/workflows/refresh-majors.yml

위험: 첫 실행은 내용 관문 없이 저장된다. MAJORS-01 risk 의 '학교 수 바닥 검사'를 같이 넣는 것을 권한다.

---
## 손대지 않는 것 (이미 고쳐짐·오진·다른 세션·사람 결정 대기)
- [refresh/FIXED-01] already-fixed: 이미 고쳐졌다. HEAD 의 test-collector 「로봇 대기줄」에 dupWith 검사('어느 단계에도 with: 가 둘 이상 없다')가 있다. refresh-majors.yml·refresh-tuition.yml·essay-playbook.yml·kosaf-fetch.yml·gate-photos.yml 을 중복 키를 잡는 YAML 로더로 직접 읽어 모두 통과했다(이 검증에서 실행). essay-playbook 은 10-01 dispatch 36820808592 가 성공했다. refresh 둘은 수리 뒤 실행이 없지만 파일 문
- [refresh/FIXED-02] already-fixed: 이미 고쳐졌다. 수리 커밋은 ccf29411(kosaf-detail-loss.mjs, 재단 코드로 대조)이다. 이후 09-30 dispatch 36663155157 과 10-02 예약 36945129700 이 성공했다. 로그에 '✓ 목록에 남은 재단의 상세를 잃지 않았다 (지난 1647건 → 지금 1650건)' 가 있다. 이슈 #227 은 09-30 에 닫혔다(지금 kosaf 라벨 열린 이슈 0). 다음 예약은 10-05(월) 20:53 UTC 다.
- [refresh/FIXED-03] already-fixed: 이미 고쳐졌다. 수리 커밋 2b4d99a 뒤 10-01 dispatch 36820808592 가 성공했고 #317 은 닫혔다. 이 검증에서 node verify/verify-essay-ask.mjs 를 로컬로 돌려 '통과 117 · 실패 0' 을 확인했다. 같은 유형(새 서술형 칸이 분류에 안 걸림)은 양식이 늘면 다시 날 수 있다 — 설계상 학습 로봇이 앱 검사에 묶여 있다. 다음 예약(10-05)에서 다시 확인한다.
- [refresh/FIXED-04] already-fixed: 이미 고쳐졌다. run 37146558541(10-03) 저장 단계 로그에 '! [rejected] … (fetch first)' → 'Successfully rebased' → 'f94d94b5..56a2f5a7' 이 있어 재시도 경로가 실제로 동작했다(f8961035). 그 뒤 10-04 실행 8986661a·96aa786b 도 저장됐다.

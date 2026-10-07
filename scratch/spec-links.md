# 수리 명세 — 묶음 links

권장 순서: links-new-1 → links-7 → links-14 → links-2 → links-9 → links-15 → links-10
예상 손댈 파일: collector/canon-url.mjs collector/auto-register.mjs tools/admin-apply.mjs collector/url-key.mjs collector/detail-url.mjs collector/link-hunter.mjs collector/link-hunt-rules.mjs collector/resolve-detail-urls.mjs collector/browser-collect.mjs .github/workflows/resolve-detail-urls.yml .github/workflows/audit-coverage.yml .github/workflows/kosaf-fetch.yml _admin/admin.js data/registered.json data/admin-log.json verify/health-gates/links.mjs verify/health-gates.mjs

검증 메모: 1) 🔴 다른 세션(source-link-integrity)은 이제 '합쳐지지 않은 가지'가 아니다. 10:44Z 에 기본 브랜치로 합쳐졌다.
- origin/claude/nice-heisenberg-WESq5 = a4fe9a01 이고, nice-heisenberg..source-link-integrity 의 차이는 0커밋이다.
- 우리 작업 브랜치(46f08990)에는 1a33db59 가 없다. collector/link-hunt-rules.mjs 도 없다.
- 수리자는 반드시 `git merge origin/claude/nice-heisenberg-WESq5` 를 먼저 한다. 그 세션이 계속 일하면 link-hunter.mjs·detail-url.mjs·url-key.mjs·resolve-detail-urls.mjs·admin-apply.mjs·_admin/admin.js 에서 부딪힐 수 있다.
- 거꾸로 verify/health-gates.mjs(관문 틀)는 우리 브랜치에만 있다.

2) 새 발견 links-new-1(P1 · 자동 등록 id 충돌)은 '원문 링크' 묶음 밖이다.
- 자동 등록·관리자 등록이 9개교에서 조용히 막혀 있다(70건 + 서강대 23건).
- auto-register.mjs 를 다른 묶음(수집·등록)이 고친다면 그 수리자에게 함께 넘긴다.
- canon-url.mjs 는 links-7 과 겹치므로 같은 수리자가 new-1 → 7 순서로 고치고, 저장된 id 가 하나도 안 바뀌는지 다시 잰다.

3) 이미 해결되어 할 일이 없는 것
- links-6 · links-8: 다른 세션이 고쳤고 기본 브랜치에 들어왔다.
- links-11 · links-12: 이미 고쳐짐.
- links-8 의 수리안('boardTitle===name 을 미아로')은 정식 등록 133건을 거짓 경보로 만들어 반박했다.

4) 사람 확인: links-10(재검사 끄기 · 추천 가) · links-13(10-05 저녁 결과 대기 · 추천 기다림).

5) 계획 4 확인 목록
- 10-05 사냥꾼 리포트의 서울교대 4건이 ✅ 인가
- 10-05 18:47 KST link-check 의 국민대 3건 판정
- 10-06 05:13 KST 복구 예약이 전체 학교로 돌았는가
- 자동 등록 리포트의 '이미 등록(같은 id)'이 0 근처로 내려갔는가

6) 읽기 전용 작업 규칙을 지켰다. 버리는 작업 사본(verify-links/wt)은 지웠다. 이슈 #387 은 열린 채로 두었다.


---
## [links-new-1] P1 · confirmed

이유: (이번 검증에서 새로 찾음. links-7 의 'idFromUrl 이 바뀌는지 먼저 잰다'를 재다가 나왔다) 자동 등록 id 공식 idFromUrl = 'auto-' + canonUrl 의 영숫자 '뒤 24자'(collector/canon-url.mjs:72-74)다. canonUrl 은 파라미터를 이름순으로 정렬한다. 그래서 글 번호(nttNo·pstSn·bidx…)가 앞에 오고 게시판 공통값(searchKrwd·sf.pnos·srchVoteType·slug·namepage…)이 꼬리 24자를 차지하는 게시판에서는 그 게시판의 모든 글이 같은 id 를 받는다. 실측(최신 기본 브랜치 a4fe9a01 · data/notices.json): 경기대 3글 모두 'auto-hkrwdsfpnos1073sfpnos888', 서강대 모든 글 'auto-amepagescholarshipnotice', 강원대 'auto-archgbn0searchordersort0', 계명대 40글이 'auto-srchenable1srchvotetype1'. 공고 233개 열쇠 중 12개가 여러 글에 겹친다. 이미 등록된 다른 글과 id 가 겹쳐 등록되지 못하는 공고는 70건이다(학교별: 계명 33 · 경기 11 · 숭실 10 · 중앙 7 · 강원 4 · 전북 2 · 서울과기 2 · 서울교대 1). 서강대 23건은 차단 목록 blockIds 의 'auto-amepagescholarshipnotice' 에 통째로 막힌다. 이 id 는 사람이 막은 서강대 4건(blockUrls 84-87행)에서 나온 것이다. auto-register.mjs:309 `registered.items.some((i) => i.id === id)` 는 '이미 등록(같은 id)'로, 311행은 '사람이 막아 둔 공고'로 조용히 거른다. classify(161행)가 주소(canon)로 이미 등록된 글을 먼저 거르므로, 309행까지 온 건은 정의상 '주소가 다른데 id 만 같은 것', 곧 충돌이다. 최신 리포트도 같다: collector/report.md '이미 등록(같은 id) · 17건' · '사람이 막아 둔 공고 · 12건', collector/browser-report.md '이미 등록(같은 id) · 20건'. 관리자 등록(tools/admin-apply.mjs:450-451 `idFromUrl('adm-')` → '같은 id가 이미 있습니다' 실패)도 같은 덫에 걸린다. 2026-09-29 '정식 등록도 44개교' 지시가 9개교에서 조용히 무력해진 상태다(그 글들은 실시간 피드에는 뜨지만 자격 진단·양식이 없다). canon-url.mjs 머리말이 경고한 사고(2026-08-14 '한 건 등록되면 나머지 공고 전부가 중복 취급')가 id 단계에서 다시 난 것이다.

수리 명세: 🔴 idFromUrl 공식 자체는 바꾸지 않는다. 바꾸면 저장된 id 와 blockIds 가 통째로 무효가 된다(canon-url.mjs:62-71 경고 · auto-register.mjs:255-259 2026-08-14 사고).
① collector/canon-url.mjs(순수 함수만): `export function idHash(cu)` 를 더한다(FNV-1a 32bit → base36 7자. 같은 입력이면 늘 같은 값). 이어 `export function registerId(prefix, raw, { holderCanon = () => '', blockedIds = new Set(), blockedCanons = new Set(), ambiguous = () => false } = {})` 를 더한다. legacy=idFromUrl(prefix, raw) · cu=canonUrl(raw).
- id 를 가진 등록분이 있고(held=holderCanon(legacy)) 그 주소가 cu 와 다르면 → `${legacy}-${idHash(cu)}`
- legacy 가 blockedIds 에 있고, cu 는 blockedCanons 에 없고, ambiguous(legacy) 가 참이면(이번 묶음에서 서로 다른 주소 둘 이상이 같은 legacy) → 차단 id 로 보지 않고 꼬리표 id 를 준다
- 그 밖에는 legacy
- 돌려주는 값 { id, legacy, blockedByLegacy: blockedIds.has(legacy) && !ambiguous(legacy) }
② collector/auto-register.mjs
- 루프 전에 이번 실행의 공고 전부로 legacy id → 서로 다른 canon 집합 Map 을 만든다(ambiguous 판정용)
- holderCanon 은 registered.items(이번 실행에 push 된 것 포함 · 383행)에서 id → canonUrl(decodeUrlEntities(sourceUrl))
- 309행: `(id 가 이미 있음)` 대신 다음 순서로 판정한다
  (a) 같은 id 의 등록분이 같은 학교이고 normTitle(boardTitle||name)이 같으면(표식이 진짜 주소로 풀린 같은 글) → '이미 등록(같은 글 · 주소만 다름)'으로 거른다
  (b) 아니면 registerId 의 꼬리표 id 를 쓴다
- 311행: `blockedUrls.has(cu) || blockedIds.has(id) || blockedByLegacy` 로 바꾼다. 모호한 차단 id 는 리포트에 '⚠️ 차단 id 하나가 여러 공고에 걸림 — 주소(blockUrls)로만 막음: <id> n건' 한 줄을 남긴다.
- 263행 등록분 제거 필터는 그대로 둔다(꼬리표 id 는 blockIds 에 없으니 안 걸린다).
③ tools/admin-apply.mjs
- register(450-451): 같은 registerId('adm-', url, {holderCanon}) 를 쓴다. 같은 주소 중복은 이미 445행이 막는다.
- unblock derived(402): `x === idFromUrl(p,u) || x === `${idFromUrl(p,u)}-${idHash(canonUrl(u))}``
🔴 바꾸지 말 것
- canonUrl 정규화 규칙
- 기존 id
- blockIds·blockUrls 내용(사람의 차단 기록. 설정 파일은 손대지 않는다)
- maxPerRun 8
- '선조치후보고' 리포트 형식
- CLAUDE.md 원칙 2(보수적 규칙)

관문: verify/health-gates/links.mjs (표본만 쓴다)
① 공식 불변: idFromUrl('auto-','https://kau.ac.kr/kaulife/scholnoti.php?code=s1301&page=3&mode=read&seq=10681') === 'auto-notiphpcodes1301seq10681'. 서강대 표본 550536 → 'auto-amepagescholarshipnotice'.
② 충돌 재현: 경기대 표본 nttNo=626271·626377(searchKrwd·sf.pnos 꼬리 포함)은 legacy 가 같다. registerId 는 holder(626271)가 있을 때 626377 에 '-' 꼬리표 id 를 주고, 그 값은 626271 의 id 와 다르다. 같은 주소면 legacy 를 그대로 준다. 두 번 불러도 같은 값이다.
③ 차단: blockedIds={'auto-amepagescholarshipnotice'} · blockedCanons={550536} · ambiguous 참일 때 → 551052 는 blockedByLegacy=false, 550536 은 blockedCanons 로 막힌다. ambiguous 거짓(글 하나뿐)이면 blockedByLegacy=true(옛 행동 유지).
④ 글자 검사(auto-register·admin-apply 는 불러오면 실행되므로 import 금지): auto-register.mjs 에 `registerId(` 호출이 있고 `registered.items.some((i) => i.id === id)` 단독 판정이 없다. admin-apply.mjs register 경로에 `registerId(` 가 있다.
빨간불 증명: registerId 가 늘 legacy 를 돌려주게 되돌리면 ②가 실패한다. blockedByLegacy 를 blockedIds.has(legacy) 로 되돌리면 ③이 실패한다.

소급: 코드가 스스로 고친다. 수리가 들어간 뒤 다음 자동 등록 실행부터, 그동안 '같은 id'·'모호한 차단'으로 떨어지던 공고가 classify 를 통과하면 꼬리표 id 로 등록된다(한 번에 maxPerRun 8건씩, 하루 여러 번). 손으로 고칠 데이터는 없다. 설정 파일(blockIds)도 고치지 않는다.
수리 직후 할 일
- 로컬 모의로 잰다: auto-register 는 불러오면 실행되므로 `bash tools/robot-run.sh` 로만 돌린다. 버리는 작업 사본에서 감사(verify/audit-data.js)를 통과하는지 본다.
- 첫 클라우드 리포트의 '같은 id' 숫자가 0 근처로 내려갔는지 확인한다.

파일: collector/canon-url.mjs collector/auto-register.mjs tools/admin-apply.mjs verify/health-gates/links.mjs verify/health-gates.mjs

위험: ① 수리 직후 며칠 동안 9개교 공고가 자동 등록으로 몰려 들어온다(실행당 상한 8). 그중 타교 동일 사업은 '컨펌 대기'·전국 승격 경로를 탄다. 학교 한정(schoolOnly) 부작용(노션 F-5)이 늘어 관리자 '할 일'이 커진다.
② 같은 글 판별(a)이 느슨하면 이중 등록이 나고, 빡빡하면 지금처럼 거른다. 이중 등록은 눈에 보이고 지울 수 있다(canon-url 머리말의 '잘못 다른 글로 보는 쪽이 싸다' 방향).
③ tools/admin-apply.mjs 는 다른 세션(source-link-integrity)이 고친 파일이고 이미 기본 브랜치에 합쳐졌다(a4fe9a01). 반드시 최신 기본 브랜치를 합친 뒤 고친다.
④ 이 건은 '원문 링크' 묶음 밖(자동 등록)이다. 다른 묶음(수집·등록)이 auto-register.mjs 를 고친다면 한 수리자에게 몰아야 한다.

---
## [links-2] P3 · confirmed

이유: P2 핵심인 이슈 #387 거짓 경보와 '포기 처리된 건' 문구는 다른 세션 커밋 1a33db59 로 고쳐졌고, a4fe9a01 에서 기본 브랜치에 합쳐졌다. 바뀐 것:
- link-hunt-rules.mjs settleEscalation 이 3단계 실패(stage3Failed · link-hunter.mjs:806-808) 뒤에만 사람에게 알린다
- 머리말이 '다음 시도 날을 기다리는 건'으로 바뀌었다(353행)
- 최신 리포트(10-04 18:45 KST)는 '사람에게 알릴 건 0건'
남은 것 둘(P3)
- ① failed 가 1단계에서 오른다(link-hunter.mjs:663·685). 그런데 3단계가 찾아도(789-790: extraFound·found 만 올림) 내리지 않는다 → 끝줄 '아직 못 찾음 N건'이 부풀려진다(#387: 6건 중 1건은 찾은 것).
- ② 이슈 본문은 리포트 전체다(link-hunter.yml:171-179 --body-file). settleEscalation 루프가 아무 줄도 남기지 않아, 이슈 제목의 'n건'이 어느 공고인지 본문에 없다. #387 은 아직 열려 있다.
이 묶음은 우리 브랜치(46f08990)에 없다. link-hunt-rules.mjs 도 없다 → 최신 기본 브랜치를 먼저 합쳐야 한다.

수리 명세: (최신 기본 브랜치를 합친 뒤) collector/link-hunter.mjs
① 숫자 failed 를 집합 failedKeys 로 바꾼다. 1단계 663·685행에서 add(t.key), 3단계 성공 분기(789행 got)에서 delete(t.key). 끝줄·GITHUB_OUTPUT 의 failed 는 failedKeys.size.
② 806-808 루프에서 settleEscalation 이 참인 대상을 escalatedNow 배열에 모은다. collector/link-hunt-rules.mjs 에 순수 함수 `escalationLines(list)` 를 더한다. 입력은 [{title,key,attempts,lastWhy,likelyGone}], 출력은 '### 🙋 사람 확인 필요 — 이번에 처음 알리는 공고 n건' 절의 줄들. saveAll 에서 이 절을 리포트 맨 앞(머리말 바로 뒤)에 넣어 이슈 본문 첫 화면에 보이게 한다.
🔴 바꾸지 말 것
- ESCALATE_AT·BACKOFF_DAYS
- '포기는 없다' 원칙
- stuck 의 뜻(3단계 뒤 처음 알릴 건만)
- 이슈 제목 형식(close-old-reports 가 제목으로 찾을 수 있다)

관문: verify/health-gates/links.mjs
① escalationLines([두 표본]) 의 항목 줄 수 === 2. 두 제목이 들어 있다. 빈 배열이면 [] 를 돌려준다(절을 안 찍는다).
② 글자 검사: link-hunter.mjs 의 3단계 got 분기 본문(`extraFound += 1` 주변 400자)에 `failedKeys.delete(` 가 있다. saveAll 본문에 `escalationLines(` 가 있다.
빨간불 증명: delete 줄을 지우면 ②가 실패한다. escalationLines 가 [] 를 돌려주게 하면 ①이 실패한다.

소급: 없다. 리포트·이슈 문구만 바뀐다. 열려 있는 #387 은 수리 커밋을 알린 뒤 사람이 닫을지 정한다(이 작업에서는 이슈를 건드리지 않는다).

파일: collector/link-hunter.mjs collector/link-hunt-rules.mjs verify/health-gates/links.mjs

위험: link-hunter.mjs 와 link-hunt-rules.mjs 는 다른 세션이 막 고친 파일이다(1a33db59). 그 세션이 계속 일하면 같은 줄이 부딪힌다. links-9·links-14 와 같은 파일이므로 한 수리자가 한 번에 고친다.

---
## [links-7] P3 · confirmed

이유: 최신 기본 브랜치에서도 그대로다.
- data/notices.json · data/notices/ntxxf09.json 의 경기대 2건(nttNo=626377 · 626271)에 ';jsessionid=…' 가 남아 있다.
- 정식 등록 auto-hkrwdsfpnos1073sfpnos888 의 sourceUrl 에도 626271 판 jsessionid 가 붙어 있다(10-04 09:44Z e9c402e3 브라우저 수집 자동 등록이 그 공고 주소를 그대로 담았다).
- 실측: canonUrl·urlKey 모두 세션만 다른 두 주소, 세션 없는 주소를 서로 다르다고 본다(false · false).
- canon-url.mjs:43 의 VOLATILE 은 쿼리 이름일 때만 걸린다. url-key.mjs urlKey(62-82)는 경로를 그대로 쓴다. detail-url.mjs:83·110 은 판정 안에서만 뗀다.
- 사냥꾼(658·789)·복구(380)는 찾은 주소를 그대로 저장한다. 다른 세션 커밋 중 세션을 떼는 것은 link-candidates.mjs normCandUrl(후보 장부)뿐이다.
학생 피해는 지금은 없다.
- link-check-state 가 두 주소를 모두 'post'로 판정했다. 세션 없는 626375 도 'post'라 세션 없이 열리는 것이 확인됐다.
- 앱의 registeredUrlMatcher(app.js:2827-2831)는 앞부분 일치로 비교한다. 피드 공고가 세션 없는 주소로 바뀌고 정식 등록이 세션 판으로 남으면, 같은 공고가 홈에 두 번 뜰 수 있다.

수리 명세: (최신 기본 브랜치를 합친 뒤)
① collector/canon-url.mjs canonUrl: `u.pathname.replace(/;jsessionid=[^/]*/i, '')`.
② collector/url-key.mjs urlKey: base(물음표 앞, 물음표 없을 때 u 전체)에서 `;jsessionid=[^/?#]*` 를 뗀다. noticeUrlRank: 세션 표식이 있으면 HTML 기호 꼴처럼 1을 준다. 그러면 preferNotice·patchUrlsBySchool 이 세션 없는 판을 고른다.
③ collector/detail-url.mjs: 이미 있는 SESSION_IN_PATH 로 `export function cleanStoredUrl(u)` 를 둔다(decodeUrlEntities + 세션 떼기). board-links.mjs stripSessionId 와 같은 정규식을 불러 써서 사본을 늘리지 않는다. rowDetailCandidates 의 add() 가 이 함수로 씻은 주소를 후보로 쓴다(새 탭 확인도 씻은 주소로 한다 — 학생이 여는 주소와 같다).
④ 저장하는 자리에서도 cleanStoredUrl: link-hunter.mjs 658행(url)·789행(got) · resolve-detail-urls.mjs 380행(found) · browser-collect.mjs 가 행 주소를 담는 자리.
🔴 바꾸지 말 것
- canonUrl 의 '군더더기만 버린다' 원칙
- idFromUrl 공식(세션이 꼬리 24자 안에 드는 주소만 영향. 지금 정식 등록·blockUrls 에 그런 주소는 0건이라 저장 id 변화 없음 — 수리자가 다시 잴 것)
- 목록 표식(#n-) 처리

관문: verify/health-gates/links.mjs (표본만)
① canonUrl·urlKey: 세션 둘('…View.do;jsessionid=AAA?key=7520&bbsNo=1073&nttNo=626377' · ';jsessionid=BBB')과 세션 없는 판이 모두 같다.
② noticeUrlRank(세션 판) > noticeUrlRank(세션 없는 판). preferNotice 가 세션 없는 판을 고른다(순서를 바꿔도 같다).
③ rowDetailCandidates({row:{abs:세션 판}, listUrl:'…selectBbsNttList.do?…'}) 의 결과에 ';jsessionid' 가 없다.
④ idFromUrl(경기대 표본) === 'auto-hkrwdsfpnos1073sfpnos888'(바뀌지 않음).
⑤ 글자 검사: link-hunter.mjs·resolve-detail-urls.mjs 의 `t.ref[...] = ` 저장 줄이 cleanStoredUrl 을 거친다.
빨간불 증명: canonUrl 의 경로 떼기를 되돌리면 ①이 실패한다. add() 의 씻기를 되돌리면 ③이 실패한다.

소급: 피드 공고 2건은 스스로 고쳐진다. 다음 수집이 경기대 글을 세션 없이(일반 수집은 extractLinks 가 이미 뗌) 또는 표식으로 다시 담으면, 같은 열쇠로 합쳐지면서 순위가 낮은 세션 판이 진다. 학교별 파일은 patchUrlsBySchool 이 순위가 낮아지지 않는 쪽으로만 고친다. 바로 고치고 싶으면 버리는 작업 사본에서 같은 함수로 한 번 돌린다: notices.items 의 url 을 cleanStoredUrl 로 바꾸고 JSON.stringify(x,null,1) 로 쓴 뒤 publish-notices.mjs 의 patchUrlsBySchool 을 부른다.
정식 등록 1건은 관리자 길로 고친다: ACTION=edit ACTOR=<이름> PAYLOAD='{"edits":[{"id":"auto-hkrwdsfpnos1073sfpnos888","patch":{"sourceUrl":"https://www.kyonggi.ac.kr/www/selectBbsNttView.do?key=7520&bbsNo=1073&nttNo=626271&pageUnit=10&searchCnd=WRTER&searchKrwd=%ec%9e%a5%ed%95%99&sf.pnos=1073&sf.pnos=888"}}]}' node tools/admin-apply.mjs. 마감 10-08 이라 11-07 이후에는 정리 대상이다. 고친 뒤 verify/audit-data.js 를 돌린다.

파일: collector/canon-url.mjs collector/url-key.mjs collector/detail-url.mjs collector/link-hunter.mjs collector/resolve-detail-urls.mjs collector/browser-collect.mjs data/registered.json data/admin-log.json verify/health-gates/links.mjs

위험: url-key.mjs·detail-url.mjs·link-hunter.mjs·resolve-detail-urls.mjs·browser-collect.mjs 는 다른 세션이 고친 파일이다(합쳐짐 a4fe9a01). urlKey 를 바꾸면 tools/merge-json-union.mjs 의 공고 합치기와 collect.mjs 의 seen 대조에도 영향이 간다. 세션 표식은 서로 다른 글을 합칠 수 없으므로 방향은 안전하다. 그래도 관문 전체(test-collector)를 반드시 돌린다. canon-url.mjs 는 links-new-1 과 같은 파일이니 같은 수리자가 고친다.

---
## [links-9] P3 · confirmed

이유: 최신 기본 브랜치 실측: collector/link-hunt.json 353,883바이트 · 항목 1404개.
- 지금 데이터(notices 'n:<url>' · registered 'r:<id>')에 없는 열쇠: 956개
- 꺼진 순찰의 흔적: ('lastWhy','patrolledAt')만 741개 + ('attempts','lastWhy','patrolledAt') 386개
- 이 장부를 지우는 코드는 없다(link-hunter.mjs saveAll 은 state 를 통째로 쓴다)
- 사냥꾼은 하루 약 5회 돌고(10-04: 23:59Z·02:11·02:44·08:56·09:44, run 37163506865·37170293698·37171951136·37190540917·37193107596) 매번 이 파일을 커밋한다
추가 피해: 관리자 화면 '죽은 링크'(_admin/admin.js:446-450 deadLinks)가 이 장부 전체를 읽는다. 30줄 중 18줄이 이미 데이터에 없는 공고다.

수리 명세: (최신 기본 브랜치를 합친 뒤) collector/link-hunt-rules.mjs 에 순수 함수 `pruneHuntState(items, liveKeys, today, graceDays = 30)` 를 더한다. 돌려주는 것은 새 items.
규칙
- 열쇠가 liveKeys(이번 실행의 사냥 대상 + 순찰 대상 열쇠 전부 · link-hunter.mjs 의 targets·patrol 에서 만든다)에 있으면 남긴다. 단 순찰 흔적 칸 patrolledAt 은 지운다(순찰이 꺼져 있을 때만 — HUNT_PATROL·patrol 설정이 0).
- 없으면 버린다. 예외: status==='resolved' 또는 escalated 이고 lastTried 가 today-graceDays 이후 → 남긴다(최근 기록 보존).
- 칸이 patrolledAt·lastWhy·attempts:0 뿐이고 데이터에 없으면 늘 버린다.
link-hunter.mjs saveAll 의 `fs.writeFileSync(statePath, …)` 바로 앞에서 `state.items = pruneHuntState(state.items, liveKeys, today)`. DRY 이면 쓰지 않는 것은 그대로다.
리포트에 '_(장부 정리: n건 걷어 냄)_' 한 줄.
🔴 바꾸지 말 것
- 살아 있는 표적의 attempts·nextTryAt·escalated·likelyGone
- tools/merge-json-union.mjs mergeLinkHunt(합집합이라 충돌 병합 때 지운 열쇠가 돌아올 수 있다. 다음 실행이 다시 걷어 내므로 스스로 고쳐진다 — 병합기를 지우기 쪽으로 바꾸지 말 것)

관문: verify/health-gates/links.mjs (표본 장부만)
① 살아 있는 열쇠 + nextTryAt → 남는다.
② 죽은 열쇠 + patrolledAt 만 → 사라진다.
③ 죽은 열쇠 + resolved + lastTried 10일 전 → 남는다.
④ 죽은 열쇠 + resolved + lastTried 40일 전 → 사라진다.
⑤ 죽은 열쇠 + escalated + 5일 전 → 남는다.
⑥ 살아 있는 열쇠의 patrolledAt 칸은 지워지고 다른 칸은 그대로다.
⑦ 글자 검사: link-hunter.mjs saveAll 본문에서 `pruneHuntState(` 가 `writeFileSync(statePath` 보다 앞에 있다.
빨간불 증명: pruneHuntState 가 입력을 그대로 돌려주게 하면 ②④가 실패한다. saveAll 호출을 지우면 ⑦이 실패한다.

소급: 손으로 고치지 않는다. 다음 사냥꾼 실행(수집 뒤 자동 · 하루 약 5회)이 같은 함수로 걷어 낸다. 장부는 로봇이 자주 커밋하는 파일이라 손으로 고치면 로봇 커밋과 부딪힌다. 첫 실행 리포트의 '장부 정리 n건'이 약 950 근처인지 확인한다.

파일: collector/link-hunt-rules.mjs collector/link-hunter.mjs verify/health-gates/links.mjs

위험: link-hunter.mjs·link-hunt-rules.mjs 는 다른 세션 파일이다(합쳐짐). liveKeys 를 targets 만으로 만들면 정식 등록의 진짜 주소 열쇠(r:<id>)가 모두 지워진다. 그 기록은 지금 순찰만 쓰므로 해는 없다. 그래도 patrol 목록을 함께 넣어 '데이터에 있는 것'을 기준으로 한다. links-2·links-14 와 같은 파일이다.

---
## [links-10] P3 · needs-human
**결정(추천안 (가)): 원문 링크 복구 로봇의 소급 재검사만 끈다(고치는 일은 그대로).**

이유: 최신 기본 브랜치에서도 그대로다.
- 대기줄이 다르다: resolve-detail-urls.yml 은 group resolve-detail-urls(37-38행), link-hunter.yml 은 group link-hunter(57-58행). 둘 다 data/registered.json 을 쓴다.
- 복구 로봇의 소급 재검사(resolve-detail-urls.mjs:426-458)는 판정을 리포트와 collector/resolved-urls.json 의 recheck 에만 쓴다. 이 파일을 읽는 코드는 하나도 없다(grep: resolve-detail-urls.mjs 와 그 워크플로의 git add 뿐).
- 판정이 원문 링크 확인 로봇과 엇갈린다: 고려 subview.do?enc= 가 link-check-state 에서는 'post'(9건), 서울과기대 bnum=57138 nowpage=3 는 'list'.
10-03 17:35~17:58 의 동시 실행은 수동 실행(37141332557 workflow_dispatch)이 사냥꾼 push 실행과 겹친 것이다. 예약끼리 겹친 증거는 없다.
두 로봇을 같은 대기줄에 세우는 안(나)은 CLAUDE.md '대기줄(concurrency)을 하나로 합치지 말 것(대기 실행이 취소된다)'과 충돌한다. 사냥꾼은 수집 뒤마다 깨어나므로, 주 1회 복구 예약이 대기 중에 취소될 수 있다.

수리 명세: (가)를 고르면: collector/resolve-detail-urls.mjs 426-458행 소급 재검사 블록을 지우고 recheckLog·rechecked 를 정리한다. resolved-urls.json 에는 map 만 쓰고, 끝줄의 '소급 재검사 n건'을 뺀다. run-resolve-urls.txt 의 recheckOnly 설명과 producers 관문 196행(⑥ recheckOnly 표본)이 이 이름을 쓰는지 확인하고 같이 고친다.
🔴 고치는 갈래(fixed · patchUrlsBySchool)는 손대지 않는다.

관문: (가)를 고르면 verify/health-gates/links.mjs 에 글자 검사를 둔다: resolve-detail-urls.mjs 에 `verifyCandidate(url, titles, 0, live` 꼴의 재검사 루프와 `recheckLog[` 가 없다. 빨간불 증명은 블록을 되살리는 것.

소급: (없음)

파일: 

위험: resolve-detail-urls.mjs 는 다른 세션 파일이다(합쳐짐). links-15 의 워치독과 같은 파일이라 한 수리자가 고친다.

---
## [links-13] P3 · needs-human
**결정: 기다린다 — 코드 변경 없음.**

이유: 실제로 아직 증명되지 않았다.
- link-check-state.json: 국민대 12349·12385·12387 이 v 'other' · n 1 · firstAt 2026-10-04 · confirmed false.
- 10-04 저녁 정기 실행(f33987da 10:03Z '문제 확정 0건')과 후보 실행(4ba7da49)이 다시 열지 않았다. link-check-plan.mjs planQueue 의 `.filter((r) => r.s.lastAt !== today)`(257행)가 같은 한국 날짜에 다시 여는 것을 막는다. 'only:'를 줘도 이 거름망은 그대로라, 오늘 앞당겨 돌려도 국민대는 다시 열리지 않는다.
- 다음 확인은 10-05 09:47Z(18:47 KST)다. 이 3건은 tier 2 라 맨 앞에 선다.
- 오판 수리 fc44f85c(국민대: 행 꼬리 떼기 longRunIn)·b71da694 는 이미 우리 HEAD 에 있다.
- 서울과기대 bnum=57138 nowpage=3 판은 'list' n1 로 남아 있다. 정식 등록 auto-5bnum57138cate0qidx57138 이 이 판이다. 이 글은 links-new-1 의 id 충돌 표본이기도 하다.
코드로 할 일은 없다. 시간이 지나야 확인된다.

수리 명세: (없음)

관문: (없음)

소급: (없음)

파일: 

위험: 10-05 실행에서 확정되면 학생 화면 글자가 '(확인 필요)'로 바뀐다. 링크는 그대로 열리므로 해는 작다. 확정되면 정찰(run-probe.txt checkUrl:)로 진짜 화면을 본 뒤 판단한다.

---
## [links-14] P3 · confirmed

이유: 최신 기본 브랜치의 collector/link-hunt-rules.mjs recordAttempt 는 `if (outcome === 'net') return s;` 라 nextTryAt 을 정하지 않는다. 사냥꾼 skipped 판정(link-hunter.mjs:335)은 nextTryAt 만 보므로, 학교 서버가 시간 초과·5xx 를 내는 표적은 매 실행 다시 열린다.
더 큰 구멍: 게시판 목록 자체가 안 열리면(link-hunter.mjs:545-549, 3회 재시도 ≈129초) 그 게시판의 대상에 아무 기록도 남기지 않고 continue 한다. 그 게시판 전체가 매 실행 다시 두드려진다.
사냥꾼은 하루 약 5회 돈다(10-04: 23:59Z·02:11·02:44·08:56·09:44). link-hunter.yml 주석(44-47행)도 '같은 표적을 같은 학교에 하루 다섯 번 두드리게 된다'를 막으려 했다고 적는다. CLAUDE.md '같은 학교를 하루에 여러 번 두드리지 말 것'과 어긋난다.
지금 장부에서 이 상태로 남은 것은 동국대 1건(lastTried 09-04 · Timeout)뿐이다. 피해는 간헐적이지만 길은 열려 있다.
주의: 다른 세션이 '시간 상한으로 못 본 것'도 'net' 으로 적게 바꿨다(684행). 이건 우리 예산 탓이라 다음 실행에 바로 다시 봐야 한다 → 두 경우를 갈라야 한다.

수리 명세: (최신 기본 브랜치를 합친 뒤)
① collector/link-hunt-rules.mjs recordAttempt: 'net' 일 때 attempts 는 그대로 두되, opts.defer !== false 이면 `s.nextTryAt = 내일(KST, opts.nowMs 기준)` 을 정한다. 이미 더 늦은 nextTryAt 이 있으면 줄이지 않는다.
② link-hunter.mjs
- 684행(시간 상한)은 `record(t, 'net', '시간 상한 — 목록을 다 못 봄', undefined, { defer: false })` 처럼 미루지 않는다. record 시그니처에 opts 를 더해 recordAttempt 로 넘긴다.
- 670행(unreachable)은 기본(defer)이다.
- 549행 게시판 열기 실패: `for (const t of group) record(t, 'net', '게시판 열기 실패: …')` 를 더해 그 게시판 대상 전부를 내일로 미루고, 리포트에 한 줄.
🔴 바꾸지 말 것
- 'net 은 횟수에 안 센다'(관문 producers 300행이 attempts 를 본다)
- BACKOFF_DAYS
- 'ok' 경로

관문: verify/health-gates/links.mjs
① recordAttempt({attempts:2}, 'net', 'Timeout', {today:'2026-10-04', nowMs: Date.parse('2026-10-04T03:00:00Z')}) → attempts 2 · nextTryAt '2026-10-05'.
② 같은 호출에 {defer:false} → nextTryAt 이 넘겨준 값 그대로(없으면 undefined).
③ 이미 nextTryAt '2026-10-10' 이면 그대로 둔다.
④ 글자 검사: link-hunter.mjs 의 '게시판 열기 실패' 분기(`if (!opened)` 줄 앞뒤 300자)에 `record(` 가 있다. 시간 상한 줄에 `defer: false` 가 있다.
빨간불 증명: recordAttempt 의 net 갈래를 `return s` 로 되돌리면 ①이 실패한다. 게시판 실패 기록을 지우면 ④가 실패한다.

소급: 없다. 다음 실행부터 적용된다.

파일: collector/link-hunt-rules.mjs collector/link-hunter.mjs verify/health-gates/links.mjs

위험: link-hunt-rules.mjs·link-hunter.mjs 는 다른 세션 파일이다(합쳐짐). 서버가 잠깐 느렸던 새 표식은 하루 늦게 풀린다. 이는 '하루 여러 번 두드리지 않기'의 의도된 대가다. links-2·links-9 와 같은 파일이다.

---
## [links-15] P3 · confirmed

이유: 최신 기본 브랜치에서도 그대로다.
① 워치독: collector/resolve-detail-urls.mjs 에는 outOfTime()(63행)을 게시판·재검사 루프 머리(322·426·438행)에서만 본다. 바깥 시계(setTimeout→saveAll)가 없다. 넘어짐 훅(onCrash 46-56행)은 밖에서 강제 종료하면 못 막는다. 사냥꾼(link-hunter.mjs:156-161 watchdog)과 link-check(156행)에는 있다. 시한 없는 browser.close()(489행) 같은 자리에서 매달리면 40분 시한 취소로 그때까지 고친 것을 잃는다(실제로 난 적은 없다).
② 예약 주석: resolve-detail-urls.yml:31 `'13 20 * * 1' # 매주 월요일 05:13 KST` — UTC 월 20:13 은 KST 화 05:13 이다. 실제 예약 실행 시각 09-07 22:48Z · 09-14 23:06Z · 09-21 23:15Z · 09-29 00:20Z 가 모두 KST 화요일이다.
같은 실수가 두 곳 더 있다(버리는 작업 사본에서 전 워크플로 대조): audit-coverage.yml:7 `'23 21 * * 1' # 매주 월요일 06:23 KST`(실제 화) · kosaf-fetch.yml:20 `'53 20 * * 1,4' # 월·목 05:53 KST`(실제 화·금). 관리자 화면 표시도 같이 틀렸다(_admin/admin.js:2548 '월·목 05:53' · 2555 '매주 월 06:23'). 시각(HH:MM)은 전부 맞다.

수리 명세: ① collector/resolve-detail-urls.mjs: link-hunter.mjs 와 같은 꼴의 바깥 시계를 넣는다. 위치는 BUDGET_MS·startedAt 정의(61-63행) 바로 뒤.
```
const watchdog = setTimeout(() => { if (crashed) return; crashed = true; try { report.push('⏰ 예산을 넘겨 스스로 멈췄습니다 …'); saveAll(null); } catch (e) { console.error(e); } process.exit(0); }, BUDGET_MS + Number(process.env.RESOLVE_WATCHDOG_GRACE_MS || 90000));
watchdog.unref();
```
- saveAll 이 아래에 선언된 function 이라 호이스팅된다. report·fixed 는 let/const 라 시계가 울리는 시점(25분 뒤)에는 이미 초기화돼 있다.
- crashed 는 onCrash 와 공유한다(두 번 저장 금지).
② 주석 고치기(워크플로 파일 편집은 실행을 깨우지 않는다)
- resolve-detail-urls.yml:31 → '매주 화요일 05:13 KST (월 20:13 UTC)'
- audit-coverage.yml:7 → '매주 화요일 06:23 KST'
- kosaf-fetch.yml:20 → '화·금 05:53 KST'
- _admin/admin.js 2548 '화·금 05:53' · 2555 '매주 화 06:23'
🔴 collector/run-audit-coverage.txt 4행의 '월요일'은 고치지 말 것. push-to-run 파일이라 고쳐 push 하면 감사 로봇이 돈다. 그 파일을 고칠 일이 생길 때 같이 고친다.

관문: verify/health-gates/links.mjs
① 글자 검사: resolve-detail-urls.mjs 에 /setTimeout\(\(\) => \{[\s\S]{0,600}?saveAll\(/ 와 /watchdog\.unref\(\)/ 가 있다(test-collector 4236행의 사냥꾼 검사와 같은 꼴).
② 순수 함수 cronCommentProblems(line) 표본 검사: "cron: '13 20 * * 1'   # 매주 월요일 05:13 KST" → 문제 1개 · '화요일' → 0개 · "'53 20 * * 1,4' # 월·목 05:53 KST" → 문제 · "'37 20 * * 1' # 매주 월 20:37 UTC = 화 05:37 KST" → 0개(= 뒤만 본다). 요일은 'X요일' 또는 'X·Y' 꼴만 읽는다('수집'의 '수'를 요일로 읽지 말 것).
③ 그 함수를 .github/workflows/*.yml 의 cron 줄 전부에 적용해 문제 0개. 워크플로는 코드라 실데이터 금지 규칙에 해당하지 않는다.
빨간불 증명: 주석 하나를 '월요일'로 되돌리면 ③이 실패한다. 워치독 블록을 지우면 ①이 실패한다.

소급: 없다.

파일: collector/resolve-detail-urls.mjs .github/workflows/resolve-detail-urls.yml .github/workflows/audit-coverage.yml .github/workflows/kosaf-fetch.yml _admin/admin.js verify/health-gates/links.mjs

위험: resolve-detail-urls.mjs·_admin/admin.js 는 다른 세션 파일이다(합쳐짐). 관리자 화면을 고치면 Cloudflare 빌드가 돌고 verify-admin.js 드라이버가 'when' 글자를 잠그는지 확인해야 한다. 잠그면 드라이버도 같이 옮긴다(CLAUDE.md 화면 규칙). 관리자 표시 수정은 선택이다. 빼면 _admin/admin.js 는 filesTouched 에서 뺀다.

---
## 손대지 않는 것 (이미 고쳐짐·오진·다른 세션·사람 결정 대기)
- [links-6] other-session: 다른 세션 커밋 1a33db59 가 고쳤고, a4fe9a01 에서 기본 브랜치에 합쳐졌다.
- collector/detail-url.mjs 에 ruleDetailCandidates 가 생겼다. 교내 소식 규칙 표(news-board-rules.mjs NEWS_BOARD_RULES · ruleResolver)를 베끼지 않고 불러 쓴다.
- rowDetailCandidates 가 확인된 규칙 후보를 조립 후보보다 앞에 넣는다.
- 사냥꾼(link-hunter.mjs:635)·복구(resolve-detail-urls.mjs:332)·브라
- [links-8] other-session: 증상(학생이 누르면 게시판 목록이 열리고 사냥꾼이 영영 헤맨다)은 다른 세션 커밋 3ae5a6a8 로 해소됐다. 이 커밋은 기본 브랜치에 합쳐졌다.
- data/link-fixes.json 에 'id:reg-khu-uiam'(boardId=322415)·'id:reg-hi-jeongeup'(322469)·'id:reg-khu-intern'(322541)이 '원문 바로잡기'로 올라갔다.
- 최신 기본 브랜치에서 what-shows.mjs reg-khu-uiam 의 원문 링크 줄이 'page (그 공고 하나로 가는 주소)'다.
- 사냥
- [links-11] already-fixed: collector/run-resolve-urls.txt 에 onlyBoard 줄이 없다(10행 기록 '2026-10-03 — onlyBoard: cau.ac.kr 를 지웠다'). 관문 「원문 링크 정직성」 producers 의 pinProblems ⑤⑥(verify/link-gates/producers.mjs:196)이 '표식이 0건인 학교에 묶인 onlyBoard'를 실패로 잡는다.
수리 뒤 수동 실행 37141332557 은 success(17:39-17:58Z · 고칠 대상 26 · 게시판 11 · 복구 8)였다. 옛 예약 실
- [links-12] already-fixed: 최신 기본 브랜치의 data/registered.json 에서 표식(#n-) 정식 등록은 경희 3건뿐이고, 셋 다 관리자 원문 바로잡기로 덮였다(links-8). 순찰이 덮었던 항공대·건국·부경·고려 주소는 진짜 주소나 enc 주소로 남아 있다.
- run-link-hunt.txt 'patrol: 0'
- 관문 producers 69행이 '순찰을 켜도 판정만 장부(st.patrol)에 남긴다'를 지킨다
- 복구 재검사는 recheckLog 만 쓴다(resolve-detail-urls.mjs:448)

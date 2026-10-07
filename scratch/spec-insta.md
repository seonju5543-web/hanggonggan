# 수리 명세 — 묶음 insta

권장 순서: insta/insta-1 → insta/insta-7 → insta/insta-4 → insta/insta-2 → insta/insta-8 → insta/insta-9 → insta/insta-5
예상 손댈 파일: insta/render.mjs insta/publish.mjs insta/ledger.mjs insta/pick.mjs insta/comments.mjs insta/SCRIPT.md insta/school.mjs insta/caption.mjs insta/photos.json _admin/admin.js .github/workflows/insta.yml .github/workflows/device-deploy.yml .claude/skills/insta-revise/SKILL.md tools/merge-json-union.mjs .gitattributes verify/health-gates/insta.mjs verify/health-gates.mjs

검증 메모: 검증은 HEAD 46f08990 과 최신 기본 브랜치(origin/claude/nice-heisenberg-WESq5)에서 했다. 다른 세션의 source-link-integrity 는 이미 기본 브랜치에 병합되어 있다(merge-base = 그 끝 5a244ac0). 그 세션이 고친 파일 중 이 묶음과 겹치는 것은 _admin/admin.js(+472줄 · 인스타 구역 2180~2432행 밖)와 .gitattributes(4줄)뿐이다. 이 묶음의 문제를 고친 것은 없다 → other-session 판정 없음. 수리는 최신 기본 브랜치를 먼저 병합한 위에서 한다.

증거로 실측한 것: (1) 표본 폴더(마감 2020)로 publish.mjs --publish 를 돌리면 'IG_USER_ID · IG_ACCESS_TOKEN 이 없습니다' 까지 그대로 간다(마감 검사 없음). (2) 판형 2·3·4 가 표본에 '마감 D-21' 을 그린다(1번 사진 판형은 상대 날짜 없음). (3) admin instaPostRow 가 마감 지난 줄에 '마감 지남' 과 게시 버튼을 함께 낸다. (4) tools/merge-json-union.mjs 의 일반 seen.json 규칙(231행)이 insta/seen.json 표본 병합에서 올림 기록과 준비 줄을 지웠다 — 지금은 .gitattributes 에 없어 안 불리지만, 누가 더하는 순간 이중 게시 함정이 된다. (5) insta.yml 실행 114회 중 취소 0건 · 실패 3건(게시 작업 · 그중 #263 이 main push 거절). (6) 열린 insta-ready 이슈 34건.

심각도 조정: insta-4 를 P2 에서 P3 으로 내렸다(취소 0건 · 피해는 '조용한 헛누름'). 대신 진단이 놓친 흔한 경로(사람의 연달아 누르기)와 병합 규칙 함정을 더했다. insta-2 에는 더 위험한 하위 경우를 더했다: 게시 성공 뒤 기록 저장이 실패하면 '게시 실패' 이슈를 보고 사람이 다시 눌러 같은 글이 두 번 올라갈 수 있다.

관문은 전부 새 파일 verify/health-gates/insta.mjs 에 두고 verify/health-gates.mjs 의 PARTS 에 'insta' 를 더한다. 표본만 쓰고 실데이터는 읽지 않는다. insta/render.mjs·pick.mjs·publish.mjs·comments.mjs 는 명령줄 실행이 막혀 있어(argv 검사) import 해도 안전하다. publish.mjs 는 시크릿 없는 env 로 child 실행하면 네트워크·token-seen.json 쓰기 전에 멈춘다(publish() 138행). 주의: verify-insta C9 이 publish.mjs 에서 /\.png/ 를 막고, 게시 작업을 '  publish:' 들여쓰기로 자르며, C1 이 `const dday = (due, today) => {…\n};` 모양을 정규식으로 뗀다 — 이 세 모양은 유지한다.

insta-5 는 개발자 결정이 필요하다(질문에 추천 ① 포함). filesTouched 의 insta/school.mjs·caption.mjs·photos.json 은 그 결정이 ① 또는 ② 일 때만 고친다. 거짓 경보 #263 은 수리를 병합한 뒤 근거(게시 permalink)를 달아 닫는다. 이 검증에서는 저장소·이슈를 건드리지 않았고, 임시 파일은 scratchpad/verify-insta/ 에만 있다(worktree 안 만듦).


---
## [insta/insta-1] P1 · confirmed

이유: 지금 코드와 데이터에서 그대로 재현된다. ① 장부(insta/seen.json)의 준비됨 167건 중 88건은 마감이 지났다(due < 2026-10-04). 그런데 관리자 화면 instaPostRow(_admin/admin.js 2242~2249행)는 kind==='prepared' 이기만 하면 게시 버튼을 그린다. what-shows 처럼 함수를 떼어 실행해 보니, 마감이 9-19 인 줄이 '마감 지남' 표시와 data-ig-publish 버튼을 함께 낸다(true/true). ② publish.mjs 는 명령줄 처리(183~228행)와 publish() 어디에서도 마감을 보지 않는다. 마감 2020-01-01 표본 폴더로 `node insta/publish.mjs --dir=<표본> --publish` 를 돌리면 시크릿 검사('IG_USER_ID · IG_ACCESS_TOKEN 이 없습니다')까지 그대로 간다. 시크릿이 있었다면 올라갔다. insta.yml 게시 작업(315~345행)도 폴더 유무와 이미 올렸는지만 본다. ③ 그림 속 상대 날짜: render.mjs 125~126행 ddayText 가 '마감 D-N' 을 만든다. 표본 공고(마감 10-23, 그린 날 10-02)를 판형 넷으로 그려 보니 2(chat)·3(note)·4(poster)번에 '마감 D-21' 이 박혔다. 실물 insta/pub/0776003/1.jpg 에서도 '건설근로자공제회 · 마감 D-21' 을 눈으로 확인했다. 열린 준비 카드 79건 중 54건이 2·3·4번 판형이다(마감 10/07~12/31). 이 프로젝트는 상대 날짜를 이미 금지해 두었다 — render.mjs 178~180행 주석('상대 날짜를 쓰지 말 것 — 사진은 굳는다'), insta/DESIGN.md 69~70행, insta-template 스킬의 반려 목록. 표지 후킹만 지키고 ddText 는 어긴 셈이다. 그래서 게시가 늦어지지 않아도 피드에 남은 게시물은 다음 날부터 거짓이 된다. ④ 캡션: 마감 판정은 그릴 때 한 번뿐이다(caption.mjs 80행). insta/pub/2704055001/caption.txt(마감 9-19)에는 '#장학금마감임박' 이 그대로 있다. 다른 세션(source-link-integrity, 지금은 기본 브랜치에 병합됨)은 admin.js 의 인스타 부분을 건드리지 않았고, 9-13 이후 인스타 게시는 0건이다(실제 사고는 아직 없음).

수리 명세: ① 상대 날짜 없애기(근본) — insta/render.mjs: dday() 가 열린 상태일 때 `{ state:'open', d, due }` 처럼 due 를 함께 돌려준다. ddayText 는 절대 날짜로 바꾼다: open → `${Number(mm)}월 ${Number(dd)}일 마감`. d===0 도 같은 꼴로 쓰고 '오늘 마감' 은 쓰지 않는다. past → '마감 지남', unknown → '기간 앱에서 확인'. 🔴 `const dday = (due, today) => {` 머리줄과 `\n};` 끝 모양은 그대로 둔다(verify-insta C1 이 정규식으로 떼어 eval 한다). --pub 이 쓰는 meta.json 객체(867행)에 `dates: 'absolute'` 를 더한다. insta/SCRIPT.md 50행 표의 '`마감 D-N` · `오늘 마감`' 을 '`M월 D일 마감`' 으로 고친다. 판형 파일은 ddText 를 받아 쓰기만 하므로 손댈 필요가 없다.
② 게시 거절 — insta/publish.mjs 에 순수 함수 `export function publishRefusal(meta, now = Date.now())` 를 둔다: (a) meta.due 가 있고 `Date.parse(due+'T23:59:59+09:00') < now` 이면 '마감이 지난 카드(마감 …)입니다 — 올리지 않습니다. 관리자 화면에서 건너뛰기를 누르세요'. (b) `meta.dates !== 'absolute'` 이고 `[2,3,4].includes(meta.tplNo)` 이면 '그린 날(meta.at) 기준 「마감 D-N」 이 그림에 박힌 옛 카드입니다 — 「이 판형으로 다시 그리기」 로 다시 그려 확인한 뒤 게시하세요'. 둘 다 아니면 null. [2,3,4] 는 옛 폴더 전용 규칙이다. 판형 번호는 바뀌지 않는다(templates.json _readme). 주석에 '2026-10-04 이전에 그린 폴더 · 마지막 마감 2026-12-31' 을 적는다. 명령줄 처리에서는 --urls·--wait-only 갈래 **뒤**, publish() 부르기 **전**에 meta.json 을 읽어 검사한다. 거절이면 `console.error('\n🚨 '+이유); process.exit(1)` 하고, 예행연습에도 똑같이 적용한다. due 가 없는 카드(손으로 그린 '원문 확인')는 막지 않는다. 🔴 publish.mjs 에 '.png' 글자를 쓰지 말 것(verify-insta C9 이 /\.png/ 로 막는다).
③ 관리자 화면 — insta/ledger.mjs 의 prepared 명령이 `dates: m.dates || null` 도 장부 줄에 옮기게 한다. _admin/admin.js instaPostRow: kind==='prepared' 이고 [instaDday(p.due).cls==='past' 이거나 (p.dates!=='absolute' && [2,3,4].includes(p.tplNo))] 이면 data-ig-publish 버튼 자리에 짧은 안내('마감 지남 — 게시 안 함' / '옛 카드(D-N) — 다시 그린 뒤 게시')를 둔다. 카드 보기·판형 고르기·다시 그리기·건너뛰기 버튼은 남긴다. handleInstaClick 의 data-ig-publish 처리도 같은 조건이면 askSheet 를 열지 않고 jobShow(…, 'bad') 로 거절한다.
④ insta.yml 게시 작업의 '실패하면 시끄럽게' 원인 목록에 '마감 지남·옛 D-N 카드 → 게시 거절(로그의 첫 🚨 줄)' 을 더한다.
바꾸지 말 것: '게시는 다시 그리지 않는다'(insta.yml 15행) · --publish 없이는 예행연습 · 게시 조건은 긍정형 startsWith(관문 C9) · 1번 사진 판형(상대 날짜 없음) 카드는 막지 않는다 · 표지 후킹 'dday' 갈래(이미 절대 날짜).

관문: verify/health-gates/insta.mjs 를 새로 만들고 verify/health-gates.mjs 의 PARTS 에 'insta' 를 더한다. 실데이터는 읽지 않는다.
(1-a) 표본 공고 {code:'fx', org:'테스트재단', name:'테스트장학', due:'2026-10-23', fields:{지원금액:'○ 100만원', 특정자격:'○ 대학 재학생', 자격제한:'○ 휴학생 제외'}} 와 today=2026-10-02T10:00+09:00 으로 `loadTemplates()` 의 판형 전부를 `t.cards(context(s0,today,SKINS.blue,12345,null), KIT).join('')` 로 그린다. HTML 에 /마감 D-\d|D-\d+|오늘 마감/ 이 0건이고, 2·3·4번에는 '10월 23일 마감' 이 있어야 한다. due=today(10-02) 표본도 '10월 2일 마감'.
(1-b) publishRefusal 표: 마감 지남→거절 · 미래+absolute→null · 미래+dates 없음+tplNo 2→거절 · tplNo 1→null · due 없음→null · 오늘 마감 23:59 전→null.
(1-c) 진짜 길: os.tmpdir 에 표본 폴더(meta.json due 2020-01-01, 빈 1.jpg·2.jpg, caption.txt)를 만들고, IG_USER_ID·IG_ACCESS_TOKEN 을 뺀 env 로 `node insta/publish.mjs --dir=<절대경로> --publish` 를 실행한다. 기대: 종료 1 · stderr 에 '마감' 있음 · 'IG_USER_ID' 없음. 대조군(due 2099-12-31, dates absolute)은 stderr 에 'IG_USER_ID · IG_ACCESS_TOKEN 이 없습니다' 가 나와야 한다(가드가 멀쩡한 카드는 통과시키고, 네트워크·장부 쓰기 전에 멈춘다는 증거).
(1-d) what-shows 의 takeFn 꼴로 _admin/admin.js 에서 instaTplName·instaDday·instaPostRow 를 떼어, stub(D={insta:{templates:[],stats:{posts:[]}}}, esc, raw, safeUrl)과 함께 vm 에 싣는다. 마감 지난 행과 옛 2번 판형 행에는 data-ig-publish 가 없고, 미래+absolute 행에는 있어야 한다.
red 증명: ddayText 를 되돌리면 (1-a) 가 빨강(현재 실측 2·3·4번 '마감 D-21'). 가드 줄을 지우면 (1-b)(1-c) 가 빨강(현재 실측: 2020 표본이 'IG_USER_ID…없습니다' 까지 감). admin 조건을 지우면 (1-d) 가 빨강(현재 실측 true).

소급: 데이터를 손으로 고치지 않는다. 마감 지난 88건은 insta-7 의 expire 가 다음 준비 실행에 '만료'로 바꾸고 폴더를 지운다. insta-7 을 안 하더라도 관리자 화면과 게시 거절이 막는다. 열린 옛 D-N 카드 54건(2·3·4번 판형)은 게시를 누르면 거절되고, 사람이 「이 판형으로 다시 그리기」 로 되살린다. 다시 그리면 새 준비 이슈가 오므로 개발자가 다시 본다 — 이것이 '본 그대로 올린다' 원칙에 맞는 소급이다. 고친 판형 2·3·4 의 before/after 미리보기(insta/preview.mjs)는 보고 때 개발자에게 보여 준다.

파일: insta/render.mjs insta/publish.mjs insta/ledger.mjs insta/SCRIPT.md _admin/admin.js .github/workflows/insta.yml verify/health-gates/insta.mjs verify/health-gates.mjs

위험: 카드 글자가 바뀐다('마감 D-21' → '10월 23일 마감'). 판형 2·3·4 의 모양 결정이라 보고 때 미리보기를 보여 준다(규칙은 이미 DESIGN.md 에 있다). 2번 판형 잠금화면 시계 밑 글자가 2자 길어진다 — CI 렌더의 넘침 검사(overflowing)가 잡지만, 가능하면 `node insta/sweep-overflow.mjs --tpl=2` 로 확인한다(샌드박스는 INSTA_DEV_FONT_RELAY). _admin/admin.js 는 기본 브랜치에 다른 세션의 +472줄이 있다(인스타 구역 밖 · verify-admin.js 의 인스타 표본은 tplNo 1·마감 +5일이라 영향 없음). 수리는 최신 기본 브랜치를 먼저 병합한 위에서 한다. [2,3,4] 옛 판형 규칙이 publish.mjs·admin.js 두 곳에 있다 — 옛 폴더 전용이라 일부러 둔 것이고, 주석으로 짝을 밝힌다.

---
## [insta/insta-2] P2 · confirmed

이유: run 34709674360 의 게시 작업 로그로 확인했다. '✅ 게시 완료 18624158749041013 — https://www.instagram.com/p/DdMkqOelTfI/' → 기본 브랜치 push 성공 'f1bd524..4026014' → `git push origin HEAD:main` 에서 '! [rejected] HEAD -> main (fetch first)' → exit 1 → '실패하면 시끄럽게' 단계가 #263 을 만들었다. #263 은 지금도 열려 있다(insta-fail · 댓글 0 · 2026-09-12T17:56Z). insta.yml 373행(게시)·174행(준비)은 둘 다 재시도 없는 main push 다. 바로 위 기본 브랜치 push 만 3회 재시도한다. 준비 작업의 '그림이 공개될 때까지'(178행)·'개발자 셋에게 알린다'(186행)에는 always() 가 없다. 그래서 커밋 단계가 main push 에서 죽으면, 장부는 이미 '준비됨'으로 기본 브랜치에 올라갔는데 알림 이슈는 안 만들어진다(다음 실행의 pick --new 도 그 공고를 다시 안 뽑는다). 지금까지 게시 3번 중 1번이 이렇게 죽었고, 준비 쪽은 아직 0번이다(최근 114회 실행 전부 성공). 반박 시도로 더 위험한 갈래를 찾았다: 게시가 성공한 뒤 기본 브랜치 push 가 3회 모두 실패하면 seen.json 에 '올림' 기록이 안 남는다. 그런데 이슈 제목은 '게시가 실패했습니다' 다. 사람이 「게시」 를 다시 누르면 '이미 올린 공고' 검사(seen.json)가 못 막아 **같은 글이 두 번 올라간다.** 앱·Pages 는 insta/seen.json 을 읽지 않는다(app.js·sw.js 에 없음 · 관리자는 기본 브랜치 raw 를 읽는다). 그러니 게시 작업의 main push 는 필요가 없다.

수리 명세: insta.yml 만 고친다.
① 게시 작업 '올린 기록 저장': 마지막 줄 `git push origin HEAD:main` 을 지운다(seen.json 은 Pages 가 필요 없다 · deploy-sync 가 옮긴다). 저장 루프 앞에 `bash tools/setup-collab.sh` 를 둔다(insta-4 의 병합 규칙).
② '인스타에 올리기' 단계에 `id: post` 를 단다. publish.mjs 는 게시에 성공하면 환경변수 GITHUB_OUTPUT 이 있을 때 `media=<id>`·`permalink=<주소>` 를 거기 덧붙인다. '실패하면 시끄럽게' 는 `steps.post.outcome == 'success'` 이면 다른 이슈를 만든다: 제목 '⚠️ 인스타에는 올라갔는데 기록 저장만 실패했습니다 — 다시 게시하지 마세요 (<code>)', 본문에 permalink 와 '장부에 손으로 올림 기록을 넣는 법(같은 code 로 seen.json posted 한 줄)' 을 적는다. 아니면 지금 문구를 쓴다.
③ 준비 작업 커밋 단계: 기본 브랜치 루프 앞에 `bash tools/setup-collab.sh`. main push 를 3회 재시도 루프로 감싼다: `for i in 1 2 3; do git push origin HEAD:main && break; git fetch origin main && git merge --no-edit -m '인스타: 카드 준비분 main 반영 (자동)' origin/main || { git merge --abort || true; echo '🚨 main 과 합치다 충돌'; exit 1; }; [ "$i" = 3 ] && { echo '🚨 main 에 못 올렸습니다'; exit 1; }; sleep 5; done`. 기존 루프와 같은 꼴로, 'sleep 이 0 을 남기던' 함정을 피한다. main 에 합쳐 올리는 것은 지금의 fast-forward push 와 같은 효과(기본 브랜치 전체가 main 으로)이고 deploy-sync 의 병합과 같은 결과다.
④ 준비 작업 '실패하면 시끄럽게' 본문에 `steps.draw.outputs.ok` 코드 목록과 '이 카드들은 장부에 준비됨으로 적혀 관리자 화면에 있습니다 — 알림만 못 갔습니다. Actions 「인스타 카드뉴스 게시」 → 알림 + code 로 다시 보낼 수 있습니다' 를 넣는다.
바꾸지 말 것: 준비 작업의 main push 자체(Pages 가 그림을 내줘야 이슈 그림이 캐시되지 않는다 · 177행 주석) · 기본 브랜치 3회 루프 · 게시 조건 긍정형.

관문: health-gates/insta.mjs 에서 워크플로 글자를 읽어 본다(insta.yml 은 데이터가 아니라 코드다). (2-a) '  publish:' 부터 '  skip:' 까지 잘라 낸 게시 작업에 /push origin HEAD:main/ 이 없다. (2-b) insta.yml 의 각 단계(`- name:` 단위)에서 'HEAD:main' 이 나오면, 그 단계 안에서 `for i in 1 2 3` … HEAD:main … `done` 꼴로 반복문 안에 있어야 한다. (2-c) 게시 작업의 실패 단계가 `steps.post.outcome` 을 본다. (2-d) publish.mjs 가 GITHUB_OUTPUT 에 permalink 를 쓴다: 가짜 Graph 서버로 publish() 한 바퀴(verify-insta C9 의 가짜 인스타 꼴)를 돌린 뒤 임시 GITHUB_OUTPUT 파일 내용을 확인한다. red: 지금 insta.yml 로 (2-a)(2-b)(2-c) 가 모두 빨강이다(373행·174행).

소급: 코드로 고칠 데이터는 없다. 거짓 경보 #263 은 수리를 병합한 뒤 '게시는 성공(https://www.instagram.com/p/DdMkqOelTfI/) · main push 거절만 실패 — 수리 커밋 <sha>' 댓글과 함께 닫는다(사람 또는 수리 세션).

파일: .github/workflows/insta.yml insta/publish.mjs verify/health-gates/insta.mjs

위험: insta.yml 은 insta-1·4·7 도 고친다 — 한 사람이 차례로 고친다. main 에 합치기가 충돌하는 드문 경우는 빨간불 + 이슈로 끝난다(지금보다 낫다). verify-insta C9 은 게시 작업을 `wf.indexOf('  publish:')` 로 자르므로, 작업 머리글 들여쓰기를 바꾸지 말 것.

---
## [insta/insta-4] P3 · confirmed

이유: 구조는 확인됐다. insta.yml 59~61행의 워크플로 단위 `concurrency: insta-publish / cancel-in-progress: false` 가 준비(수집 로봇 셋의 workflow_run · 매일 예약 · 사람 버튼)와 게시·건너뛰기를 한 대기줄에 묶는다. GitHub 규칙상 한 그룹에는 '도는 것 1 + 기다리는 것 1' 만 있고, 새로 기다리는 것이 오면 먼저 기다리던 것을 취소한다. 취소된 실행은 단계가 하나도 안 돌아 실패 알림도 없다. 관리자 화면 instaDispatch(admin.js 2420~2432행)는 '로봇이 돌기 시작했습니다' 라고만 하고 결과를 보지 않는다. 다만 지금까지 insta.yml 실행 114회를 훑었을 때 취소는 0건이다. 그래서 심각도를 P2 에서 P3 으로 내린다. 수집 뒤 자동 준비는 대개 45초 만에 끝나서(run 37190540923) 진단이 든 시나리오(자동 실행 사이에 낀 게시)는 창이 좁다. 진단이 놓친 더 흔한 시나리오가 있다: **사람이 연달아 누르기** — 게시 A·B·C 또는 건너뛰기 여러 줄을 1분 안에 누르면 B 가 조용히 취소된다(게시 작업 ~1분 · 건너뛰기 ~20초). 하나 더: 대기줄을 나누면 insta/seen.json 을 여러 작업이 동시에 쓰게 되는데, 이 파일에는 병합 규칙이 없다. 게다가 tools/merge-json-union.mjs 231행의 일반 규칙 `/(^|\/)seen\.json$/` 이 insta/seen.json 에도 걸린다. 표본으로 돌려 보니(O/A/B → 'insta/seen.json') 병합 결과에서 **올림 기록(posted)과 다른 쪽의 준비 줄이 사라졌다.** 누가 .gitattributes 에 이 파일을 jsonunion 으로 더하기만 해도 이중 게시를 부르는 함정이다.

수리 명세: ① insta.yml: 워크플로 단위 concurrency 를 지우고 작업 단위로 옮긴다. prepare 작업: `concurrency: { group: ${{ inputs.code && format('insta-code-{0}', inputs.code) || 'insta-prepare' }}, cancel-in-progress: false }`(코드 없는 자동·버튼 준비끼리는 서로 취소돼도 무해하다 — 같은 일을 한다). publish·skip 작업: `concurrency: { group: ${{ format('insta-code-{0}', inputs.code) }}, cancel-in-progress: false }`. 다른 공고끼리는 서로 취소하지 않고, 같은 공고를 두 번 누르면 두 번째가 첫 번째 뒤에 돌아 '이미 올림' 검사에 걸린다. 머리 주석(57~58행)도 고친다.
② seen.json 동시 쓰기 대비: tools/merge-json-union.mjs RULES 에 `{ match: /(^|\/)insta\/seen\.json$/, merge: mergeInstaSeen }` 를 **일반 `seen\.json$` 규칙보다 앞에** 둔다. mergeInstaSeen(ours, theirs): posted 는 code 로 합집합(같은 code 면 media 가 있는 쪽, 그다음 이른 at · 절대 버리지 않는다). prepared 는 code 로 합집합, 같은 code 면 상태 순위 posted(4) > skipped·expired(3) > prepared(2) > failed(1), 같은 순위면 날짜(revisedAt||at·skippedAt·expiredAt·failedAt 중 가장 늦은 것)가 늦은 쪽, 그래도 같으면 ours. 지우기는 하지 않는다. .gitattributes 에 `insta/seen.json merge=jsonunion` 을 더한다. insta.yml 의 세 저장 단계(준비 커밋 · 올린 기록 저장 · 건너뛰기)는 저장 전에 `bash tools/setup-collab.sh` 를 부른다.
③ (선택) 관리자 화면은 지금 문구를 '대기줄에서 기다릴 수 있어요 — 1~2분 뒤 새로고침' 으로 바꾼다. 결과를 따라가 보는 기능은 만들지 않는다.
바꾸지 말 것: 수집 로봇과 다른 대기줄(57행 이유) · cancel-in-progress: false · 게시 조건 긍정형 startsWith(관문 C9 이 `if: ${{ startsWith(inputs.step, '게시') }}` 를 글자 그대로 찾는다).

관문: (4-a) insta.yml 에 열 0 의 `^concurrency:` 가 없다. publish·skip 작업 구간에 `concurrency:` 와 `inputs.code` 가 있다. (4-b) 병합 규칙의 실제 동작: os.tmpdir 에 O={posted:[],prepared:[{A prepared}]}, A={posted:[{code:'A',media:'1'}],prepared:[{A posted}]}, B={posted:[],prepared:[{A prepared},{B prepared}]} 를 쓰고 `node tools/merge-json-union.mjs O A B insta/seen.json` 을 child 로 돌린다. 기대: 종료 0 · 결과 posted 에 A(media 1) 가 있고 · prepared 에 A=posted 와 B=prepared 가 둘 다 있다. 결과는 표본 A 파일에만 쓰이므로 저장소를 건드리지 않는다. (4-c) .gitattributes 에 `insta/seen.json merge=jsonunion` 이 있고, insta.yml 의 저장 단계 셋에 setup-collab.sh 가 있다. red: 지금 코드로 (4-a) 가 빨강이다. (4-b) 는 지금 실측으로 posted 가 [] 가 되고 B 가 사라진다 → 빨강.

소급: 없음(설정·규칙 변경).

파일: .github/workflows/insta.yml tools/merge-json-union.mjs .gitattributes _admin/admin.js verify/health-gates/insta.mjs

위험: .gitattributes 는 다른 세션이 4줄을 더했다(기본 브랜치에 병합됨 · 다른 자리라 단순 병합). tools/merge-json-union.mjs 는 다른 묶음(협업·로봇 기록장)도 손댈 수 있다 — 오케스트레이터가 순서를 정해야 한다. 같은 공고를 사람이 다시 그리는 동안 자동 준비가 '7일 지난 실패' 공고를 함께 뽑는 드문 경우에는 insta/pub/<code> 그림이 이진 충돌한다(기존 루프의 빨간불로 끝남).

---
## [insta/insta-5] P2 · needs-human
**결정: 보고만(브랜드·사진 결정 — 개발자에게 묻는다). 코드 변경 없음.**

이유: 사실은 확인됐다. insta/school.mjs 23~26행의 SCHOOLS 가 경희대·한국외대 둘로 고정이고, 87행 `if (!school) return null` 이 다른 학교를 버린다. 작업 트리에서 schoolNotices() 를 대조하니 registered.json 교내 19건 중 12건만 받고 7건이 빠진다. 그중 지금 카드로 그릴 수 있는(마감 있음·마감 전) 것은 4건이다: 건국대 auto-kuk2351208222artclviewdo(10-20) · 고려대 auto-onttid000100000000003856(10-30) · 동국대 auto-ec9588eb82b4202026091720(10-14) · 인하대 auto-krbbskr845644artclviewdo(10-15). 나머지 셋은 마감 지남 또는 마감 없음이라 원래 안 뽑힌다(pick.mjs 의 마감없음 제외). 문제는 학교 목록만이 아니다. 계정 정체성이 두 학교에 묶여 있다 — 캡션 고정 문구 '● 경희대·한국외대는 교내 장학금도 올라와요'(caption.mjs 163·165행), 학교 해시태그 SCHOOL_TAG(23행 · 교외 공고에도 두 학교 태그를 붙인다), 사진 풀 insta/photos.json(경희대·한국외대·교외 셋). 44개교 복원 지시(2026-09-29)는 인스타를 언급하지 않았다. 그러니 넓힐지는 개발자가 정할 일이다.

수리 명세: (개발자가 ①을 고르면) insta/school.mjs: 고정 SCHOOLS 를 없앤다. eligibility.schoolOnly(정식 학교 이름)를 그대로 학교로 쓰고, 짧은 이름(key)은 data.js 의 UNIV_ALIASES·UNIVERSITIES 를 불러 정한다(베끼지 않는다). schoolOnly 가 없는 옛 항목만 지금의 provider·name 대조로 물러난다. 사진: insta/photos.json 에 학교 키가 없으면 assets/schools/photos.json 의 그 학교 항목에 있는 `page`(위키미디어 파일 페이지)로 1920px 썸네일 주소를 만들어 쓴다(find-photos.mjs 의 방식 · 저작자·라이선스는 credit 칸을 캡션 출처 줄에 그대로). 그것도 없으면 '교외·*' 공용 사진. caption.mjs: SCHOOL_TAG 를 `#${key}장학금` 생성으로 바꾸고, 교외 공고에 학교 태그 둘을 붙이던 줄(178행)과 고정 문구(163·165행)를 학교 중립으로 고친다. 관문 C8 의 FIXED_TAGS 계산도 같이 맞춘다. pick.mjs 의 교내 +4 는 그대로. ③이면 school.mjs 머리말과 SCRIPT.md 193행 절에 '2026-10-04 개발자 결정 — 의도적으로 2개교' 를 적는다.

관문: (결정 뒤) health-gates/insta.mjs: 표본 registered 항목(schoolOnly '건국대학교', type 교내)을 toNotice 에 넣으면 null 이 아니고, school 키·사진·해시태그가 그 학교 것이어야 한다(실데이터를 읽지 않는다). red: 고정 SCHOOLS 로 되돌리면 null.

소급: 넓히면 다음 준비 실행의 pick --new 가 새 학교 교내 공고를 점수순으로 그린다(장부에 없는 공고라 저절로 잡힌다). 손으로 고칠 데이터는 없다.

파일: insta/school.mjs insta/caption.mjs insta/photos.json insta/SCRIPT.md verify/health-gates/insta.mjs

위험: 표지 사진이 학교 건물이면 그 학교 공고로 읽힌다 — 교내 공고에만 써야 한다(render.mjs photoFor 의 기존 규칙). 위키미디어 원본 크기·라이선스 표기 의무(BY·BY-SA)를 캡션에서 지켜야 한다.

---
## [insta/insta-7] P3 · confirmed

이유: 확인했다. insta/pub 은 170폴더 · 1163파일 · 100MB 이고, 지우는 단계가 어디에도 없다(insta/*.mjs·insta*.yml 에서 rm 은 render.mjs 의 같은 폴더 다시 쓰기뿐). insta.yml 153~158행 upload-artifact 의 path 가 `insta/pub/` 통째라, 그리는 실행마다 그림 전부(약 85MB)를 다시 올린다. 장부의 준비됨 중 88건이 마감이 지났는데, 이 카드는 다시 그릴 수도 올릴 수도 없다 — 마감이 지나면 render --pub 이 캡션 단계에서 거절하고, 게시도 insta-1 가드가 막는다. main 의 Pages 트리는 376.5MB 이고 그중 insta/pub 이 95.6MB 다. 이 속도(3주에 약 100MB)면 GitHub Pages 의 1GB 사이트 상한이 몇 달 안의 실제 위험이 된다. 열린 insta-ready 준비 이슈 34건 대부분이 마감 지난 카드다(예: #256·#262·#264 · 9-12 생성).

수리 명세: ① insta/pick.mjs 에 순수 함수 `export function expireRows(seen, now)` 를 둔다: prepared 줄 중 status ∈ {prepared, skipped, failed} 이고, due 가 있고, `Date.parse(due+'T23:59:59+09:00') < now` 이며, code 가 posted 에 없는 것을 `status:'expired', expiredAt: kstDay(now)` 로 바꾼다. 바꾼 code 목록을 돌려준다(due 없음·오늘 마감·올린 것은 그대로). candidates() 의 prepped 집합에서는, 현재 공고 due 가 장부 줄 due 보다 늦어진 expired 줄을 뺀다(재단이 마감을 미룬 경우 다시 그릴 수 있게).
② insta/ledger.mjs 에 `expire` 명령: expireRows 를 적용하고, 돌려받은 각 code 의 insta/pub/<code>/ 를 rmSync(recursive, force)로 지운다. 🔴 posted 의 폴더는 절대 지우지 않는다(관리자 「올림」 줄의 썸네일이 raw insta/pub/<code>/1.jpg 를 읽는다). writeSeen 은 들여쓰기 1칸.
③ insta.yml 준비 작업: '사실 관문' 다음, '무엇을 할지 정한다' 앞에 단계 '마감 지난 카드 정리' 를 둔다: `node insta/ledger.mjs expire`. 그리고 GH_TOKEN 으로 열린 insta-ready 이슈마다 본문의 `<!-- insta-code: X -->` 를 모아, 전부가 장부에서 posted·skipped·expired 이면 '카드가 모두 마감 지남/올림/건너뜀 — 자동으로 닫습니다' 댓글과 함께 닫는다. 커밋 단계 조건은 `always() && steps.plan.outputs.mode != 'none'` 으로 넓힌다(새 카드가 없어도 정리분을 커밋 · `git add -A insta/pub insta/seen.json` 과 `git diff --cached --quiet` 탈출은 그대로). 메시지 '인스타: 카드 준비 N건 · 마감 지나 정리 M건'.
④ artifact: 새 단계가 이번에 그린 코드만 `${{ runner.temp }}/cards/<code>/` 로 복사하고, upload-artifact path 를 그 폴더로 바꾼다.
⑤ 관리자 화면은 expired 를 어느 묶음에도 넣지 않는다(지금 instaGroups 가 prepared·skipped 만 고르므로 저절로 빠진다). SCRIPT.md 장부 설명에 expired 상태를 적는다.
바꾸지 말 것: '건너뛰기는 폴더를 남긴다'(마감 전 건너뛴 것은 남긴다 — 다시 그리면 되살아난다) · 공고당 폴더 하나 · insta/pub 은 .gitignore 에 넣지 않는다(관문 C9).

관문: (7-a) expireRows 표본 표: 마감 지난 prepared·skipped·failed → expired · posted 에 있는 code 는 그대로 · due 없음 그대로 · 오늘 마감(now=그날 12:00 KST) 그대로 · 미래 그대로. (7-b) candidates: expired 줄(due 10-01)과 현재 공고 due 10-30 → unpreparedOnly 에서 다시 뽑힌다. 같은 due 면 안 뽑힌다. (7-c) insta.yml: upload-artifact 의 path 가 'insta/pub/' 가 아니고, 준비 작업에 'ledger.mjs expire' 가 'pick.mjs --new' 보다 앞에 있다. red: 지금 코드에는 expireRows 가 없어 (7-a)(7-b) 가 빨강, (7-c) 는 157행 path 로 빨강.

소급: 다음 준비 실행(수집 로봇이 끝날 때마다 · 늦어도 매일 09:13 KST)이 스스로 고친다. 마감 지난 88건 이상을 expired 로 바꾸고 폴더를 지우며(약 50MB · git 이력에는 남아 되살릴 수 있다), 다 끝난 준비 이슈 약 25건을 닫는다. 손으로 고칠 것은 없다. 선조치후보고 — 지운 건수와 닫은 이슈 번호를 보고에 적는다.

파일: insta/pick.mjs insta/ledger.mjs .github/workflows/insta.yml insta/SCRIPT.md verify/health-gates/insta.mjs

위험: 과거 이력의 무게(.git 331MB)는 그대로다 — 줄일 수 있는 것은 Pages 트리와 앞으로의 증가뿐이다. 마감 지난 카드를 지우는 것은 되돌릴 수 있다(git 이력). 그래도 개발자가 '지우지 말라' 고 하면 rmSync 만 빼고 상태만 expired 로 둔다. insta.yml 을 insta-1·2·4 와 같이 고친다.

---
## [insta/insta-8] P3 · confirmed

이유: 확인했다. comments.json 은 {updatedAt: 2026-10-04T06:10:23Z, items: []} 다. 10-02 17:57 이후 '인스타: 댓글 fetch' 커밋이 7개이고, 내용은 updatedAt 한 줄뿐이다. comments.mjs 58행은 매번 `store.write({ updatedAt: new Date(now)…, items })` 를 하므로, insta-comments.yml 67~70행의 `git diff --cached --quiet` 가 늘 '바뀜'이 된다. 관리자 화면 2325행은 이 값을 '받아 온 시각' 으로 보여 준다.

수리 명세: insta/comments.mjs fetchAll: items 정렬을 at 내림차순 → 같으면 id 로 고정한다(API 순서 흔들림이 헛변경을 만들지 않게). `prev.updatedAt` 이 있고 `JSON.stringify(items) === JSON.stringify(prev.items || [])` 이면 쓰지 않고 `{ state:'ok', unchanged:true, count, failed }` 를 돌려준다. 그러면 updatedAt 의 뜻이 '마지막으로 바뀐 시각' 이 된다. _admin/admin.js 2325행 문구 '받아 온 시각' → '마지막 변화' 로 바꾼다(받아 온 시각은 Actions 실행 기록이 말한다). insta-comments.yml 은 고칠 필요가 없다(파일이 안 바뀌면 '변화 없음' 으로 끝난다). 바꾸지 말 것: handledAt 을 남기는 규칙(verify-insta C11) · 들여쓰기 1칸.

관문: (8-a) 가짜 fetch(verify-insta C11 의 fk 꼴 — 댓글 1건)와 메모리 store 로 fetchAll 을 두 번 부른다. 두 번째의 prev 는 첫 번째가 쓴 값이다. store.write 가 1번만 불려야 한다. 댓글이 하나 늘면 다시 써야 한다. red: 지금 코드는 두 번 다 쓴다(write 2회).

소급: 없음.

파일: insta/comments.mjs _admin/admin.js verify/health-gates/insta.mjs

위험: 없음. 관리자 화면 문구 한 줄이 바뀐다.

---
## [insta/insta-9] P3 · confirmed

이유: 구조가 확인됐다. .claude/skills/insta-revise/SKILL.md 52~53행은 작업 브랜치만 쓰는 세션에 'deploy/run-deploy.txt 로 「이 기기에서 배포」 를 태운다' 고 안내한다. 그런데 device-deploy.yml 의 checkout(57~60행)은 토큰을 따로 주지 않아 github.token 을 쓰고, 그 토큰으로 기본 브랜치에 push 한다(128~137행). 이 워크플로 머리말 스스로 '로봇이 올린 push 는 다른 워크플로를 깨우지 못한다' 고 적어 두었다. insta.yml 의 알림 트리거는 push(branches 기본 브랜치 · paths insta/run-notify.txt)뿐이라, 이 길로 들어온 수정본 알림은 조용히 안 간다. 예외로 workflow_dispatch 는 github.token 으로도 깨어난다. 관리자 화면에는 알림 버튼도 없다(INSTA_STEP.notify 를 쓰는 곳 없음). run-notify.txt 는 9-12 이후 안 고쳐졌고 insta.yml 의 push 실행도 0회라, 아직 당한 적은 없다.

수리 명세: .github/workflows/device-deploy.yml: permissions 에 `actions: write` 를 더한다. run 단계가 기본 브랜치 push 직전(fetch 뒤)에 `before=$(git rev-parse origin/$BASE)` 를 GITHUB_OUTPUT 에 남긴다. 새 단계 '인스타 수정본 알림 깨우기' 를 둔다 — `if: steps.run.outputs.state == 'deployed' || steps.run.outputs.state == 'uptodate'`: `git fetch origin $BASE` 뒤 `git diff --name-only <before> origin/$BASE -- insta/run-notify.txt` 가 비어 있지 않으면 `CODE=$(git show origin/$BASE:insta/run-notify.txt | sed -n 's/^code:[[:space:]]*//p' | head -1)`. CODE 가 `^[A-Za-z0-9_-]+$` 일 때만 `gh workflow run insta.yml --repo "$REPO" --ref claude/nice-heisenberg-WESq5 -f step='알림 (준비된 카드를 다시 보낸다)' -f code="$CODE"`(GH_TOKEN: github.token) 하고 요약에 적는다. 기본 브랜치에 폴더가 올라간 **뒤**여야 한다(insta.yml 이 거기서 insta/pub/$CODE 를 찾는다). SKILL.md 5-3 은 '이 기기에서 배포가 알림까지 깨운다 — 그 실행 주소를 개발자에게 준다' 로 고친다. 사람이 기본 브랜치에 직접 push 하는 길(지금의 push 트리거)은 그대로 둔다(두 번 울리지 않는다 — device-deploy 를 거치지 않으므로).

관문: (9-a) device-deploy.yml 에 `gh workflow run insta.yml` 과 `actions: write` 가 있고, `-f step='…'` 의 글자가 insta.yml `options: [...]` 에서 '알림' 으로 시작하는 선택지와 한 글자도 다르지 않다(다르면 GitHub 이 422 로 거절 — admin INSTA_STEP 과 같은 함정 · verify-insta C11 과 같은 방식으로 뽑는다). code 정규식 검사가 있다. red: 지금 device-deploy.yml 로 빨강.

소급: 없음.

파일: .github/workflows/device-deploy.yml .claude/skills/insta-revise/SKILL.md verify/health-gates/insta.mjs

위험: device-deploy.yml 은 다른 묶음(배포)이 손댈 수 있다 — 오케스트레이터가 확인한다. actions: write 권한이 늘어난다(이 워크플로는 사람이 누르거나 run-deploy.txt 의 branch 대조로만 돈다).

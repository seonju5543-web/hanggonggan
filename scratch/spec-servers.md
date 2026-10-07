# 수리 명세 — 묶음 servers

권장 순서: servers-F1 → servers-F11 → servers-F5 → servers-F6 → servers-F7 → servers-F3 → servers-F4 → servers-F10 → servers-F8
예상 손댈 파일: server/apply/apply-guard.mjs server/apply/wrangler.toml server/README.md server/push/worker.js server/push/README.md .github/workflows/push-health.yml tools/push-health-verdict.mjs .github/workflows/supabase-health.yml tools/supabase-health.mjs docs/designs/data-flow.md sw.js verify/health-gates.mjs verify/health-gates/servers.mjs

검증 메모: 검증 기준: 지금 기본 브랜치 4ba7da49. 다른 세션 브랜치 claude/source-link-integrity 는 이미 기본 브랜치에 합쳐져 있다(merge-base 확인). 그 브랜치가 이 묶음 파일에서 바꾼 것은 sw.js 의 CACHE 번호뿐이라, other-session 판정은 하나도 없다. 실험은 전부 일회용 worktree 에서 했고 끝난 뒤 지웠다(저장소는 깨끗함). 프로토타입은 scratchpad/verify-servers/ 에 있다: worker.proto.js·apply-guard.proto.mjs·gate-proto.mjs·gate-health.mjs·graph.mjs·sw-push.cjs·bench.mjs·churn.cjs.

구현 차례: ① F1+F11(server/apply · server/README) ② F5+F6+F7(같은 함수 schoolsToWake/summarize — 한 번에) ③ F3+F4(tick·/health + push-health 판정 도구) ④ F10(sw.js 한 줄) ⑤ F8(새 워크플로·도구·설계 문서). 관문은 모두 verify/health-gates/servers.mjs 한 파일에 두고 verify/health-gates.mjs 의 PARTS 에 'servers' 를 더한다. test-collector.mjs 는 고치지 않는다.

🔴 server/push/worker.js 는 가동 중이다. 기본 브랜치의 server/push/* 를 바꾸면 Workers Builds 가 곧바로 배포한다(SESSIONS.md:1880). 수리한 사람은 다음 셋을 반드시 확인한다: node verify/verify-push-server.mjs 전부 통과(프로토타입에서 통과) · wrangler dry-run(scratchpad/servers/wr 에 wrangler 4.147.0 이 있다 · 프로토타입 18.19KiB, SUBS 바인딩 정상) · 무료 등급 10ms 한도(plan 단계 Node 실측 1.76→2.73ms).

파일이 겹치는 곳: .github/workflows/push-health.yml 은 alerts 묶음(servers-F2: checkout 추가)과 같은 파일이다 — F3 도 checkout 이 필요하니 한 수리자가 같이 하거나 alerts 다음에 한다. sw.js 는 ci 묶음과 겹친다. verify/health-gates.mjs 의 PARTS 는 모든 묶음이 고친다. 원래 제안에 있던 match-engine.js·notify.js·notify-rules.js·verify/verify-push-server.mjs·verify/test-collector.mjs 는 고치지 않게 바꿨다. 이유: 사본 + 관문 대조가 빌드 감시 경로(server/push/*) 아래에서 더 단단하고, feed 묶음(match-engine)과도 부딪히지 않는다.

다른 묶음에 넘길 발견 둘. (1) feed 묶음: match-engine noticeForProfile 에서 [ERICA] 제목 표시 글은 tagged 학교 '한양대학교 ERICA캠퍼스' 가 SERVED_SCHOOLS 에 없어 ERICA 학생을 포함해 누구에게도 안 보인다(match-engine.js 891-900행 · 지금 한양 피드는 0건이라 증상 없음). (2) feed 묶음 app2-F4 와 이어진다: 발송 서버는 옛 통짜 data/notices.json(346건)을 읽고 폰은 학교별 파일(364건 — 충북·충남·방통 18건은 09-30 에 굳어 학교별 파일에만 있음)을 읽어 '새 공고' 판단의 출처가 갈라져 있다. feed 가 잃어버린 공고 215건을 되살릴 때 F5 의 foundAt 규칙이 없으면 서버가 옛 글로 여러 학교를 한꺼번에 깨운다 → F5 를 먼저 배포하는 편이 안전하다.

개발자 확인이 필요한 것: CLAUDE.md 아키텍처 표의 '`server/mail-worker.js` … 메일(배포 대기)' 문구가 낡았다(지금은 server/apply/ · 꺼짐). CLAUDE.md 는 개발자 확인 뒤에만 고친다. 그리고 F8 의 humanQuestion(Supabase 요금 등급).

기존 verify/verify-push-server.mjs [6] 은 실데이터(data/registered.json·notices.json)를 읽지만, 단정은 '첫 실행에 새 공고 깨움 없음' 하나라 이번에는 건드리지 않았다.


---
## [servers-F1] P3 · confirmed

이유: 재현함(지금 기본 브랜치 4ba7da49 기준). 일회용 worktree 에서 wrangler 4.147.0 `deploy --dry-run` 을 돌리면 번들이 14.77KiB 이고, 번들 안에 `import { createRequire as _cr } from "node:module"; var ME = _cr(import.meta.url)("../../match-engine.js")` 가 그대로 남는다. 경고도 같이 뜬다: 'The package "node:module" wasn't found … enable nodejs_compat'. 진단 때 남긴 wrangler dev 로그(scratchpad/servers/apply-dev.log·apply-dev2.log)에는 'No such module "node:module"' 가 있고, nodejs_compat 를 켜도 'createRequire … path Received undefined' 로 실패한다. 수리안도 실제로 확인했다. `import ME from '../../match-engine.js'` 한 줄로 바꾸면 번들이 115.59KiB 가 되고 section-head·parse-requirements 까지 같이 묶인다. 그 상태로 wrangler dev 를 띄우면 'Ready' 가 나오고, POST {} 에는 503 {"why":"아직 접수 대행이 켜지지 않았습니다"} 가 돌아온다(열쇠가 없을 때의 정상 응답). Node 관문 verify-apply-guard.mjs 도 통과하고, test-collector 가 쓰는 PROFILE_BOUNDS 등 내보내는 이름도 그대로다(저장소 맨 위에 package.json 이 없어 .js 는 CJS 로 읽힌다). 같은 함정을 essay 쪽은 cf3df58a(2026-08-24)에서 이미 피했다. 심각도는 P2→P3 로 낮춘다. 기능이 꺼져 있어 학생 영향이 없고, 켜는 날에도 업로드·첫 요청에서 바로 드러나므로 '조용한 고장'이 아니다.

수리 명세: server/apply/apply-guard.mjs 27-28행 두 줄 `import { createRequire as _cr } from 'node:module'; const ME = _cr(import.meta.url)('../../match-engine.js');` 를 `import ME from '../../match-engine.js';` 한 줄로 바꾼다. 바로 위 머리말에 이유를 한 줄 적는다(Workers 에는 node:module 이 없다 · server/essay/draft-guard.mjs 와 같은 길 · cf3df58a). 바꾸지 말 것: ME.* 를 쓰는 곳 전부, SENDABLE·PROFILE_BOUNDS·validateSubmission 등 내보내는 이름, 판정 로직(CLAUDE.md 운영 원칙 10 — 서버가 앱과 같은 엔진으로 다시 판정). match-engine.js 는 고치지 않는다.

관문: verify/health-gates/servers.mjs ① 「서버 워커가 Workers 에서 못 싣는 모듈을 부르지 않는다」. 순수 함수 workerImportProblems(readFile, entry) 를 만든다. 진입점 server/*/wrangler.toml 의 main 에서 시작해 상대 경로 import·require·import() 를 따라가며 각 파일을 주석을 걷어낸 뒤 읽고, `from 'node:`·`require('node:`·`createRequire(` 와 없는 상대 경로를 모은다. 함수 자체는 메모리 표본 두 벌로 잰다(createRequire 꼴 → 문제 2건, default import 꼴 → 0건). 그다음 실제 server/ 코드(데이터가 아니라 코드다)에 적용해 apply·chat·essay·push 모두 [] 를 기대한다. 프로토타입 실측: 지금 HEAD 는 apply 만 ["…apply-guard.mjs: createRequire","…: node:module"], 수정 뒤에는 넷 모두 []. red 증명: apply-guard.mjs 두 줄을 되돌리면 ✕.

소급: 없음 — 배포된 적이 없는 워커다.

파일: server/apply/apply-guard.mjs verify/health-gates/servers.mjs verify/health-gates.mjs

위험: 번들이 15KB→116KB 가 된다(무료 한도 안). match-engine.js 가 바뀌면 apply 워커를 다시 올려야 판정이 맞는다 — 지금은 꺼져 있어 해당 없음, 켜는 날 README ④에 한 줄. 다른 세션 브랜치(이미 기본 브랜치에 합쳐짐)는 이 파일을 건드리지 않는다.

---
## [servers-F11] P3 · confirmed

이유: server/README.md 전체가 폐기된 mail-worker 를 기준으로 적혀 있다('서버 코드(mail-worker.js) 완성 — 배포 대기', '앱은 HANDAEJANG_CONFIG.mailEndpoint 가 설정되는 순간…'). grep 해 보면 HANDAEJANG_CONFIG 는 server/mail-worker.js:23 주석과 server/README.md:8 에만 있고 앱 코드에는 없다. mail-worker.js 머리말은 '이 파일은 더 쓰지 않는다 (2026-09-25) → server/apply/' 다. server/apply/wrangler.toml:5-7 은 '보낸 기록도 여기 남기지 않는다(KV 없음) · 증빙을 남기려면 그때 KV 를 붙인다' 라고 하는데, 실제로는 send-log.mjs:60·161 이 Supabase apply_sends(0003_apply_sends.sql)에 기록하고, terms.html:213-217 도 이미 '접수 대행 발송 시 · 발송 시각, 공고 번호, 받는 곳…' 을 수집 항목으로 적고 있다. 서버 폴더의 현황도 문서와 다르다: push 만 가동(push-config.js endpoint 채움), chat·essay 는 config endpoint 가 빈칸, apply 는 README ⓪ 대로 우리 도메인이 없어 꺼짐.

수리 명세: ① server/README.md 를 '서버 폴더 안내' 현황표로 다시 쓴다. push = 가동 · GitHub 연결 배포(Workers Builds)가 기본 브랜치의 server/push/* 를 올린다 · server/push/README.md. chat = 꺼짐(chat-config.js endpoint 빈칸) · server/chat/README.md. essay = 꺼짐(essay-config.js endpoint 빈칸) · server/essay/README.md. apply = 꺼짐 · 우리 도메인 필요 · 앱 메일 버튼은 mailto: · server/apply/README.md. mail-worker.js = 2026-09-25 폐기 · 같은 꼴로 되돌아가지 않도록 남겨 둠. 현황 숫자(구독 수 등)는 적지 않는다. ② server/apply/wrangler.toml 5-7행 주석을 고친다: '이 워커는 저장소(KV)를 쓰지 않는다 · 발송 증빙은 Supabase apply_sends 표에 남는다(send-log.mjs · supabase/migrations/0003_apply_sends.sql · terms.html 수집 항목에 이미 있음) · 학생이 쓴 글은 어디에도 남기지 않는다 · 시크릿 목록은 README ②'. ③ mail-worker.js 는 손대지 않는다(머리말에 이미 폐기 표시가 있다). CLAUDE.md 아키텍처 표의 `server/mail-worker.js` '메일(배포 대기)' 도 낡았지만, CLAUDE.md 는 개발자 확인 뒤에만 고친다(notes 참조).

관문: verify/health-gates/servers.mjs ② server/ 아래 wrangler.toml 이 있는 폴더 이름(apply·chat·essay·push)이 server/README.md 에 모두 나오고, 그 README 에 'HANDAEJANG_CONFIG' 가 없다. 그리고 server/apply/wrangler.toml 주석에 'apply_sends' 가 있다. red 증명: 옛 README 로 되돌리면 apply·chat·essay·push 누락과 HANDAEJANG_CONFIG 때문에 ✕.

소급: 없음(문서).

파일: server/README.md server/apply/wrangler.toml verify/health-gates/servers.mjs

위험: 없음. F1 과 같은 폴더라 한 번에 고친다.

---
## [servers-F5] P2 · confirmed

이유: 원인을 코드로 확인했다. server/push/worker.js:209-218 은 'n:'+url 하나로 '본 공고'를 정한다. 반면 notify-rules.js:278-295(4ea6938b, 10-03 17:13Z 리뷰 F3)는 주소 · 't:학교|제목' · foundAt 셋 중 하나만 맞아도 본 것으로 친다. 그래서 주소만 바뀐 같은 공고에서 폰은 feed 이벤트 0건을 내고, 그러면 sw.js:340-345 의 일반 알림 '한대장 · 새 장학 소식' 이 뜬다. 서버가 읽는 파일(data/notices.json)을 회차 시각 기준으로 비교해 실측했다(기본 브랜치 커밋 기준이며 실제 앱은 main 이라 조금 늦을 수 있다). 10-03 20:10 KST 회차(247b89f9→b29eadbf)는 깨운 5개교 중 4곳(가천 19 · 고려 9 · 서울교대 10 · 서울 2건)이 주소만 바뀐 글뿐이었다. 10-04 08:10 회차(b29eadbf→19a5ad04)는 9개교 전부가 주소만 바뀐 글이었다(가천 14 · 고려 9 · 동국 7 · 서울교대 6 · 경기 3 · 전북 3 · 항공 2 · 성균관 1 · 부경 1 = 46건). 오늘 20:10 예정분(→a31a8538)은 서울대 1곳에 진짜 새 글 7건이라 정당하다. 구독 4대(push-health run 37162895315 의 subs:4)가 어느 학교인지는 서버 KV 에만 있어, 실제로 뜬 빈 알림 수는 확인하지 못했다(Cloudflare 로그를 볼 수 없음). 다른 세션(source-link-integrity · 이미 기본 브랜치에 합쳐짐)은 폰 쪽만 고쳤고 worker.js 는 건드리지 않았다(worker.js 최종 변경 247b89f9).

수리 명세: server/push/worker.js 만 고친다. ① summarize 의 notices 항목에 foundAt(문자열)을 더한다. ② `titleSeenKey(n) = 't:' + (n.school||'') + '|' + String(n.title||'').replace(/\s+/g,'')` 를 둔다. notify-rules.js:278-280 과 같은 식의 사본이다. 불러 쓰지 않고 사본을 두는 이유: Workers Builds 감시 경로가 server/push/* 라서, 바깥 파일을 불러 쓰면 그 파일이 바뀌어도 워커가 다시 올라가지 않는다. 사본 + 관문 대조라야 바뀐 쪽이 빨간불로 잡힌다. ③ schoolsToWake 의 피드 반복은 다음 셋 중 하나면 '본 것'으로 친다: seen.has('n:'+url), seen.has(titleSeenKey(n)), (foundAt 날짜 + 2일 ≤ 지난 판정 시각). 지난 판정 시각은 새 KV 키 state:planAt 이고, plan 끝에 Date.now() 를 적는다. 이 셋째 조건은 폰의 foundBeforeLastCheck 와 같은 규칙이다. 두 열쇠는 모두 장부에 적는다. ④ 🔴 장부 자르기를 고친다. 지금은 Set 의 삽입 순서대로 slice(-4000) 라 오래 실린 공고의 열쇠가 먼저 잘려 다시 '새 공고'가 된다. 이번 실행에서 데이터에 있는 열쇠(present: 정식 id · n: · t: · due:)를 뒤로 모으고, 데이터에 없는 옛 열쇠부터 잘라 상한 4000 을 지킨다(지금 present 는 약 860개). ⑤ 유지할 것: 첫 실행(장부가 빔)은 조용히 장부만 채운다 · 대출·융자는 깨우지 않는다 · reasons 형식 · 내보내는 이름(+ titleSeenKey 추가). 옛 장부(n: 열쇠만 있음)는 첫 회차에 주소가 같으면 본 것으로 판정되고 t: 열쇠가 채워진다 — 깨우기 폭주는 없다. CPU: Node 실측 plan 단계 1.76ms→2.73ms(정식 164 · 피드 346 · 장부 4000), 10ms 한도 안.

관문: verify/health-gates/servers.mjs ⑥(표본만 · 가짜 KV · Date.now 고정 후 finally 로 되돌림). (a) 1회차 {url:'https://a/#n-1', school:'가천대학교', title:'2026 장학 안내'} → 2회차에 같은 학교, 공백만 다른 제목, 새 주소 → 깨울 학교 []. 제목이 다른 새 글이 오면 ['가천대학교']. (b) 새 주소·새 제목이라도 foundAt 이 지난 판정보다 2일 이상 앞서면 깨우지 않는다. (c) 열쇠 대조: 공백·탭·NBSP 가 섞인 표본 제목마다 NOTIFY_RULES.evaluate 를 한 번 돌려 out.ledger.seenNotice 의 't:' 열쇠가 worker.titleSeenKey(n) 와 같아야 한다(notify-rules.js 를 고치지 않고 장부에서 읽는다 — 실측으로 ['https://a/1','t:가천대학교|2026장학안내'] 가 나옴). (d) 옛 열쇠 4000개 + 현재 공고 → 저장된 장부에 현재 공고 열쇠가 남는다. 프로토타입 red-green 실측: 수정 전 (a) 첫 줄이 ['가천대학교'] 로 ✕, 수정 후 ✓. 기존 verify-push-server.mjs 도 전부 통과.

소급: 저장소 데이터 없음(상태는 Cloudflare KV). 기본 브랜치에 push 하면 Workers Builds 가 올리고, 다음 회차부터 저절로 맞는다. 사람이 손으로 고칠 것 없음.

파일: server/push/worker.js verify/health-gates/servers.mjs verify/health-gates.mjs

위험: 가동 중인 워커다 — server/push/* 를 바꿔 기본 브랜치에 push 하는 순간 바로 배포된다. 실수하면 알림 전체가 멈추므로 verify-push-server.mjs 와 wrangler dry-run 을 반드시 돌린다(프로토타입: 18.19KiB · SUBS 바인딩 정상). 같은 학교에 같은 제목의 다른 글은 깨우지 않는다 — 폰도 같은 열쇠로 안 알리므로 앞뒤가 맞는다. notify-rules.js·match-engine.js 는 고치지 않으므로 feed 묶음(match-engine)과 부딪히지 않는다. foundAt 규칙 덕에 feed 묶음이 잃어버린 공고 215건을 되살려도 서버가 옛 글로 전원을 깨우지 않는다.

---
## [servers-F6] P2 · confirmed

이유: 원인을 코드로 확인했다. worker.js:195-207 은 회차마다 dueSoon(마감이 오늘·내일)을 새로 세고 '이미 깨웠다'를 기억하지 않는다. schoolOnly 가 없으면 wakeAll 이다(summarize 160행은 schoolsAny 를 보지 않는다). 폰은 'dl:'+id+':'+d 를 ledger.sent 로 한 번만 보낸다(notify-rules.js:179 already · 242). 그래서 같은 날 두 번째 회차는 빈 알림이 되고, 자격 미달 학생은 두 번 다 빈 알림이다. 지금 registered.json(기본 브랜치 164건 · 학교 한정 없음 50건 · 그중 schoolsAny 1건)으로 모의했다. 10-04~10-24 21일 중 10일(10-05~08, 10-10~13, 10-15·16)이 wakeAll 이고, 그날마다 20:10 회차는 이 사유만으로 모든 구독자에게 빈 알림이다. 원래 제안의 '사람 결정(08:10 만)'은 필요 없다 — 하루 한 번만 깨우는 열쇠로 해결된다.

수리 명세: server/push/worker.js 의 summarize·schoolsToWake 를 고친다. ① 마감 사유에 열쇠 'due:'+id+':'+today(KST ymd)를 둔다. seen 에 없을 때만 깨우고, 있으면 깨우지 않는다. 열쇠는 nextSeen(F5 의 present)에 넣는다. 그러면 같은 공고는 하루 한 번만 깨운다 — 대개 08:10 이고, 낮에 새로 들어온 마감이면 20:10 이 처음이다. ② 장부가 빈 첫 실행에도 마감은 깨운다(기존 '첫날에도 마감은 알린다' 유지 · verify-push-server [6] 주석). ③ summarize 의 reg 항목에 schools 를 더한다: eligibility.schoolsAny 가 있으면 각 값의 '학교|캠퍼스' 에서 앞부분만. schoolOnly 가 없고 schools 가 있으면 그 학교들만 깨우고 wakeAll 은 하지 않는다(match-engine inSchoolsAny 와 같은 뜻). ④ 바꾸지 말 것: 새 공고 사유(countNew), 학교 한정 공고는 그 학교만.

관문: verify/health-gates/servers.mjs ⑦. Date.now 를 2026-10-04 08:10 → 같은 날 20:10 → 10-05 08:10 KST 로 옮기며 같은 장부로 schoolsToWake 를 부른다. 전국 공고(10-05 마감)는 wakeAll 이 true → false → true 여야 한다. schoolsAny ['경희대학교','한국외국어대학교|서울'] 공고는 wakeAll false, schools {경희대학교, 한국외국어대학교}. 프로토타입 실측: 수정 전에는 20:10 이 true, schoolsAny 가 wakeAll true 로 ✕ · 수정 후 ✓.

소급: 없음(KV 상태). 배포 뒤 첫 회차에는 장부에 due: 열쇠가 없으므로 그날 마감 건으로 한 번 깨운다 — 정상 동작.

파일: server/push/worker.js verify/health-gates/servers.mjs

위험: 08:10 깨우기가 푸시 서비스에서 유실되면 그날은 다시 시도하지 않는다(폰이 꺼져 있던 경우는 TTL 12시간이 덮는다). F5 와 같은 함수라 같은 사람이 한 번에 고친다. 가동 중인 워커라는 주의는 F5 와 같다.

---
## [servers-F7] P3 · confirmed

이유: 코드로 확인했다. match-engine.js:777-781 SHARED_BOARD_BRANCH · 785-796 TITLE_CAMPUS/taggedSchool · 891-900 noticeForProfile 가 화면과 알림을 정한다. 서버는 worker.js:216 `schools.add(n.school)`, 335행 `schools.has(sub.school)` 로 이름이 같을 때만 깨우고, 구독 때 보내는 school 은 프로필 학교 그대로다(notify.js:508). 지금 피드에 한양 0 · 건국 1 · 홍익 0건이라 실제 영향은 거의 없어 P3. 프로토타입 관문(깨울 학교 = noticeForProfile 이 참인 학교)으로 수정 전에는 분교 놓침 4건 ✕ 를 확인했다. 따로 발견한 것: [ERICA] 표시 글은 noticeForProfile 에서 tagged 학교('한양대학교 ERICA캠퍼스')가 SERVED_SCHOOLS 에 없어 **누구에게도** 안 보인다 — 화면 쪽 결함이라 feed 묶음(match-engine) 몫이다(notes).

수리 명세: server/push/worker.js 에 SHARED_BOARD_BRANCH · TITLE_CAMPUS · taggedSchool 사본을 두고 wakeSchoolsForNotice(n) 를 만든다. 결과는 [taggedSchool(n) || n.school] 에, 제목 표시가 없고 n.campus 도 없으면 그 학교를 본교로 둔 분교들을 더한 것이다. F5 의 피드 반복에서 schools.add(n.school) 대신 이 결과를 모두 넣는다. summarize 의 notices 에 campus 를 더한다(지금은 늘 빈 값이다). 🔴 match-engine.js 를 워커 번들로 싣지 말 것 — 126KB 이고, 빌드 감시 경로 밖이며, 10ms 한도도 걸린다. SERVED_SCHOOLS 사본도 들이지 않는다(세 번째 사본이 된다). 사본은 관문이 대조한다. 내보내는 이름에 taggedSchool · wakeSchoolsForNotice · SHARED_BOARD_BRANCH 를 더한다.

관문: verify/health-gates/servers.mjs ⑧. (a) worker.SHARED_BOARD_BRANCH 가 match-engine 의 SHARED_BOARD_BRANCH 와 깊게 같다. (b) 표본 공고 5개([ERICA]·[서울]·표시 없는 한양, [교외] 건국, 홍익) × 프로필 학교 6개(한양 · ERICA · 건국 · 글로컬 · 홍익 · 홍익 세종)로 잰다. noticeForProfile 이 참인 학교는 반드시 깨운다(놓침 0). 깨우는 학교는 noticeForProfile 참 ∪ {taggedSchool(n)} 안에 있어야 한다 — 위 [ERICA] 화면 결함이 고쳐져도 초록으로 남게 하는 조건이다. red 증명: worker 를 되돌리면 표시 없는 한양·건국·홍익 글에서 분교 놓침으로 ✕ (프로토타입 실측).

소급: 없음.

파일: server/push/worker.js verify/health-gates/servers.mjs

위험: feed 묶음이 match-engine 의 SHARED_BOARD_BRANCH 를 바꾸면 (a) 가 빨간불이 되어 서버 사본도 같이 고치게 한다 — 의도한 동작이다. match-engine.js·notify.js 는 고치지 않는다(원래 제안의 파일 목록에서 뺐다).

---
## [servers-F3] P3 · confirmed

이유: 코드로 확인했다. worker.js:261-266 은 state:slot 을 쓰기만 하고, /health(386-406)가 내보내는 칸은 ok·configured·step·sent·subs·lastError 뿐이다. clearRun(234-237)이 회차 결과(woke·dropped)를 버린다. push-health run 37162895315(10-03 23:47Z)의 응답 {"ok":true,"configured":true,"step":"idle","sent":0,"subs":4,"lastError":null} 로는 회차가 돌았는지 알 수 없다. 실제로 폰에 닿았다는 증명은 push-check 33575249245(2026-09-02)가 마지막이다. 심각도는 P2→P3 로 낮춘다. 지금 멈췄다는 증거가 없고, 데이터를 못 받거나 계산 시간을 넘기는 고장은 이미 tries→lastError 로 잡힌다. 못 잡는 것은 예약 자체가 안 도는 경우·KV 쓰기 실패·열쇠 불일치(전부 거절)뿐이다. 프로토타입 red-green: 수정 전에는 lastSlot·lastRun 이 undefined 로 ✕, 수정 후 ✓, 기존 verify-push-server 전부 통과.

수리 명세: ① server/push/worker.js. tick 이 예약으로 회차를 시작할 때 run.slot = slot.key 로 둔다(수동 /run 은 null). 회차가 정상으로 끝나는 두 자리(plan '알릴 거리 없음' · send finished)에서 clearRun 대신 finishRun(env, run, outcome) 을 부른다. finishRun 은 state:lastRun = {slot, startedAt, finishedAt, outcome:'nothing'|'sent', woke, dropped, sent, schools: 개수, wakeAll} 을 적은 뒤 clearRun 한다. 포기(tries≥5)는 지금처럼 lastError 만 적는다. /health 에 lastSlot(state:slot 값 그대로, 'YYYY-MM-DD#HH:MM' KST)과 lastRun 을 더한다. 기존 칸의 이름과 뜻은 유지한다(README·push-health 가 읽는다). KV 쓰기는 회차당 1건, 하루 2건 늘어난다. ② 판정을 tools/push-health-verdict.mjs 의 순수 함수 verdict({curlOk, code, json, now}) 로 옮기고, 명령줄로도 돌려 GITHUB_OUTPUT 에 verdict·why 를 적게 한다. .github/workflows/push-health.yml 은 그것을 부른다(체크아웃이 필요하다 — alerts 묶음 servers-F2 가 같은 파일에 넣는다). 판정 순서: down(curl 실패 또는 HTTP≠200) → misconfig(configured≠true) → error(lastError) → error(subs=-1) → outdated('lastSlot' 칸 자체가 없음 = 새 코드가 배포되지 않음) → stale(lastSlot 이 26시간보다 오래됨 = 두 회차 연속 시작 안 함 · 06:17 KST 확인의 정상 간격은 약 10시간) → error(lastRun.sent>0 이고 woke===0 → '깨우기를 보냈는데 한 대도 받지 않았다 — 열쇠(VAPID) 의심' · woke 는 푸시 서비스가 받아 준 수이지 도착 수가 아님을 문구에 적는다) → ok. lastSlot 값이 null(새 KV)이면 로그 경고만 한다. 🔴 '발송하지 않는다'(/health 만 읽음) 원칙과 라벨 중복 방지 · 정상이면 닫기 단계는 그대로 둔다. ③ server/push/README.md '/health 보이는 값' 표에 lastSlot·lastRun·pastError 행을 더한다.

관문: verify/health-gates/servers.mjs ③④. ③ 가짜 KV 와 표본 fetch(정식 1건 · 피드 0건)를 쓴다. Date.now 를 2026-10-04 08:10:30 KST 로 두고 tick 을 idle 이 될 때까지(한 번에 2분씩 옮기며) 돌린 뒤 /health 를 본다: lastSlot === '2026-10-04#08:10', lastRun.outcome === 'nothing'. ④ verdict 표본: 정상 → ok · now 10-04 06:17 KST 에 lastSlot '2026-10-03#08:10' → stale · lastSlot 칸 없음 → outdated · lastRun{sent:3, woke:0} → error · code 503 → down · configured:false → misconfig. fetch·Date.now 는 finally 로 되돌린다. red 증명: worker 를 되돌리면 ③ ✕(프로토타입 실측), verdict 의 stale 줄을 지우면 ④ 의 stale 표본이 ok 로 ✕.

소급: 없음(KV 상태). 배포 뒤 첫 08:10/20:10 회차부터 lastRun 이 생긴다. 확인은 다음 push-health 로그로 한다(샌드박스에서는 workers.dev 접속이 막혀 있다).

파일: server/push/worker.js server/push/README.md .github/workflows/push-health.yml tools/push-health-verdict.mjs verify/health-gates/servers.mjs

위험: 가동 중인 워커다(기본 브랜치에 push 하면 Workers Builds 가 바로 배포). push-health.yml 은 alerts 묶음(servers-F2 checkout 추가)과 같은 파일이라 한 사람이 같이 고치거나 차례를 정해야 한다. 배포가 06:17 확인보다 늦으면 첫날은 outdated 로 이슈가 하나 뜰 수 있다 — 기본 브랜치 push 뒤 Workers Builds 성공을 확인하고, 그래도 뜨면 다음 날 자동으로 닫힌다.

---
## [servers-F4] P3 · confirmed

이유: 코드로 확인했다. state:lastError 를 지우는 코드가 없다(grep: worker.js:274 쓰기, 390 읽기뿐). push-health.yml:63-69 은 lastError 가 있으면 error 로 판정하므로 '정상이면 옛 경보 이슈를 닫는다' 단계가 영영 돌지 않는다. server/push/README.md:137 절에 해소 방법이 없다. 프로토타입: lastError 를 넣은 뒤 정상 회차를 끝까지 돌려도 수정 전에는 /health.lastError 가 그대로였다(✕). 지금까지 33회 모두 null 이라 아직 일어난 적 없는 잠재 결함이므로 P2→P3 로 낮춘다.

수리 명세: F3 의 state:lastRun 을 이용한다. /health 는 lastError.at < lastRun.finishedAt 이면 lastError:null 을 내고 pastError 에 그 기록을 둔다. KV 에서 지우지 않는다 — 무엇이 있었는지는 계속 보인다. push-health 는 lastError 만 보므로 회복 뒤 저절로 ok 가 되고 옛 경보 이슈도 자동으로 닫힌다. README '`lastError`가 보이면' 절에 '그 뒤 회차가 끝까지 돌면 pastError 로 내려간다 · 강제로 지우려면 Cloudflare 대시보드 KV SUBS 의 state:lastError 삭제' 를 더한다. 바꾸지 말 것: 포기할 때 lastError 를 적는 것(조용한 중단 금지), verify-push-server.mjs [7] '사유를 남긴다' 검사.

관문: verify/health-gates/servers.mjs ⑤. 회차 전 시각의 lastError 를 넣으면 /health.lastError 가 있다 → 표본 회차를 끝까지 돌리면 lastError 는 null, pastError.at 는 그대로. 또 lastError.at 이 lastRun.finishedAt 보다 뒤면 lastError 가 계속 보인다. red 증명: worker 를 되돌리면 lastError 가 남아 ✕(프로토타입 실측).

소급: 없음(지금 lastError 는 null).

파일: server/push/worker.js server/push/README.md verify/health-gates/servers.mjs

위험: F3 과 같은 변경 묶음이다(lastRun 이 있어야 성립). 가동 중인 워커라는 주의도 같다.

---
## [servers-F8] P2 · confirmed

이유: 감시가 없다는 사실은 확인했다. supabase-config.js:28-29 에 url·anonKey 가 채워져 있다(로그인 켜짐). 그런데 .github·collector·tools 어디에도 supabase.co 를 부르는 곳이 없다(grep — verify-ui.yml:24 주석과 verify-supabase.js 의 시험 서버뿐). SESSIONS.md:2924 의 '무료 등급 7일 무활동 시 일시정지'는 경고이지 사고 기록이 아니다. docs/designs/data-flow.md §7 '어디가 끊기면' 표에 로그인 행이 없다. robot-heartbeat 는 예약 워크플로를 파일에서 읽으므로 새 워크플로를 따로 등록할 필요는 없다. 샌드박스에서는 *.supabase.co 가 CONNECT 403 이라 지금 살아 있는지는 확인하지 못했다(단정하지 않음). 요금 등급은 저장소에 기록이 없다.

수리 명세: ① tools/supabase-health.mjs. readSupabaseConfig(src) 가 supabase-config.js 를 vm 으로 읽어 {url, anonKey} 를 낸다(주소를 박아 두지 말 것 · 비어 있으면 'off' 로 조용히 끝). GET {url}/auth/v1/health 에 apikey: anonKey 를 실어 보내고, 20초 시한 · 3회 재시도(일시 장애에 경보가 울리지 않게). verdict({ok:boolean, code}) 순수 함수: 200 → ok · 401/403 → misconfig(열쇠 거절 — 바뀌었거나 프로젝트 문제) · 그 밖 → down(일시정지는 보통 여기). 명령줄로 돌리면 GITHUB_OUTPUT 에 verdict·why 를 적는다. 🔴 service_role 열쇠는 쓰지 않는다(공개 anonKey 만 · 시크릿 불필요). ② .github/workflows/supabase-health.yml. 매일 홀수 분(예: '41 21 * * *' = 06:41 KST — push-health 06:17 과 겹치지 않게) + workflow_dispatch. timeout-minutes 5 · permissions contents:read, issues:write · concurrency group supabase-health. 첫 단계 actions/checkout(robot-down 이 로컬 action 이라 필요) → node tools/supabase-health.mjs → 이상이면 라벨 supabase-health 이슈(열린 게 있으면 새로 만들지 않음) · 정상이면 열린 것 닫기 · 이상이면 실패로 남김 · failure()||cancelled() 면 ./.github/actions/robot-down(push-health 와 같은 꼴). 데이터를 쓰지 않으므로 deploy-sync·check-deploy-sync 목록은 고칠 필요 없다. ③ docs/designs/data-flow.md §7 표에 행을 더한다: '로그인 | 로그인·이어쓰기 실패 | `supabase-health.yml` 이슈 · Supabase 대시보드에서 일시정지 여부'. 백틱 안 경로는 실제로 있어야 한다(문서 관문).

관문: verify/health-gates/servers.mjs ⑨. readSupabaseConfig(표본 설정 글자 — url·anonKey 가 든 것과 빈 것) → url 이 나오거나 off. verdict 표본: 200 → ok · 401 → misconfig · 540 → down · 네트워크 실패 → down. 워크플로 정적 검사(코드이지 데이터가 아님): schedule cron 의 분이 홀수이고 0 이 아님, timeout-minutes 있음, `uses: ./.github/actions/robot-down` 보다 앞에 actions/checkout 이 있음. red 증명: 워크플로 파일을 지우거나 checkout 단계를 빼면 ✕, verdict 에서 401 줄을 지우면 misconfig 표본이 down 으로 ✕.

소급: 없음.

파일: tools/supabase-health.mjs .github/workflows/supabase-health.yml docs/designs/data-flow.md verify/health-gates/servers.mjs

위험: 이 확인 호출이 Supabase 의 '활동'으로 쳐져 휴면을 막는지는 공식 문서로 확인하지 않았다 — 감시(알림)로만 말하고 '휴면 방지'라고 쓰지 말 것(CLAUDE.md 매 세션 5). Supabase 쪽 일시 장애로 경보가 울릴 수 있어 재시도를 둔다.

---
## [servers-F10] P3 · confirmed

이유: 실제로 재현했다. sw.js 를 vm 에 싣고(self·registration·indexedDB 가짜) importScripts 가 던지게 한 뒤 push 이벤트를 보내면 'REJECTED: NOTIFY_RULES is not defined ; shown = []' — 알림이 0건이다. 이러면 크롬은 자체 문구를 띄우고, iOS 는 되풀이되면 구독을 끊을 수 있다. 332행만 `typeof NOTIFY_RULES !== 'undefined' && …` 로 바꾸면 같은 상황에서 'shown = ["한대장 · 새 장학 소식"]'. 다섯 파일이 정상으로 실릴 때도 정상으로 알림을 띄운다. backgroundCheck(222행)는 이미 typeof 로 지킨다. notify-rules.js:13 이 `var NOTIFY_RULES` 라서, 실리지 않으면 이름 자체가 없어 그 자리에서 던진다. 실제로 일어나는 길: 공용 파일 하나에 문법 오류(병합 충돌 표식 등)가 생기면 뒤의 notify-rules.js 가 안 실려 모든 푸시가 무음이 된다. 다른 세션이 sw.js 에서 바꾼 것은 CACHE 번호뿐이다.

수리 명세: sw.js:332 `if (NOTIFY_RULES && NOTIFY_RULES.shouldSelfUnsubscribe(rawLedger, ledgerRead))` 를 `if (typeof NOTIFY_RULES !== 'undefined' && NOTIFY_RULES.shouldSelfUnsubscribe(rawLedger, ledgerRead))` 로 바꾼다. 그 밖의 로직('껐다'와 '못 읽었다'를 구분, 알림 1건 필수)은 바꾸지 않는다. CACHE 번호는 관례대로 올리고 한 일을 남긴다(머리말 규칙). ci 묶음도 sw.js 를 고치므로 번호는 한 쪽이 몰아서 올린다.

관문: verify/health-gates/servers.mjs ⑩. sw.js 글자를 vm 에 싣는다. 가짜 self 는 addEventListener 를 모으고, registration.showNotification 은 기록하고, indexedDB 는 null 장부를 준다. (a) importScripts 가 던지게 하고 push 이벤트를 보내면 waitUntil 약속이 풀리고 showNotification 이 1회 불린다. (b) sw.js 에서 importScripts( … ) 목록을 정규식으로 읽어 그 순서대로 실제 파일을 실으면 NOTIFY_RULES·evaluate·noticeFilesForProfile 가 정의된다(서비스워커와 같은 실음 순서 검사). red 증명: typeof 를 되돌리면 (a) 가 거절되고 shown=[] 로 ✕(실측) · 목록에서 match-engine.js 를 빼면 (b) ✕.

소급: 없음 — sw.js 를 바꾸면 폰이 다음 실행에 새 서비스워커를 받는다.

파일: sw.js verify/health-gates/servers.mjs

위험: sw.js 는 ci 묶음도 고치는 파일이고 CACHE 줄은 늘 부딪히는 자리다 — 한 줄짜리 수정이니 마지막에 합친다.

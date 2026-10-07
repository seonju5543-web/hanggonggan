
### gate
- `node verify/audit-data.js`
  감사가 이제 활동 출처의 집계 사이트(link-fix.mjs AGGREGATOR_RE)까지 출처 규칙 전부를 '오류'로 본다(auditSourceFiles). 최신 데이터(collector/activity-sources.json·news-sources.json)에서도 exit 0 인지 확인한다. 걸리면 손으로 JSON 을 고치지 말고 관리자 화면 「활동」/「소식」 출처 보관(activitySource/newsSource park)으로 정리한다.
- `node verify/what-shows.mjs auto-notiphpcodes1301seq11193 --school=한국항공대학교`
  B1 — DAAD 「학사 및 석사과정 학생」 이 학부 3학년에게 '지원 자격 미달'이 아니라 '자격 미확인'으로 보이는지 main 배포 뒤 확인한다. 판정은 앱이 코드로 매번 다시 하므로 데이터 소급은 없다.
- `node verify/eligibility-report.mjs --bad`
  B1 규칙(UNDERGRAD_TOO 확장 · 'both' 갈래 남는 글자 잣대) 뒤 자격 줄 전수 재채점. 최신 데이터에서 전후 숫자가 같아야 한다(수리 시점 실측: 바뀐 조합은 DAAD 3건뿐).
- `(실행 없음 — 자가 치유) 다음 장학공고 수집 실행의 스키마화 단계`
  collect-13 — collector/pending-forms.json 의 고아 대기 항목(점검 때 71건)은 schematize-forms.mjs 가 pruneOrphans 로 스스로 정리한다. 손으로 지우지 말 것. collector/auto-held.json 도 첫 되돌림 때 gate-guard 가 만든다(손으로 만들지 말 것).

### feed
- `bash tools/robot-run.sh node collector/heal-feed.mjs --dry --since=0000-00-00 git:ab897c3b:data/notices/ git:60ce385a:data/notices.json`
  Preview the 9-30 merger-truncation restore (collect-01 · app2-F1). Run it only after the bundle is integrated with the default branch AND heal-feed.mjs calls stripSiteChrome where the collectors do (feed ⑤ stays red until then). Simulated on today's default-branch data: 242 rows to fill (224 also missing from the school files, 18 missing only from notices.json), in 19 schools (외대 36 · 경희 26 · 건국 23 · 서울과기 22 · …).
- `bash tools/robot-run.sh node collector/heal-feed.mjs --since=0000-00-00 git:ab897c3b:data/notices/ git:60ce385a:data/notices.json`
  The actual restore. It uses the robots' own function and order (60일·첨부 → dedupe → healFromLedger, which only adds rows, keeps the original foundAt, prefers the current school-file version and only adds what fits under the per-school cap → dropUnserved → publishBySchool → capNotices) and saves with JSON.stringify(x,null,1). Simulated: notices.json 402→643, school files 43. Known leftover after the restore: rows with javascript: attachments in school files go from 5 to 22 (서울과기 17, all truncated 'javascript:downloadfile(' from the old collector; plus 동국 WISE). resolveJsDownload cannot fix these (0/25 resolvable, simulated with the default branch's attachment-link.mjs). The fix is to re-read those originals the way 8cb1f746 did. Students see the attachment name with '원문 게시판에서 내려받기'; this is not a regression, because these rows were missing before.
- `node verify/audit-data.js`
  Must exit 0 before committing data/notices.json and data/notices/ (expect only the javascript: attachment warning to grow, not errors).

### browser
- `ACTION=activitySource ACTOR=claude-health-sweep PAYLOAD='{"op":"park","boardUrl":"https://www.gov.kr/portal/cnstexhb"}' node tools/admin-apply.mjs`
  api-09 결정 — robots.txt 가 사이트 전체를 막은(Disallow: /) 정부24 공모전 출처를 지우지 않고 보관. 관리자 버튼과 같은 길이라 data/admin-log.json 에도 기록된다(그래서 브랜치에서 손으로 안 함). 저장소 뿌리에서 · 최신 기본 브랜치에서 실행. 임시 복사본에서 exit 0 확인.
- `ACTION=activitySource ACTOR=claude-health-sweep PAYLOAD='{"op":"park","boardUrl":"https://www.kocca.kr/kocca/pims/list.do?menuNo=204104"}' node tools/admin-apply.mjs`
  api-09 결정 — robots.txt 가 /kocca/*/list.do 를 막은 한국콘텐츠진흥원 출처 보관(1a09466c 가 별표 해석을 고친 뒤에도 ⛔). 임시 복사본에서 exit 0 확인.
- `ACTION=activitySource ACTOR=claude-health-sweep PAYLOAD='{"op":"park","boardUrl":"https://www.youthcenter.go.kr/bbs03List/48"}' node tools/admin-apply.mjs`
  api-09 결정 — 온통청년 청년참여 게시판(48)은 공공 API 청년콘텐츠가 같은 게시판을 받는다(open-api-map.mjs bbs03View/48) · 일반 수집은 10-05 에도 🟡 0건이라 중복 출처를 보관. 임시 복사본에서 exit 0 확인. 세 명령 모두 collector/activity-sources.json 과 data/admin-log.json 을 쓴다 — 커밋할 때 둘 다 add.

### qnotice
- `bash tools/robot-run.sh node collector/auto-register.mjs`
  collect-07 + R2: removes the robot items whose deadline had already passed when they were registered (20 on today's data) and creates the past-round ledger collector/past-rounds.json, so the same program posted at other schools (e.g. 부산·동국 K-원전) is held for confirmation. The next scheduled collect run does the same.
- `bash tools/robot-run.sh node collector/extract-excerpts.mjs --write`
  app1-04: clears the three backup-email fields on 고려대 송화재단 (deadline 10-12) and 연세대 신문고 (deadline 10-13), which are urgent. app1-11: fills applyPortal KUPID with source text on 3 고려대 items. Saved with JSON.stringify(x,null,1).
- `node verify/test-collector.mjs && node verify/audit-data.js`
  Data gate after the two steps above. Confirmed green on a temp copy run in the same order, except 2 failures caused only by the sim setup.
- `node collector/build-search-index.mjs`
  app1-05: rebuilds data/search-index.json without menu words, other notices' titles or previous/next-post lines. Check the printed size against the 120KB budget. search-index.yml also rebuilds it after each collect run.

### qfeeds
- `node tools/refilter-feeds.mjs && node tools/refilter-feeds.mjs --write`
  collect-09/api-01/app2-F6 + api-06 소급 on fresh data, no site fetch. It applies to data/external.json fillDeadlineFromHint → tidyExternal → dropReason with KST today (today: 48→39 — 마감 지남 8 + [마감] 1, 2 deadlines filled) and runs sanitizeElig over data/activities.json (today: 2 posts). Saves as JSON.stringify(x,null,1). Optional: the next scholarship collect run does the same by itself. Then run node verify/audit-data.js; the 'external — 지금 규칙이면 빠질 글' warning should be gone. Can be wrapped as bash tools/robot-run.sh node tools/refilter-feeds.mjs --write.
- `ACTION=newsHide ACTOR=<이름> PAYLOAD='{"urls":["https://www.knu.ac.kr/wbbs/wbbs/bbs/btin/viewBtin.action?bbs_cde=28&btin.bbs_cde=28&btin.doc_no=1338474&btin.appl_no=000000&btin.page=1&btin.search_type=&btin.search_text=&popupDeco=&btin.note_div=row&menu_idx=214","https://www.knu.ac.kr/wbbs/wbbs/bbs/btin/viewBtin.action?bbs_cde=28&btin.bbs_cde=28&btin.doc_no=1338469&btin.appl_no=000000&btin.page=1&btin.search_type=&btin.search_text=&popupDeco=&btin.note_div=row&menu_idx=214","https://www.knu.ac.kr/wbbs/wbbs/bbs/btin/viewBtin.action?bbs_cde=28&btin.bbs_cde=28&btin.doc_no=1338438&btin.appl_no=000000&btin.page=1&btin.search_type=&btin.search_text=&popupDeco=&btin.note_div=row&menu_idx=214","https://www.knu.ac.kr/wbbs/wbbs/bbs/btin/viewBtin.action?bbs_cde=28&btin.bbs_cde=28&btin.doc_no=1338436&btin.appl_no=000000&btin.page=1&btin.search_type=&btin.search_text=&popupDeco=&btin.note_div=row&menu_idx=214","https://www.knu.ac.kr/wbbs/wbbs/bbs/btin/viewBtin.action?bbs_cde=28&btin.bbs_cde=28&btin.doc_no=1338432&btin.appl_no=000000&btin.page=1&btin.search_type=&btin.search_text=&popupDeco=&btin.note_div=row&menu_idx=214"]}' node tools/admin-apply.mjs`
  news-4: the 5 경북대 포토뉴스 posts in data/news/nf097dk.json were published before posts carried a board key (src), so dropRetiredBoards cannot judge them. This hides them by the same path as the admin button: hidden marks, news-config.json hideUrls, one admin-log line. newsFloor does not count hidden posts, and they expire after 30 days. Check first that they are still in nf097dk.json; if not, the command fails with '그 주소의 글이 소식 파일에 없습니다', which is harmless. data/admin-log.json may conflict with 08f663d7.

### links
- `cd /home/user/hanggonggan && node -e "const r=require('./data/registered.json');process.exit(r.items.some(i=>i.id==='auto-hkrwdsfpnos1073sfpnos888'&&/jsessionid/i.test(i.sourceUrl||''))?0:1)" && ACTION=edit ACTOR=links-backfill PAYLOAD='{"edits":[{"id":"auto-hkrwdsfpnos1073sfpnos888","patch":{"sourceUrl":"https://www.kyonggi.ac.kr/www/selectBbsNttView.do?key=7520&bbsNo=1073&nttNo=626271&pageUnit=10&searchCnd=WRTER&searchKrwd=%ec%9e%a5%ed%95%99&sf.pnos=1073&sf.pnos=888"}}]}' node tools/admin-apply.mjs && node verify/audit-data.js`
  links-7 소급. 정식 등록 auto-hkrwdsfpnos1073sfpnos888(경기대 · 마감 10-08)의 sourceUrl 에 아직 ';jsessionid=…' 가 붙어 있다(10-04 데이터에서 읽기만 해서 확인함). 정식 등록은 로봇이 다시 만들지 않으므로 관리자 길(admin-apply edit)로 세션 없는 주소로 바꾼다. 앞의 node -e 는 등록분이 아직 있고 세션 표식이 남아 있을 때만 이어 간다(이미 고쳐졌거나 마감+30일 정리로 빠졌으면 건너뜀). id 는 바뀌지 않는다(공식 불변 · 관문 ② 가 경기대 표본으로 잰다). 피드 공고 2건(nttNo 626377·626271)은 다음 수집이 같은 열쇠로 합치면서 세션 없는 판이 이겨 스스로 고쳐지므로 손대지 않는다. R1~R3 은 소급할 데이터가 없다: 실제 설정에는 아직 꼬리표 id 차단이 없고, 바뀐 사냥꾼 문구도 아직 실행된 적이 없다.

### insta
- `node insta/ledger.mjs expire`
  선택 사항(앞 수리의 소급 · 그대로 유효). 다음 인스타 준비 실행(수집 로봇이 끝날 때마다 · 늦어도 매일 09:13 KST)의 '마감 지난 카드 정리' 단계가 스스로 한다. 마감 지난 준비·건너뜀·실패 카드를 expired 로 바꾸고(이번 수리로 expiredFrom 도 남긴다) 폴더를 지운다. 올린 것과 폴더 이름 꼴이 아닌 코드는 지우지 않는다. 바로 줄이려면 최신 기본 브랜치에서 `bash tools/robot-run.sh node insta/ledger.mjs expire` 로 돌리고 insta/seen.json·insta/pub 을 커밋한다. 이번 수리에는 따로 고칠 데이터가 없다 — 병합 규칙·장부 줄 모양·주소 시한은 다음 실행부터 저절로 적용된다.

### refresh
- `(없음 — 데이터는 다음 로봇 실행이 스스로 맞춘다) 확인만: 다음 한국장학재단 수확(월·목 05:53 KST) 뒤 collector/kosaf-attach-report.md 의 '이미 있던 것' 이 0곳이 아니라 60곳 안팎인지 본다`
  KOSAF-01 — mirrorMatches 가 옛 장부(from = 주소 전체)도 열쇠로 풀어 비교하므로 손으로 고칠 장부가 없다. 실측(명세) 09-30→10-02 은 79/79 가 같은 열쇠다.
- `node -e "const fs=require('fs');const P='docs/designs/assets/gates/school-photo-picks.json';const p=JSON.parse(fs.readFileSync(P,'utf8'));const m=JSON.parse(fs.readFileSync('docs/designs/assets/gates/manifest.json','utf8'));const t=new Map();for(const s of m.schools||[])for(const f of s.files||[])t.set(f.file,f.title);let n=0;for(const [k,l] of Object.entries(p.schools))p.schools[k]=l.map(x=>{if(x.title||!t.get(x.file))return x;n++;const o={};for(const [a,b] of Object.entries(x)){o[a]=b;if(a==='file')o.title=t.get(x.file);}return o;});fs.writeFileSync(P,JSON.stringify(p,null,1));console.log('title 붙임',n);"`
  GATE-02 소급은 이 브랜치 커밋 854b2a4c 에 이미 들어 있다(46/46). 합치기 전에 다른 세션이 title 없는 pick 을 더했을 때만 돌린다. 이미 title 이 있으면 덮지 않는다. 단, 그 pick 이 그 파일의 마지막 재수집 뒤에 골라졌을 때만 안전하다(아니면 빌드가 멈추는 것이 맞다). 돌린 뒤 sharp 를 넣고 node tools/build-school-photos.mjs 를 실행해 problems 0 이고 assets/schools 에 diff 가 없는지 확인한다.

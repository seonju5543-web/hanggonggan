export const meta = {
  name: 'robot-tool-diagnose',
  description: '한대장 로봇 39개 워크플로와 앱 안 도구를 무리별로 읽기 전용 진단',
  phases: [
    { title: 'Diagnose', detail: '무리별 진단(Actions 기록·경보 이슈·코드·로컬 관문)' },
    { title: 'Gaps', detail: '빠진 대상 점검(완전성 비평)' },
  ],
}

const SCRATCH = '/tmp/claude-0/-home-user-hanggonggan/409b9928-bac2-5670-b5b4-24e2b322cd7b/scratchpad'

const PREAMBLE = `You are diagnosing ONE group of robots/tools in the 한대장 repo (/home/user/hanggonggan, GitHub seonju5543-web/hanggonggan). Today is 2026-10-03 (UTC) = 2026-10-04 early morning KST. HEAD = b71da694; default branch claude/nice-heisenberg-WESq5 == main == HEAD.

GOAL: for every workflow/script/tool in your group decide whether it is actually doing its job right now. Find what is broken, silently degraded, or about to break, WITH root cause. DIAGNOSIS ONLY.

HARD RULES (read-only):
- Do NOT edit/create/delete any file inside /home/user/hanggonggan. Do NOT git commit/push/checkout/reset/stash in the main checkout. Do NOT trigger workflows (never call actions_run_trigger), do NOT comment on / close / open GitHub issues.
- Scratch files only under ${SCRATCH}/<your-group-key>/.
- If you must execute a robot script to reproduce something, do it ONLY in your own throwaway worktree: git -C /home/user/hanggonggan worktree add ${SCRATCH}/<your-group-key>/wt HEAD --detach ; and remove it at the end with git -C /home/user/hanggonggan worktree remove --force <path>. Never run robots in the main checkout (they write data/ and ledgers). Never import collector/auto-register.mjs, collector/schematize-forms.mjs or collector/majors.mjs (they execute on import).
- The sandbox network blocks many hosts (school sites, github.io, google, jsdelivr). A fetch failure from this sandbox is NOT evidence the robot fails in GitHub Actions. Actions logs are the ground truth for network behaviour.
- CLAUDE.md rule 5: never state an unverified cause as fact. Quote the log line / code line you rely on and set confidence honestly.

HOW TO CHECK (do all that apply):
1. GitHub Actions history via MCP (load tools with ToolSearch query "select:mcp__github__actions_list,mcp__github__actions_get,mcp__github__get_job_logs,mcp__github__list_issues,mcp__github__issue_read"). owner=seonju5543-web repo=hanggonggan. For each workflow of your group: actions_list method=list_workflow_runs resource_id=<file>.yml perPage=15 → conclusion pattern, event (schedule/push/dispatch), branch, duration, last success. For failed/cancelled runs: get_job_logs run_id=<id> failed_only=true return_content=true tail_lines=200 and find the REAL error. For "success" runs, also check list_workflow_jobs (steps) — a failed step hidden by continue-on-error, or a run that produced 0 results, is a silent failure. Scheduled workflows only run on the default branch; runs on other branches are usually push-to-run noise unless they wrote data.
2. Robot reports: GitHub issues the robot opened (list_issues / issue_read incl. comments) and the report/ledger files in collector/ (report .md files, health.json, news-health.json, rescue-ledger.json, link-check-state.json ...). Look for ❌ / 🚨 / 0건 / 시간 초과 / 본문 없음 / 취소 patterns and whether they repeat.
3. Code: read the workflow yml and its scripts. Check timeout-minutes on job and steps; continue-on-error on enrichment steps; failure alert with if: failure() || cancelled(); git add of every file the robot writes; push retry; concurrency group; cron not on the hour; budget logic; push-trigger branches filter for push-to-run robots that save; data gate (test-collector + audit) before save. Look for real bugs (wrong paths, renamed functions, missing files, impossible regexes, wrong env names, secrets referenced but absent, etc.).
4. Recent history: git log --since=2026-09-25 --format='%h %ad %s' --date=iso -- <files>. Was a failure already fixed by a commit after the failing run? If fixed AND a later run succeeded → fixType none-already-fixed. If fixed but no run since → say "수정은 들어갔으나 아직 실행으로 증명 안 됨".
5. Local offline checks allowed in the main checkout (they don't write): node --check <file>; reading ${SCRATCH}/test-collector.log (the orchestrator already ran node verify/test-collector.mjs: ALL PASS, exit 0 — do not re-run it); node verify/audit-data.js (passes exit 0); tiny scratch scripts importing pure modules to test a hypothesis.

Severity: P0 = students currently see wrong/missing data, or a core app tool is broken; P1 = a robot/tool fails repeatedly or silently does nothing, or an alarm that should fire does not; P2 = intermittent failures, noisy/duplicate alarms, stale issues that should auto-close, waste of budget; P3 = cleanup.
fixType: code / workflow-yaml / data / config / secret-or-external (needs a GitHub secret, API key, external service — a human must act) / human-decision / none-already-fixed.

Write every human-readable field (title, symptom, rootCause, proposedFix, evidence, inventory evidence, notes) in Korean. Put run URLs / issue numbers / file:line in evidence. The inventory MUST list every workflow and main script/tool named in your group, each with a status. Be thorough: this is the developer's "대대적 점검".`

const FINDINGS = {
  type: 'object',
  properties: {
    group: { type: 'string' },
    inventory: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          kind: { type: 'string' },
          status: { type: 'string', enum: ['healthy', 'degraded', 'broken', 'unknown', 'retired'] },
          lastRuns: { type: 'string' },
          evidence: { type: 'string' },
        },
        required: ['name', 'status', 'evidence'],
      },
    },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          severity: { type: 'string', enum: ['P0', 'P1', 'P2', 'P3'] },
          components: { type: 'array', items: { type: 'string' } },
          symptom: { type: 'string' },
          evidence: { type: 'string' },
          rootCause: { type: 'string' },
          confidence: { type: 'string', enum: ['confirmed', 'likely', 'guess'] },
          proposedFix: { type: 'string' },
          files: { type: 'array', items: { type: 'string' } },
          fixType: { type: 'string', enum: ['code', 'workflow-yaml', 'data', 'config', 'secret-or-external', 'human-decision', 'none-already-fixed'] },
          alreadyFixedBy: { type: 'string' },
        },
        required: ['id', 'title', 'severity', 'symptom', 'evidence', 'rootCause', 'confidence', 'proposedFix', 'fixType'],
      },
    },
    notes: { type: 'string' },
  },
  required: ['group', 'inventory', 'findings'],
}

const DRIVER_RECIPE = (port, extra) => `Browser driver recipe (drivers are CI gates in .github/workflows/verify-ui.yml): start YOUR OWN static server from the repo root: cd /home/user/hanggonggan && python3 -m http.server ${port} >/dev/null 2>&1 & SRV=$! ; sleep 1 ; then for each driver: NODE_PATH=/opt/node-tools/node_modules CHROME_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome PORT=${port} timeout 300 node verify/<driver> ; finally kill $SRV (never pkill -f — it can kill your own shell). Use ONLY port ${port} for PORT. ${extra} Read each driver's header first for other env vars it needs. Proxy noise lines ("[agent-proxy] ... connect_rejected") are sandbox noise, not failures. A driver failing locally must be re-checked against the latest verify-ui.yml run in Actions before you call it broken (it may be a sandbox-only issue, e.g. blocked CDN).`

const GROUPS = [
  { key: 'collect', title: '장학공고 수집 로봇', prompt: `GROUP: 장학공고 수집 로봇 (key collect).
Workflows: collect-scholarships.yml (장학공고 수집 로봇, 하루 3회), audit-coverage.yml (공고 누락 감사, 주 1회).
Scripts: collector/collect.mjs, harvest-budget.mjs, fetch-board.mjs, auto-register.mjs (+auto-register-config.json), kind-classify.mjs, kind-evidence.mjs, scope-promote.mjs, registered-merge.mjs, publish-notices.mjs, extract-excerpts.mjs, revert-auto.mjs, audit-coverage.mjs, prune-health.mjs, activity split inside collect (activity-kind.mjs, activity-excerpts.mjs), external boards if collect.mjs does them (external-sources.json → data/external.json).
Ledgers: collector/health.json, collect-cursor.json, seen.json, report.md, coverage-report.md.
Recent robot reports: issues #380 (10-03), #367 and #365 (10-02), #357, #349, #347, #344 (10-01).
Questions: Which of the 44 served schools (collector/schools.json; match-engine.js SERVED_SCHOOLS) fail repeatedly (health.json) and why? Are schools starved by the 8-minute budget/cursor rotation? Do auto-register / kind-classify / scope-promote steps actually run and succeed? Did the data gate revert anything recently? Is data/external.json fresh? Are schools.json, browser-targets.json and SERVED_SCHOOLS consistent (44)?` },
  { key: 'browser', title: '브라우저형 수집 로봇', prompt: `GROUP: 브라우저형 수집 로봇 (key browser).
Workflow: browser-collect.yml (하루 2회). Scripts: collector/browser-collect.mjs, browser-targets.json, browser-cursor.json, browser-report.md, harvest-budget.mjs, and anything it imports.
Recent reports: issues #381 (10-03), #368, #366 (10-02), #346, #340 (10-01), #333.
Questions: which browser targets fail repeatedly and why (the report includes frame/click/seen-text diagnostics); are results saved and published; does it finish inside its budget; any step silently failing; are schools with collector:"browser" in schools.json all covered by browser-targets.json?` },
  { key: 'bodies', title: '본문·자격요건 로봇', prompt: `GROUP: 본문·자격요건 로봇 (key bodies).
Workflows: rescue-bodies.yml (자격요건 로봇 (진짜 브라우저) — heartbeat issue #385 at 2026-10-03 13:34Z said its last success was 85.7h ago although expected daily; failure issues #378 (10-03) and #361 (10-02). The yml was changed at 2026-10-03T17:23Z: inspect git log of it and of collector/rescue-bodies.mjs / activity-docs.mjs and whether any run after that change succeeded), deep-fetch.yml (공고 원문 심층 수집, push-to-run via collector/run-deepfetch.txt), eligibility-fill.yml (자격요건 매칭 · AI 자격 읽기).
Scripts: collector/rescue-bodies.mjs, deepfetch.mjs, activity-docs.mjs, eligibility-ai.mjs (+eligibility-ai-config.json), notice-source.mjs (MIN_BODY), html-text.mjs, page-boilerplate.mjs, attachment-text.mjs, pdf-text.py/.mjs, hwp-bodytext.py, hwp-prvtext.py, ocr-text.py, paddle-ocr.py, rescue-ledger.json, rescue-report.md, act-docs.json.
Specific question: issue #378 lists 경희대 '공통' notices marked '본문 없음 (4회째/7회째)' whose page is only title + attachments (the real body is inside the attached hwp/pdf). Is the robot stuck retrying such notices forever, wasting its 25-item budget? Is the attachment text then used for eligibility? Also: why were runs cancelled/timed out (85.7h with no success)?` },
  { key: 'links', title: '원문 링크 로봇들', prompt: `GROUP: 원문 링크 로봇들 (key links).
Workflows: resolve-detail-urls.yml (원문 링크 복구 로봇 — issue #386 robot-down 2026-10-03 17:36Z, run https://github.com/seonju5543-web/hanggonggan/actions/runs/37141082198), link-hunter.yml (링크 사냥꾼, daily; issues #387, #382, #379, #363 '원문 주소를 3회 못 찾은 공고'), link-check.yml (원문 링크 확인 로봇 — new 2026-10-03: collector/link-check.mjs, link-landing.mjs, link-check-plan.mjs, link-check-state.json, data/link-check.json), probe-links.yml (링크 정찰), probe-boards.yml (게시판 후보 정찰, run-probe.txt), fetch-page.yml (페이지 원격 열람).
Scripts: resolve-detail-urls.mjs, resolve-report.md, resolved-urls.json, link-hunter.mjs, link-hunt.json, link-hunt-report.md, probe-links.mjs, probe.mjs, detail-url.mjs, canon-url.mjs, url-key.mjs, source-link rules (source-link.js), verify/link-audit.cjs.
Context (CLAUDE.md): on 2026-10-03 a patrol overwrote 5 good URLs with list markers → patrol turned off; robots that fix URLs must never overwrite a real URL (preferNotice). Verify the patrol is really off everywhere, find the real root cause of the resolve-detail-urls failure, judge whether the link-hunter's '3회 못 찾음' issues are piling up (one new issue per day instead of updating one?), and check push-to-run robots have branches: filters on push triggers.` },
  { key: 'news', title: '교내 소식 로봇', prompt: `GROUP: 교내 소식 수집 로봇 (key news).
Workflow: collect-news.yml (교내 소식 수집 로봇, expected 하루 2회). BUT GitHub shows SEVEN issues '🗞 교내 소식 수집 리포트 2026-10-03 (새 글 0건)' (#372–#377) created within ~4 hours on 10-02/10-03 UTC, plus ~10 report issues on 10-01 (#348, #351–#355, #358–#360, #364, #369–#371): find out why runs happen so often (push trigger on run-news.txt? on every commit? workflow_dispatch by sessions? concurrency?) and why each run opens a NEW issue instead of commenting on / updating one (CLAUDE.md: '새 공고 0건이면 이슈 대신 코멘트'). Are old news report issues ever closed (close-old-reports.yml)?
Scripts: collector/collect-news.mjs, find-news-boards.mjs, news-kind.mjs, news-board-rules.mjs, collect-news-thumbs.mjs, news-thumb.mjs, news-sources.json, news-health.json, news-cursor.json, news-config.json, news-thumbs.json, news-report.md, news-thumbs-report.md, find-news-boards-report.md, data/news/*.json, data/news/img/.
Also: how many of the 44 schools yield 0 rows repeatedly (news-health.json) and why; thumbs step health; are data/news files reaching main (deploy-sync).` },
  { key: 'api', title: '대외활동·공공 API·재단 게시판', prompt: `GROUP: 대외활동·공공 API·재단/지자체 게시판 (key api).
Workflow: open-api.yml (공공 API 로봇 — issue #356: K-Startup and 1365 'fetch failed', 온통청년 keys missing; READ ITS COMMENTS too), collector/open-api.mjs, open-api-map.mjs, open-api-report.md, run-open-api.txt.
Activities pipeline: collector/activity-kind.mjs, activity-excerpts.mjs, activity-sources.json, activity-config.json, seen-activities.json, data/activities.json, act-docs.json / act-browser.json merge (done in collect.mjs), robots.mjs.
재단·지자체 게시판: collector/external-sources.json, find-boards.mjs (+find-boards-report.md), board-links.mjs, external-clean.mjs, seen-external.json, data/external.json.
Questions: Is 'fetch failed' in Actions a DNS/TLS/IPv6/geo-block/certificate issue? (look at error cause codes in the logs of the latest runs; the test-collector log mentions '공공 API — 다시 묻기 전 10초·40초 쉰다 · 실패 원인 코드를 적는다 · 하루 두 번(백업)' so retries were added recently — did the latest runs succeed?) Are the missing YOUTHCENTER keys a human action (GitHub secrets)? Are data/activities.json and data/external.json growing and fresh (dates of newest items, counts by source)? Any source silently returning 0 rows?` },
  { key: 'refresh', title: '데이터 갱신 로봇들', prompt: `GROUP: 데이터 갱신 로봇들 (key refresh).
Workflows: kosaf-fetch.yml (한국장학재단 수확, 주 2회: collector/kosaf-fetch.mjs, kosaf-open.mjs, kosaf-attach.mjs, kosaf-check.mjs, kosaf-session.mjs, kosaf-empty.mjs, kosaf-detail-loss.mjs, kosaf-block.json, data/kosaf-open.json, data/kosaf-files/), refresh-majors.yml (학과 목록: collector/majors.mjs — DO NOT import it, it calls the API on import — publish-majors.mjs, data/majors/), refresh-tuition.yml (등록금: fetch-tuition.mjs, fetch-tuition-field.mjs, data/tuition.json), search-index.yml (검색용 요약: build-search-index.mjs, run-search-index.txt), essay-playbook.yml (작성 규칙 학습: essay-playbook-learn.mjs, essay-house-mine.mjs, essay-rule-line.mjs, issue #342), gate-photos.yml (정문 사진: tools/fetch-gate-photos.mjs, tools/run-gate-photos.txt, tools/build-school-photos.mjs), two-school-scan.yml (두 학교 장학 공고 전수 조사 (일회용) — should it still be active/scheduled?).
For each: schedule (cron) vs actual runs, last success, output freshness (git log of its output files), failure root causes, secrets referenced.` },
  { key: 'ops', title: '배포·감시·운영 로봇', prompt: `GROUP: 배포·감시·운영 (key ops).
Workflows: deploy-sync.yml, main-guard.yml, device-deploy.yml (issue #274 '이 기기에서 배포 실패' open since 09-14, updated 10-01 — is it still failing or stale?), check-live.yml (issue #350 '앱 반영 점검 실패' 10-01 — still failing? does it check every file the app fetches per CLAUDE.md?), robot-heartbeat.yml (+collector/robot-heartbeat.mjs — issue #385; verify its expectations table vs actual cron lines in every scheduled yml: are ALL scheduled workflows included (link-check, open-api, collect-news, rescue-bodies twice a day now?, essay-playbook, gate-photos...) with correct intervals?), close-old-reports.yml (there are 182 OPEN issues, many old robot reports e.g. 교내 소식 리포트 from 10-01, 브라우저형 리포트, 장학공고 리포트, 인스타 insta-ready, 링크 사냥꾼 — which kinds does it close and which does it miss?), update-progress.yml (+tools/notion-status.mjs; run 771 cancelled — concurrency?), admin-lock-check.yml, verify-ui.yml (the CI gate — check its recent runs on main and default branch for red), pages-build-deployment (dynamic).
Also run node verify/check-deploy-sync.js and node verify/check-collab.js --brief (read-only).` },
  { key: 'insta', title: '인스타 로봇', prompt: `GROUP: 인스타 로봇 (key insta).
Workflows: insta.yml (카드뉴스 게시/준비, daily), insta-comments.yml (댓글 관리, 하루 8회), insta-samples.yml (판형 견본), insta-stats.yml (트랙션 수확, daily), insta-token-check.yml (토큰 수명, daily).
Code: insta/*.mjs (publish.mjs, render.mjs, pick.mjs, notices.mjs, mail.mjs, comments.mjs, stats.mjs, token-days.mjs, ledger.mjs, sweep-overflow.mjs ...), insta/README.md, docs/designs/instagram-pipeline.md, verify/verify-insta.js.
CLAUDE.md: token renewal ~2026-11-12 — read insta/token-seen.json and the latest insta-token-check run log rather than calling the API. Issues labelled insta-ready (#362, #345, #343, #341, #339) — are they piling up because a human must press publish (expected by design: 게시는 사람만 누른다) or because something broke? Does the publish path work when pressed? Run node verify/verify-insta.js (check it is read-only first).` },
  { key: 'servers', title: '푸시·서버', prompt: `GROUP: 푸시·서버 (key servers).
Workflows: push-check.yml (상태 + 시험 발송), push-health.yml (발송 없음, daily), essay-smoke.yml (초안 서버 실물 확인).
Code: server/push/worker.js, server/chat/worker.js, server/essay/worker.js (+draft-guard.mjs, smoke.mjs), server/apply/ (worker.js, apply-guard.mjs, send-log.mjs), server/mail-worker.js, each wrangler.toml/README; client: push-config.js, notify.js, sw.js push handler, chat-config.js, essay-config.js, supabase-config.js, support-config.js.
Run the pure gates (read-only): node verify/verify-push-server.mjs ; node verify/verify-apply-guard.mjs ; node verify/verify-essay-submit.mjs ; node verify/verify-essay-guard.mjs ; node verify/verify-notify-rules.js .
Determine which servers are deployed/live (config files non-empty, health runs green) vs '배포 대기' by design, and whether the scheduled health checks are passing. A switch that is empty by design (feature off) is NOT a bug — say so in inventory with status healthy/retired and explain.` },
  { key: 'app1', title: '앱 도구 ① 신청·양식·초안·도우미', prompt: `GROUP: 앱 안 도구 ① (key app1): 신청 플로우·접수 채널 (apply-channel.js: mailto 메일 접수, findApplyPortal 포털 딥링크), 양식 (forms.js, form-plan.js, data/forms.json), AI 초안 (essay.js, essay-ask.js, essay-quality.js, essay-submit-check.js), 도우미 (chat.js), 자격 묻기 (elig-ask.js), 원문 링크 (source-link.js), 일괄 신청 준비, 적합도 배지, 탐색 정렬, 층2(KOSAF) 카드.
Run these drivers: verify-registered.js verify-chat.js verify-apps-manage.js verify-essay-ui.js verify-forms-data.js verify-new-forms.js verify-source-links.js verify-elig-ask.js verify-apply-prep.js verify-sheet-back.js verify-kosaf.js verify-fit-badge.js verify-explore-sort.js ; plus node verify/form-snapshot.mjs and node verify/verify-essay-ask.mjs (check whether it needs a server).
${DRIVER_RECIPE(8781, 'If a driver starts its own extra server via another env var, give it a port in 8782..8789.')}
Also check the latest verify-ui.yml runs in Actions. Beyond drivers, statically review these tools for bugs: buttons wired to undefined functions, config switches, mailto building, portal deep links, form rendering for every formId referenced from data/registered.json (does each formId exist in forms.json?), 'node verify/what-shows.mjs' on 2-3 sample notices to see what students see.` },
  { key: 'app2', title: '앱 도구 ② 알림·달력·동기화·화면', prompt: `GROUP: 앱 안 도구 ② (key app2): 알림 (notify.js, notify-rules.js, sw.js), 달력·저장, 로그인·기기 동기화 (supabase-client.js), 설정·휴지통·약관, 첫 실행·이어보기 (boot.js, resume.js), 손짓 (interactions.js), 대외활동 탭·교내 소식·재단 새 공고 화면, 온보딩·지역·학과 목록 받기 (majorsFileFor, noticeFilesForProfile).
Run these drivers: verify-push-client.js verify-notify.js verify-calendar.js verify-resume.js verify-interactions.js verify-settings.js verify-supabase.js verify-activities.js verify-news.js verify-region-city.js verify-onboard-gaps.js ; plus node verify/ui-tone.mjs and node verify/verify-notify-rules.js.
${DRIVER_RECIPE(8791, 'If a driver starts its own extra server via another env var, give it a port in 8792..8799.')}
Also check the latest verify-ui.yml runs in Actions. Beyond drivers, statically check: every data file the app fetches exists in the repo with the name match-engine.js computes (school notice files data/notices/*.json, majors files, data/news/<key>.json, data/activities.json, data/external.json, data/link-check.json, assets/schools/photos.json) for all 44 served schools — a 404 is silent in the app (CLAUDE.md). Write a scratch node script for that check (read-only).` },
  { key: 'admin', title: '관리자 화면·조정', prompt: `GROUP: 관리자 화면·조정 (key admin).
Code: _admin/ (index.html, admin.js, admin.css, build.sh, _headers, README.md), tools/admin-apply.mjs, tools/edit-diff.mjs, tools/build-admin-preview.mjs. Workflows: admin-apply.yml (관리자 조정 — the buttons' backend; check recent runs, failures and their causes), admin-lock-check.yml (daily Access lock check).
Drivers: verify-admin.js (uses ADMIN_PORT, default 8131 — set ADMIN_PORT=8801), verify-admin-shape.js, verify-admin-vendor.js. Read each header for its env/ports (use 8801..8809 only). Use NODE_PATH=/opt/node-tools/node_modules CHROME_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome. NOTE: bash _admin/build.sh writes dist/ — if a driver runs build.sh itself, run that driver inside a throwaway worktree (git worktree add ... HEAD --detach) instead of the main checkout.
Also: enumerate every ACTION type tools/admin-apply.mjs supports and every button in admin.js that dispatches one; check they match (no button sending an action the backend doesn't know, no ELIG_KEYS drift between admin-apply.mjs and edit-diff.mjs). Optionally simulate 2-3 actions in a throwaway worktree (ACTION=... ACTOR=test PAYLOAD=... node tools/admin-apply.mjs) and inspect git diff there, then remove the worktree.` },
]

phase('Diagnose')
const results = await parallel(GROUPS.map(g => () =>
  agent(`${PREAMBLE}\n\n${g.prompt}`, { label: `diag:${g.key}`, phase: 'Diagnose', schema: FINDINGS })
    .then(r => r ? { ...r, group: g.key } : null)
))

const ok = results.filter(Boolean)
const missing = GROUPS.filter((g, i) => !results[i]).map(g => g.key)
if (missing.length) log(`진단 실패 무리: ${missing.join(', ')}`)

phase('Gaps')
const inventorySummary = ok.map(r => `[${r.group}] ` + r.inventory.map(i => `${i.name}=${i.status}`).join('; ')).join('\n')
const findingTitles = ok.flatMap(r => r.findings.map(f => `[${r.group}/${f.id}/${f.severity}] ${f.title}`)).join('\n')
const gaps = await agent(`${PREAMBLE}\n\nGROUP: 완전성 비평 (key gaps). Other agents diagnosed the groups below. Your job: find what NOBODY covered or left as 'unknown', and diagnose those yourself.\n\nInventory reported so far:\n${inventorySummary}\n\nFindings reported so far (titles only):\n${findingTitles}\n\nSteps: (1) list all 39 workflow files in .github/workflows/ and every robot script in collector/, tools/, insta/, server/ and every in-app tool script at the repo root; (2) compare with the inventory above — anything absent or 'unknown' is your work-list; (3) diagnose each one with the same method; (4) also look for CROSS-CUTTING problems no single group would see: two workflows writing the same file at the same time without a shared concurrency group, a robot whose output another robot consumes but that stopped producing, data files the app fetches that no robot updates anymore, push-to-run .txt files that would re-trigger robots on the wrong branch, scheduled crons that collide. Return inventory entries only for the items YOU checked, and findings only for NEW problems (don't repeat the titles above).`, { label: 'diag:gaps', phase: 'Gaps', schema: FINDINGS })

return { groups: ok, gaps, missing }

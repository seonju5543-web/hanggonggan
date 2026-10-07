export const meta = {
  name: 'robot-tool-final-review',
  description: '계획 4 — 통합 브랜치 전체 diff를 구역별로 반박 검토하고 확인된 문제만 남긴다',
  phases: [
    { title: 'Review', detail: '8개 구역 — 묶음 사이 상호작용 · 통합 손풀이 · 워크플로 규칙' },
    { title: 'Verify', detail: '막힘·중대 발견마다 반박 검증' },
  ],
}

const SCRATCH = '/tmp/claude-0/-home-user-hanggonggan/409b9928-bac2-5670-b5b4-24e2b322cd7b/scratchpad'
const BASE = 'origin/claude/nice-heisenberg-WESq5'
const HEAD = 'integ/health-sweep'

const AREAS = [
  { key: 'workflows', title: '워크플로·액션 YAML', paths: '.github/', focus: 'timeout-minutes: every job has one and job timeout > sum of step timeouts (+margin); 보강 steps have timeout-minutes + continue-on-error; failure alerts use if: failure() || cancelled(); every file a robot modifies is git add-ed ([ -f ] && git add for optional ones); data gate (audit) runs right before save; push-to-run robots that SAVE have branches: filter on push trigger; no checkout -B main / push origin main; concurrency groups not merged; cron not on the hour/UTC midnight; new robots that git add data/ are listed in deploy-sync.yml workflows:; alert-issue action/tool usage is consistent (title/prefix/label match between open and resolve steps — a mismatch means issues never auto-close); gate-guard outputs consumed correctly; permissions blocks sufficient (issues: write where issues are opened); set -e / pipefail behaviour in verify-ui (failures collected but job still fails at end).' },
  { key: 'collect-core', title: '수집 핵심 로봇', paths: 'collector/collect.mjs collector/publish-notices.mjs collector/heal-feed.mjs collector/gate-guard.mjs collector/auto-held.mjs collector/revert-auto.mjs collector/pending-queue.mjs collector/auto-register.mjs collector/registered-merge.mjs collector/scope-promote.mjs collector/kind-classify.mjs collector/kind-evidence.mjs collector/write-atomic.mjs collector/url-key.mjs collector/canon-url.mjs collector/notice-source.mjs collector/clean-title.mjs collector/source-health.mjs collector/coverage-rules.mjs collector/audit-coverage.mjs collector/browser-collect.mjs collector/browser-health.mjs collector/browser-targets.json tools/merge-json-union.mjs .gitattributes verify/entry-rules.cjs verify/source-rules.cjs verify/audit-data.js', focus: 'feed truncation/self-heal (heal-feed + healFromLedger) cannot delete or duplicate good rows; gate-guard revert never reverts files it should not (registered.json/forms.json semantics) and its exit codes/outputs match what workflows read; auto-held hold logic; seen.json no longer blocks self-heal but still prevents re-adding; urlKey/canonUrl changes do not split identity of existing rows (would duplicate feed); merge-json-union changes keep deletion semantics for excluded files; browser targets json still parses & parked kept; integration merge 2d61469b/6a4713fc resolutions in these files.' },
  { key: 'bodies', title: '본문·자격·첨부·OCR', paths: 'collector/rescue-bodies.mjs collector/rescue-plan.mjs collector/deepfetch.mjs collector/elig-ocr-guard.mjs collector/paddle-ocr.py collector/ocr-text.py collector/html-text.mjs collector/page-boilerplate.mjs collector/notice-deadline.mjs collector/deadline-hint.mjs collector/past-rounds.mjs collector/extract-excerpts.mjs collector/apply-email.mjs collector/activity-docs.mjs collector/form-reach.mjs collector/schematize-forms.mjs collector/portal-candidates.mjs parse-requirements.js apply-channel.js verify/open-form-sample.cjs verify/verify-new-forms.js verify/verify-registered.js verify/deadline-audit.mjs verify/essay-unknown-fields.cjs', focus: 'Integration agent kept default-branch elig-targets.mjs rotation and deleted elig-attach-plan.mjs; check nothing still imports deleted modules and that the per-notice deadline + incremental save in rescue-bodies interacts correctly with the default-branch rotation (e2e: does a notice ever get skipped forever or re-hammered every run?); OCR-before-excerpts ordering; ACTIVITY_DOCS_AS_LIB env leak fix; UNDERGRAD_TOO/degreeRest change in parse-requirements.js does not flip other notices to 미달 (틀린 미달은 못 받는 것보다 나쁘다); apply-email FALLBACK_ONLY/ELSEWHERE_DONE does not drop real 접수 emails; notice-deadline makeBodyReader only takes dates after labels.' },
  { key: 'feeds', title: '소식·대외활동·재단·공공API', paths: 'collector/collect-news.mjs collector/collect-news-thumbs.mjs collector/news-kind.mjs collector/news-board-rules.mjs collector/find-news-boards.mjs collector/find-boards.mjs collector/board-links.mjs collector/external-clean.mjs collector/external-sources.json collector/activity-excerpts.mjs collector/open-api.mjs collector/open-api-map.mjs collector/robots.mjs tools/refilter-feeds.mjs tools/build-school-photos.mjs tools/fetch-gate-photos.mjs docs/designs/assets/gates/school-photo-picks.json collector/essay-sources.json', focus: 'future postedAt rejection does not drop legit posts with timezone skew; newsFloor still keeps 4 per school; external expired-post filter does not remove posts without dates; open-api failure keeps old rows; refilter-feeds --write cannot delete rows that a robot would immediately re-add (churn) or rows with no rule; school photo picks still licence-safe (BY/BY-SA credit fields intact).' },
  { key: 'links', title: '원문 링크 로봇', paths: 'collector/link-hunter.mjs collector/link-hunt-rules.mjs collector/resolve-detail-urls.mjs collector/detail-url.mjs collector/probe-links.mjs collector/probe.mjs collector/probe-lines.mjs collector/probe-candidates.json collector/run-probe.txt', focus: '🔴 고치는 로봇은 멀쩡한 주소를 표식으로 덮어쓰지 않는다 (preferNotice: 진짜 주소 > 목록 표식 > 목록+번호); jsessionid stripping does not break URLs where the session id is the only key; probe-lines only runs changed lines; probe-boards removal leaves no workflow/tool referencing it; run-probe.txt on the integ branch vs default (b6fb9997) — merge must not resurrect already-answered probe lines (that would re-hit school sites).' },
  { key: 'app-admin', title: '앱·관리자·서비스워커', paths: 'app.js data.js sw.js essay-ask.js apply-channel.js _admin/ tools/admin-apply.mjs tools/edit-diff.mjs tools/app-fetch-files.cjs verify/verify-admin.js verify/verify-essay-ask.mjs verify/what-shows.mjs verify/check-deploy-sync.js', focus: 'sw.js CACHE bump present and consistent with any new data files; admin needsBulkExpect and dry_run do not let a real write happen in dry mode or block legit single edits; ELIG_KEYS consistent between admin-apply.mjs and edit-diff.mjs; esc() still applied; CSP (no inline handlers); check-deploy-sync three-point compare does not false-red on normal robot lag; app-fetch-files.cjs derives file names from match-engine rules (not hard-coded).' },
  { key: 'servers-insta-tools', title: '서버·인스타·운영 도구', paths: 'server/ insta/ tools/alert-issue.mjs tools/robot-run.sh tools/data-robots.mjs tools/notion-branch.mjs tools/notion-status.mjs tools/push-health-verdict.mjs tools/report-retention.mjs tools/supabase-health.mjs collector/robot-heartbeat.mjs collector/kosaf-fetch.mjs collector/kosaf-session.mjs collector/kosaf-attach.mjs collector/majors.mjs collector/publish-majors.mjs collector/build-search-index.mjs tools/gate-reel/build-app-gates.mjs .claude/skills/', focus: 'CLAUDE.md principle 10: no hard-coded sender address, apply_sends evidence table read-only policy, server details not shown on screen; push worker wake logic + lastError cannot spam or silently stop pushes; insta publish guard: 게시는 사람만 누른다, tokens only in workflow, max 6 per run, refuse expired; alert-issue.mjs never leaks secrets into issue bodies and handles API failure without failing the robot; robot-run.sh data robot list automated correctly; majors publish key = UNIVERSITIES names (not 커리어넷 names) and no import-time API hits; notion-status rules (push 커밋, no --author, no noreply email).' },
  { key: 'gates', title: '관문·감사·문서', paths: 'verify/health-gates.mjs verify/health-gates/ verify/test-collector.mjs verify/audit-data.js docs/ .gitignore', focus: 'Each health-gates/<bundle>.mjs must use fixtures only — flag ANY read of live data/ or collector/ ledgers that asserts on content (CLAUDE.md: 실데이터에 기댄 고정 검사를 관문에 두지 말 것 — this caused 3 incidents); gates that only grep source text for a string (structural gates) are allowed but flag ones that would pass even if the behaviour broke (무력한 관문); PARTS list matches files present; do any gates import modules that execute on import (auto-register, schematize-forms, majors) or hit the network; total runtime of node verify/test-collector.mjs is still reasonable; doc gates (CLAUDE.md 부피 / 가리키는 것이 실제로 있다) still pass on integ.' },
]

const REVIEW_PROMPT = (a) => `PLAN 4 — FINAL ADVERSARIAL REVIEW of the 한대장 robot/tool health sweep, area "${a.key}" (${a.title}).

SETUP
- Repo: /home/user/hanggonggan. The integrated result is local branch ${HEAD} (HEAD 6a4713fc), checked out at ${SCRATCH}/integ (worktree — READ ONLY for you). Base = ${BASE} (f1a801b7, production default branch; Pages deploys main = same commit).
- Your diff: cd ${SCRATCH}/integ && git diff ${BASE}...${HEAD} -- ${a.paths}
- Background: 14 fix bundles (gate, feed, bodies, browser, qnotice, qfeeds, links, ci, alerts, servers, insta, admin, refresh, ops) were each reviewed on their own already. What NOBODY has reviewed: (1) how bundles interact once combined, (2) the integration merge commits where conflicts were resolved by hand — git show --stat and git show -m for: 1a8274bf, 2d61469b, faf86f03, 3eaf9350, 269caa3c, 6a4713fc (use git log --merges ${BASE}..${HEAD} to list all merges), (3) whether default-branch work by other sessions that landed meanwhile (git log ${BASE} -40 --oneline) is silently undone by our side of a merge. Integration policy was: when two sessions fixed the same problem, keep the default-branch implementation and port only missing behaviour.
- Bundle specs: ${SCRATCH}/spec-<bundle>.md ; bundle fix reports: ${SCRATCH}/fix-run1.json fix-run2.json fix-run3.json.

FOCUS for this area: ${a.focus}

WHAT TO REPORT — only real defects introduced or left broken by this branch: crashes, wrong data written, data loss, a robot that will now fail/timeout/never alert, issues that never auto-close, a gate that is powerless (passes even if the fixed behaviour is reverted — prove by reasoning or by trying the revert in a throwaway worktree), a gate that reads live data, a CLAUDE.md 🔴 rule broken, a regression of other sessions' default-branch work. Do NOT report style, naming, comment wording, or speculative 'might be nicer'. For each finding give severity: blocker (must fix before push — breaks production robots/app or loses data), major (fix before push if cheap — wrong behaviour but recoverable), minor (note only).

HOW TO CHECK — run things. You may run node scripts, node --check, node verify/health-gates.mjs <part>, YAML parse (node -e with a tiny parser is not available — use python3 -c 'import yaml,sys;yaml.safe_load(open(sys.argv[1]))' FILE), grep, etc. To execute anything that WRITES files, make your own throwaway worktree: git -C /home/user/hanggonggan worktree add ${SCRATCH}/rev-${a.key}/wt ${HEAD} --detach (remove it at the end with git worktree remove --force). Never edit ${SCRATCH}/integ or /home/user/hanggonggan, never commit/push/checkout there, no GitHub writes, no workflow triggers. Sandbox network blocks school sites/github.io — network failures prove nothing. Never import collector/auto-register.mjs, collector/schematize-forms.mjs, collector/majors.mjs (they execute on import; node --check is fine).

Write human-readable fields in Korean with evidence (file:line, command output). Empty findings array is a valid answer — do not invent.`

const FINDINGS = {
  type: 'object',
  properties: {
    area: { type: 'string' },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          severity: { type: 'string', enum: ['blocker', 'major', 'minor'] },
          title: { type: 'string' },
          files: { type: 'array', items: { type: 'string' } },
          evidence: { type: 'string' },
          failureScenario: { type: 'string' },
          fix: { type: 'string' },
          gate: { type: 'string' },
        },
        required: ['id', 'severity', 'title', 'files', 'evidence', 'failureScenario', 'fix'],
      },
    },
    checked: { type: 'string' },
  },
  required: ['area', 'findings', 'checked'],
}

const VERDICT = {
  type: 'object',
  properties: {
    real: { type: 'boolean' },
    severity: { type: 'string', enum: ['blocker', 'major', 'minor', 'none'] },
    reason: { type: 'string' },
    fix: { type: 'string' },
  },
  required: ['real', 'severity', 'reason'],
}

const VERIFY_PROMPT = (a, f) => `You are a SKEPTIC. Try to REFUTE this review finding about local branch ${HEAD} (worktree ${SCRATCH}/integ, READ ONLY) vs base ${BASE} in repo /home/user/hanggonggan. Default to real=false if you cannot reproduce or confirm it from the code.

Area: ${a.key}. Finding ${f.id} [${f.severity}]: ${f.title}
Files: ${(f.files || []).join(', ')}
Evidence claimed: ${f.evidence}
Failure scenario claimed: ${f.failureScenario}
Proposed fix: ${f.fix}

Check the actual code at ${HEAD}. Is the failure scenario reachable in production (scheduled robots on the default branch, app on Pages)? Is it caused by this branch or already present on ${BASE} (if already on base and not made worse, it is not a regression — say so, severity minor)? Is the severity right? If real, refine the fix to the minimal correct change and say how to prove it red-green. To run anything that writes, use your own throwaway worktree (git -C /home/user/hanggonggan worktree add ${SCRATCH}/ver-${a.key}-${f.id}/wt ${HEAD} --detach; remove afterwards). No edits to the integ worktree or main checkout, no commits/pushes, no GitHub writes. Never import collector/auto-register.mjs, schematize-forms.mjs, majors.mjs. Answer in Korean.`

phase('Review')
const results = await pipeline(
  AREAS,
  (a) => agent(REVIEW_PROMPT(a), { label: `review:${a.key}`, phase: 'Review', schema: FINDINGS }),
  (r, a) => {
    if (!r) return { area: a.key, findings: [], failed: true }
    const serious = r.findings.filter((f) => f.severity !== 'minor')
    const minors = r.findings.filter((f) => f.severity === 'minor')
    return parallel(serious.map((f) => () =>
      agent(VERIFY_PROMPT(a, f), { label: `verify:${a.key}:${f.id}`, phase: 'Verify', schema: VERDICT })
        .then((v) => ({ ...f, area: a.key, verdict: v }))
    )).then((vs) => ({ area: a.key, checked: r.checked, verified: vs.filter(Boolean), minors: minors.map((m) => ({ ...m, area: a.key })) }))
  },
)

const failedAreas = results.filter((r) => !r || r.failed).map((r, i) => (r && r.area) || AREAS[i].key)
if (failedAreas.length) log(`검토가 끝나지 않은 구역: ${failedAreas.join(', ')}`)
const ok = results.filter((r) => r && !r.failed)
const confirmed = ok.flatMap((r) => r.verified.filter((f) => f.verdict && f.verdict.real))
const refuted = ok.flatMap((r) => r.verified.filter((f) => !f.verdict || !f.verdict.real).map((f) => ({ area: f.area, id: f.id, title: f.title, reason: f.verdict && f.verdict.reason })))
const minors = ok.flatMap((r) => r.minors)
log(`확인된 문제 ${confirmed.length}건 · 반박된 것 ${refuted.length}건 · 사소한 것 ${minors.length}건`)
return { confirmed, refuted, minors, checked: ok.map((r) => ({ area: r.area, checked: r.checked })), failedAreas }

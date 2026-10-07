export const meta = {
  name: 'robot-tool-fix-chains',
  description: '계획 3 — 14개 수리 묶음을 두 줄로 쌓아 고치고(따로 작업 공간) 묶음마다 반박 검토·보완',
  phases: [
    { title: 'Fix', detail: '묶음 수리 + red-green 관문' },
    { title: 'Review', detail: '반박 검토' },
    { title: 'Polish', detail: '검토 지적 보완' },
  ],
}

const SCRATCH = '/tmp/claude-0/-home-user-hanggonggan/409b9928-bac2-5670-b5b4-24e2b322cd7b/scratchpad'
const BASE = args.base
const CHAINS = args.chains
const TITLES = {
  gate: '데이터 관문·되돌리기 구조', feed: '실시간 공고 피드 복구·자가 회복', bodies: '자격요건 로봇·본문·첨부·OCR',
  browser: '브라우저 수집 대상·건강 장부', qnotice: '장학 공고 글 품질·양식·메일 접수', qfeeds: '소식·재단·대외활동 글 품질',
  links: '원문 링크 로봇 잔여', ci: 'CI 화면 검사 관문', alerts: '경보·리포트 이슈 위생·라이브 점검', servers: '푸시·서버',
  insta: '인스타 로봇', admin: '관리자 화면·조정', refresh: '데이터 갱신 로봇', ops: '운영 감시',
}
const PORTS = { gate: 8810, feed: 8820, bodies: 8830, browser: 8840, qnotice: 8850, qfeeds: 8860, links: 8870, ci: 8880, alerts: 8890, servers: 8900, insta: 8910, admin: 8920, refresh: 8930, ops: 8940 }

const RULES = `HARD RULES
- Work ONLY inside your worktree (absolute path). Never edit the main checkout /home/user/hanggonggan or any other worktree. Never push. Never trigger workflows, never comment on/close issues.
- CLAUDE.md applies (it is injected). The ones that bit us during this sweep: (1) gates use FIXTURES/SAMPLES only — never assert on live data in data/ or collector ledgers (3 incidents this week); (2) data/registered.json & data/forms.json saved with JSON.stringify(x,null,1); (3) 베끼지 말고 불러 쓴다 — import the one rule file, never copy a rule; (4) every workflow: job timeout-minutes, enrichment steps timeout-minutes + continue-on-error, failure alert if: failure() || cancelled(), robot-written files all in git add, cron not on the hour (odd minute), never merge concurrency groups, push-to-run robots that save have push branches: filter, app-data robots listed in deploy-sync.yml workflows:; (5) never import collector/auto-register.mjs, collector/schematize-forms.mjs, collector/majors.mjs from tests (they execute on import); (6) 확인 안 한 원인을 단정하지 않는다 — also in report/alert wording; (7) user-facing words: plain Korean, no jargon.
- DO NOT edit robot-owned data: data/** (registered.json, forms.json, notices*, news/**, activities.json, external.json, majors/**, kosaf*, search-index.json, admin-log.json, link-*.json …) and collector ledgers/reports (seen*.json, health*.json, *-state.json, *-cursor.json, link-hunt.json, rescue-ledger.json, act-*.json, pending-forms.json, report.md, *-report.md, browser-bodies.json, extracted/** …). They change on every robot run and registered/forms are not union-merged. If data must be corrected (원칙 7 소급), write self-healing code that fixes it on the next robot run AND/OR a one-shot script, and put the exact command(s) in output.backfill — the orchestrator runs them later on fresh data.
- Human-curated config JSON may be edited when your spec says so (collector/schools.json, browser-targets.json, activity-sources.json, external-sources.json, auto-register-config.json, essay-sources.json, news-config.json, run-*.txt only if the spec requires).
- DO NOT edit CLAUDE.md or SESSIONS.md. Put proposed CLAUDE.md lines (rule + gate location, ≤2 lines each, Korean) in output.claudeMd and an incident note in output.sessionsNote.
- Gates: put your regression checks in verify/health-gates/<bundle>.mjs (default export async (eq, ctx) => { … }; style of verify/link-gates/*.mjs; eq(label, got, want)) and add '<bundle>' to the PARTS array in verify/health-gates.mjs (keep other entries). For EVERY gate, prove red-green: temporarily revert/mutate the fix, run node verify/health-gates.mjs <bundle> and see ✕, restore and see ✓. Record each in output.redGreen.
- Before each commit: node --check on changed .js/.mjs/.cjs; node verify/health-gates.mjs <bundle>; node verify/test-collector.mjs (exit 0); node verify/audit-data.js (exit 0); for changed workflow YAML: python3 -c "import yaml,sys;yaml.safe_load(open(sys.argv[1]))" <file> plus a duplicate-key check (grep that no mapping key repeats under the same parent — duplicate with: broke 3 workflows on 09-30). If you touched app/admin/sw/style files run the relevant browser drivers (verify-ui.yml lists them) with: python3 -m http.server <PORT> from your worktree root (SRV=$!; kill $SRV after), NODE_PATH=/opt/node-tools/node_modules CHROME_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome PORT=<PORT> node verify/<driver>. Other driver env ports (e.g. ADMIN_PORT) use PORT+1..PORT+9. Never pkill -f.
- Commit in small logical commits on your branch, Korean messages ending with:
Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Q8cvV7LejYVSK8g7ZP5BkW
- The sandbox blocks school sites/github.io/google; network failures here prove nothing. GitHub MCP tools (via ToolSearch) are available read-only for logs.`

const FIX_SCHEMA = {
  type: 'object',
  properties: {
    worktree: { type: 'string' },
    branch: { type: 'string' },
    head: { type: 'string' },
    commits: { type: 'array', items: { type: 'string' } },
    done: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, status: { type: 'string', enum: ['fixed', 'partial', 'skipped', 'already-fixed'] }, note: { type: 'string' } }, required: ['id', 'status', 'note'] } },
    redGreen: { type: 'array', items: { type: 'string' } },
    checks: { type: 'string' },
    backfill: { type: 'array', items: { type: 'object', properties: { command: { type: 'string' }, why: { type: 'string' } }, required: ['command', 'why'] } },
    claudeMd: { type: 'array', items: { type: 'string' } },
    sessionsNote: { type: 'string' },
    humanFollowups: { type: 'array', items: { type: 'string' } },
    filesOutsideBundle: { type: 'array', items: { type: 'string' } },
    notes: { type: 'string' },
  },
  required: ['worktree', 'branch', 'head', 'done', 'checks'],
}
const REVIEW_SCHEMA = {
  type: 'object',
  properties: {
    verdict: { type: 'string', enum: ['approve', 'changes'] },
    issues: { type: 'array', items: { type: 'object', properties: { severity: { type: 'string', enum: ['blocker', 'major', 'minor'] }, file: { type: 'string' }, problem: { type: 'string' }, fix: { type: 'string' } }, required: ['severity', 'problem', 'fix'] } },
    verifiedRedGreen: { type: 'array', items: { type: 'string' } },
    notes: { type: 'string' },
  },
  required: ['verdict', 'issues'],
}

const fixPrompt = (b, prevBranch, chainNames) => `PLAN 3 — FIX bundle "${b}" (${TITLES[b]}) of the 한대장 robot/tool health sweep.

Your cwd is a FRESH git worktree created from base ${BASE} (branch claude/robot-tool-health-sweep). FIRST run: pwd ; then create your branch: if fix/${b} does not exist yet run git checkout -b fix/${b} ; if it already exists (an earlier attempt died on a usage limit) create fix/${b}-2 (or -3 …) instead and git merge --no-edit the newest existing fix/${b}* branch to keep its partial work. If git rev-parse --verify salvage/${b} succeeds, also git merge --no-edit salvage/${b} (partial work of an earlier attempt — keep it, but VERIFY it instead of trusting it). ${prevBranch ? `Then git merge --no-edit ${prevBranch}.` : ''}
${prevBranch ? `(${prevBranch} holds the already-reviewed fixes of the earlier bundles in your chain: ${chainNames}. Build on top of them; do not undo them.)` : ''}
Then read your spec: ${SCRATCH}/spec-${b}.md — it lists the verified findings (with exact fix specs, gate ideas, backfill, risks) and decisions taken for human-decision items (bold "결정:" lines). Implement every item that is "confirmed", and every "needs-human" item whose 결정 asks for an action, in the recommended order. The spec was written against an older HEAD and OTHER SESSIONS have since merged overlapping work into the default branch (link-integrity: link robots/admin link fixes; 762226e0 title tails cleaned in one cleanTitle + backfill; fdf71099 merge-json-union rules for activities/external + 중앙대 links; 280b4104 elig-attach 6→30 per run and rescue 25→50; 08f663d7/41cc5f02 verify-ui reds; 06a34cc7 real-data '대학원 전용' gate moved to audit warning) — RE-VERIFY each item against the current code before changing it; if it is already fixed or the spec is wrong, skip it and say why (status already-fixed/skipped). Prefer the smallest change that removes the root cause. Use your PORT ${PORTS[b]} for any browser driver.

${RULES}

Finish with everything committed on fix/${b}. Return the schema: worktree = absolute path (pwd), branch, head = git rev-parse HEAD, commits = git log --oneline ${BASE}..HEAD, per-item done list, redGreen evidence, checks = the exact pass/fail lines of the checks you ran, backfill commands, claudeMd proposals, sessionsNote, humanFollowups (things only the developer can do), filesOutsideBundle.`

const reviewPrompt = (b, fx) => `PLAN 3 — ADVERSARIAL REVIEW of bundle "${b}" (${TITLES[b]}).
The fixer worked in worktree ${fx.worktree} on branch ${fx.branch} (head ${fx.head}). Spec: ${SCRATCH}/spec-${b}.md. Fixer report: ${JSON.stringify({ done: fx.done, redGreen: fx.redGreen, checks: fx.checks, backfill: fx.backfill, filesOutsideBundle: fx.filesOutsideBundle, notes: fx.notes }).slice(0, 12000)}
Review ONLY this bundle's own changes: git -C ${fx.worktree} diff ${fx.branch}~${'{'}N${'}'}… is not reliable — instead diff against the merge base of the previous bundle: run git -C ${fx.worktree} log --oneline ${BASE}..${fx.branch} and review the commits whose messages belong to this bundle (or git -C ${fx.worktree} diff <first-commit-of-this-bundle>^..${fx.branch}).
Try hard to find: real bugs; edge cases (empty/missing values, missing files, first run, network failure paths); regressions of behaviour the spec says must not change; CLAUDE.md rule violations (real-data gate assertions, copied rules instead of imports, workflow rules: timeout/continue-on-error/failure alerts/git add/cron minute/concurrency/branches filters/deploy-sync list, jargon in user-facing text, unverified causes stated as fact); data files edited (forbidden: data/** and collector ledgers); items in the spec silently skipped; gates that would NOT fail if the fix were reverted.
Do your own red-green spot check of at least the two most important gates: create a temporary worktree of the fix branch (git -C /home/user/hanggonggan worktree add ${SCRATCH}/rv-${b} ${fx.branch} --detach), mutate/revert the fix there, run node verify/health-gates.mjs ${b}, confirm ✕, then remove that worktree (git -C /home/user/hanggonggan worktree remove --force ${SCRATCH}/rv-${b}). Also run node verify/test-collector.mjs and node verify/audit-data.js in that temporary worktree before removing it.
You are READ-ONLY on ${fx.worktree} and the main checkout. Return verdict approve/changes and issues (blocker = wrong behaviour/regression/rule break; major = spec item missing or gate not proving anything; minor = polish). Korean text.`

const polishPrompt = (b, fx, rv) => `PLAN 3 — POLISH bundle "${b}" (${TITLES[b]}). Work ONLY in the existing worktree ${fx.worktree} on branch ${fx.branch} (use absolute paths; git -C ${fx.worktree} …; run commands with cd ${fx.worktree} && …). Do NOT create a new worktree and do NOT touch /home/user/hanggonggan itself.
A reviewer found these issues: ${JSON.stringify(rv.issues).slice(0, 14000)}
Fix every blocker and major issue (and minor ones when cheap and safe). If you disagree with an issue, leave it and explain in notes with evidence. Spec: ${SCRATCH}/spec-${b}.md.

${RULES}

Commit on ${fx.branch}. Return the same schema as the fixer (worktree, branch, head, commits = git log --oneline ${BASE}..HEAD, done = status of each reviewer issue as id 'R1','R2'…, redGreen, checks, backfill (complete list for the bundle, including the fixer's), claudeMd (complete), sessionsNote, humanFollowups, filesOutsideBundle, notes).`

async function runBundle(b, prevBranch, chainNames) {
  const fx = await agent(fixPrompt(b, prevBranch, chainNames), { label: `fix:${b}`, phase: 'Fix', isolation: 'worktree', schema: FIX_SCHEMA })
  if (!fx) { log(`✕ ${b} 수리 실패 — 이 묶음을 건너뛰고 줄을 잇는다`); return null }
  const rv = await agent(reviewPrompt(b, fx), { label: `review:${b}`, phase: 'Review', schema: REVIEW_SCHEMA })
  let final = fx, polish = null
  if (rv && rv.verdict === 'changes' && rv.issues.some((i) => i.severity !== 'minor')) {
    polish = await agent(polishPrompt(b, fx, rv), { label: `polish:${b}`, phase: 'Polish', schema: FIX_SCHEMA })
    if (polish) final = { ...polish, worktree: fx.worktree, branch: fx.branch }
  }
  log(`✓ ${b} 끝 — ${final.branch} ${final.head}`)
  return { bundle: b, fix: fx, review: rv, polish, branch: fx.branch, head: final.head, worktree: fx.worktree }
}

async function runChain(spec) {
  /* spec 는 묶음 배열이거나 { start: '이미 끝난 앞 묶음의 가지', done: ['앞 묶음 이름…'], bundles: [...] } */
  const chain = Array.isArray(spec) ? spec : spec.bundles
  const doneBefore = Array.isArray(spec) ? [] : (spec.done || [])
  const out = []
  let prev = Array.isArray(spec) ? null : (spec.start || null)
  for (let i = 0; i < chain.length; i++) {
    const r = await runBundle(chain[i], prev, [...doneBefore, ...chain.slice(0, i)].join(' → '))
    out.push(r || { bundle: chain[i], failed: true })
    if (r) prev = r.branch
  }
  return { chain, results: out, lastBranch: prev }
}

phase('Fix')
const chains = await parallel(CHAINS.map((c) => () => runChain(c)))
return { base: BASE, chains }

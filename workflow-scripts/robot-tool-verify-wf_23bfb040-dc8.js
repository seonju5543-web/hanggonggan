export const meta = {
  name: 'robot-tool-verify',
  description: '계획 2 — 14개 수리 묶음의 진단을 최신 코드에서 반박 검증하고 수리 명세를 확정',
  phases: [{ title: 'Verify', detail: '묶음별 반박 검증 + 수리 명세' }],
}

const SCRATCH = '/tmp/claude-0/-home-user-hanggonggan/409b9928-bac2-5670-b5b4-24e2b322cd7b/scratchpad'

const OTHER_FILES = '.gitattributes .github/workflows/admin-apply.yml .github/workflows/check-live.yml .github/workflows/link-check.yml .github/workflows/verify-ui.yml _admin/README.md _admin/admin.css _admin/admin.js _admin/build.sh _admin/index.html app.js chat.js collector/browser-collect.mjs collector/detail-url.mjs collector/link-candidates.json collector/link-candidates.mjs collector/link-check-plan.mjs collector/link-check.mjs collector/link-fix.mjs collector/link-fixes-read.mjs collector/link-hunt-rules.mjs collector/link-hunter.mjs collector/link-landing.mjs collector/news-board-rules.mjs collector/open-api-map.mjs collector/open-api.mjs collector/resolve-detail-urls.mjs collector/url-key.mjs data.js data/admin-log.json data/link-fixes.json source-link.js sw.js tools/admin-apply.mjs tools/build-admin-preview.mjs verify/audit-data.js verify/link-audit.cjs verify/link-gates.mjs verify/link-gates/*.mjs verify/test-collector.mjs verify/verify-admin.js verify/what-shows.mjs'

const BUNDLES = [
  { key: 'gate', title: '데이터 관문·되돌리기 구조' },
  { key: 'feed', title: '실시간 공고 피드 복구·자가 회복' },
  { key: 'bodies', title: '자격요건 로봇·본문·첨부·OCR' },
  { key: 'browser', title: '브라우저 수집 대상·건강 장부' },
  { key: 'alerts', title: '경보·리포트 이슈 위생 · 라이브 점검' },
  { key: 'ci', title: 'CI 화면 검사 관문 회복' },
  { key: 'qnotice', title: '장학 공고 글 품질·양식·메일 접수' },
  { key: 'qfeeds', title: '소식·재단·대외활동 글 품질' },
  { key: 'insta', title: '인스타 로봇' },
  { key: 'servers', title: '푸시·서버' },
  { key: 'admin', title: '관리자 화면·조정' },
  { key: 'refresh', title: '데이터 갱신 로봇(KOSAF·학과·등록금·사진·작성규칙)' },
  { key: 'ops', title: '운영 감시(하트비트·배포 감시·노션·로컬 겉옷·정찰)' },
  { key: 'links', title: '원문 링크 로봇(다른 세션과 겹침 확인)' },
]

const PROMPT = (b) => `PLAN 2 — 반박 검증. You are an ADVERSARIAL VERIFIER for ONE fix bundle of the 한대장 repo robot/tool health sweep.

Bundle: "${b.key}" — ${b.title}. Read your findings: node -e 'console.log(JSON.parse(require("fs").readFileSync("${SCRATCH}/bundles.json","utf8"))["${b.key}"])'

CONTEXT
- Repo /home/user/hanggonggan, branch claude/robot-tool-health-sweep at 46f08990 (= default branch claude/nice-heisenberg-WESq5 at 2026-10-04 09:05Z + one scaffold commit: verify/health-gates.mjs, an empty registry that test-collector calls in section 「로봇·도구 점검 관문」). Now is 2026-10-04 ~09:10Z (18:10 KST).
- The diagnosis was made against b71da694..ca94c76e. Newer commits since: 06a34cc7 (data gate fix: the real-data '대학원 전용인데 점수가 매겨진 것이 없다' test moved to an audit-data.js warning; UNDERGRAD_TOO in parse-requirements.js now accepts '학사, 석사ㆍ박사과정'), b444b603 (소식 0건 학교 없애기 · 사진 없는 학교 8곳), 98cc4bbc/722791c2/d80c750f (home UI). Use git log -p to see them.
- A CONCURRENT developer session works on unmerged branch origin/claude/source-link-integrity (9 commits ahead, messages in ${SCRATCH}/other-session.txt). It changes these files: ${OTHER_FILES}. For any finding whose fix lies in those files, run git diff origin/claude/nice-heisenberg-WESq5...origin/claude/source-link-integrity -- <file> and decide whether that branch already fixes it (verdict other-session) or whether our fix would collide (say so in risk).

FOR EACH FINDING in your bundle:
1. Try hard to REFUTE it. Re-read the cited code at CURRENT HEAD, re-check the cited logs/issues (GitHub MCP — load with ToolSearch "select:mcp__github__actions_list,mcp__github__actions_get,mcp__github__get_job_logs,mcp__github__list_issues,mcp__github__issue_read"; owner seonju5543-web repo hanggonggan) and the data files. Is the symptom real TODAY? Is the stated root cause the real one? Was it fixed by a newer commit? Did a newer robot run already change the data? Is the severity right?
2. verdict: confirmed | refuted | already-fixed | other-session | needs-human (real, but the fix needs a developer decision, a secret, or an external service).
3. If confirmed: write a precise, implementable fixSpec — files and functions, exact behaviour change, edge cases, what must NOT change (name the CLAUDE.md rule if one applies), and backfill (CLAUDE.md 원칙 7 소급: does existing data need to be corrected, and HOW — prefer code that self-heals on the next robot run plus a one-off local run of the same code, over hand edits; registered.json/forms.json are saved with JSON.stringify(x,null,1) and edited via tools/admin-apply.mjs where possible).
4. gate: the red-green regression check. Convention for this sweep: new gates go in a NEW file verify/health-gates/${b.key}.mjs (default export async (eq, ctx) => void, same style as verify/link-gates/*.mjs; eq(name, got, want) prints ✓/✕), which test-collector will call from one new section. Only use an existing test-collector section if the rule clearly belongs there. Gates must use fixtures/samples, NEVER live repo data (CLAUDE.md: 실데이터에 기댄 고정 검사 금지 — this exact mistake caused 3 of the incidents). Say how to prove red (what to revert).
5. If needs-human: humanQuestion = the exact question for the developer in plain Korean (no jargon), with options and your recommendation.

Also give: implementation order inside the bundle, and filesTouched = every file the whole bundle's fixes will modify (the orchestrator uses it to avoid two parallel fixers editing the same file).

HARD RULES: read-only. Do not edit/create/delete files in /home/user/hanggonggan, no git commit/push/checkout/stash there, no workflow triggers, no issue comments/close. Scratch only under ${SCRATCH}/verify-${b.key}/. To execute something that writes, use a throwaway worktree (git -C /home/user/hanggonggan worktree add ${SCRATCH}/verify-${b.key}/wt HEAD --detach; remove it afterwards). The sandbox network blocks school sites, github.io, google — sandbox fetch failures prove nothing. Never import collector/auto-register.mjs, collector/schematize-forms.mjs, collector/majors.mjs (they execute on import). The full local gate run log (all pass at ca94c76e) is ${SCRATCH}/test-collector.log. Write human-readable fields in Korean, with evidence (file:line, run URL, issue #).`

const SCHEMA = {
  type: 'object',
  properties: {
    bundle: { type: 'string' },
    verdicts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          verdict: { type: 'string', enum: ['confirmed', 'refuted', 'already-fixed', 'other-session', 'needs-human'] },
          severity: { type: 'string', enum: ['P0', 'P1', 'P2', 'P3'] },
          reason: { type: 'string' },
          fixSpec: { type: 'string' },
          gate: { type: 'string' },
          backfill: { type: 'string' },
          files: { type: 'array', items: { type: 'string' } },
          risk: { type: 'string' },
          humanQuestion: { type: 'string' },
        },
        required: ['id', 'verdict', 'severity', 'reason'],
      },
    },
    order: { type: 'array', items: { type: 'string' } },
    filesTouched: { type: 'array', items: { type: 'string' } },
    notes: { type: 'string' },
  },
  required: ['bundle', 'verdicts', 'order', 'filesTouched'],
}

phase('Verify')
/* 세션 사용 한도에 두 번 걸려서 다섯 개씩 나눠 돈다(한 번에 14개를 띄우지 않는다) */
const results = []
for (let i = 0; i < BUNDLES.length; i += 5) {
  const wave = BUNDLES.slice(i, i + 5)
  const got = await parallel(wave.map(b => () =>
    agent(PROMPT(b), { label: `verify:${b.key}`, phase: 'Verify', schema: SCHEMA })
      .then(r => r ? { ...r, bundle: b.key } : null)
  ))
  results.push(...got)
  log(`검증 ${Math.min(i + 5, BUNDLES.length)}/${BUNDLES.length} 묶음 끝`)
}
const missing = BUNDLES.filter((b, i) => !results[i]).map(b => b.key)
if (missing.length) log(`검증 실패 묶음: ${missing.join(', ')}`)
return { results: results.filter(Boolean), missing }

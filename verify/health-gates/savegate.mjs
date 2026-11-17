/* 「로봇·도구 점검 관문」 — savegate 묶음: 저장하는 로봇은 저장 **앞에** 관문을 거치는가 (2026-11-15 · 노션 G-16)
   사고(10-13 실측): 저장하는 워크플로 25개 중 규칙 관문(test-collector)을 저장 앞에 둔 것은 11개 — 데이터 감사만 5 · 아무것도 없음 9.
     관문 없이 저장한 로봇 하나가 규칙 파일을 어기면 **그날 돈 다른 로봇 전부**가 관문에 걸려 제 결과를 되돌린다
     (10-13 층2 사냥꾼: 증거 2건짜리 게시판을 외부 출처 목록에 적어 수집·브라우저·링크 사냥꾼이 6회 빨간불).
   규칙(CLAUDE.md 매 세션 7):
     · `collector/*.json`(규칙 파일 · collector 바로 밑 json)이나 `data/` 를 저장하면 → 규칙 관문(verify/test-collector.mjs)이 저장 앞에
     · `data/` 를 저장하면 → 데이터 감사(verify/audit-data.js)도 저장 앞에
     · '앞에'는 같은 job 안, 로봇이 파일을 쓴 단계 **뒤** · 저장 단계는 관문이 빨가면 돌지 않아야 한다
       (저장 단계의 if 가 관문 단계 결과를 보거나 · 관문 단계가 continue-on-error 없이 넘어지고 저장 단계가 always() 로 덮지 않거나 · 같은 단계 안에서 관문이 먼저).
     · 🔴 (2026-11-16 리뷰) 되돌리기 짝은 **저장하는 경로를 전부** 덮어야 센다(gate-guard --stage · git checkout -- · 'auto' 는 정식 등록만) — 아니면
       저장 if 가 gate-guard 의 '다시 재어 초록'(reverted-*·flaky)만 받아야 한다(kept-preexisting 는 빨간 판을 받아들인 것) ·
       🔴 (리뷰 2차) gate-guard 의 stage 는 저장 if 가 그 결과(outputs.gate)를 요구할 때만 덮는다 — 넘어지면 `||` 예비 줄만 돈다(revertCover 는 둘의 교집합) ·
       관문 줄을 삼키는 꼴(`| tee` 무 pipefail · if/!/until 조건 · `|| 무엇이든` · `&& …`)과 관문 **뒤** 쓰기(> · mv · cp · tee · sed -i · node -e)는 관문이 아니다.
   🔴 톱니(ratchet): 지금 관문이 없는 저장 job 은 아래 SAVE_GATE_EXCEPTIONS 에 이유 한 줄과 함께 있다 —
      새 저장 job 이 관문 없이 생기면 빨간불 · 목록에 있는 job 이 관문을 갖추면(또는 저장을 그만두면) 그것도 빨간불(목록에서 지우라고) → 목록은 줄기만 한다.
   🔴 저장 여부는 `git add <경로>` 로 본다(주석 줄은 걷어 낸다) — 커밋 옮기기 로봇(deploy-sync·main-guard·device-deploy·rollback)은 git add 가 없어 저장 로봇이 아니다.
   🔴 YAML 해석기를 들이지 않는다(수집 로봇도 이 관문을 돌린다 · npm 설치 없음) — ci 묶음의 stepsOf · alerts 묶음의 jobsOf 를 불러 쓴다.
   🔴 표본(고정 YAML 글)으로 규칙을 red-green 하고, 실제 워크플로 대조는 softEq(로봇 워크플로에서는 경고만 · 로컬·verify-ui DOC_GATES=1 에서 실패). */
import fs from 'node:fs';
import { stepsOf } from './ci.mjs';
import { jobsOf, softEq } from './alerts.mjs';

export const RULE_GATE_RE = /\bverify\/test-collector\.mjs\b/;
export const DATA_GATE_RE = /\bverify\/audit-data\.js\b/;
/** 되돌리기 — gate-guard(되돌리고 다시 잰다) · git checkout/restore(직전 판으로) */
export const REVERT_RE = /\bcollector\/gate-guard\.mjs\b|\bgit\s+(checkout|restore)\b/;

/** 관문이 없는 저장 job — `파일#job` → 이유 한 줄. 🔴 줄기만 한다(관문을 붙였으면 여기서 지운다 · 새로 더하지 말 것) */
export const SAVE_GATE_EXCEPTIONS = {
  'admin-apply.yml#apply': '관리자 버튼 — 감사만 돈다: test-collector 만 알던 규칙은 감사·저장소 거절로 옮겼다(관문 gate ② · 10-04) · 남의 빨간불에 관리자 수정이 막히지 않게',
  /* audit-coverage.yml#audit — 11-17 지웠다: collector/coverage-*.json 은 규칙 파일 자리(collector 바로 밑 json)라 CLAUDE.md 매 세션 7 대로 관문을 붙였다
     (남의 빨간불에 감사가 멈추지 않게 gate-guard --keep-preexisting · 관문은 test-collector 만 — 사냥꾼과 같은 꼴) */
};

/** 관문이 재지 않는 자리(insta/ · docs/ · collector/extracted/ 아래)**만** 저장하는 job — `파일#job` → { why, readers } (2026-11-17 · 노션 G-16 나머지).
    위 규칙(data/ · collector 바로 밑 json)에 안 걸려 관문 없이 저장해도 되는 까닭을 한 줄로 적어 둔다 — 「저장 로봇이 아니다」로 조용히 빠지던 것을 이름으로 붙잡는다.
    · why: 그 파일을 누가 읽는가 · 관문(test-collector·audit-data)을 걸면 무엇이 깨지는가
    · readers: 앱(뿌리 *.js·*.html)·수집 로봇(collector/*.mjs·*.cjs) 중 그 경로를 글자로 부르는 것은 이 파일들뿐이다(③-2 가 잰다 — 다른 데서 부르기 시작하면 이유가 낡은 것)
    🔴 톱니 — 새 job 은 여기 이유를 적어 더하고 · 이제 data/·collector/*.json 을 저장하면(관문 대상) 여기서 지우고 관문을 붙인다 */
export const OUTSIDE_GATE_SAVERS = {
  'gate-photos.yml#fetch': { why: '정문 사진 후보·manifest(docs/designs/assets/gates) — 사람이 tools/build-school-photos.mjs·gate-reel/build-app-gates.mjs 로 골라 assets/ 로 옮길 때만 읽고, 앱이 받는 assets/ 쪽은 그 사람 커밋이 관문(「학교 대표 사진」·「시작 화면」)을 거친다', readers: [] },
  'insta-comments.yml#run': { why: 'insta/comments.json — 관리자 화면 인스타 탭만 읽는다(앱·수집 로봇·관문 안 읽음) · 사실 관문은 verify-insta.js 가 따로 지킨다', readers: [] },
  'insta-samples.yml#draw': { why: 'insta/samples(판형 견본 그림·index.json) — 관리자 화면 판형 탭만 읽는다 · 앱·수집 로봇·관문 안 읽음', readers: [] },
  'insta-stats.yml#harvest': { why: 'insta/stats.json(팔로워·반응) — 관리자 화면만 읽는다 · 앱·수집 로봇·관문 안 읽음 · 걸면 남의 빨간불에 반응 수확이 끊긴다', readers: [] },
  'insta-token-check.yml#check': { why: 'insta/token-seen.json(토큰 지문) — 이 감시 로봇과 관리자 화면만 읽는다 · 걸면 남의 빨간불에 토큰 만료 경보가 멈춘다', readers: [] },
  'insta.yml#prepare': { why: 'insta/pub·seen.json — 인스타 로봇끼리·관리자 화면만 읽는다 · 카드의 사실은 그리기 전 사실 관문(verify-insta.js)이 잰다', readers: [] },
  'insta.yml#publish': { why: 'insta/seen.json — 올린 뒤 반드시 적어야 같은 공고를 두 번 올리지 않는다(always) · 관문을 걸면 남의 빨간불에 올린 기록이 사라진다', readers: [] },
  'insta.yml#skip': { why: 'insta/seen.json — 관리자 건너뛰기 기록 · 인스타 로봇끼리·관리자 화면만 읽는다 · 걸면 남의 빨간불에 건너뛰기가 안 먹는다', readers: [] },
  'two-school-scan.yml#scan': { why: '일회용 조사(09-02) — 기본 브랜치가 아닌 제 브랜치에만 push · collector/extracted/two-school·ts-* 는 이 조사 짝 로봇만 읽는다(test-collector 의 판정 표본은 글자를 베껴 둔 것)', readers: ['collector/scan-two-schools.mjs', 'collector/classify-two-schools.mjs'] },
};

/** 관문이 재지 않는 자리만 저장하는 job 과 그 경로 — { '파일#job': [경로…] } */
export function outsideGateSavers(files) {
  const out = {};
  for (const [f, yml] of Object.entries(files)) for (const job of jobsOf(yml)) {
    const paths = stepsOf(job.text).flatMap((s) => addedPaths(s.run));
    if (!paths.length) continue;
    const n = needsOf(paths);
    if (!n.rule && !n.data) out[`${f}#${job.name}`] = paths;
  }
  return out;
}

/** 그 경로를 글자로 부르는 파일 — texts = { 파일: 글 } · 경로의 `*` 앞까지만 본다(`collector/extracted/ts-*.*` → `collector/extracted/ts-`) */
export function readersOf(paths, texts) {
  const keys = paths.map((p) => p.replace(/\*.*$/, '').replace(/\/+$/, '')).filter((k) => k.length >= 6);
  return Object.entries(texts).filter(([, t]) => keys.some((k) => t.includes(k))).map(([f]) => f).sort();
}

const codeLines = (t) => String(t || '').split('\n').filter((l) => !/^\s*#/.test(l));

/** 셸 글에서 `git add` 가 올리는 경로들 — 줄 이어 쓰기(\) 를 잇고, 주석 줄·꼬리 주석은 걷는다.
    `-A`·`--all` 만 있고 경로가 없으면 '*'(전부). 변수 경로(`$f`)는 '?'(모름 — 저장으로 센다) */
export function addedPaths(run) {
  const text = codeLines(run).join('\n').replace(/\\\n/g, ' ');
  const out = [];
  for (const m of text.matchAll(/\bgit\s+add\b([^\n;&|]*)/g)) {
    const args = m[1].replace(/\s#.*$/, '').replace(/\s\d?>\S*/g, ' ').trim().split(/\s+/).filter(Boolean);
    const paths = args.filter((a) => !a.startsWith('-')).map((a) => a.replace(/^["']|["']$/g, ''));
    if (!paths.length) { if (args.some((a) => a === '-A' || a === '--all' || a === '-u')) out.push('*'); continue; }
    for (const p of paths) out.push(/\$/.test(p) ? '?' : p.replace(/^\.\//, ''));
  }
  return out;
}

/** 이 경로를 저장하면 어떤 관문이 필요한가 — { rule, data } */
export function needsOf(paths) {
  const need = { rule: false, data: false };
  for (const p of paths) {
    if (p === '*' || p === '?' || p === '.') { need.rule = true; need.data = true; continue; }
    const q = p.replace(/\/+$/, '');
    if (q === 'data' || q.startsWith('data/')) { need.rule = true; need.data = true; }
    if (q === 'collector' || /^collector\/[^/]+\.json$/.test(q) || /^collector\/\*/.test(q)) need.rule = true;
  }
  return need;
}

const hasAlways = (cond) => /\b(always|failure|cancelled)\s*\(\)/.test(String(cond || ''));
const truthyCoe = (s) => /^(true|'true'|"true")$/.test(String(s['continue-on-error'] || '').trim());
/** 셸 글 → 줄(주석 줄 걷고 줄 이어 쓰기 잇기) — 줄 번호는 늘 이 꼴로 센다 */
const shLines = (run) => codeLines(run).join('\n').replace(/\\\n/g, ' ').split('\n');

/* 관문이 재는 경로(data/ · collector 바로 밑 json)에 **쓰는** 셸 꼴 (2026-11-16 리뷰 — 관문 뒤 `jq … > t && mv t data/a.json`·`node -e "fs.writeFileSync('data/a.json')"` 가
   '파일을 쓰는 단계'로 안 잡혀, 관문이 잰 뒤 바뀐 파일이 저장됐다) */
const GATED_TARGET = /^["']?(?:\.\/)?(?:data(?:\/|["']?$)|collector\/[^/\s"']+\.json["']?$)/;
const WRITE_VERB = /\b(?:writeFileSync|writeFile|appendFileSync|renameSync|copyFileSync|cpSync|rmSync|unlinkSync|write_text|write_bytes|json\.dump|shutil\.(?:copy|move))\b|\bopen\([^)]*,\s*["'][wax]/;
const READ_VERB = /\b(?:readFileSync|readFile|JSON\.parse|require\(|read_text|json\.load)\b/;
function writesGatedPath(seg) {
  const s = seg.replace(/["'][^"']*["']/g, (q) => (/^["'](?:\.\/)?(?:data\/|collector\/)/.test(q) ? q : '""'));
  for (const m of s.matchAll(/(?:^|[^0-9&>|])\d?>>?\|?\s*(\S+)/g)) if (GATED_TARGET.test(m[1])) return true;   // > data/a.json · >> · 2>
  const toks = s.trim().split(/\s+/);
  const cmd = toks.findIndex((t) => !/^[A-Z_][A-Z0-9_]*=/.test(t) && t !== 'sudo');
  const head = toks[cmd] || '';
  const args = toks.slice(cmd + 1).filter((t) => !t.startsWith('-'));
  if (/^(mv|cp|install|rsync|ln)$/.test(head) && args.length >= 2 && GATED_TARGET.test(args[args.length - 1])) return true;
  if (head === 'tee' && args.some((a) => GATED_TARGET.test(a))) return true;
  if (/^(sed|perl)$/.test(head) && toks.some((t) => /^-[a-zA-Z]*i/.test(t)) && args.some((a) => GATED_TARGET.test(a))) return true;   // sed -i data/a.json
  return false;
}
/** 줄 번호(shLines 기준)마다 '관문이 재는 경로에 쓰는가' — 로봇·도구 부르기(node·python·bash 스크립트) · 셸 쓰기(> · mv · cp · tee · sed -i) · node -e/python -c 의 몸통 */
function writeLineSet(run) {
  const lines = shLines(run);
  const out = new Set();
  lines.forEach((l, i) => {
    const calls = [...l.matchAll(/\b(?:node|python3?|bash)\s+([^\s;&|]+)/g)].map((m) => m[1]);
    if (calls.some((c) => !/^(verify\/|collector\/gate-guard\.mjs|tools\/alert-issue\.mjs|tools\/setup-collab\.sh|-e$|-c$|--check$)/.test(c))) out.add(i);
    if (l.split(/;|&&|\|\||\|(?!\|)/).some(writesGatedPath)) out.add(i);
  });
  /* node -e "…" / python -c "…" — 몸통은 여러 줄일 수 있다. 관문 경로를 말하고, 쓰는 동사가 있거나 읽는 동사조차 없으면 쓰기로 센다(모르면 쓰기) */
  const text = lines.join('\n');
  for (const m of text.matchAll(/\b(?:node|python3?)\s+(?:-e|-c|--eval)\s+(["'])([\s\S]*?)\1/g)) {
    const body = m[2];
    if (!/(?:^|[^\w/])(?:\.\/)?(?:data\/|collector\/[^/\s"'`]+\.json)/.test(body)) continue;
    if (WRITE_VERB.test(body) || !READ_VERB.test(body)) out.add(text.slice(0, m.index).split('\n').length - 1);
  }
  return out;
}

/* 단계의 셸 — `shell: bash` 면 GitHub 이 `bash --noprofile --norc -eo pipefail` 로 돌린다. 적지 않으면(기본) `bash -e` 라 pipefail 이 없다 */
const pipefailShell = (shell) => String(shell || '').trim() === 'bash';
const setsPipefail = (l) => /\bset\s+(?:-[a-zA-Z]*o\s+pipefail|-o\s+pipefail)\b/.test(l);
/** if/while/until 묶음·`|| {` 묶음의 몸 — 그 줄부터 짝(fi · done · })까지 */
function blockFrom(lines, i, closeRe) {
  const out = [lines[i]];
  if (closeRe.test(lines[i])) return out.join('\n');
  for (let j = i + 1; j < lines.length; j += 1) { out.push(lines[j]); if (closeRe.test(lines[j])) break; }
  return out.join('\n');
}
const EXITS = /\bexit\s+[1-9]/;

/** 관문 줄이 빨간불을 삼키는가 (2026-11-16 리뷰 — `|| true`·`|| :`·`|| echo` 만 보아 아래가 '관문'으로 통과했다):
    · `관문 | tee …` — 기본 셸(bash -e)은 pipefail 이 없어 tee 의 0 이 이긴다(단계 `shell: bash` 나 앞줄 `set -o pipefail` 이면 산다)
    · `if 관문` · `if ! 관문` · `! 관문` · `while/until 관문` — 조건으로 쓰면 bash -e 가 멈추지 않는다(if 묶음 안에 exit 1~9 가 있으면 산다)
    · `관문 || 무엇이든` — 뒤(같은 줄 또는 `|| {` 묶음)에 exit 1~9 가 없으면 삼킨다
    · `관문 && …` — && 목록의 앞 명령은 bash -e 가 멈추지 않는다(그 줄이 run 의 마지막 명령이면 단계 결과가 되어 산다) */
function swallowed(lines, i, ctx = {}) {
  const line = lines[i];
  const m = /\bverify\/(?:test-collector\.mjs|audit-data\.js)\b/.exec(line);
  if (!m) return false;
  const before = line.slice(0, m.index);
  const after = line.slice(m.index + m[0].length);
  if (/^\s*(?:if|elif)\b/.test(before)) return !EXITS.test(blockFrom(lines, i, /(?:^|[;\s])fi\b/));
  if (/^\s*(?:while|until)\b/.test(before) || /!\s*(?:\S+=\S*\s+)*(?:node\s+)?$/.test(before)) return true;
  const or = /\|\|(.*)$/.exec(after);
  if (or) return !EXITS.test(/^\s*\{\s*$/.test(or[1]) ? blockFrom(lines, i, /^\s*\}/) : or[1]);
  if (/\|(?!\|)/.test(after) && !pipefailShell(ctx.shell) && !lines.slice(0, i).some(setsPipefail)) return true;
  if (/&&/.test(after)) { const rest = lines.slice(i + 1).filter((l) => l.trim()); return rest.length > 0; }
  return false;
}

/** 단계 하나가 거치는 관문 — 셸 글의 줄 중 관문을 부르고 삼키지 않는 줄. 반환 { rule, data }.
    upto: 그 단계 run 의 첫 git add 앞 줄만 센다 · 관문 **뒤에** 같은 단계가 관문 경로에 쓰면 그 앞의 관문은 무효(다시 잰 것이 아니다) */
function gatesIn(run, upto = Infinity, ctx = {}) {
  let g = { rule: false, data: false };
  const lines = shLines(run);
  const writes = writeLineSet(run);
  for (let i = 0; i < lines.length && i < upto; i += 1) {
    if (writes.has(i)) { g = { rule: false, data: false }; continue; }
    if (swallowed(lines, i, ctx)) continue;
    if (RULE_GATE_RE.test(lines[i])) g.rule = true;
    if (DATA_GATE_RE.test(lines[i])) g.data = true;
  }
  return g;
}
const firstAddLine = (run) => shLines(run).findIndex((l) => /\bgit\s+add\b/.test(l));

/** 파일을 쓰는 단계인가 — 로봇·도구를 부르는 run(node·python·bash 스크립트) · 관문 경로에 쓰는 셸(> · mv · cp · tee · sed -i · node -e). 관문·되돌리기·알림 도구는 뺀다 */
function producing(s) {
  const run = codeLines(s.run).join('\n');
  if (!run.trim()) return false;
  if (/\bgit\s+add\b/.test(run)) return false;
  return writeLineSet(s.run).size > 0;
}

const normPath = (p) => { const q = p.replace(/^["']|["']$/g, '').replace(/^\.\//, '').replace(/\/+$/, ''); return q === '.' ? '*' : q; };
const coveredBy = (set, p) => set.has('*') || set.has(p) || [...set].some((c) => p.startsWith(`${c}/`));
/** gate-guard 가 **끝까지 돌았을 때** 되돌릴 수 있는 경로 — `--stage a,b`(auto 는 정식 등록 파일의 자동 등록분만 뺀다 → data/registered.json).
    gate-guard 를 부르지 않는 단계면 빈 집합 */
export function guardStageCover(run) {
  const text = shLines(run).join('\n');
  const out = new Set();
  if (!/\bcollector\/gate-guard\.mjs\b/.test(text)) return out;
  /* `if ! … --stage a,b; then` — 꼬리 ; 는 경로가 아니다(리뷰 2차 — 꼬리째 읽어 link-check 의 셋째 파일을 못 덮는다고 봤다) */
  for (const m of text.matchAll(/--stage\s+([^\s;&|)]+)/g)) for (const p of m[1].split(',')) { const q = normPath(p === 'auto' ? 'data/registered.json' : p); if (q) out.add(q); }
  return out;
}
/** 셸 git 되돌리기(`git checkout [HEAD] -- a b` · `git restore a b` · `git clean … -- a b`)가 덮는 경로. `.` 는 '*'(전부) */
function gitRevertCover(text) {
  const out = new Set();
  for (const m of text.matchAll(/\bgit\s+(checkout|restore|clean)\b([^\n;&|]*)/g)) {
    const args = m[2].replace(/\s\d?>\S*/g, ' ').trim().split(/\s+/).filter(Boolean);
    const dd = args.indexOf('--');
    if (m[1] === 'checkout' && dd < 0) continue;            // `git checkout -B x` 는 되돌리기가 아니다
    const paths = (dd >= 0 ? args.slice(dd + 1) : args).filter((a) => !a.startsWith('-') && !(m[1] === 'restore' && /^(HEAD|@)$/.test(a)));
    for (const p of paths) { const q = normPath(p); if (q) out.add(q); }
  }
  return out;
}
/** 되돌리기 단계가 **어느 경우에도** 덮는 경로 — 관문이 빨갈 때 저장 앞에서 반드시 직전 판으로 돌아가는 것.
    🔴 (2026-11-16 리뷰 2차) gate-guard 의 `--stage` 와 `|| git checkout -- …` 예비 줄을 **합치지 않는다** — 예비 줄은 gate-guard 가 **넘어졌을 때**
       (= 아무것도 안 되돌렸을 때)만 돈다. 그래서 gate-guard 를 부르는 단계는 두 쪽에 **다** 든 경로(교집합)만 덮는다:
       도구가 끝까지 돌면 stage 를, 넘어지면 예비 줄을 되돌리기 때문이다(예비 줄이 없으면 넘어진 경우 덮는 것이 없다).
       stage 만 덮는 경로는 저장 if 가 gate-guard 의 결과(outputs.gate)를 요구할 때만 센다(saveGateReport — 넘어지면 결과가 비어 저장하지 않는다).
    gate-guard 가 없는 단계는 git 되돌리기 경로 그대로 */
export function revertCover(run) {
  const text = shLines(run).join('\n');
  const git = gitRevertCover(text);
  const stages = guardStageCover(run);
  if (!/\bcollector\/gate-guard\.mjs\b/.test(text)) return git;
  const out = new Set();
  for (const s of stages) if (coveredBy(git, s)) out.add(s);
  for (const g of git) if (coveredBy(stages, g)) out.add(g);
  return out;
}
/** 저장 경로가 되돌리기에 덮이는가 — 관문이 재는 경로만 따진다. '*'·'?'(전부·변수) 저장은 '*' 되돌리기만 덮는다 */
export function covers(cover, paths) {
  const need = paths.filter((p) => { const n = needsOf([p]); return n.rule || n.data; });
  return need.every((p) => {
    if (cover.has('*')) return true;
    if (p === '*' || p === '?' || p === '.') return false;
    const q = p.replace(/^\.\//, '').replace(/\/+$/, '');
    return [...cover].some((c) => q === c || q.startsWith(`${c}/`));
  });
}

/** 워크플로 글 하나 → 저장 job 마다 { job, needs, has, ok, why } */
export function saveGateReport(yml) {
  const res = [];
  for (const job of jobsOf(yml)) {
    const steps = stepsOf(job.text);
    const saves = steps.map((s, i) => ({ s, i, paths: addedPaths(s.run) })).filter((x) => x.paths.length);
    if (!saves.length) continue;
    const need = { rule: false, data: false };
    for (const x of saves) { const n = needsOf(x.paths); need.rule ||= n.rule; need.data ||= n.data; }
    if (!need.rule && !need.data) continue;
    /* 저장 단계마다 그 앞(같은 job · 마지막 '파일을 쓰는 단계' 뒤)의 관문 중 저장을 막을 수 있는 것 */
    const perSave = saves.map(({ s, i, paths }) => {
      const n = needsOf(paths);
      const got = gatesIn(s.run, firstAddLine(s.run), { shell: s.shell });            // 같은 단계 안에서 git add 앞
      let lastProd = -1;
      for (let k = 0; k < i; k += 1) if (producing(steps[k])) lastProd = k;
      for (let k = lastProd + 1; k < i; k += 1) {
        const g = steps[k];
        const gg = gatesIn(g.run, Infinity, { shell: g.shell });
        if (!gg.rule && !gg.data) continue;
        const cond = String(s.if || '');
        const ok = (id) => new RegExp(`steps\\.${id}\\.(outcome|conclusion)\\s*==\\s*'success'`);
        /* 되돌리기 짝 — 관문 단계와 저장 단계 사이에서 그 관문의 실패를 보고 돌고, 🔴 **저장하는 경로를 전부 덮는** 것만 (2026-11-16 리뷰 —
           `git checkout -- data/a.json` 만 하는 되돌리기 뒤에 data/a.json·data/b.json 을 저장해도 '관문 있음'으로 셌다) */
        const covering = g.id ? steps.slice(k + 1, i).filter((r) => REVERT_RE.test(codeLines(r.run).join('\n'))
          && new RegExp(`steps\\.${g.id}\\.(outcome|conclusion)\\s*==\\s*'failure'`).test(String(r.if || ''))
          && covers(revertCover(r.run), paths)) : [];
        /* gate-guard 가 **다시 재어 초록**이라 말한 결과(reverted-auto · reverted-files · flaky) — 그때는 저장하는 판 전체를 관문이 잰 것이다.
           kept-preexisting 는 빨간 판을 받아들인 것이라 여기 없다(되돌린 판에도 같은 빨간불 → stage 밖 파일이 새로 깨뜨린 것도 '원래 있던 것'으로 보인다) */
        const greenGuards = g.id ? steps.slice(k + 1, i).filter((r) => r.id && /\bcollector\/gate-guard\.mjs\b/.test(codeLines(r.run).join('\n'))
          && new RegExp(`steps\\.${g.id}\\.(outcome|conclusion)\\s*==\\s*'failure'`).test(String(r.if || ''))).map((r) => r.id) : [];
        const greenRe = (id) => new RegExp(`steps\\.${id}\\.outputs\\.gate\\s*==\\s*'(reverted-auto|reverted-files|flaky)'`);
        /* gate-guard 의 stage 가 저장 경로를 전부 덮는 되돌리기 단계 — 저장 if 가 그 결과(outputs.gate 가 무엇이라고 **적혔음**)를 요구할 때만 센다.
           결과는 도구가 끝까지 돌아야 적힌다(main 의 마지막 줄) — 넘어지면 비어 저장이 안 돈다. `!= '어떤 값'` 은 빈 결과도 통과하므로 세지 않는다 */
        const stageGuards = g.id ? steps.slice(k + 1, i).filter((r) => r.id && /\bcollector\/gate-guard\.mjs\b/.test(codeLines(r.run).join('\n'))
          && new RegExp(`steps\\.${g.id}\\.(outcome|conclusion)\\s*==\\s*'failure'`).test(String(r.if || ''))
          && covers(guardStageCover(r.run), paths)).map((r) => r.id) : [];
        const resultRe = (id) => new RegExp(`steps\\.${id}\\.outputs\\.gate\\s*(?:==\\s*'[a-z-]+'|!=\\s*'')`);
        /* 저장 if 가 관문 결과를 본다 — `||` 로 갈린 갈래마다 관문 성공 · gate-guard 의 초록 결과 · stage 가 덮는 gate-guard 의 결과 · **덮는** 되돌리기 단계의 결과 중 하나를 봐야 한다
           (`steps.audit.outcome == 'success' || steps.guard.outputs.gate == 'kept-preexisting'` 에서 guard 가 덮지 않으면 빨간 판이 저장된다) */
        const looksAt = !!g.id && ok(g.id).test(cond)
          && cond.split('||').every((p) => ok(g.id).test(p) || greenGuards.some((id) => greenRe(id).test(p))
            || stageGuards.some((id) => resultRe(id).test(p))
            || covering.some((r) => r.id && p.includes(`steps.${r.id}.`)));
        /* 관문 실패를 보고 **작업을 빨간불로 멈추는** 단계(continue-on-error 없이 마지막 명령이 exit 1~9) — 저장 if 가 always()·failure() 로 덮지 않으면 저장은 돌지 않는다 */
        const stops = !!g.id && !hasAlways(cond) && steps.slice(k + 1, i).some((r) => !truthyCoe(r)
          && new RegExp(`steps\\.${g.id}\\.(outcome|conclusion)\\s*==\\s*'failure'`).test(String(r.if || ''))
          && /^\s*exit\s+[1-9]\s*$/.test(shLines(r.run).filter((l) => l.trim()).pop() || ''));
        const blocks = looksAt || covering.length > 0 || stops || (!truthyCoe(g) && !hasAlways(cond));
        if (!blocks) continue;
        got.rule ||= gg.rule; got.data ||= gg.data;
      }
      const miss = [];
      if (n.rule && !got.rule) miss.push('규칙 관문(test-collector)');
      if (n.data && !got.data) miss.push('데이터 감사(audit-data)');
      return { name: s.name || s.uses || `단계 ${i + 1}`, paths, miss };
    });
    const miss = [...new Set(perSave.flatMap((p) => p.miss))];
    res.push({ job: job.name, need, ok: !miss.length, miss, saves: perSave });
  }
  return res;
}

/** 워크플로 폴더 전부({파일: 글}) → 관문이 없는 저장 job 열쇠(`파일#job`) 목록 */
export function ungatedSavers(files) {
  const out = [];
  for (const [f, yml] of Object.entries(files)) for (const r of saveGateReport(yml)) if (!r.ok) out.push(`${f}#${r.job}`);
  return out.sort();
}

/** 톱니 — 관문 없는 저장 job 과 예외 목록을 맞댄다. fresh = 목록에 없는데 관문 없이 저장(새로 생김) · stale = 목록에 있는데 이제 관문이 있거나 저장 안 함(지울 것) */
export function ratchet(ungated, exceptions) {
  const listed = new Set(Object.keys(exceptions));
  const now = new Set(ungated);
  return { fresh: [...now].filter((k) => !listed.has(k)).sort(), stale: [...listed].filter((k) => !now.has(k)).sort() };
}

/* ── 표본 YAML — 이 저장소 워크플로의 꼴 그대로(jobs: 두 칸 · 단계 여섯 칸) ── */
const wfOf = (steps) => `name: 표본\non:\n  workflow_dispatch:\njobs:\n  run:\n    runs-on: ubuntu-latest\n    timeout-minutes: 10\n    steps:\n      - uses: actions/checkout@v7\n${steps}`;
const ROBOT = '      - name: 로봇\n        run: node collector/robot.mjs\n';
const SAVE = (paths, cond = '') => `      - name: 저장\n${cond ? `        if: ${cond}\n` : ''}        run: |\n          git config user.name bot\n${paths.map((p) => `          [ -f ${p} ] && git add ${p}\n`).join('')}          git commit -m x && git push\n`;
const GATE = (cmds, { id = 'audit', coe = false, cond = '', shell = '' } = {}) => `      - name: 데이터 관문\n        id: ${id}\n${cond ? `        if: ${cond}\n` : ''}${coe ? '        continue-on-error: true\n' : ''}${shell ? `        shell: ${shell}\n` : ''}        run: |\n${cmds.map((c) => `          ${c}\n`).join('')}`;
const TC = 'node verify/test-collector.mjs';
const AU = 'node verify/audit-data.js';
/* 되돌리기 단계(관문 실패 때만) · 관문과 저장을 한 단계에(git add 는 늘 data/a.json) */
const REVERT = (run, id = '') => `      - name: 되돌리기\n${id ? `        id: ${id}\n` : ''}        if: steps.audit.outcome == 'failure'\n        run: |\n${run.split('\n').map((l) => `          ${l}\n`).join('')}`;
const SAME = (cmds) => `      - name: 관문과 저장\n        run: |\n${cmds.map((c) => `          ${c}\n`).join('')}          git add data/a.json\n`;
export const SAMPLES = {
  noGate: wfOf(ROBOT + SAVE(['data/x.json'])),
  gateHard: wfOf(ROBOT + GATE([TC, AU]) + SAVE(['data/x.json', 'collector/x-state.json'])),
  gateSoftAlways: wfOf(ROBOT + GATE([TC, AU], { coe: true }) + SAVE(['data/x.json'], 'always()')),
  gateSoftChecked: wfOf(ROBOT + GATE([TC, AU], { coe: true }) + SAVE(['data/x.json'], "always() && steps.audit.outcome == 'success'")),
  gateSoftGuard: wfOf(ROBOT + GATE([TC, AU], { coe: true })
    + "      - name: 되돌리기\n        id: guard\n        if: steps.audit.outcome == 'failure'\n        run: node collector/gate-guard.mjs --keep-preexisting --stage data/x.json || git checkout -- data/x.json\n"
    + SAVE(['data/x.json'])),
  gateBeforeRobot: wfOf(GATE([TC, AU]) + ROBOT + SAVE(['data/x.json'])),
  auditOnly: wfOf(ROBOT + GATE([AU]) + SAVE(['data/x.json'])),
  ruleOnlyForRules: wfOf(ROBOT + GATE([TC]) + SAVE(['collector/x-state.json', 'collector/x-report.md'])),
  ruleFileNoGate: wfOf(ROBOT + SAVE(['collector/x-state.json'])),
  notRuleFiles: wfOf(ROBOT + SAVE(['collector/x-report.md', 'collector/extracted/x.json', 'insta/seen.json', 'docs/designs/assets/gates'])),
  commentOnly: wfOf(ROBOT + '      - name: 저장\n        run: |\n          # git add data/x.json 은 하지 않는다\n          git add insta/seen.json\n'),
  sameStep: wfOf(ROBOT + `      - name: 관문과 저장\n        run: |\n          ${TC}\n          ${AU}\n          git add data/x.json\n`),
  sameStepSwallow: wfOf(ROBOT + `      - name: 관문과 저장\n        run: |\n          ${TC} || true\n          ${AU} || true\n          git add data/x.json\n`),
  gateAfterSave: wfOf(ROBOT + SAVE(['data/x.json']) + GATE([TC, AU])),
  twoJobs: `${wfOf(ROBOT + GATE([TC, AU]) + SAVE(['data/x.json']))}  other:\n    runs-on: ubuntu-latest\n    timeout-minutes: 5\n    steps:\n${ROBOT}${SAVE(['data/y.json'])}`,
  addAll: wfOf(ROBOT + '      - name: 저장\n        run: |\n          git add -A\n          git commit -m x\n'),
  /* ── 2026-11-16 리뷰 — 관문이 저장을 못 막는데 '관문 있음'으로 세던 꼴(각각 고치기 전 판에서는 통과했다) ── */
  revertPartial: wfOf(ROBOT + GATE([TC, AU], { coe: true }) + REVERT('git checkout -- data/a.json') + SAVE(['data/a.json', 'data/b.json'], 'always()')),
  revertFull: wfOf(ROBOT + GATE([TC, AU], { coe: true }) + REVERT('git checkout -- data/a.json data/b.json') + SAVE(['data/a.json', 'data/b.json'], 'always()')),
  guardKeptPartial: wfOf(ROBOT + GATE([TC, AU], { coe: true }) + REVERT('node collector/gate-guard.mjs --keep-preexisting --stage data/a.json || git checkout -- data/a.json', 'guard')
    + SAVE(['data/a.json', 'data/b.json'], "steps.audit.outcome == 'success' || steps.guard.outputs.gate == 'kept-preexisting'")),
  guardKeptFull: wfOf(ROBOT + GATE([TC, AU], { coe: true }) + REVERT('node collector/gate-guard.mjs --keep-preexisting --stage data/a.json --stage data/b.json || git checkout -- data/a.json', 'guard')
    + SAVE(['data/a.json', 'data/b.json'], "steps.audit.outcome == 'success' || steps.guard.outputs.gate == 'kept-preexisting'")),
  guardGreenOnly: wfOf(ROBOT + GATE([TC, AU], { coe: true }) + REVERT('node collector/gate-guard.mjs --stage data/a.json || git checkout -- data/a.json', 'guard')
    + SAVE(['data/a.json', 'data/b.json'], "always() && (steps.audit.outcome == 'success' || steps.guard.outputs.gate == 'reverted-files' || steps.guard.outputs.gate == 'flaky')")),
  guardAutoAddAll: wfOf(ROBOT + GATE([TC, AU], { coe: true }) + REVERT('node collector/gate-guard.mjs --stage auto', 'guard')
    + '      - name: 저장\n        run: |\n          git add -A\n          git commit -m x\n'),
  revertDotAddAll: wfOf(ROBOT + GATE([TC, AU], { coe: true }) + REVERT('git checkout -- .')
    + '      - name: 저장\n        run: |\n          git add -A\n          git commit -m x\n'),
  stopAfterRevert: wfOf(ROBOT + GATE([TC, AU], { coe: true }) + REVERT('git checkout -- data/a.json\necho "::error::되돌렸습니다"\nexit 1') + SAVE(['data/a.json', 'data/b.json'])),
  stopButAlways: wfOf(ROBOT + GATE([TC, AU], { coe: true }) + REVERT('git checkout -- data/a.json\nexit 1') + SAVE(['data/a.json', 'data/b.json'], 'always()')),
  pipeTee: wfOf(ROBOT + GATE([`${TC} | tee /tmp/tc.txt`, `${AU} | tee /tmp/au.txt`]) + SAVE(['data/a.json'])),
  pipeTeeBash: wfOf(ROBOT + GATE([`${TC} | tee /tmp/tc.txt`, `${AU} | tee /tmp/au.txt`], { shell: 'bash' }) + SAVE(['data/a.json'])),
  pipeTeeSet: wfOf(ROBOT + GATE(['set -o pipefail', `${TC} | tee /tmp/tc.txt`, `${AU} | tee /tmp/au.txt`]) + SAVE(['data/a.json'])),
  ifNotWarn: wfOf(ROBOT + SAME([`if ! ${TC}; then echo 경고; fi`, `if ! ${AU}; then echo 경고; fi`])),
  ifNotExit: wfOf(ROBOT + SAME([`if ! ${TC}; then`, '  echo 실패', '  exit 1', 'fi', `if ! ${AU}; then exit 1; fi`])),
  bangGate: wfOf(ROBOT + SAME([`! ${TC}`, `! ${AU}`])),
  untilGate: wfOf(ROBOT + SAME([`until ${TC}; do sleep 1; done`, `until ${AU}; do sleep 1; done`])),
  orAnything: wfOf(ROBOT + SAME([`${TC} || touch /tmp/failed`, `${AU} || node tools/alert-issue.mjs --mode open`])),
  orExitBlock: wfOf(ROBOT + SAME([`${TC} || {`, '  echo 실패', '  exit 1', '}', `${AU} || exit 2`])),
  andChain: wfOf(ROBOT + SAME([`${TC} && echo 규칙 통과`, `${AU} && echo 감사 통과`])),
  writeMvAfter: wfOf(ROBOT + GATE([TC, AU]) + '      - name: 손질\n        run: |\n          jq . data/a.json > /tmp/t && mv /tmp/t data/a.json\n' + SAVE(['data/a.json'])),
  writeRedirectAfter: wfOf(ROBOT + GATE([TC, AU]) + '      - name: 손질\n        run: echo "{}" > data/a.json\n' + SAVE(['data/a.json'])),
  writeNodeEAfter: wfOf(ROBOT + GATE([TC, AU]) + `      - name: 손질\n        run: |\n          node -e "const fs=require('fs');\n            fs.writeFileSync('data/a.json','{}')"\n` + SAVE(['data/a.json'])),
  readNodeEAfter: wfOf(ROBOT + GATE([TC, AU]) + `      - name: 읽기만\n        run: node -e "JSON.parse(require('fs').readFileSync('data/a.json','utf8'))"\n` + SAVE(['data/a.json'])),
  sameStepWriteAfter: wfOf(ROBOT + SAME([TC, AU, 'cp /tmp/new.json data/a.json'])),
  /* ── 2026-11-16 리뷰 2차 — gate-guard 가 넘어지면(예외 · exit 1) `||` 예비 줄만 돈다. stage 와 예비 줄을 합쳐 세면 예비 줄이 덮지 않는 경로가
        관문 없이 저장된다(수집 두 로봇: 정식 등록 파일이 깨진 JSON 이면 auto 단계가 넘어지고 예비 줄은 정식 등록·양식·대기열만 되돌려, 장부·공고 피드가 빨간 채 저장) ── */
  guardCrashPartial: wfOf(ROBOT + GATE([TC, AU], { coe: true }) + REVERT('node collector/gate-guard.mjs --keep-preexisting --stage data/a.json --stage data/b.json || git checkout -- data/a.json', 'guard')
    + SAVE(['data/a.json', 'data/b.json'])),
  guardCrashFull: wfOf(ROBOT + GATE([TC, AU], { coe: true }) + REVERT('node collector/gate-guard.mjs --keep-preexisting --stage data/a.json --stage data/b.json || git checkout -- data/a.json data/b.json', 'guard')
    + SAVE(['data/a.json', 'data/b.json'])),
  guardNoFallbackAlways: wfOf(ROBOT + GATE([TC, AU], { coe: true }) + REVERT('node collector/gate-guard.mjs --stage data/a.json,data/b.json\nexit 1', 'guard')
    + SAVE(['data/a.json', 'data/b.json'], 'always()')),
  guardResultRequired: wfOf(ROBOT + GATE([TC, AU], { coe: true }) + REVERT('node collector/gate-guard.mjs --keep-preexisting --stage data/a.json --stage data/b.json || { echo 넘어짐; exit 1; }', 'guard')
    + SAVE(['data/a.json', 'data/b.json'], "steps.audit.outcome == 'success' || steps.guard.outputs.gate != ''")),
  guardResultAlwaysRequired: wfOf(ROBOT + GATE([TC, AU], { coe: true }) + REVERT('node collector/gate-guard.mjs --keep-preexisting --stage data/a.json --stage data/b.json || git checkout -- data/a.json\nexit 1', 'guard')
    + SAVE(['data/a.json', 'data/b.json'], "always() && (steps.audit.outcome == 'success' || steps.guard.outputs.gate != '')")),
  guardResultNeqValue: wfOf(ROBOT + GATE([TC, AU], { coe: true }) + REVERT('node collector/gate-guard.mjs --keep-preexisting --stage data/a.json --stage data/b.json || git checkout -- data/a.json', 'guard')
    + SAVE(['data/a.json', 'data/b.json'], "steps.audit.outcome == 'success' || steps.guard.outputs.gate != 'still-failing'")),
};

export default async function gate(eq, ctx) {
  const root = ctx.root;
  const DOC_GATES = ctx.docGates ?? (!process.env.GITHUB_ACTIONS || process.env.DOC_GATES === '1');
  const eqWf = softEq(eq, DOC_GATES);
  if (!DOC_GATES) console.log('  (로봇 워크플로 — 실제 워크플로 대조는 어긋나도 경고만 · verify-ui.yml 과 로컬에서는 실패)');

  /* ① 표본 red-green — 규칙이 무력해지면(늘 통과) 여기서 빨개진다 */
  const ok = (k) => saveGateReport(SAMPLES[k]).map((r) => [r.job, r.ok, r.miss]);
  eq('① 관문 없이 data/ 를 저장 → 둘 다 빠짐', ok('noGate'), [['run', false, ['규칙 관문(test-collector)', '데이터 감사(audit-data)']]]);
  eq('  로봇 뒤·저장 앞 관문(continue-on-error 없음 · 저장 단계 if 없음) → 통과', ok('gateHard'), [['run', true, []]]);
  eq('  관문이 continue-on-error 인데 저장이 always() 로 덮으면 → 관문이 저장을 못 막는다', ok('gateSoftAlways').map((r) => r[1]), [false]);
  eq('  continue-on-error 라도 저장 if 가 관문 성공을 보면 → 통과', ok('gateSoftChecked').map((r) => r[1]), [true]);
  eq('  continue-on-error 라도 관문 실패를 보고 되돌리는(gate-guard) 단계가 사이에 있으면 → 통과', ok('gateSoftGuard').map((r) => r[1]), [true]);
  eq('  관문이 로봇보다 **앞**이면(파일을 쓰기 전에 잰 것) → 빠짐', ok('gateBeforeRobot').map((r) => r[1]), [false]);
  eq('  관문이 저장 **뒤**면 → 빠짐', ok('gateAfterSave').map((r) => r[1]), [false]);
  eq('  data/ 인데 감사만 → 규칙 관문 빠짐', ok('auditOnly'), [['run', false, ['규칙 관문(test-collector)']]]);
  eq('  collector/*.json 만 → 규칙 관문만 있으면 통과 · 없으면 빠짐', [ok('ruleOnlyForRules'), ok('ruleFileNoGate')],
    [[['run', true, []]], [['run', false, ['규칙 관문(test-collector)']]]]);
  eq('  리포트(.md)·하위 폴더(collector/extracted/)·insta/·docs/ 만 저장 → 저장 로봇이 아니다', [ok('notRuleFiles'), ok('commentOnly')], [[], []]);
  eq('  같은 단계에서 관문이 git add 앞 → 통과 · `|| true` 로 삼키면 → 빠짐', [ok('sameStep').map((r) => r[1]), ok('sameStepSwallow').map((r) => r[1])], [[true], [false]]);
  eq('  job 마다 따로 본다 — 관문은 그 job 안에 있어야 한다', ok('twoJobs').map((r) => [r[0], r[1]]), [['run', true], ['other', false]]);
  eq('  `git add -A`(경로 없음) → 전부로 센다', ok('addAll').map((r) => r[1]), [false]);
  eq('  경로 읽기 — 줄 이어 쓰기 · 꼬리 주석 · 2>/dev/null · 변수', addedPaths('git add data/a.json \\\n  collector/b.json # 설명\ngit add insta/c.json 2>/dev/null || true\ngit add "$f"'),
    ['data/a.json', 'collector/b.json', 'insta/c.json', '?']);

  /* ①-2 (2026-11-16 리뷰) 되돌리기는 **저장하는 경로를 전부** 덮어야 저장을 막는다 · 관문 줄을 삼키는 꼴 · 관문 뒤에 쓰는 꼴.
     각 '빠짐' 표본은 고치기 전 판에서 '통과'였다(red-green) — 늘 통과로 돌아가면 여기서 빨개진다 */
  const okv = (k) => ok(k).map((r) => r[1]);
  eq('①-2 되돌리기가 a 만 덮는데 always() 로 a·b 저장 → 빠짐 · 둘 다 덮으면 → 통과',
    [okv('revertPartial'), okv('revertFull')], [[false], [true]]);
  eq('  gate-guard stage 가 a 만인데 kept-preexisting(빨간 판 받아들임)에도 a·b 저장 → 빠짐 · stage 가 a·b 를 덮으면 → 통과',
    [okv('guardKeptPartial'), okv('guardKeptFull')], [[false], [true]]);
  eq('  gate-guard 가 다시 재어 초록일 때만(reverted-files·flaky) 저장 → stage 밖 경로도 잰 판이라 통과',
    okv('guardGreenOnly'), [true]);
  eq('  `git add -A` 는 auto 단계(자동 등록분만 뺀다)로 못 덮는다 · `git checkout -- .` 는 덮는다',
    [okv('guardAutoAddAll'), okv('revertDotAddAll')], [[false], [true]]);
  eq('  되돌리기가 exit 1 로 작업을 멈추면 저장은 안 돈다 → 통과 · 저장이 always() 면 → 빠짐',
    [okv('stopAfterRevert'), okv('stopButAlways')], [[true], [false]]);
  eq('  `관문 | tee` — 기본 셸(pipefail 없음) → 빠짐 · shell: bash 나 set -o pipefail → 통과',
    [okv('pipeTee'), okv('pipeTeeBash'), okv('pipeTeeSet')], [[false], [true], [true]]);
  eq('  관문을 조건으로(if ! … then echo · ! … · until …) → 빠짐 · if ! … then exit 1 → 통과',
    [okv('ifNotWarn'), okv('bangGate'), okv('untilGate'), okv('ifNotExit')], [[false], [false], [false], [true]]);
  eq('  `관문 || 무엇이든`(exit 없음) · `관문 && …`(끝 명령 아님) → 빠짐 · `|| { …; exit 1; }` · `|| exit 2` → 통과',
    [okv('orAnything'), okv('andChain'), okv('orExitBlock')], [[false], [false], [true]]);
  eq('  관문 뒤 다른 단계가 data/ 에 쓴다(> · jq … && mv · node -e writeFileSync) → 빠짐 · node -e 로 읽기만 → 통과',
    [okv('writeRedirectAfter'), okv('writeMvAfter'), okv('writeNodeEAfter'), okv('readNodeEAfter')], [[false], [false], [false], [true]]);
  eq('  같은 단계에서 관문 뒤 git add 앞에 cp 로 data/ 에 쓴다 → 빠짐', okv('sameStepWriteAfter'), [false]);
  eq('  되돌리기가 덮는 경로 읽기 — gate-guard --stage(auto → 정식 등록) · git checkout [HEAD] -- · git restore · git clean · `.` 는 전부',
    [[...guardStageCover('node collector/gate-guard.mjs --stage auto --stage data/x.json,collector/y.json || git checkout -- data/z.json')],
      [...revertCover('git checkout HEAD -- data/news\ngit clean -fdq -- data/news\ngit restore collector/a.json')], [...revertCover('git checkout -- .')], [...revertCover('git checkout -B deploy origin/main')]],
    [['data/registered.json', 'data/x.json', 'collector/y.json'], ['data/news', 'collector/a.json'], ['*'], []]);

  /* ①-3 (2026-11-16 리뷰 2차) gate-guard 가 넘어지면 `||` 예비 줄만 돈다 — 어느 경우에도 덮는 것은 stage 와 예비 줄의 **교집합**.
     각 '빠짐' 표본과 교집합 값은 고치기 전 판(stage ∪ 예비 줄)에서 '통과'·합집합이었다(red-green) */
  eq('①-3 gate-guard stage a·b + 예비 줄 a → 어느 경우에도 덮는 것은 a 뿐 · 폴더는 그 안의 파일까지 · 예비 줄 없으면 없음',
    [[...revertCover('node collector/gate-guard.mjs --stage data/a.json,data/b.json || git checkout -- data/a.json')],
      [...revertCover('node collector/gate-guard.mjs --stage data/news,collector/s.json || { git checkout -- data/news/x.json; git clean -fdq -- data/news; }')],
      [...revertCover('node collector/gate-guard.mjs --stage data/a.json')],
      [...guardStageCover('if ! node collector/gate-guard.mjs --stage data/a.json,collector/b.json; then exit 1; fi')]],
    [['data/a.json'], ['data/news', 'data/news/x.json'], [], ['data/a.json', 'collector/b.json']]);
  eq('  예비 줄이 a 만 되돌리는데 a·b 를 조건 없이 저장(수집 두 로봇의 꼴) → 빠짐 · 예비 줄이 a·b 를 되돌리면 → 통과',
    [okv('guardCrashPartial'), okv('guardCrashFull')], [[false], [true]]);
  eq('  예비 줄 없이 always() 로 저장 → 넘어지면 아무것도 안 되돌린 채 저장 → 빠짐',
    okv('guardNoFallbackAlways'), [false]);
  eq("  저장 if 가 gate-guard 결과를 요구(`!= ''` · always() 안에서도) → stage 가 덮으면 통과 · `!= '어떤 값'` 은 빈 결과도 통과시켜 → 빠짐",
    [okv('guardResultRequired'), okv('guardResultAlwaysRequired'), okv('guardResultNeqValue')], [[true], [true], [false]]);

  /* ② 톱니 — 새 저장 로봇은 빨간불 · 목록에 있는데 관문이 생기면 그것도 빨간불(목록은 줄기만 한다) */
  eq('② 톱니 — 목록에 없는 관문 없는 저장 job 은 fresh · 관문이 생긴 목록 항목은 stale',
    ratchet(['a.yml#x', 'b.yml#y'], { 'b.yml#y': '이유', 'c.yml#z': '이유' }), { fresh: ['a.yml#x'], stale: ['c.yml#z'] });

  /* ③ 실제 워크플로 — 관문 없는 저장 job == 예외 목록(이유 한 줄씩) */
  const dir = new URL('.github/workflows/', root);
  const files = Object.fromEntries(fs.readdirSync(dir).filter((f) => f.endsWith('.yml')).sort()
    .map((f) => [f, fs.readFileSync(new URL(f, dir), 'utf8').replace(/\r/g, '')]));
  const savers = Object.entries(files).flatMap(([f, y]) => saveGateReport(y).map((r) => `${f}#${r.job}`));
  eq('③ 실제 워크플로에서 저장 job 을 읽었다(0 이면 읽는 눈이 무력해진 것)', savers.length > 5, true);
  const { fresh, stale } = ratchet(ungatedSavers(files), SAVE_GATE_EXCEPTIONS);
  const why = (k) => {
    const [f, j] = k.split('#');
    const r = files[f] && saveGateReport(files[f]).find((x) => x.job === j);
    return r ? `${k} — 빠진 것: ${r.miss.join('·')}` : k;
  };
  eqWf('  관문 없이 저장하는 **새** job 이 없다 — 저장 앞에 관문(test-collector · data/ 면 audit-data)을 붙인다(예외 목록에 더하지 말 것)', fresh.map(why), []);
  eqWf('  예외 목록의 job 이 이제 관문을 갖췄거나 저장하지 않는다 — SAVE_GATE_EXCEPTIONS 에서 지운다(목록은 줄기만 한다)', stale, []);
  eq('  예외마다 이유 한 줄(10자 이상 · 줄바꿈 없음)', Object.entries(SAVE_GATE_EXCEPTIONS).filter(([, w]) => !(typeof w === 'string' && w.trim().length >= 10 && !/\n/.test(w))).map(([k]) => k), []);

  /* ③-2 (2026-11-17 · G-16 나머지) 관문이 재지 않는 자리만 저장하는 job — 이름과 이유로 붙잡는다(조용히 '저장 로봇 아님'으로 빠지지 않게) */
  const outSample = outsideGateSavers({ 'a.yml': SAMPLES.notRuleFiles, 'b.yml': SAMPLES.noGate, 'c.yml': SAMPLES.ruleOnlyForRules });
  eq('③-2 표본 — insta/·docs/·extracted·리포트만 저장하는 job 만 잡는다(data/·collector/*.json 저장 job 은 위 규칙 몫)',
    outSample, { 'a.yml#run': ['collector/x-report.md', 'collector/extracted/x.json', 'insta/seen.json', 'docs/designs/assets/gates'] });
  const readTexts = { 'app.js': "fetch('assets/gates/gates.json')", 'collector/x.mjs': "readFileSync('insta/seen.json')", 'collector/y.mjs': 'collector/extracted/ts-1.txt' };
  eq('  읽는 쪽 대조 — 경로를 글자로 부르는 파일만(`*` 앞까지 · docs/ 사본은 assets/ 와 다르다)',
    [readersOf(['insta/seen.json'], readTexts), readersOf(['collector/extracted/ts-*.*'], readTexts), readersOf(['docs/designs/assets/gates'], readTexts)],
    [['collector/x.mjs'], ['collector/y.mjs'], []]);
  const outside = outsideGateSavers(files);
  const rOut = ratchet(Object.keys(outside), OUTSIDE_GATE_SAVERS);
  eqWf('  관문이 재지 않는 자리만 저장하는 **새** job 이 없다 — OUTSIDE_GATE_SAVERS 에 이유를 적거나, 앱·로봇이 읽는 파일이면 관문을 붙인다', rOut.fresh.map((k) => `${k} — ${outside[k].join(' ')}`), []);
  eqWf('  목록의 job 이 이제 관문 대상(data/·collector/*.json)을 저장하거나 저장을 그만뒀다 — OUTSIDE_GATE_SAVERS 에서 지운다', rOut.stale, []);
  eq('  이유마다 한 줄(20자 이상 · 줄바꿈 없음) · readers 는 배열', Object.entries(OUTSIDE_GATE_SAVERS)
    .filter(([, v]) => !(v && typeof v.why === 'string' && v.why.trim().length >= 20 && !/\n/.test(v.why) && Array.isArray(v.readers))).map(([k]) => k), []);
  /* 앱(뿌리 *.js·*.html)과 수집 로봇(collector/*.mjs·*.cjs) 가운데 그 경로를 부르는 파일은 readers 뿐 — 다른 데서 읽기 시작하면 '아무도 안 읽는다'는 이유가 낡은 것 */
  const listDir = (rel, re) => fs.readdirSync(new URL(rel, root)).filter((f) => re.test(f)).map((f) => rel + f);
  const appAndRobots = Object.fromEntries([...listDir('', /\.(js|html)$/), ...listDir('collector/', /\.(mjs|cjs)$/)]
    .map((f) => [f, fs.readFileSync(new URL(f, root), 'utf8')]));
  eqWf('  앱·수집 로봇 중 그 경로를 부르는 것은 readers 뿐(읽기 시작하면 관문을 붙이고 목록에서 지운다)',
    Object.entries(outside).filter(([k]) => OUTSIDE_GATE_SAVERS[k])
      .flatMap(([k, paths]) => readersOf(paths, appAndRobots).filter((f) => !OUTSIDE_GATE_SAVERS[k].readers.includes(f)).map((f) => `${k} ← ${f}`)), []);
}

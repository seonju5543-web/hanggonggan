/* 한국장학재단(KOSAF) 선발공고문 사본 받기 (2026-09-12 개발자 지시로 신설)
 *
 * 개발자 지적: *"KOSAF 에서 크롤링 해오는 외부 공고들은 신청 양식 / 첨부파일 /
 * 원문 공고 링크만 없고 해당 장학 재단으로만 이동할 수 있는 구조"* — 맞다.
 * 층2 재단 100여 곳이 학생에게 주는 것이 **재단 홈페이지 주소 하나**뿐이었다.
 * 홈페이지에 들어가도 그 공고가 어디 있는지는 학생이 다시 찾아야 한다.
 *
 * 🔴 왜 '링크를 담기'가 아니라 '받아서 두기'인가
 *   ① KOSAF 상세 화면은 **POST 전용**이다 — 학생에게 줄 주소 자체가 없다.
 *   ② 첨부 주소는 **Referer 검사**가 있다. 앱은 리퍼러를 안 보내므로(index.html 의
 *      `referrer` 정책) 그 주소를 그대로 담으면 학생 화면엔 "비정상적인 접근"이 뜬다.
 *      → 그래서 이 로봇이 **리퍼러를 붙여 받아** `data/kosaf-files/` 에 둔다.
 *        학생은 우리 도메인에서 받으므로 리퍼러가 필요 없다.
 *   ③ 덤이 더 크다: 받아 둔 공고문 **글자**가 마감일·자격·검색·신청 양식 스키마화의
 *      재료가 된다. 지금까지 층2 에 그 재료가 한 글자도 없었다.
 *
 * 🔴 되돌리지 말 것
 *   · **앱 파일(kosaf-open.json)에는 우리 쪽 경로만** 담는다. kosaf.go.kr 주소를 담으면
 *     학생이 못 받고, 관문(`kosaf-check.mjs`)이 막는다.
 *   · **HTML 을 파일로 저장하지 않는다.** KOSAF 는 막을 때 404 가 아니라 **200 에 HTML** 로
 *     답한다 — 그걸 그대로 저장하면 학생이 '공고문'을 눌러 오류 화면을 내려받는다.
 *   · **빈 .txt 를 남기지 않는다**(pdf-text.py 와 같은 이유) — 다음 실행이 '이미 뽑았다'고
 *     착각하고 영영 건너뛴다.
 *   · **마감된 재단의 사본은 지운다.** 안 지우면 저장소가 회차마다 불어난다.
 *
 * 실행:
 *   node collector/kosaf-attach.mjs --probe [--max=3]   ← 첨부 칸이 어떻게 생겼는지만 본다
 *   node collector/kosaf-attach.mjs --write [--budget-min=8]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeBudget } from './harvest-budget.mjs';
import { slimKosaf } from './kosaf-open.mjs';
import {
  createSession, parseFiles, fileCellHtml, filenameFrom, nameFromUrl, safeFileName,
  looksLikeHtml, sniffKind,
} from './kosaf-session.mjs';

const arg = (k, d) => {
  const a = process.argv.find((x) => x.startsWith(`--${k}=`));
  return a ? a.split('=')[1] : d;
};
const WRITE = process.argv.includes('--write');
const PROBE = process.argv.includes('--probe');
const MAX = Number(arg('max', 0));

/* 한 파일 12MB · 한 실행 40MB. 저장소가 회차마다 불어나지 않게 하는 유일한 장치다
   (아래 '지난 회차 사본 지우기'와 한 쌍). 공고문은 보통 0.2~2MB 라 넉넉하다. */
const MAX_FILE = 12 << 20;
const MAX_RUN = 40 << 20;

/* 🔴 **디스크 경로를 URL 로 다루지 않는다** (2026-09-12 코드 리뷰).
   `new URL(name, dir)` 는 이름을 주소로 읽는다 — `(등록금 100% 지원).hwp` 는 퍼센트
   escape 로 읽혀 `URIError` 로 실행을 죽이고(그 재단에서 매 실행 영영 멈춘다),
   `공고문#2.pdf` 는 `#` 뒤가 조각으로 잘려 **장부와 다른 이름으로** 저장된다
   (그러면 관문의 '적어 둔 사본이 실제로 있다'가 실패해 그날 수확분까지 저장이 건너뛰어진다).
   경로는 `path.join` 으로만 만든다. */
const ROOT_DIR = fileURLToPath(new URL('../', import.meta.url));
const FILES_DIR = path.join(ROOT_DIR, 'data', 'kosaf-files');
const REPORT = path.join(ROOT_DIR, 'collector', 'kosaf-attach-report.md');
const KOSAF_JSON = path.join(ROOT_DIR, 'data', 'kosaf.json');

const today = new Date().toISOString().slice(0, 10);
const full = JSON.parse(fs.readFileSync(KOSAF_JSON, 'utf8'));

/* 🔴 '지금 열려 있는 재단'의 정의를 **베끼지 않는다** — 앱이 받는 파일을 만드는
   slimKosaf 를 그대로 불러 같은 답을 쓴다. 베끼면 앱엔 있는데 사본은 없는(또는 그 반대)
   재단이 생긴다. */
const openCodes = new Set(slimKosaf(full, today).items.map((i) => i.code));
const byCode = new Map((full.items || []).map((i) => [i.code, i]));

const log = [];
const say = (s) => { console.log(s); log.push(s); };

/* ── 정찰 모드 — 첨부 칸이 실제로 어떻게 생겼는지 **눈으로 본다** ──────────────
   🔴 이 저장소의 규칙이다: 짐작으로 주소를 만들지 말 것(CLAUDE.md '원문 링크'·'정찰').
      KOSAF 첨부가 `<a href>` 인지 `onclick="fn_…()"` 인지 확인하지 않고 받으러 가면
      조용히 0건이 되고, 원인을 토큰·헤더로 잘못 짚게 된다(실제로 두 번 그랬다). */
async function probe(session) {
  const targets = (full.items || []).filter((i) => openCodes.has(i.code)).slice(0, MAX || 3);
  for (const it of targets) {
    const html = await session.detailHtml(it.code);
    const cell = fileCellHtml(html);
    say(`\n── ${it.org} / ${it.name} (code ${it.code})`);
    say(`  상세 응답 ${html.length.toLocaleString()}자 ${html.length < 100000 ? '⚠ 껍데기일 수 있습니다' : ''}`);
    say(`  첨부 칸 날것: ${cell ? cell.replace(/\s+/g, ' ').slice(0, 900) : '(못 찾음)'}`);
    say(`  parseFiles: ${JSON.stringify(parseFiles(html))}`);
    await new Promise((r) => setTimeout(r, 250));
  }
}

/* ── 사본 받기 ───────────────────────────────────────────────────────────── */
let runBytes = 0;
const stat = { got: 0, skipped: 0, blocked: 0, tooBig: 0, unresolved: 0, pruned: 0 };
const unresolvedSamples = [];

function mirrorAlive(it) {
  const m = it.mirror;
  if (!m || !Array.isArray(m.files) || !m.files.length) return false;
  /* 장부에 적힌 파일이 실제로 디스크에 있어야 '이미 받았다'이다 —
     장부만 보면 지운 파일을 영영 다시 안 받는다(푸시 등록 ①과 같은 유형). */
  if (!m.files.every((f) => fs.existsSync(path.join(ROOT_DIR, f.path)))) return false;
  /* 🔴 **재단이 새 회차 공고문으로 갈아 끼우면 다시 받아야 한다** (2026-09-12 코드 리뷰).
     파일이 있다는 것만 보면, 지난 회차 공고문을 학생에게 영영 보여 주게 된다.
     상세를 새로 받을 때 첨부 주소도 새로 오므로, 그 주소가 달라졌으면 낡은 것이다. */
  const now = (it.files || []).map((f) => f.url || '').filter(Boolean).sort().join('|');
  return !now || now === (m.from || '');
}

async function mirrorOne(session, it) {
  const files = it.files || [];
  if (!files.length) return;
  if (mirrorAlive(it)) { stat.skipped += 1; return; }

  const dir = path.join(FILES_DIR, it.code);
  fs.mkdirSync(dir, { recursive: true });
  const saved = [];
  /* 🔴 **중간에 멈춰도 받아 둔 것은 장부에 적는다** (2026-09-12 코드 리뷰).
     예전엔 상한에 걸리면 그냥 `return` 해서, 이미 받아 커밋될 파일이 장부에 없는
     '주인 없는 이진 파일'이 되고 다음 실행이 같은 것을 또 받았다.
     '넘어져도 저장'(2026-08-01 사냥꾼 사고)과 같은 규칙이다. */
  const keep = () => {
    if (saved.length) it.mirror = { at: today, from: (it.files || []).map((f) => f.url || '').filter(Boolean).sort().join('|'), files: saved };
  };
  for (const [n, f] of files.entries()) {
    if (!f.url) {
      stat.unresolved += 1;
      if (unresolvedSamples.length < 5) unresolvedSamples.push(`${it.org}: ${f.raw || JSON.stringify(f)}`);
      continue;
    }
    /* 예산·상한을 **파일 사이에서도** 본다 — 재단 사이에서만 보면 파일이 여럿인 한 곳이
       재시도(건당 최대 60초×3)를 타는 동안 단계 상한을 넘겨 **취소**되고, 취소는
       실패가 아니라서 saveAll() 도 안 돈다(2026-08-04에 배운 것). */
    if (runBytes >= MAX_RUN || budget.expired()) { keep(); return; }
    let res;
    try { res = await session.download(f.url); } catch { stat.blocked += 1; continue; }
    if (!res.ok) { stat.blocked += 1; say(`  ✕ ${it.org} — HTTP ${res.status}`); continue; }
    const buf = Buffer.from(await res.arrayBuffer());
    /* 🔴 막힐 때 200 에 HTML 이 온다 — 그걸 저장하면 학생이 오류 화면을 '공고문'으로 받는다 */
    if (looksLikeHtml(buf)) {
      stat.blocked += 1;
      say(`  ✕ ${it.org} — 파일 대신 HTML 이 왔습니다 (리퍼러 검사에 걸렸을 수 있습니다)`);
      continue;
    }
    if (buf.length > MAX_FILE) { stat.tooBig += 1; say(`  · ${it.org} — ${(buf.length / (1 << 20)).toFixed(1)}MB 라 건너뜁니다`); continue; }
    if (buf.length < 512) { stat.blocked += 1; continue; }

    /* 이름은 **주소에 적힌 것을 먼저** 쓴다(KOSAF 가 `FileNameDn=` 에 넣어 준다) —
       헤더는 관공서 서버마다 인코딩이 제각각이라 깨질 길이 셋이다. 둘 다 없으면 우리가 짓는다. */
    const shown = nameFromUrl(f.url) || filenameFrom(res.headers.get('content-disposition'), '')
      || `선발공고문-${n + 1}`;
    let name = safeFileName(shown, `선발공고문-${n + 1}`);
    /* 확장자가 없으면 앞 바이트로 정한다 — 확장자를 믿지 않는다(PDF 가 .bin 으로 오던 일) */
    const kind = sniffKind(buf);
    if (!/\.[A-Za-z0-9]{2,5}$/.test(name) && kind) name += kind === 'ole' ? '.hwp' : `.${kind}`;

    fs.writeFileSync(path.join(dir, name), buf);
    runBytes += buf.length;
    stat.got += 1;
    saved.push({ name: shown, path: `data/kosaf-files/${it.code}/${name}`, bytes: buf.length, kind: kind || '' });
    say(`  ✓ ${it.org} — ${name} (${Math.round(buf.length / 1024)}KB)`);
    await new Promise((r) => setTimeout(r, 300));
  }
  keep();
}

/* 🔴 **지난 회차 사본은 지운다.** 안 지우면 저장소가 회차마다 불어난다(1년이면 수백 MB).
   앱이 보여 주는 것은 마감 전 재단뿐이라, 목록에서 나간 재단의 사본은 아무도 안 본다. */
function prune() {
  if (!fs.existsSync(FILES_DIR)) return;
  for (const code of fs.readdirSync(FILES_DIR)) {
    if (openCodes.has(code)) continue;
    fs.rmSync(path.join(FILES_DIR, code), { recursive: true, force: true });
    const it = byCode.get(code);
    if (it) delete it.mirror;
    stat.pruned += 1;
  }
}

/* 🔴 넘어져도 저장한다 — 오래 걸리는 로봇의 규칙(2026-08-01 사냥꾼 사고).
   4분 동안 찾은 주소 13건이 마지막 줄의 낱말 하나 때문에 통째로 버려진 적이 있다. */
let savedOnce = false;
function saveAll() {
  if (!WRITE || savedOnce) return;
  savedOnce = true;
  fs.writeFileSync(KOSAF_JSON, `${JSON.stringify(full, null, 1)}\n`);
  const slim = slimKosaf(full, today);
  fs.writeFileSync(path.join(ROOT_DIR, 'data', 'kosaf-open.json'), `${JSON.stringify(slim, null, 1)}\n`);
  const withFile = slim.items.filter((i) => (i.files || []).length).length;
  const head = `# 한국장학재단 첨부 사본 — ${new Date().toISOString().slice(0, 16).replace('T', ' ')}\n\n`
    + `| | |\n|---|---|\n`
    + `| 새로 받음 | ${stat.got}개 |\n| 이미 있던 것 | ${stat.skipped}곳 |\n`
    + `| 못 받음(막힘) | ${stat.blocked}개 |\n| 주소를 못 만듦 | ${stat.unresolved}개 |\n`
    + `| 너무 큼 | ${stat.tooBig}개 |\n| 지난 회차 정리 | ${stat.pruned}곳 |\n`
    + `| **앱에서 공고문을 볼 수 있는 재단** | **${withFile} / ${slim.count}곳** |\n\n`
    + (unresolvedSamples.length
      ? `## 주소를 못 만든 첨부의 날것 (다음 수리의 근거)\n\n\`\`\`\n${unresolvedSamples.join('\n')}\n\`\`\`\n\n`
      : '')
    + '## 실행 기록\n\n```\n';
  fs.writeFileSync(REPORT, `${head}${log.join('\n')}\n\`\`\`\n`);
  console.log(`\n→ data/kosaf.json · kosaf-open.json · ${path.basename(REPORT)} 저장`);
}
process.on('uncaughtException', (e) => { console.error(e); saveAll(); process.exit(1); });
process.on('unhandledRejection', (e) => { console.error(e); saveAll(); process.exit(1); });

/* ── 실행 ─────────────────────────────────────────────────────────────────── */
const session = createSession();
try {
  await session.open();
} catch (e) {
  console.error(`✕ ${e.message}`);
  process.exit(1);
}

if (PROBE) {
  await probe(session);
  console.log('\n(정찰만 했습니다 — 받으려면 --write)');
  process.exit(0);
}

const targets = (full.items || [])
  .filter((i) => openCodes.has(i.code) && (i.files || []).length);
say(`대상: 열려 있는 ${openCodes.size}곳 중 첨부 링크가 있는 ${targets.length}곳`);

/* 🔴 **`--write` 가 없으면 아무것도 만지지 않는다** (2026-09-12 코드 리뷰).
   예전엔 화면에만 '(미리보기)'라 찍고 파일은 실제로 받고 지난 회차 폴더까지 지웠다 —
   '미리보기'라는 말을 믿고 돌린 사람에게 거짓말이 된다. 이 저장소의 다른 로봇
   (kosaf-fetch·kosaf-open)도 --write 없이는 쓰지 않는다. */
if (!WRITE) {
  const need = targets.filter((i) => !mirrorAlive(i)).length;
  console.log(`(미리보기 — 받을 곳 ${need}곳 · 이미 받아 둔 곳 ${targets.length - need}곳. 실제로 받으려면 --write)`);
  process.exit(0);
}

const budget = makeBudget(Number(arg('budget-min', 8)) * 60000);
let left = 0;
for (const [i, it] of (MAX ? targets.slice(0, MAX) : targets).entries()) {
  if (budget.expired() || runBytes >= MAX_RUN) { left = targets.length - i; break; }
  await mirrorOne(session, it);
}
if (left) say(`⏱ 예산을 다 써 ${left}곳은 다음 실행으로 넘깁니다 (이미 받은 것은 다시 안 받습니다)`);

prune();
say(`\n새로 ${stat.got}개(${Math.round(runBytes / 1024)}KB) · 이미 있던 곳 ${stat.skipped} · `
  + `막힘 ${stat.blocked} · 주소 못 만듦 ${stat.unresolved} · 큰 파일 ${stat.tooBig} · 정리 ${stat.pruned}곳`);
saveAll();

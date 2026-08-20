/* 심층 수집: notices.json의 모든 공고 본문 전문 + 지정 공고의 첨부파일 원본을
   저장소(collector/extracted/)에 저장한다. 정식 등록 큐레이션의 원천 자료. */
import fs from 'node:fs';
import { isHtmlPayload } from './attachment-link.mjs';
import { canonUrl, normTitle, indexTexts, sourceFor, needsFetch } from './notice-source.mjs';

const HERE = new URL('.', import.meta.url);
const OUT = new URL('extracted/', HERE);
fs.mkdirSync(OUT, { recursive: true });

const notices = JSON.parse(fs.readFileSync(new URL('../data/notices.json', HERE), 'utf8'));
const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; HandaejangBot/0.2)' };

/* 첨부 원본까지 내려받을 공고 (제목 부분일치).
   우선순위: 환경변수 FORM_TARGETS > run-deepfetch.txt의 "targets: a,b,c" 줄 > 기본값.
   (GitHub MCP 없는 세션도 run-deepfetch.txt만 고쳐 push하면 대상 지정 가능) */
function readTargetsFromTrigger() {
  try {
    const txt = fs.readFileSync(new URL('run-deepfetch.txt', HERE), 'utf8');
    const m = txt.match(/^targets:\s*(.+)$/m);
    return m ? m[1].trim() : '';
  } catch { return ''; }
}
const DOWNLOAD_FORMS_FOR = (process.env.FORM_TARGETS || readTargetsFromTrigger() || '조병두')
  .split(',').map((s) => s.trim()).filter(Boolean);

/* --forms-only : 첨부 원본만 받고 본문 전문 수집은 건너뛴다 (2026-08-04 사고 대책).
   매일 수집 워크플로의 '양식 원본 확보' 단계가 이 모드로 돈다. 예전엔 그 단계가
   심층 수집 본편(=수집 목록 전체의 본문을 다시 받는 일)을 통째로 실행했다.
   공고가 614건으로 늘자 그 재수집만 **19분**이 걸려 25분 예산을 먹어치웠고,
   그 실행은 시간 초과로 취소돼 **수집분 저장·리포트가 통째로 버려졌다**
   (8/3 밤·8/4 아침 두 번 연속 — 개발자 두 명에게 리포트가 안 간 원인).
   본문은 바로 다음 단계의 증분 수집(--fill)이 어차피 받으므로 여기서는 중복이다. */
const FORMS_ONLY = process.argv.includes('--forms-only');

function clean(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|li|h\d)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim();
}

// 첨부 원본만 필요한 실행은 여기서 끝낸다 — 본문 재수집(19분짜리)을 아예 시작하지 않는다
if (FORMS_ONLY) {
  const n = await downloadForms();
  console.log(`done(forms-only): ${n} attachments`);
  process.exit(0);
}

/* ── 원문 본문 수집 ───────────────────────────────────────────
   2026-08-03에 두 가지를 고쳤다. 둘 다 **자격 요건이 통째로 사라지던 원인**이다.

   ① 본문을 5,000자에서 잘랐다.
      학교 홈페이지는 본문 앞에 메뉴·배너 글자가 길게 붙는다. 그래서 정작 '지원자격' 절이
      컷 뒤로 밀렸다. 실측: 잘린 공고 12건을 다시 받아 보니 **5건이 자격 절을 5,302~6,213자
      지점에 두고 있었다**(전체 길이 5,617~9,699자). 저장된 615건 중 247건이 이 컷에 걸려 있었다.
      → 15,000자로 늘리고, 실제로 잘랐을 때만 cut:true를 남긴다(다음 실행이 다시 받도록).

   ② 실행할 때마다 원문 파일을 통째로 새로 만들었다.
      원문은 '지금 수집 목록에 있는 공고'만 받는데, 실시간 공고는 60일 뒤 목록에서 지워진다.
      그래서 **정식 등록된 장학금도 60일이 지나면 원문이 사라졌다**. 그러면 extract-excerpts가
      "원문이 바뀌었나 보다" 하고 이미 뽑아 둔 자격까지 지웠다(원문 미확보 17건이 이렇게 생겼다).
      → 등록 공고가 참조하는 원문은 목록에서 밀려나도 **보존**하고, 없거나 잘린 것은 **보충 수집**한다.

   --fill : 이미 온전히 받아 둔 것은 건너뛰고 빠진 것만 받는다(매일 수집에 얹기 위한 증분 모드).
            첨부 원본은 받지 않는다 — 그건 양식 확보용이라 심층 수집 본편에서만 한다.
   ───────────────────────────────────────────────────────────── */
const LIMIT = 15000;
const FILL = process.argv.includes('--fill');

let prev = [];
try { prev = JSON.parse(fs.readFileSync(new URL('notices-text.json', OUT), 'utf8')); } catch { /* 첫 실행 */ }
const prevIdx = indexTexts(prev);

let registered = { items: [] };
try { registered = JSON.parse(fs.readFileSync(new URL('../data/registered.json', HERE), 'utf8')); } catch { /* 없어도 진행 */ }

// 받을 대상 = 수집 목록 전체 + 원문이 없거나 잘린 등록 공고
const wanted = new Map();
for (const n of notices.items) wanted.set(canonUrl(n.url), n);
let extra = 0;
for (const it of registered.items) {
  if (it.program) continue;                                  // 상시 제도는 공고가 아니다
  const url = it.sourceUrl || '';
  // '#n-' 표식은 원문 주소를 못 찾아 게시판 목록으로 남겨 둔 것이라 받아도 그 공고가 아니다
  if (!/^https?:\/\//.test(url) || url.includes('#n-')) continue;
  const key = canonUrl(url);
  if (wanted.has(key)) continue;
  if (!needsFetch(sourceFor(it, prevIdx), LIMIT)) continue;
  wanted.set(key, { title: it.boardTitle || it.name, school: it.provider || '', url,
    attachments: it.attachments || [], foundAt: it.listedAt });
  extra += 1;
}
/* 증분 모드는 매일 수집 워크플로 안에서 도니 **한 실행에 받는 양을 묶어 둔다.**
   평소엔 그날 새로 들어온 공고 몇 건뿐이라 상한에 닿지 않는다. 다만 게시판이 한꺼번에
   쏟아지는 날 이 단계가 시간을 다 먹으면 수집분이 통째로 버려지므로(2026-08-03 브라우저
   수집 시간초과 사고와 같은 계열), 남은 건 다음 실행이 마저 받게 한다. */
/* 계속 실패하는 주소는 증분 모드에서 물러선다.
   실측: 15건이 매 실행 20초씩 시간초과를 기다려 **한 번에 5분**을 먹고 있었다. 수집 워크플로
   예산 안에서 도는 단계라 그냥 두면 정작 받아야 할 공고를 못 받는다.
   포기하는 게 아니다 — 심층 수집 본편(수동 실행)은 여전히 전부 다시 시도한다(link-hunter와 같은 방침). */
const GIVE_UP_AFTER = 3;
const tooManyFails = (src) => FILL && (src?.fails ?? 0) >= GIVE_UP_AFTER;

const FILL_CAP = 120;
/* 🔴 물러선 주소를 **영영 버리면 안 된다** (2026-08-20 수정).
   위 주석은 "심층 수집 본편이 다시 시도한다"고 적어 두었지만 본편은 **수동 실행**이라
   아무도 돌리지 않는다. 그래서 3번 실패한 주소는 사실상 영구 포기 상태였고, 그 집합은
   줄지 않고 **쌓이기만 했다** — 자격 미확보 81건 중 20건이 정확히 이 상태다(18건이 fails 3+).
   게다가 물러선 이유가 대개 '증분 모드의 8초'인데, 20초를 주면 열리는 학교가 실제로 있다.
   그래서 매 실행 몇 자리만 떼어 다시 두드린다. **실패가 적은 것부터** 고르므로,
   두드릴 때마다 fails가 올라 자연히 다음 차례로 넘어간다(별도 기록장이 필요 없는 회전).
   link-hunter의 '영구 포기는 없다'와 같은 방침이다. 예산은 4자리 × 20초 = 80초로 묶인다. */
const RETRY_SLOTS = 4;
const retired = [];
let todo = [...wanted.values()]
  .filter((n) => {
    const src = prevIdx.byUrl.get(canonUrl(n.url));
    if (tooManyFails(src)) { retired.push({ n, fails: src?.fails ?? 0 }); return false; }
    return !FILL || needsFetch(src, LIMIT);
  });
if (FILL && todo.length > FILL_CAP) {
  console.log(`보충 대상 ${todo.length}건 중 ${FILL_CAP}건만 이번에 받는다 (나머지는 다음 실행)`);
  todo = todo.slice(0, FILL_CAP);
}
/* 다시 두드릴 주소는 **넉넉히 기다려 준다** — 8초에 걸려 물러선 것을 또 8초로 재는 것은
   같은 실험을 반복하는 것이라 결과가 바뀔 리 없다. */
const retryUrls = new Set();
if (FILL && retired.length) {
  retired.sort((a, b) => a.fails - b.fails);
  for (const r of retired.slice(0, RETRY_SLOTS)) { todo.push(r.n); retryUrls.add(canonUrl(r.n.url)); }
  console.log(`물러섰던 주소 ${retired.length}건 중 ${Math.min(RETRY_SLOTS, retired.length)}건을 다시 두드려 본다`);
}
console.log(`원문 수집 대상 ${todo.length}건 (수집 목록 ${notices.items.length} + 등록 공고 보충 ${extra}${FILL ? ', 증분 모드' : ''})`);

const fresh = new Map();
for (const n of todo) {
  try {
    /* 증분 모드는 매일 수집 워크플로의 예산 안에서 돈다. 안 열리는 학교 하나가 20초씩 붙들면
       상한(120건)에 곱해져 예산을 다 먹고, 그러면 그 실행의 수집분이 통째로 버려진다
       (2026-08-03 브라우저 수집 시간초과 사고와 같은 계열). 그래서 증분 모드는 더 짧게 기다린다 —
       못 받은 건 다음 실행이 다시 받으므로 잃는 것이 없다. */
    const patient = !FILL || retryUrls.has(canonUrl(n.url));   // 다시 두드리는 주소는 넉넉히
    const res = await fetch(n.url, { redirect: 'follow', headers: UA,
      signal: AbortSignal.timeout(patient ? 20000 : 8000) });
    let entry;
    if (res.ok) {
      const full = clean(await res.text());
      /* cut은 **항상** 남긴다(true/false 둘 다).
         처음엔 잘렸을 때만 true를 붙였는데, 그러면 잘리지 않은 긴 원문(6,800자 등)이
         cut 표시가 없는 채로 남아 "옛날 5,000자 컷에 걸린 것"으로 오인돼 **매 실행 다시
         받는 무한 반복**이 됐다(2026-08-03, 두 번째 실행이 또 120건을 받아서 발견).
         false를 명시해야 '이건 온전히 받은 것'이라고 다음 실행이 알 수 있다. */
      entry = { text: full.slice(0, LIMIT), cut: full.length > LIMIT, limit: LIMIT };
    } else entry = { text: `FETCH_FAIL HTTP ${res.status}`, fails: (prevIdx.byUrl.get(canonUrl(n.url))?.fails ?? 0) + 1 };
    fresh.set(canonUrl(n.url), { title: n.title, school: n.school, campus: n.campus, url: n.url,
      attachments: n.attachments || [], foundAt: n.foundAt, ...entry });
    console.log('text ok:', n.title.slice(0, 40));
  } catch (e) {
    fresh.set(canonUrl(n.url), { title: n.title, school: n.school, url: n.url,
      text: 'FETCH_ERROR ' + (e.name || e.message),
      fails: (prevIdx.byUrl.get(canonUrl(n.url))?.fails ?? 0) + 1 });
  }
}

/* 저장 = 살려 둘 이전 원문 + 이번에 받은 것.
   '살려 둘 것'은 지금 수집 목록에 있거나 등록 공고가 참조하는 원문이다. 그 밖의 옛 원문은
   버린다(안 버리면 파일이 무한정 커진다). 등록 공고는 주소가 아니라 제목으로 이어진 것도
   있어서 제목 집합도 함께 본다. */
const liveKeys = new Set(wanted.keys());
const liveTitles = new Set();
for (const it of registered.items) {
  if (it.sourceUrl) liveKeys.add(canonUrl(it.sourceUrl));
  liveTitles.add(normTitle(it.name));
}
const out = new Map();
for (const v of prev) {
  const k = v.url ? canonUrl(v.url) : `t:${v.title}`;
  if (liveKeys.has(k) || liveTitles.has(normTitle(v.title))) out.set(k, v);
}
let kept = out.size;
for (const [k, v] of fresh) out.set(k, v);
const texts = [...out.values()];
fs.writeFileSync(new URL('notices-text.json', OUT), JSON.stringify(texts, null, 1));
console.log(`원문 저장 ${texts.length}건 (새로 받음 ${fresh.size} · 이전 것 보존 ${kept} · 버림 ${prev.length - kept})`);

if (FILL) {   // 증분 모드는 본문만 — 첨부 원본은 심층 수집 본편의 일이다
  console.log(`done(fill): ${texts.length} texts`);
  process.exit(0);
}

const fi = await downloadForms();
console.log(`done: ${texts.length} texts, ${fi} attachments`);

/* 지정 공고의 첨부 원본 다운로드.
   예전에는 실행할 때마다 form-* 파일을 전부 지우고 1번부터 다시 채웠다. 그 바람에
   '스키마화 대기'로 큐에 남아 있던 공고의 원본이 다음 수집 때 사라져, 다음 세션이 양식을
   만들 수 없었다(2026-07-30 발견 — 도레이·염곡·시립대 원본이 이렇게 유실됨).
   그래서 파일 이름에 공고별 표식을 넣고, 이번에 다시 받는 공고의 파일만 갈아끼운다. */
async function downloadForms() {
  const slugOf = (title) => {
    let h = 0;
    for (let i = 0; i < title.length; i++) h = (h * 31 + title.charCodeAt(i)) >>> 0;
    return h.toString(36).slice(0, 6);
  };
  /* 표적은 '제목 앞부분'이라 짧으면 엉뚱한 공고까지 몽땅 걸린다.
     실제로 대기 큐가 제목을 12자로 잘라 넣는 바람에 "2026학년도 2학기 " 같은 조각이
     수십 건에 걸렸고, 학자금대출·캠퍼스 투어 같은 공고의 첨부(3.9MB zip 등)까지 받다가
     예산을 넘겼다 (2026-08-04). 그래서 ① 너무 짧은 표적은 무시하고 ② 표적당·전체
     공고 수와 ③ 시간까지 묶는다. 남은 건 다음 실행이 마저 받으므로 잃는 것은 없다. */
  const MIN_KEY = 6;          // 이보다 짧은 표적은 제목 조각으로 보고 건너뛴다
  const PER_KEY = 3;          // 표적 하나가 걸어 올 수 있는 공고 수
  const MAX_NOTICES = 12;     // 한 실행에서 첨부를 받을 공고 수
  const BUDGET_MS = Number(process.env.FORMS_BUDGET_MS || 6 * 60 * 1000);
  const startedAt = Date.now();

  const targets = [];
  for (const k of DOWNLOAD_FORMS_FOR) {
    if (k.replace(/\s/g, '').length < MIN_KEY) { console.log(`표적 건너뜀 (너무 짧음): ${JSON.stringify(k)}`); continue; }
    const hit = notices.items.filter((n) => n.title.includes(k));
    if (hit.length > PER_KEY) console.log(`표적 "${k}" 이 ${hit.length}건에 걸림 — 앞 ${PER_KEY}건만 받는다`);
    for (const n of hit.slice(0, PER_KEY)) if (!targets.includes(n)) targets.push(n);
  }
  const capped = targets.slice(0, MAX_NOTICES);
  if (targets.length > capped.length) console.log(`첨부 대상 ${targets.length}건 중 ${capped.length}건만 이번에 받는다 (나머지는 다음 실행)`);
  console.log(`첨부 원본 수집 대상 ${capped.length}건 (표적 ${DOWNLOAD_FORMS_FOR.length}개)`);

  const refreshing = new Set(capped.map((n) => slugOf(n.title)));
  // 이번에 다시 받는 공고의 예전 파일만 지운다 (다른 공고의 대기 중 원본은 보존)
  for (const f of fs.readdirSync(OUT)) {
    const m = f.match(/^form-([a-z0-9]{1,6})-/);
    if (m && refreshing.has(m[1])) fs.unlinkSync(new URL(f, OUT));
  }
  const indexPath = new URL('forms-index.txt', OUT);
  let indexLines = [];
  try {
    indexLines = fs.readFileSync(indexPath, 'utf8').split('\n').filter(Boolean)
      .filter((line) => { const m = line.split('\t')[0].match(/^form-([a-z0-9]{1,6})-/); return m && !refreshing.has(m[1]); });
  } catch { /* 첫 실행 */ }
  let fi = 0;
  for (const n of capped) {
    if (Date.now() - startedAt > BUDGET_MS) { console.log('첨부 수집 시간 상한 도달 — 나머지는 다음 실행이 받는다'); break; }
    const slug = slugOf(n.title);
    let ai = 0;
    for (const a of n.attachments || []) {
      if (/부속기관|부설/.test(a.name)) continue; // 사이트 공통 링크 제외
      if (Date.now() - startedAt > BUDGET_MS) break;
      try {
        const res = await fetch(a.url, { redirect: 'follow', headers: UA, signal: AbortSignal.timeout(30000) });
        if (!res.ok) { console.log('attach fail', res.status, a.name); continue; }
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length < 1000 || buf.length > 15 * 1024 * 1024) continue;
        // 받아 보니 문서가 아니라 웹페이지면 버린다 — 게시판 하단 메뉴(부서 링크 등)를 첨부로
        // 착각해 받아 두면 스키마화가 매번 그걸 붙들고 실패한다(연구지원팀·연구진흥팀 사례).
        if (isHtmlPayload(buf)) { console.log('attach skip (웹페이지였음):', a.name); continue; }
        fi += 1; ai += 1;
        const ext = (a.name.match(/\.(hwp|hwpx|doc|docx|pdf|xls|xlsx|zip)$/i) || [, 'bin'])[1];
        const fname = `form-${slug}-${ai}.${ext}`;
        fs.writeFileSync(new URL(fname, OUT), buf);
        indexLines.push(`${fname}\t${n.title}\t${a.name}\t${buf.length}`);
        console.log('attach ok:', a.name, buf.length);
      } catch (e) { console.log('attach err', a.name, e.name || e.message); }
    }
  }
  fs.writeFileSync(indexPath, indexLines.join('\n') + (indexLines.length ? '\n' : ''));
  return fi;
}

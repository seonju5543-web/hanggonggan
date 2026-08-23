/* ============================================================
   자격 요건 — 무료 규칙이 못 읽은 것만 AI에게 (2026-08-20 신설)

   운영 원칙 8-1(추론 금지·원문 발췌)을 **AI를 쓰면서도** 지키는 방법:
   **AI에게 답을 쓰게 하지 않는다.** 원문에 번호를 매겨 보여 주고
   "자격 요건인 줄의 번호만 고르라"고 한다. 화면에 나가는 글자는 **앱이 제 원문에서
   그 번호로 꺼낸 것**이라, 모델이 한 글자라도 지어낼 자리가 구조적으로 없다.
   (챗봇 AI에 이미 쓰고 있는 방식 — chat-config.js 첫머리의 '인용만 시킨다'와 같은 계약.)

   그 위에 앱이 한 겹 더 검사한다(chat.js chatVerifyAI와 같은 계열):
     · 범위 밖 번호는 버린다
     · 무료 경로와 **같은 관문**(요건 신호)을 통과 못 하면 통째로 버린다
     · 하나도 안 남으면 '아직 못 읽었어요'를 유지한다 — 모른다고 말할 자유를 남긴다

   돈 쓰는 자리라 무료 경로가 실패한 것만 온다:
     · 대상은 `requirementLines()`가 0줄인 등록 공고 중 **원문이 읽을 만큼 있는 것**
     · 대상 실측(2026-08-20): 20건 · 건당 평균 2,000자 — 아주 작다
     · 스캔 PDF·표로 짜인 공고가 여기 온다(줄 단위 규칙으로는 구조적으로 못 읽는 것들)

   ⚠️ 기본은 **꺼져 있다**(`eligibility-ai-config.json`의 `enabled:false`).
   잔액을 채운 뒤 켤 것. 켜기 전에 리포트에서 대상 목록이 진짜 '못 읽은 공고'인지 볼 것.

   실행: node collector/eligibility-ai.mjs            (미리보기 — 부르지 않는다)
         node collector/eligibility-ai.mjs --write    (반영)
   ============================================================ */
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { indexTexts, sourceFor, hasText } from './notice-source.mjs';
import { makeStripper } from './page-boilerplate.mjs';
import { attachmentText, readable } from './attachment-text.mjs';

const require = createRequire(import.meta.url);
const { requirementLines } = require('../match-engine.js');

const HERE = new URL('.', import.meta.url);
const regPath = new URL('../data/registered.json', HERE);
const reg = JSON.parse(fs.readFileSync(regPath, 'utf8'));
const texts = JSON.parse(fs.readFileSync(new URL('extracted/notices-text.json', HERE), 'utf8'));
let browserBodies = {};
try { browserBodies = JSON.parse(fs.readFileSync(new URL('extracted/browser-bodies.json', HERE), 'utf8')); } catch { /* 없을 수 있다 */ }

let cfg = { enabled: false, maxApiCallsPerRun: 3, giveUpAfter: 3, model: 'claude-sonnet-5', effort: 'low', minBodyChars: 200 };
try { cfg = { ...cfg, ...JSON.parse(fs.readFileSync(new URL('eligibility-ai-config.json', HERE), 'utf8')) }; } catch { /* 기본값 */ }

const WRITE = process.argv.includes('--write');
const log = (m) => console.log(`[elig-ai] ${m}`);

/* ── 지어냄이 들어올 수 없는 계약 ────────────────────────────────
   모델은 **번호만** 돌려준다. 글자를 돌려받지 않으므로 검사할 것도 번호뿐이다. */
const SYSTEM = `당신은 한국 대학 장학금 공고에서 '지원 자격 요건'을 **구조로** 읽는 일을 합니다.

원칙:
- 새 문장을 쓰지 마세요. **줄 번호만** 고릅니다. 글자를 돌려보내도 화면에는 안 나갑니다.
- '누가 받을 수 있는가'를 말하는 줄만 고릅니다(학년·성적·소득구간·거주지·특별자격·재학 상태 등).
- 신청기간·제출서류·문의처·장학금액·선발인원·지급방법은 자격이 **아닙니다**.
- 원문에 자격 요건이 없으면 none을 true로 두세요. **억지로 고르지 마세요.**

어디에 넣을지:
- common   : 지원자 **모두**가 만족해야 하는 요건
- either   : **이 중 한 갈래만** 만족하면 되는 것 (예: 계속장학생 / 신규자, 학부 / 대학원)
             갈래마다 label 에 그 갈래의 **이름 줄 번호들**을 넣으세요.
             이름이 두 줄로 쪼개져 있으면 둘 다 넣습니다
             (예: "재학생" 줄과 "(계속장학생)" 줄 → label: [7, 8]).
             이름 줄이 없으면 label 은 빈 배열 [].
- grade    : 성적·학점 조건
- exclude  : 제외 대상 ('~인 자는 제외', '타 장학금 중복 수혜 불가' 등)
- priority : 우선 선발 기준 (자격이 아니라 **먼저 뽑는 순서**)

🔴 같은 줄을 common 과 either 양쪽에 넣지 마세요. 한 곳에만 넣습니다.
   어느 갈래에만 해당하는 요건이면 그 갈래에만 넣으세요.

🔴 애매하면 반드시 common 에 넣으세요.
   택일인데 common 으로 넣으면 → 자격 있는 학생이 지레 포기합니다(기회 하나 손해).
   공통인데 either 로 넣으면 → **자격 없는 학생이 서류를 떼고 신청합니다.** 이쪽이 훨씬 나쁩니다.
   확신이 없으면 안전한 쪽(common)으로 가세요.

절 전체를 합쳐 최대 12줄까지만 고릅니다.`;

const NUMS = { type: 'array', items: { type: 'integer' } };
const SCHEMA = {
  type: 'object',
  properties: {
    none: { type: 'boolean' },
    common: NUMS,
    either: {
      type: 'array',
      items: {
        type: 'object',
        properties: { label: NUMS, lines: NUMS },
        required: ['label', 'lines'],
        additionalProperties: false,
      },
    },
    grade: NUMS,
    exclude: NUMS,
    priority: NUMS,
    why: { type: 'string' },
  },
  required: ['none', 'common', 'either', 'grade', 'exclude', 'priority', 'why'],
  additionalProperties: false,
};

/* 무료 경로와 **같은 관문**을 쓴다 — 여기만 느슨하면 AI 경로로 쓰레기가 들어온다.
   (extract-excerpts.mjs / eligibility-report.mjs의 REQ_SIGNAL과 같은 낱말) */
const REQ_SIGNAL = /(재학|휴학|복학|신입|편입|졸업|\d\s?학년|학부생|대학생|성적|평점|학점|분위|수급|차상위|기초생활|한부모|다자녀|자녀|유공|보훈|장애|다문화|북한이탈|거주|출신|이상인?\s?자|이하의?\s?(해당\s?)?학생|해당하는\s?자|자격을\s?갖춘|결격\s?사유|결격사유)/;
const NOT_REQ = /(신청\s?기간|접수\s?기간|제출\s?서류|구비\s?서류|문의|담당자|@|\d{2,4}-\d{3,4}-\d{4}|선발\s?인원|모집\s?인원|장학\s?금액|지급\s?방법|증명서\s*\d*\s*부|에서\s?발급|사본\s*\d*\s*부)/;
/* ⚠️ '증명서 1부'는 제출서류인데 '성적'이라는 낱말 때문에 요건 신호를 통과한다 —
   가짜 응답 시험에서 실제로 새어 나와 이 낱말들을 넣었다(채점기의 '증명서 발급 안내가
   자격으로' 유형과 같은 것). 낱말을 지우면 그 구멍이 그대로 되살아난다. */

/* 게시판이 공고마다 붙이는 머리말 — 자격이 아니다.
   가짜 응답 시험에서 아무 번호나 고르게 했더니 `등록일 2026.06.02.` `조회 5464` `인재개발실`
   `포스터.png`가 딸려 들어왔다. 모델이 잘 골라도 이런 줄은 절대 자격이 아니므로 여기서 막는다.
   ⚠️ 한글 뒤에는 `\b`(낱말 경계)가 듣지 않는다 — `^(등록일)\b`로 썼다가 하나도 안 걸렸다.
   공백·콜론·줄끝을 직접 적어야 한다. */
const HEADER = /^(등록일|작성일|수정일|조회수?|담당자?|게시기간|첨부파일|담당부서)(\s|[:：]|$)|^\d{4}[-.]\s?\d{1,2}[-.]\s?\d{1,2}|\(등록일\s*[:：]|\.(hwp|hwpx|pdf|docx?|xlsx?|zip|png|jpe?g)\s*$|^.{0,16}(센터|팀|실|사업단|재단)$/;

/* 🔴 최후 관문 — 모델이 고른 번호를 **앱이 제 원문에서** 꺼내고, 꺼낸 것을 다시 검사한다.
   범위 밖 번호는 버리고, 요건 신호가 하나도 없으면 통째로 버린다.
   하나도 안 남으면 '아직 못 읽었어요'를 유지한다(지어낸 자격보다 낫다 — 원칙 8-1). */
export function verifyPick(pick, lines) {
  if (!pick || pick.none) return { ok: false, why: pick && pick.why ? pick.why : '자격 없음' };

  /* 번호 → 앱이 제 원문에서 꺼낸 글자. 모델이 글자를 보내도 여기로 들어올 길이 없다. */
  const pull = (nums, cap) => [...new Set((nums || [])
    .filter((n) => Number.isInteger(n) && n >= 0 && n < lines.length))]
    .sort((a, b) => a - b).map((n) => lines[n])
    .filter((l) => !NOT_REQ.test(l) && !HEADER.test(l)).slice(0, cap);

  /* 옛 모양(`lines`만 주던 응답)도 그대로 받는다 — 그 시절 회귀 검사가 살아 있어야
     '모델이 보낸 글자는 결과에 섞이지 않는다'는 단언이 계속 우리를 지킨다. */
  const common = pull(pick.common || pick.lines, 8);
  const grade = pull(pick.grade, 4);
  let either = (pick.either || []).map((b) => ({
    /* 이름이 두 줄로 쪼개진 표가 흔하다("재학생" + "(계속장학생)") — 붙여서 한 이름으로 쓴다.
       여기서도 글자는 원문 줄이다. 못 읽었으면 null 로 두고 화면이 순서로만 가른다. */
    /* 모델이 배열 대신 숫자 하나를 보낼 수도 있다 — 스키마가 있어도 방어한다.
       여기서 죽으면 그 실행의 나머지 공고까지 통째로 못 읽는다. */
    label: [...new Set([].concat(b && b.label != null ? b.label : [])
      .filter((n) => Number.isInteger(n) && n >= 0 && n < lines.length))]
      .sort((a, b2) => a - b2).map((n) => lines[n]).join(' ').trim() || null,
    lines: pull(b && b.lines, 6),
  })).filter((b) => b.lines.length);

  /* 🔴 갈래가 하나뿐이면 택일이 아니다 — 공통으로 합친다.
     '둘 중 하나'라고 써 놓고 하나만 보여 주면 학생이 "나머지는 어디 갔지" 한다.
     그리고 애매할 때 공통으로 가는 것이 이 파일의 기본값이다(프롬프트와 같은 규칙):
     공통인데 택일로 그리면 **자격 없는 학생이 서류를 뗀다.** */
  if (either.length === 1) { common.push(...either[0].lines); either = []; }

  /* 🔴 갈래에 든 줄은 공통에서 뺀다 (2026-08-23 실측으로 추가).
     종단추천장학에서 `대한불교조계종 교육원의 장학추천 가능자`가 **공통과 신규자 갈래
     양쪽에** 들어왔다. 원문에는 신규자 아래 한 번만 나오는 줄이다.
     그대로 두면 계속장학생이 "나도 교육원 추천을 받아야 하네" 하고 포기한다 —
     이 설계가 고치려던 실패와 같은 종류다.
     **갈래 쪽을 남긴다**: 모델이 어느 갈래인지 콕 집은 것은 구체적인 판단이고,
     공통에 겹쳐 넣은 것은 대개 그냥 중복이다. 갈래에 남아 있으니 화면에서 사라지지도 않는다. */
  /* 성적 줄도 마찬가지다 — 공통과 성적 양쪽에 들어오면 화면에 같은 줄이 두 번 뜬다(실측). */
  const elsewhere = new Set([...either.flatMap((b) => b.lines), ...grade]);
  const commonOnly = common.filter((l) => !elsewhere.has(l));

  const flat = [...new Set([...commonOnly, ...either.flatMap((b) => b.lines), ...grade])].slice(0, 12);
  if (!flat.length) return { ok: false, why: '고른 줄이 범위 밖이거나 자격이 아님' };
  if (!flat.some((l) => REQ_SIGNAL.test(l))) return { ok: false, why: '요건 신호가 하나도 없음' };

  return {
    ok: true,
    lines: flat,                                   // 화면·알림·챗봇이 지금 쓰는 평평한 모양 (그대로 둔다)
    struct: { common: [...new Set(commonOnly)], either, grade },   // 새 렌더러가 쓰는 구조
    excludes: pull(pick.exclude, 6),
    priority: pull(pick.priority, 6),
  };
}

/* ── 공고문 PDF 경로 (2026-08-23 신설) ──────────────────────────────
   게시판 본문이 "붙임 참조"뿐이고 공고문이 PDF인 공고가 있다. 그 PDF가 CID 폰트·스캔이면
   무료 해석기(pdf-text.mjs)로 한글이 **0자** 나온다 — 실측 5개 전부 그랬다.
   `attachment-text.mjs` 첫머리가 "그건 AI 경로의 몫"이라고 넘겨 놓은 자리인데,
   **받을 준비가 안 돼 있어서** 그 사이로 공고들이 떨어지고 있었다.

   🔴 여기서는 **줄 번호 계약을 쓸 수 없다.** 뽑을 글자가 없으니 번호를 매길 대상이 없다.
   그래서 이 경로만 모델이 **글자를 돌려준다** — 개발자가 자격 요건에 한해 승인한
   정직 원칙 예외를 쓰는 곳이 여기 하나다. 대신:
     · 화면에 'AI가 읽음 · 검수 전' 표식이 붙는다(다른 경로와 같다)
     · `eligibilityFrom`에 **'AI(공고문 PDF)'**로 출처를 남겨 번호 경로와 구분한다
     · 번호 경로와 **같은 관문**(요건 신호·제출서류·게시판 머리말)을 통과해야 한다
   ────────────────────────────────────────────────────────────── */
const PDF_SYSTEM = `당신은 첨부된 한국 대학 장학금 **공고문(PDF 또는 포스터 그림)**에서 '지원 자격 요건'을 읽는 일을 합니다.

원칙:
- 공고문에 **적혀 있는 문장을 그대로** 옮깁니다. 요약하거나 바꿔 쓰지 마세요.
- 기관·재단·시험 이름은 **줄이지 마세요**. '대한불교조계종 스님'을 '스님'으로 줄이면
  다른 소속 학생이 자기 공고로 읽습니다. 원문에 적힌 이름을 통째로 옮깁니다.
- '누가 받을 수 있는가'를 말하는 줄만 고릅니다(학년·성적·소득구간·거주지·특별자격·재학 상태 등).
- 신청기간·제출서류·문의처·장학금액·선발인원·지급방법은 자격이 **아닙니다**.
- '~인 자는 제외', '지원 불가' 같은 **제외 대상**은 lines 가 아니라 excludes 에 넣으세요.
  자격과 섞으면 화면에서 요건이 실제보다 훨씬 까다로워 보여 지원할 수 있는 학생이 포기합니다.
- 공고문에 자격 요건이 없으면 none을 true로 두세요. **없는 것을 지어내지 마세요.**
- lines 최대 8줄 · excludes 최대 6줄.`;

const PDF_SCHEMA = {
  type: 'object',
  properties: {
    none: { type: 'boolean' },
    lines: { type: 'array', items: { type: 'string' } },
    excludes: { type: 'array', items: { type: 'string' } },
    why: { type: 'string' },
  },
  required: ['none', 'lines', 'excludes', 'why'],
  additionalProperties: false,
};

/* 모델이 보낸 **글자**를 되받아 거른다. 번호 경로의 verifyPick과 같은 낱말 관문을 쓴다 —
   여기만 느슨하면 PDF 경로로 쓰레기가 들어온다. */
export function verifyPdfLines(pick) {
  if (!pick || pick.none) return { ok: false, why: (pick && pick.why) || '자격 없음' };
  const clean = (arr, cap) => [...new Set((arr || [])
    .map((l) => String(l || '').replace(/\s+/g, ' ').trim())
    .filter((l) => l.length >= 4 && l.length <= 200)
    .filter((l) => !NOT_REQ.test(l) && !HEADER.test(l)))].slice(0, cap);
  const out = clean(pick.lines, 8);
  if (!out.length) return { ok: false, why: '고른 줄이 자격이 아님' };
  if (!out.some((l) => REQ_SIGNAL.test(l))) return { ok: false, why: '요건 신호가 하나도 없음' };
  /* 제외 대상은 자격 줄과 섞지 않는다 — 섞으면 요건이 실제보다 까다로워 보여
     지원할 수 있는 학생이 포기하고, 5줄 상한에 밀려 진짜 요건이 잘려 나간다
     (정읍시민장학재단에서 제외 3줄이 실제로 그렇게 버려졌다). */
  return { ok: true, lines: out, excludes: clean(pick.excludes, 6) };
}

/* ── 대상 고르기 ── */
const idx = indexTexts(texts, browserBodies);
const strip = makeStripper(texts);

/* 원문 한 건을 모델에게 보일 줄 목록으로 — 대상 고르기와 `--only`가 같은 길을 쓴다 */
function linesOf(it) {
  const src = sourceFor(it, idx);
  if (!hasText(src)) return [];
  return src.text.split(/\n+/).map((l) => l.trim()).filter((l) => l.length >= 2 && l.length <= 200);
}

export function pickTargets(items, all, only) {
  const out = [];
  for (const it of items) {
    if (it.program) continue;
    /* `--only <id>` — 공고 하나만. 시범 모드는 **빈칸만** 고르는데, 구조 소실(갈래가
       평평해진 것)은 **이미 자격이 뜨는 공고** 쪽에 있어서 시범으로는 영영 안 나온다.
       한 건을 눈으로 확인하는 데 전수 2,200원을 쓸 이유가 없다. */
    if (only) { if (it.id === only) out.push({ it, lines: linesOf(it) }); continue; }
    /* 평소엔 '무료 경로가 못 읽은 것'만 온다. `--all`은 이미 자격이 뜨는 것까지 다시 읽는다 —
       구조 소실(공통/택일이 평평해진 것)은 **이미 뜨는 카드**에 숨어 있기 때문이다. */
    if (!all && requirementLines(it).length) continue;
    if ((it.aiTries || 0) >= (cfg.giveUpAfter ?? 3)) continue;  // 계속 실패하는 건 그만 부른다
    const src = sourceFor(it, idx);
    if (!hasText(src)) continue;                             // 읽을 원문이 없으면 물어볼 것도 없다
    /* 🔴 보일러플레이트 제거기를 **모델 입력에 쓰지 않는다** (2026-08-23).
       제거기는 '여러 공고에 흔한 줄'을 버리는데, 표의 칸 이름이 바로 그런 줄이다 —
       `재학생`·`공통`·`신규자`가 통째로 지워져 갈래 이름이 엉뚱하게 붙었다(실증).
       제거기는 **'이 공고에 읽을 만한 본문이 있나'를 재는 데만** 쓴다.
       원문 그대로 보내면 등록 169건 전수가 620원 → 2,229원인데, 그 1,600원을 아끼려고
       구조를 잃는 건 밑지는 장사다(이 파일의 비용 전제는 config 주석 참조). */
    const gauge = strip(src.url || it.sourceUrl, src.text);
    const body = src.text;
    /* 🔴 짧은 줄을 버리면 안 된다 (2026-08-23). `공통`(2자)·`재학생`(3자)·`신규자`(3자)처럼
       **표의 칸 이름이 전부 짧다.** 4자 문턱을 두고 "구조를 읽어라"라고 하면 구조 표시를
       지우고 주는 셈이다 — 실제로 종단추천장학의 갈래 이름이 반쪽만 나왔다.
       줄 하나는 토큰 몇 개라 넉넉히 보내도 값이 거의 안 오른다. */
    const lines = body.split(/\n+/).map((l) => l.trim()).filter((l) => l.length >= 2 && l.length <= 200);
    if (gauge.replace(/[^가-힣]/g, '').length < (cfg.minBodyChars ?? 20)) continue;
    out.push({ it, lines });
  }
  /* 안 해 본 것부터 — 등록 순서 그대로 두면 실행 한도(3건)가 매번 **같은 앞쪽 3건**만
     다시 붙들어, 그 셋이 giveUpAfter에 닿기 전까지 뒤쪽 47건은 차례가 오지 않는다
     (2026-08-23 시범에서 실제로 같은 3건이 두 번 반복됐다). */
  out.sort((a, b) => (a.it.aiTries || 0) - (b.it.aiTries || 0));
  return out;
}

/* 공고문 PDF가 있는데 무료로 글자가 안 나오는 공고 — 이 경로의 대상 */
export function pickPdfTargets(items) {
  let index = {};
  try { index = JSON.parse(fs.readFileSync(new URL('extracted/elig-docs.json', HERE), 'utf8')); } catch { return []; }
  const out = [];
  for (const it of items) {
    if (it.program || requirementLines(it).length) continue;
    if ((it.aiTries || 0) >= (cfg.giveUpAfter ?? 3)) continue;
    /* 🔴 **큰 그림을 고른다.** 파일 순서대로 첫 장을 집으면 머리말 배너(1002×551)를
       골라 놓고 진짜 포스터(3368×4768)를 지나친다 — 실제로 그랬다.
       PDF 가 있으면 PDF 가 먼저다(글자층이 남아 있을 수 있어 더 정확하다). */
    /* 크기는 **파일 무게**로 잰다 — 저장할 때 이름이 `elig-슬러그-번호.확장자`로 바뀌어
       원래 이름에 있던 가로×세로가 남지 않는다. 머리말 배너 39KB vs 포스터 2MB라 확실히 갈린다. */
    const bytes = (f) => { try { return fs.statSync(new URL(`extracted/${f}`, HERE).pathname).size; } catch { return 0; } };
    const files = [...((index[it.id] || {}).files || [])]
      .sort((a, b) => (/\.pdf$/i.test(b) ? 1 : 0) - (/\.pdf$/i.test(a) ? 1 : 0) || bytes(b) - bytes(a));
    for (const f of files) {
      /* PDF 와 **본문 그림**을 같이 본다 — `[홍보]` 계열은 글자 없이 포스터만 올려 두는데,
         그건 '본문이 없는 것'이 아니라 '눈으로 읽어야 하는 것'이다(2026-08-23). */
      const m = f.match(/\.(pdf|png|jpe?g|gif|webp)$/i);
      if (!m) continue;
      const path = new URL(`extracted/${f}`, HERE).pathname;
      if (!fs.existsSync(path)) continue;
      /* 무료로 글자가 나오면 이 경로에 올 이유가 없다 — 발췌기가 이미 읽었거나 읽을 것이다.
         그림은 애초에 글자가 안 나오므로 이 검사를 건너뛴다. */
      const ext = m[1].toLowerCase();
      if (ext === 'pdf' && readable(attachmentText(path))) continue;
      out.push({ it, path, file: f, kind: ext === 'pdf' ? 'pdf' : 'image' });
      break;
    }
  }
  return out;
}

const MEDIA = { pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp' };

async function askPdf(item, path, kind) {
  if (process.env.ELIG_AI_FAKE) return JSON.parse(fs.readFileSync(process.env.ELIG_AI_FAKE, 'utf8'));
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic();
  let buf = fs.readFileSync(path);
  let ext = (path.match(/\.([a-z0-9]+)$/i) || [, 'pdf'])[1].toLowerCase();
  /* 🔴 API 가 그림에 거는 한계는 **둘**이다 (실측 2026-08-23, 둘 다 400 으로 맞았다):
       ① 한 변 8,000픽셀   — 한미 첨단분야 포스터가 5906×8268이라 걸렸다
       ② 파일 10MB        — ①을 고치려고 7,000픽셀 PNG 로 다시 만들었더니 15MB 가 됐다
     학교 포스터는 인쇄용 원본을 그대로 올리는 일이 흔해 ①을 자주 넘는다.
     글자를 읽는 일이라 크기는 넉넉히 줄여도 된다 — A4 300dpi 가 2480×3508이므로
     긴 변 3,500픽셀이면 인쇄물과 같은 선명도다. PNG 가 아니라 JPEG 로 내보낸다
     (사진·그라데이션이 많은 포스터에서 PNG 는 몇 배로 부푼다). */
  if (kind === 'image') {
    try {
      const sharp = (await import('sharp')).default;
      const meta = await sharp(buf).metadata();
      const tooBig = Math.max(meta.width || 0, meta.height || 0) > 7800 || buf.length > 9 * 1024 * 1024;
      if (tooBig) {
        for (const [side, q] of [[3500, 85], [2600, 80], [1800, 75]]) {
          buf = await sharp(fs.readFileSync(path))
            .resize({ width: side, height: side, fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: q }).toBuffer();
          if (buf.length <= 9 * 1024 * 1024) break;
        }
        ext = 'jpg';
        log(`  · ${item.name.slice(0, 24)} — 포스터 ${meta.width}×${meta.height} → ${Math.round(buf.length / 1024)}KB 로 줄여 보냅니다`);
      }
    } catch (e) { log(`  · 그림 크기 조정 못 함(${String(e.message).slice(0, 60)}) — 원본 그대로 보냅니다`); }
  }
  const b64 = buf.toString('base64');
  /* PDF 는 문서 블록, 그림은 이미지 블록으로 보낸다 — 형태가 다르면 400 이 난다 */
  const doc = kind === 'image'
    ? { type: 'image', source: { type: 'base64', media_type: MEDIA[ext] || 'image/png', data: b64 } }
    : { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: b64 } };
  const stream = client.beta.messages.stream({
    model: cfg.model,
    max_tokens: 2000,
    system: PDF_SYSTEM,
    output_config: { effort: cfg.effort, format: { type: 'json_schema', schema: PDF_SCHEMA } },
    messages: [{ role: 'user', content: [doc,
      { type: 'text', text: `공고: ${item.name}\n\n이 ${kind === 'image' ? '공고 포스터' : '공고문'}에서 지원 자격 요건 줄을 원문 그대로 옮겨 주세요.` },
    ] }],
  });
  const msg = await stream.finalMessage();
  if (msg.stop_reason === 'refusal') throw new Error('모델이 처리를 거부함');
  return JSON.parse(msg.content.find((b) => b.type === 'text').text);
}

/* ── 모델 부르기 (가짜 응답으로 시험할 수 있게 갈라 둔다) ──
   ELIG_AI_FAKE에 파일 경로를 주면 그 JSON을 응답으로 쓴다 — **잔액 없이도 안전장치를 검증**한다
   (챗봇 AI 안전장치를 가짜 서버로 검증한 것과 같은 방식). */
async function ask(item, lines) {
  if (process.env.ELIG_AI_FAKE) return JSON.parse(fs.readFileSync(process.env.ELIG_AI_FAKE, 'utf8'));
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic();
  const numbered = lines.map((l, i) => `${i}\t${l}`).join('\n');
  /* 🔴 `fallbacks`(안전 거절 시 다른 모델로 넘기기)를 붙이지 말 것 —
     `claude-sonnet-5` does not support the `fallbacks` parameter. 로 **400이 난다**(실측 2026-08-23).
     그 파라미터는 Fable 5·Opus 5 전용이다. 지난 세션이 습관적으로 붙여 뒀는데
     잔액이 없어 한 번도 안 걸렸고, 잔액을 채우자마자 3건이 전부 죽었다.
     장학금 공고에서 자격 줄을 고르는 일에 안전 거절이 날 일도 없으므로 빼도 잃는 게 없다. */
  const stream = client.beta.messages.stream({
    model: cfg.model,
    max_tokens: 2000,
    system: SYSTEM,
    output_config: { effort: cfg.effort, format: { type: 'json_schema', schema: SCHEMA } },
    messages: [{ role: 'user', content: `공고: ${item.name}\n\n----- 원문(줄 번호\\t내용) -----\n${numbered}` }],
  });
  const msg = await stream.finalMessage();
  if (msg.stop_reason === 'refusal') throw new Error('모델이 처리를 거부함');
  return JSON.parse(msg.content.find((b) => b.type === 'text').text);
}

/* ── 본편 ── */
if (!process.env.ELIG_AI_AS_LIB) {
  /* `--all` = 169건 전수(구조 소실은 이미 뜨는 카드에 있다). 기본은 못 읽은 것만. */
  const ALL = process.argv.includes('--all');
  const ONLY = (process.argv.find((a) => a.startsWith('--only=')) || '').slice(7) || null;
  /* `--docs-only` — 첨부(공고문 PDF·포스터 그림)만 읽는다. 지정 실행을 여러 번 띄우면
     서로의 registered.json 을 덮어쓴다(실측). 한 번에 끝내는 길이 필요하다. */
  const DOCS_ONLY = process.argv.includes('--docs-only');
  const targets = DOCS_ONLY ? [] : pickTargets(reg.items, ALL, ONLY).filter((t) => t.lines.length);
  log(DOCS_ONLY ? '첨부(공고문 PDF·포스터 그림)만 읽습니다'
    : ONLY ? `대상 ${targets.length}건 — 지정(${ONLY})`
    : ALL ? `대상 ${targets.length}건 — 전수(--all)`
    : `대상 ${targets.length}건 (무료 경로가 못 읽었고 원문은 있는 공고)`);

  const hasKey = !!process.env.ANTHROPIC_API_KEY || !!process.env.ELIG_AI_FAKE;
  /* 설정은 꺼진 채로 두고 **버튼에서만 켠다**(ELIG_AI_ENABLE=1).
     설정 파일을 true로 바꿔 두면 수집 로봇이 매 실행 돈다 — 그건 전수를 마치고
     결과를 눈으로 본 다음에 할 일이다. 그때까지는 사람이 누를 때만 돈다.
     '기본은 꺼져 있다' 회귀 검사도 이 방식이라야 계속 우리를 지킨다. */
  const on = cfg.enabled || process.env.ELIG_AI_ENABLE === '1';
  if (!on) { log('꺼져 있음 (eligibility-ai-config.json의 enabled) — 부르지 않는다'); process.exit(0); }
  if (!hasKey) { log('API 열쇠 없음 — 부르지 않는다'); process.exit(0); }
  if (!WRITE) { log('미리보기 — --write 를 붙여야 반영한다'); process.exit(0); }

  /* 전수에는 한도를 걸지 않는다 — 전수 1회가 소넷 기준 2,229원이라(2026-08-23 실측)
     3건씩 끊으면 169건에 두 달이 걸린다. 평소 실행은 한도를 지킨다. */
  const cap = (ALL || ONLY) ? Infinity : (cfg.maxApiCallsPerRun ?? 3);
  let calls = 0, got = 0, kept = 0, branched = 0;
  for (const { it, lines } of targets) {
    if (calls >= cap) { log(`이번 실행 한도(${cap}건) 도달 — 나머지는 다음 실행`); break; }
    calls += 1;
    let pick;
    try { pick = await ask(it, lines); }
    /* 오류를 60자에서 자르지 말 것 — 처음 붙였을 때 400의 이유가 통째로 잘려
       무엇이 틀렸는지 알 수 없었다. API 오류는 원인이 뒷부분에 적혀 온다. */
    /* 🔴 호출이 실패한 것은 **이 공고의 잘못이 아니다** — aiTries를 올리지 않는다.
       aiTries는 `giveUpAfter`(3회)에서 그 공고를 영영 제외하는 장부라, 여기에
       내 코드의 400이나 네트워크 오류를 섞으면 멀쩡한 공고가 조용히 버려진다.
       실제로 그럴 뻔했다 — 첫 실행에서 요청 형태가 틀려 3건에 헛되이 1이 찍혔다.
       세는 것은 '모델이 읽어 봤는데 자격을 못 찾았다'뿐이다(아래 검산 실패 쪽). */
    catch (e) { log(`✕ ${it.name.slice(0, 30)} — 호출 실패(공고 탓 아님): ${String(e && e.message || e).slice(0, 600)}`); continue; }
    const v = verifyPick(pick, lines);
    /* 🔴 검산을 통과 못 하면 **지금 것을 그대로 둔다.** 지우지 않는다 —
       AI가 못 읽었다고 이미 있던 자격까지 날리면 전수 실행이 앱을 나쁘게 만든다. */
    if (!v.ok) { log(`· ${it.name.slice(0, 30)} — ${v.why} (지금 것 유지)`); it.aiTries = (it.aiTries || 0) + 1; kept += 1; continue; }

    /* 되돌릴 수 있게 **처음 한 번만** 원래 값을 남긴다. 지금 데이터 194건에는
       '이 자격 줄을 누가 넣었나' 표시가 없어서, 이게 없으면 덮어쓴 뒤 복구가 불가능하다. */
    if (!it.eligibilityPrev) {
      it.eligibilityPrev = {
        lines: it.eligibilityLines || null,
        excludes: it.eligibilityExcludes || null,
        priority: it.eligibilityPriority || null,
        from: it.eligibilityFrom || null,
      };
    }
    it.eligibilityLines = v.lines;
    it.eligibilityStruct = v.struct;
    if (v.excludes.length) it.eligibilityExcludes = v.excludes;
    if (v.priority.length) it.eligibilityPriority = v.priority;
    it.eligibilityFrom = 'AI(원문 줄 그대로)';
    it.eligibilityReviewed = false;          // 화면의 'AI가 읽음 · 검수 전' 표식
    delete it.aiTries;
    got += 1;
    if (v.struct.either.length) branched += 1;
    log(`✓ ${it.name.slice(0, 30)} — 공통 ${v.struct.common.length} · 갈래 ${v.struct.either.length} · 성적 ${v.struct.grade.length}`);
  }
  /* ── 공고문 PDF 경로 — 무료로 글자가 안 나오는 것만 (전수·지정 실행에서만 돈다) ── */
  let pdfGot = 0;
  if (ALL || ONLY || DOCS_ONLY) {
    for (const { it, path, file, kind } of pickPdfTargets(reg.items)) {
      if (ONLY && it.id !== ONLY) continue;
      let pick;
      try { pick = await askPdf(it, path, kind); }
      catch (e) { log(`✕ ${it.name.slice(0, 30)} — PDF 호출 실패(공고 탓 아님): ${String(e && e.message || e).slice(0, 300)}`); continue; }
      const v = verifyPdfLines(pick);
      if (!v.ok) { log(`· ${it.name.slice(0, 30)} — PDF: ${v.why} (지금 것 유지)`); it.aiTries = (it.aiTries || 0) + 1; continue; }
      if (!it.eligibilityPrev) {
        it.eligibilityPrev = { lines: it.eligibilityLines || null, excludes: it.eligibilityExcludes || null,
          priority: it.eligibilityPriority || null, from: it.eligibilityFrom || null };
      }
      it.eligibilityLines = v.lines;
      if (v.excludes.length) it.eligibilityExcludes = v.excludes;
      delete it.eligibilityStruct;                 // PDF 경로는 구조를 만들지 않는다
      /* 출처를 번호 경로와 구분해 남긴다 — 이 경로만 모델이 글자를 돌려준다 */
      it.eligibilityFrom = kind === 'image' ? 'AI(공고 포스터 그림)' : 'AI(공고문 PDF)';
      it.eligibilityReviewed = false;
      delete it.aiTries;
      pdfGot += 1;
      log(`✓ ${it.name.slice(0, 30)} — ${kind === 'image' ? '공고 포스터 그림' : '공고문 PDF'}에서 ${v.lines.length}줄 (${file})`);
    }
  }

  fs.writeFileSync(regPath, JSON.stringify(reg, null, 1) + '\n');
  log(`끝 — 호출 ${calls}회 · 확보 ${got}건 · 갈래 있는 공고 ${branched}건 · 공고문 PDF ${pdfGot}건 · 검산 실패로 지금 것 유지 ${kept}건`);
}

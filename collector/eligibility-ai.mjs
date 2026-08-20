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
const SYSTEM = `당신은 한국 대학 장학금 공고에서 '지원 자격 요건'에 해당하는 줄을 고르는 일을 합니다.

원칙:
- 새 문장을 쓰지 마세요. **줄 번호만** 고릅니다.
- '누가 받을 수 있는가'를 말하는 줄만 고릅니다(학년·성적·소득구간·거주지·특별자격·재학 상태 등).
- 신청기간·제출서류·문의처·장학금액·선발인원·지급방법은 자격이 **아닙니다**. 고르지 마세요.
- 자격 절의 제목 줄(예: "3. 신청 자격")은 그 아래 내용과 함께일 때만 포함합니다.
- 원문에 자격 요건이 없으면 none을 true로 하고 lines는 빈 배열로 두세요. **억지로 고르지 마세요.**
- 최대 8줄까지만 고릅니다.`;

const SCHEMA = {
  type: 'object',
  properties: {
    none: { type: 'boolean' },
    lines: { type: 'array', items: { type: 'integer' } },
    why: { type: 'string' },
  },
  required: ['none', 'lines', 'why'],
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
  const idx = [...new Set((pick.lines || []).filter((n) => Number.isInteger(n) && n >= 0 && n < lines.length))];
  const out = idx.sort((a, b) => a - b).map((n) => lines[n])
    .filter((l) => !NOT_REQ.test(l) && !HEADER.test(l)).slice(0, 8);
  if (!out.length) return { ok: false, why: '고른 줄이 범위 밖이거나 자격이 아님' };
  if (!out.some((l) => REQ_SIGNAL.test(l))) return { ok: false, why: '요건 신호가 하나도 없음' };
  return { ok: true, lines: out };
}

/* ── 대상 고르기 ── */
const idx = indexTexts(texts, browserBodies);
const strip = makeStripper(texts);

export function pickTargets(items) {
  const out = [];
  for (const it of items) {
    if (it.program) continue;
    if (requirementLines(it).length) continue;              // 무료 경로가 이미 읽었다
    if ((it.aiTries || 0) >= (cfg.giveUpAfter ?? 3)) continue;  // 계속 실패하는 건 그만 부른다
    const src = sourceFor(it, idx);
    if (!hasText(src)) continue;                             // 읽을 원문이 없으면 물어볼 것도 없다
    const body = strip(src.url || it.sourceUrl, src.text);
    const lines = body.split(/\n+/).map((l) => l.trim()).filter((l) => l.length >= 4 && l.length <= 200);
    if (body.replace(/[^가-힣]/g, '').length < (cfg.minBodyChars ?? 200)) continue;
    out.push({ it, lines });
  }
  return out;
}

/* ── 모델 부르기 (가짜 응답으로 시험할 수 있게 갈라 둔다) ──
   ELIG_AI_FAKE에 파일 경로를 주면 그 JSON을 응답으로 쓴다 — **잔액 없이도 안전장치를 검증**한다
   (챗봇 AI 안전장치를 가짜 서버로 검증한 것과 같은 방식). */
async function ask(item, lines) {
  if (process.env.ELIG_AI_FAKE) return JSON.parse(fs.readFileSync(process.env.ELIG_AI_FAKE, 'utf8'));
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic();
  const numbered = lines.map((l, i) => `${i}\t${l}`).join('\n');
  const stream = client.beta.messages.stream({
    model: cfg.model,
    max_tokens: 2000,
    system: SYSTEM,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: cfg.effort, format: { type: 'json_schema', schema: SCHEMA } },
    messages: [{ role: 'user', content: `공고: ${item.name}\n\n----- 원문(줄 번호\\t내용) -----\n${numbered}` }],
  });
  const msg = await stream.finalMessage();
  if (msg.stop_reason === 'refusal') throw new Error('모델이 처리를 거부함');
  return JSON.parse(msg.content.find((b) => b.type === 'text').text);
}

/* ── 본편 ── */
if (!process.env.ELIG_AI_AS_LIB) {
  const targets = pickTargets(reg.items);
  log(`대상 ${targets.length}건 (무료 경로가 못 읽었고 원문은 있는 공고)`);

  const hasKey = !!process.env.ANTHROPIC_API_KEY || !!process.env.ELIG_AI_FAKE;
  if (!cfg.enabled) { log('꺼져 있음 (eligibility-ai-config.json의 enabled) — 부르지 않는다'); process.exit(0); }
  if (!hasKey) { log('API 열쇠 없음 — 부르지 않는다'); process.exit(0); }
  if (!WRITE) { log('미리보기 — --write 를 붙여야 반영한다'); process.exit(0); }

  const cap = cfg.maxApiCallsPerRun ?? 3;
  let calls = 0, got = 0;
  for (const { it, lines } of targets) {
    if (calls >= cap) { log(`이번 실행 한도(${cap}건) 도달 — 나머지는 다음 실행`); break; }
    calls += 1;
    let pick;
    try { pick = await ask(it, lines); }
    catch (e) { log(`✕ ${it.name.slice(0, 30)} — 호출 실패: ${String(e.message).slice(0, 60)}`); it.aiTries = (it.aiTries || 0) + 1; continue; }
    const v = verifyPick(pick, lines);
    if (!v.ok) { log(`✕ ${it.name.slice(0, 30)} — ${v.why}`); it.aiTries = (it.aiTries || 0) + 1; continue; }
    it.eligibilityLines = v.lines;
    it.eligibilityFrom = 'AI(원문 줄 그대로)';
    delete it.aiTries;
    got += 1;
    log(`✓ ${it.name.slice(0, 30)} — ${v.lines.length}줄`);
  }
  fs.writeFileSync(regPath, JSON.stringify(reg, null, 1) + '\n');
  log(`끝 — 호출 ${calls}회 · 확보 ${got}건`);
}

/* ============================================================
   유료 카드 읽기 (4번) — AI 가 공고 한 건을 통째로 읽어 카드의 모든 칸을 쓰고, 첨부를 내용 문서 / 신청 양식으로 가른다
   설계: docs/designs/paid-gate-pipeline.md (2026-11-20 지시 · 2026-11-21 개정) · 앞선 설계 docs/designs/paid-card-reading.md

   🔴 2026-11-21 개발자 결정 — **기계 검사는 없다.** *"기계검사는 코딩이고 정해진 규칙에 의해서만 돌아가는거라 한계가 있어서 그냥 없앤거야"*.
      AI 하나(첫째 모델)가 본문 + 첨부 글자를 끝까지 읽고 ① 카드 칸(줄마다 다듬은 문장 text + 원문 근거 quote) ② 첨부마다의 갈래(4-1 ·
      content·form·mixed·other)를 낸다. 그 결과를 **그대로** `data/card-read.json` 에 싣는다 — 여기 실려야 숨김 등록분(`paidGate`)이 학생 화면에 나온다
      (match-engine publishedList). 맞는지 틀린지는 6번 최종 검토(collector/final-review.mjs · 둘째 AI)가 원문과 다시 대조해 고친다.
   읽는 것은 숨김 등록분(`paidGate`)과 관리자가 직접 등록한 공고(`paidRead`)만. 그 전 등록분(옛 두 읽기 결과)은 그대로 둔다(개발자 결정 「옛 공고는 냅둬」).
   첨부 갈래는 `collector/attach-role-ai.json` 에 적는다 — 6번이 그 구분을 다시 보고, 5번 변환 로봇(양식 PDF · 공고문 PDF · 서식 쪽 떼기)이 그 답으로 신청 양식 / 내용 문서를 가른다
      (읽는 곳 collector/attach-role-ai.mjs · 설계 「5번 연결」 — 붙은 문서(mixed)는 서식이 시작되는 줄 formStart 를 경계로 PDF 둘이 된다).

   🔴 `data/registered.json` 을 고치지 않는다 — 무료 길 값을 덮으면 비상망이 사라지고, 그 파일은 충돌하면 통째로 깨진다.
   🔴 돈이 나가는 로봇이다 — 스위치 둘(`card-read-config.json` enabled + 환경 변수 CARD_READ_ENABLE=1)이 다 켜져야 부른다.
      한 실행의 상한(maxPerRun · maxUsdPerRun)을 넘으면 멈춘다. 원문 해시가 같은 공고는 다시 읽지 않는다.

   실행: node collector/card-read.mjs                 (미리보기 — 부르지 않는다)
         node collector/card-read.mjs --write         (반영 · 스위치가 켜져 있어야 부른다)
         node collector/card-read.mjs --only=<id> --write
         CARD_READ_FAKE=<파일> … --write              (가짜 응답 {id: 응답} — 관문이 돈 없이 돌린다)
         node collector/card-read.mjs --recheck --write  (결과 파일에서 **빠진** 공고만 장부에 남긴 4번 응답으로 다시 만든다 — 결과를 잃었을 때 · 돈 0 ·
                                                          🔴 결과가 있는 공고는 건드리지 않는다: 6번이 고친 카드를 4번의 답으로 되돌리지 않는다 · 2026-11-22)
         node collector/card-read.mjs --check          (결과 파일의 꼴을 잰다 — 워크플로가 저장 전에)
         node collector/card-read.mjs --stats | --gate-alarm   (기록 · 경보 세기 — 돈 0)
         node collector/card-read.mjs --activities …   (대외활동·공모전 목록 — 위의 모든 꼴에 붙여 쓴다 · 2026-11-25 · 설계 docs/designs/paid-gate-activities.md 5-3)
            같은 로봇이 **파일 이름만 활동 것으로 바꿔** 읽고 쓴다(collector/act-card.mjs ACT_FILES) · 목록 모양·원문·지시문·첨부 기다리기·넘기는 날만 활동 것.
            스위치는 셋 — 설정의 enabled · activities.enabled · 환경 변수 CARD_READ_ENABLE=1 (상한은 activities 칸의 값 · 목록마다 따로 센다)
         node collector/card-read.mjs --activities --only=<id>,<id> --write   (표시가 없는 글도 지정하면 읽는다 — 유료 시험 워크플로)
   ============================================================ */
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { indexTexts, sourceFor, hasText } from './notice-source.mjs';
import { attachmentText, docOrder, readableDoc, loadNoticeDocIndex } from './attachment-text.mjs';
import { closedForStudents } from './rescue-plan.mjs';
import { sameTitle } from './detail-url.mjs';
import { AI_ROLES, fileHash16 } from './attach-role-ai.mjs';
import { ACT_FILES, ACT_SYSTEM, actGateOn, actItems, makeActSources, actAwaits } from './act-card.mjs';

const require = createRequire(import.meta.url);
const HERE = new URL('.', import.meta.url);
/* 대외활동·공모전 목록(`--activities` · 2026-11-25) — 파일 이름만 활동 것으로 바꿔 읽고 쓴다. 아래 본편에 적힌 파일 이름은 장학금 것 그대로다:
   장학금 실행은 한 글자도 달라지지 않고, 두 목록은 서로의 파일을 건드릴 수 없다(관문 「대외활동 유료 관문 ② 카드 쓰기」 ①·⑦) */
const ACT = process.argv.includes('--activities');
const P = (rel) => fileURLToPath(new URL((ACT && ACT_FILES[rel]) || rel, HERE));
const readJson = (rel, dflt) => { try { return JSON.parse(fs.readFileSync(P(rel), 'utf8')); } catch { return dflt; } };
const log = (m) => console.log(`[card-read${ACT ? ' 활동' : ''}] ${m}`);

export const MODELS = { a: 'claude-opus-5-5', b: 'claude-sonnet-5-5' };
export const PRICE = { 'claude-opus-5-5': [4, 20], 'claude-sonnet-5-5': [2, 10] };   // 달러 / 100만 토큰 (입력, 출력) — 2026-11 요금

const LINE_RULES = `줄마다 두 가지를 냅니다 — text 와 quote.
- text: 학생에게 보일 문장. 자연스럽고 깔끔한 한국어로 다시 써도 됩니다(끊긴 문장 잇기 · 번호·기호·이름표 떼기 · 어색한 말 다듬기 · 「~인 자」를 「~인 학생」으로 등). 한 줄에 하나만.
- quote: 그 text 의 근거가 되는 원문 부분을 **한 글자도 바꾸지 않고 그대로** 복사합니다(띄어쓰기·기호 포함 · 이어진 한 덩어리 · text 의 사실이 다 들어 있을 만큼만 짧게).

가장 중요한 규칙 — 문장은 다듬어도 사실은 바꾸지 않습니다.
- 숫자(학점·평점·금액·인원·구간·학년·날짜)는 원문에 적힌 그대로 씁니다. 단위를 바꾸거나(100만 원 → 1,000,000원) 계산하지 않습니다.
- 부정·비교 말(않·못·아니·없·제외·불가·이상·이하·미만·초과·이내)은 원문에 있는 것을 빼지도, 없는 것을 더하지도 않습니다.
- 기관·재단·학교 이름은 원문에 적힌 이름 그대로 씁니다. 줄이지 않습니다.
- 원문에 없는 사실은 쓰지 않습니다. 원문에 없는 칸은 비워 둡니다. 추측하지 않습니다. 모르면 비우는 것이 정답입니다.
- 접수 기간을 늘린다는 「연장」 공고인데 늘어난 마감일이 원문에 없으면 deadline 은 비웁니다(옛 마감을 쓰지 않습니다).`;
const FIELDS = `칸의 뜻 — 섞지 마세요.
- eligibility: 누가 받을 수 있는가. 한 줄에 요건 하나. 모든 줄은 「~인 자」「~한 학생」처럼 사람으로 끝나거나 명사로 끝납니다. 「~하고,」「~이며,」「~으로,」로 끝나는 줄은 틀린 줄입니다.
  자격이 아닌 것: 「신청자격」 같은 제목, 장학금 종류 이름을 늘어놓은 줄(「성적우수·특기·다자녀 … 장학금」), 선발 인원(「200명 내외」), 선발 방법·심사 기준, 제출 서류, 금액.
- excludes: 받을 수 없는 사람. **누가 못 받는지만** 적습니다 — 칸 이름이 이미 '받을 수 없는 경우'이므로 「…는 선발에서 배제됩니다」「…는 지원 불가」「… 제외」 같은 뒷말은 뗍니다.
  「9학기 진학 및 부분 등록자는 선발에서 배제됩니다.」 → 「9학기 진학 및 부분 등록자」 · 「2027학년도 1학기 등록금성 장학금 수혜자는 지원 불가」 → 「2027학년도 1학기 등록금성 장학금 수혜자」 · 「휴학생 제외」 → 「휴학생」
- priority: 우대·우선 선발·가산점 기준. 자격이 아닙니다.
- amount: 장학금액·지원금액이 **숫자로** 적힌 문구만. 금액 숫자가 없는 줄(「생활지원금(타 장학금 중복 수혜 가능)」)은 amount 가 아닙니다 — 필요하면 notes 로.
- deadline: 신청(접수) 마감일. 「11. 18부터 11. 26까지」면 마감은 11. 26 입니다(시작일이 아닙니다). 게시일·발표일·선발일·지급일은 마감이 아닙니다. date 는 YYYY-MM-DD, quote 는 그 날짜가 적힌 원문 문구.
- apply: 어디에 어떻게 내는가(접수 방법·접수처). 문의 전화번호는 넣지 않습니다.
- documents: 제출 서류의 **이름**. 서류 하나에 한 줄. 「제출서류」 같은 제목 줄, 「…을 읽어보시고 참고하시길 바랍니다」 같은 안내 문장은 서류가 아닙니다(원문이 서류 이름을 적지 않았으면 비웁니다).
- notes: 유의사항(이중수혜 제한, 지급 조건 등) 가운데 학생이 신청 전에 알아야 하는 것만. 선발 인원, 발표일, 「자세한 사항은 공고문 참조」 같은 줄은 넣지 않습니다.
- title: 공고 제목에서 게시판 말머리([공통]·[교외]·[학생지원팀] 등)와 꼬리 날짜((~11/26) 등)를 뗀 것. 그 밖의 글자는 그대로.
- host: 장학금을 주는 곳(재단·기관·대학). 원문에 적힌 이름 그대로 — 공고문(첨부)에 적힌 정식 이름을 먼저 쓰고, 없으면 제목에 적힌 꼴을 씁니다. 게시판을 운영하는 대학은 주는 곳이 아닙니다(그 대학의 교내 장학금이 아니라면).

그 밖에.
- 사이트 메뉴, 바닥글, 이전글·다음글 제목, 조회수, 첨부파일 이름 목록은 공고 내용이 아닙니다.
- 한 공고에 장학금이 여러 종 묶여 있으면 multi 를 true 로 하고, **모든 종에 공통인 것만** 채웁니다(종마다 다른 자격·금액은 비웁니다).
- 본문과 첨부 어디에도 공고 내용이 없으면(메뉴뿐·오류 화면) unreadable 을 true 로 하고 나머지는 비웁니다.`;
/* 4-1 첨부 구분 (2026-11-21 개발자 지시 — *"내용 문서랑 신청 양식을 미리 1차로 구분해놓고(지능이 있는 ai 가)"*) — 같은 말을 6번 최종 검토도 쓴다.
   🔴 이 답이 그대로 변환 로봇의 갈래가 된다(attachment-text attachDecision — 기계 규칙이 뒤집지 않는다). 그래서 「학생이 채우는 서식」의 선을 여기서 긋는다:
      추천서·확인서처럼 남이 쓰는 서식만 든 파일은 form 이 아니다(앱 신청서 칸은 학생이 채워 내는 것만 — data.js isApplicationForm 과 같은 선) */
export const ATTACH_RULES = `첨부 구분(attachments) — 꼬리표([A1]·[A2]…)가 붙은 첨부마다 한 줄씩, 빠짐없이 냅니다.
- tag: 그 첨부의 꼬리표(A1 처럼 대괄호 없이)
- role: 넷 중 하나
   content — 읽는 글(공고문·안내문·요강·포스터·FAQ). 그 내용은 카드에 들어갑니다.
   form — 학생이 직접 채워서 내는 서식만 든 파일(신청서·지원서·자기소개서·학업계획서·서약서·개인정보 동의서).
          교수·기관이 써 주는 서식(추천서·확인서)만 든 파일은 form 이 아니라 content 입니다(학생이 채우는 것이 아닙니다).
   mixed — 한 파일 안에 읽는 글(공고문)과 학생이 채워 내는 서식이 **둘 다** 있다.
   other — 이 공고의 문서가 아니거나(다른 장학금·지난 학년도·결과 발표) 읽을 내용이 없다(깨진 글자·빈 문서).
- formStart: role 이 mixed 일 때만 — 서식이 시작되는 줄(「[별지 제1호 서식]」「장학금 신청서」 같은 서식의 첫 줄)을 원문 그대로 한 줄. 서식이 여럿이면 맨 처음 서식의 첫 줄. 그 밖에는 빈 글자.
- why: 그렇게 본 까닭을 한 문장으로.
서식(form · mixed 의 서식 부분)에 든 빈칸 이름표·서약 문구·개인정보 동의 문구·작성 예시는 자격·서류·유의사항이 아닙니다 — 카드에 옮기지 않습니다.
content 첨부와 mixed 의 읽는 글 부분에 든 자격·제외·금액·마감·접수 방법·서류·유의사항은 카드에 빠짐없이 들어가야 합니다.`;
/* 카드 칸·첨부 구분의 규칙 한 벌 — 4번(여기)과 6번 최종 검토(final-review)가 같은 말을 쓴다(두 AI 가 다른 규칙으로 쓰고 고치면 서로 되돌린다) */
export const CARD_RULES = `${LINE_RULES}

${FIELDS}

${ATTACH_RULES}`;
export const SYSTEM = `한국 대학 장학금 공고의 원문을 사람처럼 끝까지 읽고, 공고 카드의 칸을 채웁니다. 결과는 학생에게 그대로 보입니다. 장학팀 직원이 공고를 읽고 학생에게 깔끔하게 정리해 준 것처럼 써 주세요.

원문은 「게시판 본문」과 「첨부」(공고에 붙은 파일에서 뽑은 글자) 여러 덩어리로 옵니다. 첨부 덩어리마다 머리에 꼬리표([A1]·[A2]…)와 파일 이름이 있습니다. 게시판 본문에는 사이트 메뉴·바닥글·이전글 제목이 섞여 있고, 공고의 진짜 내용이 첨부에만 있는 경우가 많습니다. 전부 끝까지 읽으세요.

${CARD_RULES}`;
const S = { type: 'string' };
/* 줄 = 학생에게 보일 문장(text) + 그 근거인 원문 그대로(quote) — 2026-11-20 원칙 8-1 개정(다듬기 허용 · 사실은 근거와 같아야) */
const A = { type: 'array', items: { type: 'object', additionalProperties: false, required: ['text', 'quote'], properties: { text: S, quote: S } } };
/* 4-1 첨부 구분 한 줄 — 꼬리표 · 갈래 · (붙은 문서면) 서식이 시작되는 줄 · 까닭 */
export const ROLES = { type: 'array', items: { type: 'object', additionalProperties: false, required: ['tag', 'role', 'formStart', 'why'],
  properties: { tag: S, role: { type: 'string', enum: AI_ROLES }, formStart: S, why: S } } };
export const SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['title', 'host', 'eligibility', 'excludes', 'priority', 'amount', 'deadline', 'apply', 'documents', 'notes', 'multi', 'unreadable', 'attachments'],
  properties: {
    title: S, host: S, eligibility: A, excludes: A, priority: A, amount: A,
    deadline: { type: 'object', additionalProperties: false, required: ['date', 'quote'], properties: { date: S, quote: S } },
    apply: A, documents: A, notes: A, multi: { type: 'boolean' }, unreadable: { type: 'boolean' },
    attachments: ROLES,
  },
};
export const LIST_FIELDS = ['eligibility', 'excludes', 'priority', 'amount', 'apply', 'documents', 'notes'];

/* 글자 견주기용 다듬기 — 공백·줄바꿈·전각 꼴만 무시(최종 검토가 「이미 든 줄인가」를 볼 때 쓴다) */
export const norm = (s) => String(s || '').normalize('NFKC').replace(/[\s ​]+/g, '').replace(/[·ㆍ•‧・∙]/g, '·')
  .replace(/[“”„]/g, '"').replace(/[‘’]/g, "'").replace(/[∼～〜]/g, '~').replace(/[–—―]/g, '-');
/* 맨 위 금액 — 금액 문구에서 숫자만(parse-amount wonIn). 묶인 공고는 종마다 달라 안 싣는다 · 총액·예산 줄은 1인당 금액이 아니다(「총 장학금 1억원」).
   ⚠️ 앱은 이 값을 **무료 길이 금액을 못 읽었을 때만** 쓴다(match-engine withCardRead · 리뷰 I5 — 무료 길의 금액 규칙이 더 꼼꼼하다) */
export function headAmount(final, item, wonIn) {
  if (final.multi || !final.amount) return 0;
  /* 🔴 정수로 맞춘다 (리뷰 2026-11-22) — wonIn 은 소수 낱말에서 소수를 낸다(「1.1억원」→ 110000000.00000001). 그대로 실으면 결과 파일 꼴 검사(checkData — head 는 정수)가
     저장을 막아, 돈 주고 읽은 것이 하나도 저장되지 않고 다음 실행이 같은 공고를 다시 산다 */
  const wons = final.amount.filter((l) => !/총\s?(?:장학금|지원|예산|\d)|합계|예산|[~∼～-]\s?\d/.test(l)).map((l) => Math.round(wonIn(l))).filter((v) => v > 0);
  return wons.includes(item.amountValue) ? item.amountValue : (wons.length === 1 ? wons[0] : 0);
}
/* AI 응답 → 앱에 실을 한 건 (2026-11-21 · 기계 검사 없음) — 줄의 text 를 그대로 싣는다. 여기서 하는 것은 **꼴 다듬기**뿐이다:
   글자가 아닌 것·빈 줄·같은 줄 거르기 · 마감은 달력에 있는 날짜 꼴(YYYY-MM-DD)일 때만(앱이 날짜로 읽는다) · 읽을 내용 없음이거나 실을 것이 없으면 null.
   줄이 맞는지 틀린지는 여기서 재지 않는다 — 6번 최종 검토(둘째 AI)가 원문과 대조해 고친다 */
const realDay = (v) => { const m = String(v || '').match(/^(\d{4})-(\d{2})-(\d{2})$/); if (!m) return false; const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])); return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3]; };
export const cardLines = (v) => [...new Set((Array.isArray(v) ? v : []).map((l) => (typeof l === 'string' ? l : (l && typeof l.text === 'string' ? l.text : ''))).map((t) => t.replace(/\s+/g, ' ').trim()).filter(Boolean))];
export function cardEntry(item, out, wonIn) {
  const o = (out && typeof out === 'object') ? out : {};
  const entry = { title: typeof o.title === 'string' ? o.title.trim() : '', host: typeof o.host === 'string' ? o.host.trim() : '' };
  for (const k of LIST_FIELDS) entry[k] = cardLines(o[k]);
  entry.multi = o.multi === true;
  entry.head = headAmount(entry, item, wonIn);
  const d = o.deadline && typeof o.deadline === 'object' ? o.deadline : null;
  entry.deadline = d && realDay(d.date) ? { date: d.date, quote: String(d.quote || '').replace(/\s+/g, ' ').trim() } : null;
  const filled = LIST_FIELDS.some((k) => entry[k].length) || !!entry.deadline;
  return o.unreadable === true || !filled ? null : entry;
}
/* 대학원생만 받는 공고인가 (2026-11-25 개발자 결정 · 화면 점검 — 상명대 「두레장학생 모집(학술정보관)」: 제목에 '대학원'이 없어 자동 등록을 지나갔고 카드를 읽고서야 드러났다).
   이 앱의 학생은 정의상 학부생이고(온보딩) 정식 등록은 대학원 공고를 뺀다(운영 원칙 2) — 그런 숨김 등록분은 학생 화면에 올리지 않고 사람에게 넘긴다(gateHeld 'grad-only').
   판정은 앱과 같은 함수(parse-requirements parseDegree·mentionsUndergrad — 묶음째 인자로 받는다)로: 자격 줄 가운데 **대학원생을 대상으로 말하는 줄**이 있고, 학부를 말하는 자격 줄이 하나도 없을 때만.
   🔴 틀려도 '안 올림'이지 '틀린 미달'이 아니다 — 관리자 「할 일」에 뜬다. 학부·대학원을 나란히 받는 공고(「학부 및 대학원 재학생」)·대학원 기준이 표의 한 칸인 공고는 걸리지 않는다 */
export function gradOnlyCard(entry, PR) {
  const lines = (entry && Array.isArray(entry.eligibility)) ? entry.eligibility : [];
  /* 앱이 미달을 내는 그 판정(parseDegree — 「대학원생은 지원 불가」 같은 반대말·대상이 아닌 줄은 걸러 준다)으로 본다(리뷰 2026-11-25) */
  const isGrad = (l) => { const d = PR.parseDegree(PR.untag(l), false); return !!d && d.want === 'grad'; };
  /* 대학원 말이 없는 줄이 재학생·학년을 말하면 학부생도 받는 공고다(「2~4학년 재학생」 + 「석사과정 1~2학기 재학생」 두 줄) */
  const otherStudents = (l) => !/대학원|석사|박사/.test(l) && /재학|학년/.test(l);
  return lines.some(isGrad) && !lines.some((l) => PR.mentionsUndergrad(l) || otherStudents(l)) && !/학부/.test(String((entry && entry.title) || ''));
}
/* 4-1 — AI 가 낸 첨부 갈래를 받아 둔 원본 파일에 잇는다(꼬리표 → 파일). 모르는 꼬리표·갈래는 버린다 · 같은 파일은 한 번 */
export function rolesOf(parts, out) {
  const byTag = new Map((parts || []).filter((x) => x && x.tag).map((x) => [x.tag, x]));
  const docs = [];
  for (const a of (out && Array.isArray(out.attachments)) ? out.attachments : []) {
    const x = a && byTag.get(String(a.tag || '').replace(/[\[\]\s]/g, '').toUpperCase());   // 「[A2]」·「a2」 도 A2
    if (!x || !AI_ROLES.includes(a.role) || docs.some((d) => d.file === x.file)) continue;
    docs.push({ file: x.file, attach: x.attach, hash: x.hash, role: a.role, formStart: a.role === 'mixed' ? String(a.formStart || '').replace(/\s+/g, ' ').trim() : '', why: String(a.why || '').replace(/\s+/g, ' ').trim().slice(0, 200) });
  }
  return docs;
}

/* ── 원문 = 게시판 본문 + 첨부 글자 (eligibility-ai·extract-excerpts 와 같은 길: notice-source · elig-docs · attachment-text) ── */
export function sourceText(parts) { return parts.map((x) => `===== ${x.label} =====\n${x.text}`).join('\n\n'); }
/* 🔴 조회수는 원문이 아니다 — 본문을 다시 받을 때마다 그 숫자만 바뀌어 같은 공고를 돈 내고 또 읽힌다(2026-11-18 실측: 나흘에 839건 중 27건 · 전부 조회수뿐).
   ponytail: 이름표(「조회수」) 붙은 숫자만 뗀다 — 이름표 없이 숫자만 한 줄인 조회수(dep.hufs 브라우저 본문)는 못 잡는다. 숫자뿐인 줄을 다 떼면 표 칸(「300」)이 바뀐 것을 놓친다. 새는 돈이 보이면 게시판별 머리 줄을 자르는 쪽으로 */
const hashText = (text) => String(text).replace(/(조회\s?수)\s*:?\s*\d[\d,]*(?![\d,.\-/~%가-힣A-Za-z])/g, '$1');   // 뒤에 글자·기호가 붙은 숫자(「2027학년도」·「300만원」·「11.26까지」)는 조회수가 아니라 내용이다(리뷰)
export const sourceHash = (text, system = SYSTEM) => crypto.createHash('sha256').update(system).update('\n').update(hashText(text)).digest('hex').slice(0, 16);   // 지시문이 바뀌어도 다시 읽는다 · 활동 목록은 활동 지시문으로 센다(act-card ACT_SYSTEM)
/* 덩어리 = 게시판 본문 + 받아 둔 첨부 원본 **전부**(2026-11-21 · 4-1 첨부 구분) — 첨부마다 꼬리표([A1]…)와 이름을 붙여 AI 가 하나씩 가를 수 있게 한다.
   · 신청서 로봇이 받은 원본(forms-index 줄 = formRows · 이름을 안다)이 먼저, 그다음 자격 로봇이 받은 공고문류(elig-docs · 이름 모름) — 바이트가 같은 사본은 한 번만.
   · 글자를 못 뽑은 파일(스캔 PDF·그림)은 여기 없다 — 그 파일은 유료 첨부 판정(attach-role-read)이 파일째 본다 */
export function makeSources({ texts, browserBodies, eligDocs, extractedDir, formRows = [] }) {
  const idx = indexTexts(texts, browserBodies || {});
  return (it) => {
    const s = sourceFor(it, idx); const out = []; const seen = new Set(); let n = 0;
    if (hasText(s)) out.push({ label: '게시판 본문', text: s.text });
    const add = (file, attach, text) => {
      const hash = fileHash16(`${extractedDir}/${file}`);
      if (hash && seen.has(hash)) return;
      if (hash) seen.add(hash);
      n += 1;
      const shown = attach || `(이름 모름) ${file.replace(/^(?:elig|form)-[a-z0-9]+-/, '').replace(/\.(ocr\.)?txt$/, '')}`;
      out.push({ tag: `A${n}`, file, attach: attach || null, hash, label: `첨부 [A${n}] ${shown}`, text });
    };
    const textOf = (file) => { try { return attachmentText(`${extractedDir}/${file}`) || ''; } catch { return ''; } };
    const attNames = new Set((it.attachments || []).map((a) => a && a.name).filter(Boolean));
    const titles = [it.boardTitle, it.name, it.title].filter(Boolean);
    for (const r of formRows || []) {
      /* 그 공고의 줄만 — id 가 적힌 줄은 id 로 · 옛 줄(사람 표적)은 같은 제목 + 그 공고의 첨부 이름(attachment-text noticeDocFiles 와 같은 셈) */
      const mine = r.id ? r.id === it.id : (attNames.has(r.attach) && titles.some((t) => sameTitle(t, r.title)));
      if (!mine) continue;
      const t = textOf(r.file);
      if (t.replace(/[^가-힣]/g, '').length >= 40) add(r.file, r.attach, t);   // 서식은 글자가 적다 — 한글 40자면 가를 수 있다
    }
    for (const f of docOrder(((eligDocs || {})[it.id] || {}).files || [])) {
      const t = textOf(f);
      if (t && readableDoc(`${extractedDir}/${f}`, t)) add(f, null, t);
    }
    return out;
  };
}
/* 학생 화면에서 내려간 공고인가 — 🔴 **유료가 읽은 마감이 있으면 그 마감으로** 잰다 (2026-11-15 리뷰 C4).
   무료 길 마감으로 재면, 유료가 「접수 시작일을 마감으로 읽은 것」을 바로잡은 공고(인석장학회 11.18 → 11.26)를 옛 마감 다음 날 결과 파일에서 지워 버린다 —
   그러면 앱은 무료 길로 돌아가 마지막 한 주 동안 그 공고를 「마감」으로 보인다. 앱도 같은 마감(얹은 뒤의 값)으로 잰다 */
export function closedNow(it, paid, today) {
  const d = paid && paid.deadline && paid.deadline.date;
  return closedForStudents(d ? { ...it, deadline: d } : it, today);
}
/* 대상 — 학생 화면에 떠 있는 정식 등록 공고 중, 원문이 있고, 그 원문(과 지시문)을 아직 안 읽은 것. 마감이 가까운 것부터 */
/* 🔴 2026-11-20 개발자 결정 「나」 — 유료로 읽는 것은 **숨김 등록분(`paidGate`)과 그 뒤 사람이 등록한 공고(`paidRead`)만**. 그 전 등록분은 숨기지도 다시 읽지도 않는다(지시문이 바뀌어 해시가 바뀌어도) */
/* 🔴 3번(원문 받기)이 끝난 뒤에 읽는다 (리뷰 2026-11-22 · 개발자 흐름 「본문과 첨부파일을 토대로 공고 카드 작성」) — 공고에 첨부가 달려 있는데 받아 둔 첨부 글자가 아직 하나도 없으면
   등록 뒤 이틀(days)까지는 기다린다. 본문만 보고 먼저 읽으면 다음 날 새벽 첨부가 도착해 원문이 바뀌고, 같은 공고를 돈 내고 다시 읽는다(6번도 다시 본다 · 실측 열 건 중 여섯 건).
   이틀이 지나도 첨부 글자가 없으면(받을 수 없는 파일·그림뿐) 있는 것으로 읽는다 — 사흘 관문(gateStalled) 안쪽이다 */
export const awaitsAttach = (it, parts, today, days = 2) => days > 0
  && (it.attachments || []).some((a) => a && !a.bodyImage)
  && !(parts || []).some((x) => x && x.tag)
  && daysSince(it.paidGate || it.paidRead || today, today) < days;
/* only = 지정한 공고만(한 건의 id 또는 여러 건의 목록 — 유료 시험 워크플로 · 표시가 없어도, 이미 읽었어도 읽는다) ·
   system·awaits = 활동 목록이 제 지시문과 제 기다리기 규칙을 넘긴다(act-card ACT_SYSTEM·actAwaits) — 안 주면 장학금 것 */
export function pickTargets(items, partsOf, ledger, { today, giveUpAfter = 3, only = null, paid = {}, waitAttachDays = 2, system = SYSTEM, awaits = awaitsAttach } = {}) {
  const ids = only && only.length ? [].concat(only) : null;
  const out = [];
  for (const it of items) {
    if (it.program) continue;
    if (!ids && !it.paidGate && !it.paidRead) continue;   // paidRead = 사람이 등록한 공고(숨기지 않고 읽기만 · admin-apply register)
    if (ids ? !ids.includes(it.id) : closedNow(it, paid[it.id], today)) continue;
    const parts = partsOf(it), text = sourceText(parts);
    if (!ids && awaits(it, parts, today, waitAttachDays)) continue;   // 첨부가 아직 안 왔다 — 내일 다시 본다
    if (text.replace(/[^가-힣]/g, '').length < 40) continue;      // 읽을 원문이 없다 — 사흘 뒤 사람에게(gateHeldOf no-source)
    const hash = sourceHash(text, system), led = ledger[it.id] || {};
    if (!ids && led.hash === hash && (led.done || (led.tries || 0) >= giveUpAfter)) continue;
    out.push({ it, parts, text, hash });
  }
  const key = (t) => t.it.deadline || '9999';
  return out.sort((x, y) => (key(x) < key(y) ? -1 : key(x) > key(y) ? 1 : 0));
}
/* 사람에게 넘길 숨김분 — 앱은 여기 적힌 공고를 사흘이 지나도 무료 값으로 올리지 않는다(match-engine paidGateOpen · 관리자 「할 일」 컨펌 대기).
   grad-only: 카드를 읽어 보니 대학원생만 받는 공고다(gradOnlyCard) ·
   no-source: 등록 뒤 사흘이 지나도 읽을 원문(한글 40자)이 없다 · unreadable: AI 가 읽었는데 실을 것이 없었다(읽을 내용 없음 — 메뉴뿐·오류 화면).
   🔴 유료가 그냥 멈춘 것(스위치·잔액·실패)은 적지 않는다 — 그 공고는 사흘 뒤 무료 값으로 올라가야 한다(비상망) */
const daysSince = (from, today) => Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${String(from).slice(0, 10)}T00:00:00Z`)) / 86400000);
export function gateHeldOf(items, partsOf, ledger, paid, today, waitDays = 3) {
  const out = {};
  for (const it of items) {
    if (!it.paidGate || paid[it.id] || closedNow(it, null, today)) continue;
    const led = ledger[it.id];
    if (led && led.gradOnly) { out[it.id] = 'grad-only'; continue; }
    if (led && led.done) { out[it.id] = 'unreadable'; continue; }
    if (daysSince(it.paidGate, today) > waitDays && sourceText(partsOf(it)).replace(/[^가-힣]/g, '').length < 40) out[it.id] = 'no-source';
  }
  return out;
}
/* 유료가 멈춘 숨김분 — 사흘 넘게 기다렸는데 통과도 사람 몫(gateHeld)도 아닌 것. 앱은 이것을 무료 값으로 올린다(비상망) → 경보(card-read.yml)로 알린다 */
export function gateStalled(items, data, today, waitDays = 3) {
  const paid = (data && data.items) || {}, held = (data && data.gateHeld) || {};
  return items.filter((it) => it.paidGate && !paid[it.id] && !held[it.id] && !closedNow(it, null, today) && daysSince(it.paidGate, today) > waitDays);
}
/* ── 활동 목록의 사람 몫 · 멈춘 글 (2026-11-25 · 설계 docs/designs/paid-gate-activities.md 5-3) — 까닭 셋은 위와 같고 **넘기는 때**만 다르다 ──
   🔴 아직 한 번도 학생에게 보이지 않은 글만 넘긴다. 앱은 표시 뒤 나흘째 0시에 그 글을 무료 값으로 올린다(match-engine paidGateOpen — 사흘 초과).
      위 gateHeldOf 는 원문 없는 공고를 나흘째 실행에서 넘겨, 반나절 보였다가 사라진다 — 장학금은 그 사이 「실시간 공고」 줄이 자리를 채우지만 활동 탭에는 그런 줄이 없다.
      그래서 활동 글은 **사흘째**(표시한 날 = 0일)에 넘기고, 나흘째부터는 전에 넘긴 글(prevHeld — 지난 실행의 gateHeld)만 넘긴 채로 둔다.
      사흘째 실행이 없었던 글은 무료 값으로 남는다(보였다가 사라지지 않는다). 넘긴 글도 원문이 오면 풀려 다시 대상이 된다.
   예외 하나 — 대학원생 전용으로 드러난 글은 이미 보였어도 내린다(장학금 2026-11-25 결정과 같다). 장학금 쪽 동작은 바꾸지 않는다(위 함수 그대로) */
/* 🔴 앱은 마감 다음 날까지 글을 보인다(app.js CLOSED_KEEP_DAYS 1 · app-activities activitiesForMe) — 로봇이 마감 당일이 지나자마자 넘김을 풀면 그 하루 무료 값으로 보인다(최종 리뷰 2026-11-26).
   그래서 활동 글의 「닫힘」은 하루 늦게 잰다(넘기기·멈춤 세기 둘 다) */
const ACT_KEEP_DAYS = 1;
const actClosed = (it, today) => closedNow(it, null, new Date(Date.parse(`${today}T00:00:00Z`) - ACT_KEEP_DAYS * 86400000).toISOString().slice(0, 10));
export function actGateHeldOf(items, partsOf, ledger, paid, today, prevHeld = {}, waitDays = 3) {
  const out = {};
  for (const it of items) {
    if (!it.paidGate || it.paidOpen || it.hidden || paid[it.id] || actClosed(it, today)) continue;
    const led = ledger[it.id];
    if (led && led.gradOnly) { out[it.id] = 'grad-only'; continue; }
    const waited = daysSince(it.paidGate, today);
    if (waited > waitDays && !(prevHeld || {})[it.id]) continue;   // 이미 무료 값으로 올랐다 — 다시 숨기지 않는다
    if (led && led.done) { out[it.id] = 'unreadable'; continue; }
    if (waited >= waitDays && sourceText(partsOf(it)).replace(/[^가-힣]/g, '').length < 40) out[it.id] = 'no-source';
  }
  return out;
}
/* 읽고도 실을 것이 없어 무료 값으로 남은 글(장부 done)은 「멈춘 글」이 아니다 — 세면 그 글이 마감될 때까지 경보가 꺼지지 않는다 */
export function actGateStalled(items, data, ledger, today, waitDays = 3) {
  const paid = (data && data.items) || {}, held = (data && data.gateHeld) || {};
  return items.filter((it) => it.paidGate && !it.paidOpen && !it.hidden && !paid[it.id] && !held[it.id] && !((ledger || {})[it.id] || {}).done
    && !actClosed(it, today) && daysSince(it.paidGate, today) > waitDays);
}
/* 유료 관문 기록 (2026-11-21 개발자 지시 「위의 두개도 켜서」 — 실제 비용·통과 재기를 켠다) — 이미 저장되는 장부·결과 파일에서 센다(돈 0).
   유료 로봇이 돌 때마다 실행 요약 칸에 적힌다(card-read.yml · final-review.yml 의 `--stats` 단계). 비용은 장부의 usd(실패한 시도까지 실제로 쓴 돈).
   「6번이 고친 것」 = 최종 검토가 카드·첨부 구분에서 바꾼 줄 수(collector/final-review.json changes) — 4번 AI 가 얼마나 틀렸는지를 이 숫자로 본다 */
export function gateStats({ items = [], data = {}, ledger = {}, frLedger = {}, frResult = {}, today, stalled = null }) {   // stalled = 활동 목록이 제 셈(actGateStalled)을 넘긴다
  const paid = (data && data.items) || {}, held = (data && data.gateHeld) || {};
  const gated = items.filter((it) => it.paidGate);
  const open = gated.filter((it) => !closedNow(it, paid[it.id], today));
  const passed = open.filter((it) => paid[it.id]).length, toPerson = open.filter((it) => !paid[it.id] && held[it.id]).length;
  const ai = Object.values(ledger || {}).filter((l) => l && l.mode === 'ai' && l.done);
  const fr = Object.values(frLedger || {}).filter((l) => l && l.done);
  const frItems = Object.values((frResult && frResult.items) || {});
  const sum = (xs) => xs.reduce((a, l) => a + (Number(l.usd) || 0), 0);
  const count = (k) => frItems.reduce((a, r) => a + ((r && r[k]) || []).length, 0);
  return {
    gated: gated.length, open: open.length, passed, toPerson, waiting: open.length - passed - toPerson,
    stalled: stalled != null ? stalled : gateStalled(items, data, today).length, manual: items.filter((it) => it.paidRead).length,
    read: ai.length, usdPerNotice: ai.length ? sum(ai) / ai.length : null,
    frRead: fr.length, frUsdPerNotice: fr.length ? sum(fr) / fr.length : null,
    frChanges: count('changes'), frProblems: count('problems'),
  };
}
export function gateStatsText(st, today, act = false) {   // act = 활동 목록의 기록(제목·낱말만 다르다 · 직접 등록 줄은 장학금에만 있다)
  const usd = (v) => (v == null ? '—' : `$${v.toFixed(3)}`);
  const noun = act ? '글' : '공고';
  return [`### ${act ? '대외활동·공모전 ' : ''}유료 관문 기록 (${today})`,
    `- ${act ? '숨겨 둔 활동 글' : '숨김 등록 공고'} ${st.gated}건(마감 전 ${st.open}건): 학생 화면에 오름 ${st.passed} · 사람에게 넘김 ${st.toPerson} · 기다리는 중 ${st.waiting}(그중 사흘 넘어 무료 값으로 오른 것 ${st.stalled})`,
    ...(act ? [] : [`- 관리자가 직접 등록한 공고(숨기지 않고 읽기만) ${st.manual}건`]),
    `- 4번 카드 쓰기(AI 하나 · 기계 검사 없음): 읽은 ${noun} ${st.read}건 · 건당 평균 ${usd(st.usdPerNotice)}`,
    `- 6번 최종 검토(둘째 AI): 본 ${noun} ${st.frRead}건 · 건당 평균 ${usd(st.frUsdPerNotice)} · 고친 것 ${st.frChanges}건 · 사람이 볼 것 ${st.frProblems}건`].join('\n');
}
/* 관리자 「할 일」에 보일 말 — **옛 두 읽기(11-20 전에 읽은 공고)의 장부에 남은 줄**을 사람 말로 푼다(그 공고들이 마감되면 사라진다).
   새 공고에는 기계 검사가 없어 이런 줄이 생기지 않는다(2026-11-21) — 새 공고에서 사람이 볼 것은 6번 최종 검토가 collector/final-review.json 에 적는다.
   🔴 로봇 말(held·verify·대조·「원문에 없는 글자」)을 쓰지 않는다 — 어느 칸 · 왜 빠졌는지 · 무엇을 확인하면 되는지를 한 문장씩 */
export const FIELD_LABEL = { eligibility: '지원 자격', excludes: '받을 수 없는 경우', priority: '먼저 뽑는 기준', amount: '금액', apply: '접수 방법',
  documents: '제출 서류', notes: '유의사항', deadline: '마감', title: '제목', host: '주는 곳' };
export function explainLine(d) {
  const label = FIELD_LABEL[d.field] || d.field;
  const pick = {
    quote: () => ['이 문장을 공고 원문(본문·첨부)에서 그대로 찾지 못했습니다 — 말을 바꿨거나 흩어진 표를 짜 맞췄을 수 있습니다.', `원문에 이 ${label} 내용이 실제로 적혀 있는지 확인해 주세요.`],
    empty: () => ['빈 줄이 들어왔습니다.', '확인할 것 없음 — 버리면 됩니다.'],
    deadline: () => [`마감 ${d.line}을 근거 문구에서 확인하지 못했습니다(${String(d.why || '')}).`, '원문에서 신청 마감일을 확인해 주세요(접수 시작일·발표일과 헷갈리지 않았는지).'],
    extension: () => [`「연장」 공고라 마감(${d.line})을 싣지 않았습니다 — 받아 두지 못한 연장 공고문에 진짜 마감이 있을 수 있습니다.`, '연장된 마감일을 원문에서 확인해 주세요.'],
    agree: () => ['(옛 방식) 두 번 읽었을 때 한쪽만 이 줄을 냈습니다 — 다른 쪽은 이 줄을 내지 않았거나 다르게 잘랐습니다.', `원문에 이 줄이 실제로 있는지, ${label}에 들어갈 줄인지 확인해 주세요.`],
    title: () => ['제목이 공고 제목에서 온 글자가 아닙니다.', '공고 제목을 확인해 주세요.'],
    host: () => ['주는 곳 이름을 원문에서 확인하지 못했습니다.', '원문에서 장학금을 주는 기관 이름을 확인해 주세요.'],
  }[d.kind] || (() => ['(옛 방식) 카드에서 빠진 줄입니다.', '원문에서 이 줄이 맞는지 확인해 주세요.']);
  const [reason, check] = pick();
  return { field: d.field, label, kind: d.kind || '', text: d.line, ...(d.quote ? { quote: d.quote } : {}), reason, check };
}
/* 관리자용 파일 — 공고마다 잡힌 줄(사람 말) · 사람에게 넘긴 숨김분. 앱은 받지 않는다(collector/ 아래) */
export function reviewOf(ledger, gateHeld) {
  const items = {};
  for (const [id, led] of Object.entries(ledger || {})) {
    const seen = new Set(), lines = [];
    for (const d of [...(led.held || []), ...(led.dropped || [])]) {
      const key = `${d.field}|${d.line}`;
      if (seen.has(key) || !String(d.line || '').replace(/[\s\-–·.]/g, '')) continue;
      seen.add(key); lines.push(explainLine(d));
    }
    if (lines.length) items[id] = { name: led.name, at: led.at, lines };
  }
  return { items, gateHeld: gateHeld || {} };
}
/* 결과 파일의 꼴 — 앱이 받는 파일이라 저장 전에 스스로 잰다(워크플로 `--check`). 문제 줄 목록을 낸다(비면 통과) */
export function checkData(data) {
  const bad = [];
  if (!data || typeof data !== 'object' || !data.items || typeof data.items !== 'object' || Array.isArray(data.items)) return ['items 가 객체가 아니다'];
  for (const [id, e] of Object.entries(data.items)) {
    if (!e || typeof e !== 'object' || Array.isArray(e)) { bad.push(`${id}: 항목이 객체가 아니다`); continue; }
    for (const k of LIST_FIELDS) if (!(e[k] === null || (Array.isArray(e[k]) && e[k].every((l) => typeof l === 'string' && l.trim())))) bad.push(`${id}: ${k} 가 글자 배열도 null 도 아니다`);
    if (!(e.deadline === null || (e.deadline && /^\d{4}-\d{2}-\d{2}$/.test(String(e.deadline.date)) && typeof e.deadline.quote === 'string'))) bad.push(`${id}: deadline 꼴`);
    if (!(Number.isInteger(e.head) && e.head >= 0)) bad.push(`${id}: head 가 0 이상의 정수가 아니다`);
    if (typeof e.host !== 'string' || typeof e.multi !== 'boolean' || typeof e.hash !== 'string') bad.push(`${id}: host·multi·hash 꼴`);
  }
  return bad;
}

/* ── 모델 부르기 ── */
export async function ask(client, model, item, source, effort, system = SYSTEM) {
  /* 🔴 thinking 을 끄지 않는다(오퍼스 5.5 는 끄면 400) · 강제 tool_choice 도 안 쓴다 — 꼴은 output_config.format 이 지킨다.
     안전 거절은 날 일이 없지만 5.5 계열 기본대로 서버 쪽 대체 모델을 켜 둔다(fallbacks: "default") */
  const stream = client.beta.messages.stream({
    model, max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default',
    system,
    output_config: { effort, format: { type: 'json_schema', schema: SCHEMA } },
    messages: [{ role: 'user', content: `공고 제목: ${item.name}\n게시한 곳: ${(item.eligibility && item.eligibility.schoolOnly) || '(여러 곳)'}\n\n${source}` }],
  });
  const msg = await stream.finalMessage();
  const u = msg.usage || {}, [pi, po] = PRICE[model] || [0, 0];
  const usd = ((u.input_tokens || 0) * pi + (u.output_tokens || 0) * po) / 1e6;
  /* 🔴 실패한 호출도 돈이 나갔다 (리뷰 2026-11-22) — 잘린 답·거절·깨진 답은 오류에 쓴 돈(usd)을 실어 보낸다. 받는 쪽이 실행 상한과 장부에 더한다(안 더하면 상한 밖에서 돈이 샌다) */
  const fail = (m) => Object.assign(new Error(m), { usd });
  if (msg.stop_reason === 'refusal') throw fail('모델이 처리를 거절함');
  if (msg.stop_reason === 'max_tokens') throw fail('출력이 잘림');
  const text = (msg.content || []).find((b) => b.type === 'text');
  if (!text) throw fail('글자 응답이 없음');
  let out;
  try { out = JSON.parse(text.text); } catch { throw fail('응답이 JSON 이 아님'); }
  return { out, usd };
}

/* ── 본편 — 직접 실행할 때만 (진짜 경로로 견준다 · find-boards.mjs 와 같은 이유) ── */
const ranDirectly = () => { try { return fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url)); } catch { return false; } };
if (process.argv[1] && ranDirectly()) {
  const WRITE = process.argv.includes('--write');
  const RECHECK = process.argv.includes('--recheck');   // 결과 파일에서 빠진 공고만 장부에 남긴 4번 응답으로 다시 만든다(결과를 잃었을 때 · 돈 0 · 있는 결과는 안 건드린다)
  const ONLY = (process.argv.find((a) => a.startsWith('--only=')) || '').slice(7).split(',').map((x) => x.trim()).filter(Boolean);   // 한 건 또는 쉼표로 여러 건(유료 시험) — 없으면 빈 목록
  const SYS = ACT ? ACT_SYSTEM : SYSTEM;                // 활동 목록은 제 지시문
  const awaits = ACT ? actAwaits : awaitsAttach;        // · 제 기다리기 규칙
  const TODAY = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);   // KST
  /* 있는 파일이 깨져 있으면 멈춘다 — 빈 것으로 읽고 이어 가면 전부 다시 읽는다(돈) · 없는 파일만 기본값 (리뷰 I10) */
  const strictJson = (rel, dflt) => { if (!fs.existsSync(P(rel))) return dflt; try { return JSON.parse(fs.readFileSync(P(rel), 'utf8')); } catch (e) { console.error(`[card-read] ${rel} 을 읽지 못했습니다(깨진 파일) — 멈춥니다: ${e.message}`); process.exit(1); } };
  const cfg = { enabled: false, maxPerRun: 20, maxUsdPerRun: 3, giveUpAfter: 3, effort: 'medium', maxMs: 8 * 60 * 1000, waitAttachDays: 2, ...readJson('card-read-config.json', {}) };   // 단계 시한 12분 안에 진행 중인 한 건까지 끝나게
  /* 활동 목록 — 스위치는 위쪽 enabled 와 activities.enabled 둘 다(actGateOn) · 상한은 activities 칸의 값(목록마다 따로 센다 — 활동 글이 몰려도 장학금 몫을 먹지 않는다) */
  if (ACT) Object.assign(cfg, cfg.activities || {}, { enabled: actGateOn(cfg) });
  const data = strictJson('../data/card-read.json', { items: {} });
  if (!data.items) data.items = {};
  if (process.argv.includes('--check')) {
    const bad = checkData(data);
    bad.slice(0, 20).forEach((l) => console.error(`[card-read] ✕ ${l}`));
    log(bad.length ? `결과 파일 꼴 문제 ${bad.length}건` : `결과 파일 꼴 통과 — ${Object.keys(data.items).length}건`);
    process.exit(bad.length ? 1 : 0);
  }
  /* 등록 목록도 깨져 있으면 멈춘다 — 빈 목록으로 읽고 이어 가면 결과·장부·첨부 구분이 「목록에서 빠진 공고」로 전부 지워진다(리뷰 2026-11-22) */
  const reg = strictJson('../data/registered.json', { items: [] });
  if (!Array.isArray(reg.items)) { console.error(`[card-read] ${ACT ? 'data/activities.json' : 'data/registered.json'} 에 items 목록이 없습니다 — 멈춥니다`); process.exit(1); }
  if (ACT) reg.items = actItems(reg.items);   // 활동 글을 로봇이 읽는 모양으로(id 없는 글은 빠진다 · 저장하지 않는다 — 이 로봇은 목록 파일을 쓰지 않는다)
  if (process.argv.includes('--stats')) {   // 유료 관문 기록(돈 0) — 워크플로가 실행 요약 칸에 붙인다
    const led = readJson('card-read-ledger.json', {});
    console.log(gateStatsText(gateStats({ items: reg.items, data, ledger: led, frLedger: readJson('final-review-ledger.json', {}), frResult: readJson('final-review.json', { items: {} }), today: TODAY,
      stalled: ACT ? actGateStalled(reg.items, data, led, TODAY).length : null }), TODAY, ACT));
    process.exit(0);
  }
  if (process.argv.includes('--gate-alarm')) {   // 경보 세기(GITHUB_OUTPUT 꼴 · 읽기만) — 값에 줄바꿈이 들어가지 않게 누른다
    /* 활동 스위치가 꺼져 있으면 0 — 꺼진 동안 표시 글이 사흘 뒤 무료 값으로 오르는 것은 정한 동작이다(멈춤이 아니다 · 경보 문구도 「켜져 있는데…」 · 최종 리뷰 2026-11-26) */
    const st = ACT ? (cfg.enabled ? actGateStalled(reg.items, data, readJson('card-read-ledger.json', {}), TODAY) : []) : gateStalled(reg.items, data, TODAY), one = (x) => String(x || '').replace(/[\r\n]+/g, ' ').trim();
    console.log(`count=${st.length}`);
    console.log(`list=${one(st.slice(0, 12).map((it) => `${one(it.name).slice(0, 40)}(${it.id})`).join(' / ')).slice(0, 900)}`);
    process.exit(0);
  }
  const docIdx = loadNoticeDocIndex(P('extracted'));   // 받아 둔 첨부 원본의 두 색인(자격 로봇 elig-docs.json · 신청서 로봇 forms-index.txt) — attachment-text 한 곳
  const partsOf = ACT
    ? makeActSources({ storeDir: P('act-text'), formRows: docIdx.forms, extractedDir: P('extracted') })   // 활동 글의 원문 = 글자 기록(collector/act-text) + 받아 둔 신청서 원본
    : makeSources({ texts: readJson('extracted/notices-text.json', {}), browserBodies: readJson('extracted/browser-bodies.json', {}), eligDocs: docIdx.elig, formRows: docIdx.forms, extractedDir: P('extracted') });
  const roles = readJson('attach-role-ai.json', { items: {} });   // 4-1 첨부 갈래(이 로봇이 쓴다 · collector/attach-role-ai.mjs 가 읽는다)
  if (!roles.items || typeof roles.items !== 'object') roles.items = {};
  const ledger = strictJson('card-read-ledger.json', {});
  const { wonIn } = require('../parse-amount.js');
  /* 임시 파일에 쓰고 이름을 바꾼다(쓰다 죽어도 반쪽 파일이 안 남는다) · 결과 파일을 장부보다 먼저(장부만 '읽음'이고 결과가 없는 상태가 안 생긴다) */
  const writeAtomic = (rel, obj) => { const p = P(rel), tmp = `${p}.tmp`; fs.writeFileSync(tmp, `${JSON.stringify(obj, null, 1)}\n`); fs.renameSync(tmp, p); };
  /* 대학원생 전용 숨김분은 결과에서 내린다(소급 — 이미 올라간 것도 · 6번이 고친 카드도 같은 잣대) — 장부에 표시가 남아 gateHeldOf 가 사람에게 넘긴다 */
  const PRq = require('../parse-requirements.js');
  const sweepGrad = () => {
    let n = 0;
    for (const it of reg.items) {
      const e = data.items[it.id];
      if (!e || !it.paidGate || !gradOnlyCard(e, PRq)) continue;
      delete data.items[it.id];
      ledger[it.id] = { ...(ledger[it.id] || { name: String(it.name).slice(0, 60) }), gradOnly: TODAY };   // done 은 건드리지 않는다 — 원문이 바뀌어 다시 읽어야 하는 공고의 재시도를 막지 않는다(리뷰)
      n += 1;
    }
    return n;
  };
  /* 활동 목록은 유료가 실제로 도는 실행에서만 새로 사람에게 넘긴다 — 스위치가 꺼진 동안 넘기면 끈 뒤에도 그 글이 숨는다(꺼진 동안은 사흘 뒤 무료 값으로 오르는 것이 정한 동작 · 최종 리뷰 2026-11-26).
     켜 있을 때 넘긴 글은 그대로 둔다 · 아래(유료를 부를지 정한 뒤)에서 다시 정한다 */
  let actHoldNew = cfg.enabled;
  const save = () => {
    sweepGrad();
    data.updatedAt = TODAY;
    data.gateHeld = ACT ? (actHoldNew ? actGateHeldOf(reg.items, partsOf, ledger, data.items, TODAY, data.gateHeld || {}) : (data.gateHeld || {})) : gateHeldOf(reg.items, partsOf, ledger, data.items, TODAY);
    writeAtomic('../data/card-read.json', data); writeAtomic('card-read-ledger.json', ledger);
    writeAtomic('card-read-review.json', { updatedAt: TODAY, ...reviewOf(ledger, data.gateHeld) });
    roles.updatedAt = TODAY; writeAtomic('attach-role-ai.json', roles);
  };

  /* 목록에서 빠진 공고·학생 화면에서 내려간 옛 공고는 결과 파일과 장부에서 뺀다(자라기만 하지 않게) — 내려갔는지는 유료 마감으로 잰다(closedNow).
     🔴 숨김·직접 등록분(paidGate·paidRead)의 결과는 **그 공고가 정식 등록 목록에 있는 동안 남긴다**(2026-11-21) — 마감이 지났다고 지우면 그 공고는 「결과 없음」이 되어
        사람에게 넘어가거나(읽을 내용 없음으로 잘못 뜬다) 무료 값으로 되돌아가고, 4번 AI 가 마감을 지난 날짜로 잘못 읽었을 때 6번이 바로잡을 카드도 사라진다.
        목록에서 빠지는 것은 수집 로봇이 한다(마감+30일 · 등록+60일) — 그때 같이 빠진다 */
  const live = new Map(reg.items.map((it) => [it.id, it]));
  const kept = (it) => !!(it && (it.paidGate || it.paidRead));
  let pruned = 0;
  for (const id of Object.keys(data.items)) { const it = live.get(id); if (!it || (!kept(it) && closedNow(it, data.items[id], TODAY))) { delete data.items[id]; pruned += 1; } }
  for (const id of Object.keys(ledger)) { const it = live.get(id); if (!it || (!kept(it) && !data.items[id] && closedNow(it, null, TODAY))) delete ledger[id]; }
  for (const id of Object.keys(roles.items)) if (!live.get(id)) delete roles.items[id];
  pruned += sweepGrad();   // 대학원생 전용으로 드러난 숨김분(소급) — 내린 것이 있으면 스위치가 꺼진 날에도 저장한다

  /* 한 건의 응답을 결과·장부·첨부 갈래에 적는다 — 읽기와 다시 만들기(--recheck)가 같은 길 */
  const put = (it, parts, hash, out) => {
    const led = ledger[it.id] = { ...(ledger[it.id] || {}), name: String(it.name).slice(0, 60), hash };
    const entry = cardEntry(it, out, wonIn);
    led.done = true; led.at = TODAY; led.mode = 'ai'; led.raw = out;
    delete led.error; delete led.held; delete led.dropped; delete led.gradOnly;
    if (entry) delete led.unreadable; else led.unreadable = true;
    /* 🔴 한 번 학생 화면에 올린 공고는 다시 숨기지 않는다 — 다시 읽기가 빈 결과를 내도 있던 결과를 남긴다(지우면 그 공고가 화면에서 사라진다) */
    if (entry) data.items[it.id] = { ...entry, hash, readAt: TODAY }; else if (!(kept(it) && data.items[it.id])) delete data.items[it.id];
    const docs = rolesOf(parts, out);
    if (docs.length) roles.items[it.id] = { at: TODAY, docs }; else delete roles.items[it.id];
    return { entry, docs };
  };

  if (RECHECK) {
    let n = 0, filled = 0;
    for (const it of reg.items) {
      const led = ledger[it.id];
      if (!led || led.mode !== 'ai' || !led.raw) continue;   // 옛 두 읽기 장부는 다시 만들 수 없다(그 결과는 결과 파일에 있는 그대로다)
      if (led.gradOnly) continue;   // 대학원생 전용으로 내린 공고는 「잃은 결과」가 아니다 — 되살리면 6번이 고치기 전의 카드로 돌아가고 표시도 지워진다(리뷰 2026-11-25)
      if (data.items[it.id]) continue;   // 🔴 결과가 있는 공고는 건드리지 않는다(2026-11-22) — 6번 최종 검토가 고친 카드일 수 있다(다시 만들면 4번의 답으로 되돌아간다). 잃은 것만 되살린다
      const parts = partsOf(it);
      if (sourceHash(sourceText(parts), SYS) !== led.hash) continue;   // 원문이 바뀌었다 — 다음 유료 실행이 다시 읽는다
      const r = put(it, parts, led.hash, led.raw); n += 1; if (r.entry) filled += 1;
    }
    if (WRITE) save();
    log(`다시 만들기 — 4번 응답 ${n}건으로 결과를 다시 만들었습니다(실음 ${filled}) · 쓴 돈 $0${WRITE ? '' : ' · 미리보기(--write 로 반영)'}`);
    process.exit(0);
  }

  const targets = pickTargets(reg.items, partsOf, ledger, { today: TODAY, giveUpAfter: cfg.giveUpAfter, only: ONLY, paid: data.items, waitAttachDays: cfg.waitAttachDays, system: SYS, awaits });
  const waiting = reg.items.filter((it) => !it.program && (it.paidGate || it.paidRead) && !closedNow(it, data.items[it.id], TODAY) && awaits(it, partsOf(it), TODAY, cfg.waitAttachDays)).length;
  log(`대상 ${targets.length}건 (유료 확인을 기다리는 숨김 등록분 가운데 마감 전이고 · 원문이 있고 · 이 원문을 아직 안 읽은 것) · 첨부를 기다리는 것 ${waiting}건 · 이미 실린 것 ${Object.keys(data.items).length}건 · 내린 것 ${pruned}건`);
  const fake = process.env.CARD_READ_FAKE ? JSON.parse(fs.readFileSync(process.env.CARD_READ_FAKE, 'utf8')) : null;
  const paidOn = cfg.enabled === true && process.env.CARD_READ_ENABLE === '1';
  actHoldNew = !!fake || paidOn;
  if (!WRITE) { targets.slice(0, 30).forEach((t) => log(`  · ${t.it.id} · ${String(t.it.name).slice(0, 40)} · 원문 ${t.text.length}자`)); log('미리보기 — 부르지 않았습니다 (--write 로 반영)'); process.exit(0); }
  if (!fake && !paidOn) { if (pruned) save(); log(`유료 스위치가 꺼져 있어 부르지 않았습니다 (card-read-config.json ${ACT ? 'enabled 와 activities.enabled 둘 다' : 'enabled'}: ${cfg.enabled} · CARD_READ_ENABLE: ${process.env.CARD_READ_ENABLE || '없음'})`); process.exit(0); }

  let client = null;
  if (!fake) { const { default: Anthropic } = await import('@anthropic-ai/sdk'); client = new Anthropic(); }
  const t0 = Date.now();
  let usd = 0, done = 0, filled = 0, failed = 0, streak = 0, stopped = '';
  try {
    for (const t of targets) {
      const left = targets.length - done - failed;
      if (done + failed >= cfg.maxPerRun) { stopped = `한 실행 상한 ${cfg.maxPerRun}건`; log(`${stopped}에 닿아 멈춥니다 — 남은 ${left}건은 다음 실행`); break; }
      if (usd >= cfg.maxUsdPerRun) { stopped = `한 실행 예산 $${cfg.maxUsdPerRun}`; log(`${stopped}에 닿아 멈춥니다 — 남은 ${left}건은 다음 실행`); break; }
      if (Date.now() - t0 >= cfg.maxMs) { stopped = '시간 예산'; log(`시간 예산(${Math.round(cfg.maxMs / 60000)}분)에 닿아 멈춥니다 — 남은 ${left}건은 다음 실행`); break; }
      /* 🔴 연달아 세 번 실패하면 멈춘다(리뷰 I8) — 잔액 부족·요청 꼴 오류 같은 '전부 실패'가 상한까지 돈을 쓰며 도는 것을 막는다 */
      if (streak >= 3) { stopped = '연달아 실패'; log(`연달아 ${streak}건 실패해 멈춥니다 — 남은 ${left}건은 다음 실행`); break; }
      if (fake && !fake[t.it.id]) continue;   // 가짜 응답에 없는 공고는 건드리지 않는다(장부에도 안 적는다)
      const led = ledger[t.it.id] = { ...(ledger[t.it.id] || {}), name: String(t.it.name).slice(0, 60) };
      if (led.hash !== t.hash) { led.hash = t.hash; led.tries = 0; led.done = false; delete led.raw; }
      let out = null, err = null;
      try {
        const r = fake ? { out: fake[t.it.id], usd: 0 } : await ask(client, MODELS.a, t.it, t.text, cfg.effort, SYS);
        usd += r.usd; led.usd = Math.round(((led.usd || 0) + r.usd) * 10000) / 10000; out = r.out;
      } catch (e) {
        err = e;
        const spent = Number(e && e.usd) || 0;   // 실패한 호출이 쓴 돈도 센다(ask 가 오류에 실어 보낸다)
        usd += spent; led.usd = Math.round(((led.usd || 0) + spent) * 10000) / 10000;
      }
      if (!err) {
        const r = put(t.it, t.parts, t.hash, out);
        done += 1; streak = 0; if (r.entry) filled += 1;
        const forms = r.docs.filter((d) => d.role === 'form').length, mixed = r.docs.filter((d) => d.role === 'mixed').length;
        log(`  ✓ ${t.it.id} · ${String(t.it.name).slice(0, 30)} · ${r.entry ? ['eligibility', 'excludes', 'documents'].map((k) => `${{ eligibility: '자격', excludes: '제외', documents: '서류' }[k]} ${r.entry[k].length}`).join(' · ') + ` · 마감 ${r.entry.deadline ? r.entry.deadline.date : '—'}` : '실을 것 없음(사람에게 넘김)'} · 첨부 ${r.docs.length}개(신청 양식 ${forms} · 붙은 문서 ${mixed})`);
      } else {
        failed += 1; streak += 1; led.tries = (led.tries || 0) + 1;
        led.error = String((err && err.message) || err).slice(0, 200);
        log(`  ✕ ${t.it.id} · ${led.error}`);
      }
      save();   // 건마다 저장 — 중간에 강제 종료돼도(단계 시한) 돈을 쓴 결과를 잃지 않는다
    }
  } finally {
    save();
  }
  log(`끝 — 읽음 ${done}건(실음 ${filled}) · 실패 ${failed}건 · 쓴 돈 $${usd.toFixed(4)} · 결과 파일 ${Object.keys(data.items).length}건${stopped ? ` · 멈춘 까닭: ${stopped}` : ''}`);
  /* 실패가 있으면 빨갛게 끝낸다 — 한 건만 성공해도 초록이면 19건 실패가 조용하다(리뷰 I8). 읽은 것은 위에서 이미 저장했다 */
  if (failed) process.exit(1);
}

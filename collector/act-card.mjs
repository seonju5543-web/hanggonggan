/* ============================================================
   대외활동·공모전 유료 관문 — 유료 로봇이 활동 목록을 돌 때 쓰는 것 (2026-11-25 · 설계 docs/designs/paid-gate-activities.md 5-3)

   로봇은 하나다(collector/card-read.mjs · final-review.mjs). `--activities` 로 돌면 그 로봇이
     · 파일 이름만 활동 것으로 바꿔 읽고 쓰고(ACT_FILES — 로봇 본편에 적힌 이름은 장학금 파일 그대로다)
     · 활동 글을 로봇이 읽는 모양으로 바꿔 받고(actView) · 원문을 글자 기록에서 모으고(makeActSources — collector/act-text.mjs)
     · 활동용 지시문으로 묻고(ACT_SYSTEM) · 첨부를 활동 글에 맞게 기다린다(actAwaits).
   상한 · 건마다 저장 · 같은 원문 다시 안 읽기 · 한 번 올린 글 안 내리기는 장학금과 같은 코드를 탄다.

   🔴 장학금 지시문(card-read SYSTEM · CARD_RULES)을 가져다 쓰지 않는다 — 활동 지시문을 고쳐도 장학금 공고를 다시 사지 않고, 그 반대도 같다.
   🔴 ACT_SYSTEM 을 고치면 열려 있는 활동 글을 전부 돈 내고 다시 읽는다(원문 해시가 지시문을 함께 센다 · 관문이 지시문의 해시를 고정해 둔다).
   🔴 이 파일은 card-read.mjs 를 불러오지 않는다 — card-read 가 이 파일을 부른다(서로 부르면 지시문 글자가 만들어지기 전에 읽힌다).
   관문: verify/test-collector.mjs 「대외활동 유료 관문 ② 카드 쓰기」
   ============================================================ */
import { readStore, daysSince, textDue } from './act-text.mjs';
import { attachmentText } from './attachment-text.mjs';
import { fileHash16 } from './attach-role-ai.mjs';
import { fileNameIn } from './attachment-link.mjs';

/* 파일 이름 바꾸기 — 왼쪽은 로봇 본편에 적힌 장학금 파일, 오른쪽은 `--activities` 일 때 그 자리에서 읽고 쓰는 활동 파일(로봇의 자리 collector/ 기준).
   🔴 로봇이 쓰는 파일은 전부 여기 있어야 한다 — 빠진 파일은 활동 실행이 장학금 것을 덮어쓴다(관문이 로봇 본편에서 쓰는 파일을 뽑아 견준다).
   설정 파일(card-read-config.json · final-review-config.json)은 같이 쓴다 — 그 안의 `activities` 칸이 활동 스위치와 상한이다 */
export const ACT_FILES = {
  '../data/registered.json': '../data/activities.json',
  '../data/card-read.json': '../data/act-read.json',
  'card-read-ledger.json': 'act-read-ledger.json',
  'card-read-review.json': 'act-read-review.json',
  'attach-role-ai.json': 'act-role-ai.json',
  'final-review.json': 'act-final-review.json',
  'final-review-ledger.json': 'act-final-review-ledger.json',
};

/* 활동 스위치 — 설정 파일의 `enabled` 와 `activities.enabled` 가 **둘 다** true 일 때만(설계 5-8). 위쪽을 끄면 장학금과 활동이 함께 멈춘다.
   수집 로봇의 숨김 표시 달기와 유료 로봇이 이 함수 하나를 쓴다(갈라지면 숨겨 놓고 아무도 안 읽는다). 유료 호출은 여기에 워크플로의 환경 변수까지 맞아야 나간다 */
export const actGateOn = (cfg) => !!cfg && cfg.enabled === true && !!cfg.activities && cfg.activities.enabled === true;

/* ── 숨김 표시 (수집 로봇 collect.mjs 가 쓴다 · 설계 5-1) ──
   표시는 활동 글의 칸 `paidGate: "YYYY-MM-DD"`(주운 날 · 한국 날짜)다. 🔴 **처음 본 게시판 글에만** 단다 — 이미 실린 글·장부에 있던 글에는 달지 않는다(한 번 보인 글을 숨기지 않는다).
   공공 API 글은 이번 범위 밖이라 달지 않는다. 스위치가 꺼져 있으면 달지 않는다(새 글은 지금처럼 바로 보인다) */
export function stampNewActivity(it, cfg, today) {
  if (it && !it.api && actGateOn(cfg) && /^\d{4}-\d{2}-\d{2}$/.test(String(today || ''))) it.paidGate = today;
  return it;
}
/* id 를 받지 못한 글(주소 지문이 다른 글과 겹쳐 수집 로봇이 id 를 비운 글)은 표시를 뗀다 — AI 카드와 id 로 만나므로 관문에 태울 수 없다. 그 글은 지금처럼 바로 보인다. 뗀 수를 돌려준다 */
export function dropStampWithoutId(items) {
  let n = 0;
  for (const it of items || []) if (it && it.paidGate && !it.id) { delete it.paidGate; n += 1; }
  return n;
}
/* 활동 글 중복 정리 + 표시 지키기 — dedupe = url-key dedupeNotices(같은 글은 하나로 · 남길 쪽은 그 함수가 고른다).
   🔴 처음 본 글(표시 있음)이 **이미 실려 있던 글**(표시 없음 = 학생에게 보이던 글)과 같은 글이면, 어느 쪽이 남든 표시를 뗀다 — 안 떼면 보이던 글이 새 주소의 숨김 글로 바뀌어 사라진다.
   둘 다 새 글이면 표시가 남는다. 중복 정리의 결과(무엇을 합치고 어느 쪽을 남기는가)는 바꾸지 않는다 — 합쳐진 짝을 보기만 한다 */
/* 🔴 isShown = 그 글이 학생에게 보이던가(수집 로봇은 앱과 같은 판정을 넘긴다 — paidOpen 이거나 paidGateOpen). 표시는 한 번 달면 지워지지 않아
   (카드가 실려도 · 사흘이 지나도 · 관리자가 올려도) 「표시 없음」만으로는 보이던 글을 못 가린다(최종 리뷰 C1 · 2026-11-26). 넘기지 않으면 예전처럼 표시 없음 = 보이던 글.
   셋이 이어 합쳐져도(A~B~C) 짝을 따라 전해진다 · 남은 글이 보이던 글이면 그 표시는 그대로 둔다(카드·검토가 이어진다) */
export function dedupeActivities(items, dedupe, isShown = (n) => !!n && !n.paidGate) {
  const shown = new Set();
  const out = dedupe(items, { distinct: (a, b) => { if (isShown(a) || isShown(b) || shown.has(a) || shown.has(b)) { shown.add(a); shown.add(b); } return false; } });
  for (const n of out) if (n && n.paidGate && shown.has(n) && !isShown(n)) delete n.paidGate;
  return out;
}

/* ── 지시문 (활동용 · 응답 꼴은 장학금과 같다 — card-read SCHEMA) ── */
const ACT_LINE_RULES = `줄마다 두 가지를 냅니다 — text 와 quote.
- text: 학생에게 보일 문장. 자연스럽고 깔끔한 한국어로 다시 써도 됩니다(끊긴 문장 잇기 · 번호·기호 떼기 · 어색한 말 다듬기 · 「~인 자」를 「~인 학생」으로 등). 한 줄에 하나만.
- quote: 그 text 의 근거가 되는 원문 부분을 **한 글자도 바꾸지 않고 그대로** 복사합니다(띄어쓰기·기호 포함 · 이어진 한 덩어리 · text 의 사실이 다 들어 있을 만큼만 짧게).

가장 중요한 규칙 — 문장은 다듬어도 사실은 바꾸지 않습니다.
- 숫자(금액·인원·나이·학년·날짜·시간·분량·규격)는 원문에 적힌 그대로 씁니다. 단위를 바꾸거나(100만 원 → 1,000,000원) 계산하지 않습니다.
- 부정·비교 말(않·못·아니·없·제외·불가·이상·이하·미만·초과·이내)은 원문에 있는 것을 빼지도, 없는 것을 더하지도 않습니다.
- 기관·단체·학교·대회 이름은 원문에 적힌 이름 그대로 씁니다. 줄이지 않습니다.
- 원문에 없는 사실은 쓰지 않습니다. 원문에 없는 칸은 비워 둡니다. 추측하지 않습니다. 모르면 비우는 것이 정답입니다.
- 접수 기간을 늘린다는 「연장」 공고인데 늘어난 마감일이 원문에 없으면 deadline 은 비웁니다(옛 마감을 쓰지 않습니다).`;
const ACT_FIELDS = `칸의 뜻 — 섞지 마세요.
- eligibility: 누가 참가(지원)할 수 있는가. 한 줄에 요건 하나. **사람의 조건만** 적습니다(나이·소속·학교·학년·재학 여부·전공·거주지·국적 등). 모든 줄은 「~인 자」「~한 학생」처럼 사람으로 끝나거나 명사로 끝납니다. 「~하고,」「~이며,」「~으로,」로 끝나는 줄은 틀린 줄입니다.
  자격이 아닌 것: 「참가자격」 같은 제목, 팀 구성(「2~4인 팀」「개인 또는 팀」)과 작품의 주제·분량·형식(→ notes), 모집 인원(「30명 내외」 → notes), 상금·혜택(→ amount), 심사 기준, 제출 서류.
- excludes: 참가할 수 없는 사람. **누가 못 하는지만** 적습니다 — 칸 이름이 이미 '참가할 수 없는 경우'이므로 「…는 참가 불가」「… 제외」 같은 뒷말은 뗍니다.
  「휴학생은 지원할 수 없습니다.」 → 「휴학생」 · 「기수상자 제외」 → 「기수상자」. 사람이 아니라 작품에 걸린 제한(「타 공모전 수상작은 출품 불가」)은 excludes 가 아니라 notes 의 유의사항입니다.
- priority: 우대·가산점 기준. 자격이 아닙니다.
- amount: 참가해서 받는 것 — 상금·시상 내역·활동비·장학금·수료증·봉사시간·채용 우대 같은 혜택. 한 줄에 하나(「대상 1팀 300만원」「수료증 발급」). 참가비처럼 학생이 내는 돈은 amount 가 아니라 notes 의 유의사항입니다.
- deadline: 신청(접수·출품) 마감일. 「11. 18부터 12. 7까지」면 마감은 12. 7 입니다(시작일이 아닙니다). 게시일·발표일·활동 기간·행사일은 마감이 아닙니다. date 는 YYYY-MM-DD, quote 는 그 날짜가 적힌 원문 문구.
- apply: 어디에 어떻게 내는가(접수 방법·접수처 — 온라인 접수 주소·전자우편·방문·우편). 문의 전화번호는 넣지 않습니다.
- documents: 제출 서류·제출물의 **이름**. 하나에 한 줄(「참가신청서」「작품 파일」). 「제출서류」 같은 제목 줄, 「…을 읽어보시고 참고하시길 바랍니다」 같은 안내 문장은 서류가 아닙니다(원문이 이름을 적지 않았으면 비웁니다).
- notes: 그 밖에 학생이 신청 전에 알아야 할 것. **한 줄에 사실 하나.** text 의 줄머리에 이름표를 붙여 「이름표: 내용」 꼴로 씁니다(「일정: 접수 11.18.(수) – 12.7.(월)」). quote 에는 이름표를 붙이지 않습니다(원문 그대로).
  이름표는 다음 열 가지에서만 고릅니다 — 주제 · 규격 · 참가 형태 · 일정 · 장소 · 선발 규모 · 활동 내용 · 후속 지원 · 유의사항 · 문의.
  주제(공모 주제·과제) · 규격(작품의 분량·형식·파일 꼴) · 참가 형태(개인·팀 구성) · 일정(접수·심사·발표·활동 기간·행사일) · 장소 · 선발 규모(모집 인원·시상 팀 수) · 활동 내용(뽑히면 하는 일) · 후속 지원(수상·수료 뒤에 이어지는 지원) · 유의사항(저작권·중복 출품·참가비·수상 취소 조건) · 문의(문의처 이름·전화·전자우편).
  「자세한 사항은 공고문 참조」 같은 줄은 넣지 않습니다.
- title: 글 제목에서 게시판 말머리([공모전]·[대외활동]·[학생지원팀] 등)와 꼬리 날짜((~12/7) 등)를 뗀 것. 그 밖의 글자는 그대로.
- host: 이 활동·공모전을 여는 곳(주최·주관 기관). 원문에 적힌 이름 그대로 — 공고문(첨부)에 적힌 정식 이름을 먼저 쓰고, 없으면 제목에 적힌 꼴을 씁니다. 글을 옮겨 실은 게시판의 대학은 여는 곳이 아닙니다(그 대학이 직접 여는 것이 아니라면).

그 밖에.
- 사이트 메뉴, 바닥글, 이전글·다음글 제목, 조회수, 첨부파일 이름 목록은 공고 내용이 아닙니다.
- 부문·분야가 여럿이고 부문마다 자격·혜택·규격이 다르면 multi 를 true 로 하고, **모든 부문에 공통인 것만** 채웁니다(부문마다 다른 것은 비웁니다).
- 본문과 첨부 어디에도 공고 내용이 없으면(메뉴뿐·오류 화면) unreadable 을 true 로 하고 나머지는 비웁니다.`;
/* 첨부 구분 — 갈래 넷과 그 뜻은 장학금과 같다(변환 로봇이 같은 눈으로 읽는다 · attachment-text attachDecision). 보기만 활동 글의 말로 적는다 */
const ACT_ATTACH_RULES = `첨부 구분(attachments) — 꼬리표([A1]·[A2]…)가 붙은 첨부마다 한 줄씩, 빠짐없이 냅니다.
- tag: 그 첨부의 꼬리표(A1 처럼 대괄호 없이)
- role: 넷 중 하나
   content — 읽는 글(공고문·모집 요강·안내문·포스터·FAQ). 그 내용은 카드에 들어갑니다.
   form — 학생이 직접 채워서 내는 서식만 든 파일(참가신청서·지원서·자기소개서·활동계획서·서약서·개인정보 동의서).
          교수·기관이 써 주는 서식(추천서·확인서)만 든 파일은 form 이 아니라 content 입니다(학생이 채우는 것이 아닙니다).
   mixed — 한 파일 안에 읽는 글(공고문·요강)과 학생이 채워 내는 서식이 **둘 다** 있다.
   other — 이 글의 문서가 아니거나(다른 행사·지난 회차·결과 발표) 읽을 내용이 없다(깨진 글자·빈 문서).
- formStart: role 이 mixed 일 때만 — 서식이 시작되는 줄(「[별지 제1호 서식]」「참가신청서」 같은 서식의 첫 줄)을 원문 그대로 한 줄. 서식이 여럿이면 맨 처음 서식의 첫 줄. 그 밖에는 빈 글자.
- why: 그렇게 본 까닭을 한 문장으로.
서식(form · mixed 의 서식 부분)에 든 빈칸 이름표·서약 문구·개인정보 동의 문구·작성 예시는 자격·서류·유의사항이 아닙니다 — 카드에 옮기지 않습니다.
content 첨부와 mixed 의 읽는 글 부분에 든 자격·참가 제한·혜택·마감·접수 방법·제출물·일정·유의사항은 카드에 빠짐없이 들어가야 합니다.`;
/* 카드 칸·첨부 구분의 규칙 한 벌 — 4번(카드 쓰기)과 6번(최종 검토)이 활동 글에 같은 말을 쓴다(두 AI 가 다른 규칙으로 쓰고 고치면 서로 되돌린다) */
export const ACT_CARD_RULES = `${ACT_LINE_RULES}

${ACT_FIELDS}

${ACT_ATTACH_RULES}`;
export const ACT_SYSTEM = `대학생이 참가할 수 있는 대외활동·공모전 모집 글의 원문을 사람처럼 끝까지 읽고, 공고 카드의 칸을 채웁니다. 결과는 학생에게 그대로 보입니다. 학생지원팀 직원이 모집 글을 읽고 학생에게 깔끔하게 정리해 준 것처럼 써 주세요.

원문은 「게시판 본문」과 「첨부」(글에 붙은 파일·본문 그림·요강 페이지에서 뽑은 글자) 여러 덩어리로 옵니다. 첨부 덩어리마다 머리에 꼬리표([A1]·[A2]…)와 파일 이름이 있습니다. 게시판 본문에는 사이트 메뉴·바닥글·이전글 제목이 섞여 있고, 진짜 내용이 첨부(요강·포스터)에만 있는 경우가 많습니다. 「기계가 읽은 글자」라고 적힌 덩어리는 그림에서 읽어 낸 것이라 군데군데 깨져 있을 수 있습니다 — 깨진 글자를 짐작으로 메우지 말고 읽히는 것만 씁니다. 전부 끝까지 읽으세요.

${ACT_CARD_RULES}`;

/* 6번 최종 검토의 지시문(활동용) — 할 일 넷과 사본 판정의 뜻은 장학금 검토(final-review SYSTEM)와 같고, 카드 규칙만 위 활동 것을 쓴다.
   🔴 고치면 열려 있는 활동 글을 전부 돈 내고 다시 본다(검토 해시가 이 글자를 함께 센다 · 관문이 해시를 고정해 둔다) */
export const ACT_REVIEW_SYSTEM = `대학생 대외활동·공모전 모집 글의 최종 검토자입니다. 앞 단계의 AI 가 모집 글의 원문을 읽고 학생 앱의 공고 카드를 썼고, 첨부를 내용 문서와 신청 양식으로 갈랐습니다. 그 결과가 맞는지 원문과 하나하나 대조해 **고친 완성본**을 냅니다. 내신 완성본이 그대로 학생 화면에 실립니다.

받는 것 넷 — ① 원문(게시판 본문 + 첨부에서 뽑은 글자 · 첨부마다 꼬리표 [A1]·[A2]… · 「기계가 읽은 글자」라고 적힌 덩어리는 그림에서 읽어 낸 것이라 군데군데 깨져 있을 수 있습니다) ② 지금 학생 화면의 카드(JSON) ③ 앞 단계가 한 첨부 구분 ④ 앱이 학생에게 보여 주는 PDF 사본(꼬리표 [P1]·[P2]… · 첨부 원본을 PDF 로 바꾼 것 — 파일로 함께 옵니다).

할 일.
1. 카드 고치기 — 카드의 모든 칸을 원문과 대조해 **완성본을 통째로** 다시 냅니다. 고칠 것이 없는 줄도 그대로 다시 내야 합니다(내지 않은 줄은 카드에서 지워집니다).
   - 틀린 내용 — 원문과 다른 숫자·날짜·조건, 원문에 없는 내용, 엉뚱한 칸에 들어간 줄(자격 칸에 든 팀 구성·작품 규격·상금 등) — 은 고치거나 제 칸으로 옮기거나 뺍니다.
   - 빠진 내용 — 원문(본문·내용 문서)에 있는데 카드에 없는 자격·참가 제한·혜택·마감·접수 방법·제출물·일정·유의사항 — 은 채웁니다.
   - 맞는 줄은 말투만 바꾸려고 고치지 않습니다.
2. 첨부 구분 다시 보기 — 앞 단계의 구분이 맞는지 원문 글자로 확인하고, 첨부마다 다시 냅니다(틀렸으면 고쳐서 · 맞으면 그대로).
3. PDF 사본 보기(pdfs) — 파일로 온 사본마다 한 줄씩.
   - tag: 그 사본의 꼬리표(P1 처럼 대괄호 없이)
   - verdict: 넷 중 하나
      ok — 원본 첨부의 내용이 그대로 들어 있고 읽을 수 있다(글꼴·줄 간격이 조금 달라도 ok).
      broken — 변환이 잘못됐다: 글자가 깨졌거나(□·물음표·겹친 글자), 원본에 있는 내용이 빠졌거나, 표가 무너져 칸을 알아볼 수 없거나, 쪽이 잘렸다.
      wrong — 이 글의 문서가 아니다. 「공고문에서 뗀 서식 쪽」 사본인데 학생이 채워 내는 서식이 아닌 쪽(읽는 글)이 들었거나 서식 쪽이 빠진 것도 wrong.
      empty — 읽을 내용이 없다(빈 쪽뿐·그림 하나뿐).
   - why: 그렇게 본 까닭을 한 문장으로(어느 쪽의 무엇이 문제인지).
   원본이 어느 첨부인지 적혀 있지 않은 사본은, 원문에서 내용이 같은 첨부를 찾아 그것과 대조합니다(없으면 사본 자체만 보고 판정). 파일로 오지 않은 사본은 내지 않습니다.
4. summary — 무엇을 고쳤는지 한두 문장으로(고친 것이 없으면 「고친 것 없음」).

카드와 첨부 구분의 규칙은 앞 단계와 같습니다.

${ACT_CARD_RULES}`;

/* ── 활동 글 한 건 → 로봇이 읽는 모양 (저장하지 않는다 — 유료 로봇은 목록 파일을 쓰지 않는다) ──
   제목을 name 자리에 · 「게시한 곳」은 학교, 없으면 주최(둘 다 없으면 빈 글자 — 로봇이 「(여러 곳)」으로 적는다).
   관리자가 숨긴 글(hidden)·올린 글(paidOpen)은 표시(paidGate)를 떼어 넘긴다 — 로봇의 대상·사람 몫·경보가 전부 표시를 보고 고르므로 그 글들은 저절로 빠진다
   (올린 글은 표시를 지우지 않고 paidOpen 을 적는다 — 병합 도구가 지운 칸을 되살리기 때문 · 설계 5-7) */
export function actView(n) {
  const v = { ...n, name: n.title, eligibility: { schoolOnly: n.school || n.host || '' } };
  if (n.hidden || n.paidOpen) delete v.paidGate;
  return v;
}
/* 목록째 — id 없는 글은 뺀다(결과 파일과 id 로 만난다 · 수집 로봇이 주소 지문이 겹친 글의 id 를 비운다) */
export const actItems = (list) => (Array.isArray(list) ? list : []).filter((n) => n && n.id).map(actView);

/* ── 원문 = 글자 기록(collector/act-text — 본문 + 첨부·본문 그림·요강 페이지의 글자) + 신청서 받기가 받아 둔 그 글의 원본(extracted · forms-index 의 그 id 줄) ──
   첨부 덩어리의 열쇠(file)는 **바이트 지문으로 만든 고정 이름** `text-<지문>` — 글자 기록에는 원본 파일이 없다.
   🔴 같은 바이트가 나중에 신청서 받기로 extracted 에 들어와도 먼저 저장된 덩어리를 그대로 쓴다(지문이 같은 줄은 건너뛴다) — 열쇠나 글자가 바뀌면 같은 글을 돈 내고 다시 읽는다.
   🔴 덩어리의 차례는 실행마다 같다 — 글자 기록에 저장된 차례(무료 받기 것이 먼저) → forms-index 의 줄 차례.
   변환 로봇은 이름이 달라도 바이트가 같은 답을 찾으므로(attach-role-ai aiRoleFor·aiRoleByName) 이 열쇠로도 AI 의 구분을 받는다 */
export function makeActSources({ storeDir, formRows = [], extractedDir }) {
  const textOf = (file) => { try { return attachmentText(`${extractedDir}/${file}`) || ''; } catch { return ''; } };
  return (it) => {
    const rec = readStore(storeDir, it.id) || { body: '', docs: [] };
    const out = []; const seen = new Set(); let n = 0;
    if (String(rec.body || '').trim()) out.push({ label: '게시판 본문', text: rec.body });
    const add = (file, attach, hash, shown, text) => {
      n += 1; if (hash) seen.add(hash);
      out.push({ tag: `A${n}`, file, attach: attach || null, hash, label: `첨부 [A${n}] ${shown}`, text });
    };
    for (const d of rec.docs || []) {
      if (seen.has(d.hash)) continue;
      const what = { img: '본문 그림', guide: '요강 페이지' }[d.from] || '이름 모름';
      add(`text-${d.hash}`, d.name, d.hash, d.name ? `${d.name}${d.ocr ? ' (기계가 읽은 글자)' : ''}` : `(${what}${d.ocr ? ' — 기계가 읽은 글자' : ''})`, d.text);
    }
    for (const r of formRows || []) {
      if (!r || !r.id || r.id !== it.id) continue;   // 그 글의 줄만 — 활동 글의 줄에는 늘 id 가 적힌다(옛 줄의 제목 맞추기는 쓰지 않는다)
      const hash = fileHash16(`${extractedDir}/${r.file}`);
      if (hash && seen.has(hash)) continue;
      const t = textOf(r.file);
      if (t.replace(/[^가-힣]/g, '').length >= 40) add(r.file, r.attach, hash, r.attach, t);   // 서식은 글자가 적다 — 한글 40자면 가를 수 있다(장학금과 같은 선)
    }
    /* 본문 대기 — 무료 받기의 본문이 비었고 진짜 브라우저가 아직 그 글을 안 열었다(act-text textDue browser · 최종 리뷰 2026-11-26) → actAwaits 가 본문도 기다린다.
       원문 덩어리가 아니라 목록에 붙은 표식이다(원문 글자·지문에 안 든다) */
    out.bodyPending = !!it.id && textDue(storeDir, it.id, 'browser', '');
    return out;
  };
}

/* ── 첨부 기다리기 — 글에 한글·워드·PDF 첨부가 있는데 그 가운데 글자가 아직 안 온 것이 **하나라도** 있으면 표시 뒤 이틀까지 기다린다 ──
   장학금(card-read awaitsAttach)은 「첨부 글자가 하나도 없을 때」만 기다린다. 활동 글은 공고문이 주운 그 자리에서 오고 신청서는 새벽에 오므로 「하나라도」로 본다 —
   먼저 읽으면 새벽에 신청서가 와 원문이 바뀌고, 같은 글을 돈 내고 다시 읽는다. 이틀이 지나면 있는 것으로 읽는다(그림·zip 은 기다리지 않는다 — 글자가 안 올 수 있다).
   ponytail: 이름으로 맞춘다 — 이름 없이 저장된 첨부 글자는 「아직 안 옴」으로 세어 이틀을 다 기다린다(늦을 뿐 돈은 안 샌다). 그런 글이 보이면 지문으로 맞추는 쪽으로 */
const DOC_NAME = /\.(?:hwpx?|docx?|pdf)$/i;
const nameKey = (s) => { const v = String(s || '').replace(/\s+/g, ' ').trim(); return fileNameIn(v) || v; };   // 사이트가 붙인 꼬리(「신청서.hwp (71KB)」)는 떼고 견준다
export function actAwaits(it, parts, today, days = 2) {
  if (!(days > 0) || !it || !it.paidGate || daysSince(it.paidGate, today) >= days) return false;
  if (parts && parts.bodyPending) return true;   // 본문도 기다린다 — 몇 시간 뒤 브라우저 본문이 와 원문이 바뀌면 같은 글을 다시 산다(첨부 기다리기와 같은 이중 결제 · 최종 리뷰 2026-11-26)
  const have = new Set((parts || []).filter((x) => x && x.tag && x.attach).map((x) => nameKey(x.attach)));
  return (it.attachments || []).some((a) => a && !a.bodyImage && DOC_NAME.test(nameKey(a.name)) && !have.has(nameKey(a.name)));
}

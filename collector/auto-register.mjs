/* ============================================================
   한대장 — 정식 등록 자동화 (선조치후보고)
   수집 로봇이 발행한 실시간 공고 중, 보수적 규칙을 전부 통과한
   '개별 실공고'만 data/registered.json에 자동 등록한다.

   운영 원칙(2026-07-15 개발자 지시로 도입):
   - 자동 등록분은 auto: true 로 표시되고 앱에 '자동 등록 · 검수 전' 배지가 붙는다
     → 사용자에게 큐레이션 검수 전임을 정직하게 알린다.
   - 모든 자동 등록·제외 판단은 리포트(report.md)에 기록된다 (선조치후보고).
   - 끄기: collector/auto-register-config.json 의 "enabled": false
   - 잘못 등록된 건 되돌리기: 같은 파일 "blockIds" 배열에 id를 넣으면 다음 실행 때 제거된다.

   실행: node collector/auto-register.mjs   (collect.mjs 직후, 워크플로에서 자동 실행)
   ============================================================ */
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { cleanTitle } from './clean-title.mjs';
// 등록 규칙은 감사 도구와 같은 파일을 쓴다 (verify/entry-rules.cjs) — 규칙이 갈라지지 않게
const { checkEntry, isDuplicatePair, sameProgram, registeredAfterDeadline, lastDateIn } = createRequire(import.meta.url)('../verify/entry-rules.cjs');
/* 교내·교외 증거 판정 + 학교 이름표 + 합치기 — 규칙은 각자 한 곳 (2026-09-30 · 베끼지 않는다) */
import { classifyKind, schoolDomain } from './kind-evidence.mjs';
import { loadSchoolNames, schoolTokens } from './school-names.mjs';
import { mergeInto, openOn, promotableOn, deadlineQuote } from './registered-merge.mjs';
/* 게시판 글의 마감(본문 마감 → 제목·게시판 요약)은 notice-deadline.mjs 한 곳 — 이 파일은 불러오는 순간 실행되어 관문이 표본으로 못 잰다(2026-10-05) */
import { parseDeadline as parseNoticeDeadline, makeBodyReader, corporaFrom } from './notice-deadline.mjs';
/* 데이터 관문에 거듭 걸린 공고는 3일 쉰다 — 장부 규칙은 auto-held.mjs 한 곳(되돌리는 gate-guard 와 같은 파일 · 2026-10-04) */
import { isHeld, pruneRegistered } from './auto-held.mjs';
/* 등록 뒤 마감 경과로 뺀 등록분의 사업(지난 회차) 장부 — 규칙은 past-rounds.mjs 한 곳(2026-10-05 리뷰 · 빼고 나면 같은 사업의 다른 학교 글을 막던 짝이 사라졌다) */
import { recordPastRounds, prunePastRounds, pastRoundOf } from './past-rounds.mjs';

const HERE = new URL('.', import.meta.url);
const cfgPath = new URL('auto-register-config.json', HERE);
let cfg = { enabled: true, maxPerRun: 8, blockIds: [] };
try { cfg = { ...cfg, ...JSON.parse(fs.readFileSync(cfgPath, 'utf8')) }; } catch { /* 기본값 */ }

const noticesPath = new URL('../data/notices.json', HERE);
const registeredPath = new URL('../data/registered.json', HERE);
// 리포트 파일은 인자로 바꿀 수 있다 (브라우저형 수집기는 browser-report.md 사용)
const reportPath = process.argv[2] ? new URL(process.argv[2], new URL('..', HERE)) : new URL('report.md', HERE);
const notices = JSON.parse(fs.readFileSync(noticesPath, 'utf8'));
const registered = JSON.parse(fs.readFileSync(registeredPath, 'utf8'));
let forms = { templates: {} };
try { forms = JSON.parse(fs.readFileSync(new URL('../data/forms.json', HERE), 'utf8')); } catch { /* 없어도 진행 */ }

/* 🔴 '교내인가 교외인가'는 **`match-engine.js` 한 곳**에서 정한다 (2026-09-18에 옮겼다).
   앱 화면(실시간 공고 카드)도 같은 말을 해야 해서다 — 베껴 두면 같은 공고가 목록에서는
   '교외', 실시간 구역에서는 '교내'로 뜬다(옮기기 전 실제 모습이 그랬다). */
const { noticeKind } = createRequire(import.meta.url)('../match-engine.js');
const ME = createRequire(import.meta.url)('../match-engine.js');
const NOTICE_CAMPUS_MARK = ME.NOTICE_CAMPUS_MARK;
const OWN_PROGRAMS = ME.OWN_PROGRAMS || {};
/* 로봇이 원문 증거로 배운 학교 제도 표 (collector/kind-classify.mjs 가 채운다) — 고정 표(OWN_PROGRAMS)와 합쳐 본다.
   파일·이름표가 없어도 죽지 않는다(관문이 사본 저장소에서 이 로봇을 돌린다). 학교 도메인은 공고 주소에서 읽는다(수집 설정은 건드리지 않는다). */
let learnedPrograms = {};
try { learnedPrograms = JSON.parse(fs.readFileSync(new URL('own-programs.json', import.meta.url), 'utf8')).programs || {}; } catch { /* 아직 없음 */ }
let SCHOOL_NAMES = { unis: new Set(), alias: new Map() };
try { SCHOOL_NAMES = loadSchoolNames(new URL('../data.js', import.meta.url)); } catch { /* data.js 없는 사본 */ }
const ownNames = (school) => [...(OWN_PROGRAMS[school] || []), ...((learnedPrograms[school] || []).map((p) => p.name || p))];
/* 주관 기관을 못 읽었을 때 쓰는 말. 같은 항목의 `금액 원문 확인` 과 같은 말투다. */
const PROVIDER_UNKNOWN = '주관 기관 원문 확인';
const TODAY = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10); // KST

/* ---------- URL 정규화 ----------
   규칙 본체는 `collector/canon-url.mjs`에 있다(순수 함수). 관리자 화면의 쓰기 경로도
   같은 함수를 써야 '이미 등록된 공고를 로봇이 다시 등록하는' 일이 안 생긴다.
   이 파일은 불러오는 즉시 실행되므로 남이 여기서 가져갈 수 없어 따로 뺐다. */
export { canonUrl } from './canon-url.mjs';
import { canonUrl, idFromUrl, registerId } from './canon-url.mjs';
/* 🔴 원문 주소는 **HTML 기호를 되돌려** 담는다 (2026-10-03 · 원문 링크 정직성) — 게시판이 `&#038;` 로 내보낸 주소를
   그대로 담으면 브라우저가 `#038;…` 을 조각으로 읽어 글 번호가 사라진다(서울대 학생처 3건 실측: 공고 대신 메뉴 화면).
   되돌리는 규칙은 앱과 같은 파일(source-link.js) 하나다. '이미 등록됐나'를 묻는 열쇠도 되돌린 주소로 만든다 —
   안 그러면 옛 등록분(기호 박힌 주소)과 새 공고(되돌린 주소)가 다른 글로 보여 같은 공고가 두 번 등록된다.
   (기호 박힌 서울대 주소 셋은 canonUrl 로 전부 `…/?mod=document` 하나가 되어 서로를 '이미 등록'으로 가리고 있었다.) */
const { decodeUrlEntities } = createRequire(import.meta.url)('../source-link.js');

/* 제목 청소는 공용 모듈에 있다 (수집기와 같은 규칙을 써야 중복 판정이 어긋나지 않는다) */
export { cleanTitle } from './clean-title.mjs';

/* ---------- 제목 정규화: 학교별 재게시·꼬리표 차이를 흡수 ---------- */
const stripPunct = (t) => t.replace(/[\s·ㆍ()~〜.,'"“”‘’!⭐★]/g, '').replace(/공지/g, '').toLowerCase();
const normTitle = (t) => stripPunct(cleanTitle(t).replace(/\[[^\]]*\]/g, ''));

/* ---------- 재단명 추출: 같은 재단 사업의 학교별 재게시를 식별 ---------- */
const GENERIC_FOUNDATION = /^(한국|국가|대학|교내|교외|학교|서울|재단)$/;
export function foundationKey(t) {
  const m = cleanTitle(t).match(/([가-힣A-Za-z]{2,10})\s*(장학재단|장학회|장학관|청암재단|문화재단)/);
  if (!m || GENERIC_FOUNDATION.test(m[1])) return null;
  return m[1];
}

/* ---------- 판정 규칙 (verify/list-unregistered.js와 동일 계열 + 자동화용 강화) ---------- */
const NON_NOTICE = /^(장학금 종류|장학금 신청|장학\/?학자금|장학 및 학자금|학자금 대출|장학금·학자금|국가장학금 및 학자금대출|국제화장학금|교외장학재단|근로장학공고게시판|네오르네상스장학|장학금안내|장학\(공지\)|학생지원팀|학생지원센터|장학 및 학자금 대출|학자금 중복지원)/;
const LOAN = /학자금\s?대출|학자금융자|무이자|이자지원|대출 신청|대출 안내|대출 관련/;
const EVENT = /교육\s*\*|참가팀 모집|참가자 선발|운영계획서|포스터$|Q&amp;A|Q&A|설명회|박람회|공모전|연수|탐방|캠프|\bCamp\b|서포터즈/i;
/* 파일 이름이 그대로 제목으로 잡힌 것 — 확장자 전부 차단.
   예전에는 pdf·hwp·zip만 걸러 '코나아이_소상공인_장학생_모집_포스터.png'가 장학금으로
   등록됐다(원문 보기를 누르면 이미지가 내려받아짐). 2026-07-30 교정 */
const MENU_TAIL = /\[등록\/장학\]\s*$|^\d+\.\s|^\(붙임|^\(신청서식|^\(공고문|\.[a-z]{2,5}$/i;
/* 첨부 내려받기 주소는 공고가 아니다 — 원문 보기를 누르면 파일이 내려받아진다 */
const DOWNLOAD_URL = /mode=download|attachNo=|fileDown|\/download\b|\.(png|jpe?g|gif|hwpx?|pdf|docx?|zip|xlsx?)(\?|$)/i;
const EMPLOYMENT = /채용|조교(?!.*장학금)|근무자 모집|직원 모집/;
const NOT_UNDERGRAD = /대학원생?\s|석사|박사|수련의|졸업(생|자)\s*대상|T\/AS|강의보조/;
/* 🔴 **뽑고 난 뒤의 공지**는 신청 공고가 아니다 (2026-09-19 · 장학 신호를 넓히면서 드러났다).
   `선발 결과 확인`·`선발 및 결과발표`·`이중선발자 최종 수혜 장학 선택`·`교내장학 선발 포기 신청`·
   `희망근로지 신청`(이미 뽑힌 학생이 근무지를 고르는 것) 같은 글은 **`신청`·`선발` 이 들어 있어서
   ACTION 관문을 그냥 통과한다** — 실측(collector/candidates.json 2,058건)으로 이 줄이 없으면
   그런 행정 공지 열둘이 학생 화면에 장학금 카드로 나갔다.
   ⚠️ `선발 알림` 은 넣지 않았다 — `선발 안내`(진짜 모집 공고)와 글자가 너무 가깝다.
   `선발자 공지` 는 2026-10-05 에 더했다(links-new-1 — id 가 겹쳐 가려져 있던 계명대 `국가근로장학생 최종선발자 공지` 가 풀리며 드러났다). */
const ADMIN_NOTICE = /(^|\s)AWARDS?\b|award-news|졸업생[^\n]{0,20}(선발|수상|선정)|수상\s*소식|선정되었|선발되었|출근부|지급\s*안내|지급일|계좌\s*등록|서류\s*보완|유의사항\s*안내|중복지원|반환|환수|추천서\s*(총장|직인)|안내\s*및\s*FAQ|결과\s*(발표|안내|확인)|결과발표|선발\s*결과|확인\s*방법|포기\s*(신청|서)|희망\s*근로지|이중\s*선발|선발자\s*(공고|안내|명단|공지)|필수사항|(^|\s|└)RE:/;
const FUTURE_PLAN = /202[7-9](?![\d])[^\d]*(학년도|년).*(유학|연수|입학|신입학)|신입학|입학전형/;
/* 🔴 `장학생|장학금` 두 낱말만 보면 **학교 교내 장학금 이름을 통째로 놓친다** (2026-09-19 개발자 지적
   — "우리 학교 게시판 교내 공고가 장학금 탭에 안 올라온다"). 교내 장학은 이름이 `장학` 으로 끝난다:
   실측으로 `반영장학`·`우정장학(학업장려금)`·`우정장학(가계곤란)`·`경희꿈도전장학` 넷과 교외
   `선원가족장학사업` 이 "'장학' 신호 없음"으로 **조용히** 버려지고 있었다(경희대 교내 공고 전부).
   🔴 **넓히는 것만으로는 안전하지 않다 — 그렇게 적었다가 코드 리뷰에 잡혔다.** `ACTION 이 거른다`
   고 썼는데 재 보니 거짓이었다: 행정 공지야말로 `신청`·`선발` 을 달고 온다. 실측
   (`collector/candidates.json` 2,058건)으로 이 한 글자를 넓히면 등록 후보가 65건 늘고 그중 열둘이
   **뽑고 난 뒤의 공지**였다(선발 결과 확인 · 희망근로지 신청 · 선발 포기 신청 …).
   그래서 넓히기와 **한 세트로 ADMIN_NOTICE·EVENT 를 같이 조였다** — 둘을 떼어 놓지 말 것.
   ⚠️ 이자지원 공고(`통영시 대학생 학자금 이자 지원`)에는 `장학` 이 아예 없어 여전히 걸러진다. */
const POSITIVE = /장학/;
const ACTION = /(선발|모집|신청|추천|접수)/;

/* 마감 후보 추출 — 규칙은 collector/notice-deadline.mjs parseDeadline 한 곳(2026-10-05 옮김 · 본문 마감을 먼저 본다).
   돌려주는 것은 `{ date, text, from }` — text 는 **실제로 맞춘 문구**다(2026-09-17 · 노션 G-3). 등록할 때 `deadlineFrom: '<from> · <문구>'`
   로 남겨 감사(verify/deadline-audit.mjs)가 그 문구를 근거로 센다. 달력에 없는 날은 마감이 아니다(okDate · 2026-09-19). */
const parseDeadline = (n) => parseNoticeDeadline(n, TODAY);

function classify(n, regUrlSet, regItems, batchSeen, pastRounds) {
  const t = n.title || '';
  const cu = canonUrl(decodeUrlEntities(n.url));
  const nt = normTitle(t);
  if (regUrlSet.has(cu)) return { verdict: 'skip', why: '이미 등록(원문 동일)' };
  if (batchSeen.has(cu) || batchSeen.has(n.school + '|' + nt)) return { verdict: 'skip', why: '이번 실행 내 중복' };
  if (t.length < 8) return { verdict: 'skip', why: '제목 파편' };
  if (DOWNLOAD_URL.test(n.url || '')) return { verdict: 'skip', why: '첨부 내려받기 주소(공고 원문 아님)' };
  if (/\[?마감\]/.test(t)) return { verdict: 'skip', why: '게시판에 마감 표시됨' };
  if (NON_NOTICE.test(t) || MENU_TAIL.test(t)) return { verdict: 'skip', why: '메뉴·안내 페이지' };
  if (LOAN.test(t)) return { verdict: 'skip', why: '학자금 대출·융자(장학금 아님)' };
  if (EVENT.test(t)) return { verdict: 'skip', why: '행사·연수·설명회(신청형 장학 아님)' };
  if (EMPLOYMENT.test(t)) return { verdict: 'skip', why: '채용·고용성' };
  if (NOT_UNDERGRAD.test(t)) return { verdict: 'skip', why: '학부생 대상 아님(대학원 등)' };
  if (ADMIN_NOTICE.test(t)) return { verdict: 'skip', why: '행정 안내(신청 공고 아님)' };
  if (FUTURE_PLAN.test(t)) return { verdict: 'skip', why: '차년도 계획·신입학(현 재학생 신청 대상 아님)' };
  if (/국가장학금/.test(t)) return { verdict: 'skip', why: '국가장학금 상시 제도 — 앱 내 카드로 이미 안내' };
  if (!POSITIVE.test(t)) return { verdict: 'skip', why: "'장학' 신호 없음" };
  // 2027년 이후 연도가 제목에 있으면 미래 사업일 가능성 — 자동 등록하지 않고 컨펌 대기
  const years = (t.match(/20\d{2}/g) || []).map(Number);
  if (years.some((y) => y >= 2027)) return { verdict: 'hold', why: '2027년 이후 사업으로 보임 — 개발자 컨펌 대기' };
  /* 같은 재단·같은 사업 감지: ① 이름 대조 ② 재단명 일치
     같은 학교(또는 전국 등록분)와 겹치면 = 재게시 중복(스킵), 다른 학교면 = 타교 접수분일 수 있음(컨펌 대기)

     🔴 **이름 대조는 감사와 같은 파일을 쓴다** (`verify/entry-rules.cjs` 의 `isDuplicatePair`).
     2026-09-19 이전에는 여기에 제 사본(4-gram 겹침 ≥ 0.55)이 있었는데, 공고 제목은 대부분이
     붙박이 말(`2026년도 2학기 … 장학생 선발 안내`)이고 등록명은 짧아서 **그 몇 조각이 전부
     붙박이**였다 — 짧은 등록명 하나가 아무 공고나 다 잡았다.
     실측(2026-09-19 · notices.json 52건): 옛 규칙의 '동일 사업' 판정 18건 중 16건을 새 규칙이
     뒤집는다. 그중 **여덟은 등록된 적도 없는 남의 사업**이었고(경주시장학회↔동산장학회 ·
     포항시장학회↔동산장학회 · 한원↔양천 · 여성동문회↔총동문회 · 금신사랑↔익산사랑 ·
     울산연구원↔익산사랑 · 정영오↔이백 · 정연주↔이백), 나머지는 **타교 접수분**이라 원래
     컨펌 대기로 갔어야 할 것들이다. 공용 판정은 겹침 ≥ 0.8 **에 더해** 공통 꼬리를 뗀
     나머지(distinctiveSim)까지 본다.
     ⚠️ 느슨하게 되돌리지 말 것 — 여기서 나는 오판은 **조용한 삭제**라 아무도 못 본다.
     ⚠️ 아직 못 가르는 것: `인천인재평생교육진흥원` ↔ `충북인재평생교육진흥원` 처럼 **앞 낱말만
        다른 지역 재단**은 여전히 같은 사업으로 읽힐 수 있다(공통 꼬리 떼기가 이 꼴을 못 잡는다). */
  const fk = foundationKey(t);
  const title = cleanTitle(t);
  const schoolOf = (i) => (i.eligibility || {}).schoolOnly || '';
  /* 🔴 등록명의 괄호는 **꼬리표만** 뗀다 — 이름의 일부는 남긴다.
     떼야 하는 이유: 등록 54건 중 38건이 `(한국외대 접수, 2026 후기)`·`(~10/11)`·`(2026 하반기)`
     같은 꼬리를 달고 있어, 안 떼면 꼬리가 이름으로 세어져 **진짜 재게시를 못 잡는다**
     (실측 적중 164 → 떼면 343). 같은 학교에 같은 카드가 두 장 생기는 2026-07-30 이중 등록이 이 자리다.
     🔴 그런데 **통째로 떼면 반대쪽으로 틀린다** — `우정장학(학업장려금)` 과 `우정장학(가계곤란)` 은
     경희대의 **서로 다른 장학금**인데 괄호를 떼면 한 장학금이 된다(실측으로 하나가 사라졌다).
     그래서 괄호 안에 **숫자나 `접수`가 있을 때만** 꼬리표로 본다 — 학기·연도·마감·접수처는 전부
     숫자나 그 낱말을 달고 오고, 이름의 일부(`학업장려금`·`가계곤란`·`Luke`)는 안 달고 온다.
     🔴 **양쪽에 똑같이 적용한다.** 옛 규칙은 등록명에만 썼는데, 그러면 공고 쪽 꼬리표가 그대로
        남아 `고졸후학습자(희망사다리2유형) 장학금 신청(~9/17)` 이 같은 학교 등록분과 안 맞는다. */
  const bare = (s) => (s || '').replace(/\([^)]*(\d|접수)[^)]*\)/g, '');
  /* 🔴 등록 뒤 마감 경과로 뺀 등록분과 **같은 사업**이면 새로 등록하지 않는다 (2026-10-05 리뷰 · 장부 past-rounds.mjs).
     빼기 전에는 그 등록분이 짝(twin)이 되어 같은 사업 글이 '승격 불가(마감 경과) 컨펌 대기'로 걸렸다 — 빼고 나니 같은 실행에서 다른 학교 글이
     마감 없이 등록되고 셋째 학교 글이 그것을 전국으로 승격해, 지난 회차가 44개교 전체에 '마감' 카드로 남았다(세종대 K-원전 실례).
     뺀 글 자신(같은 주소)은 마감 경과로 거른다. 다른 학교 글에 남의 마감을 적지 않는다 — 학교마다 접수 마감이 다를 수 있어 사람이 본다. */
  /* '같은 사업' 판정은 아래 짝(twin)·비슷한 등록분(similars)과 **같은 셋** — 사업 열쇠 · 이름 대조(꼬리표 뗀 이름) · 재단 이름 */
  const past = pastRoundOf(pastRounds, (i) => sameProgram({ name: title }, { name: i.name })
    || isDuplicatePair({ name: bare(title), eligibility: {} }, { name: bare(i.name), eligibility: {} })
    || !!(fk && (i.name || '').includes(fk)));
  if (past) {
    if (past.url && past.url === cu) return { verdict: 'skip', why: '마감 경과(등록 뒤 원문에서 확인)' };
    return { verdict: 'hold', why: `같은 사업의 지난 회차(${past.school || '전국'} 등록분 · 마감 ${past.deadline || '원문 확인'}) — 새 회차인지 컨펌 대기` };
  }
  /* 🔴 학교가 달라도 **같은 사업**이면 새로 등록하지 않고 기존 등록분을 전국으로 승격한다 (2026-09-30 · F-5 재발에서).
     열쇠는 verify/entry-rules.cjs programKey — 대괄호·연도·꼬리말을 뗀 알맹이. 재게시(같은 학교)는 아래 isDuplicatePair 가 잡는다. */
  const twin = regItems.find((i) => schoolOf(i) !== n.school && sameProgram({ name: title }, { name: i.name }));
  if (twin) {
    /* 이미 전국인 등록분(schoolOnly 없음)과 같은 사업 — 새로 등록하지 않고 게시 학교만 근거에 더한다(리뷰 3차 · 세 번째 학교 구멍) */
    if (!schoolOf(twin)) {
      /* 🔴 마감이 지난 전국 등록분은 흡수하지 않는다 (2026-10-05 점검 collect-14) — 사업 열쇠(programKey)는 연도·학기를 떼므로
         지난 회차가 다음 학기 같은 사업 글을 삼켜 새 회차가 등록되지 않을 수 있다. 새 회차인지는 사람이 본다. 판정은 registered-merge.mjs openOn 한 곳 */
      if (!openOn(twin, TODAY)) return { verdict: 'hold', why: `같은 사업의 지난 회차(마감 ${twin.deadline}) — 새 회차인지 컨펌 대기` };
      const any = (twin.eligibility || {}).schoolsAny;
      if (any && !any.some((x) => String(x).split('|')[0] === n.school)) return { verdict: 'hold', why: `타교 등록분과 동일 사업(${(twin.name || '').slice(0, 24)}) — 받는 학교 목록에 ${n.school} 없음 · 컨펌 대기` };
      return { verdict: 'absorb', why: '이미 전국(동일 사업)', twin };
    }
    /* 승격은 **로봇이 등록한 교외 · 사람이 범위를 정하지 않은 · 마감 안 지난** 등록분만 — 나머지는 사람이 본다(리뷰 3차).
       판정은 registered-merge.mjs promotableOn 한 곳(승격 로봇과 같다 · 2026-10-05) */
    const promotable = promotableOn(twin, TODAY);
    if (!promotable) return { verdict: 'hold', why: `타교 등록분과 동일 사업(${(twin.name || '').slice(0, 24)}) — 승격 불가(사람 지정·교내·마감 경과) 컨펌 대기` };
    return { verdict: 'promote', why: `다른 학교(${schoolOf(twin)}) 등록분과 같은 사업 → 전국으로 승격`, twin };
  }
  const similars = regItems.filter((i) =>
    // 학교 축은 아래에서 따로 본다 — 여기서는 '같은 사업인가'만 묻는다(같은 학교로 맞춰 넣는다)
    isDuplicatePair({ name: bare(title), eligibility: {} }, { name: bare(i.name), eligibility: {} })
    || (fk && (i.name || '').includes(fk)));
  if (similars.length) {
    // 같은 학교(또는 전국) 등록분이 하나라도 있으면 재게시 중복 — 타교뿐이면 접수분일 수 있어 컨펌 대기
    const same = similars.find((i) => !schoolOf(i) || schoolOf(i) === n.school);
    if (same) return { verdict: 'skip', why: `이미 등록(동일 사업: ${(same.name || '').slice(0, 24)})` };
    return { verdict: 'hold', why: `타교 등록분과 동일 사업(${(similars[0].name || '').slice(0, 24)}) — 접수분 여부 컨펌 대기` };
  }
  if (!ACTION.test(t)) return { verdict: 'hold', why: '선발·모집·신청 신호 없음 — 개발자 컨펌 대기' };
  const dl = parseDeadline(n);
  if (dl && dl.date < TODAY) return { verdict: 'skip', why: `마감 경과(${dl.date})` };
  return { verdict: 'register', deadline: dl ? dl.date : null, deadlineText: dl ? dl.text : null, deadlineSrc: dl ? dl.from : null };
}

/* ---------- 실행 ---------- */
const report = [];
if (!cfg.enabled) {
  report.push('', '### 🤝 자동 등록: 꺼짐 (auto-register-config.json enabled=false)');
} else {
  const regUrlSet = new Set(registered.items.map((i) => canonUrl(decodeUrlEntities(i.sourceUrl || ''))).filter(Boolean));
  const batchSeen = new Set();
  const added = [];
  const held = [];
  /* 데이터 관문 쉬기(auto-held.json)로 이번에 건너뛴 공고 — '선발·모집 신호가 약해요'와 이유가 달라 리포트에 따로 묶는다 */
  const gateHeld = [];
  const promoted = [];   // 다른 학교의 같은 사업으로 전국 승격된 기존 등록분 (2026-09-30)
  /* 거른 이유를 센다 — **조용한 탈락이 이 사고의 정체였다** (2026-09-19). 리포트가 hold 만 적고
     skip 은 한 줄도 안 적어서, 경희대 교내 장학 넷과 '가짜 동일 사업' 여덟이 몇 주 동안
     아무 흔적 없이 사라졌다. 이유별 숫자만 적는다(33줄을 다 적으면 아무도 안 읽는다). */
  const skipped = new Map();

  /* 잘못 등록된 건 되돌리기 (막음 장치) — id와 주소 **둘 다** 본다.
     🔴 왜 주소까지 보나 (2026-08-14에 실제로 당했다):
        id는 `'auto-' + canonUrl(...).slice(-24)`로 **주소에서 파생된다.** 그래서
        주소 정규화 규칙을 고치자 **막아 둔 23건의 id가 전부 바뀌어** blockIds가 무효가 됐고,
        바로 다음 실행에서 부경대 2014·2016·2021·2024년 공고가 **새 id를 달고 되살아났다.**
        주소로 막으면 규칙이 또 바뀌어도 살아남는다. */
  const blockedIds = new Set(cfg.blockIds || []);
  const blockedUrls = new Set((cfg.blockUrls || []).map((u) => canonUrl(u)));
  const before = registered.items.length;
  registered.items = registered.items.filter((i) => !(i.auto
    && (blockedIds.has(i.id) || blockedUrls.has(canonUrl(i.sourceUrl || '')))));
  const removed = before - registered.items.length;

  /* 🔴 등록할 때 이미 끝나 있던 로봇 등록분은 뺀다 (2026-10-05 점검 collect-07 · 판정은 verify/entry-rules.cjs registeredAfterDeadline 한 곳 — 감사와 같다).
     본문에만 기간이 적힌 글이 마감 없이 등록됐다가 몇 분 뒤 발췌기에서 지난 마감을 받았다 — 학생에게는 30일 동안 '마감' 카드뿐이다.
     다시 등록되지 않게 그 글(실시간 공고)에 본문 마감을 적어 둔다(아래 classify 가 '마감 경과'로 거른다 · 수집기가 이미 적었으면 그대로).
     사람이 손댄 것(마감 표식 AI·관리자 · 양식 · 여러 학교 근거)은 빼지 않는다. */
  const lateDropped = registered.items.filter((i) => registeredAfterDeadline(i));
  let noticesTouched = false;
  if (lateDropped.length) {
    const lateIds = new Set(lateDropped.map((i) => i.id));
    registered.items = registered.items.filter((i) => !lateIds.has(i.id));
    const noticeByKey = new Map((notices.items || []).map((n) => [canonUrl(decodeUrlEntities(n.url)), n]));
    for (const it of lateDropped) {
      const n = noticeByKey.get(canonUrl(decodeUrlEntities(it.sourceUrl || '')));
      if (n && !n.bodyDeadline) {
        n.bodyDeadline = it.deadline;
        n.bodyDeadlineText = deadlineQuote(it) || `등록 뒤 원문에서 읽은 마감 ${it.deadline}`;
        noticesTouched = true;
      }
    }
  }
  /* 뺀 등록분의 사업을 '지난 회차' 장부에 적는다(위 classify 의 pastRoundOf) — 이번 실행부터 · 60일 지난 줄은 지운다.
     장부가 없고 뺄 것도 없으면 만들지 않는다. */
  const pastPath = new URL('past-rounds.json', HERE);
  let pastLedger = null;
  try { pastLedger = JSON.parse(fs.readFileSync(pastPath, 'utf8')); } catch { /* 아직 없음 */ }
  let pastPruned = 0;
  if (pastLedger || lateDropped.length) {
    const pr = prunePastRounds(pastLedger, TODAY);
    pastPruned = pr.removed;
    const next = recordPastRounds(pr.ledger, lateDropped, TODAY);
    if (!pastLedger || pr.removed || lateDropped.length) fs.writeFileSync(pastPath, `${JSON.stringify(next, null, 1)}\n`);
    pastLedger = next;
  }

  /* 본문 마감이 아직 없는 글은 저장된 원문에서 채운다 (2026-10-05 점검 collect-07 ②) — 수집기(collect.mjs)는 제 실행 글과 실린 글을 채우지만,
     브라우저 수집 워크플로는 이 로봇을 브라우저 수집기 바로 뒤에 돌려 그 실행에 새로 실린 글이 본문 마감 없이 여기 온다(그러면 끝난 공고가
     마감 없이 등록됐다가 발췌기에서 지난 마감을 받는다). 규칙은 notice-deadline.mjs makeBodyReader 한 곳 — 껍데기를 모르는 호스트는 읽지 않는다.
     판독기(activity-excerpts → extract-excerpts)는 불러올 때 원문 파일을 읽으므로 **못 불러오면 건너뛴다**(그 경우 예전처럼 제목·요약만 본다). */
  try {
    const { activityExcerpts } = await import('./activity-excerpts.mjs');
    const readJsonOr = (u, d) => { try { return JSON.parse(fs.readFileSync(u, 'utf8')); } catch { return d; } };
    const reader = makeBodyReader({
      ...corporaFrom(readJsonOr(new URL('extracted/notices-text.json', HERE), {}), readJsonOr(new URL('extracted/browser-bodies.json', HERE), {})),
      extract: (t) => activityExcerpts(t).deadline,
      lastDateIn,
    });
    for (const n of notices.items || []) reader.fill(n);
    if (reader.counts.bodyDeadlines) {
      noticesTouched = true;
      console.log(`본문 마감을 저장된 원문에서 새로 읽은 글 ${reader.counts.bodyDeadlines}건`);
    }
  } catch (e) { console.log(`본문 마감 채우기를 건너뜀 — ${String((e && e.message) || e).slice(0, 160)}`); }

  /* 등록 대상 학교 좁히기 — 설정의 `schools`. 빈 배열이면 제한 없음(수집 학교 전부).
     2026-08-30 개발자 지시로 경희대·한국외대 둘로 좁혔고(수집은 그대로, 등록만 — 자격 진단·양식을 붙이는 사람 손이 드는 층),
     2026-09-29 개발자 지시("정식 등록도 44곳으로 넓혀")로 다시 비웠다. 경위·부작용은 설정 파일의 `_schools`. */
  const onlySchools = new Set(cfg.schools || []);
  /* 관문에 걸려 되돌린 공고 장부 — 정식 등록에 들어간 id 는 지운다(관문을 지났다) · 마지막으로 걸린 지 30일 넘은 줄도 지운다(끝내 등록되지
     않는 공고가 영영 남지 않게). 장부는 gate-guard 가 처음 만든다(없으면 빈 장부) */
  const heldPath = new URL('auto-held.json', HERE);
  let heldLedger = null;
  try { heldLedger = JSON.parse(fs.readFileSync(heldPath, 'utf8')); } catch { /* 아직 없음 */ }
  if (heldLedger) {
    const pr = pruneRegistered(heldLedger, new Set(registered.items.map((i) => i.id)), TODAY);
    heldLedger = pr.ledger;
    if (pr.removed) fs.writeFileSync(heldPath, `${JSON.stringify(heldLedger, null, 1)}\n`);
  }
  let outOfScope = 0;
  let unseen = 0; // 한 실행 상한에 걸려 **아예 안 본** 공고 — 거른 것과 섞으면 숫자가 거짓말을 한다
  /* 🔴 id 가 겹치는 게시판 (2026-10-05 점검 links-new-1) — 옛 id(끝 24자)가 게시판 공통값이라 그 게시판의 글이 전부 같은 id 를 받았다
     (경기·계명·서강 등 9개교 70여 건이 '이미 등록(같은 id)'·'사람이 막아 둔 공고'로 조용히 빠졌다). 겹칠 때만 꼬리표 id — 규칙은 canon-url.mjs registerId 한 곳.
     막힌 id 를 이번 묶음의 여러 주소가 받고 **사람이 막은 주소가 기록돼 있으면**(blockUrls) 그 주소만 막는다. 막은 주소 기록이 없으면 어느 글을
     막았는지 몰라 예전처럼 전부 막고 리포트에 적는다. */
  const legacyCanons = new Map();
  for (const n of notices.items || []) {
    const u = decodeUrlEntities(n.url || '');
    if (!u) continue;
    const l = idFromUrl('auto-', u);
    if (!legacyCanons.has(l)) legacyCanons.set(l, new Set());
    legacyCanons.get(l).add(canonUrl(u));
  }
  const blockedUrlIds = new Set((cfg.blockUrls || []).map((u) => idFromUrl('auto-', u)));
  const manyUnder = (l) => ((legacyCanons.get(l) || new Set()).size >= 2);
  const ambiguous = (l) => manyUnder(l) && blockedUrlIds.has(l);
  const holderCanon = (l) => {
    const it = registered.items.find((i) => i.id === l);   // 이번 실행에 등록한 것도 본다
    return it ? canonUrl(decodeUrlEntities(it.sourceUrl || '')) : null;
  };
  const sharedBlocks = [...blockedIds].filter((l) => manyUnder(l)).map((l) => ({ id: l, n: legacyCanons.get(l).size, byUrl: blockedUrlIds.has(l) }));
  for (const n of notices.items || []) {
    if (added.length >= (cfg.maxPerRun || 8)) { unseen += 1; continue; }
    if (onlySchools.size && n.school && !onlySchools.has(n.school)) { outOfScope += 1; continue; }
    const r = classify(n, regUrlSet, registered.items, batchSeen, pastLedger);
    const nUrl = decodeUrlEntities(n.url);   // 담는 원문 주소 — `&#038;` 를 되돌린 것 (위 import 주석)
    if (r.verdict === 'promote' || r.verdict === 'absorb') {
      /* 기존 등록분을 전국으로(promote) 또는 이미 전국인 등록분에 게시 학교만 더한다(absorb) — 합치는 규칙은 registered-merge.mjs 한 곳
         (관리자 merge 와 같다). 새 공고는 등록하지 않는다(같은 사업이다). */
      const { promoted: did } = mergeInto(r.twin, { id: `notice:${canonUrl(nUrl)}`, eligibility: { schoolOnly: n.school }, sourceUrl: nUrl, attachments: n.attachments || [] },
        { reason: `같은 사업이 ${n.school} 게시판에도 올라옴(자동)` });
      if (did) promoted.push({ keep: r.twin, n });
      else skipped.set('이미 전국(동일 사업)', (skipped.get('이미 전국(동일 사업)') || 0) + 1);
      regUrlSet.add(canonUrl(nUrl));
      continue;
    }
    if (r.verdict === 'hold') { held.push({ n, why: r.why }); continue; }
    if (r.verdict !== 'register') {
      /* 괄호 안 알맹이(공고 이름·날짜)는 떼고 이유만 남긴다 — 안 떼면 집계가 아니라 목록이 된다:
         `이미 등록(동일 사업: 충북…)` → `이미 등록(동일 사업)` · `마감 경과(2026-09-17)` → `마감 경과` */
      const key = (r.why || '').replace(/:\s*[^)]*(?=\))/, '').replace(/\(\d{4}-\d{2}-\d{2}\)/, '');
      skipped.set(key, (skipped.get(key) || 0) + 1);
      continue;
    }
    const cu = canonUrl(nUrl);
    batchSeen.add(cu);
    batchSeen.add(n.school + '|' + normTitle(n.title));
    // 첨부는 신청서·공고문류만 (게시판 메뉴 링크 오염 방지)
    // '원서·동의서·서약서·추천서'가 빠져 있어 진짜 신청서(예: 장학금지급원서)가 통째로
    // 버려지던 것을 2026-07-30에 보강 — 염곡 3건 중 1건만 잡히던 실사례
    const atts = (n.attachments || [])
      .filter((a) => /신청서|지원서|신청양식|원서|서식|양식|동의서|서약서|추천서|공고/.test(a.name) && /\.(hwp|hwpx|doc|docx|pdf|zip|xlsx?)(\?|$)?/i.test(a.name + a.url))
      .slice(0, 6);
    // 🔴 공식은 canon-url.mjs 하나 — 베끼면 관리자 화면의 register 와 갈라진다(2026-08-14 부경대 유형) · 겹치면 꼬리표 id(registerId · 위 legacyCanons 주석)
    const rid = registerId('auto-', nUrl, { holderCanon, blockedIds, blockedCanons: blockedUrls, ambiguous });
    const id = rid.id;
    // 아래 갈래도 집계에 넣는다 — 여기서 빠져나가면 다시 '조용한 탈락'이 된다
    /* 같은 id(옛 id·꼬리표 id)를 쓰는 등록분이 **같은 학교 · 같은 제목**이면 같은 글이다(표식 주소가 진짜 주소로 풀린 것 등) — 다시 등록하지 않는다 */
    const holders = registered.items.filter((i) => i.id === rid.legacy || i.id === id);
    const sameSchool = (i) => (((i.eligibility || {}).schoolOnly) || n.school) === n.school;
    if (holders.some((i) => sameSchool(i) && normTitle(i.boardTitle || i.name || '') === normTitle(n.title || ''))) {
      skipped.set('이미 등록(같은 글 · 주소만 다름)', (skipped.get('이미 등록(같은 글 · 주소만 다름)') || 0) + 1); continue;
    }
    if (holders.some((i) => i.id === id)) { skipped.set('이미 등록(꼬리표 id 까지 겹침)', (skipped.get('이미 등록(꼬리표 id 까지 겹침)') || 0) + 1); continue; }
    /* 사람이 한 번 '이건 아니다'라고 뺀 공고는 다시 등록하지 않는다.
       위 되돌리기와 같은 이유로 주소도 함께 본다 — 지우기만 하면 다음 실행에 또 들어온다.
       옛 id 로 막힌 것(blockedByLegacy)도 막는다 — 막은 주소 기록이 있는 겹친 id 만 그 주소로 좁힌다(registerId). */
    if (blockedIds.has(id) || blockedUrls.has(cu) || rid.blockedByLegacy) { skipped.set('사람이 막아 둔 공고(blockIds/blockUrls)', (skipped.get('사람이 막아 둔 공고(blockIds/blockUrls)') || 0) + 1); continue; }
    /* 데이터 관문에 두 번 걸려 되돌린 공고는 마지막으로 걸린 날부터 3일 쉰다 — 같은 공고가 실행마다 '등록 → 관문 빨간불 → 되돌림'을
       되풀이하지 않게(10-03~04 실측 8건). 상한(maxPerRun)을 먹지 않고, 조용히 빠지지 않게 컨펌 대기에 이유를 남긴다. */
    if (heldLedger && isHeld(heldLedger, id, TODAY)) {
      const times = (heldLedger.items.find((x) => x.id === id) || {}).reverts || 2;
      gateHeld.push({ n, why: `데이터 관문에 ${times}번 걸려 되돌린 공고 — 3일 쉬었다 다시 봅니다` });
      continue;
    }
    const title = cleanTitle(n.title).slice(0, 70);
    const entry = {
      id,
      name: title,
      /* 🔴 **게시판에 뜨는 제목 그대로** 남긴다 (2026-08-29 신설).
         `name` 은 청소하고 70자로 자른 값이라 게시판 행과 글자가 다르다. 링크 사냥꾼이
         나중에 원문 주소를 찾을 때 대조하는 것은 게시판 행이므로, 그 원본이 없으면
         표식(#n-) 주소 조각에 기대게 된다 — 그 조각은 주소 길이 때문에 잘려 있다.
         중앙대 11건이 3주 동안 '사라진 공고'로 오해받은 원인이 바로 이 값의 부재였다
         (CLAUDE.md '링크 사냥꾼이 못 찾는 진짜 이유'). 여기서 `n.title` 이 그 원본이다.
         🔴 **담을 때 청소해서 담는다** — 사냥꾼도 `boardTitle = cleanTitle(mate.title)`
         로 담고, test-collector 가 '저장된 boardTitle 에 부스러기가 없다'를 지킨다.
         날것으로 담으면 앞머리 `공지 공지`·꼬리 `2026.08.25. 조회 287` 이 남아 대조가
         앞 24자에서 통째로 빗나간다. (실제로 이 값을 날것으로 담았다가 그 검사에 걸렸다) */
      boardTitle: cleanTitle(n.title),
      /* 🔴 **교내는 증거가 있을 때만** — 없으면 교외다 (2026-09-18 개발자 지시).
         옛 규칙은 제목에 `재단·장학회·시민` 같은 낱말이 보일 때만 교외로 보고 **나머지를 전부
         교내**로 떨어뜨렸다. 그래서 낱말이 제목에 안 드러나는 전국 사업이 통째로 '교내'가 됐다 —
         실측으로 '교내' 19건 중 **실제 교내는 2건**뿐이었고, 나머지는 한국장학재단 국가장학금 7건
         (푸른등대·국가근로·중소기업취업연계·고졸후학습자)과 외부 재단·지자체 10건이었다.
         학교 게시판에 올라오는 공고는 대부분 **학교가 옮겨 적은 교외 공고**라 기본값이 반대였다.
         ⚠️ 낱말 목록을 다시 늘려 교외를 찾으려 하지 말 것 — 그 방식이 틀린 이유가 위의 실측이다.
            찾을 수 있는 것은 '교내라고 적어 둔 것' 쪽이고, 그건 게시판이 제목에 직접 적는다. */
      /* 🔴 **학교를 같이 넘긴다** (2026-09-20) — 학교가 제 장학금을 올릴 때는 제목에 `교내` 라고
         안 적는다(제 게시판이니까). 그 학교의 제도 이름표(`OWN_PROGRAMS`)를 봐야 알 수 있고,
         그 표는 학교별이라 이 값이 없으면 경희대 교내 장학 넷이 다시 전부 '교외'가 된다. */
      type: noticeKind(title, n.school, learnedPrograms),
      /* 왜 그렇게 판정했나 — 제목만으로 읽은 증거(원문 본문은 뒤 단계 kind-classify.mjs 가 읽어 고친다 · 2026-09-30) */
      ...(() => { const k = classifyKind({ title, school: n.school, tokens: schoolTokens(n.school, SCHOOL_NAMES), domain: schoolDomain(n.url), campusMark: NOTICE_CAMPUS_MARK, own: ownNames(n.school) });
        return { kindEvidence: k.evidence.slice(0, 3), kindConfidence: k.confidence, kindFrom: '로봇(제목)' }; })(),
      /* 🔴 **게시한 학교를 주관 기관이라고 적지 않는다** (2026-09-18 개발자 지시).
         이 칸은 '누가 주는가'인데 '어느 게시판에서 주웠나'가 들어가 있었다(33건). 그래서
         카드가 `교내 · 경희대학교 게시 공고 / 푸른등대 한국수력원자력 k-원전 장학금` 처럼
         **한국장학재단 장학금을 경희대가 주는 것처럼** 보여 줬다.
         모르면 지어내지 않고 모른다고 적는다 — 같은 항목의 `금액 원문 확인`·`접수 기간 원문 확인`
         과 같은 말투다(운영 원칙 8-1). 어느 게시판에서 왔는지는 `summary` 와 원문 링크에 남는다.
         ⚠️ 제목에서 재단 이름을 뽑아 채우려 하지 말 것 — `공통 2026년 상반기 사랑나눔장학생 모집`
            처럼 **주는 곳이 제목에 없는** 공고가 있어, 뽑으면 그럴듯한 오답이 들어간다. */
      provider: PROVIDER_UNKNOWN,
      amount: '금액 원문 확인',
      // 금액을 모르면 0 — 지어낸 숫자를 합계에 섞지 않는다 (운영 원칙 8-1 추론 금지).
      // 예전에는 50만원을 넣어 홈 화면 합계가 부풀려져 있었다 (2026-07-30 교정)
      amountValue: 0,
      deadline: r.deadline || null,
      // 마감을 읽었으면 **어느 문구에서 읽었는지** 남긴다 — 게시판 요약은 저장되지 않아 이 줄이
      // 유일한 근거다(verify/deadline-audit.mjs 가 이 문구를 근거로 센다 · 2026-09-17 노션 G-3)
      ...(r.deadline && r.deadlineText ? { deadlineFrom: `${r.deadlineSrc || '게시판 요약'} · ${r.deadlineText}` } : {}),
      // 마감을 못 읽은 공고는 등록일을 남긴다 — 앱이 등록 후 60일이 지나면 자동으로 감춘다
      // (마감이 없으면 목록에서 영영 안 사라지던 문제, 2026-07-30 교정)
      ...(r.deadline ? {} : { listedAt: TODAY }),
      period: r.deadline ? `접수 ~${r.deadline}` : '접수 기간 원문 확인',
      summary: `${n.school} 게시판에서 수집돼 자동 등록된 공고예요(검수 전). 지원 자격·금액·마감·신청 방법은 반드시 원문 공고에서 확인하세요.`,
      eligibility: { selective: true, schoolOnly: n.school, ...(n.campus ? { campusOnly: n.campus } : {}) },
      documents: ['지원 자격·제출 서류는 원문 공고에서 확인'],
      duplicable: true,
      note: '수집 로봇이 자동 등록한 공고예요(검수 전). 세부 내용이 실제와 다를 수 있으니 원문 공고를 꼭 확인하세요.',
      noForm: `자동 등록(검수 전) ${TODAY} — 양식 스키마화는 검수 후 진행`,
      auto: true,
      attachments: atts,
      sourceUrl: nUrl,
      sourceKind: 'auto'
    };
    /* 마지막 관문: 감사 도구와 '똑같은 규칙'으로 자기 결과를 스스로 검사한다.
       규칙에 걸리면 등록하지 않고 컨펌 대기로 넘긴다 — 잘못된 항목이 앱에 나가지 않게
       (2026-07-30: PNG 파일·대출·대학원 공고가 자동 등록됐던 사고의 재발 방지) */
    const problems = checkEntry(entry, { formIds: new Set(Object.keys(forms.templates || {})) })
      .filter((p) => p.level === 'error');
    if (problems.length) {
      held.push({ n, why: `등록 규칙 위반으로 자동 등록 보류 — ${problems[0].msg}` });
      continue;
    }
    registered.items.push(entry);
    regUrlSet.add(cu);
    added.push(entry);
  }

  if (added.length || removed || promoted.length || lateDropped.length) {
    registered.updatedAt = TODAY;
    fs.writeFileSync(registeredPath, JSON.stringify(registered, null, 1) + '\n');
  }
  /* 뺀 등록분의 마감을 실시간 공고에 적어 둔 것 — 수집기와 같은 형식으로 저장한다(다음 수집이 그대로 이어 싣는다) */
  if (noticesTouched) fs.writeFileSync(noticesPath, JSON.stringify(notices, null, 1));

  // 스키마화 대기 큐: 신청서 첨부가 있는 자동 등록분은 워크플로가 곧바로 원본을
  // 내려받고(pending-forms.json → deepfetch), 다음 Claude 세션이 스키마화한다.
  // 목표: '원본 양식 다운로드형' 채널이 하루 이상 남아 있지 않게 한다.
  const queuePath = new URL('pending-forms.json', HERE);
  let queue = { items: [] };
  try { queue = JSON.parse(fs.readFileSync(queuePath, 'utf8')); } catch { /* 첫 실행 */ }
  let queued = 0;
  let backfilled = 0;
  /* 🔴 **이번 실행에 등록한 것만 보지 않는다** (2026-09-23 · 원칙 7 소급).
     예전엔 `added` 만 훑어서, 등록할 때 첨부가 공고문뿐이었다가 **나중에 신청서가 붙은**
     공고(재수집·본문 재수집이 첨부를 채운다)는 영영 대기줄에 못 들어갔다 — 실측으로 마감 전
     자동 등록분 32건 중 22건이 대기줄 밖이었고, 그중엔 `신청서식.hwpx` 를 단 공고도 있었다.
     그래서 **아직 양식이 안 붙은 자동 등록분**을 매 실행 다시 본다. 좁히는 조건 셋:
     · `noForm` 이 로봇이 단 '검수 전' 표시일 때만 — 사람이 '양식 없음'을 확인해 적은 사유는 존중한다
     · 마감 지난 공고는 뺀다 —받아 봐야 학생이 못 쓴다(원본 확보 단계의 시간만 먹는다)
     · 한 번이라도 대기줄에 들어간 적 있으면 다시 넣지 않는다(받기 실패 retired 도 그대로 둔다) */
  const stillNeedsForm = (e) => e.auto && !e.formId && !e.prepDoc
    && /^자동 등록\(검수 전\)/.test(e.noForm || '')
    && !(e.deadline && e.deadline < TODAY);
  const addedIds = new Set(added.map((e) => e.id));
  const candidates = [...added, ...registered.items.filter((e) => !addedIds.has(e.id) && stillNeedsForm(e))];
  /* 학생이 채우는 서식으로 보이는 첨부 이름. `계획서`·`자기소개서` 는 2026-09-23 에 더했다 —
     `활동 계획서(장학신청시 제출).hwp` 처럼 이름에 '신청서·양식'이 없는 서식이 대기줄 밖에 있었다.
     `선발 계획(안)` 같은 **읽는 문서**가 같이 들어와도 괜찮다: 변환기(schematize-forms.mjs 의
     NOT_A_FORM)가 신청서가 아닌 것을 거른다 — 여기서는 원본을 받아 둘지만 정한다. */
  const FORMISH = /신청서|지원서|신청양식|원서|서식|양식|동의서|서약서|계획서|자기소개서/;
  for (const e of candidates) {
    if (!(e.attachments || []).some((a) => FORMISH.test(a.name))) continue;
    if (queue.items.some((q) => q.id === e.id)) continue;
    /* deepfetch가 제목 부분일치로 대상을 찾으므로, 부스러기 없는 제목 앞부분을 표적으로 쓴다.
       길이 12자 → 30자 (2026-08-04). 12자는 "2026학년도 2학기 " 처럼 어느 공고에나 있는
       조각이 되기 쉬워서, 표적 하나가 수십 건에 걸렸다. 그 바람에 학자금대출·캠퍼스 안내
       같은 공고의 첨부(3.9MB zip 등)까지 받다가 수집 예산을 넘겨 그날 수집이 통째로
       버려졌다. 머리쪽 대괄호만 떼는 것도 같은 이유다 — 가운데 대괄호까지 지우면 표적이
       원래 제목의 '이어진 한 토막'이 아니게 돼서 아무 공고에도 안 걸린다. */
    const target = cleanTitle(e.name).replace(/^(\s*\[[^\]]*\])+/, '').trim().slice(0, 30);
    queue.items.push({ id: e.id, name: e.name, target, added: TODAY, fetched: false, schematized: false });
    queued++;
    if (!addedIds.has(e.id)) backfilled++;
  }
  if (queued) {
    fs.writeFileSync(queuePath, JSON.stringify(queue, null, 1) + '\n');
    report.push('', `**🧩 양식 원본 자동 확보 예약 ${queued}건**${backfilled ? ` (그중 ${backfilled}건은 전에 등록됐는데 신청서 첨부가 나중에 붙은 공고)` : ''} — 원본은 이 실행에서 바로 내려받고, 같은 실행의 무료 변환기가 앱 양식으로 옮겨요(못 옮긴 것은 리포트 '보류'에 남아요).`);
  }
  const waiting = queue.items.filter((q) => q.fetched && !q.schematized).length;
  if (waiting) report.push('', `**⏳ 스키마화 대기 중 ${waiting}건** (원본 확보됨 — collector/pending-forms.json)`);

  report.push('', `### 🤖 자동 등록 (선조치후보고) — ${added.length}건 등록${removed ? ` · ${removed}건 제거(blockIds)` : ''}`);
  if (lateDropped.length) {
    /* 🔴 원인을 하나로 단정하지 않는다(CLAUDE.md 매 세션 5 · 리뷰 2026-10-05) — 마감은 본문에서도 공고문 첨부에서도 읽혔을 수 있고,
       제목·요약의 날짜를 못 읽었던 것일 수도 있다. 항목마다 마감 출처 표식(deadlineFrom)을 그대로 적는다. */
    report.push('', `**등록 뒤 원문에서 마감 경과 확인 — 되돌림 ${lateDropped.length}건** — 나중에 읽은 마감이 등록한 날보다 앞이었던 로봇 등록분이에요. 다시 등록되지 않게 그 공고에 마감을 적어 뒀고, 같은 사업의 다른 학교 글도 60일 동안 새로 등록하지 않고 컨펌 대기로 내려요(장부 \`collector/past-rounds.json\`):`);
    for (const e of lateDropped.slice(0, 20)) report.push(`- \`${e.id}\` ${(e.name || '').slice(0, 40)} · 마감 ${e.deadline} · 등록 ${e.listedAt} · 마감 출처: ${String(e.deadlineFrom || '기록 없음').slice(0, 50)}`);
    if (lateDropped.length > 20) report.push(`- … 외 ${lateDropped.length - 20}건`);
  }
  if (pastPruned) report.push('', `지난 회차 장부에서 60일 지난 줄 ${pastPruned}건을 지웠어요 — 그 사업 글은 다시 보통 규칙으로 봅니다.`);
  /* 🔴 좁힌 것을 **말없이** 하지 않는다 — 리포트에 안 적으면 다음 세션이
     "로봇이 갑자기 아무것도 안 등록한다"고 없는 버그를 쫓는다. */
  if (onlySchools.size) {
    report.push('', `등록 대상 학교: ${[...onlySchools].join(' · ')} (설정 \`schools\`)`
      + `${outOfScope ? ` — 다른 학교 공고 ${outOfScope}건은 등록하지 않고 실시간 피드로만 나갔어요.` : ''}`);
  }
  if (added.length) {
    report.push('', '자동 등록분은 앱에 **자동 등록 · 검수 전** 배지로 표시돼요. 잘못 등록된 건이 있으면 채팅으로 알려주시거나 `collector/auto-register-config.json`의 `blockIds`에 id를 넣어주세요.', '');
    for (const e of added) report.push(`- \`${e.id}\` [${e.name}](${e.sourceUrl})${e.deadline ? ` · 마감 ${e.deadline}` : ''} · ${(e.eligibility.schoolOnly || '')}`);
  } else {
    report.push('', '이번 실행에서 자동 등록 기준(개별 실공고·미등록·마감 전)을 전부 통과한 공고가 없어요.');
  }
  if (promoted.length) {
    report.push('', `**전국으로 승격 ${promoted.length}건** — 다른 학교 게시판에 같은 사업이 올라와 한 학교 한정을 풀었어요(합치는 규칙은 관리자 합침과 같아요 · 근거는 항목의 scopeFrom).`);
    for (const { keep, n } of promoted) report.push(`- \`${keep.id}\` ${(keep.name || '').slice(0, 40)} ← ${n.school} 게시판 [${cleanTitle(n.title).slice(0, 40)}](${n.url})`);
  }
  if (held.length) {
    report.push('', `**컨펌 대기 (자동 기준 미달 ${held.length}건)** — 장학 신호는 있지만 선발·모집 신호가 약하거나 등록 규칙에 걸렸어요(괄호에 이유):`);
    for (const h of held.slice(0, 10)) report.push(`- ${h.n.title.slice(0, 60)} (${h.why})`);
    if (held.length > 10) report.push(`- … 외 ${held.length - 10}건`);
  }
  /* 🔴 데이터 관문 쉬기는 따로 묶는다 — 이유가 '신호가 약해서'가 아니다. 같은 실행에 함께 들어온 다른 공고 때문에 같이 되돌려졌을 수도 있어
     (되돌리기는 그 실행의 새 자동 등록분을 한꺼번에 뺀다) 원인을 이 공고로 단정하지 않는다. */
  if (gateHeld.length) {
    report.push('', `**데이터 관문 쉬기 ${gateHeld.length}건** — 데이터 관문에 두 번 걸려 되돌린 공고라 마지막으로 걸린 날부터 3일 자동 등록을 쉬어요. 같은 실행에 함께 들어온 다른 공고 때문에 같이 되돌려졌을 수도 있어요(장부 \`collector/auto-held.json\`):`);
    for (const h of gateHeld.slice(0, 10)) report.push(`- ${h.n.title.slice(0, 60)} (${h.why})`);
    if (gateHeld.length > 10) report.push(`- … 외 ${gateHeld.length - 10}건`);
  }
  /* 막은 id 하나가 이번 묶음의 여러 공고에 걸린 것 — 막은 주소가 기록돼 있으면 그 주소만 막고, 없으면 예전처럼 전부 막는다(어느 글을 막았는지 모른다) */
  for (const b of sharedBlocks) {
    report.push('', b.byUrl
      ? `⚠️ 차단 id 하나가 여러 공고에 걸림 — 주소(blockUrls)로만 막음: \`${b.id}\` ${b.n}건`
      : `⚠️ 차단 id 하나가 여러 공고에 걸렸는데 막은 주소 기록이 없어 전부 막았어요(사람 확인 — 막을 글의 주소를 blockUrls 에): \`${b.id}\` ${b.n}건`);
  }
  if (skipped.size) {
    const total = [...skipped.values()].reduce((a, b) => a + b, 0);
    report.push('', `**거른 공고 ${total}건 — 이유별**`, '');
    for (const [why, c] of [...skipped].sort((a, b) => b[1] - a[1])) report.push(`- ${why} · ${c}건`);
  }
  /* 🔴 '거른 것'과 '아예 안 본 것'을 섞지 않는다 — 상한에 걸려 멈춘 뒤의 공고는 판정조차 안 했다.
     안 적으면 위 숫자가 "이만큼 걸러졌다"로 읽혀 다음 세션이 없는 버그를 쫓는다. */
  if (unseen) report.push('', `⏭ 한 실행 상한(${cfg.maxPerRun || 8}건)에 걸려 **${unseen}건은 보지 않았어요** — 다음 수집에서 이어서 봅니다.`);
}

if (fs.existsSync(reportPath)) fs.appendFileSync(reportPath, report.join('\n') + '\n');
console.log(report.join('\n').trim() || 'auto-register: no-op');

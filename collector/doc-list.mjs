/* 제출 서류 목록 읽기 — 한 곳 (2026-10-13 · 개발자 "남은 것 모두 진행" ④)

   🔴 왜 — 실측(2026-10-13 · 마감 전 정식 등록 109건): 자동 등록분 175건의 `documents` 가 전부
      「지원 자격·제출 서류는 원문 공고에서 확인」 자리표시 한 줄이었다. 발췌기는 '제출서류' 문장을 발췌로 담지만
      **서류 목록 칸으로는 옮기지 않아**, 앱은 어느 공고가 자기소개서를 자유 양식으로 받는지(앱 지원문서를 그대로 낼 수 있는 유일한 갈래 ·
      원칙 8-2 `prepDoc`) 한 건도 몰랐다.
   하는 일 둘 — 순수 함수(원문 글자 → 결과), 발췌기(extract-excerpts.mjs)가 부르고 관문(test-collector 「제출 서류 목록」)이 같은 것을 잰다.
     ① extractDocumentList(text): '제출 서류' 절의 줄을 서류 이름으로(원문 글자 그대로 · 머리 기호·번호만 뗀다).
     ② freeFormBasis(text, docs): "자유 양식·별도 서식 없음" 문장이 **작성형 서류**(자기소개서·계획서·사유서…)와 함께 있을 때만 그 문장을 근거로.
        근거 없이 prepDoc 을 켜지 않는다(tools/admin-apply.mjs 의 짝 규칙과 같다 — 근거 문장은 원문에 있는 글자여야 한다).
   🔴 지어내지 않는다 — 절을 못 찾으면 빈 배열. 문의처·유의사항·신청 방법 줄은 서류가 아니다(다음 절 머리에서 멈춘다). */

import { decodeEntities } from './clean-title.mjs';

export const DOC_HEAD = /(제출\s*(할\s*)?서류|구비\s*서류|신청\s*서류|접수\s*서류|필요\s*서류|첨부\s*서류|제출\s*서류\s*및\s*(방법|절차))/;
/* 다음 절의 머리 — 여기서 서류 목록이 끝난다(서류 이름이 이런 낱말로 시작하는 일은 없다) */
const NEXT_HEAD = /^\s*(?:[\[(【〔]?\s*)?(?:[\d①-⑳]+\s*[.)]?\s*|[가-힣]\s*[.)]\s*|[-–—•▪▶▷◆◇○●■□▣★♦⇒‡◦∙❍◎￭·ㆍ*ㅇ]\s*)?(신청\s*방법|신청\s*기간|접수\s*기간|접수\s*방법|제출\s*방법|제출\s*기한|제출\s*처|문의|유의\s*사항|기타|선발\s*(인원|방법|절차|일정)|지원\s*자격|신청\s*자격|지급|심사|발표|지원\s*내용|장학\s*금액|지원\s*금액|일정|향후|결과)/;
/* ③ 기호를 뗀 줄의 다음 절 머리 — NEXT_HEAD 와 같은 낱말(앞 기호 목록이 닫혀 있어 ※ | ◤ < 「 뒤의 머리를 못 보던 것) */
const NEXT_HEAD_BARE = /^(신청\s*절차|접수\s*(장소|처)|신청\s*방법|신청\s*기간|접수\s*기간|접수\s*방법|제출\s*방법|제출\s*기한|제출\s*처|문의|유의\s*사항|기타|선발\s*(인원|방법|절차|일정)|지원\s*자격|신청\s*자격|지급|심사|발표|지원\s*내용|장학\s*금액|지원\s*금액|일정|향후|결과)/;
const BULLET = /^[\s\-–—•▪▶▷◆◇○●■□▣★♦⇒‡◦∙❍◎￭·ㆍ*ㅇ√]+|^\s*[\[(【〔]?\s*(?:\d{1,2}\s*[.)\]】〕]|[①-⑳]\s*[.)\]】〕]?|[가나다라마바사아자차카타파하]\s*[.)\]】〕])\s*/;
const DOC_WORD = /서|증명|사본|원본|통장|신분증|사진|등본|확인|계획|추천|동의|지원|신청|소개|이력|포트폴리오|성적|재학|졸업|가족|소득|수급/;
export const WRITE_DOC = /자기소개서|자소서|학업계획서|수학계획서|연구계획서|활동계획서|사유서|지원\s*동기|에세이|포부|소개서|계획서/;
export const FREE_FORM = /자유\s*(양식|서식|형식)|별도\s*(의\s*)?(양식|서식)(은|이)?\s*(없|무)|(양식|서식)\s*(은|이)?\s*(없음|없습니다|무)|서식\s*자유|자유롭게\s*작성|양식\s*자유|형식\s*자유/;
const MAX_DOCS = 14;
/* 서류가 아닌 줄 — 전화·주소·날짜·지시문(…하세요·…제출·…금지) · 꼬리 괄호를 떼고 본다 */
const NOT_DOC = /☎|https?:\/\/|www\.|\d{2,4}-\d{3,4}-\d{4}|(기일|기간|마감|선정|지급|발표|통보)\s*[:：]|^\d{1,2}\/\d{1,2}|^\d{4}\s*[.년]/;
const INSTRUCTION_END = /(합니다|하세요|하시기\s*바랍니다|바람|할\s*것|필요|금지|제출|참조|참고|확인)\s*\.?\s*$/;   // 끝 마침표가 있어도 지시문이다(2026-11-15)
/* 안내 문장 끝 (2026-11-15 · 실데이터 1,183줄 분류) — 「서류 미비자는 … 제외됩니다.」「관련 서류는 반환하지 않음」「서류심사 진행 예정」「직인이 표기된 공식 증명서만 인정」.
   서류 이름은 명사구다. 단 「봉사활동 확인서 - 해당자에 한함」「총장 추천서 : 첨부 양식」 처럼 **서류 이름 뒤에 가름표로 조건이 붙은 줄**은 서류다(앞 조각에 서류 명사가 있으면 둔다). */
const SENTENCE_END = /(니다|바랍니다|않음|않는다|않으며|불가능?|예정|됨|함|임|인정|제외|있음|없음|으며|하고|경우|업로드|다운로드|탈락|불이익|무효|취소|(받아|하여|한\s*후|후에?)\s*작성)\s*\.?\s*$/;
/* 표 안의 갈래 이름(「기초생활수급자」「고등학생 지원자」「성적환산 방법」「작성 서식,대표 발급처」) — 서류 명사 없이 사람·방법·칸 이름으로 끝난다 */
const CATEGORY_END = /(자|학생|방법|기준|대상|구분|내용|발급처|발급\s*방법|사항|시스템|학교|가정|계층)$/;
/* 서류 절 머리 그 자체(「신 청 (구 비) 서 류」「제출서류 및 발급 방법」) — 괄호·빈칸을 떼면 이름표뿐인 줄 */
const PURE_HEAD = /^(제출(할)?|구비|신청|필요|첨부|접수|주요|필수|선택|공통|추가|기본)*서류(목록|안내|및(발급)?방법|및제출방법)?[:：]?$/;
const isNoteSentence = (core) => {
  if (!SENTENCE_END.test(core)) return false;
  const seg = core.split(/\s[-–—:：]\s|\s*[:：|※]\s*/);
  return !(seg.length > 1 && seg[0].length <= 60 && DOC_NOUN.test(seg[0]));
};
/* 소제목(「필수 제출 서류」「추가 제출 가능 서류 (…)」「지원 분야별 필수 제출 자료」) — 서류 이름이 아니다: 서류·자료로 끝나고 구체적인 서류 낱말이 없다 */
const DOC_NOUN = /증명|증빙|사본|원본|신청서|지원서|원서|확인서|동의서|추천서|계획서|소개서|사유서|서약서|통장|등본|초본|신분증|사진|성적표|통지서|통보서|이력서|진단서|신고서|명세서|영수증|기록부|자격증|수료증|합격증|기획서|설명서|제안서|포트폴리오|증$|[가-힣](?<!에|로|부터|으로)서(?=\s*(\d\s*[부매통]|[(\[<【〈]|$))/;   // …서로 끝나는 서류 이름(내역서·기술서·진술서) — 「…에서」「…로서」는 아니다
const isSubHead = (c) => { const bare = (/^[\[(【〔]/.test(c) && /[\])】〕]$/.test(c)) ? c.slice(1, -1).trim() : c; const core = bare.replace(/\s*[\[(【〔][^\])】〕]*[\])】〕]\s*$/, '').trim(); return /(서류|자료)$/.test(core) && !DOC_NOUN.test(core); };
const isDocLike = (c) => {
  if (!DOC_WORD.test(c)) return false;
  if (c.replace(/\s/g, '').length < 4 && !DOC_NOUN.test(c)) return false;   // 「신청서」「등본」 같은 짧은 이름은 두고 OCR 조각(「서재다」)만 뺀다
  if (/^[(（]/.test(c)) return false;                                   // 괄호로 시작하는 줄은 앞 서류의 설명이다
  if (HEAD_ONLY.test(c) || FILE_NOTE.test(c) || isSubHead(c)) return false;
  if (NOT_DOC.test(c)) return false;
  const core = c.replace(/\s*[\[(【〔][^\])】〕]*[\])】〕]\s*$/, '').trim();   // 꼬리 괄호(「(샘플 참고하여 작성)」)는 설명이다
  if (INSTRUCTION_END.test(core)) return false;
  const core2 = core.replace(/[\s|ㆍ·•]+$/, '').replace(/\s*[(（][^)）]*$/, '').trim();   // 끝의 표 칸 막대·닫히지 않은 괄호는 떼고 본다
  if (isNoteSentence(core) || isNoteSentence(core2)) return false;
  if (/서류(는|를|가|만|도|에)\s/.test(core) && !DOC_NOUN.test(core.split(/서류(는|를|가|만|도|에)\s/)[0])) return false;   // 「모든 서류는 …」「선정되지 않은 서류는 …」 — 서류를 두고 하는 말
  if (CATEGORY_END.test(core) && !DOC_NOUN.test(core)) return false;
  if (/[한인된는은던할]\s*(학생|자|사람|분)$/.test(core)) return false;   // 「…을 충실히 작성한 학생」「…에 재학 중인 자」 — 누가 받는가(자격)이지 서류가 아니다
  if (PURE_HEAD.test(c.replace(/[\[(（【〔<〈「『][^\])）】〕>〉」』]*[\])）】〕>〉」』]/g, '').replace(/[\s·]/g, ''))) return false;   // 서류 절 머리 자체
  /* 꼬리 괄호 안이 안내 문장이고 앞에 서류 명사가 없다(「… 구비서류에 관련 필독(… 참고하시기 바랍니다.)」) */
  const tailIn = c.match(/[(（]([^()（）]*)[)）]\s*$/);
  if (tailIn && /(니다|바랍니다)\s*\.?\s*$/.test(tailIn[1]) && !DOC_NOUN.test(core)) return false;
  return true;
};

function cleanDoc(line) {
  return decodeEntities(String(line || '')).replace(BULLET, '').replace(/\s+/g, ' ').replace(/[,;、]\s*$/, '').trim();
}
/* 절 머리 자체·표 머리(「구 비 서 류」)·너무 짧은 조각(OCR 「서재다」)·파일 이름 안내는 서류가 아니다 */
const HEAD_ONLY = /^(제\s*출\s*(할\s*)?|구\s*비|신\s*청|필\s*요|첨\s*부|기\s*본|전형별|신청자)?\s*서\s*류\s*(목\s*록)?$/;   // 「구 비 서 류」 표 머리도
const FILE_NOTE = /파일\s*(제목|명)|파일명/;
/* 한 줄에 여러 서류가 쉼표·가운뎃점으로 붙어 있으면 가른다 — 조각마다 서류 낱말이 있을 때만(문장을 토막 내지 않는다) */
function splitInline(s) {
  if (!/[,，·]/.test(s) || s.length > 120) return [s];
  /* 괄호 안의 쉼표(「신청서 1부 (소정양식, 사진 부착)」)는 가르지 않는다 — 리뷰 */
  const parts = []; let depth = 0; let cur = '';
  for (const ch of s) {
    if (/[\[(【〔（]/.test(ch)) depth += 1; else if (/[\])】〕）]/.test(ch)) depth = Math.max(0, depth - 1);
    if (depth === 0 && /[,，·]/.test(ch)) { parts.push(cur.trim()); cur = ''; } else cur += ch;
  }
  parts.push(cur.trim());
  const cleaned = parts.filter(Boolean);
  if (cleaned.length < 2) return [s];
  parts.length = 0; parts.push(...cleaned);
  if (parts.length < 2 || !parts.every((p) => p.length <= 40 && DOC_WORD.test(p))) return [s];
  return parts;
}

/* ── 절 경계 (2026-11-15 · 실데이터 1,183줄 분류 · 워크플로 추적) ───────────────────────────────────────
   목록이 어디서 끝나는지를 **낱말이 아니라 줄의 꼴**로 본다. 전엔 멈춤이 넷뿐이라(빈 줄 둘 · 다음 절 낱말 · 120자 · 서류 낱말 없는 긴 줄)
   안내 문장·심사 단계·지원 자격이 서류 칸에 들어갔다 — 학생 화면 「접수 › 서류」·체크리스트·보관함 대조에 그대로 보였다.
     ① 머리줄은 **이름표뿐인 줄**(`4. 제출서류`·`□ 구비서류(해당자)`·`제출서류 : 신청서 1부`) — 「ㅇ 제출서류에 서명/ 날인 필수」 같은 문장은 머리가 아니다.
        그 머리에서 아무것도 못 건지면 다음 머리 후보로 넘어간다.
     ② 머리줄과 **같은 단계의 기호·번호**가 다시 나오면 새 절이다(`○ 제출서류` … `○ 서류심사 진행 예정` · `6.` … `7. 제출처`) — 단 그 줄이 서류 이름이면 둔다.
     ③ 다음 절 머리는 줄 앞 기호(※ | ◤ < 「 ✅ · 로마 숫자)를 떼고 본다 · 「지원자 유의사항」「비고」 같은 …사항·비고 머리도 절이다.
     ④ 한 줄 목록(`제출서류 : …`) 아래로는 서류 이름인 줄만 잇는다.
     ⑤ 빈 줄은 보이지 않는 글자(U+200B 등)를 지운 뒤에 센다. */
const INVISIBLE = /[​-‍⁠﻿]/g;
/* 줄 앞의 기호·번호를 뗀다(머리 판정용) — 어떤 기호든(※ | ◤ < 「 ✅ …) · 로마 숫자 · 1. 1) (1) ① 가. */
const OPEN = '\\[(（【〔<〈「『';
const LEAD = new RegExp(`^[^\\p{L}\\p{N}${OPEN}]*(?:(?:[IVX]{1,4}|[Ⅰ-Ⅻⅰ-ⅻ])(?:\\s*[.)\\]】〕]|\\s+)|(?:\\d{1,2}|[①-⑳]|[가-하])\\s*[.)\\]】〕])?\\s*[^\\p{L}\\p{N}${OPEN}]*`, 'u');
const stripLead = (l) => String(l).replace(LEAD, '').trim();
const BRACKETS = /[\[(（【〔<〈「『][^\])）】〕>〉」』]*[\])）】〕>〉」』]/g;
/* 이름표 줄인가 — 줄이 **이름표로 시작**한다(앞에 붙는 꾸밈말은 열 글자까지 · 「주요」「대학생 주요」「교내장학금 종류 및」).
   이름표 바로 뒤에 토씨가 붙으면 문장이다(「제출서류에 서명/ 날인 필수」「제출서류는 무효 처리함」「제출 서류명(신청자 이름)」).
   줄 전체가 괄호 하나면 벗긴다(「[필수 제출서류]」「<제출서류>」「○ (제출서류)」). */
export function isDocHeadLabel(l) {
  let bare = stripLead(l);
  const one = bare.match(/^[\[(（【〔<〈「『]\s*([^\])）】〕>〉」』]*)\s*[\])）】〕>〉」』]$/);
  if (one) bare = stripLead(one[1]);
  /* 표가 무너진 OCR 줄 「지원자격 : 구비서류」 — 콜론 뒤가 이름표뿐이면 머리다 */
  const lastSeg = bare.split(/[:：]/).pop().replace(/\s/g, '');
  if (/[:：]/.test(bare) && /^(제출(할)?|구비|신청|필요|첨부|접수)서류$/.test(lastSeg)) return true;
  const x = bare.replace(BRACKETS, ' ').replace(/\s+/g, ' ').trim();
  const m = x.match(/^(.{0,14}?)(제출\s*(?:할\s*)?서\s*류|구\s*비\s*서\s*류|신청\s*서\s*류|접수\s*서\s*류|필요\s*서\s*류|첨부\s*서\s*류)(.*)$/);
  if (!m) return false;
  const pre = m[1].replace(/\s/g, ''); const post = m[3];
  if (pre && (!/^[가-힣·]{1,10}$/.test(pre) || /[은는이가을를에의도로와과]$/.test(pre))) return false;
  if (/^\s*(에|은|는|이|가|을|를|의|도|로|와|과|명|만|이나)/.test(post) && !/^\s*(이하|이력)/.test(post)) return false;
  return true;
}
/* 줄 앞머리의 단계 — 같은 단계를 다시 만나야 절이 바뀐다(숫자는 값까지: 6. 아래 1) 은 하위, 7. 이 다음 절) */
function leadMark(l) {
  const x = String(l);
  let m = x.match(/^\s*[\[(【〔]?\s*(\d{1,2})\s*[.)\]】〕]/); if (m) return { kind: /^\s*[\[(【〔]/.test(x) ? 'pnum' : (/^\s*\d{1,2}\s*\)/.test(x) ? 'rnum' : 'num'), n: Number(m[1]) };
  if (/^\s*[가-하]\s*[.)]/.test(x)) return { kind: 'kor', n: 0 };
  if (/^\s*[①-⑳]/.test(x)) return { kind: 'circ', n: 0 };
  if (/^\s*(?:[IVX]{1,4}|[Ⅰ-Ⅻ])\s*[.)]/.test(x)) return { kind: 'rom', n: 0 };
  m = x.match(/^\s*([□■○●◆◇▣◤◈▶▷►◎ㅇ•▪*※-])/); if (m) return { kind: 'sym' + m[1], n: 0 };
  return { kind: '', n: 0 };
}
const sameStep = (head, mk) => !!head.kind && mk.kind === head.kind && (!/num$/.test(mk.kind) || mk.n > head.n);
/* …사항·비고 머리(짧은 줄) — 「지원자 유의사항」「서류 제출 시 유의사항」「참고사항」「비 고」 */
const NOTE_HEAD = (bare) => {
  const n = bare.replace(/\s/g, '').length;
  if (n <= 30 && /(유의|주의|참고|안내|기타)\s*사\s*항\s*[:：]?\s*$/.test(bare)) return true;   // 「■ 신청서 작성법 및 유의사항」 — 서류 낱말이 있어도 절 머리다
  return n <= 20 && /(확인\s*사\s*항|비\s*고)\s*[:：]?\s*$/.test(bare) && !DOC_NOUN.test(bare);
};

function listFrom(lines, start, inline, headMark) {
  const out = [];
  const push = (s) => { for (const p of splitInline(s)) { const c = cleanDoc(p); if (c.length >= 2 && c.length <= 80 && isDocLike(c) && !out.includes(c)) out.push(c); } };
  if (inline) push(inline);
  const inlineHit = out.length > 0;   // ④ 한 줄 목록이 실제로 서류를 냈을 때만 '아래는 서류 이름만' — 「6. 신청서류 : 각 학과 사무실로 원본 제출」 아래 표는 그대로 읽는다
  let blanks = 0;
  for (let i = start + 1; i < lines.length && out.length < MAX_DOCS; i += 1) {
    const l = lines[i];
    if (!l) { blanks += 1; if (blanks >= 2 && out.length) break; continue; }
    blanks = 0;
    const bare = stripLead(l);
    if (NEXT_HEAD.test(l) && !DOC_WORD.test(l.replace(NEXT_HEAD, '').slice(0, 2))) break;   // 다음 절
    if (NEXT_HEAD_BARE.test(bare) && !DOC_WORD.test(bare.replace(NEXT_HEAD_BARE, '').slice(0, 2))) break;   // ③ 기호를 뗀 다음 절 머리
    if (NOTE_HEAD(bare)) { if (out.length) break; continue; }                                 // ③ …사항·비고 (머리 바로 아래 표 머리면 건너뛴다)
    if (isDocHeadLabel(l)) continue;                                                         // 또 다른 서류 머리(우대 증빙 표 뒤의 본 목록 등) — 이어 읽는다
    if (sameStep(headMark, leadMark(l)) && !DOC_NOUN.test(bare)) break;                     // ② 같은 단계의 새 절
    if (l.length > 120) break;                                                                 // 문단 — 목록이 아니다
    if (/^(※|\*|☞|▶|⇒)/.test(l)) continue;                                                   // 주석·지시 줄은 서류가 아니다
    if (!DOC_WORD.test(l) && cleanDoc(l).length > 30) break;                                   // 서류 낱말이 없는 긴 줄 — 목록이 끝났다
    if (inlineHit && !DOC_NOUN.test(bare)) break;                                             // ④ 한 줄 목록 아래는 서류 이름만
    push(l);
  }
  /* 「원문 공고에서 확인」 같은 안내 줄은 서류가 아니다 */
  return out.filter((d) => !/(원문\s*공고|공고문|홈페이지)(에서|를)?\s*(확인|참고)/.test(d));
}

/** 원문 글자 → 제출 서류 이름들 (원문 글자 그대로 · 없으면 []) */
export function extractDocumentList(text) {
  const lines = String(text || '').split(/\n/).map((l) => l.replace(INVISIBLE, '').trim());
  for (let i = 0; i < lines.length; i += 1) {
    const l = lines[i];
    if (!l || l.length > 80 || !DOC_HEAD.test(l) || !isDocHeadLabel(l)) continue;   // ① 이름표 줄만
    /* 「제출서류 : 신청서 1부, 성적증명서 1부」 처럼 머리줄에 바로 붙은 목록 */
    const m = l.match(/^(.*?(제출\s*(할\s*)?서류|구비\s*서류|신청\s*서류|접수\s*서류|필요\s*서류|첨부\s*서류)[^:：]*)[:：]\s*(.+)$/);
    const inline = (m && m[4] && m[4].length >= 4 && !/^(아래|하단|다음|별첨|첨부\s*참)/.test(m[4])) ? m[4] : null;
    const got = listFrom(lines, i, inline, leadMark(l));
    /* 목록의 절반 이상은 서류 명사(증명서·신청서·사본·등본·계획서…)여야 목록이다 — 무너진 OCR 표의 칸 머리 「제출 서류」 아래 조각들을 서류로 내지 않는다 */
    const nouns = got.filter((d) => DOC_NOUN.test(d)).length;
    if (nouns && (nouns * 2 >= got.length || nouns >= 3)) return got;   // 못 건지면 다음 머리 후보로
  }
  return [];
}

/* 지정 양식을 말하는 낱말 — 이 말이 든 줄은 '자유 양식'이 아니다(「자기소개서(소정 양식) … 추천서는 자유 양식」 처럼 섞인 줄도 근거가 아니다) */
const FIXED_FORM = /소정\s*(양식|서식)|별지|지정\s*(양식|서식)|첨부\s*(양식|서식)|재단\s*(양식|서식)|제\s*\d+\s*호\s*서식/;
/** 자유 양식 근거 — **그 줄 자체가** 작성형 서류 이름과 자유 양식을 함께 말할 때만 그 문장(원문 글자 · 300자 상한). 없으면 null.
    🔴 서류 목록에 작성형 서류가 있다는 것만으로 다른 줄의 '자유 양식'을 빌려 오지 않는다(리뷰 2026-10-13 — 추천서가 자유 양식인데 자기소개서를 그대로 내라고 말했다). */
export function freeFormBasis(text) {
  const lines = String(text || '').split(/\n/).map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
  for (const l of lines) {
    if (!FREE_FORM.test(l) || l.length > 300) continue;
    if (!WRITE_DOC.test(l) || FIXED_FORM.test(l)) continue;
    /* 자유 양식이 추천서(남이 쓴다)에만 붙은 줄은 학생 문서의 근거가 아니다 */
    if (/추천서/.test(l) && !/자기소개서|자소서|계획서|사유서|지원\s*동기|에세이|포부/.test(l)) continue;
    return l;
  }
  return null;
}

/** 둘을 한 번에 — 발췌기가 부르는 꼴 */
export function readDocuments(text) {
  const docs = extractDocumentList(text);
  const basis = freeFormBasis(text);
  return { docs, basis, free: !!basis };
}

/* 자리표시 안내 줄(자동 등록·층2) — 이것만 든 목록은 '비어 있는 것'이다 */
export const DOC_PLACEHOLDER = /(원문\s*공고|공고문)(에서)?\s*확인/;
/* 자동 등록이 두는 자리표시 한 줄 — 로봇이 옛 목록을 되돌릴 때 같은 글자를 쓴다(extract-excerpts fillDocuments) */
export const DOC_PLACEHOLDER_LINE = '지원 자격·제출 서류는 원문 공고에서 확인';
export const placeholderOnly = (docs) => !(docs || []).some((d) => !DOC_PLACEHOLDER.test(String(d || '')));

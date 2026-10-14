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
const BULLET = /^[\s\-–—•▪▶▷◆◇○●■□▣★♦⇒‡◦∙❍◎￭·ㆍ*ㅇ]+|^\s*[\[(【〔]?\s*(?:[\d①-⑳]+|[가나다라마바사아자차카타파하])\s*[.)\]】〕]\s*/;
const DOC_WORD = /서|증명|사본|원본|통장|신분증|사진|등본|확인|계획|추천|동의|지원|신청|소개|이력|포트폴리오|성적|재학|졸업|가족|소득|수급/;
export const WRITE_DOC = /자기소개서|자소서|학업계획서|수학계획서|연구계획서|활동계획서|사유서|지원\s*동기|에세이|포부|소개서|계획서/;
export const FREE_FORM = /자유\s*(양식|서식|형식)|별도\s*(의\s*)?(양식|서식)(은|이)?\s*(없|무)|(양식|서식)\s*(은|이)?\s*(없음|없습니다|무)|서식\s*자유|자유롭게\s*작성|양식\s*자유|형식\s*자유/;
const MAX_DOCS = 14;
/* 서류가 아닌 줄 — 전화·주소·날짜·지시문(…하세요·…제출·…금지) · 꼬리 괄호를 떼고 본다 */
const NOT_DOC = /☎|https?:\/\/|www\.|\d{2,4}-\d{3,4}-\d{4}|(기일|기간|마감|선정|지급|발표|통보)\s*[:：]|^\d{1,2}\/\d{1,2}|^\d{4}\s*[.년]/;
const INSTRUCTION_END = /(합니다|하세요|하시기\s*바랍니다|바람|할\s*것|필요|금지|제출|참조|참고|확인)\s*$/;
/* 소제목(「필수 제출 서류」「추가 제출 가능 서류 (…)」「지원 분야별 필수 제출 자료」) — 서류 이름이 아니다: 서류·자료로 끝나고 구체적인 서류 낱말이 없다 */
const DOC_NOUN = /증명|증빙|사본|원본|신청서|지원서|원서|확인서|동의서|추천서|계획서|소개서|사유서|서약서|통장|등본|초본|신분증|사진|성적표|통지서|이력서|포트폴리오|증$/;
const isSubHead = (c) => { const bare = (/^[\[(【〔]/.test(c) && /[\])】〕]$/.test(c)) ? c.slice(1, -1).trim() : c; const core = bare.replace(/\s*[\[(【〔][^\])】〕]*[\])】〕]\s*$/, '').trim(); return /(서류|자료)$/.test(core) && !DOC_NOUN.test(core); };
const isDocLike = (c) => {
  if (!DOC_WORD.test(c)) return false;
  if (c.replace(/\s/g, '').length < 4) return false;
  if (/^[(（]/.test(c)) return false;                                   // 괄호로 시작하는 줄은 앞 서류의 설명이다
  if (HEAD_ONLY.test(c) || FILE_NOTE.test(c) || isSubHead(c)) return false;
  if (NOT_DOC.test(c)) return false;
  const core = c.replace(/\s*[\[(【〔][^\])】〕]*[\])】〕]\s*$/, '').trim();   // 꼬리 괄호(「(샘플 참고하여 작성)」)는 설명이다
  if (INSTRUCTION_END.test(core)) return false;
  return true;
};

function cleanDoc(line) {
  return decodeEntities(String(line || '')).replace(BULLET, '').replace(/\s+/g, ' ').replace(/[,;、]\s*$/, '').trim();
}
/* 절 머리 자체·표 머리(「구 비 서 류」)·너무 짧은 조각(OCR 「서재다」)·파일 이름 안내는 서류가 아니다 */
const HEAD_ONLY = /^(제출\s*(할\s*)?|구비|신청|필요|첨부|기본|전형별|신청자)?\s*서\s*류\s*(목록)?$/;
const FILE_NOTE = /파일\s*(제목|명)|파일명/;
/* 한 줄에 여러 서류가 쉼표·가운뎃점으로 붙어 있으면 가른다 — 조각마다 서류 낱말이 있을 때만(문장을 토막 내지 않는다) */
function splitInline(s) {
  if (!/[,，·]/.test(s) || s.length > 120) return [s];
  const parts = s.split(/\s*[,，·]\s*/).map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2 || !parts.every((p) => p.length <= 40 && DOC_WORD.test(p))) return [s];
  return parts;
}

/** 원문 글자 → 제출 서류 이름들 (원문 글자 그대로 · 없으면 []) */
export function extractDocumentList(text) {
  const lines = String(text || '').split(/\n/).map((l) => l.trim());
  let start = -1; let inline = null;
  for (let i = 0; i < lines.length; i += 1) {
    const l = lines[i];
    if (!l || l.length > 80 || !DOC_HEAD.test(l)) continue;
    /* 「제출서류 : 신청서 1부, 성적증명서 1부」 처럼 머리줄에 바로 붙은 목록 */
    const m = l.match(/^(.*?(제출\s*(할\s*)?서류|구비\s*서류|신청\s*서류|접수\s*서류|필요\s*서류|첨부\s*서류)[^:：]*)[:：]\s*(.+)$/);
    if (m && m[4] && m[4].length >= 4 && !/^(아래|하단|다음|별첨|첨부\s*참)/.test(m[4])) inline = m[4];
    start = i; break;
  }
  if (start < 0) return [];
  const out = [];
  const push = (s) => { for (const p of splitInline(s)) { const c = cleanDoc(p); if (c.length >= 2 && c.length <= 80 && isDocLike(c) && !out.includes(c)) out.push(c); } };
  if (inline) push(inline);
  let blanks = 0;
  for (let i = start + 1; i < lines.length && out.length < MAX_DOCS; i += 1) {
    const l = lines[i];
    if (!l) { blanks += 1; if (blanks >= 2 && out.length) break; continue; }
    blanks = 0;
    if (NEXT_HEAD.test(l) && !DOC_WORD.test(l.replace(NEXT_HEAD, '').slice(0, 2))) break;   // 다음 절
    if (l.length > 120) break;                                                                 // 문단 — 목록이 아니다
    if (/^(※|\*|☞|▶|⇒)/.test(l)) continue;                                                   // 주석·지시 줄은 서류가 아니다
    if (!DOC_WORD.test(l) && cleanDoc(l).length > 30) break;                                   // 서류 낱말이 없는 긴 줄 — 목록이 끝났다
    push(l);
  }
  /* 「원문 공고에서 확인」 같은 안내 줄은 서류가 아니다 */
  return out.filter((d) => !/(원문\s*공고|공고문|홈페이지)(에서|를)?\s*(확인|참고)/.test(d));
}

/** 자유 양식 근거 — 작성형 서류가 있고 그 문장이 자유 양식을 말할 때만 그 문장(원문 글자 · 300자 상한). 없으면 null */
export function freeFormBasis(text, docs = []) {
  const hasWrite = (docs || []).some((d) => WRITE_DOC.test(d));
  const lines = String(text || '').split(/\n/).map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
  for (const l of lines) {
    if (!FREE_FORM.test(l)) continue;
    if (l.length > 300) continue;
    /* 그 줄 자체가 작성형 서류를 말하거나, 서류 목록에 작성형 서류가 있어야 한다 */
    if (WRITE_DOC.test(l) || hasWrite) return l;
  }
  return null;
}

/** 둘을 한 번에 — 발췌기가 부르는 꼴 */
export function readDocuments(text) {
  const docs = extractDocumentList(text);
  const basis = freeFormBasis(text, docs);
  return { docs, basis, free: !!basis };
}

/* 자리표시 안내 줄(자동 등록·층2) — 이것만 든 목록은 '비어 있는 것'이다 */
export const DOC_PLACEHOLDER = /(원문\s*공고|공고문)(에서)?\s*확인/;
export const placeholderOnly = (docs) => !(docs || []).some((d) => !DOC_PLACEHOLDER.test(String(d || '')));

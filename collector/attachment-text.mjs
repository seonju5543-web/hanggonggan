/* ============================================================
   첨부 파일에서 글자 뽑기 + '이게 공고문인가' 판정 (2026-08-20 신설)

   왜 따로 만들었나 — 같은 일을 하는 코드가 `schematize-forms.mjs` 안에 있는데,
   **그 파일은 불러오는 순간 스키마화가 통째로 실행된다**(이 저장소의 알려진 함정).
   그래서 가져다 쓸 수가 없어 순수 함수만 여기로 뺐다. 베끼지 말고 이걸 부를 것.

   🔴 **공고문만 읽는다.** 2026-08-20에 첨부를 가리지 않고 읽었다가 되돌린 적이 있다:
   미확보 공고의 첨부는 대개 **학생이 채우는 신청서·동의서**라, 거기서 '자격'을 뽑으면
   `수집·이용할 항목 / 성명, 주민등록번호 …` 같은 **개인정보 동의서 문구**가
   지원 자격 자리에 앉는다(실제로 3건이 그렇게 됐다). 신청서에는 자격이 없다 —
   자격은 공고문에 있다.

   실측(2026-08-20, 미확보 69건의 공고문 첨부 10개 전수):
     PDF 5개 중 글자가 나온 것 1개(나머지는 CID 폰트·스캔) · DOCX 2개 다 나옴 ·
     HWP 1개 나옴. 그중 자격 절이 실제로 있던 것은 **2건**.
     → 지금 수확은 작지만 공고는 매일 들어오므로 계속 값을 낸다.
     → 글자가 안 나오는 스캔 PDF는 무료로는 방법이 없다. 그건 AI 경로의 몫이다
       (`eligibility-ai.mjs` — 원본을 그림째 읽는다).
   ============================================================ */
import fs from 'node:fs';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { pdfText } from './pdf-text.mjs';

/* 학생이 '채우는' 문서가 아니라 '읽는' 문서인가.
   ⚠️ 이름에 신청서·서식이 들어가면 공고문이 아니다 — 자격이 아니라 빈칸이 들어 있다. */
const FORMISH = /서식|양식|신청서|지원서|선발원서|동의서|서약서|추천서|계획서|증명|이력서|환산/;
const NOTICEISH = /공고|안내|계획|모집|선발|요강|기준/;
/* 🔴 이름에 서식 낱말이 섞여도 **공고문인 것이 분명한 꼴**(2026-11-15 · 1단계 B3): `사업계획서 및 업무처리기준.pdf`(푸른등대 — 본문이 '사업별 지원기준 상이'라 이 PDF 가 자격의 원문)
   · `선발 공고문(신청서 포함).hwpx` · `장학생 선발계획`. `계획서` 하나로 신청서류에 밀려 자격 경로가 한 번도 안 읽었다(마감 전 첨부 9개). 서식 쪽은 annexCut 이 자른다. */
const NOTICE_STRONG = /공고문|요강|선발\s?계획|시행\s?계획|지원\s?계획|업무\s?처리\s?기준|사업\s?계획서|(?:모집|선발)\s?공고/;
/* 🔴 「공고문(신청서 포함)」 처럼 **공고문에 신청서가 붙은 한 파일**은 공고문이다 (2026-11-15 · 대전 서구인재육성장학재단 「붙임1. 2026년 장학생 선발
   공고문(신청서 포함).hwpx」 — 접수기간·신청마감이 그 파일에만 있는데 이름 속 '신청서' 때문에 영영 안 읽혔다). 괄호 속 「…포함」 만 걷고 다시 본다 —
   맨 「장학금 신청서.hwp」 는 그대로 서식이다(빈칸뿐인 파일을 공고문으로 읽으면 개인정보 동의 문구가 자격이 된다 · 위 머리말).
   뒤에 붙은 서식의 견본 날짜는 발췌기의 annexCut 이 자른다. */
const WITH_FORM = /\s*[(（\[]\s*[^)）\]]{0,20}포함\s*[)）\]]/g;
export const isNoticeDoc = (name) => {
  const n = String(name || '');
  if (NOTICE_STRONG.test(n)) return true;
  return NOTICEISH.test(n) && !FORMISH.test(n.replace(WITH_FORM, ''));
};

/* ============================================================================
   첨부의 **내용**으로 가르기 — 신청서(학생이 채우는 서식)인가, 공고문(읽는 글)인가 (2026-11-20 개발자 지시)
   지시: *"원문 글 안의 문서·이미지·파일 전부를 읽고 공고 카드(지원자격 등)에 들어가야 되는지 신청 양식 칸에 들어가야 되는지 구분"*.
   🔴 왜 — 이름만 보고 갈랐다(isNoticeDoc · data.js isApplicationForm). 실측(2026-11-20 · 마감 전 등록 64건의 첨부):
      `[서식] 1~3.hwp`·`★붙임2_공적활동확인서.hwp` 는 빈칸·서명란뿐인 진짜 서식인데 이름에 '신청서'가 없어 앱 양식 칸에 없었고,
      `…특별장학금 신청서.hwp` 꼴이라도 속이 안내문이면 양식 칸에 앉았으며, 이름이 애매한 공고문은 카드 자격으로 안 읽혔다.
   무엇을 — 글자에서 **서식 표식**(「위와 같이 신청합니다」·(인/서명)·귀하·빈 날짜·빈칸 이름표·체크 칸)과
      **공고문 표식**(지원자격·신청기간·선발인원 같은 절 머리 · 「…공고합니다」)을 따로 센다.
   돌려주는 것 — 'form'(서식만) · 'notice'(공고문만) · 'mixed'(공고문 뒤에 서식이 붙은 한 파일) · null(글자가 없거나 표식이 모자라 모름).
   🔴 null 이면 **이름 규칙이 그대로** 정한다(글자를 못 읽은 파일을 내용으로 판정했다고 하지 않는다 · 원칙 5).
   🔴 쓰는 곳은 attachDecision 한 곳을 거친다 — 양식 PDF 로봇(form-pdf)·공고문 고르기(noticeDocFiles)·앱 양식 칸(forms-pdf 색인 roles)이 같은 답을 본다.
   ============================================================================ */
const ROLE_LABELS = /^(성\s*명|이\s*름|학\s*번|생\s*년\s*월\s*일|연\s*락\s*처|휴\s*대\s*폰|전\s*화(번호)?|주\s*소|소\s*속|학\s*과|학\s*부|전\s*공|학\s*년|계\s*좌(번호)?|이\s*메\s*일|e-?mail|주민등록번호|성\s*별|국\s*적|학\s*적\s*상\s*태)\s*[:：]?$/i;
const ROLE_NOTICE_HEADS = [
  /(지원|신청|응모|참가)\s*자격|자격\s*요건/, /(선발|지원|신청|모집|추천)\s*대상/, /(선발|모집|지원)\s*인원/,
  /(선발|심사)\s*(기준|방법|절차)/, /(신청|접수|모집|제출)\s*(기간|기한|일정)/, /(신청|접수|제출)\s*방법/,
  /(제출|구비)\s*서류/, /(지원|장학|지급)\s*(금액|내용|규모)|장학금액/, /유의\s*사항/, /문의\s*처?/,   // 「기타사항」「담당부서」는 서식 칸 이름으로도 흔해 뺀다(리뷰)
  /(결과|합격자?)\s*발표|추진\s*일정/,
];
/* 서명란 줄의 「(인)」 이 기관장 직인 줄이면 서식 표식이 아니다(form-pages STRONG 과 같은 직함 목록) */
const ROLE_OFFICIAL = /이사장|총장|회장|원장|대표|장관|시장|군수|구청장|교육감|센터장|학장|처장|단장|위원장|조합장|재단장|사장/;
export function docRoleSignals(text) {
  /* HWP 미리보기(.txt)는 표 칸을 `<칸><칸>` 으로 잇는다 — 칸마다 한 줄로 편다(본문 .body.txt 와 같은 꼴) */
  const lines = String(text || '').replace(/></g, '\n').replace(/[<>]/g, '\n').split(/\n|\f/).map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const t = lines.join('\n');
  let form = 0;
  if (/위와\s*같이[^\n]{0,30}(신청|지원|추천|동의|서약|확인|제출)[^\n]{0,6}(합니다|함|하오니|하고자)/.test(t)) form += 2;
  if (lines.some((l) => /\(\s*(인|서명|날인|인\s*[\/·]\s*서명|서명\s*[\/·]\s*인|서명\s*또는\s*인)\s*\)|서명\s*\(\s*인\s*\)/.test(l) && !ROLE_OFFICIAL.test(l))) form += 2;
  if (/귀\s*하\s*$/m.test(t)) form += 1;
  if (/(?:20\d{0,2})?\s*년\s{1,}월\s{1,}일|\b20\s+년\s+\d{0,2}\s*월/.test(t)) form += 1;
  const labels = new Set(lines.filter((l) => l.length <= 14 && ROLE_LABELS.test(l)).map((l) => l.replace(/\s|[:：]/g, '')));
  form += labels.size >= 4 ? 2 : labels.size >= 2 ? 1 : 0;
  if ((t.match(/[□☐]/g) || []).length >= 2) form += 1;
  if (/동의\s*(함|합니다|하십니까)[^\n]{0,6}[□☐(]|[□☐]\s*동의/.test(t)) form += 1;
  /* 첫머리 제목 줄이 서식 이름(「복지장학금 신청서」) — 인적사항 칸이 없는 익명 심사 서식도 있다(2026-11-20 · 복지장학금 신청서류 실측) */
  if (lines.slice(0, 3).some((l) => l.length <= 30 && /(신\s*청\s*서|지\s*원\s*서|원\s*서|동\s*의\s*서|서\s*약\s*서|확\s*인\s*서|자\s*기\s*소\s*개\s*서|계\s*획\s*서|사\s*유\s*서)\s*\)?\s*$/.test(l))) form += 2;
  /* 공고문 표식 — 줄 머리에 온 절 이름만 센다(번호·기호 머리 허용 · 「1. 신청자격 : 재학생」 처럼 내용이 붙어도) · 서식에도 「제출서류」 한 줄쯤은 있다 */
  /* 번호 머리는 한 글자 가·나·다 / 숫자 / 로마 숫자 / 동그라미 숫자만 뗀다(「기타·문의처」의 「기타·」 를 떼지 않는다 · 리뷰) */
  const heads = lines.filter((l) => l.length <= 160).map((l) => l.replace(/^\s*(?:(?:\d{1,3}|[가-하]|[ⅠⅡⅢⅣⅤ])\s*[.)）]\s*|[(（](?:\d{1,2}|[가-하])[)）]\s*|[①-⑳]\s*)?[■□○●◎▶▷◆◇※∘ㅇ\-]?\s*/, ''));
  /* 🔴 `^(?:…)` 로 **갈래 전체**를 줄 머리에 묶는다 — `^a|b` 는 b 를 줄 어디서나 찾아 서식의 「기타사항」·「장학금액」 칸을 공고문 표식으로 셌다(리뷰) */
  const notice = ROLE_NOTICE_HEADS.filter((re) => heads.some((h) => new RegExp(`^(?:${re.source})`).test(h))).length
    + (/(공고|안내|모집|선발)\s*(합니다|하오니)|알려\s*드립니다|다음과\s*같이\s*(선발|모집|공고|안내)/.test(t) ? 1 : 0);
  const hangul = t.replace(/[^가-힣]/g, '').length;
  return { form, notice, hangul };
}
export function docRole(text, sig = docRoleSignals(text)) {
  const { form, notice, hangul } = sig;
  if (hangul < 40) return null;
  /* 절 머리가 셋 이상이면 서식 표식이 많아도 공고문이 든 파일이다 — 정부 공고문은 □ 머리·인적사항 표가 있어 서식 쪽 점수가 붙는다(리뷰) */
  if (form >= 3 && notice >= 3) return 'mixed';
  if (form >= 3) return 'form';
  if (notice >= 3 && form <= 1) return 'notice';
  if (notice >= 2 && form === 0) return 'notice';
  return null;
}
/* 판정에 쓰는 글자 — 원문 글자(HWP·HWPX·DOCX·OCR)가 먼저 · 없으면 PDF 글자층(자격 줄엔 안 쓰지만 서식/공고 가르기엔 숫자가 필요 없다) */
const roleMemo = new Map();   // 같은 실행 안에서 같은 파일을 여러 번 읽지 않는다(발췌기는 공고마다 이 색인을 2~3번 훑는다 · 리뷰 실측 공고 하나 0.2초)
export const roleText = (filePath) => {
  if (!roleMemo.has(filePath)) roleMemo.set(filePath, attachmentText(filePath) || pdfLayerText(filePath));
  return roleMemo.get(filePath);
};

/* 학생이 아니라 남(교수·학과장)이 쓰거나 선발 **뒤에** 내는 서식 — 내용이 서식이어도 신청서 칸에 두지 않는다(data.js isApplicationForm 과 같은 선) */
const NOT_STUDENT_FORM = (n) => /추천서|보고서|영수증|점검표|수료\s*확인서/.test(n) && !/자기소개서|(신청서|지원서)\s*(및|와|과|[,·&+])\s*(장학생\s*)?추천서/.test(n);

/** 첨부 하나의 행선지 — { form: 앱 신청서 칸에 둔다, notice: 카드(자격·마감·서류)를 읽는 데 쓴다, role, by: 'ai'|'content'|'paid'|'name' }
    name = 첨부 이름 · text = 그 파일 글자(roleText) · nameForm = 이름 규칙(data.js isApplicationForm · PDF 꼴)
    aiRole = AI(4번 카드 읽기 · 6번 최종 검토)가 그 파일에 정한 갈래 — 'notice'|'form'|'mixed'|'other'(collector/attach-role-ai.mjs toDecisionRole) · 부르는 쪽이 찾아서 넘긴다 */
export function attachDecision(name, text, nameForm, paidRole = null, aiRole = null) {
  const n = String(name || '');
  /* 🔴 AI 가 답한 파일은 그 답이 갈래다 (2026-11-21 개발자 지시 — *"(첨부 구분은) 기계검사가 아니라 지능이 있는 ai 가 해야해"*) — 글자 표식·유료 첨부 판정·이름 규칙으로 뒤집지 않는다.
     추천서처럼 남이 쓰는 서식을 거르는 것도 AI 의 몫이다(card-read ATTACH_RULES — 그런 파일은 content 로 답한다) · other 는 어느 쪽도 아니다.
     🔴 붙은 문서(mixed)의 행선지는 글자 표식으로 가른 붙은 문서와 **같다**(아래 mixed 줄 · 2026-11-22): 카드는 읽고, 신청서 칸에는 이름이 신청서일 때만 통째로 선다 —
        그 파일의 서식 쪽은 form-pages 가 따로 떼지만, 쪽을 못 떼거나 뗀 사본이 내려가도 이름이 신청서인 파일은 신청서 칸을 잃지 않는다.
        이름이 신청서가 아닌 붙은 문서만 PDF 둘로 갈린다(읽는 글 쪽 = doc-pdf · 서식 쪽 = form-pages)
     🔴 이름이 신청서인 파일의 other 는 답이 없는 것으로 본다(리뷰 2026-11-23) — other 는 「뽑은 글자가 깨졌거나 비었다」는 뜻이기도 하다(글자에 대한 말이지 파일에 대한 말이 아니다).
        그 말로 신청서 칸을 빼앗지 않는다 — 아래 예전 길(글자 표식 → 유료 첨부 판정 → 이름 규칙)이 정한다. 이름이 신청서가 아닌 파일에는 other 가 그대로 이긴다 */
  if (aiRole === 'mixed') return { form: !!nameForm && !NOT_STUDENT_FORM(n), notice: true, role: 'mixed', by: 'ai' };
  if (['notice', 'form'].includes(aiRole) || (aiRole === 'other' && !nameForm)) return { form: aiRole === 'form', notice: aiRole === 'notice', role: aiRole, by: 'ai' };
  const sig = docRoleSignals(text);
  let role = docRole(text, sig);
  /* 글자로 못 가른 파일(스캔 PDF·그림)만 — 유료 첨부 판정(모델 둘이 같은 답 · collector/attach-role-read.mjs)의 답을 쓴다. 글자로 가른 것은 그대로(무료 길이 먼저) */
  let by = 'content';
  if (role === null && ['form', 'notice', 'mixed'].includes(paidRole)) { role = paidRole; by = 'paid'; }
  /* 이름이 공고문(공고문·요강·선발계획·업무처리기준)인데 속에 서식 표식이 있으면 **뒷장에 서식이 붙은 공고문**으로 본다 —
     통째로 신청서 칸에 올리면 공고문 전체가 '원본 양식'으로 보인다(운영지침·업무처리기준 실측). 서식 쪽은 form-pages 가 뗀다 */
  if (role === 'form' && !nameForm && (isNoticeDoc(n) || /지침|규정/.test(n))) role = 'mixed';
  /* 이름이 신청서인데 공고문 표식이 많아도 서식 표식이 하나라도 있으면 둘 다 든 한 파일이다(「선발 공지문 및 학업계획서 양식.hwpx」) */
  if (role === 'notice' && nameForm && sig.form >= 1) role = 'mixed';
  if (role === 'form') return { form: !NOT_STUDENT_FORM(n), notice: false, role, by };
  if (role === 'notice') return { form: false, notice: true, role, by };
  /* 공고문에 서식이 붙은 한 파일 — 카드는 늘 읽는다(뒷장 서식의 견본 날짜는 발췌기 annexCut 이 자른다) · 신청서 칸엔 이름이 신청서일 때만
     (아니면 서식 쪽만 form-pages 가 떼어 「공고문 안 신청서 서식」으로 보인다) */
  if (role === 'mixed') return { form: !!nameForm && !NOT_STUDENT_FORM(n), notice: true, role, by };
  return { form: !!nameForm, notice: !nameForm && isNoticeDoc(n), role: null, by: 'name' };
}

/* zip(=docx·hwpx·첨부 묶음) 안을 직접 읽는다 — 바깥 라이브러리 없이.
   항목 이름은 UTF-8 로 읽되 깨지면 EUC-KR 로 다시 읽는다(한글 윈도우가 만든 zip · 2026-10-17 홍익대 묶음 첨부). */
const entryName = (b) => {
  const u = b.toString('utf8');
  if (!u.includes('�')) return u;
  try { return new TextDecoder('euc-kr').decode(b); } catch { return u; }   // ICU 없는 node 면 깨진 이름 그대로(확장자는 ASCII 라 살아 있다)
};
export function unzipEntries(buf) {
  const out = {};
  let end = buf.length - 22;
  while (end >= 0 && buf.readUInt32LE(end) !== 0x06054b50) end -= 1;
  if (end < 0) return out;
  let ptr = buf.readUInt32LE(end + 16);
  const count = buf.readUInt16LE(end + 10);
  for (let i = 0; i < count; i += 1) {
    if (buf.readUInt32LE(ptr) !== 0x02014b50) break;
    const method = buf.readUInt16LE(ptr + 10);
    const sizeC = buf.readUInt32LE(ptr + 20);
    const nameLen = buf.readUInt16LE(ptr + 28);
    const extraLen = buf.readUInt16LE(ptr + 30);
    const commentLen = buf.readUInt16LE(ptr + 32);
    const localOff = buf.readUInt32LE(ptr + 42);
    const name = entryName(buf.slice(ptr + 46, ptr + 46 + nameLen));
    const lNameLen = buf.readUInt16LE(localOff + 26);
    const lExtraLen = buf.readUInt16LE(localOff + 28);
    const dataOff = localOff + 30 + lNameLen + lExtraLen;
    const raw = buf.slice(dataOff, dataOff + sizeC);
    try { out[name] = method === 0 ? raw : zlib.inflateRawSync(raw); } catch { /* 개별 항목 실패는 무시 */ }
    ptr += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

/* 묶음 zip 첨부 안의 **공고문류**(hwp·hwpx·docx·pdf) — zip 자체는 아무도 못 읽으므로 deepfetch 가 이것으로 꺼내 저장한다
   (2026-10-17 · 홍익대 「제주 미래이음 장학금」: 공고문·제출서류 안내가 zip 하나에만 들어 있어 자격을 영영 못 읽었다).
   이름 규칙은 낱개 첨부와 같은 isNoticeDoc(동의서·서식·환산표는 뺀다) · 공고문·선발계획·요강이 먼저 · 최대 4개. */
export function zipNoticeDocs(buf) {
  const out = [];
  for (const [name, data] of Object.entries(unzipEntries(buf))) {
    const base = name.split('/').pop();
    const m = base.match(/\.(hwpx?|docx?|pdf)$/i);
    if (!m || !data || data.length < 1000 || !isNoticeDoc(base)) continue;
    out.push({ name: base, ext: m[1].toLowerCase(), buf: data });
  }
  const rank = (n) => (/공고문|선발\s?계획|요강/.test(n) ? 0 : 1);
  return out.sort((a, b) => rank(a.name) - rank(b.name)).slice(0, 4);
}

/* 🔴 **문단 단위로 이어 붙인다** (2026-08-20 — 안 그래서 숫자가 사라졌다).
   docx·hwpx는 글꼴·굵기가 바뀌는 지점마다 글자를 조각(run)으로 쪼갠다. 그래서
   `4년제 대학교 재학생`이 `4` / `년제 대학교 재학생` 두 조각으로 들어 있다.
   조각마다 줄바꿈을 넣으면 `4`는 짧아서 버려지고 **`년제 대학교 재학생`만 남는다** —
   학생에게 보여 주면 원문보다 나쁜 글이다(PDF를 자격 경로에서 뺀 것과 같은 이유).
   문단(`</w:p>`·`</hp:p>`)에서만 줄을 나누고, 그 안의 조각은 **붙여서** 읽는다. */
const unent = (t) => t.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).replace(/&amp;/g, '&');

/* 문단 태그와 '글자 조각' 태그의 짝 — **여기 한 곳**에만 둔다.
   docx·hwpx 두 갈래가 각자 정규식을 들고 있으면 한쪽만 고쳐져 갈라진다.
   검사도 이 표를 통해 부른다(`xmlDocText`) — 베낀 사본을 검사하면 원본이 바뀌어도 통과한다. */
/* 🔴 여는 태그는 **`>` 로 끝나거나 빈칸 뒤에 속성이 오는 것만** 글자 조각이다.
   `<w:t[^>]*>` 라고 쓰면 이름이 `w:t` 로 시작하는 형제 태그가 전부 걸린다 —
   `<w:tbl>`·`<w:tblPr>`·`<w:tc>`·`<w:tr>`·`<w:trPr>`·`<w:tcW …/>`, hwpx 는
   `<hp:tc>`·`<hp:tbl>`·`<hp:table>`. 그러면 표가 열리는 자리마다 다음 `</w:t>` 까지를
   통째로 삼켜 **XML 속성과 글꼴 이름이 본문이 된다**(저장분 23개에서 찌꺼기 2,583줄).
   장학 공고는 신청기간을 표 안에 적는 일이 많아, 그 줄이 태그에 묻혀 마감일 파서가 못 읽었다.
   관문: verify/test-collector.mjs '첨부 글자 뽑기' ④. */
const RUNS = {
  docx: { para: 'w:p', run: /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/ },
  hwpx: { para: 'hp:p', run: /<hp:t(?:\s[^>]*)?>([\s\S]*?)<\/hp:t>/ },
};

/* XML 한 덩어리에서 글자를 뽑는다 (kind = 'docx' | 'hwpx') */
export function xmlDocText(xml, kind) {
  const r = RUNS[kind];
  if (!r) throw new Error(`모르는 종류: ${kind}`);
  return paraText(String(xml || ''), r.para, r.run);
}

/* 글자 조각 **안에** 들어 있는 서식 기호를 뜻대로 바꾼다 (2026-09-15).
   hwpx 는 고정폭 공백·탭·줄바꿈을 `<hp:t>` 안에 태그로 넣는다 — 그냥 두면
   `2. 접 수 처<hp:fwSpace/>` 처럼 태그가 학생이 읽는 글에 그대로 남는다.
   🔴 **`unent` 보다 먼저** 돌아야 한다. 뒤에 돌리면 글자에 든 `&lt;3년 이상&gt;` 이
      그때는 진짜 부등호라 태그로 보여 통째로 사라진다(원문보다 나쁜 글이 된다). */
const inlineMarks = (raw) => raw
  .replace(/<[a-z]+[0-9]*:lineBreak\b[^>]*\/?>/gi, '\n')
  .replace(/<[a-z]+[0-9]*:(fwSpace|nbSpace|tab)\b[^>]*\/?>/gi, ' ')
  .replace(/<[a-z]+[0-9]*:hyphen\b[^>]*\/?>/gi, '-')
  /* 남은 표시(밑줄 시작·끝 같은 것)는 뜻이 없으니 버린다.
     ⚠️ 딱 하나 예외가 있다 — `<![CDATA[…]]>` 안의 글자는 뜻이 있는데 여기서 사라진다.
        저장분 32개에 0건이고 한글·Word 가 만들지도 않아 실무 위험은 없다고 보고 안 막았다.
        막아야 할 날이 오면 여기다(확인한 사실이라 적어 둔다 — 짐작이 아니다). */
  .replace(/<[^>]*>/g, '');

function paraText(xml, paraTag, runRe) {
  return xml.split(new RegExp(`</${paraTag}>`))
    .map((chunk) => {
      const parts = [];
      let m;
      const re = new RegExp(runRe.source, 'g');
      while ((m = re.exec(chunk))) parts.push(inlineMarks(m[1]));
      return unent(parts.join(''))
        .split('\n').map((l) => l.replace(/[ \t\u00a0]+/g, ' ').trim())
        .filter(Boolean).join('\n');
    })
    .filter(Boolean).join('\n');
}

/* 파일 하나에서 글자를 뽑는다. 못 뽑으면 빈 문자열 — '모른다'는 뜻이다. */
export function attachmentText(filePath) {
  const lower = String(filePath).toLowerCase();
  let buf;
  try { buf = fs.readFileSync(filePath); } catch { return ''; }

  /* 🔴 HWP는 **본문(.body.txt)을 먼저** 본다. 미리보기(.txt)는 한글이 앞부분만 담아 두는 칸이라
     1023자에서 잘린다(2026-08-14 실측: 저장분 91개 중 56개가 그 상태였다).
     순서를 뒤집으면 신청서 뒷부분을 통째로 못 읽는다. 본문 추출은 hwp-bodytext.py가 한다. */
  if (lower.endsWith('.hwp')) {
    for (const ext of ['.body.txt', '.txt']) {
      try { return fs.readFileSync(filePath + ext, 'utf8'); } catch { /* 다음 후보 */ }
    }
    return '';
  }
  if (lower.endsWith('.docx')) {
    const d = unzipEntries(buf)['word/document.xml'];
    return d ? xmlDocText(d.toString('utf8'), 'docx') : '';
  }
  if (lower.endsWith('.hwpx')) {
    const e = unzipEntries(buf);
    return Object.keys(e).filter((k) => /^Contents\/section\d+\.xml$/.test(k)).sort()
      .map((k) => xmlDocText(e[k].toString('utf8'), 'hwpx')).join('\n');
  }
  /* 🔴 **PDF는 자격 경로에서 쓰지 않는다** (2026-08-20 실측으로 결정).
     저장된 공고문 PDF 5개 중 글자가 나온 것은 1개뿐이었고, 그 하나마저
     **숫자가 빠진 채** 나왔다: 원문의 `3년 이상`이 `년이상`으로 뽑혔다.
     `공고일 기준 년이상 거주자`를 지원 자격이라고 보여 주는 것은 원문보다 나쁘다 —
     학생이 자기가 해당되는지 판단하는 글이라 숫자 하나가 결론을 바꾼다(원칙 8-1).
     게다가 한 낱말이 한 줄로 쪼개져 나와 절 구분도 안 된다.
     스캔·CID PDF는 무료로는 방법이 없다 — **AI 경로의 몫**이다(eligibility-ai.mjs가
     원본을 그림째 읽는다). pdfText는 양식 스키마화 쪽에서 계속 쓰므로 함수는 남겨 둔다. */
  if (lower.endsWith('.pdf')) return ocrText(filePath);
  /* 그림 첨부(포스터·스캔)도 같은 길 — 글자층이 없으니 OCR 이 넘겨준 것뿐이다 */
  if (/\.(png|jpe?g|webp|bin)$/.test(lower)) return ocrText(filePath);
  return '';
}

/* 🔴 OCR 로 읽은 글자는 **품질 관문을 넘은 것만** 파일로 남아 있다 (2026-09-17 · collector/ocr-text.py).
   `.ocr.txt` 가 없으면 '못 읽었다'다 — pdf-text.py 의 `.pdf.txt` 는 여기서 **일부러 안 읽는다**
   (위 2026-08-20 결정: 글자층 PDF 는 숫자가 빠진 채 나와 자격 줄이 원문보다 나빠진다.
   OCR 은 픽셀을 읽으므로 그 문제가 없고, 대신 오독을 관문(한글 비율·줄 단위)으로 거른다). */
/* 포스터는 이름표 뒤에 콜론이 없다(`신청대상 대한민국 국적자로 …` · `지원금액 매학기 등록금 전액`) — 발췌기·금액 로봇이 이름표를
   알아보도록 **줄 머리 이름표 뒤에만** 콜론을 둔다(2026-10-17 · 강원대 청년창업어업인 포스터: 자격 줄이 있는데 못 읽었다). */
const OCR_LABEL = /^((?:신청|지원|선발|모집|참가|참여)\s?(?:대상|자격|인원|금액|기간|방법|문의)|접수\s?(?:기간|방법)|문의처?)\s+(?=\S)/gm;
function ocrText(filePath) {
  let t;
  try { t = fs.readFileSync(filePath + '.ocr.txt', 'utf8'); } catch { return ''; }
  return ocrMoneyCheck(ocrPeriodFix(t.replace(OCR_LABEL, '$1 : ')), pdfLayerText(filePath));
}

/* ── OCR 금액 줄의 자릿수 관문 (2026-11-16 · 상명대 근로장학 auto-enoticedoarticleno770333) ─────────────────────────────
   OCR 이 천 단위 쉼표를 `1` 로 읽었다: `6. 장학금액: 11500,000원/인당` ↔ 같은 PDF 글자층 `6. 장학금액: 1,500,000원/인당`.
   금액 로봇은 그것을 1,150만원으로 읽어 카드 금액이 약 7.7배가 될 뻔했다(발췌에도 그 줄이 '그대로' 나갈 뻔했다).
   🔴 **쉼표의 자릿수가 어긋난 금액**(`11500,000` · `1,50,000` · `15000,00` · `1.000,000` · `5.845,264` — 첫 쉼표 앞이 네 자리 이상이거나
      쉼표 뒤 묶음이 세 자리가 아니거나 점과 쉼표가 섞였다)은 OCR 에서 믿지 않는다. 사람이 쓴 원문은 그렇게 적지 않는다 — 오독이다.
   그 줄은 같은 파일의 글자층에서 **같은 줄이라고 확신할 때만** 글자층 줄로 바꾼다(sameMoneyLine — 모두 맞아야 한다):
      ① 이름표(`6. 장학금액 :` · `(인당 지원액)`)가 있고 그 이름표의 줄이 글자층에도 OCR 에도 **하나뿐**이다
      ② 글자층 줄의 금액은 전부 자릿수가 바르다 · 금액 개수와 단위가 같다
      ③ 금액 숫자는 한 글자 차이까지(짧은 쪽이 긴 쪽 안에 차례대로 있다 — 쉼표를 숫자로 읽거나 숫자 하나를 놓친 오독) · OCR 의 멀쩡한 금액은 글자층과 같다
      ④ 금액 밖의 숫자는 하나도 다르지 않고 한글은 거의 같다(0.85)
   못 맞추면 **그 줄을 뺀다** — 금액은 모름(amountValue 0)이고 발췌로도 안 나간다. OCR 품질 관문(ocr-text.py)이 못 믿는 줄을 빼는 것과 같은 길이다.
   🔴 글자층을 통째로 믿는 것은 아니다(2026-08-20 결정 그대로 — 글자층은 숫자가 빠진다) · 이 줄 하나만 두 판독이 맞을 때 바꾼다.
   🔴 OCR 글자에만 건다 — HWP·DOCX·본문은 사람이 친 글자라 이 오독이 없다(저장분에서 본 적 없음).
   여기 한 곳에서 하므로 첨부 글자를 읽는 로봇(발췌기·금액 로봇·카드 읽기·대외활동)이 모두 같은 글자를 본다. */
const MONEY_UNIT = '(천\\s*만\\s*원|백\\s*만\\s*원|만\\s*원|천\\s*원|억|원)';
const MONEY_TOKEN = new RegExp(`(?<![\\d.,])\\d(?:[\\d.,]*\\d)?(?=\\s*${MONEY_UNIT})`, 'g');
export const moneyTokens = (line) => [...String(line || '').matchAll(MONEY_TOKEN)]
  .map((m) => ({ num: m[0], unit: m[1].replace(/\s+/g, ''), digits: m[0].replace(/\D/g, '') }));
/** 쉼표 자릿수가 어긋난 금액 숫자인가 — 쉼표가 없으면(`150만원` · `1.5억`) 판정하지 않는다 */
export const malformedMoney = (num) => String(num).includes(',') && !/^\d{1,3}(?:,\d{3})+$/.test(String(num));
const hasBadMoney = (line) => moneyTokens(line).some((t) => malformedMoney(t.num));
/* 이름표 — 줄 머리의 번호·기호(`6.` `가.` `①` `○` `❍` `-`)를 걷고 `(이름표)` 또는 콜론 앞(15자 안). 띄어쓰기는 OCR 이 흔들어 빼고 비교한다 */
const LEAD_MARK = /^(?:\s*(?:\d{1,2}\s*[.)]|[가-하]\s*[.)]|\(\s*\d{1,2}\s*\)|[①-⑳]|[○●◦▪■□◎❍ㅇ※•·\-–]))+\s*/;
export function moneyLabel(line) {
  const t = String(line || '').replace(LEAD_MARK, '').trim();
  const par = t.match(/^[(（]\s*([가-힣 ]{2,12})\s*[)）]/);
  const lab = par ? par[1] : (() => { const at = t.search(/[:：]/); return at > 0 && at <= 15 ? t.slice(0, at) : ''; })();
  const k = lab.replace(/\s+/g, '');
  return (k.match(/[가-힣]/g) || []).length >= 2 && !/\d/.test(k) ? k : null;
}
const lcs = (a, b) => {
  let prev = new Array(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i += 1) {
    const cur = [0];
    for (let j = 1; j <= b.length; j += 1) cur[j] = a[i - 1] === b[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], cur[j - 1]);
    prev = cur;
  }
  return prev[b.length];
};
const outsideMoney = (line) => String(line || '').replace(MONEY_TOKEN, ' ');
const oneSlip = (a, b) => { const [s, l] = a.length <= b.length ? [a, b] : [b, a]; return l.length - s.length <= 1 && lcs(s, l) === s.length; };
/** OCR 금액 줄과 글자층 줄이 같은 줄인가 (위 머리말 ②③④ · ①은 ocrMoneyCheck 가 본다) */
export function sameMoneyLine(ocrLine, layLine) {
  const mine = moneyTokens(ocrLine), theirs = moneyTokens(layLine);
  if (!theirs.length || mine.length !== theirs.length || theirs.some((t) => malformedMoney(t.num))) return false;   // ②
  for (let i = 0; i < mine.length; i += 1) {
    if (mine[i].unit !== theirs[i].unit) return false;
    if (malformedMoney(mine[i].num) ? !oneSlip(mine[i].digits, theirs[i].digits) : mine[i].digits !== theirs[i].digits) return false;   // ③
  }
  if (outsideMoney(ocrLine).replace(/\D/g, '') !== outsideMoney(layLine).replace(/\D/g, '')) return false;   // ④ 숫자
  const x = outsideMoney(ocrLine).replace(/[^가-힣]/g, ''), y = outsideMoney(layLine).replace(/[^가-힣]/g, '');
  return x.length >= 2 && y.length >= 2 && (2 * lcs(x, y)) / (x.length + y.length) >= 0.85;   // ④ 한글
}
/** OCR 글자에서 자릿수가 어긋난 금액 줄을 글자층 줄로 바꾸거나 뺀다 (layer 가 없으면 빼기만) */
export function ocrMoneyCheck(ocr, layer = '') {
  const lines = String(ocr || '').split('\n');
  if (!lines.some(hasBadMoney)) return String(ocr || '');
  const count = (arr) => { const m = new Map(); for (const l of arr) { const k = moneyLabel(l); if (k) m.set(k, [...(m.get(k) || []), l]); } return m; };
  const lays = count(String(layer || '').replace(OCR_LABEL, '$1 : ').split('\n').map((l) => l.trim()).filter(Boolean));
  const ocrs = count(lines);
  return lines.map((l) => {
    if (!hasBadMoney(l)) return l;
    const k = moneyLabel(l);
    const cand = k ? lays.get(k) || [] : [];
    if (cand.length !== 1 || (ocrs.get(k) || []).length !== 1) return null;   // ①
    return sameMoneyLine(l, cand[0]) ? cand[0] : null;
  }).filter((l) => l !== null).join('\n');
}

/* OCR 이 **기간 줄**에서 흔히 내는 두 오독을 되돌린다 (2026-11-15 · 카드 빈칸 비평).
   ① 날짜와 시각이 붙는다 — `신청 기간 : 10.26~11. 0615:00까지`(경희 공과대학 특성화 장학 포스터 · 원문 `11. 06. 15:00`)
      → `11. 06 15:00` (날짜 읽기의 `(?!\d)` 가 `0615` 를 통째로 거절해 마감이 비었다)
   ② 물결 뒤 `1` 이 괄호로 읽힌다 — `신청기간 : 2026.10.15.(목)~]0.22.(목)`(강원 도전장학금 포스터) → `~10.22.(목)`
   🔴 **기간 줄에서만**(기간·기한·마감·까지가 든 줄) — 다른 줄의 `]0` 은 글자 그대로 둔다(고쳐 읽는 것은 원문 손대기다).
   ②는 달 자리(0·1·2 + 점)일 때만이다 — 끝이 달력에 없는 날이면 날짜 읽기(ymd)가 어차피 버린다. */
const OCR_PERIOD_LINE = /(기\s?간|기\s?한|마\s?감|까지)/;
export function ocrPeriodFix(text) {
  return String(text || '').split('\n').map((l) => (!OCR_PERIOD_LINE.test(l) ? l : l
    .replace(/(\d{1,2}\.\s?)(0[1-9]|[12]\d|3[01])(\d{1,2}\s?:\s?\d{2})/g, '$1$2 $3')
    .replace(/([~∼〜～])\s?[\]\[|!lI]([0-2])(?=\s?\.)/g, '$11$2'))).join('\n');
}

/* PDF 의 **글자층**(pdf-text.py 가 칸 자리를 살려 둔 `.pdf.txt`) — 자격 경로는 숫자가 빠져서 안 쓴다(위 attachmentText 주석).
   마감 하나만 읽는 발췌기 칸 읽기(columnDeadline)가 쓴다 · 없으면 '' */
export function pdfLayerText(filePath) {
  if (!/\.pdf$/i.test(String(filePath))) return '';
  try { return fs.readFileSync(filePath + '.txt', 'utf8'); } catch { return ''; }
}

/* 이 파일의 글자가 OCR 에서 온 것인가 — 출처 표식(`공고문 첨부(OCR)`)을 붙이는 데 쓴다.
   관리자·감사가 오독 가능성을 알아보게 하려는 것이다(ocr-text.py 머리말의 이유 ②). */
export function isOcrSource(filePath) {
  const lower = String(filePath).toLowerCase();
  if (!/\.(pdf|png|jpe?g|webp|bin)$/.test(lower)) return false;
  return fs.existsSync(filePath + '.ocr.txt');
}

/* 🔴 첨부를 읽는 순서 — **원문 글자(HWP·HWPX·DOCX)가 OCR 보다 먼저**다 (2026-09-17 코드 리뷰).
   발췌기·금액 로봇은 '처음 읽히는 첨부' 하나를 쓰는데, 예전에는 PDF·그림이 늘 빈 문자열이라
   HWP 가 저절로 이겼다. OCR 이 글자를 내기 시작하면 색인 순서(PDF 가 앞)만으로 OCR 이 이긴다.
   같은 공고문이면 원문 글자가 늘 낫다 — 그래서 순서를 여기서 한 번만 정한다. */
export function docOrder(files) {
  const rank = (f) => (/\.(hwpx?|docx)$/i.test(String(f)) ? 0 : 1);
  return [...(files || [])].sort((a, b) => rank(a) - rank(b));
}

/* 읽을 만한 글자인가 — 한글이 이만큼은 나와야 자격을 찾아볼 가치가 있다 */
export const readable = (text, min = 300) => String(text || '').replace(/[^가-힣]/g, '').length >= min;
/* 🔴 OCR 로 읽은 첨부는 문턱이 낮다 (2026-10-17) — 포스터는 글자가 적어(강원대 어업인 포스터 한글 150자) 300자 문턱에 통째로 버려졌다.
   OCR 글자는 이미 품질 관문(ocr-text.py)을 넘은 것만 남아 있으므로 짧다고 못 믿을 이유가 없다. 첨부를 읽는 로봇은 readable 대신 이것을 쓴다. */
export const OCR_MIN = 80;
export const readableDoc = (filePath, text = attachmentText(filePath)) => readable(text, isOcrSource(filePath) ? OCR_MIN : 300);

/* ============================================================================
   공고문 첨부 고르기 — **한 곳** (2026-11-15 · noticeDocFiles)

   공고문 글자는 두 길로 들어온다:
     · 자격 로봇(deepfetch --elig-attach)이 받은 공고문류 → `elig-docs.json` 색인
     · 신청서 로봇(deepfetch --forms-only)이 받은 첨부 → `forms-index.txt` (form-*.*)
   신청서 쪽에도 공고문이 섞여 온다 — 「…선발 공고.hwp」 · 「…공고문(신청서 포함).hwpx」. 그 파일에만 접수 메일·발표일·접수기간이
   있는 공고가 있는데(국가유산진흥원 · 대전 서구인재육성) 발췌기는 elig-docs.json 만 열어 받아 놓고 못 읽었다.
   🔴 발췌기·금액 로봇은 색인 파일을 직접 열지 말고 이것을 부른다(관문이 발췌기 원본에서 `elig-docs.json` 글자를 찾는다).
   🔴 신청서 쪽 파일은 **공고문류(isNoticeDoc)만** · 그 공고의 줄만(id 칸이 있으면 id · 없으면 같은 제목 + 그 공고의 첨부 이름) ·
      이미 든 파일과 **바이트가 같으면** 뺀다(elig-1xmn1p-1.docx ≡ form-1xmn1p-1.docx 같은 사본을 두 번 읽지 않는다).
   ⚠️ id 칸 없는 옛 줄의 '같은 제목' 판정은 **부르는 쪽이 넘긴다**(`sameTitle` — detail-url.mjs 한 곳). 이 파일은 양식 로봇 사본 관문이
      파일 몇 개만 복사해 돌리므로 무거운 import 를 들이면 그 관문이 넘어진다(2026-11-15 실제로 그랬다) · 안 넘기면 id 줄만 본다.
   ⚠️ `formPath:false` — 제출 서류 목록(fillDocuments)·금액 로봇은 예전 그대로 자격 색인만 본다. 넓혀 봤을 때 틀린 값이 나왔다
      (달서 80만원 · 자격 줄이 서류 목록에 섞임). 넓히려면 그 두 길을 전후 대조로 먼저 볼 것.
   ============================================================================ */
const EXTRACTED_DIR = fileURLToPath(new URL('./extracted/', import.meta.url));
function parseFormsIndexRows(text) {
  return String(text || '').split('\n').filter(Boolean).map((line) => {
    const [file, title, attach, , id] = line.split('\t');
    return file && attach ? { file, title: title || '', attach, id: (id || '').trim() } : null;
  }).filter(Boolean);
}
/** 두 색인을 읽는다 — 관문이 합성 색인을 넘길 수 있게 dir 를 받는다 */
export function loadNoticeDocIndex(dir = EXTRACTED_DIR) {
  let elig = {}, forms = [];
  try { elig = JSON.parse(fs.readFileSync(`${dir}/elig-docs.json`, 'utf8')); } catch { /* 아직 없음 */ }
  try { forms = parseFormsIndexRows(fs.readFileSync(`${dir}/forms-index.txt`, 'utf8')); } catch { /* 아직 없음 */ }
  return { dir, elig, forms };
}
let defaultIndex = null;
const hashMemo = new Map();
function fileHash(p) {
  if (!hashMemo.has(p)) { let h = null; try { h = crypto.createHash('sha1').update(fs.readFileSync(p)).digest('hex'); } catch { /* 없음 */ } hashMemo.set(p, h); }
  return hashMemo.get(p);
}
/* 신청서 쪽 원본을 카드 읽기에 쓰는가 — 🔴 공고문인지는 **원본 내용**으로(attachDecision · 2026-11-20): 이름이 애매한 「붙임1.hwp」·「…시행(안).hwp」·FAQ 도
   속이 안내문이면 읽는다. 🔴 단 **이름이 서식 꼴**(신청서·지원서·서식·동의서…)인 파일은 속이 **안내문뿐**(서식 표식 0)일 때만 읽는다 —
   공고문 몇 줄이 앞에 붙은 신청서(「仁松 선발 지원서」·「헌혈기부권 신청서식」)를 읽으면 개인정보 동의 문구가 자격이 된다(2026-08-20 사고 · 위 머리말 · 리뷰).
   이름이 공고문인 파일은 예전처럼 늘 읽는다(isNoticeDoc) — 이 함수가 **더하는** 것은 이름이 애매하거나 이름과 속이 다른 공고문뿐이다.
   🔴 AI 가 답한 파일(aiRole · 2026-11-21)은 이름도 표식도 보지 않는다 — 이름이 서식 꼴이어도 붙은 문서(mixed)·내용 문서면 넣고, 이름이 공고문이어도 신청 양식·이 공고 문서 아님이면 뺀다 */
function noticeByContent(name, filePath, aiRole = null) {
  if (aiRole) return attachDecision(name, '', false, null, aiRole).notice;
  if (isNoticeDoc(name)) return true;
  const formish = FORMISH.test(String(name || ''));
  const d = attachDecision(name, roleText(filePath), formish);
  return formish ? d.role === 'notice' : d.notice;
}
/** 이 공고의 신청서 쪽 색인 줄(forms-index) — id 칸이 있으면 id · 없으면(옛 줄) 같은 제목 + 그 공고의 첨부 이름(sameTitle 을 안 넘기면 id 줄만).
    공고문 고르기(아래)와 서식 쪽 떼기(form-pages — 「양식 PDF 로봇이 맡는 파일인가」)가 같이 쓴다 */
export function noticeFormRows(it, idx, sameTitle = null) {
  if (!it) return [];
  const attNames = new Set((it.attachments || []).map((a) => a && a.name).filter(Boolean));
  const titles = [it.boardTitle, it.name, it.title].filter(Boolean);
  return ((idx && idx.forms) || []).filter((r) => (r.id ? r.id === it.id : (!!sameTitle && attNames.has(r.attach) && titles.some((t) => sameTitle(t, r.title)))));
}
/** 이 공고의 공고문 첨부 파일 이름들(extracted/ 기준) — 원문 글자(HWP·DOCX)가 먼저(docOrder)
    aiRoles — AI 가 그 파일에 정한 갈래를 찾아 주는 함수 (공고 id, 파일 이름, 실제 경로) → 'notice'|'form'|'mixed'|'other'|null. sameTitle 처럼 **부르는 쪽이 넘긴다**
    (이 파일은 이웃을 pdf-text 하나만 불러온다). 넘기는 곳은 서식 쪽 떼기(form-pages) 하나 — 안 넘기는 발췌기·금액 로봇은 예전 그대로다 */
export function noticeDocFiles(it, { index, formPath = true, sameTitle = null, aiRoles = null } = {}) {
  const idx = index || (defaultIndex ??= loadNoticeDocIndex());
  const out = [...(((idx.elig || {})[it && it.id] || {}).files || [])];
  if (formPath && it) {
    const seen = new Set(out.map((f) => fileHash(`${idx.dir}/${f}`)).filter(Boolean));
    for (const r of noticeFormRows(it, idx, sameTitle)) {   // 그 공고 줄인지 먼저(싸다) — 내용 판정은 파일을 연다
      if (out.includes(r.file)) continue;
      if (!noticeByContent(r.attach, `${idx.dir}/${r.file}`, aiRoles ? aiRoles(it.id, r.file, `${idx.dir}/${r.file}`) : null)) continue;
      const h = fileHash(`${idx.dir}/${r.file}`);
      if (!h || seen.has(h)) continue;   // 파일이 없거나 이미 든 파일의 사본
      seen.add(h); out.push(r.file);
    }
  }
  return docOrder(out);
}

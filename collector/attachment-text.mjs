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
import { pdfText } from './pdf-text.mjs';

/* 학생이 '채우는' 문서가 아니라 '읽는' 문서인가.
   ⚠️ 이름에 신청서·서식이 들어가면 공고문이 아니다 — 자격이 아니라 빈칸이 들어 있다. */
const FORMISH = /서식|양식|신청서|지원서|선발원서|동의서|서약서|추천서|계획서|증명|이력서|환산/;
const NOTICEISH = /공고|안내|계획|모집|선발|요강|기준/;
export const isNoticeDoc = (name) => {
  const n = String(name || '');
  return NOTICEISH.test(n) && !FORMISH.test(n);
};

/* zip(=docx·hwpx) 안을 직접 읽는다 — 바깥 라이브러리 없이 */
function unzipEntries(buf) {
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
    const name = buf.slice(ptr + 46, ptr + 46 + nameLen).toString('utf8');
    const lNameLen = buf.readUInt16LE(localOff + 26);
    const lExtraLen = buf.readUInt16LE(localOff + 28);
    const dataOff = localOff + 30 + lNameLen + lExtraLen;
    const raw = buf.slice(dataOff, dataOff + sizeC);
    try { out[name] = method === 0 ? raw : zlib.inflateRawSync(raw); } catch { /* 개별 항목 실패는 무시 */ }
    ptr += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

/* 🔴 **문단 단위로 이어 붙인다** (2026-08-20 — 안 그래서 숫자가 사라졌다).
   docx·hwpx는 글꼴·굵기가 바뀌는 지점마다 글자를 조각(run)으로 쪼갠다. 그래서
   `4년제 대학교 재학생`이 `4` / `년제 대학교 재학생` 두 조각으로 들어 있다.
   조각마다 줄바꿈을 넣으면 `4`는 짧아서 버려지고 **`년제 대학교 재학생`만 남는다** —
   학생에게 보여 주면 원문보다 나쁜 글이다(PDF를 자격 경로에서 뺀 것과 같은 이유).
   문단(`</w:p>`·`</hp:p>`)에서만 줄을 나누고, 그 안의 조각은 **붙여서** 읽는다. */
const unent = (t) => t.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).replace(/&amp;/g, '&');

function paraText(xml, paraTag, runRe) {
  return xml.split(new RegExp(`</${paraTag}>`))
    .map((chunk) => {
      const parts = [];
      let m;
      const re = new RegExp(runRe.source, 'g');
      while ((m = re.exec(chunk))) parts.push(m[1]);
      return unent(parts.join('')).replace(/[ \t\u00a0]+/g, ' ').trim();
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
    return d ? paraText(d.toString('utf8'), 'w:p', /<w:t[^>]*>([\s\S]*?)<\/w:t>/) : '';
  }
  if (lower.endsWith('.hwpx')) {
    const e = unzipEntries(buf);
    return Object.keys(e).filter((k) => /^Contents\/section\d+\.xml$/.test(k)).sort()
      .map((k) => paraText(e[k].toString('utf8'), 'hp:p', /<hp:t[^>]*>([\s\S]*?)<\/hp:t>/)).join('\n');
  }
  /* 🔴 **PDF는 자격 경로에서 쓰지 않는다** (2026-08-20 실측으로 결정).
     저장된 공고문 PDF 5개 중 글자가 나온 것은 1개뿐이었고, 그 하나마저
     **숫자가 빠진 채** 나왔다: 원문의 `3년 이상`이 `년이상`으로 뽑혔다.
     `공고일 기준 년이상 거주자`를 지원 자격이라고 보여 주는 것은 원문보다 나쁘다 —
     학생이 자기가 해당되는지 판단하는 글이라 숫자 하나가 결론을 바꾼다(원칙 8-1).
     게다가 한 낱말이 한 줄로 쪼개져 나와 절 구분도 안 된다.
     스캔·CID PDF는 무료로는 방법이 없다 — **AI 경로의 몫**이다(eligibility-ai.mjs가
     원본을 그림째 읽는다). pdfText는 양식 스키마화 쪽에서 계속 쓰므로 함수는 남겨 둔다. */
  if (lower.endsWith('.pdf')) return '';
  return '';
}

/* 읽을 만한 글자인가 — 한글이 이만큼은 나와야 자격을 찾아볼 가치가 있다 */
export const readable = (text, min = 300) => String(text || '').replace(/[^가-힣]/g, '').length >= min;

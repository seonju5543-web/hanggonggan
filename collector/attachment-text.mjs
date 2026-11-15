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
import { sameTitle } from './detail-url.mjs';

/* 학생이 '채우는' 문서가 아니라 '읽는' 문서인가.
   ⚠️ 이름에 신청서·서식이 들어가면 공고문이 아니다 — 자격이 아니라 빈칸이 들어 있다. */
const FORMISH = /서식|양식|신청서|지원서|선발원서|동의서|서약서|추천서|계획서|증명|이력서|환산/;
const NOTICEISH = /공고|안내|계획|모집|선발|요강|기준/;
/* 🔴 「공고문(신청서 포함)」 처럼 **공고문에 신청서가 붙은 한 파일**은 공고문이다 (2026-11-15 · 대전 서구인재육성장학재단 「붙임1. 2026년 장학생 선발
   공고문(신청서 포함).hwpx」 — 접수기간·신청마감이 그 파일에만 있는데 이름 속 '신청서' 때문에 영영 안 읽혔다). 괄호 속 「…포함」 만 걷고 다시 본다 —
   맨 「장학금 신청서.hwp」 는 그대로 서식이다(빈칸뿐인 파일을 공고문으로 읽으면 개인정보 동의 문구가 자격이 된다 · 위 머리말).
   뒤에 붙은 서식의 견본 날짜는 발췌기의 annexCut 이 자른다. */
const WITH_FORM = /\s*[(（\[]\s*[^)）\]]{0,20}포함\s*[)）\]]/g;
export const isNoticeDoc = (name) => {
  const n = String(name || '');
  return NOTICEISH.test(n) && !FORMISH.test(n.replace(WITH_FORM, ''));
};

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
  try { return ocrPeriodFix(fs.readFileSync(filePath + '.ocr.txt', 'utf8').replace(OCR_LABEL, '$1 : ')); } catch { return ''; }
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
/** 이 공고의 공고문 첨부 파일 이름들(extracted/ 기준) — 원문 글자(HWP·DOCX)가 먼저(docOrder) */
export function noticeDocFiles(it, { index, formPath = true } = {}) {
  const idx = index || (defaultIndex ??= loadNoticeDocIndex());
  const out = [...(((idx.elig || {})[it && it.id] || {}).files || [])];
  if (formPath && it) {
    const attNames = new Set((it.attachments || []).map((a) => a && a.name).filter(Boolean));
    const titles = [it.boardTitle, it.name, it.title].filter(Boolean);
    const seen = new Set(out.map((f) => fileHash(`${idx.dir}/${f}`)).filter(Boolean));
    for (const r of idx.forms || []) {
      if (out.includes(r.file) || !isNoticeDoc(r.attach)) continue;
      const mine = r.id ? r.id === it.id : (attNames.has(r.attach) && titles.some((t) => sameTitle(t, r.title)));
      if (!mine) continue;
      const h = fileHash(`${idx.dir}/${r.file}`);
      if (!h || seen.has(h)) continue;   // 파일이 없거나 이미 든 파일의 사본
      seen.add(h); out.push(r.file);
    }
  }
  return docOrder(out);
}

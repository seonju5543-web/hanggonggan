/* ============================================================
   양식 스키마화 자동화 (2026-07-30)

   확보된 신청서 원본(collector/extracted/)을 Claude API로 읽어 data/forms.json
   스키마로 옮기고, registered.json 항목에 formId를 연결한다. 지금까지 Claude 세션이
   손으로 하던 마지막 단계를 무인화한 것 (운영 원칙 5의 ② 단계).

   - 대상: collector/pending-forms.json 에서 fetched:true · schematized:false
   - 원본은 deepfetch가 매 실행마다 갈아엎으므로 반드시 같은 실행 안에서 돌려야 한다
   - 제3자 작성 서식(추천서 등)은 학생이 채우는 문서가 아니라 건너뛴다 (원칙: 원본 다운로드 안내 유지)
   - 키가 없으면 조용히 통과 — 로봇 실행을 실패시키지 않는다

   실행: node collector/schematize-forms.mjs [리포트파일]   (deepfetch 직후)
   ============================================================ */
import fs from 'node:fs';
import zlib from 'node:zlib';
import { pdfText } from './pdf-text.mjs';
import { schemaFromText } from './schema-from-text.mjs';

const HERE = new URL('.', import.meta.url);
const OUT = new URL('extracted/', HERE);
const queuePath = new URL('pending-forms.json', HERE);
const formsPath = new URL('../data/forms.json', HERE);
const registeredPath = new URL('../data/registered.json', HERE);
const reportPath = process.argv[2] ? new URL(process.argv[2], new URL('..', HERE)) : new URL('report.md', HERE);

const MODEL = 'claude-opus-5';
/* 학생이 직접 채우는 문서가 아닌 서식 — 스키마화 대상에서 제외한다 */
const THIRD_PARTY = /추천서|추천\s*양식|소견서|확인서\(기관|재직증명/;
/* 학생이 '채우는' 문서가 아니라 '읽는' 문서 — 신청서로 만들 수 없다.
   ⚠️ '신청서'·'지원서'·'양식'·'서식'이 이름에 있으면 여기 걸리지 않는다
   (예: "2026 장학생 선발 공고 및 신청서.hwp"는 신청서가 맞다). */
const NOT_A_FORM = /(공고문|공고\)|선발\s*계획|모집\s*요강|업무처리기준|Requirements|Q\s*&\s*A|매뉴얼|manual|리플렛|포스터|홍보)/i;

/* 줄글로 펴면 배치가 무너져 '원본과 동일한 문서'를 장담할 수 없는 서식들.
   이런 건 API가 원본 파일을 직접 보게 한다 (운영 원칙 4 — 양식의 정의). */
const COMPLEX_LAYOUT = /시간표|원고지|주\s*간\s*계\s*획|월\s*\|?\s*화\s*\|?\s*수\s*\|?\s*목\s*\|?\s*금|별지\s*제?\s*\d+\s*호\s*서식.*표/;

import { checkFormQuality } from './form-quality.mjs';
import { checkFormCoverage } from './form-coverage.mjs';

const cfgPath = new URL('schematize-config.json', HERE);
let cfg = { enabled: true, maxApiCallsPerRun: 2, minTextChars: 400, maxManualChars: 6000, alwaysApiIds: [], neverApiIds: [] };
try { cfg = { ...cfg, ...JSON.parse(fs.readFileSync(cfgPath, 'utf8')) }; } catch { /* 기본값 */ }

function log(msg) { console.log(`[schematize] ${msg}`); }

/* ---------- 어떤 길로 보낼지 판단 (돈 아끼는 장치) ----------
   무료 경로 = 다음 Claude 세션이 채팅에서 손으로 옮긴다 (추가 비용 0).
   API 경로  = 유료 호출. 무료 경로로는 원본과 동일한 문서를 만들 수 없는 건만 보낸다.  */
function triage(item, row, text) {
  if (THIRD_PARTY.test(row.attachment)) return { route: 'skip', why: '제3자 작성 서식 — 원본 다운로드 안내 유지' };
  /* 🔴 학생이 채우는 문서가 아닌 것을 유료 경로로 보내지 말 것 (2026-08-20 크레딧 누수 조사).
     8/2~8/10 리포트를 보니 `공고문.hwp` · `선발 계획.pdf` · `Scholarship Requirements.pdf` ·
     `Q&A.pdf` 같은 **읽는 문서**가 매 실행 API로 가고 있었다. 이런 건 아무리 잘 변환해도
     신청서가 아니라 품질 관문에 걸리고, 걸리면 큐에 남아 **다음 실행이 또 보낸다.**
     하루 4회 실행 × 2건 상한이라 같은 공고문을 끝없이 재전송한 셈이다.
     파일 이름만으로 판정하므로 오판이 있을 수 있으나, 오판의 대가는 '무료 경로로 감'뿐이다. */
  if (NOT_A_FORM.test(row.attachment)) return { route: 'skip', why: '학생이 채우는 신청서가 아님(공고문·안내문·요건서) — 원본 다운로드 안내 유지' };
  if ((cfg.neverApiIds || []).includes(item.id)) return { route: 'manual', why: '개발자 지정(neverApiIds) — 무료 경로' };
  if ((cfg.alwaysApiIds || []).includes(item.id)) return { route: 'api', why: '개발자 지정(alwaysApiIds)' };

  const isPdf = /\.pdf$/i.test(row.file);
  /* PDF도 글자층이 있으면(text가 나오면) 무료 경로로 간다. 아래 공통 규칙을 그대로 탄다.
     글자가 안 나온 PDF = 스캔본이라 눈으로 봐야 하므로 API. */
  if (isPdf && !text) return { route: 'api', why: '스캔 PDF(글자층 없음) — 원본을 직접 봐야 함' };
  if (!text || text.length < 40) return { route: 'api', why: '원본에서 글자를 읽지 못함 — 원본을 직접 봐야 함' };
  if (text.length < cfg.minTextChars) return { route: 'api', why: '뽑힌 글자가 너무 적음 — 항목이 빠졌을 수 있음' };
  if (COMPLEX_LAYOUT.test(text)) return { route: 'api', why: '표·시간표 등 복잡한 배치 — 줄글만으론 동일 문서 보장 불가' };
  if (text.length > cfg.maxManualChars) return { route: 'api', why: '항목이 많아 손으로 옮기면 누락 위험' };
  return { route: 'manual', why: '글자가 깨끗하게 나와 다음 세션이 무료로 옮길 수 있음' };
}

/* ---------- 원본에서 텍스트 뽑기 ---------- */
function unzipEntries(buf) {
  /* zip 중앙 디렉터리를 직접 읽는다 (docx·hwpx 모두 zip) */
  const out = {};
  let end = buf.length - 22;
  while (end >= 0 && buf.readUInt32LE(end) !== 0x06054b50) end--;
  if (end < 0) return out;
  let ptr = buf.readUInt32LE(end + 16);
  const count = buf.readUInt16LE(end + 10);
  for (let i = 0; i < count; i++) {
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
    try {
      out[name] = method === 0 ? raw : zlib.inflateRawSync(raw);
    } catch { /* 개별 항목 실패는 무시 */ }
    ptr += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

function xmlText(xml, tagRe) {
  const parts = [];
  let m;
  while ((m = tagRe.exec(xml))) parts.push(m[1]);
  return parts.join('\n').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

function extractText(file) {
  const url = new URL(file, OUT);
  const lower = file.toLowerCase();
  if (lower.endsWith('.hwp')) {
    /* 🔴 본문(.body.txt)을 먼저 본다. 미리보기(.txt)는 **한글이 앞부분만 담아 두는 칸**이라
       **1023자에서 잘린다** — 2026-08-14 실측으로 저장분 91개 중 56개가 그 상태였고,
       그래서 변환기가 신청서 뒷부분 항목의 존재를 아예 몰랐다(원본 대조에서 나온
       '조용한 누락'의 구조적 원인). 본문을 읽자 같은 91개에서 글자가 24만 자 늘었다.
       본문 추출은 `collector/hwp-bodytext.py`가 한다. 순서를 뒤집지 말 것. */
    for (const ext of ['.body.txt', '.txt']) {
      const txt = new URL(file + ext, OUT);
      if (fs.existsSync(txt)) return fs.readFileSync(txt, 'utf8');
    }
    return '';
  }
  if (lower.endsWith('.txt')) return fs.readFileSync(url, 'utf8');
  if (lower.endsWith('.docx') || lower.endsWith('.hwpx')) {
    const entries = unzipEntries(fs.readFileSync(url));
    if (lower.endsWith('.docx')) {
      const doc = entries['word/document.xml'];
      return doc ? xmlText(doc.toString('utf8'), /<w:t[^>]*>([\s\S]*?)<\/w:t>/g) : '';
    }
    return Object.keys(entries)
      .filter((k) => /^Contents\/section\d+\.xml$/.test(k))
      .sort()
      .map((k) => xmlText(entries[k].toString('utf8'), /<hp:t[^>]*>([\s\S]*?)<\/hp:t>/g))
      .join('\n');
  }
  if (lower.endsWith('.pdf')) {
    /* 글자층이 있는 PDF는 여기서 공짜로 읽힌다. 스캔 PDF면 ''가 나와 API 경로로 간다. */
    try { return pdfText(fs.readFileSync(url)); } catch { return ''; }
  }
  return ''; /* 그 밖의 형식 — 원본을 직접 봐야 한다 */
}

/* ---------- Claude에게 넘길 지시 ---------- */
const SYSTEM = `당신은 한국 대학 장학금 신청서를 앱 입력 양식 스키마로 옮기는 작업을 합니다.

원칙:
- 원본에 있는 항목·문구·체크 선택지를 **그대로** 옮깁니다. 없는 항목을 지어내지 마세요.
- 원본에 없는 안내 문구를 추가하지 마세요.
- label은 원본의 항목명을 그대로 씁니다. q는 사용자에게 물어보는 짧은 질문입니다.
- info는 프로필에서 자동으로 채워지는 인적사항 줄입니다. [표시명, 키, 표시명, 키] 형태이고
  키로 쓸 수 있는 값은 name, studentId, major, school, phone, email, birth, addr, emergency,
  guardianName, guardianRel, guardianPhone, bank, account, gender, bracket, yearRemain, gpaLast 뿐입니다.
  원본에 해당 인적사항 칸이 있을 때만 넣고, 없으면 빈 배열로 두세요.
- fields의 type: text(한 줄), textarea(여러 줄), choice(보기 중 **하나만** 고르기),
  checks(보기 중 **여러 개** 고르기), checks+text(체크+보충 기입).
- 성별·병역·동의·서약처럼 답이 하나뿐인 항목은 checks가 아니라 **choice**로 만드세요.
  '해당하는 것을 모두' 고르는 항목만 checks입니다.
- 위 info 키로 채울 수 있는 text 필드에는 auto에 그 키를 적으세요(예: 두 번째로 나오는 '성명').
  그러면 앱이 학생에게 묻지 않고 프로필에서 채웁니다. 해당 없으면 빈 문자열.
- options에는 **원본에 실제로 적힌 보기만** 넣습니다. 원본에 없는 보기를 만들어 내지 마세요.
- 원본에서 항목 이름을 못 찾은 체크칸은 '선택 1' 같은 이름을 지어 붙이지 말고 아예 만들지 마세요.
- id는 영문 소문자와 숫자로 짧게(예: name, addr, jumin, amount, agree1).
- pledge는 원본 하단의 서약·확약 문장을 그대로 옮깁니다. 없으면 빈 문자열.
- 주민등록번호처럼 민감한 항목은 placeholder에 "비워두고 인쇄 후 직접 기입해도 됩니다"를 넣으세요.`;

const SCHEMA = {
  type: 'object',
  properties: {
    usable: { type: 'boolean' },
    reason: { type: 'string' },
    title: { type: 'string' },
    docName: { type: 'string' },
    org: { type: 'string' },
    tag: { type: 'string' },
    pledge: { type: 'string' },
    sections: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          heading: { type: 'string' },
          note: { type: 'string' },
          info: { type: 'array', items: { type: 'array', items: { type: 'string' } } },
          fields: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                label: { type: 'string' },
                q: { type: 'string' },
                type: { type: 'string', enum: ['text', 'textarea', 'choice', 'checks', 'checks+text'] },
                auto: { type: 'string' },
                options: { type: 'array', items: { type: 'string' } },
                placeholder: { type: 'string' },
                suffix: { type: 'string' },
                textLabel: { type: 'string' }
              },
              required: ['id', 'label', 'q', 'type', 'auto', 'options', 'placeholder', 'suffix', 'textLabel'],
              additionalProperties: false
            }
          }
        },
        required: ['heading', 'note', 'info', 'fields'],
        additionalProperties: false
      }
    }
  },
  required: ['usable', 'reason', 'title', 'docName', 'org', 'tag', 'pledge', 'sections'],
  additionalProperties: false
};

/* 빈 문자열·빈 배열을 걷어내 기존 스키마와 같은 모양으로 정리 */
function tidy(t) {
  const out = { title: t.title, docName: t.docName, org: t.org };
  if (t.tag) out.tag = t.tag;
  if (t.pledge) out.pledge = t.pledge;
  out.sections = (t.sections || []).map((s) => {
    const sec = {};
    if (s.heading) sec.heading = s.heading;
    if (s.note) sec.note = s.note;
    if (s.info && s.info.length) sec.info = s.info;
    sec.fields = (s.fields || []).map((f) => {
      const fl = { id: f.id, label: f.label, type: f.type, q: f.q };
      if (f.options && f.options.length) fl.options = f.options;
      if (f.placeholder) fl.placeholder = f.placeholder;
      if (f.suffix) fl.suffix = f.suffix;
      if (f.textLabel) fl.textLabel = f.textLabel;
      return fl;
    });
    return sec;
  }).filter((s) => (s.fields && s.fields.length) || s.info);
  return out;
}

/* 🔴 원본은 form-plan.js의 FORM_AUTO_KEYS_ALL이다 — 늘릴 때 같이 늘린다.
   여기만 늘리면 앱이 못 알아보는 키가 들어와 문서에 빈 칸이 찍힌다 */
const INFO_KEYS = new Set(['name', 'studentId', 'major', 'school', 'phone', 'email',
  'birth', 'addr', 'emergency', 'guardianName', 'guardianRel', 'guardianPhone',
  'bank', 'account', 'gender', 'rrn', 'bracket', 'yearRemain', 'gpaLast', 'year']);
const FIELD_TYPES_OK = new Set(['text', 'textarea', 'choice', 'checks', 'checks+text', 'schedule', 'group', 'static']);

function validate(t) {
  if (!t.title || !t.docName) return '제목·파일명 누락';
  if (!Array.isArray(t.sections) || !t.sections.length) return '섹션 없음';
  let fieldCount = 0;
  for (const s of t.sections) {
    if (s.info) {
      for (const row of s.info) {
        if (row.length % 2) return 'info 줄이 짝을 이루지 않음';
        for (let i = 1; i < row.length; i += 2) if (!INFO_KEYS.has(row[i])) return `허용되지 않은 info 키: ${row[i]}`;
      }
    }
    for (const f of s.fields || []) {
      fieldCount++;
      if (!f.id || !/^[a-z0-9_]+$/.test(f.id)) return `필드 id가 올바르지 않음: ${f.id}`;
      /* 예전엔 type 값을 아예 검사하지 않아, 앱이 모르는 타입이 들어오면
         질문 화면에 입력칸이 없고 문서에 조용히 빈 칸이 찍혔다 */
      if (!FIELD_TYPES_OK.has(f.type)) return `${f.id}: 알 수 없는 type: ${f.type}`;
      if (f.auto && !INFO_KEYS.has(f.auto)) return `${f.id}: 허용되지 않은 auto 키: ${f.auto}`;
      if ((f.type === 'checks' || f.type === 'checks+text' || f.type === 'choice') && !(f.options || []).length) return `${f.id}: 체크 선택지 없음`;
    }
  }
  if (!fieldCount) return '입력 항목 없음';
  return null;
}

/* 이번 실행에서 이미 발급한 키 — 한 공고에 첨부가 여럿이면 서로 덮어쓰지 않게 한다 */
const mintedThisRun = new Set();

/* 같은 공고를 다시 스키마화할 때 **같은 키를 다시 쓴다**(그 자리에 덮어쓰기).
   예전에는 이미 있는 키를 피해 -2, -3… 을 계속 새로 만들었는데,
   보류된 첨부가 하나라도 있으면 그 공고는 매 실행마다 다시 처리되므로
   실행할 때마다 새 키가 생기고 등록 항목의 연결도 그 새 키로 갈아탔다.
   (2026-08-01 감사 실패: reg-hufs-namgaju → auto-남가주동문-apply-2)
   번호를 붙이는 건 '다른 공고가 이미 그 키를 쓰고 있을 때'뿐이다. */
function newFormId(item, forms, registered, entry) {
  const base = `auto-${slug(item.target)}-apply`;
  const takenByOther = (fid) =>
    mintedThisRun.has(fid) ||
    (registered.items || []).some((i) => i.formId === fid && i.id !== entry.id);
  let fid = base;
  let n = 2;
  while (takenByOther(fid)) fid = `${base}-${n++}`;
  mintedThisRun.add(fid);
  return fid;
}

function slug(name) {
  return (name || 'form')
    .replace(/[^a-zA-Z0-9가-힣]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 24)
    .toLowerCase() || 'form';
}

/* ---------- 실행 ---------- */
const report = [];
function finish() {
  if (report.length) fs.appendFileSync(reportPath, '\n' + report.join('\n') + '\n');
}

const hasKey = !!process.env.ANTHROPIC_API_KEY;
if (!cfg.enabled) { log('schematize-config.json enabled:false — 건너뜁니다.'); process.exit(0); }

let queue;
try { queue = JSON.parse(fs.readFileSync(queuePath, 'utf8')); } catch { log('대기 큐 없음'); process.exit(0); }

/* 원본을 여러 번 시도해도 못 받은 공고를 리포트에 올린다 (2026-08-02 추가).
   여기서 알리지 않으면 감사는 경고만 남기고(실패가 아니라 메일도 안 온다) 그 공고는
   앱에서 영영 '양식 없음' 상태로 남는다 — 학생 눈엔 그냥 기능이 빠진 것처럼 보인다.
   3회는 '일시 장애'와 '주소가 바뀌었거나 로그인이 필요한 첨부'를 가르는 선(학교 연속 실패 감지와 같은 기준). */
const STALL_AT = 3;
const stalled = (queue.items || []).filter((q) => !q.fetched && (q.tries || 0) >= STALL_AT);
if (stalled.length) {
  report.push('', `### 🚨 양식 원본을 못 받고 있는 공고 ${stalled.length}건 (${STALL_AT}회 이상 시도)`, '',
    '자동으로는 더 못 가져옵니다. 첨부 주소가 바뀌었거나 로그인이 필요한 경우예요.',
    '이 공고들은 앱에서 양식 작성이 안 되고 원본 다운로드 안내만 나갑니다.', '');
  for (const s of stalled.slice(0, 12)) {
    report.push(`- ${String(s.name || s.id).slice(0, 50)} — ${s.tries}회 실패 (마지막 시도 ${s.lastTryAt || '기록 없음'})${s.retired ? ' · **자동 재시도 중단**(매일 시간만 버려서). 다시 받으려면 pending-forms.json에서 retired를 지우세요' : ''}`);
  }
}

const pending = (queue.items || []).filter((q) => q.fetched && !q.schematized);
if (!pending.length) { log('스키마화할 항목 없음'); finish(); process.exit(0); }

let index = [];
try {
  index = fs.readFileSync(new URL('forms-index.txt', OUT), 'utf8')
    .split('\n').filter(Boolean)
    .map((line) => { const [file, notice, attachment] = line.split('\t'); return { file, notice, attachment }; });
} catch { log('원본 색인 없음 — 이번 실행에서 받은 첨부가 없습니다.'); finish(); process.exit(0); }

const forms = JSON.parse(fs.readFileSync(formsPath, 'utf8'));
const registered = JSON.parse(fs.readFileSync(registeredPath, 'utf8'));

let client = null;
async function getClient() {
  if (!client) {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    client = new Anthropic();
  }
  return client;
}

const done = [];      /* API로 스키마화 완료 */
const freeDone = [];  /* 무료 변환기로 그 자리에서 승격 (비용 0) */
const manual = [];    /* 무료 변환기가 자신 없어 남긴 것 — 다음 세션이 손으로 */
const skipped = [];
let apiCalls = 0;

for (const item of pending) {
  const rows = index.filter((r) => r.notice && item.target && r.notice.includes(item.target.trim()));
  if (!rows.length) { skipped.push([item.name, '이번 실행 원본에 없음']); continue; }

  const entry = (registered.items || []).find((i) => i.id === item.id);
  if (!entry) { skipped.push([item.name, 'registered.json에 항목 없음']); continue; }

  let linked = false;
  let leftForManual = false;
  const freeParts = [];

  for (const row of rows) {
    const text = extractText(row.file).trim();
    const { route, why } = triage(item, row, text);

    if (route === 'skip') { skipped.push([row.attachment, why]); continue; }

    /* 무료 경로: 기다리지 않고 **그 자리에서** 규칙 변환기로 옮긴다 (2026-07-31 개발자 지시).
       변환기가 자신 없으면(공고문·항목 부족) 그때만 큐에 남겨 다음 세션이 처리한다. */
    if (route === 'manual') {
      const conv = schemaFromText(text, { notice: row.notice, attachment: row.attachment, org: entry.provider || '' });
      if (conv.ok) {
        /* 같은 공고의 첨부는 '한 벌'로 합친다 — 신청서·자소서·동의서를 각각 다른 양식으로
           만들면 공고에는 하나만 연결돼 나머지가 앱에서 열리지 않는다 */
        /* text도 함께 담는다 — 아래에서 '원본 항목이 빠지지 않았나'를 대조하는 데 쓴다 */
        freeParts.push({ tpl: conv.tpl, attachment: row.attachment, text });
        continue;
      }
      manual.push([item.name, row.attachment, `자동 변환 보류: ${conv.why}`]);
      leftForManual = true;
      continue;
    }

    if (!hasKey) { manual.push([item.name, row.attachment, 'API 키 없음 — 다음 세션이 수동 처리']); leftForManual = true; continue; }
    /* ?? 를 쓴다 — 0(“절대 부르지 마”)을 || 가 기본값으로 되돌려 버리는 사고 방지 */
    const cap = cfg.maxApiCallsPerRun ?? 2;
    if (apiCalls >= cap) {
      manual.push([item.name, row.attachment, `이번 실행 API 한도(${cap}건) 도달 — 다음 실행으로 미룸`]);
      leftForManual = true;
      continue;
    }

    /* 유료 경로: 무료 경로로는 동일 문서를 장담할 수 없는 것만 여기로 온다 */
    const isPdf = /\.pdf$/i.test(row.file);
    const ask = `공고: ${row.notice}\n첨부 파일명: ${row.attachment}\n\n학생이 직접 채우는 신청서가 맞으면 스키마로 옮기고, 학생이 채우는 문서가 아니거나 내용이 불충분하면 usable을 false로 하고 reason에 이유를 적어 주세요.`;
    const content = isPdf
      ? [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: fs.readFileSync(new URL(row.file, OUT)).toString('base64') } },
          { type: 'text', text: ask + '\n\n첨부된 PDF가 신청서 원본입니다. 배치와 항목을 그대로 옮겨 주세요.' }
        ]
      : [{ type: 'text', text: `${ask}\n\n----- 원본 -----\n${text.slice(0, 40000)}` }];

    let parsed;
    try {
      apiCalls++;
      const c = await getClient();
      /* fallbacks: 안전 분류기가 요청을 거절하면 다른 모델로 자동 재시도 (같은 호출 안에서) */
      const stream = c.beta.messages.stream({
        model: cfg.model || MODEL,
        max_tokens: 32000,
        system: SYSTEM,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        /* 🔴 effort를 지정하지 않으면 claude-opus-5는 **사고가 켜진 채 effort high**로 돈다
           (기본값). 사고 토큰은 출력 단가로 과금되므로, '원본 글자를 JSON으로 옮기기'라는
           기계적인 일에 가장 비싼 설정이 붙어 있었다 — 2026-08-20 크레딧 누수 조사에서 확인.
           low로 낮춰도 옮겨 적기 정확도는 떨어지지 않는다. 더 높이고 싶으면 설정에서 바꾼다. */
        output_config: { effort: cfg.effort || 'low', format: { type: 'json_schema', schema: SCHEMA } },
        messages: [{ role: 'user', content }]
      });
      const msg = await stream.finalMessage();
      if (msg.stop_reason === 'refusal') { skipped.push([row.attachment, 'API가 처리를 거부함']); continue; }
      const block = msg.content.find((b) => b.type === 'text');
      parsed = JSON.parse(block.text);
    } catch (e) {
      skipped.push([row.attachment, `API 호출 실패: ${String(e.message || e).slice(0, 80)}`]);
      continue;
    }

    if (!parsed.usable) { skipped.push([row.attachment, parsed.reason || '학생이 채우는 신청서가 아님']); continue; }
    const tpl = tidy(parsed);
    const bad = validate(tpl);
    if (bad) { skipped.push([row.attachment, `검증 실패: ${bad}`]); continue; }
    const q = checkFormQuality(tpl);
    if (!q.ok) { skipped.push([row.attachment, `결과가 학생이 채울 수 있는 신청서가 아님 — ${q.problems.slice(0, 3).join(' · ')}`]); continue; }

    const fid = newFormId(item, forms, registered, entry);
    forms.templates[fid] = tpl;

    if (!linked) {
      entry.formId = fid;
      delete entry.noForm;
      linked = true;
    }
    done.push([item.name, row.attachment, fid, why]);
  }

  if (freeParts.length) {
    const secs = freeParts.flatMap((p) => p.tpl.sections);
    /* 첨부마다 따로 만든 항목을 한 벌로 합치면 id가 겹칠 수 있다 — 합친 뒤 다시 고유하게 만든다
       (겹치면 앞 항목에 적은 답이 뒤 항목에 그대로 들어간다) */
    const seenIds = new Set();
    for (const sec of secs) {
      for (const f of sec.fields) {
        if (!seenIds.has(f.id)) { seenIds.add(f.id); continue; }
        let n = 2, id = `${f.id}_${n}`;
        while (seenIds.has(id)) id = `${f.id}_${++n}`;
        f.id = id; seenIds.add(id);
      }
    }
    const head = freeParts[0].tpl;
    const merged = {
      title: freeParts.length > 1 ? `${head.title} 외 ${freeParts.length - 1}종` : head.title,
      docName: head.docName,
      org: head.org || entry.provider || '',
      sections: secs,
    };
    const pl = freeParts.find((p) => p.tpl.pledge);
    /* 원본에 서약 문구가 없으면 지어내지 않고 그 사실을 적는다 (원칙 8-1 — 추론 금지) */
    merged.pledge = pl ? pl.tpl.pledge : '원본 서식에는 별도의 서약 문구가 없어요. 제출 전 원본을 한 번 확인해 주세요.';
    const bad0 = validate(merged);
    /* 🔴 '모양이 맞나'만 보던 검사(validate)로는 못 잡는 것이 있다 — 칸은 다 채워져 있는데
       원본 표를 잘못 쪼개 **학생이 못 채우는 질문**이 된 경우다(2026-08-14, 5종 실제 발견).
       그 판정은 결과물을 보는 checkFormQuality가 한다. 걸리면 등록하지 않는다. */
    const q0 = bad0 ? null : checkFormQuality(merged);
    /* 🔴 모양이 멀쩡해도 **한 칸이 통째로 빠질 수 있다** — 그게 무료 변환기의 가장 위험한 실패다.
       2026-08-14 전수 대조에서 원본이 있는 10종 중 9종이 이랬다(자기소개서 4문항 중 3번만 누락,
       우선선발 체크칸 통째 누락 등). 남은 항목이 다 멀쩡해 보여 위 검사는 통과시킨다.
       원본 글자가 있을 때만 뜻이 있고, 없으면 '모른다'라 막지 않는다. */
    const cov0 = bad0 ? { known: false, missing: [] }
      : checkFormCoverage(merged, freeParts.map((p) => p.text || '').join('\n'));
    if (bad0 || !q0.ok || (cov0.known && cov0.missing.length)) {
      manual.push([item.name, freeParts.map((p) => p.attachment).join(', '),
        bad0 ? `자동 변환 결과가 검증을 통과하지 못함(${bad0})`
             : !q0.ok
               ? `무료 변환이 원본 표를 옮기지 못함 — ${q0.problems.slice(0, 3).join(' · ')}${q0.problems.length > 3 ? ` 외 ${q0.problems.length - 3}건` : ''}. 원본 첨부 안내를 유지합니다(API 경로 대상)`
               : `원본에 있는 항목이 빠짐 — ${cov0.missing.join('·')}. 원본 첨부 안내를 유지합니다(API 경로 대상)`]);
      leftForManual = true;
    } else {
      const fid0 = newFormId(item, forms, registered, entry);
      forms.templates[fid0] = merged;
      if (!linked) { entry.formId = fid0; delete entry.noForm; linked = true; }
      freeDone.push([item.name, freeParts.map((p) => p.attachment).join(' + '), fid0, merged,
        { info: secs.reduce((n, x) => n + (x.info ? x.info[0].length / 2 : 0), 0), fields: secs.reduce((n, x) => n + x.fields.length, 0) }]);
    }
  }

  /* 무료 경로로 남긴 첨부가 있으면 큐에 계속 둔다 (다음 세션이 처리) */
  if (!leftForManual) item.schematized = true;
  /* 🔴 끝없이 재전송되는 것을 막는다 (2026-08-20 크레딧 누수 조사).
     큐에 남은 항목은 다음 실행이 **또** 유료 API로 보낸다. 원본이 애초에 신청서가 아니거나
     변환이 구조적으로 불가능하면 그 재시도는 영원히 성공하지 못하고 돈만 쓴다.
     원본 재확보 쪽에 이미 있는 `retired` 장치(mark-fetched.mjs)와 같은 방침 —
     조용히 사라지지 않고 리포트에 '자동 재시도 중단'으로 계속 뜨며,
     pending-forms.json에서 apiTries를 지우면 다시 시도한다. */
  else {
    item.apiTries = (item.apiTries || 0) + 1;
    if (item.apiTries >= (cfg.giveUpAfter ?? 6)) {
      item.schematized = true;
      item.gaveUp = `자동 변환 ${item.apiTries}회 실패 — 재시도 중단(원본 첨부 안내는 유지)`;
      log(`재시도 중단: ${String(item.name || item.id).slice(0, 40)} (${item.apiTries}회)`);
    }
  }
}

/* 마지막 안전장치 (2026-08-01) — '있지도 않은 양식을 가리키는 연결'은 저장 전에 끊는다.
   앱은 이런 연결을 만나면 양식 작성 버튼을 아예 안 보여주므로, 끊어 두는 편이 정직하고
   감사도 통과한다. 원본 첨부 다운로드 안내는 그대로 남는다. */
const healed = [];
for (const it of registered.items || []) {
  if (it.formId && !forms.templates[it.formId]) {
    healed.push([it.id, it.formId]);
    delete it.formId;
  }
}

if (done.length || freeDone.length) {
  forms.updatedAt = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
  fs.writeFileSync(formsPath, JSON.stringify(forms, null, 1) + '\n');
}
if (done.length || freeDone.length || healed.length) {
  fs.writeFileSync(registeredPath, JSON.stringify(registered, null, 1) + '\n');
}
fs.writeFileSync(queuePath, JSON.stringify(queue, null, 1) + '\n');

report.push('', `### 🧩 양식 스키마화 — 무료 자동 ${freeDone.length}건 · API ${done.length}건 · 보류 ${manual.length}건`);
if (freeDone.length) {
  report.push('', `**무료 변환기가 앱 양식으로 바로 만들었어요 (${freeDone.length}건 · 비용 0)** — 학생이 앱 안에서 바로 작성할 수 있습니다. 아래 항목이 원본과 같은지 확인해 주세요.`, '');
  for (const [name, att, fid, tpl, stats] of freeDone) {
    report.push(`- \`${fid}\` — **${tpl.title}** (원본: ${att})`);
    report.push(`  · 공고: ${String(name).slice(0, 40)} · 자동 채움 ${stats.info}칸 · 입력 항목 ${stats.fields}개`);
    for (const sec of tpl.sections) {
      const auto = sec.info ? sec.info[0].filter((_, i) => i % 2 === 0).join('·') : '';
      report.push(`  · [${sec.heading}]${auto ? ` 프로필 자동 채움: ${auto} /` : ''} ${sec.fields.map((f) => f.label + (f.options ? `(${f.options.join('/')})` : '')).join(', ').slice(0, 200)}`);
    }
    if (tpl.pledge) report.push(`  · 서약문: ${tpl.pledge.slice(0, 80)}…`);
  }
}
if (done.length) {
  report.push('', `**유료 API로 처리 (${apiCalls}회 호출)** — 무료 경로로는 원본과 동일한 문서를 장담할 수 없는 것만 보냈어요. 원본과 다른 곳이 없는지 눈으로 확인해 주세요.`, '');
  for (const [name, att, fid, why] of done) report.push(`- \`${fid}\` — ${att} (${name.slice(0, 36)}) · 사유: ${why}`);
}
if (manual.length) {
  report.push('', `**보류 ${manual.length}건** — 자동 변환기가 원본과 같은 문서를 장담하지 못한 것들이에요. 원본 다운로드 안내는 그대로 유지됩니다.`, '');
  for (const [name, att, why] of manual.slice(0, 12)) report.push(`- ${att} (${name.slice(0, 36)}) · ${why}`);
}
if (skipped.length) {
  report.push('', `**건너뜀 ${skipped.length}건**`, '');
  for (const [what, why] of skipped.slice(0, 12)) report.push(`- ${String(what).slice(0, 50)} — ${why}`);
}
if (healed.length) {
  report.push('', `**끊어진 양식 연결 ${healed.length}건 정리** — 없는 양식을 가리키고 있어서 연결을 끊었어요(원본 첨부 안내는 유지).`, '');
  for (const [id, fid] of healed) report.push(`- ${id} → \`${fid}\` (data/forms.json에 없음)`);
}
finish();
log(`완료: 무료 자동 ${freeDone.length}건 · API ${done.length}건(${apiCalls}회 호출) · 보류 ${manual.length}건 · 건너뜀 ${skipped.length}건${healed.length ? ` · 끊어진 연결 정리 ${healed.length}건` : ''}`);

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

const HERE = new URL('.', import.meta.url);
const OUT = new URL('extracted/', HERE);
const queuePath = new URL('pending-forms.json', HERE);
const formsPath = new URL('../data/forms.json', HERE);
const registeredPath = new URL('../data/registered.json', HERE);
const reportPath = process.argv[2] ? new URL(process.argv[2], new URL('..', HERE)) : new URL('report.md', HERE);

const MODEL = 'claude-opus-5';
/* 학생이 직접 채우는 문서가 아닌 서식 — 스키마화 대상에서 제외한다 */
const THIRD_PARTY = /추천서|추천\s*양식|소견서|확인서\(기관|재직증명/;

function log(msg) { console.log(`[schematize] ${msg}`); }

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
    /* hwp-prvtext.py가 만들어 둔 미리보기 텍스트 */
    const txt = new URL(file + '.txt', OUT);
    return fs.existsSync(txt) ? fs.readFileSync(txt, 'utf8') : '';
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
  return ''; /* pdf 등 — 텍스트 추출 불가, 다음 세션이 눈으로 확인 */
}

/* ---------- Claude에게 넘길 지시 ---------- */
const SYSTEM = `당신은 한국 대학 장학금 신청서를 앱 입력 양식 스키마로 옮기는 작업을 합니다.

원칙:
- 원본에 있는 항목·문구·체크 선택지를 **그대로** 옮깁니다. 없는 항목을 지어내지 마세요.
- 원본에 없는 안내 문구를 추가하지 마세요.
- label은 원본의 항목명을 그대로 씁니다. q는 사용자에게 물어보는 짧은 질문입니다.
- info는 프로필에서 자동으로 채워지는 인적사항 줄입니다. [표시명, 키, 표시명, 키] 형태이고
  키로 쓸 수 있는 값은 name, studentId, major, school, phone, email, bracket, yearRemain, gpaLast 뿐입니다.
  원본에 해당 인적사항 칸이 있을 때만 넣고, 없으면 빈 배열로 두세요.
- fields의 type: text(한 줄), textarea(여러 줄), checks(선택지 중 체크), checks+text(체크+보충 기입).
- 동의/서약 항목은 checks로 만들고 options에 원본의 선택지(예: "동의함", "동의하지 않음")를 그대로 넣습니다.
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
                type: { type: 'string', enum: ['text', 'textarea', 'checks', 'checks+text'] },
                options: { type: 'array', items: { type: 'string' } },
                placeholder: { type: 'string' },
                suffix: { type: 'string' },
                textLabel: { type: 'string' }
              },
              required: ['id', 'label', 'q', 'type', 'options', 'placeholder', 'suffix', 'textLabel'],
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

const INFO_KEYS = new Set(['name', 'studentId', 'major', 'school', 'phone', 'email', 'bracket', 'yearRemain', 'gpaLast']);

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
      if ((f.type === 'checks' || f.type === 'checks+text') && !(f.options || []).length) return `${f.id}: 체크 선택지 없음`;
    }
  }
  if (!fieldCount) return '입력 항목 없음';
  return null;
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

if (!process.env.ANTHROPIC_API_KEY) {
  log('ANTHROPIC_API_KEY 없음 — 스키마화를 건너뜁니다 (다음 Claude 세션이 수동 처리).');
  process.exit(0);
}

let queue;
try { queue = JSON.parse(fs.readFileSync(queuePath, 'utf8')); } catch { log('대기 큐 없음'); process.exit(0); }
const pending = (queue.items || []).filter((q) => q.fetched && !q.schematized);
if (!pending.length) { log('스키마화할 항목 없음'); process.exit(0); }

let index = [];
try {
  index = fs.readFileSync(new URL('forms-index.txt', OUT), 'utf8')
    .split('\n').filter(Boolean)
    .map((line) => { const [file, notice, attachment] = line.split('\t'); return { file, notice, attachment }; });
} catch { log('원본 색인 없음 — 이번 실행에서 받은 첨부가 없습니다.'); process.exit(0); }

const forms = JSON.parse(fs.readFileSync(formsPath, 'utf8'));
const registered = JSON.parse(fs.readFileSync(registeredPath, 'utf8'));

const { default: Anthropic } = await import('@anthropic-ai/sdk');
const client = new Anthropic();

const done = [];
const skipped = [];

for (const item of pending) {
  const rows = index.filter((r) => r.notice && item.target && r.notice.includes(item.target.trim()));
  if (!rows.length) { skipped.push([item.name, '이번 실행 원본에 없음']); continue; }

  const entry = (registered.items || []).find((i) => i.id === item.id);
  if (!entry) { skipped.push([item.name, 'registered.json에 항목 없음']); continue; }

  let linked = false;
  for (const row of rows) {
    if (THIRD_PARTY.test(row.attachment)) { skipped.push([row.attachment, '제3자 작성 서식 — 원본 다운로드 안내 유지']); continue; }
    const text = extractText(row.file).trim();
    if (text.length < 40) { skipped.push([row.attachment, '원본에서 글자를 읽지 못함']); continue; }

    let parsed;
    try {
      /* fallbacks: 안전 분류기가 요청을 거절하면 다른 모델로 자동 재시도 (같은 호출 안에서) */
      const stream = client.beta.messages.stream({
        model: MODEL,
        max_tokens: 32000,
        system: SYSTEM,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { format: { type: 'json_schema', schema: SCHEMA } },
        messages: [{
          role: 'user',
          content: `공고: ${row.notice}\n첨부 파일명: ${row.attachment}\n\n아래는 이 신청서 원본의 전문입니다. 학생이 직접 채우는 신청서가 맞으면 스키마로 옮기고, 학생이 채우는 문서가 아니거나 내용이 불충분하면 usable을 false로 하고 reason에 이유를 적어 주세요.\n\n----- 원본 -----\n${text.slice(0, 40000)}`
        }]
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

    let fid = `auto-${slug(item.target)}-apply`;
    let n = 2;
    while (forms.templates[fid]) fid = `auto-${slug(item.target)}-apply-${n++}`;
    forms.templates[fid] = tpl;

    if (!linked) {
      entry.formId = fid;
      delete entry.noForm;
      linked = true;
    }
    done.push([item.name, row.attachment, fid]);
  }

  item.schematized = true;
}

if (done.length) {
  forms.updatedAt = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
  fs.writeFileSync(formsPath, JSON.stringify(forms, null, 1) + '\n');
  fs.writeFileSync(registeredPath, JSON.stringify(registered, null, 1) + '\n');
}
fs.writeFileSync(queuePath, JSON.stringify(queue, null, 1) + '\n');

report.push('', `### 🧩 양식 자동 스키마화 — ${done.length}건 등록`);
if (done.length) {
  report.push('', '자동 스키마화된 양식이에요. 원본과 다른 곳이 없는지 다음 세션에서 눈으로 확인해 주세요.', '');
  for (const [name, att, fid] of done) report.push(`- \`${fid}\` — ${att} (${name.slice(0, 40)})`);
}
if (skipped.length) {
  report.push('', `**건너뜀 ${skipped.length}건**`, '');
  for (const [what, why] of skipped.slice(0, 12)) report.push(`- ${String(what).slice(0, 50)} — ${why}`);
}
finish();
log(`완료: 등록 ${done.length}건 · 건너뜀 ${skipped.length}건`);

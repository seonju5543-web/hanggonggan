/* ============================================================
   유료 확인 2 — 최종 검토 (2026-11-20 개발자 지시 · 설계 docs/designs/paid-gate-pipeline.md 3절)
   *"6번에서 최종 검토할 때 앱에 있는 문서가 똑같은지 알맞은 문서인지, 신청양식이 맞는지, 내용이 있는 문서인지
     내용이 있는 문서면 그 내용이 공고 카드에 다 들어가 있는건지."*

   유료 확인 1(card-read)을 통과해 학생 화면에 오른 숨김 등록분(`paidGate`)마다, 앱이 보이는 문서와 카드를 원문과 함께 본다.
     기계(돈 0) — ① 원본과 같은가: 앱이 보이는 신청서 PDF 사본(data/forms-pdf)의 글자 ↔ 받아 둔 원본 첨부의 글자
                  ② 내용이 있는가: 문서에서 뽑힌 한글 분량
     모델(한 번) — ③ 이 공고의 문서인가 ④ 신청 양식인가 ⑤ 문서 내용 가운데 카드에 없는 것 — ⑤ 의 줄은 근거(quote)가 원문에 있어야 남는다(card-read inSource)
   🔴 카드에 빠진 내용(⑤)은 **자동으로 카드에 넣는다**(2026-11-21 개발자 결정 *"빠진 내용은 자동으로 넣고"*) — 근거가 원문에 있고 사실 검사(factsMatch)를 통과한 줄만,
      유료 결과 칸(배열)에만 덧붙인다(data/card-read.json · 이미 있는 줄은 안 넣는다 · 무료 값 칸(null)에 한 줄만 넣으면 학생이 보던 줄 전체가 그 한 줄로 줄어 관리자에게 넘긴다).
   문서 문제(①~④)는 고치지 않고 보고만 한다 → collector/final-review.json(관리자 「할 일」) — 로봇이 잘못 판단해 진짜 신청서를 내리면 학생이 양식을 잃는다.

   🔴 돈이 나가는 로봇 — 스위치 둘(final-review-config.json enabled + FINAL_REVIEW_ENABLE=1) · 실행당 상한 · 같은 문서·카드는 다시 안 본다(해시 장부).
   실행: node collector/final-review.mjs [--write]   · FINAL_REVIEW_FAKE=<파일 {id: 응답}> 로 돈 없이(관문)
   ============================================================ */
import fs from 'node:fs';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { makeSources, sourceText, norm, inSource, factsMatch, FIELD_LABEL, closedNow } from './card-read.mjs';
import { attachmentText } from './attachment-text.mjs';
import { sameTitle } from './detail-url.mjs';

const require = createRequire(import.meta.url);
const HERE = new URL('.', import.meta.url);
const P = (rel) => fileURLToPath(new URL(rel, HERE));
const readJson = (rel, d) => { try { return JSON.parse(fs.readFileSync(P(rel), 'utf8')); } catch { return d; } };
const log = (m) => console.log(`[final-review] ${m}`);

export const MODEL = 'claude-opus-5-5';
const PRICE = [4, 20];   // 달러 / 100만 토큰 (입력, 출력) — 2026-11 요금
const DOC_MAX = 6000;    // 문서 하나에서 모델에게 주는 글자 상한(원문 전체는 따로 준다)
export const MIN_KO = 40;   // 내용이 있다고 볼 한글 분량 — card-read 의 「읽을 원문」 기준과 같다
export const SAME_MIN = 0.85;

export const SYSTEM = `한국 대학 장학금 공고의 최종 검토자입니다. 공고 원문(게시판 본문과 첨부)과, 학생 앱이 보여 주는 문서들, 그리고 학생 앱의 공고 카드(JSON)를 받습니다.
문서마다 셋을 판정합니다.
- thisNotice: 이 공고의 문서인가(다른 장학금·지난 학년도·다른 학교의 문서가 아닌가)
- isForm: 학생이 채워서 내는 신청 양식(신청서·지원서·추천서·서약서·동의서 서식)인가. 공고문·안내문·결과 발표·포스터면 false. 판단할 수 없으면 null
- empty: 읽을 내용이 없는 문서인가(빈 서식만 있는 것은 내용이 있는 것입니다 — 메뉴뿐·오류 화면·깨진 글자만 empty)
why 에는 그렇게 본 까닭을 한 문장으로 씁니다.
그리고 missing — 원문(본문·문서)에 있는데 카드에 빠진 자격·제외·서류·금액·접수 방법·유의사항을 한 줄씩. field 는 eligibility·excludes·documents·amount·apply·notes·priority 중 하나,
text 는 카드에 실을 깔끔한 문장, quote 는 그 근거인 원문 부분을 한 글자도 바꾸지 않고 그대로. 카드에 이미 같은 뜻이 있으면 내지 않습니다. 추측하지 않습니다.`;
const S = { type: 'string' };
export const SCHEMA = {
  type: 'object', additionalProperties: false, required: ['docs', 'missing'],
  properties: {
    docs: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['name', 'thisNotice', 'isForm', 'empty', 'why'],
      properties: { name: S, thisNotice: { type: 'boolean' }, isForm: { type: ['boolean', 'null'] }, empty: { type: 'boolean' }, why: S } } },
    missing: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['field', 'text', 'quote'], properties: { field: S, text: S, quote: S } } },
  },
};
const MISSING_FIELDS = ['eligibility', 'excludes', 'documents', 'amount', 'apply', 'notes', 'priority'];

/* ── 기계 검사 ── */
const koOnly = (t) => norm(t).replace(/[^가-힣0-9]/g, '');
export const hasContent = (text) => String(text || '').replace(/[^가-힣]/g, '').length >= MIN_KO;
/* 두 글자의 같은 정도 — 한글·숫자만 남겨 두 글자 조각 겹침(다이스). 변환이 줄바꿈·표 칸 순서를 바꿔도 글자 자체는 같아야 한다 */
export function sameness(a, b) {
  const x = koOnly(a), y = koOnly(b);
  if (x.length < 2 || y.length < 2) return null;
  const grams = (s) => { const m = new Map(); for (let i = 0; i < s.length - 1; i++) { const g = s.slice(i, i + 2); m.set(g, (m.get(g) || 0) + 1); } return m; };
  const A = grams(x), B = grams(y); let both = 0;
  for (const [g, c] of A) both += Math.min(c, B.get(g) || 0);
  return (2 * both) / (x.length - 1 + y.length - 1);
}
const pdfText = (file) => {
  try { const r = spawnSync('pdftotext', ['-layout', file, '-'], { encoding: 'utf8', timeout: 30000 }); return r.status === 0 ? r.stdout : null; } catch { return null; }
};
/* 앱이 보이는 문서 — 신청서 PDF 사본(원본 글자와 대조) + 받아 둔 공고 첨부(원문의 일부) */
export function docsOf(it, { formsPdf = {}, formsIndex = [], eligDocs = {}, extractedDir, readPdf = pdfText, readAttach = attachmentText }) {
  const out = [];
  for (const f of formsPdf[it.id] || []) {
    if (!f || !f.file) continue;
    const text = readPdf(fileURLToPath(new URL(`../data/forms-pdf/${f.file}`, HERE)));
    const row = formsIndex.find((r) => r.attach === f.name && sameTitle(r.title, it.name));
    const orig = row ? readAttach(`${extractedDir}/${row.file}`) : '';
    /* 글자 도구(pdftotext)가 없으면 text 는 null — 「모름」이다. 빈 글자('')로 두면 모든 사본이 「내용 없음」이 되고 해시가 바뀌어 다시 돈을 쓴다(리뷰) */
    out.push({ name: f.name, kind: '신청서 사본(PDF)', text: text == null ? null : text, orig: orig || '', same: text && orig ? sameness(text, orig) : null });
  }
  for (const f of ((eligDocs[it.id] || {}).files) || []) {
    const text = readAttach(`${extractedDir}/${f}`);
    out.push({ name: f.replace(/^elig-[a-z0-9]+-/, '첨부 ').replace(/\.(ocr\.)?txt$/, ''), kind: '공고 첨부', text: text || '' });
  }
  return out;
}
export const reviewHash = (source, docs, card) => crypto.createHash('sha256').update(SYSTEM).update(source).update(JSON.stringify(docs.map((d) => [d.name, d.text == null ? '?' : d.text]))).update(JSON.stringify(card)).digest('hex').slice(0, 16);

/* 기계 + 모델 → 관리자에게 보일 문제 줄(사람 말 · 로봇 말 없이). missing 은 근거가 원문에 있는 것만 */
export function problemsOf(docs, out, source) {
  const pr = [];
  for (const d of docs) {
    if (d.same != null && d.same < SAME_MIN) pr.push({ kind: 'notSame', doc: d.name, reason: `앱이 보여 주는 「${d.name}」 사본의 글자가 받아 둔 원본 첨부와 다릅니다(같은 정도 ${Math.round(d.same * 100)}%).`, check: '원본 첨부와 앱의 사본을 나란히 열어 같은 문서인지 확인해 주세요.' });
    if (d.text != null && !hasContent(d.text)) pr.push({ kind: 'noText', doc: d.name, reason: `「${d.name}」에서 읽을 글자가 거의 없습니다(빈 문서·그림뿐인 문서일 수 있습니다).`, check: '문서를 열어 내용이 있는 문서인지 확인해 주세요.' });
  }
  const o = (out && typeof out === 'object') ? out : {};
  for (const m of Array.isArray(o.docs) ? o.docs : []) {
    if (!m || typeof m.name !== 'string') continue;
    const why = String(m.why || '').trim();
    if (m.thisNotice === false) pr.push({ kind: 'otherNotice', doc: m.name, reason: `「${m.name}」이 이 공고의 문서가 아닐 수 있습니다${why ? ` — ${why}` : ''}.`, check: '문서의 장학금 이름·기관·학년도가 이 공고와 같은지 확인해 주세요.' });
    if (m.isForm === false && /신청서|지원서|원서|양식|서식/.test(m.name)) pr.push({ kind: 'notForm', doc: m.name, reason: `신청서로 보이는 「${m.name}」이 학생이 채워 내는 양식이 아닐 수 있습니다${why ? ` — ${why}` : ''}.`, check: '이 문서가 실제 신청 양식인지(공고문·안내문이 아닌지) 확인해 주세요.' });
    if (m.empty === true && !pr.some((p) => p.kind === 'noText' && p.doc === m.name)) pr.push({ kind: 'noText', doc: m.name, reason: `「${m.name}」에 읽을 내용이 없어 보입니다${why ? ` — ${why}` : ''}.`, check: '문서를 열어 내용이 있는 문서인지 확인해 주세요.' });
  }
  const srcN = norm(source);
  for (const m of Array.isArray(o.missing) ? o.missing : []) {
    if (!m || !MISSING_FIELDS.includes(m.field) || typeof m.text !== 'string' || !m.text.trim() || typeof m.quote !== 'string') continue;
    if (!inSource(m.quote, srcN).ok) continue;   // 근거가 원문에 없으면 버린다(지어낸 「빠진 내용」을 사람에게 넘기지 않는다)
    if (!factsMatch(m.text, m.quote, '', m.field).ok) continue;   // 카드에 실을 문장도 유료 확인 1 과 같은 사실 검사를 거친다(살리기 한 번으로 실리므로 · 리뷰)
    const label = FIELD_LABEL[m.field];
    pr.push({ kind: 'missing', field: m.field, label, text: m.text.trim(), quote: m.quote, reason: `문서에 있는 ${label} 내용이 카드에 없습니다.`, check: `원문에서 확인하고 카드의 ${label}에 넣을지 정해 주세요.` });
  }
  return pr;
}
/* 카드에 빠진 내용 자동으로 넣기 (2026-11-21 개발자 결정) — problemsOf 가 이미 근거·사실 검사를 거친 missing 줄만 받는다.
   유료 결과 칸이 배열일 때만 덧붙이고(같은 말·이미 든 줄은 건너뛴다) · 칸이 무료 값(null·없음)이면 사람 몫으로 남긴다. 들어온 entry 는 고치지 않고 새 객체를 낸다 */
export function fillMissing(entry, problems) {
  const next = entry && typeof entry === 'object' ? { ...entry } : null;
  const added = [], left = [];
  for (const p of problems || []) {
    if (p.kind !== 'missing') { left.push(p); continue; }
    if (!next || !Array.isArray(next[p.field])) {
      left.push({ ...p, reason: `${p.reason} 이 칸은 학생 화면에 무료 값(원문 줄 전체)이 보이고 있어 자동으로 넣지 않았습니다.`, check: `원문에서 확인하고 필요하면 공고 고치기에서 ${p.label} 칸을 고쳐 주세요.` });
      continue;
    }
    const n = norm(p.text);
    if (next[p.field].some((l) => norm(l).includes(n))) continue;   // 이미 든 줄(같은 말 · 그 줄을 품은 기존 줄) — 🔴 반대(새 줄이 짧은 기존 줄을 품음)는 건너뛰지 않는다: 「재학생」만 있는 칸에 「본교 재학생 중 평점 3.0 이상인 학생」은 빠진 요건이다
    next[p.field] = [...next[p.field], p.text];
    added.push({ field: p.field, label: p.label, text: p.text, quote: p.quote });
  }
  return { entry: next, added, left };
}
/* 볼 공고 — 유료 확인 1 을 통과해 학생 화면에 떠 있는 숨김 등록분(그 전 등록분은 보지 않는다 · 개발자 결정 「나」). 다시 볼지는 해시로(본편) */
export const reviewable = (items, cardRead, today) => items.filter((it) => (it.paidGate || it.paidRead) && cardRead[it.id] && !closedNow(it, cardRead[it.id], today));
export const needsReview = (led, hash, giveUpAfter = 3) => !led || led.hash !== hash || !(led.done || (led.tries || 0) >= giveUpAfter);

async function ask(client, item, source, docs, card, effort) {
  const docText = docs.map((d, i) => `===== 앱이 보이는 문서 ${i + 1}: ${d.name} (${d.kind}) =====\n${d.text == null ? '(글자를 뽑지 못함 — 판단하지 마세요)' : String(d.text).slice(0, DOC_MAX) || '(뽑힌 글자 없음)'}`).join('\n\n');
  const stream = client.beta.messages.stream({
    model: MODEL, max_tokens: 16000, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default', system: SYSTEM,
    output_config: { effort, format: { type: 'json_schema', schema: SCHEMA } },
    messages: [{ role: 'user', content: `공고 제목: ${item.name}\n\n===== 공고 원문 =====\n${source}\n\n${docText}\n\n===== 학생 앱의 공고 카드 =====\n${JSON.stringify(card)}` }],
  });
  const msg = await stream.finalMessage();
  if (msg.stop_reason === 'refusal') throw new Error('모델이 처리를 거절함');
  if (msg.stop_reason === 'max_tokens') throw new Error('출력이 잘림');
  const text = msg.content.find((b) => b.type === 'text');
  if (!text) throw new Error('글자 응답이 없음');
  const u = msg.usage || {};
  return { out: JSON.parse(text.text), usd: ((u.input_tokens || 0) * PRICE[0] + (u.output_tokens || 0) * PRICE[1]) / 1e6 };
}

const ranDirectly = () => { try { return fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url)); } catch { return false; } };
if (process.argv[1] && ranDirectly()) {
  const WRITE = process.argv.includes('--write');
  const TODAY = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
  const cfg = { enabled: false, maxPerRun: 15, maxUsdPerRun: 3, giveUpAfter: 3, effort: 'medium', maxMs: 9 * 60 * 1000, ...readJson('final-review-config.json', {}) };
  const reg = readJson('../data/registered.json', { items: [] });
  const ME = require('../match-engine.js');
  const cr = readJson('../data/card-read.json', { items: {} });
  const fixes = readJson('../data/card-read-fixes.json', null);
  const crItems = (ME.mergeCardFixes(cr, fixes) || cr).items || {};
  const ledger = readJson('final-review-ledger.json', {});
  const result = readJson('final-review.json', { items: {} });
  if (!result.items) result.items = {};
  const extractedDir = P('extracted');
  const partsOf = makeSources({ texts: readJson('extracted/notices-text.json', {}), browserBodies: readJson('extracted/browser-bodies.json', {}), eligDocs: readJson('extracted/elig-docs.json', {}), extractedDir });
  let formsIndex = [];
  try { formsIndex = fs.readFileSync(P('extracted/forms-index.txt'), 'utf8').split('\n').filter(Boolean).map((l) => { const [file, title, attach] = l.split('\t'); return { file, title, attach }; }); } catch { /* 아직 없음 */ }
  const ctx = { formsPdf: readJson('../data/forms-pdf/index.json', { items: {} }).items || {}, formsIndex, eligDocs: readJson('extracted/elig-docs.json', {}), extractedDir };
  /* 내려간 공고는 결과·장부에서 뺀다 */
  const live = new Map(reg.items.map((it) => [it.id, it]));
  for (const id of Object.keys(result.items)) { const it = live.get(id); if (!it || closedNow(it, crItems[id], TODAY)) { delete result.items[id]; delete ledger[id]; } }
  const writeAtomic = (rel, obj) => { const p = P(rel), tmp = `${p}.tmp`; fs.writeFileSync(tmp, `${JSON.stringify(obj, null, 1)}\n`); fs.renameSync(tmp, p); };
  let crDirty = false;   // 빠진 내용을 카드에 넣었으면 유료 결과 파일도 저장한다(카드 읽기 로봇과 같은 꼴 · JSON.stringify(x, null, 1))
  const save = () => { result.updatedAt = TODAY; if (crDirty) writeAtomic('../data/card-read.json', cr); writeAtomic('final-review.json', result); writeAtomic('final-review-ledger.json', ledger); };
  const mergedOf = (id) => (((ME.mergeCardFixes({ items: { [id]: cr.items[id] } }, fixes) || {}).items) || {})[id];

  /* 문서·카드가 바뀌었으면 다시 본다(해시) */
  const targets = [];
  for (const it of reviewable(reg.items, crItems, TODAY)) {
    const source = sourceText(partsOf(it)), docs = docsOf(it, ctx), hash = reviewHash(source, docs, crItems[it.id]);
    if (needsReview(ledger[it.id], hash, cfg.giveUpAfter)) targets.push({ it, source, docs, hash });
  }
  log(`대상 ${targets.length}건 (유료 확인을 통과해 학생 화면에 오른 숨김 등록분 가운데 문서·카드를 아직 안 본 것)`);
  const fake = process.env.FINAL_REVIEW_FAKE ? JSON.parse(fs.readFileSync(process.env.FINAL_REVIEW_FAKE, 'utf8')) : null;
  const paidOn = cfg.enabled === true && process.env.FINAL_REVIEW_ENABLE === '1';
  if (!WRITE) { targets.slice(0, 30).forEach((t) => log(`  · ${t.it.id} · ${String(t.it.name).slice(0, 40)} · 문서 ${t.docs.length}개`)); log('미리보기 — 부르지 않았습니다 (--write 로 반영)'); process.exit(0); }
  if (!fake && !paidOn) { save(); log(`유료 스위치가 꺼져 있어 부르지 않았습니다 (final-review-config.json enabled: ${cfg.enabled} · FINAL_REVIEW_ENABLE: ${process.env.FINAL_REVIEW_ENABLE || '없음'})`); process.exit(0); }
  let client = null;
  if (!fake) { const { default: Anthropic } = await import('@anthropic-ai/sdk'); client = new Anthropic(); }
  const t0 = Date.now();
  let usd = 0, done = 0, failed = 0, streak = 0, stopped = '';
  try {
    for (const t of targets) {
      if (done + failed >= cfg.maxPerRun) { stopped = `한 실행 상한 ${cfg.maxPerRun}건`; break; }
      if (usd >= cfg.maxUsdPerRun) { stopped = `한 실행 예산 $${cfg.maxUsdPerRun}`; break; }
      if (Date.now() - t0 >= cfg.maxMs) { stopped = '시간 예산'; break; }
      if (streak >= 3) { stopped = '연달아 실패'; break; }   // 잔액 부족 같은 '전부 실패'가 상한까지 돈을 쓰며 돌지 않게
      if (fake && !fake[t.it.id]) continue;
      const led = ledger[t.it.id] = { ...(ledger[t.it.id] || {}), name: String(t.it.name).slice(0, 60) };
      if (led.hash !== t.hash) { led.hash = t.hash; led.tries = 0; led.done = false; }
      try {
        const r = fake ? { out: fake[t.it.id], usd: 0 } : await ask(client, t.it, t.source, t.docs, crItems[t.it.id], cfg.effort);
        usd += r.usd; led.usd = Math.round(((led.usd || 0) + r.usd) * 10000) / 10000;
        const f = fillMissing(cr.items[t.it.id], problemsOf(t.docs, r.out, t.source));
        let hash = t.hash;
        if (f.added.length) {
          cr.items[t.it.id] = f.entry; crItems[t.it.id] = mergedOf(t.it.id); crDirty = true;
          hash = reviewHash(t.source, t.docs, crItems[t.it.id]);   // 🔴 넣은 뒤의 카드로 해시를 잡는다 — 안 그러면 제가 넣은 줄 때문에 다음 실행이 같은 공고를 돈 내고 또 본다
          led.hash = hash;
        }
        result.items[t.it.id] = { name: led.name, hash, at: TODAY, problems: f.left, ...(f.added.length ? { added: f.added } : {}) };
        led.done = true; led.at = TODAY; led.raw = r.out; delete led.error;
        done += 1; streak = 0;
        log(`  ✓ ${t.it.id} · ${String(t.it.name).slice(0, 30)} · 문서 ${t.docs.length}개 · 카드에 넣은 줄 ${f.added.length} · 사람이 볼 것 ${f.left.length}건`);
      } catch (e) {
        failed += 1; streak += 1; led.tries = (led.tries || 0) + 1; led.error = String((e && e.message) || e).slice(0, 200);
        log(`  ✕ ${t.it.id} · ${led.error}`);
      }
      save();   // 건마다 저장 — 강제 종료돼도 돈을 쓴 결과를 잃지 않는다
    }
  } finally { save(); }
  log(`끝 — 검토 ${done}건 · 실패 ${failed}건 · 쓴 돈 $${usd.toFixed(4)}${stopped ? ` · 멈춘 까닭: ${stopped}` : ''}`);
  if (failed) process.exit(1);
}

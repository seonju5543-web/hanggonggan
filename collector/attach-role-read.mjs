/* ============================================================
   유료 첨부 판정 — 글자 없는 첨부(스캔 PDF·그림)가 신청서인가 공고문인가 (2026-11-20 개발자 지시 「유료로 해」)

   무료 판정(attachment-text attachDecision)은 원본 **글자**의 서식 표식·공고문 절 머리로 가른다. 글자가 없는 파일
   (글자층 없는 스캔 PDF · OCR 이 품질 관문을 못 넘은 그림)은 '모름'이라 이름 규칙으로 물러났다 — 「신청서.pdf」 라는 스캔 안내문은 양식 칸에,
   「붙임1.pdf」 라는 스캔 신청서는 칸 밖에 남는다. 이 로봇은 **그 파일만** 파일째(PDF 문서 블록 · 그림 블록) 모델 둘에게 따로 보여 주고,
   ① 답이 정해진 넷(form·notice·mixed·unknown) 중 하나이고 ② **둘이 같은 답**일 때만 `collector/attach-role-paid.json` 에 싣는다.
   양식 PDF 로봇(form-pdf.mjs)이 다음 실행에 그 답으로 신청서 칸을 고친다(roles → 앱 attIsForm).

   🔴 돈이 나가는 로봇이다 — 스위치는 유료 카드 읽기와 같은 둘(`card-read-config.json` enabled + 환경 변수 CARD_READ_ENABLE=1).
      한 실행 상한은 따로(같은 파일 roleMaxPerRun · roleMaxUsdPerRun). 같은 파일(바이트 해시)은 다시 묻지 않고, 세 번 실패하면 그 파일은 그만 묻는다.
   🔴 글자로 이미 가른 파일은 묻지 않는다(무료 길이 먼저) · 15쪽 넘는 PDF·5MB 넘는 파일은 보내지 않는다(요강일 가능성이 크고 비싸다 —
      form-pages 의 「요강은 60쪽」 셈보다 좁게) · 카드 읽기의 지시문(SYSTEM)은 안 건드린다(바꾸면 실린 공고 전부를 다시 산다).
   🔴 학생에게 보이는 글자를 만들지 않는다 — 답은 칸 하나(신청서 칸에 둘까)뿐이다. 그래서 지어냄 대조(verify) 대신 두 모델 일치가 관문이다.

   실행: node collector/attach-role-read.mjs              (미리보기 — 부르지 않는다)
         node collector/attach-role-read.mjs --write      (반영 · 스위치가 켜져 있어야 부른다)
         ATTACH_ROLE_FAKE=<파일> … --write                (가짜 응답 {'<id>|<첨부 이름>': {a: {role, evidence}, b: …}} — 관문이 돈 없이 돌린다)
   ATTACH_ROLE_ROOT 로 저장소를 바꿔 끼운다(관문 임시 폴더).
   ============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { MODELS, PRICE } from './card-read.mjs';
import { roleText } from './attachment-text.mjs';
import { loadFormRules, cleanAttachName } from './form-rules.mjs';

const HERE = fileURLToPath(new URL('.', import.meta.url));
export const MAX_BYTES = 5 * 1024 * 1024;
export const MAX_PAGES = 15;
const MEDIA = { pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp' };
export const ROLES = ['form', 'notice', 'mixed', 'unknown'];

export const ROLE_SYSTEM = `한국 대학 장학금 공고에 붙은 첨부 파일 하나를 봅니다. 이 파일이 무엇인지 하나만 고르세요.
- form: 학생이 채워 내는 신청서·지원서·동의서·서약서·계획서 같은 **서식**(이름·학번 같은 빈칸, 서명란, 체크 칸이 중심)
- notice: 읽는 **공고문·안내문**(지원자격·신청기간·선발인원·제출서류 같은 안내가 중심 · 포스터 포함)
- mixed: 한 파일 안에 공고문과 그 뒤에 붙은 서식이 **둘 다** 있다
- unknown: 위 셋 중 무엇인지 확신할 수 없다(글자가 안 보이거나, 장학금과 상관없는 파일)
evidence 에는 판단의 근거가 된 문구를 파일에서 보이는 그대로 한두 개 적습니다(예: 「위와 같이 신청합니다」, 「1. 지원자격」). 확신이 없으면 unknown 입니다.`;
export const ROLE_SCHEMA = {
  type: 'object',
  properties: { role: { type: 'string', enum: ROLES }, evidence: { type: 'string' } },
  required: ['role', 'evidence'],
  additionalProperties: false,
};

export const keyOf = (id, name) => `${id}|${name}`;
const sha1 = (buf) => crypto.createHash('sha1').update(buf).digest('hex').slice(0, 16);
/* PDF 쪽 수 — 쪽 객체를 센다(pdfinfo 없이 · 객체 스트림 꼴은 0 이 나온다 = 모름 → 보내지 않는다 · 비용을 모르는 파일에 돈을 쓰지 않는다) */
/* 🔴 객체 스트림이 섞인 PDF 는 쪽 객체가 덜 보인다 — 쪽 나무의 /Count 가장 큰 값과 견줘 **큰 쪽**을 쓴다(리뷰: 1쪽으로 세고 80쪽을 보낼 뻔) */
export function pdfPages(buf) {
  const t = buf.toString('latin1');
  const objs = (t.match(/\/Type\s*\/Page(?![s\w])/g) || []).length;
  const counts = [...t.matchAll(/\/Type\s*\/Pages[^>]*?\/Count\s+(\d+)|\/Count\s+(\d+)[^>]*?\/Type\s*\/Pages/g)].map((m) => Number(m[1] || m[2]));
  return Math.max(objs, ...counts, 0);
}

/** 두 답 → 실을 답(둘이 같고 unknown 이 아닐 때만) 또는 null */
export function agreeRole(a, b) {
  const ra = a && a.role, rb = b && b.role;
  return ra && ra === rb && ROLES.includes(ra) && ra !== 'unknown' ? ra : null;
}

/** 물을 파일 — 마감 전 정식 등록 공고의 첨부 중, 받아 둔 원본이 PDF·그림이고, 글자로 못 가른 것(docRole null), 아직 이 바이트로 안 물은 것 */
export function pickRoleTargets(items, rows, { today, extractedDir, ledger = {}, giveUpAfter = 3, findRow, isOpen }) {
  const out = [];
  for (const it of items || []) {
    if (!it || !it.id || it.program || it.hidden || !isOpen(it, today)) continue;
    const seen = new Set();
    for (const a of it.attachments || []) {
      const nm = cleanAttachName(a && a.name);
      if (!nm || seen.has(nm) || a.bodyImage) continue;
      seen.add(nm);
      const row = findRow(it, a, rows);
      if (!row) continue;
      const ext = (String(row.file).match(/\.([a-z]+)$/i) || [])[1];
      const media = ext && MEDIA[ext.toLowerCase()];
      if (!media) continue;
      const file = path.join(extractedDir, row.file);
      let buf; try { buf = fs.readFileSync(file); } catch { continue; }
      if (buf.length > MAX_BYTES) continue;
      if (media === 'application/pdf') { const n = pdfPages(buf); if (!n || n > MAX_PAGES) continue; }
      /* 🔴 **글자 없는 파일만**(한글 40자 미만 — docRole 이 '모름'을 내는 바로 그 문턱) · 글자가 있는데 표식이 약해 '모름'인 파일은 이름 규칙 그대로(돈을 안 쓴다 · 리뷰) */
      if (roleText(file).replace(/[^가-힣]/g, '').length >= 40) continue;
      const hash = sha1(buf), key = keyOf(it.id, a.name), led = ledger[key] || {};
      if (led.hash === hash && (led.done || (led.tries || 0) >= giveUpAfter)) continue;
      out.push({ it, a, row, file, media, hash, key, bytes: buf.length });
    }
  }
  const dl = (t) => t.it.deadline || '9999';
  return out.sort((x, y) => (dl(x) < dl(y) ? -1 : dl(x) > dl(y) ? 1 : 0));
}

async function askRole(client, model, t, effort) {
  const data = fs.readFileSync(t.file).toString('base64');
  const block = t.media === 'application/pdf'
    ? { type: 'document', source: { type: 'base64', media_type: t.media, data } }
    : { type: 'image', source: { type: 'base64', media_type: t.media, data } };
  /* 카드 읽기(ask)와 같은 꼴 — thinking 을 끄지 않는다(5.5 계열은 끄면 400) · 꼴은 output_config.format · 거절 대비 서버 쪽 대체 모델 */
  const stream = client.beta.messages.stream({
    model, max_tokens: 16000,   // 생각이 켜져 있어 넉넉히 — 잘리면 쓴 돈만 남고 답이 없다(리뷰)
    betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default',
    system: ROLE_SYSTEM,
    output_config: { effort, format: { type: 'json_schema', schema: ROLE_SCHEMA } },
    messages: [{ role: 'user', content: [block, { type: 'text', text: `공고 제목: ${t.it.name}\n첨부 이름: ${t.a.name}` }] }],
  });
  const msg = await stream.finalMessage();
  if (msg.stop_reason === 'refusal') throw new Error('모델이 처리를 거절함');
  if (msg.stop_reason === 'max_tokens') throw new Error('출력이 잘림');
  const text = msg.content.find((b) => b.type === 'text');
  if (!text) throw new Error('글자 응답이 없음');
  const u = msg.usage || {}, [pi, po] = PRICE[model] || [0, 0];
  return { out: JSON.parse(text.text), usd: ((u.input_tokens || 0) * pi + (u.output_tokens || 0) * po) / 1e6 };
}

/* ── 본편 ── */
export async function runAttachRole({ root, today, write = false, env = process.env, log = (m) => console.log(`[attach-role] ${m}`) } = {}) {
  process.env.FORM_PDF_AS_LIB = '1';
  const FP = await import('./form-pdf.mjs');
  const rd = (rel, dflt) => { try { return JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8')); } catch { return dflt; } };
  /* 노력값은 카드 읽기(effort)와 **따로**(roleEffort · 기본 low) — 칸 하나를 고르는 일이라 깊이 생각할 일이 아니다 · 시간 예산은 단계 시한(6분)보다 짧게 */
  const cfg = { enabled: false, roleEffort: 'low', roleMaxPerRun: 10, roleMaxUsdPerRun: 1, roleMaxMs: 270000, giveUpAfter: 3, ...rd('collector/card-read-config.json', {}) };
  const outPath = path.join(root, 'collector', 'attach-role-paid.json');
  const data = rd('collector/attach-role-paid.json', { items: {} });
  if (!data.items || typeof data.items !== 'object') data.items = {};
  const reg = rd('data/registered.json', { items: [] }).items || [];
  const idxPath = path.join(root, 'collector', 'extracted', 'forms-index.txt');
  const rows = fs.existsSync(idxPath) ? FP.parseFormsIndex(fs.readFileSync(idxPath, 'utf8')) : [];
  loadFormRules(root);   // data.js 가 없는 저장소면 여기서 멈춘다(양식 로봇과 같은 전제)

  /* 마감이 지나거나 사라진 공고의 줄은 뺀다(자라기만 하지 않게) */
  const live = new Set(reg.filter((it) => it && it.id && !it.hidden && FP.isOpen(it, today)).map((it) => it.id));
  let pruned = 0;
  for (const k of Object.keys(data.items)) if (!live.has(k.split('|')[0])) { delete data.items[k]; pruned += 1; }

  const targets = pickRoleTargets(reg, rows, { today, extractedDir: path.join(root, 'collector', 'extracted'), ledger: data.items, giveUpAfter: cfg.giveUpAfter, findRow: FP.findRow, isOpen: FP.isOpen });
  log(`대상 ${targets.length}개 (마감 전 정식 등록 · 글자로 못 가른 PDF·그림 · ${MAX_PAGES}쪽·5MB 이하 · 이 바이트로 아직 안 물음) · 실린 답 ${Object.values(data.items).filter((e) => e.role).length}개 · 뺀 줄 ${pruned}`);
  const save = () => { data.updatedAt = today; const tmp = `${outPath}.tmp`; fs.writeFileSync(tmp, `${JSON.stringify(data, null, 1)}\n`); fs.renameSync(tmp, outPath); };
  if (!write) { targets.slice(0, 30).forEach((t) => log(`  · ${t.key} · ${t.row.file} · ${Math.round(t.bytes / 1024)}KB`)); log('미리보기 — 부르지 않았습니다 (--write 로 반영)'); return { targets, called: 0 }; }
  const fake = env.ATTACH_ROLE_FAKE ? JSON.parse(fs.readFileSync(env.ATTACH_ROLE_FAKE, 'utf8')) : null;
  const paidOn = cfg.enabled === true && env.CARD_READ_ENABLE === '1';
  if (!fake && !paidOn) { if (pruned) save(); log(`유료 스위치가 꺼져 있어 부르지 않았습니다 (card-read-config.json enabled: ${cfg.enabled} · CARD_READ_ENABLE: ${env.CARD_READ_ENABLE || '없음'})`); return { targets, called: 0 }; }

  let client = null;
  if (!fake) { const { default: Anthropic } = await import('@anthropic-ai/sdk'); client = new Anthropic(); }
  let usd = 0, done = 0, failed = 0, streak = 0, put = 0, stopped = '';
  const t0 = Date.now();
  try {
    for (const t of targets) {
      if (done + failed >= cfg.roleMaxPerRun) { stopped = `한 실행 상한 ${cfg.roleMaxPerRun}개`; break; }
      if (usd >= cfg.roleMaxUsdPerRun) { stopped = `한 실행 예산 $${cfg.roleMaxUsdPerRun}`; break; }
      if (streak >= 3) { stopped = '연달아 실패'; break; }
      if (Date.now() - t0 >= cfg.roleMaxMs) { stopped = '시간 예산'; break; }   // 단계 시한에 끊기면 쓴 돈이 장부에 안 남는다(리뷰)   // 잔액 부족·요청 꼴 오류가 상한까지 돈을 쓰며 돌지 않게(카드 읽기와 같은 이유)
      if (fake && !fake[t.key]) continue;
      const led = data.items[t.key] = { ...(data.items[t.key] || {}), id: t.it.id, name: t.a.name };
      if (led.hash !== t.hash) { Object.assign(led, { hash: t.hash, file: t.row.file, tries: 0, done: false }); delete led.role; delete led.a; delete led.b; }
      const [sa, sb] = fake ? [{ status: 'fulfilled', value: { out: fake[t.key].a, usd: 0 } }, { status: 'fulfilled', value: { out: fake[t.key].b, usd: 0 } }]
        : await Promise.allSettled([askRole(client, MODELS.a, t, cfg.roleEffort), askRole(client, MODELS.b, t, cfg.roleEffort)]);
      const spent = (sa.status === 'fulfilled' ? sa.value.usd : 0) + (sb.status === 'fulfilled' ? sb.value.usd : 0);
      usd += spent; led.usd = Math.round(((led.usd || 0) + spent) * 10000) / 10000;
      if (sa.status === 'fulfilled' && sb.status === 'fulfilled') {
        const role = agreeRole(sa.value.out, sb.value.out);
        Object.assign(led, { done: true, at: today, a: sa.value.out, b: sb.value.out });
        if (role) { led.role = role; put += 1; } else delete led.role;
        delete led.error; done += 1; streak = 0;
        log(`  ✓ ${t.key} · ${role ? `실음 ${role}` : `안 실음(두 답이 다름: ${sa.value.out && sa.value.out.role} / ${sb.value.out && sb.value.out.role})`}`);
      } else {
        failed += 1; streak += 1; led.tries = (led.tries || 0) + 1;
        led.error = String(((sa.status === 'rejected' ? sa.reason : sb.reason) || {}).message || '').slice(0, 200);
        log(`  ✕ ${t.key} · ${led.error}`);
      }
      save();   // 파일마다 — 중간에 끊겨도 돈을 쓴 답을 잃지 않는다
    }
  } finally { save(); }
  log(`끝 — 물음 ${done}개(실음 ${put}) · 실패 ${failed}개 · 쓴 돈 $${usd.toFixed(4)}${stopped ? ` · 멈춘 까닭: ${stopped}` : ''}`);
  return { targets, called: done + failed, failed, put, usd };
}

const ranDirectly = () => { try { return fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url)); } catch { return false; } };
if (process.argv[1] && ranDirectly()) {
  const root = process.env.ATTACH_ROLE_ROOT ? path.resolve(process.env.ATTACH_ROLE_ROOT) : path.resolve(HERE, '..');
  const today = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
  const r = await runAttachRole({ root, today, write: process.argv.includes('--write') });
  if (r.failed) process.exit(1);   // 실패가 있으면 빨갛게 — 물은 것은 이미 저장했다(카드 읽기와 같은 규칙)
}

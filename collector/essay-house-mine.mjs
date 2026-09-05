/* ============================================================
   한대장 — 집 안 자료에서 작성 규칙 캐기 (2026-08-24 신설)
   ------------------------------------------------------------
   개발자 지시: **"크롤링 출처를 계속 넓혀라. 사용자의 직접적인 양식 제시 없이."**

   그래서 바깥 주소를 더 찾기 전에 **집 안부터 봤다.** 이 저장소에는 이미
   공고 원문 403건과 첨부 원본 211건의 글자가 들어 있다(collector/extracted/).
   그리고 거기에는 일반 자소서 팁보다 나은 것이 있다 —

     🔴 **재단이 자기 입으로 적어 둔 작성 규정.**

   실제로 나온 줄(서울인재대학장학금):
     · "자기소개서에 소속 대학교를 식별할 수 있는 정보(학교명 등)를 기재한 경우 심사에서 제외"
     · "자기소개서 전체 분량이 1페이지 미만인 경우 심사에서 제외됩니다."
     · "2페이지를 초과한 경우 페이지당 0.5점 감점됩니다."
     · "<소득기준 [평가기준1순위]> <학업성적 [평가기준2순위]> <사회공헌 [평가기준3순위]>"

   첫 줄이 왜 중요한가: 우리는 프로필의 학교를 초안 서버에 보낸다. 막지 않으면
   **앱이 만들어 준 초안 때문에 학생이 심사에서 제외된다.** 지어냄보다 결과가 무겁다.

   ── 이 로봇이 만드는 것 둘 ──
   ① `data/essay-form-rules.json` — **공고별** 작성 규정(원문 그대로 발췌).
      앱이 초안을 만들 때 그 공고의 규정을 조건으로 함께 보낸다.
      🔴 원문 발췌는 이 앱의 기존 방식이다(운영 원칙 8-1 · registered.json 의 excerpts).
         우리가 요약하거나 바꿔 쓰지 않는다 — 재단의 말이 우리 말보다 정확하다.
   ② 공통 규칙 후보 — 여러 공고에 되풀이되는 문구는 `data/essay-playbook.json` 에
      붙일 후보로 리포트에 올린다(사람이 컨펌).

   비용 0 · 네트워크 0 · 저작권 안전(이미 우리 저장소에 있는 글이다).
   ============================================================ */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { indexTexts, sourceFor, normTitle, canonUrl } from './notice-source.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const EX = path.join(ROOT, 'collector/extracted');
const WRITE = process.argv.includes('--write');

/* ── 무엇이 '작성 규정'인가 ──
   🔴 버릴 것을 열거하지 않는다. **규정임을 증명**해야 담긴다
      (essay-rule-line.mjs 의 DOMAIN 과 같은 계열).
   ⓐ 자기소개서/지원서 이야기이면서 ⓑ 지켜야 할 것을 말하는 줄만. */
const ABOUT = /(자기소개서|자소서|학업\s*계획서|수학\s*계획서|성장\s*계획서|서술)/;
/* 🔴 '어떻게 낼 것인가'가 아니라 '어떻게 쓸 것인가'만 담는다.
   처음 만들 때 이 조건이 느슨해서 방문 제출·등기우편·날인 같은 **접수 안내**가
   45건이나 잡혔다. 초안을 쓰는 데 아무 소용이 없는 줄이다. */
/* 🔴 2026-09-05: 문체 지시를 보탰다. 전수조사에서 한국외대 이백장학금의
   `자기소개서는 개조식이 아닌 서술식으로 작성` 이 여기 걸릴 낱말이 없어 떨어지고 있었다 —
   초안을 쓰는 데 **직접 쓰이는** 규정인데도 그랬다. 좁게만 넣는다(문체를 말하는 낱말뿐). */
const RULEISH = /(심사에서\s*제외|감점|분량|페이지|\d{2,4}\s*자\s*(이내|이상)|공란|기재한\s*경우|기재하지|작성\s*요령|기재\s*요령|작성\s*규정|평가\s*기준\s*\d\s*순위|식별할\s*수\s*있는|서술식|개조식|줄글)/;
/* 규정이 아니라 '무엇을 내라'는 목록 — 서류 체크리스트는 초안과 상관이 없다 */
const NOT_RULE = /^(\s*[\d①-⑩][.)]?\s*)?(자기소개서|성적증명서|재학증명서|주민등록|가족관계|통장|추천서)[^가-힣]{0,6}(\d\s*부|사본)?\s*$/;
/* 접수·제출 안내는 규정이 아니다 — 글을 쓰는 데 쓰이지 않는다 */
const SUBMIT_ONLY = /(방문\s*제출|등기우편|우편\s*송부|이메일\s*제출|업로드|날인|서명란|파일명|접수\s*기간|제출\s*기한|홈페이지에서\s*다운)/;

/* 제목·머리글은 규정이 아니다 — 학생에게 '규칙'으로 보여 주면 소음이다.
   실제로 새어 나온 것: `[자기소개서 작성 규정 및 감점 기준]`(대괄호 머리글),
   `※ 제출 전 … 안내문을 모두 삭제`(서식 설명박스 안내). */
const META_LINE = /^[\[「【][^\]」】]{2,40}[\]」】]\s*$|안내문을?\s*모두\s*삭제|설명박스|본\s*문구를\s*포함/;

export function isFormRule(line) {
  const t = String(line || '').replace(/\s+/g, ' ').trim().replace(/^[-–—·•●▶▸◆■□▣①②③④⑤⑥⑦⑧⑨⑩\d]+[.)]?\s*/, '');
  if (t.length < 10 || t.length > 200) return null;
  if (NOT_RULE.test(t) || SUBMIT_ONLY.test(t) || META_LINE.test(t)) return null;
  /* 재단이 **심사 순위를 직접 밝힌** 줄은 자기소개서 이야기가 아니어도 담는다.
     실제 문구: `<소득기준 [평가기준1순위]>` `<학업성적 [평가기준2순위]>` `<사회공헌 [평가기준3순위]>`
     B(무엇을 앞세울까)의 근거가 되는 가장 정확한 재료다 — 우리 짐작보다 낫다. */
  if (/(평가|심사)\s*기준\s*\d\s*순위/.test(t)) return t;
  if (!ABOUT.test(t) || !RULEISH.test(t)) return null;
  return t;
}

/** 이 공고가 블라인드 심사인가 — 규정 줄에서 읽는다 */
export const isBlind = (lines) =>
  lines.some((l) => /식별할\s*수\s*있는\s*정보|학교명[\s\S]{0,24}(기재|표기)[\s\S]{0,24}(제외|감점)|블라인드/.test(l));

/* ── 집 안 자료 읽기 ── */
function readJson(p, dflt) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return dflt; } }

/** 첨부 파일 → 그 첨부가 붙어 있던 공고 제목 (forms-index.txt) */
function attachmentOwners() {
  const out = new Map();
  let raw = '';
  try { raw = fs.readFileSync(path.join(EX, 'forms-index.txt'), 'utf8'); } catch { return out; }
  for (const line of raw.split('\n')) {
    const [file, title] = line.split('\t');
    if (file && title) out.set(file.trim(), title.trim());
  }
  return out;
}

/** 그 첨부의 글자 파일들 (.body.txt · .hwp.txt) */
function textFilesFor(file) {
  const base = file.replace(/\.[a-z0-9]+$/i, '');
  return fs.readdirSync(EX).filter((f) => f.startsWith(base) && /\.(body\.txt|hwp\.txt|txt)$/.test(f));
}

/* ── 같은 사업인가 — 주소가 다를 때의 마지막 수단 ──

   🔴 이 저장소의 규칙은 "제목으로 느슨하게 잇지 말 것"이다. 실제로 그러다
      `복지장학금 (서울캠퍼스)`가 `(다빈치캠퍼스)` 공고에 붙은 사고가 있었다.
      그런데 여기에는 그 규칙을 그대로 적용할 수 없는 사정이 있다 —

      **작성 규정은 '그 게시글'의 성질이 아니라 '그 사업'의 성질이다.**
      서울인재대학장학금은 동국대·상명대·서울대·중앙대가 각자 자기 게시판에 올린다.
      재단 서식(첨부)은 그중 한 곳에서만 받아 두었고, "학교명을 쓰면 심사에서 제외"는
      **네 곳 모두의 지원자에게 해당한다.** 주소로만 이으면 세 곳 학생은 보호받지 못한다.

   그래서 이 길은 **보호용 규정에만** 연다. 근거는 틀렸을 때의 방향이 다르다는 것이다:
     · 놓치면(false negative) → 학생이 학교명을 적어 **심사에서 제외된다.**
     · 잘못 붙으면(false positive) → 글이 조금 덤덤해질 뿐, 학생이 잃는 것이 없다.
   한쪽만 위험한 판정에서는 안전한 쪽으로 기운다.

   대신 조건을 좁게 뒀다: **그 사업만의 긴 낱말**(6자 이상)이 두 제목에 함께 있어야 한다.
   '장학금'·'선발'처럼 아무 데나 있는 말은 낱말로 세지 않는다. */
const GENERIC = /^(장학금|장학생|선발|공고|안내|모집|신청|대학생|학년도|재단|사업|프로그램)$/;
export function bizTokens(title) {
  const out = new Set();
  for (const m of String(title || '').matchAll(/[가-힣]{5,}/g)) {
    const w = m[0];
    if (GENERIC.test(w)) continue;
    out.add(w);
    /* '서울인재대학장학금' ↔ '서울인재대학장학금장학생' 처럼 꼬리가 붙어도 같게 본다 */
    const stem = w.replace(/(장학금|장학생|장학|선발|공고|안내)$/g, '');
    if (stem.length >= 5) out.add(stem);
  }
  return out;
}
export function sameProgram(a, b) {
  const A = bizTokens(a), B = bizTokens(b);
  for (const t of A) if (B.has(t)) return t;
  return '';
}
/** 사업 이름으로 물려받아도 되는 줄인가 — **틀렸을 때 학생이 잃는 것이 없는 것만.**

    ⓐ 블라인드·심사 제외 — 놓치면 탈락한다. 잘못 붙으면 글이 조금 덤덤해질 뿐이다.
    ⓑ 평가 순위 — 무엇을 앞 문단에 둘지 정할 뿐이다. 잘못 붙어도 강조점이 달라질 뿐.

    🔴 **분량·감점 규정은 물려받지 않는다.** "2페이지 초과 시 감점"이 그 규정이 없는
       공고에 잘못 붙으면 학생이 **멀쩡한 내용을 잘라 낸다** — 이건 손해다.
       그런 줄은 주소로 확실히 이어진 공고에만 붙는다. */
export const isInheritable = (line) =>
  /(심사에서\s*제외|식별할\s*수\s*있는|블라인드|(평가|심사)\s*기준\s*\d\s*순위)/.test(String(line || ''));

export function mine() {
  const reg = readJson(path.join(ROOT, 'data/registered.json'), { items: [] });
  const items = Array.isArray(reg) ? reg : (reg.items || []);
  const texts = readJson(path.join(EX, 'notices-text.json'), []);
  const bodies = readJson(path.join(EX, 'browser-bodies.json'), {});
  const idx = indexTexts(Array.isArray(texts) ? texts : Object.values(texts), bodies);
  const owners = attachmentOwners();

  /* 🔴 첨부를 공고에 이을 때 **제목으로 잇지 않는다.**
     등록 이름은 사람이 다듬은 것이고(`[홍보] 2026년 하반기 서울인재대학장학금 장학생 선발`)
     게시판 제목은 다른 글자다(`장학 2026년 서울미래인재재단 … 선발 안내(1학년 대상, …)`) —
     느슨하게 대조하면 **남의 공고 규정이 붙는다**(22차 세션 사고와 같은 계열).
     그래서 forms-index 의 제목 → 수집기가 저장한 그 공고의 **주소**로 한 번 옮긴 뒤,
     주소로 등록 공고와 잇는다. 주소는 수집기·발췌기가 쓰는 것과 같은 열쇠다. */
  const urlOfTitle = new Map();
  for (const t of (Array.isArray(texts) ? texts : Object.values(texts))) {
    if (t && t.title && t.url) urlOfTitle.set(normTitle(t.title), t.url);
  }
  const byUrl = new Map();
  for (const [file, title] of owners) {
    const url = urlOfTitle.get(normTitle(title));
    if (!url) continue;
    const k = canonUrl(url);
    if (!byUrl.has(k)) byUrl.set(k, []);
    for (const t of textFilesFor(file)) byUrl.get(k).push(t);
  }

  /* 첨부에서 캔 줄을 **그 첨부가 붙어 있던 게시글 제목**과 함께 들고 있는다.
     주소로 못 이은 공고에는 사업 이름으로 물려준다(보호용만). */
  const programRules = [];
  for (const [file, title] of owners) {
    const got = [];
    for (const tf of textFilesFor(file)) {
      let raw = '';
      try { raw = fs.readFileSync(path.join(EX, tf), 'utf8'); } catch { continue; }
      for (const l of raw.split('\n')) { const r = isFormRule(l); if (r && !got.includes(r)) got.push(r); }
    }
    if (got.length) programRules.push([title, got]);
  }

  const perNotice = {};
  const seenLine = new Map();   // 같은 문구가 몇 공고에 나오나 — 공통 규칙 후보 판정용
  let scanned = 0;

  for (const it of items) {
    const lines = [];
    /* ⓐ 공고 본문 */
    const src = sourceFor(it, idx);
    if (src && src.text) for (const l of String(src.text).split('\n')) { const r = isFormRule(l); if (r) lines.push(r); }
    /* ⓑ 그 공고의 첨부 (자기소개서 서식 안에 규정이 들어 있다) — 주소로 잇는다 */
    const keys = [it.sourceUrl, it.url, src && src.url].filter(Boolean).map(canonUrl);
    for (const k of [...new Set(keys)]) {
      for (const tf of (byUrl.get(k) || [])) {
        let raw = '';
        try { raw = fs.readFileSync(path.join(EX, tf), 'utf8'); } catch { continue; }
        for (const l of raw.split('\n')) { const r = isFormRule(l); if (r) lines.push(r); }
      }
    }
    /* ⓒ 같은 사업의 다른 게시글에서 캔 **보호용 규정**을 물려받는다 (위 주석 참조) */
    for (const [title, rules] of programRules) {
      const tok = sameProgram(it.name, title) || sameProgram(it.boardTitle || '', title);
      if (!tok) continue;
      /* 🔴 얼마나 확신하느냐에 따라 물려받는 범위를 나눈다.
         '서울인재대학장학금'(9자)처럼 그 사업만의 긴 이름이면 같은 사업이 거의 확실하다 →
         분량·감점 규정까지 물려받는다. '삼일장학회'(5자)처럼 짧으면 안전한 것만.
         (이 구분이 없으면 둘 중 하나를 잃는다 — 다 받으면 엉뚱한 분량 규정이 붙고,
          다 막으면 블라인드 공고의 감점 기준이 통째로 사라진다. 실제로 둘 다 겪었다.) */
      const sure = tok.length >= 7;
      for (const l of rules) if ((sure || isInheritable(l)) && !lines.includes(l)) lines.push(l);
    }
    if (!lines.length) continue;
    scanned++;
    const uniq = [];
    for (const l of lines) if (!uniq.includes(l)) uniq.push(l);
    perNotice[it.id] = { blind: isBlind(uniq), lines: uniq.slice(0, 8) };
    for (const l of uniq) seenLine.set(l, (seenLine.get(l) || 0) + 1);
  }

  /* ── 등록 목록 밖의 원문도 학습 재료로 본다 (2026-09-05) ──
     🔴 그동안 이 로봇은 registered.json(지금 서비스하는 공고)만 훑었다. 그래서 학교를
        경희대·한국외대로 줄이자 **이미 받아 둔 원문에 들어 있던 작성 규정이 함께 사라졌다.**
        전수조사에서 실제로 그런 것이 나왔다 — 한국외대 이백장학금의
        `자기소개서는 개조식이 아닌 서술식으로 작성`.
     🔴 앱이 쓰는 칸(perNotice)에는 넣지 않는다. 학생에게 보여 줄 공고가 아니기 때문이다.
        여기 모인 것은 **공통 규칙 후보 판정과 사람 검수용**이다(리포트에만). */
  const covered = new Set();
  for (const it of items) for (const k of [it.sourceUrl, it.url].filter(Boolean)) covered.add(canonUrl(k));
  const library = [];
  const corpus = [
    ...(Array.isArray(texts) ? texts : Object.values(texts)),
    ...Object.entries(bodies).map(([url, v]) => ({ url, title: (v && v.title) || '', school: (v && v.school) || '', text: typeof v === 'string' ? v : (v && v.text) })),
  ];
  for (const c of corpus) {
    if (!c || !c.url || covered.has(canonUrl(c.url))) continue;
    const got = [];
    for (const l of String(c.text || '').split('\n')) { const r = isFormRule(l); if (r && !got.includes(r)) got.push(r); }
    if (!got.length) continue;
    library.push({ school: c.school || '', title: String(c.title || '').slice(0, 60), url: c.url, lines: got.slice(0, 8) });
    for (const l of got) seenLine.set(l, (seenLine.get(l) || 0) + 1);
  }

  /* 여러 공고에 되풀이되는 문구 = 공통 규칙 후보 (검색 요약과 같은 문턱 2건) */
  const common = [...seenLine.entries()].filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1]).slice(0, 20)
    .map(([text, n]) => ({ text, notices: n }));

  return { perNotice, common, scanned, total: items.length, library };
}

/* ── 실행 ── */
if (process.argv[1] && process.argv[1].endsWith('essay-house-mine.mjs')) {
  const { perNotice, common, scanned, total, library } = mine();
  const blind = Object.values(perNotice).filter((v) => v.blind).length;
  const out = {
    _설명: '공고별 작성 규정 — 재단이 공고·첨부에 직접 적어 둔 문장 그대로. collector/essay-house-mine.mjs 가 만든다.',
    '_왜 원문 그대로인가': '우리가 요약하면 뜻이 바뀐다. 재단의 말이 우리 말보다 정확하다(운영 원칙 8-1 · 발췌 원칙과 같은 계열).',
    '_blind': '학교명을 쓰면 심사에서 제외되는 공고. 앱이 초안에서 학교 이름을 지운다(server/essay/draft-guard.mjs scrubSchool).',
    updatedAt: new Date().toISOString().slice(0, 10),
    notices: perNotice,
  };

  const md = [
    `# 집 안 자료에서 캔 작성 규정 — ${out.updatedAt}`,
    '',
    `등록 공고 ${total}건 중 **${scanned}건**에서 작성 규정을 찾았습니다. 그중 **블라인드 심사 ${blind}건**.`,
    '',
    '🔴 바깥에서 긁어 온 것이 아닙니다. **이미 우리 저장소에 있는 공고 원문·첨부**에서 캤습니다 — 비용 0 · 네트워크 0.',
    '',
    '## 블라인드 심사 공고 (학교명을 쓰면 심사 제외)',
    blind
      ? Object.entries(perNotice).filter(([, v]) => v.blind)
          .map(([id, v]) => `- \`${id}\`\n  <sub>${v.lines.find((l) => /식별|학교명|블라인드/.test(l)) || ''}</sub>`).join('\n')
      : '없습니다.',
    '',
    '## 여러 공고에 되풀이되는 문구 — 공통 규칙 후보 (컨펌 대기)',
    common.length
      ? common.map((c) => `- (${c.notices}개 공고) ${c.text}`).join('\n')
      : '없습니다.',
    '',
    '## 등록 목록 밖의 원문에서 캔 것 — 학습 재료 (앱에는 안 나감)',
    library.length
      ? library.map((x) => `- ${x.school || '(미상)'} · ${x.title}\n${x.lines.map((l) => `    · ${l}`).join('\n')}`).join('\n')
      : '없습니다. (2026-09-05 전수조사: 저장된 공고 원문 320건·첨부 293개를 훑어 0건 — 대부분의 공고는 자기소개서를 *제출 서류*로만 적고 작성 규정은 첨부 서식 안에 있는데, 그 첨부의 절반 이상이 PDF·DOCX 라 아직 글자를 못 뽑는다)',
    '',
    '## 공고별 규정 (앞 12건)',
    Object.entries(perNotice).slice(0, 12)
      .map(([id, v]) => `- \`${id}\`${v.blind ? ' 🔴블라인드' : ''}\n${v.lines.map((l) => `    · ${l}`).join('\n')}`).join('\n') || '없습니다.',
  ].join('\n');

  fs.writeFileSync(path.join(ROOT, 'collector/essay-house-report.md'), md + '\n');
  if (WRITE) fs.writeFileSync(path.join(ROOT, 'data/essay-form-rules.json'), JSON.stringify(out, null, 2) + '\n');
  console.log(md);
  console.log(`\n${WRITE ? '저장했습니다 — data/essay-form-rules.json' : '미리보기 — 저장하려면 --write'}`);
}

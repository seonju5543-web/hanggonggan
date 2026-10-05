/* 학생이 앱 안에서 쓸 수 있는 양식이 **열린 공고 몇 건에** 붙어 있나 · 쓰지 않는 옛 양식 중 같은 사업으로 보이는 것 (2026-10-05 점검 app1-03·app1-08)

   왜 — 2026-10-04 기준 열린 정식 등록 86건 중 양식이 붙은 것은 3건, 학생이 실제로 열 수 있는 것은 1건이었다. 그런데 이 숫자는
   **아무 리포트에도 없었다** — 양식 로봇(schematize-forms)은 '이번 실행에 만든 것'만 말해서, 0건이 매일 이어져도 조용했다.
   그리고 data/forms.json 의 양식 56종 중 37종은 어떤 등록도 쓰지 않는다(2026-08-30 정식 등록 211건을 지울 때 양식만 남았다).
   새로 수집된 같은 사업(세종연구원 세종이도인재장학금 등)은 새 id 로 들어와 옛 양식과 이어지지 않는다.
   🔴 옛 양식을 **자동으로 잇지 않는다**(개발자 결정 2026-10-05 · 추천안 ①) — 양식은 해마다 바뀔 수 있다(원칙 4: 공고 첨부 신청서와 같은 구조).
      리포트에 후보로만 띄우고, 사람이 원문 신청서와 대조한 뒤 관리자 화면(tools/admin-apply.mjs edit · formId)으로 잇는다.

   🔴 이 파일에는 실행 코드가 없다(불러도 아무것도 읽고 쓰지 않는다) — 관문이 표본으로 잰다. 양식 로봇이 리포트에 싣는다.
   '열린 공고' 판정은 베끼지 않는다: 마감이 있으면 registered-merge.mjs openOn(로봇 공용) · 마감이 없으면 앱과 같은 match-engine.js notStale. */
import { createRequire } from 'node:module';
import { openOn } from './registered-merge.mjs';

const require = createRequire(import.meta.url);
const { notStale } = require('../match-engine.js');
const { programKey } = require('../verify/entry-rules.cjs');

/** 학생이 지금 신청할 수 있는 등록분인가 — 마감 전(마감 모름이면 등록 뒤 60일 안) */
export const isOpenListing = (it, today, now) => !!it && openOn(it, today) && notStale(it, now);

/**
 * 열린 공고 중 양식이 붙은 것.
 *   items     : data/registered.json items
 *   templates : data/forms.json templates (id → 양식)
 * 돌려준 값: { open, withForm, ids } — ids 는 양식이 붙은 열린 공고 id(양식 id 가 forms.json 에 실제로 있는 것만)
 */
export function formReach(items, templates, today, now) {
  const tpl = templates || {};
  const open = (items || []).filter((it) => isOpenListing(it, today, now));
  const ids = open.filter((it) => it.formId && tpl[it.formId]).map((it) => it.id);
  return { open: open.length, withForm: ids.length, ids };
}

/* 양식 제목 → 사업 이름 낱말. 양식 문서를 가리키는 말(신청서·지원서·선발원서·계획서·외 N종…)·법인 표기·연도·학기를 걷는다. */
const DOC_WORDS = /(지원\s*신청서|신청서|지원서|선발\s*원서|지급\s*원서|입소\s*지원서|장학\s*지원서|활동\s*계획서|학업\s*계획서|계획서|자기\s*소개서|이력서|서식|학생용|외\s*\d+\s*종)/g;
const NOISE = /\[[^\]]*\]|\(재\)|\(사\)|재단법인|사단법인|학교법인|20\d{2}(-\d)?\s*(학년도|년도|년)?|\d\s*학기|(상|하)반기/g;
/* 사업을 가르지 못하는 흔한 낱말 — 이것만 겹치면 같은 사업이라 하지 않는다.
   근로장학은 학교마다 제 서식을 쓰므로(명지·상명·한양 실례) '근로' 낱말로는 잇지 않는다. */
const GENERIC = /^(장학금?|장학생|장학회|재단|공통|교내|교외|추가|모집|선발|신청|안내|지원|및|대학생|학생|학기중?|(국가|교내|학기중)?근로(장학생?|장학금)?)$/;
const words = (t) => String(t || '').replace(NOISE, ' ').replace(DOC_WORDS, ' ')
  .split(/[^가-힣A-Za-z0-9]+/).filter(Boolean);
/** 양식 제목에서 사업을 가르는 낱말(3자 이상 · 흔한 낱말 빼고) */
export const programWords = (title) => words(title).filter((w) => w.length >= 3 && !GENERIC.test(w));

/**
 * 쓰지 않는 양식 ↔ 양식 없는 열린 공고 — 같은 사업으로 보이는 짝(후보).
 *   ① 사업 열쇠(verify/entry-rules.cjs programKey — 범위 승격·자동 등록과 같은 열쇠)가 같다 · 또는
 *   ② 양식 제목의 사업 낱말(programWords)이 **전부** 공고 이름의 어느 한 낱말 안에 들어 있다(하나 이상 있을 때만)
 *      🔴 공고 이름을 붙여 쓴 글자로 대조하지 말 것 — 낱말 경계를 넘어 `2학기 중소기업` 이 `학기중` 으로 걸린다(첫 시험 실측).
 * 돌려준 값: [{ id, name, formId, title, why }] — 공고 id 순서 그대로 · 한 공고에 후보가 여럿이면 다 싣는다.
 */
export function oldFormCandidates(items, templates, today, now) {
  const tpl = templates || {};
  const used = new Set((items || []).map((it) => it.formId).filter(Boolean));
  const unused = Object.entries(tpl).filter(([id]) => !used.has(id));
  const open = (items || []).filter((it) => !it.formId && isOpenListing(it, today, now));
  const out = [];
  for (const it of open) {
    const name = String(it.name || '');
    const nameWords = words(name);
    const key = programKey(name);
    for (const [formId, t] of unused) {
      const title = String((t && t.title) || '');
      const tKey = programKey(words(title).join(' '));
      const pw = programWords(title);
      const byKey = !!key && key === tKey;
      const byWords = pw.length > 0 && pw.every((w) => nameWords.some((n) => n.includes(w)));
      if (byKey || byWords) out.push({ id: it.id, name, formId, title, why: byKey ? '사업 열쇠가 같음' : `이름 낱말 ${pw.join('·')}` });
    }
  }
  return out;
}

/** 리포트 단락(마크다운 줄 배열) — 양식 로봇이 매 실행 싣는다. apiOn: 유료 변환 스위치(schematize-config.json apiEnabled) 상태 */
export function formReachReport(items, templates, today, now, { apiOn = false } = {}) {
  const r = formReach(items, templates, today, now);
  const cands = oldFormCandidates(items, templates, today, now);
  const lines = ['', `### 📝 앱에서 바로 쓰는 양식 — 열린 공고 ${r.open}건 중 ${r.withForm}건`];
  if (r.withForm <= 1) {
    lines.push('', `🚨 **양식이 붙은 열린 공고가 ${r.withForm}건뿐이에요.** 나머지 공고는 학생이 원문 신청서를 내려받아 직접 채워야 해요.`
      + ` 유료 변환(collector/schematize-config.json 의 apiEnabled)은 지금 ${apiOn ? '켜져' : '꺼져'} 있어요 — 켤지는 개발자가 정합니다.`);
  }
  if (r.ids.length) lines.push('', ...r.ids.slice(0, 10).map((id) => `- \`${id}\``));
  if (cands.length) {
    lines.push('', `**같은 사업의 옛 양식 후보 ${cands.length}건** — 어떤 공고에도 안 붙은 양식 중 이름이 같은 사업으로 보이는 것이에요.`
      + ' 양식은 해마다 바뀔 수 있어 자동으로 잇지 않아요. 원문 신청서와 같은지 확인한 뒤에만 관리자 화면에서 잇습니다(formId).', '');
    for (const c of cands.slice(0, 15)) lines.push(`- \`${c.id}\` ${c.name.slice(0, 40)} ↔ 양식 \`${c.formId}\` 「${c.title.slice(0, 40)}」 (${c.why})`);
    if (cands.length > 15) lines.push(`- … 외 ${cands.length - 15}건`);
  }
  return lines;
}

/* ============================================================
   한대장 — 신청서 AI 초안 (앱 쪽)
   ------------------------------------------------------------
   🔴 이 파일의 목적 (개발자 지적 2026-08-23 이후 다시 세움):

     앱이 학생에게 "장학금 신청 사유를 자기소개서 형식으로 (A4 2장 내외)"라고
     적힌 빈 칸을 던지면 안 된다. 그 칸을 채울 수 있는 학생은 이 앱이 필요 없다.

       ① 학생은 **키워드만** 고르거나 짧게 적는다  (essay-ask.js 가 무엇을 물을지 정한다)
       ② 앱이 그것으로 **문단과 스토리텔링을 갖춘 제출 수준의 글**을 만든다

   지키는 약속 (계약 전문은 essay-config.js 첫머리):
     · 나오는 글은 **초안**이다 — 그렇게 적고 학생이 고칠 수 있게 둔다.
     · **사실 나열형 칸(kind !== 'story')에는 가지 않는다.**
     · **버튼을 눌러야 나간다.** 안 누르면 아무것도 나가지 않는다.
     · 실패하면 **학생이 쓴 원문을 그대로 둔다.** 절대 덮어쓰지 않는다.
     · endpoint 가 비어 있으면 **네트워크로 나가는 것이 하나도 없다.** 그때는 앱이
       고른 키워드를 칸에 옮겨만 준다 — 글까지 못 쓴다고 화면에 그대로 적는다.

   🔴 프로필에서 자동으로 채운 값(이름·학번·연락처·계좌·주민번호·성적·소득분위)은
      재료에 넣지 않는다. 나가는 것은 **학생이 이 화면에서 고르거나 친 것**과
      학교/학년/전공뿐이다. 서버도 같은 것을 한 번 더 거른다(server/essay/draft-guard.mjs).
   ============================================================ */

function essayOn() {
  return !!(typeof ESSAY_CONFIG !== 'undefined' && ESSAY_CONFIG && ESSAY_CONFIG.endpoint);
}
function essayCfg(k, dflt) {
  const c = (typeof ESSAY_CONFIG !== 'undefined' && ESSAY_CONFIG) || {};
  return c[k] != null ? c[k] : dflt;
}

/* 화면에 난 질문 중 AI가 도울 수 있는 칸 — kind 가 'story' 인 서술형만.
   🔴 kind 가 없으면 안 고른다. 애매할 때 안 건드리는 쪽이 안전한 방향이다. */
function essayStoryFields(plan) {
  const out = [];
  (plan.secs || []).forEach((sec) => (sec.items || []).forEach((f) => {
    if (f.type === 'textarea' && f.kind === 'story') out.push(f);
  }));
  return out;
}

/* 이 학생·이 공고에 맞춘 보기를 만들기 위해 넘기는 것.
   🔴 여기 담기는 것은 **기기 안에서 질문을 고르는 데만** 쓰인다.
      서버로 나가는 것은 학생이 실제로 고르거나 친 것뿐이다(essaySend 참조). */
/* ── 이 공고가 정한 작성 규정 (2026-08-24) ──
   재단이 공고·첨부에 직접 적어 둔 문장이다(collector/essay-house-mine.mjs 가 캤다).
   우리가 만든 규칙보다 세다 — 지키지 않으면 학생이 감점되거나 심사에서 제외된다.
   🔴 원문 그대로 쓴다. 요약하면 뜻이 바뀐다(운영 원칙 8-1). */
let essayRulesCache = null;
async function essayLoadFormRules() {
  if (essayRulesCache) return essayRulesCache;
  try {
    const res = await fetch('data/essay-form-rules.json', { cache: 'no-cache' });
    essayRulesCache = (await res.json()).notices || {};
  } catch (e) { essayRulesCache = {}; }   /* 없어도 앱은 그대로 돈다 */
  return essayRulesCache;
}
function essayNoticeRules(sch) {
  const box = essayRulesCache || {};
  const hit = (sch && box[sch.id]) || null;
  return { blind: !!(hit && hit.blind), lines: (hit && hit.lines) || [] };
}

/* ── 완성 문서 수정 돕기 — '빠진 팁 · 판 되돌리기 · 바뀐 곳' (2026-08-24) ──
   설계: docs/designs/essay-edit.md ①②③.
   🔴 여기 있는 것은 전부 **서버 없이 기기 안에서** 돈다. endpoint 가 비어 있어도,
      학생이 직접 고친 글에도 작동한다. 나가는 네트워크 요청이 하나도 없다.

   품질 검사(qualityCheck)는 essay-quality.js 한 곳에 산다 — 서버(worker)가 쓰는 것과
   **같은 함수·같은 규칙집**이라 "서버는 통과, 화면은 잡는" 갈라짐이 없다. */
let essayPlaybookCache = null;
async function essayLoadPlaybook() {
  if (essayPlaybookCache) return essayPlaybookCache;
  try {
    const res = await fetch('data/essay-playbook.json', { cache: 'no-cache' });
    const d = await res.json();
    essayPlaybookCache = { checks: d.checks || [], rules: d.rules || [] };
  } catch (e) { essayPlaybookCache = { checks: [], rules: [] }; }   /* 없어도 앱은 그대로 돈다 */
  return essayPlaybookCache;
}
/* 규칙별 '왜' — 학생이 납득해야 고친다(설계 ③). 없으면 붙이지 않는다(지어내지 않는다). */
function essayWhyFor(code) {
  const rs = (essayPlaybookCache && essayPlaybookCache.rules) || [];
  const hit = rs.find((r) => r.code === code && r.why);
  return hit ? hit.why : '';
}

/* 이 칸의 글을 검사해 '고칠 곳'을 얻는다 — 글을 넘겨 받는 것이 원본이다.
   🔴 질문 단계('q')에는 textarea 가 있지만, 미리보기·점검표는 저장된 답에서 온다.
      그래서 DOM 이 아니라 **글자를 받아** 검사한다 — 두 단계가 같은 함수를 쓴다. */
function essayWarnFor(field, sch, text) {
  if (typeof qualityCheck !== 'function') return [];
  const checks = (essayPlaybookCache && essayPlaybookCache.checks) || [];
  if (!checks.length) return [];
  const own = essayAskAnswers(field.id).filter((a) => a.own).map((a) => a.a);
  let target = 500;
  try {
    if (typeof essayAskFor === 'function') target = (essayAskFor(field, essayCtx(sch)) || {}).target || 500;
  } catch (e) { /* 목표를 못 읽어도 나머지 검사는 돈다 */ }
  return (qualityCheck(text, { target, ownWords: own, checks }).warnings) || [];
}
/* 이 칸의 지금 글(textarea)을 검사한다 — 위 함수에 DOM 값을 넘겨 준다. */
function essayFieldWarnings(field, sch) {
  const el = document.getElementById(`fq-${field.id}`);
  if (!el) return [];
  return essayWarnFor(field, sch, el.value);
}

/* '이렇게 하면 더 좋아져요' 카드 — 빠진 것만 골라 보여 준다(설계 ③).
   🔴 규정(essayRulesBannerHtml)과 다르다: 규정은 '꼭 지켜야 하는 것'(빨강), 이건 '더 좋게 하는 제안'이다. */
function essayTipsHtml(warnings) {
  if (!warnings || !warnings.length) return '';
  const items = warnings.map((w) => {
    const why = essayWhyFor(w.code);
    return `<li><span class="essay-tip-msg">${esc(w.msg)}</span>` +
      (why ? `<span class="essay-tip-why">${esc(why)}</span>` : '') + `</li>`;
  }).join('');
  return `<div class="essay-tips"><b>이렇게 하면 더 좋아집니다</b><ul>${items}</ul>` +
    `<p class="essay-fine">고치면 이 안내는 사라집니다 — 규정이 아니라 제안입니다.</p></div>`;
}

/* ── 판(version) 관리 — AI/옮기기가 글을 바꿀 때마다 이전 판을 기기 안에 남긴다(설계 ①·4) ──
   🔴 서버에 안 남긴다(초안 서버는 KV 없음). 이 세션 메모리에만 둔다.
      학생이 직접 타자로 고치는 것은 브라우저 기본 되돌리기(Ctrl+Z)가 맡는다 — 여기 판은
      'AI가 만든 판'을 단위로 되돌리는 것이다. */
const essayVersions = {};   /* fieldId -> [{text, at}]  (오래된 것 앞에서 버림) */
const essayLastChange = {}; /* fieldId -> {before, after}  '바뀐 곳 보기'용 */
function essaySnapshot(fieldId) {
  const el = document.getElementById(`fq-${fieldId}`);
  if (!el) return;
  /* 되돌아갈 판의 '그때 상태'를 통째로 남긴다 — 글자뿐 아니라 그 판이 AI 초안이었는지도.
     그래야 되돌린 뒤 '✨ AI 초안' 표시를 정확히 켜고 끌 수 있다. */
  const box = (essayVersions[fieldId] = essayVersions[fieldId] || []);
  box.push({ text: el.value, drafted: el.classList.contains('essay-drafted'), at: Date.now() });
  if (box.length > 12) box.shift();
}

/* 두 판 사이 바뀐 곳 — 뒤 글(after)에서 새로 들어온 낱말만 표시한다.
   낱말 단위 LCS. 지운 곳은 이 화면(=완성될 글)에는 없으므로 표시하지 않는다. */
function essayWordDiffHtml(before, after) {
  const a = String(before || '').split(/(\s+)/);
  const b = String(after || '').split(/(\s+)/);
  const n = a.length, m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--)
    dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  let i = 0, j = 0, out = '';
  const emit = (tok) => { out += (/^\s+$/.test(tok)) ? tok : `<mark class="essay-add">${esc(tok)}</mark>`; };
  while (i < n && j < m) {
    if (a[i] === b[j]) { out += esc(b[j]); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { i++; }   /* 지운 낱말 — after 화면에는 없다 */
    else { emit(b[j]); j++; }
  }
  while (j < m) { emit(b[j]); j++; }
  return out;
}

/* 이 칸의 도움 위젯(되돌리기·바뀐 곳 보기·팁)을 한 번에 다시 그린다.
   초안 표시(.essay-flag) 다음에 [컨트롤] → [바뀐 곳] → [팁] 순서로 둔다. */
function essayRenderAids(field, sch) {
  const el = document.getElementById(`fq-${field.id}`);
  if (!el) return;
  const box = el.parentElement;
  const fid = CSS.escape(field.id);
  box.querySelectorAll(`.essay-controls[data-for="${fid}"], .essay-diff[data-for="${fid}"], .essay-tips[data-for="${fid}"]`)
    .forEach((x) => x.remove());

  let anchor = box.querySelector('.essay-urge') || box.querySelector('.essay-flag') || el;
  const after = (node) => { anchor.insertAdjacentElement('afterend', node); anchor = node; };

  /* 컨트롤 — 되돌릴 판이 있거나, 방금 바뀐 곳이 있을 때만 */
  const hasPrev = (essayVersions[field.id] || []).length > 0;
  const chg = essayLastChange[field.id];
  if (hasPrev || chg) {
    const c = document.createElement('div');
    c.className = 'essay-controls'; c.dataset.for = field.id;
    c.innerHTML =
      (hasPrev ? `<button type="button" class="btn btn-outline btn-sm essay-undo">↶ 이전 판으로 되돌리기</button>` : '') +
      (chg ? `<button type="button" class="btn btn-ghost btn-sm essay-diff-toggle">바뀐 곳 보기</button>` : '');
    after(c);
    const undo = c.querySelector('.essay-undo');
    if (undo) undo.addEventListener('click', () => essayUndo(field, sch));
    const dt = c.querySelector('.essay-diff-toggle');
    if (dt) dt.addEventListener('click', () => {
      const d = box.querySelector(`.essay-diff[data-for="${fid}"]`);
      if (d) { d.hidden = !d.hidden; dt.textContent = d.hidden ? '바뀐 곳 보기' : '바뀐 곳 숨기기'; }
    });
  }

  /* 바뀐 곳 — 처음엔 접혀 있다 */
  if (chg) {
    const d = document.createElement('div');
    d.className = 'essay-diff'; d.dataset.for = field.id; d.hidden = true;
    d.innerHTML = `<p class="essay-fine">초록색 표시가 이번에 새로 들어온 부분입니다</p>` +
      `<div class="essay-diff-body">${essayWordDiffHtml(chg.before, chg.after)}</div>`;
    after(d);
  }

  /* 팁 — 글이 어느 정도 있을 때만(막 시작한 칸에 잔소리하지 않는다) */
  const text = String(el.value || '').trim();
  const warnings = text.length >= 30 ? essayFieldWarnings(field, sch) : [];
  const tipsHtml = essayTipsHtml(warnings);
  if (tipsHtml) {
    const wrap = document.createElement('div'); wrap.innerHTML = tipsHtml;
    const node = wrap.firstElementChild; node.dataset.for = field.id;
    after(node);
  }
}

/* 되돌리기 — 가장 최근 판으로 글을 되돌린다. AI가 만들기 전으로 돌아갈 수 있다. */
function essayUndo(field, sch) {
  const el = document.getElementById(`fq-${field.id}`);
  const box = essayVersions[field.id] || [];
  if (!el || !box.length) return;
  const prev = box.pop();
  el.value = prev.text;
  el.rows = Math.min(18, Math.max(4, Math.ceil((prev.text.length || 40) / 40)));
  /* 되돌리면 '바뀐 곳'은 뜻을 잃는다 — 지운다 */
  delete essayLastChange[field.id];
  /* 되돌아간 판이 AI 초안이 아니었으면(=학생 글이거나 빈 칸) '✨ AI 초안' 표시·독려를 정리한다.
     그 판도 AI 초안이었으면(여러 번 AI로 고친 경우) 표시를 그대로 둔다. */
  if (!prev.drafted) {
    el.classList.remove('essay-drafted');
    el.parentElement.querySelectorAll('.essay-flag, .essay-urge').forEach((x) => x.remove());
  }
  essayRenderAids(field, sch);
  if (typeof toast === 'function') toast('이전 판으로 되돌렸어요');
}

/* ── 지금 열려 있는 양식 (2026-08-29) ──
   앱 전역 청취기(칩 클릭·입력)가 재료 게이지와 제출 점검표를 다시 그리려면
   어느 양식·공고인지 알아야 한다. 한 번에 한 양식만 열리므로 하나면 충분하다. */
let essayActive = null;

/* ============================================================
   ── 2순위 · 재료 충분도 게이지 (2026-08-29) ──
   설계 docs/designs/essay-submit-ready.md 갈래② :
     "덤덤한 글의 진짜 원인은 AI가 아니라 재료 부족이다."
   초안을 만들기 **전에** 잰다 — 목표 분량 대비 학생이 준 재료가 얼마인지.
   부족하면 위의 되묻기(essay-ask.js 에 이미 있다)로 한 줄 더 적게 이끈다.

   🔴 이건 '품질' 판정이 아니라 '재료' 판정이다 — 화면에도 그렇게 적는다.
      직접 쓴 한 줄(own)이 고른 보기보다 무겁다(글을 살아 있게 만드는 것이 그것이라).
   ============================================================ */
function essayMaterialLevel(fieldId, target) {
  const asks = (typeof essayAskAnswers === 'function' ? essayAskAnswers(fieldId) : []) || [];
  let chips = 0, own = 0;
  asks.forEach((a) => {
    if (a.own) { if (String(a.a || '').trim()) own++; }
    else chips += String(a.a || '').split(',').filter((x) => x.trim()).length;
  });
  const tg = Number(target) || 500;
  /* 직접 쓴 줄은 3점, 고른 보기는 0.5점(최대 8개까지만 센다 — 마구 누른다고 좋아지지 않게) */
  const score = own * 3 + Math.min(chips, 8) * 0.5;
  const needFull = Math.max(4, Math.min(10, Math.round(tg / 220)));
  let level;
  if (own === 0 && chips < 3) level = 'low';
  else if (score >= needFull && own >= 1) level = 'full';
  else level = 'some';
  const pct = Math.max(6, Math.min(100, Math.round((score / needFull) * 100)));
  return { level, pct, own, chips };
}

const ESSAY_GAUGE_TEXT = {
  low:  { word: '부족', msg: '재료가 아직 적어요 — 위에서 키워드를 고르고, 보기를 누르면 열리는 칸에 <b>한 줄만</b> 적어 보세요.' },
  some: { word: '조금 더', msg: '조금만 더 있으면 좋아요 — 직접 겪은 이야기 <b>한 줄</b>이 글을 살아 있게 만들어요.' },
  full: { word: '충분', msg: '재료가 충분해요 — 좋은 초안이 나올 거예요.' },
};
function essayGaugeHtml(m) {
  const t = ESSAY_GAUGE_TEXT[m.level] || ESSAY_GAUGE_TEXT.some;
  return `<div class="essay-gauge-bar esg-${m.level}"><span style="width:${m.pct}%"></span></div>` +
    `<p class="essay-gauge-lead"><b>재료 충분도 — ${t.word}</b></p>` +
    `<p class="essay-gauge-msg">${t.msg}</p>`;
}
/* 이 칸의 게이지를 다시 그린다. 없으면 조용히 지나간다. */
function essayRenderGauge(fieldId, target) {
  const box = document.querySelector(`.essay-gauge[data-for="${CSS.escape(fieldId)}"]`);
  if (!box) return;
  box.innerHTML = essayGaugeHtml(essayMaterialLevel(fieldId, target));
}
/* 칩·입력이 일어난 노드에서 그 칸을 찾아 게이지를 갱신한다 (전역 청취기용) */
function essayRefreshGaugeFrom(node) {
  const card = node && node.closest && node.closest('.essay-ask[data-for]');
  if (!card) return;
  essayRenderGauge(card.dataset.for, card.dataset.target);
}

/* ============================================================
   ── 1순위 · 제출 전 점검표 (2026-08-29) ──
   설계 docs/designs/essay-submit-ready.md 갈래① :
     "이 앱에는 '제출 가능'이라는 선 자체가 없다." 그 선을 여기서 긋는다.
   판정은 essay-submit-check.js 한 곳에 있다(베끼지 않는다). 여기는 화면에서
   재료를 모아 그 함수에 넘기고, 결과를 '양식 문서 만들기' 버튼 위에 그린다.
   ============================================================ */
function essayPlaybookCodeByType(type) {
  const cs = (essayPlaybookCache && essayPlaybookCache.checks) || [];
  const hit = cs.find((c) => c.type === type);
  return hit ? hit.code : '';
}

/* 서술형 칸마다 점검표에 넘길 재료를 모은다. getText 로 글을 읽는다
   (질문 단계에서는 textarea, 미리보기에서는 저장된 답). */
function essaySubmitFields(tpl, sch, getText) {
  const plan = formPlanFor(tpl);
  const stories = essayStoryFields(plan);
  if (!stories.length) return [];
  const lenCode = essayPlaybookCodeByType('lengthBand');
  const ownCode = essayPlaybookCodeByType('usesOwnMaterial');
  const prof = essayProfile();
  const schoolTerms = [prof.school].concat(prof.schoolAliases || []).filter(Boolean);
  const notice = essayNoticeRules(sch);
  const blind = notice.blind || (typeof blindReview === 'function' ? blindReview({
    name: sch.name || '', quotes: (sch.excerpts || []).slice(0, 14),
  }) : false);
  /* 이 재단이 보는 것(focus) — 그 테마의 정규식을 함께 실어 보낸다(점검표가 본문에 대 본다).
     foundationFocus 는 테마 id 를 주고, 정규식은 FOCUS_THEMES 에 있다(원본 한 곳). */
  const themeRe = {};
  try { (typeof FOCUS_THEMES !== 'undefined' ? FOCUS_THEMES : []).forEach((t) => { themeRe[t.id] = t.re; }); } catch (e) { /* 표가 없어도 나머지는 돈다 */ }
  const focusItems = (typeof foundationFocus === 'function' ? foundationFocus({
    name: sch.name || '', provider: sch.provider || sch.org || '',
    quotes: (sch.excerpts || []).slice(0, 14).concat(notice.lines || []),
  }) : []);
  const focus = focusItems.map((f) => ({ say: f.say, re: themeRe[f.id] })).filter((f) => f.re);

  return stories.map((f) => {
    const text = String((getText ? getText(f.id) : ((document.getElementById(`fq-${f.id}`) || {}).value)) || '');
    const warns = essayWarnFor(f, sch, text);
    return {
      label: String(f.label || '').replace(/\n/g, ' '),
      text,
      blind,
      schoolTerms,
      focus,
      lengthWarn: !!lenCode && warns.some((w) => w.code === lenCode),
      ownWarn: !!ownCode && warns.some((w) => w.code === ownCode),
    };
  });
}

/* 점검표 결과 — 서술형 칸이 없으면 null(점검표를 그리지 않는다) */
function essaySubmitReadiness(tpl, sch, getText) {
  if (typeof essaySubmitChecklist !== 'function') return null;
  const fields = essaySubmitFields(tpl, sch, getText);
  if (!fields.length) return null;
  return essaySubmitChecklist({ fields });
}

function essaySubmitCheckHtml(result) {
  if (!result || !result.items.length) return '';
  const icon = { pass: '✓', warn: '△', block: '✗' };
  const rows = result.items.map((i) =>
    `<li class="esc-${i.status}"><span class="esc-mark">${icon[i.status]}</span>` +
    `<span class="esc-body"><b>${esc(i.label)}</b>` +
    `<span class="esc-detail">${esc(i.detail)}</span></span></li>`).join('');
  const badge = result.allPass
    ? `<span class="esc-badge esc-ok">제출 가능</span>`
    : (result.submittable
      ? `<span class="esc-badge esc-soft">조금 더 다듬으면 좋아요</span>`
      : `<span class="esc-badge esc-block">먼저 고칠 곳이 있어요</span>`);
  return `<div class="essay-submit-check" id="essay-submit-check">` +
    `<div class="esc-head"><b>제출 전 점검</b>${badge}</div>` +
    `<ul class="esc-list">${rows}</ul>` +
    `<p class="essay-fine">✗ 는 그대로 내면 문제가 되는 것 · △ 는 더 좋게 만드는 제안입니다.</p></div>`;
}

/* 점검표를 '양식 문서 만들기' 버튼 위에 그린다(있으면 갈아끼운다) */
function essayRenderSubmitCheck(tpl, sch) {
  const gen = document.getElementById('btn-ff-generate');
  const old = document.getElementById('essay-submit-check');
  const result = gen ? essaySubmitReadiness(tpl, sch) : null;
  if (!result) { if (old) old.remove(); return; }
  const html = essaySubmitCheckHtml(result);
  if (old) { old.insertAdjacentHTML('beforebegin', html); old.remove(); }
  else gen.insertAdjacentHTML('beforebegin', html);
}

function essayCtx(sch) {
  const p = (typeof state !== 'undefined' && state.profile) || null;
  /* 보관함에 무엇이 있는지 — 파일도 파일 이름도 나가지 않는다.
     🔴 수급·차상위 자격 증명(welfare)은 민감정보라 아예 보지 않는다. */
  let docs = [];
  try {
    /* 보관함은 walletCache(slot -> {name,type,savedAt}) 에 있다 — 파일 내용은 IndexedDB
       안에 있고 여기서 읽지 않는다. 우리가 보는 것은 '그 칸이 차 있나'뿐이다. */
    const box = (typeof walletCache !== 'undefined' && walletCache) || {};
    docs = Object.keys(box).filter((k) => k !== 'welfare' && box[k]);
  } catch (e) { docs = []; }
  return { profile: p, sch, docs };
}

/* ── 키워드 질문 카드 ──
   🔴 이것은 **그 서술형 칸 안**에 그려진다. 새 질문이 아니므로
      form-plan.js 의 질문 수 상한(FORM_LIMITS)에 영향이 없다.
      (증명: verify/verify-essay-ask.mjs) */
function essayAskHtml(field, ctx) {
  if (typeof essayAskFor !== 'function') return '';
  const plan = essayAskFor(field, ctx);
  const base = `ask-${field.id}`;
  const rows = plan.asks.map((a) => {
    const rid = `${base}-${a.id}`;
    if (a.free) {
      return `<label class="essay-ask-row"><span>${esc(a.q)}</span>` +
        `<input type="text" class="essay-ask-free" id="${rid}" data-q="${esc(a.q)}" placeholder="${esc(a.ph || '')}" autocomplete="off" /></label>`;
    }
    /* .fq-checks 를 그대로 쓴다 — 여러 개 고르기 동작이 app.js 에 이미 있다.
       data-f 는 어떤 필드 id 와도 겹치지 않으므로 collectFormAnswers 가 집어가지 않는다. */
    return `<div class="essay-ask-row"><span>${esc(a.q)}</span>` +
      `<div class="chip-group fq-checks essay-chips" data-f="${rid}" data-q="${esc(a.q)}">` +
      a.c.map((o) => `<button type="button" class="chip chip-sm" data-value="${esc(o)}">${esc(o)}</button>`).join('') +
      `</div>` +
      /* 🔴 되묻기 — 그 보기를 누른 학생에게만 열린다 (2026-08-23 개발자 지시).
         백지에 '꼭 넣고 싶은 말'을 물으면 대부분 비운다. 방금 누른 것에 대해서만
         좁게 되물으면 답이 이미 머릿속에 있다. 새 질문이 아니라 이 칸 안이라
         질문 수 상한(FORM_LIMITS)과는 무관하다. */
      (a.fu ? essayFollowUpHtml(`${rid}-fu`, a.fu, a.eg || [], plan.scene || []) : '') +
      `</div>`;
  }).join('');

  /* 켜져 있을 때만 '앱이 씁니다'라고 말한다 — 못 하는 일을 한다고 하면 안 된다(원칙 1) */
  const lead = essayOn()
    ? '<b>키워드만 골라 주세요</b> — 긴 글은 앱이 씁니다'
    : '<b>키워드만 골라 주세요</b> — 아래 버튼으로 이 칸에 옮깁니다';
  /* 재료 충분도 게이지 — 초안을 만들기 전에 잰다(설계 갈래② · 2순위).
     처음엔 비어 있고 essayBind 가 첫 값을 채운다. 칩·입력마다 다시 그린다. */
  return `<div class="essay-ask" data-for="${field.id}" data-target="${plan.target}">
    <p class="essay-ask-lead">${lead} (목표 약 ${plan.target}자)</p>
    ${rows}
    <div class="essay-gauge" data-for="${field.id}"></div>
  </div>`;
}

/* 되묻기 한 줄 — 처음엔 감춰 두고, 그 보기를 누르면 열린다.
   🔴 여기가 '지원서의 차별점'이 되는 칸이라 그렇게 적어 준다(개발자 지시 2026-08-23).
      학생 대부분은 '무엇을 써야 할지 몰라서' 비워 두므로, 왜 써야 하는지와
      어떻게 시작하면 되는지를 같이 준다. */
const ESSAY_FU_INFO = '이 한 줄이 지원서의 차별점이 됩니다. 재단은 비슷한 사정보다 <b>그 상황에서 어떻게 해 왔는지</b>를 눈여겨봐요 — 한 줄이면 충분합니다.';

function essayFollowUpHtml(id, question, egs, scene) {
  return `<div class="essay-fu" data-fu-for="${id}" hidden>
    <p class="essay-fu-q"><b class="essay-fu-pick"></b> — ${esc(question)}</p>
    <p class="essay-fu-info">${ESSAY_FU_INFO}</p>
    <textarea class="essay-ask-free essay-fu-in" id="${id}" data-q="${esc(question)}" rows="2" placeholder="한 줄이면 충분해요"></textarea>
    ${egs.length ? `<div class="essay-fu-eg"><span>이렇게 시작해 보세요</span>${
      egs.map((e) => `<button type="button" class="chip chip-sm essay-eg" data-fill-fu="${id}" data-text="${esc(e)}">${esc(e.slice(0, 22))}…</button>`).join('')
    }</div>` : ''}
    ${/* 🔴 장면 — 글을 살아 있게 만드는 것은 '언제·누구와'다 (개발자 아이디어 2026-08-23).
          되묻기를 여는 학생에게만 붙으므로 카드가 길어지지 않는다. */''}
    ${(scene || []).map((sc) => `<div class="essay-scene"><span>${esc(sc.q)}</span>` +
      `<div class="chip-group fq-checks essay-chips" data-f="${id}-${sc.id}" data-q="${esc(sc.q)}">` +
      sc.c.map((o) => `<button type="button" class="chip chip-sm" data-value="${esc(o)}">${esc(o)}</button>`).join('') +
      `</div></div>`).join('')}
  </div>`;
}

/* 보기를 누르면 그 아래 되묻기를 열고, 무엇을 눌렀는지 되비춰 준다 */
function essaySyncFollowUp(group) {
  if (!group) return;
  const fu = group.parentElement && group.parentElement.querySelector(`.essay-fu[data-fu-for="${CSS.escape(group.dataset.f)}-fu"]`);
  if (!fu) return;
  const picked = [...group.querySelectorAll('.chip.active')].map((c) => c.dataset.value);
  fu.hidden = picked.length === 0;
  const tag = fu.querySelector('.essay-fu-pick');
  if (tag) tag.textContent = picked.length ? `'${picked.join(', ')}'` : '';
}

/* 앱 전체에 한 번만 다는 청취기.
   🔴 setTimeout 0 이 필요하다 — app.js 의 칩 처리기가 .active 를 토글한 **뒤에** 읽어야 한다.
      바로 읽으면 방금 누른 칩이 아직 반영되지 않아 한 박자씩 밀린다. */
if (typeof document !== 'undefined' && typeof window !== 'undefined' && !window.__essayFuBound) {
  window.__essayFuBound = true;
  /* 재료 게이지·제출 점검표를 다시 그린다 — 지금 열린 양식이 있을 때만.
     🔴 setTimeout 0 : app.js 의 칩 처리기가 .active 를 토글한 뒤에 세야 값이 맞는다. */
  const essayAfterEdit = (node) => {
    essayRefreshGaugeFrom(node);
    if (essayActive) essayRenderSubmitCheck(essayActive.tpl, essayActive.sch);
  };
  document.addEventListener('click', (e) => {
    const fill = e.target.closest('[data-fill-fu]');
    if (fill) {
      const el = document.getElementById(fill.dataset.fillFu);
      if (el) { el.value = fill.dataset.text; el.focus(); essayAfterEdit(el); }
      return;
    }
    const chip = e.target.closest('.essay-chips .chip');
    if (chip) setTimeout(() => { essaySyncFollowUp(chip.closest('.essay-chips')); essayAfterEdit(chip); }, 0);
  });
  /* 직접 적는 칸(자유 입력·되묻기 한 줄)이 바뀌면 **게이지만** 갱신 — 타자 멈춘 뒤.
     🔴 점검표는 여기서 다시 그리지 않는다(코드 리뷰 지적 — 키워드 재료는 최종 초안 글이
        아니라 매 타자마다 같은 점검표를 다시 계산하는 낭비였다). 점검표는 초안 글 편집·칩
        클릭·AI 채움 때 갱신되고, '문서 만들기'를 누르는 순간 그 자리에서 새로 판정한다. */
  let essayInT;
  document.addEventListener('input', (e) => {
    if (!e.target.closest('.essay-ask-free, .essay-fu-in')) return;
    clearTimeout(essayInT);
    const node = e.target;
    essayInT = setTimeout(() => essayRefreshGaugeFrom(node), 400);
  });
}

/* 이 칸에 학생이 고르거나 적은 키워드 */
function essayAskAnswers(fieldId) {
  const box = document.querySelector(`.essay-ask[data-for="${CSS.escape(fieldId)}"]`);
  if (!box) return [];
  const out = [];
  box.querySelectorAll('.essay-chips').forEach((g) => {
    const picked = [...g.querySelectorAll('.chip.active')].map((c) => c.dataset.value);
    if (picked.length) out.push({ q: g.dataset.q || '', a: picked.join(', ') });
  });
  box.querySelectorAll('.essay-ask-free').forEach((el) => {
    const v = String(el.value || '').trim();
    /* 🔴 own = 학생이 **직접 친 글**. 서버가 이것을 글의 중심으로 삼는다
       (개발자 지시 2026-08-23) — 고른 보기는 거기에 엮이는 재료일 뿐이다. */
    if (v) out.push({ q: el.dataset.q || '', a: v, own: true });
  });
  return out;
}

/* 그 밖의 재료 — 학생이 이 화면에 직접 친 글만.
   🔴 짧은 입력은 **프로필로 채울 수 있는 항목(auto 키가 있는 것)을 뺀다** —
      거기가 이름·학번·계좌·주민번호가 사는 자리다. */
function essayMaterials(plan) {
  const out = [];
  (plan.secs || []).forEach((sec) => (sec.items || []).forEach((f) => {
    const el = document.getElementById(`fq-${f.id}`);
    if (!el || !el.value) return;
    const v = String(el.value).trim();
    if (!v) return;
    if (f.type === 'textarea') {
      if (f.kind === 'story') return;          // 이 칸은 결과가 들어갈 자리다 — 재료가 아니다
      out.push({ id: f.id, label: f.label, value: v });
      return;
    }
    if (f.type === 'text') {
      const key = typeof formAutoKey === 'function' ? formAutoKey(f) : '';
      if (key) return;
      out.push({ id: f.id, label: f.label, value: v });
    }
  }));
  return out;
}

/* 나가는 프로필 — 이 셋뿐이다 */
function essayProfile() {
  const p = (typeof state !== 'undefined' && state.profile) || {};
  /* 🔴 블라인드 심사 공고에서 학교명을 지우기 위한 재료. 프롬프트에는 안 들어간다.
     '외대' 같은 줄임말은 정식 명칭에서 만들어지지 않아 별칭표에서 찾아 보낸다. */
  const aliases = [];
  try {
    const table = (typeof UNIV_ALIASES !== 'undefined' && UNIV_ALIASES) || {};
    for (const k of Object.keys(table)) if (table[k] === p.school && !aliases.includes(k)) aliases.push(k);
  } catch (e) { /* 별칭표가 없어도 정식 명칭은 지워진다 */ }
  return {
    school: p.school || '',
    year: p.year ? `${p.year}학년` : '',
    major: p.major || '',
    schoolAliases: aliases.slice(0, 6),
  };
}

/* 버튼 — 켜져 있고 도울 칸이 있을 때만 보인다 */
function essayButtonHtml(tpl) {
  const plan = formPlanFor(tpl);
  const n = essayStoryFields(plan).length;
  if (!n) return '';
  /* 🔴 AI가 꺼져 있어도 버튼은 나온다.
     키워드를 골라 놓고 아무 일도 안 일어나면 그 카드는 학생을 놀린 셈이 된다.
     서버가 없을 때는 **앱이 개요로 옮겨 준다** — 문장까지는 못 쓴다고 정직하게 적는다. */
  if (!essayOn()) {
    return `<button class="btn btn-outline btn-lg" id="btn-essay-ai">고른 키워드를 아래 칸에 옮기기 (${n}칸)</button>` +
      `<p class="dp-note essay-fine">아직 글까지 쓰지는 못합니다 — 옮겨 드린 내용을 문장으로 다듬어 주세요</p>`;
  }
  return `<button class="btn btn-primary btn-lg" id="btn-essay-ai">${esc(essayCfg('label', '키워드로 글 만들기'))} (${n}칸)</button>` +
    `<p class="dp-note essay-fine">눌러야 보내져요 · 고른 키워드와 학교·학년·전공만 나가고 이름·연락처·계좌·성적은 나가지 않아요</p>`;
}

/* ── 서버가 없을 때 — 앱이 키워드를 개요로 옮긴다 ──
   🔴 문장을 지어내지 않는다. 학생이 고른 낱말을 그 질문과 함께 옮겨 적을 뿐이다.
      (이 저장소의 '추론 금지' 원칙 8-1 계열 — 없는 사실을 만들 자리가 없다.) */
function essayComposeLocal(field) {
  const asks = essayAskAnswers(field.id);
  if (!asks.length) return '';
  return asks.map((a) => `· ${a.q}: ${a.a}`).join('\n');
}

/* ── 이 공고가 정한 규정을 학생에게 보여 준다 (2026-08-24) ──
   🔴 재단이 공고·첨부에 직접 적은 규정이다(essay-house-mine.mjs 가 캤다). 지키지 않으면
      **심사에서 제외되거나 감점된다** — 코퍼스 전수에서 실제로 나온 위험이다:
        · 학교명을 쓰면 심사 제외(블라인드)  · 1페이지 미만 심사 제외  · 2페이지 초과 감점
   초안 서버에도 같은 규정을 조건으로 보내지만(essaySend), 학생이 **직접 눈으로** 봐야
   초안을 믿고 그대로 낼 수 있다. 원문 그대로 보여 준다 — 우리가 요약하지 않는다(원칙 8-1). */
function essayRulesBannerHtml(sch) {
  const r = essayNoticeRules(sch);
  if (!r.lines.length && !r.blind) return '';
  const 위험 = /(심사에서\s*제외|심사\s*제외|감점|실격|무효|식별할\s*수\s*있는|블라인드)/;
  const items = r.lines.slice(0, 5).map((l) =>
    `<li class="${위험.test(l) ? 'essay-rule-danger' : ''}">${esc(l)}</li>`).join('');
  return `<div class="essay-rules-banner">` +
    `<b>이 공고가 정한 작성 규정 — 반드시 지켜야 합니다</b>` +
    (r.blind ? `<p class="essay-rule-danger"><b>블라인드 심사</b>: 학교 이름을 쓰면 심사에서 제외됩니다. ` +
      `초안에는 학교 이름을 넣지 않아요(전공은 괜찮아요).</p>` : '') +
    (items ? `<ul>${items}</ul>` : '') +
    `<p class="essay-fine">재단이 공고·첨부에 직접 적은 문구입니다.</p></div>`;
}

async function essayBind(tpl, sch) {
  /* 지금 열린 양식을 기억한다 — 전역 청취기가 게이지·점검표를 다시 그릴 때 쓴다. */
  essayActive = { tpl, sch };
  const btn = document.getElementById('btn-essay-ai');
  if (btn) {
    btn.addEventListener('click', () => essaySend(tpl, sch, btn));
    /* 규정 배너 — 규정 파일을 받아 버튼 위에 끼운다. 없으면 아무것도 안 뜬다. */
    try {
      await essayLoadFormRules();
      const html = essayRulesBannerHtml(sch);
      if (html && !document.getElementById('essay-rules-banner-box')) {
        const box = document.createElement('div');
        box.id = 'essay-rules-banner-box';
        box.innerHTML = html;
        btn.parentNode.insertBefore(box, btn);
      }
    } catch (e) { /* 규정을 못 받아도 버튼은 그대로 동작한다 */ }
  }

  /* ── 완성 문서 수정 돕기 (2026-08-24) — 서버 없이, 학생 직접 편집에도 작동 ──
     playbook 을 받아 두고, 서술형 칸을 고칠 때마다 '빠진 팁'·점검표를 갱신한다. */
  try {
    await essayLoadPlaybook();
    const stories = essayStoryFields(formPlanFor(tpl));
    stories.forEach((f) => {
      /* 재료 게이지 첫 값 (2순위) — 저장된 답이 있으면 바로 채워진다 */
      const askPlan = typeof essayAskFor === 'function' ? essayAskFor(f, essayCtx(sch)) : { target: 500 };
      essayRenderGauge(f.id, askPlan.target);
      const el = document.getElementById(`fq-${f.id}`);
      if (!el || el.dataset.essayAids) return;
      el.dataset.essayAids = '1';   /* 한 칸에 청취기 한 번만 */
      let t;
      el.addEventListener('input', () => {
        clearTimeout(t);
        /* 타자를 멈춘 뒤에 검사한다 — 글자마다 다시 그리면 어수선하다 */
        t = setTimeout(() => { essayRenderAids(f, sch); essayRenderSubmitCheck(tpl, sch); }, 500);
      });
      /* 바인드 때 한 번 — 앞서 저장된 초안이 있으면 팁이 바로 보인다 */
      essayRenderAids(f, sch);
    });
    /* 제출 전 점검표 첫 그림 (1순위) — '양식 문서 만들기' 버튼 위에 */
    essayRenderSubmitCheck(tpl, sch);
  } catch (e) { /* 팁·점검표를 못 그려도 양식 작성은 그대로 된다 */ }
}

async function essaySend(tpl, sch, btn) {
  await essayLoadFormRules();   /* 이 공고가 정한 작성 규정 — 없으면 빈손으로 돌아온다 */
  const plan = formPlanFor(tpl);
  const fields = essayStoryFields(plan);
  if (!fields.length) return;

  /* 서버가 없으면 앱이 옮겨만 준다 — 네트워크로 나가는 것이 하나도 없다 */
  if (!essayOn()) {
    let moved = 0, empty = 0;
    for (const f of fields) {
      const el = document.getElementById(`fq-${f.id}`);
      if (!el) continue;
      const text = essayComposeLocal(f);
      if (!text) { empty++; continue; }
      const before = el.value;
      essaySnapshot(f.id);   /* 옮기기 전 판을 남긴다 — 되돌릴 수 있게 */
      /* 학생이 이미 쓴 글이 있으면 덮지 않고 아래에 붙인다 */
      el.value = el.value.trim() ? `${el.value.trim()}\n${text}` : text;
      el.classList.add('essay-drafted');
      if (!el.parentElement.querySelector('.essay-flag')) {
        el.insertAdjacentHTML('afterend',
          '<p class="dp-note essay-flag">고른 키워드를 옮겨 적었습니다 — 문장으로 다듬어 주세요</p>');
      }
      essayLastChange[f.id] = { before, after: el.value };
      essayRenderAids(f, sch);   /* 되돌리기·바뀐 곳·팁 다시 그리기 */
      moved++;
    }
    if (moved) { essayRenderSubmitCheck(tpl, sch); toast(`${moved}칸에 옮겼어요 — 문장으로 다듬어 주세요`); }
    else if (empty) toast('먼저 위에서 키워드를 골라 주세요');
    return;
  }

  /* 🔴 직접 쓴 한 줄이 하나도 없으면 한 번만 세운다 (개발자 지시 2026-08-23).
     막지 않는다 — 학생을 가두는 것은 이 앱의 방식이 아니다. [이대로 만들기]가 늘 있다.
     문구는 앱의 부족함이 아니라 **학생이 얻을 것**을 말한다. */
  const anyOwn = fields.some((f) => essayAskAnswers(f.id).some((a) => a.own));
  if (!anyOwn && !btn.dataset.nudged) {
    btn.dataset.nudged = '1';
    document.getElementById('essay-nudge')?.remove();
    btn.insertAdjacentHTML('beforebegin', `<div class="dp-block essay-nudge" id="essay-nudge">
      <h4>한 줄만 더 적어 보시겠어요?</h4>
      <p class="dp-note">직접 겪으신 이야기가 한 줄 들어가면 재단이 눈여겨보는 부분이 훨씬 분명해집니다.
        위 <b>보기를 누르면 열리는 칸</b>에 한 줄이면 충분해요.</p>
      <button class="btn btn-outline" id="btn-essay-nudge-go">위로 올라가서 적을게요</button>
    </div>`);
    document.getElementById('btn-essay-nudge-go').addEventListener('click', () => {
      const first = document.querySelector('.essay-fu:not([hidden]) .essay-fu-in')
        || document.querySelector('.essay-ask-free');
      document.getElementById('essay-nudge')?.remove();
      if (first) { first.scrollIntoView({ block: 'center', behavior: 'smooth' }); first.focus(); }
    });
    if (typeof toast === 'function') toast('한 줄만 더 적으면 훨씬 좋아집니다 — 그대로 만들려면 다시 눌러 주세요');
    return;
  }
  document.getElementById('essay-nudge')?.remove();

  const label = btn.textContent;
  btn.disabled = true;
  btn.textContent = '글을 쓰는 중… (20초쯤 걸려요)';

  const payload = {
    scholarship: {
      name: sch.name || '', provider: sch.provider || sch.org || '', amountText: sch.amountText || '',
      quotes: (sch.excerpts || []).slice(0, 14),
      /* 이 공고가 정한 작성 규정 — 재단이 직접 적은 문장 그대로 */
      writeRules: essayNoticeRules(sch).lines,
      /* B — 이 재단이 무엇을 보는가. 공고 원문에 실제로 있는 것만 담긴다(essay-ask.js).
         재단이 '평가기준1순위'처럼 순서를 밝혀 두었으면 그 순서 그대로다. */
      /* 🔴 작성 규정도 함께 읽힌다 — 재단이 '평가기준1순위'처럼 순서를 직접 밝힌 줄이
         공고 발췌가 아니라 첨부 서식에 들어 있는 경우가 많다. */
      focus: (typeof foundationFocus === 'function' ? foundationFocus({
        name: sch.name || '', provider: sch.provider || sch.org || '',
        quotes: (sch.excerpts || []).slice(0, 14).concat(essayNoticeRules(sch).lines),
      }) : []).map((f) => f.say),
      /* 🔴 블라인드 심사 — 학교명을 쓰면 심사에서 제외되는 공고가 실제로 있다 */
      blind: essayNoticeRules(sch).blind || (typeof blindReview === 'function' ? blindReview({
        name: sch.name || '', quotes: (sch.excerpts || []).slice(0, 14),
      }) : false),
    },
    profile: essayProfile(),
    materials: essayMaterials(plan),
    fields: fields.map((f) => {
      const askPlan = typeof essayAskFor === 'function' ? essayAskFor(f, essayCtx(sch)) : { target: 500 };
      return {
        key: f.id,
        kind: f.kind,
        label: String(f.label || '').replace(/\n/g, ' '),
        hint: f.q || '',
        target: askPlan.target,
        /* 어떤 종류의 서술형인가 — 서버가 data/essay-playbook.json 에서
           그 종류에 맞는 작성 규칙을 골라 조건으로 준다 */
        askKind: askPlan.kind,
        asks: essayAskAnswers(f.id),
        answer: (document.getElementById(`fq-${f.id}`) || {}).value || '',
      };
    }),
  };

  let data = null;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), essayCfg('timeoutMs', 60000));
    const res = await fetch(essayCfg('endpoint', ''), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    data = await res.json();
  } catch (e) { data = null; }

  btn.disabled = false;
  btn.textContent = label;

  /* 🔴 실패하면 아무것도 건드리지 않는다 — 학생이 쓴 글이 그대로 남아야 한다 */
  if (!data || data.error === 'sensitive') {
    const why = data && data.error === 'sensitive'
      ? '민감정보가 섞여 있어 보내지 않았어요 — 그 부분은 직접 써 주세요'
      : '글을 받지 못했어요. 잠시 뒤 다시 눌러 보세요 (쓰신 내용은 그대로예요)';
    if (typeof toast === 'function') toast(why);
    return;
  }

  let filled = 0;
  for (const d of data.drafts || []) {
    const el = document.getElementById(`fq-${d.key}`);
    if (!el || !d.text) continue;
    const field = fields.find((x) => x.id === d.key) || { id: d.key };
    const before = el.value;
    essaySnapshot(d.key);   /* AI 가 고치기 전 판을 남긴다 — 되돌릴 수 있게(설계 ①·4) */
    el.value = d.text;
    el.classList.add('essay-drafted');
    el.rows = Math.min(18, Math.max(6, Math.ceil(d.text.length / 40)));
    el.parentElement.querySelectorAll('.essay-flag, .essay-fix, .essay-urge').forEach((x) => x.remove());
    el.insertAdjacentHTML('afterend',
      `<p class="dp-note essay-flag">AI 초안입니다 — ${esc(essayCfg('notice', '반드시 읽고 고쳐서 제출하세요.'))}</p>`);
    /* 🔴 직접 쓴 한 줄이 없을 때만 독려한다 (개발자 지시 2026-08-23 — 있을 때
       칭찬하는 문구는 넣지 않는다). 앱의 부족함이 아니라 학생이 얻을 것을 말한다. */
    const hasOwn = ((payload.fields.find((x) => x.key === d.key) || {}).asks || []).some((a) => a.own);
    if (!hasOwn) {
      el.parentElement.querySelector('.essay-flag').insertAdjacentHTML('afterend',
        `<p class="dp-note essay-urge">직접 적은 이야기가 아직 없습니다. 위 보기를 눌러 열리는 칸에
         <b>한 줄만 더하면</b> 심사위원에게 전해지는 인상이 크게 달라집니다.</p>`);
    }
    /* 바뀐 곳(diff) · 되돌리기 · '고칠 곳' 팁을 한 번에 그린다.
       🔴 '고칠 곳'은 서버 응답(d.quality)을 베끼지 않고 essay-quality.js 의 qualityCheck 로
          화면에서 다시 계산한다 — 서버가 쓰는 것과 **같은 함수·같은 규칙집**이라 값이 갈리지 않고,
          이후 학생이 직접 고치면 그 자리에서 다시 갱신된다(서버 없이도 도는 길). */
    essayLastChange[d.key] = { before, after: d.text };
    essayRenderAids(field, sch);
    filled++;
  }

  /* AI 가 채운 뒤 제출 전 점검표를 다시 그린다 — 초안에 빈칸 [ ]·블라인드 유출이
     있으면 바로 눈에 띄게(1순위). 팁은 칸마다 essayRenderAids 가 이미 그렸다. */
  if (filled) essayRenderSubmitCheck(tpl, sch);

  const skipped = (data.skipped || []).filter((s) => !(data.drafts || []).some((d) => d.key === s.key));
  if (filled && skipped.length) toast(`${filled}칸을 채웠어요 · ${skipped.length}칸은 직접 써 주세요`);
  else if (filled) toast(`${filled}칸을 채웠어요 — 꼭 읽고 고쳐 주세요`);
  else if (skipped.length) toast(skipped[0].reason || '이번엔 글을 만들지 못했어요 — 키워드를 조금 더 골라 주세요');
  else toast('이번엔 글을 만들지 못했어요 — 쓰신 내용은 그대로예요');
}

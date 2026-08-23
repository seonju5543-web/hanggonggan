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

/* ── 키워드 질문 카드 ──
   🔴 이것은 **그 서술형 칸 안**에 그려진다. 새 질문이 아니므로
      form-plan.js 의 질문 수 상한(FORM_LIMITS)에 영향이 없다.
      (증명: verify/verify-essay-ask.mjs) */
function essayAskHtml(field) {
  if (typeof essayAskFor !== 'function') return '';
  const plan = essayAskFor(field);
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
      `</div></div>`;
  }).join('');

  /* 켜져 있을 때만 '앱이 씁니다'라고 말한다 — 못 하는 일을 한다고 하면 안 된다(원칙 1) */
  const lead = essayOn()
    ? '✍️ <b>키워드만 골라 주세요</b> — 긴 글은 앱이 씁니다'
    : '✍️ <b>키워드만 골라 주세요</b> — 아래 버튼으로 이 칸에 옮겨 드려요';
  return `<div class="essay-ask" data-for="${field.id}" data-target="${plan.target}">
    <p class="essay-ask-lead">${lead} (목표 약 ${plan.target}자)</p>
    ${rows}
  </div>`;
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
    if (v) out.push({ q: el.dataset.q || '', a: v });
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
  return {
    school: p.school || '',
    year: p.year ? `${p.year}학년` : '',
    major: p.major || '',
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
    return `<button class="btn btn-outline btn-lg" id="btn-essay-ai">📝 고른 키워드를 아래 칸에 옮기기 (${n}칸)</button>` +
      `<p class="dp-note essay-fine">아직 글까지 써 드리지는 못해요 — 옮겨 드린 내용을 문장으로 다듬어 주세요</p>`;
  }
  return `<button class="btn btn-primary btn-lg" id="btn-essay-ai">✨ ${esc(essayCfg('label', '키워드로 글 만들기'))} (${n}칸)</button>` +
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

function essayBind(tpl, sch) {
  const btn = document.getElementById('btn-essay-ai');
  if (!btn) return;
  btn.addEventListener('click', () => essaySend(tpl, sch, btn));
}

async function essaySend(tpl, sch, btn) {
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
      /* 학생이 이미 쓴 글이 있으면 덮지 않고 아래에 붙인다 */
      el.value = el.value.trim() ? `${el.value.trim()}\n${text}` : text;
      el.classList.add('essay-drafted');
      if (!el.parentElement.querySelector('.essay-flag')) {
        el.insertAdjacentHTML('afterend',
          '<p class="dp-note essay-flag">📝 고르신 키워드를 옮겨 적었어요 — 문장으로 다듬어 주세요</p>');
      }
      moved++;
    }
    if (moved) toast(`${moved}칸에 옮겼어요 — 문장으로 다듬어 주세요`);
    else if (empty) toast('먼저 위에서 키워드를 골라 주세요');
    return;
  }

  const label = btn.textContent;
  btn.disabled = true;
  btn.textContent = '글을 쓰는 중… (20초쯤 걸려요)';

  const payload = {
    scholarship: {
      name: sch.name || '', provider: sch.provider || sch.org || '', amountText: sch.amountText || '',
      quotes: (sch.excerpts || []).slice(0, 14),
    },
    profile: essayProfile(),
    materials: essayMaterials(plan),
    fields: fields.map((f) => {
      const askPlan = typeof essayAskFor === 'function' ? essayAskFor(f) : { target: 500 };
      return {
        key: f.id,
        kind: f.kind,
        label: String(f.label || '').replace(/\n/g, ' '),
        hint: f.q || '',
        target: askPlan.target,
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
    el.value = d.text;
    el.classList.add('essay-drafted');
    el.rows = Math.min(18, Math.max(6, Math.ceil(d.text.length / 40)));
    if (!el.parentElement.querySelector('.essay-flag')) {
      el.insertAdjacentHTML('afterend',
        `<p class="dp-note essay-flag">✨ AI 초안이에요 — ${esc(essayCfg('notice', '반드시 읽고 고쳐서 제출하세요.'))}</p>`);
    }
    filled++;
  }

  const skipped = (data.skipped || []).filter((s) => !(data.drafts || []).some((d) => d.key === s.key));
  if (filled && skipped.length) toast(`${filled}칸을 채웠어요 · ${skipped.length}칸은 직접 써 주세요`);
  else if (filled) toast(`${filled}칸을 채웠어요 — 꼭 읽고 고쳐 주세요`);
  else if (skipped.length) toast(skipped[0].reason || '이번엔 글을 만들지 못했어요 — 키워드를 조금 더 골라 주세요');
  else toast('이번엔 글을 만들지 못했어요 — 쓰신 내용은 그대로예요');
}

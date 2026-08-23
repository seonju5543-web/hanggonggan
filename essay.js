/* ============================================================
   한대장 — 신청서 AI 초안 (앱 쪽)
   ------------------------------------------------------------
   서술형 칸을 학생이 준 재료로 엮어 **초안**을 만들어 넣는다.

   이 파일이 지키는 약속 (계약 전문은 essay-config.js 첫머리):
     ① 나오는 글은 **초안**이다 — 화면에 그렇게 적고 학생이 고칠 수 있게 둔다.
     ② **사실 나열형 칸(kind !== 'story')에는 가지 않는다.** 어느 칸이 어느 쪽인지는
        data/forms.json 의 kind 에 적혀 있다 — 짐작하지 않는다.
     ③ **버튼을 눌러야 나간다.** 무엇이 나가는지 한 줄씩 보여 주고, 줄마다 끌 수 있다.
     ④ 실패하면 **학생이 쓴 원문을 그대로 둔다.** 절대 덮어쓰지 않는다.
     ⑤ endpoint 가 비어 있으면 이 파일은 아무것도 하지 않는다 — 버튼도 안 보인다.

   🔴 프로필에서 자동으로 채운 값(이름·학번·연락처·계좌·주민번호·성적·소득분위)은
      재료에 넣지 않는다. 이 파일이 모으는 것은 **학생이 이 신청서 화면에 직접 친 글**과
      학교/학년/전공뿐이다. 서버도 같은 것을 한 번 더 거른다(server/essay/draft-guard.mjs).
   ============================================================ */

/* 이 기능이 켜져 있는가 — endpoint 한 칸으로 결정된다 */
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

/* 학생이 이 화면에 직접 친 글만 재료로 모은다.
   서술형(story·fact 둘 다)은 전부 — 봉사 내역·활동 내역은 자기소개서의 가장 좋은 재료다.
   짧은 입력은 **프로필로 채울 수 있는 항목(auto 키가 있는 것)을 뺀다** —
   거기가 이름·학번·계좌·주민번호가 사는 자리다. */
function essayMaterials(plan) {
  const out = [];
  (plan.secs || []).forEach((sec) => (sec.items || []).forEach((f) => {
    const el = document.getElementById(`fq-${f.id}`);
    if (!el || !el.value) return;
    const v = String(el.value).trim();
    if (!v) return;
    if (f.type === 'textarea') { out.push({ id: f.id, label: f.label, value: v }); return; }
    if (f.type === 'text') {
      const key = typeof formAutoKey === 'function' ? formAutoKey(f) : '';
      if (key) return;                      // 프로필이 채울 수 있는 자리 = 개인 식별 정보
      out.push({ id: f.id, label: f.label, value: v });
    }
  }));
  /* 클릭으로 고른 답도 재료다 (예: 신청 유형 · 성별이 아닌 '지원 분야') */
  document.querySelectorAll('.fq-choice, .fq-checks').forEach((g) => {
    /* 고른 표시는 이 앱에서 `.active` 하나다 (forms.js 수집 코드와 같은 선택자를 쓴다 —
       베끼면 화면과 재료가 갈라진다) */
    const picked = [...g.querySelectorAll('.chip.active')].map((c) => c.dataset.value).filter(Boolean);
    if (picked.length) out.push({ id: g.dataset.f, label: '', value: picked.join(', ') });
  });
  return out;
}

/* 나갈 프로필 — 이 셋뿐이다 */
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
  if (!essayOn()) return '';
  const plan = formPlanFor(tpl);
  const n = essayStoryFields(plan).length;
  if (!n) return '';
  return `<button class="btn btn-outline btn-lg" id="btn-essay-ai" style="margin-bottom:8px">✨ ${esc(essayCfg('label', 'AI 초안 만들기'))} (${n}칸)</button>`;
}

/* 보내기 전 확인 — 무엇이 나가는지 한 줄씩 보여 주고 줄마다 끌 수 있다 */
function essayConfirmHtml(sch, fields, materials) {
  const prof = essayProfile();
  const row = (kind, id, label, value) =>
    `<label class="fq-sub essay-row"><input type="checkbox" class="essay-send" data-kind="${kind}" data-id="${esc(id)}" checked />` +
    `<span>${esc(label)}</span><em>${esc(String(value).slice(0, 80))}${String(value).length > 80 ? '…' : ''}</em></label>`;

  return `<div class="dp-block essay-confirm" id="essay-confirm">
    <h4>이 내용을 보낼게요</h4>
    <p class="dp-note">보내는 곳은 <b>우리 서버(Cloudflare)</b>를 거쳐 <b>Claude(Anthropic)</b>예요.
      두 곳 모두 <b>해외</b>에 있고, 우리 서버는 <b>저장하지 않아요</b>.
      🔴 주민등록번호·계좌·서류보관함 파일·장애/기초생활수급/국가유공자 여부는 <b>보내지 않아요</b>.</p>

    <div class="essay-list">
      ${row('prof', '_prof', '학교 · 학년 · 전공', [prof.school, prof.major, prof.year].filter(Boolean).join(' '))}
      ${row('sch', '_sch', '장학금 공개 정보', `${sch.name || ''} · ${sch.provider || sch.org || ''}`)}
      ${materials.map((m) => row('mat', m.id, m.label || '내가 쓴 답', m.value)).join('')}
    </div>

    <p class="dp-note">써 드릴 칸: ${fields.map((f) => `<b>${esc(String(f.label).replace(/\n/g, ' ').slice(0, 24))}</b>`).join(' · ')}</p>
    ${materials.length ? '' : '<p class="dp-note essay-thin">⚠️ 아직 적어 주신 내용이 없어요. 짧게라도 몇 칸 채우고 누르시면 훨씬 나은 초안이 나와요.</p>'}

    <button class="btn btn-primary btn-lg" id="btn-essay-send">보내고 초안 받기</button>
    <button class="btn btn-outline" id="btn-essay-cancel" style="margin-top:8px">그만두기</button>
  </div>`;
}

/* 버튼 달기 — renderFormFill 이 화면을 다시 그릴 때마다 부른다 */
function essayBind(tpl, sch) {
  const btn = document.getElementById('btn-essay-ai');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const plan = formPlanFor(tpl);
    const fields = essayStoryFields(plan);
    const materials = essayMaterials(plan);
    btn.insertAdjacentHTML('afterend', essayConfirmHtml(sch, fields, materials));
    btn.hidden = true;
    document.getElementById('btn-essay-cancel').addEventListener('click', () => {
      const box = document.getElementById('essay-confirm');
      if (box) box.remove();
      btn.hidden = false;
    });
    document.getElementById('btn-essay-send')
      .addEventListener('click', () => essaySend(tpl, sch, fields, materials, btn));
  });
}

async function essaySend(tpl, sch, fields, materials, btn) {
  const send = document.getElementById('btn-essay-send');
  const off = new Set([...document.querySelectorAll('.essay-send')].filter((c) => !c.checked).map((c) => c.dataset.id));
  send.disabled = true;
  send.textContent = '초안을 쓰는 중… (20초쯤 걸려요)';

  const payload = {
    scholarship: off.has('_sch') ? { quotes: [] } : {
      name: sch.name || '', provider: sch.provider || sch.org || '', amountText: sch.amountText || '',
      quotes: (sch.excerpts || []).slice(0, 14),
    },
    profile: off.has('_prof') ? {} : essayProfile(),
    materials: materials.filter((m) => !off.has(m.id)).map((m) => ({ label: m.label || '', value: m.value })),
    fields: fields.map((f) => ({
      key: f.id,
      kind: f.kind,
      label: String(f.label || '').replace(/\n/g, ' '),
      hint: f.q || '',
      answer: (document.getElementById(`fq-${f.id}`) || {}).value || '',
    })),
  };

  let data = null;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), essayCfg('timeoutMs', 45000));
    const res = await fetch(essayCfg('endpoint', ''), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    data = await res.json();
  } catch (e) { data = null; }

  const box = document.getElementById('essay-confirm');
  if (box) box.remove();
  if (btn) btn.hidden = false;

  /* 🔴 실패하면 아무것도 건드리지 않는다 — 학생이 쓴 글이 그대로 남아야 한다 */
  if (!data || data.error === 'sensitive') {
    const why = data && data.error === 'sensitive'
      ? '민감정보가 섞여 있어 보내지 않았어요 — 그 문장은 직접 써 주세요'
      : '초안을 받지 못했어요. 잠시 뒤 다시 눌러 보세요 (쓰신 내용은 그대로예요)';
    if (typeof toast === 'function') toast(why);
    return;
  }

  let filled = 0;
  for (const d of data.drafts || []) {
    const el = document.getElementById(`fq-${d.key}`);
    if (!el || !d.text) continue;
    el.value = d.text;
    el.classList.add('essay-drafted');
    /* 칸마다 '초안' 표시를 붙인다 — 학생이 이걸 그대로 낼 글로 오해하면 안 된다 */
    if (!el.parentElement.querySelector('.essay-flag')) {
      el.insertAdjacentHTML('afterend',
        `<p class="dp-note essay-flag">✨ AI 초안이에요 — ${esc(essayCfg('notice', '반드시 읽고 고쳐서 제출하세요.'))}</p>`);
    }
    filled++;
  }

  const skipped = (data.skipped || []).filter((s) => !(data.drafts || []).some((d) => d.key === s.key));
  if (filled && skipped.length) toast(`${filled}칸에 초안을 넣었어요 · ${skipped.length}칸은 직접 써 주세요`);
  else if (filled) toast(`${filled}칸에 초안을 넣었어요 — 꼭 읽고 고쳐 주세요`);
  else toast('이번엔 초안을 만들지 못했어요 — 쓰신 내용은 그대로예요');
}

/* ============================================================
   광고 문의 — 홈 그림 칸 「광고 문의」 → #screen-adinq (2026-11-21 개발자 지시 "광고 문의 탭도 함께 추가해줘")
   ------------------------------------------------------------
   누가 — 한대장에 광고·제휴를 하고 싶은 회사·기관.
   🔴 앱이 대신 보내지 않는다 — 적은 내용을 담아 **메일 앱을 연다**(mailto). 보내기는 문의하는 사람이 직접 누른다
      (고객센터 「문의 메일 쓰기」와 같은 방식 · 서버에 문의를 쌓지 않는다 — 받는 곳은 support-config.js 주소 하나).
      그래서 화면도 '보냈어요'라고 말하지 않는다 — '메일 앱에서 보내기를 눌러 주세요'까지만(운영 원칙 1 정직한 상태).
   🔴 받는 주소가 비어 있으면(supportConfigured() 거짓) 칸 없이 '준비 중' 한 줄 — 눌러도 아무 일 없는 가짜 단추를 두지 않는다.
   쓰다 나가도 남는다 — 적던 칸은 이 기기에만 잠깐 둔다(ADINQ_DRAFT_KEY · 메일 앱을 연 뒤에도 남겨 다시 열 수 있게 · 「지우기」로 비움).
      학생 프로필·신청 기록(handaejang.v1)과는 다른 열쇠라 로그인 동기화로 서버에 나가지 않는다.
   의존 — app.js($·esc·toast·showScreen) · support-config.js(SUPPORT_CONFIG·supportConfigured).
   ============================================================ */
const ADINQ_DRAFT_KEY = 'handaejang.adinq.draft';
const ADINQ_KINDS = ['앱 안 광고', '인스타그램 카드뉴스', '제휴·협업', '기타'];
const ADINQ_FIELDS = ['org', 'name', 'contact', 'kind', 'period', 'body'];

function adinqLoad() {
  try { const d = JSON.parse(localStorage.getItem(ADINQ_DRAFT_KEY)); return d && typeof d === 'object' ? d : {}; } catch (e) { return {}; }
}
function adinqSave(d) { try { localStorage.setItem(ADINQ_DRAFT_KEY, JSON.stringify(d)); } catch (e) { /* 저장 공간이 막혀도 화면은 돈다 */ } }
function adinqClear() { try { localStorage.removeItem(ADINQ_DRAFT_KEY); } catch (e) { /* 무시 */ } }

/* 폼 → 칸 값(앞뒤 공백 정리) */
function adinqCollect(root) {
  const out = {};
  for (const k of ADINQ_FIELDS) {
    if (k === 'kind') { const c = root.querySelector('input[name="kind"]:checked'); out.kind = c ? c.value : ''; continue; }
    const el = root.querySelector(`[name="${k}"]`);
    out[k] = el ? String(el.value || '').trim() : '';
  }
  return out;
}
/* 빠진 필수 칸 → 사람 말 한 줄(없으면 '') */
function adinqMissing(d) {
  if (!d.org) return '회사·기관명을 적어 주세요';
  if (!d.name) return '담당자 이름을 적어 주세요';
  if (!d.contact || d.contact.length < 3) return '답을 받을 연락처(전화 또는 이메일)를 적어 주세요';
  if (!d.body) return '문의 내용을 적어 주세요';
  return '';
}
/* 메일 제목·본문 — 적은 그대로 담는다(지어내지 않는다 · 빈 칸은 줄째 뺀다) */
function adinqMail(d) {
  const subject = `[한대장 광고 문의] ${d.org}`.slice(0, 120);
  const rows = [['회사·기관명', d.org], ['담당자', d.name], ['연락처', d.contact], ['광고 종류', d.kind], ['희망 기간', d.period]]
    .filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`);
  const body = `${rows.join('\n')}\n\n문의 내용:\n${d.body}\n`;
  return { subject, body };
}
function adinqMailto(d) {
  const m = adinqMail(d);
  return `mailto:${encodeURIComponent(SUPPORT_CONFIG.email)}?subject=${encodeURIComponent(m.subject)}&body=${encodeURIComponent(m.body)}`;
}

function renderAdInquiry() {
  const el = $('#adinq-body');
  if (!el) return;
  if (typeof supportConfigured !== 'function' || !supportConfigured()) {
    el.innerHTML = '<div class="my-card"><p class="sup-desc">광고 문의는 지금 준비 중이에요.</p></div>';
    return;
  }
  const d = adinqLoad();
  const v = (k) => esc(d[k] || '');
  el.innerHTML = `<div class="my-card">
      <p class="wallet-title">광고·제휴 문의</p>
      <p class="sup-desc">한대장에 광고나 제휴를 원하시면 아래를 적어 주세요. 「메일로 보내기」를 누르면 적은 내용이 담긴 메일 앱이 열리고, 메일 앱에서 보내기를 누르면 전달돼요.</p>
    </div>
    <form class="my-card pr-form" id="adinq-form" novalidate>
      <label class="field"><span class="field-label">회사·기관명</span><input name="org" maxlength="100" autocomplete="organization" value="${v('org')}"></label>
      <label class="field"><span class="field-label">담당자 이름</span><input name="name" maxlength="50" autocomplete="name" value="${v('name')}"></label>
      <label class="field"><span class="field-label">연락처 (전화 또는 이메일)</span><input name="contact" maxlength="100" value="${v('contact')}"></label>
      <div class="field"><span class="field-label">광고 종류 (선택)</span>
        <div class="chip-group">${ADINQ_KINDS.map((k) => `<label class="chip pr-kind${d.kind === k ? ' active' : ''}"><input type="radio" name="kind" value="${esc(k)}" ${d.kind === k ? 'checked' : ''} hidden>${esc(k)}</label>`).join('')}</div></div>
      <label class="field"><span class="field-label">희망 기간 (선택)</span><input name="period" maxlength="100" placeholder="예: 2027년 2월 한 달" value="${v('period')}"></label>
      <label class="field"><span class="field-label">문의 내용</span><textarea name="body" rows="5" maxlength="2000">${v('body')}</textarea></label>
      <p class="auth-err" id="adinq-err" hidden></p>
      <button type="submit" class="btn btn-primary btn-lg pr-wide">메일로 보내기</button>
      <button type="button" class="link-btn" data-adinq="clear">적은 내용 지우기</button>
    </form>
    <div class="my-card">
      <p class="sup-desc">메일 앱이 열리지 않으면 아래 주소로 직접 보내 주세요.</p>
      <p class="pr-title">${esc(SUPPORT_CONFIG.email)}</p>
      <button type="button" class="btn btn-outline pr-wide" data-adinq="copy">주소 복사</button>
    </div>`;
}

function openAdInquiry() { showScreen('adinq'); }

/* 브라우저에서만 — 관문(test-collector)이 Node 에서 이 파일의 순수 함수(adinqMissing·adinqMail)를 불러 쓴다 */
if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', () => {
  const root = $('#adinq-body');
  if (!root) return;
  const back = $('#btn-adinq-back');
  if (back) back.addEventListener('click', () => showScreen('home', { back: true }));
  const err = (m) => { const e = $('#adinq-err'); if (e) { e.textContent = m || ''; e.hidden = !m; } };

  /* 치는 대로 이 기기에 적어 둔다 — 쓰다 나가도(앱을 내려도) 남는다 */
  root.addEventListener('input', (ev) => { const f = ev.target.closest('#adinq-form'); if (f) adinqSave(adinqCollect(f)); });
  root.addEventListener('change', (ev) => { const f = ev.target.closest('#adinq-form'); if (f) adinqSave(adinqCollect(f)); });

  root.addEventListener('click', (ev) => {
    const kind = ev.target.closest('.pr-kind');
    if (kind) { for (const c of root.querySelectorAll('.pr-kind')) c.classList.toggle('active', c === kind); return; }
    const b = ev.target.closest('[data-adinq]');
    if (!b) return;
    if (b.dataset.adinq === 'clear') {
      if (!confirm('적은 내용을 지울까요?')) return;
      adinqClear(); renderAdInquiry(); return;
    }
    if (b.dataset.adinq === 'copy') {
      const done = () => toast('주소를 복사했어요');
      const fail = () => toast(`복사하지 못했어요 · ${SUPPORT_CONFIG.email}`);
      try { navigator.clipboard.writeText(SUPPORT_CONFIG.email).then(done, fail); } catch (e) { fail(); }
    }
  });

  root.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const f = ev.target.closest('#adinq-form');
    if (!f) return;
    const d = adinqCollect(f);
    adinqSave(d);
    const miss = adinqMissing(d);
    if (miss) { err(miss); return; }
    err('');
    /* 🔴 메일 앱을 여는 것뿐이다 — 보내기는 문의하는 사람이 누른다. '보냈어요'라고 하지 않는다 */
    location.href = adinqMailto(d);
    toast('메일 앱에서 보내기를 눌러 주세요');
  });
});

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ADINQ_DRAFT_KEY, ADINQ_KINDS, adinqMissing, adinqMail };
}

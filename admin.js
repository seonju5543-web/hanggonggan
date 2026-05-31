/* =====================
   STATE
===================== */
const DEFAULT_PW = 'admin1234';
let currentData  = null;
let activeTab    = 'signature';

/* =====================
   LOGIN
===================== */
function getPassword() {
  return localStorage.getItem('hangonggan_pw') || DEFAULT_PW;
}

document.getElementById('loginBtn').addEventListener('click', tryLogin);
document.getElementById('pwInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') tryLogin();
});

function tryLogin() {
  const pw = document.getElementById('pwInput').value;
  if (pw === getPassword()) {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('adminPanel').classList.remove('hidden');
    initAdmin();
  } else {
    const err = document.getElementById('loginError');
    err.textContent = '비밀번호가 올바르지 않습니다.';
    document.getElementById('pwInput').value = '';
    document.getElementById('pwInput').focus();
  }
}

document.getElementById('logoutBtn').addEventListener('click', () => {
  document.getElementById('adminPanel').classList.add('hidden');
  document.getElementById('loginScreen').classList.remove('hidden');
  document.getElementById('pwInput').value = '';
});

/* =====================
   INIT
===================== */
function initAdmin() {
  currentData = getSiteData();
  fillBasic();
  buildHoursEditor();
  buildMenuEditor();
  fillTheme();

  // Sidebar navigation
  document.querySelectorAll('.sidebar__item').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.sidebar__item').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.section-panel').forEach(s => s.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`sec-${btn.dataset.section}`).classList.add('active');
    });
  });

  // Menu tabs
  document.querySelectorAll('.menu-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.menu-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.menu-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      activeTab = tab.dataset.mtab;
      document.getElementById(`mp-${activeTab}`).classList.add('active');
    });
  });
}

/* =====================
   BASIC INFO
===================== */
function fillBasic() {
  const r = currentData.restaurant;
  setVal('f-name',    r.name);
  setVal('f-nameEn',  r.nameEn);
  setVal('f-tagline', r.tagline);
  setVal('f-hero',    r.hero);
  setVal('f-quote',   r.quote);
  setVal('f-about1',  r.about1);
  setVal('f-about2',  r.about2);
  setVal('f-phone',   r.phone);
  setVal('f-addr1',   r.address1);
  setVal('f-addr2',   r.address2);
  setVal('f-notice',  r.notice);
}

function saveBasic() {
  currentData.restaurant = {
    ...currentData.restaurant,
    name:     getVal('f-name'),
    nameEn:   getVal('f-nameEn'),
    tagline:  getVal('f-tagline'),
    hero:     getVal('f-hero'),
    quote:    getVal('f-quote'),
    about1:   getVal('f-about1'),
    about2:   getVal('f-about2'),
    phone:    getVal('f-phone'),
    address1: getVal('f-addr1'),
    address2: getVal('f-addr2'),
    notice:   getVal('f-notice')
  };
  persist();
}

/* =====================
   HOURS
===================== */
function buildHoursEditor() {
  const container = document.getElementById('hoursEditor');
  container.innerHTML = currentData.hours.map((h, i) => `
    <div class="hours-row" data-idx="${i}">
      <span class="hours-day">${h.day}</span>
      <div class="hours-inputs">
        <input type="text" class="hours-open"  value="${h.closed ? '' : h.time.split('–')[0]?.trim() || ''}" placeholder="17:00" ${h.closed ? 'disabled' : ''}/>
        <span class="hours-sep">–</span>
        <input type="text" class="hours-close" value="${h.closed ? '' : h.time.split('–')[1]?.trim() || ''}" placeholder="00:00" ${h.closed ? 'disabled' : ''}/>
      </div>
      <label class="closed-toggle">
        <input type="checkbox" class="hours-closed" ${h.closed ? 'checked' : ''}/>
        휴무
      </label>
    </div>`).join('');

  // Toggle disabled on checkbox change
  container.querySelectorAll('.hours-closed').forEach(cb => {
    cb.addEventListener('change', () => {
      const row = cb.closest('.hours-row');
      row.querySelectorAll('.hours-open, .hours-close').forEach(inp => {
        inp.disabled = cb.checked;
        if (cb.checked) inp.value = '';
      });
    });
  });
}

function saveHours() {
  const rows = document.querySelectorAll('.hours-row');
  currentData.hours = currentData.hours.map((h, i) => {
    const row    = rows[i];
    const closed = row.querySelector('.hours-closed').checked;
    const open   = row.querySelector('.hours-open').value.trim();
    const close  = row.querySelector('.hours-close').value.trim();
    return { day: h.day, time: closed ? '' : `${open} – ${close}`, closed };
  });
  persist();
}

/* =====================
   MENU EDITOR
===================== */
function buildMenuEditor() {
  ['signature', 'pasta', 'side'].forEach(cat => {
    renderMenuPanel(cat);
  });
  document.getElementById('mp-signature').classList.add('active');
}

function renderMenuPanel(cat) {
  const panel = document.getElementById(`mp-${cat}`);
  const items = currentData.menu[cat];
  panel.innerHTML = items.map((item, i) => menuItemCardHTML(cat, i, item)).join('');
  panel.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', () => {
      currentData.menu[cat].splice(+btn.dataset.idx, 1);
      renderMenuPanel(cat);
    });
  });
}

function menuItemCardHTML(cat, i, item) {
  const featuredField = cat === 'signature' ? `
    <div class="field" style="grid-column:1/-1">
      <label class="featured-toggle">
        <input type="checkbox" class="item-featured" ${item.featured ? 'checked' : ''}/>
        대표 메뉴로 표시
      </label>
    </div>` : '';

  return `
    <div class="menu-item-card" data-cat="${cat}" data-idx="${i}">
      <div class="menu-item-header">
        <span>${cat === 'signature' ? '시그니처' : cat === 'pasta' ? '파스타' : '사이드'} ${i + 1}</span>
        <button class="btn-delete" data-idx="${i}">삭제</button>
      </div>
      <div class="menu-item-fields">
        <div class="field">
          <label>메뉴 이름</label>
          <input type="text" class="item-name" value="${item.name}" placeholder="메뉴 이름"/>
        </div>
        <div class="field">
          <label>가격 <span class="hint">숫자만 (예: 18,000)</span></label>
          <input type="text" class="item-price" value="${item.price || ''}" placeholder="18,000"/>
        </div>
        <div class="field" style="grid-column:1/-1">
          <label>설명</label>
          <textarea class="item-desc" rows="2">${item.desc}</textarea>
        </div>
        ${featuredField}
      </div>
    </div>`;
}

function addMenuItem() {
  currentData.menu[activeTab].push({ name: '새 메뉴', desc: '메뉴 설명을 입력하세요', price: '', featured: false });
  renderMenuPanel(activeTab);
}

function saveMenu() {
  ['signature', 'pasta', 'side'].forEach(cat => {
    const panel = document.getElementById(`mp-${cat}`);
    currentData.menu[cat] = currentData.menu[cat].map((item, i) => {
      const card = panel.querySelector(`[data-idx="${i}"]`);
      if (!card) return item;
      return {
        name:     card.querySelector('.item-name')?.value  || item.name,
        desc:     card.querySelector('.item-desc')?.value  || item.desc,
        price:    card.querySelector('.item-price')?.value || item.price,
        featured: !!card.querySelector('.item-featured')?.checked
      };
    });
  });
  persist();
}

/* =====================
   THEME
===================== */
function fillTheme() {
  const t = currentData.theme;
  setColorField('gold',    t.gold    || '#c9a96e');
  setColorField('bg',      t.bg      || '#080807');
  setColorField('surface', t.surface || '#111110');
  updatePreview();

  ['gold','bg','surface'].forEach(key => {
    document.getElementById(`f-${key}`).addEventListener('input', e => {
      document.getElementById(`f-${key}-hex`).value = e.target.value;
      updatePreview();
    });
    document.getElementById(`f-${key}-hex`).addEventListener('input', e => {
      if (/^#[0-9a-fA-F]{6}$/.test(e.target.value))
        document.getElementById(`f-${key}`).value = e.target.value;
      updatePreview();
    });
  });
}

function setColorField(key, val) {
  document.getElementById(`f-${key}`).value     = val;
  document.getElementById(`f-${key}-hex`).value = val;
}

function updatePreview() {
  const gold    = document.getElementById('f-gold').value;
  const bg      = document.getElementById('f-bg').value;
  const preview = document.getElementById('themePreview');
  preview.style.setProperty('--preview-gold', gold);
  preview.style.setProperty('--preview-bg',   bg);
  preview.querySelector('.preview-card').style.background = bg;
}

function saveTheme() {
  currentData.theme = {
    gold:    document.getElementById('f-gold').value,
    bg:      document.getElementById('f-bg').value,
    surface: document.getElementById('f-surface').value
  };
  persist();
}

/* =====================
   PASSWORD
===================== */
function changePassword() {
  const cur     = document.getElementById('pw-current').value;
  const nw      = document.getElementById('pw-new').value;
  const confirm = document.getElementById('pw-confirm').value;
  const err     = document.getElementById('pw-error');

  if (cur !== getPassword())       { err.textContent = '현재 비밀번호가 올바르지 않습니다.'; return; }
  if (nw.length < 6)               { err.textContent = '새 비밀번호는 6자 이상이어야 합니다.'; return; }
  if (nw !== confirm)              { err.textContent = '새 비밀번호가 일치하지 않습니다.'; return; }

  localStorage.setItem('hangonggan_pw', nw);
  err.textContent = '';
  document.getElementById('pw-current').value = '';
  document.getElementById('pw-new').value     = '';
  document.getElementById('pw-confirm').value  = '';
  showToast('비밀번호가 변경되었습니다 ✓');
}

/* =====================
   HELPERS
===================== */
function persist() {
  saveSiteData(currentData);
  showToast();
}

function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg || '저장되었습니다 ✓';
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2800);
}

function setVal(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val || '';
}
function getVal(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : '';
}

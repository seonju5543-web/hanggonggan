/* =====================================================
   공간 / GONGGAN — admin.js
   Requires: @supabase/supabase-js v2 (CDN)
             supabase-config.js (SUPABASE_URL, SUPABASE_ANON_KEY)
===================================================== */

/* ── Supabase init ────────────────────────────────── */
let sb = null;
let sbReady = false;

try {
  if (typeof SUPABASE_URL === 'string' && !SUPABASE_URL.startsWith('YOUR_')) {
    sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    sbReady = true;
  }
} catch (e) {
  console.warn('[Admin] Supabase not configured:', e.message);
}

/* ── DOM refs ─────────────────────────────────────── */
const loginScreen    = document.getElementById('loginScreen');
const dashboard      = document.getElementById('dashboard');
const loginForm      = document.getElementById('loginForm');
const loginErr       = document.getElementById('loginErr');
const loginBtn       = document.getElementById('loginBtn');
const logoutBtn      = document.getElementById('logoutBtn');
const dashUser       = document.getElementById('dashUser');
const sbBanner       = document.getElementById('sbBanner');
const portfolioList  = document.getElementById('portfolioList');
const inquiryList    = document.getElementById('inquiryList');
const settingsForm   = document.getElementById('settingsForm');
const settingsBtn    = document.getElementById('settingsBtn');
const settingsStatus = document.getElementById('settingsStatus');
const portfolioModal = document.getElementById('portfolioModal');
const portfolioForm  = document.getElementById('portfolioForm');
const pfSaveBtn      = document.getElementById('pfSaveBtn');
const pfStatus       = document.getElementById('pfStatus');

/* ── Theme ────────────────────────────────────────── */
document.documentElement.setAttribute(
  'data-theme',
  localStorage.getItem('gg-theme') || 'dark'
);

/* ── Auth check on load ───────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  if (!sbReady) {
    showDashboardNoAuth();
    return;
  }

  const { data: { session } } = await sb.auth.getSession();
  if (session) {
    showDashboard(session.user);
  } else {
    showLogin();
  }

  // Listen for auth changes
  sb.auth.onAuthStateChange((_event, session) => {
    if (session) showDashboard(session.user);
    else showLogin();
  });
});

/* ── Login ────────────────────────────────────────── */
loginForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginErr.textContent = '';
  loginBtn.disabled = true;
  loginBtn.textContent = '로그인 중…';

  const email    = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPw').value;

  if (!sbReady) {
    loginErr.textContent = 'Supabase가 연결되지 않았습니다. supabase-config.js를 확인해 주세요.';
    loginBtn.disabled = false;
    loginBtn.textContent = '로그인';
    return;
  }

  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) {
    loginErr.textContent = error.message.includes('Invalid') ? '이메일 또는 비밀번호가 올바르지 않습니다.' : error.message;
    loginBtn.disabled = false;
    loginBtn.textContent = '로그인';
  }
  // On success, onAuthStateChange fires and calls showDashboard
});

/* ── Logout ───────────────────────────────────────── */
logoutBtn?.addEventListener('click', async () => {
  if (sbReady) await sb.auth.signOut();
  showLogin();
});

/* ── Show / hide screens ──────────────────────────── */
function showLogin() {
  loginScreen.style.display = 'flex';
  dashboard.classList.remove('visible');
  loginBtn.disabled = false;
  loginBtn.textContent = '로그인';
}

function showDashboard(user) {
  loginScreen.style.display = 'none';
  dashboard.classList.add('visible');
  if (user) dashUser.textContent = user.email;

  if (!sbReady) sbBanner.hidden = false;

  initTabs();
  loadSettings();
  loadPortfolio();
  loadInquiries();
}

function showDashboardNoAuth() {
  loginScreen.style.display = 'none';
  dashboard.classList.add('visible');
  sbBanner.hidden = false;
  dashUser.textContent = '(Supabase 미연결)';
  initTabs();
  loadSettings();
  loadPortfolio();
  loadInquiries();
}

/* ── Tab navigation ───────────────────────────────── */
function initTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('tab-' + btn.dataset.tab)?.classList.add('active');
    });
  });
}

/* ══════════════════════════════════════════════════
   SETTINGS
══════════════════════════════════════════════════ */
const CONFIG_KEYS = [
  'hero_h1_ko','hero_h2_ko','hero_h1_en','hero_h2_en',
  'slogan_ko','slogan_en','contact_phone','contact_email',
];

async function loadSettings() {
  const defaults = {
    hero_h1_ko: '당신의 공간을,', hero_h2_ko: '온라인에',
    hero_h1_en: 'Your Space,', hero_h2_en: 'Online.',
    slogan_ko: '당신의 공간을, 온라인에', slogan_en: 'Your Space, Online.',
    contact_phone: '010-4856-5543', contact_email: 'seonju5543@gmail.com',
  };

  let data = { ...defaults };

  if (sbReady) {
    const { data: rows } = await sb.from('site_config').select('key,value');
    if (rows) rows.forEach(r => { data[r.key] = r.value; });
  }

  CONFIG_KEYS.forEach(key => {
    const el = document.getElementById('cfg_' + key);
    if (el) el.value = data[key] || '';
  });
}

settingsForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  settingsBtn.disabled = true;
  settingsStatus.classList.remove('show');

  const updates = CONFIG_KEYS.map(key => ({
    key,
    value: document.getElementById('cfg_' + key)?.value || '',
    updated_at: new Date().toISOString(),
  }));

  if (sbReady) {
    const { error } = await sb.from('site_config').upsert(updates, { onConflict: 'key' });
    if (error) {
      console.error('[Admin] Settings save error:', error);
      settingsBtn.disabled = false;
      return;
    }
  } else {
    // Fallback: save to localStorage as demo
    updates.forEach(u => localStorage.setItem('gg_cfg_' + u.key, u.value));
  }

  settingsBtn.disabled = false;
  settingsStatus.classList.add('show');
  setTimeout(() => settingsStatus.classList.remove('show'), 2800);
});

/* ══════════════════════════════════════════════════
   PORTFOLIO
══════════════════════════════════════════════════ */
let portfolioItems = [];
let editingId = null;

async function loadPortfolio() {
  portfolioList.innerHTML = '<div class="loading-row"><div class="spinner"></div> 불러오는 중…</div>';

  if (!sbReady) {
    portfolioItems = getSamplePortfolio();
  } else {
    const { data, error } = await sb
      .from('portfolio_items')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) {
      portfolioList.innerHTML = '<div class="empty-state">불러오기 실패</div>';
      return;
    }
    portfolioItems = data || [];
  }

  renderPortfolio();
}

function getSamplePortfolio() {
  return [
    { id: 'sample-1', title_ko: '연남동 이탈리안', cat_ko: '식당', feat_ko: '풀사이트 · 예약 기능 · 갤러리', image_url: '' },
    { id: 'sample-2', title_ko: '성수 스페셜티 카페', cat_ko: '카페', feat_ko: '풀사이트 · 포토 갤러리', image_url: '' },
    { id: 'sample-3', title_ko: '강원 독채 펜션', cat_ko: '펜션', feat_ko: '풀사이트 · 객실 안내 · 예약', image_url: '' },
  ];
}

function renderPortfolio() {
  if (!portfolioItems.length) {
    portfolioList.innerHTML = '<div class="empty-state">등록된 포트폴리오 항목이 없습니다.</div>';
    return;
  }

  portfolioList.innerHTML = portfolioItems.map(item => `
    <div class="portfolio-item" data-id="${item.id}">
      <div class="portfolio-item-img">
        ${item.image_url ? `<img src="${escHtml(item.image_url)}" alt="" loading="lazy" />` : ''}
      </div>
      <div class="portfolio-item-body">
        <div class="portfolio-item-title">${escHtml(item.title_ko || '')}</div>
        <div class="portfolio-item-cat">${escHtml(item.cat_ko || '')}${item.feat_ko ? ' · ' + escHtml(item.feat_ko) : ''}</div>
      </div>
      <div class="portfolio-item-actions">
        <button class="btn-icon" onclick="openPortfolioModal('${item.id}')" aria-label="편집">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="btn-icon danger" onclick="deletePortfolioItem('${item.id}')" aria-label="삭제">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
        </button>
      </div>
    </div>
  `).join('');
}

document.getElementById('btnAddPortfolio')?.addEventListener('click', () => openPortfolioModal(null));

function openPortfolioModal(id) {
  editingId = id;
  const item = id ? portfolioItems.find(p => p.id === id) : null;

  document.getElementById('modalTitle').textContent = id ? '포트폴리오 편집' : '새 포트폴리오 항목';
  document.getElementById('pf_id').value       = item?.id || '';
  document.getElementById('pf_title_ko').value = item?.title_ko || '';
  document.getElementById('pf_title_en').value = item?.title_en || '';
  document.getElementById('pf_cat_ko').value   = item?.cat_ko || '';
  document.getElementById('pf_cat_en').value   = item?.cat_en || '';
  document.getElementById('pf_feat_ko').value  = item?.feat_ko || '';
  document.getElementById('pf_feat_en').value  = item?.feat_en || '';
  document.getElementById('pf_image').value    = item?.image_url || '';
  document.getElementById('pf_desc_ko').value  = item?.desc_ko || '';
  document.getElementById('pf_desc_en').value  = item?.desc_en || '';
  pfStatus.classList.remove('show');
  portfolioModal.classList.add('open');
}

function closePortfolioModal() {
  portfolioModal.classList.remove('open');
  editingId = null;
}

document.getElementById('btnCloseModal')?.addEventListener('click', closePortfolioModal);
document.getElementById('btnCancelModal')?.addEventListener('click', closePortfolioModal);
portfolioModal?.addEventListener('click', (e) => { if (e.target === portfolioModal) closePortfolioModal(); });

portfolioForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  pfSaveBtn.disabled = true;

  const payload = {
    title_ko:  document.getElementById('pf_title_ko').value.trim(),
    title_en:  document.getElementById('pf_title_en').value.trim() || null,
    cat_ko:    document.getElementById('pf_cat_ko').value.trim() || null,
    cat_en:    document.getElementById('pf_cat_en').value.trim() || null,
    feat_ko:   document.getElementById('pf_feat_ko').value.trim() || null,
    feat_en:   document.getElementById('pf_feat_en').value.trim() || null,
    image_url: document.getElementById('pf_image').value.trim() || null,
    desc_ko:   document.getElementById('pf_desc_ko').value.trim() || null,
    desc_en:   document.getElementById('pf_desc_en').value.trim() || null,
  };

  if (sbReady) {
    let error;
    if (editingId && !editingId.startsWith('sample-')) {
      ({ error } = await sb.from('portfolio_items').update(payload).eq('id', editingId));
    } else {
      ({ error } = await sb.from('portfolio_items').insert([payload]));
    }
    if (error) {
      console.error('[Admin] Portfolio save error:', error);
      pfSaveBtn.disabled = false;
      return;
    }
  }

  pfStatus.classList.add('show');
  pfSaveBtn.disabled = false;

  setTimeout(async () => {
    pfStatus.classList.remove('show');
    closePortfolioModal();
    await loadPortfolio();
  }, 1200);
});

async function deletePortfolioItem(id) {
  if (!confirm('이 항목을 삭제하시겠습니까?')) return;

  if (sbReady && !id.startsWith('sample-')) {
    const { error } = await sb.from('portfolio_items').delete().eq('id', id);
    if (error) { console.error('[Admin] Portfolio delete error:', error); return; }
  } else {
    portfolioItems = portfolioItems.filter(p => p.id !== id);
  }

  await loadPortfolio();
}

/* ══════════════════════════════════════════════════
   INQUIRIES
══════════════════════════════════════════════════ */
async function loadInquiries() {
  inquiryList.innerHTML = '<div class="loading-row"><div class="spinner"></div> 불러오는 중…</div>';

  if (!sbReady) {
    inquiryList.innerHTML = '<div class="empty-state">Supabase 연결 후 문의 내역을 확인할 수 있습니다.</div>';
    return;
  }

  const { data, error } = await sb
    .from('inquiries')
    .select('*')
    .order('submitted_at', { ascending: false });

  if (error || !data) {
    inquiryList.innerHTML = '<div class="empty-state">불러오기 실패</div>';
    return;
  }

  if (!data.length) {
    inquiryList.innerHTML = '<div class="empty-state">접수된 문의가 없습니다.</div>';
    return;
  }

  inquiryList.innerHTML = data.map(inq => `
    <div class="inquiry-item" id="inq-${inq.id}">
      <div>
        <div class="inquiry-meta">
          ${!inq.is_read ? '<span class="unread-dot" title="읽지 않음"></span>' : ''}
          <span class="inquiry-name">${escHtml(inq.name)}</span>
          <span class="inquiry-phone">${escHtml(inq.phone)}</span>
          ${inq.business ? `<span class="inquiry-biz">${escHtml(inq.business)}</span>` : ''}
        </div>
        ${inq.message ? `<p class="inquiry-msg">${escHtml(inq.message)}</p>` : ''}
        <p class="inquiry-time">${formatDate(inq.submitted_at)}</p>
      </div>
      <div class="inquiry-actions">
        ${!inq.is_read ? `<button class="btn-icon" onclick="markRead('${inq.id}')" title="읽음 표시">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20 6L9 17l-5-5"/></svg>
        </button>` : ''}
        <button class="btn-icon danger" onclick="deleteInquiry('${inq.id}')" title="삭제">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
        </button>
      </div>
    </div>
  `).join('');
}

async function markRead(id) {
  if (!sbReady) return;
  await sb.from('inquiries').update({ is_read: true }).eq('id', id);
  await loadInquiries();
}

async function deleteInquiry(id) {
  if (!confirm('이 문의를 삭제하시겠습니까?')) return;
  if (!sbReady) return;
  await sb.from('inquiries').delete().eq('id', id);
  await loadInquiries();
}

/* ── Helpers ──────────────────────────────────────── */
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

/* =====================
   APPLY SITE DATA TO DOM
===================== */
function applyData(d) {
  const r = d.restaurant;

  // Theme
  const root = document.documentElement;
  root.style.setProperty('--gold',    d.theme.gold);
  root.style.setProperty('--gold-lt', d.theme.gold);
  root.style.setProperty('--bg',      d.theme.bg);
  root.style.setProperty('--surface', d.theme.surface);

  // Nav
  setText('navName',   r.name);
  setText('navNameEn', r.nameEn);
  const navPhone = document.getElementById('navPhone');
  if (navPhone) { navPhone.href = `tel:${r.phone.replace(/-/g,'')}`; }

  // Hero
  setText('heroTagline', r.tagline);
  const n = r.name;
  setText('heroName1', n.slice(0, Math.ceil(n.length/2)));
  setText('heroName2', n.slice(Math.ceil(n.length/2)));
  setText('heroDesc',  r.hero);
  setText('loaderText', r.name);

  // About
  setText('aboutText1', r.about1);
  setText('aboutText2', r.about2);

  // Quote
  setText('quoteText', r.quote);

  // Hours
  const hoursList = document.getElementById('hoursList');
  if (hoursList) {
    hoursList.innerHTML = d.hours.map(h => `
      <li class="stagger${h.closed ? ' hours--closed' : ''}">
        <span class="hours__day">${h.day}</span>
        <span class="hours__sep"></span>
        <span class="hours__time">${h.closed ? '휴무' : h.time}</span>
      </li>`).join('');
  }
  setText('infoNotice', r.notice);

  // Address & Phone
  setText('addr1',  r.address1);
  setText('addr2',  r.address2);
  setText('telText', r.phone);
  const tel = document.getElementById('telLink');
  if (tel) tel.href = `tel:${r.phone.replace(/-/g,'')}`;

  // Footer
  setText('footerName',    r.name);
  setText('footerTagline', r.tagline);
  setText('footerAddr',    r.address1);
  setText('footerPhone',   r.phone);
  setText('footerCopy',    `© ${new Date().getFullYear()} ${r.name}. All rights reserved.`);

  // Marquee
  buildMarquee(d.menu);

  // Menu panels
  buildMenuPanels(d.menu);
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

/* =====================
   MARQUEE
===================== */
function buildMarquee(menu) {
  const track = document.getElementById('marqueeTrack');
  if (!track) return;
  const items = [
    ...menu.signature.map(i => i.name),
    ...menu.pasta.map(i => i.name),
    ...menu.side.map(i => i.name)
  ];
  const doubled = [...items, ...items];
  track.innerHTML = doubled.map(name =>
    `<span>${name}</span><span class="dot">·</span>`
  ).join('');
}

/* =====================
   MENU PANELS
===================== */
function buildMenuPanels(menu) {
  // Signature
  const sig = document.getElementById('panel-signature');
  if (sig) {
    const featured = menu.signature.filter(i => i.featured);
    const rest     = menu.signature.filter(i => !i.featured);
    sig.innerHTML = `
      <div class="menu__featured">
        ${featured.map(i => `
          <div class="menu__card menu__card--large stagger">
            <div class="menu__card-inner">
              <div class="menu__card-tag">대표 메뉴</div>
              <div class="menu__card-body">
                <h3>${i.name}</h3>
                <p>${i.desc}</p>
              </div>
              <div class="menu__card-footer">
                <span class="menu__price">${i.price}<em>원</em></span>
              </div>
            </div>
          </div>`).join('')}
      </div>
      <div class="menu__list">
        ${rest.map(i => menuRowHTML(i)).join('')}
      </div>`;
  }

  // Pasta
  const pasta = document.getElementById('panel-pasta');
  if (pasta) {
    pasta.innerHTML = `<div class="menu__list">${menu.pasta.map(menuRowHTML).join('')}</div>`;
  }

  // Side
  const side = document.getElementById('panel-side');
  if (side) {
    side.innerHTML = `
      <div class="menu__list">${menu.side.map(i => menuRowHTML(i, true)).join('')}</div>
      <p class="menu__note">* 사이드 메뉴 가격은 매장에 직접 문의해 주세요.</p>`;
  }
}

function menuRowHTML(item, inquiry = false) {
  const priceHTML = (!item.price || inquiry)
    ? `<span class="menu__row-price menu__row-price--inquiry">문의</span>`
    : `<span class="menu__row-price">${item.price}원</span>`;
  return `
    <div class="menu__row stagger">
      <div class="menu__row-info">
        <h3>${item.name}</h3>
        <p>${item.desc}</p>
      </div>
      ${priceHTML}
    </div>`;
}

/* =====================
   LOADER
===================== */
window.addEventListener('load', () => {
  const data = getSiteData();
  applyData(data);

  const loader = document.getElementById('loader');
  setTimeout(() => {
    loader.classList.add('hidden');
    document.body.classList.remove('loading');
    initHeroAnimations();
    initStaggerObservers();
  }, 1500);
});
document.body.classList.add('loading');

/* =====================
   HERO ENTRANCE
===================== */
function initHeroAnimations() {
  const eyebrow = document.querySelector('.hero__eyebrow');
  const words   = document.querySelectorAll('.hero__title-line');
  const divider = document.querySelector('.hero__divider');
  const fades   = document.querySelectorAll('.hero .reveal-fade');

  setTimeout(() => eyebrow && eyebrow.classList.add('in-view'), 100);
  words.forEach((w, i) => setTimeout(() => w.classList.add('in-view'), 300 + i * 120));
  setTimeout(() => divider && divider.classList.add('in-view'), 650);
  fades.forEach((el, i) => setTimeout(() => el.classList.add('in-view'), 800 + i * 120));
}

/* =====================
   NAV
===================== */
const nav = document.getElementById('nav');
window.addEventListener('scroll', () => {
  nav.classList.toggle('scrolled', window.scrollY > 60);
}, { passive: true });

const toggle   = document.getElementById('navToggle');
const navLinks = document.getElementById('navLinks');
toggle.addEventListener('click', () => {
  toggle.classList.toggle('open');
  navLinks.classList.toggle('open');
});
navLinks.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
  toggle.classList.remove('open');
  navLinks.classList.remove('open');
}));

/* =====================
   PARALLAX
===================== */
const heroBg = document.getElementById('heroBg');
window.addEventListener('scroll', () => {
  const y = window.scrollY;
  if (heroBg && y < window.innerHeight)
    heroBg.style.transform = `translateY(${y * 0.3}px) scale(1.05)`;
}, { passive: true });

/* =====================
   SCROLL OBSERVERS
===================== */
function initStaggerObservers() {
  const mainObs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      e.target.classList.add('in-view');
      mainObs.unobserve(e.target);
    });
  }, { threshold: 0.12 });

  document.querySelectorAll('.reveal-up, .reveal-right, .reveal-fade').forEach(el => {
    if (!el.closest('.hero')) mainObs.observe(el);
  });

  const staggerObs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      e.target.querySelectorAll('.stagger').forEach((el, i) => {
        setTimeout(() => el.classList.add('in-view'), i * 90);
      });
      staggerObs.unobserve(e.target);
    });
  }, { threshold: 0.08 });

  document.querySelectorAll('.menu__list, .menu__featured, .hours, .about__stats').forEach(el => {
    staggerObs.observe(el);
  });

  // Counter
  const counterObs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      e.target.querySelectorAll('.stat__num').forEach(el => {
        const target = +el.dataset.count;
        const start  = performance.now();
        const animate = (now) => {
          const p    = Math.min((now - start) / 1400, 1);
          const ease = 1 - Math.pow(1 - p, 4);
          el.textContent = Math.floor(ease * target);
          if (p < 1) requestAnimationFrame(animate);
          else el.textContent = target;
        };
        requestAnimationFrame(animate);
      });
      counterObs.unobserve(e.target);
    });
  }, { threshold: 0.5 });

  const statsEl = document.querySelector('.about__stats');
  if (statsEl) counterObs.observe(statsEl);
}

/* =====================
   MENU TABS
===================== */
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const t = tab.dataset.tab;
    document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
    document.querySelectorAll('.menu__panel').forEach(x => x.classList.remove('active'));
    tab.classList.add('active');
    const panel = document.querySelector(`[data-panel="${t}"]`);
    panel.classList.add('active');
    panel.querySelectorAll('.stagger').forEach((el, i) => {
      el.classList.remove('in-view');
      setTimeout(() => el.classList.add('in-view'), 40 + i * 70);
    });
  });
});

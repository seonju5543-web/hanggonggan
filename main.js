/* =====================
   LOADER
===================== */
window.addEventListener('load', () => {
  const loader = document.getElementById('loader');
  setTimeout(() => {
    loader.classList.add('hidden');
    document.body.classList.remove('loading');
    initHeroAnimations();
  }, 1500);
});
document.body.classList.add('loading');

/* =====================
   HERO ENTRANCE
===================== */
function initHeroAnimations() {
  const eyebrow = document.querySelector('.hero__eyebrow');
  const words    = document.querySelectorAll('.hero__title-line');
  const divider  = document.querySelector('.hero__divider');
  const fades    = document.querySelectorAll('.hero .reveal-fade');

  // staggered entrance
  setTimeout(() => eyebrow && eyebrow.classList.add('in-view'), 100);
  words.forEach((w, i) => setTimeout(() => w.classList.add('in-view'), 300 + i * 120));
  setTimeout(() => divider && divider.classList.add('in-view'), 650);
  fades.forEach((el, i) => setTimeout(() => el.classList.add('in-view'), 800 + i * 120));
}

/* =====================
   NAV: scroll shrink
===================== */
const nav = document.getElementById('nav');
window.addEventListener('scroll', () => {
  nav.classList.toggle('scrolled', window.scrollY > 60);
}, { passive: true });

/* =====================
   NAV: mobile toggle
===================== */
const toggle  = document.getElementById('navToggle');
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
   PARALLAX HERO BG
===================== */
const heroBg = document.getElementById('heroBg');
window.addEventListener('scroll', () => {
  const y = window.scrollY;
  if (heroBg && y < window.innerHeight) {
    heroBg.style.transform = `translateY(${y * 0.3}px) scale(1.05)`;
  }
}, { passive: true });

/* =====================
   INTERSECTION OBSERVER
===================== */
const ioOptions = { threshold: 0.12 };

const mainObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    entry.target.classList.add('in-view');
    mainObserver.unobserve(entry.target);
  });
}, ioOptions);

document.querySelectorAll('.reveal-up, .reveal-right, .reveal-fade').forEach(el => {
  if (!el.closest('.hero')) mainObserver.observe(el);
});

/* Stagger children in groups */
const staggerObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    entry.target.querySelectorAll('.stagger').forEach((el, i) => {
      setTimeout(() => el.classList.add('in-view'), i * 90);
    });
    staggerObserver.unobserve(entry.target);
  });
}, { threshold: 0.08 });

document.querySelectorAll('.menu__list, .menu__featured, .hours, .about__stats').forEach(el => {
  staggerObserver.observe(el);
});

/* =====================
   COUNTER ANIMATION
===================== */
const counterObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    entry.target.querySelectorAll('.stat__num').forEach(el => {
      const target = +el.dataset.count;
      const duration = 1400;
      const start = performance.now();
      const animate = (now) => {
        const p = Math.min((now - start) / duration, 1);
        const ease = 1 - Math.pow(1 - p, 4);
        el.textContent = Math.floor(ease * target);
        if (p < 1) requestAnimationFrame(animate);
        else el.textContent = target;
      };
      requestAnimationFrame(animate);
    });
    counterObserver.unobserve(entry.target);
  });
}, { threshold: 0.5 });

const statsEl = document.querySelector('.about__stats');
if (statsEl) counterObserver.observe(statsEl);

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

    // re-trigger stagger for newly shown items
    panel.querySelectorAll('.stagger').forEach((el, i) => {
      el.classList.remove('in-view');
      setTimeout(() => el.classList.add('in-view'), 40 + i * 70);
    });
  });
});

/* Initial stagger for visible panel */
document.querySelectorAll('.menu__panel.active .stagger').forEach((el, i) => {
  setTimeout(() => el.classList.add('in-view'), 200 + i * 80);
});

/* =====================
   SMOOTH HOVER on rows
===================== */
document.querySelectorAll('.menu__row').forEach(row => {
  row.addEventListener('mouseenter', () => {
    row.style.paddingLeft = '.6rem';
  });
  row.addEventListener('mouseleave', () => {
    row.style.paddingLeft = '';
  });
});

/* =====================
   GALLERY LIGHTBOX
===================== */
const lightbox     = document.getElementById('lightbox');
const lightboxImg  = document.getElementById('lightboxImg');
const lightboxClose= document.getElementById('lightboxClose');
const lightboxPrev = document.getElementById('lightboxPrev');
const lightboxNext = document.getElementById('lightboxNext');
const galleryItems = Array.from(document.querySelectorAll('.gallery__item'));
let currentLightbox = 0;

function openLightbox(index) {
  currentLightbox = index;
  lightboxImg.src = galleryItems[index].dataset.src;
  lightboxImg.alt = galleryItems[index].querySelector('img').alt;
  lightbox.classList.add('open');
  lightbox.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  lightbox.classList.remove('open');
  lightbox.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  setTimeout(() => { lightboxImg.src = ''; }, 350);
}

function shiftLightbox(dir) {
  currentLightbox = (currentLightbox + dir + galleryItems.length) % galleryItems.length;
  lightboxImg.style.opacity = '0';
  setTimeout(() => {
    lightboxImg.src = galleryItems[currentLightbox].dataset.src;
    lightboxImg.alt = galleryItems[currentLightbox].querySelector('img').alt;
    lightboxImg.style.opacity = '1';
  }, 150);
}

lightboxImg.style.transition = 'opacity .15s ease';

galleryItems.forEach((item, i) => {
  item.addEventListener('click', () => openLightbox(i));
});
lightboxClose.addEventListener('click', closeLightbox);
lightboxPrev.addEventListener('click', () => shiftLightbox(-1));
lightboxNext.addEventListener('click', () => shiftLightbox(1));
lightbox.addEventListener('click', (e) => {
  if (e.target === lightbox) closeLightbox();
});
document.addEventListener('keydown', (e) => {
  if (!lightbox.classList.contains('open')) return;
  if (e.key === 'Escape') closeLightbox();
  if (e.key === 'ArrowLeft')  shiftLightbox(-1);
  if (e.key === 'ArrowRight') shiftLightbox(1);
});

/* Register gallery stagger with the main observer */
const galleryGrid = document.querySelector('.gallery__grid');
if (galleryGrid) staggerObserver.observe(galleryGrid);

/* =====================
   RESERVATION FORM
===================== */
const form        = document.getElementById('reservationForm');
const formSuccess = document.getElementById('formSuccess');
const formSubmit  = document.getElementById('formSubmit');
let guestCount    = 2;

document.getElementById('guestsMinus').addEventListener('click', () => {
  if (guestCount <= 1) return;
  guestCount--;
  document.getElementById('guestsCount').textContent = guestCount;
  document.getElementById('res-guests').value = guestCount;
});
document.getElementById('guestsPlus').addEventListener('click', () => {
  if (guestCount >= 8) return;
  guestCount++;
  document.getElementById('guestsCount').textContent = guestCount;
  document.getElementById('res-guests').value = guestCount;
});

/* Set min date to today */
const dateInput = document.getElementById('res-date');
if (dateInput) {
  const today = new Date().toISOString().split('T')[0];
  dateInput.min = today;
}

function validateField(el) {
  const valid = el.value.trim() !== '';
  el.classList.toggle('invalid', !valid);
  return valid;
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const fields = form.querySelectorAll('[required]');
  let allValid = true;
  fields.forEach(f => { if (!validateField(f)) allValid = false; });
  if (!allValid) return;

  formSubmit.disabled = true;
  formSubmit.querySelector('.form__submit-text').textContent = '전송 중…';

  setTimeout(() => {
    form.querySelectorAll('.form__field, .form__row, .form__notice').forEach(el => {
      el.style.display = 'none';
    });
    formSubmit.style.display = 'none';
    formSuccess.classList.add('show');
  }, 900);
});

form.querySelectorAll('[required]').forEach(el => {
  el.addEventListener('blur', () => validateField(el));
  el.addEventListener('input', () => el.classList.remove('invalid'));
});

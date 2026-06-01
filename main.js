/* =====================================================
   공간 / GONGGAN — main.js
   All interactions, animations, i18n, theme toggle
===================================================== */

/* ── TRANSLATIONS ─────────────────────────────────── */
const T = {
  ko: {
    'meta.tagline': '당신의 공간을, 온라인에',
    'nav.services': '서비스', 'nav.process': '프로세스',
    'nav.portfolio': '포트폴리오', 'nav.pricing': '가격',
    'nav.contact': '문의', 'nav.cta': '상담 신청',
    'hero.h1': '당신의 공간을,', 'hero.h2': '온라인에',
    'hero.desc': 'AI로 제작하는 소상공인 전용 웹사이트. 관리자 페이지와 소유권까지.',
    'hero.cta1': '상담 신청', 'hero.cta2': '포트폴리오 보기',
    's01.label': '01 / 서비스', 's01.title': '우리가 하는 일.',
    's01.s1.name': '웹사이트 제작',
    's01.s1.desc': '업종과 분위기에 맞춘 풀사이트를 AI로 정교하게 설계합니다.',
    's01.s2.name': '코드 없는 관리자 페이지',
    's01.s2.desc': '사장님이 직접 글자·사진·가격을 수정하는 전용 관리자 페이지를 함께 제공합니다.',
    's01.s3.name': '도메인 연결 · 소유권 이전',
    's01.s3.desc': '도메인을 연결하고, 인계 후 사이트의 모든 권한은 사장님에게 있습니다.',
    's02.label': '02 / 프로세스',
    's02.title': '상담부터 인계까지,<br>보통 2주.',
    's02.p1.name': '상담', 's02.p1.desc': '업종, 분위기, 필요한 페이지를 이야기합니다.',
    's02.p2.name': '제작', 's02.p2.desc': 'AI로 사이트 전체를 빠르게 설계하고 구현합니다.',
    's02.p3.name': '검수', 's02.p3.desc': '사장님이 직접 확인하고 무상 수정을 진행합니다.',
    's02.p4.name': '인계', 's02.p4.desc': '도메인과 사이트를 사장님께 이전합니다.',
    's03.label': '03 / 포트폴리오', 's03.title': '선보인 공간들.',
    's03.p1.cat': '식당', 's03.p1.name': '연남동 이탈리안', 's03.p1.feat': '풀사이트 · 예약 기능 · 갤러리',
    's03.p2.cat': '카페', 's03.p2.name': '성수 스페셜티 카페', 's03.p2.feat': '풀사이트 · 포토 갤러리',
    's03.p3.cat': '펜션', 's03.p3.name': '강원 독채 펜션', 's03.p3.feat': '풀사이트 · 객실 안내 · 예약',
    's03.note': '샘플 작업물 · 2026',
    's04.label': '04 / 공간을 선택하는 이유', 's04.title': '기술이 아니라, 결과.',
    's04.p1.name': 'AI 기반 빠른 제작', 's04.p1.desc': '기존 에이전시보다 훨씬 빠르게, 퀄리티는 그대로.',
    's04.p2.name': '합리적 가격', 's04.p2.desc': '일반 에이전시 대비 최대 1/10 수준의 비용.',
    's04.p3.name': '코드 없이 직접 운영', 's04.p3.desc': '전용 관리자 페이지로 사장님이 직접 수정합니다.',
    's04.p4.name': '완전한 소유권 이전', 's04.p4.desc': '인계 후 사이트와 도메인의 모든 권한은 사장님 것.',
    's05.label': '05 / 가격', 's05.title': '투명한 세 가지 플랜.',
    's05.incl': '모든 플랜 포함: 도메인 연결 + 소유권 이전 + 최초 1년분 도메인 등록비 + 최초 1개월분 운영 플랫폼 비용.',
    's05.won': '원', 's05.cta': '문의하기',
    's05.basic.tier': '베이직',
    's05.basic.f1': '단일 페이지', 's05.basic.f2': '기본 관리자 페이지 (메뉴·정보·시간)',
    's05.basic.f3': '템플릿 기반 디자인', 's05.basic.f4': '무상 수정 7일',
    's05.standard.badge': '가장 인기 · 7만원 할인',
    's05.standard.f1': '멀티 섹션 풀사이트', 's05.standard.f2': '관리자 페이지 + 포토 갤러리',
    's05.standard.f3': '업종 맞춤 디자인', 's05.standard.f4': '무상 수정 14일',
    's05.premium.tier': '프리미엄',
    's05.premium.f1': '풀사이트 + 맞춤 기능', 's05.premium.f2': '전체 관리자 페이지 + 문의 접수·관리',
    's05.premium.f3': '완전 커스텀 디자인 + 고급 애니메이션', 's05.premium.f4': '무상 수정 30일',
    's05.compare': '일반 웹에이전시 맞춤 제작은 보통 150만~1,000만원+, 제작 후 글자 수정도 건당 유료. 공간은 AI 기반으로 비용을 최대 1/10 수준으로 낮추고, 코드 없이 직접 수정하는 관리자 페이지까지 제공합니다.',
    's06.label': '06 / 자주 묻는 질문', 's06.title': '자주 묻는 질문.',
    's06.q1': '코드를 몰라도 운영 가능한가요?',
    's06.a1': '네. 전용 관리자 페이지에서 텍스트·사진·가격을 직접 수정하실 수 있습니다. 코드나 개발 지식이 전혀 없어도 됩니다.',
    's06.q2': '수정은 어떻게 하나요?',
    's06.a2': '플랜별 무상 수정 기간 내에는 요청 시 당일~익일 처리합니다. 이후에는 건당 별도 비용이 발생합니다.',
    's06.q3': '도메인은 어떻게 처리되나요?',
    's06.a3': '원하시는 도메인을 공간이 등록해 최초 1년 비용을 부담합니다. 인계 후 도메인 소유권은 사장님께 이전됩니다.',
    's06.q4': '월 운영비는 누가 부담하나요?',
    's06.a4': '최초 1개월 운영 플랫폼 비용은 공간이 부담합니다. 이후 월 비용은 플랜 및 플랫폼에 따라 다르며, 상담 시 안내드립니다.',
    'stats.s1': '제작 사이트 수', 'stats.s2': '평균 제작 기간',
    'stats.s3': '재계약 의향', 'stats.s4': '에이전시 대비 비용',
    's07.label': '07 / 문의', 's07.title': '당신의 공간을<br>이야기해 주세요.',
    's07.f.name': '이름 *', 's07.f.phone': '연락처 *',
    's07.f.biz': '업종', 's07.f.msg': '문의 내용',
    's07.f.privacy': '개인정보는 상담 목적 외 사용되지 않습니다.',
    's07.f.submit': '보내기', 's07.f.sent': '보내주셨습니다. 곧 연락드리겠습니다.',
    'footer.nav': '탐색', 'footer.contact': '연락',
    'footer.policy': '정책', 'footer.p1': '운영 안내', 'footer.p2': '관리자',
  },
  en: {
    'meta.tagline': 'Your Space, Online.',
    'nav.services': 'Services', 'nav.process': 'Process',
    'nav.portfolio': 'Portfolio', 'nav.pricing': 'Pricing',
    'nav.contact': 'Contact', 'nav.cta': 'Get Started',
    'hero.h1': 'Your Space,', 'hero.h2': 'Online.',
    'hero.desc': 'AI-built websites for small businesses. With admin panel and full ownership transfer.',
    'hero.cta1': 'Get Started', 'hero.cta2': 'View Portfolio',
    's01.label': '01 / Services', 's01.title': 'What We Do.',
    's01.s1.name': 'Website Design',
    's01.s1.desc': 'A full, professionally crafted site — built with AI and tailored to your industry.',
    's01.s2.name': 'No-Code Admin Panel',
    's01.s2.desc': 'Edit text, photos, and prices yourself. No code, no developer needed.',
    's01.s3.name': 'Domain & Full Ownership',
    's01.s3.desc': 'We connect your domain and hand over complete ownership on delivery.',
    's02.label': '02 / Process',
    's02.title': 'Consultation to handover.<br>Typically 2 weeks.',
    's02.p1.name': 'Consult', 's02.p1.desc': 'We discuss your industry, aesthetic, and pages needed.',
    's02.p2.name': 'Build', 's02.p2.desc': 'AI rapidly designs and builds the complete site.',
    's02.p3.name': 'Review', 's02.p3.desc': 'You review and we apply complimentary revisions.',
    's02.p4.name': 'Handover', 's02.p4.desc': 'Domain and site ownership are transferred to you.',
    's03.label': '03 / Portfolio', 's03.title': 'Spaces We\'ve Built.',
    's03.p1.cat': 'Restaurant', 's03.p1.name': 'Yeonnam Italian', 's03.p1.feat': 'Full site · Reservations · Gallery',
    's03.p2.cat': 'Café', 's03.p2.name': 'Seongsu Specialty Café', 's03.p2.feat': 'Full site · Photo Gallery',
    's03.p3.cat': 'Pension', 's03.p3.name': 'Gangwon Private Pension', 's03.p3.feat': 'Full site · Rooms · Booking',
    's03.note': 'Sample Work · 2026',
    's04.label': '04 / Why GONGGAN', 's04.title': 'Results, Not Technology.',
    's04.p1.name': 'AI-Powered Speed', 's04.p1.desc': 'Faster than any traditional agency, with no drop in quality.',
    's04.p2.name': 'Rational Pricing', 's04.p2.desc': 'Up to 1/10 the cost of a conventional web agency.',
    's04.p3.name': 'Self-Managed', 's04.p3.desc': 'Your own admin panel — edit content without a developer.',
    's04.p4.name': 'Complete Ownership', 's04.p4.desc': 'After handover, the site and domain are entirely yours.',
    's05.label': '05 / Pricing', 's05.title': 'Three Transparent Plans.',
    's05.incl': 'All plans include: domain setup + ownership transfer + first-year domain fee + first month of platform costs.',
    's05.won': 'KRW', 's05.cta': 'Inquire',
    's05.basic.tier': 'Basic',
    's05.basic.f1': 'Single-page site', 's05.basic.f2': 'Basic admin panel (menu, info, hours)',
    's05.basic.f3': 'Template-based design', 's05.basic.f4': '7-day complimentary revisions',
    's05.standard.badge': 'Most Popular · ₩70,000 Off',
    's05.standard.f1': 'Multi-section full site', 's05.standard.f2': 'Admin panel + photo gallery',
    's05.standard.f3': 'Industry-tailored design', 's05.standard.f4': '14-day complimentary revisions',
    's05.premium.tier': 'Premium',
    's05.premium.f1': 'Full site + custom features', 's05.premium.f2': 'Full admin + inquiry management',
    's05.premium.f3': 'Fully custom design + advanced motion', 's05.premium.f4': '30-day complimentary revisions',
    's05.compare': 'Conventional agencies charge ₩1.5M–₩10M+. Even a text edit costs extra. GONGGAN uses AI to cut costs by up to 90% — and gives you a no-code admin panel so you never need to ask for simple changes.',
    's06.label': '06 / FAQ', 's06.title': 'Frequently Asked.',
    's06.q1': 'Can I manage the site without knowing code?',
    's06.a1': 'Yes. The admin panel lets you edit text, photos, and prices directly. No code or technical knowledge required.',
    's06.q2': 'How do revisions work?',
    's06.a2': 'Within your plan\'s revision period, requests are handled same-day or next-day. After that, a per-item fee applies.',
    's06.q3': 'How is the domain handled?',
    's06.a3': 'We register your domain and cover the first-year fee. After handover, full domain ownership is transferred to you.',
    's06.q4': 'Who pays the monthly platform costs?',
    's06.a4': 'The first month is included. From month two, platform costs are billed directly to you — rates shared at consultation.',
    'stats.s1': 'Sites Built', 'stats.s2': 'Avg. Days',
    'stats.s3': 'Satisfaction Rate', 'stats.s4': 'vs Agency Cost',
    's07.label': '07 / Contact', 's07.title': 'Tell us about<br>your space.',
    's07.f.name': 'Name *', 's07.f.phone': 'Phone *',
    's07.f.biz': 'Business type', 's07.f.msg': 'Message',
    's07.f.privacy': 'Your information is used solely for consultation purposes.',
    's07.f.submit': 'Send', 's07.f.sent': 'Sent. We\'ll be in touch shortly.',
    'footer.nav': 'Navigate', 'footer.contact': 'Contact',
    'footer.policy': 'Legal', 'footer.p1': 'Operations', 'footer.p2': 'Admin',
  },
};

/* ── Supabase (optional) ────────────────────────────── */
let sb = null;
try {
  if (typeof SUPABASE_URL === 'string' && !SUPABASE_URL.startsWith('YOUR_')) {
    sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
} catch (_) {}

/* ── STATE ─────────────────────────────────────────── */
let currentLang  = localStorage.getItem('gg-lang')  || 'ko';
let currentTheme = localStorage.getItem('gg-theme') || 'dark';
let pricingAnimated = false;
let statsAnimated   = false;
let canvasRAF = null;

/* ── DOM READY ─────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  applyTheme(currentTheme, false);
  applyLang(currentLang, false);

  loadSiteConfig();
  initLoader();
  initCanvas();
  initNav();
  initParallax();
  initReveals();
  initProcessLine();
  initPricingAnimation();
  initStatsCounters();
  initFAQ();
  initLangToggle();
  initThemeToggle();
  initBackToTop();
  initForm();
});

/* ── LOADER ────────────────────────────────────────── */
function initLoader() {
  const loader = document.getElementById('loader');
  document.body.classList.add('loading');

  window.addEventListener('load', () => {
    setTimeout(() => {
      loader.classList.add('hidden');
      document.body.classList.remove('loading');
      initHeroWords();
    }, 1700);
  });

  // Fallback in case load event already fired
  if (document.readyState === 'complete') {
    setTimeout(() => {
      loader.classList.add('hidden');
      document.body.classList.remove('loading');
      initHeroWords();
    }, 1700);
  }
}

/* ── HERO WORD-BY-WORD ANIMATION ───────────────────── */
function initHeroWords() {
  const lines = document.querySelectorAll('.hero__line');
  lines.forEach((line, lineIdx) => {
    const text = line.textContent.trim();
    const words = text.split(/\s+/).filter(Boolean);
    line.innerHTML = words.map((word) =>
      `<span class="word">${word}</span>`
    ).join('');

    line.querySelectorAll('.word').forEach((wordEl, i) => {
      const delay = 100 + lineIdx * 180 + i * 90;
      setTimeout(() => wordEl.classList.add('in-view'), delay);
    });
  });

  // Fade in supporting elements
  const fades = document.querySelectorAll('.hero .reveal-fade');
  fades.forEach((el, i) => {
    setTimeout(() => el.classList.add('in-view'), 550 + i * 120);
  });
}

/* ── HERO CANVAS PARTICLES ─────────────────────────── */
function initCanvas() {
  const canvas = document.getElementById('heroCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let particles = [];
  let W, H;
  const COUNT = 70;
  const LINK_DIST = 110;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.offsetWidth;
    H = canvas.offsetHeight;
    canvas.width  = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);
  }

  function initParticles() {
    particles = [];
    for (let i = 0; i < COUNT; i++) {
      particles.push({
        x: Math.random() * W,
        y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.22,
        vy: (Math.random() - 0.5) * 0.22,
        r: Math.random() * 1.6 + 0.3,
        alpha: Math.random() * 0.3 + 0.04,
        phase: Math.random() * Math.PI * 2,
        pSpeed: Math.random() * 0.007 + 0.003,
        isAccent: Math.random() < 0.6,
      });
    }
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

    // Lines between nearby particles
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < LINK_DIST) {
          const la = (1 - dist / LINK_DIST) * 0.055;
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `rgba(176,122,134,${la})`;
          ctx.lineWidth = 0.4;
          ctx.stroke();
        }
      }
    }

    // Dots
    particles.forEach(p => {
      p.phase += p.pSpeed;
      const a = p.alpha * (0.5 + 0.5 * Math.sin(p.phase));
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.isAccent
        ? `rgba(176,122,134,${a})`
        : `rgba(245,239,232,${a * 0.5})`;
      ctx.fill();

      p.x += p.vx;
      p.y += p.vy;
      if (p.x < -10) p.x = W + 10;
      if (p.x > W + 10) p.x = -10;
      if (p.y < -10) p.y = H + 10;
      if (p.y > H + 10) p.y = -10;
    });

    canvasRAF = requestAnimationFrame(draw);
  }

  resize();
  initParticles();
  draw();

  window.addEventListener('resize', () => {
    resize();
    initParticles();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      cancelAnimationFrame(canvasRAF);
    } else {
      canvasRAF = requestAnimationFrame(draw);
    }
  });
}

/* ── NAV ──────────────────────────────────────────── */
function initNav() {
  const nav    = document.getElementById('nav');
  const toggle = document.getElementById('navToggle');
  const center = document.getElementById('navCenter');

  // Scroll shrink
  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 60);
    updateBackTop();
  }, { passive: true });

  // Mobile hamburger
  toggle.addEventListener('click', () => {
    const isOpen = toggle.classList.toggle('open');
    center.classList.toggle('open', isOpen);
    toggle.setAttribute('aria-expanded', isOpen);
  });
  center.querySelectorAll('.nav__link').forEach(link => {
    link.addEventListener('click', () => {
      toggle.classList.remove('open');
      center.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    });
  });

  // Active section highlight
  const sections  = document.querySelectorAll('section[id]');
  const navLinks  = document.querySelectorAll('.nav__link[data-section]');

  const sectionObs = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      navLinks.forEach(l =>
        l.classList.toggle('active', l.dataset.section === entry.target.id)
      );
    });
  }, { rootMargin: '-35% 0px -60% 0px' });

  sections.forEach(s => sectionObs.observe(s));
}

/* ── PARALLAX ─────────────────────────────────────── */
function initParallax() {
  const heroContent = document.querySelector('.hero__content');
  const heroGlows   = document.querySelectorAll('.hero__glow');

  if (!heroContent) return;

  window.addEventListener('scroll', () => {
    const y = window.scrollY;
    if (y > window.innerHeight) return;

    heroContent.style.transform = `translateY(${y * 0.25}px)`;
    heroContent.style.opacity   = 1 - (y / window.innerHeight) * 1.6;

    heroGlows.forEach((g, i) => {
      const factor = i === 0 ? 0.12 : 0.08;
      g.style.transform = g.style.transform.replace(/translateY\([^)]+\)/, '') +
        ` translateY(${y * factor}px)`;
    });
  }, { passive: true });
}

/* ── SCROLL REVEALS ───────────────────────────────── */
function initReveals() {
  const obs = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('in-view');
      obs.unobserve(entry.target);
    });
  }, { threshold: 0.1 });

  document.querySelectorAll('.reveal-up, .reveal-fade').forEach(el => {
    if (!el.closest('.hero')) obs.observe(el);
  });
}

/* ── PROCESS CONNECTOR LINE ────────────────────────── */
function initProcessLine() {
  const track = document.querySelector('.process__track');
  if (!track) return;

  const obs = new IntersectionObserver((entries) => {
    if (!entries[0].isIntersecting) return;
    obs.disconnect();
    // Stagger the individual connectors
    track.querySelectorAll('.process__step-connector').forEach((c, i) => {
      setTimeout(() => c.classList.add('animated'), 200 + i * 280);
    });
  }, { threshold: 0.3 });

  obs.observe(track);
}

/* ── PRICING COUNTDOWN ────────────────────────────── */
function initPricingAnimation() {
  const pricing = document.getElementById('pricing');
  if (!pricing) return;

  const obs = new IntersectionObserver((entries) => {
    if (!entries[0].isIntersecting || pricingAnimated) return;
    pricingAnimated = true;
    obs.disconnect();
    runPricingSequence();
  }, { threshold: 0.35 });

  obs.observe(pricing);
}

function runPricingSequence() {
  const card = document.querySelector('.plan-card--featured');
  if (!card) return;
  const amountEl = card.querySelector('.plan-card__amount');
  if (!amountEl) return;

  // Phase 1: show 690,000 (before discount)
  amountEl.textContent = '690,000';

  // Phase 2: draw strikethrough over original price label
  setTimeout(() => card.classList.add('price-struck'), 700);

  // Phase 3: count down from 690,000 to 620,000
  setTimeout(() => {
    countNumber(amountEl, 690000, 620000, 950, v =>
      v.toLocaleString('ko-KR')
    );
  }, 1200);
}

function countNumber(el, from, to, duration, fmt) {
  const start = performance.now();
  const tick = (now) => {
    const t = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - t, 3);
    el.textContent = (fmt || String)(Math.round(from + (to - from) * eased));
    if (t < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/* ── STATS COUNTERS ───────────────────────────────── */
function initStatsCounters() {
  const band = document.querySelector('.stats-band');
  if (!band) return;

  const obs = new IntersectionObserver((entries) => {
    if (!entries[0].isIntersecting || statsAnimated) return;
    statsAnimated = true;
    obs.disconnect();

    band.querySelectorAll('.stats__num[data-target]').forEach((el, i) => {
      const target = parseInt(el.dataset.target, 10);
      const suffix = el.dataset.suffix || '';
      setTimeout(() => countNumber(el, 0, target, 1500, v => v + suffix), i * 150);
    });
  }, { threshold: 0.5 });

  obs.observe(band);
}

/* ── FAQ ACCORDION ─────────────────────────────────── */
function initFAQ() {
  document.querySelectorAll('.faq__q').forEach(btn => {
    btn.addEventListener('click', () => {
      const isOpen = btn.getAttribute('aria-expanded') === 'true';
      const answer = btn.nextElementSibling;

      // Close all
      document.querySelectorAll('.faq__q').forEach(b => {
        b.setAttribute('aria-expanded', 'false');
        const a = b.nextElementSibling;
        a.style.maxHeight = null;
        a.classList.remove('open');
      });

      // Open clicked if it was closed
      if (!isOpen) {
        btn.setAttribute('aria-expanded', 'true');
        answer.style.maxHeight = answer.scrollHeight + 'px';
        answer.classList.add('open');
      }
    });
  });
}

/* ── LANGUAGE TOGGLE ───────────────────────────────── */
function initLangToggle() {
  const btn = document.getElementById('langToggle');
  if (!btn) return;
  btn.addEventListener('click', () => {
    applyLang(currentLang === 'ko' ? 'en' : 'ko', true);
  });
}

function applyLang(lang, save) {
  currentLang = lang;
  if (save) localStorage.setItem('gg-lang', lang);

  document.documentElement.lang = lang;
  document.querySelector('.lang-kr')?.classList.toggle('active', lang === 'ko');
  document.querySelector('.lang-en')?.classList.toggle('active', lang === 'en');

  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    const val = T[lang]?.[key];
    if (val !== undefined) el.innerHTML = val;
  });

  // Re-split hero words if they're already animated (on lang switch)
  const lines = document.querySelectorAll('.hero__line');
  if (lines.length && lines[0].querySelector('.word')) {
    lines.forEach((line, lineIdx) => {
      const key = lineIdx === 0 ? 'hero.h1' : 'hero.h2';
      const text = T[lang][key] || '';
      const words = text.split(/\s+/).filter(Boolean);
      line.innerHTML = words.map(w =>
        `<span class="word in-view">${w}</span>`
      ).join('');
    });
  }
}

/* ── THEME TOGGLE ──────────────────────────────────── */
function initThemeToggle() {
  const btn = document.getElementById('themeToggle');
  if (!btn) return;
  btn.addEventListener('click', () => {
    applyTheme(currentTheme === 'dark' ? 'light' : 'dark', true);
  });
}

function applyTheme(theme, save) {
  currentTheme = theme;
  if (save) localStorage.setItem('gg-theme', theme);
  document.documentElement.setAttribute('data-theme', theme);
}

/* ── BACK TO TOP ───────────────────────────────────── */
function initBackToTop() {
  const btn = document.getElementById('backTop');
  if (!btn) return;

  btn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

function updateBackTop() {
  const btn = document.getElementById('backTop');
  if (!btn) return;
  const show = window.scrollY > 500;
  btn.hidden = !show;
}

/* ── CONTACT FORM ──────────────────────────────────── */
function initForm() {
  const form    = document.getElementById('contactForm');
  const success = document.getElementById('formSuccess');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = form.querySelector('.form__submit');

    // Basic validation
    const name  = form.fname.value.trim();
    const phone = form.fphone.value.trim();
    if (!name || !phone) {
      form.fname.focus();
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = currentLang === 'ko' ? '전송 중…' : 'Sending…';

    const payload = {
      name,
      phone,
      business: form.fbusiness.value.trim() || null,
      message:  form.fmsg.value.trim() || null,
      submitted_at: new Date().toISOString(),
    };

    try {
      // ── Supabase integration point ──────────────────
      // Replace the simulated delay below with:
      //   await supabase.from('inquiries').insert([payload]);
      await simulateSend(payload);
      // ───────────────────────────────────────────────

      form.reset();
      success.hidden = false;
      submitBtn.hidden = true;
    } catch (err) {
      console.error('Form error:', err);
      submitBtn.disabled = false;
      submitBtn.textContent = T[currentLang]['s07.f.submit'];
    }
  });
}

async function simulateSend(data) {
  if (sb) {
    const { error } = await sb.from('inquiries').insert([{
      name:     data.name,
      phone:    data.phone,
      business: data.business || null,
      message:  data.message  || null,
    }]);
    if (error) throw error;
    return;
  }
  // Fallback: log and simulate delay
  console.log('[Contact form — no DB]', data);
  return new Promise(resolve => setTimeout(resolve, 700));
}

/* ── LIVE SITE CONFIG (from Supabase) ──────────────── */
async function loadSiteConfig() {
  if (!sb) return;
  try {
    const { data } = await sb.from('site_config').select('key,value');
    if (!data) return;

    const cfg = {};
    data.forEach(r => { cfg[r.key] = r.value; });

    // Update hero headline words (if already rendered by loader)
    if (cfg.hero_h1_ko) T.ko['hero.h1'] = cfg.hero_h1_ko;
    if (cfg.hero_h2_ko) T.ko['hero.h2'] = cfg.hero_h2_ko;
    if (cfg.hero_h1_en) T.en['hero.h1'] = cfg.hero_h1_en;
    if (cfg.hero_h2_en) T.en['hero.h2'] = cfg.hero_h2_en;
    if (cfg.slogan_ko)  T.ko['meta.tagline'] = cfg.slogan_ko;
    if (cfg.slogan_en)  T.en['meta.tagline'] = cfg.slogan_en;

    // Update contact info in DOM
    if (cfg.contact_phone) {
      document.querySelectorAll('a[href^="tel:"]').forEach(el => {
        el.href = 'tel:' + cfg.contact_phone.replace(/[^0-9]/g,'');
        if (!el.dataset.i18n) el.textContent = cfg.contact_phone;
      });
    }
    if (cfg.contact_email) {
      document.querySelectorAll('a[href^="mailto:"]').forEach(el => {
        el.href = 'mailto:' + cfg.contact_email;
        if (!el.dataset.i18n) el.textContent = cfg.contact_email;
      });
    }
  } catch (e) {
    console.warn('[Config load]', e.message);
  }
}

// ============================================================================
// landing.js — motion do site público: scroll-reveal (data-reveal), menu
// mobile e accordion do FAQ. Progressive enhancement: a classe .js que
// autoriza o CSS a esconder algo já foi setada por um script inline síncrono
// no <head> — se este módulo não rodar, nada fica preso invisível.
// ============================================================================

// scroll-reveal: stagger por posição entre os irmãos [data-reveal] do mesmo pai
const reveal = document.querySelectorAll('[data-reveal]');
reveal.forEach((el) => {
  el.style.setProperty('--reveal-i', Array.from(el.parentElement.children).indexOf(el));
});

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    entry.target.classList.add('is-visible');
    observer.unobserve(entry.target);
  });
}, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });

reveal.forEach((el) => observer.observe(el));

// header overlay (home): sem fundo no topo, fundo+blur ao rolar
// (landing.css .page-home .landing-header:not(.is-scrolled)).
const landingHeader = document.querySelector('.landing-header');
if (landingHeader) {
  const updateHeaderScrolled = () => {
    landingHeader.classList.toggle('is-scrolled', window.scrollY > 8);
  };
  updateHeaderScrolled();
  window.addEventListener('scroll', updateHeaderScrolled, { passive: true });
}

// menu mobile: fecha ao clicar num link, ao rolar/redimensionar ou com Esc
// (Esc devolve o foco ao gatilho — senão ele fica "solto" atrás do menu fechado)
const mobileNav = document.querySelector('.landing-nav-mobile');
if (mobileNav) {
  const close = () => { mobileNav.open = false; };
  mobileNav.querySelectorAll('a').forEach((a) => a.addEventListener('click', close));
  window.addEventListener('scroll', close, { passive: true });
  window.addEventListener('resize', close);
  mobileNav.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !mobileNav.open) return;
    close();
    mobileNav.querySelector('summary').focus();
  });
}

// FAQ accordion animado: .is-open controla o grid-template-rows (motion.css).
// Abrir espera um frame pintado em 0fr antes de animar; fechar só solta o
// <details> nativo (item.open = false) quando a transição termina. Só 1
// sanfona aberta por vez: abrir uma fecha qualquer outra já aberta.
const faqItems = document.querySelectorAll('.faq__item');
if (faqItems.length) {
  document.documentElement.classList.add('faq-js');
  const closeFaqItem = (item) => {
    const answer = item.querySelector('.faq__a');
    item.classList.remove('is-open');
    answer.addEventListener('transitionend', () => { item.open = false; }, { once: true });
  };
  faqItems.forEach((item) => {
    const summary = item.querySelector('summary');
    if (!summary) return;
    summary.addEventListener('click', (e) => {
      e.preventDefault();
      if (item.classList.contains('is-open')) {
        closeFaqItem(item);
      } else {
        faqItems.forEach((other) => { if (other !== item && other.classList.contains('is-open')) closeFaqItem(other); });
        item.open = true;
        requestAnimationFrame(() => requestAnimationFrame(() => item.classList.add('is-open')));
      }
    });
  });
}

// menu de idioma (bandeira): fecha ao escolher, com Esc (foco volta ao gatilho)
// ou clique fora — o <details> nativo não cobre esses dois últimos.
const langMenus = document.querySelectorAll(".lang-menu");
langMenus.forEach((menu) => {
  menu.querySelectorAll("[data-lang-btn]").forEach((btn) =>
    btn.addEventListener("click", () => { menu.open = false; }));
  menu.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || !menu.open) return;
    menu.open = false;
    menu.querySelector("summary").focus();
  });
});
if (langMenus.length) {
  document.addEventListener("click", (e) => {
    langMenus.forEach((m) => { if (m.open && !m.contains(e.target)) m.open = false; });
  });
}

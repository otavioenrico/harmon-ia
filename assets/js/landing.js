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

// menu mobile: fecha ao clicar num link ou ao rolar/redimensionar
const mobileNav = document.querySelector('.landing-nav-mobile');
if (mobileNav) {
  const close = () => { mobileNav.open = false; };
  mobileNav.querySelectorAll('a').forEach((a) => a.addEventListener('click', close));
  window.addEventListener('scroll', close, { passive: true });
  window.addEventListener('resize', close);
}

// FAQ accordion animado: .is-open controla o grid-template-rows (motion.css).
// Abrir espera um frame pintado em 0fr antes de animar; fechar só solta o
// <details> nativo (item.open = false) quando a transição termina.
document.querySelectorAll('.faq__item').forEach((item) => {
  const summary = item.querySelector('summary');
  const answer = item.querySelector('.faq__a');
  if (!summary || !answer) return;
  summary.addEventListener('click', (e) => {
    e.preventDefault();
    if (item.classList.contains('is-open')) {
      item.classList.remove('is-open');
      answer.addEventListener('transitionend', () => { item.open = false; }, { once: true });
    } else {
      item.open = true;
      requestAnimationFrame(() => requestAnimationFrame(() => item.classList.add('is-open')));
    }
  });
});

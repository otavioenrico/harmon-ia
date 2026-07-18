// ============================================================================
// waitlist.js — captura de e-mail da lista de espera (landing pré-lançamento).
// Uso: <form data-waitlist data-source="home"> com <input type="email"> +
// honeypot oculto <input name="company"> + widget Turnstile (.cf-turnstile).
// P0: o submit vai pro Worker (/api/waitlist), que valida o Turnstile e
// insere via service role — o INSERT anônimo direto no banco foi removido,
// então esta página nem carrega mais o cliente Supabase.
// ============================================================================
import { toast } from './utils.js';
import { t } from './i18n.js';
import { initAnalytics } from './analytics.js';

initAnalytics(); // PostHog atrás do consent — hrmTrack vira no-op sem ele

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// waitlist_submit: page = pathname; segment = slug de /para/<slug> (ou null).
// Nunca pode lançar — analytics jamais quebra o fluxo do form.
function trackSubmit(form) {
  try {
    const page = location.pathname;
    const seg = page.match(/\/para\/([^/]+?)(?:\.html)?$/);
    window.hrmTrack?.('waitlist_submit', {
      page,
      segment: seg ? seg[1] : null,
      source: form.dataset.source || null,
    });
  } catch (_) { /* no-op */ }
}

export function initWaitlistForms(root = document) {
  root.querySelectorAll('form[data-waitlist]').forEach(wireForm);
}

initWaitlistForms();

function wireForm(form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const emailInput = form.querySelector('input[type="email"]');
    const email = emailInput?.value.trim().toLowerCase();
    if (!email || !EMAIL_RE.test(email)) { toast(t('common.waitlistError'), 'error', 'common.waitlistError'); return; }

    const btn = form.querySelector('button[type="submit"]');
    if (btn) btn.disabled = true;

    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          source: form.dataset.source || null,
          company: form.querySelector('input[name="company"]')?.value || '',
          token: form.querySelector('[name="cf-turnstile-response"]')?.value || '',
        }),
      });
      if (!res.ok) throw new Error('waitlist_http_' + res.status);
      trackSubmit(form);
      form.innerHTML = `<p class="waitlist__done" data-i18n="common.waitlistSuccess">${t('common.waitlistSuccess')}</p>`;
    } catch (err) {
      console.error('[waitlist]', err);
      toast(t('common.waitlistError'), 'error', 'common.waitlistError');
      if (btn) btn.disabled = false;
      window.turnstile?.reset?.(); // token do Turnstile é de uso único — gera outro
    }
  });
}

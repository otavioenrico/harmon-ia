// ============================================================================
// waitlist.js — captura de e-mail da lista de espera (landing pré-lançamento).
// Uso: <form data-waitlist data-source="home"> com <input type="email"> +
// honeypot oculto <input name="company">; initWaitlistForms() liga o submit
// em todos os formulários data-waitlist presentes na página.
// ============================================================================
import { supabase } from './supabase.js';
import { toast } from './utils.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function initWaitlistForms(root = document) {
  root.querySelectorAll('form[data-waitlist]').forEach(wireForm);
}

function wireForm(form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (form.querySelector('input[name="company"]')?.value) return; // honeypot: bot

    const emailInput = form.querySelector('input[type="email"]');
    const email = emailInput?.value.trim().toLowerCase();
    if (!email || !EMAIL_RE.test(email)) { toast('Digite um e-mail válido.', 'error'); return; }

    const btn = form.querySelector('button[type="submit"]');
    if (btn) btn.disabled = true;

    const { error } = await supabase
      .from('waitlist')
      .upsert({ email, source: form.dataset.source || null }, { onConflict: 'email', ignoreDuplicates: true });

    if (error) {
      console.error('[waitlist]', error);
      toast('Não deu para entrar na lista agora. Tente de novo.', 'error');
      if (btn) btn.disabled = false;
      return;
    }
    form.innerHTML = '<p class="waitlist__done">Pronto! Avisamos você quando abrir.</p>';
  });
}

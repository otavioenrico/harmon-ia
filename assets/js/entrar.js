// ============================================================================
// entrar.js — wiring da página de login (extraído de entrar.html p/ CSP
// script-src sem 'unsafe-inline').
// ============================================================================
import { supabase } from './supabase.js';
import { ensureSettings, signInWithGoogle, isAllowed } from './auth.js';
import { toast } from './utils.js';
import { t } from './i18n.js';

const btn = document.getElementById('google');
btn.addEventListener('click', async () => {
  btn.disabled = true;
  try { await signInWithGoogle(); }
  catch (e) { toast(e.message, 'error'); btn.disabled = false; }
});

// e-mail/senha e "esqueci": só visuais nesta rodada
const soon = (e) => { e.preventDefault(); toast(t('entrar.toastSoon'), 'warning', 'entrar.toastSoon'); };
document.getElementById('login-form').addEventListener('submit', soon);
document.getElementById('lf-forgot').addEventListener('click', soon);
// "criar conta": pré-lançamento, cadastro público bloqueado -> lista de espera
document.getElementById('lf-signup').addEventListener('click', (e) => {
  e.preventDefault();
  location.href = '/#waitlist-hero';
});

// olho de mostrar/ocultar senha (funciona de verdade — é só UI local)
const pass = document.getElementById('lf-pass');
const eye = document.getElementById('lf-eye');
eye.addEventListener('click', () => {
  const show = pass.type === 'password';
  pass.type = show ? 'text' : 'password';
  eye.setAttribute('aria-label', show ? t('entrar.togglePasswordHide') : t('entrar.togglePasswordShow'));
  eye.classList.toggle('is-on', show);
});

// Entra direto se já há sessão, ou logo após voltar do consentimento Google.
let done = false;
supabase.auth.onAuthStateChange(async (_event, session) => {
  if (session && !done) {
    done = true;
    if (!isAllowed(session.user.email)) {
      await supabase.auth.signOut();
      toast(t('entrar.toastPrelaunch'), 'warning', 'entrar.toastPrelaunch');
      location.replace('/');
      return;
    }
    await ensureSettings(session);          // salva refresh_token na 1ª vez
    location.replace('/app');
  }
});

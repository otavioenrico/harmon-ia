// ============================================================================
// entrar.js — wiring da página de login (extraído de entrar.html p/ CSP
// script-src sem 'unsafe-inline'). Auth é 100% Google; o beta fechado é
// imposto pelo Supabase (signups desligados) — não há allowlist no client.
// ============================================================================
import { supabase } from './supabase.js';
import { ensureSettings, signInWithGoogle } from './auth.js';
import { toast } from './utils.js';
import { t } from './i18n.js';

const btn = document.getElementById('google');
btn.addEventListener('click', async () => {
  btn.disabled = true;
  try { await signInWithGoogle(); }
  catch (e) { toast(e.message, 'error'); btn.disabled = false; }
});

// "criar conta": pré-lançamento, cadastro público bloqueado -> lista de espera
document.getElementById('lf-signup').addEventListener('click', (e) => {
  e.preventDefault();
  location.href = '/#waitlist-hero';
});

// Conta NOVA com signups desligados volta do OAuth com erro no hash em vez de
// sessão (#error=access_denied&error_code=signup_disabled&...). Mostra o aviso
// de pré-lançamento; qualquer outro erro de OAuth aparece como toast genérico.
const hash = new URLSearchParams(location.hash.slice(1));
if (hash.has('error')) {
  history.replaceState(null, '', location.pathname);
  const desc = hash.get('error_description') || '';
  if (hash.get('error_code') === 'signup_disabled' || /signups? not allowed/i.test(desc)) {
    toast(t('entrar.toastPrelaunch'), 'warning', 'entrar.toastPrelaunch');
  } else {
    toast(desc || t('entrar.toastPrelaunch'), 'error');
  }
}

// Entra direto se já há sessão, ou logo após voltar do consentimento Google.
let done = false;
supabase.auth.onAuthStateChange(async (_event, session) => {
  if (session && !done) {
    done = true;
    await ensureSettings(session);          // salva refresh_token na 1ª vez
    location.replace('/app');
  }
});

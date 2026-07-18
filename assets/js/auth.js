// ============================================================================
// auth.js — login com Google (identidade + Calendar no mesmo consentimento),
// captura do refresh_token, guarda de rota e perfil.
// ============================================================================
import { supabase } from './supabase.js';

const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar';
const CONTACTS_SCOPE = 'https://www.googleapis.com/auth/contacts';        // People API (espelho de clientes)
const DRIVE_SCOPE    = 'https://www.googleapis.com/auth/drive.file';        // só arquivos criados pelo app (Sheets/Drive)

// Pré-lançamento: o beta fechado é imposto no SERVIDOR (Supabase Auth →
// "Allow new user signups" desligado). Conta nova volta do OAuth com
// error_code=signup_disabled no hash — entrar.js mostra o aviso.

// Inicia o OAuth. access_type=offline + prompt=consent são OBRIGATÓRIOS para
// o Google devolver provider_refresh_token (sem eles, só vem token de ~1h).
// redirectTo SEMPRE /entrar.html: é a única página que processa o retorno
// (sessão OU erro) — precisa estar nas Redirect URLs do Supabase Auth.
export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      scopes: `openid email profile ${CALENDAR_SCOPE} ${CONTACTS_SCOPE} ${DRIVE_SCOPE}`,
      redirectTo: `${location.origin}/entrar.html`,
      queryParams: { access_type: 'offline', prompt: 'consent' },
    },
  });
  if (error) { console.error(error); throw new Error('Não foi possível iniciar o login com o Google.'); }
}

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

// Garante a linha em user_settings e, se a sessão trouxe um refresh_token novo
// (só acontece logo após o consentimento), persiste para renovação futura.
export async function ensureSettings(session) {
  if (!session?.user) return null;
  const patch = { user_id: session.user.id };
  if (session.provider_refresh_token) patch.google_refresh_token = session.provider_refresh_token;
  const { data, error } = await supabase
    .from('user_settings')
    .upsert(patch, { onConflict: 'user_id', ignoreDuplicates: false })
    .select()
    .single();
  if (error) console.error('[user_settings]', error);
  return data;
}

// Usado no painel (/app): sem sessão -> volta ao login.
export async function requireSession() {
  const session = await getSession();
  if (!session) { location.replace('/entrar.html'); return null; }
  return session;
}

export function profile(session) {
  const m = session?.user?.user_metadata || {};
  return {
    name: m.full_name || m.name || session?.user?.email || 'Usuária',
    email: session?.user?.email || '',
    avatar: m.avatar_url || m.picture || '',
  };
}

export async function signOut() {
  await supabase.auth.signOut();
  location.replace('/');
}

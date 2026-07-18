// ============================================================================
// supabase.js — cliente único do Supabase (bundle self-hosted, sem build).
// A anon key vem de config.js (versionado de propósito: a chave é pública por
// design; quem protege os dados é a RLS). O bundle em assets/vendor/ é a
// versão exata 2.110.7 baixada do esm.sh (?bundle) — sem CDN em runtime.
// ============================================================================
import { createClient } from '../vendor/supabase-js-2.110.7.mjs';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true, // processa o retorno do OAuth automaticamente
  },
});

// Lança erro amigável e loga o detalhe técnico no console.
export function check(error, friendly = 'Algo deu errado. Tente novamente.') {
  if (error) {
    console.error('[Supabase]', error);
    throw new Error(friendly);
  }
}

// Atalho: select da tabela já filtrando pelo usuário é desnecessário —
// a RLS faz isso. Use supabase.from('tabela') direto nos módulos.

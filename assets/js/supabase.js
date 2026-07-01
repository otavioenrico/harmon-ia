// ============================================================================
// supabase.js — cliente único do Supabase (via CDN ESM, sem build).
// A anon key vem de config.js (gitignored). A RLS protege os dados.
// ============================================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
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

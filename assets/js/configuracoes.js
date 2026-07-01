// ============================================================================
// configuracoes.js — Conta, Google, Aparência (tema) e Dados (backup).
// Export CSV completo e "Reconectar Google" entram na etapa da Agenda/polish.
// ============================================================================
import { supabase } from './supabase.js';
import { profile, signOut, signInWithGoogle } from './auth.js';
import { toast, esc, initials, download, todayISO, icon } from './utils.js';

const TABLES = ['user_settings', 'services', 'clients', 'stock_items',
  'stock_transactions', 'procedures', 'procedure_materials', 'financial_entries'];

export async function render(root, ctx) {
  const p = profile(ctx.session);
  const dark = ctx.settings?.theme === 'dark';

  root.innerHTML = `
    <div style="max-width:640px; display:flex; flex-direction:column; gap:24px">
      <section class="card">
        <h3>Conta</h3>
        <div class="flex mt-4">
          <div class="avatar avatar--lg">${p.avatar ? `<img src="${esc(p.avatar)}">` : esc(initials(p.name))}</div>
          <div>
            <div>${esc(p.name)}</div>
            <div class="faint">${esc(p.email)}</div>
          </div>
        </div>
        <p class="hint mt-4">O acesso é exclusivamente via Google — não há senha para alterar.</p>
        <button class="btn btn--ghost mt-4" id="logout">Sair da conta</button>
      </section>

      <section class="card">
        <h3>Google</h3>
        <p class="mt-4">Conta conectada: <strong>${esc(p.email)}</strong></p>
        <p class="muted">Agenda: <span class="badge badge--success">${icon('check')} conectada</span></p>
        <p class="hint mt-4">Se a agenda parar de sincronizar, reconecte sua conta Google para renovar o acesso ao Calendar.</p>
        <button class="btn btn--secondary mt-4" id="reconnect">Reconectar Google</button>
      </section>

      <section class="card">
        <h3>Aparência</h3>
        <label class="flex mt-4" style="cursor:pointer">
          <span class="switch"><input type="checkbox" id="theme" ${dark ? 'checked' : ''}><span class="track"></span></span>
          Tema escuro
        </label>
        <p class="hint mt-4">A preferência fica salva na sua conta e vale em qualquer dispositivo.</p>
      </section>

      <section class="card">
        <h3>Dados</h3>
        <p class="muted mt-4">Baixe uma cópia completa dos seus dados.</p>
        <button class="btn btn--secondary mt-4" id="backup">Criar backup (JSON)</button>
      </section>
    </div>`;

  root.querySelector('#logout').onclick = () => signOut();

  root.querySelector('#reconnect').onclick = async (e) => {
    if (!confirm('Reconectar sua conta Google? Você será levado ao consentimento do Google.')) return;
    e.target.disabled = true; e.target.textContent = 'Redirecionando…';
    try { await signInWithGoogle(); }
    catch (err) { toast(err.message, 'error'); e.target.disabled = false; e.target.textContent = 'Reconectar Google'; }
  };

  root.querySelector('#theme').onchange = async (e) => {
    const theme = e.target.checked ? 'dark' : 'light';
    document.documentElement.dataset.theme = theme === 'dark' ? 'dark' : '';
    ctx.settings.theme = theme;
    const { error } = await supabase.from('user_settings')
      .upsert({ user_id: ctx.session.user.id, theme }, { onConflict: 'user_id' });
    if (error) { console.error(error); toast('Não foi possível salvar o tema.', 'error'); }
    else toast('Tema atualizado.');
  };

  root.querySelector('#backup').onclick = async (e) => {
    e.target.disabled = true; e.target.textContent = 'Gerando…';
    const dump = {};
    for (const t of TABLES) {
      const { data } = await supabase.from(t).select('*');
      dump[t] = (data || []).map((row) => { const { google_refresh_token, ...rest } = row; return rest; });
    }
    download(`harmon-backup-${todayISO()}.json`, JSON.stringify(dump, null, 2), 'application/json');
    e.target.disabled = false; e.target.textContent = 'Criar backup (JSON)';
    toast('Backup gerado.');
  };
}

// ============================================================================
// configuracoes.js — Conta, Google, Aparência (tema) e Dados (backup).
// Export CSV completo e "Reconectar Google" entram na etapa da Agenda/polish.
// ============================================================================
import { supabase } from './supabase.js';
import { profile, signOut, signInWithGoogle } from './auth.js';
import { upsertContact, NeedsScope } from './google-people.js';
import { toast, esc, initials, download, todayISO, icon, confirmDialog, maskPhone, bindMask, busy } from './utils.js';

const TABLES = ['user_settings', 'services', 'clients', 'stock_items',
  'stock_transactions', 'procedures', 'procedure_materials', 'financial_entries'];

// cor de destaque: id + amostra (tom 500 de cada paleta em accent.css) + rótulo
const ACCENTS = [
  ['rose',    '#b79ca0', 'Rosé'],
  ['sand',    '#cbb088', 'Areia'],
  ['sky',     '#9bb9cf', 'Céu'],
  ['lilac',   '#b29ec6', 'Lilás'],
  ['mint',    '#97c0a6', 'Menta'],
  ['neutral', '#a3a3a3', 'Neutro'],
];

export async function render(root, ctx) {
  const p = profile(ctx.session);
  const dark = ctx.settings?.theme === 'dark';
  const accent = ctx.settings?.accent || 'rose';

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
        <div class="field mt-4">
          <label>WhatsApp do administrador</label>
          <input class="input" id="wa-number" placeholder="(11) 91234-5678" value="${esc(ctx.settings?.whatsapp_number || '')}">
          <span class="hint">Usado nos botões de enviar resumo por WhatsApp (ex.: lista de compras).</span>
        </div>
        <button class="btn btn--secondary mt-4" id="wa-save"></button>
        <button class="btn btn--ghost mt-4" id="logout">Sair da conta</button>
      </section>

      <section class="card">
        <h3>Google</h3>
        <p class="mt-4">Conta conectada: <strong>${esc(p.email)}</strong></p>
        <p class="muted">Agenda: <span class="badge badge--success">${icon('check')} conectada</span></p>

        <label class="flex mt-4" style="cursor:pointer">
          <span class="switch"><input type="checkbox" id="sync-contacts" ${ctx.settings?.sync_contacts !== false ? 'checked' : ''}><span class="track"></span></span>
          Sincronizar clientes com Google Contatos
        </label>
        <p class="hint mt-4">Quando ligado, cada cliente criada ou editada é espelhada nos seus Contatos do Google (nome, telefone, e-mail, endereço). O sistema continua sendo a fonte da verdade — nada volta do Google para cá.</p>
        <button class="btn btn--secondary mt-4" id="sync-now">Sincronizar clientes agora</button>

        <p class="hint mt-4">Se a agenda ou os contatos pararem de sincronizar, reconecte sua conta Google para renovar o acesso.</p>
        <button class="btn btn--secondary mt-4" id="reconnect">Reconectar Google</button>
      </section>

      <section class="card">
        <h3>Aparência</h3>
        <label class="flex mt-4" style="cursor:pointer">
          <span class="switch"><input type="checkbox" id="theme" ${dark ? 'checked' : ''}><span class="track"></span></span>
          Tema escuro
        </label>
        <div class="mt-4">
          <div class="muted" style="font-size:14px">Cor de destaque</div>
          <div class="swatches mt-4" id="accent">
            ${ACCENTS.map(([id, hex, label]) =>
              `<span class="swatch${id === accent ? ' selected' : ''}" data-a="${id}" style="background:${hex}" title="${label}" role="button" aria-label="${label}"></span>`).join('')}
          </div>
        </div>
        <p class="hint mt-4">A preferência fica salva na sua conta e vale em qualquer dispositivo.</p>
      </section>

      <section class="card">
        <h3>Dados</h3>
        <p class="muted mt-4">Baixe uma cópia completa dos seus dados.</p>
        <button class="btn btn--secondary mt-4" id="backup">Criar backup (JSON)</button>
      </section>
    </div>`;

  root.querySelector('#logout').onclick = () => signOut();

  // trava o campo quando já há um número salvo — "Alterar" libera a edição;
  // ao salvar, trava de novo (evita edição acidental do número em uso).
  let waLocked = !!ctx.settings?.whatsapp_number;
  const waInput = root.querySelector('#wa-number');
  const waBtn = root.querySelector('#wa-save');
  const syncWaMode = () => {
    waInput.disabled = waLocked;
    waBtn.textContent = waLocked ? 'Alterar' : 'Salvar WhatsApp';
  };
  syncWaMode();

  bindMask(waInput, maskPhone);
  waBtn.onclick = async () => {
    if (waLocked) { waLocked = false; syncWaMode(); waInput.focus(); return; }
    const whatsapp_number = waInput.value.trim() || null;
    busy(waBtn, true);
    const { error } = await supabase.from('user_settings')
      .upsert({ user_id: ctx.session.user.id, whatsapp_number }, { onConflict: 'user_id' });
    busy(waBtn, false);
    if (error) { console.error(error); return toast('Não foi possível salvar o WhatsApp.', 'error'); }
    ctx.settings.whatsapp_number = whatsapp_number;
    waLocked = !!whatsapp_number;
    syncWaMode();
    toast('WhatsApp salvo.');
  };

  root.querySelector('#reconnect').onclick = async (e) => {
    const ok = await confirmDialog({
      title: 'Reconectar Google',
      message: 'Você será levado ao consentimento do Google e volta para o app em seguida.',
      confirmLabel: 'Reconectar',
    });
    if (!ok) return;
    e.target.disabled = true; e.target.textContent = 'Redirecionando…';
    sessionStorage.setItem('google:reconnecting', '1'); // app.js confirma com toast na volta
    try { await signInWithGoogle(); }
    catch (err) {
      sessionStorage.removeItem('google:reconnecting');
      toast(err.message, 'error');
      e.target.disabled = false; e.target.textContent = 'Reconectar Google';
    }
  };

  root.querySelector('#sync-contacts').onchange = async (e) => {
    const prev = ctx.settings?.sync_contacts !== false;
    const sync_contacts = e.target.checked;
    const { error } = await supabase.from('user_settings')
      .upsert({ user_id: ctx.session.user.id, sync_contacts }, { onConflict: 'user_id' });
    if (error) { console.error(error); e.target.checked = prev; return toast('Não foi possível salvar a preferência.', 'error'); }
    ctx.settings.sync_contacts = sync_contacts;
    toast(sync_contacts ? 'Sincronização de contatos ligada.' : 'Sincronização de contatos desligada.');
  };

  root.querySelector('#sync-now').onclick = async (e) => {
    const btn = e.target;
    busy(btn, true, 'Sincronizando…');
    const { data, error } = await supabase.from('clients').select('*').eq('active', true);
    if (error) { console.error(error); busy(btn, false); return toast('Não foi possível ler os clientes.', 'error'); }
    let ok = 0, fail = 0;
    for (const c of (data || [])) {
      try {
        const rid = await upsertContact(c);
        if (rid && rid !== c.google_contact_id) await supabase.from('clients').update({ google_contact_id: rid }).eq('id', c.id);
        ok++;
      } catch (err) {
        if (err instanceof NeedsScope) { busy(btn, false); return toast('Reconecte o Google e autorize os Contatos para sincronizar.', 'warning'); }
        console.warn(err); fail++;
      }
    }
    busy(btn, false);
    toast(`Contatos sincronizados: ${ok}${fail ? ` · ${fail} falharam` : ''}.`);
  };

  root.querySelector('#theme').onchange = async (e) => {
    const prev = ctx.settings.theme || 'light';
    const theme = e.target.checked ? 'dark' : 'light';
    document.documentElement.dataset.theme = theme === 'dark' ? 'dark' : '';
    ctx.settings.theme = theme;
    const { error } = await supabase.from('user_settings')
      .upsert({ user_id: ctx.session.user.id, theme }, { onConflict: 'user_id' });
    if (error) {
      // rollback: não deixa o visual dizer "salvo" quando não salvou
      console.error(error);
      document.documentElement.dataset.theme = prev === 'dark' ? 'dark' : '';
      ctx.settings.theme = prev;
      e.target.checked = prev === 'dark';
      toast('Não foi possível salvar o tema.', 'error');
    } else toast('Tema atualizado.');
  };

  root.querySelector('#accent').onclick = async (e) => {
    const s = e.target.closest('[data-a]'); if (!s) return;
    const prev = ctx.settings.accent || 'rose';
    const accent = s.dataset.a;
    const mark = (id) => root.querySelectorAll('#accent .swatch')
      .forEach((x) => x.classList.toggle('selected', x.dataset.a === id));
    document.documentElement.dataset.accent = accent;
    ctx.settings.accent = accent;
    mark(accent);
    const { error } = await supabase.from('user_settings')
      .upsert({ user_id: ctx.session.user.id, accent }, { onConflict: 'user_id' });
    if (error) {
      console.error(error);
      document.documentElement.dataset.accent = prev;
      ctx.settings.accent = prev;
      mark(prev);
      toast('Não foi possível salvar a cor.', 'error');
    } else toast('Cor de destaque atualizada.');
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

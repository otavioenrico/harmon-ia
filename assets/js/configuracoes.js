// ============================================================================
// configuracoes.js — Conta, Google, Aparência (tema) e Dados (backup).
// Export CSV completo e "Reconectar Google" entram na etapa da Agenda/polish.
// ============================================================================
import { supabase } from './supabase.js';
import { profile, signOut, signInWithGoogle } from './auth.js';
import { upsertContact, NeedsScope } from './google-people.js';
import { listEvents, NeedsReconnect } from './google-cal.js';
import { uploadJSON, NeedsScope as DriveNeedsScope } from './google-drive.js';

// logos oficiais (SVG inline, sem CDN) usados como identificação visual.
const GOOGLE_LOGO = `<span class="g-logo"><svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true">
  <path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"/>
  <path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"/>
  <path fill="#FBBC05" d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z"/>
  <path fill="#EA4335" d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"/>
</svg></span>`;
const CAL_LOGO = `<span class="g-logo"><svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true">
  <rect x="8" y="8" width="32" height="32" rx="4" fill="#fff" stroke="#dadce0" stroke-width="2"/>
  <text x="24" y="31" font-family="Arial, sans-serif" font-size="16" font-weight="700" fill="#4285F4" text-anchor="middle">31</text>
</svg></span>`;
const CONTACTS_LOGO = `<span class="g-logo"><svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true">
  <rect x="8" y="8" width="32" height="32" rx="4" fill="#fff" stroke="#dadce0" stroke-width="2"/>
  <circle cx="24" cy="21" r="5" fill="#4285F4"/>
  <path d="M14 34c0-5 4.5-8 10-8s10 3 10 8z" fill="#4285F4"/>
</svg></span>`;
const WHATSAPP_LOGO = `<span class="g-logo"><svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true">
  <rect width="48" height="48" rx="11" fill="var(--whatsapp)"/>
  <path fill="#fff" d="M24 12c-6.6 0-12 5.4-12 12 0 2.1.6 4.2 1.6 6L12 36l6.2-1.6c1.7 1 3.7 1.5 5.8 1.5 6.6 0 12-5.4 12-12S30.6 12 24 12z"/>
  <path fill="var(--whatsapp)" d="M20.1 18.3c-.3-.7-.6-.6-.8-.6h-.7c-.3 0-.7.1-1 .5s-1.3 1.3-1.3 3.1 1.3 3.6 1.5 3.8c.2.3 2.6 4.1 6.4 5.6 3.2 1.2 3.8 1 4.5.9s2.1-.9 2.4-1.7c.3-.8.3-1.5.2-1.6-.1-.2-.4-.3-.8-.5s-2.1-1-2.4-1.2c-.3-.1-.6-.2-.8.2s-.9 1.2-1.1 1.4c-.2.2-.4.2-.7.1s-1.5-.6-2.9-1.8c-1.1-1-1.8-2.1-2-2.5-.2-.4 0-.6.1-.7.2-.2.4-.4.5-.6.2-.2.2-.4.4-.6.1-.2 0-.5 0-.7-.1-.2-.8-2.1-1.1-2.9z"/>
</svg></span>`;
import { toast, esc, initials, download, todayISO, icon, confirmDialog, maskPhone, bindMask, busy, openModal } from './utils.js';

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
        <button class="btn btn--ghost mt-4" id="logout">Sair da conta</button>
      </section>

      <section class="card">
        <div class="setting-row">
          <div class="flex">${WHATSAPP_LOGO}<h3 style="margin:0">WhatsApp</h3></div>
        </div>
        <p class="hint" style="margin-top:8px">Número usado nos botões de enviar resumo por WhatsApp (ex.: lista de compras).</p>
        <div class="setting-divider"></div>
        <div class="wa-row">
          <input class="input" id="wa-number" placeholder="(11) 91234-5678" value="${esc(ctx.settings?.whatsapp_number || '')}" disabled>
          <button class="btn btn--icon btn--ghost" id="wa-edit"></button>
        </div>
      </section>

      <section class="card">
        <!-- cabeçalho: Google + reconectar -->
        <div class="setting-row">
          <div class="flex">${GOOGLE_LOGO}<h3 style="margin:0">Google</h3></div>
          <button class="btn btn--icon btn--ghost" id="reconnect" title="Reconectar Google" aria-label="Reconectar Google">${icon('plug')}</button>
        </div>
        <p class="hint" style="margin-top:8px">Conta: <strong>${esc(p.email)}</strong></p>

        <div class="setting-divider"></div>

        <!-- Google Agenda: fonte da verdade, sempre ligada -->
        <div class="setting-row">
          <div class="flex">${CAL_LOGO}<span style="font-weight:500">Google Agenda</span></div>
          <div class="flex" style="gap:8px">
            <span class="badge badge--success">${icon('check')} conectada</span>
            <button class="btn btn--icon btn--ghost" id="cal-refresh" title="Testar conexão da agenda" aria-label="Testar conexão da agenda">${icon('refresh')}</button>
          </div>
        </div>

        <div class="setting-divider"></div>

        <!-- Google Contatos: espelho (liga/desliga + ressincronizar) -->
        <div class="setting-row">
          <div class="flex">${CONTACTS_LOGO}<span style="font-weight:500">Google Contatos</span></div>
          <div class="flex" style="gap:8px">
            <button class="btn btn--icon btn--ghost" id="sync-now" title="Ressincronizar contatos" aria-label="Ressincronizar contatos">${icon('refresh')}</button>
            <label style="display:inline-flex; margin:0; cursor:pointer" title="Ativar/desativar sincronização">
              <span class="switch"><input type="checkbox" id="sync-contacts" ${ctx.settings?.sync_contacts !== false ? 'checked' : ''}><span class="track"></span></span>
            </label>
          </div>
        </div>
        <p class="hint" style="margin-top:8px">Cada cliente criada ou editada é espelhada nos seus Contatos do Google. O sistema continua sendo a fonte da verdade — nada volta do Google para cá.</p>
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

        <div class="setting-divider"></div>

        <label class="setting-row" style="cursor:pointer">
          <span style="font-weight:500">Backup automático semanal no Google Drive</span>
          <span class="switch"><input type="checkbox" id="backup-auto" ${ctx.settings?.backup_enabled ? 'checked' : ''}><span class="track"></span></span>
        </label>
        <p class="hint mt-4">Uma vez por semana, o app salva uma cópia dos seus dados numa pasta "Harmon IA Backups" no seu Google Drive — mantendo os 12 mais recentes. Seus dados continuam no sistema; isso é só uma rede de segurança.</p>
        <button class="btn btn--secondary mt-4" id="backup-now">Fazer backup no Drive agora</button>

        <div class="setting-divider"></div>

        <p class="muted">Restaurar de um backup <span class="faint">— substitui todos os dados atuais pelos do arquivo.</span></p>
        <button class="btn btn--secondary mt-4" id="restore">Restaurar de um backup…</button>
        <input type="file" id="restore-file" accept="application/json,.json" hidden>
      </section>
    </div>`;

  root.querySelector('#logout').onclick = () => signOut();

  // WhatsApp: número trava por padrão; o lápis libera a edição e o ✓ salva e
  // trava de novo (evita edição acidental do número em uso).
  let waLocked = true;
  const waInput = root.querySelector('#wa-number');
  const waEdit = root.querySelector('#wa-edit');
  const syncWaMode = () => {
    waInput.disabled = waLocked;
    waEdit.innerHTML = waLocked ? icon('edit') : icon('check');
    waEdit.title = waLocked ? 'Editar número' : 'Salvar número';
    waEdit.setAttribute('aria-label', waEdit.title);
  };
  syncWaMode();

  bindMask(waInput, maskPhone);
  waEdit.onclick = async () => {
    if (waLocked) { waLocked = false; syncWaMode(); waInput.focus(); return; }
    const whatsapp_number = waInput.value.trim() || null;
    waEdit.classList.add('is-busy'); waEdit.disabled = true;
    const { error } = await supabase.from('user_settings')
      .upsert({ user_id: ctx.session.user.id, whatsapp_number }, { onConflict: 'user_id' });
    waEdit.classList.remove('is-busy'); waEdit.disabled = false;
    if (error) { console.error(error); return toast('Não foi possível salvar o WhatsApp.', 'error'); }
    ctx.settings.whatsapp_number = whatsapp_number;
    waLocked = true;
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
    const btn = e.currentTarget;                              // botão-ícone: não usar busy() (apagaria o SVG)
    btn.classList.add('is-busy'); btn.disabled = true;
    const done = () => { btn.classList.remove('is-busy'); btn.disabled = false; };
    const { data, error } = await supabase.from('clients').select('*').eq('active', true);
    if (error) { console.error(error); done(); return toast('Não foi possível ler os clientes.', 'error'); }
    let ok = 0, fail = 0;
    for (const c of (data || [])) {
      try {
        const rid = await upsertContact(c);
        if (rid && rid !== c.google_contact_id) await supabase.from('clients').update({ google_contact_id: rid }).eq('id', c.id);
        ok++;
      } catch (err) {
        if (err instanceof NeedsScope) { done(); return toast('Reconecte o Google e autorize os Contatos para sincronizar.', 'warning'); }
        console.warn(err); fail++;
      }
    }
    done();
    toast(`Contatos sincronizados: ${ok}${fail ? ` · ${fail} falharam` : ''}.`);
  };

  // refresh da Agenda = testa a conexão (puxa 1 dia do Calendar).
  root.querySelector('#cal-refresh').onclick = async (e) => {
    const btn = e.currentTarget;
    btn.classList.add('is-busy'); btn.disabled = true;
    try {
      const now = new Date();
      await listEvents(now, new Date(now.getTime() + 86400000));
      toast('Agenda conectada e sincronizando.');
    } catch (err) {
      if (err instanceof NeedsReconnect) toast('Reconecte sua conta Google para renovar o acesso à agenda.', 'warning');
      else { console.warn(err); toast('Não foi possível conectar à agenda.', 'error'); }
    } finally { btn.classList.remove('is-busy'); btn.disabled = false; }
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

  root.querySelector('#backup-auto').onchange = async (e) => {
    const prev = !!ctx.settings?.backup_enabled;
    const backup_enabled = e.target.checked;
    const { error } = await supabase.from('user_settings')
      .upsert({ user_id: ctx.session.user.id, backup_enabled }, { onConflict: 'user_id' });
    if (error) { console.error(error); e.target.checked = prev; return toast('Não foi possível salvar a preferência.', 'error'); }
    ctx.settings.backup_enabled = backup_enabled;
    toast(backup_enabled ? 'Backup automático ligado.' : 'Backup automático desligado.');
  };

  root.querySelector('#backup-now').onclick = async (e) => {
    const btn = e.currentTarget;
    busy(btn, true, 'Enviando…');
    try {
      const dump = {};
      for (const t of TABLES) {
        const { data } = await supabase.from(t).select('*');
        dump[t] = (data || []).map((row) => { const { google_refresh_token, ...rest } = row; return rest; });
      }
      await uploadJSON('Harmon IA Backups', `harmon-backup-${todayISO()}.json`, dump);
      toast('Backup salvo no seu Google Drive.');
    } catch (err) {
      if (err instanceof DriveNeedsScope || err instanceof NeedsReconnect)
        toast('Reconecte o Google e autorize o Drive para o backup.', 'warning');
      else { console.error(err); toast('Não foi possível enviar o backup.', 'error'); }
    } finally { busy(btn, false); }
  };

  // ------------------------------------------------------------- restaurar ----
  // Substitui TODOS os dados pelos do arquivo (RPC transacional). Antes, baixa um
  // backup de segurança do estado atual e pede confirmação digitada.
  root.querySelector('#restore').onclick = () => root.querySelector('#restore-file').click();
  root.querySelector('#restore-file').onchange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';                          // permite reescolher o mesmo arquivo depois
    if (!file) return;

    let payload;
    try { payload = JSON.parse(await file.text()); }
    catch { return toast('Arquivo inválido — não é um JSON.', 'error'); }
    const looksLikeBackup = payload && typeof payload === 'object' && !Array.isArray(payload)
      && ['clients', 'procedures', 'financial_entries', 'services', 'stock_items'].some((k) => k in payload);
    if (!looksLikeBackup) return toast('Este arquivo não parece um backup do Harmon.', 'error');

    // rede de proteção: baixa o estado atual antes de qualquer coisa
    const current = {};
    for (const t of TABLES) {
      const { data } = await supabase.from(t).select('*');
      current[t] = (data || []).map((row) => { const { google_refresh_token, ...rest } = row; return rest; });
    }
    download(`harmon-antes-de-restaurar-${todayISO()}.json`, JSON.stringify(current, null, 2), 'application/json');

    const ok = await typedConfirm();
    if (!ok) return;

    const { error } = await supabase.rpc('restore_backup', { p_payload: payload });
    if (error) { console.error(error); return toast('Não foi possível restaurar. Nada foi alterado.', 'error'); }
    toast('Dados restaurados. Recarregando…');
    setTimeout(() => location.reload(), 900);
  };
}

// confirmação forte: só habilita "Restaurar" quando o usuário digita RESTAURAR.
function typedConfirm() {
  return new Promise((resolve) => {
    const body = document.createElement('div');
    body.innerHTML = `
      <p style="margin:0 0 12px">Isto vai <strong>apagar todos os dados atuais</strong> e substituí-los pelos do arquivo. Já baixamos um backup de segurança do estado atual no seu computador.</p>
      <p style="margin:0 0 8px">Para confirmar, digite <strong>RESTAURAR</strong>:</p>
      <input class="input" id="rc-input" placeholder="RESTAURAR" autocomplete="off" spellcheck="false">`;
    const foot = document.createElement('div');
    foot.innerHTML = `<button class="btn btn--ghost" type="button" data-x>Cancelar</button>
      <button class="btn btn--danger" type="button" data-go disabled>Restaurar</button>`;
    const m = openModal({ title: 'Restaurar backup', body, footer: foot, onClose: () => resolve(false) });
    const input = body.querySelector('#rc-input');
    const go = foot.querySelector('[data-go]');
    input.oninput = () => { go.disabled = input.value.trim().toUpperCase() !== 'RESTAURAR'; };
    foot.querySelector('[data-x]').onclick = () => m.close();
    go.onclick = () => { resolve(true); m.close(true); };
  });
}

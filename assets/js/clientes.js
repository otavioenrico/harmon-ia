// ============================================================================
// clientes.js — cadastro de clientes: tabela com busca/ordenação, formulário
// criar/editar (modal) e perfil em drawer lateral com abas Procedimentos e
// Financeiro. Segue o padrão de servicos.js. A RLS isola por usuário: lê sem
// filtrar user_id; nos inserts inclui user_id: ctx.session.user.id.
// ============================================================================
import { supabase } from './supabase.js';
import { money, fmtDate, maskPhone, maskCPF, bindMask, openModal, openDrawer, confirmDialog,
  toast, busy, debounce, esc, initials, skeletonRows, h, waLink, icon, emptyBox, guard, selectModeBar } from './utils.js';
import { upsertContact, deleteContact, NeedsScope } from './google-people.js';

// Espelha a cliente no Google Contatos. BEST-EFFORT: nunca bloqueia nem desfaz o
// cadastro no Supabase (a fonte da verdade). Gated pelo toggle sync_contacts.
async function syncContact(ctx, client) {
  if (!ctx.settings?.sync_contacts || !client) return;
  try {
    const rid = await upsertContact(client);
    if (rid && rid !== client.google_contact_id) {
      await supabase.from('clients').update({ google_contact_id: rid }).eq('id', client.id);
      client.google_contact_id = rid;                      // mantém em memória coerente
    }
  } catch (e) {
    if (e instanceof NeedsScope) return;                   // escopo não concedido: silencioso
    console.warn('[contatos] não sincronizou', e);
  }
}

// Remove o contato-espelho ao excluir a cliente (best-effort, não bloqueia).
function removeContact(ctx, client) {
  if (!ctx.settings?.sync_contacts || !client?.google_contact_id) return;
  deleteContact(client.google_contact_id).catch((e) => console.warn('[contatos] não removeu', e));
}

export async function render(root, ctx) {
  const state = { all: [], q: '', sort: 'name', selected: new Set(), selMode: false };
  let drawer = null;

  // ação primária no header
  const btn = document.createElement('button');
  btn.className = 'btn btn--primary';
  btn.textContent = '+ Nova Cliente';
  btn.onclick = () => openForm(ctx, null, load);
  ctx.actions.appendChild(btn);

  root.innerHTML = `
    <div class="module__toolbar">
      <input class="input search-input" id="cli-q" placeholder="Buscar por nome, telefone ou e-mail…" />
      <div class="spacer"></div>
      <select class="select" id="cli-sort" style="max-width:220px">
        <option value="name">Nome (A–Z)</option>
        <option value="created">Cadastro (recente)</option>
        <option value="last">Último procedimento</option>
      </select>
      <button class="btn btn--secondary btn--sm" id="cli-selmode">Selecionar</button>
    </div>
    <div class="table-wrap">
      <div id="cli-bulk"></div>
      <table class="data">
        <thead><tr>
          <th class="chk" hidden></th>
          <th>Nome</th><th>Telefone</th><th>E-mail</th><th>Cidade</th>
          <th class="nowrap">Último proc.</th><th class="num">Total</th>
          <th class="num actions"></th>
        </tr></thead>
        <tbody id="cli-rows"></tbody>
      </table>
    </div>`;

  const tbody = root.querySelector('#cli-rows');
  const bulkEl = root.querySelector('#cli-bulk');
  const thChk = root.querySelector('thead .chk');
  const thActions = root.querySelector('thead .actions');
  const selModeBtn = root.querySelector('#cli-selmode');

  root.querySelector('#cli-q').addEventListener('input',
    debounce((e) => { state.q = e.target.value.trim().toLowerCase(); paint(); }));
  root.querySelector('#cli-sort').onchange = (e) => { state.sort = e.target.value; paint(); };

  selModeBtn.onclick = () => {
    state.selMode = !state.selMode;
    state.selected.clear();
    paint();
  };

  tbody.onclick = (e) => {
    if (e.target.closest('a.wa-link')) return;  // link do WhatsApp não abre o perfil
    const editBtn = e.target.closest('[data-edit-row]');
    if (editBtn) { openForm(ctx, state.all.find((c) => c.id === editBtn.dataset.editRow), load); return; }
    const delBtn = e.target.closest('[data-del-row]');
    if (delBtn) { deleteClients([delBtn.dataset.delRow]); return; }
    if (e.target.closest('.chk')) return;       // checkbox de seleção idem
    const tr = e.target.closest('[data-id]'); if (!tr) return;
    if (state.selMode) {
      const id = tr.dataset.id;
      state.selected.has(id) ? state.selected.delete(id) : state.selected.add(id);
      paint();
      return;
    }
    openProfile(tr.dataset.id);
  };

  // Rodada 7: seleção em massa (delegada — sobrevive aos repaints do tbody)
  tbody.addEventListener('change', (e) => {
    const cb = e.target.closest('[data-sel]'); if (!cb) return;
    cb.checked ? state.selected.add(cb.dataset.sel) : state.selected.delete(cb.dataset.sel);
    paint();
  });

  // exclusão (individual ou em massa) — reusada pelo lápis+lixeira da linha, o
  // perfil e o "Excluir (N)" do modo seleção. Sempre com confirmação.
  const deleteClients = guard(async (ids) => {
    const single = ids.length === 1 ? state.all.find((c) => c.id === ids[0]) : null;
    const ok = await confirmDialog({
      title: ids.length > 1 ? 'Excluir clientes' : 'Excluir cliente',
      message: ids.length > 1
        ? `Excluir ${ids.length} clientes? Os procedimentos e lançamentos delas permanecem no histórico, sem cliente vinculado — para removê-los também, use a seleção em Histórico e Fluxo de Caixa. Essa ação não tem desfazer.`
        : `Excluir ${single?.name || 'esta cliente'}? Os procedimentos e lançamentos dela permanecem no histórico, sem cliente vinculado. Essa ação não tem desfazer.`,
      confirmLabel: 'Excluir', danger: true,
    });
    if (!ok) return;
    const { error } = await supabase.from('clients').delete().in('id', ids);
    if (error) { console.error(error); return toast('Erro ao excluir.', 'error'); }
    ids.forEach((id) => removeContact(ctx, state.all.find((c) => c.id === id)));
    ids.forEach((id) => state.selected.delete(id));
    if (drawer && single) drawer.close();
    state.selMode = false;
    toast(ids.length > 1 ? `${ids.length} clientes excluídas.` : 'Cliente excluída.');
    load();
  });

  // ----------------------------------------------------------------- dados ---
  async function load() {
    tbody.innerHTML = skeletonRows(7);
    // "último" e "total" agregam procedures por cliente numa só query (embed).
    // ponytail: agrega no cliente; vira view/RPC se uma profissional acumular
    // milhares de procedimentos.
    const { data, error } = await supabase.from('clients').select('*, procedures(date)');
    if (error) { console.error(error); tbody.innerHTML = ''; toast('Erro ao carregar clientes.', 'error'); return; }
    state.all = (data || []).map((c) => ({
      ...c,
      _total: c.procedures?.length || 0,
      _last: lastDate(c.procedures),
    }));
    paint();
  }

  function filteredRows() {
    let rows = state.all;
    if (state.q) rows = rows.filter((c) =>
      `${c.name} ${c.phone || ''} ${c.email || ''}`.toLowerCase().includes(state.q));
    return [...rows].sort(SORTERS[state.sort]);
  }

  function paint() {
    const rows = filteredRows();
    thChk.hidden = !state.selMode;
    thActions.hidden = state.selMode;
    selModeBtn.hidden = state.selMode;
    bulkEl.innerHTML = state.selMode ? selectModeBar(state.selected.size, 'Excluir') : '';
    if (state.selMode) {
      bulkEl.querySelector('[data-sel-all]').onclick = () => {
        const allSel = rows.length > 0 && rows.every((c) => state.selected.has(c.id));
        rows.forEach((c) => allSel ? state.selected.delete(c.id) : state.selected.add(c.id));
        paint();
      };
      bulkEl.querySelector('[data-sel-cancel]').onclick = () => {
        state.selMode = false; state.selected.clear(); paint();
      };
      if (state.selected.size) bulkEl.querySelector('[data-sel-action]').onclick =
        () => deleteClients([...state.selected]);
    }
    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="8">${emptyBox(icon('users'),
        `Nenhuma cliente ${state.q ? 'encontrada' : 'cadastrada ainda'}.`)}</td></tr>`;
      return;
    }
    tbody.innerHTML = rows.map(row).join('');
  }

  function row(c) {
    return `
      <tr class="${state.selMode ? '' : 'clickable'}" data-id="${c.id}">
        <td class="chk" ${state.selMode ? '' : 'hidden'}><input type="checkbox" data-sel="${c.id}" ${state.selected.has(c.id) ? 'checked' : ''} aria-label="Selecionar"></td>
        <td>${esc(c.name)}${c.active === false ? ' <span class="badge badge--muted">inativa</span>' : ''}</td>
        <td class="nowrap" data-th="Telefone">${c.phone ? `<a class="wa-link" href="${waLink(c.phone)}" target="_blank" rel="noopener" title="WhatsApp">${icon('whatsapp')}${esc(c.phone)}</a>` : '—'}</td>
        <td data-th="E-mail">${esc(c.email || '—')}</td>
        <td data-th="Cidade">${esc(c.address_city || '—')}</td>
        <td class="nowrap" data-th="Último proc.">${c._last ? fmtDate(c._last) : '—'}</td>
        <td class="num" data-th="Total">${c._total}</td>
        <td class="num actions" ${state.selMode ? 'hidden' : ''}>
          <button class="btn btn--icon btn--ghost btn--sm" data-edit-row="${c.id}" title="Editar" aria-label="Editar">${icon('edit')}</button>
          <button class="btn btn--icon btn--ghost btn--sm" data-del-row="${c.id}" title="Excluir" aria-label="Excluir">${icon('trash')}</button>
        </td>
      </tr>`;
  }

  // ---------------------------------------------------------------- perfil ---
  function openProfile(id) {
    const c = state.all.find((x) => x.id === id);
    if (!c) return;
    if (drawer) drawer.close();

    const addr = [
      [[c.address_street, c.address_number].filter(Boolean).join(', '), c.address_complement].filter(Boolean).join(' — '),
      [c.address_city, c.address_state].filter(Boolean).join('/'),
      c.address_zip,
    ].filter(Boolean).join(' — ') || '—';

    // item 2.2: bloco fixo no topo (identificação/dados/botões/abas) + só as
    // tabelas rolam dentro de .drawer__body — o cabeçalho nunca sai da tela.
    const body = h(`
      <div class="drawer__wrap">
        <div class="drawer__head">
          <div class="flex" style="justify-content:space-between; align-items:flex-start">
            <div class="flex">
              <div class="avatar avatar--lg">${esc(initials(c.name))}</div>
              <div>
                <div style="font-size:18px">${esc(c.name)}${c.active === false ? ' <span class="badge badge--muted">inativa</span>' : ''}</div>
                <div class="faint">${esc(c.phone || '')}</div>
              </div>
            </div>
            <button class="btn btn--icon btn--ghost" data-close aria-label="Fechar">×</button>
          </div>

          <div class="mt-4" style="display:flex; flex-direction:column; gap:6px; font-size:14px">
            <div><span class="muted">E-mail:</span> ${esc(c.email || '—')}</div>
            <div><span class="muted">CPF:</span> ${esc(c.cpf || '—')}</div>
            <div><span class="muted">Nascimento:</span> ${c.birthdate ? fmtDate(c.birthdate) : '—'}</div>
            <div><span class="muted">Endereço:</span> ${esc(addr)}</div>
            ${c.notes ? `<div><span class="muted">Obs.:</span> ${esc(c.notes)}</div>` : ''}
          </div>

          <div class="flex mt-4">
            <button class="btn btn--primary btn--sm" data-agendar>Agendar</button>
            <button class="btn btn--secondary btn--sm" data-proc>Novo procedimento</button>
            <button class="btn btn--ghost btn--sm" data-edit>Editar</button>
            <button class="btn btn--danger btn--sm" data-del>Excluir</button>
          </div>

          <div class="segmented mt-4" data-tabs>
            <button class="active" data-tab="proc">Procedimentos</button>
            <button data-tab="fin">Financeiro</button>
          </div>
        </div>
        <div class="drawer__body">
          <div id="pane-proc"><table class="data"><tbody>${skeletonRows(4, 3)}</tbody></table></div>
          <div id="pane-fin" hidden><table class="data"><tbody>${skeletonRows(4, 3)}</tbody></table></div>
        </div>
      </div>`);

    drawer = openDrawer(body, { center: true });

    body.querySelector('[data-close]').onclick = () => drawer.close();
    body.querySelector('[data-edit]').onclick = () =>
      openForm(ctx, c, async () => { await load(); openProfile(id); });
    body.querySelector('[data-del]').onclick = () => deleteClients([c.id]);
    body.querySelector('[data-agendar]').onclick = () => {
      sessionStorage.setItem('intent:agendar', id); ctx.navigate('agenda');
    };
    body.querySelector('[data-proc]').onclick = () => {
      sessionStorage.setItem('intent:procedimento', id); ctx.navigate('historico');
    };
    body.querySelector('[data-tabs]').onclick = (e) => {
      const t = e.target.closest('[data-tab]'); if (!t) return;
      body.querySelectorAll('[data-tabs] button').forEach((x) => x.classList.toggle('active', x === t));
      body.querySelector('#pane-proc').hidden = t.dataset.tab !== 'proc';
      body.querySelector('#pane-fin').hidden = t.dataset.tab !== 'fin';
    };

    // as duas abas carregam em paralelo (lista pequena por cliente)
    loadProcedures(id, body.querySelector('#pane-proc'));
    loadFinancial(id, body.querySelector('#pane-fin'));
  }

  await load();
  if (sessionStorage.getItem('intent:novoCliente')) {
    sessionStorage.removeItem('intent:novoCliente');
    openForm(ctx, null, load);
  }
}

// ------------------------------------------------------------------ helpers --
const SORTERS = {
  name:    (a, b) => (a.name || '').localeCompare(b.name || '', 'pt'),
  created: (a, b) => (b.created_at || '').localeCompare(a.created_at || ''),
  last:    (a, b) => (b._last || '').localeCompare(a._last || ''),
};

// datas são "YYYY-MM-DD": ordem lexicográfica == cronológica, então o maior é o último.
const lastDate = (procs) =>
  procs && procs.length ? procs.map((p) => p.date).filter(Boolean).sort().at(-1) || null : null;

async function loadProcedures(clientId, pane) {
  const { data, error } = await supabase.from('procedures')
    .select('date, price_charged, services(name), procedure_materials(quantity_used, unit_cost_at_time)')
    .eq('client_id', clientId).order('date', { ascending: false });
  if (error) { console.error(error); pane.innerHTML = errBox('Erro ao carregar procedimentos.'); return; }
  if (!data.length) { pane.innerHTML = emptyBox('', 'Nenhum procedimento ainda.'); return; }
  pane.innerHTML = `
    <table class="data">
      <thead><tr><th>Data</th><th>Serviço</th><th class="num">Valor</th><th class="num">Lucro</th></tr></thead>
      <tbody>${data.map((p) => {
        const cost = (p.procedure_materials || []).reduce(
          (s, m) => s + Number(m.quantity_used || 0) * Number(m.unit_cost_at_time || 0), 0);
        const hasPrice = p.price_charged != null;
        return `<tr>
          <td class="nowrap" data-th="Data">${fmtDate(p.date)}</td>
          <td data-th="Serviço">${esc(p.services?.name || '—')}</td>
          <td class="num" data-th="Valor">${hasPrice ? money(p.price_charged) : '—'}</td>
          <td class="num" data-th="Lucro">${hasPrice ? money(Number(p.price_charged) - cost) : '—'}</td>
        </tr>`;
      }).join('')}</tbody>
    </table>`;
}

async function loadFinancial(clientId, pane) {
  const { data, error } = await supabase.from('financial_entries')
    .select('due_date, amount, type, paid, description')
    .eq('client_id', clientId).order('due_date', { ascending: false });
  if (error) { console.error(error); pane.innerHTML = errBox('Erro ao carregar financeiro.'); return; }
  if (!data.length) { pane.innerHTML = emptyBox('', 'Nenhum lançamento ainda.'); return; }
  pane.innerHTML = `
    <table class="data">
      <thead><tr><th>Venc.</th><th>Descrição</th><th class="num">Valor</th><th>Status</th></tr></thead>
      <tbody>${data.map((f) => `<tr>
        <td class="nowrap" data-th="Venc.">${fmtDate(f.due_date)}</td>
        <td data-th="Descrição">${esc(f.description || '—')}</td>
        <td class="num ${f.type === 'expense' ? 'neg' : 'pos'}" data-th="Valor">${f.type === 'expense' ? '−' : ''}${money(f.amount)}</td>
        <td data-th="Status">${f.paid ? '<span class="badge badge--success">pago</span>' : '<span class="badge badge--warning">pendente</span>'}</td>
      </tr>`).join('')}</tbody>
    </table>`;
}

const errBox = (msg) => `<div class="empty"><p class="neg">${esc(msg)}</p></div>`;

// --------------------------------------------------------------- formulário --
// Exportado: Agenda e Histórico abrem o cadastro daqui (autocomplete sem match
// → "＋ Cadastrar"). preset.name pré-preenche o nome; onSaved recebe a linha
// criada/atualizada para o chamador já selecionar a cliente nova.
export function openForm(ctx, c, onSaved, preset = {}) {
  const editing = !!c;
  const form = document.createElement('form');
  form.id = 'cli-form';
  form.innerHTML = `
    <div class="field">
      <label>Nome <span class="req">*</span></label>
      <input class="input" name="name" required value="${esc(c?.name || preset.name || '')}" />
    </div>
    <div class="field-row">
      <div class="field"><label>Telefone</label>
        <input class="input" name="phone" inputmode="tel" value="${esc(c?.phone || '')}" /></div>
      <div class="field"><label>E-mail</label>
        <input class="input" name="email" type="email" value="${esc(c?.email || '')}" /></div>
    </div>
    <div class="field-row">
      <div class="field"><label>Nascimento</label>
        <input class="input" name="birthdate" type="date" value="${c?.birthdate || ''}" /></div>
      <div class="field"><label>CPF</label>
        <input class="input" name="cpf" inputmode="numeric" value="${esc(c?.cpf || '')}" /></div>
    </div>
    <div class="field-row">
      <div class="field" style="flex:3"><label>Rua</label>
        <input class="input" name="address_street" value="${esc(c?.address_street || '')}" /></div>
      <div class="field" style="flex:1"><label>Número</label>
        <input class="input" name="address_number" value="${esc(c?.address_number || '')}" /></div>
      <div class="field" style="flex:2"><label>Complemento</label>
        <input class="input" name="address_complement" placeholder="apto, bloco, ref." value="${esc(c?.address_complement || '')}" /></div>
    </div>
    <div class="field-row">
      <div class="field" style="flex:2"><label>Cidade</label>
        <input class="input" name="address_city" value="${esc(c?.address_city || '')}" /></div>
      <div class="field" style="flex:1"><label>Estado</label>
        <input class="input" name="address_state" maxlength="2" value="${esc(c?.address_state || '')}" /></div>
      <div class="field" style="flex:1"><label>CEP</label>
        <input class="input" name="address_zip" value="${esc(c?.address_zip || '')}" /></div>
    </div>
    <div class="field">
      <label>Observações</label>
      <textarea class="textarea" name="notes">${esc(c?.notes || '')}</textarea>
    </div>
    <div class="field">
      <label class="flex" style="cursor:pointer">
        <span class="switch"><input type="checkbox" name="active" ${c?.active !== false ? 'checked' : ''}><span class="track"></span></span>
        Cliente ativa
      </label>
    </div>`;

  bindMask(form.querySelector('[name="phone"]'), maskPhone);
  bindMask(form.querySelector('[name="cpf"]'), maskCPF);

  const foot = document.createElement('div');
  foot.innerHTML = `<button class="btn btn--ghost" type="button" data-x>Cancelar</button>
                    <button class="btn btn--primary" type="submit" form="cli-form">${editing ? 'Salvar' : 'Criar'}</button>`;

  const m = openModal({ title: editing ? 'Editar cliente' : 'Nova cliente', body: form, footer: foot, wide: true });
  foot.querySelector('[data-x]').onclick = () => m.close();

  form.onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const val = (k) => (fd.get(k) || '').toString().trim() || null;
    const name = (fd.get('name') || '').toString().trim();
    if (!name) return toast('Informe o nome.', 'warning');
    const payload = {
      user_id: ctx.session.user.id,
      name,
      phone: val('phone'),
      email: val('email'),
      birthdate: val('birthdate'),       // '' -> null (coluna date)
      cpf: val('cpf'),
      address_street: val('address_street'),
      address_number: val('address_number'),
      address_complement: val('address_complement'),
      address_city: val('address_city'),
      address_state: val('address_state'),
      address_zip: val('address_zip'),
      notes: val('notes'),
      active: fd.get('active') === 'on',
    };
    const submit = foot.querySelector('[type="submit"]');
    busy(submit, true);
    const res = editing
      ? await supabase.from('clients').update(payload).eq('id', c.id).select().single()
      : await supabase.from('clients').insert(payload).select().single();
    busy(submit, false);
    if (res.error) { console.error(res.error); return toast('Erro ao salvar.', 'error'); }
    toast(editing ? 'Cliente atualizada.' : 'Cliente criada.');
    m.markClean(); m.close(true);
    await syncContact(ctx, res.data);
    onSaved(res.data);
  };
}

// cadastro rápido (popup compacto): chamado pelo "＋ Cadastrar" do autocomplete
// de cliente (Agenda/Histórico) quando a busca não acha ninguém. Só nome/
// telefone/e-mail — o resto (CPF, endereço etc.) fica em branco pra completar
// depois em Clientes. Reaproveita a mesma máscara de telefone do form completo.
export function quickCreate(ctx, name, onSaved) {
  const form = document.createElement('form');
  form.id = 'cli-quick-form';
  form.innerHTML = `
    <div class="field">
      <label>Nome <span class="req">*</span></label>
      <input class="input" name="name" required value="${esc(name || '')}" />
    </div>
    <div class="field-row">
      <div class="field"><label>Telefone</label>
        <input class="input" name="phone" inputmode="tel" /></div>
      <div class="field"><label>E-mail</label>
        <input class="input" name="email" type="email" /></div>
    </div>`;
  bindMask(form.querySelector('[name="phone"]'), maskPhone);

  const foot = document.createElement('div');
  foot.innerHTML = `<button class="btn btn--ghost" type="button" data-x>Cancelar</button>
                    <button class="btn btn--primary" type="submit" form="cli-quick-form">Criar</button>`;

  const m = openModal({ title: 'Nova cliente', body: form, footer: foot });
  foot.querySelector('[data-x]').onclick = () => m.close();

  form.onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const val = (k) => (fd.get(k) || '').toString().trim() || null;
    const nameVal = (fd.get('name') || '').toString().trim();
    if (!nameVal) return toast('Informe o nome.', 'warning');
    const submit = foot.querySelector('[type="submit"]');
    busy(submit, true);
    const res = await supabase.from('clients')
      .insert({ user_id: ctx.session.user.id, name: nameVal, phone: val('phone'), email: val('email') })
      .select().single();
    busy(submit, false);
    if (res.error) { console.error(res.error); return toast('Erro ao salvar.', 'error'); }
    toast('Cliente criada.');
    m.markClean(); m.close(true);
    await syncContact(ctx, res.data);
    onSaved(res.data);
  };
}

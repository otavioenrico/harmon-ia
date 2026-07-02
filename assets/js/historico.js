// ============================================================================
// historico.js — registro e histórico de procedimentos. O registro chama a RPC
// atômica register_procedure (procedimento + materiais + débito de estoque +
// lançamentos financeiros). Lê e limpa intent:procedimento deixado por Clientes.
// Duas views: Procedimentos (lista + filtros) e Reativação (clientes parados).
// Segue o padrão de servicos.js / clientes.js. RLS isola por usuário.
// ============================================================================
import { supabase } from './supabase.js';
import { money, fmtDate, todayISO, daysSince, openModal, toast, busy, esc,
  debounce, waLink, icon, clientAutocomplete, emptyBox, guard } from './utils.js';

const STATUS_BADGE = {
  scheduled: '<span class="badge badge--warning">agendado</span>',
  completed: '<span class="badge badge--success">realizado</span>',
  cancelled: '<span class="badge badge--muted">cancelado</span>',
};

// métodos à vista entram já pagos; crédito/parcelado entram pendentes (decisão fechada)
const PAID_METHODS = new Set(['pix', 'dinheiro', 'cartao_debito']);
const METHODS = [
  ['pix', 'Pix'], ['dinheiro', 'Dinheiro'], ['cartao_debito', 'Cartão de débito'],
  ['cartao_credito', 'Cartão de crédito'], ['parcelado', 'Parcelado'],
];

export async function render(root, ctx) {
  const state = { all: [], clients: [], services: [], stock: [], dismissals: new Map(),
    view: 'proc', qCliente: '', fServico: '', fStatus: '', fDe: '', fAte: '',
    reDays: 60, retMonths: 1 };

  const btn = document.createElement('button');
  btn.className = 'btn btn--primary';
  btn.textContent = '+ Novo procedimento';
  btn.onclick = () => openForm(ctx, state, null, load);
  ctx.actions.appendChild(btn);

  root.innerHTML = `
    <div class="module__toolbar">
      <div class="segmented" id="h-view">
        <button data-v="proc" class="active">Procedimentos</button>
        <button data-v="reat">Reativação</button>
        <button data-v="ret">Retornos</button>
      </div>
      <div class="spacer"></div>
      <div id="h-filters" class="filters"></div>
    </div>
    <div class="table-wrap" id="h-table"></div>`;

  const tableWrap = root.querySelector('#h-table');
  const filters = root.querySelector('#h-filters');

  root.querySelector('#h-view').onclick = (e) => {
    const b = e.target.closest('[data-v]'); if (!b) return;
    state.view = b.dataset.v;
    root.querySelectorAll('#h-view button').forEach((x) => x.classList.toggle('active', x === b));
    paintFilters(); paint();
  };

  function paintFilters() {
    if (state.view === 'reat') {
      filters.innerHTML = `<label class="muted" style="font-size:13px">Sem retorno há
        <input class="input" id="re-days" type="number" min="1" value="${state.reDays}"
          style="width:70px; display:inline-block"> dias</label>`;
      filters.querySelector('#re-days').addEventListener('input',
        debounce((e) => { state.reDays = Number(e.target.value) || 0; paint(); }));
      return;
    }
    if (state.view === 'ret') {
      const MS = [[1, '1 mês'], [3, '3 meses'], [6, '6 meses'], [12, '12 meses']];
      filters.innerHTML = `<div class="segmented" id="ret-ms">
        ${MS.map(([v, l]) => `<button data-m="${v}" class="${v === state.retMonths ? 'active' : ''}">${l}</button>`).join('')}</div>`;
      filters.querySelector('#ret-ms').onclick = (e) => {
        const b = e.target.closest('[data-m]'); if (!b) return;
        state.retMonths = Number(b.dataset.m);
        filters.querySelectorAll('#ret-ms button').forEach((x) => x.classList.toggle('active', x === b));
        paint();
      };
      return;
    }
    const opts = (arr, sel) => arr.map((x) =>
      `<option value="${x.id}" ${x.id === sel ? 'selected' : ''}>${esc(x.name)}</option>`).join('');
    filters.innerHTML = `
      <input class="input search-input" id="f-cli-q" placeholder="Buscar por cliente, serviço…" value="${esc(state.qCliente)}">
      <select class="select" id="f-svc"><option value="">Todo serviço</option>${opts(state.services, state.fServico)}</select>
      <select class="select" id="f-st">
        <option value="">Todo status</option><option value="scheduled">Agendados</option>
        <option value="completed">Realizados</option><option value="cancelled">Cancelados</option></select>
      <input class="input" id="f-de" type="date" value="${state.fDe}" title="De">
      <input class="input" id="f-ate" type="date" value="${state.fAte}" title="Até">`;
    filters.querySelector('#f-cli-q').addEventListener('input',
      debounce((e) => { state.qCliente = e.target.value.trim().toLowerCase(); paint(); }));
    filters.querySelector('#f-svc').onchange = (e) => { state.fServico = e.target.value; paint(); };
    filters.querySelector('#f-st').value = state.fStatus;
    filters.querySelector('#f-st').onchange = (e) => { state.fStatus = e.target.value; paint(); };
    filters.querySelector('#f-de').onchange = (e) => { state.fDe = e.target.value; paint(); };
    filters.querySelector('#f-ate').onchange = (e) => { state.fAte = e.target.value; paint(); };
  }

  // ----------------------------------------------------------------- dados ---
  async function load() {
    tableWrap.innerHTML = `<table class="data"><tbody>${
      `<tr><td><div class="skeleton"></div></td></tr>`.repeat(5)}</tbody></table>`;
    // ponytail: busca tudo e filtra em memória (igual clientes); vira RPC/view se
    // uma profissional acumular milhares de procedimentos.
    const [proc, cli, svc, stk, dis] = await Promise.all([
      supabase.from('procedures')
        .select('id, date, price_charged, status, client_id, service_id, clients(name, phone), services(name), procedure_materials(quantity_used, unit_cost_at_time)')
        .order('date', { ascending: false }),
      supabase.from('clients').select('id, name, phone, active').eq('active', true).order('name'),
      supabase.from('services').select('id, name, default_price, active').eq('active', true).order('name'),
      supabase.from('stock_items').select('id, name, quantity, unit, cost_price').eq('active', true).order('name'),
      supabase.from('return_dismissals').select('client_id, service_id, months, dismissed_at'),
    ]);
    if (proc.error || cli.error || svc.error || stk.error) {
      console.error(proc.error || cli.error || svc.error || stk.error);
      tableWrap.innerHTML = emptyBox(icon('warning'), 'Erro ao carregar histórico.'); toast('Erro ao carregar histórico.', 'error'); return;
    }
    state.all = (proc.data || []).map((p) => ({
      ...p,
      _cost: (p.procedure_materials || []).reduce(
        (s, m) => s + Number(m.quantity_used || 0) * Number(m.unit_cost_at_time || 0), 0),
    }));
    state.clients = cli.data || [];
    state.services = svc.data || [];
    state.stock = stk.data || [];
    // item 3.3: dismissal por marco (1/3/6/12 meses) — chave inclui months
    state.dismissals = new Map((dis.data || []).map((d) => [`${d.client_id}|${d.service_id}|${d.months}`, d.dismissed_at]));
    paintFilters(); paint();
  }

  function paint() {
    if (state.view === 'reat') return paintReat();
    if (state.view === 'ret') return paintRetornos();
    let rows = state.all;
    // busca ampla: cliente, serviço, status e valor (mesmo espírito do #f-q do Fluxo de Caixa)
    const STATUS_TXT = { scheduled: 'agendado', completed: 'realizado', cancelled: 'cancelado' };
    if (state.qCliente) rows = rows.filter((p) =>
      [p.clients?.name, p.services?.name, STATUS_TXT[p.status] || 'realizado',
        p.price_charged != null ? money(p.price_charged) : '', String(p.price_charged ?? '')]
        .join(' ').toLowerCase().includes(state.qCliente));
    if (state.fServico) rows = rows.filter((p) => p.service_id === state.fServico);
    if (state.fStatus) rows = rows.filter((p) => (p.status || 'completed') === state.fStatus);
    if (state.fDe) rows = rows.filter((p) => p.date >= state.fDe);   // 'YYYY-MM-DD' lexicográfico
    if (state.fAte) rows = rows.filter((p) => p.date <= state.fAte);
    if (!rows.length) {
      tableWrap.innerHTML = emptyBox(icon('clipboard'), 'Nenhum procedimento registrado.'); return;
    }
    // item 9: agendados e realizados listados juntos, com coluna de status.
    tableWrap.innerHTML = table(
      ['Data', 'Cliente', 'Serviço', 'Status', 'Valor', 'Lucro'],
      rows.map((p) => {
        const has = p.price_charged != null;
        const lucro = has ? Number(p.price_charged) - p._cost : null;
        return `<tr>
          <td class="nowrap">${fmtDate(p.date)}</td>
          <td>${esc(p.clients?.name || '—')}</td>
          <td>${esc(p.services?.name || '—')}</td>
          <td>${STATUS_BADGE[p.status] || STATUS_BADGE.completed}</td>
          <td class="num">${has ? money(p.price_charged) : '—'}</td>
          <td class="num ${lucro < 0 ? 'neg' : ''}">${has ? money(lucro) : '—'}</td>
        </tr>`;
      }).join(''), 4);
  }

  // último procedimento REALIZADO por cliente (agendamento futuro não conta)
  function lastCompletedByClient() {
    const last = new Map();
    for (const p of state.all) {
      if (p.status !== 'completed' || !p.client_id || !p.date) continue;
      if (!last.has(p.client_id) || p.date > last.get(p.client_id)) last.set(p.client_id, p.date);
    }
    return last;
  }

  function paintReat() {
    const last = lastCompletedByClient();
    const rows = state.clients
      .map((c) => ({ ...c, _last: last.get(c.id) || null, _days: daysSince(last.get(c.id)) }))
      .filter((c) => c._last && c._days >= state.reDays)
      .sort((a, b) => b._days - a._days);
    if (!rows.length) {
      tableWrap.innerHTML = emptyBox(icon('users'), `Nenhuma cliente sem retorno há ${state.reDays}+ dias.`); return;
    }
    const msg = (n) => `Oi ${n.split(' ')[0]}! Faz um tempinho que você não aparece por aqui. Que tal agendarmos seu próximo cuidado? 💛`;
    tableWrap.innerHTML = table(
      ['Cliente', 'Último proc.', 'Dias', ''],
      rows.map((c) => `<tr>
        <td>${esc(c.name)}</td>
        <td class="nowrap">${fmtDate(c._last)}</td>
        <td class="num">${c._days}</td>
        <td class="num">${c.phone
          ? `<a class="btn btn--secondary btn--sm" target="_blank" rel="noopener"
               href="${waLink(c.phone, msg(c.name))}">WhatsApp</a>`
          : '<span class="faint">sem telefone</span>'}</td>
      </tr>`).join(''));
  }

  // último procedimento REALIZADO por combinação cliente+serviço (item 7: cada
  // serviço parado vira sua própria linha — uma cliente com 2 procedimentos
  // diferentes em datas diferentes aparece 2x, uma por serviço).
  function lastCompletedByClientService() {
    const last = new Map();
    for (const p of state.all) {
      if (p.status !== 'completed' || !p.client_id || !p.service_id || !p.date) continue;
      const key = `${p.client_id}|${p.service_id}`;
      const cur = last.get(key);
      if (!cur || p.date > cur.date) last.set(key, { client_id: p.client_id, service_id: p.service_id, date: p.date });
    }
    return last;
  }

  // item 9/7: lembretes de retorno em 1/3/6/12 meses, por cliente+serviço.
  // "Concluir" grava um dismissal (return_dismissals) — some da lista até um
  // novo procedimento do mesmo serviço acontecer e a cliente ficar parada de novo.
  function paintRetornos() {
    const threshold = state.retMonths * 30;   // ponytail: mês ≈ 30 dias, suficiente p/ lembrete
    const rows = [...lastCompletedByClientService().values()]
      .map((r) => ({ ...r,
        name: state.clients.find((c) => c.id === r.client_id)?.name,
        phone: state.clients.find((c) => c.id === r.client_id)?.phone,
        service: state.services.find((s) => s.id === r.service_id)?.name,
        _days: daysSince(r.date) }))
      .filter((r) => r.name && r._days >= threshold)
      .filter((r) => (state.dismissals.get(`${r.client_id}|${r.service_id}|${state.retMonths}`) || '').slice(0, 10) < r.date)
      .sort((a, b) => b._days - a._days);
    if (!rows.length) {
      tableWrap.innerHTML = emptyBox(icon('bell'), `Nenhuma cliente para retorno de ${state.retMonths} ${state.retMonths === 1 ? 'mês' : 'meses'}.`); return;
    }
    const msg = (n) => `Oi ${n.split(' ')[0]}! Já faz um tempinho do seu último procedimento — que tal agendar seu retorno? 💛`;
    tableWrap.innerHTML = table(
      ['Cliente', 'Procedimento', 'Último proc.', 'Dias', ''],
      rows.map((r) => `<tr data-cli="${r.client_id}" data-svc="${r.service_id}">
        <td>${esc(r.name)}</td>
        <td>${esc(r.service || '—')}</td>
        <td class="nowrap">${fmtDate(r.date)}</td>
        <td class="num">${r._days}</td>
        <td class="num nowrap">
          ${r.phone
            ? `<a class="btn btn--secondary btn--sm" target="_blank" rel="noopener"
                 href="${waLink(r.phone, msg(r.name))}">WhatsApp</a>`
            : '<span class="faint">sem telefone</span>'}
          <button class="btn btn--ghost btn--sm" data-concluir>Concluir</button>
        </td>
      </tr>`).join(''));
    tableWrap.querySelectorAll('[data-concluir]').forEach((b) => b.onclick = guard(async () => {
      const tr = b.closest('tr');
      const client_id = tr.dataset.cli, service_id = tr.dataset.svc;
      // dismissed_at explícito: no conflito (re-contato após novo procedimento) a
      // data precisa ser atualizada, senão o filtro por data reexibiria a linha
      const { error } = await supabase.from('return_dismissals')
        .upsert({ user_id: ctx.session.user.id, client_id, service_id, months: state.retMonths, dismissed_at: new Date().toISOString() },
          { onConflict: 'user_id,client_id,service_id,months' });
      if (error) { console.error(error); return toast('Erro ao marcar como contatado.', 'error'); }
      state.dismissals.set(`${client_id}|${service_id}|${state.retMonths}`, new Date().toISOString());
      toast('Marcado como contatado.');
      paintRetornos();
    }));
  }

  // intent deixado por Clientes: abre o registro já com a cliente selecionada
  const intent = sessionStorage.getItem('intent:procedimento');
  if (intent) sessionStorage.removeItem('intent:procedimento');

  await load();
  if (intent) openForm(ctx, state, intent, load);
}

const table = (cols, bodyHTML, numFrom = 3) => `
  <table class="data">
    <thead><tr>${cols.map((c, i) =>
      `<th${i >= numFrom ? ' class="num"' : ''}>${esc(c)}</th>`).join('')}</tr></thead>
    <tbody>${bodyHTML}</tbody>
  </table>`;

// --------------------------------------------------------------- formulário --
function openForm(ctx, state, clientId, onSaved) {
  const opt = (arr, sel, ph) => `<option value="">${ph}</option>` + arr.map((x) =>
    `<option value="${x.id}" ${x.id === sel ? 'selected' : ''}>${esc(x.name)}</option>`).join('');

  const form = document.createElement('form');
  form.id = 'proc-form';
  form.innerHTML = `
    <div class="field-row">
      <div class="field"><label>Cliente <span class="req">*</span></label>
        <div data-client-slot></div></div>
      <div class="field"><label>Data <span class="req">*</span></label>
        <input class="input" name="date" type="date" required value="${todayISO()}" /></div>
    </div>
    <div class="field-row">
      <div class="field"><label>Serviço <span class="req">*</span></label>
        <select class="select" name="service_id" required>${opt(state.services, '', '— selecione —')}</select></div>
      <div class="field"><label>Valor cobrado (R$)</label>
        <input class="input" name="price" type="number" step="0.01" min="0" /></div>
    </div>

    <div class="field">
      <label>Materiais usados <span class="faint">(baixa do estoque)</span></label>
      <div id="mat-rows"></div>
      <button class="btn btn--ghost btn--sm" type="button" id="mat-add">+ adicionar material</button>
    </div>

    <div class="field-row">
      <div class="field"><label>Pagamento</label>
        <select class="select" name="method">${METHODS.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></div>
      <div class="field" id="inst-wrap" hidden><label>Parcelas</label>
        <input class="input" name="installments" type="number" min="2" value="2" /></div>
      <div class="field" id="due-wrap" hidden><label>1º vencimento</label>
        <input class="input" name="first_due" type="date" value="${todayISO()}" /></div>
    </div>

    <div class="field">
      <label>Observações</label>
      <textarea class="textarea" name="notes"></textarea>
    </div>`;

  // item 15: seleção de cliente por busca (componente compartilhado)
  const clientPicker = clientAutocomplete(state.clients, clientId);
  form.querySelector('[data-client-slot]').appendChild(clientPicker.el);

  // serviço → sugere o preço padrão
  const priceEl = form.querySelector('[name="price"]');
  form.querySelector('[name="service_id"]').onchange = (e) => {
    const s = state.services.find((x) => x.id === e.target.value);
    if (s && s.default_price != null && !priceEl.value) priceEl.value = s.default_price;
  };

  // materiais: linhas dinâmicas (item + quantidade)
  const matRows = form.querySelector('#mat-rows');
  const matOpts = state.stock.map((s) =>
    `<option value="${s.id}">${esc(s.name)} — ${Number(s.quantity)}${s.unit ? ' ' + esc(s.unit) : ''}</option>`).join('');
  const addMat = () => {
    const r = document.createElement('div');
    r.className = 'field-row mat-row';
    r.style.alignItems = 'flex-end';
    r.innerHTML = `
      <div class="field" style="flex:3; margin:0"><select class="select mat-item"><option value="">— material —</option>${matOpts}</select></div>
      <div class="field" style="flex:1; margin:0"><input class="input mat-qty" type="number" step="0.001" min="0" placeholder="qtd" /></div>
      <button class="btn btn--icon btn--ghost" type="button" title="Remover">×</button>`;
    r.querySelector('button').onclick = () => r.remove();
    matRows.appendChild(r);
  };
  form.querySelector('#mat-add').onclick = addMat;

  // pagamento: parcelado mostra parcelas; crédito/parcelado mostram vencimento
  const methodEl = form.querySelector('[name="method"]');
  const instWrap = form.querySelector('#inst-wrap');
  const dueWrap = form.querySelector('#due-wrap');
  methodEl.onchange = () => {
    const m = methodEl.value;
    instWrap.hidden = m !== 'parcelado';
    dueWrap.hidden = PAID_METHODS.has(m);   // à vista não precisa de vencimento
  };

  const foot = document.createElement('div');
  foot.innerHTML = `<button class="btn btn--ghost" type="button" data-x>Cancelar</button>
                    <button class="btn btn--primary" type="submit" form="proc-form">Registrar</button>`;
  const m = openModal({ title: 'Registrar procedimento', body: form, footer: foot, wide: true });
  foot.querySelector('[data-x]').onclick = () => m.close();

  form.onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const clientSel = clientPicker.value();
    if (!clientSel) return toast('Selecione a cliente.', 'warning');
    if (!fd.get('service_id')) return toast('Selecione o serviço.', 'warning');

    // coleta e valida materiais
    const materials = [];
    for (const r of matRows.querySelectorAll('.mat-row')) {
      const id = r.querySelector('.mat-item').value;
      const qty = Number(r.querySelector('.mat-qty').value);
      if (!id || !(qty > 0)) continue;
      const item = state.stock.find((s) => s.id === id);
      if (item && qty > Number(item.quantity))
        return toast(`Estoque insuficiente de "${item.name}" (${Number(item.quantity)} disponível).`, 'warning');
      materials.push({ stock_item_id: id, quantity_used: qty });
    }

    const method = fd.get('method');
    const parcelado = method === 'parcelado';
    const installments = parcelado ? Math.max(2, Number(fd.get('installments')) || 2) : 1;
    const price = fd.get('price') ? Number(fd.get('price')) : null;

    const args = {
      p_client_id: clientSel,
      p_service_id: fd.get('service_id'),
      p_date: fd.get('date'),
      p_price_charged: price,
      p_notes: (fd.get('notes') || '').toString().trim() || null,
      p_google_event_id: null,
      p_materials: materials.length ? materials : null,
      p_payment_method: method,
      p_installments: installments,
      p_paid: PAID_METHODS.has(method),                       // só vale quando installments=1
      p_first_due_date: PAID_METHODS.has(method) ? null : (fd.get('first_due') || null),
    };

    const submit = foot.querySelector('[type="submit"]');
    busy(submit, true, 'Registrando…');
    const { error } = await supabase.rpc('register_procedure', args);
    busy(submit, false);
    if (error) { console.error(error); return toast('Erro ao registrar procedimento.', 'error'); }
    toast('Procedimento registrado.');
    m.markClean(); m.close(true);
    onSaved();   // badge de estoque reatualiza quando o módulo Estoque recarregar
  };
}

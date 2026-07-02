// ============================================================================
// agenda.js — Agenda apoiada no Google Calendar (fonte da verdade do calendário)
// + procedures no Supabase (valor/custo/materiais/status). Agendar cria o evento
// no Google E chama schedule_procedure (status 'scheduled', reserva materiais,
// lançamento pendente — SEM debitar estoque). Ao abrir a tela, agendamentos com
// data passada são concluídos (complete_procedure: debita estoque + confirma
// pagamento à vista). Cancelar exclui o evento e chama cancel_procedure.
// Views Lista/Mês/Dia + busca. Rascunhos em agenda_drafts (não viram evento).
// Lê intent:agendar deixado por Clientes. RLS isola por usuário.
// ============================================================================
import { supabase } from './supabase.js';
import { listEvents, createEvent, updateEvent, deleteEvent, NeedsReconnect } from './google-cal.js';
import { signInWithGoogle } from './auth.js';
import { openModal, confirmDialog, guard, toast, busy, esc, todayISO, icon, waLink, money, clientAutocomplete, emptyBox } from './utils.js';

const WD = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MO = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const evStart = (e) => new Date(e.start?.dateTime || `${e.start?.date}T00:00:00`);
const hhmm = (d) => d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
const sameDay = (a, b) => a.toDateString() === b.toDateString();
const isoDay = (d) => d.toLocaleDateString('en-CA');

const PAID_METHODS = new Set(['pix', 'dinheiro', 'cartao_debito']);
const METHODS = [
  ['pix', 'Pix'], ['dinheiro', 'Dinheiro'], ['cartao_debito', 'Cartão de débito'],
  ['cartao_credito', 'Cartão de crédito'], ['parcelado', 'Parcelado'],
];

export async function render(root, ctx) {
  const state = { view: 'list', cursor: new Date(), events: [], clients: [], services: [], stock: [], procByEvent: new Map(), q: '' };

  const draftsBtn = document.createElement('button');
  draftsBtn.className = 'btn btn--secondary';
  draftsBtn.textContent = 'Rascunhos';
  draftsBtn.onclick = () => openDrafts();

  const newBtn = document.createElement('button');
  newBtn.className = 'btn btn--primary';
  newBtn.textContent = '+ Novo agendamento';
  newBtn.onclick = () => openForm();
  ctx.actions.append(draftsBtn, newBtn);

  root.innerHTML = `
    <div class="module__toolbar">
      <div class="segmented" id="ag-view">
        <button data-v="list" class="active">Lista</button>
        <button data-v="day">Dia</button>
        <button data-v="month">Mês</button>
      </div>
      <input class="input search-input" id="ag-q" placeholder="Buscar por título…" />
      <div class="ag-nav">
        <button class="btn btn--icon btn--ghost" data-nav="-1">${icon('left')}</button>
        <strong id="ag-label" style="min-width:160px;text-align:center"></strong>
        <button class="btn btn--icon btn--ghost" data-nav="1">${icon('right')}</button>
        <button class="btn btn--ghost" data-nav="0">Hoje</button>
      </div>
    </div>
    <div id="ag-body"></div>`;

  const body = root.querySelector('#ag-body');
  root.querySelector('#ag-view').onclick = (e) => {
    const b = e.target.closest('[data-v]'); if (!b) return;
    state.view = b.dataset.v;
    root.querySelectorAll('#ag-view button').forEach((x) => x.classList.toggle('active', x === b));
    load();
  };
  root.querySelector('#ag-q').addEventListener('input', (e) => { state.q = e.target.value.trim().toLowerCase(); paintView(); });
  root.querySelector('.ag-nav').onclick = (e) => {
    const b = e.target.closest('[data-nav]'); if (!b) return;
    const n = Number(b.dataset.nav);
    if (n === 0) state.cursor = new Date();
    else if (state.view === 'month') state.cursor.setMonth(state.cursor.getMonth() + n);
    else if (state.view === 'day') state.cursor.setDate(state.cursor.getDate() + n);
    else state.cursor.setDate(state.cursor.getDate() + n * 7);
    load(n === 0);
  };

  // catálogos para o formulário — carregam uma vez
  const [{ data: cs }, { data: sv }, { data: st }] = await Promise.all([
    supabase.from('clients').select('id,name,phone').eq('active', true).order('name'),
    supabase.from('services').select('id,name,duration_min,default_price').eq('active', true).order('name'),
    supabase.from('stock_items').select('id,name,quantity,unit,cost_price').eq('active', true).order('name'),
  ]);
  state.clients = cs || []; state.services = sv || []; state.stock = st || [];

  // "automático" = ao abrir a tela: conclui agendamentos cuja data já passou.
  await autoCompletePast();

  // ------------------------------------------------------------------- load ---
  function rangeOf() {
    if (state.view === 'month') return monthRange(state.cursor);
    if (state.view === 'day') return dayRange(state.cursor);
    return weekRange(state.cursor);
  }

  // item 6: a Lista nunca fica vazia sem motivo — se a semana atual (carga
  // inicial ou botão "Hoje") não tem nada, avança semana a semana até achar
  // algo, até um teto (não se aplica a "próxima/anterior" manual: navegar de
  // propósito pra uma semana vazia deve mostrar a semana vazia, não pular).
  const AGENDA_AUTO_LOOKAHEAD_WEEKS = 8;

  async function load(autoAdvance = false) {
    // skeleton na forma de linhas de evento (hora + resumo), não um bloco cego
    body.innerHTML = `<div class="card">${`<div class="ag-row">
      <div class="skeleton" style="width:48px"></div>
      <div class="skeleton" style="flex:1;max-width:60%"></div>
    </div>`.repeat(5)}</div>`;

    for (let hop = 0; ; hop++) {
      const [min, max] = rangeOf();
      root.querySelector('#ag-label').textContent =
        state.view === 'month' ? `${MO[state.cursor.getMonth()]} ${state.cursor.getFullYear()}`
        : state.view === 'day' ? state.cursor.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })
        : `${min.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} – ${new Date(max - 1).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}`;
      try {
        const [evs, procs] = await Promise.all([
          listEvents(min, max),
          supabase.from('procedures')
            .select('id, google_event_id, status, price_charged, client_id, service_id, procedure_materials(stock_item_id, quantity_used, unit_cost_at_time)')
            .not('google_event_id', 'is', null)
            .gte('date', isoDay(min)).lt('date', isoDay(max)),
        ]);
        state.events = evs;
        state.procByEvent = new Map((procs.data || []).map((p) => [p.google_event_id, p]));
      } catch (err) {
        if (err instanceof NeedsReconnect) return reconnect();
        console.error(err); body.innerHTML = `<div class="empty"><div class="icon">${icon('warning')}</div><p>${esc(err.message)}</p></div>`;
        return;
      }
      // state.events (atribuído no try acima) — `evs` é const do bloco try e não existe aqui
      if (autoAdvance && state.view === 'list' && !state.events.length && hop < AGENDA_AUTO_LOOKAHEAD_WEEKS) {
        state.cursor.setDate(state.cursor.getDate() + 7);
        continue;
      }
      break;
    }
    paintView();
  }

  async function autoCompletePast() {
    // ponytail: loop sequencial de RPC; volume baixo (clínica solo). Vira lote se crescer.
    const { data } = await supabase.from('procedures').select('id').eq('status', 'scheduled').lt('date', todayISO());
    for (const p of data || []) await supabase.rpc('complete_procedure', { p_procedure_id: p.id });
  }

  function reconnect() {
    body.innerHTML = emptyBox(icon('plug'), 'Reconecte sua conta Google para liberar a Agenda.',
      `<button class="btn btn--primary mt-4" id="ag-reconnect">Conectar Google</button>`);
    body.querySelector('#ag-reconnect').onclick = () => {
      sessionStorage.setItem('google:reconnecting', '1'); // app.js confirma com toast na volta
      signInWithGoogle().catch((e) => { sessionStorage.removeItem('google:reconnecting'); toast(e.message, 'error'); });
    };
  }

  // eventos após a busca textual (item 3: busca por título do Google)
  const visibleEvents = () => !state.q ? state.events
    : state.events.filter((e) => (e.summary || '').toLowerCase().includes(state.q));

  function paintView() {
    if (state.view === 'month') return renderMonth();
    if (state.view === 'day') return renderDay();
    renderList();
  }

  // ------------------------------------------------------------- view: lista -
  function renderList() {
    const evs = visibleEvents();
    if (!evs.length) {
      body.innerHTML = emptyBox(icon('calendar'), `Nenhum agendamento ${state.q ? 'encontrado' : 'neste período'}.`);
      return;
    }
    const byDay = new Map();
    for (const e of evs) { const k = evStart(e).toDateString(); (byDay.get(k) || byDay.set(k, []).get(k)).push(e); }
    body.innerHTML = [...byDay.entries()].map(([k, list]) => {
      const d = new Date(k);
      return `<div class="card mb-3">
        <h3 style="margin:0 0 8px">${WD[d.getDay()]}, ${d.getDate()} ${MO[d.getMonth()].slice(0, 3)}</h3>
        ${list.map(rowHTML).join('')}
      </div>`;
    }).join('');
    wireEventClicks();
  }

  // --------------------------------------------------------------- view: dia -
  function renderDay() {
    const evs = visibleEvents()
      .filter((e) => sameDay(evStart(e), state.cursor))
      .sort((a, b) => evStart(a) - evStart(b));
    if (!evs.length) {
      body.innerHTML = emptyBox(icon('calendar'), 'Nenhum agendamento neste dia.',
        `<button class="btn btn--secondary mt-4" id="ag-day-new">Agendar neste dia</button>`);
      body.querySelector('#ag-day-new').onclick = () => openForm(isoDay(state.cursor));
      return;
    }
    body.innerHTML = `<div class="card">${evs.map(rowHTML).join('')}</div>`;
    wireEventClicks();
  }

  function rowHTML(e) {
    const proc = state.procByEvent.get(e.id);
    const val = proc && proc.price_charged != null ? ` · ${money(proc.price_charged)}` : '';
    return `<div class="ag-row" data-ev="${esc(e.id)}">
      <span class="ag-time">${e.start?.dateTime ? hhmm(evStart(e)) : 'dia todo'}</span>
      <span class="ag-summary">${esc(e.summary || '(sem título)')}<span class="faint">${val}</span></span>
      <button class="btn btn--icon btn--ghost" data-del="${esc(e.id)}" title="Cancelar">${icon('trash')}</button>
    </div>`;
  }

  // --------------------------------------------------------------- view: mês -
  function renderMonth() {
    const first = new Date(state.cursor.getFullYear(), state.cursor.getMonth(), 1);
    const start = new Date(first); start.setDate(1 - first.getDay());
    const today = new Date();
    const byDay = new Map();
    for (const e of visibleEvents()) { const k = evStart(e).toDateString(); (byDay.get(k) || byDay.set(k, []).get(k)).push(e); }
    let cells = '';
    for (let i = 0; i < 42; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i);
      const evs = (byDay.get(d.toDateString()) || []).sort((a, b) => evStart(a) - evStart(b));
      const muted = d.getMonth() !== state.cursor.getMonth();
      cells += `<div class="ag-cell${muted ? ' is-muted' : ''}${sameDay(d, today) ? ' is-today' : ''}" data-day="${isoDay(d)}">
        <span class="ag-cell__n">${d.getDate()}</span>
        ${evs.slice(0, 3).map((e) => `<span class="ag-chip" data-ev="${esc(e.id)}">${e.start?.dateTime ? hhmm(evStart(e)) + ' ' : ''}${esc(e.summary || '·')}</span>`).join('')}
        ${evs.length > 3 ? `<span class="ag-more">+${evs.length - 3}</span>` : ''}
      </div>`;
    }
    body.innerHTML = `<div class="ag-scroll"><div class="ag-grid">${WD.map((w) => `<div class="ag-head">${w}</div>`).join('')}${cells}</div></div>`;
    body.querySelectorAll('.ag-cell').forEach((c) => c.addEventListener('click', (e) => {
      if (e.target.closest('[data-ev]')) return;
      openForm(c.dataset.day);
    }));
    wireEventClicks();
  }

  function wireEventClicks() {
    body.querySelectorAll('[data-del]').forEach((b) => b.onclick = (e) => { e.stopPropagation(); cancelEvent(b.dataset.del); });
    body.querySelectorAll('[data-ev]').forEach((el) => el.onclick = (e) => {
      if (e.target.closest('[data-del]')) return;
      e.stopPropagation();
      const ev = state.events.find((x) => x.id === el.dataset.ev);
      if (ev) openDetail(ev);
    });
  }

  // ----------------------------------------------------------- cancelar ------
  const cancelEvent = guard(async (evId) => {
    const ok = await confirmDialog({
      title: 'Cancelar agendamento',
      message: 'O evento sai do Google Calendar e o procedimento é marcado como cancelado.',
      confirmLabel: 'Cancelar agendamento', cancelLabel: 'Voltar', danger: true,
    });
    if (!ok) return;
    const proc = state.procByEvent.get(evId);
    try {
      await deleteEvent(evId);
      if (proc) await supabase.rpc('cancel_procedure', { p_procedure_id: proc.id });
      toast('Agendamento cancelado.');
      load();
    } catch (err) { toast(err.message, 'error'); }
  });

  const completeProc = guard(async (procId) => {
    const { error } = await supabase.rpc('complete_procedure', { p_procedure_id: procId });
    if (error) { console.error(error); return toast('Erro ao concluir.', 'error'); }
    toast('Procedimento concluído — estoque e caixa atualizados.');
    load();
  });

  // ------------------------------------------------------------- detalhe -----
  function openDetail(ev) {
    const start = evStart(ev);
    const proc = state.procByEvent.get(ev.id);
    const client = proc ? state.clients.find((c) => c.id === proc.client_id) : null;
    let extra = '';
    if (proc) {
      const cost = (proc.procedure_materials || []).reduce((s, m) => s + Number(m.quantity_used || 0) * Number(m.unit_cost_at_time || 0), 0);
      const has = proc.price_charged != null;
      extra = `<div class="mt-4" style="display:flex;flex-direction:column;gap:4px">
        <div><span class="muted">Status:</span> ${esc(proc.status)}</div>
        ${has ? `<div><span class="muted">Faturamento:</span> ${money(proc.price_charged)}</div>
                 <div><span class="muted">Custo materiais:</span> ${money(cost)}</div>
                 <div><span class="muted">Lucro:</span> <strong>${money(Number(proc.price_charged) - cost)}</strong></div>` : ''}</div>`;
    }
    const bodyEl = document.createElement('div');
    bodyEl.innerHTML = `
      <p><strong>${esc(ev.summary || '(sem título)')}</strong></p>
      <p class="muted">${start.toLocaleString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' })}</p>
      ${ev.description ? `<p style="white-space:pre-wrap">${esc(ev.description)}</p>` : ''}
      ${extra}`;

    const canComplete = proc && proc.status === 'scheduled';
    const foot = document.createElement('div');
    foot.innerHTML = `
      <button class="btn btn--danger" data-del-d>Cancelar agend.</button>
      ${client?.phone ? `<a class="btn btn--secondary" target="_blank" rel="noopener"
        href="${waLink(client.phone, `Olá ${esc(client.name.split(' ')[0])}! Confirmando seu horário em ${start.toLocaleDateString('pt-BR')} às ${hhmm(start)}. 💛`)}">${icon('whatsapp')} WhatsApp</a>` : ''}
      ${canComplete ? `<button class="btn btn--secondary" data-done>${icon('check')} Concluir</button>` : ''}
      <button class="btn btn--secondary" data-edit>Editar</button>
      <button class="btn btn--ghost" data-x>Fechar</button>`;
    const m = openModal({ title: 'Agendamento', body: bodyEl, footer: foot });
    foot.querySelector('[data-x]').onclick = () => m.close();
    foot.querySelector('[data-edit]').onclick = () => { m.close(); openForm(null, ev); };
    foot.querySelector('[data-del-d]').onclick = async () => { m.close(); await cancelEvent(ev.id); };
    const done = foot.querySelector('[data-done]');
    if (done) done.onclick = async () => { m.close(); await completeProc(proc.id); };
  }

  // --------------------------------------------------------------- form ------
  // openForm(presetDay)                 -> criar (autocomplete + materiais + valor)
  // openForm(null, editEvent)           -> editar (completo se ainda 'scheduled', senão só título/hora/notas)
  // openForm(null, null, draft)         -> criar a partir de rascunho
  async function openForm(presetDay, editEvent, draft) {
    const isEdit = !!editEvent;
    const p = draft?.payload || {};
    const prefClient = isEdit ? null : (p.client_id || sessionStorage.getItem('intent:agendar'));
    if (!isEdit && !draft && sessionStorage.getItem('intent:agendar')) sessionStorage.removeItem('intent:agendar');

    const pad = (n) => String(n).padStart(2, '0');
    let day = presetDay || p.date || todayISO();
    let timeVal = p.time || '09:00', durVal = p.dur || 60, notesVal = p.notes || '', titleVal = '';
    let editProc = null;
    if (isEdit) {
      const s = evStart(editEvent);
      day = `${s.getFullYear()}-${pad(s.getMonth() + 1)}-${pad(s.getDate())}`;
      if (editEvent.start?.dateTime) timeVal = `${pad(s.getHours())}:${pad(s.getMinutes())}`;
      if (editEvent.end?.dateTime) durVal = Math.max(5, Math.round((new Date(editEvent.end.dateTime) - s) / 60000));
      notesVal = editEvent.description || '';
      titleVal = editEvent.summary || '';
      editProc = state.procByEvent.get(editEvent.id) || null;
    }

    // edição completa (cliente/serviço/materiais/pagamento) só é segura enquanto
    // 'scheduled' — nada foi debitado/pago ainda (ver update_scheduled_procedure).
    // completed/cancelled continuam com a edição restrita (título/hora/notas/valor).
    const fullEdit = isEdit && editProc && editProc.status === 'scheduled';
    let editMaterials = [];
    let editPayment = { method: null, installments: 1 };
    if (fullEdit) {
      editMaterials = (editProc.procedure_materials || [])
        .map((m) => ({ stock_item_id: m.stock_item_id, quantity_used: m.quantity_used }));
      const { data: feRow } = await supabase.from('financial_entries')
        .select('payment_method, installments').eq('procedure_id', editProc.id).limit(1).maybeSingle();
      if (feRow) editPayment = { method: feRow.payment_method, installments: feRow.installments || 1 };
    }
    const showClientService = !isEdit || fullEdit;

    const form = document.createElement('form'); form.id = 'ag-form';
    const pickers = `
      ${isEdit ? `<div class="field"><label>Título <span class="req">*</span></label>
        <input class="input" name="title" required value="${esc(titleVal)}"></div>` : ''}
      ${isEdit && !fullEdit && editProc && editProc.price_charged != null
        ? `<div class="field"><label>Valor cobrado (R$)</label>
             <input class="input" name="price" type="number" step="0.01" min="0" value="${editProc.price_charged}"></div>` : ''}
      ${showClientService ? `
      <div class="field"><label>Cliente</label><div data-client-slot></div></div>
      <div class="field"><label>Serviço</label>
        <select class="select" name="service">
          <option value="">— selecionar —</option>
          ${state.services.map((s) => `<option value="${s.id}" data-dur="${s.duration_min || ''}" data-price="${s.default_price ?? ''}" ${s.id === (fullEdit ? editProc.service_id : p.service_id) ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}
        </select>
      </div>` : ''}`;

    form.innerHTML = `
      ${pickers}
      <div class="field-row">
        <div class="field"><label>Data <span class="req">*</span></label>
          <input class="input" type="date" name="date" required value="${day}"></div>
        <div class="field"><label>Hora <span class="req">*</span></label>
          <input class="input" type="time" name="time" required value="${timeVal}"></div>
        <div class="field"><label>Duração (min)</label>
          <input class="input" type="number" min="5" step="5" name="dur" value="${durVal}"></div>
      </div>
      ${showClientService ? `
      <div class="field"><label>Valor cobrado (R$)</label>
        <input class="input" name="price" type="number" step="0.01" min="0" value="${fullEdit ? (editProc.price_charged ?? '') : (p.price ?? '')}"></div>

      <div class="field">
        <label>Materiais reservados <span class="faint">(baixa do estoque só na conclusão)</span></label>
        <div id="mat-rows"></div>
        <button class="btn btn--ghost btn--sm" type="button" id="mat-add">+ adicionar material</button>
      </div>
      <p class="hint" id="ag-lucro"></p>

      <div class="field-row">
        <div class="field"><label>Pagamento</label>
          <select class="select" name="method">${METHODS.map(([v, l]) => `<option value="${v}" ${v === (fullEdit ? editPayment.method : p.method) ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        <div class="field" id="inst-wrap" hidden><label>Parcelas</label>
          <input class="input" name="installments" type="number" min="2" value="${fullEdit ? (editPayment.installments || 2) : (p.installments || 2)}"></div>
      </div>` : ''}
      <div class="field"><label>Observações</label>
        <textarea class="textarea" name="notes">${esc(notesVal)}</textarea></div>`;

    // autocomplete de cliente + materiais dinâmicos (criar ou edição completa)
    let clientPicker = null;
    if (showClientService) {
      clientPicker = clientAutocomplete(state.clients, fullEdit ? (editProc.client_id || '') : (prefClient || ''));
      form.querySelector('[data-client-slot]').appendChild(clientPicker.el);

      // serviço → herda duração e sugere preço
      const priceEl = form.querySelector('[name="price"]');
      form.service.onchange = () => {
        const o = form.service.selectedOptions[0];
        if (o?.dataset.dur) form.dur.value = o.dataset.dur;
        if (o?.dataset.price && !priceEl.value) priceEl.value = o.dataset.price;
      };

      // materiais dinâmicos + prévia de lucro
      const matRows = form.querySelector('#mat-rows');
      const lucroEl = form.querySelector('#ag-lucro');
      const matOpts = state.stock.map((s) =>
        `<option value="${s.id}" data-cost="${s.cost_price ?? 0}">${esc(s.name)} — ${Number(s.quantity)}${s.unit ? ' ' + esc(s.unit) : ''}</option>`).join('');
      const recalc = () => {
        let cost = 0;
        matRows.querySelectorAll('.mat-row').forEach((r) => {
          const opt = r.querySelector('.mat-item').selectedOptions[0];
          cost += Number(opt?.dataset.cost || 0) * Number(r.querySelector('.mat-qty').value || 0);
        });
        const price = Number(priceEl.value || 0);
        lucroEl.textContent = (price || cost)
          ? `Faturamento ${money(price)} − Custo ${money(cost)} = Lucro ${money(price - cost)}` : '';
      };
      const addMat = (m = {}) => {
        const r = document.createElement('div');
        r.className = 'field-row mat-row'; r.style.alignItems = 'flex-end';
        r.innerHTML = `
          <div class="field" style="flex:3;margin:0"><select class="select mat-item"><option value="">— material —</option>${matOpts}</select></div>
          <div class="field" style="flex:1;margin:0"><input class="input mat-qty" type="number" step="0.001" min="0" placeholder="qtd" value="${m.quantity_used ?? ''}"></div>
          <button class="btn btn--icon btn--ghost" type="button" title="Remover">${icon('x')}</button>`;
        if (m.stock_item_id) r.querySelector('.mat-item').value = m.stock_item_id;
        r.querySelector('button').onclick = () => { r.remove(); recalc(); };
        r.querySelector('.mat-item').onchange = recalc;
        r.querySelector('.mat-qty').oninput = recalc;
        matRows.appendChild(r);
      };
      form.querySelector('#mat-add').onclick = () => addMat();
      (fullEdit ? editMaterials : (p.materials || [])).forEach(addMat);
      priceEl.oninput = recalc;
      recalc();

      // parcelas só quando "parcelado"
      const methodEl = form.querySelector('[name="method"]');
      const instWrap = form.querySelector('#inst-wrap');
      methodEl.onchange = () => { instWrap.hidden = methodEl.value !== 'parcelado'; };
      methodEl.onchange();
    }

    const foot = document.createElement('div');
    foot.innerHTML = `<button class="btn btn--ghost" type="button" data-x>Cancelar</button>
      ${isEdit ? '' : '<button class="btn btn--secondary" type="button" data-draft>Salvar rascunho</button>'}
      <button class="btn btn--primary" type="submit" form="ag-form">${isEdit ? 'Salvar' : 'Agendar'}</button>`;
    const m = openModal({ title: isEdit ? 'Editar agendamento' : 'Novo agendamento', body: form, footer: foot, wide: showClientService });
    foot.querySelector('[data-x]').onclick = () => m.close();

    // coleta os campos do form (usada por agendar e por salvar rascunho)
    const collect = () => {
      const materials = [];
      form.querySelectorAll('.mat-row').forEach((r) => {
        const id = r.querySelector('.mat-item').value;
        const qty = Number(r.querySelector('.mat-qty').value);
        if (id && qty > 0) materials.push({ stock_item_id: id, quantity_used: qty });
      });
      return {
        client_id: clientPicker?.value() || null,
        service_id: form.service?.value || null,
        date: form.date.value, time: form.time.value, dur: Number(form.dur.value) || 60,
        price: form.price?.value ? Number(form.price.value) : null,
        method: form.method?.value || null,
        installments: form.method?.value === 'parcelado' ? Math.max(2, Number(form.installments.value) || 2) : 1,
        notes: form.notes.value.trim(), materials,
      };
    };

    // salvar rascunho (item 17) — não cria evento no Google nem procedimento
    if (!isEdit) foot.querySelector('[data-draft]').onclick = async (e) => {
      busy(e.target, true);
      const payload = collect();
      const row = { user_id: ctx.session.user.id, payload };
      const res = draft?.id
        ? await supabase.from('agenda_drafts').update({ payload }).eq('id', draft.id)
        : await supabase.from('agenda_drafts').insert(row);
      busy(e.target, false);
      if (res.error) { console.error(res.error); return toast('Erro ao salvar rascunho.', 'error'); }
      toast('Rascunho salvo.'); m.close();
    };

    form.onsubmit = async (e) => {
      e.preventDefault();
      const submit = foot.querySelector('[type="submit"]');
      const start = new Date(`${form.date.value}T${form.time.value}`);
      if (isNaN(start)) return toast('Data ou hora inválida.', 'warning');
      const end = new Date(start.getTime() + (Number(form.dur.value) || 60) * 60000);

      busy(submit, true, isEdit ? 'Salvando…' : 'Agendando…');
      try {
        if (isEdit && !fullEdit) {
          await updateEvent(editEvent.id, { summary: form.title.value.trim() || '(sem título)', description: form.notes.value.trim(), start, end });
          if (editProc && form.price) {
            await supabase.from('procedures').update({ price_charged: form.price.value ? Number(form.price.value) : null, date: form.date.value }).eq('id', editProc.id);
          }
          toast('Agendamento atualizado.');
        } else if (fullEdit) {
          await updateEvent(editEvent.id, { summary: form.title.value.trim() || '(sem título)', description: form.notes.value.trim(), start, end });
          const d = collect();
          const { error } = await supabase.rpc('update_scheduled_procedure', {
            p_procedure_id: editProc.id,
            p_client_id: d.client_id, p_service_id: d.service_id, p_date: d.date,
            p_price_charged: d.price, p_notes: d.notes || null,
            p_materials: d.materials.length ? d.materials : null,
            p_payment_method: d.method, p_installments: d.installments,
          });
          if (error) { console.error(error); toast('Erro ao salvar as alterações.', 'error'); return; }
          toast('Agendamento atualizado.');
        } else {
          const d = collect();
          const client = state.clients.find((c) => c.id === d.client_id);
          const service = state.services.find((s) => s.id === d.service_id);
          const summary = [service?.name, client?.name].filter(Boolean).join(' — ') || 'Agendamento';
          const ev = await createEvent({ summary, description: d.notes || undefined, start, end });
          const { error } = await supabase.rpc('schedule_procedure', {
            p_client_id: d.client_id, p_service_id: d.service_id, p_date: d.date,
            p_price_charged: d.price, p_notes: d.notes || null, p_google_event_id: ev.id,
            p_materials: d.materials.length ? d.materials : null,
            p_payment_method: d.method, p_installments: d.installments,
          });
          if (error) {
            // rollback: sem a linha em procedures o evento seria um órfão no
            // Google (apareceria no calendário mas não no app) — desfaz.
            console.error(error);
            await deleteEvent(ev.id).catch((e) => console.error('rollback falhou', e));
            toast('Não foi possível agendar — nada foi criado. Tente de novo.', 'error');
            return;
          }
          toast('Agendamento criado.');
          if (draft?.id) await supabase.from('agenda_drafts').delete().eq('id', draft.id);
        }
        m.close();
        state.cursor = start; load();
      } catch (err) {
        if (err instanceof NeedsReconnect) { m.close(); return reconnect(); }
        toast(err.message, 'error');
      } finally { busy(submit, false); }
    };
  }

  // ------------------------------------------------------------- rascunhos ---
  async function openDrafts() {
    // item 17: expira rascunhos com +7 dias na leitura (sem cron no projeto)
    const cutoff = new Date(Date.now() - 7 * 86400000).toISOString();
    await supabase.from('agenda_drafts').delete().lt('created_at', cutoff);
    const { data } = await supabase.from('agenda_drafts').select('*').order('created_at', { ascending: false });
    const drafts = data || [];
    const nameOf = (d) => {
      const c = state.clients.find((x) => x.id === d.payload?.client_id);
      const s = state.services.find((x) => x.id === d.payload?.service_id);
      return [s?.name, c?.name].filter(Boolean).join(' — ') || 'Rascunho';
    };
    const bodyEl = document.createElement('div');
    bodyEl.innerHTML = drafts.length
      ? drafts.map((d) => `<div class="panel__row" data-id="${d.id}">
          <span class="grow">${esc(nameOf(d))}<div class="sub">${esc(d.payload?.date || '')} ${esc(d.payload?.time || '')}</div></span>
          <button class="btn btn--secondary btn--sm" data-open="${d.id}">Abrir</button>
          <button class="btn btn--icon btn--ghost" data-rm="${d.id}" title="Excluir">${icon('trash')}</button>
        </div>`).join('')
      : emptyBox(icon('clipboard'), 'Nenhum rascunho.');
    const foot = document.createElement('div');
    foot.innerHTML = `<button class="btn btn--primary" type="button" data-x>Fechar</button>`;
    const m = openModal({ title: 'Rascunhos de agendamento', body: bodyEl, footer: foot });
    foot.querySelector('[data-x]').onclick = () => m.close();
    bodyEl.querySelectorAll('[data-open]').forEach((b) => b.onclick = () => {
      const d = drafts.find((x) => x.id === b.dataset.open); m.close(); openForm(null, null, d);
    });
    bodyEl.querySelectorAll('[data-rm]').forEach((b) => b.onclick = guard(async () => {
      const ok = await confirmDialog({
        title: 'Excluir rascunho', message: 'Este rascunho será apagado. Essa ação não tem desfazer.',
        confirmLabel: 'Excluir', danger: true,
      });
      if (!ok) return;
      const { error } = await supabase.from('agenda_drafts').delete().eq('id', b.dataset.rm);
      if (error) { console.error(error); return toast('Erro ao excluir o rascunho.', 'error'); }
      b.closest('[data-id]').remove(); toast('Rascunho excluído.');
    }));
  }

  // item 3.4: atalho "Ver agenda de hoje" do dashboard — abre direto na view Dia
  if (sessionStorage.getItem('intent:agendaHoje')) {
    sessionStorage.removeItem('intent:agendaHoje');
    state.view = 'day'; state.cursor = new Date();
    root.querySelectorAll('#ag-view button').forEach((x) => x.classList.toggle('active', x.dataset.v === 'day'));
  }

  await load(true);
  if (sessionStorage.getItem('intent:agendar')) openForm();
  else if (sessionStorage.getItem('intent:novoAgendamento')) { sessionStorage.removeItem('intent:novoAgendamento'); openForm(); }
}

// ---------------------------------------------------------------- ranges -----
function monthRange(cursor) {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const min = new Date(first); min.setDate(1 - first.getDay());
  const max = new Date(min); max.setDate(min.getDate() + 42);
  return [min, max];
}
function weekRange(cursor) {
  const min = new Date(cursor); min.setDate(cursor.getDate() - cursor.getDay()); min.setHours(0, 0, 0, 0);
  const max = new Date(min); max.setDate(min.getDate() + 7);
  return [min, max];
}
function dayRange(cursor) {
  const min = new Date(cursor); min.setHours(0, 0, 0, 0);
  const max = new Date(min); max.setDate(min.getDate() + 1);
  return [min, max];
}

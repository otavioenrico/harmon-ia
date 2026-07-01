// ============================================================================
// agenda.js — Agenda apoiada no Google Calendar (fonte da verdade da agenda).
// Views Lista + Mês. Criar agendamento => evento no Calendar (sem linha em
// procedures; isso nasce só no registro do procedimento, ver decisões).
// Lê intent:agendar deixado por Clientes para já abrir o modal com a cliente.
// ============================================================================
import { supabase } from './supabase.js';
import { listEvents, createEvent, updateEvent, deleteEvent, NeedsReconnect } from './google-cal.js';
import { signInWithGoogle } from './auth.js';
import { openModal, toast, busy, esc, todayISO } from './utils.js';

const WD = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MO = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const evStart = (e) => new Date(e.start?.dateTime || `${e.start?.date}T00:00:00`);
const hhmm = (d) => d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
const sameDay = (a, b) => a.toDateString() === b.toDateString();

export async function render(root, ctx) {
  const state = { view: 'list', cursor: new Date(), events: [], clients: [], services: [] };

  const newBtn = document.createElement('button');
  newBtn.className = 'btn btn--primary';
  newBtn.textContent = '+ Novo agendamento';
  newBtn.onclick = () => openForm();
  ctx.actions.appendChild(newBtn);

  root.innerHTML = `
    <div class="module__toolbar">
      <div class="segmented" id="ag-view">
        <button data-v="list" class="active">Lista</button>
        <button data-v="month">Mês</button>
      </div>
      <div class="ag-nav">
        <button class="btn btn--icon btn--ghost" data-nav="-1">‹</button>
        <strong id="ag-label" style="min-width:160px;text-align:center"></strong>
        <button class="btn btn--icon btn--ghost" data-nav="1">›</button>
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
  root.querySelector('.ag-nav').onclick = (e) => {
    const b = e.target.closest('[data-nav]'); if (!b) return;
    const n = Number(b.dataset.nav);
    if (n === 0) state.cursor = new Date();
    else if (state.view === 'month') state.cursor.setMonth(state.cursor.getMonth() + n);
    else state.cursor.setDate(state.cursor.getDate() + n * 7);
    load();
  };

  // catálogos para o formulário (cliente/serviço) — carregam uma vez
  const [{ data: cs }, { data: sv }] = await Promise.all([
    supabase.from('clients').select('id,name,phone').eq('active', true).order('name'),
    supabase.from('services').select('id,name,duration_min').eq('active', true).order('name'),
  ]);
  state.clients = cs || []; state.services = sv || [];

  async function load() {
    const [min, max] = state.view === 'month' ? monthRange(state.cursor) : weekRange(state.cursor);
    root.querySelector('#ag-label').textContent = state.view === 'month'
      ? `${MO[state.cursor.getMonth()]} ${state.cursor.getFullYear()}`
      : `${min.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} – ${new Date(max - 1).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}`;
    body.innerHTML = `<div class="card"><div class="skeleton" style="height:240px"></div></div>`;
    try {
      state.events = await listEvents(min, max);
    } catch (err) {
      if (err instanceof NeedsReconnect) return reconnect();
      console.error(err); body.innerHTML = `<div class="empty"><div class="icon">⚠️</div><p>${esc(err.message)}</p></div>`;
      return;
    }
    state.view === 'month' ? renderMonth() : renderList();
  }

  function reconnect() {
    body.innerHTML = `<div class="empty"><div class="icon">🔌</div>
      <p>Reconecte sua conta Google para liberar a Agenda.</p>
      <button class="btn btn--primary mt-4" id="ag-reconnect">Conectar Google</button></div>`;
    body.querySelector('#ag-reconnect').onclick = () => signInWithGoogle().catch((e) => toast(e.message, 'error'));
  }

  // ------------------------------------------------------------- view: lista -
  function renderList() {
    if (!state.events.length) {
      body.innerHTML = `<div class="empty"><div class="icon">📅</div><p>Nenhum agendamento nesta semana.</p></div>`;
      return;
    }
    const byDay = new Map();
    for (const e of state.events) {
      const d = evStart(e); const k = d.toDateString();
      (byDay.get(k) || byDay.set(k, []).get(k)).push(e);
    }
    body.innerHTML = [...byDay.entries()].map(([k, evs]) => {
      const d = new Date(k);
      return `<div class="card mb-3">
        <h3 style="margin:0 0 8px">${WD[d.getDay()]}, ${d.getDate()} ${MO[d.getMonth()].slice(0, 3)}</h3>
        ${evs.map((e) => `
          <div class="ag-row" data-ev="${esc(e.id)}">
            <span class="ag-time">${e.start?.dateTime ? hhmm(evStart(e)) : 'dia todo'}</span>
            <span class="ag-summary">${esc(e.summary || '(sem título)')}</span>
            <button class="btn btn--icon btn--ghost" data-del="${esc(e.id)}" title="Excluir">🗑</button>
          </div>`).join('')}
      </div>`;
    }).join('');
    wireEventClicks();
  }

  // --------------------------------------------------------------- view: mês -
  function renderMonth() {
    const first = new Date(state.cursor.getFullYear(), state.cursor.getMonth(), 1);
    const start = new Date(first); start.setDate(1 - first.getDay()); // volta ao domingo
    const today = new Date();
    const byDay = new Map();
    for (const e of state.events) {
      const k = evStart(e).toDateString();
      (byDay.get(k) || byDay.set(k, []).get(k)).push(e);
    }
    let cells = '';
    for (let i = 0; i < 42; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i);
      const evs = (byDay.get(d.toDateString()) || []).sort((a, b) => evStart(a) - evStart(b));
      const muted = d.getMonth() !== state.cursor.getMonth();
      cells += `<div class="ag-cell${muted ? ' is-muted' : ''}${sameDay(d, today) ? ' is-today' : ''}" data-day="${d.toISOString().slice(0, 10)}">
        <span class="ag-cell__n">${d.getDate()}</span>
        ${evs.slice(0, 3).map((e) => `<span class="ag-chip" data-ev="${esc(e.id)}">${e.start?.dateTime ? hhmm(evStart(e)) + ' ' : ''}${esc(e.summary || '·')}</span>`).join('')}
        ${evs.length > 3 ? `<span class="ag-more">+${evs.length - 3}</span>` : ''}
      </div>`;
    }
    body.innerHTML = `<div class="ag-grid">
      ${WD.map((w) => `<div class="ag-head">${w}</div>`).join('')}
      ${cells}</div>`;
    // clicar num dia vazio abre o form já naquela data
    body.querySelectorAll('.ag-cell').forEach((c) => c.addEventListener('click', (e) => {
      if (e.target.closest('[data-ev]')) return;
      openForm(c.dataset.day);
    }));
    wireEventClicks();
  }

  function wireEventClicks() {
    body.querySelectorAll('[data-del]').forEach((b) => b.onclick = (e) => { e.stopPropagation(); removeEvent(b.dataset.del); });
    body.querySelectorAll('[data-ev]').forEach((el) => el.onclick = (e) => {
      if (e.target.closest('[data-del]')) return;
      e.stopPropagation();
      const ev = state.events.find((x) => x.id === el.dataset.ev);
      if (ev) openDetail(ev);
    });
  }

  async function removeEvent(id) {
    if (!confirm('Excluir este agendamento do Google Calendar?')) return;
    try { await deleteEvent(id); toast('Agendamento excluído.'); load(); }
    catch (err) { toast(err.message, 'error'); }
  }

  function openDetail(ev) {
    const start = evStart(ev);
    const bodyEl = document.createElement('div');
    bodyEl.innerHTML = `
      <p><strong>${esc(ev.summary || '(sem título)')}</strong></p>
      <p class="muted">${start.toLocaleString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' })}</p>
      ${ev.description ? `<p style="white-space:pre-wrap">${esc(ev.description)}</p>` : ''}`;
    const foot = document.createElement('div');
    foot.innerHTML = `<button class="btn btn--ghost" data-del-d>Excluir</button>
                      ${ev.htmlLink ? `<a class="btn btn--ghost" href="${esc(ev.htmlLink)}" target="_blank" rel="noopener">Abrir no Google</a>` : ''}
                      <button class="btn btn--secondary" data-edit>Editar</button>
                      <button class="btn btn--primary" data-x>Fechar</button>`;
    const m = openModal({ title: 'Agendamento', body: bodyEl, footer: foot });
    foot.querySelector('[data-x]').onclick = () => m.close(true);
    foot.querySelector('[data-edit]').onclick = () => { m.close(true); openForm(null, ev); };
    foot.querySelector('[data-del-d]').onclick = async () => { m.close(true); await removeEvent(ev.id); };
  }

  // --------------------------------------------------------------- form ------
  // openForm(presetDay)            -> criar (selects de cliente/serviço)
  // openForm(null, editEvent)      -> editar (título livre, pré-preenchido)
  function openForm(presetDay, editEvent) {
    const isEdit = !!editEvent;
    const prefClient = isEdit ? null : sessionStorage.getItem('intent:agendar');
    if (prefClient) sessionStorage.removeItem('intent:agendar');

    const pad = (n) => String(n).padStart(2, '0');
    let day = presetDay || todayISO();
    let timeVal = '09:00', durVal = 60, notesVal = '', titleVal = '';
    if (isEdit) {
      const s = evStart(editEvent);
      day = `${s.getFullYear()}-${pad(s.getMonth() + 1)}-${pad(s.getDate())}`;
      if (editEvent.start?.dateTime) timeVal = `${pad(s.getHours())}:${pad(s.getMinutes())}`;
      if (editEvent.end?.dateTime) {
        const e = new Date(editEvent.end.dateTime);
        durVal = Math.max(5, Math.round((e - s) / 60000));
      }
      notesVal = editEvent.description || '';
      titleVal = editEvent.summary || '';
    }

    const form = document.createElement('form'); form.id = 'ag-form';
    const pickers = isEdit
      ? `<div class="field"><label>Título <span class="req">*</span></label>
           <input class="input" name="title" required value="${esc(titleVal)}"></div>`
      : `<div class="field">
           <label>Cliente</label>
           <select class="select" name="client">
             <option value="">— selecionar —</option>
             ${state.clients.map((c) => `<option value="${c.id}" ${c.id === prefClient ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
           </select>
         </div>
         <div class="field">
           <label>Serviço</label>
           <select class="select" name="service">
             <option value="">— selecionar —</option>
             ${state.services.map((s) => `<option value="${s.id}" data-dur="${s.duration_min || ''}">${esc(s.name)}</option>`).join('')}
           </select>
         </div>`;
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
      <div class="field"><label>Observações</label>
        <textarea class="textarea" name="notes">${esc(notesVal)}</textarea></div>`;

    // ao escolher serviço, herda a duração padrão (só no modo criar)
    if (!isEdit) form.service.onchange = () => {
      const dur = form.service.selectedOptions[0]?.dataset.dur;
      if (dur) form.dur.value = dur;
    };

    const foot = document.createElement('div');
    foot.innerHTML = `<button class="btn btn--ghost" type="button" data-x>Cancelar</button>
                      <button class="btn btn--primary" type="submit" form="ag-form">${isEdit ? 'Salvar' : 'Agendar'}</button>`;
    const m = openModal({ title: isEdit ? 'Editar agendamento' : 'Novo agendamento', body: form, footer: foot });
    foot.querySelector('[data-x]').onclick = () => m.close();

    form.onsubmit = async (e) => {
      e.preventDefault();
      const submit = foot.querySelector('[type="submit"]');
      const start = new Date(`${form.date.value}T${form.time.value}`);
      if (isNaN(start)) return toast('Data ou hora inválida.', 'warning');
      const end = new Date(start.getTime() + (Number(form.dur.value) || 60) * 60000);

      let summary;
      if (isEdit) {
        summary = form.title.value.trim() || '(sem título)';
      } else {
        const client = state.clients.find((c) => c.id === form.client.value);
        const service = state.services.find((s) => s.id === form.service.value);
        summary = [service?.name, client?.name].filter(Boolean).join(' — ') || 'Agendamento';
      }

      busy(submit, true, isEdit ? 'Salvando…' : 'Agendando…');
      try {
        if (isEdit) {
          await updateEvent(editEvent.id, { summary, description: form.notes.value.trim(), start, end });
          toast('Agendamento atualizado.');
        } else {
          await createEvent({ summary, description: form.notes.value.trim() || undefined, start, end });
          toast('Agendamento criado no Google Calendar.');
        }
        m.markClean(); m.close(true);
        // pula a view para onde o evento aparece
        state.cursor = start; load();
      } catch (err) {
        if (err instanceof NeedsReconnect) { m.close(true); return reconnect(); }
        toast(err.message, 'error');
      } finally { busy(submit, false); }
    };
  }

  await load();
  if (sessionStorage.getItem('intent:agendar')) openForm();
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

// ============================================================================
// servicos.js — catálogo de serviços (CRUD). Padrão seguido pelos outros módulos.
// Regra: serviços não são excluídos, apenas inativados (têm procedimentos ligados).
// ============================================================================
import { supabase } from './supabase.js';
import { money, openModal, toast, busy, esc, debounce, icon } from './utils.js';

// paleta inspirada no Google Calendar, com tons levemente ajustados (não idênticos)
const PALETTE = [
  // quentes
  '#e06666', '#e8735c', '#ef8d3c', '#f2a93c', '#f6c945', '#f0d264', '#d9a441', '#c98a52',
  // verdes/azuis
  '#3fa66a', '#4cb782', '#4fb3a9', '#3aa0c9', '#4472c4', '#5b7fd1', '#6b8fc7', '#4d8fac',
  // neutros/frios
  '#8e7cc3', '#9662ab', '#b06ba0', '#c77ba3', '#8c8c94', '#746f8c', '#6d7e96', '#9098a3',
];

export async function render(root, ctx) {
  const state = { filter: 'active', q: '' };

  const btn = document.createElement('button');
  btn.className = 'btn btn--primary';
  btn.textContent = '+ Novo Serviço';
  btn.onclick = () => openForm(ctx, null, () => load());
  ctx.actions.appendChild(btn);

  root.innerHTML = `
    <div class="module__toolbar">
      <div class="segmented" id="svc-filter">
        <button data-f="active" class="active">Ativos</button>
        <button data-f="inactive">Inativos</button>
        <button data-f="all">Todos</button>
      </div>
      <div class="spacer"></div>
      <input class="input search-input" id="svc-q" placeholder="Buscar por nome…" />
    </div>
    <div class="table-wrap">
      <table class="data">
        <thead><tr><th>Serviço</th><th class="num">Preço</th><th class="num">Duração</th><th>Status</th></tr></thead>
        <tbody id="svc-rows"></tbody>
      </table>
    </div>`;

  root.querySelector('#svc-filter').onclick = (e) => {
    const b = e.target.closest('[data-f]'); if (!b) return;
    state.filter = b.dataset.f;
    root.querySelectorAll('#svc-filter button').forEach((x) => x.classList.toggle('active', x === b));
    load();
  };
  root.querySelector('#svc-q').addEventListener('input', debounce((e) => { state.q = e.target.value.trim(); load(); }));

  const tbody = root.querySelector('#svc-rows');

  async function load() {
    tbody.innerHTML = Array.from({ length: 4 }, () =>
      `<tr>${'<td><div class="skeleton"></div></td>'.repeat(4)}</tr>`).join('');
    let q = supabase.from('services').select('*').order('name');
    if (state.filter === 'active') q = q.eq('active', true);
    if (state.filter === 'inactive') q = q.eq('active', false);
    if (state.q) q = q.ilike('name', `%${state.q}%`);
    const { data, error } = await q;
    if (error) { tbody.innerHTML = ''; toast('Erro ao carregar serviços.', 'error'); return; }
    if (!data.length) {
      tbody.innerHTML = `<tr><td colspan="4"><div class="empty"><div class="icon">${icon('scissors')}</div>
        <p>Nenhum serviço ${state.q ? 'encontrado' : 'cadastrado'}.</p></div></td></tr>`;
      return;
    }
    tbody.innerHTML = data.map(row).join('');
    tbody.querySelectorAll('[data-id]').forEach((el) =>
      el.onclick = () => openForm(ctx, data.find((s) => s.id === el.dataset.id), () => load()));
  }

  // item 3.1: listagem em linha (table.data), mesmo padrão de historico/clientes.
  // Clique na linha abre o mesmo openForm de edição dos cards antigos.
  function row(s) {
    return `
      <tr class="clickable" data-id="${s.id}">
        <td><div class="flex" style="gap:8px">
          <span class="dot" style="background:${esc(s.color || '#9e9892')}"></span>
          <span>${esc(s.name)}${s.description ? `<div class="sub faint" style="font-size:var(--fs-xs)">${esc(s.description)}</div>` : ''}</span>
        </div></td>
        <td class="num" data-th="Preço">${s.default_price != null ? money(s.default_price) : '—'}</td>
        <td class="num" data-th="Duração">${s.duration_min ? s.duration_min + ' min' : '—'}</td>
        <td data-th="Status">${s.active ? '<span class="badge badge--success">ativo</span>' : '<span class="badge badge--muted">inativo</span>'}</td>
      </tr>`;
  }

  await load();
}

// --------------------------------------------------------------- formulário -
function openForm(ctx, svc, onSaved) {
  const editing = !!svc;
  const accentHex = getComputedStyle(document.documentElement)
    .getPropertyValue('--accent').trim() || PALETTE[0];
  const color = svc?.color || accentHex; // default = accent do app
  const swatches = PALETTE.includes(color) ? PALETTE : [color, ...PALETTE];
  const form = document.createElement('form');
  form.innerHTML = `
    <div class="field">
      <label>Nome <span class="req">*</span></label>
      <input class="input" name="name" required value="${esc(svc?.name || '')}" />
    </div>
    <div class="field">
      <label>Descrição</label>
      <textarea class="textarea" name="description">${esc(svc?.description || '')}</textarea>
    </div>
    <div class="field-row">
      <div class="field">
        <label>Preço padrão (R$)</label>
        <input class="input" name="default_price" type="number" step="0.01" min="0" value="${svc?.default_price ?? ''}" />
      </div>
      <div class="field">
        <label>Duração (min)</label>
        <input class="input" name="duration_min" type="number" min="0" value="${svc?.duration_min ?? ''}" />
      </div>
    </div>
    <div class="field">
      <label>Cor</label>
      <div class="swatches" id="sw">
        ${swatches.map((c) => `<span class="swatch ${c === color ? 'selected' : ''}" data-c="${c}" style="background:${c}" role="button" aria-label="${c}"></span>`).join('')}
      </div>
    </div>
    <div class="field">
      <label class="flex" style="cursor:pointer">
        <span class="switch"><input type="checkbox" name="active" ${svc?.active !== false ? 'checked' : ''}><span class="track"></span></span>
        Ativo
      </label>
    </div>`;

  // color picker
  let chosen = color;
  form.querySelector('#sw').onclick = (e) => {
    const s = e.target.closest('[data-c]'); if (!s) return;
    chosen = s.dataset.c;
    form.querySelectorAll('.swatch').forEach((x) => x.classList.toggle('selected', x === s));
  };

  const foot = document.createElement('div');
  foot.innerHTML = `<button class="btn btn--ghost" type="button" data-x>Cancelar</button>
                    <button class="btn btn--primary" type="submit" form="svc-form">${editing ? 'Salvar' : 'Criar'}</button>`;
  form.id = 'svc-form';

  const m = openModal({ title: editing ? 'Editar serviço' : 'Novo serviço', body: form, footer: foot });
  foot.querySelector('[data-x]').onclick = () => m.close();

  form.onsubmit = async (e) => {
    e.preventDefault();
    const submit = foot.querySelector('[type="submit"]');
    const fd = new FormData(form);
    const payload = {
      user_id: ctx.session.user.id,
      name: fd.get('name').trim(),
      description: fd.get('description').trim() || null,
      default_price: fd.get('default_price') ? Number(fd.get('default_price')) : null,
      duration_min: fd.get('duration_min') ? Number(fd.get('duration_min')) : null,
      color: chosen,
      active: fd.get('active') === 'on',
    };
    if (!payload.name) return toast('Informe o nome.', 'warning');
    busy(submit, true);
    const res = editing
      ? await supabase.from('services').update(payload).eq('id', svc.id)
      : await supabase.from('services').insert(payload);
    busy(submit, false);
    if (res.error) { console.error(res.error); return toast('Erro ao salvar.', 'error'); }
    toast(editing ? 'Serviço atualizado.' : 'Serviço criado.');
    m.markClean(); m.close(true); onSaved();
  };
}

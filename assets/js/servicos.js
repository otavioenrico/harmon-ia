// ============================================================================
// servicos.js — catálogo de serviços (CRUD). Padrão seguido pelos outros módulos.
// Regra: serviços não são excluídos, apenas inativados (têm procedimentos ligados).
// ============================================================================
import { supabase } from './supabase.js';
import { money, openModal, toast, busy, esc, debounce } from './utils.js';

const COLORS = ['#b85450', '#c9923a', '#4a7c59', '#3f6f86', '#7b6d8d', '#6b6760', '#9e9892', '#e2dbd3'];

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
    <div id="svc-grid" class="card-grid"></div>`;

  root.querySelector('#svc-filter').onclick = (e) => {
    const b = e.target.closest('[data-f]'); if (!b) return;
    state.filter = b.dataset.f;
    root.querySelectorAll('#svc-filter button').forEach((x) => x.classList.toggle('active', x === b));
    load();
  };
  root.querySelector('#svc-q').addEventListener('input', debounce((e) => { state.q = e.target.value.trim(); load(); }));

  const grid = root.querySelector('#svc-grid');

  async function load() {
    grid.innerHTML = Array.from({ length: 4 }, () =>
      `<div class="card"><div class="skeleton" style="width:60%"></div><div class="skeleton mt-4" style="height:40px"></div></div>`).join('');
    let q = supabase.from('services').select('*').order('name');
    if (state.filter === 'active') q = q.eq('active', true);
    if (state.filter === 'inactive') q = q.eq('active', false);
    if (state.q) q = q.ilike('name', `%${state.q}%`);
    const { data, error } = await q;
    if (error) { grid.innerHTML = ''; toast('Erro ao carregar serviços.', 'error'); return; }
    if (!data.length) {
      grid.innerHTML = `<div class="empty" style="grid-column:1/-1"><div class="icon">✂️</div>
        <p>Nenhum serviço ${state.q ? 'encontrado' : 'cadastrado'}.</p></div>`;
      return;
    }
    grid.innerHTML = data.map(card).join('');
    grid.querySelectorAll('[data-id]').forEach((el) =>
      el.onclick = () => openForm(ctx, data.find((s) => s.id === el.dataset.id), () => load()));
  }

  function card(s) {
    return `
      <div class="card" data-id="${s.id}" style="cursor:pointer">
        <div class="flex" style="justify-content:space-between">
          <span class="dot" style="background:${esc(s.color || '#9e9892')}"></span>
          ${s.active ? '' : '<span class="badge badge--muted">inativo</span>'}
        </div>
        <h3 style="margin:${'8px'} 0 4px">${esc(s.name)}</h3>
        <p class="muted" style="min-height:20px">${esc(s.description || '')}</p>
        <div class="flex mt-4" style="justify-content:space-between">
          <strong>${s.default_price != null ? money(s.default_price) : '—'}</strong>
          <span class="faint">${s.duration_min ? s.duration_min + ' min' : ''}</span>
        </div>
      </div>`;
  }

  await load();
}

// --------------------------------------------------------------- formulário -
function openForm(ctx, svc, onSaved) {
  const editing = !!svc;
  const color = svc?.color || COLORS[2];
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
        ${COLORS.map((c) => `<span class="swatch ${c === color ? 'selected' : ''}" data-c="${c}" style="background:${c}"></span>`).join('')}
        <input class="input" id="sw-hex" style="width:110px" value="${esc(color)}" />
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
  const hex = form.querySelector('#sw-hex');
  form.querySelector('#sw').onclick = (e) => {
    const s = e.target.closest('[data-c]'); if (!s) return;
    chosen = s.dataset.c; hex.value = chosen;
    form.querySelectorAll('.swatch').forEach((x) => x.classList.toggle('selected', x === s));
  };
  hex.addEventListener('input', () => { chosen = hex.value; });

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

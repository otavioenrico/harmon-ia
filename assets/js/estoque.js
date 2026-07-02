// ============================================================================
// estoque.js — controle de estoque: lista com alerta de mínimo, CRUD com links
// de recompra (marketplace_links) e upload de foto/NF para o bucket privado
// `uploads`, movimentações (entrada/saída/ajuste em stock_transactions + débito
// na quantidade) e lista de compras com export. Segue o padrão de servicos.js /
// clientes.js; a RLS isola por usuário (user_id nos inserts).
// ============================================================================
import { supabase } from './supabase.js';
import { money, fmtDateTime, openModal, openDrawer, confirmDialog, toast, busy, debounce, guard,
  esc, skeletonRows, h, toCSV, download, icon, emptyBox, clientAutocomplete, waLink, bulkBar } from './utils.js';

const BUCKET = 'uploads';
const isLow = (it) => it.active !== false && Number(it.quantity || 0) <= Number(it.min_quantity || 0);
const fmtQty = (n) => Number(n || 0).toLocaleString('pt-BR', { maximumFractionDigits: 3 });
const REASONS = { compra: 'Entrada (compra)', descarte: 'Saída / descarte',
  ajuste: 'Ajuste', uso_procedimento: 'Uso em procedimento' };

export async function render(root, ctx) {
  const state = { all: [], q: '', filter: 'all', thumbs: {}, selected: new Set() };
  let drawer = null;

  const buy = document.createElement('button');
  buy.className = 'btn btn--secondary';
  buy.innerHTML = `${icon('box')}<span class="btn-label">Lista de compras</span>`;
  buy.title = 'Lista de compras';
  buy.onclick = () => openShoppingList(ctx, state.all);

  const addToList = document.createElement('button');
  addToList.className = 'btn btn--secondary';
  addToList.innerHTML = `${icon('plus')}<span class="btn-label">Adicionar produto</span>`;
  addToList.title = 'Adicionar produto à lista de compras';
  addToList.onclick = () => openAddToShoppingList(ctx, state.all);

  const add = document.createElement('button');
  add.className = 'btn btn--primary';
  add.textContent = '+ Novo Item';
  add.onclick = () => openForm(ctx, null, load);
  ctx.actions.append(buy, addToList, add);

  root.innerHTML = `
    <div class="module__toolbar">
      <div class="segmented" id="stk-filter">
        <button data-f="all" class="active">Todos</button>
        <button data-f="low">Em falta</button>
        <button data-f="inactive">Inativos</button>
      </div>
      <div class="spacer"></div>
      <input class="input search-input" id="stk-q" placeholder="Buscar item…" />
    </div>
    <div class="table-wrap">
      <div id="stk-bulk"></div>
      <table class="data">
        <thead><tr>
          <th class="chk"><input type="checkbox" id="stk-selall" aria-label="Selecionar todos"></th>
          <th>Item</th><th class="num">Quantidade</th><th class="num">Mínimo</th>
          <th class="num">Custo</th><th>Status</th>
        </tr></thead>
        <tbody id="stk-rows"></tbody>
      </table>
    </div>`;

  const tbody = root.querySelector('#stk-rows');
  const bulkEl = root.querySelector('#stk-bulk');
  const selAll = root.querySelector('#stk-selall');

  root.querySelector('#stk-filter').onclick = (e) => {
    const b = e.target.closest('[data-f]'); if (!b) return;
    state.filter = b.dataset.f;
    root.querySelectorAll('#stk-filter button').forEach((x) => x.classList.toggle('active', x === b));
    paint();
  };
  root.querySelector('#stk-q').addEventListener('input',
    debounce((e) => { state.q = e.target.value.trim().toLowerCase(); paint(); }));

  tbody.onclick = (e) => {
    if (e.target.closest('.chk')) return;   // checkbox de seleção não abre o item
    const tr = e.target.closest('[data-id]'); if (!tr) return;
    openItem(tr.dataset.id);
  };

  // Rodada 7: seleção em massa (delegada — sobrevive aos repaints do tbody)
  tbody.addEventListener('change', (e) => {
    const cb = e.target.closest('[data-sel]'); if (!cb) return;
    cb.checked ? state.selected.add(cb.dataset.sel) : state.selected.delete(cb.dataset.sel);
    paint();
  });
  selAll.onchange = () => {
    filteredRows().forEach((i) => selAll.checked ? state.selected.add(i.id) : state.selected.delete(i.id));
    paint();
  };

  // ----------------------------------------------------------------- dados ---
  async function load() {
    tbody.innerHTML = skeletonRows(6);
    const { data, error } = await supabase.from('stock_items').select('*').order('name');
    if (error) { console.error(error); tbody.innerHTML = ''; toast('Erro ao carregar o estoque.', 'error'); return; }
    state.all = data || [];
    ctx.setBadge('estoque', state.all.filter(isLow).length);
    // item 6: miniaturas na lista. Gera as signed URLs uma vez por load (bucket
    // privado) e cacheia por sessão — não regera a cada render/filtro.
    const paths = state.all.map((i) => i.photo_url).filter((p) => p && !(p in state.thumbs));
    if (paths.length) {
      const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 3600);
      (signed || []).forEach((s) => { if (s.path) state.thumbs[s.path] = s.signedUrl || null; });
    }
    paint();
  }

  function filteredRows() {
    let rows = state.all;
    if (state.filter === 'low') rows = rows.filter(isLow);
    else if (state.filter === 'inactive') rows = rows.filter((i) => i.active === false);
    if (state.q) rows = rows.filter((i) => (i.name || '').toLowerCase().includes(state.q));
    return rows;
  }

  function paint() {
    const rows = filteredRows();
    selAll.checked = rows.length > 0 && rows.every((i) => state.selected.has(i.id));
    bulkEl.innerHTML = bulkBar(state.selected.size, 'stk-del');
    const del = bulkEl.querySelector('#stk-del');
    if (del) del.onclick = guard(async () => {
      const ids = [...state.selected];
      const ok = await confirmDialog({
        title: 'Excluir itens do estoque',
        message: `Excluir ${ids.length} ite${ids.length > 1 ? 'ns' : 'm'}? Movimentações e usos em procedimentos permanecem no histórico, sem o item vinculado; fotos e notas fiscais anexadas são removidas. Essa ação não tem desfazer.`,
        confirmLabel: 'Excluir', danger: true,
      });
      if (!ok) return;
      // paths dos anexos antes do delete (depois as linhas somem) — remoção do
      // bucket é best-effort: item já foi, arquivo órfão não pode travar o fluxo
      const paths = state.all.filter((i) => state.selected.has(i.id))
        .flatMap((i) => [i.photo_url, i.nf_attachment_url]).filter(Boolean);
      const { error } = await supabase.from('stock_items').delete().in('id', ids);
      if (error) { console.error(error); return toast('Erro ao excluir.', 'error'); }
      if (paths.length) supabase.storage.from(BUCKET).remove(paths).catch(() => {});
      state.selected.clear();
      toast(`${ids.length} ite${ids.length > 1 ? 'ns excluídos' : 'm excluído'}.`);
      load();
    });
    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="6">${emptyBox(icon('box'),
        `Nenhum item ${state.q || state.filter !== 'all' ? 'encontrado' : 'cadastrado ainda'}.`)}</td></tr>`;
      return;
    }
    tbody.innerHTML = rows.map(row).join('');
  }

  function row(it) {
    const low = isLow(it);
    return `
      <tr class="clickable" data-id="${it.id}">
        <td class="chk"><input type="checkbox" data-sel="${it.id}" ${state.selected.has(it.id) ? 'checked' : ''} aria-label="Selecionar"></td>
        <td><div class="flex" style="gap:8px">
          ${it.photo_url && state.thumbs[it.photo_url] ? `<img class="thumb" src="${esc(state.thumbs[it.photo_url])}" alt="">` : ''}
          <span>${esc(it.name)}${it.active === false ? ' <span class="badge badge--muted">inativo</span>' : ''}</span>
        </div></td>
        <td class="num ${low ? 'neg' : ''}" data-th="Quantidade">${fmtQty(it.quantity)} ${esc(it.unit || '')}</td>
        <td class="num" data-th="Mínimo">${fmtQty(it.min_quantity)}</td>
        <td class="num" data-th="Custo">${it.cost_price != null ? money(it.cost_price) : '—'}</td>
        <td data-th="Status">${low ? '<span class="badge badge--warning">em falta</span>' : '<span class="badge badge--success">ok</span>'}</td>
      </tr>`;
  }

  // ------------------------------------------------------------- item drawer --
  function openItem(id) {
    const it = state.all.find((x) => x.id === id);
    if (!it) return;
    if (drawer) drawer.close();

    // item 2.2: identificação/form ficam fixos; só o histórico rola (.drawer__body)
    const body = h(`
      <div class="drawer__wrap">
        <div class="drawer__head">
          <div class="flex" style="justify-content:space-between; align-items:flex-start">
            <div>
              <div style="font-size:18px">${esc(it.name)}${it.active === false ? ' <span class="badge badge--muted">inativo</span>' : ''}</div>
              <div class="faint">${fmtQty(it.quantity)} ${esc(it.unit || '')} em estoque · mínimo ${fmtQty(it.min_quantity)}</div>
            </div>
            <button class="btn btn--icon btn--ghost" data-close aria-label="Fechar">×</button>
          </div>

          <div class="flex mt-4" id="thumb"></div>
          ${it.description ? `<p class="muted mt-4">${esc(it.description)}</p>` : ''}
          <div class="flex mt-4" id="links"></div>

          <div class="flex mt-4">
            <button class="btn btn--ghost btn--sm" data-edit>Editar item</button>
            <button class="btn btn--ghost btn--sm" data-add-list>${icon('plus')} Lista de compras</button>
          </div>

          <h3 style="margin:20px 0 8px">Registrar movimentação</h3>
          <form id="mov">
            <div class="field-row" style="align-items:flex-end">
              <div class="field"><label>Tipo</label>
                <select class="select" name="type" style="min-width:120px">
                  <option value="in">Entrada (compra)</option>
                  <option value="out">Saída / descarte</option>
                  <option value="set">Ajuste (contagem)</option>
                </select>
              </div>
              <div class="field"><label id="qlbl">Quantidade</label>
                <input class="input" name="qty" type="number" step="0.001" min="0" required /></div>
              <div class="field" id="paid-wrap"><label>Valor pago (R$)</label>
                <input class="input" name="paid_total" type="number" step="0.01" min="0" placeholder="opcional" /></div>
            </div>
            <p class="hint" id="paid-hint">Valor pago atualiza o custo unitário (÷ qtd).</p>
            <div class="field-row" style="align-items:flex-end">
              <div class="field" style="flex:1"><label>Observação</label>
                <input class="input" name="notes" /></div>
              <button class="btn btn--primary" type="submit">Registrar</button>
            </div>
          </form>

          <h3 style="margin:20px 0 8px">Histórico</h3>
        </div>
        <div class="drawer__body">
          <div id="hist"><table class="data"><tbody>${skeletonRows(4, 3)}</tbody></table></div>
        </div>
      </div>`);

    drawer = openDrawer(body, { center: true });
    body.querySelector('[data-close]').onclick = () => drawer.close();
    body.querySelector('[data-edit]').onclick = () =>
      openForm(ctx, it, async () => { await load(); openItem(id); });
    body.querySelector('[data-add-list]').onclick = guard(async () => {
      const { error } = await supabase.from('shopping_list_items')
        .upsert({ user_id: ctx.session.user.id, stock_item_id: it.id }, { onConflict: 'user_id,stock_item_id' });
      if (error) { console.error(error); return toast('Erro ao adicionar à lista.', 'error'); }
      toast('Adicionado à lista de compras.');
    });

    // ajuste usa contagem absoluta; entrada/saída usam delta
    const qlbl = body.querySelector('#qlbl');
    const paidWrap = body.querySelector('#paid-wrap');   // valor pago só faz sentido em entrada
    const paidHint = body.querySelector('#paid-hint');
    body.querySelector('[name="type"]').onchange = (e) => {
      qlbl.textContent = e.target.value === 'set' ? 'Nova contagem' : 'Quantidade';
      const isIn = e.target.value === 'in';
      paidWrap.hidden = !isIn;
      paidHint.hidden = !isIn;
    };

    renderAttachments(it, body.querySelector('#thumb'));
    renderLinks(it.marketplace_links, body.querySelector('#links'));

    body.querySelector('#mov').onsubmit = (e) => {
      e.preventDefault();
      submitMovement(ctx, it, e.target, async () => { await load(); openItem(id); });
    };
    loadHistory(id, body.querySelector('#hist'));
  }

  await load();
  if (sessionStorage.getItem('intent:novoProduto')) {
    sessionStorage.removeItem('intent:novoProduto');
    openForm(ctx, null, load);
  }
}

// ------------------------------------------------------------ movimentação --
async function submitMovement(ctx, it, form, onDone) {
  const fd = new FormData(form);
  const type = fd.get('type');
  const input = Number(fd.get('qty'));
  if (!(input >= 0)) return toast('Quantidade inválida.', 'warning');
  const current = Number(it.quantity || 0);

  let txType, txQty, newQty, reason;
  if (type === 'in')       { txType = 'in';  txQty = input; newQty = current + input; reason = 'compra'; }
  else if (type === 'out') { txType = 'out'; txQty = input; newQty = current - input; reason = 'descarte'; }
  else {                                                     // ajuste p/ contagem absoluta
    const delta = input - current;
    txType = delta >= 0 ? 'in' : 'out'; txQty = Math.abs(delta); newQty = input; reason = 'ajuste';
  }
  if (newQty < 0) return toast('A saída deixaria o estoque negativo.', 'warning');
  if (txQty === 0) return toast('Sem alteração de quantidade.', 'warning');

  const submit = form.querySelector('[type="submit"]');
  busy(submit, true, 'Registrando…');
  // ponytail: lê a quantidade carregada e regrava (read-then-write). Single-tenant
  // owner, sem corrida real; se virar multi-dispositivo, mover p/ RPC atômica.
  const tx = await supabase.from('stock_transactions').insert({
    user_id: ctx.session.user.id, stock_item_id: it.id, type: txType,
    quantity: txQty, reason, notes: (fd.get('notes') || '').toString().trim() || null,
  });
  if (tx.error) { busy(submit, false); console.error(tx.error); return toast('Erro ao registrar.', 'error'); }
  const up = await supabase.from('stock_items').update({ quantity: newQty }).eq('id', it.id);
  busy(submit, false);
  if (up.error) { console.error(up.error); return toast('Movimento gravado, mas falhou ao atualizar a quantidade.', 'error'); }

  // item 13: entrada com valor pago total → custo unitário = valor ÷ qtd.
  // ponytail: última compra (não custo médio ponderado) — regra mais simples e
  // previsível p/ clínica solo; trocar por média se o giro exigir.
  const paidTotal = Number(fd.get('paid_total'));
  if (type === 'in' && paidTotal > 0 && input > 0) {
    const unit = Number((paidTotal / input).toFixed(2));
    const c = await supabase.from('stock_items').update({ cost_price: unit }).eq('id', it.id);
    if (c.error) console.error(c.error);
  }
  toast('Movimentação registrada.');
  onDone();
}

async function loadHistory(itemId, pane) {
  const { data, error } = await supabase.from('stock_transactions')
    .select('created_at, type, quantity, reason, notes')
    .eq('stock_item_id', itemId).order('created_at', { ascending: false }).limit(100);
  if (error) { console.error(error); pane.innerHTML = emptyBox(icon('warning'), 'Erro ao carregar o histórico.'); return; }
  if (!data.length) { pane.innerHTML = emptyBox('', 'Nenhuma movimentação ainda.'); return; }
  pane.innerHTML = `
    <table class="data">
      <thead><tr><th>Data</th><th>Tipo</th><th class="num">Qtd.</th><th>Obs.</th></tr></thead>
      <tbody>${data.map((t) => `<tr>
        <td class="nowrap" data-th="Data">${fmtDateTime(t.created_at)}</td>
        <td data-th="Tipo">${esc(REASONS[t.reason] || t.reason || (t.type === 'in' ? 'entrada' : 'saída'))}</td>
        <td class="num ${t.type === 'in' ? 'pos' : 'neg'}" data-th="Qtd.">${t.type === 'in' ? '+' : '−'}${fmtQty(t.quantity)}</td>
        <td data-th="Obs.">${esc(t.notes || '—')}</td>
      </tr>`).join('')}</tbody>
    </table>`;
}

// ----------------------------------------------------------- anexos / links --
async function signedUrl(path) {
  if (!path) return null;
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
  return data?.signedUrl || null;
}

async function renderAttachments(it, el) {
  const parts = [];
  if (it.photo_url) {
    const u = await signedUrl(it.photo_url);
    if (u) parts.push(`<a href="${esc(u)}" target="_blank" rel="noopener"><img src="${esc(u)}" alt="foto" style="height:72px;border-radius:8px;object-fit:cover"></a>`);
  }
  if (it.nf_attachment_url) {
    const u = await signedUrl(it.nf_attachment_url);
    if (u) parts.push(`<a class="btn btn--ghost btn--sm" href="${esc(u)}" target="_blank" rel="noopener">Ver nota fiscal</a>`);
  }
  el.innerHTML = parts.join('');
}

function renderLinks(links, el) {
  const list = Array.isArray(links) ? links : [];
  el.innerHTML = list.map((l) =>
    `<a class="btn btn--secondary btn--sm" href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.name || 'Comprar')}</a>`).join('');
}

async function uploadFile(uid, file) {
  const safe = file.name.replace(/[^\w.\-]+/g, '_');
  const path = `${uid}/${crypto.randomUUID()}-${safe}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false });
  if (error) throw error;
  return path;
}

// --------------------------------------------------------------- formulário --
function openForm(ctx, it, onSaved) {
  const editing = !!it;
  const form = document.createElement('form');
  form.id = 'stk-form';
  form.innerHTML = `
    <div class="field">
      <label>Nome <span class="req">*</span></label>
      <input class="input" name="name" required value="${esc(it?.name || '')}" />
    </div>
    <div class="field">
      <label>Descrição</label>
      <textarea class="textarea" name="description">${esc(it?.description || '')}</textarea>
    </div>
    <div class="field-row">
      <div class="field"><label>${editing ? 'Quantidade atual' : 'Quantidade inicial'}</label>
        <input class="input" name="quantity" type="number" step="0.001" min="0"
          value="${it?.quantity ?? 0}" ${editing ? 'disabled' : ''} />
        ${editing ? '<span class="hint">Ajuste pelas movimentações.</span>' : ''}</div>
      <div class="field"><label>Estoque mínimo</label>
        <input class="input" name="min_quantity" type="number" step="0.001" min="0" value="${it?.min_quantity ?? 0}" /></div>
      <div class="field"><label>Unidade</label>
        <input class="input" name="unit" placeholder="un, ml, g…" value="${esc(it?.unit || '')}" /></div>
    </div>
    <div class="field-row">
      <div class="field"><label>Custo unitário (R$)</label>
        <input class="input" name="cost_price" type="number" step="0.01" min="0" value="${it?.cost_price ?? ''}" /></div>
    </div>

    <div class="field">
      <label>Links de recompra</label>
      <div id="mlinks"></div>
      <button type="button" class="btn btn--ghost btn--sm mt-4" id="mlink-add">+ adicionar link</button>
    </div>

    <div class="field-row">
      <div class="field"><label>Foto do item</label>
        <input class="input" name="photo" type="file" accept="image/*" />
        ${it?.photo_url ? '<span class="hint">Já há uma foto; enviar substitui.</span>' : ''}</div>
      <div class="field"><label>Nota fiscal</label>
        <input class="input" name="nf" type="file" />
        ${it?.nf_attachment_url ? '<span class="hint">Já há um anexo; enviar substitui.</span>' : ''}</div>
    </div>

    <div class="field">
      <label class="flex" style="cursor:pointer">
        <span class="switch"><input type="checkbox" name="active" ${it?.active !== false ? 'checked' : ''}><span class="track"></span></span>
        Item ativo
      </label>
    </div>`;

  // editor de marketplace_links (jsonb): linhas {name, url} adicionáveis/removíveis
  const mwrap = form.querySelector('#mlinks');
  const addLink = (l = {}) => {
    const rowEl = h(`<div class="field-row" style="align-items:center; margin-bottom:8px">
      <input class="input" data-ml="name" placeholder="Loja" style="flex:1" value="${esc(l.name || '')}" />
      <input class="input" data-ml="url" placeholder="https://…" style="flex:2" value="${esc(l.url || '')}" />
      <button type="button" class="btn btn--icon btn--ghost" data-rm aria-label="Remover">×</button>
    </div>`);
    rowEl.querySelector('[data-rm]').onclick = () => rowEl.remove();
    mwrap.appendChild(rowEl);
  };
  (Array.isArray(it?.marketplace_links) ? it.marketplace_links : []).forEach(addLink);
  form.querySelector('#mlink-add').onclick = () => addLink();

  const foot = document.createElement('div');
  foot.innerHTML = `<button class="btn btn--ghost" type="button" data-x>Cancelar</button>
                    <button class="btn btn--primary" type="submit" form="stk-form">${editing ? 'Salvar' : 'Criar'}</button>`;

  const m = openModal({ title: editing ? 'Editar item' : 'Novo item', body: form, footer: foot, wide: true });
  foot.querySelector('[data-x]').onclick = () => m.close();

  form.onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const name = (fd.get('name') || '').toString().trim();
    if (!name) return toast('Informe o nome.', 'warning');

    const links = [...mwrap.querySelectorAll('.field-row')].map((r) => ({
      name: r.querySelector('[data-ml="name"]').value.trim(),
      url: r.querySelector('[data-ml="url"]').value.trim(),
    })).filter((l) => l.url);

    const submit = foot.querySelector('[type="submit"]');
    busy(submit, true);
    const uploaded = []; // paths enviados nesta submissão — removidos se o save falhar
    try {
      const uid = ctx.session.user.id;
      const photo = form.querySelector('[name="photo"]').files[0];
      const nf = form.querySelector('[name="nf"]').files[0];
      const payload = {
        user_id: uid,
        name,
        description: (fd.get('description') || '').toString().trim() || null,
        min_quantity: Number(fd.get('min_quantity') || 0),
        unit: (fd.get('unit') || '').toString().trim() || null,
        cost_price: fd.get('cost_price') ? Number(fd.get('cost_price')) : null,
        marketplace_links: links.length ? links : null,
        active: fd.get('active') === 'on',
      };
      if (!editing) payload.quantity = Number(fd.get('quantity') || 0); // ponytail: estoque inicial direto na coluna; histórico começa no 1º movimento.
      if (photo) { payload.photo_url = await uploadFile(uid, photo); uploaded.push(payload.photo_url); }
      if (nf) { payload.nf_attachment_url = await uploadFile(uid, nf); uploaded.push(payload.nf_attachment_url); }

      const res = editing
        ? await supabase.from('stock_items').update(payload).eq('id', it.id)
        : await supabase.from('stock_items').insert(payload);
      if (res.error) throw res.error;
      toast(editing ? 'Item atualizado.' : 'Item criado.');
      m.markClean(); m.close(true); onSaved();
    } catch (err) {
      console.error(err);
      // rollback: arquivos enviados sem item salvo virariam órfãos no bucket
      if (uploaded.length) supabase.storage.from(BUCKET).remove(uploaded).catch(() => {});
      toast('Erro ao salvar o item.', 'error');
    } finally {
      busy(submit, false);
    }
  };
}

// ----------------------------------------------------------- lista de compras -
// une os itens abaixo do mínimo (automáticos) com os adicionados manualmente
// via shopping_list_items — dedup por id (item já em falta não duplica).
async function openShoppingList(ctx, allItems) {
  const body = h(`<div><table class="data"><tbody>${skeletonRows(5, 4)}</tbody></table></div>`);
  const foot = document.createElement('div');
  foot.innerHTML = `<button class="btn btn--ghost" type="button" data-x>Fechar</button>`;
  const m = openModal({ title: 'Lista de compras', body, footer: foot, wide: true });
  foot.querySelector('[data-x]').onclick = () => m.close();

  const lowItems = allItems.filter(isLow);
  const { data: manualRows, error } = await supabase.from('shopping_list_items')
    .select('id, stock_item_id, stock_items(*)');
  if (error) console.error(error);
  const manualItems = (manualRows || [])
    .filter((r) => r.stock_items && !lowItems.some((it) => it.id === r.stock_item_id))
    .map((r) => ({ ...r.stock_items, _listRowId: r.id }));
  const items = [...lowItems, ...manualItems];

  if (!items.length) {
    body.innerHTML = emptyBox(icon('check'), 'Nenhum item abaixo do mínimo. Estoque em dia!');
    return;
  }

  const rowHTML = (it) => {
    const low = isLow(it);
    const need = low ? Math.max(Number(it.min_quantity || 0) - Number(it.quantity || 0), 0) : null;
    const links = (Array.isArray(it.marketplace_links) ? it.marketplace_links : [])
      .map((l) => `<a class="btn btn--secondary btn--sm" href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.name || 'Comprar')}</a>`).join(' ');
    return `<tr>
      <td>${esc(it.name)}</td>
      <td class="num" data-th="Atual">${fmtQty(it.quantity)} ${esc(it.unit || '')}</td>
      <td class="num" data-th="Mínimo">${fmtQty(it.min_quantity)}</td>
      <td class="num" data-th="Comprar">${need != null ? `${fmtQty(need)} ${esc(it.unit || '')}` : '—'}</td>
      <td data-th="Onde">${links || '<span class="faint">—</span>'}</td>
      <td class="num actions">${it._listRowId ? `<button class="btn btn--icon btn--ghost" data-rm="${it._listRowId}" title="Remover">${icon('x')}</button>` : ''}</td>
    </tr>`;
  };
  body.innerHTML = `
    <table class="data">
      <thead><tr><th>Item</th><th class="num">Atual</th><th class="num">Mínimo</th>
        <th class="num">Comprar</th><th>Onde</th><th></th></tr></thead>
      <tbody>${items.map(rowHTML).join('')}</tbody>
    </table>`;
  body.querySelectorAll('[data-rm]').forEach((b) => b.onclick = guard(async () => {
    const { error } = await supabase.from('shopping_list_items').delete().eq('id', b.dataset.rm);
    if (error) { console.error(error); return toast('Erro ao remover.', 'error'); }
    b.closest('tr').remove();
  }));

  const waNumber = ctx.settings?.whatsapp_number;
  const waMsg = () => items.map((it) => {
    const need = isLow(it) ? Math.max(Number(it.min_quantity || 0) - Number(it.quantity || 0), 0) : null;
    return `• ${it.name}${need != null ? ` — ${fmtQty(need)} ${it.unit || ''}` : ''}`;
  }).join('\n');
  const waBtn = waNumber
    ? `<a class="btn btn--secondary" target="_blank" rel="noopener" href="${waLink(waNumber, `Lista de compras:\n\n${waMsg()}`)}">${icon('whatsapp')} Enviar no WhatsApp</a>` : '';
  foot.innerHTML = `<button class="btn btn--ghost" type="button" data-x>Fechar</button>
    ${waBtn}<button class="btn btn--primary" type="button" data-csv>Exportar CSV</button>`;
  foot.querySelector('[data-x]').onclick = () => m.close();

  foot.querySelector('[data-csv]').onclick = () => {
    const rowsOut = [['Item', 'Atual', 'Mínimo', 'Comprar', 'Unidade', 'Links']];
    items.forEach((it) => {
      const need = isLow(it) ? Math.max(Number(it.min_quantity || 0) - Number(it.quantity || 0), 0) : '';
      const urls = (Array.isArray(it.marketplace_links) ? it.marketplace_links : []).map((l) => l.url).join(' ');
      rowsOut.push([it.name, fmtQty(it.quantity), fmtQty(it.min_quantity), need !== '' ? fmtQty(need) : '', it.unit || '', urls]);
    });
    download(`lista-compras-${new Date().toISOString().slice(0, 10)}.csv`, toCSV(rowsOut), 'text/csv;charset=utf-8');
  };
}

// adicionar produto já cadastrado no estoque à lista de compras manualmente
function openAddToShoppingList(ctx, allItems) {
  const form = document.createElement('form');
  form.id = 'shop-add-form';
  const picker = clientAutocomplete(allItems, '', 'Buscar produto…');
  form.innerHTML = `<div class="field"><label>Produto</label></div>`;
  form.querySelector('.field').appendChild(picker.el);

  const foot = document.createElement('div');
  foot.innerHTML = `<button class="btn btn--ghost" type="button" data-x>Cancelar</button>
    <button class="btn btn--primary" type="submit" form="shop-add-form">Adicionar</button>`;
  const m = openModal({ title: 'Adicionar produto à lista', body: form, footer: foot });
  foot.querySelector('[data-x]').onclick = () => m.close();

  form.onsubmit = async (e) => {
    e.preventDefault();
    const id = picker.value();
    if (!id) return toast('Escolha um produto.', 'warning');
    const submit = foot.querySelector('[type="submit"]');
    busy(submit, true);
    const { error } = await supabase.from('shopping_list_items')
      .upsert({ user_id: ctx.session.user.id, stock_item_id: id }, { onConflict: 'user_id,stock_item_id' });
    busy(submit, false);
    if (error) { console.error(error); return toast('Erro ao adicionar.', 'error'); }
    toast('Adicionado à lista de compras.');
    m.markClean(); m.close(true);
  };
}

// ============================================================================
// financeiro.js — Fluxo de Caixa. Lista financial_entries (parcelas vindas do
// registro de procedimento + lançamentos manuais), filtra por período/status/
// tipo em memória, dá baixa em pendências (paid/paid_at), lança receita/despesa
// avulsa, mostra stat-cards e exporta CSV. Segue o padrão de historico.js.
// RLS isola por usuário (user_id nos inserts).
// ============================================================================
import { supabase } from './supabase.js';
import { money, fmtDate, todayISO, openModal, toast, busy, esc, parseMoney,
  toCSV, download, icon } from './utils.js';

const finIcon = icon('wallet');

const METHODS = [
  ['pix', 'Pix'], ['dinheiro', 'Dinheiro'], ['cartao_debito', 'Cartão de débito'],
  ['cartao_credito', 'Cartão de crédito'], ['parcelado', 'Parcelado'],
];
const methodLabel = (v) => (METHODS.find(([k]) => k === v) || [, '—'])[1];
// data de referência da linha p/ filtro/ordenação: vencimento, senão criação
const refDate = (e) => (e.due_date || e.created_at || '').slice(0, 10);

export async function render(root, ctx) {
  const state = { all: [], tab: 'resumo', fStatus: '', fDe: '', fAte: '' };

  const btn = document.createElement('button');
  btn.className = 'btn btn--primary';
  btn.textContent = '+ Lançamento';
  btn.onclick = () => openForm(ctx.session.user.id, load);
  const csvBtn = document.createElement('button');
  csvBtn.className = 'btn btn--secondary';
  csvBtn.innerHTML = `${icon('download')}<span class="btn-label">Exportar CSV</span>`;
  csvBtn.title = 'Exportar CSV';
  csvBtn.onclick = () => exportCSV(filtered());
  ctx.actions.append(btn, csvBtn);

  // item 11: apresentação em abas por cima da mesma query/estado.
  root.innerHTML = `
    <div class="segmented mb-3" id="f-tabs">
      <button class="active" data-t="resumo">Resumo</button>
      <button data-t="entradas">Entradas</button>
      <button data-t="saidas">Saídas</button>
      <button data-t="comp">Comparativo</button>
      <button data-t="planilha">Planilha</button>
    </div>
    <div class="module__toolbar">
      <div id="f-filters" class="flex" style="gap:8px; flex-wrap:wrap"></div>
    </div>
    <div id="f-pane"></div>`;

  const pane = root.querySelector('#f-pane');
  const filters = root.querySelector('#f-filters');

  root.querySelector('#f-tabs').onclick = (e) => {
    const b = e.target.closest('[data-t]'); if (!b) return;
    state.tab = b.dataset.t;
    root.querySelectorAll('#f-tabs button').forEach((x) => x.classList.toggle('active', x === b));
    paint();
  };

  filters.innerHTML = `
    <select class="select" id="f-status" style="max-width:160px">
      <option value="">Todo status</option><option value="pending">Pendentes</option><option value="paid">Pagos</option></select>
    <input class="input" id="f-de" type="date" value="${state.fDe}" title="De" style="max-width:150px">
    <input class="input" id="f-ate" type="date" value="${state.fAte}" title="Até" style="max-width:150px">`;
  filters.querySelector('#f-status').onchange = (e) => { state.fStatus = e.target.value; paint(); };
  filters.querySelector('#f-de').onchange = (e) => { state.fDe = e.target.value; paint(); };
  filters.querySelector('#f-ate').onchange = (e) => { state.fAte = e.target.value; paint(); };

  // filtro base (status + período); a aba decide o recorte por tipo.
  function filtered() {
    let rows = state.all;
    if (state.fStatus) rows = rows.filter((e) => (state.fStatus === 'paid') === !!e.paid);
    if (state.fDe) rows = rows.filter((e) => refDate(e) >= state.fDe);
    if (state.fAte) rows = rows.filter((e) => refDate(e) <= state.fAte);
    return rows;
  }

  async function load() {
    pane.innerHTML = `<div class="table-wrap"><table class="data"><tbody>${
      `<tr><td><div class="skeleton"></div></td></tr>`.repeat(5)}</tbody></table></div>`;
    // ponytail: busca tudo e filtra em memória (igual historico/clientes); vira
    // RPC/view se uma profissional acumular milhares de lançamentos.
    const { data, error } = await supabase.from('financial_entries')
      .select('id, type, amount, description, category, payment_method, installments, installment_of, due_date, paid, paid_at, client_id, created_at, clients(name)')
      .order('due_date', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false });
    if (error) { console.error(error); toast('Erro ao carregar lançamentos.', 'error'); return; }
    state.all = data || [];
    paint();
  }

  function paint() {
    const rows = filtered();
    if (state.tab === 'resumo') return paintResumo(rows);
    if (state.tab === 'comp') return paintComparativo(rows);
    // entradas / saidas / planilha são todas tabelas, só muda o recorte por tipo
    const subset = state.tab === 'entradas' ? rows.filter((e) => e.type === 'income')
                 : state.tab === 'saidas'   ? rows.filter((e) => e.type === 'expense')
                 : rows;
    paintTable(subset);
  }

  function paintTable(rows) {
    if (!rows.length) {
      pane.innerHTML = `<div class="empty"><div class="icon">${finIcon}</div><p>Nenhum lançamento no filtro.</p></div>`;
      return;
    }
    pane.innerHTML = `
      <div class="table-wrap"><table class="data">
        <thead><tr><th>Data</th><th>Descrição</th><th>Cliente</th><th>Forma</th>
          <th class="num">Valor</th><th>Status</th><th></th></tr></thead>
        <tbody>${rows.map(rowHTML).join('')}</tbody>
      </table></div>`;
    pane.querySelectorAll('[data-pay]').forEach((b) => b.onclick = () => settle(b.dataset.pay, load));
  }

  function paintResumo(rows) {
    let recebido = 0, aReceber = 0, despesas = 0;
    for (const e of rows) {
      const v = Number(e.amount) || 0;
      if (e.type === 'income') (e.paid ? recebido += v : aReceber += v);
      else if (e.paid) despesas += v;
    }
    const saldo = recebido - despesas;
    const card = (label, val, cls = '') =>
      `<div class="stat"><div class="label">${label}</div><div class="value ${cls}">${money(val)}</div></div>`;
    // quebra por categoria (top do período)
    const byCat = {};
    for (const e of rows) {
      const k = `${e.type}|${e.category || 'sem categoria'}`;
      byCat[k] = (byCat[k] || 0) + (Number(e.amount) || 0);
    }
    const cats = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 8);
    pane.innerHTML = `
      <div class="stat-cards">
        ${card('Recebido', recebido, 'pos')}${card('A receber', aReceber)}
        ${card('Despesas', despesas, despesas ? 'neg' : '')}${card('Saldo', saldo, saldo < 0 ? 'neg' : 'pos')}
      </div>
      <div class="panel"><div class="panel__title">Por categoria</div>
        ${cats.length ? cats.map(([k, v]) => {
          const [t, c] = k.split('|');
          return `<div class="panel__row"><span class="grow">${esc(c)}</span>
            <span class="${t === 'income' ? 'pos' : 'neg'}">${t === 'income' ? '' : '−'}${money(v)}</span></div>`;
        }).join('') : '<p class="faint">Sem lançamentos no período.</p>'}
      </div>`;
  }

  function paintComparativo(rows) {
    // receita × despesa por mês (regime de competência: usa a data de referência)
    const byMonth = {};
    for (const e of rows) {
      const m = refDate(e).slice(0, 7); if (!m) continue;
      (byMonth[m] = byMonth[m] || { income: 0, expense: 0 })[e.type] += Number(e.amount) || 0;
    }
    const months = Object.keys(byMonth).sort().reverse().slice(0, 12);
    if (!months.length) { pane.innerHTML = `<div class="empty"><div class="icon">${finIcon}</div><p>Sem dados no período.</p></div>`; return; }
    const max = Math.max(...months.map((m) => Math.max(byMonth[m].income, byMonth[m].expense)), 1);
    const bar = (v, cls) => `<div class="bar"><span class="bar__fill ${cls}" style="width:${(v / max * 100).toFixed(1)}%"></span><span class="bar__val">${money(v)}</span></div>`;
    pane.innerHTML = `<div class="panel"><div class="panel__title">Receitas × Despesas por mês</div>
      ${months.map((m) => {
        const d = byMonth[m]; const [y, mo] = m.split('-');
        return `<div class="panel__row" style="align-items:stretch; flex-direction:column; gap:6px">
          <strong>${mo}/${y}</strong>
          ${bar(d.income, 'pos')}${bar(d.expense, 'neg')}
          <span class="faint">Saldo: ${money(d.income - d.expense)}</span>
        </div>`;
      }).join('')}</div>`;
  }

  function rowHTML(e) {
    const inc = e.type === 'income';
    const parc = (e.installments || 1) > 1 ? ` <span class="faint">(${e.installment_of}/${e.installments})</span>` : '';
    const desc = e.description || (inc ? 'Receita' : 'Despesa');
    return `<tr>
      <td class="nowrap">${fmtDate(refDate(e))}</td>
      <td>${esc(desc)}${parc}</td>
      <td>${esc(e.clients?.name || '—')}</td>
      <td>${e.payment_method ? esc(methodLabel(e.payment_method)) : '—'}</td>
      <td class="num ${inc ? 'pos' : 'neg'}">${inc ? '' : '−'}${money(e.amount)}</td>
      <td>${e.paid
        ? `<span class="badge badge--success">pago</span>`
        : `<span class="badge badge--warning">pendente</span>`}</td>
      <td class="num">${e.paid ? '' :
        `<button class="btn btn--secondary btn--sm" data-pay="${e.id}">Dar baixa</button>`}</td>
    </tr>`;
  }

  await load();
}

// dá baixa numa pendência: paid=true, paid_at=hoje
async function settle(id, onSaved) {
  if (!confirm('Confirmar o recebimento/pagamento deste lançamento?')) return;
  const { error } = await supabase.from('financial_entries')
    .update({ paid: true, paid_at: todayISO() }).eq('id', id);
  if (error) { console.error(error); return toast('Erro ao dar baixa.', 'error'); }
  toast('Baixa registrada.');
  onSaved();
}

function exportCSV(rows) {
  if (!rows.length) return toast('Nada para exportar no filtro.', 'warning');
  const head = ['Data', 'Tipo', 'Descrição', 'Cliente', 'Categoria', 'Forma', 'Valor', 'Status', 'Pago em'];
  const body = rows.map((e) => [
    fmtDate(refDate(e)),
    e.type === 'income' ? 'Receita' : 'Despesa',
    e.description || '', e.clients?.name || '', e.category || '',
    e.payment_method ? methodLabel(e.payment_method) : '',
    Number(e.amount).toFixed(2).replace('.', ','),
    e.paid ? 'Pago' : 'Pendente', e.paid_at ? fmtDate(e.paid_at) : '',
  ]);
  download(`fluxo-caixa-${todayISO()}.csv`, toCSV([head, ...body]), 'text/csv');
}

// --------------------------------------------------------------- formulário --
// lançamento manual avulso (1 parcela). Parcelados estruturados nascem do
// registro de procedimento; aqui é receita/despesa simples.
function openForm(uid, onSaved) {
  const form = document.createElement('form');
  form.id = 'fin-form';
  form.innerHTML = `
    <div class="field-row">
      <div class="field"><label>Tipo</label>
        <input type="hidden" name="type" value="income">
        <div class="segmented" id="type-toggle">
          <button type="button" data-type="income" class="active">Receita</button>
          <button type="button" data-type="expense">Despesa</button>
        </div></div>
      <div class="field"><label>Valor (R$) <span class="req">*</span></label>
        <input class="input" name="amount" type="number" step="0.01" min="0" required /></div>
    </div>
    <div class="field"><label>Descrição</label>
      <input class="input" name="description" maxlength="120" /></div>
    <div class="field-row">
      <div class="field"><label>Categoria</label>
        <input class="input" name="category" maxlength="60" placeholder="ex.: aluguel, produtos" /></div>
      <div class="field"><label>Forma</label>
        <select class="select" name="payment_method">
          <option value="">—</option>${METHODS.filter(([k]) => k !== 'parcelado').map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></div>
    </div>
    <div class="field-row">
      <div class="field"><label>Data</label>
        <input class="input" name="due_date" type="date" value="${todayISO()}" /></div>
      <div class="field"><label class="flex" style="cursor:pointer; margin-top:26px">
        <span class="switch"><input type="checkbox" name="paid" checked><span class="track"></span></span>
        Já pago / recebido</label></div>
    </div>`;

  const foot = document.createElement('div');
  foot.innerHTML = `<button class="btn btn--ghost" type="button" data-x>Cancelar</button>
                    <button class="btn btn--primary" type="submit" form="fin-form">Salvar</button>`;
  const m = openModal({ title: 'Novo lançamento', body: form, footer: foot, wide: true });
  foot.querySelector('[data-x]').onclick = () => m.close();

  // item 12: toggle Receita/Despesa alimenta o hidden input name="type"
  form.querySelector('#type-toggle').onclick = (e) => {
    const b = e.target.closest('[data-type]'); if (!b) return;
    form.querySelector('[name="type"]').value = b.dataset.type;
    form.querySelectorAll('#type-toggle button').forEach((x) => x.classList.toggle('active', x === b));
  };

  form.onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const amount = parseMoney(fd.get('amount'));
    if (!(amount > 0)) return toast('Informe um valor maior que zero.', 'warning');
    const paid = fd.get('paid') != null;
    const date = fd.get('due_date') || todayISO();
    const row = {
      user_id: uid,
      type: fd.get('type'),
      amount,
      description: (fd.get('description') || '').toString().trim() || null,
      category: (fd.get('category') || '').toString().trim() || null,
      payment_method: fd.get('payment_method') || null,
      due_date: date,
      paid,
      paid_at: paid ? date : null,
    };
    const submit = foot.querySelector('[type="submit"]');
    busy(submit, true);
    const { error } = await supabase.from('financial_entries').insert(row);
    busy(submit, false);
    if (error) { console.error(error); return toast('Erro ao salvar lançamento.', 'error'); }
    toast('Lançamento salvo.');
    m.markClean(); m.close(true);
    onSaved();
  };
}

// ============================================================================
// financeiro.js — Fluxo de Caixa. Lista financial_entries (parcelas vindas do
// registro de procedimento + lançamentos manuais), filtra por período/status/
// tipo em memória, dá baixa em pendências (paid/paid_at), lança receita/despesa
// avulsa, mostra stat-cards e exporta CSV. Segue o padrão de historico.js.
// RLS isola por usuário (user_id nos inserts).
// ============================================================================
import { supabase } from './supabase.js';
import { money, fmtDate, todayISO, openModal, toast, busy, esc, parseMoney,
  toCSV, download } from './utils.js';

const METHODS = [
  ['pix', 'Pix'], ['dinheiro', 'Dinheiro'], ['cartao_debito', 'Cartão de débito'],
  ['cartao_credito', 'Cartão de crédito'], ['parcelado', 'Parcelado'],
];
const methodLabel = (v) => (METHODS.find(([k]) => k === v) || [, '—'])[1];
// data de referência da linha p/ filtro/ordenação: vencimento, senão criação
const refDate = (e) => (e.due_date || e.created_at || '').slice(0, 10);

export async function render(root, ctx) {
  const state = { all: [], fStatus: '', fType: '', fDe: '', fAte: '' };

  const btn = document.createElement('button');
  btn.className = 'btn btn--primary';
  btn.textContent = '+ Lançamento';
  btn.onclick = () => openForm(ctx.session.user.id, load);
  const csvBtn = document.createElement('button');
  csvBtn.className = 'btn btn--secondary';
  csvBtn.textContent = 'Exportar CSV';
  csvBtn.onclick = () => exportCSV(filtered());
  ctx.actions.append(btn, csvBtn);

  root.innerHTML = `
    <div class="stat-cards" id="f-stats"></div>
    <div class="module__toolbar">
      <div id="f-filters" class="flex" style="gap:8px; flex-wrap:wrap"></div>
    </div>
    <div class="table-wrap" id="f-table"></div>`;

  const statsEl = root.querySelector('#f-stats');
  const tableWrap = root.querySelector('#f-table');
  const filters = root.querySelector('#f-filters');

  filters.innerHTML = `
    <select class="select" id="f-type" style="max-width:160px">
      <option value="">Tudo</option><option value="income">Receitas</option><option value="expense">Despesas</option></select>
    <select class="select" id="f-status" style="max-width:160px">
      <option value="">Todo status</option><option value="pending">Pendentes</option><option value="paid">Pagos</option></select>
    <input class="input" id="f-de" type="date" value="${state.fDe}" title="De" style="max-width:150px">
    <input class="input" id="f-ate" type="date" value="${state.fAte}" title="Até" style="max-width:150px">`;
  filters.querySelector('#f-type').onchange = (e) => { state.fType = e.target.value; paint(); };
  filters.querySelector('#f-status').onchange = (e) => { state.fStatus = e.target.value; paint(); };
  filters.querySelector('#f-de').onchange = (e) => { state.fDe = e.target.value; paint(); };
  filters.querySelector('#f-ate').onchange = (e) => { state.fAte = e.target.value; paint(); };

  function filtered() {
    let rows = state.all;
    if (state.fType) rows = rows.filter((e) => e.type === state.fType);
    if (state.fStatus) rows = rows.filter((e) => (state.fStatus === 'paid') === !!e.paid);
    if (state.fDe) rows = rows.filter((e) => refDate(e) >= state.fDe);
    if (state.fAte) rows = rows.filter((e) => refDate(e) <= state.fAte);
    return rows;
  }

  async function load() {
    tableWrap.innerHTML = `<table class="data"><tbody>${
      `<tr><td><div class="skeleton"></div></td></tr>`.repeat(5)}</tbody></table>`;
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
    paintStats(rows);
    if (!rows.length) {
      tableWrap.innerHTML = `<div class="empty"><div class="icon">💰</div><p>Nenhum lançamento no filtro.</p></div>`;
      return;
    }
    tableWrap.innerHTML = `
      <table class="data">
        <thead><tr><th>Data</th><th>Descrição</th><th>Cliente</th><th>Forma</th>
          <th class="num">Valor</th><th>Status</th><th></th></tr></thead>
        <tbody>${rows.map(rowHTML).join('')}</tbody>
      </table>`;
    tableWrap.querySelectorAll('[data-pay]').forEach((b) =>
      b.onclick = () => settle(b.dataset.pay, load));
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

  function paintStats(rows) {
    let recebido = 0, aReceber = 0, despesas = 0;
    for (const e of rows) {
      const v = Number(e.amount) || 0;
      if (e.type === 'income') (e.paid ? recebido += v : aReceber += v);
      else if (e.paid) despesas += v;
    }
    const card = (label, val, cls = '') =>
      `<div class="stat"><div class="label">${label}</div><div class="value ${cls}">${money(val)}</div></div>`;
    const saldo = recebido - despesas;
    statsEl.innerHTML =
      card('Recebido', recebido, 'pos') +
      card('A receber', aReceber) +
      card('Despesas', despesas, despesas ? 'neg' : '') +
      card('Saldo', saldo, saldo < 0 ? 'neg' : 'pos');
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
        <select class="select" name="type">
          <option value="income">Receita</option><option value="expense">Despesa</option></select></div>
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

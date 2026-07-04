# Plano — Reestruturar Fluxo de Caixa: "Comparativo" e nova aba "Gráficos"

Cole este documento no terminal como instrução. Ele é autossuficiente: nomes de
arquivos, funções e trechos de código estão exatos, alinhados ao código atual.

## Objetivo

1. **Nova aba "Gráficos"** — recebe o conteúdo que hoje está em *Comparativo*
   (barras Receitas × Despesas por mês) **mais** um seletor interno **Barras /
   Pizza**. A pizza mostra **Entradas × Saídas** (donut de proporção).
2. **Aba "Comparativo" repaginada** — passa a mostrar **duas tabelas lado a
   lado**, uma de **Entradas** e uma de **Saídas**, cada uma ocupando metade da
   largura. São **somente leitura** (sem checkbox/excluir; edição continua nas
   abas Entradas/Saídas). Filtros (busca, status, período) e botões de exportar
   continuam funcionando igual — eles já são globais e não precisam mudar.

Arquivos envolvidos: `assets/js/financeiro.js` e `assets/css/components.css`.
Projeto é **sem build** (HTML/CSS/JS vanilla) — a pizza é **SVG inline**, sem
biblioteca externa.

---

## Contexto do código atual (para orientar)

Em `assets/js/financeiro.js`:

- As abas ficam num `.segmented#f-tabs` (linhas ~57–63) com `data-t`: `resumo`,
  `entradas`, `saidas`, `comp`, `planilha`.
- O clique da aba (linha ~72) só troca `state.tab` e chama `paint()`.
- `paint()` (linha ~119) despacha: `resumo` → `paintResumo`, `comp` →
  `paintComparativo`, senão `paintTable` com o recorte por tipo.
- `paintComparativo(rows)` (linha ~215) é o gráfico de barras por mês atual.
- Helpers já importados e usados: `money`, `fmtDate`, `refDate(e)`, `esc`,
  `icon`, `emptyBox`, `finIcon`. **Não há ícone de seta/pizza** no set (`icon()`
  só tem: home, calendar, scissors, box, users, clipboard, wallet, settings,
  logout, menu, panel, tool, trash, plug, left, right, check, warning, whatsapp,
  plus, search, bell, x, sparkle, download, refresh, table, edit). Por isso os
  títulos usam texto com cor `pos`/`neg`, sem ícone.
- Variáveis CSS existentes usadas: `--color-mauve-500` (positivo) e `--danger`
  (negativo), com opacidade ~0.35/0.5 no padrão pastel do projeto.

---

## Passo 1 — Abas (financeiro.js, ~linha 57)

Adicionar a aba **Gráficos** entre `Comparativo` e `Planilha`:

```html
<div class="segmented mb-3" id="f-tabs">
  <button class="active" data-t="resumo">Resumo</button>
  <button data-t="entradas">Entradas</button>
  <button data-t="saidas">Saídas</button>
  <button data-t="comp">Comparativo</button>
  <button data-t="graficos">Gráficos</button>
  <button data-t="planilha">Planilha</button>
</div>
```

## Passo 2 — Despacho em `paint()` (financeiro.js, ~linha 119)

```js
function paint() {
  const rows = filtered();
  if (state.tab === 'resumo')   return paintResumo(rows);
  if (state.tab === 'comp')     return paintComparativo(rows);
  if (state.tab === 'graficos') return paintGraficos(rows);
  const subset = state.tab === 'entradas' ? rows.filter((e) => e.type === 'income')
               : state.tab === 'saidas'   ? rows.filter((e) => e.type === 'expense')
               : rows;
  paintTable(subset, state.tab === 'entradas');
}
```

## Passo 3 — Novo `paintComparativo`: duas tabelas lado a lado (só leitura)

**Substituir** a função `paintComparativo(rows)` atual (linhas ~215–235) por:

```js
// Comparativo: entradas e saídas lado a lado (metade da tela cada), só leitura.
function paintComparativo(rows) {
  const entradas = rows.filter((e) => e.type === 'income');
  const saidas   = rows.filter((e) => e.type === 'expense');
  pane.innerHTML = `<div class="compare-grid">
    <section class="compare-col">
      <div class="panel__title"><span class="pos">Entradas</span></div>
      ${roTableHTML(entradas, 'income')}
    </section>
    <section class="compare-col">
      <div class="panel__title"><span class="neg">Saídas</span></div>
      ${roTableHTML(saidas, 'expense')}
    </section>
  </div>`;
}

// tabela compacta e somente-leitura (Data/Descrição/Valor/Status + total no rodapé)
function roTableHTML(rows, type) {
  if (!rows.length) {
    return emptyBox(finIcon, type === 'income' ? 'Sem entradas no filtro.' : 'Sem saídas no filtro.');
  }
  const total = rows.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const cls  = type === 'income' ? 'pos' : 'neg';
  const sign = type === 'income' ? '' : '−';
  return `<div class="table-wrap"><table class="data">
    <thead><tr><th>Data</th><th>Descrição</th><th class="num">Valor</th><th>Status</th></tr></thead>
    <tbody>${rows.map((e) => {
      const parc = (e.installments || 1) > 1
        ? ` <span class="faint">(${e.installment_of}/${e.installments})</span>` : '';
      const desc = e.description || (type === 'income' ? 'Receita' : 'Despesa');
      return `<tr>
        <td class="nowrap" data-th="Data">${fmtDate(refDate(e))}</td>
        <td>${esc(desc)}${parc}</td>
        <td class="num ${cls}" data-th="Valor">${sign}${money(e.amount)}</td>
        <td data-th="Status">${e.paid
          ? '<span class="badge badge--success">pago</span>'
          : '<span class="badge badge--warning">pendente</span>'}</td>
      </tr>`;
    }).join('')}</tbody>
    <tfoot><tr>
      <td colspan="2"><strong>Total</strong></td>
      <td class="num ${cls}"><strong>${sign}${money(total)}</strong></td>
      <td></td>
    </tr></tfoot>
  </table></div>`;
}
```

## Passo 4 — Nova aba `paintGraficos`: barras (atual) + pizza

**Adicionar** estas funções (pode ser logo abaixo de `paintComparativo`). A de
barras é exatamente o gráfico por mês que hoje vive no Comparativo, agora
retornando string em vez de escrever no `pane`.

```js
// Gráficos: alterna entre barras (mês a mês) e pizza (entradas × saídas).
function paintGraficos(rows) {
  const view = state.grafView || 'barras';
  pane.innerHTML = `
    <div class="segmented segmented--sm mb-3" id="g-view">
      <button data-g="barras" class="${view === 'barras' ? 'active' : ''}">Barras</button>
      <button data-g="pizza"  class="${view === 'pizza'  ? 'active' : ''}">Pizza</button>
    </div>
    <div id="g-body">${view === 'pizza' ? pieHTML(rows) : barrasHTML(rows)}</div>`;
  pane.querySelector('#g-view').onclick = (e) => {
    const b = e.target.closest('[data-g]'); if (!b) return;
    state.grafView = b.dataset.g;
    paintGraficos(rows);
  };
}

// barras Receitas × Despesas por mês (era o conteúdo antigo de paintComparativo)
function barrasHTML(rows) {
  const byMonth = {};
  for (const e of rows) {
    const m = refDate(e).slice(0, 7); if (!m) continue;
    (byMonth[m] = byMonth[m] || { income: 0, expense: 0 })[e.type] += Number(e.amount) || 0;
  }
  const months = Object.keys(byMonth).sort().reverse().slice(0, 12);
  if (!months.length) return emptyBox(finIcon, 'Sem dados no período.');
  const max = Math.max(...months.map((m) => Math.max(byMonth[m].income, byMonth[m].expense)), 1);
  const bar = (v, cls) => `<div class="bar"><span class="bar__fill ${cls}" style="width:${(v / max * 100).toFixed(1)}%"></span><span class="bar__val">${money(v)}</span></div>`;
  return `<div class="panel"><div class="panel__title">Receitas × Despesas por mês</div>
    ${months.map((m) => {
      const d = byMonth[m]; const [y, mo] = m.split('-');
      return `<div class="panel__row" style="align-items:stretch; flex-direction:column; gap:6px">
        <strong>${mo}/${y}</strong>
        ${bar(d.income, 'pos')}${bar(d.expense, 'neg')}
        <span class="faint">Saldo: ${money(d.income - d.expense)}</span>
      </div>`;
    }).join('')}</div>`;
}

// pizza (donut) Entradas × Saídas do período filtrado — SVG inline, sem lib
function pieHTML(rows) {
  let inc = 0, exp = 0;
  for (const e of rows) {
    const v = Number(e.amount) || 0;
    if (e.type === 'income') inc += v; else exp += v;
  }
  const total = inc + exp;
  if (!total) return emptyBox(finIcon, 'Sem dados no período.');
  const r = 70, c = 2 * Math.PI * r;
  const incLen = (inc / total) * c;
  const pct = (n) => (n / total * 100).toFixed(0);
  // círculo base = saídas (danger); arco por cima = entradas (mauve)
  return `<div class="panel"><div class="panel__title">Entradas × Saídas</div>
    <div class="pie-wrap">
      <svg viewBox="0 0 180 180" class="pie" role="img" aria-label="Proporção entradas e saídas">
        <circle cx="90" cy="90" r="${r}" fill="none" stroke="var(--danger)" stroke-width="26" opacity="0.5"/>
        <circle cx="90" cy="90" r="${r}" fill="none" stroke="var(--color-mauve-500)" stroke-width="26" opacity="0.6"
          stroke-dasharray="${incLen.toFixed(2)} ${(c - incLen).toFixed(2)}" transform="rotate(-90 90 90)"/>
      </svg>
      <div class="pie-legend">
        <div><span class="dot pos"></span>Entradas <strong>${money(inc)}</strong> <span class="faint">(${pct(inc)}%)</span></div>
        <div><span class="dot neg"></span>Saídas <strong>${money(exp)}</strong> <span class="faint">(${pct(exp)}%)</span></div>
        <div class="faint">Saldo: ${money(inc - exp)}</div>
      </div>
    </div></div>`;
}
```

## Passo 5 — CSS (components.css)

Adicionar ao final do bloco de finanças/panel (perto das regras `.bar`/`.panel`):

```css
/* Comparativo: duas tabelas lado a lado (metade da tela cada) */
.compare-grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--sp-4); align-items: start; }
.compare-col { min-width: 0; }
.compare-col .panel__title { margin-bottom: var(--sp-3); }
@media (max-width: 900px) { .compare-grid { grid-template-columns: 1fr; } }

/* seletor menor dentro de Gráficos (não estica a largura toda) */
.segmented--sm { display: inline-flex; width: auto; }

/* pizza (donut) Entradas × Saídas */
.pie-wrap { display: flex; align-items: center; gap: var(--sp-5); flex-wrap: wrap; }
.pie { width: 180px; height: 180px; flex: 0 0 auto; }
.pie-legend { display: flex; flex-direction: column; gap: var(--sp-3); }
.pie-legend .dot { display: inline-block; width: 12px; height: 12px; border-radius: 3px; margin-right: var(--sp-2); vertical-align: -1px; }
.pie-legend .dot.pos { background: var(--color-mauve-500); opacity: 0.6; }
.pie-legend .dot.neg { background: var(--danger); opacity: 0.5; }
```

> Se `.data tfoot` não tiver estilo, o total já herda a tabela; opcionalmente
> destacar: `.data tfoot td { border-top: 2px solid var(--border); }`.

## Passo 6 — Verificação (rodar e conferir)

- `node --check assets/js/financeiro.js` deve passar sem erro.
- Abrir o Fluxo de Caixa e testar cada aba:
  - **Comparativo**: duas colunas (Entradas | Saídas), cada uma ~metade da tela,
    com total no rodapé; empilha em 1 coluna abaixo de 900px; sem checkbox nem
    botão excluir.
  - **Gráficos**: abre em **Barras** (o gráfico por mês de antes); alternar para
    **Pizza** mostra o donut Entradas × Saídas com legenda e percentuais.
  - Filtros (busca, status, período) refletem nas duas abas novas.
  - **Resumo**, **Entradas**, **Saídas**, **Planilha** continuam idênticos.
  - Exportar CSV / Sheets continuam operando sobre o filtro atual.
- Conferir que **nenhuma referência** à função antiga de barras ficou quebrada:
  `grep -n "paintComparativo\|barrasHTML\|pieHTML\|paintGraficos\|roTableHTML" assets/js/financeiro.js`.
- Verificar responsivo em ~1280px e ~768px (mobile empilha as colunas).

## Notas

- Nada de novo dado do Supabase — tudo usa `rows` já carregado e filtrado.
- Sem dependências externas; pizza é SVG puro (mantém o "sem build").
- `state.grafView` guarda a escolha Barras/Pizza durante a sessão da tela.

# Auditoria visual — Rodada 2 (Harmon IA)

**Status: fechado, pronto para execução.** Consolida a auditoria completa do usuário (todos os módulos, ~1314px e ~406px, medida no CSS/DOM computado) + 6 considerações adicionais enviadas em sequência. Cada item abaixo foi **conferido contra o código atual** (`tokens.css`, `layout.css`, `components.css`, `home.js`, `utils.js`, `app.js`, `estoque.js`, `configuracoes.js`, `schema.sql`) — a causa raiz e a correção já apontam arquivo/seletor/token exatos, não são só descrição do sintoma.

---

## 1. Correções críticas (Alta)

### 1.1 Ícones gigantes na Home ("Estoque crítico" / "Clientes para retorno")

**Causa raiz confirmada**: `icon()` (`utils.js`) devolve um `<svg viewBox="0 0 24 24">` cru, sem `width`/`height` — o tamanho sempre depende de uma regra CSS externa (é assim que `.mini__icon svg`, `.pill svg`, `.wa-link svg` e `.empty .icon svg` já fazem, cada um com seu próprio `width/height`). Só que `.panel__title` (`components.css:264`) nunca ganhou essa regra. Como `home.js` passou a colocar `${icon('box')}`/`${icon('bell')}` dentro do título (`home.js:113,124`), o SVG renderiza no tamanho intrínseco do navegador — daí os ~290px.

**Fix:**
```css
.panel__title {
  display: flex; align-items: center; gap: var(--sp-2);
  font-weight: var(--fw-600); margin-bottom: var(--sp-4);
}
.panel__title svg { width: 18px; height: 18px; flex-shrink: 0; color: var(--text-muted); }
```

### 1.2 Sidebar não colapsa de verdade no mobile + ícone errado no botão

**Causa raiz confirmada**: duas coisas empilhadas.
- `layout.css` já força `.shell { grid-template-columns: var(--sidebar-w-collapsed) 1fr }` abaixo de 1200px (media query no fim do arquivo) — ou seja, abaixo de 1200px a sidebar **já está sempre** no modo ícone-only (64px). O botão hambúrguer do header (`app.js:79-81`) só faz `toggle('collapsed')` na classe `.shell`, que essa media query sobrepõe — por isso ele "não faz nada" visível no mobile.
- O ícone usado é `icon('menu')` (3 barras, `app.js:80`) — um hambúrguer genérico. Não é o padrão certo pro que o botão deveria fazer.

**Fix:**
- Abaixo de ~900px, sidebar vira **drawer sobreposto** (off-canvas): `position: fixed; transform: translateX(-100%)`, com scrim/overlay; classe `.sidebar-open` no `.shell` traz ela pra `translateX(0)` por cima do conteúdo (não empurra layout). Isso libera 100% da largura pro conteúdo quando fechada — resolve item 1.3 (Agenda/Mês) na prática, já que hoje mesmo "colapsada" a sidebar ainda ocupa 64px fixos numa tela de 406px.
- Trocar o ícone: adicionar um novo path em `ICON_PATHS` (`utils.js`) no estilo "painel lateral" (retângulo com uma coluna à esquerda demarcada — o mesmo padrão do botão "Collapse sidebar" do Claude Code), e trocar `icon('menu')` → `icon('panel')` em `app.js:80`. Reservar `menu`/hambúrguer só se um dia for usado pra abrir um menu de opções de verdade (não para sidebar).

### 1.3 Overflow horizontal no mobile (Agenda/Mês, Fluxo de Caixa)

Duas causas raízes distintas, confirmadas em CSS:

- **Linha de abas (`.tabs`, `components.css:147`)**: `display:flex; gap: var(--sp-4)` sem `overflow-x` nem `flex-wrap` — em Fluxo de Caixa (5 abas: Resumo/Entradas/Saídas/Comparativo/Planilha) isso estoura a largura da tela e empurra "Planilha" pra fora. Fix: `.tabs { overflow-x: auto; flex-wrap: nowrap; scrollbar-width: none; } .tabs::-webkit-scrollbar { display:none; }` — vira scroll horizontal contido, sem quebrar layout da página.
- **Grid do calendário (`.ag-grid`, `components.css:301`)**: `grid-template-columns: repeat(7, 1fr)` fixo, sem fallback responsivo — em 406px, 7 colunas de dia não cabem. Fix: abaixo de ~600px, ou (a) envolver `.ag-grid` num container com `overflow-x: auto` e largura mínima de coluna (~90px), virando scroll horizontal contido só ali — ou (b) trocar a visão Mês por um layout de lista compacta nesse breakpoint (mais trabalho, melhor UX). Recomendo (a) como correção rápida e (b) como melhoria futura.
- **Título "Fluxo de Caixa" quebrando em 3 linhas**: `.header` (`layout.css:136`) tem `height: var(--header-h)` fixo (68px) e não tem `flex-wrap`; em 406px, título em `--fs-xl` (1.5rem) + padding lateral (`--sp-6`=32px) + botão de ação não cabem numa linha, o texto quebra e estoura a altura fixa do header. Fix: media query abaixo de ~480px reduzindo `.header__title` pra `--fs-lg` e `.header` padding pra `--sp-4`, e escondendo o texto de `#csvBtn` ("Exportar CSV" → só ícone, com `title` para acessibilidade) — libera espaço horizontal sem mexer no header em telas maiores.

---

## 2. Sistema de cor (Média/Alta — feature nova + correções relacionadas)

### 2.1 Diagnóstico: por que o verde aparece em 5 lugares diferentes

Todos os usos de verde reportados na auditoria (telefone/WhatsApp, gráfico "Receitas × Despesas", valores positivos, saldo) vêm do **mesmo token**, `--success: var(--color-success)` = `#4a7c59` (`tokens.css:73`), reaproveitado em contextos semanticamente diferentes: `.wa-link` (`components.css:285`, cor de marca do WhatsApp), `.bar__fill.pos` (`components.css:280`, barra de receita no comparativo), `.stat .value.pos` / `.pos` / `.badge--success` (valores monetários positivos). Isso confirma o item 14 da auditoria: é uma decisão de token, não 5 bugs soltos.

**Decisão**: manter `--success` como semântica financeira (recebido/saldo positivo) — é convenção universal de dinheiro e sai do escopo de "acento decorativo". Não usar `--success` em gráficos nem em elementos de marca:
- **Gráfico "Receitas × Despesas"** (`.bar__fill.pos`): trocar para `--color-accent-500` (a cor de destaque do app — ver seção 2.2), mantendo `--color-danger` nas despesas. Só valores/saldo continuam em verde/vermelho.
- **Telefone/WhatsApp** (`.wa-link`): dar um token próprio, `--whatsapp: #4a7c59` (mesmo verde, mas dissociado de `--success`) — é convenção de marca reconhecível, defensável mesmo fora da paleta rosé; separar o token evita que uma mudança de semântica financeira no futuro mude sem querer a cor do WhatsApp (e vice-versa).

### 2.2 Feature nova: cor de destaque personalizável (5 opções)

Hoje o acento (`--accent`, banner, abas ativas, chip "hoje") vem inteiramente de 4 tokens crus — `--color-mauve-100/300/500/700` (`tokens.css:17-20`) — e **nada mais no CSS referencia mauve fora deles** (confirmado: só `.segmented button.active`, `.tab` ativo via `--accent`, gradiente do `.hero`, chip "hoje" da Agenda, e os overrides de `theme.css` no modo escuro). Ou seja, o app já foi construído "theme-able" por acidente — dá pra expor isso como preferência do usuário sem reescrever componente nenhum.

**Design proposto:**
- 5 paletas, no mesmo formato de `--color-mauve-100/300/500/700` (suave / claro / médio / texto-sobre-acento), usando as 5 amostras enviadas: `rose` (atual), `sand` (bege/creme), `sky` (azul claro), `lilac`, `mint`.
- Cada paleta vira um bloco `[data-accent="sand"] { --color-mauve-100: ...; --color-mauve-300: ...; --color-mauve-500: ...; --color-mauve-700: ...; }` num arquivo novo (`accent.css`, carregado depois de `tokens.css`) — não precisa tocar `components.css` nem `home.js`; tudo que já usa `--accent`/`--color-mauve-*` muda sozinho.
- Persistência: reaproveitar exatamente o padrão que já existe pra tema escuro — `user_settings` (`schema.sql:25`) ganha coluna nova `accent text default 'rose'`; `configuracoes.js` grava com o mesmo `upsert` que já faz pra `theme` (`configuracoes.js:64-69`); `app.js` aplica `document.documentElement.dataset.accent = settings.accent` no boot, ao lado de `applyTheme()`.
- UI em Configurações → Aparência: 5 círculos de amostra (não dropdown) ao lado do toggle de tema escuro existente, com o círculo ativo marcado (borda ou check). Clique salva na hora, sem precisar de botão "Salvar" separado (mesmo comportamento do toggle de tema).

**Correção que se resolve de graça com isso**: os badges dos 3 mini-cards da Home (item 2 da auditoria — hoje usam `--pill-blue-bg`/`--pill-tan-bg`/`--pill-peach-bg`, que são tokens de categoria, não de acento) devem trocar para tons de `--color-mauve-100`/`--color-mauve-300` (ex. `mauve-100` nos 3, ou variando 100/200/300 pra diferenciar visualmente sem sair da paleta) — assim eles acompanham a cor de destaque escolhida pelo usuário automaticamente, em vez de ficarem hardcoded em azul/bege.

---

## 3. Componentes a padronizar (Média)

### 3.1 Toggle estilo Apple (segmented control) em "Novo lançamento"

O toggle Receita/Despesa hoje usa a classe `.segmented` (`components.css:80-86`), a mesma dos seletores de visão da Agenda (Lista/Dia/Mês) — só que ali funciona bem (3 opções, texto curto) e em "Novo lançamento" (2 opções, um dos labels focável) o resultado visual ficou quebrado. Antes de mexer no CSS, confirmar no dev tools **se o toggle de Receita/Despesa realmente usa `.segmented`** ou se é uma implementação solta só daquele formulário — se for a segunda, a correção certa é migrar pra `.segmented` em vez de inventar um terceiro estilo.

Direção de estilo "Apple" pedida pelo usuário: fundo neutro (`--surface-2`), indicador com `border-radius: var(--radius-pill)` que desliza com `transition: transform` (em vez de re-pintar o fundo do botão clicado), sombra leve só no indicador ativo. Aplicar como o único padrão de toggle do sistema — inclusive o de tema claro/escuro (`.switch`, já existente) deve usar a mesma lógica visual de indicador deslizante, não dois componentes com filosofias diferentes.

### 3.2 Unificar abas: `.tabs` (sublinhado) vs `.segmented` (pill preenchida)

Confirmado no CSS: `.tabs`/`.tab` (`components.css:147-149`, sublinhado) é usado em Fluxo de Caixa e Histórico; `.segmented` (`components.css:80-86`, pill preenchida em `--accent`) é usado em Estoque/Serviços/Agenda. São dois componentes de abas coexistindo sem motivo funcional aparente (nenhum dos dois contextos exige um estilo diferente do outro).

**Decisão**: escolher `.segmented` (pill) como padrão único — é o que já está correto/bonito na maioria dos módulos (3 de 5) — e migrar Fluxo de Caixa e Histórico pra ele. Com 5 abas em Fluxo, `.segmented` + o fix de overflow do item 1.3 (`overflow-x:auto`) resolve os dois problemas juntos.

### 3.3 Formulário "Registrar movimentação" (drawer de item do Estoque)

**Causa raiz confirmada**: o form usa `class="field-row"` (`estoque.js:139`), a mesma classe do formulário "Novo item" que o usuário elogiou como referência. A diferença não é a classe — é o conteúdo: `.field-row > .field { flex: 1 }` (`components.css:60-61`) divide o espaço **igualmente** entre filhos, e essa linha específica tem 4 campos (`Tipo`, `Quantidade`, `Valor pago total (R$)`, `Observação` com `flex:2` inline) **mais** o botão "Registrar" fora de um `.field`, tudo `nowrap` — num drawer estreito isso espreme demais, e o label "Valor pago total (R$)" (mais longo que os outros) quebra em 4 linhas, desalinhando o campo mesmo com `align-items:flex-end` no form.

**Fix, sem tocar `.field-row` global** (não quebrar "Novo item", que já funciona):
- Dividir em duas linhas: linha 1 = `Tipo` + `Quantidade` + `Valor pago (R$)` (label encurtado, cabe numa linha) em `.field-row`; linha 2 = `Observação` (`flex:1`, sem `flex:2`) + botão "Registrar" alinhado à direita, fora do fluxo dos campos.
- No `<select name="type">`, adicionar `min-width: 120px` pra nunca cortar "Entrada" em "En".
- Mover a `<span class="hint">` de dentro do `.field` do valor pago pra baixo da linha inteira (`<p class="hint">`), já que hoje ela concorre por largura com o próprio input.

### 3.4 Hierarquia de botões (modal de detalhe da Agenda, drawer de Clientes)

Sem mudança de token, só de classe aplicada: no modal de detalhe do evento, "Fechar" deve virar `.btn--ghost` (neutro, sem preenchimento escuro) e a ação destrutiva "Cancelar agend." deve usar um estilo de alerta discreto — `.btn--ghost` com `color: var(--danger)` — nunca a mais apagada das três. No drawer de Clientes, "Agendar" (ação mais comum) vira `.btn--primary`; "Novo procedimento" e "Editar" continuam `.btn--secondary`/`.btn--ghost`.

---

## 4. Redução de stroke nos cards (Média — direção estética geral)

**Escopo confirmado**: as classes com `border: 1px solid var(--border)` que representam "cards"/superfícies de conteúdo são `.card`, `.stat`, `.mini`, `.panel`, `.table-wrap` (`components.css:49,96,103,256,263,122`). **Não** inclui inputs/select/textarea, `.autocomplete__list` nem `.toast` — esses usam borda por razão funcional (delimitar área clicável/editável ou se destacar como overlay), não é o "genérico" que o usuário quer evitar.

**Fix**: nas 5 classes de card, remover `border` e manter/reforçar `box-shadow: var(--shadow-sm)` como único separador visual (`.mini` já tem os dois — é redundante, mantém só a sombra). Resultado esperado: cards "flutuam" sobre o fundo cinza claro em vez de serem demarcados por contorno — mais alinhado à referência "Coursue" que já guiou o resto do redesign.

```css
.card, .stat, .mini, .panel, .table-wrap {
  border: none;
  box-shadow: var(--shadow-sm);
}
```
Vale conferir visualmente depois — `--shadow-sm` (`0 1px 2px rgba(26,26,24,0.04)`) é bem sutil; se ficar fraco demais sem a borda, ajustar pra algo entre `--shadow-sm` e `--shadow`.

---

## 5. Polish (Baixa)

| Item | Causa raiz confirmada | Fix |
|---|---|---|
| Ícone de Configurações | `settings` (`utils.js`) é um círculo + 8 linhas radiais — visualmente um "sol", não uma engrenagem/ferramenta. `app.js:18` mapeia `configuracoes: { icon: 'settings' }` | Adicionar novo path `tool` (chave inglesa) em `ICON_PATHS`; trocar `icon: 'settings'` → `icon: 'tool'` em `app.js:18` |
| "✦" no título da Home | Caractere unicode literal em `home.js:86` (`Olá, ${esc(name)} ✦`) — diferente do logo da sidebar, que já usa `icon('sparkle')` corretamente (`app.js:78`) | Trocar por `${icon('sparkle')}` (mesmo ícone do logo) ou remover |
| Contraste do cinza secundário | `--text-faint: var(--color-gray-400)` = `#9e9892`, 2.60:1 sobre branco (abaixo de AA) — usado em `.hint`, `.faint`, `.badge--muted`, `.nav__icon` (estado inativo), e-mail do usuário na sidebar | Escurecer `--color-gray-400` para algo em torno de `#7d766e` (~4.5:1+); reconferir contraste antes de finalizar |
| Filtros do Histórico quebrando em 2 linhas | 5 campos (cliente/serviço/status/data de/data até) num único `.module__toolbar` sem largura suficiente | Duas alternativas: (a) unificar as 2 datas num único campo "Período" com dois inputs lado a lado rotulados "de"/"até"; (b) mover cliente/serviço/status pra um popover "Filtros" e deixar só o período visível na barra principal. Recomendo (a) — menor mudança, resolve o wrap sem esconder filtros atrás de clique extra |
| Divergência de dados na Home | Não é bug visual — `home.js` já calcula receita/despesa por `paid_at` no mês corrente (regime de caixa, `home.js:47-51`) e "próximos agendamentos" filtra `status='scheduled'` (`home.js:54-57`); se Fluxo de Caixa mostra R$800 recebido e a Home mostra R$0, ou os dados de teste não têm `paid=true`+`paid_at` no mês, ou a Agenda tem eventos só no Google Calendar sem uma linha correspondente em `procedures` (ver `revisao-aprimoramentos-dashboard.md`, seção 1.1 — isso é esperado até a arquitetura de `schedule_procedure` ser implementada) | Não é fix de design — investigar dado de teste antes de mexer em código |
| Duração inconsistente em Serviços | Provável dado faltando (`duration_minutes` nulo em 2 dos 3 registros de teste) | Conferir dado, não é bug de layout |
| Dots de categoria em Serviços | Cores soltas (roxo/âmbar/verde), fora de `--pill-*` | Migrar pra `--pill-blue`/`--pill-tan`/`--pill-peach` (já existentes, usados em outros lugares do app) em vez de cor livre |

---

## 6. Ordem de execução recomendada

1. **Design system primeiro** (evita retrabalho, mesmo raciocínio da Rodada 1): seção 2 (cor de destaque + separar `--whatsapp` de `--success`) → seção 4 (remover stroke) → seção 3.1/3.2 (toggle + abas unificadas). Isso já resolve, de graça, os itens de "cor fora da paleta" espalhados pela auditoria.
2. **Home**: 1.1 (ícones) + badges dos mini-cards (resolvido junto com a seção 2.2).
3. **Mobile**: 1.2 (drawer real da sidebar) → 1.3 (overflow de abas/grid/header). Fazer nessa ordem porque a sidebar em drawer já libera boa parte da largura que hoje causa overflow.
4. **Formulários**: 3.3 (movimentação de estoque) + 3.4 (hierarquia de botões).
5. **Polish** (seção 5): a qualquer momento, baixo risco/baixo acoplamento entre si.

**Pendente de decisão do usuário antes de implementar**: nome/hex exatos das 5 paletas de acento (seção 2.2 — hoje só temos as amostras visuais, não os hex; medir com conta-gotas como foi feito na Rodada 1) e confirmação de que o toggle "quebrado" de Receita/Despesa (3.1) já usa `.segmented` ou é implementação solta — isso muda se o fix é CSS puro ou também HTML/JS do formulário.

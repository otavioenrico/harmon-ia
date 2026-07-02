# Rodada 6 — Prompt de execução (colar no terminal / Claude Code)

> Como usar: abra uma sessão do Claude Code na raiz do projeto Harmon IA e cole
> este arquivo inteiro como prompt. Dado o volume (bugs + 2 padrões sistêmicos
> + 4 módulos + redesign de login), comece em **plan mode** antes de codar —
> mesmo padrão das Rodadas 4 e 5 (ver HISTORICO.md).

---

Você vai executar a **Rodada 6** de aprimoramentos do Harmon IA. Todos os
itens abaixo já foram levantados e confirmados com o usuário (Otávio) numa
sessão de triagem — não é preciso reconfirmar escopo, só as decisões técnicas
de implementação que ficarem em aberto. Investigação prévia no código já
localizou a causa raiz de 2 dos 3 bugs; use isso como ponto de partida, mas
confirme lendo o código atual antes de aplicar (o repositório pode ter mudado).

Execute em **4 fases**, nessa ordem. Rode `node --check` em cada arquivo `.js`
tocado antes de passar pra próxima fase. Não faça commit/push/deploy — pare
para revisão visual do usuário no fim, como nas rodadas anteriores.

---

## FASE 1 — Bugs críticos (bloqueantes)

### 1.1 Agenda quebrada: `ReferenceError: evs is not defined`
**Arquivo:** `assets/js/agenda.js`, função `load()`, ~linha 130.

**Causa raiz já identificada:** em `load()`, dentro do loop `for (let hop = 0; ; hop++)`,
o `const [evs, procs] = await Promise.all([...])` é declarado **dentro do bloco
`try { }`** (linha ~116). Logo depois do `catch`, na linha ~130, há
`if (autoAdvance && state.view === 'list' && !evs.length && ...)` — essa
referência a `evs` está **fora** do bloco `try`, e `const`/`let` são escopados
ao bloco onde nascem. Resultado: `ReferenceError` sempre que esse `if` executa
(ou seja, sempre que a carga é automática — boot inicial e botão "Hoje").

**Fix:** trocar `!evs.length` por `!state.events.length` na linha 130 (já é
atribuído dentro do try, linha ~123 — `state.events = evs`). Não precisa
declarar `evs` fora do bloco.

**Teste:** abrir Agenda (view Lista) numa semana sem nenhum evento — deve
avançar semana a semana automaticamente (até 8 semanas) sem erro no console,
e sem cair na tela genérica "Não foi possível carregar este módulo."

### 1.2 Fluxo de Caixa "não está funcionando"
**Arquivo:** `assets/js/financeiro.js`. Sem stack trace capturado ainda —
`node --check` está limpo (não é erro de sintaxe), então é runtime ou dado.

Passos:
1. Reproduza no browser: abra Fluxo de Caixa, teste as 5 abas (Resumo,
   Entradas, Saídas, Comparativo, Planilha), capture console + network.
2. Hipóteses a checar primeiro: erro no embed aninhado da query
   (`procedures(price_charged, procedure_materials(...))`, linha ~102), RLS
   bloqueando esse embed pra alguma linha, ou `lucroOf()`/`paintComparativo()`
   quebrando com dado nulo/inesperado.
3. Se for o mesmo padrão do item 1.1 (variável presa em escopo de `try{}`
   referenciada fora), procure o mesmo padrão em outros módulos antes de dar
   por fechado.
4. Corrija conforme o achado real — não adivinhe sem reproduzir.

**Achado-bônus na mesma varredura (corrigir de brinde, mesma vizinhança):**
`assets/js/historico.js`, ~linha 115, no tratamento de erro de `load()`:
`tbody.innerHTML = ''` — mas o elemento nesse escopo se chama `tableWrap`, não
`tbody`. `tbody` não existe ali; isso dispara um 2º `ReferenceError` que
mascara qualquer erro real de carga do Histórico. Trocar `tbody` por
`tableWrap`.

---

## FASE 2 — Padrões sistêmicos (afetam múltiplos módulos — resolver uma vez, aplicar em todos os lugares)

### 2.1 Barra de filtros desalinhada (Histórico > Procedimentos e Fluxo de Caixa)
**Causa raiz:** `.filters` em `assets/css/components.css:270` é
`display:flex; flex-wrap:wrap; margin-left:auto`, sem estrutura de grid. Com
4–5 controles (busca + 1–2 selects + 2 campos de data), o wrap quebra de forma
irregular — o(s) último(s) campo(s) "sobra(m)" numa segunda linha desalinhada
à esquerda, sem alinhar com nada acima. É exatamente o que aparece nos 2
prints do usuário (Procedimentos e Fluxo de Caixa: o segundo `dd/mm/aaaa`
flutua solto). Já foi mexido na Rodada 5 (item 4, tirou o scroll horizontal
feio) mas o wrap ainda fica torto.

**Fix:** redesenhar `.filters` para que, ao quebrar linha, quebre em bloco
alinhado — não em sobra solta. Duas abordagens combináveis:
- Grid responsivo (`display:grid` com colunas definidas e `gap`) em vez de
  flex-wrap cru, garantindo que os campos da "segunda linha" ocupem largura
  cheia/alinhada.
- Breakpoint que empilha os filtros em coluna única e largura 100% abaixo de
  uma certa largura de tela, em vez de deixar o flex decidir sozinho onde
  quebrar.

Aplica-se ao mesmo `.filters` usado por `historico.js` (`#h-filters`) e
`financeiro.js` (`#f-filters`) — um fix no CSS cobre os dois; valide
visualmente nos dois módulos, em desktop e em uma largura estreita.

**Busca ampliada (Histórico > Procedimentos):** hoje `#f-cli-q`
(`historico.js`, ~linha 82–90) filtra só por `clients.name`
(`state.qCliente`). Amplie para casar também nome do serviço, status e valor
— mesmo espírito do que `financeiro.js` já faz (`#f-q`, linhas 91–92, que já
busca descrição **e** nome do cliente). Troque o placeholder "Buscar
cliente…" por algo como "Buscar por cliente, serviço…".

### 2.2 Modais e drawers com scroll feio — aplicar em TODOS os pop-ups
**Causa raiz:**
- `.modal` (`components.css:181-184`): `max-height:88vh; overflow-y:auto` no
  container inteiro. Cabeçalho/rodapé já são `position:sticky` (mitiga um
  pouco), mas a barra de rolagem pertence visualmente ao card inteiro,
  tocando os cantos arredondados.
- `.drawer` / `.drawer--center` (`components.css:206-216`): pior — é um único
  bloco sem separação cabeçalho/corpo (`openDrawer()` em `assets/js/utils.js:190`
  recebe um `bodyEl` cru), então `overflow-y:auto` rola cabeçalho, botões,
  abas e lista tudo junto. É exatamente o caso do print da ficha da cliente
  Tayana Domiciano.

**Fix estrutural:**
- CSS: `.modal` e `.drawer`/`.drawer--center` passam a
  `display:flex; flex-direction:column; overflow:hidden` com altura máxima
  fixa (mantendo ~88vh). Dentro, só a região de conteúdo (`.modal__body`, já
  existe — e uma nova `.drawer__body`) recebe
  `overflow-y:auto; flex:1; min-height:0`.
- JS: `openDrawer()` em si não muda de assinatura — quem monta o `bodyEl`
  (perfil de cliente em `clientes.js`, item de estoque em `estoque.js`)
  precisa estruturar o próprio conteúdo com um bloco fixo no topo
  (avatar/dados/botões/abas) fora de um `<div class="drawer__body">` que
  envolve só a tabela (Procedimentos/Financeiro no cliente; movimentações no
  estoque).
- Revise também os `openModal()` com corpo potencialmente longo (registro de
  procedimento, novo cliente, novo item de estoque, lançamento manual):
  cabeçalho/rodapé fixos, só o miolo do formulário rola se passar de 88vh.

**Teste:** abrir o perfil de uma cliente com 10+ procedimentos — cabeçalho
(nome, telefone, e-mail, CPF, endereço, botões, abas) fica fixo; só a tabela
rola, com a barra de rolagem restrita à área da tabela, sem tocar os cantos
arredondados do card.

---

## FASE 3 — Ajustes por módulo

### 3.1 Serviços: cards → lista em linha
**Arquivo:** `assets/js/servicos.js` (grid `.card-grid`, `components.css:114`).

Trocar a listagem em `.card-grid` por `table.data` — mesmo padrão de
`historico.js` / `financeiro.js` / `clientes.js`: colunas Serviço (dot de cor
+ nome), Preço, Duração, Status (badge "inativo" quando aplicável). Clique na
linha abre o mesmo `openForm()` de edição que já existe. Preserve: color
picker, filtro Ativos/Inativos/Todos, busca por nome — só a apresentação da
listagem muda.

### 3.2 Dashboard — "Próximos agendamentos" vira tabela
**Arquivo:** `assets/js/home.js`, painel principal (~linhas 143–152).

Trocar os `.panel__row` empilhados por `table.data` com colunas: **Cliente**,
**Procedimento**, **Duração**, **Data**. `whenLabel()` já calcula a duração
(`dur`, em minutos) mas hoje embute no texto ("às 09:00 (60min)") — separe em
coluna própria (ex.: "60 minutos", ou "—" quando não houver evento do
Google/sem duração).

### 3.3 Dashboard — "Clientes para retorno": procedimento + botão ✓ + recorrência real 1/3/6/12 meses
**Arquivos:** `assets/js/home.js` (~linhas 166–175) e, por reaproveitamento,
`assets/js/historico.js` (`paintRetornos`, ~linhas 205–247) e `db/schema.sql`
(tabela `return_dismissals`, ~linhas 178–185).

**Gap de schema encontrado (importante, não é só CSS/JS):**
`return_dismissals` hoje tem `unique(user_id, client_id, service_id)` — um
dismissal por par cliente+serviço, **sem marco de tempo**. Isso significa que
confirmar "Concluir" em Histórico > Retornos hoje silencia **todos** os
marcos (1/3/6/12 meses) até o próximo procedimento — não só o marco atual.
Isso contraria diretamente o pedido do usuário: *"se ele apareceu com 1 mês
e eu dei o ok, ele deve aparecer novamente com 3 meses."* Precisa de migração:

- Adicionar coluna `months integer not null` em `return_dismissals`.
- Trocar a constraint para `unique(user_id, client_id, service_id, months)`.
- Migração idempotente, no mesmo padrão do resto do arquivo (bloco de
  `alter table ... add column if not exists` já existe mais abaixo no
  schema — adicione junto).
- Atualizar o upsert em `historico.js` (`paintRetornos`) para incluir
  `months: state.retMonths` e o `onConflict` para
  `'user_id,client_id,service_id,months'`; o filtro de "já dispensado" passa
  a comparar pelo marco específico, não só pelo par cliente+serviço.

**Dashboard (`home.js`):** trocar a lógica atual (≥60 dias corridos, só por
cliente, sem serviço) pela lógica de `historico.js` (por cliente+serviço,
marcos 1/3/6/12 meses via `return_dismissals` já com a coluna `months`). Como
o dashboard mostra no máximo ~6 linhas e não tem seletor de marco, mostre por
cliente+serviço o **menor marco vencido e ainda não dispensado** (ex.: se já
passou de 3 meses mas só foi dispensado no marco de 1 mês, mostra o de 3
meses).

**UI da linha:** nome da cliente + nome do serviço (novo) + "há N dias" +
botão WhatsApp (mantém) + botão **✓** no lugar do X (grava o dismissal com o
marco atual — mesmo endpoint/upsert de `historico.js`; vale extrair pra um
helper compartilhado em `utils.js` se ficar duplicado).

**Teste:** cliente com procedimento há 95 dias (passou de 3 meses) e nenhum
dismissal → aparece com marco "3 meses". Confirmar (✓) → só volta a aparecer
depois de 6 meses (180 dias).

### 3.4 Dashboard — atalho "Ver agenda de hoje"
**Arquivo:** `assets/js/home.js` (hero, ~linhas 129–134) e `assets/js/agenda.js`.

Adicionar um 5º botão no hero, ao lado de "Agendar": **"Ver agenda de hoje"**
(ícone de calendário/relógio). Ação: gravar `sessionStorage.setItem('intent:agendaHoje', '1')`
e `ctx.navigate('agenda')` — mesmo padrão dos outros `intent:*` já existentes
no arquivo. Em `agenda.js`, no `render()` (mesmo ponto onde os outros intents
já são lidos/limpos), ler esse flag e, se presente, forçar
`state.view = 'day'` com `state.cursor = new Date()` (já é o default) e
sincronizar visualmente o botão ativo do `#ag-view` antes do primeiro `load()`.

---

## FASE 4 — Tela de Login / Início (`index.html` + `assets/css/layout.css` `.login*`)

**Referência aprovada pelo usuário:** card dividido em 2 colunas, flutuando
sobre um fundo com gradiente suave desfocado — inspirado em
`app.academypass.ai/login`, mas em **tema claro** e com a paleta/tokens do
Harmon IA (não a paleta escura da referência).

**Coluna esquerda (formulário):**
- Saudação (ex.: "Olá, novamente") + subtítulo.
- Campo Email.
- Campo Senha, com link "Esqueceu senha?" alinhado à direita do label, e
  ícone de olho para mostrar/ocultar.
- Botão primário largo "Entrar →".
- Divisor "ou".
- Botão "Entrar com Google" — **reaproveitar exatamente o handler atual**
  (`signInWithGoogle()` em `index.html`), sem alterar o fluxo de auth.
- Link secundário "Criar conta" abaixo.

**Coluna direita:** visual abstrato (linha estética/moda/design, paleta
rosa/creme da marca). Como o projeto é sem build e sem pipeline de imagens
externas, gere o visual como **SVG/gradiente inline** (zero dependência
externa, fácil de trocar depois por uma foto real — o usuário já avisou que
pode substituir). Logo "Harmon IA" em marca d'água no canto, no mesmo espírito
da referência.

**Estilo geral:** cantos arredondados, sombra suave, cartão sobre fundo com
gradiente sutil desfocado (usar tokens existentes — paleta mauve de
`accent.css`, `--radius-xl`, `--shadow`, fonte Satoshi já carregada em
`tokens.css`). Responsivo: em telas estreitas, a coluna direita (imagem)
some e o card vira só a coluna do formulário, centralizada.

**Importante — escopo do formulário nesta rodada:** os campos Email/Senha,
"Criar conta" e "Esqueci minha senha" são **apenas visuais**. A autenticação
real do app é 100% Google OAuth (ver `README.md` — multi-tenant por conta
Google, sem tabela de usuários com senha no `db/schema.sql`). **Não
implemente submit/validação real** desses campos — deixe desabilitados ou, se
submetidos, mostre um toast "Em breve". O botão Google continua sendo o único
fluxo funcional, sem nenhuma mudança de comportamento.

---

## Fechamento (fazer sempre, no fim)

1. `node --check` em todos os `.js` tocados.
2. Revisar manualmente qualquer alteração em `db/schema.sql` (migração de
   `return_dismissals`) — deve ser idempotente e não quebrar bancos já
   implantados (mesmo padrão das migrações anteriores no arquivo).
3. Registrar uma seção **"Rodada 6"** em `HISTORICO.md`, seguindo o padrão
   das rodadas anteriores (Contexto / Feito / Verificação / Decisões-pegadinhas
   / Pendente-próximo).
4. **Não** fazer commit/push/deploy automaticamente — parar para revisão
   visual do usuário (ele confere em ambiente real antes do próximo passo,
   mesmo padrão de todas as rodadas anteriores).

## Decisões já fechadas com o usuário (não perguntar de novo)

- Atalho novo do dashboard: **"Ver agenda de hoje"**.
- Visual da coluna direita do login: **abstrato**, linha estética/moda/design,
  substituível depois pelo usuário.
- Campos de login por e-mail/senha ficam **só visuais** nesta rodada — auth
  real continua exclusivamente Google.
- "Clientes para retorno": recorrência real em 1/3/6/12 meses (não é feature
  nova do zero — é extensão de uma lógica que já existe em
  `historico.js` > Retornos, hoje incompleta por causa do gap de schema
  descrito na Fase 3.3).

## Itens em aberto para você decidir durante a execução (sem necessidade de
## voltar a perguntar ao usuário, salvo se achar algo que muda o escopo)

- Fase 1.2 (Fluxo de Caixa): causa raiz não confirmada — reproduza antes de
  corrigir.
- Fase 2.1: escolha entre grid responsivo vs. breakpoint de empilhamento (ou
  os dois) para `.filters` — qualquer solução que elimine o "campo solto"
  visto nos prints é aceitável.

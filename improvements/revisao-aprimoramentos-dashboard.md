# Revisão crítica — Aprimoramentos do Dashboard (Harmon IA)

**Status: fechado, pronto para execução.** Análise do `aprimoramentos-dashboard.md` contra o código atual (schema, módulos JS, CSS), com todas as decisões de arquitetura e pontos em aberto já resolvidos em conversa com o usuário.

---

## 1. As 3 decisões de arquitetura que precisavam ser fechadas

### 1.1 Google Calendar fica "raso"; o resto mora só no Supabase

Pergunta do usuário: dá pra manter no Google Calendar só as informações básicas (cliente/serviço/data/hora — o que já vai hoje) e guardar valor, custo e materiais **só no banco**, sem nunca mandar isso pro Google? Sim — e isso é exatamente o desenho certo, porque resolve o conflito sem reabrir a decisão da Etapa 1 na prática: o Calendar continua vendo só `summary`/`description`/`start`/`end`, do jeito que é hoje. O que muda é que, **junto** com a criação do evento no Google, o agendamento passa a gravar uma linha em `procedures` com `status='scheduled'` (esse valor já existe no enum do schema, nunca foi usado até agora) — e é ali, no Supabase, que valor/custo/materiais ficam.

Design resultante:
- **Agendar** (novo): cria o evento no Google (como hoje) **e** chama uma RPC nova, `schedule_procedure`, que grava `procedures` (status scheduled, price_charged, google_event_id) + `procedure_materials` (reserva do que será usado, com o custo já "congelado") + `financial_entries` (categoria "Agendamentos", `paid=false`) — **sem** tocar `stock_items.quantity` nem gravar `stock_transactions` ainda. Isso evita o problema que eu tinha levantado: cancelamento/no-show não deixa o estoque errado, porque nada foi debitado de verdade.
- **Completar** (automático, ao passar a data — ou manual, com um botão): uma segunda RPC, `complete_procedure(procedure_id)`, debita o estoque dos materiais reservados (aí sim cria `stock_transactions` + decrementa `quantity`), muda `status` para `completed`, e aplica **a mesma regra que já existe hoje** em `register_procedure` — à vista (pix/dinheiro/débito) marca `paid=true` na hora de completar; crédito/parcelado continua pendente, precisa de "Dar baixa" manual como sempre. Isso já resolve a mistura que eu tinha apontado entre "realizado" e "pago": não é uma regra nova, é a regra de pagamento existente aplicada no momento da conclusão em vez do momento do registro.
- **Cancelar** (exclusão do evento no Google, fluxo que já existe em `removeEvent`): passa a também marcar `procedures.status='cancelled'` e remover os `financial_entries` pendentes ligados àquele `procedure_id` (nunca foi receita real). Estoque nunca foi tocado, então não tem o que desfazer.
- **"Automático" continua sendo "calculado quando a tela abre"** (ver seção 1.2) — ao carregar Agenda ou Histórico, uma passada busca `procedures` com `status='scheduled' AND date < hoje` e chama `complete_procedure` pra cada uma.

Efeito colateral bom: hoje a edição de um evento (Etapa 6) usa título livre porque "não dá pra remapear cliente/serviço com segurança" a partir do texto do Google. Com `procedures` existindo desde o agendamento, valor/materiais/pagamento passam a ser editáveis direto na linha do banco (via `google_event_id`), independente do texto do evento — a limitação de remapeamento continua existindo só pro *texto* do Google, não pros dados de negócio.

Isso desbloqueia 7 (WhatsApp), 8 (valor/custo + fluxo de caixa), 9 (Histórico unificado — agora "agendado" tem de fato uma linha em `procedures` pra aparecer ao lado de "realizado") e 14 (materiais) como um desenho único e coerente, em vez de 4 pontos soltos.

### 1.2 "Automático" não existe automático de verdade — só sob demanda
Não há cron/job agendado no projeto (só uma função serverless, para refresh do token do Google; Vercel Hobby não roda cron arbitrário). Três itens pedem coisas "automáticas por tempo":
- Item 8: marcar como pago/realizado depois que a data passar.
- Item 9: lembretes de retorno em 1/3/6/12 meses.
- Item 17: expirar rascunhos após 7 dias.

Nada disso pode rodar sozinho em segundo plano. Tudo precisa ser **calculado no momento em que a tela abre** (mesmo padrão já usado na aba Reativação de Histórico: "último procedimento há X dias"). Ou seja: dá pra fazer, mas é "quando a profissional abrir o app" e não "às 00h do dia seguinte". Vale alinhar expectativa.

Também não existe canal de notificação (e-mail, push, SMS). O item 9 diz "notifica a profissional" — hoje isso só pode ser um badge/lista dentro do app (como o badge de estoque em falta), não uma notificação de verdade fora do app. Se o objetivo é alcançar a profissional mesmo com o app fechado, é escopo novo (integração de e-mail, por exemplo).

### 1.3 O redesign (item 5) é o item que dita a ordem de tudo
Item 5 pede layout de 3 colunas (hoje é 2: sidebar + conteúdo — ver `app.html`/`layout.css`) e paleta rosé/mauve (hoje é preto/bege, ver `tokens.css`). Isso toca literalmente todo módulo existente. Os itens 4 (remover bolinhas), 10 (botão de recolher) e 18 (ícones) são subconjuntos desse mesmo trabalho.

**Faltou o anexo**: o documento cita "referência visual fornecida", mas nenhuma imagem chegou junto com o `.md`. Preciso da referência antes de especificar tokens (tom exato do rosé/mauve, proporção da 3ª coluna, o que mora nela por padrão).

**Sugestão de ordem**: fechar o design system novo (5+4+10+18) primeiro, depois construir/mexer em conteúdo por cima dele. Se a ordem for invertida, cada módulo tocado agora (Financeiro em abas, Home, Agenda) é construído no visual atual e re-pele depois — trabalho em dobro.

---

## 2. Item a item

**Item 1 — Home/Overview.** Baixo risco. Todos os dados já existem e a lógica de "estoque crítico" e "clientes sem retorno" já está implementada (estoque.js `isLow`, historico.js aba Reativação) — é reaproveitar, não criar do zero. **Confirmado**: Home vira a rota padrão no lugar de Agenda (`app.js` linha 97, hoje `location.hash || 'agenda'`).

**Item 2 — Ficha de inscrição.** Detalhado pelo usuário: (a) telefone na listagem de Clientes vira link direto pro WhatsApp; (b) endereço ganha campo de complemento. Baixo risco, ambos pontuais:
- **(a)** `clientes.js` já importa/usa o padrão de link do WhatsApp em outro módulo (`waLink()` de `utils.js`, hoje usado só em Histórico/Reativação) — é trocar a célula de telefone na tabela (`row()`, hoje texto puro) por um `<a href="${waLink(c.phone)}" target="_blank">`. Único cuidado técnico: a linha inteira já é clicável (abre o perfil em drawer, via `tbody.onclick`), então o link precisa de `stopPropagation` pra não abrir o perfil junto — mesmo padrão já usado em `agenda.js` pra separar o botão de excluir do clique na linha.
- **(b)** Não existe campo de complemento hoje — schema tem `address_street`, `address_number`, `address_city`, `address_state`, `address_zip`, sem complemento (apto, bloco, referência). Precisa de uma coluna nova (`address_complement text`) em `clients` (migração simples no `schema.sql`), mais o campo no formulário (ao lado de "Número") e na montagem da string de endereço exibida no perfil (`openProfile`, variável `addr`).
- **Confirmado sem ação necessária**: o usuário perguntou se, ao clicar no nome da cliente na lista, já abre um painel com dados + histórico de procedimentos com data. **Já existe** — `openProfile()` abre um drawer lateral com dados cadastrais e as abas Procedimentos (data/serviço/valor/lucro) e Financeiro. Não é um popup central, é um painel lateral, mas cumpre a mesma função; nenhuma mudança necessária aqui.

**Item 3 — Agenda em lista por padrão.** Parte já está pronta: `agenda.js` já abre em `view: 'list'` por padrão, e a lista já é agrupada por dia. O que falta de fato: um terceiro modo **Dia** (hoje só tem Lista/Mês) e a **barra de busca**. Ponto de atenção na busca: eventos do Google Calendar guardam só o texto do `summary` (ex. "Botox — Maria"), não o `client_id`/`service_id` — e no modo de edição o título vira livre (decisão da Etapa 6, porque não dá pra remapear com segurança). Ou seja, buscar "por cliente" na prática é busca textual no título, e quebra se a profissional editar o título livremente. Vale documentar essa limitação em vez de prometer busca estruturada.

**Item 4 — Remover bolinhas do menu.** Trivial (é o `nav__badge` em `app.js`, hoje só usado no item Estoque). Só atenção: hoje é o único aviso de estoque em falta fora do módulo Estoque. Se sair antes do item 1 (Home) existir, a profissional perde esse alerta até abrir Estoque manualmente. Sugiro remover só depois que a Home cobrir "estoque crítico".

**Item 5 — Redesign.** Ver seção 1.3. Maior item da lista em superfície de mudança; tratar como fase própria.

**Item 6 — Thumbnail no estoque.** `photo_url` já existe na tabela, mas hoje só é exibido na gaveta de detalhe, via signed URL gerada sob demanda (bucket é privado de propósito). Colocar na listagem significa gerar N signed URLs (uma por item com foto) toda vez que a lista carrega — para um catálogo pequeno de clínica é tranquilo, mas vale cachear a URL por sessão em vez de regerar a cada render/filtro.

**Item 7 — WhatsApp no agendamento.** Baixo risco. Já existe o helper `waLink()` e o padrão de uso (reaproveitado da aba Reativação). `agenda.js` já carrega `phone` dos clientes. É só compor a mensagem e reaproveitar.

**Item 8 — Valor/custo + integração automática com Fluxo de Caixa.** Resolvido pelo desenho da seção 1.1: `schedule_procedure` já cria o lançamento em "Agendamentos" pendente; `complete_procedure` aplica a regra de pagamento existente (à vista confirma, crédito/parcelado continua pendente) no momento da conclusão. Nenhuma regra nova de negócio — só o RPC de registro de procedimento virando dois passos.

**Item 9 — Histórico unificado + lembretes.** Resolvido pelo desenho da seção 1.1: com `procedures` existindo desde o agendamento (`status='scheduled'`), Histórico já tem o que precisa pra listar agendados e realizados juntos — é filtro/coluna de status na listagem que já existe, não schema novo. Lembretes de retorno: ver 1.2 — dá para fazer como uma view calculada (nova aba, no molde de Reativação), não como notificação externa.

**Item 10 — Botão de recolher.** Cosmético, baixo risco isoladamente, mas depende da nova estrutura de sidebar do item 5 (senão é retrabalho). Bundlar com 5.

**Item 11 — Fluxo de Caixa em abas.** Baixo/médio risco. Não precisa de mudança de schema — hoje tudo já vem de uma única query em `financeiro.js` (`state.all`) e os totais já são calculados em memória; é reorganizar a apresentação em abas (Resumo/Entradas/Saídas/Comparativo/Planilha) por cima do que já existe.

**Item 12 — Toggle Receita/Despesa.** Esclarecido: o comportamento descrito ("um fica nas receitas, outro nas despesas, são cálculos diferentes") já é exatamente o que `financeiro.js` faz hoje — o campo `type` (`income`/`expense`) do lançamento decide em qual bucket ele entra e quais dos 4 stat-cards ele alimenta (Recebido/A receber somam só `income`; Despesas soma só `expense` pago; ver `paintStats`). Ou seja, **nada novo a construir aqui** além da troca visual de `<select>` por toggle — a lógica de cálculo separado que o usuário quer já existe.

**Item 13 — Custo por unidade no estoque.** Aqui o formulário já tem um campo "Custo unitário (R$)" (`cost_price`), mas ele é preenchido manualmente — hoje não existe captura de "preço de compra total" nem de "quantidade comprada nessa entrada" (a movimentação de Entrada só pede quantidade + observação, sem valor). Calcular `preço ÷ quantidade` automaticamente exige adicionar um campo de valor às movimentações de entrada e decidir a regra quando há compras em preços diferentes ao longo do tempo: custo da última compra, ou custo médio ponderado? Isso é uma pergunta de regra de negócio, não só de UI.

**Item 14 — Materiais no agendamento.** Resolvido pelo desenho da seção 1.1: materiais entram como reserva em `procedure_materials` no agendamento (custo já calculado pra exibir "Faturamento − Custo = Lucro"), e só viram débito real de estoque (`stock_transactions` + decremento de `quantity`) quando `complete_procedure` roda. Cancelamento/no-show nunca chega a debitar.

**Item 15 — Autocomplete de cliente.** Baixo risco, boa melhoria de UX (hoje é `<select>` simples com todos os clientes ativos). Vale construir como componente único em `utils.js` desde já — Histórico e o próprio Agendamento usam a mesma seleção de cliente hoje, então um componente compartilhado evita duplicar (mesmo raciocínio que já levou `openDrawer` a ser promovido de `clientes.js` pra `utils.js` na Etapa 3).

**Item 16 — Remover dupla confirmação ao cancelar.** **Confirmado: escopo global.** O `confirm()` de "descartar alterações" sai de `openModal()` (`utils.js`) — hoje é comportamento compartilhado por todo modal do sistema (cliente, estoque, financeiro, procedimento, agendamento). Remover ali tira a proteção contra perda de dados digitados em **todos** os formulários, não só no de agendamento — é a troca consciente que o usuário quer.

**Item 17 — Rascunhos de agendamento.** Maior item novo isolado da lista, mas contido: precisa de uma tabela nova (ex. `agenda_drafts`, com RLS igual às demais) já que o rascunho não pode virar evento no Google (poluiria a agenda real) nem linha em `procedures`. Expiração de 7 dias, pela limitação da seção 1.2, é filtro no momento da leitura (ou um delete lazy ao abrir o menu de rascunhos), não um job de limpeza rodando sozinho.

**Item 18 — Emojis → Iconoir.** Mecânico mas espalhado — emojis estão embutidos como caracteres direto nas strings em quase todo módulo (`app.js`, `agenda.js`, `estoque.js` etc.) e em botões de ação (🗑, ⎋, ☰). Como o projeto é **sem build**, a forma de trazer o Iconoir importa: ícone via CDN/web font (mais simples, mas depende de request externo) vs. SVGs inline self-hosted (sem dependência externa, mais consistente com o resto do projeto que não depende de CDN além de fontes do Google e do esm.sh do Supabase). Recomendo decidir isso junto com o item 5, porque o novo design system vai definir tamanho/cor padrão dos ícones de qualquer forma.

---

## 3. Decisões finais — referência para execução

| # | Ponto | Decisão |
|---|---|---|
| 1 | Arquitetura do agendamento (itens 7, 8, 9, 14) | Google Calendar só com dado raso (cliente/serviço/data/hora); `procedures` nasce no agendamento via `schedule_procedure` (status `scheduled`, sem debitar estoque); `complete_procedure` debita estoque e confirma pagamento à vista quando a data passa ou por ação manual |
| 2 | "Automático" nos itens 8/9/17 | Sem cron no projeto — tudo calculado ao abrir a tela (mesmo padrão da aba Reativação), não em horário fixo. Sem canal de notificação externo (só in-app) |
| 3 | Referência visual / design system (item 5) | Recebida; specs completos em `design-system-redesign-specs.md` |
| 4 | Item 2 (Ficha de inscrição) | Telefone vira link de WhatsApp na listagem de Clientes; endereço ganha campo de complemento (`address_complement`, coluna nova) |
| 5 | Home como rota padrão (item 1) | Sim — substitui Agenda como tela inicial |
| 6 | Item 12 (toggle Receita/Despesa) | Comportamento já existe hoje (`type` income/expense já alimenta cálculos separados); só falta trocar `<select>` por toggle visual |
| 7 | Item 16 (dupla confirmação ao cancelar) | Escopo global — sai de `openModal()` (`utils.js`), afeta todos os modais do sistema, não só o de agendamento |
| 8 | Tipografia (design system) | Font stack de sistema (`-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`) no lugar de Raleway — ver seção 0 de `design-system-redesign-specs.md` |
| 9 | Sequenciamento | Design system (itens 5+4+10+18) primeiro; conteúdo/comportamento por cima depois, pra não retrabalhar visual |

**Todos os pontos em aberto do briefing original estão fechados.** Os dois documentos (`revisao-aprimoramentos-dashboard.md` e `design-system-redesign-specs.md`) refletem o estado final combinado com o usuário.

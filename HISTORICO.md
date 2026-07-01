# Histórico de Desenvolvimento — Harmon IA

Registro do que foi feito em cada janela de contexto. **Cada etapa = uma sessão.**
Para registrar uma nova etapa, peça "registre o que foi feito até aqui" e eu
adiciono uma seção `## Etapa N` no fim deste arquivo.

---

## Etapa 1 — Análise (Fase 0) + Fundação, Auth, Shell e primeiros módulos
**Data:** 2026-06-29

### Análise crítica e decisões
Antes de codar, análise dos riscos do escopo. Principais achados e decisões
(usuário deu liberdade para escolher os defaults):
- **Token do Google não renova no frontend estático** → vai precisar de função
  serverless (`api/google-refresh.js`) com o client secret. `refreshSession()`
  renova só o JWT do Supabase, não o token do Google.
- `provider_refresh_token` exige `access_type=offline` + `prompt=consent`.
- `procedure_materials` precisava de `user_id` para a RLS funcionar.
- Registro de procedimento deve ser **RPC atômica** (evita escrita parcial/corrida).
- Google Calendar = fonte única; `procedures` nasce só no registro.
- Financeiro: à vista = pago; crédito/parcelado = pendente.
- Agenda v1: só views Lista + Mês.

### Feito
- **Banco** (`db/schema.sql`): todas as tabelas com `user_id`, RLS (USING +
  WITH CHECK) em todas, triggers de `updated_at`, índices, RPC
  `register_procedure` (procedimento + materiais + débito de estoque +
  lançamentos financeiros, atômico) e bucket `uploads` com policy por usuário.
- **Design system** (`assets/css/`): `tokens.css`, `layout.css`,
  `components.css`, `theme.css`. Raleway 200–500, paleta da marca, cards 8px,
  tema claro/escuro.
- **Auth** (`assets/js/auth.js`, `supabase.js`): login Google com Calendar no
  mesmo consentimento, offline+consent, captura e persistência do refresh token.
- **Shell** (`app.html`, `assets/js/app.js`): sidebar, roteador por hash,
  colapso responsivo, rodapé com avatar/logout, badges de navegação.
- **Utils** (`assets/js/utils.js`): moeda, datas (sem bug de fuso), máscaras
  tel/CPF, toast, modal com confirmação, skeleton, CSV com BOM, download.
- **Módulo Serviços** (`servicos.js`): CRUD completo, busca, filtro, color
  picker, inativação. É o padrão de referência dos demais módulos.
- **Módulo Configurações** (`configuracoes.js`): conta, status Google, toggle de
  tema persistido em `user_settings`, backup JSON.
- Stubs navegáveis para Agenda, Clientes, Estoque, Histórico, Financeiro.
- Infra: `vercel.json`, `.env.example`, `config.example.js`, `.gitignore`,
  `README.md` com checklist de setup (Supabase + Google + Vercel).

### Pendente / próximo
- Módulos: **Clientes**, **Estoque**, **Histórico**, **Fluxo de Caixa**, **Agenda**.
- `api/google-refresh.js` (serverless) + `google-cal.js`.
- Polish: export CSV completo, skeletons finos, animações.
- **Bloqueio de teste:** usuário precisa rodar o setup do `README.md` (passos 1–6).

### Contrato dos módulos (para continuidade)
Cada `assets/js/<modulo>.js` exporta `render(root, ctx)`, com
`ctx = { session, settings, actions, navigate, setBadge }`. Referência: `servicos.js`.

---

## Etapa 2 — Módulo Clientes
**Data:** 2026-06-29

### Feito
- **Módulo Clientes** (`assets/js/clientes.js`, substituiu o stub):
  - **Listagem** em `table.data`: nome (com badge "inativa"), telefone, e-mail,
    cidade, último procedimento e total. Busca por nome/telefone/e-mail
    (debounce 300ms) e ordenação por nome / cadastro / último procedimento.
    Botão "+ Nova Cliente" em `ctx.actions`, skeleton no load e estado vazio.
  - Os campos "último" e "total" vêm de `procedures` agregados por cliente numa
    **única query** via embed `clients.select('*, procedures(date)')`; busca e
    ordenação rodam em memória (re-render do `<tbody>`, sem novo fetch).
  - **Criar/Editar** em modal (`openModal`, wide): nome*, telefone (maskPhone),
    e-mail, nascimento (`input date`), CPF (maskCPF), endereço completo,
    observações e switch Ativa/Inativa. Valida nome; insere/atualiza `clients`.
  - **Perfil** em drawer lateral (`.drawer` sobre `.modal-overlay`, ESC/clique-fora
    fecham): dados cadastrais + abas **Procedimentos** (data, serviço, valor e
    lucro = preço − custo de materiais via embed `procedure_materials`) e
    **Financeiro** (`financial_entries` do `client_id`, com status pago/pendente).
    Botões **Agendar** e **Novo procedimento** gravam a intenção em
    `sessionStorage` (`intent:agendar` → `navigate('agenda')`,
    `intent:procedimento` → `navigate('historico')`) — só o lado Clientes; o
    destino lê isso quando esses módulos existirem.
- Helper local `openDrawer()` reaproveitando o CSS pronto (`.drawer` + backdrop
  `.modal-overlay`). Não foi pra `utils.js` ainda — promover se outro módulo usar.

### Verificação
- `node --check assets/js/clientes.js` → OK.
- Asserts das partes não triviais (data mais recente, sorters, lucro) passaram.

### Pendente / próximo
- Próximo: **Estoque** (não iniciado — não cabia inteiro nesta janela). Inclui
  upload de foto/NF pro bucket `uploads` (`<uid>/arquivo`), alerta de
  `min_quantity`, `marketplace_links` (jsonb) e lista de compras.
- Depois: **Histórico** (RPC `register_procedure`, lê `intent:procedimento`),
  **Fluxo de Caixa**, **Agenda** (lê `intent:agendar`; `api/google-refresh.js` +
  `google-cal.js`).
- Nota p/ continuidade: os dois `sessionStorage` (`intent:agendar`,
  `intent:procedimento`) guardam o `client_id` e devem ser **lidos e limpos**
  pelos módulos Agenda e Histórico ao abrir.

---

## Etapa 3 — Módulo Estoque
**Data:** 2026-06-29

### Feito
- **Módulo Estoque** (`assets/js/estoque.js`, substituiu o stub):
  - **Lista** em `table.data`: item, quantidade (+unidade), mínimo, custo e
    status. Item abaixo/igual ao mínimo aparece com quantidade em vermelho e
    badge "em falta". Filtro segmentado Todos / Em falta / Inativos e busca por
    nome (debounce 300ms, em memória). Botões "+ Novo Item" e "Lista de compras"
    em `ctx.actions`.
  - **Criar/editar** em modal wide: nome*, descrição, quantidade (inicial no
    criar; no editar fica travada — muda só por movimentação), mínimo, unidade,
    custo, **marketplace_links** (editor dinâmico de linhas nome+URL → jsonb),
    upload de **foto** e **NF** e switch ativo.
  - **Upload** pro bucket privado `uploads` em `<uid>/<uuid>-<arquivo>`; guarda
    o *path* na coluna (não URL). Exibição via `createSignedUrl` (1h) na hora.
  - **Movimentações** em drawer (reaproveita `openDrawer`, agora no utils):
    Entrada (compra, soma), Saída/descarte (subtrai) e Ajuste (informa a
    contagem nova → grava o delta como `in`/`out`). Cada uma insere em
    `stock_transactions` e atualiza `stock_items.quantity`; bloqueia saldo
    negativo. Drawer mostra foto/NF, links de recompra e o histórico do item.
  - **Lista de compras** (modal): agrega itens abaixo do mínimo com quanto
    comprar e os botões de marketplace; exporta CSV (helper do utils).
  - **Badge de alerta**: `ctx.setBadge('estoque', nº em falta)` a cada load do
    módulo; `app.js` ganhou `refreshStockBadge()` no boot p/ já mostrar a
    contagem antes de abrir o módulo.
- **Refactor**: `openDrawer` saiu do `clientes.js` (era local) e foi promovido
  para `utils.js` — agora estoque e clientes importam o mesmo helper.

### Verificação
- `node --check` nos 4 arquivos tocados (estoque, clientes, utils, app) → OK.
- Asserts da lógica não trivial (regra `isLow` com `<=` e numeric-como-string;
  matemática de entrada/saída/ajuste e saldo negativo) passaram.

### Decisões / ponytail
- Movimentação é read-then-write client-side (lê a quantidade carregada e
  regrava). Single-tenant owner, sem corrida real; se virar multi-dispositivo,
  migrar p/ RPC atômica como a `register_procedure`.
- Estoque inicial vai direto na coluna `quantity` no cadastro; o histórico de
  `stock_transactions` começa no 1º movimento (não cria tx "inicial").
- Destaque de falta = badge + quantidade em vermelho (zero CSS novo).

### Pendente / próximo
- Próximo: **Etapa 4 — Histórico/Registro** (`historico.js`): consome e limpa
  `intent:procedimento`, fluxo que chama a RPC `register_procedure` (cliente,
  serviço, data, valor, **seleção de materiais do estoque**, pagamento à vista
  vs parcelado), listagem com filtros e aba de reativação (`waLink` no utils).
- Depois: **Fluxo de Caixa** e **Agenda** (`api/google-refresh.js` +
  `google-cal.js`; lê `intent:agendar`).

---

## Etapa 4 — Histórico / Registro de Procedimento
**Data:** 2026-06-29

### Feito
- **Módulo Histórico** (`assets/js/historico.js`, substituiu o stub). Duas views
  num `.segmented`:
  - **Procedimentos**: lista (data, cliente, serviço, valor, **lucro** = preço −
    custo congelado dos materiais via embed `procedure_materials`). Filtros por
    cliente, serviço e período (de/até) — todos **em memória** sobre um único
    fetch (mesmo padrão de `clientes.js`). Botão "+ Novo procedimento" em
    `ctx.actions`.
  - **Reativação**: clientes ativos cujo último procedimento passou de X dias
    (input, default 60), ordenados pelos mais parados, com botão **WhatsApp**
    (`waLink` + mensagem pronta). Último por cliente computado em memória.
- **Registro (RPC)**: modal wide chama `supabase.rpc('register_procedure', …)`
  (atômico). Campos: cliente*, data* (hoje), serviço* (sugere `default_price`),
  valor, **materiais usados** (linhas dinâmicas item+qtd, com baixa de estoque),
  pagamento e observações.
  - **Materiais**: select dos `stock_items` ativos mostrando saldo; valida saldo
    insuficiente client-side antes de chamar a RPC (a RPC não trava negativo).
  - **Pagamento**: à vista (pix/dinheiro/débito) → `p_paid=true`, 1 lançamento;
    crédito → pendente, 1 lançamento com vencimento; **parcelado** → mostra nº de
    parcelas (mín. 2) e 1º vencimento, `p_paid=false`, N parcelas mensais. A RPC
    só respeita `p_paid` quando `installments=1`.
- **intent:procedimento**: ao abrir o módulo, lê e **limpa** o gancho do
  `sessionStorage` deixado por Clientes e já abre o registro com a cliente
  pré-selecionada.

### Verificação
- `node --check assets/js/historico.js` → OK.
- Self-check (asserts) da lógica não trivial: derivação dos args de pagamento
  (paid/parcelas/vencimento por método), lucro = preço − custo, e filtro de
  reativação (último por cliente + dias ≥ limite) → todos passaram.

### Decisões / ponytail
- Listagem busca tudo e filtra em memória (consistente com Clientes); vira
  view/RPC se acumular milhares de procedimentos.
- Validação de saldo é client-side; a `register_procedure` confia no chamador
  (não trava estoque negativo, ao contrário das movimentações do Estoque).
- Badge de estoque não é reatualizado na hora do registro — recarrega quando o
  módulo Estoque abrir de novo.

### Pendente / próximo
- Próximo: **Etapa 5 — Fluxo de Caixa** (`financeiro.js`): lista de
  `financial_entries` com filtros período/status, baixar parcela (paid/paid_at),
  lançamento manual (receita/despesa), stat-cards (recebido/a receber/despesas/
  saldo) e export CSV. As parcelas pendentes do registro já caem aqui.
- Depois: **Etapa 6 — Agenda** (`api/google-refresh.js` + `google-cal.js`; lê
  `intent:agendar`; views Lista+Mês) e **Etapa 7 — Polish**.

---

## Etapa 5 — Fluxo de Caixa
**Data:** 2026-06-29

### Feito
- **Módulo Financeiro** (`assets/js/financeiro.js`, substituiu o stub):
  - **Lista** de `financial_entries` (parcelas vindas do registro de
    procedimento + lançamentos manuais) em `table.data`: data, descrição (com
    `(n/total)` quando parcelado), cliente (embed `clients(name)`), forma de
    pagamento, valor (despesa em vermelho com "−", receita em verde), status
    (badge pago/pendente) e botão **Dar baixa** nas pendências.
  - **Filtros** em memória (mesmo padrão de historico/clientes, fetch único):
    tipo (receita/despesa), status (pendente/pago) e período de/até. Data de
    referência da linha = `due_date` senão `created_at` (`refDate`).
  - **Stat-cards** (`.stat-cards` do design system), recalculados sobre o
    filtro atual: Recebido (receitas pagas), A receber (receitas pendentes),
    Despesas (despesas pagas) e Saldo (recebido − despesas). Despesa pendente
    não entra no saldo até a baixa.
  - **Dar baixa**: `update {paid:true, paid_at:hoje}` no lançamento (confirm
    antes). As parcelas pendentes do procedimento são quitadas aqui.
  - **Lançamento manual** (modal wide): tipo, valor* (`parseMoney`), descrição,
    categoria, forma (sem "parcelado" — parcelado estruturado nasce do
    procedimento), data e switch "Já pago/recebido" (define `paid`+`paid_at`).
    Insere com `user_id: ctx.session.user.id` (RLS).
  - **Export CSV** (`toCSV`/`download` do utils) do conjunto filtrado.

### Verificação
- `node --check assets/js/financeiro.js` → OK.
- Self-check (asserts) da lógica não trivial: `refDate` (fallback p/ created_at),
  filtros (status/período/tipo) e os 4 totais dos stat-cards (incl. despesa
  pendente fora do saldo) → todos passaram.

### Decisões / ponytail
- Lançamento manual é sempre 1 parcela; parcelados estruturados continuam vindo
  só da RPC `register_procedure`.
- Stats e "Despesas" contam só o que está `paid` (regime de caixa); pendências
  ficam em "A receber" / fora do saldo até a baixa.
- Reusa o `.switch` do design system (zero CSS novo).

### Pendente / próximo
- Próximo: **Etapa 6 — Agenda** (`api/google-refresh.js` serverless com o client
  secret + `google-cal.js`; lê e limpa `intent:agendar`; views Lista+Mês).
  Atenção à pegadinha do `provider_token` do Google (ver memória de decisões).
- Depois: **Etapa 7 — Polish**.

---

## Deploy / Setup de produção — Passos 1–7 (CONCLUÍDO ✅)
**Data:** 2026-06-30

Primeira sessão de "mão na massa" do usuário (Otávio): sair do código pronto para
o ambiente no ar. Guia seguido: `SETUP.md`. Credenciais reais salvas em
`credenciais/CREDENCIAIS.md` (pasta criada e adicionada ao `.gitignore` — não
versiona).

### Feito
- **Passo 1 — Supabase:** projeto `harmon-ia` criado (região São Paulo).
  - `ref = cheglxwbposkrwwxdeam` · URL `https://cheglxwbposkrwwxdeam.supabase.co`.
  - `db/schema.sql` rodado no SQL Editor → **Success** (tabelas, RLS, RPC
    `register_procedure` e bucket `uploads` criados).
  - Nota: o Supabase mudou a tela de API keys. Usamos a **anon key legada**
    (formato `eyJ...`, aba "Legacy anon, service_role API keys"), não a nova
    `sb_publishable_...`, para casar com o que o código (`@supabase/supabase-js@2`
    via esm.sh) e o `api/google-refresh.js` esperam.
- **Passo 5b (adiantado) — config.js:** criado `assets/js/config.js` com
  `SUPABASE_URL` + `SUPABASE_ANON_KEY` (vai pro git de propósito; anon key é
  pública, RLS protege).
- **Passo 2 — GitHub:** código enviado para
  `https://github.com/otavioenrico/harmon-ia` (branch `main`).
  - A `.git` local estava com `index.lock` travado e sem permissão de remoção no
    mount; contornado copiando o projeto para área limpa, `git init` novo e push.
    Push feito com Personal Access Token temporário do usuário (revogável); o
    remote com token foi removido após o push. `credenciais/` ficou de fora.
- **Passo 3 — Vercel:** importado via "Continue with GitHub", deploy sem build
  (site estático). Produção no ar: **`https://harmon-ia-rouge.vercel.app`**
  (o domínio `harmon-ia` puro estava em uso → Vercel sufixou com `-rouge`).

### Feito (continuação — Passos 4 a 7)
- **Passo 4 — Google Cloud:** projeto `Harmon IA` com **Google Calendar API**
  ativada. Tela de consentimento OAuth (no console novo = "Google Auth Platform")
  configurada: tipo **Externo**, app `Harmon IA`, escopo `.../auth/calendar` (em
  "Acesso a dados"), `otavio.enrico@gmail.com` como **usuário de teste** (em
  "Público-alvo"). Credencial **ID do cliente OAuth (Aplicativo da Web)** criada:
  - Origens JS: `http://localhost:8000` e `https://harmon-ia-rouge.vercel.app`
    (sem barra final).
  - Redirect URI: `https://cheglxwbposkrwwxdeam.supabase.co/auth/v1/callback`.
  - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` salvos no `CREDENCIAIS.md`.
- **Passo 5 — Supabase:** Authentication → Providers → **Google** ativado com
  Client ID/Secret. URL Configuration: Site URL `https://harmon-ia-rouge.vercel.app`
  e Redirect URLs `http://localhost:8000/` e `https://harmon-ia-rouge.vercel.app/`
  (**com** barra). Obs.: o painel deu um "Failed to fetch (api.supabase.com)"
  transitório ao salvar Redirect URLs — resolveu recarregando e tentando de novo.
- **Passo 6 — Vercel:** 4 env vars (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
  `SUPABASE_URL`, `SUPABASE_ANON_KEY`) adicionadas em **Production** + **redeploy**.
  Obs.: nesta versão da Vercel as env vars ficam dentro de **Settings →
  Environments**; o seletor de ambientes ficou travado em Production (plano
  Hobby) — suficiente, pois o site público roda em produção.
- **Passo 7 — Teste fim a fim:** login com Google OK (tela "confiar no
  desenvolvedor" → Continuar), caiu no painel. Serviços, Clientes e Agenda
  testados; **agendamento criado apareceu no Google Calendar** — integração
  confirmada ponta a ponta. Estoque/Histórico/Fluxo de Caixa navegáveis.

### Status final
**App no ar e funcional:** https://harmon-ia-rouge.vercel.app

### Lembretes para o uso real (futuro)
- **Modo Teste no Google:** só e-mails na lista de "Usuários de teste" (até 100)
  conseguem entrar. Antes do 1º login da profissional, adicionar o e-mail dela em
  Google Auth Platform → Público-alvo → Usuários de teste. (Publicar/verificar o
  app remove esse limite, mas exige processo de verificação do Google.)
- **Se trocar o domínio da Vercel:** atualizar a URL em 3 lugares — Origens JS +
  Redirect no Google Cloud, URL Configuration no Supabase, e Site URL.
- **`provider_token` do Google expira ~1h:** a renovação depende da função
  serverless `api/google-refresh.js` (Etapa 6 do dev) + das env vars da Vercel.

---

## Etapa 6 — Agenda + Integração Google
**Data:** 2026-06-30

### Contexto
A sessão anterior já havia escrito 3 dos 4 arquivos (`api/google-refresh.js`,
`google-cal.js`, `agenda.js`) mas foi interrompida antes de finalizar: faltavam a
edição de evento, o botão "Reconectar Google", e os registros em HISTORICO/PLANO.
Esta etapa revisou os arquivos prontos e completou o que faltava.

### Feito
- **`api/google-refresh.js`** (serverless Vercel, já estava pronto — revisado):
  troca o `google_refresh_token` por um `access_token` fresco (~1h) do Google.
  Lê o refresh token via PostgREST com o **próprio JWT do usuário** (RLS devolve
  só a linha dele; o token nunca passa pelo browser). Usa o `client_secret` (env
  da Vercel), sem dependências (só `fetch`). Respostas: `409 no_refresh_token`
  → precisa reconectar; `502 google_refused`; `Cache-Control: no-store`.
- **`assets/js/google-cal.js`** (wrapper, revisado + **`updateEvent` adicionado**):
  - `token()` pega o access_token de `/api/google-refresh` e **cacheia em memória**
    até ~1min antes de expirar; `409` vira `NeedsReconnect`.
  - `listEvents(min,max)` (singleEvents+orderBy startTime), `createEvent`,
    **`updateEvent(id, {…})` via PATCH** (merge — manda só os campos enviados;
    `description:''` limpa a descrição no Google), `deleteEvent`.
  - Calendário fixo `primary`. **Sem** gravação no Postgres (agenda = fonte única).
- **`assets/js/agenda.js`** (revisado + **edição adicionada**):
  - Views **Lista** (semana, agrupada por dia) e **Mês** (grade 6×7), navegação
    ‹ › / Hoje, `NeedsReconnect` → tela "Conectar Google".
  - **`openForm` agora cria E edita**: `openForm(presetDay)` mostra selects de
    cliente/serviço (deriva o summary "Serviço — Cliente" e herda duração do
    serviço); `openForm(null, evento)` abre em modo edição com **título livre**
    pré-preenchido (não dá pra remapear cliente/serviço a partir do summary) +
    data/hora/duração derivadas do evento, e chama `updateEvent`.
  - `openDetail` ganhou botão **Editar** (além de Excluir / Abrir no Google).
  - Lê e **limpa** `intent:agendar` (client_id deixado por Clientes) ao abrir,
    pré-selecionando a cliente no novo evento.
- **`assets/js/configuracoes.js`**: card Google ganhou o botão **"Reconectar
  Google"** (confirm → `signInWithGoogle()`), substituindo o texto placeholder.

### Verificação
- `node --check` OK nos 4 arquivos (`google-refresh`, `google-cal`, `agenda`,
  `configuracoes`).
- Self-check (7 asserts) da lógica não trivial: `monthRange`/`weekRange`,
  agrupamento `byDay` (timed + dia inteiro), derivação data/hora/duração na
  edição com round-trip, `end = start + duração` + validação de data inválida,
  montagem do PATCH parcial do `updateEvent` (incl. `description:''` limpando) e
  o summary do modo criar com fallbacks → todos passaram.

### Decisões / pegadinhas
- **Token do Google não renova no frontend** (`refreshSession()` só renova o JWT
  do Supabase) → a função serverless com o `client_secret` é obrigatória. Cache
  do access_token em memória evita uma ida ao servidor a cada chamada.
- **Edição usa título livre**, não selects: o evento no Google guarda só o texto
  do summary, sem os IDs de cliente/serviço, então não há como remapear com
  segurança. Criar continua rico (selects → summary derivado).
- Agenda continua **fonte única**: nenhum evento vira `procedure` (isso nasce só
  no registro do Histórico). Sem sync bidirecional, como combinado.
- Eventos "dia inteiro" (de fora do app) ao serem editados viram evento com hora
  (default 09:00 / 60min) — caso de borda aceitável nesta v1.

### Pendente / próximo
- **Etapa 7 — Polish:** export CSV padronizado, skeletons finos, animações,
  responsivo mobile, acessibilidade e verificação fim-a-fim (cliente →
  procedimento → estoque → caixa → agenda) com dados reais.
- Lembrete de deploy: `git push` para o GitHub aciona o redeploy na Vercel; as
  env vars `GOOGLE_CLIENT_ID/SECRET` já estão lá (necessárias p/ a refresh).

### Deploy da Etapa 6 + reconciliação do Git (2026-06-30)
- Commit único da Etapa 6 (`cfad5a0`, root-commit) enviado ao GitHub.
- **Pegadinha:** a pasta local tinha histórico próprio (root-commit) e o GitHub
  tinha o "deploy inicial" antigo (`bb57c34`) com histórico **não relacionado** →
  o `git push` normal foi rejeitado (`fetch first`). Comparando os dois: o local
  era superconjunto atualizado; só existia no remoto o `.claude/settings.local.json`
  (config de máquina, descartável e já no `.gitignore`).
- Resolvido com **`git push --force-with-lease`**: a Etapa 6 virou o estado
  canônico no GitHub (`bb57c34` → `cfad5a0`). Redeploy na Vercel disparado pelo push.

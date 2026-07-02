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

## Rodada 3 — Acessibilidade, robustez de UX e motion polish (2026-07-01)

Auditoria dupla (design system via web-design-guidelines + camada JS/UX) seguida
de execução em 3 fases. Plano em `~/.claude/plans/elegant-toasting-sprout.md`;
galeria de verificação em `improvements/preview-rodada3.html` (sem Supabase).

### Fase 1 — Fundação de acessibilidade
- **`:focus-visible` global** (não havia NENHUM no app): anel `--focus-ring`
  (mauve-700, ≥3:1 em todas as 5 paletas de acento; mauve-300 no escuro), regra
  única em `layout.css`; caso especial p/ o switch (`input:focus-visible + .track`).
- **`prefers-reduced-motion`**: bloco global em `components.css` zera animações/
  transições (shimmer do skeleton vira estático).
- Tokens novos: `--overlay-bg` (modal-overlay + scrim), `--switch-thumb`,
  `--hero-text`; dark mode do hero desce o gradiente p/ 500→700 (texto claro legível).
- Shell: `<meta color-scheme>`, `<main>`, `<h1>` no header, `aria-label` no nav,
  `aria-label`+`aria-expanded` (sincronizado no JS) no botão da sidebar.
- Touch targets: `.btn--icon` 34→40px; `.modal__close` com área de 40px.

### Fase 2 — Robustez de UX
- **`confirmDialog()`** em utils.js (Promise<boolean>, foco no botão seguro,
  perigo em `.btn--danger`) — zero `confirm()` nativo restante. Usado em:
  cancelar agendamento, dar baixa, reconectar Google, excluir rascunho (que
  antes excluía SEM confirmação).
- **`guard(fn)`**: proteção de duplo clique nas ações diretas (cancelar,
  concluir, dar baixa, excluir rascunho).
- **Focus trap + restauração** em modal e drawer; ESC/keydown no overlay (não no
  document) → modais empilhados não fecham juntos; foco inicial no 1º campo do corpo.
- **Rollbacks**: agendar desfaz o evento Google se `schedule_procedure` falhar
  (sem órfão no calendário); estoque remove uploads se o insert falhar; tema/
  acento revertem o DOM se o upsert falhar.
- Reconexão Google com feedback: flag `google:reconnecting` em sessionStorage →
  toast de sucesso/aviso no boot do app.js.
- `emptyBox` promovido a utils.js (era duplicado em historico/clientes e
  improvisado inline); `scrollIntoView` no item ativo do autocomplete.

### Fase 3 — Motion polish
- Tokens: `--ease-out` (cubic-bezier .16,1,.3,1), `--dur-fast/base/exit`
  (160/200/150ms — saída sempre mais curta que entrada).
- **Saídas animadas** de modal/drawer/toast: keyframes só com `to` (partem do
  estado atual = interruptível; `reverse` inverteria a curva → ease-in, vetado),
  nó removido no `animationend` (fallback timeout + curto-circuito reduced-motion).
- Skeletons fiéis ao layout: Home (hero+minis+painéis fantasma) e Agenda (linhas
  de evento) — sem "pulo" na troca por conteúdo.
- Transição de rota: fade+rise 160ms/6px (ação frequente → discreta).
- Auto-review com o critério da skill review-animations pegou 2 achados
  (easing invertido na saída; rota longa demais) — corrigidos.

### Verificação (agent-browser, sem dados reais)
- Galeria + login: foco visível ✓, trap/ESC/restauração ✓, confirmDialog ✓,
  dark mode (hero legível) ✓, reduced-motion emulado (durações → 0.01ms) ✓.
- Screenshots: `improvements/rodada3-claro.png` / `rodada3-escuro.png`.

### Fora do escopo (registrado p/ depois)
Persistência de filtros, histórico de busca no autocomplete, preview de anexos,
UI otimista, RPC atômica p/ movimentação de estoque (comentário `ponytail:` mantido).

---

## Rodada 4 — Aprimoramentos de UI, 11 itens (2026-07-01)

### Contexto
Usuário revisou o app em uso real (screenshots) e levantou 11 ajustes pontuais
de UI/UX espalhados por Sidebar, Fluxo de Caixa, Clientes, Estoque, Agenda,
Configurações e Dashboard. Planejado em `plan mode`
(`~/.claude/plans/magical-beaming-narwhal.md`) antes de codar.

### Feito
1. **Sidebar**: botão de recolher movido de dentro do header para dentro da
   sidebar (mesma linha do logo, alinhado à direita); largura 240→272px
   (`tokens.css`, `layout.css`, `app.html`).
2. **Menu**: gap de 4px entre os itens do nav (`.nav` virou flex column com
   `gap: var(--sp-1)`).
3. **Fluxo de Caixa**: coluna **Lucro** na aba Entradas — lucro do
   procedimento rateado pela fração do valor que a parcela representa
   (`lucroOf()` em `financeiro.js`, join com `procedures`+`procedure_materials`).
4. **Clientes** e **5. Estoque**: `openDrawer()` (utils.js) ganhou opção
   `{ center: true }` → `.drawer--center` reaproveita o grid de centralização
   do `.modal-overlay` em vez de fixar à direita. Perfil de cliente e item de
   estoque agora abrem centralizados e maiores (640px). Thumbnail do estoque
   40→56px.
6. **Agenda**: edição completa de agendamento (cliente/serviço/materiais/
   pagamento) quando o procedimento ainda está `status='scheduled'` — antes só
   dava pra editar título/hora/notas/valor. Nova RPC
   `update_scheduled_procedure` (schema.sql): apaga e recria
   `procedure_materials` e as parcelas pendentes de `financial_entries`,
   espelhando `schedule_procedure`. Seguro porque nada foi debitado/pago
   ainda nesse status. `completed`/`cancelled` continuam com a edição
   restrita (consequências já aconteceram).
7. **Estoque — lista de compras**: passou a persistir adições manuais (nova
   tabela `shopping_list_items`, RLS padrão). Botão **"+ Adicionar produto"**
   no toolbar (busca via `clientAutocomplete` generalizado com placeholder
   customizável) e **"Lista de compras"** no drawer de cada item.
8. **Configurações**: campo **WhatsApp do administrador**
   (`user_settings.whatsapp_number`, `maskPhone`). Usado no CTA **"Enviar no
   WhatsApp"** da lista de compras (`waLink`) — só aparece se o número estiver
   preenchido.
9. **Filtros lado a lado**: nova classe `.filters` (`flex-wrap: nowrap` +
   `overflow-x: auto`, nunca empilha) aplicada em `financeiro.js` e
   `historico.js` (Clientes já usava um layout de 2 itens sem esse problema).
10. **Dashboard — atalhos rápidos**: hero ganhou 3 botões novos (Novo
    cliente/produto/lançamento) além do "Agendar", todos abrindo a criação
    **direto** via flags `intent:novo*` em `sessionStorage` lidas no fim de
    cada `render()` — mesmo padrão que `intent:agendar`/`intent:procedimento`
    já usavam.
11. **Dashboard — hero neutro**: gradiente mauve trocado por `var(--surface)`
    + borda + sombra (mesmo tratamento dos `.panel`/`.mini`); removido o
    override de dark mode do gradiente (`theme.css`) e o token órfão
    `--hero-text` (`tokens.css`).

### Verificação
`node --check` limpo nos 7 arquivos JS tocados (agenda, clientes, estoque,
financeiro, configuracoes, home, utils). SQL revisado manualmente: 6 funções
+ 2 blocos `do $$` = 8 `end $$;` (balanceado).

### Deploy
Commit `600e91d` (branch `main`) → push → deploy automático da Vercel
(integração GitHub) ficou **Ready** em produção em ~6s:
**https://harmon-ia-rouge.vercel.app**. Usuário já tinha rodado o
`db/schema.sql` atualizado no Supabase antes do push (idempotente: nova
tabela `shopping_list_items`, coluna `user_settings.whatsapp_number`, RPC
`update_scheduled_procedure`).

### Pendente / próximo
Verificação visual dos 11 itens direto na produção (não foi testado em
browser real nesta sessão — só `node --check` + revisão manual do SQL).

---

## Rodada 5 — Fonte Satoshi + 8 aprimoramentos de UX (2026-07-01)

### Fonte
Satoshi (variável, woff2, pesos 300–900) instalada em `assets/fonts/` (só os
2 arquivos web — `Satoshi-Variable.woff2`/`Satoshi-VariableItalic.woff2`; o
pacote original com OTF/TTF/EOT foi descartado). `@font-face` + token
`--font` em `tokens.css`, que já carrega antes de tudo — nenhuma outra
mudança necessária.

### Contexto
Usuário revisou o app em uso real (screenshots) e levantou 7 pontos
(um duplicado = 8 itens reais). Planejado em `plan mode`
(`~/.claude/plans/parallel-forging-flamingo.md`) antes de codar, com 2
perguntas de esclarecimento (local do item de retorno-por-procedimento e
persistência do "Concluir" — usuário confirmou Histórico > Retornos +
Supabase).

### Feito
1. **Sidebar recolhida**: botão de logout vazava do rail de 64px (avatar +
   botão lado a lado não cabiam). Resolvido junto com o item 2.
2. **Rodapé da sidebar**: Configurações saiu de `ORDER` (nav principal, em
   `app.js`) e virou opção dentro de um mini-menu (`renderUserFooter`) aberto
   pelo próprio card do usuário — avatar+nome+ícone de menu (`.user-menu`,
   `.user-menu__pop` em `layout.css`), com "Configurações" e "Sair". Colapsado,
   só o avatar sobra (sem 2º elemento pra vazar). Fecha ao clicar fora ou ao
   navegar (mobile também fecha o drawer via `closeDrawer` compartilhado).
3. **WhatsApp do administrador** (`configuracoes.js`): campo trava (`disabled`)
   quando já há número salvo; botão vira "Alterar" (libera edição) em vez de
   "Salvar WhatsApp"; ao salvar, trava de novo.
4. **Filtros**: `.filters` perdeu o `overflow-x:auto`/scroll horizontal feio
   (virou `flex-wrap:wrap; margin-left:auto` — empilha em vez de rolar, e já
   fica à direita do toolbar sem precisar de `<div class="spacer">` manual).
   Histórico > Procedimentos trocou o select "Toda cliente" por busca textual
   (`.search-input`, mesmo padrão de Clientes); Fluxo de Caixa ganhou busca por
   descrição/cliente nos lançamentos.
5. **Estoque**: thumbnail 56px → 80px (`.thumb`).
6. **Agenda — Lista nunca vazia**: `load(autoAdvance)` avança semana a semana
   (parâmetro `AGENDA_AUTO_LOOKAHEAD_WEEKS = 8`) quando a carga é automática
   (boot inicial e botão "Hoje") e a semana atual não tem nada. Navegação
   manual (seta anterior/próxima) continua mostrando a semana pedida, mesmo
   vazia — não teria sentido "corrigir" uma navegação intencional do usuário.
7. **Histórico > Retornos**: agora agrupa por cliente+**serviço** (não só
   cliente) — uma cliente com 2 procedimentos diferentes em datas diferentes
   aparece 2x, cada linha com o nome do serviço. Botão **"Concluir"** grava um
   dismissal (nova tabela `return_dismissals`, RLS padrão) que esconde a linha
   até um novo procedimento do mesmo serviço acontecer (a comparação é por
   data, não flag binária — reativa sozinho).
8. **Dashboard**: coluna do aside (`estoque crítico`/`clientes para retorno`)
   340px → 400px. "Próximos agendamentos" ganhou horário e duração — busca os
   eventos do Google Calendar (`listEvents`, mesmo padrão de `agenda.js`) pros
   `google_event_id` da janela de datas; sem conexão Google, cai de volta pra
   só mostrar a data (`catch` silencioso, dashboard nunca dependeu do Google).

### Verificação
`node --check` limpo nos 9 arquivos JS tocados (app, configuracoes, historico,
financeiro, agenda, home, estoque, clientes, utils). SQL revisado manualmente
(8 blocos `do $$`/`language plpgsql as $$` = 8 `end $$;`, balanceado — só
tabela nova + coluna no array de RLS, sem novo `do $$`). Servidor local
(`python3 -m http.server`) confirmou todos os assets/paths servindo 200.

### Deploy
Usuário vai conferir visualmente antes do próximo passo. **Lembrar**: rodar o
`schema.sql` atualizado no Supabase antes do próximo push (nova tabela
`return_dismissals`).

### Pendente / próximo
Verificação visual dos 8 itens (não testado em browser real — extensão Chrome
não conectada nesta sessão). Usuário tem mais itens de aprimoramento para
depois.

---

## Rodada 6 — Bugs críticos, padrões sistêmicos, módulos e novo login (2026-07-02)

### Contexto
Prompt de execução em `improvements/rodada6-prompt.md` (triagem já feita com o
usuário): 3 bugs, 2 padrões sistêmicos (filtros e scroll de pop-ups), 4 ajustes
de módulo e redesign da tela de login. Executado nas 4 fases previstas.

### Feito
**Fase 1 — bugs**
1. **Agenda quebrada** (`agenda.js:130`): `ReferenceError: evs is not defined`
   — `evs` é `const` dentro do `try{}` e era lida fora dele no `if` do
   auto-avanço de semanas. Trocado por `state.events` (atribuído no try).
2. **Fluxo de Caixa não carregava** — causa raiz encontrada por análise
   estática (sem precisar reproduzir): `financial_entries.procedure_id`
   **nunca teve foreign key** para `procedures`; o embed
   `procedures(price_charged, procedure_materials(...))` adicionado na Rodada 4
   (coluna Lucro, commit 600e91d) exige o relacionamento no catálogo — o
   PostgREST rejeita a query inteira (PGRST200) e nenhuma aba pinta. Fix:
   FK na definição da tabela (bancos novos) + migração idempotente
   `not valid` (banco implantado; não varre órfãos históricos). De quebra, o
   `load()` do módulo agora pinta um estado de erro no pane (antes ficava
   skeleton infinito).
3. **Histórico mascarava erro de carga** (`historico.js:115`): `tbody` não
   existe naquele escopo (é `tableWrap`) — o handler de erro disparava um 2º
   ReferenceError. Corrigido e agora mostra `emptyBox` de erro.

**Fase 2 — padrões sistêmicos**
4. **`.filters` virou grid responsivo** (`components.css`):
   `repeat(auto-fit, minmax(150px,1fr))` + `flex-basis: 460px` — quebra de
   linha desce em bloco alinhado (sem campo `dd/mm/aaaa` solto), e abaixo de
   640px empilha em coluna única. Larguras inline (`max-width`) removidas dos
   filtros de `historico.js` e `financeiro.js`. Busca de Histórico >
   Procedimentos ampliada: cliente, serviço, status e valor (placeholder
   "Buscar por cliente, serviço…").
5. **Scroll de modais/drawers**: `.modal` e `.drawer`/`.drawer--center` agora
   são flex-coluna com `overflow:hidden`; só `.modal__body` / nova
   `.drawer__body` rolam (`flex:1; min-height:0`). Sticky do head/foot do modal
   saiu (desnecessário no novo layout). Perfil de cliente (`clientes.js`) e
   item de estoque (`estoque.js`) reestruturados com
   `.drawer__wrap`/`.drawer__head`/`.drawer__body` — cabeçalho/botões/abas
   fixos, só as tabelas rolam, barra de rolagem longe dos cantos arredondados.

**Fase 3 — módulos**
6. **Serviços em lista** (`servicos.js`): `.card-grid` → `table.data` (dot de
   cor + nome + descrição, Preço, Duração, badge de status); linha clicável
   abre o mesmo `openForm`. Filtro/busca/color picker preservados. `.card-grid`
   ficou órfão e foi removido do CSS.
7. **Dashboard — Próximos agendamentos** (`home.js`): panel-rows → `table.data`
   com colunas Cliente / Procedimento / Duração / Data (`whenLabel` separado em
   `durLabel`, "60 minutos" ou "—" sem evento Google).
8. **Dashboard — Clientes para retorno**: substituída a regra de 60 dias por
   cliente pela lógica de Histórico > Retornos (cliente+serviço, marcos
   1/3/6/12 meses). **Migração de schema**: `return_dismissals` ganhou coluna
   `months` (default 1 p/ linhas antigas) e a unique passou a
   `(user_id, client_id, service_id, months)` — confirmar o marco de 1 mês não
   silencia mais os de 3/6/12. Dashboard mostra o menor marco vencido e não
   dispensado; linha = cliente + serviço + marco + "há N dias" + WhatsApp +
   botão ✓ (mesmo upsert do Histórico). `historico.js` atualizado (chave do
   Map e upsert com `months`; `dismissed_at` agora explícito no upsert — no
   conflito a data é renovada, senão o filtro por data reexibiria a linha).
9. **Atalho "Ver agenda de hoje"** no hero (`home.js` → `intent:agendaHoje`;
   `agenda.js` lê/limpa antes do primeiro `load()`, força view Dia com cursor
   hoje e sincroniza o botão ativo do `#ag-view`).

**Fase 4 — login** (`index.html` + `layout.css`)
10. Card 2 colunas sobre fundo com gradientes radiais suaves (tokens mauve).
    Esquerda: "Olá, novamente", e-mail, senha (olho mostrar/ocultar funcional +
    "Esqueceu a senha?"), "Entrar →", divisor "ou", **botão Google com o mesmo
    handler de antes** (fluxo de auth intocado), "Criar conta". Direita: SVG
    abstrato inline (curvas/círculos na paleta, marca d'água "Harmon IA") —
    substituível por foto depois. Responsivo: <820px a coluna visual some.

### Verificação
`node --check` limpo nos 7 JS tocados (agenda, historico, financeiro, home,
servicos, clientes, estoque). SQL revisado manualmente: 4 `do $$` + 6 funções
= 10 `end $$;`, migrações idempotentes (add column if not exists / drop
constraint if exists / exception duplicate_object). Sem referências órfãs de
CSS (`card-grid`, `login__card`, `login__tagline` limpos).

### Decisões / pegadinhas
- E-mail/senha do login são **só visuais** (toast "Em breve") — auth continua
  100% Google, decisão fechada com o usuário.
- FK nova com `not valid`: PostgREST só precisa do relacionamento no catálogo;
  evita travar a migração se houver órfão histórico.
- Linhas antigas de `return_dismissals` viram marco de 1 mês (`default 1`) —
  comportamento igual ao que o usuário via antes, e os marcos maiores voltam a
  aparecer (que era o pedido).

### Limpeza de repositório (pós-rodada, pedido do usuário)
- `agent/skills/` removido — cópia antiga/parcial de `.agents/skills/` (a
  canônica, que bate com `skills-lock.json`).
- `credenciais/.fuse_hidden*` (restos de arquivos deletados em FS montado) e
  `assets/.DS_Store` apagados.
- `LAUNCH-ETAPA6.md` (prompt de sessão já cumprido) movido para
  `improvements/`, junto dos outros prompts de rodada.

### Pendente / próximo
- **Rodar `db/schema.sql` no Supabase antes de testar** (FK do Fluxo de Caixa
  + coluna `months`) — sem isso o Fluxo de Caixa continua quebrado.
  ✅ Feito pelo usuário em 2026-07-02 (início da Rodada 7).
- Verificação visual do usuário em ambiente real (não testado em browser nesta
  sessão). Sem commit/push/deploy, como combinado.

---

## Rodada 7 — Diagnóstico geral + limpeza em massa, período e cadastro inline (2026-07-02)

### Diagnóstico (só análise, sem código)
- **`improvements/rodada7-diagnostico-geral.md`**: auditoria completa sob 3
  personas (Eng. de Software, Full Stack Sênior, UI/UX) — 34 achados com
  arquivo/linha, consolidados por severidade, convergências, 12 quick wins e
  8 estruturais. Destaques: auto-conclusão de agendamentos sem confirmação/
  estorno (ES-1), `google_refresh_token` chegando ao browser via `select('*')`
  (ES-2), tabelas sem scroll horizontal no mobile (UX-1), edição de agendamento
  duplicando parcela já baixada (ES-6).
- **Decisões fechadas** (usuário delegou; registradas no doc): no-show =
  confirmação em lote com exceções; login = remover form fake, Google único e
  primário; sinal antecipado permitido (edição aborta se houver parcela paga);
  horizonte default 12 meses; OAuth segue em modo Teste. A execução do
  diagnóstico será uma rodada própria.

### Feito (código desta rodada — pedidos do usuário)
1. **Limpeza em massa** (Histórico > Procedimentos, Fluxo de Caixa e Clientes):
   coluna de checkbox + "selecionar todos" + barra com contador e **Excluir**
   (`bulkBar` novo no utils; `.chk`/`.bulkbar` no components.css; confirmação
   de perigo em tudo).
   - Procedimentos: nova RPC **`delete_procedures(uuid[])`** (schema.sql) —
     apaga procedimentos + lançamentos ligados na mesma transação (a FK é
     `set null`; sem o delete explícito sobrariam órfãos). Materiais caem via
     cascade; estoque NÃO é devolvido; eventos Google não são tocados (diálogo
     avisa).
   - Lançamentos: delete direto em `financial_entries` (RLS isola).
   - Clientes: delete direto — FKs resolvem (procedures/financial_entries
     ficam com cliente "—"; return_dismissals cai em cascata). Também botão
     **Excluir** no drawer de perfil. Inativar continua sendo a opção
     "sumir sem apagar".
2. **Filtro de período** (`periodFilter` novo no utils, usado em Fluxo de
   Caixa e Histórico > Procedimentos): os dois dates De/Até viram um select —
   Todo o período (default) / Mês atual / 30 dias / 3 / 6 / 12 meses /
   **Personalizado…** (só aí os dates aparecem). "Mês atual" = mês-calendário
   inteiro (parcelas a vencer no mês continuam visíveis). No Histórico o
   componente sobrevive à troca de views (criado 1x, re-anexado).
3. **Cadastro de cliente inline**: `clientAutocomplete` ganhou `onCreate` —
   busca sem match mostra "＋ Cadastrar \"nome\"" (clique ou Enter). Abre o
   `openForm` de Clientes (agora **exportado**, aceita `preset.name` e devolve
   a linha criada ao `onSaved`) por cima do modal e já seleciona a cliente
   criada (`picker.set()`). Ativo em Agenda (novo agendamento) e Histórico
   (registro); Estoque reusa o autocomplete sem o botão (opt-in).

### Verificação
`node --check` limpo nos 6 JS tocados (utils, clientes, agenda, historico,
financeiro + estoque intocado). Asserts da lógica não trivial do `periodFilter`
(limites de mês, fevereiro bissexto, presets) passaram. SQL: 11 blocos
plpgsql/do = 11 `end $$;` (balanceado). Edge conhecido e aceito: preset "3
meses" partindo de dia 31 desloca 2-3 dias (rolagem de calendário do JS).

### Deploy
- **Lembrar: rodar `db/schema.sql` no Supabase de novo** — a RPC
  `delete_procedures` foi adicionada DEPOIS do run desta manhã. Sem ela, o
  Excluir do Histórico falha (Clientes e Caixa funcionam sem migração).
- Verificação visual em produção ainda pendente (browser não conectado).
- ✅ Commit `a959e16` + push + deploy confirmado em produção (curl nos assets).

---

## Rodada 7 (continuação) — Estoque em massa, Agenda Lista/Calendário e versão mobile (2026-07-02)

### Feito
1. **Estoque — seleção em massa**: mesmo padrão dos outros módulos (checkbox +
   selecionar-todos + `bulkBar` + confirmação). Delete direto (FKs preservam
   histórico: `stock_transactions`/`procedure_materials` ficam sem o item;
   `shopping_list_items` cai em cascata); fotos/NFs removidas do bucket
   (best-effort). Sem mudança de schema.
2. **Agenda reformulada** (reverte o auto-avanço da Rodada 5, decisão do
   usuário): toggle de visualização virou **Lista / Calendário** e a Lista
   ganhou período próprio **Dia / Semana / Mês** (default Mês — abre com o mês
   inteiro em lista, agrupado por dia). Calendário = grade mensal (período
   some nesse modo); setas navegam pela unidade ativa. `monthListRange` novo
   (mês exato) vs `monthRange` (janela da grade). "Ver agenda de hoje" →
   Lista+Dia. De brinde: fechado o achado FS-3 do diagnóstico neste trecho
   (`procs.error` agora gera toast em vez de pintar a lista sem valores).
3. **Versão mobile completa** (plano aprovado em plan mode; decisões do
   usuário: tabbar + cards + FAB). Breakpoints: ≤900px modo app, ≤640px
   telefone. Desktop intocado.
   - **Bug bloqueante corrigido**: desde a Rodada 4 o hambúrguer morava dentro
     da sidebar escondida (≤900px) — não havia COMO navegar no celular.
   - **Tabbar** (`app.html` #tabbar + `buildTabbar` no app.js): Início/Agenda/
     Clientes/Caixa + **Mais** (sheet `.drawer--sheet` com Estoque, Histórico,
     Serviços, Configurações, usuário e Sair). Sidebar `display:none` ≤900px;
     todo o código de drawer/scrim mobile do app.js/layout.css foi removido.
   - **FAB**: CSS puro — `.header__actions .btn--primary` vira botão flutuante
     redondo acima da tabbar (funciona porque todo primário começa com "+");
     secundárias colapsam pra ícone (`.btn-label` agora esconde ≤900px;
     Rascunhos/Lista de compras/Adicionar produto ganharam ícone+label).
   - **Tabelas → cards** ≤640px: thead some, tr vira card flex-coluna,
     `td[data-th]` vira linha "rótulo — valor", célula sem data-th é o título
     (order:-1), `.chk` no canto, `.actions` alinha botões. Sweep de `data-th`
     em clientes/estoque/historico/financeiro/servicos/home. `.table-wrap`
     ganhou `overflow-x:auto` (fallback universal — UX-1 do diagnóstico).
   - **Overlays**: modal/drawer viram bottom sheet ≤640px (94dvh, cantos
     superiores); `.drawer` 100vh→100dvh; `viewport-fit=cover` +
     `env(safe-area-inset-bottom)` (tabbar, FAB, sheets, toasts).
   - **Forms/toolbars**: `.field-row` quebra ≤640px (flex-basis 140px — pares
     curtos lado a lado); busca em linha própria; `.ag-nav` linha própria;
     hero da Home em grade 2 colunas; toasts acima da tabbar e full-width.

### Verificação
`node --check` limpo nos 9 JS; chaves balanceadas nos 5 CSS; servidor local
serviu todos os assets 200. **Extensão Chrome não conectada** — verificação
visual mobile (390×844) e regressão desktop ficam com o usuário.

### Pendente / próximo
- ✅ Schema rodado no Supabase (RPC `delete_procedures` ativa) e commit/push
  autorizados pelo usuário em 2026-07-02.
- Verificação visual (mobile 390×844 + regressão desktop) em produção.

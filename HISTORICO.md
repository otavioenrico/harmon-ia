# Histórico de Desenvolvimento — Harmon IA

Registro do que foi feito em cada janela de contexto. **Cada etapa = uma sessão.**
Para registrar uma nova etapa, peça "registre o que foi feito até aqui" e eu
adiciono uma seção `## Etapa N` no fim deste arquivo.

**Versão atual:** v2.2.0

## Tabela de versões (semântico)

MAJOR = muda a superfície do produto (ex.: site público novo). MINOR = módulo/feature
nova. PATCH = correção, ajuste visual ou polish sem feature nova.

| Versão | Etapa/Rodada | Resumo |
|---|---|---|
| v1.0.0 | Etapa 1 | Fundação: schema, RLS, RPC, design system, auth, shell |
| v1.1.0 | Etapa 2 | Módulo Clientes |
| v1.2.0 | Etapa 3 | Módulo Estoque |
| v1.3.0 | Etapa 4 | Módulo Histórico / Registro de Procedimento |
| v1.4.0 | Etapa 5 | Módulo Fluxo de Caixa |
| v1.4.1 | Deploy/Setup | Primeiro deploy em produção (Supabase/GitHub/Vercel/Google) |
| v1.5.0 | Etapa 6 | Agenda + integração Google Calendar |
| v1.6.0 | Rodada 2 | Specs de auditoria visual, redesign do design system e dashboard (parcialmente adotadas depois) |
| v1.7.0 | Rodada 3 | Acessibilidade, robustez de UX e motion polish |
| v1.8.0 | Rodada 4 | 11 aprimoramentos de UI (Sidebar, Caixa, Clientes, Estoque, Agenda, Dashboard) |
| v1.9.0 | Rodada 5 | Fonte Satoshi + 8 aprimoramentos de UX |
| v1.10.0 | Rodada 6 | Bugs críticos, padrões sistêmicos, módulos em tabela e novo login |
| v1.11.0 | Rodada 7 | Diagnóstico geral + limpeza em massa + filtro de período + cadastro inline |
| v1.12.0 | Rodada 7 (continuação) | Estoque em massa, Agenda Lista/Calendário, versão mobile completa |
| v1.13.0 | Rodada 8 | Contraste de tema, navegação mobile, hero do dashboard, cadastro rápido, login |
| v1.13.1 | commit `a3e7c04` | Accent "neutral" + ajustes de contraste em tema/layout (sem etapa detalhada em HISTORICO) |
| v1.13.2 | commit `f566273` | Reordena hero da Home e simplifica atalhos (sem etapa detalhada em HISTORICO) |
| v2.0.0 | Etapa 7 | Landing comercial (site público de 3 páginas) em pré-lançamento — muda a superfície pública do produto |
| v2.0.1 | Fix pós-Etapa 7 | Retorno do login (hash+query) e painel em `/app` |
| v2.1.0 | Rodada 10-11 | Reforma visual (estilo elevenlabs) + copy/SEO neutra da landing |
| v2.1.1 | Rodada 12 | 13 ajustes visuais da landing + revisão do item 5 (módulos da Sobre) |
| v2.1.2 | Rodada 13 | Motion sutil (scroll-reveal, hover, accordion do FAQ) na landing pública |
| v2.2.0 | Etapa 8 | Integrações Google (Parte 1): Contatos, Exportar Sheets, Backup+Restaurar no Drive; melhorias na Agenda |

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

## Rodada 2 — Auditoria visual, redesign do design system e revisão do dashboard (specs) (2026-07-01)

Três documentos de diagnóstico/spec, fechados e prontos para execução, mas nunca
registrados aqui: `auditoria-visual-rodada2-especificacoes.md` (achados de UI com
causa raiz no código — ícones gigantes, sidebar mobile, overflow, sistema de cor),
`design-system-redesign-specs.md` (proposta de redesign baseada numa referência
visual — `visual.png` — com paleta rosé/mauve, `--radius-xl`, layout de 3 colunas
com painel direito e tipografia system-font) e `revisao-aprimoramentos-dashboard.md`
(fecha as decisões de arquitetura do agendamento: `schedule_procedure`/
`complete_procedure`, Home como rota padrão, autocomplete de cliente).

**O que foi de fato adotado depois:** paleta mauve e o sistema de 5 acentos
(Rodada 3/8), `--radius-xl` (aparece em `tokens.css`), ícones/overflow/sidebar
mobile corrigidos (Rodada 3/7), Home como rota padrão e autocomplete de cliente
(rodadas seguintes). **Não adotado:** tipografia system-font/Helvetica (a Rodada 5
decidiu por Satoshi) e o layout de 3 colunas com painel direito (o shell
continua em 2 colunas: sidebar + conteúdo).

---

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

---

## Rodada 8 — Contraste de tema, navegação mobile, hero do dashboard, cadastro rápido de cliente e login (2026-07-02)

### Contexto
9 itens de UI/UX levantados numa sessão de triagem com o usuário (prompt em
`improvements/rodada8-prompt.md`), com causa raiz já investigada pra maioria.
5 fases: tema (contraste), navegação mobile, dashboard, modal de agendamento,
tela de login.

### Feito
1. **Checkboxes de seleção em massa** (`components.css` `.data .chk input`):
   `accent-color` nativo trocado por checkbox custom (`appearance:none` +
   `background`/`border` em `:checked`, check em `::after`) — cross-browser
   confiável, sem depender de suporte inconsistente do navegador/webview.
2. **Ícones dos mini-cards da Home somem no dark**: causa raiz confirmada —
   `.mini__icon` herdava `--text` (quase branco no dark) num círculo sempre
   claro (`--color-mauve-100` não muda por tema). Fix: `color:
   var(--color-mauve-700)` fixo no `.mini__icon`, independente do tema.
3. **Cor secundária do dark mode**: `#2e2a25` → `#2f2e2e` (`--accent` e
   `--btn-secondary-bg` em `theme.css`).
4. **Scrollbar temática**: não existia nenhuma regra global — o navegador
   usava a scrollbar do SO. Adicionado `scrollbar-color`/`scrollbar-width` +
   trio `::-webkit-scrollbar*` em `layout.css`, usando `--surface-2` (trilho)
   e `--color-mauve-500`/`700` (polegar/hover) — acompanha tema e as 5 cores
   de destaque automaticamente.
5. **Menu "Mais" (mobile) sem títulos**: causa raiz confirmada — o seletor
   `.nav__item .label` (dentro do bloco `@media ≤1200px` que colapsa a
   sidebar) não estava escopado a `.sidebar`, então também escondia os labels
   do sheet mobile (que reaproveita as mesmas classes). Fix: `.sidebar
   .nav__item .label`. De brinde: itens do sheet agrupados em `.sheet-nav`
   (gap entre eles, antes sem nenhum) + `.sheet-divider` antes de "Sair".
6. **FAB "+" descentralizado (mobile)**: causa raiz confirmada — o botão
   primário do header já tinha um SVG de ícone (`plus`) **e** um `::before`
   com "+" via CSS; os dois renderizavam lado a lado no FAB circular. Fix:
   `.header__actions .btn--primary svg { display:none }` nesse breakpoint —
   só o `::before` sobrevive, perfeitamente centralizado.
7. **Hero do dashboard vazando em larguras intermediárias**: causa raiz era o
   "automatic minimum size" padrão do flexbox — sem `min-width:0`, um item
   flex nunca encolhe abaixo do min-content do filho mais largo (o botão "Ver
   agenda de hoje"), então em vez de quebrar linha ele estourava a largura do
   card. Fix mínimo: `min-width:0` em `.hero__actions` e em `.btn` dentro
   dele, + `overflow:hidden`/`text-overflow:ellipsis` como rede de segurança.
   Testado em 1280/800/700/640px — nunca vaza, grid 2-colunas do ≤640px
   preservado.
8. **Modal "Novo agendamento" — autocomplete de cliente**:
   - Lista abria sozinha: causa raiz confirmada — `openModal` autofoca o 1º
     campo do form (a11y), e o campo Cliente é esse campo; o `focus`
     programático disparava o `render()` do autocomplete. Fix:
     `clientAutocomplete` (utils.js) só reage ao `focus` depois de um
     `queueMicrotask` (separa o autofoco síncrono do mount de qualquer foco
     real, que só chega num tick depois). Descoberto durante o teste que
     clicar num campo **já** focado não reabre a lista (clique não gera novo
     evento `focus`) — adicionado listener de `click` também.
   - **Bug pré-existente encontrado na verificação** (fora do escopo original,
     mas quebrava o item 4.2 na prática): o filtro de busca combinava nome OU
     telefone com `onlyDigits(c.phone).includes(onlyDigits(q))` — para
     qualquer busca sem dígitos, `onlyDigits(q)` é `''`, e `"".includes('')`
     é sempre `true`, então TODO cliente com telefone "casava" e o filtro por
     nome virava no-op (e "＋ Cadastrar" nunca aparecia). Fix: só compara
     dígitos de telefone quando a busca tem algum dígito.
   - **Cadastro rápido inline**: nova função `quickCreate(ctx, name, onSaved)`
     em `clientes.js` — popup compacto (Nome/Telefone/E-mail, nome
     pré-preenchido), reaproveita `bindMask(maskPhone)` do form completo (não
     duplica a lógica de máscara). `agenda.js` e `historico.js` trocaram o
     `onCreate` do autocomplete de `openForm` (form completo, wide) para
     `quickCreate`. Cliente criado entra em `clients` com os demais campos em
     branco, pra completar depois em Clientes.
9. **Tela de login**: removido `<h1>Olá, novamente</h1>`; fundo do `<main
   class="login">` trocado do `--bg` padrão (quase branco, se perdia atrás do
   card) para `--color-gray-200` (token já existente, neutro); SVG abstrato
   da coluna direita substituído pela imagem real (`assets/img/
   login-visual.png`, redimensionada de 2200×3350 pra 578×880 via `sips`
   — 5.8MB → 693KB, mantida como PNG porque `sips` não grava `.webp`, só lê;
   instalar um conversor novo só pra essa imagem não valia a dependência).
   `<img object-fit:cover>` preenche a coluna, `.login-visual__mark` (marca
   d'água) preservada por cima. Login não tem toggle de tema (só existe
   pós-auth) — usar token cru é intencional, não uma inconsistência.

### Verificação
`node --check` limpo em todos os `.js` tocados (`app.js`, `utils.js`,
`clientes.js`, `agenda.js`, `historico.js`). Extensão Chrome não conectada —
verificação visual feita via `agent-browser` (CLI instalada nesta sessão,
já usada na Rodada 3): `improvements/preview-rodada8.html` (galeria nova,
sem Supabase, mesmo padrão do `preview-rodada3.html`) + `index.html` direto.
Confirmado visualmente: checkbox e ícone dos mini-cards respondendo à matriz
tema×accent (testado claro/escuro × rose/sky via toggle da galeria); hero sem
vazar em 1280/800/700/640px; FAB centralizado ≤900px; sheet "Mais" com
títulos e espaçamento; modal de agendamento com autofoco no campo Cliente sem
abrir a lista, clique abrindo, busca sem match oferecendo "＋ Cadastrar",
popup de 3 campos com máscara de telefone funcionando; login sem o h1, fundo
neutro, imagem + marca d'água legível, coluna direita some ≤820px.

### Decisões / pegadinhas
- **`onlyDigits(q) === ''` faz `.includes('')` sempre `true`** — qualquer
  filtro que combine busca textual + busca numérica com esse helper precisa
  checar se a query tem dígito antes de aplicar o lado numérico, senão o
  filtro numérico "engole" o textual.
- **`data-accent`/`data-theme` só devem existir no `<html>`, nunca também no
  `<body>`** — um atributo duplicado num descendente reinicia a herança da
  custom property a partir dali pra baixo, mesmo que `<html>` esteja correto
  (causou uma falsa pista de bug de tema durante a verificação: era o preview
  harness, não o app real).
- **`sips` grava `.webp`? Não** (`--formats` lista `webp` sem `Writable`) —
  só lê. Pra otimizar imagem sem instalar conversor novo, redimensionar +
  manter PNG já reduz bastante (aqui, 88% menor).
- Autofoco de modal (a11y, Rodada 3) + autocomplete que abre no `focus` é uma
  combinação que se auto-sabota sem cuidado — qualquer autocomplete futuro
  que vire "1º campo" de um modal herda esse risco; o padrão
  `queueMicrotask` + listener de `click` em `clientAutocomplete` cobre isso
  pra quem reusar o componente.

### Pendente / próximo
- Commit/push/deploy **não** feitos — aguardando revisão visual do usuário em
  ambiente real (mesmo padrão de todas as rodadas anteriores).
- Sem mudança de schema nesta rodada — não precisa re-rodar `db/schema.sql`.
- `improvements/preview-rodada8.html` é só uma galeria de verificação (como a
  da Rodada 3); pode ficar no repo como referência ou ser removida depois.
- Verificação visual (mobile 390×844 + regressão desktop) em produção.

## Etapa 7 — Landing (site comercial, pré-lançamento) (2026-07-02)

### Contexto
Spec em `PLANO-LANDING.md` (fonte de verdade da etapa). Objetivo: transformar
o app (hoje só login → app) num site comercial de 3 páginas em modo
pré-lançamento, sem quebrar o auth existente. `index.html` (login) vira a
home pública; login migra pra `entrar.html`.

### Feito
1. **Remanejo de rotas (§3):** `index.html` → `entrar.html` (login, conteúdo
   intacto); novo `index.html` = home. `auth.js`: `requireSession()` e
   `signOut()` passam a apontar pra `/entrar.html` e `/` respectivamente (não
   mais `/index.html`). `vercel.json`: rewrite `/auth/callback` →
   `/entrar.html`. **Decisão:** `redirectTo` do OAuth **não mudou** (continua
   `${location.origin}/`) pra não exigir reconfigurar Redirect URLs no painel
   do Supabase — em vez disso, o novo `index.html` tem um shim de 1 linha que
   detecta `?code=` (retorno do Google) e repassa pra `/entrar.html`.
2. **Modo pré-lançamento (§2.5):** badge "Em breve" no header. **Allowlist
   hardcoded** em `auth.js` (decisão do usuário, não a tabela — default do
   PLANO): array `ALLOWLIST` no topo, `isAllowed(email)`; gate no
   `onAuthStateChange` de `entrar.html` — e-mail fora da lista → `signOut()` +
   toast + volta pra `/`. `// TODO: migrar p/ tabela allowlist quando abrir
   beta.` **Waitlist real**: tabela `waitlist` (RLS própria, insert liberado
   pra `anon`/`authenticated`, sem policy de select — `db/schema.sql` +
   `db/migration-waitlist.sql` avulso) + `assets/js/waitlist.js`
   (`initWaitlistForms()`, valida e-mail, honeypot, `upsert` idempotente,
   troca o form por confirmação inline no sucesso).
3. **3 páginas** (`index.html`/Início, `planos.html`, `sobre.html`), header e
   footer repetidos (HTML, sem framework). Design novo em
   `assets/css/landing.css` — reusa tokens/`.btn`/`.badge`/`.card` existentes,
   zero hex cru, zero token novo (exceção: tamanho do título do hero via
   `clamp()` direto em `landing.css`, não virou `--fs-*` novo). Hero alto
   contraste + CTA de waitlist, grid de 4 features (módulos reais do app),
   "como funciona" em 3 passos, faixa CTA final com `data-theme="dark"`
   escopado. `planos.html`: **2 planos** (Personal/Team, spec revisada — era
   3), Team destacado (borda accent + badge), preços/features placeholder
   `<!-- TROCAR -->`, FAQ de 5 perguntas. `sobre.html`: 3 blocos de texto
   placeholder. Menu mobile ≤900px via `<details>/<summary>` nativo (zero JS).
4. **Responsivo + a11y:** heading hierarchy corrigida (`feature__title`,
   `step__title`, `plan-card__name`, `faq__q` eram `<div>` → viraram `<h3>`;
   `entrar.html` ganhou `<h1 class="sr-only">`, removido visualmente na
   Rodada 8 de propósito). Skip link ("Pular para o conteúdo") nas 3 páginas
   da landing. `name`+`spellcheck="false"` nos campos de e-mail. `text-wrap:
   balance` nos títulos grandes. `fetchpriority="high"` na imagem do hero
   (candidato a LCP).

### Bugs achados e corrigidos durante a verificação visual (não só no código)
- **Colisão de classe `.hero`/`.hero__*`:** já existia no `components.css` do
  app (hero do dashboard) — vazava `background`/`border`/`shadow`/`padding`
  indesejados no hero da landing. Renomeado tudo pra `.lp-hero*` (namespace
  próprio da landing).
- **Texto invisível na faixa CTA escura:** `data-theme="dark"` escopado numa
  `<section>` troca os tokens certo, mas `color` é herdado como *valor já
  computado* do `<body>` — filho sem `color` próprio não reavalia
  `var(--text)`. Fix: `color: var(--text)` explícito em `.cta-band`.
- **Menu mobile ancorado no botão hambúrguer** (40px) em vez do header
  inteiro: dois `position:relative` concorrentes (`.landing-header__inner` e
  `.landing-nav-mobile`) — removido o duplicado.
- **`.plan-card__badge`** só tinha posicionamento, sem cor/fundo — corrigido
  antes de vazar pro usuário.

### Verificação
`node --check` limpo em todo `.js` tocado; balanceamento de tags (parser
Python — `tidy` do macOS é HTML4, não reconhece `<header>`/`<details>`/
`<svg>`) OK nas 4 páginas. Visual real via `agent-browser` (extensão do
Chrome seguiu desconectada a etapa toda) em 1280px, 390×844 e uma faixa
intermediária (820px) — inclui teste de teclado ao vivo (skip link, menu
mobile via `<details>` nativo) e validação client-side da waitlist (regex +
toast, sem precisar da tabela existir).

### Decisões / pegadinhas
- **`redirectTo` do OAuth não mudou** — ver item 1. Se um dia a Rodada trocar
  pra `/entrar.html` direto, precisa adicionar a URL no painel do Supabase
  antes, senão quebra o login.
- **Skills do PLANO não existem no projeto:** `boas-praticas-design`
  (GERAR SPECS e VALIDAR CHECKLIST) foi citado na spec mas não está
  instalado — substituído por `ui-ux-pro-max` (modo plan) pra gerar a spec do
  hero/grid/cards e por `web-design-guidelines` pra validar. Mesma situação
  do `PLANO-LANDING.md`/`LAUNCH-LANDING.md` no início da etapa: não existiam
  no repo, o usuário colou o conteúdo na conversa.
- **Colisão de nome de classe é um risco real** quando CSS novo compartilha
  arquivos (`components.css`) com um app maior — qualquer nome genérico
  (`.hero`, `.card-title` etc.) pode já existir. Daqui pra frente, CSS da
  landing usa namespace `.lp-*` pra qualquer coisa que não seja
  inequivocamente exclusiva (tipo `.plan-card`, que não existe em lugar
  nenhum do app).

### Pendente / próximo — BLOQUEADO
- **Verificação end-to-end da waitlist bloqueada por incidente externo do
  Supabase** (falhas em restart/resize de projeto, várias regiões — não é bug
  do código). O banco foi checado via `psql` e está correto (policy, grants,
  role membership, schema — tudo validado por leitura direta), mas o insert
  via API/PostgREST como `anon` ainda retorna 401 mesmo após reload de schema
  cache; o remédio provável (restart do projeto) está inseguro durante o
  incidente. **Refazer o teste de insert anon (e o reenvio idempotente) via
  `waitlist.js`/`supabase-js` assim que o incidente do Supabase for
  resolvido** — o código do form já está validado e correto, só falta
  confirmar a ponta do banco.
- `sobre.html`/`planos.html` ainda usam `<!-- TROCAR -->` em preços, features
  e copy de marketing — placeholders intencionais desta etapa.
- Schema mudou (`waitlist`) → precisa rodar `db/migration-waitlist.sql` (ou o
  `db/schema.sql` completo) — já aplicado pelo usuário nesta sessão.
- `aria-live` ausente no container de toast (`utils.js`, compartilhado com o
  app inteiro) — observado durante a auditoria de a11y, não corrigido por
  estar fora do escopo de arquivos editáveis desta etapa.

### Pontos onde o nome "Harmon IA" aparece (§8 — guia pro rename futuro)
- `entrar.html`: `<title>`, `<h1 class="sr-only">`, `.login__logo`,
  `.login-visual__mark`.
- `index.html`, `planos.html`, `sobre.html`: `<title>`, `<meta
  name="description">`, `<meta property="og:title">`, `.wordmark` (header e
  footer), linha de copyright do footer (`<!-- TROCAR nome -->`).
- `sobre.html` também cita o nome no corpo do texto ("O Harmon IA junta...").
- Todos usam o mesmo padrão de marcação:
  `<span class="wordmark">Harmon&nbsp;<b>IA</b></span>` — rename é
  find-replace de `Harmon` + ajuste do `<b>IA</b>` se o nome novo não tiver
  duas palavras.

---

## Fix — Retorno do login (hash+query) e painel em `/app` (2026-07-02)

Correção pontual pós-Etapa 7 (commit `cc80f37`), sem documento de spec próprio:
ajuste no tratamento do retorno do OAuth do Google (parâmetros por hash e por
query string) e no roteamento do painel autenticado em `/app`. Detalhe do
código no diff do commit — não há prompt/spec original para resumir aqui.

---

## Rodada 10-11 — Reforma da landing: visual (estilo elevenlabs) + copy/SEO neutra (2026-07-02)

**Fonte:** `rodada10-prompt.md` + `rodada10-plano-reforma-landing.md` (Parte A
visual + Parte B copy/SEO) e `ESCOPO-REFORMA-COPY.md` (copy literal). Correções
de acabamento em `rodada11-correcoes-landing.md`. Commit `612eef2`.

### Copy/SEO (Parte B)
Reposicionamento de "clínica de saúde estética" para "profissionais de beleza e
estética" em geral (manicure, sobrancelha, tatuador, barbeiro etc.), copy neutra
em gênero, meta tags reais (title/description/og) nas 3 páginas, nova arquitetura
da Home (barra de segmentos, "por que trocar a planilha", prova social, FAQ),
FAQ Schema JSON-LD.

### Visual (Parte A + Rodada 11)
Header fixo com blur, hero full-bleed com imagem de fundo e overlay (depois
trocado por fundo neutro escuro na Rodada 11 até haver imagem/vídeo definitivo),
bandas de seção alternadas (branco/cinza), FAQ em accordion nativo
(`<details>/<summary>`), remoção de sublinhado em botões/links. Rodada 11 também
**removeu a cor de destaque (mauve) da landing** — site passou a ser 100%
neutro (cinza/preto/branco), ao contrário do resto do app que mantém o sistema
de 5 acentos.

---

## Rodada 12 — 13 ajustes visuais da landing + item 5 revisado (2026-07-02)

**Fonte:** `rodada12-ajustes-landing.md`. Commits `cbec202` (13 itens) e
`8978488` (item 5 revisado — o exemplo visual enviado exigia um redesenho do
módulo da Sobre).

Refinamentos sobre a Rodada 10-11: FAQ e cabeçalhos de seção centralizados,
"por que trocar a planilha" fixado em grid 2×2 com CTA preto, barra de
segmentos virou esteira (marquee) com ícone por profissão, hero alinhado à
esquerda, planos com pesos visuais iguais (removido o destaque do plano Team),
logo virou link para a home, kerning + ponto final nos títulos, e os cinzas dos
tokens foram neutralizados (removido o viés amarelado). **Item 5 (revisado no
commit seguinte):** os 3 módulos da página Sobre viraram cards brancos
sobrepostos a blocos escuros de imagem (camadas), substituindo o texto solto
sobre fundo cinza da primeira tentativa.

---

## Rodada 13 — Motion sutil na landing pública (2026-07-03)

**Fonte:** `PLANO-LAPIDACAO-LANDING.md`, Fases 1 e 2 (fundação de motion +
componentes). Fase 3 (L1-L5, lapidação visual/imagens) ficou de fora — fora do
escopo pedido nesta rodada.

### Arquitetura (no-build)
Dois arquivos novos, sem dependências: `assets/css/motion.css` (todo o motion
dentro de `@media (prefers-reduced-motion: no-preference)`) e
`assets/js/landing.js` (IntersectionObserver do scroll-reveal, fechamento do
menu mobile e o accordion animado do FAQ). Linkados nas 4 páginas do site
público (`index.html`, `sobre.html`, `planos.html`, `entrar.html`).

**Progressive enhancement:** um `<script>` inline síncrono no `<head>` de cada
página seta `document.documentElement.classList.add('js')` — é essa classe
(não o módulo) que autoriza o CSS a esconder qualquer coisa. Sem JS, ela nunca
existe e o conteúdo nasce visível. Verificado removendo a classe em runtime:
todos os `[data-reveal]` voltam a `opacity: 1`.

### O que foi implementado
- **Scroll-reveal** (`data-reveal` + `--reveal-i` para stagger): hero, cabeçalhos
  de seção, cards de feature/pain/step/plano, módulos da Sobre, itens do FAQ.
- **Entrada do hero** sem esperar scroll — mesmo mecanismo do reveal, só que os
  elementos já estão na viewport no load.
- **Hover de botão/card**: `translateY` + sombra em vez de só opacidade (o link
  puro do hero fica de fora, não tem elevação por ser só texto).
- **FAQ accordion animado**: `grid-template-rows: 0fr → 1fr` em vez de animar
  `height` direto (apontado pelo hook de design do `impeccable` como risco de
  layout thrash) — `landing.js` orquestra a classe `.is-open` com defasagem de
  frame (abertura) e espera o `transitionend` antes de soltar o `<details>`
  nativo (fechamento). Tem fallback via `[open]` nativo caso o módulo não
  carregue, pra nunca travar em `0fr`.
- **Ícone do FAQ**: trocou o swap de caractere `+`/`−` por `rotate(45deg)` — dá
  pra animar e ainda funciona sem JS (a rotação via `[open]` é instantânea).
- **Nav underline** que desliza (`scaleX`) no hover/foco dos links do header e
  rodapé.

### Verificação
Testado via Chrome (servidor estático local): reveal com stagger, hover de
card/botão, accordion do FAQ (abrir/fechar, ícone), underline do nav, e os 3
mecanismos de fechar o menu mobile (link, scroll, resize) — todos OK. Fallback
sem JS confirmado (remoção da classe `.js` em runtime → tudo visível). Não deu
pra testar 320px real nem `prefers-reduced-motion: reduce` do SO nesta sessão
(sem acesso a emulação de mídia do Chrome DevTools no harness usado) — a
garantia aí é por revisão de código: toda regra de motion está dentro do
media query certo.

---

## Etapa 8 — Integrações Google (Parte 1) + melhorias na Agenda (2026-07-03)

### Contexto
Rodada dedicada a aprimorar as integrações Google. Decisão-guia: **espelho** — o
Supabase segue a única fonte da verdade; Drive/Sheets/Contatos só recebem cópias
projetadas, nada volta para o banco (preserva RLS, RPCs atômicos e integridade).
O trabalho de WhatsApp/disparos virou **Parte 2** (feature "Leads") e a ideia de
tornar o Google opcional (login próprio) virou **Parte 3** — ambas registradas em
`APRIMORAMENTOS-PENDENTES.md`, sem implementação nesta etapa.

### Feito

**Agenda (agenda.js)**
- **"Registrar procedimento"** para eventos criados direto no Google Calendar:
  no detalhe de um evento sem `procedure`, um botão abre o form em modo "link" —
  ajusta o evento existente (sem duplicar) e cria a linha em `procedures` amarrada
  pelo `google_event_id` via `schedule_procedure`. Fecha o único ponto onde a
  integração "vazava" (eventos externos apareciam sem valor/status/materiais).
- **Polling leve (45s)**: refresh silencioso que só repinta quando algo muda
  (assinatura dos eventos), pausa com aba oculta ou modal aberto, e se autodesliga
  ao trocar de tela (checa `body.isConnected`). Reflete no app o que foi criado/
  alterado direto no Google, sem recarregar a página.

**Fundação Google (serve a todas as features)**
- `auth.js`: escopos `contacts` + `drive.file` (arquivos do app) no login.
- `google-cal.js`: passa a exportar `accessToken()` — cache de token compartilhado
  com os novos módulos (People/Drive/Sheets). `google-refresh.js` não mudou.

**Feature 1 — Google Contatos (People API)**
- `google-people.js` (novo): `upsertContact`/`deleteContact` (cria/atualiza pelo
  `resourceName`, recria se sumiu no Google; usa etag no update).
- `clientes.js`: espelha ao criar/editar/quickCreate/excluir — **best-effort**,
  nunca bloqueia nem desfaz o cadastro; gated pelo toggle `sync_contacts`.
- `configuracoes.js`: toggle liga/desliga + "Sincronizar clientes agora" (massa).

**Feature 2 — Exportar Financeiro pro Sheets**
- `google-sheets.js` (novo): `createSheet` cria a planilha, escreve valores
  (Valor/Lucro como número) e formata (cabeçalho negrito+congelado, auto-resize).
- `financeiro.js`: botão "Exportar Sheets" ao lado do CSV — exporta as linhas do
  filtro atual para uma planilha NOVA no Drive (foto do momento, não espelho vivo).

**Feature 4 — Backup automático semanal no Drive (multi-tenant, opt-in)**
- `google-drive.js` (novo): upload de JSON pro Drive (pasta "Harmon IA Backups"),
  usado no backup manual.
- `api/backup.js` (novo): Serverless + Vercel Cron. Varre só usuárias com
  `backup_enabled`, dump por `user_id` (service role, contorna RLS), sobe pro
  Drive de cada uma via refresh token dela + retenção (12). Protegido por
  `CRON_SECRET`.
- `vercel.json`: cron `/api/backup` aos domingos 06:00 UTC (Hobby: máx 1x/dia).
- `configuracoes.js`: toggle `backup_enabled` + "Fazer backup no Drive agora".

**Restaurar de backup**
- RPC `restore_backup(jsonb)` + helper `_force_user` (schema.sql): substitui TODOS
  os dados numa transação atômica (delete filho→pai, insert pai→filho), força
  `user_id = auth.uid()`, preserva IDs (vínculos intactos) e NÃO toca
  `user_settings` (Google/preferências ficam). `configuracoes.js`: upload `.json`,
  baixa backup de segurança do estado atual, confirmação digitada ("RESTAURAR"),
  chama a RPC e recarrega.

**UI — card Google (configuracoes.js)**
- Reorganizado em linhas por app com logos (Google / Google Agenda / Google
  Contatos): cabeçalho com reconectar, refresh por linha (Agenda = testar conexão;
  Contatos = ressincronizar) e toggle nos Contatos. Ícones novos `refresh`/`table`
  em `utils.js`; classes `.setting-row`/`.setting-divider`/`.g-logo` + spin do
  botão-ícone em `components.css`.

**Schema (db/schema.sql)** — migrações idempotentes: `sync_contacts`,
`backup_enabled`, funções `restore_backup` e `_force_user`.

### Verificação
`node --check` em todos os `.js` alterados/criados (auth, google-cal, google-people,
google-sheets, google-drive, clientes, financeiro, configuracoes, utils, api/backup)
e `vercel.json` validado como JSON. Testes funcionais end-to-end (People/Sheets/
Drive contra as APIs reais) dependem dos passos manuais do usuário e foram feitos
por ele: sincronização de Contatos e Exportar Sheets confirmados OK em produção.

### Decisões / pegadinhas
- **Espelho, não base.** Nada do Google volta pro Supabase. Sheets é "foto do
  momento" (arquivo novo por exportação), não planilha viva.
- **People API** é a correta (a "Contacts API" legada não é usada).
- **`drive.file`** é escopo "não confidencial" (só arquivos do app) — evita a
  verificação pesada do Google; Drive total/Gmail (restritos) foram evitados.
- **Backup no servidor** precisa da SERVICE ROLE (contorna RLS) + `CRON_SECRET`;
  sem sessão de usuário, o cron mint o token de cada uma pelo refresh_token salvo.
- **Restore** força `user_id` e roda como o usuário (security invoker) — impossível
  injetar dados de outra conta; a RLS protege por cima.
- **Card com toggle da Agenda** ficou só como status+refresh: a Agenda é fonte da
  verdade e não pode ser "desligada" sem a Parte 3 (app dono dos agendamentos).

### Passos manuais do usuário (uma vez) — ver SETUP.md
1. Google Cloud: ativar People API, Google Drive API, Google Sheets API.
2. Tela de consentimento: adicionar escopos `contacts` + `drive.file` → Reconectar.
3. Supabase SQL Editor: re-rodar `db/schema.sql` (idempotente — traz colunas e RPCs).
4. Vercel: env vars `SUPABASE_SERVICE_ROLE_KEY` e `CRON_SECRET` (Production) + deploy.

### Pendente / próximo
- **Feature 3 — Documentos no Drive** (pasta por cliente): adiada por escolha do
  usuário. `drive.file` já autorizado — é só código quando quiser.
- **Parte 2 — WhatsApp/Leads** e **Parte 3 — Google opcional (login próprio)**:
  planejadas em `APRIMORAMENTOS-PENDENTES.md`.
- Rotação (opcional) da service_role do Supabase, já que passou pelo chat.

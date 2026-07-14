# Colocar o Harmon IA no ar — guia passo a passo

O código está **100% pronto**. Falta só criar as contas e ligar os fios entre
elas. Faça **na ordem abaixo** — ela foi montada pra você não precisar voltar
atrás. Tempo total: ~40 min.

Antes de começar, abra um bloco de notas e vá colando aqui o que cada passo
pede. No fim, esses 6 valores ligam tudo:

```
SUPABASE_URL      = https://__________.supabase.co
SUPABASE_REF      = __________            (a parte antes de .supabase.co)
SUPABASE_ANON_KEY = eyJ...
GOOGLE_CLIENT_ID  = __________.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET = GOCSPX-__________
DOMINIO_PROD      = https://__________.workers.dev   (você descobre no Passo 3)
```

---

## Passo 1 — Supabase (banco de dados)

1. Entre em https://supabase.com → **Start your project** → entre com o GitHub
   ou e-mail.
2. **New project**. Nome: `harmon-ia`. Defina uma senha de banco e **guarde**.
   Região: `South America (São Paulo)`. Crie e espere ~2 min.
3. Menu lateral → ⚙️ **Project Settings → API**. Copie pro seu bloco de notas:
   - **Project URL** → é o `SUPABASE_URL`. (O `SUPABASE_REF` é o pedacinho do
     meio: em `https://abcd1234.supabase.co`, o ref é `abcd1234`.)
   - **anon public** (em Project API keys) → é a `SUPABASE_ANON_KEY`.
4. Menu lateral → **SQL Editor → New query**. Abra o arquivo `db/schema.sql`
   deste projeto, **copie tudo**, cole no editor e clique **Run** (canto
   inferior direito). Deve aparecer "Success". Isso cria todas as tabelas, a
   segurança (RLS), a função de registro e o bucket de arquivos.

> 🆘 Se o Run der erro: **me cole a mensagem de erro vermelha** que aparece e
> eu te digo o que é.

> 🔁 **Já tem o Harmon IA no ar e só quer atualizar?** O `db/schema.sql` é
> **idempotente** — pode colar o arquivo inteiro de novo no SQL Editor e rodar
> **Run** sempre que o código mudar tabelas/colunas/funções novas (o
> `HISTORICO.md` avisa quando isso acontece). Não apaga dados existentes.

---

## Passo 2 — GitHub (guardar o código)

1. Crie conta/login em https://github.com.
2. Você **não precisa** mexer no site do GitHub manualmente — eu faço o envio
   por comando. Quando chegar aqui, me diga **"pode subir pro GitHub"** e eu:
   - crio o repositório,
   - envio o código,
   - te devolvo o link.

> Antes de eu subir, você só precisa ter preenchido o `config.js` (Passo 5).
> Pode pular pro Passo 3 agora e voltar — a ordem real de envio é depois do 5.

---

## Passo 3 — Cloudflare Workers (publicar o site)

O site + a API + o backup rodam num único **Cloudflare Worker**, com deploy
automático a partir do GitHub (Workers Builds). Não há etapa de build: o
`wrangler.jsonc` já diz o que servir.

1. Crie conta em https://dash.cloudflare.com → confirme o e-mail.
2. Menu lateral **Workers & Pages → Create → Workers → Import a repository**
   (Connect to Git) → autorize o GitHub e escolha o repositório `harmon-ia`
   (aparece depois que eu subir no Passo 2).
3. A Cloudflare lê o `wrangler.jsonc` sozinha (nome `harmon-ia`, `main`
   `worker/index.js`, assets estáticos, cron). Não precisa mexer em build
   command. Clique **Deploy** e espere.
4. Quando terminar, a Cloudflare mostra o endereço público, algo como
   `harmon-ia.SEU-SUBDOMINIO.workers.dev`. **Anote ele como `DOMINIO_PROD`** —
   você vai usar nos próximos passos. Use **o que ela te deu**, exatamente.

> O site vai abrir **quebrado/sem login** por enquanto — normal. Falta ligar o
> Google (Passos 4 e 5) e setar os Secrets (Passo 6).

---

## Passo 4 — Google Cloud (login + agenda)

Aqui você cria a credencial que faz o "Entrar com Google" e a leitura da agenda
funcionarem. É a parte mais cheia de telas — vá com calma.

1. https://console.cloud.google.com → topo da página, **criar projeto** →
   nome `Harmon IA` → criar e selecionar.
2. Busque por **"Google Calendar API"** na barra de busca do topo → **Ativar**.
3. Menu ☰ → **APIs e serviços → Tela de permissão OAuth** (OAuth consent
   screen):
   - Tipo de usuário: **Externo** → Criar.
   - Nome do app: `Harmon IA`. E-mail de suporte: o seu. E-mail do
     desenvolvedor: o seu. Salvar e continuar.
   - **Escopos** → **Adicionar escopos** → procure e marque
     `.../auth/calendar` (Google Calendar API) → Atualizar → Salvar e continuar.
   - **Usuários de teste** → **Adicionar** → coloque o e-mail da profissional
     que vai usar o sistema (e o seu). Enquanto o app não for verificado pelo
     Google, só esses e-mails conseguem entrar — até 100. Salvar.
4. Menu **APIs e serviços → Credenciais → Criar credenciais → ID do cliente
   OAuth**:
   - Tipo de aplicativo: **Aplicativo da Web**.
   - **Origens JavaScript autorizadas** → Adicionar URI, uma por linha:
     - `http://localhost:8000`
     - o seu `DOMINIO_PROD` (ex.: `https://harmon-ia.SEU-SUBDOMINIO.workers.dev`)
       — **sem** barra no final.
   - **URIs de redirecionamento autorizados** → Adicionar:
     - `https://SUPABASE_REF.supabase.co/auth/v1/callback`
       (troque `SUPABASE_REF` pelo seu — ex.:
       `https://abcd1234.supabase.co/auth/v1/callback`).
   - Criar. O Google mostra **Client ID** e **Client Secret** → copie os dois
     pro bloco de notas (`GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET`).

> 🆘 Travou em alguma tela ou o nome do botão está diferente? Me diga em que
> tela está e o que vê, que eu te oriento.

---

## Passo 5 — Ligar o Google no Supabase + preencher o config

**5a. No Supabase:**
1. Menu **Authentication → Providers → Google** → ative → cole o
   `GOOGLE_CLIENT_ID` e o `GOOGLE_CLIENT_SECRET` → Salvar.
2. Menu **Authentication → URL Configuration**:
   - **Site URL** = seu domínio de produção.
   - **Redirect URLs** → **Add URL**:
     - `http://localhost:8000/`
     - `https://SEU-DOMINIO/`  ← **com** a barra no final.
     - `https://SEU-DOMINIO/**`  ← curinga, cobre `/app`, `/entrar.html` etc.

> ⚠️ **Ao trocar de domínio de hosting, refaça este passo.** Se o domínio de
> produção não estiver nas Redirect URLs, o Supabase ignora o `redirectTo` e o
> login com Google volta pra tela de entrar sem criar sessão.
> **Produção atual (13/07/2026):** `https://harmon-ia.otavio-projects.workers.dev`
> (Cloudflare Workers — migrado da Vercel).

**5b. No código (o arquivo de configuração do site):**
1. Duplique `assets/js/config.example.js` com o nome `assets/js/config.js`.
2. Abra o `config.js` e troque pelos seus valores:
   - `SUPABASE_URL` → o seu.
   - `SUPABASE_ANON_KEY` → a sua.
3. Salve. (Esse arquivo agora **vai** pro GitHub de propósito — pode subir.)

> Prefere que eu crie o `config.js` pra você? Me mande assim:
> ```
> Crie o config.js com:
> SUPABASE_URL = <cole aqui>
> SUPABASE_ANON_KEY = <cole aqui>
> ```

---

## Passo 6 — Secrets no Cloudflare Worker (a agenda depende disso)

O Worker renova o acesso à agenda do Google e roda o backup — precisa das
credenciais como **Secrets**. **Sem elas, login funciona mas a Agenda não.**

1. No painel: **Workers & Pages → harmon-ia → Settings → Variables and Secrets**.
2. O `SUPABASE_URL` já vai como **variável pública** (definida no `wrangler.jsonc`).
   Adicione os demais como **Secret** (Encrypt / Add secret):

   | Nome                        | Valor                                   |
   |-----------------------------|-----------------------------------------|
   | `SUPABASE_ANON_KEY`         | sua anon key                            |
   | `SUPABASE_SERVICE_ROLE_KEY` | service_role (Supabase → API) — secreta |
   | `GOOGLE_CLIENT_ID`          | seu Client ID                           |
   | `GOOGLE_CLIENT_SECRET`      | seu Client Secret                       |

   > `SUPABASE_SERVICE_ROLE_KEY` é a chave "secret" (NÃO a anon). O backup usa
   > para ler os dados de cada usuária contornando a RLS. Fica só no servidor,
   > nunca no frontend.

3. **Importante:** Secrets novos valem no próximo deploy. Como você já vai me
   pedir pra subir o `config.js`, o push novo redeploya sozinho (Workers Builds).
   Se precisar forçar: **Deployments → Retry/Redeploy**.

---

## Passo 7 — Testar

1. Abra seu `DOMINIO_PROD` no navegador.
2. **Entrar com Google** → use o e-mail que você pôs em "Usuários de teste".
   O Google vai pedir permissão pra acessar o Calendar — aceite.
3. Você cai no painel. Teste rápido nesta ordem:
   - **Serviços** → criar um serviço.
   - **Clientes** → criar um cliente.
   - **Agenda** → criar um agendamento → confira se ele aparece no seu Google
     Calendar de verdade.
   - **Estoque**, **Histórico**, **Fluxo de Caixa** → dar uma navegada.
4. Opcional: em **Configurações**, preencha o campo **WhatsApp do
   administrador** — ele liga o botão "Enviar no WhatsApp" da lista de
   compras (Estoque). Sem preencher, o app funciona normal, só sem esse atalho.

> 🆘 Algo não funcionou? Aperte **F12** no navegador → aba **Console** →
> tire um print ou copie as linhas vermelhas e me mande. 90% dos problemas aqui
> são uma URL com/sem barra no final nos Passos 4 ou 5 — dá pra achar rápido.

---

## Resumo da ordem (cole no topo da sua tela)

```
1. Supabase: criar projeto → copiar URL/anon → rodar schema.sql
2. (GitHub: eu subo pra você — depois do passo 5)
3. Cloudflare: Workers & Pages → conectar repo → anotar o domínio .workers.dev
4. Google Cloud: ativar Calendar API → tela de consentimento → criar credencial OAuth
5. Supabase: colar credenciais Google + URL Config  |  criar config.js
6. Cloudflare: Secrets (anon, service_role, client id/secret) + redeploy
7. Testar no domínio .workers.dev
```

Onde travar, me chame com **o print/erro daquele passo** — não precisa
resolver sozinho.

---

## Integrações Google — Parte 1 (Contatos)

A sincronização de clientes com o Google Contatos exige três passos manuais uma
única vez. Sem eles, o app continua funcionando normal — só não espelha contatos.

### 1. Google Cloud Console (habilitar APIs)
No projeto OAuth do app: **APIs e serviços → Biblioteca** e ative:
- **People API** (Contatos — usada agora)
- **Google Drive API** e **Google Sheets API** (já deixe ativas p/ a Parte 1 de
  Sheets/Drive das próximas features — usam o mesmo consentimento)

### 2. Tela de consentimento OAuth (escopos)
Em **APIs e serviços → Tela de permissão OAuth → Escopos**, adicione:
- `https://www.googleapis.com/auth/contacts`
- `https://www.googleapis.com/auth/drive.file` (apenas arquivos criados pelo app)

Em modo *Testing*, esses escopos "sensíveis" funcionam para os test users sem
verificação. Para publicar com usuários externos, o Google pede verificação —
`drive.file` é leve; evite escopos "restritos" (Drive total/Gmail).

### 3. Banco (migração idempotente)
No SQL Editor do Supabase, rode a migração nova (ou re-rode `db/schema.sql`
inteiro — é idempotente):

    alter table public.user_settings add column if not exists sync_contacts boolean default true;

### 4. Reconectar no app
Em **Configurações → Google → Reconectar Google**: o consentimento vai pedir as
novas permissões (Contatos/Drive). Aprovar. Depois, **"Sincronizar clientes
agora"** empurra os clientes já cadastrados para o Google Contatos. Dali em diante,
criar/editar/excluir cliente reflete automaticamente (se o toggle estiver ligado).

**Espelho, não base:** nada do Google volta para o Supabase. O contato guarda o
`resourceName` em `clients.google_contact_id` só para saber qual atualizar depois.

---

## Integrações Google — Feature 4 (Backup automático semanal no Drive)

Cada usuária liga/desliga em **Configurações → Dados → "Backup automático semanal"**
(padrão desligado). Um **cron semanal do Cloudflare Worker** (handler `scheduled()`,
domingos 06:00 UTC — definido em `wrangler.jsonc`) varre só quem ligou e salva um
JSON dos dados dela numa pasta "Harmon IA Backups" no Drive dela (mantém os 12
mais recentes). O botão **"Fazer backup no Drive agora"** roda na hora, sem esperar.

### Migração (Supabase SQL Editor)
    alter table public.user_settings add column if not exists backup_enabled boolean default false;

### Secret necessário no Cloudflare (Worker → Settings → Variables and Secrets)
- **SUPABASE_SERVICE_ROLE_KEY** — Supabase → Project Settings → API → `service_role`
  (a chave "secret", NÃO a anon). O backup usa para ler os dados de cada usuária
  contornando a RLS. É secreta: fica só no servidor, nunca no frontend.

> O backup roda pelo próprio agendador do Cloudflare (handler interno), **não**
> fica exposto por HTTP — por isso **não precisa** mais de `CRON_SECRET` (era
> exigido na versão Vercel, onde o cron chamava um endpoint público).

### Testar sem esperar
Ligue o toggle e clique em "Fazer backup no Drive agora" — deve aparecer a pasta
"Harmon IA Backups" com um arquivo no seu Drive.

---

## Restaurar de um backup (Configurações → Dados)

Permite subir um `.json` de backup e **substituir todos os dados atuais** por ele
(reset). Antes de apagar, o app baixa um backup de segurança do estado atual e
pede confirmação digitada. A troca roda numa transação atômica no banco (função
`restore_backup`) — ou vai inteiro, ou não altera nada — e força o `user_id` para
a conta atual (não dá para importar dados de outra pessoa). NÃO mexe em
`user_settings` (tema/cor/conexão Google ficam intactos).

### Migração (Supabase SQL Editor)
Re-rode o `db/schema.sql` inteiro (é idempotente) — ele já traz as funções novas
`restore_backup` e `_force_user`. Sem isso, o botão "Restaurar" dá erro.

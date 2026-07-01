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
DOMINIO_VERCEL    = https://__________.vercel.app   (você descobre no Passo 3)
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

## Passo 3 — Vercel (publicar o site)

1. Crie conta em https://vercel.com → **Continue with GitHub** (use a mesma
   conta do Passo 2). Autorize.
2. **Add New… → Project** → escolha o repositório `harmon-ia` (ele aparece
   depois que eu subir no Passo 2).
3. Não mexa em nada das configurações de build (é site estático, sem build).
   Clique **Deploy** e espere.
4. Quando terminar, a Vercel mostra o endereço público, algo como
   `harmon-ia.vercel.app`. **Anote ele como `DOMINIO_VERCEL`** — você vai usar
   nos próximos passos. ⚠️ Se o nome `harmon-ia` já estiver em uso, a Vercel
   coloca um sufixo aleatório (ex.: `harmon-ia-xk2p.vercel.app`). Use **o que
   ela te deu**, não o que você imaginou.

> O site vai abrir **quebrado/sem login** por enquanto — normal. Falta ligar o
> Google (Passos 4 e 5).

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
     - o seu `DOMINIO_VERCEL` (ex.: `https://harmon-ia.vercel.app`) — **sem**
       barra no final.
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
   - **Site URL** = seu `DOMINIO_VERCEL` (ex.: `https://harmon-ia.vercel.app`).
   - **Redirect URLs** → **Add URL** duas vezes:
     - `http://localhost:8000/`
     - `https://SEU-DOMINIO-VERCEL/`  ← **com** a barra no final.

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

## Passo 6 — Variáveis secretas na Vercel (a agenda depende disso)

A função que renova o acesso à agenda do Google roda no servidor da Vercel e
precisa de 4 variáveis. **Sem elas, login funciona mas a Agenda não.**

1. Na Vercel: seu projeto → **Settings → Environment Variables**.
2. Adicione as 4 (Name → Value), deixando os 3 ambientes marcados:

   | Name                   | Value                          |
   |------------------------|--------------------------------|
   | `GOOGLE_CLIENT_ID`     | seu Client ID                  |
   | `GOOGLE_CLIENT_SECRET` | seu Client Secret              |
   | `SUPABASE_URL`         | seu Project URL                |
   | `SUPABASE_ANON_KEY`    | sua anon key                   |

3. **Importante:** variáveis novas só valem depois de um novo deploy. Vá em
   **Deployments → ⋯ no último → Redeploy**. (Ou, como você já vai me pedir pra
   subir o `config.js`, o envio novo já redeploya sozinho.)

---

## Passo 7 — Testar

1. Abra seu `DOMINIO_VERCEL` no navegador.
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
3. Vercel: importar repo → anotar o domínio .vercel.app
4. Google Cloud: ativar Calendar API → tela de consentimento → criar credencial OAuth
5. Supabase: colar credenciais Google + URL Config  |  criar config.js
6. Vercel: 4 env vars + redeploy
7. Testar no domínio .vercel.app
```

Onde travar, me chame com **o print/erro daquele passo** — não precisa
resolver sozinho.

# Harmon IA

CRM para profissionais de saúde estética. Web app **sem build** (HTML + CSS +
JS vanilla), Supabase (Postgres + Auth + Storage + RLS) e Google Calendar.
Multi-tenant: cada conta Google enxerga só os próprios dados.

---

## Setup (faça uma vez, na ordem)

Você precisa de: conta **Supabase**, projeto no **Google Cloud Console** e
conta **Vercel** (para o deploy e a função de refresh do Google).

### 1. Criar o projeto Supabase
1. https://supabase.com → **New project**. Guarde a senha do banco.
2. Em **Project Settings → API**, copie a **Project URL** e a **anon public key**.

### 2. Rodar o schema
1. No Supabase, abra **SQL Editor → New query**.
2. Cole o conteúdo de [`db/schema.sql`](db/schema.sql) inteiro e clique **Run**.
   - Cria todas as tabelas, RLS, a RPC `register_procedure` e o bucket `uploads`.

### 3. Configurar o OAuth no Google Cloud
1. https://console.cloud.google.com → crie/selecione um projeto.
2. **APIs & Services → Library** → habilite **Google Calendar API**.
3. **OAuth consent screen** → tipo **External** → preencha o básico.
   - Em **Scopes**, adicione `.../auth/calendar`.
   - Em **Test users**, adicione o e-mail da profissional (enquanto o app não
     for verificado pelo Google, só test users entram — até 100).
4. **Credentials → Create credentials → OAuth client ID → Web application**:
   - **Authorized JavaScript origins:** `http://localhost:8000` e o domínio da Vercel.
   - **Authorized redirect URIs:** `https://<SEU-REF>.supabase.co/auth/v1/callback`
     (pegue o `<SEU-REF>` na Project URL do Supabase).
   - Copie o **Client ID** e o **Client Secret**.

### 4. Ligar o Google no Supabase
1. **Authentication → Providers → Google** → habilite e cole **Client ID** + **Secret**.
2. **Authentication → URL Configuration**:
   - **Site URL:** o domínio de produção (ex.: `https://harmon-ia.vercel.app`).
   - **Redirect URLs:** adicione `http://localhost:8000/` **e** `https://<seu-dominio-vercel>/`.

### 5. Configurar o frontend
```bash
cp assets/js/config.example.js assets/js/config.js
# edite config.js com a Project URL e a anon key do passo 1
```

### 6. Rodar local
```bash
python3 -m http.server 8000
# abra http://localhost:8000
```
> Use a porta **8000** para bater com as origens liberadas nos passos 3 e 4.

### 7. Deploy na Vercel
1. `npm i -g vercel@latest` (se ainda não tiver) → `vercel` → `vercel --prod`.
2. No painel da Vercel, **Settings → Environment Variables**, adicione
   (necessárias para a função de refresh do Google, usada pela Agenda):
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
3. `config.js` não vai pro git — recrie-o no ambiente de build **ou** mantenha
   a URL/anon key direto no arquivo (a anon key é pública por design).

---

## Estrutura
```
index.html            login (Google)
app.html              shell (sidebar + conteúdo)
assets/css/*          design system (tokens, layout, components, theme)
assets/js/*           um arquivo por módulo
db/schema.sql         banco completo + RLS + RPC + storage
api/                  função serverless de refresh do Google (etapa Agenda)
```

## Status
- [x] Fundação (schema, RLS, RPC, design system)
- [x] Auth Google + shell + tema claro/escuro
- [x] Serviços · Configurações (conta/tema/backup)
- [ ] Clientes · Estoque · Histórico · Fluxo de Caixa · Agenda

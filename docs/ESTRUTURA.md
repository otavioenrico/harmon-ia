# Estrutura do projeto — Harmon IA

Mapa de "onde mora cada coisa". Atualizado em 14/07/2026, após a migração
Vercel → Cloudflare e a limpeza de sobras.

## Visão geral

CRM para profissionais de estética. **Web app sem build** (HTML + CSS + JS
vanilla). Backend: **Supabase** (Postgres + Auth + Storage + RLS). Integrações:
**Google** (Calendar, Contacts, Drive, Sheets). Hosting: **Cloudflare Worker**
(serve os estáticos + API `/api/google-refresh` + cron de backup), com deploy
automático via GitHub (Workers Builds).

Fluxo de deploy: `git push` → GitHub → Cloudflare Workers Builds → produção em
`harmon-ia.otavio-projects.workers.dev`.

## Árvore (raiz)

```
Harmon IA/
├── *.html                  Páginas servidas na raiz (ver tabela abaixo)
├── assets/                 Front-end estático (css, js, img, fonts)
├── worker/                 Cloudflare Worker (backend): API + cron de backup
├── db/                     SQL do Supabase (schema + migrações)
├── docs/                   Documentação do projeto
├── credenciais/            Segredos locais — NÃO versionado (.gitignore)
│
├── wrangler.jsonc          Config do Cloudflare Worker (nome, main, assets, cron, vars)
├── _headers                Cabeçalhos HTTP/segurança (CSP etc.) aplicados aos estáticos
├── _redirects              Rewrites (ex.: /auth/callback → /entrar.html)
├── .assetsignore           O que o Worker NÃO serve como asset (código-fonte, db, docs…)
│
├── package.json            Scripts (wrangler dev/deploy) + devDep wrangler
├── package-lock.json
├── skills-lock.json        Lockfile de skills de tooling (design/IA)
│
├── robots.txt · sitemap.xml · site.webmanifest   SEO / PWA
├── favicon.svg · favicon-32.png · apple-touch-icon.png · assets/img/icon-*.png
│
├── README.md               Resumo do projeto
├── .env.example            Modelo de variáveis de ambiente (referência)
└── .gitignore
```

> **Migrado para o Cloudflare — não existe mais:** `vercel.json`, pasta `api/`
> (as duas funções serverless viraram `worker/index.js`), `.vercel/`.
> Também removidos do repo: `.agents/`, `.impeccable/`, `graphify-out/` e caches
> locais (`.wrangler/`, `.DS_Store`) — agora tudo no `.gitignore`.

## Páginas (HTML na raiz) e seus scripts

| Página            | Papel                                   | JS principal                    |
|-------------------|-----------------------------------------|---------------------------------|
| `index.html`      | Landing pública (marketing)             | `landing.js`, `waitlist.js`     |
| `solucoes.html`   | Landing — soluções                      | `landing.js` + `i18n/solucoes`  |
| `planos.html`     | Landing — planos                        | `landing.js` + `i18n/planos`    |
| `sobre.html`      | Landing — sobre                         | `landing.js` + `i18n/sobre`     |
| `entrar.html`     | Login (Entrar com Google)               | `entrar.js`, `auth.js`          |
| `app.html`        | Shell do CRM (área logada, SPA por hash)| `app.js` + módulos (ver abaixo) |
| `privacidade.html`· `termos.html` · `cookies.html` | Legais    | `cookie-consent.js` + i18n      |
| `404.html` · `500.html` | Páginas de erro                   | —                               |

## assets/

### assets/js — núcleo
- `app.js` — shell: guarda de sessão, tema, sidebar, roteador por hash.
- `supabase.js` — cliente único do Supabase (CDN ESM, sem build).
- `auth.js` — login com Google (identidade + Calendar no mesmo consentimento).
- `entrar.js` — wiring da página de login (externalizado por causa da CSP).
- `oauth-redirect.js` — trata o retorno do OAuth que cai na raiz.
- `utils.js` — helpers compartilhados: formatação, máscaras, toast, modal, CSV.

### assets/js — módulos do CRM (rotas do app.html)
- `home.js` — Início: visão geral do dia (rota padrão).
- `agenda.js` — Agenda apoiada no Google Calendar (fonte da verdade).
- `clientes.js` — cadastro de clientes (tabela + formulário).
- `servicos.js` — catálogo de serviços (CRUD; padrão dos demais módulos).
- `estoque.js` — controle de estoque (alerta de mínimo, CRUD).
- `financeiro.js` — Fluxo de Caixa (parcelas / financial_entries).
- `historico.js` — registro e histórico de procedimentos.
- `configuracoes.js` — Conta, Google, Aparência e Dados (backup).

### assets/js — integrações Google
- `google-cal.js` — acesso ao Google Calendar (renova token via `/api/google-refresh`).
- `google-people.js` — espelha clientes no Google Contatos (People API).
- `google-drive.js` — sobe arquivos ao Drive do usuário (Drive API, escopo drive.file).
- `google-sheets.js` — exporta dados para planilha nova no Drive.

### assets/js — landing e i18n
- `landing.js` — motion do site público (scroll-reveal, menu).
- `waitlist.js` — captura de e-mail da lista de espera.
- `cookie-consent.js` — banner de consentimento (vanilla).
- `i18n.js` · `i18n-head.js` — motor de tradução PT/EN.
- `i18n/` — dicionários por página (`common`, `index`, `solucoes`, `planos`,
  `sobre`, `entrar`, `cookies`, `privacidade`, `termos` + `boot.js`, `index.js`).

### assets/js — config (não commitado o real)
- `config.example.js` — modelo. Copie para `config.js` e preencha.
- `config.js` — SUPABASE_URL + anon key do projeto (vai pro git de propósito;
  a anon key é pública e a RLS protege os dados).

### assets/css
`tokens.css` (variáveis) · `theme.css` · `layout.css` · `components.css` ·
`landing.css` · `accent.css` · `motion.css` · `i18n.css` · `cookie-banner.css`.

### assets/img e assets/fonts
- `img/` — `hero-banner-bw.webp`, `og-image.png`, ícones PWA (`icon-192/512`),
  `solucoes/*.svg` (ilustrações da página soluções).
- `fonts/` — família Satoshi (variable + italic, `.woff2`).

## worker/ — backend (Cloudflare)
- `worker/index.js` — Worker único:
  - `fetch()` serve os estáticos e responde `POST /api/google-refresh`
    (troca o refresh_token por um access_token fresco, sob RLS).
  - `scheduled()` roda o **backup semanal** (domingo 06:00 UTC) para cada
    usuária com backup ligado; salva JSON no Drive dela (mantém os 12 últimos).
  - Substitui as antigas funções serverless do Vercel (`api/google-refresh.js`
    e `api/backup.js`).
  - Secrets no painel: `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
    `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (`SUPABASE_URL` é var pública).

## db/ — Supabase (SQL)
- `schema.sql` — **fonte da verdade**, idempotente (tabelas, RLS, funções,
  bucket). Re-rodar aplica mudanças sem apagar dados.
- `migration-*.sql` — migrações pontuais (arquivar serviços, pagamentos
  overview, waitlist).
- `test-update-completed-procedure.sql` — script de teste.

## docs/ — documentação
- `SETUP.md` — guia passo a passo para colocar no ar (Supabase → GitHub →
  Cloudflare → Google).
- `HISTORICO.md` — changelog cronológico (inclui o histórico Vercel — mantido).
- `ESTRUTURA.md` — **este arquivo** (mapa do projeto).
- `APRIMORAMENTOS-PENDENTES.md` — backlog.
- `DIAGNOSTICO-SITE.md` · `PLANO-SITE-PROFISSIONAL.md` — notas de site/landing.
- `specs/` — specs datadas de features.

## Infra / config (referência rápida)
| Arquivo          | Para quê                                                    |
|------------------|-------------------------------------------------------------|
| `wrangler.jsonc` | Config do Worker: nome, `main`, assets, cron, var pública   |
| `_headers`       | Cabeçalhos de segurança (CSP, HSTS, X-Frame-Options…)       |
| `_redirects`     | Rewrites de rota (`/auth/callback` → `/entrar.html`)        |
| `.assetsignore`  | Arquivos/pastas que o Worker NÃO expõe como estáticos       |
| `.gitignore`     | O que fica fora do git (segredos, caches, tooling local)    |
| `.env.example`   | Modelo de variáveis de ambiente                             |

## Não versionado / não servido
`credenciais/` (segredos) · `node_modules/` · `.wrangler/` (cache) ·
`.claude/` · `.codex/` (tooling local) — todos no `.gitignore`. O `.assetsignore`
garante que código-fonte, `db/`, `docs/`, `worker/` e configs não sejam servidos
como página.

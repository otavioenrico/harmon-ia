# Harmon IA

CRM para profissionais de saúde estética. Web app **sem build** (HTML + CSS +
JS vanilla), Supabase (Postgres + Auth + Storage + RLS) e Google Calendar.
Multi-tenant: cada conta Google enxerga só os próprios dados.

> Nome/marca/domínio ainda vão mudar (rebrand em standby) — "Harmon IA" é o
> valor provisório usado no código.

---

## Setup

Guia completo, passo a passo, pra quem nunca fez: [`docs/SETUP.md`](docs/SETUP.md).

Resumo pra quem já manja:
1. Rode [`db/schema.sql`](db/schema.sql) inteiro no SQL Editor do Supabase (idempotente).
2. Crie um OAuth client no Google Cloud (Calendar API) e ligue o provider Google no Supabase.
3. `cp assets/js/config.example.js assets/js/config.js` e preencha URL/anon key do Supabase.
4. `python3 -m http.server 8000` para rodar local.
5. Deploy: `vercel --prod`, com `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` nas env vars da Vercel.

## Estrutura
```
index.html, sobre.html, solucoes.html,   site público (landing + páginas legais)
planos.html, entrar.html, privacidade/
termos/cookies.html, 404/500.html
app.html                                 shell do app (sidebar + conteúdo, pós-login)
assets/css/*                             design system (tokens, layout, components, theme)
assets/js/*                              um módulo por arquivo (contrato: render(root, ctx))
db/schema.sql                            banco completo — tabelas + RLS + RPCs + storage
api/                                     funções serverless (refresh do Google, backup)
docs/                                    guias, histórico e specs de features
```

## Status
- [x] App: fundação (schema/RLS/RPC), auth Google, tema claro/escuro
- [x] App: Serviços, Configurações, Clientes, Estoque, Histórico, Fluxo de Caixa, Agenda
- [x] Site público: landing, páginas legais (LGPD), SEO técnico, headers de segurança, PWA, acessibilidade WCAG 2.2 AA
- [ ] Rebrand (marca/logo/domínio final) — em standby

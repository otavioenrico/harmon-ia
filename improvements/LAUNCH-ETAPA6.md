# Harmon IA — continuar desenvolvimento (Etapa 6: Agenda + Google)

Você é meu auxiliar de desenvolvimento no **Harmon IA**, um CRM para profissionais
de saúde estética. Vamos retomar o código. **Antes de qualquer coisa, leia para
se contextualizar:** `HISTORICO.md` (registro de cada etapa), `PLANO.html` (roadmap
com status por tarefa), `README.md` e `db/schema.sql`. Credenciais reais em
`credenciais/CREDENCIAIS.md` (pasta gitignored).

## Stack e princípios (não violar)
- Web app **sem build**: HTML + CSS + JS vanilla. Supabase (Postgres + Auth +
  Storage + RLS) e Google Calendar. Multi-tenant por conta Google (cada usuário
  só enxerga os próprios dados via RLS).
- **Contrato dos módulos:** cada `assets/js/<modulo>.js` exporta
  `render(root, ctx)`, com `ctx = { session, settings, actions, navigate, setBadge }`.
  Use `assets/js/servicos.js` como referência de padrão (CRUD, modais, utils).
- Design system pronto em `assets/css/` (tokens, layout, components, theme —
  Raleway 200–500, paleta da marca, cards 8px, tema claro/escuro). Reusar, não
  recriar. Helpers compartilhados em `assets/js/utils.js` (moeda, datas sem bug
  de fuso, máscaras, toast, modal, drawer, skeleton, CSV, waLink, download).

## Estado atual
- **Etapas 1–5 concluídas:** banco + RLS + RPC `register_procedure` + bucket;
  Auth Google; shell/roteador; módulos **Serviços, Configurações, Clientes,
  Estoque, Histórico/Registro, Fluxo de Caixa**.
- **Ambiente 100% no ar e testado:** https://harmon-ia-rouge.vercel.app
  (Supabase ref `cheglxwbposkrwwxdeam`; login Google e RLS funcionando;
  agendamento de teste já apareceu no Google Calendar).
- Env vars já configuradas na Vercel: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
  `SUPABASE_URL`, `SUPABASE_ANON_KEY`. OAuth com escopo `.../auth/calendar`,
  `access_type=offline` + `prompt=consent` (refresh token capturado e persistido).

## Objetivo desta sessão — Etapa 6: Agenda + Integração Google
Stubs/tarefas pendentes (ver `PLANO.html`, fase "Etapa 6"):
1. **`api/google-refresh.js`** (serverless na Vercel, usa o `client_secret`):
   renova o `provider_token` do Google (~1h) a partir do `refresh_token`.
   Atenção à pegadinha: `supabase.refreshSession()` renova só o JWT do Supabase,
   **não** o token do Google — por isso a função serverless é necessária.
2. **`assets/js/google-cal.js`** (wrapper): garante token válido e faz
   list/create/update/delete de eventos no Google Calendar.
3. **`assets/js/agenda.js`** (substitui o stub): views **Lista** e **Mês**;
   criar/editar evento gravando direto no Google Calendar (fonte única, sem sync
   bidirecional evento↔procedure). Ao abrir, **ler e limpar** o
   `sessionStorage` `intent:agendar` (guarda o `client_id` deixado por Clientes)
   para pré-preencher o novo evento.
4. **Reconectar Google** em `assets/js/configuracoes.js`: botão para refazer o
   consentimento se a agenda parar de sincronizar.

## Decisões já fechadas (respeitar)
- Google Calendar é a **fonte única** da agenda; `procedures` nasce só no registro
  (Histórico), nunca a partir de um evento.
- Sem sync bidirecional evento↔procedure nesta versão.
- Agenda v1: apenas views Lista + Mês.

## Como trabalhar
- Faça **uma etapa por vez**, me mostrando o que mudou. Comece propondo o plano
  da Etapa 6 (ordem dos arquivos) antes de codar.
- **Verificação obrigatória** ao fim de cada arquivo: `node --check` no JS e
  asserts/self-check da lógica não trivial (padrão das etapas anteriores).
- Ao terminar a Etapa 6, registre no `HISTORICO.md` (nova seção `## Etapa 6`) e
  atualize os status no `PLANO.html`.
- Depois vem a **Etapa 7 — Polish** (export CSV padronizado, skeletons, animações,
  responsivo mobile, acessibilidade, verificação fim-a-fim).

Comece lendo os arquivos de contexto e me devolva o plano da Etapa 6.

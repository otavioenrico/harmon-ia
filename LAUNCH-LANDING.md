# Harmon IA — Etapa 7: Landing page comercial (pré-lançamento)

Você é meu auxiliar de desenvolvimento no **Harmon IA**, um CRM para profissionais
de saúde estética. **Antes de qualquer coisa, leia para se contextualizar:**
`PLANO-LANDING.md` (a spec desta etapa — sua fonte de verdade), `HISTORICO.md`,
`PLANO.html`, `README.md`, `db/schema.sql`. Credenciais em
`credenciais/CREDENCIAIS.md` (pasta gitignored).

## Stack e princípios (não violar)
- Web app **sem build**: HTML + CSS + JS vanilla. Supabase (Postgres + Auth +
  Storage + RLS) e Google Calendar. Multi-tenant por conta Google (RLS).
- **Design system pronto** em `assets/css/` (tokens, layout, components, theme,
  accent — fonte **Satoshi**, paleta mauve, tema claro/escuro, cards 8px).
  **Reusar, não recriar.** Helpers em `assets/js/utils.js` (toast, etc.).
- Produção: https://harmon-ia-rouge.vercel.app (Supabase ref `cheglxwbposkrwwxdeam`).

## Objetivo desta sessão
Criar o **site comercial** em **modo pré-lançamento**, seguindo `PLANO-LANDING.md`
à risca. Em resumo (detalhes e decisões estão no PLANO):
1. **Remanejar rotas sem quebrar o auth (§3):** `index.html` (login) → `entrar.html`;
   novo `index.html` = home. Ajustar `auth.js` + `vercel.json`. **Rodar o teste de
   fumaça §3.3 antes de seguir.**
2. **Modo pré-lançamento (§2.5):** badge "Em breve", **lista de espera** (tabela
   `waitlist` + `assets/js/waitlist.js`) e **bloqueio de cadastro** por allowlist.
3. **Três páginas** (§5): Início (`index.html`), Sobre (`sobre.html`), Planos
   (`planos.html`), com header/footer compartilhados (§6) e `assets/css/landing.css`.
4. **Estética elevenlabs × Harmon (§4):** hierarquia/contraste/respiro da
   elevenlabs.io, mas com nossos tokens (Satoshi, mauve, tema). Antes de codar o
   visual, rodar a skill `boas-praticas-design` (GERAR SPECS).

## Decisões já fechadas (respeitar — ver PLANO)
- Rotas: landing na raiz, login em `entrar.html`, app em `app.html`.
- Só 3 páginas (Início, Sobre, Planos); PT-BR; preços = placeholders `<!-- TROCAR -->`.
- Nome "Harmon IA" é **placeholder** — centralizar p/ rename futuro (§8). Não é
  esta etapa criar marca nova.
- Cadastro público **bloqueado**; só e-mails da `allowlist` entram no app.

## Como trabalhar
- Uma etapa por vez, na **ordem do §9**, me mostrando o que mudou antes de seguir.
- Comece **confirmando o plano da Etapa 7** (ordem dos arquivos) e me apontando
  qualquer decisão em aberto (ex.: allowlist via tabela vs hardcoded — default do
  PLANO = tabela).
- **Verificação obrigatória (§10):** `node --check` no JS tocado, **teste de
  fumaça do auth (§3.3)** e do pré-lançamento, verificação visual (desktop 1280 +
  mobile 390×844) como nas rodadas anteriores.
- **Não** commitar/pushar/deployar sem minha revisão visual (padrão da casa).
- Ao terminar, registre `## Etapa 7 — Landing` no `HISTORICO.md`, atualize
  `PLANO.html` e liste os pontos onde o nome da marca aparece (§8).

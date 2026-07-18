# Plano de Execução por Agentes — Etapas 2–6 da Esteira

**Papel deste arquivo:** contrato de orquestração. Uma sessão do Claude Code (rodando em **Opus**) lê este plano e executa uma onda por vez com um time de agentes. Você só participa nos **gates** entre ondas.

**Como rodar (uma onda por vez, na ordem):**

```bash
cd "/Users/usuario/Otávio/Claude/Projetos/Harmon IA"
claude --model opus "/executar-onda 1"
```

Depois do gate da onda 1: `claude --model opus "/executar-onda 2"` — e assim por diante até a 6.

---

## 1. Escopo

**Dentro (30 itens, tudo código, R$ 0):** etapas 2–6 do `docs/plano-master.html`.

**Fora (não é dos agentes):**
- Etapa 1 (P0): ações manuais suas nos painéis — pré-requisito da onda 1.
- Etapa 7+ : marca, domínio, billing, WhatsApp API, tudo pago.
- Decisões de gosto (nome, logo, preço final).

**Parciais (código pronto, plug seu no gate):**
- 2.4 screenshots reais → agentes entregam o seed demo + estrutura das seções; a captura das telas fica pra você (app rodando com dados).
- 2.5 PostHog → instrumentação completa atrás do consent, chave em placeholder `POSTHOG_KEY`.
- 6.6 Sentry → integração com DSN em placeholder.
- 6.7 staging → wrangler env + script de seed prontos; criar o projeto Supabase de staging é clique seu.

---

## 2. O time

| Papel | Quem | Responsabilidade |
|---|---|---|
| **Arquiteto** | loop principal da sessão | Lê este plano, monta o Workflow da onda, decide sequência, consolida relatório. Não escreve feature — escreve o script. |
| **Agente de Schema** | 1 por onda, serializado | ÚNICO que toca `db/schema.sql` + cria `db/migration-onda-N.sql` (idempotente). Roda antes dos builders. Elimina conflito de merge no schema. |
| **Builders** | 1 por item (paralelo por dono-de-arquivo) | Implementam o item seguindo o passo a passo do plano-master.html. Um builder por arquivo-alvo; itens que disputam o mesmo arquivo rodam em sequência no MESMO builder. |
| **Revisores adversariais** | 2 por item arquitetural, 1 por item comum | Prompt: REFUTAR. Procuram bug de RLS, corrida, XSS, quebra de contrato de módulo. Item arquitetural (marcado ⚠️) só passa com os 2 revisores sem achado ALTO. |
| **Verificador** | 1 no fim da onda | `node --check` em todo JS tocado, valida schema idempotente (regex de `if not exists`/`or replace`), confere invariantes (§5), gera o checklist de teste manual do gate. |

Modelo: a sessão roda em Opus (`--model opus`), agentes herdam. Não fixar modelo por agente no script.

---

## 3. Protocolo de uma onda (o Arquiteto segue à risca)

1. **Preflight:** working tree limpa (senão parar e avisar); `git checkout -b onda-N` a partir da main; ler os itens da onda em `docs/PLANO.md` (fonte canônica — mesmos itens do plano-master.html) e os arquivos-alvo reais.
2. **Fase Schema:** Agente de Schema escreve TODAS as mudanças de banco da onda de uma vez (`schema.sql` + `db/migration-onda-N.sql`). Commit próprio.
3. **Fase Build:** Workflow com builders em paralelo (respeitando dono-de-arquivo). Cada builder recebe: o item completo (o que é / o que faz / passos), os invariantes (§5), o padrão de referência (`assets/js/servicos.js`, contrato `render(root, ctx)`), e o schema já commitado.
4. **Fase Review:** revisores adversariais por item, paralelos. Achado ALTO → volta pro builder (máx. 2 rodadas); PLAUSÍVEL sem confirmação → anotar no relatório, não bloquear.
5. **Fase Verify:** verificador roda os checks e escreve `docs/relatorios/onda-N.md`: o que foi feito, achados aceitos/rejeitados, **checklist de teste manual do gate**, ações manuais suas (ex.: rodar migração no SQL Editor).
6. **Commits:** 1 commit por item (`feat(area): item X.Y — título`), na branch da onda. **Nunca** commitar na main, **nunca** dar push sem o usuário pedir, **nunca** mexer em segredo.
7. **Encerramento:** atualizar §7 (Estado) deste arquivo, imprimir resumo + gate. **Parar.** Não emendar a onda seguinte.

**Regras de parada:** teste falhando sem correção óbvia, dúvida de produto (ex.: "cancelamento devolve sessão de pacote?" se o plano não cobre), ou 2 rodadas de review sem convergir → parar e perguntar. Autonomia é sobre execução, não sobre decisão de produto nova.

---

## 4. As ondas

Ordem por dependência técnica, não pela numeração da esteira. Site primeiro (risco zero, valor imediato), fundação do app depois, features em cima.

### Onda 1 — Site & posicionamento (itens 2.2, 2.3, 2.4*, 2.5*)
Sem dependência do app. Arquivos: `index.html`, `planos.html`, `sobre.html`, `solucoes.html`, `assets/js/landing.js`, `assets/js/waitlist.js`, `assets/css/landing.css`, `sitemap.xml`, páginas novas `para/<segmento>.html`.
- 2.2 Copy v2 horizontal (hero, anti-add-on, números, CTAs, FAQ, marquee dos 3 anéis).
- 2.3 Hub de segmento: template + 8 páginas (lash, sobrancelha, skincare, micro, barbearia, massoterapia, podologia, tatuagem) + nav "Para quem" + sitemap.
- 2.4 parcial: seed demo (script SQL/JS de dados fictícios bonitos), card Team → "Estúdio — em breve" com `source: 'waitlist-estudio'`, tabela comparativa de custo real, CTA em sobre, waitlist em solucoes.
- 2.5 parcial: eventos PostHog atrás do `window.onCookieConsent` com `POSTHOG_KEY` placeholder.
- ⚠️ nenhum. **Gate 1:** você revisa o site visualmente, captura screenshots com o seed, roda `npx wrangler deploy`, mergeia.

### Onda 2 — Fundação do app (itens 3.1 ⚠️, 3.2 ⚠️, 6.5)
O refactor que destrava tudo. Arquivos: `db/schema.sql`, `assets/js/agenda.js`, `auth.js`, `entrar.js`, `entrar.html`, `app.js`, `google-cal.js`, `utils.js`, módulos com paginação.
- 3.1 Agenda própria (start_time/duration no banco, Google vira espelho, disponibilidade, buffers, recorrência, backfill dos eventos).
- 3.2 Login e-mail/senha + toda função Google condicional + desconectar com opções.
- 6.5 Escala técnica: RPC atômica de estoque, paginação server-side, varrer os 11 `ponytail:`.
- ⚠️ 3.1 e 3.2: 2 revisores cada (um foca RLS/atomicidade, outro foca fluxo de auth/rollback). **Gate 2 (o mais importante):** rodar `db/migration-onda-2.sql` no Supabase, testar agenda + login a fundo com o checklist do relatório, só então mergear.

### Onda 3 — Núcleo vertical (itens 3.3 ⚠️, 3.4, 3.5 ⚠️, 3.6, 3.7, 3.8, 3.9)
Depende da onda 2 mergeada. Donos de arquivo: fichas/fotos (`fichas.js` novo + `clientes.js`), pacotes (`pacotes.js` novo + RPCs), estoque (3.6 + 3.7 no MESMO builder — `estoque.js`), LGPD (`configuracoes.js` + worker), importador (`importar.js` novo).
- ⚠️ 3.3 (dado sensível, assinatura/hash) e 3.5 (RPC de saldo — o bug público do Belle é aqui): 2 revisores + casos de borda obrigatórios no review.
- **Gate 3:** migração + teste manual de fichas/pacotes/venda.

### Onda 4 — Financeiro (itens 4.1 → 4.8)
Depende da onda 3 (venda avulsa alimenta DRE). `financeiro.js` é gargalo: 4.1, 4.2 (schema+UI), 4.3, 4.4 podem ser paralelos (arquivos distintos); 4.5 (relatorios.js novo), 4.6, 4.7 (orcamentos.js novo), 4.8 em segunda leva. Sequência interna obrigatória: 4.1 antes de 4.5; 4.2+4.3 antes de 4.6.
- ⚠️ 4.5 DRE (números errados matam confiança) e 4.7 página pública de orçamento (token público → review de segurança).
- **Gate 4:** migração + conferir DRE contra um mês real seu.

### Onda 5 — Retenção grátis (itens 5.1, 5.2, 5.3, 5.4)
Depende da onda 2 (agenda própria alimenta gatilhos). `mensagens.js` novo, `worker/index.js` (cron de e-mail), páginas públicas NPS.
- ⚠️ 5.2 cron de e-mail (idempotência — não pode mandar 2x) — revisor foca o log de envios.
- **Gate 5:** migração + testar central com seus dados + 1 e-mail de teste real.

### Onda 6 — Alcance (itens 6.1 ⚠️, 6.2, 6.3, 6.4, 6.6*, 6.7*)
Depende das ondas 2–5. `worker/index.js` (rotas públicas), `booking/` novo, service worker, `onboarding.js`.
- ⚠️ 6.1 booking público: superfície anônima → 2 revisores de segurança (policies públicas read-only, Turnstile, abuso de slots).
- **Gate 6:** migração + agendar como cliente final de ponta a ponta + instalar o PWA no celular.

---

## 5. Invariantes (todo builder e revisor recebe isto)

1. **No-build:** HTML/CSS/JS vanilla, ES modules, zero dependência npm no front, zero CDN novo (CSP fecha).
2. **Multi-tenant:** toda tabela nova com RLS `auth.uid() = user_id` (USING + WITH CHECK) + índice em user_id. Escrita composta = RPC atômica `security invoker` com checagem de `auth.uid()`.
3. **Schema:** `db/schema.sql` continua idempotente (`if not exists` / `create or replace`); cada onda gera também `db/migration-onda-N.sql` isolada.
4. **Contrato de módulo:** `render(root, ctx)`, ctx = `{ session, settings, actions, navigate, setBadge }`; padrão de referência `servicos.js`; helpers de `utils.js` (modais, drawers, toasts, autocomplete, confirmDialog, guard) — não reinventar.
5. **Segurança:** nenhum segredo em código; sanitizar toda URL/href (só http/https); escaping de conteúdo do usuário; páginas públicas novas (orçamento, NPS, booking) sempre por token não-sequencial + rate limit/Turnstile onde houver escrita anônima.
6. **UX/A11y:** focus trap nos modais, `:focus-visible`, `prefers-reduced-motion`, touch 40px, PT-BR em toda string.
7. **Google é opcional** a partir da onda 2: toda chamada Google embrulhada em "conectado?".
8. **Atalho deliberado = comentário `ponytail:`** com o teto e o caminho de upgrade.
9. **Git:** branch da onda, commit por item, sem push, sem tocar na main.

---

## 6. O que você faz em cada gate (resumo)

| Gate | Suas ações |
|---|---|
| 1 | Olhar o site, capturar screenshots com o seed, deploy, merge |
| 2 | Rodar `migration-onda-2.sql`, testar agenda+login pelo checklist, merge |
| 3–5 | Rodar a migração da onda, checklist de teste do relatório, merge |
| 6 | Idem + teste de booking como cliente + PWA no celular |
| plugs | `POSTHOG_KEY` (onda 1), DSN Sentry e projeto Supabase staging (onda 6) |

---

## 7. Estado (o orquestrador atualiza aqui)

- [ ] Onda 1 — Site & posicionamento · branch `onda-1` · relatório: —
- [ ] Onda 2 — Fundação do app · branch `onda-2` · relatório: —
- [ ] Onda 3 — Núcleo vertical · branch `onda-3` · relatório: —
- [ ] Onda 4 — Financeiro · branch `onda-4` · relatório: —
- [ ] Onda 5 — Retenção · branch `onda-5` · relatório: —
- [ ] Onda 6 — Alcance · branch `onda-6` · relatório: —

Pré-requisito global: Etapa 1 do plano (P0 manual) concluída — sobretudo 1.1/1.2.

# Relatório do Gate — Onda 1 (branch `onda-1`)

Data: 2026-07-18 · Verificador final da onda · **Resultado: APROVADO (checks 1–7 OK, nenhum achado ALTO pendente)**

---

## a) O que foi feito (itens 2.2 / 2.3 / 2.4 / 2.5)

### 2.2 — Home + nav (index.html, i18n/index.js, nav nas demais páginas)
- Hero canônico: "Agenda cheia, caixa no azul e cliente que volta." + subtítulo de hora marcada, com microcopy do lançamento junto ao CTA da waitlist ("35 dias grátis · sem cartão · sem multa") — sem prometer acesso imediato.
- Nav desktop/mobile com dropdown "Para quem" (`<details>` nativo, acessível por teclado), replicado em planos/sobre/solucoes e nas 8 páginas de segmento, preservando `aria-current` e lang-switch.
- Marquee ampliado de 10 → 17 chips cobrindo os 3 anéis (novos: massoterapia, podologia, fisioterapia, banho e tosa, fotografia, aulas particulares, consultoria).
- Nova seção de números de prova (`.stat-grid`) com os 3 números autorizados (−30 a −70% faltas / +33% receita / 46–58% fora do horário) e atribuição honesta ("estudos do setor").
- Nova seção anti-add-on: "O WhatsApp automático que cobram R$ 150–229/mês de módulo? Aqui já vem no plano." + tabela `.compare-table` (Trinks R$ 76 / outros R$ 39,90–69 / Harmon IA `.is-us`) + rodapé "preços públicos consultados em 18/07/2026".
- FAQ reescrito com 5 objeções (ramo, trocar de Trinks/Belle, migração grátis, LGPD/segurança, celular) e JSON-LD FAQPage sincronizado.
- Vocabulário neutro ("por atendimento"); title/meta/OG no posicionamento horizontal. Dicionário 100% pt/en.

### 2.3 — Hub de 8 landing pages por segmento (/para/)
- 8 páginas: lash, sobrancelha, skincare, micropigmentacao, barbearia, massoterapia, podologia, tatuagem — template fixo: hero do nicho com waitlist própria (`data-source="waitlist-para-<slug>"`, honeypot, widget + script do Turnstile), 3 dores antes/depois, 4 features contextualizadas, 3 números de prova autorizados, CTA final com microcopy honesta do lançamento.
- SEO por página: title "Sistema de agendamento para [nicho] — Harmon IA", meta description própria, canonical, OG/Twitter; as 8 URLs adicionadas ao sitemap.xml.
- i18n integral PT/EN: 8 dicionários novos (`para-<slug>.js`) + chaves compartilhadas em `common.js`.
- Infra compartilhada em `landing.css` (tudo append, CSS existente intacto): dropdown "Para quem", bloco do menu mobile, `.compare-table` responsiva (scroll horizontal próprio, nunca estoura o body), `.plan-card--soon`, estilos do template de segmento.
- Assets com caminhos absolutos (páginas em subdiretório); hash CSP do script inline confere byte a byte; beacon do Web Analytics incluído para medição por segmento (prepara o 2.5).

### 2.4 — planos / sobre / solucoes + seed demo
- **2.4.1** `db/seed-demo.sql`: dois blocos `DO $$` (estética e barbearia), `demo_user` constante com guard que aborta no placeholder; 8 clientes + 6 serviços + agenda seg→sáb da semana corrente cheia + semana anterior concluída + estoque com 1 item abaixo do mínimo + caixa positivo com 2 pendentes; idempotente (UUIDs fixos + `ON CONFLICT DO NOTHING`).
- **2.4.3** aplicado na home (ver 2.2).
- **2.4.4** sobre.html: cta-band final linkando `/#waitlist-hero` com microcopy "35 dias grátis · sem cartão · sem multa".
- **2.4.5** planos.html: card "Team R$ --" virou "Estúdio — em breve" (`.plan-card--soon` + badge, copy curta neutra, form waitlist próprio `data-source="waitlist-estudio"` com honeypot + Turnstile, microcopy do lançamento). solucoes.html: CTA final trocado de âncora por form waitlist funcional `data-source="waitlist-solucoes"` (Turnstile + waitlist.js adicionados; âncoras do header apontam pro form local). Vocabulário alinhado ("hora marcada"; sem "clínica"/"procedimento"; Team→Estúdio em copy, FAQ, JSON-LD e metas).

### 2.5 — Analytics (parcial, por design)
- `assets/js/analytics.js`: PostHog US Cloud atrás do consent `'all'`; guard de placeholder `POSTHOG_KEY` (zero rede, zero erro no console); `window.hrmTrack` sempre definido como no-op silencioso; hook `onCookieConsent` preserva callback anterior + fallback via localStorage; `autocapture: false` e session recording desligado.
- `waitlist.js` importa `initAnalytics()` e dispara `waitlist_submit {page, segment de /para/<slug>, source}` no sucesso, sem nunca lançar.
- CSP em `_headers`: `us-assets.i.posthog.com` (script-src) e `us.i.posthog.com` + `us-assets.i.posthog.com` (connect-src).
- Pendente do usuário: criar o projeto PostHog e trocar a chave (ver seção e).

---

## b) Achados do review

### ALTO
Todos os achados ALTO do review adversarial **convergiram durante a onda** (corrigidos pelos builders antes deste gate). Nenhum ALTO pendente.

### MÉDIO / BAIXO — registrados, não-bloqueantes para o Gate 1 (backlog)
Nenhum dos itens abaixo quebra build, i18n, links, forms ou CSP. São dívidas de consistência/honestidade de copy e robustez a tratar (sugestão: mini-onda de polimento antes do lançamento público).

| Sev | Onde | Achado |
|---|---|---|
| MÉDIO | docs/ANALISE-CUSTOS-PRICING.md | Preços de concorrentes sem fonte no doc, mas o site afirma "Preços públicos consultados em 18/07/2026" — anexar prints/URLs das fontes. |
| MÉDIO | index.html | Seção de números afirma no presente que o Harmon IA "automatiza" lembrete de WhatsApp e agendamento online — nenhum dos dois existe no app ainda. |
| MÉDIO | solucoes.html | Vende "fotos de antes e depois" como módulo em ação — feature inexistente (Etapa 3.4). |
| MÉDIO | solucoes.html | Plano Estúdio descrito no presente, sem o "em breve" das outras páginas — inconsistência que o 2.4.5 deveria ter fechado. |
| MÉDIO | solucoes.html | "Contatos importados do Google" anuncia a direção inversa da feature real (espelho Supabase→Google). |
| MÉDIO | para/*.html (8 págs) | Canonical/og:url/sitemap usam URLs `.html` que retornam 307 na produção (clean URLs). |
| MÉDIO | assets/js/landing.js | Dropdown desktop "Para quem" não fecha com Esc nem clique-fora. |
| MÉDIO | para/*.html (8 págs) | Números de prova sem a atribuição "estudos do setor" presente na home. |
| MÉDIO | para/*.html (8 págs) | PLANO 2.3.3 exige links de segmento no rodapé; nenhum rodapé os tem. |
| MÉDIO | db/seed-demo.sql | "Blocos independentes" é falso: rodar o arquivo inteiro com só um `demo_user` trocado desfaz tudo (transação única do SQL Editor). |
| MÉDIO | db/seed-demo.sql | Tema/accent do perfil nunca é aplicado: `ON CONFLICT DO NOTHING` colide com a linha que o login já criou. |
| MÉDIO | db/seed-demo.sql | Procedimentos "completed" da semana corrente sem lançamento no caixa — viola a regra B do app (concluído = recebido). |
| MÉDIO | assets/js/waitlist.js | Com 2 widgets Turnstile em planos.html, retry do form principal reseta o widget errado — retry preso em 403 com secret real. |
| MÉDIO | assets/js/analytics.js | Consent `'all'` reaproveitado/desinformado: ativar a POSTHOG_KEY liga rastreamento sob consentimento dado quando o site prometia "não usamos analytics" — atualizar o texto do banner/política antes de ativar a chave. |
| BAIXO | assets/js/i18n/index.js | Dicionário perde o `&nbsp;` antes da seta nos 4 CTAs (i18n roda também em PT). |
| BAIXO | planos.html | Comentário stale "Chave de TESTE (sempre passa)" replicado nos forms novos com sitekey que não é de teste. |
| BAIXO | assets/css/landing.css | Template sem o "screenshot contextualizado" do PLANO 2.3.1 — atalho sem marcador `ponytail:`. |
| BAIXO | solucoes.html | Card 6 promete recursos do Estúdio no presente, sem o qualificador "em construção" de planos.html. |
| BAIXO | db/seed-demo.sql | Histórico de movimentações de estoque não fecha com o saldo do item. |
| BAIXO | sobre.html | Copy do CTA contradiz planos: "Estamos abrindo vagas aos poucos" vs "Ainda não abrimos". |
| BAIXO | planos.html | Taxonomia de `data-source` inconsistente na coluna `waitlist.source` (`hero`, `planos`, `waitlist-estudio`, `waitlist-solucoes`, `waitlist-para-*`). |
| BAIXO | assets/js/analytics.js | Hook ignora consent `'essential'`: sem `opt_out_capturing` nem limpeza da persistência `ph_*` após revogação. |

---

## c) Resultado dos checks automáticos do verificador

Todos executados de verdade nesta máquina em 2026-07-18 (script em scratchpad, saída íntegra conferida).

| # | Check | Resultado |
|---|---|---|
| 1 | `node --check` em todos os 15 .js tocados (waitlist, analytics, common, index, planos, sobre, solucoes, 8× para-*) | **PASS** — 15/15 OK |
| 2 | i18n: chaves `data-i18n`/`data-i18n-attr` de index, planos, sobre, solucoes e para/* (12 páginas) × dicionários (common + página) | **PASS** — 127+64+41+72+8×62 chaves, 0 faltantes, todas com pt e en; 0 órfãs reais (as 3 "não usadas" de common.js — `legalPrevails`, `placeholderFill`, `footerPrivacyLinkText` — são usadas por cookies/privacidade/termos, fora do escopo da onda) |
| 3 | Links internos: todo href/src local das 12 páginas (nav incluída) + `<loc>` do sitemap → arquivo existente no repo | **PASS** — 0 links quebrados; 15 URLs no sitemap, todas com arquivo |
| 4 | `xmllint --noout sitemap.xml` | **PASS** — XML válido |
| 5 | Forms waitlist: cada `form[data-waitlist]` com honeypot `name=company` + `.cf-turnstile` + script do Turnstile na página | **PASS** — 12 forms em 11 páginas (planos tem 2), todos completos |
| 6 | CSP em `_headers` × hosts do PostHog em analytics.js | **PASS** — `us-assets.i.posthog.com` em script-src; `us.i.posthog.com` + `us-assets.i.posthog.com` em connect-src; nenhum host órfão. Bônus: hash sha256 do único script inline executável confere byte a byte em todas as 18 páginas (JSON-LD é inerte, não entra na CSP) |
| 7 | Escopo: `git status` só com arquivos da onda (index/planos/sobre/solucoes.html, para/, waitlist/analytics/landing.js, i18n/, landing.css, _headers, sitemap.xml, seed-demo.sql) | **PASS** — 0 arquivos fora do escopo (este relatório, `docs/relatorios/onda-1.md`, é entregável do próprio gate) |

Achados ALTO não convergidos: **nenhum**.

---

## d) CHECKLIST DE TESTE MANUAL DO GATE 1

Rodar em ordem. Servir local (ex.: `npx wrangler dev`) ou usar o preview do deploy.

1. **Abrir cada página** — index, planos, sobre, solucoes, para/lash, para/sobrancelha, para/skincare, para/micropigmentacao, para/barbearia, para/massoterapia, para/podologia, para/tatuagem:
   - [ ] Sem erro no console (inclusive nenhum `[i18n] chave ausente`).
   - [ ] Layout íntegro, imagens carregando, sem scroll horizontal no body.
2. **Nav "Para quem" — desktop**: em cada página, abrir o dropdown, navegar pelos 8 itens com Tab/Enter, conferir `aria-current` na página ativa. (Sabido: não fecha com Esc/clique-fora — backlog MÉDIO.)
3. **Nav "Para quem" — mobile** (viewport ≤ 768px): abrir o menu hambúrguer, conferir o grupo de segmentos, tocar em 2–3 links.
4. **Waitlist com e-mail de teste** (usar e-mail descartável; conferir na tabela `waitlist` do Supabase que `source` gravou certo):
   - [ ] Home (`hero`) — sucesso mostra mensagem verde.
   - [ ] Planos, card Estúdio (`waitlist-estudio`) — atenção: 2 widgets Turnstile na página; testar os dois forms.
   - [ ] Soluções (`waitlist-solucoes`).
   - [ ] 1–2 páginas de segmento (`waitlist-para-<slug>`).
   - [ ] E-mail inválido e reenvio → mensagem de erro amigável, sem exception no console.
5. **Toggle PT/EN em cada página nova** (as 8 de /para/ + planos/sobre/solucoes): alternar EN → conferir textos, `<html lang>`, atributos (placeholder, aria-label) → voltar PT → recarregar e conferir persistência.
6. **Tabela comparativa no celular** (index, viewport ~375px): `.compare-table` rola horizontal dentro do próprio container; body não estoura; coluna Harmon IA destacada.
7. **Seed na conta demo**: criar/logar a conta demo, pegar o `user_id` (auth.users), colar no `demo_user` de `db/seed-demo.sql`, rodar no SQL Editor do Supabase. Conferir no app: agenda da semana cheia, semana anterior concluída, estoque com alerta, caixa positivo com 2 pendentes. **Capturar screenshots** (home do app, agenda, caixa, estoque) para uso no site/README.
8. **Deploy**: `npx wrangler deploy` → smoke test na URL de produção (home + 1 página de segmento + 1 submit de waitlist real).
9. **Merge**: `onda-1` → `main` (fast-forward ou merge commit, sem squash de histórico se o padrão do repo for preservar).

---

## e) AÇÕES MANUAIS DO USUÁRIO

1. **PostHog**: criar projeto no PostHog US Cloud e trocar o placeholder `POSTHOG_KEY` em `assets/js/analytics.js` pela chave `phc_...` real. Enquanto for placeholder, nada carrega e nada loga (comportamento verificado). *Antes de ativar*: atualizar banner/política de cookies que hoje diz "não usamos analytics" (achado MÉDIO da seção b).
2. **Seed demo**: rodar `db/seed-demo.sql` no SQL Editor do Supabase substituindo o `demo_user` placeholder pelo `user_id` real da conta demo. Atenção ao achado MÉDIO: o arquivo roda como transação única — trocar o `demo_user` nos DOIS blocos (ou rodar um bloco por vez).
3. **Screenshots/GIF** do app com dados do seed ficam para depois do seed (passo 7 do checklist) — não bloqueiam o merge.

---

## f) Nota de decisão de CTA

**DECISÃO DE EXECUÇÃO (vai pro relatório do gate):** o site é pré-lançamento (cadastro fechado). Ação primária continua captura de waitlist. A promessa do plano ("Testar grátis por 35 dias", "sem cartão · sem multa · cancele quando quiser") entra como microcopy do lançamento junto ao CTA (ex.: botão "Quero ser avisado" + microcopy "No lançamento: 35 dias grátis · sem cartão · sem multa") — **NUNCA** como botão prometendo acesso imediato. Honestidade > conversão fake.

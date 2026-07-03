# Plano — Nova página "Soluções"

**Produto:** Harmon IA
**Objetivo:** Criar uma página `/solucoes.html` que apresenta as features do produto em **cards grandes, alternados**, cada um com título grande, explicação, sub-features e um **print do app** ao lado — no padrão da imagem de referência (ElevenLabs).
**Formato de entrega:** este markdown é um plano acionável para rodar no terminal depois. Traz copy pronta, CSS pronto e passo a passo de implementação.

---

## 1. Anatomia do card (baseada na referência)

A referência mostra: **card branco destacado do fundo cinza claro**, com uma coluna de **texto à esquerda** (título grande no topo, e mais abaixo um subtítulo em negrito + parágrafo + links secundários em cinza) e uma **imagem/print à direita** dentro de um painel arredondado com leve gradiente. Os cards **alternam** o lado da imagem (esquerda/direita) para criar ritmo.

Adaptação para o Harmon IA (mantendo o design system atual):

```
┌──────────────────────────────────────────────────────────────┐
│  [ TEXTO ]                              [ PRINT DO APP ]       │
│                                                                │
│  Título grande (H3, ~fs-2xl)            ┌───────────────────┐  │
│  Descrição (fs-base, text-muted)        │   screenshot do   │  │
│                                         │   módulo real     │  │
│  • Sub-feature 1                        │  (radius-xl,      │  │
│  • Sub-feature 2                        │   shadow, borda)  │  │
│  • Sub-feature 3                        └───────────────────┘  │
└──────────────────────────────────────────────────────────────┘
  card branco · radius-xl · shadow · dentro do .landing-container (1160px)
  próximo card: imagem à ESQUERDA, texto à direita (alterna)
```

Regras:
- Card ocupa a **largura padrão do site** (`.landing-container`, max 1160px).
- Fundo da página levemente cinza (`--bg` / `--color-gray-50`) para o card branco (`--surface`/`--color-white`) "saltar".
- Cada card: `--radius-xl` (20px), `--shadow`, padding generoso (`--sp-7`/`--sp-8`).
- Empilha no mobile (imagem sempre embaixo do texto, ≤900px).

---

## 2. Os 6 cards de feature (copy pronta)

Baseados nos módulos **reais** do app (`agenda`, `servicos`, `estoque`, `clientes`, `historico`, `financeiro` + integrações Google). Entregue 5–6; o card 6 é opcional/bônus.

> Convenção: **Título** = benefício. **Descrição** = 1–2 frases. **Sub-features** = 3 bullets curtos (equivalem aos "Test guardrails / Monitor performance" da referência). **Print** = o que a imagem deve mostrar + `alt`.

### Card 1 — Agenda
- **Título:** `Uma agenda que nunca desencontra`
- **Descrição:** `Agende em segundos e veja seu dia inteiro num relance. Tudo sincronizado com o Google Calendar — o que você marca no celular aparece na hora, sem cliente marcado em dobro e sem retrabalho.`
- **Sub-features:** `Sincronização com Google Calendar` · `Visão de dia, semana e mês` · `Lembretes de retorno automáticos`
- **Print:** tela da Agenda com vários agendamentos no dia. `alt="Agenda do Harmon IA com atendimentos do dia sincronizados ao Google Calendar"`

### Card 2 — Clientes & Histórico
- **Título:** `Cada cliente na palma da mão`
- **Descrição:** `Ficha completa, histórico de todos os atendimentos, preferências e fotos de antes e depois. Você lembra de tudo — e o cliente sente o cuidado.`
- **Sub-features:** `Ficha e histórico ilimitados` · `Fotos de antes e depois` · `Contatos importados do Google`
- **Print:** ficha de um cliente com linha do tempo de atendimentos. `alt="Ficha de cliente do Harmon IA com histórico de atendimentos e fotos"`

### Card 3 — Fluxo de Caixa
- **Título:** `O caixa no azul, sem planilha`
- **Descrição:** `Entradas, saídas, parcelas e o lucro de verdade por serviço. Você vê quanto entrou, quanto saiu e o que realmente dá dinheiro — sem abrir uma planilha.`
- **Sub-features:** `Fluxo de caixa em tempo real` · `Lucro por serviço` · `Controle de parcelas`
- **Print:** dashboard do financeiro com totais e gráfico. `alt="Fluxo de caixa do Harmon IA mostrando entradas, saídas e lucro por serviço"`

### Card 4 — Estoque
- **Título:** `Estoque que avisa antes de faltar`
- **Descrição:** `Controle de materiais com alerta de mínimo e lista de compras gerada sozinha. Nunca mais descobrir que acabou o produto na hora do atendimento.`
- **Sub-features:** `Alerta de estoque mínimo` · `Lista de compras automática` · `Baixa por serviço realizado`
- **Print:** lista de itens de estoque com um item em alerta vermelho. `alt="Controle de estoque do Harmon IA com alerta de material acabando"`

### Card 5 — Serviços & Procedimentos
- **Título:** `Seus serviços organizados do seu jeito`
- **Descrição:** `Monte seu catálogo de serviços com preço, duração e materiais usados em cada um. O app calcula o custo real e puxa a baixa de estoque sozinho.`
- **Sub-features:** `Catálogo com preço e duração` · `Materiais por serviço` · `Custo e lucro calculados`
- **Print:** tela de serviços/procedimentos com um serviço aberto mostrando materiais. `alt="Catálogo de serviços do Harmon IA com materiais e custo por atendimento"`

### Card 6 — Segurança & Multiacesso *(bônus / fecho)*
- **Título:** `Seus dados seguros, só seus`
- **Descrição:** `Login pelo Google e isolamento total: cada conta só enxerga os próprios dados. No plano Team, sua equipe divide agenda e clientes com permissões por usuário.`
- **Sub-features:** `Login seguro com Google` · `Dados isolados por conta` · `Permissões por usuário (Team)`
- **Print:** tela de configurações/equipe ou o login. `alt="Tela de acesso do Harmon IA com login pelo Google e permissões por usuário"`

> **Sequência recomendada** (alternância de imagem): 1-dir, 2-esq, 3-dir, 4-esq, 5-dir, 6-esq.

---

## 3. Assets — prints do app

Como o app tem dado real, o ideal é capturar prints com uma conta de demonstração povoada.

- **Pasta:** `assets/img/solucoes/`
- **Nomes:** `sol-agenda.webp`, `sol-clientes.webp`, `sol-financeiro.webp`, `sol-estoque.webp`, `sol-servicos.webp`, `sol-seguranca.webp`
- **Formato:** `.webp` (segue o padrão do hero-banner), ~1600px de largura, exportar em 2x pra telas retina.
- **Enquadramento:** capturar só a área do módulo (sem a sidebar inteira, pra respirar), fundo claro. Cantos serão arredondados via CSS.
- **Placeholder:** enquanto não houver print, usar um bloco cinza com o rótulo do módulo (o CSS já prevê `.solution-card__media--placeholder`) pra não travar o deploy.
- **Peso:** comprimir (o `hero-banner.png` tem ~9 MB no repo — **não** repetir isso; usar só `.webp` leve).

---

## 4. CSS pronto (adicionar em `assets/css/landing.css`)

Reaproveita tokens e o padrão BEM já existente. Colar ao final da seção de features.

```css
/* --------------------------------------------------------- soluções ---- */
.solutions { display: flex; flex-direction: column; gap: var(--sp-6); }

.solution-card {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--sp-6);
  align-items: center;
  background: var(--surface, var(--color-white));
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-sm);
  padding: var(--sp-6);
  transition: box-shadow var(--transition);
}
.solution-card:hover { box-shadow: var(--shadow); }

@media (min-width: 900px) {
  .solution-card { grid-template-columns: 1fr 1fr; gap: var(--sp-8); padding: var(--sp-8); }
  /* alterna: imagem à esquerda nos cards marcados --reverse */
  .solution-card--reverse .solution-card__media { order: -1; }
}

.solution-card__title {
  font-size: var(--fs-xl);
  font-weight: var(--fw-700);
  letter-spacing: -0.02em;
  margin-bottom: var(--sp-3);
  text-wrap: balance;
}
@media (min-width: 900px) { .solution-card__title { font-size: var(--fs-2xl); } }

.solution-card__text { color: var(--text-muted); font-size: var(--fs-base); margin-bottom: var(--sp-5); }

.solution-card__list { display: flex; flex-direction: column; gap: var(--sp-2); font-size: var(--fs-sm); }
.solution-card__list li { display: flex; gap: var(--sp-2); align-items: flex-start; color: var(--text); }
.solution-card__list svg { width: 16px; height: 16px; flex-shrink: 0; margin-top: 2px; color: var(--text-muted); }

.solution-card__media {
  border-radius: var(--radius-lg);
  overflow: hidden;
  border: 1px solid var(--border);
  background: var(--color-gray-100);
}
.solution-card__media img { width: 100%; height: 100%; object-fit: cover; display: block; }
.solution-card__media--placeholder {
  aspect-ratio: 16 / 10;
  display: grid; place-items: center;
  color: var(--text-muted); font-size: var(--fs-sm);
}
```

> Se algum token (`--surface`, `--text-muted`, `--border`) não existir com esse nome, conferir em `tokens.css`/`theme.css` e ajustar — o padrão do projeto é **zero hex cru**, tudo via variável.

---

## 5. HTML — esqueleto de `solucoes.html`

Duplicar a estrutura de `sobre.html` (head, header, footer idênticos) e trocar só o `<main>`. Marcar o link "Soluções" como `aria-current="page"`.

```html
<main id="main-content">
  <!-- título da página -->
  <section class="landing-container section">
    <div class="section__head">
      <h1 class="section__title">Tudo que o seu dia a dia precisa</h1>
      <p class="section__subtitle">Agenda, clientes, estoque e caixa num só lugar —
        veja cada parte do Harmon IA em ação.</p>
    </div>
  </section>

  <!-- cards de soluções -->
  <section class="landing-container solutions">

    <!-- CARD 1 (imagem à direita) -->
    <article class="solution-card" data-reveal>
      <div class="solution-card__body">
        <h2 class="solution-card__title">Uma agenda que nunca desencontra</h2>
        <p class="solution-card__text">Agende em segundos e veja seu dia inteiro num relance…</p>
        <ul class="solution-card__list">
          <li>{check-svg} Sincronização com Google Calendar</li>
          <li>{check-svg} Visão de dia, semana e mês</li>
          <li>{check-svg} Lembretes de retorno automáticos</li>
        </ul>
      </div>
      <div class="solution-card__media">
        <img src="assets/img/solucoes/sol-agenda.webp"
             alt="Agenda do Harmon IA com atendimentos do dia sincronizados ao Google Calendar" loading="lazy" />
      </div>
    </article>

    <!-- CARD 2 (imagem à esquerda) -->
    <article class="solution-card solution-card--reverse" data-reveal>
      … mesma estrutura, media com sol-clientes.webp …
    </article>

    <!-- CARDS 3–6 seguindo a alternância (3 normal, 4 reverse, 5 normal, 6 reverse) -->

  </article>
  </section>

  <!-- reaproveitar a cta-band da home -->
  <section class="cta-band" data-theme="dark">
    <div class="landing-container">
      <h2 class="cta-band__title">Pronto pra ver tudo isso junto?</h2>
      <p class="cta-band__subtitle">Entre na lista de espera e seja avisado quando abrir uma vaga.</p>
      <a class="btn btn--primary" href="/#waitlist-hero">Entrar na lista de espera&nbsp;→</a>
    </div>
  </section>
</main>
```

> `{check-svg}` = o mesmo SVG de check usado em `planos.html` nos `.plan-card__features`. Copiar de lá pra manter consistência.

---

## 6. Integrações no resto do site

1. **Nav (header) das 4 páginas** (`index`, `sobre`, `planos`, `solucoes`): adicionar `<a href="/solucoes.html">Soluções</a>` entre "Início" e "Sobre". Repetir no menu mobile (`.landing-nav-mobile__panel`).
2. **Footer** das 4 páginas: adicionar o mesmo link em `.landing-footer__links`.
3. **Home:** na seção de features atual, trocar o CTA/atalho por `Ver todas as soluções →` apontando pra `/solucoes.html` (a home vira o teaser; a página nova, o aprofundamento).
4. **Motion:** os `data-reveal` já são animados pelo `motion.js` — reusar, sem JS novo.

---

## 7. SEO da página

```html
<title>Soluções — Harmon IA | Agenda, clientes, estoque e caixa</title>
<meta name="description" content="Conheça cada parte do Harmon IA: agenda sincronizada, ficha de clientes, controle de estoque, fluxo de caixa e mais — feito para profissionais de beleza e estética." />
<meta property="og:title" content="Soluções — Harmon IA" />
<meta property="og:description" content="Agenda, clientes, estoque e financeiro num só app. Veja cada módulo em ação." />
```
- 1 só `<h1>` (título da página).
- Cada card usa `<h2>` (título) — hierarquia limpa pra SEO.
- `alt` descritivo e único em cada print (já definido na §2).

---

## 8. Passo a passo pra rodar no terminal

1. Criar `assets/img/solucoes/` e colocar os 6 prints (ou placeholders).
2. Criar `solucoes.html` a partir de `sobre.html`; substituir `<main>` pela §5 e o `<head>` pela §7.
3. Colar o CSS da §4 no fim de `assets/css/landing.css`.
4. Adicionar `<link rel="stylesheet" href="assets/css/motion.css" />` no `<head>` (a home já tem; garantir na página nova).
5. Inserir o link "Soluções" no header + menu mobile + footer das 4 páginas (§6).
6. Trocar o atalho da seção de features da home por `Ver todas as soluções →`.
7. Conferir `vercel.json` — se houver rotas/redirects explícitos, garantir que `/solucoes.html` é servido.
8. Testar responsivo (empilhar ≤900px), dark mode e navegação por teclado.

---

## 9. Checklist de implementação
- [ ] Pasta `assets/img/solucoes/` + 6 prints em `.webp` leve (ou placeholders)
- [ ] `solucoes.html` criado (head/header/footer iguais aos das outras páginas)
- [ ] 6 cards com copy da §2 e alternância de imagem (dir/esq)
- [ ] CSS `.solution-card` colado na `landing.css`
- [ ] Link "Soluções" no header, menu mobile e footer das 4 páginas
- [ ] `aria-current="page"` no link ativo em `solucoes.html`
- [ ] CTA final reaproveitando `.cta-band`
- [ ] Meta tags e `alt` únicos (§7)
- [ ] Home: atalho "Ver todas as soluções →"
- [ ] Testado: mobile empilhado, dark mode, teclado, peso das imagens

---

## 10. Decisões que valem confirmar depois
- **6 cards** (pediu ao menos 5) — o card 6 (Segurança) é fecho de confiança; dá pra cortar se preferir 5.
- **Prints reais vs. mockups:** o ideal são prints de conta demo povoada. Se ainda não houver, subir com placeholders e trocar depois — o CSS já suporta os dois.
- **Sub-features (3 bullets/card):** espelham o padrão da referência ("Test guardrails / Monitor performance"). Se preferir cards mais limpos, dá pra remover os bullets sem mexer no layout.

# Plano de Lapidação + Motion — Site público (landing)

**Escopo:** Início, Sobre, Planos, Entrar. Não inclui o app interno.
**Intensidade de motion:** sutil e elegante (fade-up no scroll, hover com leve elevação, micro-interações discretas).
**Restrições do projeto:** web sem build (HTML + CSS + JS vanilla). Tudo precisa rodar sem toolchain.
**Base auditada:** `harmon-ia-rouge.vercel.app` (desktop 1440px + mobile 390px), lido via skill `boas-praticas-design` (WCAG 2.2 AA, sistema 8px).

---

## 1. Diagnóstico

O site já é sólido: design tokens bem organizados, contraste consciente de AA, HTML semântico, skip link,
`prefers-reduced-motion` já tratado em `components.css`, tipografia Satoshi e escala de espaçamento de 4/8px.
Os problemas são de **acabamento e vida**, não de fundação.

### 🔴 Alta — resolver antes de divulgar

- **Hero: imagem não corresponde ao `alt` (Início).** O `alt` diz "Painel do Harmon IA com agenda, ficha de
  cliente e financeiro", mas a imagem exibida é uma paisagem de montanha em P&B. Viola WCAG 1.1.1 (texto
  alternativo incorreto) e enfraquece a mensagem — o herói de um SaaS deveria mostrar o produto, não uma
  paisagem genérica. Corrigir a imagem **ou** o `alt`.
- **Placeholders "imagem" visíveis em produção.** Caixas pretas escritas "imagem" na seção "prova social"
  (Início) e nos 3 módulos da página Sobre (`.about-module__media`) e o `.proof__media`. Passam sensação de
  site inacabado. Substituir por print real do app, ilustração ou remover a coluna até ter o asset.

### 🟡 Média — degrada a experiência

- **Site "parado" — ausência quase total de motion.** Hoje só existem: marquee de segmentos, sombra no hover
  dos cards de feature, opacidade no hover dos botões e o shimmer de skeleton (só no app). Nenhuma revelação
  no scroll, nenhuma entrada de conteúdo. Esta é a queixa central. (Plano na seção 3.)
- **Hero desktop com ~50% de área morta.** O texto ocupa a metade esquerda; a direita é só o gradiente escuro.
  Padrão SaaS pede mockup/produto ocupando o lado livre. Sem asset, dá pra reequilibrar o layout ou usar um
  visual de produto.
- **Hierarquia dos 2 CTAs do hero fraca.** "Quero ser avisado" (primário preto com contorno branco sobre fundo
  escuro) e "Planos e preços" competem em peso visual parecido; o primário não "salta". Reforçar o primário
  (fundo claro sólido ou accent) e rebaixar o secundário para link puro.
- **Menu mobile (`<details>`) fica aberto sobre o conteúdo ao rolar.** Ao abrir e rolar, o painel de links
  sobrepõe as seções. Fechar o menu ao clicar num link e ao rolar/redimensionar.

### 🟢 Baixa — polimento

- **Hover dos botões é só opacidade** — sensação plana. Trocar por leve `translateY(-1px)` + sombra, e
  `scale(0.98)` no `:active`.
- **Cards de feature** só mudam sombra no hover; falta elevação (`translateY`) e reação do ícone.
- **FAQ (`<details>`)** abre sem transição e o `+ / −` não anima. Animar a abertura e girar/transicionar o ícone.
- **Nav links** sem estado de hover animado (underline). Adicionar underline que desliza.
- **Ritmo vertical monótono** — muitas seções de texto centralizado em sequência; o scroll-reveal escalonado
  já resolve boa parte da monotonia.

### ✅ Aprovado (não mexer)

Design tokens e temas; contraste de texto AA; skip link e `aria-current`; `prefers-reduced-motion` global;
tabelas/forms responsivos; marquee de segmentos com pausa no hover e respeito a reduced-motion.

---

## 2. Aprimoramentos de lapidação (sem motion)

| # | Onde | Ação | Arquivo |
|---|------|------|---------|
| L1 | Início — hero | Corrigir imagem×`alt` (asset de produto ou `alt` fiel) e reequilibrar a área morta à direita | `index.html`, `landing.css`, `/assets/img` |
| L2 | Início — prova social | Substituir/remover o placeholder `imagem` do `.proof__media` | `index.html`, `landing.css` |
| L3 | Sobre — 3 módulos | Substituir/remover os 3 `.about-module__media` "imagem" | `sobre.html`, `landing.css` |
| L4 | Hero — CTAs | Reforçar peso do primário; rebaixar secundário a link | `landing.css` |
| L5 | Menu mobile | Fechar `<details>` ao clicar em link e ao rolar | novo `assets/js/landing.js` |

---

## 3. Plano de motion (sutil e elegante)

Princípios (da skill): animar só `transform`/`opacity` (GPU); durações 100–150ms micro, 200–400ms entradas;
`ease-out` na entrada; respeitar `prefers-reduced-motion`; motion com propósito, nunca decoração gratuita.

| # | Interação | Descrição | Duração/Easing |
|---|-----------|-----------|----------------|
| M1 | **Scroll-reveal** | Fade + `translateY(16px→0)` ao entrar na viewport, via IntersectionObserver. Aplicar a: títulos de seção, cards de feature (stagger 60ms), pain-cards, steps, faq-items, módulos da Sobre, plan-cards. | 400ms `ease-out` |
| M2 | **Entrada do hero** | Título, subtítulo e form sobem com fade escalonado no load (sem esperar scroll). | 300–500ms, stagger 80ms |
| M3 | **Hover de botão** | `translateY(-1px)` + sombra suave; `:active` `scale(0.98)`. Substitui o hover só-opacidade. | 150ms `ease-out` |
| M4 | **Hover de card** | Feature/plan/pain: `translateY(-4px)` + sombra `--shadow` + `border-color`; ícone ganha leve `scale(1.06)`/cor. | 200ms `ease-out` |
| M5 | **FAQ accordion** | Animar abertura (grid-rows 0→1fr) e transicionar/gira o `+`→`−`. | 200ms `ease-out` |
| M6 | **Nav underline** | Underline que desliza da esquerda no hover/foco dos links do header e footer. | 150ms |
| M7 | **Marquee** | Manter; adicionar leve `scale`/realce no hover do chip (a pausa já existe). | 150ms |

> Nada de parallax, contadores ou revelação palavra-a-palavra nesta rodada (ficou para "marcante", não escolhido).

---

## 4. Arquitetura técnica (no-build)

Duas adições pequenas, sem dependências:

1. **`assets/css/motion.css`** — keyframes + utilitários de reveal + estados de hover/accordion. Carregar
   **depois** de `landing.css` nas 4 páginas. Todo o bloco de motion vai **dentro** de
   `@media (prefers-reduced-motion: no-preference)`, então o padrão já é "sem animação" para quem pede menos
   movimento (reforça a regra global que já existe em `components.css`).

2. **`assets/js/landing.js`** (ESM, ~40 linhas) — um `IntersectionObserver` que adiciona `.is-visible` aos
   elementos marcados com `data-reveal`, com `--reveal-i` para o stagger; + fechar o menu mobile no clique/scroll.
   Importado com `<script type="module">` (mesmo padrão do `initWaitlistForms`). Se o JS falhar, o CSS deixa o
   conteúdo **visível por padrão** (a animação é progressive enhancement — nunca esconde conteúdo sem JS).

Marcação: adicionar `data-reveal` (e classes de hover onde faltarem) nos elementos-alvo de `index.html`,
`sobre.html`, `planos.html`. `entrar.html` recebe só o refinamento de botão/input.

**Regra de ouro de acessibilidade:** o estado inicial "escondido" (`opacity:0; translateY`) só pode existir
quando há JS **e** `prefers-reduced-motion: no-preference`. Sem isso, tudo nasce visível.

---

## 5. Execução em fases (terminal)

```
Fase 0 — Branch e baseline
  git checkout -b feat/landing-polish-motion
  # opcional: screenshots antes/depois para comparar

Fase 1 — Fundação de motion (M1–M3, M6)
  criar assets/css/motion.css        (keyframes, .reveal, hover de botão, nav underline)
  criar assets/js/landing.js         (IntersectionObserver + menu mobile)
  linkar motion.css e landing.js nas 4 páginas
  marcar data-reveal no index.html

Fase 2 — Componentes (M4, M5)
  hover de card (feature/pain/plan) + reação de ícone
  FAQ accordion animado + ícone +/−
  aplicar data-reveal em sobre.html e planos.html

Fase 3 — Lapidação visual (L1–L5)
  corrigir imagem×alt do hero + reequilíbrio (L1)
  resolver placeholders "imagem" (L2, L3)
  reforço dos CTAs do hero (L4)
  fechar menu mobile ao navegar (L5, já no landing.js)

Fase 4 — Verificação (ver seção 6)
```

## 6. Verificação (checklist de saída)

- [ ] `prefers-reduced-motion: reduce` no SO → nenhuma animação de entrada; conteúdo estático e completo.
- [ ] JS desligado → todo o conteúdo visível (reveal é enhancement).
- [ ] Sem overflow horizontal a 320px; zoom 200% sem quebra.
- [ ] Foco de teclado visível em todos os links/botões novos; Tab percorre em ordem.
- [ ] Contraste mantido AA em qualquer novo estado de cor.
- [ ] Sem "flash" de conteúdo escondido no carregamento (FOUC).
- [ ] Performance: só `transform`/`opacity` animados; sem jank ao rolar (checar em mobile real).
- [ ] Screenshots antes/depois desktop + mobile das 4 páginas.
- [ ] Registrar no `HISTORICO.md` como nova rodada (PATCH/MINOR visual).

---

### Estimativa

Fases 1–2 (todo o motion) são o grosso do "trazer vida" e são de baixo risco (arquivos novos + marcação).
Fase 3 depende de assets/decisões de conteúdo (imagem do hero, prints do app) — pode andar em paralelo ou
depois. Nada aqui exige build nem toca o backend/Supabase.

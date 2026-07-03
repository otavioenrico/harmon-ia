# Aprimoramentos pendentes (rodar em lote)

Backlog de ajustes enviados pelo Otávio para executarmos depois, juntos.

---

## 1. FAQ (Home + Planos): sanfona não fecha + permitir só 1 aberta

**Status:** concluído
**Páginas:** `index.html`, `planos.html` (ambas usam `assets/js/landing.js`)
**Arquivos a tocar:** `assets/js/landing.js`, `assets/css/motion.css`

### Sintomas
- As sanfonas do FAQ abrem, mas não fecham ao clicar de novo.
- Várias ficam abertas ao mesmo tempo.

### Comportamento desejado
- Clicar numa aberta -> fecha.
- Só 1 sanfona ativa por vez: ao abrir uma, a anterior fecha.

### Causa raiz
Em `motion.css` (linha ~87) o seletor de estado aberto casa com `.is-open` E `[open]`:

    .js .faq__item.is-open .faq__a, .js .faq__item[open] .faq__a { grid-template-rows: 1fr; }

Ao fechar, o `landing.js` remove só a classe `.is-open`, mas o atributo nativo
`[open]` do `<details>` continua até o `transitionend`. Como `[open]` ainda casa
o seletor, o `grid-template-rows` fica preso em `1fr` -> nunca transiciona para
`0fr` -> o `transitionend` não dispara -> `item.open = false` nunca roda -> trava
aberta.

### Correção proposta
1. CSS (`motion.css`): separar o caminho JS do fallback nativo. Com JS ativo, só
   `.is-open` controla a animação; `[open]` vira fallback exclusivo do sem-JS.
   - Marcar `document.documentElement.classList.add('faq-js')` no init do handler:
     - aberto (JS): `.faq-js .faq__item.is-open .faq__a { grid-template-rows: 1fr; }`
     - fallback: `html:not(.faq-js) .faq__item[open] .faq__a { grid-template-rows: 1fr; }`
2. JS (`landing.js`): antes de abrir um item, fechar qualquer outro
   `.faq__item.is-open` (remover `is-open` + `transitionend` -> `open = false`).

### Verificação
- Abrir -> fecha ao reclicar (Home e Planos).
- Abrir A, depois B -> A fecha sozinha.
- Reduced-motion / sem JS: `<details>` nativo continua abrindo/fechando.

---

## 2. Carrossel de segmentos: fade de opacidade nas bordas

**Status:** concluído
**Página:** `index.html` (seção "Feito para o seu trabalho")
**Arquivo a tocar:** `assets/css/landing.css` (`.segment-marquee`)

### Objetivo
Os chips devem ir perdendo opacidade conforme se afastam do centro — foco máximo
no meio, apagando suave nas duas pontas (efeito da referência enviada).

### Causa / estado atual
`.segment-marquee { overflow: hidden; }` corta os chips numa borda dura. Não há
gradiente de fade.

### Correção proposta
Aplicar uma máscara de gradiente horizontal no container do marquee (CSS puro,
sem JS, compatível com o scroll infinito atual):

    .segment-marquee {
      overflow: hidden;
      -webkit-mask-image: linear-gradient(to right,
        transparent 0, #000 12%, #000 88%, transparent 100%);
      mask-image: linear-gradient(to right,
        transparent 0, #000 12%, #000 88%, transparent 100%);
    }

- Ajustar os stops (12%/88%) conforme o "quão largo" deve ser o fade.
- Cobre as duas bordas; centro fica 100% opaco.

### Verificação
- Chips somem suave nas duas pontas, nítidos no centro.
- Scroll infinito e pause-on-hover seguem funcionando.
- Checar em mobile (fade proporcional na largura menor).

---

## 3. Header transparente no topo da home, com fundo só após rolar

**Status:** concluído
**Página:** `index.html` (home). Ver impacto em `sobre.html` / `planos.html`.
**Arquivos a tocar:** `index.html` (marcador no body/header), `assets/js/landing.js`,
`assets/css/landing.css`

### Objetivo
Ao abrir a home, o header fica sem fundo (transparente), sobreposto ao hero
escuro. O fundo (branco + blur + borda) só aparece depois que o usuário rola.
Referência: imagem 2 enviada.

### Estado atual
`.landing-header` (landing.css:33) é `position: sticky` com `background:
var(--header-bg)` + `backdrop-filter` + `border-bottom` SEMPRE visíveis — fundo
branco sólido no topo (imagem 1). O token `--header-bg` é branco translúcido
(tokens.css:121). Não há classe de estado de scroll, nem marcador de página.

### Pontos de atenção
- **Escopo home:** o hero da home é escuro (`.lp-hero-full`), então no topo o
  texto do header (wordmark, nav, badge "Em breve") precisa ficar CLARO para ler
  sobre o fundo escuro. Sobre/Planos têm topo claro — lá o texto deve seguir
  escuro. Ou seja: o "texto claro no topo" é só da home.
- **Botões:** no topo sobre o hero, "Quero ser avisado" (ghost) precisa de
  borda/texto claros, e "Entrar" (primary, preto) some no fundo escuro — na
  ref. aparece como botão claro. Precisa variante invertida no topo.
- Não há `class`/`data-*` distinguindo a home hoje — adicionar marcador.

### Correção proposta
1. **HTML (`index.html`):** marcar a home, ex. `<body class="page-home">` ou
   `<header class="landing-header landing-header--overlay">`.
2. **JS (`landing.js`):** listener de scroll passivo (já existe padrão na linha
   29) que adiciona/remove `is-scrolled` no header quando `window.scrollY > 8`
   (ou > altura do hero, a decidir). Setar no load também.
3. **CSS (`landing.css`):**
   - Base transparente quando overlay + topo: `background: transparent;
     border-color: transparent; backdrop-filter: none;`
   - Estado rolado: `.landing-header.is-scrolled` volta a `--header-bg` + blur +
     borda (transição suave em background/border).
   - Escopo home no topo (`.page-home .landing-header:not(.is-scrolled)`):
     wordmark/nav/badge com cor clara; ghost com borda/texto claros; primary
     invertido (fundo claro, texto escuro). Ao rolar, tudo volta ao normal.

### Verificação
- Home: topo sem fundo, texto legível sobre o hero; ao rolar, fundo branco+blur
  entra suave. Ao voltar ao topo, some.
- Sobre/Planos: header não fica com texto claro invisível sobre fundo claro.
- Mobile: menu hamburguer legível no topo transparente.
- `sticky` e z-index seguem corretos (header sobre o conteúdo).

---

## 4. Dash (Home): ações rápidas fixas numa linha, sem quebrar

**Status:** concluído
**Abordagem escolhida:** encolher rótulos progressivamente (nowrap, sem scroll)
**Arquivos a tocar:** `assets/css/components.css` (`.hero__actions`), possível
ajuste em `assets/js/home.js` (labels curtos já existem)

### Problema
`.hero__actions` (components.css:362) usa `display: flex; flex-wrap: wrap`. Com o
texto maior, "Novo lançamento" cai pra segunda linha (ver print). Os labels
`full-label`/`short-label` já existem no `home.js`, mas o `short-label` só é
ativado no breakpoint mobile (~700px) — na faixa desktop os labels completos
ficam e a linha quebra.

### Comportamento desejado
As 5 ações ("Novo agendamento" [primário], "Ver calendário", "Novo cliente",
"Novo produto", "Novo lançamento") sempre na MESMA linha, sem enviar botão pra
linha de baixo. Sem scroll horizontal no desktop.

### Correção proposta (encolher rótulos)
1. Trocar `flex-wrap: wrap` por `flex-wrap: nowrap` em `.hero__actions`.
2. Escalonar por largura (container query se possível, senão media queries):
   - **Largo:** rótulo completo (`full-label`).
   - **Médio (aperta):** secundários usam `short-label` (já existem: "Calendário",
     "+ Cliente", "+ Produto", "+ Lançamento").
   - **Estreito:** secundários viram só ícone — esconder ambos os labels e
     garantir `aria-label`/`title` em cada botão p/ acessibilidade + tooltip.
   - O primário "Novo agendamento" mantém o texto o máximo possível (último a
     colapsar).
3. Mobile bem estreito: manter o grid 2-col atual (components.css:496) OU, se
   preferir, faixa com scroll horizontal — decidir na execução.

### Atenção
- Adicionar `title`/`aria-label` nos botões ao virarem só-ícone (hoje o texto
  visível é o rótulo acessível).
- Garantir alvo de toque mínimo (~40px) nos botões só-ícone.
- Verificar em 1280 / 1024 / 900 / 700 / 375px que nunca quebra a linha.

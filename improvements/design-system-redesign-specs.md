# Specs — Redesign do Design System (Item 5)

**Status: fechado, pronto para execução.** Baseado na referência visual enviada (dashboard "Coursue"). Valores de cor são **estimados por proporção visual** (não há como medir pixel exato de um screenshot) — marcados com `~`; ajustar com conta-gotas na hora de implementar. Contrastes citados abaixo **foram calculados**, não estimados.

---

## 0. Tipografia — decidido: fonte de sistema (Helvetica/San Francisco)

Decisão do usuário: trocar tudo para um registro "padrão" tipo Helvetica/San Francisco. Não dá pra embutir Helvetica/SF de verdade via `@font-face` (licenciamento fechado — SF é da Apple, Helvetica Neue é paga); o caminho correto pra pedir exatamente essa aparência é usar a **font stack de sistema**, que resolve para a fonte nativa de cada SO — San Francisco no Mac/iOS, Segoe UI no Windows, Roboto no Android/Chrome OS:

```css
--font: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
```

Vantagens além de bater com o pedido: remove a dependência do Google Fonts (`@import`/`<link>` de Raleway sai do `app.html`/`index.html`), zero flash de fonte não carregada (FOUT), e é a fonte que o sistema operacional do usuário já tem — carregamento instantâneo. Reflete também um app "utilitário" em vez de "editorial", o que é coerente com CRM operacional.

Ajuste de pesos: a escala de `--fw-200`…`--fw-500` do `tokens.css` atual foi calibrada pra Raleway (fina, "delicada"). Fonte de sistema não tem os pesos 200/300 tão refinados — recomendo simplificar para:

```css
--fw-400: 400;  /* corpo — era usado com 300 antes, ficava fino demais pra fonte de sistema */
--fw-500: 500;  /* labels, uppercase de seção */
--fw-600: 600;  /* headings, títulos de card */
--fw-700: 700;  /* headline do banner/hero, se mantido */
```
Nenhum peso acima de 700 (mantém a regra de "nunca peso pesado demais" do design system original, só recalibrada pro range que a fonte de sistema realmente tem).

---

## 1. Layout — 3 colunas

| Coluna | Largura | Comportamento |
|---|---|---|
| Sidebar | 240px (64px colapsada — já existe como `--sidebar-w`/`--sidebar-w-collapsed`) | Fixa, branca |
| Conteúdo central | flexível (`1fr`), `max-width` ~960px dentro do espaço disponível | Scroll independente |
| Painel direito | ~340–360px fixo | Sticky, não colapsa; **oculta abaixo de ~1200px** (vira seção no fim do conteúdo central, não cabe em telas menores — item 5 pede "otimizado pra 13", que já é justo pra 3 colunas) |

```css
.shell { display: grid; grid-template-columns: var(--sidebar-w) 1fr; }
.shell.with-panel { grid-template-columns: var(--sidebar-w) 1fr 356px; }
@media (max-width: 1200px) {
  .shell.with-panel { grid-template-columns: var(--sidebar-w) 1fr; } /* painel cai pro fim do conteúdo */
}
```

Cards com `border-radius: 20px` (maior que o atual `--radius-lg: 14px` — a referência usa cantos bem generosos nos cards grandes). Sugiro um novo token:

```css
--radius-xl: 20px; /* cards grandes: banner, painel direito, cards de conteúdo */
```

---

## 2. Paleta de cores (proposta de `tokens.css` v2)

Estrutura de tokens semânticos mantida — só os valores crus mudam, igual ao comentário já existente no arquivo ("nenhum componente referencia cor crua direto").

```css
:root {
  /* -------- paleta crua v2 -------- */
  --color-black:     #1a1816;   /* mantém, é quase-preto */
  --color-white:     #ffffff;
  --color-gray-100:  #f5f4f2;   /* fundo geral — igual ao que já existe */
  --color-gray-200:  #ebe8e5;
  --color-gray-400:  #9e9892;   /* mantém */
  --color-gray-600:  #6b6760;   /* mantém — já passa 5.62:1 sobre branco, testado */

  /* NOVO: rosé/mauve (troca o --color-beige atual) */
  --color-mauve-100: #f3e9ea;   /* pill/badge bg suave */
  --color-mauve-300: #d9c2c6;   /* banner gradiente, ponta clara */
  --color-mauve-500: #b79ca0;   /* banner gradiente, ponta escura / barras de gráfico */
  --color-mauve-700: #8f7276;   /* texto sobre mauve-100, se precisar */

  --color-success:  #4a7c59;    /* mantém */
  --color-warning:  #c9923a;    /* mantém */
  --color-danger:   #b85450;    /* mantém */

  /* pills de categoria (3 cores pastéis, como na referência) */
  --pill-blue-bg:   #e3f1fc;  --pill-blue-text:   #2c6690; /* 5.35:1 — testado, AA ok */
  --pill-tan-bg:    #f3e9e0;  --pill-tan-text:    #7a5f4a; /* ver nota abaixo */
  --pill-peach-bg:  #f7e9de;  --pill-peach-text:  #a35a35; /* ver nota abaixo */

  /* -------- tokens semânticos -------- */
  --bg:            var(--color-gray-100);
  --surface:       var(--color-white);
  --surface-2:     var(--color-gray-100);
  --text:          var(--color-black);
  --text-muted:    var(--color-gray-600);
  --text-faint:    var(--color-gray-400);
  --border:        var(--color-gray-200);
  --border-strong: var(--color-gray-400);

  --accent:        var(--color-mauve-300);   /* era --color-beige */
  --accent-text:   var(--color-black);

  --btn-primary-bg:   var(--color-black);     /* mantém — já é 17:1, testado */
  --btn-primary-text: var(--color-white);
  --btn-secondary-bg:   var(--color-mauve-100);
  --btn-secondary-text: var(--color-black);

  --radius-xl: 20px;
}
```

**Nota de contraste**: os pares `--pill-tan-text`/`--pill-peach-text` acima foram escurecidos deliberadamente em relação ao tom exato da referência (que usa um marrom mais claro, provavelmente abaixo de 4.5:1 num badge de texto pequeno) — meça com o WebAIM Contrast Checker antes de finalizar; se preferir o tom mais claro por estética, use-o só em ícone, nunca no texto do pill.

**Regra geral**: mauve/rosé é cor de **fundo e gráfico**, nunca de texto de corpo — evita qualquer risco de contraste em cima de um acento pastel. Texto continua sempre em `--text`/`--text-muted`/`--text-faint`.

---

## 3. Componentes-chave

### 3.1 Item de navegação (sidebar)
```
Anatomia: [ícone 20px] + [label] + [badge opcional, se decidirem manter — item 4 pede remover]
Estado padrão: ícone --text-faint, label --text-muted, sem fundo
Estado ativo: fundo --color-gray-100 (pill, border-radius 10px), ícone e label --text
Padding: 10px 12px · gap ícone→label: 12px · altura ~44px (touch target ok)
Label de seção ("OVERVIEW", "FRIENDS"): 11px, uppercase, letter-spacing 0.05em, --text-faint, weight 500
```

### 3.2 Banner/hero (topo do conteúdo — candidato a header da Home, item 1)
```
Fundo: gradient 135deg, mauve-300 → mauve-500
Padding: 40px · border-radius: var(--radius-xl)
Label superior: uppercase 11px, branco a ~80% opacidade
Headline: heading-xl, branco, peso 600–700 (Raleway fino demais aqui — ver decisão de fonte, seção 0)
Botão: primary, pill (border-radius: 999px), com ícone circular branco à direita
```
Conteúdo real da Home (item 1) não tem exatamente um "curso em destaque" — se optarem por manter esse banner, sugiro usá-lo como saudação do dia ("Bom dia, Otávio 🔥" + resumo de 1 linha do período), não como peça promocional — mais coerente com um CRM do que com uma plataforma de cursos. Fica pra você decidir se entra ou se a Home pula direto pros stat-cards.

### 3.3 Stat mini-card (linha de 3 cards abaixo do banner)
```
Fundo: --surface · border-radius: 16px · padding: 16px · shadow: var(--shadow-sm)
Ícone: círculo 40px, fundo pastel (mesma cor da categoria), ícone 20px centralizado
Texto superior: 12px --text-muted ("2/8 watched" → aqui vira ex. "12 no mês")
Título: 16px, weight 600, --text
Menu "⋮": canto superior direito, --text-faint, 24×24 touch target
```
Mapeamento sugerido pros 5 itens do briefing original (item 1): como são 5 métricas e a referência mostra 3 cards + painel lateral, sugiro 3 stat-cards em destaque (Novos clientes, Receita, Despesas) + Estoque crítico e Clientes sem retorno como as duas seções de lista mais abaixo (nos lugares de "Continue Watching" e "Your Lesson" da referência) — mantém a hierarquia visual da referência sem forçar 5 cards apertados numa linha só.

### 3.4 Pill/badge de categoria
```
Padding: 4px 10px · border-radius: 999px · font: 12px weight 500
Ícone: 14px, mesma cor do texto · gap ícone→texto: 4px
Cores: ver tokens --pill-*-bg / --pill-*-text (seção 2)
```

### 3.5 Botão primário
```
Fundo: --btn-primary-bg (quase-preto, 17:1 contra branco — testado) · texto branco
Border-radius: 999px (pill — a referência usa pill em botão primário, diferente do --radius: 8px atual dos botões)
Padding: 12px 20px · ícone circular branco à direita (opcional, 24px, seta escura dentro)
```
Isso é uma mudança de forma (retângulo arredondado → pill) em relação ao `.btn--primary` atual — vale decidir se pill vira padrão de todo botão primário do sistema ou só do CTA de destaque (banner). Botões de ação em tabela/toolbar (ex. "+ Novo Item") tendendo a pill em tudo pode ficar "querido demais" pra ações operacionais repetidas — sugiro pill só no CTA de destaque, retângulo arredondado (8px, como já é) nos botões de ação do dia a dia.

### 3.6 Linha de tabela (referência "Your Lesson")
```
Sem bordas entre linhas (usa espaçamento, não `border-bottom`) — diferente da tabela atual do sistema (`.data` tem grid mais denso/utilitário)
Colunas: avatar+nome (esquerda) | pill de categoria | descrição (texto solto) | ação (ícone circular)
Altura de linha: ~56px (confortável, não compacta)
```
Isso conflita levemente com o padrão atual de `.data` usado em Clientes/Estoque/Histórico/Financeiro, que é mais denso e tabular (números alinhados à direita, várias colunas). Sugiro **não** reformular essas tabelas operacionais pro estilo "cards em linha" da referência — ele funciona bem pra pouco volume (lista de lições), mas em Financeiro/Histórico com filtros e muitas linhas o formato tabular denso atual continua sendo a escolha certa. Reservar o estilo "linha confortável" só pra Home.

### 3.7 Painel direito — card "Statistic"
```
Fundo: --surface · border-radius: var(--radius-xl) · padding: 24px
Avatar com anel de progresso: SVG stroke, cor mauve-500, ~4px de espessura
Gráfico de barras: barras em mauve-300/500 (mais escura = valor maior/destaque do período), sem grid pesado, só linha pontilhada leve nos eixos
Lista "Your mentor" → mapeamento sugerido: "Clientes que precisam de retorno" (reaproveita a lógica já pronta da aba Reativação de Histórico) com botão de ação equivalente ao "Follow" (ex. "WhatsApp", já que o item 7 do briefing pede exatamente esse fluxo)
```

---

## 4. O que NÃO trazer da referência (fora de escopo ou já resolvido diferente)

- "Inbox" — não existe conceito de mensageria interna no Harmon IA; não replicar esse item de menu.
- Sistema de "seguir mentor" (Follow) — não existe conceito de seguir profissionais no CRM; reaproveitar só o *padrão visual* do botão pill outline pra outra ação (ex. WhatsApp, Agendar).
- "watched/progress" nos mini-cards — específico de curso; a Home usa números de negócio (contagem/R$), não progresso percentual.

---

## 5. Próximo passo

Com a decisão de tipografia (seção 0) e a paleta validada (seção 2, idealmente conferindo os hex reais com conta-gotas na imagem original em alta resolução), dá pra atualizar `tokens.css` e `components.css` de fato. Recomendo implementar nessa ordem: tokens → componentes base (botão, pill, card, nav item) → shell de 3 colunas → só então remapear os módulos existentes por cima.

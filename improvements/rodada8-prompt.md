# Rodada 8 — Prompt de execução (colar no terminal / Claude Code)

> **Como usar:** abra uma sessão do Claude Code na raiz do projeto Harmon IA e
> cole este arquivo inteiro como prompt. Todos os itens abaixo já foram
> levantados e confirmados com o usuário (Otávio) numa sessão de triagem —
> não é preciso reconfirmar escopo. Uma investigação prévia no código já
> localizou a causa raiz de vários itens (indicado em cada um); confirme
> lendo o código atual antes de aplicar, pois o repositório pode ter mudado.

---

Você vai executar a **Rodada 8** de aprimoramentos do Harmon IA: 9 itens,
todos de UI/UX (contraste de tema, navegação mobile, responsividade do
dashboard, fluxo do modal de agendamento e redesign da tela de login).

Execute em **5 fases**, nessa ordem. Rode `node --check` em cada arquivo
`.js` tocado antes de passar pra próxima fase. **Não** faça commit/push/
deploy — pare para revisão visual do usuário no fim, como nas rodadas
anteriores.

---

## FASE 1 — Tema (cor de destaque + dark mode) não está sendo seguido em todo lugar

### 1.1 Checkboxes de seleção em massa não acompanham a cor do tema
**Arquivos:** `assets/css/components.css:151` (`.data .chk input { accent-color:
var(--color-mauve-700); }`), afeta `clientes.js`, `estoque.js`,
`financeiro.js`, `historico.js` (todas as colunas `.chk`).

A regra já referencia o token de tema correto, mas visualmente os checkboxes
aparecem cinza/preto sólido, sem a cor de destaque (ver prints do usuário —
Estoque, lista mobile). Hipóteses a checar antes de corrigir:
- `accent-color` tem suporte inconsistente entre navegadores/webviews — pode
  não estar renderizando como esperado no ambiente do usuário.
- Alguma regra mais específica (ou ordem de import) pode estar sobrepondo
  `.data .chk input`.

Se `accent-color` não for confiável o suficiente, substitua por um checkbox
custom-estilizado (via `appearance: none` + `background`/`border` usando
`var(--color-mauve-700)` no estado `:checked`, com um check em SVG ou
`::after`), garantindo consistência cross-browser e resposta a `data-accent`.

**Teste:** trocar a cor de destaque em Configurações → Aparência (rose/sand/
sky/lilac/mint) e confirmar que os checkboxes de seleção mudam de cor em
Clientes, Estoque, Histórico e Fluxo de Caixa — desktop e mobile.

### 1.2 Ícones dos mini-cards (Home) somem no dark mode
**Arquivo:** `assets/js/home.js`, função `miniCard()` (~linha 129) +
`assets/css/components.css:340` (`.mini__icon`).

**Causa raiz já identificada:** `miniCard()` sempre usa
`background: var(--color-mauve-100)` (tom claro da paleta) para o círculo do
ícone, em qualquer tema. O ícone em si (SVG com `stroke="currentColor"`)
herda a cor do texto do contexto — que no dark mode (`theme.css:10`) é
`--text: #f1eee9` (quase branco). Resultado: ícone quase branco dentro de um
círculo também claro (`--color-mauve-100` continua claro mesmo no dark,
porque é definido em `accent.css`, não em `theme.css`) → contraste ~0,
ícone invisível.

**Fix:** dar ao `.mini__icon` uma cor de ícone própria e fixa (ex.:
`color: var(--color-mauve-700)`), independente do tema, para que o ícone
sempre contraste com o fundo claro do círculo — em vez de herdar
`--text`, que inverte entre os temas.

**Teste:** Home em dark mode — os 3 ícones dos mini-cards (Novos clientes,
Recebido, Despesas) devem ficar visíveis e com contraste adequado (WCAG AA).

### 1.3 Cor secundária do dark mode
**Arquivo:** `assets/css/theme.css`, linhas 15 e 21.

Trocar `#2e2a25` por `#2f2e2e` nas duas ocorrências:
- `--accent: #2e2a25;` → `--accent: #2f2e2e;`
- `--btn-secondary-bg: #2e2a25;` → `--btn-secondary-bg: #2f2e2e;`

**Teste:** dark mode — botões secundários ("Novo cliente", "Novo produto",
"Novo lançamento", "Ver agenda de hoje" no hero da Home) e avatar (usa
`--accent` como fundo) devem refletir o novo tom.

### 1.4 Barra de rolagem não acompanha o tema do app
**Arquivos:** `assets/css/theme.css` e `assets/css/tokens.css` (novo bloco
global) ou `components.css`.

Hoje não há nenhuma regra de `scrollbar-color`/`::-webkit-scrollbar` global
no projeto (só existe `scrollbar-width: none` pontual em `.segmented`,
`components.css:90`) — por isso o navegador usa a scrollbar padrão do
sistema operacional, que não respeita nem o tema claro/escuro nem a cor de
destaque escolhidos no app.

**Fix:** adicionar regras globais de scrollbar customizada usando os tokens
semânticos existentes (`--surface`/`--surface-2` para o trilho,
`--color-mauve-500`/`--color-mauve-700` para o polegar), cobrindo:
- `scrollbar-color: var(--color-mauve-500) var(--surface-2);` +
  `scrollbar-width: thin;` no `html`/`body` (Firefox e navegadores
  modernos).
- `::-webkit-scrollbar`, `::-webkit-scrollbar-track`,
  `::-webkit-scrollbar-thumb` equivalentes (Chrome/Safari/Edge/webviews).

Como já existem 5 paletas de accent (`accent.css`) e 2 temas
(`theme.css`), usar tokens (não hex fixo) garante que a scrollbar já
acompanhe automaticamente qualquer combinação tema+cor escolhida pelo
usuário.

**Teste:** alternar claro/escuro e as 5 cores de destaque; a scrollbar (em
qualquer área rolável — tabelas, modais, drawers) deve sempre combinar com
o tema ativo, nunca com o tema do sistema operacional.

---

## FASE 2 — Navegação mobile

### 2.1 Menu "Mais" (sheet mobile) sem títulos
**Arquivo:** `assets/css/layout.css:258`.

**Causa raiz já identificada:** a regra
`.sidebar__brand span, .sidebar__brand b.brand-mark, .nav__item .label,
.sidebar__user-info { display: none; }`, dentro de `@media (max-width:
1200px)` (linha 256), **não está escopada à sidebar** no seletor
`.nav__item .label` (diferente dos outros seletores da mesma regra, que só
existem dentro da sidebar). Como esse breakpoint (`≤1200px`) continua ativo
em telas ≤900px, e o sheet "Mais" (`app.js`, função `openMoreSheet()`,
~linha 135) reaproveita exatamente as classes `.nav__item` / `.label`
(linha 149), os rótulos de texto do sheet ficam escondidos junto com os da
sidebar — mesmo a sidebar estando com `display:none` nesse breakpoint
(`layout.css:271`).

**Fix:** escopar o seletor para `.sidebar .nav__item .label` (em vez de
`.nav__item .label` solto), preservando o comportamento de colapsar a
sidebar em telas médias sem afetar o sheet mobile.

**Aproveitando a mesma revisão:** deixar o sheet "Mais" mais bonito —
mais respiro entre os itens (`.nav__item` dentro do sheet usa o mesmo
padding compacto da sidebar colapsada), ícone e label alinhados, talvez
um separador sutil antes de "Sair". Manter a estrutura atual (avatar +
nome/e-mail no topo, lista de atalhos, Sair por último).

**Teste:** abrir o menu "Mais" no mobile (≤900px) — cada item deve mostrar
ícone **e** título ("Serviços", "Estoque", "Configurações", "Sair" etc.).

### 2.2 Botão flutuante "+" descentralizado (mobile)
**Arquivos:** `assets/css/components.css:403-410` (regra
`.header__actions .btn--primary` no FAB mobile) + markup gerado em
`estoque.js:30` (`${icon('plus')}<span class="btn-label">...`) e
equivalentes em outros módulos.

**Causa raiz já identificada:** o botão de ação primária do header (que vira
o FAB circular em `≤900px`) já contém o ícone SVG `plus` (18px, fixo via
`.btn svg`, `components.css:30`) **e** o CSS adiciona um segundo símbolo
via `::before { content: '+'; font-size: 28px; }` (`components.css:410`).
No mobile, `.btn-label` (o texto) fica oculto, mas o SVG do ícone continua
renderizado — então o botão acaba com **dois** elementos de "+" (o SVG e o
pseudo-elemento) lado a lado como itens flex (por causa do `gap` herdado de
`.btn`), o que desloca o conjunto do centro visual do círculo.

**Fix:** manter só um dos dois. Mais simples: esconder o SVG do ícone nesse
breakpoint (`.header__actions .btn--primary svg { display: none; }`) e
deixar o `::before` (28px) como único elemento, perfeitamente centralizado
pelo `display:flex; align-items:center; justify-content:center` que
`.btn` já tem.

**Teste:** no mobile, o "+" do FAB (Estoque, Agenda etc.) deve ficar
perfeitamente centralizado no círculo preto, em qualquer tema.

---

## FASE 3 — Dashboard (Home): atalhos do hero vazando da tela

**Arquivo:** `assets/css/components.css:334` (`.hero__actions { display:
flex; gap: var(--sp-2); flex-wrap: wrap; }`) + `assets/js/home.js:145-150`
(5 botões: 4 `btn--secondary` + 1 `btn--primary`).

Em larguras intermediárias (entre o desktop cheio e o breakpoint mobile de
`≤640px`, que já tem tratamento em grid 2 colunas —
`components.css:456`), os botões `white-space: nowrap` (herdado de `.btn`,
linha 13) não têm regra de contenção de largura: o `flex-wrap` deveria
jogar o excesso pra próxima linha, mas o botão "Ver agenda de hoje" (texto
mais longo) está estourando a largura do card em vez de quebrar
corretamente — como visto no print do usuário.

**Fix (usuário já validou a direção):** redesenhar `.hero__actions` para
nunca vazar, testando esses ajustes (pode combinar mais de um):
- Grid responsivo com `minmax()` em vez de `flex-wrap` cru, garantindo que
  nenhum item ultrapasse a largura do container pai.
- Reduzir o tamanho/padding dos 4 botões secundários (rosa) — talvez
  `.btn--sm` ou um padding menor específico do hero — e o botão primário
  ("+ Agendar") ocupando a largura cheia da última linha/abaixo dos
  demais, como o próprio usuário sugeriu.
- Garantir `min-width: 0` e `overflow: hidden`/`text-overflow: ellipsis`
  como rede de segurança em qualquer botão dentro de `.hero`, para que
  nada estoure o card mesmo em larguras não previstas.

Valide em pelo menos 3 larguras: desktop cheio, tablet (~768-900px) e o
breakpoint mobile existente (≤640px, que já vira grid 2 colunas — não
regredir esse caso).

**Teste:** em nenhuma largura de tela os 5 botões do hero devem ultrapassar
a borda do card "Olá, {nome}".

---

## FASE 4 — Modal "Novo agendamento": campo Cliente

**Arquivo:** `assets/js/agenda.js`, função `openForm()` (~linha 312) —
componente de autocomplete de cliente.

### 4.1 Lista de sugestões abre sozinha
Hoje a lista de clientes aparece expandida assim que o modal carrega (ver
print do usuário — "Buscar cliente..." já mostra "Tayana Domiciano" logo
abaixo, sem interação). Corrigir para que a lista **só** apareça:
- ao clicar/focar no campo (mostrando os clientes recentes ou todos, como
  já faz hoje), ou
- ao começar a digitar (filtrando pelo texto).

Fechar a lista ao clicar fora ou selecionar um cliente (se esse
comportamento já existir em algum outro autocomplete do projeto, ex.
seleção de serviço, reaproveite o mesmo padrão/componente).

### 4.2 Cadastro rápido de cliente inline
Quando o texto digitado não corresponder a nenhum cliente existente, exibir
uma opção "Cadastrar {texto digitado} como novo cliente" (ou botão
equivalente) na própria lista de sugestões. Ao clicar:
1. Abrir um popup pequeno (modal compacto) com 3 campos: **Nome**,
   **Telefone**, **E-mail** (nome pré-preenchido com o texto digitado).
2. Ao confirmar, criar o registro em `clients` (reaproveitar a função de
   criação já usada em `clientes.js`, para manter validação/formatação de
   telefone consistentes — não duplicar lógica).
3. Selecionar automaticamente esse cliente recém-criado no campo do modal
   de agendamento, permitindo continuar o fluxo sem reabrir nada.
4. O cliente já fica na listagem completa de Clientes, com os demais campos
   (CPF, endereço etc.) em branco, para a gestora completar depois.

**Teste:** digitar um nome inexistente no campo Cliente do "Novo
agendamento" → aparece opção de cadastro rápido → preencher nome/telefone/
e-mail → cliente é criado, selecionado no agendamento, e aparece na lista
de Clientes com dados parciais.

---

## FASE 5 — Tela de Login

**Arquivo:** `index.html` (estrutura + estilos inline/relacionados em
`assets/css/layout.css`).

- Remover o `<h1 class="login-form__title">Olá, novamente</h1>`
  (`index.html:19`). Ajustar o espaçamento que ficar entre a logo e o
  subtítulo "Gestão inteligente para saúde estética." sem esse título.
- Trocar a cor de fundo da página de login (hoje o `<main class="login">`
  usa o fundo padrão claro do app) por algo mais próximo da referência
  visual aprovada pelo usuário — tom neutro/cinza claro por trás do card
  flutuante.
- Substituir o `<aside class="login-visual">` (hoje um SVG abstrato inline,
  linhas 56-88) pela imagem salva pelo usuário em
  `assets/img/login-visual.png`. **Decisão já fechada:** manter como
  PNG/WebP otimizado (não vetorizar) — é um render fotográfico com
  gradiente metálico que perderia o efeito se traçado em SVG. Usar
  `background-image` ou `<img>` com `object-fit: cover` preenchendo a
  coluna direita do card, mantendo o `<span class="login-visual__mark">`
  (marca d'água "Harmon IA") sobreposta, como já existe hoje.
- Gerar (ou comprimir) uma versão otimizada da imagem para peso de
  carregamento razoável (a imagem original é 2200×3350px) — redimensionar
  para no máximo a resolução realmente exibida (a coluna tem ~440px de
  largura de design, considerar 2x para retina = ~880px) e usar `.webp`
  como formato final, com fallback `.png` se necessário.

**Importante:** não alterar o fluxo de autenticação (`signInWithGoogle()`)
nem o comportamento dos campos e-mail/senha, que continuam apenas visuais
(decisão da Rodada 6, ainda válida).

**Teste:** página de login sem o texto "Olá, novamente", fundo com a nova
cor, e a coluna direita mostrando a imagem `login-visual` (não mais o SVG
abstrato), responsiva (a coluna de imagem some em telas estreitas, como já
acontece hoje).

---

## Fechamento (fazer sempre, no fim)

1. `node --check` em todos os `.js` tocados.
2. Testar as 5 cores de destaque (`data-accent`) × 2 temas (claro/escuro)
   nos itens 1.1, 1.2, 1.3 e 1.4 — são mudanças transversais, valem a pena
   conferir a matriz completa, não só um caso.
3. Registrar uma seção **"Rodada 8"** em `HISTORICO.md`, seguindo o padrão
   das rodadas anteriores (Contexto / Feito / Verificação / Decisões-
   pegadinhas / Pendente-próximo).
4. **Não** fazer commit/push/deploy automaticamente — parar para revisão
   visual do usuário (ele confere em ambiente real antes do próximo passo,
   mesmo padrão de todas as rodadas anteriores).

## Decisões já fechadas com o usuário (não perguntar de novo)

- Imagem do login (`assets/img/login-visual.png`) fica como **PNG/WebP
  otimizado**, não vetorizada — perderia o gradiente metálico da
  referência.
- Cor secundária do dark mode: `#2e2a25` → **`#2f2e2e`**.
- Hero da Home: botão "Agendar" (primário) pode ocupar a largura cheia,
  os 4 botões secundários podem diminuir — usuário deu liberdade para
  achar a melhor solução, desde que nada vaze da tela.
- Cadastro rápido de cliente no modal de agendamento: popup pequeno com
  Nome/Telefone/E-mail; completar o resto do cadastro fica para depois.

## Itens em aberto para você decidir durante a execução (sem necessidade de
## voltar a perguntar ao usuário, salvo se achar algo que muda o escopo)

- Fase 1.1: se `accent-color` nativo já resolver o contraste em todos os
  navegadores testados, não é necessário migrar para checkbox custom — só
  fazer isso se o nativo continuar inconsistente.
- Fase 3: escolha livre entre grid com `minmax()`, redução de padding dos
  botões secundários, ou combinação dos dois — qualquer solução que
  elimine o vazamento é aceitável.
- Fase 5: peso/dimensões exatas da imagem otimizada — usar bom senso de
  performance sem perder qualidade visual perceptível.

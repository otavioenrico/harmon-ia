# Rodada 11 — Correções da Landing Page

**Data:** 02/07/2026
**Contexto:** revisão visual da landing após a rodada 10 (implementada e no ar). São 9
correções apontadas página a página. Mantêm-se os princípios da rodada 10: **zero hex cru**
(tudo via tokens), site **light/limpo**, acessibilidade preservada.

## Arquivos afetados
- `index.html`, `planos.html`, `sobre.html`
- `assets/css/landing.css`
- `assets/css/tokens.css` (mudança de tokens no Erro 4)
- `assets/css/components.css` (Erro 5 — `.btn` global, se o sublinhado nascer lá)

---

## 1. Barra de segmentos sem scrollbar
**Problema:** a barra rola horizontalmente com scrollbar feia; seção apertada.
**Correção (default adotado):** trocar `flex-nowrap + overflow-x: auto` por **multi-linha**:
`.segment-list { flex-wrap: wrap; justify-content: center; overflow: visible; }` e remover o
`padding-bottom` que abria espaço pra scrollbar. Chips quebram em várias linhas e cabem todos.
**Alternativa (se preferir):** efeito esteira/marquee com animação em loop (CSS
`@keyframes` + duplicação da lista), sem barra. — *não adotado por padrão.*
**Aceite:** todos os segmentos visíveis, sem scrollbar, seção com respiro.

## 2. Cabeçalho das seções centralizado
**Problema:** `.section__head` alinhado à esquerda (`max-width: 640px`) deixa vazio enorme no
canto superior direito.
**Correção:** centralizar: `.section__head { margin-inline: auto; text-align: center; }`.
Aplica-se às seções de conteúdo (Features, Segmentos, "Trocar a planilha", Como funciona,
Prova social, FAQ). Os grids/cards abaixo permanecem.
**Aceite:** título e subtítulo centralizados; espaço equilibrado.

## 3. Seção "Por que trocar a planilha" em cards
**Problema:** linhas com texto riscado + seta ficaram ruins e assimétricas.
**Correção (default adotado):** refazer como **grid de cards 2×2** (`repeat(auto-fit,
minmax(260px, 1fr))`, colapsa pra 1 coluna no mobile). Cada card com forma (fundo `--surface`,
borda `--border`, `radius-lg`, `padding --sp-5`), mostrando **dor → solução** de forma
organizada: a dor como rótulo/subtítulo e a solução em destaque (ou ícone + solução em título
e dor no corpo). Alinhados e simétricos. Cabeçalho centralizado (Erro 2).
**Aceite:** 4 cards simétricos, alinhados, visualmente limpos.

## 4. Remover a cor de destaque — site 100% neutro
**Problema:** o mauve/rosé aparece em evidência (CTA band, ícones, badges, bordas). O site
deve ser neutro: só **cinza suave + branco + preto**.
**Correção (em `tokens.css`, tokens semânticos — não hardcode):**
- `--accent` → tom neutro (cinza claro, ex.: `--color-gray-200`/`--color-gray-150`).
- `--accent-text` → `--color-black`.
- `--btn-secondary-bg` (hoje `--color-mauve-100`) → cinza neutro (`--color-gray-100/150`).
- **CTA band** (`.cta-band { background: var(--accent) }`) → fundo `--surface` ou `--bg`
  (cinza/branco), texto neutro, botão primário preto.
- **Ícones de feature** (`.feature__icon { background: var(--accent) }`) → fundo cinza suave,
  ícone escuro.
- **Badge/borda "Recomendado"** e **borda da prova social** (hoje `--accent`) → preto/cinza.
- **Anel de foco** (`--focus-ring` usa `--color-mauve-700`) → tom neutro escuro com contraste
  ≥3:1 (ex.: `--color-black` ou `--color-gray-600`), mantendo AA.
- Varredura: nenhum `--color-mauve-*` deve continuar em uso em componentes visíveis.
**Aceite:** nenhuma cor em evidência; hierarquia só por cinza/preto/branco.

## 5. Remover sublinhado dos botões (global)
**Problema:** vários botões (`.btn`) exibem texto sublinhado — herdam estilo de `<a>`.
**Correção:** `.btn { text-decoration: none; }` (e `:hover`, `:focus`) onde a classe é
definida (`components.css`).
**Aceite:** nenhum botão sublinhado em nenhum estado.

## 6. Remover sublinhado dos links do rodapé
**Problema:** links do rodapé sublinhados.
**Correção:** `.landing-footer__links a { text-decoration: none; }` (inclusive `:hover`).
**Aceite:** links do rodapé sem sublinhado.

## 7. Hero — altura e alinhamento
**Problema:** hero alto demais e conteúdo desalinhado (link "Ver planos" flutua à direita do
input; botão cai solto embaixo).
**Correção:**
- **Altura:** reduzir ~320px. De `min-height: 88vh` para ~`65vh` (ou `calc(88vh - 320px)`);
  ajustar o breakpoint mobile proporcionalmente.
- **Alinhamento:** todo o conteúdo do overlay numa **coluna alinhada à mesma margem esquerda**,
  com ritmo vertical consistente. Reorganizar o form: input + botão "Quero ser avisado" +
  link "Ver planos e preços" empilhados/alinhados à esquerda (não espalhados). Garantir que o
  `flex-wrap` do form não jogue itens pra posições soltas.
**Aceite:** hero mais baixo; título, subtítulo, form e link alinhados à esquerda, bem postos.

## 8. Hero — fundo quase preto (remover imagem placeholder)
**Problema:** a imagem mauve 3D é placeholder e destoa.
**Correção:** remover a imagem de fundo do hero por ora. Fundo **quase preto** preenchendo
tudo (`--color-black` ou near-black). Manter a estrutura (`.lp-hero-full__media`) pronta pra
receber imagem/vídeo depois — só comentar/trocar a `<img>` por um fundo sólido. Texto branco
segue com bom contraste.
**Aceite:** hero com fundo neutro escuro sólido, sem imagem, pronto pra troca futura.

## 9. FAQ em sanfona (accordion)
**Problema:** respostas do FAQ ficam todas abertas.
**Correção:** converter cada item para `<details>/<summary>` (accordion nativo vanilla, sem
JS), estilizado como **bloco/card** (borda, radius, padding) com indicador de abrir/fechar
(ex.: `+`/`−` ou chevron que gira). Aplicar na Home (FAQ curta) e em Planos (FAQ completa).
Preservar acessibilidade (summary é focável por padrão).
**Aceite:** clicar na pergunta abre/fecha a resposta; itens em cards.

## 10. Header 80px no desktop
**Problema:** o header (~96px) ficou grande demais.
**Correção:** reduzir para **80px**. Em `.landing-header__inner`, trocar
`padding-block: var(--sp-6)` (32px) por `var(--sp-5)` (24px) ≈ 80px. Mobile mantém `--sp-4`.
**Aceite:** header ~80px no desktop.

---

## Ordem sugerida
Tokens primeiro (4), depois os globais rápidos (5, 6, 10), depois seção a seção
(1, 2, 3, 9) e por fim o hero (7, 8).

## Verificação final
- Abrir as 3 páginas (desktop + mobile ~390px).
- Conferir: nenhum mauve/rosé em lugar nenhum; nenhum sublinhado em botão ou link de rodapé;
  segmentos em multi-linha; cabeçalhos centralizados; "trocar a planilha" em cards simétricos;
  hero mais baixo, alinhado e com fundo near-black; FAQ abrindo/fechando.
- `grep -rin "mauve" assets/css/*.css` deve retornar só definições cruas não usadas (ou nada
  em componentes).

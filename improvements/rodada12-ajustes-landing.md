# Rodada 12 — Ajustes da Landing Page

**Data:** 02/07/2026
**Contexto:** revisão visual após a rodada 11 (já aplicada). São 13 ajustes. Alguns
**refinam** itens da rodada 11 — sinalizado em cada um. Princípios mantidos: **zero hex cru**
(tudo via tokens), site **neutro/light/limpo**, acessibilidade preservada.

## Arquivos afetados
- `index.html`, `sobre.html`, `planos.html`
- `assets/css/landing.css`
- `assets/css/tokens.css` (itens 6 e 13 — mudança de tokens)
- `assets/css/components.css` (se necessário para `.btn`)

---

## 1. FAQ centralizado
**Problema:** título do FAQ centralizado, mas o bloco de cards do accordion está encostado à
esquerda.
**Correção:** `.faq { margin-inline: auto; }` (o `max-width: 720px` já existe). Centralizar o
bloco sob o título. Vale Home e Planos.
**Aceite:** cards do FAQ centralizados sob o título.

## 2. Seção de prova social em 2 colunas (com imagem à direita)
**Problema:** seção "Construído com quem está na cadeira" muito vaga e centralizada.
**Correção:** layout de **2 colunas**:
- Esquerda: título + citação, **alinhados à esquerda** (exceção à centralização das demais
  seções).
- Direita: **forma/placeholder de imagem** (fundo neutro escuro, `radius-xl`, rótulo "imagem"
  por ora) preenchendo a coluna.
- Altura da seção maior: `min-height: 560px`, conteúdo centralizado na vertical.
- Mobile: colapsa para 1 coluna (imagem acima ou abaixo do texto).
**Aceite:** duas colunas, texto à esquerda, imagem à direita, seção ~560px.

## 3. "Por que trocar a planilha" — grid 2×2 + CTA (refina rodada 11 #3)
**Problema:** `auto-fit` gerou 3+1, desalinhado.
**Correção:** fixar **2 colunas × 2 linhas** (`grid-template-columns: repeat(2, 1fr)`; 1 coluna
no mobile), cards simétricos. **CTA "Quero sair da planilha"** vira **botão primário preto,
centralizado** abaixo do grid.
**Aceite:** 4 cards simétricos em 2×2; CTA preto centralizado.

## 4. Legibilidade da "dor" nos cards — ícones ✕/✓ (refina #3/#19)
**Problema:** texto riscado (line-through) difícil de ler.
**Correção:** **remover o line-through**. Diferenciar por ícone:
- Dor: ícone **✕** em tom discreto (`--text-muted`), texto legível.
- Solução: ícone **✓** em destaque (`--text`), texto forte.
**Aceite:** contraste antes/depois claro, sem risco no texto.

## 5. Página Sobre em módulos (SEGUIR O EXEMPLO VISUAL enviado)
**Problema:** a implementação atual deixou o **texto solto sobre o fundo cinza** — não bateu
com o exemplo visual enviado. No exemplo, o texto fica **dentro de um card branco** que se
**sobrepõe/conecta** ao bloco escuro da imagem, formando um módulo em camadas.
**Correção — replicar o exemplo:**
- **Texto dentro de um card branco** (`background: var(--surface)`, `border-radius: var(--radius-xl)`,
  `padding` generoso `--sp-6`, `box-shadow: var(--shadow)` sutil) — o card é uma forma
  visível, não texto solto.
- **Placeholder de imagem à direita**: bloco escuro (`--color-black`/near-black),
  `radius-xl`, rótulo "imagem", **maior/mais alto** que o card de texto.
- **Sobreposição/camada:** o card branco de texto **avança sobre** a borda esquerda do bloco
  de imagem (usar `margin` negativo ou grid com colunas sobrepostas + `z-index`), exatamente
  como no exemplo — os dois formam um módulo único em camadas, não duas caixas separadas com
  um vão no meio.
- **Preencher os 3** blocos (O que é / Pra quem é / A visão). Default: imagem à direita nos três
  (ou alternar lados a cada módulo se ficar melhor — dev decide pelo exemplo).
- **Largura menor:** não usar a largura cheia do container. Limitar os módulos a
  `max-width: 960px` centralizados (`margin-inline: auto`).
- Mobile: colapsa para 1 coluna (card de texto acima, imagem abaixo), sem sobreposição.
**Aceite:** cada módulo = card branco de texto sobreposto a um bloco de imagem escuro,
idêntico ao exemplo visual; nada de texto solto no fundo; largura contida (~960px).

**HTML de referência (repetir para os 3 blocos, com o conteúdo de cada um):**
```html
<div class="about-modules">
  <div class="about-module">
    <div class="about-module__text">
      <h3 class="about-module__title">O que é.</h3>
      <p class="about-module__body">O Harmon IA junta agenda, clientes, estoque e
        financeiro num só lugar, sincronizado com o Google Calendar. Chega de uma planilha
        pra cada coisa e de sistema cheio de função que você nunca usa.</p>
    </div>
    <div class="about-module__media"><span>imagem</span></div>
  </div>
  <!-- Pra quem é. / A visão. — mesma estrutura -->
</div>
```

**CSS de referência (zero hex cru — tudo via token):**
```css
.about-modules {
  display: flex; flex-direction: column; gap: var(--sp-8);
  max-width: 960px; margin-inline: auto;   /* largura contida + centralizado */
}
.about-module {
  position: relative;
  display: grid; grid-template-columns: 1fr 1fr; align-items: center;
}
/* card branco do texto: avança sobre a imagem e fica por cima */
.about-module__text {
  position: relative; z-index: 1;
  background: var(--surface);
  border-radius: var(--radius-xl);
  padding: var(--sp-6);
  box-shadow: var(--shadow);
  margin-right: calc(var(--sp-7) * -1);     /* sobreposição sobre o bloco de imagem */
}
.about-module__title { margin-bottom: var(--sp-3); letter-spacing: -0.02em; }
.about-module__body  { color: var(--text-muted); }
/* bloco escuro da imagem: maior/mais alto que o card de texto */
.about-module__media {
  background: var(--color-black);
  color: var(--color-white);
  border-radius: var(--radius-xl);
  min-height: 340px;
  display: flex; align-items: center; justify-content: center;
  font-size: var(--fs-sm);
}
@media (max-width: 720px) {
  .about-module { grid-template-columns: 1fr; }
  .about-module__text { margin-right: 0; }   /* sem sobreposição no mobile */
  .about-module__media { min-height: 220px; }
}
```
> Para alternar o lado da imagem a cada módulo (se ficar melhor), inverter a ordem das
> colunas num modificador `.about-module--reverse` (imagem à esquerda, texto com
> `margin-left` negativo em vez de `margin-right`).

## 6. Tipografia maior — GLOBAL (tokens)
**Problema:** títulos 32px e corpo ~15px pequenos.
**Correção (em `tokens.css`, vale landing + app):**
- `--fs-2xl: 2rem` → `2.5rem` (40px).
- `--fs-base: 0.95rem` → `1rem` (16px).
Obs.: o título do hero usa `clamp()` próprio, não muda com isso (deixar como está por ora).
**Aceite:** títulos 40px, corpo 16px em todo o produto.

## 7. Hero alinhado à esquerda (refina rodada 11 #7)
**Problema:** o conteúdo do hero está **centralizado**; deveria ficar **alinhado à esquerda**,
na mesma margem do logo "Harmon IA".
**Correção:** o `.lp-hero-full__overlay` combina `.landing-container` (`margin: auto`) com
`max-width: 640px`, o que centraliza. Encostar o bloco na **margem esquerda do container**
(alinhado ao eixo do header). Input + botão + "Ver planos e preços" alinhados pela **mesma
borda esquerda** com espaçamento uniforme (**a critério do dev**, deixar limpo).
- **Manter** o botão "Quero ser avisado" **preto** — o "sumiço" é só pelo fundo preto
  temporário; com a imagem de fundo ele vai destacar. Não alterar a cor.
**Aceite:** bloco do hero à esquerda, alinhado ao logo; form alinhado e uniforme.

## 8. Barra de segmentos — esteira + ícones (SUBSTITUI rodada 11 #1)
**Problema:** a versão multi-linha ficou pobre.
**Correção:**
- **Esteira (marquee):** rolagem contínua automática, **full-bleed** (ponta a ponta, saindo
  do container). Duplicar a lista para loop sem emenda. Respeitar `prefers-reduced-motion`
  (pausar) e pausar no `:hover`.
- **Itens maiores:** aumentar padding e fonte dos chips.
- **Ícone por profissão:** SVG inline ao lado de cada item, representando o ramo — manicure,
  sobrancelha, cílios, tatuagem, estética, micropigmentação, maquiagem, barbearia, depilação,
  "e muito mais".
**Aceite:** faixa rolando de ponta a ponta, chips maiores com ícone, sem scrollbar.

## 9. "Comece em três passos" em módulos
**Problema:** os 3 passos estão soltos.
**Correção:** cada passo dentro de um **card/módulo** (fundo `--surface`, borda `--border`,
`radius-lg`, `padding --sp-5`), no padrão dos cards de feature. Grid de 3 colunas (1 no
mobile). Cabeçalho centralizado.
**Aceite:** 3 módulos simétricos.

## 10. Planos com pesos iguais + cards destacados
**Problema:** o Team tem realce de "Recomendado" (badge + borda + botão preto); os cards se
separam pouco do fundo.
**Correção:**
- **Remover** o badge "Recomendado" e o realce do Team. Os dois planos com **peso visual
  igual**: mesma borda e **mesmo estilo de botão** nos dois.
- **Destacar os cards do fundo**: borda mais definida e/ou sombra sutil, ou colocar os cards
  sobre uma band cinza para o branco saltar.
- **Neutralizar os ✓ verdes** das features (hoje `--success`) → tom neutro (cinza/preto),
  coerente com o site sem cor em evidência.
**Aceite:** dois planos equivalentes; cards nítidos contra o fundo; checks neutros.

## 11. Logo clicável → home
**Problema:** o wordmark "Harmon IA" é `<span>` estático.
**Correção:** transformar em `<a href="/">` nas 3 páginas (sem sublinhado). Badge "Em breve"
fora do link.
**Aceite:** clicar no logo vai para a home.

## 12. Kerning + ponto final nos títulos (estilo Apple)
**Correção:**
- **Kerning:** `letter-spacing: -0.02em` em **todos** os títulos (`.lp-hero__title`,
  `.section__title`, `.cta-band__title`, `.feature__title`, `.plan-card__name`, `.step__title`,
  `.faq__q`, títulos dos módulos). Centralizar numa regra compartilhada.
- **Ponto final:** adicionar `.` ao fim dos títulos que não têm, em tom narrativo (ex.:
  "Feito para o seu trabalho." / "Comece em três passos." / "Perguntas rápidas."). Mudança de
  copy no HTML, título por título, nas 3 páginas.
**Aceite:** títulos levemente mais fechados no kerning e terminando em ponto.

## 13. Tons 100% neutros — remover cast amarelado (tokens)
**Problema:** os cinzas puxam pro quente (R>G>B): `#f5f4f2`, `#ebe8e5`, `#7d766e`, `#6b6760`,
`#1a1816`.
**Correção (em `tokens.css`):** neutralizar mantendo o **mesmo lightness** (R=G=B):
- `--color-gray-100: #f5f4f2` → `#f4f4f4`
- `--color-gray-200: #ebe8e5` → `#ebebeb`
- `--color-gray-400: #7d766e` → `#767676`
- `--color-gray-600: #6b6760` → `#666666`
- `--color-black:    #1a1816` → `#181818`
Manter tudo bright, só sem o amarelo.
⚠️ Revalidar contraste AA de `--color-gray-400`/`600` sobre branco após a troca.
**Aceite:** nenhuma tonalidade quente; cinzas perfeitamente neutros.

---

## Ordem sugerida
Tokens primeiro (6, 13), depois globais (11, 12), depois seção a seção (1, 2, 3, 4, 5, 8, 9,
10) e por fim o hero (7).

## Verificação final
- Abrir as 3 páginas (desktop + mobile ~390px).
- Conferir: FAQ centralizado; prova social 2 colunas; "planilha" 2×2 com ✕/✓ e CTA preto
  centralizado; Sobre em 3 módulos preenchidos; hero alinhado à esquerda; segmentos em esteira
  com ícones; três passos em módulos; planos equivalentes e nítidos; logo clicável; títulos
  com kerning fechado e ponto final; cinzas neutros sem amarelo; tipografia 40/16.
- `grep -rin "mauve\|f5f4f2\|ebe8e5\|7d766e\|6b6760\|1a1816" assets/css/*.css` não deve
  retornar usos remanescentes.

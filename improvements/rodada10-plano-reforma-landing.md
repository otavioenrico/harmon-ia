# Plano de Reforma da Landing Page — Harmon IA

**Data:** 02/07/2026
**Como usar:** este é o prompt de execução para rodar no terminal. Ele reúne (A) as
diretrizes visuais/estruturais e (B) a reforma de copy & SEO documentada em
`improvements/ESCOPO-REFORMA-COPY.md`. Execute em blocos, na ordem. Cada bloco tem
**o quê / onde / como / critério de aceite**.

## Princípios inegociáveis (valem para tudo abaixo)
- **Zero hex cru** em `.html` ou nos CSS de componente. Toda cor/espaço/raio/sombra vem
  dos tokens em `assets/css/tokens.css` (e `theme.css`/`accent.css`). Se faltar um token,
  crie-o em `tokens.css` — não hardcode.
- Site **light, leve e limpo**. Bastante respiro (whitespace). Nada de sombras pesadas.
- Mantém a voz da marca: direta, honesta, sem hype. **Neutra em gênero** (§8 do escopo).
- Não quebrar acessibilidade existente (skip-link, labels, honeypot, foco visível).
- Preservar o fluxo de OAuth no topo do `index.html` (o `<script>` de redirect).

## Arquivos que serão tocados
- `index.html`, `sobre.html`, `planos.html`
- `assets/css/landing.css` (maior parte das mudanças visuais)
- `assets/css/tokens.css` (só se faltar algum token: altura de header, blur, etc.)
- (opcional) `assets/img/` — nova imagem/vídeo de hero quando houver

---

# PARTE A — Estrutura & Visual

## A1. Header fixo com blur
**Onde:** `landing.css` (`.landing-header`) + `tokens.css` se precisar de token de blur.
**Como:**
- `.landing-header { position: sticky; top: 0; z-index: 50; }` (sticky é melhor que fixed
  aqui — não exige compensar o `padding-top` do `<main>`).
- Fundo semitransparente + `backdrop-filter: blur(...)`: usar `--surface` com alpha.
  Criar tokens: `--header-bg: rgba(255,255,255,0.72)` e `--header-blur: 12px` (e as
  contrapartes no tema escuro em `theme.css`). Aplicar
  `background: var(--header-bg); backdrop-filter: blur(var(--header-blur)); -webkit-backdrop-filter: blur(var(--header-blur));`
- Manter o `border-bottom` atual como divisor sutil (fica ótimo com blur).
**Aceite:** ao rolar, o header permanece no topo; o conteúdo aparece desfocado por trás.

## A2. Header maior no desktop (~96px)
**Onde:** `landing.css` (`.landing-header__inner`).
**Como:** aumentar `padding-block` de `var(--sp-4)` (16px) para atingir ~96px de altura.
Com a wordmark/botões atuais (~32px de conteúdo), usar `padding-block: var(--sp-6)` (32px)
≈ 96px. No mobile manter compacto: em `@media (max-width: 900px)` voltar para
`padding-block: var(--sp-4)`.
**Aceite:** header ~96px no desktop, ~64–72px no mobile.

## A3. Botões do header: "Entrar" primário, "Avise-me" secundário
**Onde:** `index.html`, `sobre.html`, `planos.html` (bloco `.landing-header__actions`).
**Como:** inverter a hierarquia e a ordem (primário no canto/direita):
```html
<div class="landing-header__actions">
  <a class="btn btn--ghost btn--sm" href="#waitlist-hero">Quero ser avisado</a>
  <a class="btn btn--primary btn--sm" href="/entrar.html">Entrar</a>
</div>
```
- "Avise-me" → **secundário com contorno fino**: usar `.btn--ghost` (já é transparente com
  `border-color: var(--border)`). Trocar o texto para "Quero ser avisado" (§8 do escopo).
- "Entrar" → **primário** (fundo escuro), posicionado por último (canto direito).
- Remover a classe/link antigo `.landing-header__login`.
- Ajustar o `href` do "Quero ser avisado" por página: `#waitlist-hero` (index),
  `/#waitlist-hero` (sobre), `#waitlist-planos` (planos).
**Aceite:** Entrar é o botão de maior destaque, no canto; "Quero ser avisado" tem só
contorno fino.

## A4. Remover sublinhado dos links do header
**Onde:** `landing.css` (`.landing-nav a`).
**Como:** garantir `text-decoration: none;` no estado normal e no `:hover`. Diferenciar o
link ativo/hover só por cor (já existe: `--text` vs `--text-muted`).
**Aceite:** nenhum link do header aparece sublinhado, inclusive no hover.

## A5. Hero full-bleed (imagem grande, com "peek" da próxima seção)
**Onde:** `index.html` (bloco `.lp-hero`) + `landing.css`.
**Decisão adotada (mudar aqui se quiser):** texto e formulário ficam **sobrepostos** à
imagem (overlay), não mais em 2 colunas lado a lado.
**Como:**
- Transformar o hero numa **seção full-width** (fora do `.landing-container`; o conteúdo
  interno é que fica num container centralizado).
- Altura: `min-height: 88vh` (não 100vh) — deixa ~12% da próxima seção visível, indicando
  que há mais conteúdo abaixo (exatamente como a referência Roofex).
- Imagem de fundo via elemento dedicado para **trocar por `<video>` depois**:
  ```html
  <section class="lp-hero-full">
    <div class="lp-hero-full__media">
      <img src="assets/img/hero.jpg"
           alt="Painel do Harmon IA com agenda, ficha de cliente e financeiro" />
      <!-- futuro: <video autoplay muted loop playsinline poster="..."> -->
    </div>
    <div class="lp-hero-full__overlay landing-container"> … texto + form … </div>
  </section>
  ```
- Overlay de legibilidade: gradiente escuro sutil sobre a mídia
  (`background: linear-gradient(...)` usando tokens/alpha) para o texto branco contrastar
  (WCAG AA). Texto do hero em branco por cima.
- Manter o formulário de waitlist (`#waitlist-hero`) como CTA primário dentro do overlay +
  link secundário "Ver planos e preços →".
- **Nota de asset:** a imagem atual é `assets/img/login-visual.png` (mockup do app). Para o
  hero full-bleed é melhor uma foto ambiente/atendimento. Se não houver ainda, usar a atual
  como placeholder e marcar `<!-- TROCAR imagem de hero -->`.
**Aceite:** hero ocupa quase toda a tela com imagem grande; sobra uma faixa da seção
seguinte visível; estrutura pronta para receber `<video>` de fundo.

## A6. Alternância de tonalidade entre seções
**Onde:** `index.html`/`planos.html`/`sobre.html` + `landing.css`.
**Como:** hoje cada seção É o `.landing-container` (largura limitada, fundo transparente).
Para faixas full-width que alternam tom, adotar o padrão **wrapper full-bleed > container**:
```html
<section class="section-band">                <!-- fundo full-width -->
  <div class="landing-container"> … </div>
</section>
<section class="section-band section-band--alt"> … </section>
```
- `.section-band { background: var(--surface); }` (branco)
- `.section-band--alt { background: var(--bg); }` (cinza claro — `--color-gray-100`)
- Alternar band/alt-band a cada seção (Features, Segmentos, "Trocar a planilha", Como
  funciona, Prova social, FAQ, CTA). Manter `padding-block` generoso (`--sp-8`).
**Aceite:** seções vizinhas têm tons de fundo diferentes (branco ↔ cinza claro), separando-as
visualmente sem linhas.

## A7. Paleta e tamanhos de texto
**Onde:** já resolvido pelos tokens (mauve/neutros em `tokens.css`, tipografia Satoshi).
**Como:** **manter** a paleta e a escala tipográfica atuais — já estão na linha de tons
suaves/neutros que você aprovou na referência. Nenhuma ação além de garantir que os novos
blocos usem os tokens existentes (`--fs-*`, `--text`, `--text-muted`).
**Aceite:** consistência de cor/tipografia com o resto do site.

## A8. Features dentro de formas (cards)
**Onde:** `landing.css` (`.feature`).
**Como:** hoje `.feature` é só um flex "flutuando". Envolver em card:
- `.feature { background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--radius-lg); padding: var(--sp-5); }`
- Hover sutil opcional: leve `box-shadow: var(--shadow-sm)` → `var(--shadow)` no hover.
- Atenção ao contraste com o fundo da band: se a seção de features for `--surface--alt`
  (cinza), o card branco se destaca bem; se a band for branca, aumentar o peso da borda
  (`--border-strong`) ou usar `--surface-2`. Escolher a band para que o card contraste.
**Aceite:** cada feature é um card com forma, borda e respiro internos — nada flutuando.

## A9. CTA final: de preto para light
**Onde:** `index.html` (`.cta-band data-theme="dark"`) + `landing.css` (`.cta-band`).
**Como:** remover `data-theme="dark"`. Reestilizar como faixa clara: fundo `--surface` ou
`--bg` (seguindo a alternância), texto `--text`/`--text-muted`, botão primário padrão.
Opcional: um leve destaque com `--accent` (mauve) só no fundo do bloco, mantendo leveza.
**Aceite:** a seção de CTA final combina com o restante (light), não destoa.

## A10. Rodapé cinza, porém menor
**Onde:** `landing.css` (`.landing-footer`, `.landing-footer__inner`).
**Como:** manter fundo cinza (aplicar `background: var(--bg)` se ainda não tiver) mas
compacto: reduzir `padding-block` de `--sp-6` para `--sp-5`; manter as 3 colunas atuais
(wordmark · links · copyright) numa linha só. Nada de "mega-rodapé".
**Aceite:** rodapé cinza claro, discreto e baixo.

---

# PARTE B — Copy & SEO
> Fonte: `improvements/ESCOPO-REFORMA-COPY.md`. Aplicar a copy **literal** de lá.
> Eixo: sair de "clínica/saúde estética" → "seu negócio de beleza e estética"; neutralizar
> gênero; ampliar público (manicure, sobrancelha, cílios, tatuagem, barbearia, etc.).

## B1. Meta tags reais nas 3 páginas (§4.2)
Substituir os placeholders de `<title>`, `<meta description>`, `og:title`, `og:description`
em `index.html`, `sobre.html`, `planos.html` pelos textos prontos do §4.2 do escopo.

## B2. Home — nova arquitetura + copy (§5)
Reescrever/adicionar seções na ordem do §5, usando a copy pronta:
1. **Hero** (§5.1): novo H1 "A gestão do seu negócio de beleza, num só lugar.", subtítulo,
   CTA "Quero ser avisado" + "Ver planos e preços →". `alt` real na imagem.
2. **⭐ Barra de segmentos** (§5.2): nova seção com chips dos ramos (roláveis no mobile).
3. **Features reescritas** (§5.3): títulos em benefício ("Agenda que nunca desencontra",
   etc.). Trocar "procedimento" → "serviço/atendimento". *(Confirmar se "fotos de antes e
   depois" existe no app; se não, remover ou marcar como roadmap.)*
4. **⭐ "Por que trocar a planilha"** (§5.4): bloco dor → solução.
5. **Como funciona** (§5.5): 3 passos reescritos.
6. **⭐ Prova social / bastidor honesto** (§5.6).
7. **⭐ FAQ curta** (§5.7): 3 perguntas ("Serve pro meu ramo?" etc.).
8. **CTA final** (§5.8): "Pronto pra tirar seu negócio da planilha?" + "Entrar na lista de
   espera →" + link discreto "Já tem convite? Entrar".

## B3. Sobre — copy (§6)
Substituir H1, subtítulo e os 3 blocos (O que é / Pra quem é / A visão) pela copy do §6.
Remover "saúde estética", "clínicas com mais de uma profissional", "cliente na cadeira" no
feminino fixo → versões neutras e ampliadas.

## B4. Planos — copy (§7)
- Título/sub do §7.
- Card **Personal**: "Para quem atende sozinho"; features do §7.
- Card **Team**: "Para estúdios, salões e clínicas com mais de uma pessoa" (não só
  "clínicas"); features do §7.
- **FAQ ampliada** (§7): incluir "Serve pro meu ramo?" e "Dá pra usar no celular?".

## B5. Microcopy dos formulários de waitlist (§8)
No `waitlist.js` (ou onde as mensagens são renderizadas), aplicar:
- Botão: **"Quero ser avisado"**
- Sucesso: **"Pronto! Você está na lista. Avisamos assim que abrir uma vaga."**
- Erro: **"Não consegui salvar seu e-mail. Confere e tenta de novo?"**

## B6. Neutralizar gênero — varredura global (§3.5, §8)
Revisar as 3 páginas + strings de JS. Trocar "pronta/avisada/aprovada/a usuária" por formas
neutras. Checar vocabulário: clínica→negócio/atendimento; saúde estética→beleza e estética;
procedimento→serviço; paciente→cliente.

## B7. SEO on-page (§4.3)
- 1 só `<h1>` por página, com a palavra-chave principal.
- `alt` real na imagem do hero.
- **FAQ Schema (JSON-LD)** na Home e em Planos.
- Nenhum link "clique aqui" — CTAs descritivos.

---

# Ordem de execução recomendada
1. **Parte B primeiro (copy/SEO)** — destrava o público e é baixo risco (texto).
   Ordem: B1 → B2 → B3 → B4 → B5 → B6 → B7.
2. **Parte A depois (visual)** — B4/B2 já criam as seções novas que a Parte A vai estilizar.
   Ordem: A4 → A2 → A1 → A3 (header) → A6 → A8 → A9 → A10 (bandas/cards/cta/rodapé) →
   **A5 por último** (hero full-bleed é a maior mudança estrutural).
3. **Verificação final:** abrir as 3 páginas no navegador (desktop + mobile ~390px);
   conferir header fixo+blur, alternância de bandas, cards de feature, hero com peek,
   contraste do texto sobre a imagem (AA), e rodar uma busca por
   `grep -ri "clínica\|saúde estética\|procedimento\|pronta\|avisada" *.html assets/js`
   para garantir que a varredura de copy não deixou resíduo.

# Decisões em aberto (confirmar antes ou durante)
- **Hero:** overlay sobre a imagem (adotado) vs. manter 2 colunas com a imagem grande ao
  lado. → adotado overlay.
- **Imagem do hero:** foto ambiente nova ou o mockup atual como placeholder? → placeholder
  por ora, marcado para troca.
- **"Fotos de antes e depois"** como feature: confirmar se o módulo suporta (§5.3).
- **Rename da marca:** fora deste escopo; a copy já é neutra ao nome (§9 do escopo).

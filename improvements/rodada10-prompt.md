# Rodada 10 — Prompt de execução (Reforma da Landing Page)

Cole o bloco abaixo no terminal (Claude Code) a partir da raiz do projeto `Harmon IA`.

---

Você vai reformar a landing page do Harmon IA (site comercial: `index.html`,
`sobre.html`, `planos.html`). Trabalhe com calma, um bloco por vez.

## Antes de começar, leia
1. `improvements/rodada10-plano-reforma-landing.md` — o plano completo (Parte A visual +
   Parte B copy/SEO), com "o quê / onde / como / critério de aceite" por item.
2. `improvements/ESCOPO-REFORMA-COPY.md` — a copy literal a aplicar (seções §4 a §8).
3. `assets/css/tokens.css`, `theme.css`, `accent.css` — o design system.

## Regras inegociáveis
- **Zero hex cru** em HTML ou CSS de componente. Toda cor/espaço/raio/sombra vem dos tokens
  (`--*`) de `tokens.css`. Se faltar um token (ex.: `--header-bg`, `--header-blur`), crie-o
  em `tokens.css` com a contraparte no tema escuro em `theme.css` — não hardcode.
- Site **light, leve e limpo**, com bastante respiro. Nada de sombras pesadas.
- Copy **neutra em gênero** e ampliada para todo profissional de beleza/estética
  (não só "clínica/saúde estética"). Siga o vocabulário do §3.5 do escopo.
- **Não** altere o `<script>` de redirect de OAuth no topo do `index.html`.
- Preserve acessibilidade: skip-link, labels, honeypot, foco visível, 1 só `<h1>` por página.

## Ordem de execução (siga exatamente)
Faça a Parte B (copy/SEO) primeiro, depois a Parte A (visual). Ao terminar cada bloco,
confira o "critério de aceite" correspondente no plano.

**Parte B — copy & SEO**
- B1 — Meta tags reais nas 3 páginas (§4.2 do escopo).
- B2 — Home: nova arquitetura + copy (§5): hero, ⭐barra de segmentos, features em
  benefício, ⭐"Por que trocar a planilha", como funciona, ⭐prova social, ⭐FAQ curta,
  CTA final. (Se "fotos de antes e depois" não existir no app, remova esse gancho.)
- B3 — Sobre: H1, sub e 3 blocos (§6).
- B4 — Planos: título, cards Personal/Team, FAQ ampliada (§7).
- B5 — Microcopy dos forms de waitlist em `assets/js/waitlist.js` (§8).
- B6 — Varredura de gênero/vocabulário nas 3 páginas + JS (§3.5/§8).
- B7 — SEO on-page: `alt` real no hero, FAQ Schema JSON-LD na Home e Planos, sem "clique aqui".

**Parte A — estrutura & visual** (edite `assets/css/landing.css`; `tokens.css` só se faltar token)
- A4 — Remover sublinhado dos links do header (`.landing-nav a`, inclusive `:hover`).
- A2 — Header ~96px no desktop (`padding-block: var(--sp-6)`; mobile mantém `--sp-4`).
- A1 — Header fixo (`position: sticky; top:0; z-index:50`) com fundo translúcido +
  `backdrop-filter: blur(...)` via tokens `--header-bg`/`--header-blur`.
- A3 — Botões do header nas 3 páginas: "Entrar" = `.btn--primary` no canto direito;
  "Quero ser avisado" = `.btn--ghost` (contorno fino). Remover `.landing-header__login`.
- A6 — Alternância de tonalidade: padrão `section-band` (branco `--surface`) ↔
  `section-band--alt` (cinza `--bg`), full-width com `.landing-container` interno.
- A8 — Features dentro de cards (`background`, `border`, `radius-lg`, `padding`), com
  contraste garantido contra a band de fundo.
- A9 — CTA final: remover `data-theme="dark"`; reestilizar como faixa clara.
- A10 — Rodapé cinza, porém menor (`padding-block: var(--sp-5)`; fundo `--bg`).
- A5 — **Por último:** hero full-bleed. Seção full-width, `min-height: 88vh` (deixa "peek"
  da próxima seção), imagem em `.lp-hero-full__media` (estrutura pronta para virar `<video>`
  depois), texto + form **sobrepostos** (overlay) com gradiente de legibilidade e texto
  branco em contraste AA. Use `assets/img/login-visual.png` como placeholder e marque
  `<!-- TROCAR imagem de hero -->`.

## Verificação final
- Abra `index.html`, `sobre.html`, `planos.html` em desktop e mobile (~390px) e confira
  todos os critérios de aceite do plano (header fixo+blur, header 96px, botões invertidos,
  sem sublinhado, bandas alternadas, cards de feature, CTA light, rodapé compacto, hero
  com peek e texto legível sobre a imagem).
- Rode e garanta que não sobrou resíduo de copy antiga:
  `grep -rin "clínica\|saúde estética\|procedimento\|pronta\|avisada\|paciente" *.html assets/js`
- Faça um commit por bloco (ou por parte), com mensagens claras.

Comece lendo os dois documentos e me diga o plano de ataque antes de editar.

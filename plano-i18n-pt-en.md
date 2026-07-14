# Plano de implementação — Toggle PT/EN no site institucional

> Spec para executar no terminal (Claude Code / Sonnet 5).
> Contexto do projeto: web app **sem build** (HTML + CSS + JS vanilla), servido via Cloudflare Workers.
> Este plano cobre **só o site institucional** (landing + páginas públicas). Não toca no app logado.

---

## 1. Objetivo e decisões

Adicionar um **toggle de idioma PT/EN** no header, traduzindo todo o site institucional de forma client-side.

Decisões já tomadas:

- **Escopo:** site institucional inteiro — `index.html`, `sobre.html`, `solucoes.html`, `planos.html`, `entrar.html` + header/footer/cookie-banner compartilhados. Páginas legais (`privacidade`, `termos`, `cookies`) ficam **fora do MVP** (texto jurídico longo; traduzir depois).
- **Abordagem:** client-side com `data-i18n` + dicionário JS + `localStorage`, **mesma URL**. Sem mudar routing nem Cloudflare.
- **Default de idioma:** na 1ª visita, detecta `navigator.language` (`pt*` → PT, senão EN). Depois disso, respeita a escolha salva.
- **PT é a fonte da verdade no HTML.** O texto em português continua escrito direto no HTML (bom pra SEO PT-BR e evita flash pra maioria). EN é aplicado por JS.

Não-objetivos (deixar explícito pra não expandir escopo):

- Sem URLs `/en/`, sem `hreflang`, sem SSR/build.
- Sem traduzir o app logado (`app.html` e telas internas).
- Sem tradução automática por API — dicionário escrito à mão.

---

## 2. Arquitetura

### Arquivos novos

```
assets/js/i18n.js            → engine (aplica traduções, toggle, persistência, detecção)
assets/js/i18n/common.js     → dicionário compartilhado (header, footer, cookie banner)
assets/js/i18n/index.js      → dicionário da home
assets/js/i18n/sobre.js      → dicionário de sobre.html
assets/js/i18n/solucoes.js   → dicionário de solucoes.html
assets/js/i18n/planos.js     → dicionário de planos.html
assets/js/i18n/entrar.js     → dicionário de entrar.html
assets/css/i18n.css          → estilo do toggle (ou anexar em landing.css)
```

> Dicionários como **ES modules** (`export default {...}`), não JSON via fetch — evita round-trip de rede e flash. O projeto já usa `<script type="module">`.

### Mecanismo (resumo)

1. Cada elemento traduzível recebe `data-i18n="chave"`; o `textContent` é trocado.
2. Atributos traduzíveis (`placeholder`, `aria-label`, `title`, `alt`) via `data-i18n-attr="placeholder:chave"` (permite múltiplos, separados por `;`).
3. `<html lang>` é atualizado (`pt-BR` / `en`).
4. Toggle no header (segmentado PT | EN) chama `setLang()`.
5. Idioma salvo em `localStorage["harmon:lang"]`.
6. `i18n.js` é genérico; cada página importa `common` + o dicionário da própria página e passa pro engine.

### Contrato do engine (`i18n.js`)

```js
// assets/js/i18n.js
const STORAGE_KEY = 'harmon:lang';
const SUPPORTED = ['pt', 'en'];

export function initI18n(dict) {
  // dict = objeto mesclado { chave: { pt, en } }
  const lang = resolveInitialLang();          // storage > navigator > 'pt'
  applyLang(lang, dict);
  wireToggle(dict);                            // liga cliques nos botões [data-lang-btn]
}

function resolveInitialLang() { /* storage → navigator.language → 'pt' */ }
function applyLang(lang, dict) {
  document.documentElement.lang = lang === 'pt' ? 'pt-BR' : 'en';
  // percorre [data-i18n] e [data-i18n-attr], troca texto/atributos
  // atualiza estado visual do toggle (aria-pressed)
  localStorage.setItem(STORAGE_KEY, lang);
}
```

> Se a chave não existir no dicionário, **manter o texto atual do HTML** (fallback pro PT já escrito). Logar `console.warn` em dev pra achar chaves faltando.

---

## 3. Convenção de marcação

Namespaces por seção, `camelCase` nas chaves:

- `common.*` → header, nav, footer, cookie banner (compartilhado entre páginas)
- `home.*`, `sobre.*`, `solucoes.*`, `planos.*`, `entrar.*` → conteúdo de cada página

Exemplo no HTML (home):

```html
<a href="/sobre.html" data-i18n="common.navAbout">Sobre</a>

<h1 class="lp-hero__title" data-i18n="home.heroTitle">
  A gestão do seu negócio de beleza, num só lugar.
</h1>

<input ... placeholder="seu@email.com"
       data-i18n-attr="placeholder:home.emailPlaceholder" />

<button type="submit" data-i18n="home.ctaNotify">Quero ser avisado</button>
```

Exemplo de dicionário:

```js
// assets/js/i18n/index.js
export default {
  'home.heroTitle':       { pt: 'A gestão do seu negócio de beleza, num só lugar.',
                            en: 'Your beauty business, all in one place.' },
  'home.heroSubtitle':    { pt: 'Agenda, clientes, estoque e caixa sem planilha...',
                            en: 'Scheduling, clients, inventory and cash flow — no spreadsheets...' },
  'home.emailPlaceholder':{ pt: 'seu@email.com', en: 'you@email.com' },
  'home.ctaNotify':       { pt: 'Quero ser avisado', en: 'Notify me' },
  // ...
};
```

---

## 4. Toggle no header

Inserir dentro de `.landing-header__actions`, antes dos botões existentes (ou entre nav e ações). Também replicar no `.landing-nav-mobile__panel`.

```html
<div class="lang-switch" role="group" aria-label="Idioma / Language">
  <button type="button" class="lang-switch__btn" data-lang-btn="pt" aria-pressed="true">PT</button>
  <button type="button" class="lang-switch__btn" data-lang-btn="en" aria-pressed="false">EN</button>
</div>
```

CSS (novo `assets/css/i18n.css` ou fim de `landing.css`), usando os tokens existentes (`--sp-*`, `--text`, `--text-muted`, radius, etc.):

```css
.lang-switch { display: inline-flex; gap: 2px; border: 1px solid var(--border);
  border-radius: var(--radius-full, 999px); padding: 2px; }
.lang-switch__btn { font: inherit; font-size: var(--fs-13, .8125rem); font-weight: var(--fw-600);
  padding: 4px 10px; border: 0; background: transparent; color: var(--text-muted);
  border-radius: 999px; cursor: pointer; min-height: 32px; }
.lang-switch__btn[aria-pressed="true"] { background: var(--surface); color: var(--text); }
.lang-switch__btn:focus-visible { outline: 2px solid var(--focus, currentColor); outline-offset: 2px; }
```

> Conferir os nomes reais dos tokens em `assets/css/tokens.css` antes de escrever o CSS — usar os que existem, não inventar. O header tem estado `.is-scrolled` e regras `:not(.is-scrolled)` na landing; garantir contraste do toggle nos dois estados (fundo transparente sobre o hero vs. header sólido).

Alvos de toque ≥ 44px no mobile (WCAG 2.2). Toggle não pode quebrar o layout do header no breakpoint mobile — testar.

---

## 5. Passo a passo (ordem de execução)

**Fase 1 — Engine e infra**
1. Criar `assets/js/i18n.js` com o contrato da seção 2.
2. Criar `assets/js/i18n/common.js` com header/nav/footer/cookie banner.
3. Criar `assets/css/i18n.css` e linká-lo nas páginas (ou anexar em `landing.css`).

**Fase 2 — Home (piloto)**
4. Anotar `index.html` com `data-i18n` / `data-i18n-attr` em todo texto visível (header, hero, seções, FAQ, CTA, footer, cookie banner) — inclui os `aria-label`, `alt` e `placeholder`.
5. Criar `assets/js/i18n/index.js` com todas as chaves da home.
6. Adicionar o toggle no header (desktop + painel mobile).
7. Bootstrap no fim do `index.html`:
   ```html
   <script type="module">
     import common from '/assets/js/i18n/common.js';
     import page from '/assets/js/i18n/index.js';
     import { initI18n } from '/assets/js/i18n.js';
     initI18n({ ...common, ...page });
   </script>
   ```
8. Testar a home ponta a ponta antes de replicar (ver seção 7).

**Fase 3 — Demais páginas**
9. Repetir passos 4–7 para `sobre.html`, `solucoes.html`, `planos.html`, `entrar.html`, cada uma com seu dicionário e reusando `common`.
10. Garantir que o toggle e o `common` ficam idênticos em todas (copiar o mesmo bloco de header).

**Fase 4 — Metadados (opcional, dentro do escopo)**
11. Ao trocar pra EN, atualizar `document.title` e `meta[name=description]` via chaves `*.metaTitle` / `*.metaDescription`. `og:*` pode ficar em PT (não muda por JS pra crawlers de qualquer forma).

---

## 6. Detecção, persistência e anti-flash

- **1ª visita:** `navigator.language.startsWith('pt') ? 'pt' : 'en'`.
- **Retorno:** ler `localStorage["harmon:lang"]`; se válido, usa; senão detecta.
- **Anti-flash pra usuário EN:** como o HTML nasce em PT, quem prefere EN veria um flash. Mitigar com um script inline mínimo **no `<head>`** que seta `document.documentElement.lang` cedo e adiciona uma classe `.i18n-en` — o swap de texto acontece quando o módulo roda (rápido, DOM já parseado). Flash residual é aceitável pro MVP; não bloquear render escondendo o `<body>`.
- Persistência **não** depende de consentimento de cookie (é `localStorage` funcional/essencial de preferência) — mas confirmar com a política de cookies do projeto; se necessário, tratar como essencial.

---

## 7. Verificação (fazer antes de dar como pronto)

1. **Toggle funciona** nas duas direções em cada página; estado `aria-pressed` correto.
2. **Persistência:** escolher EN, recarregar → continua EN. Trocar de página → mantém EN.
3. **Detecção:** limpar `localStorage`, navegador em `en-US` → abre em EN; em `pt-BR` → abre em PT.
4. **`<html lang>`** muda de fato (inspecionar).
5. **Chaves faltando:** varrer o console por `warn` de chave ausente; nenhuma pendente.
6. **Sem texto órfão:** buscar no HTML por texto visível sem `data-i18n` e revisar.
7. **Layout:** header não quebra em mobile (≤ 640px) com o toggle; alvos ≥ 44px.
8. **Acessibilidade:** foco visível no toggle; contraste do toggle sobre o hero (header transparente) e no header sólido.
9. **Regressão:** waitlist, cookie banner, nav mobile e login continuam funcionando (o toggle não pode interferir nos outros `type="module"`).

---

## 8. Checklist de arquivos tocados

Novos:
- `assets/js/i18n.js`
- `assets/js/i18n/common.js`, `index.js`, `sobre.js`, `solucoes.js`, `planos.js`, `entrar.js`
- `assets/css/i18n.css`

Editados (marcação `data-i18n` + toggle + bootstrap + link do CSS):
- `index.html`, `sobre.html`, `solucoes.html`, `planos.html`, `entrar.html`

Fora do MVP (fase futura): `privacidade.html`, `termos.html`, `cookies.html`, app logado, URLs `/en/`.

---

## 9. Prompt sugerido pra abrir no terminal

> Implemente o toggle de idioma PT/EN seguindo `plano-i18n-pt-en.md`. Comece pela Fase 1 e 2 (engine + home como piloto), pare e me mostre a home funcionando antes de replicar pras outras páginas. Siga a filosofia sem build do projeto (HTML/CSS/JS vanilla, ES modules), reuse os tokens de CSS existentes e não invente nomes de token — confira em `assets/css/tokens.css`. PT é a fonte da verdade no HTML; EN é aplicado por JS.

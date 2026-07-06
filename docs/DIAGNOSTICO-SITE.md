# Diagnóstico de infraestrutura web & SEO — Harmon IA

_Rodado em 04/07/2026 · deploy analisado: `harmon-ia-rouge.vercel.app` · desktop 1440px + mobile 390px + código-fonte_

---

## Resumo em uma frase

O site tem **boa base** (HTML semântico, dados estruturados FAQ, headers de segurança iniciais, tema claro/escuro, acessibilidade pensada), mas **faltam as peças que separam um projeto de um produto no ar**: páginas legais/LGPD, banner de cookies, página de erro própria, arquivos de SEO técnico (robots, sitemap), favicon/identidade no navegador, e um endurecimento de segurança. Além disso há **1 bug visível** e **1 problema de deploy** que valem atenção imediata.

---

## 0. Achados que precisam de atenção AGORA

| # | Achado | Impacto |
|---|--------|---------|
| **A** | **Formulário de espera do hero não aparece** na home. O `<input>` de e-mail e o botão "Quero ser avisado" existem no DOM, mas ficam invisíveis no carregamento (a animação `data-reveal` não revela subtítulo nem o formulário — só o `<h1>`). O CTA principal de conversão está oculto. | **Alto** — a página existe para capturar e-mails e o campo some. |
| **B** | **Dois deploys ativos e confusos.** `harmon-ia.vercel.app` serve **outro projeto** (um clone de Spotify — "Welcome back / Newest songs"). O Harmon IA real está em `harmon-ia-rouge.vercel.app`. | **Alto** — link errado divulgado = usuária cai num site aleatório; e o domínio "limpo" está queimado. |
| **C** | **404 genérica da Vercel** ("404: NOT_FOUND", em inglês, com link pra documentação da Vercel). | **Médio-alto** — quebra total de marca no primeiro erro. |

---

## 1. O que já temos (e está bom)

- HTML semântico com `<header>/<main>/<footer>`, `lang="pt-BR"`, `skip-link` ("Pular para o conteúdo"), `aria-label` na navegação, `sr-only` para headings de leitor de tela.
- `<meta name="description">` e Open Graph (`og:title`, `og:description`, `og:image`) na home.
- **Dados estruturados** JSON-LD (`FAQPage`) — bom para rich snippets no Google.
- `color-scheme: light dark` + `viewport-fit=cover` (respeita notch/tema do sistema).
- Headers de segurança iniciais no `vercel.json`: `X-Content-Type-Options: nosniff` e `Referrer-Policy`.
- Imagens do hero em `.webp` com `fetchpriority="high"`; imagens de conteúdo com `loading="lazy"` + `width/height` (evita layout shift).
- Honeypot anti-spam no formulário de waitlist (campo `company` escondido).
- Multi-tenant com RLS no Supabase e princípio "espelho" bem documentado.

---

## 2. Crítico — Conformidade legal & privacidade (LGPD)

O produto coleta e-mail na landing e, no app, guarda **dados de clientes e histórico de atendimentos de saúde estética** — dado pessoal, parte sensível. Hoje **não existe nada disso**:

- **Falta Política de Privacidade** (`/privacidade.html`). Obrigatória pela LGPD e exigida pelo próprio Google para apps que usam OAuth/Calendar/Contatos/Drive — sem ela, o app corre risco na verificação do Google OAuth.
- **Falta Termos de Uso** (`/termos.html`).
- **Falta banner de consentimento de cookies.** Mesmo com pouca coisa hoje, o login Google/Supabase grava tokens; ao adicionar analytics vira obrigatório. Não há nenhum mecanismo de consentimento nem página `/cookies.html`.
- **Falta indicação de controlador/DPO e canal de contato** para titulares exercerem direitos (acesso, exclusão de dados).
- Rodapé ainda tem placeholder `<!-- TROCAR nome -->` antes do "© 2026 Harmon IA".

> Nenhum link para páginas legais existe no rodapé. Para um SaaS de saúde/estética, isso é o gap mais sério da lista.

---

## 3. Crítico — SEO técnico

Arquivos ausentes na raiz (todos retornam 404 hoje):

- **`robots.txt`** — nenhum. O Google não tem instrução de rastreio nem ponteiro para o sitemap.
- **`sitemap.xml`** — nenhum. As 5 páginas públicas (`/`, `/sobre`, `/solucoes`, `/planos`, `/entrar`) não são anunciadas.
- **`<link rel="canonical">`** — ausente em todas as páginas. Risco de conteúdo duplicado (ex.: `/` vs `/index.html`, com/sem `www`, os dois domínios Vercel).

Meta tags que faltam:

- **`og:url`** e **`og:type`**, **`og:site_name`**, **`og:locale`** (`pt_BR`).
- **Twitter Cards** (`twitter:card`, `twitter:title`, `twitter:image`) — links no X/Twitter saem sem preview rico.
- **`<meta name="description">` só existe na home.** `sobre`, `solucoes`, `planos`, `entrar` estão sem description e sem OG próprios.
- `og:image` aponta para `login-visual.png` (692 KB) — ideal é uma imagem social 1200×630 dedicada e leve.

---

## 4. Crítico — Identidade no navegador (favicon & PWA)

- **Sem favicon.** Nenhum `favicon.ico`, `apple-touch-icon`, `<link rel="icon">` — a aba do navegador e os favoritos aparecem sem ícone. Sinal imediato de "site não terminado".
- **Sem `theme-color`** (barra do navegador mobile fica na cor padrão).
- **Sem Web App Manifest** (`site.webmanifest`). O produto se vende como "web, abre em qualquer navegador, sem instalar" — um manifest com `display: standalone` + ícones permitiria **"Adicionar à tela inicial"** (PWA), reforçando exatamente esse discurso. Hoje isso não existe.

---

## 5. Importante — Endurecimento de segurança

O `vercel.json` tem 2 headers. Para um app que lida com dados de saúde, recomenda-se completar:

- **`Content-Security-Policy`** — hoje ausente. Principal defesa contra XSS. Precisa liberar Supabase, Google e os CDNs usados.
- **`Strict-Transport-Security`** (HSTS) — força HTTPS.
- **`X-Frame-Options: DENY`** ou `frame-ancestors 'none'` — evita clickjacking (importante numa tela de login).
- **`Permissions-Policy`** — desligar câmera/microfone/geolocalização que o site não usa.
- Revisar: `credenciais/` versionada no repositório e `hero-banner.png` de **9,7 MB** commitado (não é servido — não está referenciado em lugar nenhum —, mas incha o repo; pode sair do Git).

---

## 6. Importante — Performance

- **Hero PNG de 9,7 MB** (`hero-banner.png`) está no repo mas **não é referenciado** (o site usa `hero-banner-bw.webp`, 11 KB). Remover do Git.
- Sem `<link rel="preconnect">`/`dns-prefetch` para Supabase e Google — economiza handshake no primeiro request de auth.
- 6 arquivos CSS carregados separadamente (`tokens, layout, components, theme, landing, motion`). Ok para "no-build", mas em produção vale medir; se virar gargalo, dá pra concatenar.
- Sem estratégia de cache explícita (`Cache-Control`) para os assets estáticos — a Vercel já cacheia bem por padrão, mas vale confirmar hashing/imutabilidade.
- Rodar um **Lighthouse** oficial para ter números de LCP/CLS reais (recomendo como passo de verificação).

---

## 7. Bom ter — Acessibilidade & UX

- Rodar auditoria WCAG 2.2 AA formal (há skill `boas-praticas-design` e `accessibility-review` disponíveis). Pontos a checar: contraste do texto cinza sobre o hero escuro (o subtítulo parece bem apagado), foco visível em teclado, tamanho de alvo de toque nos chips.
- Página de erro própria também para **500** (falha de servidor).
- Estados de `loading`/erro dos formulários (feedback de envio da waitlist).
- Verificar o menu mobile (`<details>`) com leitor de tela.

---

## 8. Plano priorizado — "até onde podemos ir"

**Fase 1 — Destravar o profissional (rápido, alto impacto)**
1. Corrigir o formulário do hero invisível (bug A).
2. Resolver o deploy duplicado / domínio (bug B) — idealmente um **domínio próprio** (`harmonia.app` ou similar).
3. Criar **404 e 500 próprios**, com a marca.
4. Adicionar **favicon completo** + `theme-color`.
5. `robots.txt` + `sitemap.xml` + `canonical` em todas as páginas.

**Fase 2 — Legal & confiança (obrigatório antes de escalar)**
6. **Política de Privacidade**, **Termos de Uso**, **Política de Cookies** + links no rodapé (troca do placeholder de nome).
7. **Banner de consentimento de cookies** (leve, vanilla, sem lib pesada).
8. Completar meta description/OG/Twitter nas 4 páginas internas + imagem social dedicada.

**Fase 3 — Endurecer & acelerar**
9. CSP + HSTS + X-Frame-Options + Permissions-Policy no `vercel.json`.
10. Web App Manifest (PWA "adicionar à tela inicial").
11. Limpeza do repo (PNG de 9,7 MB, `credenciais/`), preconnect, Lighthouse.

**Fase 4 — Polir**
12. Auditoria WCAG AA formal + ajustes de contraste/foco.
13. Analytics com consentimento (ex.: Vercel Analytics / Plausible, privacy-first).

---

_Nada aqui exige mudar a arquitetura "no-build". Tudo é adição de arquivos estáticos, meta tags e headers — coerente com HTML/CSS/JS vanilla + Vercel._

# Plano — Deixar o site profissional (SEO, legal, segurança, PWA)

_Base: `docs/DIAGNOSTICO-SITE.md` (04/07/2026). Arquitetura mantida: HTML/CSS/JS vanilla, sem build, Vercel. Nenhuma tarefa muda a arquitetura — só adiciona arquivos estáticos, meta tags e headers._

**Deploy real:** `harmon-ia-rouge.vercel.app` · **Repo:** `github.com/otavioenrico/harmon-ia`

## Como executar
Trabalhar **uma fase por vez, na ordem**. Ao fim de cada fase: rodar os testes de aceite da fase, fazer `git add -A && git commit` com mensagem clara, e **parar para reportar** (não emendar na próxima sem sinal verde). Não commitar segredos. Manter tudo em PT-BR.

---

## FASE 1 — Destravar o "profissional" (rápido, alto impacto)

### 1.1 Bug: formulário do hero invisível
- **Sintoma:** na home, só o `<h1>` aparece; subtítulo e o form de waitlist (`#waitlist-hero`, input de e-mail + botão) ficam com `opacity:0` porque o `data-reveal` não revela.
- **Investigar:** `assets/js/landing.js` (IntersectionObserver do `data-reveal`) e `assets/css/motion.css` (estado inicial/animação). Provável causa: elementos já dentro do viewport no load não disparam o observer, ou o `.is-revealed` não é aplicado ao subtítulo/actions.
- **Correção esperada:** garantir que elementos `data-reveal` já visíveis no primeiro paint sejam revelados imediatamente; e/ou fallback: se JS falhar ou `prefers-reduced-motion`, conteúdo **sempre visível** (nunca depender de JS para exibir o CTA principal).
- **Aceite:** com JS ligado e desligado, o campo de e-mail e o botão do hero aparecem acima da dobra em desktop e mobile.

### 1.2 Deploy duplicado / domínio
- **Fato:** `harmon-ia.vercel.app` serve OUTRO projeto (clone de Spotify). O real é `harmon-ia-rouge.vercel.app`.
- **Ação (manual do Otávio no painel Vercel — o agente só documenta):** decidir domínio final. Opções: (a) renomear/assumir o projeto para liberar `harmon-ia.vercel.app`, ou (b) registrar **domínio próprio** (ex.: `harmonia.app`) e apontar na Vercel. Atualizar Redirect URLs no Supabase e no Google Cloud OAuth quando o domínio mudar.
- **Aceite:** um único domínio canônico definido e anotado no topo deste plano + no SETUP.md.

### 1.3 Páginas de erro próprias (404 e 500)
- Criar `404.html` e `500.html` na raiz, com header/footer e CSS da marca (reusar classes do `landing.css`). Copy PT-BR, botão "Voltar ao início".
- Vercel serve `404.html` automaticamente para rotas estáticas inexistentes; confirmar comportamento e, se preciso, ajustar `vercel.json`.
- **Aceite:** acessar `/rota-inexistente` mostra a 404 da marca, em PT-BR, sem menção à Vercel.

### 1.4 Favicon + theme-color
- Gerar conjunto: `favicon.ico`, `favicon.svg`, `apple-touch-icon.png` (180×180), ícones 192/512 (reaproveitados no manifest da Fase 3).
- Adicionar no `<head>` de TODAS as páginas: `<link rel="icon">`, `apple-touch-icon`, `<meta name="theme-color">` (cor da marca, com media light/dark).
- **Aceite:** aba do navegador e favoritos mostram o ícone; barra mobile pega a cor da marca.

### 1.5 SEO técnico base
- Criar `robots.txt` (permitir tudo em produção, apontar sitemap; bloquear `/app.html` e `/entrar.html` do index se desejado).
- Criar `sitemap.xml` com as páginas públicas: `/`, `/sobre.html`, `/solucoes.html`, `/planos.html`.
- Adicionar `<link rel="canonical">` em cada página com a URL final do domínio escolhido.
- **Aceite:** `/robots.txt` e `/sitemap.xml` retornam 200; canonical presente em todas as páginas.

---

## FASE 2 — Legal & confiança (obrigatório antes de escalar / exigido pelo Google OAuth)

### 2.1 Páginas legais
- `privacidade.html` — Política de Privacidade LGPD: dados coletados (e-mail na waitlist; no app: clientes, agendamentos, financeiro, tokens Google), finalidade, base legal, compartilhamento (Supabase, Google), direitos do titular, retenção/exclusão, contato do controlador. **Menção explícita ao uso das APIs Google (Calendar, Contatos, Drive)** — requisito do Google OAuth.
- `termos.html` — Termos de Uso.
- `cookies.html` — Política de Cookies (o que grava: sessão Supabase/Google; futuros: analytics).
- Reusar layout landing (header/footer/CSS). Preencher razão social/CNPJ/contato — **placeholders marcados `[PREENCHER]`** para o Otávio completar.

### 2.2 Rodapé + placeholder
- Adicionar links de Privacidade / Termos / Cookies no rodapé de todas as páginas.
- Trocar o placeholder `<!-- TROCAR nome -->` pelo nome/razão social final.

### 2.3 Banner de consentimento de cookies
- Banner leve vanilla (sem lib), com "Aceitar" / "Rejeitar não-essenciais" / link para política. Guardar escolha em `localStorage`. Bloquear analytics até consentimento (preparar gancho para Fase 4).
- **Aceite:** banner aparece na 1ª visita, respeita a escolha, não reaparece após decidir.

### 2.4 Meta tags nas páginas internas
- Adicionar `<meta name="description">` própria + Open Graph + Twitter Cards em `sobre`, `solucoes`, `planos`, `entrar`.
- Na home, completar `og:url`, `og:type`, `og:site_name`, `og:locale=pt_BR`, `twitter:card`.
- Criar imagem social dedicada 1200×630 (leve) e apontar `og:image`/`twitter:image`.
- **Aceite:** validar preview em card (facebook debugger / metatags.io) sem erros.

---

## FASE 3 — Endurecer segurança & PWA

### 3.1 Headers de segurança (`vercel.json`)
- Adicionar: `Content-Security-Policy` (liberar Supabase, Google APIs, CDNs realmente usados — mapear antes), `Strict-Transport-Security`, `X-Frame-Options: DENY` (ou `frame-ancestors 'none'` no CSP), `Permissions-Policy` (desligar camera/microphone/geolocation).
- **Cuidado:** CSP mal configurado quebra o login Google/Supabase. Testar login em preview antes de produção.
- **Aceite:** login Google funciona; scan em securityheaders.com melhora a nota; sem erros de CSP no console.

### 3.2 Web App Manifest (PWA)
- `site.webmanifest`: nome, short_name, `display: standalone`, `theme_color`, `background_color`, ícones 192/512. Linkar no `<head>`.
- **Aceite:** Chrome oferece "Adicionar à tela inicial"; Lighthouse PWA sem erros básicos.

### 3.3 Limpeza & performance
- Remover do Git o `assets/img/hero-banner.png` (9,7 MB, não referenciado). Confirmar que `credenciais/` está no `.gitignore` e sem segredo versionado.
- Adicionar `<link rel="preconnect">` para Supabase e Google.
- **Aceite:** repo mais leve; sem segredo no histórico atual; login segue ok.

---

## FASE 4 — Polir

### 4.1 Acessibilidade WCAG 2.2 AA
- Auditar contraste (subtítulo cinza sobre hero escuro), foco visível no teclado, alvo de toque dos chips, menu mobile `<details>` com leitor de tela. Corrigir o que reprovar.

### 4.2 Analytics privacy-first (opcional)
- Vercel Analytics ou Plausible, disparando só após consentimento (gancho da Fase 2.3).

### 4.3 Verificação final
- Rodar Lighthouse (Performance, SEO, Best Practices, Accessibility, PWA) nas 5 páginas. Anotar scores. Meta: ≥ 90 em SEO e Best Practices.

---

## Registro de progresso
_(o agente do terminal atualiza aqui ao fim de cada fase; Otávio cola no chat para acompanhamento)_

- [ ] Fase 1 — commit: `______`
- [ ] Fase 2 — commit: `______`
- [ ] Fase 3 — commit: `______`
- [ ] Fase 4 — commit: `______`

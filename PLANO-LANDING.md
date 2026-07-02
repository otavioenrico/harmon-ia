# PLANO — Landing page comercial (Etapa 7)

> Spec de execução. O executor (Sonnet) deve **seguir este arquivo sem improvisar**:
> cada arquivo, seção, token e edição de rota já estão decididos aqui. Dúvida de
> escopo → parar e perguntar, não inventar.

---

## 1. Objetivo

Criar o **site comercial** que vende o app e leva o visitante ao login. Hoje o
`index.html` É a tela de login; ele vira a **home pública**. O produto continua
sendo o mesmo app (`app.html`) atrás do login Google.

Três páginas, PT-BR, sem build (HTML + CSS + JS vanilla), deploy Vercel — mesma
stack e mesmo design system do app.

O site sai em **modo pré-lançamento**: comunica "em desenvolvimento / em breve",
**bloqueia cadastro público** e captura e-mail em uma **lista de espera** (§2.5).

**Escopo desta etapa:** site + remanejo de rotas + modo pré-lançamento (waitlist e
bloqueio de cadastro). **Fora de escopo:** novo nome/marca (vem depois — ver §8),
preços reais (placeholders — §5.3) e integração de pagamento.

---

## 2. Decisões fechadas (respeitar)

- **Rotas:** landing na raiz, login separado. `index.html` = home; login migra
  para `entrar.html`; app segue em `app.html`. Detalhe em §3.
- **Páginas:** exatamente três — **Início** (`index.html`), **Sobre**
  (`sobre.html`), **Planos** (`planos.html`). Nada além disso.
- **Idioma:** só PT-BR.
- **Preços:** placeholders marcados `<!-- TROCAR -->`. Não inventar valor "de
  verdade" nem esconder que é placeholder.
- **Design:** referência de hierarquia/estética = elevenlabs.io, **mesclada com o
  design system atual** (Satoshi, paleta mauve, tema claro/escuro, raio/sombra
  dos tokens). Reusar `assets/css/`, não recriar. Detalhe em §4.
- **Nome atual "Harmon IA":** mantido como **placeholder**, mas centralizado para
  troca trivial depois (§8).

---

## 2.5 Modo pré-lançamento (waitlist + bloqueio de cadastro)

Enquanto o produto não abre ao público, o site tem postura "em breve": comunica
desenvolvimento, coleta e-mails interessados e impede que estranhos criem conta.

### 2.5.1 Comunicação "em breve"
- **Badge no header** (ao lado do wordmark): pill discreta `Em breve` /
  `Em desenvolvimento` usando `.badge`/pill já existente em `components.css`.
- **Hero da Início** deixa claro que o lançamento está próximo; CTA primário é a
  **lista de espera**, não "Entrar" (ver §5.1).

### 2.5.2 Captura de e-mail (lista de espera)
- **Formulário simples:** um campo e-mail + botão "Avise-me". Aparece no hero da
  **Início** e repetido no rodapé da **Planos** (após os cards).
- **Onde grava:** nova tabela Supabase **`waitlist`** (id, email, created_at,
  source). RLS com **INSERT liberado para `anon`** e **SELECT negado** (ninguém lê
  a lista pelo client). Índice único em `email` (idempotente; reenvio não duplica
  — usar `upsert`/`on conflict do nothing`).
- **Client:** um módulo enxuto `assets/js/waitlist.js` que valida e-mail, insere
  via `supabase.from('waitlist').upsert(...)`, e usa o **`toast`** existente
  (`utils.js`) para sucesso/erro. Incluir **honeypot** (campo oculto anti-bot) e
  desabilitar o botão durante o envio.
- **Sucesso:** troca o form por "Pronto! Avisamos você quando abrir." (estado
  inline, sem recarregar).

### 2.5.3 Bloqueio de cadastro
O app usa Google OAuth (qualquer conta Google logaria e ganharia `user_settings`).
Para bloquear o público sem travar o dono, **recomendado**: gate por allowlist.
- Tabela **`allowlist`** (email text PK) com os e-mails aprovados (por ora, o(s)
  do dono). RLS: SELECT só do próprio e-mail autenticado.
- Em `entrar.html`/`auth.js`, após a sessão chegar: checar se
  `session.user.email` está na `allowlist`. **Se não estiver** → `signOut()` +
  toast "Estamos em desenvolvimento — entre na lista de espera." e voltar pra `/`.
  **Se estiver** → segue pro `app.html` normal.
- Alternativa mais simples (se preferir zero tabela agora): allowlist **hardcoded**
  num array em `auth.js`. Menos flexível, mas trivial. → **decisão do dono; default
  do plano = tabela `allowlist`.**
- A tela de login: o form e-mail/senha e "Criar conta" já são só visuais ("Em
  breve"); manter, mas o "Criar conta" pode redirecionar para a lista de espera.

> Assim: público vê "em breve" + deixa e-mail; só e-mails aprovados entram no app.

---

## 3. Arquitetura de rotas — a parte crítica (não quebrar o auth)

O fluxo de login atual está espalhado em 4 pontos. Mapa do que existe e o que muda:

### 3.1 Estado atual (ler antes de mexer)
- `index.html` — login. No fim do `<script>`, um `onAuthStateChange` detecta
  sessão → `location.replace('/app.html')`. É aqui que a volta do OAuth é
  processada (`ensureSettings` salva o refresh_token na 1ª vez).
- `assets/js/auth.js`:
  - `signInWithGoogle()` → `redirectTo: ${location.origin}/` (hoje cai no login).
  - `requireSession()` → sem sessão faz `location.replace('/index.html')`.
  - `signOut()` → `location.replace('/index.html')`.
- `vercel.json` → rewrite `/auth/callback` → `/index.html`.

### 3.2 Mudanças (fazer exatamente isto)
1. **Renomear** o `index.html` atual para **`entrar.html`** (a tela de login
   inteira, incluindo o `<script>` de `onAuthStateChange`). Nada do conteúdo de
   login muda — só o nome do arquivo.
2. **Criar novo `index.html`** = home (Início). Ver §5.1.
3. **`assets/js/auth.js`** — trocar os alvos de redirect:
   - `signInWithGoogle`: `redirectTo` passa a apontar para a página de login,
     `${location.origin}/entrar.html`, para a volta do OAuth cair onde o
     `onAuthStateChange` roda.
   - `requireSession()`: `location.replace('/index.html')` → `'/entrar.html'`.
   - `signOut()`: `location.replace('/index.html')` → `'/'` (volta pra home
     pública; comportamento mais natural pós-logout).
4. **`vercel.json`** — rewrite `/auth/callback` destino `/index.html` → `/entrar.html`.
5. **Conferir referências residuais:** `grep -rn "index.html" assets/ *.html` e
   corrigir qualquer link que assumisse index=login (ex.: botões "voltar ao login").
6. **Gate de allowlist (§2.5.3):** no `onAuthStateChange` de `entrar.html` (e/ou
   em `requireSession`), antes de mandar pro `app.html`, checar se o e-mail está
   na allowlist. Fora dela → `signOut()` + toast + volta pra `/`.

### 3.3 Teste de fumaça obrigatório do auth (após o remanejo)
- Abrir `/` → aparece a **home**, não o login.
- Clicar "Entrar" no header → vai pra `/entrar.html`.
- Login Google → volta e cai no `app.html` logado (refresh_token intacto).
- Dentro do app, logout → volta pra `/` (home).
- Acessar `/app.html` deslogado → redireciona pra `/entrar.html`.

> ⚠️ Sem esse teste passando, o resto da etapa não fecha. O maior risco da etapa
> inteira é aqui, não no visual.

---

## 4. Direção de design (elevenlabs × Harmon)

O que copiar da **hierarquia da elevenlabs.io**, aplicado à nossa paleta:
- **Hero de alto contraste** e tipografia grande, respiro generoso, pouca coisa
  na primeira dobra: título forte + subtítulo curto + 1 CTA primário + 1
  secundário + um visual de produto emoldurado (screenshot do app em card com
  `--radius-xl` e `--shadow`).
- **Seções alternadas** claro/escuro para ritmo (usar `data-theme="dark"` numa
  faixa e claro noutra — os tokens já suportam).
- **Blocos de feature** curtos, alinhados a grid, com muito espaço em branco.
- **Sem poluição:** nada de gradiente carnavalesco. Destaque só no mauve/accent
  já existente. Sofisticação = contraste + espaço, não cor.

### 4.1 Reuso obrigatório (economia de token e consistência)
- **NÃO** criar tokens novos de cor/tipo/espaço. Usar `assets/css/tokens.css`,
  `theme.css`, `accent.css` como estão. Fonte = **Satoshi** (já embarcada).
- Criar **um único CSS novo**: `assets/css/landing.css`, só com **layout da
  landing** (hero, grid de features, faixas, cards de plano, footer do site),
  referenciando as custom properties existentes (`--bg`, `--surface`, `--text`,
  `--accent`, `--radius-*`, `--sp-*`, `--shadow`, etc.). Zero hex cru.
- Reaproveitar `assets/img/login-visual.png` (gradiente metálico) como elemento
  estético do hero/faixas se ajudar — já existe, não gerar imagem nova.
- Botões: reusar as classes `.btn`, `.btn--primary` já definidas em
  `components.css`. Não estilizar botão do zero.

### 4.2 Antes de codar o visual
Rodar a skill **`boas-praticas-design`** no modo GERAR SPECS para fechar grid,
escala tipográfica do hero e anatomia dos cards de plano — depois seguir a spec.
(Baseline WCAG 2.2 AA, sistema 8px, que já é o do projeto.)

---

## 5. Estrutura das páginas

Todas compartilham **header** e **footer** idênticos (§6). Conteúdo é copy
placeholder claramente marcado `<!-- TROCAR -->` onde for texto de marketing real
a ser escrito depois.

### 5.1 `index.html` — Início
1. **Header** (§6).
2. **Hero:** título (proposta de valor em 1 frase), subtítulo (1–2 linhas),
   badge "Em breve", **CTA primário = lista de espera** (form e-mail "Avise-me",
   §2.5.2) + link secundário "Ver planos" (→ `planos.html`). "Entrar" fica como
   link discreto no header (para contas aprovadas), não como CTA do hero. Visual
   do app emoldurado ao lado.
3. **Prova de valor / o que é:** 3–4 blocos de feature (ex.: Agenda + Google
   Calendar, Clientes/Histórico, Estoque, Financeiro — refletindo os módulos
   reais do app). Ícones simples inline (SVG), 1 linha de copy cada.
4. **Faixa "como funciona":** 3 passos curtos.
5. **CTA final:** faixa escura com "Comece agora" → `entrar.html`.
6. **Footer** (§6).

### 5.2 `sobre.html` — Sobre
Header + hero curto ("Sobre") + 2–3 blocos de texto (o que é o produto, pra quem
é — profissional de saúde estética, a visão). Copy placeholder. Footer.

### 5.3 `planos.html` — Planos
Header + título + **2 cards de plano** lado a lado:
- **Personal** — para profissionais autônomos.
- **Team** — para clínicas (múltiplos profissionais).

Cada card com:
- nome, subtítulo do público (autônomo / clínica), preço `R$ --/mês
  <!-- TROCAR -->`, lista de features (placeholder), **CTA = "Entrar na lista de
  espera"** (pré-lançamento; abre/rola para o form de e-mail, §2.5.2) — **não**
  "Assinar" ainda.
- Destacar o card **Team** (borda accent + selo "Recomendado"), opcional.

Abaixo, o **form da lista de espera** repetido + um bloco de **FAQ** curto (4–5
perguntas placeholder, incluindo "Quando lança?") e footer.

> Preços e features são placeholders. Marcar cada um com `<!-- TROCAR -->` e não
> embutir lógica de pagamento nesta etapa.

---

## 6. Componentes compartilhados

Como é sem build (sem includes de servidor), o header e o footer serão **HTML
repetido nas 3 páginas**, idênticos. Para manter sincronizado:
- **Header:** wordmark à esquerda + pill "Em breve" (§2.5.1), nav central
  (Início / Sobre / Planos), à direita **CTA primário "Avise-me"** (lista de
  espera) e "Entrar" como **link discreto** (→ `entrar.html`, para contas
  aprovadas). Marcar link ativo com `aria-current="page"`. Responsivo:
  ≤900px vira menu compacto (pode ser um `<details>`/disclosure simples, sem JS
  pesado; seguir padrão de a11y do projeto).
- **Footer:** wordmark, links das 3 páginas + "Entrar", linha legal placeholder
  (`© 2026 <!-- TROCAR nome --> · Todos os direitos reservados`).
- Colar **o mesmo bloco** nas 3 páginas; ao editar, editar nas 3. (Opcional, se
  quiser DRY sem framework: um `assets/js/site.js` mínimo que injeta header/footer
  por `innerHTML` num `<header data-site-header>` — decisão do executor, mas se
  usar, garantir que funciona sem flash e sem quebrar a11y. Default = HTML
  repetido, mais simples.)

---

## 7. Arquivos — criar / editar / renomear

**Renomear**
- `index.html` → `entrar.html` (login, sem mudar conteúdo interno).

**Criar**
- `index.html` (novo — Início)
- `sobre.html`
- `planos.html`
- `assets/css/landing.css`
- `assets/js/waitlist.js` — captura de e-mail da lista de espera (§2.5.2).
- Migration SQL para `waitlist` + `allowlist` (RLS conforme §2.5). Anexar ao
  `db/schema.sql` (nova seção) **e** deixar um `.sql` avulso aplicável no Supabase.
- (opcional) `assets/js/site.js` — só se optar por injetar header/footer.

**Editar**
- `assets/js/auth.js` — 3 redirects (§3.2) + gate de allowlist (§2.5.3 / §3.2.6).
- `entrar.html` — gate no `onAuthStateChange`; "Criar conta" → lista de espera.
- `vercel.json` — destino do rewrite (§3.2).
- Qualquer link residual `index.html`→login (§3.2 passo 5).

**Não tocar**
- `app.html` e os módulos `assets/js/*.js` do app, `db/`, `api/`,
  `tokens.css`/`theme.css`/`accent.css`/`components.css`/`layout.css`
  (só **consumir** os tokens; se precisar de ajuste de layout, é em `landing.css`).

---

## 8. Placeholder de marca (caminho de rename futuro)

O nome vai mudar. Para o rename futuro ser um find-replace de 1 minuto:
- Usar **sempre a mesma marcação** do wordmark em todo lugar:
  `<span class="wordmark">Harmon&nbsp;<b>IA</b></span>` (mesmo padrão do app).
- No fim do PLANO/HISTORICO, **listar todos os arquivos e linhas** onde o nome
  aparece (title tags, header, footer, hero, og:tags), para o rename ser guiado.
- **Não** espalhar o nome em copy solta; onde for texto de marketing, deixar
  `<!-- TROCAR nome -->`.
- Adicionar `<meta>` de SEO placeholder (title, description, og:title,
  og:description, og:image) em cada página — preencher de verdade junto do rename.

---

## 9. Ordem de execução (uma coisa por vez, mostrar cada passo)

1. **Rotas/auth + gate primeiro** (§3, §2.5.3): renomear login → `entrar.html`,
   ajustar `auth.js` + `vercel.json`, aplicar a migration `waitlist`/`allowlist`,
   implementar o gate de allowlist, **rodar o teste de fumaça §3.3**. Só avança
   com auth verde e cadastro público bloqueado.
2. `assets/js/waitlist.js` + `assets/css/landing.css` (base + header/footer).
3. `index.html` (Início) completo, com badge "Em breve" e form de lista de espera.
4. `planos.html` (CTAs = lista de espera + form repetido).
5. `sobre.html`.
6. Responsivo (≤900px e ≤640px) + passada de a11y (foco, contraste, `alt`,
   `aria-current`).
7. Registrar em `HISTORICO.md` (nova seção `## Etapa 7 — Landing`) e atualizar
   `PLANO.html`. Listar os pontos de marca (§8).

---

## 10. Verificação (obrigatória, padrão da casa)

- `node --check` em qualquer `.js` tocado (`auth.js`, e `site.js` se criado).
- **Teste de fumaça do auth (§3.3)** — o item mais importante.
- **Pré-lançamento:** e-mail não aprovado tenta entrar → é barrado e volta pra `/`
  com aviso. E-mail aprovado entra normal. Enviar e-mail na lista de espera →
  aparece uma linha nova em `waitlist` (conferir no Supabase); reenvio não duplica.
- Verificação visual: como a extensão do Chrome costuma não estar conectada, usar
  o mesmo caminho das rodadas anteriores (`agent-browser` CLI / preview harness)
  ou o preview local, checando:
  - Home, Sobre, Planos em desktop (1280) e mobile (390×844).
  - Hero sem vazar; grid de features quebrando certo; cards de plano alinhados;
    header compacto no mobile; contraste AA em faixa clara e escura.
- **Não** commitar/pushar/deployar sem revisão visual do usuário (padrão de todas
  as rodadas).

---

## 11. Definição de pronto

- `/` abre a home; `/sobre` e `/planos` no ar; "Entrar" → login → app; logout →
  home; `/app.html` deslogado → login. Tudo verde no §3.3.
- Modo pré-lançamento ativo: badge "Em breve", lista de espera gravando em
  `waitlist`, cadastro público bloqueado (só allowlist entra).
- Visual coerente com o app (Satoshi + mauve + tema), hierarquia estilo
  elevenlabs, AA em claro e escuro, responsivo.
- `HISTORICO.md` e `PLANO.html` atualizados; pontos de marca listados para o
  rename futuro.

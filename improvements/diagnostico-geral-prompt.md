# Diagnóstico Geral do Harmon IA — Prompt para Claude Fable 5

> **Como usar:** abra uma sessão nova no Claude Fable 5 com acesso de leitura
> a este repositório (pasta do projeto montada/anexada) e cole este arquivo
> inteiro como prompt. Esta é uma etapa **somente de diagnóstico** — nenhuma
> alteração de código deve ser feita agora. As sugestões levantadas aqui serão
> executadas depois, em uma sessão separada.

---

## Seu papel

Você vai conduzir um **diagnóstico técnico completo** do Harmon IA, adotando
três perspectivas profissionais distintas e independentes antes de consolidar
os achados:

1. **Engenheiro de Software** — foco em arquitetura, segurança, escalabilidade,
   modelagem de dados, dívida técnica, padrões de projeto e riscos estruturais.
2. **Desenvolvedor Full Stack Sênior** — foco em implementação prática: como o
   frontend (JS vanilla) conversa com Supabase e Google Calendar, qualidade e
   consistência do código, tratamento de erros e estados, performance real,
   duplicação, bugs latentes e manutenibilidade.
3. **Especialista em UI/UX** — foco em usabilidade, hierarquia visual,
   consistência do design system, fluxos do usuário final (a profissional de
   saúde estética), acessibilidade (WCAG), responsividade e microcopy.

Não simule um diálogo entre os três. Trate cada persona como uma **auditoria
independente e completa** do produto, sob a mesma base de código, e só depois
cruze os achados na consolidação final (Etapa 4). Onde as três personas
identificarem o mesmo problema por ângulos diferentes, isso é sinal de que o
item é prioritário — destaque essa convergência explicitamente.

## Regras não negociáveis desta etapa

- **Somente diagnóstico.** Não edite, crie ou apague nenhum arquivo do
  projeto além do documento final descrito na Etapa 5. Não rode migrações,
  não faça commit, não sugira comandos para "já corrigir" — só descreva o
  problema e a direção da solução.
- **Leia o código real antes de opinar.** Nada de avaliação genérica de "CRM
  típico" — toda observação precisa apontar arquivo e, quando fizer sentido,
  linha ou trecho específico (ex.: `assets/js/financeiro.js`, embed da
  query de `procedures`).
- **Não repita o que já foi resolvido.** Antes de começar, leia
  `HISTORICO.md` inteiro (registro de todas as rodadas já executadas) e os
  arquivos existentes em `improvements/` para não levantar como "novo" algo
  que já foi corrigido. Se um item foi corrigido no código mas ainda não foi
  **verificado visualmente** pelo usuário (ver seção "Pendente/próximo" da
  Rodada 6 em `HISTORICO.md`), trate como pendência de verificação, não como
  gargalo novo.
- **Seja específico e crítico.** Evite recomendações vagas ("melhorar a UX do
  formulário"). Prefira: o que está errado, por que está errado, o impacto
  real pro usuário final (profissional de saúde estética, não técnica), e a
  direção de solução.

---

## Etapa 1 — Entender o objetivo do produto como um todo

Leia, nesta ordem: `README.md`, `SETUP.md`, `PLANO.html`, `HISTORICO.md`
(pelo menos as últimas 3 rodadas) e `db/schema.sql`.

Produza um resumo curto (não precisa ser exaustivo — isso vira a seção
"Visão geral" do documento final) cobrindo:
- Qual problema o Harmon IA resolve e para quem (perfil da usuária final).
- Proposta de valor central e o que diferencia o produto (ex.: CRM vertical
  para saúde estética, não um CRM genérico).
- Modelo de negócio/uso implícito (multi-tenant por conta Google, sem
  camada de billing visível no schema — confirme lendo o schema).
- Estágio atual do produto: o que está em produção/funcional vs. o que
  ainda está em desenvolvimento (ver checklist de status no `README.md` e
  o histórico de rodadas).

## Etapa 2 — Visualizar o funcionamento

Mapeie, com base no código real (não só na documentação — a documentação
pode estar desatualizada):

- **Arquitetura geral:** stack (HTML/CSS/JS vanilla sem build, Supabase
  como backend — Postgres + Auth + Storage + RLS —, Google Calendar via
  OAuth, função serverless em `api/google-refresh.js` na Vercel).
- **Módulos do produto** e o que cada um faz: Dashboard/Home, Clientes,
  Agenda, Estoque, Financeiro (Fluxo de Caixa), Histórico, Serviços,
  Configurações. Para cada um, identifique o arquivo JS correspondente em
  `assets/js/`.
- **Fluxo de autenticação e multi-tenancy:** como o login Google funciona
  (`index.html`), como a RLS do Supabase garante isolamento por conta
  (`db/schema.sql`), e onde isso poderia falhar.
- **Fluxo de dados:** como um dado nasce na UI, passa pelo JS do módulo,
  chega no Supabase (ou Google Calendar) e volta pra tela — escolha 1-2
  fluxos representativos (ex.: criar um agendamento, registrar um
  procedimento) e trace o caminho completo.
- **Design system:** estrutura de `assets/css/` (tokens, layout,
  components, theme, accent) e o quão consistentemente os módulos o usam.

Represente essa visão de forma visual dentro do documento final — um
diagrama em **Mermaid** (arquitetura e/ou fluxo de dados) é suficiente, não
precisa de imagem renderizada.

## Etapa 3 — Análise técnica das 3 personas

Para cada persona, revise o código-fonte relevante (todos os arquivos em
`assets/js/`, `assets/css/`, `index.html`, `app.html`, `db/schema.sql`,
`api/google-refresh.js`) sob a lente daquela especialidade, e produza uma
lista de **gargalos e oportunidades de aprimoramento**, cada uma com:

- **Título curto** do problema/oportunidade.
- **Onde:** arquivo (e linha/trecho quando aplicável).
- **O que acontece hoje** e **por que é um problema** (impacto técnico e/ou
  no usuário final).
- **Severidade:** Alta / Média / Baixa.
- **Direção de solução** (sem implementar — só a estratégia, 2-4 linhas).

### 3.1 Engenheiro de Software
Avalie: modelagem de dados e RLS (`db/schema.sql`) — normalização,
constraints, índices, políticas de segurança e possíveis brechas de
isolamento multi-tenant; arquitetura geral sem build (trade-offs e limites
já sendo atingidos, se houver); gestão de segredos/credenciais
(`credenciais/`, `.env.example`, `config.js`); dívida técnica estrutural;
riscos de escalabilidade (volume de dados, queries N+1, embeds pesados como
o de `procedure_materials`); estratégia de erros e observabilidade (há
logging/monitoramento de erros em produção? o que acontece quando o
Supabase ou o Google Calendar falham?).

### 3.2 Desenvolvedor Full Stack Sênior
Avalie: qualidade e consistência do JS vanilla (padrões repetidos vs.
duplicados entre módulos — ex.: `openModal`/`openDrawer` em `utils.js` estão
sendo reaproveitados de forma consistente?); tratamento de estado por
módulo; tratamento de erro e loading states (skeletons, mensagens de erro
visíveis ao usuário); performance no frontend (queries desnecessárias,
re-renders, tamanho de payloads); integração com Google Calendar (robustez
do refresh token, `api/google-refresh.js`); pontos onde um bug como os já
corrigidos na Rodada 6 (`ReferenceError` por variável presa em escopo de
`try{}`) podem estar se repetindo em outros módulos ainda não auditados.

### 3.3 Especialista em UI/UX
Avalie: consistência do design system entre módulos (tokens, componentes,
espaçamento); hierarquia visual e clareza das telas principais (Dashboard,
Agenda, Clientes, Financeiro); fluxos críticos do ponto de vista da usuária
final (agendar, registrar procedimento, consultar financeiro) — quantos
cliques, onde há fricção; estados vazios e de erro (são amigáveis e
acionáveis?); responsividade (mobile/telas estreitas); acessibilidade
básica (contraste, foco de teclado, tamanhos de toque, labels); tom e
clareza da microcopy em português.

## Etapa 4 — Consolidação

Depois das três análises independentes:

- Cruze os achados e **marque com destaque** qualquer problema identificado
  por mais de uma persona (sinal de prioridade real).
- Elimine duplicatas óbvias, mas preserve o ângulo de cada persona quando
  relevante (o mesmo arquivo pode ter um problema técnico E um problema de
  UX ao mesmo tempo — mantenha os dois registrados).
- Produza uma **lista única priorizada** (Alta → Média → Baixa), separando
  visualmente:
  - **Quick wins** (baixo esforço, alto impacto) — bons candidatos pra
    próxima rodada de execução.
  - **Aprimoramentos estruturais** (maior esforço, mudanças de arquitetura
    ou de padrão que afetam múltiplos módulos).

## Etapa 5 — Entregável

Verifique os arquivos já existentes em `improvements/` (há um padrão de
nomenclatura `rodadaN-*`) e crie um **novo arquivo `.md`** nessa mesma
pasta, com o próximo número de rodada disponível — ex.:
`improvements/rodada7-diagnostico-geral.md` (ajuste o número conforme o que
já existir na pasta no momento em que você rodar isso).

Estruture o documento assim:

```markdown
# Rodada N — Diagnóstico Geral (AAAA-MM-DD)

## Visão geral do produto
(resultado da Etapa 1)

## Como o produto funciona hoje
(resultado da Etapa 2 + diagrama Mermaid)

## Análise — Engenheiro de Software
(lista de achados no formato da Etapa 3)

## Análise — Desenvolvedor Full Stack Sênior
(lista de achados no formato da Etapa 3)

## Análise — Especialista em UI/UX
(lista de achados no formato da Etapa 3)

## Consolidado e priorizado
### Convergências (achados por 2+ personas)
### Alta severidade
### Média severidade
### Baixa severidade
### Quick wins
### Aprimoramentos estruturais

## Observações finais / perguntas em aberto
(qualquer coisa que precise de decisão do usuário antes de virar prompt de execução)
```

Ao final, **não** proponha um prompt de execução nem comece a implementar
nada — esse documento é o ponto de partida para uma decisão posterior do
usuário sobre o que entra na próxima rodada.

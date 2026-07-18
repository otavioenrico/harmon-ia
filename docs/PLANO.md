# PLANO — Harmon IA (nome provisório)

**Arquivo único de planejamento.** Substitui e absorve: PLANO-MASTER.md, P0-CHECKLIST.md,
PLANO-SITE-PROFISSIONAL.md (fases 1–4 concluídas), APRIMORAMENTOS-PENDENTES.md (itens 1–4 e
Parte 1 concluídos; Partes 2–5 viraram itens da esteira) e DIAGNOSTICO-SITE.md (100% executado).
Histórico detalhado de implementação continua em `HISTORICO.md`; análise de custos em
`ANALISE-CUSTOS-PRICING.md`; visualização interativa em `plano-master.html`; execução por
agentes em `PLANO-EXECUCAO-AGENTES.md`. Atualizado em 18/07/2026.

---

## Estratégia (condensada)

**Produto hoje:** CRM multi-tenant para quem atende com hora marcada. 8 módulos completos
(Início, Agenda, Clientes, Serviços, Estoque, Histórico, Fluxo de Caixa, Configurações),
HTML/CSS/JS vanilla sem build, Supabase (RLS + RPCs atômicas), Google Calendar, Cloudflare
Workers. Beta fechado com 3 usuárias. Fundação técnica acima da média; falta completude
vertical + motor comercial.

**Posicionamento (decisão 18/07/2026):** horizontal no produto, vertical na comunicação —
*"o sistema elegante de quem atende com hora marcada: tudo incluso, preço na página, sem
multa"*. Padrão Goldie/SimplyBook: marca âncora elegante + anéis de segmento (núcleo =
beleza/estética; adjacente = saúde & bem-estar particular; cauda = tattoo, pet, foto,
consultoria) + landing por nicho + onboarding que pergunta o segmento. Fora do alvo: clínica
médica com convênio/TISS. Identidade rosé/Satoshi fica; rebrand é nome/logo.

**Pricing (validado por simulação de 30 personas):** Começo R$ 24,90 (margem 83%) ·
Profissional R$ 54,90 (78%) · Estúdio R$ 99,90 pós-orgs (60%) · add-on IA R$ 79–99.
Trial 35 dias sem cartão. Fair-use WhatsApp 150/600 msgs. Custo/cliente ≈ R$ 11–12/mês
pós-WhatsApp; fixo R$ 140/mês; break-even 5 assinantes.

**Janelas de mercado:** NFS-e nacional obrigatória (autônomos 08/2026, Simples 09/2026);
Salão99 fechou (05/2026) — base órfã; incumbentes cobram WhatsApp como add-on de R$ 150–229
e acumulam reclamações (preço opaco, multa 50%, bugs de pacote/comissão).

**Métricas-norte:** visitante→waitlist 3–5%; trial→pago 8–18%; churn < 5%/mês;
100 × R$ 99 ≈ R$ 10k MRR em 12 meses. Métrica-marketing: queda de no-show das clientes.

**Como executar:** esteira abaixo, em ordem. Etapas 1–6 grátis; etapa 7 destrava com o nome;
8–11 pagas. Etapas 2–6 rodam por agentes (`PLANO-EXECUCAO-AGENTES.md` →
`claude --model opus "/executar-onda N"`). Você faz a etapa 1 e os gates.

---

# A Esteira

## Etapa 1 — Ativar o P0 — segurança e medição  ·  GRÁTIS  ·  ½ dia de cliques

*O código já está no repo. Faltam só as ações manuais de painel — em ordem.*

Tudo desta etapa já foi implementado no código (2026-07-18). O que resta são configurações que só você consegue fazer nos dashboards (Supabase, Cloudflare, Google, Resend). Os itens 1.1 e 1.2 são obrigatórios e na ordem exata.

### 1.1 Supabase: URL de retorno + fechar cadastros
`P0-1 · checklist` · custo: R$ 0 · tempo: 10 min

**O que é.** Duas configurações no painel de Auth do Supabase que precisam existir ANTES do próximo deploy.

**O que faz.** O login OAuth passa a voltar para /entrar.html (o código novo espera isso) e o beta fechado passa a ser imposto pelo servidor — conta Google nova não entra mais (fix do achado ALTO A1).

**Como fazer:**
1. Supabase → Authentication → URL Configuration → Redirect URLs: adicionar `https://harmon-ia.otavio-projects.workers.dev/entrar.html` e `http://localhost:8000/entrar.html` (dev local).
2. Supabase → Authentication → Sign In / Providers: desligar **"Allow new users to sign up"**.
3. Conferir: as 3 contas existentes continuam entrando; conta nova deve voltar com `signup_disabled` e a página de login mostra o aviso de pré-lançamento.

### 1.2 Deploy + migração de segurança (ordem importa)
`checklist P0` · custo: R$ 0 · tempo: 15 min

**O que é.** Publicar o código P0 e só DEPOIS rodar a migração que corta o INSERT anônimo da waitlist.

**O que faz.** Waitlist passa a gravar só via Worker (Turnstile fail-closed quando o secret existir); site antigo não quebra porque a migração roda depois do deploy novo.

**Como fazer:**
1. No terminal: `npx wrangler deploy` (ou push no GitHub — Workers Builds).
2. Depois do deploy no ar: rodar `db/migration-p0-seguranca.sql` no SQL Editor do Supabase.
3. Teste: enviar e-mail novo na waitlist do site → linha aparece na tabela `waitlist`. Repetir o mesmo e-mail → continua sucesso (dedupe silencioso).

### 1.3 Rotacionar e cofrear segredos
`P0-2 · fix A2` · custo: R$ 0 · tempo: 30 min

**O que é.** A senha do banco e o GOOGLE_CLIENT_SECRET estão em texto puro em credenciais/CREDENCIAIS.md. Nunca foram commitados, mas estão a um deslize de vazar.

**O que faz.** Elimina o risco de vazamento de credencial raiz — a senha do banco ignora RLS; o client secret permite se passar pelo app.

**Como fazer:**
1. Supabase → Settings → Database → **Reset database password**. Guardar a senha nova apenas no gerenciador de senhas (1Password/Bitwarden).
2. Google Cloud Console → Credentials → OAuth client: gerar novo client secret.
3. Atualizar o secret novo em: Supabase (Auth → Providers → Google) e no Worker via `npx wrangler secret put GOOGLE_CLIENT_SECRET`.
4. Excluir o secret antigo no Google Cloud Console.
5. Mover qualquer outro dado de credenciais/CREDENCIAIS.md para o gerenciador e apagar o arquivo.

### 1.4 Turnstile real + Web Analytics
`P0-3 e P0-6` · custo: R$ 0 · tempo: 30 min

**O que é.** A chave Turnstile nos HTML é a de TESTE (1x00000000000000000000BB) e não há analytics nenhum — a conversão da waitlist é invisível.

**O que faz.** Anti-bot de verdade no formulário (fail-closed) e funil visitante → waitlist mensurável pela primeira vez.

**Como fazer:**
1. Cloudflare dashboard → Turnstile → Add widget (hostname `harmon-ia.otavio-projects.workers.dev`, modo Managed).
2. Trocar a sitekey de teste nos `<div class="cf-turnstile">` de index.html e planos.html pela sitekey real.
3. `npx wrangler secret put TURNSTILE_SECRET` com o secret do widget. Sem o secret o Worker aceita sem verificar; com ele, vira fail-closed.
4. Cloudflare → Web Analytics → Add site → copiar o token → descomentar o snippet no fim de index.html e planos.html (a CSP já libera os domínios).
5. Redeploy (`npx wrangler deploy`) e testar a waitlist de novo.

### 1.5 Resend: aviso interno de lead novo
`P0-9` · custo: R$ 0 (free 3k/mês) · tempo: 20 min

**O que é.** Conta gratuita no Resend para o Worker avisar você por e-mail a cada lead da waitlist.

**O que faz.** Você fica sabendo de cada lead na hora. O e-mail de confirmação PARA O LEAD fica para a etapa 7 (exige domínio próprio verificado).

**Como fazer:**
1. Criar conta no Resend → gerar API key.
2. `npx wrangler secret put RESEND_API_KEY` e `npx wrangler secret put NOTIFY_EMAIL` (seu e-mail).
3. Teste: e-mail novo na waitlist → chega o aviso (o domínio de teste do Resend basta para o aviso interno).

### 1.6 Higiene Supabase + testes de aceite
`P0-10 · checklist` · custo: R$ 0 · tempo: 30 min

**O que é.** Última varredura: advisors de segurança, região do projeto e os 4 testes de aceite do P0.

**O que faz.** Zera warnings de plataforma e confirma que o pacote P0 inteiro está funcionando em produção.

**Como fazer:**
1. Supabase → Database → Advisors (Security Advisor): rodar e revisar cada warning.
2. Supabase → Settings → General: conferir a região (ideal `sa-east-1` São Paulo — latência + "dados no Brasil").
3. Aceite 1: login com conta existente entra normal.
4. Aceite 2: conta Google NOVA volta pra tela de login com aviso de pré-lançamento.
5. Aceite 3: waitlist grava + e-mail de aviso chega.
6. Aceite 4: Configurações do app mostra o avatar do Google (CSP liberou googleusercontent.com).

---

## Etapa 2 — Reposicionamento macro: "hora marcada"  ·  GRÁTIS  ·  1–2 semanas

*Horizontal no produto, vertical na comunicação. Nada aqui depende de domínio ou marca.*

O sistema não é exclusivo de estética: qualquer profissional autônomo com agendamento + estoque + caixa cabe nele. O benchmark mostrou a fórmula vencedora (padrão Goldie/SimplyBook): um produto único, marca elegante âncora, landing pages por segmento e onboarding que pergunta o nicho. Esta etapa executa a virada — toda em copy, páginas e decisões, custo zero.

### 2.1 Decisão de posicionamento: âncora elegante + anéis de segmento
`novo · benchmark` · custo: R$ 0 · tempo: 1 dia

**O que é.** Formalizar a virada de "vertical de estética" para "o sistema elegante de quem atende com hora marcada", no padrão que o benchmark validou: Goldie mantém a marca beauty e lista 19 nichos em 3 anéis; SimplyBook pergunta o segmento no cadastro e liga só o que o nicho precisa.

**O que faz.** Multiplica o mercado endereçável sem perder o público certeiro (beleza/estética continua sendo o anel núcleo e o tom da marca). Guia o naming, a copy, as fichas configuráveis e o onboarding das próximas etapas.

**Como fazer:**
1. Definir os 3 anéis por escrito: **núcleo** = beleza/estética (lash, sobrancelha, skin, micro, harmonização, unhas, barbearia); **adjacente** = saúde & bem-estar particular (massoterapia, podologia, fisio, nutri, psico, terapias); **cauda** = hora marcada em geral (tatuagem, pet, fotografia, consultoria, aulas particulares).
2. Delimitar o que fica FORA por ora: clínica médica com convênio/TISS e prontuário regulado pelo CFM — iClinic/Amplimed dominam e o compliance é pesado. Médico particular simples pode usar, mas sem promessa de prontuário regulatório.
3. Adotar vocabulário neutro no app: "procedimento" → "atendimento", "clínica" → "negócio/espaço". Termos clínicos ficam só nos templates de ficha dos segmentos de estética/saúde.
4. Manter a identidade visual rosé/Satoshi intacta — é diferencial contra o SaaS azul genérico. Rebrand (etapa 7) é nome/logo, não design system.
5. Registrar a tese nova no PLANO-MASTER §3: "tudo incluso, preço na página, sem multa" continua — muda só o alvo, de "estética" para "hora marcada, com elegância".

### 2.2 Copy v2 horizontal orientada a conversão
`P1-19 adaptado` · custo: R$ 0 · tempo: 1–2 dias

**O que é.** Reescrever hero, subheads, CTAs e FAQ do site com o posicionamento novo. O hero recomendado já é naturalmente horizontal: "Agenda cheia, caixa no azul e cliente que volta."

**O que faz.** Copy que vende resultado (não categoria) e ataca as reclamações documentadas dos concorrentes — sem citar estética como único público.

**Como fazer:**
1. Hero: "Agenda cheia, caixa no azul e cliente que volta." · sub: "Agenda, fichas de atendimento, WhatsApp automático, estoque e caixa — para quem vive de hora marcada. Tudo incluso."
2. Seção anti-add-on: "O WhatsApp automático que cobram R$ 150–229/mês de módulo? Aqui já vem no plano." com tabela de custo real (Belle/Trinks/Avec com add-ons).
3. Números do nicho nas seções de prova: lembrete WhatsApp = −30 a −70% de faltas; agendamento online = +33% receita/cliente; 46–58% dos agendamentos acontecem fora do horário comercial.
4. CTA: "Testar grátis por 35 dias" + microcopy "sem cartão · sem multa · cancele quando quiser".
5. Revisar o marquee de segmentos para cobrir os 3 anéis (hoje já lista 9 — completar com bem-estar e cauda).
6. FAQ de objeções: migração grátis, "já uso Trinks/Belle, e aí?", segurança/LGPD, "funciona no celular?".

### 2.3 Hub de páginas por segmento (SEO)
`novo · benchmark` · custo: R$ 0 · tempo: 3–5 dias

**O que é.** Landing pages por nicho com template fixo — o mecanismo que Setmore (49 páginas), Acuity e Simples Agenda usam para ser horizontais sem diluir a home.

**O que faz.** Cada nicho se reconhece ("sistema para lash designer" / "para massoterapeuta" / "para tatuador") e o Google indexa cauda longa de busca — canal orgânico sem mídia paga.

**Como fazer:**
1. Criar o template: headline com vocabulário do nicho, screenshot contextualizado (serviços com nomes do nicho), 3 dores específicas, depoimento (quando houver), mesmas features, CTA waitlist.
2. Gerar as 6–10 primeiras páginas priorizando o anel núcleo + adjacente: lash, sobrancelha, skincare, micropigmentação, barbearia, massoterapia, podologia, tatuagem.
3. Nav "Para quem" + links no rodapé (padrão Acuity: dropdown, cards na home, footer).
4. SEO por página: title "Sistema de agendamento para [nicho]", meta description própria, canonical, entrada no sitemap.xml.
5. Medir por página (item 2.5): qual segmento converte mais waitlist decide onde investir depoimento/screenshot primeiro.

### 2.4 Site v2: provas reais + "Estúdio — em breve"
`P1-18 + análise §7` · custo: R$ 0 · tempo: 3–5 dias

**O que é.** Substituir os 4 placeholders "imagem" e os SVGs genéricos por screenshots reais com dados demo caprichados; trocar o card "Team R$ --" por "Estúdio — em breve" com waitlist própria.

**O que faz.** As provas de confiança que faltam para a landing converter — e um medidor de demanda real do plano de equipe antes de construí-lo (P2-26 vem lá na etapa 9).

**Como fazer:**
1. Criar seed de dados demo bonito: clientes fictícios, agenda cheia, caixa positivo — 1 conta demo de estética + 1 de outro anel (ex.: barbearia) para os screenshots dos segmentos.
2. Capturar screenshots reais em device frames (browser + celular) e substituir os placeholders de index.html e sobre.html.
3. Tabela comparativa de custo real vs Trinks/Belle/Clinicorp (preço com add-ons, multa, trial).
4. Corrigir CTAs: waitlist funcional em solucoes.html (hoje o CTA vira âncora) e CTA no corpo de sobre.html.
5. Card Team → "Estúdio — em breve" com captura própria (`source: 'waitlist-estudio'` na tabela waitlist).
6. Gravar GIF/vídeo de 40–60s: agendar → confirmar → concluir → caixa atualizado.

### 2.5 Funil mensurável por segmento (PostHog)
`P0-6 complemento` · custo: R$ 0 (free tier) · tempo: ½ dia

**O que é.** PostHog free por cima do Web Analytics da etapa 1: eventos de submit da waitlist com a página/segmento de origem.

**O que faz.** Responde "qual nicho converte mais?" com dado — é o que prioriza os anéis daqui pra frente. Meta: visitante → waitlist 3–5%.

**Como fazer:**
1. Criar projeto no PostHog (free) e adicionar o snippet gatilhado pelo `window.onCookieConsent` que já existe no código.
2. Evento `waitlist_submit` com propriedades: página, segmento, source (hero/rodapé/estudio).
3. Dashboard com funil por página de segmento + taxa geral.
4. Rito semanal: olhar o funil, anotar hipóteses de copy no PLANO-MASTER §6.

---

## Etapa 3 — Núcleo do produto: agenda própria, fichas e pacotes  ·  GRÁTIS  ·  6–9 semanas

*O que separa "agenda + caixa" de um sistema completo — tudo só código.*

Os table-stakes que o benchmark apontou em TODOS os concorrentes relevantes, adaptados ao posicionamento horizontal. A agenda própria vem primeiro porque destrava quase tudo que segue (booking, lembretes, equipe). Ordem interna pensada por dependência.

### 3.1 Agenda própria — Google vira espelho opcional
`P1-14 · Parte 3` · custo: R$ 0 · tempo: 2–3 sem

**O que é.** Hoje o Google Calendar É o banco da agenda: sem conectar Google, o módulo não funciona. Inverter: horário e duração moram no Postgres; o Google vira sincronização opcional.

**O que faz.** Onboarding sem fricção (qualquer pessoa usa sem conta Google), independência de fornecedor e pré-requisito técnico do booking online, dos lembretes automáticos e do plano de equipe.

**Como fazer:**
1. Schema: `procedures` ganha `start_time`/`duration` (ou tabela própria de agendamentos); `google_event_id` passa a ser opcional.
2. agenda.js passa a ler do banco; sync de espelho best-effort (criar/atualizar/apagar evento no Google só se conectado).
3. Regras de disponibilidade na mesma leva (o booking da etapa 6 precisa): horário de trabalho por dia da semana, buffer entre atendimentos, antecedência mínima, bloqueios/folgas.
4. Agendamento recorrente (série semanal/quinzenal/mensal) — padrão dos horizontais (Setmore Pro), essencial para massoterapia/terapias/aulas.
5. Migração dos dados atuais: backfill de start_time/duração a partir dos eventos Google existentes.
6. Rollback e conflito: manter o padrão atual (RPC atômica; desfazer espelho se falhar).

### 3.2 Login sem Google (e-mail/senha)
`Parte 3.2–3.3` · custo: R$ 0 · tempo: 1 sem

**O que é.** Cadastro/login próprio via Supabase Auth; cada função Google vira condicional a "Google conectado". Inclui o fluxo de desconectar Google com opções.

**O que faz.** Remove a última dependência dura do Google — crítico para o público horizontal (nem todo autônomo vive no ecossistema Google) e para o onboarding self-service.

**Como fazer:**
1. Habilitar e-mail/senha no Supabase Auth (com confirmação de e-mail) e montar as telas de cadastro/login/recuperação em entrar.html.
2. Revisar auth.js e ensureSettings: sessão sem provider Google não tenta capturar refresh_token.
3. Varrer o app: cada chamada Google (Calendar/Contacts/Drive/Sheets) já tem tratamento NeedsReconnect — generalizar para "não conectado" com CTA de conectar.
4. Card Conta em Configurações: estado "Google não conectado" + botão conectar (OAuth incremental).
5. Desconectar Google com 3 opções: cancelar / desconectar e remover itens sincronizados (eventos + contatos-espelho) / desconectar mantendo os registros no app.

### 3.3 Ficha de atendimento configurável + termo assinado
`P1-11 horizontal` · custo: R$ 0 · tempo: 2–3 sem

**O que é.** Fichas por segmento em vez de "prontuário de estética": templates configuráveis (anamnese de estética, avaliação de massoterapia, ficha genérica), evolução por sessão e termo de consentimento com assinatura na tela.

**O que faz.** O item que separa o app de "agenda + caixa" — e no formato configurável vira ativo horizontal: cada nicho recebe o template certo no onboarding. TCLE com hash e trilha tem validade pela MP 2.200-2/2001.

**Como fazer:**
1. Tabelas: `form_templates` (campos em jsonb: texto, múltipla escolha, escala, sim/não, foto), `form_responses` (por cliente/atendimento), `consent_terms` — RLS own_data padrão.
2. Builder simples de template (adicionar/ordenar campos) + biblioteca de templates prontos por segmento (seed usado pelo onboarding da etapa 6).
3. Assinatura: canvas → PNG no bucket privado + SHA-256 da resposta na linha + timestamp — trilha de auditoria.
4. Evolução por sessão anexada ao atendimento; alergias/contraindicações com destaque no perfil da cliente.
5. Export PDF da ficha + termo (para a cliente ou fiscalização).
6. Preencher pelo celular da cliente: link/QR que abre a ficha para ela responder na recepção (padrão Mangomint Express Booking).

### 3.4 Fotos antes/depois com comparador
`P1-12` · custo: R$ 0 · tempo: 1 sem

**O que é.** Galeria por cliente/atendimento com comparador lado a lado (slider). O site já promete essa feature — ela não existe no app.

**O que faz.** Caso medspa documentado: consultas convertendo de 45% para 90%+ ao mostrar resultados. Fecha o gap marketing↔produto. Vale além da estética (tatuagem, sobrancelha, cabelo).

**Como fazer:**
1. Tabela `photos` ligada a cliente + atendimento (tipo antes/depois, pareamento).
2. Upload comprimido no padrão do estoque (~1280px webp ~250 KB — a análise de custos já modelou: storage só vira custo relevante sem compressão).
3. Comparador com `clip-path` + slider; visualização em par na ficha e no perfil.
4. Política de arquivamento: reduzir resolução após 24 meses (mitigação de storage da análise §4).
5. Consentimento de uso de imagem: checkbox no termo da ficha (3.3).

### 3.5 Pacotes de sessões confiáveis
`P1-13` · custo: R$ 0 · tempo: 1–1,5 sem

**O que é.** Venda de pacote (N sessões, validade, valor), débito de sessão no atendimento, saldo visível e alertas de expiração.

**O que faz.** Table-stakes absoluto do nicho — e o líder Belle tem falha pública documentada nisso (12 sessões debitadas num pacote de 10). Confiabilidade aqui vira argumento de venda.

**Como fazer:**
1. Tabelas `packages` + `package_sessions`; RPC atômica de débito/estorno (especialidade da casa).
2. Integrar a schedule/complete/cancel_procedure: agendar consome saldo reservado, concluir debita, cancelar devolve.
3. Venda do pacote entra no caixa (à vista ou parcelado, reusando financial_entries).
4. Saldo no perfil da cliente + badge "pacote a vencer" nos retornos da Home.
5. Testes de borda: pacote expirado, saldo zero, cancelamento pós-débito — é aqui que o Belle falha.

### 3.6 Venda avulsa de produtos (comanda)
`novo · benchmark` · custo: R$ 0 · tempo: 3–5 dias

**O que é.** Registrar venda de produto sem atendimento (ou junto de um) — baixando estoque e lançando no caixa. Hoje produto só sai do estoque dentro de procedimento.

**O que faz.** Home care / revenda é receita relevante em vários nichos (skincare, barbearia, pet). SimplyBook e Square tratam como POS básico; aqui reaproveita estoque + caixa que já existem.

**Como fazer:**
1. RPC `sell_products`: baixa estoque (movimentação "venda") + financial_entry categoria "Venda de produto" com custo congelado (lucro correto).
2. Botão "Nova venda" no Estoque e atalho na Home; seleção de itens com quantidade e preço de venda por item (campo novo `sale_price` em stock_items, opcional).
3. Opção de anexar a venda a um atendimento (comanda única no registro do procedimento).
4. Entradas do caixa e dashboard (etapa 4) passam a separar receita de serviço × produto.

### 3.7 Estoque: lote/validade + ficha técnica por serviço
`P2-30` · custo: R$ 0 · tempo: 1–2 sem

**O que é.** Controle por lote com validade e alertas 30/15/7 dias; ficha técnica por serviço (materiais default) com baixa automática no atendimento.

**O que faz.** Clínica média perde US$ 4–12k/ano em produto vencido. A ficha técnica elimina a seleção manual de materiais a cada registro — o custo já congela hoje, falta o preset.

**Como fazer:**
1. Tabela `stock_batches` (item, lote, validade, quantidade); movimentações passam a apontar lote (FIFO por validade).
2. Alertas de vencimento no dashboard e na lista de compras (30/15/7 dias).
3. Tabela `service_materials`: preset de materiais por serviço, editável no registro do atendimento.
4. RPCs de procedimento consomem o preset por padrão; custo médio ponderado opcional (hoje é última compra).

### 3.8 LGPD: excluir conta + consentimento do cliente final
`P1-16 · fix M2` · custo: R$ 0 · tempo: 2–3 dias

**O que é.** Atendimento de estética/saúde é dado sensível (art. 11 LGPD). Falta exclusão de conta in-app, política de retenção e registro de consentimento do cliente final.

**O que faz.** Conformidade real + argumento de venda ("seus dados são seus, export e exclusão a um clique").

**Como fazer:**
1. Botão "Excluir minha conta" em Configurações: Worker deleta o auth user (cascade já apaga os dados); confirmação forte digitando EXCLUIR.
2. Checkbox + timestamp de consentimento no cadastro de cliente (base legal registrada).
3. Texto de política de retenção nas páginas legais (rascunho técnico; revisão jurídica na etapa 7).
4. Conferir que o backup/export JSON continua cobrindo o direito de portabilidade.

### 3.9 Importador CSV — migração assistida
`P1-25` · custo: R$ 0 · tempo: 3–5 dias

**O que é.** Importar clientes, serviços e estoque de planilha/CSV com mapeamento de colunas e prévia (dry-run).

**O que faz.** Captura órfãos do Salão99 (fechou mai/2026) e insatisfeitos de Trinks/Avec/Belle. "Migração grátis" vira promessa de marketing — Cliniko e Goldie fazem isso.

**Como fazer:**
1. Parser CSV client-side + tela de mapeamento de colunas (nome → campo) com detecção automática.
2. Prévia dry-run: mostra o que será criado/ignorado/duplicado antes de gravar.
3. Insert em lote com dedupe por telefone/e-mail.
4. Guias "migrando do X" no site (Trinks, Belle, Salão99, planilha) — casam com as páginas de segmento da etapa 2.

---

## Etapa 4 — Financeiro profissional: do caixa ao DRE  ·  GRÁTIS  ·  4–6 semanas

*O bloco inteiro que o benchmark apontou como incompleto — tudo só código.*

Hoje o Fluxo de Caixa registra o passado com categoria em texto livre. Esta etapa entrega o financeiro que Belle cobra R$ 150/mês de add-on de BI: plano de contas, contas a pagar/receber recorrentes, taxas de cartão, metas, DRE, projeção de caixa, orçamentos e conciliação. Ordem interna importa — os 2 primeiros itens são fundação dos demais.

### 4.1 Plano de contas: categorias estruturadas
`novo · benchmark` · custo: R$ 0 · tempo: 3–5 dias

**O que é.** Hoje `financial_entries.category` é texto livre de 60 caracteres. Sem categorias estruturadas com grupo de DRE, nenhum relatório gerencial para em pé — é o pré-requisito não mapeado do plano antigo.

**O que faz.** Mostra para onde o dinheiro vai (% insumos, % taxas, % aluguel) em vez de entradas/saídas soltas. Destrava DRE (4.5), projeção (4.6) e relatórios de margem.

**Como fazer:**
1. Migration: tabela `categories` (user_id, nome, tipo income|expense, grupo_dre, cor, ativo, ordem) com RLS own_data.
2. Seed de ~20 categorias típicas por segmento (insumos, aluguel, taxas de cartão, marketing, pró-labore…) via RPC `ensure_categories` no primeiro acesso.
3. Adicionar `category_id` nullable em financial_entries mantendo o texto legado; backfill por matching case-insensitive, resto vira "Sem categoria".
4. financeiro.js: trocar o input livre por select com busca (+ criar categoria inline); CRUD de categorias em Configurações.
5. Ranking do Resumo e gráficos passam a agrupar por category_id com a cor da categoria.

### 4.2 Contas a pagar/receber com recorrência + alerta de vencimento
`novo · benchmark` · custo: R$ 0 · tempo: 1 sem

**O que é.** Agenda de obrigações futuras: aluguel, luz, fornecedor, assinatura — com recorrência (a Conta Azul tem isso nativo; hoje aqui é redigitado todo mês).

**O que faz.** "X contas vencem esta semana" na Home — nada de conta esquecida. Base do fluxo de caixa projetado (4.6).

**Como fazer:**
1. Tabela `bills` (tipo pagar|receber, descrição, category_id, contraparte, valor, vencimento, status, recorrência nenhuma|semanal|mensal|anual, fim da recorrência, serie_id) com RLS.
2. Ao criar recorrente, RPC gera as próximas 12 ocorrências (sem precisar de cron novo); o cron semanal do Worker repõe ocorrências futuras.
3. Atrasadas marcadas na leitura (padrão de expiração preguiçosa que o app já usa).
4. "Marcar como pago" cria financial_entry vinculada (bill_id) — a conta vira lançamento real no caixa.
5. Card de vencimentos na Home (7 dias) + aba/lista no Financeiro com filtros.

### 4.3 Taxa de cartão e valor líquido
`Parte 5 do backlog` · custo: R$ 0 · tempo: 3–5 dias

**O que é.** Capturar a taxa (%) da maquininha por forma de pagamento e refletir o valor líquido recebido — para o lucro real.

**O que faz.** Bruto × líquido visível no caixa e a taxa aparecendo como custo no DRE. Trinks faz até rateio da taxa na comissão — aqui começa pelo essencial.

**Como fazer:**
1. Configurações: taxa default por forma (débito, crédito à vista, crédito parcelado por faixa) + prazo de recebimento (D+1/D+30).
2. financial_entries ganha `fee_pct`/`net_amount` (aplicada no lançamento, ajustável caso a caso).
3. Caixa e stat-cards distinguem bruto × líquido; a taxa vira lançamento de despesa na categoria "Taxas de cartão" (alimenta o DRE).
4. Prazo de recebimento alimenta a projeção (4.6): crédito de hoje só vira caixa em D+30.

### 4.4 Metas de faturamento com progresso
`novo · benchmark` · custo: R$ 0 · tempo: 2–3 dias

**O que é.** Meta mensal de faturamento/atendimentos/clientes novos com barra de progresso e projeção pró-rata no dashboard (padrão Belle/GestãoDS).

**O que faz.** "Faltam R$ 1.200 pra bater a meta" — gestão ativa em vez de retrovisor, e um gancho de hábito que faz a assinante abrir o app todo dia.

**Como fazer:**
1. Tabela `goals` (ano, mês, tipo, alvo) com RLS.
2. Card na Home: barra de progresso (realizado via financial_entries paid_at / procedures) + projeção pró-rata (realizado ÷ dias corridos × dias do mês) com cor verde/amarelo/vermelho.
3. Sugestão automática de meta = média dos 3 últimos meses +10%.
4. Form no próprio card ou em Configurações.

### 4.5 Dashboard analítico + DRE simplificado
`P2-31` · custo: R$ 0 · tempo: 1–2 sem

**O que é.** Página Relatórios: ticket médio, LTV, taxa de ocupação da agenda, ranking de serviços/clientes, receita serviço × produto e DRE gerencial gerado do plano de contas.

**O que faz.** "Gestão profissional" tangível — o que Belle vende como BI de R$ 150/mês. Ocupação mediana do setor é 38%: mostrar o número da própria agenda vende o resto do produto.

**Como fazer:**
1. RPCs de agregação server-side (não carregar tudo no client): por período, serviço, cliente, categoria.
2. DRE simplificado: receita de serviços + produtos − taxas de cartão − insumos (custo congelado) = margem bruta − despesas por grupo do plano de contas = resultado do mês.
3. Ticket médio, LTV estimada, ocupação (horas agendadas ÷ horas disponíveis das regras da 3.1), ranking top serviços/clientes.
4. Comparativos mês a mês (12 meses) reusando o padrão SVG inline dos gráficos atuais — um único sistema de dataviz (paleta derivada do accent).
5. Export PDF/CSV do DRE do mês.

### 4.6 Fluxo de caixa projetado 30/60/90 dias
`novo · benchmark` · custo: R$ 0 · tempo: 1 sem

**O que é.** Curva futura de saldo dia a dia: parcelas a receber + contas a pagar + agendamentos futuros com preço — só o Clinicorp entrega isso bem no segmento.

**O que faz.** Responde "vou conseguir pagar o aluguel no dia 10?" — previsibilidade em vez de susto no fim do mês.

**Como fazer:**
1. Sem tabela nova: RPC que soma por dia, de hoje a D+90: financial_entries pendentes por due_date + bills futuras + agendamentos do período (preço do serviço, líquido conforme 4.3).
2. Saldo inicial = recebido − despesas até hoje.
3. Nova aba no Financeiro: gráfico de linha SVG (realizado sólido, previsto tracejado), dias negativos em vermelho, cards 30/60/90.
4. Clique no dia lista os lançamentos previstos daquele dia.

### 4.7 Orçamentos para cliente (proposta com aprovação por link)
`novo · benchmark` · custo: R$ 0 · tempo: 1–1,5 sem

**O que é.** Proposta com serviços/pacote, desconto (% ou R$), validade e status (rascunho → enviado → aprovado/recusado/expirado). Aprovou, vira parcelas a receber e agendamento — sem redigitação.

**O que faz.** Proposta profissional em 2 minutos com validade que cria urgência; orçamentos em aberto viram fila de follow-up. Alavanca direta da venda de pacotes (3.5). Belle e Clinicorp tratam orçamento como centro do funil.

**Como fazer:**
1. Tabelas `quotes` (cliente, número, validade, desconto, condições, status) + `quote_items` (serviço, sessões, preço, desconto por item) com RLS.
2. Tela de montagem puxando preços do catálogo; desconto por item ou no total.
3. Página pública `/orcamento/:token` servida pelo Worker (mesmo padrão da booking page) com botão Aprovar — compartilhada via wa.me.
4. Ao aprovar: RPC cria a série em financial_entries (ou bill a receber) + registra no perfil; expiração preguiçosa na leitura.
5. Lista "orçamentos em aberto" com follow-up sugerido (vira mensagem pronta na central da etapa 5).

### 4.8 Conciliação bancária — fase OFX/CSV
`novo · benchmark` · custo: R$ 0 · tempo: 1 sem

**O que é.** Importar extrato OFX/CSV do banco e casar com os lançamentos (matching assistido). Fase 2 com Open Finance (Pluggy/Belvo) fica na etapa 10 — essa fase 1 é 100% grátis.

**O que faz.** Garante que o app reflete a conta de verdade: pega venda não lançada, despesa esquecida e taxa não percebida. Para o público com 1 conta MEI, a fase OFX já resolve a dor.

**Como fazer:**
1. Parser OFX/CSV em JS puro no client (OFX é SGML simples).
2. Tela de matching: sugere pares por valor igual e data ±3 dias; aceitar grava `reconciled_at` + `bank_ref` no lançamento.
3. Rejeitar oferece criar lançamento novo já categorizado (usa o plano de contas 4.1).
4. Indicador "% do mês conciliado" no Resumo.

---

## Etapa 5 — Retenção sem custo: mensagens e reputação  ·  GRÁTIS  ·  1–2 semanas

*Todo o valor dos disparos — antes de pagar um centavo de WhatsApp API.*

A versão assistida (wa.me com texto pronto) entrega ~80% do valor dos lembretes com custo e risco zero, e o e-mail via Resend free cobre o resto. Quando o WhatsApp oficial chegar (etapa 8), esses fluxos já estarão desenhados — só troca o canal.

### 5.1 Central de mensagens do dia (assistida via wa.me)
`Parte 2 · fase 1` · custo: R$ 0 · tempo: 1 sem

**O que é.** Tela "Mensagens de hoje": lembretes de amanhã, retornos vencidos, aniversários, parcelas a vencer, pós-atendimento e follow-up de orçamento — cada um com texto pronto e botão de envio via wa.me (1 clique por mensagem).

**O que faz.** Zero custo, zero risco de ban (sem automação de WhatsApp pessoal — bibliotecas não-oficiais arriscam o número dela). Mantém o toque humano e já organiza os gatilhos que a Cloud API vai automatizar depois.

**Como fazer:**
1. Nova rota "Mensagens" agregando as queries que já existem: agendamentos de amanhã, retornos (return_dismissals), aniversários (clients.birthdate), parcelas due_date próximas, atendimentos concluídos ontem (aftercare), orçamentos a vencer (4.7).
2. Templates de texto editáveis por gatilho (tabela `message_templates` com variáveis {nome}, {hora}, {serviço}).
3. Botão wa.me por linha (reusa waLink) + marcar como enviada (não repetir no dia).
4. Opt-out por cliente (campo no cadastro — exigência LGPD e da futura Cloud API).
5. Badge com contagem de pendentes na Home.

### 5.2 Lembretes automáticos por e-mail (Resend free)
`novo · benchmark` · custo: R$ 0 (free 3k/mês) · tempo: 3–5 dias

**O que é.** Confirmação e lembrete de véspera por e-mail, automáticos de verdade, via cron do Worker + Resend (100/dia grátis cobrem ~1.000 clientes finais).

**O que faz.** Automação real sem custo por mensagem — e a decisão da análise de custos aplicada desde o início: aniversário/reativação por e-mail como padrão corta 2/3 do custo variável futuro do WhatsApp marketing.

**Como fazer:**
1. Campo e-mail do cliente já existe; adicionar opt-in de lembrete por e-mail no cadastro.
2. Cron diário no Worker (já existe infra de cron): varre agendamentos de amanhã + aniversários do dia e envia via Resend.
3. Templates HTML simples com a identidade do app; remetente do domínio de teste até a etapa 7, depois domínio próprio.
4. Log de envios (tabela `message_log`) para não duplicar e para o painel de automações futuro.

### 5.3 Pedido de avaliação no Google
`novo · benchmark` · custo: R$ 0 · tempo: 1 dia

**O que é.** Ao concluir atendimento, mensagem pronta pedindo avaliação no perfil do Google do negócio (Setmore Pro e Goldie vendem isso como feature).

**O que faz.** Reviews no Google são o principal canal de aquisição local de serviços — pedir na hora certa multiplica a taxa de resposta. Casa com o CAC orgânico obrigatório do plano.

**Como fazer:**
1. Campo `google_review_link` em user_settings (Configurações, com instrução de como pegar o link curto do perfil).
2. Gatilho na central (5.1): atendimento concluído → linha "pedir avaliação" com wa.me pré-preenchido.
3. Guardar `review_requested_at` no atendimento para não repetir por cliente.
4. Quando a Cloud API chegar (8.3): vira template automático X horas após a conclusão.

### 5.4 NPS pós-atendimento (versão grátis)
`P2-32 parcial` · custo: R$ 0 · tempo: 2–3 dias

**O que é.** Pesquisa 0–10 simples por link (página pública do Worker), disparada pela central ou pelo e-mail automático.

**O que faz.** Termômetro de satisfação por cliente/serviço + insumo de depoimento para o site (nota 9–10 → pedir review no Google).

**Como fazer:**
1. Tabela `nps_responses` (cliente, atendimento, nota, comentário) + página pública `/nps/:token`.
2. Envio: linha na central (5.1) e/ou anexado ao e-mail de pós-atendimento (5.2).
3. Nota 9–10 → tela de agradecimento oferece o link de review do Google (5.3); nota ≤6 → alerta na Home para a dona agir.
4. Média NPS no dashboard (4.5).

---

## Etapa 6 — Alcance: booking público, PWA e onboarding  ·  GRÁTIS  ·  4–6 semanas

*O cliente final agenda sozinho; o app instala como app; a conta nova se ativa sem toque humano.*

Fecha a faixa grátis da esteira. Tudo funciona no domínio provisório e migra automaticamente para o definitivo na etapa 7 (URLs relativas). O onboarding com pergunta de segmento é a peça que amarra o posicionamento horizontal ao produto.

### 6.1 Booking page pública + widget
`P1-17` · custo: R$ 0 · tempo: 2–4 sem

**O que é.** Página pública por negócio (ex.: /a/studio-maria) mobile-first: cliente escolhe serviço + horário livre e agenda sozinho. Inclui perfil leve (bio, fotos, serviços) e widget embutível para quem já tem site.

**O que faz.** +33% de receita por cliente; 46–58% dos agendamentos acontecem com o negócio fechado; 94% preferem quem tem agendamento online. Base de todos os players do benchmark, do Square ao Prit.

**Como fazer:**
1. Rota pública no Worker com slug configurável; lê via anon key + policies públicas read-only cuidadosas.
2. Slots calculados das regras de disponibilidade (3.1): horário de trabalho − agendamentos − buffers − antecedência.
3. Confirmar cria atendimento status scheduled + notifica a dona (e-mail 5.2 / badge Home); Turnstile contra abuso.
4. Política de confirmação configurável: auto-confirma ou aprovação manual.
5. Cancelar/remarcar pelo link do próprio agendamento (token) — reduz WhatsApp manual.
6. Widget `<iframe>`/script de embed + QR code pronto para bio do Instagram.
7. SEO local básico: schema.org LocalBusiness na página pública.

### 6.2 Fila de espera com liberação de vaga
`P2-33` · custo: R$ 0 nesta fase · tempo: 1 sem

**O que é.** Cliente entra na fila de um horário cheio; cancelamento dispara oferta automática com tempo de expiração — por e-mail/notificação nesta fase, WhatsApp quando a Cloud API chegar.

**O que faz.** Recupera 60–70% dos cancelamentos de última hora (benchmark Zenoti: US$ 780k/ano em 18k conversões). GlossGenius preenche 12% mais horários com isso.

**Como fazer:**
1. Tabela `waitlist_entries` (cliente, serviço, período preferido, criado_em).
2. Entrada pela booking page (horário cheio → "entrar na fila") e pelo app.
3. Trigger no cancel: oferece a vaga ao primeiro da fila por e-mail com link de confirmação e expiração (ex.: 2h); expirou, passa ao próximo.
4. Painel simples da fila na Agenda.

### 6.3 PWA completo: offline leve + push
`P2-34` · custo: R$ 0 · tempo: 1 sem

**O que é.** Service worker com cache de assets e leitura offline básica, Web Push para a dona (lembretes/alertas) e manifest corrigido.

**O que faz.** Responde o "tem app?" sem app store — instala na tela inicial com ícone e abre standalone. Push substitui parte dos SMS que os concorrentes cobram.

**Como fazer:**
1. Service worker stale-while-revalidate para assets; fallback offline da Home/Agenda (dados do último load).
2. Corrigir site.webmanifest (start_url, theme_color) — pendência conhecida.
3. Web Push via Worker: novo agendamento do booking, conta a vencer, estoque crítico (opt-in por tipo).
4. Banner "instalar app" no primeiro uso mobile.

### 6.4 Onboarding self-service com pergunta de segmento
`P1-24 + benchmark` · custo: R$ 0 · tempo: 1–2 sem

**O que é.** Wizard de primeiro acesso no padrão SimplyBook: 1 pergunta de segmento ("com o que você trabalha?") que pré-configura serviços típicos, template de ficha (3.3) e vocabulário; depois horários, WhatsApp e checklist de ativação.

**O que faz.** Trial → ativação sem toque humano (motion PLG obrigatória no segmento: CAC máximo ≈ R$ 225). A pergunta de segmento é o que faz o produto horizontal parecer feito sob medida para cada nicho.

**Como fazer:**
1. Wizard 4 passos: segmento → serviços sugeridos do nicho (editáveis) → horários de trabalho → número de WhatsApp.
2. Seed por segmento: serviços típicos com duração/preço sugeridos + template de ficha do nicho + categorias financeiras.
3. Dados de exemplo opcionais ("quero explorar antes") com botão limpar.
4. Checklist de ativação persistente no dashboard: 1º cliente, 1º agendamento, 1ª ficha, booking publicado.
5. Gravar o segmento no user_settings — alimenta analytics, templates e futuros defaults.
6. Abertura real de signups fica para a etapa 8 (junto do trial/billing); até lá o wizard roda para contas do beta.

### 6.5 Escala técnica: RPCs, paginação, testes, CI
`P2-35` · custo: R$ 0 · tempo: 1–2 sem

**O que é.** Pagar os atalhos deliberados antes que mordam: movimentação de estoque vira RPC atômica, paginação server-side nos módulos "carrega tudo", índices e testes das RPCs.

**O que faz.** Multi-dispositivo sem corrida e app rápido com milhares de registros — o risco técnico apontado na análise de custos não é preço, é o padrão load-all.

**Como fazer:**
1. Os 11 comentários `ponytail:` no código marcam os pontos exatos — varrer e resolver um a um.
2. RPC atômica de movimentação de estoque (fim do read-then-write client-side).
3. Paginação/agregação server-side em Clientes, Histórico e Financeiro.
4. Testes SQL das RPCs críticas (pacotes, procedimentos, restore) + CI já roda node --check.

### 6.6 Sentry + alerta do backup
`P2-36` · custo: R$ 0 (free tier) · tempo: ½ dia

**O que é.** Error tracking no front e no Worker; alerta se o backup semanal no Drive falhar (hoje é silencioso).

**O que faz.** Você fica sabendo dos erros antes da cliente reclamar.

**Como fazer:**
1. Sentry free: SDK browser no app.html + integração no Worker.
2. Catch do cron de backup → e-mail/notificação em falha (Resend já configurado).
3. Alerta de billing/quota do Supabase (dashboard → notifications).

### 6.7 Ambiente de staging
`P2-37` · custo: R$ 0 (free tiers) · tempo: 1 dia

**O que é.** Worker de staging (wrangler env) + projeto Supabase separado com seed — testar migrations e features sem medo.

**O que faz.** Deploy seguro. Hoje todo teste é em produção com as 3 usuárias reais.

**Como fazer:**
1. `wrangler.jsonc`: env.staging com workers.dev próprio.
2. Projeto Supabase free de staging + script de seed (reusa o seed demo da 2.4).
3. Fluxo: feature → staging → aceite → produção. Migrations versionadas (supabase migration) em vez do schema.sql idempotente.

---

## Etapa 7 — Marca: nome, domínio e formalização  ·  🔒 MARCA  ·  2–3 semanas + processos

*🔒 O portão. Destrava quando o nome estiver definido — tudo antes roda sem ele.*

Único bloqueio real da esteira. O naming agora pode (e deve) refletir o posicionamento horizontal — o nome não precisa amarrar em estética. Custos pequenos: domínio ~R$ 40/ano + jurídico pontual.

### 7.1 Naming sprint: decidir o nome
`novo · pré-req do rebrand` · custo: R$ 0 (INPI ~R$ 142/classe se registrar) · tempo: 3–5 dias

**O que é.** Processo estruturado para sair de "Harmon IA" (provisório) para o nome definitivo — agora com brief horizontal: elegante, curto, pronunciável em PT, sem prender em estética.

**O que faz.** Destrava TODA a etapa 7 — domínio, CNPJ, legais, OAuth. É o item que está segurando o resto.

**Como fazer:**
1. Brief de 1 página: posicionamento "hora marcada com elegância", tom da marca (rosé, sofisticado, acolhedor), critérios (2–3 sílabas, .com.br livre, @ livre no Instagram, sem colisão INPI classe 42).
2. Gerar 30–50 candidatos (brainstorm + IA), sem julgar.
3. Filtro objetivo: busca INPI (marca), Registro.br (domínio), Instagram/TikTok (@), Google (colisões) → shortlist de 5.
4. Teste rápido com 5–10 pessoas do público-alvo: pronúncia, memorização, associação.
5. Decidir. Logo/wordmark vem depois do nome (mesma identidade visual, só o símbolo).
6. Registrar a marca no INPI (classe 42, software) — pode correr em paralelo ao resto.

### 7.2 CNPJ + revisão jurídica das legais
`P1-22` · custo: R$ 1–3k (jurídico) · tempo: 1 sem + prazos

**O que é.** Abrir a empresa (SaaS não cabe em MEI — SLU/ME no Simples, com contador), preencher os [PREENCHER] de razão social/CNPJ/DPO nas páginas legais e passar termos + privacidade por revisão jurídica.

**O que faz.** Destrava billing (CNPJ para o gateway), OAuth (privacidade final) e credibilidade — hoje as legais se declaram rascunho.

**Como fazer:**
1. Contador: abrir SLU no Simples (anexo III/V conforme fator R) — 1 semana típica.
2. Preencher os 3 [PREENCHER] (razão social, CNPJ, contato DPO) em privacidade/termos/cookies.html + rodapé.
3. Advogado: revisão pontual de termos + privacidade (LGPD art. 11 — dado sensível de saúde nos segmentos clínicos).
4. Conta PJ (banco digital) para o gateway da etapa 8.

### 7.3 Domínio próprio + e-mail corporativo
`P1-21` · custo: ~R$ 40/ano · tempo: 2h + propagação

**O que é.** Registrar o domínio do nome novo no Registro.br e apontar para a Cloudflare; e-mail corporativo via Email Routing (grátis).

**O que faz.** Marca, SEO, deliverability e pré-requisito da verificação OAuth. Sai do workers.dev.

**Como fazer:**
1. Registro.br: registrar o .com.br (~R$ 40/ano). Cloudflare Registrar não suporta .br — registra lá e aponta o DNS pra Cloudflare (grátis).
2. Adicionar a zona na Cloudflare (proxied) e rotear o Worker pro domínio (custom domain).
3. Email Routing: contato@dominio → seu Gmail; remetente verificado no Resend (destrava o e-mail de confirmação pro lead).
4. Atualizar: canonical/OG/sitemap, Redirect URLs no Supabase, redirect URIs no Google Cloud, hostname do Turnstile.
5. Agora sim: regras de WAF/Rate Limiting por zona em /api/* (a pendência do P0 que não aplicava em workers.dev) + scan securityheaders.com.

### 7.4 Rebrand global no código e no site
`P1-22 execução` · custo: R$ 0 · tempo: 2–3 dias

**O que é.** Troca do nome/wordmark em todos os pontos mapeados desde a Fase 2 do plano do site.

**O que faz.** Marca consistente em produto, site, metadados e stores de busca.

**Como fazer:**
1. Varredura mapeada: wordmark do header, titles, og:site_name, rodapé, monograma do favicon/og-image, manifest, textos legais, README.
2. Gerar favicon/ícones/og-image novos com o logo definitivo.
3. E-mail de anúncio pra waitlist ("agora somos X") — primeiro uso do remetente próprio.
4. Atualizar templates de e-mail (5.2) com a marca nova.

### 7.5 Verificação OAuth do Google
`P1-23` · custo: R$ 0 · tempo: 1–2 sem (processo)

**O que é.** O app usa scopes sensíveis (Calendar, Contacts). Sem verificação: cap de 100 usuários e tela "app não verificado" que mata conversão.

**O que faz.** Login Google sem fricção para usuários ilimitados. Processo demora — iniciar assim que domínio + privacidade final existirem.

**Como fazer:**
1. Google Cloud Console → OAuth consent screen: domínio verificado, política de privacidade final, links da home.
2. Vídeo demo do uso de cada scope + justificativa escrita (Calendar = espelho da agenda; Contacts = espelho de clientes; drive.file = backup).
3. Submeter e acompanhar (idas e voltas por e-mail são normais).
4. Enquanto pende: o login e-mail/senha (3.2) segura a conversão sem fricção.

### 7.6 E-mail de confirmação pro lead + réguas do domínio
`P0-9 fase 2` · custo: R$ 0 · tempo: ½ dia

**O que é.** Com remetente verificado: e-mail "você está na lista" para cada lead (hoje só existe o aviso interno).

**O que faz.** Loop de reengajamento aberto no momento de maior interesse — o lead não esfria até o lançamento.

**Como fazer:**
1. Verificar o domínio no Resend (DKIM/SPF via DNS na Cloudflare).
2. Template "você está na lista" + o que esperar + link de indicação (waitlist com referência).
3. Sequência leve: confirmação → 1 e-mail de bastidores/mês até o lançamento.

---

## Etapa 8 — Lançamento: cobrar, automatizar, emitir  ·  PAGO  ·  6–9 semanas

*O motor de receita — e os primeiros custos variáveis (todos repassáveis no preço).*

Com produto completo e marca no ar, liga a monetização: assinatura com trial, WhatsApp oficial, pagamentos e NFS-e. Custo fixo do stack ≈ R$ 140–350/mês; break-even em ~5 assinantes (análise de custos). O gancho regulatório da NFS-e nacional (ago–set/2026) marca a data do lançamento.

### 8.1 Supabase Pro
`análise §2` · custo: US$ 25/mês (~R$ 135) · tempo: 10 min

**O que é.** Upgrade do projeto no primeiro cliente pagante (ou antes do lançamento).

**O que faz.** Backup diário gerenciado 7d, sem pausa por inatividade, 8 GB de banco (2.000 clientes usam 6), suporte.

**Como fazer:**
1. Dashboard Supabase → upgrade para Pro.
2. Desligar o spend cap (com cap ligado o serviço degrada em vez de cobrar) e configurar alertas de billing.
3. Testar restore de um backup gerenciado (rito trimestral).

### 8.2 Pricing público + trial 35 dias + billing
`P1-20 + análise §6` · custo: taxas do gateway (2,99% + R$ 0,49) · tempo: 1–2 sem

**O que é.** Publicar a escada Começo R$ 24,90 / Profissional R$ 54,90 / Estúdio R$ 99,90 (margens 83%/78%/60% validadas na análise), trial 35 dias sem cartão, cobrança recorrente via Asaas.

**O que faz.** O motor de receita self-service. Trial sem cartão converte 8,9–18% (benchmark). Preço público é a regra comercial nº 1 contra os incumbentes de "sob consulta".

**Como fazer:**
1. Abrir conta Asaas PJ (CNPJ da 7.2); módulo de assinaturas (grátis; cartão recorrente 2,99% + R$ 0,49 — melhor que Stripe BR).
2. Signups abertos no Supabase + gating suave: banner de dias restantes do trial, bloqueio gentil no fim.
3. Checkout hospedado do Asaas + webhook de status no Worker (ativo/inadimplente/cancelado).
4. Página de planos com preço real, fair-use de WhatsApp por plano (150/600 msgs) e "Estúdio" com preço + aviso de fila (até a etapa 9 destravar).
5. Regras que viram marketing: sem multa, sem implantação, anual -20%, migração grátis.

### 8.3 WhatsApp oficial (Cloud API): confirmação + lembretes
`P1-15 · Parte 2 fase 2` · custo: ~R$ 0,04/msg utility (grátis na janela 24h) · tempo: 2–3 sem

**O que é.** Confirmação na hora + lembretes 24h/2h com botões Confirmar/Remarcar, via WhatsApp Business Cloud API (Meta, oficial — sem risco de ban).

**O que faz.** Reduz no-show em 30–70% (leitura ~98%). A maior arbitragem do mercado BR: concorrentes cobram R$ 150–229/mês de add-on — aqui vem incluso com fair-use. Os fluxos da etapa 5 só trocam de canal.

**Como fazer:**
1. App Meta + número business dedicado + verificação do negócio (usa o CNPJ da 7.2).
2. Templates utility aprovados: confirmação, lembrete véspera, lembrete 2h, parcela a vencer.
3. Fila de envio em tabela + cron no Worker (infra da 5.2 reaproveitada); webhook de status/resposta.
4. Botões: resposta "Confirmar" atualiza o status; "Remarcar" abre o link de remarcação da booking page.
5. Desenhar para a janela grátis: lembrete pede resposta → resposta abre janela de 24h → mensagens seguintes gratuitas (a análise assume 55% fora da janela — dá pra melhorar).
6. Medidor de fair-use por conta (150/600) + pacote extra de 200 msgs por R$ 9,90.

### 8.4 Automações completas: aniversário, reativação, NPS
`P2-32` · custo: custo das msgs (e-mail = R$ 0) · tempo: 1 sem

**O que é.** Painel de automações liga/desliga por tipo: aniversário (com oferta opcional), reativação 60–90 dias, NPS — e-mail como canal padrão, WhatsApp fair-use como upgrade.

**O que faz.** Aniversário: +481% em transações por mensagem; reativação recupera 15–25% dos inativos. A decisão e-mail-default derruba o custo variável de R$ 9 para ~R$ 4/cliente.

**Como fazer:**
1. Painel em Configurações: cada automação com canal (e-mail/WhatsApp), horário e template.
2. Cron diário unificado (5.2 + 8.3) com log e opt-out por cliente.
3. Reativação usa a régua que já existe no Histórico (60/90 dias) — automatizar o disparo.
4. Relatório simples: enviadas × respondidas × agendamentos gerados (o case que vira marketing).

### 8.5 Pagamentos online + sinal anti no-show
`P2-27` · custo: % por transação (Pix ~0,99%) · tempo: 2–3 sem

**O que é.** Link de pagamento/Pix por atendimento e sinal configurável no booking (ex.: 30% para reservar) via Asaas/Mercado Pago.

**O que faz.** Pix = 76% dos consumidores; pré-pagamento derruba no-show em até 95% (claim do Prit — o benchmark horizontal confirma como diferencial nº 1). Table-stakes 2026.

**Como fazer:**
1. Cobrança por atendimento: QR Pix / link no detalhe do agendamento e na confirmação do booking.
2. Sinal no booking: % configurável por serviço; slot só confirma com sinal pago.
3. Webhook concilia automático em financial_entries (paga a fase 1 da conciliação 4.8).
4. Política de cancelamento/no-show ligada ao sinal (retenção configurável) — padrão Square/GlossGenius.

### 8.6 NFS-e nacional: "conecte seu Asaas"
`P2-28 + análise §5` · custo: R$ 0 p/ plataforma (R$ 0,49/nota paga pela cliente) · tempo: 2–3 sem

**O que é.** Emissão de NFS-e ao concluir atendimento usando a conta Asaas DA PRÓPRIA CLIENTE (modelo decidido na análise de custos — evita o modelo caro por CNPJ do Focus).

**O que faz.** NFS-e nacional obrigatória: autônomos 01/08/2026, Simples 01/09/2026. "Emita automático antes do prazo" é o gancho de aquisição com data marcada do lançamento.

**Como fazer:**
1. Configurações: conectar conta Asaas (API key da cliente) + dados fiscais (CNPJ, código de serviço, ISS).
2. Emissão no complete_procedure (automática opt-in ou botão "emitir nota") + painel de notas do mês.
3. Tratamento de erro fiscal (fila de retry + aviso claro).
4. Conteúdo/SEO casado: guia "NFS-e nacional para autônomas" nas páginas de segmento (tráfego com prazo).

### 8.7 Blog/SEO + páginas comparativas
`P2-38` · custo: R$ 0 · tempo: contínuo

**O que é.** Conteúdo orgânico ("como reduzir faltas", "NFS-e para esteticista/tatuador") e páginas "X vs Trinks/Belle/Clinicorp" com comparação honesta de custo real.

**O que faz.** Canal de aquisição sem mídia paga; comparativos capturam quem já quer trocar de sistema. Precisa do domínio (por isso está aqui e não antes).

**Como fazer:**
1. Estrutura de blog estático no padrão do site (sem build), schema.org Article.
2. 2 posts/mês guiados pelo funil do PostHog (2.5): temas dos segmentos que mais convertem.
3. Páginas comparativas com a tabela de custo real (add-ons, multa, trial) — atualizar por trimestre.

---

## Etapa 9 — Equipe e escala: o ticket maior  ·  PAGO  ·  2–3 meses

*Orgs, comissões, salas — destrava o plano Estúdio prometido no site.*

O maior refactor do roadmap (orgs) e tudo que depende dele. Priorizar guiado pela demanda medida na waitlist do "Estúdio — em breve" (2.4). Código é grátis; está na faixa paga porque só faz sentido com o negócio já cobrando.

### 9.1 Multi-profissional (organizações)
`P2-26` · custo: R$ 0 · tempo: 4–6 sem

**O que é.** Organizações com membros e papéis (dono/profissional/recepção), agenda por profissional, permissões. O modelo hoje é 1 conta = 1 tenant.

**O que faz.** Destrava o plano Estúdio (R$ 99,90 + R$ 29,90/profissional) e o mercado de clínicas/studios. Maior item arquitetural do plano — a análise §7 descarta atalhos (risco de vazamento entre contas).

**Como fazer:**
1. Tabelas `orgs`/`members` (papéis) + `org_id` nas ~12 tabelas.
2. Reescrita das policies RLS: de user_id para org + papel — com testes SQL de isolamento antes de migrar.
3. Migração automática: cada conta atual vira org de 1 membro.
4. Convites por e-mail (Supabase Auth) + tela de equipe.
5. Agenda por profissional (filtro/cores) na Agenda e no booking (cliente escolhe o profissional).
6. /code-review ultra antes do merge — é o refactor mais arriscado do plano.

### 9.2 Comissões por profissional
`P2-29` · custo: R$ 0 · tempo: 1–2 sem

**O que é.** Percentual por profissional/serviço, cálculo automático no fechamento, relatório mensal — com rateio opcional da taxa de cartão (padrão Trinks, o motor mais completo do benchmark).

**O que faz.** Table-stakes do plano de equipe; área onde Avec/Clinicorp colecionam reclamações de cálculo errado — confiabilidade vira argumento.

**Como fazer:**
1. Tabela `commission_rules` (profissional × serviço × %, base bruto/líquido).
2. Linha de comissão gerada no complete_procedure; ajuste manual com trilha.
3. Fechamento mensal por profissional: bruto, descontos, taxa rateada (4.3), base, %, valor final — o relatório do Trinks como referência.
4. Visão do profissional (papel membro): só as próprias comissões.

### 9.3 Salas e equipamentos (recursos na agenda)
`novo · benchmark` · custo: R$ 0 · tempo: 1 sem

**O que é.** Recurso escasso além do profissional: sala, maca, laser. Serviço pode exigir tipo de recurso; agenda checa conflito.

**O que faz.** Evita duas clientes no mesmo laser. Requisito do tenant clínica que paga o ticket maior (Square cobra isso no plano Premium).

**Como fazer:**
1. Tabela `resources` (org, nome, tipo sala|equipamento, cor) + `resource_id` no agendamento.
2. Campo "exige recurso do tipo X" em serviços.
3. Checagem de sobreposição na RPC de agendar (lock) + filtro por recurso na agenda.
4. Booking (6.1) só oferece slots com recurso livre.

### 9.4 Fechamento de caixa diário
`novo · benchmark` · custo: R$ 0 · tempo: 3–5 dias

**O que é.** Ritual de abrir/fechar o caixa do dia com conferência por forma de pagamento e diferença apurada — relevante quando há recepção/equipe.

**O que faz.** Controle antifurto/antierro com equipe; lançamentos de dias fechados ficam travados.

**Como fazer:**
1. Tabela `cash_sessions` (data, esperado por forma, conferido por forma, diferença).
2. "Fechar o dia" agrega os lançamentos pagos por payment_method; usuária digita o conferido.
3. Policy: lançamentos com paid_at ≤ último fechamento ficam read-only.
4. Relatório de diferenças no dashboard.

### 9.5 Split de pagamento (Lei Salão Parceiro)
`P3-40` · custo: via gateway · tempo: 2 sem

**O que é.** Divisão automática na fonte entre negócio e profissional parceiro (Lei 13.352/2016), via split nativo do Asaas/MP sobre as regras de comissão.

**O que faz.** Comissão cai direto na conta de cada um — recurso que só os grandes têm (Avec Pay, Trinks/Stone).

**Como fazer:**
1. Subcontas/recebedores no gateway por profissional.
2. Split configurado a partir das commission_rules (9.2).
3. Conciliação do split no financeiro + termos da Lei Salão Parceiro no contrato.

### 9.6 Multiunidade
`P3-43` · custo: R$ 0 · tempo: 4–8 sem

**O que é.** Uma org, várias unidades: estoque, agenda, caixa e relatórios por unidade + consolidado.

**O que faz.** Abre o segmento de redes pequenas (ticket 2–3x). Só depois das orgs maduras.

**Como fazer:**
1. Camada `location_id` sobre o modelo de orgs (9.1).
2. Seletor de unidade no shell; relatórios com filtro unidade/consolidado.
3. Estoque e booking por unidade.

---

## Etapa 10 — Diferenciais de retenção e LTV  ·  PAGO  ·  2–3 meses

*Memberships, portal do cliente e integrações que seguram a assinante.*

Depois do lançamento rodando: os itens que aumentam LTV do cliente final (e da assinante). Ordem flexível — puxar pelo que os dados de uso pedirem.

### 10.1 Memberships + cashback + gift cards + cupons
`P3-39 ampliado` · custo: R$ 0 (cobrança via gateway) · tempo: 3–4 sem

**O que é.** Assinaturas recorrentes de tratamento (créditos com rollover, padrão Boulevard), cashback com aviso de saldo, vale-presente e cupons de desconto (padrões Goldie/Acuity/SimplyBook do benchmark horizontal).

**O que faz.** Membros: ~3x visitas, +35% gasto, 3,5x LTV; cashback faz a cliente voltar 22 dias antes; gift card é receita antecipada.

**Como fazer:**
1. Tabelas `subscriptions` + wallet de créditos (rollover configurável) + cobrança recorrente no gateway.
2. Cashback: % por atendimento vira saldo; aviso automático de saldo via automações (8.4).
3. Gift cards: emissão com código, resgate no caixa; cupons: código, validade, % — aplicáveis no booking.
4. Retry de cobrança falhada (dunning) — o detalhe que diferencia o Boulevard.

### 10.2 Portal do cliente final
`P3-44` · custo: R$ 0 · tempo: 4–6 sem

**O que é.** Área do cliente via magic link: histórico, saldo de pacote/cashback, próximos horários, remarcação, fichas para preencher em casa.

**O que faz.** Reduz o WhatsApp manual do negócio e aumenta a percepção de profissionalismo (padrão SimplyBook client app / Prit Consumidor).

**Como fazer:**
1. Auth por magic link (token por e-mail/WhatsApp) — sem senha.
2. Read-only do próprio subset: atendimentos, pacotes, cashback, fichas pendentes.
3. Remarcar/cancelar dentro das regras de antecedência.
4. PWA instalável com o tema do negócio (cores/logo).

### 10.3 Ghost overlay na câmera (antes/depois padronizado)
`P3-41` · custo: R$ 0 · tempo: 1 sem

**O que é.** Ao fotografar o "depois", a foto "antes" aparece sobreposta translúcida para replicar ângulo e enquadramento (padrão RxPhoto).

**O que faz.** Antes/depois comparável de verdade — documentação premium que nenhum player BR pequeno tem.

**Como fazer:**
1. `getUserMedia` + overlay da última foto com opacidade 50%.
2. Grade de alinhamento opcional; captura direto pra galeria do atendimento (3.4).

### 10.4 Import Mercado Livre (estoque)
`P3-42 · Parte 4` · custo: R$ 0 · tempo: 1–2 sem

**O que é.** Colar link do ML e importar nome/foto/preço do produto. A API do ML exige OAuth server-side — proxy no Worker.

**O que faz.** Cadastro de produto em segundos; casa com a lista de compras que já tem links de recompra.

**Como fazer:**
1. App de dev no Mercado Livre (client id/secret como secrets do Worker).
2. Endpoint proxy: recebe URL, extrai MLB-id, chama a API com token renovável, devolve JSON normalizado.
3. estoque.js: campo "colar link do ML" no form + preencher campos (avisar que unidades/embalagem nem sempre vêm).

### 10.5 Conciliação fase 2: Open Finance
`novo · benchmark fase 2` · custo: Pluggy/Belvo (por conexão) · tempo: 1–2 sem

**O que é.** Conexão direta com o banco via agregador (Pluggy/Belvo): extrato entra sozinho, matching automático — a fase OFX (4.8) vira fallback.

**O que faz.** A conciliação da Conta Azul ("economia de 20h/mês") dentro do vertical. Diferencial forte no plano superior.

**Como fazer:**
1. Avaliar Pluggy vs Belvo (custo por conexão ativa) e o plano em que a feature entra (Profissional+?).
2. Webhook de transações novas → fila de matching da 4.8.
3. Consentimento e renovação de conexão (Open Finance expira) com aviso.

### 10.6 Assinatura eletrônica reforçada (Clicksign/D4Sign)
`P3-45` · custo: ~R$ 1–2/doc · tempo: 3 dias

**O que é.** Upgrade opcional do termo assinado: carimbo de tempo e ICP para clínicas maiores que exigirem validade jurídica reforçada.

**O que faz.** Compliance premium; o canvas + hash próprio (3.3) já atende o caso comum.

**Como fazer:**
1. Integração por documento, acionada só se a conta ativar.
2. Cobrar como custo repassado ou embutir no plano topo.

---

## Etapa 11 — IA e plataforma: a fronteira  ·  PAGO  ·  6–12 meses

*Onde Fresha/Zenoti estão hoje — com 12–24 meses de vantagem local.*

Visão de longo prazo. O agente de WhatsApp é o único add-on aceitável no posicionamento "tudo incluso" (tem custo variável real de LLM). Tudo aqui pressupõe as etapas anteriores rodando com dados.

### 11.1 Agente IA no WhatsApp 24/7
`P4-46` · custo: LLM por conversa (add-on R$ 79–99) · tempo: 6–10 sem

**O que é.** Recepcionista IA que responde, agenda, reagenda e tira dúvidas sozinha no WhatsApp do negócio, com escalação para humano.

**O que faz.** Fronteira internacional (Fresha AI Concierge, Zenoti AI, Goldie AI Receptionist); lift de 30–50% em agendamentos — 46–58% dos contatos chegam fora do horário.

**Como fazer:**
1. Claude API + tools: disponibilidade (3.1), serviços, booking (6.1), FAQ do negócio.
2. Guardrails: nunca inventa preço/horário; handoff para humano com resumo; log completo.
3. Piloto com 3–5 contas do beta medindo conversão antes de abrir.
4. Cobrança como add-on pelo custo variável (o único add-on do posicionamento).

### 11.2 IA de atendimento e previsão
`P4-47` · custo: LLM por uso · tempo: 4–6 sem

**O que é.** Rascunho automático da evolução na ficha pós-atendimento (ambient scribe estilo Jane/Pabau), score preditivo de no-show por cliente e previsão de consumo de estoque pela agenda futura.

**O que faz.** Diferencial defensável que nenhum player BR pequeno tem — e alimenta decisões (sinal obrigatório só pra quem tem score alto de falta).

**Como fazer:**
1. Rascunho de evolução: Claude API sobre a ficha + histórico (com consentimento explícito, dado sensível).
2. Score de no-show: heurística sobre histórico (faltas, antecedência, clima de resposta) — começa sem LLM.
3. Previsão de estoque: consumo médio por serviço × agenda futura → sugestão na lista de compras.

### 11.3 API pública + webhooks
`P4-48` · custo: R$ 0 · tempo: 3–4 sem

**O que é.** API keys por tenant, webhooks de eventos (agendamento criado, pagamento recebido) e integração Zapier/Make.

**O que faz.** Ecossistema e lock-in positivo; requisito de clientes maiores.

**Como fazer:**
1. Gateway no Worker com rate limit por key.
2. Webhooks assinados (HMAC) com retry.
3. Docs públicas + coleção de exemplos; app no Zapier/Make.

### 11.4 Marketplace / vitrine de descoberta
`P4-49` · custo: alto · tempo: trimestres

**O que é.** Diretório público dos negócios com agendamento direto — o motor de demanda que faz Trinks/Fresha/Booksy crescerem.

**O que faz.** Vira canal de aquisição para os próprios clientes (e moat de rede). Só faz sentido com massa crítica de booking pages.

**Como fazer:**
1. Agregado público das booking pages (6.1) com busca por segmento/cidade — os anéis da etapa 2 viram categorias.
2. SEO local pesado (schema.org, páginas por cidade+segmento).
3. Avaliar modelo comercial (incluso vs comissão por cliente novo — Fresha cobra 20%).

---

## Apêndice A — Gates do usuário

| Gate | Quando | Suas ações |
|---|---|---|
| 0 | antes de tudo | Etapa 1 completa (P0 manual: redirect URL, signups off, deploy, migração, rotação, Turnstile, analytics, Resend, testes) |
| 1–6 | fim de cada onda de agentes | Rodar `db/migration-onda-N.sql` no Supabase, checklist de teste do relatório (`docs/relatorios/onda-N.md`), merge da branch |
| plugs | ondas 1 e 6 | POSTHOG_KEY, DSN Sentry, projeto Supabase de staging, screenshots com o seed |

## Apêndice B — Planos absorvidos (histórico)

- **PLANO-SITE-PROFISSIONAL** (04/07/2026): fases 1–4 concluídas (SEO, legais LGPD rascunho, CSP/HSTS, a11y 100/SEO 100). Pendências vivas migraram pra esteira (7.2 legais finais, 7.3 domínio).
- **DIAGNOSTICO-SITE** (04/07/2026): 100% executado via plano do site.
- **APRIMORAMENTOS-PENDENTES**: itens 1–4 de UI e Parte 1 (Google) concluídos. Parte 2 → itens 5.1/8.3 · Parte 3 → 3.1/3.2 · Parte 4 → 10.4 · Parte 5 → 4.3.
- **P0-CHECKLIST** (18/07/2026): código no repo; passos manuais = Etapa 1 da esteira.
- **PLANO-MASTER** (18/07/2026, 49 itens): totalmente absorvido pela esteira; estratégia condensada acima; benchmark de 26+ concorrentes somou 12 itens novos.

## Apêndice C — Referências vivas

- `plano-master.html` — visualização interativa desta esteira (mesmos 68 itens).
- `PLANO-EXECUCAO-AGENTES.md` — contrato de orquestração das ondas 1–6.
- `ANALISE-CUSTOS-PRICING.md` + `simulador-custos.html` — custos, personas, margens.
- `HISTORICO.md` — changelog de implementação.
- `SETUP.md` / `ESTRUTURA.md` — setup e mapa do código.

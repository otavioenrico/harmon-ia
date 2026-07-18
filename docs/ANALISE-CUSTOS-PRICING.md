# Análise de custos e pricing — Harmon IA

**Data:** 18/07/2026 · **Método:** simulação de 30 personas sintéticas sobre o schema real (`db/schema.sql`) e os padrões de acesso do app, × preços oficiais verificados (Supabase, Cloudflare, Meta/WhatsApp, Resend, Asaas, Focus NFe, Stripe — fontes abaixo).
**Simulador interativo:** `docs/simulador-custos.html` · **Scripts reproduzíveis:** a simulação foi gerada por script Python determinístico (seed fixa) — os números abaixo são recalculáveis.

---

## 1. Resposta curta (TL;DR)

| Pergunta | Resposta |
|---|---|
| Quanto custa manter a operação HOJE (beta, sem WhatsApp)? | **~R$ 5/mês** (domínio; Supabase Free + Workers Free aguentam o beta) |
| Quanto custa a operação no lançamento? | **~R$ 140/mês fixo** (Supabase Pro US$ 25 + domínio) |
| Quanto custa 1 cliente ativo (autônoma mediana, com WhatsApp automático)? | **R$ 9,08 variável + R$ 1,68 de billing** ≈ **R$ 11-12/mês** com fixo amortizado |
| Quanto custa 1 cliente HOJE (sem WhatsApp)? | **< R$ 2/mês** (praticamente só billing) |
| Break-even do custo fixo | **5 assinantes** a R$ 39,90 |
| Dá pra cobrar menos de R$ 100? | Sim, com folga: margem bruta de **83%** a R$ 24,90 e **78%** a R$ 54,90 |
| Team funciona hoje? | **Não como plano de verdade** — só como conta compartilhada (1 login). Plano coletivo real exige o refactor de organizações (4-6 semanas, item P2-26 do Plano Master). Vender "Estúdio — em breve" até lá. |

O grande achado: **o WhatsApp que os concorrentes vendem por R$ 150-229/mês custa R$ 0,037 por mensagem utility** — e é **grátis** dentro da janela de 24h aberta pelo cliente. O nosso "tudo incluso" é economicamente confortável.

---

## 2. Preços de infra verificados (18/07/2026, câmbio R$ 5,40)

| Serviço | Preço | Observação |
|---|---|---|
| Supabase Free | R$ 0 | 500 MB DB, 1 GB storage, 5 GB egress, 50k MAU; **pausa após 1 semana inativo**; sem backup |
| Supabase Pro | US$ 25 ≈ R$ 135 | 8 GB DB (+US$ 0,125/GB), 100 GB storage (+US$ 0,0213/GB), 250 GB egress (+US$ 0,09/GB), 100k MAU, backup diário 7d, crédito cobre compute Micro |
| Supabase compute Small | +US$ 5 líquido | prudente acima de ~800 clientes ativos |
| Cloudflare Workers Free | R$ 0 | 100k req/dia; **static assets grátis e ilimitados em qualquer plano** |
| Cloudflare Workers Paid | US$ 5 | 10M req/mês — só necessário com milhares de clientes |
| Turnstile / Web Analytics / Email Routing | R$ 0 | free cobre tudo no nosso porte |
| Domínio .com.br (Registro.br) | R$ 40/ano | Cloudflare Registrar não suporta .br — registra no Registro.br e aponta o DNS pra Cloudflare (grátis) |
| **WhatsApp Cloud API (Meta, BR)** | utility/auth **US$ 0,0068 ≈ R$ 0,037/msg** · marketing **US$ 0,0625 ≈ R$ 0,34/msg** | por mensagem de template entregue (desde jul/2025); **service e utility dentro da janela de 24h = grátis**; sem mensalidade da Meta |
| Resend | free 3.000 e-mails/mês (100/dia) · Pro US$ 20 (50k) | free aguenta ~1.000 clientes com 3 e-mails/mês |
| NFS-e — Focus NFe | R$ 89,90/mês (100 notas, 1 CNPJ) + R$ 0,10/nota | modelo por CNPJ emissor — caro pra revender |
| **NFS-e — Asaas** | **R$ 0,49/nota, sem mensalidade** | na conta Asaas **do próprio cliente** → custo nosso: R$ 0 |
| Pix — Asaas / Mercado Pago / Efí | R$ 1,99 fixo / 0,99% / 1,19% | |
| Billing da assinatura — Asaas | cartão recorrente **2,99% + R$ 0,49**; módulo de assinatura grátis | melhor que Stripe BR (3,99% + R$ 0,39 + 0,7% Billing) |
| Google Calendar/People/Drive | R$ 0 | 1M req/dia no Calendar — nunca é gargalo |

Fontes: supabase.com/pricing · developers.cloudflare.com/workers/platform/pricing · developers.facebook.com/docs/whatsapp/pricing · resend.com/pricing · focusnfe.com.br/precos · asaas.com/precos-e-taxas · stripe.com/br/pricing · registro.br/precos.

---

## 3. As 30 personas

Cinco segmentos, do público-alvo (autônoma) ao teto (clínica). Estado simulado após 12 meses de uso.

### 3a. Painel (resumo — tabela completa no fim do documento)

| Segmento | n | Atend/mês | Clientes | Banco (MB) | Storage hoje (MB) | Fotos P1 (MB/mês) | Egress (MB/mês) | WhatsApp util/mês |
|---|---|---|---|---|---|---|---|---|
| Iniciante solo (Júlia, Camila, Bruna…) | 6 | 12 | 20-60 | 0,3 | 4,0 | 3,5 | 4,6 | 35 |
| Autônoma estabelecida (Renata, Aline…) | 10 | 49 | 80-200 | 1,1 | 7,6 | 14,8 | 20,3 | 148 |
| Intensa solo (Dra. Tayana, Pâmela…) | 6 | 144 | 250-500 | 3,0 | 12,2 | 43,1 | 73,6 | 431 |
| Estúdio 2-3 (Studio Ana & Bia…) | 5 | 311 | 400-900 | 6,3 | 18,0 | 93,3 | 198,6 | 933 |
| Clínica 4-6 (Clínica Renove…) | 3 | 528 | 800-1500 | 10,8 | 34,8 | 158,5 | 494,2 | 1.585 |

### 3b. O "cliente médio"

| Métrica | Média (painel) | Mediana (painel) | Mediana **só autônomas** (público-alvo) |
|---|---|---|---|
| Atendimentos/mês | 152 | 61 | 52 |
| Clientes cadastrados | 344 | 183 | 150 |
| Produtos no estoque | 119 | 92 | 79 |
| Banco após 12 meses | 3,1 MB | 1,2 MB | ~1 MB |
| Storage (fotos produto + NF) | 12,3 MB | 9,7 MB | ~8 MB |
| Fotos clínicas P1 (novo/mês) | 45,6 MB | 18,2 MB | ~16 MB |
| Egress Supabase/mês | 105 MB | 23,5 MB | ~20 MB |
| WhatsApp utility/mês | 456 | 182 | 156 |

**Leitura:** a média é puxada pelos estúdios/clínicas; o público-alvo real (autônoma) consome MUITO pouco. O exemplo do seu prompt (harmonizadora iniciante: 50 produtos, 50 clientes, 4 atendimentos/semana) gasta **0,2 MB de banco/ano** e ~35 mensagens de WhatsApp/mês.

---

## 4. Consumo × limites de infraestrutura

Projeção com mix igual ao painel (pior caso — inclui clínicas):

| Assinantes | Banco total | Storage ano-1 (c/ fotos P1) | Egress/mês | Worker req/dia | Limite relevante |
|---|---|---|---|---|---|
| 30 | 0,1 GB | 17 GB | 3 GB | 838 | tudo no Free (mas Pro recomendado: backup + sem pausa) |
| 100 | 0,3 GB | 56 GB | 10 GB | 2.794 | Pro folgado |
| 500 | 1,6 GB | 280 GB | 52 GB | 13.971 | storage excede 100 GB → +US$ 3,8/mês (irrelevante) |
| 1.000 | 3,1 GB | 560 GB | 105 GB | 27.942 | storage +US$ 9,8/mês; compute Small prudente |
| 2.000 | 6,3 GB | 1.120 GB | 210 GB | 55.884 | ainda dentro do egress do Pro; Workers ainda no free |

**Conclusões estruturais:**
1. **Banco de dados nunca é o custo.** 2.000 clientes = 6 GB (Pro inclui 8).
2. **O único volume que cresce de verdade são as fotos antes/depois (P1)** — e mesmo assim o excedente custa US$ 0,0213/GB: 1 TB acumulado = ~R$ 115/mês. Mitigação barata já na feature: comprimir a ~1280px/webp (~250 KB) e arquivar/reduzir após 24 meses.
3. **Cloudflare é efetivamente grátis até ~3.500 clientes** (static assets não contam na cota).
4. O risco técnico de escala não é preço, é o padrão "carrega tudo e filtra em memória" (egress e latência dos heavy users) — já mapeado como item P2-35.

---

## 5. Custo por cliente ativo (R$/mês, pós-P1 com WhatsApp automático)

| Segmento | WhatsApp utility (pago*) | WhatsApp aniversário/reativação (marketing) | Storage fotos | **Total variável** |
|---|---|---|---|---|
| Iniciante solo | 0,53 | 2,53 | 0,00 | **R$ 3,06** |
| Autônoma estabelecida | 3,15 | 5,91 | 0,02 | **R$ 9,08** |
| Intensa solo | 8,66 | 11,14 | 0,06 | **R$ 19,86** |
| Estúdio 2-3 | 19,41 | 16,88 | 0,13 | **R$ 36,42** |
| Clínica 4-6 | 30,17 | 36,45 | 0,21 | **R$ 66,83** |

\* premissa conservadora: 55% das mensagens utility caem FORA da janela grátis de 24h. Bem desenhado (lembrete pede resposta → resposta abre janela grátis), esse número cai.

**+ Billing da assinatura (Asaas, cartão recorrente):** R$ 1,68 sobre um plano de R$ 39,90 (2,99% + R$ 0,49).

**Custo HOJE (pré-P1, sem WhatsApp): < R$ 2/cliente** — só billing + centavos de infra.

### Cenários de operação (mix autônomas, ticket R$ 39,90)

| Assinantes | Fixo/mês | Variável | Billing | **Custo total** | **Custo/cliente** | MRR | Margem bruta |
|---|---|---|---|---|---|---|---|
| 10 | 138 | 91 | 17 | **R$ 246** | R$ 24,60 | 399 | 38% |
| 30 | 138 | 272 | 50 | **R$ 461** | R$ 15,37 | 1.197 | 61% |
| 100 | 138 | 908 | 168 | **R$ 1.215** | R$ 12,15 | 3.990 | 70% |
| 500 | 165 | 4.540 | 842 | **R$ 5.546** | R$ 11,09 | 19.950 | 72% |
| 1.000 | 192 | 9.079 | 1.683 | **R$ 10.955** | R$ 10,95 | 39.900 | 73% |
| 2.000 | 300 | 18.158 | 3.366 | **R$ 21.825** | R$ 10,91 | 79.800 | 73% |

**Break-even do custo fixo: ~5 assinantes.** A margem estabiliza em ~73% — saudável para SaaS (benchmark 70-85%).

### Alavancas que derrubam o custo variável (de R$ 9 para ~R$ 4)

1. **Aniversário/reativação por E-MAIL como padrão** (Resend ≈ grátis) com WhatsApp opcional — corta os R$ 5,91 de marketing (2/3 do custo!). Marketing via WhatsApp vira feature de plano superior ou fair-use.
2. **Desenhar lembretes para abrir janela**: confirmação com botão → resposta do cliente → mensagens seguintes dentro de 24h = grátis.
3. **NF e Pix na conta Asaas DO CLIENTE** (conecta a própria conta): a nota de R$ 0,49 e a taxa Pix são custo dela, não nosso. Zero custo de NFS-e pra plataforma — e evita o modelo caro do Focus (R$ 89,90/mês por CNPJ).
4. Fotos: compressão no upload + arquivamento >24 meses.

---

## 6. Pricing recomendado

Ancoragem: Agendiva R$ 39,90 · Simples Agenda R$ 39,90 · IterClinic R$ 69 · Trinks R$ 76 · concorrentes cobram WhatsApp como add-on de R$ 150-229. Seu posicionamento: público autônomo, "não posso cobrar R$ 100".

| Plano | Preço mensal | Anual (-20%) | Para quem | O que inclui | Custo típico | Margem |
|---|---|---|---|---|---|---|
| **Começo** | **R$ 24,90** | R$ 19,90/mês | Iniciante (até ~30 atend/mês) | TUDO do core: agenda, clientes, estoque, caixa, prontuário, pacotes + WhatsApp utility até **150 msgs/mês** + aniversário por e-mail | R$ 4,29 | **83%** |
| **Profissional** ⭐ | **R$ 54,90** | R$ 43,90/mês | Autônoma estabelecida/intensa | Sem limites de atendimento, WhatsApp até **600 msgs/mês**, antes/depois ilimitado, relatórios, campanhas WhatsApp (fair-use), NF via Asaas próprio | R$ 12,15 | **78%** |
| **Estúdio** (pós-orgs) | **R$ 99,90** | R$ 79,90/mês | 2-3 profissionais | Tudo + multi-profissional, comissões, permissões; **+R$ 29,90/profissional adicional** | R$ 39,90 | **60%** |

Regras que viram marketing (mantidas do Plano Master): preço público, trial 35 dias sem cartão, sem multa, sem implantação, migração grátis.

**Por que 3 faixas e não R$ 39,90 único:** o custo variável varia 20x entre a iniciante (R$ 3) e a clínica (R$ 67) — preço único subsidia heavy users com a margem das iniciantes. A escada 24,90 → 54,90 → 99,90 segue o custo E o valor percebido (quem fatura 30k/mês com agenda lotada paga R$ 54,90 sem piscar; a iniciante entra por menos que um lash lounge cobra de uma cliente).

**Fair-use de WhatsApp em vez de "ilimitado":** os limites (150/600) cobrem 95% do segmento com folga (iniciante usa ~35, estabelecida ~156) e protegem contra o abuso que quebraria a margem. Excedente: pacotes de +200 msgs por R$ 9,90 (custo ~R$ 4).

**LTV/CAC de sanidade:** ticket médio ~R$ 45 × churn 5%/mês → LTV bruto ≈ R$ 900 × margem 75% ≈ R$ 675 → CAC máximo saudável ≈ R$ 225 → aquisição precisa ser orgânica/PLG (conteúdo, indicação, migração assistida) — coerente com o Plano Master.

---

## 7. O plano "Team": dá pra usar hoje?

**Situação técnica real:** o modelo é 1 conta Google = 1 tenant (`user_id` em todas as tabelas + RLS `auth.uid() = user_id`). Não existe conceito de organização, membros ou papéis.

| Opção | O que é | Veredito |
|---|---|---|
| **A. Conta compartilhada** (hoje) | Estúdio inteiro loga na MESMA conta Google | Funciona (5 estúdios do painel simulam isso), mas: senha compartilhada, zero permissões, sem comissão por profissional, sem trilha de quem fez o quê, Google Calendar único. **Não dá pra VENDER como "Team"** — dá pra tolerar como uso informal do plano Profissional. |
| **B. Refactor de organizações** (P2-26) | Tabelas `orgs`/`members`, `org_id` em ~12 tabelas, RLS reescrita (org + papel), convites, agenda por profissional | O caminho real. **4-6 semanas.** Pré-requisito: agenda própria (P1-14). Destrava também comissões (P2-29) e multiunidade (P3-43). |
| C. Gambiarra de "sub-contas" com views/claims | Tentar simular papéis sem refactor | Não recomendo: complexidade de RLS explode, risco de vazamento entre contas — exatamente o tipo de bug de confiabilidade que os concorrentes têm e que nosso marketing ataca. |

**Recomendação para o site (agora):** trocar o card "Team R$ --" por **"Estúdio — em breve"** com captura de e-mail própria (`source: 'waitlist-estudio'` — mede demanda real e prioriza o refactor com dado). O plano vendável no lançamento é Solo (Começo/Profissional). Se um estúdio insistir, plano Profissional em conta compartilhada com expectativa alinhada.

---

## 8. Riscos e sensibilidade

| Risco | Impacto | Mitigação |
|---|---|---|
| Câmbio (custos em US$: Supabase, Meta, Resend) | +20% no dólar = custo/cliente R$ 9→11 | Margem de 75%+ absorve; Meta fatura em BRL a partir de jul/2026 |
| Meta reprecificar WhatsApp | utility já caiu 78% no BR em 2025; direção é queda | fair-use por plano protege |
| Heavy user fora da curva (clínica no plano errado) | 1 clínica no Começo custa 2,7x o preço | limites de fair-use + telemetria de uso → upgrade assistido |
| Supabase: pausa do Free no beta | app fora do ar p/ as 3 usuárias | ir pro Pro já no primeiro cliente pagante (R$ 135 é 3,4 assinaturas) |
| Egress dos heavy users (load-all) | custo baixo, mas latência ruim | P2-35 (paginação server-side) |
| Spend cap do Supabase | com cap ON, serviço degrada em vez de cobrar | desligar cap ao lançar; alertas de billing |

---

## 9. Decisões em aberto (para você)

1. Aprovar a escada **24,90 / 54,90 / 99,90** (ou variação — o simulador calcula margem de qualquer combinação).
2. Aniversário/reativação: e-mail padrão + WhatsApp como diferencial pago? (recomendo: sim)
3. NF/Pix: modelo "conecte seu Asaas" (custo zero pra nós) vs. embutir e repassar? (recomendo: conectar)
4. Card Team do site → "Estúdio — em breve" com waitlist própria? (recomendo: sim, já no P1-18)
5. Quando houver 1º pagante: Supabase Pro imediato.

---

## Apêndice — Tabela A completa (30 personas)

| # | Persona | Segmento | Atend/mês | Clientes | Produtos | Banco MB | Storage MB | Fotos P1 MB/mês | Egress MB/mês | WA util/mês |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Júlia (harmonização, iniciante) | Iniciante | 9 | 21 | 37 | 0,2 | 3,9 | 2,6 | 3,5 | 26 |
| 2 | Camila (lash, iniciante) | Iniciante | 13 | 28 | 26 | 0,3 | 2,6 | 3,9 | 5,6 | 39 |
| 3 | Bruna (sobrancelha, iniciante) | Iniciante | 9 | 57 | 47 | 0,2 | 5,1 | 2,6 | 3,1 | 26 |
| 4 | Letícia (skincare, começando) | Iniciante | 9 | 25 | 33 | 0,2 | 3,8 | 2,6 | 3,5 | 26 |
| 5 | Vitória (micro, transição CLT) | Iniciante | 9 | 55 | 32 | 0,2 | 3,8 | 2,6 | 4,6 | 26 |
| 6 | Paola (unhas em gel, iniciante) | Iniciante | 22 | 34 | 48 | 0,5 | 5,1 | 6,5 | 7,5 | 65 |
| 7 | Renata (harmonização) | Estabelecida | 52 | 183 | 50 | 1,1 | 5,2 | 15,6 | 23,5 | 156 |
| 8 | Aline (lash designer) | Estabelecida | 43 | 169 | 104 | 1,0 | 10,3 | 13,0 | 14,9 | 130 |
| 9 | Fernanda (micropigmentação) | Estabelecida | 52 | 99 | 77 | 1,1 | 7,7 | 15,6 | 23,5 | 156 |
| 10 | Carol (estética facial) | Estabelecida | 56 | 93 | 61 | 1,2 | 6,4 | 16,9 | 20,1 | 169 |
| 11 | Tati (depilação a laser) | Estabelecida | 39 | 125 | 94 | 0,9 | 10,3 | 11,7 | 16,1 | 117 |
| 12 | Marina (podologia) | Estabelecida | 52 | 183 | 55 | 1,1 | 5,2 | 15,6 | 21,9 | 156 |
| 13 | Débora (massoterapia) | Estabelecida | 65 | 148 | 65 | 1,3 | 6,5 | 19,5 | 22,7 | 195 |
| 14 | Vanessa (design + henna) | Estabelecida | 39 | 150 | 87 | 0,9 | 9,0 | 11,7 | 18,5 | 117 |
| 15 | Sabrina (estética corporal) | Estabelecida | 56 | 153 | 74 | 1,2 | 7,7 | 16,9 | 23,4 | 169 |
| 16 | Larissa (peeling/limpeza) | Estabelecida | 39 | 85 | 79 | 0,8 | 7,8 | 11,7 | 18,5 | 117 |
| 17 | Dra. Tayana (harmonização full) | Intensa | 147 | 270 | 109 | 3,0 | 11,6 | 44,2 | 64,2 | 442 |
| 18 | Pâmela (lash volume russo) | Intensa | 160 | 321 | 138 | 3,3 | 14,2 | 48,1 | 87,7 | 481 |
| 19 | Michele (micro + remoção) | Intensa | 130 | 344 | 125 | 2,7 | 12,9 | 39,0 | 64,5 | 390 |
| 20 | Cíntia (corporal 6/dia) | Intensa | 143 | 429 | 89 | 3,0 | 9,0 | 42,9 | 66,5 | 429 |
| 21 | Rose (facial + corporal) | Intensa | 139 | 291 | 139 | 2,9 | 14,2 | 41,6 | 80,3 | 416 |
| 22 | Kelly (agenda lotada) | Intensa | 143 | 486 | 108 | 3,0 | 11,6 | 42,9 | 78,6 | 429 |
| 23 | Studio Ana & Bia (2 lash) | Estúdio | 208 | 517 | 128 | 4,3 | 12,9 | 62,4 | 135,8 | 624 |
| 24 | Espaço Duo (estética, 2) | Estúdio | 303 | 537 | 136 | 6,1 | 14,2 | 90,9 | 179,0 | 909 |
| 25 | Studio Trio (3 sobrancelha) | Estúdio | 351 | 848 | 200 | 7,2 | 20,6 | 105,2 | 206,5 | 1.052 |
| 26 | Belle Casa (2 + recepção) | Estúdio | 372 | 655 | 221 | 7,5 | 23,1 | 111,7 | 291,4 | 1.117 |
| 27 | Studio M (3 mix) | Estúdio | 320 | 473 | 187 | 6,4 | 19,3 | 96,1 | 180,1 | 961 |
| 28 | Clínica Renove (4 prof) | Clínica | 498 | 1.374 | 337 | 10,3 | 34,8 | 149,4 | 443,0 | 1.494 |
| 29 | Clínica Face&Corpo (5) | Clínica | 593 | 1.238 | 349 | 12,1 | 36,0 | 178,0 | 559,4 | 1.780 |
| 30 | Instituto Pele (6) | Clínica | 494 | 941 | 330 | 10,0 | 33,5 | 148,1 | 480,2 | 1.481 |

**Premissas do modelo** (auditáveis/ajustáveis): ~1,9 KB de banco por atendimento (1 procedure + 2 materiais + 1,6 lançamentos + 2 movimentações, com índices); 18% dos atendimentos são clientes novos; reposição de 8% do estoque/mês; foto de produto 10 KB (webp 80×80, como o app já faz); NF anexada 200 KB; foto clínica futura 250 KB com 60% de adesão × 2 fotos; conta com 12 meses de histórico; 55% das mensagens utility fora da janela grátis; câmbio R$ 5,40.

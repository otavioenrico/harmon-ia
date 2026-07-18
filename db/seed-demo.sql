-- ============================================================================
-- Harmon IA — seed de dados DEMO (para screenshots / conta de demonstração)
-- ----------------------------------------------------------------------------
-- COMO RODAR (SQL Editor do Supabase):
--   1. Rode o db/schema.sql antes (as tabelas precisam existir).
--   2. Entre no app com a conta demo (login Google) pelo menos uma vez —
--      ela precisa existir em auth.users.
--   3. Copie o user_id da conta em Authentication → Users no painel.
--   4. Substitua a constante demo_user no topo do bloco do perfil desejado
--      (há DOIS blocos independentes: A = estética, B = barbearia — use uma
--      conta demo diferente para cada um, ou rode só o que precisar).
--   5. Cole o arquivo (ou só o bloco escolhido) no SQL Editor e rode.
--
-- Idempotente: todos os inserts usam id fixo + ON CONFLICT (id) DO NOTHING —
-- rodar de novo não duplica nada. Atenção: os agendamentos usam a SEMANA em
-- que o seed rodou pela primeira vez; pra "renovar" a semana em outro screenshot,
-- apague os dados da conta demo (Configurações → Dados, ou delete por
-- user_id) e rode o bloco de novo.
--
-- Se rodar sem trocar o demo_user, o bloco aborta com uma exceção proposital.
--
-- LIMITAÇÃO IMPORTANTE — módulo Agenda:
--   A tela Agenda renderiza EXCLUSIVAMENTE eventos do Google Calendar
--   (assets/js/agenda.js busca procedures com google_event_id não-nulo e a
--   lista/grade iteram os eventos vindos da API do Google). Os procedimentos
--   deste seed NÃO têm google_event_id, portanto:
--     * a Agenda fica VAZIA para a conta demo — este seed NÃO produz o
--       screenshot de "semana cheia" na Agenda;
--     * na Home, os agendamentos da semana aparecem no card "Próximos
--       agendamentos" apenas com a data (hora/duração vêm do Google Calendar).
--   Para o screenshot da Agenda cheia: logado na conta demo, crie os
--   agendamentos pelo próprio app (Agenda → novo agendamento) — o app cria o
--   evento no Google Calendar e o procedure com google_event_id juntos.
--   Nesse caso, NÃO rode (ou apague antes) o bloco "semana ATUAL" deste seed:
--   os procedures seedados duplicariam os criados pelo app na Home/Histórico.
--   Este seed cobre Clientes, Serviços, Estoque, Financeiro, Histórico e os
--   cards da Home.
-- ============================================================================


-- ============================================================================
-- PERFIL A — ESTÉTICA (studio de cílios e sobrancelhas)
-- ============================================================================
do $$
declare
  -- >>> TROQUE pelo user_id da conta demo antes de rodar <<<
  demo_user uuid := '00000000-0000-0000-0000-000000000000';
  -- segunda-feira da semana corrente (agenda "desta semana" nos screenshots)
  v_monday  date := date_trunc('week', current_date)::date;
begin
  if demo_user = '00000000-0000-0000-0000-000000000000'::uuid then
    raise exception 'seed-demo (estética): troque a constante demo_user pelo user_id da conta demo (Authentication → Users) antes de rodar.';
  end if;

  -- tema do perfil ------------------------------------------------------------
  insert into public.user_settings (user_id, theme, accent)
  values (demo_user, 'light', 'rose')
  on conflict (user_id) do nothing;

  -- serviços (6) --------------------------------------------------------------
  insert into public.services (id, user_id, name, description, default_price, duration_min, color, active)
  select v.id::uuid, demo_user, v.name, v.descr, v.price, v.dur, v.color, true
  from (values
    ('e0000000-0000-0000-0002-000000000001', 'Extensão de Cílios — Volume Brasileiro', 'Aplicação completa, fios em Y', 180.00, 120, '#C86B85'),
    ('e0000000-0000-0000-0002-000000000002', 'Extensão de Cílios — Fio a Fio Clássico', 'Efeito natural, 1 fio por fio natural', 150.00, 100, '#D9A5B3'),
    ('e0000000-0000-0000-0002-000000000003', 'Manutenção de Cílios', 'Reposição até 21 dias após a aplicação', 90.00, 60, '#B87E93'),
    ('e0000000-0000-0000-0002-000000000004', 'Design de Sobrancelhas', 'Mapeamento + pinça', 60.00, 40, '#8E5D6F'),
    ('e0000000-0000-0000-0002-000000000005', 'Design com Henna', 'Design + aplicação de henna', 80.00, 50, '#A2687D'),
    ('e0000000-0000-0000-0002-000000000006', 'Brow Lamination', 'Alinhamento dos fios + nutrição', 130.00, 75, '#C99BAB')
  ) as v(id, name, descr, price, dur, color)
  on conflict (id) do nothing;

  -- clientes (8, nomes fictícios) ---------------------------------------------
  insert into public.clients (id, user_id, name, phone, email, birthdate, notes, active)
  select v.id::uuid, demo_user, v.name, v.phone, v.email, v.bday::date, v.notes, true
  from (values
    ('e0000000-0000-0000-0001-000000000001', 'Ana Clara Souza',      '(11) 99911-0101', 'anaclara.demo@example.com',  '1996-03-14', 'Prefere volume mais natural'),
    ('e0000000-0000-0000-0001-000000000002', 'Beatriz Lima',         '(11) 99911-0102', 'beatriz.demo@example.com',   '1992-07-02', 'Alergia a henna — usar só pinça'),
    ('e0000000-0000-0000-0001-000000000003', 'Camila Ferreira',      '(11) 99911-0103', 'camila.demo@example.com',    '1999-11-21', null),
    ('e0000000-0000-0000-0001-000000000004', 'Maria Eduarda Martins','(11) 99911-0104', 'duda.demo@example.com',      '2001-01-30', 'Indicada pela Ana Clara'),
    ('e0000000-0000-0000-0001-000000000005', 'Fernanda Alves',       '(11) 99911-0105', 'fernanda.demo@example.com',  '1988-05-09', null),
    ('e0000000-0000-0000-0001-000000000006', 'Gabriela Rocha',       '(11) 99911-0106', 'gabriela.demo@example.com',  '1995-09-17', 'Sempre remarca com antecedência'),
    ('e0000000-0000-0000-0001-000000000007', 'Helena Castro',        '(11) 99911-0107', 'helena.demo@example.com',    '1990-12-04', null),
    ('e0000000-0000-0000-0001-000000000008', 'Isabela Nunes',        '(11) 99911-0108', 'isabela.demo@example.com',   '1997-06-26', 'Gosta de efeito gatinho')
  ) as v(id, name, phone, email, bday, notes)
  on conflict (id) do nothing;

  -- estoque (6 itens; a cola fica ABAIXO do mínimo → alerta/lista de compras) --
  insert into public.stock_items (id, user_id, name, description, quantity, min_quantity, unit, cost_price, active)
  select v.id::uuid, demo_user, v.name, v.descr, v.qty, v.minq, v.unit, v.cost, true
  from (values
    ('e0000000-0000-0000-0003-000000000001', 'Cola de extensão HS-10 (5 ml)', 'Secagem 1-2s, retenção 6 semanas', 1,  2,  'frasco',      68.00),
    ('e0000000-0000-0000-0003-000000000002', 'Fios de seda 0.07 C mix',       'Bandeja mix 8-14 mm',              8,  3,  'bandeja',     22.50),
    ('e0000000-0000-0000-0003-000000000003', 'Pads de hidrogel',              'Protetor de pálpebra inferior',    40, 15, 'par',         1.80),
    ('e0000000-0000-0000-0003-000000000004', 'Henna castanho escuro',         null,                               30, 10, 'g',           0.95),
    ('e0000000-0000-0000-0003-000000000005', 'Micropincéis descartáveis',     'Caixa com 100 unidades',           4,  2,  'caixa',       12.00),
    ('e0000000-0000-0000-0003-000000000006', 'Removedor de cola cremoso',     null,                               3,  1,  'frasco',      35.00)
  ) as v(id, name, descr, qty, minq, unit, cost)
  on conflict (id) do nothing;

  -- compras recentes de estoque (movimentações 'in') ---------------------------
  insert into public.stock_transactions (id, user_id, stock_item_id, type, quantity, reason, notes, created_at)
  select v.id::uuid, demo_user, v.item::uuid, 'in', v.qty, 'compra', v.notes, (v_monday - 5)::timestamptz
  from (values
    ('e0000000-0000-0000-0006-000000000001', 'e0000000-0000-0000-0003-000000000001', 2, 'Reposição mensal'),
    ('e0000000-0000-0000-0006-000000000002', 'e0000000-0000-0000-0003-000000000002', 5, 'Promoção do fornecedor')
  ) as v(id, item, qty, notes)
  on conflict (id) do nothing;

  -- semana PASSADA: 6 procedimentos concluídos (alimentam o caixa pago) --------
  -- sem hora: procedures.date é só data; hora/duração vivem no Google Calendar.
  insert into public.procedures (id, user_id, client_id, service_id, date, price_charged, status)
  select v.id::uuid, demo_user, v.cid::uuid, v.sid::uuid, v_monday - 7 + v.dow, v.price, 'completed'
  from (values
    ('e0000000-0000-0000-0004-000000000001', 'e0000000-0000-0000-0001-000000000001', 'e0000000-0000-0000-0002-000000000001', 0, 180.00),
    ('e0000000-0000-0000-0004-000000000002', 'e0000000-0000-0000-0001-000000000002', 'e0000000-0000-0000-0002-000000000004', 1, 60.00),
    ('e0000000-0000-0000-0004-000000000003', 'e0000000-0000-0000-0001-000000000003', 'e0000000-0000-0000-0002-000000000003', 2, 90.00),
    ('e0000000-0000-0000-0004-000000000004', 'e0000000-0000-0000-0001-000000000005', 'e0000000-0000-0000-0002-000000000005', 3, 80.00),
    ('e0000000-0000-0000-0004-000000000005', 'e0000000-0000-0000-0001-000000000007', 'e0000000-0000-0000-0002-000000000006', 4, 130.00),
    ('e0000000-0000-0000-0004-000000000006', 'e0000000-0000-0000-0001-000000000008', 'e0000000-0000-0000-0002-000000000002', 5, 150.00)
  ) as v(id, cid, sid, dow, price)
  on conflict (id) do nothing;

  -- semana ATUAL: 14 procedimentos seg→sáb (passado = concluído) ---------------
  -- ATENÇÃO: sem google_event_id eles NÃO aparecem na Agenda (ver LIMITAÇÃO no
  -- cabeçalho); alimentam Home ("Próximos agendamentos", só data) e Histórico.
  insert into public.procedures (id, user_id, client_id, service_id, date, price_charged, status)
  select v.id::uuid, demo_user, v.cid::uuid, v.sid::uuid, v_monday + v.dow, v.price,
         case when v_monday + v.dow < current_date then 'completed' else 'scheduled' end
  from (values
    -- segunda
    ('e0000000-0000-0000-0004-000000000011', 'e0000000-0000-0000-0001-000000000006', 'e0000000-0000-0000-0002-000000000003', 0, 90.00),
    ('e0000000-0000-0000-0004-000000000012', 'e0000000-0000-0000-0001-000000000004', 'e0000000-0000-0000-0002-000000000004', 0, 60.00),
    -- terça
    ('e0000000-0000-0000-0004-000000000013', 'e0000000-0000-0000-0001-000000000001', 'e0000000-0000-0000-0002-000000000003', 1, 90.00),
    ('e0000000-0000-0000-0004-000000000014', 'e0000000-0000-0000-0001-000000000003', 'e0000000-0000-0000-0002-000000000005', 1, 80.00),
    ('e0000000-0000-0000-0004-000000000015', 'e0000000-0000-0000-0001-000000000007', 'e0000000-0000-0000-0002-000000000004', 1, 60.00),
    -- quarta
    ('e0000000-0000-0000-0004-000000000016', 'e0000000-0000-0000-0001-000000000002', 'e0000000-0000-0000-0002-000000000001', 2, 180.00),
    ('e0000000-0000-0000-0004-000000000017', 'e0000000-0000-0000-0001-000000000008', 'e0000000-0000-0000-0002-000000000006', 2, 130.00),
    -- quinta
    ('e0000000-0000-0000-0004-000000000018', 'e0000000-0000-0000-0001-000000000005', 'e0000000-0000-0000-0002-000000000002', 3, 150.00),
    ('e0000000-0000-0000-0004-000000000019', 'e0000000-0000-0000-0001-000000000006', 'e0000000-0000-0000-0002-000000000004', 3, 60.00),
    -- sexta
    ('e0000000-0000-0000-0004-000000000020', 'e0000000-0000-0000-0001-000000000004', 'e0000000-0000-0000-0002-000000000001', 4, 180.00),
    ('e0000000-0000-0000-0004-000000000021', 'e0000000-0000-0000-0001-000000000001', 'e0000000-0000-0000-0002-000000000005', 4, 80.00),
    ('e0000000-0000-0000-0004-000000000022', 'e0000000-0000-0000-0001-000000000002', 'e0000000-0000-0000-0002-000000000003', 4, 90.00),
    -- sábado
    ('e0000000-0000-0000-0004-000000000023', 'e0000000-0000-0000-0001-000000000003', 'e0000000-0000-0000-0002-000000000006', 5, 130.00),
    ('e0000000-0000-0000-0004-000000000024', 'e0000000-0000-0000-0001-000000000007', 'e0000000-0000-0000-0002-000000000002', 5, 150.00)
  ) as v(id, cid, sid, dow, price)
  on conflict (id) do nothing;

  -- caixa: entradas PAGAS (semana passada) + extras — saldo positivo -----------
  insert into public.financial_entries (id, user_id, type, amount, description, category, payment_method,
                                        installments, installment_of, due_date, paid, paid_at, client_id, procedure_id)
  select v.id::uuid, demo_user, 'income', v.amount, v.descr, 'procedimento', v.method,
         1, 1, v_monday - 7 + v.dow, true, v_monday - 7 + v.dow, v.cid::uuid, v.pid::uuid
  from (values
    ('e0000000-0000-0000-0005-000000000001', 180.00, 'Extensão — Volume Brasileiro', 'pix',            0, 'e0000000-0000-0000-0001-000000000001', 'e0000000-0000-0000-0004-000000000001'),
    ('e0000000-0000-0000-0005-000000000002', 60.00,  'Design de Sobrancelhas',       'dinheiro',       1, 'e0000000-0000-0000-0001-000000000002', 'e0000000-0000-0000-0004-000000000002'),
    ('e0000000-0000-0000-0005-000000000003', 90.00,  'Manutenção de Cílios',         'pix',            2, 'e0000000-0000-0000-0001-000000000003', 'e0000000-0000-0000-0004-000000000003'),
    ('e0000000-0000-0000-0005-000000000004', 80.00,  'Design com Henna',             'cartao_debito',  3, 'e0000000-0000-0000-0001-000000000005', 'e0000000-0000-0000-0004-000000000004'),
    ('e0000000-0000-0000-0005-000000000005', 130.00, 'Brow Lamination',              'cartao_credito', 4, 'e0000000-0000-0000-0001-000000000007', 'e0000000-0000-0000-0004-000000000005'),
    ('e0000000-0000-0000-0005-000000000006', 150.00, 'Extensão — Fio a Fio',         'pix',            5, 'e0000000-0000-0000-0001-000000000008', 'e0000000-0000-0000-0004-000000000006')
  ) as v(id, amount, descr, method, dow, cid, pid)
  on conflict (id) do nothing;

  -- venda avulsa paga (home care)
  insert into public.financial_entries (id, user_id, type, amount, description, category, payment_method,
                                        due_date, paid, paid_at)
  values ('e0000000-0000-0000-0005-000000000007', demo_user, 'income', 75.00,
          'Venda — sérum de cílios (home care)', 'venda', 'pix', v_monday - 3, true, v_monday - 3)
  on conflict (id) do nothing;

  -- 2 entradas PENDENTES ------------------------------------------------------
  insert into public.financial_entries (id, user_id, type, amount, description, category, payment_method,
                                        installments, installment_of, due_date, paid, client_id, procedure_id)
  values
    ('e0000000-0000-0000-0005-000000000008', demo_user, 'income', 180.00,
     'Agendamento — Volume Brasileiro', 'Agendamentos', 'pix', 1, 1,
     v_monday + 2, false, 'e0000000-0000-0000-0001-000000000002', 'e0000000-0000-0000-0004-000000000016'),
    ('e0000000-0000-0000-0005-000000000009', demo_user, 'income', 90.00,
     'Pacote manutenção — 2ª parcela', 'procedimento', 'pix', 2, 2,
     v_monday + 8, false, 'e0000000-0000-0000-0001-000000000001', null)
  on conflict (id) do nothing;

  -- despesas pagas (saldo continua positivo: ~765 de entrada x ~446 de saída) --
  insert into public.financial_entries (id, user_id, type, amount, description, category, payment_method,
                                        due_date, paid, paid_at)
  values
    ('e0000000-0000-0000-0005-000000000010', demo_user, 'expense', 145.90,
     'Compra de colas e fios', 'material', 'cartao_credito', v_monday - 5, true, v_monday - 5),
    ('e0000000-0000-0000-0005-000000000011', demo_user, 'expense', 300.00,
     'Aluguel da sala', 'fixo', 'pix', v_monday - 2, true, v_monday - 2)
  on conflict (id) do nothing;
end $$;


-- ============================================================================
-- PERFIL B — BARBEARIA
-- ============================================================================
do $$
declare
  -- >>> TROQUE pelo user_id da conta demo antes de rodar <<<
  demo_user uuid := '00000000-0000-0000-0000-000000000000';
  v_monday  date := date_trunc('week', current_date)::date;
begin
  if demo_user = '00000000-0000-0000-0000-000000000000'::uuid then
    raise exception 'seed-demo (barbearia): troque a constante demo_user pelo user_id da conta demo (Authentication → Users) antes de rodar.';
  end if;

  -- tema do perfil ------------------------------------------------------------
  insert into public.user_settings (user_id, theme, accent)
  values (demo_user, 'dark', 'sky')
  on conflict (user_id) do nothing;

  -- serviços (6) --------------------------------------------------------------
  insert into public.services (id, user_id, name, description, default_price, duration_min, color, active)
  select v.id::uuid, demo_user, v.name, v.descr, v.price, v.dur, v.color, true
  from (values
    ('b0000000-0000-0000-0002-000000000001', 'Corte Degradê (Fade)',            'Máquina + tesoura, acabamento na navalha', 55.00, 45,  '#4A6B8A'),
    ('b0000000-0000-0000-0002-000000000002', 'Corte + Barba',                   'Combo completo com toalha quente',         85.00, 75,  '#2F4858'),
    ('b0000000-0000-0000-0002-000000000003', 'Barba Completa (toalha quente)',  'Alinhamento + hidratação',                 45.00, 40,  '#6B8CAA'),
    ('b0000000-0000-0000-0002-000000000004', 'Pezinho / Acabamento',            'Contorno de máquina entre cortes',         25.00, 20,  '#8FA9C2'),
    ('b0000000-0000-0000-0002-000000000005', 'Platinado Global',                'Descoloração + matização',                 160.00, 150, '#37474F'),
    ('b0000000-0000-0000-0002-000000000006', 'Sobrancelha na Navalha',          null,                                       20.00, 15,  '#5C7A99')
  ) as v(id, name, descr, price, dur, color)
  on conflict (id) do nothing;

  -- clientes (8, nomes fictícios) ---------------------------------------------
  insert into public.clients (id, user_id, name, phone, email, birthdate, notes, active)
  select v.id::uuid, demo_user, v.name, v.phone, v.email, v.bday::date, v.notes, true
  from (values
    ('b0000000-0000-0000-0001-000000000001', 'Bruno Cardoso',        '(11) 99922-0201', 'bruno.demo@example.com',    '1994-02-11', 'Degradê baixo, risco na lateral'),
    ('b0000000-0000-0000-0001-000000000002', 'Carlos Eduardo Ramos', '(11) 99922-0202', 'cadu.demo@example.com',     '1989-08-23', null),
    ('b0000000-0000-0000-0001-000000000003', 'Diego Ferreira',       '(11) 99922-0203', 'diego.demo@example.com',    '1998-04-05', 'Vem a cada 15 dias'),
    ('b0000000-0000-0000-0001-000000000004', 'Felipe Santana',       '(11) 99922-0204', 'felipe.demo@example.com',   '1996-10-19', null),
    ('b0000000-0000-0000-0001-000000000005', 'Gustavo Oliveira',     '(11) 99922-0205', 'gustavo.demo@example.com',  '2000-06-08', 'Barba cerrada, óleo no final'),
    ('b0000000-0000-0000-0001-000000000006', 'Henrique Barros',      '(11) 99922-0206', 'henrique.demo@example.com', '1992-12-27', null),
    ('b0000000-0000-0000-0001-000000000007', 'João Pedro Almeida',   '(11) 99922-0207', 'jp.demo@example.com',       '2002-03-16', 'Quer manter o platinado'),
    ('b0000000-0000-0000-0001-000000000008', 'Lucas Meireles',       '(11) 99922-0208', 'lucas.demo@example.com',    '1997-07-31', null)
  ) as v(id, name, phone, email, bday, notes)
  on conflict (id) do nothing;

  -- estoque (6 itens; lâminas ABAIXO do mínimo → alerta/lista de compras) ------
  insert into public.stock_items (id, user_id, name, description, quantity, min_quantity, unit, cost_price, active)
  select v.id::uuid, demo_user, v.name, v.descr, v.qty, v.minq, v.unit, v.cost, true
  from (values
    ('b0000000-0000-0000-0003-000000000001', 'Lâminas de barbear (caixa 10)', 'Lâmina dupla p/ navalha',        1,  3, 'caixa',  18.00),
    ('b0000000-0000-0000-0003-000000000002', 'Pomada modeladora matte',       'Fixação forte, efeito seco',     12, 4, 'un',     28.00),
    ('b0000000-0000-0000-0003-000000000003', 'Óleo para barba 30 ml',         'Amadeirado',                     6,  2, 'un',     32.00),
    ('b0000000-0000-0000-0003-000000000004', 'Pó descolorante 500 g',         'Uso no platinado',               2,  1, 'un',     89.00),
    ('b0000000-0000-0000-0003-000000000005', 'Toalhas descartáveis (pct 50)', null,                             5,  2, 'pacote', 24.00),
    ('b0000000-0000-0000-0003-000000000006', 'Talco de acabamento',           null,                             4,  2, 'un',     15.00)
  ) as v(id, name, descr, qty, minq, unit, cost)
  on conflict (id) do nothing;

  -- compras recentes de estoque ------------------------------------------------
  insert into public.stock_transactions (id, user_id, stock_item_id, type, quantity, reason, notes, created_at)
  select v.id::uuid, demo_user, v.item::uuid, 'in', v.qty, 'compra', v.notes, (v_monday - 6)::timestamptz
  from (values
    ('b0000000-0000-0000-0006-000000000001', 'b0000000-0000-0000-0003-000000000001', 3, 'Reposição quinzenal'),
    ('b0000000-0000-0000-0006-000000000002', 'b0000000-0000-0000-0003-000000000002', 6, 'Estoque p/ revenda')
  ) as v(id, item, qty, notes)
  on conflict (id) do nothing;

  -- semana PASSADA: 6 procedimentos concluídos ---------------------------------
  -- sem hora: procedures.date é só data; hora/duração vivem no Google Calendar.
  insert into public.procedures (id, user_id, client_id, service_id, date, price_charged, status)
  select v.id::uuid, demo_user, v.cid::uuid, v.sid::uuid, v_monday - 7 + v.dow, v.price, 'completed'
  from (values
    ('b0000000-0000-0000-0004-000000000001', 'b0000000-0000-0000-0001-000000000001', 'b0000000-0000-0000-0002-000000000002', 0, 85.00),
    ('b0000000-0000-0000-0004-000000000002', 'b0000000-0000-0000-0001-000000000003', 'b0000000-0000-0000-0002-000000000001', 1, 55.00),
    ('b0000000-0000-0000-0004-000000000003', 'b0000000-0000-0000-0001-000000000004', 'b0000000-0000-0000-0002-000000000003', 2, 45.00),
    ('b0000000-0000-0000-0004-000000000004', 'b0000000-0000-0000-0001-000000000005', 'b0000000-0000-0000-0002-000000000002', 3, 85.00),
    ('b0000000-0000-0000-0004-000000000005', 'b0000000-0000-0000-0001-000000000006', 'b0000000-0000-0000-0002-000000000005', 4, 160.00),
    ('b0000000-0000-0000-0004-000000000006', 'b0000000-0000-0000-0001-000000000008', 'b0000000-0000-0000-0002-000000000001', 5, 55.00)
  ) as v(id, cid, sid, dow, price)
  on conflict (id) do nothing;

  -- semana ATUAL: 14 procedimentos seg→sáb (passado = concluído) ---------------
  -- ATENÇÃO: sem google_event_id eles NÃO aparecem na Agenda (ver LIMITAÇÃO no
  -- cabeçalho); alimentam Home ("Próximos agendamentos", só data) e Histórico.
  insert into public.procedures (id, user_id, client_id, service_id, date, price_charged, status)
  select v.id::uuid, demo_user, v.cid::uuid, v.sid::uuid, v_monday + v.dow, v.price,
         case when v_monday + v.dow < current_date then 'completed' else 'scheduled' end
  from (values
    -- segunda
    ('b0000000-0000-0000-0004-000000000011', 'b0000000-0000-0000-0001-000000000002', 'b0000000-0000-0000-0002-000000000001', 0, 55.00),
    ('b0000000-0000-0000-0004-000000000012', 'b0000000-0000-0000-0001-000000000007', 'b0000000-0000-0000-0002-000000000004', 0, 25.00),
    -- terça
    ('b0000000-0000-0000-0004-000000000013', 'b0000000-0000-0000-0001-000000000001', 'b0000000-0000-0000-0002-000000000003', 1, 45.00),
    ('b0000000-0000-0000-0004-000000000014', 'b0000000-0000-0000-0001-000000000003', 'b0000000-0000-0000-0002-000000000002', 1, 85.00),
    ('b0000000-0000-0000-0004-000000000015', 'b0000000-0000-0000-0001-000000000004', 'b0000000-0000-0000-0002-000000000006', 1, 20.00),
    -- quarta
    ('b0000000-0000-0000-0004-000000000016', 'b0000000-0000-0000-0001-000000000005', 'b0000000-0000-0000-0002-000000000001', 2, 55.00),
    ('b0000000-0000-0000-0004-000000000017', 'b0000000-0000-0000-0001-000000000008', 'b0000000-0000-0000-0002-000000000003', 2, 45.00),
    -- quinta
    ('b0000000-0000-0000-0004-000000000018', 'b0000000-0000-0000-0001-000000000006', 'b0000000-0000-0000-0002-000000000002', 3, 85.00),
    ('b0000000-0000-0000-0004-000000000019', 'b0000000-0000-0000-0001-000000000002', 'b0000000-0000-0000-0002-000000000004', 3, 25.00),
    -- sexta
    ('b0000000-0000-0000-0004-000000000020', 'b0000000-0000-0000-0001-000000000007', 'b0000000-0000-0000-0002-000000000005', 4, 160.00),
    ('b0000000-0000-0000-0004-000000000021', 'b0000000-0000-0000-0001-000000000001', 'b0000000-0000-0000-0002-000000000001', 4, 55.00),
    ('b0000000-0000-0000-0004-000000000022', 'b0000000-0000-0000-0001-000000000003', 'b0000000-0000-0000-0002-000000000006', 4, 20.00),
    -- sábado
    ('b0000000-0000-0000-0004-000000000023', 'b0000000-0000-0000-0001-000000000004', 'b0000000-0000-0000-0002-000000000002', 5, 85.00),
    ('b0000000-0000-0000-0004-000000000024', 'b0000000-0000-0000-0001-000000000005', 'b0000000-0000-0000-0002-000000000003', 5, 45.00)
  ) as v(id, cid, sid, dow, price)
  on conflict (id) do nothing;

  -- caixa: entradas PAGAS (semana passada) -------------------------------------
  insert into public.financial_entries (id, user_id, type, amount, description, category, payment_method,
                                        installments, installment_of, due_date, paid, paid_at, client_id, procedure_id)
  select v.id::uuid, demo_user, 'income', v.amount, v.descr, 'procedimento', v.method,
         1, 1, v_monday - 7 + v.dow, true, v_monday - 7 + v.dow, v.cid::uuid, v.pid::uuid
  from (values
    ('b0000000-0000-0000-0005-000000000001', 85.00,  'Corte + Barba',        'pix',            0, 'b0000000-0000-0000-0001-000000000001', 'b0000000-0000-0000-0004-000000000001'),
    ('b0000000-0000-0000-0005-000000000002', 55.00,  'Corte Degradê',        'dinheiro',       1, 'b0000000-0000-0000-0001-000000000003', 'b0000000-0000-0000-0004-000000000002'),
    ('b0000000-0000-0000-0005-000000000003', 45.00,  'Barba Completa',       'pix',            2, 'b0000000-0000-0000-0001-000000000004', 'b0000000-0000-0000-0004-000000000003'),
    ('b0000000-0000-0000-0005-000000000004', 85.00,  'Corte + Barba',        'cartao_debito',  3, 'b0000000-0000-0000-0001-000000000005', 'b0000000-0000-0000-0004-000000000004'),
    ('b0000000-0000-0000-0005-000000000005', 160.00, 'Platinado Global',     'cartao_credito', 4, 'b0000000-0000-0000-0001-000000000006', 'b0000000-0000-0000-0004-000000000005'),
    ('b0000000-0000-0000-0005-000000000006', 55.00,  'Corte Degradê',        'pix',            5, 'b0000000-0000-0000-0001-000000000008', 'b0000000-0000-0000-0004-000000000006')
  ) as v(id, amount, descr, method, dow, cid, pid)
  on conflict (id) do nothing;

  -- venda avulsa paga (revenda de pomada)
  insert into public.financial_entries (id, user_id, type, amount, description, category, payment_method,
                                        due_date, paid, paid_at)
  values ('b0000000-0000-0000-0005-000000000007', demo_user, 'income', 56.00,
          'Venda — 2 pomadas modeladoras', 'venda', 'dinheiro', v_monday - 2, true, v_monday - 2)
  on conflict (id) do nothing;

  -- 2 entradas PENDENTES ------------------------------------------------------
  insert into public.financial_entries (id, user_id, type, amount, description, category, payment_method,
                                        installments, installment_of, due_date, paid, client_id, procedure_id)
  values
    ('b0000000-0000-0000-0005-000000000008', demo_user, 'income', 160.00,
     'Agendamento — Platinado Global', 'Agendamentos', 'pix', 1, 1,
     v_monday + 4, false, 'b0000000-0000-0000-0001-000000000007', 'b0000000-0000-0000-0004-000000000020'),
    ('b0000000-0000-0000-0005-000000000009', demo_user, 'income', 85.00,
     'Corte + Barba — combinado p/ semana que vem', 'procedimento', 'pix', 1, 1,
     v_monday + 9, false, 'b0000000-0000-0000-0001-000000000006', null)
  on conflict (id) do nothing;

  -- despesas pagas (saldo continua positivo: ~541 de entrada x ~383 de saída) --
  insert into public.financial_entries (id, user_id, type, amount, description, category, payment_method,
                                        due_date, paid, paid_at)
  values
    ('b0000000-0000-0000-0005-000000000010', demo_user, 'expense', 132.50,
     'Reposição de lâminas e pomadas', 'material', 'cartao_credito', v_monday - 6, true, v_monday - 6),
    ('b0000000-0000-0000-0005-000000000011', demo_user, 'expense', 250.00,
     'Aluguel da cadeira', 'fixo', 'pix', v_monday - 2, true, v_monday - 2)
  on conflict (id) do nothing;
end $$;

-- ============================================================ FIM =============

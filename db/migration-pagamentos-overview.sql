-- ============================================================================
-- Harmon IA — migration avulsa: pagamentos + overview do agendamento (2026-07-04)
-- ----------------------------------------------------------------------------
-- Rode isto se já aplicou o db/schema.sql antes e só precisa desta atualização.
-- Idempotente (create or replace). Já está refletida em db/schema.sql — não
-- precisa rodar os dois se for setup do zero.
--
-- (B) complete_procedure: passa a marcar TODOS os lançamentos como recebidos
--     (antes só à vista 1x confirmava; crédito/parcelado ficavam pendentes).
-- (C) update_completed_procedure: nova RPC para editar um procedimento já
--     concluído, reconciliando estoque (estorna consumo antigo, debita o novo)
--     e caixa (reescreve os lançamentos, mantendo paid=true).
-- ============================================================================

-- ============================= RPC: completar procedimento (item 8/14/1.1) =====
-- Debita o estoque dos materiais reservados (cria stock_transactions +
-- decrementa quantity) e marca status='completed'. Concluído = recebido,
-- qualquer forma de pagamento (regra B: nada entra recebido na criação, tudo
-- vira recebido na conclusão).
-- ponytail: estoque pode ficar negativo (single-tenant, mesmo teto já aceito no
-- register_procedure); migrar p/ trava por item se houver concorrência real.
create or replace function public.complete_procedure(p_procedure_id uuid)
returns void
language plpgsql as $$
declare
  v_user uuid := auth.uid();
  v_date date;
  v_mat  record;
begin
  if v_user is null then raise exception 'not authenticated'; end if;

  update public.procedures
    set status = 'completed'
    where id = p_procedure_id and user_id = v_user and status = 'scheduled'
    returning date into v_date;
  if v_date is null then return; end if;   -- inexistente ou já concluído/cancelado

  -- debita estoque das reservas
  for v_mat in
    select stock_item_id, quantity_used
      from public.procedure_materials
      where procedure_id = p_procedure_id and user_id = v_user
        and stock_item_id is not null
  loop
    insert into public.stock_transactions(
      user_id, stock_item_id, type, quantity, reason, procedure_id)
    values (v_user, v_mat.stock_item_id, 'out', v_mat.quantity_used,
            'uso_procedimento', p_procedure_id);
    update public.stock_items
      set quantity = quantity - v_mat.quantity_used
      where id = v_mat.stock_item_id and user_id = v_user;
  end loop;

  update public.financial_entries
    set category = 'procedimento',
        paid     = true,
        paid_at  = coalesce(paid_at, v_date)
    where procedure_id = p_procedure_id and user_id = v_user;
end $$;

-- ===================== RPC: editar procedimento CONCLUÍDO (spec 2026-07-04) ====
-- update_scheduled_procedure só age em 'scheduled'. Esta RPC cobre o caso de
-- corrigir um procedimento já concluído (ex.: quantidade de material ou preço
-- depois da consulta), reconciliando estoque e caixa na mesma transação:
--   1) procedures: reescreve cliente/serviço/data/preço/notas.
--   2) estoque: estorna o consumo antigo (devolve quantidade) e debita o novo —
--      simples e equivalente ao delta, sem stock_transactions negativas.
--   3) caixa: concluído = recebido (regra B) — reescreve os lançamentos com o
--      valor/parcelas/forma novos, sempre paid=true, preservando o paid_at
--      original (data em que entrou como recebido, não a data da edição).
create or replace function public.update_completed_procedure(
  p_procedure_id    uuid,
  p_client_id       uuid,
  p_service_id      uuid,
  p_date            date,
  p_price_charged   numeric,
  p_notes           text,
  p_materials       jsonb,
  p_payment_method  text,
  p_installments    int
) returns void
language plpgsql as $$
declare
  v_user uuid := auth.uid();
  v_mat     jsonb;
  v_item    uuid;
  v_qty     numeric;
  v_cost    numeric;
  v_n       int := greatest(coalesce(p_installments, 1), 1);
  v_each    numeric;
  v_acc     numeric := 0;
  v_amt     numeric;
  v_paid_at date;
  i         int;
begin
  if v_user is null then raise exception 'not authenticated'; end if;

  update public.procedures
    set client_id = p_client_id, service_id = p_service_id, date = p_date,
        price_charged = p_price_charged, notes = p_notes
    where id = p_procedure_id and user_id = v_user and status = 'completed';
  if not found then
    raise exception 'procedimento não encontrado ou não está concluído';
  end if;

  -- estoque: devolve tudo que foi debitado na conclusão original...
  for v_item, v_qty in
    select stock_item_id, quantity_used from public.procedure_materials
      where procedure_id = p_procedure_id and user_id = v_user and stock_item_id is not null
  loop
    insert into public.stock_transactions(user_id, stock_item_id, type, quantity, reason, procedure_id)
      values (v_user, v_item, 'in', v_qty, 'ajuste', p_procedure_id);
    update public.stock_items set quantity = quantity + v_qty where id = v_item and user_id = v_user;
  end loop;

  -- ...e debita de novo com a lista atual (rescreve procedure_materials do zero)
  delete from public.procedure_materials where procedure_id = p_procedure_id and user_id = v_user;
  if p_materials is not null then
    for v_mat in select * from jsonb_array_elements(p_materials) loop
      v_item := (v_mat->>'stock_item_id')::uuid;
      v_qty  := (v_mat->>'quantity_used')::numeric;
      select cost_price into v_cost from public.stock_items where id = v_item and user_id = v_user;
      insert into public.procedure_materials(user_id, procedure_id, stock_item_id, quantity_used, unit_cost_at_time)
        values (v_user, p_procedure_id, v_item, v_qty, v_cost);
      insert into public.stock_transactions(user_id, stock_item_id, type, quantity, reason, procedure_id)
        values (v_user, v_item, 'out', v_qty, 'uso_procedimento', p_procedure_id);
      update public.stock_items set quantity = quantity - v_qty where id = v_item and user_id = v_user;
    end loop;
  end if;

  -- caixa: preserva a data em que o procedimento virou recebido, não a de hoje.
  select paid_at into v_paid_at from public.financial_entries
    where procedure_id = p_procedure_id and user_id = v_user and paid_at is not null
    order by paid_at limit 1;

  delete from public.financial_entries where procedure_id = p_procedure_id and user_id = v_user;
  if p_price_charged is not null and p_price_charged > 0 then
    v_each := round(p_price_charged / v_n, 2);
    for i in 1..v_n loop
      if i < v_n then v_amt := v_each; v_acc := v_acc + v_each;
      else v_amt := p_price_charged - v_acc; end if;
      insert into public.financial_entries(
        user_id, type, amount, description, category, payment_method,
        installments, installment_of, due_date, paid, paid_at, client_id, procedure_id)
      values (
        v_user, 'income', v_amt, 'Procedimento', 'procedimento', p_payment_method,
        v_n, i, (p_date + ((i - 1) || ' month')::interval)::date,
        true, coalesce(v_paid_at, p_date), p_client_id, p_procedure_id);
    end loop;
  end if;
end $$;

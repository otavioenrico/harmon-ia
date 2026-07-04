-- ============================================================================
-- Teste manual — reconciliação de estoque e caixa em update_completed_procedure
-- ----------------------------------------------------------------------------
-- Como usar: cole no SQL Editor do Supabase (schema já com a migration
-- pagamentos-e-overview aplicada) e rode. Usa auth.uid() simulado via
-- request.jwt.claim.sub (mesmo truque do Supabase p/ testar RLS/RPCs fora do
-- app) sobre um user_id de auth.users já existente. Tudo roda dentro de uma
-- transação com ROLLBACK no fim — não deixa dado nenhum para trás.
-- Se algum ASSERT falhar, a mensagem aponta exatamente o que quebrou.
-- ============================================================================

begin;

do $$
declare
  v_user   uuid;
  v_client uuid;
  v_service uuid;
  v_stock  uuid;
  v_proc   uuid;
  v_qty_reserved numeric;
  v_qty_after_complete numeric;
  v_qty_after_edit numeric;
  v_paid_after_complete boolean;
  v_amt_after_edit numeric;
  v_paid_after_edit boolean;
begin
  select id into v_user from auth.users limit 1;
  if v_user is null then
    raise exception 'nenhum usuário em auth.users — faça login no app pelo menos uma vez antes de rodar este teste';
  end if;

  perform set_config('request.jwt.claim.sub', v_user::text, true);

  insert into public.clients(user_id, name) values (v_user, 'Teste QA — apagar') returning id into v_client;
  insert into public.services(user_id, name, color) values (v_user, 'Serviço QA', '#ff0000') returning id into v_service;
  insert into public.stock_items(user_id, name, quantity, cost_price)
    values (v_user, 'Insumo QA', 100, 5) returning id into v_stock;

  -- agenda no crédito 2x (R$100), reservando 1 unidade do insumo — nada debitado ainda
  v_proc := public.schedule_procedure(v_client, v_service, current_date, 100, 'obs', null,
    jsonb_build_array(jsonb_build_object('stock_item_id', v_stock, 'quantity_used', 1)),
    'cartao_credito', 2);

  select quantity into v_qty_reserved from public.stock_items where id = v_stock;
  assert v_qty_reserved = 100, format('agendar não deveria debitar estoque (veio %s)', v_qty_reserved);

  -- conclui: regra B — crédito parcelado também vira recebido
  perform public.complete_procedure(v_proc);

  select quantity into v_qty_after_complete from public.stock_items where id = v_stock;
  assert v_qty_after_complete = 99, format('esperado 99 após concluir (100 - 1), veio %s', v_qty_after_complete);

  select bool_and(paid) into v_paid_after_complete from public.financial_entries where procedure_id = v_proc;
  assert v_paid_after_complete, 'crédito parcelado deveria ficar recebido ao concluir (regra B)';

  -- edita o concluído: material 1 -> 3, preço 100 -> 150, parcelas 2 -> 3
  perform public.update_completed_procedure(v_proc, v_client, v_service, current_date, 150, 'obs editada',
    jsonb_build_array(jsonb_build_object('stock_item_id', v_stock, 'quantity_used', 3)),
    'cartao_credito', 3);

  select quantity into v_qty_after_edit from public.stock_items where id = v_stock;
  assert v_qty_after_edit = 97,
    format('esperado 97 após editar (99 devolve 1 -> 100, debita 3 -> 97), veio %s', v_qty_after_edit);

  select sum(amount), bool_and(paid) into v_amt_after_edit, v_paid_after_edit
    from public.financial_entries where procedure_id = v_proc;
  assert v_amt_after_edit = 150, format('esperado soma R$150 nas parcelas, veio %s', v_amt_after_edit);
  assert v_paid_after_edit, 'editar um concluído precisa manter tudo recebido (paid=true)';

  assert (select count(*) from public.financial_entries where procedure_id = v_proc) = 3,
    'esperado 3 parcelas após editar installments para 3';

  raise notice 'OK — update_completed_procedure reconcilia estoque e caixa corretamente';
end $$;

rollback;

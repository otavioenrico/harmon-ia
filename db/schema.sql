-- ============================================================================
-- Harmon IA — schema completo (Supabase / PostgreSQL)
-- ----------------------------------------------------------------------------
-- Como usar: abra o SQL Editor do seu projeto Supabase, cole este arquivo
-- INTEIRO e rode uma vez. É idempotente (pode rodar de novo sem quebrar).
--
-- Inclui: tabelas, Row Level Security em TODAS, trigger de updated_at,
-- índices úteis, a RPC atômica register_procedure() e o bucket de Storage.
-- ============================================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------------ helpers --
-- updated_at automático em qualquer tabela que tiver o trigger ligado.
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ============================================================ TABELAS ========

-- user_settings ---------------------------------------------------------------
create table if not exists public.user_settings (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid references auth.users(id) on delete cascade not null unique,
  google_refresh_token text,
  theme                text default 'light',         -- 'light' | 'dark'
  accent               text default 'rose',          -- rose | sand | sky | lilac | mint | neutral
  created_at           timestamptz default now(),
  updated_at           timestamptz default now()
);

-- services --------------------------------------------------------------------
create table if not exists public.services (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id) on delete cascade not null,
  name          text not null,
  description   text,
  default_price numeric(10,2),
  duration_min  integer,
  color         text,
  active        boolean default true,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- clients ---------------------------------------------------------------------
create table if not exists public.clients (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid references auth.users(id) on delete cascade not null,
  name              text not null,
  phone             text,
  email             text,
  birthdate         date,
  cpf               text,
  address_street    text,
  address_number    text,
  address_complement text,
  address_city      text,
  address_state     text,
  address_zip       text,
  notes             text,
  google_contact_id text,
  active            boolean default true,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

-- stock_items -----------------------------------------------------------------
create table if not exists public.stock_items (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid references auth.users(id) on delete cascade not null,
  name              text not null,
  description       text,
  photo_url         text,
  quantity          numeric(10,3) default 0,
  min_quantity      numeric(10,3) default 0,
  unit              text,
  cost_price        numeric(10,2),
  marketplace_links jsonb,                  -- [{"name":"Mercado Livre","url":"..."}]
  nf_attachment_url text,
  active            boolean default true,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

-- stock_transactions ----------------------------------------------------------
create table if not exists public.stock_transactions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id) on delete cascade not null,
  stock_item_id uuid references public.stock_items(id) on delete set null,
  type          text not null,             -- 'in' | 'out'
  quantity      numeric(10,3) not null,
  reason        text,                      -- compra | uso_procedimento | descarte | ajuste
  procedure_id  uuid,
  notes         text,
  created_at    timestamptz default now()
);

-- procedures ------------------------------------------------------------------
create table if not exists public.procedures (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users(id) on delete cascade not null,
  client_id       uuid references public.clients(id) on delete set null,
  service_id      uuid references public.services(id) on delete set null,
  date            date not null,
  price_charged   numeric(10,2),
  notes           text,
  google_event_id text,
  status          text default 'scheduled',  -- scheduled | completed | cancelled
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- procedure_materials ---------------------------------------------------------
-- FIX (análise 1.4): tabela ganhou user_id para a RLS padrão funcionar.
create table if not exists public.procedure_materials (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid references auth.users(id) on delete cascade not null,
  procedure_id      uuid references public.procedures(id) on delete cascade,
  stock_item_id     uuid references public.stock_items(id) on delete set null,
  quantity_used     numeric(10,3) not null,
  unit_cost_at_time numeric(10,2),
  created_at        timestamptz default now()
);

-- financial_entries -----------------------------------------------------------
create table if not exists public.financial_entries (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references auth.users(id) on delete cascade not null,
  type           text not null,            -- 'income' | 'expense'
  amount         numeric(10,2) not null,
  description    text,
  category       text,
  payment_method text,                     -- pix | cartao_credito | cartao_debito | dinheiro | parcelado
  installments   integer default 1,
  installment_of integer default 1,
  due_date       date,
  paid           boolean default false,
  paid_at        date,
  client_id      uuid references public.clients(id) on delete set null,
  procedure_id   uuid references public.procedures(id) on delete set null,
  notes          text,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

-- agenda_drafts ---------------------------------------------------------------
-- Rascunho de agendamento (item 17): NÃO vira evento no Google nem linha em
-- procedures até ser confirmado. Expiração de 7 dias é feita na leitura (não há
-- cron no projeto) — ver delete lazy no módulo Agenda.
create table if not exists public.agenda_drafts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id) on delete cascade not null,
  payload       jsonb not null,   -- { client_id, service_id, date, time, price, materials, ... }
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- shopping_list_items -----------------------------------------------------------
-- Item de estoque adicionado manualmente à lista de compras (além dos que já
-- entram automaticamente por estar abaixo do mínimo). Só marca presença —
-- "quanto comprar" continua vindo do cálculo min−atual quando aplicável.
create table if not exists public.shopping_list_items (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id) on delete cascade not null,
  stock_item_id uuid references public.stock_items(id) on delete cascade not null,
  created_at    timestamptz default now(),
  unique (user_id, stock_item_id)
);

-- return_dismissals ---------------------------------------------------------
-- Marca que a profissional já entrou em contato sobre um lembrete de retorno
-- (cliente+serviço). Um novo procedimento do mesmo serviço, mais recente que o
-- dismissal, volta a valer normalmente (comparação por data, não flag binária).
create table if not exists public.return_dismissals (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id) on delete cascade not null,
  client_id     uuid references public.clients(id) on delete cascade not null,
  service_id    uuid references public.services(id) on delete cascade not null,
  months        integer not null default 1,   -- marco dispensado: 1 | 3 | 6 | 12
  dismissed_at  timestamptz default now(),
  constraint return_dismissals_user_client_service_months_key
    unique (user_id, client_id, service_id, months)
);

-- migrações p/ bancos já implantados (idempotente) ----------------------------
alter table public.clients add column if not exists address_complement text;
alter table public.user_settings add column if not exists accent text default 'rose'; -- valores: rose | sand | sky | lilac | mint | neutral
alter table public.user_settings add column if not exists whatsapp_number text;

-- FIX (Rodada 6, bug 1.2): financial_entries.procedure_id não tinha FK — sem o
-- relacionamento, o PostgREST rejeita o embed `procedures(...)` usado pelo
-- Fluxo de Caixa (coluna Lucro) e a listagem inteira falha.
-- `not valid`: não varre linhas antigas ao criar (não trava a migração se
-- existir algum órfão histórico); o PostgREST só precisa da FK no catálogo.
do $$ begin
  alter table public.financial_entries
    add constraint financial_entries_procedure_id_fkey
    foreign key (procedure_id) references public.procedures(id) on delete set null
    not valid;
exception when duplicate_object then null;
end $$;

-- Rodada 6 (item 3.3): dismissal de retorno passa a ter marco (1/3/6/12 meses).
-- Confirmar o marco de 1 mês não silencia mais os de 3/6/12 — cada marco tem
-- seu próprio dismissal. Linhas antigas (sem marco) valem como marco de 1 mês.
alter table public.return_dismissals add column if not exists months integer not null default 1;
alter table public.return_dismissals drop constraint if exists return_dismissals_user_id_client_id_service_id_key;
do $$ begin
  alter table public.return_dismissals
    add constraint return_dismissals_user_client_service_months_key
    unique (user_id, client_id, service_id, months);
exception when duplicate_object then null; when duplicate_table then null;
end $$;

-- =================================================== updated_at triggers ======
do $$
declare t text;
begin
  foreach t in array array[
    'user_settings','services','clients','stock_items',
    'procedures','financial_entries','agenda_drafts'
  ] loop
    execute format('drop trigger if exists trg_updated_at on public.%I', t);
    execute format(
      'create trigger trg_updated_at before update on public.%I
       for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

-- ================================================================ índices =====
create index if not exists idx_services_user      on public.services(user_id);
create index if not exists idx_clients_user        on public.clients(user_id);
create index if not exists idx_stock_user          on public.stock_items(user_id);
create index if not exists idx_stocktx_user        on public.stock_transactions(user_id);
create index if not exists idx_stocktx_item        on public.stock_transactions(stock_item_id);
create index if not exists idx_proc_user           on public.procedures(user_id);
create index if not exists idx_proc_client         on public.procedures(client_id);
create index if not exists idx_procmat_proc        on public.procedure_materials(procedure_id);
create index if not exists idx_fin_user            on public.financial_entries(user_id);
create index if not exists idx_fin_due             on public.financial_entries(due_date);
create index if not exists idx_fin_proc            on public.financial_entries(procedure_id);
create index if not exists idx_proc_status         on public.procedures(status, date);
create index if not exists idx_drafts_user         on public.agenda_drafts(user_id);
create index if not exists idx_shopping_user        on public.shopping_list_items(user_id);
create index if not exists idx_retdis_user          on public.return_dismissals(user_id);

-- ============================================================ RLS =============
-- Cada conta Google só enxerga os próprios dados. USING + WITH CHECK explícitos
-- para cobrir leitura E escrita (INSERT/UPDATE).
do $$
declare t text;
begin
  foreach t in array array[
    'user_settings','services','clients','stock_items','stock_transactions',
    'procedures','procedure_materials','financial_entries','agenda_drafts',
    'shopping_list_items','return_dismissals'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "own_data" on public.%I', t);
    execute format(
      'create policy "own_data" on public.%I
       for all using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
  end loop;
end $$;

-- ============================================ RPC: registro de procedimento ===
-- FIX (análise 1.5): tudo em uma transação atômica. Cria o procedimento,
-- snapshot do custo dos materiais, débito de estoque (em SQL, sem corrida) e
-- os lançamentos financeiros (1 ou N parcelas). Roda como o usuário chamador
-- (security invoker) — a RLS protege e user_id = auth.uid().
create or replace function public.register_procedure(
  p_client_id       uuid,
  p_service_id      uuid,
  p_date            date,
  p_price_charged   numeric,
  p_notes           text,
  p_google_event_id text,
  p_materials       jsonb,    -- [{"stock_item_id":"uuid","quantity_used":2}]
  p_payment_method  text,
  p_installments    int,
  p_paid            boolean,  -- à vista: já entra pago?
  p_first_due_date  date
) returns uuid
language plpgsql as $$
declare
  v_user uuid := auth.uid();
  v_proc uuid;
  v_mat  jsonb;
  v_item uuid;
  v_qty  numeric;
  v_cost numeric;
  v_n    int := greatest(coalesce(p_installments, 1), 1);
  v_each numeric;
  v_acc  numeric := 0;
  v_amt  numeric;
  v_base date := coalesce(p_first_due_date, p_date);
  i      int;
begin
  if v_user is null then raise exception 'not authenticated'; end if;

  insert into public.procedures(
    user_id, client_id, service_id, date, price_charged, notes,
    google_event_id, status)
  values (
    v_user, p_client_id, p_service_id, p_date, p_price_charged, p_notes,
    p_google_event_id, 'completed')
  returning id into v_proc;

  -- materiais: snapshot do custo, transação 'out' e débito do estoque
  if p_materials is not null then
    for v_mat in select * from jsonb_array_elements(p_materials) loop
      v_item := (v_mat->>'stock_item_id')::uuid;
      v_qty  := (v_mat->>'quantity_used')::numeric;
      select cost_price into v_cost
        from public.stock_items where id = v_item and user_id = v_user;

      insert into public.procedure_materials(
        user_id, procedure_id, stock_item_id, quantity_used, unit_cost_at_time)
      values (v_user, v_proc, v_item, v_qty, v_cost);

      insert into public.stock_transactions(
        user_id, stock_item_id, type, quantity, reason, procedure_id)
      values (v_user, v_item, 'out', v_qty, 'uso_procedimento', v_proc);

      update public.stock_items
        set quantity = quantity - v_qty
        where id = v_item and user_id = v_user;
    end loop;
  end if;

  -- financeiro: 1 lançamento à vista, ou N parcelas mensais
  if p_price_charged is not null and p_price_charged > 0 then
    v_each := round(p_price_charged / v_n, 2);
    for i in 1..v_n loop
      if i < v_n then
        v_amt := v_each; v_acc := v_acc + v_each;
      else
        v_amt := p_price_charged - v_acc;   -- última parcela absorve o resto
      end if;
      insert into public.financial_entries(
        user_id, type, amount, description, category, payment_method,
        installments, installment_of, due_date, paid, paid_at,
        client_id, procedure_id)
      values (
        v_user, 'income', v_amt, 'Procedimento', 'procedimento', p_payment_method,
        v_n, i, (v_base + ((i - 1) || ' month')::interval)::date,
        case when v_n = 1 then coalesce(p_paid, false) else false end,
        case when v_n = 1 and coalesce(p_paid, false) then p_date else null end,
        p_client_id, v_proc);
    end loop;
  end if;

  return v_proc;
end $$;

-- ================================== RPC: agendar procedimento (item 8/14/1.1) ==
-- Cria procedures(status='scheduled') + reserva de materiais (custo congelado,
-- SEM debitar estoque) + parcelas financeiras pendentes (categoria
-- 'Agendamentos'). Nada é debitado até complete_procedure — cancelar/no-show
-- não deixa estoque nem caixa errados.
create or replace function public.schedule_procedure(
  p_client_id       uuid,
  p_service_id      uuid,
  p_date            date,
  p_price_charged   numeric,
  p_notes           text,
  p_google_event_id text,
  p_materials       jsonb,
  p_payment_method  text,
  p_installments    int
) returns uuid
language plpgsql as $$
declare
  v_user uuid := auth.uid();
  v_proc uuid;
  v_mat  jsonb;
  v_item uuid;
  v_qty  numeric;
  v_cost numeric;
  v_n    int := greatest(coalesce(p_installments, 1), 1);
  v_each numeric;
  v_acc  numeric := 0;
  v_amt  numeric;
  i      int;
begin
  if v_user is null then raise exception 'not authenticated'; end if;

  insert into public.procedures(
    user_id, client_id, service_id, date, price_charged, notes,
    google_event_id, status)
  values (
    v_user, p_client_id, p_service_id, p_date, p_price_charged, p_notes,
    p_google_event_id, 'scheduled')
  returning id into v_proc;

  -- materiais: só RESERVA (snapshot do custo). Sem stock_transactions/débito.
  if p_materials is not null then
    for v_mat in select * from jsonb_array_elements(p_materials) loop
      v_item := (v_mat->>'stock_item_id')::uuid;
      v_qty  := (v_mat->>'quantity_used')::numeric;
      select cost_price into v_cost
        from public.stock_items where id = v_item and user_id = v_user;
      insert into public.procedure_materials(
        user_id, procedure_id, stock_item_id, quantity_used, unit_cost_at_time)
      values (v_user, v_proc, v_item, v_qty, v_cost);
    end loop;
  end if;

  -- financeiro: N parcelas pendentes (nada pago até completar)
  if p_price_charged is not null and p_price_charged > 0 then
    v_each := round(p_price_charged / v_n, 2);
    for i in 1..v_n loop
      if i < v_n then v_amt := v_each; v_acc := v_acc + v_each;
      else v_amt := p_price_charged - v_acc; end if;
      insert into public.financial_entries(
        user_id, type, amount, description, category, payment_method,
        installments, installment_of, due_date, paid, client_id, procedure_id)
      values (
        v_user, 'income', v_amt, 'Agendamento', 'Agendamentos', p_payment_method,
        v_n, i, (p_date + ((i - 1) || ' month')::interval)::date,
        false, p_client_id, v_proc);
    end loop;
  end if;

  return v_proc;
end $$;

-- ===================== RPC: editar procedimento agendado (aprimoramento 6) =====
-- Só age sobre procedures.status='scheduled' (nada foi debitado/pago ainda —
-- ver schedule_procedure acima). Apaga e recria procedure_materials e as
-- parcelas pendentes com os dados novos, espelhando schedule_procedure.
-- completed/cancelled não passam por aqui (edição fica restrita no app).
create or replace function public.update_scheduled_procedure(
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
  v_mat  jsonb;
  v_item uuid;
  v_qty  numeric;
  v_cost numeric;
  v_n    int := greatest(coalesce(p_installments, 1), 1);
  v_each numeric;
  v_acc  numeric := 0;
  v_amt  numeric;
  i      int;
begin
  if v_user is null then raise exception 'not authenticated'; end if;

  update public.procedures
    set client_id = p_client_id, service_id = p_service_id, date = p_date,
        price_charged = p_price_charged, notes = p_notes
    where id = p_procedure_id and user_id = v_user and status = 'scheduled';
  if not found then
    raise exception 'procedimento não encontrado ou não está mais agendado';
  end if;

  delete from public.procedure_materials
    where procedure_id = p_procedure_id and user_id = v_user;
  if p_materials is not null then
    for v_mat in select * from jsonb_array_elements(p_materials) loop
      v_item := (v_mat->>'stock_item_id')::uuid;
      v_qty  := (v_mat->>'quantity_used')::numeric;
      select cost_price into v_cost
        from public.stock_items where id = v_item and user_id = v_user;
      insert into public.procedure_materials(
        user_id, procedure_id, stock_item_id, quantity_used, unit_cost_at_time)
      values (v_user, p_procedure_id, v_item, v_qty, v_cost);
    end loop;
  end if;

  -- só as parcelas pendentes existem para um procedimento scheduled — seguro
  -- apagar e recriar do zero com os novos valores.
  delete from public.financial_entries
    where procedure_id = p_procedure_id and user_id = v_user and paid = false;
  if p_price_charged is not null and p_price_charged > 0 then
    v_each := round(p_price_charged / v_n, 2);
    for i in 1..v_n loop
      if i < v_n then v_amt := v_each; v_acc := v_acc + v_each;
      else v_amt := p_price_charged - v_acc; end if;
      insert into public.financial_entries(
        user_id, type, amount, description, category, payment_method,
        installments, installment_of, due_date, paid, client_id, procedure_id)
      values (
        v_user, 'income', v_amt, 'Agendamento', 'Agendamentos', p_payment_method,
        v_n, i, (p_date + ((i - 1) || ' month')::interval)::date,
        false, p_client_id, p_procedure_id);
    end loop;
  end if;
end $$;

-- ============================= RPC: completar procedimento (item 8/14/1.1) =====
-- Debita o estoque dos materiais reservados (cria stock_transactions +
-- decrementa quantity) e marca status='completed'. À vista (pix/dinheiro/débito
-- em parcela única) confirma o pagamento; crédito/parcelado continua pendente.
-- ponytail: estoque pode ficar negativo (single-tenant, mesmo teto já aceito no
-- register_procedure); migrar p/ trava por item se houver concorrência real.
create or replace function public.complete_procedure(p_procedure_id uuid)
returns void
language plpgsql as $$
declare
  v_user uuid := auth.uid();
  v_date date;
  v_mat  record;
  v_n    int;
  v_method text;
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

  -- pagamento: à vista (parcela única + método à vista) confirma agora
  select count(*), min(payment_method) into v_n, v_method
    from public.financial_entries
    where procedure_id = p_procedure_id and user_id = v_user;
  update public.financial_entries
    set category = 'procedimento',
        paid    = case when v_n = 1 and v_method in ('pix','dinheiro','cartao_debito')
                       then true else paid end,
        paid_at = case when v_n = 1 and v_method in ('pix','dinheiro','cartao_debito')
                       then v_date else paid_at end
    where procedure_id = p_procedure_id and user_id = v_user;
end $$;

-- ============================= RPC: cancelar procedimento (item 1.1) ===========
-- Marca status='cancelled' e remove os lançamentos pendentes (nunca foram
-- receita real). Estoque nunca foi tocado no agendamento — nada a desfazer.
create or replace function public.cancel_procedure(p_procedure_id uuid)
returns void
language plpgsql as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  update public.procedures set status = 'cancelled'
    where id = p_procedure_id and user_id = v_user;
  delete from public.financial_entries
    where procedure_id = p_procedure_id and user_id = v_user and paid = false;
end $$;

-- ========================= RPC: excluir procedimentos (Rodada 7, limpeza) =====
-- Limpeza de histórico em massa: apaga os procedimentos selecionados E os
-- lançamentos ligados no caixa (a FK de financial_entries é on delete SET NULL,
-- então sem este delete explícito sobrariam lançamentos órfãos).
-- procedure_materials some via FK on delete cascade. Estoque NÃO é devolvido
-- (movimentações são história real — ajuste manual se preciso) e eventos do
-- Google Calendar não são tocados.
create or replace function public.delete_procedures(p_ids uuid[])
returns void
language plpgsql as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  delete from public.financial_entries
    where procedure_id = any(p_ids) and user_id = v_user;
  delete from public.procedures
    where id = any(p_ids) and user_id = v_user;
end $$;

-- ============================================================ STORAGE =========
-- Um bucket privado para fotos de itens e anexos de NF. Caminho sempre
-- prefixado pelo user_id: "<uid>/arquivo.jpg" — a policy garante isolamento.
insert into storage.buckets (id, name, public)
values ('uploads', 'uploads', false)
on conflict (id) do nothing;

drop policy if exists "uploads_own" on storage.objects;
create policy "uploads_own" on storage.objects
  for all to authenticated
  using (bucket_id = 'uploads' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'uploads' and (storage.foldername(name))[1] = auth.uid()::text);

-- ============================================================ FIM =============

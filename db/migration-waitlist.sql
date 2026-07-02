-- ============================================================================
-- Harmon IA — migration avulsa: tabela waitlist (Etapa 7, landing pré-lançamento)
-- ----------------------------------------------------------------------------
-- Rode isto se já aplicou o db/schema.sql antes e só precisa desta tabela nova.
-- Idempotente (pode rodar de novo sem quebrar). Já está incluída no
-- db/schema.sql completo — não precisa rodar os dois se for setup do zero.
-- ============================================================================

create table if not exists public.waitlist (
  id         uuid primary key default gen_random_uuid(),
  email      text not null unique,
  source     text,                      -- 'home' | 'planos' | ...
  created_at timestamptz default now()
);

alter table public.waitlist enable row level security;

drop policy if exists "waitlist_insert" on public.waitlist;
create policy "waitlist_insert" on public.waitlist
  for insert to anon, authenticated
  with check (true);

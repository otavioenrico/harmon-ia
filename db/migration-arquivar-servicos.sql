-- ============================================================================
-- Harmon IA — migration avulsa: arquivar serviço (2026-07-04)
-- ----------------------------------------------------------------------------
-- Rode isto se já aplicou o db/schema.sql antes e só precisa desta atualização.
-- Idempotente. Já está refletida em db/schema.sql — não precisa rodar os dois
-- se for setup do zero.
--
-- "Excluir" um serviço deixou de apagar a linha — a lixeira em Serviços agora
-- arquiva (archived=true). O serviço some da lista e dos filtros (Ativos/
-- Inativos/Todos), mas o registro continua existindo pro Histórico resolver
-- nome/cor de procedimentos já feitos com ele (JOIN procedures→services não
-- filtra archived).
-- ============================================================================

alter table public.services add column if not exists archived boolean not null default false;

-- ============================================================================
-- Harmon IA — migração P0 (2026-07-18): endurecimento de segurança.
-- ----------------------------------------------------------------------------
-- Rode isto no SQL Editor se o banco já existia antes do P0. Idempotente.
-- (As mesmas mudanças já estão no db/schema.sql para setups do zero.)
--
-- 1) waitlist: remove o INSERT anônimo. O formulário agora envia pro Worker
--    (/api/waitlist), que valida o Turnstile e insere via service role.
--    RLS ligada sem nenhuma policy = anon/authenticated não leem nem escrevem.
-- 2) bucket uploads: limites server-side de tamanho e tipo de arquivo
--    (antes só o client validava — qualquer coisa subia via API).
-- ============================================================================

alter table public.waitlist enable row level security;
drop policy if exists "waitlist_insert" on public.waitlist;

update storage.buckets
   set file_size_limit    = 10485760, -- 10 MB
       allowed_mime_types = array['image/webp','image/jpeg','image/png','image/heic','application/pdf']
 where id = 'uploads';

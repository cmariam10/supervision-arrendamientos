-- Run in Supabase SQL Editor. Add ONLY approved addresses, never passwords.
create table if not exists public.supervisores_autorizados (
 email text primary key check (email = lower(email)),
 activo boolean not null default true,
 creado_en timestamptz not null default now()
);
alter table public.supervisores_autorizados enable row level security;
-- No anon or authenticated table access; only Edge Function's service role can read.
revoke all on public.supervisores_autorizados from anon, authenticated;
-- After inviting users from Supabase Auth Dashboard, manually authorize:
-- insert into public.supervisores_autorizados(email) values ('correo@ejemplo.com');

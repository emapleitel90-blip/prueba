-- Ejecutar una vez en SQL Editor del proyecto Supabase.
-- Los correos permitidos se agregan al final; no usar claves secretas en el frontend.
create table if not exists public.filo_members (
  email text primary key check (email = lower(email))
);
create table if not exists public.filo_data (
  id text primary key check (id = 'familia'),
  payload jsonb not null,
  version integer not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.filo_members enable row level security;
alter table public.filo_data enable row level security;
revoke all on public.filo_members, public.filo_data from anon;
grant select on public.filo_members to authenticated;
grant select, update (payload, version, updated_at) on public.filo_data to authenticated;
drop policy if exists "Ver mi acceso" on public.filo_members;
create policy "Ver mi acceso" on public.filo_members for select to authenticated
using (email = lower(auth.jwt() ->> 'email'));
drop policy if exists "Familia lee datos" on public.filo_data;
create policy "Familia lee datos" on public.filo_data for select to authenticated
using (exists (select 1 from public.filo_members where email = lower(auth.jwt() ->> 'email')));
drop policy if exists "Familia actualiza datos" on public.filo_data;
create policy "Familia actualiza datos" on public.filo_data for update to authenticated
using (exists (select 1 from public.filo_members where email = lower(auth.jwt() ->> 'email')))
with check (exists (select 1 from public.filo_members where email = lower(auth.jwt() ->> 'email')));
insert into public.filo_data (id, payload) values
('familia', '{"demo":false,"stock":[],"recipes":[],"days":[],"expenses":[]}')
on conflict (id) do nothing;
-- Descomentar y reemplazar por los correos reales (no son contraseñas):
-- insert into public.filo_members(email) values
-- ('correo-mama@ejemplo.com'), ('correo-hermana@ejemplo.com')
-- on conflict (email) do nothing;

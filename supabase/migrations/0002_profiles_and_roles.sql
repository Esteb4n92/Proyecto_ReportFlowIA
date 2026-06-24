-- Autenticación + roles para ReportFlow IA.
--
-- Tabla `profiles`: una fila por usuario de auth.users, con su rol.
--   - role 'admin' → acceso completo a la app
--   - role 'user'  → cuenta válida pero sin acceso por ahora (pantalla de
--                    "acceso restringido"); soporte a futuro para personas naturales
-- El profile se crea automáticamente al registrarse un usuario (trigger), con
-- role = 'user' por defecto. La promoción a 'admin' se hace manualmente
-- (service role / SQL), nunca desde el cliente.

create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  role       text not null default 'user' check (role in ('admin', 'user')),
  created_at timestamptz not null default now()
);

comment on table public.profiles is
  'Perfil + rol de cada usuario. role: admin (acceso) | user (bloqueado por ahora).';

-- RLS: cada usuario solo puede leer su propia fila. No se exponen INSERT/UPDATE
-- a los clientes: el alta la hace el trigger (service) y la promoción de rol el
-- service role. Esto evita que un usuario se auto-promueva a admin.
alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = id);

-- El rol authenticated necesita el privilegio base de SELECT para que la policy
-- aplique (RLS filtra filas, no otorga el privilegio). Solo SELECT.
grant select on public.profiles to authenticated;

-- Crea el profile automáticamente cuando se registra un usuario nuevo.
-- SECURITY DEFINER porque inserta en public.profiles en nombre del sistema de
-- auth; search_path vacío + nombres calificados por seguridad. Solo tiene
-- sentido como trigger (usa NEW), no como función pública directa.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, role)
  values (new.id, 'user')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- EPIC 01 — configuração da loja (linha única) e administradores.
-- ADR-004: loja única. Público lê; apenas admin autenticado escreve.

-- ---------------------------------------------------------------------------
-- admins: quem pode escrever. Criada por SQL/painel; sem escrita via API.
-- ---------------------------------------------------------------------------
create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admins enable row level security;

revoke all on public.admins from anon, authenticated;
grant select on public.admins to authenticated;

-- Um admin enxerga apenas a própria linha (necessário para o app saber o papel).
create policy admins_select_self on public.admins
  for select to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- is_admin(): usada pelas policies. SECURITY DEFINER evita recursão de RLS.
-- ---------------------------------------------------------------------------
create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admins where user_id = (select auth.uid())
  );
$$;

-- O Supabase concede EXECUTE a anon/authenticated por default privileges; revogar só de
-- PUBLIC não basta, então revogamos também de anon explicitamente.
revoke all on function public.is_admin() from public, anon, authenticated;
grant execute on function public.is_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- store_settings: exatamente uma linha (id boolean sempre true).
-- ---------------------------------------------------------------------------
create table public.store_settings (
  id boolean primary key default true check (id),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  description text not null default '' check (char_length(description) <= 500),
  whatsapp_e164 text check (whatsapp_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  instagram text check (instagram ~ '^@?[A-Za-z0-9._]{1,30}$'),
  address text check (char_length(address) <= 200),
  hours text check (char_length(hours) <= 120),
  logo_path text,
  logo_full_path text,
  theme jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Função de trigger: não precisa ser chamável por nenhum papel da API.
revoke all on function public.set_updated_at() from public, anon, authenticated;

create trigger store_settings_set_updated_at
  before update on public.store_settings
  for each row execute function public.set_updated_at();

alter table public.store_settings enable row level security;

-- Sem DELETE para ninguém: a linha única nunca é removida via API.
revoke all on public.store_settings from anon, authenticated;
grant select on public.store_settings to anon, authenticated;
grant insert, update on public.store_settings to authenticated;

create policy store_settings_select_public on public.store_settings
  for select to anon, authenticated
  using (true);

create policy store_settings_insert_admin on public.store_settings
  for insert to authenticated
  with check (public.is_admin());

create policy store_settings_update_admin on public.store_settings
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

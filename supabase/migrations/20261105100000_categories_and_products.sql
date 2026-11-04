-- EPIC 02 (1/3) — categorias e produtos.
-- Público lê categorias e apenas produtos publicados (BR-011); admin lê/escreve/exclui tudo.
-- As regras de publicação (variantes, foto) entram nas migrations seguintes.

-- ---------------------------------------------------------------------------
-- categories
-- ---------------------------------------------------------------------------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  slug text not null unique
    check (char_length(slug) <= 80 and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index categories_position_idx on public.categories (position);

alter table public.categories enable row level security;

revoke all on public.categories from anon, authenticated;
grant select on public.categories to anon, authenticated;
grant insert, update, delete on public.categories to authenticated;

create policy categories_select_public on public.categories
  for select to anon, authenticated
  using (true);

create policy categories_insert_admin on public.categories
  for insert to authenticated
  with check (public.is_admin());

create policy categories_update_admin on public.categories
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy categories_delete_admin on public.categories
  for delete to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- products
-- ---------------------------------------------------------------------------
create table public.products (
  id uuid primary key default gen_random_uuid(),
  -- Excluir a categoria não apaga produtos: eles ficam sem categoria.
  category_id uuid references public.categories (id) on delete set null,
  slug text not null unique
    check (char_length(slug) <= 80 and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  description text not null default '' check (char_length(description) <= 2000),
  -- BRL em centavos; zero é válido (BR-013).
  base_price_cents bigint not null check (base_price_cents >= 0),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index products_status_created_idx on public.products (status, created_at desc);
create index products_category_status_idx on public.products (category_id, status);

create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

alter table public.products enable row level security;

revoke all on public.products from anon, authenticated;
grant select on public.products to anon, authenticated;
grant insert, update, delete on public.products to authenticated;

-- Público: somente produtos publicados.
create policy products_select_published on public.products
  for select to anon, authenticated
  using (status = 'published');

-- Admin: vê todos os estados (rascunho, publicado, arquivado).
create policy products_select_admin on public.products
  for select to authenticated
  using (public.is_admin());

create policy products_insert_admin on public.products
  for insert to authenticated
  with check (public.is_admin());

create policy products_update_admin on public.products
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- BR-015: o admin pode excluir qualquer produto.
create policy products_delete_admin on public.products
  for delete to authenticated
  using (public.is_admin());

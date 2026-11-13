-- EPIC 02 (2/3) — opções, valores, variantes e vínculos.
-- Integridade no banco (BR-017, BR-021, BR-022, BR-025): FKs compostas impedem referências
-- entre produtos; triggers aplicam limites e calculam a chave da combinação.
-- Regras de publicação (variante padrão, opções completas, foto) entram na migration 3/3.
-- Preço efetivo (BR-024) é resolvido na aplicação: price_override_cents ?? base_price_cents.

-- ---------------------------------------------------------------------------
-- product_options
-- ---------------------------------------------------------------------------
create table public.product_options (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  code text not null
    check (char_length(code) <= 40 and code ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  unique (product_id, code),
  unique (id, product_id)
);

-- ---------------------------------------------------------------------------
-- product_option_values (product_id denormalizado para as FKs compostas)
-- ---------------------------------------------------------------------------
create table public.product_option_values (
  id uuid primary key default gen_random_uuid(),
  option_id uuid not null,
  product_id uuid not null,
  label text not null check (char_length(btrim(label)) between 1 and 60),
  code text not null
    check (char_length(code) <= 40 and code ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  foreign key (option_id, product_id)
    references public.product_options (id, product_id) on delete cascade,
  unique (option_id, code),
  unique (id, product_id),
  unique (id, option_id)
);

create index product_option_values_product_idx on public.product_option_values (product_id);

-- ---------------------------------------------------------------------------
-- product_variants
-- combination_key é gerida por trigger (ids dos valores ordenados; '' = variante padrão).
-- ---------------------------------------------------------------------------
create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  combination_key text not null default '',
  -- null herda o preço base; zero é preço válido (BR-024).
  price_override_cents bigint check (price_override_cents is null or price_override_cents >= 0),
  is_available boolean not null default true,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, combination_key),
  unique (id, product_id)
);

create index product_variants_product_available_idx
  on public.product_variants (product_id, is_available);

create trigger product_variants_set_updated_at
  before update on public.product_variants
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- variant_option_values (product_id e option_id preenchidos por trigger a partir do valor)
-- ---------------------------------------------------------------------------
create table public.variant_option_values (
  variant_id uuid not null,
  option_value_id uuid not null,
  product_id uuid not null,
  option_id uuid not null,
  primary key (variant_id, option_value_id),
  foreign key (variant_id, product_id)
    references public.product_variants (id, product_id) on delete cascade,
  foreign key (option_value_id, product_id)
    references public.product_option_values (id, product_id) on delete cascade,
  foreign key (option_value_id, option_id)
    references public.product_option_values (id, option_id) on delete cascade,
  -- Exatamente uma escolha por opção em cada variante.
  unique (variant_id, option_id)
);

create index variant_option_values_value_idx on public.variant_option_values (option_value_id);
create index variant_option_values_product_idx on public.variant_option_values (product_id);

-- ---------------------------------------------------------------------------
-- Triggers de integridade (funções só de trigger: sem EXECUTE para a API)
-- ---------------------------------------------------------------------------

-- Campos que definem o "pai" de uma linha não podem mudar (evita burlar limites/FKs).
create function public.forbid_parent_change()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  col text;
begin
  foreach col in array tg_argv loop
    if to_jsonb(new) -> col is distinct from to_jsonb(old) -> col then
      raise exception 'column % of % is immutable', col, tg_table_name
        using errcode = 'check_violation';
    end if;
  end loop;
  return new;
end;
$$;

-- Limites por produto (BR-017). O FOR UPDATE no produto serializa inserções concorrentes.
create function public.enforce_product_limits()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  current_count integer;
begin
  perform 1 from public.products where id = new.product_id for update;

  if tg_table_name = 'product_options' then
    select count(*) into current_count from public.product_options where product_id = new.product_id;
    if current_count >= 2 then
      raise exception 'product cannot have more than 2 options' using errcode = 'check_violation';
    end if;
  elsif tg_table_name = 'product_option_values' then
    select count(*) into current_count from public.product_option_values where product_id = new.product_id;
    if current_count >= 20 then
      raise exception 'product cannot have more than 20 option values' using errcode = 'check_violation';
    end if;
  elsif tg_table_name = 'product_variants' then
    select count(*) into current_count from public.product_variants where product_id = new.product_id;
    if current_count >= 100 then
      raise exception 'product cannot have more than 100 variants' using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

-- Chave canônica da combinação: ids dos valores ordenados. Nunca vem do cliente.
create function public.set_variant_combination_key()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.combination_key := coalesce(
    (select string_agg(option_value_id::text, ',' order by option_value_id::text)
       from public.variant_option_values
      where variant_id = new.id),
    ''
  );
  return new;
end;
$$;

-- Preenche product_id/option_id do vínculo a partir do valor (ignora o que o cliente enviar).
create function public.fill_variant_option_value()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  select v.product_id, v.option_id
    into new.product_id, new.option_id
    from public.product_option_values v
   where v.id = new.option_value_id;

  if not found then
    raise exception 'option value not found' using errcode = 'foreign_key_violation';
  end if;
  return new;
end;
$$;

-- Recalcula a chave da variante após mudar seus vínculos; duplicata estoura o UNIQUE (BR-022).
create function public.refresh_variant_combination_key()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  target uuid := coalesce(new.variant_id, old.variant_id);
begin
  -- No-op de UPDATE: o BEFORE UPDATE de product_variants recalcula combination_key.
  update public.product_variants set position = position where id = target;
  return null;
end;
$$;

revoke all on function public.forbid_parent_change() from public, anon, authenticated;
revoke all on function public.enforce_product_limits() from public, anon, authenticated;
revoke all on function public.set_variant_combination_key() from public, anon, authenticated;
revoke all on function public.fill_variant_option_value() from public, anon, authenticated;
revoke all on function public.refresh_variant_combination_key() from public, anon, authenticated;

create trigger product_options_limits
  before insert on public.product_options
  for each row execute function public.enforce_product_limits();
create trigger product_option_values_limits
  before insert on public.product_option_values
  for each row execute function public.enforce_product_limits();
create trigger product_variants_limits
  before insert on public.product_variants
  for each row execute function public.enforce_product_limits();

create trigger product_options_immutable
  before update on public.product_options
  for each row execute function public.forbid_parent_change('product_id');
create trigger product_option_values_immutable
  before update on public.product_option_values
  for each row execute function public.forbid_parent_change('product_id', 'option_id');
create trigger product_variants_immutable
  before update on public.product_variants
  for each row execute function public.forbid_parent_change('product_id');

create trigger product_variants_combination_key
  before insert or update on public.product_variants
  for each row execute function public.set_variant_combination_key();

create trigger variant_option_values_fill
  before insert on public.variant_option_values
  for each row execute function public.fill_variant_option_value();
create trigger variant_option_values_refresh_key
  after insert or delete on public.variant_option_values
  for each row execute function public.refresh_variant_combination_key();

-- ---------------------------------------------------------------------------
-- RLS: público lê só o que pertence a produto publicado (BR-011); admin faz tudo.
-- ---------------------------------------------------------------------------
alter table public.product_options enable row level security;
alter table public.product_option_values enable row level security;
alter table public.product_variants enable row level security;
alter table public.variant_option_values enable row level security;

revoke all on public.product_options, public.product_option_values,
  public.product_variants, public.variant_option_values from anon, authenticated;

grant select on public.product_options, public.product_option_values,
  public.product_variants, public.variant_option_values to anon, authenticated;
grant insert, update, delete on public.product_options, public.product_option_values,
  public.product_variants to authenticated;
-- Vínculos são imutáveis: criar e excluir apenas.
grant insert, delete on public.variant_option_values to authenticated;

create policy product_options_select_public on public.product_options
  for select to anon, authenticated
  using (exists (
    select 1 from public.products p
    where p.id = product_options.product_id and p.status = 'published'
  ));
create policy product_options_select_admin on public.product_options
  for select to authenticated using (public.is_admin());
create policy product_options_insert_admin on public.product_options
  for insert to authenticated with check (public.is_admin());
create policy product_options_update_admin on public.product_options
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy product_options_delete_admin on public.product_options
  for delete to authenticated using (public.is_admin());

create policy product_option_values_select_public on public.product_option_values
  for select to anon, authenticated
  using (exists (
    select 1 from public.products p
    where p.id = product_option_values.product_id and p.status = 'published'
  ));
create policy product_option_values_select_admin on public.product_option_values
  for select to authenticated using (public.is_admin());
create policy product_option_values_insert_admin on public.product_option_values
  for insert to authenticated with check (public.is_admin());
create policy product_option_values_update_admin on public.product_option_values
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy product_option_values_delete_admin on public.product_option_values
  for delete to authenticated using (public.is_admin());

create policy product_variants_select_public on public.product_variants
  for select to anon, authenticated
  using (exists (
    select 1 from public.products p
    where p.id = product_variants.product_id and p.status = 'published'
  ));
create policy product_variants_select_admin on public.product_variants
  for select to authenticated using (public.is_admin());
create policy product_variants_insert_admin on public.product_variants
  for insert to authenticated with check (public.is_admin());
create policy product_variants_update_admin on public.product_variants
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy product_variants_delete_admin on public.product_variants
  for delete to authenticated using (public.is_admin());

create policy variant_option_values_select_public on public.variant_option_values
  for select to anon, authenticated
  using (exists (
    select 1 from public.products p
    where p.id = variant_option_values.product_id and p.status = 'published'
  ));
create policy variant_option_values_select_admin on public.variant_option_values
  for select to authenticated using (public.is_admin());
create policy variant_option_values_insert_admin on public.variant_option_values
  for insert to authenticated with check (public.is_admin());
create policy variant_option_values_delete_admin on public.variant_option_values
  for delete to authenticated using (public.is_admin());

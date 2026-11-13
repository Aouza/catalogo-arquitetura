-- EPIC 03 — fotos de produto.
-- OQ-04: bucket privado; só vira legível ao público quando o produto está publicado.
-- OQ-13: até 10 fotos por produto, 5 MB por arquivo, JPEG/PNG/WebP.
-- BR-016: publicar passa a exigir ao menos 1 foto ('no_images').
-- BR-030/032: foto geral (option_value_id nulo) ou ligada a um valor de opção do mesmo produto.

-- ---------------------------------------------------------------------------
-- product_images
-- ---------------------------------------------------------------------------
create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  option_value_id uuid,
  -- Caminho no bucket: '<product_id>/<arquivo>'.
  storage_path text not null unique
    check (char_length(storage_path) <= 200 and storage_path like product_id::text || '/%'),
  alt_text text not null default '' check (char_length(alt_text) <= 200),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  -- A cor (ou outro valor) precisa ser do próprio produto. Remover o valor remove as fotos dele.
  foreign key (option_value_id, product_id)
    references public.product_option_values (id, product_id) on delete cascade
);

create index product_images_product_position_idx on public.product_images (product_id, position);
create index product_images_option_value_idx on public.product_images (option_value_id);

-- ---------------------------------------------------------------------------
-- Triggers: limite de 10, posição automática, campos de identidade imutáveis
-- ---------------------------------------------------------------------------
-- enforce_product_limits ganha o ramo de imagens (mesma função das migrations anteriores).
create or replace function public.enforce_product_limits()
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
  elsif tg_table_name = 'product_images' then
    select count(*) into current_count from public.product_images where product_id = new.product_id;
    if current_count >= 10 then
      raise exception 'product cannot have more than 10 images' using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

-- Nova foto entra no fim da galeria (a reordenação usa reorder_product_images).
create function public.assign_product_image_position()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  select coalesce(max(position) + 1, 0) into new.position
    from public.product_images where product_id = new.product_id;
  return new;
end;
$$;

revoke all on function public.assign_product_image_position() from public, anon, authenticated;

create trigger product_images_limits
  before insert on public.product_images
  for each row execute function public.enforce_product_limits();
create trigger product_images_position
  before insert on public.product_images
  for each row execute function public.assign_product_image_position();
create trigger product_images_immutable
  before update on public.product_images
  for each row execute function public.forbid_parent_change('product_id', 'storage_path');

-- ---------------------------------------------------------------------------
-- Publicação exige foto (BR-016)
-- ---------------------------------------------------------------------------
create or replace function public.product_publication_issues(p_product_id uuid)
returns text[]
language plpgsql
stable
set search_path = ''
as $$
declare
  issues text[] := '{}';
  option_count integer;
  variant_count integer;
begin
  select count(*) into option_count
    from public.product_options where product_id = p_product_id;
  select count(*) into variant_count
    from public.product_variants where product_id = p_product_id;

  if variant_count = 0 then
    issues := array_append(issues, 'no_variants');
  end if;

  if exists (
    select 1 from public.product_options o
     where o.product_id = p_product_id
       and not exists (select 1 from public.product_option_values v where v.option_id = o.id)
  ) then
    issues := array_append(issues, 'option_without_values');
  end if;

  if exists (
    select 1 from public.product_variants pv
     where pv.product_id = p_product_id
       and (select count(*) from public.variant_option_values l where l.variant_id = pv.id)
           <> option_count
  ) then
    issues := array_append(issues, 'incomplete_variants');
  end if;

  if not exists (select 1 from public.product_images where product_id = p_product_id) then
    issues := array_append(issues, 'no_images');
  end if;

  return issues;
end;
$$;

-- Produto publicado não pode ficar sem foto (excluir a última foto é recusado no COMMIT).
create constraint trigger product_images_validate_published
  after insert or update or delete on public.product_images
  deferrable initially deferred
  for each row execute function public.validate_published_product();

-- ---------------------------------------------------------------------------
-- Reordenação atômica da galeria
-- ---------------------------------------------------------------------------
create function public.reorder_product_images(p_product_id uuid, p_image_ids uuid[])
returns void
language plpgsql
set search_path = ''
as $$
declare
  existing integer;
  matching integer;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;

  perform 1 from public.products where id = p_product_id for update;
  if not found then
    raise exception 'product not found' using errcode = 'no_data_found';
  end if;

  select count(*) into existing from public.product_images where product_id = p_product_id;
  select count(*) into matching
    from public.product_images
   where product_id = p_product_id and id = any (p_image_ids);

  -- A lista precisa conter exatamente as fotos do produto, sem repetição.
  if existing <> coalesce(cardinality(p_image_ids), 0)
     or matching <> existing
     or (select count(distinct x) from unnest(p_image_ids) x) <> existing then
    raise exception 'invalid image list' using errcode = 'check_violation';
  end if;

  update public.product_images pi
     set position = o.ord - 1
    from unnest(p_image_ids) with ordinality as o(id, ord)
   where pi.id = o.id and pi.product_id = p_product_id;
end;
$$;

revoke all on function public.reorder_product_images(uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.reorder_product_images(uuid, uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS da tabela: público lê fotos de produto publicado; admin faz tudo
-- ---------------------------------------------------------------------------
alter table public.product_images enable row level security;

revoke all on public.product_images from anon, authenticated;
grant select on public.product_images to anon, authenticated;
grant insert, update, delete on public.product_images to authenticated;

create policy product_images_select_public on public.product_images
  for select to anon, authenticated
  using (exists (
    select 1 from public.products p
    where p.id = product_images.product_id and p.status = 'published'
  ));
create policy product_images_select_admin on public.product_images
  for select to authenticated using (public.is_admin());
create policy product_images_insert_admin on public.product_images
  for insert to authenticated with check (public.is_admin());
create policy product_images_update_admin on public.product_images
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy product_images_delete_admin on public.product_images
  for delete to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Storage: bucket privado com limites; leitura pública só de foto de produto publicado
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy product_images_objects_select_admin on storage.objects
  for select to authenticated
  using (bucket_id = 'product-images' and public.is_admin());

-- Só objetos referenciados por uma foto de produto publicado (órfãos nunca são públicos).
create policy product_images_objects_select_published on storage.objects
  for select to anon, authenticated
  using (
    bucket_id = 'product-images'
    and exists (
      select 1
        from public.product_images i
        join public.products p on p.id = i.product_id
       where i.storage_path = storage.objects.name and p.status = 'published'
    )
  );

create policy product_images_objects_insert_admin on storage.objects
  for insert to authenticated
  with check (bucket_id = 'product-images' and public.is_admin());

create policy product_images_objects_update_admin on storage.objects
  for update to authenticated
  using (bucket_id = 'product-images' and public.is_admin())
  with check (bucket_id = 'product-images' and public.is_admin());

create policy product_images_objects_delete_admin on storage.objects
  for delete to authenticated
  using (bucket_id = 'product-images' and public.is_admin());

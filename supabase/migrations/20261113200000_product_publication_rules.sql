-- EPIC 02 (3/3) — regras de publicação e edição transacional da estrutura do produto.
-- BR-016 (exceto foto, ativada no EPIC 03), BR-014, BR-021, BR-028.
--
-- 1. product_publication_issues(): lista o que impede a publicação.
-- 2. Constraint triggers DEFERRED: produto `published` precisa estar válido no COMMIT,
--    por qualquer caminho de escrita; dentro de uma transação os passos intermediários
--    são permitidos.
-- 3. save_product_structure(): RPC que sincroniza opções, valores e variantes de uma vez,
--    inclusive em produto já publicado, sem despublicar.

-- ---------------------------------------------------------------------------
-- 1. Pendências de publicação
-- ---------------------------------------------------------------------------
-- Nome, slug e preço já são garantidos por constraints de `products`.
-- Foto: entra no EPIC 03, quando houver product_images (acrescentar 'no_images' aqui).
create function public.product_publication_issues(p_product_id uuid)
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

  -- Cada variante precisa de exatamente um valor por opção (BR-021). Sem opções, a única
  -- variante possível é a padrão, de chave '' (UNIQUE em product_id + combination_key).
  if exists (
    select 1 from public.product_variants pv
     where pv.product_id = p_product_id
       and (select count(*) from public.variant_option_values l where l.variant_id = pv.id)
           <> option_count
  ) then
    issues := array_append(issues, 'incomplete_variants');
  end if;

  return issues;
end;
$$;

revoke all on function public.product_publication_issues(uuid) from public, anon, authenticated;
grant execute on function public.product_publication_issues(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Validação no commit
-- ---------------------------------------------------------------------------
create function public.validate_published_product()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  target uuid;
  current_status text;
  issues text[];
begin
  if tg_table_name = 'products' then
    target := new.id;
  elsif tg_op = 'DELETE' then
    target := old.product_id;
  else
    target := new.product_id;
  end if;

  -- Produto excluído (inclusive em cascata) não é validado.
  select status into current_status from public.products where id = target;

  if current_status = 'published' then
    issues := public.product_publication_issues(target);
    if cardinality(issues) > 0 then
      raise exception 'product cannot be published: %', array_to_string(issues, ', ')
        using errcode = 'check_violation';
    end if;
  end if;

  return null;
end;
$$;

revoke all on function public.validate_published_product() from public, anon, authenticated;

create constraint trigger products_validate_published
  after insert or update of status on public.products
  deferrable initially deferred
  for each row execute function public.validate_published_product();

create constraint trigger product_options_validate_published
  after insert or update or delete on public.product_options
  deferrable initially deferred
  for each row execute function public.validate_published_product();

create constraint trigger product_option_values_validate_published
  after insert or update or delete on public.product_option_values
  deferrable initially deferred
  for each row execute function public.validate_published_product();

create constraint trigger product_variants_validate_published
  after insert or update or delete on public.product_variants
  deferrable initially deferred
  for each row execute function public.validate_published_product();

create constraint trigger variant_option_values_validate_published
  after insert or delete on public.variant_option_values
  deferrable initially deferred
  for each row execute function public.validate_published_product();

-- ---------------------------------------------------------------------------
-- 3. save_product_structure
--
-- p_options:  [{ "code", "name", "position"?, "values": [{ "code", "label", "position"? }] }]
-- p_variants: [{ "values": { "<option code>": "<value code>" },
--                "price_override_cents"?: int|null, "is_available"?: bool, "position"?: int }]
--
-- Produto simples: p_options = [] e uma única variante com "values": {}.
-- Sincroniza por código: opções e valores mantêm o id quando o código permanece (fotos de
-- cor do EPIC 03 apontam para o valor); variantes são identificadas pelo conjunto de
-- valores. Roda como SECURITY INVOKER: RLS e triggers de integridade continuam valendo, e
-- a validação de publicação ocorre no commit (falha desfaz tudo).
-- ---------------------------------------------------------------------------
create function public.save_product_structure(
  p_product_id uuid,
  p_options jsonb,
  p_variants jsonb
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_option jsonb;
  v_value jsonb;
  v_item jsonb;
  v_pair record;
  v_option_id uuid;
  v_value_id uuid;
  v_variant_id uuid;
  v_sig text;
  v_option_codes text[];
  v_value_codes text[];
  v_seen_sigs text[] := '{}';
  v_ord integer;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;

  if jsonb_typeof(p_options) is distinct from 'array'
     or jsonb_typeof(p_variants) is distinct from 'array' then
    raise exception 'invalid payload: options and variants must be arrays'
      using errcode = 'invalid_parameter_value';
  end if;

  -- Serializa edições concorrentes do mesmo produto.
  perform 1 from public.products where id = p_product_id for update;
  if not found then
    raise exception 'product not found' using errcode = 'no_data_found';
  end if;

  -- ---- validação do payload ------------------------------------------------
  select coalesce(array_agg(o ->> 'code'), '{}') into v_option_codes
    from jsonb_array_elements(p_options) o;

  if (select count(distinct o ->> 'code') from jsonb_array_elements(p_options) o)
     <> jsonb_array_length(p_options) then
    raise exception 'invalid payload: duplicate option code' using errcode = 'check_violation';
  end if;

  for v_option in select value from jsonb_array_elements(p_options) loop
    if jsonb_typeof(v_option -> 'values') is distinct from 'array' then
      raise exception 'invalid payload: option values must be an array'
        using errcode = 'invalid_parameter_value';
    end if;
    if (select count(distinct x ->> 'code') from jsonb_array_elements(v_option -> 'values') x)
       <> jsonb_array_length(v_option -> 'values') then
      raise exception 'invalid payload: duplicate value code' using errcode = 'check_violation';
    end if;
  end loop;

  for v_item in select value from jsonb_array_elements(p_variants) loop
    if jsonb_typeof(v_item -> 'values') is distinct from 'object' then
      raise exception 'invalid payload: variant values must be an object'
        using errcode = 'invalid_parameter_value';
    end if;

    if (select count(*) from jsonb_each_text(v_item -> 'values'))
       <> cardinality(v_option_codes) then
      raise exception 'invalid payload: variant must have exactly one value per option'
        using errcode = 'check_violation';
    end if;

    for v_pair in select k, v from jsonb_each_text(v_item -> 'values') as e(k, v) loop
      if not exists (
        select 1
          from jsonb_array_elements(p_options) o,
               jsonb_array_elements(o -> 'values') x
         where o ->> 'code' = v_pair.k and x ->> 'code' = v_pair.v
      ) then
        raise exception 'invalid payload: unknown option value %=%', v_pair.k, v_pair.v
          using errcode = 'check_violation';
      end if;
    end loop;

    v_sig := coalesce(
      (select string_agg(k || '=' || v, ',' order by k)
         from jsonb_each_text(v_item -> 'values') as e(k, v)),
      ''
    );
    if v_sig = any (v_seen_sigs) then
      raise exception 'invalid payload: duplicate variant combination'
        using errcode = 'check_violation';
    end if;
    v_seen_sigs := v_seen_sigs || v_sig;
  end loop;

  -- ---- remoções (antes das inserções, para respeitar os limites) -----------
  -- Variantes cuja combinação não está no payload.
  delete from public.product_variants pv
   where pv.product_id = p_product_id
     and not (
       coalesce(
         (select string_agg(o.code || '=' || val.code, ',' order by o.code)
            from public.variant_option_values l
            join public.product_option_values val on val.id = l.option_value_id
            join public.product_options o on o.id = val.option_id
           where l.variant_id = pv.id),
         ''
       ) = any (v_seen_sigs)
     );

  -- Opções que saíram do payload (valores e vínculos saem em cascata).
  delete from public.product_options
   where product_id = p_product_id and code <> all (v_option_codes);

  -- ---- opções e remoção de valores ----------------------------------------
  v_ord := 0;
  for v_option in select value from jsonb_array_elements(p_options) loop
    update public.product_options
       set name = v_option ->> 'name',
           position = coalesce((v_option ->> 'position')::integer, v_ord)
     where product_id = p_product_id and code = v_option ->> 'code'
    returning id into v_option_id;

    if not found then
      insert into public.product_options (product_id, code, name, position)
      values (
        p_product_id,
        v_option ->> 'code',
        v_option ->> 'name',
        coalesce((v_option ->> 'position')::integer, v_ord)
      )
      returning id into v_option_id;
    end if;

    select coalesce(array_agg(x ->> 'code'), '{}') into v_value_codes
      from jsonb_array_elements(v_option -> 'values') x;

    delete from public.product_option_values
     where option_id = v_option_id and code <> all (v_value_codes);

    v_ord := v_ord + 1;
  end loop;

  -- ---- valores ---------------------------------------------------------------
  for v_option in select value from jsonb_array_elements(p_options) loop
    select id into v_option_id
      from public.product_options
     where product_id = p_product_id and code = v_option ->> 'code';

    v_ord := 0;
    for v_value in select value from jsonb_array_elements(v_option -> 'values') loop
      update public.product_option_values
         set label = v_value ->> 'label',
             position = coalesce((v_value ->> 'position')::integer, v_ord)
       where option_id = v_option_id and code = v_value ->> 'code';

      if not found then
        insert into public.product_option_values (option_id, product_id, code, label, position)
        values (
          v_option_id,
          p_product_id,
          v_value ->> 'code',
          v_value ->> 'label',
          coalesce((v_value ->> 'position')::integer, v_ord)
        );
      end if;

      v_ord := v_ord + 1;
    end loop;
  end loop;

  -- ---- variantes -----------------------------------------------------------
  v_ord := 0;
  for v_item in select value from jsonb_array_elements(p_variants) loop
    v_sig := coalesce(
      (select string_agg(k || '=' || v, ',' order by k)
         from jsonb_each_text(v_item -> 'values') as e(k, v)),
      ''
    );

    select pv.id into v_variant_id
      from public.product_variants pv
     where pv.product_id = p_product_id
       and coalesce(
             (select string_agg(o.code || '=' || val.code, ',' order by o.code)
                from public.variant_option_values l
                join public.product_option_values val on val.id = l.option_value_id
                join public.product_options o on o.id = val.option_id
               where l.variant_id = pv.id),
             ''
           ) = v_sig;

    if v_variant_id is not null then
      update public.product_variants
         set price_override_cents = (v_item ->> 'price_override_cents')::bigint,
             is_available = coalesce((v_item ->> 'is_available')::boolean, true),
             position = coalesce((v_item ->> 'position')::integer, v_ord)
       where id = v_variant_id;
    else
      insert into public.product_variants (product_id, price_override_cents, is_available, position)
      values (
        p_product_id,
        (v_item ->> 'price_override_cents')::bigint,
        coalesce((v_item ->> 'is_available')::boolean, true),
        coalesce((v_item ->> 'position')::integer, v_ord)
      )
      returning id into v_variant_id;

      for v_pair in select k, v from jsonb_each_text(v_item -> 'values') as e(k, v) loop
        insert into public.variant_option_values (variant_id, option_value_id)
        select v_variant_id, val.id
          from public.product_option_values val
          join public.product_options o on o.id = val.option_id
         where o.product_id = p_product_id and o.code = v_pair.k and val.code = v_pair.v;
      end loop;
    end if;

    v_ord := v_ord + 1;
  end loop;

  update public.products set updated_at = now() where id = p_product_id;
end;
$$;

revoke all on function public.save_product_structure(uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.save_product_structure(uuid, jsonb, jsonb) to authenticated;

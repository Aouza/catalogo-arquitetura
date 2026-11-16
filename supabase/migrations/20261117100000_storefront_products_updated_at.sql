-- EPIC 06 — o mapa do site (sitemap) informa a data da última alteração de cada produto.
-- Mesma visão da migration anterior, com `updated_at` acrescentada ao final (única forma
-- permitida por CREATE OR REPLACE VIEW). Nenhuma outra coluna ou regra mudou.

create or replace view public.storefront_products
with (security_invoker = true) as
select
  p.id,
  p.slug,
  p.name,
  p.category_id,
  p.created_at,
  coalesce(v.min_price, p.base_price_cents) as price_cents,
  coalesce(v.min_price <> v.max_price, false) as price_varies,
  coalesce(v.any_available, false) as is_available,
  c.storage_path as cover_path,
  c.alt_text as cover_alt,
  p.updated_at
from public.products p
left join lateral (
  select
    bool_or(pv.is_available) as any_available,
    coalesce(
      min(coalesce(pv.price_override_cents, p.base_price_cents)) filter (where pv.is_available),
      min(coalesce(pv.price_override_cents, p.base_price_cents))
    ) as min_price,
    coalesce(
      max(coalesce(pv.price_override_cents, p.base_price_cents)) filter (where pv.is_available),
      max(coalesce(pv.price_override_cents, p.base_price_cents))
    ) as max_price
  from public.product_variants pv
  where pv.product_id = p.id
) v on true
left join lateral (
  select i.storage_path, i.alt_text
  from public.product_images i
  where i.product_id = p.id
  order by (i.option_value_id is not null), i.position, i.created_at
  limit 1
) c on true
where p.status = 'published';

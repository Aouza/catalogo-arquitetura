-- EPIC 05 — dados da vitrine pública.
-- Uma visão com apenas o que a listagem pode mostrar: produtos publicados, preço de partida,
-- disponibilidade e foto de capa. Evita montar isso no app com várias consultas (e esbarrar no
-- limite de linhas por resposta da API).
--
-- security_invoker: as policies (RLS) das tabelas continuam valendo para quem consulta; o filtro
-- por status é repetido aqui para a visão nunca listar rascunho, nem para um admin logado.

create view public.storefront_products
with (security_invoker = true) as
select
  p.id,
  p.slug,
  p.name,
  p.category_id,
  p.created_at,
  -- Preço de partida: o menor preço efetivo entre as combinações disponíveis (BR-024); se nenhuma
  -- estiver disponível, entre todas; sem combinações, o preço base.
  coalesce(v.min_price, p.base_price_cents) as price_cents,
  coalesce(v.min_price <> v.max_price, false) as price_varies,
  coalesce(v.any_available, false) as is_available,
  -- Capa: fotos gerais primeiro, depois pela ordem da galeria (BR-031).
  c.storage_path as cover_path,
  c.alt_text as cover_alt
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

revoke all on public.storefront_products from anon, authenticated;
grant select on public.storefront_products to anon, authenticated;

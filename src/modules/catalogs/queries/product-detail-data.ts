import type { SupabaseClient } from "@supabase/supabase-js";
import { SLUG_PATTERN } from "@/modules/products/slug";
import type { DetailImage, DetailOption, DetailVariant, ProductDetail } from "../product-detail";
import { photoUrl } from "./storefront-data";

const byPosition = <T extends { position: number }>(a: T, b: T) => a.position - b.position;

/**
 * Produto publicado com opções, combinações e fotos, ou `null` se não existe ou não está publicado
 * (rascunho, arquivado e excluído respondem igual: link compartilhado que deixou de valer vira 404).
 * Usa o cliente anônimo: a RLS só entrega dados de produto publicado.
 */
export async function fetchProductDetail(client: SupabaseClient, slug: string): Promise<ProductDetail | null> {
  if (!SLUG_PATTERN.test(slug) || slug.length > 80) return null;

  const { data: product, error } = await client
    .from("products")
    .select("id, slug, name, description, base_price_cents")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (error) throw new Error(`Falha ao ler o produto: ${error.message}`);
  if (!product) return null;

  const productId = product.id as string;
  const [options, values, variants, links, images] = await Promise.all([
    client.from("product_options").select("id, code, name, position").eq("product_id", productId),
    client.from("product_option_values").select("id, option_id, code, label, position").eq("product_id", productId),
    client.from("product_variants").select("id, price_override_cents, is_available, position").eq("product_id", productId),
    client.from("variant_option_values").select("variant_id, option_id, option_value_id").eq("product_id", productId),
    client
      .from("product_images")
      .select("id, storage_path, alt_text, option_value_id, position")
      .eq("product_id", productId)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true }),
  ]);
  const failure = [options, values, variants, links, images].find((result) => result.error);
  if (failure?.error) throw new Error(`Falha ao ler os detalhes do produto: ${failure.error.message}`);

  const base = Number(product.base_price_cents);
  const optionRows = [...(options.data ?? [])].sort(byPosition);
  const valueRows = values.data ?? [];
  const optionCode = new Map(optionRows.map((row) => [row.id as string, row.code as string]));
  const valueCode = new Map(valueRows.map((row) => [row.id as string, row.code as string]));

  const detailOptions: DetailOption[] = optionRows.map((option) => ({
    code: option.code as string,
    name: option.name as string,
    values: valueRows
      .filter((value) => value.option_id === option.id)
      .sort(byPosition)
      .map((value) => ({ id: value.id as string, code: value.code as string, label: value.label as string })),
  }));

  const valuesByVariant = new Map<string, Record<string, string>>();
  for (const link of links.data ?? []) {
    const map = valuesByVariant.get(link.variant_id as string) ?? {};
    const optionKey = optionCode.get(link.option_id as string);
    const valueKey = valueCode.get(link.option_value_id as string);
    if (optionKey && valueKey) map[optionKey] = valueKey;
    valuesByVariant.set(link.variant_id as string, map);
  }

  const detailVariants: DetailVariant[] = [...(variants.data ?? [])].sort(byPosition).map((variant) => ({
    id: variant.id as string,
    values: valuesByVariant.get(variant.id as string) ?? {},
    priceCents: variant.price_override_cents === null ? base : Number(variant.price_override_cents),
    isAvailable: variant.is_available as boolean,
  }));

  const detailImages: DetailImage[] = (images.data ?? []).map((image) => ({
    id: image.id as string,
    path: photoUrl(image.storage_path as string),
    alt: (image.alt_text as string).trim(),
    optionValueId: (image.option_value_id as string | null) ?? null,
    position: image.position as number,
  }));

  return {
    id: productId,
    slug: product.slug as string,
    name: product.name as string,
    description: product.description as string,
    basePriceCents: base,
    options: detailOptions,
    variants: detailVariants,
    images: detailImages,
  };
}

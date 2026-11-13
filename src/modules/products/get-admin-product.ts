import type { SupabaseClient } from "@supabase/supabase-js";
import { describePublicationIssue, fail, mapDbError, notFound, ok, type Result } from "./errors";
import { effectivePriceCents } from "./price";
import type { ProductStatus } from "./set-status";

export type AdminProduct = {
  id: string;
  slug: string;
  name: string;
  description: string;
  categoryId: string | null;
  basePriceCents: number;
  status: ProductStatus;
  options: {
    id: string;
    code: string;
    name: string;
    position: number;
    values: { id: string; code: string; label: string; position: number }[];
  }[];
  variants: {
    id: string;
    /** Código da opção → código do valor (vazio em produto simples). */
    values: Record<string, string>;
    priceOverrideCents: number | null;
    effectivePriceCents: number;
    isAvailable: boolean;
    position: number;
  }[];
  /** Mensagens do que falta para poder publicar (vazio = pronto). */
  publicationIssues: string[];
};

const byPosition = <T extends { position: number }>(a: T, b: T) => a.position - b.position;

/** Lê o produto completo para edição no admin (inclui rascunho e arquivado). */
export async function getAdminProduct(
  client: SupabaseClient,
  productId: string,
): Promise<Result<AdminProduct>> {
  const { data: product, error } = await client
    .from("products")
    .select("id, slug, name, description, category_id, base_price_cents, status")
    .eq("id", productId)
    .maybeSingle();

  if (error) return fail(mapDbError(error));
  if (!product) return fail(notFound());

  const [options, values, variants, links, issues] = await Promise.all([
    client.from("product_options").select("id, code, name, position").eq("product_id", productId),
    client
      .from("product_option_values")
      .select("id, option_id, code, label, position")
      .eq("product_id", productId),
    client
      .from("product_variants")
      .select("id, price_override_cents, is_available, position")
      .eq("product_id", productId),
    client
      .from("variant_option_values")
      .select("variant_id, option_value_id, option_id")
      .eq("product_id", productId),
    client.rpc("product_publication_issues", { p_product_id: productId }),
  ]);

  for (const result of [options, values, variants, links, issues]) {
    if (result.error) return fail(mapDbError(result.error));
  }

  const optionRows = [...(options.data ?? [])].sort(byPosition);
  const valueRows = values.data ?? [];
  const optionCodeById = new Map(optionRows.map((o) => [o.id as string, o.code as string]));
  const valueCodeById = new Map(valueRows.map((v) => [v.id as string, v.code as string]));

  const valuesByVariant = new Map<string, Record<string, string>>();
  for (const link of links.data ?? []) {
    const map = valuesByVariant.get(link.variant_id as string) ?? {};
    const optionCode = optionCodeById.get(link.option_id as string);
    const valueCode = valueCodeById.get(link.option_value_id as string);
    if (optionCode && valueCode) map[optionCode] = valueCode;
    valuesByVariant.set(link.variant_id as string, map);
  }

  const base = Number(product.base_price_cents);

  return ok({
    id: product.id as string,
    slug: product.slug as string,
    name: product.name as string,
    description: product.description as string,
    categoryId: (product.category_id as string | null) ?? null,
    basePriceCents: base,
    status: product.status as ProductStatus,
    options: optionRows.map((option) => ({
      id: option.id as string,
      code: option.code as string,
      name: option.name as string,
      position: option.position as number,
      values: valueRows
        .filter((value) => value.option_id === option.id)
        .map((value) => ({
          id: value.id as string,
          code: value.code as string,
          label: value.label as string,
          position: value.position as number,
        }))
        .sort(byPosition),
    })),
    variants: (variants.data ?? [])
      .map((variant) => {
        const override =
          variant.price_override_cents === null ? null : Number(variant.price_override_cents);
        return {
          id: variant.id as string,
          values: valuesByVariant.get(variant.id as string) ?? {},
          priceOverrideCents: override,
          effectivePriceCents: effectivePriceCents(base, override),
          isAvailable: variant.is_available as boolean,
          position: variant.position as number,
        };
      })
      .sort(byPosition),
    publicationIssues: ((issues.data as string[] | null) ?? []).map(describePublicationIssue),
  });
}

import type { SupabaseClient } from "@supabase/supabase-js";
import { fail, mapDbError, ok, type Result } from "./errors";
import { structureSchema, validationError, type StructureInput } from "./schemas";

/**
 * Salva opções, valores e variantes numa única transação (inclusive em produto publicado).
 * Se o resultado deixar o produto publicado incompleto, tudo é desfeito.
 */
export async function saveProductStructure(
  client: SupabaseClient,
  productId: string,
  input: StructureInput,
): Promise<Result<null>> {
  const parsed = structureSchema.safeParse(input);
  if (!parsed.success) return fail(validationError(parsed.error));

  const { options, variants } = parsed.data;
  const { error } = await client.rpc("save_product_structure", {
    p_product_id: productId,
    p_options: options,
    p_variants: variants.map((variant) => ({
      values: variant.values,
      price_override_cents: variant.priceOverrideCents ?? null,
      is_available: variant.isAvailable ?? true,
      position: variant.position,
    })),
  });

  if (error) return fail(mapDbError(error));
  return ok(null);
}

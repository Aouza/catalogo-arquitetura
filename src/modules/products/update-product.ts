import type { SupabaseClient } from "@supabase/supabase-js";
import { fail, mapDbError, notFound, ok, type Result } from "./errors";
import { updateProductSchema, validationError, type UpdateProductInput } from "./schemas";

/** Edita dados básicos. O slug só muda se for informado (renomear não quebra links). */
export async function updateProduct(
  client: SupabaseClient,
  productId: string,
  input: UpdateProductInput,
): Promise<Result<{ id: string }>> {
  const parsed = updateProductSchema.safeParse(input);
  if (!parsed.success) return fail(validationError(parsed.error));

  const { name, description, basePriceCents, categoryId, slug } = parsed.data;
  const changes = {
    ...(name !== undefined && { name }),
    ...(description !== undefined && { description }),
    ...(basePriceCents !== undefined && { base_price_cents: basePriceCents }),
    ...(categoryId !== undefined && { category_id: categoryId }),
    ...(slug !== undefined && { slug }),
  };

  const { data, error } = await client
    .from("products")
    .update(changes)
    .eq("id", productId)
    .select("id");

  if (error) return fail(mapDbError(error));
  if (!data || data.length === 0) return fail(notFound());
  return ok({ id: productId });
}

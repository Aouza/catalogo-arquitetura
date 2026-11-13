import type { SupabaseClient } from "@supabase/supabase-js";
import { fail, mapDbError, notFound, ok, type Result } from "./errors";

/** Exclusão definitiva (BR-015): remove também opções, valores e variantes em cascata. */
export async function deleteProduct(
  client: SupabaseClient,
  productId: string,
): Promise<Result<null>> {
  const { data, error } = await client.from("products").delete().eq("id", productId).select("id");

  if (error) return fail(mapDbError(error));
  if (!data || data.length === 0) return fail(notFound());
  return ok(null);
}

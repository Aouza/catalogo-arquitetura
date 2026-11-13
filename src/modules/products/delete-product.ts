import type { SupabaseClient } from "@supabase/supabase-js";
import { removeProductFiles } from "@/modules/media/cleanup-files";
import { fail, mapDbError, notFound, ok, type Result } from "./errors";

/**
 * Exclusão definitiva (BR-015): remove também opções, valores, variantes e fotos em cascata,
 * e depois apaga os arquivos do Storage. Se a limpeza dos arquivos falhar, a exclusão vale e a
 * rotina de limpeza de órfãos recolhe os arquivos depois.
 */
export async function deleteProduct(
  client: SupabaseClient,
  productId: string,
): Promise<Result<null>> {
  const { data, error } = await client.from("products").delete().eq("id", productId).select("id");

  if (error) return fail(mapDbError(error));
  if (!data || data.length === 0) return fail(notFound());

  await removeProductFiles(client, productId);
  return ok(null);
}

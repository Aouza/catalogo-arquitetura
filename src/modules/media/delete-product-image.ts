import type { SupabaseClient } from "@supabase/supabase-js";
import { fail, mapDbError, ok, type ProductError, type Result } from "@/modules/products/errors";
import { PRODUCT_IMAGES_BUCKET } from "./constants";

const imageNotFound = (): ProductError => ({ code: "not_found", message: "Foto não encontrada." });

/**
 * Remove a foto (BR-033). O registro sai primeiro: se o produto estiver publicado e esta for
 * a última foto, o banco recusa. O arquivo é apagado em seguida; se isso falhar, a rotina de
 * limpeza de órfãos o recolhe depois.
 */
export async function deleteProductImage(
  client: SupabaseClient,
  imageId: string,
): Promise<Result<null>> {
  const { data, error } = await client
    .from("product_images")
    .delete()
    .eq("id", imageId)
    .select("storage_path");

  if (error) return fail(mapDbError(error));
  if (!data || data.length === 0) return fail(imageNotFound());

  await client.storage.from(PRODUCT_IMAGES_BUCKET).remove([data[0].storage_path as string]);
  return ok(null);
}

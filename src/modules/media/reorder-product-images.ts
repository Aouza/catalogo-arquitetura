import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { fail, mapDbError, ok, type Result } from "@/modules/products/errors";
import { validationError } from "@/modules/products/schemas";
import { MAX_IMAGES_PER_PRODUCT } from "./constants";

const schema = z.array(z.uuid("Foto inválida.")).max(MAX_IMAGES_PER_PRODUCT);

/** Define a ordem da galeria. A lista precisa conter todas as fotos do produto, sem repetir. */
export async function reorderProductImages(
  client: SupabaseClient,
  productId: string,
  orderedImageIds: string[],
): Promise<Result<null>> {
  const parsed = schema.safeParse(orderedImageIds);
  if (!parsed.success) return fail(validationError(parsed.error));

  const { error } = await client.rpc("reorder_product_images", {
    p_product_id: productId,
    p_image_ids: parsed.data,
  });

  if (error) return fail(mapDbError(error));
  return ok(null);
}

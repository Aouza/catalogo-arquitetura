import type { SupabaseClient } from "@supabase/supabase-js";
import { fail, mapDbError, ok, type Result } from "@/modules/products/errors";
import { PRODUCT_IMAGES_BUCKET, SIGNED_URL_TTL_SECONDS } from "./constants";
import {
  PRODUCT_IMAGE_COLUMNS,
  toProductImage,
  type ProductImage,
  type ProductImageRow,
} from "./types";

export type ProductImageWithUrl = ProductImage & {
  /** URL assinada temporária (bucket privado); `null` se não foi possível gerar. */
  url: string | null;
};

/** Lista as fotos do produto, na ordem da galeria, com URL temporária para exibição. */
export async function listProductImages(
  client: SupabaseClient,
  productId: string,
): Promise<Result<ProductImageWithUrl[]>> {
  const { data, error } = await client
    .from("product_images")
    .select(PRODUCT_IMAGE_COLUMNS)
    .eq("product_id", productId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) return fail(mapDbError(error));

  const images = (data as ProductImageRow[]).map(toProductImage);
  if (images.length === 0) return ok([]);

  const signed = await client.storage
    .from(PRODUCT_IMAGES_BUCKET)
    .createSignedUrls(
      images.map((image) => image.storagePath),
      SIGNED_URL_TTL_SECONDS,
    );

  const urlByPath = new Map<string, string>();
  for (const item of signed.data ?? []) {
    if (item.path && item.signedUrl) urlByPath.set(item.path, item.signedUrl);
  }

  return ok(images.map((image) => ({ ...image, url: urlByPath.get(image.storagePath) ?? null })));
}

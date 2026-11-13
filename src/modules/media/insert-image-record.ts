import type { SupabaseClient } from "@supabase/supabase-js";
import { fail, mapDbError, ok, type Result } from "@/modules/products/errors";
import { PRODUCT_IMAGE_COLUMNS, toProductImage, type ProductImage, type ProductImageRow } from "./types";

export type InsertImageArgs = {
  productId: string;
  path: string;
  altText: string;
  optionValueId: string | null;
};

/**
 * Registra a foto no produto. `duplicate` indica que o caminho já estava cadastrado: nesse caso
 * o arquivo pertence a uma foto existente e NÃO pode ser apagado por quem chamou.
 */
export async function insertImageRecord(
  client: SupabaseClient,
  args: InsertImageArgs,
): Promise<{ result: Result<ProductImage>; duplicate: boolean }> {
  const { data, error } = await client
    .from("product_images")
    .insert({
      product_id: args.productId,
      option_value_id: args.optionValueId,
      storage_path: args.path,
      alt_text: args.altText,
    })
    .select(PRODUCT_IMAGE_COLUMNS)
    .single();

  if (!error) return { result: ok(toProductImage(data as ProductImageRow)), duplicate: false };

  if (error.code === "23505") {
    return {
      result: fail({ code: "validation", message: "Esta foto já foi cadastrada." }),
      duplicate: true,
    };
  }
  if (error.code === "23503") {
    return {
      result: fail({ code: "validation", message: "A cor escolhida não pertence a este produto." }),
      duplicate: false,
    };
  }
  return { result: fail(mapDbError(error)), duplicate: false };
}

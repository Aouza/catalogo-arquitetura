import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { fail, mapDbError, notFound, ok, type Result } from "@/modules/products/errors";
import { validationError } from "@/modules/products/schemas";
import { MAX_ALT_TEXT_LENGTH } from "./constants";
import {
  PRODUCT_IMAGE_COLUMNS,
  toProductImage,
  type ProductImage,
  type ProductImageRow,
} from "./types";

const schema = z
  .object({
    altText: z
      .string()
      .trim()
      .max(MAX_ALT_TEXT_LENGTH, `O texto alternativo pode ter no máximo ${MAX_ALT_TEXT_LENGTH} caracteres.`),
    /** `null` torna a foto geral; um id a liga a essa cor. */
    optionValueId: z.uuid("Cor inválida.").nullable(),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, "Nenhuma alteração informada.");

export type UpdateProductImageInput = z.input<typeof schema>;

/** Altera o texto alternativo e/ou a cor a que a foto pertence. */
export async function updateProductImage(
  client: SupabaseClient,
  imageId: string,
  input: UpdateProductImageInput,
): Promise<Result<ProductImage>> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return fail(validationError(parsed.error));

  const changes = {
    ...(parsed.data.altText !== undefined && { alt_text: parsed.data.altText }),
    ...(parsed.data.optionValueId !== undefined && { option_value_id: parsed.data.optionValueId }),
  };

  const { data, error } = await client
    .from("product_images")
    .update(changes)
    .eq("id", imageId)
    .select(PRODUCT_IMAGE_COLUMNS);

  if (error) {
    if (error.code === "23503") {
      return fail({ code: "validation", message: "A cor escolhida não pertence a este produto." });
    }
    return fail(mapDbError(error));
  }
  if (!data || data.length === 0) return fail(notFound());
  return ok(toProductImage(data[0] as ProductImageRow));
}

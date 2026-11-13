import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { fail, mapDbError, notFound, ok, type Result } from "@/modules/products/errors";
import { validationError } from "@/modules/products/schemas";
import {
  ALLOWED_IMAGE_TYPES,
  IMAGE_EXTENSIONS,
  MAX_ALT_TEXT_LENGTH,
  MAX_IMAGE_BYTES,
  MAX_IMAGES_PER_PRODUCT,
  PRODUCT_IMAGES_BUCKET,
} from "./constants";
import { detectImageType } from "./file-type";
import { mapStorageError } from "./storage-errors";
import type { ProductImage } from "./types";

const inputSchema = z.object({
  altText: z
    .string()
    .trim()
    .max(MAX_ALT_TEXT_LENGTH, `O texto alternativo pode ter no máximo ${MAX_ALT_TEXT_LENGTH} caracteres.`)
    .default(""),
  optionValueId: z.uuid("Cor inválida.").nullable().default(null),
});

export type AddProductImageInput = z.input<typeof inputSchema>;

/**
 * Envia uma foto e a registra no produto (geral ou ligada a uma cor).
 * Valida tamanho e formato pelo conteúdo do arquivo; se o registro falhar, o arquivo é removido.
 */
export async function addProductImage(
  client: SupabaseClient,
  productId: string,
  file: Blob,
  input: AddProductImageInput = {},
): Promise<Result<ProductImage>> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return fail(validationError(parsed.error));
  const { altText, optionValueId } = parsed.data;

  if (file.size === 0) {
    return fail({ code: "invalid_file", message: "O arquivo está vazio." });
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return fail({ code: "invalid_file", message: "A foto deve ter no máximo 5 MB." });
  }

  const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const type = detectImageType(head);
  if (!type || !ALLOWED_IMAGE_TYPES.includes(type)) {
    return fail({ code: "invalid_file", message: "Formato não aceito. Envie JPG, PNG ou WebP." });
  }

  const { data: product, error: productError } = await client
    .from("products")
    .select("id")
    .eq("id", productId)
    .maybeSingle();
  if (productError) return fail(mapDbError(productError));
  if (!product) return fail(notFound());

  const { count, error: countError } = await client
    .from("product_images")
    .select("id", { count: "exact", head: true })
    .eq("product_id", productId);
  if (countError) return fail(mapDbError(countError));
  if ((count ?? 0) >= MAX_IMAGES_PER_PRODUCT) {
    return fail({ code: "image_limit", message: "Limite de 10 fotos por produto." });
  }

  // Nome aleatório com extensão do formato detectado (nunca o nome enviado pelo cliente).
  const path = `${productId}/${crypto.randomUUID()}.${IMAGE_EXTENSIONS[type]}`;
  const bucket = client.storage.from(PRODUCT_IMAGES_BUCKET);

  const upload = await bucket.upload(path, file, {
    contentType: type,
    cacheControl: "31536000",
    upsert: false,
  });
  if (upload.error) return fail(mapStorageError(upload.error));

  const { data, error } = await client
    .from("product_images")
    .insert({
      product_id: productId,
      option_value_id: optionValueId,
      storage_path: path,
      alt_text: altText,
    })
    .select("id, product_id, option_value_id, storage_path, alt_text, position")
    .single();

  if (error) {
    // Não deixa arquivo órfão; se esta limpeza falhar, a rotina de limpeza recolhe depois.
    await bucket.remove([path]);
    if (error.code === "23503") {
      return fail({ code: "validation", message: "A cor escolhida não pertence a este produto." });
    }
    return fail(mapDbError(error));
  }

  return ok({
    id: data.id as string,
    productId: data.product_id as string,
    optionValueId: (data.option_value_id as string | null) ?? null,
    storagePath: data.storage_path as string,
    altText: data.alt_text as string,
    position: data.position as number,
  });
}

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { fail, mapDbError, notFound, type Result } from "@/modules/products/errors";
import { validationError } from "@/modules/products/schemas";
import {
  IMAGE_EXTENSIONS,
  MAX_ALT_TEXT_LENGTH,
  MAX_IMAGE_BYTES,
  MAX_IMAGES_PER_PRODUCT,
  PRODUCT_IMAGES_BUCKET,
} from "./constants";
import { detectImageType } from "./file-type";
import { insertImageRecord } from "./insert-image-record";
import type { ProductImage } from "./types";

const inputSchema = z.object({
  altText: z
    .string()
    .trim()
    .max(MAX_ALT_TEXT_LENGTH, `O texto alternativo pode ter no máximo ${MAX_ALT_TEXT_LENGTH} caracteres.`)
    .default(""),
  optionValueId: z.uuid("Cor inválida.").nullable().default(null),
});

export type RegisterUploadedImageInput = z.input<typeof inputSchema>;

const ALLOWED_EXTENSIONS = Object.values(IMAGE_EXTENSIONS);

/** O arquivo precisa estar na pasta do próprio produto, com nome gerado e extensão permitida. */
export function isValidUploadPath(productId: string, path: string): boolean {
  const pattern = new RegExp(
    `^${productId}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.(${ALLOWED_EXTENSIONS.join("|")})$`,
    "i",
  );
  return pattern.test(path);
}

/**
 * Registra uma foto que o navegador já enviou direto ao Storage (sem passar pelo servidor, o que
 * evita o limite de corpo de requisição das hospedagens). Como o navegador não é confiável, o
 * arquivo é conferido aqui: precisa existir, ter até 5 MB e ser mesmo uma imagem JPEG/PNG/WebP
 * (pelo conteúdo) com a extensão correta. Se algo falhar, o arquivo enviado é removido.
 */
export async function registerUploadedImage(
  client: SupabaseClient,
  productId: string,
  path: string,
  input: RegisterUploadedImageInput = {},
): Promise<Result<ProductImage>> {
  if (!z.uuid().safeParse(productId).success || !isValidUploadPath(productId, path)) {
    return fail({ code: "invalid_file", message: "Arquivo inválido. Envie a foto de novo." });
  }

  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return fail(validationError(parsed.error));
  const { altText, optionValueId } = parsed.data;

  const bucket = client.storage.from(PRODUCT_IMAGES_BUCKET);
  const discard = async () => {
    await bucket.remove([path]);
  };

  const { data: product, error: productError } = await client
    .from("products")
    .select("id")
    .eq("id", productId)
    .maybeSingle();
  if (productError) return fail(mapDbError(productError));
  if (!product) {
    await discard();
    return fail(notFound());
  }

  const { count, error: countError } = await client
    .from("product_images")
    .select("id", { count: "exact", head: true })
    .eq("product_id", productId);
  if (countError) return fail(mapDbError(countError));
  if ((count ?? 0) >= MAX_IMAGES_PER_PRODUCT) {
    await discard();
    return fail({ code: "image_limit", message: "Limite de 10 fotos por produto." });
  }

  const download = await bucket.download(path);
  if (download.error || !download.data) {
    return fail({ code: "invalid_file", message: "Não encontramos o arquivo enviado. Envie a foto de novo." });
  }

  const blob = download.data;
  if (blob.size === 0) {
    await discard();
    return fail({ code: "invalid_file", message: "O arquivo está vazio." });
  }
  if (blob.size > MAX_IMAGE_BYTES) {
    await discard();
    return fail({ code: "invalid_file", message: "A foto deve ter no máximo 5 MB." });
  }

  const detected = detectImageType(new Uint8Array(await blob.slice(0, 12).arrayBuffer()));
  const extension = path.slice(path.lastIndexOf(".") + 1).toLowerCase();
  if (!detected || IMAGE_EXTENSIONS[detected] !== extension) {
    await discard();
    return fail({ code: "invalid_file", message: "Formato não aceito. Envie JPG, PNG ou WebP." });
  }

  const { result, duplicate } = await insertImageRecord(client, { productId, path, altText, optionValueId });
  // Se o caminho já era de outra foto cadastrada, o arquivo é dela e não pode ser apagado.
  if (!result.ok && !duplicate) await discard();
  return result;
}

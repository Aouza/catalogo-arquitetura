import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { deleteProductImage } from "@/modules/media/delete-product-image";
import { moveImage } from "@/modules/media/photo-order";
import { registerUploadedImage } from "@/modules/media/register-uploaded-image";
import { reorderProductImages } from "@/modules/media/reorder-product-images";
import { updateProductImage } from "@/modules/media/update-product-image";
import { safeReturnTo, withFlash, type NoticeKey } from "./flash";
import { setVariantAvailability } from "./set-availability";
import type { ProductErrorCode } from "./errors";

// Lógica das ações das telas de fotos e de publicação, sem depender do Next: recebe o cliente
// já autenticado e devolve a URL para onde voltar (com aviso ou erro). A autorização é feita por
// quem chama (requireAdmin) e reforçada pelo banco (RLS).

const uuid = z.uuid();

const text = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
};

const failed = (returnTo: string, code: ProductErrorCode) => withFlash(returnTo, { erro: code });
const done = (returnTo: string, notice: NoticeKey) => withFlash(returnTo, { aviso: notice });

/** Altera o texto alternativo e a cor de uma foto. */
export async function handleUpdateImage(client: SupabaseClient, formData: FormData): Promise<string> {
  const returnTo = safeReturnTo(formData.get("returnTo"));
  const imageId = uuid.safeParse(text(formData, "imageId"));
  if (!imageId.success) return failed(returnTo, "validation");

  const color = text(formData, "optionValueId");
  const result = await updateProductImage(client, imageId.data, {
    altText: text(formData, "altText"),
    optionValueId: color === "" ? null : color,
  });
  return result.ok ? done(returnTo, "photoUpdated") : failed(returnTo, result.error.code);
}

/** Exclui uma foto. Um produto publicado não pode ficar sem foto (o banco recusa). */
export async function handleDeleteImage(client: SupabaseClient, formData: FormData): Promise<string> {
  const returnTo = safeReturnTo(formData.get("returnTo"));
  const imageId = uuid.safeParse(text(formData, "imageId"));
  if (!imageId.success) return failed(returnTo, "validation");

  const result = await deleteProductImage(client, imageId.data);
  return result.ok ? done(returnTo, "photoDeleted") : failed(returnTo, result.error.code);
}

/** Sobe ou desce uma foto na ordem da galeria (a primeira é a capa). */
export async function handleMoveImage(client: SupabaseClient, formData: FormData): Promise<string> {
  const returnTo = safeReturnTo(formData.get("returnTo"));
  const productId = uuid.safeParse(text(formData, "productId"));
  const imageId = uuid.safeParse(text(formData, "imageId"));
  const direction = z.enum(["up", "down"]).safeParse(text(formData, "direction"));
  if (!productId.success || !imageId.success || !direction.success) return failed(returnTo, "validation");

  const { data, error } = await client
    .from("product_images")
    .select("id")
    .eq("product_id", productId.data)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) return failed(returnTo, "unexpected");

  const current = (data ?? []).map((row) => row.id as string);
  if (!current.includes(imageId.data)) return failed(returnTo, "not_found");

  const next = moveImage(current, imageId.data, direction.data);
  if (next.every((id, index) => id === current[index])) return returnTo; // já está no limite

  const result = await reorderProductImages(client, productId.data, next);
  return result.ok ? done(returnTo, "photosReordered") : failed(returnTo, result.error.code);
}

/** Marca uma combinação como disponível ou indisponível. */
export async function handleToggleAvailability(client: SupabaseClient, formData: FormData): Promise<string> {
  const returnTo = safeReturnTo(formData.get("returnTo"));
  const variantId = uuid.safeParse(text(formData, "variantId"));
  const available = z.enum(["true", "false"]).safeParse(text(formData, "available"));
  if (!variantId.success || !available.success) return failed(returnTo, "validation");

  const result = await setVariantAvailability(client, variantId.data, available.data === "true");
  return result.ok ? done(returnTo, "availabilitySaved") : failed(returnTo, result.error.code);
}

const registerSchema = z.object({
  productId: z.string(),
  path: z.string(),
  altText: z.string().optional(),
  optionValueId: z.string().nullable().optional(),
});

export type RegisterImageOutcome = { ok: true } | { ok: false; message: string };

/** Registra uma foto que o navegador já enviou ao Storage (chamado pelo enviador de fotos). */
export async function handleRegisterImage(client: SupabaseClient, raw: unknown): Promise<RegisterImageOutcome> {
  const parsed = registerSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: "Arquivo inválido. Envie a foto de novo." };

  const { productId, path, altText, optionValueId } = parsed.data;
  const result = await registerUploadedImage(client, productId, path, {
    altText: altText ?? "",
    optionValueId: optionValueId ? optionValueId : null,
  });
  return result.ok ? { ok: true } : { ok: false, message: result.error.message };
}

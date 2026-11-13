import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { deleteProduct } from "./delete-product";
import { withFlash, safeReturnTo, type NoticeKey } from "./flash";
import { setProductStatus, type ProductStatus } from "./set-status";

// Lógica das ações do formulário da lista, sem depender do Next: recebe o cliente já
// autenticado e devolve para onde redirecionar. A autorização é feita por quem chama
// (requireAdmin) e reforçada pelo banco (RLS).

const INTENTS = {
  publish: { target: "published", notice: "published" },
  unpublish: { target: "draft", notice: "unpublished" },
  archive: { target: "archived", notice: "archived" },
  reactivate: { target: "draft", notice: "reactivated" },
} as const satisfies Record<string, { target: ProductStatus; notice: NoticeKey }>;

const idSchema = z.uuid();
const intentSchema = z.enum(Object.keys(INTENTS) as [keyof typeof INTENTS, ...(keyof typeof INTENTS)[]]);

/** Publicar, tirar do ar, arquivar ou reativar um produto. Devolve a URL de retorno. */
export async function handleStatusChange(client: SupabaseClient, formData: FormData): Promise<string> {
  const returnTo = safeReturnTo(formData.get("returnTo"));
  const id = idSchema.safeParse(formData.get("id"));
  const intent = intentSchema.safeParse(formData.get("intent"));
  if (!id.success || !intent.success) return withFlash(returnTo, { erro: "validation" });

  const { target, notice } = INTENTS[intent.data];
  const result = await setProductStatus(client, id.data, target);
  if (!result.ok) return withFlash(returnTo, { erro: result.error.code });
  return withFlash(returnTo, { aviso: notice });
}

/** Exclusão definitiva. Devolve a URL de retorno. */
export async function handleDelete(client: SupabaseClient, formData: FormData): Promise<string> {
  const returnTo = safeReturnTo(formData.get("returnTo"));
  const id = idSchema.safeParse(formData.get("id"));
  if (!id.success) return withFlash(returnTo, { erro: "validation" });

  const result = await deleteProduct(client, id.data);
  if (!result.ok) return withFlash(returnTo, { erro: result.error.code });
  return withFlash(returnTo, { aviso: "deleted" });
}

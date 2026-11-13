import type { SupabaseClient } from "@supabase/supabase-js";
import { fail, mapDbError, notFound, ok, type Result } from "./errors";

export type ProductStatus = "draft" | "published" | "archived";

// draft → published → archived; published/archived → draft (nunca archived → published direto).
const ALLOWED: Record<ProductStatus, ProductStatus[]> = {
  draft: ["published"],
  published: ["draft", "archived"],
  archived: ["draft"],
};

export function canTransition(from: ProductStatus, to: ProductStatus): boolean {
  return from === to || ALLOWED[from].includes(to);
}

/** Publica, despublica, arquiva ou reativa. Publicar exige produto completo (validado no banco). */
export async function setProductStatus(
  client: SupabaseClient,
  productId: string,
  target: ProductStatus,
): Promise<Result<{ status: ProductStatus }>> {
  const { data: current, error: readError } = await client
    .from("products")
    .select("status")
    .eq("id", productId)
    .maybeSingle();

  if (readError) return fail(mapDbError(readError));
  if (!current) return fail(notFound());

  const from = current.status as ProductStatus;
  if (from === target) return ok({ status: target });
  if (!canTransition(from, target)) {
    return fail({
      code: "invalid_transition",
      message: "Essa mudança de situação não é permitida. Volte o produto para rascunho antes.",
    });
  }

  // Condiciona ao status lido: se mudou no meio do caminho, nada é alterado.
  const { data, error } = await client
    .from("products")
    .update({ status: target })
    .eq("id", productId)
    .eq("status", from)
    .select("id");

  if (error) return fail(mapDbError(error));
  if (!data || data.length === 0) {
    return fail({
      code: "invalid_transition",
      message: "O produto foi alterado por outra ação. Recarregue e tente de novo.",
    });
  }
  return ok({ status: target });
}

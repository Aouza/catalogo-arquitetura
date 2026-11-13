import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { fail, mapDbError, ok, type Result } from "./errors";

const idSchema = z.uuid();

/**
 * Marca uma combinação como disponível ou indisponível (BR-023), inclusive em produto publicado:
 * não altera preço nem a estrutura, então o produto continua válido.
 */
export async function setVariantAvailability(
  client: SupabaseClient,
  variantId: string,
  isAvailable: boolean,
): Promise<Result<{ isAvailable: boolean }>> {
  if (!idSchema.safeParse(variantId).success) {
    return fail({ code: "validation", message: "Combinação inválida." });
  }

  const { data, error } = await client
    .from("product_variants")
    .update({ is_available: isAvailable })
    .eq("id", variantId)
    .select("id");

  if (error) return fail(mapDbError(error));
  if (!data || data.length === 0) {
    return fail({ code: "not_found", message: "Combinação não encontrada." });
  }
  return ok({ isAvailable });
}

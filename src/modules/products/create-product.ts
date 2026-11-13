import type { SupabaseClient } from "@supabase/supabase-js";
import { fail, mapDbError, ok, type Result } from "./errors";
import { createProductSchema, validationError, type CreateProductInput } from "./schemas";
import { slugify } from "./slug";

/** Cria o produto sempre como rascunho; a estrutura (opções e variantes) é salva à parte. */
export async function createProduct(
  client: SupabaseClient,
  input: CreateProductInput,
): Promise<Result<{ id: string; slug: string }>> {
  const parsed = createProductSchema.safeParse(input);
  if (!parsed.success) return fail(validationError(parsed.error));

  const { name, description, basePriceCents, categoryId } = parsed.data;
  const slug = parsed.data.slug ?? slugify(name);
  if (!slug) {
    return fail({
      code: "validation",
      message: "Não foi possível gerar o endereço a partir do nome. Informe um endereço.",
    });
  }

  const { data, error } = await client
    .from("products")
    .insert({
      slug,
      name,
      description,
      base_price_cents: basePriceCents,
      category_id: categoryId ?? null,
      status: "draft",
    })
    .select("id, slug")
    .single();

  if (error) return fail(mapDbError(error));
  return ok({ id: data.id as string, slug: data.slug as string });
}

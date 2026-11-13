import type { SupabaseClient } from "@supabase/supabase-js";
import { fail, mapDbError, ok, type Result } from "@/modules/products/errors";

export type CategoryOption = { id: string; name: string; slug: string };

/** Categorias na ordem de exibição (para filtros e formulários do admin). */
export async function listCategories(client: SupabaseClient): Promise<Result<CategoryOption[]>> {
  const { data, error } = await client
    .from("categories")
    .select("id, name, slug")
    .order("position", { ascending: true })
    .order("name", { ascending: true });

  if (error) return fail(mapDbError(error));
  return ok((data ?? []) as CategoryOption[]);
}

import type { SupabaseClient } from "@supabase/supabase-js";
import { slugify } from "@/modules/products/slug";
import {
  categoryFail,
  categoryOk,
  invalidName,
  mapCategoryDbError,
  notFoundCategory,
  type CategoryResult,
} from "./errors";
import { categoryNameSchema, type MoveDirection } from "./schemas";

export type AdminCategory = {
  id: string;
  name: string;
  slug: string;
  position: number;
  productCount: number;
};

/** Categorias na ordem de exibição, com quantos produtos (de qualquer situação) cada uma tem. */
export async function listAdminCategories(client: SupabaseClient): Promise<CategoryResult<AdminCategory[]>> {
  const { data, error } = await client
    .from("categories")
    .select("id, name, slug, position, products(count)")
    .order("position", { ascending: true })
    .order("name", { ascending: true });

  if (error) return categoryFail(mapCategoryDbError(error));

  const items = (data ?? []).map((row) => {
    const counted = row.products as unknown as { count: number }[] | null;
    return {
      id: row.id as string,
      name: row.name as string,
      slug: row.slug as string,
      position: row.position as number,
      productCount: counted?.[0]?.count ?? 0,
    };
  });
  return categoryOk(items);
}

/**
 * Cria a categoria no fim da lista. O endereço (slug) vem do nome e não muda depois: renomear
 * não quebra links já compartilhados.
 */
export async function createCategory(
  client: SupabaseClient,
  nameInput: string,
): Promise<CategoryResult<{ id: string; slug: string }>> {
  const name = categoryNameSchema.safeParse(nameInput);
  if (!name.success) return categoryFail(invalidName());

  const slug = slugify(name.data);
  if (!slug) return categoryFail(invalidName());

  const { data: last, error: lastError } = await client
    .from("categories")
    .select("position")
    .order("position", { ascending: false })
    .limit(1);
  if (lastError) return categoryFail(mapCategoryDbError(lastError));
  const position = last && last.length > 0 ? (last[0].position as number) + 1 : 0;

  const { data, error } = await client
    .from("categories")
    .insert({ name: name.data, slug, position })
    .select("id, slug")
    .single();

  if (error) return categoryFail(mapCategoryDbError(error));
  return categoryOk({ id: data.id as string, slug: data.slug as string });
}

/** Só o nome muda; o endereço continua o mesmo. */
export async function renameCategory(
  client: SupabaseClient,
  id: string,
  nameInput: string,
): Promise<CategoryResult<null>> {
  const name = categoryNameSchema.safeParse(nameInput);
  if (!name.success) return categoryFail(invalidName());

  const { data, error } = await client.from("categories").update({ name: name.data }).eq("id", id).select("id");
  if (error) return categoryFail(mapCategoryDbError(error));
  if (!data || data.length === 0) return categoryFail(notFoundCategory());
  return categoryOk(null);
}

/** Troca a categoria de lugar com a vizinha. Reescreve as posições em uma única operação. */
export async function moveCategory(
  client: SupabaseClient,
  id: string,
  direction: MoveDirection,
): Promise<CategoryResult<null>> {
  const { data, error } = await client
    .from("categories")
    .select("id, name, slug")
    .order("position", { ascending: true })
    .order("name", { ascending: true });
  if (error) return categoryFail(mapCategoryDbError(error));

  const list = data ?? [];
  const index = list.findIndex((row) => row.id === id);
  if (index === -1) return categoryFail(notFoundCategory());

  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= list.length) return categoryOk(null); // já está na ponta

  const reordered = [...list];
  [reordered[index], reordered[target]] = [reordered[target], reordered[index]];

  // Uma única instrução: ou todas as posições mudam, ou nenhuma. Normaliza para 0..n-1.
  const { error: saveError } = await client.from("categories").upsert(
    reordered.map((row, position) => ({ id: row.id, name: row.name, slug: row.slug, position })),
    { onConflict: "id" },
  );
  if (saveError) return categoryFail(mapCategoryDbError(saveError));
  return categoryOk(null);
}

/** Exclui a categoria. Os produtos dela ficam sem categoria (o banco faz isso). */
export async function deleteCategory(client: SupabaseClient, id: string): Promise<CategoryResult<null>> {
  const { data, error } = await client.from("categories").delete().eq("id", id).select("id");
  if (error) return categoryFail(mapCategoryDbError(error));
  if (!data || data.length === 0) return categoryFail(notFoundCategory());
  return categoryOk(null);
}

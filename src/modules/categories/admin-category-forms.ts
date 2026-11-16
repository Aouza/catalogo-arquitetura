import type { SupabaseClient } from "@supabase/supabase-js";
import { categoriesUrl } from "./flash";
import { createCategory, deleteCategory, moveCategory, renameCategory } from "./manage-categories";
import { categoryIdSchema, MOVE_DIRECTIONS, type MoveDirection } from "./schemas";

// Lógica das ações dos formulários de categoria, sem depender do Next: recebe o cliente já
// autenticado e devolve para onde redirecionar. A autorização é feita por quem chama
// (requireAdmin) e reforçada pelo banco (RLS).

const text = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
};

export async function handleCreateCategory(client: SupabaseClient, formData: FormData): Promise<string> {
  const result = await createCategory(client, text(formData, "name"));
  return result.ok ? categoriesUrl({ aviso: "created" }) : categoriesUrl({ erro: result.error.code });
}

export async function handleRenameCategory(client: SupabaseClient, formData: FormData): Promise<string> {
  const id = categoryIdSchema.safeParse(formData.get("id"));
  if (!id.success) return categoriesUrl({ erro: "category_not_found" });

  const result = await renameCategory(client, id.data, text(formData, "name"));
  return result.ok ? categoriesUrl({ aviso: "renamed" }) : categoriesUrl({ erro: result.error.code });
}

export async function handleMoveCategory(client: SupabaseClient, formData: FormData): Promise<string> {
  const id = categoryIdSchema.safeParse(formData.get("id"));
  const direction = text(formData, "direction");
  if (!id.success) return categoriesUrl({ erro: "category_not_found" });
  if (!(MOVE_DIRECTIONS as readonly string[]).includes(direction)) return categoriesUrl({ erro: "unexpected" });

  const result = await moveCategory(client, id.data, direction as MoveDirection);
  return result.ok ? categoriesUrl({ aviso: "moved" }) : categoriesUrl({ erro: result.error.code });
}

export async function handleDeleteCategory(client: SupabaseClient, formData: FormData): Promise<string> {
  const id = categoryIdSchema.safeParse(formData.get("id"));
  if (!id.success) return categoriesUrl({ erro: "category_not_found" });

  const result = await deleteCategory(client, id.data);
  return result.ok ? categoriesUrl({ aviso: "deleted" }) : categoriesUrl({ erro: result.error.code });
}

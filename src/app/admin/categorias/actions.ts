"use server";

import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/modules/auth/require-admin";
import { STOREFRONT_TAG } from "@/modules/catalogs/cache";
import {
  handleCreateCategory,
  handleDeleteCategory,
  handleMoveCategory,
  handleRenameCategory,
} from "@/modules/categories/admin-category-forms";

// Server Actions são alcançáveis por POST direto: cada uma confirma o admin antes de agir.
// As categorias aparecem na vitrine (que fica em cache), então toda ação invalida o cache antes
// de responder.
function invalidateStorefront() {
  updateTag(STOREFRONT_TAG);
}

export async function createCategoryAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const next = await handleCreateCategory(await createClient(), formData);
  invalidateStorefront();
  redirect(next);
}

export async function renameCategoryAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const next = await handleRenameCategory(await createClient(), formData);
  invalidateStorefront();
  redirect(next);
}

export async function moveCategoryAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const next = await handleMoveCategory(await createClient(), formData);
  invalidateStorefront();
  redirect(next);
}

export async function deleteCategoryAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const next = await handleDeleteCategory(await createClient(), formData);
  invalidateStorefront();
  redirect(next);
}

"use server";

import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/modules/auth/require-admin";
import { STOREFRONT_TAG } from "@/modules/catalogs/cache";
import { handleDelete, handleStatusChange } from "@/modules/products/admin-form-actions";
import {
  handleDeleteImage,
  handleMoveImage,
  handleRegisterImage,
  handleToggleAvailability,
  handleUpdateImage,
  type RegisterImageOutcome,
} from "@/modules/products/admin-photo-forms";
import {
  handleCreateProduct,
  handleSaveStructure,
  handleUpdateProduct,
  type FormState,
} from "@/modules/products/admin-product-forms";

// Server Actions são alcançáveis por POST direto: cada uma confirma o admin antes de agir.
//
// Toda ação que pode mudar o que o público vê chama `invalidateStorefront()` antes de responder:
// a vitrine guarda os dados em cache (veja modules/catalogs/cache.ts) e é assim que uma
// publicação, um produto tirado do ar, um preço ou uma foto nova aparecem na hora. Invalidar
// mesmo quando a ação falha é inofensivo (só custa uma releitura).
function invalidateStorefront() {
  updateTag(STOREFRONT_TAG);
}

export async function changeStatusAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const next = await handleStatusChange(await createClient(), formData);
  invalidateStorefront();
  redirect(next);
}

export async function deleteProductAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const next = await handleDelete(await createClient(), formData);
  invalidateStorefront();
  redirect(next);
}

export async function createProductAction(_previous: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const outcome = await handleCreateProduct(await createClient(), formData);
  invalidateStorefront();
  if ("redirectTo" in outcome) redirect(outcome.redirectTo);
  return outcome.state;
}

export async function updateProductAction(_previous: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const outcome = await handleUpdateProduct(await createClient(), formData);
  invalidateStorefront();
  return "state" in outcome ? outcome.state : {};
}

export async function saveStructureAction(_previous: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const outcome = await handleSaveStructure(await createClient(), formData);
  invalidateStorefront();
  return "state" in outcome ? outcome.state : {};
}

export async function updateImageAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const next = await handleUpdateImage(await createClient(), formData);
  invalidateStorefront();
  redirect(next);
}

export async function deleteImageAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const next = await handleDeleteImage(await createClient(), formData);
  invalidateStorefront();
  redirect(next);
}

export async function moveImageAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const next = await handleMoveImage(await createClient(), formData);
  invalidateStorefront();
  redirect(next);
}

export async function toggleAvailabilityAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const next = await handleToggleAvailability(await createClient(), formData);
  invalidateStorefront();
  redirect(next);
}

/** Chamada pelo enviador de fotos depois que o navegador enviou o arquivo ao Storage. */
export async function registerImageAction(input: {
  productId: string;
  path: string;
  altText?: string;
  optionValueId?: string | null;
}): Promise<RegisterImageOutcome> {
  await requireAdmin();
  const outcome = await handleRegisterImage(await createClient(), input);
  invalidateStorefront();
  return outcome;
}

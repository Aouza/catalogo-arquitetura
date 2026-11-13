"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/modules/auth/require-admin";
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

export async function changeStatusAction(formData: FormData): Promise<void> {
  await requireAdmin();
  redirect(await handleStatusChange(await createClient(), formData));
}

export async function deleteProductAction(formData: FormData): Promise<void> {
  await requireAdmin();
  redirect(await handleDelete(await createClient(), formData));
}

export async function createProductAction(_previous: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const outcome = await handleCreateProduct(await createClient(), formData);
  if ("redirectTo" in outcome) redirect(outcome.redirectTo);
  return outcome.state;
}

export async function updateProductAction(_previous: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const outcome = await handleUpdateProduct(await createClient(), formData);
  return "state" in outcome ? outcome.state : {};
}

export async function saveStructureAction(_previous: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const outcome = await handleSaveStructure(await createClient(), formData);
  return "state" in outcome ? outcome.state : {};
}

export async function updateImageAction(formData: FormData): Promise<void> {
  await requireAdmin();
  redirect(await handleUpdateImage(await createClient(), formData));
}

export async function deleteImageAction(formData: FormData): Promise<void> {
  await requireAdmin();
  redirect(await handleDeleteImage(await createClient(), formData));
}

export async function moveImageAction(formData: FormData): Promise<void> {
  await requireAdmin();
  redirect(await handleMoveImage(await createClient(), formData));
}

export async function toggleAvailabilityAction(formData: FormData): Promise<void> {
  await requireAdmin();
  redirect(await handleToggleAvailability(await createClient(), formData));
}

/** Chamada pelo enviador de fotos depois que o navegador enviou o arquivo ao Storage. */
export async function registerImageAction(input: {
  productId: string;
  path: string;
  altText?: string;
  optionValueId?: string | null;
}): Promise<RegisterImageOutcome> {
  await requireAdmin();
  return handleRegisterImage(await createClient(), input);
}

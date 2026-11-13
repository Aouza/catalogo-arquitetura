"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/modules/auth/require-admin";
import { handleDelete, handleStatusChange } from "@/modules/products/admin-form-actions";

// Server Actions são alcançáveis por POST direto: cada uma confirma o admin antes de agir.

export async function changeStatusAction(formData: FormData): Promise<void> {
  await requireAdmin();
  redirect(await handleStatusChange(await createClient(), formData));
}

export async function deleteProductAction(formData: FormData): Promise<void> {
  await requireAdmin();
  redirect(await handleDelete(await createClient(), formData));
}

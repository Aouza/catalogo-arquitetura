import type { SupabaseClient } from "@supabase/supabase-js";

export type AdminAccess =
  | { status: "anonymous" }
  | { status: "forbidden" }
  | { status: "admin"; userId: string; email: string };

/**
 * Resolve o acesso administrativo da sessão atual.
 * - `getUser()` valida o token no servidor (nunca `getSession()`).
 * - O papel vem de `is_admin()`, a mesma função usada pelas policies de RLS.
 * - Qualquer erro vira "forbidden": falha fechada.
 */
export async function checkAdmin(client: SupabaseClient): Promise<AdminAccess> {
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return { status: "anonymous" };

  const { data: isAdmin, error: rpcError } = await client.rpc("is_admin");
  if (rpcError || isAdmin !== true) return { status: "forbidden" };

  return { status: "admin", userId: data.user.id, email: data.user.email ?? "" };
}

import "server-only";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { routes } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";
import { checkAdmin } from "./admin-access";

/**
 * Autorização no servidor. Chame em todo layout/página/Server Action do /admin,
 * perto do acesso aos dados: layouts não re-renderizam a cada navegação.
 */
export async function requireAdmin() {
  // A sessão depende do momento da requisição (o Supabase usa Date.now() para validar
  // o token). Sem isto, o Next acusa "unstable value" ao pré-renderizar /admin.
  await connection();

  let access;
  try {
    access = await checkAdmin(await createClient());
  } catch {
    // Supabase indisponível/não configurado: falha fechada.
    redirect(routes.login());
  }

  if (access.status !== "admin") redirect(routes.login());
  return access;
}

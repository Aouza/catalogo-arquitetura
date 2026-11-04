"use server";

import { redirect } from "next/navigation";
import { routes } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";
import { checkAdmin } from "./admin-access";
import { parseLogin } from "./login-schema";

export type LoginState = { error?: string };

// Mensagem única: não revela se o e-mail existe nem se a conta não é de administrador.
const INVALID_CREDENTIALS = "E-mail ou senha incorretos.";

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const input = parseLogin(formData);
  if (!input) return { error: "Informe um e-mail e uma senha válidos." };

  let signedIn = false;
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword(input);
    if (!error) {
      const access = await checkAdmin(supabase);
      if (access.status === "admin") {
        signedIn = true;
      } else {
        await supabase.auth.signOut();
      }
    }
  } catch {
    return { error: "Não foi possível entrar agora. Tente novamente em instantes." };
  }

  if (!signedIn) return { error: INVALID_CREDENTIALS };
  redirect(routes.admin());
}

export async function logout() {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch {
    // Sem sessão para encerrar.
  }
  redirect(routes.login());
}

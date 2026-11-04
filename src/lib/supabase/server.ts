import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseEnv } from "./env";

/** Cliente Supabase com a sessão do usuário (cookies). Usa apenas a anon key; RLS vale sempre. */
export async function createClient() {
  const env = getSupabaseEnv();
  if (!env) throw new Error("Supabase não configurado (NEXT_PUBLIC_SUPABASE_URL/ANON_KEY).");

  const cookieStore = await cookies();
  return createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Chamado a partir de um Server Component, onde cookies são somente leitura.
          // O proxy renova a sessão, então é seguro ignorar.
        }
      },
    },
  });
}

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "./env";

/**
 * Cliente para as páginas públicas: só a anon key e nenhuma sessão (sem cookies). A RLS trata
 * toda leitura como anônima, então só o que está publicado é visível, mesmo que o visitante
 * seja um admin logado em outra aba. Devolve `null` se o Supabase não estiver configurado.
 */
export function createPublicClient(): SupabaseClient | null {
  const env = getSupabaseEnv();
  if (!env) return null;
  return createClient(env.url, env.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export type SupabaseEnv = { url: string; anonKey: string };

/**
 * Lê apenas as variáveis públicas. A service role nunca é lida pelo app.
 * Retorna `null` quando faltam variáveis, para os chamadores falharem de forma fechada
 * (sem sessão) em vez de lançar em páginas públicas.
 */
export function getSupabaseEnv(): SupabaseEnv | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

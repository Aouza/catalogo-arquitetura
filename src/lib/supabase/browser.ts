import { createBrowserClient } from "@supabase/ssr";

/**
 * Cliente Supabase no navegador, com a sessão do admin (anon key; a RLS decide o que pode).
 * Usado só para enviar fotos direto ao Storage, sem passar o arquivo pelo servidor.
 * As variáveis NEXT_PUBLIC_* precisam ser lidas pelo nome literal para entrarem no bundle.
 */
export function createBrowserSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("Supabase não configurado.");
  return createBrowserClient(url, anonKey);
}

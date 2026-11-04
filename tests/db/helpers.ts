import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

// Variáveis vindas de `npx supabase status -o env` (ver docs/delivery/SETUP.md).
// A service role é usada SOMENTE aqui, para preparar usuários de teste.
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Variável ${name} ausente. Rode com \`npm run test:db\`.`);
  return value;
}

const url = () => requireEnv("SUPABASE_URL");
const anonKey = () => requireEnv("SUPABASE_ANON_KEY");
const serviceKey = () => requireEnv("SUPABASE_SERVICE_ROLE_KEY");

const options = { auth: { persistSession: false, autoRefreshToken: false } } as const;

export function anonClient(): SupabaseClient {
  return createClient(url(), anonKey(), options);
}

export function serviceClient(): SupabaseClient {
  return createClient(url(), serviceKey(), options);
}

export type TestUser = { id: string; client: SupabaseClient };

/** Cria um usuário confirmado e devolve um cliente autenticado como ele. */
export async function createUser(): Promise<TestUser> {
  const email = `${randomUUID()}@teste.local`;
  const password = randomUUID();
  const service = serviceClient();

  const { data, error } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`createUser falhou: ${error?.message}`);

  const client = anonClient();
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw new Error(`signIn falhou: ${signInError.message}`);

  return { id: data.user.id, client };
}

/** Cria um usuário e o registra como admin (via service role). */
export async function createAdmin(): Promise<TestUser> {
  const user = await createUser();
  const { error } = await serviceClient().from("admins").insert({ user_id: user.id });
  if (error) throw new Error(`insert admin falhou: ${error.message}`);
  return user;
}

export async function deleteUser(user: TestUser): Promise<void> {
  await serviceClient().auth.admin.deleteUser(user.id);
}

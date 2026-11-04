import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { checkAdmin } from "@/modules/auth/admin-access";

function fakeClient(opts: {
  user?: { id: string; email?: string } | null;
  userError?: boolean;
  isAdmin?: boolean | null;
  rpcError?: boolean;
}) {
  return {
    auth: {
      getUser: async () => ({
        data: { user: opts.user ?? null },
        error: opts.userError ? new Error("jwt") : null,
      }),
    },
    rpc: async (fn: string) => {
      if (fn !== "is_admin") throw new Error(`rpc inesperada: ${fn}`);
      return { data: opts.isAdmin ?? null, error: opts.rpcError ? new Error("db") : null };
    },
  } as unknown as SupabaseClient;
}

describe("checkAdmin", () => {
  it("sem usuário → anonymous", async () => {
    expect(await checkAdmin(fakeClient({ user: null }))).toEqual({ status: "anonymous" });
  });

  it("erro ao validar o token → anonymous", async () => {
    const client = fakeClient({ user: { id: "u1" }, userError: true });
    expect(await checkAdmin(client)).toEqual({ status: "anonymous" });
  });

  it("usuário autenticado que não é admin → forbidden", async () => {
    const client = fakeClient({ user: { id: "u1" }, isAdmin: false });
    expect(await checkAdmin(client)).toEqual({ status: "forbidden" });
  });

  it("erro na consulta de papel → forbidden (falha fechada)", async () => {
    const client = fakeClient({ user: { id: "u1" }, isAdmin: true, rpcError: true });
    expect(await checkAdmin(client)).toEqual({ status: "forbidden" });
  });

  it("resposta diferente de true (ex.: null) → forbidden", async () => {
    const client = fakeClient({ user: { id: "u1" }, isAdmin: null });
    expect(await checkAdmin(client)).toEqual({ status: "forbidden" });
  });

  it("admin → admin com id e e-mail", async () => {
    const client = fakeClient({ user: { id: "u1", email: "a@b.com" }, isAdmin: true });
    expect(await checkAdmin(client)).toEqual({ status: "admin", userId: "u1", email: "a@b.com" });
  });
});

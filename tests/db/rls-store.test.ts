import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  anonClient,
  createAdmin,
  createUser,
  deleteUser,
  serviceClient,
  type TestUser,
} from "./helpers";

let admin: TestUser;
let plainUser: TestUser;

beforeAll(async () => {
  admin = await createAdmin();
  plainUser = await createUser();
});

afterAll(async () => {
  await deleteUser(admin);
  await deleteUser(plainUser);
});

async function currentName(): Promise<string> {
  const { data, error } = await serviceClient().from("store_settings").select("name").single();
  if (error) throw new Error(error.message);
  return data.name;
}

describe("store_settings — leitura", () => {
  it("anônimo lê a configuração da loja", async () => {
    const { data, error } = await anonClient().from("store_settings").select("name");
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it("autenticado sem papel lê a configuração da loja", async () => {
    const { data, error } = await plainUser.client.from("store_settings").select("name");
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });
});

describe("store_settings — escrita", () => {
  it("anônimo não consegue atualizar", async () => {
    const before = await currentName();
    const { data } = await anonClient()
      .from("store_settings")
      .update({ name: "Invadida" })
      .eq("id", true)
      .select();
    expect(data ?? []).toHaveLength(0);
    expect(await currentName()).toBe(before);
  });

  it("autenticado sem papel não consegue atualizar", async () => {
    const before = await currentName();
    const { data } = await plainUser.client
      .from("store_settings")
      .update({ name: "Invadida" })
      .eq("id", true)
      .select();
    expect(data ?? []).toHaveLength(0);
    expect(await currentName()).toBe(before);
  });

  it("admin consegue atualizar", async () => {
    const before = await currentName();
    try {
      const { data, error } = await admin.client
        .from("store_settings")
        .update({ name: "Nome Novo" })
        .eq("id", true)
        .select("name");
      expect(error).toBeNull();
      expect(data).toEqual([{ name: "Nome Novo" }]);
    } finally {
      await serviceClient().from("store_settings").update({ name: before }).eq("id", true);
    }
  });

  it("admin não consegue apagar a linha (sem DELETE)", async () => {
    const { error } = await admin.client.from("store_settings").delete().eq("id", true);
    expect(error).not.toBeNull();
    expect(await currentName()).toBeTruthy();
  });

  it("não aceita uma segunda linha, nem para admin", async () => {
    const { error } = await admin.client
      .from("store_settings")
      .insert({ id: false, name: "Segunda loja" });
    expect(error).not.toBeNull();
  });

  it("WhatsApp fora do formato E.164 é rejeitado", async () => {
    const { error } = await admin.client
      .from("store_settings")
      .update({ whatsapp_e164: "11999990000" })
      .eq("id", true);
    expect(error).not.toBeNull();
  });

  it("atualiza updated_at a cada alteração", async () => {
    const service = serviceClient();
    const { data: before } = await service.from("store_settings").select("updated_at").single();
    await new Promise((resolve) => setTimeout(resolve, 20));
    await service.from("store_settings").update({ description: "Teste de data" }).eq("id", true);
    const { data: after } = await service
      .from("store_settings")
      .select("updated_at, description")
      .single();
    expect(new Date(after!.updated_at).getTime()).toBeGreaterThan(
      new Date(before!.updated_at).getTime(),
    );
    await service
      .from("store_settings")
      .update({ description: "Moda infantil para todas as fases da infância." })
      .eq("id", true);
  });
});

describe("admins", () => {
  it("anônimo não lê admins", async () => {
    const { data, error } = await anonClient().from("admins").select("user_id");
    expect(error).not.toBeNull();
    expect(data).toBeNull();
  });

  it("usuário comum não enxerga nenhuma linha de admins", async () => {
    const { data } = await plainUser.client.from("admins").select("user_id");
    expect(data ?? []).toHaveLength(0);
  });

  it("admin enxerga apenas a própria linha", async () => {
    const { data, error } = await admin.client.from("admins").select("user_id");
    expect(error).toBeNull();
    expect(data).toEqual([{ user_id: admin.id }]);
  });

  it("usuário comum não consegue se promover a admin", async () => {
    const { error } = await plainUser.client.from("admins").insert({ user_id: plainUser.id });
    expect(error).not.toBeNull();
  });

  it("admin não consegue criar outro admin via API", async () => {
    const { error } = await admin.client.from("admins").insert({ user_id: plainUser.id });
    expect(error).not.toBeNull();
  });

  it("anônimo não executa is_admin()", async () => {
    const { error } = await anonClient().rpc("is_admin");
    expect(error).not.toBeNull();
  });
});

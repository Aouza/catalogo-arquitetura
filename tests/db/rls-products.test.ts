import { randomUUID } from "node:crypto";
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
const createdProducts: string[] = [];
const createdCategories: string[] = [];

const slug = (prefix: string) => `${prefix}-${randomUUID().slice(0, 8)}`;

async function seedCategory(name = "Categoria de teste") {
  const { data, error } = await serviceClient()
    .from("categories")
    .insert({ name, slug: slug("cat") })
    .select()
    .single();
  if (error) throw new Error(error.message);
  createdCategories.push(data.id);
  return data;
}

async function seedProduct(status: "draft" | "published" | "archived", extra = {}) {
  // Publicar exige variante válida (migration 3/3): nasce rascunho com variante padrão.
  const { data, error } = await serviceClient()
    .from("products")
    .insert({
      slug: slug("prod"),
      name: `Produto ${status}`,
      base_price_cents: 1000,
      ...extra,
      status: status === "published" ? "draft" : status,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  createdProducts.push(data.id);

  if (status === "published") {
    const variant = await serviceClient().from("product_variants").insert({ product_id: data.id });
    if (variant.error) throw new Error(variant.error.message);
    const published = await serviceClient()
      .from("products")
      .update({ status: "published" })
      .eq("id", data.id)
      .select()
      .single();
    if (published.error) throw new Error(published.error.message);
    return published.data;
  }
  return data;
}

async function productExists(id: string) {
  const { data } = await serviceClient().from("products").select("id").eq("id", id);
  return (data ?? []).length === 1;
}

beforeAll(async () => {
  admin = await createAdmin();
  plainUser = await createUser();
});

afterAll(async () => {
  const service = serviceClient();
  if (createdProducts.length) await service.from("products").delete().in("id", createdProducts);
  if (createdCategories.length) await service.from("categories").delete().in("id", createdCategories);
  await deleteUser(admin);
  await deleteUser(plainUser);
});

describe("categories", () => {
  it("anônimo e usuário comum leem categorias", async () => {
    const category = await seedCategory();
    for (const client of [anonClient(), plainUser.client]) {
      const { data, error } = await client.from("categories").select("id").eq("id", category.id);
      expect(error).toBeNull();
      expect(data).toHaveLength(1);
    }
  });

  it("anônimo e usuário comum não criam, alteram nem excluem", async () => {
    const category = await seedCategory("Original");
    for (const client of [anonClient(), plainUser.client]) {
      const insert = await client.from("categories").insert({ name: "X", slug: slug("x") });
      expect(insert.error).not.toBeNull();

      await client.from("categories").update({ name: "Invadida" }).eq("id", category.id);
      await client.from("categories").delete().eq("id", category.id);
    }
    const { data } = await serviceClient().from("categories").select("name").eq("id", category.id);
    expect(data).toEqual([{ name: "Original" }]);
  });

  it("admin cria, altera e exclui", async () => {
    const created = await admin.client
      .from("categories")
      .insert({ name: "Meninas", slug: slug("meninas") })
      .select()
      .single();
    expect(created.error).toBeNull();
    createdCategories.push(created.data!.id);

    const updated = await admin.client
      .from("categories")
      .update({ name: "Meninas 2" })
      .eq("id", created.data!.id)
      .select("name");
    expect(updated.data).toEqual([{ name: "Meninas 2" }]);

    const deleted = await admin.client
      .from("categories")
      .delete()
      .eq("id", created.data!.id)
      .select("id");
    expect(deleted.data).toHaveLength(1);
  });

  it.each(["Maiúscula", "com espaço", "-inicio", "fim-", "duplo--hifen", ""])(
    "rejeita slug inválido %j",
    async (badSlug) => {
      const { error } = await admin.client.from("categories").insert({ name: "X", slug: badSlug });
      expect(error).not.toBeNull();
    },
  );

  it("rejeita slug duplicado", async () => {
    const category = await seedCategory();
    const { error } = await admin.client
      .from("categories")
      .insert({ name: "Outra", slug: category.slug });
    expect(error).not.toBeNull();
  });
});

describe("products — visibilidade (BR-011)", () => {
  it("anônimo e usuário comum veem só produtos publicados", async () => {
    const draft = await seedProduct("draft");
    const published = await seedProduct("published");
    const archived = await seedProduct("archived");
    const ids = [draft.id, published.id, archived.id];

    for (const client of [anonClient(), plainUser.client]) {
      const { data, error } = await client.from("products").select("id").in("id", ids);
      expect(error).toBeNull();
      expect(data).toEqual([{ id: published.id }]);
    }
  });

  it("admin vê todos os estados", async () => {
    const draft = await seedProduct("draft");
    const archived = await seedProduct("archived");
    const { data } = await admin.client
      .from("products")
      .select("id")
      .in("id", [draft.id, archived.id]);
    expect(data).toHaveLength(2);
  });
});

describe("products — escrita", () => {
  it("anônimo e usuário comum não criam produto", async () => {
    for (const client of [anonClient(), plainUser.client]) {
      const { error } = await client
        .from("products")
        .insert({ slug: slug("hack"), name: "X", base_price_cents: 1 });
      expect(error).not.toBeNull();
    }
  });

  it("anônimo e usuário comum não alteram nem excluem produto publicado", async () => {
    const product = await seedProduct("published", { name: "Original" });
    for (const client of [anonClient(), plainUser.client]) {
      await client.from("products").update({ name: "Invadido" }).eq("id", product.id);
      await client.from("products").delete().eq("id", product.id);
    }
    const { data } = await serviceClient().from("products").select("name").eq("id", product.id);
    expect(data).toEqual([{ name: "Original" }]);
  });

  it("admin cria, altera e exclui (BR-015)", async () => {
    const created = await admin.client
      .from("products")
      .insert({ slug: slug("vestido"), name: "Vestido", base_price_cents: 7990 })
      .select()
      .single();
    expect(created.error).toBeNull();
    expect(created.data!.status).toBe("draft");
    createdProducts.push(created.data!.id);

    const updated = await admin.client
      .from("products")
      .update({ name: "Vestido Floral" })
      .eq("id", created.data!.id)
      .select("name");
    expect(updated.data).toEqual([{ name: "Vestido Floral" }]);

    const deleted = await admin.client
      .from("products")
      .delete()
      .eq("id", created.data!.id)
      .select("id");
    expect(deleted.data).toHaveLength(1);
    expect(await productExists(created.data!.id)).toBe(false);
  });

  it("admin exclui produto publicado e arquivado", async () => {
    for (const status of ["published", "archived"] as const) {
      const product = await seedProduct(status);
      const { data } = await admin.client.from("products").delete().eq("id", product.id).select("id");
      expect(data).toHaveLength(1);
    }
  });

  it("atualiza updated_at a cada alteração", async () => {
    const product = await seedProduct("draft");
    await new Promise((resolve) => setTimeout(resolve, 20));
    await serviceClient().from("products").update({ name: "Novo nome" }).eq("id", product.id);
    const { data } = await serviceClient()
      .from("products")
      .select("updated_at, created_at")
      .eq("id", product.id)
      .single();
    expect(new Date(data!.updated_at).getTime()).toBeGreaterThan(
      new Date(data!.created_at).getTime(),
    );
  });
});

describe("products — constraints", () => {
  const base = () => ({ slug: slug("c"), name: "Produto", base_price_cents: 1000 });

  it("aceita preço zero (BR-013)", async () => {
    const { data, error } = await admin.client
      .from("products")
      .insert({ ...base(), base_price_cents: 0 })
      .select("id, base_price_cents")
      .single();
    expect(error).toBeNull();
    expect(data!.base_price_cents).toBe(0);
    createdProducts.push(data!.id);
  });

  it("rejeita preço negativo", async () => {
    const { error } = await admin.client.from("products").insert({ ...base(), base_price_cents: -1 });
    expect(error).not.toBeNull();
  });

  it("exige preço", async () => {
    const { error } = await admin.client.from("products").insert({ slug: slug("c"), name: "Sem preço" });
    expect(error).not.toBeNull();
  });

  it("rejeita status inválido", async () => {
    const { error } = await admin.client.from("products").insert({ ...base(), status: "deletado" });
    expect(error).not.toBeNull();
  });

  it("rejeita nome vazio ou só espaços", async () => {
    const { error } = await admin.client.from("products").insert({ ...base(), name: "   " });
    expect(error).not.toBeNull();
  });

  it("rejeita slug inválido e duplicado", async () => {
    const invalid = await admin.client.from("products").insert({ ...base(), slug: "Slug Inválido" });
    expect(invalid.error).not.toBeNull();

    const product = await seedProduct("draft");
    const duplicate = await admin.client.from("products").insert({ ...base(), slug: product.slug });
    expect(duplicate.error).not.toBeNull();
  });

  it("rejeita categoria inexistente", async () => {
    const { error } = await admin.client
      .from("products")
      .insert({ ...base(), category_id: randomUUID() });
    expect(error).not.toBeNull();
  });

  it("excluir a categoria não apaga o produto: category_id vira null", async () => {
    const category = await seedCategory();
    const product = await seedProduct("published", { category_id: category.id });

    const { error } = await admin.client.from("categories").delete().eq("id", category.id);
    expect(error).toBeNull();

    const { data } = await serviceClient()
      .from("products")
      .select("category_id")
      .eq("id", product.id)
      .single();
    expect(data!.category_id).toBeNull();
  });
});

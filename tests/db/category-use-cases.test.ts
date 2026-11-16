import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  handleCreateCategory,
  handleDeleteCategory,
  handleMoveCategory,
  handleRenameCategory,
} from "@/modules/categories/admin-category-forms";
import {
  createCategory,
  deleteCategory,
  listAdminCategories,
  moveCategory,
  renameCategory,
} from "@/modules/categories/manage-categories";
import { createProduct } from "@/modules/products/create-product";
import { anonClient, createAdmin, createUser, deleteUser, serviceClient, type TestUser } from "./helpers";

let admin: TestUser;
let plainUser: TestUser;
const createdCategories: string[] = [];
const createdProducts: string[] = [];

// Marca única no nome: o endereço gerado a partir dele nunca colide com dados já existentes.
const unique = () => `Cat ${randomUUID().slice(0, 8)}`;

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
};

async function newCategory(name = unique()) {
  const result = await createCategory(admin.client, name);
  if (!result.ok) throw new Error(result.error.message);
  createdCategories.push(result.data.id);
  return { id: result.data.id, slug: result.data.slug, name };
}

/** Ordem atual (só das categorias deste teste, em qualquer posição do banco). */
async function orderOf(ids: string[]) {
  const list = await listAdminCategories(admin.client);
  if (!list.ok) throw new Error(list.error.message);
  return list.data.filter((category) => ids.includes(category.id)).map((category) => category.id);
}

beforeAll(async () => {
  admin = await createAdmin();
  plainUser = await createUser();
});

afterAll(async () => {
  const service = serviceClient();
  if (createdProducts.length > 0) await service.from("products").delete().in("id", createdProducts);
  if (createdCategories.length > 0) await service.from("categories").delete().in("id", createdCategories);
  await deleteUser(admin);
  await deleteUser(plainUser);
});

describe("criar categoria", () => {
  it("cria no fim da lista e gera o endereço a partir do nome", async () => {
    const first = await newCategory(`Pijamas ${randomUUID().slice(0, 6)}`);
    const second = await newCategory();

    expect(first.slug).toMatch(/^pijamas-[a-z0-9]+$/);
    expect(await orderOf([first.id, second.id])).toEqual([first.id, second.id]);
  });

  it("tira acentos do endereço", async () => {
    const category = await newCategory(`Calçados Ânimo ${randomUUID().slice(0, 6)}`);
    expect(category.slug).toMatch(/^calcados-animo-[a-z0-9]+$/);
  });

  it("rejeita nome vazio, só espaços ou longo demais", async () => {
    for (const name of ["", "   ", "x".repeat(81)]) {
      const result = await createCategory(admin.client, name);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("invalid_name");
    }
  });

  it("rejeita nome que não gera endereço (só símbolos)", async () => {
    const result = await createCategory(admin.client, "!!!");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("invalid_name");
  });

  it("rejeita nome repetido (mesmo endereço)", async () => {
    const existing = await newCategory();
    const result = await createCategory(admin.client, existing.name.toUpperCase());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("category_exists");
  });
});

describe("renomear categoria", () => {
  it("muda só o nome; o endereço continua o mesmo", async () => {
    const category = await newCategory();
    const result = await renameCategory(admin.client, category.id, "Outro nome");
    expect(result.ok).toBe(true);

    const list = await listAdminCategories(admin.client);
    const saved = list.ok ? list.data.find((item) => item.id === category.id) : undefined;
    expect(saved?.name).toBe("Outro nome");
    expect(saved?.slug).toBe(category.slug);
  });

  it("rejeita nome inválido e categoria inexistente", async () => {
    const category = await newCategory();
    const invalid = await renameCategory(admin.client, category.id, "   ");
    expect(invalid.ok).toBe(false);

    const missing = await renameCategory(admin.client, randomUUID(), "Qualquer");
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.error.code).toBe("category_not_found");
  });
});

describe("mover categoria", () => {
  it("sobe e desce trocando com a vizinha", async () => {
    const a = await newCategory();
    const b = await newCategory();
    const c = await newCategory();
    const ids = [a.id, b.id, c.id];
    expect(await orderOf(ids)).toEqual([a.id, b.id, c.id]);

    expect((await moveCategory(admin.client, c.id, "up")).ok).toBe(true);
    expect(await orderOf(ids)).toEqual([a.id, c.id, b.id]);

    expect((await moveCategory(admin.client, a.id, "down")).ok).toBe(true);
    expect(await orderOf(ids)).toEqual([c.id, a.id, b.id]);
  });

  it("não faz nada nas pontas e não quebra a ordem", async () => {
    const a = await newCategory();
    const b = await newCategory();
    const ids = [a.id, b.id];

    expect((await moveCategory(admin.client, a.id, "up")).ok).toBe(true);
    expect((await moveCategory(admin.client, b.id, "down")).ok).toBe(true);
    expect(await orderOf(ids)).toEqual([a.id, b.id]);
  });

  it("falha para categoria inexistente", async () => {
    const result = await moveCategory(admin.client, randomUUID(), "up");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("category_not_found");
  });
});

describe("excluir categoria", () => {
  it("conta os produtos e, ao excluir, eles ficam sem categoria (não são apagados)", async () => {
    const category = await newCategory();
    const product = await createProduct(admin.client, {
      name: "Vestido Teste",
      basePriceCents: 5000,
      slug: `vestido-${randomUUID().slice(0, 8)}`,
      categoryId: category.id,
    });
    if (!product.ok) throw new Error(product.error.message);
    createdProducts.push(product.data.id);

    const before = await listAdminCategories(admin.client);
    expect(before.ok && before.data.find((item) => item.id === category.id)?.productCount).toBe(1);

    expect((await deleteCategory(admin.client, category.id)).ok).toBe(true);

    const { data } = await serviceClient()
      .from("products")
      .select("id, category_id")
      .eq("id", product.data.id)
      .single();
    expect(data?.category_id).toBeNull();
  });

  it("falha para categoria inexistente", async () => {
    const result = await deleteCategory(admin.client, randomUUID());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("category_not_found");
  });
});

describe("autorização (RLS)", () => {
  it("usuário comum e anônimo não criam, renomeiam, movem nem excluem", async () => {
    const category = await newCategory();
    const next = await newCategory(); // há uma vizinha: "descer" é um movimento real
    const ids = [category.id, next.id];

    for (const client of [plainUser.client, anonClient()]) {
      expect((await createCategory(client, unique())).ok).toBe(false);
      expect((await renameCategory(client, category.id, "Invadida")).ok).toBe(false);
      expect((await moveCategory(client, category.id, "down")).ok).toBe(false);
      expect((await deleteCategory(client, category.id)).ok).toBe(false);
    }

    const { data } = await serviceClient().from("categories").select("name").eq("id", category.id).single();
    expect(data?.name).toBe(category.name);
    expect(await orderOf(ids)).toEqual([category.id, next.id]);
  });

  it("o público continua lendo as categorias", async () => {
    const category = await newCategory();
    const { data } = await anonClient().from("categories").select("id").eq("id", category.id);
    expect(data).toHaveLength(1);
  });
});

describe("formulários do admin (devolvem a URL de retorno)", () => {
  it("criar: sucesso, nome inválido e nome repetido", async () => {
    const name = unique();
    expect(await handleCreateCategory(admin.client, form({ name }))).toBe("/admin/categorias?aviso=created");
    const { data } = await serviceClient().from("categories").select("id").ilike("name", name);
    if (data?.[0]) createdCategories.push(data[0].id as string);

    expect(await handleCreateCategory(admin.client, form({ name: " " }))).toBe("/admin/categorias?erro=invalid_name");
    expect(await handleCreateCategory(admin.client, form({ name }))).toBe("/admin/categorias?erro=category_exists");
  });

  it("renomear, mover e excluir", async () => {
    const category = await newCategory();

    expect(await handleRenameCategory(admin.client, form({ id: category.id, name: "Novo nome" }))).toBe(
      "/admin/categorias?aviso=renamed",
    );
    expect(await handleMoveCategory(admin.client, form({ id: category.id, direction: "down" }))).toBe(
      "/admin/categorias?aviso=moved",
    );
    expect(await handleDeleteCategory(admin.client, form({ id: category.id }))).toBe("/admin/categorias?aviso=deleted");
  });

  it("recusa identificador ou direção inválidos sem tocar no banco", async () => {
    expect(await handleRenameCategory(admin.client, form({ id: "nao-e-uuid", name: "X" }))).toBe(
      "/admin/categorias?erro=category_not_found",
    );
    expect(await handleDeleteCategory(admin.client, form({ id: "nao-e-uuid" }))).toBe(
      "/admin/categorias?erro=category_not_found",
    );
    const category = await newCategory();
    expect(await handleMoveCategory(admin.client, form({ id: category.id, direction: "sideways" }))).toBe(
      "/admin/categorias?erro=unexpected",
    );
  });
});

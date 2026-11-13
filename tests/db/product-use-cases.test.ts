import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createProduct } from "@/modules/products/create-product";
import { deleteProduct } from "@/modules/products/delete-product";
import { getAdminProduct } from "@/modules/products/get-admin-product";
import { saveProductStructure } from "@/modules/products/save-structure";
import { setProductStatus } from "@/modules/products/set-status";
import { updateProduct } from "@/modules/products/update-product";
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

const unique = (prefix: string) => `${prefix}-${randomUUID().slice(0, 8)}`;

async function newProduct(overrides: Record<string, unknown> = {}) {
  const result = await createProduct(admin.client, {
    name: "Vestido Floral",
    basePriceCents: 7990,
    slug: unique("vestido"),
    ...overrides,
  });
  if (!result.ok) throw new Error(result.error.message);
  createdProducts.push(result.data.id);
  return result.data;
}

const dress = {
  options: [
    { code: "cor", name: "Cor", values: [{ code: "rosa", label: "Rosa" }, { code: "azul", label: "Azul" }] },
    { code: "tamanho", name: "Tamanho", values: [{ code: "2", label: "2" }, { code: "4", label: "4" }] },
  ],
  variants: [
    { values: { cor: "rosa", tamanho: "2" } },
    { values: { cor: "rosa", tamanho: "4" }, priceOverrideCents: 8990 },
    { values: { cor: "azul", tamanho: "2" }, isAvailable: false },
    { values: { cor: "azul", tamanho: "4" }, priceOverrideCents: 0 },
  ],
};

beforeAll(async () => {
  admin = await createAdmin();
  plainUser = await createUser();
});

afterAll(async () => {
  if (createdProducts.length) {
    await serviceClient().from("products").delete().in("id", createdProducts);
  }
  await deleteUser(admin);
  await deleteUser(plainUser);
});

describe("criar e editar", () => {
  it("cria rascunho e gera o endereço a partir do nome", async () => {
    const result = await createProduct(admin.client, { name: "Camiseta Básica Ação", basePriceCents: 4990 });
    if (!result.ok) throw new Error(result.error.message);
    createdProducts.push(result.data.id);
    expect(result.data.slug).toBe("camiseta-basica-acao");

    const read = await getAdminProduct(admin.client, result.data.id);
    expect(read.ok && read.data.status).toBe("draft");
  });

  it("rejeita endereço repetido com mensagem clara", async () => {
    const first = await newProduct();
    const again = await createProduct(admin.client, { name: "Outro", basePriceCents: 1, slug: first.slug });
    expect(again).toMatchObject({ ok: false, error: { code: "slug_taken" } });
  });

  it("rejeita dados inválidos antes de ir ao banco", async () => {
    const result = await createProduct(admin.client, { name: "X", basePriceCents: -10 });
    expect(result).toMatchObject({ ok: false, error: { code: "validation" } });
  });

  it("aceita preço zero", async () => {
    const product = await newProduct({ basePriceCents: 0 });
    const read = await getAdminProduct(admin.client, product.id);
    expect(read.ok && read.data.basePriceCents).toBe(0);
  });

  it("renomear não muda o endereço; endereço só muda se informado", async () => {
    const product = await newProduct();
    await updateProduct(admin.client, product.id, { name: "Nome Novo" });
    let read = await getAdminProduct(admin.client, product.id);
    expect(read.ok && read.data).toMatchObject({ name: "Nome Novo", slug: product.slug });

    const novo = unique("novo");
    await updateProduct(admin.client, product.id, { slug: novo });
    read = await getAdminProduct(admin.client, product.id);
    expect(read.ok && read.data.slug).toBe(novo);
  });

  it("edição para endereço de outro produto é recusada", async () => {
    const a = await newProduct();
    const b = await newProduct();
    const result = await updateProduct(admin.client, b.id, { slug: a.slug });
    expect(result).toMatchObject({ ok: false, error: { code: "slug_taken" } });
  });

  it("produto inexistente → not_found", async () => {
    const result = await updateProduct(admin.client, randomUUID(), { name: "X" });
    expect(result).toMatchObject({ ok: false, error: { code: "not_found" } });
  });
});

describe("estrutura e preço efetivo", () => {
  it("salva cor x tamanho e calcula o preço efetivo (override, fallback e zero)", async () => {
    const product = await newProduct({ basePriceCents: 7990 });
    const saved = await saveProductStructure(admin.client, product.id, dress);
    expect(saved.ok).toBe(true);

    const read = await getAdminProduct(admin.client, product.id);
    if (!read.ok) throw new Error(read.error.message);
    expect(read.data.options.map((o) => o.code)).toEqual(["cor", "tamanho"]);
    expect(read.data.variants).toHaveLength(4);

    const price = (cor: string, tamanho: string) =>
      read.data.variants.find((v) => v.values.cor === cor && v.values.tamanho === tamanho)!;
    expect(price("rosa", "2")).toMatchObject({ priceOverrideCents: null, effectivePriceCents: 7990 });
    expect(price("rosa", "4")).toMatchObject({ priceOverrideCents: 8990, effectivePriceCents: 8990 });
    expect(price("azul", "4")).toMatchObject({ priceOverrideCents: 0, effectivePriceCents: 0 });
    expect(price("azul", "2").isAvailable).toBe(false);
  });

  it("combinação duplicada é recusada e nada muda", async () => {
    const product = await newProduct();
    const result = await saveProductStructure(admin.client, product.id, {
      options: dress.options.slice(0, 1),
      variants: [{ values: { cor: "rosa" } }, { values: { cor: "rosa" } }],
    });
    expect(result).toMatchObject({ ok: false, error: { code: "validation" } });

    const read = await getAdminProduct(admin.client, product.id);
    expect(read.ok && read.data.variants).toHaveLength(0);
  });

  it("produto simples: uma variante padrão", async () => {
    const product = await newProduct();
    expect((await saveProductStructure(admin.client, product.id, { options: [], variants: [{ values: {} }] })).ok).toBe(true);
    const read = await getAdminProduct(admin.client, product.id);
    expect(read.ok && read.data.variants).toEqual([
      expect.objectContaining({ values: {}, effectivePriceCents: 7990 }),
    ]);
  });
});

describe("publicar, despublicar, arquivar e excluir", () => {
  it("publicar sem variantes é recusado e explica o que falta", async () => {
    const product = await newProduct();
    const result = await setProductStatus(admin.client, product.id, "published");
    expect(result).toMatchObject({
      ok: false,
      error: { code: "incomplete_product", issues: ["Cadastre ao menos uma opção de compra."] },
    });

    const read = await getAdminProduct(admin.client, product.id);
    expect(read.ok && read.data.publicationIssues).toEqual(["Cadastre ao menos uma opção de compra."]);
  });

  it("rascunho publicado aparece ao público; rascunho não", async () => {
    const draft = await newProduct();
    const live = await newProduct();
    await saveProductStructure(admin.client, live.id, dress);
    expect(await setProductStatus(admin.client, live.id, "published")).toMatchObject({ ok: true });

    const { data } = await anonClient().from("products").select("id").in("id", [draft.id, live.id]);
    expect(data).toEqual([{ id: live.id }]);
  });

  it("ciclo: publicado → arquivado → rascunho → publicado; arquivado não volta direto", async () => {
    const product = await newProduct();
    await saveProductStructure(admin.client, product.id, dress);

    expect(await setProductStatus(admin.client, product.id, "published")).toMatchObject({ ok: true });
    expect(await setProductStatus(admin.client, product.id, "archived")).toMatchObject({ ok: true });
    expect(await setProductStatus(admin.client, product.id, "published")).toMatchObject({
      ok: false,
      error: { code: "invalid_transition" },
    });
    expect(await setProductStatus(admin.client, product.id, "draft")).toMatchObject({ ok: true });
    expect(await setProductStatus(admin.client, product.id, "published")).toMatchObject({ ok: true });
  });

  it("edita estrutura de produto publicado sem despublicar", async () => {
    const product = await newProduct();
    await saveProductStructure(admin.client, product.id, dress);
    await setProductStatus(admin.client, product.id, "published");

    const more = {
      options: [
        { ...dress.options[0], values: [...dress.options[0].values, { code: "verde", label: "Verde" }] },
        dress.options[1],
      ],
      variants: [
        ...dress.variants,
        { values: { cor: "verde", tamanho: "2" } },
        { values: { cor: "verde", tamanho: "4" } },
      ],
    };
    expect(await saveProductStructure(admin.client, product.id, more)).toMatchObject({ ok: true });

    const read = await getAdminProduct(admin.client, product.id);
    expect(read.ok && read.data).toMatchObject({ status: "published" });
    expect(read.ok && read.data.variants).toHaveLength(6);
  });

  it("edição que deixaria o produto publicado incompleto é desfeita", async () => {
    const product = await newProduct();
    await saveProductStructure(admin.client, product.id, dress);
    await setProductStatus(admin.client, product.id, "published");

    const result = await saveProductStructure(admin.client, product.id, { options: dress.options, variants: [] });
    expect(result).toMatchObject({ ok: false, error: { code: "incomplete_product" } });

    const read = await getAdminProduct(admin.client, product.id);
    expect(read.ok && read.data.variants).toHaveLength(4);
  });

  it("exclui produto em qualquer estado, com cascata", async () => {
    const product = await newProduct();
    await saveProductStructure(admin.client, product.id, dress);
    await setProductStatus(admin.client, product.id, "published");

    expect(await deleteProduct(admin.client, product.id)).toMatchObject({ ok: true });
    expect(await getAdminProduct(admin.client, product.id)).toMatchObject({
      ok: false,
      error: { code: "not_found" },
    });
    const { data } = await serviceClient().from("product_variants").select("id").eq("product_id", product.id);
    expect(data).toHaveLength(0);
    expect(await deleteProduct(admin.client, product.id)).toMatchObject({ ok: false, error: { code: "not_found" } });
  });
});

describe("quem não é admin", () => {
  it("anônimo e usuário comum não criam, editam, publicam, estruturam nem excluem", async () => {
    const product = await newProduct();
    await saveProductStructure(admin.client, product.id, dress);

    for (const client of [anonClient(), plainUser.client]) {
      expect((await createProduct(client, { name: "Hack", basePriceCents: 1 })).ok).toBe(false);
      expect((await updateProduct(client, product.id, { name: "Invadido" })).ok).toBe(false);
      expect((await setProductStatus(client, product.id, "published")).ok).toBe(false);
      expect((await saveProductStructure(client, product.id, { options: [], variants: [{ values: {} }] })).ok).toBe(false);
      expect((await deleteProduct(client, product.id)).ok).toBe(false);
    }

    const read = await getAdminProduct(admin.client, product.id);
    expect(read.ok && read.data).toMatchObject({ name: "Vestido Floral", status: "draft" });
    expect(read.ok && read.data.variants).toHaveLength(4);
  });

  it("não-admin não lê rascunho pela leitura de admin", async () => {
    const product = await newProduct();
    for (const client of [anonClient(), plainUser.client]) {
      expect(await getAdminProduct(client, product.id)).toMatchObject({ ok: false, error: { code: "not_found" } });
    }
  });
});

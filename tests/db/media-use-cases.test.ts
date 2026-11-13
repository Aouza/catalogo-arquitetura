import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addProductImage } from "@/modules/media/add-product-image";
import { cleanupOrphanFiles, removeProductFiles } from "@/modules/media/cleanup-files";
import { deleteProductImage } from "@/modules/media/delete-product-image";
import { listProductImages } from "@/modules/media/list-product-images";
import { reorderProductImages } from "@/modules/media/reorder-product-images";
import { updateProductImage } from "@/modules/media/update-product-image";
import { createProduct } from "@/modules/products/create-product";
import { deleteProduct } from "@/modules/products/delete-product";
import { saveProductStructure } from "@/modules/products/save-structure";
import { setProductStatus } from "@/modules/products/set-status";
import {
  anonClient,
  createAdmin,
  createUser,
  deleteUser,
  serviceClient,
  type TestUser,
} from "./helpers";

const BUCKET = "product-images";
const PNG_BYTES = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);
const png = (name = "foto.png") => new File([PNG_BYTES], name, { type: "image/png" });

let admin: TestUser;
let plainUser: TestUser;
const createdProducts: string[] = [];

async function newProduct() {
  const result = await createProduct(admin.client, {
    name: "Vestido",
    basePriceCents: 7990,
    slug: `vestido-${randomUUID().slice(0, 8)}`,
  });
  if (!result.ok) throw new Error(result.error.message);
  createdProducts.push(result.data.id);
  return result.data.id;
}

const filesOf = async (productId: string) => {
  const { data } = await serviceClient().storage.from(BUCKET).list(productId);
  return (data ?? []).filter((file) => file.id !== null).map((file) => `${productId}/${file.name}`);
};

const rowsOf = async (productId: string) => {
  const { data } = await serviceClient().from("product_images").select("storage_path").eq("product_id", productId);
  return (data ?? []).map((row) => row.storage_path as string);
};

const dress = {
  options: [
    { code: "cor", name: "Cor", values: [{ code: "rosa", label: "Rosa" }, { code: "azul", label: "Azul" }] },
  ],
  variants: [{ values: { cor: "rosa" } }, { values: { cor: "azul" } }],
};

async function colorId(productId: string, code: string) {
  const { data } = await serviceClient()
    .from("product_option_values")
    .select("id")
    .eq("product_id", productId)
    .eq("code", code)
    .single();
  return data!.id as string;
}

beforeAll(async () => {
  admin = await createAdmin();
  plainUser = await createUser();
});

afterAll(async () => {
  for (const id of createdProducts) await removeProductFiles(serviceClient(), id);
  if (createdProducts.length) await serviceClient().from("products").delete().in("id", createdProducts);
  await deleteUser(admin);
  await deleteUser(plainUser);
});

describe("enviar foto", () => {
  it("salva o arquivo e o registro, com nome aleatório e extensão do formato real", async () => {
    const productId = await newProduct();
    const result = await addProductImage(admin.client, productId, png("minha foto.JPG"), { altText: "  Frente  " });
    if (!result.ok) throw new Error(result.error.message);

    expect(result.data).toMatchObject({ productId, optionValueId: null, altText: "Frente", position: 0 });
    expect(result.data.storagePath).toMatch(new RegExp(`^${productId}/[0-9a-f-]{36}\\.png$`));
    expect(await filesOf(productId)).toEqual([result.data.storagePath]);
  });

  it("foto de cor: liga ao valor do próprio produto", async () => {
    const productId = await newProduct();
    await saveProductStructure(admin.client, productId, dress);
    const rosa = await colorId(productId, "rosa");

    const result = await addProductImage(admin.client, productId, png(), { optionValueId: rosa });
    expect(result).toMatchObject({ ok: true, data: { optionValueId: rosa } });
  });

  it("cor de outro produto é recusada e não deixa arquivo para trás", async () => {
    const productId = await newProduct();
    const otherId = await newProduct();
    await saveProductStructure(admin.client, otherId, dress);
    const foreign = await colorId(otherId, "rosa");

    const result = await addProductImage(admin.client, productId, png(), { optionValueId: foreign });
    expect(result).toMatchObject({ ok: false, error: { code: "validation" } });
    expect(await filesOf(productId)).toHaveLength(0);
    expect(await rowsOf(productId)).toHaveLength(0);
  });

  it("recusa arquivo que não é imagem, mesmo com nome e tipo de imagem", async () => {
    const productId = await newProduct();
    const fake = new File([Buffer.from("isto é um texto, não uma imagem")], "foto.png", { type: "image/png" });
    expect(await addProductImage(admin.client, productId, fake)).toMatchObject({
      ok: false,
      error: { code: "invalid_file" },
    });

    const svg = new File([Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>")], "a.svg", { type: "image/svg+xml" });
    expect(await addProductImage(admin.client, productId, svg)).toMatchObject({ ok: false, error: { code: "invalid_file" } });
    expect(await filesOf(productId)).toHaveLength(0);
  });

  it("recusa arquivo vazio ou acima de 5 MB", async () => {
    const productId = await newProduct();
    expect(await addProductImage(admin.client, productId, new File([], "vazio.png", { type: "image/png" }))).toMatchObject({
      ok: false,
      error: { code: "invalid_file" },
    });

    const big = Buffer.concat([PNG_BYTES, Buffer.alloc(5 * 1024 * 1024)]);
    const result = await addProductImage(admin.client, productId, new File([big], "grande.png", { type: "image/png" }));
    expect(result).toMatchObject({ ok: false, error: { code: "invalid_file", message: "A foto deve ter no máximo 5 MB." } });
  });

  it("recusa a 11ª foto", async () => {
    const productId = await newProduct();
    for (let i = 0; i < 10; i++) {
      const result = await addProductImage(admin.client, productId, png());
      expect(result.ok).toBe(true);
    }
    const eleventh = await addProductImage(admin.client, productId, png());
    expect(eleventh).toMatchObject({ ok: false, error: { code: "image_limit" } });
    expect(await filesOf(productId)).toHaveLength(10);
  });

  it("produto inexistente → not_found e nada é enviado", async () => {
    const result = await addProductImage(admin.client, randomUUID(), png());
    expect(result).toMatchObject({ ok: false, error: { code: "not_found" } });
  });

  it("anônimo e usuário comum não enviam", async () => {
    const productId = await newProduct();
    for (const client of [anonClient(), plainUser.client]) {
      expect((await addProductImage(client, productId, png())).ok).toBe(false);
    }
    expect(await filesOf(productId)).toHaveLength(0);
    expect(await rowsOf(productId)).toHaveLength(0);
  });
});

describe("editar, ordenar e listar", () => {
  it("altera texto alternativo e a cor da foto", async () => {
    const productId = await newProduct();
    await saveProductStructure(admin.client, productId, dress);
    const azul = await colorId(productId, "azul");
    const added = await addProductImage(admin.client, productId, png());
    if (!added.ok) throw new Error(added.error.message);

    const updated = await updateProductImage(admin.client, added.data.id, { altText: "Vestido azul", optionValueId: azul });
    expect(updated).toMatchObject({ ok: true, data: { altText: "Vestido azul", optionValueId: azul } });

    const general = await updateProductImage(admin.client, added.data.id, { optionValueId: null });
    expect(general).toMatchObject({ ok: true, data: { optionValueId: null } });

    expect(await updateProductImage(admin.client, randomUUID(), { altText: "x" })).toMatchObject({
      ok: false,
      error: { code: "not_found" },
    });
  });

  it("reordena e lista na nova ordem com URL temporária", async () => {
    const productId = await newProduct();
    const ids: string[] = [];
    for (let i = 0; i < 3; i++) {
      const added = await addProductImage(admin.client, productId, png());
      if (!added.ok) throw new Error(added.error.message);
      ids.push(added.data.id);
    }
    const reversed = [...ids].reverse();
    expect(await reorderProductImages(admin.client, productId, reversed)).toMatchObject({ ok: true });

    const listed = await listProductImages(admin.client, productId);
    if (!listed.ok) throw new Error(listed.error.message);
    expect(listed.data.map((image) => image.id)).toEqual(reversed);
    expect(listed.data.every((image) => image.url?.startsWith("http"))).toBe(true);

    expect(await reorderProductImages(admin.client, productId, ids.slice(1))).toMatchObject({
      ok: false,
      error: { code: "validation" },
    });
  });

  it("produto sem fotos devolve lista vazia", async () => {
    const productId = await newProduct();
    expect(await listProductImages(admin.client, productId)).toEqual({ ok: true, data: [] });
  });
});

describe("excluir foto e produto", () => {
  it("exclui o registro e o arquivo", async () => {
    const productId = await newProduct();
    const added = await addProductImage(admin.client, productId, png());
    if (!added.ok) throw new Error(added.error.message);

    expect(await deleteProductImage(admin.client, added.data.id)).toMatchObject({ ok: true });
    expect(await rowsOf(productId)).toHaveLength(0);
    expect(await filesOf(productId)).toHaveLength(0);
    expect(await deleteProductImage(admin.client, added.data.id)).toMatchObject({ ok: false, error: { code: "not_found" } });
  });

  it("a última foto de produto publicado não pode ser excluída (e o arquivo permanece)", async () => {
    const productId = await newProduct();
    await saveProductStructure(admin.client, productId, dress);
    const added = await addProductImage(admin.client, productId, png());
    if (!added.ok) throw new Error(added.error.message);
    expect(await setProductStatus(admin.client, productId, "published")).toMatchObject({ ok: true });

    const result = await deleteProductImage(admin.client, added.data.id);
    expect(result).toMatchObject({
      ok: false,
      error: { code: "incomplete_product", issues: ["Adicione ao menos uma foto."] },
    });
    expect(await filesOf(productId)).toEqual([added.data.storagePath]);
  });

  it("publicar sem foto é recusado; com foto, publica e o público lê a foto", async () => {
    const productId = await newProduct();
    await saveProductStructure(admin.client, productId, dress);

    expect(await setProductStatus(admin.client, productId, "published")).toMatchObject({
      ok: false,
      error: { code: "incomplete_product", issues: ["Adicione ao menos uma foto."] },
    });

    const added = await addProductImage(admin.client, productId, png());
    if (!added.ok) throw new Error(added.error.message);
    expect(await setProductStatus(admin.client, productId, "published")).toMatchObject({ ok: true });

    const download = await anonClient().storage.from(BUCKET).download(added.data.storagePath);
    expect(download.error).toBeNull();
  });

  it("excluir o produto apaga também os arquivos", async () => {
    const productId = await newProduct();
    for (let i = 0; i < 2; i++) await addProductImage(admin.client, productId, png());
    expect(await filesOf(productId)).toHaveLength(2);

    expect(await deleteProduct(admin.client, productId)).toMatchObject({ ok: true });
    expect(await filesOf(productId)).toHaveLength(0);
    expect(await rowsOf(productId)).toHaveLength(0);
  });
});

describe("limpeza de arquivos órfãos", () => {
  async function orphanFor(productId: string) {
    const path = `${productId}/${randomUUID()}.png`;
    const { error } = await serviceClient().storage.from(BUCKET).upload(path, PNG_BYTES, { contentType: "image/png" });
    if (error) throw new Error(error.message);
    return path;
  }

  it("recolhe só órfãos, preserva fotos cadastradas e é idempotente", async () => {
    const productId = await newProduct();
    const kept = await addProductImage(admin.client, productId, png());
    if (!kept.ok) throw new Error(kept.error.message);
    const orphan = await orphanFor(productId);

    const first = await cleanupOrphanFiles(admin.client, { olderThanMs: 0 });
    expect(first.ok && first.data.removed).toBeGreaterThanOrEqual(1);

    const remaining = await filesOf(productId);
    expect(remaining).toContain(kept.data.storagePath);
    expect(remaining).not.toContain(orphan);

    const second = await cleanupOrphanFiles(admin.client, { olderThanMs: 0 });
    expect(second.ok).toBe(true);
    expect(await filesOf(productId)).toEqual([kept.data.storagePath]);
  });

  it("não mexe em arquivos recentes (podem estar em envio)", async () => {
    const productId = await newProduct();
    const orphan = await orphanFor(productId);

    await cleanupOrphanFiles(admin.client);
    expect(await filesOf(productId)).toContain(orphan);
  });

  it("removeProductFiles é idempotente", async () => {
    const productId = await newProduct();
    await orphanFor(productId);
    expect(await removeProductFiles(admin.client, productId)).toMatchObject({ ok: true, data: { removed: 1 } });
    expect(await removeProductFiles(admin.client, productId)).toMatchObject({ ok: true, data: { removed: 0 } });
  });
});

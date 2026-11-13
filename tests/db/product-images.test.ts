import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  anonClient,
  createAdmin,
  createUser,
  deleteUser,
  serviceClient,
  type TestUser,
} from "./helpers";

const BUCKET = "product-images";
// PNG 1x1 válido.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

let admin: TestUser;
let plainUser: TestUser;
const createdProducts: string[] = [];
const uploadedPaths: string[] = [];

const db = () => serviceClient();

async function seedProduct(status: "draft" | "published" = "draft") {
  const { data, error } = await db()
    .from("products")
    .insert({ slug: `prod-${randomUUID().slice(0, 8)}`, name: "Produto", base_price_cents: 5000 })
    .select()
    .single();
  if (error) throw new Error(error.message);
  createdProducts.push(data.id);

  if (status === "published") {
    await db().from("product_variants").insert({ product_id: data.id });
  }
  return data;
}

async function insertImage(productId: string, extra: Record<string, unknown> = {}) {
  return db()
    .from("product_images")
    .insert({ product_id: productId, storage_path: `${productId}/${randomUUID()}.png`, ...extra })
    .select()
    .single();
}

async function seedColor(productId: string, code = "rosa") {
  const { data: option } = await db()
    .from("product_options")
    .insert({ product_id: productId, name: "Cor", code: `cor-${randomUUID().slice(0, 4)}` })
    .select()
    .single();
  const { data: value } = await db()
    .from("product_option_values")
    .insert({ option_id: option!.id, product_id: productId, label: code, code })
    .select()
    .single();
  return value!;
}

async function upload(client: SupabaseClient, path: string, body: Blob | Buffer, contentType = "image/png") {
  const result = await client.storage.from(BUCKET).upload(path, body, { contentType, upsert: false });
  if (!result.error) uploadedPaths.push(path);
  return result;
}

beforeAll(async () => {
  admin = await createAdmin();
  plainUser = await createUser();
});

afterAll(async () => {
  if (uploadedPaths.length) await db().storage.from(BUCKET).remove(uploadedPaths);
  if (createdProducts.length) await db().from("products").delete().in("id", createdProducts);
  await deleteUser(admin);
  await deleteUser(plainUser);
});

describe("product_images — integridade", () => {
  it("a posição é atribuída no fim da galeria, ignorando o que o cliente enviar", async () => {
    const product = await seedProduct();
    const first = await insertImage(product.id, { position: 99 });
    const second = await insertImage(product.id);
    const third = await insertImage(product.id);
    expect([first.data!.position, second.data!.position, third.data!.position]).toEqual([0, 1, 2]);
  });

  it("aceita foto de cor do próprio produto e rejeita cor de outro produto (BR-030)", async () => {
    const a = await seedProduct();
    const b = await seedProduct();
    const colorA = await seedColor(a.id);
    const colorB = await seedColor(b.id);

    expect((await insertImage(a.id, { option_value_id: colorA.id })).error).toBeNull();
    expect((await insertImage(a.id, { option_value_id: colorB.id })).error).not.toBeNull();
  });

  it("o caminho precisa começar pelo id do produto", async () => {
    const product = await seedProduct();
    const other = await seedProduct();
    const { error } = await db()
      .from("product_images")
      .insert({ product_id: product.id, storage_path: `${other.id}/${randomUUID()}.png` });
    expect(error).not.toBeNull();
  });

  it("rejeita a 11ª foto (OQ-13)", async () => {
    const product = await seedProduct();
    for (let i = 0; i < 10; i++) expect((await insertImage(product.id)).error).toBeNull();
    const extra = await insertImage(product.id);
    expect(extra.error?.message).toMatch(/10 images/);
  });

  it("rejeita texto alternativo longo demais e caminho repetido", async () => {
    const product = await seedProduct();
    expect((await insertImage(product.id, { alt_text: "x".repeat(201) })).error).not.toBeNull();

    const path = `${product.id}/${randomUUID()}.png`;
    expect((await insertImage(product.id, { storage_path: path })).error).toBeNull();
    expect((await insertImage(product.id, { storage_path: path })).error).not.toBeNull();
  });

  it("não permite mover a foto para outro produto nem trocar o arquivo", async () => {
    const a = await seedProduct();
    const b = await seedProduct();
    const image = (await insertImage(a.id)).data!;

    expect((await db().from("product_images").update({ product_id: b.id }).eq("id", image.id)).error).not.toBeNull();
    expect(
      (await db().from("product_images").update({ storage_path: `${a.id}/outro.png` }).eq("id", image.id)).error,
    ).not.toBeNull();
    expect((await db().from("product_images").update({ alt_text: "Novo texto" }).eq("id", image.id)).error).toBeNull();
  });

  it("remover a cor remove as fotos dela, mas não as gerais", async () => {
    const product = await seedProduct();
    const color = await seedColor(product.id);
    await insertImage(product.id);
    await insertImage(product.id, { option_value_id: color.id });

    await db().from("product_option_values").delete().eq("id", color.id);
    const { data } = await db().from("product_images").select("option_value_id").eq("product_id", product.id);
    expect(data).toEqual([{ option_value_id: null }]);
  });

  it("excluir o produto remove as fotos (cascata)", async () => {
    const product = await seedProduct();
    await insertImage(product.id);
    await db().from("products").delete().eq("id", product.id);
    const { data } = await db().from("product_images").select("id").eq("product_id", product.id);
    expect(data).toHaveLength(0);
  });
});

describe("product_images — acesso (RLS)", () => {
  it("público só vê fotos de produto publicado", async () => {
    const live = await seedProduct("published");
    const draft = await seedProduct();
    await insertImage(live.id);
    await insertImage(draft.id);
    await db().from("products").update({ status: "published" }).eq("id", live.id);

    for (const client of [anonClient(), plainUser.client]) {
      const { data, error } = await client
        .from("product_images")
        .select("product_id")
        .in("product_id", [live.id, draft.id]);
      expect(error).toBeNull();
      expect(new Set((data ?? []).map((row) => row.product_id))).toEqual(new Set([live.id]));
    }
  });

  it("admin vê fotos de rascunho", async () => {
    const draft = await seedProduct();
    await insertImage(draft.id);
    const { data } = await admin.client.from("product_images").select("id").eq("product_id", draft.id);
    expect(data).toHaveLength(1);
  });

  it("anônimo e usuário comum não escrevem", async () => {
    const product = await seedProduct();
    const image = (await insertImage(product.id)).data!;

    for (const client of [anonClient(), plainUser.client]) {
      const insert = await client
        .from("product_images")
        .insert({ product_id: product.id, storage_path: `${product.id}/${randomUUID()}.png` });
      expect(insert.error).not.toBeNull();
      await client.from("product_images").update({ alt_text: "Invadida" }).eq("id", image.id);
      await client.from("product_images").delete().eq("id", image.id);
    }
    const { data } = await db().from("product_images").select("alt_text").eq("id", image.id);
    expect(data).toEqual([{ alt_text: "" }]);
  });

  it("admin cria, altera e exclui", async () => {
    const product = await seedProduct();
    const created = await admin.client
      .from("product_images")
      .insert({ product_id: product.id, storage_path: `${product.id}/${randomUUID()}.png`, alt_text: "Frente" })
      .select()
      .single();
    expect(created.error).toBeNull();

    const updated = await admin.client
      .from("product_images")
      .update({ alt_text: "Costas" })
      .eq("id", created.data!.id)
      .select("alt_text");
    expect(updated.data).toEqual([{ alt_text: "Costas" }]);

    const deleted = await admin.client.from("product_images").delete().eq("id", created.data!.id).select("id");
    expect(deleted.data).toHaveLength(1);
  });
});

describe("reorder_product_images", () => {
  async function productWithThree() {
    const product = await seedProduct();
    const images = [];
    for (let i = 0; i < 3; i++) images.push((await insertImage(product.id)).data!);
    return { product, ids: images.map((image) => image.id) };
  }

  const order = async (productId: string) => {
    const { data } = await db()
      .from("product_images")
      .select("id")
      .eq("product_id", productId)
      .order("position");
    return (data ?? []).map((row) => row.id);
  };

  it("admin define a nova ordem", async () => {
    const { product, ids } = await productWithThree();
    const reversed = [...ids].reverse();
    const { error } = await admin.client.rpc("reorder_product_images", {
      p_product_id: product.id,
      p_image_ids: reversed,
    });
    expect(error).toBeNull();
    expect(await order(product.id)).toEqual(reversed);
  });

  it("rejeita lista incompleta, repetida ou com foto de outro produto", async () => {
    const { product, ids } = await productWithThree();
    const other = await productWithThree();

    for (const list of [ids.slice(0, 2), [ids[0], ids[0], ids[1]], [...ids.slice(0, 2), other.ids[0]], []]) {
      const { error } = await admin.client.rpc("reorder_product_images", {
        p_product_id: product.id,
        p_image_ids: list,
      });
      expect(error?.message).toMatch(/invalid image list/);
    }
    expect(await order(product.id)).toEqual(ids);
  });

  it("anônimo e usuário comum não reordenam", async () => {
    const { product, ids } = await productWithThree();
    for (const client of [anonClient(), plainUser.client]) {
      const { error } = await client.rpc("reorder_product_images", {
        p_product_id: product.id,
        p_image_ids: [...ids].reverse(),
      });
      expect(error).not.toBeNull();
    }
    expect(await order(product.id)).toEqual(ids);
  });
});

describe("Storage — bucket privado", () => {
  it("admin envia arquivo válido", async () => {
    const product = await seedProduct();
    const { error } = await upload(admin.client, `${product.id}/${randomUUID()}.png`, PNG);
    expect(error).toBeNull();
  });

  it("anônimo e usuário comum não enviam arquivos", async () => {
    const product = await seedProduct();
    for (const client of [anonClient(), plainUser.client]) {
      const { error } = await upload(client, `${product.id}/${randomUUID()}.png`, PNG);
      expect(error).not.toBeNull();
    }
  });

  it("o bucket recusa formato fora de JPEG/PNG/WebP e arquivo acima de 5 MB", async () => {
    const product = await seedProduct();
    const text = await upload(admin.client, `${product.id}/${randomUUID()}.txt`, Buffer.from("texto"), "text/plain");
    expect(text.error).not.toBeNull();

    const svg = await upload(admin.client, `${product.id}/${randomUUID()}.svg`, Buffer.from("<svg/>"), "image/svg+xml");
    expect(svg.error).not.toBeNull();

    const big = await upload(admin.client, `${product.id}/${randomUUID()}.png`, Buffer.alloc(5 * 1024 * 1024 + 1));
    expect(big.error).not.toBeNull();
  });

  it("foto de rascunho não é legível pelo público, mas é pelo admin (OQ-04)", async () => {
    const product = await seedProduct();
    const path = `${product.id}/${randomUUID()}.png`;
    await upload(admin.client, path, PNG);
    await insertImage(product.id, { storage_path: path });

    for (const client of [anonClient(), plainUser.client]) {
      const { error } = await client.storage.from(BUCKET).download(path);
      expect(error).not.toBeNull();
    }
    const { error } = await admin.client.storage.from(BUCKET).download(path);
    expect(error).toBeNull();
  });

  it("depois de publicado o público lê a foto cadastrada, e volta a não ler ao despublicar", async () => {
    const product = await seedProduct("published");
    const path = `${product.id}/${randomUUID()}.png`;
    await upload(admin.client, path, PNG);
    await insertImage(product.id, { storage_path: path });
    await db().from("products").update({ status: "published" }).eq("id", product.id);

    const live = await anonClient().storage.from(BUCKET).download(path);
    expect(live.error).toBeNull();

    await db().from("products").update({ status: "draft" }).eq("id", product.id);
    const hidden = await anonClient().storage.from(BUCKET).download(path);
    expect(hidden.error).not.toBeNull();
  });

  it("arquivo sem foto cadastrada (órfão) nunca é público, mesmo em produto publicado", async () => {
    const product = await seedProduct("published");
    await insertImage(product.id);
    await db().from("products").update({ status: "published" }).eq("id", product.id);

    const orphan = `${product.id}/${randomUUID()}.png`;
    await upload(admin.client, orphan, PNG);
    const { error } = await anonClient().storage.from(BUCKET).download(orphan);
    expect(error).not.toBeNull();
  });

  it("anônimo não lista nem apaga arquivos", async () => {
    const product = await seedProduct();
    const path = `${product.id}/${randomUUID()}.png`;
    await upload(admin.client, path, PNG);

    const anon = anonClient();
    const list = await anon.storage.from(BUCKET).list(product.id);
    expect(list.data ?? []).toHaveLength(0);
    await anon.storage.from(BUCKET).remove([path]);

    const { data } = await admin.client.storage.from(BUCKET).list(product.id);
    expect((data ?? []).map((file) => `${product.id}/${file.name}`)).toContain(path);
  });
});

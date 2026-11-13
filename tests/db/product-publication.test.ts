import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { anonClient, createAdmin, deleteUser, serviceClient, type TestUser } from "./helpers";

let admin: TestUser;
const createdProducts: string[] = [];

const slug = () => `prod-${randomUUID().slice(0, 8)}`;
const db = () => serviceClient();

async function seedProduct(status: "draft" | "archived" = "draft") {
  const { data, error } = await db()
    .from("products")
    .insert({ slug: slug(), name: "Produto", base_price_cents: 5000, status })
    .select()
    .single();
  if (error) throw new Error(error.message);
  createdProducts.push(data.id);
  return data;
}

async function insertOne(table: string, row: Record<string, unknown>) {
  const { data, error } = await db().from(table).insert(row).select().single();
  if (error) throw new Error(`${table}: ${error.message}`);
  return data;
}

const publish = (id: string) => db().from("products").update({ status: "published" }).eq("id", id);

/** Produto simples com a variante padrão. */
async function seedSimple() {
  const product = await seedProduct();
  await insertOne("product_variants", { product_id: product.id });
  return product;
}

/** Produto com cor (rosa, azul) e tamanho (2, 4), sem variantes. */
async function seedDressStructure() {
  const product = await seedProduct();
  const color = await insertOne("product_options", { product_id: product.id, name: "Cor", code: "cor" });
  const size = await insertOne("product_options", { product_id: product.id, name: "Tamanho", code: "tamanho" });
  const values: Record<string, { id: string }> = {};
  for (const [option, code] of [
    [color, "rosa"],
    [color, "azul"],
    [size, "2"],
    [size, "4"],
  ] as const) {
    values[code] = await insertOne("product_option_values", {
      option_id: option.id,
      product_id: product.id,
      label: code,
      code,
    });
  }
  return { product, color, size, values };
}

async function addVariant(productId: string, valueIds: string[]) {
  const variant = await insertOne("product_variants", { product_id: productId });
  for (const id of valueIds) {
    await insertOne("variant_option_values", { variant_id: variant.id, option_value_id: id });
  }
  return variant;
}

beforeAll(async () => {
  admin = await createAdmin();
});

afterAll(async () => {
  if (createdProducts.length) await db().from("products").delete().in("id", createdProducts);
  await deleteUser(admin);
});

describe("publicar produto (BR-016, sem foto)", () => {
  it("rejeita produto sem variante e informa o motivo", async () => {
    const product = await seedProduct();
    const { error } = await publish(product.id);
    expect(error?.message).toMatch(/no_variants/);
  });

  it("rejeita inserir já publicado e sem variante", async () => {
    const { error } = await db()
      .from("products")
      .insert({ slug: slug(), name: "X", base_price_cents: 1, status: "published" });
    expect(error?.message).toMatch(/no_variants/);
  });

  it("publica produto simples com a variante padrão", async () => {
    const product = await seedSimple();
    expect((await publish(product.id)).error).toBeNull();
  });

  it("publica produto com preço zero (BR-013)", async () => {
    const product = await seedSimple();
    await db().from("products").update({ base_price_cents: 0 }).eq("id", product.id);
    expect((await publish(product.id)).error).toBeNull();
  });

  it("rejeita variante incompleta (falta um valor de opção)", async () => {
    const d = await seedDressStructure();
    await addVariant(d.product.id, [d.values.rosa.id]);
    const { error } = await publish(d.product.id);
    expect(error?.message).toMatch(/incomplete_variants/);
  });

  it("rejeita variante padrão em produto que tem opções", async () => {
    const d = await seedDressStructure();
    await insertOne("product_variants", { product_id: d.product.id });
    const { error } = await publish(d.product.id);
    expect(error?.message).toMatch(/incomplete_variants/);
  });

  it("rejeita opção sem valores", async () => {
    const product = await seedProduct();
    await insertOne("product_options", { product_id: product.id, name: "Cor", code: "cor" });
    await insertOne("product_variants", { product_id: product.id });
    const { error } = await publish(product.id);
    expect(error?.message).toMatch(/option_without_values/);
  });

  it("publica produto com cor e tamanho completos", async () => {
    const d = await seedDressStructure();
    await addVariant(d.product.id, [d.values.rosa.id, d.values["2"].id]);
    await addVariant(d.product.id, [d.values.azul.id, d.values["4"].id]);
    expect((await publish(d.product.id)).error).toBeNull();
  });

  it("não valida rascunho nem arquivado", async () => {
    const draft = await seedProduct();
    const archived = await seedProduct("archived");
    expect((await db().from("products").update({ name: "Novo" }).eq("id", draft.id)).error).toBeNull();
    expect((await db().from("products").update({ name: "Novo" }).eq("id", archived.id)).error).toBeNull();
  });

  it("a mensagem lista todas as pendências", async () => {
    const product = await seedProduct();
    await insertOne("product_options", { product_id: product.id, name: "Cor", code: "cor" });
    const { error } = await publish(product.id);
    expect(error?.message).toMatch(/no_variants/);
    expect(error?.message).toMatch(/option_without_values/);
  });
});

describe("produto publicado continua válido (validação contínua)", () => {
  async function publishedSimple() {
    const product = await seedSimple();
    expect((await publish(product.id)).error).toBeNull();
    return product;
  }

  async function publishedDress() {
    const d = await seedDressStructure();
    const variant = await addVariant(d.product.id, [d.values.rosa.id, d.values["2"].id]);
    expect((await publish(d.product.id)).error).toBeNull();
    return { ...d, variant };
  }

  it("rejeita excluir a última variante", async () => {
    const product = await publishedSimple();
    const { error } = await db().from("product_variants").delete().eq("product_id", product.id);
    expect(error?.message).toMatch(/no_variants/);
  });

  it("rejeita remover um vínculo de variante", async () => {
    const d = await publishedDress();
    const { error } = await db()
      .from("variant_option_values")
      .delete()
      .eq("variant_id", d.variant.id)
      .eq("option_value_id", d.values["2"].id);
    expect(error?.message).toMatch(/incomplete_variants/);
  });

  it("rejeita acrescentar uma opção sem completar as variantes", async () => {
    const product = await publishedSimple();
    const { error } = await db()
      .from("product_options")
      .insert({ product_id: product.id, name: "Cor", code: "cor" });
    expect(error?.message).toMatch(/option_without_values|incomplete_variants/);
  });

  it("permite alterar disponibilidade e preço da variante", async () => {
    const product = await publishedSimple();
    const { error } = await db()
      .from("product_variants")
      .update({ is_available: false, price_override_cents: 0 })
      .eq("product_id", product.id);
    expect(error).toBeNull();
  });

  it("permite excluir o produto publicado (cascata)", async () => {
    const d = await publishedDress();
    const { data, error } = await admin.client
      .from("products")
      .delete()
      .eq("id", d.product.id)
      .select("id");
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it("despublicar e arquivar sempre são permitidos", async () => {
    const product = await publishedSimple();
    expect((await db().from("products").update({ status: "draft" }).eq("id", product.id)).error).toBeNull();
    await db().from("product_variants").delete().eq("product_id", product.id);
    expect((await db().from("products").update({ status: "archived" }).eq("id", product.id)).error).toBeNull();
  });
});

describe("product_publication_issues", () => {
  it("admin vê a lista de pendências", async () => {
    const empty = await seedProduct();
    const ready = await seedSimple();

    const missing = await admin.client.rpc("product_publication_issues", { p_product_id: empty.id });
    expect(missing.error).toBeNull();
    expect(missing.data).toEqual(["no_variants"]);

    const ok = await admin.client.rpc("product_publication_issues", { p_product_id: ready.id });
    expect(ok.data).toEqual([]);
  });

  it("anônimo não executa a função", async () => {
    const product = await seedSimple();
    const { error } = await anonClient().rpc("product_publication_issues", { p_product_id: product.id });
    expect(error).not.toBeNull();
  });
});

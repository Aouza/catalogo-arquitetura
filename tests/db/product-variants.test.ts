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

const slug = (prefix: string) => `${prefix}-${randomUUID().slice(0, 8)}`;
const db = () => serviceClient();

async function seedProduct(status: "draft" | "published" = "draft", base = 7990) {
  const { data, error } = await db()
    .from("products")
    .insert({ slug: slug("prod"), name: "Vestido", base_price_cents: base, status })
    .select()
    .single();
  if (error) throw new Error(error.message);
  createdProducts.push(data.id);
  return data;
}

async function seedOption(productId: string, code: string) {
  const { data, error } = await db()
    .from("product_options")
    .insert({ product_id: productId, name: code, code })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

async function seedValue(optionId: string, productId: string, code: string) {
  const { data, error } = await db()
    .from("product_option_values")
    .insert({ option_id: optionId, product_id: productId, label: code, code })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

/** Cria a variante e seus vínculos, um a um (a chave é recalculada a cada vínculo). */
async function seedVariant(productId: string, valueIds: string[], extra = {}) {
  const { data, error } = await db()
    .from("product_variants")
    .insert({ product_id: productId, ...extra })
    .select()
    .single();
  if (error) return { error };
  for (const valueId of valueIds) {
    const link = await db()
      .from("variant_option_values")
      .insert({ variant_id: data.id, option_value_id: valueId });
    if (link.error) return { error: link.error };
  }
  const { data: fresh } = await db().from("product_variants").select().eq("id", data.id).single();
  return { variant: fresh!, error: null };
}

/** Produto com cor (rosa, azul) e tamanho (2, 4). */
async function seedDress(status: "draft" | "published" = "draft") {
  const product = await seedProduct(status);
  const color = await seedOption(product.id, "cor");
  const size = await seedOption(product.id, "tamanho");
  const rosa = await seedValue(color.id, product.id, "rosa");
  const azul = await seedValue(color.id, product.id, "azul");
  const t2 = await seedValue(size.id, product.id, "2");
  const t4 = await seedValue(size.id, product.id, "4");
  return { product, color, size, rosa, azul, t2, t4 };
}

beforeAll(async () => {
  admin = await createAdmin();
  plainUser = await createUser();
});

afterAll(async () => {
  if (createdProducts.length) await db().from("products").delete().in("id", createdProducts);
  await deleteUser(admin);
  await deleteUser(plainUser);
});

describe("combinação (BR-021, BR-022)", () => {
  it("rejeita combinação duplicada, independentemente da ordem dos vínculos", async () => {
    const d = await seedDress();
    const first = await seedVariant(d.product.id, [d.rosa.id, d.t4.id]);
    expect(first.error).toBeNull();
    expect(first.variant!.combination_key).not.toBe("");

    const duplicate = await seedVariant(d.product.id, [d.t4.id, d.rosa.id]);
    expect(duplicate.error).not.toBeNull();
  });

  it("aceita combinações diferentes no mesmo produto", async () => {
    const d = await seedDress();
    const a = await seedVariant(d.product.id, [d.rosa.id, d.t2.id]);
    const b = await seedVariant(d.product.id, [d.rosa.id, d.t4.id]);
    const c = await seedVariant(d.product.id, [d.azul.id, d.t2.id]);
    expect([a.error, b.error, c.error]).toEqual([null, null, null]);
  });

  it("rejeita dois valores da mesma opção na mesma variante", async () => {
    const d = await seedDress();
    const result = await seedVariant(d.product.id, [d.rosa.id, d.azul.id]);
    expect(result.error).not.toBeNull();
  });

  it("produto simples: uma variante padrão com chave vazia, sem segunda", async () => {
    const product = await seedProduct();
    const first = await seedVariant(product.id, []);
    expect(first.error).toBeNull();
    expect(first.variant!.combination_key).toBe("");

    const second = await seedVariant(product.id, []);
    expect(second.error).not.toBeNull();
  });

  it("ignora combination_key enviada pelo cliente", async () => {
    const product = await seedProduct();
    const { data, error } = await db()
      .from("product_variants")
      .insert({ product_id: product.id, combination_key: "forjada" })
      .select()
      .single();
    expect(error).toBeNull();
    expect(data!.combination_key).toBe("");
  });

  it("remover um vínculo recalcula a chave", async () => {
    const d = await seedDress();
    const { variant } = await seedVariant(d.product.id, [d.rosa.id, d.t2.id]);
    await db()
      .from("variant_option_values")
      .delete()
      .eq("variant_id", variant!.id)
      .eq("option_value_id", d.t2.id);
    const { data } = await db().from("product_variants").select("combination_key").eq("id", variant!.id).single();
    expect(data!.combination_key).toBe(d.rosa.id);
  });
});

describe("referências entre produtos (BR-025)", () => {
  it("rejeita valor de opção de outro produto", async () => {
    const a = await seedDress();
    const b = await seedDress();
    const value = await db()
      .from("product_option_values")
      .insert({ option_id: a.color.id, product_id: b.product.id, label: "x", code: "x" });
    expect(value.error).not.toBeNull();
  });

  it("rejeita vínculo entre variante de um produto e valor de outro", async () => {
    const a = await seedDress();
    const b = await seedDress();
    const result = await seedVariant(a.product.id, [b.rosa.id]);
    expect(result.error).not.toBeNull();
  });

  it("product_id/option_id do vínculo vêm do valor, não do cliente", async () => {
    const a = await seedDress();
    const b = await seedDress();
    const { data: variant } = await db()
      .from("product_variants")
      .insert({ product_id: a.product.id })
      .select()
      .single();
    const link = await db().from("variant_option_values").insert({
      variant_id: variant!.id,
      option_value_id: b.rosa.id,
      product_id: a.product.id,
      option_id: a.color.id,
    });
    expect(link.error).not.toBeNull();
  });

  it("não permite mover opção, valor ou variante para outro produto", async () => {
    const a = await seedDress();
    const b = await seedProduct();
    const { variant } = await seedVariant(a.product.id, [a.rosa.id]);

    expect((await db().from("product_options").update({ product_id: b.id }).eq("id", a.color.id)).error).not.toBeNull();
    expect((await db().from("product_option_values").update({ product_id: b.id }).eq("id", a.rosa.id)).error).not.toBeNull();
    expect((await db().from("product_variants").update({ product_id: b.id }).eq("id", variant!.id)).error).not.toBeNull();
  });
});

describe("limites por produto (BR-017)", () => {
  it("rejeita a terceira opção", async () => {
    const d = await seedDress();
    const { error } = await db()
      .from("product_options")
      .insert({ product_id: d.product.id, name: "Material", code: "material" });
    expect(error).not.toBeNull();
  });

  it("rejeita o 21º valor (somando as opções)", async () => {
    const product = await seedProduct();
    const one = await seedOption(product.id, "a");
    const two = await seedOption(product.id, "b");
    const rows = Array.from({ length: 20 }, (_, i) => ({
      option_id: i % 2 ? one.id : two.id,
      product_id: product.id,
      label: `v${i}`,
      code: `v${i}`,
    }));
    expect((await db().from("product_option_values").insert(rows)).error).toBeNull();

    const extra = await db()
      .from("product_option_values")
      .insert({ option_id: one.id, product_id: product.id, label: "extra", code: "extra" });
    expect(extra.error).not.toBeNull();
  });

  it("rejeita a 101ª variante", async () => {
    const product = await seedProduct();
    const colors = await seedOption(product.id, "cor");
    const sizes = await seedOption(product.id, "tamanho");
    const colorValues = [];
    const sizeValues = [];
    for (let i = 0; i < 10; i++) {
      colorValues.push(await seedValue(colors.id, product.id, `c${i}`));
      sizeValues.push(await seedValue(sizes.id, product.id, `s${i}`));
    }

    // 10 x 10 = 100 combinações válidas.
    for (const color of colorValues) {
      for (const size of sizeValues) {
        const result = await seedVariant(product.id, [color.id, size.id]);
        expect(result.error).toBeNull();
      }
    }

    const extra = await db().from("product_variants").insert({ product_id: product.id });
    expect(extra.error?.message).toMatch(/100 variants/);
  }, 120_000);
});

describe("preço (BR-013, BR-024)", () => {
  it("override zero é válido e distinto de null", async () => {
    const product = await seedProduct("draft", 5000);
    const zero = await seedVariant(product.id, [], { price_override_cents: 0 });
    expect(zero.error).toBeNull();
    expect(zero.variant!.price_override_cents).toBe(0);

    const inherit = await seedProduct("draft", 5000);
    const nul = await seedVariant(inherit.id, []);
    expect(nul.variant!.price_override_cents).toBeNull();
  });

  it("rejeita override negativo", async () => {
    const product = await seedProduct();
    const result = await seedVariant(product.id, [], { price_override_cents: -1 });
    expect(result.error).not.toBeNull();
  });
});

describe("visibilidade e escrita (RLS)", () => {
  it("público lê opções, valores e variantes só de produto publicado", async () => {
    const pub = await seedDress("published");
    const draft = await seedDress("draft");
    await seedVariant(pub.product.id, [pub.rosa.id, pub.t2.id]);
    await seedVariant(draft.product.id, [draft.rosa.id, draft.t2.id]);
    const ids = [pub.product.id, draft.product.id];

    for (const client of [anonClient(), plainUser.client]) {
      for (const table of ["product_options", "product_option_values", "product_variants", "variant_option_values"]) {
        const { data, error } = await client.from(table).select("product_id").in("product_id", ids);
        expect(error).toBeNull();
        expect(new Set((data ?? []).map((r) => r.product_id))).toEqual(new Set([pub.product.id]));
      }
    }
  });

  it("admin lê tudo, inclusive rascunho", async () => {
    const draft = await seedDress("draft");
    const { data } = await admin.client
      .from("product_option_values")
      .select("id")
      .eq("product_id", draft.product.id);
    expect(data).toHaveLength(4);
  });

  it("anônimo e usuário comum não escrevem", async () => {
    const d = await seedDress("published");
    for (const client of [anonClient(), plainUser.client]) {
      expect(
        (await client.from("product_options").insert({ product_id: d.product.id, name: "x", code: "x" })).error,
      ).not.toBeNull();
      expect(
        (await client.from("product_variants").insert({ product_id: d.product.id })).error,
      ).not.toBeNull();

      await client.from("product_option_values").update({ label: "Invadido" }).eq("id", d.rosa.id);
      await client.from("product_option_values").delete().eq("id", d.rosa.id);
    }
    const { data } = await db().from("product_option_values").select("label").eq("id", d.rosa.id);
    expect(data).toEqual([{ label: "rosa" }]);
  });

  it("admin cria opção, valor, variante e vínculo", async () => {
    const product = await seedProduct();
    const option = await admin.client
      .from("product_options")
      .insert({ product_id: product.id, name: "Cor", code: "cor" })
      .select()
      .single();
    expect(option.error).toBeNull();

    const value = await admin.client
      .from("product_option_values")
      .insert({ option_id: option.data!.id, product_id: product.id, label: "Rosa", code: "rosa" })
      .select()
      .single();
    expect(value.error).toBeNull();

    const variant = await admin.client
      .from("product_variants")
      .insert({ product_id: product.id })
      .select()
      .single();
    expect(variant.error).toBeNull();

    const link = await admin.client
      .from("variant_option_values")
      .insert({ variant_id: variant.data!.id, option_value_id: value.data!.id });
    expect(link.error).toBeNull();
  });
});

describe("exclusão em cascata (BR-015)", () => {
  it("excluir o produto remove opções, valores, variantes e vínculos", async () => {
    const d = await seedDress();
    await seedVariant(d.product.id, [d.rosa.id, d.t2.id]);

    const del = await admin.client.from("products").delete().eq("id", d.product.id).select("id");
    expect(del.data).toHaveLength(1);

    for (const table of ["product_options", "product_option_values", "product_variants", "variant_option_values"]) {
      const { data } = await db().from(table).select("product_id").eq("product_id", d.product.id);
      expect(data).toHaveLength(0);
    }
  });
});

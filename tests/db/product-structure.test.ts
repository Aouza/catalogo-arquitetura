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

const db = () => serviceClient();

async function seedProduct() {
  const { data, error } = await db()
    .from("products")
    .insert({ slug: `prod-${randomUUID().slice(0, 8)}`, name: "Vestido", base_price_cents: 7990 })
    .select()
    .single();
  if (error) throw new Error(error.message);
  createdProducts.push(data.id);
  return data;
}

type OptionInput = {
  code: string;
  name: string;
  position?: number;
  values: { code: string; label: string; position?: number }[];
};
type VariantInput = {
  values: Record<string, string>;
  price_override_cents?: number | null;
  is_available?: boolean;
  position?: number;
};

const colorOption = (...codes: string[]): OptionInput => ({
  code: "cor",
  name: "Cor",
  values: codes.map((code) => ({ code, label: code })),
});
const sizeOption = (...codes: string[]): OptionInput => ({
  code: "tamanho",
  name: "Tamanho",
  values: codes.map((code) => ({ code, label: code })),
});

/** Todas as combinações cor x tamanho. */
function grid(colors: string[], sizes: string[]): VariantInput[] {
  return colors.flatMap((cor) => sizes.map((tamanho) => ({ values: { cor, tamanho } })));
}

function save(
  client: TestUser["client"],
  productId: string,
  options: OptionInput[],
  variants: VariantInput[],
) {
  return client.rpc("save_product_structure", {
    p_product_id: productId,
    p_options: options,
    p_variants: variants,
  });
}

async function snapshot(productId: string) {
  const [options, values, variants] = await Promise.all([
    db().from("product_options").select("id, code").eq("product_id", productId).order("code"),
    db().from("product_option_values").select("id, code").eq("product_id", productId).order("code"),
    db().from("product_variants").select("id, combination_key").eq("product_id", productId).order("id"),
  ]);
  return { options: options.data, values: values.data, variants: variants.data };
}

async function publish(productId: string) {
  return db().from("products").update({ status: "published" }).eq("id", productId);
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

describe("save_product_structure — criação", () => {
  it("cria cor x tamanho de uma vez (4 variantes)", async () => {
    const product = await seedProduct();
    const { error } = await save(
      admin.client,
      product.id,
      [colorOption("rosa", "azul"), sizeOption("2", "4")],
      grid(["rosa", "azul"], ["2", "4"]),
    );
    expect(error).toBeNull();

    const snap = await snapshot(product.id);
    expect(snap.options).toHaveLength(2);
    expect(snap.values).toHaveLength(4);
    expect(snap.variants).toHaveLength(4);
    expect(new Set(snap.variants!.map((v) => v.combination_key)).size).toBe(4);
  });

  it("produto simples: uma variante padrão sem opções", async () => {
    const product = await seedProduct();
    const { error } = await save(admin.client, product.id, [], [{ values: {} }]);
    expect(error).toBeNull();

    const snap = await snapshot(product.id);
    expect(snap.options).toHaveLength(0);
    expect(snap.variants).toEqual([expect.objectContaining({ combination_key: "" })]);
  });

  it("grava override (inclusive zero), disponibilidade e posição", async () => {
    const product = await seedProduct();
    await save(
      admin.client,
      product.id,
      [colorOption("rosa", "azul")],
      [
        { values: { cor: "rosa" }, price_override_cents: 0, is_available: false, position: 5 },
        { values: { cor: "azul" } },
      ],
    );

    const { data } = await db()
      .from("product_variants")
      .select("price_override_cents, is_available, position, combination_key")
      .eq("product_id", product.id);
    const prices = (data ?? []).map((v) => v.price_override_cents).sort();
    expect(prices).toEqual([0, null]);
    expect((data ?? []).find((v) => v.price_override_cents === 0)).toMatchObject({
      is_available: false,
      position: 5,
    });
    expect((data ?? []).find((v) => v.price_override_cents === null)).toMatchObject({
      is_available: true,
    });
  });

  it("é idempotente: repetir o payload não muda ids", async () => {
    const product = await seedProduct();
    const options = [colorOption("rosa", "azul"), sizeOption("2", "4")];
    const variants = grid(["rosa", "azul"], ["2", "4"]);
    await save(admin.client, product.id, options, variants);
    const before = await snapshot(product.id);

    expect((await save(admin.client, product.id, options, variants)).error).toBeNull();
    expect(await snapshot(product.id)).toEqual(before);
  });
});

describe("save_product_structure — edição", () => {
  it("mantém ids de opções, valores e variantes cujo código permanece", async () => {
    const product = await seedProduct();
    await save(admin.client, product.id, [colorOption("rosa", "azul")], [
      { values: { cor: "rosa" } },
      { values: { cor: "azul" } },
    ]);
    const before = await snapshot(product.id);

    await save(admin.client, product.id, [colorOption("rosa", "azul", "verde")], [
      { values: { cor: "rosa" } },
      { values: { cor: "azul" } },
      { values: { cor: "verde" } },
    ]);
    const after = await snapshot(product.id);

    for (const kind of ["options", "values", "variants"] as const) {
      for (const row of before[kind]!) {
        expect(after[kind]!.map((r) => r.id)).toContain(row.id);
      }
    }
    expect(after.variants).toHaveLength(3);
  });

  it("remover uma cor remove seus valores e variantes", async () => {
    const product = await seedProduct();
    await save(
      admin.client,
      product.id,
      [colorOption("rosa", "azul"), sizeOption("2", "4")],
      grid(["rosa", "azul"], ["2", "4"]),
    );

    const { error } = await save(
      admin.client,
      product.id,
      [colorOption("rosa"), sizeOption("2", "4")],
      grid(["rosa"], ["2", "4"]),
    );
    expect(error).toBeNull();

    const snap = await snapshot(product.id);
    expect(snap.values!.map((v) => v.code).sort()).toEqual(["2", "4", "rosa"]);
    expect(snap.variants).toHaveLength(2);
  });

  it("atualiza preço e disponibilidade sem recriar a variante", async () => {
    const product = await seedProduct();
    await save(admin.client, product.id, [colorOption("rosa")], [{ values: { cor: "rosa" } }]);
    const before = await snapshot(product.id);

    await save(admin.client, product.id, [colorOption("rosa")], [
      { values: { cor: "rosa" }, price_override_cents: 8990, is_available: false },
    ]);
    const { data } = await db()
      .from("product_variants")
      .select("id, price_override_cents, is_available")
      .eq("product_id", product.id);
    expect(data).toEqual([
      { id: before.variants![0].id, price_override_cents: 8990, is_available: false },
    ]);
  });

  it("transforma produto simples em produto com opções", async () => {
    const product = await seedProduct();
    await save(admin.client, product.id, [], [{ values: {} }]);
    const { error } = await save(admin.client, product.id, [sizeOption("p", "m")], [
      { values: { tamanho: "p" } },
      { values: { tamanho: "m" } },
    ]);
    expect(error).toBeNull();
    const snap = await snapshot(product.id);
    expect(snap.variants!.map((v) => v.combination_key)).not.toContain("");
  });
});

describe("save_product_structure — produto publicado, sem despublicar", () => {
  async function publishedDress() {
    const product = await seedProduct();
    const options = [colorOption("rosa", "azul"), sizeOption("2", "4")];
    await save(admin.client, product.id, options, grid(["rosa", "azul"], ["2", "4"]));
    expect((await publish(product.id)).error).toBeNull();
    return product;
  }

  it("acrescenta uma cor mantendo o produto publicado", async () => {
    const product = await publishedDress();
    const { error } = await save(
      admin.client,
      product.id,
      [colorOption("rosa", "azul", "verde"), sizeOption("2", "4")],
      grid(["rosa", "azul", "verde"], ["2", "4"]),
    );
    expect(error).toBeNull();

    const { data } = await db().from("products").select("status").eq("id", product.id).single();
    expect(data!.status).toBe("published");
    expect((await snapshot(product.id)).variants).toHaveLength(6);
  });

  it("acrescenta uma opção nova e remonta as variantes numa única transação", async () => {
    const product = await seedProduct();
    await save(admin.client, product.id, [colorOption("rosa", "azul")], [
      { values: { cor: "rosa" } },
      { values: { cor: "azul" } },
    ]);
    await publish(product.id);

    const { error } = await save(
      admin.client,
      product.id,
      [colorOption("rosa", "azul"), sizeOption("2", "4")],
      grid(["rosa", "azul"], ["2", "4"]),
    );
    expect(error).toBeNull();
    expect((await snapshot(product.id)).variants).toHaveLength(4);
  });

  it("desfaz tudo se o resultado deixaria o produto publicado inválido", async () => {
    const product = await publishedDress();
    const before = await snapshot(product.id);

    // Opção nova sem variantes completas: inválido no commit.
    const { error } = await save(
      admin.client,
      product.id,
      [colorOption("rosa", "azul"), sizeOption("2", "4")],
      [],
    );
    expect(error?.message).toMatch(/no_variants/);
    expect(await snapshot(product.id)).toEqual(before);

    const { data } = await db().from("products").select("status").eq("id", product.id).single();
    expect(data!.status).toBe("published");
  });
});

describe("save_product_structure — validação do payload e segurança", () => {
  it("rejeita combinação duplicada e não altera nada", async () => {
    const product = await seedProduct();
    const { error } = await save(admin.client, product.id, [colorOption("rosa")], [
      { values: { cor: "rosa" } },
      { values: { cor: "rosa" } },
    ]);
    expect(error?.message).toMatch(/duplicate variant/);
    expect((await snapshot(product.id)).variants).toHaveLength(0);
  });

  it("rejeita variante incompleta ou com valor desconhecido", async () => {
    const product = await seedProduct();
    const options = [colorOption("rosa"), sizeOption("2")];

    const incomplete = await save(admin.client, product.id, options, [{ values: { cor: "rosa" } }]);
    expect(incomplete.error?.message).toMatch(/exactly one value per option/);

    const unknown = await save(admin.client, product.id, options, [
      { values: { cor: "rosa", tamanho: "99" } },
    ]);
    expect(unknown.error?.message).toMatch(/unknown option value/);
  });

  it("rejeita códigos repetidos e payload mal formado", async () => {
    const product = await seedProduct();
    const dupOption = await save(admin.client, product.id, [colorOption("rosa"), colorOption("azul")], []);
    expect(dupOption.error?.message).toMatch(/duplicate option code/);

    const dupValue = await save(admin.client, product.id, [colorOption("rosa", "rosa")], []);
    expect(dupValue.error?.message).toMatch(/duplicate value code/);

    const malformed = await admin.client.rpc("save_product_structure", {
      p_product_id: product.id,
      p_options: { not: "array" },
      p_variants: [],
    });
    expect(malformed.error?.message).toMatch(/must be arrays/);
  });

  it("aplica os limites do banco (3 opções, 21 valores)", async () => {
    const product = await seedProduct();
    const three = await save(
      admin.client,
      product.id,
      [colorOption("rosa"), sizeOption("2"), { code: "material", name: "Material", values: [{ code: "x", label: "x" }] }],
      [],
    );
    expect(three.error?.message).toMatch(/more than 2 options/);

    const codes = Array.from({ length: 21 }, (_, i) => `c${i}`);
    const many = await save(admin.client, product.id, [colorOption(...codes)], []);
    expect(many.error?.message).toMatch(/more than 20 option values/);
    expect((await snapshot(product.id)).options).toHaveLength(0);
  });

  it("produto inexistente", async () => {
    const { error } = await save(admin.client, randomUUID(), [], [{ values: {} }]);
    expect(error).not.toBeNull();
  });

  it("anônimo e usuário comum não executam e nada muda", async () => {
    const product = await seedProduct();
    for (const client of [anonClient(), plainUser.client]) {
      const { error } = await save(client, product.id, [], [{ values: {} }]);
      expect(error).not.toBeNull();
    }
    expect((await snapshot(product.id)).variants).toHaveLength(0);
  });
});

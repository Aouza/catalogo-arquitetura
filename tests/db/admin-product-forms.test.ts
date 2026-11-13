import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  handleCreateProduct,
  handleSaveStructure,
  handleUpdateProduct,
  type FormOutcome,
} from "@/modules/products/admin-product-forms";
import { getAdminProduct } from "@/modules/products/get-admin-product";
import { setProductStatus } from "@/modules/products/set-status";
import {
  addValue,
  emptyState,
  hydrateEditor,
  listCombos,
  setCombo,
  toStructure,
} from "@/modules/products/structure-editor";
import {
  addImage,
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

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
};

const unique = () => `p-${randomUUID().slice(0, 8)}`;
// Marca única nos nomes: o endereço gerado a partir do nome nunca colide com dados já existentes.
const tag = randomUUID().slice(0, 8);

function expectRedirect(outcome: FormOutcome) {
  if (!("redirectTo" in outcome)) throw new Error(`esperava redirecionamento: ${JSON.stringify(outcome)}`);
  return outcome.redirectTo;
}

function expectState(outcome: FormOutcome) {
  if (!("state" in outcome)) throw new Error("esperava estado de formulário");
  return outcome.state;
}

async function createViaForm(fields: Record<string, string> = {}) {
  const redirectTo = expectRedirect(
    await handleCreateProduct(
      admin.client,
      form({ name: "Vestido Floral", price: "79,90", slug: unique(), ...fields }),
    ),
  );
  const id = /\/admin\/produtos\/([0-9a-f-]{36})\/opcoes\?novo=1$/.exec(redirectTo)?.[1];
  if (!id) throw new Error(`redirecionamento inesperado: ${redirectTo}`);
  createdProducts.push(id);
  return id;
}

beforeAll(async () => {
  admin = await createAdmin();
  plainUser = await createUser();
});

afterAll(async () => {
  if (createdProducts.length) await serviceClient().from("products").delete().in("id", createdProducts);
  await deleteUser(admin);
  await deleteUser(plainUser);
});

describe("passo 1 — dados do produto", () => {
  it("cria o rascunho com o preço digitado em reais e segue para cores e tamanhos", async () => {
    const id = await createViaForm({ name: `Camiseta Básica ${tag}`, price: "1.299,90", description: "Algodão", slug: "" });
    const read = await getAdminProduct(admin.client, id);
    if (!read.ok) throw new Error(read.error.message);
    expect(read.data).toMatchObject({
      name: `Camiseta Básica ${tag}`,
      slug: `camiseta-basica-${tag}`,
      basePriceCents: 129990,
      description: "Algodão",
      status: "draft",
      categoryId: null,
    });
  });

  it("aceita preço zero e liga a categoria escolhida", async () => {
    const { data: category } = await serviceClient()
      .from("categories")
      .insert({ name: "Meninas", slug: unique() })
      .select()
      .single();
    try {
      const id = await createViaForm({ price: "0", categoryId: category!.id });
      const read = await getAdminProduct(admin.client, id);
      expect(read.ok && read.data).toMatchObject({ basePriceCents: 0, categoryId: category!.id });
    } finally {
      await serviceClient().from("categories").delete().eq("id", category!.id);
    }
  });

  it("preço inválido volta com mensagem no campo e preserva o que foi digitado", async () => {
    const state = expectState(await handleCreateProduct(admin.client, form({ name: "Vestido", price: "abc" })));
    expect(state.fieldErrors?.price).toMatch(/preço válido/);
    expect(state.values).toMatchObject({ name: "Vestido", price: "abc" });
  });

  it("nome vazio é recusado", async () => {
    const state = expectState(await handleCreateProduct(admin.client, form({ name: "   ", price: "10" })));
    expect(state.error).toMatch(/nome/i);
  });

  it("endereço repetido pede outro, no campo do endereço", async () => {
    const slug = unique();
    await createViaForm({ slug });
    const state = expectState(await handleCreateProduct(admin.client, form({ name: "Outro", price: "10", slug })));
    expect(state.fieldErrors?.slug).toMatch(/Já existe um produto/);
    expect(state.values?.slug).toBe(slug);
  });

  it("nome sem letras ou números pede um endereço manual", async () => {
    const state = expectState(await handleCreateProduct(admin.client, form({ name: "!!!", price: "10" })));
    expect(state.error).toMatch(/endereço/i);
  });

  it("edita os dados; o endereço só muda se informado", async () => {
    const id = await createViaForm();
    const before = await getAdminProduct(admin.client, id);
    if (!before.ok) throw new Error("falhou");

    const saved = expectState(
      await handleUpdateProduct(admin.client, form({ productId: id, name: "Nome Novo", price: "89,90" })),
    );
    expect(saved).toEqual({ saved: true });

    const after = await getAdminProduct(admin.client, id);
    expect(after.ok && after.data).toMatchObject({ name: "Nome Novo", basePriceCents: 8990, slug: before.data.slug });

    const novo = unique();
    await handleUpdateProduct(admin.client, form({ productId: id, name: "Nome Novo", price: "89,90", slug: novo }));
    const renamed = await getAdminProduct(admin.client, id);
    expect(renamed.ok && renamed.data.slug).toBe(novo);
  });

  it("edição com preço inválido ou produto inválido não altera nada", async () => {
    const id = await createViaForm();
    const bad = expectState(await handleUpdateProduct(admin.client, form({ productId: id, name: "X", price: "" })));
    expect(bad.fieldErrors?.price).toBeDefined();
    expect(expectState(await handleUpdateProduct(admin.client, form({ productId: "x", name: "X", price: "1" }))).error).toBe(
      "Produto inválido.",
    );
    const read = await getAdminProduct(admin.client, id);
    expect(read.ok && read.data.name).toBe("Vestido Floral");
  });

  it("anônimo e usuário comum não criam nem editam", async () => {
    const id = await createViaForm();
    for (const client of [anonClient(), plainUser.client]) {
      const created = await handleCreateProduct(client, form({ name: "Hack", price: "1" }));
      expect(expectState(created).error).toBeDefined();
      const edited = await handleUpdateProduct(client, form({ productId: id, name: "Invadido", price: "1" }));
      expect(expectState(edited).saved).toBeUndefined();
    }
    const read = await getAdminProduct(admin.client, id);
    expect(read.ok && read.data.name).toBe("Vestido Floral");
  });
});

describe("passo 2 — cores e tamanhos (critério de aceite do EPIC 04)", () => {
  const dressEditor = () => {
    let state = emptyState();
    for (const color of ["Rosa", "Azul"]) state = addValue(state, "colors", color).state;
    for (const size of ["2", "4"]) state = addValue(state, "sizes", size).state;
    return state;
  };

  const saveEditor = async (productId: string, state: ReturnType<typeof dressEditor>) => {
    const result = toStructure(state);
    if (!result.ok) throw new Error(result.errors.join(", "));
    return expectState(
      await handleSaveStructure(admin.client, form({ productId, structure: JSON.stringify(result.structure) })),
    );
  };

  it("cadastra vestido com duas cores e dois tamanhos sem criar combinações uma a uma", async () => {
    const id = await createViaForm();
    expect(await saveEditor(id, dressEditor())).toEqual({ saved: true });

    const read = await getAdminProduct(admin.client, id);
    if (!read.ok) throw new Error(read.error.message);
    expect(read.data.options.map((o) => o.code)).toEqual(["cor", "tamanho"]);
    expect(read.data.variants).toHaveLength(4);
    expect(read.data.variants.map((v) => v.values).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))).toEqual([
      { cor: "azul", tamanho: "2" },
      { cor: "azul", tamanho: "4" },
      { cor: "rosa", tamanho: "2" },
      { cor: "rosa", tamanho: "4" },
    ]);
  });

  it("revisão: combinação desmarcada, preço próprio, preço zero e indisponível chegam ao banco", async () => {
    const id = await createViaForm({ price: "79,90" });
    let state = dressEditor();
    state = setCombo(state, "azul|2", { enabled: false });
    state = setCombo(state, "rosa|4", { price: "89,90" });
    state = setCombo(state, "azul|4", { price: "0", available: false });
    await saveEditor(id, state);

    const read = await getAdminProduct(admin.client, id);
    if (!read.ok) throw new Error(read.error.message);
    const variant = (cor: string, tamanho: string) =>
      read.data.variants.find((v) => v.values.cor === cor && v.values.tamanho === tamanho);

    expect(read.data.variants).toHaveLength(3);
    expect(variant("azul", "2")).toBeUndefined();
    expect(variant("rosa", "2")).toMatchObject({ priceOverrideCents: null, effectivePriceCents: 7990 });
    expect(variant("rosa", "4")).toMatchObject({ priceOverrideCents: 8990, effectivePriceCents: 8990 });
    expect(variant("azul", "4")).toMatchObject({ priceOverrideCents: 0, effectivePriceCents: 0, isAvailable: false });
  });

  it("reabrir e salvar de novo preserva tudo (editar produto existente)", async () => {
    const id = await createViaForm();
    let state = dressEditor();
    state = setCombo(state, "azul|2", { enabled: false });
    state = setCombo(state, "rosa|4", { price: "89,90" });
    await saveEditor(id, state);

    const read = await getAdminProduct(admin.client, id);
    if (!read.ok) throw new Error(read.error.message);
    const hydrated = hydrateEditor(read.data);
    if (!hydrated.supported) throw new Error("deveria ser suportado");
    expect(listCombos(hydrated.state).filter((c) => c.config.enabled).map((c) => c.label)).toEqual([
      "Rosa · 2",
      "Rosa · 4",
      "Azul · 4",
    ]);

    // Acrescenta um tamanho e salva: o que já existia mantém preço e disponibilidade.
    const withMore = addValue(hydrated.state, "sizes", "6").state;
    await saveEditor(id, withMore);
    const again = await getAdminProduct(admin.client, id);
    if (!again.ok) throw new Error(again.error.message);
    const rosa4 = again.data.variants.find((v) => v.values.cor === "rosa" && v.values.tamanho === "4");
    expect(rosa4).toMatchObject({ priceOverrideCents: 8990 });
    expect(again.data.options.find((o) => o.code === "tamanho")?.values.map((v) => v.label)).toEqual(["2", "4", "6"]);
  });

  it("produto único: salva sem cores nem tamanhos", async () => {
    const id = await createViaForm({ price: "50" });
    expect(await saveEditor(id, emptyState())).toEqual({ saved: true });
    const read = await getAdminProduct(admin.client, id);
    expect(read.ok && read.data.options).toHaveLength(0);
    expect(read.ok && read.data.variants).toEqual([expect.objectContaining({ values: {} })]);
  });

  it("estrutura inválida é recusada e o que já estava salvo continua", async () => {
    const id = await createViaForm();
    await saveEditor(id, dressEditor());

    const invalid = expectState(
      await handleSaveStructure(
        admin.client,
        form({
          productId: id,
          structure: JSON.stringify({
            options: [{ code: "cor", name: "Cor", values: [{ code: "rosa", label: "Rosa" }] }],
            variants: [{ values: { cor: "rosa" } }, { values: { cor: "rosa" } }],
          }),
        }),
      ),
    );
    expect(invalid.error).toBeDefined();
    expect(invalid.saved).toBeUndefined();

    const read = await getAdminProduct(admin.client, id);
    expect(read.ok && read.data.variants).toHaveLength(4);
  });

  it("texto que não é JSON ou produto inválido não quebra", async () => {
    const id = await createViaForm();
    expect(expectState(await handleSaveStructure(admin.client, form({ productId: id, structure: "{quebrado" }))).error).toMatch(
      /Recarregue/,
    );
    expect(expectState(await handleSaveStructure(admin.client, form({ productId: id }))).error).toBeDefined();
    expect(
      expectState(await handleSaveStructure(admin.client, form({ productId: "x", structure: "{}" }))).error,
    ).toBe("Produto inválido.");
  });

  it("produto publicado: acrescentar uma cor não tira o produto do ar; deixá-lo incompleto é recusado", async () => {
    const id = await createViaForm();
    await saveEditor(id, dressEditor());
    await addImage(id);
    expect(await setProductStatus(admin.client, id, "published")).toMatchObject({ ok: true });

    const withGreen = addValue(dressEditor(), "colors", "Verde").state;
    expect((await saveEditor(id, withGreen)).saved).toBe(true);
    const read = await getAdminProduct(admin.client, id);
    expect(read.ok && read.data.status).toBe("published");
    expect(read.ok && read.data.variants).toHaveLength(6);

    // Tudo desmarcado seria um produto no ar sem opção de compra.
    const empty = expectState(
      await handleSaveStructure(
        admin.client,
        form({ productId: id, structure: JSON.stringify({ options: [], variants: [] }) }),
      ),
    );
    expect(empty.error).toBeDefined();
    const after = await getAdminProduct(admin.client, id);
    expect(after.ok && after.data.variants).toHaveLength(6);
  });

  it("anônimo e usuário comum não salvam combinações", async () => {
    const id = await createViaForm();
    const structure = JSON.stringify({ options: [], variants: [{ values: {} }] });
    for (const client of [anonClient(), plainUser.client]) {
      const state = expectState(await handleSaveStructure(client, form({ productId: id, structure })));
      expect(state.saved).toBeUndefined();
      expect(state.error).toBeDefined();
    }
    const read = await getAdminProduct(admin.client, id);
    expect(read.ok && read.data.variants).toHaveLength(0);
  });
});

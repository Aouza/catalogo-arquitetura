import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getCatalogHome } from "@/modules/catalogs/queries/get-catalog-home";
import { getCatalogListing } from "@/modules/catalogs/queries/get-catalog-listing";
import {
  fetchCategories,
  fetchProducts,
  fetchStore,
  STOREFRONT_PAGE_SIZE,
} from "@/modules/catalogs/queries/storefront-data";
import { removeProductFiles } from "@/modules/media/cleanup-files";
import { anonClient, createAdmin, deleteUser, serviceClient, type TestUser } from "./helpers";

const BUCKET = "product-images";
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

let admin: TestUser;
const createdProducts: string[] = [];
const createdCategories: string[] = [];
const previousEnv = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
};

const db = () => serviceClient();
const tag = randomUUID().slice(0, 8);

async function seedCategory(name = `Categoria ${tag}`) {
  const { data, error } = await db()
    .from("categories")
    .insert({ name, slug: `cat-${randomUUID().slice(0, 8)}` })
    .select()
    .single();
  if (error) throw new Error(error.message);
  createdCategories.push(data.id);
  return data as { id: string; slug: string; name: string };
}

type VariantSpec = { price?: number | null; available?: boolean };

/** Cria o produto como rascunho, com variantes e fotos, e o publica. */
async function seedProduct(options: {
  name?: string;
  base?: number;
  categoryId?: string;
  variants?: VariantSpec[];
  images?: { optionValueId?: string | null; alt?: string }[];
  status?: "draft" | "published" | "archived";
  createdAt?: string;
}) {
  const { data: product, error } = await db()
    .from("products")
    .insert({
      slug: `p-${randomUUID().slice(0, 8)}`,
      name: options.name ?? `Produto ${tag}`,
      base_price_cents: options.base ?? 7990,
      category_id: options.categoryId ?? null,
      ...(options.createdAt ? { created_at: options.createdAt } : {}),
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  createdProducts.push(product.id);

  const variants = options.variants ?? [{}];
  // Várias variantes vazias colidiriam na chave de combinação: cada uma ganha um valor próprio.
  if (variants.length === 1) {
    await db()
      .from("product_variants")
      .insert({
        product_id: product.id,
        price_override_cents: variants[0].price ?? null,
        is_available: variants[0].available ?? true,
      });
  } else {
    const { data: option } = await db()
      .from("product_options")
      .insert({ product_id: product.id, name: "Tamanho", code: "tamanho" })
      .select()
      .single();
    for (const [index, spec] of variants.entries()) {
      const { data: value } = await db()
        .from("product_option_values")
        .insert({ option_id: option!.id, product_id: product.id, label: `T${index}`, code: `t${index}` })
        .select()
        .single();
      const { data: variant } = await db()
        .from("product_variants")
        .insert({
          product_id: product.id,
          price_override_cents: spec.price ?? null,
          is_available: spec.available ?? true,
        })
        .select()
        .single();
      await db().from("variant_option_values").insert({ variant_id: variant!.id, option_value_id: value!.id });
    }
  }

  for (const image of options.images ?? [{}]) {
    await db()
      .from("product_images")
      .insert({
        product_id: product.id,
        option_value_id: image.optionValueId ?? null,
        storage_path: `${product.id}/${randomUUID()}.png`,
        alt_text: image.alt ?? "",
      });
  }

  const status = options.status ?? "published";
  if (status !== "draft") {
    const { error: statusError } = await db().from("products").update({ status }).eq("id", product.id);
    if (statusError) throw new Error(statusError.message);
  }
  return product.id as string;
}

beforeAll(async () => {
  admin = await createAdmin();
  // As páginas públicas leem as variáveis do app; aponta para o Supabase local do teste.
  process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.SUPABASE_URL;
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
});

afterAll(async () => {
  if (previousEnv.url === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  else process.env.NEXT_PUBLIC_SUPABASE_URL = previousEnv.url;
  if (previousEnv.key === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = previousEnv.key;

  for (const id of createdProducts) await removeProductFiles(db(), id);
  if (createdProducts.length) await db().from("products").delete().in("id", createdProducts);
  if (createdCategories.length) await db().from("categories").delete().in("id", createdCategories);
  await deleteUser(admin);
});

const namesIn = async (categoryId: string, page = 1) => {
  const result = await fetchProducts(anonClient(), { categoryId, page });
  return result.items.map((item) => item.name);
};

describe("o que a vitrine lista", () => {
  it("só produtos publicados: rascunho e arquivado ficam de fora", async () => {
    const category = await seedCategory();
    await seedProduct({ name: "Publicado", categoryId: category.id });
    await seedProduct({ name: "Rascunho", categoryId: category.id, status: "draft" });
    await seedProduct({ name: "Arquivado", categoryId: category.id, status: "archived" });

    expect(await namesIn(category.id)).toEqual(["Publicado"]);
  });

  it("nem um admin logado enxerga rascunho pela vitrine (a visão filtra por status)", async () => {
    const category = await seedCategory();
    await seedProduct({ name: "Rascunho secreto", categoryId: category.id, status: "draft" });

    const { data } = await admin.client.from("storefront_products").select("name").eq("category_id", category.id);
    expect(data).toEqual([]);
  });

  it("produto esgotado continua na lista, marcado como indisponível", async () => {
    const category = await seedCategory();
    await seedProduct({ name: "Esgotado", categoryId: category.id, variants: [{ available: false }] });
    await seedProduct({ name: "Disponível", categoryId: category.id });

    const result = await fetchProducts(anonClient(), { categoryId: category.id });
    const byName = Object.fromEntries(result.items.map((item) => [item.name, item]));
    expect(byName["Esgotado"].isAvailable).toBe(false);
    expect(byName["Disponível"].isAvailable).toBe(true);
  });

  it("basta uma combinação disponível para o produto estar disponível", async () => {
    const category = await seedCategory();
    await seedProduct({
      name: "Parcial",
      categoryId: category.id,
      variants: [{ available: false }, { available: true }],
    });
    const result = await fetchProducts(anonClient(), { categoryId: category.id });
    expect(result.items[0].isAvailable).toBe(true);
  });

  it("mais recentes primeiro", async () => {
    const category = await seedCategory();
    await seedProduct({ name: "Antigo", categoryId: category.id, createdAt: "2026-01-01T00:00:00Z" });
    await seedProduct({ name: "Novo", categoryId: category.id, createdAt: "2026-03-01T00:00:00Z" });
    await seedProduct({ name: "Meio", categoryId: category.id, createdAt: "2026-02-01T00:00:00Z" });

    expect(await namesIn(category.id)).toEqual(["Novo", "Meio", "Antigo"]);
  });

  it("filtra por categoria", async () => {
    const a = await seedCategory();
    const b = await seedCategory();
    await seedProduct({ name: "Da A", categoryId: a.id });
    await seedProduct({ name: "Da B", categoryId: b.id });
    expect(await namesIn(a.id)).toEqual(["Da A"]);
    expect(await namesIn(b.id)).toEqual(["Da B"]);
  });

  it("pagina e ajusta página fora do intervalo", async () => {
    const category = await seedCategory();
    const total = STOREFRONT_PAGE_SIZE + 3;
    for (let i = 0; i < total; i++) {
      await seedProduct({
        name: `Item ${String(i).padStart(2, "0")}`,
        categoryId: category.id,
        createdAt: new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString(),
      });
    }

    const first = await fetchProducts(anonClient(), { categoryId: category.id, page: 1 });
    const second = await fetchProducts(anonClient(), { categoryId: category.id, page: 2 });
    expect(first).toMatchObject({ total, totalPages: 2, page: 1 });
    expect(first.items).toHaveLength(STOREFRONT_PAGE_SIZE);
    expect(second.items).toHaveLength(3);
    expect(first.items[0].name).toBe(`Item ${total - 1}`);

    const beyond = await fetchProducts(anonClient(), { categoryId: category.id, page: 99 });
    expect(beyond.page).toBe(2);
    expect((await fetchProducts(anonClient(), { categoryId: category.id, page: 0 })).page).toBe(1);
  }, 120_000);

  it("categoria sem produtos devolve lista vazia", async () => {
    const category = await seedCategory();
    expect(await fetchProducts(anonClient(), { categoryId: category.id })).toEqual({
      items: [],
      total: 0,
      page: 1,
      totalPages: 1,
    });
  });
});

describe("preço de partida (BR-024)", () => {
  const priceOf = async (spec: Parameters<typeof seedProduct>[0]) => {
    const category = await seedCategory();
    await seedProduct({ ...spec, categoryId: category.id });
    const result = await fetchProducts(anonClient(), { categoryId: category.id });
    return result.items[0];
  };

  it("sem preço próprio, vale o preço base e não aparece 'a partir de'", async () => {
    expect(await priceOf({ base: 7990 })).toMatchObject({ basePriceCents: 7990, priceVaries: false });
  });

  it("preços diferentes: o menor entre as combinações, com 'a partir de'", async () => {
    const view = await priceOf({
      base: 7990,
      variants: [{ price: null }, { price: 8990 }, { price: 6990 }],
    });
    expect(view).toMatchObject({ basePriceCents: 6990, priceVaries: true });
  });

  it("todas com o mesmo preço próprio: mostra esse preço, não o base", async () => {
    expect(await priceOf({ base: 7990, variants: [{ price: 8990 }, { price: 8990 }] })).toMatchObject({
      basePriceCents: 8990,
      priceVaries: false,
    });
  });

  it("preço próprio zero é um preço válido (diferente de herdar)", async () => {
    expect(await priceOf({ base: 7990, variants: [{ price: 0 }, { price: null }] })).toMatchObject({
      basePriceCents: 0,
      priceVaries: true,
    });
  });

  it("a combinação indisponível não puxa o preço de partida", async () => {
    const view = await priceOf({
      base: 7990,
      variants: [{ price: 1000, available: false }, { price: 9000 }, { price: 9500 }],
    });
    expect(view).toMatchObject({ basePriceCents: 9000, priceVaries: true });
  });

  it("tudo esgotado: usa o preço de todas as combinações", async () => {
    const view = await priceOf({
      base: 7990,
      variants: [
        { price: 5000, available: false },
        { price: 5000, available: false },
      ],
    });
    expect(view).toMatchObject({ basePriceCents: 5000, isAvailable: false, priceVaries: false });
  });
});

describe("foto de capa (BR-031)", () => {
  async function coverOf(images: { optionValueId?: string | null; alt?: string }[], withColor = false) {
    const category = await seedCategory();
    let colorId: string | undefined;
    const productId = await (async () => {
      // Produto com uma cor, para poder ter foto ligada a ela.
      const { data: product } = await db()
        .from("products")
        .insert({ slug: `p-${randomUUID().slice(0, 8)}`, name: "Capa", base_price_cents: 100, category_id: category.id })
        .select()
        .single();
      createdProducts.push(product!.id);
      if (withColor) {
        const { data: option } = await db()
          .from("product_options")
          .insert({ product_id: product!.id, name: "Cor", code: "cor" })
          .select()
          .single();
        const { data: value } = await db()
          .from("product_option_values")
          .insert({ option_id: option!.id, product_id: product!.id, label: "Rosa", code: "rosa" })
          .select()
          .single();
        colorId = value!.id;
        const { data: variant } = await db()
          .from("product_variants")
          .insert({ product_id: product!.id })
          .select()
          .single();
        await db().from("variant_option_values").insert({ variant_id: variant!.id, option_value_id: value!.id });
      } else {
        await db().from("product_variants").insert({ product_id: product!.id });
      }
      for (const image of images) {
        await db().from("product_images").insert({
          product_id: product!.id,
          option_value_id: image.optionValueId === "COLOR" ? colorId : null,
          storage_path: `${product!.id}/${randomUUID()}.png`,
          alt_text: image.alt ?? "",
        });
      }
      await db().from("products").update({ status: "published" }).eq("id", product!.id);
      return product!.id as string;
    })();

    const result = await fetchProducts(anonClient(), { categoryId: category.id });
    const { data: rows } = await db().from("product_images").select("alt_text, storage_path, option_value_id, position").eq("product_id", productId).order("position");
    return { view: result.items[0], rows: rows ?? [], productId };
  }

  it("a capa é a primeira foto da galeria", async () => {
    const { view, rows, productId } = await coverOf([{ alt: "primeira" }, { alt: "segunda" }]);
    expect(view.imageUrl).toBe(`/fotos/${rows[0].storage_path}`);
    expect(view.imageUrl).toContain(`/fotos/${productId}/`);
    expect(view.imageAlt).toBe("primeira");
  });

  it("foto geral vem antes de foto de cor, mesmo que a da cor esteja na frente da ordem", async () => {
    const { view, rows } = await coverOf([{ optionValueId: "COLOR", alt: "da cor" }, { alt: "geral" }], true);
    expect(rows[0].option_value_id).not.toBeNull();
    expect(view.imageAlt).toBe("geral");
    expect(view.imageUrl).toBe(`/fotos/${rows.find((r) => r.alt_text === "geral")!.storage_path}`);
  });

  it("só foto de cor: usa a primeira dela", async () => {
    const { view } = await coverOf([{ optionValueId: "COLOR", alt: "só da cor" }], true);
    expect(view.imageAlt).toBe("só da cor");
  });
});

describe("a visão da vitrine expõe só o necessário", () => {
  it("colunas esperadas, sem rascunho nem dados internos", async () => {
    const category = await seedCategory();
    await seedProduct({ categoryId: category.id });
    const { data } = await anonClient().from("storefront_products").select("*").eq("category_id", category.id);
    expect(Object.keys(data![0]).sort()).toEqual(
      ["category_id", "cover_alt", "cover_path", "created_at", "id", "is_available", "name", "price_cents", "price_varies", "slug"].sort(),
    );
  });
});

describe("loja e categorias", () => {
  it("lê a loja configurada com tema válido", async () => {
    const data = await fetchStore(anonClient());
    expect(data?.store.name).toBeTruthy();
    expect(data?.theme.colors.action).toMatch(/^#[0-9a-fA-F]{6}$/);
  });

  it("categorias na ordem, com ilustração só nas conhecidas", async () => {
    const custom = await seedCategory(`Zebra ${tag}`);
    const categories = await fetchCategories(anonClient());
    const found = categories.find((c) => c.id === custom.id);
    expect(found).toMatchObject({ name: `Zebra ${tag}`, imageUrl: undefined });
  });
});

describe("home e listagem (com Supabase configurado)", () => {
  it("home: loja real, destaque, categorias e produtos publicados", async () => {
    const category = await seedCategory();
    const name = `Novidade ${tag}`;
    await seedProduct({ name, categoryId: category.id, createdAt: "2030-01-01T00:00:00Z" });
    await seedProduct({ name: `Rascunho ${tag}`, categoryId: category.id, status: "draft" });

    const home = await getCatalogHome();
    expect(home?.store.name).toBeTruthy();
    expect(home?.hero?.title).toBeTruthy();
    expect(home?.categories.some((c) => c.slug === category.slug)).toBe(true);
    const names = home!.products.map((p) => p.name);
    expect(names).toContain(name);
    expect(names).not.toContain(`Rascunho ${tag}`);
    // Sem ids internos na categoria.
    expect(Object.keys(home!.categories[0]).sort()).toEqual(["imageUrl", "name", "slug"]);
  });

  it("listagem de categoria: ok com os produtos dela; categoria inexistente é not-found", async () => {
    const category = await seedCategory();
    await seedProduct({ name: "Só desta", categoryId: category.id });

    const ok = await getCatalogListing({ categorySlug: category.slug });
    expect(ok.status).toBe("ok");
    if (ok.status === "ok") {
      expect(ok.view.category?.slug).toBe(category.slug);
      expect(ok.view.products.map((p) => p.name)).toEqual(["Só desta"]);
      expect(ok.view.total).toBe(1);
    }

    expect(await getCatalogListing({ categorySlug: "nao-existe-" + tag })).toEqual({ status: "not-found" });
  });

  it("listagem geral inclui produtos de qualquer categoria", async () => {
    const result = await getCatalogListing({});
    expect(result.status).toBe("ok");
    if (result.status === "ok") expect(result.view.category).toBeUndefined();
  });
});

describe("rota pública de fotos", () => {
  async function loadRoute() {
    return (await import("@/app/fotos/[productId]/[file]/route")).GET;
  }
  const call = async (productId: string, file: string) => {
    const GET = await loadRoute();
    return GET(new Request(`http://localhost/fotos/${productId}/${file}`), {
      params: Promise.resolve({ productId, file }),
    });
  };

  async function productWithRealPhoto(status: "draft" | "published") {
    const productId = await seedProduct({ status: "draft", images: [] });
    const file = `${randomUUID()}.png`;
    const path = `${productId}/${file}`;
    const upload = await admin.client.storage.from(BUCKET).upload(path, PNG, { contentType: "image/png" });
    if (upload.error) throw new Error(upload.error.message);
    await db().from("product_images").insert({ product_id: productId, storage_path: path });
    if (status === "published") await db().from("products").update({ status: "published" }).eq("id", productId);
    return { productId, file, path };
  }

  it("serve a foto de produto publicado com tipo e cache", async () => {
    const { productId, file } = await productWithRealPhoto("published");
    const response = await call(productId, file);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("cache-control")).toMatch(/max-age=300/);
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(Buffer.from(await response.arrayBuffer()).equals(PNG)).toBe(true);
  });

  it("foto de rascunho responde 404", async () => {
    const { productId, file } = await productWithRealPhoto("draft");
    expect((await call(productId, file)).status).toBe(404);
  });

  it("ao tirar o produto do ar, a foto deixa de ser servida", async () => {
    const { productId, file } = await productWithRealPhoto("published");
    expect((await call(productId, file)).status).toBe(200);
    await db().from("products").update({ status: "draft" }).eq("id", productId);
    expect((await call(productId, file)).status).toBe(404);
  });

  it("arquivo sem foto cadastrada (órfão) responde 404, mesmo em produto publicado", async () => {
    const { productId } = await productWithRealPhoto("published");
    const orphan = `${randomUUID()}.png`;
    await admin.client.storage.from(BUCKET).upload(`${productId}/${orphan}`, PNG, { contentType: "image/png" });
    expect((await call(productId, orphan)).status).toBe(404);
  });

  it.each([
    ["id inválido", "nao-e-id", `${randomUUID()}.png`],
    ["nome fora do padrão", randomUUID(), "foto.png"],
    ["extensão não permitida", randomUUID(), `${randomUUID()}.svg`],
    ["tentativa de sair da pasta", randomUUID(), "..%2F..%2Fsegredo.png"],
  ])("%s responde 404", async (_label, productId, file) => {
    expect((await call(productId, file)).status).toBe(404);
  });
});

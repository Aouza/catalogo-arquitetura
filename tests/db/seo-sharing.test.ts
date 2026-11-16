import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { anonClient, serviceClient } from "./helpers";
import { fetchSitemapData } from "@/modules/catalogs/queries/sitemap-data";

const previousEnv = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  site: process.env.NEXT_PUBLIC_SITE_URL,
};
const db = () => serviceClient();
const createdProducts: string[] = [];
const createdCategories: string[] = [];
const tag = randomUUID().slice(0, 8);

async function seedCategory(name: string) {
  const { data } = await db()
    .from("categories")
    .insert({ name, slug: `cat-${randomUUID().slice(0, 8)}` })
    .select()
    .single();
  createdCategories.push(data!.id);
  return data as { id: string; slug: string; name: string };
}

async function seedProduct(options: {
  name?: string;
  description?: string;
  categoryId?: string;
  status?: "draft" | "published" | "archived";
  photos?: { alt: string; general: boolean }[];
}) {
  const slug = `p-${randomUUID().slice(0, 8)}`;
  const { data: product } = await db()
    .from("products")
    .insert({
      slug,
      name: options.name ?? `Produto ${tag}`,
      description: options.description ?? "",
      base_price_cents: 7990,
      category_id: options.categoryId ?? null,
    })
    .select()
    .single();
  createdProducts.push(product!.id);
  await db().from("product_variants").insert({ product_id: product!.id });

  const photos = options.photos ?? [{ alt: "capa", general: true }];
  const photoPaths: string[] = [];
  for (const photo of photos) {
    let optionValueId: string | null = null;
    if (!photo.general) {
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
      optionValueId = value!.id;
      const { data: variant } = await db().from("product_variants").select("id").eq("product_id", product!.id).single();
      await db().from("variant_option_values").delete().eq("variant_id", variant!.id);
      await db().from("variant_option_values").insert({ variant_id: variant!.id, option_value_id: value!.id });
    }
    const path = `${product!.id}/${randomUUID()}.png`;
    photoPaths.push(path);
    await db()
      .from("product_images")
      .insert({ product_id: product!.id, option_value_id: optionValueId, storage_path: path, alt_text: photo.alt });
  }

  const status = options.status ?? "published";
  if (status !== "draft") await db().from("products").update({ status }).eq("id", product!.id);
  return { id: product!.id as string, slug, photoPaths };
}

beforeAll(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.SUPABASE_URL;
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
  process.env.NEXT_PUBLIC_SITE_URL = "https://loja.example";
});

afterAll(async () => {
  const restore = (name: string, value: string | undefined) => {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  };
  restore("NEXT_PUBLIC_SUPABASE_URL", previousEnv.url);
  restore("NEXT_PUBLIC_SUPABASE_ANON_KEY", previousEnv.key);
  restore("NEXT_PUBLIC_SITE_URL", previousEnv.site);

  if (createdProducts.length) await db().from("products").delete().in("id", createdProducts);
  if (createdCategories.length) await db().from("categories").delete().in("id", createdCategories);
});

describe("mapa do site", () => {
  it("lista só o publicado: rascunho e arquivado ficam de fora", async () => {
    const category = await seedCategory(`Com produto ${tag}`);
    const empty = await seedCategory(`Vazia ${tag}`);
    const published = await seedProduct({ categoryId: category.id });
    const draft = await seedProduct({ status: "draft", categoryId: category.id });
    const archived = await seedProduct({ status: "archived" });

    const data = await fetchSitemapData(anonClient());
    const slugs = data.products.map((p) => p.slug);
    expect(slugs).toContain(published.slug);
    expect(slugs).not.toContain(draft.slug);
    expect(slugs).not.toContain(archived.slug);

    const categories = data.categories.map((c) => c.slug);
    expect(categories).toContain(category.slug);
    expect(categories).not.toContain(empty.slug);
  });

  it("traz a data da última alteração do produto", async () => {
    const product = await seedProduct({});
    const data = await fetchSitemapData(anonClient());
    const entry = data.products.find((p) => p.slug === product.slug);
    expect(entry && Number.isNaN(new Date(entry.updatedAt).getTime())).toBe(false);
  });

  it("ao tirar o produto do ar, ele sai do mapa", async () => {
    const product = await seedProduct({});
    expect((await fetchSitemapData(anonClient())).products.map((p) => p.slug)).toContain(product.slug);
    await db().from("products").update({ status: "draft" }).eq("id", product.id);
    expect((await fetchSitemapData(anonClient())).products.map((p) => p.slug)).not.toContain(product.slug);
  });

  it("a rota /sitemap.xml devolve endereços completos do site", async () => {
    const product = await seedProduct({});
    const sitemap = (await import("@/app/sitemap")).default;
    const entries = await sitemap();
    const urls = entries.map((e) => e.url);
    expect(urls).toContain("https://loja.example/");
    expect(urls).toContain("https://loja.example/produtos");
    expect(urls).toContain(`https://loja.example/produto/${product.slug}`);
    expect(urls.every((url) => url.startsWith("https://loja.example/"))).toBe(true);
  });
});

describe("prévia de link das páginas", () => {
  const productMeta = async (slug: string) =>
    (await import("@/app/produto/[slug]/page")).generateMetadata({ params: Promise.resolve({ slug }) });

  it("produto: título com a loja, descrição, endereço oficial e a foto geral na prévia", async () => {
    const product = await seedProduct({
      name: "Vestido Floral",
      description: "Algodão macio, ideal para o verão.",
      photos: [
        { alt: "da cor", general: false },
        { alt: "geral", general: true },
      ],
    });

    const meta = await productMeta(product.slug);
    expect(meta.title).toMatchObject({ absolute: expect.stringMatching(/^Vestido Floral · .+/) });
    expect(meta.description).toBe("Algodão macio, ideal para o verão.");
    expect(meta.alternates?.canonical).toBe(`/produto/${product.slug}`);
    expect(meta.openGraph?.images).toEqual([{ url: `/fotos/${product.photoPaths[1]}`, alt: "geral" }]);
    expect(meta.twitter).toMatchObject({ card: "summary_large_image" });
    expect(meta.robots).toBeUndefined();
  });

  it("produto sem descrição usa um texto padrão com o nome do produto e da loja", async () => {
    const product = await seedProduct({ name: "Jaqueta", description: "" });
    const meta = await productMeta(product.slug);
    expect(meta.description).toMatch(/^Jaqueta na .+\. Veja as opções e fale pelo WhatsApp\.$/);
  });

  it("produto que não está publicado ou não existe sai da busca (noindex)", async () => {
    const draft = await seedProduct({ status: "draft" });
    for (const slug of [draft.slug, `nao-existe-${tag}`]) {
      const meta = await productMeta(slug);
      expect(meta.robots).toMatchObject({ index: false });
      expect(meta.alternates).toBeUndefined();
    }
  });

  it("categoria: título, endereço oficial (com página) e noindex se não existe", async () => {
    const category = await seedCategory(`Meninas ${tag}`);
    await seedProduct({ categoryId: category.id });
    const { generateMetadata } = await import("@/app/categoria/[slug]/page");

    const meta = await generateMetadata({
      params: Promise.resolve({ slug: category.slug }),
      searchParams: Promise.resolve({}),
    });
    expect(meta.title).toMatchObject({ absolute: expect.stringContaining(`Meninas ${tag} · `) });
    expect(meta.alternates?.canonical).toBe(`/categoria/${category.slug}`);

    const missing = await generateMetadata({
      params: Promise.resolve({ slug: `nao-existe-${tag}` }),
      searchParams: Promise.resolve({}),
    });
    expect(missing.robots).toMatchObject({ index: false });
  });

  it("lista de produtos e página inicial têm título, endereço oficial e prévia", async () => {
    const list = await (await import("@/app/produtos/page")).generateMetadata({ searchParams: Promise.resolve({}) });
    expect(list.title).toMatchObject({ absolute: expect.stringContaining("Todos os produtos · ") });
    expect(list.alternates?.canonical).toBe("/produtos");
    expect(list.openGraph?.images).toEqual([expect.objectContaining({ url: "/images/hero/hero-family.webp" })]);

    const home = await (await import("@/app/page")).generateMetadata();
    expect(home.alternates?.canonical).toBe("/");
    expect(home.twitter).toMatchObject({ card: "summary_large_image" });
    expect(home.openGraph?.images).toEqual([expect.objectContaining({ url: "/images/hero/hero-family.webp" })]);
  });
});

import type { SupabaseClient } from "@supabase/supabase-js";
import { routes } from "@/lib/routes";
import { fetchCategories } from "./storefront-data";

const PAGE = 1000;
// O limite do protocolo é 50.000 endereços por mapa; sobra margem para a home e as categorias.
const MAX_PRODUCTS = 45_000;

export type SitemapData = {
  products: { slug: string; updatedAt: string }[];
  /** Só categorias que têm produto publicado (página vazia não vai para o mapa). */
  categories: { slug: string }[];
};

/** Produtos publicados e categorias com produtos, para o mapa do site. */
export async function fetchSitemapData(client: SupabaseClient): Promise<SitemapData> {
  const products: SitemapData["products"] = [];
  const usedCategories = new Set<string>();

  for (let from = 0; from < MAX_PRODUCTS; from += PAGE) {
    const { data, error } = await client
      .from("storefront_products")
      .select("slug, category_id, updated_at")
      .order("created_at", { ascending: false })
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`Falha ao ler os produtos do mapa do site: ${error.message}`);

    for (const row of data ?? []) {
      products.push({ slug: row.slug as string, updatedAt: row.updated_at as string });
      if (row.category_id) usedCategories.add(row.category_id as string);
    }
    if ((data ?? []).length < PAGE) break;
  }

  const categories = (await fetchCategories(client)).filter((category) => usedCategories.has(category.id));
  return { products, categories: categories.map(({ slug }) => ({ slug })) };
}

export type SitemapEntry = { url: string; lastModified?: Date; changeFrequency?: "daily" | "weekly"; priority?: number };

/** Endereços completos do mapa: início, todos os produtos, categorias e cada produto publicado. */
export function buildSitemapEntries(data: SitemapData, baseUrl: string): SitemapEntry[] {
  const at = (path: string) => `${baseUrl}${path}`;
  const latest = data.products.reduce<Date | undefined>((acc, product) => {
    const date = new Date(product.updatedAt);
    return !acc || date > acc ? date : acc;
  }, undefined);

  return [
    { url: at(routes.home()), lastModified: latest, changeFrequency: "daily", priority: 1 },
    { url: at(routes.products()), lastModified: latest, changeFrequency: "daily", priority: 0.8 },
    ...data.categories.map((category) => ({
      url: at(routes.category(category.slug)),
      changeFrequency: "daily" as const,
      priority: 0.7,
    })),
    ...data.products.map((product) => ({
      url: at(routes.product(product.slug)),
      lastModified: new Date(product.updatedAt),
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
  ];
}

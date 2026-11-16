import { createPublicClient } from "@/lib/supabase/public";
import { demoCatalog } from "../fixtures/demo-catalog";
import type { CatalogTheme } from "../theme/tokens";
import type { CategoryView, ProductView, StoreInfo } from "../types";
import { fetchCategories, fetchProducts, fetchStore } from "./storefront-data";

export type CatalogListingView = {
  store: StoreInfo;
  theme: CatalogTheme;
  categories: CategoryView[];
  /** Categoria da página (ausente em "todos os produtos"). */
  category?: CategoryView;
  products: ProductView[];
  total: number;
  page: number;
  totalPages: number;
};

export type CatalogListingResult =
  | { status: "ok"; view: CatalogListingView }
  | { status: "not-found" };

const NOT_FOUND: CatalogListingResult = { status: "not-found" };

function fixtureListing(categorySlug?: string): CatalogListingResult {
  if (process.env.NODE_ENV === "production") return NOT_FOUND;

  const category = categorySlug ? demoCatalog.categories.find((c) => c.slug === categorySlug) : undefined;
  if (categorySlug && !category) return NOT_FOUND;

  const products: ProductView[] = demoCatalog.products
    .filter((p) => p.status === "published")
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      basePriceCents: p.basePriceCents,
      imageUrl: p.imageUrl,
      imageAlt: p.imageAlt,
      isAvailable: p.variants.some((v) => v.isAvailable),
    }));

  return {
    status: "ok",
    view: {
      store: demoCatalog.store,
      theme: demoCatalog.theme,
      categories: demoCatalog.categories,
      category,
      products,
      total: products.length,
      page: 1,
      totalPages: 1,
    },
  };
}

/** Lista paginada de produtos publicados, de todas as categorias ou de uma só. */
export async function getCatalogListing(
  options: { categorySlug?: string; page?: number } = {},
): Promise<CatalogListingResult> {
  const client = createPublicClient();
  if (!client) return fixtureListing(options.categorySlug);

  const [storeData, categories] = await Promise.all([fetchStore(client), fetchCategories(client)]);
  if (!storeData) return NOT_FOUND;

  const category = options.categorySlug ? categories.find((c) => c.slug === options.categorySlug) : undefined;
  if (options.categorySlug && !category) return NOT_FOUND;

  const products = await fetchProducts(client, { categoryId: category?.id, page: options.page });

  return {
    status: "ok",
    view: {
      store: storeData.store,
      theme: storeData.theme,
      categories: categories.map(({ slug, name, imageUrl }) => ({ slug, name, imageUrl })),
      category: category ? { slug: category.slug, name: category.name, imageUrl: category.imageUrl } : undefined,
      products: products.items,
      total: products.total,
      page: products.page,
      totalPages: products.totalPages,
    },
  };
}

import { cacheLife, cacheTag } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import { STOREFRONT_LIFE, STOREFRONT_TAG } from "../cache";
import type { ProductDetail } from "../product-detail";
import type { CatalogTheme } from "../theme/tokens";
import type { CategoryView, StoreInfo } from "../types";
import { fetchProductDetail } from "./product-detail-data";
import { fetchCategories, fetchStore } from "./storefront-data";

export type ProductPageView = {
  store: StoreInfo;
  theme: CatalogTheme;
  categories: CategoryView[];
  detail: ProductDetail;
};

export type ProductPageResult = { status: "ok"; view: ProductPageView } | { status: "not-found" };

/** Dados da página de um produto publicado. Sem Supabase configurado não há produto para mostrar. */
export async function getProductPage(slug: string): Promise<ProductPageResult> {
  "use cache";
  cacheTag(STOREFRONT_TAG);
  cacheLife(STOREFRONT_LIFE);

  const client = createPublicClient();
  if (!client) return { status: "not-found" };

  const [storeData, detail, categories] = await Promise.all([
    fetchStore(client),
    fetchProductDetail(client, slug),
    fetchCategories(client),
  ]);
  if (!storeData || !detail) return { status: "not-found" };

  return {
    status: "ok",
    view: {
      store: storeData.store,
      theme: storeData.theme,
      categories: categories.map(({ slug: categorySlug, name, imageUrl }) => ({ slug: categorySlug, name, imageUrl })),
      detail,
    },
  };
}

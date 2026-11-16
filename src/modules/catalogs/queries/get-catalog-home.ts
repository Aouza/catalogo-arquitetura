import { cacheLife, cacheTag } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import { STOREFRONT_LIFE, STOREFRONT_TAG } from "../cache";
import { defaultHero } from "../default-hero";
import { demoCatalog, type FixtureCatalog } from "../fixtures/demo-catalog";
import type { CatalogHomeView, ProductView } from "../types";
import { fetchCategories, fetchProducts, fetchStore, HOME_PRODUCT_COUNT } from "./storefront-data";

// Sem Supabase configurado, só o ambiente de desenvolvimento mostra o catálogo de exemplo.
function fixtureCatalog(): FixtureCatalog | null {
  if (process.env.NODE_ENV === "production") return null;
  return demoCatalog;
}

function fixtureHome(): CatalogHomeView | null {
  const catalog = fixtureCatalog();
  if (!catalog) return null;

  const products: ProductView[] = catalog.products
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
    store: catalog.store,
    theme: catalog.theme,
    hero: catalog.hero,
    categories: catalog.categories,
    productsOrder: "published_at",
    products,
  };
}

/** Home da vitrine com os produtos publicados; `null` se a loja não está configurada. */
export async function getCatalogHome(): Promise<CatalogHomeView | null> {
  "use cache";
  cacheTag(STOREFRONT_TAG);
  cacheLife(STOREFRONT_LIFE);

  const client = createPublicClient();
  if (!client) return fixtureHome();

  const [storeData, categories, products] = await Promise.all([
    fetchStore(client),
    fetchCategories(client),
    fetchProducts(client, { pageSize: HOME_PRODUCT_COUNT }),
  ]);
  if (!storeData) return null;

  return {
    store: storeData.store,
    theme: storeData.theme,
    hero: defaultHero,
    categories: categories.map(({ slug, name, imageUrl }) => ({ slug, name, imageUrl })),
    productsOrder: "published_at",
    products: products.items,
  };
}

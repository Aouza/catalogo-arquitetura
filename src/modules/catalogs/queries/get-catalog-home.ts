import { demoCatalog, type FixtureCatalog } from "../fixtures/demo-catalog";
import type { CatalogHomeView, ProductView } from "../types";

// Troque esta função por leitura do Supabase mantendo o contrato de CatalogHomeView.
function findCatalog(): FixtureCatalog | null {
  if (process.env.NODE_ENV === "production") return null;
  return demoCatalog;
}

export async function getCatalogHome(): Promise<CatalogHomeView | null> {
  const catalog = findCatalog();
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

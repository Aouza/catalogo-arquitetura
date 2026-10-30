import { demoCatalog, type FixtureCatalog } from "../fixtures/demo-catalog";
import { isReservedSlug } from "../reserved-slugs";
import type { CatalogHomeView, ProductView } from "../types";

// Troque esta função por leitura do Supabase mantendo o contrato de CatalogHomeView.
function findCatalog(slug: string): FixtureCatalog | null {
  if (process.env.NODE_ENV === "production") return null;
  return slug === demoCatalog.store.slug ? demoCatalog : null;
}

export async function getCatalogHome(slug: string): Promise<CatalogHomeView | null> {
  const normalized = slug.toLowerCase();
  if (isReservedSlug(normalized)) return null;

  const catalog = findCatalog(normalized);
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

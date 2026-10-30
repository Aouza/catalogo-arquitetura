import type { CatalogHomeView } from "@/modules/catalogs/types";
import { CategoryStrip } from "./category-strip";
import { EmptyState } from "./empty-state";
import { Hero } from "./hero";
import { ProductGrid } from "./product-grid";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";
import { ThemeScope } from "./theme-scope";

export function CatalogHome({ home }: { home: CatalogHomeView }) {
  const { store, theme, hero, categories, products, productsOrder } = home;
  return (
    <ThemeScope theme={theme}>
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-30 focus:rounded-control focus:bg-surface focus:px-4 focus:py-3"
      >
        Pular para o conteúdo
      </a>
      <SiteHeader store={store} categories={categories} />
      <main id="conteudo" className="flex-1">
        {hero ? <Hero storeSlug={store.slug} hero={hero} /> : <h1 className="sr-only">{store.name}</h1>}
        <CategoryStrip storeSlug={store.slug} categories={categories} />
        {products.length > 0 ? (
          <ProductGrid storeSlug={store.slug} products={products} order={productsOrder} />
        ) : (
          <EmptyState whatsappE164={store.whatsappE164} />
        )}
      </main>
      <SiteFooter store={store} />
    </ThemeScope>
  );
}

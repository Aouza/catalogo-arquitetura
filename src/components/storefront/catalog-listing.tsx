import Link from "next/link";
import { Container } from "@/components/ui/container";
import { routes } from "@/lib/routes";
import type { CatalogListingView } from "@/modules/catalogs/queries/get-catalog-listing";
import { CategoryStrip } from "./category-strip";
import { Pager } from "./pager";
import { ProductCard } from "./product-card";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";
import { ThemeScope } from "./theme-scope";

/** Página de lista da vitrine: todos os produtos ou os de uma categoria. */
export function CatalogListing({ view }: { view: CatalogListingView }) {
  const { store, theme, categories, category, products, total, page, totalPages } = view;
  const title = category ? category.name : "Todos os produtos";
  const hrefFor = (target: number) => {
    const base = category ? routes.category(category.slug) : routes.products();
    return target > 1 ? `${base}?pagina=${target}` : base;
  };

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
        <CategoryStrip categories={categories} />
        <section aria-labelledby="listing-title" className="py-6">
          <Container>
            <nav aria-label="Você está em" className="mb-2 text-label text-fg-muted">
              <Link href={routes.home()} className="inline-flex min-h-11 items-center hover:text-fg">
                Início
              </Link>
              <span aria-hidden="true"> / </span>
              <span aria-current="page">{title}</span>
            </nav>
            <h1 id="listing-title" className="font-heading text-h1 font-semibold text-fg">
              {title}
            </h1>
            <p className="mt-1 mb-4 text-label text-fg-muted">
              {total === 1 ? "1 produto" : `${total} produtos`}
            </p>

            {products.length > 0 ? (
              <ul className="grid grid-cols-2 gap-3 min-[600px]:grid-cols-3 lg:grid-cols-4 lg:gap-4">
                {products.map((product, index) => (
                  <ProductCard key={product.slug} product={product} priority={index < 2} />
                ))}
              </ul>
            ) : (
              <div className="rounded-card bg-surface-subtle p-8 text-center">
                <p className="text-body text-fg">
                  {category ? "Ainda não há produtos nesta categoria." : "Novidades chegando em breve."}
                </p>
                <Link
                  href={routes.home()}
                  className="mt-4 inline-flex min-h-12 items-center justify-center rounded-control border border-border-strong bg-surface px-5 text-label font-semibold text-fg"
                >
                  Voltar para o início
                </Link>
              </div>
            )}

            <Pager page={page} totalPages={totalPages} hrefFor={hrefFor} />
          </Container>
        </section>
      </main>
      <SiteFooter store={store} />
    </ThemeScope>
  );
}

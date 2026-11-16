import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CatalogListing } from "@/components/storefront/catalog-listing";
import { HomeSkeleton } from "@/components/storefront/home-skeleton";
import { routes } from "@/lib/routes";
import { getCatalogListing } from "@/modules/catalogs/queries/get-catalog-listing";
import { parsePage } from "@/modules/catalogs/queries/parse-page";
import { defaultShareImage, shareMetadata } from "@/modules/catalogs/seo";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const result = await getCatalogListing({ categorySlug: slug, page: parsePage(query.pagina) });
  if (result.status === "not-found" || !result.view.category) {
    return { title: "Página não encontrada", robots: { index: false } };
  }

  const { store, category, page } = result.view;
  return shareMetadata({
    title: `${category.name} · ${store.name}`,
    description: `Produtos da categoria ${category.name} na ${store.name}. Escolha e fale pelo WhatsApp.`,
    path: page > 1 ? `${routes.category(category.slug)}?pagina=${page}` : routes.category(category.slug),
    siteName: store.name,
    image: defaultShareImage(),
  });
}

async function CategoryContent({ params, searchParams }: Props) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const result = await getCatalogListing({ categorySlug: slug, page: parsePage(query.pagina) });
  if (result.status === "not-found") notFound();
  return <CatalogListing view={result.view} />;
}

export default function CategoryPage(props: Props) {
  return (
    <Suspense fallback={<HomeSkeleton />}>
      <CategoryContent {...props} />
    </Suspense>
  );
}

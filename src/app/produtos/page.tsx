import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CatalogListing } from "@/components/storefront/catalog-listing";
import { HomeSkeleton } from "@/components/storefront/home-skeleton";
import { routes } from "@/lib/routes";
import { getCatalogListing } from "@/modules/catalogs/queries/get-catalog-listing";
import { parsePage } from "@/modules/catalogs/queries/parse-page";
import { defaultShareImage, shareMetadata } from "@/modules/catalogs/seo";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const result = await getCatalogListing({ page: parsePage((await searchParams).pagina) });
  if (result.status === "not-found") return { title: "Página não encontrada", robots: { index: false } };

  const { store, page } = result.view;
  return shareMetadata({
    title: `Todos os produtos · ${store.name}`,
    description: `Veja todos os produtos da ${store.name} e fale pelo WhatsApp.`,
    // Cada página da lista é um endereço próprio; a primeira é o endereço limpo.
    path: page > 1 ? `${routes.products()}?pagina=${page}` : routes.products(),
    siteName: store.name,
    image: defaultShareImage(),
  });
}

async function ProductsContent({ searchParams }: Props) {
  const result = await getCatalogListing({ page: parsePage((await searchParams).pagina) });
  if (result.status === "not-found") notFound();
  return <CatalogListing view={result.view} />;
}

export default function ProductsPage(props: Props) {
  return (
    <Suspense fallback={<HomeSkeleton />}>
      <ProductsContent {...props} />
    </Suspense>
  );
}

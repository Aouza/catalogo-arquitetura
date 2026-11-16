import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CatalogListing } from "@/components/storefront/catalog-listing";
import { HomeSkeleton } from "@/components/storefront/home-skeleton";
import { getCatalogListing } from "@/modules/catalogs/queries/get-catalog-listing";
import { parsePage } from "@/modules/catalogs/queries/parse-page";

export const metadata: Metadata = {
  title: "Todos os produtos",
  description: "Veja todos os produtos da loja.",
};

async function ProductsContent({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const page = parsePage((await searchParams).pagina);
  const result = await getCatalogListing({ page });
  if (result.status === "not-found") notFound();
  return <CatalogListing view={result.view} />;
}

export default function ProductsPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return (
    <Suspense fallback={<HomeSkeleton />}>
      <ProductsContent searchParams={props.searchParams} />
    </Suspense>
  );
}

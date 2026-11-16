import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CatalogListing } from "@/components/storefront/catalog-listing";
import { HomeSkeleton } from "@/components/storefront/home-skeleton";
import { getCatalogListing } from "@/modules/catalogs/queries/get-catalog-listing";
import { parsePage } from "@/modules/catalogs/queries/parse-page";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Pick<Props, "params">): Promise<Metadata> {
  const { slug } = await params;
  const result = await getCatalogListing({ categorySlug: slug });
  if (result.status === "not-found" || !result.view.category) {
    return { title: "Página não encontrada", robots: { index: false } };
  }
  return {
    title: result.view.category.name,
    description: `Produtos da categoria ${result.view.category.name}.`,
  };
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

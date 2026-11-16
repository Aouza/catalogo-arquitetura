import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CatalogHome } from "@/components/storefront/catalog-home";
import { HomeSkeleton } from "@/components/storefront/home-skeleton";
import { routes } from "@/lib/routes";
import { getCatalogHome } from "@/modules/catalogs/queries/get-catalog-home";
import { shareMetadata, summarize } from "@/modules/catalogs/seo";

export async function generateMetadata(): Promise<Metadata> {
  const home = await getCatalogHome();
  if (!home) return { title: "Página não encontrada", robots: { index: false } };

  const { store, hero } = home;
  const image = hero?.imageUrl
    ? { url: hero.imageUrl, alt: hero.imageAlt ?? store.name }
    : store.logoUrl
      ? { url: store.logoUrl, alt: store.name }
      : undefined;

  return shareMetadata({
    title: store.name,
    description: summarize(store.description) || store.name,
    path: routes.home(),
    siteName: store.name,
    image,
  });
}

async function CatalogHomeContent() {
  const home = await getCatalogHome();
  if (!home) notFound();
  return <CatalogHome home={home} />;
}

export default function HomePage() {
  return (
    <Suspense fallback={<HomeSkeleton />}>
      <CatalogHomeContent />
    </Suspense>
  );
}

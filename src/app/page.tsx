import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CatalogHome } from "@/components/storefront/catalog-home";
import { HomeSkeleton } from "@/components/storefront/home-skeleton";
import { getCatalogHome } from "@/modules/catalogs/queries/get-catalog-home";

export async function generateMetadata(): Promise<Metadata> {
  const home = await getCatalogHome();
  if (!home) return { title: "Página não encontrada", robots: { index: false } };

  const { store } = home;
  return {
    title: store.name,
    description: store.description,
    openGraph: {
      title: store.name,
      description: store.description,
      type: "website",
      locale: "pt_BR",
      ...(store.logoUrl ? { images: [store.logoUrl] } : {}),
    },
  };
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

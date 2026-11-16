import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { HomeSkeleton } from "@/components/storefront/home-skeleton";
import { ProductDetailView } from "@/components/storefront/product-detail-view";
import { routes } from "@/lib/routes";
import { siteUrl } from "@/lib/site";
import { parseSelection } from "@/modules/catalogs/product-detail";
import { getProductPage } from "@/modules/catalogs/queries/get-product-page";
import { defaultShareImage, shareMetadata, summarize } from "@/modules/catalogs/seo";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Pick<Props, "params">): Promise<Metadata> {
  const { slug } = await params;
  const result = await getProductPage(slug);
  if (result.status === "not-found") return { title: "Página não encontrada", robots: { index: false } };

  const { store, detail } = result.view;
  // A prévia do link (WhatsApp, Instagram) usa a foto geral (ou a primeira); a escolha de cor e
  // tamanho da URL não muda o endereço oficial da página.
  const cover = detail.images.find((image) => image.optionValueId === null) ?? detail.images[0];

  return shareMetadata({
    title: `${detail.name} · ${store.name}`,
    description:
      summarize(detail.description) || `${detail.name} na ${store.name}. Veja as opções e fale pelo WhatsApp.`,
    path: routes.product(detail.slug),
    siteName: store.name,
    image: cover ? { url: cover.path, alt: cover.alt || detail.name } : defaultShareImage(),
  });
}

async function ProductContent({ params, searchParams }: Props) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const result = await getProductPage(slug);
  if (result.status === "not-found") notFound();

  return (
    <ProductDetailView
      view={result.view}
      selection={parseSelection(result.view.detail, query)}
      baseUrl={siteUrl()}
    />
  );
}

export default function ProductPage(props: Props) {
  return (
    <Suspense fallback={<HomeSkeleton />}>
      <ProductContent {...props} />
    </Suspense>
  );
}

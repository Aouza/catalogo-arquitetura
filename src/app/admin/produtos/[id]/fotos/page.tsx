import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminPageBoundary } from "@/components/admin/page-boundary";
import { FlashBanner } from "@/components/admin/flash-banner";
import { PhotoGrid } from "@/components/admin/photo-grid";
import { PhotoUploader } from "@/components/admin/photo-uploader";
import { StatusBadge } from "@/components/admin/status-badge";
import { WizardSteps } from "@/components/admin/wizard-steps";
import { ButtonLink } from "@/components/ui/button-link";
import { Container } from "@/components/ui/container";
import { routes } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/modules/auth/require-admin";
import { MAX_IMAGES_PER_PRODUCT } from "@/modules/media/constants";
import { listProductImages } from "@/modules/media/list-product-images";
import { readFlash } from "@/modules/products/flash";
import { getAdminProduct } from "@/modules/products/get-admin-product";
import { isProductId } from "@/modules/products/ids";
import type { RawParams } from "@/modules/products/list-params";
import { deleteImageAction, moveImageAction, updateImageAction } from "../../actions";

export const metadata: Metadata = { title: "Fotos" };

async function ProductPhotosPageContent({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<RawParams>;
}) {
  await requireAdmin();

  const { id } = await params;
  if (!isProductId(id)) notFound();

  const client = await createClient();
  const [product, images] = await Promise.all([getAdminProduct(client, id), listProductImages(client, id)]);
  if (!product.ok) notFound();

  const data = product.data;
  const photos = images.ok ? images.data : [];
  const colors = (data.options.find((option) => option.code === "cor")?.values ?? []).map((value) => ({
    id: value.id,
    label: value.label,
  }));
  const flash = readFlash(await searchParams);

  return (
    <main className="py-8">
      <Container className="flex max-w-3xl flex-col gap-6">
        <div className="flex flex-col gap-3">
          <ButtonLink href={routes.adminProducts()} className="self-start">
            ← Voltar para a lista
          </ButtonLink>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-heading text-h1 font-bold break-words text-fg">{data.name}</h1>
            <StatusBadge status={data.status} />
          </div>
        </div>

        <WizardSteps current="photos" productId={data.id} />
        <FlashBanner flash={flash} />

        {!images.ok ? (
          <p role="alert" className="rounded-card border border-accent-strong bg-surface p-4 text-body text-accent-strong">
            Não foi possível carregar as fotos agora. Recarregue a página em instantes.
          </p>
        ) : null}

        <PhotoUploader
          productId={data.id}
          colors={colors}
          remainingSlots={Math.max(0, MAX_IMAGES_PER_PRODUCT - photos.length)}
        />

        <section aria-labelledby="gallery-title" className="flex flex-col gap-3">
          <div>
            <h2 id="gallery-title" className="font-heading text-h2 font-bold text-fg">
              Galeria ({photos.length} de {MAX_IMAGES_PER_PRODUCT})
            </h2>
            <p className="text-label text-fg-muted">
              A primeira foto é a capa. Fotos ligadas a uma cor aparecem primeiro quando o cliente escolhe essa cor.
            </p>
          </div>
          <PhotoGrid
            productId={data.id}
            images={photos}
            colors={colors}
            returnTo={routes.adminProductPhotos(data.id)}
            updateImage={updateImageAction}
            moveImage={moveImageAction}
            deleteImage={deleteImageAction}
          />
        </section>

        <div className="flex justify-between gap-3">
          <ButtonLink href={routes.adminProductOptions(data.id)}>← Cores e tamanhos</ButtonLink>
          <ButtonLink href={routes.adminProductPublish(data.id)} variant="primary">
            Próximo: Publicar →
          </ButtonLink>
        </div>
      </Container>
    </main>
  );
}

export default function ProductPhotosPage(props: Parameters<typeof ProductPhotosPageContent>[0]) {
  return (
    <AdminPageBoundary>
      <ProductPhotosPageContent {...props} />
    </AdminPageBoundary>
  );
}

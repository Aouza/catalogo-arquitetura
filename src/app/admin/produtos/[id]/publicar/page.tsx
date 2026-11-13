import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminPageBoundary } from "@/components/admin/page-boundary";
import { FlashBanner } from "@/components/admin/flash-banner";
import { PublishPanel } from "@/components/admin/publish-panel";
import { StatusBadge } from "@/components/admin/status-badge";
import { WizardSteps } from "@/components/admin/wizard-steps";
import { ButtonLink } from "@/components/ui/button-link";
import { Container } from "@/components/ui/container";
import { routes } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/modules/auth/require-admin";
import { readFlash } from "@/modules/products/flash";
import { getAdminProduct } from "@/modules/products/get-admin-product";
import { isProductId } from "@/modules/products/ids";
import type { RawParams } from "@/modules/products/list-params";
import { buildChecklist } from "@/modules/products/publish-checklist";
import { changeStatusAction, toggleAvailabilityAction } from "../../actions";

export const metadata: Metadata = { title: "Publicar" };

async function PublishPageContent({
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
  const [product, imageCount] = await Promise.all([
    getAdminProduct(client, id),
    client.from("product_images").select("id", { count: "exact", head: true }).eq("product_id", id),
  ]);
  if (!product.ok) notFound();

  const data = product.data;
  const checklist = buildChecklist(data, imageCount.count ?? 0);
  const flash = readFlash(await searchParams);

  return (
    <main className="py-8">
      <Container className="flex max-w-2xl flex-col gap-6">
        <div className="flex flex-col gap-3">
          <ButtonLink href={routes.adminProducts()} className="self-start">
            ← Voltar para a lista
          </ButtonLink>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-heading text-h1 font-bold break-words text-fg">{data.name}</h1>
            <StatusBadge status={data.status} />
          </div>
        </div>

        <WizardSteps current="publish" productId={data.id} />
        <FlashBanner flash={flash} />

        <PublishPanel
          product={data}
          checklist={checklist}
          returnTo={routes.adminProductPublish(data.id)}
          changeStatus={changeStatusAction}
          toggleAvailability={toggleAvailabilityAction}
        />

        <div className="flex justify-start">
          <ButtonLink href={routes.adminProductPhotos(data.id)}>← Fotos</ButtonLink>
        </div>
      </Container>
    </main>
  );
}

export default function PublishPage(props: Parameters<typeof PublishPageContent>[0]) {
  return (
    <AdminPageBoundary>
      <PublishPageContent {...props} />
    </AdminPageBoundary>
  );
}

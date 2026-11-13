import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StatusBadge } from "@/components/admin/status-badge";
import { StructureEditor } from "@/components/admin/structure-editor";
import { WizardSteps } from "@/components/admin/wizard-steps";
import { ButtonLink } from "@/components/ui/button-link";
import { Container } from "@/components/ui/container";
import { routes } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/modules/auth/require-admin";
import { getAdminProduct } from "@/modules/products/get-admin-product";
import { isProductId } from "@/modules/products/ids";
import type { RawParams } from "@/modules/products/list-params";
import { hydrateEditor } from "@/modules/products/structure-editor";
import { saveStructureAction } from "../../actions";
import { AdminPageBoundary } from "@/components/admin/page-boundary";

export const metadata: Metadata = { title: "Cores e tamanhos" };

async function ProductOptionsPageContent({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<RawParams>;
}) {
  await requireAdmin();

  const { id } = await params;
  if (!isProductId(id)) notFound();

  const product = await getAdminProduct(await createClient(), id);
  if (!product.ok) notFound();

  const data = product.data;
  const justCreated = (await searchParams).novo === "1";
  const editor = hydrateEditor(data);

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

        <WizardSteps current="options" productId={data.id} />

        {justCreated ? (
          <p role="status" className="rounded-card border border-action bg-surface-subtle p-4 text-body text-fg">
            Produto criado como rascunho. Agora defina as cores e os tamanhos.
          </p>
        ) : null}

        {editor.supported ? (
          <StructureEditor
            productId={data.id}
            basePriceCents={data.basePriceCents}
            initial={editor.state}
            action={saveStructureAction}
          />
        ) : (
          <p role="status" className="rounded-card border border-border bg-surface-subtle p-4 text-body text-fg">
            Este produto tem opções personalizadas (diferentes de cor e tamanho) e não pode ser editado nesta tela.
          </p>
        )}
      </Container>
    </main>
  );
}

export default function ProductOptionsPage(props: Parameters<typeof ProductOptionsPageContent>[0]) {
  return (
    <AdminPageBoundary>
      <ProductOptionsPageContent {...props} />
    </AdminPageBoundary>
  );
}

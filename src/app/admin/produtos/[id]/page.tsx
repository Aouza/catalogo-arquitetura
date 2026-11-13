import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductDataForm } from "@/components/admin/product-data-form";
import { StatusBadge } from "@/components/admin/status-badge";
import { WizardSteps } from "@/components/admin/wizard-steps";
import { ButtonLink } from "@/components/ui/button-link";
import { Container } from "@/components/ui/container";
import { centsToInput } from "@/lib/format";
import { routes } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/modules/auth/require-admin";
import { listCategories } from "@/modules/categories/list-categories";
import { getAdminProduct } from "@/modules/products/get-admin-product";
import { isProductId } from "@/modules/products/ids";
import { updateProductAction } from "../actions";
import { AdminPageBoundary } from "@/components/admin/page-boundary";

export const metadata: Metadata = { title: "Editar produto" };

async function EditProductPageContent({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();

  const { id } = await params;
  if (!isProductId(id)) notFound();

  const client = await createClient();
  const [product, categories] = await Promise.all([getAdminProduct(client, id), listCategories(client)]);
  if (!product.ok) notFound();

  const data = product.data;

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

        <WizardSteps current="data" productId={data.id} />

        <ProductDataForm
          mode="edit"
          action={updateProductAction}
          categories={categories.ok ? categories.data : []}
          defaults={{
            productId: data.id,
            name: data.name,
            price: centsToInput(data.basePriceCents),
            description: data.description,
            categoryId: data.categoryId ?? "",
            slug: "",
          }}
        />
        <div className="flex justify-end">
          <ButtonLink href={routes.adminProductOptions(data.id)} variant="primary">
            Próximo: Cores e tamanhos →
          </ButtonLink>
        </div>
      </Container>
    </main>
  );
}

export default function EditProductPage(props: Parameters<typeof EditProductPageContent>[0]) {
  return (
    <AdminPageBoundary>
      <EditProductPageContent {...props} />
    </AdminPageBoundary>
  );
}

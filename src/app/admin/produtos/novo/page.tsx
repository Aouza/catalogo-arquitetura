import type { Metadata } from "next";
import { ProductDataForm } from "@/components/admin/product-data-form";
import { WizardSteps } from "@/components/admin/wizard-steps";
import { Container } from "@/components/ui/container";
import { ButtonLink } from "@/components/ui/button-link";
import { routes } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/modules/auth/require-admin";
import { listCategories } from "@/modules/categories/list-categories";
import { createProductAction } from "../actions";
import { AdminPageBoundary } from "@/components/admin/page-boundary";

export const metadata: Metadata = { title: "Novo produto" };

async function NewProductPageContent() {
  await requireAdmin();
  const categories = await listCategories(await createClient());

  return (
    <main className="py-8">
      <Container className="flex max-w-2xl flex-col gap-6">
        <div className="flex flex-col gap-3">
          <ButtonLink href={routes.adminProducts()} className="self-start">
            ← Voltar para a lista
          </ButtonLink>
          <h1 className="font-heading text-h1 font-bold text-fg">Novo produto</h1>
          <p className="text-body text-fg-muted">
            O produto é salvo como rascunho: ele só aparece na loja quando você publicar.
          </p>
        </div>

        <WizardSteps current="data" />

        <ProductDataForm
          mode="create"
          action={createProductAction}
          categories={categories.ok ? categories.data : []}
          defaults={{ name: "", price: "", description: "", categoryId: "", slug: "" }}
        />
      </Container>
    </main>
  );
}

export default function NewProductPage() {
  return (
    <AdminPageBoundary>
      <NewProductPageContent />
    </AdminPageBoundary>
  );
}

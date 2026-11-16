import type { Metadata } from "next";
import { AdminPageBoundary } from "@/components/admin/page-boundary";
import { CategoryList } from "@/components/admin/category-list";
import { FlashBanner } from "@/components/admin/flash-banner";
import { Container } from "@/components/ui/container";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/modules/auth/require-admin";
import { readCategoryFlash } from "@/modules/categories/flash";
import { listAdminCategories } from "@/modules/categories/manage-categories";
import {
  createCategoryAction,
  deleteCategoryAction,
  moveCategoryAction,
  renameCategoryAction,
} from "./actions";

export const metadata: Metadata = { title: "Categorias" };

type RawParams = Record<string, string | string[] | undefined>;

async function AdminCategoriesPageContent({ searchParams }: { searchParams: Promise<RawParams> }) {
  await requireAdmin();

  const flash = readCategoryFlash(await searchParams);
  const list = await listAdminCategories(await createClient());

  return (
    <main className="py-8">
      <Container className="flex flex-col gap-6">
        <div>
          <h1 className="font-heading text-h1 font-bold text-fg">Categorias</h1>
          <p className="mt-1 text-body text-fg-muted">
            Organizam a vitrine e o cadastro de produtos. A ordem daqui é a que o cliente vê.
          </p>
        </div>

        <FlashBanner flash={flash} />

        <form action={createCategoryAction} className="flex flex-wrap items-end gap-2 rounded-card bg-surface-subtle p-4">
          <div className="flex min-w-48 flex-1 flex-col gap-1">
            <label htmlFor="new-category-name" className="text-label font-semibold text-fg">
              Nova categoria
            </label>
            <input
              id="new-category-name"
              name="name"
              required
              maxLength={80}
              placeholder="Ex.: Pijamas"
              className="min-h-12 w-full rounded-control border border-border-strong bg-surface px-4 text-body text-fg"
              autoComplete="off"
            />
          </div>
          <button
            type="submit"
            className="inline-flex min-h-12 items-center justify-center rounded-control bg-action px-5 text-label font-semibold text-white transition-colors hover:bg-action-hover"
          >
            Adicionar
          </button>
        </form>

        {!list.ok ? (
          <p role="alert" className="rounded-card border border-accent-strong bg-surface p-4 text-body text-accent-strong">
            Não foi possível carregar as categorias agora. Recarregue a página em instantes.
          </p>
        ) : list.data.length === 0 ? (
          <div className="rounded-card bg-surface-subtle p-8 text-center">
            <p className="text-body text-fg">Nenhuma categoria ainda. Crie a primeira acima.</p>
          </div>
        ) : (
          <CategoryList
            items={list.data}
            renameCategory={renameCategoryAction}
            moveCategory={moveCategoryAction}
            deleteCategory={deleteCategoryAction}
          />
        )}
      </Container>
    </main>
  );
}

export default function AdminCategoriesPage(props: Parameters<typeof AdminCategoriesPageContent>[0]) {
  return (
    <AdminPageBoundary>
      <AdminCategoriesPageContent {...props} />
    </AdminPageBoundary>
  );
}

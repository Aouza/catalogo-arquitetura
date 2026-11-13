import type { Metadata } from "next";
import { Pagination } from "@/components/admin/pagination";
import { ProductFilters } from "@/components/admin/product-filters";
import { ProductList } from "@/components/admin/product-list";
import { Container } from "@/components/ui/container";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/modules/auth/require-admin";
import { listCategories } from "@/modules/categories/list-categories";
import { readFlash } from "@/modules/products/flash";
import { listHref, parseListParams, type RawParams } from "@/modules/products/list-params";
import { listAdminProducts } from "@/modules/products/list-products";
import { changeStatusAction, deleteProductAction } from "./actions";

export const metadata: Metadata = { title: "Produtos" };

export default async function AdminProductsPage({ searchParams }: { searchParams: Promise<RawParams> }) {
  await requireAdmin();

  const params = await searchParams;
  const filters = parseListParams(params);
  const flash = readFlash(params);

  const client = await createClient();
  const [list, categories] = await Promise.all([listAdminProducts(client, filters), listCategories(client)]);

  const categoryOptions = categories.ok ? categories.data : [];
  const hasFilters = Boolean(filters.query || filters.status || filters.categoryId);

  return (
    <>
      <main className="py-8">
        <Container className="flex flex-col gap-6">
          <div>
            <h1 className="font-heading text-h1 font-bold text-fg">Produtos</h1>
            {list.ok ? (
              <p className="mt-1 text-body text-fg-muted">
                {list.data.total === 1 ? "1 produto" : `${list.data.total} produtos`}
                {hasFilters ? " com os filtros escolhidos" : ""}
              </p>
            ) : null}
          </div>

          {flash ? (
            <p
              role={flash.kind === "error" ? "alert" : "status"}
              className={`rounded-card border p-4 text-body ${
                flash.kind === "error"
                  ? "border-accent-strong bg-surface text-accent-strong"
                  : "border-action bg-surface-subtle text-fg"
              }`}
            >
              {flash.message}
            </p>
          ) : null}

          <ProductFilters filters={filters} categories={categoryOptions} />

          {!list.ok ? (
            <p role="alert" className="rounded-card border border-accent-strong bg-surface p-4 text-body text-accent-strong">
              Não foi possível carregar os produtos agora. Recarregue a página em instantes.
            </p>
          ) : list.data.items.length === 0 ? (
            <div className="rounded-card bg-surface-subtle p-8 text-center">
              <p className="text-body text-fg">
                {hasFilters ? "Nenhum produto encontrado com esses filtros." : "Nenhum produto cadastrado ainda."}
              </p>
            </div>
          ) : (
            <>
              <ProductList
                items={list.data.items}
                categories={categoryOptions}
                returnTo={listHref({ ...filters, page: list.data.page })}
                changeStatus={changeStatusAction}
                deleteProduct={deleteProductAction}
              />
              <Pagination page={list.data.page} totalPages={list.data.totalPages} filters={filters} />
            </>
          )}
        </Container>
      </main>
    </>
  );
}

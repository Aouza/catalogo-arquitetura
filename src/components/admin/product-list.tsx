import { formatPrice } from "@/lib/format";
import type { CategoryOption } from "@/modules/categories/list-categories";
import type { AdminProductListItem } from "@/modules/products/list-products";
import { StatusBadge } from "./status-badge";

type Action = (formData: FormData) => void | Promise<void>;

const dateFormat = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Sao_Paulo" });

const button =
  "inline-flex min-h-12 items-center justify-center rounded-control border border-border-strong bg-surface px-4 text-label font-semibold text-fg hover:border-action";
const primaryButton =
  "inline-flex min-h-12 items-center justify-center rounded-control bg-action px-4 text-label font-semibold text-white transition-colors hover:bg-action-hover";
const dangerButton =
  "inline-flex min-h-12 items-center justify-center rounded-control bg-accent-strong px-4 text-label font-semibold text-white";

const INTENTS = {
  publish: "Publicar",
  unpublish: "Tirar do ar",
  archive: "Arquivar",
  reactivate: "Reativar",
} as const;

/** Ações disponíveis em cada situação (draft → published → archived; volta sempre por rascunho). */
const ACTIONS: Record<AdminProductListItem["status"], (keyof typeof INTENTS)[]> = {
  draft: ["publish"],
  published: ["unpublish", "archive"],
  archived: ["reactivate"],
};

export function ProductList({
  items,
  categories,
  returnTo,
  changeStatus,
  deleteProduct,
}: {
  items: AdminProductListItem[];
  categories: CategoryOption[];
  /** URL da lista atual (com filtros), para voltar a ela depois da ação. */
  returnTo: string;
  changeStatus: Action;
  deleteProduct: Action;
}) {
  const categoryName = new Map(categories.map((category) => [category.id, category.name]));

  return (
    <ul className="flex flex-col gap-3">
      {items.map((product) => (
        <li key={product.id} className="rounded-card border border-border bg-surface p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 className="font-heading text-h2 font-bold break-words text-fg">{product.name}</h2>
              <p className="text-caption break-all text-fg-muted">/produto/{product.slug}</p>
            </div>
            <StatusBadge status={product.status} />
          </div>

          <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-label text-fg-muted">
            <div>
              <dt className="inline">Preço base: </dt>
              <dd className="inline font-semibold text-fg">{formatPrice(product.basePriceCents)}</dd>
            </div>
            <div>
              <dt className="inline">Categoria: </dt>
              <dd className="inline text-fg">
                {(product.categoryId && categoryName.get(product.categoryId)) || "Sem categoria"}
              </dd>
            </div>
            <div>
              <dt className="inline">Atualizado em: </dt>
              <dd className="inline text-fg">{dateFormat.format(new Date(product.updatedAt))}</dd>
            </div>
          </dl>

          <div className="mt-4 flex flex-wrap items-start gap-2">
            {ACTIONS[product.status].map((intent) => (
              <form key={intent} action={changeStatus}>
                <input type="hidden" name="id" value={product.id} />
                <input type="hidden" name="intent" value={intent} />
                <input type="hidden" name="returnTo" value={returnTo} />
                <button type="submit" className={intent === "publish" ? primaryButton : button}>
                  {INTENTS[intent]}
                </button>
              </form>
            ))}

            {/* Confirmação sem JavaScript: o botão perigoso só aparece depois de abrir. */}
            <details className="group">
              <summary className={`${button} cursor-pointer list-none`}>Excluir</summary>
              <div className="mt-2 flex max-w-xs flex-col gap-2 rounded-card border border-border bg-surface-subtle p-3">
                <p className="text-label text-fg">
                  Excluir “{product.name}” para sempre? Isso apaga também opções, combinações e fotos, e não pode
                  ser desfeito.
                </p>
                <form action={deleteProduct}>
                  <input type="hidden" name="id" value={product.id} />
                  <input type="hidden" name="returnTo" value={returnTo} />
                  <button type="submit" className={dangerButton}>
                    Confirmar exclusão
                  </button>
                </form>
              </div>
            </details>
          </div>
        </li>
      ))}
    </ul>
  );
}

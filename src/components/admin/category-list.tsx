import type { AdminCategory } from "@/modules/categories/manage-categories";

type Action = (formData: FormData) => void | Promise<void>;

const field =
  "min-h-12 w-full rounded-control border border-border-strong bg-surface px-4 text-body text-fg";
const button =
  "inline-flex min-h-12 items-center justify-center rounded-control border border-border-strong bg-surface px-4 text-label font-semibold text-fg hover:border-action disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-border-strong";
const dangerButton =
  "inline-flex min-h-12 items-center justify-center rounded-control bg-accent-strong px-4 text-label font-semibold text-white";

function productCountText(count: number): string {
  if (count === 0) return "Nenhum produto";
  return count === 1 ? "1 produto" : `${count} produtos`;
}

export function CategoryList({
  items,
  renameCategory,
  moveCategory,
  deleteCategory,
}: {
  items: AdminCategory[];
  renameCategory: Action;
  moveCategory: Action;
  deleteCategory: Action;
}) {
  return (
    <ul className="flex flex-col gap-3">
      {items.map((category, index) => (
        <li key={category.id} className="rounded-card border border-border bg-surface p-4">
          <div className="min-w-0">
            <h2 className="font-heading text-h2 font-bold break-words text-fg">{category.name}</h2>
            <p className="text-caption break-all text-fg-muted">
              /categoria/{category.slug} · {productCountText(category.productCount)}
            </p>
          </div>

          <form action={renameCategory} className="mt-3 flex flex-wrap items-end gap-2">
            <input type="hidden" name="id" value={category.id} />
            <div className="flex min-w-48 flex-1 flex-col gap-1">
              <label htmlFor={`name-${category.id}`} className="text-label font-semibold text-fg">
                Nome
              </label>
              <input
                id={`name-${category.id}`}
                name="name"
                required
                maxLength={80}
                defaultValue={category.name}
                className={field}
                autoComplete="off"
              />
            </div>
            <button type="submit" className={button}>
              Salvar nome
            </button>
          </form>

          <div className="mt-3 flex flex-wrap items-start gap-2">
            <form action={moveCategory}>
              <input type="hidden" name="id" value={category.id} />
              <input type="hidden" name="direction" value="up" />
              <button type="submit" className={button} disabled={index === 0}>
                Subir
              </button>
            </form>
            <form action={moveCategory}>
              <input type="hidden" name="id" value={category.id} />
              <input type="hidden" name="direction" value="down" />
              <button type="submit" className={button} disabled={index === items.length - 1}>
                Descer
              </button>
            </form>

            {/* Confirmação sem JavaScript: o botão perigoso só aparece depois de abrir. */}
            <details className="group">
              <summary className={`${button} cursor-pointer list-none`}>Excluir</summary>
              <div className="mt-2 flex max-w-xs flex-col gap-2 rounded-card border border-border bg-surface-subtle p-3">
                <p className="text-label text-fg">
                  Excluir “{category.name}”?{" "}
                  {category.productCount > 0
                    ? `Os ${productCountText(category.productCount)} dela não serão apagados: ficarão sem categoria.`
                    : "Nenhum produto usa essa categoria."}{" "}
                  Não pode ser desfeito.
                </p>
                <form action={deleteCategory}>
                  <input type="hidden" name="id" value={category.id} />
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

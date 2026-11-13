import Link from "next/link";
import { formatPrice } from "@/lib/format";
import type { AdminProduct } from "@/modules/products/get-admin-product";
import { isReadyToPublish, type ChecklistItem } from "@/modules/products/publish-checklist";
import { variantLabel } from "@/modules/products/variant-labels";

type Action = (formData: FormData) => void | Promise<void>;

const button =
  "inline-flex min-h-12 items-center justify-center rounded-control border border-border-strong bg-surface px-4 text-label font-semibold text-fg hover:border-action";
const primary =
  "inline-flex min-h-12 items-center justify-center rounded-control bg-action px-5 text-label font-semibold text-white transition-colors hover:bg-action-hover";

function StatusForm({
  action,
  productId,
  intent,
  returnTo,
  className,
  children,
}: {
  action: Action;
  productId: string;
  intent: "publish" | "unpublish" | "archive" | "reactivate";
  returnTo: string;
  className: string;
  children: React.ReactNode;
}) {
  return (
    <form action={action}>
      <input type="hidden" name="id" value={productId} />
      <input type="hidden" name="intent" value={intent} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <button type="submit" className={className}>
        {children}
      </button>
    </form>
  );
}

/** Revisão final: o que falta para publicar e, com o produto no ar, a disponibilidade de cada combinação. */
export function PublishPanel({
  product,
  checklist,
  returnTo,
  changeStatus,
  toggleAvailability,
}: {
  product: AdminProduct;
  checklist: ChecklistItem[];
  returnTo: string;
  changeStatus: Action;
  toggleAvailability: Action;
}) {
  const ready = isReadyToPublish(checklist);

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="checklist-title" className="flex flex-col gap-3">
        <h2 id="checklist-title" className="font-heading text-h2 font-bold text-fg">
          {product.status === "draft" ? "Antes de publicar" : "Cadastro do produto"}
        </h2>
        <ul className="flex flex-col gap-2">
          {checklist.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-card border border-border bg-surface p-4"
            >
              <div>
                <p className="text-body font-semibold text-fg">
                  <span aria-hidden="true">{item.done ? "✓ " : "✗ "}</span>
                  {item.label}
                  <span className="sr-only">{item.done ? " — pronto" : " — falta completar"}</span>
                </p>
                {!item.done && item.pending ? (
                  <p className="text-label text-accent-strong">{item.pending}</p>
                ) : null}
              </div>
              {!item.done ? (
                <Link href={item.href} className={button}>
                  Completar
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      {product.status === "draft" ? (
        <section className="flex flex-col gap-3">
          <p className="text-body text-fg-muted">
            {ready
              ? "Tudo pronto. Ao publicar, o produto passa a aparecer na loja."
              : "Complete os itens acima para poder publicar."}
          </p>
          <div>
            <StatusForm
              action={changeStatus}
              productId={product.id}
              intent="publish"
              returnTo={returnTo}
              className={`${primary} ${ready ? "" : "opacity-60"}`}
            >
              Publicar produto
            </StatusForm>
          </div>
        </section>
      ) : null}

      {product.status === "published" ? (
        <>
          <section aria-labelledby="availability-title" className="flex flex-col gap-3">
            <div>
              <h2 id="availability-title" className="font-heading text-h2 font-bold text-fg">
                Disponibilidade
              </h2>
              <p className="text-label text-fg-muted">
                O produto está no ar. Marque como indisponível o que esgotou, sem refazer o cadastro.
              </p>
            </div>
            <ul className="flex flex-col gap-2">
              {product.variants.map((variant) => (
                <li
                  key={variant.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-card border border-border bg-surface p-4"
                >
                  <div>
                    <p className="text-body font-semibold text-fg">{variantLabel(product, variant)}</p>
                    <p className="text-label text-fg-muted">
                      {formatPrice(variant.effectivePriceCents)} ·{" "}
                      <span className={variant.isAvailable ? "text-fg" : "font-semibold text-accent-strong"}>
                        {variant.isAvailable ? "Disponível" : "Indisponível"}
                      </span>
                    </p>
                  </div>
                  <form action={toggleAvailability}>
                    <input type="hidden" name="variantId" value={variant.id} />
                    <input type="hidden" name="available" value={variant.isAvailable ? "false" : "true"} />
                    <input type="hidden" name="returnTo" value={returnTo} />
                    <button type="submit" className={button}>
                      {variant.isAvailable ? "Marcar como indisponível" : "Marcar como disponível"}
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          </section>

          <section className="flex flex-wrap gap-2">
            <StatusForm
              action={changeStatus}
              productId={product.id}
              intent="unpublish"
              returnTo={returnTo}
              className={button}
            >
              Tirar do ar
            </StatusForm>
            <StatusForm
              action={changeStatus}
              productId={product.id}
              intent="archive"
              returnTo={returnTo}
              className={button}
            >
              Arquivar
            </StatusForm>
          </section>
        </>
      ) : null}

      {product.status === "archived" ? (
        <section className="flex flex-col gap-3">
          <p className="text-body text-fg-muted">
            Este produto está arquivado e não aparece na loja. Reative para voltar a editá-lo como rascunho.
          </p>
          <div>
            <StatusForm
              action={changeStatus}
              productId={product.id}
              intent="reactivate"
              returnTo={returnTo}
              className={button}
            >
              Reativar como rascunho
            </StatusForm>
          </div>
        </section>
      ) : null}
    </div>
  );
}

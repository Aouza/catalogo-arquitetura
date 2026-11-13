import { STATUS_LABELS } from "@/modules/products/list-params";
import type { ProductStatus } from "@/modules/products/set-status";

const STYLES: Record<ProductStatus, string> = {
  published: "bg-action text-white",
  draft: "bg-surface-subtle text-fg",
  archived: "border border-border-strong bg-surface text-fg-muted",
};

/** A situação sempre aparece como texto (não só por cor). */
export function StatusBadge({ status }: { status: ProductStatus }) {
  return (
    <span className={`inline-flex rounded-control px-2 py-1 text-caption font-semibold ${STYLES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

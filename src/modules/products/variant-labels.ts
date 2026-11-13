import type { AdminProduct } from "./get-admin-product";

/** Nome legível de uma combinação para o lojista, ex.: "Rosa · 4" (ou "Produto único"). */
export function variantLabel(
  product: Pick<AdminProduct, "options">,
  variant: { values: Record<string, string> },
): string {
  const parts = product.options
    .map((option) => {
      const code = variant.values[option.code];
      return option.values.find((value) => value.code === code)?.label;
    })
    .filter((label): label is string => Boolean(label));
  return parts.length ? parts.join(" · ") : "Produto único";
}

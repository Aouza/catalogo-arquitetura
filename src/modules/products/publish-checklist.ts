import { routes } from "@/lib/routes";
import type { AdminProduct } from "./get-admin-product";

export type ChecklistItem = {
  id: "data" | "options" | "photos";
  label: string;
  done: boolean;
  /** O que falta, quando não está pronto. */
  pending?: string;
  href: string;
};

/** Situação de cada requisito para publicar (BR-016), em linguagem do lojista. */
export function buildChecklist(
  product: Pick<AdminProduct, "id" | "name" | "options" | "variants">,
  imageCount: number,
): ChecklistItem[] {
  const optionsHaveValues = product.options.every((option) => option.values.length > 0);
  const variantsComplete =
    product.variants.length > 0 &&
    product.variants.every((variant) => Object.keys(variant.values).length === product.options.length);
  const optionsDone = optionsHaveValues && variantsComplete;

  return [
    {
      id: "data",
      label: "Dados do produto",
      done: product.name.trim().length > 0,
      pending: "Informe o nome e o preço.",
      href: routes.adminProduct(product.id),
    },
    {
      id: "options",
      label: "Cores e tamanhos",
      done: optionsDone,
      pending: "Salve ao menos uma opção de compra (combinação).",
      href: routes.adminProductOptions(product.id),
    },
    {
      id: "photos",
      label: "Fotos",
      done: imageCount > 0,
      pending: "Adicione ao menos uma foto.",
      href: routes.adminProductPhotos(product.id),
    },
  ];
}

export const isReadyToPublish = (items: ChecklistItem[]) => items.every((item) => item.done);

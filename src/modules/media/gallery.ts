export type GalleryImage = {
  id: string;
  /** Valor de opção (ex.: a cor) a que a foto pertence; `null` = foto geral. */
  optionValueId: string | null;
  position: number;
};

/**
 * Galeria exibida para a seleção atual (BR-031, BR-032):
 * - com cor escolhida: primeiro as fotos dessa cor, depois as gerais (fallback);
 *   nunca aparecem fotos de outra cor;
 * - sem escolha: as fotos gerais (ou todas, se o produto só tiver fotos por cor);
 * - trocar o tamanho não altera a galeria.
 */
export function galleryImages<T extends GalleryImage>(
  images: T[],
  selectedValueId?: string | null,
): T[] {
  const ordered = [...images].sort((a, b) => a.position - b.position);
  const general = ordered.filter((image) => image.optionValueId === null);

  if (!selectedValueId) return general.length > 0 ? general : ordered;

  const specific = ordered.filter((image) => image.optionValueId === selectedValueId);
  return [...specific, ...general];
}

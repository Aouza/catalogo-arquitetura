export type MoveDirection = "up" | "down";

/**
 * Nova ordem da galeria depois de mover uma foto uma posição. A primeira da ordem é a capa.
 * Nos limites (subir a primeira, descer a última) ou com id desconhecido, a ordem não muda.
 */
export function moveImage(orderedIds: string[], id: string, direction: MoveDirection): string[] {
  const from = orderedIds.indexOf(id);
  if (from < 0) return [...orderedIds];

  const to = direction === "up" ? from - 1 : from + 1;
  if (to < 0 || to >= orderedIds.length) return [...orderedIds];

  const next = [...orderedIds];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}

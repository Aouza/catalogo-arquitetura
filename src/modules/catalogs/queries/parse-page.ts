const MAX_PAGE = 10_000;

/** Número da página vindo da URL (`?pagina=2`); qualquer valor inválido vira a página 1. */
export function parsePage(value: string | string[] | undefined): number {
  const text = Array.isArray(value) ? value[0] : value;
  const page = Number.parseInt(text ?? "", 10);
  return Number.isInteger(page) && page >= 1 && page <= MAX_PAGE ? page : 1;
}

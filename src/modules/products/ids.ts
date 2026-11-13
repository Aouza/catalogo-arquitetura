const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** O identificador na URL só é usado se tiver o formato de um id de produto. */
export function isProductId(value: string): boolean {
  return UUID.test(value);
}

/**
 * Preço efetivo de uma variante (BR-024): `price_override_cents ?? base_price_cents`.
 * Zero é um preço válido; somente `null` herda o preço base.
 */
export function effectivePriceCents(baseCents: number, overrideCents: number | null): number {
  return overrideCents ?? baseCents;
}

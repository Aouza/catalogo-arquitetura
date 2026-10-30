const RESERVED = new Set(["admin", "api", "_next"]);

export function isReservedSlug(slug: string): boolean {
  return RESERVED.has(slug.toLowerCase());
}

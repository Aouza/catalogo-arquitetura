const seg = encodeURIComponent;

// Único lugar que monta URLs públicas. Caminhos provisórios (ver OQ-15).
export const routes = {
  catalog: (slug: string) => `/${seg(slug)}`,
  products: (slug: string) => `/${seg(slug)}/produtos`,
  search: (slug: string) => `/${seg(slug)}/busca`,
  category: (slug: string, categorySlug: string) => `/${seg(slug)}/categoria/${seg(categorySlug)}`,
  product: (slug: string, productSlug: string) => `/${seg(slug)}/produto/${seg(productSlug)}`,
};

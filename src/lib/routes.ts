const seg = encodeURIComponent;

// Único lugar que monta URLs públicas. Loja única: o catálogo vive na raiz (ADR-0001).
export const routes = {
  home: () => "/",
  products: () => "/produtos",
  search: () => "/busca",
  category: (categorySlug: string) => `/categoria/${seg(categorySlug)}`,
  product: (productSlug: string) => `/produto/${seg(productSlug)}`,
  login: () => "/login",
  admin: () => "/admin",
  adminProducts: () => "/admin/produtos",
};

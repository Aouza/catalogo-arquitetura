import type { CatalogTheme } from "./theme/tokens";

export type StoreInfo = {
  name: string;
  description: string;
  logoUrl?: string;
  /** Logo completo (com "MODA"), usado no cabeçalho desktop; sem ele vale `logoUrl`. */
  logoFullUrl?: string;
  whatsappE164?: string;
  instagram?: string;
  address?: string;
  hours?: string;
};

export type HeroView = { title: string; text: string; imageUrl?: string; imageAlt?: string };
export type CategoryView = { slug: string; name: string; imageUrl?: string };

export type ProductView = {
  slug: string;
  name: string;
  /** Preço exibido no card: o de partida (menor preço efetivo entre as combinações). */
  basePriceCents: number;
  /** Há combinações com preços diferentes: o card mostra "A partir de". */
  priceVaries?: boolean;
  imageUrl?: string;
  imageAlt: string;
  isAvailable: boolean;
};

export type CatalogHomeView = {
  store: StoreInfo;
  theme: CatalogTheme;
  hero?: HeroView;
  categories: CategoryView[];
  productsOrder: "published_at" | "default";
  products: ProductView[];
};

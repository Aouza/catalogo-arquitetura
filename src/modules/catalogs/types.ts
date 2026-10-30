import type { CatalogTheme } from "./theme/tokens";

export type StoreInfo = {
  slug: string;
  name: string;
  description: string;
  logoUrl?: string;
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
  basePriceCents: number;
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

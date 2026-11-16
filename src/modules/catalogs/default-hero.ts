import type { HeroView } from "./types";

// Destaque da home da loja real. Ainda não é configurável pelo painel.
export const defaultHero: HeroView = {
  title: "Moda, conforto e estilo para todos.",
  text: "Peças especiais para acompanhar cada fase da família.",
  imageUrl: "/images/hero/hero-family.webp",
  imageAlt: "Família sorrindo no sofá: pai, mãe, duas crianças e um bebê",
};

// Ilustrações das categorias conhecidas; as demais mostram a inicial do nome.
export const CATEGORY_IMAGES: Record<string, string> = {
  bebes: "/images/categories/baby.webp",
  meninas: "/images/categories/girls.webp",
  meninos: "/images/categories/boy.webp",
  calcados: "/images/categories/shoes.webp",
  acessorios: "/images/categories/accessories.webp",
};

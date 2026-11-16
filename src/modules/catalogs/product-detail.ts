import { formatPrice } from "@/lib/format";
import { routes } from "@/lib/routes";
import { galleryImages } from "@/modules/media/gallery";

// Regras da página do produto, sem React nem banco: quais valores podem ser escolhidos, qual
// combinação foi escolhida, o preço, a galeria, o estado do botão e a mensagem do WhatsApp.

export const COLOR_OPTION_CODE = "cor";

export type DetailOptionValue = { id: string; code: string; label: string };
export type DetailOption = { code: string; name: string; values: DetailOptionValue[] };
export type DetailVariant = {
  id: string;
  /** Código da opção → código do valor (vazio em produto simples). */
  values: Record<string, string>;
  /** Preço efetivo: preço próprio ou, se não houver, o preço base (BR-024). */
  priceCents: number;
  isAvailable: boolean;
};
export type DetailImage = {
  id: string;
  path: string;
  alt: string;
  /** Valor de opção (ex.: a cor) a que a foto pertence; `null` = foto geral. */
  optionValueId: string | null;
  position: number;
};
export type ProductDetail = {
  id: string;
  slug: string;
  name: string;
  description: string;
  basePriceCents: number;
  options: DetailOption[];
  variants: DetailVariant[];
  images: DetailImage[];
};

/** Código da opção → código do valor escolhido. */
export type Selection = Record<string, string>;

const compatible = (variants: DetailVariant[], selection: Selection) =>
  variants.filter((variant) => Object.entries(selection).every(([code, value]) => variant.values[code] === value));

/**
 * Aceita os valores candidatos na ordem dada, descartando os inexistentes e os que formariam uma
 * combinação que não existe: uma combinação inexistente nunca pode ser selecionada, nem pela URL.
 */
function normalize(detail: ProductDetail, candidates: [string, string][]): Selection {
  const selection: Selection = {};
  for (const [code, value] of candidates) {
    const option = detail.options.find((item) => item.code === code);
    if (!option || selection[code] !== undefined || !option.values.some((item) => item.code === value)) continue;
    if (compatible(detail.variants, { ...selection, [code]: value }).length > 0) selection[code] = value;
  }
  return selection;
}

type RawParams = Record<string, string | string[] | undefined>;

/** Escolha vinda da URL (`?cor=rosa&tamanho=4`), já limpa de valores inválidos. */
export function parseSelection(detail: ProductDetail, params: RawParams): Selection {
  const candidates: [string, string][] = [];
  for (const option of detail.options) {
    const raw = params[option.code];
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (typeof value === "string") candidates.push([option.code, value]);
  }
  return normalize(detail, candidates);
}

/** Escolha depois de o visitante tocar num valor: o valor tocado tem prioridade sobre o resto. */
export function selectValue(detail: ProductDetail, selection: Selection, code: string, value: string): Selection {
  const others = detail.options
    .filter((option) => option.code !== code && selection[option.code] !== undefined)
    .map((option): [string, string] => [option.code, selection[option.code]]);
  return normalize(detail, [[code, value], ...others]);
}

export type ValueState = {
  selected: boolean;
  /** Algum produto cadastrado tem este valor. Se não, ele não pode ser escolhido de jeito nenhum. */
  exists: boolean;
  /** Existe combinação com este valor junto das outras escolhas atuais. Se não, escolher este valor solta a outra escolha. */
  compatible: boolean;
  /** Há combinação disponível (junto das outras escolhas, ou em qualquer uma se não houver compatível). */
  available: boolean;
};

export function valueState(detail: ProductDetail, selection: Selection, code: string, value: string): ValueState {
  const others = Object.fromEntries(Object.entries(selection).filter(([key]) => key !== code));
  const withValue = detail.variants.filter((variant) => variant.values[code] === value);
  const together = compatible(withValue, others);
  const pool = together.length > 0 ? together : withValue;
  return {
    selected: selection[code] === value,
    exists: withValue.length > 0,
    compatible: together.length > 0,
    available: pool.some((variant) => variant.isAvailable),
  };
}

/** Combinação escolhida; em produto simples, a variante padrão. `null` enquanto faltar escolher. */
export function selectedVariant(detail: ProductDetail, selection: Selection): DetailVariant | null {
  if (detail.options.length === 0) return detail.variants[0] ?? null;
  if (!detail.options.every((option) => selection[option.code] !== undefined)) return null;
  return compatible(detail.variants, selection)[0] ?? null;
}

/** Nomes das opções que ainda faltam escolher (na ordem do produto). */
export function missingOptions(detail: ProductDetail, selection: Selection): string[] {
  return detail.options.filter((option) => selection[option.code] === undefined).map((option) => option.name);
}

export type PriceView = { cents: number; /** Mostrar "A partir de". */ from: boolean };

/**
 * Preço exibido: o da combinação escolhida; antes disso, o de partida entre as combinações que
 * ainda cabem na escolha (as disponíveis, ou todas se nenhuma estiver).
 */
export function priceView(detail: ProductDetail, selection: Selection): PriceView {
  const variant = selectedVariant(detail, selection);
  if (variant) return { cents: variant.priceCents, from: false };

  const pool = compatible(detail.variants, selection);
  if (pool.length === 0) return { cents: detail.basePriceCents, from: false };

  const available = pool.filter((item) => item.isAvailable);
  const prices = (available.length > 0 ? available : pool).map((item) => item.priceCents);
  const min = Math.min(...prices);
  return { cents: min, from: min !== Math.max(...prices) };
}

/** Fotos exibidas: as da cor escolhida primeiro, depois as gerais (BR-031); tamanho não altera. */
export function galleryFor(detail: ProductDetail, selection: Selection): DetailImage[] {
  const colorCode = selection[COLOR_OPTION_CODE];
  const colorId = colorCode
    ? detail.options.find((option) => option.code === COLOR_OPTION_CODE)?.values.find((v) => v.code === colorCode)?.id
    : undefined;
  return galleryImages(detail.images, colorId);
}

export type CtaState =
  | { kind: "ready"; variant: DetailVariant }
  | { kind: "choose"; missing: string[] }
  | { kind: "unavailable"; reason: "combination" | "product" };

/**
 * O que o botão "Tenho interesse" faz (OQ-08, BR-041): só funciona com todas as opções escolhidas
 * e a combinação disponível. Sem isso, explica o que falta.
 */
export function ctaState(detail: ProductDetail, selection: Selection): CtaState {
  if (detail.variants.length === 0 || detail.variants.every((variant) => !variant.isAvailable)) {
    return { kind: "unavailable", reason: "product" };
  }
  const variant = selectedVariant(detail, selection);
  if (!variant) return { kind: "choose", missing: missingOptions(detail, selection) };
  if (!variant.isAvailable) return { kind: "unavailable", reason: "combination" };
  return { kind: "ready", variant };
}

/** Endereço do produto com a escolha atual (`/produto/slug?cor=rosa&tamanho=4`). */
export function productHref(detail: Pick<ProductDetail, "slug" | "options">, selection: Selection): string {
  const params = new URLSearchParams();
  for (const option of detail.options) {
    if (selection[option.code] !== undefined) params.set(option.code, selection[option.code]);
  }
  const query = params.toString();
  return query ? `${routes.product(detail.slug)}?${query}` : routes.product(detail.slug);
}

/**
 * Mensagem do WhatsApp (BR-040): produto, valores escolhidos, preço exibido e o link da combinação.
 * Diz só que há interesse: não cria pedido nem reserva (BR-042).
 */
export function buildWhatsAppMessage(args: {
  detail: ProductDetail;
  selection: Selection;
  variant: DetailVariant;
  /** Endereço completo do produto com a escolha (começa com http). */
  url: string;
}): string {
  const { detail, selection, variant, url } = args;
  const chosen = detail.options.flatMap((option) => {
    const value = option.values.find((item) => item.code === selection[option.code]);
    return value ? [`${option.name}: ${value.label}`] : [];
  });

  return [
    "Olá! Tenho interesse neste produto:",
    "",
    `*${detail.name.replace(/\*/g, "")}*`,
    ...chosen,
    `Preço: ${formatPrice(variant.priceCents)}`,
    "",
    url,
  ].join("\n");
}

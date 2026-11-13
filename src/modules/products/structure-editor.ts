import { centsToInput, parseBrlToCents } from "@/lib/format";
import type { AdminProduct } from "./get-admin-product";
import { MAX_VALUES, MAX_VARIANTS, type StructureInput } from "./schemas";
import { slugify } from "./slug";

// Lógica pura do editor de cores e tamanhos (sem React): o componente só exibe e chama estas
// funções. O resultado (`toStructure`) é validado de novo no servidor pelo mesmo schema.

export const COLOR_CODE = "cor";
export const SIZE_CODE = "tamanho";
export const MAX_LABEL_LENGTH = 60;

export type ComboConfig = {
  enabled: boolean;
  /** Texto digitado; vazio herda o preço base (zero é um preço válido). */
  price: string;
  available: boolean;
};

export type EditorState = {
  colors: string[];
  sizes: string[];
  /** Configuração por combinação, indexada por `comboKey`. */
  combos: Record<string, ComboConfig>;
};

export type ValueKind = "colors" | "sizes";

export type Combo = {
  key: string;
  colorCode?: string;
  sizeCode?: string;
  colorLabel?: string;
  sizeLabel?: string;
  /** Texto para o lojista, ex.: "Rosa · 4". */
  label: string;
  config: ComboConfig;
};

const DEFAULT_CONFIG: ComboConfig = { enabled: true, price: "", available: true };

export const emptyState = (): EditorState => ({ colors: [], sizes: [], combos: {} });

export const comboKey = (colorCode?: string, sizeCode?: string) => `${colorCode ?? ""}|${sizeCode ?? ""}`;

const codeOf = (label: string) => slugify(label, 40);

/** Problema com um rótulo novo, ou `null` se estiver tudo certo. */
export function labelProblem(state: EditorState, kind: ValueKind, rawLabel: string): string | null {
  const label = rawLabel.trim();
  if (!label) return "Digite um nome.";
  if (label.length > MAX_LABEL_LENGTH) return `Use no máximo ${MAX_LABEL_LENGTH} caracteres.`;
  if (!codeOf(label)) return "Use ao menos uma letra ou número.";
  if (state[kind].some((existing) => codeOf(existing) === codeOf(label))) {
    return kind === "colors" ? "Essa cor já foi adicionada." : "Esse tamanho já foi adicionado.";
  }
  if (state.colors.length + state.sizes.length >= MAX_VALUES) {
    return `No máximo ${MAX_VALUES} cores e tamanhos no total.`;
  }
  const next = { ...state, [kind]: [...state[kind], label] };
  if (listCombos(next).length > MAX_VARIANTS) {
    return `Isso geraria mais de ${MAX_VARIANTS} combinações. Reduza cores ou tamanhos.`;
  }
  return null;
}

export type EditResult = { state: EditorState; error?: string };

export function addValue(state: EditorState, kind: ValueKind, rawLabel: string): EditResult {
  const error = labelProblem(state, kind, rawLabel);
  if (error) return { state, error };
  return { state: { ...state, [kind]: [...state[kind], rawLabel.trim()] } };
}

export function removeValue(state: EditorState, kind: ValueKind, label: string): EditorState {
  return { ...state, [kind]: state[kind].filter((existing) => existing !== label) };
}

/** Todas as combinações de cor × tamanho (ou só as cores, só os tamanhos, ou produto único). */
export function listCombos(state: EditorState): Combo[] {
  const colors = state.colors.length ? state.colors : [undefined];
  const sizes = state.sizes.length ? state.sizes : [undefined];

  return colors.flatMap((colorLabel) =>
    sizes.map((sizeLabel) => {
      const colorCode = colorLabel === undefined ? undefined : codeOf(colorLabel);
      const sizeCode = sizeLabel === undefined ? undefined : codeOf(sizeLabel);
      const key = comboKey(colorCode, sizeCode);
      const parts = [colorLabel, sizeLabel].filter((part): part is string => part !== undefined);
      return {
        key,
        colorCode,
        sizeCode,
        colorLabel,
        sizeLabel,
        label: parts.length ? parts.join(" · ") : "Produto único",
        config: state.combos[key] ?? DEFAULT_CONFIG,
      };
    }),
  );
}

export function setCombo(state: EditorState, key: string, patch: Partial<ComboConfig>): EditorState {
  const current = state.combos[key] ?? DEFAULT_CONFIG;
  return { ...state, combos: { ...state.combos, [key]: { ...current, ...patch } } };
}

export type StructureResult = { ok: true; structure: StructureInput } | { ok: false; errors: string[] };

/** Converte o estado do editor no formato salvo pelo servidor, listando o que precisa ser corrigido. */
export function toStructure(state: EditorState): StructureResult {
  const errors: string[] = [];
  const combos = listCombos(state);
  const enabled = combos.filter((combo) => combo.config.enabled);

  if (enabled.length === 0) errors.push("Marque ao menos uma combinação.");

  const prices = new Map<string, number | null>();
  for (const combo of enabled) {
    const text = combo.config.price.trim();
    if (text === "") {
      prices.set(combo.key, null);
      continue;
    }
    const cents = parseBrlToCents(text);
    if (cents === null) errors.push(`Preço inválido em “${combo.label}”. Use um valor como 79,90.`);
    else prices.set(combo.key, cents);
  }

  if (errors.length > 0) return { ok: false, errors };

  const options: StructureInput["options"] = [];
  if (state.colors.length) {
    options.push({
      code: COLOR_CODE,
      name: "Cor",
      position: 0,
      values: state.colors.map((label, position) => ({ code: codeOf(label), label, position })),
    });
  }
  if (state.sizes.length) {
    options.push({
      code: SIZE_CODE,
      name: "Tamanho",
      position: options.length,
      values: state.sizes.map((label, position) => ({ code: codeOf(label), label, position })),
    });
  }

  const variants: StructureInput["variants"] = enabled.map((combo, position) => {
    const values: Record<string, string> = {};
    if (combo.colorCode) values[COLOR_CODE] = combo.colorCode;
    if (combo.sizeCode) values[SIZE_CODE] = combo.sizeCode;
    return {
      values,
      priceOverrideCents: prices.get(combo.key) ?? null,
      isAvailable: combo.config.available,
      position,
    };
  });

  return { ok: true, structure: { options, variants } };
}

export type HydrateResult = { supported: true; state: EditorState } | { supported: false };

/**
 * Monta o editor a partir do produto salvo. Produtos com opções diferentes de cor e tamanho
 * (ex.: criados por importação) não são editáveis por esta tela.
 */
export function hydrateEditor(product: Pick<AdminProduct, "options" | "variants">): HydrateResult {
  if (product.options.some((option) => option.code !== COLOR_CODE && option.code !== SIZE_CODE)) {
    return { supported: false };
  }

  const labelsOf = (code: string) =>
    product.options.find((option) => option.code === code)?.values.map((value) => value.label) ?? [];
  const codeToLabel = (code: string) =>
    new Map(
      (product.options.find((option) => option.code === code)?.values ?? []).map((value) => [value.code, value.label]),
    );

  const state: EditorState = { colors: labelsOf(COLOR_CODE), sizes: labelsOf(SIZE_CODE), combos: {} };
  const colorByCode = codeToLabel(COLOR_CODE);
  const sizeByCode = codeToLabel(SIZE_CODE);

  // Códigos salvos podem diferir do que `codeOf` geraria; a chave sempre usa o código recalculado.
  const keyOf = (values: Record<string, string>) => {
    const color = values[COLOR_CODE] ? colorByCode.get(values[COLOR_CODE]) : undefined;
    const size = values[SIZE_CODE] ? sizeByCode.get(values[SIZE_CODE]) : undefined;
    return comboKey(color === undefined ? undefined : codeOf(color), size === undefined ? undefined : codeOf(size));
  };

  const saved = new Map<string, ComboConfig>();
  for (const variant of product.variants) {
    saved.set(keyOf(variant.values), {
      enabled: true,
      price: variant.priceOverrideCents === null ? "" : centsToInput(variant.priceOverrideCents),
      available: variant.isAvailable,
    });
  }

  // Produto ainda sem variantes: tudo começa marcado. Com variantes: o que falta fica desmarcado.
  if (product.variants.length > 0) {
    for (const combo of listCombos(state)) {
      state.combos[combo.key] = saved.get(combo.key) ?? { enabled: false, price: "", available: true };
    }
  }

  return { supported: true, state };
}

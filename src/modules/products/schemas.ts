import { z } from "zod";
import type { ProductError } from "./errors";
import { SLUG_MAX_LENGTH, SLUG_PATTERN } from "./slug";

// Limites de BR-017 (também impostos pelo banco).
export const MAX_OPTIONS = 2;
export const MAX_VALUES = 20;
export const MAX_VARIANTS = 100;

const slugField = z
  .string()
  .trim()
  .min(1, "Informe o endereço do produto.")
  .max(SLUG_MAX_LENGTH, "O endereço é longo demais.")
  .regex(SLUG_PATTERN, "Endereço inválido: use letras minúsculas, números e hifens.");

const nameField = z
  .string()
  .trim()
  .min(1, "Informe o nome do produto.")
  .max(120, "O nome pode ter no máximo 120 caracteres.");

const descriptionField = z.string().max(2000, "A descrição pode ter no máximo 2000 caracteres.");

// BRL em centavos; zero é válido (BR-013).
const priceField = z
  .number({ error: "Informe o preço." })
  .int("O preço deve ser informado em centavos inteiros.")
  .min(0, "O preço não pode ser negativo.")
  .max(Number.MAX_SAFE_INTEGER, "Preço inválido.");

const categoryField = z.uuid("Categoria inválida.").nullable();

export const createProductSchema = z.object({
  name: nameField,
  description: descriptionField.default(""),
  basePriceCents: priceField,
  categoryId: categoryField.optional(),
  /** Opcional: se ausente, é gerado a partir do nome. */
  slug: slugField.optional(),
});

export const updateProductSchema = z
  .object({
    name: nameField,
    description: descriptionField,
    basePriceCents: priceField,
    categoryId: categoryField,
    /** Só muda se informado: renomear não altera o endereço (links já compartilhados). */
    slug: slugField,
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, "Nenhuma alteração informada.");

export type CreateProductInput = z.input<typeof createProductSchema>;
export type UpdateProductInput = z.input<typeof updateProductSchema>;

// ---------------------------------------------------------------------------
// Estrutura: opções, valores e variantes (espelha o payload de save_product_structure)
// ---------------------------------------------------------------------------
const codeField = z
  .string()
  .min(1)
  .max(40, "Código longo demais.")
  .regex(SLUG_PATTERN, "Código inválido: use letras minúsculas, números e hifens.");

const positionField = z.number().int().optional();

const optionValueSchema = z.object({
  code: codeField,
  label: z.string().trim().min(1, "Informe o nome do valor.").max(60, "Nome do valor longo demais."),
  position: positionField,
});

const optionSchema = z.object({
  code: codeField,
  name: z.string().trim().min(1, "Informe o nome da opção.").max(60, "Nome da opção longo demais."),
  position: positionField,
  values: z.array(optionValueSchema).min(1, "Cada opção precisa de ao menos um valor."),
});

const variantSchema = z.object({
  /** Mapa código da opção → código do valor. Produto simples: objeto vazio. */
  values: z.record(z.string(), z.string()),
  /** `null`/ausente herda o preço base; zero é preço válido (BR-024). */
  priceOverrideCents: priceField.nullable().optional(),
  isAvailable: z.boolean().optional(),
  position: positionField,
});

export const structureSchema = z
  .object({
    options: z.array(optionSchema).max(MAX_OPTIONS, `No máximo ${MAX_OPTIONS} opções por produto.`),
    variants: z.array(variantSchema).max(MAX_VARIANTS, `No máximo ${MAX_VARIANTS} combinações por produto.`),
  })
  .superRefine((structure, ctx) => {
    const issue = (message: string, path: (string | number)[] = []) =>
      ctx.addIssue({ code: "custom", message, path });

    const optionCodes = structure.options.map((option) => option.code);
    if (new Set(optionCodes).size !== optionCodes.length) {
      issue("Há opções com o mesmo código.", ["options"]);
    }

    let totalValues = 0;
    const validValues = new Map<string, Set<string>>();
    structure.options.forEach((option, index) => {
      const codes = option.values.map((value) => value.code);
      totalValues += codes.length;
      if (new Set(codes).size !== codes.length) {
        issue("Há valores repetidos na mesma opção.", ["options", index, "values"]);
      }
      validValues.set(option.code, new Set(codes));
    });
    if (totalValues > MAX_VALUES) {
      issue(`No máximo ${MAX_VALUES} valores no total.`, ["options"]);
    }

    const seen = new Set<string>();
    structure.variants.forEach((variant, index) => {
      const path = ["variants", index, "values"];
      const keys = Object.keys(variant.values);

      const complete =
        keys.length === optionCodes.length && optionCodes.every((code) => keys.includes(code));
      if (!complete) {
        issue("Cada combinação precisa de exatamente um valor por opção.", path);
        return;
      }
      if (!optionCodes.every((code) => validValues.get(code)?.has(variant.values[code]))) {
        issue("A combinação usa um valor que não existe na opção.", path);
        return;
      }

      const signature = [...optionCodes]
        .sort()
        .map((code) => `${code}=${variant.values[code]}`)
        .join(",");
      if (seen.has(signature)) issue("Há combinações repetidas.", path);
      seen.add(signature);
    });
  });

export type StructureInput = z.input<typeof structureSchema>;
export type StructureData = z.output<typeof structureSchema>;

/** Converte falhas do zod em um erro de domínio (mensagem = primeira falha). */
export function validationError(error: z.ZodError): ProductError {
  const issues = [...new Set(error.issues.map((item) => item.message))];
  return { code: "validation", message: issues[0] ?? "Dados inválidos.", issues };
}
